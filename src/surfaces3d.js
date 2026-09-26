      // BEGIN SUBSYSTEM: src/surfaces3d.js — Procedural surface detail
      /**
       * Procedural surface detail
       * Source: src/surfaces3d.js
       * Scope: createCityRenderer() closure (included after the city is built, before the vehicles).
       *
       * The painted ground sheet (render3d.js) is about 1.6 world units per texel:
       * fine from the air, soft at street level. Rather than a bigger sheet, the
       * ground shader adds world-space detail at the scale the camera needs, chosen
       * by what the painted colour already is:
       *
       *   asphalt (dark, grey)  aggregate grain, tar-sealed patches, hairline cracks,
       *                         a gritty bump; standing puddles when it has rained
       *   paving (light, grey)  a 6-unit slab grid with joints and slab-to-slab tone
       *   grass (green)         mottled blades and dry, yellowed patches
       *
       * Roughness and metalness are rebuilt in the shader too (tarmac is a rough
       * dielectric, not the slightly metallic sheet it was), with the wet sheen
       * coming from weather.wet: damp everywhere, mirror-smooth in the puddles, so
       * the sky, lamp pools and headlights shine in them.
       *
       * Foliage sways in the wind in the vertex shader (street trees, park trees,
       * palms), scaled by the height above the ground so trunks stay planted.
       */
      const surfaceUniforms = {
        cityWindTime: { value: 0 },
        cityWindAmp: { value: 0.4 },
        // Rain on the puddles: its strength and a clock for the rings.
        cityRain: { value: 0 },
        cityRainTime: { value: 0 },
      };
      // SURFACE_NOISE and RAIN_RINGS are shared GLSL (lighting3d.js, WET SURFACES).
      const GROUND_ALBEDO = `
        vec2 gp = vCityWorld.xz;
        vec3 groundBase = diffuseColor.rgb;
        float groundLum = dot( groundBase, vec3( 0.2126, 0.7152, 0.0722 ) );
        float grassMask = smoothstep( 0.004, 0.03, groundBase.g - max( groundBase.r, groundBase.b ) );
        float roadMask = ( 1.0 - smoothstep( 0.035, 0.09, groundLum ) ) * ( 1.0 - grassMask );
        float paveMask = smoothstep( 0.08, 0.2, groundLum ) * ( 1.0 - smoothstep( 0.42, 0.6, groundLum ) ) * ( 1.0 - grassMask );
        #ifdef CITY_HILL
          // A hillside is grass, rock and snow: no slab joints or tarmac there.
          roadMask = 0.0;
          paveMask = 0.0;
        #endif
        // Detail fades out where it would shimmer (seen from high up).
        float detailFade = 1.0 - smoothstep( 0.6, 2.5, length( fwidth( gp ) ) );
        // Unsharp mask on the painted sheet: lane paint, kerb lines and crossings
        // stay crisp at street zoom although the sheet is ~1.6 units per texel.
        {
          vec3 around = ( texture2D( map, vMapUv + vec2( cityGroundTexel.x, 0.0 ) ).rgb + texture2D( map, vMapUv - vec2( cityGroundTexel.x, 0.0 ) ).rgb
                        + texture2D( map, vMapUv + vec2( 0.0, cityGroundTexel.y ) ).rgb + texture2D( map, vMapUv - vec2( 0.0, cityGroundTexel.y ) ).rgb ) * 0.25;
          diffuseColor.rgb = max( diffuseColor.rgb + diffuse * ( sampledDiffuseColor.rgb - around ) * 0.8 * detailFade, 0.0 );
          groundBase = diffuseColor.rgb;
        }
        float grainA = cityNoise( gp * 0.9 ), grainB = cityNoise( gp * 3.1 );
        float grain = mix( 0.5, grainA * 0.6 + grainB * 0.4, detailFade );
        float tarPatch = smoothstep( 0.66, 0.7, cityNoise( gp * 0.011 + 17.0 ) );
        float crack = ( 1.0 - smoothstep( 0.0, 0.014, abs( cityNoise( gp * 0.05 + 3.0 ) - 0.5 ) ) )
                    * smoothstep( 0.5, 0.72, cityNoise( gp * 0.013 + 9.0 ) ) * detailFade;
        vec3 asphalt = groundBase * ( 0.84 + 0.32 * grain ) * mix( 1.0, 0.72, tarPatch ) * ( 1.0 - 0.5 * crack );
        vec2 slab = gp / 6.0, slabF = fract( slab );
        float joint = ( 1.0 - smoothstep( 0.0, 0.06, min( min( slabF.x, 1.0 - slabF.x ), min( slabF.y, 1.0 - slabF.y ) ) ) ) * detailFade;
        vec3 paving = groundBase * ( 0.92 + 0.14 * cityHash( floor( slab ) ) ) * ( 1.0 - 0.28 * joint ) * ( 0.94 + 0.12 * grainB );
        // Grass noise is sampled on rotated, offset lattices and summed: a single
        // value-noise octave shows its square grid, which read as a pixel mosaic of
        // blades and square dry patches.
        vec2 gr = mat2( 0.8, -0.6, 0.6, 0.8 ) * gp;
        float dry = smoothstep( 0.52, 0.8, cityNoise( gp * 0.035 + 5.0 ) * 0.6 + cityNoise( gr * 0.083 + 2.0 ) * 0.4 );
        // Meadow: broad lusher and sunburnt swathes (a few hundred units across) so
        // open ground reads as land from the air, then blades close up.
        float meadow = cityNoise( gp * 0.0045 + 3.7 ) * 0.62 + cityNoise( gr * 0.014 + 11.0 ) * 0.38;
        dry = max( dry, smoothstep( 0.62, 0.9, meadow ) * 0.7 );
        float blades = cityNoise( gr * 0.35 ) * 0.55 + cityNoise( gp * 0.93 + 7.0 ) * 0.45;
        vec3 grass = groundBase * mix( 1.0, 0.84 + 0.32 * blades, detailFade ) * ( 0.84 + 0.3 * meadow )
                   * mix( vec3( 1.0 ), vec3( 1.14, 1.06, 0.8 ), dry );
        // Lawns read lush rather than pastel: a deeper, more saturated green.
        grass = max( mix( vec3( dot( grass, vec3( 0.2126, 0.7152, 0.0722 ) ) ), grass, 1.15 ) * vec3( 0.84, 0.9, 0.84 ), 0.0 );
        diffuseColor.rgb = mix( mix( mix( groundBase * ( 0.94 + 0.12 * grain ), paving, paveMask ), asphalt, roadMask ), grass, grassMask );
        // WET ROADS (the pattern is lighting3d.js WET SURFACES). The damp film
        // soaks asphalt and paving darker and more saturated, paint and bright
        // kerbs a little less, grass hardly; it dries in patches after the rain.
        // From MEDIUM up it turns glossy (roughness below, the sky sheen after the
        // lights); from HIGH up dips in the tarmac and the gutters along the
        // kerbs hold standing water that ripples in the rain and, with the wet
        // reflections pass (postfx3d.js), mirrors the street. LOW only darkens.
        float wetFilm = 0.0, puddle = 0.0, wetReflect = 0.0;
        if ( cityWet > 0.002 ) {
          float low = cityWetLow( gp ), gutter = 0.0;
          #if defined( USE_MAP ) && !defined( CITY_HILL )
            // A gutter: paving (a kerb) a few units from this tarmac, in any of
            // the four directions. Two samples a step apart must both be paving:
            // the soft edge of a painted line or crossing bar passes through
            // paving's brightness too, and gave every marking a ring of water.
            if ( cityWetDetail > 1.5 && roadMask > 0.2 ) {
              vec2 dx = vec2( cityGroundTexel.x * 2.5, 0.0 ), dy = vec2( 0.0, cityGroundTexel.y * 2.5 );
              gutter = max( max( cityKerbAt( vMapUv, dx ), cityKerbAt( vMapUv, -dx ) ), max( cityKerbAt( vMapUv, dy ), cityKerbAt( vMapUv, -dy ) ) );
            }
          #endif
          wetFilm = cityWetFilm( gp, low, gutter * 0.25, cityWet );
          if ( cityWetDetail > 1.5 ) puddle = cityPuddle( low + gutter * 0.32 + grainA * 0.03, cityWet ) * roadMask;
          float porous = mix( mix( 0.6, 0.85, paveMask ), 1.0, roadMask ) * ( 1.0 - 0.65 * grassMask );
          float soak = wetFilm * porous;
          float bright = smoothstep( 0.3, 0.55, groundLum ) * ( 1.0 - grassMask );
          vec3 soaked = diffuseColor.rgb;
          soaked = max( mix( vec3( dot( soaked, vec3( 0.2126, 0.7152, 0.0722 ) ) ), soaked, 1.0 + 0.4 * soak ), 0.0 );
          soaked *= 1.0 - soak * mix( 0.46, 0.2, bright );
          diffuseColor.rgb = soaked * ( 1.0 - 0.3 * puddle );
          wetReflect = cityWetDetail > 0.5 ? clamp( soak * 0.34 * ( 1.0 - bright * 0.4 ) + puddle * 0.66, 0.0, 1.0 ) : 0.0;
        }`;
      const GROUND_ROUGHNESS = `
        roughnessFactor = mix( 0.92, mix( 0.8 + 0.14 * grain, 0.62, tarPatch ), roadMask );
        // The damp film smooths the surface into a sheen (only a little on LOW).
        roughnessFactor = mix( roughnessFactor, min( roughnessFactor, cityWetDetail > 0.5 ? 0.28 + 0.16 * grain : 0.6 ), wetFilm * ( 1.0 - 0.7 * grassMask ) );
        // Not a perfect mirror: at 0.05 the sun's reflection in a puddle was a blinding
        // blob that bloomed across the street from the air.
        roughnessFactor = mix( roughnessFactor, 0.09, puddle );`;
      const GROUND_NORMAL = `
        {
          float e = 0.3, h0 = cityNoise( gp * 3.1 );
          vec2 slope = vec2( cityNoise( ( gp + vec2( e, 0.0 ) ) * 3.1 ) - h0, cityNoise( ( gp + vec2( 0.0, e ) ) * 3.1 ) - h0 ) / e;
          float bump = ( roadMask * 0.12 + paveMask * 0.06 ) * ( 1.0 - puddle ) * detailFade;
          vec3 worldNormal = normalize( vec3( -slope.x * bump, 1.0, -slope.y * bump ) );
          // Rain landing in the puddles: the mirror-smooth water shivers, so the
          // lamps and signs it reflects break up. Close up (a unit covers a few
          // pixels) it is rings spreading from each drop; farther out, where rings
          // would only alias into sparkles, a slow wobble a dozen units across.
          if ( cityRain > 0.01 && puddle > 0.02 ) {
            float footprint = length( fwidth( gp ) );
            float ringsResolve = 1.0 - smoothstep( 0.3, 0.8, footprint );
            vec2 tilt = vec2( cityNoise( gp * 0.09 + vec2( cityRainTime * 0.7, 0.0 ) ), cityNoise( gp * 0.09 + vec2( 5.3, cityRainTime * 0.6 ) ) ) - 0.5;
            tilt *= 0.35 * ( 1.0 - ringsResolve );
            if ( ringsResolve > 0.01 ) tilt += cityPuddleRipples( gp, cityRainTime ) * ringsResolve;
            worldNormal = normalize( worldNormal + vec3( tilt.x, 0.0, tilt.y ) * cityRain * puddle );
          }
          normal = normalize( ( viewMatrix * vec4( worldNormal, 0.0 ) ).xyz );
        }`;
      // After the lights: the sky mirrored in the film and the puddles (what stands
      // in the way is added by the wet reflections pass on HIGH / ULTRA), and at
      // night the street lamps, shop windows and neon smeared down the wet road
      // towards the camera. A lamp head ~33 units up is mirrored ~28 units on the
      // camera's side of its pool, and wet asphalt stretches that into a streak
      // along the view: the night light map is read at several points up the
      // view direction and high-passed across it, so only the bright cores of the
      // pools come through, as narrow streaks in the lamps' own colours (sharper
      // and brighter in standing water, broken up by the rings in the rain).
      const GROUND_WET_LIGHT = `
        reflectedLight.indirectSpecular += citySkyReflect * wetReflect;
        if ( wetReflect > 0.003 && cityLampPower > 0.001 ) {
          vec2 along = citySheenDir, across = vec2( -along.y, along.x );
          // Rings in a puddle tilt the normal: the streak shivers sideways.
          vec2 wobble = across * normal.x * 30.0;
          float spread = mix( 1.0, 0.55, smoothstep( 0.4, 0.9, wetReflect ) );
          vec3 streak = vec3( 0.0 );
          for ( int i = 0; i < 6; i++ ) {
            float d = ( 12.0 + float( i ) * 11.0 ) * spread;
            vec2 uvC = ( vCityWorld.xz + along * d + wobble - cityLampRect.xy ) * cityLampRect.zw;
            vec2 side = across * 9.0 * cityLampRect.zw;
            vec3 core = texture2D( cityLampMap, uvC ).rgb;
            vec3 flank = 0.5 * ( texture2D( cityLampMap, uvC + side ).rgb + texture2D( cityLampMap, uvC - side ).rgb );
            // How much brighter than its flanks: ~0.15 on a pool's axis, nothing
            // a few units off it, so a pool ~100 units wide leaves a streak ~15 wide.
            float c = dot( core, vec3( 0.3333 ) ), f = dot( flank, vec3( 0.3333 ) );
            float peak = clamp( ( c - f ) / max( c, 1e-3 ) / 0.13, 0.0, 1.0 );
            streak += core * peak * peak * ( 1.0 - float( i ) * 0.12 );
          }
          reflectedLight.directSpecular += streak * cityLampPower * cityPower() * wetReflect * citySheenGain;
        }`;
      // With the wet reflections pass on, the wet ground marks itself in the HDR
      // target's alpha, negative (nothing else writes a negative alpha), for the
      // pass to know where and how strongly to reflect.
      const GROUND_WET_OUTPUT = `
        if ( cityReflectOut > 0.5 && wetReflect > 0.003 ) gl_FragColor.a = -wetReflect;`;
      const GROUND_WET_PARS = `
        #ifdef USE_MAP
          // Paving (not paint) in the painted sheet: a kerb beside the road.
          float cityKerb( vec2 uv ) {
            float l = dot( texture2D( map, uv ).rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
            return smoothstep( 0.07, 0.12, l ) * ( 1.0 - smoothstep( 0.3, 0.42, l ) );
          }
          // Paving from one step to three steps along dir (a kerb), nearer is wetter.
          float cityKerbAt( vec2 uv, vec2 dir ) {
            float a = cityKerb( uv + dir ), b = cityKerb( uv + dir * 2.0 ), c = cityKerb( uv + dir * 3.0 );
            // Averaged, not thresholded: the painted sheet's texels would print
            // as steps along the edge of the water.
            return ( min( a, b ) * 0.6 + min( b, c ) * 0.4 );
          }
        #endif`;
      const groundTexel = { value: new Three.Vector2(1 / terrain.width, 1 / terrain.height) };
      // Hills carry their colour in vertex colours, so their detail goes in after
      // those are applied (`colorChunk`), the flat sheets' straight after the map.
      function groundDetailPatch(shader, texel = groundTexel, colorChunk = '#include <map_fragment>') {
        cityMaterialPatch(shader);
        shader.uniforms.cityGroundTexel = texel;
        const hill = colorChunk !== '#include <map_fragment>' ? '#define CITY_HILL\n' : '';
        shader.uniforms.cityRain = surfaceUniforms.cityRain;
        shader.uniforms.cityRainTime = surfaceUniforms.cityRainTime;
        Object.assign(shader.uniforms, wetUniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\n' +
              hill +
              'uniform vec2 cityGroundTexel;\nuniform float cityRain;\nuniform float cityRainTime;\nuniform float cityWetDetail;\nuniform float cityReflectOut;\nuniform vec3 citySkyReflect;\nuniform vec2 citySheenDir;\nuniform float citySheenGain;\n' +
              SURFACE_NOISE +
              RAIN_RINGS,
          )
          .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n' + GROUND_WET_PARS)
          .replace(colorChunk, colorChunk + '\n' + GROUND_ALBEDO)
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + GROUND_WET_LIGHT)
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + GROUND_WET_OUTPUT)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + GROUND_ROUGHNESS)
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = 0.0;')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GROUND_NORMAL);
      }
      groundMesh.material.onBeforeCompile = (shader) => groundDetailPatch(shader);
      groundMesh.material.customProgramCacheKey = () => 'city-ground';
      for (const m of countyGroundMaterials) {
        const texel = { value: new Three.Vector2(1 / m.map.image.width, 1 / m.map.image.height) },
          chunk = m.vertexColors ? '#include <color_fragment>' : '#include <map_fragment>';
        m.onBeforeCompile = (shader) => groundDetailPatch(shader, texel, chunk);
        m.customProgramCacheKey = () => (m.vertexColors ? 'county-hill' : 'county-ground');
      }
      // ---- Wind in the foliage -----------------------------------------------------------------
      // The sway is a world-space offset added after the model transform. It used
      // to be added to the mesh's own vertices, so on any crown or frond left as a
      // scaled mesh rather than merged into a static batch (a unit sphere or box
      // blown up 10-15 times, like the potted palms on the Blue Hour terrace) the
      // scale multiplied it: leaves swung metres off their stems in a breeze.
      const SWAY_VERTEX = `
        {
          vec4 swayWorld = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            swayWorld = instanceMatrix * swayWorld;
          #endif
          swayWorld = modelMatrix * swayWorld;
          float lift = smoothstep( 8.0, 42.0, swayWorld.y );
          float phase = cityWindTime * 1.25 + swayWorld.x * 0.021 + swayWorld.z * 0.017;
          vec3 sway = vec3( sin( phase ) + 0.4 * sin( phase * 2.7 + 1.3 ), 0.0, cos( phase * 0.8 + 0.7 ) * 0.6 ) * lift * cityWindAmp;
          mvPosition.xyz += ( viewMatrix * vec4( sway, 0.0 ) ).xyz;
          gl_Position = projectionMatrix * mvPosition;
        }`;
      function foliagePatch(shader) {
        cityMaterialPatch(shader);
        Object.assign(shader.uniforms, surfaceUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float cityWindTime;\nuniform float cityWindAmp;')
          .replace('#include <project_vertex>', '#include <project_vertex>\n' + SWAY_VERTEX);
      }
      for (const m of [...leafMats, blossomMat, palmFrondMaterial]) {
        m.onBeforeCompile = foliagePatch;
        m.customProgramCacheKey = () => 'city-foliage';
      }
      function updateSurfaces(deltaSeconds) {
        surfaceUniforms.cityRain.value = weather.rain;
        surfaceUniforms.cityRainTime.value = (surfaceUniforms.cityRainTime.value + deltaSeconds) % 1000;
        surfaceUniforms.cityWindTime.value += deltaSeconds * (1 + weather.wind * 1.5);
        // Subtle: a crown moves a few inches in a breeze, a foot or so in a gale.
        surfaceUniforms.cityWindAmp.value = 0.25 + weather.wind * 0.9 + weather.rain * 0.3;
        // Ripples drift across still water (renewal3d.js) with the wind.
        const drift = deltaSeconds * (0.004 + weather.wind * 0.01);
        for (const map of pondRippleMaps) {
          map.offset.x = (map.offset.x + drift) % 1;
          map.offset.y = (map.offset.y + drift * 0.6) % 1;
        }
      }
      // END SUBSYSTEM: src/surfaces3d.js
