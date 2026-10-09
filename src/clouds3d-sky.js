      // Clouds 3D from below: the cloud layer over the chase view, drawn by the sky dome (HIGH and ULTRA march up into
      // the slab, clouds3d-march.js uBelow; LOW and MEDIUM a cheap 2D layer from the same field), and its shadows per pixel.
      /**
       * CLOUDS FROM BELOW
       * The chase view looks along the street, so the sky (and the layer, 250-400 m up) is in
       * frame most of the time; the flight view's march only runs above the lowest cloud. The
       * dome (lighting3d-sky-dome.js, SKY_CLOUDS) composites the cloud over the sky and under
       * nothing else: it draws after the opaque city, so the cloud is behind all geometry.
       *  - HIGH, ULTRA (mode 2): the far march, at its half resolution, from the camera up
       *    through the slab: the same density field, light (Beer's law, the column above, two
       *    orders of multiple scattering, sky light, the ground's bounce, the city's glow at
       *    night) and tower stops as from the air, lit by skyLightDirection (the sun the sky
       *    draws, so cloud near the sun shows its silver lining), hazed by the chase haze. The
       *    dome reads the target at its own pixel.
       *  - LOW, MEDIUM (mode 1): two looks into the field where the ray crosses the slab (low
       *    and middle of the layer, no detail octave), a soft opacity, and a shaded underside:
       *    sky light, the ground's bounce, the sun through thin cloud and the bright rim towards
       *    it, the city's glow at night. A handful of texture reads per sky pixel.
       * Both sample the coverage map and the noise the cloud shadows use (syncCloudField), so the
       * clouds overhead are the ones whose shadows cross the street. WebGL1 has no field: the dome
       * stays clear there. The camera under the layer is the case drawn; a camera inside it (a
       * summit in a wet deck) sees the march around it on HIGH and ULTRA, nothing on LOW and MEDIUM.
       */
      const skyCloudUniforms = {
        ...cloudFieldUniforms(),
        // 0 none, 1 the layer drawn in the dome (LOW, MEDIUM), 2 the march's target (HIGH, ULTRA).
        uSkyCloudMode: { value: 0 },
        uSkyCloudMarch: { value: cloudTarget ? cloudTarget.texture : null },
        // The scene buffer's size in pixels (the dome's gl_FragCoord into the march target), and the target's.
        uSkyCloudBuffer: { value: new Three.Vector2(1, 1) },
        uSkyCloudMarchSize: { value: new Three.Vector2(4, 4) },
        // The layer's base over the camera, and the air's extinction per world unit at sea level (skyCloudHaze).
        uSkyCloudBase: { value: 0 },
        uSkyCloudHaze: { value: 0 },
        // The light the march uses (the same objects: clouds3d-frame.js setCloudLight fills them).
        uSkyCloudSunDir: { value: skyLightDirection },
        uSkyCloudSun: marchUniforms.uSunColor,
        uSkyCloudAmbient: marchUniforms.uSkyColor,
        uSkyCloudBounce: marchUniforms.uGroundColor,
        uSkyCloudGlow: marchUniforms.uGlowColor,
        uSkyCloudTint: marchUniforms.uCloudTint,
      };
      // (Template-literal GLSL: no backticks in its comments.)
      const SKY_CLOUD_GLSL = `
        ${CLOUD_FIELD_GLSL}
        uniform float uSkyCloudMode, uSkyCloudBase, uSkyCloudHaze;
        uniform sampler2D uSkyCloudMarch;
        uniform vec2 uSkyCloudBuffer, uSkyCloudMarchSize;
        uniform vec3 uSkyCloudSunDir, uSkyCloudSun, uSkyCloudAmbient, uSkyCloudBounce, uSkyCloudGlow, uSkyCloudTint;
        // The cloud in direction d, premultiplied (rgb) with its opacity (a); haze is the sky without its
        // sun, moon and stars in that direction (what distant cloud fades into).
        vec4 skyClouds( vec3 d, vec3 haze ) {
          if ( uSkyCloudMode > 1.5 ) {
            // The march's history (clouds3d-sky-history.js: already smooth), in four bilinear taps half a march
            // texel apart (the target is half size), so its texels never show as steps.
            vec2 uv = gl_FragCoord.xy / uSkyCloudBuffer, o = 0.5 / uSkyCloudMarchSize;
            vec4 c = ( texture2D( uSkyCloudMarch, uv + vec2( o.x, o.y ) ) + texture2D( uSkyCloudMarch, uv + vec2( -o.x, o.y ) )
                     + texture2D( uSkyCloudMarch, uv + vec2( o.x, -o.y ) ) + texture2D( uSkyCloudMarch, uv - o ) ) * 0.25;
            return vec4( c.rgb / ${CLOUD_STORE_SCALE.toFixed(2)}, c.a );
          }
          if ( uSkyCloudMode < 0.5 || d.y < 0.012 || cameraPosition.y > uSkyCloudBase ) return vec4( 0.0 );
          vec3 ro = cameraPosition;
          // Where the ray meets the base, the layer there, and two looks into it: low and middle.
          vec4 area = cloudArea( ro.xz + d.xz * ( ( uSkyCloudBase - ro.y ) / d.y ) );
          vec2 slab = cloudSlab( area );
          vec3 low = ro + d * ( ( mix( slab.x, slab.y, 0.12 ) - ro.y ) / d.y ),
               mid = ro + d * ( ( mix( slab.x, slab.y, 0.4 ) - ro.y ) / d.y );
          float density = cloudDensityAt( low, area, false ) * 0.6 + cloudDensityAt( mid, area, false ) * 0.4;
          if ( density < 0.002 ) return vec4( 0.0 );
          // Opacity: soft at the edges, solid in the cores, thicker looking along a low ray.
          float alpha = 1.0 - exp( - density * mix( 9.0, 16.0, 1.0 - d.y ) );
          float thick = clamp( density * 2.4, 0.0, 1.0 );
          // The underside: sky light from round about (less under a thick core), the ground's bounce,
          // the sun through thin cloud and the bright rim on the side towards it, the city's glow.
          float toSun = clamp( dot( d, uSkyCloudSunDir ) * 0.5 + 0.5, 0.0, 1.0 );
          float sunUp = smoothstep( -0.12, 0.2, uSkyCloudSunDir.y );
          vec3 light = uSkyCloudAmbient * ( 0.62 - 0.32 * thick )
                     + uSkyCloudBounce * 0.9
                     + uSkyCloudSun * sunUp * ( ( 1.0 - thick ) * 0.3 + pow( toSun, 10.0 ) * ( 1.0 - 0.75 * thick ) * 1.4 )
                     + uSkyCloudGlow * 1.4;
          light *= uSkyCloudTint;
          // The air between the street and the cloud (kilometres of visibility, not the street's short haze):
          // thinner up high, the sky's own colour.
          vec3 rel = mid - ro;
          float dist = length( rel ), k = clamp( rel.y * cityHazeSky.w, -20.0, 20.0 );
          float column = abs( k ) > 1e-3 ? ( 1.0 - exp( -k ) ) / k : 1.0 - 0.5 * k;
          float fade = 1.0 - exp( - dist * cityHazeView.x * column * uSkyCloudHaze );
          return vec4( mix( light, haze, fade ) * alpha, alpha );
        }`;
      // The dome takes the clouds where the field exists (WebGL2); its program is warmed with the scene.
      if (cloudsSupported) {
        skyDome.material.dispose();
        skyDome.material = makeSkyMaterial(true, { glsl: SKY_CLOUD_GLSL, uniforms: skyCloudUniforms });
      }
      const skyCloudView = { mode: 0, march: false },
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
      /* The layer from below for this frame (from updateCloudVisuals): which way it is drawn, and on HIGH and ULTRA
         the march up into it. `cloudSunIntensity`: the sun the clouds are lit with (clouds3d-frame.js). */
      function updateSkyClouds(tier, coverage, cloudSunIntensity, light) {
        skyHistory.frame++;
        const wanted = cloudsSupported && chaseViewActive && skyDome.visible && coverage > 0.02,
          march = wanted && (tier === 'HIGH' || tier === 'ULTRA');
        skyCloudView.mode = skyCloudUniforms.uSkyCloudMode.value = wanted ? (march ? 2 : 1) : 0;
        skyCloudView.march = march;
        if (!wanted) return;
        setCloudLight(cloudSunIntensity, light);
        sceneBufferSize(skyCloudUniforms.uSkyCloudBuffer.value);
        skyCloudUniforms.uSkyCloudHaze.value = skyCloudHaze();
        if (!march) {
          syncCloudField(skyCloudUniforms);
          skyCloudUniforms.uSkyCloudBase.value = cloudLayerAt(camera.position.x, camera.position.z).base;
          return;
        }
        // The march from the camera up through the slab: no pocket, no veil hand-over, no shafts below it.
        const size = sizeCloudTarget(tier);
        skyCloudUniforms.uSkyCloudMarchSize.value.set(size.width, size.height);
        const u = marchUniforms;
        u.uBelow.value = 1;
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
        u.uShafts.value.set(0, 0, 0);
        u.uBelowHaze.value = skyCloudUniforms.uSkyCloudHaze.value;
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
