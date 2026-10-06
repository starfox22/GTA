      // Chase view far cells: beyond a near radius by tier, 1024-unit cells are drawn from the far copy of the city.
      /**
       * CHASE FAR CELLS
       * Beyond CHASE_FAR_NEAR (by tier) the chase view draws the far copy of the city
       * (FAR SCENERY, flight-view3d.js) instead of the full batches, one 1024-unit cell
       * at a time (the static batch cells): a cell whose nearest point is that far from
       * the camera hides its batches that the copy stands for and its building blocks,
       * and turns on its run in each 3 km far mesh (CHASE FAR GROUPS). The copy has the
       * same shapes, so the seam shows only where a piece under FAR_PIECE_SIZE drops out
       * (by then a few pixels, in the haze). Facades keep their own material and window
       * light there. What the copy does not stand for (breakable scenery and trees,
       * signs, glass, everything else in the cell) stays as it is. A cell turns far 48
       * units past the radius and near again 48 units inside it, so it never flickers.
       */
      const CHASE_FAR_NEAR = { LOW: 1200, MEDIUM: 1400, HIGH: 1600, ULTRA: 2000 },
        CHASE_FAR_HYSTERESIS = 48,
        chaseFarCells = new Map(),
        chaseFarList = [],
        chaseFarDirty = [];
      let chaseFarDirtyCount = 0,
        chaseFarShownCount = 0,
        chaseFarCount = 0,
        chaseFarNear = CHASE_FAR_NEAR.HIGH;
      /* The chase view's far cell (cx, cz) in 1024-unit cells, made the first time (buildFarScenery). */
      function chaseFarCell(cx, cz) {
        const key = cx * 4096 + cz;
        let cell = chaseFarCells.get(key);
        if (!cell) {
          cell = {
            cx,
            cz,
            minX: cx * FAR_CHASE_CELL,
            minZ: cz * FAR_CHASE_CELL,
            top: 0,
            far: false,
            shown: false,
            // The static batch cell's batches the copy stands for (one group), its building blocks, the far meshes holding it.
            full: null,
            blocks: [],
            meshes: [],
            // This shadow pass: drawn from the copy (CHASE SHADOW CASTERS), or (far) casting at all.
            proxy: false,
            casts: false,
          };
          chaseFarCells.set(key, cell);
          chaseFarList.push(cell);
        }
        return cell;
      }
      function chaseFarReady() {
        chaseFarDirty.length = farScenery.children.length;
        chaseFarDirty.fill(null);
      }
      /* Entering or leaving the chase view: every cell near and its batches shown, every far mesh's groups skipped. */
      function resetChaseFar() {
        for (let i = 0; i < chaseFarList.length; i++) {
          const cell = chaseFarList[i];
          cell.far = cell.shown = false;
          if (cell.full) cell.full.visible = true;
        }
        const children = farScenery.children;
        for (let i = 0; i < children.length; i++) {
          const chase = children[i].userData.chase;
          if (!chase) continue;
          chase.dirty = false;
          const groups = children[i].geometry.groups;
          for (let k = 0; k < groups.length; k++) groups[k].materialIndex = 1;
        }
        chaseFarDirtyCount = 0;
        chaseFarShownCount = 0;
      }
      /* CHASE FAR GROUPS: a far mesh's groups draw the runs of its shown cells, consecutive cells
         (in the serpentine) as one call; an empty cell does not break a run. */
      function chaseFarGroups(mesh) {
        const chase = mesh.userData.chase,
          groups = mesh.geometry.groups;
        chase.dirty = false;
        let run = null,
          shown = false;
        for (let k = 0; k < 9; k++) {
          const g = groups[k],
            count = chase.counts[k];
          if (count === 0) {
            g.materialIndex = 1;
            continue;
          }
          if (chase.cells[k].shown) {
            if (run) {
              run.count = chase.starts[k] + count - run.start;
              g.materialIndex = 1;
            } else {
              run = g;
              g.start = chase.starts[k];
              g.count = count;
              g.materialIndex = 0;
              shown = true;
            }
          } else {
            run = null;
            g.materialIndex = 1;
          }
        }
        if (mesh.visible !== shown) {
          mesh.visible = shown;
          chaseFarShownCount += shown ? 1 : -1;
        }
      }
      /* Per frame in the chase view (updateFarScenery): which cells are far, which far cells are in view. */
      function updateChaseFar() {
        const tier = activeTier || graphicsTier(),
          near = CHASE_FAR_NEAR[tier.name] || CHASE_FAR_NEAR.HIGH,
          x = chaseCam.x,
          z = chaseCam.y,
          y = chaseCam.z,
          reach = chaseCamera.far,
          half = FAR_CHASE_CELL / 2;
        chaseFarNear = near;
        let farCount = 0;
        for (let i = 0; i < chaseFarList.length; i++) {
          const cell = chaseFarList[i],
            dx = Math.max(cell.minX - x, 0, x - cell.minX - FAR_CHASE_CELL),
            dz = Math.max(cell.minZ - z, 0, z - cell.minZ - FAR_CHASE_CELL),
            dy = Math.max(0, y - cell.top),
            d = Math.sqrt(dx * dx + dz * dz + dy * dy),
            far = d > near + (cell.far ? -CHASE_FAR_HYSTERESIS : CHASE_FAR_HYSTERESIS);
          if (far !== cell.far) {
            cell.far = far;
            if (cell.full) cell.full.visible = !far;
            for (let k = 0; k < cell.blocks.length; k++) cell.blocks[k].visible = !far;
          }
          let shown = false;
          if (far) {
            farCount++;
            if (d < reach) {
              // The cell from the ground to its highest point.
              chaseSphere.center.set(cell.minX + half, Math.max(0, cell.top) * 0.5, cell.minZ + half);
              chaseSphere.radius = half * 1.42 + Math.max(0, cell.top) * 0.5 + 40;
              shown = viewFrustum.intersectsSphere(chaseSphere);
            }
          }
          if (shown !== cell.shown) {
            cell.shown = shown;
            for (let k = 0; k < cell.meshes.length; k++) {
              const mesh = cell.meshes[k],
                chase = mesh.userData.chase;
              if (chase.dirty) continue;
              chase.dirty = true;
              chaseFarDirty[chaseFarDirtyCount++] = mesh;
            }
          }
        }
        chaseFarCount = farCount;
        for (let i = 0; i < chaseFarDirtyCount; i++) {
          chaseFarGroups(chaseFarDirty[i]);
          chaseFarDirty[i] = null;
        }
        chaseFarDirtyCount = 0;
      }
