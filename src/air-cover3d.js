      // BEGIN SUBSYSTEM: src/air-cover3d.js — Underpass meshes
      /**
       * Underpass meshes
       * Source: src/air-cover3d.js
       * Scope: createCityRenderer() closure.
       * Tunnel roof, walls, portals, illumination and player-facing cutaway.
       */
      // A cut-and-cover road tunnel, with open portals and a roof that fades for navigation.
      const tunnelGroup = new Three.Group();
      scene.add(tunnelGroup);
      const tunnelConcrete = mat('#788a89', 0.95),
        tunnelTrim = mat('#c1b07f'),
        tunnelRoofMat = mat('#70867b', 0.95);
      tunnelRoofMat.transparent = true;
      for (const b of UNDERPASS_WALLS)
        box(tunnelGroup, b.x + b.w / 2, b.height / 2, b.y + b.h / 2, b.w, b.height, b.h, tunnelConcrete);
      const tunnelRoof = box(tunnelGroup, 2688, 55.5, 2940, 152, 7, 320, tunnelRoofMat);
      for (const z of [2780, 3100]) {
        box(tunnelGroup, 2688, 46, z, 152, 12, 10, tunnelTrim);
        for (const x of [2618, 2758]) box(tunnelGroup, x, 23, z, 12, 46, 15, tunnelConcrete);
        for (const x of [2638, 2738])
          box(tunnelGroup, x, 36, z + (z === 2780 ? -6 : 6), 10, 3, 1, warmLamp);
        const label = sign(
          z === 2780 ? 'EXCHANGE STATION' : 'RAILWAY UNDERPASS',
          2688,
          z + (z === 2780 ? -9 : 9),
          128,
          '#b5e4cb',
        );
        label.position.y = 55;
        label.userData.backing.position.y = 55;
      }
      for (let z = 2808; z < 3090; z += 44)
        for (const x of [2625, 2751]) box(tunnelGroup, x, 29, z, 1, 3, 16, warmLamp);
      const tunnelRoofDetails = new Three.Group();
      tunnelGroup.add(tunnelRoofDetails);
      for (const x of [2624, 2752]) {
        box(tunnelRoofDetails, x, 63, 2940, 8, 6, 290, tunnelConcrete);
        for (let z = 2814; z < 3080; z += 28) box(tunnelRoofDetails, x, 66, z, 2, 8, 2, tunnelTrim);
      }
      statics.push({
        x: 2688,
        y: 2940,
        group: tunnelGroup,
        radius: 240,
      });
      function updateAirCoverVisuals() {
        const hidden = underpassContains(player.x, player.y, -25) && entityElevation(player) < 52;
        tunnelRoofMat.opacity = hidden ? 0.12 : 1;
        tunnelRoofMat.depthWrite = !hidden;
        tunnelRoofDetails.visible = !hidden;
      }
      // END SUBSYSTEM: src/air-cover3d.js
