      // Lighting 3D sky: the sky shader (cityHazeColor plus the dome's sun disc, moon and stars), the dome behind the
      // chase and flight views, and the environment map PMREM filters from the same sky (refreshEnvironment).
      // ---- Procedural sky ----------------------------------------------------------------
      /**
       * SKY
       * One sky shader serves the dome behind the chase and flight views and the scene that
       * PMREM filters into the environment map. Colours are scene-linear. Its body is
       * cityHazeColor (aerial-haze3d.js), which the chase view's haze uses too, so the far
       * city melts into it: a horizon band, brighter and warmer towards the sun (broad and
       * gold at dusk), giving way to a zenith a little deeper than the key by clear day, and
       * the broad circumsolar glow. The colours come from the keys
       * (lighting3d-look.js SKY_KEYS through updateHaze), tuned so the environment map lights
       * the city as the old gradient did. The dome (SKY_DOME) adds a deeper zenith
       * (uDomeZenith), the aureole's bright core and the sun's disc, darkened
       * towards its limb at an HDR brightness the bloom and the sun glare pick up; the moon
       * with its maria and halo; steady stars, faint and bright, white to blue and amber,
       * fading into the horizon; and the clouds seen from below (SKY_CLOUDS, clouds3d-sky.js).
       * Below the horizon the dome is the haze itself (it shows only beyond the far clip,
       * where the haze has closed over the ground); the environment's lower half is ground.
       */
      const SKY_SUN_RADIUS = 0.0085, // radians: a little over the real sun's, to read at game resolutions
        SKY_MOON_RADIUS = 0.0095;
      const skyUniforms = {
        // The keys (SKY_KEYS): the wet streets' sky (weather3d.js) reads them too.
        uZenith: { value: new Three.Color('#2f5f9e') },
        uHorizon: { value: new Three.Color('#a9c4dc') },
        uGround: { value: new Three.Color('#3a3f45') },
        uGlow: { value: new Three.Color('#ffd7a8') },
        uSunDir: { value: skySunDirection },
        uSunColor: { value: new Three.Color('#fff2d6') },
        // HDR brightness of the sun's disc (0: hidden), the moon's light and the stars'.
        uSunDisc: { value: 0 },
        uMoonDir: { value: MOON_DIRECTION },
        uMoonLight: { value: 0 },
        uStars: { value: 0 },
        // The city's sodium glow in a low band over the horizon at night (the dome only).
        uCityGlow: { value: new Three.Color(0, 0, 0) },
        // Share of the zenith's light the dome takes out up high (lighting3d-look.js DOME_ZENITH_*).
        uDomeZenith: { value: new Three.Vector3() },
        ...CITY_HAZE,
      };
      // The dome's sun, moon and stars (template-literal GLSL: no backticks in its comments).
      const SKY_DOME_GLSL = `
        float skyHash( vec3 p ) {
          p = fract( p * 0.1031 );
          p += dot( p, p.zyx + 31.32 );
          return fract( ( p.x + p.y ) * p.z );
        }
        float skyNoise( vec3 p ) {
          vec3 i = floor( p ), f = fract( p );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( skyHash( i ), skyHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( skyHash( i + vec3( 0.0, 1.0, 0.0 ) ), skyHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
                      mix( mix( skyHash( i + vec3( 0.0, 0.0, 1.0 ) ), skyHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( skyHash( i + vec3( 0.0, 1.0, 1.0 ) ), skyHash( i + vec3( 1.0 ) ), f.x ), f.y ), f.z );
        }
        // The sun's disc, darker towards its limb (I = 1 - 0.6 (1 - mu)), its edge a little soft.
        float skySunDisc( vec3 d ) {
          if ( dot( d, uSunDir ) < 0.999 ) return 0.0;
          float r = length( cross( d, uSunDir ) ) / ${SKY_SUN_RADIUS.toFixed(4)};
          return ( 0.4 + 0.6 * sqrt( max( 1.0 - r * r, 0.0 ) ) ) * ( 1.0 - smoothstep( 0.9, 1.08, r ) );
        }
        // The moon: a tight halo and a wide faint one in the haze, and its face with darker maria.
        vec3 skyMoon( vec3 d ) {
          float c = max( dot( d, uMoonDir ), 0.0 );
          vec3 light = vec3( 0.62, 0.68, 0.82 ) * ( pow( c, 900.0 ) * 0.35 + pow( c, 40.0 ) * 0.035 );
          if ( c > 0.999 ) {
            vec3 m = cross( d, uMoonDir ) / ${SKY_MOON_RADIUS.toFixed(4)};
            float r = length( m );
            float maria = skyNoise( m * 1.7 + 3.1 ) * 0.65 + skyNoise( m * 4.3 + 7.7 ) * 0.35;
            float face = ( 1.0 - smoothstep( 0.92, 1.06, r ) ) * ( 0.86 + 0.14 * sqrt( max( 1.0 - r * r, 0.0 ) ) );
            light += vec3( 0.93, 0.94, 1.0 ) * face * ( 1.0 - 0.4 * smoothstep( 0.45, 0.68, maria ) ) * 5.0;
          }
          return light * uMoonLight;
        }
        // Stars: many faint ones in small cells, a few bright ones in larger cells, each at its own
        // spot in its cell, white to blue and amber; steady, and fading into the horizon's glow.
        vec3 skyStars( vec3 d ) {
          vec3 light = vec3( 0.0 );
          for ( int i = 0; i < 2; i++ ) {
            float scale = i == 0 ? 330.0 : 150.0, keep = i == 0 ? 0.985 : 0.996;
            vec3 cell = floor( d * scale );
            float h = skyHash( cell + float( i ) * 41.0 );
            if ( h < keep ) continue;
            vec3 spot = vec3( skyHash( cell + 3.7 ), skyHash( cell + 8.1 ), skyHash( cell + 12.9 ) ) * 0.6 + 0.2;
            float glint = smoothstep( 0.3, 0.0, length( fract( d * scale ) - spot ) ), bright = ( h - keep ) / ( 1.0 - keep );
            vec3 tint = mix( vec3( 1.0, 0.8, 0.6 ), vec3( 0.72, 0.84, 1.0 ), skyHash( cell + 19.3 ) );
            light += tint * glint * ( i == 0 ? 0.35 + 0.9 * bright : 1.2 + 3.0 * bright * bright );
          }
          return light * uStars * smoothstep( 0.03, 0.35, d.y );
        }`;
      // `clouds` (clouds3d-sky.js): { glsl, uniforms } of the layer seen from below, defining skyClouds( d, sky ).
      function makeSkyMaterial(dome, clouds = null) {
        return new Three.ShaderMaterial({
          uniforms: clouds ? { ...skyUniforms, ...clouds.uniforms } : skyUniforms,
          side: Three.BackSide,
          depthWrite: false,
          depthTest: dome,
          fog: false,
          defines: dome ? (clouds ? { SKY_DOME: 1, SKY_CLOUDS: 1 } : { SKY_DOME: 1 }) : {},
          vertexShader: `
            varying vec3 vDir;
            void main() {
              vDir = normalize( position );
              vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
              gl_Position = p.xyww;
            }`,
          fragmentShader: `
            varying vec3 vDir;
            uniform vec3 uSunDir, uSunColor, uGround, uMoonDir, uCityGlow, uDomeZenith;
            uniform float uSunDisc, uMoonLight, uStars;
            ${CITY_HAZE_GLSL}
            ${dome ? SKY_DOME_GLSL : ''}
            ${clouds ? clouds.glsl : ''}
            void main() {
              vec3 d = normalize( vDir );
              vec3 haze = cityHazeColor( d ), sky = haze;
              #ifdef SKY_DOME
                // A deeper blue overhead than the environment's (none at the horizon, where the haze meets it).
                sky = max( sky - cityHazeTop.rgb * uDomeZenith * ( 1.0 - exp( - max( d.y, 0.0 ) * cityHazeTop.w ) ), 0.0 );
                // The aureole's bright core, a few degrees round the sun (not in the haze: a building in front
                // of the sun stands dark against it; not in the environment: no second sun on glossy paint).
                float toSun = clamp( dot( d, cityHazeSun.xyz ) * 0.5 + 0.5, 0.0, 1.0 );
                sky += cityHazeHalo.rgb * 2.0 * pow( toSun, cityHazeHalo.w * 24.0 );
                sky += uSunColor * ( skySunDisc( d ) * uSunDisc ) + skyMoon( d ) + skyStars( d )
                     + uCityGlow * exp( - max( d.y, 0.0 ) * 11.0 );
                #ifdef SKY_CLOUDS
                  vec4 cloud = skyClouds( d, haze );
                  sky = sky * ( 1.0 - cloud.a ) + cloud.rgb;
                #endif
              #else
                // The environment's lower half: the ground, under a short fade from the horizon.
                sky = mix( sky, uGround, smoothstep( 0.0, -0.18, d.y ) );
              #endif
              gl_FragColor = vec4( sky, 1.0 );
            }`,
        });
      }
      // The dome behind the chase and flight views (lighting3d-look.js shows it; clouds3d-sky.js gives it the
      // clouds). It follows the camera at the far plane and draws after the opaque city (renderOrder 50, depth-
      // tested), so it shades only the sky the city leaves, before the objective arrow (99) and the cloud
      // passes of the flight view (999 and up).
      const skyDome = new Three.Mesh(new Three.SphereGeometry(1, 32, 16), makeSkyMaterial(true));
      skyDome.frustumCulled = false;
      skyDome.renderOrder = 50;
      skyDome.visible = false;
      skyDome.name = 'sky dome';
      scene.add(skyDome);
      // Environment map: the same sky, blurred into PMREM mip levels.
      const envScene = new Three.Scene(),
        envSky = new Three.Mesh(new Three.SphereGeometry(100, 32, 16), makeSkyMaterial(false));
      envScene.add(envSky);
      const pmrem = new Three.PMREMGenerator(renderer);
      // What the environment was last filtered from: the sky's colours (square-root steps of 1/255) and
      // its sun (steps of ~3 degrees).
      const ENV_KEY_COLORS = [CITY_HAZE.cityHazeSky.value, CITY_HAZE.cityHazeGlow.value, CITY_HAZE.cityHazeTop.value, CITY_HAZE.cityHazeHalo.value],
        envKey = new Float32Array(ENV_KEY_COLORS.length * 4 + 6);
      let envTarget = null,
        envAge = Infinity;
      function envKeyChanged() {
        let changed = false,
          n = 0;
        for (let s = 0; s < ENV_KEY_COLORS.length; s++) {
          const source = ENV_KEY_COLORS[s];
          for (let i = 0; i < 4; i++, n++) {
            const q = i < 3 ? Math.round(Math.sqrt(Math.max(0, source[i])) * 255) : Math.round(source[i] * 50);
            if (envKey[n] !== q) (envKey[n] = q), (changed = true);
          }
        }
        const ground = skyUniforms.uGround.value;
        for (let i = 0; i < 6; i++, n++) {
          const q = i < 3 ? Math.round(skySunDirection.getComponent(i) * 20) : Math.round(Math.sqrt(Math.max(0, i === 3 ? ground.r : i === 4 ? ground.g : ground.b)) * 255);
          if (envKey[n] !== q) (envKey[n] = q), (changed = true);
        }
        return changed;
      }
      function refreshEnvironment(force) {
        // Rebuilding costs a few milliseconds of GPU time: only when the sky has
        // visibly changed, and not more than twice a second.
        if (!force && envAge < 0.5) return;
        if (!envKeyChanged() && !force) return;
        envAge = 0;
        const previous = envTarget;
        envTarget = pmrem.fromScene(envScene, 0, 1, 1000);
        scene.environment = envTarget.texture;
        if (previous) previous.dispose();
      }
