      // BEGIN SUBSYSTEM: src/helicopter3d.js — Helicopter models
      /**
       * Helicopter models
       * Source: src/helicopter3d.js
       * Scope: createCityRenderer() closure (included before vehicles3d.js, police3d.js
       * and plane3d.js; nothing here runs before the closure has initialised, so it
       * uses their helpers: the police merging kit, glyph atlas and light shader).
       *
       * Every helicopter except Fort Sentinel's Apache (apache3d.js) is built here, at
       * game scale (8 units to the metre, x forward, y up, z to starboard, the skids or
       * wheels on y = 0). The collision footprint stays the vehicle type's own
       * (vehicleSpec 86 x 34); only the model changed.
       *
       * LOOKS (pickHelicopterLook, cached per vehicle in a WeakMap):
       *   - police: the air unit (c.airUnit) and the machine on the POLICE HQ pad. A
       *     Bell 407 / H125 class light single: SOUTH COAST POLICE in the patrol
       *     cars' modern livery (white, navy swoosh, sky-blue band, reflective silver
       *     line, gold star), AIR 1 big on the roof and POLICE along the tail boom
       *     for the camera above, N-7 on the fin; FLIR ball under the nose, the
       *     Nightsun searchlight on a gimbal under the port side
       *     (HELI_SEARCHLIGHT_MOUNT), wire cutters, PA speaker, red / blue LED bars
       *     along the lower cabin, on the boom and on the fin tip;
       *   - news: the same airframe in CH 7 NEWS white and red with a gyro-stabilised
       *     camera ball on the chin and a downlink dome under the boom (the
       *     RIVERSIDE pad's, and one civilian machine in three);
       *   - executive: glossy metallic paint (a palette, or the vehicle's own colour
       *     after a respray) with gold pinstripes, tan leather, polished skids and a
       *     shrouded fenestron tail fan instead of the open tail rotor;
       *   - military: Fort Sentinel's machines (c.military). A UH-60 Black Hawk class
       *     utility helicopter, scaled into the same footprint: boxy cabin with a
       *     sliding door and gunner windows (M240s on their mounts), twin engines
       *     each side of the rotor pylon with turned-out exhausts, the canted tail
       *     rotor on the starboard side of the tall pylon, the big stabilator,
       *     wheeled main gear and tail wheel, flat olive drab with a black
       *     anti-glare panel, low-visibility U.S. ARMY and serial.
       *
       * CONSTRUCTION (heliKit, once per look; heliPlans for the two airframes):
       *   - the fuselage is one lofted surface (monotone-cubic stations of keel,
       *     crown, widest height, half width and two superellipse exponents). Its
       *     quads are split by the plan's window field (`windows(x, y, z)`, a
       *     signed distance) into painted skin and the flush, transparent canopy:
       *     the bubble, roof and door windows are the fuselage itself;
       *   - the livery is one canvas per look painted per pixel from the same
       *     surface (heliLiveryTexture): paint scheme, black window seals over the
       *     glass edge, door seams, belly grime and exhaust soot; the bottom quarter
       *     holds the fin art and flat swatches for the cowling, stabiliser and
       *     endplates. Words and numbers are glyph quads laid on the surface from
       *     the police glyph atlas (crisp at any zoom, one shared material);
       *   - inside: a dark liner and floor seen through the glass, instrument
       *     panel with lit screens, seats, sticks, and the crew (pilot on the
       *     right, observer on the left) shown only while somebody flies it;
       *   - trim (skids and arched cross tubes, steps, exhaust, grilles, antennas,
       *     sensors, gear), interior, decals and every lamp lens are each merged
       *     into one vertex-coloured mesh. About 15 draw calls for a whole
       *     helicopter, against ~35 for the old box model.
       *
       * ROTORS: four blades with twist, taper, swept tips, droop at rest and tip
       *   paint, on a hub with grips, pitch links and a swashplate. Spinning up
       *   (~4 s) and coasting down (~9 s) follow `m.rpm`; past half speed the solid
       *   blades give way to a translucent disc shaded with blade ghosts that trail
       *   round it (HELI DISC shader), and the blades keep casting their shadow (a
       *   depth-only material), so a faint flicker of blades crosses the ground. The
       *   tail rotor (or the fenestron fan) blurs the same way.
       *
       * LIGHTS: every lens is one mesh on the police light shader with its own
       *   eight channel levels (HELI_CH): red / green / white navigation, double-
       *   flash white strobes, the red anti-collision beacons, landing lights and
       *   the Nightsun lens, the police red / blue pattern (policeLightLevels). Lit
       *   channels queue halos (VEHICLE HALOS) from hidden anchor sprites.
       *
       * ANIMATION (animateHelicopter, from the render3d.js vehicle pass): rotor and
       *   tail spin with the spool, the body pitches with speed and acceleration
       *   (a flare on braking) and banks with the turn rate, a fine vibration rides
       *   on top, the crew appear with a pilot, the Nightsun head turns towards
       *   what the crew are looking at, glass sooting with wear; a wreck's rotor
       *   stops, its disc is gone and its hub sits askew.
       *   helicopterSearchlightMount(c, out) gives the searchlight's lens position in
       *   world space for searchlight3d.js.
       */
      const HELI_TEX_W = 1024,
        HELI_TEX_H = 512,
        // Share of the livery canvas (from the bottom) for the fin art and swatches.
        HELI_BAND = 0.25,
        HELI_LOFT_ROWS = Math.round(HELI_TEX_H * (1 - HELI_BAND)),
        HELI_SWATCH = { top: 0, lower: 1, accent: 2, cowl: 3, stab: 4, plate: 5, dark: 6, metal: 7 },
        // Light channels of the lens mesh (police light shader: eight levels per model).
        HELI_CH = { red: 0, blue: 1, navRed: 2, navGreen: 3, navWhite: 4, strobe: 5, beacon: 6, work: 7 },
        // The police Nightsun's lens in model space (x forward, y up, z to starboard):
        // under the port side of the cabin, just behind the door post.
        HELI_SEARCHLIGHT_MOUNT = Object.freeze({ x: 16.5, y: 3.7, z: -5.8 }),
        // Main rotor at full speed (radians per second of the model), tail rotor.
        HELI_SPIN = 55,
        HELI_TAIL_SPIN = 160;
      const HELI_LOOKS = {
        police: {
          livery: 'police',
          airframe: 'light',
          tail: 'rotor',
          finish: { roughness: 0.3, metalness: 0.06, clearcoat: 1 },
          glass: '#0a141d',
          liner: '#26292e',
          seat: '#2a2d33',
          skid: '#202226',
          suit: '#1f2838',
          helmet: '#1c2946',
          blade: '#2a2d31',
          tip: '#e6dfbf',
          reflective: true,
        },
        news: {
          livery: 'news',
          airframe: 'light',
          tail: 'rotor',
          finish: { roughness: 0.26, metalness: 0.08, clearcoat: 1 },
          glass: '#0c1823',
          liner: '#2b2e33',
          seat: '#30343a',
          skid: '#9ca2a8',
          suit: '#3a434f',
          helmet: '#e2e2dc',
          blade: '#2a2d31',
          tip: '#e6dfbf',
        },
        executive: {
          livery: 'executive',
          airframe: 'light',
          tail: 'fenestron',
          finish: { roughness: 0.14, metalness: 0.5, clearcoat: 1 },
          glass: '#0d1115',
          liner: '#6f6356',
          seat: '#a37d56',
          skid: '#b9bec3',
          suit: '#23272d',
          helmet: '#2b2f34',
          blade: '#2c2f33',
          tip: '#d9d9d4',
        },
        military: {
          livery: 'military',
          airframe: 'hawk',
          tail: 'rotor',
          finish: { roughness: 0.88, metalness: 0.03, clearcoat: 0 },
          glass: '#121b1e',
          liner: '#3e4136',
          seat: '#5a5941',
          skid: '#2f322c',
          suit: '#4d5341',
          helmet: '#3f4537',
          blade: '#2c2f2b',
          tip: '#d9c24c',
        },
      };
      const HELI_EXECUTIVE_PAINTS = ['#18253c', '#111316', '#4b1521', '#e7e4dd', '#373d45'];
      // ---- Which model ----------------------------------------------------------------
      // Cached per vehicle, never stored on it (every vehicle keeps one object layout);
      // `heliLook` on a vehicle is only set by DeadEndCity.helicopterLineup for review.
      const heliLooks = new WeakMap();
      function helicopterLookFor(c) {
        let look = heliLooks.get(c);
        if (!look) {
          look = pickHelicopterLook(c);
          heliLooks.set(c, look);
        }
        return look;
      }
      function pickHelicopterLook(c) {
        const hash = Math.imul(c.id + 7, 2654435761) >>> 0;
        let kind = HELI_LOOKS[c.heliLook] ? c.heliLook : null;
        if (!kind) {
          if (c.airUnit || c.cop) kind = 'police';
          else if (c.military) kind = 'military';
          else {
            const pad = HELIPADS.find((p) => Math.hypot(p.x - c.x, p.y - c.y) < 120);
            kind = pad?.name === 'POLICE HQ' ? 'police' : pad?.name === 'RIVERSIDE' ? 'news' : (hash >>> 9) % 3 === 0 ? 'news' : 'executive';
          }
        }
        const stock = VEHICLE_DEFINITIONS.helicopter.color,
          own = c.color && c.color !== stock && c.color !== '#d9e1df' ? c.color : null;
        let paint = null;
        if (kind === 'executive') paint = own || HELI_EXECUTIVE_PAINTS[(hash >>> 13) % HELI_EXECUTIVE_PAINTS.length];
        else if (kind === 'military') paint = own || '#4d5641';
        return { ...HELI_LOOKS[kind], kind, paint, key: kind + ':' + (paint || '') };
      }
      // ---- Airframe plans ---------------------------------------------------------------
      function heliRoundRect(px, py, x0, x1, y0, y1, r) {
        const qx = Math.abs(px - (x0 + x1) / 2) - ((x1 - x0) / 2 - r),
          qy = Math.abs(py - (y0 + y1) / 2) - ((y1 - y0) / 2 - r);
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      }
      /*
       * Stations are [x, keel, crown, widest height, half width, upper exponent,
       * lower exponent], tail to nose. `windows(x, y, z, st)` is a signed distance to
       * the glazing (negative on glass), `seams` the distance to a panel seam.
       */
      function heliLightPlan() {
        return {
          name: 'light',
          keys: [
            [-48.3, 15.4, 15.9, 15.65, 0.25, 2, 2],
            [-47.7, 15.0, 16.3, 15.65, 0.9, 2, 2],
            [-45.5, 14.7, 16.55, 15.6, 1.3, 2, 2],
            [-40, 14.3, 16.8, 15.55, 1.65, 2, 2],
            [-30, 13.6, 17.0, 15.3, 2.1, 2, 2],
            [-21, 13.0, 17.3, 15.1, 2.45, 2.05, 2.05],
            [-17.5, 12.3, 17.6, 14.7, 3.0, 2.1, 2.2],
            [-14, 10.6, 18.2, 14.0, 4.1, 2.2, 2.5],
            [-10, 8.6, 18.9, 13.4, 5.4, 2.25, 2.8],
            [-5, 7.0, 19.5, 12.8, 6.6, 2.3, 3.1],
            [1, 6.4, 19.8, 12.4, 7.2, 2.3, 3.2],
            [8, 6.1, 20.0, 12.2, 7.5, 2.3, 3.2],
            [16, 6.0, 20.0, 12.0, 7.6, 2.3, 3.2],
            [24, 6.1, 19.9, 11.8, 7.6, 2.3, 3.1],
            [29, 6.2, 19.5, 11.5, 7.4, 2.25, 3.0],
            [33, 6.4, 18.8, 11.3, 6.9, 2.2, 2.8],
            [36, 6.8, 17.8, 11.2, 6.2, 2.15, 2.6],
            [38.5, 7.4, 16.6, 11.1, 5.1, 2.1, 2.4],
            [40.2, 8.2, 15.2, 11.1, 3.8, 2.05, 2.2],
            [41.3, 9.0, 13.9, 11.1, 2.6, 2, 2.1],
            [42.0, 9.9, 12.6, 11.1, 1.4, 2, 2],
            [42.3, 10.9, 11.3, 11.1, 0.3, 2, 2],
          ],
          // Extra sample planes along x (window and door edges), sample step.
          marks: [-17.3, 0.8, 1.8, 13.4, 14.1, 14.8, 15.6, 17.4, 26.6, 27.6, 27.9, 28.4, 32],
          step: (x) => (x > -18 ? 1.05 : 2.2),
          segments: 52,
          cabin: { back: -0.6, front: 36, floor: 7.4 },
          windows(x, y, z, st) {
            const az = Math.abs(z),
              side = az > st.w * 0.6,
              top = y > st.yw + (st.yt - st.yw) * 0.55;
            // The bubble: everything ahead of the door post above the chin line.
            let d = Math.max(28.4 - x, 8.9 - y);
            if (top) d = Math.min(d, heliRoundRect(x, z, 17.4, 27.6, -3.7, 3.7, 1.3));
            if (side) {
              d = Math.min(d, heliRoundRect(x, y, 15.6, 26.6, 10.3, 18.5, 1.6));
              d = Math.min(d, heliRoundRect(x, y, 1.8, 13.4, 11.2, 18.3, 1.9));
            }
            // Frames: the windscreen post and roof beam, the chin bar, the nose keel.
            d = Math.max(d, -Math.max(az - 0.45, 11.4 - y, 17 - x));
            d = Math.max(d, -Math.max(Math.abs(y - 11.05) - 0.3, 32 - x));
            d = Math.max(d, -Math.max(az - 1.9, y - 11.05));
            return d;
          },
          seams(x, y, z, st) {
            let d = Math.abs(x + 17.3);
            if (Math.abs(z) > st.w * 0.55 && y > st.yb + 0.4)
              d = Math.min(
                d,
                Math.abs(heliRoundRect(x, y, 14.8, 27.9, 6.9, 19.4, 1.4)),
                Math.abs(heliRoundRect(x, y, 0.8, 14.1, 6.9, 19.3, 1.4)),
                // Baggage door behind the cabin.
                Math.abs(heliRoundRect(x, y, -9.6, -3.4, 10.4, 15.8, 0.8)),
              );
            return d;
          },
          // Soot from the exhaust along the top of the boom, 0..1.
          soot: (x, y, z, st) => (x < -12 && x > -34 && y > st.yw ? Math.max(0, 1 - Math.abs(z) / 1.6) * Math.min(1, (x + 34) / 10) * 0.9 : 0),
          tops: [
            {
              keys: [[-19.4, 17.6, 0.35], [-18.6, 18.2, 1.6], [-16, 20.3, 3.4], [-13, 21.8, 4.4], [-9, 22.8, 5.0], [-3, 23.4, 5.3], [3, 23.5, 5.3], [9, 22.9, 4.9], [12, 21.6, 3.6], [13.6, 20.1, 1.2]],
              z: 0,
              sink: 1.1,
              swatch: 'cowl',
            },
          ],
          rotor: { x: 2, y: 26.9, radius: 43, blades: 4, chord: 2.5, root: 4.4, mast: 23.2, droop: 1.4, sweep: 0.6, hub: 2.6 },
          tailRotor: { x: -44.3, y: 20.2, z: -2.35, radius: 6.6, blades: 2, chord: 1.05, cant: 0 },
          fenestron: { x: -44.9, y: 17.9, radius: 4.3 },
          fin: {
            thick: 1.1,
            rotor: [[-38.4, 16.9], [-44.5, 27.1], [-47.9, 27.4], [-47.5, 16.6], [-47.1, 9.9], [-45.3, 9.5], [-41.4, 14.3]],
            fenestron: [[-37.6, 16.9], [-42.2, 24.0], [-44.7, 29.2], [-48.4, 29.5], [-49.9, 19.2], [-49.4, 13.2], [-46.8, 11.6], [-41.6, 14.2]],
            art: [-50.5, -36.5, 9, 30],
          },
          stab: { x: -29.5, y: 15.95, span: 10.3, chord: 4.6, thick: 0.72, plate: [4.6, 3.9] },
          gear: 'skids',
          seats: { front: 21, rear: 7.2, side: 3.3, rearSides: [-3.5, 0, 3.5] },
          dash: 31.3,
        };
      }
      function heliHawkPlan() {
        return {
          name: 'hawk',
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
          step: (x) => (x > -16 ? 1.1 : 2.2),
          segments: 52,
          cabin: { back: 0.4, front: 38, floor: 7.5 },
          windows(x, y, z, st) {
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
        heliPlanCache = { light: heliLightPlan(), hawk: heliHawkPlan() };
        for (const plan of Object.values(heliPlanCache)) {
          const xs = plan.keys.map((k) => k[0]);
          plan.spline = [1, 2, 3, 4, 5, 6].map((i) =>
            heliMonotone(
              xs,
              plan.keys.map((k) => k[i]),
            ),
          );
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
      // ---- Surface maths ------------------------------------------------------------------
      // Monotone cubic interpolation (Fritsch-Carlson): smooth, never overshoots.
      function heliMonotone(xs, ys) {
        const n = xs.length,
          d = [],
          m = new Array(n);
        for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
        m[0] = d[0];
        m[n - 1] = d[n - 2];
        for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
        for (let i = 0; i < n - 1; i++) {
          if (d[i] === 0) {
            m[i] = m[i + 1] = 0;
            continue;
          }
          const a = m[i] / d[i],
            b = m[i + 1] / d[i],
            s = a * a + b * b;
          if (s > 9) {
            const t = 3 / Math.sqrt(s);
            m[i] = t * a * d[i];
            m[i + 1] = t * b * d[i];
          }
        }
        return (x) => {
          if (x <= xs[0]) return ys[0];
          if (x >= xs[n - 1]) return ys[n - 1];
          let i = 0;
          while (x > xs[i + 1]) i++;
          const h = xs[i + 1] - xs[i],
            t = (x - xs[i]) / h,
            t2 = t * t,
            t3 = t2 * t;
          return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
        };
      }
      function heliStation(plan, x) {
        const s = plan.spline;
        return { x, yb: s[0](x), yt: s[1](x), yw: s[2](x), w: Math.max(0.02, s[3](x)), nu: s[4](x), nl: s[5](x) };
      }
      // A section point at `theta` (-PI/2 the keel, 0 starboard, PI/2 the crown).
      function heliSection(st, theta, out) {
        const c = Math.cos(theta),
          s = Math.sin(theta),
          upper = s >= 0,
          e = 2 / (upper ? st.nu : st.nl);
        out.z = st.w * Math.sign(c) * Math.pow(Math.abs(c), e);
        out.y = st.yw + (upper ? st.yt - st.yw : st.yw - st.yb) * Math.sign(s) * Math.pow(Math.abs(s), e);
        return out;
      }
      // The section angle at height y on one side (inverse of heliSection).
      function heliSideTheta(st, y, side) {
        const upper = y >= st.yw,
          h = Math.max(1e-4, upper ? st.yt - st.yw : st.yw - st.yb),
          s = Math.sign(y - st.yw) * Math.pow(Math.min(1, Math.abs(y - st.yw) / h), (upper ? st.nu : st.nl) / 2),
          t = Math.asin(s);
        return side >= 0 ? t : Math.PI - t;
      }
      const heliScratch = { y: 0, z: 0 };
      function heliSurfaceZ(st, y, side) {
        return heliSection(st, heliSideTheta(st, y, side), heliScratch).z;
      }
      function heliSurfaceTop(st, z) {
        const c = Math.pow(Math.min(1, Math.abs(z) / st.w), st.nu / 2),
          s = Math.sqrt(Math.max(0, 1 - c * c));
        return st.yw + (st.yt - st.yw) * Math.pow(s, 2 / st.nu);
      }
      // Sample planes along x: every key and mark, then no further apart than `step`.
      function heliSamples(plan) {
        const marks = [...new Set([...plan.keys.map((k) => k[0]), ...plan.marks])].sort((a, b) => a - b),
          xs = [];
        for (let i = 0; i < marks.length - 1; i++) {
          const a = marks[i],
            b = marks[i + 1],
            n = Math.max(1, Math.ceil((b - a) / plan.step((a + b) / 2)));
          for (let k = 0; k < n; k++) xs.push(a + ((b - a) * k) / n);
        }
        xs.push(marks[marks.length - 1]);
        return xs;
      }
      /*
       * A lofted grid: rows at `xs`, `segments` + 1 columns round each ring (the last
       * repeats the first for the texture seam). Normals come from the surface's
       * partial derivatives, so the seam and the tips shade smoothly.
       */
      function heliLoftGrid(stationAt, xs, segments) {
        const rows = xs.length,
          cols = segments + 1,
          P = new Float32Array(rows * cols * 3),
          N = new Float32Array(rows * cols * 3),
          pt = { y: 0, z: 0 },
          a = new Three.Vector3(),
          b = new Three.Vector3(),
          tx = new Three.Vector3(),
          tr = new Three.Vector3(),
          n = new Three.Vector3(),
          at = (x, theta, out) => {
            heliSection(stationAt(x), theta, pt);
            return out.set(x, pt.y, pt.z);
          };
        for (let i = 0; i < rows; i++) {
          const x = xs[i],
            st = stationAt(x),
            hx = Math.max(0.04, (xs[Math.min(rows - 1, i + 1)] - xs[Math.max(0, i - 1)]) * 0.2);
          for (let j = 0; j < cols; j++) {
            const theta = (j / segments) * TAU - Math.PI / 2,
              k = (i * cols + j) * 3;
            heliSection(st, theta, pt);
            P[k] = x;
            P[k + 1] = pt.y;
            P[k + 2] = pt.z;
            const ht = (TAU / segments) * 0.35;
            tr.subVectors(at(x, theta + ht, a), at(x, theta - ht, b));
            tx.subVectors(at(x + hx, theta, a), at(x - hx, theta, b));
            n.crossVectors(tx, tr);
            if (n.lengthSq() < 1e-10 || tr.lengthSq() < 1e-8) n.set(Math.sign(x - (xs[0] + xs[rows - 1]) / 2), 0, 0);
            n.normalize();
            N[k] = n.x;
            N[k + 1] = n.y;
            N[k + 2] = n.z;
          }
        }
        return { P, N, rows, cols, xs };
      }
      // ---- Merge helpers (police3d.js MERGING KIT underneath) ---------------------------------
      const heliMatrix = new Three.Matrix4(),
        heliQuat = new Three.Quaternion(),
        heliUp = new Three.Vector3(0, 1, 0),
        heliV1 = new Three.Vector3(),
        heliV2 = new Three.Vector3(),
        heliColor = new Three.Color();
      // Raw triangles into a merge set: positions / normals as flat arrays.
      function heliPushVertex(set, x, y, z, nx, ny, nz, u, v, color, channel = 0) {
        set.position.push(x, y, z);
        set.normal.push(nx, ny, nz);
        set.uv.push(u, v);
        set.color.push(color.r, color.g, color.b);
        set.channel.push(channel);
        return set.count++;
      }
      // A cylinder (or any unit shape along y) from a to b.
      function heliRod(set, a, b, r, color, geo = cylinderGeo, rz = r) {
        heliV1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = heliV1.length();
        if (length < 1e-4) return;
        heliQuat.setFromUnitVectors(heliUp, heliV1.divideScalar(length));
        heliMatrix.compose(heliV2.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), heliQuat, new Three.Vector3(r, length, rz));
        policeAddMatrix(set, geo, heliMatrix, color);
      }
      // A tube along a smooth curve through `points` ([x, y, z] each).
      function heliTube(set, points, r, color, segments = 24) {
        const curve = new Three.CatmullRomCurve3(points.map((p) => new Three.Vector3(p[0], p[1], p[2]))),
          tube = new Three.TubeGeometry(curve, segments, r, 8, false);
        policeAddMatrix(set, tube, heliMatrix.identity(), color);
        tube.dispose();
      }
      /*
       * A closed sweep through rings of points (each ring the same count, a closed
       * loop); both ends capped. Normals are averaged, so it shades smoothly.
       */
      function heliSweep(rings) {
        const count = rings[0].length,
          positions = [],
          indices = [];
        for (const ring of rings) for (const p of ring) positions.push(p[0], p[1], p[2]);
        for (let i = 0; i < rings.length - 1; i++)
          for (let j = 0; j < count; j++) {
            const a = i * count + j,
              b = (i + 1) * count + j,
              c = (i + 1) * count + ((j + 1) % count),
              d = i * count + ((j + 1) % count);
            indices.push(a, b, c, a, c, d);
          }
        for (const [k, flip] of [
          [0, true],
          [rings.length - 1, false],
        ]) {
          const ring = rings[k],
            centre = ring.reduce((s, p) => [s[0] + p[0] / count, s[1] + p[1] / count, s[2] + p[2] / count], [0, 0, 0]),
            base = positions.length / 3;
          positions.push(...centre);
          for (const p of ring) positions.push(p[0], p[1], p[2]);
          for (let j = 0; j < count; j++) {
            const p0 = base + 1 + j,
              p1 = base + 1 + ((j + 1) % count);
            if (flip) indices.push(base, p0, p1);
            else indices.push(base, p1, p0);
          }
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
      }
      function heliAddSweep(set, rings, color) {
        const geo = heliSweep(rings);
        policeAddMatrix(set, geo, heliMatrix.identity(), color);
        geo.dispose();
      }
      // ---- Shared materials --------------------------------------------------------------------
      let heliShared = null;
      function heliMaterials() {
        if (heliShared) return heliShared;
        heliShared = {
          trim: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }),
          metal: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }),
          interior: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 }),
          blade: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }),
          // Spinning blades still throw their shadow but draw nothing (the disc shows them).
          shadowOnly: new Three.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
          halos: {},
          glass: {},
          discGeometry: new Three.CircleGeometry(1, 72),
        };
        for (const m of [heliShared.trim, heliShared.metal, heliShared.interior, heliShared.blade, heliShared.shadowOnly]) sharedMaterials.add(m);
        sharedGeometries.add(heliShared.discGeometry);
        return heliShared;
      }
      // Anchor sprites for the halo pass share one material per colour (never drawn).
      function heliHaloMaterial(color) {
        const M = heliMaterials();
        if (!M.halos[color]) {
          M.halos[color] = new Three.SpriteMaterial({ color });
          sharedMaterials.add(M.halos[color]);
        }
        return M.halos[color];
      }
      // Tinted, reflective glass; each model owns a copy (it soots with the wear).
      function heliGlassMaterial(tint) {
        const M = heliMaterials();
        if (!M.glass[tint]) {
          M.glass[tint] = new Three.MeshStandardMaterial({
            color: tint,
            roughness: 0.04,
            metalness: 0.82,
            envMapIntensity: 1.9,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
          });
          sharedMaterials.add(M.glass[tint]);
        }
        return M.glass[tint];
      }
      const heliLightGain = { value: 3.4 };
      function heliLightMaterial() {
        return new Three.ShaderMaterial({
          uniforms: { ...Three.UniformsUtils.clone(Three.UniformsLib.fog), levels: { value: new Float32Array(8) }, gain: heliLightGain },
          vertexShader: POLICE_LIGHT_VERTEX,
          fragmentShader: POLICE_LIGHT_FRAGMENT,
          vertexColors: true,
          fog: true,
        });
      }
      /*
       * HELI DISC: the blur of a spinning rotor. A flat disc (radius 1, scaled) whose
       * alpha is a light even smear, `uBlades` ghosts trailing behind their leading
       * edges (a trail of equal arc length at every radius, like a real blade seen at
       * a long exposure), the tip paint as a ring, a clear hub and a soft rim. The
       * ghosts drift round at `uPhase`.
       */
      const HELI_DISC_VERTEX = `
        #include <common>
        #include <fog_pars_vertex>
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
        HELI_DISC_FRAGMENT = `
        #include <common>
        #include <fog_pars_fragment>
        uniform float uBlur;
        uniform float uPhase;
        uniform float uBlades;
        uniform float uHub;
        uniform float uTip;
        uniform float uTrail;
        uniform float uSmear;
        uniform vec3 uColor;
        uniform vec3 uTipColor;
        varying vec2 vPos;
        void main() {
          float r = length( vPos );
          float rim = 1.0 - smoothstep( 0.985, 1.0, r );
          float hub = smoothstep( uHub, uHub + 0.05, r );
          float spacing = 6.28318530718 / uBlades;
          float a = atan( vPos.y, vPos.x ) - uPhase;
          float sector = fract( a / spacing );
          // Arc (in radii) behind and ahead of the nearest blade at this radius.
          float behind = ( 1.0 - sector ) * spacing * r;
          float ahead = sector * spacing * r;
          float ghost = exp( -behind / uTrail ) + exp( -ahead / ( uTrail * 0.12 ) );
          float tip = smoothstep( uTip - 0.01, uTip + 0.005, r );
          float alpha = uBlur * rim * hub * ( uSmear * ( 0.75 + 0.25 * r ) + 0.2 * ghost + 0.12 * tip );
          gl_FragColor = vec4( mix( uColor, uTipColor, tip ), alpha );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`;
      function heliDiscMaterial(o) {
        return new Three.ShaderMaterial({
          uniforms: {
            ...Three.UniformsUtils.clone(Three.UniformsLib.fog),
            uBlur: { value: 0 },
            uPhase: { value: 0 },
            uBlades: { value: o.blades },
            uHub: { value: o.hub },
            uTip: { value: o.tip },
            uTrail: { value: o.trail },
            uSmear: { value: o.smear },
            uColor: { value: new Three.Color(o.color) },
            uTipColor: { value: new Three.Color(o.tipColor) },
          },
          vertexShader: HELI_DISC_VERTEX,
          fragmentShader: HELI_DISC_FRAGMENT,
          transparent: true,
          depthWrite: false,
          side: Three.DoubleSide,
          fog: true,
        });
      }
      // ---- Livery ----------------------------------------------------------------------------
      const heliHex = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      // Coverage of a signed distance (negative inside) over about a texel.
      const heliCover = (d, aa = 0.1) => Math.min(1, Math.max(0, 0.5 - d / aa));
      function heliMix(out, rgb, k) {
        if (k <= 0) return;
        out[0] += (rgb[0] - out[0]) * k;
        out[1] += (rgb[1] - out[1]) * k;
        out[2] += (rgb[2] - out[2]) * k;
      }
      function heliShade(out, f) {
        out[0] *= f;
        out[1] *= f;
        out[2] *= f;
      }
      // A cheap value noise for weathering (0..1).
      function heliNoise(x, y) {
        const xi = Math.floor(x),
          yi = Math.floor(y),
          fx = x - xi,
          fy = y - yi,
          h = (i, j) => {
            const n = Math.sin((xi + i) * 127.1 + (yi + j) * 311.7) * 43758.5453;
            return n - Math.floor(n);
          },
          sx = fx * fx * (3 - 2 * fx),
          sy = fy * fy * (3 - 2 * fy);
        return (h(0, 0) * (1 - sx) + h(1, 0) * sx) * (1 - sy) + (h(0, 1) * (1 - sx) + h(1, 1) * sx) * sy;
      }
      /*
       * Paint schemes: `body(out, x, y, z, st)` writes the colour of the skin at a
       * point, `fin(out, x, y)` the fin's, `swatches` the flat parts' (HELI_SWATCH
       * order), `badges(g, map)` draws emblems with canvas paths through the surface
       * mapping, `decals(add)` lays the words and numbers.
       */
      function heliScheme(look) {
        const WHITE = [239, 241, 242],
          NAVY = [19, 41, 92],
          SKY = [63, 143, 217],
          SILVER = [214, 222, 229],
          DARK = [16, 17, 20],
          METAL = [150, 156, 162];
        if (look.livery === 'police') {
          const line = heliMonotone([-48, -24, -17, -10, -2, 8, 18, 30, 43], [14.95, 14.7, 13.9, 11.2, 8.4, 7.65, 8.1, 8.9, 9.5]);
          return {
            body(out, x, y, z, st) {
              const y0 = line(x),
                band = Math.min(1, Math.max(0.42, st.w / 7.6));
              out[0] = WHITE[0];
              out[1] = WHITE[1];
              out[2] = WHITE[2];
              heliMix(out, SILVER, heliCover(Math.max(y0 + 0.95 * band - y, y - y0 - 1.28 * band)));
              heliMix(out, SKY, heliCover(Math.max(y0 - y, y - y0 - 0.95 * band)));
              heliMix(out, NAVY, heliCover(y - y0));
            },
            fin(out, x, y) {
              out[0] = NAVY[0];
              out[1] = NAVY[1];
              out[2] = NAVY[2];
              heliMix(out, SKY, heliCover(Math.abs(y - 13.4 - (x + 50) * 0.75) - 0.55, 0.15));
            },
            swatches: [WHITE, NAVY, SKY, WHITE, WHITE, NAVY, DARK, METAL],
            badges(g, map) {
              for (const side of [-1, 1]) heliStarBadge(g, map, -6.8, 14.7, side, 2.3, '#13295c', '#c9a44a', 7);
            },
            decals(add) {
              add('AIR 1', { surface: 'top', x: 19.6, z: 0, height: 5.4, color: '#13295c' });
              add('POLICE', { surface: 'top', x: -29.2, z: 0, height: 3.2, color: '#13295c' });
              for (const side of [-1, 1]) {
                add('POLICE', { surface: 'side', side, x: 7.4, y: 9.95, height: 1.9, color: '#13295c' });
                add('SOUTH COAST', { surface: 'side', side, x: -30.5, y: 16.05, height: 1.15, color: '#13295c' });
                add('N-7', { surface: 'fin', side, x: -44.6, y: 21.5, height: 2.6, color: '#f2f4f6' });
                add('911', { surface: 'side', side, x: -7.2, y: 11.4, height: 0.9, color: '#13295c' });
              }
            },
          };
        }
        if (look.livery === 'news') {
          const RED = [196, 30, 42],
            BLUE = [16, 32, 74],
            line = heliMonotone([-48, -20, -12, -2, 10, 26, 43], [14.9, 14.5, 12.4, 9.3, 8.5, 9.1, 10.2]);
          return {
            body(out, x, y, z, st) {
              const y0 = line(x),
                band = Math.min(1, Math.max(0.42, st.w / 7.6));
              out[0] = WHITE[0];
              out[1] = WHITE[1];
              out[2] = WHITE[2];
              heliMix(out, BLUE, heliCover(Math.max(y0 + 0.3 * band - y, y - y0 - 0.95 * band)));
              heliMix(out, RED, heliCover(y - y0));
            },
            fin(out, x, y) {
              out[0] = RED[0];
              out[1] = RED[1];
              out[2] = RED[2];
              heliMix(out, WHITE, heliCover(Math.abs(y - 12.6 - (x + 50) * 0.75) - 0.35, 0.15));
            },
            swatches: [WHITE, RED, BLUE, WHITE, WHITE, RED, DARK, METAL],
            badges(g, map) {
              for (const side of [-1, 1]) heliRoundel(g, map, -6.6, 14.3, side, 2.5, '#c41e2a', '#ffffff');
            },
            decals(add) {
              add('7 NEWS', { surface: 'top', x: 19.6, z: 0, height: 5.0, color: '#c41e2a' });
              add('CH 7', { surface: 'top', x: -29.2, z: 0, height: 3.2, color: '#10204a' });
              for (const side of [-1, 1]) {
                add('7', { surface: 'side', side, x: -6.6, y: 14.3, height: 3.3, color: '#ffffff' });
                add('CH 7 NEWS', { surface: 'side', side, x: 7.4, y: 9.95, height: 1.75, color: '#10204a' });
                add('SKY 7', { surface: 'side', side, x: -30.5, y: 16.05, height: 1.15, color: '#c41e2a' });
                add('N7NW', { surface: 'fin', side, x: -44.6, y: 21.2, height: 1.9, color: '#ffffff' });
              }
            },
          };
        }
        if (look.livery === 'executive') {
          const P = heliHex(look.paint),
            light = P[0] + P[1] + P[2] > 480,
            STRIPE = light ? [150, 124, 62] : [201, 164, 74],
            BELLY = P.map((v) => v * 0.78),
            line = heliMonotone([-48, -18, -10, 0, 12, 28, 43], [15.55, 15.1, 13.4, 10.9, 10.35, 10.3, 10.8]);
          return {
            body(out, x, y, z, st) {
              const y0 = line(x),
                band = Math.min(1, Math.max(0.42, st.w / 7.6));
              out[0] = P[0];
              out[1] = P[1];
              out[2] = P[2];
              heliMix(out, BELLY, heliCover(y - (y0 - 1.6 * band), 0.4));
              heliMix(out, STRIPE, heliCover(Math.abs(y - y0) - 0.09 * band, 0.06));
              heliMix(out, STRIPE, heliCover(Math.abs(y - y0 - 0.5 * band) - 0.05 * band, 0.06));
            },
            fin(out, x, y) {
              out[0] = P[0];
              out[1] = P[1];
              out[2] = P[2];
              heliMix(out, STRIPE, heliCover(Math.abs(y - 13.8 - (x + 50) * 0.5) - 0.12, 0.08));
            },
            swatches: [P, BELLY, STRIPE, P, P, P, DARK, METAL],
            badges() {},
            decals(add) {
              const ink = light ? '#1b1d21' : '#d8c07a';
              for (const side of [-1, 1]) add('N407EX', { surface: 'side', side, x: -30.2, y: 15.9, height: 1.4, color: ink });
            },
          };
        }
        // Military: flat olive drab with a faint mottle, black anti-glare, low-vis marks.
        const OD = heliHex(look.paint),
          BLACK = [26, 28, 24],
          OD_DARK = OD.map((v) => v * 0.8);
        return {
          body(out, x, y, z, st) {
            const mottle = 0.94 + 0.1 * heliNoise(x * 0.18, (y + z) * 0.18) + 0.03 * heliNoise(x * 1.3, (y - z) * 1.3);
            out[0] = OD[0] * mottle;
            out[1] = OD[1] * mottle;
            out[2] = OD[2] * mottle;
            // The anti-glare panel on top of the nose ahead of the windscreen.
            heliMix(out, BLACK, heliCover(Math.max(34.4 - x, st.yw + (st.yt - st.yw) * 0.45 - y, Math.abs(z) - st.w * 0.82), 0.12));
          },
          fin(out, x, y) {
            const mottle = 0.94 + 0.1 * heliNoise(x * 0.18, y * 0.18);
            out[0] = OD[0] * mottle;
            out[1] = OD[1] * mottle;
            out[2] = OD[2] * mottle;
          },
          swatches: [OD, OD_DARK, OD, OD, OD, OD, BLACK, [96, 98, 90]],
          badges(g, map) {
            for (const side of [-1, 1]) heliStarBadge(g, map, 6.8, 11.2, side, 1.9, null, 'rgba(24,26,22,0.85)', 5, true);
          },
          decals(add) {
            for (const side of [-1, 1]) {
              add('U.S. ARMY', { surface: 'side', side, x: -27, y: 16.6, height: 1.6, color: '#1b1d19' });
              add('20-27115', { surface: 'fin', side, x: -46.6, y: 24.5, height: 1.2, color: '#1b1d19' });
            }
            add('ARMY', { surface: 'top', x: -27, z: 0, height: 2.8, color: '#23251f' });
          },
        };
      }
      // A star in a ring on the side (canvas paths through the surface mapping).
      function heliStarBadge(g, map, x, y, side, r, ring, star, points, outline = false) {
        const [cx, cy, sx, sy] = map(x, y, side);
        g.save();
        g.translate(cx, cy);
        g.scale(sx, sy);
        if (ring) {
          g.fillStyle = ring;
          g.beginPath();
          g.arc(0, 0, r, 0, TAU);
          g.fill();
          g.fillStyle = '#e8e8e4';
          g.beginPath();
          g.arc(0, 0, r * 0.84, 0, TAU);
          g.fill();
        }
        g.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const a = Math.PI / 2 + (i * Math.PI) / points,
            k = (i % 2 ? 0.45 : 1) * r * (ring ? 0.76 : 1);
          g.lineTo(Math.cos(a) * k, Math.sin(a) * k);
        }
        g.closePath();
        if (outline) {
          g.strokeStyle = star;
          g.lineWidth = 0.28;
          g.stroke();
          g.beginPath();
          g.arc(0, 0, r * 1.18, 0, TAU);
          g.stroke();
        } else {
          g.fillStyle = star;
          g.fill();
          g.strokeStyle = 'rgba(80,60,20,0.8)';
          g.lineWidth = 0.08;
          g.stroke();
        }
        g.restore();
      }
      function heliRoundel(g, map, x, y, side, r, fill, ring) {
        const [cx, cy, sx, sy] = map(x, y, side);
        g.save();
        g.translate(cx, cy);
        g.scale(sx, sy);
        g.fillStyle = ring;
        g.beginPath();
        g.arc(0, 0, r * 1.1, 0, TAU);
        g.fill();
        g.fillStyle = fill;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.fill();
        g.restore();
      }
      /*
       * The livery canvas: the loft (top three quarters: u along x, v round the
       * ring from the keel) painted per pixel from the surface, then the fin art and
       * the swatches in the bottom quarter, then the emblems.
       */
      const heliLiveryTextures = new Map();
      function heliLiveryTexture(look, plan, scheme) {
        let texture = heliLiveryTextures.get(look.key);
        if (texture) return texture;
        const canvas = document.createElement('canvas');
        canvas.width = HELI_TEX_W;
        canvas.height = HELI_TEX_H;
        const g = canvas.getContext('2d'),
          image = g.createImageData(HELI_TEX_W, HELI_TEX_H),
          data = image.data,
          span = plan.x1 - plan.x0,
          columns = [],
          out = [0, 0, 0],
          pt = { y: 0, z: 0 },
          SEAL = [15, 17, 20];
        for (let px = 0; px < HELI_TEX_W; px++) columns.push(heliStation(plan, plan.x0 + ((px + 0.5) / HELI_TEX_W) * span));
        for (let py = 0; py < HELI_LOFT_ROWS; py++) {
          const vTex = 1 - (py + 0.5) / HELI_TEX_H,
            theta = ((vTex - HELI_BAND) / (1 - HELI_BAND)) * TAU - Math.PI / 2;
          for (let px = 0; px < HELI_TEX_W; px++) {
            const st = columns[px],
              x = st.x;
            heliSection(st, theta, pt);
            const y = pt.y,
              z = pt.z;
            scheme.body(out, x, y, z, st);
            // Belly grime and exhaust soot.
            const low = Math.min(1, Math.max(0, (st.yw - y) / Math.max(0.5, st.yw - st.yb)));
            heliShade(out, 1 - 0.1 * low * low - 0.3 * plan.soot(x, y, z, st) * (look.kind === 'military' ? 1.3 : 1));
            // Panel seams, then the black rubber seals round the glazing.
            heliShade(out, 1 - 0.32 * heliCover(plan.seams(x, y, z, st) - 0.06, 0.06));
            heliMix(out, SEAL, heliCover(plan.windows(x, y, z, st) - 0.95, 0.12));
            const k = (py * HELI_TEX_W + px) * 4;
            data[k] = out[0];
            data[k + 1] = out[1];
            data[k + 2] = out[2];
            data[k + 3] = 255;
          }
        }
        // Fin art: the left half of the bottom band.
        const [fx0, fx1, fy0, fy1] = plan.fin.art;
        for (let py = HELI_LOFT_ROWS; py < HELI_TEX_H; py++)
          for (let px = 0; px < HELI_TEX_W / 2; px++) {
            const x = fx0 + ((px + 0.5) / (HELI_TEX_W / 2)) * (fx1 - fx0),
              y = fy0 + ((HELI_TEX_H - py - 0.5) / (HELI_TEX_H - HELI_LOFT_ROWS)) * (fy1 - fy0);
            scheme.fin(out, x, y);
            const k = (py * HELI_TEX_W + px) * 4;
            data[k] = out[0];
            data[k + 1] = out[1];
            data[k + 2] = out[2];
            data[k + 3] = 255;
          }
        g.putImageData(image, 0, 0);
        scheme.swatches.forEach((rgb, i) => {
          g.fillStyle = `rgb(${rgb.map(Math.round).join(',')})`;
          g.fillRect(HELI_TEX_W / 2 + (i * HELI_TEX_W) / 16, HELI_LOFT_ROWS, HELI_TEX_W / 16, HELI_TEX_H - HELI_LOFT_ROWS);
        });
        // Emblems: a local linear map from side (x, y) to canvas pixels.
        const pixel = (x, y, side) => {
            const st = heliStation(plan, x),
              ring = (((heliSideTheta(st, y, side) + Math.PI / 2) / TAU) % 1 + 1) % 1;
            return [((x - plan.x0) / span) * HELI_TEX_W, (1 - (HELI_BAND + (1 - HELI_BAND) * ring)) * HELI_TEX_H];
          },
          map = (x, y, side) => {
            const c = pixel(x, y, side),
              ax = pixel(x + 0.5, y, side),
              ay = pixel(x, y + 0.5, side);
            return [c[0], c[1], (ax[0] - c[0]) * 2, (ay[1] - c[1]) * 2];
          };
        scheme.badges(g, map);
        texture = policeCanvasTexture(canvas);
        heliLiveryTextures.set(look.key, texture);
        return texture;
      }
      const heliSwatchUv = (name) => [0.5 + (HELI_SWATCH[name] + 0.5) / 16, HELI_BAND / 2];
      // ---- Words and numbers on the skin (police glyph atlas) -------------------------------
      function heliText(set, plan, text, o) {
        const atlas = policeGlyphs(),
          h = o.height,
          gap = h * 0.06,
          chars = [...text],
          advance = (ch) => (ch === ' ' ? 0.34 : atlas.advance[ch] || 0) * h,
          quad = (GLYPH_CELL_W / GLYPH_CELL_H) * h,
          lift = 0.07;
        let total = -gap;
        for (const ch of chars) total += advance(ch) + gap;
        let cursor = -total / 2;
        heliColor.set(o.color);
        for (const ch of chars) {
          const i = POLICE_GLYPHS.indexOf(ch);
          if (i >= 0) {
            const u0 = ((i % GLYPHS_PER_ROW) * GLYPH_CELL_W) / 1024,
              u1 = u0 + GLYPH_CELL_W / 1024,
              v1 = 1 - (Math.floor(i / GLYPHS_PER_ROW) * GLYPH_CELL_H) / atlas.height,
              v0 = v1 - GLYPH_CELL_H / atlas.height,
              centre = cursor + advance(ch) / 2,
              base = set.count;
            for (const [a, b] of [
              [-0.5, -0.5],
              [0.5, -0.5],
              [0.5, 0.5],
              [-0.5, 0.5],
            ]) {
              const along = centre + a * quad,
                up = b * h;
              let x, y, z, nx, ny, nz;
              if (o.surface === 'top') {
                // Along the airframe, glyphs standing towards port: reads heading east.
                x = o.x + along;
                z = o.z - up;
                y = heliSurfaceTop(heliStation(plan, x), z) + lift;
                nx = 0;
                ny = 1;
                nz = 0;
              } else {
                x = o.x + o.side * along;
                y = o.y + up;
                z = o.surface === 'fin' ? o.side * (plan.fin.thick / 2 + 0.36) : heliSurfaceZ(heliStation(plan, x), y, o.side) + o.side * lift;
                nx = 0;
                ny = 0;
                nz = o.side;
              }
              heliPushVertex(set, x, y, z, nx, ny, nz, a < 0 ? u0 : u1, b < 0 ? v0 : v1, heliColor);
            }
            set.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
          cursor += advance(ch) + gap;
        }
      }
      // ---- The kit: every shared geometry of one look ------------------------------------------
      const heliKits = new Map();
      function heliKit(look) {
        if (heliKits.has(look.key)) return heliKits.get(look.key);
        const plan = heliPlans()[look.airframe],
          S = policeShapeKit(),
          col = (hex) => heliColor.set(hex).clone(),
          paint = policeSet(),
          glass = policeSet(),
          interior = policeSet(),
          trim = policeSet(),
          metal = policeSet(),
          lights = policeSet(),
          anchors = [],
          xs = heliSamples(plan),
          stationAt = (x) => heliStation(plan, x),
          grid = heliLoftGrid(stationAt, xs, plan.segments),
          liner = col(look.liner);
        // ---- Fuselage: painted skin and flush glazing from one loft ----
        const { P, N, rows, cols } = grid,
          span = plan.x1 - plan.x0,
          vertexOf = (set, i, j, uvOn) => {
            const k = (i * cols + j) * 3;
            return heliPushVertex(set, P[k], P[k + 1], P[k + 2], N[k], N[k + 1], N[k + 2], uvOn ? (P[k] - plan.x0) / span : 0, uvOn ? HELI_BAND + ((1 - HELI_BAND) * j) / (cols - 1) : 0, liner);
          };
        const skinBase = paint.count;
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) vertexOf(paint, i, j, true);
        const cabin = plan.cabin,
          probe = { y: 0, z: 0 };
        for (let i = 0; i < rows - 1; i++)
          for (let j = 0; j < cols - 1; j++) {
            const a = i * cols + j,
              b = (i + 1) * cols + j,
              c = (i + 1) * cols + j + 1,
              d = i * cols + j + 1,
              cx = (P[a * 3] + P[c * 3]) / 2,
              cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1] + P[d * 3 + 1]) / 4,
              cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2] + P[d * 3 + 2]) / 4,
              st = stationAt(cx);
            if (plan.windows(cx, cy, cz, st) < 0) {
              const g0 = vertexOf(glass, i, j),
                g1 = vertexOf(glass, i + 1, j),
                g2 = vertexOf(glass, i + 1, j + 1),
                g3 = vertexOf(glass, i, j + 1);
              glass.index.push(g0, g1, g2, g0, g2, g3);
              continue;
            }
            paint.index.push(skinBase + a, skinBase + b, skinBase + c, skinBase + a, skinBase + c, skinBase + d);
            // The cabin's liner: the skin seen from inside, a little in and facing in.
            if (cx > cabin.back && cy > cabin.floor - 0.4) {
              const base = interior.count;
              for (const q of [a, d, c, b]) {
                const k = q * 3;
                heliPushVertex(interior, P[k] - N[k] * 0.3, P[k + 1] - N[k + 1] * 0.3, P[k + 2] - N[k + 2] * 0.3, -N[k], -N[k + 1], -N[k + 2], 0, 0, liner);
              }
              interior.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
          }
        // End caps (tiny: the loft closes almost to a point at both ends).
        for (const [i, dir] of [
          [0, -1],
          [rows - 1, 1],
        ]) {
          const k0 = i * cols * 3,
            centre = heliPushVertex(paint, P[k0] + dir * 0.12, stationAt(P[k0]).yw, 0, dir, 0, 0, (P[k0] - plan.x0) / span, HELI_BAND + (1 - HELI_BAND) / 2, liner);
          for (let j = 0; j < cols - 1; j++) {
            const p0 = skinBase + i * cols + j,
              p1 = p0 + 1;
            if (dir > 0) paint.index.push(p1, p0, centre);
            else paint.index.push(p0, p1, centre);
          }
        }
        probe.y = 0;
        // ---- Floor and the bulkhead behind the cabin ----
        {
          const floorColor = col('#1c1e21'),
            y = cabin.floor,
            fx = xs.filter((x) => x >= cabin.back && x <= cabin.front);
          let prev = null;
          for (const x of fx) {
            const st = stationAt(x);
            if (y <= st.yb + 0.2) continue;
            const half = Math.max(0, heliSurfaceZ(st, y, 1) - 0.35),
              left = heliPushVertex(interior, x, y, -half, 0, 1, 0, 0, 0, floorColor),
              right = heliPushVertex(interior, x, y, half, 0, 1, 0, 0, 0, floorColor);
            if (prev) interior.index.push(prev[0], right, left, prev[0], prev[1], right);
            prev = [left, right];
          }
          const st = stationAt(cabin.back),
            centre = heliPushVertex(interior, cabin.back, st.yw, 0, 1, 0, 0, 0, 0, liner),
            ring = [];
          for (let j = 0; j <= 32; j++) {
            heliSection(st, (j / 32) * TAU - Math.PI / 2, probe);
            ring.push(heliPushVertex(interior, cabin.back, probe.y * 0.97 + st.yw * 0.03, probe.z * 0.95, 1, 0, 0, 0, 0, liner));
          }
          for (let j = 0; j < 32; j++) interior.index.push(centre, ring[j + 1], ring[j]);
        }
        // ---- Cowlings / nacelles on top (flat swatch colour) ----
        for (const top of plan.tops) {
          const uv = heliSwatchUv(top.swatch),
            txs = [];
          for (let k = 0; k <= 26; k++) txs.push(top.x0 + ((top.x1 - top.x0) * k) / 26);
          const topStation = (x) => {
              const crown = top.yt(x),
                w = Math.max(0.03, top.w(x));
              if (top.round) {
                const r = Math.max(0.03, crown - (23.8 - 2.7));
                return { x, yb: crown - 2 * Math.min(w, r), yt: crown, yw: crown - Math.min(w, r), w, nu: 2, nl: 2 };
              }
              const floor = stationAt(x).yt - top.sink;
              return { x, yb: floor - 0.6, yt: Math.max(crown, floor + 0.2), yw: floor + 0.35 * Math.max(0.2, crown - floor), w, nu: 2.6, nl: 2 };
            },
            tg = heliLoftGrid(topStation, txs, 28),
            base = paint.count,
            white = col('#ffffff');
          for (let i = 0; i < tg.rows; i++)
            for (let j = 0; j < tg.cols; j++) {
              const k = (i * tg.cols + j) * 3;
              heliPushVertex(paint, tg.P[k], tg.P[k + 1], tg.P[k + 2] + top.z, tg.N[k], tg.N[k + 1], tg.N[k + 2], uv[0], uv[1], white);
            }
          for (let i = 0; i < tg.rows - 1; i++)
            for (let j = 0; j < tg.cols - 1; j++) {
              const a = base + i * tg.cols + j,
                b = a + tg.cols;
              paint.index.push(a, b, b + 1, a, b + 1, a + 1);
            }
        }
        // ---- Fin (with the fenestron's duct), stabiliser and endplates ----
        const fenestron = look.tail === 'fenestron' && plan.fenestron;
        {
          const outline = fenestron ? plan.fin.fenestron : plan.fin.rotor,
            shape = new Three.Shape(outline.map(([x, y]) => new Three.Vector2(x, y)));
          if (fenestron) {
            const hole = new Three.Path();
            hole.absarc(fenestron.x, fenestron.y, fenestron.radius, 0, TAU, true);
            shape.holes.push(hole);
          }
          const t = plan.fin.thick,
            fin = new Three.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2, curveSegments: 20 });
          fin.translate(0, 0, -t / 2);
          const [fx0, fx1, fy0, fy1] = plan.fin.art,
            pos = fin.attributes.position,
            uvs = fin.attributes.uv;
          for (let k = 0; k < pos.count; k++) uvs.setXY(k, (0.005 + (0.49 * (pos.getX(k) - fx0)) / (fx1 - fx0)) * 1, 0.005 + (0.24 * (pos.getY(k) - fy0)) / (fy1 - fy0));
          policeAddMatrix(paint, fin, heliMatrix.identity(), '#ffffff');
          fin.dispose();
          if (fenestron) {
            // The duct's lining and the fan's stators and hub inside it.
            const duct = new Three.CylinderGeometry(fenestron.radius, fenestron.radius, t + 0.5, 32, 1, true);
            duct.rotateX(Math.PI / 2);
            duct.translate(fenestron.x, fenestron.y, 0);
            policeAddMatrix(trim, duct, heliMatrix.identity(), '#2a2d31');
            duct.dispose();
            for (let s = 0; s < 3; s++) {
              const a = 0.4 + (s * TAU) / 3;
              heliRod(trim, [fenestron.x, fenestron.y, 0.35], [fenestron.x + Math.cos(a) * fenestron.radius, fenestron.y + Math.sin(a) * fenestron.radius, 0.35], 0.22, '#3a3d42', boxGeo, 0.5);
            }
            policeAdd(trim, S.cylinder, fenestron.x, fenestron.y, 0.3, 1.3, 1.1, 1.3, '#3a3d42', null, Math.PI / 2);
          }
        }
        {
          const s = plan.stab,
            stab = roundedBar(s.span * 2, s.thick, s.chord, s.thick * 0.48);
          policeAdd(paint, stab, s.x, s.y, 0, 1, 1, 1, '#ffffff', { uv: heliSwatchUv('stab') }, 0, 0, 0);
          if (s.plate)
            for (const side of [-1, 1]) {
              const plate = roundedBar(0.38, s.plate[1], s.plate[0], 0.18);
              policeAdd(paint, plate, s.x - 0.5, s.y + 0.5, side * (s.span + 0.12), 1, 1, 1, '#ffffff', { uv: heliSwatchUv('plate') });
            }
        }
        // ---- Airframe equipment, interior, crew ----
        const crew = { pilot: policeSet(), observer: policeSet() },
          kitParts = { plan, look, S, col, paint, glass, interior, trim, metal, lights, anchors, crew, stationAt };
        if (plan.name === 'light') heliLightEquipment(kitParts);
        else heliHawkEquipment(kitParts);
        heliCabin(kitParts);
        // ---- Decals ----
        const scheme = heliScheme(look),
          decals = policeSet();
        scheme.decals((text, o) => heliText(decals, plan, text, o));
        // ---- Rotors ----
        const rotor = heliRotorParts(plan.rotor, look, look.kind === 'military'),
          tail = fenestron ? heliFenestronParts(fenestron, look) : heliTailRotorParts(plan.tailRotor, look);
        const kit = {
          plan,
          scheme,
          fenestron,
          paint: policeGeometry(paint, { colors: false }),
          glass: policeGeometry(glass, { colors: false }),
          interior: policeGeometry(interior),
          pilot: policeGeometry(crew.pilot),
          observer: policeGeometry(crew.observer),
          trim: policeGeometry(trim),
          metal: metal.count ? policeGeometry(metal) : null,
          lights: policeGeometry(lights, { channels: true }),
          decals: policeGeometry(decals),
          anchors,
          rotor,
          tail,
          nightsun: kitParts.nightsun || null,
        };
        heliKits.set(look.key, kit);
        return kit;
      }
      // ---- Light single (Bell 407 / H125 class) equipment ----------------------------------------
      function heliLightEquipment(k) {
        const { plan, look, S, trim, metal, lights, anchors, stationAt } = k,
          skid = look.skid,
          dark = '#1a1c1f',
          grey = '#3a3e43',
          police = look.kind === 'police',
          news = look.kind === 'news';
        // Skids with upturned toes, arched cross tubes, saddles, steps and wear shoes.
        for (const side of [-1, 1]) {
          const z = side * 9.3;
          heliTube(trim, [[-15.8, 1.2, z], [-14.6, 0.95, z], [8, 0.95, z], [20.8, 0.95, z], [23.9, 1.6, z], [25.6, 3.3, z]], 0.5, skid, 40);
          policeAdd(trim, S.sphere, -15.9, 1.2, z, 0.5, 0.5, 0.5, skid);
          for (const x of [-10, 4, 17]) policeAdd(trim, boxGeo, x, 0.42, z, 3.4, 0.22, 0.7, '#55595e');
          for (const x of [14.2, -4.6]) {
            policeAdd(trim, boxGeo, x, 1.25, z, 2.2, 0.9, 1.2, skid);
            policeAdd(trim, boxGeo, x + 1.6, 4.1, side * 8.35, 2.4, 0.22, 1.5, '#474b50');
          }
        }
        for (const x of [14.2, -4.6])
          heliTube(
            trim,
            [[x, 1.1, -9.3], [x, 3.8, -9.15], [x, 5.3, -7.9], [x, 5.55, -4.2], [x, 5.55, 0], [x, 5.55, 4.2], [x, 5.3, 7.9], [x, 3.8, 9.15], [x, 1.1, 9.3]],
            0.58,
            skid,
            36,
          );
        // Engine cowling: intake grilles, the exhaust stack, the mast fairing.
        for (const side of [-1, 1]) {
          policeAdd(trim, boxGeo, 2.2, 21.4, side * 5.18, 6, 1.4, 0.14, dark);
          policeAdd(trim, boxGeo, -9.2, 21.4, side * 4.85, 4.2, 1.1, 0.14, dark);
          for (let g = 0; g < 5; g++) policeAdd(trim, boxGeo, -0.2 + g * 1.2, 21.4, side * 5.24, 0.12, 1.3, 0.1, '#52565b');
        }
        heliRod(metal, [-12.6, 21.4, 0.9], [-14.6, 23.4, 0.9], 1.05, '#4a4d51', S.cylinder, 1.35);
        heliRod(trim, [-14.5, 23.3, 0.9], [-14.75, 23.55, 0.9], 0.85, '#0c0c0d', S.cylinder, 1.15);
        policeAdd(trim, S.cylinder, plan.rotor.x, 23.7, 0, 1.7, 0.9, 1.7, grey);
        policeAdd(metal, S.cylinder, plan.rotor.x, 24.55, 0, 2.3, 0.4, 2.3, '#7c8288');
        policeAdd(trim, boxGeo, plan.rotor.x - 1.9, 24.9, 0, 0.9, 1.1, 0.5, grey);
        // Antennas, pitot, GPS, door handles.
        policeAdd(trim, boxGeo, -38.3, 17.8, 0, 1.4, 1.9, 0.14, dark, null, 0, 0, 0.35);
        policeAdd(trim, S.sphere, -11.4, 22.6, 0, 0.9, 0.35, 0.9, '#e4e4e0');
        policeAdd(trim, boxGeo, -24, 12.9, 0, 1.6, 1.7, 0.14, dark, null, 0, 0, -0.35);
        heliRod(trim, [8, 5.8, 1.5], [6, 3.9, 1.5], 0.09, dark);
        heliRod(metal, [27.4, 20.2, 1.3], [30.2, 20.3, 1.3], 0.1, '#9aa0a6');
        for (const side of [-1, 1])
          for (const [x, y] of [
            [16.4, 12.5],
            [2.4, 12.8],
          ]) {
            const z = heliSurfaceZ(stationAt(x), y, side) + side * 0.12;
            policeAdd(metal, boxGeo, x, y, z, 1.3, 0.3, 0.2, '#b7bcc1');
          }
        // Tail: gearbox, tail skid, the drive cover on the fin.
        if (look.tail !== 'fenestron') {
          const t = plan.tailRotor;
          policeAdd(trim, boxGeo, t.x, t.y, -1.05, 2.2, 2.4, 1.3, grey);
          policeAdd(trim, S.cylinder, t.x, t.y, t.z * 0.62, 0.55, 1.3, 0.55, grey, null, Math.PI / 2);
          heliRod(trim, [-45.6, 10.1, 0], [-48.7, 8.3, 0], 0.28, skid);
        } else heliRod(trim, [-48.6, 13.4, 0], [-50.6, 11.3, 0], 0.28, skid);
        // Wire strike cutters (police), roof and chin.
        if (police) {
          policeAdd(trim, boxGeo, 29.6, 20.6, 0, 3.4, 0.9, 0.16, '#2b2e32', null, 0, 0, -0.35);
          policeAdd(trim, boxGeo, 40.6, 7.9, 0, 2.6, 0.7, 0.16, '#2b2e32', null, 0, 0, 0.5);
        }
        // Sensors: police FLIR ball and Nightsun bracket; the news camera ball.
        if (police) {
          policeAdd(trim, boxGeo, 37.2, 6.6, 0, 1.4, 1.2, 1.4, grey);
          policeAdd(trim, S.sphere, 37.4, 5.1, 0, 1.6, 1.6, 1.6, '#c9ccd0');
          policeAdd(trim, boxGeo, 38.9, 5.0, 0, 0.35, 1.5, 2.1, '#0a0d11');
          policeAdd(trim, S.sphere, 39.05, 5.4, 0.45, 0.3, 0.35, 0.35, '#3d6c8c');
          policeAdd(trim, boxGeo, 37.4, 5.1, 0, 0.8, 3.4, 0.4, '#b5b8bc');
          const m = HELI_SEARCHLIGHT_MOUNT;
          heliRod(trim, [m.x, 6.3, m.z + 1.4], [m.x, m.y + 1.2, m.z], 0.35, grey, boxGeo);
          policeAdd(trim, boxGeo, m.x, m.y + 1.25, m.z, 1.6, 0.4, 1.6, grey);
          // PA speaker under the starboard cabin.
          policeAdd(trim, boxGeo, 4.5, 5.35, 5.8, 2.4, 1.3, 1.6, '#23262a');
          policeAdd(trim, boxGeo, 5.75, 5.35, 5.8, 0.1, 1.0, 1.3, '#4c5055');
          k.nightsun = heliNightsunParts(S);
        }
        if (news) {
          policeAdd(trim, boxGeo, 37.8, 6.7, 0, 1.8, 1.3, 1.8, grey);
          policeAdd(trim, S.sphere, 38.1, 4.5, 0, 2.05, 2.05, 2.05, '#e8e8e4');
          policeAdd(trim, boxGeo, 40.0, 4.4, 0, 0.4, 1.4, 1.6, '#08090b');
          policeAdd(trim, S.sphere, 40.15, 4.4, 0, 0.35, 0.55, 0.55, '#2f5d82');
          policeAdd(trim, S.sphere, -24.5, 13.2, 0, 2.1, 0.95, 1.5, '#e8e8e4');
        }
        // ---- Lamps: navigation, strobes, beacons, landing lights, police LEDs ----
        const s = plan.stab,
          lens = (ch, color, x, y, z, sx, sy, sz, geo = S.sphere) => policeAdd(lights, geo, x, y, z, sx, sy, sz, color, { channel: ch });
        for (const side of [-1, 1]) {
          const z = side * (s.span + 0.42),
            navColor = side < 0 ? '#ff3a2c' : '#3dff79';
          lens(side < 0 ? HELI_CH.navRed : HELI_CH.navGreen, navColor, s.x + 1.2, s.y + 0.5, z, 0.55, 0.5, 0.35);
          lens(HELI_CH.strobe, '#ffffff', s.x - 1.6, s.y + 0.5, z, 0.45, 0.4, 0.32);
          anchors.push({ x: s.x + 1.4, y: s.y + 0.5, z: z + side * 0.3, size: 7, color: navColor, channel: side < 0 ? HELI_CH.navRed : HELI_CH.navGreen, strength: 1 });
          anchors.push({ x: s.x - 1.6, y: s.y + 0.5, z: z + side * 0.3, size: 18, color: '#ffffff', channel: HELI_CH.strobe, strength: 1 });
        }
        const tailX = look.tail === 'fenestron' ? -50.2 : -48.25;
        lens(HELI_CH.navWhite, '#fff6e6', tailX, 16.2, 0, 0.4, 0.45, 0.45);
        anchors.push({ x: tailX - 0.3, y: 16.2, z: 0, size: 7, color: '#fff4e0', channel: HELI_CH.navWhite, strength: 1 });
        // Red anti-collision beacons: on the cowl behind the rotor and on the belly.
        for (const [x, y, sy] of [
          [-16.3, 20.35, 0.4],
          [3, 5.75, -0.4],
        ]) {
          lens(HELI_CH.beacon, '#ff2a1e', x, y, 0, 0.7, 0.5, 0.7, S.dome);
          anchors.push({ x, y: y + sy, z: 0, size: 12, color: '#ff3326', channel: HELI_CH.beacon, strength: 1 });
        }
        // Landing and taxi lights under the nose.
        for (const z of [-1.5, 1.5]) {
          lens(HELI_CH.work, '#fff8e8', 30.5, 6.05, z, 0.8, 0.3, 0.8);
          anchors.push({ x: 31, y: 5.7, z, size: 13, color: '#fff3d6', channel: HELI_CH.work, strength: 0.8 });
        }
        if (police) {
          // Red (port) and blue (starboard) LED bars along the lower cabin, pods on
          // the boom and a pair on the fin tip.
          for (const side of [-1, 1]) {
            const ch = side < 0 ? HELI_CH.red : HELI_CH.blue,
              color = side < 0 ? '#ff2d22' : '#2f62ff';
            for (let x = 5; x <= 17; x += 3) {
              const z = heliSurfaceZ(stationAt(x), 7.7, side) + side * 0.1;
              lens(ch, color, x, 7.7, z, 2.4, 0.42, 0.24, boxGeo);
              if (x % 6 === 5) anchors.push({ x, y: 7.7, z: z + side * 0.4, size: 10, color, channel: ch, strength: 1 });
            }
            const bz = heliSurfaceZ(stationAt(-26.5), 15.1, side) + side * 0.15;
            lens(ch, color, -26.5, 15.1, bz, 1.6, 0.55, 0.3, boxGeo);
            anchors.push({ x: -26.5, y: 15.1, z: bz + side * 0.4, size: 9, color, channel: ch, strength: 1 });
          }
          lens(HELI_CH.red, '#ff2d22', -45.4, 27.35, 0, 0.9, 0.45, 0.7, boxGeo);
          lens(HELI_CH.blue, '#2f62ff', -47.2, 27.6, 0, 0.9, 0.45, 0.7, boxGeo);
          anchors.push({ x: -45.4, y: 27.9, z: 0, size: 12, color: '#ff2d22', channel: HELI_CH.red, strength: 1 });
          anchors.push({ x: -47.2, y: 28.1, z: 0, size: 12, color: '#2f62ff', channel: HELI_CH.blue, strength: 1 });
        } else {
          lens(HELI_CH.beacon, '#ff2a1e', look.tail === 'fenestron' ? -46.6 : -46.3, look.tail === 'fenestron' ? 29.6 : 27.6, 0, 0.6, 0.45, 0.6, S.dome);
          anchors.push({ x: look.tail === 'fenestron' ? -46.6 : -46.3, y: look.tail === 'fenestron' ? 30.1 : 28.1, z: 0, size: 12, color: '#ff3326', channel: HELI_CH.beacon, strength: 1 });
        }
      }
      // The police Nightsun: head on a yaw / pitch gimbal, pointing along +x.
      function heliNightsunParts(S) {
        const head = policeSet(),
          lens = policeSet();
        policeAdd(head, S.cylinder, 0.2, 0, 0, 1.25, 3.4, 1.25, '#2b2e33', null, 0, 0, Math.PI / 2);
        policeAdd(head, S.cylinder, 1.95, 0, 0, 1.45, 0.45, 1.45, '#6c7177', null, 0, 0, Math.PI / 2);
        policeAdd(head, S.sphere, -1.5, 0, 0, 0.9, 1.0, 1.0, '#2b2e33');
        policeAdd(head, boxGeo, 0, 1.25, 0, 0.8, 0.9, 0.5, '#44484d');
        policeAdd(lens, S.disc, 2.2, 0, 0, 1.2, 1.2, 1, '#fff6e2', { channel: HELI_CH.work }, 0, Math.PI / 2, 0);
        return { head: policeGeometry(head), lens: policeGeometry(lens, { channels: true }) };
      }
      // ---- Utility (UH-60 Black Hawk class) equipment -------------------------------------------
      function heliHawkEquipment(k) {
        const { plan, look, S, trim, metal, lights, anchors, stationAt } = k,
          dark = '#1c1e1b',
          grey = '#3c4039',
          od = look.paint;
        // Main gear: struts from the sponsons, drag beams, wheels; the tail wheel.
        for (const side of [-1, 1]) {
          const z = side * 9.4;
          policeAdd(trim, boxGeo, 13, 8.2, side * 7.4, 6.5, 2.2, 1.6, od);
          heliRod(metal, [13.6, 8.1, side * 7.6], [12.4, 3.6, z], 0.55, '#7d8279');
          heliRod(trim, [18.5, 7.3, side * 6.8], [12.6, 3.8, z - side * 0.6], 0.4, grey);
          policeAdd(trim, wheelGeo, 12.4, 3.3, z, 3.3, 2.2, 3.3, '#161716', null, Math.PI / 2);
          policeAdd(metal, S.cylinder, 12.4, 3.3, z + side * 1.15, 1.6, 0.3, 1.6, '#8a8f86', null, Math.PI / 2);
        }
        heliRod(trim, [-40, 15.2, 0], [-41.8, 3.6, 0], 0.5, grey);
        policeAdd(trim, wheelGeo, -41.8, 2.3, 0, 2.3, 1.4, 2.3, '#161716', null, Math.PI / 2);
        policeAdd(trim, boxGeo, -41.8, 3.2, 0, 1.2, 1.5, 2.4, grey);
        // Engines: intakes, the turned-out exhaust suppressors, the rotor mast base.
        for (const side of [-1, 1]) {
          const z = side * 5.1;
          policeAdd(trim, S.cylinder, 11.0, 23.2, z, 2.0, 0.35, 2.0, dark, null, 0, 0, Math.PI / 2);
          policeAdd(metal, S.sphere, 11.2, 23.2, z, 0.8, 0.8, 0.8, '#5c6059');
          policeAdd(trim, boxGeo, -15.4, 23.4, z + side * 0.9, 4.4, 2.4, 3.2, grey, null, side * 0.25, side * 0.45, 0);
          policeAdd(trim, boxGeo, -17.3, 23.6, z + side * 2.0, 0.4, 1.9, 2.5, '#0b0c0b', null, side * 0.25, side * 0.45, 0);
        }
        policeAdd(trim, S.cylinder, plan.rotor.x, 25.9, 0, 2.0, 1.2, 2.0, grey);
        policeAdd(metal, S.cylinder, plan.rotor.x, 26.9, 0, 2.7, 0.45, 2.7, '#7c8279');
        // IR jammer behind the pylon, antennas, cable cutters, steps and handholds.
        policeAdd(trim, S.cylinder, -14.4, 22.6, 0, 1.3, 2.6, 1.3, dark);
        policeAdd(trim, S.sphere, -14.4, 24.0, 0, 1.3, 0.6, 1.3, '#23261f');
        policeAdd(trim, boxGeo, -31, 19.3, 0, 1.5, 2.2, 0.15, dark, null, 0, 0, 0.35);
        policeAdd(trim, boxGeo, 22, 22.6, 0, 1.5, 1.6, 0.15, dark, null, 0, 0, 0.35);
        policeAdd(trim, boxGeo, 38.2, 20.8, 0, 3.6, 1.1, 0.18, '#2b2e2a', null, 0, 0, -0.4);
        policeAdd(trim, boxGeo, 44.3, 7.4, 0, 3.2, 0.8, 0.18, '#2b2e2a', null, 0, 0, 0.55);
        for (const side of [-1, 1]) {
          const z = heliSurfaceZ(stationAt(29), 9.2, side) + side * 0.2;
          policeAdd(trim, boxGeo, 29, 9.2, z, 1.6, 0.3, 0.6, dark);
          // The sliding door's rail fairing above the door.
          const rz = heliSurfaceZ(stationAt(8), 21.3, side) + side * 0.12;
          policeAdd(trim, boxGeo, 5.5, 21.3, rz, 26, 0.35, 0.25, grey);
          // M240 on the gunner's window mount.
          const gz = heliSurfaceZ(stationAt(21), 15.5, side) + side * 0.6;
          policeAdd(trim, boxGeo, 21, 15.4, gz, 2.2, 0.8, 0.7, '#1b1c1a');
          heliRod(trim, [22, 15.5, gz + side * 0.2], [26.6, 15.2, gz + side * 1.7], 0.22, '#141514');
        }
        // Tail rotor gearbox and drive fairing on the pylon.
        const t = plan.tailRotor;
        policeAdd(trim, boxGeo, t.x, t.y, 0.8, 2.6, 2.8, 1.6, grey);
        policeAdd(trim, S.cylinder, t.x, t.y, t.z * 0.7, 0.7, 1.2, 0.7, grey, null, Math.PI / 2);
        // ---- Lamps ----
        const lens = (ch, color, x, y, z, sx, sy, sz, geo = S.sphere) => policeAdd(lights, geo, x, y, z, sx, sy, sz, color, { channel: ch });
        for (const side of [-1, 1]) {
          const z = heliSurfaceZ(stationAt(19), 21, side) + side * 0.25,
            navColor = side < 0 ? '#ff3a2c' : '#3dff79',
            ch = side < 0 ? HELI_CH.navRed : HELI_CH.navGreen;
          lens(ch, navColor, 19, 21, z, 0.55, 0.45, 0.35);
          anchors.push({ x: 19, y: 21, z: z + side * 0.4, size: 7, color: navColor, channel: ch, strength: 1 });
          // Formation light strips (dim green) on the cabin and the pylon.
          const fz = heliSurfaceZ(stationAt(6), 19.6, side) + side * 0.1;
          lens(HELI_CH.navGreen, '#2a8a44', 6, 19.6, fz, 3.6, 0.3, 0.12, boxGeo);
          lens(HELI_CH.navGreen, '#2a8a44', -45.4, 27, side * (plan.fin.thick / 2 + 0.38), 0.3, 3.4, 0.1, boxGeo);
        }
        lens(HELI_CH.navWhite, '#fff6e6', -51.4, 20.6, 0, 0.4, 0.45, 0.45);
        anchors.push({ x: -51.8, y: 20.6, z: 0, size: 7, color: '#fff4e0', channel: HELI_CH.navWhite, strength: 1 });
        for (const [x, y, sy] of [
          [-48.2, 36.3, 0.4],
          [4, 5.8, -0.4],
        ]) {
          lens(HELI_CH.beacon, '#ff2a1e', x, y, 0, 0.75, 0.5, 0.75, S.dome);
          anchors.push({ x, y: y + sy, z: 0, size: 12, color: '#ff3326', channel: HELI_CH.beacon, strength: 1 });
        }
        lens(HELI_CH.strobe, '#ffffff', -20, 19.6, 0, 0.45, 0.4, 0.45);
        anchors.push({ x: -20, y: 20, z: 0, size: 18, color: '#ffffff', channel: HELI_CH.strobe, strength: 1 });
        for (const z of [-1.8, 1.8]) {
          lens(HELI_CH.work, '#fff8e8', 36, 6.25, z, 0.9, 0.3, 0.9);
          anchors.push({ x: 36.4, y: 5.9, z, size: 13, color: '#fff3d6', channel: HELI_CH.work, strength: 0.8 });
        }
      }
      // ---- Cabin: instrument panel, seats, sticks, the crew ----------------------------------------
      function heliCabin(k) {
        const { plan, look, S, interior, lights, crew } = k,
          seats = plan.seats,
          floor = plan.cabin.floor,
          seat = look.seat,
          dash = plan.dash,
          frame = '#2c2f33';
        // Instrument panel with its glareshield, screens on the pilots' side.
        policeAdd(interior, boxGeo, dash + 0.9, floor + 4.5, 0, 2.2, 3.4, 10.4, '#1f2124');
        policeAdd(interior, boxGeo, dash + 1.5, floor + 6.35, 0, 3.4, 0.45, 11.2, '#141517');
        for (const z of [-2.6, 2.6])
          for (const dz of [-1.05, 1.05]) policeAdd(lights, boxGeo, dash - 0.25, floor + 4.9, z + dz, 0.08, 1.5, 1.7, '#5fb3d8', { channel: HELI_CH.navWhite });
        policeAdd(interior, boxGeo, (seats.front + dash) / 2 + 0.6, floor + 1.4, 0, dash - seats.front - 1.5, 2.8, 2.0, '#232528');
        const chair = (x, z, height = 1) => {
          policeAdd(interior, boxGeo, x, floor + 2.3, z, 3.6, 0.9, 3.3, seat);
          policeAdd(interior, boxGeo, x - 2.0, floor + 5.0 * height, z, 0.9, 5.2 * height, 3.3, seat, null, 0, 0, 0.18);
          policeAdd(interior, boxGeo, x, floor + 1.1, z, 2.6, 2.2, 2.6, frame);
        };
        for (const side of [-1, 1]) {
          const z = side * seats.side;
          chair(seats.front, z);
          policeAdd(interior, boxGeo, seats.front - 2.6, floor + 8.1, z, 0.8, 1.5, 2.2, seat, null, 0, 0, 0.18);
          // Cyclic between the knees, collective beside the seat, pedals.
          heliRod(interior, [seats.front + 3.2, floor + 0.2, z], [seats.front + 3.4, floor + 4.6, z], 0.18, '#111214');
          heliRod(interior, [seats.front - 0.8, floor + 1.4, z - 2.2], [seats.front + 2.4, floor + 3.2, z - 2.2], 0.16, '#111214');
          for (const dz of [-0.8, 0.8]) policeAdd(interior, boxGeo, dash - 1.4, floor + 1.2, z + dz, 0.4, 1.6, 0.8, '#3a3d42');
        }
        for (const z of seats.rearSides) chair(seats.rear, z, 0.95);
        // Crew in flight suits and helmets: pilot on the right, observer on the left.
        const person = (set, z) => {
          const x = seats.front,
            suit = look.suit;
          policeAdd(set, S.sphere, x - 0.9, floor + 5.6, z, 1.4, 2.4, 1.55, suit);
          policeAdd(set, S.sphere, x - 0.8, floor + 7.3, z, 1.15, 0.9, 1.75, suit);
          policeAdd(set, S.cylinder, x - 0.6, floor + 8.0, z, 0.55, 0.8, 0.55, '#c49a7c');
          policeAdd(set, S.sphere, x - 0.5, floor + 9.0, z, 1.2, 1.25, 1.1, look.helmet);
          policeAdd(set, S.sphere, x + 0.35, floor + 8.9, z, 0.6, 0.62, 0.95, '#0b0f14');
          for (const dz of [-1, 1]) {
            heliRod(set, [x - 0.6, floor + 7.2, z + dz * 1.45], [x + 1.6, floor + 5.2, z + dz * 1.35], 0.42, suit);
            heliRod(set, [x + 1.6, floor + 5.2, z + dz * 1.35], [x + 3.2, floor + 4.6, z + dz * 0.6], 0.36, suit);
            heliRod(set, [x - 0.4, floor + 3.3, z + dz * 0.7], [x + 3.4, floor + 3.6, z + dz * 0.75], 0.55, suit);
            heliRod(set, [x + 3.4, floor + 3.6, z + dz * 0.75], [dash - 1.8, floor + 1.0, z + dz * 0.8], 0.45, suit);
          }
        };
        person(crew.pilot, seats.side);
        person(crew.observer, -seats.side);
      }
      // ---- Rotors ---------------------------------------------------------------------------
      // An airfoil ring (chordwise loop), leading edge at -z: the blade runs along +x.
      const HELI_AIRFOIL = [
        [0, 0],
        [0.04, 0.5],
        [0.18, 0.95],
        [0.45, 0.8],
        [1, 0.06],
        [0.45, -0.3],
        [0.18, -0.45],
        [0.04, -0.3],
      ];
      function heliBladeRing(r, chord, thick, pitch, sweep, drop) {
        const c = Math.cos(pitch),
          s = Math.sin(pitch);
        return HELI_AIRFOIL.map(([p, t]) => {
          const z0 = (p - 0.25) * chord + sweep,
            y0 = t * thick;
          return [r, y0 * c + z0 * s * -1 + drop, y0 * s + z0 * c];
        });
      }
      /*
       * Main rotor: the hub (mast, yoke, grips, dampers, pitch links, rotating
       * swashplate, cap) and the blades, both in rotor space (y up from the ground).
       */
      function heliRotorParts(rotor, look, military) {
        const S = policeShapeKit(),
          hub = policeSet(),
          blades = policeSet(),
          { radius: R, root, chord, blades: n, droop, sweep, hub: hubR } = rotor,
          y = rotor.y,
          tipStart = R - (military ? 2.2 : 1.5);
        policeAdd(hub, S.cylinder, 0, (rotor.mast + y) / 2, 0, 0.8, y - rotor.mast, 0.8, '#5d6268');
        policeAdd(hub, S.cylinder, 0, y, 0, hubR, 0.75, hubR, '#3a3e43');
        policeAdd(hub, S.sphere, 0, y + 0.55, 0, 1.25, 0.55, 1.25, '#80868c');
        policeAdd(hub, S.cylinder, 0, rotor.mast + 1.75, 0, hubR * 0.78, 0.35, hubR * 0.78, '#8b9197');
        for (let i = 0; i < n; i++) {
          const a = (i * TAU) / n,
            c = Math.cos(a),
            s = Math.sin(a),
            at = (r, dz) => [c * r + s * dz, 0, -s * r + c * dz];
          // Grip and damper along the blade root, a pitch link down to the swashplate.
          heliMatrix.compose(heliV2.set(...at(hubR + 1.2, 0)).setY(y), heliQuat.setFromAxisAngle(heliUp, a), new Three.Vector3(3.2, 0.95, 1.5));
          policeAddMatrix(hub, boxGeo, heliMatrix, '#2e3236');
          heliMatrix.compose(heliV2.set(...at(hubR * 0.7, 1.3)).setY(y - 0.1), heliQuat.setFromAxisAngle(heliUp, a), new Three.Vector3(2.2, 0.5, 0.5));
          policeAddMatrix(hub, S.cylinder, heliMatrix.multiply(new Three.Matrix4().makeRotationZ(Math.PI / 2)), '#1c1e21');
          const top = at(hubR * 0.85, -1.2),
            foot = at(hubR * 0.7, -1.2);
          heliRod(hub, [foot[0], rotor.mast + 1.8, foot[2]], [top[0], y - 0.35, top[2]], 0.16, '#a8aeb4');
          // The blade: cuff, then twisted, tapering to a swept tip that droops at rest.
          const stations = [root, root + 1.4, R * 0.3, R * 0.55, R * 0.8, tipStart, R - 0.6, R],
            rings = stations.map((r) => {
              const f = (r - root) / (R - root),
                tipF = Math.max(0, (r - R * 0.9) / (R * 0.1)),
                cw = r < root + 1 ? chord * 0.6 : chord * (1 - 0.4 * tipF),
                pitch = 0.16 - 0.14 * f,
                swept = sweep * tipF * tipF,
                drop = -droop * f * f;
              return heliBladeRing(r, cw, chord * (r < root + 1 ? 0.22 : 0.12 - 0.04 * f), pitch, swept, drop);
            });
          const bodyRings = rings.slice(0, 6),
            tipRings = rings.slice(5),
            place = (ring) => ring.map(([r, py, pz]) => [c * r + s * pz, y + py, -s * r + c * pz]);
          heliAddSweep(blades, bodyRings.map(place), look.blade);
          heliAddSweep(blades, tipRings.map(place), look.tip);
        }
        return {
          hub: policeGeometry(hub),
          blades: policeGeometry(blades),
          x: rotor.x,
          y,
          radius: R,
          disc: { blades: n, hub: (hubR + 1.6) / R, tip: tipStart / R, trail: 0.13, smear: 0.1, color: look.blade, tipColor: look.tip },
        };
      }
      // Two- or four-blade tail rotor in its own plane (x, y), spinning about z.
      function heliTailRotorParts(t, look) {
        const S = policeShapeKit(),
          set = policeSet();
        policeAdd(set, S.cylinder, 0, 0, 0, 0.75, 1.1, 0.75, '#3a3e43', null, Math.PI / 2);
        for (let i = 0; i < t.blades; i++) {
          const a = (i * TAU) / t.blades + 0.3,
            c = Math.cos(a),
            s = Math.sin(a),
            place = (ring) => ring.map(([r, py, pz]) => [c * r - s * pz, s * r + c * pz, py]);
          const body = [0.9, t.radius * 0.72].map((r) => heliBladeRing(r, t.chord, 0.18, 0.12, 0, 0)),
            tip = [t.radius * 0.72, t.radius * 0.86, t.radius].map((r) => heliBladeRing(r, t.chord * (r > t.radius * 0.9 ? 0.85 : 1), 0.16, 0.08, 0, 0));
          heliAddSweep(set, body.map(place), look.blade);
          heliAddSweep(set, tip.slice(0, 2).map(place), '#e8e6e0');
          heliAddSweep(set, tip.slice(1).map(place), '#c7362b');
        }
        return {
          blades: policeGeometry(set),
          x: t.x,
          y: t.y,
          z: t.z,
          cant: t.cant,
          radius: t.radius,
          disc: { blades: t.blades, hub: 0.14, tip: 0.86, trail: 0.2, smear: 0.14, color: look.blade, tipColor: '#c7362b' },
        };
      }
      function heliFenestronParts(f, look) {
        const set = policeSet();
        for (let i = 0; i < 10; i++) {
          const a = (i * TAU) / 10,
            c = Math.cos(a),
            s = Math.sin(a),
            place = (ring) => ring.map(([r, py, pz]) => [c * r - s * pz, s * r + c * pz, py]);
          heliAddSweep(set, [1.1, f.radius - 0.15].map((r) => heliBladeRing(r, 0.9, 0.14, 0.3, 0, 0)).map(place), '#34373c');
        }
        return {
          blades: policeGeometry(set),
          x: f.x,
          y: f.y,
          z: 0,
          cant: 0,
          radius: f.radius - 0.1,
          disc: { blades: 10, hub: 0.27, tip: 1.2, trail: 0.12, smear: 0.22, color: '#2a2d31', tipColor: '#2a2d31' },
        };
      }
      // ---- The model -------------------------------------------------------------------------
      function makeHelicopter(vehicle) {
        const look = helicopterLookFor(vehicle),
          kit = heliKit(look),
          M = heliMaterials(),
          group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        group.name = look.kind + ' helicopter';
        const livery = heliLiveryTexture(look, kit.plan, kit.scheme),
          finish = look.finish,
          paint = new Three.MeshPhysicalMaterial({
            color: '#ffffff',
            map: livery,
            emissive: '#000000',
            emissiveMap: livery,
            roughness: finish.roughness,
            metalness: finish.metalness,
            clearcoat: finish.clearcoat,
            clearcoatRoughness: 0.07,
            envMapIntensity: 1,
          }),
          glass = heliGlassMaterial(look.glass).clone(),
          lightMaterial = heliLightMaterial(),
          quiet = (m) => {
            m.castShadow = false;
            return m;
          };
        const skin = mesh(kit.paint, paint, body, 0, 0, 0),
          canopy = mesh(kit.glass, glass, body, 0, 0, 0),
          trim = mesh(kit.trim, M.trim, body, 0, 0, 0);
        canopy.receiveShadow = false;
        if (kit.metal) mesh(kit.metal, M.metal, body, 0, 0, 0);
        quiet(mesh(kit.interior, M.interior, body, 0, 0, 0));
        const pilot = quiet(mesh(kit.pilot, M.interior, body, 0, 0, 0)),
          observer = quiet(mesh(kit.observer, M.interior, body, 0, 0, 0));
        pilot.visible = observer.visible = false;
        quiet(mesh(kit.decals, policeGlyphs().material, body, 0, 0, 0));
        const lights = quiet(mesh(kit.lights, lightMaterial, body, 0, 0, 0));
        lights.receiveShadow = false;
        // Main rotor: hub and blades spin in `rotor`; the blur disc stays still.
        const rotor = new Three.Group();
        rotor.position.set(kit.rotor.x, 0, 0);
        body.add(rotor);
        quiet(mesh(kit.rotor.hub, M.metal, rotor, 0, 0, 0));
        const blades = mesh(kit.rotor.blades, M.blade, rotor, 0, 0, 0);
        blades.receiveShadow = false;
        const discMaterial = heliDiscMaterial(kit.rotor.disc),
          disc = quiet(new Three.Mesh(M.discGeometry, discMaterial));
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(kit.rotor.x, kit.rotor.y + 0.1, 0);
        disc.scale.setScalar(kit.rotor.radius);
        disc.visible = false;
        disc.receiveShadow = false;
        body.add(disc);
        // Tail rotor (or fenestron fan): a fixed mount (the cant), the spinning part.
        const tailMount = new Three.Group();
        tailMount.position.set(kit.tail.x, kit.tail.y, kit.tail.z);
        tailMount.rotation.x = kit.tail.cant;
        body.add(tailMount);
        const tail = new Three.Group();
        tailMount.add(tail);
        const tailBlades = quiet(mesh(kit.tail.blades, M.blade, tail, 0, 0, 0)),
          tailDiscMaterial = heliDiscMaterial(kit.tail.disc),
          tailDisc = quiet(new Three.Mesh(M.discGeometry, tailDiscMaterial));
        tailDisc.scale.setScalar(kit.tail.radius);
        tailDisc.position.z = kit.tail.z < 0 ? -0.1 : 0.1;
        tailDisc.visible = false;
        tailMount.add(tailDisc);
        // The Nightsun on its gimbal; its anchor for the searchlight (HELI_SEARCHLIGHT_MOUNT).
        let nightsun = null;
        const searchlightMount = new Three.Object3D();
        searchlightMount.position.set(HELI_SEARCHLIGHT_MOUNT.x, HELI_SEARCHLIGHT_MOUNT.y, HELI_SEARCHLIGHT_MOUNT.z);
        body.add(searchlightMount);
        if (kit.nightsun) {
          const yaw = new Three.Group(),
            pitch = new Three.Group();
          yaw.position.copy(searchlightMount.position);
          body.add(yaw);
          yaw.add(pitch);
          quiet(mesh(kit.nightsun.head, M.trim, pitch, 0, 0, 0));
          quiet(mesh(kit.nightsun.lens, lightMaterial, pitch, 0, 0, 0));
          pitch.rotation.z = -0.5;
          nightsun = { yaw, pitch, aimYaw: 0, aimPitch: -0.5 };
        }
        const halos = kit.anchors.map((a) => {
          const sprite = new Three.Sprite(heliHaloMaterial(a.color));
          sprite.position.set(a.x, a.y, a.z);
          sprite.scale.set(a.size, a.size, 1);
          sprite.visible = false;
          body.add(sprite);
          return { sprite, channel: a.channel, strength: a.strength };
        });
        return {
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          helicopter: true,
          heli: true,
          look,
          rotor,
          blades,
          disc,
          tail,
          tailBlades,
          tailDisc,
          canopy,
          glass,
          pilot,
          observer,
          shell: null,
          nightsun,
          searchlightMount,
          lightMaterial,
          levels: lightMaterial.uniforms.levels.value,
          halos,
          rpm: -1,
          ghost: 0,
          lastSpeed: 0,
          accel: 0,
          reflective: -1,
          // damage3d.js hooks: livery restored after the soot, the paint's own finish.
          liveryMap: livery,
          liveryColor: '#ffffff',
          finish,
          // Bullet marks land on the skin, glass and trim (never the rotor disc).
          rayTargets: [skin, canopy, trim],
        };
      }
      // ---- Per frame ---------------------------------------------------------------------------
      const heliTarget = new Three.Vector3(),
        heliPoliceLevels = new Float32Array(8);
      function heliAngleTowards(from, to, k) {
        return from + normalizeAngle(to - from) * k;
      }
      /*
       * Spool, rotor blur, attitude and vibration, crew, Nightsun aim, lights and
       * halos for one helicopter model in view (render3d.js vehicle pass).
       */
      function animateHelicopter(c, m, dt, wear) {
        const alive = c.hp > 0,
          ground = terrainHeight(c.x, c.y),
          elevation = entityElevation(c),
          airborne = elevation > ground + 2,
          crewed = alive && (c === player.car || c.airUnit),
          running = alive && (crewed || (c.abandonedFlight && airborne) || !!c.showRotor);
        // Spool: about 4 s up to speed, 9 s coasting down; a wreck stops short.
        if (m.rpm < 0) m.rpm = running ? 1 : 0;
        const rate = running ? 0.26 : alive ? 0.11 : 0.6;
        m.rpm = running ? Math.min(1, m.rpm + dt * rate) : Math.max(0, m.rpm - dt * rate);
        const rpm = m.rpm,
          blur = clamp((rpm - 0.3) / 0.4, 0, 1);
        m.rotor.rotation.y += dt * rpm * HELI_SPIN;
        m.tail.rotation.z += dt * rpm * HELI_TAIL_SPIN;
        m.ghost += dt * (0.6 + 2.4 * rpm);
        m.disc.visible = blur > 0.01;
        const du = m.disc.material.uniforms;
        du.uBlur.value = blur;
        du.uPhase.value = m.ghost;
        // Blades give way to the disc; they keep throwing their shadow.
        const solid = blur < 0.75;
        m.blades.material = solid ? heliMaterials().blade : heliMaterials().shadowOnly;
        m.tailBlades.visible = blur < 0.6;
        m.tailDisc.visible = blur > 0.01;
        m.tailDisc.material.uniforms.uBlur.value = blur;
        m.tailDisc.material.uniforms.uPhase.value = m.ghost * 3;
        // The disc darkens at night (it only scatters the light around it).
        const lampsOn = vehicleLampAmount(),
          discLight = 1 - 0.55 * nightAmount;
        du.uColor.value.set(m.look.blade).multiplyScalar(discLight);
        // Attitude: nose down with speed and acceleration (up in a flare), banked in
        // the turn; on the ground only the rotor's vibration.
        const speed = c.speed || 0,
          accel = dt > 0 ? clamp((speed - m.lastSpeed) / dt, -120, 120) : 0;
        m.lastSpeed = speed;
        m.accel += (accel - m.accel) * (1 - Math.exp(-dt * 2.5));
        const flying = airborne && alive;
        m.body.rotation.z = flying ? clamp(-speed * 0.00024 - m.accel * 0.0014, -0.22, 0.16) : 0;
        m.body.rotation.x = flying ? clamp(c.av * 0.075, -0.14, 0.14) : 0;
        const buzz = rpm * (airborne ? 0.55 : 1);
        m.body.position.y = Math.sin(gameTime * 41 + c.id) * 0.05 * buzz;
        m.body.rotation.x += Math.sin(gameTime * 29.3 + c.id) * 0.0022 * buzz;
        m.body.rotation.z += Math.sin(gameTime * 23.7) * 0.0018 * buzz;
        // A wreck: the hub knocked askew, sat low on a collapsed skid.
        if (!alive) {
          m.rotor.rotation.x = 0.1;
          m.rotor.rotation.z = -0.06;
          if (!airborne) m.body.rotation.x = 0.07;
        } else if (m.rotor.rotation.x) m.rotor.rotation.x = m.rotor.rotation.z = 0;
        // Crew: the pilot whenever someone flies it, the observer in the air unit.
        m.pilot.visible = crewed;
        m.observer.visible = alive && !!c.airUnit;
        // Glass: scuffed and sooted with the wear.
        m.glass.roughness = 0.04 + wear * 0.5;
        m.glass.opacity = 0.6 + wear * 0.3;
        // Nightsun: the head turns to what the crew are watching, else rests forward.
        const tracking = alive && c.airUnit && (c.airState === 'tracking' || c.airState === 'searching'),
          watched = tracking ? (c.airState === 'tracking' && c.airTarget && c.airTarget.hp > 0 ? c.airTarget : c.airLastSeen) : null;
        if (m.nightsun) {
          const ns = m.nightsun;
          let yaw = 0,
            pitch = -0.5;
          if (watched) {
            heliTarget.set(watched.x, watched.hp !== undefined ? entityElevation(watched) : terrainHeight(watched.x, watched.y), watched.y);
            m.body.worldToLocal(heliTarget).sub(ns.yaw.position);
            yaw = Math.atan2(-heliTarget.z, heliTarget.x);
            pitch = clamp(Math.atan2(heliTarget.y, Math.hypot(heliTarget.x, heliTarget.z)), -1.45, 0.1);
          }
          const k = 1 - Math.exp(-dt * 4);
          ns.aimYaw = heliAngleTowards(ns.aimYaw, yaw, k);
          ns.aimPitch += (pitch - ns.aimPitch) * k;
          ns.yaw.rotation.y = ns.aimYaw;
          ns.pitch.rotation.z = ns.aimPitch;
        }
        // ---- Lights ----
        const L = m.levels,
          t = gameTime + (c.id % 13) * 0.29,
          nav = alive && (running || (crewed && lampsOn > 0.3)) ? 1 : 0;
        heliLightGain.value = 3.4 + lampsOn * 2.6;
        L.fill(0);
        L[HELI_CH.navRed] = L[HELI_CH.navGreen] = nav;
        L[HELI_CH.navWhite] = nav;
        if (running) {
          const p = t % 1.3;
          L[HELI_CH.strobe] = p < 0.05 || (p > 0.16 && p < 0.21) ? 1 : 0;
          L[HELI_CH.beacon] = Math.pow(Math.max(0, Math.sin(t * 6.8)), 4);
          const low = typeof aircraftClearance === 'function' ? aircraftClearance(c) < 360 : !airborne;
          L[HELI_CH.work] = (low && (lampsOn > 0.2 || !airborne)) || (tracking && lampsOn > 0.2) ? 1 : 0;
        }
        if (m.look.kind === 'police' && alive && (c.airUnit || c.showLights)) {
          policeLightLevels(c, heliPoliceLevels, gameTime);
          const l = heliPoliceLevels;
          L[HELI_CH.red] = Math.max(l[0], l[1], l[5]);
          L[HELI_CH.blue] = Math.max(l[2], l[3], l[6]);
        }
        // Halos over the lit lamps: faint by day, blooming at night.
        const scale = 0.25 + lampsOn * 0.6;
        for (const h of m.halos) {
          const level = L[h.channel];
          if (level > 0.05) queueVehicleHalo(h.sprite, level * h.strength * scale * (h.channel === HELI_CH.strobe ? 1.6 : 1));
        }
        // Police livery: the reflective band catches the light at night.
        if (m.look.reflective) {
          const glow = m.charred ? -1 : Math.round(lampsOn * 20) / 20;
          if (m.reflective !== glow) {
            m.reflective = glow;
            if (glow >= 0) m.paint.emissive.setScalar(glow * 0.05);
          }
        }
      }
      /*
       * Where the police searchlight's lens is, in world space (for searchlight3d.js):
       * the model's anchor while it is built, else the same point from the pose.
       */
      function helicopterSearchlightMount(c, out = new Three.Vector3()) {
        const m = carModels.get(c);
        if (m?.searchlightMount && m.group.visible) return m.searchlightMount.getWorldPosition(out);
        const cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          p = HELI_SEARCHLIGHT_MOUNT;
        return out.set(c.x + cos * p.x - sin * p.z, entityElevation(c) + 0.1 + p.y, c.y + sin * p.x + cos * p.z);
      }
      // What the review report (DeadEndCity.helicopterModels) counts for one model.
      function helicopterModelReport(c, m) {
        let meshes = 0,
          drawn = 0,
          shadows = 0,
          triangles = 0;
        m.group.traverse((o) => {
          if (!o.isMesh) return;
          meshes++;
          for (let p = o; p; p = p.parent) if (!p.visible) return;
          drawn++;
          if (o.castShadow) shadows++;
          const g = o.geometry;
          triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
        });
        return {
          id: c.id,
          look: m.look?.kind || (m.apache ? 'apache' : 'old'),
          visible: m.group.visible,
          rpm: m.rpm !== undefined ? +m.rpm.toFixed(2) : null,
          meshes,
          drawCalls: drawn,
          shadowCasters: shadows,
          triangles: Math.round(triangles),
          crew: m.pilot ? (m.pilot.visible ? 1 : 0) + (m.observer.visible ? 1 : 0) : null,
        };
      }
      // END SUBSYSTEM: src/helicopter3d.js
