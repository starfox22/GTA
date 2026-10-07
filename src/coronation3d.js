      // The Coronation Bridge in 3D (BRIDGE_BUILDERS.deco): an Art Deco causeway on column bents, pierced parapets, fluted lamp standards, entrance pylons, and its bascule span.
      /* Built in the bridge's frame like every bridge (bridges3d-build.js): x along
         the deck from its middle, z across to the right of a -> b, y up from the
         road. Function declarations only (BRIDGE_BUILDERS names buildCoronationBridge
         before this file's top level has run). The moving span, its piers and pits,
         the tender's towers (the 'deco' look) and the gates come from
         buildDrawbridgeSpan (drawbridge3d.js). */
      function buildCoronationBridge(g, bridge, s, kit) {
        const W = bridge.width,
          d = s.deco,
          cream = tint('#e4ddcb', 'satin'),
          creamDark = tint('#cbc2ad', 'matte'),
          aqua = tint('#3f9c94', 'gloss'),
          chrome = tint('#c9ced0', 'metal'),
          bronze = tint('#9a7a3e', 'metal');
        bridgeDeck(g, bridge, s, { fascia: cream, walk: tint('#d3c9b3', 'matte'), rail: coronationParapet(cream, chrome), gap: drawbridgeDeckGap(s) });
        // Column bents: two round columns under each approach span's joint, a cap beam
        // with rounded ends, an aquamarine band where they meet.
        for (const x of s.approach) {
          for (const side of [-1, 1]) {
            mesh(cylinderGeo, creamDark, g, x, -26, side * (W / 2 - 20), 6.5, 40, 6.5);
            mesh(cylinderGeo, aqua, g, x, -8.4, side * (W / 2 - 20), 7, 1.2, 7);
          }
          box(g, x, -10.5, 0, 12, 5, W - 22, cream);
          for (const side of [-1, 1]) mesh(cylinderGeo, cream, g, x, -10.5, side * (W / 2 - 11), 6, 5, 6);
        }
        // Fluted lamp standards with stepped lanterns, every 64 along the causeway.
        const gap = drawbridgeLampGap(s),
          [w0, w1] = s.water,
          n = Math.max(1, Math.round((w1 - w0) / 64)),
          step = (w1 - w0) / n;
        for (let k = 0; k <= n; k++) {
          const x = w0 + step * k;
          if (x > gap[0] && x < gap[1]) continue;
          for (const side of [-1, 1]) coronationLamp(g, x, side * (W / 2 + 1.8), side, chrome, aqua, kit);
        }
        // The entrance pylons at both landings, the name on their outer faces.
        for (const [i, along] of d.pylons.entries())
          for (const side of [-1, 1]) coronationPylon(g, along, side * d.across, side, i ? 1 : -1, d.pylonHeight, cream, aqua, chrome, bronze, kit);
        buildDrawbridgeSpan(g, bridge, s, kit);
      }
      /* The parapet: a solid concrete plinth and coping with slender openings
         between square posts, a chrome tube along the top. */
      function coronationParapet(concrete, metal) {
        return (g, x, z, length) => {
          box(g, x, 1.4, z, length, 2.8, 2.2, concrete);
          box(g, x, 6.4, z, length, 1.2, 2.4, concrete);
          for (let k = -length / 2 + 2; k < length / 2; k += 4) box(g, x + k, 4, z, 1.4, 3.6, 1.8, concrete);
          box(g, x, 7.5, z, length, 0.5, 0.5, metal);
        };
      }
      function coronationLamp(g, x, z, side, chrome, aqua, kit) {
        box(g, x, 1.6, z, 3, 3.2, 3, aqua);
        box(g, x, 15, z, 1.6, 24, 1.6, chrome);
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          box(g, x + dx * 1, 12, z + dz * 1, dx ? 0.5 : 1.2, 14, dz ? 0.5 : 1.2, chrome);
        // The lantern: three stepped glass tiers under a chrome cap.
        box(g, x, 28, z, 3.4, 4, 3.4, bridgeLampMaterial);
        box(g, x, 31, z, 2.6, 2, 2.6, bridgeLampMaterial);
        box(g, x, 32.4, z, 3.8, 0.8, 3.8, chrome);
        box(g, x, 26, z, 3.8, 0.6, 3.8, chrome);
        kitLight(kit.lights, g, x, 28.5, z, '#ffe6b8');
        kit.pools.push(bridgePool(g, x, z - side * 8, 38));
      }
      /* An entrance pylon: a granite plinth, a cream shaft with fluted chrome fins on
         its outer face, two setbacks, an aquamarine band and a glass lantern on top
         (lit at night); the bridge's name on the outer face of the a-end's right and
         the b-end's left pylon. `end` is -1 at a, 1 at b. */
      function coronationPylon(g, x, z, side, end, height, cream, aqua, chrome, bronze, kit) {
        const shaft = height - 34;
        box(g, x, 3, z, 22, 6, 22, tint('#8f8a80', 'matte'));
        box(g, x, 6 + shaft / 2, z, 16, shaft, 16, cream);
        box(g, x, 6 + shaft - 8, z, 16.6, 3, 16.6, aqua);
        box(g, x, 6 + shaft + 7, z, 12, 14, 12, cream);
        box(g, x, 6 + shaft + 17, z, 8, 6, 8, bridgeLampMaterial);
        box(g, x, 6 + shaft + 20.5, z, 9, 1, 9, chrome);
        box(g, x, height - 4, z, 1, 8, 1, chrome);
        kitLight(kit.lights, g, x, 6 + shaft + 17, z, '#fff0d0');
        for (const f of [-5, 0, 5]) box(g, x + f, 6 + shaft / 2, z + side * 8.4, 1.2, shaft - 10, 0.8, chrome);
        box(g, x, 18, z + side * 8.3, 14, 1.2, 0.6, bronze);
        if (side === end) bridgePlaque(g, 'CORONATION BRIDGE', 'SUNSET PIER · MONARCH ISLE · 1937', '#1d5550', '#f2ead6', 15, x, 26, z + side * 8.5, side > 0 ? 0 : Math.PI);
      }
