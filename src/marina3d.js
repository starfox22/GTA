      // BEGIN SUBSYSTEM: src/marina3d.js — Marina, superyacht and cruise liner meshes
      /**
       * Marina, superyacht and cruise liner meshes
       * Source: src/marina3d.js
       * Scope: createCityRenderer() closure.
       * Pontoons, sixteen one-of-a-kind moored yachts, the superyacht AURELIA
       * (built deck by deck from SUPERYACHT so the cutaway can lift away the decks
       * above the player), the yacht club, the cruise terminal and the two
       * liners. Hulls come from the boat kit (boats3d.js) and follow the same plan
       * shapes the walkable decks use, so what you can stand on is exactly what
       * you can see.
       */
      const marinaStatic = new Three.Group();
      scene.add(marinaStatic);
      batchGroups.push(marinaStatic);
      statics.push({ x: 1600, y: -3800, group: marinaStatic, radius: 2600 });
      const deckWood = mat('#a8895f', 0.9),
        pileWood = mat('#6d5a45', 0.95),
        glassBlue = mat('#9fc4d6', 0.15, 0.6),
        shedGrey = mat('#7b8486', 0.8),
        quaySteel = mat('#d2d6d4', 0.35, 0.65);
      const marinaLights = kitLightList();
      // Shared paint and trim for everything built here.
      const kitWhite = tint('#f5f5f1'),
        kitSteel = tint('#cdd3d6', 'metal'),
        kitDarkTrim = tint('#2a3038', 'satin'),
        kitCushion = tint('#f3efe6', 'matte'),
        kitRope = tint('#d9cfb4', 'matte'),
        kitRailGlass = new Three.MeshStandardMaterial({
          color: '#a9c6d2',
          transparent: true,
          opacity: 0.3,
          roughness: 0.05,
          metalness: 0.3,
          depthWrite: false,
        });

      // ---- Pontoons ------------------------------------------------------------------
      for (const f of MARINA.fingers) {
        box(marinaStatic, f.x + f.w / 2, 3, f.y + f.h / 2, f.w, 3.4, f.h, deckWood);
        for (let d = 14; d < f.h; d += 56)
          for (const side of [-1, 1])
            box(marinaStatic, f.x + f.w / 2 + side * (f.w / 2 + 2), 7, f.y + d, 2.6, 18, 2.6, pileWood);
        // Service pedestals (water and shore power) and a low light at each one.
        for (let d = 60; d < f.h - 20; d += 110) {
          box(marinaStatic, f.x + f.w / 2, 8, f.y + d, 4, 9, 4, mat('#e9e7e0', 0.5));
          box(marinaStatic, f.x + f.w / 2, 12.8, f.y + d, 4.6, 1, 4.6, mat('#2f5f86', 0.5));
          kitLight(marinaLights, scene, f.x + f.w / 2, 13.5, f.y + d, '#ffe2b0');
        }
      }

      /* ---- The superyacht ------------------------------------------------------ */
      /**
       * AURELIA is built as a base (hull, swim platform, main deck and everything
       * on it) plus one group per higher deck. Each group is merged down to a few
       * meshes, and updateMarinaVisuals() hides the groups over the player's head
       * while they are aboard, like lifting the roof off a doll's house.
       */
      const superyachtDecks = [],
        superyachtRadars = [];
      function superyachtHullSpec(ship) {
        const L = ship.fwd - ship.aft;
        return {
          length: L,
          beam: ship.beam,
          draft: 16,
          plan: (t) => hullPlanFraction(ship.form, t),
          form: ship.form,
          // Low around the swim platform, then the main deck bulwark, rising to a high bow.
          sheer: [
            [-0.5, 10],
            [-0.452, 10],
            [-0.447, 31],
            [0.1, 31],
            [0.3, 34.5],
            [0.5, 45],
          ],
          rake: 0.025,
          forefoot: 0.12,
          keelRise: 0.3,
          flatAft: -0.25,
          bilge: 2.4,
          flare: 0.34,
          tuck: 0.06,
          boot: [-2.8, 0.2],
          colors: { bottom: '#5e2524', boot: '#f2f2ee', top: '#1b2736', bands: [[0.905, 0.93, '#cfd4d8']] },
          finish: 'pearl',
          stations: 48,
        };
      }
      // Rails round three sides of a stair well, open at the landing end.
      function wellRail(parent, s, z, landingAtTop = true) {
        const end = landingAtTop ? s.u0 : s.u1;
        railing(parent, [[s.u0, s.v0 - 0.5], [s.u1, s.v0 - 0.5]], z, 7);
        railing(parent, [[s.u0, s.v1 + 0.5], [s.u1, s.v1 + 0.5]], z, 7);
        railing(parent, [[end, s.v0 - 0.5], [end, s.v1 + 0.5]], z, 7);
      }
      // Walls of the open saloon: short panels of glass between white base and
      // header, broken where the doors stand open.
      function saloonWalls(parent, outline, z0, z1, doors) {
        const panels = [];
        for (let i = 0; i < outline.length; i++) {
          const a = outline[i],
            b = outline[(i + 1) % outline.length],
            len = Math.hypot(b[0] - a[0], b[1] - a[1]),
            n = Math.max(1, Math.ceil(len / 10));
          for (let k = 0; k < n; k++) panels.push([lerpPoint(a, b, k / n), lerpPoint(a, b, (k + 1) / n)]);
        }
        for (const [a, b] of panels) {
          const mu = (a[0] + b[0]) / 2,
            mv = (a[1] + b[1]) / 2;
          if (doors.some((d) => mu >= d[0] && mu <= d[1] && mv >= d[2] && mv <= d[3])) continue;
          beamBox(parent, a, b, 2.4, 2.6, kitWhite, z0 + 1.3);
          beamBox(parent, a, b, 1.6, z1 - z0 - 5.6, kitGlass, z0 + 2.6 + (z1 - z0 - 5.6) / 2);
          beamBox(parent, a, b, 2.4, 3, kitWhite, z1 - 1.5);
        }
        // Door frames either side of each opening.
        for (const d of doors)
          for (const v of [d[2], d[3]]) box(parent, (d[0] + d[1]) / 2, (z0 + z1) / 2, v, 2.6, z1 - z0, 1.6, kitWhite);
      }
      function sheerAt(spec, u) {
        return hullSheer(spec, u / spec.length);
      }
      function lerpPoint(a, b, f) {
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      }
      function superyachtFurniture(parent, level, f, z) {
        const { type, u, v, l, w } = f;
        if (type === 'lounger') lounger(parent, u, v, z, l, w, kitCushion, kitTeak, true);
        else if (type === 'sunpad') {
          box(parent, u, z + 1.5, v, l, 3, w, kitTeak);
          box(parent, u, z + 3.6, v, l - 1, 1.8, w - 1, kitCushion);
          for (const dv of [-w / 4, w / 4]) box(parent, u - l / 2 + 2.5, z + 5, v + dv, 2, 2.4, w / 2.6, tint('#233a57', 'matte'));
        } else if (type === 'sofa') {
          const across = w > l,
            back = across ? 'aft' : v > 0 ? 'starboard' : 'port';
          sofa(parent, u, v, z, l, w, back, kitCushion, tint('#233a57', 'matte'));
        } else if (type === 'table') table(parent, u, v, z, l, w, kitTeak, 4.5);
        else if (type === 'dining') diningSet(parent, u, v, z, l, w);
        else if (type === 'pool') pool(parent, u, v, z, l, w);
        else if (type === 'jacuzzi') {
          box(parent, u, z + 1.2, v, l + 4, 2.4, w + 4, kitTeak);
          hotTub(parent, u, v, z + 1.2, l / 2);
          kitLight(marinaLights, parent, u, z + 5, v, '#7fe8ff');
        } else if (type === 'bar') {
          box(parent, u, z + 4, v, l * 0.6, 8, w, tint('#2b3440', 'gloss'));
          box(parent, u, z + 8.3, v, l * 0.8, 0.8, w + 1, tint('#e8e2d6', 'gloss'));
          const stools = Math.max(2, Math.floor(Math.max(l, w) / 7));
          for (let i = 0; i < stools; i++) {
            const f2 = (i + 0.5) / stools - 0.5,
              su = l > w ? u + f2 * l : u - l / 2 - 4,
              sv = l > w ? v + (v > 0 ? -w / 2 - 4 : w / 2 + 4) : v + f2 * w;
            box(parent, su, z + 2.8, sv, 0.8, 5.6, 0.8, kitSteel);
            mesh(cylinderGeo, kitCushion, parent, su, z + 5.8, sv, 2, 1, 2);
          }
        } else if (type === 'piano') {
          box(parent, u, z + 4.2, v, l, 3, w, tint('#0f1012', 'gloss'));
          const lid = box(parent, u - 1, z + 8, v - 1, l * 0.8, 0.4, w * 0.9, tint('#0f1012', 'gloss'));
          lid.rotation.x = 0.5;
          for (const du of [-l / 3, l / 3]) box(parent, u + du, z + 1.4, v, 1, 2.8, 1, tint('#0f1012', 'gloss'));
        } else if (type === 'windlass') {
          for (const dv of [-5, 5]) {
            const drum = mesh(cylinderGeo, kitSteel, parent, u, z + 3, v + dv, 3, 4, 3);
            drum.rotation.x = Math.PI / 2;
            box(parent, u, z + 1.2, v + dv, 7, 2.4, 6, kitDarkTrim);
            strut(parent, [u + 4, z + 2, v + dv], [u + 24, z + 1, v + dv * 0.6], 1.2, tint('#3a3d40', 'metal'));
          }
        }
      }
      function buildSuperyacht(ship) {
        const root = new Three.Group();
        root.position.set(ship.x, 0, ship.y);
        root.rotation.y = -ship.a;
        scene.add(root);
        statics.push({ x: ship.x, y: ship.y, group: root, radius: 420 });
        const plan = superyachtPlan(),
          Z = ship.levels.map((l) => l.z),
          base = new Three.Group(),
          decks = [2, 3, 4].map(() => new Three.Group());
        root.add(base, ...decks);
        const groupFor = (level) => (level >= 2 && level <= 4 ? decks[level - 2] : base),
          spec = superyachtHullSpec(ship),
          stairsFrom = (level) => ship.stairs.filter((s) => s.lo === level),
          holesIn = (level) => ship.stairs.filter((s) => s.hi === level && s.lo >= 1).map((s) => rectOutline(s.u0, s.u1, s.v0, s.v1)),
          edgeLights = (group, outline, z, spacing = 14) => {
            for (let i = 0; i < outline.length; i++) {
              const a = outline[i],
                b = outline[(i + 1) % outline.length],
                n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing);
              for (let k = 0; k < n; k++) {
                const p = lerpPoint(a, b, (k + 0.5) / n);
                kitLight(marinaLights, group, p[0], z, p[1], '#ffd49a');
              }
            }
          };

        // Hull, lower-deck windows, garage door seams and the name on the bow.
        hullMesh(base, spec);
        for (let u = -150; u < 60; u += 32) hullBand(base, spec, 12, 19, kitGlass, 0.25, u / spec.length, (u + 26) / spec.length);
        for (const [z0, z1] of [
          [5.6, 6.2],
          [18.2, 18.8],
        ])
          hullBand(base, spec, z0, z1, kitDarkTrim, 0.22, -216 / spec.length, -170 / spec.length);
        for (const u of [-216, -170]) {
          const hb = hullBeamAt(spec, u, 12);
          box(base, u, 12.2, hb + 0.2, 0.6, 12.6, 0.4, kitDarkTrim);
        }
        {
          const u = 200,
            hbA = hullBeamAt(spec, u - 12, 32),
            hbB = hullBeamAt(spec, u + 12, 32),
            yaw = Math.atan2(hbA - hbB, 24),
            flare = Math.atan2(hullBeamAt(spec, u, 36) - hullBeamAt(spec, u, 28), 8);
          for (const side of [1, -1]) {
            const board = kitNameBoard(base, 'AURELIA', null, '#dcc48e', 38, u, 32, side * (hullBeamAt(spec, u, 32) + 0.5), 0);
            board.rotation.set(side * flare, side > 0 ? yaw : Math.PI - yaw, 0, 'YXZ');
          }
          kitNameBoard(base, 'AURELIA', 'HARBOR POINT', '#dcc48e', 40, -238.8, 17, 0, -Math.PI / 2);
        }

        // Swim platform (inside the lowered transom and folded out beyond it).
        hullDeck(base, spec, Z[0], ship.aft, -238, 0);
        deckSlab(base, rectOutline(-282, ship.aft + 0.5, -40, 40), Z[0], 2.4, kitTeak, kitWhite);
        // The aft bulkhead of the main deck, open where the stairs come up.
        const hbAft = hullBeamAt(spec, -238, 26);
        for (const [v0, v1] of [
          [-hbAft, -40],
          [-30, 30],
          [40, hbAft],
        ])
          box(base, -238.5, (Z[0] + Z[1]) / 2, (v0 + v1) / 2, 1.4, Z[1] - Z[0], v1 - v0, kitWhite);
        box(base, -239.3, 13, 0, 0.4, 5, 30, kitGlass);
        for (const u of [-278, -270]) kitWaterGlow(base, u, 0, 60, '#34c8ff');

        // Main deck: teak all the way forward, with the stair wells cut out aft.
        hullDeck(base, spec, Z[1], -218, ship.fwd - 3, 0.3);
        deckSlab(base, rectOutline(-237.5, -218, -30, 30), Z[1], 0.6, kitTeak, kitWhite);
        for (const side of [-1, 1]) {
          const pts = [
            [-237.5, side * 40],
            [-218, side * 40],
            [-218, side * hullBeamAt(spec, -218, Z[1])],
            [-237.5, side * hullBeamAt(spec, -237.5, Z[1])],
          ];
          deckSlab(base, pts, Z[1], 0.6, kitTeak, kitWhite);
        }
        // Varnished capping along the bulwark, with fairleads and cleats.
        for (const side of [-1, 1]) {
          const edge = [];
          for (let u = -236; u <= ship.fwd - 6; u += 10) edge.push([u, side * (hullBeamAt(spec, u, sheerAt(spec, u)) - 1)]);
          for (let i = 0; i < edge.length - 1; i++) {
            const zA = hullSheer(spec, edge[i][0] / spec.length),
              zB = hullSheer(spec, edge[i + 1][0] / spec.length);
            beamBox(base, edge[i], edge[i + 1], 2.2, 0.8, kitTeak, (zA + zB) / 2 + 0.4);
          }
          for (const u of [-226, -120, 60, 210]) bollard(base, u, Z[1], side * (hullBeamAt(spec, u, Z[1]) - 3));
          for (let u = -200; u < 240; u += 26) kitLight(marinaLights, base, u, 30, side * (hullBeamAt(spec, u, 30) + 0.4), '#fff0d0');
        }
        // Glass rail across the aft end of the main deck, over the swim platform.
        railing(base, [[-237, -30], [-237, 30]], Z[1], 7, { glass: kitRailGlass });
        for (const s of stairsFrom(0)) if (!s.gangway) stairFlight(base, s.u0, s.u1, s.v0, s.v1, Z[0], Z[1]);
        for (const s of stairsFrom(1)) stairFlight(base, s.u0, s.u1, s.v0, s.v1, Z[1], Z[s.hi]);

        // The passerelle: teak treads between stainless rails, quay to platform.
        {
          const g = SUPERYACHT_GANGWAY;
          stairFlight(base, g.u0, g.u1, g.v0, g.v1, 1, Z[0], { stringer: kitSteel });
          for (const v of [g.v0 - 1, g.v1 + 1]) box(base, g.u0 - 2, 5, v, 1.2, 10, 1.2, kitSteel);
          kitLight(marinaLights, base, g.u0 - 2, 11, g.v0 - 1, '#fff0d0');
          kitLight(marinaLights, base, g.u0 - 2, 11, g.v1 + 1, '#fff0d0');
          // Mooring lines from the quarters to bollards on the quay.
          for (const side of [-1, 1]) {
            bollard(base, -322, 0, side * 64, 2.4);
            strut(base, [-262, 10, side * 40], [-322, 4, side * 64], 0.9, kitRope);
          }
        }

        // Main saloon: open-backed glass walls, a cream carpet and its furniture.
        const saloon = ship.houses[0],
          saloonOuter = deckOutline(...saloon.outline),
          saloonInner = deckOutline(saloon.outline[0] + 3, saloon.outline[1] - 3, saloon.outline[2] - 3, saloon.outline[3] - 3, saloon.outline[4]);
        saloonWalls(base, saloonOuter, Z[1], Z[2] - 3, saloon.doors);
        deckSlab(base, saloonInner, Z[1] + 0.25, 0.2, tint('#bda88a', 'matte'), tint('#bda88a', 'matte'));
        box(base, 30, Z[1] + 12, 0, 1.2, 20, 22, tint('#cbb79a', 'satin'));
        for (const dv of [-12, 12]) kitLight(marinaLights, base, -60, Z[2] - 6, dv, '#ffd9a0');

        // Foredeck: the helipad on its legs, its stair, anchor gear and chains.
        {
          const [cu, cv, r] = ship.levels[5].circle,
            pad = Z[5];
          mesh(new Three.CylinderGeometry(r, r, 1.6, 40), tint('#3a4047', 'satin'), base, cu, pad - 0.8, cv);
          mesh(new Three.CylinderGeometry(r + 4, r + 1, 0.6, 40), tint('#23282e', 'matte'), base, cu, pad - 1.4, cv);
          const ring = (r0, r1, color) => {
            const m = mesh(new Three.RingGeometry(r0, r1, 40), tint(color, 'matte'), base, cu, pad + 0.05, cv);
            m.rotation.x = -Math.PI / 2;
          };
          ring(r - 2, r - 0.6, '#f2f2ee');
          ring(r * 0.62, r * 0.7, '#f1c232');
          for (const dv of [-6.5, 6.5]) box(base, cu, pad + 0.1, cv + dv, 15, 0.2, 3, tint('#f2f2ee', 'matte'));
          box(base, cu, pad + 0.1, cv, 3, 0.2, 10, tint('#f2f2ee', 'matte'));
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU;
            box(base, cu + Math.cos(a) * (r - 6), (Z[1] + pad) / 2, cv + Math.sin(a) * (r - 6), 2, pad - Z[1], 2, kitWhite);
            kitLight(marinaLights, base, cu + Math.cos(a) * (r + 1), pad + 1, cv + Math.sin(a) * (r + 1), k % 2 ? '#8dff9a' : '#ffffff');
          }
          box(base, 250, 40, 0, 1.4, 12, 1.4, kitSteel);
          for (const side of [-1, 1]) {
            box(base, 246, 30, side * (hullBeamAt(spec, 246, 30) + 0.2), 6, 5, 0.6, kitDarkTrim);
            strut(base, [246, 30, side * hullBeamAt(spec, 246, 30)], [310, -3, side * 22], 1.1, tint('#3a3d40', 'metal'));
          }
        }

        // Tender alongside to starboard, a limousine launch in the owner's colours.
        {
          const t = new Three.Group();
          t.position.set(-196, 0, 70);
          base.add(t);
          const ts = {
            length: 54,
            beam: 16,
            draft: 3,
            form: { transom: 0.86, maxAt: -0.12, entry: 1.6, bowShape: 0.7 },
            sheer: [
              [-0.5, 6],
              [0.5, 8],
            ],
            rake: 0.1,
            bilge: 1.5,
            colors: { bottom: '#5e2524', boot: '#f2f2ee', top: '#1b2736', bands: [[0.8, 0.86, '#cfd4d8']] },
            finish: 'pearl',
            stations: 18,
          };
          hullMesh(t, ts);
          hullDeck(t, ts, 5.6, -27, 26, 0.8, kitTeak);
          deckhouse(t, deckOutline(-6, 14, 5.8, 8, 1.8), 5.6, 11.5, { rake: 5, glassFrom: 0.3, glassTo: 0.95 });
          sofa(t, -20, 0, 5.6, 6, 12, 'aft', kitCushion, tint('#233a57', 'matte'));
          for (const du of [-12, 8]) fender(t, du, 4, -8.6, 1.4, '#e9e9e4');
          strut(base, [-178, 8, 78], [-160, 30, hullBeamAt(spec, -160, 30)], 0.7, kitRope);
        }
        for (let u = -220; u <= 200; u += 70) kitWaterGlow(base, u, 58, 48, '#2fbfff');

        // Main deck furniture.
        for (const f of plan.levels[0].furniture) superyachtFurniture(base, 0, f, Z[0]);
        for (const f of plan.levels[1].furniture) superyachtFurniture(base, 1, f, Z[1]);

        // ---- Upper deck (level 2) -------------------------------------------------
        {
          const g = decks[0],
            outline = plan.levels[2].outline,
            house = ship.houses[1];
          deckSlab(g, outline, Z[2], 3, kitTeak, kitWhite, holesIn(2));
          deckhouse(g, deckOutline(...house.outline), Z[2], Z[3] - 3, { rake: house.rake, glassFrom: 0.26, glassTo: 0.8, mullions: 14 });
          railing(g, offsetOutline(outline, -1.2), Z[2], 7, { closed: true, spacing: 10 });
          for (const s of ship.stairs.filter((s) => s.hi === 2)) wellRail(g, s, Z[2]);
          for (const s of stairsFrom(2)) stairFlight(g, s.u0, s.u1, s.v0, s.v1, Z[2], Z[s.hi]);
          for (const f of plan.levels[2].furniture) superyachtFurniture(g, 2, f, Z[2]);
          edgeLights(g, offsetOutline(outline, 0.5), Z[2] - 3.6);
          // Owner's foredeck forward of the upper saloon: sun pads under the bridge.
          box(g, 100, Z[2] + 1.5, 0, 12, 3, 30, kitTeak);
          box(g, 100, Z[2] + 3.4, 0, 11, 1.6, 29, kitCushion);
        }
        // ---- Bridge deck (level 3) -------------------------------------------------
        {
          const g = decks[1],
            outline = plan.levels[3].outline,
            house = ship.houses[2];
          deckSlab(g, outline, Z[3], 3, kitTeak, kitWhite, holesIn(3));
          deckhouse(g, deckOutline(...house.outline), Z[3], Z[4] - 3, { rake: house.rake, glazing: kitBridgeGlass, glassFrom: 0.32, glassTo: 0.84, mullions: 12 });
          // Bridge wings reaching out to the ship's side, with their consoles.
          for (const side of [-1, 1]) {
            deckSlab(g, rectOutline(54, 70, side > 0 ? 33 : -48, side > 0 ? 48 : -33), Z[3] - 0.05, 3, kitTeak, kitWhite);
            box(g, 64, Z[3] + 4, side * 45, 8, 8, 4, kitWhite);
            box(g, 64, Z[3] + 9, side * 45, 7, 2, 3.6, kitBridgeGlass);
            railing(g, [[54, side * 48], [70, side * 48]], Z[3], 7);
            box(g, 70, Z[3] + 4, side * 48.5, 2, 3, 1, side > 0 ? kitStarboardLamp : kitPortLamp);
            kitLight(marinaLights, g, 70, Z[3] + 4, side * 49.5, side > 0 ? '#5dff8a' : '#ff5a4a');
          }
          railing(g, offsetOutline(outline, -1.2), Z[3], 7, { closed: true, spacing: 10 });
          for (const s of ship.stairs.filter((s) => s.hi === 3)) wellRail(g, s, Z[3]);
          for (const s of stairsFrom(3)) stairFlight(g, s.u0, s.u1, s.v0, s.v1, Z[3], Z[s.hi]);
          for (const f of plan.levels[3].furniture) superyachtFurniture(g, 3, f, Z[3]);
          edgeLights(g, offsetOutline(outline, 0.5), Z[3] - 3.6);
          // Searchlight and horns on the exposed bridge roof.
          mesh(cylinderGeo, kitWhite, g, 62, Z[4] - 1, 0, 2.4, 3, 2.4);
          box(g, 58, Z[4] - 1.5, 6, 4, 2, 2, kitSteel);
        }
        // ---- Sun deck (level 4) ----------------------------------------------------
        {
          const g = decks[2],
            outline = plan.levels[4].outline,
            z = Z[4];
          deckSlab(g, outline, z, 3, kitTeak, kitWhite, holesIn(4));
          railing(g, offsetOutline(outline, -1.2), z, 8, { glass: kitRailGlass, spacing: 12, closed: true });
          for (const s of ship.stairs.filter((s) => s.hi === 4)) wellRail(g, s, z);
          for (const f of plan.levels[4].furniture) if (f.type !== 'mast') superyachtFurniture(g, 4, f, z);
          edgeLights(g, offsetOutline(outline, 0.5), z - 3.6);
          // Hardtop over the bar, on two slim posts and the mast.
          const top = deckOutline(-6, 54, 30, 26, 2);
          deckSlab(g, top, z + 24, 2.4, kitWhite, kitWhite);
          for (const side of [-1, 1]) box(g, 0, z + 12, side * 26, 2, 24, 2, kitWhite);
          for (const dv of [-14, 0, 14]) kitLight(marinaLights, g, 20, z + 21, dv, '#ffe0b0');
          // The radar mast: a swept fin with scanners, domes and the masthead light.
          const fin = new Three.Shape();
          fin.moveTo(28, z + 24);
          fin.lineTo(52, z + 24);
          fin.lineTo(46, z + 44);
          fin.lineTo(41, z + 62);
          fin.lineTo(35, z + 63);
          fin.lineTo(33, z + 44);
          fin.closePath();
          const finGeo = new Three.ExtrudeGeometry(fin, { depth: 5, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 1 });
          finGeo.translate(0, 0, -2.5);
          mesh(finGeo, kitWhite, g, 0, 0, 0);
          box(g, 40, z + 50, 0, 3, 2, 34, kitWhite);
          superyachtRadars.push(radarScanner(g, 38, z + 63.5, 0, 18), radarScanner(g, 40, z + 51, 13, 12), radarScanner(g, 40, z + 51, -13, 12));
          for (const dv of [-16, 16]) satDome(g, 12, z + 26.4, dv, 5.5);
          satDome(g, 44, z + 26.4, 0, 3.2);
          box(g, 36, z + 67, 0, 1.6, 2, 1.6, kitLamp);
          kitLight(marinaLights, g, 36, z + 68, 0, '#ffffff');
          strut(g, [30, z + 60, 0], [22, z + 74, 0], 0.8, kitSteel);
        }
        for (const d of decks) kitMerge(d);
        kitMerge(base);
        superyachtDecks.push(...decks.map((group, i) => ({ group, z: Z[i + 2] })));
        return root;
      }
      buildSuperyacht(SUPERYACHT);

      /* ---- The marina fleet ---------------------------------------------------- */
      /**
       * Sixteen boats, sixteen builders. Each works in its own frame (bow +x,
       * starboard +z) with d = the berth's design from MARINA_BERTHS. Shared
       * helpers keep the proportions honest: `yachtSpec` sets a hull from the
       * design and a few overrides.
       */
      function yachtSpec(d, o = {}) {
        const l = d.len;
        return {
          length: l,
          beam: d.beam,
          draft: l * 0.07,
          rake: 0.08,
          forefoot: 0.18,
          keelRise: 0.5,
          bilge: 1.6,
          flare: 0.3,
          tuck: 0.06,
          boot: [-2.4, 0.4],
          stations: 26,
          ...o,
          form: { transom: 0.88, maxAt: -0.1, entry: 1.7, bowShape: 0.72, ...(o.form || {}) },
          sheer: o.sheer || [
            [-0.5, l * 0.1],
            [0.1, l * 0.11],
            [0.5, l * 0.155],
          ],
          colors: { bottom: '#6e2a26', boot: '#262a2e', top: d.hull, bands: [], ...(o.colors || {}) },
        };
      }

      // Teak swim platform across the transom.
      function swimPlatform(g, spec, z, depth = 7) {
        const u = -spec.length / 2,
          hw = hullBeamAt(spec, u, z) * 0.95;
        deckSlab(g, rectOutline(u - depth, u + 0.5, -hw, hw), z, 1.6, kitTeak, kitWhite);
      }
      // Stainless bow rail (pulpit) and side rails from `from` forward.
      function bowRail(g, spec, z, from, height = 5) {
        for (const side of [-1, 1])
          railing(g, hullEdge(spec, z, from, spec.length * 0.47, 1.2, 10).map(([u, v]) => [u, side * v]), z, height, { spacing: 9 });
      }
      function hullWindows(g, spec, u0, u1, z0, z1, count = 3, material = kitGlass) {
        const step = (u1 - u0) / count;
        for (let i = 0; i < count; i++)
          hullBand(g, spec, z0, z1, material, 0.2, (u0 + step * i + step * 0.12) / spec.length, (u0 + step * (i + 1) - step * 0.12) / spec.length);
      }
      // A hardtop roof at height z on posts standing on the deck at `base`.
      function hardtop(g, outline, z, posts, base, material = kitWhite) {
        deckSlab(g, outline, z, 1.4, material, material);
        for (const [u, v] of posts) box(g, u, (z + base) / 2, v, 1.2, z - base, 1.2, kitSteel);
      }
      // A mast with spreaders, forestay, shrouds and backstay; returns the head height.
      function sailRig(g, spec, u, deckZ, height, opts = {}) {
        const { color = tint('#dfe2e4', 'metal'), stay = tint('#aeb4b8', 'metal'), bow = spec.length * 0.48, stern = -spec.length * 0.47, spread = spec.beam * 0.42 } = opts;
        const head = deckZ + height;
        box(g, u, deckZ + height / 2, 0, 1.6, height, 1.3, color);
        for (const f of [0.35, 0.62]) box(g, u, deckZ + height * f, 0, 1, 0.8, spread * (1.3 - f), color);
        strut(g, [u, head, 0], [bow, sheerAt(spec, bow) + 1, 0], 0.35, stay);
        if (opts.backstay !== false) strut(g, [u, head, 0], [stern, sheerAt(spec, stern) + 1, 0], 0.35, stay);
        for (const side of [-1, 1]) {
          const chain = [u - 2, sheerAt(spec, u) + 0.5, side * hullBeamAt(spec, u, deckZ) * 0.95];
          strut(g, [u, head - 1, 0], chain, 0.3, stay);
          strut(g, [u, deckZ + height * 0.62, side * spread * 0.34], chain, 0.3, stay);
        }
        return head;
      }
      // A furled headsail wrapped round the forestay, as a slim spindle.
      function furledJib(g, spec, u, head, deckZ, color = '#e8e4d8') {
        const bow = spec.length * 0.48,
          top = [u + (bow - u) * 0.1, head - 4, 0],
          foot = [bow - 2, sheerAt(spec, bow) + 3, 0];
        const m = strut(g, top, foot, 1.6, tint(color, 'matte'));
        m.scale.x = m.scale.z = 1.3;
        const cover = strut(g, [top[0] + (foot[0] - top[0]) * 0.6, top[1] + (foot[1] - top[1]) * 0.6, 0], foot, 2.2, tint('#1d3f6e', 'matte'));
        return cover;
      }
      function boom(g, u, z, length, coverColor, boomColor = '#dfe2e4') {
        box(g, u - length / 2, z, 0, length, 1.2, 1.1, tint(boomColor, 'metal'));
        sailCover(g, u - length + 2, u - 1, z + 0.4, 0, coverColor);
      }
      function wheel(g, u, z, v = 0, r = 3.2) {
        const w = mesh(new Three.TorusGeometry(r, 0.3, 6, 18), kitSteel, g, u, z + r + 1, v);
        w.rotation.y = Math.PI / 2;
        box(g, u + 1, z + (r + 1) / 2, v, 1.4, r + 1, 1.4, kitSteel);
      }
      function outboard(g, u, z, v, size = 1, color = '#16181b') {
        box(g, u - 2 * size, z + 3 * size, v, 4 * size, 5 * size, 3 * size, tint(color, 'gloss'));
        box(g, u - 1.4 * size, z - 2 * size, v, 1.4 * size, 7 * size, 1 * size, tint('#2a2d31', 'satin'));
      }

      const MARINA_BUILDERS = {
        // A classic cruising sloop: cove stripe, coachroof, cockpit wheel, blue sail covers.
        sloop(g, d, lights) {
          const l = d.len,
            spec = yachtSpec(d, {
              draft: l * 0.05,
              sheer: [
                [-0.5, 7.5],
                [0, 7],
                [0.5, 10],
              ],
              form: { transom: 0.7, maxAt: -0.08, entry: 1.5, bowShape: 0.85 },
              rake: 0.12,
              bilge: 2.2,
              flare: 0.2,
              colors: { bands: [[0.72, 0.8, d.accent]] },
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 6.8, -l * 0.5, l * 0.47, 0.8);
          deckhouse(g, deckOutline(-l * 0.14, l * 0.2, d.beam * 0.3, l * 0.1, 1.8), 6.8, 11, { rake: 3, glassFrom: 0.35, glassTo: 0.7, paint: kitWhite });
          box(g, -l * 0.3, 6.2, 0, l * 0.26, 0.6, d.beam * 0.5, kitTeak);
          for (const side of [-1, 1]) box(g, -l * 0.3, 8, side * d.beam * 0.26, l * 0.24, 3, 4, kitCushion);
          wheel(g, -l * 0.38, 6.8);
          const head = sailRig(g, spec, l * 0.06, 11, l * 1.25);
          boom(g, l * 0.06, 15, l * 0.4, d.accent);
          furledJib(g, spec, l * 0.06, head, 6.8);
          bowRail(g, spec, 6.8, l * 0.2);
          kitLight(lights, g, l * 0.06, head + 1, 0, '#ffffff');
          return spec;
        },
        // A trawler: high bow, raised pilothouse, boat deck with dinghy and steadying mast.
        trawler(g, d, lights) {
          const l = d.len,
            spec = yachtSpec(d, {
              draft: l * 0.08,
              sheer: [
                [-0.5, 12],
                [0, 13],
                [0.5, 21],
              ],
              form: { transom: 0.78, maxAt: -0.06, entry: 1.9, bowShape: 0.7 },
              rake: 0.06,
              bilge: 2.6,
              colors: { boot: '#e7dcc0', bands: [[0.9, 1, '#20251f']] },
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 11.4, -l * 0.5, l * 0.46, 1, kitTeakPale);
          const house = tint(d.accent);
          deckhouse(g, deckOutline(-l * 0.3, l * 0.12, d.beam * 0.4, l * 0.06, 3), 11.4, 22, { paint: house, glassFrom: 0.35, glassTo: 0.72 });
          deckhouse(g, deckOutline(-l * 0.02, l * 0.13, d.beam * 0.36, l * 0.05, 3), 22, 30, { paint: house, rake: 2, glassFrom: 0.2, glassTo: 0.8, glazing: kitBridgeGlass });
          deckSlab(g, deckOutline(-l * 0.04, l * 0.15, d.beam * 0.4, l * 0.04, 3), 31, 1.4, house, house);
          box(g, -l * 0.2, 23, 0, l * 0.18, 1.6, d.beam * 0.8, kitTeakPale);
          ribTender(g, -l * 0.2, 23.5, 0, l * 0.16, '#b64a36', 0);
          box(g, l * 0.05, 45, 0, 1.4, 28, 1.4, tint('#6b5a45', 'satin'));
          strut(g, [l * 0.05, 40, 0], [-l * 0.2, 34, 0], 0.9, tint('#6b5a45', 'satin'));
          radarScanner(g, l * 0.05, 31, 0, 7);
          for (const side of [-1, 1]) railing(g, hullEdge(spec, 11.4, -l * 0.45, l * 0.45, 1, 10).map(([u, v]) => [u, side * v]), 11.4, 5, { material: tint('#6b5a45', 'satin') });
          kitLight(lights, g, l * 0.05, 60, 0, '#ffffff');
          return spec;
        },
        // A flybridge motor yacht: long saloon, overhanging flybridge, hardtop and radar arch.
        flybridge(g, d, lights) {
          const l = d.len,
            b = d.beam,
            spec = yachtSpec(d, {
              sheer: [
                [-0.5, 12],
                [0.05, 13],
                [0.5, 19],
              ],
              bilge: 1.4,
              colors: { bands: [[0.52, 0.57, d.accent]] },
            });
          hullMesh(g, spec);
          swimPlatform(g, spec, 4);
          hullDeck(g, spec, 11.5, -l * 0.5, l * 0.47, 1.2);
          hullWindows(g, spec, -l * 0.16, l * 0.16, 6.2, 9, 3);
          deckhouse(g, deckOutline(-l * 0.22, l * 0.18, b * 0.39, l * 0.15, 1.7), 11.5, 22.5, { rake: 9 });
          const fly = deckOutline(-l * 0.36, l * 0.08, b * 0.43, l * 0.12, 2);
          deckSlab(g, fly, 24.5, 2, kitWhite, kitWhite);
          railing(g, offsetOutline(fly, -1), 24.5, 5, { spacing: 10, closed: true });
          sofa(g, -l * 0.26, 0, 24.5, 8, b * 0.6, 'aft', kitCushion, tint(d.accent, 'matte'));
          box(g, l * 0.0, 27.5, 0, 6, 5, b * 0.3, kitWhite);
          box(g, l * 0.02, 30.5, 0, 1, 2.5, b * 0.28, kitBridgeGlass);
          hardtop(g, deckOutline(-l * 0.12, l * 0.08, b * 0.34, l * 0.06, 2), 36, [
            [-l * 0.1, b * 0.3],
            [-l * 0.1, -b * 0.3],
            [l * 0.04, b * 0.28],
            [l * 0.04, -b * 0.28],
          ], 24.5);
          radarScanner(g, 0, 36.7, 0, 8);
          sofa(g, -l * 0.44, 0, 11.5, 6, b * 0.66, 'aft', kitCushion, tint(d.accent, 'matte'));
          table(g, -l * 0.36, 0, 11.5, 8, 12);
          box(g, l * 0.29, 12.8, 0, l * 0.12, 2.6, b * 0.44, kitCushion);
          bowRail(g, spec, 11.5, l * 0.18);
          kitLight(lights, g, 0, 39, 0, '#ffffff');
          return spec;
        },
        // A varnished mahogany runabout in the Riva manner.
        launch(g, d, lights) {
          const l = d.len,
            spec = yachtSpec(d, {
              draft: l * 0.05,
              sheer: [
                [-0.5, 7],
                [0.2, 8],
                [0.5, 9],
              ],
              form: { transom: 0.8, maxAt: -0.05, entry: 1.8, bowShape: 0.62 },
              rake: 0.14,
              bilge: 1.3,
              colors: { bottom: '#f0ebe0', boot: '#f0ebe0', top: d.hull, bands: [[0.94, 1, '#e8dcc0']] },
              finish: 'gloss',
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 7.6, -l * 0.5, l * 0.48, 0.2, kitMahogany);
          for (const [u, len] of [
            [-l * 0.3, l * 0.14],
            [-l * 0.07, l * 0.16],
          ]) {
            box(g, u, 7.4, 0, len, 1, d.beam * 0.7, tint('#3a2418', 'satin'));
            box(g, u - len * 0.12, 8.8, 0, len * 0.7, 2, d.beam * 0.62, tint(d.accent, 'satin'));
            box(g, u - len * 0.45, 10.5, 0, 2, 5, d.beam * 0.62, tint(d.accent, 'satin'));
          }
          // Chrome-framed windscreen raked over the dashboard.
          const ws = box(g, l * 0.07, 10.6, 0, 0.5, 4.5, d.beam * 0.72, kitGlass);
          ws.rotation.z = 0.6;
          box(g, l * 0.07 - 1.4, 12.4, 0, 0.8, 0.8, d.beam * 0.74, kitSteel);
          box(g, -l * 0.5 + 1, 10, 0, 0.6, 6, 0.6, kitSteel);
          box(g, -l * 0.5 + 1, 12, 1.8, 0.2, 2.2, 3.6, tint('#c7392f', 'matte'));
          return spec;
        },
        // An expedition yacht: plumb bow, tall grey superstructure, crane and orange tender.
        explorer(g, d, lights) {
          const l = d.len,
            b = d.beam,
            spec = yachtSpec(d, {
              draft: l * 0.08,
              sheer: [
                [-0.5, 13],
                [0.1, 15],
                [0.5, 26],
              ],
              form: { transom: 0.9, maxAt: -0.02, entry: 2.1, bowShape: 0.8 },
              rake: 0.01,
              forefoot: 0.12,
              bilge: 2.8,
              colors: { boot: d.accent, bands: [[0.84, 0.88, d.accent]] },
            });
          const grey = tint('#d8dadb');
          hullMesh(g, spec);
          hullDeck(g, spec, 12.5, -l * 0.5, l * 0.47, 1.2, kitTeakPale);
          hullWindows(g, spec, -l * 0.08, l * 0.24, 7, 9.5, 5);
          deckhouse(g, deckOutline(-l * 0.1, l * 0.3, b * 0.42, l * 0.08, 3), 12.5, 24, { paint: grey, rake: 3, glassFrom: 0.3, glassTo: 0.78 });
          deckSlab(g, deckOutline(-l * 0.14, l * 0.31, b * 0.45, l * 0.08, 3), 25.5, 1.5, grey, grey);
          deckhouse(g, deckOutline(0, l * 0.27, b * 0.38, l * 0.07, 3), 25.5, 35, { paint: grey, rake: 4, glazing: kitBridgeGlass, glassFrom: 0.25, glassTo: 0.82 });
          deckSlab(g, deckOutline(-l * 0.02, l * 0.28, b * 0.46, l * 0.06, 3), 36.5, 1.5, grey, grey);
          box(g, l * 0.1, 46, 0, 3, 18, 3, grey);
          box(g, l * 0.1, 52, 0, 2, 2, b * 0.5, grey);
          radarScanner(g, l * 0.1, 55, 0, 10);
          satDome(g, l * 0.2, 37.2, b * 0.24, 3.4);
          satDome(g, l * 0.2, 37.2, -b * 0.24, 3.4);
          // Working aft deck: crane and a big orange RIB.
          box(g, -l * 0.18, 16, b * 0.3, 3, 8, 3, tint(d.accent));
          strut(g, [-l * 0.18, 20, b * 0.3], [-l * 0.36, 30, 0], 1.6, tint(d.accent));
          ribTender(g, -l * 0.34, 12.8, 0, l * 0.2, '#e07a2e', 0);
          bowRail(g, spec, 12.5, l * 0.3);
          for (const side of [-1, 1]) railing(g, hullEdge(spec, 12.5, -l * 0.48, -l * 0.12, 1, 10).map(([u, v]) => [u, side * v]), 12.5, 5);
          kitLight(lights, g, l * 0.1, 57, 0, '#ffffff');
          return spec;
        },
        // A small cuddy-cabin day cruiser with a canvas bimini.
        dayCruiser(g, d, lights) {
          const l = d.len,
            spec = yachtSpec(d, {
              draft: l * 0.05,
              sheer: [
                [-0.5, 7.5],
                [0.5, 10],
              ],
              rake: 0.14,
              bilge: 1.2,
              colors: { bands: [[0.45, 0.62, d.accent]] },
            });
          hullMesh(g, spec);
          swimPlatform(g, spec, 3.4, 5);
          hullDeck(g, spec, 7.4, -l * 0.5, l * 0.47, 1.4, kitNonSlip);
          deckhouse(g, deckOutline(-l * 0.02, l * 0.3, d.beam * 0.36, l * 0.16, 1.6), 7.4, 11, { rake: 6, glassFrom: 0.2, glassTo: 0.6 });
          const ws = box(g, -l * 0.04, 12.5, 0, 0.5, 4, d.beam * 0.7, kitGlass);
          ws.rotation.z = 0.5;
          sofa(g, -l * 0.32, 0, 7.4, 6, d.beam * 0.7, 'aft', kitCushion, tint(d.accent, 'matte'));
          const bimini = deckOutline(-l * 0.3, -l * 0.02, d.beam * 0.4, 0, 2);
          deckSlab(g, bimini, 19, 0.6, tint('#1d2a36', 'matte'), tint('#1d2a36', 'matte'));
          for (const u of [-l * 0.28, -l * 0.04]) for (const side of [-1, 1]) box(g, u, 13.2, side * d.beam * 0.38, 0.6, 11.6, 0.6, kitSteel);
          box(g, l * 0.34, 11.4, 0, l * 0.12, 1.4, d.beam * 0.34, kitCushion);
          bowRail(g, spec, 7.4, l * 0.1, 4);
          return spec;
        },
        // A power catamaran: two hulls, bridge deck, wraparound saloon, flybridge.
        catamaran(g, d, lights) {
          const l = d.len,
            b = d.beam,
            hullBeam = b * 0.3,
            spec = yachtSpec(
              { ...d, beam: hullBeam },
              {
                draft: l * 0.06,
                sheer: [
                  [-0.5, 10],
                  [0.5, 12.5],
                ],
                form: { transom: 0.8, maxAt: -0.05, entry: 1.5, bowShape: 0.9 },
                rake: 0.02,
                bilge: 2,
                flare: 0.1,
                colors: { bands: [[0.5, 0.58, d.accent]] },
              },
            );
          for (const side of [-1, 1]) {
            const h = new Three.Group();
            h.position.z = side * (b / 2 - hullBeam / 2);
            g.add(h);
            hullMesh(h, spec);
            hullWindows(h, spec, -l * 0.2, l * 0.2, 5, 7.5, 3);
          }
          deckSlab(g, deckOutline(-l * 0.5, l * 0.2, b / 2, l * 0.05, 3), 10.5, 4, kitNonSlip, kitWhite);
          // Trampoline net between the bows.
          box(g, l * 0.34, 9.5, 0, l * 0.26, 0.3, b - hullBeam * 1.6, tint('#1d2226', 'matte'));
          deckhouse(g, deckOutline(-l * 0.22, l * 0.16, b * 0.44, l * 0.1, 2.4), 10.5, 21, { rake: 7, glassFrom: 0.2, glassTo: 0.88 });
          const fly = deckOutline(-l * 0.26, l * 0.08, b * 0.4, l * 0.08, 2.4);
          deckSlab(g, fly, 22.5, 1.6, kitWhite, kitWhite);
          sofa(g, -l * 0.18, 0, 22.5, 8, b * 0.5, 'aft', kitCushion, tint(d.accent, 'matte'));
          hardtop(g, deckOutline(-l * 0.14, l * 0.04, b * 0.34, 0, 2), 33, [
            [-l * 0.12, b * 0.3],
            [-l * 0.12, -b * 0.3],
            [l * 0.02, b * 0.3],
            [l * 0.02, -b * 0.3],
          ], 22.5);
          sofa(g, -l * 0.44, 0, 10.5, 6, b * 0.6, 'aft', kitCushion, tint(d.accent, 'matte'));
          kitLight(lights, g, 0, 36, 0, '#ffffff');
          return { ...spec, beam: b };
        },
        // A sport fisherman: flared bow, tuna tower, outriggers and a fighting chair.
        sportfisher(g, d, lights) {
          const l = d.len,
            b = d.beam,
            spec = yachtSpec(d, {
              sheer: [
                [-0.5, 10],
                [0, 11],
                [0.5, 18],
              ],
              flare: 0.48,
              bilge: 1.3,
              rake: 0.12,
              colors: { bands: [[0.66, 0.74, d.accent]] },
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 9.8, -l * 0.5, l * 0.47, 1.2, kitTeak);
          deckhouse(g, deckOutline(-l * 0.08, l * 0.22, b * 0.4, l * 0.12, 1.7), 9.8, 20, { rake: 8, glassFrom: 0.35, glassTo: 0.85 });
          const fly = deckOutline(-l * 0.1, l * 0.12, b * 0.4, l * 0.06, 2);
          deckSlab(g, fly, 21.5, 1.6, kitWhite, kitWhite);
          box(g, l * 0.06, 24, 0, 4, 4, b * 0.4, kitWhite);
          // Tuna tower: four legs rising to a small top station.
          const legs = [
            [-l * 0.06, b * 0.3],
            [-l * 0.06, -b * 0.3],
            [l * 0.1, b * 0.28],
            [l * 0.1, -b * 0.28],
          ];
          for (const [u, v] of legs) strut(g, [u, 21.5, v], [u * 0.4 + l * 0.02, 52, v * 0.4], 0.9, kitSteel);
          deckSlab(g, deckOutline(-l * 0.02, l * 0.08, b * 0.16, 0, 2), 52, 0.8, kitWhite, kitWhite);
          deckSlab(g, deckOutline(-l * 0.05, l * 0.1, b * 0.22, 0, 2), 60, 0.8, tint('#1d2a36', 'matte'), tint('#1d2a36', 'matte'));
          for (const side of [-1, 1]) {
            strut(g, [l * 0.04, 30, side * b * 0.3], [-l * 0.3, 44, side * b * 1.1], 0.6, kitSteel);
            box(g, l * 0.0, 30, side * b * 0.38, 1, 1, 1, kitSteel);
          }
          // Fighting chair in the cockpit.
          box(g, -l * 0.34, 12, 0, 1.4, 4, 1.4, kitSteel);
          box(g, -l * 0.34, 14.8, 0, 5, 1.4, 5, tint('#f2f2ee'));
          box(g, -l * 0.36, 17, 0, 1.4, 4, 5, tint('#f2f2ee'));
          bowRail(g, spec, 9.8, l * 0.22);
          kitLight(lights, g, l * 0.03, 61, 0, '#ffffff');
          return spec;
        },
        // A ketch: dark blue hull, gold cove, main and mizzen masts, deck saloon.
        ketch(g, d, lights) {
          const l = d.len,
            spec = yachtSpec(d, {
              draft: l * 0.05,
              sheer: [
                [-0.5, 9],
                [0, 8.2],
                [0.5, 12],
              ],
              form: { transom: 0.62, maxAt: -0.05, entry: 1.5, bowShape: 0.85 },
              rake: 0.16,
              stemCurve: 1.3,
              bilge: 2.2,
              flare: 0.2,
              colors: { boot: '#c8a45a', bands: [[0.8, 0.84, d.accent]] },
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 8, -l * 0.5, l * 0.48, 0.8, kitTeak);
          deckhouse(g, deckOutline(-l * 0.16, l * 0.14, d.beam * 0.3, l * 0.08, 2), 8, 14, { rake: 4, glassFrom: 0.3, glassTo: 0.8 });
          box(g, -l * 0.3, 9.5, 0, l * 0.14, 2, d.beam * 0.44, kitCushion);
          wheel(g, -l * 0.24, 8);
          const head = sailRig(g, spec, l * 0.1, 8, l * 1.1);
          const mizzen = sailRig(g, spec, -l * 0.34, 8, l * 0.72, { backstay: false, bow: l * 0.08, spread: d.beam * 0.34 });
          boom(g, l * 0.1, 16, l * 0.36, '#c9b58f');
          boom(g, -l * 0.34, 16, l * 0.18, '#c9b58f');
          furledJib(g, spec, l * 0.1, head, 8, '#e0d6bd');
          // Bowsprit.
          box(g, l * 0.53, sheerAt(spec, l * 0.5), 0, l * 0.1, 1.2, 1.4, kitTeak);
          bowRail(g, spec, 8, l * 0.2);
          kitLight(lights, g, l * 0.1, head + 1, 0, '#ffffff');
          kitLight(lights, g, -l * 0.34, mizzen + 1, 0, '#ffffff');
          return spec;
        },
        // A centre-console fishing boat with T-top and twin outboards.
        centerConsole(g, d, lights) {
          const l = d.len,
            b = d.beam,
            spec = yachtSpec(d, {
              draft: l * 0.05,
              sheer: [
                [-0.5, 7.5],
                [0.5, 10.5],
              ],
              rake: 0.15,
              flare: 0.4,
              bilge: 1.1,
              colors: { bands: [[0.8, 1, '#f4f4f0']] },
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 6.5, -l * 0.49, l * 0.47, 1.5, kitNonSlip);
          box(g, 0, 10, 0, l * 0.14, 7, b * 0.36, kitWhite);
          const ws = box(g, l * 0.075, 14.5, 0, 0.5, 3, b * 0.34, kitGlass);
          ws.rotation.z = 0.5;
          box(g, -l * 0.12, 9, 0, 5, 5, b * 0.44, kitCushion);
          hardtop(g, rectOutline(-l * 0.12, l * 0.08, -b * 0.3, b * 0.3), 21, [
            [-l * 0.1, b * 0.24],
            [-l * 0.1, -b * 0.24],
            [l * 0.06, b * 0.24],
            [l * 0.06, -b * 0.24],
          ], 6.5);
          for (let i = 0; i < 4; i++) strut(g, [-l * 0.1, 21, (i - 1.5) * 3], [-l * 0.2, 30, (i - 1.5) * 5], 0.4, kitSteel);
          for (const side of [-1, 1]) outboard(g, -l * 0.5, 4, side * 4.5, 1.1);
          box(g, l * 0.3, 8, 0, l * 0.14, 1.6, b * 0.4, kitCushion);
          return spec;
        },
        // A tri-deck motor yacht: pearl-grey hull, three decks of glass, radar mast.
        megayacht(g, d, lights) {
          const l = d.len,
            b = d.beam,
            spec = yachtSpec(d, {
              draft: l * 0.07,
              sheer: [
                [-0.5, 13],
                [0.1, 15],
                [0.5, 23],
              ],
              rake: 0.05,
              bilge: 2,
              flare: 0.3,
              finish: 'pearl',
              colors: { boot: '#e8e8e4', bands: [[0.88, 0.92, '#e8e8e4']] },
            });
          hullMesh(g, spec);
          swimPlatform(g, spec, 4, 9);
          hullDeck(g, spec, 13.5, -l * 0.5, l * 0.47, 1.4);
          hullWindows(g, spec, -l * 0.2, l * 0.2, 6, 10, 4);
          deckhouse(g, deckOutline(-l * 0.26, l * 0.2, b * 0.4, l * 0.16, 1.8), 13.5, 24, { rake: 8, glassFrom: 0.2, glassTo: 0.86 });
          const upper = deckOutline(-l * 0.33, l * 0.17, b * 0.46, l * 0.14, 1.9);
          deckSlab(g, upper, 25.5, 1.5, kitTeak, kitWhite);
          railing(g, offsetOutline(upper, -1), 25.5, 5, { closed: true, spacing: 10 });
          deckhouse(g, deckOutline(-l * 0.18, l * 0.14, b * 0.38, l * 0.12, 1.8), 25.5, 35, { rake: 9, glassFrom: 0.2, glassTo: 0.86 });
          const sun = deckOutline(-l * 0.24, l * 0.1, b * 0.42, l * 0.1, 1.9);
          deckSlab(g, sun, 36.5, 1.5, kitTeak, kitWhite);
          deckhouse(g, deckOutline(-l * 0.06, l * 0.08, b * 0.3, l * 0.06, 2), 36.5, 43, { rake: 6, glazing: kitBridgeGlass, glassFrom: 0.2, glassTo: 0.9 });
          hotTub(g, -l * 0.16, 0, 36.5, 5);
          for (const side of [-1, 1]) lounger(g, -l * 0.08, side * b * 0.3, 36.5, 9, 4.6);
          box(g, 0, 50, 0, 2.4, 14, 2.4, kitWhite);
          box(g, 0, 54, 0, 2, 1.6, b * 0.4, kitWhite);
          radarScanner(g, 0, 57, 0, 9);
          satDome(g, l * 0.04, 43.5, b * 0.14, 2.6);
          sofa(g, -l * 0.3, 0, 25.5, 6, b * 0.6, 'aft', kitCushion, tint('#3a4a5a', 'matte'));
          sofa(g, -l * 0.42, 0, 13.5, 6, b * 0.66, 'aft', kitCushion, tint('#3a4a5a', 'matte'));
          box(g, l * 0.29, 15, 0, l * 0.1, 2.6, b * 0.44, kitCushion);
          bowRail(g, spec, 13.5, l * 0.2);
          kitLight(lights, g, 0, 59, 0, '#ffffff');
          for (const u of [-l * 0.3, -l * 0.1, l * 0.1]) kitLight(lights, g, u, 24.5, b * 0.47, '#ffd49a');
          return spec;
        },
        // A black sport yacht: low, fast lines, long raked windscreen, hardtop.
        sportYacht(g, d, lights) {
          const l = d.len,
            b = d.beam,
            spec = yachtSpec(d, {
              sheer: [
                [-0.5, 8.5],
                [0.1, 9.5],
                [0.5, 12],
              ],
              rake: 0.16,
              flare: 0.35,
              bilge: 1.2,
              colors: { boot: '#d8d8d4', bands: [[0.6, 0.64, d.accent]] },
            });
          hullMesh(g, spec);
          swimPlatform(g, spec, 3.4, 8);
          hullDeck(g, spec, 8.4, -l * 0.5, l * 0.47, 1.2, kitTeak);
          hullWindows(g, spec, -l * 0.12, l * 0.22, 4.4, 7, 2);
          deckhouse(g, deckOutline(-l * 0.18, l * 0.22, b * 0.4, l * 0.26, 1.5), 8.4, 16, { rake: 16, paint: kitWhite, glassFrom: 0.15, glassTo: 0.95 });
          deckSlab(g, deckOutline(-l * 0.2, l * 0.06, b * 0.42, l * 0.06, 2), 17.5, 1.2, tint('#1a1c1f', 'gloss'), kitWhite);
          box(g, l * 0.3, 10, 0, l * 0.16, 2.4, b * 0.5, kitCushion);
          box(g, -l * 0.4, 10, 0, l * 0.12, 2.4, b * 0.66, kitCushion);
          return spec;
        },
        // A traditional gulet: varnished hull, clipper bow, bowsprit, two masts and an awning.
        gulet(g, d, lights) {
          const l = d.len,
            b = d.beam,
            spec = yachtSpec(d, {
              draft: l * 0.07,
              sheer: [
                [-0.5, 14],
                [-0.1, 11],
                [0.5, 18],
              ],
              form: { transom: 0.55, maxAt: -0.12, entry: 1.6, bowShape: 0.85, sternCurve: 1.8 },
              rake: 0.18,
              stemCurve: 1.6,
              bilge: 2.4,
              colors: { boot: '#f0e6cc', bands: [[0.9, 0.95, '#2c5f8a']] },
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 10.5, -l * 0.5, l * 0.48, 0.8, kitTeakPale);
          deckhouse(g, deckOutline(-l * 0.12, l * 0.14, b * 0.3, l * 0.05, 3), 10.5, 17, { paint: tint('#7b4628', 'gloss'), glassFrom: 0.3, glassTo: 0.7 });
          // Aft deck: a long table and cushions under a canvas awning.
          const awning = deckOutline(-l * 0.48, -l * 0.14, b * 0.42, 0, 2);
          deckSlab(g, awning, 24, 0.5, tint('#efe6cf', 'matte'), tint('#efe6cf', 'matte'));
          for (const [u, v] of [
            [-l * 0.46, b * 0.4],
            [-l * 0.46, -b * 0.4],
            [-l * 0.16, b * 0.4],
            [-l * 0.16, -b * 0.4],
          ])
            box(g, u, 17.5, v, 0.8, 13, 0.8, tint('#7b4628', 'gloss'));
          table(g, -l * 0.3, 0, 12, l * 0.18, b * 0.24, tint('#7b4628', 'gloss'));
          for (const side of [-1, 1]) box(g, -l * 0.3, 13, side * b * 0.3, l * 0.24, 2.4, 5, kitCushion);
          box(g, -l * 0.3, 11.2, 0, l * 0.3, 1.6, b * 0.74, kitTeakPale);
          const head = sailRig(g, spec, l * 0.14, 10.5, l * 0.82, { color: tint('#8a5a36', 'satin'), backstay: false });
          const mizzen = sailRig(g, spec, -l * 0.08, 17, l * 0.5, { color: tint('#8a5a36', 'satin'), backstay: false, bow: l * 0.14 });
          boom(g, l * 0.14, 18, l * 0.22, '#efe6cf', '#8a5a36');
          box(g, l * 0.58, sheerAt(spec, l * 0.5) - 1, 0, l * 0.18, 1.6, 1.6, tint('#8a5a36', 'satin'));
          strut(g, [l * 0.14, head, 0], [l * 0.66, sheerAt(spec, l * 0.5), 0], 0.35, tint('#aeb4b8', 'metal'));
          for (const side of [-1, 1]) railing(g, hullEdge(spec, 10.5, -l * 0.46, l * 0.44, 0.8, 10).map(([u, v]) => [u, side * v]), 10.5, 4, { material: tint('#7b4628', 'gloss') });
          kitLight(lights, g, l * 0.14, head + 1, 0, '#ffffff');
          for (const u of [-l * 0.44, -l * 0.3, -l * 0.18]) kitLight(lights, g, u, 23, 0, '#ffcf8a');
          return spec;
        },
        // A racing yacht: plumb bow, wide open transom, tall carbon rig, twin wheels.
        racer(g, d, lights) {
          const l = d.len,
            b = d.beam,
            spec = yachtSpec(d, {
              draft: l * 0.04,
              sheer: [
                [-0.5, 6],
                [0.5, 8],
              ],
              form: { transom: 0.92, maxAt: -0.15, entry: 1.5, bowShape: 0.9 },
              rake: 0.005,
              forefoot: 0.1,
              bilge: 1.8,
              flare: 0.12,
              colors: { boot: '#e6e6e6', bands: [[0.8, 1, '#12161b']] },
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 5.6, -l * 0.5, l * 0.48, 0.6, kitNonSlip);
          deckhouse(g, deckOutline(-l * 0.1, l * 0.14, b * 0.26, l * 0.08, 1.6), 5.6, 8.4, { paint: tint('#e6e6e6'), glassFrom: 0.3, glassTo: 0.8, rake: 2 });
          for (const side of [-1, 1]) wheel(g, -l * 0.38, 5.6, side * b * 0.22, 4);
          const head = sailRig(g, spec, l * 0.04, 8.4, l * 1.4, { color: tint('#15181c', 'satin'), stay: tint('#15181c', 'satin') });
          boom(g, l * 0.04, 13, l * 0.46, '#15181c', '#15181c');
          furledJib(g, spec, l * 0.04, head, 5.6, '#9aa0a6');
          kitLight(lights, g, l * 0.04, head + 1, 0, '#ffffff');
          return spec;
        },
        // A 1930s commuter: bottle-green hull, long foredeck, varnished house with portholes.
        commuter(g, d, lights) {
          const l = d.len,
            b = d.beam,
            varnish = tint(d.accent, 'gloss'),
            spec = yachtSpec(d, {
              draft: l * 0.05,
              sheer: [
                [-0.5, 9],
                [0.1, 9.5],
                [0.5, 12.5],
              ],
              form: { transom: 0.72, maxAt: -0.05, entry: 1.7, bowShape: 0.8 },
              rake: 0.1,
              stemCurve: 0.8,
              bilge: 1.8,
              colors: { boot: '#e8dcc0', bands: [[0.9, 1, '#e8dcc0']] },
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 8.8, -l * 0.5, l * 0.48, 0.6, kitTeak);
          deckhouse(g, deckOutline(-l * 0.18, l * 0.1, b * 0.36, l * 0.06, 2.4), 8.8, 16, { paint: varnish, glassFrom: 0.35, glassTo: 0.7, rake: 2 });
          deckSlab(g, deckOutline(-l * 0.2, l * 0.11, b * 0.39, l * 0.06, 2.4), 17, 1, tint('#f1ece0'), varnish);
          // Wicker chairs in the open aft cockpit.
          for (const [u, v] of [
            [-l * 0.36, b * 0.18],
            [-l * 0.36, -b * 0.18],
            [-l * 0.28, 0],
          ]) {
            box(g, u, 10.5, v, 4, 3, 4, tint('#c8a46e', 'matte'));
            box(g, u - 2, 13, v, 1, 4, 4, tint('#c8a46e', 'matte'));
          }
          box(g, l * 0.02, 19, 0, 1.2, 4, 1.2, tint('#c9a33a', 'metal'));
          box(g, -l * 0.5 + 1, 13, 0, 0.6, 8, 0.6, varnish);
          box(g, -l * 0.5 + 1, 15.6, 2.4, 0.2, 2.8, 4.6, tint('#1f3d8a', 'matte'));
          return spec;
        },
        // A yellow bowrider with a split windscreen and an outboard.
        runabout(g, d, lights) {
          const l = d.len,
            b = d.beam,
            spec = yachtSpec(d, {
              draft: l * 0.05,
              sheer: [
                [-0.5, 6.5],
                [0.5, 8.5],
              ],
              rake: 0.16,
              bilge: 1.15,
              flare: 0.35,
              colors: { bands: [[0.35, 0.42, '#f4f4f0']] },
            });
          hullMesh(g, spec);
          hullDeck(g, spec, 5.6, -l * 0.48, l * 0.47, 1.6, kitNonSlip);
          for (const u of [-l * 0.32, -l * 0.1, l * 0.24]) box(g, u, 7.4, 0, 5, 3, b * 0.66, tint('#f2f2ee', 'matte'));
          for (const side of [-1, 1]) {
            const ws = box(g, l * 0.06, 9.6, side * b * 0.22, 0.4, 3, b * 0.3, kitGlass);
            ws.rotation.z = 0.5;
          }
          box(g, l * 0.02, 7.8, b * 0.2, 4, 3, 5, tint('#f2f2ee'));
          outboard(g, -l * 0.5, 3.5, 0, 1.2, '#f4f4f0');
          return spec;
        },
      };
      /* Build, name, fender and moor every boat in the basin, then merge the lot
         into a few meshes. Names face aft, which is the side the camera sees. */
      const marinaFleet = new Three.Group();
      scene.add(marinaFleet);
      statics.push({ x: 1070, y: -3530, group: marinaFleet, radius: 520 });
      for (const moored of marinaBoats()) {
        const d = moored.design,
          g = new Three.Group();
        g.position.set(moored.x, 0, moored.y);
        g.rotation.y = -moored.a;
        marinaFleet.add(g);
        const spec = MARINA_BUILDERS[d.type](g, d, marinaLights),
          stern = -d.len / 2,
          transomZ = hullSheer(spec, -0.5),
          dark = ['#17191c', '#1b2c4a', '#1f3d33', '#27503f', '#2b3136', '#2d5f9a', '#7a3f22', '#7b4628'].includes(d.hull);
        kitNameBoard(
          g,
          d.name,
          'HARBOR POINT',
          dark ? '#e6cf96' : '#1e2f45',
          Math.min(d.beam * 0.78, 30),
          stern - 0.6,
          Math.max(3, transomZ * 0.55),
          0,
          -Math.PI / 2,
          d.type === 'launch' || d.type === 'commuter' || d.type === 'gulet',
        );
        // Fenders and lines on the pontoon side.
        const toPontoon = -moored.side;
        for (const f of [-0.3, 0, 0.3]) fender(g, d.len * f, 4, toPontoon * (hullBeamAt(spec, d.len * f, 6) + 1.6), 1.6, '#1c2b3d');
        for (const f of [-0.42, 0.4]) {
          const u = d.len * f,
            z = sheerAt(spec, u);
          strut(g, [u, z, toPontoon * hullBeamAt(spec, u, z) * 0.8], [u + Math.sign(f) * 14, 4.5, toPontoon * (d.beam / 2 + 5)], 0.5, kitRope);
        }
      }
      kitMerge(marinaFleet);

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
            mesh(prismGeometry(ring, ring, deck + level, deck + level + 9, false), kitGlass, g, 0, 0, 0);
            const lip = offsetOutline(outline, 3);
            mesh(prismGeometry(lip, lip, deck + level - 1, deck + level, true, true), kitWhite, g, 0, 0, 0);
          }
          const roof = offsetOutline(outline, 1.5);
          mesh(prismGeometry(roof, roof, deck + high, deck + high + 3, true), tint('#e6e8e6', 'satin'), g, 0, 0, 0);
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
            z = deck + high + 3;
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
        return { group: g, lights };
      }
      const linerClass = buildLinerClass(LINERS[0]);
      kitMerge(linerClass.group);
      for (const ship of LINERS) {
        const g = new Three.Group();
        g.position.set(ship.x, 0, ship.y);
        g.rotation.y = -ship.a;
        scene.add(g);
        statics.push({ x: ship.x, y: ship.y, group: g, radius: 760 });
        for (const part of linerClass.group.children.filter((c) => c.isMesh)) {
          const copy = new Three.Mesh(part.geometry, part.material);
          copy.castShadow = copy.receiveShadow = true;
          g.add(copy);
        }
        const nameShip = (name, u, side) => {
          const hb = hullHalfBeam(ship, u);
          kitNameBoard(g, name, null, '#f2f2ee', 120, u, ship.deck - 8, side * (hb + 1), side > 0 ? 0 : Math.PI);
        };
        nameShip(ship.name.replace('MS ', ''), ship.l / 2 - 170, 1);
        nameShip(ship.name.replace('MS ', ''), ship.l / 2 - 170, -1);
        kitNameBoard(g, ship.name.replace('MS ', ''), 'HARBOR POINT', '#f2f2ee', 110, -ship.l / 2 - 0.5, ship.deck - 12, 0, -Math.PI / 2);
        for (const l of linerClass.lights) kitLight(marinaLights, g, l.position.x, l.position.y, l.position.z, '#' + l.color.getHexString());
        // Stern boarding platform, and a gangway when the ship lies alongside.
        if (ship.berthed) {
          const gate = deckLocal(ship, ship.board.x, ship.board.y);
          box(g, gate.u, ship.deck / 2 + 6, gate.v / 2 + 40, 46, 4, Math.abs(gate.v) - 60, tint('#b9bdb6', 'satin'));
          box(g, gate.u, ship.deck / 2 + 18, gate.v / 2 + 40, 46, 22, 3, kitSteel);
        }
      }
      kitLightCloud(marinaLights, 7);

      /* Per-frame: the superyacht's cutaway and radars, and the shared night lights. */
      function updateMarinaVisuals(deltaSeconds) {
        const cover = superyachtCoverHeight();
        for (const d of superyachtDecks) d.group.visible = d.z < cover;
        for (const [i, r] of superyachtRadars.entries()) r.rotation.y += deltaSeconds * (i ? 2.1 : 1.4);
        updateBoatKitVisuals();
      }
      // END SUBSYSTEM: src/marina3d.js
