      // Helicopter airframe plans: Colibri, Robin, Hawk (heliPlans).
      // ---- Airframe plans ---------------------------------------------------------------
      function heliRoundRect(px, py, x0, x1, y0, y1, r) {
        const qx = Math.abs(px - (x0 + x1) / 2) - ((x1 - x0) / 2 - r),
          qy = Math.abs(py - (y0 + y1) / 2) - ((y1 - y0) / 2 - r);
        const ox = Math.max(qx, 0),
          oy = Math.max(qy, 0);
        // (Math.sqrt, not Math.hypot: this runs for every pixel of the livery.)
        return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;
      }
      /*
       * Stations are [x, keel, crown, widest height, half width, upper exponent,
       * lower exponent], tail to nose. `windows(x, y, z, st)` is a signed distance to
       * the glazing (negative on glass), `seams` the distance to a panel seam.
       */
      // EC120 / H130 class (the police): about 9.7 m from the nose to the fan.
      function heliColibriPlan() {
        return {
          name: 'colibri',
          // Half widths are scaled by this (a touch broader than life reads better from above).
          widen: 1.08,
          keys: [
            [-38.6, 14.7, 15.9, 15.3, 0.3, 2, 2],
            [-38.0, 14.3, 16.3, 15.3, 1.0, 2, 2],
            [-36.5, 14.0, 16.55, 15.3, 1.45, 2, 2],
            [-32, 13.85, 16.75, 15.3, 1.75, 2, 2],
            [-26, 13.55, 16.95, 15.25, 2.1, 2, 2],
            [-20, 13.0, 17.3, 15.1, 2.5, 2.05, 2.05],
            [-16, 12.1, 17.75, 14.8, 3.0, 2.1, 2.15],
            [-12, 10.4, 18.45, 14.2, 3.8, 2.15, 2.3],
            [-8, 8.3, 19.15, 13.4, 4.7, 2.2, 2.5],
            [-4, 6.8, 19.75, 12.8, 5.4, 2.25, 2.7],
            [1, 5.9, 20.2, 12.4, 5.9, 2.3, 2.9],
            [8, 5.5, 20.4, 12.2, 6.2, 2.3, 3.0],
            [15, 5.4, 20.3, 12.0, 6.3, 2.3, 3.0],
            [21, 5.4, 19.9, 11.6, 6.25, 2.25, 2.9],
            [26, 5.5, 19.1, 11.1, 6.0, 2.2, 2.7],
            [30, 5.8, 17.8, 10.6, 5.5, 2.15, 2.5],
            [33.2, 6.3, 16.1, 10.2, 4.6, 2.1, 2.3],
            [35.6, 7.1, 14.2, 10.0, 3.4, 2.05, 2.15],
            [37.0, 8.1, 12.4, 10.0, 2.1, 2, 2],
            [37.8, 9.2, 10.9, 10.0, 0.9, 2, 2],
            [38.1, 9.8, 10.2, 10.0, 0.25, 2, 2],
          ],
          // Extra sample planes along x (window and door edges), sample step.
          marks: [-15, 2.8, 3.5, 15.2, 16.2, 17.0, 17.4, 27.1, 27.8, 28.4],
          step: (x) => (x > -16 ? 1.25 : 2.4),
          segments: 48,
          cabin: { back: -3.5, front: 34, floor: 7.2 },
          windows(x, y, z, st, roofGlass = true) {
            const az = Math.abs(z),
              side = az > st.w * 0.58,
              top = y > st.yw + (st.yt - st.yw) * 0.55;
            // The bubble: everything ahead of the front door post above the chin line.
            let d = Math.max(17.4 - x, 8.7 + Math.max(0, x - 31) * 0.4 - y);
            if (top && roofGlass) d = Math.min(d, heliRoundRect(x, z, 4.5, 16.4, -3.4, 3.4, 1.3));
            // The rear sliding door's window.
            if (side) d = Math.min(d, heliRoundRect(x, y, 3.5, 15.2, 12.0, 18.3, 1.6));
            // Frames: the canopy arch over the front doors, its roof beam, the nose keel.
            d = Math.max(d, -Math.max(Math.abs(x - 27.45) - 0.32, 9.2 - y));
            d = Math.max(d, -Math.max(az - 0.42, 16.2 - y, x - 27.45));
            d = Math.max(d, -Math.max(az - 1.2, y - 9.3, 34.5 - x));
            return d;
          },
          seams(x, y, z, st) {
            let d = Math.abs(x + 15);
            if (Math.abs(z) > st.w * 0.55 && y > st.yb + 0.4)
              d = Math.min(
                d,
                Math.abs(heliRoundRect(x, y, 16.9, 27.9, 6.6, 19.6, 1.4)),
                Math.abs(heliRoundRect(x, y, 2.8, 16.3, 6.5, 19.5, 1.4)),
                // Baggage door behind the cabin.
                Math.abs(heliRoundRect(x, y, -10.4, -4.4, 11.0, 16.6, 0.8)),
              );
            return d;
          },
          // Soot from the exhaust at the back of the cowl onto the boom root, 0..1.
          soot: (x, y, z, st) => (x < -13 && x > -24 && y > st.yw ? Math.max(0, 1 - Math.abs(z) / 1.4) * Math.min(1, (x + 24) / 6) * 0.6 : 0),
          tops: [
            {
              keys: [[-17.5, 17.5, 0.4], [-15.5, 18.7, 2.0], [-12, 20.8, 3.4], [-7, 22.6, 4.2], [-1, 23.4, 4.5], [6, 23.6, 4.4], [12, 23.2, 3.8], [15.5, 22.0, 2.8], [17.8, 20.6, 0.6]],
              z: 0,
              sink: 1.0,
              // Lofted into the livery (the registration and the aerial ID are painted on it).
              art: true,
            },
          ],
          rotor: { x: 9, y: 26.4, radius: 40, blades: 3, chord: 2.3, root: 3.6, mast: 23.6, droop: 1.3, sweep: 0.5, hub: 2.2, taper: 0.3, park: 0 },
          fenestron: { x: -40.6, y: 15.5, radius: 3.0, blades: 8, shroud: 4.9, thick: 3.2 },
          fin: {
            thick: 1.1,
            // The fenestron tail: the fin above the shroud and the ventral fin under it.
            fenestron: [
              [[-37.2, 18.6], [-41.4, 26.4], [-44.0, 27.2], [-45.3, 26.6], [-45.4, 18.0], [-43.0, 17.0]],
              [[-38.6, 12.0], [-43.6, 8.4], [-45.2, 8.6], [-44.6, 12.4], [-42.0, 12.4]],
            ],
            art: [-47, -34, 7, 29],
          },
          stab: { x: -33.2, y: 15.3, span: 8, chord: 3.2, thick: 0.6, plate: [3.2, 7.2] },
          gear: 'skids',
          seats: { front: 22.5, rear: 8, side: 3.2, rearSides: [-3.4, 0, 3.4] },
          dash: 30.2,
          panel: 4.8,
        };
      }
      // Robinson R44 / R66 class (the civilians): about 9.3 m from the nose to the tail.
      function heliRobinPlan() {
        return {
          name: 'robin',
          widen: 1.08,
          keys: [
            [-45.6, 14.05, 14.45, 14.25, 0.2, 2, 2],
            [-45.0, 13.75, 14.75, 14.25, 0.55, 2, 2],
            [-42, 13.6, 14.85, 14.2, 0.78, 2, 2],
            [-35, 13.3, 14.95, 14.1, 0.95, 2, 2],
            [-25, 12.9, 15.05, 13.95, 1.2, 2, 2],
            [-17, 12.5, 15.15, 13.8, 1.45, 2, 2],
            [-14.5, 11.4, 15.4, 13.5, 1.9, 2.05, 2.05],
            [-12, 9.8, 15.8, 13.1, 2.6, 2.15, 2.15],
            [-8.5, 8.2, 16.3, 12.6, 3.3, 2.2, 2.25],
            [-4.5, 6.9, 16.9, 12.1, 4.0, 2.2, 2.35],
            [-1, 5.8, 17.6, 11.6, 4.7, 2.25, 2.55],
            [4, 5.1, 18.1, 11.2, 5.15, 2.3, 2.75],
            [9, 4.9, 18.3, 10.9, 5.3, 2.3, 2.8],
            [14, 4.8, 18.1, 10.6, 5.25, 2.25, 2.75],
            [18.5, 4.9, 17.3, 10.3, 5.0, 2.2, 2.6],
            [22, 5.3, 16.0, 10.0, 4.5, 2.15, 2.45],
            [25, 6.0, 14.3, 9.7, 3.7, 2.1, 2.3],
            [27.2, 7.0, 12.6, 9.5, 2.6, 2.05, 2.15],
            [28.4, 8.1, 11.0, 9.4, 1.4, 2, 2],
            [28.9, 9.0, 9.9, 9.4, 0.3, 2, 2],
          ],
          marks: [-3.4, -2.4, 8.8, 9.2, 9.8, 10.0, 19.3, 19.6, 20.0, 20.6],
          step: (x) => (x > -15 ? 1.1 : 2.4),
          segments: 44,
          cabin: { back: -3.4, front: 26, floor: 6.3 },
          windows(x, y, z, st, roofGlass = true) {
            const az = Math.abs(z),
              side = az > st.w * 0.58,
              top = y > st.yw + (st.yt - st.yw) * 0.6;
            // The wraparound windscreen ahead of the front door posts.
            let d = Math.max(20.3 - x, 8.6 - y);
            // The tinted roof window over the front seats.
            if (top && roofGlass) d = Math.min(d, heliRoundRect(x, z, 9.6, 19.8, -3.0, 3.0, 1.3));
            if (side) {
              d = Math.min(d, heliRoundRect(x, y, 9.8, 19.4, 10.2, 17.1, 1.5));
              d = Math.min(d, heliRoundRect(x, y, -2.2, 8.9, 10.6, 16.7, 1.6));
            }
            // Frames: the door posts' arch, the windscreen's centre bar.
            d = Math.max(d, -Math.max(Math.abs(x - 20.3) - 0.3, 9.6 - y));
            d = Math.max(d, -Math.max(az - 0.3, 12.2 - y, 27.4 - x));
            return d;
          },
          seams(x, y, z, st) {
            let d = Math.abs(x + 3.8);
            if (Math.abs(z) > st.w * 0.55 && y > st.yb + 0.4)
              d = Math.min(
                d,
                Math.abs(heliRoundRect(x, y, 9.3, 20.0, 5.9, 17.9, 1.4)),
                Math.abs(heliRoundRect(x, y, -2.7, 9.3, 6.0, 17.6, 1.4)),
                // The engine bay's access panel.
                Math.abs(heliRoundRect(x, y, -12.6, -5.2, 9.4, 14.6, 0.7)),
              );
            return d;
          },
          soot: (x, y, z, st) => (x < -8 && x > -18 && y < st.yw && z > 0 ? Math.max(0, 1 - Math.abs(y - st.yw + 1.6) / 2) * Math.min(1, (x + 18) / 6) * 0.5 : 0),
          tops: [
            // The tall mast fairing behind the cabin roof.
            {
              keys: [[-8, 15.8, 0.3], [-6, 17.0, 1.4], [-3, 18.7, 2.3], [1, 20.2, 2.6], [5, 20.9, 2.5], [8, 20.5, 2.0], [10.5, 19.2, 1.1], [12, 18.5, 0.3]],
              z: 0,
              sink: 0.8,
              art: true,
            },
          ],
          rotor: { x: 4, y: 25.6, radius: 38, blades: 2, chord: 2.0, root: 2.8, mast: 20.9, droop: 1.9, sweep: 0, hub: 1.3, taper: 0, park: Math.PI / 2 - 0.3 },
          tailRotor: { x: -45.0, y: 15.6, z: -1.35, radius: 5.6, blades: 2, chord: 0.85, cant: 0 },
          fin: {
            thick: 0.6,
            // The V tail: the upper and lower fins sweeping back from the boom's end.
            rotor: [
              [[-39.6, 14.9], [-44.4, 21.6], [-46.4, 22.0], [-46.0, 15.8], [-43.4, 14.7]],
              [[-40.6, 13.8], [-43.8, 9.3], [-45.4, 9.2], [-45.4, 13.9]],
            ],
            art: [-47, -38, 8.5, 23],
          },
          stab: { x: -36.5, y: 14.3, span: 3.6, chord: 2.4, thick: 0.45, plate: null },
          gear: 'skids',
          seats: { front: 14.2, rear: 4.2, side: 2.55, rearSides: [-2.55, 2.55] },
          dash: 21.4,
          panel: 3.6,
        };
      }
      function heliHawkPlan() {
        return {
          name: 'hawk',
          widen: 1.26,
          keys: [
            [-50.2, 16.9, 18.3, 17.5, 0.3, 2, 2],
            [-49.6, 16.3, 18.7, 17.4, 1.2, 2, 2],
            [-47.5, 15.6, 18.8, 17.2, 1.8, 2.1, 2.1],
            [-43, 15.0, 18.6, 16.8, 2.1, 2.1, 2.1],
            [-36, 14.4, 18.4, 16.4, 2.3, 2.1, 2.1],
            [-28, 13.4, 18.6, 16.0, 2.7, 2.2, 2.2],
            [-20, 12.0, 19.3, 15.4, 3.3, 2.4, 2.5],
            [-14, 9.9, 20.3, 14.4, 4.6, 2.7, 3.0],
            [-8, 7.7, 21.3, 13.2, 6.1, 3.0, 3.5],
            [-2, 6.6, 21.9, 12.4, 6.9, 3.2, 3.8],
            [4, 6.2, 22.1, 12.2, 7.1, 3.3, 4.0],
            [20, 6.2, 22.1, 12.2, 7.1, 3.3, 4.0],
            [28, 6.3, 21.9, 12.0, 6.95, 3.1, 3.8],
            [33, 6.4, 21.1, 11.6, 6.6, 2.8, 3.4],
            [37, 6.5, 18.9, 11.1, 6.05, 2.5, 3.0],
            [41, 6.8, 15.9, 10.7, 5.1, 2.3, 2.6],
            [44, 7.4, 14.0, 10.5, 3.8, 2.2, 2.3],
            [45.6, 8.3, 12.6, 10.4, 2.3, 2, 2],
            [46.4, 9.7, 11.0, 10.3, 0.4, 2, 2],
          ],
          marks: [-14.2, 2.6, 3.4, 9, 16, 17.6, 18.6, 23.4, 24.6, 33.4, 34, 38.6, 40.6],
          step: (x) => (x > -16 ? 1.35 : 2.6),
          segments: 44,
          cabin: { back: 0.4, front: 38, floor: 7.5 },
          windows(x, y, z, st, roofGlass = true) {
            const az = Math.abs(z),
              side = az > st.w * 0.62;
            // Windscreen: two big panels over the nose, a post between them.
            let d = Math.max(33.8 - x, 15.0 - y, x - 40.6);
            if (side) {
              // Cockpit door window and the lower chin window; cabin windows.
              d = Math.min(d, heliRoundRect(x, y, 24.6, 33.2, 12.4, 20.6, 1.0));
              d = Math.min(d, heliRoundRect(x, y, 34.2, 38.8, 9.6, 13.6, 0.9));
              d = Math.min(d, heliRoundRect(x, y, 9.2, 15.9, 13.6, 18.8, 0.9));
              d = Math.min(d, heliRoundRect(x, y, 18.6, 23.4, 13.4, 19.2, 0.9));
            }
            d = Math.max(d, -Math.max(az - 0.55, 14 - y));
            return d;
          },
          seams(x, y, z, st) {
            let d = Math.min(Math.abs(x + 14.2), Math.abs(x + 36));
            if (Math.abs(z) > st.w * 0.6 && y > st.yb + 0.4)
              d = Math.min(
                d,
                Math.abs(heliRoundRect(x, y, 23.9, 33.9, 7.6, 21.1, 1.0)),
                Math.abs(heliRoundRect(x, y, 2.6, 17.6, 7.2, 20.9, 0.5)),
                // The sliding door's rails above and below.
                Math.abs(y - 21.3) + Math.max(0, Math.abs(x - 4) - 14),
                Math.abs(y - 7.0) + Math.max(0, Math.abs(x - 4) - 14),
                Math.abs(heliRoundRect(x, y, -9, -3.6, 11.5, 17.5, 0.6)),
              );
            return d;
          },
          soot: (x, y, z, st) => (x < -8 && x > -30 && y > st.yw ? Math.max(0, 1 - Math.abs(Math.abs(z) - 2.4) / 1.6) * Math.min(1, (x + 30) / 10) : 0),
          tops: [
            // The rotor pylon ("doghouse") and the two engine nacelles beside it.
            {
              keys: [[-13, 20.4, 0.4], [-11.5, 22.6, 2.6], [-6, 24.6, 3.6], [4, 25.4, 4.0], [11, 24.8, 3.7], [15, 23.3, 2.8], [17, 22.4, 0.6]],
              z: 0,
              sink: 1.2,
              swatch: 'cowl',
            },
            ...[-1, 1].map((side) => ({
              keys: [[-13.6, 23.6, 0.4], [-12.4, 23.7, 2.0], [-8, 23.8, 2.6], [2, 23.8, 2.7], [8.6, 23.6, 2.5], [10.4, 23.4, 1.2], [10.9, 23.2, 0.4]],
              z: side * 5.1,
              sink: 0,
              round: true,
              swatch: 'cowl',
            })),
          ],
          rotor: { x: 4, y: 29.4, radius: 47, blades: 4, chord: 3.4, root: 5.2, mast: 25.2, droop: 1.8, sweep: 1.6, hub: 3.2 },
          tailRotor: { x: -47.6, y: 28.6, z: 3.2, radius: 9.2, blades: 4, chord: 1.55, cant: 0.2 },
          fin: {
            thick: 1.9,
            rotor: [[-40.5, 18.6], [-45.8, 35.6], [-50.6, 36.3], [-51.2, 19.8], [-49.8, 16.2], [-44.5, 15.4]],
            art: [-52, -39, 14, 37],
          },
          stab: { x: -47.4, y: 18.2, span: 11.4, chord: 6.2, thick: 0.85, plate: null },
          gear: 'wheels',
          seats: { front: 29.2, rear: 11, side: 3.4, rearSides: [-4.6, -1.5, 1.5, 4.6] },
          dash: 36.4,
        };
      }
      let heliPlanCache = null;
      function heliPlans() {
        if (heliPlanCache) return heliPlanCache;
        heliPlanCache = { colibri: heliColibriPlan(), robin: heliRobinPlan(), hawk: heliHawkPlan() };
        for (const plan of Object.values(heliPlanCache)) {
          const xs = plan.keys.map((k) => k[0]);
          plan.spline = [1, 2, 3, 4, 5, 6].map((i) =>
            heliMonotone(
              xs,
              plan.keys.map((k) => k[i]),
            ),
          );
          // A single fin outline becomes a list of one.
          if (!Array.isArray(plan.fin.rotor?.[0]?.[0])) plan.fin.rotor = plan.fin.rotor && [plan.fin.rotor];
          plan.x0 = xs[0];
          plan.x1 = xs[xs.length - 1];
          for (const top of plan.tops) {
            const keys = top.keys.slice().sort((a, b) => a[0] - b[0]),
              txs = keys.map((k) => k[0]);
            top.yt = heliMonotone(
              txs,
              keys.map((k) => k[1]),
            );
            top.w = heliMonotone(
              txs,
              keys.map((k) => k[2]),
            );
            top.x0 = txs[0];
            top.x1 = txs[txs.length - 1];
          }
        }
        return heliPlanCache;
      }
