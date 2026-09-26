      // BEGIN SUBSYSTEM: src/signage3d.js — Night glows, neon and wet-street reflections
      /**
       * Night glows, neon and wet-street reflections
       * Source: src/signage3d.js
       * Scope: createCityRenderer() closure (included by src/cityscape3d.js before the
       * buildings are dressed, so every building can light itself).
       *
       * GLOW FIELD
       * Every small light that should bloom at night (neon halos, marquee bulbs,
       * bollard lamps, aircraft warning lights, lit billboard lamps) is one instance
       * of a single camera-facing quad: one draw call for the whole city instead of
       * one sprite each. An instance carries its centre, colour, size and a mode:
       *   0 steady, 1 neon flicker (mostly on, now and then a stutter), 2 aircraft
       *   beacon (a short red flash every 1.5 s), 3 marquee chase (bulbs run along
       *   a row by their phase), 4 slow pulse, 5 colour-cycling neon.
       * Glows are linear HDR light added into the scene (the bloom picks them up);
       * `day` is how much of the glow survives in daylight (beacons keep some).
       * A glow is dimmed with its district when the blackout contract cuts power.
       *
       * WET STREETS
       * Under each street-level sign a stretched additive streak is laid on the
       * road towards the camera, the way neon smears across wet tarmac. Streaks
       * are one instanced mesh too and show only in the rain at night.
       *
       * LIGHT SPILL
       * `signLightPools` are painted into the night light map by lighting3d.js
       * (paintLampLight), so a neon sign tints the pavement and the facade under it.
       */
      const GLOW_CAPACITY = 9000,
        STREAK_CAPACITY = 3400,
        glowCenters = new Float32Array(GLOW_CAPACITY * 3),
        glowColors = new Float32Array(GLOW_CAPACITY * 3),
        glowParams = new Float32Array(GLOW_CAPACITY * 4),
        glowExtra = new Float32Array(GLOW_CAPACITY * 2),
        glowWorld = [],
        signLightPools = [];
      let glowCount = 0;
      const glowUniforms = {
        uTime: { value: 0 },
        uNight: { value: 0 },
        uWet: { value: 0 },
      };
      const GLOW_MODES = { steady: 0, flicker: 1, beacon: 2, chase: 3, pulse: 4, cycle: 5 };
      function glowGeometry(capacity, centers, colors, params, extra) {
        const quad = new Three.PlaneGeometry(1, 1),
          g = new Three.InstancedBufferGeometry();
        g.index = quad.index;
        g.setAttribute('position', quad.attributes.position);
        g.setAttribute('uv', quad.attributes.uv);
        g.setAttribute('glowCenter', new Three.InstancedBufferAttribute(centers, 3));
        g.setAttribute('glowColor', new Three.InstancedBufferAttribute(colors, 3));
        g.setAttribute('glowParams', new Three.InstancedBufferAttribute(params, 4));
        g.setAttribute('glowExtra', new Three.InstancedBufferAttribute(extra, 2));
        g.instanceCount = 0;
        return g;
      }
      // Shared intensity code: how bright a light of this mode is right now.
      const GLOW_MODE_GLSL = `
        uniform float uTime;
        uniform float uNight;
        float glowHash( float n ) { return fract( sin( n ) * 43758.5453 ); }
        float glowLevel( float mode, float phase ) {
          if ( mode < 0.5 ) return 1.0;
          if ( mode < 1.5 ) {
            // Neon: steady with a faint hum; about one second in twelve it stutters.
            float slot = floor( uTime * 9.0 + phase * 37.0 );
            float bad = step( 0.93, glowHash( floor( slot / 9.0 ) * 7.13 + phase * 91.7 ) );
            float stutter = mix( 1.0, step( 0.45, glowHash( slot * 1.37 + phase ) ) * 0.85 + 0.1, bad );
            return stutter * ( 0.94 + 0.06 * sin( uTime * 50.0 + phase * 6.0 ) );
          }
          if ( mode < 2.5 ) {
            float t = fract( uTime / 1.5 + phase );
            return smoothstep( 0.0, 0.04, t ) * ( 1.0 - smoothstep( 0.18, 0.3, t ) );
          }
          if ( mode < 3.5 ) {
            float t = fract( uTime * 1.6 - phase );
            return 0.18 + 0.82 * step( t, 0.34 );
          }
          if ( mode < 4.5 ) return 0.6 + 0.4 * sin( uTime * 2.2 + phase * 6.2832 );
          return 1.0;
        }
        vec3 glowTint( float mode, float phase, vec3 color ) {
          if ( mode < 4.5 ) return color;
          // Colour-cycling neon: walk the hue round, keeping the brightness.
          float h = uTime * 0.12 + phase;
          vec3 c = clamp( abs( mod( h * 6.0 + vec3( 0.0, 4.0, 2.0 ), 6.0 ) - 3.0 ) - 1.0, 0.0, 1.0 );
          return mix( vec3( 1.0 ), c, 0.85 ) * max( color.r, max( color.g, color.b ) );
        }`;
      const glowMaterial = new Three.ShaderMaterial({
        uniforms: Three.UniformsUtils.merge([Three.UniformsLib.fog, glowUniforms]),
        vertexShader: `
          attribute vec3 glowCenter;
          attribute vec3 glowColor;
          attribute vec4 glowParams;
          attribute vec2 glowExtra;
          varying vec2 vUv;
          varying vec3 vGlow;
          ${GLOW_MODE_GLSL}
          #include <fog_pars_vertex>
          void main() {
            vUv = uv;
            float level = glowLevel( glowParams.z, glowParams.y );
            float lit = mix( glowExtra.x, 1.0, uNight ) * glowExtra.y;
            vGlow = glowTint( glowParams.z, glowParams.y, glowColor ) * glowParams.w * level * lit;
            vec4 mvPosition = modelViewMatrix * vec4( glowCenter, 1.0 );
            // Nothing to draw: park the quad behind the camera.
            float size = lit * level > 0.002 ? glowParams.x : 0.0;
            mvPosition.xy += position.xy * size;
            // Pull the quad towards the camera so it clears the wall it hangs on.
            mvPosition.z += size * 0.35;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          varying vec2 vUv;
          varying vec3 vGlow;
          #include <common>
          #include <fog_pars_fragment>
          void main() {
            float d = length( vUv - 0.5 ) * 2.0;
            if ( d > 1.0 ) discard;
            // A hot core and a wide soft skirt: the bloom does the rest.
            float g = exp( -d * d * 9.0 ) * 1.6 + ( 1.0 - d ) * ( 1.0 - d ) * 0.35;
            gl_FragColor = vec4( vGlow * g, 1.0 );
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            vec3 glowLight = gl_FragColor.rgb;
            #include <fog_fragment>
            #ifdef USE_FOG
              // Additive light fades into the haze instead of adding the haze colour.
              gl_FragColor.rgb = glowLight * ( 1.0 - fogFactor );
            #endif
          }`,
        transparent: true,
        depthWrite: false,
        blending: Three.AdditiveBlending,
        fog: true,
      });
      glowMaterial.uniforms.uTime = glowUniforms.uTime;
      glowMaterial.uniforms.uNight = glowUniforms.uNight;
      const glowMesh = new Three.Mesh(glowGeometry(GLOW_CAPACITY, glowCenters, glowColors, glowParams, glowExtra), glowMaterial);
      glowMesh.frustumCulled = false;
      glowMesh.renderOrder = 2;
      glowMesh.name = 'glow field';
      scene.add(glowMesh);
      const glowScratch = new Three.Color();
      /**
       * Adds one glow. `color` is any CSS colour; `strength` scales it as HDR light
       * (1 is a bright bulb; 3+ blooms hard). Options: mode (a GLOW_MODES name),
       * phase (0..1, offsets flicker, blink and chase), day (0..1 left in daylight).
       */
      function addGlow(x, y, z, size, color, strength = 1, options = {}) {
        if (glowCount >= GLOW_CAPACITY) return -1;
        const i = glowCount++;
        glowScratch.set(color);
        glowCenters.set([x, y, z], i * 3);
        glowColors.set([glowScratch.r, glowScratch.g, glowScratch.b], i * 3);
        glowParams.set([size, options.phase ?? cityRandom(), GLOW_MODES[options.mode || 'steady'], strength], i * 4);
        glowExtra.set([options.day ?? 0, 1], i * 2);
        glowWorld.push(x, z);
        return i;
      }
      // Glows relative to a building group (its position is the group origin).
      function addGroupGlow(group, x, y, z, size, color, strength, options) {
        return addGlow(group.position.x + x, group.position.y + y, group.position.z + z, size, color, strength, options);
      }
      /**
       * A glow that can be switched off and on again (a street lamp a car knocks
       * down): `handle.visible = false` zeroes its strength, `true` restores it,
       * the way a sprite's `visible` would.
       */
      function glowHandle(index) {
        const strength = index >= 0 ? glowParams[index * 4 + 3] : 0;
        let shown = true;
        return {
          get visible() {
            return shown;
          },
          set visible(on) {
            if (index < 0 || !!on === shown) return;
            shown = !!on;
            glowParams[index * 4 + 3] = shown ? strength : 0;
            glowMesh.geometry.attributes.glowParams.needsUpdate = true;
          },
        };
      }
      // ---- Wet-street streaks ----------------------------------------------------------
      const streakCenters = new Float32Array(STREAK_CAPACITY * 3),
        streakColors = new Float32Array(STREAK_CAPACITY * 3),
        streakParams = new Float32Array(STREAK_CAPACITY * 4),
        streakExtra = new Float32Array(STREAK_CAPACITY * 2);
      let streakCount = 0;
      const streakMaterial = new Three.ShaderMaterial({
        uniforms: Three.UniformsUtils.merge([Three.UniformsLib.fog, glowUniforms]),
        vertexShader: `
          attribute vec3 glowCenter;
          attribute vec3 glowColor;
          attribute vec4 glowParams;
          attribute vec2 glowExtra;
          uniform float uWet;
          varying vec2 vUv;
          varying vec3 vGlow;
          varying vec2 vGround;
          ${GLOW_MODE_GLSL}
          #include <fog_pars_vertex>
          void main() {
            vUv = uv;
            float level = glowLevel( glowParams.z, glowParams.y ) * uNight * uWet * glowExtra.y;
            vGlow = glowTint( glowParams.z, glowParams.y, glowColor ) * glowParams.w * level;
            // A ground quad: width across, length running south (towards the camera).
            vec3 p = glowCenter + vec3( position.x * glowParams.x, 0.0, -position.y * glowExtra.x );
            if ( level < 0.002 ) p = vec3( 0.0, -9999.0, 0.0 );
            vGround = p.xz;
            vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          varying vec2 vUv;
          varying vec3 vGlow;
          varying vec2 vGround;
          uniform float uTime;
          uniform float uWet;
          ${SURFACE_NOISE}
          #include <common>
          #include <fog_pars_fragment>
          void main() {
            // Brightest near the sign, pulled into vertical streaks and broken by
            // ripples that crawl towards the camera as the rain lands.
            float across = 1.0 - abs( vUv.x - 0.5 ) * 2.0;
            float along = vUv.y;
            float streaks = 0.62 + 0.38 * sin( vUv.x * 19.0 + along * 2.5 + 1.3 );
            float ripple = 0.7 + 0.3 * sin( along * 29.0 + uTime * 2.6 + sin( vUv.x * 9.0 ) * 3.0 );
            float g = pow( across, 1.3 ) * pow( along, 1.4 ) * streaks * ripple;
            // Only where the road is still wet (lighting3d.js WET SURFACES): the
            // streak breaks up over the drying patches and runs brighter and
            // sharper across standing water.
            float low = cityWetLow( vGround );
            g *= cityWetFilm( vGround, low, 0.0, uWet ) * mix( 0.75, 1.5, cityPuddle( low, uWet ) );
            gl_FragColor = vec4( vGlow * g, 1.0 );
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            vec3 glowLight = gl_FragColor.rgb;
            #include <fog_fragment>
            #ifdef USE_FOG
              gl_FragColor.rgb = glowLight * ( 1.0 - fogFactor );
            #endif
          }`,
        transparent: true,
        depthWrite: false,
        blending: Three.AdditiveBlending,
        fog: true,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      for (const k of ['uTime', 'uNight', 'uWet']) streakMaterial.uniforms[k] = glowUniforms[k];
      const streakMesh = new Three.Mesh(glowGeometry(STREAK_CAPACITY, streakCenters, streakColors, streakParams, streakExtra), streakMaterial);
      streakMesh.frustumCulled = false;
      streakMesh.renderOrder = 1;
      streakMesh.name = 'wet neon streaks';
      scene.add(streakMesh);
      const streakWorld = [];
      // A reflection of a sign `width` wide whose foot is at (x, z), running `length` south.
      function addStreak(x, z, width, length, color, strength = 1, options = {}) {
        if (streakCount >= STREAK_CAPACITY) return;
        const i = streakCount++;
        glowScratch.set(color);
        streakCenters.set([x, 0.35, z + length / 2], i * 3);
        streakColors.set([glowScratch.r, glowScratch.g, glowScratch.b], i * 3);
        streakParams.set([width, options.phase ?? cityRandom(), GLOW_MODES[options.mode || 'steady'], strength], i * 4);
        streakExtra.set([length, 1], i * 2);
        streakWorld.push(x, z);
      }
      /**
       * A street-level light source: tints the night light map (a pool on the
       * ground and the lower facade) and, if it faces a street, smears across the
       * wet road. `z` is the pavement line in front of the sign.
       */
      function signSpill(x, z, radius, color, strength = 0.4, streak = null) {
        glowScratch.set(color);
        signLightPools.push({ x, y: z, r: radius, color: [glowScratch.r, glowScratch.g, glowScratch.b], strength });
        if (streak) addStreak(x, z + 4, streak.width, streak.length, color, streak.strength ?? 1.2, streak);
      }
      // Blackout contract: dim glows (and streaks) in districts without power.
      let glowPowerCheck = 0,
        glowPowerDirty = false;
      function refreshGlowPower() {
        let changed = false;
        for (let i = 0; i < glowCount; i++) {
          const p = sideJobPower(glowWorld[i * 2], glowWorld[i * 2 + 1]);
          if (glowExtra[i * 2 + 1] !== p) {
            glowExtra[i * 2 + 1] = p;
            changed = true;
          }
        }
        if (changed) glowMesh.geometry.attributes.glowExtra.needsUpdate = true;
        changed = false;
        for (let i = 0; i < streakCount; i++) {
          const p = sideJobPower(streakWorld[i * 2], streakWorld[i * 2 + 1]);
          if (streakExtra[i * 2 + 1] !== p) {
            streakExtra[i * 2 + 1] = p;
            changed = true;
          }
        }
        if (changed) streakMesh.geometry.attributes.glowExtra.needsUpdate = true;
      }
      // Called once the city is dressed: upload what was added.
      function finishGlowField() {
        const pools = signLightPools.length;
        finishSignBoards();
        // Street signs placed after the light map was painted: paint it again, once.
        if (signLightPools.length !== pools) paintLampLight();
        bulbPool.instanceMatrix.needsUpdate = true;
        glowMesh.geometry.instanceCount = glowCount;
        streakMesh.geometry.instanceCount = streakCount;
        for (const m of [glowMesh, streakMesh])
          for (const a of Object.values(m.geometry.attributes)) if (a.isInstancedBufferAttribute) a.needsUpdate = true;
      }
      function updateGlowField(night) {
        // Glows are added while the city is dressed (any file); upload them once.
        if (signBoards.length || glowMesh.geometry.instanceCount !== glowCount || streakMesh.geometry.instanceCount !== streakCount) finishGlowField();
        glowUniforms.uTime.value = gameTime;
        glowUniforms.uNight.value = night;
        glowUniforms.uWet.value = weather.wet || 0;
        glowPowerCheck -= 1;
        // Power only changes during the blackout contract; poll it twice a second.
        if (glowPowerCheck <= 0) {
          glowPowerCheck = 30;
          const blackout = mission && sideJobIndex(mission) === 2;
          if (blackout || glowPowerDirty) refreshGlowPower();
          glowPowerDirty = blackout;
        }
      }
      /**
       * NEON AND LIGHTBOX SIGNS
       * All shop signs, window neons, hotel scripts and tower names share one atlas
       * pair: a day face (the painted sign as it looks unlit: enamel board, glass
       * tubes, channel letters) and a glow mask (what lights up: the tubes' hot
       * core and their spill, a lightbox's panel). Both feed one lit material
       * (map + emissiveMap), so a sign reads as a proper sign by day, takes the sun
       * and shadows, and at night its tubes run hot enough in the HDR target to
       * bloom. Signs of one kind share a material, so the static batcher merges
       * them; the city power patch (cityPower() in lighting3d.js) dims them per
       * district in the blackout contract. A few materials stutter like old neon.
       */
      const NEON_ATLAS = 2048,
        neonDayCanvas = document.createElement('canvas'),
        neonGlowCanvas = document.createElement('canvas');
      neonDayCanvas.width = neonDayCanvas.height = neonGlowCanvas.width = neonGlowCanvas.height = NEON_ATLAS;
      const neonDay = neonDayCanvas.getContext('2d'),
        neonGlow = neonGlowCanvas.getContext('2d');
      neonGlow.fillStyle = '#000';
      neonGlow.fillRect(0, 0, NEON_ATLAS, NEON_ATLAS);
      function neonTexture(canvas) {
        const tx = new Three.CanvasTexture(canvas);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.minFilter = Three.LinearMipmapLinearFilter;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      const neonDayTexture = neonTexture(neonDayCanvas),
        neonGlowTexture = neonTexture(neonGlowCanvas),
        neonCells = new Map();
      let neonShelfX = 0,
        neonShelfY = 0,
        neonShelfH = 0;
      // Shelf-packs a cell (with a gutter so mip levels do not bleed between signs).
      function neonCell(key, w, h, paint) {
        if (neonCells.has(key)) return neonCells.get(key);
        if (neonShelfX + w + 8 > NEON_ATLAS) {
          neonShelfY += neonShelfH + 8;
          neonShelfX = 0;
          neonShelfH = 0;
        }
        if (neonShelfY + h + 8 > NEON_ATLAS) {
          // Every sign is packed up front (below); a new kind of sign needs room here.
          console.warn('Sign atlas full: ' + key);
          return neonCells.values().next().value;
        }
        const cell = { x: neonShelfX + 4, y: neonShelfY + 4, w, h };
        neonShelfX += w + 8;
        neonShelfH = Math.max(neonShelfH, h);
        for (const g of [neonDay, neonGlow]) {
          g.save();
          g.beginPath();
          g.rect(cell.x, cell.y, w, h);
          g.clip();
          g.translate(cell.x, cell.y);
        }
        paint(neonDay, neonGlow, w, h);
        neonDay.restore();
        neonGlow.restore();
        neonDayTexture.needsUpdate = neonGlowTexture.needsUpdate = true;
        neonCells.set(key, cell);
        return cell;
      }
      const neonMixTarget = new Three.Color(),
        neonMix = (a, b, t) => '#' + glowScratch.set(a).lerp(neonMixTarget.set(b), t).getHexString();
      function fitFont(g, text, weight, family, size, maxWidth) {
        let px = size;
        g.font = weight + ' ' + px + 'px ' + family;
        const w = g.measureText(text).width;
        if (w > maxWidth) px = Math.floor((px * maxWidth) / w);
        g.font = weight + ' ' + px + 'px ' + family;
        return px;
      }
      /**
       * Neon tubes: on the day face a tinted glass tube with its shadow on the
       * board; on the glow mask a coloured spill and a near-white core.
       */
      function neonTubeText(dg, gg, text, x, y, maxWidth, size, color, family = 'Arial, sans-serif', weight = '700') {
        for (const g of [dg, gg]) {
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.lineJoin = g.lineCap = 'round';
        }
        const px = fitFont(dg, text, weight, family, size, maxWidth),
          t = Math.max(2, px * 0.075);
        gg.font = dg.font;
        dg.strokeStyle = 'rgba(0,0,0,0.55)';
        dg.lineWidth = t * 1.5;
        dg.strokeText(text, x + t * 0.6, y + t * 0.9);
        dg.strokeStyle = neonMix(color, '#ffffff', 0.25);
        dg.lineWidth = t;
        dg.strokeText(text, x, y);
        dg.strokeStyle = 'rgba(255,255,255,0.55)';
        dg.lineWidth = t * 0.3;
        dg.strokeText(text, x - t * 0.15, y - t * 0.2);
        gg.shadowColor = color;
        gg.shadowBlur = px * 0.35;
        gg.strokeStyle = color;
        gg.lineWidth = t * 1.6;
        gg.globalAlpha = 0.55;
        gg.strokeText(text, x, y);
        gg.globalAlpha = 1;
        gg.shadowBlur = 0;
        gg.strokeStyle = color;
        gg.lineWidth = t;
        gg.strokeText(text, x, y);
        gg.strokeStyle = neonMix(color, '#ffffff', 0.7);
        gg.lineWidth = t * 0.4;
        gg.strokeText(text, x, y);
        return px;
      }
      function neonTubeRect(dg, gg, x, y, w, h, r, color) {
        const path = (g) => {
          g.beginPath();
          g.roundRect(x, y, w, h, r);
        };
        dg.lineWidth = 3;
        dg.strokeStyle = neonMix(color, '#ffffff', 0.25);
        path(dg);
        dg.stroke();
        gg.shadowColor = color;
        gg.shadowBlur = 10;
        gg.lineWidth = 4;
        gg.strokeStyle = color;
        path(gg);
        gg.stroke();
        gg.shadowBlur = 0;
        gg.lineWidth = 1.5;
        gg.strokeStyle = neonMix(color, '#ffffff', 0.7);
        path(gg);
        gg.stroke();
      }
      const NEON_COLORS = ['#ff4fa0', '#4ff0ff', '#ffd23f', '#7dff6a', '#ff6a3d', '#b77dff', '#ff3048', '#58a6ff'];
      // A small neon in a shop window: a tube border and a word (cut out).
      function signCell(style, text, color, accent = color) {
        return neonCell(style + '|' + text + '|' + color + '|' + accent, 160, 80, (dg, gg, w, h) => {
          neonTubeRect(dg, gg, 6, 6, w - 12, h - 12, 18, accent);
          neonTubeText(dg, gg, text, w / 2, h / 2 + 1, w - 30, 40, color);
        });
      }
      /**
       * Shop, hotel and tower-name faces come from the business designs
       * (signdesigns3d.js): one cell per name, so every branch of a business wears
       * the same sign, and the design says what colour it throws on the pavement
       * and whether it is neon that may stutter.
       */
      const shopDesigns = new Map(),
        hotelDesigns = new Map();
      function shopSignCell(name) {
        return neonCell('shop|' + name, 384, 96, (dg, gg, w, h) => shopDesigns.set(name, SignArt.paint(dg, gg, w, h, name, null, null, true)));
      }
      // The colour a shop sign throws on the pavement, and whether it is neon.
      function shopSignLight(name) {
        shopSignCell(name);
        return shopDesigns.get(name).light;
      }
      function shopSignIsNeon(name) {
        shopSignCell(name);
        return /^neon|tattoo|pixel/.test(shopDesigns.get(name).family);
      }
      const WINDOW_NEONS = ['OPEN', 'OPEN 24H', 'COLD BEER', 'LOTTO', 'ATM', 'ESPRESSO', 'PIZZA', 'TATTOO', 'CASH', 'LIVE MUSIC'],
        windowNeonColor = (word) => NEON_COLORS[nameHash(word) % 8],
        windowNeonCell = (word) => signCell('window', word, windowNeonColor(word), NEON_COLORS[(nameHash(word) >> 2) % 8]),
        hotelScriptCell = (i) => {
          const name = HOTEL_NAMES[i % HOTEL_NAMES.length];
          return neonCell('hotel|' + name, 384, 84, (dg, gg, w, h) => hotelDesigns.set(name, SignArt.paintHotel(dg, gg, w, h, name, '#ff6fae')));
        },
        hotelNeonColor = (i) => {
          hotelScriptCell(i);
          return hotelDesigns.get(HOTEL_NAMES[i % HOTEL_NAMES.length]).light;
        },
        towerNameCell = (name) => neonCell('tower|' + name, 384, 48, (dg, gg, w, h) => SignArt.paintTowerName(dg, gg, w, h, name));
      function nameHash(text) {
        let h = 7;
        for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        return h;
      }
      // Pack the atlas kind by kind, tallest first, so each shelf holds cells of one height.
      for (const name of SHOP_NAMES) shopSignCell(name);
      for (let i = 0; i < HOTEL_NAMES.length; i++) hotelScriptCell(i);
      for (const word of [...WINDOW_NEONS, 'VACANCY']) windowNeonCell(word);
      for (const t of SKYLINE_TOWERS) towerNameCell(t.name);
      // Remaps a plane's UVs onto an atlas cell.
      function atlasPlane(width, height, cell, sizeX = NEON_ATLAS, sizeY = sizeX) {
        const g = new Three.PlaneGeometry(width, height),
          uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++)
          uv.setXY(i, (cell.x + uv.getX(i) * cell.w) / sizeX, 1 - (cell.y + (1 - uv.getY(i)) * cell.h) / sizeY);
        return g;
      }
      // Emissive dims with the district's power (the blackout contract), in the shader.
      function signPowerPatch(shader) {
        cityMaterialPatch(shader);
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= cityPower();',
        );
      }
      const signMaterials = [];
      /**
       * A lit sign material. `night` is its emissive strength after dark (HDR),
       * `day` what is left in daylight; `flicker` makes it stutter now and then.
       */
      function litSignMaterial(map, emissiveMap, options = {}) {
        const material = new Three.MeshStandardMaterial({
          map,
          emissiveMap,
          emissive: '#ffffff',
          emissiveIntensity: 0,
          roughness: options.roughness ?? 0.45,
          metalness: options.metalness ?? 0.1,
          alphaTest: options.cutout ? 0.5 : 0,
          side: options.cutout || options.doubleSided ? Three.DoubleSide : Three.FrontSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        material.onBeforeCompile = signPowerPatch;
        material.customProgramCacheKey = () => 'city-sign';
        signMaterials.push({
          material,
          night: options.night ?? 3.2,
          day: options.day ?? 0.12,
          flicker: options.flicker || 0,
          phase: cityRandom() * 100,
          blank: false,
        });
        return material;
      }
      const neonBoard = litSignMaterial(neonDayTexture, neonGlowTexture),
        neonBoardFlicker = [0, 1].map(() => litSignMaterial(neonDayTexture, neonGlowTexture, { flicker: 1 })),
        neonCutout = litSignMaterial(neonDayTexture, neonGlowTexture, { cutout: true, night: 3.6 }),
        neonCutoutFlicker = litSignMaterial(neonDayTexture, neonGlowTexture, { cutout: true, night: 3.6, flicker: 1 });
      // A sign face from the atlas, in a group's local space. Returns the mesh.
      function atlasSign(parent, cell, x, y, z, width, height, material = neonBoard, yaw = 0) {
        const m = new Three.Mesh(atlasPlane(width, height, cell), material);
        m.position.set(x, y, z);
        m.rotation.y = yaw;
        m.receiveShadow = true;
        parent.add(m);
        return m;
      }
      // Neon flicker on the CPU for the few materials that stutter as a whole.
      function neonFlickerLevel(entry) {
        const slot = Math.floor(gameTime * 9 + entry.phase),
          hash = (n) => {
            const v = Math.sin(n * 12.9898 + entry.phase) * 43758.5453;
            return v - Math.floor(v);
          };
        return hash(Math.floor(slot / 11)) > 0.82 && hash(slot) < 0.5 ? 0.12 : 1;
      }
      /**
       * ADVERTISING
       * One painted atlas of ads serves the lamp-lit rooftop boards and the bus
       * shelters (UV-mapped, one shared material), and a few LED screen "channels"
       * that cycle through the ads on their own clocks with a beat of black between
       * spots. Every advertiser has its own layout, lettering and illustration
       * (SignArt.ADS in signdesigns3d.js), not one template.
       */
      const ADS = SignArt.ADS;
      const AD_COLS = 2,
        AD_ROWS = Math.ceil(ADS.length / AD_COLS),
        AD_W = 512,
        AD_H = 160,
        adCanvas = document.createElement('canvas');
      adCanvas.width = AD_COLS * AD_W;
      adCanvas.height = AD_ROWS * AD_H;
      {
        const g = adCanvas.getContext('2d');
        ADS.forEach(([, paintAd], i) => {
          g.save();
          g.translate((i % AD_COLS) * AD_W, Math.floor(i / AD_COLS) * AD_H);
          g.beginPath();
          g.rect(0, 0, AD_W, AD_H);
          g.clip();
          paintAd(g, AD_W, AD_H);
          g.restore();
        });
      }
      const adTexture = neonTexture(adCanvas),
        adCellOf = (i) => ({ x: (i % AD_COLS) * AD_W + 2, y: Math.floor(i / AD_COLS) * AD_H + 2, w: AD_W - 4, h: AD_H - 4 }),
        // Lamp-lit paper boards: the lamps wash the face at night.
        adBoardMaterial = litSignMaterial(adTexture, adTexture, { night: 0.5, day: 0, roughness: 0.65 }),
        adPlane = (width, height, index) => atlasPlane(width, height, adCellOf(index), adCanvas.width, adCanvas.height);
      // LED screens: each channel is a pair of texture views on the ad atlas.
      const adChannels = Array.from({ length: 4 }, (_, k) => {
        const map = adTexture.clone(),
          lit = adTexture.clone();
        for (const t of [map, lit]) t.repeat.set((AD_W - 4) / adCanvas.width, (AD_H - 4) / adCanvas.height);
        const material = litSignMaterial(map, lit, { night: 1.7, day: 0.85, roughness: 0.25, metalness: 0.2 });
        return { map, lit, material, entry: signMaterials[signMaterials.length - 1], index: 0, next: k * 2.3, span: 6.5 + k * 1.3, order: k * 3, blanking: false };
      });
      function showAd(channel, index) {
        channel.index = index;
        const cell = adCellOf(index);
        for (const t of [channel.map, channel.lit]) t.offset.set(cell.x / adCanvas.width, 1 - (cell.y + cell.h) / adCanvas.height);
      }
      adChannels.forEach((c, k) => showAd(c, (k * 3) % ADS.length));
      /**
       * STOCK TICKER
       * A scrolling LED band for the financial cluster's podiums: one texture
       * scrolled by its offset, so every ticker in the city is one material.
       */
      const tickerCanvas = document.createElement('canvas');
      tickerCanvas.width = 2048;
      tickerCanvas.height = 64;
      {
        const g = tickerCanvas.getContext('2d');
        g.fillStyle = '#05070a';
        g.fillRect(0, 0, 2048, 64);
        g.font = '700 34px "Courier New", monospace';
        g.textBaseline = 'middle';
        const quotes = ['NPX', 'FED', 'MERC', 'EVO', 'OKO', 'CAPT', 'NEVA', 'SAIL', 'GTIDE', 'KOLA', 'VOLTA', 'SPAIR', 'MARL', 'IRON'];
        for (let k = 0, x = 10; x < 1960; k++) {
          const name = quotes[k % quotes.length],
            up = Math.sin(k * 7.1) > -0.2,
            quote = (up ? '▲ ' : '▼ ') + (Math.abs(Math.sin(k * 3.3)) * 4.8).toFixed(2) + '%   ';
          g.fillStyle = '#ffd36b';
          g.fillText(name, x, 33);
          x += g.measureText(name + ' ').width;
          g.fillStyle = up ? '#57ff8a' : '#ff5a5a';
          g.fillText(quote, x, 33);
          x += g.measureText(quote).width;
        }
      }
      const tickerTexture = neonTexture(tickerCanvas);
      tickerTexture.wrapS = Three.RepeatWrapping;
      const tickerMaterial = litSignMaterial(tickerTexture, tickerTexture, { night: 2.4, day: 1.1, roughness: 0.3 });
      // A ticker band `width` long; the text keeps its aspect (2048 x 64 px per 32 x 1 heights).
      function tickerBand(parent, x, y, z, width, height, yaw = 0) {
        const g = new Three.PlaneGeometry(width, height),
          uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * width) / (height * 32));
        const m = new Three.Mesh(g, tickerMaterial);
        m.position.set(x, y, z);
        m.rotation.y = yaw;
        parent.add(m);
        return m;
      }
      /**
       * NEON TUBES AND BULBS
       * Bare tubes (club bars, door frames) are thin boxes in a tube material: pale
       * glass by day, the colour at full HDR strength at night; `cycle` walks the
       * hue and `pulse` breathes to a beat. Marquee bulbs are instanced spheres with
       * a chasing glow each.
       */
      const tubeWhite = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 4;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, 4, 4);
        return new Three.CanvasTexture(c);
      })();
      function neonTube(color, options = {}) {
        const material = litSignMaterial(null, tubeWhite, { night: options.night ?? 4.5, day: options.day ?? 0.25, roughness: 0.2 });
        material.color.set(neonMix(color, '#ffffff', 0.6));
        material.emissive.set(color);
        Object.assign(signMaterials[signMaterials.length - 1], { cycle: !!options.cycle, pulse: options.pulse || 0 });
        return material;
      }
      const bulbPool = instanced(sphereGeo, new Three.MeshStandardMaterial({ color: '#f6e7c4', roughness: 0.3, emissive: '#ffd89a', emissiveIntensity: 0.25 }), 2400);
      bulbPool.castShadow = false;
      // A row of chasing bulbs from (x0, y0, z0) to (x1, y1, z1), world space.
      function bulbRow(x0, y0, z0, x1, y1, z1, spacing = 4.5, color = '#ffd48a', start = 0) {
        const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0, z1 - z0) / spacing));
        for (let k = 0; k <= n; k++) {
          const t = k / n,
            x = x0 + (x1 - x0) * t,
            y = y0 + (y1 - y0) * t,
            z = z0 + (z1 - z0) * t;
          place(bulbPool, x, y, z, 0.8, 0.8, 0.8);
          addGlow(x, y, z + 0.8, 5, color, 2.2, { mode: 'chase', phase: ((start + k) % 3) / 3 });
        }
        return start + n + 1;
      }
      // Bulbs round a rectangle facing south: centre (x, y, z), width, height.
      function bulbFrame(x, y, z, width, height, spacing, color) {
        const l = x - width / 2,
          r = x + width / 2,
          b = y - height / 2,
          t = y + height / 2;
        let k = bulbRow(l, t, z, r, t, z, spacing, color, 0);
        k = bulbRow(r, t, z, r, b, z, spacing, color, k);
        k = bulbRow(r, b, z, l, b, z, spacing, color, k);
        bulbRow(l, b, z, l, t, z, spacing, color, k);
      }
      // Once every sign is in place: spill, wet streaks and marquees for sign() boards.
      function finishSignBoards() {
        for (const s of signBoards.splice(0)) {
          const p = s.mesh.getWorldPosition(new Three.Vector3()),
            h = s.width / 4;
          if (s.marquee) bulbFrame(p.x, p.y, p.z + 1.4, s.width + 6, h + 6, 4.2, '#ffd48a');
          // Floodlit boards: goose-neck lamps along the top edge, in the board's own frame.
          if (s.lamps)
            for (const f of s.width > 90 ? [-0.34, 0, 0.34] : [-0.25, 0.25]) {
              const lamp = s.mesh.localToWorld(new Three.Vector3(f * s.width, h / 2 + 2.2, 3.2));
              addGlow(lamp.x, lamp.y, lamp.z, Math.min(16, 6 + s.width * 0.04), '#ffe2b0', 1.3, { day: 0 });
            }
          if (p.y < 60)
            signSpill(p.x, p.z + 10, Math.max(40, s.width * 0.55), s.color, 0.3, { width: s.width * 0.7, length: 90, strength: 0.8 });
        }
      }
      // Per frame: sign strength by the hour, flicker, LED channels and the ticker.
      function updateSignage(night) {
        for (const c of adChannels) {
          if (gameTime < c.next) continue;
          // A beat of black between spots, the way a screen changes over.
          c.blanking = !c.blanking;
          c.entry.blank = c.blanking;
          if (c.blanking) c.next = gameTime + 0.18;
          else {
            showAd(c, (c.index + 1 + c.order) % ADS.length);
            c.next = gameTime + c.span;
          }
        }
        for (const s of signMaterials) {
          let level = s.flicker ? neonFlickerLevel(s) : 1;
          if (s.pulse) level *= 0.62 + 0.38 * Math.max(0, Math.sin(gameTime * s.pulse * TAU + s.phase));
          if (s.cycle) s.material.emissive.setHSL((gameTime * 0.07 + s.phase) % 1, 0.9, 0.55);
          s.material.emissiveIntensity = (s.day + (s.night - s.day) * night) * level * (s.blank ? 0.05 : 1);
        }
        tickerTexture.offset.x = (gameTime * 0.06) % 1;
      }
      // END SUBSYSTEM: src/signage3d.js
