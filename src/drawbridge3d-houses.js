      // Drawbridge 3D tender's houses in the other looks: Art Deco towers, 1960s concrete booths and steel control cabins (drawbridgeHouseStyled).
      /* `h` is the house's place on its pier platform (along, across), `main` the
         control house (taller, with the vessel signal mast, the horn and the
         BRIDGE TENDER plaque). Footprints match the Palm Sound houses (32 x 22 for
         the control house, 22 x 18 for the others) so the solids in bridgeStructure
         hold; heights stay under them (64 and 48). Returns the roof's height. */
      function drawbridgeHouseStyled(g, h, kit, main, look) {
        const out = Math.sign(h.across),
          x = h.along,
          z = h.across,
          wall = tint(look.wall, 'satin'),
          trim = tint(look.trim, 'satin'),
          roof = tint(look.roof, 'satin'),
          iron = tint('#1f2a2a', 'satin'),
          door = tint('#2c2f31', 'satin'),
          glass = BRIDGE_KIT.glass,
          w = main ? 32 : 22,
          dz = main ? 22 : 18,
          base = 1.4,
          inZ = z - out * (dz / 2 + 0.15);
        box(g, x, base + 1.5, z, w + 2.4, 3, dz + 2.4, trim);
        // The door on the pit side, a lamp over it.
        box(g, x, base + 3 + 4.5, inZ, 4.4, 9, 0.4, door);
        kitLight(kit.lights, g, x, base + 12.6, inZ - out * 1.2, '#ffd29a');
        let top;
        if (look.houseStyle === 'deco') {
          // Stepped stucco tower: a body, a set-back upper stage, a glazed lantern and
          // a stepped crown; fluted fins up the corners, speed lines, portholes.
          const body = main ? 26 : 16,
            y0 = base + 3;
          box(g, x, y0 + body / 2, z, w, body, dz, wall);
          for (const k of [0, 1, 2]) box(g, x, y0 + body - 3 - k * 1.6, z, w + 0.5, 0.5, dz + 0.5, roof);
          for (const cx of [-1, 1])
            for (const cz of [-1, 1]) box(g, x + cx * (w / 2 - 1.2), y0 + (body + 7) / 2, z + cz * (dz / 2 - 1.2), 2.6, body + 7, 2.6, wall);
          // Fins on the long faces, rising past the parapet.
          for (const face of [-1, 1])
            for (const f of main ? [-6, 0, 6] : [-3.5, 3.5]) box(g, x + f, y0 + body / 2 + 3, z + face * (dz / 2 + 0.6), 1.2, body + 6, 1.2, trim);
          // Portholes: glass discs ringed in the trim.
          for (const face of [-1, 1])
            for (const px of [-w / 2 + 5, w / 2 - 5])
              for (const py of main ? [y0 + 8, y0 + 18] : [y0 + 9]) {
                const ring = mesh(cylinderGeo, trim, g, x + px, py, z + face * (dz / 2 + 0.25), 2.6, 0.5, 2.6);
                ring.rotation.x = Math.PI / 2;
                const pane = mesh(cylinderGeo, glass, g, x + px, py, z + face * (dz / 2 + 0.55), 1.9, 0.2, 1.9);
                pane.rotation.x = Math.PI / 2;
              }
          box(g, x, y0 + 12, inZ - out * 0.6, 7, 0.6, 3, trim);
          const stage = y0 + body,
            sw = w - 8,
            sd = dz - 6,
            sh = main ? 8 : 5;
          box(g, x, stage + sh / 2, z, sw, sh, sd, wall);
          const lantern = stage + sh;
          box(g, x, lantern + 3.5, z, sw - 3, 7, sd - 3, glass);
          for (const cx of [-1, 1]) for (const cz of [-1, 1]) box(g, x + (cx * (sw - 3)) / 2, lantern + 3.5, z + (cz * (sd - 3)) / 2, 0.8, 7, 0.8, trim);
          box(g, x, lantern + 7.5, z, sw, 1, sd, roof);
          box(g, x, lantern + 8.5, z, sw - 4, 1, sd - 4, wall);
          box(g, x, lantern + 9.5, z, sw - 8, 1, sd - 8, roof);
          for (const cx of [-1, 1]) kitLight(kit.lights, g, x + cx * (sw / 2 - 3), lantern + 3.5, z, '#ffcf8c');
          top = lantern + 10;
          if (!main) {
            const spire = mesh(cylinderGeo, trim, g, x, top + 3, z, 0.5, 6, 0.5);
            spire.castShadow = false;
            top += 6;
          }
        } else if (look.houseStyle === 'modern') {
          // Board-marked concrete under a thin cantilevered roof, a ribbon window
          // all round; the control room a glass box on top, overhanging the channel side.
          const body = main ? 14 : 13,
            y0 = base + 3;
          box(g, x, y0 + body / 2, z, w, body, dz, wall);
          for (let yy = y0 + 2; yy < y0 + body; yy += 2.4) box(g, x, yy, z, w + 0.15, 0.15, dz + 0.15, trim);
          box(g, x, y0 + body - 4, z, w + 0.3, 3.6, dz + 0.3, glass);
          box(g, x, y0 + body + 0.8, z, w + 6, 1.6, dz + 6, roof);
          top = y0 + body + 1.6;
          for (const cx of [-1, 1]) kitLight(kit.lights, g, x + cx * (w / 2 - 3), y0 + body - 4, z, '#ffd9a8');
          if (main) {
            const cy = top,
              cw = w - 6,
              cd = dz + 4;
            box(g, x, cy + 0.6, z, cw + 1, 1.2, cd + 1, wall);
            box(g, x, cy + 5.4, z, cw, 8.4, cd, glass);
            for (const cx of [-1, 0, 1]) for (const cz of [-1, 1]) box(g, x + (cx * cw) / 2, cy + 5.4, z + (cz * cd) / 2, 0.7, 8.4, 0.7, iron);
            box(g, x, cy + 10.3, z, cw + 8, 1.4, cd + 8, roof);
            kitLight(kit.lights, g, x, cy + 5, z, '#ffcf8c');
            top = cy + 11;
          }
        } else {
          // 'steel': a ribbed steel-clad cabin; the control room raised on a steel
          // frame for a clear view up and down the channel.
          const body = main ? 12 : 13,
            y0 = base + 3;
          box(g, x, y0 + body / 2, z, w, body, dz, wall);
          for (let k = -w / 2 + 1.5; k < w / 2; k += 2.2)
            for (const face of [-1, 1]) box(g, x + k, y0 + body / 2, z + face * (dz / 2 + 0.2), 0.5, body, 0.4, trim);
          box(g, x, y0 + body - 4, z, w + 0.4, 3, dz + 0.4, glass);
          box(g, x, y0 + body + 0.6, z, w + 1.6, 1.2, dz + 1.6, roof);
          top = y0 + body + 1.2;
          if (main) {
            const cy = top + 12,
              cw = w - 10,
              cd = dz - 4;
            for (const cx of [-1, 1]) for (const cz of [-1, 1]) box(g, x + cx * (cw / 2 - 1), (top + cy) / 2, z + cz * (cd / 2 - 1), 1.4, cy - top, 1.4, iron);
            for (const cz of [-1, 1]) bridgeMember(g, V3(x - cw / 2 + 1, top, z + cz * (cd / 2 - 1)), V3(x + cw / 2 - 1, cy, z + cz * (cd / 2 - 1)), 0.8, 0.8, iron);
            box(g, x, cy + 0.6, z, cw + 2, 1.2, cd + 2, roof);
            box(g, x, cy + 4.6, z, cw, 7, cd, glass);
            for (const cx of [-1, 1]) for (const cz of [-1, 1]) box(g, x + (cx * cw) / 2, cy + 4.6, z + (cz * cd) / 2, 0.8, 7, 0.8, iron);
            box(g, x, cy + 8.6, z, cw + 3, 1, cd + 3, roof);
            kitLight(kit.lights, g, x, cy + 4.6, z, '#ffcf8c');
            top = cy + 9;
          }
        }
        if (!main) return top;
        const mastTop = drawbridgeMast(g, kit, x + w / 2 - 4, z, top, Math.min(62, top + 14), iron);
        // Clear of the door below and (deco) proud of the fins.
        bridgePlaque(g, 'BRIDGE TENDER', drawbridgeView.state.plan.tender || 'BASCULE BRIDGE', look.wall, '#2a2d2f', 18, x, base + 17.5, z - out * (dz / 2 + (look.houseStyle === 'deco' ? 1.6 : 0.7)), out > 0 ? Math.PI : 0);
        return mastTop;
      }
