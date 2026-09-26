      // MONARCH ONE in 3D: the supertall (a quarter-turn twist, balcony bands, sky gardens, LED crown, mast) and its grounds, gate arm, pool deck and cove.
      /* THE TOWER (buildIsleTower hands it here): a double-height glass lobby
         behind white stone piers; a softened square shaft that turns a quarter
         turn and tapers a tenth on its way up 74 storeys; a white balcony band
         every other floor; two sky gardens (recessed, planted, lit) at a third
         and two thirds; a lit glass crown, the helipad and a mast with a beacon.
         THE GROUNDS (buildMonarchOneEstate): everything MONARCH_ONE plans, in the
         island's kit (monarch3d.js); the gate arm is live (updateMonarchOneVisuals). */
      function buildMonarchOneTower(t) {
        const b = t.building,
          group = new Three.Group();
        group.position.set(b.x, 0, b.y);
        scene.add(group);
        batchGroups.push(group);
        statics.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, group, radius: Math.max(b.w, b.h) + 80 });
        skySeed = 2024 + 7919;
        const T = { b, group, W: b.w, D: b.h, cx: b.w / 2, cz: b.h / 2, top: b.height, podium: 0 },
          H = b.height,
          glass = skyGlass('monarchOne', b),
          white = skyStone,
          lobby = 9 * UNITS_PER_METRE,
          base = lobby + 3,
          floor = t.floor;
        // The lobby: glass behind white piers, a white cornice.
        box(group, T.cx, lobby / 2, T.cz, T.W - 8, lobby, T.D - 8, skyLobby);
        for (let x = 6; x <= T.W - 6; x += (T.W - 12) / 7) {
          box(group, x, lobby / 2, T.D - 3, 3.4, lobby, 4, white);
          box(group, x, lobby / 2, 3, 3.4, lobby, 4, white);
        }
        for (let z = 6; z <= T.D - 6; z += (T.D - 12) / 7) {
          box(group, 3, lobby / 2, z, 4, lobby, 3.4, white);
          box(group, T.W - 3, lobby / 2, z, 4, lobby, 3.4, white);
        }
        box(group, T.cx, lobby + 1.5, T.cz, T.W + 2, 3, T.D + 2, white);
        // The revolving door on the south face, under the porte-cochère.
        mesh(new Three.CylinderGeometry(7, 7, 20, 20, 1, true), skyLobby, group, T.cx, 10, T.D + 2);
        box(group, T.cx, 20.6, T.D + 2, 16, 1.2, 16, white);
        // The shaft.
        const shape = (u) => ({ r: u * (Math.PI / 2), s: 1 - 0.1 * u - 0.03 * Math.sin(u * Math.PI) }),
          at = (y) => shape(clamp((y - base) / (H - base), 0, 1)),
          steps = 32,
          sections = [];
        for (let k = 0; k <= steps; k++) {
          const u = k / steps;
          sections.push({ y: base + (H - base) * u, ...shape(u) });
        }
        const plan0 = planSuper(1, 1, 3.4, 48),
          plan = scalePlan(plan0, fitScale(plan0, sections, T.W / 2 - 6, T.D / 2 - 6));
        skyLoft(T, plan, sections, glass);
        const gardens = [1 / 3, 2 / 3].map((f) => base + (H - base) * f);
        for (let y = base + floor * 2; y < H - floor * 2; y += floor * 2) {
          if (gardens.some((g) => Math.abs(y - g) < floor * 1.6)) continue;
          skyBand(T, plan, at(y), y - 0.9, y + 0.6, 2.6, white);
        }
        // Sky gardens: two storeys set back behind a glass rail, trees and a lit soffit.
        const leaf = tint('#3f6536', 'matte');
        for (const g of gardens) {
          skyBand(T, plan, at(g), g - floor, g + floor, 0.4, skyCore);
          skyBand(T, plan, at(g), g - floor - 1, g - floor + 0.6, 3.4, white);
          skyBand(T, plan, at(g), g + floor - 0.6, g + floor + 1, 3.4, white);
          skyBand(T, plan, at(g), g + floor - 1.6, g + floor - 0.8, 0.8, skyLed('#ffe2b0', 1.6));
          const sec = at(g),
            q = { x: 0, z: 0 };
          for (let i = 0; i < plan.length; i += 4) {
            const p = plan[i],
              c = Math.cos(sec.r),
              s = Math.sin(sec.r);
            q.x = (p.x * c - p.z * s) * sec.s * 0.93;
            q.z = (p.x * s + p.z * c) * sec.s * 0.93;
            mesh(sphereGeo, leaf, group, T.cx + q.x, g - floor + 7, T.cz + q.z, 5, 5, 5);
          }
        }
        // The crown: a lit glass balustrade round the roof, an LED line, the pad, the mast.
        const top = shape(1);
        skyBand(T, plan, top, H, H + 3 * UNITS_PER_METRE, 0.6, skyLed('#9fe0ff', 1.4, true));
        skyBand(T, plan, top, H - 4, H + 1, 1.6, skyLed('#9fe0ff', 3.2, true));
        skyBand(T, plan, at((base + H) / 2), (base + H) / 2 - 2, (base + H) / 2 + 2, 1.6, skyLed('#9fe0ff', 2.2, true));
        if (b.helipad) roofHelipad(group, b, H);
        const mx = T.cx + 44,
          mz = T.cz - 44,
          spire = t.spire || 0;
        box(group, mx, H + 4, mz, 10, 8, 10, skySteel);
        mesh(new Three.CylinderGeometry(0.9, 3.4, spire, 10), skySteel, group, mx, H + 8 + spire / 2, mz);
        for (let y = H + 60; y < H + spire; y += 60) mesh(new Three.CylinderGeometry(4.4, 4.4, 1.2, 12), skySteel, group, mx, y, mz);
        skyBeacon(T, mx, H + 10 + spire, mz, 0.6);
        T.top = H + 12 + spire;
        b.crownHeight = Math.max(0, T.top - H);
        allBuildings.push({ b, group, height: T.top, materials: [skyGlassMaterials.get('monarchOne')] });
      }
      /* ---- The grounds -------------------------------------------------------------- */
      let monarchOneArm = null;
      function buildMonarchOneEstate() {
        const M = MONARCH_ONE,
          C = M.canopy,
          stone = ISLE.stone,
          setts = tint('#b8b1a2', 'matte'),
          travertine = tint('#e8e0cc', 'matte'),
          canvasW = ISLE.canvas;
        // The walls: a limestone plinth and coping, iron railings between piers, a
        // clipped hedge inside.
        for (const w of M.walls || []) {
          const along = w.w > w.h,
            len = along ? w.w : w.h,
            cx = w.x + w.w / 2,
            cz = w.y + w.h / 2,
            root = isleRoot(cx, cz);
          void root;
          for (let d = 0; d < len; d += 400) {
            const part = Math.min(400, len - d),
              px = along ? w.x + d + part / 2 : cx,
              pz = along ? cz : w.y + d + part / 2,
              r = isleRoot(px, pz);
            isleBox(px, 2.5, pz, along ? part : w.w + 1, 5, along ? w.h + 1 : part, stone, r);
            isleBox(px, 13.6, pz, along ? part : 0.6, 0.7, along ? 0.6 : part, ISLE.iron, r);
            for (let k = 2; k < part; k += 3) isleBox(along ? w.x + d + k : cx, 9.3, along ? cz : w.y + d + k, 0.45, 8.6, 0.45, ISLE.iron, r);
            for (let k = 0; k <= part; k += 48) isleBox(along ? w.x + d + k : cx, 8, along ? cz : w.y + d + k, 5, 16, 5, stone, r);
            // The hedge on the grounds' side (north of the south wall, east of the west wall).
            isleBox(along ? px : cx + 6, 8, along ? cz - 6 : pz, along ? part : 7, 16, along ? 7 : part, ISLE.hedge, r);
          }
        }
        // The gate: tall limestone piers with gilded finials and lanterns, the
        // pedestrian gate's iron leaf standing open, the gatehouse.
        for (const p of M.piers || []) {
          const x = p.x + p.w / 2,
            z = p.y + p.h / 2,
            root = isleRoot(x, z);
          isleBox(x, 17, z, p.w, 34, p.h, stone, root);
          isleBox(x, 34.6, z, p.w + 2, 1.2, p.h + 2, ISLE.stoneDark, root);
          isleMesh(sphereGeo, ISLE.gold, x, 38.5, z, 3.2, 3.2, 3.2, root);
          isleBox(x, 26, z + p.h / 2 + 1.5, 3, 4, 3, ISLE.iron, root);
          addGlow(x, 26, z + p.h / 2 + 3, 9, '#ffd9a0', 1, { day: 0 });
          isleLightPools.push({ x, y: z + 12, r: 60, color: [255, 214, 160], strength: 0.4 });
        }
        const g = M.gate,
          gateRoot = isleRoot(g.x, g.y);
        const footLeaf = isleBox(g.foot.x - g.foot.half + 1, 9, g.y - 8, 1, 16, 18, ISLE.iron, gateRoot);
        footLeaf.rotation.y = 0.2;
        // The name, in gilt letters on a stone plaque on the gatehouse's street face.
        const H = M.gatehouse,
          hx = H.x + H.w / 2,
          hz = H.y + H.h / 2,
          hr = isleRoot(hx, hz),
          hh = 3.6 * UNITS_PER_METRE;
        isleBox(hx, hh / 2, hz, H.w, hh, H.h, ISLE.white, hr);
        isleBox(hx, hh / 2 + 2, H.y + H.h + 0.2, H.w - 8, hh - 10, 0.6, ISLE.glass, hr);
        isleBox(hx, hh + 1.2, hz, H.w + 8, 2.4, H.h + 8, ISLE.white, hr);
        isleBox(hx, hh + 2.6, hz, H.w + 8.4, 0.6, H.h + 8.4, ISLE.gold, hr);
        addGlow(hx, hh / 2, H.y + H.h + 2, 16, '#ffe2b0', 0.5, { day: 0 });
        atlasSign(hr, towerNameCell(M.name), hx - 1, hh - 7, H.y + H.h + 0.8, 30, 30 / 8, neonCutout);
        // The barrier arm: live, pivoting on the gatehouse side (updateMonarchOneVisuals).
        {
          const pivot = new Three.Group(),
            len = g.half * 2 - 4;
          pivot.position.set(g.x + g.half - 2, 9, g.armY);
          pivot.userData.dynamic = true;
          scene.add(pivot);
          statics.push({ x: g.x, y: g.armY, group: pivot, radius: 80 });
          box(pivot, -len / 2, 0, 0, len, 1.6, 1.4, ISLE.black);
          for (let k = 0; k < 5; k++) box(pivot, -6 - k * (len / 5.2), 0, 0, 3, 1.7, 1.5, ISLE.gold);
          box(pivot, 2, -4.5, 0, 5, 9, 5, ISLE.black);
          monarchOneArm = pivot;
        }
        // Bollard lights down both sides of the drive.
        for (let k = 1; k < M.drive.length; k++) {
          const [ax, ay] = M.drive[k - 1],
            [bx, by] = M.drive[k],
            len = Math.hypot(bx - ax, by - ay);
          for (let d = 0; d < len; d += 36)
            for (const side of [-1, 1]) {
              const ux = (bx - ax) / len,
                uy = (by - ay) / len,
                x = ax + ux * d - uy * side * 27,
                z = ay + uy * d + ux * side * 27;
              if (Math.abs(z - M.wall.y) < 20) continue;
              isleBox(x, 2, z, 1.6, 4, 1.6, ISLE.iron, isleRoot(x, z));
              addGlow(x, 3.6, z, 5, '#ffe2b0', 0.7, { day: 0 });
            }
        }
        // The porte-cochère: a thin white canopy with a gold fascia and the name,
        // downlights in its soffit, two slim columns at the outer corners.
        {
          const cx = C.x + C.w / 2,
            cz = C.y + C.h / 2,
            root = isleRoot(cx, cz),
            y = C.height;
          isleBox(cx, y + 1.5, cz, C.w, 3, C.h, ISLE.white, root);
          isleBox(cx, y - 0.2, cz, C.w - 4, 0.4, C.h - 4, tint('#f6f1e2', 'matte'), root);
          isleBox(cx, y + 1.5, C.y + C.h + 0.4, C.w + 0.8, 3.6, 0.8, ISLE.gold, root);
          atlasSign(root, towerNameCell(M.name), cx, y + 7, C.y + C.h - 2, 64, 8, neonCutout);
          isleBox(cx, y + 7, C.y + C.h - 2.6, 68, 9, 0.6, ISLE.white, root);
          for (const c of M.columns || []) isleMesh(cylinderGeo, ISLE.white, c.x, y / 2, c.y, 2.6, y, 2.6, root);
          for (let x = C.x + 16; x < C.x + C.w; x += 28)
            for (let z = C.y + 14; z < C.y + C.h; z += 26) addGlow(x, y - 1, z, 10, '#fff1d6', 0.6, { day: 0 });
          for (let x = C.x + 20; x < C.x + C.w; x += 40) isleLightPools.push({ x, y: cz, r: 50, color: [255, 236, 200], strength: 0.4 });
          signSpill(cx, cz + 50, 80, '#ffe6b0', 0.4);
        }
        // The turning circle's fountain.
        buildIsleFountain({ x: M.loop.x, y: M.loop.y, island: M.loop.island });
        // The formal garden: box edging round the four parterres, a stone urn in the middle.
        {
          const L = M.lawn,
            root = isleRoot(L.x + L.w / 2, L.y + L.h / 2);
          for (const [u, v] of [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ]) {
            const x = L.x + 14 + u * (L.w / 2),
              z = L.y + 14 + v * (L.h / 2),
              w = L.w / 2 - 28,
              h = L.h / 2 - 28;
            for (const [bx, bz, bw, bh] of [
              [x + w / 2, z, w, 3],
              [x + w / 2, z + h, w, 3],
              [x, z + h / 2, 3, h],
              [x + w, z + h / 2, 3, h],
            ])
              isleBox(bx, 1.5, bz, bw, 3, bh, ISLE.hedgeDark, root);
            isleMesh(new Three.ConeGeometry(4, 12, 10), ISLE.hedge, x + w / 2, 6, z + h / 2, 1, 1, 1, root);
          }
          isleMesh(new Three.CylinderGeometry(4, 6, 8, 16), stone, L.x + L.w / 2, 4, L.y + L.h / 2, 1, 1, 1, root);
          isleMesh(new Three.SphereGeometry(5, 12, 8, 0, TAU, 0, Math.PI / 2), stone, L.x + L.w / 2, 8, L.y + L.h / 2, 1, 1, 1, root);
        }
        // The pool deck: travertine, the infinity pool with its vanishing north edge,
        // loungers and parasols, the bar, a glass balustrade and the steps to the sand.
        {
          const D = M.deck,
            P = M.pool,
            root = isleRoot(D.x + D.w / 2, D.y + D.h / 2);
          isleBox(D.x + D.w / 2, 0.5, D.y + D.h / 2, D.w, 1, D.h, travertine, root);
          isleBox(P.x + P.w / 2, 1.1, P.y + P.h / 2, P.w + 6, 0.4, P.h + 6, tint('#f4f1e8', 'matte'), root);
          isleBox(P.x + P.w / 2, 1.2, P.y + P.h / 2, P.w, 0.5, P.h, ISLE.water, root);
          isleBox(P.x + P.w / 2, 0.8, P.y - 3, P.w, 1.6, 2, tint('#2f6f86', 'gloss'), root);
          for (let x = P.x + 8; x < P.x + P.w; x += 36) {
            addGlow(x, 1.4, P.y + P.h / 2, 12, '#7fe0ff', 0.7, { day: 0 });
            isleLightPools.push({ x, y: P.y + P.h / 2, r: 30, color: [127, 224, 255], strength: 0.3 });
          }
          const colours = ['#f2f0ea', '#1c2a44'];
          let k = 0;
          for (let x = P.x + 14; x < P.x + P.w - 6; x += 30) {
            lounger(root, x, P.y + P.h + 26, 1.2, 14, 6, tint(colours[k % 2], 'matte'), ISLE.teak).rotation.y = Math.PI / 2;
            if (k++ % 2) {
              isleMesh(cylinderGeo, ISLE.teak, x + 15, 10, P.y + P.h + 28, 0.4, 18, 0.4, root);
              isleMesh(new Three.ConeGeometry(13, 4.4, 10), canvasW, x + 15, 19.5, P.y + P.h + 28, 1, 1, 1, root);
            }
          }
          const B = M.poolBar,
            bx = B.x + B.w / 2,
            bz = B.y + B.h / 2;
          isleBox(bx, 5, bz, B.w, 10, B.h, ISLE.teak, root);
          isleBox(bx, 10.4, bz, B.w + 2, 0.8, B.h + 2, stone, root);
          for (const dx of [-B.w / 2 - 6, B.w / 2 + 6]) for (const dz of [-B.h / 2, B.h / 2]) isleBox(bx + dx, 13, bz + dz, 1, 26, 1, ISLE.teak, root);
          isleBox(bx, 26.5, bz, B.w + 16, 1.2, B.h + 8, canvasW, root);
          addGlow(bx, 22, bz, 18, '#ffd9a0', 0.8, { day: 0 });
          for (const [x0, x1] of [
            [D.x, M.steps.x],
            [M.steps.x + M.steps.w, D.x + D.w],
          ]) {
            isleBox((x0 + x1) / 2, 4.5, D.y, x1 - x0, 7, 0.4, ISLE.glassRail, root);
            isleBox((x0 + x1) / 2, 8.2, D.y, x1 - x0, 0.6, 1, ISLE.chrome, root);
          }
          for (let k2 = 0; k2 < 4; k2++) isleBox(M.steps.x + M.steps.w / 2, 0.8 - k2 * 0.2, D.y - 4 - k2 * 5, M.steps.w, 1.6 - k2 * 0.4, 5, stone, root);
        }
        // The cove: two rows of loungers under parasols, the cabanas, the jetty
        // with its lamps and a ladder, the attendant's stand.
        {
          const V = M.cove,
            root = isleRoot(V.x + V.w / 2, V.y + V.h / 2),
            navy = tint('#1c2a44', 'matte');
          for (const row of [-5090, -5122])
            for (let x = V.x + 30; x < V.x + V.w - 30; x += 40) {
              if (Math.abs(x - (M.jetty.x + M.jetty.w / 2)) < 30 || !landAt(x, row - 16)) continue;
              for (const dx of [-8, 8]) lounger(root, x + dx, row, 0.4, 14, 6, dx < 0 ? canvasW : navy, ISLE.teak).rotation.y = Math.PI / 2;
              isleMesh(cylinderGeo, ISLE.teak, x, 9, row - 4, 0.4, 18, 0.4, root);
              isleMesh(new Three.ConeGeometry(14, 4.4, 12), row === -5090 ? canvasW : navy, x, 18.5, row - 4, 1, 1, 1, root);
            }
          for (const c of M.cabanas) {
            const cx = c.x + c.w / 2,
              cz = c.y + c.h / 2;
            for (const dx of [-9, 9]) for (const dz of [-9, 9]) isleBox(cx + dx, 11, cz + dz, 0.8, 22, 0.8, ISLE.white, root);
            isleBox(cx, 22.4, cz, c.w + 2, 0.8, c.h + 2, canvasW, root);
            isleBox(cx, 12, c.y + 0.2, c.w, 18, 0.3, canvasW, root);
            isleBox(cx, 1.6, cz, 14, 2, 10, navy, root);
          }
          const J = M.jetty,
            jx = J.x + J.w / 2;
          isleBox(jx, 3.2, J.y + J.h / 2, J.w, 1.2, J.h, ISLE.teak, root);
          for (let z = J.y + 6; z < J.y + J.h; z += 24)
            for (const s of [-1, 1]) isleMesh(cylinderGeo, ISLE.teak, jx + s * (J.w / 2 - 1), -2, z, 1.2, 10, 1.2, root);
          for (let z = J.y + 20; z < J.y + J.h - 30; z += 48) {
            isleMesh(cylinderGeo, ISLE.iron, jx + J.w / 2 - 1.5, 8, z, 0.4, 10, 0.4, root);
            addGlow(jx + J.w / 2 - 1.5, 13.5, z, 7, '#ffd9a0', 0.8, { day: 0 });
            isleLightPools.push({ x: jx, y: z, r: 34, color: [255, 214, 160], strength: 0.35 });
          }
          for (const s of [-1, 1]) isleBox(jx + s * 3, 1, J.y + 2, 0.6, 8, 0.6, ISLE.chrome, root);
          const ax = J.x - 40,
            az = J.y + J.h + 10;
          for (const dx of [-3, 3]) isleBox(ax + dx, 7, az, 0.8, 14, 0.8, ISLE.white, root);
          isleBox(ax, 14, az, 9, 0.8, 7, ISLE.white, root);
          isleMesh(cylinderGeo, ISLE.white, ax + 5, 20, az, 0.3, 20, 0.3, root);
          isleBox(ax + 8, 28, az, 6, 3.6, 0.2, navy, root);
        }
        // The tennis court.
        buildIsleCourt(M.court, isleRoot(M.court.x, M.court.y), 'hard');
      }
      /* Per frame: the arm follows MONARCH_ONE.gate.open (monarch-one.js). */
      function updateMonarchOneVisuals() {
        if (monarchOneArm) monarchOneArm.rotation.z = -MONARCH_ONE.gate.open * 1.45;
      }
