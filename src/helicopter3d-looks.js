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
