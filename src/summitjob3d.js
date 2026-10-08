      // BEGIN SUBSYSTEM: src/summitjob3d.js — Mission 3's cache at the top of Mount Ascent: the cairn, the hole as it is dug, the taped case
      /**
       * Mission 3 (High Ground) in 3D
       * Source: src/summitjob3d.js
       * Scope: createCityRenderer() closure.
       * Reads summitCacheView() (summitjob.js) only: a cairn of a dozen grey
       * stones with a strip of orange survey tape tied round a stake, the stones
       * lifted aside onto a pile as the dig goes on, a dark hole and a heap of
       * spoil growing beside it, and the case (black plastic, silver tape) once
       * the trowel finds it. Plain standard materials shared with the statics
       * (no new program); the group shows only while the job is live.
       */
      const summitCache = (() => {
        const group = new Three.Group();
        group.visible = false;
        group.userData.dynamic = true;
        scene.add(group);
        const stoneGeo = new Three.DodecahedronGeometry(1, 0),
          stoneMats = [mat('#7d7b74', 0.95), mat('#8e8a80', 0.95), mat('#66645e', 0.95)],
          // The cairn as Tommy left it: a ring of fist-to-head-sized stones, a second
          // course, a capstone. [x, z, y above ground, radius m, squash, where it goes when lifted].
          plan = [
            [-0.32, 0.0, 0.14, 0.2, 0.7, [0.95, 0.55]],
            [0.3, 0.06, 0.13, 0.19, 0.72, [1.1, 0.35]],
            [0.02, -0.33, 0.13, 0.2, 0.7, [1.25, 0.7]],
            [0.05, 0.34, 0.12, 0.18, 0.75, [0.85, 0.85]],
            [-0.22, -0.26, 0.12, 0.17, 0.7, [1.35, 0.45]],
            [0.24, -0.24, 0.12, 0.16, 0.72, [1.05, 0.95]],
            [-0.24, 0.27, 0.12, 0.16, 0.7, [1.4, 0.8]],
            [-0.1, 0.0, 0.36, 0.18, 0.7, [1.15, 0.6]],
            [0.15, 0.08, 0.35, 0.17, 0.72, [1.0, 0.7]],
            [0.0, -0.14, 0.38, 0.16, 0.75, [1.2, 0.9]],
            [0.02, 0.02, 0.58, 0.15, 0.8, [1.3, 0.62]],
          ],
          M = UNITS_PER_METRE,
          stones = plan.map((s, i) => {
            const mesh = new Three.Mesh(stoneGeo, stoneMats[i % 3]);
            mesh.scale.set(s[3] * M, s[3] * M * s[4], s[3] * M * (0.85 + (i % 3) * 0.1));
            mesh.rotation.set(i * 1.7, i * 2.3, i * 0.9);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            return mesh;
          });
        // The survey stake and its tape: how Tommy told Vinny he would find it again.
        const stake = new Three.Mesh(boxGeo, mat('#6b5236', 0.9));
        stake.scale.set(0.03 * M, 0.75 * M, 0.03 * M);
        stake.position.set(-0.55 * M, 0.37 * M, -0.2 * M);
        stake.rotation.z = 0.12;
        stake.castShadow = true;
        group.add(stake);
        const tape = new Three.Mesh(boxGeo, mat('#e2632a', 0.6));
        tape.scale.set(0.34 * M, 0.035 * M, 0.006 * M);
        tape.position.set(-0.4 * M, 0.66 * M, -0.2 * M);
        group.add(tape);
        // The hole: a dark patch that widens, ringed by disturbed grit; the spoil heap beside it.
        const hole = new Three.Mesh(new Three.CircleGeometry(1, 18), mat('#221d17', 1));
        hole.rotation.x = -Math.PI / 2;
        hole.position.y = 0.03 * M;
        group.add(hole);
        const grit = new Three.Mesh(new Three.RingGeometry(0.8, 1.3, 18), mat('#6d5e4b', 1));
        grit.rotation.x = -Math.PI / 2;
        grit.position.y = 0.02 * M;
        group.add(grit);
        const spoil = new Three.Mesh(new Three.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#5e5040', 1));
        spoil.position.set(-0.75 * M, 0, 0.45 * M);
        spoil.castShadow = true;
        spoil.receiveShadow = true;
        group.add(spoil);
        // The case: a small hard case wrapped in black plastic and silver duct tape.
        const caseGroup = new Three.Group(),
          wrap = new Three.Mesh(boxGeo, mat('#16181a', 0.35)),
          tapeMat = mat('#9ea3a6', 0.5, 0.2);
        wrap.scale.set(0.42 * M, 0.16 * M, 0.3 * M);
        wrap.castShadow = true;
        caseGroup.add(wrap);
        for (const x of [-0.12, 0.12]) {
          const band = new Three.Mesh(boxGeo, tapeMat);
          band.scale.set(0.05 * M, 0.165 * M, 0.305 * M);
          band.position.x = x * M;
          caseGroup.add(band);
        }
        const band = new Three.Mesh(boxGeo, tapeMat);
        band.scale.set(0.425 * M, 0.165 * M, 0.05 * M);
        caseGroup.add(band);
        caseGroup.rotation.y = 0.4;
        group.add(caseGroup);
        return { group, stones, plan, hole, grit, spoil, caseGroup, stake, tape };
      })();
      function updateSummitCacheVisuals() {
        const view = summitCacheView(),
          g = summitCache.group;
        g.visible = !!view;
        if (!view) return;
        const M = UNITS_PER_METRE;
        g.position.set(view.x, view.z, view.y);
        // The stones come off first (the first third of the dig), top course first, onto the pile.
        const lift = clamp(view.dig / 0.34, 0, 1);
        for (let i = 0; i < summitCache.stones.length; i++) {
          const s = summitCache.plan[i],
            order = (summitCache.stones.length - 1 - i) / summitCache.stones.length,
            t = clamp((lift - order * 0.8) / 0.2, 0, 1),
            mesh = summitCache.stones[i],
            px = s[0] + (s[5][0] - s[0]) * t,
            pz = s[1] + (s[5][1] - s[1]) * t,
            // A short arc as each stone is set down on the pile.
            py = s[2] * (1 - t) + 0.12 * t + Math.sin(t * Math.PI) * 0.25;
          mesh.position.set(px * M, py * M, pz * M);
        }
        const dug = clamp((view.dig - 0.2) / 0.8, 0, 1);
        summitCache.hole.visible = summitCache.grit.visible = dug > 0;
        summitCache.hole.scale.setScalar((0.12 + dug * 0.26) * M);
        summitCache.grit.scale.setScalar((0.12 + dug * 0.26) * M);
        summitCache.spoil.visible = dug > 0;
        summitCache.spoil.scale.set((0.12 + dug * 0.28) * M, (0.04 + dug * 0.16) * M, (0.1 + dug * 0.22) * M);
        // The case shows its top once the trowel has found it, and is gone once lifted out.
        summitCache.caseGroup.visible = view.dig > 0.62 && !view.taken;
        summitCache.caseGroup.position.set(0, (-0.06 + (view.dig - 0.62) * 0.15) * M, 0);
        // The tape stirs in the wind on the summit.
        summitCache.tape.rotation.y = Math.sin(gameTime * 3.1) * 0.35;
      }
      // END SUBSYSTEM: src/summitjob3d.js
