      // BEGIN SUBSYSTEM: src/monarch-bridges3d.js — Monarch Isle's two bridges
      /**
       * Monarch Isle's bridges
       * Source: src/monarch-bridges3d.js
       * Scope: createCityRenderer() closure (included after bridges3d.js, whose
       * BRIDGE_BUILDERS name these two builders; function declarations are hoisted,
       * so they are ready when bridges3d.js builds every bridge).
       *
       *   harp       SOVEREIGN BRIDGE: a white steel pylon leaning back at 60
       *              degrees toward the island, a single harp of thirteen parallel
       *              stays down the central reservation, no back stays (the leaning
       *              pylon is the counterweight), after Calatrava's Alamillo. A
       *              white box girder with a glass parapet; the pylon's leading
       *              edges carry LED lines and the stays glow at night.
       *   bowstring  REGENCY BRIDGE: three Belle Epoque bowstring arches in
       *              bronze-green cast iron, each tied by the deck, with lattice
       *              spandrels; granite river piers with cutwaters; four granite
       *              entrance pylons crowned by gilded winged figures; a stone
       *              balustrade and triple-globe candelabra.
       *
       * Frames as in bridges3d.js: x along the deck from its middle toward `b`,
       * z across to the right of a -> b, y up from the road.
       */
      function buildHarpBridge(g, bridge, s, kit) {
        const W = bridge.width,
          H = s.harp,
          white = bridgeGlowPaint('#f3f4f1', '#e4efff', 0.3, 'satin'),
          stays = new Three.MeshStandardMaterial({ color: '#f4f5f6', roughness: 0.3, metalness: 0.55, emissive: '#dff0ff', emissiveIntensity: 0 }),
          led = bridgeLed('#d8ecff', 2.2),
          steel = tint('#dfe2e2', 'metal');
        stays.userData.glow = 1.1;
        bridgeGlowMaterials.push(stays);
        bridgeDeck(g, bridge, s, { fascia: tint('#eceeea', 'satin'), rail: guardGlass(steel, led) });
        // The box girder's soffit: a deep white spine under the deck, tapering at the edges.
        const [w0, w1] = s.water;
        box(g, (w0 + w1) / 2, -8.5, 0, w1 - w0 + 70, 5, W * 0.62, tint('#e2e4e0', 'satin'));
        for (const x of s.approach) approachPier(g, bridge, x, BRIDGE_KIT.concrete);
        // The central reservation the stays anchor in: a raised white spine with an LED strip.
        const r0 = H.stays[0].to.x - 40,
          r1 = H.base + 40;
        box(g, (r0 + r1) / 2, 1.6, 0, r1 - r0, 3.2, H.median * 2, white);
        box(g, (r0 + r1) / 2, 3.3, 0, r1 - r0, 0.3, 1.2, led);
        // The caisson and the plinth the pylon springs from.
        const cap = [];
        for (let i = 0; i < 28; i++) {
          const th = (i / 28) * Math.PI * 2;
          cap.push([H.base + Math.cos(th) * 44, Math.sin(th) * (W / 2 + 32)]);
        }
        mesh(prismGeometry(cap, cap, -14, -0.8, true), BRIDGE_KIT.concrete, g, 0, 0, 0);
        // The pylon: a tapering hexagonal box leaning back over the island side.
        // Built in stacked segments so the faces taper and the leading edges stay crisp.
        const section = (t) => {
          const along = 34 - 18 * t,
            across = 30 - 14 * t;
          return [
            [-along / 2, -across / 2],
            [along / 2 - 6, -across / 2],
            [along / 2, 0],
            [along / 2 - 6, across / 2],
            [-along / 2, across / 2],
            [-along / 2 - 6, 0],
          ];
        };
        const segments = 8;
        for (let k = 0; k < segments; k++) {
          const t0 = k / segments,
            t1 = (k + 1) / segments,
            x0 = H.base + H.tilt.x * H.length * t0,
            x1 = H.base + H.tilt.x * H.length * t1,
            y0 = H.tilt.y * H.length * t0 - (k === 0 ? 10 : 0),
            y1 = H.tilt.y * H.length * t1,
            bottom = section(t0).map(([u, v]) => [x0 + u, v]),
            top = section(t1).map(([u, v]) => [x1 + u, v]);
          mesh(prismGeometry(bottom, top, y0, y1, k === segments - 1), white, g, 0, 0, 0);
        }
        // LED lines up both leading edges (the island-facing corners).
        const edgePoints = (side) => {
          const pts = [];
          for (let k = 0; k <= 12; k++) {
            const t = k / 12,
              sec = section(t);
            pts.push(V3(H.base + H.tilt.x * H.length * t + sec[1][0], H.tilt.y * H.length * t, side * (Math.abs(sec[1][1]) + 0.4)));
          }
          return pts;
        };
        for (const side of [-1, 1]) bridgeTube(g, edgePoints(side), 0.7, led, 5);
        // The crown: a sloped cap and a slim finial.
        const top = H.top;
        bridgeMember(g, V3(top.x, top.y, 0), V3(top.x + H.tilt.x * 30, top.y + H.tilt.y * 30, 0), 6, 6, white);
        // The harp: parallel stays from the pylon's back face down to the median.
        for (const stay of H.stays) {
          const from = V3(stay.from.x - 14, stay.from.y, 0),
            to = V3(stay.to.x, 3.4, 0);
          for (const dz of [-2.2, 2.2]) bridgeCable(g, V3(from.x, from.y, dz), V3(to.x, to.y, dz), 1.1, stays);
          // Anchor housings: on the pylon and in the median.
          box(g, stay.from.x - 15, stay.from.y, 0, 5, 3, 9, steel);
          box(g, to.x, 3.6, 0, 6, 2.4, 9, steel);
        }
        // Lamps: slim blades along both edges, clear of the pylon.
        bridgeLamps(g, bridge, s, kit.lights, kit.pools, 64, 'blade', steel, [[H.base - 70, H.base + 70]]);
        // The name, on the plinth facing each way.
        bridgePlaque(g, 'SOVEREIGN BRIDGE', 'NORTHBANK · MONARCH ISLE', '#14263a', '#f3efe2', 56, H.base - 45, 14, 0, -Math.PI / 2);
        bridgePlaque(g, 'SOVEREIGN BRIDGE', 'NORTHBANK · MONARCH ISLE', '#14263a', '#f3efe2', 56, H.base + 45, 14, 0, Math.PI / 2);
        for (const x of [H.base - 44, H.base + 44]) box(g, x, 7, 0, 1.2, 16, 30, tint('#e8e8e2', 'satin'));
        // Uplights at the pylon's foot.
        for (const side of [-1, 1]) kitLight(kit.lights, g, H.base, 2, side * 20, '#cfe4ff');
        aviationBeacons(g, [V3(top.x + H.tilt.x * 32, top.y + H.tilt.y * 32 + 3, 0), V3(H.base + H.tilt.x * H.length * 0.5, H.tilt.y * H.length * 0.5, 17), V3(H.base + H.tilt.x * H.length * 0.5, H.tilt.y * H.length * 0.5, -17)]);
      }
      function buildBowstringBridge(g, bridge, s, kit) {
        const W = bridge.width,
          B = s.bowstring,
          verdigris = bridgeGlowPaint('#3f6b5c', '#ffe2b0', 0.22, 'satin'),
          dark = tint('#2e4c42', 'satin'),
          granite = tint('#b5ada0', 'matte'),
          graniteDark = tint('#8f877a', 'matte'),
          gold = tint('#d6ae52', 'metal'),
          stone = tint('#d8d0bf', 'matte');
        bridgeDeck(g, bridge, s, { fascia: dark, walk: tint('#b6ab98', 'matte'), rail: guardBalustrade(stone, stone) });
        for (const x of s.approach) cutwaterPier(g, x, 9, W / 2 + 10, -14, -1, graniteDark);
        // Granite piers with cutwaters and a moulded cap under each pair of arch feet.
        for (const f of s.footings) {
          if (f.kind !== 'river pier' && f.kind !== 'abutment pier') continue;
          cutwaterPier(g, f.along, f.hx, f.hy, -16, -4, granite);
          box(g, f.along, -3, 0, f.hx * 2 + 4, 2.2, f.hy * 2 - 10, stone);
          // Bronze lamps on the pier noses, over the water.
          for (const side of [-1, 1]) {
            box(g, f.along, 3, side * (W / 2 + 18), 10, 12, 10, granite);
            box(g, f.along, 9.6, side * (W / 2 + 18), 12, 1.6, 12, stone);
            mesh(sphereGeo, bridgeLampMaterial, g, f.along, 14, side * (W / 2 + 18), 3, 3, 3);
            kitLight(kit.lights, g, f.along, 14, side * (W / 2 + 18), '#ffe2b0');
          }
        }
        // The three arches, both planes: the rib, a tie girder along the deck edge,
        // lattice spandrels (verticals and crossed diagonals) and the crown bracing.
        for (const arch of B.arches) {
          const n = 16,
            step = (arch.to - arch.from) / n,
            rise = (x) => arch.rise * 4 * ((x - arch.from) / (arch.to - arch.from)) * (1 - (x - arch.from) / (arch.to - arch.from));
          for (const side of [-1, 1]) {
            const z = side * B.plane,
              pts = [];
            for (let k = 0; k <= 32; k++) {
              const x = arch.from + ((arch.to - arch.from) * k) / 32;
              pts.push(V3(x, 3 + rise(x), z));
            }
            bridgeTube(g, pts, 2.6, verdigris, 7);
            // A second, lighter chord inside the rib: the arch reads as a trussed band.
            bridgeTube(g, pts.map((p) => V3(p.x, Math.max(3, p.y - 7), p.z)), 1.2, verdigris, 5);
            box(g, (arch.from + arch.to) / 2, 2.4, z, arch.to - arch.from, 4.8, 3, dark);
            for (let k = 1; k < n; k++) {
              const x = arch.from + step * k,
                y = 3 + rise(x);
              bridgeMember(g, V3(x, 4.8, z), V3(x, y - 1, z), 0.9, 1.2, verdigris);
              if (k < n - 1) {
                const x2 = x + step,
                  y2 = 3 + rise(x2);
                bridgeMember(g, V3(x, 4.8, z), V3(x2, y2 - 6, z), 0.5, 0.7, verdigris);
                bridgeMember(g, V3(x2, 4.8, z), V3(x, y - 6, z), 0.5, 0.7, verdigris);
              }
            }
            // Ornamental cast bosses where each arch springs.
            for (const x of [arch.from, arch.to]) {
              box(g, x, 6, z, 10, 12, 7, dark);
              mesh(sphereGeo, gold, g, x, 13, z, 2.2, 2.2, 2.2);
            }
          }
          // Crown bracing between the two ribs, clear over the carriageway.
          for (let k = 3; k <= n - 3; k += 2) {
            const x = arch.from + step * k,
              y = 3 + rise(x);
            if (y < BRIDGE_CLEARANCE + 8) continue;
            bridgeMember(g, V3(x, y - 2, -B.plane), V3(x, y - 2, B.plane), 1.4, 1.6, verdigris);
          }
          // The crown's gilded cartouche on each face.
          const mid = (arch.from + arch.to) / 2;
          for (const side of [-1, 1]) {
            mesh(new Three.CylinderGeometry(4.5, 4.5, 1.2, 16), gold, g, mid, 3 + arch.rise - 5, side * (B.plane + 2.2)).rotation.x = Math.PI / 2;
          }
          // Necklace lights along each rib.
          for (let k = 1; k < 16; k++) {
            const x = arch.from + ((arch.to - arch.from) * k) / 16;
            for (const side of [-1, 1]) kitLight(kit.lights, g, x, 3 + rise(x) + 3, side * B.plane, '#ffe7b8');
          }
        }
        // Entrance pylons: granite columns with a moulded base and capital, a
        // gilded winged figure on a globe at the top.
        for (const p of B.pylons)
          for (const side of [-1, 1]) {
            const z = side * (W / 2 + 14);
            box(g, p, 8, z, 30, 16, 30, granite);
            box(g, p, 17, z, 32, 2, 32, stone);
            box(g, p, 52, z, 22, 68, 22, granite);
            for (const dx of [-8, 8]) box(g, p + dx, 52, z + side * 11.2, 2, 64, 0.8, graniteDark);
            box(g, p, 87, z, 28, 3, 28, stone);
            box(g, p, 91, z, 20, 6, 20, granite);
            // The figure: a globe, a draped body, spread wings, a raised torch.
            mesh(sphereGeo, gold, g, p, 98, z, 5, 5, 5);
            mesh(new Three.ConeGeometry(4.2, 16, 10), gold, g, p, 110, z);
            mesh(sphereGeo, gold, g, p, 120, z, 2.4, 2.8, 2.4);
            for (const wing of [-1, 1]) {
              const w = bridgeMember(g, V3(p, 108, z), V3(p + wing * 11, 124, z - side * 2), 1.2, 6, gold);
              w.castShadow = false;
            }
            bridgeMember(g, V3(p, 116, z), V3(p + 3, 130, z), 0.8, 0.8, gold);
            mesh(sphereGeo, bridgeLampMaterial, g, p + 3, 131.5, z, 1.6, 2.2, 1.6);
            kitLight(kit.lights, g, p + 3, 131.5, z, '#ffd890');
            // Floodlights on the column.
            kitLight(kit.lights, g, p, 20, z, '#ffe2b0');
          }
        bridgeLamps(g, bridge, s, kit.lights, kit.pools, 56, 'globe', dark, [
          ...B.arches.flatMap((a) => [
            [a.from - 14, a.from + 14],
            [a.to - 14, a.to + 14],
          ]),
          ...B.pylons.map((p) => [p - 24, p + 24]),
        ]);
        // Bronze plaques on the pylons' outer faces.
        for (const p of B.pylons)
          for (const side of [-1, 1]) bridgePlaque(g, 'REGENCY BRIDGE', 'MDCCCXCVIII', '#233a31', '#e8cf8a', 20, p, 38, side * (W / 2 + 14 + 11.3), side > 0 ? 0 : Math.PI);
        aviationBeacons(g, B.arches.map((a) => V3((a.from + a.to) / 2, a.rise + 8, 0)));
      }
      // END SUBSYSTEM: src/monarch-bridges3d.js
