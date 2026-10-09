        // The object the renderer returns (city3D.*): draw API and debug/info hooks.
        // bulletHole, structureBlast, structureImpact, groundStain, sparks, damageInfo.
        ...damageApi,
        // The mud effects' pools (offroad3d.js): clumps and mist flying, splats and tracks laid.
        offroadInfo: () => offroadEffectsInfo(),
        // Markers as drawn (markers.js `markersReport`): the player ring, the arrow, and any
        // flat ring-like mesh left standing in the scene's root within 60 units of the objective.
        markerProbe() {
          const target = objective(),
            near = [];
          for (const o of scene.children)
            if (o.visible && o.isMesh && /^(Ring|Circle)Geometry$/.test(o.geometry.type) && target && Math.hypot(o.position.x - target.x, o.position.z - target.y) < 60)
              near.push(o.geometry.type);
          return { playerRing: playerRing.visible, arrow: arrowGroup.visible, respray: resprayArrow.visible, flatMarkersAtTarget: near.length };
        },
        // Tyre smoke, dust and spray (tyresmoke3d.js): puffs alive, the tier's cap, emitted, peak.
        tyreSmokeInfo: () => tyreSmokeReport(),
        // The effect particle pool (fx3d-particles.js): live, drawn, capacity, peak, emitted, dropped.
        effectParticles: () => fxReport(),
        // The mountain chimneys' wood smoke (chimney-smoke3d.js): plumes, rate, puffs.
        chimneySmoke: (options) => chimneySmokeReport(options),
        // Blood decals drawn (blood3d.js BLOOD DECALS): one instanced draw.
        bloodDecals: () => bloodDecalReport(),
        // A cut joint as drawn (crowd3d-gore.js POSED CUTS) for gore.js goreJointPoint; false if not drawn lately.
        goreCutPoint: (p, bit, out) => goreCutPoint(p, bit, out),
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
        // First uses and the slowest frames (render3d-hiccups.js; DeadEndCity.renderHiccups()).
        hiccups: (reset) => hiccupReport(reset),
        // Running totals the console's frame trace (frame-trace.js) differences per frame: programs linked, textures
        // and geometries on the GPU, vehicle models built.
        // Civilian models drawn merged while pristine (vehicle-merge3d.js PRISTINE MERGE).
        vehicleMerges: () => vehicleMergeReport(),
        vehicleMergeAudit: () => vehicleMergeAudit(),
        // Buffer attributes and textures re-uploaded since a snapshot (render3d-hiccups.js ATTRIBUTE CHURN).
        attributeChurn: (snapshot) => attributeChurn(snapshot),
        traceCounters: () => ({
          programs: hiccupPrograms(),
          textures: renderer.info.memory.textures,
          geometries: renderer.info.memory.geometries,
          models: modelsBuiltTotal,
        }),
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
        // The downloaded vehicle models in the build and the kits made from them (vehicle-assets3d.js ASSET CARS).
        assetCars: () => assetCarReport(),
        assetCarsOn(on) {
          vaEnabled = on !== false;
          return vaEnabled;
        },
        carModels() {
          const out = [];
          for (const [c, m] of carModels) if (m.civilian || m.moto) out.push(civilianModelReport(c, m));
          return out;
        },
        // What every vehicle model built says on its tail (cars3d-badges.js; DeadEndCity.carBadges()).
        carBadges() {
          const out = [];
          for (const [c, m] of carModels) {
            const badge = m.badge || m.kit?.badge || null;
            out.push({ id: c.id, type: c.type, body: m.look?.body || null, badge });
          }
          return out;
        },
        // Seated heads against every closed cabin built (cars3d-headroom.js; DeadEndCity.cabinHeadroom()).
        cabinHeadroom: cabinHeadroomReport,
        helicopterModels() {
          const out = [];
          for (const [c, m] of carModels) if (c.type === 'helicopter') out.push(helicopterModelReport(c, m));
          return out;
        },
        drawProfile(top = 15) {
          const byName = new Map(),
            byCell = new Map(),
            byTriangles = new Map(),
            instancedList = [],
            sphere = new Three.Sphere(),
            roles = new Map(),
            // Calls on the scenery detail layers (flight-view3d.js LEVEL OF DETAIL): small props, mid-sized props, the rest.
            byLayer = { detail: 0, farDetail: 0, other: 0 };
          for (const m of carModels.values()) roles.set(m.group, 'vehicle');
          let total = 0,
            triangleTotal = 0;
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
                // (A group whose material is hidden is not drawn: the far copy's skipped cells, FAR SCENERY.)
                let calls = 1;
                if (Array.isArray(o.material)) {
                  calls = 0;
                  for (const g of o.geometry.groups) if (o.material[g.materialIndex]?.visible) calls++;
                  if (!o.geometry.groups.length) calls = 1;
                }
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
                if (o.layers.isEnabled(DETAIL_LAYER) && !o.layers.isEnabled(0)) byLayer.detail += calls;
                else if (o.layers.isEnabled(FAR_DETAIL_LAYER) && !o.layers.isEnabled(0)) byLayer.farDetail += calls;
                else byLayer.other += calls;
                // Triangles of what the camera pass draws (an instanced mesh: per instance).
                const g = o.geometry,
                  count = g ? (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) : 0,
                  instances = o.isInstancedMesh ? o.count : g && g.isInstancedBufferGeometry ? g.instanceCount : 1,
                  triangles = o.isMesh ? (count / 3) * instances : 0;
                byTriangles.set(key, (byTriangles.get(key) || 0) + triangles);
                triangleTotal += triangles;
                // Instanced meshes drawn whole whatever is in view are what a tile or a cull would save.
                if (instances > 1) instancedList.push([key, instances, Math.round(count / 3), o.frustumCulled, !!o.castShadow]);
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
          return {
            total,
            byLayer,
            byName: sorted(byName),
            byCell: sorted(byCell),
            // Triangles of the camera pass by the same names (the heaviest first).
            triangles: Math.round(triangleTotal),
            byTriangles: sorted(byTriangles).map(([name, n]) => [name, Math.round(n)]),
            // [name, instances, triangles each, frustum culled, casts shadow], the most instances first.
            instanced: instancedList.sort((a, b) => b[1] * b[2] - a[1] * a[2]).slice(0, top),
            programs: sorted(programs),
          };
        },
        // The police helicopter's searchlight: state and A/B switches (searchlight3d.js).
        searchlight: (options) => searchlightReport(options),
        // The cloud layer as the camera sees it this frame: in cloud, veil, wisps, lens (clouds3d-frame.js).
        cloudView: () => cloudViewReport(),
        // The player's parachute as drawn this frame: stage, shape, slider, lines, pendulum, cloud light (parachute3d-rigging.js).
        parachuteView: () => parachuteViewReport(),
        // Vehicle lights this frame: CAR LAMPS slots and drive-map beams (lighting3d-vehicle-lights.js).
        headlights: () => vehicleLightsReport(),
        // A/B switches for the look: pixelLock, fxaa (after MSAA), vibrance, carLamps, groundSlopeCap.
        lookSwitches(options) {
          if (options && typeof options === 'object')
            for (const key of Object.keys(lookSwitchState)) if (key in options) lookSwitchState[key] = !!options[key];
          groundShared.cityGroundSlopeCap.value = lookSwitchState.groundSlopeCap ? 1 : 0;
          groundShared.cityGroundWear.value = lookSwitchState.groundWear ? 1 : 0;
          roofSkinSwitch.value = lookSwitchState.roofSkin ? 1 : 0;
          setFoliageCoverage(activeTier);
          return { ...lookSwitchState };
        },
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
          roofs: roofSkinReport(),
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
        playerModel: (finish) => playerBodyReport(!!finish),
        // Trees (vegetation3d.js): species counts, the forests, tree draws in view.
        vegetation: () => vegetationReport(),
        // The see-through hole in the trees round the player (vegetation3d-cutaway.js; DeadEndCity.foliageCutaway).
        foliageCutaway: () => foliageHoleReport(),
        treeLineup: (x, y, spacing, lod, perRow) => treeLineup(x, y, spacing, lod, perRow),
        crowdBenchmark: (frames) => crowdBenchmark(frames),
        // A person's drawn height from the soles to the crown (their compiled look), in map units.
        personStature: (p) => personStature(p),
        drawnFemale: (p) => drawnFemale(p), // the rig's sex for a person (voices.js voiceReport)
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
        // What the chase view draws (chase-view3d.js): draw distance, clip planes, culling reach, haze.
        chaseView: () => chaseViewReport(),
        rainView: () => rainViewReport(),
        wetGlints: (options) => wetGlintReport(options),
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
          fxRocketTrail(x, z, altitude, motor);
        },
        // `height`: the muzzle over `altitude` (a drive-by's gun out of the window, driveby.js).
        fire(x, z, a, rocket, altitude = 0, height = 11) {
          muzzleUntil = gameTime + 0.055;
          muzzleLight.position.set(x, height + altitude, z);
          muzzleLight.distance = 95;
          muzzleLight.intensity = rocket ? 1250 : 760;
          fxMuzzle(x, z, a, rocket, altitude, height);
        },
        impact(x, z, kind, altitude = 0) {
          impactEffect(x, z, kind, altitude);
        },
        // A blast (fx3d-recipes.js BLAST): flash, fireball, smoke column, dust, sparks, chunks and its light.
        explosion(x, z, power = 1, altitude = terrainHeight(x, z)) {
          fxExplosion(x, z, power, altitude);
        },
