      // Post sun glare (the chase view): how much of the sun the sky draws is seen (depth and brightness round its disc,
      // eased), light shafts from it through the scene's depth (HIGH, ULTRA) and the veiling glare and lens flare.
      /**
       * SUN GLARE
       * Only in the chase view, with the sky's sun (lighting3d-sky.js skySunDirection) above the
       * horizon and in front of the camera; it fades as the sun leaves the frame, sets or the
       * day goes. By tier: LOW none, MEDIUM the glare, HIGH and ULTRA the glare, the flare and
       * the shafts.
       *  - Visibility (MEDIUM up): 24 taps over the disc read the depth (sky only) and the scene's
       *    brightness (cloud in front dims it) into a 1 x 1 target, blended with the last frames
       *    (about a tenth of a second), so a pole or a leaf crossing the sun dims the glare
       *    smoothly and cloud over the disc takes it away.
       *  - Shafts (HIGH, ULTRA): the sky's bright pixels round the sun (depth 1, over a
       *    threshold, falling off from the sun) at a quarter of the scene's size, smeared towards
       *    the sun twice (12 taps, then 12 finer: 144 in all, decaying); buildings and trees
       *    block them because they are not in the mask. Added before the tone curve.
       *  - Glare (MEDIUM up): a wide soft bloom of the sun in the lens and a faint lift of the
       *    whole frame; the flare (HIGH, ULTRA): four soft ghosts along the line from the sun
       *    through the centre, tinted, restrained. Both scale with the visibility.
       * Nothing allocates per frame; the passes are warmed with the post chain (postWarmPasses).
       */
      const SUN_SHAFT_TAPS = 12,
        sunGlareUniforms = {
          // xy: the sun on screen (uv), z: how much glare (0: none), w: the frame's aspect.
          uSunScreen: { value: new Three.Vector4(0.5, 0.5, 0, 1) },
          // HDR colour of the glare and of the shafts' tint (the sun's colour times the strength).
          uSunGlare: { value: new Three.Color(0, 0, 0) },
          uSunShaft: { value: new Three.Color(0, 0, 0) },
          tSunSeen: { value: null },
          tSunShafts: { value: null },
        };
      // Visibility: 24 taps on two rings and the centre of the disc; blended over the last frames.
      const sunSeenUniforms = {
        tScene: { value: null },
        tDepth: { value: null },
        uSunScreen: sunGlareUniforms.uSunScreen,
        // x, y: the disc's radius in uv, z: the disc's expected brightness, w: this frame's share.
        uSunDisc: { value: new Three.Vector4(0.01, 0.01, 30, 0.2) },
      };
      const sunSeenMaterial = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tScene, tDepth;
        uniform vec4 uSunScreen, uSunDisc;
        float sunTap( vec2 o ) {
          vec2 uv = clamp( uSunScreen.xy + o * uSunDisc.xy, 0.0, 1.0 );
          if ( texture2D( tDepth, uv ).x < 0.99999 ) return 0.0;
          float lum = dot( texture2D( tScene, uv ).rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
          return smoothstep( 0.15, 0.45, lum / uSunDisc.z );
        }
        void main() {
          float seen = sunTap( vec2( 0.0 ) );
          for ( int i = 0; i < 8; i++ ) {
            float a = float( i ) * 0.7854;
            seen += sunTap( vec2( cos( a ), sin( a ) ) * 0.4 ) + sunTap( vec2( cos( a + 0.39 ), sin( a + 0.39 ) ) * 0.75 );
          }
          seen /= 17.0;
          gl_FragColor = vec4( vec3( seen ), uSunDisc.w );
        }`,
        sunSeenUniforms,
      );
      sunSeenMaterial.blending = Three.CustomBlending;
      sunSeenMaterial.blendSrc = Three.SrcAlphaFactor;
      sunSeenMaterial.blendDst = Three.OneMinusSrcAlphaFactor;
      const sunSeenTarget = colorTarget(1, 1, Three.UnsignedByteType);
      sunGlareUniforms.tSunSeen.value = sunSeenTarget.texture;
      // Shafts: the mask (the sky's bright pixels near the sun), then two radial smears towards the sun.
      const sunShaftUniforms = {
        tScene: { value: null },
        tDepth: { value: null },
        tSource: { value: null },
        uSunScreen: sunGlareUniforms.uSunScreen,
        // x: the light where the mask starts (scene light), y: falloff from the sun (per uv), z: smear length (share
        // of the way to the sun), w: decay a tap.
        uShaft: { value: new Three.Vector4(1.2, 6, 1, 0.94) },
      };
      const sunMaskMaterial = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tScene, tDepth;
        uniform vec4 uSunScreen, uShaft;
        void main() {
          vec3 c = vec3( 0.0 );
          if ( texture2D( tDepth, vUv ).x >= 0.99999 ) {
            c = min( texture2D( tScene, vUv ).rgb, vec3( 40.0 ) );
            float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
            vec2 v = ( vUv - uSunScreen.xy ) * vec2( uSunScreen.w, 1.0 );
            c *= smoothstep( uShaft.x, uShaft.x * 3.0, lum ) * exp( - dot( v, v ) * uShaft.y * uShaft.y ) / max( 1.0, lum * 0.25 );
          }
          gl_FragColor = vec4( c, 1.0 );
        }`,
        sunShaftUniforms,
      );
      const sunSmearMaterial = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tSource;
        uniform vec4 uSunScreen, uShaft;
        void main() {
          vec2 step = ( uSunScreen.xy - vUv ) * ( uShaft.z / ${SUN_SHAFT_TAPS.toFixed(1)} );
          vec2 uv = vUv;
          vec3 sum = vec3( 0.0 );
          float weight = 1.0, total = 0.0;
          for ( int i = 0; i < ${SUN_SHAFT_TAPS}; i++ ) {
            sum += texture2D( tSource, uv ).rgb * weight;
            total += weight;
            weight *= uShaft.w;
            uv += step;
          }
          gl_FragColor = vec4( sum / total, 1.0 );
        }`,
        sunShaftUniforms,
      );
      // The composite's part (USE_SUN_GLARE from MEDIUM, USE_SUN_SHAFTS from HIGH): added before the tone curve.
      Three.ShaderChunk.city_sun_glare_pars = `
        #ifdef USE_SUN_GLARE
          uniform vec4 uSunScreen;
          uniform vec3 uSunGlare, uSunShaft;
          uniform sampler2D tSunSeen;
          #ifdef USE_SUN_SHAFTS
            uniform sampler2D tSunShafts;
            // A soft ghost of the sun's disc at t along the line from the sun through the centre.
            float sunGhost( vec2 uv, float t, float size ) {
              vec2 at = uSunScreen.xy + ( vec2( 0.5 ) - uSunScreen.xy ) * t;
              vec2 v = ( uv - at ) * vec2( uSunScreen.w, 1.0 );
              return 1.0 - smoothstep( size * 0.55, size, length( v ) );
            }
          #endif
          vec3 citySunGlare( vec2 uv ) {
            if ( uSunScreen.z <= 0.0 ) return vec3( 0.0 );
            float seen = texture2D( tSunSeen, vec2( 0.5 ) ).r * uSunScreen.z;
            vec2 v = ( uv - uSunScreen.xy ) * vec2( uSunScreen.w, 1.0 );
            float r = length( v );
            vec3 light = uSunGlare * seen * ( exp( - r * 7.0 ) * 0.1 + exp( - r * 24.0 ) * 0.3 + 0.012 );
            #ifdef USE_SUN_SHAFTS
              light += texture2D( tSunShafts, uv ).rgb * uSunShaft * uSunScreen.z;
              light += uSunGlare * seen * 0.035 * ( vec3( 0.55, 0.9, 1.0 ) * sunGhost( uv, 0.55, 0.035 )
                     + vec3( 1.0, 0.75, 0.45 ) * sunGhost( uv, 1.25, 0.07 ) * 0.6
                     + vec3( 0.6, 1.0, 0.7 ) * sunGhost( uv, 1.6, 0.025 )
                     + vec3( 0.8, 0.7, 1.0 ) * sunGhost( uv, 2.1, 0.11 ) * 0.4 );
            #endif
            return light;
          }
        #endif`;
      const sunGlareState = { level: 0, onScreen: 0, seen: 0, shafts: false, primed: false },
        sunGlareView = new Three.Vector3(),
        sunGlareClear = new Three.Color(),
        sunGlareClip = new Three.Vector4();
      // The glare passes a tier draws: 0 none (LOW), 1 the glare (MEDIUM), 2 with the flare and shafts.
      function sunGlareLevel(tier) {
        return !tier ? 0 : tier.name === 'HIGH' || tier.name === 'ULTRA' ? 2 : tier.name === 'MEDIUM' ? 1 : 0;
      }
      function sunGlareDefines(tier) {
        const level = sunGlareLevel(tier);
        return level >= 2 ? { USE_SUN_GLARE: 1, USE_SUN_SHAFTS: 1 } : level === 1 ? { USE_SUN_GLARE: 1 } : {};
      }
      // The shafts' two quarter-size targets (allocatePostTargets).
      let sunShaftTargets = [];
      function allocateSunShaftTargets(tier, width, height) {
        disposeTargets(sunShaftTargets);
        if (sunGlareLevel(tier) < 2) return;
        const w = Math.max(1, width >> 2),
          h = Math.max(1, height >> 2);
        sunShaftTargets.push(colorTarget(w, h), colorTarget(w, h));
        sunGlareUniforms.tSunShafts.value = sunShaftTargets[0].texture;
      }
      // The glare passes for the prewarm: the visibility, the mask and the smear, each with its target bound.
      function sunGlareWarmPasses(pass) {
        const level = sunGlareLevel(postTier);
        if (level >= 1) pass(sunSeenMaterial, sunSeenTarget);
        // (The shafts' targets come with the post targets, which may be made after this list: looked up when compiled.)
        if (level >= 2) pass(sunMaskMaterial, () => sunShaftTargets[0] || null), pass(sunSmearMaterial, () => sunShaftTargets[1] || null);
      }
      /* Where the sky's sun is on screen and how much glare it gives this frame; then the visibility and, on HIGH
         and ULTRA, the shafts. Runs after the scene pass (renderFrame), reading its colour and depth. */
      let sunGlareClock = 0;
      function renderSunGlare(tier) {
        const now = performance.now(),
          deltaSeconds = Math.min(0.25, Math.max(0, (now - sunGlareClock) / 1000)),
          level = sunGlareLevel(tier),
          screen = sunGlareUniforms.uSunScreen.value;
        let amount = 0;
        if (level > 0 && chaseViewActive && camera.isPerspectiveCamera && skySunDirection.y > -0.02) {
          sunGlareView.copy(skySunDirection).transformDirection(camera.matrixWorldInverse);
          if (sunGlareView.z < -0.05) {
            sunGlareClip.set(sunGlareView.x, sunGlareView.y, sunGlareView.z, 0).applyMatrix4(camera.projectionMatrix);
            const nx = sunGlareClip.x / sunGlareClip.w,
              ny = sunGlareClip.y / sunGlareClip.w,
              edge = Math.max(Math.abs(nx), Math.abs(ny)),
              light = daylight();
            screen.x = nx * 0.5 + 0.5;
            screen.y = ny * 0.5 + 0.5;
            sunGlareState.onScreen = 1 - smoothStep(0.95, 1.3, edge);
            amount = sunGlareState.onScreen * smoothStep(-0.02, 0.05, skySunDirection.y) * smoothStep(0.06, 0.3, light) * (1 - 0.9 * weather.cloud * weather.cloud);
          }
        }
        screen.z = amount;
        screen.w = postWidth / Math.max(1, postHeight);
        sunGlareClock = now;
        sunGlareState.level = level;
        sunGlareState.shafts = false;
        if (amount <= 0.001) {
          // Forget what was seen, so the glare never flashes in from a stale frame.
          if (sunGlareState.primed) {
            const clearAlpha = renderer.getClearAlpha();
            renderer.getClearColor(sunGlareClear);
            renderer.setRenderTarget(sunSeenTarget);
            renderer.setClearColor(0x000000, 1);
            renderer.clear(true, false, false);
            renderer.setClearColor(sunGlareClear, clearAlpha);
            sunGlareState.primed = false;
          }
          sunGlareState.seen = 0;
          return;
        }
        // The disc's radius in uv and its brightness in the scene buffer (lighting3d-look.js SKY_SUN_DISC).
        const radiusY = SKY_SUN_RADIUS / Math.tan((camera.fov * Math.PI) / 360) / 2,
          disc = skyUniforms.uSunDisc.value,
          sunLight = skyUniforms.uSunColor.value,
          discLum = Math.max(1, disc * (sunLight.r * 0.2126 + sunLight.g * 0.7152 + sunLight.b * 0.0722));
        sunSeenUniforms.tScene.value = sunShaftUniforms.tScene.value = sceneTarget.texture;
        sunSeenUniforms.tDepth.value = sunShaftUniforms.tDepth.value = sceneTarget.depthTexture;
        sunSeenUniforms.uSunDisc.value.set(radiusY / screen.w, radiusY, discLum, sunGlareState.primed ? 1 - Math.exp(-deltaSeconds * 9) : 1);
        // (Blended over what is there: no clear before it.)
        renderer.autoClear = false;
        runPass(sunSeenMaterial, sunSeenTarget);
        renderer.autoClear = true;
        sunGlareState.primed = true;
        // Glare in the sun's colour: white at noon, gold at dusk.
        sunGlareUniforms.uSunGlare.value.copy(sunLight).multiplyScalar(1.6);
        if (level >= 2 && sunShaftTargets.length === 2) {
          // The mask takes the disc and the bright core round it (from a twelfth of the disc's light).
          sunShaftUniforms.uShaft.value.set(discLum * 0.08, 6, 1, 0.93);
          runPass(sunMaskMaterial, sunShaftTargets[0]);
          sunShaftUniforms.tSource.value = sunShaftTargets[0].texture;
          runPass(sunSmearMaterial, sunShaftTargets[1]);
          sunShaftUniforms.tSource.value = sunShaftTargets[1].texture;
          sunShaftUniforms.uShaft.value.z = 1 / SUN_SHAFT_TAPS;
          runPass(sunSmearMaterial, sunShaftTargets[0]);
          sunGlareUniforms.uSunShaft.value.setRGB(0.35, 0.35, 0.35);
          sunGlareState.shafts = true;
        }
      }
      // DeadEndCity.cloudLayer().view.sky reads this (clouds3d-frame.js cloudViewReport).
      function sunGlareReport() {
        const s = sunGlareUniforms.uSunScreen.value;
        return { level: sunGlareState.level, amount: +s.z.toFixed(2), screen: [+s.x.toFixed(3), +s.y.toFixed(3)], onScreen: +sunGlareState.onScreen.toFixed(2), shafts: sunGlareState.shafts };
      }
