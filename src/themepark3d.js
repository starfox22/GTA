      // BEGIN SUBSYSTEM: src/themepark3d.js — Sunset Pier ride meshes
      /**
       * Sunset Pier ride meshes
       * Source: src/themepark3d.js
       * Scope: createCityRenderer() closure.
       * Coaster track and train, big wheel, carousel, teacups, drop tower, midway
       * stalls and the entrance arch. Ride motion is driven from the shared park
       * state in themepark.js so what is drawn is what the simulation believes.
       */
      // Fixed build is batched; anything that turns, rises or rolls is not.
      const parkStatic = new Three.Group();
      scene.add(parkStatic);
      batchGroups.push(parkStatic);
      statics.push({
        x: 3820,
        y: 5180,
        group: parkStatic,
        radius: 640,
      });
      const parkGroup = new Three.Group();
      scene.add(parkGroup);
      statics.push({
        x: 3820,
        y: 5180,
        group: parkGroup,
        radius: 640,
      });
      const rideSteel = mat('#c4553f', 0.55, 0.35),
        rideWhite = mat('#eee6d4', 0.7),
        rideTeal = mat('#3f8f92', 0.6, 0.2),
        rideGold = mat('#d9ad55', 0.45, 0.6),
        rideRail = mat('#dcdad0', 0.35, 0.7),
        boardWalk = mat('#a98a63', 0.85);
      // A handful of shared bulb materials keeps the festoon lighting to a few
      // draw calls instead of one material per lamp.
      const bulbMaterials = new Map(),
        parkHalos = [];
      function bulbMaterial(color) {
        if (!bulbMaterials.has(color))
          bulbMaterials.set(color, new Three.MeshBasicMaterial({ color }));
        return bulbMaterials.get(color);
      }
      function parkBulb(x, y, z, color = '#ffd79a') {
        const bulb = mesh(sphereGeo, bulbMaterial(color), parkStatic, x, y, z, 1.3, 1.3, 1.3);
        bulb.castShadow = false;
        parkHalos.push(halo(parkStatic, x, y, z, 16, color));
      }
      // ---- Coaster -----------------------------------------------------------------
      {
        const n = COASTER_TRACK.length;
        for (let i = 0; i < n; i++) {
          const a = COASTER_TRACK[i],
            b = COASTER_TRACK[(i + 1) % n],
            steps = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 14));
          for (let s = 0; s < steps; s++) {
            const t0 = s / steps,
              t1 = (s + 1) / steps,
              p0 = new Three.Vector3(
                a[0] + (b[0] - a[0]) * t0,
                a[2] + (b[2] - a[2]) * t0 + 6,
                a[1] + (b[1] - a[1]) * t0,
              ),
              p1 = new Three.Vector3(
                a[0] + (b[0] - a[0]) * t1,
                a[2] + (b[2] - a[2]) * t1 + 6,
                a[1] + (b[1] - a[1]) * t1,
              );
            const dx = p1.x - p0.x,
              dz = p1.z - p0.z,
              len = Math.hypot(dx, dz) || 1,
              nx = -dz / len,
              nz = dx / len;
            for (const side of [-3.4, 3.4]) {
              rod(
                parkStatic,
                new Three.Vector3(p0.x + nx * side, p0.y, p0.z + nz * side),
                new Three.Vector3(p1.x + nx * side, p1.y, p1.z + nz * side),
                0.75,
                rideRail,
              );
            }
            // Cross ties and a spine tube.
            rod(
              parkStatic,
              new Three.Vector3(p0.x + nx * 3.4, p0.y, p0.z + nz * 3.4),
              new Three.Vector3(p0.x - nx * 3.4, p0.y, p0.z - nz * 3.4),
              0.5,
              rideSteel,
            );
            rod(parkStatic, new Three.Vector3(p0.x, p0.y - 3, p0.z), new Three.Vector3(p1.x, p1.y - 3, p1.z), 1.1, rideSteel);
            // A bent leg every few metres, braced to the deck.
            if ((s + i * 7) % 4 === 0 && p0.y > 12) {
              box(parkStatic, p0.x, p0.y / 2, p0.z, 2.4, p0.y, 2.4, rideSteel);
              box(parkStatic, p0.x, p0.y / 2, p0.z, 8, 1.6, 1.6, rideSteel);
            }
          }
        }
        // Station: platform, roof, queue rail and a sign.
        const st = PIER.station;
        box(parkStatic, st.x, 4, st.y, 92, 8, 44, boardWalk);
        for (const dx of [-42, 42]) for (const dz of [-20, 20]) box(parkStatic, st.x + dx, 16, st.y + dz, 3, 24, 3, rideSteel);
        box(parkStatic, st.x, 29, st.y, 98, 3, 50, rideWhite);
        for (let i = -3; i <= 3; i++) box(parkStatic, st.x + i * 14, 31.6, st.y, 12, 2.4, 50, i % 2 ? rideSteel : rideWhite);
        for (let i = -3; i <= 3; i++) parkBulb(st.x + i * 14, 27, st.y - 25, i % 2 ? '#ffd79a' : '#ff8f6a');
        sign('THE SCREAMER', st.x, st.y - 30, 90, '#ffd9a0');
      }
      // ---- Big wheel ---------------------------------------------------------------
      const bigWheel = new Three.Group();
      bigWheel.position.set(PIER.wheel.x, PIER.wheel.r + 16, PIER.wheel.y);
      bigWheel.userData.dynamic = true;
      parkGroup.add(bigWheel);
      const wheelCabins = [];
      {
        const R = PIER.wheel.r;
        for (const ring of [R, R * 0.92]) {
          for (let i = 0; i < 36; i++) {
            const a0 = (i * TAU) / 36,
              a1 = ((i + 1) * TAU) / 36;
            rod(
              bigWheel,
              new Three.Vector3(Math.cos(a0) * ring, Math.sin(a0) * ring, 0),
              new Three.Vector3(Math.cos(a1) * ring, Math.sin(a1) * ring, 0),
              1.1,
              rideWhite,
            );
          }
        }
        for (let i = 0; i < 18; i++) {
          const a = (i * TAU) / 18;
          rod(bigWheel, new Three.Vector3(0, 0, 0), new Three.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0), 0.6, rideRail);
          const cabin = new Three.Group();
          cabin.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
          bigWheel.add(cabin);
          box(cabin, 0, -5, 0, 11, 9, 13, i % 2 ? rideTeal : rideSteel);
          box(cabin, 0, -0.4, 0, 12, 1.4, 14, rideGold);
          wheelCabins.push(cabin);
        }
        mesh(cylinderGeo, rideGold, bigWheel, 0, 0, 0, 4, 20, 4).rotation.x = Math.PI / 2;
      }
      for (const side of [-1, 1]) {
        const x = PIER.wheel.x + side * 30;
        rod(
          parkStatic,
          new Three.Vector3(x, 0, PIER.wheel.y - 22),
          new Three.Vector3(PIER.wheel.x, PIER.wheel.r + 16, PIER.wheel.y),
          3,
          rideSteel,
        );
        rod(
          parkStatic,
          new Three.Vector3(x, 0, PIER.wheel.y + 22),
          new Three.Vector3(PIER.wheel.x, PIER.wheel.r + 16, PIER.wheel.y),
          3,
          rideSteel,
        );
      }
      // ---- Carousel ----------------------------------------------------------------
      const carousel = new Three.Group();
      carousel.position.set(PIER.carousel.x, 0, PIER.carousel.y);
      carousel.userData.dynamic = true;
      parkGroup.add(carousel);
      {
        const R = PIER.carousel.r;
        mesh(new Three.CylinderGeometry(R, R, 3, 26), boardWalk, carousel, 0, 2, 0);
        mesh(cylinderGeo, rideGold, carousel, 0, 17, 0, 3, 30, 3);
        const canopy = mesh(new Three.ConeGeometry(R + 5, 16, 26), rideSteel, carousel, 0, 38, 0);
        canopy.castShadow = true;
        mesh(new Three.CylinderGeometry(R + 5, R + 5, 3, 26), rideWhite, carousel, 0, 30, 0);
        for (let i = 0; i < 12; i++) {
          const a = (i * TAU) / 12,
            x = Math.cos(a) * (R - 9),
            z = Math.sin(a) * (R - 9);
          mesh(cylinderGeo, rideGold, carousel, x, 17, z, 0.7, 28, 0.7);
          const horse = new Three.Group();
          horse.position.set(x, 12, z);
          horse.rotation.y = -a;
          carousel.add(horse);
          box(horse, 0, 0, 0, 13, 6, 4.5, i % 2 ? rideWhite : rideTeal);
          box(horse, 5, 4, 0, 4, 7, 3.6, i % 2 ? rideWhite : rideTeal);
          box(horse, -5, -3, 0, 2.4, 7, 2.4, rideGold);
          box(horse, 4, -3, 0, 2.4, 7, 2.4, rideGold);
        }
        for (let i = 0; i < 16; i++) parkBulb(PIER.carousel.x + Math.cos((i * TAU) / 16) * (R + 5), 30, PIER.carousel.y + Math.sin((i * TAU) / 16) * (R + 5), i % 2 ? '#ffd79a' : '#ff7fb0');
      }
      // ---- Teacups and drop tower --------------------------------------------------
      const teacups = new Three.Group();
      teacups.position.set(PIER.teacups.x, 0, PIER.teacups.y);
      teacups.userData.dynamic = true;
      parkGroup.add(teacups);
      mesh(new Three.CylinderGeometry(PIER.teacups.r, PIER.teacups.r, 2.4, 22), rideWhite, teacups, 0, 1.6, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6,
          cup = mesh(
            new Three.CylinderGeometry(8, 6, 9, 14),
            i % 2 ? rideTeal : rideSteel,
            teacups,
            Math.cos(a) * (PIER.teacups.r - 12),
            7,
            Math.sin(a) * (PIER.teacups.r - 12),
          );
        cup.castShadow = true;
      }
      const dropCar = new Three.Group();
      dropCar.userData.dynamic = true;
      parkGroup.add(dropCar);
      {
        const d = PIER.dropTower;
        for (const [dx, dz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]])
          box(parkStatic, d.x + dx, 62, d.y + dz, 3, 124, 3, rideSteel);
        for (let y = 16; y < 124; y += 16)
          for (const [ax, az, bx, bz] of [[-9, -9, 9, -9], [9, -9, 9, 9], [9, 9, -9, 9], [-9, 9, -9, -9]])
            rod(parkStatic, new Three.Vector3(d.x + ax, y, d.y + az), new Three.Vector3(d.x + bx, y + 8, d.y + bz), 0.7, rideSteel);
        mesh(new Three.ConeGeometry(13, 18, 12), rideGold, parkStatic, d.x, 133, d.y);
        dropCar.position.set(d.x, 90, d.y);
        mesh(new Three.CylinderGeometry(15, 15, 6, 14), rideWhite, dropCar, 0, 0, 0);
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8;
          box(dropCar, Math.cos(a) * 12, -4, Math.sin(a) * 12, 5, 8, 5, rideTeal);
        }
        sign('THE PLUNGE', d.x, d.y + 22, 60, '#ffd9a0');
      }
      // ---- Midway buildings, stalls and the entrance arch ---------------------------
      for (const b of parkSolids()) {
        if (b.w > 300) continue;
        box(parkStatic, b.x + b.w / 2, b.height / 2, b.y + b.h / 2, b.w, b.height, b.h, rideWhite);
        box(parkStatic, b.x + b.w / 2, b.height + 2, b.y + b.h / 2, b.w + 8, 4, b.h + 8, rideSteel);
        for (let x = b.x + 14; x < b.x + b.w - 8; x += 28) {
          const awning = box(parkStatic, x, b.height * 0.55, b.y + b.h + 7, 24, 0.8, 14, (x / 28) % 2 ? rideSteel : rideTeal);
          awning.rotation.x = 0.36;
          parkBulb(x, b.height * 0.66, b.y + b.h + 12, '#ffd79a');
        }
      }
      {
        const g = PIER.gate;
        for (const side of [-56, 56]) box(parkStatic, g.x + side, 26, g.y, 10, 52, 10, rideSteel);
        box(parkStatic, g.x, 56, g.y, 132, 12, 12, rideGold);
        const arch = mesh(new Three.TorusGeometry(58, 5, 8, 22, Math.PI), rideGold, parkStatic, g.x, 56, g.y);
        arch.rotation.y = Math.PI / 2;
        sign('SUNSET PIER', g.x, g.y - 12, 140, '#ffd9a0');
        for (let i = -4; i <= 4; i++) parkBulb(g.x + i * 13, 64, g.y, i % 2 ? '#ffd79a' : '#7fe9ff');
      }
      // Boardwalk edging and string lights down the midway.
      for (let z = 4930; z < 5470; z += 46) {
        for (const x of [3668, 3760]) box(parkStatic, x, 1.4, z, 6, 2.8, 42, boardWalk);
        parkBulb(3668, 22, z, '#ffd79a');
        parkBulb(3760, 22, z, '#ffd79a');
        box(parkStatic, 3668, 12, z, 1.6, 24, 1.6, rideSteel);
        box(parkStatic, 3760, 12, z, 1.6, 24, 1.6, rideSteel);
      }
      // ---- Coaster train -----------------------------------------------------------
      const coasterCars = Array.from({ length: 5 }, (_, i) => {
        const car = new Three.Group();
        car.userData.dynamic = true;
        parkGroup.add(car);
        box(car, 0, 4, 0, 13, 7, 8, i === 0 ? rideGold : rideSteel);
        box(car, 0, 8.4, 0, 12, 1.6, 8.6, rideWhite);
        box(car, -5, 7, 0, 1.4, 6, 7.6, rideSteel);
        if (i === 0) mesh(new Three.ConeGeometry(4, 8, 10), rideGold, car, 8, 4, 0).rotation.z = -Math.PI / 2;
        for (const dz of [-4.4, 4.4]) {
          const wheel = mesh(wheelGeo, darkMetal, car, 0, 0.8, dz, 2, 1.4, 2);
          wheel.rotation.x = Math.PI / 2;
        }
        return car;
      });
      const trainAhead = new Three.Vector3();
      function updateParkVisuals() {
        const night = nightAmount;
        for (const sprite of parkHalos) sprite.material.opacity = 0.1 + night * 0.7;
        bigWheel.rotation.z = gameTime * 0.16;
        for (const cabin of wheelCabins) cabin.rotation.z = -bigWheel.rotation.z;
        carousel.rotation.y = gameTime * 0.55;
        teacups.rotation.y = -gameTime * 0.75;
        const dropPhase = (gameTime * 0.14) % 1;
        dropCar.position.y =
          dropPhase < 0.62 ? 14 + (dropPhase / 0.62) * 104 : 118 - Math.pow((dropPhase - 0.62) / 0.38, 2) * 104;
        // Train: five cars spaced back along the track from the lead.
        for (let i = 0; i < coasterCars.length; i++) {
          const at = coasterTrain.running ? coasterTrain.t - i * 0.16 : -i * 0.16,
            p = coasterPoint(at),
            q = coasterPoint(at + 0.06);
          coasterCars[i].position.set(p.x, p.altitude + 8, p.y);
          trainAhead.set(q.x - p.x, q.altitude - p.altitude, q.y - p.y);
          coasterCars[i].rotation.y = -Math.atan2(trainAhead.z, trainAhead.x);
          coasterCars[i].rotation.z = Math.atan2(
            trainAhead.y,
            Math.hypot(trainAhead.x, trainAhead.z) || 1,
          );
          coasterCars[i].visible =
            Math.abs(p.x - cameraTarget.x) < 1600 && Math.abs(p.y - cameraTarget.y) < 1600;
        }
      }
      // END SUBSYSTEM: src/themepark3d.js
