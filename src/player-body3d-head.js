      // Player body head: a man in his forties modelled as one field (skull, brow, eyes in their sockets and lids,
      // nose, cheekbones, mouth, jaw, chin, ears) with short brown hair laid over the scalp as a thickness.
      /**
       * HEAD (bind space, metres; the head bone only moves, so this is also head space plus its origin)
       * Crown 1.80, eyes 1.683, mouth 1.605, chin 1.567: 23 cm crown to chin, 1/7.7 of his height. The face is
       * built front to back on the cranium: the brow ridge over deep-set eyes (eyeballs of 12 mm radius in the
       * sockets, upper and lower lids round them), a straight nose with a rounded tip and nostril wings, broad
       * cheekbones, a firm jaw with the corners under the ears, a squarish chin with a little fullness under it,
       * and the soft folds of the forties (nasolabial lines, a heavier upper lid). PB_EYES are the eyeballs'
       * centres for the paint. The hair (`pbHairDepth`) is a thickness added over the scalp inside the hairline
       * (`pbHairline`): ~13 mm on top, 5 mm at the sides and back, tapering to nothing at the line, a slightly
       * receded M at the temples, sideburns to mid-ear, tapered at the nape.
       */
      const PB_EYE_R = 0.0122,
        PB_EYES = [
          [0.0705, 1.683, -0.0315],
          [0.0705, 1.683, 0.0315],
        ],
        PB_HEAD_CENTRE = [-0.004, 1.703, 0];
      /* How far inside the hairline a scalp point is (metres, positive inside), and the hair's thickness there. */
      function pbHairline(x, y, z) {
        const dx = x - PB_HEAD_CENTRE[0],
          dz = z,
          az = Math.abs(Math.atan2(dz, dx)),
          // The line's height round the head: forehead, temples (receded), sideburns, over the ears, the nape.
          at = (a0, a1, y0, y1) => y0 + (y1 - y0) * Math.min(1, Math.max(0, (az - a0) / (a1 - a0)));
        let line;
        if (az < 0.42) line = 1.756 + 0.004 * Math.cos(az * 7.5);
        else if (az < 0.78) line = at(0.42, 0.78, 1.755, 1.744) + 0.01 * Math.sin(((az - 0.42) / 0.36) * Math.PI);
        else if (az < 1.2) line = at(0.78, 1.2, 1.744, 1.69);
        else if (az < 1.42) line = at(1.2, 1.42, 1.69, 1.662);
        else if (az < 1.6) line = at(1.42, 1.6, 1.662, 1.708);
        else if (az < 2.15) line = 1.708 + 0.004 * Math.sin(((az - 1.6) / 0.55) * Math.PI);
        else if (az < 2.5) line = at(2.15, 2.5, 1.708, 1.64);
        else line = at(2.5, Math.PI, 1.64, 1.612);
        // At the temples and the sideburns the line runs down the side: the front edge recedes there.
        let inside = y - line;
        if (az > 0.95 && az < 1.45) {
          // Sideburn: a strip in front of the ear, from the temple hair down; its front edge.
          const front = x - (-0.005 + 0.022 * Math.max(0, Math.min(1, (y - 1.66) / 0.06)));
          inside = Math.max(Math.min(inside, -front + 0.0), y - 1.705);
          if (y < 1.705) inside = Math.min(y - line, 0.012 - Math.abs(x - 0.0) * 0.6);
        }
        return inside;
      }
      function pbHairDepth(x, y, z) {
        const inside = pbHairline(x, y, z);
        if (inside < -0.004) return 0;
        const dx = x - PB_HEAD_CENTRE[0],
          up = Math.max(0, Math.min(1, (y - 1.735) / 0.05)),
          // Fuller on top and towards the front (short, textured, brushed back), close at the sides and nape.
          top = 0.0045 + 0.0085 * up * up * (0.85 + 0.35 * Math.max(0, Math.min(1, (dx + 0.03) / 0.12))),
          edge = Math.max(0, Math.min(1, (inside + 0.004) / 0.016));
        return top * edge * edge * (3 - 2 * edge) + 0.0006 * edge;
      }
      function pbHeadField() {
        const ops = [],
          add = (p, k) => ops.push(pbAdd(p, k)),
          sub = (p, k) => ops.push(pbSub(p, k)),
          mirror = (fn) => [-1, 1].map((s) => fn(s));
        const ry = (a) => [Math.cos(a), 0, -Math.sin(a), 0, 1, 0, Math.sin(a), 0, Math.cos(a)];
        const rz = (a) => [Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 1];
        const mul = (a, b) => [
          a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
          a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
          a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
        ];
        // Cranium: tipped back a little; the forehead's slope.
        add(pbEllipsoid(-0.006, 1.703, 0, 0.1, 0.091, 0.0765, rz(-0.12)), 0);
        add(pbEllipsoid(0.035, 1.735, 0, 0.068, 0.06, 0.07), 0.03);
        // Face: the brow ridge and the forehead above it, the cheek and maxilla mass, the jaw and chin.
        add(pbEllipsoid(0.072, 1.703, 0, 0.026, 0.017, 0.056), 0.02);
        add(pbEllipsoid(0.043, 1.641, 0, 0.049, 0.047, 0.051), 0.028);
        // The muzzle under the nose: the teeth's arch behind the lips, flatter than the face mass.
        add(pbEllipsoid(0.07, 1.605, 0, 0.02, 0.022, 0.03), 0.02);
        mirror((s) => add(pbEllipsoid(0.05, 1.666, s * 0.05, 0.024, 0.013, 0.021, rz(0.1)), 0.02));
        // The cheek between the cheekbone and the jaw: lean, not hollow.
        mirror((s) => add(pbEllipsoid(0.028, 1.628, s * 0.047, 0.03, 0.03, 0.016), 0.024));
        // Mandible: chin, the jawline back to the corners under the ears, the ramus up.
        add(pbEllipsoid(0.074, 1.585, 0, 0.019, 0.017, 0.025), 0.014);
        mirror((s) => add(pbLimb([0.067, 1.582, s * 0.019], [-0.002, 1.605, s * 0.049], 0.012, 0.0135), 0.02));
        mirror((s) => add(pbLimb([-0.002, 1.605, s * 0.049], [-0.014, 1.655, s * 0.056], 0.0135, 0.013), 0.018));
        // Under the chin, a little fullness.
        add(pbEllipsoid(0.035, 1.58, 0, 0.034, 0.012, 0.034), 0.025);
        // Temples: hollow a touch.
        mirror((s) => sub(pbEllipsoid(0.045, 1.718, s * 0.083, 0.024, 0.026, 0.012), 0.02));
        // Eye sockets under the brow; the lids are a mass round each eyeball with an almond opening cut through
        // it (higher in the middle, the outer corner a touch up); the eyeballs are spheres of their own
        // (pbEyeGeometry) sitting in the openings.
        mirror((s) => sub(pbEllipsoid(0.074, 1.684, s * 0.033, 0.021, 0.0135, 0.0195), 0.008));
        for (const e of PB_EYES) {
          const s = Math.sign(e[2]);
          add(pbEllipsoid(e[0] - 0.0003, e[1] + 0.0008, e[2], 0.0138, 0.0155, 0.0195), 0.006);
          // The heavier upper fold of the forties.
          add(pbEllipsoid(e[0] + 0.0025, e[1] + 0.0105, e[2] + s * 0.0015, 0.0095, 0.0045, 0.0165), 0.006);
          ops.push(
            pbSub(
              {
                f: (x, y, z) => {
                  const dz = z - e[2],
                    tilt = y - e[1] - s * dz * 0.08,
                    upper = Math.sqrt((tilt + 0.0185) * (tilt + 0.0185) + dz * dz) - 0.0215,
                    lower = Math.sqrt((tilt - 0.0285) * (tilt - 0.0285) + dz * dz) - 0.0331;
                  return Math.max(upper, lower, e[0] - 0.006 - x);
                },
                b: [e[0] + 0.01, e[1], e[2], 0.03],
              },
              0.0012,
            ),
          );
        }
        // Nose: bridge, tip, wings; nostrils carved underneath.
        add(pbLimb([0.088, 1.69, 0], [0.109, 1.643, 0], 0.0085, 0.0105, { flat: 1.15 }), 0.008);
        add(pbSphere(0.1075, 1.6355, 0, 0.0135), 0.007);
        mirror((s) => add(pbEllipsoid(0.0985, 1.6305, s * 0.0145, 0.0095, 0.0085, 0.0078), 0.005));
        mirror((s) => sub(pbEllipsoid(0.1035, 1.6255, s * 0.0078, 0.0068, 0.003, 0.0045), 0.002));
        // Mouth: upper and lower lips, the line between, the philtrum above.
        add(pbEllipsoid(0.0875, 1.6115, 0, 0.0095, 0.0055, 0.0215), 0.006);
        add(pbEllipsoid(0.0865, 1.599, 0, 0.0098, 0.0062, 0.019), 0.006);
        sub(pbEllipsoid(0.099, 1.6052, 0, 0.012, 0.001, 0.0225), 0.0012);
        mirror((s) => sub(pbEllipsoid(0.083, 1.605, s * 0.0238, 0.005, 0.003, 0.0035), 0.004));
        // Nasolabial folds from the nose wings to the mouth's corners.
        mirror((s) => sub(pbLimb([0.095, 1.631, s * 0.025], [0.084, 1.599, s * 0.031], 0.0011, 0.0009), 0.004));
        // Hair: a thickness over the scalp inside the hairline.
        ops.push({ op: 'mod', g: (x, y, z, d) => (y > 1.6 && d < 0.03 ? d - pbHairDepth(x, y, z) : d), b: [PB_HEAD_CENTRE[0], 1.71, 0, 0.13] });
        // Ears: a shell tilted back and turned out from the head, the bowl carved in, the lobe below.
        for (const s of [-1, 1]) {
          const frame = mul(ry(s * 0.2), rz(-0.2)),
            c = [-0.018, 1.668, s * 0.0745];
          ops.push(
            pbGroup(
              [
                pbAdd(pbEllipsoid(c[0], c[1], c[2], 0.0175, 0.029, 0.0068, frame)),
                pbAdd(pbEllipsoid(c[0] + 0.004, c[1] - 0.027, c[2] + s * 0.001, 0.0095, 0.0095, 0.0048), 0.006),
                pbSub(pbEllipsoid(c[0] + 0.004, c[1] - 0.004, c[2] + s * 0.0065, 0.0105, 0.017, 0.0055, frame), 0.003),
                // The tragus' ridge in front of the bowl.
                pbAdd(pbEllipsoid(c[0] + 0.016, c[1] - 0.008, c[2] + s * 0.001, 0.004, 0.006, 0.004), 0.003),
              ],
              0.006,
            ),
          );
        }
        return { ops };
      }
