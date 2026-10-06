      // Chase view shadow casters: what cannot shade the view is left out of the sun's shadow pass; far-copy proxies.
      /**
       * CHASE SHADOW CASTERS
       * The shadow box is square round the sphere of the near slice of the view, so it
       * holds far more scenery than can shade what the camera sees: beside and behind
       * it. Before the shadow pass (flight-view3d.js, the shadow map's render) every
       * cell of scenery (static batch and breakable cells, static cells) and every
       * shown far mesh is tested: its box, swept away from the sun by its height (the
       * ground its shadow can reach), against the ground under that slice of the
       * frustum (the receivers at any height inside it). A cell that cannot reach it
       * is hidden for the shadow pass only (the camera's draw list is already made)
       * and shown again after. The sweep is capped at the shadow camera's depth, so a
       * low sun never makes it unbounded.
       */
      const chaseHullX = new Float64Array(8),
        chaseHullZ = new Float64Array(8),
        chaseHullNX = new Float64Array(8),
        chaseHullNZ = new Float64Array(8),
        chaseHullLo = new Float64Array(8),
        chaseHullHi = new Float64Array(8),
        chasePointX = new Float64Array(8),
        chasePointZ = new Float64Array(8),
        chasePointOrder = new Int32Array(8),
        chaseHullStack = new Int32Array(17),
        chaseShadowHidden = [],
        chaseShadowSwapped = [],
        chaseShadowStats = { tested: 0, hidden: 0, proxies: 0 },
        // Near cells this share of the shadow reach from the camera cast from the far copy.
        CHASE_SHADOW_PROXY = 0.47;
      let chaseHullCount = 0,
        chaseHullMinX = 0,
        chaseHullMaxX = 0,
        chaseHullMinZ = 0,
        chaseHullMaxZ = 0,
        chaseSweepX = 0,
        chaseSweepZ = 0,
        chaseSweepCap = 0,
        chaseShadowFloor = 0,
        chaseShadowHiddenCount = 0,
        chaseShadowSwapCount = 0,
        chaseShadowFrame = 0,
        chaseShadowRegionSet = false,
        // The static batch and breakable cells as a list, each with its bounds (made on first use).
        chaseShadowBatchCells = null;
      function chaseShadowRegion(reach, tanH, tanV, cap) {
        const e = chaseCamera.matrixWorld.elements,
          p = chaseCamera.position;
        let low = Infinity;
        for (let i = 0; i < 8; i++) {
          const depth = i < 4 ? chaseCamera.near : reach,
            sx = (i & 1 ? 1 : -1) * tanH * depth,
            sy = (i & 2 ? 1 : -1) * tanV * depth;
          // Camera axes: x right (e0..2), y up (e4..6), z back (e8..10).
          chasePointX[i] = p.x + e[0] * sx + e[4] * sy - e[8] * depth;
          chasePointZ[i] = p.z + e[2] * sx + e[6] * sy - e[10] * depth;
          low = Math.min(low, p.y + e[1] * sx + e[5] * sy - e[9] * depth);
          chasePointOrder[i] = i;
        }
        // Monotone chain: sort by x then z (insertion sort, eight points), lower and upper hulls.
        for (let i = 1; i < 8; i++) {
          const k = chasePointOrder[i];
          let j = i - 1;
          while (j >= 0 && (chasePointX[chasePointOrder[j]] > chasePointX[k] || (chasePointX[chasePointOrder[j]] === chasePointX[k] && chasePointZ[chasePointOrder[j]] > chasePointZ[k]))) {
            chasePointOrder[j + 1] = chasePointOrder[j];
            j--;
          }
          chasePointOrder[j + 1] = k;
        }
        let n = 0;
        for (let i = 0; i < 8; i++) {
          const k = chasePointOrder[i];
          while (n >= 2 && chaseHullTurn(chaseHullStack[n - 2], chaseHullStack[n - 1], k) <= 0) n--;
          chaseHullStack[n++] = k;
        }
        for (let i = 6, lower = n + 1; i >= 0; i--) {
          const k = chasePointOrder[i];
          while (n >= lower && chaseHullTurn(chaseHullStack[n - 2], chaseHullStack[n - 1], k) <= 0) n--;
          chaseHullStack[n++] = k;
        }
        chaseHullCount = Math.max(0, n - 1);
        chaseHullMinX = chaseHullMinZ = Infinity;
        chaseHullMaxX = chaseHullMaxZ = -Infinity;
        for (let i = 0; i < chaseHullCount; i++) {
          chaseHullX[i] = chasePointX[chaseHullStack[i]];
          chaseHullZ[i] = chasePointZ[chaseHullStack[i]];
          chaseHullMinX = Math.min(chaseHullMinX, chaseHullX[i]);
          chaseHullMaxX = Math.max(chaseHullMaxX, chaseHullX[i]);
          chaseHullMinZ = Math.min(chaseHullMinZ, chaseHullZ[i]);
          chaseHullMaxZ = Math.max(chaseHullMaxZ, chaseHullZ[i]);
        }
        // Each edge's normal and the hull's extent along it (separating axes).
        for (let i = 0; i < chaseHullCount; i++) {
          const j = (i + 1) % chaseHullCount,
            nx = chaseHullZ[j] - chaseHullZ[i],
            nz = chaseHullX[i] - chaseHullX[j];
          let lo = Infinity,
            hi = -Infinity;
          for (let k = 0; k < chaseHullCount; k++) {
            const d = chaseHullX[k] * nx + chaseHullZ[k] * nz;
            lo = Math.min(lo, d);
            hi = Math.max(hi, d);
          }
          chaseHullNX[i] = nx;
          chaseHullNZ[i] = nz;
          chaseHullLo[i] = lo;
          chaseHullHi[i] = hi;
        }
        // Where a point's shadow falls per unit of its height above the receivers' floor.
        const up = Math.max(0.05, sunDirection.y);
        chaseSweepX = -sunDirection.x / up;
        chaseSweepZ = -sunDirection.z / up;
        chaseSweepCap = cap;
        chaseShadowFloor = Math.max(low, terrainHeight(chaseCam.x, chaseCam.y) - 80);
        chaseShadowRegionSet = chaseHullCount >= 3;
      }
      // The turn o -> a -> b of three of the slice's corners (positive: counter-clockwise).
      function chaseHullTurn(o, a, b) {
        return (chasePointX[a] - chasePointX[o]) * (chasePointZ[b] - chasePointZ[o]) - (chasePointZ[a] - chasePointZ[o]) * (chasePointX[b] - chasePointX[o]);
      }
      /* Whether a box (map x0..x1, y0..y1, highest point `top`) can shade the chase view's shadow region. */
      function chaseShadowCaster(x0, x1, z0, z1, top) {
        const h = Math.max(0, top - chaseShadowFloor);
        let vx = chaseSweepX * h,
          vz = chaseSweepZ * h;
        const length = Math.sqrt(vx * vx + vz * vz);
        if (length > chaseSweepCap) {
          vx *= chaseSweepCap / length;
          vz *= chaseSweepCap / length;
        }
        if (Math.max(x1, x1 + vx) < chaseHullMinX || Math.min(x0, x0 + vx) > chaseHullMaxX) return false;
        if (Math.max(z1, z1 + vz) < chaseHullMinZ || Math.min(z0, z0 + vz) > chaseHullMaxZ) return false;
        const cx = (x0 + x1) / 2,
          cz = (z0 + z1) / 2,
          hx = (x1 - x0) / 2,
          hz = (z1 - z0) / 2;
        for (let i = 0; i < chaseHullCount; i++) {
          const nx = chaseHullNX[i],
            nz = chaseHullNZ[i],
            c = cx * nx + cz * nz,
            e = Math.abs(nx) * hx + Math.abs(nz) * hz,
            s = vx * nx + vz * nz;
          if (c + e + Math.max(0, s) < chaseHullLo[i] || c - e + Math.min(0, s) > chaseHullHi[i]) return false;
        }
        if (length > 1e-3) {
          // Across the sweep: the box's own extent (the sweep adds nothing along this axis).
          const nx = -vz,
            nz = vx,
            c = cx * nx + cz * nz,
            e = Math.abs(nx) * hx + Math.abs(nz) * hz;
          let lo = Infinity,
            hi = -Infinity;
          for (let k = 0; k < chaseHullCount; k++) {
            const d = chaseHullX[k] * nx + chaseHullZ[k] * nz;
            lo = Math.min(lo, d);
            hi = Math.max(hi, d);
          }
          if (c + e < lo || c - e > hi) return false;
        }
        return true;
      }
      /* A static batch or breakable cell's bounds: the spheres of what it holds (world space; the cell groups are at the origin). */
      function chaseBatchCellBounds(cell) {
        let x0 = Infinity,
          x1 = -Infinity,
          z0 = Infinity,
          z1 = -Infinity,
          top = cell.top || 0;
        for (const o of cell.group.children) {
          if (!o.geometry) continue;
          if (o.isInstancedMesh && o.boundingSphere === null) o.computeBoundingSphere();
          if (!o.isInstancedMesh && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          const s = o.isInstancedMesh ? o.boundingSphere : o.geometry.boundingSphere;
          x0 = Math.min(x0, s.center.x - s.radius);
          x1 = Math.max(x1, s.center.x + s.radius);
          z0 = Math.min(z0, s.center.z - s.radius);
          z1 = Math.max(z1, s.center.z + s.radius);
          top = Math.max(top, s.center.y + s.radius);
        }
        return { cell, x0, x1, z0, z1, top };
      }
      function chaseShadowHide(o) {
        o.visible = false;
        chaseShadowHidden[chaseShadowHiddenCount++] = o;
      }
      /* Around the shadow pass (flight-view3d.js): `begin` leaves out the casters that cannot shade the view and
         lets the far copy cast for the cells beyond CHASE_SHADOW_PROXY of the shadow reach; then puts all back. */
      function chaseShadowCasters(begin) {
        if (!begin) {
          for (let i = 0; i < chaseShadowHiddenCount; i++) {
            chaseShadowHidden[i].visible = true;
            chaseShadowHidden[i] = null;
          }
          chaseShadowHiddenCount = 0;
          for (let i = 0; i < chaseShadowSwapCount; i++) {
            const mesh = chaseShadowSwapped[i],
              chase = mesh.userData.chase;
            mesh.geometry.groups = chase.viewGroups;
            mesh.visible = chase.viewVisible;
            chaseShadowSwapped[i] = null;
          }
          chaseShadowSwapCount = 0;
          return;
        }
        if (!chaseViewActive || !chaseShadowRegionSet) return;
        if (!chaseShadowBatchCells) chaseShadowBatchCells = [...staticBatchCells.values()].map(chaseBatchCellBounds).filter((b) => b.x0 <= b.x1);
        const proxyFrom = chaseShadowReach() * CHASE_SHADOW_PROXY,
          x = chaseCam.x,
          z = chaseCam.y,
          frame = ++chaseShadowFrame;
        let tested = 0,
          proxies = 0;
        // Cells the copy stands for: far ones cast from it if they can reach the view; near ones beyond
        // the proxy radius hide their batches and blocks for this pass and cast from it too.
        for (let i = 0; i < chaseFarList.length; i++) {
          const cell = chaseFarList[i];
          cell.casts = false;
          if (!cell.meshes.length || (cell.far && !cell.shown)) continue;
          if (!cell.far) {
            const dx = Math.max(cell.minX - x, 0, x - cell.minX - FAR_CHASE_CELL),
              dz = Math.max(cell.minZ - z, 0, z - cell.minZ - FAR_CHASE_CELL);
            if (dx * dx + dz * dz < proxyFrom * proxyFrom) continue;
          }
          tested++;
          if (!chaseShadowCaster(cell.minX, cell.minX + FAR_CHASE_CELL, cell.minZ, cell.minZ + FAR_CHASE_CELL, cell.top)) continue;
          cell.casts = true;
          for (let k = 0; k < cell.meshes.length; k++) cell.meshes[k].userData.chase.shadowFrame = frame;
          if (cell.far) continue;
          proxies++;
          if (cell.full && cell.full.visible) chaseShadowHide(cell.full);
          for (let k = 0; k < cell.blocks.length; k++) if (cell.blocks[k].visible) chaseShadowHide(cell.blocks[k]);
        }
        for (let i = 0; i < chaseShadowBatchCells.length; i++) {
          const b = chaseShadowBatchCells[i];
          if (!b.cell.group.visible) continue;
          tested++;
          if (!chaseShadowCaster(b.x0, b.x1, b.z0, b.z1, b.top)) chaseShadowHide(b.cell.group);
        }
        for (let i = 0; i < staticCells.length; i++) {
          const cell = staticCells[i];
          if (!cell.group.visible) continue;
          tested++;
          if (!chaseShadowCaster(cell.x - cell.reach, cell.x + cell.reach, cell.y - cell.reach, cell.y + cell.reach, cell.top)) {
            chaseShadowHide(cell.group);
            continue;
          }
          // Then its groups one by one.
          const entries = cell.entries;
          for (let k = 0; k < entries.length; k++) {
            const entry = entries[k];
            if (entry.group.visible && !chaseShadowCaster(entry.x - entry.radius, entry.x + entry.radius, entry.y - entry.radius, entry.y + entry.radius, entry.top))
              chaseShadowHide(entry.group);
          }
        }
        // Pools outside the cells (CHASE POOLS), by their instances' box.
        if (chasePools)
          for (let i = 0; i < chasePools.length; i++) {
            const pool = chasePools[i],
              mesh = pool.mesh;
            if (pool.moving || !pool.drawn || !mesh.visible || !mesh.castShadow || pool.version === -1) continue;
            tested++;
            if (!chaseShadowCaster(pool.x0, pool.x1, pool.z0, pool.z1, pool.top)) chaseShadowHide(mesh);
          }
        // Far meshes: for this pass, groups drawing the runs of their casting cells (or hidden).
        const children = farScenery.children;
        for (let i = 0; i < children.length; i++) {
          const mesh = children[i],
            chase = mesh.userData.chase;
          if (!chase) continue;
          if (chase.shadowFrame !== frame) {
            if (mesh.visible) chaseShadowHide(mesh);
            continue;
          }
          const groups = chase.shadowGroups;
          let run = null;
          for (let k = 0; k < 9; k++) {
            const g = groups[k],
              count = chase.counts[k];
            if (count === 0) {
              g.materialIndex = 1;
              continue;
            }
            if (chase.cells[k].casts) {
              if (run) {
                run.count = chase.starts[k] + count - run.start;
                g.materialIndex = 1;
              } else {
                run = g;
                g.start = chase.starts[k];
                g.count = count;
                g.materialIndex = 0;
              }
            } else {
              run = null;
              g.materialIndex = 1;
            }
          }
          chase.viewVisible = mesh.visible;
          mesh.visible = true;
          mesh.geometry.groups = groups;
          chaseShadowSwapped[chaseShadowSwapCount++] = mesh;
        }
        chaseShadowStats.tested = tested;
        chaseShadowStats.hidden = chaseShadowHiddenCount;
        chaseShadowStats.proxies = proxies;
      }
