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
