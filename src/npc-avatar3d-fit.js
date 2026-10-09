      // Street avatars' models (assets/npc-models.bin, tools/npc_models.py: Microsoft Rocketbox avatars, MIT): the cast
      // header read at once, each avatar decoded and fitted to the rig's bind skeleton in slices behind the title.
      /**
       * NPC AVATAR FIT
       * Like the player's model (player-body3d-asset.js) each avatar is fitted onto pbBindSkeleton, here at the
       * avatar's own shoulder width and sex (`width`: the rig's shoulders land on the avatar's, so the arms keep their
       * place; drawCrowdPerson draws an avatar person at that width), so the rig stays the one source of joints:
       *   - the trunk (hips, torso, head) by one field of height: the hip joint and the shoulders onto the rig's; above
       *     the shoulders the same stretch, and the head scaled by it round the neck (a child's head stays a child's);
       *   - each limb rigidly onto the rig's bone, scaled along it to the rig's length; the shoe keeps its height;
       *   - the hands' gripping shape from the avatar's finger segments (pbAssetHands).
       * Attributes are lean (64 bytes a vertex): position, normal, npcSkin (bones a, b, b's share, part), npcGrip (the
       * gripping hand), npcZone (0 cloth, 1 head, 2 eye, 3 hand, 4 shoe, 5 a hair card cut out by the atlas' alpha),
       * npcUv (the shared atlas, assets/npc-skin.webp).
       */
      let npcAssetCache;
      /* The asset's bytes, header and base (null without it); the arrays are read per avatar when it is fitted. */
      function npcAvatarAsset() {
        if (npcAssetCache !== undefined) return npcAssetCache;
        npcAssetCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.npcModels;
        if (!url) return null;
        try {
          const text = atob(url.slice(url.indexOf(',') + 1)),
            bytes = new Uint8Array(text.length);
          for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECNPC01') throw new Error('not an avatar file');
          const headerLength = new DataView(bytes.buffer).getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength)));
          npcAssetCache = { bytes, header, base: 12 + headerLength };
        } catch (error) {
          console.error('npc avatars: the model file failed', error);
        }
        return npcAssetCache;
      }
      /* The cast (header.avatars) or an empty list. */
      function npcAvatarCast() {
        const asset = npcAvatarAsset();
        return asset ? asset.header.avatars : [];
      }
      const NPC_ARRAY_TYPES = { i2: Int16Array, i1: Int8Array, u1: Uint8Array, u2: Uint16Array };
      function npcAvatarArrays(asset, entry) {
        const out = {};
        for (const [name, [type, offset, count]] of Object.entries(entry.arrays)) out[name] = new NPC_ARRAY_TYPES[type](asset.bytes.buffer, asset.base + offset, count);
        return out;
      }
      /* The trunk's map for an avatar (see the banner): y(h), slope, horizontal scale k(h), forward shift dx(h). */
      function npcAvatarTrunk(B, A, crownA) {
        const hipA = A[0].o[1],
          hipB = B[0].o[1],
          shA = A[3].o[1],
          shB = B[3].o[1],
          neckA = A[2].o[1],
          r = (shB - hipB) / (shA - hipA),
          // The head at the trunk's stretch, a touch smaller (the player's PB_ASSET_HEAD); the neck then stands so the
          // crown is at NPC_CROWN, the rig's stature with hair, as the player's.
          hs = r * PB_ASSET_HEAD,
          neckB = Math.max(shB + 0.01, NPC_CROWN - (crownA - neckA) * hs),
          neckSlope = (neckB - shB) / Math.max(1e-3, neckA - shA),
          forward = B[3].o[0] - A[3].o[0];
        return {
          y: (h) => (h <= hipA ? h + hipB - hipA : h <= shA ? hipB + (h - hipA) * r : h <= neckA ? shB + (h - shA) * neckSlope : neckB + (h - neckA) * hs),
          slope: (h) => (h <= hipA ? 1 : h <= shA ? r : h <= neckA ? neckSlope : hs),
          k: (h) => 1 + (hs - 1) * Math.max(0, Math.min(1, (h - shA) / Math.max(1e-3, neckA - shA))),
          dx: (h) => forward * Math.max(0, Math.min(1, (h - hipA) / (shA - hipA))),
          centre: [A[2].o[0], A[2].o[2]],
        };
      }
      // The crown in bind space (metres, at look height 1): the player's PB_ASSET_CROWN.
      const NPC_CROWN = 1.81;
      /* How much a child avatar is scaled so its crown (the head page's top) stands at NPC_CROWN. */
      function npcChildGrow(asset, entry, arrays) {
        let crown = 0;
        for (let v = 0; v < entry.vertices; v++) if (arrays.material[v] === 1) crown = Math.max(crown, arrays.position[v * 3 + 1] / asset.header.scale);
        return crown > 0.5 ? NPC_CROWN / crown : 1;
      }
      /** One avatar's fit: { bones, width, female, attributes, index, vertices, triangles } (bind space in rig units). */
      function npcAvatarFitOne(asset, i) {
        const entry = asset.header.avatars[i],
          arrays = npcAvatarArrays(asset, entry),
          female = entry.sex === 'f',
          sex = female ? 1 : 0,
          // A child is fitted at an adult's stature (the crown at NPC_CROWN), keeping a child's head and build: the crowd
          // draws children at their look's height (0.64), so the child comes out a child, never a small adult.
          grow = entry.kid ? npcChildGrow(asset, entry, arrays) : 1,
          A = grow === 1 ? entry.bones : entry.bones.map((b) => ({ o: b.o.map((v) => v * grow), R: b.R })),
          hands = grow === 1 ? entry.hands : entry.hands.map((side) => side.map((chain) => chain.map((p) => p.map((v) => v * grow)))),
          // The rig's shoulders on the avatar's.
          width = Math.abs(A[4].o[2] - A[3].o[2]) / 2 / PB_RIG_M(RIG.shoulderZ[sex]),
          B = pbBindSkeleton(width, female),
          n = entry.vertices,
          scale = grow / asset.header.scale,
          P0 = arrays.position,
          SK = arrays.skin,
          len = (o, p) => Math.hypot(p[0] - o[0], p[1] - o[1], p[2] - o[2]);
        let lowest = 9,
          crownA = -9;
        for (let v = 0; v < n; v++) {
          lowest = Math.min(lowest, P0[v * 3 + 1] * scale);
          // The head page's top (hair or scalp; a hat or helmet is another material).
          if (arrays.material[v] === 1) crownA = Math.max(crownA, P0[v * 3 + 1] * scale);
        }
        const trunk = npcAvatarTrunk(B, A, crownA);
        const lift = A[13].o[1] - lowest + PB_SOLE,
          maps = [];
        for (const side of [0, 1]) {
          maps[3 + side] = pbAssetLimb(B, A, 3 + side, PB_RIG_M(RIG.upperArm) / len(A[3 + side].o, A[5 + side].o));
          maps[5 + side] = pbAssetLimb(B, A, 5 + side, PB_RIG_M(RIG.forearm) / len(A[5 + side].o, A[7 + side].o));
          maps[7 + side] = pbAssetLimb(B, A, 7 + side, 1);
          maps[9 + side] = pbAssetLimb(B, A, 9 + side, PB_RIG_M(RIG.thigh) / len(A[9 + side].o, A[11 + side].o));
          maps[11 + side] = pbAssetLimb(B, A, 11 + side, (PB_RIG_M(RIG.shin) - lift) / len(A[11 + side].o, A[13 + side].o));
          maps[13 + side] = pbAssetLimb(B, A, 13 + side, 1, lift);
        }
        const through = (b, p, nv, outP, outN) => {
          if (b <= 2) {
            const h = p[1],
              k = trunk.k(h),
              s = trunk.slope(h);
            outP[0] = trunk.centre[0] + (p[0] - trunk.centre[0]) * k + trunk.dx(h);
            outP[1] = trunk.y(h);
            outP[2] = trunk.centre[1] + (p[2] - trunk.centre[1]) * k;
            outN[0] = nv[0] / k;
            outN[1] = nv[1] / s;
            outN[2] = nv[2] / k;
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
          zone = new Float32Array(n),
          uv = new Float32Array(n * 2),
          p = [0, 0, 0],
          nv = [0, 0, 0],
          pa = [0, 0, 0],
          na = [0, 0, 0],
          pb = [0, 0, 0],
          nb = [0, 0, 0];
        for (let v = 0; v < n; v++) {
          for (let k = 0; k < 3; k++) {
            p[k] = P0[v * 3 + k] * scale;
            nv[k] = arrays.normal[v * 3 + k] / 127;
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
          zone[v] = arrays.material[v];
          uv[v * 2] = arrays.uv[v * 2] / 65535;
          uv[v * 2 + 1] = arrays.uv[v * 2 + 1] / 65535;
          for (let k = 0; k < 3; k++) grip[v * 4 + k] = position[v * 3 + k];
        }
        gripN.set(normal);
        pbAssetHands(B, A, hands, arrays.hand, SK, n, position, normal, grip, gripN, null, null);
        // Rig units; the gripping hand keeps three numbers a vertex.
        const grip3 = new Float32Array(n * 3);
        for (let v = 0; v < n; v++)
          for (let k = 0; k < 3; k++) {
            position[v * 3 + k] *= PB_UNITS;
            grip3[v * 3 + k] = grip[v * 4 + k] * PB_UNITS;
          }
        return {
          bones: B,
          width,
          female,
          grow,
          attributes: { position, normal, npcSkin: skin, npcGrip: grip3, npcZone: zone, npcUv: uv },
          index: Uint16Array.from(arrays.index),
          indexMid: Uint16Array.from(arrays.indexMid),
          vertices: n,
          triangles: entry.triangles,
          trianglesMid: entry.trianglesMid,
        };
      }
