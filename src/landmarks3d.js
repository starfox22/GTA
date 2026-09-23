      // BEGIN SUBSYSTEM: src/landmarks3d.js — City landmark meshes
      /**
       * City landmark meshes
       * Source: src/landmarks3d.js
       * Scope: createCityRenderer() closure.
       * Distinctive buildings, waterfront and landmark details.
       */
      // Suspension bridges, waterside gardens and a civic precinct give the city its landmarks.
      const bridgeSteel = mat('#78534b', 0.55, 0.6),
        cableMat = mat('#b8b5a7', 0.4, 0.6),
        waterBlue = mat('#335d6b', 0.25, 0.45);
      for (let bridgeIndex = 0; bridgeIndex < BRIDGES.length; bridgeIndex++) {
        const z = BRIDGES[bridgeIndex],
          left = RIVER.left,
          right = RIVER.right,
          group = new Three.Group();
        scene.add(group);
        batchGroups.push(group);
        for (const side of [-1, 1]) {
          box(group, (left + right) / 2, 3, z + side * 61, right - left, 6, 5, concrete);
          box(group, (left + right) / 2, 9, z + side * 61, right - left, 1.4, 1.3, cableMat);
          for (let x = left + 5; x < right; x += 27)
            box(group, x, 6, z + side * 61, 1.5, 6, 1.5, cableMat);
          for (const x of [left + 115, right - 115]) {
            box(group, x, 49, z + side * 69, 10, 98, 11, bridgeSteel);
            box(group, x, 99, z + side * 69, 14, 3, 15, chrome);
            box(group, x, 1, z + side * 69, 23, 4, 24, concrete);
          }
          for (let x = left; x < right; x += 18) {
            const arch = (q) =>
              q < left + 115
                ? 12 + ((q - left) / 115) * 80
                : q > right - 115
                  ? 12 + ((right - q) / 115) * 80
                  : 35 + 57 * ((q - (left + right) / 2) / 155) ** 2;
            const x2 = Math.min(right, x + 18),
              y = arch(x),
              y2 = arch(x2);
            rod(
              group,
              new Three.Vector3(x, y, z + side * 69),
              new Three.Vector3(x2, y2, z + side * 69),
              0.9,
              cableMat,
            );
            if (x > left + 115 && x < right - 115)
              rod(
                group,
                new Three.Vector3(x, 7, z + side * 61),
                new Three.Vector3(x, y, z + side * 69),
                0.42,
                cableMat,
              );
          }
        }
        for (const x of [left + 115, right - 115]) {
          box(group, x, 85, z, 6, 6, 146, bridgeSteel);
          for (const side of [-1, 1])
            rod(
              group,
              new Three.Vector3(x, 62, z + side * 65),
              new Three.Vector3(x, 84, z + side * 40),
              2,
              bridgeSteel,
            );
        }
        statics.push({
          x: (left + right) / 2,
          y: z,
          group,
          radius: 350,
        });
        sign(
          ['MARLOW BRIDGE', 'UNION BRIDGE', 'SOUTH BAY BRIDGE'][bridgeIndex],
          left - 80,
          z - 65,
          110,
          '#c5d8c2',
        );
      }
      // Police entrance, flag poles, parking markings, and two clearly marked stealable aircraft.
      sign('SOUTH COAST POLICE', 1400, 3958, 206, '#aed7ef');
      box(scene, 1400, 22, 3966, 65, 3, 25, mat('#4a687d', 0.4, 0.55));
      for (const side of [-1, 1]) box(scene, 1400 + side * 28, 11, 3973, 2, 22, 2, chrome);
      for (const x of [1260, 1550]) {
        box(scene, x, 28, 3968, 1, 56, 1, chrome);
        box(scene, x + 9, 49, 3968, 17, 10, 0.3, mat('#70909e'));
      }
      for (const pad of HELIPADS) {
        const ring = new Three.Mesh(
          new Three.RingGeometry(34, 36, 64),
          new Three.MeshBasicMaterial({
            color: '#e5dcbb',
            side: Three.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(pad.x, 0.25, pad.y);
        scene.add(ring);
        for (const side of [-1, 1]) {
          box(scene, pad.x + side * 10, 0.25, pad.y, 4, 0.2, 30, concrete);
          box(scene, pad.x + side * 45, 2, pad.y + 45, 4, 4, 4, warmLamp);
          halo(scene, pad.x + side * 45, 3, pad.y + 45, 12, '#a9e5d6');
        }
        box(scene, pad.x, 0.25, pad.y, 20, 0.2, 4, concrete);
        sign('HELIPAD', pad.x, pad.y - 54, 60, '#d7d3a5');
      }
      // END SUBSYSTEM: src/landmarks3d.js
