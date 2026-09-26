        // CAR_BODIES part 2: supercar, luxury, limousine, suv, van, pickup, chevette, brutini, cavalino.
        /* V12 TEMPEST: a front-mid V12 grand tourer (812 / DBS): a long bonnet with
           vents, a wide slatted grille, lamps swept up into the wings, a fastback
           roof, four round tail lamps and quad pipes in the diffuser. */
        supercar: civBody('supercar', {
          yb: 0.12,
          h: 0.86,
          arches: 0.03,
          archSpan: 0.1,
          section: SEC_WEDGE,
          sections: [[-0.5, SEC_FENDER_SOFT], [-0.25, SEC_FENDER_SOFT], [-0.12, SEC_WEDGE], [0.02, SEC_WEDGE], [0.14, SEC_FENDER_SOFT], [0.5, SEC_FENDER_SOFT]],
          profile: [
            [-0.5, 0.8, 0.82, 0.3], [-0.49, 0.9, 0.88, 0.2], [-0.47, 0.96, 0.9, 0.13], [-0.4, 1.0, 0.9], [-0.3, 1.02, 0.89], [-0.15, 1.0, 0.86],
            [0.0, 0.98, 0.84], [0.1, 0.985, 0.8], [0.25, 0.995, 0.75], [0.36, 0.985, 0.7], [0.44, 0.955, 0.63], [0.475, 0.9, 0.56, 0.14], [0.49, 0.82, 0.48, 0.18], [0.5, 0.72, 0.4, 0.24],
          ],
          glass: { base: 0.83, roof: 1.27, xf: 0.07, xb: -0.42, rf: -0.09, rb: -0.3, wb: 0.39, wt: 0.3, bow: 0.022, bulge: 0.06, arch: 0.05, frame: 'gloss', pillars: [[0.5, 0.05, 'black']], aPillar: 'black' },
          wheel: { r: 0.36, width: 0.27, wr: 0.32, xf: 0.3, xr: -0.29, caliper: '#e3b62b' },
          rim: { style: 'split', spokes: 5, color: '#2a2c30', frac: 0.76, centreLock: true, lipColor: '#9aa0a6' },
          hatch: true,
          doors: [[0.06, -0.14]],
          handles: [-0.08],
          handleStyle: 'flush',
          bumpers: [{ y: 0.18, h: 0.05, span: 0.85, material: 'black' }, { y: 0.2, h: 0.06, span: 0.85, material: 'black' }],
          plateRear: 0.46,
          plateFront: 0.28,
          frontPlate: false,
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.55, zOut: 0.995, yIn: [0.46, 0.5], yOut: [0.52, 0.6], wrap: 0.55, wrapTip: 0.2, wrapRise: 0.08 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.56, 0.49 * M], [side * hw * 0.8, 0.53 * M], [side * hw * 0.98, 0.585 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', side * hw * 0.76, 0.53 * M, 0.03, side);
              k.halo('head', side, k.surf('front', side * hw * 0.76, 0.53 * M, 0.05 * M), 1);
              // Twin round tail lamps each side on a dark panel.
              const tw = at(-0.495 * l, 0.72 * M).half;
              k.patch(sets.trim, 'rear', side * tw * 0.4, side * tw * 0.97, 0.66 * M, 0.78 * M, { color: '#101113', finish: 'gloss', cols: 4, rows: 1 });
              for (const zf of [0.56, 0.82]) {
                k.round(k.tail(side), S.cylinder24, 'rear', side * tw * zf, 0.72 * M, 0.055 * M, 0.03 * M, { color: '#a8121a', finish: 'lens', lift: 0.02 * M }, side);
                k.round(k.tail(side), S.torus, 'rear', side * tw * zf, 0.72 * M, 0.05 * M, 0.03 * M, { color: CV_TAIL_BAR, lift: 0.035 * M }, side);
              }
              k.halo('tail', side, k.surf('rear', side * tw * 0.7, 0.72 * M, 0.05 * M), 1);
              // Bonnet vents, side gills behind the front wheels.
              k.patch(sets.trim, 'top', 0.16 * l, 0.24 * l, side * 0.3 * M, side * 0.4 * M, { cell: 'louvre', color: '#3a3d42', finish: 'gloss', tile: 0.08 * M, lift: 0.012 * M });
              k.patch(sets.trim, 'side', 0.13 * l, 0.2 * l, 0.42 * M, 0.62 * M, { side, cell: 'slats', color: '#16171a', finish: 'gloss', tile: 0.08 * M });
            }
            const gw = at(0.495 * l, 0.3 * M).half;
            k.grille('front', -gw * 0.8, gw * 0.8, 0.2 * M, 0.4 * M, { cell: 'slats', color: '#26282c', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.05 * M });
            badge(k, 'front', 0, 0.44, 0.035, '#d9b14a');
            k.patch(sets.trim, 'rear', -0.7 * M, 0.7 * M, 0.14 * M, 0.3 * M, { cell: 'slats', color: '#16181b', finish: 'carbon', tile: 0.06 * M, lift: 0.012 * M });
            exhaustTips(k, [-0.46, -0.34, 0.34, 0.46], 0.24, 0.045, '#bfc4c9');
            const x = -0.48 * l,
              tw = at(x, k.top(x)).half;
            k.bar(sets.paint, [x, k.top(x) + 0.02 * M, -tw * 0.85], [x, k.top(x) + 0.02 * M, tw * 0.85], 0.025 * M, 0.1 * M, 0.012 * M, k.sw('paint'), [0, 1, 0]);
            plateLight(k, 0.46);
          },
        }),
        /* MONARCH V12: a Phantom-style limousine saloon: an upright stainless
           temple grille with the mascot, slim rectangular lamps, a long bonnet,
           coach doors, chrome everywhere, seven thin chrome spokes. */
        luxury: civBody('luxury', {
          yb: 0.2,
          h: 1.08,
          arches: 0.006,
          section: SEC_TALL,
          profile: [
            [-0.5, 0.82, 0.96, 0.34], [-0.492, 0.92, 1.03, 0.24], [-0.47, 0.975, 1.07, 0.2], [-0.42, 0.995, 1.08], [-0.3, 1.0, 1.08], [-0.2, 1.0, 1.08],
            [0.15, 1.0, 1.07], [0.25, 1.0, 1.06], [0.4, 0.995, 1.04], [0.47, 0.97, 1.0, 0.2], [0.49, 0.93, 0.95, 0.24], [0.5, 0.86, 0.88, 0.3],
          ],
          glass: { base: 1.07, roof: 1.62, xf: 0.19, xb: -0.33, rf: 0.04, rb: -0.25, wb: 0.41, wt: 0.345, bow: 0.012, bulge: 0.04, arch: 0.04, frame: 'chrome', pillars: [[0.47, 0.09, 'paint'], [0, 0.2, 'paint']] },
          wheel: { r: 0.39, width: 0.255, xf: 0.31, xr: -0.29 },
          rim: { style: 'spider', spokes: 7, color: '#e3e7ea', frac: 0.7, finish: 'chrome', capColor: '#e3e7ea' },
          doors: [[0.19, -0.02], [-0.02, -0.24]],
          handles: [0.1, -0.02],
          handleStyle: 'chrome',
          sill: '#9aa0a6',
          bumpers: [{ y: 0.36, h: 0.06, span: 0.85, material: 'chrome', d: 0.06 }, { y: 0.4, h: 0.06, span: 0.85, material: 'chrome', d: 0.06 }],
          plateRear: 0.68,
          plateFront: 0.4,
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.495 * l, 0.8 * M).half;
            // The temple grille: tall stainless vanes in a heavy surround, the mascot on top.
            k.grille('front', -hw * 0.33, hw * 0.33, 0.48 * M, 0.95 * M, { cell: 'bars', color: '#dfe3e6', finish: 'chrome', frame: CV_CHROME, frameWidth: 0.05 * M, tile: 0.04 * M, lift: 0.03 * M });
            const top = k.surf('front', 0, 0.96 * M, 0.04 * M);
            k.add(sets.trim, S.box, top[0] - 0.03 * M, top[1] + 0.07 * M, 0, 0.08 * M, 0.12 * M, 0.02 * M, { color: CV_CHROME, finish: 'chrome' }, 0, 0, 0.4);
            for (const side of [-1, 1]) {
              lampPatch(k, k.head(side), 'front', side * hw * 0.42, side * hw * 0.92, () => [0.78 * M, 0.9 * M], '#aeb5bc');
              ledLine(k, sets.drl, 'front', [[side * hw * 0.44, 0.905 * M], [side * hw * 0.9, 0.905 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.55, 0.84 * M, 0.035, side);
              projector(k, k.head(side), 'front', side * hw * 0.78, 0.84 * M, 0.035, side);
              k.halo('head', side, k.surf('front', side * hw * 0.66, 0.84 * M, 0.05 * M), 1.1);
              k.patch(sets.trim, 'front', side * hw * 0.5, side * hw * 0.9, 0.4 * M, 0.5 * M, { cell: 'bars', color: '#9aa0a6', finish: 'chrome', tile: 0.04 * M });
              const tw = at(-0.495 * l, 0.9 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.66, side * tw * 0.99, () => [0.74 * M, 1.02 * M], '#8e1016');
              k.patch(k.tail(side), 'rear', side * tw * 0.7, side * tw * 0.8, 0.8 * M, 0.86 * M, { color: CV_REVERSE, finish: 'lens', cols: 2, rows: 1, lift: 0.02 * M });
              k.halo('tail', side, k.surf('rear', side * tw * 0.82, 0.9 * M, 0.05 * M), 1.1);
            }
            // A chrome strip along the waist and across the tail.
            const tw = at(-0.495 * l, 0.9 * M).half;
            k.strip(sets.trim, 'rear', [[-tw * 0.62, 0.95 * M], [tw * 0.62, 0.95 * M]], 0.02 * M, 0.02 * M, { color: CV_CHROME, finish: 'chrome' });
            for (const side of [-1, 1])
              k.strip(sets.trim, 'side', [[-0.47 * l, 0.62 * M], [0.47 * l, 0.62 * M]], 0.02 * M, 0.015 * M, { color: CV_CHROME, finish: 'chrome' }, side);
            exhaustTips(k, [-0.55, 0.55], 0.3, 0.04);
            plateLight(k, 0.68);
          },
        }),
        /* SOVEREIGN STRETCH: a stretched Town Car: upright chrome grille, a long
           run of dark glass split by black pillars, chrome waist and bumpers. */
        limousine: civBody('limousine', {
          yb: 0.2,
          h: 1.0,
          arches: 0.004,
          archSpan: 0.05,
          section: SEC_BOXY,
          profile: [
            [-0.5, 0.82, 0.88, 0.36], [-0.495, 0.92, 0.95, 0.26], [-0.485, 0.97, 0.99, 0.2], [-0.46, 0.99, 1.0], [-0.3, 1.0, 1.0], [0.3, 1.0, 1.0],
            [0.38, 1.0, 0.98], [0.45, 0.99, 0.95], [0.48, 0.96, 0.9, 0.2], [0.493, 0.9, 0.84, 0.24], [0.5, 0.82, 0.76, 0.3],
          ],
          glass: { base: 0.98, roof: 1.47, xf: 0.3, xb: -0.4, rf: 0.24, rb: -0.36, wb: 0.415, wt: 0.35, bow: 0.012, bulge: 0.04, arch: 0.04, frame: 'chrome', pillars: [[0.9, 0.08, 'black'], [0.72, 0.06, 'black'], [0.5, 0.06, 'black'], [0.28, 0.06, 'black'], [0.1, 0.06, 'black'], [0, 0.14, 'paint']] },
          wheel: { r: 0.35, width: 0.235, xf: 0.4, xr: -0.36 },
          rim: { style: 'mesh', spokes: 12, color: '#e3e7ea', frac: 0.68, finish: 'chrome' },
          doors: [[0.3, 0.2], [0.2, 0.08], [-0.12, -0.24]],
          handles: [0.24, 0.12, -0.18],
          handleStyle: 'chrome',
          sill: '#9aa0a6',
          bumpers: [{ y: 0.35, h: 0.1, span: 0.86, material: 'chrome', d: 0.08 }, { y: 0.36, h: 0.1, span: 0.86, material: 'chrome', d: 0.08 }],
          plateRear: 0.62,
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.497 * l, 0.66 * M).half;
            k.grille('front', -hw * 0.4, hw * 0.4, 0.5 * M, 0.74 * M, { cell: 'bars', color: '#dfe3e6', finish: 'chrome', frame: CV_CHROME, frameWidth: 0.04 * M, tile: 0.035 * M, lift: 0.02 * M });
            badge(k, 'front', 0, 0.77, 0.04);
            for (const side of [-1, 1]) {
              lampPatch(k, k.head(side), 'front', side * hw * 0.44, side * hw * 0.97, () => [0.6 * M, 0.74 * M], '#b9c0c7');
              projector(k, k.head(side), 'front', side * hw * 0.6, 0.67 * M, 0.04, side);
              projector(k, k.head(side), 'front', side * hw * 0.82, 0.67 * M, 0.04, side);
              k.halo('head', side, k.surf('front', side * hw * 0.7, 0.67 * M, 0.05 * M), 1);
              const tw = at(-0.497 * l, 0.82 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.3, side * tw * 0.99, () => [0.74 * M, 0.9 * M], '#8e1016');
              k.halo('tail', side, k.surf('rear', side * tw * 0.75, 0.82 * M, 0.05 * M), 1);
              k.strip(sets.trim, 'side', [[-0.48 * l, 0.6 * M], [0.48 * l, 0.6 * M]], 0.025 * M, 0.015 * M, { color: CV_CHROME, finish: 'chrome' }, side);
            }
            exhaustTips(k, [-0.6, 0.6], 0.3, 0.035);
            plateLight(k, 0.62);
            roofFin(k, 0.1);
          },
        }),
        /* RANGER 4X4: a full-size luxury SUV after the Range Rover: a clamshell
           bonnet, slim lamps either side of a mesh grille, the floating black roof
           over blacked-out pillars, side vents, a flat tailgate with slim lamps. */
        suv: civBody('suv', {
          yb: 0.26,
          h: 1.16,
          arches: 0.01,
          section: SEC_TALL,
          profile: [
            [-0.5, 0.86, 1.12, 0.42], [-0.494, 0.95, 1.16, 0.32], [-0.48, 0.99, 1.17, 0.27], [-0.4, 1.0, 1.17], [-0.2, 1.0, 1.16], [0.2, 1.0, 1.14],
            [0.3, 1.0, 1.12], [0.42, 0.99, 1.09], [0.475, 0.965, 1.05, 0.28], [0.49, 0.93, 1.0, 0.32], [0.5, 0.86, 0.92, 0.38],
          ],
          glass: { base: 1.15, roof: 1.87, xf: 0.22, xb: -0.48, rf: 0.06, rb: -0.46, wb: 0.43, wt: 0.37, bow: 0.012, bulge: 0.04, arch: 0.03, frame: 'gloss', pillars: [[0.53, 0.08, 'black'], [0.2, 0.09, 'black'], [0, 0.12, 'black']], aPillar: 'black' },
          wheel: { r: 0.41, width: 0.265, xf: 0.3, xr: -0.29, caliper: '#2e3136' },
          rim: { style: 'split', spokes: 5, color: '#8d939a', frac: 0.7 },
          roofColor: '#0d0e10',
          roofSwatch: 'roof',
          mirrorSwatch: 'roof',
          hatch: true,
          flares: null,
          doors: [[0.22, -0.02], [-0.02, -0.23]],
          handles: [0.06, -0.16],
          handleStyle: 'flush',
          sill: '#16181b',
          sillHeight: 0.14,
          lowerColor: '#1b1d20',
          bumpers: [{ y: 0.42, h: 0.1, span: 0.8, material: 'black' }, { y: 0.44, h: 0.1, span: 0.82, material: 'black' }],
          plateRear: 0.8,
          plateFront: 0.5,
          livery(g, f, L) {
            // Dark lower cladding round the sills.
            L.band(g, f, -0.52 * L.l, 0.52 * L.l, 0, 0.42 * L.M, 'rgba(22,24,27,0.94)');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.497 * l, 0.9 * M).half;
            k.grille('front', -hw * 0.46, hw * 0.46, 0.7 * M, 0.95 * M, { cell: 'mesh', color: '#2a2c30', frame: '#3d4146', frameFinish: 'satin', tile: 0.08 * M });
            k.grille('front', -hw * 0.55, hw * 0.55, 0.46 * M, 0.62 * M, { cell: 'mesh', color: '#2a2c30', tile: 0.08 * M });
            for (const side of [-1, 1]) {
              const { hw: lw } = cornerLamp(k, 1, side, { zIn: 0.5, zOut: 0.99, yIn: [0.86, 0.95], yOut: [0.88, 0.98], wrap: 0.22, wrapTip: 0.6 });
              ledLine(k, sets.drl, 'front', [[side * lw * 0.52, 0.87 * M], [side * lw * 0.98, 0.9 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * lw * 0.62, 0.925 * M, 0.03, side);
              projector(k, k.head(side), 'front', side * lw * 0.76, 0.93 * M, 0.03, side);
              projector(k, k.head(side), 'front', side * lw * 0.9, 0.935 * M, 0.03, side);
              k.halo('head', side, k.surf('front', side * lw * 0.75, 0.92 * M, 0.05 * M), 1.1);
              // Slim vertical-ish tail lamps wrapping onto the flanks.
              const tail = cornerLamp(k, -1, side, { zIn: 0.72, zOut: 0.995, yIn: [0.92, 1.1], yOut: [0.9, 1.12], wrap: 0.18, wrapTip: 0.7 });
              ledLine(k, k.tail(side), 'rear', [[side * tail.hw * 0.74, 1.0 * M], [side * tail.hw * 0.98, 1.0 * M]], CV_TAIL_BAR, 0.02);
              k.halo('tail', side, k.surf('rear', side * tail.hw * 0.85, 1.0 * M, 0.05 * M), 1.1);
              // The side vent on the front door.
              k.patch(sets.trim, 'side', 0.16 * l, 0.23 * l, 0.72 * M, 0.8 * M, { side, cell: 'slats', color: '#2a2c30', finish: 'gloss', tile: 0.06 * M });
            }
            // A dark band across the tailgate between the lamps, badge lettering.
            const tw = at(-0.497 * l, 1.0 * M).half;
            k.patch(sets.trim, 'rear', -tw * 0.72, tw * 0.72, 0.96 * M, 1.04 * M, { color: '#101113', finish: 'gloss', cols: 6, rows: 1, lift: 0.014 * M });
            k.patch(sets.trim, 'rear', -tw * 0.7, tw * 0.7, 0.3 * M, 0.42 * M, { color: '#9aa0a6', finish: 'satin', cols: 6, rows: 1, lift: 0.02 * M });
            exhaustTips(k, [-0.55, 0.55], 0.38, 0.04, '#b9bec3');
            plateLight(k, 0.8);
            roofFin(k, 0.1);
          },
        }),
        /* MULE VAN: a high-roof panel van (Transit / Sprinter): a short nose, a
           tall raked screen, slab sides with a sliding-door track, twin rear doors
           with small windows, plastic bumpers and steel wheels. */
        van: civBody('van', {
          yb: 0.24,
          h: 1.12,
          uvTop: 2.3,
          section: SEC_TALL,
          profile: [
            [-0.5, 0.95, 1.1, 0.34], [-0.496, 0.99, 1.12, 0.26], [0.26, 1.0, 1.12], [0.3, 0.99, 1.1], [0.38, 0.97, 1.02], [0.45, 0.94, 0.94], [0.48, 0.9, 0.88, 0.26], [0.495, 0.84, 0.8, 0.3], [0.5, 0.78, 0.72, 0.36],
          ],
          glass: { base: 1.1, roof: 2.5, xf: 0.3, xb: -0.498, rf: 0.16, rb: -0.494, wb: 0.47, wt: 0.455, bow: 0.004, bulge: 0.03, arch: 0.03, sideFrom: 0.83, frame: 'gloss', pillars: [[0.83, 0.06, 'black']], aPillar: 'black', buttress: 'paint' },
          wheel: { r: 0.37, width: 0.225, xf: 0.35, xr: -0.24 },
          rim: { style: 'steel', color: '#2e3136', capColor: '#1b1d20', frac: 0.64 },
          hatch: true,
          doors: [[0.3, 0.16], [0.08, -0.12]],
          handles: [0.2, 0.0],
          sill: '#1b1d20',
          sillHeight: 0.12,
          bumpers: [{ y: 0.4, h: 0.16, span: 0.9, material: 'black', d: 0.1 }, { y: 0.42, h: 0.14, span: 0.9, material: 'black', d: 0.1 }],
          plateRear: 0.62,
          plateFront: 0.44,
          livery(g, f, L) {
            const { l, M } = L;
            // The sliding door's rail and seams, the rear doors' centre seam.
            L.band(g, f, -0.2 * l, 0.1 * l, 2.02 * M, 2.03 * M, 'rgba(10,10,11,0.6)');
            L.band(g, f, -0.12 * l, 0.1 * l, 0.52 * M, 0.53 * M, 'rgba(10,10,11,0.5)');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.497 * l, 0.8 * M).half,
              g = k.g;
            k.grille('front', -hw * 0.6, hw * 0.6, 0.6 * M, 0.82 * M, { cell: 'bars', color: '#2a2c30', frame: CV_GLOSS, frameFinish: 'plastic', tile: 0.06 * M });
            badge(k, 'front', 0, 0.72, 0.05, '#c9ced3');
            for (const side of [-1, 1]) {
              const { hw: lw } = cornerLamp(k, 1, side, { zIn: 0.62, zOut: 0.99, yIn: [0.72, 0.86], yOut: [0.74, 0.95], wrap: 0.26, wrapTip: 0.5, wrapRise: 0.03 });
              projector(k, k.head(side), 'front', side * lw * 0.8, 0.82 * M, 0.04, side);
              ledLine(k, sets.drl, 'front', [[side * lw * 0.64, 0.745 * M], [side * lw * 0.96, 0.78 * M]], CV_LED, 0.014);
              k.halo('head', side, k.surf('front', side * lw * 0.8, 0.82 * M, 0.05 * M), 1.1);
              // Tall tail lamps up the rear pillars.
              const tw = at(-0.498 * l, 1.0 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.86, side * tw * 0.995, () => [0.6 * M, 1.08 * M], '#8e1016');
              k.patch(k.tail(side), 'rear', side * tw * 0.88, side * tw * 0.98, 0.8 * M, 0.9 * M, { color: CV_REVERSE, finish: 'lens', cols: 1, rows: 1, lift: 0.02 * M });
              k.halo('tail', side, k.surf('rear', side * tw * 0.92, 0.95 * M, 0.05 * M), 1);
              // Sliding-door track on the right, plastic rubbing strip down both sides.
              k.patch(sets.trim, 'side', -0.46 * l, 0.28 * l, 0.5 * M, 0.58 * M, { side, color: '#1b1d20', finish: 'plastic', cols: 8, rows: 1, lift: 0.01 * M });
            }
            // Rear doors: paint over the lower glass and round the two small windows.
            const rear = (s, t) => {
              const p = glassPoint(g, l, k.w, 'rear', s, t);
              return [p[0] - 0.012 * M, p[1], p[2]];
            };
            const panel = (s0, s1, t0, t1) => {
              const geo = gridGeometry(2, 2, (u, v) => rear(lerpNumber(s0, s1, u), lerpNumber(t0, t1, v)), (p, out) => out.set(p.x + 3, p.y, p.z));
              civAddMatrix(sets.paint, geo, civIdentity, k.sw('paint'));
              geo.dispose();
            };
            panel(-1, 1, 0, 0.5);
            panel(-1, 1, 0.82, 1);
            panel(-1, -0.86, 0.5, 0.82);
            panel(0.86, 1, 0.5, 0.82);
            panel(-0.08, 0.08, 0.5, 0.82);
            k.bar(sets.trim, rear(0, 0.02), rear(0, 0.5), 0.01 * M, 0.012 * M, 0.004 * M, { color: '#0c0d0f', finish: 'gloss' });
            // A third brake light over the doors, roof rails.
            k.bar(sets.drl, rear(-0.25, 0.97), rear(0.25, 0.97), 0.03 * M, 0.02 * M, 0.01 * M, { color: '#ff3a2e' });
            k.patch(sets.trim, 'rear', -0.9 * M, 0.9 * M, 0.3 * M, 0.34 * M, { cell: 'tread', color: '#2a2c2f', finish: 'rubber', tile: 0.3 * M, lift: 0.08 * M });
            plateLight(k, 0.62);
          },
        }),
        /* WORKHORSE: a crew-cab full-size pickup after the F-150: a tall flat bonnet,
           a chrome bar grille between C-clamp lamps, four doors, an open bed with
           its liner, tie-down rails and a tailgate, black flares. */
        pickup: civBody('pickup', {
          yb: 0.34,
          h: 1.28,
          arches: 0.012,
          section: SEC_TALL,
          profile: [
            [-0.5, 0.97, 1.26, 0.52], [-0.495, 0.99, 1.27, 0.4], [-0.49, 1.0, 0.96], [-0.12, 1.0, 0.96], [-0.108, 1.0, 1.28], [0.2, 1.0, 1.28],
            [0.3, 1.0, 1.27], [0.42, 0.99, 1.25], [0.47, 0.975, 1.22, 0.34], [0.49, 0.95, 1.16, 0.38], [0.5, 0.9, 1.06, 0.44],
          ],
          glass: { base: 1.27, roof: 1.95, xf: 0.25, xb: -0.103, rf: 0.1, rb: -0.1, wb: 0.43, wt: 0.37, bow: 0.012, bulge: 0.04, arch: 0.03, frame: 'gloss', pillars: [[0.5, 0.08, 'black'], [0, 0.1, 'paint']] },
          wheel: { r: 0.42, width: 0.27, xf: 0.34, xr: -0.29, caliper: '#2e3136' },
          rim: { style: 'offroad', spokes: 6, color: '#8d939a', frac: 0.66 },
          flares: '#16181b',
          hatch: true,
          doors: [[0.25, 0.08], [0.08, -0.1]],
          handles: [0.13, -0.03],
          handleStyle: 'chrome',
          fuel: [-0.2, 1.1],
          bumpers: [{ y: 0.5, h: 0.2, span: 0.92, material: 'chrome', d: 0.12 }, { y: 0.52, h: 0.18, span: 0.95, material: 'chrome', d: 0.12 }],
          plateRear: 0.62,
          plateFront: 0.56,
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.497 * l, 1.0 * M).half;
            // The chrome bar grille filling the nose, the C-clamp lamps at its ends.
            k.grille('front', -hw * 0.66, hw * 0.66, 0.74 * M, 1.12 * M, { cell: 'bars', color: '#c9ced3', finish: 'chrome', frame: CV_CHROME, frameWidth: 0.05 * M, tile: 0.08 * M, lift: 0.02 * M });
            k.strip(sets.trim, 'front', [[-hw * 0.64, 0.93 * M], [hw * 0.64, 0.93 * M]], 0.03 * M, 0.05 * M, { color: CV_CHROME, finish: 'chrome', lift: 0.05 * M });
            badge(k, 'front', 0, 0.93, 0.08, '#1c2a55');
            for (const side of [-1, 1]) {
              lampPatch(k, k.head(side), 'front', side * hw * 0.68, side * hw * 0.99, () => [0.86 * M, 1.12 * M], '#a8b0b8');
              k.strip(sets.drl, 'front', [[side * hw * 0.7, 1.11 * M], [side * hw * 0.97, 1.11 * M], [side * hw * 0.97, 0.87 * M], [side * hw * 0.7, 0.87 * M]], 0.022 * M, 0.02 * M, { color: CV_LED, lift: 0.03 * M });
              projector(k, k.head(side), 'front', side * hw * 0.84, 1.0 * M, 0.05, side);
              k.halo('head', side, k.surf('front', side * hw * 0.84, 1.0 * M, 0.05 * M), 1.2);
              // Tall tail lamps on the bed's corners (lenses on the wall ends: the bed
              // floor is below them, so there is no surface for a projected lens).
              const tw = at(-0.3 * l, 1.2 * M).half - 0.07 * M;
              k.add(k.tail(side), S.box, -0.5 * l - 0.01 * M, 1.02 * M, side * tw, 0.04 * M, 0.42 * M, 0.12 * M, { color: '#a8121a', finish: 'lens' });
              k.add(k.tail(side), S.box, -0.5 * l - 0.02 * M, 0.94 * M, side * tw, 0.03 * M, 0.08 * M, 0.1 * M, { color: CV_REVERSE, finish: 'lens' });
              k.halo('tail', side, [-0.5 * l - 0.3 * M, 1.05 * M, side * tw], 1.1);
              // The bed side walls and their caps, the running boards.
              const z = side * (at(-0.3 * l, 1.2 * M).half - 0.04 * M);
              k.bar(sets.paint, [-0.495 * l, 1.12 * M, z], [-0.118 * l, 1.12 * M, z], 0.33 * M, 0.08 * M, 0.02 * M, k.sw('paint'));
              k.bar(sets.trim, [-0.495 * l, 1.3 * M, z], [-0.118 * l, 1.3 * M, z], 0.03 * M, 0.1 * M, 0.012 * M, { color: '#16181b', finish: 'plastic' });
              k.patch(sets.trim, 'side', -0.18 * l, 0.22 * l, 0.36 * M, 0.42 * M, { side, cell: 'tread', color: '#2a2c2f', finish: 'rubber', tile: 0.25 * M, lift: 0.07 * M });
            }
            // The bed liner and the tailgate.
            const bz = at(-0.3 * l, 1.2 * M).half - 0.08 * M;
            k.patch(sets.trim, 'top', -0.49 * l, -0.12 * l, -bz, bz, { cell: 'slats', color: '#1b1c1e', finish: 'rubber', tile: 0.25 * M, lift: 0.01 * M });
            k.bar(sets.paint, [-0.497 * l, 1.12 * M, -bz], [-0.497 * l, 1.12 * M, bz], 0.33 * M, 0.06 * M, 0.02 * M, k.sw('paint'));
            k.bar(sets.trim, [-0.497 * l, 1.3 * M, -bz], [-0.497 * l, 1.3 * M, bz], 0.03 * M, 0.08 * M, 0.01 * M, { color: '#16181b', finish: 'plastic' });
            badge(k, 'rear', 0, 1.1, 0.07, '#1c2a55');
            k.bar(sets.drl, [-0.1 * l, 1.99 * M, -0.3 * M], [-0.1 * l, 1.99 * M, 0.3 * M], 0.03 * M, 0.03 * M, 0.01 * M, { color: '#ff3a2e' });
            exhaustTips(k, [0.7], 0.42, 0.045, '#b9bec3');
            plateLight(k, 0.62);
          },
        }),
        /* CHEVETTE Z06: a mid-engined flat-plane V8 supercar after the C8 Z06:
           a short sharp nose with angular lamps, the cab pushed forward, huge
           intakes in the flanks, a glass engine cover showing the V8, stacked
           angular tail lamps, four pipes in the middle and a tall wing. */
        chevette: civBody('chevette', {
          yb: 0.11,
          h: 0.9,
          arches: 0.035,
          archSpan: 0.1,
          section: SEC_WEDGE,
          sections: [[-0.5, SEC_FENDER], [-0.2, SEC_FENDER], [-0.09, SEC_WEDGE], [0.1, SEC_WEDGE], [0.2, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.84, 0.86, 0.3], [-0.49, 0.93, 0.92, 0.2], [-0.47, 0.98, 0.95, 0.12], [-0.4, 1.02, 0.96], [-0.3, 1.04, 0.95], [-0.2, 1.0, 0.94],
            [-0.05, 0.96, 0.9], [0.08, 0.97, 0.86], [0.2, 0.99, 0.79], [0.3, 1.0, 0.74], [0.4, 0.98, 0.66], [0.46, 0.93, 0.56, 0.12], [0.49, 0.84, 0.47, 0.16], [0.5, 0.74, 0.38, 0.22],
          ],
          glass: { base: 0.88, roof: 1.22, xf: 0.13, xb: -0.42, rf: -0.06, rb: -0.17, wb: 0.39, wt: 0.3, bow: 0.022, bulge: 0.06, arch: 0.05, frame: 'gloss', sideFrom: 0.42, pillars: [[0.42, 0.06, 'black']], aPillar: 'black', buttress: 'paint' },
          wheel: { r: 0.345, rr: 0.365, width: 0.27, wr: 0.345, xf: 0.3, xr: -0.29, caliper: '#e3b62b' },
          rim: { style: 'spider', spokes: 10, color: '#1b1c1f', frac: 0.78, centreLock: false, lipColor: '#3a3d42' },
          hatch: true,
          doors: [[0.12, -0.08]],
          handles: [],
          plateFront: 0.3,
          frontPlate: false,
          plateRear: 0.42,
          bumpers: [{ y: 0.14, h: 0.04, span: 0.9, material: 'black', d: 0.1 }, { y: 0.18, h: 0.06, span: 0.9, material: 'black' }],
          livery(g, f, L) {
            // Twin stripes, thin, offset to the driver's side as the Z06's.
            L.stripe(-0.52 * L.l, 0.52 * L.l, -0.3, -0.18, 'rgba(12,13,15,0.92)');
            L.stripe(-0.52 * L.l, 0.52 * L.l, -0.14, -0.1, 'rgba(12,13,15,0.92)');
            // Carbon lower sills.
            L.band(g, f, -0.3 * L.l, 0.25 * L.l, 0, 0.22 * L.M, 'rgba(20,21,23,0.96)');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // Angular lamps: a sharp blade rising into the wing with an LED brow.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.48, zOut: 0.995, yIn: [0.4, 0.46], yOut: [0.47, 0.56], wrap: 0.42, wrapTip: 0.15, wrapRise: 0.07 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.5, 0.458 * M], [side * hw * 0.7, 0.49 * M], [side * hw * 0.99, 0.56 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.64, 0.44 * M, 0.025, side);
              projector(k, k.head(side), 'front', side * hw * 0.78, 0.47 * M, 0.025, side);
              k.halo('head', side, k.surf('front', side * hw * 0.72, 0.46 * M, 0.05 * M), 1);
              // The flank intake ahead of the rear wheel, the brake duct in the nose.
              k.patch(sets.trim, 'side', -0.2 * l, -0.05 * l, 0.36 * M, 0.78 * M, { side, cell: 'honeycomb', color: '#1a1b1d', finish: 'gloss', tile: 0.1 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.2 * l) / (0.15 * l); return [(0.36 + 0.06 * f) * M, (0.66 + 0.12 * f) * M]; } });
              k.patch(sets.trim, 'front', side * hw * 0.55, side * hw * 0.92, 0.18 * M, 0.34 * M, { cell: 'honeycomb', color: '#1a1b1d', finish: 'gloss', tile: 0.08 * M });
              // Stacked angular tail lamps.
              const tw = at(-0.495 * l, 0.8 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.42, side * tw * 0.99, (z) => { const f = (Math.abs(z) / tw - 0.42) / 0.57; return [(0.74 + f * 0.05) * M, (0.82 + f * 0.06) * M]; }, '#2a0508');
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.44, 0.76 * M], [side * tw * 0.97, 0.815 * M]], CV_TAIL_BAR, 0.014);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.5, 0.8 * M], [side * tw * 0.97, 0.86 * M]], CV_TAIL_BAR, 0.012);
              k.halo('tail', side, k.surf('rear', side * tw * 0.72, 0.8 * M, 0.05 * M), 1);
              // Wing stands.
              k.bar(sets.trim, [-0.46 * l, k.top(-0.46 * l), side * 0.55 * M], [-0.49 * l, k.top(-0.46 * l) + 0.26 * M, side * 0.55 * M], 0.03 * M, 0.2 * M, 0.012 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' });
            }
            // Front splitter and grille, the quad pipes in a square in the middle.
            const gw = at(0.495 * l, 0.25 * M).half;
            k.grille('front', -gw * 0.5, gw * 0.5, 0.16 * M, 0.3 * M, { cell: 'honeycomb', color: '#1f2023', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.08 * M });
            badge(k, 'front', 0, 0.36, 0.035, '#c9ced3');
            k.patch(sets.trim, 'rear', -0.2 * M, 0.2 * M, 0.2 * M, 0.44 * M, { color: '#0c0c0d', finish: 'gloss', cols: 2, rows: 2, lift: 0.012 * M });
            exhaustTips(k, [-0.1, 0.1], 0.26, 0.045, '#3a3d42');
            exhaustTips(k, [-0.1, 0.1], 0.38, 0.045, '#3a3d42');
            k.patch(sets.trim, 'rear', -0.8 * M, -0.24 * M, 0.14 * M, 0.3 * M, { cell: 'honeycomb', color: '#141517', finish: 'gloss', tile: 0.08 * M, lift: 0.01 * M });
            k.patch(sets.trim, 'rear', 0.24 * M, 0.8 * M, 0.14 * M, 0.3 * M, { cell: 'honeycomb', color: '#141517', finish: 'gloss', tile: 0.08 * M, lift: 0.01 * M });
            // The V8 under the engine glass: the plenum and its red covers.
            const ex = -0.3 * l,
              ey = 0.82 * M;
            k.bar(sets.trim, [ex - 0.3 * M, ey, 0], [ex + 0.25 * M, ey, 0], 0.08 * M, 0.5 * M, 0.03 * M, { color: '#1c1d1f', finish: 'satin' });
            for (const side of [-1, 1]) k.bar(sets.trim, [ex - 0.28 * M, ey + 0.06 * M, side * 0.18 * M], [ex + 0.22 * M, ey + 0.06 * M, side * 0.18 * M], 0.04 * M, 0.1 * M, 0.02 * M, { color: '#b3121b', finish: 'gloss' });
            // The wing.
            const wy = k.top(-0.46 * l) + 0.27 * M;
            k.bar(sets.trim, [-0.492 * l, wy, -0.78 * M], [-0.492 * l, wy, 0.78 * M], 0.035 * M, 0.3 * M, 0.015 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' }, [0.2, 1, 0]);
            for (const side of [-1, 1]) k.add(sets.trim, S.box, -0.492 * l, wy - 0.03 * M, side * 0.79 * M, 0.34 * M, 0.12 * M, 0.02 * M, { color: '#111214', finish: 'carbon' });
            k.add(sets.drl, S.box, -0.5 * l + 0.04 * M, wy - 0.01 * M, 0, 0.02 * M, 0.015 * M, 0.5 * M, { color: '#ff3a2e' });
            plateLight(k, 0.42);
          },
        }),
        /* BRUTINI SVJ: a V12 wedge hypercar after the Aventador SVJ: one line from
           the nose to the roof, scissor-door cut lines, Y lamps and hexagons
           everywhere, huge flank intakes, a louvred engine cover, the big wing,
           twin hexagon pipes high in the tail. */
        brutini: civBody('brutini', {
          yb: 0.1,
          h: 0.84,
          arches: 0.03,
          archSpan: 0.1,
          section: SEC_BRUTINI,
          sections: [[-0.5, SEC_FENDER], [-0.2, SEC_FENDER], [-0.1, SEC_BRUTINI], [0.12, SEC_BRUTINI], [0.22, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.86, 0.9, 0.28], [-0.49, 0.94, 0.95, 0.18], [-0.47, 0.99, 0.97, 0.11], [-0.4, 1.03, 0.97], [-0.3, 1.04, 0.95], [-0.22, 1.0, 0.92],
            [-0.08, 0.95, 0.86], [0.08, 0.97, 0.8], [0.2, 0.99, 0.73], [0.3, 1.0, 0.68], [0.4, 0.97, 0.6], [0.46, 0.9, 0.49, 0.1], [0.485, 0.78, 0.4, 0.12], [0.5, 0.56, 0.31, 0.17],
          ],
          glass: { base: 0.82, roof: 1.13, xf: 0.2, xb: -0.44, rf: -0.1, rb: -0.19, wb: 0.39, wt: 0.27, bow: 0.02, bulge: 0.04, arch: 0.03, frame: 'gloss', sideFrom: 0.45, pillars: [[0.45, 0.05, 'black']], aPillar: 'black', buttress: 'paint' },
          wheel: { r: 0.355, rr: 0.375, width: 0.29, wr: 0.36, xf: 0.3, xr: -0.285, caliper: '#e3b62b' },
          rim: { style: 'y', spokes: 5, color: '#262729', frac: 0.78, centreLock: true, twist: 0.2 },
          hatch: true,
          doors: [[0.19, -0.1]],
          handles: [],
          frontPlate: false,
          plateRear: 0.5,
          bumpers: [{ y: 0.13, h: 0.04, span: 0.92, material: 'black', d: 0.12 }, { y: 0.16, h: 0.06, span: 0.9, material: 'black' }],
          livery(g, f, L) {
            const { l, M } = L;
            // Carbon sills and a thin tricolour on the lower sill ahead of the rear wheels.
            L.band(g, f, -0.28 * l, 0.26 * l, 0, 0.24 * M, 'rgba(20,21,23,0.97)');
            L.band(g, f, -0.2 * l, -0.14 * l, 0.25 * M, 0.265 * M, '#1f8a3c');
            L.band(g, f, -0.14 * l, -0.08 * l, 0.25 * M, 0.265 * M, '#f0f0ec');
            L.band(g, f, -0.08 * l, -0.02 * l, 0.25 * M, 0.265 * M, '#c8141c');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // Hexagon-cut lamps with the Y of LEDs.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.56, zOut: 0.995, yIn: [0.33, 0.38], yOut: [0.38, 0.47], wrap: 0.34, wrapTip: 0.15, wrapRise: 0.06 });
              const y0 = 0.375 * M;
              ledLine(k, sets.drl, 'front', [[side * hw * 0.58, y0], [side * hw * 0.74, 0.4 * M]], CV_LED, 0.014);
              ledLine(k, sets.drl, 'front', [[side * hw * 0.74, 0.4 * M], [side * hw * 0.92, 0.44 * M]], CV_LED, 0.014);
              ledLine(k, sets.drl, 'front', [[side * hw * 0.74, 0.4 * M], [side * hw * 0.86, 0.355 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.8, 0.41 * M, 0.024, side);
              k.halo('head', side, k.surf('front', side * hw * 0.76, 0.4 * M, 0.05 * M), 1);
              // Y-shaped intakes in the nose, the huge flank intakes, the scissor-door cut.
              k.patch(sets.trim, 'front', side * hw * 0.38, side * hw * 0.96, 0.14 * M, 0.3 * M, { cell: 'hex', color: '#141517', finish: 'gloss', tile: 0.1 * M });
              k.patch(sets.trim, 'side', -0.24 * l, -0.06 * l, 0.3 * M, 0.74 * M, { side, cell: 'hex', color: '#141517', finish: 'gloss', tile: 0.12 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.24 * l) / (0.18 * l); return [(0.3 + 0.1 * f) * M, (0.5 + 0.24 * f) * M]; } });
              k.patch(sets.trim, 'top', -0.2 * l, -0.07 * l, side * 0.58 * M, side * 0.8 * M, { cell: 'hex', color: '#141517', finish: 'gloss', tile: 0.1 * M, lift: 0.01 * M });
              // Y tail lamps floating in the black tail.
              const tw = at(-0.495 * l, 0.78 * M).half;
              k.patch(sets.trim, 'rear', side * tw * 0.3, side * tw * 0.99, 0.56 * M, 0.88 * M, { cell: 'hex', color: '#101113', finish: 'gloss', tile: 0.1 * M, lift: 0.006 * M });
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.5, 0.74 * M], [side * tw * 0.7, 0.76 * M]], CV_TAIL_BAR, 0.022);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.7, 0.76 * M], [side * tw * 0.95, 0.84 * M]], CV_TAIL_BAR, 0.022);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.7, 0.76 * M], [side * tw * 0.92, 0.68 * M]], CV_TAIL_BAR, 0.022);
              k.halo('tail', side, k.surf('rear', side * tw * 0.72, 0.76 * M, 0.05 * M), 1.1);
              // The wing's pillars.
              k.bar(sets.trim, [-0.44 * l, k.top(-0.44 * l), side * 0.4 * M], [-0.48 * l, k.top(-0.44 * l) + 0.3 * M, side * 0.4 * M], 0.04 * M, 0.2 * M, 0.015 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' });
            }
            // A carbon splitter, the hexagon pipes high in the middle, the diffuser.
            k.patch(sets.trim, 'front', -0.8 * M, 0.8 * M, 0.1 * M, 0.15 * M, { cell: 'carbon', color: '#2a2b2e', finish: 'carbon', tile: 0.1 * M, lift: 0.03 * M });
            badge(k, 'front', 0, 0.34, 0.035, '#d9b14a');
            exhaustTips(k, [-0.08, 0.08], 0.62, 0.06, '#3a3d42', 'hex');
            k.patch(sets.trim, 'rear', -0.85 * M, 0.85 * M, 0.12 * M, 0.34 * M, { cell: 'carbon', color: '#2a2b2e', finish: 'carbon', tile: 0.1 * M, lift: 0.012 * M });
            // The louvred engine cover: hexagon glass over the V12.
            k.patch(sets.trim, 'top', -0.42 * l, -0.24 * l, -0.34 * M, 0.34 * M, { cell: 'hex', color: '#2a2c30', finish: 'gloss', tile: 0.12 * M, lift: 0.02 * M });
            const wy = k.top(-0.44 * l) + 0.31 * M;
            k.bar(sets.trim, [-0.485 * l, wy, -0.86 * M], [-0.485 * l, wy, 0.86 * M], 0.04 * M, 0.34 * M, 0.018 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' }, [0.25, 1, 0]);
            for (const side of [-1, 1]) k.add(sets.trim, S.box, -0.485 * l, wy - 0.03 * M, side * 0.87 * M, 0.38 * M, 0.14 * M, 0.02 * M, { color: '#111214', finish: 'carbon' });
            plateLight(k, 0.5);
          },
        }),
        /* CAVALINO 458: a flowing mid-engined berlinetta after the 458 Italia: the
           single mouth with its winglets, lamps sweeping far up the wings, small
           flank gills, twin round tail lamps a side, a louvred engine cover and
           three pipes stacked in the middle of the diffuser. */
        cavalino: civBody('cavalino', {
          yb: 0.11,
          h: 0.88,
          arches: 0.045,
          archSpan: 0.11,
          section: SEC_SPORT,
          sections: [[-0.5, SEC_FENDER], [-0.2, SEC_FENDER], [-0.09, SEC_SPORT], [0.1, SEC_SPORT], [0.2, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.82, 0.84, 0.3], [-0.49, 0.92, 0.9, 0.2], [-0.47, 0.98, 0.93, 0.12], [-0.4, 1.02, 0.94], [-0.3, 1.03, 0.93], [-0.2, 0.99, 0.92],
            [-0.05, 0.95, 0.88], [0.08, 0.96, 0.82], [0.2, 0.98, 0.73], [0.3, 0.99, 0.66], [0.4, 0.97, 0.6], [0.46, 0.92, 0.53, 0.12], [0.49, 0.82, 0.45, 0.16], [0.5, 0.7, 0.38, 0.22],
          ],
          glass: { base: 0.86, roof: 1.2, xf: 0.16, xb: -0.4, rf: -0.06, rb: -0.17, wb: 0.39, wt: 0.29, bow: 0.024, bulge: 0.07, arch: 0.05, frame: 'gloss', sideFrom: 0.34, pillars: [[0.34, 0.05, 'black']], aPillar: 'black', buttress: 'paint' },
          wheel: { r: 0.34, rr: 0.35, width: 0.25, wr: 0.3, xf: 0.3, xr: -0.29, caliper: '#e3b62b' },
          rim: { style: 'split', spokes: 5, color: '#c3c8cd', frac: 0.76, centreLock: false },
          hatch: true,
          doors: [[0.16, -0.1]],
          handles: [-0.06],
          handleStyle: 'flush',
          frontPlate: false,
          plateRear: 0.48,
          bumpers: [{ y: 0.14, h: 0.04, span: 0.8, material: 'black', d: 0.08 }, { y: 0.18, h: 0.05, span: 0.86, material: 'black' }],
          livery(g, f, L) {
            // The shield on each front wing: yellow with a black horse-ish mark.
            L.draw(g, f, 0.3 * L.l, 0.62 * L.M, (c, px) => {
              c.fillStyle = '#f2c500';
              c.beginPath();
              c.moveTo(-0.05 * px * L.M, 0.06 * px * L.M);
              c.lineTo(0.05 * px * L.M, 0.06 * px * L.M);
              c.lineTo(0.05 * px * L.M, -0.02 * px * L.M);
              c.quadraticCurveTo(0, -0.08 * px * L.M, -0.05 * px * L.M, -0.02 * px * L.M);
              c.closePath();
              c.fill();
              c.fillStyle = '#111';
              c.fillRect(-0.012 * px * L.M, -0.03 * px * L.M, 0.024 * px * L.M, 0.07 * px * L.M);
              for (const [color, x] of [['#1f8a3c', -0.05], ['#f0f0ec', -0.017], ['#c8141c', 0.017]]) {
                c.fillStyle = color;
                c.fillRect(x * px * L.M, 0.05 * px * L.M, 0.033 * px * L.M, 0.012 * px * L.M);
              }
            });
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // Boomerang lamps sweeping far back up the wings.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.6, zOut: 0.995, yIn: [0.4, 0.46], yOut: [0.48, 0.56], wrap: 0.72, wrapTip: 0.12, wrapRise: 0.12 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.62, 0.46 * M], [side * hw * 0.85, 0.5 * M], [side * hw * 0.99, 0.56 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.78, 0.47 * M, 0.028, side);
              k.halo('head', side, k.surf('front', side * hw * 0.78, 0.47 * M, 0.05 * M), 1);
              // The winglets in the mouth's corners, gills behind the doors.
              k.bar(sets.trim, k.surf('front', side * hw * 0.4, 0.28 * M, 0.04 * M), k.surf('front', side * hw * 0.62, 0.3 * M, 0.04 * M), 0.02 * M, 0.08 * M, 0.008 * M, { color: '#16171a', finish: 'gloss' });
              k.patch(sets.trim, 'side', -0.14 * l, -0.07 * l, 0.5 * M, 0.66 * M, { side, cell: 'slats', color: '#141517', finish: 'gloss', tile: 0.05 * M, lift: 0.004 * M });
              // Twin round tail lamps high on each side.
              const tw = at(-0.495 * l, 0.78 * M).half;
              for (const zf of [0.5, 0.78]) {
                k.round(k.tail(side), S.cylinder24, 'rear', side * tw * zf, 0.76 * M, 0.06 * M, 0.03 * M, { color: '#a8121a', finish: 'lens', lift: 0.02 * M }, side);
                k.round(k.tail(side), S.torus, 'rear', side * tw * zf, 0.76 * M, 0.052 * M, 0.03 * M, { color: CV_TAIL_BAR, lift: 0.035 * M }, side);
              }
              k.halo('tail', side, k.surf('rear', side * tw * 0.64, 0.76 * M, 0.05 * M), 1);
            }
            // The single mouth.
            const gw = at(0.495 * l, 0.25 * M).half;
            k.grille('front', -gw * 0.62, gw * 0.62, 0.16 * M, 0.32 * M, { cell: 'mesh', color: '#1f2023', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.06 * M });
            k.round(sets.trim, S.cylinder24, 'top', 0.45 * l, 0, 0.035 * M, 0.018 * M, { color: '#f2c500', finish: 'gloss' });
            // Three pipes stacked in a triangle in the diffuser.
            k.patch(sets.trim, 'rear', -0.75 * M, 0.75 * M, 0.14 * M, 0.34 * M, { cell: 'mesh', color: '#141517', finish: 'gloss', tile: 0.07 * M, lift: 0.012 * M });
            exhaustTips(k, [-0.12, 0.12], 0.26, 0.05, '#aeb4ba');
            exhaustTips(k, [0], 0.4, 0.05, '#aeb4ba');
            // The engine cover louvres and the integrated lip.
            k.patch(sets.trim, 'top', -0.46 * l, -0.4 * l, -0.4 * M, 0.4 * M, { cell: 'louvre', color: '#1a1b1d', finish: 'gloss', tile: 0.08 * M, lift: 0.012 * M });
            const ex = -0.3 * l;
            k.bar(sets.trim, [ex - 0.3 * M, 0.82 * M, 0], [ex + 0.25 * M, 0.82 * M, 0], 0.08 * M, 0.48 * M, 0.03 * M, { color: '#1c1d1f', finish: 'satin' });
            for (const side of [-1, 1]) k.bar(sets.trim, [ex - 0.28 * M, 0.87 * M, side * 0.17 * M], [ex + 0.22 * M, 0.87 * M, side * 0.17 * M], 0.04 * M, 0.1 * M, 0.02 * M, { color: '#b3121b', finish: 'gloss' });
            const x = -0.485 * l,
              tw = at(x, k.top(x)).half;
            k.bar(sets.paint, [x, k.top(x) + 0.02 * M, -tw * 0.8], [x, k.top(x) + 0.02 * M, tw * 0.8], 0.025 * M, 0.1 * M, 0.012 * M, k.sw('paint'), [0, 1, 0]);
            plateLight(k, 0.48);
          },
        }),
