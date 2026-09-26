      // Marina 3D rigging and fleet: furled jibs, booms, wheels, outboards, MARINA_BUILDERS and marinaFleet.
      // A furled headsail wrapped round the forestay, as a slim spindle.
      function furledJib(g, spec, u, head, deckZ, color = '#e8e4d8') {
        const bow = spec.length * 0.48,
          top = [u + (bow - u) * 0.1, head - 4, 0],
          foot = [bow - 2, sheerAt(spec, bow) + 3, 0];
        const m = strut(g, top, foot, 1.6, tint(color, 'matte'));
        m.scale.x = m.scale.z = 0.8;
        const cover = strut(g, [top[0] + (foot[0] - top[0]) * 0.7, top[1] + (foot[1] - top[1]) * 0.7, 0], foot, 2.2, tint('#1d3f6e', 'matte'));
        cover.scale.x = cover.scale.z = 1.1;
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
