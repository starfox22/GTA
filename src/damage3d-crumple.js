      // Damage 3D crumple: every part of a car body bent by the one crumple field (crumpleField, damage-crumple.js) at
      // its rest place: shell, glass, paint panels, trim and cabin, lamps, hood, bumpers; hinges, wheels and halos move.
      /*
       * BODY CRUMPLE
       * The first time a car body shows damage, crumpleCollect lists its parts in their rest pose: every mesh under
       * the body (a `part`: its pristine positions and normals, its rest matrix in body space and that matrix's
       * inverse for moves, its body-space box) and the things that only move (a `point`: wheel groups, the hood's
       * hinge, door and boot hinges, wiper sets, lamp halos and police beacon halos). Parts made later (a sprung door's
       * opening, the engine bay, a boot lid) join through crumpleAdopt. crumpleStart queues the body and crumpleSlices
       * (each frame, within CRUMPLE_BUDGET_MS) moves every vertex by crumpleField at its rest place in body space, so
       * the shell, the glass in its frame, the panels, the lamps and the cabin inside all bend together; the hood bends
       * relative to its hinge (the hinge itself moves), wheels move with their arches (never up or down: the tyres keep
       * the road). A part no dent reaches keeps the shared geometry; one that is bent gets its own copy (dents never
       * shrink until a repair, which bends it back).
       * Normals are recomputed where a vertex moved and the authored ones kept where it did not.
       */
      const crumpleMove = { x: 0, y: 0, z: 0 },
        crumpleRest = new Three.Matrix4(),
        crumpleLinear = new Three.Matrix3();
      // The matrix that takes `object`'s local space into `body`'s, from the local matrices as they stand.
      function crumpleBodyMatrix(object, body, out) {
        out.identity();
        for (let o = object; o && o !== body; o = o.parent) {
          o.updateMatrix();
          out.premultiply(o.matrix);
        }
        return out;
      }
      function crumplePart(m, mesh, hinge) {
        const geometry = mesh.geometry,
          position = geometry.attributes.position;
        if (!position || position.isInterleavedBufferAttribute || mesh.isInstancedMesh || mesh.userData.vehicleMerged || mesh.userData.carBloodSkin) return null;
        const rel = crumpleBodyMatrix(mesh, m.body, new Three.Matrix4()),
          inverse = crumpleLinear.setFromMatrix4(rel).invert().elements.slice(),
          base = position.array,
          box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
          e = rel.elements;
        for (let i = 0; i < position.count; i++) {
          const x = base[i * 3],
            y = base[i * 3 + 1],
            z = base[i * 3 + 2],
            bx = e[0] * x + e[4] * y + e[8] * z + e[12],
            by = e[1] * x + e[5] * y + e[9] * z + e[13],
            bz = e[2] * x + e[6] * y + e[10] * z + e[14];
          if (bx < box[0]) box[0] = bx;
          if (by < box[1]) box[1] = by;
          if (bz < box[2]) box[2] = bz;
          if (bx > box[3]) box[3] = bx;
          if (by > box[4]) box[4] = by;
          if (bz > box[5]) box[5] = bz;
        }
        return {
          mesh,
          source: geometry,
          base,
          normals: geometry.attributes.normal && !geometry.attributes.normal.isInterleavedBufferAttribute ? geometry.attributes.normal.array : null,
          rel: e.slice(),
          inverse,
          box,
          hinge,
          own: false,
          bent: false,
        };
      }
      function crumplePoint(m, object, level) {
        const rel = crumpleBodyMatrix(object, m.body, crumpleRest),
          parent = object.parent && object.parent !== m.body ? crumpleLinear.setFromMatrix4(crumpleBodyMatrix(object.parent, m.body, new Three.Matrix4())).invert().elements.slice() : null;
        return { object, rest: object.position.clone(), at: [rel.elements[12], rel.elements[13], rel.elements[14]], parent, level: !!level };
      }
      // Walks the body's tree for parts, leaving out subtrees in `skip` (handled as points or parts of their own).
      function crumpleWalk(m, object, skip, parts) {
        for (const child of object.children) {
          if (skip.has(child) || child.userData.vehicleMerged) continue;
          if (child.isMesh && !child.isInstancedMesh) {
            const part = crumplePart(m, child, null);
            if (part) parts.push(part);
          }
          if (child.children.length) crumpleWalk(m, child, skip, parts);
        }
      }
      function crumpleCollect(m) {
        const skip = new Set(),
          parts = [],
          points = [];
        m.body.updateMatrix();
        for (const w of m.wheels || [])
          if (w.wheel?.isObject3D) {
            skip.add(w.wheel);
            points.push(crumplePoint(m, w.wheel, true));
          }
        if (m.hoodPivot) {
          skip.add(m.hoodPivot);
          const hinge = crumplePoint(m, m.hoodPivot, false);
          points.push(hinge);
          const part = crumplePart(m, m.hood, hinge.at);
          if (part) {
            part.length = Math.max(1, part.box[3] - hinge.at[0]);
            part.buckle = true;
            parts.push(part);
          }
        }
        for (const bumper of m.bumpers || []) {
          skip.add(bumper);
          const part = crumplePart(m, bumper, null);
          if (part) parts.push(part);
        }
        if (m.wipers?.plane) {
          skip.add(m.wipers.plane);
          points.push(crumplePoint(m, m.wipers.plane, false));
        }
        for (const sprite of m.nightLights || []) points.push(crumplePoint(m, sprite, false));
        for (const halo of m.policeHalos || []) points.push(crumplePoint(m, halo.sprite, false));
        for (const door of m.rearDoors || []) {
          skip.add(door.pivot);
          points.push(crumplePoint(m, door.pivot, false));
        }
        crumpleWalk(m, m.body, skip, parts);
        // The trim's outer share (exterior trim before the cabin: cars3d-interior.js), for marks that must not land inside.
        const outer = m.kit?.trimOuter;
        return { parts, points, skip, fresh: false, trimSource: m.kit?.trim || null, trimOuter: outer ? Math.min(outer.drawRange.count, outer.index ? outer.index.count : Infinity) : Infinity };
      }
      // A sprung door cut from the body's own side: a grid over the door's rectangle (body space, x0..x1 along, y0..y1
      // up) laid on the pristine shell by rays from the side, with the shell's own UVs (so the paint and a livery carry
      // on), as the door (outer skin in paint, inner trim dark, edges in paint; positions relative to `origin`, its
      // hinge) and as the opening left in the body (the dark inner panel flush with the side). Null when no ray meets
      // the shell (the old flat panels are used).
      const doorRay = new Three.Raycaster(),
        doorFrom = new Three.Vector3(),
        doorDir = new Three.Vector3();
      function doorPanelGeometries(m, side, x0, x1, y0, y1, origin) {
        const shellPart = m.crumple?.parts.find((p) => p.mesh === m.shell),
          probe = new Three.Mesh(shellPart ? shellPart.source : m.shell.geometry);
        probe.updateMatrixWorld(true);
        const NX = 8,
          NY = 6,
          grid = [],
          reach = m.dims.w * 1.5;
        for (let j = 0; j < NY; j++)
          for (let i = 0; i < NX; i++) {
            const x = x0 + ((x1 - x0) * i) / (NX - 1),
              y = y0 + ((y1 - y0) * j) / (NY - 1);
            doorRay.set(doorFrom.set(x, y, side * reach), doorDir.set(0, 0, -side));
            doorRay.far = reach * 2;
            const hit = doorRay.intersectObject(probe, false)[0];
            if (!hit) return null;
            grid.push([x, y, hit.point.z, hit.uv ? hit.uv.x : 0.5, hit.uv ? hit.uv.y : 0.5]);
          }
        const at = (i, j) => grid[j * NX + i],
          door = { position: [], uv: [], groups: [[], []] },
          opening = { position: [], uv: [] },
          inset = 0.35,
          push = (set, p, dz, list) => {
            set.position.push(p[0] - origin.x, p[1] - origin.y, p[2] + side * dz - origin.z);
            set.uv.push(p[3], p[4]);
            if (list) list.push(set.position.length / 3 - 1);
          },
          quad = (list, a, b, c, d) => list.push(a, b, d, b, c, d);
        // Skin and trim: one vertex per grid point on each face.
        const outer = [],
          inner = [];
        for (const p of grid) push(door, p, 0.03, outer);
        for (const p of grid) push(door, p, -inset, inner);
        for (let j = 0; j < NY - 1; j++)
          for (let i = 0; i < NX - 1; i++) {
            const k = j * NX + i,
              a = outer[k],
              b = outer[k + 1],
              c = outer[k + NX + 1],
              d = outer[k + NX];
            // Wound to face out on this side; the trim the other way.
            if (side > 0) quad(door.groups[0], a, b, c, d);
            else quad(door.groups[0], b, a, d, c);
            const ia = inner[k],
              ib = inner[k + 1],
              ic = inner[k + NX + 1],
              id = inner[k + NX];
            if (side > 0) quad(door.groups[1], ib, ia, id, ic);
            else quad(door.groups[1], ia, ib, ic, id);
          }
        // The edges round the door (skin to trim).
        const rim = [];
        for (let i = 0; i < NX - 1; i++) rim.push([i, 0, i + 1, 0]);
        for (let j = 0; j < NY - 1; j++) rim.push([NX - 1, j, NX - 1, j + 1]);
        for (let i = NX - 1; i > 0; i--) rim.push([i, NY - 1, i - 1, NY - 1]);
        for (let j = NY - 1; j > 0; j--) rim.push([0, j, 0, j - 1]);
        for (const [ai, aj, bi, bj] of rim) {
          const a = outer[aj * NX + ai],
            b = outer[bj * NX + bi],
            c = inner[bj * NX + bi],
            d = inner[aj * NX + ai];
          if (side > 0) quad(door.groups[0], b, a, d, c);
          else quad(door.groups[0], a, b, c, d);
        }
        const doorGeometry = new Three.BufferGeometry();
        doorGeometry.setAttribute('position', new Three.Float32BufferAttribute(door.position, 3));
        doorGeometry.setAttribute('uv', new Three.Float32BufferAttribute(door.uv, 2));
        doorGeometry.setIndex([...door.groups[0], ...door.groups[1]]);
        doorGeometry.addGroup(0, door.groups[0].length, 0);
        doorGeometry.addGroup(door.groups[0].length, door.groups[1].length, 1);
        doorGeometry.computeVertexNormals();
        // The opening: the inner panel left flush with the side (body space, not relative to the hinge).
        const openingIndex = [];
        for (const p of grid) {
          opening.position.push(p[0], p[1], p[2] + side * 0.02);
          opening.uv.push(p[3], p[4]);
        }
        for (let j = 0; j < NY - 1; j++)
          for (let i = 0; i < NX - 1; i++) {
            const k = j * NX + i;
            if (side > 0) quad(openingIndex, k, k + 1, k + NX + 1, k + NX);
            else quad(openingIndex, k + 1, k, k + NX, k + NX + 1);
          }
        const openingGeometry = new Three.BufferGeometry();
        openingGeometry.setAttribute('position', new Three.Float32BufferAttribute(opening.position, 3));
        openingGeometry.setAttribute('uv', new Three.Float32BufferAttribute(opening.uv, 2));
        openingGeometry.setIndex(openingIndex);
        openingGeometry.computeVertexNormals();
        return { door: doorGeometry, opening: openingGeometry };
      }
      // A part or hinge made after the first damage (door opening and hinge, boot lid, engine bay) joins the crumple.
      // `hinged`: a mesh inside a hinge just adopted as a point (a door): bent relative to that hinge's own move.
      function crumpleAdopt(m, object, asPoint, hinged) {
        const record = m.crumple;
        if (!record) return;
        if (asPoint) {
          record.skip.add(object);
          record.points.push(crumplePoint(m, object, false));
        } else if (object.isMesh) {
          const part = crumplePart(m, object, hinged ? record.points[record.points.length - 1].at : null);
          if (part) record.parts.push(part);
        } else crumpleWalk(m, object, record.skip, record.parts);
        record.fresh = true;
      }
      // Whether any dent's reach (an ellipsoid r round, r / 0.6 tall) touches a body-space box.
      function crumpleReaches(box, dents) {
        for (let k = 0; k < dents.length; k++) {
          const d = dents[k];
          if (!(d.depth > 0)) continue;
          const tall = d.r / 0.6;
          if (d.x + d.r > box[0] && d.x - d.r < box[3] && d.y + d.r > box[2] && d.y - d.r < box[5] && d.z + tall > box[1] && d.z - tall < box[4]) return true;
        }
        return false;
      }
      // The box round every dent's reach in body space (x, up, across), for a quick test per vertex.
      const crumpleReach = new Float64Array(6);
      function crumpleReachBox(dents) {
        const box = crumpleReach;
        box[0] = box[1] = box[2] = Infinity;
        box[3] = box[4] = box[5] = -Infinity;
        for (let k = 0; k < dents.length; k++) {
          const d = dents[k];
          if (!(d.depth > 0)) continue;
          const tall = d.r / 0.6;
          box[0] = Math.min(box[0], d.x - d.r);
          box[3] = Math.max(box[3], d.x + d.r);
          box[1] = Math.min(box[1], d.z - tall);
          box[4] = Math.max(box[4], d.z + tall);
          box[2] = Math.min(box[2], d.y - d.r);
          box[5] = Math.max(box[5], d.y + d.r);
        }
        return box;
      }
      // Normals of the vertices that moved, from the faces round them (the authored ones stay everywhere else).
      function crumpleNormals(geometry, moved, base) {
        const normal = geometry.attributes.normal,
          n = normal.array,
          p = geometry.attributes.position.array,
          index = geometry.index,
          faces = index ? index.count : geometry.attributes.position.count,
          ix = index ? index.array : null;
        for (let i = 0; i < moved.length; i++)
          if (moved[i]) n[i * 3] = n[i * 3 + 1] = n[i * 3 + 2] = 0;
          else {
            n[i * 3] = base[i * 3];
            n[i * 3 + 1] = base[i * 3 + 1];
            n[i * 3 + 2] = base[i * 3 + 2];
          }
        for (let f = 0; f + 2 < faces; f += 3) {
          const a = ix ? ix[f] : f,
            b = ix ? ix[f + 1] : f + 1,
            c = ix ? ix[f + 2] : f + 2;
          if (!moved[a] && !moved[b] && !moved[c]) continue;
          const ax = p[a * 3],
            ay = p[a * 3 + 1],
            az = p[a * 3 + 2],
            ux = p[b * 3] - ax,
            uy = p[b * 3 + 1] - ay,
            uz = p[b * 3 + 2] - az,
            vx = p[c * 3] - ax,
            vy = p[c * 3 + 1] - ay,
            vz = p[c * 3 + 2] - az,
            cx = uy * vz - uz * vy,
            cy = uz * vx - ux * vz,
            cz = ux * vy - uy * vx;
          if (moved[a]) {
            n[a * 3] += cx;
            n[a * 3 + 1] += cy;
            n[a * 3 + 2] += cz;
          }
          if (moved[b]) {
            n[b * 3] += cx;
            n[b * 3 + 1] += cy;
            n[b * 3 + 2] += cz;
          }
          if (moved[c]) {
            n[c * 3] += cx;
            n[c * 3 + 1] += cy;
            n[c * 3 + 2] += cz;
          }
        }
        for (let i = 0; i < moved.length; i++)
          if (moved[i]) {
            const x = n[i * 3],
              y = n[i * 3 + 1],
              z = n[i * 3 + 2],
              length = Math.sqrt(x * x + y * y + z * z);
            if (length > 1e-12) {
              n[i * 3] = x / length;
              n[i * 3 + 1] = y / length;
              n[i * 3 + 2] = z / length;
            } else {
              n[i * 3] = base[i * 3];
              n[i * 3 + 1] = base[i * 3 + 1];
              n[i * 3 + 2] = base[i * 3 + 2];
            }
          }
        normal.needsUpdate = true;
      }
      // Moves every vertex of a part by the field at its rest place (relative to the hinge's own move for a hinged part).
      function crumpleBend(part, dents, limits, seed, reach, hoodKeep) {
        const touched = crumpleReaches(part.box, dents);
        if (!touched && !part.bent) return false;
        const started = performance.now(),
          mesh = part.mesh;
        if (!part.own) {
          mesh.geometry = part.source.clone();
          mesh.userData.crumpleSource = part.source;
          part.own = true;
        }
        const geometry = mesh.geometry,
          position = geometry.attributes.position,
          array = position.array,
          base = part.base,
          e = part.rel,
          v = part.inverse,
          count = position.count,
          moved = part.moved || (part.moved = new Uint8Array(count));
        let hx = 0,
          hy = 0,
          hz = 0,
          any = false;
        if (touched && part.hinge) {
          crumpleField(dents, limits, part.hinge[0], part.hinge[2], part.hinge[1], seed, crumpleMove);
          hx = crumpleMove.x;
          hy = crumpleMove.z;
          hz = crumpleMove.y;
        }
        for (let i = 0; i < count; i++) {
          const j = i * 3,
            x = base[j],
            y = base[j + 1],
            z = base[j + 2];
          moved[i] = 0;
          let mx = -hx,
            my = -hy,
            mz = -hz;
          if (touched) {
            const bx = e[0] * x + e[4] * y + e[8] * z + e[12],
              by = e[1] * x + e[5] * y + e[9] * z + e[13],
              bz = e[2] * x + e[6] * y + e[10] * z + e[14];
            // Vehicle space is x forward, y right, z up: the body's x, z and y.
            if (bx > reach[0] && bx < reach[3] && by > reach[1] && by < reach[4] && bz > reach[2] && bz < reach[5]) {
              crumpleField(dents, limits, bx, bz, by, seed, crumpleMove);
              mx += crumpleMove.x;
              my += crumpleMove.z;
              mz += crumpleMove.y;
            }
            // The hood: pushed back toward its hinge it buckles up in a ridge rather than shrinking (sheet metal keeps its
            // length); sprung open it keeps more of its length (hoodKeep), closed it lies on the crushed nose.
            if (part.buckle && mx < 0) {
              const u = Math.min(1, Math.max(0, (bx - part.hinge[0]) / part.length)),
                back = -mx;
              mx = -back * hoodKeep;
              my += back * (0.16 + (1 - hoodKeep) * 0.5) * Math.sin(Math.PI * u);
            }
          } else mx = my = mz = 0;
          if (mx * mx + my * my + mz * mz > 1e-8) {
            moved[i] = 1;
            any = true;
            array[j] = x + v[0] * mx + v[3] * my + v[6] * mz;
            array[j + 1] = y + v[1] * mx + v[4] * my + v[7] * mz;
            array[j + 2] = z + v[2] * mx + v[5] * my + v[8] * mz;
          } else {
            array[j] = x;
            array[j + 1] = y;
            array[j + 2] = z;
          }
        }
        position.needsUpdate = true;
        if (geometry.attributes.normal && part.normals) crumpleNormals(geometry, moved, part.normals);
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
        part.bent = any;
        part.ms = performance.now() - started;
        return true;
      }
      // Bends are time-sliced: a body's parts (shell first, small parts next, the trim and cabin last) are bent within
      // CRUMPLE_BUDGET_MS a frame over every queued body (at least one part a frame), and its hinges, wheels and halos
      // move, and m.shapeVersion is bumped, when the last part is done. New dents mid-way start the body over, so a
      // crash grinding on for frames is bent at the pace the budget allows rather than every frame in full.
      const CRUMPLE_BUDGET_MS = 3,
        crumpleQueue = new Set();
      function crumpleStart(c, m, dents, all) {
        const record = m.crumple;
        // The crush limits in design units (crumpleLimits, damage-crumple.js).
        record.limits = crumpleLimits(c, 1 / (m.modelScale || 1), record.limits || {});
        record.reach = record.reach || new Float64Array(6);
        record.reach.set(crumpleReachBox(dents));
        record.dents = dents;
        record.seed = c.id;
        // A hood sprung open keeps half of the shortening its crumple would give (the rest goes into its ridge).
        record.hoodKeep = c.damage?.parts?.hood >= 1 ? 0.5 : 1;
        crumpleOrder(m);
        // A pass for parts adopted since the last one keeps going over the rest only if a full one was queued.
        record.all = all || (crumpleQueue.has(m) && record.all);
        record.next = 0;
        record.ms = 0;
        crumpleQueue.add(m);
      }
      // Bends this body's next parts until `until` (performance.now()); true when it is done.
      function crumpleStep(m, until, first) {
        const record = m.crumple,
          parts = record.parts,
          started = performance.now();
        while (record.next < parts.length) {
          if (!first && performance.now() > until) {
            record.ms += performance.now() - started;
            return false;
          }
          first = false;
          const part = parts[record.order ? record.order[record.next] : record.next];
          record.next++;
          if (!record.all && part.adopted) continue;
          crumpleBend(part, record.dents, record.limits, record.seed, record.reach, record.hoodKeep);
          part.adopted = true;
          if (part.own && part.mesh === m.shell) m.ownShell = true;
          if (part.own && part.mesh === m.cabin) m.ownCabin = true;
        }
        for (const point of record.points) {
          crumpleField(record.dents, record.limits, point.at[0], point.at[2], point.at[1], record.seed, crumpleMove);
          // Body space (x, up, across) into the parent's space; wheels keep their height (the tyre stays on the road).
          let mx = crumpleMove.x,
            my = point.level ? 0 : crumpleMove.z,
            mz = crumpleMove.y;
          const p = point.parent;
          if (p) {
            const x = p[0] * mx + p[3] * my + p[6] * mz,
              y = p[1] * mx + p[4] * my + p[7] * mz,
              z = p[2] * mx + p[5] * my + p[8] * mz;
            mx = x;
            my = y;
            mz = z;
          }
          point.object.position.set(point.rest.x + mx, point.level ? point.object.position.y : point.rest.y + my, point.rest.z + mz);
        }
        record.fresh = false;
        record.ms += performance.now() - started;
        record.lastMs = record.ms;
        let bent = 0;
        for (const part of parts) if (part.bent) bent++;
        record.bent = bent;
        m.shapeVersion = (m.shapeVersion || 0) + 1;
        return true;
      }
      // Once a frame (updateDamageVisuals): the queued bodies' bends within the budget.
      function crumpleSlices() {
        if (!crumpleQueue.size) return;
        const until = performance.now() + CRUMPLE_BUDGET_MS;
        let first = true;
        for (const m of crumpleQueue) {
          // A model taken out of the scene meanwhile is dropped.
          if (!m.group.parent || !m.crumple) {
            crumpleQueue.delete(m);
            continue;
          }
          const done = crumpleStep(m, until, first);
          first = false;
          if (!done) return;
          crumpleQueue.delete(m);
        }
      }
      // The order parts are bent in: the shell first, then by size (the trim and its cabin last).
      function crumpleOrder(m) {
        const record = m.crumple,
          order = record.parts.map((part, i) => i);
        order.sort((a, b) => {
          const p = record.parts[a],
            q = record.parts[b];
          return (p.mesh === m.shell ? -1e9 : p.base.length) - (q.mesh === m.shell ? -1e9 : q.base.length);
        });
        record.order = order;
      }
