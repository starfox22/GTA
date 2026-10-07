      // Player body build: meshes every part from its field, gives each vertex its bones and weights, its part, the
      // paint zones the shader reads (tee, jeans, hair, sole...), occlusion and the hands' grip; one geometry out.
      /**
       * PARTS AND SPACINGS: the clothed body (13 mm), the head (4.1 mm), the hands (3.6 mm) and shoes (5.5 mm)
       * as fields, the eyeballs as spheres. Everything is assembled in bind space and converted to rig units
       * (14 to the crown). Attributes besides position and normal:
       *   pbSkin  (bone a, bone b, weight of b, part)   two bones per vertex, dual quaternion skinned; `part`
       *            is the bone the vertex belongs to (PB_BONE_NAMES): a part can be told from the rest (a wound,
       *            a severed limb) by its id;
       *   pbGrip  (gripping position, occlusion)        the hands' curled shape (rig units), elsewhere the
       *            position; w the baked ambient occlusion;
       *   pbGripN (gripping normal);
       *   pbZone  (material, three zone distances)      material 0 clothed body, 1 head, 2 eye, 3 hand, 4 shoe;
       *            the distances (metres, positive inside) are, for the body: in the tee, in the jeans, from the
       *            neckline; the head: inside the hairline, the hair's depth; the hand: on a nail; the shoe: in
       *            the sole, in the sock.
       */
      // Spacings by tier: HIGH and ULTRA mesh fine (a crisper face), LOW and MEDIUM about half the triangles.
      const PB_SPACINGS = {
          fine: { body: 0.013, head: 0.0032, hand: 0.0034, shoe: 0.0055 },
          coarse: { body: 0.0175, head: 0.0052, hand: 0.0048, shoe: 0.0075 },
        },
        PB_MAT = { body: 0, head: 1, eye: 2, hand: 3, shoe: 4 };
      const pbSmooth = (a, b, x) => {
        const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      /* Body vertex weights: [bone a, bone b, weight of b] from its bind position (metres). */
      function pbBodyWeights(B, x, y, z, out) {
        const side = z >= 0 ? 1 : 0,
          q = pbScratch;
        // Arms: inside the arm's reach from its axis, past the shoulder.
        pbToLocal(B[3 + side], x, y, z, q);
        const along = -q[1],
          r = Math.sqrt(q[0] * q[0] + q[2] * q[2]),
          reach = 0.082 + 0.024 * pbSmooth(0.12, 0, along);
        if (along > -0.06 && r < reach + 0.05) {
          // The shoulder's cap (the deltoid over the joint, the tee's shoulder) rises with the arm: with no
          // collarbone in the rig it follows the arm most of the way, or a raised arm left it behind as a wing.
          const cap = pbSmooth(0.1, 0.185, Math.abs(z)) * pbSmooth(1.33, 1.42, y),
            arm = Math.max(pbSmooth(-0.05, 0.035, along) * (1 - pbSmooth(reach, reach + 0.05, r)), cap * 0.85),
            L1 = PB_RIG_M(RIG.upperArm),
            fore = pbSmooth(L1 - 0.045, L1 + 0.035, along);
          if (arm > 0.001) {
            if (fore > 0) return pbSet(out, 3 + side, 5 + side, fore);
            return pbSet(out, 1, 3 + side, arm);
          }
        }
        // Legs: below the groin crease and the gluteal fold, away from the crotch's middle.
        if (y < 1.0) {
          pbToLocal(B[9 + side], x, y, z, q);
          const alongT = -q[1],
            back = Math.max(0, -q[0] - 0.02),
            leg = pbSmooth(-0.01, 0.1, alongT - back * 0.9) * pbSmooth(0.008, 0.04, Math.abs(z)),
            L = PB_RIG_M(RIG.thigh),
            shin = pbSmooth(L - 0.05, L + 0.045, alongT);
          if (shin > 0) return pbSet(out, 9 + side, 11 + side, shin);
          if (leg > 0.001) return pbSet(out, 0, 9 + side, leg);
        }
        // The neck into the head.
        if (y > 1.46 && Math.abs(z) < 0.11 && x > -0.11 && x < 0.1) {
          const head = pbSmooth(1.505, 1.59, y);
          if (head > 0) return pbSet(out, 1, 2, head);
        }
        // The waist between the hips and the torso.
        return pbSet(out, 0, 1, pbSmooth(0.99, 1.17, y));
      }
      function pbSet(out, a, b, w) {
        out[0] = a;
        out[1] = b;
        out[2] = w;
        return out;
      }
      /**
       * Weights spread over the surface: each vertex's bone weights (dense, every bone) averaged with its
       * neighbours' a few times, then the two strongest kept. Weights decided by distance alone change too fast
       * across a few small triangles in the armpits and the groin, and those triangles became long slivers with
       * the arm raised or the thigh drawn up.
       */
      function* pbSmoothWeights(index, skin, iterations, keep) {
        const count = skin.length / 4,
          B = PB_BONES,
          dense = new Float32Array(count * B),
          next = new Float32Array(count * B),
          degree = new Uint16Array(count);
        for (let v = 0; v < count; v++) {
          dense[v * B + skin[v * 4]] += 1 - skin[v * 4 + 2];
          dense[v * B + skin[v * 4 + 1]] += skin[v * 4 + 2];
        }
        // Neighbours from the triangles' edges (each edge seen twice in a closed mesh: once each way).
        const starts = new Uint32Array(count + 1),
          edges = new Uint32Array(index.length * 2);
        for (let i = 0; i < index.length; i += 3) for (let k = 0; k < 3; k++) degree[index[i + k]] += 2;
        for (let v = 0; v < count; v++) starts[v + 1] = starts[v] + degree[v];
        const fill = new Uint32Array(count);
        for (let i = 0; i < index.length; i += 3)
          for (let k = 0; k < 3; k++) {
            const a = index[i + k],
              b = index[i + ((k + 1) % 3)],
              c = index[i + ((k + 2) % 3)];
            edges[starts[a] + fill[a]++] = b;
            edges[starts[a] + fill[a]++] = c;
          }
        for (let it = 0; it < iterations; it++) {
          if (performance.now() > pbClock.until) yield;
          for (let v = 0; v < count; v++) {
            const o = v * B;
            if (keep && keep(v)) {
              for (let b = 0; b < B; b++) next[o + b] = dense[o + b];
              continue;
            }
            const n = starts[v + 1] - starts[v];
            for (let b = 0; b < B; b++) next[o + b] = dense[o + b] * 0.4;
            for (let e = starts[v]; e < starts[v + 1]; e++) {
              const u = edges[e] * B;
              for (let b = 0; b < B; b++) next[o + b] += (dense[u + b] * 0.6) / n;
            }
          }
          dense.set(next);
        }
        for (let v = 0; v < count; v++) {
          const o = v * B;
          let a = 0,
            b = -1;
          for (let k = 1; k < B; k++) if (dense[o + k] > dense[o + a]) a = k;
          for (let k = 0; k < B; k++) if (k !== a && (b < 0 || dense[o + k] > dense[o + b])) b = k;
          const wa = dense[o + a],
            wb = Math.max(0, dense[o + b]);
          skin[v * 4] = a;
          skin[v * 4 + 1] = b;
          skin[v * 4 + 2] = wb / (wa + wb || 1);
          skin[v * 4 + 3] = a;
        }
      }
      /* Bind-space copy of a part meshed in a bone's local frame (mirrored across z for the left side). */
      function pbPlace(mesh, bone, mirror) {
        const P = mesh.position,
          N = mesh.normal,
          count = P.length / 3,
          position = new Float32Array(count * 3),
          normal = new Float32Array(count * 3),
          local = new Float32Array(count * 3),
          R = bone.R,
          o = bone.o,
          s = mirror ? -1 : 1;
        for (let v = 0; v < count; v++) {
          const x = P[v * 3],
            y = P[v * 3 + 1],
            z = P[v * 3 + 2] * s,
            nx = N[v * 3],
            ny = N[v * 3 + 1],
            nz = N[v * 3 + 2] * s;
          local[v * 3] = x;
          local[v * 3 + 1] = y;
          local[v * 3 + 2] = z;
          position[v * 3] = o[0] + R[0] * x + R[3] * y + R[6] * z;
          position[v * 3 + 1] = o[1] + R[1] * x + R[4] * y + R[7] * z;
          position[v * 3 + 2] = o[2] + R[2] * x + R[5] * y + R[8] * z;
          normal[v * 3] = R[0] * nx + R[3] * ny + R[6] * nz;
          normal[v * 3 + 1] = R[1] * nx + R[4] * ny + R[7] * nz;
          normal[v * 3 + 2] = R[2] * nx + R[5] * ny + R[8] * nz;
        }
        const index = new Uint32Array(mesh.index);
        if (mirror)
          for (let i = 0; i < index.length; i += 3) {
            const t = index[i + 1];
            index[i + 1] = index[i + 2];
            index[i + 2] = t;
          }
        return { position, normal, index, local, ao: mesh.ao };
      }
      /* Normals of a shape from its triangles (the gripping hand). */
      function pbTriangleNormals(position, index) {
        const n = new Float32Array(position.length);
        for (let i = 0; i < index.length; i += 3) {
          const a = index[i] * 3,
            b = index[i + 1] * 3,
            c = index[i + 2] * 3,
            ux = position[b] - position[a],
            uy = position[b + 1] - position[a + 1],
            uz = position[b + 2] - position[a + 2],
            vx = position[c] - position[a],
            vy = position[c + 1] - position[a + 1],
            vz = position[c + 2] - position[a + 2],
            nx = uy * vz - uz * vy,
            ny = uz * vx - ux * vz,
            nz = ux * vy - uy * vx;
          for (const k of [a, b, c]) {
            n[k] += nx;
            n[k + 1] += ny;
            n[k + 2] += nz;
          }
        }
        for (let v = 0; v < n.length; v += 3) {
          const l = Math.sqrt(n[v] * n[v] + n[v + 1] * n[v + 1] + n[v + 2] * n[v + 2]) || 1;
          n[v] /= l;
          n[v + 1] /= l;
          n[v + 2] /= l;
        }
        return n;
      }
      /**
       * The whole build as a generator (it yields when pbClock.until passes, so it can run a slice at a time
       * behind the title): { geometry data, bind skeleton, counts by part, build milliseconds }.
       */
      function* pbBuildSteps(detail = 'fine') {
        const PB_SPACING = PB_SPACINGS[detail] || PB_SPACINGS.fine,
          started = performance.now(),
          B = pbBindSkeleton(),
          pieces = [],
          w = [0, 0, 0];
        // The clothed body.
        const bodyField = pbBodyField(B),
          body = yield* pbMeshSteps(bodyField.ops, [-0.24, 0.04, -0.64, 0.24, 1.66, 0.64], PB_SPACING.body);
        body.ao = yield* pbOcclusionSteps(body, 0.06);
        {
          const count = body.position.length / 3,
            skin = new Float32Array(count * 4),
            zone = new Float32Array(count * 4),
            P = body.position;
          for (let v = 0; v < count; v++) {
            const x = P[v * 3],
              y = P[v * 3 + 1],
              z = P[v * 3 + 2];
            pbBodyWeights(B, x, y, z, w);
            skin.set([w[0], w[1], w[2], 0], v * 4);
            // Which layer's surface this is: the tee, the skin (neck, arms) or the jeans, as how much nearer
            // than the others its operations are (positive inside, zero on the line where they meet: crisp).
            // (Only the operations that matter at the vertex: a layer missing there is far away.)
            let dTee = 1,
              dSkin = 1,
              dJeans = 1;
            for (const op of body.lists[v]) {
              if (!op.layer) continue;
              const d = pbApply(op, 1e9, x, y, z);
              if (op.layer === 'tee') dTee = Math.min(dTee, d);
              else if (op.layer === 'skin') dSkin = Math.min(dSkin, d);
              else dJeans = Math.min(dJeans, d);
            }
            const neckRing = (Math.sqrt(((x + 0.008) / 0.064) ** 2 + (z / 0.07) ** 2) - 1) * 0.066,
              tee = Math.min(dSkin, dJeans) - dTee,
              jeans = Math.min(dSkin, dTee) - dJeans,
              neck = -Math.max(neckRing, bodyField.neckAt(x) - y);
            zone.set([PB_MAT.body, tee, jeans, neck], v * 4);
          }
          // Spread the weights, keeping the far ends of the limbs and the neck under the head as they are.
          yield* pbSmoothWeights(body.index, skin, 12, null);
          pieces.push({ ...body, skin, zone, grip: null, gripN: null });
        }
        yield;
        // The head, then the eyeballs.
        const head = yield* pbMeshSteps(pbHeadField().ops, [-0.125, 1.545, -0.115, 0.14, 1.82, 0.115], PB_SPACING.head);
        head.ao = yield* pbOcclusionSteps(head, 0.014);
        {
          const count = head.position.length / 3,
            skin = new Float32Array(count * 4),
            zone = new Float32Array(count * 4),
            P = head.position;
          for (let v = 0; v < count; v++) {
            const x = P[v * 3],
              y = P[v * 3 + 1],
              z = P[v * 3 + 2];
            skin.set([2, 2, 0, 2], v * 4);
            zone.set([PB_MAT.head, pbHairline(x, y, z), pbHairDepth(x, y, z), 0], v * 4);
          }
          pieces.push({ ...head, skin, zone, grip: null, gripN: null });
        }
        for (const e of PB_EYES) {
          const g = new Three.SphereGeometry(PB_EYE_R, 20, 14);
          g.rotateZ(-Math.PI / 2);
          g.translate(e[0], e[1], e[2]);
          const count = g.attributes.position.count,
            skin = new Float32Array(count * 4),
            zone = new Float32Array(count * 4);
          for (let v = 0; v < count; v++) {
            skin.set([2, 2, 0, 2], v * 4);
            zone.set([PB_MAT.eye, 0, 0, 0], v * 4);
          }
          pieces.push({ position: g.attributes.position.array, normal: g.attributes.normal.array, index: g.index.array, ao: new Float32Array(count).fill(1), skin, zone, grip: null, gripN: null });
        }
        yield;
        // Hands: the right hand meshed once, mirrored for the left; the grip shape moves with each.
        const hand = yield* pbMeshSteps(pbHandField().ops, [-0.06, -0.2, -0.06, 0.09, 0.03, 0.035], PB_SPACING.hand);
        hand.ao = yield* pbOcclusionSteps(hand, 0.012);
        const gripLocal = pbGripShape(hand.position),
          triggerLocal = pbGripShape(hand.position, true);
        for (const side of [0, 1]) {
          const placed = pbPlace(hand, B[7 + side], !side),
            gripPlaced = pbPlace({ position: gripLocal, normal: hand.normal, index: hand.index }, B[7 + side], !side),
            triggerPlaced = pbPlace({ position: triggerLocal, normal: hand.normal, index: hand.index }, B[7 + side], !side),
            count = placed.position.length / 3,
            skin = new Float32Array(count * 4),
            zone = new Float32Array(count * 4),
            chains = pbHandSegments();
          for (let v = 0; v < count; v++) {
            const ly = placed.local[v * 3 + 1],
              fore = 0.65 * pbSmooth(-0.004, 0.022, ly);
            skin.set([7 + side, 5 + side, fore, 7 + side], v * 4);
            // Nails: the back of each finger's last segment, towards its tip.
            const lx = hand.position[v * 3],
              lyy = hand.position[v * 3 + 1],
              lz = hand.position[v * 3 + 2];
            let nail = -1;
            for (let f = 0; f < 4; f++) {
              const J = chains[f].relaxed.joints,
                a = J[2],
                b = J[3],
                dx = b[0] - a[0],
                dy = b[1] - a[1],
                dz = b[2] - a[2],
                l2 = dx * dx + dy * dy + dz * dz,
                t = ((lx - a[0]) * dx + (lyy - a[1]) * dy + (lz - a[2]) * dz) / l2,
                // Dorsal: away from the palm (+z in hand space), within the nail's width.
                across = Math.abs(lx - (a[0] + dx * t)),
                dorsal = lz - (a[2] + dz * t);
              if (t > 0.3 && t < 1.05 && dorsal > 0.002) nail = Math.max(nail, Math.min(t - 0.38, 1.0 - t, 0.0052 - across) * (dorsal > 0.004 ? 1 : 0.3));
            }
            zone.set([PB_MAT.hand, side, nail, 0], v * 4);
          }
          const gripN = pbTriangleNormals(gripPlaced.position, placed.index),
            triggerN = pbTriangleNormals(triggerPlaced.position, placed.index);
          pieces.push({ ...placed, skin, zone, grip: gripPlaced.position, gripN, trigger: triggerPlaced.position, triggerN });
        }
        yield;
        // Shoes.
        const shoe = yield* pbMeshSteps(pbShoeField().ops, [-0.09, -0.08, -0.07, 0.25, 0.08, 0.07], PB_SPACING.shoe);
        shoe.ao = yield* pbOcclusionSteps(shoe, 0.014);
        for (const side of [0, 1]) {
          const placed = pbPlace(shoe, B[13 + side], !side),
            count = placed.position.length / 3,
            skin = new Float32Array(count * 4),
            zone = new Float32Array(count * 4);
          for (let v = 0; v < count; v++) {
            const lx = placed.local[v * 3],
              ly = placed.local[v * 3 + 1],
              shin = pbSmooth(-0.014, 0.03, ly),
              heel = Math.max(0, Math.min(1, (0.035 - lx) / 0.03)),
              soleTop = -0.057 + 0.012 * heel * heel * (3 - 2 * heel) + (lx > 0.14 ? (lx - 0.14) * (lx - 0.14) * 1.9 : 0);
            skin.set([13 + side, 11 + side, shin, 13 + side], v * 4);
            const collar = lx < 0.035 ? -0.008 - 0.01 * Math.max(0, Math.min(1, (lx + 0.05) / 0.085)) : 0.02;
            zone.set([PB_MAT.shoe, soleTop + 0.0015 - ly, ly - collar - 0.002, side], v * 4);
          }
          pieces.push({ ...placed, skin, zone, grip: null, gripN: null });
        }
        yield;
        // One geometry: positions in rig units.
        let vertices = 0,
          indices = 0;
        for (const p of pieces) {
          vertices += p.position.length / 3;
          indices += p.index.length;
        }
        const position = new Float32Array(vertices * 3),
          normal = new Float32Array(vertices * 3),
          skin = new Float32Array(vertices * 4),
          grip = new Float32Array(vertices * 4),
          gripN = new Float32Array(vertices * 3),
          trig = new Float32Array(vertices * 3),
          trigN = new Float32Array(vertices * 3),
          zone = new Float32Array(vertices * 4),
          index = new Uint32Array(indices),
          parts = {};
        let v0 = 0,
          i0 = 0;
        for (const p of pieces) {
          const n = p.position.length / 3;
          for (let v = 0; v < n; v++) {
            for (let k = 0; k < 3; k++) {
              position[(v0 + v) * 3 + k] = p.position[v * 3 + k] * PB_UNITS;
              normal[(v0 + v) * 3 + k] = p.normal[v * 3 + k];
              grip[(v0 + v) * 4 + k] = (p.grip ? p.grip[v * 3 + k] : p.position[v * 3 + k]) * PB_UNITS;
              gripN[(v0 + v) * 3 + k] = p.gripN ? p.gripN[v * 3 + k] : p.normal[v * 3 + k];
              trig[(v0 + v) * 3 + k] = (p.trigger ? p.trigger[v * 3 + k] : p.position[v * 3 + k]) * PB_UNITS;
              trigN[(v0 + v) * 3 + k] = p.triggerN ? p.triggerN[v * 3 + k] : p.normal[v * 3 + k];
            }
            grip[(v0 + v) * 4 + 3] = p.ao ? p.ao[v] : 1;
            const part = PB_BONE_NAMES[p.skin[v * 4 + 3]];
            parts[part] = (parts[part] || 0) + 1;
          }
          skin.set(p.skin, v0 * 4);
          zone.set(p.zone, v0 * 4);
          for (let i = 0; i < p.index.length; i++) index[i0 + i] = p.index[i] + v0;
          v0 += n;
          i0 += p.index.length;
        }
        return {
          bones: B,
          attributes: { position, normal, pbSkin: skin, pbGrip: grip, pbGripN: gripN, pbTrig: trig, pbTrigN: trigN, pbZone: zone },
          detail,
          index,
          vertices,
          triangles: indices / 3,
          parts,
          ms: Math.round(performance.now() - started),
        };
      }
