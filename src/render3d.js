    // BEGIN SUBSYSTEM: src/render3d.js — Three.js renderer and resource lifecycle
    /**
     * Three.js renderer and resource lifecycle
     * Source: src/render3d.js
     * Scope: shared game closure.
     * Asset loading, camera, lights, shared geometry, entity models, effects and drawing API.
     */
    /* The cinematic renderer consumes the existing simulation without changing its rules. */
    let city3D = null,
      visualAssets = {},
      lastVisualTime = 0;
    async function loadVisuals() {
      // Native simulation tests have no image decoder; canvas geometry stays usable.
      if (typeof Image === 'undefined') return;
      const names = ['architecture', 'ground', 'arsenal', 'harbor'];
      await Promise.all(
        names.map(
          (name) =>
            new Promise((resolve) => {
              const im = new Image();
              im.onload = () => {
                visualAssets[name] = im;
                resolve();
              };
              im.onerror = () => resolve();
              im.src = ASSETS[name];
            }),
        ),
      );
      drawWeapon();
      if (gameMode === 'arsenal') renderArsenal();
      if (typeof THREE === 'undefined' || !visualAssets.architecture || !visualAssets.ground) return;
      try {
        city3D = createCityRenderer();
        getElement('renderBadge').textContent = 'SOUTH COAST · DUSK';
        // The 2D fallback's ground bitmap (~21 MP) is never drawn with the 3D
        // renderer running: free it (late paints into it are harmless no-ops).
        groundCanvas.width = groundCanvas.height = 1;
      } catch (error) {
        console.warn('Reduced graphics mode:', error);
        getElement('renderBadge').textContent = 'REDUCED GRAPHICS';
      }
      drawWeapon();
    }
    function createCityRenderer() {
      const Three = THREE,
        scene = new Three.Scene();
      scene.background = new Three.Color('#444c63');
      // scene.fog (distance haze) is set up with the flight camera in flight-view3d.js.
      const renderer = new Three.WebGLRenderer({
        canvas: getElement('scene'),
        // Anti-aliasing happens on the HDR scene target (postfx3d.js), not the canvas.
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
      });
      // three.js reads back every shader's info log after compiling it, which
      // forces the driver to finish compiling on the spot (and was most of the
      // CPU time in profiles whenever a new material came into view). Only with
      // ?shadercheck in the URL, for debugging a shader.
      renderer.debug.checkShaderErrors = /[?&]shadercheck\b/.test(location.search);
      // Quality tier (quality.js): 'auto' asks the GPU what it is first.
      graphicsDetected = detectGraphicsTier(renderer.getContext());
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, graphicsTier().pixelRatio));
      renderer.setSize(viewportWidth, viewportHeight);
      renderer.outputColorSpace = Three.SRGBColorSpace;
      renderer.toneMapping = Three.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.14;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = Three.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
      /**
       * CAMERA
       * On the street the view is orthographic and overhead: the city reads as a
       * plan, which is the whole point of the view, and a perspective lean on tall
       * buildings would cost legibility there. In the air a perspective camera
       * takes over so height reads as height (see flight-view3d.js). `camera` is
       * whichever of the two is active this frame.
       */
      const streetCamera = new Three.OrthographicCamera(-500, 500, 350, -350, 1, 7500),
        ray = new Three.Raycaster(),
        groundPlane = new Three.Plane(new Three.Vector3(0, 1, 0), -9),
        hitPoint = new Three.Vector3();
      const hemi = new Three.HemisphereLight('#b3c5e9', '#564943', 2.0);
      scene.add(hemi);
      const sun = new Three.DirectionalLight('#ffd7a0', 3.0),
        shadowDetail = touchEnabled() ? 2048 : 3072;
      sun.castShadow = true;
      sun.shadow.mapSize.set(shadowDetail, shadowDetail);
      sun.shadow.camera.left = -900;
      sun.shadow.camera.right = 900;
      sun.shadow.camera.top = 900;
      sun.shadow.camera.bottom = -900;
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 3200;
      sun.shadow.bias = -0.00035;
      sun.shadow.normalBias = 1.1;
      sun.shadow.radius = 2.2;
      scene.add(sun, sun.target);
      const fill = new Three.DirectionalLight('#879ccc', 0.55);
      fill.position.set(-200, 100, -300);
      scene.add(fill);
      let camera = streetCamera;
      // @include src/flight-view3d.js
      // @include src/postfx3d.js
      // @include src/lighting3d.js
      // @include src/searchlight3d.js
      // @include src/render3d-statics.js
      // @include src/render3d-terrain.js
      // Street trees, park trees and palms: the species library (vegetation3d.js).
      // @include src/vegetation3d.js
      // @include src/render3d-streetprops.js
      // @include src/cityscape3d.js
      // Street lamp halos in the glow field: lit after dark, dimmed with the district's
      // power, switched off while a car has the lamp down (damage3d.js sets `visible`).
      for (const p of lampGlowPending) {
        p.prop.halo = glowHandle(addGlow(p.x, LAMP_HEIGHT - 1, p.z, 28, '#ffd99b', 0.55, { day: 0, phase: 0 }));
        // Its reflection smeared down the wet street towards the camera (signage3d.js).
        addStreak(p.x, p.z + 8, 8, 64, '#ffcf96', 0.55);
      }
      lampGlowPending.length = 0;
      // Street signs (after the cityscape: their glow and spill live in signage3d.js).
      sign('ROYAL CINEMA', 948, 1056, 106, '#f6b9cb', false, { marquee: true });
      sign('24 HOUR', 1470, 544, 85, '#f3d394');
      sign('FREIGHT CO.', 2880, 549, 106, '#c1d4bb');
      // @include src/sidejobs3d.js
      // @include src/roadblocks3d.js
      // @include src/themepark3d.js
      // @include src/garage3d.js
      // @include src/landmarks3d.js
      // @include src/civic3d.js
      // @include src/air-cover3d.js
      // @include src/renewal3d.js
      // @include src/landscape3d.js
      // @include src/sports3d.js
      // @include src/sportsbook3d.js
      // @include src/transit3d.js
      // @include src/ecology3d.js
      // @include src/world3d.js
      // @include src/wakes3d.js
      // @include src/sealife3d.js
      // @include src/beachvolley3d.js
      // @include src/beach3d.js
      // @include src/county3d.js
      // @include src/base3d.js
      // @include src/airfields3d.js
      // @include src/boats3d.js
      // @include src/drawbridge3d.js
      // @include src/bridges3d.js
      // @include src/monarch-bridges3d.js
      // @include src/harbor3d.js
      // @include src/marina3d.js
      // @include src/monarch3d.js
      // @include src/monarch-villas3d.js
      // @include src/monarch-marina3d.js
      // @include src/monarch-garden3d.js
      // @include src/monarch-streets3d.js
      // @include src/dealership3d.js
      // @include src/beachclub3d.js
      // @include src/cycles3d.js
      // @include src/weather3d.js
      // @include src/character-rig3d.js
      // @include src/crowd3d.js
      // @include src/clouds3d.js
      // @include src/ground-data3d.js
      // @include src/surfaces3d.js
      // @include src/grass3d.js
      // @include src/helicopter3d.js
      // @include src/apache3d.js
      // @include src/vehicles3d.js
      // @include src/police3d.js
      // @include src/cars3d.js
      // @include src/hypercars3d.js
      // @include src/motorbikes3d.js
      // @include src/offroad3d.js
      // @include src/mountain-village3d.js
      // @include src/plane3d.js
      // @include src/render3d-vehicle-models.js
      // @include src/render3d-effects.js
      // @include src/render3d-resources.js
      const api = {
        // @include src/render3d-api.js
        // @include src/render3d-frame.js
      };
      flushBreakables();
      const batchReport = batchStaticGroups();
      api.batchReport = batchReport;
      tagSceneryDetail();
      compactBuildingBlocks();
      buildFarScenery(staticBatchMeshes);
      cellStatics();
      paintLampLight();
      applyRendererQuality(graphicsTier());
      refreshEnvironment(true);
      api.resize();
      prewarmShaders();
      prewarmHelicopters();
      return api;
    }
    // END SUBSYSTEM: src/render3d.js
