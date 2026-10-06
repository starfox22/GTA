      // Chase view 3D: the perspective camera behind the player (chase-camera.js says where it stands), the
      // ground it sees for culling and level of detail, the draw distance by tier and the haze at its end.
      /**
       * CHASE VIEW
       * The third-person view is a PerspectiveCamera that copies the game's pinhole
       * (chase-camera.js: position, heading, pitch, lens; the game projects with the same
       * numbers for its own rules). It takes over from the street or flight camera in
       * render() (render3d-frame.js) after updateFlightView, and the ride camera
       * (themepark3d-shows.js) still takes over from it on the Falcon and the Eye.
       *
       * What it sees: everything within the tier's draw distance (CHASE_DRAW), so
       * `viewCenter` / `viewReach` hold the box round that wedge of ground, and the cells of
       * scenery are also tested against the camera's frustum (chaseCellShown), keeping the
       * ones within the shadow reach behind the camera so a tower behind it still shades
       * the street ahead. `viewZoom` is the street zoom the view matches near the camera
       * (CHASE_LOD_NEAR): full detail there; things that step down with distance ask
       * chaseZoomAt(x, y) (vehicles, small scenery, trees).
       *
       * Haze: the aerial-perspective fog (flight-view3d.js) is clear to CHASE_HAZE_CLEAR
       * of the draw distance and closes over the rest, so the far clip is never seen.
       */
      const CHASE_DRAW = { LOW: 2600, MEDIUM: 3600, HIGH: 4800, ULTRA: 6400 },
        CHASE_HAZE_CLEAR = 0.16,
        CHASE_LOD_NEAR = 400,
        // Behind the camera, cells this close still draw (they cast the shadows in front of it).
        CHASE_SHADOW_KEEP = 1400,
        chaseCamera = new Three.PerspectiveCamera(CHASE_FOOT.fov, 1, CHASE_NEAR, 9000),
        chaseLookAt = new Three.Vector3(),
        chaseSphere = new Three.Sphere(),
        chaseCorner = new Three.Vector3();
      chaseCamera.layers.enable(DETAIL_LAYER);
      chaseCamera.layers.enable(FAR_DETAIL_LAYER);
      let chaseViewActive = false,
        chaseDrawReach = CHASE_DRAW.HIGH;
      function chaseDrawDistance() {
        const tier = activeTier || graphicsTier();
        return CHASE_DRAW[tier.name] || CHASE_DRAW.HIGH;
      }
      /* The street zoom a thing at map (x, y) is drawn at in the chase view (its distance from the
         camera against the street frame): for level-of-detail switches tuned on the street view. */
      function chaseZoomAt(x, y, z = 0) {
        const d = Math.max(CHASE_NEAR, Math.hypot(x - chaseCam.x, y - chaseCam.y, z ? z - chaseCam.z : 0));
        return streetFrameHeight() / (2 * d * Math.tan((chaseCamera.fov * Math.PI) / 360));
      }
      /* Whether a cell of scenery round map (x, y) with reach `reach` draws in the chase view: inside
         the draw distance and the frustum, or close enough behind to cast a shadow into the view. */
      function chaseCellShown(x, y, reach) {
        const dx = x - chaseCam.x,
          dy = y - chaseCam.y,
          d = Math.hypot(dx, dy);
        if (d > chaseDrawReach + reach * 1.42) return false;
        if (d < CHASE_SHADOW_KEEP + reach * 1.42) return true;
        chaseSphere.center.set(x, chaseCam.pz, y);
        chaseSphere.radius = reach * 1.42 + 200;
        return viewFrustum.intersectsSphere(chaseSphere);
      }
      function updateChaseView(deltaSeconds) {
        chaseViewActive = chaseCameraLive() && chaseCam.ready;
        if (!chaseViewActive) return false;
        camera = chaseCamera;
        const aspect = viewportWidth / Math.max(1, viewportHeight),
          yaw = chaseCam.viewYaw,
          pitch = chaseCam.viewPitch,
          cp = Math.cos(pitch);
        chaseDrawReach = chaseDrawDistance();
        chaseCamera.fov = chaseCam.fov;
        chaseCamera.aspect = aspect;
        chaseCamera.near = CHASE_NEAR;
        chaseCamera.far = chaseDrawReach * 1.08;
        chaseCamera.position.set(chaseCam.x, chaseCam.z, chaseCam.y);
        chaseLookAt.set(chaseCam.x + Math.cos(yaw) * cp * 100, chaseCam.z - Math.sin(pitch) * 100, chaseCam.y + Math.sin(yaw) * cp * 100);
        chaseCamera.up.set(0, 1, 0);
        chaseCamera.lookAt(chaseLookAt);
        chaseCamera.updateProjectionMatrix();
        chaseCamera.updateMatrixWorld(true);
        // The ground this view can see: the camera and the far edge of the frustum, out to the draw distance.
        const tanV = Math.tan((chaseCamera.fov * Math.PI) / 360),
          tanH = tanV * aspect,
          reach = chaseDrawReach;
        let minX = chaseCam.x,
          maxX = chaseCam.x,
          minY = chaseCam.y,
          maxY = chaseCam.y;
        for (let i = -1; i <= 1; i++) {
          const a = yaw + Math.atan(tanH) * i,
            far = reach / Math.cos(Math.atan(tanH) * i || 0);
          chaseCorner.set(chaseCam.x + Math.cos(a) * Math.min(far, reach * 1.35), 0, chaseCam.y + Math.sin(a) * Math.min(far, reach * 1.35));
          minX = Math.min(minX, chaseCorner.x);
          maxX = Math.max(maxX, chaseCorner.x);
          minY = Math.min(minY, chaseCorner.z);
          maxY = Math.max(maxY, chaseCorner.z);
        }
        viewCenter.x = (minX + maxX) / 2;
        viewCenter.y = (minY + maxY) / 2;
        viewReach = Math.max(920, (maxX - minX) / 2, (maxY - minY) / 2) + 120;
        viewZoom = Math.min(4.5, chaseZoomAt(chaseCam.x + CHASE_LOD_NEAR, chaseCam.y));
        viewGroundDistance = CHASE_LOD_NEAR;
        // Haze: clear near the camera, closing over the far part of the draw distance.
        const clear = reach * CHASE_HAZE_CLEAR;
        scene.fog.near = clear;
        // fogFactor = 1 - exp(-((d - near) / far)^2): about 0.93 at the far clip.
        scene.fog.density = 1.62 / Math.max(1, reach - clear);
        return true;
      }
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
      const CHASE_FAR_NEAR = { LOW: 1400, MEDIUM: 1600, HIGH: 1800, ULTRA: 2200 },
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
              chaseSphere.center.set(cell.minX + half, Math.max(y, cell.top * 0.5), cell.minZ + half);
              chaseSphere.radius = half * 1.42 + Math.max(0, cell.top);
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
      /* DeadEndCity.chaseCamera() adds what the renderer draws (render3d-api.js chaseView). */
      function chaseViewReport() {
        return {
          active: chaseViewActive,
          drawMetres: Math.round(chaseDrawReach / UNITS_PER_METRE),
          near: chaseCamera.near,
          far: Math.round(chaseCamera.far),
          viewReach: Math.round(viewReach),
          viewZoom: +viewZoom.toFixed(3),
          fogNear: Math.round(scene.fog.near),
          fogDensity: +scene.fog.density.toExponential(3),
          // CHASE FAR CELLS: the radius (m) beyond which a cell draws the far copy, far cells, far meshes drawn.
          farMetres: Math.round(chaseFarNear / UNITS_PER_METRE),
          farCells: chaseFarCount,
          farMeshes: chaseFarShownCount,
          // CHASE SHADOWS: shadow-casting cells tested and left out of the last shadow pass.
          shadowCells: { ...chaseShadowStats },
          // CHASE PROPS: small props (static cells' detail meshes, breakable pools) left out, and casting no shadow.
          props: chasePropsReport(),
          draws: chaseDrawBands(),
        };
      }
      /* Console only: the last frame's draw calls by kind and by distance from the camera (metres
         to the nearest point of each object's bounding sphere), for the camera pass (its render
         list) and the sun's shadow pass (the casters three.js would draw into the map). */
      function chaseDrawBands() {
        const BANDS = [50, 100, 150, 200, 300, 400, 600, Infinity],
          bandName = (d) => (d === Infinity ? 'whole' : '<' + BANDS.find((b) => d < b) + 'm'),
          sphere = new Three.Sphere(),
          vehicleGroups = new Set(),
          view = {},
          shadow = {},
          shadowFrustum = new Three.Frustum(),
          shadowMatrix = new Three.Matrix4();
        for (const m of carModels.values()) vehicleGroups.add(m.group);
        const kindOf = (o) => {
          if (o.name === 'static batch') return 'batch';
          if (o.name === 'far scenery') return 'far';
          if (o.isSprite) return 'sprite';
          if (o.name && o.name.startsWith('crowd')) return 'crowd';
          for (let p = o; p; p = p.parent) {
            if (vehicleGroups.has(p)) return 'vehicle';
            if (p.name === 'static cell') return 'static';
          }
          if (o.isInstancedMesh) return 'instanced';
          return 'other';
        };
        const bandOf = (o) => {
          if (o.isSprite) sphere.set(o.getWorldPosition(new Three.Vector3()), 1);
          else {
            // (An instanced mesh's own sphere, as three.js culls it.)
            if (o.boundingSphere === null) o.computeBoundingSphere();
            const bounds = o.boundingSphere || null;
            if (bounds) sphere.copy(bounds).applyMatrix4(o.matrixWorld);
            else {
              if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
              sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
            }
          }
          if (sphere.radius > 2400 || !o.frustumCulled) return 'whole';
          return bandName(Math.max(0, sphere.center.distanceTo(camera.position) - sphere.radius) / UNITS_PER_METRE);
        };
        const nameOf = (o) => {
          let named = o;
          while (named && !named.name && named.parent && named.parent !== scene && !named.parent.userData.cellContainer) named = named.parent;
          const material = Array.isArray(o.material) ? o.material[0] : o.material;
          const look = ' ' + (o.geometry?.type || '') + ' ' + material.type + (material.color ? ' #' + material.color.getHexString() : '') + (material.map ? ' map' : '') + (material.emissiveMap ? ' lit' : '');
          // Loose scenery (no name, outside the cells) by the map cell of its root.
          let root = o;
          while (root.parent && root.parent !== scene && !root.parent.userData.cellContainer) root = root.parent;
          const where = !named.name && root.parent === scene ? o.getWorldPosition(new Three.Vector3()) : null,
            at = where ? ' @' + Math.round(where.x / 256) * 256 + ',' + Math.round(where.z / 256) * 256 : '';
          return (named.name || o.type) + (o.name === 'static batch' || !named.name ? look : '') + at;
        };
        const add = (table, o, triangles) => {
          const kind = kindOf(o),
            band = bandOf(o),
            row = table[kind] || (table[kind] = { calls: 0, triangles: 0, names: {} });
          row.calls++;
          row.triangles += triangles;
          row[band] = (row[band] || 0) + 1;
          const name = nameOf(o);
          const entry = row.names[name] || (row.names[name] = [0, 0]);
          entry[0]++;
          entry[1] += triangles;
        };
        const trianglesOf = (o, group) => {
          const g = o.geometry;
          if (!g || !o.isMesh) return 0;
          let count = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
          if (group) count = Math.min(count, group.count);
          count = Math.min(count, g.drawRange.count);
          return (count / 3) * (o.isInstancedMesh ? o.count : g.isInstancedBufferGeometry ? g.instanceCount : 1);
        };
        const list = renderer.renderLists.get(scene, 0);
        for (const items of [list.opaque, list.transmissive, list.transparent])
          for (const item of items) add(view, item.object, trianglesOf(item.object, item.group));
        // The shadow pass: casters inside the sun's shadow box (WebGLShadowMap renderObject's test).
        const shadowCamera = sun.shadow.camera;
        shadowCamera.updateMatrixWorld(true);
        shadowFrustum.setFromProjectionMatrix(shadowMatrix.multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse));
        const visit = (o) => {
          if (!o.visible) return;
          if (o.layers.test(camera.layers) && (o.isMesh || o.isLine || o.isPoints) && o.castShadow && (!o.frustumCulled || shadowFrustum.intersectsObject(o))) {
            const materials = Array.isArray(o.material) ? o.material : null;
            if (materials) {
              for (const group of o.geometry.groups) if (materials[group.materialIndex]?.visible) add(shadow, o, trianglesOf(o, group));
            } else if (o.material.visible) add(shadow, o, trianglesOf(o, null));
          }
          for (const c of o.children) visit(c);
        };
        if (renderer.shadowMap.enabled && sun.castShadow) {
          // As the pass runs: without the casters CHASE SHADOW CASTERS leaves out.
          if (camera === chaseCamera) chaseShadowCasters(true);
          try {
            visit(scene);
          } finally {
            chaseShadowCasters(false);
          }
        }
        const total = (table) => {
          let calls = 0,
            triangles = 0;
          for (const row of Object.values(table)) {
            calls += row.calls;
            triangles += row.triangles;
            row.triangles = Math.round(row.triangles);
            // [name, calls, thousand triangles], the most calls first, then the most triangles.
            const named = Object.entries(row.names).map(([name, [n, t]]) => [name, n, Math.round(t / 1000)]);
            row.names = [...named.sort((a, b) => b[1] - a[1]).slice(0, 12), ...named.sort((a, b) => b[2] - a[2]).slice(0, 8).map((e) => [...e])];
          }
          return { calls, triangles: Math.round(triangles) };
        };
        return { view: { ...total(view), kinds: view }, shadow: { ...total(shadow), kinds: shadow } };
      }
      /**
       * CHASE SHADOWS
       * Looking along the street the frustum reaches the draw distance, and a shadow box
       * fitted to all of it would spread the map's texels over a kilometre. In the chase
       * view the sun's shadow covers the near part of the view only, out to
       * CHASE_SHADOW_REACH by tier, fitted to the bounding sphere of that slice of the
       * frustum: a box of one size whatever way the camera turns, its centre snapped to
       * whole texels, so shadow edges hold still while the camera swings round. Lit
       * materials fade the shadow out over the last part of that depth (cityShadowFade,
       * lighting3d-sky.js CITY_LIGHT_PARS), so it never ends on a line.
       */
      const CHASE_SHADOW_REACH = { LOW: 900, MEDIUM: 900, HIGH: 1200, ULTRA: 1500 },
        chaseShadowCentre = new Three.Vector3(),
        chaseShadowForward = new Three.Vector3();
      {
        // Directional shadows in lit materials fade by view depth where the patch declares the fade.
        const line =
            'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;',
          chunk = Three.ShaderChunk.lights_fragment_begin;
        if (chunk.includes(line))
          Three.ShaderChunk.lights_fragment_begin = chunk.replace(
            line,
            '#ifdef CITY_SHADOW_FADE\n' +
              line.replace('vDirectionalShadowCoord[ i ] ) : 1.0;', 'vDirectionalShadowCoord[ i ] ) * ( 1.0 - cityShadowFade( geometryPosition ) ) + cityShadowFade( geometryPosition ) : 1.0;') +
              '\n#else\n' +
              line +
              '\n#endif',
          );
      }
      function chaseShadowReach() {
        const tier = activeTier || graphicsTier();
        return CHASE_SHADOW_REACH[tier.name] || CHASE_SHADOW_REACH.HIGH;
      }
      function placeChaseSun() {
        const reach = chaseShadowReach(),
          near = chaseCamera.near,
          tanV = Math.tan((chaseCamera.fov * Math.PI) / 360),
          tanH = tanV * chaseCamera.aspect,
          k2 = tanH * tanH + tanV * tanV;
        // The bounding sphere of the frustum's slice from the near plane to `reach`.
        const along = Math.min(reach, ((reach + near) * (1 + k2)) / 2),
          radius = Math.sqrt(reach * reach * k2 + (reach - along) * (reach - along));
        chaseCamera.getWorldDirection(chaseShadowForward);
        chaseShadowCentre.copy(chaseCamera.position).addScaledVector(chaseShadowForward, along);
        shadowAxisX.crossVectors(shadowWorldUp, sunDirection).normalize();
        shadowAxisY.crossVectors(sunDirection, shadowAxisX);
        const half = Math.pow(1.08, Math.ceil(Math.log(Math.max(radius + 12, 64)) / Math.log(1.08))),
          texel = (2 * half) / sun.shadow.mapSize.x,
          cx = Math.round(chaseShadowCentre.dot(shadowAxisX) / texel) * texel,
          cy = Math.round(chaseShadowCentre.dot(shadowAxisY) / texel) * texel,
          d = chaseShadowCentre.dot(sunDirection),
          maxD = d + radius,
          minD = d - radius,
          lift = Math.max(700, streetCeiling() + 100),
          anchorD = maxD + lift + 200;
        shadowAnchor.copy(shadowAxisX).multiplyScalar(cx).addScaledVector(shadowAxisY, cy).addScaledVector(sunDirection, anchorD);
        sun.position.copy(shadowAnchor);
        sun.target.position.copy(shadowAnchor).sub(sunDirection);
        const cam = sun.shadow.camera,
          nearPlane = Math.max(1, anchorD - maxD - lift),
          farPlane = anchorD - minD + 40;
        if (half !== shadowHalfSize || cam.near !== nearPlane || cam.far !== farPlane) {
          shadowHalfSize = half;
          cam.left = cam.bottom = -half;
          cam.right = cam.top = half;
          cam.near = nearPlane;
          cam.far = farPlane;
          cam.updateProjectionMatrix();
        }
        sun.shadow.normalBias = clamp(texel * 1.6, 0.35, 4);
        cityLightUniforms.cityShadowReach.value = reach;
        chaseShadowRegion(reach, tanH, tanV, lift + 2 * radius);
      }
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
