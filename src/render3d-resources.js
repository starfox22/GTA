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
       */
      function prewarmShaders() {
        const queue = [...scene.children],
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
        if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
        const step = () => {
          const started = performance.now(),
            previous = renderer.getRenderTarget();
          if (hdrCapable && postTier) renderer.setRenderTarget(sceneTarget);
          while (queue.length && performance.now() - started < 6) {
            // Compile ~40 top-level objects per call: compile() walks the whole
            // scene for its lights each time.
            slice.children = queue.splice(0, 40);
            try {
              for (const material of renderer.compile(slice, camera, scene)) {
                const program = renderer.properties.get(material).currentProgram;
                if (program) unlinked.add(program);
              }
            } catch (error) {
              queue.length = 0;
            }
          }
          slice.children = [];
          renderer.setRenderTarget(previous);
          for (const program of unlinked) {
            if (performance.now() - started > 12) break;
            if (!program.isReady()) continue;
            program.getUniforms();
            unlinked.delete(program);
          }
          if (queue.length || unlinked.size) setTimeout(step, 30);
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
