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
        float dry = smoothstep( 0.55, 0.8, cityNoise( gp * 0.035 + 5.0 ) );
        vec3 grass = groundBase * ( 0.78 + 0.44 * cityNoise( gp * 0.35 ) ) * mix( vec3( 1.0 ), vec3( 1.14, 1.06, 0.8 ), dry );
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
      function groundDetailPatch(shader) {
        cityMaterialPatch(shader);
        shader.uniforms.cityGroundTexel = groundTexel;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec2 cityGroundTexel;\n' + SURFACE_NOISE)
          .replace('#include <map_fragment>', '#include <map_fragment>\n' + GROUND_ALBEDO)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + GROUND_ROUGHNESS)
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = 0.0;')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GROUND_NORMAL);
      }
      groundMesh.material.onBeforeCompile = groundDetailPatch;
      groundMesh.material.customProgramCacheKey = () => 'city-ground';
      // ---- Wind in the foliage -----------------------------------------------------------------
      const SWAY_VERTEX = `
        {
          vec4 swayWorld = modelMatrix * vec4( transformed, 1.0 );
          float lift = smoothstep( 8.0, 42.0, swayWorld.y );
          float phase = cityWindTime * 1.25 + swayWorld.x * 0.021 + swayWorld.z * 0.017;
          transformed.x += ( sin( phase ) + 0.4 * sin( phase * 2.7 + 1.3 ) ) * lift * cityWindAmp;
          transformed.z += cos( phase * 0.8 + 0.7 ) * lift * cityWindAmp * 0.6;
        }`;
      function foliagePatch(shader) {
        cityMaterialPatch(shader);
        Object.assign(shader.uniforms, surfaceUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float cityWindTime;\nuniform float cityWindAmp;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_VERTEX);
      }
      for (const m of [...leafMats, blossomMat, palmFrondMaterial]) {
        m.onBeforeCompile = foliagePatch;
        m.customProgramCacheKey = () => 'city-foliage';
      }
      function updateSurfaces(deltaSeconds) {
        surfaceUniforms.cityWindTime.value += deltaSeconds * (1 + weather.wind * 1.5);
        surfaceUniforms.cityWindAmp.value = 0.35 + weather.wind * 1.3 + weather.rain * 0.4;
      }
      // END SUBSYSTEM: src/surfaces3d.js
