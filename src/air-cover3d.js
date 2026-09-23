      // BEGIN SUBSYSTEM: src/air-cover3d.js — Underpass meshes
      /**
       * Underpass meshes
       * Source: src/air-cover3d.js
       * Scope: createCityRenderer() closure.
       * Tunnel roof, walls, portals and illumination.
       */
      // A cut-and-cover road tunnel with open portals, merged by the static batcher.
      // The roof over the player is cleared by the dithered cutaway (lighting3d.js).
      const tunnelGroup = new Three.Group();
      scene.add(tunnelGroup);
      batchGroups.push(tunnelGroup);
      const tunnelConcrete = mat('#788a89', 0.95),
        tunnelTrim = mat('#c1b07f'),
        tunnelRoofMat = mat('#70867b', 0.95);
      for (const b of UNDERPASS_WALLS)
        box(tunnelGroup, b.x + b.w / 2, b.height / 2, b.y + b.h / 2, b.w, b.height, b.h, tunnelConcrete);
      box(tunnelGroup, 2688, 55.5, 2940, 152, 7, 320, tunnelRoofMat);
      for (const z of [2780, 3100]) {
        box(tunnelGroup, 2688, 46, z, 152, 12, 10, tunnelTrim);
        for (const x of [2618, 2758]) box(tunnelGroup, x, 23, z, 12, 46, 15, tunnelConcrete);
        for (const x of [2638, 2738])
          box(tunnelGroup, x, 36, z + (z === 2780 ? -6 : 6), 10, 3, 1, warmLamp);
        const label = sign(
          z === 2780 ? 'EXCHANGE UNDERPASS' : 'ROAD UNDERPASS',
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
      for (const x of [2624, 2752]) {
        box(tunnelGroup, x, 63, 2940, 8, 6, 290, tunnelConcrete);
        for (let z = 2814; z < 3080; z += 28) box(tunnelGroup, x, 66, z, 2, 8, 2, tunnelTrim);
      }
      statics.push({
        x: 2688,
        y: 2940,
        group: tunnelGroup,
        radius: 240,
      });
      // END SUBSYSTEM: src/air-cover3d.js
