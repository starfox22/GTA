      // Source-backed front doors: actual body apertures and moving paint/trim/glass.
      // Clipping preserves every original vertex ID; only edge intersections are appended.
      const vehicleDoorPartitions = new WeakMap();
      const vehicleDoorGlassMaterials = new WeakMap();
      const vehicleDoorAxis = new Three.Vector3();
      function vehicleDoorGlassMaterial(source) {
        if (!source || source.visible === false || source.side === Three.DoubleSide && (!source.transparent || source.forceSinglePass)) return source;
        let material = vehicleDoorGlassMaterials.get(source);
        if (!material) {
          material = source.clone();
          material.side = Three.DoubleSide; material.forceSinglePass = true;
          material.onBeforeCompile = source.onBeforeCompile;
          material.customProgramCacheKey = () => source.customProgramCacheKey() + '-moving-door';
          vehicleDoorGlassMaterials.set(source, material); sharedMaterials.add(material);
        }
        return material;
      }
      function vehicleDoorNear(m) {
        if (!m.approvedLodFar) return;
        m.approvedLodFar = false;
        for (const part of m.approvedLodParts || []) part.mesh.geometry = part.near;
        if (m.approvedInterior) m.approvedInterior.visible = true;
      }
      function vehicleDoorSource(m, mesh) {
        return m.doorBodySources?.get(mesh) || m.approvedLodParts?.find(part => part.mesh === mesh)?.near || m.crumple?.parts.find(part => part.mesh === mesh)?.source || mesh.geometry;
      }
      function vehicleDoorMeshes(m) {
        const list = [m.shell, m.panels, m.cabin, m.assetTrim, ...(m.kit?.nativeDoors ? [m.opticalGlass] : []), ...(m.doorBodySources?.keys() || [])];
        // Procedural cars keep trim unnamed, but expose its immutable kit geometry.
        for (const mesh of m.body.children) if (mesh.isMesh && mesh.geometry === m.kit?.trim) list.push(mesh);
        return [...new Set(list.filter(mesh => mesh?.isMesh && mesh.parent === m.body && mesh.geometry?.attributes.position))];
      }
      function vehicleDoorVolume(m, side, rect) {
        const M = m.seats?.M || CAR_M, roof = m.dims.roof || m.seats?.glass?.g?.roof || m.dims.h + .55 * M;
        return { x0: rect.x0, x1: rect.x1, y0: rect.y0, y1: roof - .025 * M,
          z0: m.dims.w * .34, z1: m.dims.w, side };
      }
      function vehicleDoorNativePartition(source, names) {
        const key = 'native|' + [...names].sort().join(','), cache = vehicleDoorPartitions.get(source) || new Map();
        vehicleDoorPartitions.set(source, cache);
        if (cache.has(key)) return cache.get(key);
        const ranges = names.flatMap(name => source.userData.vehiclePartRanges?.[name] || []),
          outside = [], inside = [], outFaces = [], inFaces = [], outGroups = [], inGroups = [], total = source.index?.count || source.attributes.position.count,
          groups = source.groups.length ? source.groups : [{ start: 0, count: total, materialIndex: 0 }];
        for (const group of groups) {
          const o = outside.length, d = inside.length;
          for (let at = group.start; at + 2 < Math.min(total, group.start + group.count); at += 3) {
            const list = ranges.some(([start, count]) => at >= start && at < start + count) ? inside : outside;
            list.push(source.index ? source.index.getX(at) : at, source.index ? source.index.getX(at + 1) : at + 1, source.index ? source.index.getX(at + 2) : at + 2);
            (list === inside ? inFaces : outFaces).push(at / 3);
          }
          if (outside.length > o) outGroups.push({ start: o, count: outside.length - o, materialIndex: group.materialIndex });
          if (inside.length > d) inGroups.push({ start: d, count: inside.length - d, materialIndex: group.materialIndex });
        }
        const make = (indices, groups, faces) => {
          const geometry = source.clone(); geometry.setIndex(indices); geometry.clearGroups();
          for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex);
          geometry.userData.vehicleSourceFaces = faces;
          sharedGeometries.add(geometry); return geometry;
        }, result = { body: inside.length ? make(outside, outGroups, outFaces) : source, door: inside.length ? make(inside, inGroups, inFaces) : null };
        cache.set(key, result); return result;
      }
      // Split a source geometry by convex door volumes. All custom shader attributes and material groups survive.
      function vehicleDoorPartition(source, volumes, matrix) {
        const key = volumes.map(v => [v.x0, v.x1, v.y0, v.y1, v.z0, v.z1, v.side].join(',')).join(';') + '|' + matrix.elements.join(','),
          cache = vehicleDoorPartitions.get(source) || new Map();
        vehicleDoorPartitions.set(source, cache);
        if (cache.has(key)) return cache.get(key);
        const attributes = source.attributes, names = Object.keys(attributes), count = attributes.position.count,
          values = Object.fromEntries(names.map(name => [name, []])), points = [],
          index = source.index, total = index ? index.count : count, outside = [], inside = [],
          outsideGroups = [], insideGroups = [], outFaces = [], inFaces = [], origins = [], vector = new Three.Vector3(),
          groups = source.groups.length ? source.groups : [{ start: 0, count: total, materialIndex: 0 }];
        let sourceFace;
        for (let i = 0; i < count; i++) {
          vector.fromBufferAttribute(attributes.position, i).applyMatrix4(matrix); points.push(vector.toArray());
          for (const name of names) for (let c = 0; c < attributes[name].itemSize; c++) values[name].push(attributes[name].getComponent(i, c));
        }
        const mix = (a, b, t) => {
          const at = points.length;
          points.push(points[a].map((v, axis) => v + (points[b][axis] - v) * t));
          const wa = a < count ? sourceFace.map(i => Number(i === a)) : origins[a - count].slice(3),
            wb = b < count ? sourceFace.map(i => Number(i === b)) : origins[b - count].slice(3);
          origins.push([...sourceFace, ...wa.map((v, i) => v + (wb[i] - v) * t)]);
          for (const name of names) {
            const size = attributes[name].itemSize, data = values[name];
            for (let c = 0; c < size; c++) data.push(data[a * size + c] + (data[b * size + c] - data[a * size + c]) * t);
          }
          return at;
        }, clip = (polygon, axis, sign, edge, keep) => {
          const result = [];
          for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length],
              da = (points[a][axis] * sign - edge) * keep, db = (points[b][axis] * sign - edge) * keep,
              ia = da >= -1e-7, ib = db >= -1e-7;
            if (ia) result.push(a);
            if (ia !== ib) result.push(mix(a, b, da / (da - db)));
          }
          return result;
        }, fan = (list, polygon) => {
          for (let i = 1; i + 1 < polygon.length; i++) { list.push(polygon[0], polygon[i], polygon[i + 1]); (list === inside ? inFaces : outFaces).push(sourceFaceIndex); }
        };
        let sourceFaceIndex;
        for (const group of groups) {
          const outStart = outside.length, inStart = inside.length;
          for (let f = group.start; f + 2 < Math.min(total, group.start + group.count); f += 3) {
            sourceFace = [index ? index.getX(f) : f, index ? index.getX(f + 1) : f + 1, index ? index.getX(f + 2) : f + 2];
            sourceFaceIndex = f / 3;
            let remaining = [sourceFace];
            for (const volume of volumes) {
              const next = [], planes = [[0, 1, volume.x0], [0, -1, -volume.x1], [1, 1, volume.y0], [1, -1, -volume.y1], [2, volume.side, volume.z0], [2, -volume.side, -volume.z1]];
              for (const polygon of remaining) {
                if (planes.some(([axis, sign, edge]) => polygon.every(i => points[i][axis] * sign < edge - 1e-7))) { next.push(polygon); continue; }
                let rest = polygon;
                for (const [axis, sign, edge] of planes) {
                  if (!rest.length) break;
                  if (rest.every(i => Math.abs(points[i][axis] * sign - edge) < 1e-7)) { next.push(rest); rest = []; break; }
                  const cut = clip(rest, axis, sign, edge, -1);
                  if (cut.length >= 3) next.push(cut);
                  rest = clip(rest, axis, sign, edge, 1);
                }
                fan(inside, rest);
              }
              remaining = next;
            }
            for (const polygon of remaining) fan(outside, polygon);
          }
          if (outside.length > outStart) outsideGroups.push({ start: outStart, count: outside.length - outStart, materialIndex: group.materialIndex });
          if (inside.length > inStart) insideGroups.push({ start: inStart, count: inside.length - inStart, materialIndex: group.materialIndex });
        }
        const make = (indices, materialGroups) => {
          const geometry = new Three.BufferGeometry();
          for (const name of names) geometry.setAttribute(name, new Three.Float32BufferAttribute(values[name], attributes[name].itemSize));
          geometry.setIndex(indices);
          geometry.userData.vehicleDoorOrigins = { count, extra: origins };
          geometry.userData.vehicleSourceFaces = indices === inside ? inFaces : outFaces;
          for (const group of materialGroups) geometry.addGroup(group.start, group.count, group.materialIndex);
          geometry.computeBoundingBox(); geometry.computeBoundingSphere(); sharedGeometries.add(geometry);
          return geometry;
        }, result = { body: inside.length ? make(outside, outsideGroups) : source, door: inside.length ? make(inside, insideGroups) : null };
        cache.set(key, result);
        return result;
      }
      function vehicleDoorBodyMatrix(m, mesh) {
        return crumpleBodyMatrix(mesh, m.body, new Three.Matrix4());
      }
      function vehicleDoorHinge(m, side, x, height) {
        const ray = new Three.Raycaster(), start = new Three.Vector3(x - .02 * (m.seats?.M || CAR_M), height, side * m.dims.w),
          direction = new Three.Vector3(0, 0, -side), material = new Three.MeshBasicMaterial({ side: Three.DoubleSide });
        ray.set(start, direction);
        let z = side * m.dims.w * .5, distance = Infinity;
        for (const mesh of [m.shell, m.panels].filter(Boolean)) {
          const probe = new Three.Mesh(vehicleDoorSource(m, mesh), material);
          probe.matrixAutoUpdate = false; probe.matrixWorld.copy(vehicleDoorBodyMatrix(m, mesh));
          const hit = ray.intersectObject(probe, false)[0];
          if (hit && hit.point.z * side > m.dims.w * .3 && hit.distance < distance) { z = hit.point.z; distance = hit.distance; }
        }
        material.dispose();
        return z;
      }
      function vehicleDoorLayers(c, m, side, rect, pivot) {
        vehicleDoorNear(m);
        m.doorBodySources ||= new Map();
        const native = m.kit?.nativeDoors?.[side], volume = vehicleDoorVolume(m, side, rect), layers = [];
        for (const sourceMesh of vehicleDoorMeshes(m)) {
          const source = vehicleDoorSource(m, sourceMesh); m.doorBodySources.set(sourceMesh, source);
          const matrix = vehicleDoorBodyMatrix(m, sourceMesh), partition = native ? vehicleDoorNativePartition(source, native.partNames) : vehicleDoorPartition(source, [volume], matrix);
          if (!partition.door) continue;
          const frameKey = matrix.elements.join(',') + '|' + pivot.position.toArray().join(',');
          partition.frames ||= new Map();
          let geometry = partition.frames.get(frameKey);
          if (!geometry) {
            geometry = partition.door.clone();
            geometry.applyMatrix4(matrix); geometry.translate(-pivot.position.x, -pivot.position.y, -pivot.position.z);
            partition.frames.set(frameKey, geometry); sharedGeometries.add(geometry);
          }
          const material = sourceMesh === m.cabin ? (Array.isArray(sourceMesh.material) ? sourceMesh.material.map(vehicleDoorGlassMaterial) : vehicleDoorGlassMaterial(sourceMesh.material)) : sourceMesh.material,
            mesh = new Three.Mesh(geometry, material);
          mesh.castShadow = sourceMesh.castShadow; mesh.receiveShadow = sourceMesh.receiveShadow;
          mesh.userData.vehicleDoorSource = sourceMesh;
          if (native) mesh.userData.vehicleDoorVertices = new Set(partition.door.index.array);
          if (sourceMesh === m.cabin) mesh.userData.doorGlass = true;
          if (m.assetChar) assetCharAdopt(m, mesh);
          pivot.add(mesh); layers.push(mesh);
        }
        return { layers, volume, native };
      }
      function vehicleDoorBodyState(c, m, mask) {
        if (mask === (m.doorBodyMask || 0)) return;
        m.doorBodyMask = mask;
        const doors = Object.entries(m.doors || {}).filter(([side]) => mask & (Number(side) < 0 ? 1 : 2)).map(([, door]) => door),
          volumes = doors.map(door => door.volume).filter(Boolean), names = doors.flatMap(door => door.native?.partNames || []);
        for (const [mesh, source] of m.doorBodySources || []) {
          const geometry = volumes.length ? (m.kit?.nativeDoors ? vehicleDoorNativePartition(source, names) : vehicleDoorPartition(source, volumes, vehicleDoorBodyMatrix(m, mesh))).body : source,
            part = m.crumple?.parts.find(part => part.mesh === mesh);
          if ((part?.source || mesh.geometry) === geometry) continue;
          // Bending clones only this source variant. Vertex prefixes stay identical for marks/blood anchors.
          const before = mesh.geometry, owned = part?.own, bent = part?.bent;
          mesh.geometry = geometry;
          if (part) {
            const replacement = crumplePart(m, mesh, part.hinge);
            Object.assign(part, replacement); part.moved = null;
            // Keep the currently bent surface while the normal crumple slice finishes the new boundary.
            // A door closing must not flash a pristine, undented body for that frame.
            if (bent) {
              mesh.geometry = geometry.clone();
              const p = mesh.geometry.attributes.position, old = before.attributes.position, original = source.attributes.position.count,
                origins = geometry.userData.vehicleDoorOrigins;
              for (let i = 0; i < Math.min(original, old.count); i++) p.setXYZ(i, old.getX(i), old.getY(i), old.getZ(i));
              if (origins) for (let i = original; i < p.count; i++) {
                const row = origins.extra[i - origins.count];
                p.setXYZ(i, old.getX(row[0]) * row[3] + old.getX(row[1]) * row[4] + old.getX(row[2]) * row[5],
                  old.getY(row[0]) * row[3] + old.getY(row[1]) * row[4] + old.getY(row[2]) * row[5],
                  old.getZ(row[0]) * row[3] + old.getZ(row[1]) * row[4] + old.getZ(row[2]) * row[5]);
              }
              mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
              mesh.userData.crumpleSource = geometry; part.own = true; part.bent = true;
            }
          }
          if (owned) before.dispose();
        }
        m.shapeVersion = (m.shapeVersion || 0) + 1;
        if (m.crumple) {
          m.crumple.fresh = true;
          if (m.crumple.dents) crumpleStart(c, m, m.crumple.dents, false);
        }
      }
      function vehicleDoorShown(door, shown, glassShown) {
        for (const mesh of door.layers || [door.panel]) mesh.visible = shown && mesh !== door.glass;
        door.opening.visible = shown;
        if (door.glass) door.glass.visible = !!glassShown;
      }
      function vehicleDoorPose(door, side, angle, tilt = 0) {
        if (door.native?.axis) {
          door.pivot.quaternion.setFromAxisAngle(vehicleDoorAxis.fromArray(door.native.axis).normalize(), side * angle);
          if (tilt) door.pivot.rotateZ(tilt);
        } else door.pivot.rotation.set(0, side * angle, tilt);
      }
      // Exact source IDs allow marks to move to a source-extracted door and back without a grid approximation.
      function vehicleDoorOriginalAnchor(geometry, anchor) {
        const origins = geometry.userData.vehicleDoorOrigins;
        if (!origins) return;
        const ids = [anchor.a, anchor.b, anchor.c], weights = [anchor.u, anchor.v, anchor.w],
          extra = ids.find(i => i >= origins.count);
        if (extra === undefined) return;
        const face = origins.extra[extra - origins.count].slice(0, 3), bary = [0, 0, 0];
        for (let k = 0; k < 3; k++) {
          const row = ids[k] >= origins.count ? origins.extra[ids[k] - origins.count].slice(3) : face.map(i => Number(i === ids[k]));
          for (let j = 0; j < 3; j++) bary[j] += row[j] * weights[k];
        }
        [anchor.a, anchor.b, anchor.c] = face; [anchor.u, anchor.v, anchor.w] = bary;
      }
      function vehicleDoorMoveMark(m, anchor) {
        const layerSource = anchor.object?.userData.vehicleDoorSource;
        if (layerSource) {
          vehicleDoorOriginalAnchor(anchor.object.geometry, anchor);
          if (anchor.object.visible && anchor.object.parent?.visible) return true;
          anchor.object = layerSource;
        }
        for (const door of Object.values(m.doors || {})) for (const layer of door.layers || []) {
          if (layer.userData.vehicleDoorSource !== anchor.object || !layer.visible) continue;
          vehicleDoorOriginalAnchor(m.crumple?.parts.find(part => part.mesh === anchor.object)?.source || anchor.object.geometry, anchor);
          const vertices = layer.userData.vehicleDoorVertices;
          if (vertices && vertices.has(anchor.a) && vertices.has(anchor.b) && vertices.has(anchor.c)) { anchor.object = layer; return true; }
          if (vertices) continue;
          const source = vehicleDoorSource(m, anchor.object), p = source.attributes.position,
            point = new Three.Vector3(p.getX(anchor.a) * anchor.u + p.getX(anchor.b) * anchor.v + p.getX(anchor.c) * anchor.w,
              p.getY(anchor.a) * anchor.u + p.getY(anchor.b) * anchor.v + p.getY(anchor.c) * anchor.w,
              p.getZ(anchor.a) * anchor.u + p.getZ(anchor.b) * anchor.v + p.getZ(anchor.c) * anchor.w).applyMatrix4(vehicleDoorBodyMatrix(m, anchor.object)), v = door.volume;
          if (point.x > v.x0 && point.x < v.x1 && point.y > v.y0 && point.y < v.y1 && point.z * v.side > v.z0 && point.z * v.side < v.z1) {
            anchor.object = layer; return true;
          }
        }
        return !!layerSource;
      }
      // Named developer report: drawn door/cabin facts, without exposing mutable objects or a generic accessor.
      function vehicleDoorGeometryMatches(a, b) {
        if (a === b || !a && !b) return true;
        if (!a || !b || (a.index?.count || 0) !== (b.index?.count || 0) || Object.keys(a.attributes).length !== Object.keys(b.attributes).length || JSON.stringify(a.groups) !== JSON.stringify(b.groups)) return false;
        for (let i = 0; i < (a.index?.count || 0); i++) if (a.index.getX(i) !== b.index.getX(i)) return false;
        for (const [name, source] of Object.entries(b.attributes)) {
          const actual = a.attributes[name];
          if (!actual || actual.count !== source.count || actual.itemSize !== source.itemSize) return false;
          for (let i = 0; i < source.count; i++) for (let c = 0; c < source.itemSize; c++) if (actual.getComponent(i, c) !== source.getComponent(i, c)) return false;
        }
        return true;
      }
      function vehicleDoorsReport(id = null) {
        const cars = [], material = source => !source ? null : Array.isArray(source) ? source.map(material) : {
          uuid: source.uuid, map: source.map?.uuid || null, roughnessMap: source.roughnessMap?.uuid || null,
          metalnessMap: source.metalnessMap?.uuid || null, emissiveMap: source.emissiveMap?.uuid || null,
          transparent: source.transparent, opacity: source.opacity, alphaTest: source.alphaTest,
          depthWrite: source.depthWrite, side: source.side, forceSinglePass: source.forceSinglePass,
        };
        for (const [vehicle, model] of carModels) {
          if (!model.car || id !== null && vehicle.id !== id) continue;
          const doors = {};
          for (const [side, door] of Object.entries(model.doors || {})) doors[side] = {
            native: !!door.native, pivot: door.pivot.position.toArray(), axis: door.native?.axis?.slice() || [0, 1, 0],
            quaternion: door.pivot.quaternion.toArray(), angle: door.pivot.rotation.y,
            windowVisible: !!door.glass?.visible && door.glass.material?.visible !== false,
            sourceParts: door.native?.partNames?.slice() || [],
            layers: door.layers.map(layer => ({ triangles: layer.geometry?.index?.count / 3 || 0, visible: layer.visible,
              window: !!layer.userData.doorGlass, innerCard: !!layer.userData.vehicleDoorInside, material: material(layer.material) })),
            apertureHasCentrePanel: !!door.opening.geometry || door.opening.children.some(child => child.isMesh),
          };
          cars.push({ id: vehicle.id, type: vehicle.type, asset: model.asset || null, mask: model.doorBodyMask || 0,
            nativeDoors: !!model.kit?.nativeDoors, doors,
            materials: { shell: material(model.shell?.material), trim: material(model.assetTrim?.material),
              optics: material(model.opticalGlass?.material), cabin: material(model.cabin?.material) },
            closedSourceGeometry: { shell: model.shell?.geometry === model.kit?.shell, panels: model.panels?.geometry === model.kit?.paint,
              cabin: model.cabin?.geometry === model.kit?.cabin, trim: !model.assetTrim || model.assetTrim.geometry === model.kit?.trim,
              optics: !model.opticalGlass && !model.kit?.opticalGlass || model.opticalGlass?.geometry === model.kit?.opticalGlass },
            sourceGeometryRestored: { shell: vehicleDoorGeometryMatches(model.shell?.geometry, model.kit?.shell), panels: vehicleDoorGeometryMatches(model.panels?.geometry, model.kit?.paint),
              cabin: vehicleDoorGeometryMatches(model.cabin?.geometry, model.kit?.cabin), trim: !model.assetTrim || vehicleDoorGeometryMatches(model.assetTrim.geometry, model.kit?.trim),
              optics: vehicleDoorGeometryMatches(model.opticalGlass?.geometry, model.kit?.opticalGlass) },
            cabin: { authored: model.kit?.asset?.hasInterior === true || model.kit?.asset?.type === 's1_jimny',
              fallbackVisible: !!model.approvedInterior?.visible,
              interiorTriangles: Math.max(0, ((model.kit?.trim?.index?.count || 0) - (model.kit?.trimOuter?.drawRange?.count || 0)) / 3),
              seat: model.seats ? [model.seats.x, model.seats.y, model.seats.z] : null },
          });
        }
        return { cars };
      }
