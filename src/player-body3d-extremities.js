      // Player body hands and shoes: a right hand (palm, knuckles, four fingers and a thumb in a relaxed curl, with
      // the curled grip as a second shape) mirrored for the left, and derby shoes on a sole with a heel and toe spring.
      /**
       * HANDS (hand space, metres: the wrist joint at the origin, fingers down -y, the palm facing -z for the
       * right hand, the thumb forward +x). PB_FINGERS gives each finger's knuckle, splay, segment lengths and
       * radii; `pbFingerChain(f, grip)` its joints for the relaxed curl (0) or the grip (1). The mesh is the
       * relaxed hand; `pbGripShape` moves each vertex with the segment it belongs to (blended across the
       * joints) to give the gripping hand with the same vertices, which the shader blends to per hand.
       */
      const PB_FINGERS = [
        // [knuckle x, knuckle y, splay (rad), [proximal, middle, distal] lengths, base radius, tip radius]
        [0.0285, -0.094, 0.07, [0.038, 0.023, 0.018], 0.0098, 0.0076],
        [0.0095, -0.097, 0.015, [0.043, 0.027, 0.019], 0.0101, 0.0078],
        [-0.0095, -0.094, -0.04, [0.04, 0.025, 0.019], 0.0095, 0.0074],
        [-0.0265, -0.087, -0.11, [0.031, 0.018, 0.016], 0.0085, 0.0066],
      ];
      const PB_CURL = [
        [0.22, 0.32, 0.18],
        [1.2, 1.5, 0.78],
      ];
      // The thumb: base, then the directions of its three segments relaxed and gripping, lengths and radii.
      const PB_THUMB = {
        base: [0.021, -0.02, -0.011],
        lengths: [0.04, 0.031, 0.026],
        radii: [0.0122, 0.0101, 0.0089, 0.0074],
        relaxed: [
          [0.58, -0.72, -0.37],
          [0.5, -0.8, -0.33],
          [0.42, -0.86, -0.3],
        ],
        grip: [
          [0.42, -0.62, -0.66],
          [0.06, -0.55, -0.83],
          [-0.35, -0.42, -0.84],
        ],
      };
      const pbNorm3 = (v) => {
        const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        return [v[0] / l, v[1] / l, v[2] / l];
      };
      /* A finger's joints [knuckle, middle, end, tip] and segment directions for a curl state (0 relaxed, 1 grip). */
      function pbFingerChain(f, state) {
        const [kx, ky, splay, lengths] = PB_FINGERS[f],
          curl = PB_CURL[state],
          joints = [[kx, ky, -0.002]],
          dirs = [];
        let angle = 0;
        for (let j = 0; j < 3; j++) {
          angle += curl[j];
          // Splayed in the palm's plane, then curled towards the palm (about the knuckle line, x).
          // Curling turns -y towards -z.
          dirs.push(pbNorm3([Math.sin(splay), -Math.cos(splay) * Math.cos(angle), -Math.cos(splay) * Math.sin(angle)]));
          const p = joints[j];
          joints.push([p[0] + dirs[j][0] * lengths[j], p[1] + dirs[j][1] * lengths[j], p[2] + dirs[j][2] * lengths[j]]);
        }
        return { joints, dirs };
      }
      function pbThumbChain(state) {
        const t = PB_THUMB,
          dirs = (state ? t.grip : t.relaxed).map(pbNorm3),
          joints = [t.base];
        for (let j = 0; j < 3; j++) {
          const p = joints[j];
          joints.push([p[0] + dirs[j][0] * t.lengths[j], p[1] + dirs[j][1] * t.lengths[j], p[2] + dirs[j][2] * t.lengths[j]]);
        }
        return { joints, dirs };
      }
      function pbHandField() {
        const ops = [],
          add = (p, k) => ops.push(pbAdd(p, k));
        // Palm: the wrist, the palm's slab, the knuckle line, the heels of the thumb and the little finger.
        add(pbEllipsoid(0, -0.006, 0.001, 0.028, 0.024, 0.0185), 0);
        add(pbEllipsoid(0, -0.056, -0.0005, 0.042, 0.045, 0.0145), 0.014);
        add(pbRoundBox(0, -0.06, -0.0005, 0.036, 0.033, 0.0115, 0.0095), 0.012);
        add(pbLimb([0.031, -0.092, 0.0005], [-0.028, -0.085, 0.0005], 0.0118, 0.0108), 0.01);
        add(pbEllipsoid(0.024, -0.04, -0.0105, 0.017, 0.028, 0.013), 0.012);
        add(pbEllipsoid(-0.029, -0.052, -0.007, 0.012, 0.034, 0.0105), 0.01);
        // The back of the hand: knuckles proud.
        for (let f = 0; f < 4; f++) add(pbSphere(PB_FINGERS[f][0], PB_FINGERS[f][1] + 0.002, 0.0055, 0.0072), 0.006);
        // Fingers: three round cones each, a little flat across the nail side.
        for (let f = 0; f < 4; f++) {
          const { joints } = pbFingerChain(f, 0),
            r0 = PB_FINGERS[f][4],
            r1 = PB_FINGERS[f][5];
          for (let j = 0; j < 3; j++) {
            const ra = r0 + ((r1 - r0) * j) / 3,
              rb = r0 + ((r1 - r0) * (j + 1)) / 3;
            add(pbLimb(joints[j], joints[j + 1], ra * (j ? 1.02 : 1), rb * (j < 2 ? 1.04 : 0.98), { flat: 0.9, fwd: [1, 0, 0] }), j ? 0.0035 : 0.006);
          }
        }
        const thumb = pbThumbChain(0);
        for (let j = 0; j < 3; j++) add(pbLimb(thumb.joints[j], thumb.joints[j + 1], PB_THUMB.radii[j], PB_THUMB.radii[j + 1], { flat: 0.92 }), j ? 0.004 : 0.012);
        return { ops };
      }
      /* Which segment a hand vertex follows: { chain: 0-3 finger, 4 thumb, -1 palm; along: metres past the base }. */
      function pbHandSegments() {
        const chains = [];
        for (let f = 0; f < 4; f++) chains.push({ relaxed: pbFingerChain(f, 0), grip: pbFingerChain(f, 1), r: PB_FINGERS[f][4] });
        chains.push({ relaxed: pbThumbChain(0), grip: pbThumbChain(1), r: PB_THUMB.radii[0] });
        return chains;
      }
      /**
       * The gripping hand: every vertex near a finger or the thumb moves with its segment from the relaxed chain
       * to the gripping one (segment frames: origin at the joint, y back along the segment), blended over a few
       * millimetres across each joint so the knuckles bend rather than break.
       */
      function pbGripShape(position) {
        const chains = pbHandSegments(),
          count = position.length / 3,
          out = new Float32Array(position),
          tmp = [0, 0, 0];
        // Rotation taking direction a to direction b (Rodrigues), applied to v.
        const rotate = (a, b, v, o) => {
          const cx = a[1] * b[2] - a[2] * b[1],
            cy = a[2] * b[0] - a[0] * b[2],
            cz = a[0] * b[1] - a[1] * b[0],
            c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
            s = Math.sqrt(cx * cx + cy * cy + cz * cz);
          if (s < 1e-9) {
            o[0] = v[0];
            o[1] = v[1];
            o[2] = v[2];
            return o;
          }
          const kx = cx / s,
            ky = cy / s,
            kz = cz / s,
            dot = kx * v[0] + ky * v[1] + kz * v[2];
          o[0] = v[0] * c + (ky * v[2] - kz * v[1]) * s + kx * dot * (1 - c);
          o[1] = v[1] * c + (kz * v[0] - kx * v[2]) * s + ky * dot * (1 - c);
          o[2] = v[2] * c + (kx * v[1] - ky * v[0]) * s + kz * dot * (1 - c);
          return o;
        };
        // A point carried by segment j of a chain from relaxed to grip.
        const carry = (chain, j, p, o) => {
          const r = chain.relaxed,
            g = chain.grip,
            base = r.joints[j];
          // The segment's own rotation is the composition of the joints before it: take it from the direction
          // change of this segment, then about the segment's axis nothing (fingers do not twist).
          tmp[0] = p[0] - base[0];
          tmp[1] = p[1] - base[1];
          tmp[2] = p[2] - base[2];
          rotate(r.dirs[j], g.dirs[j], tmp, o);
          o[0] += g.joints[j][0];
          o[1] += g.joints[j][1];
          o[2] += g.joints[j][2];
          return o;
        };
        const a = [0, 0, 0],
          b = [0, 0, 0],
          p = [0, 0, 0];
        for (let v = 0; v < count; v++) {
          p[0] = position[v * 3];
          p[1] = position[v * 3 + 1];
          p[2] = position[v * 3 + 2];
          // Nearest chain by distance to its relaxed segments.
          let best = -1,
            bestD = 1e9,
            bestJ = 0,
            bestT = 0;
          for (let c = 0; c < chains.length; c++) {
            const J = chains[c].relaxed.joints;
            for (let j = 0; j < 3; j++) {
              const ax = J[j][0],
                ay = J[j][1],
                az = J[j][2],
                dx = J[j + 1][0] - ax,
                dy = J[j + 1][1] - ay,
                dz = J[j + 1][2] - az,
                l2 = dx * dx + dy * dy + dz * dz,
                t = Math.max(-0.4, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy + (p[2] - az) * dz) / l2)),
                qx = ax + dx * t - p[0],
                qy = ay + dy * t - p[1],
                qz = az + dz * t - p[2],
                d = Math.sqrt(qx * qx + qy * qy + qz * qz) - chains[c].r;
              if (d < bestD) {
                bestD = d;
                best = c;
                bestJ = j;
                bestT = t * Math.sqrt(l2);
              }
            }
          }
          if (best < 0 || bestD > 0.008) continue;
          const chain = chains[best],
            len = (j) => {
              const J = chain.relaxed.joints;
              return Math.hypot(J[j + 1][0] - J[j][0], J[j + 1][1] - J[j][1], J[j + 1][2] - J[j][2]);
            },
            blend = 0.0045;
          // Across the joint at the segment's base: blend with the segment before (the palm before the first).
          carry(chain, bestJ, p, a);
          let wPrev = 0;
          if (bestT < blend) wPrev = 0.5 * (1 - Math.max(-1, bestT / blend));
          if (bestJ < 2 && bestT > len(bestJ) - blend) {
            // Near the next joint: blend towards the next segment.
            const w = 0.5 * Math.min(1, (bestT - (len(bestJ) - blend)) / blend);
            carry(chain, bestJ + 1, p, b);
            a[0] += (b[0] - a[0]) * w;
            a[1] += (b[1] - a[1]) * w;
            a[2] += (b[2] - a[2]) * w;
          }
          if (wPrev > 0) {
            if (bestJ === 0) {
              b[0] = p[0];
              b[1] = p[1];
              b[2] = p[2];
            } else carry(chain, bestJ - 1, p, b);
            a[0] += (b[0] - a[0]) * wPrev;
            a[1] += (b[1] - a[1]) * wPrev;
            a[2] += (b[2] - a[2]) * wPrev;
          }
          // Far from the chain's surface, at the palm side of the knuckle: ease to the palm.
          const fade = bestJ === 0 ? Math.max(0, Math.min(1, (bestT + 0.006) / 0.008)) : 1;
          out[v * 3] = p[0] + (a[0] - p[0]) * fade;
          out[v * 3 + 1] = p[1] + (a[1] - p[1]) * fade;
          out[v * 3 + 2] = p[2] + (a[2] - p[2]) * fade;
        }
        return out;
      }
      /**
       * SHOES (foot space, metres: the ankle joint at the origin, the sole's tread at -0.0707, toes +x): dark
       * leather derbies for the right foot (the big toe inside, -z), mirrored for the left. A sole with a heel
       * block and a toe spring, the upper with a rounded toe box, a padded collar just under the ankle bones, and
       * the ankle in a sock going up under the jeans' hem.
       */
      const PB_SOLE = -0.0707;
      function pbShoeField() {
        const ops = [],
          add = (p, k) => ops.push(pbAdd(p, k));
        // The footprint: heel, waist, ball, toe (2D, x along, z across).
        const print = (x, z) => {
          let d = Math.hypot(x + 0.036, z) - 0.035;
          d = pbSmin(d, Math.hypot(x - 0.05, z + 0.002) - 0.037, 0.04);
          d = pbSmin(d, Math.hypot(x - 0.138, z + 0.003) - 0.048, 0.04);
          d = pbSmin(d, Math.hypot(x - 0.188, z + 0.008) - 0.035, 0.03);
          return d;
        };
        const lift = (x) => (x > 0.14 ? (x - 0.14) * (x - 0.14) * 1.9 : 0);
        // Sole: the outline extruded from the tread to the top of the heel block or the forefoot's welt.
        add({
          f: (x, y, z) => {
            const bottom = PB_SOLE + lift(x),
              heel = Math.max(0, Math.min(1, (0.035 - x) / 0.03)),
              top = -0.057 + 0.012 * heel * heel * (3 - 2 * heel) + lift(x),
              slab = Math.max(bottom - y, y - top);
            const d2 = print(x, z) - 0.0025;
            return Math.min(Math.max(d2, slab), 0) + Math.hypot(Math.max(d2, 0), Math.max(slab, 0)) - 0.002;
          },
          b: [0.07, -0.06, 0, 0.17],
        });
        // The upper: heel counter, the vamp rising to the laces, the toe box; cut along the collar.
        const upper = [
          pbEllipsoid(-0.026, -0.032, 0, 0.047, 0.042, 0.036),
          pbEllipsoid(0.06, -0.04, -0.002, 0.1, 0.036, 0.044),
          pbLimb([0.03, -0.022, -0.001], [0.15, -0.043, -0.005], 0.026, 0.024, { flat: 1.6 }),
          pbEllipsoid(0.165, -0.047, -0.007, 0.062, 0.024, 0.042),
          pbLimb([0.0, -0.035, 0], [0.03, -0.005, 0], 0.04, 0.036),
        ];
        ops.push(
          pbGroup(
            [
              ...upper.map((p, i) => pbAdd(p, i ? 0.035 : 0)),
              // The collar's line: higher round the heel, lower at the sides under the ankle bones.
              { op: 'cut', f: (x, y) => (x < 0.035 ? y - (-0.008 - 0.01 * Math.max(0, Math.min(1, (x + 0.05) / 0.085))) : -1), k: 0.004 },
              { op: 'cut', f: (x, y) => PB_SOLE + 0.01 + lift(x) - y, k: 0.002 },
            ],
            0.003,
          ),
        );
        // A padded collar round the opening, and the ankle in its sock up under the hem.
        add(pbLimb([-0.01, -0.03, 0], [0.004, 0.08, 0], 0.033, 0.035, { flat: 0.92 }), 0.006);
        return { ops };
      }
