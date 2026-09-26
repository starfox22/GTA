      // CIRRUS on EVOLUTION's roof: teak deck, glass balustrade, marble bar and lit back bar, stools, tables for two, the fire-pit lounge, olive trees, lanterns, the lift house.
      /* Everything stands where skyBarPlan() (skyline-bar.js) puts it, so the people
         sit on these chairs and the player walks round these pieces. Static meshes
         in the tower's group (the static batcher merges them per material); the
         night comes from LED materials (updateSkyline) and glows. */
      const barTeak = mat('#7a563a', 0.74, 0.02),
        barMarble = mat('#efe9df', 0.22, 0.05),
        barBrass = mat('#b8914a', 0.32, 0.85),
        barBase = mat('#1f2327', 0.5, 0.25),
        barLeather = mat('#6a3526', 0.55),
        barCushion = mat('#e7dfcf', 0.92),
        barCushionDark = mat('#27343f', 0.9),
        barLinen = mat('#f4f1ea', 0.85),
        barStone = mat('#d8d0bf', 0.8),
        barOlive = mat('#6a8455', 0.92),
        barTrunk = mat('#5b4a3a', 0.9),
        barBottle = mat('#2f6b52', 0.2, 0.3),
        barAmber = mat('#a4642a', 0.2, 0.3),
        barCoals = new Three.MeshBasicMaterial({ color: '#ff8a3c' }),
        barGlass = new Three.MeshStandardMaterial({ color: '#cfe8ec', transparent: true, opacity: 0.24, roughness: 0.06, metalness: 0.2, side: Three.DoubleSide, depthWrite: false });
      function buildSkyBar(T, plan, sec, top) {
        const b = T.b,
          H = b.height,
          lift = SKY_LIFTS.find((l) => l.b === b);
        if (!lift) return;
        const P = lift.bar,
          g = T.group,
          lx = (p) => p.x - b.x,
          lz = (p) => p.y - b.y,
          warm = skyLed('#ffcf8a', 2.3),
          shelfGlow = skyLed('#ffd9a0', 1.6);
        // The deck, and the balustrade round it: a stone kerb, glass, a brass rail with light under it.
        skyCap(T, top, barTeak, 0.35);
        skyBand(T, plan, sec, H + 0.3, H + 1.8, -0.6, barStone);
        skyBand(T, plan, sec, H + 1.8, H + 9.4, -1.1, barGlass);
        skyBand(T, plan, sec, H + 9.4, H + 10.3, -0.7, barBrass);
        skyBand(T, plan, sec, H + 8.8, H + 9.3, -1.2, warm);
        keyLiftHouse(T, P.house, 'CIRRUS');
        // The bar: marble on a dark base, brass foot rail, a warm line under the top.
        const c = P.counter,
          cx = lx(c),
          cz = lz(c);
        box(g, cx, H + 5.2, cz, c.hx * 2, 9.8, c.hy * 2, barBase);
        box(g, cx, H + 10.5, cz, c.hx * 2 + 2.4, 0.9, c.hy * 2 + 2, barMarble);
        box(g, cx + c.hx + 0.2, H + 9.6, cz, 0.3, 0.5, c.hy * 2 - 2, warm);
        box(g, cx + c.hx + 1.6, H + 1.6, cz, 0.6, 0.6, c.hy * 2, barBrass);
        // The back bar: three lit shelves of bottles against the balustrade.
        const k = P.backBar,
          kx = lx(k),
          kz = lz(k);
        box(g, kx, H + 7, kz, k.hx * 2, 14, k.hy * 2, barBase);
        for (const y of [4.5, 8.5, 12.5]) {
          box(g, kx + k.hx - 0.4, H + y, kz, 1, 0.4, k.hy * 2 - 2, shelfGlow);
          for (let s = -k.hy + 2; s < k.hy - 1; s += 2.6) mesh(cylinderGeo, (s * 7 + y) % 3 < 1.5 ? barBottle : barAmber, g, kx + k.hx - 1.2, H + y + 1.6, kz + s, 0.55, 2.8, 0.55);
        }
        // Stools.
        for (const s of P.stools) {
          mesh(cylinderGeo, barBrass, g, lx(s), H + 3, lz(s), 0.5, 6, 0.5);
          mesh(cylinderGeo, barLeather, g, lx(s), H + 6.2, lz(s), 2.4, 1, 2.4);
        }
        // Tables for two: a marble top on a pedestal, two upholstered chairs, a candle.
        const chair = (s, cushion) => {
          const x = lx(s),
            z = lz(s),
            back = -Math.cos(s.a);
          box(g, x, H + 4, z, 5.4, 1.2, 5.4, cushion);
          box(g, x + back * 2.6, H + 7.4, z, 0.8, 6.4, 5.4, cushion);
          for (const dx of [-2.2, 2.2]) for (const dz of [-2.2, 2.2]) box(g, x + dx, H + 1.8, z + dz, 0.5, 3.6, 0.5, barBase);
        };
        for (const t of P.tables) {
          const x = lx(t),
            z = lz(t);
          mesh(cylinderGeo, barBase, g, x, H + 3, z, 0.8, 6, 0.8);
          mesh(cylinderGeo, barMarble, g, x, H + 6.3, z, 4.6, 0.5, 4.6);
          if (t.kind === 'date') mesh(cylinderGeo, barLinen, g, x, H + 6.2, z, 4.9, 0.4, 4.9);
          for (const s of t.seats) chair(s, t.kind === 'date' ? barCushion : barCushionDark);
          addGroupGlow(g, x, H + 7.6, z, 3.4, '#ffb46b', 1.4, { mode: 'flicker' });
        }
        // The lounge: two low sofas round a fire pit.
        const L = P.lounge,
          fx = lx(L),
          fz = lz(L);
        for (const s of L.sofas) {
          const x = lx(s),
            z = lz(s),
            back = Math.sign(z - fz);
          box(g, x, H + 2, z, 28, 4, 8, barBase);
          box(g, x, H + 4.4, z, 27, 1.2, 7.4, barCushion);
          box(g, x, H + 7, z + back * 3.4, 28, 6, 1.8, barCushion);
          for (const dx of [-14, 14]) box(g, x + dx, H + 5, z, 1.6, 4, 8, barCushion);
        }
        mesh(cylinderGeo, barStone, g, fx, H + 2.2, fz, L.pit, 4.4, L.pit);
        mesh(cylinderGeo, barCoals, g, fx, H + 4.5, fz, L.pit - 2, 0.3, L.pit - 2);
        for (let n = 0; n < 5; n++) addGroupGlow(g, fx + Math.cos(n * 1.3) * 3, H + 6 + (n % 2) * 1.5, fz + Math.sin(n * 1.3) * 3, 7, '#ff9a3c', 2.2, { mode: 'flicker', day: 0.4 });
        signSpill(b.x + fx, b.y + fz, 26, '#ffb46b', 0.45);
        // Olive trees in stone pots.
        for (const p of P.planters) {
          const x = lx(p),
            z = lz(p);
          mesh(cylinderGeo, barStone, g, x, H + 3, z, 5.2, 6, 5.2);
          mesh(cylinderGeo, barTrunk, g, x, H + 9, z, 0.7, 8, 0.7);
          mesh(sphereGeo, barOlive, g, x, H + 15, z, 6.5, 5, 6.5);
        }
        // Lanterns on slim posts round the edge, and a warm wash on the deck.
        const ring = top,
          step = Math.max(1, Math.floor(ring.length / 10));
        for (let i = 0; i < ring.length; i += step) {
          const p = ring[i],
            x = T.cx + (p.x - T.cx) * 0.93,
            z = T.cz + (p.z - T.cz) * 0.93;
          if (Math.hypot(x - lx(P.house), z - lz(P.house)) < 26) continue;
          mesh(cylinderGeo, skyDarkSteel, g, x, H + 7, z, 0.4, 14, 0.4);
          box(g, x, H + 14.6, z, 2.2, 2.6, 2.2, warm);
          addGroupGlow(g, x, H + 14.6, z, 6, '#ffd08a', 1.5, { day: 0.05 });
        }
        signSpill(b.x + T.cx, b.y + T.cz + 10, 70, '#ffc98a', 0.35);
        T.top = Math.max(T.top, H + 26);
      }
