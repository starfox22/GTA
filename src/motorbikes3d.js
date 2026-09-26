      // BEGIN SUBSYSTEM: src/motorbikes3d.js — Motorbike models
      /**
       * Motorbike models
       * Source: src/motorbikes3d.js
       * Scope: createCityRenderer() closure (after cars3d.js, whose merging kit,
       * tyres, rims and trim atlas it shares; before makeVehicle).
       *
       * Every motorbike is built at its real size (VEHICLE_DEFINITIONS `l`,
       * modelScale 1), in metres times CAR_M:
       *  - bike VORTEX 900: a naked triple streetfighter (Street Triple / MT-09):
       *    twin round lamps, a trellis frame, a stubby belly pipe;
       *  - cruiser NOMAD CRUISER: a heavy V-twin (Fat Boy): a fat tank, a round
       *    chrome lamp, pull-back bars, forward controls, twin shotgun pipes;
       *  - dolcati DOLCATI V4: a V4 superbike after the Panigale V4: a full red
       *    fairing with slit LED lamps and winglets, a single-sided swingarm,
       *    stacked under-engine pipes, gold forks;
       *  - yamasaki YAMASAKI 1000RR: a crossplane litre bike after the R1 /
       *    ZX-10RR: twin-eye fairing, racing graphics, a side silencer;
       *  - kr500 KR 500: a 500 cc enduro after the KTM 500 EXC: orange plastics,
       *    a tall seat, long-travel forks, a high front fender, knobbly tyres, a
       *    number-plate lamp and an upswept silencer.
       *
       * Model contract (render3d.js vehicle pass, damage3d.js specialDamage,
       * riders.js, crowd3d.js RIDERS): `bike`, `special`, `rider` (the rider's
       * group: the anchor the pass shows while someone rides and hides when they
       * are thrown; the character rig draws the rider in its place from
       * `riderSeat`, the seat, grips, pegs and lean in this model's units), `wheels`
       * (front x > 0, each with its radius), lamps headLeft / tailLeft (lit, brake
       * and broken states as the cars'), nightLights [head, tail]. `bikeUpdate`
       * runs after the pass has leaned the body: lamps, the fork steering and the
       * KR 500's wheelie (the body pitched about the rear tyre's contact patch).
       *
       * Draw calls per bike: paint, trim, drl, two lamps, two tyres, two rims and
       * the rider: ten, against ~35 for the old box-built bikes.
       */
      // A lofted pod along x: stations [x, centre y, half width, half height up,
      // half height down, squareness (2 an ellipse, 4 a soft box)] in metres.
      function motoPod(stations, segments = 14) {
        const M = CAR_M,
          position = [],
          uv = [],
          index = [],
          n = segments;
        stations.forEach(([x, yc, hw, up, down, p = 2.4], i) => {
          for (let j = 0; j < n; j++) {
            const a = (j / n) * TAU,
              c = Math.cos(a),
              s = Math.sin(a),
              e = 2 / p,
              z = Math.sign(s) * Math.pow(Math.abs(s), e) * hw,
              y = yc + Math.sign(c) * Math.pow(Math.abs(c), e) * (c > 0 ? up : down);
            position.push(x * M, y * M, z * M);
            uv.push(i / (stations.length - 1), j / n);
          }
        });
        for (let i = 0; i < stations.length - 1; i++)
          for (let j = 0; j < n; j++) {
            const a = i * n + j,
              b = i * n + ((j + 1) % n),
              c = (i + 1) * n + ((j + 1) % n),
              d = (i + 1) * n + j;
            index.push(a, b, d, b, c, d);
          }
        for (const [i, u] of [[0, 0], [stations.length - 1, 1]]) {
          const centre = position.length / 3,
            [x, yc] = stations[i];
          position.push(x * M, yc * M, 0);
          uv.push(u, 0.5);
          for (let j = 0; j < n; j++) index.push(centre, i * n + ((j + 1) % n), i * n + j);
        }
        orientOutward(position, index, (p, out) => {
          // Inside: the nearest station's centre.
          let best = stations[0];
          for (const s of stations) if (Math.abs(s[0] * M - p.x) < Math.abs(best[0] * M - p.x)) best = s;
          out.set(clamp(p.x, Math.min(...stations.map((s) => s[0])) * M, Math.max(...stations.map((s) => s[0])) * M), best[1] * M, 0);
        });
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geo.setIndex(index);
        geo.computeVertexNormals();
        return geo;
      }
      // Metres to map units for points.
      const mp = (x, y, z = 0) => [x * CAR_M, y * CAR_M, z * CAR_M];
      /*
       * Bodies: wheels (radius, width, x of each axle), the rake, the colours of
       * the frame, forks, engine and seat, and a `build(k)` that adds the tank,
       * fairings and details; `rider` the riding pose ([x, y] in metres for the
       * hips, shoulders, hands, knees and feet; lean of the torso) and gear.
       */
      const MOTO_BODIES = {
        bike: {
          wheels: { rf: 0.3, rr: 0.31, wf: 0.12, wr: 0.18, xf: 0.72, xr: -0.73 },
          rake: 0.42,
          rim: { style: 'straight', spokes: 6, color: '#202124', frac: 0.62, spokeWidth: 0.1 },
          forks: '#c9a24a',
          frame: '#b3121b',
          engine: '#2c2e31',
          seat: '#141516',
          rider: { lean: -0.5, hip: [-0.2, 0.93], shoulder: [0.12, 1.43], hand: [0.42, 1.08], knee: [0.12, 0.78], foot: [-0.16, 0.42], head: 1.62, suit: '#23272c', accent: '#8a9098', helmet: '#16181b', visor: '#2c3b4a' },
          build(k) {
            const { S, add, pod } = k;
            // Tank and tail: a sculpted tank, a short tail with the seat.
            pod(k.paint, [[0.02, 0.98, 0.1, 0.02, 0.06], [0.12, 1.02, 0.17, 0.08, 0.12, 3], [0.32, 1.02, 0.15, 0.07, 0.1, 3], [0.46, 0.98, 0.08, 0.03, 0.05]]);
            pod(k.paint, [[-0.28, 0.9, 0.12, 0.05, 0.05, 3], [-0.5, 0.95, 0.09, 0.05, 0.04, 3], [-0.68, 1.0, 0.03, 0.03, 0.02]]);
            pod(k.trim, [[-0.02, 0.92, 0.12, 0.03, 0.02, 3], [-0.34, 0.95, 0.1, 0.03, 0.02, 3]], { color: '#141516', finish: 'leather' });
            // Twin round lamps on the headstock, a flyscreen, radiator shrouds.
            for (const z of [-0.07, 0.07]) {
              k.disc(k.head, S.cylinder24, ...mp(0.66, 1.0, z), 0.065 * CAR_M, 0.05 * CAR_M, [1, 0, 0], { color: '#c9d0d6', finish: 'lens' });
              k.disc(k.drl, S.torus, ...mp(0.69, 1.0, z), 0.055 * CAR_M, 1, [1, 0, 0], { color: '#f4f7ff' });
              k.disc(k.trim, S.cylinder24, ...mp(0.63, 1.0, z), 0.075 * CAR_M, 0.08 * CAR_M, [1, 0, 0], { color: '#16181b', finish: 'gloss' });
            }
            k.bar(k.paint, mp(0.64, 1.1, 0), mp(0.58, 1.22, 0), 0.02 * CAR_M, 0.22 * CAR_M, 0.01 * CAR_M, {});
            for (const side of [-1, 1]) pod(k.paint, [[0.28, 0.82, 0.03, 0.12, 0.1, 3], [0.46, 0.86, 0.03, 0.1, 0.08, 3]].map((s) => [s[0], s[1], s[2], s[3], s[4], s[5]]), { offset: [0, 0, side * 0.15] });
            k.exhaust('belly');
          },
        },
        cruiser: {
          wheels: { rf: 0.33, rr: 0.33, wf: 0.14, wr: 0.2, xf: 0.84, xr: -0.8 },
          rake: 0.55,
          rim: { style: 'mesh', spokes: 12, color: '#e3e7ea', frac: 0.66, finish: 'chrome' },
          tyre: 'whitewall',
          forks: '#e3e7ea',
          frame: '#141516',
          engine: '#b9bec3',
          seat: '#1b1614',
          rider: { lean: 0.06, hip: [-0.3, 0.8], shoulder: [-0.28, 1.36], hand: [0.3, 1.14], knee: [0.3, 0.8], foot: [0.52, 0.4], head: 1.58, suit: '#15171a', accent: '#2c3e5c', helmet: '#16181b', visor: null, openFace: true },
          build(k) {
            const { S, pod } = k;
            // A fat teardrop tank with the dash, fenders over both wheels, the solo seat.
            pod(k.paint, [[-0.12, 0.9, 0.1, 0.03, 0.05], [0.0, 0.94, 0.19, 0.08, 0.1, 2.6], [0.28, 0.93, 0.18, 0.08, 0.1, 2.6], [0.44, 0.9, 0.1, 0.04, 0.06]]);
            k.bar(k.trim, mp(0.0, 1.03, 0), mp(0.3, 1.02, 0), 0.02 * CAR_M, 0.08 * CAR_M, 0.01 * CAR_M, { color: '#e3e7ea', finish: 'chrome' });
            pod(k.paint, [[-0.52, 0.52, 0.14, 0.08, 0.02, 3], [-0.8, 0.64, 0.14, 0.06, 0.02, 3], [-1.12, 0.5, 0.13, 0.04, 0.02, 3]]);
            pod(k.paint, [[1.0, 0.44, 0.1, 0.03, 0.01, 3], [0.84, 0.5, 0.1, 0.05, 0.01, 3], [0.64, 0.4, 0.1, 0.03, 0.01, 3]]);
            pod(k.trim, [[-0.1, 0.76, 0.03, 0.04, 0.03, 3], [-0.3, 0.72, 0.19, 0.06, 0.04, 3], [-0.5, 0.78, 0.12, 0.05, 0.03, 3]], { color: '#1b1614', finish: 'leather' });
            // The round chrome lamp and its two spots, pull-back bars.
            k.disc(k.trim, S.cone, ...mp(0.66, 1.0, 0), 0.11 * CAR_M, 0.16 * CAR_M, [1, 0, 0], { color: '#e3e7ea', finish: 'chrome' });
            k.disc(k.head, S.dome, ...mp(0.75, 1.0, 0), 0.1 * CAR_M, 0.04 * CAR_M, [1, 0, 0], { color: '#f4f1e6', finish: 'lens' });
            for (const z of [-0.14, 0.14]) {
              k.disc(k.trim, S.cone, ...mp(0.72, 0.84, z), 0.05 * CAR_M, 0.08 * CAR_M, [1, 0, 0], { color: '#e3e7ea', finish: 'chrome' });
              k.disc(k.drl, S.dome, ...mp(0.77, 0.84, z), 0.045 * CAR_M, 0.02 * CAR_M, [1, 0, 0], { color: '#fff4dc' });
            }
            // The V-twin: two finned chrome cylinders, the air cleaner, primary cover.
            for (const [x, a] of [[0.12, -0.5], [-0.08, 0.5]]) {
              for (let i = 0; i < 6; i++)
                k.add(k.trim, S.cylinder24, ...mp(x + Math.sin(a) * i * 0.03, 0.58 + Math.cos(a) * i * 0.035, 0), 0.075 * CAR_M, 0.012 * CAR_M, 0.075 * CAR_M, { color: '#dfe3e6', finish: 'chrome' }, 0, 0, a);
            }
            k.disc(k.trim, S.cylinder24, ...mp(0.04, 0.66, 0.13), 0.09 * CAR_M, 0.04 * CAR_M, [0, 0, 1], { color: '#e3e7ea', finish: 'chrome' });
            k.disc(k.trim, S.cylinder24, ...mp(-0.3, 0.42, -0.16), 0.16 * CAR_M, 0.05 * CAR_M, [0, 0, 1], { color: '#e3e7ea', finish: 'chrome' });
            k.exhaust('shotgun');
            // Saddlebag-free: a sissy bar and footboards.
            for (const side of [-1, 1]) k.add(k.trim, S.box, ...mp(0.5, 0.36, side * 0.26), 0.24 * CAR_M, 0.02 * CAR_M, 0.09 * CAR_M, { color: '#1b1c1e', finish: 'rubber' });
          },
        },
        dolcati: {
          wheels: { rf: 0.3, rr: 0.315, wf: 0.12, wr: 0.2, xf: 0.73, xr: -0.74 },
          rake: 0.42,
          rim: { style: 'y', spokes: 3, color: '#1a1b1d', frac: 0.62 },
          forks: '#c9a24a',
          frame: '#2a2c2f',
          engine: '#2a2c2f',
          seat: '#141516',
          singleSided: true,
          rider: { lean: -0.85, hip: [-0.26, 0.96], shoulder: [0.18, 1.3], hand: [0.46, 1.0], knee: [0.08, 0.72], foot: [-0.22, 0.46], head: 1.42, suit: '#c8102e', accent: '#f0f0ec', helmet: '#c8102e', visor: '#1a1f26' },
          build(k) {
            const { S, pod } = k;
            // The full fairing: a sharp nose, flanks to the belly pan, the tank and tail.
            pod(k.paint, [[0.84, 0.94, 0.02, 0.02, 0.02], [0.78, 0.98, 0.11, 0.1, 0.1, 2.6], [0.62, 0.96, 0.17, 0.18, 0.26, 2.8], [0.42, 0.86, 0.19, 0.18, 0.36, 3], [0.2, 0.74, 0.16, 0.12, 0.36, 3], [0.02, 0.62, 0.12, 0.06, 0.28, 3]]);
            pod(k.paint, [[0.02, 1.0, 0.1, 0.02, 0.05], [0.12, 1.02, 0.17, 0.07, 0.1, 3], [0.34, 1.04, 0.15, 0.06, 0.1, 3], [0.48, 1.02, 0.1, 0.03, 0.05]]);
            pod(k.paint, [[-0.24, 0.96, 0.12, 0.04, 0.08, 3], [-0.5, 1.02, 0.1, 0.05, 0.07, 3], [-0.72, 1.08, 0.04, 0.03, 0.03]]);
            pod(k.trim, [[-0.06, 0.95, 0.12, 0.03, 0.02, 3], [-0.34, 0.98, 0.1, 0.03, 0.02, 3]], { color: '#141516', finish: 'leather' });
            // White racing number on the tail, V4 on the flanks (trim decals).
            for (const side of [-1, 1]) {
              k.add(k.trim, S.box, ...mp(-0.5, 1.02, side * 0.098), 0.14 * CAR_M, 0.07 * CAR_M, 0.004 * CAR_M, { color: '#f0f0ec', finish: 'gloss' });
              k.add(k.trim, S.box, ...mp(0.28, 0.72, side * 0.18), 0.22 * CAR_M, 0.06 * CAR_M, 0.004 * CAR_M, { color: '#f0f0ec', finish: 'gloss' });
              // Winglets on the flanks.
              k.bar(k.trim, mp(0.62, 0.9, side * 0.17), mp(0.48, 0.92, side * 0.24), 0.012 * CAR_M, 0.08 * CAR_M, 0.005 * CAR_M, { color: '#16171a', finish: 'carbon', cell: 'carbon' });
              // The slit LED lamps and the air intakes under them.
              k.bar(k.drl, mp(0.8, 1.0, side * 0.03), mp(0.72, 1.03, side * 0.11), 0.014 * CAR_M, 0.014 * CAR_M, 0.006 * CAR_M, { color: '#f4f7ff' });
              k.patch(k.trim, [0.78, 0.94, side * 0.02], [0.7, 0.96, side * 0.1], 0.05, '#0c0d0e');
            }
            k.disc(k.head, S.box, ...mp(0.78, 0.94, 0), 0.03 * CAR_M, 0.03 * CAR_M, [1, 0, 0], { color: '#dfe4ea', finish: 'lens' });
            k.bar(k.trim, mp(0.7, 1.1, 0), mp(0.6, 1.2, 0), 0.01 * CAR_M, 0.2 * CAR_M, 0.004 * CAR_M, { color: '#3a4652', finish: 'lens' }, [0.5, 1, 0]);
            k.exhaust('stacked');
          },
        },
        yamasaki: {
          wheels: { rf: 0.3, rr: 0.31, wf: 0.12, wr: 0.19, xf: 0.71, xr: -0.72 },
          rake: 0.42,
          rim: { style: 'split', spokes: 5, color: '#1a1b1d', frac: 0.62 },
          forks: '#c9a24a',
          frame: '#8f959b',
          engine: '#2a2c2f',
          seat: '#141516',
          rider: { lean: -0.85, hip: [-0.26, 0.95], shoulder: [0.16, 1.31], hand: [0.45, 1.0], knee: [0.08, 0.72], foot: [-0.22, 0.46], head: 1.43, suit: '#1f4fbf', accent: '#f0f0ec', helmet: '#f0f0ec', visor: '#1a1f26' },
          build(k) {
            const { S, pod } = k;
            pod(k.paint, [[0.82, 0.95, 0.02, 0.02, 0.02], [0.76, 0.99, 0.12, 0.09, 0.1, 2.6], [0.6, 0.97, 0.18, 0.18, 0.26, 2.8], [0.4, 0.86, 0.19, 0.17, 0.36, 3], [0.18, 0.74, 0.16, 0.12, 0.34, 3], [0.0, 0.62, 0.12, 0.06, 0.26, 3]]);
            pod(k.paint, [[0.0, 1.0, 0.1, 0.02, 0.05], [0.1, 1.03, 0.17, 0.07, 0.1, 3], [0.32, 1.04, 0.15, 0.06, 0.1, 3], [0.46, 1.02, 0.1, 0.03, 0.05]]);
            pod(k.paint, [[-0.24, 0.96, 0.12, 0.04, 0.08, 3], [-0.5, 1.02, 0.1, 0.05, 0.06, 3], [-0.7, 1.08, 0.04, 0.03, 0.03]]);
            pod(k.trim, [[-0.06, 0.95, 0.12, 0.03, 0.02, 3], [-0.34, 0.98, 0.1, 0.03, 0.02, 3]], { color: '#141516', finish: 'leather' });
            for (const side of [-1, 1]) {
              // Racing graphics: a white and black slash along the fairing.
              k.bar(k.trim, mp(0.62, 0.84, side * 0.182), mp(0.14, 0.7, side * 0.163), 0.06 * CAR_M, 0.004 * CAR_M, 0.002 * CAR_M, { color: '#f0f0ec', finish: 'gloss' });
              k.bar(k.trim, mp(0.56, 0.76, side * 0.184), mp(0.16, 0.64, side * 0.162), 0.03 * CAR_M, 0.004 * CAR_M, 0.002 * CAR_M, { color: '#16181b', finish: 'gloss' });
              k.add(k.trim, S.box, ...mp(-0.48, 1.02, side * 0.098), 0.14 * CAR_M, 0.07 * CAR_M, 0.004 * CAR_M, { color: '#f0f0ec', finish: 'gloss' });
              // Twin eye lamps with the LED brows, the ram-air slot between.
              k.disc(k.head, S.cylinder24, ...mp(0.76, 0.96, side * 0.07), 0.035 * CAR_M, 0.02 * CAR_M, [1, 0, side * 0.3], { color: '#dfe4ea', finish: 'lens' });
              k.bar(k.drl, mp(0.77, 1.0, side * 0.03), mp(0.72, 1.01, side * 0.12), 0.012 * CAR_M, 0.012 * CAR_M, 0.005 * CAR_M, { color: '#f4f7ff' });
              k.bar(k.trim, mp(0.62, 0.9, side * 0.17), mp(0.5, 0.92, side * 0.22), 0.012 * CAR_M, 0.07 * CAR_M, 0.005 * CAR_M, { color: '#16171a', finish: 'carbon', cell: 'carbon' });
            }
            k.patch(k.trim, [0.83, 0.93, -0.03], [0.8, 0.93, 0.03], 0.04, '#0c0d0e');
            k.bar(k.trim, mp(0.68, 1.1, 0), mp(0.58, 1.2, 0), 0.01 * CAR_M, 0.2 * CAR_M, 0.004 * CAR_M, { color: '#3a4652', finish: 'lens' }, [0.5, 1, 0]);
            k.exhaust('side');
          },
        },
        kr500: {
          wheels: { rf: 0.36, rr: 0.345, wf: 0.09, wr: 0.14, xf: 0.76, xr: -0.72 },
          rake: 0.46,
          rim: { style: 'dirt', spokes: 18, color: '#1a1b1d', frac: 0.8 },
          tyre: 'knobby',
          forks: '#e37a1a',
          frame: '#e36a0a',
          engine: '#3a3d42',
          seat: '#15161a',
          dirt: true,
          rider: { lean: -0.32, hip: [-0.18, 1.08], shoulder: [0.16, 1.58], hand: [0.5, 1.28], knee: [0.18, 0.9], foot: [-0.04, 0.48], head: 1.78, suit: '#ff6a00', accent: '#15161a', helmet: '#ff6a00', visor: '#15161a', peak: true },
          build(k) {
            const { S, pod } = k;
            // Slim tank and radiator shrouds, the long flat seat to the tail, the side panels.
            pod(k.paint, [[-0.02, 1.02, 0.08, 0.02, 0.04], [0.1, 1.06, 0.13, 0.05, 0.08, 3], [0.3, 1.06, 0.11, 0.04, 0.07, 3], [0.4, 1.03, 0.06, 0.02, 0.04]]);
            for (const side of [-1, 1]) pod(k.paint, [[0.14, 0.96, 0.02, 0.1, 0.14, 3], [0.36, 0.98, 0.02, 0.12, 0.16, 3], [0.46, 0.96, 0.02, 0.09, 0.1, 3]], { offset: [0, 0, side * 0.13] });
            pod(k.trim, [[0.3, 1.08, 0.08, 0.02, 0.01, 3], [-0.02, 1.1, 0.12, 0.03, 0.02, 3], [-0.5, 1.12, 0.1, 0.03, 0.02, 3], [-0.72, 1.12, 0.06, 0.02, 0.02, 3]], { color: '#15161a', finish: 'leather' });
            pod(k.trim, [[-0.3, 1.02, 0.12, 0.06, 0.08, 3], [-0.6, 1.06, 0.09, 0.04, 0.05, 3], [-0.86, 1.1, 0.04, 0.02, 0.02, 3]], { color: '#f0f0ec', finish: 'gloss' });
            // The front number plate with its lamp, the high front fender, the rear fender.
            k.bar(k.trim, mp(0.66, 1.02, 0), mp(0.72, 1.22, 0), 0.26 * CAR_M, 0.02 * CAR_M, 0.01 * CAR_M, { color: '#f0f0ec', finish: 'gloss' }, [0, 0, 1]);
            k.disc(k.head, S.cylinder24, ...mp(0.72, 1.06, 0), 0.05 * CAR_M, 0.03 * CAR_M, [1, 0.1, 0], { color: '#dfe4ea', finish: 'lens' });
            k.bar(k.drl, mp(0.73, 1.12, -0.05), mp(0.73, 1.12, 0.05), 0.01 * CAR_M, 0.01 * CAR_M, 0.004 * CAR_M, { color: '#f4f7ff' });
            pod(k.trim, [[1.02, 0.84, 0.07, 0.02, 0.01, 3], [0.86, 0.86, 0.08, 0.03, 0.01, 3], [0.6, 0.8, 0.07, 0.02, 0.01, 3]], { color: '#f0f0ec', finish: 'gloss' });
            // The trellis frame's rails, radiator louvres.
            for (const side of [-1, 1]) {
              k.patch(k.trim, [0.4, 0.86, side * 0.15], [0.2, 0.86, side * 0.155], 0.14, '#1a1b1d', 'slats');
              k.bar(k.trim, mp(0.5, 1.0, side * 0.06), mp(-0.1, 0.52, side * 0.1), 0.03 * CAR_M, 0.03 * CAR_M, 0.012 * CAR_M, { color: '#e36a0a', finish: 'gloss' });
            }
            // Hand guards on the wide bars.
            for (const side of [-1, 1]) k.bar(k.trim, mp(0.52, 1.3, side * 0.3), mp(0.6, 1.27, side * 0.4), 0.05 * CAR_M, 0.03 * CAR_M, 0.012 * CAR_M, { color: '#f0f0ec', finish: 'gloss' });
            k.exhaust('upswept');
          },
        },
      };
      /*
       * A rider as one merged mesh per pose: boots, shins and thighs to the pegs
       * and saddle, the torso in leathers or a jacket, arms to the grips, a
       * helmet with its visor (an open face and a peak where the body says).
       * Built in the bike's frame; `hand` is the grips' height, `foot` the pegs'.
       */
      const motoRiders = new Map();
      function motoRiderGeometry(type) {
        if (motoRiders.has(type)) return motoRiders.get(type);
        const pose = MOTO_BODIES[type].rider,
          set = civSet(),
          S = civShapeKit(),
          limb = (a, b, r, color, finish = 'leather') => civBar(set, a, b, r * 2 * CAR_M, r * 2 * CAR_M, r * 0.9 * CAR_M, { color, finish }),
          [hx, hy] = pose.hip,
          [sx, sy] = pose.shoulder,
          [ax, ay] = pose.hand,
          [kx, ky] = pose.knee,
          [fx, fy] = pose.foot;
        for (const side of [-1, 1]) {
          const hz = side * 0.12,
            kz = side * 0.17,
            fz = side * 0.16,
            sz = side * 0.2,
            az = side * (type === 'kr500' ? 0.36 : type === 'cruiser' ? 0.34 : 0.26);
          limb(mp(hx, hy, hz), mp(kx, ky, kz), 0.085, pose.suit);
          limb(mp(kx, ky, kz), mp(fx, fy + 0.04, fz), 0.065, pose.suit);
          // Boot on the peg.
          civBar(set, mp(fx - 0.08, fy, fz), mp(fx + 0.14, fy, fz), 0.12 * CAR_M, 0.1 * CAR_M, 0.04 * CAR_M, { color: '#141516', finish: 'leather' });
          // Upper and lower arm to the grip, the glove.
          const ex = (sx + ax) / 2 - 0.02,
            ey = (sy + ay) / 2 - 0.1;
          limb(mp(sx, sy, sz), mp(ex, ey, side * 0.24), 0.055, pose.suit);
          limb(mp(ex, ey, side * 0.24), mp(ax, ay, az), 0.045, pose.suit);
          k2(set, S, ax, ay, az, pose);
          // A stripe down each arm and leg in the accent colour.
          civBar(set, mp(hx + 0.02, hy + 0.05, side * 0.2), mp(kx + 0.02, ky + 0.06, side * 0.25), 0.03 * CAR_M, 0.01 * CAR_M, 0.004 * CAR_M, { color: pose.accent, finish: 'leather' });
        }
        // Torso: a tapered block from the hips to the shoulders, a hump behind the neck.
        // (Up [1, 0, 0]: the chest's depth lies in the bike's plane, the shoulders across it.)
        civBar(set, mp(hx, hy + 0.04, 0), mp(sx, sy - 0.06, 0), 0.24 * CAR_M, 0.36 * CAR_M, 0.1 * CAR_M, { color: pose.suit, finish: 'leather' }, [1, 0, 0]);
        civBar(set, mp(hx - 0.06, hy + 0.12, 0), mp(sx - 0.06, sy - 0.08, 0), 0.14 * CAR_M, 0.2 * CAR_M, 0.04 * CAR_M, { color: pose.accent, finish: 'leather' }, [1, 0, 0]);
        if (type !== 'cruiser') civBar(set, mp(sx - 0.1, sy + 0.02, 0), mp(sx - 0.02, sy + 0.1, 0), 0.08 * CAR_M, 0.16 * CAR_M, 0.04 * CAR_M, { color: pose.suit, finish: 'leather' }, [1, 0, 0]);
        // The helmet a little ahead of the shoulders, the visor facing the way ahead.
        const headX = sx + (type === 'cruiser' ? 0.02 : 0.1),
          headY = pose.head;
        civAdd(set, S.sphere, ...mp(headX, headY, 0), 0.14 * CAR_M, 0.14 * CAR_M, 0.13 * CAR_M, { color: pose.helmet, finish: 'gloss' });
        if (pose.visor) civAdd(set, S.sphere, ...mp(headX + 0.06, headY + 0.005, 0), 0.085 * CAR_M, 0.06 * CAR_M, 0.105 * CAR_M, { color: pose.visor, finish: 'lens' });
        if (pose.openFace) {
          civAdd(set, S.sphere, ...mp(headX + 0.07, headY - 0.03, 0), 0.07 * CAR_M, 0.08 * CAR_M, 0.08 * CAR_M, { color: '#b58a6c', finish: 'matte' });
          civAdd(set, S.box, ...mp(headX + 0.11, headY + 0.0, 0), 0.02 * CAR_M, 0.03 * CAR_M, 0.14 * CAR_M, { color: '#101112', finish: 'gloss' });
        }
        if (pose.peak) civBar(set, mp(headX + 0.08, headY + 0.11, 0), mp(headX + 0.22, headY + 0.08, 0), 0.015 * CAR_M, 0.2 * CAR_M, 0.006 * CAR_M, { color: pose.helmet, finish: 'gloss' });
        civAdd(set, S.cylinder24, ...mp(headX - 0.02, headY - 0.14, 0), 0.06 * CAR_M, 0.06 * CAR_M, 0.06 * CAR_M, { color: pose.suit, finish: 'leather' });
        const geo = civGeometry(set);
        motoRiders.set(type, geo);
        return geo;
      }
      // A gloved hand on a grip.
      function k2(set, S, ax, ay, az, pose) {
        civAdd(set, S.sphere, ...mp(ax, ay, az), 0.05 * CAR_M, 0.045 * CAR_M, 0.055 * CAR_M, { color: '#141516', finish: 'leather' });
      }
      /*
       * The kit for a body: shared frame, forks, swingarm, engine, exhausts and
       * the body's own parts, merged into paint / trim / drl / lamp sets; the
       * fork (steering) parts go into their own sets so the fork group turns.
       */
      const motoKits = new Map();
      function motoKit(type, l) {
        const key = type + ':' + l.toFixed(2);
        if (motoKits.has(key)) return motoKits.get(key);
        const body = MOTO_BODIES[type],
          S = civShapeKit(),
          M = CAR_M,
          wd = body.wheels,
          sets = { paint: civSet(), trim: civSet(), drl: civSet(), head: civSet(), tail: civSet(), forkTrim: civSet(), forkPaint: civSet() },
          headstock = mp(wd.xf - Math.tan(body.rake) * (1.02 - wd.rf), 1.02),
          rearAxle = mp(wd.xr, wd.rr),
          frontAxle = mp(wd.xf, wd.rf),
          k = {
            S,
            M,
            paint: sets.paint,
            trim: sets.trim,
            drl: sets.drl,
            head: sets.head,
            tail: sets.tail,
            add: civAdd,
            bar: civBar,
            beam: civBeam,
            disc: civDisc,
            pod(set, stations, options = {}) {
              const geo = motoPod(stations);
              if (options.offset) geo.translate(options.offset[0] * M, options.offset[1] * M, options.offset[2] * M);
              civAddMatrix(set, geo, civIdentity, set === sets.trim ? options : { uv: [0.5, 0.5], color: options.color || '#ffffff' });
              geo.dispose();
            },
            // A flat quad from a to b (the two top corners), `h` metres tall.
            patch(set, a, b, h, color, cell) {
              const geo = gridGeometry(1, 1, (u, v) => {
                const p = [lerpNumber(a[0], b[0], u), lerpNumber(a[1], b[1], u) - (1 - v) * h, lerpNumber(a[2], b[2], u)];
                return mp(p[0], p[1], p[2]);
              }, (p, out) => out.set(p.x - 3, p.y, 0));
              civAddMatrix(set, geo, civIdentity, { color, finish: 'gloss', cell });
              geo.dispose();
            },
            exhaust(style) {
              const chrome = { color: '#d7dce0', finish: 'chrome' },
                dark = { color: '#2a2c2f', finish: 'satin' },
                ti = { color: '#8a8f96', finish: 'alloy' };
              if (style === 'belly') {
                civBar(sets.trim, mp(0.3, 0.5, 0.05), mp(0.05, 0.28, 0.1), 0.05 * M, 0.05 * M, 0.02 * M, dark);
                civBar(sets.trim, mp(0.05, 0.3, 0.12), mp(-0.28, 0.32, 0.14), 0.12 * M, 0.14 * M, 0.04 * M, ti);
              } else if (style === 'shotgun') {
                for (const [y, len] of [[0.36, 1.25], [0.5, 1.2]]) {
                  civBar(sets.trim, mp(0.2, y + 0.18, 0.15), mp(0.0, y, 0.2), 0.06 * M, 0.06 * M, 0.03 * M, chrome);
                  civBar(sets.trim, mp(0.0, y, 0.2), mp(-len, y + 0.04, 0.22), 0.075 * M, 0.075 * M, 0.035 * M, chrome);
                }
              } else if (style === 'stacked') {
                for (const y of [0.24, 0.34]) civBar(sets.trim, mp(0.1, y, 0.12), mp(-0.28, y + 0.06, 0.16), 0.08 * M, 0.08 * M, 0.035 * M, ti);
                civBar(sets.trim, mp(-0.1, 0.24, 0.16), mp(-0.3, 0.38, 0.18), 0.04 * M, 0.2 * M, 0.02 * M, { color: '#16171a', finish: 'carbon', cell: 'carbon' });
              } else if (style === 'side') {
                civBar(sets.trim, mp(0.25, 0.4, 0.06), mp(-0.05, 0.3, 0.14), 0.05 * M, 0.05 * M, 0.02 * M, dark);
                civBar(sets.trim, mp(-0.05, 0.32, 0.15), mp(-0.42, 0.52, 0.2), 0.11 * M, 0.12 * M, 0.04 * M, ti);
                civDisc(sets.trim, S.hex, ...mp(-0.43, 0.53, 0.2), 0.05 * M, 0.02 * M, [-0.8, 0.45, 0], { color: '#16171a', finish: 'matte' });
              } else if (style === 'upswept') {
                civBar(sets.trim, mp(0.28, 0.66, 0.08), mp(0.18, 0.46, 0.14), 0.04 * M, 0.04 * M, 0.018 * M, dark);
                civBar(sets.trim, mp(0.18, 0.46, 0.14), mp(-0.2, 0.74, 0.17), 0.045 * M, 0.045 * M, 0.02 * M, dark);
                civBar(sets.trim, mp(-0.2, 0.76, 0.17), mp(-0.62, 0.98, 0.16), 0.1 * M, 0.1 * M, 0.04 * M, ti);
              }
            },
          };
        // ---- Frame, engine, swingarm, shock, chain ----
        const frame = { color: body.frame, finish: 'gloss' };
        civBar(sets.trim, headstock, mp(-0.25, 0.72), 0.08 * M, 0.07 * M, 0.02 * M, frame);
        for (const side of [-1, 1]) {
          civBar(sets.trim, [headstock[0], headstock[1] - 0.05 * M, side * 0.05 * M], mp(0.02, 0.5, side * 0.11), 0.05 * M, 0.04 * M, 0.015 * M, frame);
          civBar(sets.trim, mp(0.0, 0.92, side * 0.1), mp(-0.6, 1.0, side * 0.08), 0.03 * M, 0.03 * M, 0.012 * M, frame);
        }
        civBar(sets.trim, mp(0.28, 0.56, 0), mp(-0.22, 0.5, 0), 0.34 * M, 0.26 * M, 0.06 * M, { color: body.engine, finish: 'satin' });
        civBar(sets.trim, mp(0.2, 0.62, 0), mp(0.02, 0.86, 0), 0.2 * M, 0.22 * M, 0.05 * M, { color: body.engine, finish: 'satin' });
        civDisc(sets.trim, S.cylinder24, ...mp(-0.02, 0.44, 0.14), 0.1 * M, 0.03 * M, [0, 0, 1], { color: '#5a5e63', finish: 'alloy' });
        // Swingarm (single-sided on the Dolcati), the shock, the chain, the rear fender hugger.
        const armSides = body.singleSided ? [-1] : [-1, 1];
        for (const side of armSides) civBar(sets.trim, mp(-0.18, 0.48, side * 0.1), [rearAxle[0], rearAxle[1], side * 0.1 * M], 0.1 * M, 0.04 * M, 0.02 * M, { color: body.dirt ? '#b9bec3' : '#2a2c2f', finish: 'alloy' });
        civBar(sets.trim, mp(-0.18, 0.56, 0), mp(-0.34, 0.9, 0), 0.06 * M, 0.06 * M, 0.025 * M, { color: body.dirt ? '#e37a1a' : '#c9a24a', finish: 'gloss' });
        civBar(sets.trim, mp(-0.02, 0.44, 0.12), [rearAxle[0], rearAxle[1], 0.12 * M], 0.03 * M, 0.012 * M, 0.006 * M, { color: '#3a3d41', finish: 'alloy' });
        // Tail lamp and plate hanger.
        const tailX = wd.xr - 0.02;
        civAdd(sets.tail, S.box, ...mp(body.dirt ? -0.86 : tailX + 0.02, body.dirt ? 1.06 : 1.04), 0.03 * M, 0.035 * M, 0.1 * M, { color: '#d61e1e', finish: 'lens' });
        civBar(sets.trim, mp(tailX + 0.1, 0.98), mp(tailX - 0.12, 0.76), 0.02 * M, 0.04 * M, 0.008 * M, { color: '#16171a', finish: 'plastic' });
        civAdd(sets.trim, S.box, ...mp(tailX - 0.14, 0.72), 0.004 * M, 0.12 * M, 0.18 * M, { color: '#ffffff', finish: 'satin', cell: 'plate' });
        for (const side of [-1, 1]) civAdd(sets.drl, S.box, ...mp(tailX - 0.08, 0.86, side * 0.08), 0.03 * M, 0.02 * M, 0.02 * M, { color: '#ffa227' });
        // Footpegs (rider's and passenger's).
        for (const side of [-1, 1]) civBar(sets.trim, mp(body.rider.foot[0], body.rider.foot[1] - 0.02, side * 0.1), mp(body.rider.foot[0], body.rider.foot[1] - 0.02, side * 0.2), 0.02 * M, 0.02 * M, 0.008 * M, { color: '#9aa0a6', finish: 'alloy' });
        body.build(k);
        // ---- The fork: tubes from the headstock to the axle, clamps, bars, mirrors ----
        // Built about the headstock; the fork group sits there, tilted by the rake.
        const fork = { tubes: { color: body.forks, finish: 'chrome' }, black: { color: '#16171a', finish: 'satin' } },
          length = Math.hypot(headstock[0] - frontAxle[0], headstock[1] - frontAxle[1]);
        for (const side of [-1, 1]) {
          civBar(sets.forkTrim, [0, 0.05 * M, side * 0.1 * M], [0, -length * 0.55, side * 0.1 * M], 0.055 * M, 0.055 * M, 0.025 * M, fork.tubes, [1, 0, 0]);
          civBar(sets.forkTrim, [0, -length * 0.5, side * 0.1 * M], [0, -length, side * 0.1 * M], 0.045 * M, 0.045 * M, 0.02 * M, { color: '#1c1d20', finish: 'alloy' }, [1, 0, 0]);
          // Front disc and caliper.
          civDisc(sets.forkTrim, S.cylinder24, 0, -length, side * 0.075 * M, wd.rf * 0.62 * M, 0.012 * M, [0, 0, 1], { color: '#8d9298', finish: 'alloy' });
          civAdd(sets.forkTrim, S.box, -0.12 * M, -length + 0.12 * M, side * 0.075 * M, 0.06 * M, 0.12 * M, 0.04 * M, { color: body.dirt ? '#e37a1a' : '#c9a24a', finish: 'gloss' }, 0, 0, 0.4);
        }
        civBar(sets.forkTrim, [0, 0.02 * M, -0.13 * M], [0, 0.02 * M, 0.13 * M], 0.04 * M, 0.08 * M, 0.015 * M, fork.black);
        civBar(sets.forkTrim, [0, -0.12 * M, -0.13 * M], [0, -0.12 * M, 0.13 * M], 0.04 * M, 0.08 * M, 0.015 * M, fork.black);
        // Bars: clip-ons low on the superbikes, wide on the naked and dirt bikes, pull-backs on the cruiser.
        // The grips where the rider's hands are, in the fork's tilted frame.
        const handX = body.rider.hand[0] * M - headstock[0],
          handY = body.rider.hand[1] * M - headstock[1],
          barX = handX * Math.cos(body.rake) + handY * Math.sin(body.rake),
          barY = -handX * Math.sin(body.rake) + handY * Math.cos(body.rake),
          span = type === 'kr500' ? 0.4 : type === 'cruiser' ? 0.36 : type === 'bike' ? 0.34 : 0.26;
        civBar(sets.forkTrim, [barX, barY, -span * M], [barX, barY, span * M], 0.028 * M, 0.028 * M, 0.012 * M, type === 'cruiser' ? fork.tubes : fork.black);
        for (const side of [-1, 1]) civBar(sets.forkTrim, [barX, barY, side * (span - 0.06) * M], [barX, barY, side * (span + 0.02) * M], 0.04 * M, 0.04 * M, 0.018 * M, { color: '#141516', finish: 'rubber' });
        if (!body.dirt)
          for (const side of [-1, 1]) {
            civBar(sets.forkTrim, [0, 0.08 * M, side * 0.18 * M], [-0.02 * M, 0.2 * M, side * 0.28 * M], 0.015 * M, 0.015 * M, 0.006 * M, fork.black);
            civAdd(sets.forkTrim, S.box, -0.02 * M, 0.22 * M, side * 0.3 * M, 0.02 * M, 0.06 * M, 0.1 * M, { color: '#3d4852', finish: 'lens' });
          }
        const geometry = (set, options) => (set.count ? civGeometry(set, options) : null);
        const kit = {
          paint: geometry(sets.paint, { colors: true, finish: false }),
          trim: geometry(sets.trim),
          drl: geometry(sets.drl, { finish: false }),
          head: geometry(sets.head, { finish: false }),
          tail: geometry(sets.tail, { finish: false }),
          forkTrim: geometry(sets.forkTrim),
          forkPaint: geometry(sets.forkPaint, { colors: true, finish: false }),
          headstock,
          forkLength: length,
          tyres: [civTyreGeometry(body.tyre || 'road', body.rim.frac * 0.98), civTyreGeometry(body.tyre || 'road', body.rim.frac * 0.98)],
          rims: [civRimGeometry(body.rim, 1, wd.rf * M, wd.wf * M), civRimGeometry(body.rim, 1, wd.rr * M, wd.wr * M)],
          rider: motoRiderGeometry(type),
        };
        motoKits.set(key, kit);
        return kit;
      }
      // The paint for bikes: clear-coated, the vertex colours pick white panels out of it.
      function motoPaintMaterial(color) {
        const m = new Three.MeshPhysicalMaterial({ color, vertexColors: true, roughness: 0.26, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
        return m;
      }
      /*
       * A motorbike on the special-vehicle contract (see the header). Built at
       * real size (`realSize`); the wheels roll at their own radius.
       */
      function makeMotorbike(vehicle) {
        const type = vehicle.type,
          body = MOTO_BODIES[type],
          spec = vehicleSpec(vehicle),
          l = spec.l,
          kit = motoKit(type, l),
          materials = civSharedMaterials(),
          lampMaterials = civLampSet(),
          model = specialVehicle(vehicle),
          b = model.body,
          M = CAR_M,
          wd = body.wheels;
        model.bike = true;
        model.realSize = true;
        model.moto = type;
        model.paint = motoPaintMaterial(vehicle.color);
        if (kit.paint) mesh(kit.paint, model.paint, b, 0, 0, 0);
        mesh(kit.trim, materials.trim, b, 0, 0, 0);
        const drl = kit.drl ? mesh(kit.drl, materials.drlOff, b, 0, 0, 0) : null;
        if (drl) drl.castShadow = false;
        // The fork group: at the headstock, tilted back by the rake; `steer` turns inside it.
        const forkPivot = new Three.Group(),
          steer = new Three.Group();
        forkPivot.position.set(kit.headstock[0], kit.headstock[1], 0);
        forkPivot.rotation.z = body.rake;
        b.add(forkPivot);
        forkPivot.add(steer);
        mesh(kit.forkTrim, materials.trim, steer, 0, 0, 0);
        // Wheels: the tyre first (damage3d.js hides it on a burnt wreck), then the rim.
        const addWheel = (parent, x, y, r, width, i) => {
          const wheel = new Three.Group();
          wheel.position.set(x, y, 0);
          parent.add(wheel);
          const tyre = mesh(kit.tyres[i], materials.rubber, wheel, 0, 0, 0, r, width, r);
          tyre.rotation.x = Math.PI / 2;
          mesh(kit.rims[i], materials.wheel, wheel, 0, 0, 0);
          return wheel;
        };
        // The front wheel hangs from the fork (it steers with it), undone from the rake.
        // (x a hair past 0: the damage model reads x > 0 as the front wheel.)
        const front = addWheel(steer, 0.001, -kit.forkLength, wd.rf * M, wd.wf * M, 0);
        const rear = addWheel(b, wd.xr * M, wd.rr * M, wd.rr * M, wd.wr * M, 1);
        // Front x > 0 and its world position for the damage model's flat tyres.
        front.userData.front = true;
        model.wheels.push({ wheel: front, side: 1, radius: wd.rf * M, front: true }, { wheel: rear, side: 1, radius: wd.rr * M });
        const head = mesh(kit.head, lampMaterials.headOff, b, 0, 0, 0),
          tail = mesh(kit.tail, lampMaterials.tailOff, b, 0, 0, 0);
        head.castShadow = tail.castShadow = false;
        model.lamps.push({ mesh: head, key: 'headLeft', lit: lampMaterials.headOff, kind: 'head' }, { mesh: tail, key: 'tailLeft', lit: lampMaterials.tailOff, kind: 'tail' });
        // Head and tail glow, in the [head, tail] order the halo pass expects.
        model.nightLights = [halo(b, (wd.xf - 0.02) * M, 1.02 * M, 0, 9, '#ffe9bd'), halo(b, (wd.xr - 0.1) * M, 1.04 * M, 0, 6, '#ff5a44')];
        // The rider: the anchor the vehicle pass shows and hides (riders.js throws them off).
        const rider = new Three.Group();
        rider.userData.dynamic = true;
        b.add(rider);
        mesh(kit.rider, materials.trim, rider, 0, 0, 0);
        model.rider = rider;
        // For the character rig (crowd3d.js RIDERS), in this model's units: hips on
        // the saddle, hands on the grips, soles on the pegs, the torso's lean.
        const pose = body.rider,
          grip = type === 'kr500' ? 0.36 : type === 'cruiser' ? 0.34 : type === 'bike' ? 0.3 : 0.24;
        model.riderSeat = {
          seat: [pose.hip[0] * M, pose.hip[1] * M, 0],
          grip: [pose.hand[0] * M + 0.4, pose.hand[1] * M - 0.2, grip * M],
          peg: [pose.foot[0] * M, (pose.foot[1] - 0.04) * M, 0.17 * M],
          lean: pose.lean,
        };
        model.drl = drl;
        model.steer = steer;
        model.bikeUpdate = (c, deltaSeconds) => animateMotorbike(c, model, deltaSeconds);
        return model;
      }
      /*
       * Once a frame after the pass has posed the body: lamps and DRL, the fork
       * turning with the steering, and the wheelie. A wheelie comes when the
       * throttle is wide open at low speed on the KR 500 (and briefly on the
       * superbikes off the line): the body pitches up about the rear tyre's
       * contact patch, easing up and settling.
       */
      function animateMotorbike(c, m, deltaSeconds) {
        const lampsOn = vehicleLampAmount(),
          driven = c.hp > 0 && (c.ai || c === player.car || !!c.showLamps),
          braking = (!!c.braking || c.showLamps === 'brake') && c.hp > 0,
          lamps = civLampSet(),
          broken = c.damage?.lights;
        for (const lamp of m.lamps) {
          const material = broken?.[lamp.key]
            ? lamp.mesh.material
            : lamp.kind === 'head'
              ? driven
                ? lamps.headOn
                : lamps.headOff
              : braking
                ? lamps.brake
                : driven && lampsOn > 0.25
                  ? lamps.tailOn
                  : lamps.tailOff;
          if (lamp.mesh.material !== material) lamp.mesh.material = material;
        }
        if (m.drl) {
          const material = driven ? civSharedMaterials().drlOn : civSharedMaterials().drlOff;
          if (m.drl.material !== material) m.drl.material = material;
        }
        const player_ = c === player.car,
          turn = player_ ? (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) : clamp(c.av * 0.4, -1, 1),
          speed = Math.abs(c.speed || 0),
          // Little steering at speed: a bike countersteers and leans instead.
          target = -turn * 0.35 * clamp(1 - speed / (60 * KMH), 0.15, 1);
        m.steerAngle = (m.steerAngle || 0) + (target - (m.steerAngle || 0)) * Math.min(1, deltaSeconds * 7);
        m.steer.rotation.y = m.steerAngle;
        // Acceleration from the speed history (the physics does not keep it).
        const accel = m.lastSpeed === undefined ? 0 : ((c.speed || 0) - m.lastSpeed) / Math.max(1e-3, deltaSeconds);
        m.lastSpeed = c.speed || 0;
        m.accel = (m.accel || 0) + (accel - (m.accel || 0)) * Math.min(1, deltaSeconds * 6);
        const throttle = player_ ? !!(keys.KeyW || keys.ArrowUp) : m.accel > 0.2 * GRAVITY,
          dirt = m.moto === 'kr500',
          // The player's throttle is known; traffic's is read from how hard it pulls.
          pulling = player_ ? throttle : throttle && m.accel > (dirt ? 0.3 : 0.62) * GRAVITY,
          lift = c.hp > 0 && !c.fallen && pulling && speed < (dirt ? 70 : 45) * KMH && speed > 3 * KMH,
          wheelieTarget = lift ? (dirt ? 0.42 : 0.12) : 0;
        m.wheelie = (m.wheelie || 0) + (wheelieTarget - (m.wheelie || 0)) * Math.min(1, deltaSeconds * (wheelieTarget > (m.wheelie || 0) ? 2.2 : 4));
        if (m.wheelie > 0.002) {
          // Pitch about the rear contact patch (x = rear axle, y = 0).
          const xr = MOTO_BODIES[m.moto].wheels.xr * CAR_M,
            a = m.wheelie;
          m.body.rotation.z += a;
          m.body.position.x = xr - xr * Math.cos(a);
          m.body.position.y = -xr * Math.sin(a);
        } else if (m.body.position.x || m.body.position.y) m.body.position.set(0, 0, 0);
      }
      // END SUBSYSTEM: src/motorbikes3d.js
