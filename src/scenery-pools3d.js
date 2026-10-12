      // Immutable rooftop instance pools: spatial chunks for close views, whole-pool fallback for wide views.
      // Geometry, materials and Float32 instance matrices are shared/copied unchanged. Three culls each chunk
      // separately for the view AND each shadow camera; never hide a chunk just because it is off the main camera.
      const SCENERY_POOL_CELL = 2048,
        SCENERY_POOL_MAX_DRAWS = 1,
        sceneryPoolGroups = [],
        sceneryPoolWarmMeshes = [];
      let sceneryPoolsEnabled = true;
      function splitSceneryPool(source, name, cellSize = SCENERY_POOL_CELL) {
        if (source.count < 128 || source.instanceColor || source.morphTexture || source.parent !== scene) return null;
        const groups = new Map(),
          data = source.instanceMatrix.array;
        for (let i = 0; i < source.count; i++) {
          const key = Math.floor(data[i * 16 + 12] / cellSize) + ',' + Math.floor(data[i * 16 + 14] / cellSize);
          let indices = groups.get(key);
          if (!indices) groups.set(key, (indices = []));
          indices.push(i);
        }
        if (groups.size < 2) return null;
        const root = new Three.Group(),
          parts = new Three.Group(),
          chunks = [];
        root.name = 'rooftop pool ' + name;
        // Chunks have their own exact frustum bounds, not a new visual level of detail. Only their branch
        // bypasses the chase pool budget; the intact source retains all of its existing chase/shadow rules.
        parts.userData.cellContainer = true;
        parts.name = 'rooftop chunks ' + name;
        parts.visible = false;
        source.updateMatrix();
        parts.matrix.copy(source.matrix);
        parts.matrixAutoUpdate = false;
        root.add(source, parts);
        scene.add(root);
        // A close first frame may never draw the original. Warm it too, so the first wide/flight
        // fallback does not upload an entire city-wide instance buffer during play.
        sceneryPoolWarmMeshes.push(source);
        for (const indices of groups.values()) {
          const mesh = new Three.InstancedMesh(source.geometry, source.material, indices.length);
          mesh.name = 'rooftop chunk ' + name;
          mesh.castShadow = source.castShadow;
          mesh.receiveShadow = source.receiveShadow;
          mesh.renderOrder = source.renderOrder;
          mesh.layers.mask = source.layers.mask;
          mesh.customDepthMaterial = source.customDepthMaterial;
          mesh.customDistanceMaterial = source.customDistanceMaterial;
          for (let i = 0; i < indices.length; i++) {
            const offset = indices[i] * 16;
            mesh.instanceMatrix.array.set(data.subarray(offset, offset + 16), i * 16);
          }
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingBox();
          mesh.computeBoundingSphere();
          parts.add(mesh);
          // The source transform is normally identity, but keep construction and the culling audit correct for
          // a translated/scaled pool too. The draw's own bound remains local, for Three's shadow-camera tests.
          chunks.push({ mesh, sphere: mesh.boundingSphere.clone().applyMatrix4(source.matrix), count: indices.length });
          sceneryPoolWarmMeshes.push(mesh);
        }
        return { name, source, root, parts, chunks, count: source.count, version: source.instanceMatrix.version,
          attribute: source.instanceMatrix, geometry: source.geometry, material: source.material,
          transform: source.matrix.clone(), split: false, invalid: false, shownChunks: 0, shownInstances: 0 };
      }
      function buildSceneryPools() {
        // Start with the measured solar-panel win. Other immutable equipment can opt in after profiling;
        // breakable furniture and moving models must never remap their damage/gameplay instance indices.
        for (const name of ['solar']) {
          const group = splitSceneryPool(pools[name], name);
          if (group) sceneryPoolGroups.push(group);
        }
      }
      function updateSceneryPools() {
        // From the air, or a wide overview, one whole pool keeps its original draw-call budget.
        // Keep shadowed presets on the original pools: their separate sun/searchlight frusta can fan out
        // beyond the main view's budget. Enable only when we can guarantee no extra draws in any pass.
        const close = sceneryPoolsEnabled && !renderer.shadowMap.enabled &&
          (!flightViewActive || chaseViewActive) && (chaseViewActive || viewZoom >= 0.6);
        for (let i = 0; i < sceneryPoolGroups.length; i++) {
          const group = sceneryPoolGroups[i], source = group.source;
          source.updateMatrix();
          // Fail open if future code animates/replaces one of these previously immutable pools. Stale chunks
          // must never hide a changed pose, material or instance; the complete source remains authoritative.
          if (!group.invalid && (source.count !== group.count || source.instanceMatrix !== group.attribute ||
              source.instanceMatrix.version !== group.version || source.geometry !== group.geometry ||
              source.material !== group.material || !source.matrix.equals(group.transform))) group.invalid = true;
          let visible = 0, instances = 0;
          if (close && !group.invalid) {
            for (let j = 0; j < group.chunks.length; j++) {
              const chunk = group.chunks[j];
              if (viewFrustum.intersectsSphere(chunk.sphere)) {
                visible++;
                instances += chunk.count;
              }
            }
          }
          // Splitting must remove at least half the instances without increasing camera draws.
          const split = close && !group.invalid && visible <= SCENERY_POOL_MAX_DRAWS && instances < group.count * 0.5;
          if (source.visible === split) source.visible = !split;
          if (group.parts.visible !== split) group.parts.visible = split;
          group.split = split;
          group.shownChunks = split ? visible : 1;
          group.shownInstances = split ? instances : source.count;
        }
      }
      // Named console A/B, also useful on real hardware: false uses the intact original pools, true restores
      // the automatic close-view choice. Counts are geometric upper bounds for the camera pass, not GPU timings.
      function sceneryPoolsReport(on) {
        if (typeof on === 'boolean') {
          sceneryPoolsEnabled = on;
          updateSceneryPools();
        }
        let original = 0, submitted = 0, draws = 0, chunks = 0, bytes = 0;
        const list = [];
        for (let i = 0; i < sceneryPoolGroups.length; i++) {
          const g = sceneryPoolGroups[i];
          original += g.source.count;
          submitted += g.shownInstances;
          draws += g.shownChunks;
          chunks += g.chunks.length;
          bytes += g.count * 16 * 4;
          list.push({ name: g.name, sourceInstances: g.source.count, chunks: g.chunks.length, split: g.split,
            invalid: g.invalid, viewDrawsBound: g.shownChunks, viewInstancesBound: g.shownInstances });
        }
        return { enabled: sceneryPoolsEnabled, cellSize: SCENERY_POOL_CELL, pools: list.length, chunks,
          originalInstances: original, viewInstancesBound: submitted, originalDraws: list.length, viewDrawsBound: draws,
          addedInstanceBytes: bytes, list };
      }
