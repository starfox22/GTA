      /**
       * CHASE PROPS
       * Small props step out of the chase view by their own size against their distance:
       * a prop is drawn while its largest side (height included: a pole is tall, not
       * small) would be at least ~4 pixels at 720 lines (CHASE_PROP_PIXELS, divided by
       * the tier's lodBias), and casts a shadow over a third of that distance. That is
       * the static cells' meshes on the detail layers (DETAIL_LAYER / FAR_DETAIL_LAYER,
       * sized at boot in cellStatics) by their own centre, and the pools of breakable
       * furniture (render3d-terrain.js BREAKABLE SCENERY) by the nearest point of their
       * bounds. Leaving out is done with the layer mask (nothing else writes those
       * layers) and castShadow (a mesh's own switch: no program changes); all of it is
       * put back when the chase view ends.
       */
      const CHASE_PROP_PIXELS = 185,
        CHASE_PROP_SHADOW = 60,
        // CHASE POOLS: instanced pools outside the cells (forests, lanterns, posts) step out where the
        // nearest point of their instances' box lies past this share of the draw distance (deep in the haze).
        CHASE_POOL_REACH = 0.85,
        chasePoolBox = new Three.Box3();
      let chasePropsLive = false,
        chaseBreakables = null,
        chasePools = null;
      // Every instanced pool outside the cell groups, but those flagged dynamic (their instances move: the crowd,
      // impostors, rides), with its world box. The box is made again when the pool's instances are written
      // (instanceMatrix.version: a toppled lamp post), their count or the pool's own place changes; a pool written
      // three frames running is moving and is left alone from then on (always drawn and casting).
      function chasePoolList() {
        const list = [],
          visit = (o) => {
            if (o.userData.cellContainer || o === farScenery || o.userData.dynamic) return;
            if (o.isInstancedMesh && o.count > 0)
              list.push({ mesh: o, mask: o.layers.mask, drawn: true, moving: false, writes: 0, version: -1, count: -1, m0: 0, m2: 0, m12: 0, m14: 0, x0: 0, x1: 0, z0: 0, z1: 0, y0: 0, top: 0 });
            for (let i = 0; i < o.children.length; i++) visit(o.children[i]);
          };
        for (let i = 0; i < scene.children.length; i++) visit(scene.children[i]);
        return list;
      }
      function chasePoolBounds(pool) {
        const mesh = pool.mesh,
          e = mesh.matrixWorld.elements,
          version = mesh.instanceMatrix.version;
        if (version !== pool.version && pool.version !== -1) {
          if (++pool.writes >= 3) {
            pool.moving = true;
            return;
          }
        } else pool.writes = 0;
        if (version !== pool.version || mesh.count !== pool.count || e[0] !== pool.m0 || e[2] !== pool.m2 || e[12] !== pool.m12 || e[14] !== pool.m14) {
          pool.version = version;
          pool.count = mesh.count;
          pool.m0 = e[0];
          pool.m2 = e[2];
          pool.m12 = e[12];
          pool.m14 = e[14];
          mesh.computeBoundingBox();
          chasePoolBox.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
          // (Padded for a toppled piece, as the breakable pools are.)
          pool.x0 = chasePoolBox.min.x - 90;
          pool.x1 = chasePoolBox.max.x + 90;
          pool.z0 = chasePoolBox.min.z - 90;
          pool.z1 = chasePoolBox.max.z + 90;
          pool.y0 = chasePoolBox.min.y;
          pool.top = chasePoolBox.max.y;
        }
      }
      // A static cell's detail-layer mesh with its world box (cellStatics).
      function chaseDetailEntry(mesh, box) {
        return {
          mesh,
          mask: mesh.layers.mask,
          x: (box.min.x + box.max.x) / 2,
          z: (box.min.z + box.max.z) / 2,
          size: Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z),
          cast: mesh.castShadow,
          drawn: true,
          casts: mesh.castShadow,
        };
      }
      // The breakable furniture pools (trees have their own levels), each with its bounds and its largest piece.
      function chaseBreakableList() {
        const list = [],
          box = new Three.Box3(),
          matrix = new Three.Matrix4();
        for (const cell of staticBatchCells.values()) {
          if (cell.group.name !== 'breakable cell') continue;
          for (const im of cell.group.children) {
            if (!im.isInstancedMesh || im.geometry.userData.foliage || !im.count) continue;
            if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
            if (im.boundingSphere === null) im.computeBoundingSphere();
            let size = 0;
            for (let i = 0; i < im.count; i++) {
              im.getMatrixAt(i, matrix);
              box.copy(im.geometry.boundingBox).applyMatrix4(matrix);
              size = Math.max(size, box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
            }
            const s = im.boundingSphere;
            list.push({
              mesh: im,
              mask: im.layers.mask,
              x0: s.center.x - s.radius,
              x1: s.center.x + s.radius,
              z0: s.center.z - s.radius,
              z1: s.center.z + s.radius,
              size,
              drawn: true,
              casts: im.castShadow,
            });
          }
        }
        return list;
      }
      function chasePropSet(entry, drawn, casts) {
        if (drawn !== entry.drawn) {
          entry.drawn = drawn;
          entry.mesh.layers.mask = drawn ? entry.mask : 0;
        }
        if (casts !== entry.casts) {
          entry.casts = casts;
          entry.mesh.castShadow = casts;
        }
      }
      /* Per frame after the cell cull (render3d-frame.js). */
      function updateChaseProps() {
        if (!chaseViewActive) {
          if (!chasePropsLive) return;
          chasePropsLive = false;
          for (let i = 0; i < staticCells.length; i++) {
            const list = staticCells[i].detail;
            for (let k = 0; k < list.length; k++) chasePropSet(list[k], true, list[k].cast);
          }
          // (The pools' castShadow is the far copy's to set again: updateFarScenery.)
          for (let i = 0; i < chaseBreakables.length; i++) {
            const entry = chaseBreakables[i];
            chasePropSet(entry, true, entry.casts);
            entry.casts = entry.mesh.castShadow;
          }
          for (let i = 0; i < chasePools.length; i++) {
            const pool = chasePools[i];
            if (!pool.drawn) pool.mesh.layers.mask = pool.mask;
            pool.drawn = true;
          }
          return;
        }
        if (!chaseBreakables) chaseBreakables = chaseBreakableList();
        if (!chasePools) chasePools = chasePoolList();
        if (!chasePropsLive) {
          chasePropsLive = true;
          for (let i = 0; i < chaseBreakables.length; i++) chaseBreakables[i].casts = chaseBreakables[i].mesh.castShadow;
        }
        const lod = activeTier ? activeTier.lodBias : 1,
          draw = CHASE_PROP_PIXELS / lod,
          shade = CHASE_PROP_SHADOW / lod,
          x = chaseCam.x,
          z = chaseCam.y;
        for (let i = 0; i < staticCells.length; i++) {
          const cell = staticCells[i];
          if (!cell.group.visible) continue;
          const list = cell.detail;
          for (let k = 0; k < list.length; k++) {
            const entry = list[k],
              dx = entry.x - x,
              dz = entry.z - z,
              d = Math.sqrt(dx * dx + dz * dz);
            chasePropSet(entry, d < entry.size * draw, entry.cast && d < entry.size * shade);
          }
        }
        for (let i = 0; i < chaseBreakables.length; i++) {
          const entry = chaseBreakables[i];
          if (!entry.mesh.parent.visible) continue;
          const dx = Math.max(entry.x0 - x, 0, x - entry.x1),
            dz = Math.max(entry.z0 - z, 0, z - entry.z1),
            d = Math.sqrt(dx * dx + dz * dz);
          chasePropSet(entry, d < entry.size * draw, d < entry.size * shade);
        }
        const poolReach = chaseDrawReach * CHASE_POOL_REACH,
          y = chaseCam.z;
        for (let i = 0; i < chasePools.length; i++) {
          const pool = chasePools[i];
          if (pool.moving || !pool.mesh.visible) continue;
          chasePoolBounds(pool);
          if (pool.moving) {
            if (!pool.drawn) pool.mesh.layers.mask = pool.mask;
            pool.drawn = true;
            continue;
          }
          const dx = Math.max(pool.x0 - x, 0, x - pool.x1),
            dz = Math.max(pool.z0 - z, 0, z - pool.z1),
            dy = Math.max(pool.y0 - y, 0, y - pool.top),
            drawn = dx * dx + dz * dz + dy * dy < poolReach * poolReach;
          if (drawn !== pool.drawn) {
            pool.drawn = drawn;
            pool.mesh.layers.mask = drawn ? pool.mask : 0;
          }
        }
      }
      function chasePropsReport() {
        const out = { detail: 0, detailHidden: 0, detailNoShadow: 0, pools: 0, poolsHidden: 0, poolsNoShadow: 0 };
        for (const cell of staticCells)
          for (const entry of cell.detail) {
            out.detail++;
            if (!entry.drawn) out.detailHidden++;
            else if (entry.cast && !entry.casts) out.detailNoShadow++;
          }
        for (const entry of chaseBreakables || []) {
          out.pools++;
          if (!entry.drawn) out.poolsHidden++;
          else if (!entry.casts) out.poolsNoShadow++;
        }
        // CHASE POOLS: the instanced pools outside the cells, and those past the draw distance's haze.
        out.loose = chasePools ? chasePools.length : 0;
        out.looseHidden = chasePools ? chasePools.filter((pool) => !pool.drawn).length : 0;
        return out;
      }
