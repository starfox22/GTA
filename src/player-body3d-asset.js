      // Player body from the shipped model (assets/player-model.bin, tools/player_model.py: a Microsoft Rocketbox
      // avatar, MIT): decoded and fitted to the rig's bind skeleton at load, with the hands' grip shapes made here.
      /**
       * PLAYER MODEL (preferred over the fields whenever the asset is in the build)
       * The asset holds the mesh in its own rest pose (metres, x forward, y up, z right), UVs into the colour and
       * detail atlases, each vertex's two strongest of the 15 bones (its part the strongest), the hands' sub-bones
       * (palm, three segments of each finger and the thumb) and the asset's joint frames. pbAssetBuildSteps fits it
       * to pbBindSkeleton: each bone's region moves with its own map, blended by the vertex's weights:
       *   - the trunk (hips, torso, head) by one field of height: the hip joint and the shoulders onto the rig's,
       *     the head scaled by PB_ASSET_HEAD round the neck so the crown lands at PB_ASSET_CROWN;
       *   - each limb bone rigidly onto the rig's bone (its frame: up the limb, the knuckle line forward), scaled
       *     along the limb to the rig's length; the shoe keeps its height (the asset's ankle stands PB_ASSET_LIFT
       *     above the rig's, the shin ends there);
       *   - the hands rigidly at the wrist; their relaxed, gripping and trigger shapes are the asset's finger
       *     segments turned to the field hand's curls (PB_CURL, PB_THUMB: the same fist round PB_FIST).
       * Output: the same attributes as pbBuildSteps plus pbUv; pbZone is (material, skin share, 0, 0) with the
       * field body's material codes (0 clothes, 1 head, 2 eye, 3 hand, 4 shoe); the shader paints it from the
       * textures (pbTextured).
       */
      const PB_ASSET_CROWN = 1.81,
        PB_ASSET_HEAD = 0.95,
        // Muscle over the asset's slim build: the chest's breadth and depth, the waist in, the arms' girth (upper, fore).
        PB_ASSET_CHEST = 0.08,
        PB_ASSET_WAIST = 0.1,
        PB_ASSET_ARMS = [1.14, 1.07];
      let pbAssetCache;
      /* The decoded asset ({ header, arrays }), or null when the build has none. */
      function pbAssetData() {
        if (pbAssetCache !== undefined) return pbAssetCache;
        pbAssetCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.playerModel;
        if (!url) return null;
        const text = atob(url.slice(url.indexOf(',') + 1)),
          bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
        if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECPM001') throw new Error('player model: not a model file');
        const view = new DataView(bytes.buffer),
          headerLength = view.getUint32(8, true),
          header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength))),
          base = 12 + headerLength,
          types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, u2: Uint16Array },
          arrays = {};
        for (const [name, [type, offset, count]] of Object.entries(header.arrays)) arrays[name] = new types[type](bytes.buffer, base + offset, count);
        pbAssetCache = { header, arrays };
        return pbAssetCache;
      }
      // 3x3 helpers on column lists (R[0..2] the x axis, R[3..5] y, R[6..8] z).
      const pbMulRT = (R, A, out) => {
        // R · Aᵀ (the asset frame A onto the rig's R), as a column list.
        for (let c = 0; c < 3; c++)
          for (let r = 0; r < 3; r++) out[c * 3 + r] = R[r] * A[c] + R[3 + r] * A[3 + c] + R[6 + r] * A[6 + c];
        return out;
      };
      /**
       * One bone's map from the asset's rest pose into the bind: { o, a, M } with p' = o + M (p - a), M a 3x3
       * (columns), and N (its inverse transpose) for normals. Limbs only; the trunk is pbAssetTrunk.
       */
      function pbAssetLimb(B, A, b, scale, lift = 0, girth = 1) {
        const R = B[b].R,
          Ra = A[b].R,
          S = [...R],
          N = [...R];
        // Scale along the limb (the bone's y) and round it (girth): M = R diag(g, s, g) Raᵀ; normals by the
        // inverse transpose, R diag(1/g, 1/s, 1/g) Raᵀ.
        for (let k = 0; k < 9; k++) {
          const f = k >= 3 && k < 6 ? scale : girth;
          S[k] *= f;
          N[k] /= f;
        }
        const M = pbMulRT(S, Ra, new Array(9)),
          Nm = pbMulRT(N, Ra, new Array(9)),
          o = [B[b].o[0] + R[3] * lift, B[b].o[1] + R[4] * lift, B[b].o[2] + R[5] * lift];
        return { o, a: A[b].o, M, N: Nm };
      }
      /* The trunk's map as a function of the asset's height: { y(h), dy(h), k(h), dx(h) } (see the banner). */
      function pbAssetTrunk(B, A, crownA) {
        const hipA = A[0].o[1],
          hipB = B[0].o[1],
          shA = A[3].o[1],
          shB = B[3].o[1],
          neckA = A[2].o[1],
          neckB = PB_ASSET_CROWN - (crownA - neckA) * PB_ASSET_HEAD,
          forward = B[3].o[0] - A[3].o[0];
        const y = (h) =>
          h <= hipA ? h + hipB - hipA : h <= shA ? hipB + ((h - hipA) * (shB - hipB)) / (shA - hipA) : h <= neckA ? shB + ((h - shA) * (neckB - shB)) / (neckA - shA) : neckB + (h - neckA) * PB_ASSET_HEAD;
        const slope = (h) => (h <= hipA ? 1 : h <= shA ? (shB - hipB) / (shA - hipA) : h <= neckA ? (neckB - shB) / (neckA - shA) : PB_ASSET_HEAD);
        // Across the neck the head's scale comes in; the upper body leans forward onto the rig's shoulders.
        const k = (h) => 1 - (1 - PB_ASSET_HEAD) * Math.max(0, Math.min(1, (h - shA) / (neckA - shA)));
        const dx = (h) => forward * Math.max(0, Math.min(1, (h - hipA) / (shA - hipA)));
        // An athlete's V: the chest broader and deeper (PB_ASSET_CHEST), the waist a little in.
        const bump = (h, a, m, b) => (h <= a || h >= b ? 0 : h < m ? pbSmooth(a, m, h) : pbSmooth(b, m, h));
        const wide = (h) => 1 + PB_ASSET_CHEST * bump(h, shA - 0.36, shA - 0.16, shA + 0.02) - PB_ASSET_WAIST * bump(h, hipA, hipA + 0.09, hipA + 0.26);
        return { y, slope, k, dx, wide, centre: [A[2].o[0], A[2].o[2]] };
      }
      /* Rodrigues: v turned by the rotation taking unit a onto unit b (into out). */
      function pbTurn(a, b, v, out) {
        const cx = a[1] * b[2] - a[2] * b[1],
          cy = a[2] * b[0] - a[0] * b[2],
          cz = a[0] * b[1] - a[1] * b[0],
          c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
          s = Math.sqrt(cx * cx + cy * cy + cz * cz);
        if (s < 1e-9) {
          out[0] = v[0];
          out[1] = v[1];
          out[2] = v[2];
          return out;
        }
        const kx = cx / s,
          ky = cy / s,
          kz = cz / s,
          dot = kx * v[0] + ky * v[1] + kz * v[2];
        out[0] = v[0] * c + (ky * v[2] - kz * v[1]) * s + kx * dot * (1 - c);
        out[1] = v[1] * c + (kz * v[0] - kx * v[2]) * s + ky * dot * (1 - c);
        out[2] = v[2] * c + (kx * v[1] - ky * v[0]) * s + kz * dot * (1 - c);
        return out;
      }
      /**
       * A hand's segments (hand space) for one shape: per sub-bone 1..15 { base (rest), dir (rest), to (shape's
       * joint), dirTo (shape's direction) }. Fingers keep the asset's splay and take the field hand's curl
       * (cumulative, about the knuckle line, towards the palm: -z on the right hand, +z on the left);
       * the thumb takes PB_THUMB's directions. state 0 relaxed, 1 grip, 2 grip with the index along the trigger.
       */
      function pbAssetHandSegments(chains, side, state) {
        const mirror = side ? 1 : -1,
          segs = [null];
        for (let c = 0; c < 5; c++) {
          const J = chains[c],
            dirs = [];
          for (let j = 0; j < 3; j++) {
            const a = J[Math.min(j, 1)],
              b = J[Math.min(j, 1) + 1];
            dirs.push(pbNorm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]));
          }
          const lengths = [0, 1].map((j) => Math.hypot(J[j + 1][0] - J[j][0], J[j + 1][1] - J[j][1], J[j + 1][2] - J[j][2]));
          let targets;
          if (c < 4) {
            const curl = PB_CURL[state === 2 && c === 0 ? 2 : state ? 1 : 0],
              splay = Math.asin(Math.max(-1, Math.min(1, dirs[0][0])));
            let angle = 0;
            targets = [0, 1, 2].map((j) => {
              angle += curl[j];
              return pbNorm3([Math.sin(splay), -Math.cos(splay) * Math.cos(angle), -mirror * Math.cos(splay) * Math.sin(angle)]);
            });
          } else targets = (state ? PB_THUMB.grip : PB_THUMB.relaxed).map((d) => pbNorm3([d[0], d[1], mirror * d[2]]));
          let to = J[0];
          for (let j = 0; j < 3; j++) {
            const base = j < 2 ? J[j] : J[2];
            segs[1 + c * 3 + j] = { base, dir: dirs[j], to, dirTo: targets[j] };
            const len = j < 2 ? lengths[j] : 0;
            to = [to[0] + targets[j][0] * len, to[1] + targets[j][1] * len, to[2] + targets[j][2] * len];
          }
        }
        return segs;
      }
      /* A hand-space point (and normal) carried by sub-bone s of a shape (0: the palm, unmoved). */
      function pbAssetCarry(segs, s, p, n, outP, outN) {
        if (!s) {
          outP[0] = p[0];
          outP[1] = p[1];
          outP[2] = p[2];
          outN[0] = n[0];
          outN[1] = n[1];
          outN[2] = n[2];
          return;
        }
        const g = segs[s],
          d = [p[0] - g.base[0], p[1] - g.base[1], p[2] - g.base[2]];
        pbTurn(g.dir, g.dirTo, d, outP);
        outP[0] += g.to[0];
        outP[1] += g.to[1];
        outP[2] += g.to[2];
        pbTurn(g.dir, g.dirTo, n, outN);
      }
      /** The model's build (a generator like pbBuildSteps; no slices needed): the same result, or null without it. */
      function* pbAssetBuildSteps(detail = 'fine') {
        const started = performance.now(),
          asset = pbAssetData();
        if (!asset) return null;
        const { header, arrays } = asset,
          B = pbBindSkeleton(),
          A = header.bones,
          n = header.vertices,
          P0 = arrays.position,
          N0 = arrays.normal,
          SK = arrays.skin,
          crownA = P0.reduce((m, v, i) => (i % 3 === 1 ? Math.max(m, v) : m), -1),
          trunk = pbAssetTrunk(B, A, crownA),
          len = (o, p) => Math.hypot(p[0] - o[0], p[1] - o[1], p[2] - o[2]),
          // The shoe keeps its height: the asset's ankle above its sole, against the rig's (PB_SOLE).
          lift = A[13].o[1] - P0.reduce((m, v, i) => (i % 3 === 1 ? Math.min(m, v) : m), 9) + PB_SOLE,
          maps = [];
        for (const side of [0, 1]) {
          maps[3 + side] = pbAssetLimb(B, A, 3 + side, PB_RIG_M(RIG.upperArm) / len(A[3 + side].o, A[5 + side].o), 0, PB_ASSET_ARMS[0]);
          maps[5 + side] = pbAssetLimb(B, A, 5 + side, PB_RIG_M(RIG.forearm) / len(A[5 + side].o, A[7 + side].o), 0, PB_ASSET_ARMS[1]);
          maps[7 + side] = pbAssetLimb(B, A, 7 + side, 1);
          maps[9 + side] = pbAssetLimb(B, A, 9 + side, PB_RIG_M(RIG.thigh) / len(A[9 + side].o, A[11 + side].o));
          maps[11 + side] = pbAssetLimb(B, A, 11 + side, (PB_RIG_M(RIG.shin) - lift) / len(A[11 + side].o, A[13 + side].o));
          maps[13 + side] = pbAssetLimb(B, A, 13 + side, 1, lift);
        }
        // A vertex through one bone's map (position into outP, normal into outN, both unnormalised for blending).
        const through = (b, p, nv, outP, outN) => {
          if (b <= 2) {
            const h = p[1],
              k = trunk.k(h),
              w = trunk.wide(h),
              s = trunk.slope(h);
            outP[0] = trunk.centre[0] + (p[0] - trunk.centre[0]) * k * w + trunk.dx(h);
            outP[1] = trunk.y(h);
            outP[2] = trunk.centre[1] + (p[2] - trunk.centre[1]) * k * w;
            // Normals by the map's inverse transpose (the shear's and the scale's small slopes left out).
            outN[0] = nv[0] / (k * w);
            outN[1] = nv[1] / s;
            outN[2] = nv[2] / (k * w);
            return;
          }
          const m = maps[b],
            M = m.M,
            Nm = m.N,
            dx = p[0] - m.a[0],
            dy = p[1] - m.a[1],
            dz = p[2] - m.a[2];
          for (let r = 0; r < 3; r++) {
            outP[r] = m.o[r] + M[r] * dx + M[3 + r] * dy + M[6 + r] * dz;
            outN[r] = Nm[r] * nv[0] + Nm[3 + r] * nv[1] + Nm[6 + r] * nv[2];
          }
        };
        const position = new Float32Array(n * 3),
          normal = new Float32Array(n * 3),
          skin = new Float32Array(n * 4),
          grip = new Float32Array(n * 4),
          gripN = new Float32Array(n * 3),
          trig = new Float32Array(n * 3),
          trigN = new Float32Array(n * 3),
          zone = new Float32Array(n * 4),
          uv = new Float32Array(n * 2),
          parts = {},
          p = [0, 0, 0],
          nv = [0, 0, 0],
          pa = [0, 0, 0],
          na = [0, 0, 0],
          pb = [0, 0, 0],
          nb = [0, 0, 0];
        for (let v = 0; v < n; v++) {
          for (let k = 0; k < 3; k++) {
            p[k] = P0[v * 3 + k];
            nv[k] = N0[v * 3 + k] / 127;
          }
          const ia = SK[v * 4],
            ib = SK[v * 4 + 1],
            wb = SK[v * 4 + 2] / 255;
          through(ia, p, nv, pa, na);
          through(ib, p, nv, pb, nb);
          let l = 0;
          for (let k = 0; k < 3; k++) {
            position[v * 3 + k] = pa[k] + (pb[k] - pa[k]) * wb;
            const c = na[k] + (nb[k] - na[k]) * wb;
            normal[v * 3 + k] = c;
            l += c * c;
          }
          l = Math.sqrt(l) || 1;
          for (let k = 0; k < 3; k++) normal[v * 3 + k] /= l;
          skin[v * 4] = ia;
          skin[v * 4 + 1] = ib;
          skin[v * 4 + 2] = wb;
          skin[v * 4 + 3] = SK[v * 4 + 3];
          const mat = arrays.material[v];
          zone[v * 4] = mat;
          zone[v * 4 + 1] = mat === 1 || mat === 3 ? 1 : 0;
          uv[v * 2] = arrays.uv[v * 2] / 65535;
          uv[v * 2 + 1] = arrays.uv[v * 2 + 1] / 65535;
          const part = PB_BONE_NAMES[SK[v * 4 + 3]];
          parts[part] = (parts[part] || 0) + 1;
        }
        // The hands: relaxed (the mesh), gripping and trigger shapes, in each hand's space.
        for (let v = 0; v < n; v++) {
          for (let k = 0; k < 3; k++) grip[v * 4 + k] = position[v * 3 + k];
          grip[v * 4 + 3] = 1;
        }
        gripN.set(normal);
        trig.set(position);
        trigN.set(normal);
        pbAssetHands(B, A, header.hands, arrays.hand, SK, n, position, normal, grip, gripN, trig, trigN);
        yield;
        // Rig units.
        for (let i = 0; i < position.length; i++) {
          position[i] *= PB_UNITS;
          trig[i] *= PB_UNITS;
        }
        for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) grip[v * 4 + k] *= PB_UNITS;
        return {
          bones: B,
          attributes: { position, normal, pbSkin: skin, pbGrip: grip, pbGripN: gripN, pbTrig: trig, pbTrigN: trigN, pbZone: zone, pbUv: uv },
          detail,
          model: header.source,
          textured: true,
          index: Uint32Array.from(arrays.index),
          vertices: n,
          triangles: header.triangles,
          parts,
          ms: Math.round(performance.now() - started),
        };
      }
      /**
       * The hands' relaxed (moved into `position`/`normal`), gripping (`grip`, its w kept) and trigger (`trig`; null
       * to skip) shapes in bind space (metres): each hand vertex carried by its finger segments
       * (pbAssetHandSegments). Shared by the player's model and the street's avatars (npc-avatar3d-fit.js).
       */
      const PB_HAND_STATES = [0, 1, 2],
        PB_HAND_GRIPS = [0, 1];
      function pbAssetHands(B, A, hands, H, SK, n, position, normal, grip, gripN, trig, trigN) {
        const local = [0, 0, 0],
          localN = [0, 0, 0],
          q = [0, 0, 0],
          qn = [0, 0, 0],
          r = [0, 0, 0],
          rn = [0, 0, 0];
        for (const side of [0, 1]) {
          const bone = B[7 + side],
            R = bone.R,
            // The asset's chains in hand space are its own hand-local coordinates (the map is rigid there).
            Ra = A[7 + side].R,
            ao = A[7 + side].o,
            chains = hands[side].map((chain) =>
              chain.map((j) => {
                const d = [j[0] - ao[0], j[1] - ao[1], j[2] - ao[2]];
                return [Ra[0] * d[0] + Ra[1] * d[1] + Ra[2] * d[2], Ra[3] * d[0] + Ra[4] * d[1] + Ra[5] * d[2], Ra[6] * d[0] + Ra[7] * d[1] + Ra[8] * d[2]];
              }),
            ),
            shapes = [0, 1, 2].map((state) => pbAssetHandSegments(chains, side, state));
          for (let v = 0; v < n; v++) {
            if (H[v * 4] === 255) continue;
            const ia = SK[v * 4],
              ib = SK[v * 4 + 1];
            if (ia !== 7 + side && ib !== 7 + side) continue;
            pbToLocal(bone, position[v * 3], position[v * 3 + 1], position[v * 3 + 2], local);
            const nx = normal[v * 3],
              ny = normal[v * 3 + 1],
              nz = normal[v * 3 + 2];
            localN[0] = nx * R[0] + ny * R[1] + nz * R[2];
            localN[1] = nx * R[3] + ny * R[4] + nz * R[5];
            localN[2] = nx * R[6] + ny * R[7] + nz * R[8];
            // Only the hand's share moves with the fingers (a wrist vertex half on the forearm half follows).
            const handShare = ia === 7 + side ? 1 - SK[v * 4 + 2] / 255 : SK[v * 4 + 2] / 255,
              sa = H[v * 4],
              sb = H[v * 4 + 1],
              ws = H[v * 4 + 2] / 255,
              out = [];
            for (const state of trig ? PB_HAND_STATES : PB_HAND_GRIPS) {
              pbAssetCarry(shapes[state], sa, local, localN, q, qn);
              pbAssetCarry(shapes[state], sb, local, localN, r, rn);
              const P = [0, 1, 2].map((k) => local[k] + (q[k] + (r[k] - q[k]) * ws - local[k]) * handShare),
                Nn = pbNorm3([0, 1, 2].map((k) => localN[k] + (qn[k] + (rn[k] - qn[k]) * ws - localN[k]) * handShare));
              // Back to bind space.
              out.push([0, 1, 2].map((k) => bone.o[k] + R[k] * P[0] + R[3 + k] * P[1] + R[6 + k] * P[2]), [0, 1, 2].map((k) => R[k] * Nn[0] + R[3 + k] * Nn[1] + R[6 + k] * Nn[2]));
            }
            for (let k = 0; k < 3; k++) {
              position[v * 3 + k] = out[0][k];
              normal[v * 3 + k] = out[1][k];
              grip[v * 4 + k] = out[2][k];
              gripN[v * 3 + k] = out[3][k];
              if (trig) {
                trig[v * 3 + k] = out[4][k];
                trigN[v * 3 + k] = out[5][k];
              }
            }
          }
        }
      }
