      // BEGIN SUBSYSTEM: src/landmarks3d.js — City landmark meshes
      /**
       * City landmark meshes
       * Source: src/landmarks3d.js
       * Scope: createCityRenderer() closure.
       * Distinctive buildings, waterfront and landmark details.
       */
      // The bridges are drawn by bridges3d.js (every one in BRIDGES, in its own style).
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
