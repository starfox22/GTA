      // The three owner-approved free SUV bodies retain the existing Ranger and patrol gameplay contracts.
      // Geometry stays immutable per style/size; only a vehicle's mesh references change between near/far parts.
      const approvedSuvPanelBoxes = new Map();
      let approvedSuvCabinMaterialCache;
      function approvedSuvCabinMaterial() {
        if (!approvedSuvCabinMaterialCache) {
          approvedSuvCabinMaterialCache = civFinishPatch(civSharedMaterials().trim.clone(), 'approved-suv-cabin');
          approvedSuvCabinMaterialCache.userData.assetAtlas = 'finish';
          sharedMaterials.add(approvedSuvCabinMaterialCache);
        }
        return approvedSuvCabinMaterialCache;
      }
      function approvedSuvInteriorGeometry(kit) {
        if (kit.asset.hasInterior === true || kit.asset.type === 's1_jimny') return null;
        const set = civSet();
        carCabinParts((geometry, matrix, color, finish) => civAddMatrix(set, geometry, matrix, { color, finish }),
          kit.glass, kit.l, kit.seats.glass.w, kit.seats, CAR_CABIN_TRIM.suv, { hatch: true, police: !!kit.police });
        return civGeometry(set);
      }
      function approvedSuvPanelBox(model, swatch) {
        const key = model.type + ':' + swatch;
        if (approvedSuvPanelBoxes.has(key)) return approvedSuvPanelBoxes.get(key);
        const geometry = boxGeo.clone(), count = geometry.attributes.position.count,
          uv = new Float32Array(count * 2), finish = new Float32Array(count * 2),
          color = new Float32Array(count * 3).fill(1), sourceUv = new Float32Array(count * 2).fill(0.5),
          atlasRect = new Float32Array(count * 4), livery = new Float32Array(count * 2),
          paintUv = model.paintUv || [0, 0], liveryUv = swatchUv(swatch);
        for (let i = 0; i < count; i++) {
          uv.set(paintUv, i * 2); finish.set([0.3, 0.06], i * 2); livery.set(liveryUv, i * 2);
          atlasRect.set([paintUv[0] - 4 / 4096, paintUv[1] - 4 / 4096, 8 / 4096, 8 / 4096], i * 4);
        }
        geometry.setAttribute('uv', new Three.BufferAttribute(uv, 2));
        geometry.setAttribute('finish', new Three.BufferAttribute(finish, 2));
        geometry.setAttribute('color', new Three.BufferAttribute(color, 3));
        geometry.setAttribute('avSourceUv', new Three.BufferAttribute(sourceUv, 2));
        geometry.setAttribute('avAtlasRect', new Three.BufferAttribute(atlasRect, 4));
        geometry.setAttribute('liveryUv', new Three.BufferAttribute(livery, 2));
        geometry.computeBoundingSphere(); geometry.computeBoundingBox(); sharedGeometries.add(geometry);
        approvedSuvPanelBoxes.set(key, geometry);
        return geometry;
      }
      function approvedSuvFarPart(model, data, names, k) {
        const list = Array.isArray(names) ? names : [names];
        return vaGeometry(model, data, list.map(name => model.lodParts?.[name] || name), k);
      }
      function approvedSuvFarKit(kit, model, data, k) {
        const far = {};
        for (const [field, names] of Object.entries({ shell: 'shell', cabin: 'glass', hood: 'hood', paint: 'panels', trim: ['trim', 'cabin'], opticalGlass: 'opticalGlass' }))
          far[field] = approvedSuvFarPart(model, data, names, k) || kit[field];
        const trimName = model.lodParts?.trim || 'trim',
          outer = (model.assetPack === 'sports' ? sportsRoleTriangles(model, trimName) : model.parts[trimName]?.triangles || 0) * 3;
        far.trimOuter = far.trim ? civDrawRange(far.trim, outer) : null;
        far.wheels = kit.assetWheels.map((wheel, i) => ({
          tyre: approvedSuvFarPart(model, data, 'wheel' + i + '.tyre', k) || wheel.tyre,
          rim: approvedSuvFarPart(model, data, 'wheel' + i + '.rim', k) || wheel.rim,
          caliper: wheel.caliper ? approvedSuvFarPart(model, data, 'wheel' + i + '.caliper', k) : null,
        }));
        // Both resolutions use the same measured axle order and origins.
        const order = model.wheels.map((wheel, i) => ({ x: wheel.x, front: wheel.front, side: wheel.side, i }))
          .sort((a, b) => Number(b.front) - Number(a.front) || a.side - b.side);
        far.wheels = order.map(wheel => far.wheels[wheel.i]);
        if (model.assetPack === 'sports') {
          far.lamps = {};
          for (const [name, geometry] of Object.entries(kit.lamps))
            far.lamps[name] = approvedSuvFarPart(model, data, name, k) || geometry;
        }
        kit.far = far;
        kit.interiorFallback = approvedSuvInteriorGeometry(kit);
      }
      function approvedSuvLodParts(model) {
        const kit = model.kit, far = kit.far, parts = [];
        for (const field of ['shell', 'cabin', 'hood', 'panels']) {
          const mesh = model[field], key = field === 'panels' ? 'paint' : field;
          if (mesh && far[key] && far[key] !== mesh.geometry) parts.push({ mesh, near: mesh.geometry, far: far[key] });
        }
        // The trim is not on the deformable shell contract, but still uses the same immutable LOD pair.
        if (model.assetTrim && far.trim !== model.assetTrim.geometry)
          parts.push({ mesh: model.assetTrim, near: model.assetTrim.geometry, far: far.trim });
        if (model.opticalGlass && far.opticalGlass !== model.opticalGlass.geometry)
          parts.push({ mesh: model.opticalGlass, near: model.opticalGlass.geometry, far: far.opticalGlass });
        for (let i = 0; i < model.wheels.length; i++) for (const [child, field] of [[0, 'tyre'], [1, 'rim'], [2, 'caliper']]) {
          const mesh = model.wheels[i].wheel.children[child], geometry = far.wheels[i]?.[field];
          if (mesh && geometry && geometry !== mesh.geometry) parts.push({ mesh, near: mesh.geometry, far: geometry });
        }
        for (const lamp of model.lamps || []) {
          const geometry = far.lamps?.[lamp.key];
          if (geometry && geometry !== lamp.mesh.geometry)
            parts.push({ mesh: lamp.mesh, near: lamp.mesh.geometry, far: geometry });
        }
        model.approvedAsset = kit.approvedKey;
        model.approvedLodParts = parts;
        model.approvedLodFar = false;
      }
      // Marked S2 side skins share one source UV island. A narrow moulding can hide
      // a big door triangle's centroid while its upper/lower corners remain visible;
      // the original centroid-only first-hit classification left those corners in
      // dark trim. Coat the connected source side skin, retaining detached handles,
      // wheel-arch plastic and every authored position/normal/UV/finish.
      function policeApprovedSideBody(kit, body, l, w, section) {
        if (kit.approvedKey !== 's2_suv') return;
        const k = kit.k, report = [];
        for (const level of [kit, kit.far]) {
          const faces = [], parents = [], atVertex = new Map(),
            a = new Three.Vector3(), b = new Three.Vector3(), c = new Three.Vector3(),
            find = i => {
              while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; }
              return i;
            };
          for (const geometry of [level.shell, level.paint, level.hood, level.trim]) {
            const pos = geometry.attributes.position, source = geometry.attributes.avSourceUv, index = geometry.index;
            for (let i = 0; i < index.count; i += 3) {
              const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)], points = [a, b, c];
              points.forEach((p, j) => p.fromBufferAttribute(pos, ids[j]));
              if (!points.every((p, j) => p.y > .63 * k && p.y < 1.19 * k && Math.abs(p.z) > .72 * k &&
                source.getY(ids[j]) > .70 && source.getY(ids[j]) < .87)) continue;
              const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
                nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y),
                ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
              if (Math.abs(nz) < .6 * Math.hypot(nx, ny, nz) || nz * (a.z + b.z + c.z) <= 0) continue;
              const at = faces.length;
              faces.push({ geometry, triangle: i / 3 }); parents.push(at);
              for (const p of points) {
                // Reduced paint/trim boundaries keep endpoints but may omit an
                // intermediate edge vertex. Connectivity uses retained positions.
                const key = [p.x, p.y, p.z].map(n => n.toFixed(4)).join(':');
                if (atVertex.has(key)) parents[find(at)] = find(atVertex.get(key));
                else atVertex.set(key, at);
              }
            }
          }
          const painted = new Set(faces.flatMap((f, i) => f.geometry === level.trim ? [] : [find(i)])),
            moved = new Set(faces.flatMap((f, i) => f.geometry === level.trim && painted.has(find(i)) ? [f.triangle] : [])),
            before = { shell: level.shell.index.count / 3, trim: level.trim.index.count / 3,
              vertices: level.shell.attributes.position.count + level.trim.attributes.position.count },
            outer = level.trimOuter.drawRange.count;
          const select = keep => {
            const source = level.trim, attributes = Object.fromEntries(Object.entries(source.attributes).map(([name, attr]) =>
              [name, { source: attr, values: [] }])), remap = new Map(), index = [];
            for (let i = 0; i < source.index.count; i += 3) {
              if (moved.has(i / 3) !== keep) continue;
              for (let j = 0; j < 3; j++) {
                const vi = source.index.getX(i + j);
                if (!remap.has(vi)) {
                  remap.set(vi, remap.size);
                  for (const attr of Object.values(attributes))
                    for (let component = 0; component < attr.source.itemSize; component++)
                      attr.values.push(attr.source.getComponent(vi, component));
                }
                index.push(remap.get(vi));
              }
            }
            const geometry = new Three.BufferGeometry();
            for (const [name, attr] of Object.entries(attributes)) geometry.setAttribute(name, new Three.Float32BufferAttribute(attr.values, attr.source.itemSize));
            geometry.setIndex(index); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
            sharedGeometries.add(geometry);
            return geometry;
          };
          const paint = select(true), trim = select(false);
          paint.setAttribute('liveryUv', paint.attributes.uv.clone());
          policeAssetLiveryUv(paint, body, l, w, section, 'liveryUv');
          level.shell = vaJoin([level.shell, paint]);
          level.trim = trim;
          level.trimOuter = civDrawRange(trim, outer - moved.size * 3);
          report.push({ movedTriangles: moved.size, before, after: { shell: level.shell.index.count / 3, trim: trim.index.count / 3,
            vertices: level.shell.attributes.position.count + trim.attributes.position.count } });
        }
        kit.sideBodyLivery = report;
      }
      // The S2 has a hatch, a bowed roof and raised rails. Sedan station extrema
      // put its extra trunk/side numbers into the roof, and a full-width flat roof
      // number cuts through the rails. Anchor decals without changing source skin.
      function policeApprovedDecalAnchors(kit, section) {
        if (kit.approvedKey !== 's2_suv') return;
        const k = kit.k, side = kit.sideDecal, roof = kit.roofDecal;
        kit.trunkDecal = null;
        // Keep the complete 17 cm glyph cell above the rear quarter moulding.
        side.y = lerpNumber(section.yb, section.top, .78);
        side.half = policeAssetHalf(kit.shell, side.x, side.y, .15 * k, .1 * k) || section.half;
        if (!roof) return;
        // This source's rails start outside |z|=.48 m. Keep a clear .80 m-wide
        // aerial number between them, above the actual roof over its whole run.
        roof.width = Math.min(roof.width, .80 * k);
        const pos = kit.paint.attributes.position, rear = roof.x - roof.length / 2, front = roof.x + roof.length / 2;
        let top = -Infinity;
        for (let i = 0; i < pos.count; i++)
          if (pos.getX(i) >= rear && pos.getX(i) <= front && Math.abs(pos.getZ(i)) <= roof.width / 2)
            top = Math.max(top, pos.getY(i));
        if (Number.isFinite(top)) roof.y = top + .05;
      }
      // The existing civilian pass owns its wheel roll. Police bodies previously had static wheels;
      // only those receive a new roll here, in world metres even though their mesh has a .8 draw scale.
      function animateApprovedSuvWheels(c, m, seconds) {
        if (!m.approvedAsset || m.bikeUpdate || !m.wheels?.length) return;
        const target = c.tyres ? clamp(c.tyres.steer || 0, -0.65, 0.65) : clamp(c.av * 0.5, -0.4, 0.4);
        m.approvedSteer = (m.approvedSteer || 0) + (target - (m.approvedSteer || 0)) * Math.min(1, seconds * 8);
        const locks = c.tyres?.lock, spinning = (c.spinSpeed || 0) > 1 ? drivenAxle(c) : null,
          spinExtra = spinning ? c.spinSpeed * (c.speed < -2 ? -1 : 1) : 0;
        for (const wheel of m.wheels) {
          if (wheel.front) wheel.wheel.rotation.y = -m.approvedSteer;
          if (!m.police) continue;
          const lock = locks ? wheel.front ? locks[0] : Math.max(locks[1], c.handbrakeTurn ? 1 : 0) : 0,
            driven = spinning === 'all' || spinning === (wheel.front ? 'front' : 'rear'),
            radius = Math.max(1e-6, wheel.radius * (m.modelScale || m.drawScale || 1));
          wheel.wheel.rotation.z -= ((c.speed + (driven ? spinExtra : 0)) * seconds / radius) * (driven ? 1 : 1 - lock);
        }
      }
