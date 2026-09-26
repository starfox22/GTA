      // BEGIN SUBSYSTEM: src/hypercars3d.js — The Prestige Collection's car models
      /**
       * The Prestige Collection's car models
       * Source: src/hypercars3d.js
       * Scope: createCityRenderer() closure, right after cars3d.js: it adds bodies
       * to CAR_BODIES with cars3d.js's own kit (civBody, the lofted shell with
       * sections keyframed along the car, the five-pane glasshouse, the merged
       * paint / trim / DRL / lamp sets, cornerLamp, ledLine, projector,
       * exhaustTips), so every car below is on the damage contract (crumpling
       * shell, per-pane glass, hood, bumpers, lamps, brake lights, night halos)
       * and pools into the body impostors when zoomed out.
       *
       * The game's most detailed cars (hypercars.js has their specs):
       *  - valkyrie WALTER MARTIN VALKYRIE: a road-going prototype. The shell's
       *    sections dip into two open venturi tunnels between the nose keel and
       *    the front wheel pods (dark channels seen from above), the waist pinches
       *    in behind them, a teardrop canopy with a dorsal fin behind it, roof
       *    exhausts, a full-width diffuser and hair-thin tail LEDs;
       *  - dbs WALTER MARTIN DBS SUPERLEGGERA: long bonnet with twin vents, the
       *    marque's trapezoid grille, side strakes, a carbon roof, a Kamm tail with
       *    the blade lamp, quad pipes;
       *  - zr1x CHEVETTE ZR1X: the Z06's body with the bridge vent through the
       *    bonnet, carbon dive planes and splitter, the tall wing on swan necks,
       *    quad centre pipes and ZR1X lettering;
       *  - chevetteSE CHEVETTE Z06 CARBON AERO: the Z06 with carbon bonnet stripe,
       *    wing, splitter and carbon wheels;
       *  - wayron MUGATTI WAYRON SUPER SPORT: round and heavy-shouldered: the
       *    horseshoe grille, LED-cluster lamps, the polished C-line sweeping round
       *    the side intake, two-tone paint (carbon from the C-line back and over
       *    the roof), twin roof scoops, the W16 on show, an active wing;
       *  - tourbillon MUGATTI TOURBILLON: the horseshoe, four vertical LED eyes a
       *    side, a dorsal spine from the roof down the engine cover, the light
       *    bar and the huge diffuser;
       *  - jasko KONIGSBERG JASKO ABSOLUT: the long low-drag tail with twin fins,
       *    ring tail lamps, a big central pipe, a black targa roof;
       *  - sirocco PAGANO SIROCCO: round and retro, quad round lamps, antennae
       *    mirrors, the roof snorkel and the four pipes in a circle;
       *  - novera RIMAK NOVERA: an electric slipstream: thin lamps, gills, the
       *    full-width tail bar, no pipes, an active wing;
       *  - w1 McLOWEN W1: eye-socket lamps, a very low nose, the long active wing
       *    and a deep diffuser, twin high pipes;
       *  - lafera CAVALINO LA FERA: the pointed nose and its dark spine, high rear
       *    wings, four round tail lamps, the active flap.
       *
       * PRESTIGE FINISH (hcPrestigeExtras): each paint gets a flake layer (the
       * base coat's normal jittered per 6 mm cell of the world, the clear coat
       * left smooth, so metallic sparkles under a glossy coat), and the cars with
       * active aero a wing that lifts above 110 km/h and stands up as an air
       * brake under hard braking (one extra draw, the trim material).
       * Carbon fibre is a twill pattern painted into the livery (sills, roofs,
       * bonnets, the two-tone) and the trim atlas's carbon cell on the aero.
       */
      // ---- Carbon twill for the liveries --------------------------------------------
      let hcCarbonCanvas = null;
      function hcCarbon(g, alpha = 0.97) {
        if (!hcCarbonCanvas) {
          hcCarbonCanvas = document.createElement('canvas');
          hcCarbonCanvas.width = hcCarbonCanvas.height = 8;
          const c = hcCarbonCanvas.getContext('2d');
          for (let y = 0; y < 8; y += 2)
            for (let x = 0; x < 8; x += 2) {
              const k = ((x >> 1) + (y >> 1)) % 2;
              c.fillStyle = k ? '#2c2e32' : '#17181b';
              c.fillRect(x, y, 2, 2);
              c.fillStyle = 'rgba(255,255,255,0.07)';
              c.fillRect(x, y, 2, 1);
            }
        }
        const pattern = g.createPattern(hcCarbonCanvas, 'repeat');
        g.globalAlpha = alpha;
        return pattern;
      }
      // Fill with the carbon twill (liveries), restoring the alpha afterwards.
      function hcCarbonBand(g, f, L, x0, x1, y0, y1) {
        L.band(g, f, x0, x1, y0, y1, hcCarbon(g));
        g.globalAlpha = 1;
      }
      function hcCarbonStripe(g, L, x0, x1, z0, z1) {
        L.stripe(x0, x1, z0, z1, hcCarbon(g));
        g.globalAlpha = 1;
      }
      // ---- The flake layer and active aero (body.extras) --------------------------------
      const HC_FLAKE = `
        {
          vec3 flakeCell = floor( vCityWorld * 20.0 );
          vec3 flakeHash = fract( sin( vec3( dot( flakeCell, vec3( 127.1, 311.7, 74.7 ) ), dot( flakeCell, vec3( 269.5, 183.3, 246.1 ) ), dot( flakeCell, vec3( 113.5, 271.9, 124.6 ) ) ) ) * 43758.5453 ) * 2.0 - 1.0;
          normal = normalize( normal + flakeHash * ( 0.06 * metalnessFactor + 0.012 ) );
        }`;
      function hcFlakePaint(paint) {
        const base = paint.onBeforeCompile;
        paint.onBeforeCompile = (shader) => {
          base(shader);
          shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + HC_FLAKE);
        };
        paint.customProgramCacheKey = () => 'car-livery-flake';
        // A deeper clear coat on the prestige cars.
        paint.clearcoatRoughness = 0.03;
        paint.needsUpdate = true;
      }
      /*
       * The active wing: `wing` {x, y, span, chord, lift, stands} in metres (x a
       * share of l, the trailing edge). Built in its own frame at the pivot on the
       * leading edge; it rises `lift` above 110 km/h and tilts to 55 degrees as an
       * air brake while the player brakes hard above 90 km/h.
       */
      function hcActiveWing(bodyGroup, body, l) {
        const w = body.activeWing,
          M = CAR_M,
          set = civSet(),
          S = civShapeKit(),
          chord = w.chord * M,
          span = w.span * M;
        // The blade (carbon), its end plates and a lit third brake light along the trailing edge.
        civBar(set, [-chord / 2, 0, -span / 2], [-chord / 2, 0, span / 2], 0.035 * M, chord, 0.012 * M, { color: '#1b1c1f', finish: 'carbon', cell: 'carbon' });
        for (const side of [-1, 1]) civAdd(set, S.box, -chord / 2, -0.02 * M, side * (span / 2 + 0.01 * M), chord * 1.1, 0.12 * M, 0.018 * M, { color: '#141517', finish: 'carbon' });
        civAdd(set, S.box, -chord + 0.01 * M, 0.02 * M, 0, 0.012 * M, 0.012 * M, span * 0.7, { color: '#ff3a2e', finish: 'lens' });
        // Its hydraulic stands (drawn only while it is raised: they scale with the lift).
        const stands = civSet();
        for (const side of [-1, 1]) civBar(stands, [-chord * 0.45, -1, side * span * 0.28], [-chord * 0.45, 0, side * span * 0.28], 0.04 * M, 0.1 * M, 0.012 * M, { color: '#101113', finish: 'satin' });
        const pivot = new Three.Group();
        pivot.position.set(w.x * l + chord, w.y * M, 0);
        bodyGroup.add(pivot);
        const blade = new Three.Mesh(civGeometry(set), civSharedMaterials().trim),
          arms = new Three.Mesh(civGeometry(stands), civSharedMaterials().trim);
        blade.castShadow = true;
        arms.castShadow = false;
        pivot.add(blade);
        pivot.add(arms);
        arms.scale.y = 0.001;
        return { pivot, blade, arms, lift: 0, tilt: 0, rest: w.y * M, raise: (w.lift || 0.18) * M };
      }
      function hcPrestigeExtras(bodyGroup, vehicle, paint) {
        const body = CAR_BODIES[vehicle.type],
          l = vehicleSpec(vehicle).l;
        hcFlakePaint(paint);
        const wing = body.activeWing ? hcActiveWing(bodyGroup, body, l) : null;
        if (!wing) return null;
        return {
          wing,
          animate(c, m, deltaSeconds) {
            const kmh = Math.abs(c.speed || 0) / KMH,
              braking = c === player.car && (keys.KeyS || keys.ArrowDown) && kmh > 90,
              lift = kmh > 110 || braking || c.showWing ? 1 : 0,
              tilt = braking ? 0.95 : lift ? 0.12 : 0;
            wing.lift += (lift - wing.lift) * Math.min(1, deltaSeconds * 3);
            wing.tilt += (tilt - wing.tilt) * Math.min(1, deltaSeconds * (braking ? 9 : 3));
            wing.pivot.position.y = wing.rest + wing.lift * wing.raise;
            // Trailing edge up: the blade stands into the air as a brake.
            wing.pivot.rotation.z = -wing.tilt;
            wing.arms.scale.y = Math.max(0.001, wing.lift * wing.raise);
            wing.arms.visible = wing.lift > 0.02;
          },
        };
      }
      // ---- Sections (10 points, from the underside's edge up to the top's centre) ------
      const SEC_VALK_POD = [[0, 0.9], [0.18, 0.99], [0.45, 1], [0.78, 0.96], [1.2, 0.86], [1.14, 0.72], [0.56, 0.62], [0.44, 0.47], [0.92, 0.24], [0.96, 0]],
        SEC_VALK_MID = [[0, 0.88], [0.18, 0.98], [0.42, 1], [0.62, 0.96], [0.72, 0.88], [0.72, 0.76], [0.7, 0.66], [0.98, 0.56], [0.98, 0.4], [0.8, 0]],
        SEC_VALK_REAR = [[0, 0.88], [0.18, 0.98], [0.46, 1], [0.8, 0.97], [1.1, 0.9], [1.14, 0.76], [0.96, 0.6], [0.9, 0.44], [1.06, 0.2], [1.12, 0]],
        SEC_ROUND = [[0, 0.84], [0.12, 0.95], [0.32, 1], [0.55, 0.99], [0.72, 0.96], [0.86, 0.9], [0.95, 0.8], [1.0, 0.62], [1.0, 0.35], [1, 0]],
        SEC_HAUNCH = [[0, 0.86], [0.12, 0.97], [0.32, 1], [0.55, 0.99], [0.76, 0.96], [0.93, 0.9], [1.05, 0.8], [1.1, 0.64], [1.04, 0.4], [1, 0]],
        SEC_SPINE = [[0, 0.86], [0.12, 0.97], [0.32, 1], [0.55, 0.99], [0.76, 0.96], [0.93, 0.9], [1.05, 0.8], [1.08, 0.62], [1.02, 0.2], [1.1, 0]],
        SEC_BLADE = [[0, 0.88], [0.1, 0.98], [0.28, 1], [0.5, 0.99], [0.66, 0.95], [0.78, 0.88], [0.88, 0.78], [0.95, 0.62], [0.99, 0.36], [1, 0]];
      const HC_CHROME = '#e6eaee',
        HC_ALU = '#c9ced3',
        HC_CARBON = '#1c1d20',
        HC_TAIL = '#ff2f24',
        HC_TAIL_LENS = '#3a0507';
      // Round tail lamp: a lens and a lit ring (tail set).
      function hcRingLamp(k, side, z, y, r, ring = true) {
        const { M, S } = k;
        k.round(k.tail(side), S.cylinder24, 'rear', z * M, y * M, r * M, 0.03 * M, { color: '#a8121a', finish: 'lens', lift: 0.02 * M }, side);
        if (ring) k.round(k.tail(side), S.torus, 'rear', z * M, y * M, r * 0.9 * M, 0.03 * M, { color: HC_TAIL, lift: 0.035 * M }, side);
      }
      // A carbon splitter lip across the nose, and a diffuser with strakes across the tail.
      function hcSplitter(k, y, span = 0.82, depth = 0.05) {
        const { M, sets } = k;
        k.patch(sets.trim, 'front', -span * M, span * M, (y - depth) * M, y * M, { cell: 'carbon', color: '#34363a', finish: 'carbon', tile: 0.1 * M, lift: 0.035 * M });
      }
      function hcDiffuser(k, y0, y1, span = 0.8, strakes = 5) {
        const { M, sets } = k;
        k.patch(sets.trim, 'rear', -span * M, span * M, y0 * M, y1 * M, { cell: 'carbon', color: '#2a2b2e', finish: 'carbon', tile: 0.1 * M, lift: 0.012 * M });
        for (let i = 0; i < strakes; i++) {
          const z = lerpNumber(-span * 0.85, span * 0.85, strakes > 1 ? i / (strakes - 1) : 0.5) * M,
            p = k.surf('rear', z, y0 * M, 0.02 * M);
          k.add(sets.trim, k.S.box, p[0] - 0.14 * M, (y0 + (y1 - y0) * 0.45) * M, z, 0.34 * M, (y1 - y0) * 0.9 * M, 0.014 * M, { color: '#101113', finish: 'carbon' });
        }
      }
      // Walter Martin's wings: a badge of two swept bars and a boss.
      function hcWings(k, frame, y, color = HC_CHROME) {
        const { M, sets } = k;
        for (const side of [-1, 1]) k.strip(sets.trim, frame, [[side * 0.02 * M, y * M], [side * 0.075 * M, (y + 0.012) * M], [side * 0.12 * M, (y + 0.018) * M]], 0.012 * M, 0.012 * M, { color, finish: 'chrome', lift: 0.02 * M });
        k.round(sets.trim, k.S.cylinder24, frame, 0, y * M, 0.02 * M, 0.012 * M, { color: '#0b4d3b', finish: 'gloss', lift: 0.022 * M });
      }
      // The horseshoe: a rounded arch narrowing to a flat foot, chrome framed, mesh inside.
      function hcHorseshoe(k, y0, y1, half, cell = 'mesh') {
        const { M, sets } = k,
          span = (z) => {
            const f = Math.abs(z) / (half * M);
            return [(y0 + 0.02 * f * f) * M, (y1 - (y1 - y0) * 0.42 * Math.pow(f, 2.4)) * M];
          };
        k.patch(sets.trim, 'front', -half * M, half * M, 0, 0, { cell, color: '#18191c', finish: 'gloss', tile: 0.04 * M, cols: 10, rows: 4, lift: 0.01 * M, span });
        // The frame: up one side, over the arch, down the other, and the foot.
        const outline = [];
        for (let i = 0; i <= 14; i++) {
          const z = lerpNumber(-half, half, i / 14) * M;
          outline.push([z, span(z)[1]]);
        }
        k.strip(sets.trim, 'front', outline, 0.026 * M, 0.026 * M, { color: HC_CHROME, finish: 'chrome', lift: 0.02 * M });
        for (const side of [-1, 1]) k.strip(sets.trim, 'front', [[side * half * M, span(side * half * M)[1]], [side * half * 0.92 * M, y0 * M]], 0.024 * M, 0.024 * M, { color: HC_CHROME, finish: 'chrome', lift: 0.02 * M });
        k.strip(sets.trim, 'front', [[-half * 0.92 * M, y0 * M], [half * 0.92 * M, y0 * M]], 0.022 * M, 0.024 * M, { color: HC_CHROME, finish: 'chrome', lift: 0.02 * M });
        // The red oval over the arch.
        k.round(sets.trim, k.S.cylinder24, 'front', 0, (y1 + 0.035) * M, 0.045 * M, 0.012 * M, { color: '#c8102e', finish: 'gloss', lift: 0.02 * M });
      }
      const HC_BODIES = {
        /* WALTER MARTIN VALKYRIE: pods over the front wheels, open tunnels either
           side of the keel, the waist pinched in behind them, a teardrop canopy
           with a fin behind it and the haunches over the rear wheels. */
        valkyrie: civBody('valkyrie', {
          yb: 0.1,
          h: 0.8,
          arches: 0.02,
          archSpan: 0.1,
          section: SEC_VALK_MID,
          sections: [[-0.5, SEC_VALK_REAR], [-0.22, SEC_VALK_REAR], [-0.08, SEC_VALK_MID], [0.1, SEC_VALK_MID], [0.2, SEC_VALK_POD], [0.5, SEC_VALK_POD]],
          profile: [
            [-0.5, 0.86, 0.72, 0.34], [-0.49, 0.94, 0.77, 0.22], [-0.46, 0.99, 0.8, 0.12], [-0.38, 1.02, 0.8], [-0.3, 1.03, 0.79], [-0.2, 0.98, 0.77],
            [-0.1, 0.9, 0.76], [0.04, 0.87, 0.75], [0.16, 0.9, 0.62], [0.26, 0.96, 0.52], [0.37, 0.98, 0.47], [0.45, 0.92, 0.41, 0.1], [0.49, 0.8, 0.34, 0.12], [0.5, 0.64, 0.28, 0.15],
          ],
          glass: { base: 0.72, roof: 1.06, xf: 0.2, xb: -0.3, rf: 0.04, rb: -0.12, wb: 0.25, wt: 0.14, bow: 0.035, bulge: 0.12, arch: 0.07, frame: 'gloss', aPillar: 'black', pillars: [] },
          wheel: { r: 0.34, rr: 0.36, width: 0.28, wr: 0.35, xf: 0.31, xr: -0.3, caliper: '#c9ced3' },
          rim: { style: 'aero', spokes: 10, color: '#1a1b1e', frac: 0.8 },
          hatch: true,
          doors: [[0.16, -0.12]],
          handles: [],
          mirrors: false,
          noWipers: true,
          hoodWidth: 0.34,
          hoodGap: 0.05,
          frontPlate: false,
          plateRear: 0.34,
          bumpers: [{ y: 0.12, h: 0.04, span: 0.9, material: 'black', d: 0.1 }, { y: 0.16, h: 0.05, span: 0.9, material: 'black' }],
          livery(g, f, L) {
            const { l, M } = L;
            // Carbon sills and the tub's lower edge, a lime pinstripe along the pods.
            hcCarbonBand(g, f, L, -0.3 * l, 0.28 * l, 0, 0.26 * M);
            L.band(g, f, -0.3 * l, 0.28 * l, 0.26 * M, 0.275 * M, '#b6f02c');
            // Carbon over the canopy's tub and the fin.
            hcCarbonStripe(g, L, -0.46 * l, -0.12 * l, -0.12, 0.12);
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // The tunnels: dark channels between the keel and the pods, from above and in front.
              k.patch(sets.trim, 'top', 0.2 * l, 0.47 * l, side * 0.33 * M, side * 0.58 * M, { color: '#050506', finish: 'matte', lift: 0.012 * M, cols: 8, rows: 2 });
              k.patch(sets.trim, 'front', side * 0.34 * M, side * 0.6 * M, 0.16 * M, 0.34 * M, { color: '#050506', finish: 'matte', lift: 0.01 * M, cols: 3, rows: 2 });
              // Slim lamps high on the pods with an LED brow.
              const pz = side * 0.8 * M;
              k.patch(k.head(side), 'front', pz - side * 0.1 * M, pz + side * 0.06 * M, 0.44 * M, 0.5 * M, { color: '#3d434a', finish: 'lens', cols: 4, rows: 1, lift: 0.014 * M });
              ledLine(k, sets.drl, 'front', [[pz - side * 0.12 * M, 0.51 * M], [pz + side * 0.07 * M, 0.535 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', pz - side * 0.02 * M, 0.47 * M, 0.018, side);
              k.halo('head', side, k.surf('front', pz, 0.47 * M, 0.05 * M), 0.9);
              // Camera stalks instead of mirrors.
              const base = glassPoint(k.g, l, k.w, 'side', 0.9, 0.1, side);
              k.bar(sets.trim, [base[0], base[1], base[2]], [base[0] - 0.05 * M, base[1] + 0.05 * M, base[2] + side * 0.16 * M], 0.025 * M, 0.04 * M, 0.01 * M, { color: '#0e0f11', finish: 'carbon' });
              k.add(sets.trim, S.box, base[0] - 0.06 * M, base[1] + 0.06 * M, base[2] + side * 0.17 * M, 0.1 * M, 0.035 * M, 0.035 * M, { color: '#16171a', finish: 'gloss' });
              // Hair-thin tail LEDs along the haunches' trailing edge, the vents above the rear wheels.
              const tw = at(-0.49 * l, 0.7 * M).half;
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.32, 0.7 * M], [side * tw * 0.96, 0.745 * M]], HC_TAIL, 0.012);
              k.halo('tail', side, k.surf('rear', side * tw * 0.7, 0.72 * M, 0.05 * M), 0.8);
              k.patch(sets.trim, 'top', -0.38 * l, -0.24 * l, side * 0.5 * M, side * 0.78 * M, { cell: 'louvre', color: '#1a1b1d', finish: 'gloss', tile: 0.07 * M, lift: 0.012 * M });
              // Roof exhausts either side of the fin.
              k.round(sets.trim, S.cylinder24, 'top', -0.33 * l, side * 0.2 * M, 0.05 * M, 0.08 * M, { color: '#8f949a', finish: 'chrome', lift: 0.03 * M });
              k.round(sets.trim, S.cylinder24, 'top', -0.33 * l, side * 0.2 * M, 0.038 * M, 0.09 * M, { color: '#070707', finish: 'matte', lift: 0.035 * M });
              // The rear wing's end plates on the haunches.
              k.bar(sets.trim, [-0.44 * l, k.top(-0.44 * l) + 0.02 * M, side * 0.62 * M], [-0.49 * l, k.top(-0.44 * l) + 0.12 * M, side * 0.62 * M], 0.1 * M, 0.02 * M, 0.008 * M, { color: '#141517', finish: 'carbon' });
            }
            // The keel's nose, badge and splitter.
            hcSplitter(k, 0.13, 0.86, 0.04);
            hcWings(k, 'front', 0.3);
            // The dorsal fin behind the canopy.
            const finTop = (x) => lerpNumber(1.02, 0.84, clamp((-x / l - 0.13) / 0.35, 0, 1)) * M;
            for (let q = 0; q < 6; q++) {
              const x0 = lerpNumber(-0.13, -0.47, q / 6) * l,
                x1 = lerpNumber(-0.13, -0.47, (q + 1) / 6) * l;
              k.bar(sets.paint, [x0, finTop(x0) - 0.05 * M, 0], [x1, finTop(x1) - 0.05 * M, 0], 0.1 * M, 0.025 * M, 0.01 * M, k.sw('paint'));
            }
            // The rear wing bridging the haunches, a third brake light on the fin.
            const wy = k.top(-0.47 * l) + 0.1 * M;
            k.bar(sets.trim, [-0.475 * l, wy, -0.64 * M], [-0.475 * l, wy, 0.64 * M], 0.025 * M, 0.2 * M, 0.01 * M, { color: '#141517', finish: 'carbon', cell: 'carbon' }, [0.2, 1, 0]);
            k.add(sets.drl, S.box, -0.47 * l, finTop(-0.46 * l) - 0.02 * M, 0, 0.04 * M, 0.012 * M, 0.012 * M, { color: '#ff3a2e' });
            // The diffuser.
            hcDiffuser(k, 0.1, 0.42, 0.86, 7);
            plateLight(k, 0.34);
          },
        }),
        /* WALTER MARTIN DBS SUPERLEGGERA: a long bonnet over the V12, the wide
           trapezoid grille, swept lamps, the strake behind each front wheel, a
           carbon roof, the Kamm tail with its blade lamp and a ducktail. */
        dbs: civBody('dbs', {
          yb: 0.13,
          h: 0.93,
          arches: 0.03,
          archSpan: 0.1,
          section: SEC_SPORT,
          sections: [[-0.5, SEC_FENDER_SOFT], [-0.3, SEC_FENDER_SOFT], [-0.15, SEC_SPORT], [0.14, SEC_SPORT], [0.26, SEC_FENDER_SOFT], [0.5, SEC_FENDER_SOFT]],
          profile: [
            [-0.5, 0.86, 0.87, 0.36], [-0.49, 0.94, 0.91, 0.24], [-0.47, 0.98, 0.93, 0.14], [-0.4, 1.0, 0.93], [-0.3, 1.02, 0.91], [-0.18, 0.99, 0.9],
            [-0.05, 0.97, 0.9], [0.08, 0.975, 0.87], [0.2, 0.985, 0.8], [0.3, 0.99, 0.75], [0.4, 0.98, 0.7], [0.46, 0.94, 0.65, 0.14], [0.49, 0.86, 0.58, 0.18], [0.5, 0.74, 0.5, 0.24],
          ],
          glass: { base: 0.93, roof: 1.26, xf: 0.1, xb: -0.38, rf: -0.08, rb: -0.26, wb: 0.4, wt: 0.3, bow: 0.024, bulge: 0.07, arch: 0.05, frame: 'chrome', pillars: [[0.42, 0.05, 'black']], aPillar: 'paint' },
          wheel: { r: 0.36, width: 0.27, wr: 0.32, xf: 0.335, xr: -0.3, caliper: '#b3121b' },
          rim: { style: 'y', spokes: 5, color: '#1c1d20', frac: 0.78, lipColor: '#6d7176', twist: 0.1 },
          hatch: false,
          doors: [[0.13, -0.08]],
          handles: [0.02],
          handleStyle: 'flush',
          frontPlate: false,
          plateRear: 0.5,
          hoodGap: 0.08,
          bumpers: [{ y: 0.2, h: 0.05, span: 0.86, material: 'black' }, { y: 0.24, h: 0.06, span: 0.88, material: 'black' }],
          livery(g, f, L) {
            const { l, M } = L;
            // The carbon roof and the carbon lower sills.
            hcCarbonStripe(g, L, -0.27 * l, -0.07 * l, -0.8, 0.8);
            hcCarbonBand(g, f, L, -0.28 * l, 0.24 * l, 0, 0.22 * M);
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            const gw = at(0.495 * l, 0.36 * M).half;
            // The grille: a wide trapezoid, rounded, with horizontal vanes and a chrome surround.
            k.patch(sets.trim, 'front', -gw * 0.62, gw * 0.62, 0, 0, {
              cell: 'slats',
              color: '#1a1b1e',
              finish: 'gloss',
              tile: 0.05 * M,
              cols: 10,
              rows: 4,
              lift: 0.01 * M,
              span: (z) => {
                const f = Math.abs(z) / (gw * 0.62);
                return [(0.22 + 0.03 * f * f) * M, (0.47 - 0.06 * Math.pow(f, 3)) * M];
              },
            });
            const outline = [];
            for (let i = 0; i <= 12; i++) {
              const z = lerpNumber(-gw * 0.62, gw * 0.62, i / 12),
                f = Math.abs(z) / (gw * 0.62);
              outline.push([z, (0.47 - 0.06 * Math.pow(f, 3)) * M]);
            }
            k.strip(sets.trim, 'front', outline, 0.02 * M, 0.02 * M, { color: HC_CHROME, finish: 'chrome', lift: 0.018 * M });
            k.strip(sets.trim, 'front', [[-gw * 0.6, 0.25 * M], [gw * 0.6, 0.25 * M]], 0.018 * M, 0.02 * M, { color: HC_CHROME, finish: 'chrome', lift: 0.018 * M });
            hcWings(k, 'front', 0.53);
            for (const side of [-1, 1]) {
              // Swept lamps over the grille's corners with an LED brow running down.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.62, zOut: 0.995, yIn: [0.55, 0.6], yOut: [0.56, 0.65], wrap: 0.5, wrapTip: 0.16, wrapRise: 0.07 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.64, 0.6 * M], [side * hw * 0.84, 0.625 * M], [side * hw * 0.99, 0.64 * M]], CV_LED, 0.012);
              ledLine(k, sets.drl, 'front', [[side * hw * 0.64, 0.6 * M], [side * hw * 0.68, 0.55 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', side * hw * 0.8, 0.6 * M, 0.026, side);
              k.halo('head', side, k.surf('front', side * hw * 0.8, 0.6 * M, 0.05 * M), 1);
              // Brake ducts low at the corners.
              k.patch(sets.trim, 'front', side * gw * 0.72, side * gw * 0.95, 0.2 * M, 0.3 * M, { cell: 'mesh', color: '#18191c', finish: 'gloss', tile: 0.05 * M });
              // Bonnet vents either side of the power bulge.
              k.patch(sets.trim, 'top', 0.2 * l, 0.3 * l, side * 0.28 * M, side * 0.46 * M, { cell: 'louvre', color: '#1a1b1e', finish: 'gloss', tile: 0.06 * M, lift: 0.012 * M });
              // The strake behind the front wheel: a dark gill with a chrome blade.
              k.patch(sets.trim, 'side', 0.13 * l, 0.2 * l, 0.44 * M, 0.66 * M, { side, cell: 'slats', color: '#131417', finish: 'gloss', tile: 0.05 * M, lift: 0.004 * M });
              k.strip(sets.trim, 'side', [[0.2 * l, 0.66 * M], [0.13 * l, 0.62 * M], [0.08 * l, 0.6 * M]], 0.012 * M, 0.012 * M, { color: HC_CHROME, finish: 'chrome' }, side);
              // The blade tail lamp: a thin red sweep from the wing to the centre.
              const tw = at(-0.495 * l, 0.8 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.12, side * tw * 0.99, (z) => {
                const f = Math.abs(z) / tw;
                return [(0.79 + 0.04 * f * f) * M, (0.825 + 0.05 * f * f) * M];
              }, HC_TAIL_LENS);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.14, 0.81 * M], [side * tw * 0.6, 0.83 * M], [side * tw * 0.97, 0.865 * M]], HC_TAIL, 0.012);
              k.halo('tail', side, k.surf('rear', side * tw * 0.75, 0.84 * M, 0.05 * M), 1);
            }
            // The ducktail lip, the diffuser, quad pipes at the corners.
            const x = -0.485 * l,
              tw = at(x, k.top(x)).half;
            k.bar(sets.paint, [x, k.top(x) + 0.03 * M, -tw * 0.92], [x, k.top(x) + 0.03 * M, tw * 0.92], 0.03 * M, 0.12 * M, 0.012 * M, k.sw('paint'), [0.3, 1, 0]);
            hcDiffuser(k, 0.16, 0.36, 0.72, 5);
            exhaustTips(k, [-0.6, -0.48, 0.48, 0.6], 0.26, 0.045, '#9da3a9');
            hcWings(k, 'rear', 0.66);
            plateLight(k, 0.5);
          },
        }),
        /* CHEVETTE ZR1X: the Z06's body with the aero of the fastest one. */
        zr1x: civBody('zr1x', {
          yb: 0.11,
          h: 0.9,
          arches: 0.038,
          archSpan: 0.1,
          section: SEC_WEDGE,
          sections: [[-0.5, SEC_FENDER], [-0.2, SEC_FENDER], [-0.09, SEC_WEDGE], [0.1, SEC_WEDGE], [0.2, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.86, 0.87, 0.3], [-0.49, 0.94, 0.93, 0.2], [-0.47, 0.99, 0.96, 0.12], [-0.4, 1.03, 0.97], [-0.3, 1.05, 0.96], [-0.2, 1.0, 0.95],
            [-0.05, 0.96, 0.9], [0.08, 0.97, 0.86], [0.2, 0.99, 0.79], [0.3, 1.0, 0.74], [0.4, 0.98, 0.66], [0.46, 0.93, 0.56, 0.11], [0.49, 0.84, 0.47, 0.15], [0.5, 0.74, 0.38, 0.2],
          ],
          glass: { base: 0.88, roof: 1.22, xf: 0.13, xb: -0.42, rf: -0.06, rb: -0.17, wb: 0.39, wt: 0.3, bow: 0.022, bulge: 0.06, arch: 0.05, frame: 'gloss', sideFrom: 0.42, pillars: [[0.42, 0.06, 'black']], aPillar: 'black', buttress: 'paint' },
          wheel: { r: 0.35, rr: 0.37, width: 0.29, wr: 0.36, xf: 0.3, xr: -0.29, caliper: '#e3b62b' },
          rim: { style: 'split', spokes: 5, color: '#16171a', frac: 0.79, lipColor: '#2a2c30' },
          hatch: true,
          doors: [[0.12, -0.08]],
          handles: [],
          frontPlate: false,
          plateRear: 0.42,
          bumpers: [{ y: 0.13, h: 0.04, span: 0.9, material: 'black', d: 0.1 }, { y: 0.17, h: 0.06, span: 0.9, material: 'black' }],
          livery(g, f, L) {
            const { l, M } = L;
            // Carbon bonnet bridge, roof and sills; the ZR1X name on the flanks.
            hcCarbonStripe(g, L, 0.18 * l, 0.3 * l, -0.5, 0.5);
            hcCarbonStripe(g, L, -0.17 * l, -0.05 * l, -0.7, 0.7);
            hcCarbonBand(g, f, L, -0.3 * l, 0.26 * l, 0, 0.24 * M);
            L.text(g, f, 'ZR1X', -0.02 * l, 0.36 * M, 0.08 * M, 'rgba(16,17,19,0.9)', { weight: '900', spacing: 0.01 * M });
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.48, zOut: 0.995, yIn: [0.4, 0.46], yOut: [0.47, 0.56], wrap: 0.42, wrapTip: 0.15, wrapRise: 0.07 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.5, 0.458 * M], [side * hw * 0.7, 0.49 * M], [side * hw * 0.99, 0.56 * M]], CV_LED, 0.014);
              ledLine(k, sets.drl, 'front', [[side * hw * 0.52, 0.44 * M], [side * hw * 0.72, 0.465 * M]], CV_LED, 0.01);
              projector(k, k.head(side), 'front', side * hw * 0.64, 0.44 * M, 0.025, side);
              projector(k, k.head(side), 'front', side * hw * 0.78, 0.47 * M, 0.025, side);
              k.halo('head', side, k.surf('front', side * hw * 0.72, 0.46 * M, 0.05 * M), 1);
              // Big flank intakes, the nose ducts, carbon dive planes.
              k.patch(sets.trim, 'side', -0.22 * l, -0.05 * l, 0.34 * M, 0.8 * M, { side, cell: 'honeycomb', color: '#141517', finish: 'gloss', tile: 0.1 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.22 * l) / (0.17 * l); return [(0.34 + 0.06 * f) * M, (0.62 + 0.18 * f) * M]; } });
              k.patch(sets.trim, 'front', side * hw * 0.52, side * hw * 0.94, 0.17 * M, 0.35 * M, { cell: 'honeycomb', color: '#141517', finish: 'gloss', tile: 0.08 * M });
              k.bar(sets.trim, k.surf('front', side * hw * 0.8, 0.26 * M, 0.06 * M), k.surf('front', side * hw * 0.98, 0.3 * M, 0.02 * M), 0.012 * M, 0.14 * M, 0.005 * M, { color: '#1b1c1f', finish: 'carbon', cell: 'carbon' });
              // Tail lamps and the swan-neck stands of the big wing.
              const tw = at(-0.495 * l, 0.8 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.42, side * tw * 0.99, (z) => { const f = (Math.abs(z) / tw - 0.42) / 0.57; return [(0.74 + f * 0.05) * M, (0.82 + f * 0.06) * M]; }, '#2a0508');
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.44, 0.76 * M], [side * tw * 0.97, 0.815 * M]], CV_TAIL_BAR, 0.014);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.5, 0.8 * M], [side * tw * 0.97, 0.86 * M]], CV_TAIL_BAR, 0.012);
              k.halo('tail', side, k.surf('rear', side * tw * 0.72, 0.8 * M, 0.05 * M), 1);
              const wx = -0.44 * l,
                wt = k.top(wx);
              k.bar(sets.trim, [wx, wt, side * 0.42 * M], [wx - 0.06 * M, wt + 0.22 * M, side * 0.42 * M], 0.03 * M, 0.08 * M, 0.012 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' });
              k.bar(sets.trim, [wx - 0.06 * M, wt + 0.22 * M, side * 0.42 * M], [-0.49 * l, wt + 0.4 * M, side * 0.42 * M], 0.03 * M, 0.08 * M, 0.012 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' });
            }
            // The bridge: a dark vent right through the bonnet, a carbon blade over it.
            k.patch(sets.trim, 'top', 0.19 * l, 0.29 * l, -0.42 * M, 0.42 * M, { color: '#060607', finish: 'matte', lift: 0.013 * M, cols: 6, rows: 3 });
            k.bar(sets.trim, [0.24 * l, k.topY(0.24 * l, 0) + 0.05 * M, -0.46 * M], [0.24 * l, k.topY(0.24 * l, 0) + 0.05 * M, 0.46 * M], 0.02 * M, 0.22 * M, 0.008 * M, { color: '#1b1c1f', finish: 'carbon', cell: 'carbon' }, [0.3, 1, 0]);
            hcSplitter(k, 0.13, 0.9, 0.05);
            const gw = at(0.495 * l, 0.25 * M).half;
            k.grille('front', -gw * 0.5, gw * 0.5, 0.16 * M, 0.3 * M, { cell: 'honeycomb', color: '#1f2023', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.08 * M });
            badge(k, 'front', 0, 0.36, 0.035, '#c9ced3');
            hcDiffuser(k, 0.12, 0.34, 0.82, 6);
            k.patch(sets.trim, 'rear', -0.22 * M, 0.22 * M, 0.2 * M, 0.46 * M, { color: '#0c0c0d', finish: 'gloss', cols: 2, rows: 2, lift: 0.014 * M });
            exhaustTips(k, [-0.1, 0.1], 0.27, 0.048, '#3a3d42');
            exhaustTips(k, [-0.1, 0.1], 0.39, 0.048, '#3a3d42');
            // The V8 under glass with its red covers, the tall wing.
            const ex = -0.3 * l;
            k.bar(sets.trim, [ex - 0.3 * M, 0.83 * M, 0], [ex + 0.25 * M, 0.83 * M, 0], 0.08 * M, 0.5 * M, 0.03 * M, { color: '#1c1d1f', finish: 'satin' });
            for (const side of [-1, 1]) k.bar(sets.trim, [ex - 0.28 * M, 0.89 * M, side * 0.18 * M], [ex + 0.22 * M, 0.89 * M, side * 0.18 * M], 0.04 * M, 0.1 * M, 0.02 * M, { color: '#b3121b', finish: 'gloss' });
            const wy = k.top(-0.44 * l) + 0.4 * M;
            k.bar(sets.trim, [-0.492 * l, wy, -0.8 * M], [-0.492 * l, wy, 0.8 * M], 0.035 * M, 0.34 * M, 0.015 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' }, [0.22, 1, 0]);
            k.bar(sets.trim, [-0.5 * l, wy + 0.06 * M, -0.8 * M], [-0.5 * l, wy + 0.06 * M, 0.8 * M], 0.02 * M, 0.1 * M, 0.008 * M, { color: '#111214', finish: 'carbon' }, [0.6, 1, 0]);
            for (const side of [-1, 1]) k.add(sets.trim, S.box, -0.492 * l, wy - 0.03 * M, side * 0.81 * M, 0.38 * M, 0.16 * M, 0.02 * M, { color: '#111214', finish: 'carbon' });
            k.add(sets.drl, S.box, -0.5 * l + 0.03 * M, wy - 0.01 * M, 0, 0.02 * M, 0.015 * M, 0.6 * M, { color: '#ff3a2e' });
            plateLight(k, 0.42);
          },
        }),
        /* MUGATTI WAYRON SUPER SPORT: round, heavy shoulders, the horseshoe, the
           C-line and two-tone paint, the twin roof scoops over the W16. */
        wayron: civBody('wayron', {
          yb: 0.12,
          h: 0.86,
          arches: 0.045,
          archSpan: 0.11,
          section: SEC_ROUND,
          sections: [[-0.5, SEC_HAUNCH], [-0.22, SEC_HAUNCH], [-0.1, SEC_ROUND], [0.12, SEC_ROUND], [0.22, SEC_HAUNCH], [0.5, SEC_HAUNCH]],
          profile: [
            [-0.5, 0.88, 0.8, 0.36], [-0.49, 0.95, 0.85, 0.24], [-0.47, 0.99, 0.88, 0.14], [-0.4, 1.02, 0.89], [-0.3, 1.03, 0.88], [-0.2, 1.0, 0.86],
            [-0.08, 0.97, 0.84], [0.06, 0.97, 0.79], [0.18, 0.985, 0.73], [0.28, 0.99, 0.68], [0.38, 0.98, 0.63], [0.45, 0.94, 0.57, 0.12], [0.49, 0.86, 0.5, 0.16], [0.5, 0.76, 0.42, 0.22],
          ],
          glass: { base: 0.86, roof: 1.18, xf: 0.18, xb: -0.2, rf: 0.0, rb: -0.12, wb: 0.4, wt: 0.3, bow: 0.03, bulge: 0.08, arch: 0.06, frame: 'chrome', pillars: [[0.32, 0.05, 'black']], aPillar: 'black' },
          wheel: { r: 0.35, rr: 0.365, width: 0.27, wr: 0.34, xf: 0.31, xr: -0.29, caliper: '#18191c' },
          rim: { style: 'split', spokes: 5, color: '#c9ced3', frac: 0.78, lipColor: '#eef1f3', centreLock: true },
          hatch: true,
          doors: [[0.15, -0.06]],
          handles: [0.0],
          handleStyle: 'chrome',
          frontPlate: false,
          plateRear: 0.52,
          bumpers: [{ y: 0.16, h: 0.05, span: 0.86, material: 'black' }, { y: 0.2, h: 0.06, span: 0.86, material: 'black' }],
          activeWing: { x: -0.49, y: 0.9, span: 1.36, chord: 0.34, lift: 0.2 },
          extras: hcPrestigeExtras,
          livery(g, f, L) {
            const { l, M } = L;
            // The two-tone: carbon from the C-line back, over the roof and down the tail;
            // the front, doors and bonnet in the paint.
            g.save();
            const pattern = hcCarbon(g);
            L.polygon(g, f, [[-0.06 * l, 0.84 * M], [-0.06 * l, 0.74 * M], [-0.11 * l, 0.56 * M], [-0.14 * l, 0.3 * M], [-0.1 * l, 0.12 * M], [-0.55 * l, 0.12 * M], [-0.55 * l, 0.84 * M]], pattern);
            hcCarbonStripe(g, L, -0.55 * l, 0.02 * l, -1.2, 1.2);
            g.restore();
            g.globalAlpha = 1;
            // The polished spine down the bonnet's centre, and the carbon sills forward.
            L.stripe(0.02 * l, 0.5 * l, -0.012, 0.012, 'rgba(210,214,218,0.95)');
            hcCarbonBand(g, f, L, -0.1 * l, 0.26 * l, 0, 0.2 * M);
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            hcHorseshoe(k, 0.22, 0.5, 0.17, 'mesh');
            for (const side of [-1, 1]) {
              // Teardrop lamps with four LED dots each.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.46, zOut: 0.97, yIn: [0.44, 0.52], yOut: [0.48, 0.6], wrap: 0.36, wrapTip: 0.2, wrapRise: 0.06, curve: 0.02 });
              for (let i = 0; i < 4; i++) k.round(sets.drl, S.lowDome, 'front', side * hw * (0.56 + i * 0.1), (0.505 + i * 0.012) * M, 0.022 * M, 0.02 * M, { color: CV_LED, finish: 'lens', lift: 0.028 * M }, side);
              projector(k, k.head(side), 'front', side * hw * 0.84, 0.54 * M, 0.024, side);
              k.halo('head', side, k.surf('front', side * hw * 0.7, 0.52 * M, 0.05 * M), 1);
              // The big lower intakes either side of the horseshoe.
              k.patch(sets.trim, 'front', side * 0.26 * M, side * hw * 0.92, 0.17 * M, 0.38 * M, { cell: 'mesh', color: '#141517', finish: 'gloss', tile: 0.05 * M, span: (z) => { const f = (Math.abs(z) - 0.26 * M) / Math.max(1, hw * 0.92 - 0.26 * M); return [0.17 * M, (0.4 - 0.06 * f) * M]; } });
              // The C-line: a polished sweep from the top of the door back, down round the intake and forward.
              const c = [[-0.02 * l, 0.8], [-0.07 * l, 0.8], [-0.12 * l, 0.72], [-0.15 * l, 0.56], [-0.15 * l, 0.4], [-0.12 * l, 0.28], [-0.06 * l, 0.22], [0.05 * l, 0.2]].map(([x, y]) => [x, y * M]);
              k.strip(sets.trim, 'side', c, 0.04 * M, 0.02 * M, { color: HC_ALU, finish: 'chrome', lift: 0.012 * M }, side);
              // The intake inside the C.
              k.patch(sets.trim, 'side', -0.14 * l, -0.07 * l, 0.36 * M, 0.66 * M, { side, cell: 'mesh', color: '#111214', finish: 'gloss', tile: 0.05 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.14 * l) / (0.07 * l); return [(0.4 - 0.04 * f) * M, (0.6 + 0.08 * f) * M]; } });
              // The roof scoops over the engine.
              k.bar(sets.paint, [-0.13 * l, k.g.roof - 0.02 * M, side * 0.3 * M], [-0.26 * l, k.g.roof - 0.1 * M, side * 0.34 * M], 0.14 * M, 0.2 * M, 0.06 * M, k.sw('dark'));
              k.add(sets.trim, S.box, -0.13 * l + 0.012 * M, k.g.roof - 0.02 * M, side * 0.3 * M, 0.02 * M, 0.1 * M, 0.16 * M, { color: '#050506', finish: 'matte' });
              // Tail lamps: a slim LED line over the tail, round reversing lamps below.
              const tw = at(-0.49 * l, 0.74 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.1, side * tw * 0.98, (z) => [0.72 * M, 0.765 * M], HC_TAIL_LENS);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.12, 0.745 * M], [side * tw * 0.96, 0.745 * M]], HC_TAIL, 0.014);
              k.halo('tail', side, k.surf('rear', side * tw * 0.7, 0.745 * M, 0.05 * M), 1);
              k.round(sets.trim, S.cylinder24, 'rear', side * tw * 0.8, 0.46 * M, 0.035 * M, 0.02 * M, { color: '#f0f0ea', finish: 'lens', lift: 0.02 * M });
            }
            // The W16 on show between the scoops: dark mesh with polished covers.
            k.patch(sets.trim, 'top', -0.36 * l, -0.2 * l, -0.28 * M, 0.28 * M, { cell: 'mesh', color: '#1c1d20', finish: 'gloss', tile: 0.07 * M, lift: 0.02 * M });
            for (const z of [-0.14, 0.14]) k.bar(sets.trim, [-0.34 * l, k.topY(-0.3 * l, z * M) + 0.05 * M, z * M], [-0.22 * l, k.topY(-0.25 * l, z * M) + 0.05 * M, z * M], 0.04 * M, 0.09 * M, 0.02 * M, { color: HC_ALU, finish: 'chrome' });
            // A central pair of trapezoid pipes and the diffuser.
            hcDiffuser(k, 0.14, 0.4, 0.78, 5);
            for (const z of [-0.09, 0.09]) {
              k.patch(sets.trim, 'rear', (z - 0.07) * M, (z + 0.07) * M, 0.3 * M, 0.4 * M, { color: '#bfc4c9', finish: 'chrome', cols: 2, rows: 1, lift: 0.03 * M });
              k.patch(sets.trim, 'rear', (z - 0.055) * M, (z + 0.055) * M, 0.315 * M, 0.385 * M, { color: '#060606', finish: 'matte', cols: 2, rows: 1, lift: 0.035 * M });
            }
            badge(k, 'rear', 0, 0.62, 0.04, '#c8102e');
            plateLight(k, 0.52);
          },
        }),
        /* MUGATTI TOURBILLON: the horseshoe, four vertical LED eyes a side, the
           spine from the roof down the engine cover, the light bar, the diffuser. */
        tourbillon: civBody('tourbillon', {
          yb: 0.12,
          h: 0.86,
          arches: 0.045,
          archSpan: 0.11,
          section: SEC_ROUND,
          sections: [[-0.5, SEC_SPINE], [-0.2, SEC_SPINE], [-0.1, SEC_ROUND], [0.12, SEC_ROUND], [0.22, SEC_HAUNCH], [0.5, SEC_HAUNCH]],
          profile: [
            [-0.5, 0.88, 0.82, 0.38], [-0.49, 0.95, 0.86, 0.24], [-0.47, 0.99, 0.88, 0.14], [-0.4, 1.02, 0.88], [-0.3, 1.03, 0.87], [-0.2, 1.0, 0.86],
            [-0.08, 0.97, 0.84], [0.06, 0.97, 0.78], [0.18, 0.985, 0.72], [0.28, 0.99, 0.67], [0.38, 0.98, 0.62], [0.45, 0.94, 0.56, 0.12], [0.49, 0.86, 0.49, 0.16], [0.5, 0.76, 0.41, 0.22],
          ],
          glass: { base: 0.86, roof: 1.18, xf: 0.18, xb: -0.22, rf: 0.0, rb: -0.13, wb: 0.4, wt: 0.29, bow: 0.03, bulge: 0.08, arch: 0.06, frame: 'gloss', pillars: [[0.34, 0.05, 'black']], aPillar: 'black' },
          wheel: { r: 0.36, rr: 0.37, width: 0.28, wr: 0.35, xf: 0.31, xr: -0.29, caliper: '#1d4fb8' },
          rim: { style: 'spider', spokes: 7, color: '#2a2c30', frac: 0.8, lipColor: '#8a9096', centreLock: true },
          hatch: true,
          doors: [[0.15, -0.06]],
          handles: [],
          frontPlate: false,
          plateRear: 0.5,
          bumpers: [{ y: 0.15, h: 0.05, span: 0.86, material: 'black' }, { y: 0.18, h: 0.06, span: 0.88, material: 'black' }],
          activeWing: { x: -0.495, y: 0.86, span: 1.46, chord: 0.36, lift: 0.22 },
          extras: hcPrestigeExtras,
          livery(g, f, L) {
            const { l, M } = L;
            // Exposed carbon: the lower third all round and the spine.
            hcCarbonBand(g, f, L, -0.55 * l, 0.55 * l, 0, 0.3 * M);
            hcCarbonStripe(g, L, -0.55 * l, 0.5 * l, -0.05, 0.05);
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            hcHorseshoe(k, 0.2, 0.47, 0.16, 'hex');
            for (const side of [-1, 1]) {
              // Four vertical LED eyes in a dark lens.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.5, zOut: 0.96, yIn: [0.42, 0.5], yOut: [0.44, 0.58], wrap: 0.3, wrapTip: 0.3, wrapRise: 0.05 });
              for (let i = 0; i < 4; i++) {
                const z = side * hw * (0.58 + i * 0.1),
                  y = 0.44 + i * 0.012;
                ledLine(k, sets.drl, 'front', [[z, y * M], [z, (y + 0.1) * M]], CV_LED, 0.014);
              }
              k.halo('head', side, k.surf('front', side * hw * 0.74, 0.5 * M, 0.05 * M), 1.1);
              // Lower intakes and the shoulder vents.
              k.patch(sets.trim, 'front', side * 0.24 * M, side * hw * 0.94, 0.15 * M, 0.36 * M, { cell: 'hex', color: '#131417', finish: 'gloss', tile: 0.07 * M });
              k.patch(sets.trim, 'top', 0.3 * l, 0.4 * l, side * 0.52 * M, side * 0.72 * M, { cell: 'louvre', color: '#15161a', finish: 'gloss', tile: 0.06 * M, lift: 0.012 * M });
              // A slimmer C sweep and the side intake.
              k.strip(sets.trim, 'side', [[-0.03 * l, 0.78 * M], [-0.1 * l, 0.72 * M], [-0.14 * l, 0.55 * M], [-0.13 * l, 0.36 * M], [-0.08 * l, 0.3 * M]], 0.025 * M, 0.015 * M, { color: '#aab0b6', finish: 'chrome', lift: 0.012 * M }, side);
              k.patch(sets.trim, 'side', -0.13 * l, -0.06 * l, 0.38 * M, 0.66 * M, { side, cell: 'hex', color: '#101113', finish: 'gloss', tile: 0.06 * M, lift: 0.004 * M });
              const tw = at(-0.49 * l, 0.76 * M).half;
              hcRingLamp(k, side, (side * tw * 0.86) / M, 0.62, 0.035, false);
              k.halo('tail', side, k.surf('rear', side * tw * 0.6, 0.76 * M, 0.05 * M), 1.1);
              // The full-width light bar, lit in both halves.
              ledLine(k, k.tail(side), 'rear', [[side * 0.02 * M, 0.76 * M], [side * tw * 0.98, 0.76 * M]], HC_TAIL, 0.016);
            }
            // The spine rising from the roof down the engine cover.
            for (let q = 0; q < 6; q++) {
              const x0 = lerpNumber(-0.12, -0.47, q / 6) * l,
                x1 = lerpNumber(-0.12, -0.47, (q + 1) / 6) * l;
              k.bar(sets.trim, [x0, k.topY(x0, 0) + 0.02 * M, 0], [x1, k.topY(x1, 0) + 0.02 * M, 0], 0.05 * M, 0.035 * M, 0.012 * M, { color: '#1b1c1f', finish: 'carbon', cell: 'carbon' });
            }
            k.patch(sets.trim, 'top', -0.38 * l, -0.22 * l, -0.3 * M, -0.06 * M, { cell: 'hex', color: '#1f2023', finish: 'gloss', tile: 0.07 * M, lift: 0.02 * M });
            k.patch(sets.trim, 'top', -0.38 * l, -0.22 * l, 0.06 * M, 0.3 * M, { cell: 'hex', color: '#1f2023', finish: 'gloss', tile: 0.07 * M, lift: 0.02 * M });
            hcDiffuser(k, 0.12, 0.5, 0.84, 7);
            exhaustTips(k, [0], 0.56, 0.08, '#b9bec3');
            badge(k, 'rear', 0, 0.68, 0.035, '#c8102e');
            plateLight(k, 0.5);
          },
        }),
        /* KONIGSBERG JASKO ABSOLUT: long, low drag; twin fins on the tail, a black
           targa roof, ring tail lamps and one big central pipe. */
        jasko: civBody('jasko', {
          yb: 0.12,
          h: 0.87,
          arches: 0.04,
          archSpan: 0.1,
          section: SEC_BLADE,
          sections: [[-0.5, SEC_HAUNCH], [-0.24, SEC_HAUNCH], [-0.1, SEC_BLADE], [0.12, SEC_BLADE], [0.22, SEC_FENDER_SOFT], [0.5, SEC_FENDER_SOFT]],
          profile: [
            [-0.5, 0.82, 0.78, 0.3], [-0.49, 0.9, 0.82, 0.2], [-0.47, 0.96, 0.84, 0.12], [-0.4, 1.01, 0.86], [-0.3, 1.03, 0.87], [-0.2, 1.0, 0.86],
            [-0.08, 0.97, 0.84], [0.06, 0.97, 0.78], [0.18, 0.98, 0.7], [0.28, 0.99, 0.64], [0.38, 0.98, 0.58], [0.45, 0.94, 0.52, 0.12], [0.49, 0.86, 0.46, 0.15], [0.5, 0.76, 0.4, 0.2],
          ],
          glass: { base: 0.86, roof: 1.2, xf: 0.2, xb: -0.2, rf: 0.02, rb: -0.12, wb: 0.4, wt: 0.3, bow: 0.03, bulge: 0.09, arch: 0.05, frame: 'gloss', pillars: [[0.3, 0.05, 'black']], aPillar: 'black' },
          wheel: { r: 0.35, rr: 0.37, width: 0.27, wr: 0.34, xf: 0.31, xr: -0.29, caliper: '#c8102e' },
          rim: { style: 'spider', spokes: 10, color: '#1a1b1e', frac: 0.8, lipColor: '#303236', centreLock: true },
          hatch: true,
          roofSwatch: 'roof',
          roofColor: '#111214',
          doors: [[0.16, -0.06]],
          handles: [],
          frontPlate: false,
          plateRear: 0.5,
          bumpers: [{ y: 0.15, h: 0.05, span: 0.86, material: 'black' }, { y: 0.18, h: 0.06, span: 0.86, material: 'black' }],
          extras: hcPrestigeExtras,
          livery(g, f, L) {
            const { l, M } = L;
            hcCarbonBand(g, f, L, -0.4 * l, 0.36 * l, 0, 0.24 * M);
            // Racing stripes over the long tail.
            L.stripe(-0.52 * l, 0.52 * l, -0.2, -0.13, 'rgba(18,19,21,0.85)');
            L.stripe(-0.52 * l, 0.52 * l, 0.13, 0.2, 'rgba(18,19,21,0.85)');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.54, zOut: 0.99, yIn: [0.41, 0.45], yOut: [0.44, 0.5], wrap: 0.3, wrapTip: 0.2, wrapRise: 0.05 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.56, 0.44 * M], [side * hw * 0.98, 0.48 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', side * hw * 0.72, 0.435 * M, 0.02, side);
              projector(k, k.head(side), 'front', side * hw * 0.86, 0.45 * M, 0.02, side);
              k.halo('head', side, k.surf('front', side * hw * 0.78, 0.45 * M, 0.05 * M), 0.95);
              // Wide side intakes in the nose, the ducts behind the front wheels.
              k.patch(sets.trim, 'front', side * 0.3 * M, side * hw * 0.96, 0.15 * M, 0.34 * M, { cell: 'mesh', color: '#121316', finish: 'gloss', tile: 0.05 * M });
              k.patch(sets.trim, 'side', 0.16 * l, 0.21 * l, 0.36 * M, 0.58 * M, { side, cell: 'slats', color: '#121316', finish: 'gloss', tile: 0.05 * M, lift: 0.004 * M });
              k.patch(sets.trim, 'side', -0.2 * l, -0.07 * l, 0.36 * M, 0.62 * M, { side, cell: 'mesh', color: '#111214', finish: 'gloss', tile: 0.06 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.2 * l) / (0.13 * l); return [(0.36 + 0.04 * f) * M, (0.52 + 0.1 * f) * M]; } });
              // The twin fins.
              for (let q = 0; q < 4; q++) {
                const x0 = lerpNumber(-0.24, -0.49, q / 4) * l,
                  x1 = lerpNumber(-0.24, -0.49, (q + 1) / 4) * l,
                  h0 = lerpNumber(0.02, 0.28, q / 4) * M,
                  h1 = lerpNumber(0.02, 0.28, (q + 1) / 4) * M,
                  z = side * 0.52 * M;
                k.bar(sets.paint, [x0, k.topY(x0, z) + h0 / 2, z], [x1, k.topY(x1, z) + h1 / 2, z], Math.max(0.02 * M, (h0 + h1) / 2), 0.025 * M, 0.008 * M, k.sw('paint'));
              }
              // Ring tail lamps.
              const tw = at(-0.49 * l, 0.66 * M).half;
              for (const zf of [0.55, 0.82]) {
                k.round(k.tail(side), S.torus, 'rear', side * tw * zf, 0.66 * M, 0.06 * M, 0.03 * M, { color: HC_TAIL, lift: 0.03 * M }, side);
                k.round(k.tail(side), S.cylinder24, 'rear', side * tw * zf, 0.66 * M, 0.045 * M, 0.02 * M, { color: '#2a0508', finish: 'lens', lift: 0.022 * M }, side);
              }
              k.halo('tail', side, k.surf('rear', side * tw * 0.7, 0.66 * M, 0.05 * M), 1);
            }
            hcSplitter(k, 0.13, 0.88, 0.05);
            const gw = at(0.495 * l, 0.26 * M).half;
            k.grille('front', -gw * 0.34, gw * 0.34, 0.17 * M, 0.33 * M, { cell: 'mesh', color: '#1a1b1e', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.05 * M });
            badge(k, 'front', 0, 0.4, 0.03, '#d9b14a');
            hcDiffuser(k, 0.12, 0.36, 0.82, 5);
            exhaustTips(k, [0], 0.44, 0.075, '#b9bec3');
            k.patch(sets.trim, 'top', -0.4 * l, -0.24 * l, -0.26 * M, 0.26 * M, { cell: 'louvre', color: '#18191c', finish: 'gloss', tile: 0.06 * M, lift: 0.014 * M });
            plateLight(k, 0.5);
          },
        }),
        /* PAGANO SIROCCO: round, retro and carbon; quad round lamps, antennae
           mirrors, a roof snorkel and the four pipes in a circle. */
        sirocco: civBody('sirocco', {
          yb: 0.12,
          h: 0.84,
          arches: 0.05,
          archSpan: 0.11,
          section: SEC_ROUND,
          sections: [[-0.5, SEC_HAUNCH], [-0.22, SEC_HAUNCH], [-0.1, SEC_ROUND], [0.12, SEC_ROUND], [0.22, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.84, 0.76, 0.32], [-0.49, 0.92, 0.8, 0.22], [-0.47, 0.98, 0.83, 0.13], [-0.4, 1.02, 0.85], [-0.3, 1.03, 0.84], [-0.2, 0.99, 0.83],
            [-0.08, 0.95, 0.81], [0.06, 0.96, 0.76], [0.18, 0.98, 0.69], [0.28, 0.99, 0.64], [0.38, 0.98, 0.59], [0.45, 0.94, 0.54, 0.12], [0.49, 0.86, 0.47, 0.15], [0.5, 0.74, 0.4, 0.21],
          ],
          glass: { base: 0.84, roof: 1.16, xf: 0.19, xb: -0.2, rf: 0.0, rb: -0.13, wb: 0.38, wt: 0.27, bow: 0.036, bulge: 0.09, arch: 0.07, frame: 'gloss', pillars: [[0.34, 0.05, 'black']], aPillar: 'black' },
          wheel: { r: 0.34, rr: 0.36, width: 0.27, wr: 0.34, xf: 0.31, xr: -0.29, caliper: '#1a1b1e' },
          rim: { style: 'mesh', spokes: 12, color: '#b8964e', frac: 0.8, lipColor: '#d8c28a', centreLock: true },
          hatch: true,
          doors: [[0.16, -0.06]],
          handles: [],
          mirrors: false,
          frontPlate: false,
          plateRear: 0.48,
          bumpers: [{ y: 0.15, h: 0.05, span: 0.84, material: 'black' }, { y: 0.18, h: 0.06, span: 0.84, material: 'black' }],
          extras: hcPrestigeExtras,
          livery(g, f, L) {
            const { l, M } = L;
            // Exposed carbo-titanium: the sills, the lower nose and the roof's spine.
            hcCarbonBand(g, f, L, -0.55 * l, 0.55 * l, 0, 0.24 * M);
            hcCarbonStripe(g, L, -0.2 * l, 0.02 * l, -0.2, 0.2);
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // Quad round lamps in an oval pod.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.5, zOut: 0.96, yIn: [0.42, 0.52], yOut: [0.44, 0.56], wrap: 0.3, wrapTip: 0.4, wrapRise: 0.04, color: '#1d2126' });
              for (const [zf, dy] of [[0.62, 0], [0.8, 0.012]]) {
                projector(k, k.head(side), 'front', side * hw * zf, (0.47 + dy) * M, 0.04, side);
                k.round(sets.drl, S.ring, 'front', side * hw * zf, (0.47 + dy) * M, 0.05 * M, 0.02 * M, { color: CV_LED, lift: 0.03 * M }, side);
              }
              k.halo('head', side, k.surf('front', side * hw * 0.72, 0.48 * M, 0.05 * M), 1);
              // Antennae mirrors: a thin stalk arching out to a small oval head.
              const base = glassPoint(k.g, l, k.w, 'side', 0.92, 0.08, side);
              k.bar(sets.trim, base, [base[0] - 0.12 * M, base[1] + 0.12 * M, base[2] + side * 0.22 * M], 0.018 * M, 0.018 * M, 0.008 * M, { color: '#1b1c1f', finish: 'carbon' });
              k.bar(sets.paint, [base[0] - 0.06 * M, base[1] + 0.13 * M, base[2] + side * 0.24 * M], [base[0] - 0.2 * M, base[1] + 0.13 * M, base[2] + side * 0.24 * M], 0.07 * M, 0.1 * M, 0.035 * M, k.sw('paint'));
              // Side intakes and vents.
              k.patch(sets.trim, 'side', -0.2 * l, -0.08 * l, 0.36 * M, 0.6 * M, { side, cell: 'mesh', color: '#111214', finish: 'gloss', tile: 0.05 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.2 * l) / (0.12 * l); return [0.36 * M, (0.5 + 0.1 * f) * M]; } });
              k.patch(sets.trim, 'front', side * 0.26 * M, side * hw * 0.92, 0.16 * M, 0.34 * M, { cell: 'mesh', color: '#121316', finish: 'gloss', tile: 0.05 * M });
              // Round tail lamps, two a side.
              const tw = at(-0.49 * l, 0.7 * M).half;
              for (const zf of [0.52, 0.78]) hcRingLamp(k, side, (side * tw * zf) / M, 0.7, 0.055);
              k.halo('tail', side, k.surf('rear', side * tw * 0.65, 0.7 * M, 0.05 * M), 1);
            }
            // The roof snorkel and the carbon rear deck.
            k.bar(sets.paint, [-0.02 * l, k.g.roof + k.g.arch + 0.02 * M, 0], [-0.2 * l, k.g.roof + 0.02 * M, 0], 0.09 * M, 0.2 * M, 0.04 * M, k.sw('paint'));
            k.add(sets.trim, S.cylinder24, -0.02 * l + 0.012 * M, k.g.roof + k.g.arch + 0.02 * M, 0, 0.05 * M, 0.02 * M, 0.08 * M, { color: '#050506', finish: 'matte' }, 0, 0, Math.PI / 2);
            k.patch(sets.trim, 'top', -0.42 * l, -0.22 * l, -0.34 * M, 0.34 * M, { cell: 'carbon', color: '#3a3c40', finish: 'carbon', tile: 0.1 * M, lift: 0.014 * M });
            hcSplitter(k, 0.13, 0.84, 0.05);
            const gw = at(0.495 * l, 0.26 * M).half;
            k.grille('front', -gw * 0.3, gw * 0.3, 0.2 * M, 0.34 * M, { cell: 'mesh', color: '#1a1b1e', frame: '#b8964e', frameFinish: 'chrome', tile: 0.05 * M });
            // Four pipes in a circle, the signature.
            hcDiffuser(k, 0.12, 0.3, 0.8, 4);
            for (let i = 0; i < 4; i++) {
              const a = Math.PI / 4 + (i * Math.PI) / 2;
              exhaustTips(k, [Math.cos(a) * 0.075], 0.44 + Math.sin(a) * 0.075, 0.04, '#d0d4d8');
            }
            k.round(sets.trim, S.torus, 'rear', 0, 0.44 * M, 0.14 * M, 0.03 * M, { color: '#b8bdc2', finish: 'chrome', lift: 0.03 * M });
            plateLight(k, 0.48);
          },
        }),
        /* RIMAK NOVERA: an electric slipstream: slim lamps, big front intakes,
           gills behind the front wheels, the full-width tail bar, no pipes. */
        novera: civBody('novera', {
          yb: 0.12,
          h: 0.88,
          arches: 0.035,
          archSpan: 0.1,
          section: SEC_BLADE,
          sections: [[-0.5, SEC_FENDER_SOFT], [-0.24, SEC_FENDER_SOFT], [-0.1, SEC_BLADE], [0.12, SEC_BLADE], [0.22, SEC_FENDER_SOFT], [0.5, SEC_FENDER_SOFT]],
          profile: [
            [-0.5, 0.86, 0.82, 0.34], [-0.49, 0.93, 0.86, 0.22], [-0.47, 0.98, 0.88, 0.13], [-0.4, 1.02, 0.89], [-0.3, 1.03, 0.88], [-0.2, 1.0, 0.87],
            [-0.08, 0.97, 0.85], [0.06, 0.97, 0.8], [0.18, 0.985, 0.73], [0.28, 0.99, 0.67], [0.38, 0.98, 0.61], [0.45, 0.94, 0.55, 0.12], [0.49, 0.86, 0.48, 0.15], [0.5, 0.74, 0.41, 0.21],
          ],
          glass: { base: 0.88, roof: 1.2, xf: 0.18, xb: -0.22, rf: 0.0, rb: -0.12, wb: 0.4, wt: 0.3, bow: 0.028, bulge: 0.08, arch: 0.05, frame: 'gloss', pillars: [[0.32, 0.05, 'black']], aPillar: 'black' },
          wheel: { r: 0.36, rr: 0.37, width: 0.27, wr: 0.33, xf: 0.31, xr: -0.29, caliper: '#e2b21c' },
          rim: { style: 'aero', spokes: 7, color: '#2a2c30', frac: 0.8 },
          hatch: true,
          doors: [[0.16, -0.08]],
          handles: [],
          handleStyle: 'flush',
          frontPlate: false,
          plateRear: 0.52,
          bumpers: [{ y: 0.15, h: 0.05, span: 0.86, material: 'black' }, { y: 0.18, h: 0.06, span: 0.86, material: 'black' }],
          activeWing: { x: -0.49, y: 0.86, span: 1.3, chord: 0.3, lift: 0.16 },
          extras: hcPrestigeExtras,
          livery(g, f, L) {
            const { l, M } = L;
            hcCarbonBand(g, f, L, -0.55 * l, 0.55 * l, 0, 0.22 * M);
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.52, zOut: 0.99, yIn: [0.45, 0.48], yOut: [0.47, 0.52], wrap: 0.46, wrapTip: 0.15, wrapRise: 0.06 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.53, 0.475 * M], [side * hw * 0.8, 0.49 * M], [side * hw * 0.99, 0.515 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', side * hw * 0.78, 0.48 * M, 0.018, side);
              k.halo('head', side, k.surf('front', side * hw * 0.78, 0.48 * M, 0.05 * M), 0.95);
              k.patch(sets.trim, 'front', side * 0.24 * M, side * hw * 0.96, 0.15 * M, 0.38 * M, { cell: 'honeycomb', color: '#121316', finish: 'gloss', tile: 0.07 * M });
              // The gills behind the front wheels and the scalloped side intake.
              for (let i = 0; i < 3; i++) k.strip(sets.trim, 'side', [[(0.17 - i * 0.022) * l, 0.4 * M], [(0.16 - i * 0.022) * l, 0.64 * M]], 0.02 * M, 0.02 * M, { color: '#101113', finish: 'gloss' }, side);
              k.patch(sets.trim, 'side', -0.21 * l, -0.07 * l, 0.34 * M, 0.66 * M, { side, cell: 'honeycomb', color: '#101113', finish: 'gloss', tile: 0.07 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.21 * l) / (0.14 * l); return [(0.34 + 0.06 * f) * M, (0.5 + 0.16 * f) * M]; } });
              const tw = at(-0.49 * l, 0.72 * M).half;
              ledLine(k, k.tail(side), 'rear', [[side * 0.02 * M, 0.72 * M], [side * tw * 0.99, 0.735 * M]], HC_TAIL, 0.014);
              k.halo('tail', side, k.surf('rear', side * tw * 0.6, 0.72 * M, 0.05 * M), 1);
            }
            hcSplitter(k, 0.13, 0.86, 0.05);
            k.grille('front', -0.2 * M, 0.2 * M, 0.2 * M, 0.34 * M, { cell: 'honeycomb', color: '#18191c', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.06 * M });
            badge(k, 'front', 0, 0.42, 0.03, '#c9ced3');
            hcDiffuser(k, 0.12, 0.44, 0.84, 7);
            // A sealed battery tunnel along the centre instead of an engine cover.
            k.patch(sets.trim, 'top', -0.42 * l, -0.2 * l, -0.18 * M, 0.18 * M, { cell: 'carbon', color: '#34363a', finish: 'carbon', tile: 0.1 * M, lift: 0.014 * M });
            plateLight(k, 0.52);
          },
        }),
        /* McLOWEN W1: eye-socket lamps over vertical intakes, a very low nose, the
           long active wing and a deep diffuser, twin high pipes. */
        w1: civBody('w1', {
          yb: 0.11,
          h: 0.86,
          arches: 0.04,
          archSpan: 0.1,
          section: SEC_BLADE,
          sections: [[-0.5, SEC_HAUNCH], [-0.22, SEC_HAUNCH], [-0.1, SEC_BLADE], [0.12, SEC_BLADE], [0.22, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.86, 0.8, 0.36], [-0.49, 0.93, 0.84, 0.24], [-0.47, 0.98, 0.86, 0.13], [-0.4, 1.02, 0.87], [-0.3, 1.03, 0.86], [-0.2, 0.99, 0.84],
            [-0.08, 0.95, 0.82], [0.06, 0.96, 0.76], [0.18, 0.98, 0.67], [0.28, 0.99, 0.6], [0.38, 0.98, 0.53], [0.45, 0.94, 0.47, 0.11], [0.49, 0.86, 0.41, 0.14], [0.5, 0.74, 0.35, 0.19],
          ],
          glass: { base: 0.84, roof: 1.17, xf: 0.2, xb: -0.22, rf: 0.01, rb: -0.12, wb: 0.39, wt: 0.28, bow: 0.034, bulge: 0.1, arch: 0.06, frame: 'gloss', pillars: [[0.32, 0.05, 'black']], aPillar: 'black' },
          wheel: { r: 0.35, rr: 0.37, width: 0.27, wr: 0.35, xf: 0.31, xr: -0.29, caliper: '#ff7a1a' },
          rim: { style: 'y', spokes: 5, color: '#1a1b1e', frac: 0.8, twist: 0.3, centreLock: true },
          hatch: true,
          doors: [[0.16, -0.06]],
          handles: [],
          frontPlate: false,
          plateRear: 0.48,
          bumpers: [{ y: 0.14, h: 0.05, span: 0.86, material: 'black' }, { y: 0.17, h: 0.06, span: 0.86, material: 'black' }],
          activeWing: { x: -0.5, y: 0.84, span: 1.5, chord: 0.36, lift: 0.26 },
          extras: hcPrestigeExtras,
          livery(g, f, L) {
            const { l, M } = L;
            hcCarbonBand(g, f, L, -0.55 * l, 0.55 * l, 0, 0.25 * M);
            // The door's air channel, a dark scoop along the flank.
            L.polygon(g, f, [[0.1 * l, 0.5 * M], [-0.2 * l, 0.62 * M], [-0.2 * l, 0.46 * M], [0.1 * l, 0.42 * M]], 'rgba(14,15,17,0.9)');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // The eye socket: a dark teardrop with the lamp in its top and the LED curling round.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.46, zOut: 0.96, yIn: [0.26, 0.44], yOut: [0.3, 0.48], wrap: 0.26, wrapTip: 0.3, wrapRise: 0.03, color: '#101215' });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.5, 0.43 * M], [side * hw * 0.7, 0.46 * M], [side * hw * 0.92, 0.47 * M], [side * hw * 0.95, 0.4 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', side * hw * 0.74, 0.435 * M, 0.022, side);
              k.patch(sets.trim, 'front', side * hw * 0.5, side * hw * 0.9, 0.2 * M, 0.34 * M, { cell: 'mesh', color: '#0d0e10', finish: 'gloss', tile: 0.04 * M, lift: 0.02 * M });
              k.halo('head', side, k.surf('front', side * hw * 0.74, 0.44 * M, 0.05 * M), 0.95);
              k.patch(sets.trim, 'side', -0.22 * l, -0.1 * l, 0.36 * M, 0.66 * M, { side, cell: 'mesh', color: '#0f1012', finish: 'gloss', tile: 0.05 * M, lift: 0.004 * M });
              // Slim tail LEDs high on the rear deck.
              const tw = at(-0.49 * l, 0.76 * M).half;
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.3, 0.77 * M], [side * tw * 0.97, 0.79 * M]], HC_TAIL, 0.012);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.9, 0.79 * M], [side * tw * 0.97, 0.7 * M]], HC_TAIL, 0.012);
              k.halo('tail', side, k.surf('rear', side * tw * 0.7, 0.77 * M, 0.05 * M), 1);
            }
            hcSplitter(k, 0.12, 0.88, 0.05);
            k.grille('front', -0.22 * M, 0.22 * M, 0.14 * M, 0.3 * M, { cell: 'mesh', color: '#121316', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.05 * M });
            badge(k, 'front', 0, 0.36, 0.025, '#ff7a1a');
            hcDiffuser(k, 0.12, 0.48, 0.88, 7);
            exhaustTips(k, [-0.06, 0.06], 0.6, 0.05, '#8a9096');
            k.patch(sets.trim, 'top', -0.4 * l, -0.22 * l, -0.3 * M, 0.3 * M, { cell: 'louvre', color: '#15161a', finish: 'gloss', tile: 0.06 * M, lift: 0.014 * M });
            plateLight(k, 0.48);
          },
        }),
        /* CAVALINO LA FERA: the pointed nose with its dark spine, high rear wings,
           four round tail lamps, the active flap between them. */
        lafera: civBody('lafera', {
          yb: 0.11,
          h: 0.84,
          arches: 0.05,
          archSpan: 0.11,
          section: SEC_SPORT,
          sections: [[-0.5, SEC_FENDER], [-0.2, SEC_FENDER], [-0.09, SEC_SPORT], [0.1, SEC_SPORT], [0.2, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.84, 0.8, 0.32], [-0.49, 0.92, 0.84, 0.22], [-0.47, 0.98, 0.86, 0.13], [-0.4, 1.02, 0.87], [-0.3, 1.03, 0.86], [-0.2, 0.99, 0.84],
            [-0.06, 0.94, 0.8], [0.08, 0.95, 0.74], [0.2, 0.97, 0.66], [0.3, 0.98, 0.59], [0.4, 0.96, 0.52], [0.46, 0.9, 0.46, 0.11], [0.49, 0.78, 0.4, 0.14], [0.5, 0.6, 0.34, 0.18],
          ],
          glass: { base: 0.82, roof: 1.12, xf: 0.2, xb: -0.18, rf: 0.01, rb: -0.1, wb: 0.38, wt: 0.26, bow: 0.036, bulge: 0.1, arch: 0.07, frame: 'gloss', pillars: [[0.32, 0.05, 'black']], aPillar: 'black' },
          wheel: { r: 0.34, rr: 0.36, width: 0.26, wr: 0.34, xf: 0.3, xr: -0.29, caliper: '#f2c500' },
          rim: { style: 'split', spokes: 5, color: '#2a2c30', frac: 0.78, centreLock: true },
          hatch: true,
          doors: [[0.16, -0.06]],
          handles: [],
          frontPlate: false,
          plateRear: 0.46,
          bumpers: [{ y: 0.13, h: 0.04, span: 0.8, material: 'black' }, { y: 0.16, h: 0.05, span: 0.86, material: 'black' }],
          activeWing: { x: -0.49, y: 0.8, span: 0.9, chord: 0.24, lift: 0.1 },
          extras: hcPrestigeExtras,
          livery(g, f, L) {
            const { l, M } = L;
            // The dark visor from the nose up to the windscreen, carbon sills.
            L.stripe(0.2 * l, 0.52 * l, -0.16, 0.16, 'rgba(14,15,17,0.95)');
            hcCarbonBand(g, f, L, -0.3 * l, 0.26 * l, 0, 0.22 * M);
            L.draw(g, f, 0.28 * l, 0.58 * M, (c, px) => {
              c.fillStyle = '#f2c500';
              c.fillRect(-0.04 * px * M, -0.05 * px * M, 0.08 * px * M, 0.1 * px * M);
              c.fillStyle = '#111';
              c.fillRect(-0.01 * px * M, -0.03 * px * M, 0.02 * px * M, 0.06 * px * M);
            });
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // Slim lamps swept far back along the wings.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.4, zOut: 0.99, yIn: [0.36, 0.4], yOut: [0.42, 0.47], wrap: 0.74, wrapTip: 0.12, wrapRise: 0.13 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.42, 0.39 * M], [side * hw * 0.7, 0.42 * M], [side * hw * 0.99, 0.47 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', side * hw * 0.74, 0.42 * M, 0.022, side);
              k.halo('head', side, k.surf('front', side * hw * 0.74, 0.42 * M, 0.05 * M), 0.95);
              k.patch(sets.trim, 'front', side * 0.12 * M, side * hw * 0.8, 0.14 * M, 0.3 * M, { cell: 'mesh', color: '#111214', finish: 'gloss', tile: 0.04 * M });
              k.patch(sets.trim, 'side', -0.19 * l, -0.07 * l, 0.36 * M, 0.62 * M, { side, cell: 'slats', color: '#111214', finish: 'gloss', tile: 0.05 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.19 * l) / (0.12 * l); return [0.36 * M, (0.5 + 0.12 * f) * M]; } });
              const tw = at(-0.49 * l, 0.72 * M).half;
              for (const zf of [0.5, 0.78]) hcRingLamp(k, side, (side * tw * zf) / M, 0.72, 0.05);
              k.halo('tail', side, k.surf('rear', side * tw * 0.64, 0.72 * M, 0.05 * M), 1);
            }
            hcSplitter(k, 0.12, 0.8, 0.04);
            k.round(sets.trim, S.cylinder24, 'top', 0.46 * l, 0, 0.03 * M, 0.016 * M, { color: '#f2c500', finish: 'gloss' });
            hcDiffuser(k, 0.12, 0.42, 0.8, 5);
            exhaustTips(k, [-0.08, 0.08], 0.34, 0.05, '#9da3a9');
            k.patch(sets.trim, 'top', -0.44 * l, -0.26 * l, -0.3 * M, 0.3 * M, { cell: 'louvre', color: '#15161a', finish: 'gloss', tile: 0.06 * M, lift: 0.014 * M });
            plateLight(k, 0.46);
          },
        }),
      };
      // The Z06 carbon aero edition: the Z06's body with carbon everywhere the track pack adds it.
      HC_BODIES.chevetteSE = {
        ...CAR_BODIES.chevette,
        name: 'chevetteSE',
        rim: { style: 'spider', spokes: 10, color: '#15161a', frac: 0.79, lipColor: '#26282c', centreLock: true, finish: 'carbon' },
        extras: hcPrestigeExtras,
        livery(g, f, L) {
          const { l, M } = L;
          CAR_BODIES.chevette.livery(g, f, L);
          // Carbon bonnet stripe, roof and the carbon sills a hand's width higher.
          hcCarbonStripe(g, L, 0.1 * l, 0.5 * l, -0.24, 0.24);
          hcCarbonStripe(g, L, -0.17 * l, -0.05 * l, -0.7, 0.7);
          hcCarbonBand(g, f, L, -0.3 * l, 0.26 * l, 0, 0.26 * M);
          L.text(g, f, 'Z06', 0.35 * l, 0.62 * M, 0.06 * M, 'rgba(18,19,21,0.9)', { weight: '900' });
        },
        details(k) {
          CAR_BODIES.chevette.details(k);
          // The carbon splitter and dive planes of the aero pack.
          const { M, at, l } = k;
          hcSplitter(k, 0.13, 0.9, 0.05);
          for (const side of [-1, 1]) {
            const hw = at(0.48 * l, 0.3 * M).half;
            k.bar(k.sets.trim, k.surf('front', side * hw * 0.78, 0.25 * M, 0.06 * M), k.surf('front', side * hw * 0.98, 0.29 * M, 0.02 * M), 0.012 * M, 0.14 * M, 0.005 * M, { color: '#1b1c1f', finish: 'carbon', cell: 'carbon' });
          }
        },
      };
      // The prestige finish on the cars whose bodies did not name it.
      for (const body of Object.values(HC_BODIES)) if (!body.extras) body.extras = hcPrestigeExtras;
      Object.assign(CAR_BODIES, HC_BODIES);
      // END SUBSYSTEM: src/hypercars3d.js
