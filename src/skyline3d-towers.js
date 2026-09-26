      // ---- Podium and plaza -----------------------------------------------------------
      function skyPodium(T, height) {
        const { group, W, D } = T,
          lobby = height * 0.56;
        box(group, W / 2, lobby / 2, D / 2, W - 10, lobby, D - 10, skyLobby);
        box(group, W / 2, lobby + (height - lobby) / 2, D / 2, W, height - lobby, D, skyStone);
        for (const x of [4, W - 4]) for (const z of [4, D - 4]) box(group, x, lobby / 2, z, 8, lobby, 8, skyStone);
        // Mullions across the lobby glass on the street faces.
        for (let x = 20; x < W - 12; x += 16) box(group, x, lobby / 2, D - 4.6, 1, lobby, 1.2, skyDarkSteel);
        box(group, W / 2, height + 0.4, D / 2, W - 6, 0.8, D - 6, skyGreenRoof);
        for (const [x, z, w, d] of [
          [W / 2, 1.5, W, 3],
          [W / 2, D - 1.5, W, 3],
          [1.5, D / 2, 3, D],
          [W - 1.5, D / 2, 3, D],
        ])
          box(group, x, height + 1.6, z, w, 3.2, d, skySteel);
        // Entrance canopy on the plaza side.
        box(group, W / 2, lobby - 1, D + 7, Math.min(90, W * 0.45), 1.4, 16, skySteel);
        for (const dx of [-1, 1]) box(group, W / 2 + dx * Math.min(40, W * 0.2), (lobby - 1) / 2, D + 13, 1.2, lobby - 1, 1.2, skyDarkSteel);
        signSpill(T.b.x + W / 2, T.b.y + D + 14, 60, '#ffd9a8', 0.35);
        // The tower's name in lit capitals on the fascia, a stock ticker under it.
        const fascia = height - lobby,
          nameWidth = Math.min(W * 0.7, fascia * 5.6);
        atlasSign(group, towerNameCell(T.b.skyline.name), W / 2, lobby + fascia * 0.6, D + 0.7, nameWidth, nameWidth / 8, neonCutout);
        tickerBand(group, W / 2, lobby + 2.2, D + 0.6, W - 16, 2.8);
        T.podium = height;
      }
      // Fountain, benches and bollard lights on the block's south plaza (once per block).
      function skyPlaza(t) {
        const x0 = blockX(t.bx) + 89,
          y0 = blockY(t.by) + 89,
          fx = x0 + 167,
          fz = y0 + 296,
          g = new Three.Group();
        g.position.set(fx, 0, fz);
        scene.add(g);
        batchGroups.push(g);
        mesh(new Three.CylinderGeometry(24, 25, 2.6, 32), skyStone, g, 0, 1.3, 0);
        mesh(new Three.CylinderGeometry(21.5, 21.5, 0.6, 32), skyWater, g, 0, 2.3, 0);
        mesh(new Three.CylinderGeometry(4, 5, 5, 16), skyStone, g, 0, 2.5, 0);
        mesh(sphereGeo, chrome, g, 0, 10, 0, 5.2, 5.2, 5.2);
        for (let k = 0; k < 6; k++) {
          const a = (k * TAU) / 6;
          addGlow(fx + Math.cos(a) * 17, 3.6, fz + Math.sin(a) * 17, 10, '#9fe8ff', 1.2, { mode: 'pulse', phase: k / 6 });
        }
        signSpill(fx, fz, 46, '#a8e6ff', 0.3);
        registerFootObstacle(fx, fz, 25);
        for (const dx of [-44, 44]) registerFootObstacle(fx + dx, fz, 8, 2.8);
        for (const dx of [-44, 44]) {
          place(pools.benchSeat, fx + dx, 4.2, fz, 16, 1, 5);
          place(pools.benchLeg, fx + dx - 6.5, 2, fz, 1, 4, 4.6);
          place(pools.benchLeg, fx + dx + 6.5, 2, fz, 1, 4, 4.6);
        }
        // Bollard lights along the plaza's south edge.
        for (let x = x0 + 24; x < x0 + 334; x += 48) {
          if (Math.abs(x - fx) < 36) continue;
          place(pools.bollard, x, 2.6, y0 + 324, 1.4, 5.2, 1.4);
          addGlow(x, 5.6, y0 + 324, 7, '#ffe3b8', 1.4, {});
        }
        statics.push({ x: fx, y: fz, group: g, radius: 60 });
      }
      // ---- The designs ------------------------------------------------------------------
      // Each receives T: {b, group, W, D, cx, cz, top} and builds in tower-local units.
      const SKY_DESIGNS = {
        federation(T) {
          const H = T.b.height,
            glass = skyGlass('federation', T.b);
          skyPodium(T, 44);
          const plan0 = planSailTriangle(1, 1),
            sections = [{ y: 40 }, { y: H * 0.72 }, { y: H, s: 0.9 }, { y: H + 46, s: 0.82 }],
            f = fitScale(plan0, sections, T.W / 2 - 6, T.D / 2 - 6),
            plan = scalePlan(plan0, f);
          const top = skyLoft(T, plan, sections, glass, { cap: skyRoof });
          // The glass runs past the roof as a screen; an LED line traces its edge.
          skyBand(T, plan, sections[3], H + 44, H + 47, 0.8, skyLed('#bfe4ff', 3.4));
          for (const y of [H * 0.25, H * 0.5, H * 0.72]) skyBand(T, plan, { y }, y - 2, y + 2, 1.4, skySteel);
          // A slender spire from the roof, over the sharp south prow's axis.
          const px = T.cx,
            pz = T.cz + 4;
          mesh(new Three.CylinderGeometry(1.2, 5, 190, 10), skySteel, T.group, px, H + 95, pz);
          skyBeacon(T, px, H + 192, pz, 0);
          skyBeacon(T, top[0].x, H + 48, top[0].z, 0.3);
          // Vertical LED on the prow (the point nearest the plaza).
          const prow = top.reduce((a, p) => (p.z > a.z ? p : a), top[0]);
          box(T.group, prow.x, (44 + H) / 2, prow.z + 1, 1.6, H - 44, 1.6, skyLed('#bfe4ff', 2.6));
          // Skybridge atrium to the west tower across the passage.
          box(T.group, T.W + 9, 34, 150, 20, 14, 120, skyLobby);
          box(T.group, T.W + 9, 41.5, 150, 22, 1.2, 122, skySteel);
          T.top = Math.max(T.top, H + 192);
        },
        federationWest(T) {
          const H = T.b.height,
            glass = skyGlass('federation', T.b);
          skyPodium(T, 44);
          const plan0 = planSailTriangle(1, 1),
            sections = [{ y: 40, r: Math.PI }, { y: H, r: Math.PI, s: 0.94 }, { y: H + 36, r: Math.PI, s: 0.88 }],
            f = fitScale(plan0, sections, T.W / 2 - 5, T.D / 2 - 5),
            plan = scalePlan(plan0, f);
          const top = skyLoft(T, plan, sections, glass);
          skyBand(T, plan, sections[2], H + 34, H + 37, 0.8, skyLed('#bfe4ff', 3.4));
          for (const y of [H * 0.33, H * 0.66]) skyBand(T, plan, { y, r: Math.PI }, y - 2, y + 2, 1.4, skySteel);
          skyBeacon(T, top[0].x, H + 38, top[0].z, 0.5);
          T.top = Math.max(T.top, H + 38);
        },
        mercury(T) {
          const H = T.b.height,
            glass = skyGlass('mercury', T.b),
            w = T.W - 14,
            d = T.D - 14,
            plan = planRect(w, d, 16),
            amber = skyLed('#ffb35c', 3.6);
          skyPodium(T, 46);
          // Stepped setbacks, each shifting west and north like the real thing.
          const steps = [
            { y0: 42, y1: H * 0.6, sx: 1, sz: 1, ox: 0, oz: 0 },
            { y0: H * 0.6, y1: H * 0.78, sx: 0.8, sz: 1, ox: -w * 0.1, oz: 0 },
            { y0: H * 0.78, y1: H * 0.91, sx: 0.6, sz: 0.84, ox: -w * 0.16, oz: -d * 0.04 },
            { y0: H * 0.91, y1: H, sx: 0.42, sz: 0.62, ox: -w * 0.2, oz: -d * 0.06 },
          ];
          for (const s of steps) {
            const sec = { sx: s.sx, sz: s.sz, ox: s.ox, oz: s.oz };
            skyLoft(T, plan, [{ ...sec, y: s.y0 }, { ...sec, y: s.y1 }], glass);
            skyBand(T, plan, sec, s.y1 - 3, s.y1 + 1, 1.2, amber);
            skyFins(T, plan, { ...sec, y: s.y0 }, s.y0 + 2, s.y1 - 3, 22, 3.2, 1.4, skyBronze);
          }
          // Copper pyramid and spire on the last step.
          const last = steps[3],
            sx = T.cx + last.ox,
            sz = T.cz + last.oz,
            r = Math.min(w * last.sx, d * last.sz) * 0.5;
          const pyramid = mesh(new Three.ConeGeometry(r, 80, 4), skyBronze, T.group, sx, H + 40, sz);
          pyramid.rotation.y = Math.PI / 4;
          mesh(new Three.CylinderGeometry(0.8, 2.4, 110, 8), skySteel, T.group, sx, H + 135, sz);
          box(T.group, sx, H + 30, sz + r * 0.5, r * 0.7, 3, 1, amber);
          skyBeacon(T, sx, H + 192, sz, 0.1);
          T.top = Math.max(T.top, H + 192);
        },
        capitals(T) {
          const H = T.b.height,
            dark = skyGlass('capitalsDark', T.b),
            light = skyGlass('capitalsLight', T.b),
            blockH = 96,
            count = Math.round((H - 44) / blockH),
            span = (H - 44) / count,
            plan0 = planRect(1, 1.3),
            sections = [];
          skyPodium(T, 44);
          for (let k = 0; k < count; k++) sections.push({ y: 44 + k * span, r: (k % 2 ? 1 : -1) * 0.1, ox: (k % 2 ? 4 : -4), oz: ((k % 3) - 1) * 3 });
          const f = fitScale(plan0, sections, T.W / 2 - 5, T.D / 2 - 5),
            plan = scalePlan(plan0, f);
          // The core shows in the reveal between the stacked blocks.
          skyLoft(T, scalePlan(plan0, f * 0.86), [{ y: 42 }, { y: H - 2 }], skyCore, { cap: null });
          sections.forEach((sec, k) => {
            const y0 = sec.y + 2.5,
              y1 = sec.y + span - 2.5;
            skyLoft(T, plan, [{ ...sec, y: y0 }, { ...sec, y: y1 }], k % 2 ? light : dark, { cap: k === count - 1 ? skyRoof : skyDarkStone });
            if (k === count - 1) {
              skyBand(T, plan, sec, y1 - 1, y1 + 3, 1, skyLed('#e8f2ff', 3));
              skyRoofPlant(T, y1, 50, 60, sec.ox, sec.oz);
            }
          });
          skyBeacon(T, T.cx, H + 8, T.cz, 0.2);
          T.top = Math.max(T.top, H + 8);
        },
        capitalsBay(T) {
          const H = T.b.height,
            dark = skyGlass('capitalsDark', T.b),
            light = skyGlass('capitalsLight', T.b),
            count = 6,
            span = (H - 40) / count,
            shifts = [-7, 6, -3, 7, -6, 3];
          skyPodium(T, 40);
          const plan = planRect(T.W - 30, T.D - 26);
          skyLoft(T, planRect(T.W - 40, T.D - 36), [{ y: 38 }, { y: H - 2 }], skyCore, { cap: null });
          for (let k = 0; k < count; k++) {
            const sec = { ox: shifts[k], oz: -shifts[(k + 2) % count] * 0.8 };
            skyLoft(T, plan, [{ ...sec, y: 40 + k * span + 2 }, { ...sec, y: 40 + (k + 1) * span - 2 }], k % 2 ? dark : light, { cap: k === count - 1 ? skyRoof : skyDarkStone });
          }
          skyBand(T, plan, { ox: shifts[count - 1], oz: -shifts[1] * 0.8 }, H - 3, H + 1, 1, skyLed('#e8f2ff', 3));
          skyRoofPlant(T, H - 2, 44, 50, shifts[count - 1], -shifts[1] * 0.8);
          skyBeacon(T, T.cx, H + 4, T.cz, 0.7);
        },
        evolution(T) {
          const H = T.b.height,
            glass = skyGlass('evolution', T.b),
            plan0 = planSuper(1, 0.64, 2.6, 48),
            sections = [];
          skyPodium(T, 42);
          const steps = 34;
          for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            sections.push({ y: 40 + (H - 40) * t, r: t * 2.6, s: 1 + 0.05 * Math.sin(t * Math.PI) });
          }
          const f = fitScale(plan0, sections, T.W / 2 - 6, T.D / 2 - 6),
            plan = scalePlan(plan0, f);
          skyLoft(T, plan, sections, glass);
          // Two seams run up the narrow ends and twist with the tower (lit at night).
          for (const index of [0, plan.length / 2]) skyRibbon(T, plan, sections, index, 7, skyLed('#8fd8ff', 1.6));
          // Colour-walking LED crown.
          const last = sections[steps];
          skyBand(T, plan, last, H - 5, H + 2, 1.2, skyLed('#8fd8ff', 3.6, true));
          skyBand(T, plan, sections[Math.round(steps / 2)], H / 2 + 18, H / 2 + 22, 1.1, skyLed('#8fd8ff', 2.4, true));
          skyBeacon(T, T.cx, H + 12, T.cz, 0.4);
          mesh(cylinderGeo, skyDarkSteel, T.group, T.cx, H + 5, T.cz, 1, 10, 1);
        },
        embankment(T) {
          const H = T.b.height,
            glass = skyGlass('embankment', T.b),
            plan = planD(T.W - 12, T.D - 12);
          skyPodium(T, 46);
          skyLoft(T, plan, [{ y: 42 }, { y: H }], glass);
          for (let y = 150; y < H - 20; y += 108) skyBand(T, plan, { y }, y - 2.5, y + 2.5, 1.6, skySteel);
          // Open crown frame over the roof, lit along its ring.
          const crown = offsetPlan(plan, -8);
          for (let i = 0; i < crown.length; i += 3) {
            const p = crown[i];
            box(T.group, T.cx + p.x, H + 22, T.cz + p.z, 1.6, 44, 1.6, skySteel);
          }
          skyBand(T, crown, { y: H + 44 }, H + 42, H + 46, 1.4, skyLed('#dff4ff', 3.2));
          skyRoofPlant(T, H, 60, 50, 0, -20);
          skyBeacon(T, T.cx, H + 60, T.cz - T.D * 0.2, 0.6);
          mesh(cylinderGeo, skySteel, T.group, T.cx, H + 30, T.cz - T.D * 0.2, 1, 60, 1);
        },
        embankmentLow(T) {
          const H = T.b.height,
            glass = skyGlass('embankmentLow', T.b),
            sections = [{ y: 38, r: -Math.PI / 2 }, { y: H, r: -Math.PI / 2 }];
          skyPodium(T, 40);
          // planD is w by d; turned a quarter it has to fit d by w.
          const turned = planD(T.D - 12, T.W - 12);
          skyLoft(T, turned, sections, glass);
          for (let y = 120; y < H - 20; y += 90) skyBand(T, turned, sections[0], y - 2, y + 2, 1.4, skySteel);
          skyBand(T, turned, sections[1], H - 3, H + 1, 1, skyLed('#dff4ff', 3));
          skyRoofPlant(T, H, 40, 60);
          skyBeacon(T, T.cx, H + 4, T.cz, 0.8);
        },
        sail(T) {
          const H = T.b.height,
            glass = skyGlass('sail', T.b),
            w = T.W - 12,
            plan = planLens(w, T.D - 12),
            rise = 110,
            left = T.cx - w / 2;
          skyPodium(T, 46);
          // The roof sweeps up to the west like a sail.
          const roofLine = (x) => H + rise * Math.pow(1 - (x - left) / w, 1.6);
          const top = skyLoft(T, plan, [{ y: 42 }, { y: H }], glass, { top: (x) => roofLine(x), cap: glass });
          for (let y = 140; y < H - 20; y += 126) skyBand(T, plan, { y }, y - 2, y + 2, 1.2, skySteel);
          // LED lights along the sail's edge.
          for (const p of top) addGroupGlow(T.group, p.x, p.y + 1.5, p.z, 9, '#cfe9ff', 1.8, { day: 0 });
          const west = top.reduce((a, p) => (p.x < a.x ? p : a), top[0]);
          skyBeacon(T, west.x + 6, west.y + 3, west.z, 0.9);
          T.top = Math.max(T.top, H + rise + 4);
        },
        neva(T, mirror = false) {
          const H = T.b.height,
            glass = skyGlass('neva', T.b),
            plan = planChevron(T.W - 12, T.D - 12),
            led = skyLed('#ffffff', 2.8);
          skyPodium(T, 44);
          const top = skyLoft(T, plan, [{ y: 40 }, { y: H }], glass);
          skyBand(T, plan, { y: H }, H - 3, H + 2, 1, skySteel);
          skyRoofPlant(T, H, T.W * 0.36, T.D * 0.3, 0, -T.D * 0.12);
          // Vertical light lines on every outside corner.
          for (const p of top) {
            if (p.z < T.cz - T.D * 0.3 && Math.abs(p.x - T.cx) < 4) continue;
            box(T.group, p.x, (44 + H) / 2, p.z, 1.5, H - 44, 1.5, led);
          }
          skyBeacon(T, T.cx, H + 16, T.cz, mirror ? 0.5 : 0);
          mesh(cylinderGeo, skySteel, T.group, T.cx, H + 8, T.cz, 0.9, 16, 0.9);
        },
        nevaTwo(T) {
          SKY_DESIGNS.neva(T, true);
        },
        oko(T) {
          const H = T.b.height,
            glass = skyGlass('oko', T.b),
            plan = planRounded(T.W - 12, T.D - 12, 0.22),
            rise = 70,
            back = T.cz - (T.D - 12) / 2;
          skyPodium(T, 44);
          // The crown is cut on a slope that rises to the north, facing the plaza.
          skyLoft(T, plan, [{ y: 40 }, { y: H }], glass, { top: (x, z) => H + rise * (1 - (z - back) / (T.D - 12)), cap: glass });
          for (let y = 112; y < H - 10; y += 72) skyBand(T, plan, { y }, y - 2.5, y + 2.5, 1.4, skySteel);
          skyBand(T, plan, { y: H }, H - 3, H + 1, 1.4, skyLed('#fff1d6', 2.8));
          skyBeacon(T, T.cx, H + rise + 4, back + 8, 0.25);
          T.top = Math.max(T.top, H + rise + 4);
        },
        needle(T) {
          const H = T.b.height,
            glass = skyGlass('needle', T.b),
            plan = planRect(T.W - 12, T.D - 12, 18);
          skyPodium(T, 40);
          skyLoft(T, plan, [{ y: 38 }, { y: H, s: 0.62 }], glass, { cap: null });
          skyLoft(T, plan, [{ y: H, s: 0.62 }, { y: H + 90, s: 0.05 }], glass, { cap: null });
          skyBand(T, plan, { y: H, s: 0.62 }, H - 2, H + 2, 1.2, skyLed('#dcefff', 3));
          mesh(new Three.CylinderGeometry(0.7, 2.2, 130, 8), skySteel, T.group, T.cx, H + 90 + 65, T.cz);
          skyBeacon(T, T.cx, H + 88, T.cz, 0.15);
          skyBeacon(T, T.cx, H + 222, T.cz, 0.15);
        },
        crown(T) {
          const H = T.b.height,
            glass = skyGlass('crown', T.b),
            plan = planRect(T.W - 12, T.D - 12, 26),
            gold = skyLed('#ffcf7a', 2.2);
          skyPodium(T, 44);
          skyLoft(T, plan, [{ y: 40 }, { y: H }], glass);
          skyFins(T, plan, { y: 40 }, 46, H - 4, 26, 2.6, 1.2, skyBronze);
          // A crown of gilded fins round a lit lantern.
          skyFins(T, plan, { y: H }, H, H + 86, 13, 4, 1.6, gold);
          skyLoft(T, planRect(T.W * 0.45, T.D * 0.45, 12), [{ y: H }, { y: H + 62 }], skyLed('#ffe2a8', 1.3));
          skyBand(T, plan, { y: H }, H - 1, H + 3, 1.6, skyBronze);
          mesh(cylinderGeo, skySteel, T.group, T.cx, H + 90, T.cz, 1.2, 56, 1.2);
          skyBeacon(T, T.cx, H + 120, T.cz, 0.35);
        },
        rotunda(T) {
          const H = T.b.height,
            glass = skyGlass('rotunda', T.b),
            r = Math.min(T.W, T.D) / 2 - 6,
            plan = planCircle(r, 36);
          skyPodium(T, 38);
          skyLoft(T, plan, [{ y: 34 }, { y: H }], glass);
          skyFins(T, plan, { y: 34 }, 40, H - 2, 0, 4, 1.4, skySteel, true);
          skyBand(T, plan, { y: H }, H - 4, H + 2, 1.6, skyLed('#ffd9a0', 3));
          const dome = mesh(new Three.SphereGeometry(r * 0.55, 24, 10, 0, TAU, 0, Math.PI / 2), chrome, T.group, T.cx, H, T.cz);
          dome.scale.y = 0.55;
          mesh(cylinderGeo, skySteel, T.group, T.cx, H + r * 0.3 + 18, T.cz, 1, 36, 1);
          skyBeacon(T, T.cx, H + r * 0.3 + 37, T.cz, 0.65);
        },
        meridian(T) {
          const H = T.b.height,
            glass = skyGlass('meridian', T.b),
            plan = planRounded(T.W - 12, T.D - 12, [0, 0, 0.36, 0.36]);
          skyPodium(T, 42);
          skyLoft(T, plan, [{ y: 38 }, { y: H }], glass);
          for (let y = 128; y < H - 10; y += 90) skyBand(T, plan, { y }, y - 2, y + 2, 1.3, skySteel);
          // Penthouse lantern and a glass fin.
          const pent = planRounded((T.W - 12) * 0.6, (T.D - 12) * 0.55, [0, 0, 0.36, 0.36]);
          skyLoft(T, pent, [{ y: H, oz: -10 }, { y: H + 44, oz: -10 }], glass);
          skyBand(T, pent, { y: H + 44, oz: -10 }, H + 41, H + 45, 1, skyLed('#d8ecff', 3));
          box(T.group, T.cx - T.W * 0.2, H + 50, T.cz - 10, 2, 100, T.D * 0.4, skySteel);
          skyBeacon(T, T.cx - T.W * 0.2, H + 102, T.cz - 10, 0.45);
        },
        terraces(T) {
          const H = T.b.height,
            glass = skyGlass('terraces', T.b),
            w = T.W - 8,
            d = T.D - 8;
          skyPodium(T, 36);
          // Terraces step back from the plaza; each carries a roof garden.
          const tiers = [
            [34, H * 0.46, d, 0],
            [H * 0.46, H * 0.7, d * 0.74, -d * 0.13],
            [H * 0.7, H * 0.88, d * 0.5, -d * 0.25],
            [H * 0.88, H, d * 0.3, -d * 0.35],
          ];
          for (const [y0, y1, depth, oz] of tiers) {
            const plan = planRect(w, depth);
            skyLoft(T, plan, [{ y: y0, oz }, { y: y1, oz }], glass, { cap: skyGreenRoof });
            skyBand(T, plan, { oz }, y1 - 2, y1 + 3, 1, skyStone);
            const front = T.b.y + T.cz + oz + depth / 2 - 8;
            for (let x = T.b.x + 20; x < T.b.x + T.W - 20; x += 22) {
              place(pools.planter, x, y1 + 1.5, front, 12, 3, 5);
              place(pools.shrub, x, y1 + 5, front, 5, 4, 4);
            }
          }
          skyBeacon(T, T.cx, H + 12, T.cz - d * 0.35, 0.9);
        },
        diagrid(T) {
          const H = T.b.height,
            glass = skyGlass('diagrid', T.b),
            // The shaft fills the lot: its roof is a landing pad (rooftops.js).
            w = T.W - 3,
            d = T.D - 3,
            plan = planRect(w, d);
          skyPodium(T, 42);
          skyLoft(T, plan, [{ y: 38 }, { y: H }], glass);
          skyBand(T, plan, { y: H }, H - 3, H + 2, 1.5, skySteel);
          for (const [x, z, pw, pd] of [
            [T.W / 2, 2, T.W, 4],
            [T.W / 2, T.D - 2, T.W, 4],
            [2, T.D / 2, 4, T.D],
            [T.W - 2, T.D / 2, 4, T.D],
          ])
            box(T.group, x, H + 1.6, z, pw, 3.2, pd, skySteel);
          // Exoskeleton: diagonal braces on all four faces.
          const bay = 60,
            rise = 76,
            V = (x, y, z) => new Three.Vector3(x, y, z);
          for (const [ax, az, bx, bz, nx, nz] of [
            [T.cx - w / 2, T.cz + d / 2, T.cx + w / 2, T.cz + d / 2, 0, 1],
            [T.cx - w / 2, T.cz - d / 2, T.cx + w / 2, T.cz - d / 2, 0, -1],
            [T.cx - w / 2, T.cz - d / 2, T.cx - w / 2, T.cz + d / 2, -1, 0],
            [T.cx + w / 2, T.cz - d / 2, T.cx + w / 2, T.cz + d / 2, 1, 0],
          ]) {
            const len = Math.hypot(bx - ax, bz - az),
              bays = Math.max(1, Math.round(len / bay));
            for (let y = 44; y + rise <= H; y += rise)
              for (let k = 0; k < bays; k++) {
                const t0 = k / bays,
                  t1 = (k + 1) / bays,
                  p0 = [ax + (bx - ax) * t0 + nx * 1.2, az + (bz - az) * t0 + nz * 1.2],
                  p1 = [ax + (bx - ax) * t1 + nx * 1.2, az + (bz - az) * t1 + nz * 1.2];
                rod(T.group, V(p0[0], y, p0[1]), V(p1[0], y + rise, p1[1]), 1.3, skySteel);
                rod(T.group, V(p1[0], y, p1[1]), V(p0[0], y + rise, p0[1]), 1.3, skySteel);
              }
          }
          if (T.b.helipad) roofHelipad(T.group, T.b, H);
          else skyRoofPlant(T, H, w * 0.4, d * 0.34);
          // Warning-light mast in a corner, clear of the pad.
          box(T.group, T.W - 16, H + 20, T.D - 16, 1.2, 40, 1.2, skySteel);
          roofKeepOut(T.b.x + T.W - 16, T.b.y + T.D - 16, 8, 8);
          skyBeacon(T, T.W - 16, H + 41, T.D - 16, 0.05);
        },
      };
      // Builds a planned tower into `group` (placed at the lot's corner).
      function buildSkylineTower(b, group) {
        const t = b.skyline;
        skySeed = 7919 + SKYLINE_TOWERS.indexOf(t) * 104729;
        const T = { b, group, W: b.w, D: b.h, cx: b.w / 2, cz: b.h / 2, top: b.height, podium: 0 };
        SKY_DESIGNS[t.design](T);
        // Nothing lands on a tower but the one with a pad.
        if (!b.helipad) roofKeepOut(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);
        if (skylineBlockTowers(t.bx, t.by)[0] === t) skyPlaza(t);
        b.crownHeight = Math.max(0, T.top - b.height);
        return skyGlassMaterials.get(SKY_GLAZING_KEYS[t.design]);
      }
      const SKY_GLAZING_KEYS = {
        federationWest: 'federation',
        capitals: 'capitalsDark',
        capitalsBay: 'capitalsLight',
        nevaTwo: 'neva',
      };
      for (const key of Object.keys(SKY_DESIGNS)) if (!SKY_GLAZING_KEYS[key]) SKY_GLAZING_KEYS[key] = key;
      // Night: LED crowns follow the dark (and the district's power), one walks its hue.
      function updateSkyline(night) {
        const power = sideJobPower(2700, -2600);
        for (const led of skyLeds) {
          led.material.emissiveIntensity = night * led.base * power;
          if (led.cycle) led.material.emissive.setHSL((gameTime * 0.03) % 1, 0.75, 0.62);
        }
        skyLobby.emissiveIntensity = 0.1 + night * 0.8 * power;
      }
