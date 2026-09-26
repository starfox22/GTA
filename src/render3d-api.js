        // bulletHole, structureBlast, structureImpact, groundStain, sparks, damageInfo.
        ...damageApi,
        // The mud effects' pools (offroad3d.js): clumps and mist flying, splats and tracks laid.
        offroadInfo: () => offroadEffectsInfo(),
        // The mountain villages as drawn (mountain-village3d.js): meshes, draw calls, triangles per town.
        mountainInfo: () => mountainVillageInfo(),
        /**
         * Settings contract: the see-through hole round the player under a roof
         * (lighting3d.js, CUTAWAY). On by default; read at start-up from
         * localStorage 'dead-end-city-cutaway' ('off' disables). The settings
         * menu saves that key and calls this to apply it at once.
         */
        setCharacterCutaway(on) {
          setCharacterCutaway(on);
        },
        info() {
          let objects = 0;
          const byType = {};
          scene.traverse((o) => {
            objects++;
            const k = o.type + (o.isMesh && Array.isArray(o.material) ? '[multi]' : '');
            byType[k] = (byType[k] || 0) + 1;
          });
          return {
            byType,
            // Scene pass (plus the shadow pass on frames that refresh it).
            calls: frameStats.sceneCalls,
            triangles: frameStats.sceneTriangles,
            shadowFrame: frameStats.shadowFrame,
            viewCalls: frameStats.viewCalls,
            shadowCalls: frameStats.shadowCalls,
            frameCalls: frameStats.totalCalls,
            objects,
            batched: api.batchReport,
            // Linked shader programs (each one is a compile hitch the first time).
            programs: renderer.info.programs?.length ?? null,
          };
        },
        /**
         * Where this frame's scene draw calls go: every drawable the camera would
         * draw (visible, on an enabled layer, inside the frustum), counted by the
         * name of its nearest named ancestor and by 512-unit cell. For hunting
         * unbatched scenery; DeadEndCity.drawProfile() prints the top entries.
         */
        // Every helicopter model built: look, spool, draw calls, shadow casters,
        // triangles and crew shown (helicopter3d.js; DeadEndCity.helicopterModels()).
        // Every civilian car and motorbike model built (cars3d.js, motorbikes3d.js):
        // type, draw calls, shadow casters and triangles, the parts by triangles.
        carModels() {
          const out = [];
          for (const [c, m] of carModels) if (m.civilian || m.moto) out.push(civilianModelReport(c, m));
          return out;
        },
        helicopterModels() {
          const out = [];
          for (const [c, m] of carModels) if (c.type === 'helicopter') out.push(helicopterModelReport(c, m));
          return out;
        },
        drawProfile(top = 15) {
          const byName = new Map(),
            byCell = new Map(),
            sphere = new Three.Sphere(),
            roles = new Map();
          for (const m of carModels.values()) roles.set(m.group, 'vehicle');
          let total = 0;
          const visit = (o) => {
            if (!o.visible || !o.layers.test(camera.layers)) return;
            if ((o.isMesh || o.isSprite || o.isLine || o.isPoints) && o.material) {
              let inView = !o.frustumCulled;
              if (!inView) {
                if (o.isSprite) sphere.set(o.getWorldPosition(new Three.Vector3()), 20);
                else {
                  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
                  sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
                }
                inView = viewFrustum.intersectsSphere(sphere);
              }
              if (inView) {
                const calls = Array.isArray(o.material) ? Math.max(1, o.geometry.groups.length) : 1;
                let named = o,
                  root = o;
                // (A cell group of STATIC CELLS / STATIC BATCH CELLS counts as the scene.)
                const top = (p) => p === scene || p.userData.cellContainer;
                while (named && !named.name && named.parent && !top(named.parent)) named = named.parent;
                while (root.parent && !top(root.parent)) root = root.parent;
                if (roles.has(root)) named = { name: roles.get(root), type: '' };
                else if (!named.name && root !== o)
                  named = {
                    // Unnamed parts of an unnamed group: say what they are, so the
                    // unbatched ones (transparent, multi-material, signs) stand out.
                    name:
                      'group@' + Math.round(root.position.x) + ',' + Math.round(root.position.z) +
                      ' [' + (o.geometry?.type || o.type) + ' ' + (Array.isArray(o.material) ? 'multi' : o.material.type) +
                      (o.material.transparent ? ' transparent' : '') + (o.userData.sign ? ' sign' : '') +
                      (o.material.color ? ' #' + o.material.color.getHexString() : '') + ']',
                    type: '',
                  };
                const material = Array.isArray(o.material) ? o.material[0] : o.material;
                // Static batches by what they are made of (which materials fail to share).
                if (o.name === 'static batch' || o.name === 'far scenery')
                  named = {
                    name:
                      o.name + ' [' + material.type + (material.color ? ' #' + material.color.getHexString() : '') +
                      (material.map ? ' map' : '') + (material.emissiveMap ? ' lit' : '') +
                      (material.vertexColors ? ' vc' : '') + ']',
                    type: '',
                  };
                const key =
                    (named.name || o.type + ' ' + (o.geometry?.type || '') + ' ' + material.type) +
                    (named === o ? '' : ' in ' + (named.name || named.type)) +
                    (o.isSprite ? ' (sprite)' : ''),
                  p = o.getWorldPosition(new Three.Vector3()),
                  cell = Math.floor(p.x / 512) * 512 + ',' + Math.floor(p.z / 512) * 512;
                byName.set(key, (byName.get(key) || 0) + calls);
                byCell.set(cell, (byCell.get(cell) || 0) + calls);
                total += calls;
              }
            }
            for (const c of o.children) visit(c);
          };
          visit(scene);
          const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
          // Shader programs by material type (fewer variants, fewer compile hitches).
          const programs = new Map();
          for (const p of renderer.info.programs || []) {
            const kind = p.name || String(p.cacheKey).split(',')[0].slice(0, 40);
            programs.set(kind, (programs.get(kind) || 0) + 1);
          }
          return { total, byName: sorted(byName), byCell: sorted(byCell), programs: sorted(programs) };
        },
        // The police helicopter's searchlight: state and A/B switches (searchlight3d.js).
        searchlight: (options) => searchlightReport(options),
        /* Shadow casters the view does not show (for "shadows from nowhere"):
           every mesh the sun's shadow pass draws, near the view, that the camera
           pass would not: hidden by its material (fully transparent, no colour
           write), a helper, or outside the camera frustum while its shadow can
           fall into it. Returns counts by name and the first few with positions. */
        shadowCasters(limit = 40, everywhere = false) {
          const frustum = new Three.Frustum().setFromProjectionMatrix(
              new Three.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
            ),
            sphere = new Three.Sphere(),
            found = [],
            byName = new Map();
          const visit = (o, named) => {
            if (!o.visible) return;
            if (o.name) named = o;
            if ((o.isMesh || o.isInstancedMesh) && o.castShadow && o.layers.test(camera.layers)) {
              const materials = Array.isArray(o.material) ? o.material : [o.material];
              const hidden = materials.every(
                (m) => !m || m.visible === false || m.colorWrite === false || (m.transparent && m.opacity < 0.6),
              );
              if (o.isInstancedMesh && o.boundingSphere === null) o.computeBoundingSphere();
              const bounds = o.isInstancedMesh ? o.boundingSphere : (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere));
              sphere.copy(bounds).applyMatrix4(o.matrixWorld);
              const near = everywhere || Math.hypot(sphere.center.x - viewCenter.x, sphere.center.z - viewCenter.y) < viewReach + sphere.radius;
              const offView = !frustum.intersectsSphere(sphere);
              if (near && (hidden || (!everywhere && offView && sphere.center.y > 40))) {
                const key =
                  (named?.name || o.name || o.geometry?.type || 'mesh') +
                  (hidden ? ' (see-through material, opacity ' + materials.map((m) => m && +m.opacity.toFixed(2)).join('/') + ')' : ' (off view)');
                byName.set(key, (byName.get(key) || 0) + 1);
                if (found.length < limit)
                  found.push({ name: key, x: Math.round(sphere.center.x), y: Math.round(sphere.center.z), height: Math.round(sphere.center.y), radius: Math.round(sphere.radius) });
              }
            }
            for (const c of o.children) visit(c, named);
          };
          visit(scene, null);
          return { byName: Object.fromEntries(byName), found };
        },
        /* What shades a ground point from the sun: casts a ray from (x, y) on
           the ground towards the sun (the moon at night) through every
           shadow-casting mesh and returns the hits, nearest first (name, the
           named group it belongs to, the instance for instanced meshes, height of
           the hit, distance along the ray, whether the mesh is drawn). */
        shadowProbe(x, y) {
          const origin = new Three.Vector3(x, terrainHeight(x, y) + 0.5, y),
            probe = new Three.Raycaster(origin, sunDirection.clone().normalize(), 0, 4000),
            casters = [];
          scene.traverse((o) => {
            if ((o.isMesh || o.isInstancedMesh) && o.castShadow) casters.push(o);
          });
          const shown = (o) => {
            for (let p = o; p; p = p.parent) if (!p.visible) return false;
            return true;
          };
          // Instanced meshes are raycast against their stored bounds, which may
          // predate their instances' current places: fresh bounds for the probe.
          const kept = casters.filter((o) => o.isInstancedMesh).map((o) => [o, o.boundingSphere]);
          for (const [o] of kept) o.computeBoundingSphere();
          const found = probe.intersectObjects(casters, false);
          for (const [o, sphere] of kept) o.boundingSphere = sphere;
          return {
            sun: sunDirection.toArray().map((v) => +v.toFixed(3)),
            hits: found
              .slice(0, 8)
              .map((h) => {
                let named = h.object;
                while (named && !named.name && named.parent) named = named.parent;
                return {
                  name: h.object.name || h.object.geometry?.type,
                  group: named?.name || '',
                  instance: h.instanceId ?? null,
                  height: +h.point.y.toFixed(1),
                  at: [Math.round(h.point.x), Math.round(h.point.z)],
                  distance: Math.round(h.distance),
                  shown: shown(h.object),
                  material: h.object.material?.type,
                };
              }),
          };
        },
        // The ground materials' data (ground-data3d.js) and the grass tufts (grass3d.js).
        groundReport: () => ({
          ...groundDataReport,
          detailLevel: groundShared.cityGroundDetail.value,
          tufts: { shown: tuftMesh.visible, instances: tuftMesh.geometry.instanceCount, fade: +tuftUniforms.tuftFade.value.toFixed(2) },
        }),
        // Developer view of the post-processing inputs: 'ao', 'bloom' or nothing.
        postView(mode) {
          postCompositeUniforms.uDebugView.value = mode === 'ao' ? 1 : mode === 'bloom' ? 2 : mode === 'depth' ? 3 : mode === 'reflect' ? 4 : 0;
          return mode || 'image';
        },
        /**
         * World-scale audit (DeadEndCity.scaleReport): each entity's built model
         * measured in its own frame, in map units: `l` along its heading, `w`
         * across it, `h` from its lowest to its highest mesh. Glows, halos and
         * other unlit transparent sprites are left out; null where no model is
         * built yet (models are made as they come into view).
         */
        modelExtents(entities) {
          const box = new Three.Box3(),
            part = new Three.Box3();
          return entities.map((e) => {
            const person = personExtents(e);
            if (person) return person;
            const m = carModels.get(e);
            if (!m?.group) return null;
            const g = m.group,
              rotation = g.rotation.clone(),
              position = g.position.clone();
            g.rotation.set(0, 0, 0);
            g.position.set(0, 0, 0);
            g.updateMatrixWorld(true);
            box.makeEmpty();
            g.traverseVisible((o) => {
              if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
              const material = Array.isArray(o.material) ? o.material[0] : o.material;
              if (material?.isMeshBasicMaterial && material.transparent) return;
              if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
              box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
            });
            g.rotation.copy(rotation);
            g.position.copy(position);
            g.updateMatrixWorld(true);
            if (box.isEmpty()) return null;
            return { l: box.max.x - box.min.x, w: box.max.z - box.min.z, h: box.max.y - box.min.y };
          });
        },
        // The character rig's standing height at look.height 1 (crowd3d.js), in map units.
        crowdRigHeight: () => crowdRigHeight(),
        // People's share of the frame (crowd3d.js): parts, draw calls, triangles.
        crowdStats: (byPart) => crowdStats(byPart),
        // Trees (vegetation3d.js): species counts, the forests, tree draws in view.
        vegetation: () => vegetationReport(),
        treeLineup: (x, y, spacing, lod, perRow) => treeLineup(x, y, spacing, lod, perRow),
        crowdBenchmark: (frames) => crowdBenchmark(frames),
        // A person's drawn height from the soles to the crown (their compiled look), in map units.
        personStature: (p) => personStature(p),
        // Switch graphics quality tier (quality.js) at runtime.
        setQuality(tier) {
          applyRendererQuality(tier);
          api.resize();
        },
        quality: () => ({
          tier: activeTier?.name,
          gpu: graphicsGpuName,
          hdr: hdrCapable,
          shadowMap: renderer.shadowMap.enabled ? sun.shadow.mapSize.x : 0,
          pixelRatio: renderer.getPixelRatio(),
          renderScale: hdrCapable ? renderScale : 1,
        }),
        // Dynamic resolution (quality.js ADAPTIVE QUALITY); returns the scale applied.
        setRenderScale: (scale) => (hdrCapable ? setRenderScale(scale) : 1),
        resize() {
          renderer.setSize(viewportWidth, viewportHeight);
          const viewH = clamp(viewportHeight * 0.68, 430, 630) / worldZoom;
          streetCamera.left = (-viewH * viewportWidth) / viewportHeight / 2;
          streetCamera.right = (viewH * viewportWidth) / viewportHeight / 2;
          streetCamera.top = viewH / 2;
          streetCamera.bottom = -viewH / 2;
          streetCamera.updateProjectionMatrix();
        },
        project(mapX, mapY, elevation = 0) {
          const v = new Three.Vector3(mapX, elevation, mapY).project(camera);
          return {
            x: (v.x * 0.5 + 0.5) * viewportWidth,
            y: (-0.5 * v.y + 0.5) * viewportHeight,
            // Behind a perspective camera (the flight and ride views) the point
            // projects mirrored into the frame: callers drawing labels skip it.
            behind: v.z > 1,
          };
        },
        // Inspection only: turn the street camera to a bearing and pitch (degrees),
        // aimed `lift` units above the ground; no arguments restores it.
        inspectView(yaw, pitch, lift = 0) {
          inspectAngles = yaw == null ? null : { yaw: (yaw * Math.PI) / 180, pitch: (pitch * Math.PI) / 180, lift };
          return inspectAngles;
        },
        // The street zoom as a height above the ground in world units (flight-view3d.js).
        zoomHeight: (zoom) => streetZoomHeight(zoom),
        aim(mx, my) {
          ray.setFromCamera(
            new Three.Vector2((mx / viewportWidth) * 2 - 1, (-my / viewportHeight) * 2 + 1),
            camera,
          );
          // The gun's height in the hand (crowd3d.js HOLDS: about shoulder height).
          groundPlane.constant = -0.8 * PERSON_HEIGHT - entityElevation(player);
          if (ray.ray.intersectPlane(groundPlane, hitPoint))
            return Math.atan2(hitPoint.z - player.y, hitPoint.x - player.x);
          return player.a;
        },
        // The map point under the screen point (mx, my) on a level plane at
        // `elevation` (the Apache's aim, apache.js); null when the ray misses it.
        groundPoint(mx, my, elevation = 0) {
          ray.setFromCamera(new Three.Vector2((mx / viewportWidth) * 2 - 1, (-my / viewportHeight) * 2 + 1), camera);
          groundPlane.constant = -elevation;
          return ray.ray.intersectPlane(groundPlane, hitPoint) ? { x: hitPoint.x, y: hitPoint.z } : null;
        },
        // A rocket motor's flame and a puff of its smoke trail at a point in the
        // air (apache.js; `motor` 1 while it burns, less as it coasts).
        smokePuff(x, z, altitude = 0, motor = 1) {
          const y = altitude + 9;
          if (motor >= 1)
            fx.push({ x, y, z, vx: 0, vy: 0, vz: 0, life: 0.06, max: 0.06, color: '#ffd28a', size: 7, glow: true });
          fx.push({
            x: x + randomBetween(-1.5, 1.5),
            y,
            z: z + randomBetween(-1.5, 1.5),
            vx: randomBetween(-4, 4),
            vy: randomBetween(2, 7),
            vz: randomBetween(-4, 4),
            life: 1.4 * motor + 0.4,
            max: 1.4 * motor + 0.4,
            color: '#c9c6bb',
            size: 4 + motor * 2,
            smoke: true,
          });
        },
        fire(x, z, a, rocket, altitude = 0) {
          muzzleUntil = gameTime + 0.055;
          muzzleLight.position.set(x, 11 + altitude, z);
          muzzleLight.intensity = rocket ? 1250 : 760;
          for (let j = 0; j < 4; j++)
            fx.push({
              x: x + Math.cos(a) * j * 3,
              y: 11 + altitude,
              z: z + Math.sin(a) * j * 3,
              vx: Math.cos(a) * 65,
              vy: 5,
              vz: Math.sin(a) * 65,
              life: 0.045,
              max: 0.045,
              color: j ? '#ffa33a' : '#fff6d2',
              size: rocket ? 18 : 7 - j,
              glow: true,
            });
          if (!rocket) {
            fx.push({
              x,
              y: 11 + altitude,
              z,
              vx: -Math.sin(a) * 42,
              vy: 44,
              vz: Math.cos(a) * 42,
              life: 0.65,
              max: 0.65,
              color: '#caa55e',
              size: 1.5,
              case: true,
            });
            fx.push({
              x,
              y: 11 + altitude,
              z,
              vx: Math.cos(a) * 15,
              vy: 13,
              vz: Math.sin(a) * 15,
              life: 0.36,
              max: 0.36,
              color: '#aab4b8',
              size: 5,
              smoke: true,
            });
          }
        },
        impact(x, z, kind, altitude = 0) {
          impactEffect(x, z, kind, altitude);
        },
        explosion(x, z, power = 1, altitude = terrainHeight(x, z)) {
          const ring = blastRings[blastRingIndex++ % blastRings.length];
          ring.position.set(x, altitude + 0.38, z);
          ring.userData = {
            born: gameTime,
            power,
          };
          ring.visible = true;
          for (let j = 0; j < 66; j++) {
            const a = Math.random() * TAU,
              s = (25 + Math.random() * 170) * power,
              glow = j < 20;
            const life = glow ? 0.22 + Math.random() * 0.65 : 1.8 + Math.random() * 2.7;
            fx.push({
              x: x + Math.cos(a) * 5,
              y: altitude + 6,
              z: z + Math.sin(a) * 5,
              vx: Math.cos(a) * s,
              vy: glow ? 25 + Math.random() * 75 : 30 + Math.random() * 38,
              vz: Math.sin(a) * s,
              life,
              max: life,
              color: glow ? (j < 5 ? '#fff2bf' : '#ff8c31') : j % 2 ? '#3c4147' : '#656970',
              size: (glow ? 14 : 22) * power,
              glow,
              smoke: !glow,
            });
          }
          for (let j = 0; j < 16; j++) {
            const a = Math.random() * TAU;
            fx.push({
              x,
              y: altitude + 12,
              z,
              vx: Math.cos(a) * randomBetween(80, 180),
              vy: randomBetween(70, 180),
              vz: Math.sin(a) * randomBetween(80, 180),
              life: 1.6,
              max: 1.6,
              color: '#ab9e81',
              size: randomBetween(1, 3),
              case: true,
            });
          }
          if (
            distanceBetween(
              {
                x,
                y: z,
              },
              player,
            ) < 700
          ) {
            muzzleLight.position.set(x, altitude + 20, z);
            muzzleLight.intensity = 1900 * power;
            muzzleUntil = gameTime + 0.18;
          }
        },
