      // BEGIN SUBSYSTEM: src/helicopter3d.js — Helicopter meshes
      /**
       * Helicopter meshes
       * Source: src/helicopter3d.js
       * Scope: createCityRenderer() closure.
       * Airframe, rotor, lights and cockpit geometry.
       */
      function makeHelicopter(vehicle) {
        const group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        const paint = new Three.MeshStandardMaterial({
          color: vehicle.color,
          roughness: 0.35,
          metalness: 0.6,
        });
        const shell = mesh(new Three.SphereGeometry(1, 20, 12), paint, body, -1, 12, 0, 22, 10, 12);
        const canopy = mesh(
          new Three.SphereGeometry(1, 16, 12),
          glass.clone(),
          body,
          12,
          14,
          0,
          12,
          8,
          11,
        );
        box(body, 8, 17, 0, 1.3, 12, 23, paint);
        box(body, 5, 21, 0, 19, 1, 22, paint);
        rod(body, new Three.Vector3(-15, 12, 0), new Three.Vector3(-42, 18, 0), 2.4, paint);
        box(body, -40, 23, 0, 10, 13, 1.6, paint);
        box(body, -35, 17, 0, 8, 1.6, 21, paint);
        box(body, -4, 24, 0, 16, 6, 13, paint);
        box(body, 0, 30, 0, 2, 8, 2, chrome);
        const rotor = new Three.Group();
        rotor.position.set(0, 34, 0);
        body.add(rotor);
        for (const a of [0, Math.PI / 2]) {
          const blade = box(rotor, 0, 0, 0, 82, 0.65, 3.2, darkMetal);
          blade.rotation.y = a;
        }
        mesh(sphereGeo, chrome, rotor, 0, 0, 0, 3, 1.2, 3);
        const disc = new Three.Mesh(
          new Three.CircleGeometry(41, 48),
          new Three.MeshBasicMaterial({
            color: '#bbc3c5',
            transparent: true,
            opacity: 0.1,
            side: Three.DoubleSide,
            depthWrite: false,
          }),
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 34.2;
        body.add(disc);
        const tail = new Three.Group();
        tail.position.set(-43, 21, 2);
        body.add(tail);
        box(tail, 0, 0, 0, 1, 13, 1, darkMetal);
        box(tail, 0, 0, 0, 13, 1, 1, darkMetal);
        for (const side of [-1, 1]) {
          rod(
            body,
            new Three.Vector3(-17, 3, side * 15),
            new Three.Vector3(20, 3, side * 15),
            1.2,
            darkMetal,
          );
          rod(
            body,
            new Three.Vector3(20, 3, side * 15),
            new Three.Vector3(25, 6, side * 15),
            1.2,
            darkMetal,
          );
          for (const x of [-10, 11])
            rod(
              body,
              new Three.Vector3(x, 4, side * 15),
              new Three.Vector3(x, 9, side * 8),
              0.85,
              chrome,
            );
          box(body, -3, 12, side * 12, 14, 1, 0.3, mat('#c5bd9d'));
          halo(body, 0, 12, side * 13, 5, side < 0 ? '#ee634c' : '#90e3b2');
        }
        const strobes = [];
        if (vehicle.airUnit) {
          for (const side of [-1, 1]) {
            box(body, -4, 10, side * 12.2, 23, 4, 0.5, mat('#20394e'));
            const lamp = box(
              body,
              0,
              24,
              side * 9,
              4,
              2,
              3,
              new Three.MeshBasicMaterial({
                color: side < 0 ? '#e8594b' : '#78aafa',
              }),
            );
            strobes.push(lamp);
          }
          box(body, 15, 5, 0, 5, 4, 5, chrome);
        }
        return {
          group,
          body,
          paint,
          color: vehicle.color,
          strobes,
          dead: false,
          rotor,
          disc,
          tail,
          canopy,
          shell,
          helicopter: true,
        };
      }
      // END SUBSYSTEM: src/helicopter3d.js
