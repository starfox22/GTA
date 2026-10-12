      // Volumetric chase-view clouds on every preset, with bounded resolution, steps and lighting.
      // The flight/street field and march are unchanged; distant chase formations use a broad,
      // world-anchored warp so the repeating noise volume does not form a grid near the horizon.
      // All chase presets integrate through the layer; only their pixel/step budgets differ.
      // This keeps cloud silhouettes volumetric instead of projecting repeating flat slices.
      const SKY_CLOUD_QUALITY = {
        LOW: { resolution: 0.25, steps: 24, light: 0 },
        MEDIUM: { resolution: 0.34, steps: 40, light: 1 },
        HIGH: { resolution: cloudsMobile ? 0.34 : 0.5, steps: 64, light: 2 },
        ULTRA: { resolution: cloudsMobile ? 0.34 : 0.5, steps: CLOUD_BELOW_STEPS, light: 3 },
      };
      const skyCloudUniforms = {
        uSkyCloudMode: { value: 0 },
        uSkyCloudMarch: { value: cloudTarget ? cloudTarget.texture : null },
        uSkyCloudBuffer: { value: new Three.Vector2(1, 1) },
        uSkyCloudMarchSize: { value: new Three.Vector2(4, 4) },
      };
      const SKY_CLOUD_GLSL = `
        uniform float uSkyCloudMode;
        uniform sampler2D uSkyCloudMarch;
        uniform vec2 uSkyCloudBuffer, uSkyCloudMarchSize;
        vec4 skyClouds( vec3 d, vec3 haze ) {
          if ( uSkyCloudMode < 0.5 ) return vec4( 0.0 );
          vec2 uv = gl_FragCoord.xy / uSkyCloudBuffer, o = 0.5 / uSkyCloudMarchSize;
          vec4 c = ( texture2D( uSkyCloudMarch, uv + vec2( o.x, o.y ) ) + texture2D( uSkyCloudMarch, uv + vec2( -o.x, o.y ) )
                   + texture2D( uSkyCloudMarch, uv + vec2( o.x, -o.y ) ) + texture2D( uSkyCloudMarch, uv - o ) ) * 0.25;
          return vec4( c.rgb / ${CLOUD_STORE_SCALE.toFixed(2)}, c.a );
        }`;
      // The dome takes the clouds where the field exists (WebGL2); its program is warmed with the scene.
      if (cloudsSupported) {
        skyDome.material.dispose();
        skyDome.material = makeSkyMaterial(true, { glsl: SKY_CLOUD_GLSL, uniforms: skyCloudUniforms });
      }
      const skyCloudView = { mode: 0, march: false, quality: null, tier: '' },
        // How far up and out the march from below looks (world units: 20 km, where the air has hidden the layer).
        SKY_CLOUD_REACH = 160000;
      /* The air the layer is seen through from the street: the extinction per world unit at sea level (3.9 over the
         visibility, Koschmieder), about 30 km on a fair day, less under a grey deck, a few km in rain. The street's
         own haze closes within the draw distance (it hides the edge of the city) and is never used for the sky. */
      function skyCloudHaze() {
        const grey = clamp((weather.cloud - 0.6) / 0.4, 0, 1),
          metres = (30000 * (1 - 0.5 * grey)) / (1 + 5 * weather.rain + 0.8 * weather.approach);
        return 3.912 / (metres * UNITS_PER_METRE);
      }
      /* The layer from below for this frame (from updateCloudVisuals): bounded volumetric integration on every tier. `cloudSunIntensity`: the sun the clouds are lit with (clouds3d-frame.js). */
      function updateSkyClouds(tier, coverage, cloudSunIntensity, light) {
        skyHistory.frame++;
        const wanted = cloudsSupported && chaseViewActive && skyDome.visible && coverage > 0.02,
          march = wanted;
        skyCloudView.mode = skyCloudUniforms.uSkyCloudMode.value = wanted ? (march ? 2 : 1) : 0;
        skyCloudView.march = march;
        if (!wanted) return;
        setCloudLight(cloudSunIntensity, light);
        sceneBufferSize(skyCloudUniforms.uSkyCloudBuffer.value);
        const quality = SKY_CLOUD_QUALITY[tier] || SKY_CLOUD_QUALITY.HIGH;
        skyCloudView.quality = quality;
        skyCloudView.tier = tier;
        const size = sizeCloudTarget(tier, quality.resolution);
        skyCloudUniforms.uSkyCloudMarchSize.value.set(size.width, size.height);
        const u = marchUniforms;
        u.uBelow.value = 1;
        u.uBelowSteps.value = quality.steps;
        u.uBelowQuality.value = quality.light;
        u.uBelowJitter.value = (skyHistory.frame * 0.6180339887) % 1;
        // A Halton (2, 3) walk inside the march texel, so the history also smooths the layer's edges.
        const k = (skyHistory.frame % 8) + 1;
        u.uBelowOffset.value.set(((skyHalton(k, 2) - 0.5) * 2) / size.width, ((skyHalton(k, 3) - 0.5) * 2) / size.height);
        u.uInverseProjection.value.copy(camera.projectionMatrixInverse);
        u.uCameraWorld.value.copy(camera.matrixWorld);
        u.uCameraPosition.value.copy(camera.position);
        u.uSunDirection.value.copy(skyLightDirection);
        u.uEye.value.copy(camera.position);
        u.uHaze.value.set(scene.fog.near, scene.fog.far);
        u.uSlab.value.copy(cloudBounds);
        u.uNearFade.value.set(0, 1);
        u.uPocket.value.set(1, 2, 0);
        u.uMaxDistance.value = SKY_CLOUD_REACH;
        u.uBelowDrawn.value = camera.far;
        u.uShafts.value.set(0, 0, 0);
        u.uBelowHaze.value = skyCloudHaze();
        if (cloudNoiseSky) u.uNoise.value = cloudNoiseSky.texture;
        const clearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(cloudClearColor);
        renderer.setRenderTarget(cloudTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.render(marchScene, fullScreenCamera);
        skyCloudUniforms.uSkyCloudMarch.value = resolveSkyCloudHistory(size.width, size.height, cloudLayerAt(camera.position.x, camera.position.z).base);
        renderer.setRenderTarget(null);
        renderer.setClearColor(cloudClearColor, clearAlpha);
        u.uBelow.value = 0;
        u.uBelowOffset.value.set(0, 0);
        u.uNoise.value = cloudNoise.texture;
      }
      // The Halton sequence's k-th number in base b (in [0, 1)).
      function skyHalton(k, b) {
        let f = 1,
          r = 0;
        for (let i = k; i > 0; i = Math.floor(i / b)) {
          f /= b;
          r += f * (i % b);
        }
        return r;
      }
      /**
       * CLOUD SHADOWS FROM THE STREET
       * The shadow plane (clouds3d-shadows.js) serves cameras above it; the chase camera stands
       * under it (and the plane is not drawn there), so in the chase view the shadows are found
       * per pixel: a quarter-size pass rebuilds each pixel's world point from the scene's depth
       * and reads cloudShadeAt there (the plane's own field, rings and strength), so a cloud's
       * shadow lies on roofs and walls where they are, and fades as the haze takes the distance
       * over. The composite darkens the scene by it towards the plane's slate (postfx3d-composite.js
       * uCloudShade), before AO and bloom, as the plane's blend did. Sky pixels are left alone.
       */
      const chaseShade = { on: false, drawn: false },
        chaseShadeUniforms = {
          ...shadeUniforms,
          tDepth: { value: null },
          uInverseProjection: { value: new Three.Matrix4() },
          uCameraWorld: { value: new Three.Matrix4() },
          // The chase haze's clear distance and span (scene.fog): the shadows fade out under it.
          uFade: { value: new Three.Vector2(0, 1) },
        },
        chaseShadeTarget = cloudsSupported ? colorTarget(4, 4, Three.UnsignedByteType) : null,
        chaseShadeScene = new Three.Scene(),
        chaseShadeQuad = new Three.Mesh(
          fullScreenGeometry,
          new Three.ShaderMaterial({
            uniforms: chaseShadeUniforms,
            depthTest: false,
            depthWrite: false,
            vertexShader: `
              varying vec2 vUv;
              void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
            fragmentShader: `
              precision highp float;
              ${CLOUD_FIELD_GLSL}
              ${CLOUD_SHADE_GLSL}
              uniform sampler2D tDepth;
              uniform mat4 uInverseProjection, uCameraWorld;
              uniform vec2 uFade;
              uniform float uStrength;
              varying vec2 vUv;
              void main(){
                float z = texture2D(tDepth, vUv).x;
                if (z >= 0.99999) { gl_FragColor = vec4(0.); return; }
                vec4 view = uInverseProjection * vec4(vUv * 2. - 1., z * 2. - 1., 1.);
                view /= view.w;
                vec3 world = (uCameraWorld * vec4(view.xyz, 1.)).xyz;
                float fade = 1. - smoothstep(uFade.x, uFade.x + uFade.y * 1.5, length(view.xyz));
                gl_FragColor = vec4(cloudShadeAt(world) * uStrength * fade, 0., 0., 1.);
              }`,
          }),
        );
      chaseShadeQuad.frustumCulled = false;
      chaseShadeScene.add(chaseShadeQuad);
      registerPrewarmPass(chaseShadeScene, fullScreenCamera, () => chaseShadeTarget);
      /* From renderFrame (postfx3d.js), after the scene pass: the shadows for the composite, or none. */
      function renderChaseCloudShade() {
        const u = postCompositeUniforms;
        chaseShade.drawn = false;
        if (!chaseShade.on || !chaseShadeTarget || !sceneTarget) {
          u.uCloudShade.value = 0;
          return;
        }
        const width = Math.max(4, postWidth >> 2),
          height = Math.max(4, postHeight >> 2);
        if (chaseShadeTarget.width !== width || chaseShadeTarget.height !== height) chaseShadeTarget.setSize(width, height);
        chaseShadeUniforms.tDepth.value = sceneTarget.depthTexture;
        chaseShadeUniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
        chaseShadeUniforms.uCameraWorld.value.copy(camera.matrixWorld);
        chaseShadeUniforms.uFade.value.set(scene.fog.near, scene.fog.far);
        renderer.setRenderTarget(chaseShadeTarget);
        renderer.render(chaseShadeScene, fullScreenCamera);
        u.tCloudShade.value = chaseShadeTarget.texture;
        u.uCloudShade.value = 1;
        chaseShade.drawn = true;
      }
