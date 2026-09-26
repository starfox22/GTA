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
       *   - police: the air unit (c.airUnit) and the machine on the POLICE HQ pad. An
       *     EC120 / H130 class light single (the `colibri` airframe): big bubble
       *     canopy, egg-shaped cabin, the engine cowl behind the three-blade rotor,
       *     a shrouded fenestron fan in the fin and a stabiliser with tall endplates.
       *     Gloss navy-black with a deep blue band edged in gold pinstripes from the
       *     nose along the cabin and the boom; POLICE in big white letters outlined
       *     in blue on both sides, SOUTH COAST over it, the department seal on the
       *     rear doors, N-7SC on the cowl, AIR ONE on the fin, and for the camera
       *     above AIR 1 across the cowl and POLICE along the boom. FLIR ball under
       *     the nose, the Nightsun under the belly (HELI_SEARCHLIGHT_MOUNT), wire
       *     cutters, antennas, red / blue LED strobes on the cabin, nose, boom and
       *     fin tip;
       *   - civil: a Robinson R44 / R66 class four-seater (the `robin` airframe):
       *     a teardrop cabin with a big glazed bubble and roof window, the tall mast
       *     fairing with a two-blade teetering rotor, a slim boom with a two-blade
       *     tail rotor on the left and the V tail (upper and lower fins), tubular
       *     skids. Schemes (HELI_CIVIL_SCHEMES): white with red and blue stripes,
       *     yellow, metallic grey, black with gold; a respray's colour on its own;
       *   - news: the same small airframe in CH 7 NEWS white, red and navy with a
       *     gyro-stabilised camera ball on the chin (the RIVERSIDE pad's, and one
       *     civilian machine in four);
       *   - executive: the small airframe in deep metallic paint with double gold
       *     pinstripes, tan leather and polished skids (one civilian in four);
       *   - military: Fort Sentinel's machines (c.military). A UH-60 Black Hawk class
       *     utility helicopter, scaled into the same footprint: boxy cabin with a
       *     sliding door and gunner windows (M240s on their mounts), twin engines
       *     each side of the rotor pylon with turned-out exhausts, the canted tail
       *     rotor on the starboard side of the tall pylon, the big stabilator,
       *     wheeled main gear and tail wheel, flat olive drab with a black
       *     anti-glare panel, low-visibility U.S. ARMY and serial.
       *
       * CONSTRUCTION (heliKit, once per look; heliPlans for the three airframes):
       *   - the fuselage is one lofted surface (monotone-cubic stations of keel,
       *     crown, widest height, half width and two superellipse exponents). Its
       *     quads are split by the plan's window field (`windows(x, y, z)`, a
       *     signed distance) into painted skin and the flush, transparent canopy:
       *     the bubble, roof and door windows are the fuselage itself;
       *   - the livery is one canvas per look (2048 wide for the police and news)
       *     painted per pixel from the same surface (heliLiveryTexture): paint
       *     scheme, pinstripes, black window seals over the glass edge, door seams,
       *     belly grime and exhaust soot. The bottom quarter holds both faces of the
       *     fin, the cowl (lofted and painted like the fuselage) and flat swatches.
       *     Words, registrations and seals are canvas text and art warped onto the
       *     surface strip by strip (heliPaintWord), so they follow its curves, read
       *     forwards on both sides and char with the paint on a wreck. Only the
       *     Black Hawk's stencils still use glyph quads (heliText);
       *   - inside: a dark liner and floor seen through the glass, instrument
       *     panel with lit screens, seats, sticks, and the crew (pilot on the
       *     right, observer on the left) shown only while somebody flies it;
       *   - trim (skids and arched cross tubes, steps, exhaust, grilles, antennas,
       *     sensors, gear), interior and every lamp lens are each merged into one
       *     vertex-coloured mesh: 10 to 14 draw calls for a whole helicopter.
       *
       * ROTORS: three (police), two (civil) or four (military) blades with twist,
       *   taper, tip paint and droop at rest, on a hub with grips, pitch links and a
       *   swashplate. Spinning up (~4 s) and coasting down (~9 s) follow `m.rpm`; past
       *   half speed the solid blades give way to a translucent disc shaded with
       *   blade ghosts that trail round it (HELI DISC shader), and the blades keep
       *   casting their shadow (a depth-only material), so a faint flicker of blades
       *   crosses the ground. The tail rotor (or the fenestron fan) blurs the same way.
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
      // Share of the livery canvas (from the bottom) for the fin, cowl and swatches.
      const HELI_BAND = 0.25,
        // Columns of that band (share of the width): the fin's starboard face, its
        // port face (mirrored, so words read forwards), the cowl's loft, the swatches.
        HELI_ART = { finS: 0, finP: 0.25, cowl: 0.5, cowlEnd: 0.8, swatch: 0.8 },
        HELI_SWATCH = { top: 0, lower: 1, accent: 2, cowl: 3, stab: 4, plate: 5, dark: 6, metal: 7 },
        // Light channels of the lens mesh (police light shader: eight levels per model).
        HELI_CH = { red: 0, blue: 1, navRed: 2, navGreen: 3, navWhite: 4, strobe: 5, beacon: 6, work: 7 },
        // The police Nightsun's lens in model space (x forward, y up, z to starboard):
        // on its gimbal under the belly, a little to port, between the skid cross tubes.
        HELI_SEARCHLIGHT_MOUNT = Object.freeze({ x: 8.8, y: 3.5, z: -3.3 }),
        // Main rotor at full speed (radians per second of the model), tail rotor.
        HELI_SPIN = 55,
        HELI_TAIL_SPIN = 160,
        // Block letters for the liveries (canvas text, warped onto the skin).
        HELI_FONT = '"Arial Black", "Helvetica Neue", Arial, "Liberation Sans", Helvetica, sans-serif';
      const HELI_LOOKS = {
        police: {
          livery: 'police',
          airframe: 'colibri',
          tail: 'fenestron',
          tex: 2048,
          paintScale: 0.5,
          finish: { roughness: 0.2, metalness: 0.14, clearcoat: 1 },
          glass: '#324050',
          // The roof over the cockpit is painted (the cowl carries the aerial ID).
          roofGlass: false,
          liner: '#222529',
          seat: '#26292e',
          skid: '#16181b',
          suit: '#1f2838',
          helmet: '#1c2946',
          blade: '#25272a',
          tip: '#d7cf9e',
          reflective: true,
        },
        news: {
          livery: 'news',
          airframe: 'robin',
          tail: 'rotor',
          tex: 2048,
          paintScale: 0.5,
          finish: { roughness: 0.24, metalness: 0.08, clearcoat: 1 },
          glass: '#3d4f60',
          roofGlass: true,
          liner: '#2b2e33',
          seat: '#30343a',
          skid: '#b3b8bd',
          suit: '#3a434f',
          helmet: '#e2e2dc',
          blade: '#232528',
          tip: '#e2ddc4',
        },
        executive: {
          livery: 'executive',
          paintScale: 0.5,
          airframe: 'robin',
          tail: 'rotor',
          tex: 1024,
          finish: { roughness: 0.1, metalness: 0.55, clearcoat: 1 },
          glass: '#2f3942',
          roofGlass: true,
          liner: '#6f6356',
          seat: '#a37d56',
          skid: '#d3d7db',
          suit: '#23272d',
          helmet: '#2b2f34',
          blade: '#232528',
          tip: '#d9d9d4',
        },
        civil: {
          livery: 'civil',
          paintScale: 0.5,
          airframe: 'robin',
          tail: 'rotor',
          tex: 1024,
          finish: { roughness: 0.26, metalness: 0.1, clearcoat: 1 },
          glass: '#384a5a',
          roofGlass: true,
          liner: '#34373c',
          seat: '#474b52',
          skid: '#aab0b6',
          suit: '#3a3f47',
          helmet: '#2b2f34',
          blade: '#232528',
          tip: '#e4e0cc',
        },
        military: {
          livery: 'military',
          paintScale: 0.5,
          airframe: 'hawk',
          tail: 'rotor',
          tex: 1024,
          finish: { roughness: 0.88, metalness: 0.03, clearcoat: 0 },
          glass: '#344036',
          roofGlass: false,
          liner: '#3e4136',
          seat: '#5a5941',
          skid: '#2f322c',
          suit: '#4d5341',
          helmet: '#3f4537',
          blade: '#2c2f2b',
          tip: '#d9c24c',
        },
      };
      // The small civilian machines' paint: base, cheat line, pinstripe, the line's
      // width (share of the full stripe), finish and registration.
      const HELI_CIVIL_SCHEMES = {
        classic: { base: '#eef0f1', stripe: '#c8262d', accent: '#1f3f8f', width: 1, reg: 'N44SC' },
        yellow: { base: '#f1c01c', stripe: '#1d1e21', accent: '#f6f6f0', width: 0.8, reg: 'N66YB' },
        silver: { base: '#9fa6ad', stripe: '#2d3137', accent: '#c8262d', width: 0.8, reg: 'N440M', finish: { roughness: 0.22, metalness: 0.6, clearcoat: 1 } },
        noir: { base: '#121316', stripe: '#c9a44a', accent: '#c9a44a', width: 0.16, reg: 'N7GLD', finish: { roughness: 0.14, metalness: 0.3, clearcoat: 1 } },
      };
      const HELI_EXECUTIVE_PAINTS = ['#18253c', '#4b1521', '#1d3a2f', '#e7e4dd', '#373d45'];
      // ---- Which model ----------------------------------------------------------------
      // Cached per vehicle, never stored on it (every vehicle keeps one object layout);
      // `heliLook` on a vehicle is only set by DeadEndCity.helicopterLineup for review
      // ('police', 'news', 'executive', 'military', 'civil' or 'civil:<scheme>').
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
        const hash = Math.imul(c.id + 7, 2654435761) >>> 0,
          [asked, askedScheme] = String(c.heliLook || '').split(':');
        let kind = HELI_LOOKS[asked] ? asked : null,
          scheme = HELI_CIVIL_SCHEMES[askedScheme] ? askedScheme : null;
        if (!kind) {
          if (c.airUnit || c.cop) kind = 'police';
          else if (c.military) kind = 'military';
          else {
            const pad = HELIPADS.find((p) => Math.hypot(p.x - c.x, p.y - c.y) < 120),
              pick = (hash >>> 9) % 4;
            kind = pad?.name === 'POLICE HQ' ? 'police' : pad?.name === 'RIVERSIDE' || pick === 0 ? 'news' : pick === 1 ? 'executive' : 'civil';
          }
        }
        const stock = VEHICLE_DEFINITIONS.helicopter.color,
          own = c.color && c.color !== stock && c.color !== '#d9e1df' ? c.color : null;
        let paint = null,
          finish = HELI_LOOKS[kind].finish;
        if (kind === 'civil') {
          const names = Object.keys(HELI_CIVIL_SCHEMES);
          scheme = scheme || (own ? null : names[(hash >>> 13) % names.length]);
          const s = scheme ? HELI_CIVIL_SCHEMES[scheme] : null;
          paint = s ? s.base : own;
          finish = s?.finish || finish;
          scheme = scheme || 'own';
        } else if (kind === 'executive') paint = own || HELI_EXECUTIVE_PAINTS[(hash >>> 13) % HELI_EXECUTIVE_PAINTS.length];
        else if (kind === 'military') paint = own || '#4d5641';
        return heliLookOf(kind, scheme, paint, finish);
      }
      function heliLookOf(kind, scheme = null, paint = null, finish = HELI_LOOKS[kind].finish) {
        return { ...HELI_LOOKS[kind], kind, scheme, paint, finish, key: kind + ':' + (scheme || '') + ':' + (paint || '') };
      }
      /*
       * While the title screen is up (render3d.js, with the shader prewarm): the
       * police machine's kit at once, then its livery a few milliseconds at a time,
       * so the air unit's first call costs no hitch.
       */
      function prewarmHelicopters() {
        const looks = [heliLookOf('police'), heliLookOf('news'), ...Object.entries(HELI_CIVIL_SCHEMES).map(([name, s]) => heliLookOf('civil', name, s.base, s.finish))];
        let job = null;
        const step = () => {
          const started = performance.now();
          while (performance.now() - started < 8) {
            if (!job) {
              const look = looks.shift();
              if (!look) return;
              if (heliLiveryTextures.has(look.key) || heliLiveryJobs.has(look.key)) continue;
              job = heliLiveryJob(look, heliKit(look));
              heliLiveryJobs.set(look.key, job);
            }
            if (job.next().done) job = null;
          }
          setTimeout(step, 30);
        };
        setTimeout(step, 2500);
      }
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
      // ---- Surface maths ------------------------------------------------------------------
      // Monotone cubic interpolation (Fritsch-Carlson): smooth, never overshoots.
      function heliMonotone(xs, ys) {
        let lastX = NaN,
          lastY = 0;
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
        // Remembers the last answer: the livery painter asks for one x a column at a time.
        return (x) => {
          if (x === lastX) return lastY;
          lastX = x;
          if (x <= xs[0]) return (lastY = ys[0]);
          if (x >= xs[n - 1]) return (lastY = ys[n - 1]);
          let i = 0;
          while (x > xs[i + 1]) i++;
          const h = xs[i + 1] - xs[i],
            t = (x - xs[i]) / h,
            t2 = t * t,
            t3 = t2 * t;
          return (lastY = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]);
        };
      }
      function heliStation(plan, x) {
        const s = plan.spline;
        return { x, yb: s[0](x), yt: s[1](x), yw: s[2](x), w: Math.max(0.02, s[3](x) * plan.widen), nu: s[4](x), nl: s[5](x) };
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
            metalness: 0.9,
            envMapIntensity: 1.5,
            transparent: true,
            opacity: 0.46,
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
          float rim = 1.0 - smoothstep( 0.93, 1.0, r );
          float hub = smoothstep( uHub, uHub + 0.05, r );
          float spacing = 6.28318530718 / uBlades;
          float a = atan( vPos.y, vPos.x ) - uPhase;
          float sector = fract( a / spacing );
          // Arc (in radii) behind and ahead of the nearest blade at this radius.
          float behind = ( 1.0 - sector ) * spacing * r;
          float ahead = sector * spacing * r;
          float ghost = exp( -behind / uTrail ) + exp( -ahead / ( uTrail * 0.12 ) );
          // The painted tips smear into a faint band, soft on both edges.
          float tip = smoothstep( uTip - 0.04, uTip + 0.01, r ) * ( 1.0 - smoothstep( 0.965, 1.0, r ) );
          float alpha = uBlur * rim * hub * ( uSmear * ( 0.75 + 0.25 * r ) + 0.24 * ghost + 0.05 * tip );
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
       * point (the cowl too, from its own stations), `fin(out, x, y, side)` the
       * fin's, `swatches` the flat parts' (HELI_SWATCH order), `words` the lettering
       * and emblems painted into the livery (heliPaintWord), `decals(add)` glyph
       * quads (the Black Hawk's stencils).
       */
      function heliScheme(look) {
        const plan = heliPlans()[look.airframe],
          heliStationFor = (x) => heliStation(plan, x),
          WHITE = [239, 241, 242],
          DARK = [16, 17, 20],
          METAL = [150, 156, 162],
          // The small airframe's cheat line: along the lower doors, up the engine bay onto the boom.
          robinLine = () => heliMonotone([-46, -30, -16, -8, 0, 10, 20, 26, 29], [14.15, 14.0, 13.3, 11.4, 9.2, 8.1, 7.9, 8.3, 9.0]),
          // Stripes narrow with the section (thinner along the boom).
          band = (st) => Math.min(1, Math.max(0.35, st.w / 5.7));
        if (look.livery === 'police') {
          const INK = [11, 15, 26],
            BLUE = [22, 58, 160],
            GOLD = [222, 178, 80],
            BLACK = [7, 9, 14],
            // The blue band's top edge (the upper gold pinstripe) and its bottom edge.
            hi = heliMonotone([-46, -36, -24, -15, -6, 2, 8, 14, 18, 26, 31, 35, 39], [16.35, 16.4, 16.45, 16.8, 17.0, 16.4, 13.4, 9.7, 8.3, 8.25, 8.5, 9.5, 10.2]),
            lo = heliMonotone([-46, -36, -24, -15, -8, 0, 8, 14, 20, 28, 34, 39], [14.05, 14.2, 14.1, 13.2, 11.2, 10.2, 8.7, 7.4, 6.9, 7.0, 7.9, 9.6]),
            letters = { fill: '#f6f8fa', outline: '#1c52dc', outlineWidth: 0.11, edge: '#050d24', edgeWidth: 0.05 };
          return {
            body(out, x, y) {
              out[0] = INK[0];
              out[1] = INK[1];
              out[2] = INK[2];
              heliMix(out, BLUE, heliCover(Math.max(lo(x) - y, y - hi(x)), 0.08));
            },
            // The gold pinstripes just outside the band's edges.
            lines: [
              { y: (x) => hi(x) + 0.17, width: 0.15, color: '#deb250' },
              { y: (x) => lo(x) - 0.17, width: 0.15, color: '#deb250' },
            ],
            fin(out, x, y) {
              // Blue over the fenestron and the fin's root, gold line, black fin tip.
              const edge = 21.4 + (x + 41) * 0.28;
              out[0] = INK[0];
              out[1] = INK[1];
              out[2] = INK[2];
              heliMix(out, BLUE, heliCover(Math.max(y - edge, 10.9 - y), 0.05));
              heliMix(out, GOLD, heliCover(Math.abs(y - edge - 0.14) - 0.09, 0.04));
            },
            swatches: [INK, INK, BLUE, INK, INK, BLACK, DARK, METAL],
            words: [
              { text: 'POLICE', surface: 'side', x: -5.6, y: 14.15, height: 3.3, squeeze: 0.86, spacing: 0.07, ...letters },
              { text: 'SOUTH COAST', surface: 'side', x: -3.2, y: 18.15, height: 1.0, squeeze: 0.9, spacing: 0.14, fill: '#f6f8fa' },
              { image: () => heliSealImage(), surface: 'side', x: 6.3, y: 10.1, height: 3.2 },
              { text: 'N-7SC', surface: 'cowl', x: -2.4, y: 21.35, height: 1.6, spacing: 0.08, fill: '#f6f8fa', outline: '#050d24', outlineWidth: 0.08 },
              { text: 'AIR ONE', surface: 'fin', x: -42.9, y: 24.2, height: 1.0, squeeze: 0.85, spacing: 0.08, fill: '#f6f8fa' },
              // For the camera above: the unit across the cowl, POLICE along the boom.
              { text: 'AIR 1', surface: 'cowlTop', x: -3.6, z: 0, height: 3.9, squeeze: 0.92, spacing: 0.06, ...letters },
              { text: 'POLICE', surface: 'top', x: -24.2, z: 0, height: 3.1, squeeze: 0.78, spacing: 0.05, ...letters },
            ],
          };
        }
        if (look.livery === 'news') {
          const RED = [196, 30, 42],
            NAVY = [16, 32, 74],
            line = robinLine();
          return {
            body(out, x, y, z, st) {
              out[0] = WHITE[0];
              out[1] = WHITE[1];
              out[2] = WHITE[2];
              heliMix(out, [214, 218, 222], heliCover(y - line(x), 0.05) * 0.8);
            },
            lines: [
              { y: line, width: (x, st) => 1.9 * band(st), color: '#c41e2a' },
              { y: (x) => line(x) + 1.3 * band(heliStationFor(x)), width: (x, st) => 0.34 * band(st), color: '#10204a' },
            ],
            fin(out, x, y) {
              out[0] = RED[0];
              out[1] = RED[1];
              out[2] = RED[2];
              heliMix(out, WHITE, heliCover(Math.abs(y - 13.6 - (x + 46) * 0.6) - 0.3, 0.05));
            },
            swatches: [WHITE, RED, NAVY, WHITE, WHITE, RED, DARK, METAL],
            words: [
              { text: 'CH 7 NEWS', surface: 'side', x: 7.4, y: 8.05, height: 1.05, squeeze: 0.9, spacing: 0.1, fill: '#ffffff' },
              { image: () => heliRoundelImage('7', '#c41e2a', '#ffffff'), surface: 'side', x: -8.3, y: 12.7, height: 3.3 },
              { text: 'SKY 7', surface: 'side', x: -27, y: 14.85, height: 0.75, squeeze: 0.9, spacing: 0.1, fill: '#10204a' },
              { text: 'N7NW', surface: 'fin', x: -43.4, y: 18.8, height: 1.05, squeeze: 0.85, fill: '#ffffff' },
              { text: 'NEWS', surface: 'cowlTop', x: -2.3, z: 0, height: 2.5, squeeze: 0.9, spacing: 0.06, fill: '#c41e2a' },
              { text: 'CH 7', surface: 'top', x: -27, z: 0, height: 1.9, squeeze: 0.9, spacing: 0.08, fill: '#10204a' },
            ],
          };
        }
        if (look.livery === 'executive' || look.livery === 'civil') {
          const P = heliHex(look.paint),
            light = P[0] * 0.3 + P[1] * 0.59 + P[2] * 0.11 > 150,
            s = HELI_CIVIL_SCHEMES[look.scheme] || (look.livery === 'executive' ? { stripe: light ? '#96793e' : '#c9a44a', accent: light ? '#96793e' : '#c9a44a', width: 0.12, reg: 'N66EX' } : { stripe: light ? '#1d1e21' : '#e9e9e4', accent: light ? '#c8262d' : '#c9a44a', width: 0.7, reg: 'N44RP' }),
            STRIPE = heliHex(s.stripe),
            ACCENT = heliHex(s.accent),
            BELLY = P.map((v) => v * 0.86),
            line = robinLine(),
            ink = light ? '#17191c' : s.width < 0.3 ? s.stripe : '#f2f2ee';
          return {
            body(out, x, y, z, st) {
              out[0] = P[0];
              out[1] = P[1];
              out[2] = P[2];
              heliMix(out, BELLY, heliCover(y - (st.yb + (st.yw - st.yb) * 0.42), 0.5));
            },
            // The cheat line along the lower doors and up onto the boom, a pinstripe over it.
            lines: [
              { y: line, width: (x, st) => 1.24 * band(st) * s.width, color: s.stripe },
              { y: (x) => line(x) + (0.62 * s.width + 0.36) * band(heliStationFor(x)), width: (x, st) => 0.18 * band(st), color: s.accent },
            ],
            fin(out, x, y) {
              out[0] = P[0];
              out[1] = P[1];
              out[2] = P[2];
              heliMix(out, STRIPE, heliCover(Math.abs(y - 13.6 - (x + 46) * 0.6) - 0.5 * Math.max(0.25, s.width), 0.05));
            },
            swatches: [P, BELLY, STRIPE, P, P, P, DARK, METAL],
            words: [{ text: s.reg, surface: 'side', x: -8.6, y: 13.7, height: 1.25, squeeze: 0.9, spacing: 0.08, fill: ink }],
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
          words: [{ image: () => heliArmyStarImage(), surface: 'side', x: 6.8, y: 11.2, height: 4.6 }],
          decals(add) {
            for (const side of [-1, 1]) {
              add('U.S. ARMY', { surface: 'side', side, x: -27, y: 16.6, height: 1.6, color: '#1b1d19' });
              add('20-27115', { surface: 'fin', side, x: -46.6, y: 24.5, height: 1.2, color: '#1b1d19' });
            }
            add('ARMY', { surface: 'top', x: -27, z: 0, height: 2.8, color: '#23251f' });
          },
        };
      }
      // ---- Emblems (small canvases, warped onto the skin like the words) ----------------------
      function heliEmblemCanvas(size = 256) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const g = canvas.getContext('2d');
        g.translate(size / 2, size / 2);
        return { canvas, g };
      }
      function heliStarPath(g, r, points, inner) {
        g.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / points,
            k = i % 2 ? inner : r;
          g.lineTo(Math.cos(a) * k, Math.sin(a) * k);
        }
        g.closePath();
      }
      // The police department's seal: a gold-rimmed navy ring of stars round a gold star.
      function heliSealImage() {
        const { canvas, g } = heliEmblemCanvas();
        const disc = (r, color) => {
          g.fillStyle = color;
          g.beginPath();
          g.arc(0, 0, r, 0, TAU);
          g.fill();
        };
        disc(124, '#d8b25a');
        disc(114, '#0e2150');
        g.fillStyle = '#d8b25a';
        for (let i = 0; i < 20; i++) {
          const a = (i * TAU) / 20;
          g.save();
          g.translate(Math.cos(a) * 99, Math.sin(a) * 99);
          heliStarPath(g, 7, 5, 3);
          g.fill();
          g.restore();
        }
        disc(84, '#d8b25a');
        disc(78, '#f2f0e8');
        heliStarPath(g, 70, 7, 36);
        g.fillStyle = '#d8b25a';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#7a5c1c';
        g.stroke();
        disc(25, '#0e2150');
        heliStarPath(g, 17, 5, 7);
        g.fillStyle = '#f2f0e8';
        g.fill();
        return canvas;
      }
      function heliRoundelImage(text, fill, ring) {
        const { canvas, g } = heliEmblemCanvas();
        g.fillStyle = ring;
        g.beginPath();
        g.arc(0, 0, 124, 0, TAU);
        g.fill();
        g.fillStyle = fill;
        g.beginPath();
        g.arc(0, 0, 110, 0, TAU);
        g.fill();
        g.fillStyle = ring;
        g.font = `900 190px ${HELI_FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 0, 10);
        return canvas;
      }
      // The Army's low-visibility star in a ring (outlined, no fill).
      function heliArmyStarImage() {
        const { canvas, g } = heliEmblemCanvas();
        g.strokeStyle = 'rgba(24,26,22,0.85)';
        g.lineWidth = 12;
        g.lineJoin = 'miter';
        heliStarPath(g, 88, 5, 34);
        g.stroke();
        g.beginPath();
        g.arc(0, 0, 112, 0, TAU);
        g.stroke();
        return canvas;
      }
      // ---- Lettering: canvas text rasterised upright, then warped onto a surface ----------------
      function heliWordImage(w, pxPerUnit) {
        const canvas = document.createElement('canvas'),
          g = canvas.getContext('2d'),
          // Cap height in source pixels: about twice what the livery gives it.
          CAP = Math.round(clamp(w.height * pxPerUnit * 2.2, 40, 220)),
          weight = w.weight || '900',
          family = w.font || HELI_FONT,
          squeeze = w.squeeze ?? 1;
        g.font = `${weight} 200px ${family}`;
        const size = (200 * CAP) / (g.measureText('H').actualBoundingBoxAscent || 144),
          font = `${weight} ${size.toFixed(1)}px ${family}`;
        g.font = font;
        const chars = [...w.text],
          gap = (w.spacing ?? 0.05) * CAP,
          advances = chars.map((ch) => g.measureText(ch).width * squeeze),
          outline = w.outline ? (w.outlineWidth ?? 0.1) * CAP : 0,
          ring = outline + (w.edge ? (w.edgeWidth ?? 0.05) * CAP : 0),
          pad = Math.ceil(ring + 3);
        canvas.width = Math.ceil(advances.reduce((a, b) => a + b, 0) + gap * (chars.length - 1) + pad * 2);
        canvas.height = Math.ceil(CAP + pad * 2);
        g.font = font;
        g.lineJoin = 'round';
        const layers = [];
        if (w.edge) layers.push([w.edge, ring * 2]);
        if (w.outline) layers.push([w.outline, outline * 2]);
        layers.push([w.fill, 0]);
        for (const [color, width] of layers) {
          let cursor = pad;
          chars.forEach((ch, i) => {
            g.save();
            g.translate(cursor, pad + CAP);
            g.scale(squeeze, 1);
            if (width) {
              g.strokeStyle = color;
              g.lineWidth = width;
              g.strokeText(ch, 0, 0);
            } else {
              g.fillStyle = color;
              g.fillText(ch, 0, 0);
            }
            g.restore();
            cursor += advances[i] + gap;
          });
        }
        return { canvas, unit: w.height / CAP };
      }
      /*
       * Draws `img` onto the livery through `point(fu, fv)` (the source's 0..1
       * coordinates, fu along the reading direction, fv down the letters, to canvas
       * pixels): small cells each drawn with their own affine transform, so the
       * image follows the surface's curves; a pixel of overlap hides the joins.
       */
      function heliWarp(g, img, point) {
        const N = Math.max(8, Math.ceil(img.width / 6)),
          K = 6,
          sw = img.width / N,
          sh = img.height / K,
          grid = [];
        for (let i = 0; i <= N; i++) for (let k = 0; k <= K; k++) grid.push(point(i / N, k / K));
        for (let i = 0; i < N; i++)
          for (let k = 0; k < K; k++) {
            const p = grid[i * (K + 1) + k],
              px = grid[(i + 1) * (K + 1) + k],
              py = grid[i * (K + 1) + k + 1],
              w = Math.min(sw + 1, img.width - i * sw),
              h = Math.min(sh + 1, img.height - k * sh);
            g.setTransform((px[0] - p[0]) / sw, (px[1] - p[1]) / sw, (py[0] - p[0]) / sh, (py[1] - p[1]) / sh, p[0], p[1]);
            g.drawImage(img, i * sw, k * sh, w, h, 0, 0, w, h);
          }
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      // The top of a section at z (the upper surface's angle, inverse of heliSection).
      function heliTopTheta(st, z) {
        const c = clamp(z / st.w, -1, 1);
        return Math.acos(Math.sign(c) * Math.pow(Math.abs(c), st.nu / 2));
      }
      // Canvas pixels of surface points: the fuselage and cowl lofts (sides and tops), the fin.
      function heliSurfaces(plan, cowl, W, H) {
        const ringOf = (theta) => ((((theta + Math.PI / 2) / TAU) % 1) + 1) % 1,
          loft = (stationAt, u, v) => ({
            side: (x, y, side) => [u(x), v(ringOf(heliSideTheta(stationAt(x), y, side)))],
            top: (x, z) => [u(x), v(ringOf(heliTopTheta(stationAt(x), z)))],
          }),
          span = plan.x1 - plan.x0,
          [fx0, fx1, fy0, fy1] = plan.fin.art;
        return {
          body: loft(
            (x) => heliStation(plan, x),
            (x) => ((x - plan.x0) / span) * W,
            (r) => (1 - (HELI_BAND + (1 - HELI_BAND) * r)) * H,
          ),
          cowl:
            cowl &&
            loft(
              cowl.stationAt,
              (x) => (HELI_ART.cowl + ((HELI_ART.cowlEnd - HELI_ART.cowl) * (x - cowl.x0)) / (cowl.x1 - cowl.x0)) * W,
              (r) => (1 - HELI_BAND * r) * H,
            ),
          fin: (x, y, side) => {
            const f = (x - fx0) / (fx1 - fx0);
            return [(side > 0 ? HELI_ART.finS + 0.25 * f : HELI_ART.finP + 0.25 * (1 - f)) * W, (1 - (HELI_BAND * (y - fy0)) / (fy1 - fy0)) * H];
          },
        };
      }
      /*
       * One word or emblem: on the sides (both unless `side`), reading forwards on
       * each, upright; on a top ('top', 'cowlTop') reading towards the nose with the
       * letters standing towards port (so a machine heading east reads on screen).
       */
      function heliPaintWord(g, surfaces, w, pxPerUnit) {
        const source = w.image ? { canvas: w.image() } : heliWordImage(w, pxPerUnit),
          img = source.canvas,
          unit = source.unit || w.height / img.height,
          len = img.width * unit,
          tall = img.height * unit,
          loft = w.surface.startsWith('cowl') ? surfaces.cowl : surfaces.body;
        if (!loft) return;
        if (w.surface === 'top' || w.surface === 'cowlTop') {
          heliWarp(g, img, (fu, fv) => loft.top(w.x + (fu - 0.5) * len, (w.z || 0) - (0.5 - fv) * tall));
          return;
        }
        for (const side of w.side ? [w.side] : [-1, 1])
          heliWarp(g, img, (fu, fv) => {
            const x = w.x + side * (fu - 0.5) * len,
              y = w.y + (0.5 - fv) * tall;
            return w.surface === 'fin' ? surfaces.fin(x, y, side) : loft.side(x, y, side);
          });
      }
      /*
       * The livery canvas: the loft (top three quarters: u along x, v round the
       * ring from the keel) painted per pixel from the surface, then the fin's two
       * faces, the cowl's loft and the swatches in the bottom quarter, then the
       * pinstripes, words and emblems. The big liveries paint their pixels at half
       * size (`paintScale`) and are drawn up to full size before the fine work,
       * which is canvas paths and text at full size. It is a job that yields
       * between slices: heliLiveryTexture runs it to the end at once, the title
       * screen's prewarm (prewarmHelicopters) a few milliseconds at a time.
       */
      const heliLiveryTextures = new Map(),
        heliLiveryJobs = new Map();
      function heliLiveryTexture(look, kit) {
        const done = heliLiveryTextures.get(look.key);
        if (done) return done;
        let job = heliLiveryJobs.get(look.key);
        if (!job) heliLiveryJobs.set(look.key, (job = heliLiveryJob(look, kit)));
        let step;
        do step = job.next();
        while (!step.done);
        return step.value || heliLiveryTextures.get(look.key);
      }
      function* heliLiveryJob(look, kit) {
        let busy = 0,
          slice = performance.now();
        const pause = () => (busy += performance.now() - slice),
          resume = () => (slice = performance.now()),
          { plan, cowl } = kit,
          scheme = heliScheme(look),
          W = look.tex || 1024,
          H = W / 2,
          scale = look.paintScale || 1,
          w = Math.round(W * scale),
          h = Math.round(H * scale),
          LOFT = Math.round(h * (1 - HELI_BAND)),
          image = new ImageData(w, h),
          data = image.data,
          span = plan.x1 - plan.x0,
          out = [0, 0, 0],
          pt = { y: 0, z: 0 },
          SEAL = [15, 17, 20],
          sootScale = look.kind === 'military' ? 1.3 : 1,
          put = (px, py) => {
            const k = (py * w + px) * 4;
            data[k] = out[0];
            data[k + 1] = out[1];
            data[k + 2] = out[2];
            data[k + 3] = 255;
          };
        // Column by column, so the scheme's curves see one x at a time (heliMonotone's memo).
        for (let px = 0; px < w; px++) {
          const st = heliStation(plan, plan.x0 + ((px + 0.5) / w) * span),
            x = st.x;
          for (let py = 0; py < LOFT; py++) {
            const theta = ((1 - (py + 0.5) / h - HELI_BAND) / (1 - HELI_BAND)) * TAU - Math.PI / 2;
            heliSection(st, theta, pt);
            const y = pt.y,
              z = pt.z;
            scheme.body(out, x, y, z, st);
            // Belly grime and exhaust soot.
            const low = Math.min(1, Math.max(0, (st.yw - y) / Math.max(0.5, st.yw - st.yb)));
            heliShade(out, 1 - 0.1 * low * low - 0.3 * plan.soot(x, y, z, st) * sootScale);
            // Panel seams, then the black rubber seals round the glazing.
            heliShade(out, 1 - 0.32 * heliCover(plan.seams(x, y, z, st) - 0.05, 0.05));
            heliMix(out, SEAL, heliCover(plan.windows(x, y, z, st, look.roofGlass) - 0.9, 0.1));
            put(px, py);
          }
          if (px % 48 === 47) {
            pause();
            yield;
            resume();
          }
        }
        // Both faces of the fin, the port face mirrored so its words read forwards.
        const [fx0, fx1, fy0, fy1] = plan.fin.art,
          quarter = w / 4;
        for (const side of [1, -1]) {
          const c0 = Math.round((side > 0 ? HELI_ART.finS : HELI_ART.finP) * w);
          for (let i = 0; i < quarter; i++) {
            const f = (i + 0.5) / quarter,
              x = fx0 + (side > 0 ? f : 1 - f) * (fx1 - fx0);
            for (let py = LOFT; py < h; py++) {
              scheme.fin(out, x, fy0 + ((h - py - 0.5) / (h - LOFT)) * (fy1 - fy0), side);
              put(c0 + i, py);
            }
          }
        }
        // The cowl, lofted like the fuselage.
        if (cowl) {
          const c0 = Math.round(HELI_ART.cowl * w),
            c1 = Math.round(HELI_ART.cowlEnd * w);
          for (let px = c0; px < c1; px++) {
            const st = cowl.stationAt(cowl.x0 + ((px - c0 + 0.5) / (c1 - c0)) * (cowl.x1 - cowl.x0));
            for (let py = LOFT; py < h; py++) {
              heliSection(st, ((h - py - 0.5) / (h - LOFT)) * TAU - Math.PI / 2, pt);
              scheme.body(out, st.x, pt.y, pt.z, st);
              put(px, py);
            }
          }
        }
        pause();
        yield;
        resume();
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const g = canvas.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        if (scale === 1) g.putImageData(image, 0, 0);
        else {
          const small = document.createElement('canvas');
          small.width = w;
          small.height = h;
          small.getContext('2d').putImageData(image, 0, 0);
          g.drawImage(small, 0, 0, W, H);
        }
        scheme.swatches.forEach((rgb, i) => {
          g.fillStyle = `rgb(${rgb.map(Math.round).join(',')})`;
          g.fillRect(Math.round(HELI_ART.swatch * W + (i * W) / 40), Math.round(H * (1 - HELI_BAND)), Math.ceil(W / 40), Math.round(H * HELI_BAND));
        });
        const surfaces = heliSurfaces(plan, cowl, W, H);
        // Pinstripes: bands of constant width along a height curve on both sides,
        // broken where they would cross the glazing's seals.
        for (const line of scheme.lines || []) {
          g.fillStyle = line.color;
          const x0 = line.x0 ?? plan.x0 + 0.3,
            x1 = line.x1 ?? plan.x1 - 0.3,
            n = Math.ceil(((x1 - x0) / span) * (W / 3));
          for (const side of [-1, 1]) {
            let run = [];
            const flush = () => {
              if (run.length > 1) {
                g.beginPath();
                run.forEach(([x, y, width]) => g.lineTo(...surfaces.body.side(x, y + width / 2, side)));
                for (let i = run.length - 1; i >= 0; i--) g.lineTo(...surfaces.body.side(run[i][0], run[i][1] - run[i][2] / 2, side));
                g.closePath();
                g.fill();
              }
              run = [];
            };
            for (let i = 0; i <= n; i++) {
              const x = x0 + ((x1 - x0) * i) / n,
                y = line.y(x),
                st = heliStation(plan, x),
                width = typeof line.width === 'function' ? line.width(x, st) : line.width;
              if (plan.windows(x, y, heliSurfaceZ(st, y, side), st, look.roofGlass) < 0.95 + width / 2 || y > st.yt - 0.05 || y < st.yb + 0.05) flush();
              else run.push([x, y, width]);
            }
            flush();
          }
        }
        // Words, registrations and emblems, warped onto the surfaces.
        for (const word of scheme.words || []) {
          heliPaintWord(g, surfaces, word, W / span);
          pause();
          yield;
          resume();
        }
        const texture = policeCanvasTexture(canvas);
        pause();
        texture.userData.paintMs = Math.round(busy);
        heliLiveryTextures.set(look.key, texture);
        heliLiveryJobs.delete(look.key);
        return texture;
      }
      const heliSwatchUv = (name) => [HELI_ART.swatch + (HELI_SWATCH[name] + 0.5) / 40, HELI_BAND / 2];
      // The fin's faces into their halves of the fin art (the port face mirrored).
      function heliFinUv(geo, art) {
        const [fx0, fx1, fy0, fy1] = art,
          pos = geo.attributes.position,
          nor = geo.attributes.normal,
          uv = geo.attributes.uv;
        for (let k = 0; k < pos.count; k++) {
          const f = clamp((pos.getX(k) - fx0) / (fx1 - fx0), 0.004, 0.996),
            v = HELI_BAND * clamp((pos.getY(k) - fy0) / (fy1 - fy0), 0.01, 0.99);
          uv.setXY(k, nor.getZ(k) < -0.3 ? HELI_ART.finP + 0.25 * (1 - f) : HELI_ART.finS + 0.25 * f, v);
        }
      }
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
      // Geometry depends only on the kind (paint and scheme are the livery's), so the
      // civil schemes, executive paints and resprays share one kit.
      const heliKits = new Map();
      function heliKit(look) {
        if (heliKits.has(look.kind)) return heliKits.get(look.kind);
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
            if (plan.windows(cx, cy, cz, st, look.roofGlass) < 0) {
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
        // ---- Cowlings / fairings / nacelles on top ----
        // The first `art` top is lofted into the livery (its own columns of the bottom
        // band, painted by the scheme like the fuselage); the rest take a swatch.
        let cowl = null;
        for (const top of plan.tops) {
          const txs = [];
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
            art = top.art && !cowl,
            swatch = heliSwatchUv(top.swatch || 'cowl'),
            base = paint.count,
            white = col('#ffffff');
          if (art) cowl = { stationAt: topStation, x0: top.x0, x1: top.x1 };
          for (let i = 0; i < tg.rows; i++)
            for (let j = 0; j < tg.cols; j++) {
              const k = (i * tg.cols + j) * 3,
                u = art ? HELI_ART.cowl + ((HELI_ART.cowlEnd - HELI_ART.cowl) * (tg.P[k] - top.x0)) / (top.x1 - top.x0) : swatch[0],
                v = art ? (HELI_BAND * j) / (tg.cols - 1) : swatch[1];
              heliPushVertex(paint, tg.P[k], tg.P[k + 1], tg.P[k + 2] + top.z, tg.N[k], tg.N[k + 1], tg.N[k + 2], u, v, white);
            }
          for (let i = 0; i < tg.rows - 1; i++)
            for (let j = 0; j < tg.cols - 1; j++) {
              const a = base + i * tg.cols + j,
                b = a + tg.cols;
              paint.index.push(a, b, b + 1, a, b + 1, a + 1);
            }
        }
        // ---- Fins (and the fenestron's shroud), stabiliser and endplates ----
        const fenestron = look.tail === 'fenestron' && plan.fenestron;
        {
          const t = plan.fin.thick,
            bevel = Math.min(0.3, t * 0.35);
          for (const outline of fenestron ? plan.fin.fenestron : plan.fin.rotor) {
            const shape = new Three.Shape(outline.map(([x, y]) => new Three.Vector2(x, y))),
              fin = new Three.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 20 });
            fin.translate(0, 0, -t / 2);
            heliFinUv(fin, plan.fin.art);
            policeAddMatrix(paint, fin, heliMatrix.identity(), '#ffffff');
            fin.dispose();
          }
          if (fenestron) {
            // The shroud: a thick ring round the fan, its duct lined, stators and hub inside.
            const f = fenestron,
              ring = new Three.Shape(),
              hole = new Three.Path();
            ring.absarc(f.x, f.y, f.shroud - 0.45, 0, TAU, false);
            hole.absarc(f.x, f.y, f.radius + 0.6, 0, TAU, true);
            ring.holes.push(hole);
            const shroud = new Three.ExtrudeGeometry(ring, { depth: f.thick - 0.9, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.45, bevelSegments: 3, curveSegments: 36 });
            shroud.translate(0, 0, -(f.thick - 0.9) / 2);
            heliFinUv(shroud, plan.fin.art);
            policeAddMatrix(paint, shroud, heliMatrix.identity(), '#ffffff');
            shroud.dispose();
            const duct = new Three.CylinderGeometry(f.radius + 0.18, f.radius + 0.18, f.thick + 0.2, 36, 1, true);
            duct.rotateX(Math.PI / 2);
            duct.translate(f.x, f.y, 0);
            policeAddMatrix(trim, duct, heliMatrix.identity(), '#1c1f23');
            duct.dispose();
            for (let s = 0; s < 3; s++) {
              const a = 0.5 + (s * TAU) / 3;
              heliRod(trim, [f.x, f.y, 0.55], [f.x + Math.cos(a) * (f.radius + 0.2), f.y + Math.sin(a) * (f.radius + 0.2), 0.55], 0.2, '#34373c', boxGeo, 0.5);
            }
            policeAdd(trim, S.cylinder, f.x, f.y, 0.45, 1.05, 1.1, 1.05, '#34373c', null, Math.PI / 2);
          }
        }
        {
          const s = plan.stab,
            stab = roundedBar(s.span * 2, s.thick, s.chord, s.thick * 0.48);
          policeAdd(paint, stab, s.x, s.y, 0, 1, 1, 1, '#ffffff', { uv: heliSwatchUv('stab') }, 0, 0, 0);
          if (s.plate)
            for (const side of [-1, 1]) {
              const plate = roundedBar(0.42, s.plate[1], s.plate[0], 0.2);
              // Swept back a little, like the real endplates.
              policeAdd(paint, plate, s.x - 0.4, s.y + 0.4, side * (s.span + 0.14), 1, 1, 1, '#ffffff', { uv: heliSwatchUv('plate') }, 0, 0, 0.22);
            }
        }
        // ---- Airframe equipment, interior, crew ----
        const crew = { pilot: policeSet(), observer: policeSet() },
          kitParts = { plan, look, S, col, paint, glass, interior, trim, metal, lights, anchors, crew, stationAt };
        if (plan.name === 'colibri') heliColibriEquipment(kitParts);
        else if (plan.name === 'robin') heliRobinEquipment(kitParts);
        else heliHawkEquipment(kitParts);
        heliCabin(kitParts);
        // ---- Decals (glyph quads: only the Black Hawk's stencils) ----
        const scheme = heliScheme(look),
          decals = policeSet();
        scheme.decals?.((text, o) => heliText(decals, plan, text, o));
        // ---- Rotors ----
        const rotor = heliRotorParts(plan.rotor, look, look.kind === 'military'),
          tail = fenestron ? heliFenestronParts(fenestron, look) : heliTailRotorParts(plan.tailRotor, look);
        const kit = {
          plan,
          cowl,
          fenestron,
          paint: policeGeometry(paint, { colors: false }),
          glass: policeGeometry(glass, { colors: false }),
          interior: policeGeometry(interior),
          pilot: policeGeometry(crew.pilot),
          observer: policeGeometry(crew.observer),
          trim: policeGeometry(trim),
          metal: metal.count ? policeGeometry(metal) : null,
          lights: policeGeometry(lights, { channels: true }),
          decals: decals.count ? policeGeometry(decals) : null,
          anchors,
          rotor,
          tail,
          nightsun: kitParts.nightsun || null,
        };
        heliKits.set(look.kind, kit);
        return kit;
      }
      // ---- Shared light-single parts: skids, lamps ----------------------------------------------
      /*
       * Tubular skids with upturned toes, arched cross tubes clamped to the belly,
       * saddles and wear shoes. `o`: half track z, skid tube from x0 to x1 (the toe
       * curls up ahead of x1), height y, tube radius r, cross tubes, shoes.
       */
      function heliSkids(k, o) {
        const { trim, S, stationAt, look } = k,
          c = look.skid;
        for (const side of [-1, 1]) {
          const z = side * o.z;
          heliTube(trim, [[o.x0, o.y + 0.25, z], [o.x0 + 1.2, o.y, z], [(o.x0 + o.x1) / 2, o.y, z], [o.x1, o.y, z], [o.x1 + 2.6, o.y + 0.65, z], [o.x1 + 3.9, o.y + 2.3, z]], o.r, c, 40);
          policeAdd(trim, S.sphere, o.x0 - 0.02, o.y + 0.25, z, o.r, o.r, o.r, c);
          for (const x of o.shoes) policeAdd(trim, boxGeo, x, o.y - o.r * 0.95, z, 3.0, 0.2, o.r * 1.5, '#55595e');
        }
        for (const x of o.cross) {
          const keel = stationAt(x).yb + 0.3,
            h = o.z;
          heliTube(
            trim,
            [[x, o.y, -h], [x, o.y + 2.0, -h + 0.1], [x, keel - 0.5, -h * 0.74], [x, keel, -h * 0.4], [x, keel, 0], [x, keel, h * 0.4], [x, keel - 0.5, h * 0.74], [x, o.y + 2.0, h - 0.1], [x, o.y, h]],
            o.r * 1.12,
            c,
            40,
          );
          for (const side of [-1, 1]) policeAdd(trim, boxGeo, x, o.y + 0.25, side * h, 1.6, o.r * 2.2, o.r * 2.6, c);
        }
      }
      // A lens on the lights mesh (police light shader channel `ch`).
      function heliLens(k, ch, color, x, y, z, sx, sy, sz, geo = k.S.sphere) {
        policeAdd(k.lights, geo, x, y, z, sx, sy, sz, color, { channel: ch });
      }
      // Navigation lights (red port, green starboard) and white strobes at z = ±span.
      function heliNavLights(k, x, y, span, strobeX) {
        for (const side of [-1, 1]) {
          const z = side * span,
            navColor = side < 0 ? '#ff3a2c' : '#3dff79',
            ch = side < 0 ? HELI_CH.navRed : HELI_CH.navGreen;
          heliLens(k, ch, navColor, x, y, z, 0.5, 0.45, 0.35);
          heliLens(k, HELI_CH.strobe, '#ffffff', strobeX, y, z, 0.42, 0.38, 0.3);
          k.anchors.push({ x: x + 0.2, y, z: z + side * 0.3, size: 7, color: navColor, channel: ch, strength: 1 });
          k.anchors.push({ x: strobeX, y, z: z + side * 0.3, size: 18, color: '#ffffff', channel: HELI_CH.strobe, strength: 1 });
        }
      }
      function heliBeacon(k, x, y, lift) {
        heliLens(k, HELI_CH.beacon, '#ff2a1e', x, y, 0, 0.62, 0.45 * Math.sign(lift), 0.62, k.S.dome);
        k.anchors.push({ x, y: y + lift, z: 0, size: 12, color: '#ff3326', channel: HELI_CH.beacon, strength: 1 });
      }
      // ---- EC120 class (the police) equipment -----------------------------------------------------
      function heliColibriEquipment(k) {
        const { plan, look, S, trim, metal, anchors, stationAt } = k,
          dark = '#16181b',
          grey = '#383c41',
          police = look.kind === 'police';
        heliSkids(k, { z: 9.0, x0: -6.4, x1: 24.4, y: 0.9, r: 0.5, cross: [19.4, 1.4], shoes: [-2, 9, 19] });
        // Boarding steps on the cross tubes' legs.
        for (const side of [-1, 1])
          for (const x of [19.4, 1.4]) policeAdd(trim, boxGeo, x + 1.5, 3.0, side * 8.2, 2.4, 0.22, 1.5, '#43474c');
        // Cowl: intake grilles, the exhaust at its tail, the mast fairing and swashplate.
        for (const side of [-1, 1]) {
          policeAdd(trim, boxGeo, 12.2, 21.9, side * 3.95, 4.2, 1.1, 0.14, dark);
          for (let g = 0; g < 5; g++) policeAdd(trim, boxGeo, 10.6 + g * 0.8, 21.9, side * 4.02, 0.12, 1.0, 0.1, '#4b4f54');
          // The door handles.
          for (const [x, y] of [
            [16.6, 12.6],
            [4.2, 12.2],
          ])
            policeAdd(metal, boxGeo, x, y, heliSurfaceZ(stationAt(x), y, side) + side * 0.12, 1.2, 0.28, 0.2, '#b7bcc1');
        }
        heliRod(metal, [-12.2, 20.6, 0], [-15.4, 21.6, 0], 1.25, '#4a4d51', S.cylinder, 0.9);
        heliRod(trim, [-15.3, 21.57, 0], [-15.6, 21.66, 0], 1.0, '#0b0b0c', S.cylinder, 0.7);
        policeAdd(trim, S.cylinder, plan.rotor.x, 23.9, 0, 1.55, 0.9, 1.55, grey);
        policeAdd(metal, S.cylinder, plan.rotor.x, 24.6, 0, 2.1, 0.35, 2.1, '#7c8288');
        // Antennas: blade on the cowl's tail, GPS dome, VHF whips and blades under the belly, pitot.
        policeAdd(trim, boxGeo, -14.2, 19.4, 0, 1.3, 1.6, 0.14, dark, null, 0, 0, 0.4);
        policeAdd(trim, S.sphere, -9.5, 22.3, 0, 0.8, 0.32, 0.8, '#e4e4e0');
        policeAdd(trim, boxGeo, -2.5, 5.9, 0, 1.5, 1.6, 0.14, dark, null, 0, 0, -0.4);
        policeAdd(trim, boxGeo, -17.5, 12.1, 0, 1.3, 1.4, 0.14, dark, null, 0, 0, -0.4);
        heliRod(trim, [13, 5.6, 1.6], [11.2, 3.7, 1.8], 0.08, dark);
        heliRod(metal, [26.4, 19.3, 1.2], [29.4, 19.4, 1.2], 0.09, '#9aa0a6');
        // Tail bumper under the ventral fin.
        heliRod(trim, [-43.6, 8.8, 0], [-46.0, 7.7, 0], 0.26, look.skid);
        if (police) {
          // Wire strike cutters over the canopy and under the chin.
          policeAdd(trim, boxGeo, 29.4, 19.2, 0, 3.2, 0.85, 0.16, '#2b2e32', null, 0, 0, -0.45);
          policeAdd(trim, boxGeo, 36.6, 7.2, 0, 2.4, 0.7, 0.16, '#2b2e32', null, 0, 0, 0.55);
          // FLIR turret under the nose: yoke, ball and its window.
          policeAdd(trim, boxGeo, 33.4, 5.95, 0, 1.4, 0.9, 1.4, grey);
          policeAdd(trim, S.sphere, 33.5, 4.55, 0, 1.55, 1.55, 1.55, '#3b3f45');
          policeAdd(trim, boxGeo, 34.95, 4.5, 0, 0.3, 1.45, 1.9, '#07090c');
          policeAdd(trim, S.sphere, 35.08, 4.85, 0.42, 0.26, 0.32, 0.32, '#3d6c8c');
          policeAdd(trim, S.sphere, 35.08, 4.2, -0.4, 0.2, 0.24, 0.24, '#6a4a86');
          // The Nightsun's bracket from the belly to its gimbal.
          const m = HELI_SEARCHLIGHT_MOUNT;
          heliRod(trim, [m.x + 0.6, stationAt(m.x).yb + 0.4, m.z * 0.5], [m.x, m.y + 1.2, m.z], 0.34, grey, boxGeo);
          policeAdd(trim, boxGeo, m.x, m.y + 1.25, m.z, 1.5, 0.4, 1.5, grey);
          // PA speaker under the starboard cabin.
          policeAdd(trim, boxGeo, 3.6, 4.95, 3.8, 2.4, 1.2, 1.5, '#1e2124');
          policeAdd(trim, boxGeo, 4.85, 4.95, 3.8, 0.1, 0.95, 1.2, '#4c5055');
          k.nightsun = heliNightsunParts(S);
        }
        // ---- Lamps ----
        const s = plan.stab;
        heliNavLights(k, s.x + 0.9, s.y + 3.9, s.span + 0.45, s.x - 1.2);
        heliLens(k, HELI_CH.navWhite, '#fff6e6', -45.7, 16.4, 0, 0.36, 0.42, 0.42);
        anchors.push({ x: -46.0, y: 16.4, z: 0, size: 7, color: '#fff4e0', channel: HELI_CH.navWhite, strength: 1 });
        heliBeacon(k, -15.9, 18.95, 0.4);
        heliBeacon(k, 2.5, stationAt(2.5).yb + 0.05, -0.4);
        for (const z of [-1.4, 1.4]) {
          heliLens(k, HELI_CH.work, '#fff8e8', 30.2, 5.95, z, 0.75, 0.28, 0.75);
          anchors.push({ x: 30.6, y: 5.6, z, size: 13, color: '#fff3d6', channel: HELI_CH.work, strength: 0.8 });
        }
        if (police) {
          // Red (port) and blue (starboard) LED strobes: bars under the doors, a pair
          // flanking the nose, pods on the boom and a pair on the fin tip.
          for (const side of [-1, 1]) {
            const ch = side < 0 ? HELI_CH.red : HELI_CH.blue,
              color = side < 0 ? '#ff2d22' : '#2f62ff';
            for (let x = 5; x <= 20; x += 3) {
              const z = heliSurfaceZ(stationAt(x), 7.2, side) + side * 0.1;
              heliLens(k, ch, color, x, 7.2, z, 2.3, 0.4, 0.22, boxGeo);
              if (x % 6 === 5) anchors.push({ x, y: 7.2, z: z + side * 0.4, size: 10, color, channel: ch, strength: 1 });
            }
            const nz = heliSurfaceZ(stationAt(35.4), 8.4, side) + side * 0.08;
            heliLens(k, ch, color, 35.4, 8.4, nz, 1.1, 0.5, 0.3, boxGeo);
            anchors.push({ x: 35.8, y: 8.4, z: nz + side * 0.3, size: 11, color, channel: ch, strength: 1 });
            const bz = heliSurfaceZ(stationAt(-28.5), 14.4, side) + side * 0.14;
            heliLens(k, ch, color, -28.5, 14.4, bz, 1.5, 0.5, 0.28, boxGeo);
            anchors.push({ x: -28.5, y: 14.4, z: bz + side * 0.4, size: 9, color, channel: ch, strength: 1 });
          }
          heliLens(k, HELI_CH.red, '#ff2d22', -42.8, 27.2, 0, 0.9, 0.42, 0.7, boxGeo);
          heliLens(k, HELI_CH.blue, '#2f62ff', -44.6, 27.3, 0, 0.9, 0.42, 0.7, boxGeo);
          anchors.push({ x: -42.8, y: 27.7, z: 0, size: 12, color: '#ff2d22', channel: HELI_CH.red, strength: 1 });
          anchors.push({ x: -44.6, y: 27.8, z: 0, size: 12, color: '#2f62ff', channel: HELI_CH.blue, strength: 1 });
        } else heliBeacon(k, -43.8, 27.4, 0.45);
      }
      // ---- R44 / R66 class (the civilians) equipment ---------------------------------------------
      function heliRobinEquipment(k) {
        const { plan, look, S, trim, metal, anchors, stationAt } = k,
          dark = '#17191c',
          grey = '#3a3e43',
          news = look.kind === 'news';
        heliSkids(k, { z: 8.3, x0: -11.4, x1: 19.0, y: 0.8, r: 0.42, cross: [13.4, -4.4], shoes: [-7, 4, 14] });
        for (const side of [-1, 1]) policeAdd(trim, boxGeo, 14.8, 2.8, side * 7.6, 2.0, 0.2, 1.2, '#4a4e53');
        // The mast: a boot where it leaves the fairing, the swashplate.
        policeAdd(trim, S.cylinder, plan.rotor.x, 21.2, 0, 1.15, 0.9, 1.15, grey);
        policeAdd(metal, S.cylinder, plan.rotor.x, 21.9, 0, 1.6, 0.3, 1.6, '#80868c');
        // Engine bay: cooling louvres each side, the exhaust under the starboard side.
        for (const side of [-1, 1]) {
          const z = heliSurfaceZ(stationAt(-7.4), 11.6, side);
          policeAdd(trim, boxGeo, -7.4, 11.6, z + side * 0.05, 3.2, 1.5, 0.12, dark, null, 0, side * -0.35, 0);
          for (let g = 0; g < 4; g++) policeAdd(trim, boxGeo, -8.6 + g * 0.8, 11.6, z + side * 0.1, 0.12, 1.3, 0.1, '#4b4f54', null, 0, side * -0.35, 0);
          // Door handles.
          for (const [x, y] of [
            [10.4, 10.4],
            [-1.6, 10.8],
          ])
            policeAdd(metal, boxGeo, x, y, heliSurfaceZ(stationAt(x), y, side) + side * 0.1, 1.0, 0.24, 0.18, '#b7bcc1');
        }
        heliRod(metal, [-9, 8.8, 2.2], [-14.2, 9.6, 2.5], 0.42, '#6d7176');
        heliRod(trim, [-14.1, 9.58, 2.5], [-14.4, 9.62, 2.5], 0.34, '#0b0b0c');
        // Antennas and pitot; the tail rotor guard.
        policeAdd(trim, boxGeo, -20, 12.4, 0, 1.0, 1.3, 0.12, dark, null, 0, 0, -0.45);
        heliRod(trim, [2, 4.9, 1.2], [0.6, 3.4, 1.3], 0.07, dark);
        heliRod(metal, [11.5, 18.35, 0], [13.6, 18.4, 0], 0.08, '#9aa0a6');
        heliTube(trim, [[-38.2, 13.3, 0], [-40.4, 10.6, 0], [-43.2, 9.0, 0], [-45.8, 8.95, 0]], 0.2, look.skid, 16);
        // The tail rotor's gearbox and output shaft.
        const t = plan.tailRotor;
        policeAdd(trim, boxGeo, t.x, t.y, -0.55, 1.8, 1.9, 1.0, grey);
        policeAdd(trim, S.cylinder, t.x, t.y, t.z * 0.6, 0.45, 1.1, 0.45, grey, null, Math.PI / 2);
        if (news) {
          // The gyro-stabilised camera on the chin, the downlink dome under the boom.
          policeAdd(trim, boxGeo, 25.3, 5.6, 0, 1.5, 1.2, 1.5, grey);
          policeAdd(trim, S.sphere, 25.5, 3.7, 0, 1.75, 1.75, 1.75, '#e8e8e4');
          policeAdd(trim, boxGeo, 27.2, 3.6, 0, 0.36, 1.25, 1.45, '#08090b');
          policeAdd(trim, S.sphere, 27.35, 3.6, 0, 0.32, 0.5, 0.5, '#2f5d82');
          policeAdd(trim, S.sphere, -22, 12.5, 0, 1.6, 0.8, 1.2, '#e8e8e4');
        }
        // ---- Lamps ----
        const s = plan.stab;
        heliNavLights(k, s.x + 0.6, s.y, s.span + 0.3, s.x - 0.7);
        heliLens(k, HELI_CH.navWhite, '#fff6e6', -46.5, 15.4, 0, 0.32, 0.38, 0.38);
        anchors.push({ x: -46.8, y: 15.4, z: 0, size: 7, color: '#fff4e0', channel: HELI_CH.navWhite, strength: 1 });
        heliBeacon(k, -45.5, 22.1, 0.4);
        heliBeacon(k, 5, stationAt(5).yb + 0.05, -0.4);
        // Landing lights in the nose.
        for (const z of [-1.1, 1.1]) {
          heliLens(k, HELI_CH.work, '#fff8e8', 27.7, 8.2, z, 0.3, 0.6, 0.6);
          anchors.push({ x: 28.2, y: 8.2, z, size: 13, color: '#fff3d6', channel: HELI_CH.work, strength: 0.8 });
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
          const z = side * 11.2;
          policeAdd(trim, boxGeo, 13, 8.2, side * 8.9, 6.5, 2.2, 1.8, od);
          heliRod(metal, [13.6, 8.1, side * 9.2], [12.4, 3.6, z], 0.55, '#7d8279');
          heliRod(trim, [18.5, 7.3, side * 8.2], [12.6, 3.8, z - side * 0.6], 0.4, grey);
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
        const panel = plan.panel || 5.2;
        policeAdd(interior, boxGeo, dash + 0.9, floor + 4.5, 0, 2.2, 3.4, panel * 2, '#1f2124');
        policeAdd(interior, boxGeo, dash + 1.5, floor + 6.35, 0, 3.4, 0.45, panel * 2 + 0.8, '#141517');
        for (const z of [-panel / 2, panel / 2])
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
                cw = r < root + 1 ? chord * 0.6 : chord * (1 - (rotor.taper ?? 0.4) * tipF),
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
        const n = f.blades || 10;
        for (let i = 0; i < n; i++) {
          // Unevenly spaced, as a real fenestron's are (less of a whine).
          const a = (i * TAU) / n + 0.12 * Math.sin(i * 2.4),
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
          disc: { blades: n, hub: 0.27, tip: 1.2, trail: 0.12, smear: 0.22, color: '#2a2d31', tipColor: '#2a2d31' },
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
        const livery = heliLiveryTexture(look, kit),
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
        if (kit.decals) quiet(mesh(kit.decals, policeGlyphs().material, body, 0, 0, 0));
        const lights = quiet(mesh(kit.lights, lightMaterial, body, 0, 0, 0));
        lights.receiveShadow = false;
        // Main rotor: hub and blades spin in `rotor`; the blur disc stays still.
        const rotor = new Three.Group();
        rotor.position.set(kit.rotor.x, 0, 0);
        // Parked, no blade lies along the fuselage (it would hide the roof and boom).
        rotor.rotation.y = kit.plan.rotor.park ?? Math.PI / 4;
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
          // Built at real size: the renderer's DESIGN SIZE never scales it.
          realSize: true,
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
        // The player's machine follows the flight model's own rotor spool (the HUD's ROTOR).
        const spool = c === player.car && alive ? c.rotorSpeed || 0 : null;
        if (m.rpm < 0) m.rpm = spool ?? (running ? 1 : 0);
        const rate = running ? 0.26 : alive ? 0.11 : 0.6;
        if (spool !== null) m.rpm += (spool - m.rpm) * (1 - Math.exp(-dt * 5));
        else m.rpm = running ? Math.min(1, m.rpm + dt * rate) : Math.max(0, m.rpm - dt * rate);
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
        m.glass.opacity = 0.46 + wear * 0.4;
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
        // Police livery: the reflective lettering and pinstripes catch the light at night.
        if (m.look.reflective) {
          const glow = m.charred ? -1 : Math.round(lampsOn * 20) / 20;
          if (m.reflective !== glow) {
            m.reflective = glow;
            if (glow >= 0) m.paint.emissive.setScalar(glow * 0.08);
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
          scheme: m.look?.scheme || null,
          // Milliseconds the look's livery took to paint (once per look).
          liveryMs: m.liveryMap?.userData.paintMs ?? null,
        };
      }
      // END SUBSYSTEM: src/helicopter3d.js
