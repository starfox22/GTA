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
      const cityLightUniforms = {
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
      /* Street lamps a car has knocked flat (damage3d.js): their pools are left out
         of the map until the lamp is stood up again, so no pool of light lies on
         the pavement with nothing above it. Keyed by the lamp's map position. */
      const lampLightOut = new Set();
      function lampLightSwitch(prop, on) {
        if (prop.kind !== 'lamp') return;
        const key = prop.x + ',' + prop.y;
        if (on === !lampLightOut.has(key)) return;
        if (on) lampLightOut.delete(key);
        else lampLightOut.add(key);
        paintLampLight({ x: prop.x + 6, y: prop.y + 6, r: 70 });
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
        // Street lamps (render3d.js draws one post per entry of `lamps`); the
        // lantern hangs 6 units out from the post.
        for (const l of lamps) if (!lampLightOut.has(l.x + ',' + l.y)) pool(l.x + 6, l.y + 6, 62, 255, 196, 128, 0.85);
        // Shop windows spill warm light across the pavement in front of them.
        for (const b of buildings)
          for (const pane of b.shopPanes || []) pool(pane.cx, pane.face + 10, Math.max(22, pane.width * 0.8), 255, 214, 160, 0.45);
        // South Coast Stadium's floodlights while a fixture is on (sports3d.js).
        for (const flood of stadiumFloodPools()) pool(flood.x, flood.y, flood.radius, 255, 248, 232, flood.strength);
        // Rooftop and street neon: tinted glows (their sprites carry the colour).
        for (const n of neonSigns) {
          const p = n.sprite.getWorldPosition(sunScratch);
          if (p.y > 30) continue;
          const c = n.sprite.material.color;
          pool(p.x, p.z, 40, Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 0.35);
        }
        // Neon, lightboxes and lobby glass (signage3d.js): coloured pools on the pavement.
        for (const s of signLightPools)
          pool(s.x, s.y, s.r, Math.round(s.color[0] * 255), Math.round(s.color[1] * 255), Math.round(s.color[2] * 255), s.strength);
        g.globalCompositeOperation = 'source-over';
        g.restore();
        lampTexture.needsUpdate = true;
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
      const CITY_LIGHT_PARS = `
        varying vec3 vCityWorld;
        uniform sampler2D cityLampMap;
        uniform vec4 cityLampRect;
        uniform float cityLampPower;
        uniform vec3 cityZonePower;
        uniform float cityRiverLeft;
        uniform float cityWet;
        // Street power at this fragment (the blackout job); signs dim with it too.
        float cityPower() {
          return vCityWorld.x > cityRiverLeft || vCityWorld.x < -500.0 ? 1.0
            : vCityWorld.z < 1450.0 ? cityZonePower.x : vCityWorld.z < 2650.0 ? cityZonePower.y : cityZonePower.z;
        }
        vec3 cityLampLight() {
          vec2 uv = ( vCityWorld.xz - cityLampRect.xy ) * cityLampRect.zw;
          if ( cityLampPower < 0.001 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) return vec3( 0.0 );
          float zone = cityPower();
          // Lamps hang ~33 units up: full light at street level, none on the roofs.
          float height = 1.0 - smoothstep( 4.0, 42.0, vCityWorld.y );
          return texture2D( cityLampMap, uv ).rgb * ( cityLampPower * zone * height );
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
          vec3 lampLight = cityLampLight();
          vec3 upView = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
          float facing = 0.3 + 0.7 * max( dot( normal, upView ), 0.0 );
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
       * Only when the player is strictly under a roof (the underpass, a rail
       * viaduct deck, a station canopy, a bus shelter, Vinny's depot, a building
       * they are inside) is a small hole, about their own size, dithered through
       * that roof with a 4x4 ordered screen-door pattern so they stay in view.
       * Nothing else is ever cut: only fragments inside the covering structure's
       * own volume (its footprint, from its underside, or from above head height
       * for the walls of an enclosure, up to its top) and in front of the
       * player, so traffic, people, trees, props and towers that merely stand
       * between the camera and the player stay whole. In the open there is no
       * cutaway at all; shadows are never affected. A road vehicle in a tunnel
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
        CUTAWAY_RADIUS_ON_FOOT = 18;
      let characterCutaway = true;
      try {
        characterCutaway = localStorage.getItem('dead-end-city-cutaway') !== 'off';
      } catch {
        // Storage blocked (private window): keep the default.
      }
      function registerCutawayRoof(x, y, hx, hy, a, bottom, top) {
        cutawayRoofs.push({ x, y, hx, hy, a, bottom, top });
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
          bodyHeight = car ? (spec.truck ? 32 : 18) : 18,
          radius = car ? Math.hypot(spec.l, spec.w) / 2 + 6 : CUTAWAY_RADIUS_ON_FOOT,
          covers = coversOver(player.x, player.y, elevation + bodyHeight, elevation, car ? 0 : 3, !!car);
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
      // ---- Headlight cones -----------------------------------------------------------------
      /**
       * Each lit car throws a cone of light down the road ahead and a faint red
       * wash behind: two instanced, additively blended ground decals (two draw
       * calls for all traffic). The player's own car keeps its real spotlight.
       */
      function beamTexture(paint) {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        paint(c.getContext('2d'));
        const t = new Three.CanvasTexture(c);
        t.colorSpace = Three.SRGBColorSpace;
        return t;
      }
      const headBeamTexture = beamTexture((g) => {
        // Apex at the left edge (the bumper), widening and fading to the right.
        for (let x = 0; x < 128; x++) {
          const u = x / 127,
            half = 10 + u * 50,
            fade = Math.pow(1 - u, 1.4) * Math.min(1, u * 9);
          const grad = g.createLinearGradient(0, 64 - half, 0, 64 + half);
          grad.addColorStop(0, 'rgba(255,236,200,0)');
          grad.addColorStop(0.5, `rgba(255,236,200,${fade})`);
          grad.addColorStop(1, 'rgba(255,236,200,0)');
          g.fillStyle = grad;
          g.fillRect(x, 64 - half, 1, half * 2);
        }
      });
      const tailGlowTexture = beamTexture((g) => {
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,60,40,0.9)');
        grad.addColorStop(1, 'rgba(255,60,40,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
      });
      const BEAM_CAPACITY = 120,
        beamGeometry = new Three.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
      function beamPool(map) {
        const m = new Three.InstancedMesh(
          beamGeometry,
          new Three.MeshBasicMaterial({
            map,
            transparent: true,
            depthWrite: false,
            blending: Three.AdditiveBlending,
            fog: false,
          }),
          BEAM_CAPACITY,
        );
        m.count = 0;
        m.frustumCulled = false;
        m.renderOrder = 4;
        m.userData.dynamic = true;
        m.setColorAt(0, new Three.Color());
        scene.add(m);
        return m;
      }
      const headBeams = beamPool(headBeamTexture),
        tailGlows = beamPool(tailGlowTexture),
        beamMatrix = new Three.Matrix4(),
        beamQuaternion = new Three.Quaternion(),
        beamPosition = new Three.Vector3(),
        beamScale = new Three.Vector3(),
        beamColor = new Three.Color(),
        headBeamUp = new Three.Vector3(0, 1, 0);
      function updateHeadlightBeams() {
        let heads = 0,
          tails = 0;
        const night = nightAmount;
        if (night > 0.2)
          for (const c of vehicles) {
            if (heads >= BEAM_CAPACITY) break;
            if (c.hp <= 0 || !(c.ai || c === player.car) || isAircraft(c)) continue;
            const spec = vehicleSpec(c);
            if (spec.boat || spec.jetski || spec.bicycle || c.type === 'bicycle') continue;
            if (!entityInView(c, 90)) continue;
            const model = carModels.get(c),
              out = model?.lampOut || [],
              share = ((out[0] ? 0 : 1) + (out[2] ? 0 : 1)) / 2;
            const ground = entityElevation(c) + 0.35,
              cos = Math.cos(c.a),
              sin = Math.sin(c.a);
            beamQuaternion.setFromAxisAngle(headBeamUp, -c.a);
            if (share > 0) {
              beamPosition.set(c.x + cos * spec.l * 0.48, ground, c.y + sin * spec.l * 0.48);
              beamScale.set(spec.truck ? 120 : 95, 1, spec.truck ? 62 : 52);
              headBeams.setMatrixAt(heads, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
              headBeams.setColorAt(heads, beamColor.setScalar(night * share * 0.55));
              heads++;
            }
            beamPosition.set(c.x - cos * (spec.l * 0.5 + 9), ground, c.y - sin * (spec.l * 0.5 + 9));
            beamScale.set(18, 1, spec.w * 1.1);
            beamQuaternion.setFromAxisAngle(headBeamUp, -c.a);
            beamPosition.x -= cos * 9;
            beamPosition.z -= sin * 9;
            tailGlows.setMatrixAt(tails, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
            tailGlows.setColorAt(tails, beamColor.setScalar(night * 0.18));
            tails++;
          }
        headBeams.count = heads;
        tailGlows.count = tails;
        for (const m of [headBeams, tailGlows])
          if (m.count) {
            m.instanceMatrix.needsUpdate = true;
            m.instanceColor.needsUpdate = true;
          }
      }
      // ---- Time-of-day look ------------------------------------------------------------------
      const SKY_KEYS = {
        // [zenith, horizon, ground, glow] in scene-linear sRGB hex.
        day: ['#5b87bd', '#c4d2dc', '#5c5a52', '#ffe2b8'],
        dusk: ['#4a5a8a', '#f0a070', '#453c3a', '#ff9a50'],
        // Brighter than a real night sky on purpose: it is the moonlit ambient
        // that keeps the streets readable between the lamp pools.
        night: ['#3c4862', '#4b5468', '#25272d', '#3a3050'],
        overcast: ['#8a949e', '#b3b9bf', '#4a4d50', '#d0d0d0'],
      };
      const skyKeyColors = Object.fromEntries(
        Object.entries(SKY_KEYS).map(([k, list]) => [k, list.map((c) => new Three.Color(c))]),
      );
      // Lamp materials are declared after this file; their day colours are read on first use.
      let warmLampBase = null,
        tailLampBase = null;
      const gradeLiftNight = new Three.Vector3(0.0, 0.003, 0.01),
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
        cityLightUniforms.cityLampPower.value = night * 4.2;
        cityLightUniforms.cityWet.value = weather.wet;
        const blackout = cityLightUniforms.cityZonePower.value;
        blackout.set(sideJobPower(100, 100), sideJobPower(100, 2000), sideJobPower(100, 3000));
        if (!warmLampBase) {
          warmLampBase = warmLamp.color.clone();
          tailLampBase = tailLamp.color.clone();
        }
        warmLamp.color.copy(warmLampBase).multiplyScalar(1 + night * 3.5);
        tailLamp.color.copy(tailLampBase).multiplyScalar(1 + night * 2.5);
        updateHeadlightBeams();
        // Moonlight and sky light strong enough to read the streets by at night.
        sun.intensity += night * 0.55;
        hemi.intensity += night * 0.75;
        // Post look: exposure, bloom and grade (postfx3d.js).
        // A touch more exposure at night: legibility first, darkness second.
        postLook.exposure = renderer.toneMappingExposure * (1 + night * 0.22);
        postLook.bloomThreshold = 2.2 - night * 1.35 - dusk * 0.3;
        postLook.bloomStrength = 0.22 + night * 0.3 + dusk * 0.1;
        postLook.saturation = (1.16 + dusk * 0.06 - night * 0.26) * (1 - overcast * 0.14 - rain * 0.06);
        postLook.contrast = 1.14 + dusk * 0.02 - overcast * 0.06;
        postLook.lift.copy(gradeLiftDay).lerp(gradeLiftDusk, dusk).lerp(gradeLiftNight, night);
        postLook.gain.copy(gradeGainDay).lerp(gradeGainDusk, dusk).lerp(gradeGainNight, night);
        if (rain > 0.05) {
          postLook.lift.lerp(gradeLiftNight, rain * 0.3);
          postLook.gain.lerp(gradeGainDay, rain * 0.5);
        }
        postLook.vignette = 0.2 + night * 0.12;
        // AO reads at street scale on the ground and grows with the view from the air.
        postLook.aoRadius = clamp(18 / Math.max(0.25, viewZoom), 18, 72);
        postLook.aoIntensity = 1.5;
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
      // ---- Quality tier ----------------------------------------------------------------------
      let activeTier = null;
      function applyRendererQuality(tier) {
        activeTier = tier;
        const ratio = Math.min(devicePixelRatio || 1, tier.pixelRatio);
        if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
        renderer.setSize(viewportWidth, viewportHeight);
        if (sun.shadow.mapSize.x !== tier.shadowMap) {
          sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
          if (sun.shadow.map) {
            sun.shadow.map.dispose();
            sun.shadow.map = null;
          }
        }
        setPostQuality(tier);
        setSearchlightQuality(tier);
      }
      // END SUBSYSTEM: src/lighting3d.js
