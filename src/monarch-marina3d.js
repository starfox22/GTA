      // BEGIN SUBSYSTEM: src/monarch-marina3d.js — Monarch Harbour in 3D
      /**
       * Monarch Harbour in 3D
       * Source: src/monarch-marina3d.js
       * Scope: createCityRenderer() closure (after monarch3d.js and marina3d.js).
       *
       * The basin's seven teak finger pontoons with power pedestals and cleats,
       * thirty-one moored yachts built by the Harbor Point builders
       * (MARINA_BUILDERS, marina3d.js) with their names and home port painted on
       * the transom, three superyachts of our own (buildIsleSuperyacht: a lofted
       * pearl hull, four to six decks of raked deckhouses, a helipad or a pool, a
       * tender), the fuel pontoon, the mole's armour stone and its lighthouse
       * (a banded white tower whose lantern sweeps a beam at night), the harbour
       * master's round tower with its lantern room and radar, and the yacht club
       * terrace. Everything merges into the island's cell roots (monarch3d.js).
       */
      function buildIsleMarina() {
        const m = MONARCH_MARINA,
          deck = 3.2;
        // ---- Pontoons ----
        for (const f of [...m.fingers, m.fuel]) {
          const cx = f.x + f.w / 2,
            cz = f.y + f.h / 2,
            root = isleRoot(cx, cz);
          isleBox(cx, deck - 0.5, cz, f.w, 1, f.h, ISLE.teak, root);
          isleBox(cx, deck - 2, cz, f.w - 1, 2.2, f.h - 1, tint('#d8dcd8', 'satin'), root);
          for (const s of [-1, 1]) isleBox(cx + s * (f.w / 2 - 0.4), deck - 0.3, cz, 0.8, 0.9, f.h, tint('#e9e9e4', 'satin'), root);
          // Power pedestals and cleats every 40, a lifebuoy near the head.
          for (let z = f.y + 30; z < f.y + f.h - 6; z += 40) {
            isleBox(cx, deck + 3, z, 2.4, 6, 2.4, ISLE.white, root);
            kitLight(isleLights, root, cx, deck + 6.4, z, '#e8f4ff');
            isleLightPools.push({ x: cx, y: z, r: 30, color: [228, 240, 255], strength: 0.25 });
            for (const s of [-1, 1]) isleBox(cx + s * (f.w / 2 - 1.6), deck + 0.5, z + 10, 1.2, 1, 3, ISLE.chrome, root);
          }
          // The gangway down from the quay.
          isleBox(cx, deck + 1.5, f.y - 6, f.w - 4, 1, 16, ISLE.chrome, root).rotation.x = 0.18;
        }
        // ---- Moored yachts (the Harbor Point builders) ----
        for (const berth of monarchBerths()) {
          const d = berth.design,
            root = isleRoot(berth.x, berth.y),
            g = new Three.Group();
          g.position.set(berth.x, 0, berth.y);
          g.rotation.y = -berth.a;
          root.add(g);
          const spec = MARINA_BUILDERS[d.type](g, d, isleLights),
            stern = -d.len / 2,
            transomZ = hullSheer(spec, -0.5),
            dark = ['#141619', '#152b44', '#1d3a30', '#1f3d5c', '#2d3339', '#2d5646', '#6e3620', '#7b3a20', '#86502c', '#b01e24', '#5c6770', '#1b1d21'].includes(d.hull);
          kitNameBoard(g, d.name, 'MONARCH ISLE', dark ? '#e6cf96' : '#1e2f45', Math.min(d.beam * 0.78, 30), stern - 0.6, Math.max(3, transomZ * 0.55), 0, -Math.PI / 2, d.type === 'launch' || d.type === 'commuter' || d.type === 'gulet');
          const toPontoon = -berth.side;
          for (const t of [-0.3, 0, 0.3]) fender(g, d.len * t, 4, toPontoon * (hullBeamAt(spec, d.len * t, 6) + 1.6), 1.6, '#1c2b3d');
        }
        // ---- Superyachts ----
        for (const s of MONARCH_SUPERYACHTS) buildIsleSuperyacht(s);
        // ---- The fuel pontoon's pumps and canopy ----
        {
          const f = m.fuel,
            cx = f.x + f.w / 2,
            root = isleRoot(cx, f.y);
          for (const z of [f.y + 30, f.y + 70]) {
            isleBox(cx, deck + 5, z, 3.6, 10, 5, tint('#0e2a3a', 'satin'), root);
            isleBox(cx, deck + 8, z + 2.6, 2.4, 3, 0.3, ISLE.glass, root);
          }
          isleBox(cx, deck + 18, f.y + 50, 22, 1.2, 80, ISLE.white, root);
          for (const z of [f.y + 14, f.y + 86]) isleBox(cx, deck + 9, z, 1.2, 18, 1.2, ISLE.chrome, root);
          kitLight(isleLights, root, cx, deck + 17, f.y + 50, '#f4f8ff');
          addGlow(cx, deck + 17, f.y + 50, 16, '#eaf4ff', 0.9, { day: 0 });
          isleLightPools.push({ x: cx, y: f.y + 50, r: 90, color: [228, 240, 255], strength: 0.45 });
        }
        // ---- The mole: armour stone both sides, flags on the walk ----
        {
          const M = m.mole;
          let seed = 3;
          const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
          for (let x = M.x0 + 10; x < M.x1; x += 14)
            for (const side of [-1, 1]) {
              const y = M.y + side * (M.half + 8 + rnd() * 6),
                r = isleBox(x + rnd() * 6, 0.5 + rnd() * 2, y, 9 + rnd() * 5, 6 + rnd() * 3, 8 + rnd() * 4, rnd() < 0.5 ? tint('#8f8c84', 'matte') : tint('#a19d93', 'matte'));
              r.rotation.set(rnd() * 0.5, rnd() * 3, rnd() * 0.4);
            }
          isleBox((M.x0 + M.x1) / 2, 6, M.y - M.half + 1, M.x1 - M.x0, 4, 3, ISLE.stone);
        }
        // ---- The lighthouse on the mole's tip ----
        {
          const L = m.lighthouse,
            root = isleRoot(L.x, L.y),
            height = 118;
          isleMesh(new Three.CylinderGeometry(L.r + 6, L.r + 8, 8, 20), ISLE.stone, L.x, 4, L.y, 1, 1, 1, root);
          for (let k = 0; k < 5; k++) {
            const y0 = 8 + (k * (height - 8)) / 5,
              y1 = 8 + ((k + 1) * (height - 8)) / 5,
              r0 = L.r - (k * 4) / 5,
              r1 = L.r - ((k + 1) * 4) / 5;
            isleMesh(new Three.CylinderGeometry(r1, r0, y1 - y0, 20), k % 2 ? tint('#c23a2e', 'satin') : ISLE.white, L.x, (y0 + y1) / 2, L.y, 1, 1, 1, root);
          }
          isleMesh(new Three.CylinderGeometry(L.r + 3, L.r + 1, 2, 20), ISLE.iron, L.x, height + 1, L.y, 1, 1, 1, root);
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * TAU;
            isleBox(L.x + Math.cos(a) * (L.r + 2.6), height + 4.5, L.y + Math.sin(a) * (L.r + 2.6), 0.4, 5, 0.4, ISLE.iron, root);
          }
          isleMesh(new Three.CylinderGeometry(7, 7, 12, 12, 1, true), ISLE.glass, L.x, height + 8, L.y, 1, 1, 1, root);
          isleMesh(new Three.ConeGeometry(9, 10, 12), tint('#c23a2e', 'satin'), L.x, height + 19, L.y, 1, 1, 1, root);
          addGlow(L.x, height + 8, L.y, 34, '#fff1c8', 2.4, { day: 0, mode: 'pulse' });
          isleLighthouse = { x: L.x, y: height + 8, z: L.y };
        }
        // ---- The harbour master's tower on Regency Point ----
        {
          const T = m.harbourMaster,
            root = isleRoot(T.x, T.y),
            height = 118;
          isleMesh(new Three.CylinderGeometry(T.r, T.r + 2, height, 24), ISLE.stone, T.x, height / 2, T.y, 1, 1, 1, root);
          for (let y = 30; y < height - 10; y += 30) isleMesh(new Three.CylinderGeometry(T.r + 0.8, T.r + 0.8, 1.6, 24), ISLE.stoneWarm, T.x, y, T.y, 1, 1, 1, root);
          isleMesh(new Three.CylinderGeometry(T.r + 5, T.r + 5, 2, 24), ISLE.white, T.x, height + 1, T.y, 1, 1, 1, root);
          isleMesh(new Three.CylinderGeometry(T.r + 2, T.r + 2, 14, 24, 1, true), ISLE.glass, T.x, height + 9, T.y, 1, 1, 1, root);
          isleMesh(new Three.CylinderGeometry(T.r + 4, T.r + 4, 2, 24), ISLE.white, T.x, height + 17, T.y, 1, 1, 1, root);
          isleMesh(cylinderGeo, ISLE.white, T.x, height + 30, T.y, 0.8, 26, 0.8, root);
          isleBox(T.x, height + 26, T.y, 14, 1, 1, ISLE.white, root);
          radarScanner(root, T.x, height + 18, T.y, 16);
          for (let k = 0; k < 8; k++) kitLight(isleLights, root, T.x + Math.cos((k * TAU) / 8) * (T.r + 2.4), height + 9, T.y + Math.sin((k * TAU) / 8) * (T.r + 2.4), '#ffe6b8');
          atlasSign(root, shopSignCell('HARBOUR MASTER'), T.x, 22, T.y + T.r + 0.6, 30, 7.5, neonBoard);
          addGlow(T.x, height + 42, T.y, 14, '#ff3020', 3, { mode: 'beacon', day: 0.3 });
        }
        // ---- The yacht club's terrace, flagpole and sign ----
        {
          const c = m.club,
            root = isleRoot(c.x + c.w / 2, c.y + c.h);
          const tz = c.y + c.h + 36;
          for (let k = 0; k < 5; k++) {
            const x = c.x + 22 + k * 36;
            table(root, x, tz, 0.4, 8, 8, ISLE.white, 4.6);
            isleMesh(cylinderGeo, ISLE.white, x, 9, tz, 0.4, 18, 0.4, root);
            isleMesh(new Three.ConeGeometry(10, 3.6, 8), tint('#1c2a44', 'matte'), x, 18, tz, 1, 1, 1, root);
          }
          isleMesh(cylinderGeo, ISLE.white, c.x + c.w + 20, 40, c.y + c.h + 20, 0.8, 80, 0.8, root);
          isleBox(c.x + c.w + 20, 70, c.y + c.h + 20, 26, 0.6, 0.6, ISLE.white, root);
          isleBox(c.x + c.w / 2, 30, c.y + c.h + 1.2, 60, 16, 1.4, ISLE.navy, root);
          atlasSign(root, shopSignCell('MONARCH YACHT CLUB'), c.x + c.w / 2, 30, c.y + c.h + 2.1, 56, 14, neonBoard);
          signSpill(c.x + c.w / 2, c.y + c.h + 14, 40, '#e8f0ff', 0.3);
          // Signal flags on halyards from the yard.
          const flags = ['#c8102e', '#ffd200', '#1d3f8f', '#ffffff', '#1f8a4c'];
          for (let k = 0; k < 5; k++) isleBox(c.x + c.w + 8 + k * 6, 66 - k * 5, c.y + c.h + 20, 4, 3, 0.2, tint(flags[k], 'matte'), root);
        }
      }
      let isleLighthouse = null,
        isleLighthouseBeam = null;
      /* A superyacht in her style: a lofted hull, deck upon deck of raked houses
         with black or blue glass bands, teak decks, a helipad or a pool on the
         foredeck, a tender on the aft deck, a mast with radar and domes. */
      function buildIsleSuperyacht(s) {
        const root = isleRoot(s.x, s.y),
          g = new Three.Group(),
          L = s.len,
          B = s.beam,
          dark = s.hull === '#16181b';
        g.position.set(s.x, 0, s.y);
        g.rotation.y = -s.a;
        root.add(g);
        const main = 30,
          deckH = 27,
          d = { len: L, beam: B, hull: s.hull, accent: s.accent },
          spec = yachtSpec(d, {
            draft: L * 0.05,
            sheer: [
              [-0.5, main - 4],
              [0.1, main],
              [0.5, main + 16],
            ],
            rake: s.style === 'explorer' ? 0.02 : 0.08,
            forefoot: s.style === 'explorer' ? 0.1 : 0.18,
            bilge: 2.2,
            flare: 0.28,
            finish: dark ? 'gloss' : 'pearl',
            form: { transom: 0.86, maxAt: -0.08, entry: s.style === 'sharp' ? 1.5 : 1.8, bowShape: 0.72 },
            colors: { boot: s.accent, bands: [[0.9, 0.94, s.accent]] },
          });
        hullMesh(g, spec);
        swimPlatform(g, spec, 6, 16);
        hullDeck(g, spec, main, -L * 0.5, L * 0.47, 2);
        hullWindows(g, spec, -L * 0.28, L * 0.26, 10, 17, 7);
        const glazing = s.style === 'sharp' ? kitBridgeGlass : kitGlass,
          paint = dark ? tint('#1d2024', 'gloss') : tint('#f6f6f2', 'gloss');
        for (let k = 0; k < s.decks; k++) {
          const z0 = main + k * deckH,
            aft = -L * (0.36 - k * 0.05),
            fwd = L * (0.22 - k * 0.045),
            hw = B * (0.45 - k * 0.035),
            nose = L * (0.14 - k * 0.012);
          deckhouse(g, deckOutline(aft, fwd, hw, nose, s.style === 'sharp' ? 1.3 : 1.9), z0, z0 + deckH - 2, { paint, glazing, rake: s.style === 'explorer' ? 4 : 14, glassFrom: 0.18, glassTo: 0.86 });
          const slab = deckOutline(aft - 14, fwd + 2, hw + 3, nose, s.style === 'sharp' ? 1.3 : 1.9);
          deckSlab(g, slab, z0 + deckH, 1.6, kitTeak, paint);
          railing(g, offsetOutline(slab, -1), z0 + deckH, 6, { closed: true, spacing: 10, glass: ISLE.glassRail });
          // Furniture on the aft end of every deck.
          sofa(g, aft - 8, 0, z0 + deckH, 7, hw * 1.2, 'aft', kitCushion, tint(s.accent, 'matte'));
          for (let k2 = 0; k2 < 3; k2++) kitLight(isleLights, g, aft + L * 0.1 * k2, z0 + deckH * 0.5, hw + 0.5, '#ffd49a');
        }
        const top = main + s.decks * deckH;
        // The sun deck: loungers, a hot tub, a mast with radar and domes.
        hotTub(g, -L * 0.06, 0, top, 7);
        for (const side of [-1, 1]) lounger(g, L * 0.02, side * B * 0.2, top, 12, 5.6);
        const mastU = L * 0.02 - s.decks * 4;
        box(g, mastU, top + 14, 0, 3, 28, 3, paint);
        box(g, mastU, top + 24, 0, 2.4, 2, B * 0.4, paint);
        radarScanner(g, mastU, top + 28, 0, 16);
        satDome(g, mastU - 10, top, B * 0.16, 4.2);
        satDome(g, mastU - 10, top, -B * 0.16, 4.2);
        kitLight(isleLights, g, mastU, top + 32, 0, '#ffffff');
        // Foredeck: a helipad, or a pool and loungers.
        if (s.helipad) {
          const u = L * 0.3;
          mesh(new Three.CylinderGeometry(B * 0.36, B * 0.36, 1, 32), tint('#3a4046', 'satin'), g, u, main + 17, 0);
          box(g, u, main + 17.6, 0, B * 0.2, 0.2, 3, tint('#f2e8c8', 'matte'));
          box(g, u - B * 0.1, main + 17.6, 0, 3, 0.2, B * 0.3, tint('#f2e8c8', 'matte'));
          box(g, u + B * 0.1, main + 17.6, 0, 3, 0.2, B * 0.3, tint('#f2e8c8', 'matte'));
          for (let k = 0; k < 10; k++) kitLight(isleLights, g, u + Math.cos((k * TAU) / 10) * B * 0.34, main + 18, Math.sin((k * TAU) / 10) * B * 0.34, '#8fffb0');
        } else if (s.pool) {
          pool(g, L * 0.3, 0, main + 10, L * 0.12, B * 0.3);
          for (const side of [-1, 1]) lounger(g, L * 0.3, side * B * 0.3, main + 10, 12, 5.6);
        }
        // The aft deck: a tender on chocks and a sofa round a table.
        ribTender(g, -L * 0.32, main + 1, 0, L * 0.12, '#46505a', 0);
        diningSet(g, -L * 0.44, 0, main, L * 0.06, B * 0.5);
        bowRail(g, spec, main, L * 0.25);
        kitNameBoard(g, s.name, 'MONARCH ISLE', dark ? '#e6cf96' : '#1e2f45', Math.min(B * 0.6, 44), -L / 2 - 0.6, 14, 0, -Math.PI / 2);
        kitWaterGlow(g, -L / 2 - 10, 0, 44, '#3fd0ff');
        // Fenders and lines to the quay (starboard side).
        for (const t of [-0.35, -0.1, 0.15, 0.38]) fender(g, L * t, 6, B / 2 + 2, 2.6, '#1c2b3d');
      }
      // END SUBSYSTEM: src/monarch-marina3d.js
