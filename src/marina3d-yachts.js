      const marinaStatic = new Three.Group();
      scene.add(marinaStatic);
      batchGroups.push(marinaStatic);
      statics.push({ x: 1600, y: -3800, group: marinaStatic, radius: 2600 });
      const deckWood = staticMat('#a8895f', 0.9),
        pileWood = staticMat('#6d5a45', 0.95),
        glassBlue = staticMat('#9fc4d6', 0.15, 0.6),
        shedGrey = staticMat('#7b8486', 0.8);
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
          box(marinaStatic, f.x + f.w / 2, 8, f.y + d, 4, 9, 4, staticMat('#e9e7e0', 0.5));
          box(marinaStatic, f.x + f.w / 2, 12.8, f.y + d, 4.6, 1, 4.6, staticMat('#2f5f86', 0.5));
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
          box(parent, a[0], (z0 + z1) / 2, a[1], 1.1, z1 - z0, 1.1, kitWhite);
        }
        // Door frames either side of each opening.
        for (const d of doors)
          for (const v of [d[2], d[3]]) box(parent, (d[0] + d[1]) / 2, (z0 + z1) / 2, v, 2.6, z1 - z0, 1.6, kitWhite);
      }
      function sheerAt(spec, u) {
        return hullSheer(spec, u / spec.length);
      }
      // Half-width of a deck outline at a station, for placing things at its edge.
      function pointHalfWidth(outline, u) {
        let best = 0;
        for (let i = 0; i < outline.length; i++) {
          const a = outline[i],
            b = outline[(i + 1) % outline.length];
          if ((a[0] - u) * (b[0] - u) > 0 || a[0] === b[0]) continue;
          const f = (u - a[0]) / (b[0] - a[0]);
          best = Math.max(best, Math.abs(a[1] + (b[1] - a[1]) * f));
        }
        return best;
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
        for (const d of decks) d.userData.lightCloud = true;
        const spec = superyachtHullSpec(ship),
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

        // The ensign on its staff at the stern, and slim columns carrying each
        // deck's aft overhang.
        box(base, -280, Z[0] + 9, -34, 0.8, 18, 0.8, kitSteel);
        box(base, -283.2, Z[0] + 15, -34, 6, 4, 0.3, tint('#b3262d', 'matte'));
        box(base, -283.2, Z[0] + 16.3, -34, 6, 1.2, 0.34, tint('#f2f2ee', 'matte'));
        for (const [level, u] of [
          [2, -183],
          [3, -147],
          [4, -107],
        ]) {
          const lower = Z[level - 1],
            hw = pointHalfWidth(plan.levels[level].outline, u) - 3,
            group = level === 2 ? base : decks[level - 3];
          for (const side of [-1, 1]) box(group, u, (lower + Z[level] - 3) / 2, side * hw, 1.8, Z[level] - 3 - lower, 1.8, kitWhite);
        }
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
