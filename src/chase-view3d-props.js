      // Chase view draw budget: props, static groups' parts, signs, small batches, vehicle parts and effect sprites by size, distance and haze; pools.
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
       *
       * CHASE PARTS: the static groups' other meshes and glows (what the batches left as
       * it was: signs, glass, lamps, unlit and multi-material parts, sprites; listed in
       * cellStatics when under CHASE_PART_LARGEST and not in a branch that moves) step out
       * by the same rule, so a big group no longer draws every small part out to the far
       * clip. CHASE HAZE SIZES: where the haze has taken most of a prop's contrast it must
       * be bigger to stay, as much as keeps its contrast over its area that of the clear-
       * air prop (size / sqrt(1 - haze), from the fog chunk's own curve); lights (`lit`:
       * glows, unlit or self-lit materials) count the haze by day only, as at night they
       * still show through it. Past the closed haze (CHASE_HAZE_CLOSED of the far clip)
       * nothing is drawn. A drawn prop stays until it is CHASE_PROP_KEEP of the size
       * asked (no flicker on the line). Also the signs on the scene, the small merged
       * batches, the vehicles' small parts and the effect sprites (below), and per pass in
       * the shadow casters (chase-view3d-casters.js). docs/areas/rendering-chase-budget.md.
       */
      const CHASE_PROP_PIXELS = 185,
        CHASE_PROP_SHADOW = 60,
        CHASE_PROP_KEEP = 0.94,
        // Parts at least this big (largest side) are never listed: no distance in any tier's haze leaves them out.
        CHASE_PART_LARGEST = 320,
        // The least share of a prop's contrast the haze rule counts (the far clip's ~0.04): at most 5x the clear size.
        CHASE_HAZE_SEEN_LEAST = 0.04,
        // How much smaller than a prop a light (by night) or an effect sprite (always: a spark or a bullet's puff is
        // feedback) may be and still be drawn: about a pixel at 720 lines.
        CHASE_LIGHT_GAIN = 4,
        CHASE_SIZE_STEPS = 64,
        chaseLeastSizes = new Float32Array(CHASE_SIZE_STEPS + 1),
        chaseLitSizes = new Float32Array(CHASE_SIZE_STEPS + 1),
        // The haze column (thinner air) by height above the lens, in CHASE_COLUMN_STEP steps.
        CHASE_COLUMN_STEP = 50,
        chaseColumns = new Float32Array(CHASE_SIZE_STEPS + 1),
        // CHASE POOLS: instanced pools outside the cells (forests, lanterns, posts) step out where the
        // nearest point of their instances' box lies past this share of the draw distance (deep in the haze).
        CHASE_POOL_REACH = 0.85,
        chasePoolBox = new Three.Box3();
      let chasePropsLive = false,
        chaseBreakables = null,
        chasePools = null,
        chaseSigns = null,
        chaseBatches = null,
        // CHASE BUDGET in force (the look switch, read each chase frame in updateChaseProps).
        chaseBudgetOn = true,
        chaseSizeStep = 1,
        chaseHazeNear = 0,
        // This frame's CHASE_PROP_PIXELS / lodBias (effect sprites read it: chaseSpriteHidden) and CHASE_PROP_SHADOW
        // / lodBias (CHASE SHADOW CASTERS: a batch casts within its size times this).
        chasePropDraw = CHASE_PROP_PIXELS,
        chasePropShade = CHASE_PROP_SHADOW;
      // Every instanced pool outside the cell groups, but those flagged dynamic (their instances move: the crowd,
      // impostors, rides), with its world box. The box is made again when the pool's instances are written
      // (instanceMatrix.version: a toppled lamp post), their count or the pool's own place changes; a pool written
      // three frames running is moving and is left alone from then on (always drawn and casting).
      function chasePoolList() {
        const list = [],
          // (Vehicle models come and go with the traffic: never theirs.)
          vehicleGroups = new Set([...carModels.values()].map((m) => m.group)),
          visit = (o) => {
            if (o.userData.cellContainer || o === farScenery || o.userData.dynamic || vehicleGroups.has(o)) return;
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
      // A static cell's detail-layer mesh or part (or a sign) with its world box (cellStatics).
      function chaseDetailEntry(mesh, box, part) {
        return {
          mesh,
          mask: mesh.layers.mask,
          x: (box.min.x + box.max.x) / 2,
          y: (box.min.y + box.max.y) / 2,
          z: (box.min.z + box.max.z) / 2,
          // Half its footprint and its highest point: CHASE SHADOW CASTERS tests a part on its own.
          hx: (box.max.x - box.min.x) / 2,
          hz: (box.max.z - box.min.z) / 2,
          top: box.max.y,
          size: Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z),
          lit: chasePropLit(mesh),
          fogged: chasePropFogged(mesh),
          part,
          // Set on the first chase frame: the far copy sets its castShadow (FAR SCENERY farHidden), never this.
          farOwned: false,
          cast: mesh.castShadow,
          drawn: true,
          casts: mesh.castShadow,
        };
      }
      // A light, for CHASE HAZE SIZES: a glow, points, or a material that is unlit or can light itself (an emissive
      // colour or map: night lighting turns their intensity up); a material the haze never reaches counts too.
      function chasePropLit(o) {
        if (o.isSprite || o.isPoints || !chasePropFogged(o)) return true;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (let i = 0; i < list.length; i++) {
          const m = list[i];
          if (!m || !m.isMeshStandardMaterial || m.emissiveMap || m.emissive.r + m.emissive.g + m.emissive.b > 0) return true;
        }
        return false;
      }
      // Whether the haze reaches every material it has (a material with fog off shows past the closed haze).
      function chasePropFogged(o) {
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (let i = 0; i < list.length; i++) if (!list[i] || !list[i].fog) return false;
        return true;
      }
      /* Whether something round world (x, y up, z), no part of it nearer than `margin` to that point, lies wholly
         past the view depth where the haze has closed (chaseClosedDepth): it would draw as the haze alone. */
      function chaseDepthHidden(x, y, z, margin) {
        return (x - chaseCam.x) * chaseForwardX + (y - chaseCam.z) * chaseForwardY + (z - chaseCam.y) * chaseForwardZ - margin > chaseClosedDepth;
      }
      const chasePartBox = new Three.Box3(),
        chasePartCentre = new Three.Vector3(),
        chasePartExtent = new Three.Vector3();
      /* CHASE PARTS (cellStatics): a static group's mesh or glow on the default layer, with its world box (`bounds`;
         a sprite's is made from its scale), or null: too big to ever step out, or in a branch that moves. */
      function chasePartEntry(o, bounds, root) {
        for (let p = o; p; p = p.parent) {
          if (p.userData.dynamic) return null;
          if (p === root) break;
        }
        if (o.isSprite) {
          const e = o.matrixWorld.elements,
            w = Math.hypot(e[0], e[1], e[2]);
          bounds = chasePartBox.setFromCenterAndSize(chasePartCentre.set(e[12], e[13], e[14]), chasePartExtent.set(w, Math.hypot(e[4], e[5], e[6]), w));
        }
        const size = Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z);
        return size < CHASE_PART_LARGEST ? chaseDetailEntry(o, bounds, true) : null;
      }
      /* CHASE HAZE SIZES: the least size drawn at each step of the far clip this frame; for lights, the haze counts
         by day only (nightAmount: at night a lit sign or lamp shows through it, so the clear-air size holds). */
      function chaseSizeTable(draw) {
        const near = scene.fog.near,
          span = scene.fog.far,
          dense = CITY_HAZE.cityHazeView.value[0],
          day = 0.5 * (1 - nightAmount),
          // At night a light is seen down to about a pixel (CHASE_LIGHT_GAIN times smaller than a prop).
          lights = draw * (1 + (CHASE_LIGHT_GAIN - 1) * nightAmount);
        const step = chaseCamera.far / CHASE_SIZE_STEPS;
        if (chaseSizeStep !== step) chaseSizeStep = step;
        if (chaseHazeNear !== near) chaseHazeNear = near;
        for (let i = 0; i <= CHASE_SIZE_STEPS; i++) {
          const d = i * chaseSizeStep,
            reach = (Math.max(0, d - near) * dense) / span,
            // (1 - haze) is exp(-reach^2) on the fog chunk's curve.
            seen = Math.max(CHASE_HAZE_SEEN_LEAST, Math.exp(-reach * reach));
          chaseLeastSizes[i] = d / (draw * Math.sqrt(seen));
          chaseLitSizes[i] = d / (lights * Math.pow(seen, day));
          // The air thins with height (aerial-haze3d.js cityHazeReach): the column for a point this far above the lens.
          const k = (i * CHASE_COLUMN_STEP) / HAZE_SCALE_HEIGHT;
          chaseColumns[i] = k > 1e-3 ? (1 - Math.exp(-k)) / k : 1 - 0.5 * k;
        }
      }
      /* Whether a prop of `size` at distance d is drawn (`drawn`: it was last frame, CHASE_PROP_KEEP). `rise`: how far
         its top stands above the lens; there the air is thinner and the haze less (a point at or below the lens is
         taken at the lens's height, which counts less haze than there is). */
      function chasePropShown(size, d, lit, drawn, rise) {
        const sizes = lit ? chaseLitSizes : chaseLeastSizes;
        let at = d,
          scale = 1;
        if (rise > 0 && d > chaseHazeNear) {
          const g = rise / CHASE_COLUMN_STEP,
            j = g | 0,
            column =
              j >= CHASE_SIZE_STEPS
                ? (1 - Math.exp(-rise / HAZE_SCALE_HEIGHT)) / (rise / HAZE_SCALE_HEIGHT)
                : chaseColumns[j] + (chaseColumns[j + 1] - chaseColumns[j]) * (g - j);
          // The haze of distance d through that column is the haze of `at` at the lens's height.
          at = chaseHazeNear + (d - chaseHazeNear) * column;
          scale = d / at;
        }
        const f = at / chaseSizeStep,
          i = f | 0,
          least = (i >= CHASE_SIZE_STEPS ? sizes[CHASE_SIZE_STEPS] : sizes[i] + (sizes[i + 1] - sizes[i]) * (f - i)) * scale;
        return size >= (drawn ? least * CHASE_PROP_KEEP : least);
      }
      /* The merged batches (render3d-statics.js STATIC BATCHER) by batch cell, each as an entry sized by its bounding
         sphere (world space: a batch cell's group is at the origin; the sphere is made with the batch, so this costs
         nothing at the first chase frame): the small ones step out as parts, and CHASE SHADOW CASTERS tests every
         batch of a cell that can cast on its own. */
      function chaseBatchList() {
        const byCell = new Map(),
          box = new Three.Box3();
        for (let i = 0; i < staticBatchMeshes.length; i++) {
          const mesh = staticBatchMeshes[i],
            s = mesh.geometry.boundingSphere;
          if (!s || mesh.layers.mask !== 1) continue;
          const cell = staticBatchCells.get(mesh.userData.cellX * 4096 + mesh.userData.cellZ);
          if (!cell) continue;
          let record = byCell.get(cell);
          if (!record) byCell.set(cell, (record = { cell, list: [] }));
          s.getBoundingBox(box);
          record.list.push(chaseDetailEntry(mesh, box, true));
        }
        return [...byCell.values()];
      }
      // The signs hung on the scene itself (sign()) and their backing boards, as parts (made on the first chase frame).
      function chaseSignList() {
        const list = [],
          box = new Three.Box3();
        for (let i = 0; i < signMeshes.length; i++) {
          const sign = signMeshes[i];
          for (const o of [sign, sign.userData.backing]) {
            if (!o || o.parent !== scene || o.layers.mask !== 1 || o.userData.dynamic) continue;
            o.updateMatrixWorld(true);
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            list.push(chaseDetailEntry(o, box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld), true));
          }
        }
        return list;
      }
      /* Effect sprites (render3d-frame.js: sparks, smoke, dust, blood drops): whether one of `size` at world (x, y up,
         z) is left out of the chase view this frame: down to about a pixel in clear air (CHASE_LIGHT_GAIN: a spark
         or a bullet's puff is feedback), bigger in the haze (CHASE HAZE SIZES), never past the closed haze. False
         outside the chase view. */
      function chaseSpriteHidden(x, y, z, size) {
        if (!chaseViewActive || !chaseBudgetOn) return false;
        const dx = x - chaseCam.x,
          dz = z - chaseCam.y;
        return !chasePropShown(size * CHASE_LIGHT_GAIN, Math.sqrt(dx * dx + dz * dz), false, false, y - chaseCam.z) || chaseDepthHidden(x, y, z, size);
      }
      /* CHASE VEHICLE PARTS (render3d-frame.js, each vehicle model posed this frame): a model's small unlit parts
         (wheel nuts, hubs, mirrors, trim; never a lamp) leave the chase view by their size against the vehicle's
         distance, and cast over CHASE_PROP_SHADOW, as the props do. The list is made on the model's first chase frame
         and again (all put back first) when its meshes change: merged, split or reshaped (m.merged, m.shapeVersion).
         Put back when the chase view ends (updateChaseProps). Parts CHASE_VEHICLE_PART_LARGEST and up are never
         listed. */
      const CHASE_VEHICLE_PART_LARGEST = 40,
        chaseVehicleBox = new Three.Box3();
      function chaseVehicleParts(c, m) {
        if (!chaseViewActive || !chaseBudgetOn) return;
        let record = m.group.userData.chaseParts;
        if (!record || record.merged !== m.merged || record.shape !== m.shapeVersion) {
          if (record) chaseVehicleRestore(record);
          record = m.group.userData.chaseParts = { merged: m.merged, shape: m.shapeVersion, list: chaseVehicleList(m) };
        }
        const dx = c.x - chaseCam.x,
          dz = c.y - chaseCam.y,
          d = Math.sqrt(dx * dx + dz * dz),
          draw = chasePropDraw,
          shade = chasePropShade,
          list = record.list;
        for (let i = 0; i < list.length; i++) {
          const entry = list[i];
          chasePropSet(entry, entry.size * (entry.drawn ? draw / CHASE_PROP_KEEP : draw) >= d, entry.cast && d < entry.size * shade);
        }
      }
      function chaseVehicleList(m) {
        const list = [];
        m.group.updateWorldMatrix(true, true);
        m.group.traverse((o) => {
          if (!o.isMesh || o.isInstancedMesh || o.layers.mask !== 1 || !o.geometry) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          chaseVehicleBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
          if (chaseVehicleBox.isEmpty()) return;
          // (Never a lamp: lit, a car's lamps show as bright points far beyond their size, by day too.)
          const entry = chaseDetailEntry(o, chaseVehicleBox, true);
          if (entry.size < CHASE_VEHICLE_PART_LARGEST && !entry.lit) list.push(entry);
        });
        return list;
      }
      function chaseVehicleRestore(record) {
        const list = record.list;
        for (let i = 0; i < list.length; i++) chasePropSet(list[i], true, list[i].cast);
      }
      // The breakable furniture pools (trees have their own levels), each with its bounds and its largest piece.
      function chaseBreakableList() {
        const list = [],
          box = new Three.Box3(),
          matrix = new Three.Matrix4();
        for (const cell of staticBatchCells.values()) {
          if (cell.group.name !== 'breakable cell') continue;
          for (const im of cell.group.children) {
            if (!im.isInstancedMesh || !im.count) continue;
            // (A tree pool keeps its own near / mid switch: it only leaves past the closed haze.)
            const foliage = !!im.geometry.userData.foliage;
            if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
            if (im.boundingSphere === null) im.computeBoundingSphere();
            let size = 0;
            for (let i = 0; i < im.count && !foliage; i++) {
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
              y0: s.center.y - s.radius,
              z0: s.center.z - s.radius,
              z1: s.center.z + s.radius,
              top: s.center.y + s.radius,
              size,
              foliage,
              lit: chasePropLit(im),
              fogged: chasePropFogged(im),
              drawn: true,
              casts: im.castShadow,
            });
          }
        }
        return list;
      }
      // The least view depth over a world box (y up): its corner nearest the lens along the lens's axis.
      function chaseBoxDepth(x0, x1, y0, y1, z0, z1) {
        return (
          ((chaseForwardX > 0 ? x0 : x1) - chaseCam.x) * chaseForwardX +
          ((chaseForwardY > 0 ? y0 : y1) - chaseCam.z) * chaseForwardY +
          ((chaseForwardZ > 0 ? z0 : z1) - chaseCam.y) * chaseForwardZ
        );
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
      /* One entry this frame: drawn by its size against its distance and the haze, and never past the closed haze
         (its nearest depth: the largest side for its reach); casting over CHASE_PROP_SHADOW, but a mesh whose
         castShadow the far copy sets (`farOwned`) keeps it (CHASE SHADOW CASTERS leaves it out per pass instead).
         (x, y, z): the camera, world, y up. */
      function chasePropStep(entry, x, y, z, shade) {
        const dx = entry.x - x,
          dz = entry.z - z,
          d = Math.sqrt(dx * dx + dz * dz),
          shown =
            !(entry.fogged && dx * chaseForwardX + (entry.y - y) * chaseForwardY + dz * chaseForwardZ - entry.size > chaseClosedDepth) &&
            chasePropShown(entry.size, d, entry.lit, entry.drawn, entry.top - y);
        chasePropSet(entry, shown, entry.farOwned ? entry.casts : entry.cast && d < entry.size * shade);
      }
      // Leaving the chase view: drawn and casting as before (a far-owned caster as the far copy has just set it).
      function chasePropRestore(entry) {
        chasePropSet(entry, true, entry.farOwned ? entry.casts : entry.cast);
        if (entry.farOwned) entry.casts = entry.mesh.castShadow;
      }
      // Every entry list but the pools: the static cells' detail and parts, the signs, the batches.
      function chasePropLists(visit) {
        for (let i = 0; i < staticCells.length; i++) visit(staticCells[i].detail);
        visit(chaseSigns);
        for (let i = 0; i < chaseBatches.length; i++) visit(chaseBatches[i].list);
      }
      /* Per frame after the cell cull (render3d-frame.js). */
      function updateChaseProps() {
        if (!chaseViewActive) {
          if (!chasePropsLive) return;
          chasePropsLive = false;
          chasePropLists((list) => {
            for (let k = 0; k < list.length; k++) chasePropRestore(list[k]);
          });
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
          for (const m of carModels.values()) if (m.group.userData.chaseParts) chaseVehicleRestore(m.group.userData.chaseParts);
          return;
        }
        if (!chaseBreakables) chaseBreakables = chaseBreakableList();
        if (!chasePools) chasePools = chasePoolList();
        if (!chaseSigns) {
          chaseSigns = chaseSignList();
          chaseBatches = chaseBatchList();
          // The meshes whose castShadow the far copy sets on every change of view (FAR SCENERY farHidden).
          const owned = new Set(farHidden);
          chasePropLists((list) => {
            for (let k = 0; k < list.length; k++) list[k].farOwned = owned.has(list[k].mesh);
          });
        }
        if (!chasePropsLive) {
          chasePropsLive = true;
          for (let i = 0; i < chaseBreakables.length; i++) chaseBreakables[i].casts = chaseBreakables[i].mesh.castShadow;
          chasePropLists((list) => {
            for (let k = 0; k < list.length; k++) if (list[k].farOwned) list[k].casts = list[k].mesh.castShadow;
          });
        }
        // CHASE BUDGET (lookSwitches({ chaseBudget: false }), an A/B in one page): off, the parts, signs, batches,
        // vehicles' parts and effect sprites are all drawn and casting, the props step by the clear-air size alone and
        // every shadow test is per cell and group, as before.
        const budget = lookSwitchState.chaseBudget;
        if (budget !== chaseBudgetOn) {
          chaseBudgetOn = budget;
          if (!budget) {
            chasePropLists((list) => {
              for (let k = 0; k < list.length; k++) chasePropRestore(list[k]);
            });
            for (const m of carModels.values()) if (m.group.userData.chaseParts) chaseVehicleRestore(m.group.userData.chaseParts);
          }
        }
        const lod = activeTier ? activeTier.lodBias : 1,
          draw = CHASE_PROP_PIXELS / lod,
          shade = CHASE_PROP_SHADOW / lod,
          x = chaseCam.x,
          y = chaseCam.z,
          z = chaseCam.y;
        if (chasePropDraw !== draw) chasePropDraw = draw;
        if (chasePropShade !== shade) chasePropShade = shade;
        chaseSizeTable(draw);
        for (let i = 0; i < staticCells.length; i++) {
          const cell = staticCells[i];
          if (!cell.group.visible) continue;
          const list = cell.detail;
          for (let k = 0; k < list.length; k++) {
            const entry = list[k];
            if (budget) chasePropStep(entry, x, y, z, shade);
            else if (!entry.part) {
              const dx = entry.x - x,
                dz = entry.z - z,
                d = Math.sqrt(dx * dx + dz * dz);
              chasePropSet(entry, d < entry.size * draw, entry.cast && d < entry.size * shade);
            }
          }
        }
        for (let i = 0; i < chaseBreakables.length; i++) {
          const entry = chaseBreakables[i];
          if (!entry.mesh.parent.visible) continue;
          const closed = budget && entry.fogged && chaseBoxDepth(entry.x0, entry.x1, entry.y0, entry.top, entry.z0, entry.z1) > chaseClosedDepth;
          if (entry.foliage) {
            chasePropSet(entry, !closed, entry.casts);
            continue;
          }
          const dx = Math.max(entry.x0 - x, 0, x - entry.x1),
            dz = Math.max(entry.z0 - z, 0, z - entry.z1),
            d = Math.sqrt(dx * dx + dz * dz);
          chasePropSet(entry, budget ? !closed && chasePropShown(entry.size, d, entry.lit, entry.drawn, entry.top - y) : d < entry.size * draw, d < entry.size * shade);
        }
        if (budget) {
          // Signs on the scene (render3d-streetprops.js sign()) and their backing boards, as the parts.
          for (let i = 0; i < chaseSigns.length; i++) chasePropStep(chaseSigns[i], x, y, z, shade);
          // The small batches of the batch cells in view, as the parts (bigger ones never step out).
          for (let i = 0; i < chaseBatches.length; i++) {
            const record = chaseBatches[i];
            if (!record.cell.group.visible) continue;
            const list = record.list;
            for (let k = 0; k < list.length; k++) if (list[k].size < CHASE_PART_LARGEST) chasePropStep(list[k], x, y, z, shade);
          }
        }
        const poolReach = chaseDrawReach * CHASE_POOL_REACH;
        for (let i = 0; i < chasePools.length; i++) {
          const pool = chasePools[i];
          if (pool.moving || !pool.mesh.visible || !pool.mesh.parent) continue;
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
        // (`detail` counts the CHASE PARTS too; `parts` of them, `partsHidden` left out.)
        const out = { detail: 0, detailHidden: 0, detailNoShadow: 0, parts: 0, partsHidden: 0, pools: 0, poolsHidden: 0, poolsNoShadow: 0 };
        for (const cell of staticCells)
          for (const entry of cell.detail) {
            out.detail++;
            if (entry.part) out.parts++;
            if (!entry.drawn) {
              out.detailHidden++;
              if (entry.part) out.partsHidden++;
            } else if (entry.cast && !entry.casts) out.detailNoShadow++;
          }
        for (const entry of chaseBreakables || []) {
          out.pools++;
          if (!entry.drawn) out.poolsHidden++;
          else if (!entry.casts) out.poolsNoShadow++;
        }
        // CHASE POOLS: the instanced pools outside the cells, and those past the draw distance's haze.
        out.loose = chasePools ? chasePools.length : 0;
        out.looseHidden = chasePools ? chasePools.filter((pool) => !pool.drawn).length : 0;
        // Signs on the scene and their boards (as parts).
        out.signs = chaseSigns ? chaseSigns.length : 0;
        out.signsHidden = chaseSigns ? chaseSigns.filter((entry) => !entry.drawn).length : 0;
        return out;
      }
