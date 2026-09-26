      // BEGIN SUBSYSTEM: src/surfaces3d.js — Procedural surface detail
      /**
       * Procedural surface detail
       * Source: src/surfaces3d.js
       * Scope: createCityRenderer() closure (included after the city is built, before the vehicles).
       *
       * Patches the ground sheets' materials (the city sheet, the county, Monarch
       * Isle, Sunset Pier and Fort Sentinel tiles, the range's hills) with the
       * ground materials of ground-shader3d.js, fed by ground-data3d.js: the
       * surfaces are drawn in world space at the screen's resolution (asphalt,
       * kerbs, paving by district, lawns, gravel, sand, the road markings and
       * the street furniture in the road), so the ground stays sharp at close
       * zoom although the painted sheets are 1.6 to 2.8 units a texel.
       *
       * The wet look rides on top (surfaces3d.js WET ROADS in ground-shader3d.js,
       * lighting3d.js WET SURFACES): damp everywhere, mirror-smooth in the
       * puddles, so the sky, lamp pools and headlights shine in them.
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
      // SURFACE_NOISE and RAIN_RINGS are shared GLSL (lighting3d.js, WET SURFACES);
      // GROUND_PARS, GROUND_SHEET_PARS, GROUND_ALBEDO, GROUND_MARKS,
      // GROUND_ROUGHNESS and GROUND_NORMAL are the ground materials (ground-shader3d.js).
      // @include src/ground-shader3d.js
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
      /**
       * GROUND MATERIAL UNIFORMS
       * Shared: the detail layers, the tier's detail level (0 LOW .. 3 ULTRA), the
       * marks. Per sheet: its texel and world size, its carriageway field (a 1 x 1
       * stand-in where it has none: every sampler the shader declares must be
       * bound to a texture of its own type) and its default paving style.
       */
      const groundShared = {
        cityDetail: { value: groundDetail },
        cityGroundDetail: { value: 2 },
        cityMarkIndex: { value: groundMarks.index },
        cityMarkData: { value: groundMarks.data },
        cityMarkGrid: { value: groundMarks.grid },
        cityMarkRows: { value: groundMarks.rows },
      };
      const noFieldDist = new Three.DataTexture(new Uint16Array([Three.DataUtils.toHalfFloat(99)]), 1, 1, Three.RedFormat, Three.HalfFloatType),
        noFieldInfo = new Three.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      noFieldDist.needsUpdate = noFieldInfo.needsUpdate = true;
      function groundSheetUniforms(width, height, texelW, texelH, field, style) {
        return {
          cityGroundTexel: { value: new Three.Vector2(1 / texelW, 1 / texelH) },
          cityGroundSize: { value: new Three.Vector2(width, height) },
          cityFieldDist: { value: field ? field.dist : noFieldDist },
          cityFieldInfo: { value: field ? field.info : noFieldInfo },
          cityFieldRect: { value: field ? field.rect : new Three.Vector4(0, 0, 1, 1) },
          cityFieldInfoSize: { value: field ? new Three.Vector2(field.info.image.width, field.info.image.height) : new Three.Vector2(1, 1) },
          cityFieldOn: { value: field ? 1 : 0 },
          cityStyleDefault: { value: style },
        };
      }
      // Hills carry their colour in vertex colours, so their detail goes in after
      // those are applied (`colorChunk`), the flat sheets' straight after the map.
      function groundDetailPatch(shader, sheet, colorChunk = '#include <map_fragment>') {
        cityMaterialPatch(shader);
        Object.assign(shader.uniforms, groundShared, sheet);
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
              RAIN_RINGS +
              GROUND_PARS,
          )
          .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n' + GROUND_SHEET_PARS)
          .replace(colorChunk, colorChunk + '\n' + GROUND_ALBEDO.replace('GROUND_MARKS_HERE', GROUND_MARKS))
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + GROUND_WET_LIGHT)
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + GROUND_WET_OUTPUT)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + GROUND_ROUGHNESS)
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = gMetal;')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GROUND_NORMAL);
      }
      const citySheet = groundSheetUniforms(CITY_WIDTH, CITY_HEIGHT, terrain.width, terrain.height, cityField, GROUND_STYLE.city);
      groundMesh.material.onBeforeCompile = (shader) => groundDetailPatch(shader, citySheet);
      groundMesh.material.customProgramCacheKey = () => 'city-ground';
      for (const m of countyGroundMaterials) {
        const entry = countyTileTextures.find((e) => e.texture === m.map),
          tile = entry && entry.tile,
          chunk = m.vertexColors ? '#include <color_fragment>' : '#include <map_fragment>';
        let field = null,
          style = GROUND_STYLE.docks;
        if (tile && tile.x === MONARCH_TILE.x && tile.y === MONARCH_TILE.y) {
          field = monarchField;
          style = GROUND_STYLE.monarch;
        } else if (tile && tile.x >= 0 && tile.y >= 0) {
          field = countyField;
          style = GROUND_STYLE.county;
        } else if (tile && tile.y < CITY_TOP) style = GROUND_STYLE.palmKeys; // Sunset Pier's resort paving
        const image = m.map ? m.map.image : { width: 1, height: 1 },
          sheet = groundSheetUniforms(tile ? tile.w : 1, tile ? tile.h : 1, image.width, image.height, field, style);
        m.onBeforeCompile = (shader) => groundDetailPatch(shader, sheet, chunk);
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
        // The ground materials' detail level: LOW 0 (the cheap path), MEDIUM 1,
        // HIGH 2, ULTRA 3.
        const tierName = (activeTier || graphicsTier()).name;
        groundShared.cityGroundDetail.value = tierName === 'LOW' ? 0 : tierName === 'MEDIUM' ? 1 : tierName === 'HIGH' ? 2 : 3;
        updateGrassTufts();
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
