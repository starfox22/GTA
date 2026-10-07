      // Crowd 3D gore: what the rig draws of gore.js's state: lost parts left out, a ragged stump (torn cloth and
      // skin, raw flesh, the bone) at each cut, severed pieces in their owner's clothes, wounds soaking the clothes.
      /**
       * GORE ON THE RIG (renderer only; gore.js owns the state)
       * - drawCrowdPerson leaves out what `p.goreLost` says is gone (goreKeeps) and draws a stump at the cut's
       *   joint (goreStumpAt): the neck, a shoulder, an elbow, a hip or a knee. The stump is one instanced part
       *   (`P.stump`, the rig's body material and paint: no new program): a short ragged sleeve in the lost
       *   part's own colour, a thin skin edge, the raw flesh of the cut, lumps of torn tissue and the bone.
       * - Severed pieces (gore-props.js `severedParts`) are the owner's own parts at the piece's pose, with a
       *   stump at their cut end (drawSeveredParts, from updateCrowd3D); the owner's look is the one their
       *   last draw used (`s.goreLook`).
       * - Wounds (`p.goreWounds`): before each body part is packed, goreWoundFor sets the `crowdWound`
       *   instance value (character-rig3d.js PAINT SHADER WOUNDS): the entry point in the part's own
       *   space, the stain's reach growing over its first seconds, and whether the far side (the exit) soaks
       *   too. People with no wounds write zeros (no lookup).
       * - Gore events (bone chips and a dark mist at a cut) go to the effect pool (fx3d-recipes.js fxBit,
       *   fxPuff) with fxRandom.
       */
      function goreStumpGeometry() {
        const n = 14,
          positions = [],
          regions = [],
          index = [];
        let seed = 4242;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
          jag = Array.from({ length: n }, () => rnd()),
          // y, radius, region, how ragged: the sleeve's cut end tears unevenly; the flesh inside bulges.
          rings = [
            [0.06, 1.0, 0, 0],
            [-0.14, 0.99, 0, 0],
            [-0.28, 0.97, 0, 1],
            [-0.31, 0.92, 3, 1],
            [-0.36, 0.8, 1, 0.7],
            [-0.43, 0.55, 1, 0.9],
            [-0.47, 0.24, 1, 0.6],
          ];
        for (const [y, r, region, ragged] of rings)
          for (let k = 0; k < n; k++) {
            const th = (k / n) * TAU,
              rr = r * (1 + (jag[k] - 0.5) * 0.18 * ragged),
              yy = y + (jag[(k * 5 + 3) % n] - 0.5) * 0.24 * ragged;
            positions.push(Math.cos(th) * rr, yy, Math.sin(th) * rr);
            regions.push(region);
          }
        const centre = positions.length / 3;
        positions.push(0, -0.45, 0);
        regions.push(1);
        // Faces, each turned to face out (the band away from the axis, the cap downwards).
        const tri = (a, b, c, ox, oy, oz) => {
          const P = positions,
            ux = P[b * 3] - P[a * 3],
            uy = P[b * 3 + 1] - P[a * 3 + 1],
            uz = P[b * 3 + 2] - P[a * 3 + 2],
            vx = P[c * 3] - P[a * 3],
            vy = P[c * 3 + 1] - P[a * 3 + 1],
            vz = P[c * 3 + 2] - P[a * 3 + 2],
            nx = uy * vz - uz * vy,
            ny = uz * vx - ux * vz,
            nz = ux * vy - uy * vx;
          if (nx * ox + ny * oy + nz * oz >= 0) index.push(a, b, c);
          else index.push(a, c, b);
        };
        for (let i = 0; i < rings.length - 1; i++)
          for (let k = 0; k < n; k++) {
            const a = i * n + k,
              b = i * n + ((k + 1) % n),
              th = ((k + 0.5) / n) * TAU,
              // The sleeve faces out; past the torn edge the flesh faces down out of the cut.
              out = i < 3 ? [Math.cos(th), 0, Math.sin(th)] : [Math.cos(th) * 0.3, -1, Math.sin(th) * 0.3];
            tri(a, b, a + n, ...out);
            tri(b, b + n, a + n, ...out);
          }
        const last = (rings.length - 1) * n;
        for (let k = 0; k < n; k++) tri(centre, last + k, last + ((k + 1) % n), 0, -1, 0);
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        g.setAttribute('crowdRegion', new Three.Float32BufferAttribute(regions, 1));
        g.setIndex(index);
        g.computeVertexNormals();
        // Torn tissue round the cut and the bone standing out of it, a little off the axis.
        const lumps = [];
        for (let i = 0; i < 6; i++) {
          const th = rnd() * TAU,
            d = 0.35 + rnd() * 0.4;
          lumps.push(rigBall(0.12 + rnd() * 0.1, 0.08 + rnd() * 0.08, 0.12 + rnd() * 0.1, 1, Math.cos(th) * d, -0.42 - rnd() * 0.06, Math.sin(th) * d, 6, 4));
        }
        const bone = rigPlace(rigRegion(new Three.CylinderGeometry(0.16, 0.21, 0.42, 7, 1), 2), 0.07, -0.55, 0.04, 0.12, 0, 0.08);
        return rigMerge([g, bone, ...lumps]);
      }
      P.stump = rigPart('stump', goreStumpGeometry(), rigSkinMaterial, 96, true);
      const GORE_FLESH = packColor('#5a0b10'),
        GORE_BONE = packColor('#d8cdb8'),
        // Regions: 0 the torn sleeve or skin (slot A), 1 flesh (B), 2 bone (C), 3 the skin's cut edge (D: the skin).
        GORE_STUMP_MASK = 0 + 1 * 4 + 2 * 16 + 3 * 64,
        goreStumpPaint = new Float32Array(6),
        goreStumpFrame = new Three.Matrix4(),
        goreBoneColor = new Three.Color('#d6cbb5'),
        goreMistColor = new Three.Color('#4a070b');
      /* A stump's paint from the paint of the part that was there: its region-0 colour, its skin. */
      function goreStumpPaintFrom(paint, skinOnly) {
        const slot = (paint[4] | 0) & 3;
        goreStumpPaint[0] = skinOnly ? paint[3] : paint[slot];
        goreStumpPaint[1] = GORE_FLESH;
        goreStumpPaint[2] = GORE_BONE;
        goreStumpPaint[3] = paint[3];
        goreStumpPaint[4] = GORE_STUMP_MASK;
        goreStumpPaint[5] = 0;
        return goreStumpPaint;
      }
      /* A stump at a joint frame (the lost part hung from it along -y); `up` turns it to face +y (the neck,
         a severed piece's cut end, `lift` units up its own axis: past the part's domed top). `r` is the
         limb's radius there (part units). */
      function goreStumpAt(frame, r, paint, up = false, skinOnly = false, lift = 0) {
        if (up) crowdJoint(goreStumpFrame, frame, 0, lift, 0, Math.PI);
        else goreStumpFrame.copy(frame);
        rigEmit(P.stump, goreStumpFrame, r, r * 1.1, r, goreStumpPaintFrom(paint, skinOnly));
      }
      /* Whether part `bit` (or a whole limb holding it) is gone. */
      function goreGone(lost, bit) {
        return (lost & bit) !== 0;
      }
      /**
       * WOUNDS: the crowdWound value for one part of `p` (part: 0 head, 1 torso, 2 upper arm, 3 forearm,
       * 4 thigh, 5 shin; side 0 left, 1 right). xyz the entry in the part's space, w = 2 + the stain's reach
       * (+100 when the round went through: the far side soaks too); zeros when the part has no wound.
       */
      const rigWoundNow = new Float32Array(4);
      function goreWoundFor(p, part, side) {
        rigWoundNow[0] = rigWoundNow[1] = rigWoundNow[2] = rigWoundNow[3] = 0;
        const list = p.goreWounds;
        if (!list || !list.length) return;
        let best = null,
          bestSize = 0,
          h2 = 0;
        for (let i = 0; i < list.length; i++) {
          const w = list[i],
            zonePart = w.zone === 'head' ? 0 : w.zone === 'torso' ? 1 : w.zone === 'arm' ? (w.h < 0.5 ? 2 : 3) : w.zone === 'leg' ? (w.h < 0.5 ? 4 : 5) : -1;
          if (zonePart !== part || (part > 1 && w.side !== side)) continue;
          const grown = w.size * (0.45 + 0.55 * (1 - Math.exp(-(gameTime - w.t) / 10)));
          if (grown > bestSize) {
            best = w;
            bestSize = grown;
            h2 = part > 1 ? (w.h < 0.5 ? w.h * 2 : (w.h - 0.5) * 2) : w.h;
          }
        }
        if (!best) return;
        const c = Math.cos(best.rel),
          s = Math.sin(best.rel);
        let y, rx, rz, cap;
        if (part === 0) {
          y = 0.9 + h2 * 1.0;
          rx = 0.8;
          rz = 0.62;
          cap = 0.9;
        } else if (part === 1) {
          y = 0.3 + h2 * 2.7;
          rx = 0.95;
          rz = 1.35;
          cap = 2.4;
        } else if (part === 2) {
          y = -(0.3 + h2 * 1.9);
          rx = rz = 0.5;
          cap = 1.1;
        } else if (part === 3) {
          y = -(0.2 + h2 * 1.5);
          rx = rz = 0.33;
          cap = 0.8;
        } else if (part === 4) {
          y = -(0.4 + h2 * 2.6);
          rx = rz = 0.65;
          cap = 1.4;
        } else {
          y = -(0.4 + h2 * 2.6);
          rx = rz = 0.42;
          cap = 1.0;
        }
        rigWoundNow[0] = c * rx;
        rigWoundNow[1] = y;
        rigWoundNow[2] = s * rz;
        rigWoundNow[3] = 2 + Math.min(bestSize * 0.9, cap) + (best.exit ? 100 : 0);
      }
      function goreWoundClear() {
        rigWoundNow[0] = rigWoundNow[1] = rigWoundNow[2] = rigWoundNow[3] = 0;
      }
      /* Severed pieces in their owners' clothes (gore-props.js SEVERED PARTS). */
      const goreLookCache = new WeakMap(),
        goreJ = new Three.Matrix4(),
        goreK = new Three.Matrix4(),
        goreF = new Three.Matrix4();
      function drawSeveredParts() {
        const list = severedParts;
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (!entityInView(s, 20)) continue;
          const owner = s.owner,
            state = crowdState.get(owner);
          let look = state?.goreLook || goreLookCache.get(s);
          if (!look) look = owner.look || (owner === player || renderPeople.includes(owner) ? specialLook(owner) : ensureLook(owner));
          if (!look) continue;
          goreLookCache.set(s, look);
          const R = compiledLook(look, owner),
            H = R.height * RIG_UNIT,
            w = R.width,
            paints = R.paints;
          // The piece's centre, its heading and tilt, then its roll about its own length; the cut end is half a
          // piece up its local +y.
          crowdJoint(goreF, mIdentity, s.x, s.z, s.y, s.pitch, 0, -s.yaw);
          crowdJoint(goreK, goreF, 0, 0, 0, 0, 0, s.roll);
          crowdJoint(goreJ, goreK, 0, s.len * 0.5 * H, 0);
          goreJ.scale(crowdScale.set(H, H, H));
          goreWoundClear();
          const kind = s.kind;
          if (kind === 'forearm' || kind === 'arm') {
            let elbow = goreJ;
            if (kind === 'arm') {
              rigEmit(BODY_CLOSE.upperArm, goreJ, w, 1, w, paints.upperArm);
              crowdJoint(goreK, goreJ, 0, -RIG.upperArm, 0, 0.35);
              elbow = goreK;
            }
            rigEmit(BODY_CLOSE.forearm, elbow, w, 1, w, paints.forearm);
            crowdJoint(mOut, elbow, 0, -RIG.forearm, 0, 0.1);
            goreStumpFrame.copy(mOut);
            rigEmit(BODY_CLOSE.hand, goreStumpFrame, 1, 1, 1, paints.hand);
            goreStumpAt(goreJ, (kind === 'arm' ? 0.54 : 0.36) * w, kind === 'arm' ? paints.upperArm : paints.forearm, true, false, 0.24);
          } else {
            let knee = goreJ;
            if (kind === 'leg') {
              rigEmit(BODY_CLOSE[R.thigh], goreJ, w, 1, w, paints.thigh);
              crowdJoint(goreK, goreJ, 0, -RIG.thigh, 0, -0.12);
              knee = goreK;
            }
            rigEmit(BODY_CLOSE.shin, knee, w, 1, w, paints.shin);
            crowdJoint(mOut, knee, 0, -RIG.shin, 0, 0);
            goreStumpFrame.copy(mOut);
            rigEmit(BODY_CLOSE[R.shoePart], goreStumpFrame, 1, 1, 1, paints.shoe);
            goreStumpAt(goreJ, (kind === 'leg' ? 0.74 : 0.45) * w, kind === 'leg' ? paints.thigh : paints.shin, true, false, kind === 'leg' ? 0.5 : 0.3);
          }
        }
      }
      /* Bone chips and a dark mist at each new cut (gore.js goreEvents), into the effect pool. */
      let goreFxSeen = 0;
      function goreEffects() {
        if (goreEventCount <= goreFxSeen) return;
        for (let k = 0; k < goreEvents.length; k++) {
          const e = goreEvents[k];
          if (!e || e.id <= goreFxSeen || gameTime - e.t > 1) continue;
          const ground = terrainHeight(e.x, e.y),
            chips = e.head ? 14 : 8;
          for (let i = 0; i < chips; i++) {
            const dir = e.a + fxBetween(-0.9, 0.9),
              v = fxBetween(2, 7) * UNITS_PER_METRE;
            fxBit(e.x, e.z, e.y, Math.cos(dir) * v, fxBetween(1, 5) * UNITS_PER_METRE, Math.sin(dir) * v, fxBetween(0.8, 1.4), fxBetween(0.18, 0.4), goreBoneColor, 1, ground);
          }
          for (let i = 0; i < (e.head ? 4 : 2); i++)
            fxPuff(e.x, e.z, e.y, Math.cos(e.a) * fxBetween(4, 12), fxBetween(0, 3), Math.sin(e.a) * fxBetween(4, 12), fxBetween(0.5, 0.9), fxBetween(1.6, 2.6), 1.8, goreMistColor, 0.55, ground);
        }
        goreFxSeen = goreEventCount;
      }
