      // BEGIN SUBSYSTEM: src/sealife3d.js — Sea life meshes
      /**
       * Sea life meshes
       * Source: src/sealife3d.js
       * Scope: createCityRenderer() closure (included after wakes3d.js: it draws
       * foam rings into the wake map and uses its spray light).
       *
       * MODELS: three procedural models built once at real size (a 2.6 m
       * bottlenose dolphin, a 5 m great white, a herring gull with a 1.4 m span),
       * lofted from cross sections with fins triangulated from outlines, painted
       * in vertex colours (the dolphin's dark cape, grey flanks and pale belly;
       * the shark's slate back sharply over a white belly, five gill slits and a
       * black eye; the gull's white body, grey mantle and black wingtips with
       * white mirrors). Each species is ONE InstancedMesh; the animation is done
       * in the vertex shader from a per-instance vec4 (`iAnim`), so the CPU only
       * writes a matrix and four numbers per animal:
       *   dolphin  dorso-ventral body wave (the flukes beat up and down)
       *   shark    lateral tail sweep; the jaw drops and the snout lifts as the
       *            mouth opens on the mouth cavity and two rows of teeth
       *   gull     wingbeat about the shoulder with the hand lagging, folding
       *            back along the body when perched; legs only when perched
       * Gulls cast shadows (a depth material with the same deformation).
       *
       * UNDER THE SURFACE: the sea is opaque, so what swims under it is drawn
       * into a small LIFE MAP round the view (the same meshes, top down, with a
       * shader that writes how dark each point of the body makes the water:
       * strong just under the surface, fading with depth) that the water shader
       * (world3d.js) darkens its body colour with. Blood clouds go into the same
       * map's green channel and tint the water red.
       *
       * SURFACING: splashes, blows and the breach throw lit water particles (one
       * Points object, white spray, mist, red spray), foam rings and splash foam
       * are drawn into the wake map (wakes3d.js), and a fin or a dolphin at the
       * surface leaves a wake through `wakeEmit`.
       *
       * HUD: `drawSealifeOverlay3D` draws the SHARK! warning and the arrow to the
       * fin over the view.
       */
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
            for (const st of stations) {
              if (!st.w) {
                const tip = b.v(st.x, st.yc || 0, 0, paint(st.x, 0, 0, 1), part(st.x, 0, 0, 1));
                if (prev) for (let k = 0; k < segments; k++) idx.push(tip, prev[k], prev[(k + 1) % segments]);
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
              if (prev && prev.tip !== undefined) for (let k = 0; k < segments; k++) idx.push(prev.tip, ring[(k + 1) % segments], ring[k]);
              else if (prev)
                for (let k = 0; k < segments; k++) {
                  const a = prev[k],
                    bb = prev[(k + 1) % segments],
                    c = ring[k],
                    d = ring[(k + 1) % segments];
                  idx.push(a, bb, c, bb, d, c);
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
          b.fin([0.62, -0.13, 0.18 * side], norm3(-0.55, -0.45, 0.7 * side), [1, 0, 0], [[0, 0.1], [0, -0.1], [0.22, -0.12], [0.34, -0.1], [0.31, -0.04], [0.15, 0.06]], 0.035, (u, v, top) => (top === side > 0 ? flank : cape));
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
          b.fin([1.05, -0.28, 0.44 * side], norm3(-0.32, -0.42, 0.85 * side), [1, 0, 0], [[0, 0.3], [0, -0.25], [0.5, -0.25], [1.05, -0.2], [0.98, -0.05], [0.55, 0.13]], 0.06, (u, v, top) => (top === side > 0 ? belly : back));
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
            (u, v, top) => {
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
      /* ---- Under the surface: the life map --------------------------------------------------- */
      const LIFE_MAP_SIZE = 512;
      const lifeTarget = new Three.WebGLRenderTarget(LIFE_MAP_SIZE, LIFE_MAP_SIZE, {
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        minFilter: Three.LinearFilter,
        magFilter: Three.LinearFilter,
      });
      const lifeScene = new Three.Scene(),
        lifeCamera = new Three.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        lifeFrame = { value: new Three.Vector3(0, 0, 2048) },
        lifeClock = { value: 0 };
      waterUniforms.uLife.value = lifeTarget.texture;
      const lifeBlend = {
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: Three.CustomBlending,
        blendEquation: Three.MaxEquation,
        blendSrc: Three.OneFactor,
        blendDst: Three.OneFactor,
      };
      // Silhouettes: the same instanced meshes seen from above, dark by depth.
      for (const name of ['dolphin', 'shark']) {
        const sp = seaSpecies[name];
        const material = new Three.ShaderMaterial({
          uniforms: { uLifeFrame: lifeFrame },
          defines: { SEA_KIND: sp.spec.kind },
          vertexShader: `
            ${SEA_DEFORM}
            uniform vec3 uLifeFrame;
            varying float vDepth;
            void main() {
              vec3 p = position;
              vec3 n = normal;
              seaDeform( p, n );
              vec4 world = modelMatrix * instanceMatrix * vec4( p, 1.0 );
              vDepth = ${SEA_SURFACE.toFixed(2)} - world.y;
              gl_Position = vec4( ( world.xz - uLifeFrame.xy ) / uLifeFrame.z * 2.0 - 1.0, 0.0, 1.0 );
            }`,
          fragmentShader: `
            varying float vDepth;
            void main() {
              if ( vDepth < 0.2 ) discard;
              // Darkest just under the surface, fading out by about 9 m down.
              float k = smoothstep( 0.2, 3.0, vDepth ) * ( 1.0 - smoothstep( 6.0, 72.0, vDepth ) );
              gl_FragColor = vec4( k * 0.78, 0.0, 0.0, 0.0 );
            }`,
          ...lifeBlend,
        });
        const ghost = new Three.InstancedMesh(sp.geometry, material, sp.spec.capacity);
        ghost.instanceMatrix = sp.mesh.instanceMatrix;
        ghost.frustumCulled = false;
        ghost.count = 0;
        lifeScene.add(ghost);
        sp.ghost = ghost;
      }
      // Blood clouds (green channel): soft, torn, spreading and fading.
      const BLOOD_CAPACITY = 6,
        bloodData = new Float32Array(BLOOD_CAPACITY * 4),
        bloodGeometry = new Three.InstancedBufferGeometry(),
        seaQuad = new Three.PlaneGeometry(2, 2);
      bloodGeometry.setIndex(seaQuad.index);
      bloodGeometry.setAttribute('position', seaQuad.getAttribute('position'));
      const bloodAttr = new Three.InstancedBufferAttribute(bloodData, 4).setUsage(Three.DynamicDrawUsage);
      bloodGeometry.setAttribute('iBlood', bloodAttr);
      bloodGeometry.instanceCount = 0;
      const bloodMesh = new Three.Mesh(
        bloodGeometry,
        new Three.ShaderMaterial({
          uniforms: { uLifeFrame: lifeFrame, uClock: lifeClock },
          vertexShader: `
            attribute vec4 iBlood;   // x, z, time, size
            uniform vec3 uLifeFrame;
            uniform float uClock;
            varying vec2 vLocal;
            varying float vAge, vSize;
            void main() {
              float age = max( uClock - iBlood.z, 0.0 );
              float radius = iBlood.w * ( 10.0 + 34.0 * sqrt( age ) ) + 6.0;
              vec2 world = iBlood.xy + position.xy * radius;
              vLocal = position.xy;
              vAge = age;
              vSize = iBlood.w;
              gl_Position = vec4( ( world - uLifeFrame.xy ) / uLifeFrame.z * 2.0 - 1.0, 0.0, 1.0 );
            }`,
          fragmentShader: `
            ${WAKE_NOISE}
            varying vec2 vLocal;
            varying float vAge, vSize;
            void main() {
              float r = length( vLocal );
              float torn = wakeNoise( vLocal * 3.0 + vAge * 0.15 ) * 0.6 + wakeNoise( vLocal * 7.0 - vAge * 0.2 ) * 0.4;
              float body = 1.0 - smoothstep( 0.35 + 0.45 * torn, 1.0, r );
              float k = body * ( 0.35 + 0.65 * torn ) * min( 1.0, vAge * 3.0 ) * exp( -vAge / 22.0 ) * clamp( vSize, 0.0, 1.0 );
              gl_FragColor = vec4( 0.0, k, 0.0, 0.0 );
            }`,
          ...lifeBlend,
        }),
      );
      bloodMesh.frustumCulled = false;
      lifeScene.add(bloodMesh);
      const bloodClouds = [];
      /* ---- Foam rings and splash foam in the wake map ---------------------------------------- */
      const RING_CAPACITY = 24,
        ringData = new Float32Array(RING_CAPACITY * 4),
        ringGeometry = new Three.InstancedBufferGeometry();
      ringGeometry.setIndex(seaQuad.index);
      ringGeometry.setAttribute('position', seaQuad.getAttribute('position'));
      const ringAttr = new Three.InstancedBufferAttribute(ringData, 4).setUsage(Three.DynamicDrawUsage);
      ringGeometry.setAttribute('iRing', ringAttr);
      ringGeometry.instanceCount = 0;
      const ringMesh = new Three.Mesh(
        ringGeometry,
        new Three.ShaderMaterial({
          uniforms: { uWakeFrame: wakeFrame, uClock: wakeClock },
          vertexShader: `
            ${WAKE_PLACE}
            attribute vec4 iRing;   // x, z, wake-clock time, size
            uniform float uClock;
            varying vec2 vWorld;
            varying float vAge, vRadius, vSize;
            void main() {
              float age = max( uClock - iRing.z, 0.0 );
              vRadius = iRing.w * ( 5.0 + 20.0 * sqrt( age ) );
              vec2 world = iRing.xy + position.xy * ( vRadius + 14.0 * iRing.w + 6.0 );
              vWorld = world - iRing.xy;
              vAge = age;
              vSize = iRing.w;
              gl_Position = wakeClip( world );
            }`,
          fragmentShader: `
            ${WAKE_NOISE}
            varying vec2 vWorld;
            varying float vAge, vRadius, vSize;
            void main() {
              float d = length( vWorld );
              float grain = wakeNoise( vWorld * 0.35 + vAge ) * 0.6 + wakeNoise( vWorld * 0.9 - vAge * 1.3 ) * 0.4;
              float fade = exp( -vAge / ( 2.0 + vSize * 2.0 ) );
              // The ring of foam thrown out, broken up as it spreads.
              float ringWidth = 2.0 + vSize * 2.5 + vAge * 1.5;
              float ring = exp( -pow( ( d - vRadius ) / ringWidth, 2.0 ) ) * smoothstep( 0.25, 0.7, grain + 0.25 * fade );
              // White water where it went in, lacing out.
              float patch = exp( -pow( d / ( 4.0 + vSize * 9.0 + vAge * 3.0 ), 2.0 ) ) * smoothstep( 0.2 + 0.5 * ( 1.0 - fade ), 0.8, grain + 0.4 * fade );
              float foam = ( ring * 0.9 + patch * 1.2 ) * fade;
              // Ripples running out: crest and trough.
              float wave = cos( ( d - vRadius ) * 0.55 ) * exp( -pow( ( d - vRadius * 0.85 ) / ( 6.0 + vSize * 8.0 ), 2.0 ) ) * fade;
              gl_FragColor = vec4( foam, max( wave, 0.0 ) * 0.9, max( -wave, 0.0 ) * 0.9, 0.0 );
            }`,
          ...wakeBlend,
        }),
      );
      ringMesh.frustumCulled = false;
      wakeScene.add(ringMesh);
      const foamRings = [];
      function sealifeWakeLive() {
        return foamRings.length;
      }
      /* ---- Splash particles --------------------------------------------------------------------- */
      const SEA_SPRAY_CAPACITY = 900,
        seaSprayPos = new Float32Array(SEA_SPRAY_CAPACITY * 3),
        seaSprayColor = new Float32Array(SEA_SPRAY_CAPACITY * 3),
        seaSpraySize = new Float32Array(SEA_SPRAY_CAPACITY),
        seaSprayAlpha = new Float32Array(SEA_SPRAY_CAPACITY),
        seaSpray = [];
      const seaSprayGeometry = new Three.BufferGeometry();
      seaSprayGeometry.setAttribute('position', new Three.BufferAttribute(seaSprayPos, 3).setUsage(Three.DynamicDrawUsage));
      seaSprayGeometry.setAttribute('aColor', new Three.BufferAttribute(seaSprayColor, 3).setUsage(Three.DynamicDrawUsage));
      seaSprayGeometry.setAttribute('aSize', new Three.BufferAttribute(seaSpraySize, 1).setUsage(Three.DynamicDrawUsage));
      seaSprayGeometry.setAttribute('aAlpha', new Three.BufferAttribute(seaSprayAlpha, 1).setUsage(Three.DynamicDrawUsage));
      const seaSprayUniforms = { uLight: { value: new Three.Color(1, 1, 1) }, uPixels: { value: 1 }, uPerspective: { value: 0 } };
      const seaSprayPoints = new Three.Points(
        seaSprayGeometry,
        new Three.ShaderMaterial({
          uniforms: seaSprayUniforms,
          transparent: true,
          depthWrite: false,
          vertexShader: `
            attribute vec3 aColor;
            attribute float aSize;
            attribute float aAlpha;
            uniform float uPixels, uPerspective;
            varying float vAlpha;
            varying vec3 vColor;
            void main() {
              vec4 mv = modelViewMatrix * vec4( position, 1.0 );
              gl_Position = projectionMatrix * mv;
              gl_PointSize = max( 1.0, aSize * ( uPerspective > 0.5 ? uPixels / max( -mv.z, 1.0 ) : uPixels ) );
              vAlpha = aAlpha;
              vColor = aColor;
            }`,
          fragmentShader: `
            uniform vec3 uLight;
            varying float vAlpha;
            varying vec3 vColor;
            void main() {
              vec2 c = gl_PointCoord * 2.0 - 1.0;
              float r = dot( c, c );
              if ( r > 1.0 ) discard;
              float a = ( 1.0 - r ) * ( 1.0 - r * 0.4 ) * vAlpha;
              gl_FragColor = vec4( vColor * uLight * ( 0.85 + 0.3 * ( 1.0 - gl_PointCoord.y ) ), a );
            }`,
        }),
      );
      seaSprayPoints.frustumCulled = false;
      seaSprayPoints.renderOrder = 9;
      seaSprayPoints.userData.dynamic = true;
      seaSprayGeometry.setDrawRange(0, 0);
      scene.add(seaSprayPoints);
      function seaThrow(x, y, z, vx, vy, vz, size, life, r, g, b, alpha = 0.55, drag = 1.4) {
        if (seaSpray.length >= SEA_SPRAY_CAPACITY) return;
        seaSpray.push({ x, y, z, vx, vy, vz, size, life: 0, max: life, r, g, b, alpha, drag });
      }
      /* A burst of water from (x, y): `size` 1 is a dolphin going in, 2+ the breach. */
      function seaSplash(x, y, size, a = 0, options = {}) {
        const n = Math.round(26 * size * size + 14),
          up = 26 + 22 * size,
          ring = 12 + 18 * size;
        for (let i = 0; i < n; i++) {
          const t = Math.random() * TAU,
            out = ring * (0.3 + Math.random() * 0.9),
            // A crown of droplets thrown up and out.
            vz = up * (0.5 + Math.random() * 0.9);
          seaThrow(x + Math.cos(t) * size * 3, y + Math.sin(t) * size * 3, SEA_SURFACE + 0.5, Math.cos(t) * out, Math.sin(t) * out, vz, (1.6 + Math.random() * 2.4) * (0.7 + size * 0.35), 0.7 + Math.random() * 0.6 + size * 0.2, 1, 1, 1, 0.6);
        }
        // A column of heavier water where it went in (the breach throws a wall).
        const col = Math.round(10 * size + 4);
        for (let i = 0; i < col; i++)
          seaThrow(x + (Math.random() - 0.5) * size * 5, y + (Math.random() - 0.5) * size * 5, SEA_SURFACE + Math.random() * 3, (Math.random() - 0.5) * 18 * size + Math.cos(a) * 10, (Math.random() - 0.5) * 18 * size + Math.sin(a) * 10, up * (1 + Math.random() * 0.8) * (options.fall ? 0.8 : 1.15), (4 + Math.random() * 5) * size * 0.9, 0.9 + Math.random() * 0.5 + size * 0.25, 1, 1, 1, 0.5, 0.9);
        // Mist hanging after.
        const mist = Math.round(6 * size);
        for (let i = 0; i < mist; i++)
          seaThrow(x + (Math.random() - 0.5) * 16 * size, y + (Math.random() - 0.5) * 16 * size, SEA_SURFACE + 2 + Math.random() * 6 * size, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 4 + Math.random() * 6, (8 + Math.random() * 8) * size, 1.6 + Math.random() * 1.2, 0.95, 0.97, 1, 0.16, 2.5);
      }
      function seaBlow(x, y, size) {
        // A dolphin's blow: a short upward puff that drifts and thins.
        for (let i = 0; i < 16; i++)
          seaThrow(x + (Math.random() - 0.5) * 1.2, y + (Math.random() - 0.5) * 1.2, SEA_SURFACE + 2.5, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (14 + Math.random() * 12) * size, (1.4 + Math.random() * 1.8) * size, 0.6 + Math.random() * 0.5, 0.96, 0.98, 1, 0.42, 3.2);
      }
      function seaBloodSpray(x, y, size) {
        for (let i = 0; i < 40 * size; i++) {
          const t = Math.random() * TAU,
            out = 10 + Math.random() * 26;
          seaThrow(x, y, SEA_SURFACE + 6 + Math.random() * 8, Math.cos(t) * out, Math.sin(t) * out, 12 + Math.random() * 34, 1.4 + Math.random() * 2.4, 0.7 + Math.random() * 0.6, 0.62, 0.05, 0.05, 0.75);
        }
      }
      function updateSeaSpray(deltaSeconds) {
        let n = 0;
        for (let i = seaSpray.length - 1; i >= 0; i--) {
          const p = seaSpray[i];
          p.life += deltaSeconds;
          p.vz -= GRAVITY * 1.15 * deltaSeconds;
          const drag = Math.exp(-deltaSeconds * p.drag);
          p.vx *= drag;
          p.vy *= drag;
          if (p.drag > 2) p.vz *= drag;
          p.x += p.vx * deltaSeconds;
          p.y += p.vy * deltaSeconds;
          p.z += p.vz * deltaSeconds;
          if (p.life >= p.max || p.z < SEA_SURFACE - 3) {
            seaSpray[i] = seaSpray[seaSpray.length - 1];
            seaSpray.pop();
          }
        }
        for (const p of seaSpray) {
          const t = p.life / p.max;
          seaSprayPos[n * 3] = p.x;
          seaSprayPos[n * 3 + 1] = p.z;
          seaSprayPos[n * 3 + 2] = p.y;
          seaSprayColor[n * 3] = p.r;
          seaSprayColor[n * 3 + 1] = p.g;
          seaSprayColor[n * 3 + 2] = p.b;
          seaSpraySize[n] = p.size * (0.7 + t * 1.2);
          seaSprayAlpha[n] = p.alpha * (1 - t) * Math.min(1, t * 10);
          n++;
        }
        seaSprayGeometry.setDrawRange(0, n);
        if (n) for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) seaSprayGeometry.attributes[name].needsUpdate = true;
        seaSprayPoints.visible = n > 0;
      }
      /* ---- Events from the game ------------------------------------------------------------------ */
      let seaEventSeen = 0;
      function seaAddRing(x, y, size) {
        if (foamRings.length >= RING_CAPACITY) foamRings.shift();
        foamRings.push({ x, y, t: wakeClock.value, size });
      }
      function seaHandleEvents() {
        for (const e of seaEvents) {
          if (e.id <= seaEventSeen) continue;
          seaEventSeen = e.id;
          if (Math.abs(e.x - viewCenter.x) > viewReach * 2 + 400 || Math.abs(e.y - viewCenter.y) > viewReach * 2 + 400) continue;
          if (e.kind === 'splash') {
            seaSplash(e.x, e.y, e.size, e.a || 0);
            seaAddRing(e.x, e.y, e.size * (e.ring ? 1.1 : 0.7));
          } else if (e.kind === 'breach') {
            seaSplash(e.x, e.y, e.size, e.a || 0, { fall: !!e.fall });
            seaAddRing(e.x, e.y, e.size * 1.2);
            seaAddRing(e.x, e.y, e.size * 0.6);
          } else if (e.kind === 'ripple') seaAddRing(e.x, e.y, e.size * 0.5);
          else if (e.kind === 'blow') seaBlow(e.x, e.y, e.size);
          else if (e.kind === 'blood') {
            if (bloodClouds.length >= BLOOD_CAPACITY) bloodClouds.shift();
            bloodClouds.push({ x: e.x, y: e.y, t: lifeClock.value, size: e.size });
            seaBloodSpray(e.x, e.y, Math.min(1.5, e.size));
          }
        }
      }
      /* ---- Per frame -------------------------------------------------------------------------------- */
      const seaLifeStats = { gulls: 0, dolphins: 0, shark: 0, spray: 0, rings: 0, blood: 0, lifeMap: false, drawCalls: 0, cpuMs: 0, cpuMsAverage: 0 };
      const sharkFinKey = { id: 'shark fin' };
      const seaLifeBuffer = new Three.Vector2();
      function seaNear(x, y, margin) {
        return Math.abs(x - viewCenter.x) < viewReach + margin && Math.abs(y - viewCenter.y) < viewReach + margin;
      }
      function updateSeaLifeVisuals(deltaSeconds) {
        const started = performance.now();
        lifeClock.value += deltaSeconds;
        seaHandleEvents();
        // Dolphins.
        const dol = seaSpecies.dolphin;
        let n = 0;
        for (const pod of dolphinPods) {
          if (!seaNear(pod.x, pod.y, 300)) continue;
          for (const m of pod.members) {
            if (n >= dol.spec.capacity) break;
            const flukes = m.mode === 'leap' ? 0.25 : m.mode === 'rise' ? 1.5 : 0.9 + clamp(m.speed / 60, 0, 1) * 0.6;
            seaPlace(dol, n, m.x, m.z, m.y, m.a, m.pitch, m.roll, m.scale, m.phase, flukes);
            n++;
            // At the surface: a wake off the back.
            if (Math.abs(m.z - SEA_SURFACE) < 3.5 && m.mode !== 'leap') wakeEmit(m, m.x, m.y, m.a, m.speed, 18 * m.scale, 4 * m.scale, 90, false);
          }
        }
        dol.mesh.count = dol.ghost.count = n;
        dol.drawn = n;
        if (n) {
          dol.mesh.instanceMatrix.needsUpdate = true;
          dol.anim.needsUpdate = true;
        }
        // The shark.
        const sh = seaSpecies.shark;
        const sharkShown = shark.active && seaNear(shark.x, shark.y, 300);
        if (sharkShown) {
          seaPlace(sh, 0, shark.x, shark.z, shark.y, shark.a, shark.pitch, shark.roll, 1, shark.phase, 0.9 + shark.speed / 60, shark.mouth);
          sh.mesh.instanceMatrix.needsUpdate = true;
          sh.anim.needsUpdate = true;
          // The fin cutting the surface leaves its own narrow wake.
          const finX = shark.x + Math.cos(shark.a) * 3,
            finY = shark.y + Math.sin(shark.a) * 3,
            finTop = shark.z + 0.5 * SEA_M + 0.95 * SEA_M;
          if (finTop > SEA_SURFACE + 1 && shark.z < SEA_SURFACE && shark.finUp > 0.3) wakeEmit(sharkFinKey, finX, finY, shark.a, shark.speed, 9, 2.2, 55, false);
        }
        sh.mesh.count = sh.ghost.count = sharkShown ? 1 : 0;
        sh.drawn = sharkShown ? 1 : 0;
        // Gulls.
        const gu = seaSpecies.gull;
        let k = 0;
        for (const g of gulls) {
          if (g.mode === 'off' || !seaNear(g.x, g.y, 120)) continue;
          // A perched gull bobs its head now and then; a flier banks into its turns.
          seaPlace(gu, k, g.x, g.z, g.y, g.a, g.mode === 'perch' ? 0.12 : g.pitch * 0.6, g.mode === 'perch' ? 0 : -g.bank, 1, g.flap, g.fold);
          k++;
        }
        gu.mesh.count = k;
        gu.drawn = k;
        if (k) {
          gu.mesh.instanceMatrix.needsUpdate = true;
          gu.anim.needsUpdate = true;
        }
        // Rings into the wake map.
        const now = wakeClock.value;
        while (foamRings.length && now - foamRings[0].t > 9) foamRings.shift();
        for (let i = 0; i < foamRings.length; i++) {
          const r = foamRings[i];
          ringData[i * 4] = r.x;
          ringData[i * 4 + 1] = r.y;
          ringData[i * 4 + 2] = r.t;
          ringData[i * 4 + 3] = r.size;
        }
        ringGeometry.instanceCount = foamRings.length;
        ringMesh.visible = foamRings.length > 0;
        if (foamRings.length) ringAttr.needsUpdate = true;
        // Blood.
        while (bloodClouds.length && lifeClock.value - bloodClouds[0].t > 45) bloodClouds.shift();
        for (let i = 0; i < bloodClouds.length; i++) {
          const c = bloodClouds[i];
          bloodData[i * 4] = c.x;
          bloodData[i * 4 + 1] = c.y;
          bloodData[i * 4 + 2] = c.t;
          bloodData[i * 4 + 3] = c.size;
        }
        bloodGeometry.instanceCount = bloodClouds.length;
        bloodMesh.visible = bloodClouds.length > 0;
        if (bloodClouds.length) bloodAttr.needsUpdate = true;
        // Spray, lit like the wakes' spray.
        seaSprayUniforms.uLight.value
          .copy(sun.color)
          .multiplyScalar(sun.intensity * 0.3)
          .add(seaLifeTmpColor.copy(hemi.color).multiplyScalar(hemi.intensity * 0.38))
          .multiplyScalar(0.3 + 0.7 * daylight());
        sceneBufferSize(seaLifeBuffer);
        seaSprayUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
        seaSprayUniforms.uPixels.value = camera.isPerspectiveCamera ? (seaLifeBuffer.y / 2) * camera.projectionMatrix.elements[5] : seaLifeBuffer.y / (camera.top - camera.bottom);
        updateSeaSpray(deltaSeconds);
        // The life map, only when something is under the water in view.
        const lifeOn = n > 0 || sharkShown || bloodClouds.length > 0;
        waterUniforms.uLifeOn.value = lifeOn ? 1 : 0;
        if (lifeOn) {
          const span = clamp(viewReach * 2.2, 2048, 6144),
            texel = span / LIFE_MAP_SIZE,
            ox = Math.round((viewCenter.x - span / 2) / texel) * texel,
            oz = Math.round((viewCenter.y - span / 2) / texel) * texel;
          lifeFrame.value.set(ox, oz, span);
          waterUniforms.uLifeRect.value.set(ox, oz, 1 / span, 1 / LIFE_MAP_SIZE);
          const clearAlpha = renderer.getClearAlpha();
          renderer.getClearColor(seaLifeTmpColor);
          renderer.setRenderTarget(lifeTarget);
          renderer.setClearColor(0x000000, 0);
          renderer.clear(true, false, false);
          renderer.render(lifeScene, lifeCamera);
          renderer.setRenderTarget(null);
          renderer.setClearColor(seaLifeTmpColor, clearAlpha);
        }
        seaLifeStats.gulls = k;
        seaLifeStats.dolphins = n;
        seaLifeStats.shark = sharkShown ? 1 : 0;
        seaLifeStats.spray = seaSpray.length;
        seaLifeStats.rings = foamRings.length;
        seaLifeStats.blood = bloodClouds.length;
        seaLifeStats.lifeMap = lifeOn;
        // Camera pass: one per species shown and the spray; shadow pass: gulls;
        // life map: dolphins, shark, blood; wake map: the rings.
        seaLifeStats.drawCalls = (k ? 2 : 0) + (n ? 1 : 0) + (sharkShown ? 1 : 0) + (seaSpray.length ? 1 : 0);
        seaLifeStats.offscreenCalls = (lifeOn ? (n ? 1 : 0) + (sharkShown ? 1 : 0) + (bloodClouds.length ? 1 : 0) : 0) + (foamRings.length ? 1 : 0);
        const ms = performance.now() - started;
        seaLifeStats.cpuMs = +ms.toFixed(3);
        seaLifeStats.cpuMsAverage = +(seaLifeStats.cpuMsAverage * 0.95 + ms * 0.05).toFixed(3);
      }
      const seaLifeTmpColor = new Three.Color();
      sealifeRenderStats = () => ({ ...seaLifeStats, triangles: { dolphin: seaSpecies.dolphin.geometry.index.count / 3, shark: seaSpecies.shark.geometry.index.count / 3, gull: seaSpecies.gull.geometry.index.count / 3 } });
      /* ---- HUD: the SHARK! warning ----------------------------------------------------------------- */
      function drawSealifeOverlay3D(api) {
        const w = sharkWarning();
        if (!w || gameMode !== 'play') return;
        const pulse = 0.65 + 0.35 * Math.sin(gameTime * (w.phase === 'dive' ? 16 : 7)),
          me = api.project(player.x, player.y, entityElevation(player) + 4),
          fin = api.project(w.x, w.y, SEA_SURFACE + 4),
          ctx = worldContext;
        ctx.save();
        // The banner.
        const cx = viewportWidth / 2,
          top = Math.max(96, viewportHeight * 0.14);
        ctx.textAlign = 'center';
        ctx.font = '900 34px Arial';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(20, 6, 6, 0.8)';
        ctx.fillStyle = 'rgba(255, ' + Math.round(70 + 40 * (1 - pulse)) + ', 60, ' + (0.75 + 0.25 * pulse) + ')';
        const title = w.phase === 'dive' ? 'SHARK! BELOW YOU' : 'SHARK!';
        ctx.strokeText(title, cx, top);
        ctx.fillText(title, cx, top);
        ctx.font = 'bold 12px monospace';
        ctx.lineWidth = 3;
        const sub = w.phase === 'dive' ? 'GET OUT OF THE WATER' : 'GET OUT OF THE WATER · ' + distanceLabel(w.d) + (w.exit ? ' · way out ' + distanceLabel(distanceBetween(player, w.exit)) : '');
        ctx.strokeText(sub, cx, top + 20);
        ctx.fillStyle = '#f6e3d6';
        ctx.fillText(sub, cx, top + 20);
        // The arrow round the swimmer, pointing at the fin.
        if (w.phase !== 'dive' && !me.behind) {
          const a = Math.atan2(fin.y - me.y, fin.x - me.x),
            r = 46 + 6 * pulse;
          ctx.save();
          ctx.translate(me.x + Math.cos(a) * r, me.y + Math.sin(a) * r);
          ctx.rotate(a);
          ctx.fillStyle = 'rgba(255, 72, 56, ' + (0.7 + 0.3 * pulse) + ')';
          ctx.strokeStyle = 'rgba(20, 6, 6, 0.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(-8, -10);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-8, 10);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
          ctx.restore();
          // Brackets round the fin when it is on screen.
          if (!fin.behind && fin.x > 20 && fin.x < viewportWidth - 20 && fin.y > 60 && fin.y < viewportHeight - 60) {
            const s = 16 + 4 * pulse;
            ctx.strokeStyle = 'rgba(255, 72, 56, ' + (0.55 + 0.35 * pulse) + ')';
            ctx.lineWidth = 2;
            for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              ctx.beginPath();
              ctx.moveTo(fin.x + dx * s, fin.y + dy * s * 0.55);
              ctx.lineTo(fin.x + dx * s, fin.y + dy * s);
              ctx.lineTo(fin.x + dx * s * 0.55, fin.y + dy * s);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }
      // END SUBSYSTEM: src/sealife3d.js
