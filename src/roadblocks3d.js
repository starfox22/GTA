      // BEGIN SUBSYSTEM: src/roadblocks3d.js — Police roadblock meshes
      /**
       * Police roadblock meshes
       * Source: src/roadblocks3d.js
       * Scope: createCityRenderer() closure.
       * Concrete barriers, a spike strip, cones and burning flares for each live cut.
       */
      const ROADBLOCK_POOL = 4;
      const barrierMat = mat('#c9c4b4', 0.85),
        barrierStripe = mat('#d8853f', 0.8),
        spikeMat = mat('#2b2f33', 0.45, 0.7),
        coneMat = mat('#d46438', 0.8),
        flareMat = new Three.MeshBasicMaterial({
          color: '#ff9a4a',
        });
      const roadblockPool = Array.from({ length: ROADBLOCK_POOL }, () => {
        const g = new Three.Group();
        g.visible = false;
        g.userData.dynamic = true;
        scene.add(g);
        /* Local +x runs across the carriageway and local +z runs down the road:
           the group is turned by -block.a, and a map heading of `a` becomes local
           +x, which is the same contract every other model in the game uses. */
        const barriers = [];
        for (const side of [-1, 1]) {
          const unit = new Three.Group();
          unit.position.set(side * 74, 0, 0);
          g.add(unit);
          box(unit, 0, 9, 0, 22, 18, 9, barrierMat);
          box(unit, 0, 15, 0, 23, 3, 10, barrierStripe);
          box(unit, 0, 2, 0, 26, 4, 13, barrierMat);
          barriers.push(unit);
        }
        // Spike strip: a dark mat with a saw edge, laid across the carriageway.
        const strip = new Three.Group();
        g.add(strip);
        box(strip, 0, 0.9, 0, 104, 1.8, 9, spikeMat);
        for (let i = -6; i <= 6; i++)
          mesh(cylinderGeo, spikeMat, strip, i * 8, 3.4, 0, 0.8, 4, 0.8);
        const cones = [];
        for (let i = -2; i <= 2; i++) {
          if (!i) continue;
          const c = new Three.Group();
          c.position.set(i * 26, 0, i * 12);
          g.add(c);
          mesh(cylinderGeo, coneMat, c, 0, 5, 0, 3.4, 10, 3.4);
          box(c, 0, 0.6, 0, 9, 1.2, 9, coneMat);
          cones.push(c);
        }
        const flares = [-1, 1].map((side) => {
          const f = mesh(sphereGeo, flareMat, g, side * 44, 2.5, 0, 2.4, 2.4, 2.4);
          f.castShadow = false;
          halo(f, 0, 0, 0, 34, '#ff9a4a');
          return f;
        });
        return { g, strip, cones, flares, barriers };
      });
      function updateRoadblockVisuals() {
        roadblockPool.forEach((slot, i) => {
          const block = roadblocks[i];
          slot.g.visible =
            !!block && Math.abs(block.x - cameraTarget.x) < 1500 && Math.abs(block.y - cameraTarget.y) < 1500;
          if (!slot.g.visible) return;
          slot.g.position.set(block.x, terrainHeight(block.x, block.y), block.y);
          slot.g.rotation.y = -block.a;
          slot.strip.visible = !!block.spike && !block.spike.spent;
          const flicker = 0.7 + Math.sin(gameTime * 17 + i) * 0.3;
          for (const f of slot.flares) f.scale.setScalar(1 + flicker * 0.35);
        });
      }
      // END SUBSYSTEM: src/roadblocks3d.js
