      // Lighting 3D sun path, sky dome and environment map (updateSunPath, refreshEnvironment) and lamp textures.
      // ---- Sun path ----------------------------------------------------------------------
      // Unit vector towards the sun (or moon), shared with the shadow fit, water and sky.
      const sunDirection = new Three.Vector3(-0.56, 0.62, -0.55).normalize(),
        MOON_DIRECTION = new Three.Vector3(-0.42, 0.78, -0.46).normalize(),
        sunScratch = new Three.Vector3();
      function dayFraction() {
        return ((worldMinutes % 1440) / 60 - 5.66) / 14.17;
      }
      function updateSunPath() {
        const t = dayFraction(),
          arc = Math.sin(clamp(t, 0, 1) * Math.PI);
        // East (t 0) through north-north-west at noon to west (t 1); the noon sun
        // leans to the west-north-west, where the old fixed light stood.
        const azimuth = -Math.PI * clamp(t, -0.05, 1.05) - 0.95 * arc,
          // Never flatter than ~15 degrees for shadows, so dusk streets stay readable.
          elevation = 0.27 + (1.02 - 0.27) * Math.pow(arc, 0.8);
        sunScratch.set(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation));
        // Hand over to the moon through twilight.
        const moon = clamp(1 - daylight() / 0.12, 0, 1);
        sunDirection.copy(sunScratch).lerp(MOON_DIRECTION, moon * moon * (3 - 2 * moon)).normalize();
      }
      // ---- Procedural sky ----------------------------------------------------------------
      /**
       * One sky shader serves both the dome behind the flight camera and the scene
       * that PMREM filters into the environment map. Colours are scene-linear.
       */
      const skyUniforms = {
        uZenith: { value: new Three.Color('#2f5f9e') },
        uHorizon: { value: new Three.Color('#a9c4dc') },
        uGround: { value: new Three.Color('#3a3f45') },
        uSunDir: { value: sunDirection },
        uSunColor: { value: new Three.Color('#fff2d6') },
        uGlow: { value: new Three.Color('#ffd7a8') },
        uNight: { value: 0 },
        uMoonDir: { value: MOON_DIRECTION },
        uStars: { value: 0 },
      };
      function makeSkyMaterial(stars) {
        return new Three.ShaderMaterial({
          uniforms: skyUniforms,
          side: Three.BackSide,
          depthWrite: false,
          depthTest: stars,
          fog: false,
          defines: stars ? { SKY_STARS: 1 } : {},
          vertexShader: `
            varying vec3 vDir;
            void main() {
              vDir = normalize( position );
              vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
              gl_Position = p.xyww;
            }`,
          fragmentShader: `
            varying vec3 vDir;
            uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor, uGlow, uMoonDir;
            uniform float uNight, uStars;
            float hash13( vec3 p ) {
              p = fract( p * 0.1031 );
              p += dot( p, p.zyx + 31.32 );
              return fract( ( p.x + p.y ) * p.z );
            }
            void main() {
              vec3 d = normalize( vDir );
              float up = d.y;
              // Gradient: horizon band, zenith above, a dim ground below.
              vec3 sky = mix( uHorizon, uZenith, pow( clamp( up, 0.0, 1.0 ), 0.55 ) );
              sky = mix( sky, uGround, smoothstep( 0.0, -0.18, up ) );
              // Sun glow: a broad halo that warms the horizon, and the disc itself.
              float cosSun = dot( d, uSunDir );
              sky += uGlow * pow( max( cosSun, 0.0 ), 8.0 ) * 0.55 * ( 1.0 - uNight );
              #ifdef SKY_STARS
                // The disc only on the dome: in the environment map the sun's own
                // specular highlight already comes from the directional light.
                sky += uSunColor * smoothstep( 0.9994, 0.9998, cosSun ) * 30.0 * ( 1.0 - uNight );
                // Stars: sparse hashed cells, twinkle-free, only above the horizon.
                if ( uStars > 0.01 && up > 0.0 ) {
                  vec3 cell = floor( d * 420.0 );
                  float star = step( 0.9975, hash13( cell ) );
                  vec3 local = fract( d * 420.0 ) - 0.5;
                  star *= smoothstep( 0.35, 0.0, length( local ) ) * ( 0.4 + 0.6 * hash13( cell + 7.0 ) );
                  sky += vec3( 0.8, 0.85, 1.0 ) * star * uStars * 2.5 * smoothstep( 0.0, 0.25, up );
                }
                // Moon: a pale disc with a soft halo.
                float cosMoon = dot( d, uMoonDir );
                sky += vec3( 0.75, 0.8, 0.9 ) * ( smoothstep( 0.99965, 0.99985, cosMoon ) * 6.0 + pow( max( cosMoon, 0.0 ), 64.0 ) * 0.08 ) * uNight;
              #endif
              gl_FragColor = vec4( sky, 1.0 );
            }`,
        });
      }
      // The dome behind the flight view. It follows the camera and is only drawn in
      // the air; the street camera never sees the sky.
      const skyDome = new Three.Mesh(new Three.SphereGeometry(1, 32, 16), makeSkyMaterial(true));
      skyDome.frustumCulled = false;
      skyDome.renderOrder = -10;
      skyDome.visible = false;
      skyDome.name = 'sky dome';
      scene.add(skyDome);
      // Environment map: the same sky, blurred into PMREM mip levels.
      const envScene = new Three.Scene(),
        envSky = new Three.Mesh(new Three.SphereGeometry(100, 32, 16), makeSkyMaterial(false));
      envScene.add(envSky);
      const pmrem = new Three.PMREMGenerator(renderer);
      let envTarget = null,
        envSignature = '',
        envAge = Infinity;
      function refreshEnvironment(force) {
        // Rebuilding costs a few milliseconds of GPU time: only when the sky has
        // visibly changed, and not more than twice a second.
        const sig = [skyUniforms.uZenith.value, skyUniforms.uHorizon.value, skyUniforms.uGlow.value]
          .map((c) => c.getHexString())
          .join('') + Math.round(sunDirection.x * 20) + Math.round(sunDirection.z * 20) + Math.round(sunDirection.y * 20);
        if (!force && (sig === envSignature || envAge < 0.5)) return;
        envSignature = sig;
        envAge = 0;
        const previous = envTarget;
        envTarget = pmrem.fromScene(envScene, 0, 1, 1000);
        scene.environment = envTarget.texture;
        if (previous) previous.dispose();
      }
      // ---- Night light map ---------------------------------------------------------------
      /**
       * Pools of light over the city at LAMP_MAP_UNITS world units per texel,
       * painted additively: sodium street lamps, warm shop windows, neon spill.
       * Light is RGB in the map; the shader scales it by the night level, the
       * blackout contract's district power and height above the ground.
       */
      const LAMP_MAP_UNITS = 5,
        lampCanvas = document.createElement('canvas');
      lampCanvas.width = Math.ceil(CITY_WIDTH / LAMP_MAP_UNITS);
      lampCanvas.height = Math.ceil(CITY_HEIGHT / LAMP_MAP_UNITS);
      const lampTexture = new Three.CanvasTexture(lampCanvas);
      lampTexture.colorSpace = Three.SRGBColorSpace;
      lampTexture.generateMipmaps = false;
      // Row 0 of the canvas is the north edge, sampled at v = 0.
      lampTexture.flipY = false;
      lampTexture.minFilter = Three.LinearFilter;
      /* Monarch Isle (monarch.js) lies north-east of the city frame, so it has a
         map of its own over MONARCH_BOUNDS at the same scale: its lanterns, shop
         windows, sign spill and the pools its renderer files add to
         isleLightPools (the Palm House, the marina, villa drives, fountains). */
      const isleLampCanvas = document.createElement('canvas');
      isleLampCanvas.width = Math.ceil((MONARCH_BOUNDS.x1 - MONARCH_BOUNDS.x0) / LAMP_MAP_UNITS);
      isleLampCanvas.height = Math.ceil((MONARCH_BOUNDS.y1 - MONARCH_BOUNDS.y0) / LAMP_MAP_UNITS);
      const isleLampTexture = new Three.CanvasTexture(isleLampCanvas);
      isleLampTexture.colorSpace = Three.SRGBColorSpace;
      isleLampTexture.generateMipmaps = false;
      isleLampTexture.flipY = false;
      isleLampTexture.minFilter = Three.LinearFilter;
      // { x, y, r, color: [r, g, b] 0..255, strength }
      const isleLightPools = [];
      const cityLightUniforms = {
        cityIsleMap: { value: isleLampTexture },
        cityIsleRect: {
          value: new Three.Vector4(MONARCH_BOUNDS.x0, MONARCH_BOUNDS.y0, 1 / (MONARCH_BOUNDS.x1 - MONARCH_BOUNDS.x0), 1 / (MONARCH_BOUNDS.y1 - MONARCH_BOUNDS.y0)),
        },
        cityLampMap: { value: lampTexture },
        // (origin x, origin z, 1 / width, 1 / height) of the map in world units.
        cityLampRect: { value: new Three.Vector4(CITY_LEFT, CITY_TOP, 1 / CITY_WIDTH, 1 / CITY_HEIGHT) },
        cityLampPower: { value: 0 },
        // Street power per Northbank zone (north, middle, south) for the blackout job.
        cityZonePower: { value: new Three.Vector3(1, 1, 1) },
        cityRiverLeft: { value: RIVER.left },
        cityWet: { value: 0 },
        // Cutaway round the player (see CUTAWAY below): screen x, y and radius in
        // drawing-buffer pixels, then the player's view depth; and up to two
        // roof volumes that may be cut, each as (centre x, centre z, half length,
        // half width) and (cos, sin of its heading, bottom, top).
        cityCutaway: { value: new Three.Vector4(0, 0, 0, 0) },
        cityCutBoxA: { value: new Three.Vector4(0, 0, 0, 0) },
        cityCutSpanA: { value: new Three.Vector4(1, 0, 0, 0) },
        cityCutBoxB: { value: new Three.Vector4(0, 0, 0, 0) },
        cityCutSpanB: { value: new Three.Vector4(1, 0, 0, 0) },
      };
      /* Wet ground (surfaces3d.js, WET SURFACES below): how much of the wet look
         the tier draws (0 LOW darkening only, 1 MEDIUM the sheen, 2 HIGH / ULTRA
         puddles and reflections), whether the wet reflections pass is running
         this frame (the ground then marks itself in the HDR alpha, postfx3d.js),
         and the sky light the wet surface mirrors (scene-linear), all set by
         updateWeatherVisuals (weather3d.js). */
      const wetUniforms = {
        cityWetDetail: { value: 0 },
        cityReflectOut: { value: 0 },
        citySkyReflect: { value: new Three.Color(0, 0, 0) },
        // The view direction along the ground (lamp streaks run along it) and
        // how bright the lamp and neon streaks in the wet road are.
        citySheenDir: { value: new Three.Vector2(0, -1) },
        citySheenGain: { value: 0 },
      };
      /* Street lamps a car has knocked flat (damage3d.js): their pools are left out
         of the map until the lamp is stood up again, so no pool of light lies on
         the pavement with nothing above it. Keyed by the lamp's map position. */
      const lampLightOut = new Set();
      function lampLightSwitch(prop, on) {
        if (prop.kind !== 'lamp' && prop.kind !== 'lantern') return;
        const key = prop.x + ',' + prop.y;
        if (on === !lampLightOut.has(key)) return;
        if (on) lampLightOut.delete(key);
        else lampLightOut.add(key);
        paintLampLight({ x: prop.x + 6, y: prop.y + 6, r: LAMP_POOL_RADIUS + 8 });
      }
      // Monarch Isle's map (see isleLampCanvas): whole, or the pools touching `region`.
      function paintIsleLampLight(region = null) {
        const B = MONARCH_BOUNDS;
        if (region && (region.x + region.r < B.x0 || region.x - region.r > B.x1 || region.y + region.r < B.y0 || region.y - region.r > B.y1)) return;
        const g = isleLampCanvas.getContext('2d'),
          s = 1 / LAMP_MAP_UNITS;
        g.save();
        if (region) {
          g.beginPath();
          g.rect((region.x - region.r - B.x0) * s, (region.y - region.r - B.y0) * s, region.r * 2 * s, region.r * 2 * s);
          g.clip();
        }
        g.fillStyle = '#000';
        g.fillRect(0, 0, isleLampCanvas.width, isleLampCanvas.height);
        g.globalCompositeOperation = 'lighter';
        const pool = (x, y, radius, rgb, stops) => {
          if (x < B.x0 - radius || x > B.x1 + radius || y < B.y0 - radius || y > B.y1 + radius) return;
          if (region && (Math.abs(x - region.x) > region.r + radius || Math.abs(y - region.y) > region.r + radius)) return;
          const px = (x - B.x0) * s,
            py = (y - B.y0) * s,
            pr = radius * s,
            grad = g.createRadialGradient(px, py, 0, px, py, pr),
            c = rgb.map(Math.round).join(',');
          for (const [at, a] of stops) grad.addColorStop(at, `rgba(${c},${a})`);
          g.fillStyle = grad;
          g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        };
        const soft = (strength) => [
          [0, strength],
          [0.35, strength * 0.55],
          [1, 0],
        ];
        // Lanterns: three warm heads each, a pool like a city lamp's but gentler
        // (the lanterns stand closer together than the city's lamps).
        for (const l of monarchLamps)
          if (!lampLightOut.has(l.x + ',' + l.y))
            pool(l.x, l.y, LAMP_POOL_RADIUS * 0.9, LAMP_WARM, [
              [0, 0.62],
              [0.16, 0.46],
              [0.4, 0.24],
              [0.7, 0.09],
              [1, 0],
            ]);
        for (const b of buildings) if (b.monarch) for (const pane of b.shopPanes || []) pool(pane.cx, pane.face + 10, Math.max(22, pane.width * 0.8), [255, 214, 160], soft(0.45));
        for (const p of signLightPools) pool(p.x, p.y, p.r, [p.color[0] * 255, p.color[1] * 255, p.color[2] * 255], soft(p.strength));
        for (const p of isleLightPools) pool(p.x, p.y, p.r, p.color, soft(p.strength));
        g.globalCompositeOperation = 'source-over';
        g.restore();
        isleLampTexture.needsUpdate = true;
      }
      // Reach of a street lamp's pool on the ground (world units; ~19 m).
      const LAMP_POOL_RADIUS = 100,
        LAMP_SODIUM = [255, 164, 78],
        LAMP_LED = [196, 210, 244],
        LAMP_WARM = [255, 204, 146];
      // A lamp's colour by district, worked out once per lamp.
      function lampTint(lamp) {
        if (!lamp.lightTint) {
          const district = districtAt(lamp.x, lamp.y);
          lamp.lightTint = /IRONWORKS|OLD QUARTER|RECLAMATION|CRUISE|SOUTH BANK|AIRPORT/.test(district)
            ? LAMP_SODIUM
            : /FINANCIAL|MIDTOWN|EXCHANGE|BROADWAY/.test(district)
              ? LAMP_LED
              : LAMP_WARM;
        }
        return lamp.lightTint;
      }
      // Paints the whole map, or only the pools touching `region` ({x, y, r}).
      function paintLampLight(region = null) {
        const g = lampCanvas.getContext('2d'),
          s = 1 / LAMP_MAP_UNITS;
        g.save();
        if (region) {
          g.beginPath();
          g.rect((region.x - region.r - CITY_LEFT) * s, (region.y - region.r - CITY_TOP) * s, region.r * 2 * s, region.r * 2 * s);
          g.clip();
        }
        g.fillStyle = '#000';
        g.fillRect(0, 0, lampCanvas.width, lampCanvas.height);
        g.globalCompositeOperation = 'lighter';
        const pool = (x, y, radius, r, gr, b, strength) => {
          if (region && (Math.abs(x - region.x) > region.r + radius || Math.abs(y - region.y) > region.r + radius)) return;
          const px = (x - CITY_LEFT) * s,
            py = (y - CITY_TOP) * s,
            pr = radius * s,
            grad = g.createRadialGradient(px, py, 0, px, py, pr);
          grad.addColorStop(0, `rgba(${r},${gr},${b},${strength})`);
          grad.addColorStop(0.35, `rgba(${r},${gr},${b},${strength * 0.55})`);
          grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
          g.fillStyle = grad;
          g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        };
        /* Street lamps (render3d.js draws one post per entry of `lamps`); the
           lantern hangs 6 units out from the post. A real lamp's pool is a bright
           core under the head with a long, soft tail (inverse square over the
           head's height), wide enough that neighbouring lamps overlap and light
           the whole street and pavement rather than leaving dark gaps. Colour by
           district (lampTint): sodium orange in the docks and the Old Quarter,
           cool white LED in the financial core, warm white elsewhere. */
        const lampPool = (x, y, tint) => {
          if (region && (Math.abs(x - region.x) > region.r + LAMP_POOL_RADIUS || Math.abs(y - region.y) > region.r + LAMP_POOL_RADIUS)) return;
          const px = (x - CITY_LEFT) * s,
            py = (y - CITY_TOP) * s,
            pr = LAMP_POOL_RADIUS * s,
            grad = g.createRadialGradient(px, py, 0, px, py, pr),
            rgb = tint.join(',');
          // (A softer core than the old 62-unit pool: pale pavement under a
          // lamp head clipped to white and bloomed into a blob.)
          grad.addColorStop(0, `rgba(${rgb},0.78)`);
          grad.addColorStop(0.16, `rgba(${rgb},0.58)`);
          grad.addColorStop(0.4, `rgba(${rgb},0.3)`);
          grad.addColorStop(0.7, `rgba(${rgb},0.11)`);
          grad.addColorStop(1, `rgba(${rgb},0)`);
          g.fillStyle = grad;
          g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        };
        for (const l of lamps) if (!lampLightOut.has(l.x + ',' + l.y)) lampPool(l.x + 6, l.y + 6, lampTint(l));
        // Shop windows spill warm light across the pavement in front of them.
        for (const b of buildings)
          for (const pane of b.shopPanes || []) pool(pane.cx, pane.face + 10, Math.max(22, pane.width * 0.8), 255, 214, 160, 0.45);
        // South Coast Stadium's floodlights while a fixture is on (sports3d.js).
        for (const flood of stadiumFloodPools()) pool(flood.x, flood.y, flood.radius, 255, 248, 232, flood.strength);
        // Rooftop and street neon: tinted glows (their sprites carry the colour).
        for (const n of neonSigns) {
          const p = n.sprite.getWorldPosition(sunScratch);
          if (p.y > SHOP_FLOOR + 16) continue;
          const c = n.sprite.material.color;
          pool(p.x, p.z, 40, Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 0.35);
        }
        // Neon, lightboxes and lobby glass (signage3d.js): coloured pools on the pavement.
        for (const s of signLightPools)
          pool(s.x, s.y, s.r, Math.round(s.color[0] * 255), Math.round(s.color[1] * 255), Math.round(s.color[2] * 255), s.strength);
        g.globalCompositeOperation = 'source-over';
        g.restore();
        lampTexture.needsUpdate = true;
        paintIsleLampLight(region);
      }
      /**
       * MATERIAL PATCH
       * Installed on MeshStandardMaterial (and so MeshPhysicalMaterial) as the
       * default onBeforeCompile, so every lit surface in the city shares it without
       * any per-material setup. It adds a world-position varying and, after the
       * regular lights, the night light map. A material with its own
       * onBeforeCompile can call cityMaterialPatch(shader) first to keep it.
       */
      const CITY_WORLD_VERTEX = `
        vec4 cityWorld = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          cityWorld = batchingMatrix * cityWorld;
        #endif
        #ifdef USE_INSTANCING
          cityWorld = instanceMatrix * cityWorld;
        #endif
        vCityWorld = ( modelMatrix * cityWorld ).xyz;`;
      /**
       * WET SURFACES (shared GLSL)
       * Value noise, raindrop rings and the wet-road pattern, shared by the ground
       * shader (surfaces3d.js), the wet-street light streaks (signage3d.js) and the
       * wet reflections pass (postfx3d.js), so all three agree on where the water
       * stands. `weather.wet` (the `cityWet` uniform) rises while it rains and
       * falls over a few minutes after; the pattern turns that single number into
       * a road that soaks and dries in patches:
       *
       *   cityWetLow(p)       0 on a crown .. 1 in the deepest dip (a few metres
       *                       across), where standing water collects first
       *   cityWetFilm(...)    the damp film: each spot has its own drying order
       *                       (broad patches, crowns first, dips and gutters last),
       *                       so a drying street goes patchy from the edges in
       *   cityPuddle(...)     standing water: fills the dips as it rains, shrinks
       *                       back to their middles as it dries
       */
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
        }
        float cityWetLow( vec2 p ) {
          return cityNoise( p * 0.017 + 41.0 ) * 0.7 + cityNoise( p * 0.052 + 7.0 ) * 0.3;
        }
        float cityWetFilm( vec2 p, float low, float extra, float wet ) {
          float order = ( cityNoise( p * 0.011 + 13.0 ) * 0.62 + cityNoise( p * 0.043 + 5.0 ) * 0.38 ) * 0.8 - low * 0.35 - extra + 0.28;
          return smoothstep( order - 0.07, order + 0.07, wet * 1.3 - 0.1 );
        }
        float cityPuddle( float depth, float wet ) {
          float level = 0.97 - 0.28 * smoothstep( 0.25, 0.75, wet ) - 0.06 * smoothstep( 0.75, 1.0, wet );
          return smoothstep( level, level + 0.045, depth );
        }`;
      // Expanding rings from raindrops on still water, as a normal tilt (x, z):
      // one drop per `cell` square, each at a random spot and time.
      const RAIN_RINGS = `
        vec2 cityRainRings( vec2 p, float t, float cell ) {
          vec2 c = floor( p / cell ), f = p / cell - c;
          float h = cityHash( c );
          vec2 centre = vec2( cityHash( c + 3.1 ), cityHash( c + 7.7 ) ) * 0.6 + 0.2;
          float life = fract( t * 1.3 + h );
          vec2 d = ( f - centre ) * cell;
          float dist = length( d );
          float w = dist - life * cell * 0.45;
          float slope = -6.0 * w * exp( -w * w * 3.0 ) * ( 1.0 - life );
          return d / max( dist, 1e-3 ) * slope;
        }
        // Three overlapping layers of drops, as a tilt for a puddle's normal.
        vec2 cityPuddleRipples( vec2 p, float t ) {
          return ( cityRainRings( p, t, 9.0 ) + cityRainRings( p + 3.7, t * 1.13 + 0.5, 7.0 ) + cityRainRings( p + vec2( 5.1, 1.9 ), t * 0.91 + 0.25, 11.0 ) ) * 0.3;
        }`;
      // The drive light map (DRIVE LIGHT MAP below) stores road levels offset so
      // that 0, the clear value, means "no beam".
      const DRIVE_LEVEL_OFFSET = 600;
      /**
       * LOW BEAM
       * The photometric pattern of a pair of dipped headlights (right-hand
       * traffic), shared by the lit materials (CAR LAMPS in
       * lighting3d-vehicle-lights.js), the rain and the drive light map's beam
       * texture, so near and far cars throw the same light. `t` and `v` are the
       * tangents of the angle to the kerb side and above the lamps; the result is
       * the intensity relative to the hot spot:
       *
       *   - a flat-topped fan, aimed a touch to the kerb and wider on that side,
       *     over a faint wide flood
       *   - a sharp cut-off just under the horizon on the oncoming side that
       *     rises 15 degrees from the elbow on the kerb side (so the beam reaches
       *     farther along the kerb and lights the pavement and signs there), with
       *     3% of glare light above it
       *   - the hot spot just under the cut-off, falling off towards the road
       *     in front of the bumper (steep angles), so the road is lit from about
       *     two metres out to fifty and the far part fades rather than ends
       *
       * Keep lowBeamIntensity() below and the GLSL in step.
       */
      const CAR_LAMP_SLOTS = 12;
      const CITY_LOW_BEAM = `
        float cityLowBeam( float t, float v ) {
          float u = t - 0.03;
          float spread = u > 0.0 ? 0.46 : 0.36;
          float q = u * u / ( spread * spread );
          float lateral = 0.72 * exp( -q * q ) + 0.28 * exp( -0.35 * q );
          float cut = -0.011 + 0.27 * clamp( t + 0.02, 0.0, 0.12 );
          float glare = smoothstep( cut - 0.005, cut + 0.005, v );
          float down = max( -v, 0.0 );
          float vertical = down < 0.02 ? 1.0 : exp2( -2.3 * log2( down * 50.0 ) );
          float hot = 1.0 + 0.7 * exp( -( ( v + 0.02 ) * ( v + 0.02 ) ) * 6944.0 - u * u * 100.0 );
          return lateral * vertical * hot * ( 1.0 - 0.97 * glare );
        }`;
      function lowBeamIntensity(t, v) {
        const u = t - 0.03,
          spread = u > 0 ? 0.46 : 0.36,
          q = (u * u) / (spread * spread),
          lateral = 0.72 * Math.exp(-q * q) + 0.28 * Math.exp(-0.35 * q),
          cut = -0.011 + 0.27 * clamp(t + 0.02, 0, 0.12),
          glare = Three.MathUtils.smoothstep(v, cut - 0.005, cut + 0.005),
          down = Math.max(-v, 0),
          vertical = down < 0.02 ? 1 : Math.pow(down * 50, -2.3),
          hot = 1 + 0.7 * Math.exp(-(v + 0.02) * (v + 0.02) * 6944 - u * u * 100);
        return lateral * vertical * hot * (1 - 0.97 * glare);
      }
      /**
       * CAR LAMP FRAME, FLOOD AND HORIZON
       * A CAR LAMPS slot's beam runs in its body frame (HEADLIGHT AIM,
       * terrain-headlights.js): `cityLampFrame` rebuilds the forward and kerb-side
       * axes from B (the heading) and C (sin pitch, sin roll, cos roll); up is
       * cross( kerb, aim ). A slot whose C.w has bit 2 set is a light bar
       * (`cityFloodBeam`: wide, level, a soft top and a spill onto the ground,
       * no cut-off), bit 1 reads the TERRAIN HORIZON. The horizon tables sit in a
       * strip under the BEAM SHADOWS mask in the same texture (cityBeamShadow),
       * so lit materials take no extra sampler: `angles` texels per slot across,
       * one row per distance step (HEADLIGHT_HORIZON). `cityHorizonAt` returns
       * the horizon's tangent and the ground's height under a point (both from
       * the lamp point); keep it in step with headlightHorizonLit().
       */
      const BEAM_MASK_WIDTH = 512,
        BEAM_MASK_HEIGHT = 384,
        BEAM_HORIZON_TOP = BEAM_MASK_HEIGHT + 2,
        BEAM_TEXTURE_HEIGHT = BEAM_HORIZON_TOP + HEADLIGHT_HORIZON.rows;
      const CITY_LAMP_FRAME = `
        void cityLampFrame( vec4 b, vec4 c, out vec3 aim, out vec3 kerb ) {
          float cp = sqrt( max( 1.0 - c.x * c.x, 0.0 ) );
          aim = vec3( cp * b.x - c.x * c.y * b.y, c.x * c.z, cp * b.y + c.x * c.y * b.x );
          kerb = vec3( -c.z * b.y, -c.y, c.z * b.x );
        }
        float cityFloodBeam( float t, float v ) {
          float q = t * t * 2.0;
          float lateral = 0.85 * exp( -q * q ) + 0.15 * exp( -t * t * 2.0 );
          float core = exp( -( v + 0.025 ) * ( v + 0.025 ) * 400.0 );
          float spill = v < 0.0 ? 0.3 * exp( -( v + 0.12 ) * ( v + 0.12 ) * 30.0 ) : 0.0;
          return lateral * ( core + spill );
        }
        vec2 cityHorizonAt( float slot, vec3 d, vec2 heading ) {
          float dist = length( d.xz );
          float bearing = atan( dot( d.xz, vec2( -heading.y, heading.x ) ), dot( d.xz, heading ) );
          float a = ( clamp( bearing / ${HEADLIGHT_HORIZON.halfAngle.toFixed(3)}, -1.0, 1.0 ) * 0.5 + 0.5 ) * ${(HEADLIGHT_HORIZON.angles - 1).toFixed(1)};
          float row = clamp( dist / ${HEADLIGHT_HORIZON.step.toFixed(1)} - 1.0, 0.0, ${(HEADLIGHT_HORIZON.rows - 1).toFixed(1)} );
          vec2 uv = vec2( ( slot * ${HEADLIGHT_HORIZON.angles.toFixed(1)} + a + 0.5 ) / ${BEAM_MASK_WIDTH.toFixed(1)}, ( ${BEAM_HORIZON_TOP.toFixed(1)} + row + 0.5 ) / ${BEAM_TEXTURE_HEIGHT.toFixed(1)} );
          return textureLod( cityBeamShadow, uv, 0.0 ).rg;
        }
        // 0 where the ground between the lamp and the point hides it, 1 in the clear.
        float cityHorizonShade( float slot, vec3 d, vec2 heading ) {
          return smoothstep( -4.0, 2.0, d.y - cityHorizonAt( slot, d, heading ).x * length( d.xz ) );
        }`;
      const CITY_LIGHT_PARS = `
        varying vec3 vCityWorld;
        uniform sampler2D cityLampMap;
        uniform vec4 cityLampRect;
        uniform float cityLampPower;
        uniform sampler2D cityIsleMap;
        uniform vec4 cityIsleRect;
        uniform vec3 cityZonePower;
        uniform float cityRiverLeft;
        uniform float cityWet;
        // Street power at this fragment (the blackout job); signs dim with it too.
        float cityPower() {
          return vCityWorld.x > cityRiverLeft || vCityWorld.x < -500.0 ? 1.0
            : vCityWorld.z < 1450.0 ? cityZonePower.x : vCityWorld.z < 2650.0 ? cityZonePower.y : cityZonePower.z;
        }
        uniform sampler2D cityDriveMap;
        uniform vec4 cityDriveRect;
        uniform float cityDrivePower;
        // The nearest cars' low beams (CAR LAMPS, lighting3d-vehicle-lights.js):
        // A = lamp centre (world) and strength, B = heading (x, z), half the lamp
        // spacing and the lamps' height over the road.
        uniform vec4 cityCarLampA[ ${CAR_LAMP_SLOTS} ];
        uniform vec4 cityCarLampB[ ${CAR_LAMP_SLOTS} ];
        // C = the body's sin pitch, sin roll, cos roll and the slot's mode (CAR LAMP FRAME).
        uniform vec4 cityCarLampC[ ${CAR_LAMP_SLOTS} ];
        uniform float cityCarLampCount;
        ${CITY_LOW_BEAM}
        // The player's beams' shadow mask (BEAM SHADOWS): r darkness, g the
        // occluder's top as a tangent above the lamps (level frame); the terrain
        // horizon strip under it.
        uniform sampler2D cityBeamShadow;
        uniform float cityBeamShadowOn;
        ${CITY_LAMP_FRAME}
        float cityBeamShade( float ahead, float side, float rise ) {
          vec2 uv = vec2( ahead / 440.0, 0.5 + side / 360.0 );
          if ( uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) return 1.0;
          uv.y *= ${(BEAM_MASK_HEIGHT / BEAM_TEXTURE_HEIGHT).toFixed(6)};
          vec4 mask = textureLod( cityBeamShadow, uv, 0.0 );
          return 1.0 - mask.r * ( 1.0 - smoothstep( mask.g - 0.012, mask.g + 0.012, rise ) );
        }
        // Street lamps (the painted map) at this fragment. Lamps hang ~33 units
        // up: full light at street level; ground-facing surfaces (roofs, awnings)
        // stop catching it by ~40 units, walls take the spill higher up the facade.
        // \`up\` is how much the surface faces the sky (0 wall, 1 roof).
        vec3 cityLampLight( float up ) {
          if ( cityLampPower < 0.001 ) return vec3( 0.0 );
          float height = 1.0 - smoothstep( mix( 30.0, 8.0, up ), mix( 78.0, 42.0, up ), vCityWorld.y );
          vec2 uv = ( vCityWorld.xz - cityLampRect.xy ) * cityLampRect.zw;
          if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) {
            // Monarch Isle's own map, beyond the city frame.
            vec2 iv = ( vCityWorld.xz - cityIsleRect.xy ) * cityIsleRect.zw;
            if ( iv.x < 0.0 || iv.y < 0.0 || iv.x > 1.0 || iv.y > 1.0 ) return vec3( 0.0 );
            return texture2D( cityIsleMap, iv ).rgb * ( cityLampPower * height );
          }
          float zone = cityPower();
          return texture2D( cityLampMap, uv ).rgb * ( cityLampPower * zone * height );
        }
        // Vehicle head and tail lights (the drive light map, redrawn every frame
        // round the view): the road, kerbs, cars, people and walls ahead of a car.
        vec3 cityDriveLight() {
          vec2 uv = ( vCityWorld.xz - cityDriveRect.xy ) * cityDriveRect.zw;
          if ( cityDrivePower < 0.001 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) return vec3( 0.0 );
          vec4 drive = texture2D( cityDriveMap, uv );
          // Alpha: the road level the beam lies on, plus DRIVE_LEVEL_OFFSET.
          float above = vCityWorld.y - ( drive.a - ${DRIVE_LEVEL_OFFSET.toFixed(1)} );
          float height = ( 1.0 - smoothstep( 8.0, 30.0, above ) ) * step( -6.0, above );
          return drive.rgb * ( cityDrivePower * height );
        }
        uniform vec4 cityCutaway, cityCutBoxA, cityCutSpanA, cityCutBoxB, cityCutSpanB;
        float cityBayer2( vec2 a ) { return mod( 2.0 * a.x + 3.0 * a.y, 4.0 ); }
        bool cityInsideCut( vec4 box, vec4 span ) {
          if ( box.z <= 0.0 || vCityWorld.y < span.z || vCityWorld.y > span.w ) return false;
          vec2 d = vCityWorld.xz - box.xy;
          vec2 local = vec2( d.x * span.x + d.y * span.y, d.y * span.x - d.x * span.y );
          return abs( local.x ) < box.z && abs( local.y ) < box.w;
        }
        void cityCutawayClip() {
          if ( cityCutaway.z <= 0.0 || -vViewPosition.z > cityCutaway.w ) return;
          float reach = length( gl_FragCoord.xy - cityCutaway.xy ) / cityCutaway.z;
          if ( reach >= 1.0 ) return;
          if ( !cityInsideCut( cityCutBoxA, cityCutSpanA ) && !cityInsideCut( cityCutBoxB, cityCutSpanB ) ) return;
          float cut = 1.0 - smoothstep( 0.62, 1.0, reach );
          vec2 cell = mod( floor( gl_FragCoord.xy ), 4.0 );
          float threshold = ( cityBayer2( mod( cell, 2.0 ) ) * 4.0 + cityBayer2( floor( cell * 0.5 ) ) + 0.5 ) / 16.0;
          if ( threshold < cut ) discard;
        }`;
      const CITY_LIGHT_APPLY = `
        {
          vec3 upView = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
          float up = max( dot( normal, upView ), 0.0 );
          vec3 lampLight = cityLampLight( up ) + cityDriveLight();
          float facing = 0.42 + 0.58 * up;
          reflectedLight.directDiffuse += lampLight * facing * material.diffuseColor;
          // Glossy surfaces (wet tarmac, paint, glass) catch a sheen of it too.
          reflectedLight.directSpecular += lampLight * facing * 0.5 * ( 1.0 - material.roughness ) * ( 1.0 - material.roughness );
        }
        #ifdef RE_Direct
        // The nearest cars' low beams as real lights (CAR LAMPS): the pattern's
        // intensity over the distance squared, through the material's own BRDF,
        // so kerbs, walls, parked cars and people facing a car are lit and wet or
        // glossy surfaces show its glare. A surface square to the beam would take
        // many times the light of the road it grazes; the soft cap keeps a wall or
        // a pedestrian in the beam bright without burning out.
        // Headlights graze the road (a degree or two at 30 m): against the
        // ground's fine bump the cosine swung from zero to several times its
        // mean from one pixel to the next, and every lit street turned to salt
        // and pepper. The lamps light the surface's own (unbumped) normal.
        vec3 lampNormal = nonPerturbedNormal;
        // Walls, kerb faces and car sides grazed by a beam from far down the
        // street take a lower cap than faces turned to the car (see below).
        float lampUp = max( dot( lampNormal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ), 0.0 );
        for ( int i = 0; i < ${CAR_LAMP_SLOTS}; i ++ ) {
          if ( float( i ) >= cityCarLampCount ) break;
          vec4 lampA = cityCarLampA[ i ], lampB = cityCarLampB[ i ], lampC = cityCarLampC[ i ];
          vec3 toLamp = lampA.xyz - vCityWorld;
          // The pattern in the body's frame (CAR LAMP FRAME): on a slope the beam
          // aims where the car points, so a constant grade looks like a level road.
          vec3 aim, kerb;
          cityLampFrame( lampB, lampC, aim, kerb );
          float ahead = -dot( toLamp, aim );
          if ( ahead < 2.0 || ahead > 470.0 ) continue;
          float across = -dot( toLamp, kerb );
          float side = sign( across ) * max( abs( across ) - lampB.z, 0.0 );
          if ( abs( side ) > ahead * 1.5 + 12.0 ) continue;
          float rise = -dot( toLamp, cross( kerb, aim ) );
          float beam = ( lampC.w > 1.5 ? cityFloodBeam( side / ahead, rise / ahead ) : cityLowBeam( side / ahead, rise / ahead ) ) * smoothstep( 6.0, 26.0, ahead );
          if ( i == 0 && cityBeamShadowOn > 0.5 ) {
            // The mask is laid out level along the heading.
            float levelAhead = max( -dot( toLamp.xz, lampB.xy ), 1.0 );
            beam *= cityBeamShade( levelAhead, -dot( toLamp.xz, vec2( -lampB.y, lampB.x ) ), -toLamp.y / levelAhead );
          }
          // No light through a hill (TERRAIN HORIZON).
          bool onRange = mod( lampC.w, 2.0 ) > 0.5;
          if ( onRange ) beam *= cityHorizonShade( float( i ), -toLamp, lampB.xy );
          // Units to metres: the pattern's strength is in metres squared. The
          // beam's useful reach ends by ~55 m (a kerb face grazed from far down
          // the street otherwise glowed as a line the length of the block).
          float metres2 = dot( toLamp, toLamp ) * 0.015625;
          float irradiance = lampA.w * beam / max( metres2, 0.3 ) * ( 1.0 - smoothstep( 676.0, 3364.0, metres2 ) );
          if ( irradiance < 0.003 ) continue;
          directLight.direction = normalize( ( viewMatrix * vec4( toLamp, 0.0 ) ).xyz );
          float nl = saturate( dot( lampNormal, directLight.direction ) );
          if ( nl <= 0.0 ) continue;
          float cap = 5.0 * mix( 0.25 + 0.75 * smoothstep( 0.0, 0.7, nl ), 1.0, lampUp );
          // On the range a hillside or tree line square to the beam far off would
          // fill the cap as a wall at the bumper does and read as a flat slab:
          // there the cap falls off with distance, so far faces stay dimmer.
          if ( onRange ) cap /= 1.0 + metres2 * 0.0011;
          float received = cap * ( 1.0 - exp( -irradiance * nl / cap ) );
          // (x PI: city light is added straight onto the albedo, see cityLampLight.)
          directLight.color = vec3( 1.0, 0.93, 0.8 ) * ( received * PI / nl );
          RE_Direct( directLight, geometryPosition, lampNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          #ifdef CITY_RETRO
          // Retroreflectors (the scenic roads' reflector posts, county3d-roads.js:
          // the amber lens in the vertex colours) send a beam back up the road:
          // they flare in a car's lights, CITY_RETRO times the light they take.
          reflectedLight.directDiffuse += vec3( 1.0, 0.55, 0.16 ) * received * CITY_RETRO * smoothstep( 0.4, 0.8, vColor.r - vColor.b );
          #endif
        }
        #endif`;
      function cityMaterialPatch(shader) {
        Object.assign(shader.uniforms, cityLightUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + CITY_WORLD_VERTEX);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + CITY_LIGHT_PARS)
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\ncityCutawayClip();')
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + CITY_LIGHT_APPLY);
      }
      /**
       * GLASS REFLECTIONS
       * Both city cameras look down on the facades, so a mirror-true reflection
       * off a vertical pane points at the ground below the horizon, and every
       * curtain wall came out as one flat grey (the environment's dim "ground").
       * Glass facades use this patch instead: the reflection is folded up into
       * the sky, as a pane seen from street level reflects it, and it darkens
       * towards the foot of the building, where a real facade mirrors the street
       * canyon rather than open sky. A slow world-space variation stands in for
       * the neighbouring towers and clouds a real curtain wall would show, so
       * adjacent panels and faces never read as one uniform sheet.
       */
      const CITY_GLASS_IBL = `
        vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
          #ifdef ENVMAP_TYPE_CUBE_UV
            vec3 reflectVec = reflect( - viewDir, normal );
            reflectVec = normalize( mix( reflectVec, normal, roughness * roughness ) );
            reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
            reflectVec.y = abs( reflectVec.y ) * 0.72 + 0.05;
            reflectVec = normalize( reflectVec );
            vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
            float canyon = mix( 0.42, 1.08, smoothstep( 6.0, 240.0, vCityWorld.y ) );
            vec2 drift = vCityWorld.xz * 0.0041 + vec2( vCityWorld.y * 0.0063, -vCityWorld.y * 0.0021 );
            float neighbours = 0.8 + 0.2 * sin( drift.x * 2.3 + sin( drift.y * 1.7 ) * 1.9 ) * cos( drift.y * 1.3 - drift.x * 0.6 );
            return envMapColor.rgb * envMapIntensity * canyon * neighbours;
          #else
            return vec3( 0.0 );
          #endif
        }`;
      function cityGlassPatch(shader) {
        cityMaterialPatch(shader);
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <envmap_physical_pars_fragment>',
          Three.ShaderChunk.envmap_physical_pars_fragment.replace(/vec3 getIBLRadiance\([\s\S]*?\n\t}\n/, CITY_GLASS_IBL + '\n'),
        );
      }
      // Marks a material as facade glass (see GLASS REFLECTIONS).
      function useCityGlass(material) {
        material.onBeforeCompile = cityGlassPatch;
        material.customProgramCacheKey = () => 'cityGlass';
        return material;
      }
      /**
       * CUTAWAY
       * When the player is under a roof (the underpass, a rail viaduct deck, a
       * station canopy, a bus shelter, Vinny's depot, a building they are
       * inside), or hidden from the camera behind a building or a deck (a ray
       * from their middle or head towards the camera passes through its box,
       * findOccluders), a small hole, about their own size, is dithered through
       * that structure with a 4x4 ordered screen-door pattern so they stay in view.
       * Nothing else is ever cut: only fragments inside the covering structure's
       * own volume (its footprint, from its underside, or from above head height
       * for the walls of an enclosure, up to its top) and in front of the
       * player, so traffic, people, trees, props and towers that merely stand
       * between the camera and the player stay whole. With the player in plain
       * view there is no cutaway at all; shadows are never affected. A road vehicle in a tunnel
       * or the depot gets a hole its own size. Players can switch it off
       * (`setCharacterCutaway`; the settings menu saves localStorage
       * 'dead-end-city-cutaway' = 'off').
       * (It used to be a 96-unit disc that cut everything above head height in
       * front of the player, tree crowns, buses and whole tower faces included.)
       */
      const cutawayPoint = new Three.Vector3(),
        cutawayEdge = new Three.Vector3(),
        cutawaySize = new Three.Vector2(),
        cutawayCovers = [],
        // Roofs only the renderer knows about: {x, y, hx, hy, a, bottom, top}.
        cutawayRoofs = [],
        // World radius of the hole on foot: the player's size plus a small margin.
        CUTAWAY_RADIUS_ON_FOOT = PERSON_HEIGHT + 2;
      let characterCutaway = true;
      try {
        characterCutaway = localStorage.getItem('dead-end-city-cutaway') !== 'off';
      } catch {
        // Storage blocked (private window): keep the default.
      }
      function registerCutawayRoof(x, y, hx, hy, a, bottom, top) {
        cutawayRoofs.push({ x, y, hx, hy, a, bottom, top });
        // A roof over the player is also cover from the police helicopter (air-cover.js).
        registerOverheadCover(x, y, hx, hy, a, bottom, top, 'shelter');
      }
      // The roofs right over (x, y) whose underside is above `head`, lowest first.
      function coversOver(x, y, head, elevation, margin, vehicleHead) {
        cutawayCovers.length = 0;
        const inside = (b) => {
          const p = coverLocal(b, x, y);
          return Math.abs(p.x) < b.hx - margin && Math.abs(p.y) < b.hy - margin;
        };
        for (const b of airCoverVolumes())
          if (b.minHeight > head && b.minHeight - elevation < 120 && inside(b))
            cutawayCovers.push({ x: b.x, y: b.y, hx: b.hx, hy: b.hy, a: b.a, bottom: b.minHeight - 8, top: b.height + 2 });
        for (const b of cutawayRoofs)
          if (b.bottom > elevation + 4 && b.top > head - 4 && b.bottom - elevation < 120 && inside(b))
            cutawayCovers.push({ ...b, bottom: Math.max(b.bottom, vehicleHead ? head : elevation + 2) });
        // A building the player stands inside, below its roof: the walls in front of
        // them count as well as the roof, so the cut starts at head height.
        for (const b of buildingsNear(x, y))
          if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h && b.height > head + 6)
            cutawayCovers.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, hx: b.w / 2 + 2, hy: b.h / 2 + 2, a: 0, bottom: head, top: b.height + 14 });
        return cutawayCovers.sort((p, q) => p.bottom - q.bottom);
      }
