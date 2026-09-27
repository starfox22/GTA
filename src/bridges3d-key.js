      // North Point Key Bridge 3D: white twin arches beside the footways, warm LED lines, glass balustrade, globe lamps.
      /* The 'key' style (geography-land.js BRIDGE_DESIGNS.key): a short, low span
         between the two sea walls. The arches stand just outside the deck edges,
         so nothing crosses over the road, and are hung from the deck with thin
         cables; a warm LED line runs under each rib and along the handrail. */
      function buildKeyBridge(g, bridge, s, kit) {
        const W = bridge.width,
          A = s.keyArch,
          white = bridgeGlowPaint('#f2f1ec', '#fff2d8', 0.16, 'satin'),
          led = bridgeLed('#ffcf8a', 1.25, 0),
          hanger = bridgeLed('#fff0d4', 0.3, 0),
          stone = tint('#d6ceb9', 'matte'),
          ribY = (x) => 3 + s.archHeight(x);
        bridgeDeck(g, bridge, s, { fascia: tint('#e8e5dc', 'satin'), walk: stone, rail: guardGlass(tint('#cfd2cf', 'metal'), led) });
        for (const side of [-1, 1]) {
          const rib = [];
          for (let k = 0; k <= 24; k++) {
            const x = A.from + ((A.to - A.from) * k) / 24;
            rib.push(V3(x, ribY(x), side * A.plane));
          }
          bridgeTube(g, rib, 3.4, white, 8);
          bridgeTube(g, rib.map((p) => V3(p.x, p.y - 3.4, p.z)), 0.7, led, 5);
          // Hangers from the deck edge up to the rib.
          for (let x = A.from + 36; x <= A.to - 36; x += 26) bridgeCable(g, V3(x, 1.2, side * (W / 2 + 3)), V3(x, ribY(x) - 2.6, side * A.plane), 0.32, hanger);
          // Springing blocks on the sea walls, clad in the islet's limestone.
          for (const x of [A.from, A.to]) box(g, x, 1, side * A.plane, 22, 10, 16, stone);
        }
        for (const x of [A.from, A.to]) cutwaterPier(g, x, 16, W / 2 + 16, -14, -1, BRIDGE_KIT.concrete);
        bridgeLamps(g, bridge, s, kit.lights, kit.pools, 58, 'globe', tint('#262a2e', 'metal'), [
          [A.from - 24, A.from + 24],
          [A.to - 24, A.to + 24],
        ]);
        bridgePlaque(g, 'NORTH POINT KEY', 'BRIDGE', '#14202b', '#e9d49a', 40, A.from - 34, 10, W / 2 + 6, 0);
        bridgePlaque(g, 'NORTH POINT KEY', 'BRIDGE', '#14202b', '#e9d49a', 40, A.to + 34, 10, -W / 2 - 6, Math.PI);
      }
