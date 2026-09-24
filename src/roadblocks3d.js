      // BEGIN SUBSYSTEM: src/roadblocks3d.js — Police roadblock meshes
      /**
       * Police roadblock meshes
       * Source: src/roadblocks3d.js
       * Scope: createCityRenderer() closure.
       * Traffic cones and burning flares for each live cut. The cruisers are
       * ordinary vehicles and are drawn with the rest of the traffic.
       */
      const ROADBLOCK_POOL = 4,
        ROADBLOCK_CONES = 8;
      const coneMat = staticMat('#e0662f', 0.7),
        coneStripe = staticMat('#eeeae0', 0.45),
        coneBaseMat = staticMat('#2a2c2e', 0.9),
        coneGeo = new Three.ConeGeometry(1, 1, 12),
        flareMat = new Three.MeshBasicMaterial({
          color: '#ff9a4a',
        });
      /* A traffic cone about knee high: black square foot, orange cone and one
         reflective collar. Built around its base so it can be laid on its side. */
      function makeRoadCone() {
        const c = new Three.Group();
        c.rotation.order = 'YXZ';
        c.userData.dynamic = true;
        box(c, 0, 0.6, 0, 8, 1.2, 8, coneBaseMat);
        mesh(coneGeo, coneMat, c, 0, 6.2, 0, 3.3, 10.4, 3.3);
        mesh(cylinderGeo, coneStripe, c, 0, 6.6, 0, 1.75, 1.8, 1.75);
        c.visible = false;
        scene.add(c);
        return c;
      }
      const roadblockPool = Array.from({ length: ROADBLOCK_POOL }, () => {
        const g = new Three.Group();
        g.visible = false;
        g.userData.dynamic = true;
        scene.add(g);
        /* Local +x runs across the carriageway and local +z runs down the road:
           the group is turned by -block.a, and a map heading of `a` becomes local
           +x, which is the same contract every other model in the game uses. */
        // A burning flare on the centre line ahead of each row of cones.
        const flares = [-1, 1].map((end) => {
          const f = mesh(sphereGeo, flareMat, g, 0, 2.5, end * 82, 2.4, 2.4, 2.4);
          f.castShadow = false;
          halo(f, 0, 0, 0, 34, '#ff9a4a');
          return f;
        });
        // Cones live in map space (they get knocked about), not in the block group.
        const cones = Array.from({ length: ROADBLOCK_CONES }, makeRoadCone);
        return { g, flares, cones };
      });
      function updateRoadblockVisuals() {
        roadblockPool.forEach((slot, i) => {
          const block = roadblocks[i];
          slot.g.visible =
            !!block && Math.abs(block.x - cameraTarget.x) < 1500 && Math.abs(block.y - cameraTarget.y) < 1500;
          slot.cones.forEach((mesh, k) => {
            const cone = slot.g.visible && block.cones[k];
            mesh.visible = !!cone;
            if (!cone) return;
            // A knocked cone lies on its side: its radius off the ground, tip leading.
            mesh.position.set(cone.x, terrainHeight(cone.x, cone.y) + (cone.tipped ? 3.3 : 0), cone.y);
            mesh.rotation.set(cone.tipped ? Math.PI / 2 : 0, -cone.a, 0);
          });
          if (!slot.g.visible) return;
          slot.g.position.set(block.x, terrainHeight(block.x, block.y), block.y);
          slot.g.rotation.y = -block.a;
          const flicker = 0.7 + Math.sin(gameTime * 17 + i) * 0.3;
          for (const f of slot.flares) f.scale.setScalar(1 + flicker * 0.35);
        });
      }
      // END SUBSYSTEM: src/roadblocks3d.js
