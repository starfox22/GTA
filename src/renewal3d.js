      // BEGIN SUBSYSTEM: src/renewal3d.js — Park meshes
      /**
       * Park meshes
       * Source: src/renewal3d.js
       * Scope: createCityRenderer() closure.
       * Benches, fountains, sports courts, pergolas, pond bridge and bicycle racks.
       */
      // Parks have distinct layouts and landmarks, all placed from CITY_PARKS.
      const parkWater = mat('#6398a1', 0.22, 0.25),
        parkStone = mat('#c7c5ae', 0.9),
        parkWood = mat('#aa8560', 0.8),
        parkRose = mat('#bc8399'),
        parkCanopies = [];
      function parkBench(g, x, z, a = 0) {
        const b = new Three.Group();
        b.position.set(x, 0, z);
        b.rotation.y = a;
        g.add(b);
        for (const dz of [-2, 0, 2]) box(b, 0, 4, dz, 20, 1.1, 1.6, parkWood);
        box(b, 0, 8, 3, 20, 5, 1.2, parkWood);
        for (const dx of [-7, 7]) box(b, dx, 2, 0, 1.4, 4, 6, darkMetal);
      }
      for (const [i, p] of CITY_PARKS.entries()) {
        const group = new Three.Group();
        group.name = p.name;
        scene.add(group);
        const cx = p.x + p.w / 2,
          cz = p.y + p.h / 2;
        const n = p.kind === 'commons' ? 10 : 3;
        for (let j = 0; j < n; j++) {
          const z = p.y + 65 + (j * (p.h - 120)) / Math.max(1, n - 1),
            x = p.x + (j % 2 ? 55 : p.w - 55);
          parkBench(group, x, z, j % 2 ? Math.PI / 2 : -Math.PI / 2);
          box(group, x + 15, 14, z, 1, 28, 1, darkMetal);
          box(group, x + 15, 28, z, 5, 1.5, 5, warmLamp);
        }
        if (p.kind === 'square') {
          mesh(new Three.CylinderGeometry(35, 39, 5, 32), parkStone, group, cx, 2.5, cz);
          mesh(new Three.CylinderGeometry(31, 31, 1, 32), parkWater, group, cx, 5.2, cz);
          mesh(new Three.CylinderGeometry(3, 6, 14, 12), parkStone, group, cx, 11, cz);
          mesh(sphereGeo, parkWater, group, cx, 19, cz, 4, 2, 4);
        }
        if (p.kind === 'sculpture') {
          for (let j = 0; j < 3; j++) {
            const x = p.x + 80 + j * 83,
              z = p.y + 155;
            box(group, x, 4, z, 30, 8, 30, parkStone);
            const sculpture = mesh(
              new Three.TorusGeometry(17, 3, 7, 20),
              j % 2 ? chrome : parkRose,
              group,
              x,
              28,
              z,
            );
            sculpture.rotation.y = j * 0.75;
          }
        }
        if (p.kind === 'courts') {
          // Basketball hoops and players are defined together in sports3d.js.
          for (const x of [p.x + 68, p.x + 102]) box(group, x, 15, p.y + 220, 2, 30, 2, parkRose);
          rod(
            group,
            new Three.Vector3(p.x + 68, 30, p.y + 220),
            new Three.Vector3(p.x + 102, 30, p.y + 220),
            1.4,
            parkRose,
          );
          for (const x of [p.x + 77, p.x + 93]) {
            rod(
              group,
              new Three.Vector3(x, 28, p.y + 220),
              new Three.Vector3(x, 9, p.y + 220),
              0.3,
              chrome,
            );
            box(group, x, 8, p.y + 220, 10, 1.3, 7, parkWood);
          }
        }
        if (['formal', 'orchard', 'botanic'].includes(p.kind))
          for (let j = 0; j < 4; j++) {
            const x = p.x + 40 + (j * (p.w - 80)) / 3;
            box(group, x, 2, p.y + p.h * 0.65, 25, 4, 14, parkStone);
            for (let k = -1; k <= 1; k++)
              mesh(
                sphereGeo,
                j % 2 ? parkRose : leafMats[1],
                group,
                x + k * 7,
                6,
                p.y + p.h * 0.65,
                5,
                4,
                5,
              );
          }
        if (p.kind === 'commons' || p.kind === 'pond') {
          const x = p.kind === 'commons' ? 1990 : cx,
            z = p.kind === 'commons' ? 1950 : p.y + 52;
          for (const dx of [-25, 25])
            for (const dz of [-22, 22]) box(group, x + dx, 14, z + dz, 2.3, 28, 2.3, parkWood);
          for (let k = -30; k <= 30; k += 6) box(group, x + k, 29, z, 2, 2, 54, parkWood);
          for (const dx of [-27, 27]) box(group, x + dx, 30, z, 4, 2, 60, parkWood);
          parkBench(group, x, z);
        }
        if (p.kind === 'commons') {
          const bridge = new Three.Group();
          group.add(bridge);
          for (let x = 1830; x < 1978; x += 5) box(bridge, x, 0.7, 985, 4.5, 1.4, 16, parkWood);
          for (const z of [976, 994]) {
            box(bridge, 1904, 8, z, 148, 1, 1, parkWood);
            for (let x = 1832; x < 1978; x += 16) box(bridge, x, 4, z, 1, 8, 1, parkWood);
          } // A shallow boardwalk crosses the pond; its dry strip is shared with pond collision.
          sign('CENTRAL COMMONS · CYCLE LOOP', 1920, 2094, 235, '#c7e5b9');
        }
        const rackX = p.x + 15,
          rackZ = p.y + 50;
        for (let j = 0; j < 4; j++) {
          const ring = mesh(
            new Three.TorusGeometry(4, 0.6, 5, 12),
            chrome,
            group,
            rackX,
            4,
            rackZ + j * 11,
          );
          ring.rotation.y = Math.PI / 2;
        }
        statics.push({
          x: cx,
          y: cz,
          group,
          radius: Math.max(p.w, p.h),
        });
      }
      // END SUBSYSTEM: src/renewal3d.js
