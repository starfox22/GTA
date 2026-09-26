      // BEGIN SUBSYSTEM: src/lighting3d.js — Sun, sky, reflections and night light
      /**
       * Sun, sky, reflections and night light
       * Source: src/lighting3d.js
       * Scope: createCityRenderer() closure (included after postfx3d.js, before the city is built).
       *
       *  - SUN PATH: the sun rises in the east, crosses the northern sky (so shadows
       *    fall towards the camera and read on the street, the look the city was
       *    designed with) and sets in the west; at night the same light is the moon.
       *  - SKY AND REFLECTIONS: a procedural sky (gradient, sun glow, stars, moon)
       *    drawn as a dome behind the flight view and filtered with PMREM into the
       *    scene's environment map, so glass, car paint, chrome and wet tarmac all
       *    reflect the sky that is actually overhead at that hour.
       *  - NIGHT LIGHT: street lamps, shop windows and neon throw pools of light on
       *    the ground without hundreds of real lights. The pools are painted once
       *    into a light map over the whole city; every lit material samples it by
       *    world position (see cityMaterialPatch) and adds it as light falling on
       *    surfaces near the ground, fading with height, so kerbs, cars, people and
       *    the foot of each facade all pick it up. Headlights are projected cones.
       *  - THE LOOK: per-hour exposure, bloom and colour grade for postfx3d.js.
       */
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
        }`;
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
      /* Occluders: buildings, and decks or roofs over the street (airCoverVolumes),
         that stand between the camera and the player, found by casting rays from
         the player's middle and head towards the camera through each one's box
         (grown by `margin`, so the hole opens just before the player is lost). */
      const occluderRay = { x: 0, y: 0, z: 0 };
      function rayHitsBox(px, py, pz, localX, localZ, hx, hz, bottom, top) {
        // Slab test in the box's own frame: px/pz and localX/localZ are the ray's
        // origin and direction already turned into it; y is shared.
        let near = 0.5,
          far = 1e9;
        const axes = [
          [px, localX, hx],
          [pz, localZ, hz],
        ];
        for (const [origin, direction, half] of axes) {
          if (Math.abs(direction) < 1e-6) {
            if (Math.abs(origin) > half) return false;
            continue;
          }
          let t0 = (-half - origin) / direction,
            t1 = (half - origin) / direction;
          if (t0 > t1) [t0, t1] = [t1, t0];
          near = Math.max(near, t0);
          far = Math.min(far, t1);
          if (near > far) return false;
        }
        // Height: the ray climbs, so it is inside the box's span between these.
        const dy = occluderRay.y;
        if (dy > 1e-6) {
          near = Math.max(near, (bottom - py) / dy);
          far = Math.min(far, (top - py) / dy);
        } else if (py < bottom || py > top) return false;
        return near < far;
      }
      function findOccluders(x, y, heights, margin, list) {
        const ray = occluderRay;
        if (camera.isPerspectiveCamera) {
          ray.x = camera.position.x - x;
          ray.y = camera.position.y - heights[0];
          ray.z = camera.position.z - y;
        } else {
          camera.getWorldDirection(cutawayEdge);
          ray.x = -cutawayEdge.x;
          ray.y = -cutawayEdge.y;
          ray.z = -cutawayEdge.z;
        }
        const length = Math.hypot(ray.x, ray.y, ray.z) || 1;
        ray.x /= length;
        ray.y /= length;
        ray.z /= length;
        if (ray.y < 0.05) return;
        // How far a ray can travel sideways before it clears the tallest roof.
        const reach = ((streetCeiling() - heights[0]) / ray.y) * Math.hypot(ray.x, ray.z) + margin;
        for (const o of allBuildings) {
          const b = o.b;
          if (o.height <= heights[0]) continue;
          if (b.x > x + reach || b.x + b.w < x - reach || b.y > y + reach || b.y + b.h < y - reach) continue;
          // The player inside this building is coversOver()'s case.
          if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) continue;
          const cx = b.x + b.w / 2,
            cy = b.y + b.h / 2;
          if (!heights.some((h) => rayHitsBox(x - cx, h, y - cy, ray.x, ray.z, b.w / 2 + margin, b.h / 2 + margin, -60, o.height))) continue;
          list.push({ x: cx, y: cy, hx: b.w / 2 + 2, hy: b.h / 2 + 2, a: 0, bottom: -60, top: o.height + 24, near: Math.hypot(cx - x, cy - y) });
        }
        for (const b of airCoverVolumes()) {
          if (b.height <= heights[0] || b.minHeight <= heights[0] + 4) continue;
          if (Math.abs(b.x - x) > reach + b.hx + b.hy || Math.abs(b.y - y) > reach + b.hx + b.hy) continue;
          const local = coverLocal(b, x, y),
            cos = b.cos ?? Math.cos(b.a),
            sin = b.sin ?? Math.sin(b.a),
            localX = ray.x * cos + ray.z * sin,
            localZ = -ray.x * sin + ray.z * cos;
          if (!heights.some((h) => rayHitsBox(local.x, h, local.y, localX, localZ, b.hx + margin, b.hy + margin, b.minHeight, b.height))) continue;
          list.push({ x: b.x, y: b.y, hx: b.hx, hy: b.hy, a: b.a, bottom: b.minHeight - 8, top: b.height + 2, near: Math.hypot(b.x - x, b.y - y) });
        }
        list.sort((p, q) => p.near - q.near);
      }
      const cutawayOccluders = [];
      function setCutBox(box, span, cover) {
        if (!cover) {
          box.set(0, 0, 0, 0);
          return;
        }
        box.set(cover.x, cover.y, cover.hx + 1, cover.hy + 1);
        span.set(Math.cos(cover.a || 0), Math.sin(cover.a || 0), cover.bottom, cover.top);
      }
      function updateCutaway(elevation) {
        const u = cityLightUniforms,
          car = player.car;
        u.cityCutaway.value.z = 0;
        // Never in the air, on or in the water, on the map, or when switched off.
        if (!characterCutaway || gameMode === 'map' || player.parachute || player.swimming || player.hidden) return;
        if (transitRide || taxiRide || (car && (isAircraft(car) || isBoat(car)))) return;
        const spec = car ? vehicleSpec(car) : null,
          bodyHeight = car ? (spec.truck ? 32 : 18) : PERSON_HEIGHT + 1,
          radius = car ? Math.hypot(spec.l, spec.w) / 2 + 6 : CUTAWAY_RADIUS_ON_FOOT,
          covers = coversOver(player.x, player.y, elevation + bodyHeight, elevation, car ? 0 : 3, !!car);
        // Anything standing between the camera and the player (a tower south of
        // them, a viaduct deck): only when no roof over them already takes both slots.
        cutawayOccluders.length = 0;
        if (covers.length < 2) {
          findOccluders(player.x, player.y, [elevation + bodyHeight * 0.45, elevation + bodyHeight], radius * 0.4, cutawayOccluders);
          for (const o of cutawayOccluders) if (covers.length < 2) covers.push(o);
        }
        if (!covers.length) return;
        setCutBox(u.cityCutBoxA.value, u.cityCutSpanA.value, covers[0]);
        setCutBox(u.cityCutBoxB.value, u.cityCutSpanB.value, covers[1]);
        sceneBufferSize(cutawaySize);
        const middle = elevation + bodyHeight * 0.5;
        cutawayPoint.set(player.x, middle, player.y).applyMatrix4(camera.matrixWorldInverse);
        const depth = -cutawayPoint.z;
        cutawayPoint.set(player.x, middle, player.y).project(camera);
        cutawayEdge.set(player.x + radius, middle, player.y).project(camera);
        const pixels = Math.hypot((cutawayEdge.x - cutawayPoint.x) * cutawaySize.x, (cutawayEdge.y - cutawayPoint.y) * cutawaySize.y) / 2;
        if (Math.abs(cutawayPoint.x) > 1.2 || Math.abs(cutawayPoint.y) > 1.2 || cutawayPoint.z > 1) return;
        u.cityCutaway.value.set(
          (cutawayPoint.x * 0.5 + 0.5) * cutawaySize.x,
          (cutawayPoint.y * 0.5 + 0.5) * cutawaySize.y,
          pixels,
          // Only what stands between the camera and the player.
          depth - (car ? spec.l * 0.3 : 4),
        );
      }
      function setCharacterCutaway(on) {
        characterCutaway = !!on;
      }
      Three.MeshStandardMaterial.prototype.onBeforeCompile = cityMaterialPatch;
      // Unlit materials that opted out of tone mapping (signs, ad panels, screens)
      // were designed as final screen colours: carry them through the HDR pipeline.
      if (hdrCapable) {
        Three.MeshBasicMaterial.prototype.onBeforeCompile = function (shader) {
          if (this.toneMapped) return;
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n#include <city_hdr_pars>')
            .replace(
              '#include <colorspace_fragment>',
              '#include <colorspace_fragment>\ngl_FragColor.rgb = cityInverseTone( clamp( gl_FragColor.rgb, 0.0, 1.0 ) ) * 1.15;',
            );
        };
        Three.MeshBasicMaterial.prototype.customProgramCacheKey = function () {
          return this.toneMapped ? 'tone' : 'display';
        };
      }
      // ---- Vehicle lights ------------------------------------------------------------------
      /**
       * DRIVE LIGHT MAP
       * Each lit car throws its low beams down the road ahead and a red wash from
       * its tail lamps behind. Both are drawn every night frame, as instanced
       * quads seen from straight above, into a small HDR light map over the view
       * (cityDriveMap, texel-snapped so it does not crawl), and every lit material
       * adds that light like the street-lamp map (CITY_LIGHT_PARS): tarmac, kerbs,
       * the car ahead, pedestrians crossing and the wall at the end of the street
       * are lit through their own albedo, with the beam's falloff, instead of a
       * flat glow painted over the ground. The alpha channel keeps the highest
       * road level a beam lies on (max blending), so a beam lights what stands on
       * its own road and fades out a few metres above it. Two draw calls into a
       * 1024-texel target for all traffic; the player's car keeps its real
       * spotlight on top.
       */
      function beamTexture(width, paint) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = 128;
        paint(c.getContext('2d'), width);
        const t = new Three.CanvasTexture(c);
        t.colorSpace = Three.SRGBColorSpace;
        return t;
      }
      const headBeamTexture = beamTexture(256, (g, width) => {
        // Apex at the left edge (the bumper), spreading and fading to the right:
        // a bright zone a few metres ahead, then a long tail out to ~35 m.
        for (let x = 0; x < width; x++) {
          const u = x / (width - 1),
            half = 12 + u * 50,
            hot = 1 + 0.7 * Math.exp(-Math.pow((u - 0.22) / 0.16, 2)),
            fade = Math.min(1, Math.min(1, u * 14) * Math.pow(1 - u, 1.5) * hot * 0.62);
          const grad = g.createLinearGradient(0, 64 - half, 0, 64 + half);
          grad.addColorStop(0, 'rgba(255,240,218,0)');
          grad.addColorStop(0.25, `rgba(255,240,218,${fade * 0.45})`);
          grad.addColorStop(0.5, `rgba(255,240,218,${fade})`);
          grad.addColorStop(0.75, `rgba(255,240,218,${fade * 0.45})`);
          grad.addColorStop(1, 'rgba(255,240,218,0)');
          g.fillStyle = grad;
          g.fillRect(x, 64 - half, 1, half * 2);
        }
      });
      const tailGlowTexture = beamTexture(128, (g) => {
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,44,28,0.9)');
        grad.addColorStop(0.4, 'rgba(255,44,28,0.35)');
        grad.addColorStop(1, 'rgba(255,44,28,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
      });
      // Police lights on the road: a soft white pool tinted per instance.
      const strobeGlowTexture = beamTexture(128, (g) => {
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,0.85)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.3)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
      });
      const BEAM_CAPACITY = 160,
        STROBE_GLOW_CAPACITY = 64,
        DRIVE_MAP_SIZE = 1024,
        // Scene light at the brightest point of a beam, before the surface's albedo.
        DRIVE_LIGHT_POWER = 4.5,
        beamGeometry = new Three.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0),
        driveScene = new Three.Scene(),
        driveCamera = new Three.OrthographicCamera(-1, 1, 1, -1, 1, 12000),
        driveTarget = new Three.WebGLRenderTarget(DRIVE_MAP_SIZE, DRIVE_MAP_SIZE, {
          type: hdrCapable ? Three.HalfFloatType : Three.UnsignedByteType,
          depthBuffer: false,
          minFilter: Three.LinearFilter,
          magFilter: Three.LinearFilter,
        });
      driveTarget.texture.generateMipmaps = false;
      // Looking straight down with north (-z) up the image, so the map's v runs
      // north from the rect's south edge (see cityDriveRect).
      driveCamera.up.set(0, 0, -1);
      Object.assign(cityLightUniforms, {
        cityDriveMap: { value: driveTarget.texture },
        // (west x, south z, 1 / width, -1 / height) of the map in world units.
        cityDriveRect: { value: new Three.Vector4(0, 0, 0, 0) },
        cityDrivePower: { value: 0 },
      });
      function beamPool(map) {
        const m = new Three.InstancedMesh(
          beamGeometry,
          new Three.ShaderMaterial({
            uniforms: { map: { value: map } },
            depthTest: false,
            depthWrite: false,
            blending: Three.CustomBlending,
            blendEquation: Three.AddEquation,
            blendSrc: Three.OneFactor,
            blendDst: Three.OneFactor,
            blendEquationAlpha: Three.MaxEquation,
            blendSrcAlpha: Three.OneFactor,
            blendDstAlpha: Three.OneFactor,
            vertexShader: `
              varying vec2 vUv;
              varying vec3 vStrength;
              varying float vLevel;
              void main() {
                vUv = uv;
                vStrength = instanceColor;
                vec4 world = modelMatrix * instanceMatrix * vec4( position, 1.0 );
                vLevel = world.y + ${DRIVE_LEVEL_OFFSET.toFixed(1)};
                gl_Position = projectionMatrix * viewMatrix * world;
              }`,
            fragmentShader: `
              uniform sampler2D map;
              varying vec2 vUv;
              varying vec3 vStrength;
              varying float vLevel;
              void main() {
                vec4 t = texture2D( map, vUv );
                vec3 light = t.rgb * t.a * vStrength;
                gl_FragColor = vec4( light, dot( light, vec3( 1.0 ) ) > 0.002 ? vLevel : 0.0 );
              }`,
          }),
          BEAM_CAPACITY,
        );
        m.count = 0;
        m.frustumCulled = false;
        m.setColorAt(0, new Three.Color());
        driveScene.add(m);
        return m;
      }
      const headBeams = beamPool(headBeamTexture),
        tailGlows = beamPool(tailGlowTexture),
        strobeGlows = beamPool(strobeGlowTexture),
        beamMatrix = new Three.Matrix4(),
        beamQuaternion = new Three.Quaternion(),
        beamPosition = new Three.Vector3(),
        beamScale = new Three.Vector3(),
        beamColor = new Three.Color(),
        headBeamUp = new Three.Vector3(0, 1, 0),
        driveClearColor = new Three.Color();
      function updateHeadlightBeams() {
        let heads = 0,
          tails = 0,
          strobes = 0;
        // Lamps are on at night and in a downpour (weather3d.js); wet tarmac
        // brightens the beams.
        const night = vehicleLampAmount(),
          wetBoost = 1 + weather.wet * 0.35;
        if (night > 0.2)
          for (const c of vehicles) {
            if (heads >= BEAM_CAPACITY) break;
            if (c.hp <= 0 || isAircraft(c)) continue;
            // A flashing police car washes the road either side red and blue
            // (police3d.js), parked at a roadblock or not.
            const policeModel = c.cop || c.showLights ? carModels.get(c) : null;
            if (policeModel?.police && policeModel.group.visible && strobes < STROBE_GLOW_CAPACITY - 1)
              for (const side of [-1, 1]) {
                const level = policeRoadGlow(policeModel, side);
                if (level < 0.05) continue;
                const spec = vehicleSpec(c),
                  size = 110,
                  sin = Math.sin(c.a),
                  cos = Math.cos(c.a),
                  // Centre off the car's side, the quad's apex a half size back.
                  cx = c.x + side * -sin * spec.w * 1.9 - cos * size * 0.5,
                  cz = c.y + side * cos * spec.w * 1.9 - sin * size * 0.5,
                  strength = level * night * 0.11 * wetBoost;
                beamQuaternion.setFromAxisAngle(headBeamUp, -c.a);
                beamPosition.set(cx, entityElevation(c) + 0.35, cz);
                beamScale.set(size, 1, size);
                strobeGlows.setMatrixAt(strobes, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
                strobeGlows.setColorAt(strobes, side < 0 ? beamColor.setRGB(strength, strength * 0.07, strength * 0.05) : beamColor.setRGB(strength * 0.1, strength * 0.26, strength));
                strobes++;
              }
            if (!(c.ai || c === player.car)) continue;
            const spec = vehicleSpec(c);
            if (spec.boat || spec.jetski || spec.bicycle || c.type === 'bicycle') continue;
            // A beam reaches ~35 m past the bumper: lit cars just outside the frame
            // still light the street inside it.
            if (!entityInView(c, 200)) continue;
            const model = carModels.get(c),
              out = model?.lampOut || [],
              share = ((out[0] ? 0 : 1) + (out[2] ? 0 : 1)) / 2;
            const ground = entityElevation(c) + 0.35,
              cos = Math.cos(c.a),
              sin = Math.sin(c.a);
            beamQuaternion.setFromAxisAngle(headBeamUp, -c.a);
            if (share > 0) {
              beamPosition.set(c.x + cos * spec.l * 0.46, ground, c.y + sin * spec.l * 0.46);
              beamScale.set(spec.truck ? 200 : 178, 1, spec.truck ? 112 : 96);
              headBeams.setMatrixAt(heads, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
              headBeams.setColorAt(heads, beamColor.setScalar(night * share * wetBoost));
              heads++;
            }
            // Tail lamps: a red wash on the road just behind the bumper.
            beamPosition.set(c.x - cos * (spec.l * 0.5 + 16), ground, c.y - sin * (spec.l * 0.5 + 16));
            beamScale.set(26, 1, spec.w * 1.5);
            tailGlows.setMatrixAt(tails, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
            tailGlows.setColorAt(tails, beamColor.setScalar(night * (c.braking ? 0.75 : 0.32) * wetBoost));
            tails++;
          }
        headBeams.count = heads;
        tailGlows.count = tails;
        strobeGlows.count = strobes;
        const u = cityLightUniforms;
        u.cityDrivePower.value = heads + tails + strobes ? DRIVE_LIGHT_POWER : 0;
        if (!heads && !tails && !strobes) return;
        for (const m of [headBeams, tailGlows, strobeGlows])
          if (m.count) {
            m.instanceMatrix.needsUpdate = true;
            m.instanceColor.needsUpdate = true;
          }
        // The map covers the view and the reach of beams from just outside it.
        const half = Math.max(400, Math.min(viewReach + 220, 2600)),
          texel = (2 * half) / DRIVE_MAP_SIZE,
          cx = Math.round(viewCenter.x / texel) * texel,
          cz = Math.round(viewCenter.y / texel) * texel;
        driveCamera.left = driveCamera.bottom = -half;
        driveCamera.right = driveCamera.top = half;
        driveCamera.position.set(cx, 6000, cz);
        driveCamera.lookAt(cx, 0, cz);
        driveCamera.updateProjectionMatrix();
        driveCamera.updateMatrixWorld();
        u.cityDriveRect.value.set(cx - half, cz + half, 1 / (2 * half), -1 / (2 * half));
        const previousTarget = renderer.getRenderTarget(),
          previousAlpha = renderer.getClearAlpha();
        renderer.getClearColor(driveClearColor);
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(driveTarget);
        renderer.clear(true, false, false);
        renderer.render(driveScene, driveCamera);
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(driveClearColor, previousAlpha);
      }
      // ---- Time-of-day look ------------------------------------------------------------------
      const SKY_KEYS = {
        // [zenith, horizon, ground, glow] in scene-linear sRGB hex.
        day: ['#5b87bd', '#c4d2dc', '#5c5a52', '#ffe2b8'],
        dusk: ['#4a5a8a', '#f0a070', '#453c3a', '#ff9a50'],
        // A blue-hour night, brighter than a real one on purpose: the moonlit sky
        // is the ambient that keeps streets readable between the lamp pools.
        night: ['#43557a', '#5f6a88', '#2b2e37', '#463d5e'],
        overcast: ['#8a949e', '#b3b9bf', '#4a4d50', '#d0d0d0'],
      };
      const skyKeyColors = Object.fromEntries(
        Object.entries(SKY_KEYS).map(([k, list]) => [k, list.map((c) => new Three.Color(c))]),
      );
      // Lamp materials are declared after this file; their day colours are read on first use.
      let warmLampBase = null,
        tailLampBase = null,
        brakeLampBase = null;
      /**
       * NIGHT LOOK
       * A readable blue-hour night rather than an ink-black one: moonlight and a
       * cool sky fill strong enough that roads, buildings, people and cars read
       * everywhere, blacks lifted slightly towards blue, less contrast than by
       * day, and exposure opened up. Lamps, neon and headlights stay far brighter
       * than this ambient, so they still pop and pool. (No light follows the
       * player: they are lit like everyone else.)
       */
      const NIGHT_LOOK = {
        moon: 0.75, // added to the moon's (the sun light's) night intensity
        sky: 1.5, // added to the hemisphere sky fill
        exposure: 0.3, // extra exposure share at full night
        saturation: 0.2, // saturation lost at full night
        contrast: 0.08, // contrast lost at full night
        lampPower: 3.6, // street-lamp map strength
      };
      const gradeLiftNight = new Three.Vector3(0.012, 0.02, 0.036),
        gradeGainNight = new Three.Vector3(1.05, 1.0, 0.95),
        gradeLiftDusk = new Three.Vector3(0.0, 0.002, 0.006),
        gradeGainDusk = new Three.Vector3(1.1, 1.0, 0.86),
        gradeLiftDay = new Three.Vector3(0.0, 0.0, 0.003),
        gradeGainDay = new Three.Vector3(1.05, 1.0, 0.92);
      let lightingClock = performance.now();
      function updateLighting(deltaSeconds) {
        // The environment rebuild is throttled on the wall clock, not game time.
        const now = performance.now();
        envAge += (now - lightingClock) / 1000;
        lightingClock = now;
        updateSunPath();
        const light = daylight(),
          night = clamp(1 - light * 1.6, 0, 1),
          dusk = clamp(1 - Math.abs(light - 0.3) / 0.3, 0, 1),
          overcast = weather.cloud * weather.cloud,
          rain = weather.rain;
        // Sky colours: night -> day, dusk on top, grey as it clouds over.
        const k = skyKeyColors;
        for (let i = 0; i < 4; i++) {
          const target = [skyUniforms.uZenith, skyUniforms.uHorizon, skyUniforms.uGround, skyUniforms.uGlow][i].value;
          target.copy(k.night[i]).lerp(k.day[i], light).lerp(k.dusk[i], dusk * 0.75).lerp(k.overcast[i], overcast * 0.7 * light);
        }
        skyUniforms.uNight.value = night;
        skyUniforms.uStars.value = night * (1 - overcast);
        skyUniforms.uSunColor.value.copy(sun.color);
        refreshEnvironment(false);
        // The dome only exists for the flight camera.
        skyDome.visible = flightViewActive;
        if (skyDome.visible) {
          skyDome.position.copy(camera.position);
          skyDome.scale.setScalar(camera.far * 0.9);
        }
        // Sun glints on the water, cloud lighting and cloud shadows follow the real sun.
        waterUniforms.uSun.value.copy(sunDirection);
        SUN_DIRECTION.copy(sunDirection);
        marchUniforms.uSunDirection.value.copy(sunDirection);
        shadeUniforms.uSunDirection.value.copy(sunDirection);
        // Night light: lamp pools, and emissive lamp heads bright enough to bloom.
        cityLightUniforms.cityLampPower.value = night * NIGHT_LOOK.lampPower;
        cityLightUniforms.cityWet.value = weather.wet;
        const blackout = cityLightUniforms.cityZonePower.value;
        blackout.set(sideJobPower(100, 100), sideJobPower(100, 2000), sideJobPower(100, 3000));
        if (!warmLampBase) {
          warmLampBase = warmLamp.color.clone();
          tailLampBase = tailLamp.color.clone();
          brakeLampBase = brakeLamp.color.clone();
        }
        const lampsOn = vehicleLampAmount();
        warmLamp.color.copy(warmLampBase).multiplyScalar(1 + lampsOn * 3.5);
        tailLamp.color.copy(tailLampBase).multiplyScalar(1 + lampsOn * 2.5);
        brakeLamp.color.copy(brakeLampBase).multiplyScalar(3 + lampsOn * 3);
        updateHeadlightBeams();
        // Moonlight and sky light strong enough to read the streets by at night.
        sun.intensity += night * NIGHT_LOOK.moon;
        hemi.intensity += night * NIGHT_LOOK.sky;
        // Post look: exposure, bloom and grade (postfx3d.js).
        // A touch more exposure at night: legibility first, darkness second.
        postLook.exposure = renderer.toneMappingExposure * (1 + night * NIGHT_LOOK.exposure);
        postLook.bloomThreshold = 2.2 - night * 1.35 - dusk * 0.3;
        postLook.bloomStrength = 0.22 + night * 0.3 + dusk * 0.1;
        postLook.saturation = (1.16 + dusk * 0.06 - night * NIGHT_LOOK.saturation) * (1 - overcast * 0.14 - rain * 0.06);
        postLook.contrast = 1.14 + dusk * 0.02 - night * NIGHT_LOOK.contrast - overcast * 0.06;
        postLook.lift.copy(gradeLiftDay).lerp(gradeLiftDusk, dusk).lerp(gradeLiftNight, night);
        postLook.gain.copy(gradeGainDay).lerp(gradeGainDusk, dusk).lerp(gradeGainNight, night);
        if (rain > 0.05) {
          postLook.lift.lerp(gradeLiftNight, rain * 0.3);
          postLook.gain.lerp(gradeGainDay, rain * 0.5);
        }
        postLook.vignette = 0.2 + night * 0.06;
        // AO reads at street scale on the ground and grows with the view from the air.
        postLook.aoRadius = clamp(18 / Math.max(0.25, viewZoom), 18, 72);
        postLook.aoIntensity = 1.5;
        // Rain and lightning on top of the time of day (weather3d.js).
        weatherGrade();
      }
      /**
       * SHADOW CASTERS
       * A car or a person is two dozen small meshes, and every one of them was
       * drawn again into the shadow map. Seen from the street camera their shadow
       * is the body's: the lamps, trims, hands and gun models under it add
       * nothing but draw calls. New models keep shadows only on parts larger
       * than `minRadius` (world units, bounding-sphere radius).
       */
      const casterScale = new Three.Vector3();
      function trimShadowCasters(root, minRadius) {
        root.updateMatrixWorld(true);
        root.traverse((o) => {
          if (!o.isMesh || !o.castShadow || !o.geometry) return;
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          o.getWorldScale(casterScale);
          const radius = o.geometry.boundingSphere.radius * Math.max(casterScale.x, casterScale.y, casterScale.z);
          if (radius < minRadius) o.castShadow = false;
        });
      }
      // ---- Contact shadows ---------------------------------------------------------------
      /**
       * CONTACT SHADOWS
       * With sun shadows off (quality.js SHADOWS: the LOW tier's default, or the
       * Settings choice), every car, pedestrian and figure in view sits on a soft
       * dark blob instead, so nothing floats over the street: one instanced draw
       * for all of them. Nothing is drawn while the shadow map is on.
       */
      const CONTACT_CAPACITY = 900,
        contactCanvas = document.createElement('canvas');
      contactCanvas.width = contactCanvas.height = 64;
      {
        const g = contactCanvas.getContext('2d'),
          grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.55, 'rgba(0,0,0,0.8)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
      }
      const contactShadows = new Three.InstancedMesh(
        new Three.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new Three.MeshBasicMaterial({
          color: '#000000',
          map: new Three.CanvasTexture(contactCanvas),
          transparent: true,
          // Sunlit pavement sits high on the tone curve, where halving the light
          // only darkens it a little: the blob has to be strong to read by day.
          opacity: 0.82,
          depthWrite: false,
          fog: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -2,
        }),
        CONTACT_CAPACITY,
      );
      contactShadows.count = 0;
      contactShadows.visible = false;
      contactShadows.frustumCulled = false;
      contactShadows.renderOrder = 2;
      contactShadows.userData.dynamic = true;
      contactShadows.name = 'contact shadows';
      scene.add(contactShadows);
      const contactMatrix = new Three.Matrix4(),
        contactPosition = new Three.Vector3(),
        contactRotation = new Three.Quaternion(),
        contactScale = new Three.Vector3(),
        contactUp = new Three.Vector3(0, 1, 0);
      let contactCount = 0;
      function contactBlob(x, y, ground, length, width, angle) {
        if (contactCount >= CONTACT_CAPACITY) return;
        contactPosition.set(x, ground + 0.3, y);
        contactRotation.setFromAxisAngle(contactUp, -angle);
        contactScale.set(length, 1, width);
        contactShadows.setMatrixAt(contactCount++, contactMatrix.compose(contactPosition, contactRotation, contactScale));
      }
      // Called every frame from render(), once the people and vehicles are placed.
      function updateContactShadows() {
        contactCount = 0;
        if (!renderer.shadowMap.enabled) {
          for (const c of vehicles) {
            const spec = vehicleSpec(c);
            if (spec.boat || spec.jetski) continue;
            const ground = terrainHeight(c.x, c.y),
              aircraft = isAircraft(c);
            // Aircraft only on the ground.
            if (aircraft && (c.altitude ?? 0) - ground > 3) continue;
            if (!entityInView(c, Math.max(40, spec.l))) continue;
            const shrink = aircraft ? 0.8 : 1;
            contactBlob(c.x, c.y, aircraft ? ground : entityElevation(c), spec.l * 1.12 * shrink, spec.w * 1.35 * shrink, c.a || 0);
          }
          // People are only drawn this close in (render3d.js, crowd3d.js).
          if (flightViewActive ? viewZoom > PEOPLE_ZOOM : worldZoom > 0.22) {
            for (const p of pedestrians)
              if (!p.hidden && !p.swimming && entityInView(p, 20)) contactBlob(p.x, p.y, entityElevation(p), 10, 10, 0);
            for (const p of renderPeople) {
              if (p.hidden || p.swimming || p.parachute) continue;
              if (p === player && (player.car || transitRide || taxiRide)) continue;
              if (entityInView(p, 20)) contactBlob(p.x, p.y, entityElevation(p), 10, 10, 0);
            }
          }
        }
        contactShadows.count = contactCount;
        contactShadows.visible = contactCount > 0;
        if (contactCount) contactShadows.instanceMatrix.needsUpdate = true;
      }
      // ---- Quality tier ----------------------------------------------------------------------
      let activeTier = null;
      function applyRendererQuality(tier) {
        activeTier = tier;
        const ratio = Math.min(devicePixelRatio || 1, tier.pixelRatio);
        if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
        renderer.setSize(viewportWidth, viewportHeight);
        // Sun shadows (quality.js SHADOWS): off, a smaller map, or the tier's map.
        // Switching them on or off changes the lights' state, so three.js relinks
        // the lit programs once; a new size only reallocates the map.
        const mode = shadowQuality(),
          on = mode !== 'off',
          size = mode === 'low' ? Math.min(tier.shadowMap, 2048) : Math.max(2048, tier.shadowMap);
        renderer.shadowMap.enabled = on;
        if (sun.castShadow !== on) sun.castShadow = on;
        if (sun.shadow.mapSize.x !== size || (!on && sun.shadow.map)) {
          sun.shadow.mapSize.set(size, size);
          if (sun.shadow.map) {
            sun.shadow.map.dispose();
            sun.shadow.map = null;
          }
        }
        setPostQuality(tier);
        setSearchlightQuality(tier);
      }
      // END SUBSYSTEM: src/lighting3d.js
