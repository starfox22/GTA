      // BEGIN SUBSYSTEM: src/bridges3d.js — Bridges: one architecture per crossing
      /**
       * Bridges
       * Source: src/bridges3d.js
       * Scope: createCityRenderer() closure, after boats3d.js (bridges are built
       * with the boat kit: tint(), kitMerge(), kitLight()).
       *
       * Every road bridge in BRIDGES is drawn from bridgeStructure() (geography.js),
       * the same piers, towers, cables and channels that aircraft and boats collide
       * with, in the bridge's own style:
       *   truss       Keys Bridge: a green steel camel-back through-truss
       *   bascule     Palm Sound Causeway: a low causeway, globe lamps and a working
       *               double-leaf trunnion bascule (drawbridge3d.js)
       *   cablestay   East Bay Crossing: a white A-pylon and two fans of stays
       *   suspension  South Bay Bridge: red towers, main cables and hangers
       *   arch        Sunset Pier Bridge: a leaning network arch in LED colours
       *   segmental   Oceanview Causeway: a low viaduct, fishing balconies and
       *               striped channel beacons
       *   extradosed  Coral Sound Bridge: coral sail pylons and harps of stays
       *   hpylon      Ridgeline Viaduct: concrete H-pylons, a weathering-steel girder
       *   swing       Sentinel Causeway: olive plate girders, a swing span, floodlights
       * Each bridge is built in its own frame (x along the deck from the middle,
       * z across to the right of a -> b, y up from the road) and merged into a few
       * vertex-coloured meshes; its night lights are one points cloud. Lamps,
       * cable LEDs, uplighting and the red aviation beacons come up at dusk
       * (updateBridgeVisuals, called from updateCountyVisuals). A plain far copy of
       * every bridge stands in when the whole city is in view (flight-view3d.js).
       */
      const BRIDGE_KIT = {
        concrete: tint('#b6b2a6', 'satin'),
        concreteDark: tint('#8e8b82', 'satin'),
        stone: tint('#a79d8b', 'matte'),
        asphalt: tint('#3c4448', 'matte'),
        walk: tint('#9d9a92', 'matte'),
        kerb: tint('#c8c5bb', 'satin'),
        white: tint('#ecebe5', 'matte'),
        yellow: tint('#e0bf62', 'matte'),
        joint: tint('#2a2e30', 'metal'),
        steel: tint('#8d969a', 'metal'),
        darkSteel: tint('#373d41', 'metal'),
        cable: tint('#d9dde0', 'metal'),
        timber: tint('#6d5540', 'matte'),
        glass: kitGlass,
      };
      // Lamp heads: pale by day, warm and bright (bloom) at night.
      const bridgeLampMaterial = new Three.MeshBasicMaterial({ color: '#d9d5c9', toneMapped: false });
      const bridgeLampDay = new Three.Color('#d9d5c9'),
        bridgeLampNight = new Three.Color('#ffe0a0').multiplyScalar(2.2);
      // Painted structure that is floodlit at night: the paint's own colour as emissive.
      const bridgeGlowMaterials = [];
      function bridgeGlowPaint(color, glow, strength, finish = 'satin') {
        const m = new Three.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: 0, ...KIT_FINISHES[finish] });
        m.userData.glow = strength;
        bridgeGlowMaterials.push(m);
        return m;
      }
      // LED strips: dark by day, their colour at night; `cycle` sweeps the hue.
      const bridgeLedMaterials = [];
      function bridgeLed(color, strength = 1.6, cycle = 0) {
        const m = new Three.MeshBasicMaterial({ color: '#2b3033', toneMapped: false });
        m.userData.led = { base: new Three.Color(color), strength, cycle };
        bridgeLedMaterials.push(m);
        return m;
      }
      /* Lamp light on the deck. Each bridge paints its lamps' pools into a small
         light map of its own deck (along x across, about 2 units a texel) once it
         is built, and the carriageway, footways and kerbs add it as light in
         their shader, as the city streets do with the night light map
         (lighting3d.js): lit by their own albedo, with a sheen on wet tarmac.
         (Additive halo planes lying on the deck read as orange fog over black
         asphalt and were cut off by the kerbs.) Each lamp also smears down the
         wet road in the rain (signage3d.js streaks). */
      const bridgeDeckLampPower = { value: 0 };
      function bridgeDeckLight(length, halfWidth) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(2048, Math.ceil(length / 2));
        canvas.height = 64;
        const texture = new Three.CanvasTexture(canvas);
        texture.colorSpace = Three.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = Three.LinearFilter;
        texture.flipY = false;
        return { canvas, texture, length, halfWidth };
      }
      // Paint the pools ({x along from the middle, z across, size}) into the map.
      function paintBridgeDeckLight(light, from, pools) {
        const g = light.canvas.getContext('2d'),
          sx = light.canvas.width / light.length,
          sz = light.canvas.height / (light.halfWidth * 2);
        g.fillStyle = '#000';
        g.fillRect(0, 0, light.canvas.width, light.canvas.height);
        g.globalCompositeOperation = 'lighter';
        for (const p of pools) {
          const u = (p.x - from) * sx,
            v = (p.z + light.halfWidth) * sz,
            r = p.size;
          g.save();
          g.translate(u, v);
          g.scale(sx, sz);
          const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
          grad.addColorStop(0, 'rgba(255,205,150,0.95)');
          grad.addColorStop(0.3, 'rgba(255,196,135,0.6)');
          grad.addColorStop(0.65, 'rgba(255,186,120,0.18)');
          grad.addColorStop(1, 'rgba(255,180,110,0)');
          g.fillStyle = grad;
          g.fillRect(-r, -r, r * 2, r * 2);
          g.restore();
        }
        g.globalCompositeOperation = 'source-over';
        light.texture.needsUpdate = true;
      }
      // A lamp's pool at (x, z) in the bridge's frame, and its smear on the wet road.
      function bridgePool(g, x, z, size) {
        g.updateMatrixWorld(true);
        const p = g.localToWorld(new Three.Vector3(x, 0, z));
        addStreak(p.x, p.z, size * 0.22, size * 1.5, '#ffcf96', 0.9, { phase: Math.random() });
        return { x, z, size };
      }
      const BRIDGE_DECK_LIGHT_PARS = `
        varying vec2 vDeckUv;
        uniform sampler2D deckLampMap;
        uniform float deckLampPower;
        uniform float deckFrom;
        uniform float deckLength;
        uniform float deckHalfWidth;`;
      const BRIDGE_DECK_LIGHT_APPLY = `
        {
          vec2 lampUv = vec2( ( vDeckUv.x - deckFrom ) / deckLength, vDeckUv.y / ( deckHalfWidth * 2.0 ) + 0.5 );
          vec3 deckLamp = texture2D( deckLampMap, lampUv ).rgb * deckLampPower;
          reflectedLight.directDiffuse += deckLamp * material.diffuseColor;
          reflectedLight.directSpecular += deckLamp * 0.7 * ( 1.0 - material.roughness ) * ( 1.0 - material.roughness );
        }`;
      // Uniforms for a material of this bridge's deck.
      function bridgeDeckUniforms(light) {
        return {
          deckLampMap: { value: light.texture },
          deckLampPower: bridgeDeckLampPower,
          deckFrom: { value: 0 },
          deckLength: { value: light.length },
          deckHalfWidth: { value: light.halfWidth },
        };
      }
      // Footways and kerbs: their own colour, lit by the deck's lamps.
      function bridgeLitMaterial(base, light) {
        const m = new Three.MeshStandardMaterial({ color: base.color, roughness: base.roughness, metalness: base.metalness }),
          uniforms = bridgeDeckUniforms(light);
        m.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vDeckUv;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\nvDeckUv = uv;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n' + BRIDGE_DECK_LIGHT_PARS)
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + BRIDGE_DECK_LIGHT_APPLY);
        };
        m.customProgramCacheKey = () => 'bridge-walk';
        return m;
      }
      /* Foam round a footing: a ring of broken white water fading outward, painted
         once. It lies just above the highest swell crest so waves never poke
         through it (world3d.js: flat overlays under the surface did). */
      const bridgeFoamTexture = (() => {
        const size = 256,
          cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const g = cv.getContext('2d');
        let seed = 11;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 2600; i++) {
          // Speckles gathered toward the inner edge of a rounded-square ring.
          const t = rnd() * Math.PI * 2,
            r = 0.3 + Math.pow(rnd(), 1.8) * 0.2,
            k = Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t))),
            x = size / 2 + (Math.cos(t) / Math.pow(k, 0.7)) * r * size * 0.92,
            y = size / 2 + (Math.sin(t) / Math.pow(k, 0.7)) * r * size * 0.92,
            fade = 1 - (r - 0.3) / 0.2;
          g.fillStyle = `rgba(255,255,255,${0.12 + fade * 0.45})`;
          g.beginPath();
          g.arc(x, y, 1 + rnd() * 3.5 * fade, 0, Math.PI * 2);
          g.fill();
        }
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        return tx;
      })();
      const bridgeFoamMaterial = new Three.MeshBasicMaterial({
        map: bridgeFoamTexture,
        color: '#eef7f5',
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      // Portal plaques and signs: one small atlas of their own (the boat-name atlas is full).
      const bridgePlaqueCanvas = document.createElement('canvas');
      bridgePlaqueCanvas.width = 1024;
      bridgePlaqueCanvas.height = 1024;
      const bridgePlaqueTexture = new Three.CanvasTexture(bridgePlaqueCanvas);
      bridgePlaqueTexture.colorSpace = Three.SRGBColorSpace;
      bridgePlaqueTexture.anisotropy = 4;
      const bridgePlaqueMaterial = new Three.MeshBasicMaterial({ map: bridgePlaqueTexture, side: Three.DoubleSide, toneMapped: false });
      // One 512 x 128 cell per distinct plaque (sixteen cells), reused by repeats.
      const bridgePlaqueCells = new Map();
      function bridgePlaque(parent, text, sub, background, color, width, x, y, z, rotationY) {
        const key = [text, sub, background, color].join('|'),
          known = bridgePlaqueCells.has(key),
          index = known ? bridgePlaqueCells.get(key) : bridgePlaqueCells.size % 16,
          cx = (index % 2) * 512,
          cy = Math.floor(index / 2) * 128,
          g = bridgePlaqueCanvas.getContext('2d');
        bridgePlaqueCells.set(key, index);
        if (!known) bridgePlaqueCell(g, text, sub, background, color, cx, cy);
        const geo = new Three.PlaneGeometry(width, width / 4),
          uv = geo.attributes.uv,
          u0 = (index % 2) / 2,
          v1 = 1 - cy / 1024,
          v0 = v1 - 128 / 1024;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u0 + 0.5 : u0, uv.getY(i) > 0.5 ? v1 : v0);
        const m = mesh(geo, bridgePlaqueMaterial, parent, x, y, z);
        m.rotation.y = rotationY;
        m.castShadow = false;
        return m;
      }
      function bridgePlaqueCell(g, text, sub, background, color, cx, cy) {
        g.fillStyle = background;
        g.fillRect(cx, cy, 512, 128);
        g.strokeStyle = color;
        g.lineWidth = 6;
        g.strokeRect(cx + 8, cy + 8, 496, 112);
        g.fillStyle = color;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '700 54px "Helvetica Neue", Arial, sans-serif';
        g.fillText(text.split('').join(String.fromCharCode(8202)), cx + 256, cy + (sub ? 50 : 64), 470);
        if (sub) {
          g.font = '600 24px "Helvetica Neue", Arial, sans-serif';
          g.fillText(sub, cx + 256, cy + 100, 420);
        }
        bridgePlaqueTexture.needsUpdate = true;
      }
      /* ---- Members ---------------------------------------------------------------- */
      const bridgeCableGeo = new Three.CylinderGeometry(1, 1, 1, 5, 1, true),
        bridgeUp = new Three.Vector3(0, 1, 0),
        V3 = (x, y, z) => new Three.Vector3(x, y, z);
      // A thin cable (a five-sided tube, cheap in bulk) from a to b.
      function bridgeCable(parent, a, b, r, material) {
        const dir = new Three.Vector3().subVectors(b, a),
          len = dir.length();
        const m = mesh(bridgeCableGeo, material, parent, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, r, len, r);
        m.quaternion.setFromUnitVectors(bridgeUp, dir.normalize());
        return m;
      }
      /* A straight member of rectangular section from a to b: `w` is its width in
         the plane it leans in (along the bridge for a truss, across it for a
         pylon leg), `d` its depth the other way. */
      function bridgeMember(parent, a, b, w, d, material) {
        const dir = new Three.Vector3().subVectors(b, a),
          len = dir.length();
        const m = mesh(boxGeo, material, parent, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, w, len, d);
        m.quaternion.setFromUnitVectors(bridgeUp, dir.normalize());
        return m;
      }
      function bridgeTube(parent, points, r, material, radial = 6) {
        const curve = new Three.CatmullRomCurve3(points);
        return mesh(new Three.TubeGeometry(curve, points.length * 2, r, radial, false), material, parent, 0, 0, 0);
      }
      // A flat-topped block with pointed ends across the deck: a cutwater pier.
      function cutwaterPier(parent, along, hx, hy, bottom, top, material) {
        const nose = Math.min(hx * 1.6, 24),
          outline = [
            [along - hx, -hy + nose],
            [along, -hy],
            [along + hx, -hy + nose],
            [along + hx, hy - nose],
            [along, hy],
            [along - hx, hy - nose],
          ];
        mesh(prismGeometry(outline, outline, bottom, top, true), material, parent, 0, 0, 0);
      }
      /* ---- Carriageway surface ------------------------------------------------------ */
      /**
       * The road on every deck is one shaded surface rather than a flat grey box
       * with boxes of paint on it: the markings are drawn in the shader with
       * pixel-footprint antialiasing (crisp at any zoom, no z-fighting, no
       * shimmering dashes), and the asphalt carries the wear a real bridge deck
       * shows: aggregate grain and stone chips, polished tyre paths down every
       * lane, tar-sealed longitudinal seams, repair patches, oil drips, a gutter
       * of grime along each kerb with drain grates, and worn paint. When it rains
       * the surface darkens, the tyre ruts and gutters hold water and the paint
       * and puddles go glossy (weather.wet, via cityWet), so lamps and headlights
       * streak in it like the city streets.
       * The geometry's uv is (distance from the deck's start, across the deck to
       * the right), both in world units; one material per bridge carries its
       * half-width and length, all sharing one program.
       */
      const BRIDGE_ROAD_VERTEX = `
        vDeckUv = uv;`;
      const BRIDGE_ROAD_ALBEDO = `
        vec2 dUv = vDeckUv;
        vec2 wp = vCityWorld.xz;
        float acr = abs( dUv.y );
        float footprint = length( fwidth( dUv ) );
        float detail = 1.0 - smoothstep( 0.6, 2.5, footprint );
        float laneW = deckHalfRoad * 0.5;
        // Aggregate: two octaves of grain, broad tonal drift and pale stone chips.
        float g1 = cityNoise( wp * 1.7 ), g2 = cityNoise( wp * 4.3 + 7.0 ), g3 = cityNoise( wp * 0.045 + 3.0 );
        float grain = mix( 0.5, g1 * 0.55 + g2 * 0.45, detail );
        vec3 roadColor = vec3( 0.043, 0.047, 0.05 ) * ( 0.86 + 0.28 * grain ) * ( 0.88 + 0.24 * g3 );
        roadColor += vec3( 0.014 ) * step( 0.9, cityHash( floor( wp * 2.6 ) ) ) * detail;
        // Tyre paths: two polished, slightly darker bands down every lane.
        float laneOffset = abs( mod( acr, laneW ) - laneW * 0.5 );
        float track = 1.0 - smoothstep( 1.0, 3.4, abs( laneOffset - laneW * 0.19 ) );
        track *= step( acr, deckHalfRoad - 1.0 );
        roadColor *= 1.0 - 0.16 * track;
        // Oil drips down the middle of each lane.
        float oil = smoothstep( 0.62, 0.8, cityNoise( vec2( dUv.x * 0.09, dUv.y * 0.7 ) + 19.0 ) ) * ( 1.0 - smoothstep( 1.5, 4.0, laneOffset ) );
        roadColor *= 1.0 - 0.3 * oil * detail;
        // Repair patches: rectangles of fresher or older tar, one lane wide or less.
        vec2 cellSize = vec2( 70.0, laneW );
        vec2 cell = floor( dUv / cellSize ), cf = fract( dUv / cellSize );
        float pick = cityHash( cell + 13.7 );
        vec2 lo = vec2( 0.1 + 0.3 * cityHash( cell + 2.1 ), 0.08 + 0.2 * cityHash( cell + 5.3 ) );
        vec2 hi = lo + vec2( 0.2 + 0.35 * cityHash( cell + 8.9 ), 0.45 + 0.25 * cityHash( cell + 4.4 ) );
        vec2 cfw = fwidth( cf ) + 1e-4;
        vec2 inside = smoothstep( lo - cfw, lo + cfw, cf ) * ( 1.0 - smoothstep( hi - cfw, hi + cfw, cf ) );
        float repair = inside.x * inside.y * step( 0.8, pick );
        vec2 edgeDist = min( abs( cf - lo ), abs( cf - hi ) ) * cellSize;
        float repairSeam = repair * ( 1.0 - smoothstep( 0.0, 0.5 + footprint, min( edgeDist.x, edgeDist.y ) ) );
        roadColor = mix( roadColor, roadColor * ( pick > 0.9 ? 0.72 : 1.18 ), repair );
        roadColor *= 1.0 - 0.35 * repairSeam * detail;
        // Tar-sealed seams where the lanes were laid, and hairline cracks.
        float wobble = ( cityNoise( vec2( dUv.x * 0.05, 3.0 ) ) - 0.5 ) * 0.8;
        float seam = ( 1.0 - smoothstep( 0.15, 0.45 + footprint, abs( acr - laneW + wobble ) ) ) * detail;
        float crack = ( 1.0 - smoothstep( 0.0, 0.016, abs( cityNoise( wp * 0.06 + 3.0 ) - 0.5 ) ) )
                    * smoothstep( 0.55, 0.75, cityNoise( wp * 0.011 + 9.0 ) ) * detail;
        roadColor *= ( 1.0 - 0.45 * seam ) * ( 1.0 - 0.45 * crack );
        // Gutter: grime along the kerb and a drain grate every 36 units.
        float gutter = smoothstep( deckHalfRoad - 3.5, deckHalfRoad - 0.2, acr );
        roadColor = mix( roadColor, roadColor * vec3( 0.78, 0.76, 0.72 ) + vec3( 0.012, 0.011, 0.009 ), gutter * ( 0.6 + 0.4 * g2 ) );
        float grateAlong = abs( mod( dUv.x, 36.0 ) - 18.0 ), grateAcross = deckHalfRoad - 1.4 - acr;
        float grate = step( grateAlong, 2.2 ) * step( abs( grateAcross ), 1.1 );
        float slots = step( 0.5, fract( dUv.x * 1.6 ) );
        roadColor = mix( roadColor, vec3( 0.03, 0.032, 0.034 ) * ( 0.55 + 0.9 * slots ), grate );
        // Paint: edge lines, broken lane lines and the double yellow, antialiased.
        float fwA = max( fwidth( acr ), 1e-3 );
        float edgeLine = 1.0 - smoothstep( 0.55 - fwA, 0.55 + fwA, abs( acr - ( deckHalfRoad - 3.0 ) ) );
        float centreLine = 1.0 - smoothstep( 0.45 - fwA, 0.45 + fwA, abs( acr - 1.3 ) );
        float dashPos = mod( dUv.x - 1.0, 48.0 ), fwD = max( fwidth( dUv.x ), 1e-3 );
        float dashOn = smoothstep( -fwD, fwD, dashPos ) * ( 1.0 - smoothstep( 22.0 - fwD, 22.0 + fwD, dashPos ) )
                     * step( 10.0, dUv.x ) * step( dUv.x, deckRoadLength - 10.0 );
        float laneLine = ( 1.0 - smoothstep( 0.5 - fwA, 0.5 + fwA, abs( acr - laneW ) ) ) * dashOn;
        float wear = smoothstep( 0.45, 0.85, cityNoise( wp * 0.7 + 5.0 ) * 0.65 + g2 * 0.35 + track * 0.25 ) * detail;
        float white = max( edgeLine, laneLine ) * ( 1.0 - 0.55 * wear );
        float yellow = centreLine * ( 1.0 - 0.5 * wear );
        float paint = max( white, yellow );
        roadColor = mix( roadColor, vec3( 0.66, 0.66, 0.62 ) * ( 0.92 + 0.12 * g1 ), white );
        roadColor = mix( roadColor, vec3( 0.64, 0.42, 0.08 ) * ( 0.92 + 0.12 * g1 ), yellow );
        // Rain: the whole deck darkens as it soaks, ruts and gutters hold water.
        float deckWet = cityWet;
        float puddle = smoothstep( 0.56, 0.64, cityNoise( wp * 0.03 + 41.0 ) * 0.8 + track * 0.14 + gutter * 0.3 + g1 * 0.04 )
                     * smoothstep( 0.2, 0.8, deckWet ) * ( 1.0 - paint * 0.7 ) * ( 1.0 - grate );
        roadColor *= 1.0 - 0.32 * deckWet - 0.3 * puddle;
        diffuseColor.rgb = roadColor;`;
      const BRIDGE_ROAD_ROUGHNESS = `
        roughnessFactor = mix( 0.9 - 0.14 * track - 0.06 * repair + 0.05 * grain, 0.62, paint );
        roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.42, deckWet );
        roughnessFactor = mix( roughnessFactor, 0.11, puddle );`;
      const BRIDGE_ROAD_NORMAL = `
        {
          float e = 0.25, h0 = cityNoise( wp * 4.3 );
          vec2 slope = vec2( cityNoise( ( wp + vec2( e, 0.0 ) ) * 4.3 ) - h0, cityNoise( ( wp + vec2( 0.0, e ) ) * 4.3 ) - h0 ) / e;
          float bump = 0.1 * ( 1.0 - puddle ) * ( 1.0 - 0.6 * paint ) * detail;
          vec3 worldNormal = normalize( vec3( -slope.x * bump, 1.0, -slope.y * bump ) );
          normal = normalize( ( viewMatrix * vec4( worldNormal, 0.0 ) ).xyz );
        }`;
      function bridgeRoadMaterial(halfRoad, length, light) {
        const m = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, metalness: 0 }),
          uniforms = { deckHalfRoad: { value: halfRoad }, deckRoadLength: { value: length }, ...bridgeDeckUniforms(light) };
        m.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vDeckUv;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\n' + BRIDGE_ROAD_VERTEX);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float deckHalfRoad;\nuniform float deckRoadLength;\n' + BRIDGE_DECK_LIGHT_PARS + SURFACE_NOISE)
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + BRIDGE_ROAD_ALBEDO)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + BRIDGE_ROAD_ROUGHNESS)
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = 0.0;')
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + BRIDGE_ROAD_NORMAL)
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + BRIDGE_DECK_LIGHT_APPLY.replace('* deckLampPower', '* deckLampPower * 1.7'));
        };
        m.customProgramCacheKey = () => 'bridge-road';
        return m;
      }
      // The carriageway slab, its uv laid out as bridgeRoadMaterial expects.
      // `across` is where the box's centre line sits across the deck; `start` is
      // how far along the deck the piece begins (a deck in several pieces, the
      // drawbridge's leaves), so the markings and lamp light run on across them.
      function bridgeRoadGeometry(length, width, thickness, across = 0, start = 0) {
        const geo = new Three.BoxGeometry(length, thickness, width),
          pos = geo.attributes.position,
          uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) + length / 2 + start, pos.getZ(i) + across);
        return geo;
      }
      /* ---- Shared deck ------------------------------------------------------------- */
      /**
       * The deck over the water (and a little onto each shore): structural slab and
       * fascia, carriageway (bridgeRoadMaterial: asphalt and markings), raised
       * sidewalks on kerbs, modular expansion joints over the piers, abutments,
       * and the guard rails in the bridge's own look where countyBridgeRails (the
       * collision) has them. `look.gap` [from, to] leaves a stretch out (the
       * drawbridge's moving span, drawn with its leaves); the deck's materials are
       * kept in g.userData.deckMaterials for pieces drawn elsewhere.
       */
      function bridgeDeck(g, bridge, s, look) {
        const W = bridge.width,
          from = s.water[0] - 36,
          to = s.water[1] + 36,
          L = to - from,
          road = W - 22,
          pieces = look.gap
            ? [
                [from, look.gap[0]],
                [look.gap[1], to],
              ]
            : [[from, to]];
        // The deck's lamp light map; the builder's lamps are painted in after it (Build).
        const light = bridgeDeckLight(L, W / 2 + 2),
          walk = bridgeLitMaterial(look.walk || BRIDGE_KIT.walk, light),
          kerb = bridgeLitMaterial(BRIDGE_KIT.kerb, light),
          roadMaterial = bridgeRoadMaterial(road / 2, L, light);
        g.userData.deckLight = { light, from };
        g.userData.deckMaterials = { road: roadMaterial, walk, kerb, from, length: L };
        for (const [p0, p1] of pieces) {
          const length = p1 - p0,
            mid = (p0 + p1) / 2,
            start = p0 - from;
          box(g, mid, -3.3, 0, length, 6.6, W + 4, look.fascia || BRIDGE_KIT.concrete);
          mesh(bridgeRoadGeometry(length, road, 0.4, 0, start), roadMaterial, g, mid, 0.2, 0);
          for (const side of [-1, 1]) {
            mesh(bridgeRoadGeometry(length, 11, 1.1, side * (W / 2 - 5.5), start), walk, g, mid, 0.55, side * (W / 2 - 5.5));
            mesh(bridgeRoadGeometry(length, 0.8, 1.24, side * (road / 2 + 0.4), start), kerb, g, mid, 0.62, side * (road / 2 + 0.4));
            // A pale arris along the kerb's top edge catches the light.
            box(g, mid, 1.26, side * (road / 2 + 0.12), length, 0.06, 0.25, BRIDGE_KIT.white);
          }
        }
        const inGap = (x, pad = 0) => look.gap && x > look.gap[0] - pad && x < look.gap[1] + pad;
        /* Modular expansion joints over every pier: two steel edge beams either side
           of a dark rubber seal, right across the carriageway and both footways,
           finished flush with the road (a hair proud so they never flicker). */
        const joints = new Set();
        for (const f of s.footings) {
          const key = Math.round(f.along);
          if (f.along < from + 4 || f.along > to - 4 || joints.has(key) || inGap(f.along, 4) || Math.abs(f.across) > W / 2) continue;
          joints.add(key);
          box(g, f.along, 0.42, 0, 1.0, 0.06, road, BRIDGE_KIT.joint);
          for (const dx of [-0.85, 0.85]) box(g, f.along + dx, 0.43, 0, 0.7, 0.06, road, BRIDGE_KIT.darkSteel);
          for (const side of [-1, 1]) box(g, f.along, 1.12, side * (W / 2 - 5.5), 1.4, 0.06, 11, BRIDGE_KIT.darkSteel);
        }
        // Abutments where the deck lands on each shore.
        for (const [x, dir] of [
          [from, -1],
          [to, 1],
        ]) {
          box(g, x + dir * 6, -2, 0, 16, 5, W + 18, BRIDGE_KIT.concreteDark);
          for (const side of [-1, 1]) box(g, x + dir * 2, 2.5, side * (W / 2 + 6), 26, 5, 5, BRIDGE_KIT.concreteDark);
        }
        const rail = look.rail || guardSteel(BRIDGE_KIT.steel);
        for (const part of countyBridgeRails(bridge)) {
          if (!look.gap) {
            rail(g, part.localX, part.side * (W / 2 - 1), part.hx * 2, part.side);
            continue;
          }
          // Cut round the gap: the leaves carry their own railings.
          for (const [p0, p1] of pieces) {
            const a = Math.max(p0, part.localX - part.hx),
              b = Math.min(p1, part.localX + part.hx);
            if (b - a > 1) rail(g, (a + b) / 2, part.side * (W / 2 - 1), b - a, part.side);
          }
        }
      }
      // Guard rail looks: each is (group, along, across, length, side).
      function guardSteel(material, height = 7) {
        return (g, x, z, length) => {
          box(g, x, height, z, length, 1.4, 1.2, material);
          box(g, x, height * 0.55, z, length, 0.7, 0.8, material);
          box(g, x, height / 2, z, 0.9, height, 0.9, material);
        };
      }
      function guardBalustrade(material, cap) {
        return (g, x, z, length) => {
          box(g, x, 6.6, z, length, 1.2, 2.4, cap);
          box(g, x, 1.3, z, length, 1.6, 2.2, cap);
          for (let k = -length / 2 + 2.5; k < length / 2; k += 5) box(g, x + k, 3.8, z, 1.4, 4.2, 1.4, material);
        };
      }
      function guardGlass(frame, led) {
        return (g, x, z, length) => {
          box(g, x, 4.2, z, length, 7, 0.4, BRIDGE_KIT.glass);
          box(g, x, 8, z, length, 0.8, 1.3, frame);
          box(g, x, 7.4, z, length, 0.3, 0.5, led);
          box(g, x, 4, z, 1, 8, 1, frame);
        };
      }
      function guardJersey(material, rail) {
        return (g, x, z, length, side) => {
          box(g, x, 2.3, z - side * 0.6, length, 4.6, 3.2, material);
          box(g, x, 7, z, length, 1, 1, rail);
          box(g, x, 5.6, z, 0.8, 2.6, 0.8, rail);
        };
      }
      /* Lamp posts along both edges, just outside the rail, every `spacing` along
         the water, skipping anything standing there already. */
      function bridgeLamps(g, bridge, s, lights, pools, spacing, kind, pole, keepOut = []) {
        const W = bridge.width,
          [w0, w1] = s.water,
          n = Math.max(1, Math.round((w1 - w0) / spacing)),
          step = (w1 - w0) / n;
        for (let k = 0; k <= n; k++) {
          const x = w0 + step * k;
          if (keepOut.some(([a, b]) => x > a && x < b)) continue;
          for (const side of [-1, 1]) {
            // Staggered: each side takes every other position on the long spans.
            if (kind !== 'globe' && (k + (side > 0 ? 1 : 0)) % 2 && spacing < 70) continue;
            bridgeLampPost(g, x, side, W, kind, pole, lights, pools);
          }
        }
      }
      function bridgeLampPost(g, x, side, W, kind, pole, lights, pools) {
        const z = side * (W / 2 + 1.8),
          head = (hx, hy, hz, sx, sy, sz) => {
            box(g, hx, hy, hz, sx, sy, sz, bridgeLampMaterial);
            kitLight(lights, g, hx, hy - 1.5, hz, '#ffd7a0');
          },
          pool = (px, pz, size) => pools.push(bridgePool(g, px, pz, size));
        if (kind === 'globe') {
          // Ornamental: fluted cast-iron post, two arms, glass globes.
          box(g, x, 1.5, z, 3.2, 3, 3.2, pole);
          box(g, x, 13, z, 1.3, 24, 1.3, pole);
          box(g, x, 23, z, 0.8, 0.8, 11, pole);
          for (const dz of [-5, 5]) {
            mesh(sphereGeo, bridgeLampMaterial, g, x, 25.4, z + dz, 2.2, 2.2, 2.2);
            kitLight(lights, g, x, 25.4, z + dz, '#ffe2b0');
          }
          mesh(sphereGeo, bridgeLampMaterial, g, x, 27.5, z, 1.9, 2.4, 1.9);
          pool(x, z - side * 6, 34);
        } else if (kind === 'blade') {
          // Modern: a slim blade leaning out over the road with an LED bar.
          box(g, x, 15, z, 1.2, 30, 2, pole);
          bridgeMember(g, V3(x, 29, z), V3(x, 31.5, z - side * 9), 1.2, 1.8, pole);
          head(x, 31, z - side * 8, 1.8, 0.5, 7);
          pool(x, z - side * 12, 40);
        } else if (kind === 'mast') {
          // Floodlight mast: a lattice-less steel pole with a bank of four lamps.
          box(g, x, 22, z, 1.8, 44, 1.8, pole);
          box(g, x, 44, z, 8, 1, 3, pole);
          for (const dx of [-3, 3]) head(x + dx, 43, z - side * 2, 2.6, 2, 2.6);
          pool(x, z - side * 16, 58);
        } else if (kind === 'twin') {
          // Tall twin-headed mast, one arm out over each carriageway lane.
          box(g, x, 19, z, 1.4, 38, 1.4, pole);
          for (const dx of [-1, 1]) {
            bridgeMember(g, V3(x, 36, z), V3(x + dx * 7, 38.5, z - side * 7), 0.9, 0.9, pole);
            head(x + dx * 7, 38, z - side * 7, 5, 1.2, 2.6);
          }
          pool(x, z - side * 14, 52);
        } else {
          // 'cobra': the highway lamp, a curved arm and a flat head.
          box(g, x, 17, z, 1.3, 34, 1.3, pole);
          bridgeMember(g, V3(x, 33, z), V3(x, 35, z - side * 8), 0.9, 0.9, pole);
          head(x, 34.4, z - side * 9.5, 3, 1, 5.5);
          pool(x, z - side * 13, 46);
        }
      }
      /* Channel marks for shipping: a green light on one side of each navigation
         span and red on the other, both deck edges, plus a white centre light. */
      function channelLights(g, bridge, s, lights) {
        // A drawbridge shows its own: red on the fenders, red or green on the leaf tips (drawbridge3d.js).
        if (bridge.movable) return;
        const W = bridge.width;
        for (const [c0, c1] of s.channels)
          for (const side of [-1, 1]) {
            kitLight(lights, g, c0, -1.5, side * (W / 2 + 2.6), '#ff4a3c');
            kitLight(lights, g, c1, -1.5, side * (W / 2 + 2.6), '#3dff7a');
            kitLight(lights, g, (c0 + c1) / 2, -1.2, side * (W / 2 + 2.6), '#f4f6ff');
          }
      }
      /* Foam round everything standing in the water. It lies above the swell
         crests, which is above the road (the deck is at sea level), so it is cut
         away wherever the deck covers it: whole rings drawn under the deck used to
         show on the carriageway as white smears round every pier. */
      function footingFoam(g, bridge, s) {
        const cover = bridge.width / 2 + 2.5,
          deck0 = s.water[0] - 36,
          deck1 = s.water[1] + 36;
        for (const f of s.footings) {
          const x0 = f.along - f.hx - 13,
            x1 = f.along + f.hx + 13,
            z0 = f.across - f.hy - 13,
            z1 = f.across + f.hy + 13,
            pieces = [];
          if (x1 <= deck0 || x0 >= deck1) pieces.push([x0, x1, z0, z1]);
          else {
            // Past either end of the deck the ring stays whole.
            if (x0 < deck0) pieces.push([x0, deck0, z0, z1]);
            if (x1 > deck1) pieces.push([deck1, x1, z0, z1]);
            const a0 = Math.max(x0, deck0),
              a1 = Math.min(x1, deck1);
            if (z0 < -cover) pieces.push([a0, a1, z0, Math.min(z1, -cover)]);
            if (z1 > cover) pieces.push([a0, a1, Math.max(z0, cover), z1]);
          }
          for (const [p0, p1, q0, q1] of pieces) {
            if (p1 - p0 < 0.5 || q1 - q0 < 0.5) continue;
            const u = (x) => (x - x0) / (x1 - x0),
              v = (z) => (z - z0) / (z1 - z0),
              geo = new Three.BufferGeometry();
            geo.setAttribute('position', new Three.Float32BufferAttribute([p0, 0, q0, p0, 0, q1, p1, 0, q0, p1, 0, q1], 3));
            geo.setAttribute('normal', new Three.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
            geo.setAttribute('uv', new Three.Float32BufferAttribute([u(p0), v(q0), u(p0), v(q1), u(p1), v(q0), u(p1), v(q1)], 2));
            geo.setIndex([0, 1, 2, 2, 1, 3]);
            const m = new Three.Mesh(geo, bridgeFoamMaterial);
            m.position.y = 1.1;
            g.add(m);
          }
        }
      }
      // The plain under-deck piers (approach bents): a cap with rounded noses.
      function approachPier(g, bridge, along, material) {
        const W = bridge.width;
        cutwaterPier(g, along, 5, W / 2 + 5, -12, -1.2, material);
      }
      const bridgeBeacons = [];
      // Red aviation obstruction lights: pulsing, faintly visible by day too.
      function aviationBeacons(g, points) {
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3));
        geo.computeBoundingSphere();
        const material = new Three.PointsMaterial({
          map: haloTx,
          color: '#ff3a26',
          size: 16,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: Three.AdditiveBlending,
        });
        material.userData.worldSize = 16;
        const cloud = new Three.Points(geo, material);
        cloud.userData.dynamic = true;
        cloud.renderOrder = 6;
        g.add(cloud);
        bridgeBeacons.push(material);
      }
      /* ---- The styles -------------------------------------------------------------- */
      const BRIDGE_BUILDERS = {
        truss(g, bridge, s, kit) {
          const W = bridge.width,
            green = bridgeGlowPaint('#4c6a60', '#ffdca6', 0.16, 'satin'),
            t = s.truss,
            plane = t.plane,
            panel = 36;
          bridgeDeck(g, bridge, s, { fascia: BRIDGE_KIT.concreteDark, rail: guardSteel(green) });
          for (const p of t.piers) cutwaterPier(g, p, 16, W / 2 + 12, -14, -1, BRIDGE_KIT.stone);
          for (const p of s.approach) approachPier(g, bridge, p, BRIDGE_KIT.concrete);
          // Three spans of trusses, one each side; panel points every ~36.
          const spans = [
            [t.piers[0], t.piers[1]],
            [t.piers[1], t.piers[2]],
            [t.piers[2], t.piers[3]],
          ];
          for (const [e0, e1] of spans) {
            const n = Math.max(4, Math.round((e1 - e0) / panel)),
              step = (e1 - e0) / n,
              top = (x) => s.chord(x) - 2;
            for (const side of [-1, 1]) {
              const z = side * plane;
              box(g, (e0 + e1) / 2, 1.5, z, e1 - e0, 3, 2.4, green);
              // Top chord from the first to the last panel point; end posts lean down to the bearings.
              for (let k = 1; k < n - 1; k++)
                bridgeMember(g, V3(e0 + step * k, top(e0 + step * k), z), V3(e0 + step * (k + 1), top(e0 + step * (k + 1)), z), 2.6, 2.8, green);
              bridgeMember(g, V3(e0, 1, z), V3(e0 + step, top(e0 + step), z), 2.6, 2.8, green);
              bridgeMember(g, V3(e1, 1, z), V3(e1 - step, top(e1 - step), z), 2.6, 2.8, green);
              for (let k = 1; k < n; k++) {
                const x = e0 + step * k;
                bridgeMember(g, V3(x, 1, z), V3(x, top(x), z), 1.4, 1.8, green);
                // Pratt diagonals, each sloping down toward the middle of the span.
                const toward = Math.sign((e0 + e1) / 2 - x);
                if (Math.abs(x - (e0 + e1) / 2) > step * 0.6 && k + toward >= 1 && k + toward <= n - 1)
                  bridgeMember(g, V3(x, top(x), z), V3(x + toward * step, 1.5, z), 1.1, 1.4, green);
              }
            }
            // Top lateral bracing: struts and crossed ties between the two trusses.
            for (let k = 1; k < n; k++) {
              const x = e0 + step * k,
                y = top(x);
              bridgeMember(g, V3(x, y, -plane), V3(x, y, plane), 1.2, 1.2, green);
              if (k < n - 1) {
                const x2 = x + step,
                  y2 = top(x2);
                bridgeMember(g, V3(x, y, -plane), V3(x2, y2, plane), 0.6, 0.6, green);
                bridgeMember(g, V3(x, y, plane), V3(x2, y2, -plane), 0.6, 0.6, green);
              }
              // Knee braces under the struts frame the traffic portal.
              for (const side of [-1, 1])
                bridgeMember(g, V3(x, y - 10, side * plane), V3(x, y, side * (plane - 10)), 0.8, 0.8, green);
            }
            // Lamps hang from every other vertical, over each sidewalk.
            for (let k = 2; k < n - 1; k += 2)
              for (const side of [-1, 1]) {
                const x = e0 + step * k;
                bridgeMember(g, V3(x, 28, side * plane), V3(x, 28, side * (plane - 9)), 0.7, 0.7, green);
                box(g, x, 27.4, side * (plane - 10), 3, 1, 5, bridgeLampMaterial);
                kitLight(kit.lights, g, x, 26, side * (plane - 10), '#ffd7a0');
                kit.pools.push(bridgePool(g, x, side * (plane - 16), 42));
              }
          }
          // Portal plaques over each end of the truss.
          for (const [x, rot] of [
            [t.ends[0] + 30, -Math.PI / 2],
            [t.ends[1] - 30, Math.PI / 2],
          ]) {
            const y = s.chord(x) - 8;
            box(g, x, y, 0, 1.4, 12, plane * 1.2, green);
            bridgePlaque(g, 'KEYS BRIDGE', 'PALM KEYS · NORTHBANK · 1931', '#27352f', '#e9dfbd', 64, x + (rot < 0 ? -0.9 : 0.9), y, 0, rot);
          }
          const crown = s.middle;
          aviationBeacons(g, [V3(crown, s.chord(crown) + 1, -plane), V3(crown, s.chord(crown) + 1, plane)]);
        },
        // The Palm Sound drawbridge: a working trunnion bascule (drawbridge3d.js).
        bascule(g, bridge, s, kit) {
          buildDrawbridge(g, bridge, s, kit);
        },
        cablestay(g, bridge, s, kit) {
          const W = bridge.width,
            p = s.pylon,
            white = bridgeGlowPaint('#f1f2ef', '#cfe4ff', 0.34, 'satin'),
            stays = new Three.MeshStandardMaterial({ color: '#f2f4f5', roughness: 0.35, metalness: 0.5, emissive: '#d6ecff', emissiveIntensity: 0 }),
            led = bridgeLed('#bfe3ff', 1.8);
          stays.userData.glow = 0.9;
          bridgeGlowMaterials.push(stays);
          bridgeDeck(g, bridge, s, { fascia: tint('#e9eae6', 'satin'), rail: guardSteel(tint('#dfe2e2', 'metal')) });
          // Edge girders carrying the stay anchors, with an LED line along each.
          for (const side of [-1, 1]) {
            box(g, s.middle, 2.4, side * (W / 2 + 2.5), s.water[1] - s.water[0] + 60, 4.8, 3, tint('#e9eae6', 'satin'));
            box(g, s.middle, 4.9, side * (W / 2 + 2.5), s.water[1] - s.water[0] + 60, 0.4, 1, led);
          }
          for (const f of s.footings)
            if (f.kind === 'back pier') cutwaterPier(g, f.along, 12, W / 2 + 6, -12, -1, BRIDGE_KIT.concrete);
          for (const x of s.approach) approachPier(g, bridge, x, BRIDGE_KIT.concrete);
          // The pile cap and the A: two legs leaning in to a single head that carries the stays.
          const cap = [];
          for (let i = 0; i < 24; i++) {
            const th = (i / 24) * Math.PI * 2;
            cap.push([p.along + Math.cos(th) * 36, Math.sin(th) * (W / 2 + 48)]);
          }
          mesh(prismGeometry(cap, cap, -12, -0.6, true), BRIDGE_KIT.concrete, g, 0, 0, 0);
          const meet = 262;
          for (const side of [-1, 1]) {
            bridgeMember(g, V3(p.along, -2, side * p.legBase), V3(p.along, meet, side * 7), 12, 11, white);
            // A slimmer inner fin gives the legs a tapered look from below.
            bridgeMember(g, V3(p.along, 60, side * (p.legBase - 14)), V3(p.along, meet - 20, side * 10), 9, 5, white);
          }
          box(g, p.along, -4, 0, 14, 8, p.legBase * 2 + 10, white);
          // The head: a tall tapered block from where the legs meet up to the tip.
          mesh(prismGeometry(rectOutline(p.along - 9, p.along + 9, -9, 9), rectOutline(p.along - 6, p.along + 6, -6, 6), meet - 6, p.height, true), white, g, 0, 0, 0);
          mesh(new Three.ConeGeometry(4.5, 16, 4), white, g, p.along, p.height + 8, 0);
          // Two fans of stays, one to each deck edge, both ways from the pylon.
          for (const dir of [-1, 1])
            for (let k = 0; k < p.stays; k++) {
              const f = k / (p.stays - 1),
                along = p.along + dir * (p.first + (p.reach - p.first) * f),
                head = p.headFrom + (p.height - 12 - p.headFrom) * f;
              for (const side of [-1, 1]) {
                const from = V3(p.along + dir * 5, head, side * 4),
                  to = V3(along, 4.5, side * (W / 2 + 2.5));
                bridgeCable(g, from, to, 0.75, stays);
                // Anchor housing on the edge girder.
                box(g, along, 5.4, side * (W / 2 + 2.5), 3, 1.6, 3.4, BRIDGE_KIT.steel);
              }
            }
          bridgeLamps(g, bridge, s, kit.lights, kit.pools, 64, 'blade', tint('#dfe2e2', 'metal'), [[p.along - 60, p.along + 60]]);
          bridgePlaque(g, 'EAST BAY CROSSING', 'NORTHBANK · RIDGELINE', '#1d3346', '#eef4f8', 52, p.along, 150, p.legBase + 7.5, 0);
          bridgePlaque(g, 'EAST BAY CROSSING', 'NORTHBANK · RIDGELINE', '#1d3346', '#eef4f8', 52, p.along, 150, -p.legBase - 7.5, Math.PI);
          aviationBeacons(g, [V3(p.along, p.height + 17, 0), V3(p.along, 180, p.legBase * 0.62), V3(p.along, 180, -p.legBase * 0.62)]);
        },
        suspension(g, bridge, s, kit) {
          const W = bridge.width,
            t = s.towers,
            red = bridgeGlowPaint('#b8412e', '#ff9a6a', 0.3, 'satin'),
            cablePaint = tint('#b3432f', 'satin'),
            plane = W / 2 + 10;
          bridgeDeck(g, bridge, s, { fascia: tint('#9a3a2b', 'satin'), rail: guardSteel(cablePaint) });
          for (const x of s.approach) approachPier(g, bridge, x, BRIDGE_KIT.concrete);
          // A stiffening truss along each edge, red like the towers.
          const [a0, a1] = s.anchorages;
          for (const side of [-1, 1]) {
            box(g, (a0 + a1) / 2, 6.2, side * plane, a1 - a0, 1.6, 2.2, red);
            box(g, (a0 + a1) / 2, -0.4, side * plane, a1 - a0, 1.6, 2.2, red);
            for (let x = a0 + 12; x < a1; x += 24) {
              bridgeMember(g, V3(x, -0.4, side * plane), V3(x + 12, 6.2, side * plane), 0.8, 0.8, red);
              bridgeMember(g, V3(x + 12, 6.2, side * plane), V3(x + 24, -0.4, side * plane), 0.8, 0.8, red);
            }
          }
          // Towers: two legs stepping in at each strut, three portal struts, caissons in the bay.
          for (const at of t.at) {
            cutwaterPier(g, at, 30, W / 2 + 44, -16, -1, BRIDGE_KIT.concrete);
            const levels = [-2, ...t.struts, t.top];
            for (let i = 0; i < levels.length - 1; i++) {
              const y0 = levels[i],
                y1 = levels[i + 1],
                shrink = i * 1.6;
              for (const side of [-1, 1]) {
                box(g, at, (y0 + y1) / 2, side * (W / 2 + 17), 17 - shrink, y1 - y0, 13 - shrink * 0.6, red);
                // Recessed ribs on the outer faces.
                for (const dx of [-4, 4]) box(g, at + dx, (y0 + y1) / 2, side * (W / 2 + 17 + (6.6 - shrink * 0.3)), 1.4, y1 - y0 - 4, 0.6, tint('#8e3122', 'satin'));
              }
            }
            for (const y of t.struts) {
              box(g, at, y, 0, 13, 12, W + 34, red);
              for (const side of [-1, 1]) bridgeMember(g, V3(at, y - 6, side * (W / 2 + 9)), V3(at, y - 22, side * (W / 2 + 1)), 3, 4, red);
            }
            // Cable saddles on the tower tops.
            for (const side of [-1, 1]) box(g, at, t.top + 3, side * plane, 20, 7, 7, tint('#6f2a20', 'satin'));
          }
          // Main cables: anchorage to anchorage over both towers, sagging mid-span.
          const cablePoints = [];
          for (let x = a0; x <= a1 + 0.1; x += (a1 - a0) / 90) cablePoints.push(x);
          for (const side of [-1, 1]) {
            bridgeTube(g, cablePoints.map((x) => V3(x, s.cable(x) + 2, side * plane)), 2.1, cablePaint, 7);
            // Necklace lights along each cable.
            for (let x = a0 + 20; x < a1; x += 34) kitLight(kit.lights, g, x, s.cable(x) + 4.5, side * plane, '#fff1c8');
          }
          // Hangers every 20 wherever the cable is well above the deck.
          for (let x = a0 + 16; x < a1 - 10; x += 20) {
            const y = s.cable(x);
            if (y < 10 || t.at.some((at) => Math.abs(x - at) < 16)) continue;
            for (const side of [-1, 1]) bridgeCable(g, V3(x, 6.4, side * plane), V3(x, y + 1, side * plane), 0.45, BRIDGE_KIT.darkSteel);
          }
          // Anchorages: massive stepped blocks either side of the deck where the cables go down.
          for (const at of s.anchorages) {
            cutwaterPier(g, at, 60, W / 2 + 44, -14, -1, BRIDGE_KIT.concrete);
            for (const side of [-1, 1]) {
              box(g, at, 18, side * (W / 2 + 26), 112, 36, 36, BRIDGE_KIT.concrete);
              box(g, at, 40, side * (W / 2 + 26), 88, 10, 30, BRIDGE_KIT.concreteDark);
              kitLight(kit.lights, g, at - 50, 34, side * (W / 2 + 8), '#ffd7a0');
              kitLight(kit.lights, g, at + 50, 34, side * (W / 2 + 8), '#ffd7a0');
            }
          }
          bridgeLamps(g, bridge, s, kit.lights, kit.pools, 70, 'cobra', BRIDGE_KIT.darkSteel, [
            ...t.at.map((at) => [at - 24, at + 24]),
            ...s.anchorages.map((at) => [at - 60, at + 60]),
          ]);
          for (const at of t.at) {
            bridgePlaque(g, 'SOUTH BAY BRIDGE', null, '#2a2522', '#f0dcc4', 44, at - 7, t.struts[0], 0, -Math.PI / 2);
            bridgePlaque(g, 'SOUTH BAY BRIDGE', null, '#2a2522', '#f0dcc4', 44, at + 7, t.struts[0], 0, Math.PI / 2);
          }
          aviationBeacons(g, t.at.flatMap((at) => [V3(at, t.top + 9, plane), V3(at, t.top + 9, -plane)]));
        },
        arch(g, bridge, s, kit) {
          const W = bridge.width,
            a = s.arch,
            pearl = bridgeGlowPaint('#eef1f4', '#ffffff', 0.12, 'pearl'),
            // Kept below saturation: at full strength the ribs and the dense crossing
            // hangers bloomed into one blinding curtain of colour at night.
            led = bridgeLed('#ff4fd8', 1.3, 1),
            hangerLed = bridgeLed('#5ff0ff', 0.38, 1),
            deckLed = bridgeLed('#6fe7ff', 1.8, 0);
          bridgeDeck(g, bridge, s, { fascia: tint('#dfe3e6', 'satin'), rail: guardGlass(tint('#d6dbde', 'metal'), deckLed) });
          for (const x of s.approach) {
            approachPier(g, bridge, x, BRIDGE_KIT.concrete);
          }
          // Arch feet: sloping thrust blocks beside the deck.
          for (const x of [a.from, a.to])
            for (const side of [-1, 1]) {
              const dir = x < s.middle ? 1 : -1,
                foot = [
                  [x - dir * 30, side * (a.foot - 14)],
                  [x + dir * 36, side * (a.foot - 14)],
                  [x + dir * 36, side * (a.foot + 16)],
                  [x - dir * 30, side * (a.foot + 16)],
                ];
              mesh(prismGeometry(foot, foot.map(([u, v]) => [u + dir * 20, v]), -8, 16, true), BRIDGE_KIT.concrete, g, 0, 0, 0);
            }
          for (const x of [a.from, a.to]) cutwaterPier(g, x, 40, W / 2 + 54, -14, -1, BRIDGE_KIT.concrete);
          // The two ribs lean in from the feet to meet over the crown.
          const across = (x) => a.foot - (a.foot - a.crown) * (s.archHeight(x) / a.rise),
            ribPoints = (side, lift = 0, inset = 0) => {
              const pts = [];
              for (let k = 0; k <= 40; k++) {
                const x = a.from + ((a.to - a.from) * k) / 40;
                pts.push(V3(x, 12 + s.archHeight(x) * (1 - 12 / a.rise) + lift, side * (across(x) - inset)));
              }
              return pts;
            };
          for (const side of [-1, 1]) {
            bridgeTube(g, ribPoints(side), 5.2, pearl, 8);
            bridgeTube(g, ribPoints(side, -5.6, 0), 1.3, led, 5);
          }
          // Bracing between the ribs near the crown.
          for (let x = s.middle - 280; x <= s.middle + 280; x += 70) {
            const y = 12 + s.archHeight(x) * (1 - 12 / a.rise);
            if (y < 150) continue;
            bridgeMember(g, V3(x, y, -across(x)), V3(x, y, across(x)), 2.4, 2.4, pearl);
          }
          // Network hangers: two from every deck anchor, crossing each other.
          for (let x = a.from + 50; x <= a.to - 50; x += 36)
            for (const lean of [-44, 44]) {
              const top = x + lean,
                y = 12 + s.archHeight(top) * (1 - 12 / a.rise);
              if (y < 26) continue;
              for (const side of [-1, 1]) bridgeCable(g, V3(x, 4, side * (W / 2 + 3)), V3(top, y - 4, side * (across(top) - 1)), 0.5, hangerLed);
            }
          bridgeLamps(g, bridge, s, kit.lights, kit.pools, 60, 'blade', tint('#d6dbde', 'metal'), [
            [a.from - 44, a.from + 44],
            [a.to - 44, a.to + 44],
          ]);
          bridgePlaque(g, 'SUNSET PIER', 'BRIDGE', '#1b1330', '#ffd36b', 40, a.from - 70, 12, W / 2 + 6, 0);
          bridgePlaque(g, 'SUNSET PIER', 'BRIDGE', '#1b1330', '#ffd36b', 40, a.to + 70, 12, -W / 2 - 6, Math.PI);
          for (const x of [a.from - 70, a.to + 70]) for (const side of [-1, 1]) box(g, x, 6, side * (W / 2 + 6), 42, 12, 1.4, BRIDGE_KIT.darkSteel);
          aviationBeacons(g, [V3(s.middle, a.rise + 18, 0)]);
        },
        segmental(g, bridge, s, kit) {
          const W = bridge.width,
            sand = tint('#cdbf9f', 'satin'),
            seaGreen = tint('#3f8a86', 'satin');
          bridgeDeck(g, bridge, s, { fascia: sand, walk: tint('#b9ae95', 'matte'), rail: guardJersey(sand, seaGreen) });
          for (const x of s.approach) cutwaterPier(g, x, 7, W / 2 + 8, -12, -1, sand);
          // Fishing balconies jut out from the deck every few spans, benches along the rail.
          for (let i = 1; i < s.approach.length; i += 3) {
            const x = s.approach[i],
              side = i % 2 ? 1 : -1;
            const z = side * (W / 2 + 13);
            box(g, x, -0.6, z, 44, 3, 22, sand);
            box(g, x, 0.95, z, 44, 0.1, 22, tint('#b9ae95', 'matte'));
            box(g, x, 7, side * (W / 2 + 24), 44, 1, 1, seaGreen);
            for (const dx of [-21.5, 21.5]) box(g, x + dx, 7, z, 1, 1, 22, seaGreen);
            for (const dx of [-12, 12]) box(g, x + dx, 2.4, side * (W / 2 + 19), 10, 1, 3.6, BRIDGE_KIT.timber);
            kitLight(kit.lights, g, x, 8, side * (W / 2 + 24), '#ffd7a0');
          }
          // The navigation span: the main piers carry striped beacon towers.
          for (const x of s.navigation) {
            cutwaterPier(g, x, 14, W / 2 + 12, -14, -1, sand);
            for (const side of [-1, 1]) {
              const z = side * (W / 2 + 9),
                color = (x < s.middle) === side > 0 ? '#d8392c' : '#2f9d5a';
              mesh(new Three.CylinderGeometry(3, 4.2, 30, 10), tint('#f1efe8', 'gloss'), g, x, 15, z);
              for (const y of [8, 20]) mesh(new Three.CylinderGeometry(3.9, 4, 5, 10), tint(color, 'gloss'), g, x, y, z);
              mesh(new Three.CylinderGeometry(2.8, 2.8, 3.6, 10), bridgeLampMaterial, g, x, 32, z);
              mesh(new Three.ConeGeometry(3.6, 4, 10), tint(color, 'gloss'), g, x, 35.6, z);
              kitLight(kit.lights, g, x, 32, z, color === '#d8392c' ? '#ff4a3c' : '#3dff7a');
            }
          }
          bridgeLamps(g, bridge, s, kit.lights, kit.pools, 96, 'twin', tint('#d9dcd6', 'metal'), s.navigation.map((x) => [x - 20, x + 20]));
          bridgePlaque(g, 'OCEANVIEW', 'CAUSEWAY', '#23574f', '#f2efe0', 36, s.water[0] - 8, 10, W / 2 + 8, 0);
          box(g, s.water[0] - 8, 5, W / 2 + 8, 1.2, 10, 1.2, BRIDGE_KIT.steel);
        },
        extradosed(g, bridge, s, kit) {
          const W = bridge.width,
            sail = s.sails,
            coral = bridgeGlowPaint('#e08a74', '#ffb49a', 0.3, 'satin'),
            stays = new Three.MeshStandardMaterial({ color: '#f5efe9', roughness: 0.4, metalness: 0.4, emissive: '#ffd7b8', emissiveIntensity: 0 });
          stays.userData.glow = 0.7;
          bridgeGlowMaterials.push(stays);
          bridgeDeck(g, bridge, s, { fascia: tint('#efe7dc', 'satin'), rail: guardSteel(coral, 6) });
          for (const x of s.approach) approachPier(g, bridge, x, BRIDGE_KIT.concrete);
          // Sail pylons: a tapering blade, a curved trailing edge, standing at each deck edge.
          const shape = new Three.Shape();
          shape.moveTo(-14, 0);
          shape.lineTo(14, 0);
          shape.quadraticCurveTo(10, sail.height * 0.6, 3, sail.height);
          shape.lineTo(-4, sail.height);
          shape.quadraticCurveTo(-12, sail.height * 0.45, -14, 0);
          const blade = new Three.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false, curveSegments: 8 });
          blade.translate(0, 0, -3);
          for (const at of sail.at) {
            cutwaterPier(g, at, 26, W / 2 + 30, -14, -1, BRIDGE_KIT.concrete);
            for (const side of [-1, 1]) {
              const dir = at < s.middle ? -1 : 1;
              const m = mesh(blade, coral, g, at, 0, side * sail.across, 1, 1, 1);
              m.scale.x = dir;
              // Harps of stays both ways: parallel pairs from the upper blade to the deck edge.
              for (const toward of [-1, 1])
                for (let k = 0; k < 8; k++) {
                  const y = sail.height * 0.5 + k * ((sail.height * 0.45) / 7),
                    reach = 30 + k * 16;
                  bridgeCable(g, V3(at + toward * 3, y, side * sail.across), V3(at + toward * reach, 4, side * (W / 2 + 2.5)), 0.6, stays);
                }
            }
          }
          bridgeLamps(g, bridge, s, kit.lights, kit.pools, 60, 'cobra', BRIDGE_KIT.darkSteel, sail.at.map((at) => [at - 20, at + 20]));
          aviationBeacons(g, sail.at.flatMap((at) => [V3(at, sail.height + 3, sail.across), V3(at, sail.height + 3, -sail.across)]));
        },
        hpylon(g, bridge, s, kit) {
          const W = bridge.width,
            h = s.hpylons,
            grey = bridgeGlowPaint('#a5a8a6', '#fff0d6', 0.22, 'satin'),
            rust = tint('#7f4a30', 'matte'),
            stays = tint('#c9ccce', 'metal');
          bridgeDeck(g, bridge, s, { fascia: rust, rail: guardSteel(BRIDGE_KIT.darkSteel) });
          for (const x of s.approach) approachPier(g, bridge, x, BRIDGE_KIT.concreteDark);
          for (const at of h.at) {
            cutwaterPier(g, at, 26, W / 2 + 36, -14, -1, BRIDGE_KIT.concrete);
            for (const side of [-1, 1]) {
              bridgeMember(g, V3(at, -6, side * (h.legs + 3)), V3(at, h.height, side * h.legs), 18, 14, grey);
              box(g, at, h.height + 2, side * h.legs, 12, 4, 10, grey);
            }
            box(g, at, h.beam, 0, 12, 22, h.legs * 2, grey);
            box(g, at, -4, 0, 16, 8, h.legs * 2 + 6, grey);
            // Semi-harp stays both ways from the upper legs to the deck edges.
            for (const toward of [-1, 1])
              for (let k = 0; k < h.stays; k++) {
                const f = k / (h.stays - 1),
                  along = at + toward * (h.first + (h.reach - h.first) * f),
                  y = 150 + (h.height - 14 - 150) * f;
                for (const side of [-1, 1]) bridgeCable(g, V3(at + toward * 7, y, side * (h.legs - 2)), V3(along, 4, side * (W / 2 + 2.5)), 0.7, stays);
              }
            bridgePlaque(g, 'RIDGELINE VIADUCT', null, '#3b2b22', '#efe3cf', 50, at - 6.1, h.beam, 0, -Math.PI / 2);
            bridgePlaque(g, 'RIDGELINE VIADUCT', null, '#3b2b22', '#efe3cf', 50, at + 6.1, h.beam, 0, Math.PI / 2);
          }
          bridgeLamps(g, bridge, s, kit.lights, kit.pools, 66, 'cobra', BRIDGE_KIT.darkSteel, h.at.map((at) => [at - 22, at + 22]));
          aviationBeacons(g, h.at.flatMap((at) => [V3(at, h.height + 7, h.legs), V3(at, h.height + 7, -h.legs)]));
        },
        // Monarch Isle's two (monarch-bridges3d.js).
        harp: buildHarpBridge,
        bowstring: buildBowstringBridge,
        swing(g, bridge, s, kit) {
          const W = bridge.width,
            w = s.swing,
            olive = tint('#5c6444', 'satin'),
            oliveDark = tint('#454b33', 'satin');
          bridgeDeck(g, bridge, s, { fascia: olive, rail: guardSteel(oliveDark, 6) });
          for (const x of s.approach) approachPier(g, bridge, x, BRIDGE_KIT.concreteDark);
          // Through plate girders along both edges, stiffeners every 12.
          const [w0, w1] = s.water;
          for (const side of [-1, 1]) {
            box(g, (w0 + w1) / 2, 5, side * (W / 2 + 3), w1 - w0, 13, 2.2, olive);
            box(g, (w0 + w1) / 2, 11.8, side * (W / 2 + 3), w1 - w0, 1.2, 4.4, oliveDark);
            for (let x = w0 + 6; x < w1; x += 12) box(g, x, 5, side * (W / 2 + 4.4), 1, 12, 0.8, oliveDark);
          }
          // The swing span's deck plate, the pivot drum and the long timber fender.
          box(g, w.pivot, 0.46, 0, w.half * 2, 0.1, W - 22, tint('#4a4f47', 'metal'));
          for (const x of w.rests) box(g, x, 0.5, 0, 1.4, 0.14, W - 22, BRIDGE_KIT.joint);
          mesh(new Three.CylinderGeometry(30, 32, 12, 24), BRIDGE_KIT.concreteDark, g, w.pivot, -7, 0);
          for (const side of [-1, 1]) {
            box(g, w.pivot, -1, side * (w.fender / 2 + W / 4), 30, 3.6, w.fender - W / 2, BRIDGE_KIT.timber);
            for (let z = W / 2 + 8; z < w.fender; z += 14) box(g, w.pivot, -3, side * z, 32, 6, 1.4, BRIDGE_KIT.darkSteel);
          }
          for (const x of w.rests) cutwaterPier(g, x, 12, W / 2 + 8, -12, -1, BRIDGE_KIT.concreteDark);
          // Control house on the fender, with a lookout gallery.
          const cz = -(W / 2 + 40);
          box(g, w.pivot, 12, cz, 30, 24, 26, tint('#cfc9b0', 'matte'));
          box(g, w.pivot, 30, cz, 26, 12, 22, BRIDGE_KIT.glass);
          box(g, w.pivot, 37, cz, 34, 2, 30, oliveDark);
          box(g, w.pivot, 45, cz, 0.6, 16, 0.6, BRIDGE_KIT.darkSteel);
          kitLight(kit.lights, g, w.pivot, 30, cz + 12, '#ffcf8c');
          // Floodlight masts at the rest piers.
          for (const x of w.rests) for (const side of [-1, 1]) bridgeLampPost(g, x, side, W + 8, 'mast', oliveDark, kit.lights, kit.pools);
          bridgePlaque(g, 'FORT SENTINEL', 'RESTRICTED · MILITARY AREA', '#2f3524', '#f1e7b6', 44, w1 + 16, 12, W / 2 + 8, Math.PI / 2);
          box(g, w1 + 17, 6, W / 2 + 8, 1, 12, 1, BRIDGE_KIT.darkSteel);
          aviationBeacons(g, [V3(w.pivot, 47, cz), ...w.rests.flatMap((x) => [V3(x, 46, W / 2 + 10), V3(x, 46, -W / 2 - 10)])]);
        },
      };
      /* ---- Far copies ---------------------------------------------------------- */
      // What a bridge looks like from far up: the deck, its towers and main lines.
      function bridgeFarCopy(root, bridge, s) {
        const g = new Three.Group(),
          f = bridgeFrame(bridge),
          c = bridgePoint(bridge, 0),
          W = bridge.width,
          from = s.water[0] - 36,
          to = s.water[1] + 36,
          paint = (color) => tint(color, 'satin'),
          line = (points, size, material) => {
            for (let i = 0; i < points.length - 1; i++) bridgeMember(g, points[i], points[i + 1], size, size, material);
          };
        g.position.set(c.x, 0, c.y);
        g.rotation.y = -f.a;
        root.add(g);
        box(g, (from + to) / 2, -2, 0, to - from, 4.4, W + 4, paint('#6c7174'));
        box(g, (from + to) / 2, 0.4, 0, to - from, 0.4, W - 22, paint('#40484c'));
        const curve = (fn, x0, x1, n, side, z) => Array.from({ length: n + 1 }, (_, k) => V3(x0 + ((x1 - x0) * k) / n, fn(x0 + ((x1 - x0) * k) / n), side * z));
        if (s.truss)
          for (const side of [-1, 1]) {
            line(curve(s.chord, s.truss.ends[0], s.truss.ends[1], 12, side, s.truss.plane), 3, paint('#4c6a60'));
            box(g, s.middle, 1.5, side * s.truss.plane, s.truss.ends[1] - s.truss.ends[0], 3, 3, paint('#4c6a60'));
          }
        if (s.pylon) {
          const p = s.pylon;
          for (const side of [-1, 1]) {
            bridgeMember(g, V3(p.along, 0, side * p.legBase), V3(p.along, 262, side * 7), 12, 11, paint('#f1f2ef'));
            for (const dir of [-1, 1]) bridgeMember(g, V3(p.along, p.height - 10, side * 4), V3(p.along + dir * p.reach, 4, side * (W / 2 + 2)), 2, 2, paint('#e6eaec'));
          }
          box(g, p.along, (256 + p.height) / 2, 0, 16, p.height - 256, 16, paint('#f1f2ef'));
        }
        if (s.towers) {
          for (const at of s.towers.at) {
            for (const side of [-1, 1]) box(g, at, s.towers.top / 2, side * (W / 2 + 17), 15, s.towers.top, 12, paint('#b8412e'));
            for (const y of s.towers.struts) box(g, at, y, 0, 12, 12, W + 34, paint('#b8412e'));
          }
          for (const side of [-1, 1]) line(curve(s.cable, s.anchorages[0], s.anchorages[1], 24, side, W / 2 + 10), 3.4, paint('#b3432f'));
        }
        if (s.arch)
          for (const side of [-1, 1])
            line(
              curve((x) => 12 + s.archHeight(x), s.arch.from, s.arch.to, 16, 1, 0).map((p) => V3(p.x, p.y, side * (s.arch.foot - (s.arch.foot - s.arch.crown) * (s.archHeight(p.x) / s.arch.rise)))),
              8,
              paint('#eef1f4'),
            );
        if (s.sails)
          for (const at of s.sails.at) for (const side of [-1, 1]) box(g, at, s.sails.height / 2, side * s.sails.across, 16, s.sails.height, 6, paint('#e08a74'));
        if (s.hpylons)
          for (const at of s.hpylons.at) {
            for (const side of [-1, 1]) box(g, at, s.hpylons.height / 2, side * s.hpylons.legs, 16, s.hpylons.height, 13, paint('#a5a8a6'));
            box(g, at, s.hpylons.beam, 0, 12, 22, s.hpylons.legs * 2, paint('#a5a8a6'));
          }
        if (s.bascule) for (const h of s.bascule.houses) box(g, h.along, 20, h.across, 22, 40, 18, paint('#ecebe5'));
        if (s.swing) for (const side of [-1, 1]) box(g, s.middle, 5, side * (W / 2 + 3), s.water[1] - s.water[0], 13, 3, paint('#5c6444'));
        if (s.harp) {
          const H = s.harp;
          bridgeMember(g, V3(H.base, 0, 0), V3(H.top.x, H.top.y, 0), 24, 22, paint('#f3f4f1'));
          for (const st of [H.stays[0], H.stays[6], H.stays[12]]) bridgeMember(g, V3(st.from.x, st.from.y, 0), V3(st.to.x, 4, 0), 2, 2, paint('#e6eaec'));
        }
        if (s.bowstring)
          for (const a of s.bowstring.arches)
            for (const side of [-1, 1]) line(curve((x) => 3 + s.archHeightAt(x), a.from, a.to, 10, 1, 0).map((p) => V3(p.x, p.y, side * s.bowstring.plane)), 5, paint('#3f6b5c'));
      }
      /* ---- Build ------------------------------------------------------------------- */
      {
        const farRoot = new Three.Group();
        for (const bridge of BRIDGES) {
          const s = bridgeStructure(bridge),
            f = bridgeFrame(bridge),
            c = bridgePoint(bridge, 0),
            g = new Three.Group(),
            kit = { lights: kitLightList(), pools: [] };
          g.name = bridge.name;
          g.position.set(c.x, 0, c.y);
          g.rotation.y = -f.a;
          // Its night lights get a cloud of their own, culled with the bridge.
          g.userData.lightCloud = true;
          scene.add(g);
          BRIDGE_BUILDERS[bridge.style](g, bridge, s, kit);
          channelLights(g, bridge, s, kit.lights);
          footingFoam(g, bridge, s);
          if (g.userData.deckLight) paintBridgeDeckLight(g.userData.deckLight.light, g.userData.deckLight.from, kit.pools);
          const merged = kitMerge(g);
          for (const m of merged) {
            if (m.material.transparent) {
              // Foam and light pools: no shadows, drawn after the water.
              m.castShadow = m.receiveShadow = false;
              m.renderOrder = 5;
            }
            m.name = 'bridge ' + bridge.id;
            farHidden.push(m);
          }
          kitLightCloud(kit.lights, 8);
          const extent = (s.water[1] - s.water[0]) / 2 + 120;
          statics.push({ x: c.x + f.ux * ((s.water[0] + s.water[1]) / 2), y: c.y + f.uy * ((s.water[0] + s.water[1]) / 2), group: g, radius: extent + 400 });
          bridgeFarCopy(farRoot, bridge, s);
        }
        // The far copies merge into a couple of meshes shown only in the far view.
        for (const m of kitMerge(farRoot)) {
          m.name = 'far bridges';
          farScenery.add(m);
        }
      }
      /* Per-frame: lamps and floodlights come up at dusk, LEDs cycle, the aviation
         beacons pulse and the foam drifts. */
      const bridgeHue = new Three.Color();
      function updateBridgeVisuals() {
        const night = nightAmount,
          lit = clamp(night * 1.3 - 0.1, 0, 1);
        bridgeLampMaterial.color.copy(bridgeLampDay).lerp(bridgeLampNight, lit);
        bridgeDeckLampPower.value = lit * 3.4;
        for (const m of bridgeGlowMaterials) m.emissiveIntensity = lit * m.userData.glow;
        for (const m of bridgeLedMaterials) {
          const led = m.userData.led;
          if (led.cycle) bridgeHue.setHSL((gameTime * 0.04 * led.cycle + (led.cycle > 1 ? 0.5 : 0)) % 1, 0.9, 0.55);
          else bridgeHue.copy(led.base);
          m.color.setRGB(0.17, 0.19, 0.2).lerp(bridgeHue.multiplyScalar(led.strength), lit);
        }
        const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(gameTime * 3.2)) ** 2;
        const buffer = sceneBufferSize(kitSizeVector),
          ortho = camera.isOrthographicCamera,
          pixelsPerUnit = ortho
            ? buffer.y / Math.max(1, (camera.top - camera.bottom) / (camera.zoom || 1))
            : buffer.y / 2 / Math.tan(((camera.fov || 50) * Math.PI) / 360);
        for (const m of bridgeBeacons) {
          m.opacity = (0.2 + 0.8 * lit) * pulse;
          m.sizeAttenuation = !ortho;
          m.size = m.userData.worldSize * (ortho ? pixelsPerUnit : pixelsPerUnit / (buffer.y / 2));
        }
        bridgeFoamTexture.offset.set(Math.sin(gameTime * 0.4) * 0.012, Math.cos(gameTime * 0.33) * 0.012);
        bridgeFoamMaterial.opacity = 0.55 + 0.15 * Math.sin(gameTime * 0.9);
        // The drawbridge's leaves, arms, signals and the ketch (drawbridge3d.js).
        updateDrawbridgeVisuals();
      }
      // END SUBSYSTEM: src/bridges3d.js
