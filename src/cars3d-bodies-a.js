        // CAR_BODIES part 1: sedan, taxi, coupe, muscle, sport, roadster, rally, hotrod.
        /* REGENT: a mid-size saloon (Camry / Accord): a low nose with a wide black
           mouth, swept lamps with an LED brow, a fastback roof and a light bar
           across the lid. */
        sedan: civBody('sedan', {
          yb: 0.17,
          h: 0.98,
          arches: 0.012,
          section: SEC_SALOON,
          profile: [
            [-0.5, 0.74, 0.8, 0.36], [-0.493, 0.84, 0.9, 0.24], [-0.475, 0.92, 0.96, 0.19], [-0.45, 0.965, 0.99, 0.17], [-0.39, 0.99, 1.0], [-0.3, 1.0, 0.995],
            [-0.2, 1.0, 0.985], [0.1, 1.0, 0.95], [0.2, 1.0, 0.91], [0.3, 0.995, 0.87], [0.38, 0.985, 0.84], [0.44, 0.955, 0.8],
            [0.47, 0.91, 0.76, 0.19], [0.487, 0.85, 0.7, 0.23], [0.5, 0.74, 0.6, 0.3],
          ],
          glass: { base: 0.95, roof: 1.44, xf: 0.2, xb: -0.37, rf: -0.03, rb: -0.24, wb: 0.41, wt: 0.33, bow: 0.02, bulge: 0.05, arch: 0.05, frame: 'chrome', pillars: [[0.47, 0.07, 'black'], [0, 0.16, 'paint']] },
          wheel: { r: 0.335, width: 0.23, xf: 0.3, xr: -0.28, caliper: '#3a3d42' },
          rim: { style: 'split', spokes: 5, color: '#aeb4ba', frac: 0.7 },
          doors: [[0.2, -0.02], [-0.02, -0.22]],
          fuel: [-0.34, 0.86],
          handles: [0.06, -0.15],
          sill: CV_PLASTIC,
          bumpers: [{ y: 0.26, h: 0.08, span: 0.8, material: 'black' }, { y: 0.3, h: 0.08, span: 0.8, material: 'black' }],
          plateRear: 0.62,
          plateFront: 0.4,
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.42, zOut: 0.99, yIn: [0.62, 0.69], yOut: [0.67, 0.76], wrap: 0.34, wrapTip: 0.3, wrapRise: 0.02 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.44, 0.7 * M], [side * hw * 0.7, 0.728 * M], [side * hw * 0.95, 0.765 * M]]);
              projector(k, k.head(side), 'front', side * hw * 0.62, 0.66 * M, 0.035, side);
              projector(k, k.head(side), 'front', side * hw * 0.8, 0.69 * M, 0.035, side);
              k.halo('head', side, k.surf('front', side * hw * 0.72, 0.69 * M, 0.05 * M), 1);
              k.patch(sets.trim, 'front', side * hw * 0.7, side * hw * 0.93, 0.3 * M, 0.42 * M, { color: CV_GLOSS, finish: 'gloss', cols: 4, rows: 1 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.74, 0.335 * M], [side * hw * 0.9, 0.345 * M]], CV_LED, 0.012);
              const tail = cornerLamp(k, -1, side, { zIn: 0.52, zOut: 0.99, yIn: [0.81, 0.89], yOut: [0.8, 0.91], wrap: 0.3, wrapTip: 0.35 });
              const tw = tail.hw;
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.04, 0.878 * M], [side * tw * 0.55, 0.88 * M], [side * tw * 0.8, 0.875 * M], [side * tw * 0.98, 0.865 * M]], CV_TAIL_BAR, 0.016);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.62, 0.83 * M], [side * tw * 0.8, 0.826 * M]], CV_REVERSE, 0.022);
              k.halo('tail', side, k.surf('rear', side * tw * 0.78, 0.86 * M, 0.05 * M), 1);
            }
            exhaustTips(k, [-0.45, 0.45], 0.3, 0.035, CV_CHROME);
            const gw = at(0.49 * k.l, 0.5 * M).half;
            k.grille('front', -gw * 0.64, gw * 0.64, 0.33 * M, 0.58 * M, { cell: 'honeycomb', color: '#3a3d42', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.14 * M });
            k.grille('front', -gw * 0.42, gw * 0.42, 0.62 * M, 0.67 * M, { cell: 'slats', color: '#2a2d31', tile: 0.06 * M });
            badge(k, 'front', 0, 0.6);
            badge(k, 'rear', 0, 0.82);
            const tw = at(-0.48 * k.l, 0.84 * M).half;
            k.strip(sets.trim, 'rear', [[-tw * 0.5, 0.848 * M], [0, 0.85 * M], [tw * 0.5, 0.848 * M]], 0.012 * M, 0.012 * M, { color: CV_CHROME, finish: 'chrome' });
            k.patch(sets.trim, 'rear', -tw * 0.8, tw * 0.8, 0.2 * M, 0.3 * M, { color: CV_PLASTIC, finish: 'plastic', cols: 8, rows: 1, lift: 0.01 * M });
            plateLight(k, 0.62);
            roofFin(k);
          },
        }),
        /* CITY CAB: a body-on-frame full-size cab after the Crown Victoria: upright
           glass, a long trunk, chrome grille and bumpers, taxi yellow with the
           checker band, CITY CAB on the doors and the lit roof sign. */
        taxi: civBody('taxi', {
          yb: 0.2,
          h: 1.0,
          arches: 0.008,
          section: SEC_BOXY,
          profile: [
            [-0.5, 0.8, 0.86, 0.36], [-0.492, 0.9, 0.94, 0.26], [-0.47, 0.96, 0.99, 0.2], [-0.42, 0.99, 1.01], [-0.3, 1.0, 1.01], [-0.22, 1.0, 1.0],
            [0.2, 1.0, 1.0], [0.3, 1.0, 0.97], [0.42, 0.985, 0.93], [0.47, 0.95, 0.88, 0.2], [0.49, 0.89, 0.82, 0.24], [0.5, 0.8, 0.74, 0.3],
          ],
          glass: { base: 0.98, roof: 1.46, xf: 0.21, xb: -0.28, rf: 0.07, rb: -0.19, wb: 0.415, wt: 0.345, bow: 0.012, bulge: 0.04, arch: 0.035, frame: 'chrome', pillars: [[0.5, 0.08, 'black'], [0, 0.14, 'paint']] },
          wheel: { r: 0.34, width: 0.225, xf: 0.3, xr: -0.28 },
          rim: { style: 'steel', color: '#2e3136', capColor: '#dfe3e6', frac: 0.66 },
          finish: { roughness: 0.3, metalness: 0.05 },
          doors: [[0.2, -0.01], [-0.01, -0.2]],
          handles: [0.07, -0.13],
          handleStyle: 'chrome',
          fuel: [-0.3, 0.88],
          bumpers: [{ y: 0.35, h: 0.12, span: 0.86, material: 'chrome', d: 0.1 }, { y: 0.36, h: 0.12, span: 0.86, material: 'chrome', d: 0.1 }],
          plateRear: 0.62,
          livery(g, f, L) {
            const { l, M } = L;
            // The checker band from the front door to the tail, CITY CAB on the front
            // doors, the medallion number on the rear quarter.
            for (let i = 0; i < 44; i++) {
              const x0 = -0.44 * l + (i * 0.8 * l) / 44,
                x1 = x0 + (0.8 * l) / 44;
              for (let row = 0; row < 2; row++) if ((i + row) % 2 === 0) L.band(g, f, x0, x1, (0.73 + row * 0.045) * M, (0.775 + row * 0.045) * M, '#111214');
            }
            L.band(g, f, -0.44 * l, 0.36 * l, 0.724 * M, 0.73 * M, '#111214');
            L.band(g, f, -0.44 * l, 0.36 * l, 0.863 * M, 0.868 * M, '#111214');
            L.text(g, f, 'CITY CAB', 0.09 * l, 0.62 * M, 0.11 * M, '#111214', { stretch: 1.1, spacing: 0.02 * M });
            L.text(g, f, '4T19', -0.34 * l, 0.62 * M, 0.09 * M, '#111214', { stretch: 1.1 });
            L.text(g, f, 'LICENSED · SOUTH COAST TLC', -0.1 * l, 0.62 * M, 0.035 * M, '#111214', { stretch: 1.05 });
          },
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const hw = at(0.49 * k.l, 0.66 * M).half;
              // Square composite lamps with the amber corner, a chrome bar grille between.
              lampPatch(k, k.head(side), 'front', side * hw * 0.5, side * hw * 0.9, () => [0.6 * M, 0.72 * M], '#b7bec5');
              k.patch(k.head(side), 'front', side * hw * 0.9, side * hw * 0.995, 0, 0, { span: () => [0.6 * M, 0.72 * M], color: CV_AMBER, finish: 'lens', cols: 2, rows: 1, lift: 0.016 * M });
              k.patch(k.head(side), 'side', 0.455 * k.l, 0.485 * k.l, 0.6 * M, 0.7 * M, { side, color: CV_AMBER, finish: 'lens', cols: 2, rows: 1 });
              projector(k, k.head(side), 'front', side * hw * 0.62, 0.66 * M, 0.04, side);
              k.halo('head', side, k.surf('front', side * hw * 0.68, 0.66 * M, 0.05 * M), 1);
              const tw = at(-0.49 * k.l, 0.8 * M).half;
              // Tall tail lamps on the corners, a red panel across the lid between them.
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.62, side * tw * 0.99, () => [0.66 * M, 0.9 * M], '#a8121a');
              k.patch(k.tail(side), 'rear', side * tw * 0.66, side * tw * 0.8, 0.7 * M, 0.76 * M, { color: CV_REVERSE, finish: 'lens', cols: 2, rows: 1, lift: 0.02 * M });
              k.halo('tail', side, k.surf('rear', side * tw * 0.8, 0.8 * M, 0.05 * M), 1);
              // Roof-sign mounts.
            }
            const gw = at(0.495 * k.l, 0.66 * M).half;
            k.grille('front', -gw * 0.48, gw * 0.48, 0.6 * M, 0.73 * M, { cell: 'bars', color: '#c9ced3', finish: 'chrome', frame: CV_CHROME, tile: 0.05 * M });
            badge(k, 'front', 0, 0.665, 0.045);
            const tw = at(-0.495 * k.l, 0.8 * M).half;
            k.patch(sets.trim, 'rear', -tw * 0.6, tw * 0.6, 0.78 * M, 0.88 * M, { color: '#6d0b10', finish: 'lens', cols: 6, rows: 1, lift: 0.012 * M });
            exhaustTips(k, [-0.55], 0.28, 0.03, '#9aa0a6');
            // The roof sign: a lit box with TAXI and the number, on two feet.
            const g = k.g,
              x = lerpNumber(g.rb, g.rf, 0.45) * k.l,
              y = g.roof + g.arch + 0.02 * M;
            for (const side of [-1, 1]) k.add(sets.trim, S.box, x, y + 0.03 * M, side * 0.3 * M, 0.5 * M, 0.05 * M, 0.06 * M, { color: '#16181b', finish: 'satin' });
            k.bar(sets.trim, [x - 0.5 * M, y + 0.07 * M, 0], [x + 0.5 * M, y + 0.07 * M, 0], 0.03 * M, 0.34 * M, 0.01 * M, { color: '#16181b', finish: 'satin' });
            k.bar(sets.drl, [x - 0.49 * M, y + 0.22 * M, 0], [x + 0.49 * M, y + 0.22 * M, 0], 0.26 * M, 0.26 * M, 0.04 * M, { color: '#fff1c4' });
            k.bar(sets.trim, [x - 0.5 * M, y + 0.36 * M, 0], [x + 0.5 * M, y + 0.36 * M, 0], 0.03 * M, 0.3 * M, 0.01 * M, { color: '#16181b', finish: 'satin' });
            plateLight(k, 0.62);
          },
          // TAXI and the medallion number on both faces of the roof sign.
          lettering(l, w, M) {
            const g = CAR_BODIES.taxi.glass,
              x = lerpNumber(g.rb, g.rf, 0.45) * l,
              y = g.roof + g.arch + 0.24 * M,
              out = [];
            for (const side of [-1, 1]) {
              out.push(['TAXI', [x - 0.1 * M, y + 0.01 * M, side * 0.135 * M], [side, 0, 0], [0, 1, 0], 0.2 * M, '#16181b']);
              out.push(['4T19', [x + 0.36 * M, y, side * 0.135 * M], [side, 0, 0], [0, 1, 0], 0.1 * M, '#16181b']);
            }
            return out;
          },
        }),
        /* VOLT COUPE: a compact electric fastback (Model 3 / Polestar 2): a smooth
           closed nose, slim lamps, one glass roof sweeping to the lid, flush
           handles, a ducktail lip and aero wheels. */
        coupe: civBody('coupe', {
          yb: 0.15,
          h: 0.96,
          arches: 0.01,
          section: SEC_SPORT,
          profile: [
            [-0.5, 0.76, 0.84, 0.36], [-0.492, 0.86, 0.93, 0.24], [-0.47, 0.94, 0.98, 0.17], [-0.43, 0.98, 1.0, 0.15], [-0.36, 1.0, 0.99], [-0.2, 1.0, 0.96],
            [0.1, 1.0, 0.92], [0.22, 0.995, 0.86], [0.32, 0.99, 0.79], [0.4, 0.975, 0.74], [0.45, 0.94, 0.7], [0.475, 0.89, 0.65, 0.17], [0.49, 0.82, 0.58, 0.2], [0.5, 0.72, 0.5, 0.26],
          ],
          glass: { base: 0.93, roof: 1.43, xf: 0.24, xb: -0.4, rf: 0.01, rb: -0.22, wb: 0.405, wt: 0.325, bow: 0.022, bulge: 0.06, arch: 0.06, glassRoof: true, pillars: [[0.5, 0.06, 'black'], [0, 0.12, 'black']], aPillar: 'black' },
          wheel: { r: 0.33, width: 0.235, xf: 0.305, xr: -0.29, caliper: '#2b2d31' },
          rim: { style: 'aero', spokes: 5, color: '#8d939a', frac: 0.72 },
          doors: [[0.22, 0.0], [0.0, -0.2]],
          handles: [0.05, -0.14],
          handleStyle: 'flush',
          mirrorSwatch: 'paint',
          bumpers: [{ y: 0.22, h: 0.06, span: 0.7, material: 'black' }, { y: 0.26, h: 0.08, span: 0.8, material: 'black' }],
          plateRear: 0.52,
          plateFront: 0.32,
          frontPlate: false,
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.55, zOut: 0.99, yIn: [0.52, 0.575], yOut: [0.56, 0.63], wrap: 0.28, wrapTip: 0.25, wrapRise: 0.03 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.56, 0.565 * M], [side * hw * 0.8, 0.59 * M], [side * hw * 0.97, 0.625 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', side * hw * 0.74, 0.58 * M, 0.03, side);
              k.halo('head', side, k.surf('front', side * hw * 0.76, 0.58 * M, 0.05 * M), 1);
              // Slim tail lamps along the ducktail, joined by a thin bar.
              const tail = cornerLamp(k, -1, side, { zIn: 0.4, zOut: 0.99, yIn: [0.855, 0.895], yOut: [0.84, 0.9], wrap: 0.26, wrapTip: 0.4 });
              ledLine(k, k.tail(side), 'rear', [[side * tail.hw * 0.02, 0.885 * M], [side * tail.hw * 0.6, 0.884 * M], [side * tail.hw * 0.95, 0.875 * M]], CV_TAIL_BAR, 0.012);
              k.halo('tail', side, k.surf('rear', side * tail.hw * 0.75, 0.87 * M, 0.05 * M), 1);
              k.patch(sets.trim, 'front', side * hw * 0.62, side * hw * 0.9, 0.24 * M, 0.3 * M, { color: CV_GLOSS, finish: 'gloss', cols: 4, rows: 1 });
            }
            // No grille: a sensor panel and a slim lower intake.
            const gw = at(0.49 * k.l, 0.3 * M).half;
            k.grille('front', -gw * 0.55, gw * 0.55, 0.22 * M, 0.3 * M, { cell: 'mesh', color: '#2a2d31', tile: 0.06 * M });
            badge(k, 'front', 0, 0.48, 0.035, '#c9ced3');
            const tw = at(-0.49 * k.l, 0.4 * M).half;
            k.patch(sets.trim, 'rear', -tw * 0.75, tw * 0.75, 0.18 * M, 0.27 * M, { color: CV_PLASTIC, finish: 'plastic', cols: 8, rows: 1, lift: 0.01 * M });
            // The ducktail lip in the body colour.
            const x = -0.47 * k.l;
            k.bar(sets.paint, [x, k.top(x) + 0.012 * M, -tw * 0.85], [x, k.top(x) + 0.012 * M, tw * 0.85], 0.025 * M, 0.08 * M, 0.012 * M, k.sw('paint'), [0, 1, 0]);
            plateLight(k, 0.52);
          },
        }),
        /* DUKE V8: a Challenger-style muscle car: a long flat hood with a power
           bulge, a full-width grille framing quad round lamps with halo rings, a
           short deck, thick C pillars, racetrack tail lamps and twin stripes. */
        muscle: civBody('muscle', {
          yb: 0.16,
          h: 1.0,
          arches: 0.014,
          section: SEC_BOXY,
          profile: [
            [-0.5, 0.86, 0.94, 0.34], [-0.492, 0.94, 0.99, 0.24], [-0.47, 0.985, 1.02, 0.17], [-0.4, 1.0, 1.03], [-0.3, 1.0, 1.02], [-0.18, 1.0, 1.0],
            [0.12, 1.0, 0.99], [0.25, 1.0, 0.97], [0.38, 0.995, 0.93], [0.46, 0.975, 0.89], [0.485, 0.94, 0.86, 0.18], [0.5, 0.88, 0.8, 0.22],
          ],
          glass: { base: 1.0, roof: 1.42, xf: 0.13, xb: -0.29, rf: -0.06, rb: -0.21, wb: 0.405, wt: 0.33, bow: 0.012, bulge: 0.04, arch: 0.03, frame: 'gloss', sideFrom: 0.12, pillars: [[0.55, 0.05, 'black']], aPillar: 'paint' },
          wheel: { r: 0.36, width: 0.27, wr: 0.29, xf: 0.3, xr: -0.29, caliper: '#c8141c' },
          rim: { style: 'star', spokes: 5, color: '#3a3d42', frac: 0.74, lipColor: '#c9ced3' },
          doors: [[0.13, -0.12]],
          handles: [-0.08],
          fuel: [-0.26, 0.9],
          sill: CV_PLASTIC,
          bumpers: [{ y: 0.28, h: 0.1, span: 0.85, material: 'black' }, { y: 0.3, h: 0.1, span: 0.85, material: 'black' }],
          plateRear: 0.62,
          plateFront: 0.4,
          livery(g, f, L) {
            // Twin stripes nose to tail.
            for (const z of [-1, 1]) L.stripe(-0.52 * L.l, 0.52 * L.l, z * 0.08, z * 0.26, 'rgba(12,13,15,0.96)');
          },
          details(k) {
            const { M, S, sets, at } = k;
            const hw = at(0.495 * k.l, 0.7 * M).half;
            // The grille across the nose, with the quad lamps set in it.
            k.grille('front', -hw * 0.97, hw * 0.97, 0.6 * M, 0.82 * M, { cell: 'honeycomb', color: '#2f3236', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.12 * M });
            for (const side of [-1, 1]) {
              for (const [zf, r] of [[0.8, 0.075], [0.58, 0.07]]) {
                const p = k.round(k.head(side), S.cylinder24, 'front', side * hw * zf, 0.71 * M, r * M, 0.04 * M, { color: '#c9d0d6', finish: 'lens', lift: 0.03 * M }, side);
                k.round(sets.drl, S.torus, 'front', side * hw * zf, 0.71 * M, r * 0.88 * M, 0.06 * M, { color: CV_LED, lift: 0.045 * M, spin: 0 }, side);
              }
              k.halo('head', side, k.surf('front', side * hw * 0.7, 0.71 * M, 0.06 * M), 1.1);
              k.patch(sets.trim, 'front', side * hw * 0.62, side * hw * 0.92, 0.3 * M, 0.44 * M, { cell: 'honeycomb', color: '#2f3236', finish: 'gloss', tile: 0.1 * M });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.66, 0.46 * M], [side * hw * 0.9, 0.46 * M]], CV_AMBER, 0.014);
              // Hood vents beside the bulge.
              k.patch(sets.trim, 'top', 0.3 * k.l, 0.4 * k.l, side * 0.28 * M, side * 0.4 * M, { cell: 'louvre', color: '#2a2c30', finish: 'gloss', tile: 0.12 * M, lift: 0.02 * M });
              sideMarker(k, 0.46 * k.l, 0.72, side);
            }
            // The racetrack tail lamp across the whole tail, the badge in its middle.
            const tw = at(-0.495 * k.l, 0.84 * M).half;
            for (const side of [-1, 1]) {
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.02, side * tw * 0.985, () => [0.78 * M, 0.9 * M], '#2a0507');
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.05, 0.84 * M], [side * tw * 0.95, 0.84 * M]], CV_TAIL_BAR, 0.05);
              k.halo('tail', side, k.surf('rear', side * tw * 0.6, 0.84 * M, 0.05 * M), 1.1);
            }
            k.patch(sets.trim, 'rear', -tw * 0.12, tw * 0.12, 0.8 * M, 0.88 * M, { color: '#16181b', finish: 'gloss', cols: 2, rows: 1, lift: 0.025 * M });
            exhaustTips(k, [-0.62, -0.5, 0.5, 0.62], 0.29, 0.045, CV_CHROME);
            // The power bulge on the hood and the lip spoiler on the deck.
            k.bar(sets.paint, [0.2 * k.l, k.top(0.2 * k.l) + 0.02 * M, 0], [0.44 * k.l, k.top(0.44 * k.l) + 0.012 * M, 0], 0.07 * M, 0.5 * M, 0.035 * M, { uvOf: k.topUv }, [0, 1, 0]);
            const x = -0.465 * k.l;
            k.bar(sets.paint, [x, k.top(x) + 0.03 * M, -tw * 0.9], [x, k.top(x) + 0.03 * M, tw * 0.9], 0.05 * M, 0.1 * M, 0.02 * M, k.sw('paint'), [0, 1, 0]);
            plateLight(k, 0.62);
          },
        }),
        /* COMET GT: a rear-engined 911-style coupe: frog-eye round lamps on the
           front wings, a low bonnet, wide rear hips, a sloping roof into louvred
           engine lid with a ducktail, the full-width light bar. */
        sport: civBody('sport', {
          yb: 0.13,
          h: 0.88,
          arches: 0.035,
          archSpan: 0.11,
          section: SEC_SPORT,
          sections: [[-0.5, SEC_FENDER_SOFT], [-0.22, SEC_FENDER_SOFT], [-0.1, SEC_SPORT], [0.12, SEC_SPORT], [0.22, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.78, 0.8, 0.32], [-0.492, 0.88, 0.87, 0.22], [-0.47, 0.95, 0.9, 0.15], [-0.42, 0.99, 0.91], [-0.3, 1.02, 0.9], [-0.18, 1.0, 0.88],
            [0.05, 0.97, 0.86], [0.2, 0.96, 0.8], [0.3, 0.965, 0.76], [0.38, 0.955, 0.72], [0.44, 0.93, 0.67], [0.475, 0.88, 0.6, 0.16], [0.49, 0.8, 0.52, 0.2], [0.5, 0.7, 0.44, 0.26],
          ],
          glass: { base: 0.86, roof: 1.29, xf: 0.21, xb: -0.36, rf: -0.02, rb: -0.19, wb: 0.39, wt: 0.3, bow: 0.02, bulge: 0.06, arch: 0.06, frame: 'gloss', pillars: [[0.5, 0.05, 'black']], aPillar: 'paint' },
          wheel: { r: 0.34, width: 0.25, wr: 0.3, xf: 0.3, xr: -0.29, caliper: '#c8141c' },
          rim: { style: 'y', spokes: 5, color: '#c3c8cd', frac: 0.74, centreLock: true },
          hatch: true,
          doors: [[0.2, -0.1]],
          handles: [-0.05],
          handleStyle: 'flush',
          bumpers: [{ y: 0.22, h: 0.06, span: 0.8, material: 'black' }, { y: 0.24, h: 0.07, span: 0.8, material: 'black' }],
          plateRear: 0.46,
          plateFront: 0.3,
          frontPlate: false,
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              // Frog-eye lamps on the tops of the wings, four-point DRLs inside.
              const x = 0.43 * k.l,
                z = side * 0.52 * M,
                y = k.topY(x, z);
              k.disc(k.head(side), S.dome, x + 0.02 * M, y - 0.03 * M, z, 0.12 * M, 0.08 * M, [0.55, 0.83, 0], { color: '#d7dde2', finish: 'lens' });
              k.disc(sets.trim, S.cylinder24, x, y - 0.05 * M, z, 0.14 * M, 0.04 * M, [0.55, 0.83, 0], { color: '#16181b', finish: 'gloss' });
              for (const a of [0.8, 2.37, 3.93, 5.5]) k.add(sets.drl, S.box, x + 0.02 * M + Math.cos(a) * 0.06 * M * 0.55, y + 0.02 * M, z + Math.sin(a) * 0.06 * M, 0.025 * M, 0.012 * M, 0.025 * M, { color: CV_LED });
              k.halo('head', side, [x + 0.1 * M, y, z], 1);
              const hw = at(0.49 * k.l, 0.35 * M).half;
              k.patch(sets.trim, 'front', side * hw * 0.35, side * hw * 0.9, 0.2 * M, 0.34 * M, { cell: 'mesh', color: '#2a2c30', finish: 'gloss', tile: 0.08 * M });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.5, 0.36 * M], [side * hw * 0.85, 0.37 * M]], CV_AMBER, 0.012);
              const tw = at(-0.495 * k.l, 0.74 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.02, side * tw * 0.99, (zz) => [(0.72 - 0.02 * Math.abs(zz) / tw) * M, (0.77 - 0.01 * Math.abs(zz) / tw) * M], '#300507');
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.03, 0.748 * M], [side * tw * 0.96, 0.738 * M]], CV_TAIL_BAR, 0.012);
              k.halo('tail', side, k.surf('rear', side * tw * 0.75, 0.74 * M, 0.05 * M), 1);
            }
            // The engine lid: louvres on the lid, the ducktail with its third brake light.
            k.patch(sets.trim, 'top', -0.46 * k.l, -0.38 * k.l, -0.36 * M, 0.36 * M, { cell: 'louvre', color: '#1f2124', finish: 'gloss', tile: 0.09 * M, lift: 0.012 * M });
            const x = -0.475 * k.l,
              tw = at(x, k.top(x)).half;
            k.bar(sets.paint, [x, k.top(x) + 0.03 * M, -tw * 0.82], [x, k.top(x) + 0.03 * M, tw * 0.82], 0.035 * M, 0.16 * M, 0.02 * M, k.sw('paint'), [0, 1, 0]);
            k.patch(sets.trim, 'rear', -0.34 * M, 0.34 * M, 0.66 * M, 0.7 * M, { color: '#16181b', finish: 'gloss', cols: 4, rows: 1, lift: 0.016 * M });
            exhaustTips(k, [-0.1, 0.1], 0.26, 0.05, '#c9ced3');
            k.round(sets.trim, S.cylinder24, 'top', 0.46 * k.l, 0, 0.035 * M, 0.018 * M, { color: '#d9b14a', finish: 'chrome' });
            plateLight(k, 0.46);
          },
        }),
        /* SOLSTICE SPIDER: a two-seat roadster (MX-5 / Solstice), top down: long
           nose, cockpit with two leather buckets and roll hoops, a raked screen,
           the soft top folded under its cover. */
        roadster: civBody('roadster', {
          yb: 0.13,
          h: 0.86,
          arches: 0.03,
          archSpan: 0.1,
          section: SEC_SPORT,
          sections: [[-0.5, SEC_FENDER_SOFT], [-0.22, SEC_FENDER_SOFT], [-0.1, SEC_SPORT], [0.12, SEC_SPORT], [0.22, SEC_FENDER_SOFT], [0.5, SEC_FENDER_SOFT]],
          profile: [
            [-0.5, 0.78, 0.8, 0.34], [-0.49, 0.88, 0.86, 0.22], [-0.46, 0.95, 0.9, 0.15], [-0.4, 0.99, 0.9], [-0.3, 1.0, 0.88], [-0.2, 0.99, 0.84],
            [0.1, 0.98, 0.84], [0.2, 0.985, 0.8], [0.32, 0.99, 0.75], [0.42, 0.97, 0.7], [0.47, 0.91, 0.63, 0.16], [0.49, 0.83, 0.56, 0.2], [0.5, 0.72, 0.48, 0.27],
          ],
          glass: { base: 0.82, roof: 1.2, xf: 0.19, xb: 0.02, rf: 0.07, rb: 0.02, wb: 0.4, wt: 0.37, bow: 0.01, bulge: 0.05, arch: 0.03, open: true, sideFrom: 0.8, aPillar: 'black', aWidth: 0.05 },
          wheel: { r: 0.31, width: 0.215, xf: 0.3, xr: -0.29, caliper: '#3a3d42' },
          rim: { style: 'straight', spokes: 7, color: '#b8bec4', frac: 0.72, spokeWidth: 0.1 },
          mirrors: true,
          noWipers: false,
          doors: [[0.18, -0.08]],
          handles: [-0.05],
          bumpers: [{ y: 0.24, h: 0.06, span: 0.7, material: 'black' }, { y: 0.28, h: 0.07, span: 0.8, material: 'black' }],
          plateRear: 0.5,
          plateFront: 0.32,
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.5, zOut: 0.99, yIn: [0.52, 0.58], yOut: [0.58, 0.66], wrap: 0.3, wrapTip: 0.3, wrapRise: 0.03, curve: 0.01 });
              projector(k, k.head(side), 'front', side * hw * 0.75, 0.6 * M, 0.035, side);
              ledLine(k, sets.drl, 'front', [[side * hw * 0.52, 0.575 * M], [side * hw * 0.8, 0.615 * M], [side * hw * 0.97, 0.655 * M]], CV_LED, 0.012);
              k.halo('head', side, k.surf('front', side * hw * 0.75, 0.6 * M, 0.05 * M), 1);
              const tail = cornerLamp(k, -1, side, { zIn: 0.55, zOut: 0.99, yIn: [0.66, 0.77], yOut: [0.64, 0.78], wrap: 0.2, wrapTip: 0.5 });
              k.round(k.tail(side), S.cylinder24, 'rear', side * tail.hw * 0.74, 0.715 * M, 0.05 * M, 0.02 * M, { color: CV_TAIL_BAR, finish: 'lens', lift: 0.024 * M }, side);
              k.halo('tail', side, k.surf('rear', side * tail.hw * 0.75, 0.71 * M, 0.05 * M), 1);
              // Bucket seats, head restraints and a roll hoop behind each.
              const z = side * 0.3 * M,
                x = -0.08 * k.l;
              k.bar(sets.trim, [x - 0.05 * M, 0.62 * M, z], [x + 0.35 * M, 0.62 * M, z], 0.12 * M, 0.44 * M, 0.05 * M, { color: '#6e4a31', finish: 'leather' });
              k.bar(sets.trim, [x - 0.06 * M, 0.6 * M, z], [x - 0.14 * M, 1.02 * M, z], 0.12 * M, 0.44 * M, 0.05 * M, { color: '#6e4a31', finish: 'leather' });
              k.bar(sets.trim, [x - 0.15 * M, 1.03 * M, z], [x - 0.17 * M, 1.12 * M, z], 0.1 * M, 0.25 * M, 0.04 * M, { color: '#5a3a26', finish: 'leather' });
              k.add(sets.trim, S.halfTorus, x - 0.3 * M, 0.9 * M, z, 0.22 * M, 0.26 * M, 0.3 * M, { color: '#c9ced3', finish: 'chrome' }, 0, Math.PI / 2, 0);
            }
            // The cockpit floor and dash under the screen, the wheel, the folded top.
            const g = k.g;
            k.patch(sets.trim, 'top', -0.2 * k.l, g.xf * k.l - 0.02 * M, -0.62 * M, 0.62 * M, { color: '#151515', finish: 'matte', lift: 0.01 * M, cols: 4, rows: 3 });
            k.bar(sets.trim, [g.xf * k.l - 0.25 * M, 0.9 * M, -0.62 * M], [g.xf * k.l - 0.25 * M, 0.9 * M, 0.62 * M], 0.12 * M, 0.35 * M, 0.05 * M, { color: '#1c1c1d', finish: 'leather' });
            k.disc(sets.trim, S.torus, g.xf * k.l - 0.52 * M, 0.95 * M, -0.3 * M, 0.17 * M, 1, [0.6, 0.8, 0], { color: '#141414', finish: 'leather' });
            k.bar(sets.trim, [-0.3 * k.l, 0.9 * M, -0.62 * M], [-0.3 * k.l, 0.9 * M, 0.62 * M], 0.08 * M, 0.32 * M, 0.04 * M, { color: '#101112', finish: 'matte' });
            k.bar(sets.trim, [0.05 * k.l, 0.72 * M, 0], [-0.18 * k.l, 0.72 * M, 0], 0.18 * M, 0.2 * M, 0.04 * M, { color: '#1c1c1d', finish: 'leather' });
            const gw = at(0.49 * k.l, 0.35 * M).half;
            k.grille('front', -gw * 0.62, gw * 0.62, 0.22 * M, 0.42 * M, { cell: 'mesh', color: '#2a2d31', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.08 * M });
            badge(k, 'front', 0, 0.45, 0.035);
            exhaustTips(k, [-0.55, 0.55], 0.27, 0.035);
            plateLight(k, 0.5);
          },
        }),
        /* KODIAK RS: a WRX / Focus RS rally hatch: a bonnet scoop, a tall roof
           wing, black arch flares and sills, a light pod on the nose, gold mesh
           wheels and rally decals. */
        rally: civBody('rally', {
          yb: 0.16,
          h: 0.98,
          arches: 0.02,
          section: SEC_SALOON,
          profile: [
            [-0.5, 0.8, 0.96, 0.36], [-0.492, 0.9, 1.0, 0.24], [-0.47, 0.96, 1.01, 0.17], [-0.42, 0.99, 1.0], [-0.3, 1.0, 0.99], [0.1, 1.0, 0.95],
            [0.2, 1.0, 0.92], [0.3, 0.995, 0.88], [0.4, 0.98, 0.84], [0.46, 0.94, 0.79], [0.485, 0.88, 0.73, 0.19], [0.5, 0.78, 0.64, 0.26],
          ],
          glass: { base: 0.95, roof: 1.46, xf: 0.21, xb: -0.47, rf: 0.02, rb: -0.42, wb: 0.41, wt: 0.335, bow: 0.018, bulge: 0.05, arch: 0.04, frame: 'gloss', pillars: [[0.48, 0.07, 'black'], [0.14, 0.09, 'black'], [0, 0.1, 'paint']], aPillar: 'black' },
          wheel: { r: 0.33, width: 0.245, xf: 0.3, xr: -0.29, caliper: '#e3b62b' },
          rim: { style: 'mesh', spokes: 10, color: '#c9a24a', frac: 0.73 },
          flares: '#141517',
          hatch: true,
          doors: [[0.21, 0.0], [0.0, -0.21]],
          handles: [0.07, -0.14],
          sill: '#141517',
          sillHeight: 0.12,
          accentColor: '#c9a24a',
          bumpers: [{ y: 0.25, h: 0.08, span: 0.84, material: 'black' }, { y: 0.28, h: 0.08, span: 0.84, material: 'black' }],
          plateRear: 0.6,
          plateFront: 0.36,
          livery(g, f, L) {
            const { l, M } = L;
            // A white number panel on the front doors and a gold pinstripe.
            L.band(g, f, 0.03 * l, 0.17 * l, 0.5 * M, 0.78 * M, '#f2f2ee');
            L.text(g, f, '27', 0.1 * l, 0.64 * M, 0.2 * M, '#16181b', { stretch: 1.0 });
            L.band(g, f, -0.46 * l, 0.44 * l, 0.44 * M, 0.455 * M, '#c9a24a');
            L.text(g, f, 'KODIAK RS', -0.12 * l, 0.36 * M, 0.08 * M, '#c9a24a', { stretch: 1.2, spacing: 0.02 * M });
          },
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.45, zOut: 0.99, yIn: [0.63, 0.71], yOut: [0.66, 0.78], wrap: 0.3, wrapTip: 0.3, wrapRise: 0.02 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.47, 0.645 * M], [side * hw * 0.62, 0.64 * M], [side * hw * 0.78, 0.7 * M], [side * hw * 0.96, 0.765 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.7, 0.7 * M, 0.04, side);
              k.halo('head', side, k.surf('front', side * hw * 0.7, 0.7 * M, 0.05 * M), 1);
              const tail = cornerLamp(k, -1, side, { zIn: 0.62, zOut: 0.99, yIn: [0.84, 0.98], yOut: [0.8, 0.99], wrap: 0.2, wrapTip: 0.6 });
              ledLine(k, k.tail(side), 'rear', [[side * tail.hw * 0.68, 0.9 * M], [side * tail.hw * 0.96, 0.89 * M]], CV_TAIL_BAR, 0.02);
              k.halo('tail', side, k.surf('rear', side * tail.hw * 0.8, 0.9 * M, 0.05 * M), 1);
              // Fog lamps in the bumper corners, vents behind the front wheels.
              k.round(sets.drl, S.cylinder24, 'front', side * hw * 0.8, 0.36 * M, 0.05 * M, 0.02 * M, { color: '#fff4dc', lift: 0.02 * M }, side);
              k.patch(sets.trim, 'side', 0.16 * k.l, 0.22 * k.l, 0.55 * M, 0.66 * M, { side, cell: 'slats', color: '#1a1c1f', finish: 'gloss', tile: 0.1 * M });
            }
            const gw = at(0.49 * k.l, 0.5 * M).half;
            k.grille('front', -gw * 0.5, gw * 0.5, 0.52 * M, 0.66 * M, { cell: 'hex', color: '#2c2f33', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.12 * M });
            k.grille('front', -gw * 0.62, gw * 0.62, 0.26 * M, 0.44 * M, { cell: 'honeycomb', color: '#2c2f33', tile: 0.12 * M });
            badge(k, 'front', 0, 0.59, 0.04);
            // The bonnet scoop, its black intake facing forward.
            const sx = 0.33 * k.l,
              sy = k.top(sx);
            k.bar(sets.paint, [0.25 * k.l, sy + 0.02 * M, 0], [0.4 * k.l, k.top(0.4 * k.l) + 0.045 * M, 0], 0.07 * M, 0.5 * M, 0.035 * M, { uvOf: k.topUv });
            k.add(sets.trim, S.box, 0.402 * k.l, k.top(0.4 * k.l) + 0.05 * M, 0, 0.01 * M, 0.05 * M, 0.44 * M, { cell: 'honeycomb', color: '#1a1b1d', finish: 'gloss' });
            // The rally light pod, four lamps across the nose.
            for (const z of [-0.45, -0.15, 0.15, 0.45]) {
              k.round(sets.trim, S.cylinder24, 'front', z * M, 0.83 * M, 0.075 * M, 0.08 * M, { color: '#15171a', finish: 'gloss', lift: 0.06 * M });
              k.round(sets.drl, S.dome, 'front', z * M, 0.83 * M, 0.06 * M, 0.03 * M, { color: '#fff4dc', lift: 0.11 * M });
            }
            // The roof wing on two stands.
            const g = k.g,
              wx = g.rb * k.l - 0.05 * M,
              wy = g.roof + 0.1 * M;
            k.bar(sets.paint, [wx, wy, -g.wt * k.w * 1.05], [wx, wy, g.wt * k.w * 1.05], 0.04 * M, 0.34 * M, 0.02 * M, k.sw('paint'), [0.3, 1, 0]);
            for (const side of [-1, 1]) k.bar(sets.trim, [wx + 0.05 * M, g.roof - 0.02 * M, side * 0.4 * M], [wx, wy, side * 0.4 * M], 0.03 * M, 0.12 * M, 0.01 * M, { color: '#141517', finish: 'gloss' });
            k.add(sets.drl, S.box, wx - 0.12 * M, wy + 0.01 * M, 0, 0.02 * M, 0.02 * M, 0.4 * M, { color: '#ff3a2e' });
            roofRails(k, '#141517', 0.8);
            exhaustTips(k, [-0.36, -0.24, 0.24, 0.36], 0.27, 0.04, '#b9bec3');
            k.patch(sets.trim, 'rear', -0.55 * M, 0.55 * M, 0.2 * M, 0.3 * M, { cell: 'slats', color: '#1a1c1f', finish: 'plastic', tile: 0.06 * M, lift: 0.012 * M });
            plateLight(k, 0.6);
          },
        }),
        /* HELLFIRE CUSTOM: a chopped '32 three-window coupe: the blown V8 through
           the hood, zoomie headers down the sides, a chrome grille shell and
           bucket headlamps, cycle-winged front wheels on a dropped axle, fat
           whitewalled rear tyres under the rear wings, flames down the flanks. */
        hotrod: civBody('hotrod', {
          yb: 0.22,
          h: 1.02,
          arches: 0.06,
          archSpan: 0.11,
          section: SEC_BOXY,
          sections: [
            [-0.5, SEC_BOXY],
            [0.13, SEC_BOXY],
            [0.2, [[0, 0.92], [0.1, 0.99], [0.3, 1], [0.7, 1], [0.85, 0.98], [0.93, 0.93], [0.975, 0.84], [1, 0.62], [1, 0.3], [1, 0]]],
          ],
          profile: [
            [-0.5, 0.74, 0.8, 0.42], [-0.485, 0.84, 0.92, 0.3], [-0.45, 0.9, 0.99, 0.22], [-0.32, 0.96, 1.02], [-0.2, 0.9, 1.03], [0.1, 0.9, 1.02],
            [0.15, 0.86, 1.0], [0.2, 0.47, 0.97], [0.3, 0.44, 0.96], [0.43, 0.43, 0.97], [0.47, 0.44, 0.99, 0.32], [0.49, 0.42, 0.97, 0.38], [0.5, 0.36, 0.9, 0.42],
          ],
          glass: { base: 1.02, roof: 1.33, xf: 0.13, xb: -0.25, rf: 0.1, rb: -0.22, wb: 0.36, wt: 0.33, bow: 0.005, bulge: 0.01, arch: 0.03, frame: 'chrome', pillars: [[0.58, 0.1, 'paint'], [0, 0.18, 'paint']], aPillar: 'paint', aWidth: 0.06 },
          wheel: { r: 0.32, rr: 0.39, width: 0.17, wr: 0.34, xf: 0.37, xr: -0.29, exposedFront: true, zf: 0.72 },
          rim: { style: 'smoothie', color: '#e3e7ea', frac: 0.62, finish: 'chrome' },
          tyre: 'whitewall',
          finish: { roughness: 0.18, metalness: 0.35 },
          hatch: true,
          mirrors: false,
          noWipers: true,
          doors: [[0.12, -0.14]],
          handles: [-0.12],
          handleStyle: 'chrome',
          plates: true,
          frontPlate: false,
          plateRear: 0.55,
          bumpers: [{ y: 0.42, h: 0.08, span: 1.6, material: 'chrome', d: 0.06 }, { y: 0.38, h: 0.08, span: 1.0, material: 'chrome', d: 0.06 }],
          livery(g, f, L) {
            const { l, M } = L;
            // Flames licking back from the grille along the hood sides and cowl.
            const tongues = [[0.12, 0.72, 0.16], [0.02, 0.8, 0.12], [0.08, 0.64, 0.1], [-0.04, 0.88, 0.07]];
            for (const [end, y, t] of tongues) {
              L.polygon(g, f, [[0.5 * l, (y - t * 0.8) * M], [0.5 * l, (y + t) * M], [(end + 0.1) * l, (y + t * 0.5) * M], [end * l, y * M], [(end + 0.1) * l, (y - t * 0.3) * M]], '#e8661a');
              L.polygon(g, f, [[0.5 * l, (y - t * 0.4) * M], [0.5 * l, (y + t * 0.6) * M], [(end + 0.18) * l, (y + t * 0.25) * M], [(end + 0.1) * l, y * M]], '#f3c43a');
            }
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            const nose = 0.5 * l;
            // The chrome grille shell standing at the nose.
            k.grille('front', -0.26 * M, 0.26 * M, 0.45 * M, 0.95 * M, { cell: 'bars', color: '#c9ced3', finish: 'chrome', frame: CV_CHROME, tile: 0.05 * M, lift: 0.02 * M });
            for (const side of [-1, 1]) {
              // Bucket headlamps on a bar ahead of the wheels.
              const hz = side * 0.52 * M;
              k.bar(sets.trim, [nose - 0.1 * M, 0.78 * M, 0], [nose - 0.1 * M, 0.78 * M, hz], 0.04 * M, 0.04 * M, 0.015 * M, { color: CV_CHROME, finish: 'chrome' });
              k.add(sets.trim, S.cone, nose - 0.02 * M, 0.84 * M, hz, 0.12 * M, 0.2 * M, 0.12 * M, { color: CV_CHROME, finish: 'chrome' }, 0, 0, -Math.PI / 2);
              k.add(k.head(side), S.dome, nose + 0.08 * M, 0.84 * M, hz, 0.1 * M, 0.05 * M, 0.1 * M, { color: '#f4f1e6', finish: 'lens' }, 0, 0, -Math.PI / 2);
              k.halo('head', side, [nose + 0.14 * M, 0.84 * M, hz], 1);
              // Front wings over the exposed wheels, the dropped axle, a spring.
              const [front] = k.wheels,
                wz = side * front.z;
              for (let q = 0; q < 6; q++) {
                const a0 = 0.35 + (q / 6) * 2.3,
                  a1 = 0.35 + ((q + 1) / 6) * 2.3,
                  R = front.r * 1.18;
                k.bar(sets.paint, [front.x + Math.cos(a0) * R, front.r + Math.sin(a0) * R, wz], [front.x + Math.cos(a1) * R, front.r + Math.sin(a1) * R, wz], 0.02 * M, front.width * 1.25, 0.008 * M, k.sw('paint'), [0, 0, 1]);
              }
              k.bar(sets.trim, [front.x, front.r * 0.9, 0], [front.x, front.r, wz], 0.06 * M, 0.06 * M, 0.02 * M, { color: '#c9ced3', finish: 'chrome' });
              // Zoomie headers: four chrome pipes up and back out of each bank.
              for (let i = 0; i < 4; i++) {
                const x = 0.22 * l + i * 0.1 * M,
                  z0 = side * 0.26 * M,
                  z1 = side * 0.46 * M;
                k.bar(sets.trim, [x, 0.8 * M, z0], [x - 0.08 * M, 0.9 * M, z1], 0.04 * M, 0.04 * M, 0.018 * M, { color: '#e8e2d6', finish: 'chrome' });
                k.bar(sets.trim, [x - 0.08 * M, 0.9 * M, z1], [x - 0.34 * M, 1.02 * M, z1 * 1.04], 0.045 * M, 0.045 * M, 0.02 * M, { color: '#e8e2d6', finish: 'chrome' });
              }
              // Rear lamps: little round teardrops on the wings.
              const tw = at(-0.46 * l, 0.8 * M).half;
              k.round(k.tail(side), S.cylinder24, 'rear', side * tw * 0.75, 0.78 * M, 0.06 * M, 0.04 * M, { color: '#d61e1e', finish: 'lens', lift: 0.03 * M }, side);
              k.halo('tail', side, k.surf('rear', side * tw * 0.75, 0.78 * M, 0.06 * M), 1);
              // Running board between the wings.
              k.patch(sets.trim, 'side', -0.2 * l, 0.12 * l, 0.28 * M, 0.34 * M, { side, cell: 'tread', color: '#2a2c2f', finish: 'rubber', tile: 0.2 * M, lift: 0.02 * M });
            }
            // The blown V8: block and rocker covers, the supercharger, its scoop.
            const ex = 0.3 * l;
            k.bar(sets.trim, [ex - 0.35 * M, 1.02 * M, 0], [ex + 0.35 * M, 1.02 * M, 0], 0.16 * M, 0.44 * M, 0.05 * M, { color: '#1c1d20', finish: 'satin' });
            for (const side of [-1, 1]) k.bar(sets.trim, [ex - 0.32 * M, 1.12 * M, side * 0.15 * M], [ex + 0.32 * M, 1.12 * M, side * 0.15 * M], 0.07 * M, 0.1 * M, 0.03 * M, { color: '#dfe3e6', finish: 'chrome' });
            k.bar(sets.trim, [ex - 0.25 * M, 1.22 * M, 0], [ex + 0.25 * M, 1.22 * M, 0], 0.18 * M, 0.26 * M, 0.06 * M, { color: '#c9ced3', finish: 'chrome' });
            k.bar(sets.trim, [ex - 0.12 * M, 1.4 * M, 0], [ex + 0.12 * M, 1.44 * M, 0], 0.16 * M, 0.3 * M, 0.04 * M, { color: '#16181b', finish: 'gloss' });
            k.add(sets.trim, S.box, ex + 0.125 * M, 1.42 * M, 0, 0.01 * M, 0.12 * M, 0.26 * M, { cell: 'mesh', color: '#9aa0a6', finish: 'chrome' });
            k.disc(sets.trim, S.cylinder24, ex + 0.32 * M, 1.0 * M, 0, 0.12 * M, 0.08 * M, [1, 0, 0], { color: '#3a3d41', finish: 'satin' });
            exhaustTips(k, [-0.3], 0.3, 0.04);
          },
        }),
