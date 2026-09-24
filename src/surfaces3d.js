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
      };
      const SURFACE_NOISE = `
        float cityHash( vec2 p ) {
          vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
          p3 += dot( p3, p3.yzx + 33.33 );
          return fract( ( p3.x + p3.y ) * p3.z );
        }
        float cityNoise( vec2 p ) {
          vec2 i = floor( p ), f = fract( p );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( cityHash( i ), cityHash( i + vec2( 1.0, 0.0 ) ), f.x ),
                      mix( cityHash( i + vec2( 0.0, 1.0 ) ), cityHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
        }`;
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
        grass = max( mix( vec3( dot( grass, vec3( 0.2126, 0.7152, 0.0722 ) ) ), grass, 1.3 ) * 0.88, 0.0 );
        diffuseColor.rgb = mix( mix( mix( groundBase * ( 0.94 + 0.12 * grain ), paving, paveMask ), asphalt, roadMask ), grass, grassMask );
        // Rain: everything darkens as it soaks; low spots in the tarmac hold water.
        float puddle = smoothstep( 0.6, 0.66, cityNoise( gp * 0.017 + 41.0 ) + grainA * 0.05 ) * roadMask * smoothstep( 0.2, 0.8, cityWet );
        diffuseColor.rgb *= 1.0 - 0.3 * cityWet - 0.35 * puddle;`;
      const GROUND_ROUGHNESS = `
        roughnessFactor = mix( 0.92, mix( 0.8 + 0.14 * grain, 0.62, tarPatch ), roadMask );
        roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.45, cityWet );
        roughnessFactor = mix( roughnessFactor, 0.05, puddle );`;
      const GROUND_NORMAL = `
        {
          float e = 0.3, h0 = cityNoise( gp * 3.1 );
          vec2 slope = vec2( cityNoise( ( gp + vec2( e, 0.0 ) ) * 3.1 ) - h0, cityNoise( ( gp + vec2( 0.0, e ) ) * 3.1 ) - h0 ) / e;
          float bump = ( roadMask * 0.12 + paveMask * 0.06 ) * ( 1.0 - puddle ) * detailFade;
          vec3 worldNormal = normalize( vec3( -slope.x * bump, 1.0, -slope.y * bump ) );
          normal = normalize( ( viewMatrix * vec4( worldNormal, 0.0 ) ).xyz );
        }`;
      const groundTexel = { value: new Three.Vector2(1 / terrain.width, 1 / terrain.height) };
      // Hills carry their colour in vertex colours, so their detail goes in after
      // those are applied (`colorChunk`), the flat sheets' straight after the map.
      function groundDetailPatch(shader, texel = groundTexel, colorChunk = '#include <map_fragment>') {
        cityMaterialPatch(shader);
        shader.uniforms.cityGroundTexel = texel;
        const hill = colorChunk !== '#include <map_fragment>' ? '#define CITY_HILL\n' : '';
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + hill + 'uniform vec2 cityGroundTexel;\n' + SURFACE_NOISE)
          .replace(colorChunk, colorChunk + '\n' + GROUND_ALBEDO)
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
