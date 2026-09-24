      // BEGIN SUBSYSTEM: src/plane3d.js — Airplane meshes
      /**
       * Airplane meshes
       * Source: src/plane3d.js
       * Scope: createCityRenderer() closure.
       * Three procedurally built airframes modelled on real types: the Serrano C200
       * courier (the mission 11 aircraft; a low-wing single turboprop with a T-tail,
       * after the Pilatus PC-12), the Aurelia J8 executive jet (T-tail, rear-mounted
       * turbofans) and the Meridian 220 narrow-body airliner (wing-mounted
       * turbofans).
       *
       * CONSTRUCTION (buildAircraft(kind, parent, options))
       *   Fuselage  lofted through the plan's stations [x, half width, top, bottom,
       *             widest height] with monotone cubic interpolation and a
       *             superellipse cross-section, then painted by a livery texture
       *             computed per pixel from the same surface (aircraftLivery): the
       *             windscreen and cockpit side glass with frames, rounded cabin
       *             windows, door seams, cheatline, belly, anti-glare panel and the
       *             registration. The texture's roughness / metalness map makes the
       *             glass glossy and the paint satin; it is cached per kind and
       *             accent colour.
       *   Surfaces  wings, stabiliser, fin, winglets and strakes are lofted NACA
       *             sections (liftingSurface); flaps, ailerons, elevators and rudder
       *             are separate parts in hinge pivots, so they deflect.
       *   Engines   a four-blade propeller with a spinner and a blur disc, cowl,
       *             exhausts and chin intake; or lathed turbofan nacelles with a lip,
       *             spinning fan, exhaust cone and pylons.
       *   Gear      struts, wheels and doors in retraction pivots (inward for the
       *             mains, aft or forward for the nose), wheels in spin pivots.
       *   Lights    red / green navigation, white tail, double-flash white strobes,
       *             red beacons, landing and taxi lights (halos).
       * Static parts are merged per material (a few draw calls per aircraft); moving
       * parts stay separate. Local +X is forward, +Z the right wing, the wheels rest
       * on y = 0 and the footprint matches AIRFRAME_SPECS (collision uses it).
       *
       * ANIMATION (animateAircraft(c, m, deltaSeconds), from render3d.js)
       *   control surfaces follow the stick and pedals (c.ctrlPitch, c.ctrlRoll,
       *   c.ctrlYaw) and the flaps c.flapPos; the gear follows c.gearPos; the
       *   propeller or fans spin with c.power; the lights run while the engine
       *   does; the airframe shakes with c.buffet. parkedJet() (world3d.js) uses the
       *   same builder for static apron aircraft.
       *
       * Everything here is a function declaration: world3d.js builds parked
       * aircraft before this fragment's constants would be initialised.
       */
      function aircraftPlans() {
        return {
          courier: {
            // Pilatus PC-12 proportions: 100 long, 100 span.
            stations: [
              [46, 3.6, 15.4, 8.4, 11.9],
              [43.5, 4.9, 16.7, 7.5, 12],
              [38, 5.7, 17.5, 7.1, 12.1],
              [32, 6.2, 18.3, 6.9, 12.3],
              [26, 6.6, 20.4, 6.8, 12.7],
              [19, 6.9, 21.8, 6.8, 13.1],
              [11, 7, 22.3, 6.8, 13.3],
              [-2, 7, 22.3, 6.9, 13.3],
              [-12, 6.6, 21.9, 7.5, 13.5],
              [-22, 5.7, 21, 8.8, 14.2],
              [-32, 4.4, 20, 10.8, 15.1],
              [-41, 3, 19, 13, 16],
              [-48, 1.7, 18.3, 14.8, 16.6],
              [-51, 0.5, 17.5, 15.9, 16.8],
            ],
            squareness: 2.25,
            wing: {
              x: 10, y: 8.8, span: 50, rootChord: 17, tipChord: 8.5, sweep: 1.5,
              dihedral: 0.075, thickness: 0.15, hinge: 0.73,
              flap: [0.1, 0.6], aileron: [0.62, 0.94],
              winglet: { height: 6.5, chord: 5.5, tipChord: 2.6, sweep: 3.2, cant: 0.28 },
            },
            fin: { x: -32, y: 17.5, height: 17, rootChord: 17, tipChord: 9.5, sweep: 12, thickness: 0.11, hinge: 0.64 },
            dorsal: { x: -20, y: 20, height: 4.5, rootChord: 13, tipChord: 1, sweep: 11 },
            stab: { x: -44.2, y: 34.3, span: 17, rootChord: 10, tipChord: 6, sweep: 4, thickness: 0.1, hinge: 0.62, dihedral: -0.02 },
            strakes: { x: -40, y: 13.6, length: 9, depth: 3.2 },
            prop: { x: 47.5, y: 11.9, blades: 4, radius: 10.2, spinner: 5.8, spinnerRadius: 3.7 },
            exhausts: { x: 37.5, y: 12.6, z: 5.6 },
            intake: { x: 43.5, y: 8.6 },
            gear: {
              nose: { x: 36, top: 8.4, r: 2.4, width: 1.5, retract: 'aft' },
              main: { x: 4, z: 12.5, top: 8.6, r: 3.2, width: 2, retract: 'in', trailing: true },
            },
            livery: {
              windscreen: { front: 30, roof: 22.8, rear: 15.2, y0: 17.4, y0Rear: 17.9, sideTop: 20.9 },
              antiGlare: { x0: 29.5, x1: 35, band: 1.3 },
              windows: { xs: [11.2, 4.7, -1.8, -8.3, -14.8], y: 16.5, w: 3.6, h: 3.4, r: 1.1 },
              doors: [
                { x0: 15, x1: 8.6, y0: 8.4, y1: 20.2, side: -1, window: 11.8 },
                { x0: -11.6, x1: -22.8, y0: 9.6, y1: 20.0, side: -1, window: -17.2 },
              ],
              stripe: { y0: 11.7, y1: 13.1, pin0: 13.5, pin1: 13.9, sweepFrom: -10, sweep: 0.36 },
              belly: 9.3,
              registration: { x0: -26.5, x1: -38.5, y0: 14.8, y1: 17.2 },
            },
            nav: { tail: [-51.2, 16.8] },
            beacons: [[-4, 22.3, 0], [2, 6.8, 0]],
            // Landing lights in the wing leading edges, at these span fractions.
            landingLights: [0.34],
            logo: 'SERRANO AIR',
            registration: 'N200SC',
            accent: '#b8503c',
          },
          jet: {
            stations: [
              [75, 0.4, 17.4, 16.6, 17],
              [70, 3, 19, 13, 16],
              [64, 5.2, 21.4, 11, 16.2],
              [58, 7, 23.6, 9.3, 16.6],
              [48, 8.6, 26, 8, 17],
              [30, 8.8, 26.6, 7.4, 17],
              [-20, 8.8, 26.6, 7.4, 17],
              [-40, 7.6, 26.4, 9.2, 17.8],
              [-56, 5, 25.6, 13.6, 19.6],
              [-68, 2.8, 25.2, 18, 21.6],
              [-75, 0.6, 23.2, 22, 22.6],
            ],
            squareness: 2.1,
            wing: {
              x: 16, y: 11.5, span: 59, rootChord: 32, tipChord: 11, sweep: 24,
              dihedral: 0.07, thickness: 0.11, hinge: 0.74,
              flap: [0.14, 0.62], aileron: [0.64, 0.93],
              winglet: { height: 8, chord: 8, tipChord: 3.2, sweep: 5, cant: 0.22 },
            },
            fin: { x: -48, y: 24.5, height: 25, rootChord: 24, tipChord: 12, sweep: 14, thickness: 0.1, hinge: 0.66 },
            dorsal: { x: -34, y: 25.6, height: 3.5, rootChord: 16, tipChord: 1, sweep: 13 },
            stab: { x: -61.5, y: 49.3, span: 23, rootChord: 13, tipChord: 7, sweep: 9, thickness: 0.09, hinge: 0.64, dihedral: -0.03 },
            engines: [
              { x: -38, y: 25, z: 15, r: 5, len: 24, pylon: 'side' },
              { x: -38, y: 25, z: -15, r: 5, len: 24, pylon: 'side' },
            ],
            gear: {
              nose: { x: 52, top: 9.5, r: 2.8, width: 1.8, retract: 'fwd', twin: true },
              main: { x: -4, z: 11.5, top: 11, r: 3.4, width: 2.2, retract: 'in' },
            },
            livery: {
              windscreen: { front: 62, roof: 56.5, rear: 50, y0: 20.8, y0Rear: 21.3, sideTop: 24.6 },
              antiGlare: { x0: 61.5, x1: 66, band: 1.2 },
              windows: { from: 42, to: -30, step: 7, y: 20.2, w: 2.8, h: 3.6, r: 1.35 },
              doors: [{ x0: 47.4, x1: 41.2, y0: 10, y1: 24.6, side: -1 }],
              stripe: { y0: 14.2, y1: 15.8, pin0: 16.3, pin1: 16.8, sweepFrom: -34, sweep: 0.32 },
              belly: 10.2,
              registration: { x0: -42, x1: -58, y0: 18.4, y1: 21.6 },
            },
            nav: { tail: [-75.4, 22.6] },
            beacons: [[-10, 26.7, 0], [6, 7.3, 0]],
            landingLights: [0.2],
            logo: 'AURELIA',
            registration: 'N8AJ',
            accent: '#2f4a63',
          },
          airliner: {
            stations: [
              [107, 0.5, 23.5, 22.5, 23],
              [102, 4.2, 25.4, 17.4, 21.4],
              [96, 7.2, 28.6, 14.8, 21.8],
              [88, 10, 32.4, 12.6, 22.5],
              [78, 11.6, 34.4, 11.6, 23],
              [60, 12, 35, 11, 23],
              [-56, 12, 35, 11, 23],
              [-74, 9.8, 35.4, 14.2, 24.8],
              [-90, 5.8, 35.2, 21.2, 28.2],
              [-102, 2.6, 34.8, 28, 31.4],
              [-107, 0.6, 33.2, 32, 32.6],
            ],
            squareness: 2,
            wing: {
              x: 20, y: 17, span: 74, rootChord: 46, tipChord: 13, sweep: 34,
              dihedral: 0.09, thickness: 0.11, hinge: 0.75,
              flap: [0.13, 0.66], aileron: [0.68, 0.93],
              winglet: { height: 10, chord: 10, tipChord: 3.5, sweep: 7, cant: 0.2 },
            },
            fin: { x: -80, y: 33.5, height: 33, rootChord: 34, tipChord: 14, sweep: 21, thickness: 0.1, hinge: 0.68 },
            dorsal: { x: -64, y: 34.2, height: 4, rootChord: 20, tipChord: 1, sweep: 17 },
            stab: { x: -90, y: 29, span: 31, rootChord: 20, tipChord: 9, sweep: 14, thickness: 0.09, hinge: 0.7, dihedral: 0.1 },
            engines: [
              { x: 12, y: 10, z: 30, r: 8, len: 32, pylon: 'wing' },
              { x: 12, y: 10, z: -30, r: 8, len: 32, pylon: 'wing' },
            ],
            gear: {
              nose: { x: 78, top: 12, r: 3.4, width: 2, retract: 'fwd', twin: true },
              main: { x: -6, z: 13, top: 15, r: 4.4, width: 2.6, retract: 'in', twin: true },
            },
            livery: {
              windscreen: { front: 96.5, roof: 90.5, rear: 84.5, y0: 27.6, y0Rear: 28, sideTop: 31.2 },
              antiGlare: { x0: 96, x1: 100, band: 1.2 },
              windows: { from: 58, to: -58, step: 6.5, y: 27, w: 2.6, h: 3.4, r: 1.25 },
              doors: [
                { x0: 70, x1: 63, y0: 15, y1: 31, side: 0 },
                { x0: -62.5, x1: -69.5, y0: 16, y1: 31.5, side: 0 },
              ],
              stripe: { y0: 17.5, y1: 19.6, pin0: 20.2, pin1: 20.9, sweepFrom: -60, sweep: 0.4 },
              belly: 15.5,
              registration: { x0: -76, x1: -92, y0: 26, y1: 30 },
            },
            nav: { tail: [-107.4, 32.6] },
            beacons: [[-4, 35.1, 0], [12, 10.9, 0]],
            landingLights: [0.22],
            logo: 'SOUTHPORT AIR',
            registration: 'N220MD',
            accent: '#1f6f8f',
          },
        };
      }
      function airfoilHalfThickness(t) {
        // NACA four-digit thickness distribution, normalised to a unit chord.
        return 0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1015 * t ** 4;
      }
      /* Monotone cubic (Fritsch-Carlson) through (xs, ys), xs ascending: smooth,
         with no overshoot between stations. */
      function aircraftCurve(xs, ys) {
        const n = xs.length,
          d = [],
          m = [];
        for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
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
            h = a * a + b * b;
          if (h > 9) {
            const k = 3 / Math.sqrt(h);
            m[i] = k * a * d[i];
            m[i + 1] = k * b * d[i];
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
          return (
            (2 * t3 - 3 * t2 + 1) * ys[i] +
            (t3 - 2 * t2 + t) * h * m[i] +
            (-2 * t3 + 3 * t2) * ys[i + 1] +
            (t3 - t2) * h * m[i + 1]
          );
        };
      }
      /* The fuselage surface: section(x) -> { hw, top, bottom, mid } and
         point(x, theta) -> { y, z }; theta 0 is the top, pi / 2 the right side. */
      function fuselageShape(plan) {
        const rows = [...plan.stations].sort((a, b) => a[0] - b[0]),
          xs = rows.map((r) => r[0]),
          curves = [1, 2, 3, 4].map((k) => aircraftCurve(xs, rows.map((r) => r[k]))),
          k = 2 / plan.squareness,
          section = (x, out = {}) => {
            out.hw = Math.max(0.05, curves[0](x));
            out.top = curves[1](x);
            out.bottom = curves[2](x);
            out.mid = curves[3](x);
            return out;
          };
        return {
          front: xs[xs.length - 1],
          tail: xs[0],
          lowest: Math.min(...rows.map((r) => r[3])),
          section,
          exponent: k,
          point(sec, theta, out = {}) {
            const s = Math.sin(theta),
              c = Math.cos(theta);
            out.z = sec.hw * Math.sign(s) * Math.pow(Math.abs(s), k);
            out.y = sec.mid + (c >= 0 ? sec.top - sec.mid : sec.mid - sec.bottom) * Math.sign(c) * Math.pow(Math.abs(c), k);
            return out;
          },
          // The angle round the section at a height on one side (+1 right, -1 left).
          theta(sec, y, side) {
            const r = y >= sec.mid ? sec.top - sec.mid : sec.mid - sec.bottom,
              c = clamp(Math.sign(y - sec.mid) * Math.pow(Math.min(1, Math.abs(y - sec.mid) / Math.max(0.01, r)), 1 / k), -1, 1),
              a = Math.acos(c);
            return side > 0 ? a : TAU - a;
          },
        };
      }
      function fuselageMesh(shape) {
        const along = 72,
          radial = 44,
          positions = [],
          uvs = [],
          indices = [],
          sec = {},
          p = {};
        for (let i = 0; i <= along; i++) {
          const u = i / along,
            x = shape.front + (shape.tail - shape.front) * u;
          shape.section(x, sec);
          for (let j = 0; j <= radial; j++) {
            shape.point(sec, (j / radial) * TAU, p);
            positions.push(x, p.y, p.z);
            uvs.push(u, 1 - j / radial);
          }
        }
        const ring = radial + 1;
        for (let i = 0; i < along; i++)
          for (let j = 0; j < radial; j++) {
            const a = i * ring + j,
              b = a + 1,
              d = a + ring,
              e = d + 1;
            indices.push(a, b, d, b, e, d);
          }
        // Caps at both ends (their own vertices, so the loft keeps smooth normals).
        for (const [i, front] of [
          [0, true],
          [along, false],
        ]) {
          const x = positions[i * ring * 3],
            centre = positions.length / 3;
          shape.section(x, sec);
          positions.push(x, sec.mid, 0);
          uvs.push(i / along, 0.5);
          for (let j = 0; j <= radial; j++) {
            positions.push(...positions.slice((i * ring + j) * 3, (i * ring + j) * 3 + 3));
            uvs.push(i / along, 0.5);
          }
          for (let j = 0; j < radial; j++)
            if (front) indices.push(centre, centre + 1 + j + 1, centre + 1 + j);
            else indices.push(centre, centre + 1 + j, centre + 1 + j + 1);
        }
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        // Weld the seam along the top: average the first and last column's normals.
        const normal = geometry.attributes.normal;
        for (let i = 0; i <= along; i++) {
          const a = i * ring,
            b = a + radial;
          const nx = normal.getX(a) + normal.getX(b),
            ny = normal.getY(a) + normal.getY(b),
            nz = normal.getZ(a) + normal.getZ(b),
            l = Math.hypot(nx, ny, nz) || 1;
          normal.setXYZ(a, nx / l, ny / l, nz / l);
          normal.setXYZ(b, nx / l, ny / l, nz / l);
        }
        return geometry;
      }
      /**
       * LIVERY
       * The fuselage texture is computed per pixel from the surface it wraps: each
       * texel knows its (x, y, z) on the loft, and the plan's livery says what is
       * there in side-view terms (heights and stations). Two canvases: colour, and
       * a roughness (G) / metalness (B) map for the glass.
       */
      function aircraftLivery(kind, plan, shape, accent) {
        const cache = aircraftLivery.cache || (aircraftLivery.cache = new Map()),
          key = kind + accent;
        if (cache.has(key)) return cache.get(key);
        const W = 2048,
          H = 512,
          L = plan.livery,
          colour = document.createElement('canvas'),
          surface = document.createElement('canvas');
        colour.width = surface.width = W;
        colour.height = surface.height = H;
        const cg = colour.getContext('2d'),
          sg = surface.getContext('2d'),
          image = cg.createImageData(W, H),
          finish = sg.createImageData(W, H),
          px = image.data,
          fx = finish.data,
          accentRgb = new Three.Color(accent),
          rgb = (hex) => {
            const c = new Three.Color(hex);
            return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
          };
        const WHITE = [246, 247, 245],
          BELLY = rgb('#c3c9cc'),
          ACCENT = [Math.round(accentRgb.r * 255), Math.round(accentRgb.g * 255), Math.round(accentRgb.b * 255)],
          PIN = rgb('#d6ae62'),
          GLASS = rgb('#0f1c26'),
          GLASS_HI = rgb('#29465a'),
          FRAME = rgb('#3a4248'),
          SEAM = rgb('#9aa3a8'),
          MATT = rgb('#23292e');
        const sec = {},
          windows = [...(L.windows.xs || [])];
        if (L.windows.from !== undefined)
          for (let x = L.windows.from; x > L.windows.to; x -= L.windows.step) windows.push(x);
        const doorSpans = L.doors.map((d) => [Math.min(d.x0, d.x1) - 0.8, Math.max(d.x0, d.x1) + 0.8, d.side]);
        // Rounded rectangle in side view: -1 outside, 0 frame ring, 1 inside.
        function roundRect(x, y, cx, cy, w, h, r, ring) {
          const dx = Math.abs(x - cx) - (w / 2 - r),
            dy = Math.abs(y - cy) - (h / 2 - r),
            d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
          return d < 0 ? 1 : d < ring ? 0 : -1;
        }
        const ws = L.windscreen,
          st = L.stripe,
          // Section angles per row, raised to the superellipse exponent once.
          rowS = new Float32Array(H),
          rowC = new Float32Array(H);
        for (let row = 0; row < H; row++) {
          const theta = ((row + 0.5) / H) * TAU,
            s = Math.sin(theta),
            c = Math.cos(theta);
          rowS[row] = Math.sign(s) * Math.pow(Math.abs(s), shape.exponent);
          rowC[row] = Math.sign(c) * Math.pow(Math.abs(c), shape.exponent);
        }
        for (let col = 0; col < W; col++) {
          const u = (col + 0.5) / W,
            x = shape.front + (shape.tail - shape.front) * u;
          shape.section(x, sec);
          const sweepUp = Math.max(0, st.sweepFrom - x) * st.sweep,
            y0Glass = ws.y0 + ((ws.y0Rear - ws.y0) * (ws.front - x)) / Math.max(1, ws.front - ws.rear);
          const nearWindows = windows.filter((wx) => Math.abs(x - wx) < L.windows.w),
            nearDoors = L.doors.filter((d) => x > Math.min(d.x0, d.x1) - 1.5 && x < Math.max(d.x0, d.x1) + 1.5);
          for (let row = 0; row < H; row++) {
            const cr = rowC[row],
              y = sec.mid + (cr >= 0 ? sec.top - sec.mid : sec.mid - sec.bottom) * cr,
              z = sec.hw * rowS[row],
              side = z >= 0 ? 1 : -1,
              onSide = Math.abs(z) > sec.hw * 0.35;
            let c = WHITE,
              glass = 0;
            if (y < L.belly) c = BELLY;
            if (y > st.y0 + sweepUp && y < st.y1 + sweepUp) c = ACCENT;
            else if (y > st.pin0 + sweepUp && y < st.pin1 + sweepUp) c = PIN;
            // Anti-glare panel on top of the nose, ahead of the windscreen.
            if (L.antiGlare && x > L.antiGlare.x0 && x < L.antiGlare.x1 && y > sec.top - L.antiGlare.band && Math.abs(z) < sec.hw * 0.62)
              c = MATT;
            // Windscreen across the top and cockpit side windows behind it.
            if (x <= ws.front && x >= ws.rear && y > y0Glass) {
              const screen = x >= ws.roof,
                sideGlass = !screen && y < ws.sideTop;
              if (screen || sideGlass) {
                const edge = Math.min(
                  y - y0Glass,
                  ws.front - x,
                  x - ws.rear,
                  sideGlass ? ws.sideTop - y : 99,
                  Math.abs(x - ws.roof) * 1.4,
                  screen ? Math.abs(z) * 1.6 : 99,
                );
                if (edge < 0.32) c = FRAME;
                else {
                  c = GLASS;
                  glass = 1;
                }
              }
            }
            // Cabin windows, with a painted surround.
            if (onSide && !glass) {
              const inDoor = doorSpans.find((d) => x > d[0] && x < d[1] && (!d[2] || d[2] === side));
              for (const wx of nearWindows) {
                if (inDoor && !L.doors.some((d) => d.window === wx)) continue;
                const hit = roundRect(x, y, wx, L.windows.y, L.windows.w, L.windows.h, L.windows.r, 0.35);
                if (hit === 1) {
                  c = GLASS;
                  glass = 1;
                } else if (hit === 0) c = FRAME;
              }
              for (const d of nearDoors) {
                if (d.side && d.side !== side) continue;
                if (d.window !== undefined && !windows.includes(d.window)) {
                  const hit = roundRect(x, y, d.window, L.windows.y, L.windows.w, L.windows.h, L.windows.r, 0.35);
                  if (hit === 1) {
                    c = GLASS;
                    glass = 1;
                  } else if (hit === 0) c = FRAME;
                }
                const x0 = Math.min(d.x0, d.x1),
                  x1 = Math.max(d.x0, d.x1),
                  seam = roundRect(x, y, (x0 + x1) / 2, (d.y0 + d.y1) / 2, x1 - x0, d.y1 - d.y0, 1.4, 0.16);
                if (seam === 0) c = SEAM;
              }
            }
            // A soft sky reflection across the upper part of the glass.
            if (glass && y > sec.mid + (sec.top - sec.mid) * 0.72) c = GLASS_HI;
            const o = (row * W + col) * 4;
            px[o] = c[0];
            px[o + 1] = c[1];
            px[o + 2] = c[2];
            px[o + 3] = 255;
            fx[o] = 255;
            fx[o + 1] = glass ? 30 : c === MATT ? 250 : 255;
            fx[o + 2] = glass ? 255 : 26;
            fx[o + 3] = 255;
          }
        }
        cg.putImageData(image, 0, 0);
        sg.putImageData(finish, 0, 0);
        // Registration on both sides of the rear fuselage.
        const reg = L.registration;
        if (reg) {
          const xm = (reg.x0 + reg.x1) / 2;
          shape.section(xm, sec);
          for (const side of [1, -1]) {
            const u0 = ((shape.front - reg.x0) / (shape.front - shape.tail)) * W,
              u1 = ((shape.front - reg.x1) / (shape.front - shape.tail)) * W,
              vTop = (shape.theta(sec, reg.y1, side) / TAU) * H,
              vBottom = (shape.theta(sec, reg.y0, side) / TAU) * H,
              height = Math.abs(vBottom - vTop),
              width = Math.abs(u1 - u0),
              // Texels are longer along the fuselage than round it: widen the text
              // so it reads square on the aircraft.
              aspect = W / (shape.front - shape.tail) / (height / Math.max(0.1, reg.y1 - reg.y0));
            cg.save();
            cg.translate((u0 + u1) / 2, (vTop + vBottom) / 2);
            // The texture runs nose to tail and top round the right side: text on
            // the right reads mirrored along u, on the left upside down along v.
            cg.scale((side > 0 ? -1 : 1) * aspect, side > 0 ? 1 : -1);
            cg.fillStyle = '#23303a';
            cg.font = '800 ' + Math.round(height * 0.95) + 'px Arial';
            cg.textAlign = 'center';
            cg.textBaseline = 'middle';
            cg.fillText(plan.registration, 0, height * 0.04, width / aspect);
            cg.restore();
          }
        }
        const map = new Three.CanvasTexture(colour),
          finishMap = new Three.CanvasTexture(surface);
        map.colorSpace = Three.SRGBColorSpace;
        for (const t of [map, finishMap]) {
          t.anisotropy = 4;
          t.wrapS = Three.ClampToEdgeWrapping;
          t.wrapT = Three.RepeatWrapping;
        }
        const livery = { map, finishMap };
        cache.set(key, livery);
        return livery;
      }
      /**
       * LIFTING SURFACES
       * A tapered, swept panel between span fractions f0..f1 and chord fractions
       * c0..c1 (0 leading edge, 1 trailing edge), NACA thickness, closed at the
       * ends. `place(x, t, f)` puts a section point (x along the chord line, t the
       * thickness offset, f the span fraction) into body space; `mirror` flips the
       * winding for placements that reflect (the left side, the fin).
       */
      function liftingSurface(o) {
        const le = (f) => o.rootLE + (o.tipLE - o.rootLE) * f,
          chord = (f) => o.rootChord + (o.tipChord - o.rootChord) * f;
        return {
          point(f, c) {
            return new Three.Vector3(...o.place(le(f) - c * chord(f), 0, f));
          },
          part(f0, f1, c0 = 0, c1 = 1) {
            const nc = Math.max(3, Math.round(16 * (c1 - c0))),
              ns = Math.max(2, Math.round(10 * (f1 - f0))),
              positions = [],
              indices = [],
              ringSize = 2 * (nc + 1);
            for (let s = 0; s <= ns; s++) {
              const f = f0 + ((f1 - f0) * s) / ns,
                ch = chord(f),
                x0 = le(f);
              for (const upper of [true, false])
                for (let k = 0; k <= nc; k++) {
                  const kk = upper ? k : nc - k,
                    c = c0 + ((c1 - c0) * (1 - Math.cos((Math.PI * kk) / nc))) / 2,
                    t = airfoilHalfThickness(c) * o.thickness * ch * (upper ? 1 : -0.72);
                  positions.push(...o.place(x0 - c * ch, t, f));
                }
            }
            const flip = !!o.mirror;
            for (let s = 0; s < ns; s++)
              for (let k = 0; k < ringSize; k++) {
                const a = s * ringSize + k,
                  b = s * ringSize + ((k + 1) % ringSize),
                  d = a + ringSize,
                  e = b + ringSize;
                if (flip) indices.push(a, d, b, b, d, e);
                else indices.push(a, b, d, b, e, d);
              }
            for (const [s, outward] of [
              [0, -1],
              [ns, 1],
            ]) {
              let cx = 0,
                cy = 0,
                cz = 0;
              for (let k = 0; k < ringSize; k++) {
                cx += positions[(s * ringSize + k) * 3];
                cy += positions[(s * ringSize + k) * 3 + 1];
                cz += positions[(s * ringSize + k) * 3 + 2];
              }
              const centre = positions.length / 3,
                start = centre + 1;
              positions.push(cx / ringSize, cy / ringSize, cz / ringSize);
              for (let k = 0; k < ringSize; k++) positions.push(...positions.slice((s * ringSize + k) * 3, (s * ringSize + k) * 3 + 3));
              for (let k = 0; k < ringSize; k++) {
                const a = start + k,
                  b = start + ((k + 1) % ringSize);
                if ((outward > 0) !== flip) indices.push(centre, a, b);
                else indices.push(centre, b, a);
              }
            }
            const geometry = new Three.BufferGeometry();
            geometry.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            return geometry;
          },
        };
      }
      /**
       * STATIC MERGE
       * Parts that never move are collected per material and merged into one mesh
       * each at the end of the build.
       */
      function aircraftBatch() {
        const byMaterial = new Map(),
          matrix = new Three.Matrix4(),
          normalMatrix = new Three.Matrix3(),
          v = new Three.Vector3();
        return {
          add(geometry, material, transform = null) {
            if (!byMaterial.has(material)) byMaterial.set(material, []);
            byMaterial.get(material).push({ geometry, transform: transform ? transform.clone() : null });
          },
          // A unit box / cylinder / sphere placed by position, scale and rotation.
          place(geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
            matrix.compose(
              new Three.Vector3(x, y, z),
              new Three.Quaternion().setFromEuler(new Three.Euler(rx, ry, rz)),
              new Three.Vector3(sx, sy, sz),
            );
            this.add(geometry, material, matrix);
          },
          // A cylinder between two points.
          rod(a, b, r, material, geometry = cylinderGeo) {
            const dir = new Three.Vector3().subVectors(b, a),
              q = new Three.Quaternion().setFromUnitVectors(new Three.Vector3(0, 1, 0), dir.clone().normalize());
            matrix.compose(a.clone().add(b).multiplyScalar(0.5), q, new Three.Vector3(r, dir.length(), r));
            this.add(geometry, material, matrix);
          },
          flush(parent, name) {
            for (const [material, parts] of byMaterial) {
              let vertices = 0,
                count = 0;
              for (const { geometry } of parts) {
                vertices += geometry.attributes.position.count;
                count += geometry.index ? geometry.index.count : geometry.attributes.position.count;
              }
              const positions = new Float32Array(vertices * 3),
                normals = new Float32Array(vertices * 3),
                uvs = new Float32Array(vertices * 2),
                index = new Uint32Array(count);
              let vo = 0,
                io = 0;
              for (const { geometry, transform } of parts) {
                const p = geometry.attributes.position,
                  n = geometry.attributes.normal,
                  uv = geometry.attributes.uv;
                if (transform) normalMatrix.getNormalMatrix(transform);
                for (let i = 0; i < p.count; i++) {
                  v.fromBufferAttribute(p, i);
                  if (transform) v.applyMatrix4(transform);
                  positions.set([v.x, v.y, v.z], (vo + i) * 3);
                  if (n) {
                    v.fromBufferAttribute(n, i);
                    if (transform) v.applyMatrix3(normalMatrix).normalize();
                  } else v.set(0, 1, 0);
                  normals.set([v.x, v.y, v.z], (vo + i) * 3);
                  if (uv) uvs.set([uv.getX(i), uv.getY(i)], (vo + i) * 2);
                }
                if (geometry.index) for (let i = 0; i < geometry.index.count; i++) index[io++] = geometry.index.getX(i) + vo;
                else for (let i = 0; i < p.count; i++) index[io++] = vo + i;
                vo += p.count;
              }
              const merged = new Three.BufferGeometry();
              merged.setAttribute('position', new Three.BufferAttribute(positions, 3));
              merged.setAttribute('normal', new Three.BufferAttribute(normals, 3));
              merged.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
              merged.setIndex(new Three.BufferAttribute(index, 1));
              merged.computeBoundingSphere();
              const m = new Three.Mesh(merged, material);
              m.castShadow = true;
              m.receiveShadow = true;
              m.name = name;
              parent.add(m);
            }
            byMaterial.clear();
          },
        };
      }
      function aircraftLabel(parent, text, x, y, z, width, color, yaw = 0, tilt = 0) {
        const cv = document.createElement('canvas');
        cv.width = 256;
        cv.height = 64;
        const g = cv.getContext('2d');
        g.fillStyle = color;
        g.font = '800 40px Arial';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 128, 34, 240);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        const plane = new Three.Mesh(
          new Three.PlaneGeometry(width, width / 4),
          new Three.MeshBasicMaterial({ map: tx, transparent: true, toneMapped: false, side: Three.DoubleSide }),
        );
        plane.position.set(x, y, z);
        plane.rotation.set(tilt, yaw, 0);
        parent.add(plane);
        return plane;
      }
      /* A hinged control surface: a pivot on the hinge line, the part inside it. */
      function hingedSurface(body, surface, f0, f1, c0, material, name) {
        const a = surface.point(f0, c0),
          b = surface.point(f1, c0),
          axis = b.clone().sub(a).normalize();
        // Positive deflection is trailing edge down (or right, for the rudder).
        if (axis.z < -0.5 || (Math.abs(axis.z) <= 0.5 && axis.y < 0)) axis.negate();
        const pivot = new Three.Group();
        pivot.position.copy(a);
        pivot.name = name;
        body.add(pivot);
        const geometry = surface.part(f0, f1, c0 + 0.005, 1);
        geometry.translate(-a.x, -a.y, -a.z);
        const m = new Three.Mesh(geometry, material);
        m.castShadow = true;
        m.receiveShadow = true;
        pivot.add(m);
        return { pivot, axis, angle: 0 };
      }
      function setSurfaceAngle(surface, angle) {
        if (!surface || Math.abs(angle - surface.angle) < 1e-4) return;
        surface.angle = angle;
        surface.pivot.quaternion.setFromAxisAngle(surface.axis, angle);
      }
      /* A turbofan nacelle along +X: lathed cowl, lip, fan, spinner, exhaust cone. */
      function turbofan(batch, body, en, paint, lip, dark, metal, fans) {
        const R = en.r,
          Lh = en.len / 2,
          profile = [
            [0.9, Lh],
            [1, Lh * 0.72],
            [1.02, Lh * 0.2],
            [0.96, -Lh * 0.4],
            [0.78, -Lh * 0.92],
            [0.74, -Lh],
          ].map(([r, y]) => new Three.Vector2(r * R, y)),
          cowl = new Three.LatheGeometry(profile, 28);
        cowl.rotateZ(-Math.PI / 2);
        cowl.translate(en.x, en.y, en.z);
        batch.add(cowl, paint);
        const lipGeo = new Three.TorusGeometry(R * 0.92, R * 0.1, 8, 28);
        lipGeo.rotateY(Math.PI / 2);
        lipGeo.translate(en.x + Lh, en.y, en.z);
        batch.add(lipGeo, lip);
        // The intake throat and the fan behind it.
        const throat = new Three.CylinderGeometry(R * 0.86, R * 0.86, en.len * 0.16, 24, 1, true);
        throat.rotateZ(Math.PI / 2);
        throat.translate(en.x + Lh - en.len * 0.08, en.y, en.z);
        batch.add(throat, dark);
        const fan = new Three.Group();
        fan.position.set(en.x + Lh - en.len * 0.15, en.y, en.z);
        body.add(fan);
        const hub = new Three.Mesh(new Three.ConeGeometry(R * 0.28, R * 0.55, 16), metal);
        hub.rotation.z = -Math.PI / 2;
        hub.position.x = R * 0.2;
        fan.add(hub);
        const bladeGeo = new Three.BoxGeometry(0.25, R * 0.62, R * 0.2);
        for (let k = 0; k < 18; k++) {
          const blade = new Three.Mesh(bladeGeo, metal),
            a = (k * TAU) / 18;
          blade.position.set(0, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5);
          blade.rotation.set(a + 0.5, 0, 0);
          fan.add(blade);
        }
        fans.push(fan);
        // Exhaust cone out of the back.
        const cone = new Three.ConeGeometry(R * 0.5, R * 1.1, 18);
        cone.rotateZ(Math.PI / 2);
        cone.translate(en.x - Lh - R * 0.45, en.y, en.z);
        batch.add(cone, dark);
      }
      /* The four-blade propeller: spinner, twisted blades with painted tips, and a
         blur disc shown when it turns fast. */
      function propeller(body, pr, metal, bladeMat, tipMat) {
        const prop = new Three.Group();
        prop.position.set(pr.x, pr.y, 0);
        body.add(prop);
        const spinner = new Three.LatheGeometry(
          Array.from({ length: 9 }, (_, i) => {
            const t = i / 8;
            return new Three.Vector2(pr.spinnerRadius * Math.sqrt(1 - t * t * 0.98), t * pr.spinner);
          }),
          24,
        );
        spinner.rotateZ(-Math.PI / 2);
        spinner.translate(-1.2, 0, 0);
        const spin = new Three.Mesh(spinner, metal);
        spin.castShadow = true;
        prop.add(spin);
        // One blade along +Y: sections from root to tip, twisted and tapered.
        const sections = 8,
          positions = [],
          indices = [];
        for (let i = 0; i <= sections; i++) {
          const t = i / sections,
            r = pr.spinnerRadius * 0.7 + (pr.radius - pr.spinnerRadius * 0.7) * t,
            chord = 2.3 - 1.1 * t + (t < 0.25 ? 0.4 * t : 0.1),
            thick = 0.42 - 0.28 * t,
            twist = 0.95 - 0.7 * t;
          for (const [cx, cz] of [
            [thick / 2, chord / 2],
            [-thick / 2, chord / 2],
            [-thick / 2, -chord / 2],
            [thick / 2, -chord / 2],
          ])
            positions.push(cx * Math.cos(twist) - cz * Math.sin(twist), r, cx * Math.sin(twist) + cz * Math.cos(twist));
        }
        for (let i = 0; i < sections; i++)
          for (let k = 0; k < 4; k++) {
            const a = i * 4 + k,
              b = i * 4 + ((k + 1) % 4),
              d = a + 4,
              e = b + 4;
            indices.push(a, d, b, b, d, e);
          }
        indices.push(sections * 4, sections * 4 + 1, sections * 4 + 2, sections * 4, sections * 4 + 2, sections * 4 + 3);
        const blade = new Three.BufferGeometry();
        blade.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        blade.setIndex(indices);
        blade.computeVertexNormals();
        const tip = new Three.BoxGeometry(0.3, pr.radius * 0.08, 1.2);
        tip.translate(0, pr.radius * 0.95, 0);
        for (let k = 0; k < pr.blades; k++) {
          const holder = new Three.Group();
          holder.rotation.x = (k * TAU) / pr.blades;
          prop.add(holder);
          const b = new Three.Mesh(blade, bladeMat);
          b.castShadow = true;
          holder.add(b);
          holder.add(new Three.Mesh(tip, tipMat));
        }
        const disc = new Three.Mesh(
          new Three.CircleGeometry(pr.radius, 40),
          new Three.MeshBasicMaterial({ color: '#2a2e31', transparent: true, opacity: 0, depthWrite: false, side: Three.DoubleSide }),
        );
        disc.rotation.y = Math.PI / 2;
        disc.position.x = 0.1;
        disc.visible = false;
        prop.add(disc);
        return { prop, disc, blades: prop.children.filter((c) => c.isGroup) };
      }
      /* One gear leg in its retraction pivot: strut, torque link, doors, wheels. */
      function landingGear(body, spec, z, side, metal, rubberMat, hubMat, doorMat, wheels) {
        const pivot = new Three.Group();
        pivot.position.set(spec.x, spec.top, z);
        body.add(pivot);
        const length = spec.top - spec.r,
          strut = new Three.Mesh(cylinderGeo, metal);
        strut.scale.set(0.55, length, 0.55);
        strut.position.y = -length / 2;
        strut.castShadow = true;
        pivot.add(strut);
        // Oleo: a thicker upper cylinder.
        const oleo = new Three.Mesh(cylinderGeo, metal);
        oleo.scale.set(0.85, length * 0.45, 0.85);
        oleo.position.y = -length * 0.25;
        pivot.add(oleo);
        const door = new Three.Mesh(boxGeo, doorMat);
        door.scale.set(spec.retract === 'in' ? spec.r * 1.6 : 0.25, length * 0.8, spec.retract === 'in' ? 0.25 : spec.r * 1.2);
        door.position.set(0, -length * 0.45, spec.retract === 'in' ? side * (spec.width / 2 + 0.6) : 0);
        if (spec.retract !== 'in') door.position.x = spec.retract === 'aft' ? 1.2 : -1.2;
        door.castShadow = true;
        pivot.add(door);
        const offsets = spec.twin ? [-1, 1] : [0];
        for (const o of offsets) {
          const wheel = new Three.Group(),
            dz = o * (spec.width / 2 + 0.35);
          wheel.position.set(spec.trailing ? -1.4 : 0, -length, dz);
          pivot.add(wheel);
          const tire = new Three.Mesh(wheelGeo, rubberMat);
          tire.scale.set(spec.r, spec.width, spec.r);
          tire.rotation.x = Math.PI / 2;
          tire.castShadow = true;
          wheel.add(tire);
          const hub = new Three.Mesh(wheelGeo, hubMat);
          hub.scale.set(spec.r * 0.55, spec.width + 0.1, spec.r * 0.55);
          hub.rotation.x = Math.PI / 2;
          wheel.add(hub);
          wheels.push({ wheel, side });
        }
        if (spec.twin || spec.trailing) {
          // Axle / trailing link.
          const axle = new Three.Mesh(cylinderGeo, metal);
          axle.scale.set(0.35, spec.twin ? spec.width * 2 + 1 : 1.8, 0.35);
          axle.rotation.x = spec.twin ? Math.PI / 2 : 0;
          axle.rotation.z = spec.trailing ? Math.PI / 2 : 0;
          axle.position.set(spec.trailing ? -0.7 : 0, -length, 0);
          pivot.add(axle);
        }
        return { pivot, retract: spec.retract, side };
      }
      function buildAircraft(kind, parent, options = {}) {
        const plan = aircraftPlans()[kind],
          body = new Three.Group();
        body.name = 'airframe';
        parent.add(body);
        const shape = fuselageShape(plan),
          accentColour = options.accent || plan.accent,
          livery = aircraftLivery(kind, plan, shape, accentColour),
          // The fuselage wears the livery; paintVehicle (damage3d.js) tints and
          // weathers it, and the wing / tail paint copies it (animateAircraft).
          paint = new Three.MeshStandardMaterial({
            color: options.color || '#e6ebe8',
            map: livery.map,
            roughnessMap: livery.finishMap,
            metalnessMap: livery.finishMap,
            roughness: 0.34,
            metalness: 0.5,
          }),
          wingPaint = mat(options.color || '#e6ebe8', 0.34, 0.18),
          accent = mat(accentColour, 0.38, 0.25),
          dark = mat('#1d252b', 0.45, 0.35),
          intake = mat('#0c1216', 0.85, 0.1),
          metal = mat('#aeb6ba', 0.28, 0.85),
          gearMetal = mat('#c9ced0', 0.3, 0.8),
          lipMetal = mat('#d7dcde', 0.2, 0.9),
          bladeMat = mat('#1c1f22', 0.55, 0.3),
          tipMat = mat('#e8c23a', 0.5, 0.1),
          canopy = new Three.MeshStandardMaterial({ color: '#152836', roughness: 0.1, metalness: 0.7 }),
          batch = aircraftBatch(),
          wheels = [],
          fans = [],
          gears = [],
          surfaces = { aileron: [], elevator: [], rudder: [], flap: [] };
        // Fuselage.
        const fuselage = new Three.Mesh(fuselageMesh(shape), paint);
        fuselage.name = 'fuselage';
        fuselage.castShadow = true;
        fuselage.receiveShadow = true;
        body.add(fuselage);
        const sec = shape.section(0);
        // Wings: fixed box, flaps and ailerons in their hinges, winglets.
        const w = plan.wing,
          wings = {},
          navLights = [];
        for (const side of [1, -1]) {
          const wing = liftingSurface({
            rootLE: w.x,
            tipLE: w.x - w.sweep,
            rootChord: w.rootChord,
            tipChord: w.tipChord,
            thickness: w.thickness,
            mirror: side < 0,
            place: (x, t, f) => [x, w.y + f * w.span * w.dihedral + t, side * f * w.span],
          });
          wings[side] = wing;
          const cuts = [
            [0, w.flap[0], 1],
            [w.flap[0], w.flap[1], w.hinge],
            [w.flap[1], w.aileron[0], 1],
            [w.aileron[0], w.aileron[1], w.hinge],
            [w.aileron[1], 1, 1],
          ];
          for (const [f0, f1, c1] of cuts) batch.add(wing.part(f0, f1, 0, c1), wingPaint);
          surfaces.flap.push(hingedSurface(body, wing, w.flap[0] + 0.004, w.flap[1] - 0.004, w.hinge, wingPaint, 'flap'));
          const aileron = hingedSurface(body, wing, w.aileron[0] + 0.004, w.aileron[1] - 0.004, w.hinge, wingPaint, 'aileron');
          aileron.side = side;
          surfaces.aileron.push(aileron);
          // Flap track fairings under the trailing edge.
          for (const f of [w.flap[0] + 0.02, (w.flap[0] + w.flap[1]) / 2, w.flap[1] - 0.02]) {
            const p = wing.point(f, w.hinge);
            batch.place(sphereGeo, wingPaint, p.x - 0.6, p.y - 0.7, p.z, 3.2, 0.55, 0.4);
          }
          if (w.winglet) {
            const tip = wing.point(1, 0),
              wl = w.winglet,
              winglet = liftingSurface({
                rootLE: tip.x,
                tipLE: tip.x - wl.sweep,
                rootChord: wl.chord,
                tipChord: wl.tipChord,
                thickness: 0.08,
                mirror: side > 0,
                place: (x, t, f) => [x, tip.y + f * wl.height, tip.z + side * (f * wl.height * wl.cant + t)],
              });
            batch.add(winglet.part(0, 1), accent);
          }
          // Navigation light and strobe in the tip.
          const tip = wing.point(1, 0.12);
          navLights.push([tip.x, tip.y + 0.3, tip.z + side * 0.6, side]);
        }
        // Tail: fin with rudder, dorsal fillet, stabiliser with elevators, strakes.
        const fn = plan.fin,
          fin = liftingSurface({
            rootLE: fn.x,
            tipLE: fn.x - fn.sweep,
            rootChord: fn.rootChord,
            tipChord: fn.tipChord,
            thickness: fn.thickness,
            mirror: true,
            place: (x, t, f) => [x, fn.y + f * fn.height, t],
          });
        batch.add(fin.part(0, 1, 0, fn.hinge), accent);
        batch.add(fin.part(0, 0.06, fn.hinge, 1), accent);
        batch.add(fin.part(0.95, 1, fn.hinge, 1), accent);
        const rudder = hingedSurface(body, fin, 0.06, 0.95, fn.hinge, accent, 'rudder');
        surfaces.rudder.push(rudder);
        if (plan.dorsal) {
          const d = plan.dorsal;
          batch.add(
            liftingSurface({
              rootLE: d.x,
              tipLE: d.x - d.sweep,
              rootChord: d.rootChord,
              tipChord: d.tipChord,
              thickness: 0.12,
              mirror: true,
              place: (x, t, f) => [x, d.y + f * d.height, t],
            }).part(0, 1),
            accent,
          );
        }
        const s = plan.stab;
        for (const side of [1, -1]) {
          const stab = liftingSurface({
            rootLE: s.x,
            tipLE: s.x - s.sweep,
            rootChord: s.rootChord,
            tipChord: s.tipChord,
            thickness: s.thickness,
            mirror: side < 0,
            place: (x, t, f) => [x, s.y + f * s.span * (s.dihedral || 0) + t, side * f * s.span],
          });
          batch.add(stab.part(0, 1, 0, s.hinge), wingPaint);
          batch.add(stab.part(0.94, 1, s.hinge, 1), wingPaint);
          surfaces.elevator.push(hingedSurface(body, stab, 0.02, 0.94, s.hinge, wingPaint, 'elevator'));
        }
        // T-tail bullet fairing where the stabiliser meets the fin.
        if (s.y > fn.y + fn.height * 0.8) batch.place(sphereGeo, accent, s.x - s.rootChord * 0.45, s.y + 0.2, 0, s.rootChord * 0.62, 1.4, 1.4);
        if (plan.strakes) {
          const k = plan.strakes;
          for (const side of [1, -1]) batch.place(boxGeo, wingPaint, k.x, k.y - 1.2, side * 1.6, k.length, k.depth, 0.35, side * 0.6, 0, 0.12);
        }
        // Engines.
        let prop = null,
          disc = null;
        if (plan.prop) {
          const made = propeller(body, plan.prop, lipMetal, bladeMat, tipMat);
          prop = made.prop;
          disc = made.disc;
          // Exhaust stacks either side of the cowl, chin intake below it.
          const ex = plan.exhausts;
          for (const side of [1, -1])
            batch.rod(
              new Three.Vector3(ex.x + 1, ex.y, side * (ex.z - 0.9)),
              new Three.Vector3(ex.x - 1.6, ex.y - 0.6, side * (ex.z + 0.5)),
              0.62,
              dark,
            );
          batch.place(sphereGeo, wingPaint, plan.intake.x - 2.4, plan.intake.y, 0, 5.4, 1.7, 2.6);
          batch.place(boxGeo, intake, plan.intake.x + 2.6, plan.intake.y + 0.1, 0, 0.3, 1.5, 3.4);
        }
        for (const en of plan.engines || []) {
          turbofan(batch, body, en, wingPaint, lipMetal, intake, metal, fans);
          if (en.pylon === 'wing') {
            batch.place(boxGeo, wingPaint, en.x - en.len * 0.18, en.y + en.r * 0.95, en.z, en.len * 0.72, en.r * 0.9, 1.6);
          } else {
            // Stub pylon from the rear fuselage.
            batch.place(boxGeo, wingPaint, en.x + 1, en.y, en.z * 0.62, en.len * 0.45, 1.4, Math.abs(en.z) * 0.62, 0, 0, 0);
          }
        }
        // Landing gear.
        const g = plan.gear;
        gears.push(landingGear(body, g.nose, 0, 0, gearMetal, rubber, chrome, wingPaint, wheels));
        for (const side of [1, -1]) gears.push(landingGear(body, g.main, side * g.main.z, side, gearMetal, rubber, chrome, wingPaint, wheels));
        // Antennas on the spine and the belly, pitot tube under the left wing.
        const spine = shape.front * 0.1 - 14;
        batch.place(boxGeo, dark, spine, shape.section(spine).top + 1, 0, 3.2, 2.2, 0.35, 0, 0, 0.35);
        batch.place(boxGeo, dark, shape.front * 0.2, shape.section(shape.front * 0.2).bottom - 0.7, 0, 2.2, 1.6, 0.3, 0, 0, -0.35);
        const pitot = wings[-1].point(0.55, 0.1);
        batch.rod(new Three.Vector3(pitot.x - 1, pitot.y - 1, pitot.z), new Three.Vector3(pitot.x + 3.2, pitot.y - 1, pitot.z), 0.18, metal);
        // Fin logo on both sides, inside the fin's outline at mid height.
        const logoChord = (fn.rootChord + fn.tipChord) / 2;
        for (const side of [-1, 1])
          aircraftLabel(
            body,
            plan.logo,
            fn.x - fn.sweep * 0.45 - logoChord * 0.42,
            fn.y + fn.height * 0.45,
            side * (logoChord * fn.thickness * 0.5 + 0.15),
            logoChord * 0.78,
            '#f4efe4',
            side > 0 ? 0 : Math.PI,
          );
        batch.flush(body, kind + ' airframe');
        // Lights (halos): parked aircraft keep them dark; animateAircraft runs them.
        const lights = { nav: [], strobes: [], beacons: [], landing: [] },
          lens = (colour) => new Three.MeshBasicMaterial({ color: colour, toneMapped: false });
        for (const [x, y, z, side] of navLights) {
          const colour = side < 0 ? '#ff4a3a' : '#4dff7a';
          mesh(sphereGeo, lens(colour), body, x, y, z, 0.7, 0.5, 0.7);
          lights.nav.push(halo(body, x, y, z, 10, colour));
          lights.strobes.push(halo(body, x - 0.8, y, z, 16, '#ffffff'));
        }
        const [tx, ty] = plan.nav.tail;
        mesh(sphereGeo, lens('#ffffff'), body, tx, ty, 0, 0.6, 0.6, 0.6);
        lights.nav.push(halo(body, tx - 0.4, ty, 0, 9, '#ffffff'));
        lights.strobes.push(halo(body, tx - 0.8, ty, 0, 13, '#ffffff'));
        for (const [x, y, z] of plan.beacons) {
          mesh(sphereGeo, lens('#ff3b2f'), body, x, y, z, 0.8, 0.6, 0.8);
          lights.beacons.push(halo(body, x, y + (y > 12 ? 0.8 : -0.8), z, 11, '#ff4a36'));
        }
        for (const f of plan.landingLights)
          for (const side of [1, -1]) {
            const p = wings[side].point(f, 0.015);
            mesh(sphereGeo, lens('#fff6dc'), body, p.x, p.y, p.z, 0.9, 0.6, 1.2);
            lights.landing.push(halo(body, p.x + 1, p.y, p.z, 22, '#fff3d0'));
          }
        // Taxi light on the nose gear strut.
        const noseGear = gears[0];
        lights.landing.push(halo(noseGear.pivot, 1.2, -(g.nose.top - g.nose.r) * 0.35, 0, 22, '#fff3d0'));
        for (const group of Object.values(lights)) for (const sprite of group) sprite.visible = false;
        return {
          body,
          paint,
          wingPaint,
          canopy,
          prop,
          disc,
          fans,
          wheels,
          gears,
          surfaces,
          lights,
          livery: livery.map,
          // How far the belly sinks to the runway with the gear up.
          bellyDrop: Math.max(0, shape.lowest - 0.4),
          nightLights: [],
          length: shape.front - shape.tail,
        };
      }
      function makePlane(vehicle) {
        const group = new Three.Group();
        scene.add(group);
        const kind = vehicle.airframe === 'jet' || vehicle.airframe === 'airliner' ? vehicle.airframe : 'courier',
          parts = buildAircraft(kind, group, { color: vehicle.color });
        group.name =
          kind === 'airliner' ? 'Oceanview airliner' : kind === 'jet' ? 'South Coast executive jet' : 'Serrano courier';
        return {
          ...parts,
          group,
          strobes: [],
          special: true,
          plane: true,
          propSpeed: 0,
        };
      }
      /**
       * Per frame, for a plane model in view (render3d.js): pose the controls,
       * gear, engines and lights from the simulation, and shake with the buffet.
       */
      function animateAircraft(c, m, deltaSeconds) {
        const alive = c.hp > 0,
          airborne = (c.altitude || 0) > terrainHeight(c.x, c.y) + 1,
          running = alive && (c === player.car || (c.abandonedFlight && airborne)),
          power = c.power ?? c.throttle ?? 0,
          gearPos = c.gearPos ?? 1;
        // The wing and tail paint follow the fuselage's weathering (paintVehicle).
        m.wingPaint.color.copy(m.paint.color);
        m.wingPaint.roughness = m.paint.roughness;
        m.wingPaint.metalness = m.paint.metalness * 0.3;
        m.wingPaint.emissive.copy(m.paint.emissive);
        // A repaired wreck gets its livery back (paintVehicle clears the map).
        if (!m.charred && m.paint.map !== m.livery) {
          m.paint.map = m.livery;
          m.paint.needsUpdate = true;
        }
        // Control surfaces: ailerons opposite, elevators together, rudder, flaps.
        const roll = c.ctrlRoll || 0,
          pitch = c.ctrlPitch || 0,
          yaw = c.ctrlYaw || 0;
        for (const s of m.surfaces.aileron) setSurfaceAngle(s, -s.side * roll * 0.36);
        for (const s of m.surfaces.elevator) setSurfaceAngle(s, -pitch * 0.4);
        for (const s of m.surfaces.rudder) setSurfaceAngle(s, yaw * 0.4);
        for (const s of m.surfaces.flap) setSurfaceAngle(s, (c.flapPos || 0) * 0.7);
        // Gear: mains fold inward, the nose aft (courier) or forward (jets).
        for (const leg of m.gears) {
          const stow = (1 - gearPos) * Math.PI * 0.5;
          if (leg.retract === 'in') leg.pivot.rotation.x = leg.side * stow;
          else leg.pivot.rotation.z = leg.retract === 'aft' ? -stow : stow;
          leg.pivot.visible = gearPos > 0.02;
        }
        // Gear up on the ground: the belly sits on the runway.
        m.body.position.y = airborne ? 0 : -(1 - gearPos) * m.bellyDrop;
        // Propeller / fans: spool with power, coast down when stopped.
        const target = running ? 14 + power * 70 : 0;
        m.propSpeed += (target - m.propSpeed) * (1 - Math.exp(-deltaSeconds * (running ? 1.6 : 0.5)));
        if (m.prop) {
          m.prop.rotation.x += deltaSeconds * m.propSpeed;
          const blur = clamp((m.propSpeed - 20) / 50, 0, 1);
          m.disc.visible = blur > 0.02;
          m.disc.material.opacity = blur * 0.22;
        }
        for (const fan of m.fans) fan.rotation.x += deltaSeconds * m.propSpeed * 1.4;
        // Lights: navigation steady, strobes double-flash, beacons pulse, landing
        // lights with the gear down; all while the engine runs (nav also at night).
        const t = gameTime + (c.id || 0) * 0.37,
          night = nightAmount > 0.25,
          strobe = (t % 1.3 < 0.05 || (t % 1.3 > 0.16 && t % 1.3 < 0.21)) && running,
          beacon = running ? 0.5 + 0.5 * Math.sin(t * 7.5) : 0;
        for (const s of m.lights.nav) {
          s.visible = running || (night && alive && c.ai);
          s.material.opacity = night ? 0.9 : 0.3;
        }
        for (const s of m.lights.strobes) s.visible = strobe;
        for (const s of m.lights.beacons) {
          s.visible = beacon > 0.35;
          s.material.opacity = beacon;
        }
        // By day the landing lights read as a small glint, at night as a beam.
        for (const s of m.lights.landing) {
          s.visible = running && gearPos > 0.9;
          s.material.opacity = night ? 0.9 : 0.14;
        }
        // Buffet: a fast, small shake of the airframe near and in the stall.
        const buffet = c.buffet || 0;
        m.body.rotation.set(
          (c.bank || 0) + (buffet ? Math.sin(gameTime * 43 + 1.7) * buffet * 0.02 : 0),
          0,
          (c.pitch || 0) + (buffet ? Math.sin(gameTime * 37) * buffet * 0.014 : 0),
          'ZYX',
        );
      }
      // END SUBSYSTEM: src/plane3d.js
