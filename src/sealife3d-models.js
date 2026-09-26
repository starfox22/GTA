      // Sea life 3D geometry and materials: dolphins, sharks, gulls, deformation (SEA_KINDS).
      const SEA_M = UNITS_PER_METRE;
      /* ---- Geometry builder ------------------------------------------------------------ */
      function seaBuilder(headX, length) {
        const pos = [],
          col = [],
          sea = [],
          idx = [];
        const b = {
          v(x, y, z, color, part = 0, extra = 0) {
            pos.push(x * SEA_M, y * SEA_M, z * SEA_M);
            col.push(color.r, color.g, color.b);
            sea.push(clamp((headX - x) / length, 0, 1), part, extra);
            return pos.length / 3 - 1;
          },
          // A triangle wound so its normal faces `out` (a direction).
          tri(a, c1, c2, out) {
            if (out) {
              const ax = pos[a * 3],
                ay = pos[a * 3 + 1],
                az = pos[a * 3 + 2],
                ux = pos[c1 * 3] - ax,
                uy = pos[c1 * 3 + 1] - ay,
                uz = pos[c1 * 3 + 2] - az,
                wx = pos[c2 * 3] - ax,
                wy = pos[c2 * 3 + 1] - ay,
                wz = pos[c2 * 3 + 2] - az,
                nx = uy * wz - uz * wy,
                ny = uz * wx - ux * wz,
                nz = ux * wy - uy * wx;
              if (nx * out[0] + ny * out[1] + nz * out[2] < 0) {
                idx.push(a, c2, c1);
                return;
              }
            }
            idx.push(a, c1, c2);
          },
          /**
           * A lofted body along -x: `stations` { x, w, top, bot, yc, n } from the
           * head back (a station with w 0 is a tip). `paint(x, th, sin, cos)`
           * returns the colour, `part(x, th, sin, cos)` the part id.
           */
          loft(stations, segments, paint, part = () => 0) {
            let prev = null;
            // A triangle joining the lower jaw (part 1) to the rest of the head
            // (part 0) is left out: that seam is the mouth, which opens.
            const partOf = (i) => sea[i * 3 + 1];
            const lips = (a, c, d) => {
              const pa = partOf(a),
                pc = partOf(c),
                pd = partOf(d);
              return (pa === 1 || pc === 1 || pd === 1) && (pa === 0 || pc === 0 || pd === 0);
            };
            const face = (a, c, d) => {
              if (!lips(a, c, d)) idx.push(a, c, d);
            };
            for (const st of stations) {
              if (!st.w) {
                const tip = b.v(st.x, st.yc || 0, 0, paint(st.x, 0, 0, 1), part(st.x, 0, 0, 1));
                if (prev) for (let k = 0; k < segments; k++) face(tip, prev[k], prev[(k + 1) % segments]);
                prev = { tip };
                continue;
              }
              const ring = [];
              const e = 2 / (st.n || 2);
              for (let k = 0; k < segments; k++) {
                const th = (k / segments) * TAU,
                  c = Math.cos(th),
                  s = Math.sin(th),
                  pc = Math.sign(c) * Math.pow(Math.abs(c), e),
                  ps = Math.sign(s) * Math.pow(Math.abs(s), e);
                ring.push(b.v(st.x, (st.yc || 0) + (s >= 0 ? st.top : st.bot) * ps, st.w * pc, paint(st.x, th, s, c), part(st.x, th, s, c)));
              }
              if (prev && prev.tip !== undefined) for (let k = 0; k < segments; k++) face(prev.tip, ring[(k + 1) % segments], ring[k]);
              else if (prev)
                for (let k = 0; k < segments; k++) {
                  const a = prev[k],
                    bb = prev[(k + 1) % segments],
                    c = ring[k],
                    d = ring[(k + 1) % segments];
                  face(a, bb, c);
                  face(bb, d, c);
                }
              prev = ring;
            }
          },
          /**
           * A fin: `outline` [[u, v], ...] in the plane through `o` spanned by
           * `u` and `v` (3-vectors, metres), `thick` thick along their normal.
           * `paint(u, v, top)` colours it.
           */
          fin(o, u, v, outline, thick, paint, part = 0) {
            const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
              nl = Math.hypot(n[0], n[1], n[2]) || 1;
            n[0] /= nl;
            n[1] /= nl;
            n[2] /= nl;
            const contour = outline.map(([a, c]) => new Three.Vector2(a, c)),
              faces = Three.ShapeUtils.triangulateShape(contour, []),
              top = [],
              bottom = [],
              cu = outline.reduce((s, p) => s + p[0], 0) / outline.length,
              cv = outline.reduce((s, p) => s + p[1], 0) / outline.length;
            const at = (a, c, side) => [o[0] + u[0] * a + v[0] * c + n[0] * side, o[1] + u[1] * a + v[1] * c + n[1] * side, o[2] + u[2] * a + v[2] * c + n[2] * side];
            for (const [a, c] of outline) {
              // Thinner towards the edge of the fin: a little taper from its centre.
              const t = thick * 0.5;
              const p1 = at(a, c, t),
                p2 = at(a, c, -t);
              top.push(b.v(p1[0], p1[1], p1[2], paint(a, c, true), part));
              bottom.push(b.v(p2[0], p2[1], p2[2], paint(a, c, false), part));
            }
            for (const [i, j, k] of faces) {
              b.tri(top[i], top[j], top[k], n);
              b.tri(bottom[i], bottom[j], bottom[k], [-n[0], -n[1], -n[2]]);
            }
            for (let i = 0; i < outline.length; i++) {
              const j = (i + 1) % outline.length,
                mu = (outline[i][0] + outline[j][0]) / 2 - cu,
                mv = (outline[i][1] + outline[j][1]) / 2 - cv,
                out = [u[0] * mu + v[0] * mv, u[1] * mu + v[1] * mv, u[2] * mu + v[2] * mv];
              b.tri(top[i], top[j], bottom[i], out);
              b.tri(top[j], bottom[j], bottom[i], out);
            }
          },
          build() {
            const g = new Three.BufferGeometry();
            g.setAttribute('position', new Three.Float32BufferAttribute(pos, 3));
            g.setAttribute('color', new Three.Float32BufferAttribute(col, 3));
            g.setAttribute('aSea', new Three.Float32BufferAttribute(sea, 3));
            g.setIndex(idx);
            g.computeVertexNormals();
            g.computeBoundingSphere();
            return g;
          },
        };
        return b;
      }
      const seaColor = (hex) => new Three.Color(hex);
      const seaMix = (a, c, k) => a.clone().lerp(c, clamp(k, 0, 1));
      const norm3 = (x, y, z) => {
        const l = Math.hypot(x, y, z) || 1;
        return [x / l, y / l, z / l];
      };
      /* ---- The dolphin (bottlenose, 2.6 m) ---------------------------------------------- */
      function buildDolphinGeometry() {
        const b = seaBuilder(1.3, 2.6),
          cape = seaColor('#3a434d'),
          flank = seaColor('#76828e'),
          belly = seaColor('#e1e4e6'),
          eye = seaColor('#101316');
        const paint = (x, th, s, c) => {
          // A dark cape along the back, grey flanks, a pale belly; a paler blaze
          // sweeping up behind the flipper, the dark beak and a small dark eye.
          let colour = seaMix(flank, cape, (s - 0.25) / 0.5);
          colour = seaMix(colour, belly, (-s - 0.1) / 0.35 + (x > 0.3 && x < 0.8 ? 0.25 : 0));
          if (x > 1.1 && s > -0.3) colour = seaMix(colour, cape, 0.5);
          if (Math.abs(x - 0.97) < 0.035 && Math.abs(c) > 0.85 && s > -0.2 && s < 0.35) colour = eye;
          // The blowhole: a dark notch on top of the head.
          if (Math.abs(x - 0.86) < 0.03 && s > 0.97) colour = eye;
          return colour;
        };
        b.loft(
          [
            { x: 1.3, w: 0, yc: -0.03 },
            { x: 1.27, w: 0.025, top: 0.022, bot: 0.022, yc: -0.03 },
            { x: 1.2, w: 0.045, top: 0.04, bot: 0.038, yc: -0.03 },
            { x: 1.13, w: 0.055, top: 0.05, bot: 0.045, yc: -0.025 },
            { x: 1.08, w: 0.08, top: 0.095, bot: 0.06, yc: 0 },
            { x: 1.0, w: 0.12, top: 0.15, bot: 0.1, yc: 0.01 },
            { x: 0.97, w: 0.135, top: 0.165, bot: 0.115, yc: 0.01 },
            { x: 0.94, w: 0.15, top: 0.18, bot: 0.13, yc: 0.005 },
            { x: 0.86, w: 0.175, top: 0.205, bot: 0.155, yc: 0 },
            { x: 0.72, w: 0.215, top: 0.245, bot: 0.2, yc: 0 },
            { x: 0.5, w: 0.25, top: 0.28, bot: 0.245 },
            { x: 0.25, w: 0.255, top: 0.29, bot: 0.25 },
            { x: 0.0, w: 0.23, top: 0.27, bot: 0.22 },
            { x: -0.25, w: 0.18, top: 0.22, bot: 0.17, yc: 0.01 },
            { x: -0.5, w: 0.11, top: 0.16, bot: 0.11, yc: 0.02 },
            { x: -0.7, w: 0.062, top: 0.115, bot: 0.075, yc: 0.025, n: 2.4 },
            { x: -0.88, w: 0.038, top: 0.07, bot: 0.05, yc: 0.02 },
            { x: -1.0, w: 0.03, top: 0.035, bot: 0.03, yc: 0.015 },
            { x: -1.06, w: 0, yc: 0.015 },
          ],
          22,
          paint,
        );
        // Dorsal fin: falcate, swept back.
        b.fin([0, 0.25, 0], [1, 0, 0], [0, 1, 0], [[0.15, 0], [0.03, 0.12], [-0.09, 0.24], [-0.24, 0.34], [-0.21, 0.27], [-0.22, 0.15], [-0.3, 0]], 0.045, () => cape);
        // Flippers.
        for (const side of [-1, 1])
          b.fin([0.62, -0.13, 0.18 * side], norm3(-0.55, -0.45, 0.7 * side), [1, 0, 0], [[0, 0.1], [0, -0.1], [0.22, -0.12], [0.34, -0.1], [0.31, -0.04], [0.15, 0.06]], 0.035, (u, v, top) => (top === side > 0 ? cape : flank));
        // Flukes: a horizontal crescent with a median notch.
        b.fin(
          [-1.0, 0.015, 0],
          [1, 0, 0],
          [0, 0, 1],
          [[0.02, 0], [-0.05, 0.12], [-0.17, 0.3], [-0.27, 0.31], [-0.22, 0.2], [-0.2, 0.08], [-0.25, 0], [-0.2, -0.08], [-0.22, -0.2], [-0.27, -0.31], [-0.17, -0.3], [-0.05, -0.12]],
          0.03,
          (u, v, top) => (top ? belly : cape),
        );
        return b.build();
      }
      /* ---- The great white (5 m) ---------------------------------------------------------- */
      const SHARK_HINGE_X = 1.66,
        SHARK_HINGE_Y = -0.12;
      function buildSharkGeometry() {
        const b = seaBuilder(2.5, 5.0),
          back = seaColor('#56616a'),
          dark = seaColor('#3d464e'),
          belly = seaColor('#efeee9'),
          black = seaColor('#07080a'),
          gill = seaColor('#2a3036'),
          gum = seaColor('#6a2226'),
          throat = seaColor('#3a0e10'),
          tooth = seaColor('#f4f1e6');
        const slits = [1.55, 1.46, 1.37, 1.28, 1.19];
        // The countershading line wanders: higher over the gills, lower on the flank.
        const line = (x) => -0.12 + 0.08 * Math.sin(x * 5.1) + 0.05 * Math.sin(x * 11.7 + 1);
        const paint = (x, th, s, c) => {
          let colour = s > line(x) + 0.05 ? seaMix(back, dark, (s - 0.5) / 0.5) : s > line(x) - 0.03 ? seaMix(belly, back, (s - line(x) + 0.03) / 0.08) : belly;
          if (x > 2.2) colour = seaMix(colour, back, 0.3);
          for (const g of slits) if (Math.abs(x - g) < 0.012 && Math.abs(c) > 0.5 && s > -0.35 && s < 0.5) colour = gill;
          if (Math.abs(x - 2.12) < 0.022 && Math.abs(c) > 0.72 && s > 0.08 && s < 0.42) colour = black;
          return colour;
        };
        // The lower jaw: the underside of the head forward of the hinge.
        const part = (x, th, s) => (x > SHARK_HINGE_X && s < -0.3 ? 1 : 0);
        const stations = [
          { x: 2.5, w: 0, yc: 0.05 },
          { x: 2.46, w: 0.06, top: 0.06, bot: 0.05, yc: 0.05 },
          { x: 2.35, w: 0.17, top: 0.16, bot: 0.12, yc: 0.03 },
          { x: 2.18, w: 0.28, top: 0.26, bot: 0.22, yc: 0.01 },
          { x: 2.14, w: 0.3, top: 0.275, bot: 0.24, yc: 0.01 },
          { x: 2.12, w: 0.31, top: 0.285, bot: 0.25, yc: 0.01 },
          { x: 2.1, w: 0.32, top: 0.29, bot: 0.26, yc: 0.008 },
          { x: 2.0, w: 0.37, top: 0.34, bot: 0.31 },
          { x: 1.8, w: 0.44, top: 0.41, bot: 0.39 },
          { x: 1.68, w: 0.48, top: 0.45, bot: 0.43 },
          { x: 1.64, w: 0.49, top: 0.46, bot: 0.44 },
        ];
        for (const g of slits) {
          const w = 0.5 + (1.6 - g) * 0.3;
          stations.push({ x: g + 0.025, w, top: w * 0.95, bot: w * 0.93 }, { x: g, w, top: w * 0.95, bot: w * 0.93 }, { x: g - 0.025, w, top: w * 0.95, bot: w * 0.93 });
        }
        stations.push(
          { x: 1.0, w: 0.575, top: 0.575, bot: 0.555 },
          { x: 0.75, w: 0.575, top: 0.58, bot: 0.54 },
          { x: 0.5, w: 0.55, top: 0.56, bot: 0.5 },
          { x: 0.2, w: 0.48, top: 0.5, bot: 0.42 },
          { x: -0.1, w: 0.39, top: 0.42, bot: 0.33, yc: 0.01 },
          { x: -0.4, w: 0.28, top: 0.3, bot: 0.24, yc: 0.02 },
          { x: -0.7, w: 0.19, top: 0.2, bot: 0.16, yc: 0.03 },
          { x: -0.95, w: 0.15, top: 0.12, bot: 0.1, yc: 0.04, n: 2.6 },
          { x: -1.12, w: 0.135, top: 0.09, bot: 0.08, yc: 0.05, n: 2.6 },
          { x: -1.3, w: 0.08, top: 0.08, bot: 0.07, yc: 0.06 },
          { x: -1.45, w: 0, yc: 0.06 },
        );
        b.loft(stations, 26, paint, part);
        // The mouth cavity, inside the head: seen when the jaw drops.
        b.loft(
          [
            { x: 2.36, w: 0, yc: -0.02 },
            { x: 2.3, w: 0.1, top: 0.06, bot: 0.08, yc: -0.04 },
            { x: 2.1, w: 0.22, top: 0.12, bot: 0.16, yc: -0.07 },
            { x: 1.85, w: 0.3, top: 0.16, bot: 0.22, yc: -0.08 },
            { x: 1.6, w: 0.28, top: 0.14, bot: 0.2, yc: -0.06 },
            { x: 1.45, w: 0, yc: -0.05 },
          ],
          14,
          (x, th, s) => (s < -0.2 ? gum : throat),
          () => 2,
        );
        // Teeth: two rows of triangles along the lips, the upper ones hanging
        // down from the lifting snout, the lower ones rising from the jaw.
        const teeth = (upper) => {
          for (let i = 0; i <= 12; i++) {
            const k = i / 12,
              x = 2.4 - k * 0.66,
              half = 0.06 + 0.22 * Math.sin(Math.min(1, (2.46 - x) / 0.5) * Math.PI * 0.5),
              y = (upper ? -0.075 : -0.1) - (1 - k) * 0.02,
              size = 0.05 + 0.03 * Math.sin(k * Math.PI);
            for (const side of [-1, 1]) {
              const z = side * half * (upper ? 0.93 : 0.9);
              const tipY = upper ? y - size : y + size * 0.9;
              const pa = b.v(x + size * 0.45, y, z, tooth, upper ? 3 : 1),
                pb = b.v(x - size * 0.45, y, z, tooth, upper ? 3 : 1),
                pc = b.v(x, tipY, z * 0.97, tooth, upper ? 3 : 1);
              b.tri(pa, pb, pc, [0, 0, side]);
              const qa = b.v(x + size * 0.45, y, z, tooth, upper ? 3 : 1),
                qb = b.v(x - size * 0.45, y, z, tooth, upper ? 3 : 1),
                qc = b.v(x, tipY, z * 0.97, tooth, upper ? 3 : 1);
              b.tri(qa, qb, qc, [0, 0, -side]);
            }
          }
        };
        teeth(true);
        teeth(false);
        const finPaint = (u, v, top) => (top ? back : dark);
        // First dorsal: the big triangular fin, the one that cuts the surface.
        b.fin([0.55, 0.5, 0], [1, 0, 0], [0, 1, 0], [[0.45, 0], [0.22, 0.34], [-0.02, 0.68], [-0.18, 0.95], [-0.2, 0.86], [-0.2, 0.6], [-0.25, 0.28], [-0.33, 0]], 0.08, () => back);
        // Pectorals: long, swept and angled down.
        for (const side of [-1, 1])
          b.fin([1.05, -0.28, 0.44 * side], norm3(-0.32, -0.42, 0.85 * side), [1, 0, 0], [[0, 0.3], [0, -0.25], [0.5, -0.25], [1.05, -0.2], [0.98, -0.05], [0.55, 0.13]], 0.06, (u, v, top) => (top === side > 0 ? back : belly));
        // Pelvic fins, second dorsal and anal fin.
        for (const side of [-1, 1]) b.fin([-0.35, -0.28, 0.17 * side], norm3(-0.5, -0.5, 0.7 * side), [1, 0, 0], [[0, 0.12], [0, -0.1], [0.25, -0.12], [0.21, 0.02]], 0.04, finPaint);
        b.fin([-0.8, 0.12, 0], [1, 0, 0], [0, 1, 0], [[0.06, 0], [-0.03, 0.11], [-0.08, 0.1], [-0.13, 0]], 0.03, () => back);
        b.fin([-0.85, -0.06, 0], [1, 0, 0], [0, 1, 0], [[0.05, 0], [-0.05, -0.1], [-0.1, -0.08], [-0.13, 0]], 0.03, () => back);
        // The tail: a tall lunate crescent.
        b.fin(
          [-1.35, 0.06, 0],
          [1, 0, 0],
          [0, 1, 0],
          [[0.15, 0.05], [-0.22, 0.55], [-0.6, 1.05], [-0.68, 1.0], [-0.46, 0.45], [-0.32, 0.03], [-0.5, -0.42], [-0.56, -0.86], [-0.48, -0.87], [-0.2, -0.4], [0.12, -0.06]],
          0.06,
          () => back,
        );
        return b.build();
      }
      /* ---- The gull (herring gull, 1.4 m span) ------------------------------------------ */
      const GULL_SHOULDER = 0.05 * SEA_M,
        GULL_ELBOW = 0.3 * SEA_M,
        GULL_REACH = 0.66 * SEA_M;
      function buildGullGeometry() {
        const b = seaBuilder(0.3, 0.58),
          white = seaColor('#f4f5f3'),
          mantle = seaColor('#9ea8b1'),
          bill = seaColor('#e9c33e'),
          red = seaColor('#d2332c'),
          ink = seaColor('#131416'),
          under = seaColor('#e3e7ea'),
          leg = seaColor('#e3a39a');
        b.loft(
          [
            { x: 0.3, w: 0, yc: 0.03 },
            { x: 0.27, w: 0.008, top: 0.01, bot: 0.01, yc: 0.033 },
            { x: 0.22, w: 0.014, top: 0.016, bot: 0.016, yc: 0.035 },
            { x: 0.19, w: 0.03, top: 0.035, bot: 0.03, yc: 0.04 },
            { x: 0.15, w: 0.045, top: 0.05, bot: 0.042, yc: 0.045 },
            { x: 0.11, w: 0.045, top: 0.05, bot: 0.045, yc: 0.04 },
            { x: 0.07, w: 0.038, top: 0.04, bot: 0.04, yc: 0.025 },
            { x: 0.02, w: 0.06, top: 0.055, bot: 0.06, yc: 0 },
            { x: -0.06, w: 0.07, top: 0.06, bot: 0.065 },
            { x: -0.14, w: 0.06, top: 0.05, bot: 0.055 },
            { x: -0.2, w: 0.042, top: 0.03, bot: 0.035, yc: 0.01 },
            { x: -0.25, w: 0.048, top: 0.012, bot: 0.012, yc: 0.015, n: 3 },
            { x: -0.28, w: 0, yc: 0.015 },
          ],
          12,
          (x, th, s, c) => {
            if (x > 0.2) return x > 0.235 && x < 0.26 && s < -0.2 ? red : bill;
            if (Math.abs(x - 0.155) < 0.02 && Math.abs(c) > 0.7 && s > 0) return ink;
            if (x < 0.03 && x > -0.21 && s > 0.55) return mantle;
            return white;
          },
        );
        // The wings, one outline each side: inner wing to the wrist, then the
        // hand to a pointed black tip with a white mirror; white trailing edge.
        const outline = [[0.05, 0], [0.06, 0.2], [0.035, 0.36], [-0.02, 0.5], [-0.13, 0.68], [-0.16, 0.62], [-0.13, 0.46], [-0.1, 0.36], [-0.12, 0.2], [-0.1, 0]];
        for (const side of [-1, 1])
          b.fin(
            [0.0, 0.04, GULL_SHOULDER / SEA_M * side],
            [1, 0, 0],
            [0, 0, side],
            outline,
            0.015,
            (u, v, normalSide) => {
              // The outline's normal points down on the right wing, up on the left.
              const top = side > 0 ? !normalSide : normalSide;
              if (!top) return v > 0.55 ? seaColor('#50555a') : under;
              if (v > 0.5) return Math.abs(v - 0.61) < 0.03 && u < -0.08 ? white : ink;
              return u < -0.095 && v < 0.4 ? white : mantle;
            },
            2,
          );
        // Legs, shown only while perched (part 4).
        for (const side of [-1, 1]) {
          const z = 0.022 * side;
          b.fin([-0.03, -0.05, z], [0, -1, 0], [1, 0, 0], [[0, -0.008], [0, 0.008], [0.09, 0.006], [0.09, -0.006]], 0.012, () => leg, 4);
          b.fin([-0.03, -0.14, z], [1, 0, 0], [0, 0, 1], [[0.045, 0], [-0.015, 0.02], [-0.015, -0.02]], 0.006, () => leg, 4);
        }
        return b.build();
      }
      /* ---- The shared vertex deformation (GLSL) -------------------------------------------- */
      const SEA_DEFORM = `
        attribute vec3 aSea;
        attribute vec4 iAnim;
        void seaDeform( inout vec3 p, inout vec3 n ) {
          float s = aSea.x;
          #if SEA_KIND == 0
            // Dolphin: a wave down the body, growing to the flukes, which beat up and down.
            float ph = iAnim.x - s * 2.4;
            float amp = iAnim.y;
            float dy = amp * s * s * sin( ph );
            float slope = -( amp * ( 2.0 * s * sin( ph ) - 2.4 * s * s * cos( ph ) ) ) / ${(2.6 * SEA_M).toFixed(2)};
            p.y += dy - amp * 0.08 * sin( iAnim.x );
            float ca = cos( atan( slope ) ), sa = sin( atan( slope ) );
            n = vec3( n.x * ca - n.y * sa, n.x * sa + n.y * ca, n.z );
          #elif SEA_KIND == 1
            // Shark: the jaw drops about its hinge and the snout lifts, then the
            // lateral sweep, stiff at the head and full at the tail.
            float mouth = iAnim.z;
            if ( aSea.y > 0.5 && aSea.y < 1.5 ) {
              float w = smoothstep( ${(SHARK_HINGE_X * SEA_M).toFixed(2)}, ${((SHARK_HINGE_X + 0.25) * SEA_M).toFixed(2)}, p.x );
              float ang = -mouth * 0.8 * ( 0.35 + 0.65 * w );
              vec2 q = p.xy - vec2( ${(SHARK_HINGE_X * SEA_M).toFixed(2)}, ${(SHARK_HINGE_Y * SEA_M).toFixed(2)} );
              float c = cos( ang ), sn = sin( ang );
              p.xy = vec2( ${(SHARK_HINGE_X * SEA_M).toFixed(2)}, ${(SHARK_HINGE_Y * SEA_M).toFixed(2)} ) + vec2( q.x * c - q.y * sn, q.x * sn + q.y * c );
              n.xy = vec2( n.x * c - n.y * sn, n.x * sn + n.y * c );
            } else if ( aSea.y < 1.5 || aSea.y > 2.5 ) {
              float w = smoothstep( ${(1.7 * SEA_M).toFixed(2)}, ${(2.2 * SEA_M).toFixed(2)}, p.x );
              float ang = mouth * 0.22 * w;
              vec2 q = p.xy - vec2( ${(1.6 * SEA_M).toFixed(2)}, ${(0.1 * SEA_M).toFixed(2)} );
              float c = cos( ang ), sn = sin( ang );
              p.xy = vec2( ${(1.6 * SEA_M).toFixed(2)}, ${(0.1 * SEA_M).toFixed(2)} ) + vec2( q.x * c - q.y * sn, q.x * sn + q.y * c );
            }
            float ph = iAnim.x - s * 3.4;
            float amp = iAnim.y;
            float env = 0.06 + s * s * 1.1;
            float dz = amp * env * sin( ph );
            float slope = -( amp * ( 2.2 * s * sin( ph ) - 3.4 * env * cos( ph ) ) ) / ${(5.0 * SEA_M).toFixed(2)};
            p.z += dz;
            float ca = cos( atan( slope ) ), sa = sin( atan( slope ) );
            n = vec3( n.x * ca - n.z * sa, n.y, n.x * sa + n.z * ca );
          #else
            // Gull: wings fold back along the body (perched) or beat about the
            // shoulder with the hand lagging; legs only when perched.
            float flap = iAnim.x, fold = iAnim.y;
            if ( aSea.y > 1.5 && aSea.y < 2.5 ) {
              float side = p.z >= 0.0 ? 1.0 : -1.0;
              float r = max( abs( p.z ) - ${GULL_SHOULDER.toFixed(3)}, 0.0 );
              p.x -= fold * r * 0.62;
              p.y += fold * 0.25;
              r *= mix( 1.0, 0.14, fold );
              float hand = clamp( ( r - ${GULL_ELBOW.toFixed(3)} ) / ${(GULL_REACH - GULL_ELBOW).toFixed(3)}, 0.0, 1.0 );
              float ang = flap * ( 1.0 - fold ) * ( 1.0 + hand * 0.45 );
              float y0 = ${(0.04 * SEA_M).toFixed(3)};
              float c = cos( ang ), sn = sin( ang );
              float y = p.y - y0;
              float rr = r * c - y * sn;
              float yy = r * sn + y * c;
              p.z = side * ( ${GULL_SHOULDER.toFixed(3)} + rr );
              p.y = y0 + yy;
              float nz = n.z * side;
              n = vec3( n.x, nz * sn + n.y * c, side * ( nz * c - n.y * sn ) );
            } else if ( aSea.y > 3.5 ) {
              p.y = mix( ${(-0.04 * SEA_M).toFixed(3)}, p.y, fold );
              p.x = mix( ${(-0.02 * SEA_M).toFixed(3)}, p.x, fold );
            }
          #endif
        }`;
      function seaMaterial(kind, options) {
        const material = new Three.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...options });
        material.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\n#define SEA_KIND ' + kind + '\n' + SEA_DEFORM)
            .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3( normal );\n{ vec3 seaP = position; seaDeform( seaP, objectNormal ); }')
            .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position );\n{ vec3 seaN = vec3( 0.0, 1.0, 0.0 ); seaDeform( transformed, seaN ); }');
        };
        material.customProgramCacheKey = () => 'sealife-' + kind;
        return material;
      }
      function seaDepthMaterial(kind) {
        const material = new Three.MeshDepthMaterial({ depthPacking: Three.RGBADepthPacking });
        material.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\n#define SEA_KIND ' + kind + '\n' + SEA_DEFORM)
            .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position );\n{ vec3 seaN = vec3( 0.0, 1.0, 0.0 ); seaDeform( transformed, seaN ); }');
        };
        material.customProgramCacheKey = () => 'sealife-depth-' + kind;
        return material;
      }
      /* ---- Instanced species ---------------------------------------------------------------- */
      const SEA_KINDS = {
        dolphin: { kind: 0, capacity: 16, build: buildDolphinGeometry, options: { roughness: 0.32, metalness: 0.02 }, shadow: false },
        shark: { kind: 1, capacity: 1, build: buildSharkGeometry, options: { roughness: 0.46, metalness: 0.0 }, shadow: false },
        gull: { kind: 2, capacity: GULL_POOL, build: buildGullGeometry, options: { roughness: 0.82, side: Three.DoubleSide }, shadow: true },
      };
      const seaSpecies = {};
      const seaLifeGroup = new Three.Group();
      seaLifeGroup.name = 'sea life';
      seaLifeGroup.userData.dynamic = true;
      scene.add(seaLifeGroup);
      for (const [name, spec] of Object.entries(SEA_KINDS)) {
        const geometry = spec.build(),
          anim = new Three.InstancedBufferAttribute(new Float32Array(spec.capacity * 4), 4).setUsage(Three.DynamicDrawUsage);
        geometry.setAttribute('iAnim', anim);
        const mesh = new Three.InstancedMesh(geometry, seaMaterial(spec.kind, spec.options), spec.capacity);
        mesh.instanceMatrix.setUsage(Three.DynamicDrawUsage);
        mesh.name = 'sealife-' + name;
        mesh.frustumCulled = false;
        mesh.castShadow = spec.shadow;
        mesh.receiveShadow = name !== 'gull';
        mesh.count = 0;
        if (spec.shadow) mesh.customDepthMaterial = seaDepthMaterial(spec.kind);
        mesh.userData.dynamic = true;
        seaLifeGroup.add(mesh);
        seaSpecies[name] = { mesh, anim, geometry, spec, drawn: 0 };
      }
      const seaMatrix = new Three.Matrix4(),
        seaQuaternion = new Three.Quaternion(),
        seaEuler = new Three.Euler(0, 0, 0, 'YZX'),
        seaPosition = new Three.Vector3(),
        seaScale = new Three.Vector3();
      function seaPlace(species, i, x, z, y, a, pitch, roll, scale, a0, a1, a2 = 0, a3 = 0) {
        seaEuler.set(roll, -a, pitch, 'YZX');
        seaQuaternion.setFromEuler(seaEuler);
        seaPosition.set(x, z, y);
        seaScale.set(scale, scale, scale);
        seaMatrix.compose(seaPosition, seaQuaternion, seaScale);
        species.mesh.setMatrixAt(i, seaMatrix);
        const o = i * 4,
          arr = species.anim.array;
        arr[o] = a0;
        arr[o + 1] = a1;
        arr[o + 2] = a2;
        arr[o + 3] = a3;
      }
