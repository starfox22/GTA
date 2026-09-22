      // BEGIN SUBSYSTEM: src/marina3d.js — Marina and cruise liner meshes
      /**
       * Marina and cruise liner meshes
       * Source: src/marina3d.js
       * Scope: createCityRenderer() closure.
       * Pontoons, moored yachts, the yacht club, the cruise terminal and the two
       * liners. Hull sections follow the same taper the walkable deck uses, so
       * what you can stand on is exactly what you can see.
       */
      const marinaStatic = new Three.Group();
      scene.add(marinaStatic);
      batchGroups.push(marinaStatic);
      statics.push({ x: 1600, y: -3800, group: marinaStatic, radius: 2600 });
      const deckWood = mat('#a8895f', 0.9),
        pileWood = mat('#6d5a45', 0.95),
        hullWhite = mat('#eef0ec', 0.45, 0.1),
        hullNavy = mat('#20394a', 0.5, 0.15),
        hullRed = mat('#7d3630', 0.6),
        glassBlue = mat('#9fc4d6', 0.15, 0.6),
        shedGrey = mat('#7b8486', 0.8),
        quaySteel = mat('#d2d6d4', 0.35, 0.65),
        lifeOrange = mat('#e0813a', 0.6),
        funnelRed = mat('#b8443a', 0.55);
      // ---- Pontoons and moored boats ------------------------------------------------
      for (const f of MARINA.fingers) {
        box(marinaStatic, f.x + f.w / 2, 3, f.y + f.h / 2, f.w, 3.4, f.h, deckWood);
        for (let d = 14; d < f.h; d += 56)
          for (const side of [-1, 1])
            box(marinaStatic, f.x + f.w / 2 + side * (f.w / 2 + 2), 7, f.y + d, 2.6, 18, 2.6, pileWood);
      }
      for (const moored of marinaBoats()) {
        const g = new Three.Group();
        g.position.set(moored.x, 0, moored.y);
        marinaStatic.add(g);
        const hull = mat(moored.hull, 0.45, 0.1),
          house = mat(moored.house, 0.5, 0.15);
        const sections = 7;
        for (let i = 0; i < sections; i++) {
          const t = (i + 0.5) / sections - 0.5,
            taper = Math.sqrt(Math.max(0.08, 1 - Math.pow(Math.abs(t) * 2, 4)));
          box(g, 0, 5.5, t * moored.len, moored.beam * taper, 11, moored.len / sections + 1, hull);
        }
        box(g, 0, 12, -moored.len * 0.04, moored.beam * 0.62, 3, moored.len * 0.72, deckWood);
        box(g, 0, 17, -moored.len * 0.1, moored.beam * 0.5, 12, moored.len * 0.3, house);
        box(g, 0, 22, -moored.len * 0.1, moored.beam * 0.42, 4, moored.len * 0.22, glassBlue);
        if (moored.len > 100)
          box(g, 0, 40, moored.len * 0.02, 1.6, 52, 1.6, quaySteel);
      }
      // ---- Shore buildings ----------------------------------------------------------
      {
        const c = MARINA.club;
        box(marinaStatic, c.x + c.w / 2, 20, c.y + c.h / 2, c.w, 40, c.h, shedGrey);
        box(marinaStatic, c.x + c.w / 2, 42, c.y + c.h / 2, c.w + 10, 3, c.h + 10, mat('#5b6360', 0.8));
        box(marinaStatic, c.x + c.w / 2, 24, c.y + 3, c.w - 26, 14, 3, glassBlue);
        const f = MARINA.fuel;
        box(marinaStatic, f.x + f.w / 2, 10, f.y + f.h / 2, f.w, 20, f.h, mat('#69706a', 0.85));
        box(marinaStatic, f.x + f.w / 2, 23, f.y + f.h / 2, f.w + 14, 3, f.h + 14, mat('#3e4744', 0.8));
        const t = MARINA.terminal;
        box(marinaStatic, t.x + t.w / 2, 44, t.y + t.h / 2, t.w, 88, t.h, shedGrey);
        box(marinaStatic, t.x + t.w / 2, 62, t.y + 3, t.w - 40, 34, 4, glassBlue);
        box(marinaStatic, t.x + t.w / 2, 90, t.y + t.h / 2, t.w + 16, 5, t.h + 16, mat('#59615f', 0.8));
        for (let x = t.x + 40; x < t.x + t.w - 20; x += 96)
          box(marinaStatic, x, 22, t.y + t.h + 26, 6, 44, 6, quaySteel);
        box(marinaStatic, t.x + t.w / 2, 46, t.y + t.h + 26, t.w - 60, 4, 52, mat('#4e5654', 0.8));
      }
      // ---- The liners ----------------------------------------------------------------
      function buildLiner(ship) {
        const g = new Three.Group();
        g.position.set(ship.x, 0, ship.y);
        g.rotation.y = -ship.a;
        marinaStatic.add(g);
        const draft = 22,
          sections = 26;
        for (let i = 0; i < sections; i++) {
          const u = (-0.5 + (i + 0.5) / sections) * ship.l,
            beam = hullHalfBeam(ship, u) * 2,
            len = ship.l / sections + 1;
          box(g, u, ship.deck / 2 - draft / 2, 0, len, ship.deck + draft, beam, hullNavy);
          box(g, u, -draft / 2, 0, len, draft - 2, beam * 0.94, hullRed);
          box(g, u, ship.deck - 2, 0, len, 5, beam + 2, hullWhite);
        }
        // Promenade rail: a run of posts down both sides rather than a solid wall.
        for (let u = -ship.l / 2 + 40; u < ship.l / 2 - 40; u += 42) {
          const beam = hullHalfBeam(ship, u);
          for (const side of [-1, 1]) {
            box(g, u, ship.deck + 8, side * (beam - 5), 2, 12, 2, quaySteel);
            box(g, u + 21, ship.deck + 13, side * (beam - 5), 44, 1.6, 1.6, quaySteel);
          }
        }
        for (const [u, v, len, wide, high] of LINER_DECKHOUSES) {
          box(g, u, ship.deck + high / 2, v, len, high, wide, hullWhite);
          for (let level = 14; level < high - 8; level += 17)
            box(g, u, ship.deck + level, v, len - 8, 8, wide + 2.5, glassBlue);
          box(g, u, ship.deck + high + 1.5, v, len - 6, 4, wide - 6, mat('#cfd3cd', 0.8));
        }
        // Funnels, masts and the boat deck.
        for (const u of [-210, -60]) {
          box(g, u, ship.deck + 128, 0, 54, 56, 62, funnelRed);
          box(g, u, ship.deck + 158, 0, 58, 6, 66, mat('#2b2f31', 0.7));
        }
        box(g, 330, ship.deck + 92, 0, 4, 70, 4, quaySteel);
        for (let u = -320; u <= 200; u += 62)
          for (const side of [-1, 1]) {
            const beam = hullHalfBeam(ship, u);
            box(g, u, ship.deck + 58, side * (beam - 10), 44, 14, 16, lifeOrange);
          }
        // Stern boarding platform, and a gangway when the ship lies alongside.
        box(g, -ship.l / 2 - 20, 3, 0, 52, 4, 74, deckWood);
        box(g, -ship.l / 2 - 2, ship.deck / 2, 0, 34, ship.deck, 22, mat('#8a9094', 0.7));
        if (ship.berthed) {
          const gate = deckLocal(ship, ship.board.x, ship.board.y);
          box(g, gate.u, ship.deck / 2 + 6, gate.v / 2, 46, 4, Math.abs(gate.v) + 20, mat('#b9bdb6', 0.7));
          box(g, gate.u, ship.deck / 2 + 18, gate.v / 2, 46, 22, 3, quaySteel);
        }
        return g;
      }
      for (const ship of LINERS) buildLiner(ship);
      // END SUBSYSTEM: src/marina3d.js
