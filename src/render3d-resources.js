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
      let newModelsThisFrame = 0;
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
       * bitmap; the texture keeps its GPU copy (nothing bumps its version again).
       */
      const bakedCanvases = [groundTx, ...countyGroundMaterials.map((m) => m.map)].filter((t) => t && t.image);
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
      function uploadMeshes(meshes) {
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
          renderer.shadowMap.needsUpdate = renderer.shadowMap.enabled;
          renderer.render(uploadScene, camera);
        } finally {
          renderer.shadowMap.needsUpdate = false;
          meshes.forEach((mesh, i) => (mesh.frustumCulled = culled[i]));
          uploadScene.children = [];
          renderer.setRenderTarget(previous);
        }
      }
      // Progress, for renderHiccups(): whether the driver compiles in parallel, scene objects and
      // passes still to compile, models still to build, programs compiled and linked so far, the
      // CPU spent, and any error that stopped a part of it.
      const prewarmInfo = { parallel: false, queued: 0, passes: 0, models: 0, modelErrors: 0, strays: 0, uploads: 0, compiled: 0, linked: 0, ms: 0, done: false, error: '' };
      function prewarmShaders() {
        // (Lights stay out of the slices: compile() counts the lights of a slice as well as the
        // scene's, so a slice holding one compiled its programs for one light too many.)
        const queue = scene.children.filter((o) => !o.isLight),
          // The off-screen passes (registerPrewarmPass) and the wet-reflection passes: each
          // is compiled with its own target bound, as that decides the program (colour space).
          passes = [...prewarmPasses, ...postWarmPasses(), { run: () => warmPoints() }],
          // Stand-in vehicles, one per model (render3d-prewarm-models.js), built last and only
          // while the title is up.
          models = prewarmModelList(),
          // The far copy of the city, uploaded to the GPU a few meshes at a time once every
          // program is ready (only while the title is up).
          uploads = [...farScenery.children, ...(renderer.shadowMap.enabled ? prewarmShadowSamples() : [])],
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
        prewarmInfo.queued = queue.length;
        prewarmInfo.passes = passes.length;
        prewarmInfo.models = models.length;
        prewarmInfo.uploads = uploads.length;
        // (`?prewarm` in the URL runs it without the extension, compile only and nothing linked:
        // for headless runs on a software GL, which has none; tools/dev.mjs `--prewarm`.)
        const forced = !prewarmInfo.parallel && /[?&]prewarm\b/.test(location.search);
        if (!prewarmInfo.parallel && !forced) return;
        let burntWarmed = false;
        const note = (materials) => {
          for (const material of materials) {
            const program = renderer.properties.get(material).currentProgram;
            if (program && !unlinked.has(program)) {
              unlinked.add(program);
              prewarmInfo.compiled++;
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
        const step = () => {
          const started = performance.now(),
            previous = renderer.getRenderTarget(),
            // A slice of work may take 6 ms behind the title and 2.5 ms once the game is played.
            budget = forced || gameMode === 'menu' ? 6 : 2.5,
            bindScene = () => {
              if (hdrCapable && postTier) renderer.setRenderTarget(sceneTarget);
            };
          bindScene();
          while (queue.length && performance.now() - started < budget) {
            // Compile ~40 top-level objects per call: compile() walks the whole
            // scene for its lights each time.
            slice.children = queue.splice(0, 40);
            try {
              note(renderer.compile(slice, camera, scene));
            } catch (error) {
              prewarmInfo.error = String(error).slice(0, 160);
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
                prewarmInfo.error = String(error).slice(0, 160);
              }
              continue;
            }
            if (!target) continue;
            try {
              renderer.setRenderTarget(target);
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
              prewarmInfo.error = String(error).slice(0, 160);
            }
          }
          bindScene();
          // The stand-in models: one a step, only while the title is up (a build is a few
          // milliseconds of kit geometry), taken out of the scene again once compiled. Their
          // materials are not disposed, so their programs stay cached.
          const titleUp = forced || gameMode === 'menu';
          if (!titleUp) models.length = uploads.length = 0;
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
                prewarmInfo.strays++;
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
              prewarmInfo.modelErrors++;
              prewarmInfo.error = String(error).slice(0, 160) + ' (' + standIn.type + ')';
              // A failed build may leave a part of the model in the scene.
              while (scene.children.length > before) scene.remove(scene.children[scene.children.length - 1]);
            }
          }
          renderer.setRenderTarget(previous);
          // The far copy of the city, about 3 MB of buffers a step, once every program is ready.
          if (titleUp && !queue.length && !passes.length && !models.length && !unlinked.size && uploads.length) {
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
              prewarmInfo.error = String(error).slice(0, 160);
              uploads.length = 0;
            }
          }
          if (forced) unlinked.clear();
          for (const program of unlinked) {
            if (performance.now() - started > budget * 2) break;
            if (!program.isReady()) continue;
            program.getUniforms();
            unlinked.delete(program);
            prewarmInfo.linked++;
          }
          hiccupSync();
          prewarmInfo.queued = queue.length;
          prewarmInfo.passes = passes.length;
          prewarmInfo.models = models.length;
          prewarmInfo.uploads = uploads.length;
          const spent = performance.now() - started;
          prewarmInfo.ms += spent;
          prewarmInfo.done = !queue.length && !passes.length && !models.length && !uploads.length && !unlinked.size;
          // A step that ran long (a model build, a big slice) is followed by a longer pause: the
          // prewarm never takes much more than a quarter of the frames it shares with the menu.
          if (!prewarmInfo.done) setTimeout(step, Math.max(30, Math.min(400, spent * 3)));
        };
        setTimeout(step, 1500);
      }
      const viewFrustum = new Three.Frustum(),
        viewProjection = new Three.Matrix4(),
        entityBounds = new Three.Sphere();
      function entityInView(entity, radius = 35) {
        entityBounds.center.set(entity.x, entityElevation(entity) + radius * 0.25, entity.y);
        entityBounds.radius = radius;
        return viewFrustum.intersectsSphere(entityBounds);
      }
