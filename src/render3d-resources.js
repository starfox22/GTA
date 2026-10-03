      // GPU resource lifecycle: shared geometries, model pruning and disposal.
      // Dynamic models own their cloned/new resources; the initial world and factory primitives persist.
      const sharedGeometries = new Set([boxGeo, sphereGeo, wheelGeo, cylinderGeo]),
        sharedMaterials = new Set();
      function collectResources(root, geometries, materials) {
        root.traverse((o) => {
          if (o.geometry) geometries.add(o.geometry);
          if (Array.isArray(o.material)) for (const material of o.material) materials.add(material);
          else if (o.material) materials.add(o.material);
        });
      }
      collectResources(scene, sharedGeometries, sharedMaterials);
      const retiredGeometries = new Set(),
        retiredMaterials = new Set();
      // Models whose entity is no longer in `list` are retired. The check set is
      // reused frame to frame rather than built afresh.
      const pruneActive = new Set();
      // Parsed colours for the effect sprites: a CSS colour string is parsed once,
      // not for every sprite on every frame.
      const parsedColors = new Map();
      function cachedColor(value) {
        let color = parsedColors.get(value);
        if (!color) {
          color = new Three.Color(value);
          if (parsedColors.size < 512) parsedColors.set(value, color);
        }
        return color;
      }
      // New vehicle and person models built per frame (see the vehicle pass).
      const NEW_MODELS_PER_FRAME = 6;
      let newModelsThisFrame = 0,
        // Vehicle models built since the start (the console's frame trace counts them per frame).
        modelsBuiltTotal = 0;
      // Individually modelled people this frame (reused list).
      const renderPeople = [];
      function pruneModels(models, list) {
        pruneActive.clear();
        for (let i = 0; i < list.length; i++) pruneActive.add(list[i]);
        for (const [entity, model] of models)
          if (!pruneActive.has(entity)) {
            const group = model.group || model;
            scene.remove(group);
            collectResources(group, retiredGeometries, retiredMaterials);
            models.delete(entity);
          }
      }
      // Finding what is still in use walks the whole scene (~15,000 objects), so
      // retired models are let go in batches every few seconds rather than on the
      // frame each car or person is removed (traffic comes and goes constantly).
      let lastModelDisposal = -Infinity;
      function disposeRetiredModels() {
        if (!retiredGeometries.size && !retiredMaterials.size) return;
        const now = performance.now();
        if (now - lastModelDisposal < 3000 && retiredGeometries.size + retiredMaterials.size < 400) return;
        lastModelDisposal = now;
        const liveGeometries = new Set(sharedGeometries),
          liveMaterials = new Set(sharedMaterials);
        collectResources(scene, liveGeometries, liveMaterials);
        for (const geometry of retiredGeometries) if (!liveGeometries.has(geometry)) geometry.dispose();
        for (const material of retiredMaterials) if (!liveMaterials.has(material)) material.dispose();
        retiredGeometries.clear();
        retiredMaterials.clear();
      }
      /**
       * BAKED CANVAS RELEASE
       * The painted ground sheets (the city sheet alone is ~29 megapixels, over
       * 110 MB as a canvas; the county, Sunset Pier and Fort Sentinel tiles add
       * ~70 MB) are uploaded to the GPU once and never repainted. Once a sheet's
       * texture is on the GPU its canvas is shrunk to a pixel, which frees the
       * bitmap; the texture keeps its GPU copy (nothing bumps its version again). The list
       * (`bakedCanvases`, render3d-streetprops.js) also holds every `sign()` face and glow mask.
       * Never list a texture that is cloned (far scenery's `identity()` clones share the image
       * and upload later) or repainted.
       */
      bakedCanvases.push(...[groundTx, ...countyGroundMaterials.map((m) => m.map)].filter((t) => t && t.image));
      function releaseBakedCanvases() {
        for (let i = bakedCanvases.length - 1; i >= 0; i--) {
          const texture = bakedCanvases[i],
            uploaded = renderer.properties.get(texture);
          if (!uploaded.__webglTexture || uploaded.__version !== texture.version) continue;
          texture.image.width = texture.image.height = 1;
          bakedCanvases.splice(i, 1);
        }
      }
      /**
       * SHADER PREWARM
       * A material's program is otherwise compiled the first time it is drawn:
       * a hitch each time a new district, vehicle or effect comes into view. While
       * the title screen is up, the scene's programs are compiled a slice at a time
       * (a few milliseconds per task, so the menu stays smooth) with the HDR target
       * bound, so the programs match the ones the scene pass will ask for, and
       * each is linked once KHR_parallel_shader_compile reports it ready, so the
       * driver does the work in the background (only where that extension exists).
       * The slices cover, in order: the scene's objects (never its lights: compile()
       * counts the lights of what it is given as well as the scene's, so a slice
       * holding one compiled its programs for one light too many); the off-screen
       * passes (`registerPrewarmPass`, the wet reflections), each with its own
       * target bound; the Points both ways round; then, only while the title is up,
       * one stand-in vehicle per model (render3d-prewarm-models.js) and the far copy
       * of the city's buffers. A program's key holds the light and shadow counts:
       * keep them fixed in play, and register a new off-screen pass.
       */
      /**
       * OFF-SCREEN UPLOAD
       * A mesh's buffers go to the GPU the first time it is drawn: the far copy of the city
       * (42 MB in ~500 meshes) all in the frame the helicopter lifts off. `uploadMeshes` draws
       * the given meshes once into a 1 x 1 target, under the scene's lights, fog and
       * environment (so the programs are the scene's own), with their culling off for that draw:
       * the shader prewarm calls it a few at a time behind the title.
       */
      const uploadScene = new Three.Scene(),
        uploadLights = [];
      let uploadTarget = null;
      // `shadows` false skips the sun's shadow pass for this draw (the cell pre-upload below needs none).
      function uploadMeshes(meshes, shadows = true) {
        if (!uploadTarget) {
          uploadTarget = new Three.WebGLRenderTarget(1, 1, { type: hdrCapable ? Three.HalfFloatType : Three.UnsignedByteType, depthBuffer: true });
          for (const o of scene.children) if (o.isLight) uploadLights.push(o);
        }
        const previous = renderer.getRenderTarget(),
          culled = meshes.map((mesh) => mesh.frustumCulled);
        uploadScene.matrixWorldAutoUpdate = false;
        uploadScene.fog = scene.fog;
        uploadScene.environment = scene.environment;
        // (The children are listed, not re-parented: each stays under its own group.)
        uploadScene.children = [...uploadLights, ...meshes];
        for (const mesh of meshes) mesh.frustumCulled = false;
        try {
          renderer.setRenderTarget(uploadTarget);
          // With shadows on, the sun's shadow pass draws them too: their depth programs compile
          // here (the shadow map itself is redrawn by the next frame).
          renderer.shadowMap.needsUpdate = shadows && renderer.shadowMap.enabled;
          renderer.render(uploadScene, camera);
        } finally {
          renderer.shadowMap.needsUpdate = false;
          meshes.forEach((mesh, i) => (mesh.frustumCulled = culled[i]));
          uploadScene.children = [];
          renderer.setRenderTarget(previous);
        }
      }
      /**
       * CELL PRE-UPLOAD
       * A static or batch cell's buffers and textures go to the GPU the first time the camera draws it: 0.2 MB to 13 MB
       * in one frame as the view crosses into a cell (renderHiccups().cells). While the game is played a timer takes the
       * cell nearest the view that is not on the GPU yet, up to `CELL_AHEAD` units beyond the view's reach, and uploads
       * its meshes through `uploadMeshes` (no shadow pass) a slice of ~1.5 MB at a time, so the draw that follows finds
       * them there. Only where the shader prewarm itself runs (a real GPU, or ?prewarm), while the page is shown, and it
       * backs off when a slice was slow. A geometry counts as uploaded once three.js has put its dispose listener on it.
       */
      const CELL_AHEAD = 1700,
        CELL_SLICE_BYTES = 1.5e6,
        cellWarm = { cells: null, started: false, meshes: 0, megabytes: 0, ticks: 0, slowest: 0 };
      function geometryUploaded(g) {
        const listeners = g._listeners;
        return !!(listeners && listeners.dispose && listeners.dispose.length);
      }
      function cellWarmList() {
        const list = [];
        const add = (group, x, y) => {
          const meshes = [];
          group.traverse((o) => {
            if (o.isMesh && o.geometry && !o.isSkinnedMesh) meshes.push(o);
          });
          if (meshes.length) list.push({ x, y, meshes, next: 0 });
        };
        for (const c of staticBatchCells.values()) add(c.group, c.x, c.z);
        for (const c of staticCells) add(c.group, c.x, c.y);
        return list;
      }
      function cellWarmTick() {
        if (!cellWarm.cells) cellWarm.cells = cellWarmList();
        const limit = viewReach + CELL_AHEAD + 512;
        let best = null,
          bestDistance = limit;
        for (const cell of cellWarm.cells) {
          if (cell.next >= cell.meshes.length) continue;
          const d = Math.max(Math.abs(cell.x - viewCenter.x), Math.abs(cell.y - viewCenter.y));
          if (d < bestDistance) {
            best = cell;
            bestDistance = d;
          }
        }
        const batch = [];
        let bytes = 0;
        // Signs hang from the scene, not from a cell: the two nearest not drawn yet (each is two 1 MB textures)
        // go in the same slice, which also lets their canvases be freed (BAKED CANVAS RELEASE).
        let first = null,
          second = null,
          firstD = limit,
          secondD = limit;
        for (const m of signMeshes) {
          if (!m.visible || geometryUploaded(m.geometry)) continue;
          const d = Math.max(Math.abs(m.position.x - viewCenter.x), Math.abs(m.position.z - viewCenter.y));
          if (d < firstD) {
            second = first;
            secondD = firstD;
            first = m;
            firstD = d;
          } else if (d < secondD) {
            second = m;
            secondD = d;
          }
        }
        if (first) batch.push(first);
        if (second) batch.push(second);
        while (best && best.next < best.meshes.length && bytes < CELL_SLICE_BYTES) {
          const mesh = best.meshes[best.next++],
            g = mesh.geometry;
          if (!mesh.visible || geometryUploaded(g)) continue;
          batch.push(mesh);
          for (const name in g.attributes) bytes += g.attributes[name].array?.byteLength || 0;
          if (g.index?.array) bytes += g.index.array.byteLength;
        }
        if (!batch.length) return 0;
        cellWarm.megabytes += bytes / 1048576;
        const started = performance.now();
        uploadMeshes(batch, false);
        hiccupSync();
        const spent = performance.now() - started;
        cellWarm.meshes += batch.length;
        cellWarm.ticks++;
        cellWarm.slowest = Math.max(cellWarm.slowest, spent);
        return spent;
      }
      function startCellPreUpload() {
        const run = () => {
          let wait = 120;
          if (!document.hidden && (gameMode === 'play' || gameMode === 'pause' || gameMode === 'menu') && prewarmInfo.done) {
            try {
              // A slow slice (a busy driver) backs the timer off.
              if (cellWarmTick() > 10) wait = 500;
            } catch (error) {
              wait = 5000;
            }
          }
          setTimeout(run, wait);
        };
        setTimeout(run, 4000);
      }
      // Progress, for renderHiccups(): whether the driver compiles in parallel, scene objects and
      // passes still to compile, models still to build, programs compiled and linked so far, the
      // CPU spent, and any error that stopped a part of it.
      const prewarmInfo = { parallel: false, queued: 0, passes: 0, models: 0, modelErrors: 0, strays: 0, uploads: 0, compiled: 0, linked: 0, ms: 0, done: false, error: '' };
      // `stage` (lighting3d-look.js LIT STATE) runs it again in play for a tier change: the scene's objects, the
      // post passes and, when shadows come on, the shadow samples, compiled with the new lit flags flipped for each
      // slice only; its progress is `litStageInfo`, and `finishLitSwitch` flips them for good when all are ready.
      function prewarmShaders(stage = null) {
        // (Lights stay out of the slices: compile() counts the lights of a slice as well as the
        // scene's, so a slice holding one compiled its programs for one light too many.)
        const queue = scene.children.filter((o) => !o.isLight),
          // The off-screen passes (registerPrewarmPass) and the wet-reflection passes: each
          // is compiled with its own target bound, as that decides the program (colour space).
          passes = stage ? postWarmPasses(true) : [...prewarmPasses, ...postWarmPasses(), { run: () => warmPoints() }],
          // Stand-in vehicles, one per model (render3d-prewarm-models.js), built last and only
          // while the title is up.
          models = stage ? [] : prewarmModelList(),
          // The far copy of the city, uploaded to the GPU a few meshes at a time once every
          // program is ready (only while the title is up).
          uploads = stage
            ? stage.state.shadows && !renderer.shadowMap.enabled
              ? prewarmShadowSamples()
              : []
            : [...farScenery.children, ...(renderer.shadowMap.enabled ? prewarmShadowSamples() : [])],
          info = stage ? litStageInfo : prewarmInfo,
          slice = new Three.Object3D(),
          // Programs compiled but not yet linked. compile() only starts the work:
          // three.js links a program (the blocking part, ~0.1-0.3 s each on a
          // software rasteriser) the first time it is drawn. Reading its uniforms
          // here does that link now, one or two per slice while the menu is up,
          // and with KHR_parallel_shader_compile only once the driver reports the
          // program ready, so it never blocks at all.
          unlinked = new Set();
        // Without KHR_parallel_shader_compile every link blocks the main thread,
        // and linking every material's program up front (most are never on screen
        // together) cost far more than it saved: there, programs link when first
        // drawn, as before.
        prewarmInfo.parallel = renderer.extensions.has('KHR_parallel_shader_compile');
        if (!stage) {
          prewarmInfo.queued = queue.length;
          prewarmInfo.passes = passes.length;
          prewarmInfo.models = models.length;
          prewarmInfo.uploads = uploads.length;
        }
        // (`?prewarm` in the URL runs it without the extension, compile only and nothing linked:
        // for headless runs on a software GL, which has none; tools/dev.mjs `--prewarm`.)
        const forced = !prewarmInfo.parallel && /[?&]prewarm\b/.test(location.search);
        // A tier change can stage its programs only where the shader prewarm itself runs.
        litStagingReady = prewarmInfo.parallel || forced;
        if (litStagingReady && !stage && !cellWarm.started) {
          cellWarm.started = true;
          startCellPreUpload();
        }
        if (!prewarmInfo.parallel && !forced) {
          if (stage) finishLitSwitch(stage);
          return;
        }
        let burntWarmed = false,
          doneMarked = false;
        const note = (materials) => {
          for (const material of materials) {
            const program = renderer.properties.get(material).currentProgram;
            if (program && !unlinked.has(program)) {
              unlinked.add(program);
              info.compiled++;
            }
          }
        };
        // Point sprites flip `sizeAttenuation` between the street camera and the flight camera
        // (the bridge and boat lights), and the flight view's program is a variant of its own:
        // compile each Points material both ways.
        const warmPoints = () => {
          const seen = new Set();
          scene.traverse((o) => {
            if (!o.isPoints || !o.material || seen.has(o.material)) return;
            seen.add(o.material);
            const m = o.material;
            m.sizeAttenuation = !m.sizeAttenuation;
            m.needsUpdate = true;
            slice.children = [o];
            try {
              note(renderer.compile(slice, camera, scene));
            } finally {
              m.sizeAttenuation = !m.sizeAttenuation;
              m.needsUpdate = true;
            }
          });
          slice.children = [];
        };
        const stepWork = () => {
          const started = performance.now(),
            previous = renderer.getRenderTarget(),
            // A slice of work may take 6 ms behind the title and 2.5 ms once the game is played.
            budget = forced || gameMode === 'menu' ? 6 : 2.5,
            bindScene = () => {
              if (hdrCapable && postTier) renderer.setRenderTarget(postSceneTarget());
            };
          bindScene();
          while (queue.length && performance.now() - started < budget) {
            // Compile ~40 top-level objects per call: compile() walks the whole
            // scene for its lights each time.
            slice.children = queue.splice(0, 40);
            try {
              note(renderer.compile(slice, camera, scene));
            } catch (error) {
              info.error = String(error).slice(0, 160);
              queue.length = 0;
            }
          }
          slice.children = [];
          while (!queue.length && passes.length && performance.now() - started < budget) {
            const pass = passes.shift(),
              target = typeof pass.target === 'function' ? pass.target() : pass.target;
            if (pass.run) {
              try {
                pass.run();
              } catch (error) {
                info.error = String(error).slice(0, 160);
              }
              continue;
            }
            if (!target) continue;
            try {
              renderer.setRenderTarget(target === 'canvas' ? null : target);
              if (pass.material) {
                // A post pass: its one material on the shared quad.
                postQuad.material = pass.material;
                note(renderer.compile(pass.scene, pass.camera));
              } else {
                const materials = renderer.compile(pass.scene, pass.camera);
                note(materials);
                // Its textures go up now too (a canvas painted for the pass, a table).
                for (const material of materials)
                  if (material.uniforms)
                    for (const key in material.uniforms) {
                      const texture = material.uniforms[key].value;
                      if (texture && texture.isTexture && !texture.isRenderTargetTexture && texture.image) renderer.initTexture(texture);
                    }
              }
            } catch (error) {
              info.error = String(error).slice(0, 160);
            }
          }
          bindScene();
          // The stand-in models: one a step, only while the title is up (a build is a few
          // milliseconds of kit geometry), taken out of the scene again once compiled. Their
          // materials are not disposed, so their programs stay cached.
          const titleUp = forced || gameMode === 'menu';
          if (!titleUp && !stage) models.length = uploads.length = 0;
          while (!queue.length && !passes.length && models.length && performance.now() - started < budget) {
            const standIn = models.shift(),
              before = scene.children.length;
            try {
              const model = makeVehicle(standIn);
              note(renderer.compile(model.group, camera, scene));
              // A burnt-out car: soot map, no clear coat (damage3d-bodies.js paintVehicle), the
              // first car to burn would otherwise compile that program and upload the soot.
              if (!burntWarmed && model.car && model.paint && model.paint.isMeshPhysicalMaterial) {
                burntWarmed = true;
                model.paint.map = model.paint.emissiveMap = sootTexture;
                model.paint.clearcoat = 0;
                model.paint.needsUpdate = true;
                note(renderer.compile(model.group, camera, scene));
                renderer.initTexture(sootTexture);
              }
              scene.remove(model.group);
              // (A builder that also hung something else on the scene would leave it there.)
              while (scene.children.length > before) {
                scene.remove(scene.children[scene.children.length - 1]);
                info.strays++;
              }
              // The type's body-impostor pool (flight-view3d.js BODY IMPOSTORS) is made from the
              // first pristine model: make it now, and compile its instanced materials.
              carModels.set(standIn, model);
              try {
                const pool = bodyPoolFor(standIn);
                if (pool) for (const part of pool.parts) note(renderer.compile(part.mesh, camera, scene));
              } finally {
                carModels.delete(standIn);
              }
            } catch (error) {
              info.modelErrors++;
              info.error = String(error).slice(0, 160) + ' (' + standIn.type + ')';
              // A failed build may leave a part of the model in the scene.
              while (scene.children.length > before) scene.remove(scene.children[scene.children.length - 1]);
            }
          }
          renderer.setRenderTarget(previous);
          // The far copy of the city, about 3 MB of buffers a step, once every program is ready.
          if ((titleUp || stage) && !queue.length && !passes.length && !models.length && !unlinked.size && uploads.length) {
            const batch = [];
            for (let bytes = 0; uploads.length && bytes < 3e6; ) {
              const mesh = uploads.shift(),
                g = mesh.geometry;
              batch.push(mesh);
              for (const name in g.attributes) bytes += g.attributes[name].array?.byteLength || 0;
              if (g.index?.array) bytes += g.index.array.byteLength;
            }
            try {
              uploadMeshes(batch);
            } catch (error) {
              info.error = String(error).slice(0, 160);
              uploads.length = 0;
            }
          }
          if (forced) unlinked.clear();
          // A staged switch that has not finished in 20 s (a program that never reports ready) is let through:
          // the flags must not stay behind for want of one program.
          if (stage && performance.now() - stage.started > 20000) {
            queue.length = passes.length = uploads.length = 0;
            unlinked.clear();
          }
          for (const program of unlinked) {
            if (performance.now() - started > budget * 2) break;
            if (!program.isReady()) continue;
            program.getUniforms();
            unlinked.delete(program);
            info.linked++;
          }
          hiccupSync();
          info.queued = queue.length;
          info.passes = passes.length;
          info.models = models.length;
          info.uploads = uploads.length;
          const spent = performance.now() - started;
          info.ms += spent;
          info.done = !queue.length && !passes.length && !models.length && !uploads.length && !unlinked.size;
          if (info.done && !doneMarked) {
            doneMarked = true;
            if (stage) finishLitSwitch(stage);
            else bootMark('prewarm-done');
          }
          // A step that ran long (a model build, a big slice) is followed by a longer pause: the
          // prewarm never takes much more than a quarter of the frames it shares with the menu.
          if (!info.done) setTimeout(step, Math.max(30, Math.min(400, spent * 3)));
        };
        // A staged run flips the new lit flags only for the length of a step (they decide the programs).
        const step = () => {
          if (stage && litStaged !== stage) return; // replaced by a later change
          const before = stage ? litFlagsNow() : null;
          if (stage) setLitFlags(stage.state);
          try {
            stepWork();
          } catch (error) {
            if (!stage) throw error;
            // A failed staged step gives up staging: the switch is made at once, as it was before it was staged.
            info.error = String(error).slice(0, 160);
            setLitFlags(before);
            finishLitSwitch(stage);
          } finally {
            // (A step that finished the switch has set the flags for good: nothing to put back.)
            if (stage && litStaged === stage) setLitFlags(before);
          }
        };
        setTimeout(step, stage ? 0 : 1500);
      }
      const viewFrustum = new Three.Frustum(),
        viewProjection = new Three.Matrix4(),
        entityBounds = new Three.Sphere();
      function entityInView(entity, radius = 35) {
        entityBounds.center.set(entity.x, entityElevation(entity) + radius * 0.25, entity.y);
        entityBounds.radius = radius;
        return viewFrustum.intersectsSphere(entityBounds);
      }
