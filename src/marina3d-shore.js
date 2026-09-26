      // Marina 3D shore: cruise terminal, liner classes and models, updateLinerVisuals(), updateMarinaVisuals().
      // ---- Shore buildings ----------------------------------------------------------
      {
        const c = MARINA.club;
        box(marinaStatic, c.x + c.w / 2, 20, c.y + c.h / 2, c.w, 40, c.h, shedGrey);
        box(marinaStatic, c.x + c.w / 2, 42, c.y + c.h / 2, c.w + 10, 3, c.h + 10, staticMat('#5b6360', 0.8));
        box(marinaStatic, c.x + c.w / 2, 24, c.y + 3, c.w - 26, 14, 3, glassBlue);
        const f = MARINA.fuel;
        box(marinaStatic, f.x + f.w / 2, 10, f.y + f.h / 2, f.w, 20, f.h, staticMat('#69706a', 0.85));
        box(marinaStatic, f.x + f.w / 2, 23, f.y + f.h / 2, f.w + 14, 3, f.h + 14, staticMat('#3e4744', 0.8));
        buildCruiseTerminal();
      }

      /**
       * The cruise terminal: two storeys of glass between white floor plates,
       * under a roof of five white shells like sails, with a drop-off canopy on
       * the street side and a covered boarding bridge out to the liner's gangway.
       */
      function buildCruiseTerminal() {
        const t = MARINA.terminal,
          g = new Three.Group(),
          white = tint('#eef0ee', 'satin'),
          cx = t.x + t.w / 2,
          cz = t.y + t.h / 2;
        g.position.set(cx, 0, cz);
        scene.add(g);
        statics.push({ x: cx, y: cz, group: g, radius: 520 });
        const hw = t.w / 2,
          hd = t.h / 2;
        box(g, 0, 1.5, 0, t.w, 3, t.h, tint('#b8b4a8', 'matte'));
        for (const [z0, z1] of [
          [3, 22],
          [25, 44],
        ]) {
          box(g, 0, (z0 + z1) / 2, 0, t.w - 8, z1 - z0, t.h - 8, kitGlass);
          for (let x = -hw + 12; x < hw - 6; x += 16) {
            box(g, x, (z0 + z1) / 2, hd - 3.6, 1.2, z1 - z0, 1.2, white);
            box(g, x, (z0 + z1) / 2, -hd + 3.6, 1.2, z1 - z0, 1.2, white);
          }
        }
        for (const z of [23.5, 46]) box(g, 0, z, 0, t.w + 6, 3, t.h + 6, white);
        // Roof shells: half-cylinders rising toward the sea.
        for (let k = 0; k < 5; k++) {
          const x = -hw + t.w * (k + 0.5) / 5,
            shell = new Three.Mesh(new Three.CylinderGeometry(t.w / 10 - 4, t.w / 10 - 4, t.h - 10, 16, 1, true, 0, Math.PI), white);
          shell.rotation.set(Math.PI / 2, 0, 0);
          shell.scale.set(1, 1, 0.32);
          shell.position.set(x, 47.5, 0);
          shell.castShadow = shell.receiveShadow = true;
          g.add(shell);
        }
        // Drop-off canopy on the street side, on slender posts.
        deckSlab(g, rectOutline(-hw + 40, hw - 40, hd + 2, hd + 50), 30, 2, white, white);
        registerOverheadCover(cx, cz + hd + 26, hw - 40, 24, 0, 29, 32, 'drop-off canopy');
        for (let x = -hw + 50; x < hw - 40; x += 80) box(g, x, 14.5, hd + 46, 2, 29, 2, kitSteel);
        kitNameBoard(g, 'CRUISE TERMINAL', 'HARBOR POINT', '#f4efe0', 120, 0, 36, hd + 3.5, 0);
        // Boarding bridge from the upper floor out to the liner's gangway.
        const ship = LINERS.find((l) => l.berthed),
          gate = ship.board;
        box(g, gate.x - cx, 34, (gate.y - cz - hd) / 2 - hd / 2 - 2, 22, 14, Math.abs(gate.y - (cz - hd)) + 4, white);
        box(g, gate.x - cx, 36, (gate.y - cz - hd) / 2 - hd / 2 - 2, 22.4, 5, Math.abs(gate.y - (cz - hd)) - 4, kitGlass);
        for (let z = 3; z < 44; z += 12) kitLight(marinaLights, g, -hw + 20, z + 8, hd + 1, '#ffe7c0');
        kitMerge(g);
      }

      /* ---- The liners ---------------------------------------------------------- */
      /**
       * Both liners are the same class, so the ship is built once in its own
       * frame, merged, and placed twice sharing geometry. The hull is lofted from
       * LINER_FORM (the same plan the promenade deck uses); the superstructure
       * follows LINER_DECKHOUSES with balcony tiers, and the rest is detail.
       */
      function buildLinerClass(ship) {
        const g = new Three.Group(),
          lights = kitLightList(),
          L = ship.l,
          W = ship.w,
          deck = ship.deck;
        const spec = {
          length: L,
          beam: W,
          draft: 26,
          plan: (t) => hullPlanFraction(LINER_FORM, t),
          form: LINER_FORM,
          sheer: [
            [-0.5, deck + 2],
            [0.3, deck + 2],
            [0.5, deck + 14],
          ],
          rake: 0.035,
          forefoot: 0.1,
          keelRise: 0.2,
          bilge: 3,
          flare: 0.3,
          tuck: 0.12,
          boot: [-3, 1.5],
          colors: { bottom: '#7a2c28', boot: '#7a2c28', top: '#1d3547', bands: [[0.8, 0.83, '#d8b56a'], [0.9, 1, '#f3f3ef']] },
          stations: 50,
        };
        hullMesh(g, spec);
        hullDeck(g, spec, deck, -L / 2, L / 2 - 10, 2, kitTeakPale);
        // Rows of portholes along the dark hull.
        for (let u = -L * 0.44; u < L * 0.38; u += 40) hullBand(g, spec, 18, 22, kitGlass, 0.3, u / L, (u + 30) / L);
        // Promenade rail on posts.
        for (const side of [-1, 1])
          railing(g, hullEdge(spec, deck, -L / 2 + 30, L / 2 - 40, 5, 24).map(([u, v]) => [u, side * v]), deck, 9, { spacing: 24 });
        // Superstructure: a tier of balconies every 17 units.
        LINER_DECKHOUSES.forEach(([u, v, len, wide, high], index) => {
          const front = index === LINER_DECKHOUSES.length - 1 || index === 2,
            outline = deckOutline(u - len / 2, u + len / 2, wide / 2, front ? Math.min(60, len * 0.4) : 0, 2.2, 12, 6);
          deckhouse(g, outline, deck, deck + high, { rake: front ? 6 : 0, glassFrom: 0.1, glassTo: 0.1, paint: kitWhite });
          for (let level = 10; level < high - 6; level += 17) {
            const ring = offsetOutline(outline, 0.4);
            mesh(prismGeometry(ring, ring, deck + level, deck + level + 9, false), kitBalconyGlass, g, 0, 0, 0);
            const lip = offsetOutline(outline, 3);
            mesh(prismGeometry(lip, lip, deck + level - 1, deck + level, true, true), kitWhite, g, 0, 0, 0);
          }
          const roof = offsetOutline(outline, 1.5);
          mesh(prismGeometry(roof, roof, deck + high, deck + high + 3, true), tint('#e6e8e6', 'satin'), g, 0, 0, 0);
          deckSlab(g, offsetOutline(outline, -4), deck + high + 3.4, 0.3, tint('#b5533f', 'matte'), tint('#b5533f', 'matte'));
          deckSlab(g, offsetOutline(outline, -10), deck + high + 3.6, 0.3, kitTeakPale, kitWhite);
          railing(g, offsetOutline(outline, -0.5), deck + high + 3, 6, { closed: true, spacing: 14, glass: kitRailGlass });
          for (let k = 0; k < outline.length; k += 3) kitLight(lights, g, outline[k][0], deck + high + 4, outline[k][1], '#ffe2b0');
        });
        // Bridge on the forward house, with wings out to the full beam.
        {
          const [u, , len, , high] = LINER_DECKHOUSES[2],
            front = u + len / 2 - 20;
          deckhouse(g, deckOutline(front - 40, front + 12, 66, 26, 2.4), deck + high + 3, deck + high + 20, { glazing: kitBridgeGlass, glassFrom: 0.3, glassTo: 0.85, rake: 4 });
          box(g, front - 10, deck + high + 11, 0, 20, 16, W - 4, kitWhite);
          box(g, front - 10, deck + high + 14, 0, 18, 6, W - 2, kitBridgeGlass);
          for (const side of [-1, 1]) {
            box(g, front - 6, deck + high + 12, side * (W / 2 - 1), 6, 3, 1, side > 0 ? kitStarboardLamp : kitPortLamp);
            kitLight(lights, g, front - 6, deck + high + 12, side * (W / 2 + 1), side > 0 ? '#5dff8a' : '#ff5a4a');
          }
          box(g, front - 20, deck + high + 50, 0, 4, 60, 4, kitWhite);
          box(g, front - 20, deck + high + 60, 0, 3, 3, 40, kitWhite);
          box(g, front - 20, deck + high + 82, 0, 3, 2, 22, tint('#1d2226', 'satin'));
          kitLight(lights, g, front - 20, deck + high + 84, 0, '#ffffff');
        }
        // Pool deck on the tall midships house: two pools, rows of loungers, a slide.
        {
          const [u, , len, wide, high] = LINER_DECKHOUSES[1],
            z = deck + high + 3.8;
          pool(g, u - 60, 0, z, 70, 50);
          pool(g, u + 70, 0, z, 44, 36);
          for (const side of [-1, 1])
            for (let k = 0; k < 9; k++) lounger(g, u - 150 + k * 16, side * (wide / 2 - 14), z, 12, 6, tint(k % 2 ? '#2e7cae' : '#f3efe6', 'matte'), kitWhite);
          const curve = new Three.CatmullRomCurve3(
            Array.from({ length: 24 }, (_, i) => {
              const a = i * 0.55;
              return new Three.Vector3(u - 150 + Math.cos(a) * 18 + i * 2.6, z + 44 - i * 1.8, Math.sin(a) * 18 - 30);
            }),
          );
          mesh(new Three.TubeGeometry(curve, 80, 3, 8, false), tint('#f2c232', 'gloss'), g, 0, 0, 0);
          box(g, u - 150, z + 22, -30, 4, 44, 4, kitWhite);
        }
        // Aft house roof: a fenced sports court, a glass solarium and loungers.
        {
          const [u, , len, wide, high] = LINER_DECKHOUSES[0],
            z = deck + high + 3.8;
          box(g, u - 40, z + 0.2, 0, 90, 0.4, 60, tint('#3f7f5a', 'matte'));
          for (const dv of [-29, 29]) box(g, u - 40, z + 0.5, dv, 88, 0.3, 1, kitWhite);
          for (const du of [-84, 4, -40]) box(g, u + du, z + 0.5, 0, 1, 0.3, 58, kitWhite);
          railing(g, rectOutline(u - 86, u + 6, -31, 31), z, 12, { closed: true, spacing: 10, material: tint('#2c3a34', 'satin') });
          const sol = new Three.Mesh(new Three.CylinderGeometry(30, 30, 80, 20, 1, false, 0, Math.PI), kitBalconyGlass);
          sol.rotation.set(0, 0, Math.PI / 2);
          sol.position.set(u + 80, z, 0);
          g.add(sol);
          for (const side of [-1, 1]) for (let k = 0; k < 5; k++) lounger(g, u + 22 + k * 14, side * (wide / 2 - 16), z, 11, 5.5, tint(k % 2 ? '#2e7cae' : '#f3efe6', 'matte'), kitWhite);
        }
        // Midships: hot tubs, a bar kiosk and parasols round the lido pools.
        {
          const [u, , , wide, high] = LINER_DECKHOUSES[1],
            z = deck + high + 3.8;
          for (const du of [-110, -95]) hotTub(g, u + du, 26, z, 7);
          box(g, u + 20, z + 5, 0, 16, 10, 30, tint('#2b3440', 'gloss'));
          deckSlab(g, deckOutline(u + 10, u + 30, 20, 0, 2), z + 16, 1.2, kitWhite, kitWhite);
          for (const [du, dv] of [
            [110, 40],
            [130, 40],
            [110, -40],
            [130, -40],
            [-20, 50],
            [-20, -50],
          ]) {
            box(g, u + du, z + 6, dv, 0.8, 12, 0.8, kitSteel);
            mesh(new Three.ConeGeometry(9, 3.4, 10), tint(du > 0 ? '#f3efe6' : '#2e7cae', 'matte'), g, u + du, z + 13, dv);
          }
          for (const side of [-1, 1]) for (let k = 0; k < 6; k++) lounger(g, u + 100 + k * 14 - 40, side * (wide / 2 - 16), z, 11, 5.5, tint(k % 2 ? '#2e7cae' : '#f3efe6', 'matte'), kitWhite);
        }
        // Forward house roof: a basketball court behind the bridge.
        {
          const [u, , , , high] = LINER_DECKHOUSES[2],
            z = deck + high + 3.8;
          box(g, u - 50, z + 0.2, 0, 70, 0.4, 44, tint('#2f5f8e', 'matte'));
          box(g, u - 50, z + 0.3, 0, 60, 0.4, 36, tint('#c8733a', 'matte'));
          box(g, u - 50, z + 0.5, 0, 1, 0.3, 36, kitWhite);
          for (const du of [-82, -18]) box(g, u + du, z + 8, 0, 1, 16, 1, kitSteel);
          railing(g, rectOutline(u - 86, u - 14, -23, 23), z, 12, { closed: true, spacing: 10, material: tint('#2c3a34', 'satin') });
        }
        // Funnels: raked ovals in the line's red with black tops.
        for (const u of [-210, -60]) {
          const [hu, , , , high] = LINER_DECKHOUSES[1],
            base = deck + high + 3,
            fb = deckOutline(u - 30, u + 30, 20, 30, 2, 16, 4),
            ft = fb.map(([a, b2]) => [a - 16, b2 * 0.92]);
          mesh(prismGeometry(fb, ft, base, base + 58, false), tint('#b8443a', 'gloss'), g, 0, 0, 0);
          const tb = ft,
            tt = ft.map(([a, b2]) => [a - 2, b2 * 0.98]);
          mesh(prismGeometry(tb, tt, base + 58, base + 66, true), tint('#1d2024', 'satin'), g, 0, 0, 0);
          box(g, u - 10, base + 36, 0, 30, 6, 40.4, tint('#f3f3ef'));
          void hu;
        }
        // Lifeboats under their davits along both sides of the boat deck.
        const lifeboat = {
          length: 44,
          beam: 15,
          draft: 2,
          form: { transom: 0.4, maxAt: 0, entry: 1.6, bowShape: 0.7, sternCurve: 2 },
          sheer: 9,
          rake: 0.12,
          bilge: 2.4,
          colors: { bottom: '#e8e6df', boot: '#e8e6df', top: '#e46a2a' },
          stations: 12,
        };
        const lifeboatGeo = loftHull(lifeboat);
        for (let u = -320; u <= 200; u += 62)
          for (const side of [-1, 1]) {
            const v = side * (hullHalfBeam(ship, u) - 12);
            mesh(lifeboatGeo, kitFinishMaterials.gloss, g, u, deck + 52, v);
            box(g, u, deck + 60.5, v, 30, 3, 12, tint('#f0f0ec'));
            for (const du of [-16, 16]) box(g, u + du, deck + 58, v - side * 3, 2, 16, 2, kitWhite);
          }
        // Stern boarding platform, bow mooring deck and the ship's name.
        deckSlab(g, rectOutline(-L / 2 - 46, -L / 2 + 4, -37, 37), 4, 3, kitTeakPale, kitWhite);
        box(g, -L / 2 - 2, deck / 2, 0, 34, deck, 22, tint('#8a9094', 'satin'));
        for (const side of [-1, 1]) {
          for (const u of [L / 2 - 90, L / 2 - 60, -L / 2 + 40]) bollard(g, u, deck, side * (hullHalfBeam(ship, u) - 16), 3);
          for (let u = -L / 2 + 60; u < L / 2 - 80; u += 50) kitLight(lights, g, u, deck + 10, side * (hullHalfBeam(ship, u) - 2), '#ffe2b0');
        }
        return { group: g, lights, spec };
      }
      const linerClass = buildLinerClass(LINERS[0]);
      kitMerge(linerClass.group);
      const sailingLinerModel = { ship: null, group: null, statics: null, lights: kitLightList() };
      for (const ship of LINERS) {
        const g = new Three.Group();
        g.position.set(ship.x, 0, ship.y);
        g.rotation.y = -ship.a;
        scene.add(g);
        const culling = { x: ship.x, y: ship.y, group: g, radius: 760 };
        statics.push(culling);
        // The ship under way carries her own lights (they move with her).
        if (ship.voyage) {
          g.userData.lightCloud = true;
          Object.assign(sailingLinerModel, { ship, group: g, statics: culling });
        }
        const shipLights = ship.voyage ? sailingLinerModel.lights : marinaLights;
        for (const part of linerClass.group.children.filter((c) => c.isMesh)) {
          const copy = new Three.Mesh(part.geometry, part.material);
          copy.castShadow = copy.receiveShadow = true;
          g.add(copy);
        }
        // The name on each bow, turned to follow the hull as it narrows.
        const nameShip = (name, u, side) => {
          const spec = linerClass.spec,
            z = ship.deck - 6,
            yaw = Math.atan2(hullBeamAt(spec, u - 40, z) - hullBeamAt(spec, u + 40, z), 80),
            board = kitNameBoard(g, name, null, '#f2f2ee', 110, u, z, side * (hullBeamAt(spec, u, z) + 1.2), 0);
          board.rotation.y = side > 0 ? yaw : Math.PI - yaw;
        };
        nameShip(ship.name.replace('MS ', ''), ship.l / 2 - 250, 1);
        nameShip(ship.name.replace('MS ', ''), ship.l / 2 - 250, -1);
        kitNameBoard(g, ship.name.replace('MS ', ''), 'HARBOR POINT', '#f2f2ee', 110, -ship.l / 2 - 0.5, ship.deck - 12, 0, -Math.PI / 2);
        for (const l of linerClass.lights) kitLight(shipLights, g, l.position.x, l.position.y, l.position.z, '#' + l.color.getHexString());
        // Stern boarding platform, and a gangway when the ship lies alongside.
        if (ship.berthed) {
          const gate = deckLocal(ship, ship.board.x, ship.board.y);
          box(g, gate.u, ship.deck / 2 + 6, gate.v / 2 + 40, 46, 4, Math.abs(gate.v) - 60, tint('#b9bdb6', 'satin'));
          box(g, gate.u, ship.deck / 2 + 18, gate.v / 2 + 40, 46, 22, 3, kitSteel);
        }
      }
      kitLightCloud(marinaLights, 7);
      kitLightCloud(sailingLinerModel.lights, 7);

      /**
       * THE SAILING LINER
       * Her model and lights follow the voyage (sailLiner, marina.js), heeling a
       * little in the turns. Her wake is drawn into the sea by the boat wake
       * system (wakes3d.js) like every hull on the water, scaled to her 265 m
       * length and 36 m beam: the Kelvin V, a long-lived propeller wash, the bow
       * wave and the collar round her waterline. At anchor she only laps.
       */
      function updateLinerVisuals() {
        const model = sailingLinerModel,
          ship = model.ship;
        if (!ship) return;
        model.group.position.set(ship.x, 0, ship.y);
        model.group.rotation.set(linerVoyage.heel, -ship.a, 0, 'YXZ');
        model.statics.x = ship.x;
        model.statics.y = ship.y;
        // Her top speed at sea is about 50 units/s; no spray off a liner's bow.
        wakeEmit(ship, ship.x, ship.y, ship.a, ship.speed || 0, ship.l, ship.w, 55, false);
      }

      /* Per-frame: the superyacht's cutaway and radars, the sailing liner and her
         wake, and the shared night lights. */
      function updateMarinaVisuals(deltaSeconds) {
        const cover = superyachtCoverHeight();
        for (const d of superyachtDecks) d.group.visible = d.z < cover;
        for (const [i, r] of superyachtRadars.entries()) r.rotation.y += deltaSeconds * (i ? 2.1 : 1.4);
        updateLinerVisuals();
        updateBoatKitVisuals();
      }
