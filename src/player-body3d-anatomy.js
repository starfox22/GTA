      // Player body anatomy: the bind skeleton (the rig's joints, arms out in an A pose) and the body's field:
      // torso in a black crew-neck tee, neck, arms below the sleeves, legs in straight jeans (metres, bind space).
      /**
       * BIND SKELETON
       * The rig's joints (character-rig3d.js RIG) for the player's look, in metres for a 1.80 m man (the
       * model is drawn at 14 rig units to the crown; PB_UNITS converts). Bones, in this order everywhere:
       *   0 hips, 1 torso, 2 head, 3/4 upper arm L/R, 5/6 forearm L/R, 7/8 hand L/R, 9/10 thigh L/R,
       *   11/12 shin L/R, 13/14 foot L/R.
       * Each bone is { o: origin, R: its axes in bind space (x forward, y up the limb, z to the right) }.
       * The arms are bound out to the side by PB_BIND_ARM (an A pose keeps the armpit open while meshing) and
       * the legs a little apart (PB_BIND_SPREAD); the rig's own poses then turn the bones from there.
       */
      const PB_UNITS = 14 / 1.8,
        PB_WIDTH = 1.04,
        PB_BIND_ARM = 0.7,
        PB_BIND_SPREAD = 0.045,
        PB_BONES = 15,
        PB_BONE_NAMES = ['hips', 'torso', 'head', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'handL', 'handR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'];
      const PB_RIG_M = (u) => u / PB_UNITS;
      function pbBone(o, R) {
        return { o, R };
      }
      // Axes after a rotation about x by a (the rig's abduction and spread turn about the forward axis).
      const pbAboutX = (a) => [1, 0, 0, 0, Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a)];
      const pbAlong = (bone, d) => [bone.o[0] + bone.R[3] * d, bone.o[1] + bone.R[4] * d, bone.o[2] + bone.R[5] * d];
      function pbBindSkeleton(width = PB_WIDTH) {
        const M = PB_RIG_M,
          I = [1, 0, 0, 0, 1, 0, 0, 0, 1],
          hips = pbBone([0, M(RIG.hip), 0], I),
          torso = pbBone([0, M(RIG.hip + RIG.waist), 0], I),
          head = pbBone([M(0.04), M(RIG.hip + RIG.waist + RIG.neck), 0], I),
          bones = [hips, torso, head];
        for (const side of [0, 1]) {
          const s = side ? 1 : -1,
            R = pbAboutX(-s * PB_BIND_ARM);
          bones[3 + side] = pbBone([0, M(RIG.hip + RIG.waist + RIG.shoulderY), M(s * RIG.shoulderZ[0] * width)], R);
        }
        for (const side of [0, 1]) bones[5 + side] = pbBone(pbAlong(bones[3 + side], -M(RIG.upperArm)), bones[3 + side].R);
        for (const side of [0, 1]) bones[7 + side] = pbBone(pbAlong(bones[5 + side], -M(RIG.forearm)), bones[5 + side].R);
        for (const side of [0, 1]) {
          const s = side ? 1 : -1;
          bones[9 + side] = pbBone([0, M(RIG.hip), M(s * RIG.hipZ[0] * width)], pbAboutX(-s * PB_BIND_SPREAD));
        }
        for (const side of [0, 1]) bones[11 + side] = pbBone(pbAlong(bones[9 + side], -M(RIG.thigh)), bones[9 + side].R);
        for (const side of [0, 1]) bones[13 + side] = pbBone(pbAlong(bones[11 + side], -M(RIG.shin)), bones[11 + side].R);
        return bones;
      }
      /* A bone's local coordinates of a bind-space point (out [x, y, z]). */
      function pbToLocal(bone, x, y, z, out) {
        const R = bone.R,
          px = x - bone.o[0],
          py = y - bone.o[1],
          pz = z - bone.o[2];
        out[0] = px * R[0] + py * R[1] + pz * R[2];
        out[1] = px * R[3] + py * R[4] + pz * R[5];
        out[2] = px * R[6] + py * R[7] + pz * R[8];
        return out;
      }
      /* A primitive modelled in a bone's local frame, placed in bind space. */
      function pbIn(bone, prim, extra = {}) {
        const R = bone.R,
          o = bone.o,
          f = prim.f,
          b = prim.b;
        return {
          ...extra,
          f: (x, y, z) => {
            const px = x - o[0],
              py = y - o[1],
              pz = z - o[2];
            return f(px * R[0] + py * R[1] + pz * R[2], px * R[3] + py * R[4] + pz * R[5], px * R[6] + py * R[7] + pz * R[8]);
          },
          b: [o[0] + R[0] * b[0] + R[3] * b[1] + R[6] * b[2], o[1] + R[1] * b[0] + R[4] * b[1] + R[7] * b[2], o[2] + R[2] * b[0] + R[5] * b[1] + R[8] * b[2], b[3]],
        };
      }
      const pbScratch = [0, 0, 0];
      const pbAdd = (prim, k = 0) => ({ op: 'add', f: prim.f, b: prim.b, k });
      const pbSub = (prim, k = 0) => ({ op: 'sub', f: prim.f, b: prim.b, k });
      /* Intersection of two primitives as one primitive (a lid: an ellipsoid above a plane). */
      function pbAnd(a, c, k = 0) {
        return { f: (x, y, z) => pbSmax(a.f(x, y, z), c.f(x, y, z), k), b: a.b };
      }
      /* Union of primitives as one primitive (blend k). */
      function pbOr(list, k = 0) {
        const cx = list.reduce((s, p) => s + p.b[0], 0) / list.length,
          cy = list.reduce((s, p) => s + p.b[1], 0) / list.length,
          cz = list.reduce((s, p) => s + p.b[2], 0) / list.length,
          r = Math.max(...list.map((p) => Math.hypot(p.b[0] - cx, p.b[1] - cy, p.b[2] - cz) + p.b[3]));
        return {
          f: (x, y, z) => {
            let d = 1e9;
            for (let i = 0; i < list.length; i++) d = pbSmin(d, list[i].f(x, y, z), k);
            return d;
          },
          b: [cx, cy, cz, r],
        };
      }
      /**
       * THE CLOTHED BODY (one field, bind space): everything but the head, hands and shoes, which are meshes
       * of their own at finer spacing. The tee is the torso's outer shape down to its hem with short sleeves
       * over the deltoids; the jeans are the hips' and legs' shape from the waistband (under the tee) to a hem
       * that breaks over the shoe. A middle-aged build: a broad chest, a little softness at the belly and
       * the love handles, no gym definition. Returns the operations and the hem planes the paint reads.
       */
      function pbBodyField(B) {
        const ops = [],
          hips = B[0],
          torso = B[1],
          T = torso.o;
        // ---- Torso in the tee (torso frame = bind space offset by the torso joint) ----
        const t = (x, y, z) => [x, y - T[1], z];
        const tee = [];
        const E = (cx, cy, cz, rx, ry, rz, frame) => pbIn(torso, pbEllipsoid(...t(cx, cy, cz), rx, ry, rz, frame));
        // Rib cage and chest (y in bind metres).
        tee.push(E(0.01, 1.29, 0, 0.114, 0.19, 0.174));
        tee.push(E(0.056, 1.328, -0.068, 0.07, 0.064, 0.086), E(0.056, 1.328, 0.068, 0.07, 0.064, 0.086));
        // Upper back and shoulder blades.
        tee.push(E(-0.05, 1.31, -0.09, 0.068, 0.12, 0.1), E(-0.05, 1.31, 0.09, 0.068, 0.12, 0.1));
        // Belly (a little forward and low) and the flanks over the hips.
        tee.push(E(-0.012, 1.12, 0, 0.09, 0.15, 0.118));
        tee.push(E(-0.016, 1.07, -0.074, 0.08, 0.07, 0.046), E(-0.016, 1.07, 0.074, 0.08, 0.07, 0.046));
        tee.push(E(-0.026, 1.12, 0, 0.09, 0.15, 0.118));
        // The shoulder girdle: collarbones to the shoulder tips, trapezius slopes up to the neck.
        for (const s of [-1, 1]) {
          tee.push(pbIn(torso, pbLimb(t(0.015, 1.41, s * 0.03), t(0.0, 1.418, s * 0.162), 0.047, 0.048)));
          // Trapezius: from the side of the neck down to the shoulder's tip.
          tee.push(pbIn(torso, pbLimb(t(-0.022, 1.508, s * 0.04), t(-0.012, 1.452, s * 0.155), 0.036, 0.03)));
        }
        // Short sleeves: loose round cones over the deltoid to mid-biceps.
        const sleeves = [3, 4].map((b) =>
          pbIn(
            B[b],
            pbLimb([0.0, -0.015, 0], [0, -0.168, 0], 0.062, 0.06, {
              flat: 0.94,
              bulge: (u) => 0.005 * Math.sin(Math.PI * Math.min(1, u * 1.4)),
            }),
          ),
        );
        // The tee as one shell: the body, the sleeves webbed into the armpits, cut at the hem, the sleeve ends
        // and the neckline (front low, back high).
        const sleeveHem = 0.165,
          hemFront = 0.968,
          hemBack = 0.955,
          neckFront = 1.464,
          neckBack = 1.503,
          teeHemAt = (x) => hemBack + ((hemFront - hemBack) * (x + 0.13)) / 0.26,
          neckAt = (x) => neckBack + ((neckFront - neckBack) * (x + 0.06)) / 0.14;
        const teeOps = [
          ...tee.map((p, i) => pbAdd(p, i ? 0.07 : 0)),
          ...sleeves.map((p) => pbAdd(p, 0.045)),
          { op: 'mod', g: (x, y, z, d) => d - 0.004 },
          { op: 'cut', f: (x, y, z) => teeHemAt(x) - y, k: 0.006 },
          // The crew neckline: the opening round the neck's base above a plane tilted down at the front.
          { op: 'sub', f: (x, y, z) => Math.max(neckAt(x) - y, (Math.sqrt(((x + 0.008) / 0.064) ** 2 + (z / 0.07) ** 2) - 1) * 0.066), k: 0.006 },
          ...[3, 4].map((bone) => ({
            op: 'cut',
            k: 0.004,
            f: (x, y, z) => {
              // Square to the arm near it, receding away from it (no edge where the cut stops).
              const q = pbToLocal(B[bone], x, y, z, pbScratch);
              return -q[1] - sleeveHem - 4 * Math.max(0, Math.sqrt(q[0] * q[0] + q[2] * q[2]) - 0.085);
            },
          })),
        ];
        ops.push(pbGroup(teeOps, 0));
        // The rib of the crew neck: a ring lying on the neckline round the neck's base.
        const collar = {
          f: (x, y, z) => {
            const neck = neckAt(x),
              // The ring in the neckline's plane: ellipse round the neck (wider across than front to back).
              cx = x + 0.008,
              e = Math.hypot(cx / 0.064, z / 0.07),
              ring = (e - 1) * 0.066;
            return Math.hypot(ring, (y - neck - 0.002) * 0.9) - 0.0065;
          },
          b: [0, 1.475, 0, 0.12],
        };
        ops.push({ op: 'add', f: collar.f, b: collar.b, k: 0.004 });
        // ---- Neck (skin): into the head above, under the tee below ----
        const neck = [
          pbLimb([-0.012, 1.465, 0], [0.004, 1.615, 0], 0.066, 0.062, { flat: 1.08, depth: 0.95 }),
          // Sternocleidomastoids: behind the ears to the top of the breastbone.
          pbLimb([-0.012, 1.615, -0.048], [0.052, 1.462, -0.014], 0.016, 0.014),
          pbLimb([-0.012, 1.615, 0.048], [0.052, 1.462, 0.014], 0.016, 0.014),
          // The larynx, softly.
          pbEllipsoid(0.05, 1.53, 0, 0.012, 0.017, 0.013),
          // Trapezius from the nape out under the tee.
          pbLimb([-0.035, 1.56, -0.012], [-0.03, 1.47, -0.1], 0.036, 0.032),
          pbLimb([-0.035, 1.56, 0.012], [-0.03, 1.47, 0.1], 0.036, 0.032),
        ];
        ops.push(pbGroup(neck.map((p, i) => pbAdd(p, i ? 0.022 : 0)), 0.008));
        // ---- Arms below the sleeves (skin) ----
        for (const side of [0, 1]) {
          const s = side ? 1 : -1,
            up = B[3 + side],
            fore = B[5 + side],
            lat = (v) => v * s;
          const arm = [
            // Deltoid (under the sleeve) and the upper arm, a little flattened side to side.
            pbIn(up, pbEllipsoid(0.003, -0.055, lat(0.012), 0.055, 0.085, 0.045)),
            pbIn(up, pbLimb([0, -0.01, 0], [0, -0.31, 0], 0.054, 0.041, { flat: 0.9 })),
            // Biceps in front, triceps behind.
            pbIn(up, pbEllipsoid(0.026, -0.17, lat(0.002), 0.037, 0.08, 0.038)),
            pbIn(up, pbEllipsoid(-0.026, -0.15, 0, 0.037, 0.09, 0.04)),
            // The elbow's point and the forearm: wide and muscular below the elbow, flat at the wrist.
            pbIn(fore, pbSphere(-0.02, 0.005, 0, 0.021)),
            pbIn(fore, pbLimb([0, 0.01, 0], [0, -0.252, 0], 0.047, 0.028, { flat: 0.8, bulge: (u) => 0.012 * Math.exp(-((u - 0.2) * (u - 0.2)) / 0.03) })),
            pbIn(fore, pbEllipsoid(0.01, -0.06, lat(0.012), 0.036, 0.075, 0.034)),
          ];
          ops.push(pbGroup(arm.map((p, i) => pbAdd(p, i ? 0.02 : 0)), 0.012));
        }
        // ---- Jeans: hips, seat and legs, from under the tee to the hem ----
        const H = hips.o;
        const jeans = [
          pbEllipsoid(-0.004, 0.985, 0, 0.102, 0.085, 0.15),
          pbEllipsoid(0.0, 0.935, 0, 0.096, 0.075, 0.164),
          // Seat.
          pbEllipsoid(-0.052, 0.9, -0.07, 0.078, 0.088, 0.082),
          pbEllipsoid(-0.052, 0.9, 0.07, 0.078, 0.088, 0.082),
          // The crotch.
          pbEllipsoid(0.0, 0.855, 0, 0.07, 0.05, 0.06),
        ];
        const legParts = [];
        for (const side of [0, 1]) {
          const s = side ? 1 : -1,
            th = B[9 + side],
            lat = (v) => v * s,
            L = PB_RIG_M(RIG.thigh);
          // One round cone from the hip to the hem (the thigh and shin are in line in the bind pose: two met
          // in a ring at the knee): full at the top, easing to the knee, straight down to the hem, which stacks.
          const length = L + 0.43,
            knee = L / length;
          legParts.push(
            pbIn(
              th,
              pbLimb([0.004, 0.02, lat(0.012)], [0.006, -length, 0], 0.058, 0.058, {
                flat: 0.95,
                bulge: (u, sx) => {
                  const up = Math.max(0, 1 - u / knee);
                  return (
                    0.029 * up * Math.sqrt(up) +
                    (sx > 0 ? 0.004 * Math.exp(-((u - knee) * (u - knee)) / 0.003) : 0) +
                    (sx < 0 ? 0.005 * Math.exp(-((u - knee - 0.14) * (u - knee - 0.14)) / 0.012) : 0) +
                    0.004 * Math.max(0, (u - 0.93) / 0.07)
                  );
                },
              }),
            ),
          );
        }
        const hemFrontY = 0.083,
          hemBackY = 0.062,
          jeansHemAt = (x) => hemBackY + ((hemFrontY - hemBackY) * (x + 0.06)) / 0.14;
        ops.push(
          pbGroup(
            [
              ...jeans.map((p, i) => pbAdd(p, i ? 0.05 : 0)),
              ...legParts.map((p) => pbAdd(p, 0.03)),
              // The waistband, up inside the tee; the hems lower at the heel.
              { op: 'cut', f: (x, y) => y - 1.05, k: 0.01 },
              { op: 'cut', f: (x, y) => jeansHemAt(x) - y, k: 0.004 },
            ],
            0.002,
          ),
        );
        // Which operations make which material (the paint asks which one owns each vertex: build.js).
        ['tee', 'tee', 'skin', 'skin', 'skin', 'jeans'].forEach((layer, i) => (ops[i].layer = layer));
        return { ops, sleeveHem, teeHemAt, neckAt, jeansHemAt };
      }
