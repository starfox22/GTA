      // Car blood 3D, fitting: decal geometry clipped to the model's own surface, done in time slices (gather, panels, clip, cover test).
      // ---- Fitting ------------------------------------------------------------------------
      /*
       * Every step is a generator that yields when the frame's slice (cbOver) is spent, so
       * the first stain never costs a frame more than about 3 ms. The model's surfaces in
       * body space are gathered once per body type (cbGatherCache) while it is undamaged, the
       * clipping runs on typed scratch buffers (no per-triangle allocation) and the "is
       * something over this point" test looks only at the candidates in its cell of a grid.
       */
      const cbBodyInverse = new Three.Matrix4(),
        cbRelative = new Three.Matrix4(),
        cbNormalMatrix = new Three.Matrix3(),
        cbVec = new Three.Vector3(),
        cbGatherCache = new Map(),
        CB_GATHER_CACHE_MAX = 8;
      let cbGatherHits = 0,
        cbGatherMisses = 0;
      // The model's visible meshes in body space: positions, normals, index, box. Cached per body type
      // (geometry and placement identical) while the shape is untouched by a crumple.
      function* cbGatherJob(m, c, result) {
        m.group.updateMatrixWorld(true);
        m.body.updateMatrixWorld(true);
        cbBodyInverse.copy(m.body.matrixWorld).invert();
        const targets = rayTargets(m).filter((o) => !o.userData.carBloodSkin && o.geometry?.attributes?.position),
          scale = m.modelScale || 1;
        let key = null;
        // Cacheable while the model's geometry is the shared one (a crumple clones it and then edits it in place).
        if (m.car && !m.ownShell && !m.ownCabin) {
          key = c.type + '|' + scale + '|' + targets.length;
          for (const o of targets) {
            cbRelative.multiplyMatrices(cbBodyInverse, o.matrixWorld);
            key += '|' + o.geometry.uuid + ':' + o.geometry.attributes.position.count;
            for (let i = 0; i < 16; i += 3) key += ',' + Math.round(cbRelative.elements[i] * 200);
            key += ',' + Math.round(cbRelative.elements[12] * 100) + ',' + Math.round(cbRelative.elements[13] * 100) + ',' + Math.round(cbRelative.elements[14] * 100);
          }
          const hit = cbGatherCache.get(key);
          if (hit) {
            cbGatherHits++;
            cbGatherCache.delete(key);
            cbGatherCache.set(key, hit);
            result.value = hit;
            return;
          }
        }
        cbGatherMisses++;
        const infos = [],
          box = new Three.Box3();
        for (const o of targets) {
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
            if ((i & 2047) === 2047 && cbOver()) yield;
          }
          if (!isFinite(min[0])) continue;
          box.expandByPoint(cbVec.set(min[0], min[1], min[2])).expandByPoint(cbVec.set(max[0], max[1], max[2]));
          infos.push({ id: infos.length, pos, nor, hasNormals: !!normal, index: geometry.index ? geometry.index.array : null, count, min, max });
        }
        const gathered = { infos, box, triangles: infos.reduce((n, i) => n + cbTriangles(i), 0) };
        // A model not yet built up (nothing visible) gives nothing worth keeping.
        if (key && infos.length) {
          cbGatherCache.set(key, gathered);
          if (cbGatherCache.size > CB_GATHER_CACHE_MAX) cbGatherCache.delete(cbGatherCache.keys().next().value);
        }
        result.value = gathered;
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
        // TOP: the bonnet, from the spot just inside the nose edge, back as far as the blood can be dragged.
        const probe = cbVec.set(hx + inward.x * 0.3 * dm, 0, hz + inward.z * 0.3 * dm),
          surface = cbTopHeight(gathered.infos, probe.x, probe.z);
        // A bonnet takes blood; a roof does not (a flank hit stains the door and sill).
        if (surface !== null && surface - box.min.y < (end ? 1.5 : 0.95) * dm) {
          const Wm = 1.3 + 1.0 * s,
            Lm = stain.reach || 1.5 + 1.5 * s,
            fu = clamp(0.32 / Lm, 0.06, 0.2),
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
          });
        }
        // FACE: the bumper and grille (or the flank), in from outside.
        {
          const Wm = 1.4 + 1.0 * s,
            Hm = 1.0 + 0.7 * s,
            fvUp = 0.36,
            V = new Three.Vector3(0, 1, 0),
            N = outward.clone();
          let U = new Three.Vector3().crossVectors(V, N);
          if (U.dot(spray) < 0) U.negate();
          const q = new Three.Vector3(hx, box.min.y + Math.min(0.5 * dm, (box.max.y - box.min.y) * 0.35), hz),
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
          });
          const f = panels[panels.length - 1],
            dn = Math.hypot(f.dirx, f.diry);
          f.dirx /= dn;
          f.diry /= dn;
        }
        return panels;
      }
      // What a vertex's normal gives it of the stain: the bonnet takes the upward faces, the face the outward ones.
      function cbWeight(panel, nx, ny, nz) {
        if (panel.kind === 'top') return cbSmooth(0.42, 0.8, ny);
        return cbSmooth(0.3, 0.65, nx * panel.N.x + ny * panel.N.y + nz * panel.N.z) * (1 - 0.9 * cbSmooth(0.55, 0.85, ny));
      }
      function cbAccept(panel, nx, ny, nz) {
        return panel.kind === 'top' ? ny > 0.3 : nx * panel.N.x + ny * panel.N.y + nz * panel.N.z > 0.22;
      }
      // Sutherland-Hodgman on flat buffers: vertices are 9 floats [pu, pv, pd, x, y, z, nx, ny, nz]. Returns the new count.
      function cbClip(src, n, dst, axis, sign, limit) {
        let out = 0;
        for (let i = 0; i < n; i++) {
          const a = i * 9,
            b = ((i + 1) % n) * 9,
            da = sign * src[a + axis] - limit,
            db = sign * src[b + axis] - limit;
          if (da <= 0) {
            for (let j = 0; j < 9; j++) dst[out * 9 + j] = src[a + j];
            out++;
          }
          if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
            const t = da / (da - db);
            for (let j = 0; j < 9; j++) dst[out * 9 + j] = src[a + j] + (src[b + j] - src[a + j]) * t;
            out++;
          }
        }
        return out;
      }
      const cbClipA = new Float64Array(16 * 9),
        cbClipB = new Float64Array(16 * 9),
        CB_GRID = 12,
        CB_CAND = 16; // floats a candidate triangle takes: 9 for its corners, then mesh id, u/v/d bounds, and 3 indices
      // Candidate triangles of one panel with a coarse grid over its (u, v) so a cover test reads few of them.
      function cbCoverGrid(cand, count, panel) {
        const start = new Int32Array(CB_GRID * CB_GRID + 1),
          cell = (value, half) => Math.min(CB_GRID - 1, Math.max(0, Math.floor(((value + half) / (2 * half)) * CB_GRID))),
          span = (i) => [cell(cand[i * CB_CAND + 10], panel.hu), cell(cand[i * CB_CAND + 11], panel.hu), cell(cand[i * CB_CAND + 12], panel.hv), cell(cand[i * CB_CAND + 13], panel.hv)];
        for (let i = 0; i < count; i++) {
          const [u0, u1, v0, v1] = span(i);
          for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) start[v * CB_GRID + u + 1]++;
        }
        for (let i = 0; i < CB_GRID * CB_GRID; i++) start[i + 1] += start[i];
        const fill = start.slice(0, CB_GRID * CB_GRID),
          items = new Int32Array(start[CB_GRID * CB_GRID]);
        for (let i = 0; i < count; i++) {
          const [u0, u1, v0, v1] = span(i);
          for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) items[fill[v * CB_GRID + u]++] = i;
        }
        return { start, items, cell };
      }
      // Is something else over this point (along the panel's outward axis)? A bonnet panel lies
      // over the shell: the shell's part of the stain is left out.
      function cbCovered(cand, grid, panel, px, py, pz, selfId) {
        const dx = panel.N.x,
          dy = panel.N.y,
          dz = panel.N.z,
          rx = px - panel.P.x,
          ry = py - panel.P.y,
          rz = pz - panel.P.z,
          cu = rx * panel.U.x + ry * panel.U.y + rz * panel.U.z,
          cv = rx * panel.V.x + ry * panel.V.y + rz * panel.V.z,
          cd = rx * dx + ry * dy + rz * dz,
          cellIndex = grid.cell(cv, panel.hv) * CB_GRID + grid.cell(cu, panel.hu),
          limit = 0.05 / (panel.k || 1) + 0.03;
        for (let q = grid.start[cellIndex]; q < grid.start[cellIndex + 1]; q++) {
          const i = grid.items[q] * CB_CAND;
          if (cand[i + 9] === selfId || cu < cand[i + 10] || cu > cand[i + 11] || cv < cand[i + 12] || cv > cand[i + 13] || cand[i + 14] < cd + 0.03) continue;
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
          if (t > limit) return true;
        }
        return false;
      }
      // The output of a fit: growable flat arrays (position, normal, uv, [event index, weight]) and each event's range.
      function cbOutput(capacity) {
        return { n: 0, cap: capacity, pos: new Float32Array(capacity * 3), nor: new Float32Array(capacity * 3), uv: new Float32Array(capacity * 2), blood: new Float32Array(capacity * 2), ranges: [] };
      }
      function cbOutputGrow(out, need) {
        if (out.n + need <= out.cap) return;
        const cap = Math.max(out.cap * 2, out.n + need),
          grow = (old, size) => {
            const next = new Float32Array(cap * size);
            next.set(old.subarray(0, out.n * size));
            return next;
          };
        out.pos = grow(out.pos, 3);
        out.nor = grow(out.nor, 3);
        out.uv = grow(out.uv, 2);
        out.blood = grow(out.blood, 2);
        out.cap = cap;
      }
      // Fits one panel of one event: every visible triangle inside its box is clipped to it and appended to `out`.
      function* cbFitPanel(gathered, event, panel, k, out) {
        const { P, U, V, N } = panel,
          margin = 0.5 * (UNITS_PER_METRE / k),
          reach = Math.hypot(panel.hu, panel.hv, Math.max(panel.dIn, panel.dOut + margin)),
          limitU = panel.hu,
          limitV = panel.hv,
          pc = new Float64Array(9);
        panel.k = k;
        // Pass 1: the triangles that reach into the box.
        let cand = new Float64Array(256 * CB_CAND),
          refs = new Int32Array(256 * 4),
          count = 0,
          sinceYield = 0;
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
            if (++sinceYield >= 96) {
              sinceYield = 0;
              if (cbOver()) yield;
            }
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
              if (u > limitU) outU++;
              if (u < -limitU) outUn++;
              if (v > limitV) outV++;
              if (v < -limitV) outVn++;
              if (d > panel.dOut + margin) outHigh++;
              if (d < -panel.dIn) outLow++;
            }
            if (outU === 3 || outUn === 3 || outV === 3 || outVn === 3 || outHigh === 3 || outLow === 3) continue;
            if (count * CB_CAND >= cand.length) {
              const bigger = new Float64Array(cand.length * 2);
              bigger.set(cand);
              cand = bigger;
              const biggerRefs = new Int32Array(refs.length * 2);
              biggerRefs.set(refs);
              refs = biggerRefs;
            }
            const o = count * CB_CAND;
            cand[o] = p[ia];
            cand[o + 1] = p[ia + 1];
            cand[o + 2] = p[ia + 2];
            cand[o + 3] = p[ib];
            cand[o + 4] = p[ib + 1];
            cand[o + 5] = p[ib + 2];
            cand[o + 6] = p[ic];
            cand[o + 7] = p[ic + 1];
            cand[o + 8] = p[ic + 2];
            cand[o + 9] = info.id;
            cand[o + 10] = Math.min(pc[0], pc[3], pc[6]);
            cand[o + 11] = Math.max(pc[0], pc[3], pc[6]);
            cand[o + 12] = Math.min(pc[1], pc[4], pc[7]);
            cand[o + 13] = Math.max(pc[1], pc[4], pc[7]);
            cand[o + 14] = Math.max(pc[2], pc[5], pc[8]);
            cand[o + 15] = 0;
            refs[count * 4] = info.id;
            refs[count * 4 + 1] = ia;
            refs[count * 4 + 2] = ib;
            refs[count * 4 + 3] = ic;
            count++;
          }
        }
        if (cbOver()) yield;
        const grid = cbCoverGrid(cand, count, panel),
          rect = panel.rect,
          range = event.index;
        // Pass 2: clip each candidate that faces the panel, drop what another mesh covers, append the rest.
        for (let ci = 0; ci < count; ci++) {
          if ((ci & 63) === 63 && cbOver()) yield;
          const o = ci * CB_CAND,
            info = gathered.infos[refs[ci * 4]],
            ia = refs[ci * 4 + 1],
            ib = refs[ci * 4 + 2],
            ic = refs[ci * 4 + 3],
            e1x = cand[o + 3] - cand[o],
            e1y = cand[o + 4] - cand[o + 1],
            e1z = cand[o + 5] - cand[o + 2],
            e2x = cand[o + 6] - cand[o],
            e2y = cand[o + 7] - cand[o + 1],
            e2z = cand[o + 8] - cand[o + 2];
          let fx = e1y * e2z - e1z * e2y,
            fy = e1z * e2x - e1x * e2z,
            fz = e1x * e2y - e1y * e2x;
          const fl = Math.hypot(fx, fy, fz) || 1;
          fx /= fl;
          fy /= fl;
          fz /= fl;
          if (!cbAccept(panel, fx, fy, fz)) continue;
          for (let j = 0; j < 3; j++) {
            const i = j === 0 ? ia : j === 1 ? ib : ic,
              r = cbClipA,
              b = j * 9,
              rx = cand[o + j * 3] - P.x,
              ry = cand[o + j * 3 + 1] - P.y,
              rz = cand[o + j * 3 + 2] - P.z;
            r[b] = rx * U.x + ry * U.y + rz * U.z;
            r[b + 1] = rx * V.x + ry * V.y + rz * V.z;
            r[b + 2] = rx * N.x + ry * N.y + rz * N.z;
            r[b + 3] = cand[o + j * 3];
            r[b + 4] = cand[o + j * 3 + 1];
            r[b + 5] = cand[o + j * 3 + 2];
            r[b + 6] = info.hasNormals ? info.nor[i] : fx;
            r[b + 7] = info.hasNormals ? info.nor[i + 1] : fy;
            r[b + 8] = info.hasNormals ? info.nor[i + 2] : fz;
          }
          let a = cbClipA,
            b = cbClipB,
            n = 3;
          for (let plane = 0; plane < 6 && n >= 3; plane++) {
            n = plane === 0 ? cbClip(a, n, b, 0, 1, limitU) : plane === 1 ? cbClip(a, n, b, 0, -1, limitU) : plane === 2 ? cbClip(a, n, b, 1, 1, limitV) : plane === 3 ? cbClip(a, n, b, 1, -1, limitV) : plane === 4 ? cbClip(a, n, b, 2, 1, panel.dOut) : cbClip(a, n, b, 2, -1, panel.dIn);
            const swap = a;
            a = b;
            b = swap;
          }
          if (n < 3) continue;
          // The polygon's centre: covered by another mesh's surface? Then it is hidden anyway.
          let cx = 0,
            cy = 0,
            cz = 0;
          for (let v = 0; v < n; v++) {
            cx += a[v * 9 + 3];
            cy += a[v * 9 + 4];
            cz += a[v * 9 + 5];
          }
          if (cbCovered(cand, grid, panel, cx / n, cy / n, cz / n, info.id)) continue;
          let any = false;
          for (let v = 0; v < n; v++) {
            const nl = Math.hypot(a[v * 9 + 6], a[v * 9 + 7], a[v * 9 + 8]) || 1;
            a[v * 9 + 6] /= nl;
            a[v * 9 + 7] /= nl;
            a[v * 9 + 8] /= nl;
            const w = cbWeight(panel, a[v * 9 + 6], a[v * 9 + 7], a[v * 9 + 8]);
            a[v * 9 + 2] = w; // the depth slot is spent: it carries the weight from here
            if (w >= 0.02) any = true;
          }
          if (!any) continue;
          cbOutputGrow(out, (n - 2) * 3);
          const lift = CB_LIFT / k;
          for (let v = 1; v < n - 1; v++)
            for (const q of [0, v, v + 1]) {
              const s = q * 9,
                at = out.n++,
                uu = 0.5 + a[s] / (2 * panel.hu),
                vv = 0.5 + a[s + 1] / (2 * panel.hv);
              out.pos[at * 3] = a[s + 3] + a[s + 6] * lift;
              out.pos[at * 3 + 1] = a[s + 4] + a[s + 7] * lift;
              out.pos[at * 3 + 2] = a[s + 5] + a[s + 8] * lift;
              out.nor[at * 3] = a[s + 6];
              out.nor[at * 3 + 1] = a[s + 7];
              out.nor[at * 3 + 2] = a[s + 8];
              out.uv[at * 2] = rect.u0 + uu * (rect.u1 - rect.u0);
              out.uv[at * 2 + 1] = rect.v0 + vv * (rect.v1 - rect.v0);
              out.blood[at * 2] = range;
              out.blood[at * 2 + 1] = a[s + 2];
            }
        }
      }
      // Fits every event's panels to the body into `job.out`: gather (cached), lay the boxes out once per stain, clip.
      function* cbFitJob(job) {
        const { skin, m } = job,
          result = {};
        yield* cbGatherJob(m, skin.c, result);
        const gathered = result.value,
          k = m.modelScale || 1;
        job.sourceTriangles = gathered.triangles;
        if (!gathered.infos.length) {
          job.retry = true; // nothing of the model is visible yet: try again shortly
          return;
        }
        for (const event of job.events) {
          const start = job.out.n;
          // The boxes are laid out once, on the body as it was; a crumple later only re-clips them.
          if (!event.layout) event.layout = cbPanels(m, event.stain, gathered, event.slots);
          for (const panel of event.layout) yield* cbFitPanel(gathered, event, panel, k, job.out);
          job.out.ranges.push({ event, start, end: job.out.n });
        }
      }
