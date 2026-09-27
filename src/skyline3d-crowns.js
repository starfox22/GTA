      // FEDERATION EAST's helideck on North Point Key: the pad on its cantilever struts and net, its lights, the lift house and windsock.
      /* Drawn from the deck the game walks and lands on (b.roofDeck, b.deckKeepOuts,
         skyline-lift.js): a disc on the sail tower's roof that overhangs its prow and
         flanks, the way a hotel helideck is hung off the top of a tower. The lift
         house stands on the sail's straight north side, its door facing the pad. */
      const keyPadPaint = new Three.MeshBasicMaterial({ color: '#f1e3ad' }),
        keyPadEdge = new Three.MeshBasicMaterial({ color: '#e8c24a' }),
        keyPadDeck = mat('#394046', 0.82, 0.1),
        keyWhite = mat('#eceae4', 0.5, 0.1),
        keyOrange = mat('#e8742a', 0.6),
        keyNet = new Three.MeshStandardMaterial({ color: '#262b30', roughness: 0.9, transparent: true, opacity: 0.8, side: Three.DoubleSide });
      // A glazed lift house with a bronze door on its south face (the helideck and CIRRUS share it).
      function keyLiftHouse(T, house, sign = null) {
        const b = T.b,
          H = b.height,
          x = house.x - b.x,
          z = house.y - b.y,
          w = house.hx * 2,
          d = house.hy * 2;
        box(T.group, x, H + 11, z, w, 22, d, skyLobby);
        box(T.group, x, H + 22.6, z, w + 4, 1.2, d + 4, skyDarkSteel);
        for (const dx of [-w / 2, w / 2]) box(T.group, x + dx, H + 11, z + d / 2, 1.2, 22, 1.2, skyDarkSteel);
        box(T.group, x, H + 9.5, z + d / 2 + 0.2, 11, 19, 0.5, skyBronze);
        box(T.group, x, H + 9, z + d / 2 + 0.45, 9, 17.4, 0.4, skyDarkSteel);
        box(T.group, x, H + 9, z + d / 2 + 0.6, 0.3, 17.4, 0.2, skyBronze);
        if (sign) atlasSign(T.group, towerNameCell(sign), x, H + 20.2, z + d / 2 + 0.7, Math.min(w - 4, 26), Math.min(w - 4, 26) / 8, neonCutout);
        addGroupGlow(T.group, x, H + 19.5, z + d / 2 + 2, 7, '#ffe3b8', 1.2, { day: 0.1 });
      }
      function buildKeyHelideck(T) {
        const b = T.b,
          H = b.height,
          pad = b.roofDeck[0],
          house = b.deckKeepOuts[0],
          px = pad.x - b.x,
          pz = pad.y - b.y,
          r = pad.r,
          V = (x, y, z) => new Three.Vector3(x, y, z);
        // The deck: a disc on a deep white fascia, clear of the roof below it.
        mesh(new Three.CylinderGeometry(r, r - 3, 6, 56), keyWhite, T.group, px, H - 3, pz);
        mesh(new Three.CylinderGeometry(r - 1.5, r - 1.5, 0.4, 56), keyPadDeck, T.group, px, H + 0.2, pz);
        const flat = (geometry, material, y) => {
          const m = new Three.Mesh(geometry, material);
          m.rotation.x = -Math.PI / 2;
          m.position.set(px, y, pz);
          m.receiveShadow = true;
          T.group.add(m);
        };
        // The yellow edge, the touchdown circle and the H.
        flat(new Three.RingGeometry(r - 5, r - 2.5, 56), keyPadEdge, H + 0.45);
        flat(new Three.RingGeometry(r * 0.6, r * 0.66, 56), keyPadPaint, H + 0.45);
        const s = r / 40;
        box(T.group, px - 7 * s, H + 0.45, pz, 3 * s, 0.1, 20 * s, keyPadPaint);
        box(T.group, px + 7 * s, H + 0.45, pz, 3 * s, 0.1, 20 * s, keyPadPaint);
        box(T.group, px, H + 0.45, pz, 14 * s, 0.1, 3 * s, keyPadPaint);
        // The safety net round the rim, a hair below the deck.
        flat(new Three.RingGeometry(r, r + 7, 56), keyNet, H - 1.2);
        for (let k = 0; k < 20; k++) {
          const a = (k / 20) * TAU;
          addGroupGlow(T.group, px + Math.cos(a) * (r - 1.5), H + 1.2, pz + Math.sin(a) * (r - 1.5), 5, k % 2 ? '#8fffb0' : '#9fc8ff', 1.5, { day: 0.12 });
          // Cantilever struts back to the tower under the deck.
          if (k % 2 === 0) rod(T.group, V(px + Math.cos(a) * (r - 5), H - 6, pz + Math.sin(a) * (r - 5)), V(T.cx + Math.cos(a) * 20, H - 64, T.cz + Math.sin(a) * 20), 1.1, skySteel);
        }
        keyLiftHouse(T, house);
        // A windsock on the lift house, a red light on its far corner.
        const wx = house.x - b.x + house.hx - 2,
          wz = house.y - b.y;
        box(T.group, wx, H + 31, wz, 0.6, 16, 0.6, skySteel);
        const sock = mesh(new Three.ConeGeometry(2.2, 10, 10, 1, true), keyOrange, T.group, wx + 5, H + 37, wz);
        sock.rotation.z = Math.PI / 2;
        skyBeacon(T, house.x - b.x - house.hx + 2, H + 24, wz, 0.2);
        T.top = Math.max(T.top, H + 42);
      }
