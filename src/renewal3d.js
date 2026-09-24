      // BEGIN SUBSYSTEM: src/renewal3d.js — Park meshes
      /**
       * Park meshes
       * Source: src/renewal3d.js
       * Scope: createCityRenderer() closure.
       * Benches, fountains, sports courts, pergolas, pond bridge and bicycle racks.
       */
      /**
       * Still water (the Garden Lake, fountain basins): a tiling ripple normal map,
       * drifted by updateSurfaces() (surfaces3d.js), so the surface breaks up the sky
       * and lamp reflections instead of reading as a flat plastic disc.
       */
      const pondRippleMaps = [];
      const pondRipples = (() => {
        const size = 128,
          cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const g = cv.getContext('2d'),
          image = g.createImageData(size, size),
          height = (x, y) => {
            const u = (x / size) * TAU,
              v = (y / size) * TAU;
            // Whole periods only, so the tile repeats seamlessly.
            return Math.sin(u * 3 + Math.sin(v * 2) * 1.3) * 0.5 + Math.sin(v * 5 + u * 2) * 0.3 + Math.sin(u * 7 - v * 4 + Math.cos(u * 2)) * 0.2;
          };
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++) {
            const dx = height(x + 1, y) - height(x - 1, y),
              dy = height(x, y + 1) - height(x, y - 1),
              len = Math.hypot(dx * 2.2, dy * 2.2, 1),
              i = (y * size + x) * 4;
            image.data[i] = ((-dx * 2.2) / len * 0.5 + 0.5) * 255;
            image.data[i + 1] = ((-dy * 2.2) / len * 0.5 + 0.5) * 255;
            image.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
            image.data[i + 3] = 255;
          }
        g.putImageData(image, 0, 0);
        const tx = new Three.CanvasTexture(cv);
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        pondRippleMaps.push(tx);
        return tx;
      })();
      // Parks have distinct layouts and landmarks, all placed from CITY_PARKS.
      const parkWater = new Three.MeshStandardMaterial({
          color: '#3c7780',
          roughness: 0.08,
          metalness: 0.3,
          normalMap: pondRipples,
          normalScale: new Three.Vector2(0.35, 0.35),
        }),
        parkStone = staticMat('#c7c5ae', 0.9),
        parkWood = staticMat('#aa8560', 0.8),
        parkRose = staticMat('#bc8399');
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
        batchGroups.push(group);
        const cx = p.x + p.w / 2,
          cz = p.y + p.h / 2;
        const n = p.kind === 'commons' ? 10 : 3;
        for (let j = 0; j < n; j++) {
          const z = p.y + 65 + (j * (p.h - 120)) / Math.max(1, n - 1),
            x = p.x + (j % 2 ? 55 : p.w - 55);
          parkBench(group, x, z, j % 2 ? Math.PI / 2 : -Math.PI / 2);
          box(group, x + 15, 14, z, 1, 28, 1, darkMetal);
          registerFootObstacle(x, z, 3.5, 10);
          registerFootObstacle(x + 15, z, 1.5);
          box(group, x + 15, 28, z, 5, 1.5, 5, warmLamp);
        }
        if (p.kind === 'square') {
          registerFootObstacle(cx, cz, 39);
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
            registerFootObstacle(x, z, 15, 15);
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
        if (p.kind === 'pond') {
          const x = cx,
            z = p.y + 52;
          for (const dx of [-25, 25])
            for (const dz of [-22, 22]) box(group, x + dx, 14, z + dz, 2.3, 28, 2.3, parkWood);
          for (let k = -30; k <= 30; k += 6) box(group, x + k, 29, z, 2, 2, 54, parkWood);
          for (const dx of [-27, 27]) box(group, x + dx, 30, z, 4, 2, 60, parkWood);
          parkBench(group, x, z);
        }
        if (p.kind === 'commons') buildCommons(group);
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
      /**
       * CENTRAL GARDEN FEATURES
       * Built from the shared COMMONS plan in renewal.js so collision, painting
       * and meshes agree: lake with rowboats and a fountain jet, boathouse and
       * dock, station plaza fountain, bandshell with lawn seating, rose-garden
       * pergola, playground, gazebo, statue, kiosks and path lamps.
       */
      function buildCommons(group) {
        const c = COMMONS,
          lakeMat = new Three.MeshStandardMaterial({
            color: '#24606b',
            roughness: 0.06,
            metalness: 0.35,
            transparent: true,
            opacity: 0.95,
            envMapIntensity: 1.1,
            // ShapeGeometry UVs are in world units: one ripple tile per 48.
            normalMap: (() => {
              const tx = pondRipples.clone();
              tx.repeat.set(1 / 48, 1 / 48);
              tx.needsUpdate = true;
              pondRippleMaps.push(tx);
              return tx;
            })(),
            normalScale: new Three.Vector2(0.3, 0.3),
          }),
          bronze = staticMat('#6f5a3a', 0.45, 0.6),
          cream = staticMat('#e7dfcf', 0.8),
          navyCanvas = staticMat('#2c4a63', 0.9),
          redCanvas = staticMat('#b7413a', 0.9),
          sand = staticMat('#d9c9a2', 0.95);
        // Lake surface.
        const lakeShape = new Three.Shape();
        lakeShape.absellipse(0, 0, c.lake.rx, c.lake.ry, 0, TAU, false, 0);
        const lake = new Three.Mesh(new Three.ShapeGeometry(lakeShape, 48), lakeMat);
        lake.rotation.set(-Math.PI / 2, 0, -c.lake.a);
        lake.position.set(c.lake.x, 0.55, c.lake.y);
        lake.receiveShadow = true;
        lake.userData.dynamic = true;
        group.add(lake);
        // Lily pads and three rowboats.
        for (let i = 0; i < 14; i++) {
          const a = i * 2.399,
            r = 0.55 + ((i * 37) % 40) / 100;
          mesh(
            new Three.CylinderGeometry(3.2, 3.2, 0.3, 10),
            leafMats[1],
            group,
            c.lake.x + Math.cos(a) * c.lake.rx * r,
            0.75,
            c.lake.y + Math.sin(a) * c.lake.ry * r,
          );
        }
        for (const [dx, dz, yaw, color] of [
          [-60, -40, 0.4, '#c94c3f'],
          [40, 90, -0.9, '#e1c15f'],
          [70, -110, 1.9, '#4f8ab1'],
        ]) {
          const boat = new Three.Group();
          boat.position.set(c.lake.x + dx, 0.9, c.lake.y + dz);
          boat.rotation.y = yaw;
          group.add(boat);
          box(boat, 0, 1.2, 0, 16, 2.4, 6, mat(color, 0.6));
          box(boat, 0, 2.6, 0, 13, 0.3, 4.4, parkWood);
          box(boat, -3, 3, 0, 0.6, 1, 5, parkWood);
          box(boat, 3, 3, 0, 0.6, 1, 5, parkWood);
        }
        // Lake fountain: stone base, jet and spray halo.
        mesh(new Three.CylinderGeometry(8, 9, 2, 20), parkStone, group, c.lake.x, 1.2, c.lake.y);
        mesh(new Three.ConeGeometry(2.4, 26, 10), staticMat('#d9f1f3', 0.1, 0.1), group, c.lake.x, 14, c.lake.y);
        halo(group, c.lake.x, 22, c.lake.y, 30, '#cfeff2');
        // Boathouse with a plank dock reaching into the lake.
        const bh = c.boathouse;
        box(group, bh.x + bh.w / 2, 9, bh.y + bh.h / 2, bh.w, 18, bh.h, staticMat('#7a5f47', 0.85));
        box(group, bh.x + bh.w / 2, 19.5, bh.y + bh.h / 2, bh.w + 6, 3, bh.h + 6, staticMat('#4c3b2e', 0.9));
        box(group, bh.x + bh.w / 2, 22, bh.y + bh.h / 2, bh.w * 0.7, 2.5, bh.h * 0.6, staticMat('#4c3b2e', 0.9));
        box(group, bh.x + bh.w / 2, 7, bh.y - 0.4, 22, 14, 0.8, staticMat('#2c3a42', 0.6, 0.4));
        for (let z = c.dock.y - c.dock.h; z < c.dock.y + 8; z += 5)
          box(group, c.dock.x, 1.4, z + 2, c.dock.w, 0.9, 4.4, parkWood);
        for (const dx of [-c.dock.w / 2, c.dock.w / 2])
          for (let z = c.dock.y - c.dock.h + 4; z < c.dock.y; z += 22) box(group, c.dock.x + dx, 2.5, z, 1.4, 5, 1.4, parkWood);
        // Station plaza fountain.
        registerFootObstacle(c.fountain.x, c.fountain.y, 28);
        mesh(new Three.CylinderGeometry(26, 28, 3, 32), parkStone, group, c.fountain.x, 1.5, c.fountain.y);
        mesh(new Three.CylinderGeometry(23, 23, 1, 32), parkWater, group, c.fountain.x, 3.4, c.fountain.y);
        mesh(new Three.CylinderGeometry(3, 6, 12, 12), parkStone, group, c.fountain.x, 9, c.fountain.y);
        mesh(sphereGeo, parkWater, group, c.fountain.x, 16, c.fountain.y, 4, 2.2, 4);
        halo(group, c.fountain.x, 15, c.fountain.y, 22, '#cfeff2');
        // Bandshell: stage, half-dome shell, footlights and lawn seating.
        const bs = c.bandshell;
        // The stage and its shell; the lawn benches in front of it.
        registerFootObstacle(bs.x, bs.y - 20.5, 48, 25.5);
        for (let row = 0; row < 5; row++)
          for (let k = -3; k <= 3; k++) registerFootObstacle(bs.x + k * 22, bs.y + 30 + row * 20, 8, 2.8);
        mesh(new Three.CylinderGeometry(46, 48, 4, 32, 1, false, Math.PI, Math.PI), cream, group, bs.x, 2, bs.y);
        box(group, bs.x, 2, bs.y + 2, 92, 4, 6, cream);
        const shell = new Three.Mesh(
          new Three.SphereGeometry(44, 28, 14, 0, Math.PI, 0, Math.PI / 2),
          new Three.MeshStandardMaterial({ color: '#f1e5d0', roughness: 0.7, side: Three.DoubleSide }),
        );
        shell.position.set(bs.x, 4, bs.y);
        shell.rotation.y = Math.PI;
        shell.castShadow = shell.receiveShadow = true;
        group.add(shell);
        for (let i = -3; i <= 3; i++) {
          box(group, bs.x + i * 12, 4.6, bs.y + 4, 4, 1, 1.5, warmLamp);
          addGroupGlow(group, bs.x + i * 12, 6, bs.y + 4, 16, '#ffe1b3', 0.45, { day: 0, phase: 0 });
        }
        for (let row = 0; row < 5; row++)
          for (let k = -3; k <= 3; k++) {
            const x = bs.x + k * 22,
              z = bs.y + 30 + row * 20;
            place(pools.benchSeat, x, 4.2, z, 16, 1, 5);
            place(pools.benchSeat, x, 7, z - 2.4, 16, 4.5, 0.8);
            place(pools.benchLeg, x - 6.5, 2, z, 1, 4, 4.6);
            place(pools.benchLeg, x + 6.5, 2, z, 1, 4, 4.6);
          }
        // Rose garden: pergola over the crossing and low hedges around the beds.
        pergola(group, c.roseGarden.x - group.position.x, 0, c.roseGarden.y - group.position.z, 48, 22);
        for (let i = -1; i <= 1; i++)
          for (let j = -1; j <= 1; j++) {
            if ((i + j) % 2 === 0) continue;
            for (let k = 0; k < 4; k++)
              mesh(sphereGeo, parkRose, group, c.roseGarden.x + i * 44 - 12 + k * 8, 4, c.roseGarden.y + j * 44, 3.6, 3, 3.6);
          }
        // Playground: swings, slide, sandbox and spring riders.
        const pg = c.playground;
        for (const dx of [-30, -6]) {
          for (const dz of [-6, 6]) {
            rod(group, new Three.Vector3(pg.x + dx, 0, pg.y + dz), new Three.Vector3(pg.x + dx, 16, pg.y), 0.7, redCanvas);
          }
        }
        box(group, pg.x - 18, 16, pg.y, 26, 1.2, 1.2, redCanvas);
        for (const dx of [-25, -11]) {
          for (const dz of [-1.5, 1.5]) rod(group, new Three.Vector3(pg.x + dx, 16, pg.y + dz), new Three.Vector3(pg.x + dx, 5, pg.y + dz), 0.2, chrome);
          box(group, pg.x + dx, 5, pg.y, 5, 0.6, 3.2, staticMat('#2f2f33'));
        }
        const slide = box(group, pg.x + 22, 7, pg.y - 8, 22, 0.8, 6, staticMat('#e0b23b', 0.4, 0.3));
        slide.rotation.z = -0.55;
        box(group, pg.x + 33, 6.5, pg.y - 8, 6, 13, 6, navyCanvas);
        for (let k = 0; k < 4; k++) box(group, pg.x + 36.2, 2 + k * 3, pg.y - 8, 0.5, 0.5, 5, chrome);
        box(group, pg.x + 30, 1, pg.y + 22, 40, 2, 26, parkWood);
        box(group, pg.x + 30, 1.6, pg.y + 22, 36, 0.8, 22, sand);
        for (const [dx, dz, color] of [
          [-42, 24, '#c94c3f'],
          [-28, 30, '#4f8ab1'],
        ]) {
          rod(group, new Three.Vector3(pg.x + dx, 0, pg.y + dz), new Three.Vector3(pg.x + dx, 6, pg.y + dz), 0.9, chrome);
          box(group, pg.x + dx, 7, pg.y + dz, 7, 3, 3.5, mat(color));
        }
        // Gazebo: octagonal deck, posts and cone roof.
        const gz = c.gazebo;
        mesh(new Three.CylinderGeometry(30, 32, 1.6, 8), parkWood, group, gz.x, 0.8, gz.y);
        for (let k = 0; k < 8; k++) {
          const a = (k * TAU) / 8;
          box(group, gz.x + Math.cos(a) * 27, 12, gz.y + Math.sin(a) * 27, 1.6, 22, 1.6, cream);
          box(group, gz.x + Math.cos(a) * 27, 6, gz.y + Math.sin(a) * 27, 1.2, 0.8, 1.2, cream);
        }
        mesh(new Three.CylinderGeometry(31, 31, 2, 8), cream, group, gz.x, 23, gz.y);
        mesh(new Three.ConeGeometry(34, 14, 8), staticMat('#5c7f6f', 0.85), group, gz.x, 31, gz.y);
        addGroupGlow(group, gz.x, 20, gz.y, 40, '#ffe1b3', 0.35, { day: 0, phase: 0 });
        addGroupGlow(group, gz.x, 21, gz.y, 22, '#ffe1b3', 0.55, { day: 0, phase: 0 });
        // Statue of the city's founder on the Great Lawn axis.
        const st = c.statue;
        box(group, st.x, 4, st.y, 22, 8, 22, parkStone);
        registerFootObstacle(st.x, st.y, 11, 11);
        box(group, st.x, 10, st.y, 14, 4, 14, parkStone);
        box(group, st.x, 18, st.y, 5, 12, 6, bronze);
        mesh(sphereGeo, bronze, group, st.x, 26.5, st.y, 2.4, 2.8, 2.4);
        box(group, st.x + 4.5, 19, st.y, 2, 10, 2, bronze);
        box(group, st.x - 4.5, 21, st.y, 2, 9, 2, bronze);
        // Kiosks: ice-cream cart by the plaza, a coffee stand by the lawn.
        for (const { x, y: z, color } of c.kiosks) {
          registerFootObstacle(x, z, 7.5, 4.5);
          box(group, x, 4.5, z, 14, 9, 8, mat(color, 0.6));
          box(group, x, 9.2, z, 15, 0.5, 9, chrome);
          mesh(new Three.ConeGeometry(12, 4, 12), mat(color === '#e8b1c2' ? '#f3f0e6' : '#d9c15f', 0.9), group, x, 16, z);
          box(group, x, 11.5, z, 0.8, 8, 0.8, chrome);
        }
        // Path lamps along the walking route.
        const route = parkWalk(CENTRAL_PARK);
        for (let i = 1; i < route.length; i++) {
          const [ax, az] = route[i - 1],
            [bx, bz] = route[i],
            len = Math.hypot(bx - ax, bz - az),
            steps = Math.max(1, Math.round(len / 110));
          for (let k = 1; k <= steps; k++) {
            const t = (k - 0.5) / steps,
              x = ax + (bx - ax) * t + 12,
              z = az + (bz - az) * t + 12;
            if (parkPondBlocked(x, z, 3)) continue;
            box(group, x, 9, z, 0.9, 18, 0.9, darkMetal);
            box(group, x, 18.5, z, 3, 3, 3, warmLamp);
            addGroupGlow(group, x, 19, z, 22, '#ffe1b3', 0.55, { day: 0, phase: 0 });
          }
        }
        // Outdoor gym: pull-up ladder, dip station, rings, parallel bars and mats.
        const cal = c.calisthenics,
          rigPaint = staticMat('#3f6f74', 0.55, 0.45),
          matMat = staticMat('#39566b', 0.95);
        box(group, cal.x, 0.5, cal.y, cal.w, 1, cal.h, staticMat('#4b4f52', 0.96));
        for (const dx of [-84, -2]) {
          for (const dz of [-34, -14]) box(group, cal.x + dx, 20, cal.y + dz, 2.6, 40, 2.6, rigPaint);
          rod(
            group,
            new Three.Vector3(cal.x + dx, 40, cal.y - 34),
            new Three.Vector3(cal.x + dx, 40, cal.y - 14),
            1.3,
            rigPaint,
          );
        }
        rod(
          group,
          new Three.Vector3(cal.x - 84, 40, cal.y - 24),
          new Three.Vector3(cal.x - 2, 40, cal.y - 24),
          1.2,
          rigPaint,
        );
        // Staggered pull-up bars at three heights.
        for (let i = 0; i < 3; i++)
          rod(
            group,
            new Three.Vector3(cal.x - 74 + i * 26, 28 + i * 5, cal.y - 34),
            new Three.Vector3(cal.x - 74 + i * 26, 28 + i * 5, cal.y - 14),
            0.9,
            chrome,
          );
        // Dip station.
        for (const dz of [-32, -20]) {
          box(group, cal.x + 22, 11, cal.y + dz, 2.2, 22, 2.2, rigPaint);
          rod(
            group,
            new Three.Vector3(cal.x + 14, 22, cal.y + dz),
            new Three.Vector3(cal.x + 30, 22, cal.y + dz),
            0.9,
            chrome,
          );
        }
        // Rings hanging from a cross beam.
        box(group, cal.x + 62, 21, cal.y - 22, 2.4, 42, 2.4, rigPaint);
        box(group, cal.x + 62, 21, cal.y + 2, 2.4, 42, 2.4, rigPaint);
        rod(
          group,
          new Three.Vector3(cal.x + 62, 42, cal.y - 22),
          new Three.Vector3(cal.x + 62, 42, cal.y + 2),
          1.1,
          rigPaint,
        );
        for (const dz of [-14, -6]) {
          rod(
            group,
            new Three.Vector3(cal.x + 62, 42, cal.y + dz),
            new Three.Vector3(cal.x + 62, 26, cal.y + dz),
            0.25,
            staticMat('#d9cba6', 0.9),
          );
          const ring = mesh(new Three.TorusGeometry(3, 0.7, 6, 14), parkWood, group, cal.x + 62, 24, cal.y + dz);
          ring.rotation.x = Math.PI / 2;
        }
        // Parallel bars and two exercise mats.
        for (const dz of [24, 34]) {
          for (const dx of [-62, -30]) box(group, cal.x + dx, 7, cal.y + dz, 2, 14, 2, rigPaint);
          rod(
            group,
            new Three.Vector3(cal.x - 62, 14, cal.y + dz),
            new Three.Vector3(cal.x - 30, 14, cal.y + dz),
            0.8,
            chrome,
          );
        }
        for (const dx of [6, 56]) box(group, cal.x + dx, 1.4, cal.y + 30, 34, 1.4, 20, matMat);
        // Food trucks: body, cab, serving hatch, awning, wheels and a menu board.
        for (const truck of c.foodTrucks) {
          // Body and cab run from 23 behind to 33 ahead of the truck's point.
          registerFootObstacle(truck.x + Math.cos(truck.a) * 5, truck.y + Math.sin(truck.a) * 5, 28, 9.5, truck.a);
          const t = new Three.Group();
          t.position.set(truck.x, 0, truck.y);
          t.rotation.y = -truck.a;
          group.add(t);
          const paint = mat(truck.color, 0.55, 0.25);
          box(t, 0, 13, 0, 46, 20, 19, paint);
          box(t, 26, 10, 0, 14, 14, 17, staticMat('#e8e4d7', 0.5, 0.3));
          box(t, 32, 13, 0, 3, 7, 14, glass);
          box(t, 0, 24, 0, 44, 2, 18, staticMat('#dfd9c8', 0.8));
          // Serving hatch and awning on the kerb side.
          box(t, -2, 15, -9.8, 26, 9, 1, staticMat('#20272b', 0.4, 0.5));
          const awning = box(t, -2, 22, -15, 26, 0.8, 12, staticMat('#efe6d0', 0.85));
          awning.rotation.x = 0.32;
          box(t, -2, 9, -10.6, 24, 2.4, 2.6, staticMat('#c9c2ad', 0.8));
          for (const dx of [-15, 15])
            for (const dz of [-9.5, 9.5]) {
              const wheel = mesh(wheelGeo, rubber, t, dx, 4, dz, 4, 2.4, 4);
              wheel.rotation.x = Math.PI / 2;
            }
          sign(truck.menu, truck.x + Math.cos(truck.a + Math.PI / 2) * 16, truck.y + Math.sin(truck.a + Math.PI / 2) * 16, 34, '#ffe6b0', false, { style: 'truck' });
          halo(t, -2, 20, -12, 26, '#ffd9a0');
        }
        sign('OUTDOOR GYM', cal.x, cal.y + cal.h / 2 + 10, 90, '#cfe6ea');
        sign('CENTRAL GARDEN', 2688, 1812, 200, '#c7e5b9');
        sign('GARDEN LAKE · BOATHOUSE', bh.x + bh.w / 2, bh.y + bh.h + 3, 120, '#d3ecdc');
        sign('BANDSHELL · LIVE TONIGHT', bs.x, bs.y + 138, 130, '#f2d8a2');
      }
      // END SUBSYSTEM: src/renewal3d.js
