      // Car blood 3D, fitting: decal geometry clipped to the model's own surface (gather, panels, clip, cover test, build).
      // ---- Fitting ------------------------------------------------------------------------
      const cbBodyInverse = new Three.Matrix4(),
        cbRelative = new Three.Matrix4(),
        cbNormalMatrix = new Three.Matrix3(),
        cbVec = new Three.Vector3();
      // The model's visible meshes in body space: positions, normals, index, box.
      function cbGather(m) {
        m.group.updateMatrixWorld(true);
        m.body.updateMatrixWorld(true);
        cbBodyInverse.copy(m.body.matrixWorld).invert();
        const infos = [],
          box = new Three.Box3();
        for (const o of rayTargets(m)) {
          if (o.userData.carBloodSkin || !o.geometry?.attributes?.position) continue;
          const geometry = o.geometry,
            position = geometry.attributes.position,
            normal = geometry.attributes.normal,
            count = position.count,
            pos = new Float32Array(count * 3),
            nor = new Float32Array(count * 3);
          cbRelative.multiplyMatrices(cbBodyInverse, o.matrixWorld);
          cbNormalMatrix.getNormalMatrix(cbRelative);
          const min = [Infinity, Infinity, Infinity],
            max = [-Infinity, -Infinity, -Infinity];
          for (let i = 0; i < count; i++) {
            cbVec.fromBufferAttribute(position, i).applyMatrix4(cbRelative);
            pos[i * 3] = cbVec.x;
            pos[i * 3 + 1] = cbVec.y;
            pos[i * 3 + 2] = cbVec.z;
            for (let k = 0; k < 3; k++) {
              min[k] = Math.min(min[k], pos[i * 3 + k]);
              max[k] = Math.max(max[k], pos[i * 3 + k]);
            }
            if (normal) {
              cbVec.fromBufferAttribute(normal, i).applyMatrix3(cbNormalMatrix).normalize();
              nor[i * 3] = cbVec.x;
              nor[i * 3 + 1] = cbVec.y;
              nor[i * 3 + 2] = cbVec.z;
            }
          }
          if (!isFinite(min[0])) continue;
          box.expandByPoint(cbVec.set(min[0], min[1], min[2])).expandByPoint(cbVec.set(max[0], max[1], max[2]));
          infos.push({ mesh: o, pos, nor, hasNormals: !!normal, index: geometry.index ? geometry.index.array : null, count, min, max });
        }
        return { infos, box };
      }
      function cbTriangles(info) {
        return info.index ? info.index.length / 3 : Math.floor(info.count / 3);
      }
      // The highest upward-facing surface over (x, z), or null.
      function cbTopHeight(infos, x, z) {
        let best = null;
        for (const info of infos) {
          if (x < info.min[0] || x > info.max[0] || z < info.min[2] || z > info.max[2]) continue;
          const n = cbTriangles(info),
            p = info.pos;
          for (let t = 0; t < n; t++) {
            const a = (info.index ? info.index[t * 3] : t * 3) * 3,
              b = (info.index ? info.index[t * 3 + 1] : t * 3 + 1) * 3,
              d = (info.index ? info.index[t * 3 + 2] : t * 3 + 2) * 3,
              // Barycentric in (x, z).
              v0x = p[b] - p[a],
              v0z = p[b + 2] - p[a + 2],
              v1x = p[d] - p[a],
              v1z = p[d + 2] - p[a + 2],
              v2x = x - p[a],
              v2z = z - p[a + 2],
              den = v0x * v1z - v1x * v0z;
            if (Math.abs(den) < 1e-9) continue;
            const u = (v2x * v1z - v1x * v2z) / den,
              v = (v0x * v2z - v2x * v0z) / den;
            if (u < 0 || v < 0 || u + v > 1) continue;
            const y = p[a + 1] + u * (p[b + 1] - p[a + 1]) + v * (p[d + 1] - p[a + 1]);
            // Upward-facing only: the cross product's y sign against the winding.
            const ny = (p[b + 2] - p[a + 2]) * (p[d] - p[a]) - (p[b] - p[a]) * (p[d + 2] - p[a + 2]);
            if (ny <= 0) continue;
            if (best === null || y > best) best = y;
          }
        }
        return best;
      }
      const cbSlotRect = (slot) => {
        const W = CB_TILE * CB_COLS,
          H = CB_TILE * CB_ROWS,
          col = slot % CB_COLS,
          row = Math.floor(slot / CB_COLS),
          pad = 3;
        return {
          u0: (col * CB_TILE + pad) / W,
          u1: ((col + 1) * CB_TILE - pad) / W,
          v0: 1 - ((row + 1) * CB_TILE - pad) / H,
          v1: 1 - (row * CB_TILE + pad) / H,
        };
      };
      // The boxes (panels) one stain aims at the body, in body space (design units).
      function cbPanels(m, stain, gathered, slots) {
        const k = m.modelScale || 1,
          dm = UNITS_PER_METRE / k, // design units per metre
          box = gathered.box,
          panels = [],
          end = stain.face === 'front' || stain.face === 'rear',
          sign = stain.face === 'front' || stain.face === 'right' ? 1 : -1,
          len = box.max.x - box.min.x,
          wid = box.max.z - box.min.z,
          hx = end ? (sign > 0 ? box.max.x : box.min.x) : clamp(stain.x / k, box.min.x + len * 0.12, box.max.x - len * 0.12),
          hz = end ? clamp(stain.z / k, box.min.z + wid * 0.12, box.max.z - wid * 0.12) : sign > 0 ? box.max.z : box.min.z,
          s = stain.sev,
          spray = new Three.Vector3(stain.sx, 0, stain.sz);
        if (spray.lengthSq() < 1e-6) spray.set(end ? -sign : 0, 0, end ? 0 : -sign);
        spray.normalize();
        const inward = end ? new Three.Vector3(-sign, 0, 0) : new Three.Vector3(0, 0, -sign),
          outward = inward.clone().negate();
        // TOP: the bonnet, from the spot just inside the nose edge.
        const probe = cbVec.set(hx + inward.x * 0.3 * dm, 0, hz + inward.z * 0.3 * dm),
          surface = cbTopHeight(gathered.infos, probe.x, probe.z);
        // A bonnet takes blood; a roof does not (a flank hit stains the door and sill).
        if (surface !== null && surface - box.min.y < (end ? 1.5 : 0.95) * dm) {
          const Wm = 1.25 + 0.95 * s,
            Lm = 1.35 + 1.15 * s + 0.75 * clamp(stain.kph / 90, 0, 1) * s,
            fu = 0.27,
            U = spray.clone(),
            N = new Three.Vector3(0, 1, 0),
            V = new Three.Vector3().crossVectors(N, U),
            q = new Three.Vector3(probe.x, surface, probe.z),
            center = q.clone().addScaledVector(U, (0.5 - fu) * Lm * dm);
          panels.push({
            kind: 'top',
            kindSeed: 11,
            slot: slots[0],
            P: center,
            U,
            V,
            N,
            hu: (Lm * dm) / 2,
            hv: (Wm * dm) / 2,
            dIn: 0.22 * dm,
            dOut: 0.85 * dm,
            Wm: Lm, // tile width (along U) in metres
            Hm: Wm,
            fu,
            fv: 0.5,
            dirx: 1,
            diry: 0,
            rect: cbSlotRect(slots[0]),
            weight: (n) => cbSmooth(0.42, 0.8, n.y),
            accept: (n) => n.y > 0.3,
          });
        }
        // FACE: the bumper and grille (or the flank), in from outside.
        {
          const Wm = 1.2 + 0.9 * s,
            Hm = 0.95 + 0.6 * s,
            fvUp = 0.36,
            V = new Three.Vector3(0, 1, 0),
            N = outward.clone();
          let U = new Three.Vector3().crossVectors(V, N);
          if (U.dot(spray) < 0) U.negate();
          const q = new Three.Vector3(end ? hx : hx, box.min.y + Math.min(0.5 * dm, (box.max.y - box.min.y) * 0.35), end ? hz : hz),
            center = q.clone().addScaledVector(V, (0.5 - fvUp) * Hm * dm);
          panels.push({
            kind: 'face',
            kindSeed: 23,
            slot: slots[1],
            P: center,
            U,
            V,
            N,
            hu: (Wm * dm) / 2,
            hv: (Hm * dm) / 2,
            dIn: 0.85 * dm,
            dOut: 0.14 * dm,
            Wm,
            Hm,
            fu: 0.5,
            fv: fvUp,
            dirx: clamp(U.dot(spray) * 0.85, -0.85, 0.85),
            diry: -0.75,
            rect: cbSlotRect(slots[1]),
            weight: (n) => cbSmooth(0.3, 0.65, n.dot(N)) * (1 - 0.9 * cbSmooth(0.55, 0.85, n.y)),
            accept: (n) => n.dot(N) > 0.22,
          });
          const f = panels[panels.length - 1],
            dn = Math.hypot(f.dirx, f.diry);
          f.dirx /= dn;
          f.diry /= dn;
        }
        return panels;
      }
      // Sutherland-Hodgman against the panel box; vertices are [pu, pv, pd, x, y, z, nx, ny, nz].
      function cbClip(poly, axis, sign, limit) {
        const out = [];
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i],
            b = poly[(i + 1) % poly.length],
            da = sign * a[axis] - limit,
            db = sign * b[axis] - limit;
          if (da <= 0) out.push(a);
          if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
            const t = da / (da - db),
              v = new Array(9);
            for (let j = 0; j < 9; j++) v[j] = a[j] + (b[j] - a[j]) * t;
            out.push(v);
          }
        }
        return out;
      }
      // Is something else over this point (along the panel's outward axis)? A bonnet panel lies
      // over the shell: the shell's part of the stain is left out.
      function cbCovered(cand, panel, px, py, pz, selfMesh) {
        const dx = panel.N.x,
          dy = panel.N.y,
          dz = panel.N.z,
          rx = px - panel.P.x,
          ry = py - panel.P.y,
          rz = pz - panel.P.z,
          cu = rx * panel.U.x + ry * panel.U.y + rz * panel.U.z,
          cv = rx * panel.V.x + ry * panel.V.y + rz * panel.V.z,
          cd = rx * dx + ry * dy + rz * dz;
        for (let i = 0; i < cand.length; i += 15) {
          if (cand[i + 9] === selfMesh || cu < cand[i + 10] || cu > cand[i + 11] || cv < cand[i + 12] || cv > cand[i + 13] || cand[i + 14] < cd + 0.03) continue;
          // Moller-Trumbore, ray from the point along +N.
          const ax = cand[i],
            ay = cand[i + 1],
            az = cand[i + 2],
            e1x = cand[i + 3] - ax,
            e1y = cand[i + 4] - ay,
            e1z = cand[i + 5] - az,
            e2x = cand[i + 6] - ax,
            e2y = cand[i + 7] - ay,
            e2z = cand[i + 8] - az,
            hx = dy * e2z - dz * e2y,
            hy = dz * e2x - dx * e2z,
            hz = dx * e2y - dy * e2x,
            det = e1x * hx + e1y * hy + e1z * hz;
          if (Math.abs(det) < 1e-9) continue;
          const f = 1 / det,
            sx = px - ax,
            sy = py - ay,
            sz = pz - az,
            u = f * (sx * hx + sy * hy + sz * hz);
          if (u < 0 || u > 1) continue;
          const qx = sy * e1z - sz * e1y,
            qy = sz * e1x - sx * e1z,
            qz = sx * e1y - sy * e1x,
            v = f * (dx * qx + dy * qy + dz * qz);
          if (v < 0 || u + v > 1) continue;
          const t = f * (e2x * qx + e2y * qy + e2z * qz);
          if (t > 0.05 / (panel.k || 1) + 0.03) return true;
        }
        return false;
      }
      // Fits every event's panels to the body: returns { position, normal, uv, blood, ranges }.
      function cbBuild(skin, m) {
        const tg = performance.now(),
          gathered = cbGather(m),
          k = m.modelScale || 1,
          lift = CB_LIFT / k,
          pos = [],
          nor = [],
          uv = [],
          blood = [],
          weights = [],
          ranges = [];
        skin.gatherMs = performance.now() - tg;
        skin.sourceTriangles = gathered.infos.reduce((n, i) => n + cbTriangles(i), 0);
        for (const event of skin.events) {
          const start = blood.length / 2;
          // The boxes are laid out once, on the body as it was; a crumple later only re-clips them.
          if (!event.layout) event.layout = cbPanels(m, event.stain, gathered, event.slots);
          event.panels = event.layout;
          for (const panel of event.panels) {
            panel.k = k;
            const { P, U, V, N } = panel,
              cand = [],
              margin = 0.5 * (UNITS_PER_METRE / k),
              fnScratch = new Three.Vector3(),
              nScratch = new Three.Vector3(),
              emitted = [];
            const reach = Math.hypot(panel.hu, panel.hv, Math.max(panel.dIn, panel.dOut + margin)),
              // Panel coordinates of the three corners: [u, v, d] each.
              pc = new Float64Array(9),
              limits = [panel.hu, panel.hv];
            for (const info of gathered.infos) {
              // Skip a mesh whose box is clear of the panel's bounding sphere.
              let gap = 0;
              for (let q = 0; q < 3; q++) {
                const centre = q === 0 ? P.x : q === 1 ? P.y : P.z,
                  d = Math.max(info.min[q] - centre, 0, centre - info.max[q]);
                gap += d * d;
              }
              if (gap > reach * reach) continue;
              const p = info.pos,
                n = cbTriangles(info);
              for (let t = 0; t < n; t++) {
                const ia = (info.index ? info.index[t * 3] : t * 3) * 3,
                  ib = (info.index ? info.index[t * 3 + 1] : t * 3 + 1) * 3,
                  ic = (info.index ? info.index[t * 3 + 2] : t * 3 + 2) * 3;
                let outU = 0,
                  outUn = 0,
                  outV = 0,
                  outVn = 0,
                  outHigh = 0,
                  outLow = 0;
                for (let j = 0; j < 3; j++) {
                  const i = j === 0 ? ia : j === 1 ? ib : ic,
                    rx = p[i] - P.x,
                    ry = p[i + 1] - P.y,
                    rz = p[i + 2] - P.z,
                    u = rx * U.x + ry * U.y + rz * U.z,
                    v = rx * V.x + ry * V.y + rz * V.z,
                    d = rx * N.x + ry * N.y + rz * N.z;
                  pc[j * 3] = u;
                  pc[j * 3 + 1] = v;
                  pc[j * 3 + 2] = d;
                  if (u > limits[0]) outU++;
                  if (u < -limits[0]) outUn++;
                  if (v > limits[1]) outV++;
                  if (v < -limits[1]) outVn++;
                  if (d > panel.dOut + margin) outHigh++;
                  if (d < -panel.dIn) outLow++;
                }
                if (outU === 3 || outUn === 3 || outV === 3 || outVn === 3 || outHigh === 3 || outLow === 3) continue;
                cand.push(
                  p[ia],
                  p[ia + 1],
                  p[ia + 2],
                  p[ib],
                  p[ib + 1],
                  p[ib + 2],
                  p[ic],
                  p[ic + 1],
                  p[ic + 2],
                  info.mesh,
                  Math.min(pc[0], pc[3], pc[6]),
                  Math.max(pc[0], pc[3], pc[6]),
                  Math.min(pc[1], pc[4], pc[7]),
                  Math.max(pc[1], pc[4], pc[7]),
                  Math.max(pc[2], pc[5], pc[8]),
                );
                // The face normal, for facing; vertex normals where the mesh has them.
                const e1x = p[ib] - p[ia],
                  e1y = p[ib + 1] - p[ia + 1],
                  e1z = p[ib + 2] - p[ia + 2],
                  e2x = p[ic] - p[ia],
                  e2y = p[ic + 1] - p[ia + 1],
                  e2z = p[ic + 2] - p[ia + 2];
                fnScratch.set(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x).normalize();
                if (!panel.accept(fnScratch)) continue;
                const poly = [ia, ib, ic].map((i, j) => [
                  pc[j * 3],
                  pc[j * 3 + 1],
                  pc[j * 3 + 2],
                  p[i],
                  p[i + 1],
                  p[i + 2],
                  info.hasNormals ? info.nor[i] : fnScratch.x,
                  info.hasNormals ? info.nor[i + 1] : fnScratch.y,
                  info.hasNormals ? info.nor[i + 2] : fnScratch.z,
                ]);
                let clipped = poly;
                for (const [axis, sign, limit] of [
                  [0, 1, panel.hu],
                  [0, -1, panel.hu],
                  [1, 1, panel.hv],
                  [1, -1, panel.hv],
                  [2, 1, panel.dOut],
                  [2, -1, panel.dIn],
                ]) {
                  clipped = cbClip(clipped, axis, sign, limit);
                  if (clipped.length < 3) break;
                }
                if (clipped.length < 3) continue;
                emitted.push({ poly: clipped, mesh: info.mesh });
              }
            }
            for (const { poly, mesh } of emitted) {
              // The polygon's centre: covered by another mesh's surface? Then it is hidden anyway.
              let cx = 0,
                cy = 0,
                cz = 0;
              for (const v of poly) {
                cx += v[3];
                cy += v[4];
                cz += v[5];
              }
              cx /= poly.length;
              cy /= poly.length;
              cz /= poly.length;
              if (cbCovered(cand, panel, cx, cy, cz, mesh)) continue;
              const vertexData = poly.map((v) => {
                nScratch.set(v[6], v[7], v[8]).normalize();
                const w = panel.weight(nScratch);
                return { v, n: [nScratch.x, nScratch.y, nScratch.z], w };
              });
              if (vertexData.every((d) => d.w < 0.02)) continue;
              for (let i = 1; i < vertexData.length - 1; i++)
                for (const d of [vertexData[0], vertexData[i], vertexData[i + 1]]) {
                  const uu = 0.5 + d.v[0] / (2 * panel.hu),
                    vv = 0.5 + d.v[1] / (2 * panel.hv);
                  pos.push(d.v[3] + d.n[0] * lift, d.v[4] + d.n[1] * lift, d.v[5] + d.n[2] * lift);
                  nor.push(d.n[0], d.n[1], d.n[2]);
                  uv.push(panel.rect.u0 + uu * (panel.rect.u1 - panel.rect.u0), panel.rect.v0 + vv * (panel.rect.v1 - panel.rect.v0));
                  blood.push(event.stain.t, d.w);
                  weights.push(d.w);
                }
            }
          }
          ranges.push({ event, start, end: blood.length / 2 });
        }
        return { pos, nor, uv, blood, weights, ranges };
      }
