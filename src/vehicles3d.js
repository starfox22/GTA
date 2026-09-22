      // BEGIN SUBSYSTEM: src/vehicles3d.js — Vehicle meshes
      /**
       * Vehicle meshes
       * Source: src/vehicles3d.js
       * Scope: createCityRenderer() closure.
       * Distinct road vehicles, bicycles, boats, riders and moving components.
       */
      // Each vehicle class has its own silhouette, wheelbase and moving parts.
      function specialVehicle(vehicle) {
        const group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        const paint = mat(vehicle.color, 0.32, 0.58);
        return {
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          wheels: [],
          lamps: [],
          special: true,
          dead: false,
        };
      }
      function tireAt(m, x, z, r = 4.7, width = 3) {
        const pivot = new Three.Group();
        pivot.position.set(x, r, z);
        m.body.add(pivot);
        const tire = mesh(wheelGeo, rubber, pivot, 0, 0, 0, r, width, r);
        tire.rotation.x = Math.PI / 2;
        for (const side of [-1, 1]) {
          const rim = mesh(wheelGeo, chrome, pivot, 0, 0, side * width * 0.52, r * 0.6, 0.3, r * 0.6);
          rim.rotation.x = Math.PI / 2;
          const hub = mesh(
            wheelGeo,
            darkMetal,
            pivot,
            0,
            0,
            side * width * 0.58,
            r * 0.22,
            0.4,
            r * 0.22,
          );
          hub.rotation.x = Math.PI / 2;
        }
        m.wheels.push({
          wheel: pivot,
          side: Math.sign(z) || 1,
        });
        return pivot;
      }
      function makeMotorcycle(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body,
          cruiser = vehicle.type === 'cruiser',
          l = vehicleSpec(vehicle).l;
        model.bike = true;
        tireAt(model, -l * 0.33, 0, 5.3, 3.2);
        tireAt(model, l * 0.34, 0, 5.3, 2.5);
        rod(b, new Three.Vector3(-l * 0.3, 5, 0), new Three.Vector3(3, 11, 0), 0.8, chrome);
        rod(b, new Three.Vector3(3, 11, 0), new Three.Vector3(l * 0.34, 5, 0), 0.7, chrome);
        box(b, -1, 7, 0, 9, 6, 5, darkMetal);
        for (let i = 0; i < 5; i++) box(b, -2, 6 + i * 0.65, 0, 6, 0.3, 5.6, chrome);
        mesh(sphereGeo, model.paint, b, 2, 11, 0, 6, 2.5, 3.4);
        box(b, -6, 11.5, 0, 7, 1.7, 4.8, rubber);
        box(b, -11, 9, 0, 5, 1.2, 4, model.paint);
        for (const side of [-1, 1]) {
          rod(
            b,
            new Three.Vector3(l * 0.34, 5, side * 1.7),
            new Three.Vector3(7, 14, side * 1.7),
            0.6,
            chrome,
          );
          box(b, -5, 5, side * 3.2, 13, 0.9, 1, chrome);
          box(b, 7, 14, side * 3, 1, 1, 4, rubber);
        }
        if (!cruiser) {
          mesh(sphereGeo, model.paint, b, 5, 9, 0, 5, 4, 4);
          box(b, 7, 15, 0, 0.8, 4, 5, glass);
        } else {
          box(b, -8, 8, 0, 7, 3, 7, rubber);
          rod(b, new Three.Vector3(7, 14, 0), new Three.Vector3(7, 17, 0), 0.5, chrome);
        }
        box(b, 10, 12, 0, 1.2, 2.4, 3, warmLamp);
        box(b, -13, 10, 0, 1, 1.4, 2, tailLamp);
        const rider = new Three.Group();
        b.add(rider);
        box(rider, -2, 17, 0, 4.5, 7, 6, mat('#343e47'));
        mesh(sphereGeo, mat('#222932', 0.25, 0.4), rider, 0, 23, 0, 2.4, 2.5, 2.4);
        box(rider, 2, 23, 0, 0.7, 1.7, 3.9, glass);
        for (const side of [-1, 1]) {
          rod(
            rider,
            new Three.Vector3(-2, 18, side * 3),
            new Three.Vector3(7, 14, side * 4),
            1,
            mat('#343e47'),
          );
          rod(
            rider,
            new Three.Vector3(-5, 13, side * 2),
            new Three.Vector3(0, 7, side * 4),
            1.2,
            mat('#4c5561'),
          );
        }
        model.rider = rider;
        return model;
      }
      function makeBoat(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body,
          vehicleDefinition = vehicleSpec(vehicle),
          work = vehicle.type === 'workboat';
        model.boat = true;
        // A narrow pointed bow and broad stern, with a contrasting lower hull.
        const hull = new Three.Shape();
        hull.moveTo(-vehicleDefinition.l * 0.48, -vehicleDefinition.w * 0.38);
        hull.lineTo(vehicleDefinition.l * 0.1, -vehicleDefinition.w * 0.5);
        hull.quadraticCurveTo(
          vehicleDefinition.l * 0.4,
          -vehicleDefinition.w * 0.35,
          vehicleDefinition.l * 0.5,
          0,
        );
        hull.quadraticCurveTo(
          vehicleDefinition.l * 0.4,
          vehicleDefinition.w * 0.35,
          vehicleDefinition.l * 0.1,
          vehicleDefinition.w * 0.5,
        );
        hull.lineTo(-vehicleDefinition.l * 0.48, vehicleDefinition.w * 0.38);
        hull.closePath();
        const geo = new Three.ExtrudeGeometry(hull, {
          depth: 6,
          bevelEnabled: true,
          bevelThickness: 2,
          bevelSize: 1.5,
          bevelSegments: 2,
          steps: 1,
        });
        geo.rotateX(Math.PI / 2);
        mesh(geo, model.paint, b, 0, 7, 0);
        const deckMaterial = mat('#d6d0bb');
        deckMaterial.side = Three.DoubleSide;
        const deck = mesh(new Three.ShapeGeometry(hull), deckMaterial, b, 0, 7.2, 0);
        deck.rotation.x = Math.PI / 2;
        box(b, -7, 9, 0, 20, 3, vehicleDefinition.w * 0.62, mat('#dcded7'));
        box(b, 3, 13, 0, 1, 7, vehicleDefinition.w * 0.65, glass);
        for (const side of [-1, 1]) {
          box(b, -7, 11, side * vehicleDefinition.w * 0.29, 22, 3, 1, model.paint);
          box(b, -11, 11, side * 5, 5, 3, 4, rubber);
          rod(
            b,
            new Three.Vector3(8, 9, side * vehicleDefinition.w * 0.39),
            new Three.Vector3(vehicleDefinition.l * 0.35, 9, side * 4),
            0.35,
            chrome,
          );
        }
        box(b, -vehicleDefinition.l * 0.5, 5, 0, 5, 9, 4, darkMetal);
        box(b, -vehicleDefinition.l * 0.53, 1, 0, 3, 1, 8, chrome);
        if (work) {
          box(b, -1, 16, 0, 22, 15, vehicleDefinition.w * 0.57, mat('#d9d4be'));
          box(b, 10.1, 18, 0, 0.4, 7, vehicleDefinition.w * 0.45, glass);
          for (const side of [-1, 1])
            box(b, 0, 18, side * vehicleDefinition.w * 0.292, 16, 7, 0.3, glass);
          box(b, 0, 24, 0, 25, 2, vehicleDefinition.w * 0.68, model.paint);
          box(b, -3, 31, 0, 0.7, 13, 0.7, chrome);
          box(b, -6, 29, 0, 8, 0.6, 0.6, chrome);
          for (const side of [-1, 1]) {
            const ring = mesh(
              new Three.TorusGeometry(3, 0.7, 6, 14),
              mat('#c67543'),
              b,
              -8,
              12,
              side * vehicleDefinition.w * 0.4,
            );
            ring.rotation.y = Math.PI / 2;
          }
        }
        const wake = new Three.Mesh(
          new Three.PlaneGeometry(vehicleDefinition.l * 1.1, vehicleDefinition.w * 1.3),
          new Three.MeshBasicMaterial({
            map: haloTx,
            color: '#d2e4dc',
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
          }),
        );
        wake.rotation.x = -Math.PI / 2;
        wake.position.set(-vehicleDefinition.l * 0.6, 0.3, 0);
        b.add(wake);
        model.wake = wake;
        return model;
      }
      function makeTruck(c) {
        const model = specialVehicle(c),
          b = model.body,
          vehicleDefinition = vehicleSpec(c),
          l = vehicleDefinition.l,
          w = vehicleDefinition.w * 0.91,
          bus = c.type === 'bus',
          pickup = c.type === 'pickup',
          flatbed = c.type === 'flatbed',
          ambulance = c.type === 'ambulance';
        box(b, 0, 6, 0, l * 0.94, 4, w * 0.87, darkMetal);
        if (bus) {
          box(b, 0, 17, 0, l * 0.92, 23, w, model.paint);
          box(b, 0, 30, 0, l * 0.91, 2, w * 0.96, mat('#c9c6b9'));
          box(b, l * 0.466, 23, 0, 0.6, 12, w * 0.88, glass);
          for (const side of [-1, 1]) {
            for (let x = -l * 0.38; x < l * 0.42; x += 12)
              box(b, x, 23, side * w * 0.507, 10, 10, 0.35, glass);
            box(b, 0, 13, side * w * 0.51, l * 0.87, 2, 0.4, mat('#e3d4af'));
            box(b, l * 0.27, 15, side * w * 0.515, 9, 19, 0.4, glass);
          }
        } else {
          const cab = l * 0.31;
          box(b, l * 0.29, 13, 0, cab, 17, w, model.paint);
          box(b, l * 0.29, 23, 0, cab * 0.91, 2, w * 0.94, model.paint);
          box(b, l * 0.447, 19, 0, 0.6, 7, w * 0.83, glass);
          for (const side of [-1, 1]) {
            box(b, l * 0.28, 19, side * w * 0.505, cab * 0.72, 7, 0.4, glass);
            box(b, l * 0.18, 12, side * w * 0.517, 3, 0.7, 0.5, chrome);
            box(b, l * 0.37, 17, side * w * 0.62, 2, 2.4, 3, darkMetal);
          }
          if (flatbed) {
            box(b, -l * 0.18, 8.5, 0, l * 0.63, 3, w * 0.98, wood);
            for (const side of [-1, 1]) {
              box(b, -l * 0.18, 10.6, side * w * 0.49, l * 0.65, 2, 1.5, chrome);
              for (const x of [-l * 0.48, -l * 0.22, l * 0.08])
                box(b, x, 13, side * w * 0.49, 1.5, 7, 1.5, model.paint);
            }
            box(b, -l * 0.49, 11, 0, 2, 5, w, model.paint);
          } else if (pickup) {
            box(b, -l * 0.2, 9, 0, l * 0.56, 2, w * 0.94, model.paint);
            for (const side of [-1, 1])
              box(b, -l * 0.2, 12, side * w * 0.46, l * 0.57, 6, 1.3, model.paint);
            box(b, -l * 0.48, 12, 0, 1.5, 6, w, model.paint);
            box(b, -l * 0.2, 10.2, 0, l * 0.5, 0.4, w * 0.8, darkMetal);
          } else {
            const cargo = mat(ambulance ? '#e7e3d9' : '#a5b5b9', 0.74, 0.15);
            box(b, -l * 0.16, 18, 0, l * 0.6, 24, w, cargo);
            box(b, -l * 0.46, 18, 0, 0.5, 22, w * 0.89, chrome);
            for (const side of [-1, 1]) {
              if (ambulance) {
                box(b, -l * 0.16, 17, side * w * 0.506, l * 0.6, 3, 0.4, mat('#a63038'));
                box(b, -l * 0.2, 23, side * w * 0.51, 2, 7, 0.45, mat('#b12a32'));
                box(b, -l * 0.2, 23, side * w * 0.512, 7, 2, 0.46, mat('#b12a32'));
              } else
                for (let x = -l * 0.43; x < l * 0.13; x += 4)
                  box(b, x, 18, side * w * 0.503, 0.6, 22, 0.3, mat('#7f9094'));
            }
          }
        }
        for (const side of [-1, 1]) {
          for (const x of [l * 0.32, -l * 0.31, ...(l > 75 ? [-l * 0.16] : [])])
            tireAt(model, x, side * w * 0.46, bus ? 5.5 : 5, 3.4);
          // Lamps a crash or a bullet can put out (damage3d.js).
          model.lamps.push(
            { mesh: box(b, l * 0.478, 10, side * w * 0.34, 1.2, 3, 4, warmLamp), key: side < 0 ? 'headLeft' : 'headRight', lit: warmLamp },
            { mesh: box(b, -l * 0.48, 9, side * w * 0.35, 0.7, 2, 3, tailLamp), key: side < 0 ? 'tailLeft' : 'tailRight', lit: tailLamp },
          );
        }
        box(b, l * 0.49, 6.5, 0, 2, 3, w * 0.9, chrome);
        box(b, l * 0.475, 11, 0, 1, 4, w * 0.43, darkMetal);
        if (ambulance)
          for (const side of [-1, 1])
            model.strobes.push(
              box(
                b,
                l * 0.29,
                25,
                side * 7,
                4,
                2.4,
                5,
                new Three.MeshBasicMaterial({
                  color: '#cf4545',
                }),
              ),
            );
        return model;
      }
      function makeJetSki(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body;
        model.boat = true;
        model.jetski = true;
        mesh(bodyGeo(29, 12, 5), model.paint, b, 0, 0, 0);
        mesh(sphereGeo, model.paint, b, 7, 7, 0, 8, 4, 5);
        box(b, -5, 7, 0, 12, 2, 4, rubber);
        box(b, 7, 10, 0, 1, 2, 7, darkMetal);
        box(b, 8, 9, 0, 4, 1, 6, glass);
        box(b, -14, 4, 0, 2, 2, 3, darkMetal);
        const rider = new Three.Group();
        b.add(rider);
        box(rider, -2, 12, 0, 4, 7, 6, mat('#9f7545'));
        mesh(sphereGeo, mat('#b69880'), rider, 0, 18, 0, 2, 2.5, 2);
        for (const side of [-1, 1]) {
          rod(
            rider,
            new Three.Vector3(-1, 14, side * 3),
            new Three.Vector3(7, 10, side * 3),
            0.9,
            mat('#b69880'),
          );
          rod(
            rider,
            new Three.Vector3(-5, 9, side * 2),
            new Three.Vector3(-2, 5, side * 4),
            1.1,
            mat('#28343f'),
          );
        }
        model.rider = rider;
        const wake = new Three.Mesh(
          new Three.PlaneGeometry(50, 24),
          new Three.MeshBasicMaterial({
            map: haloTx,
            color: '#c5e3dc',
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
          }),
        );
        wake.rotation.x = -Math.PI / 2;
        wake.position.set(-26, 0.2, 0);
        b.add(wake);
        model.wake = wake;
        return model;
      }

      // Coachwork shares the deformable chassis, but each model has a distinct upper body.
      function coachDetails(c, b, l, w, h, roof, paint) {
        if (c.type === 'roadster') {
          box(b, -l * 0.09, h + 0.3, 0, l * 0.4, 1, w * 0.72, rubber);
          for (const side of [-1, 1]) {
            const z = side * w * 0.2;
            box(b, -l * 0.1, h + 1, z, 7, 2, 5.5, mat('#ab8462'));
            box(b, -l * 0.17, h + 3, z, 1.5, 5, 5.5, mat('#ab8462'));
            const hoop = mesh(
              new Three.TorusGeometry(2.5, 0.5, 6, 12, Math.PI),
              chrome,
              b,
              -l * 0.23,
              h + 3.2,
              z,
            );
            hoop.rotation.y = Math.PI / 2;
            rod(
              b,
              new Three.Vector3(
                l * 0.14 + Math.sin(0.3) * 2.5,
                h + 2.4 - Math.cos(0.3) * 2.5,
                side * w * 0.365,
              ),
              new Three.Vector3(
                l * 0.14 - Math.sin(0.3) * 2.5,
                h + 2.4 + Math.cos(0.3) * 2.5,
                side * w * 0.365,
              ),
              0.5,
              chrome,
            );
            box(b, -l * 0.34, h + 1, z, 6, 0.7, 5, paint);
          }
          box(b, -l * 0.46, h + 0.7, 0, 1.3, 1, w * 0.77, chrome);
        }
        if (c.type === 'rally') {
          box(b, -l * 0.39, roof + 1, 0, 3, 1, w * 1.04, paint);
          for (const side of [-1, 1]) {
            box(b, -l * 0.39, roof - 1, side * w * 0.34, 1, 4, 1, darkMetal);
            box(b, 0, 4.8, side * w * 0.53, l * 0.35, 1.4, 1.6, paint);
            box(b, 0, h - 1, side * w * 0.535, l * 0.58, 2, 0.2, mat('#d6cebd'));
            box(b, -l * 0.1, roof + 0.6, side * 2, l * 0.34, 0.25, 1.8, mat('#d6cebd'));
          }
          box(b, l * 0.29, h + 0.6, 0, 6, 1.3, 7, darkMetal);
          for (const z of [-w * 0.33, -w * 0.11, w * 0.11, w * 0.33]) {
            const lamp = mesh(wheelGeo, warmLamp, b, l * 0.5, h - 1, z, 1.7, 1.1, 1.7);
            lamp.rotation.z = Math.PI / 2;
          }
          box(b, -l * 0.12, roof + 2, 0, 4, 2, 4, darkMetal);
        }
        if (c.type === 'limousine') {
          for (const side of [-1, 1]) {
            for (const x of [-l * 0.26, -l * 0.08, l * 0.11]) {
              rod(
                b,
                new Three.Vector3(x, h, side * w * 0.422),
                new Three.Vector3(x, roof, side * w * 0.35),
                0.5,
                paint,
              );
              box(b, x + 4, h - 1, side * w * 0.51, 3, 0.5, 0.5, chrome);
            }
            box(b, -l * 0.06, h - 2.2, side * w * 0.51, l * 0.76, 0.5, 0.5, chrome);
          }
          box(b, l * 0.49, 7, 0, 0.8, 4, w * 0.42, chrome);
          for (let z = -w * 0.18; z < w * 0.18; z += 1.5)
            box(b, l * 0.496, 7, z, 0.3, 3.4, 0.4, darkMetal);
          box(b, l * 0.43, h + 1.7, 0, 0.45, 3, 0.45, chrome);
        }
        if (c.type === 'hotrod') {
          box(b, l * 0.24, h + 1.7, 0, l * 0.2, 5, w * 0.46, chrome);
          for (let x = l * 0.17; x < l * 0.34; x += 2)
            box(b, x, h + 4.4, 0, 0.7, 0.6, w * 0.43, darkMetal);
          box(b, l * 0.22, h + 6, 0, 5, 3, 5, chrome);
          box(b, l * 0.3, h + 6, 0, 0.5, 2.4, 4, darkMetal);
          for (const side of [-1, 1]) {
            for (let i = 0; i < 3; i++)
              rod(
                b,
                new Three.Vector3(l * 0.15 + i * 2, h + 1, side * w * 0.23),
                new Three.Vector3(l * 0.2 + i * 2, 4, side * w * 0.52),
                0.7,
                chrome,
              );
            box(b, 0, 4, side * w * 0.54, l * 0.55, 1.2, 1.2, chrome);
            box(b, -l * 0.32, 7, side * w * 0.45, 12, 1, 5, paint);
            rod(
              b,
              new Three.Vector3(-l * 0.3, h, side * w * 0.36),
              new Three.Vector3(-l * 0.27, roof, side * w * 0.29),
              0.6,
              paint,
            );
            rod(
              b,
              new Three.Vector3(-l * 0.02, h, side * w * 0.36),
              new Three.Vector3(-l * 0.13, roof, side * w * 0.29),
              0.6,
              paint,
            );
          }
          box(b, l * 0.48, h - 1, 0, 1.3, 7, w * 0.47, chrome);
          for (let z = -w * 0.2; z < w * 0.2; z += 1.4)
            box(b, l * 0.496, h - 1, z, 0.4, 6, 0.45, darkMetal);
        }
      }
      function makeBicycle(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body;
        model.bike = true;
        model.bicycle = true;
        const frame = model.paint;
        const wheels = [];
        for (const x of [-10, 10]) {
          const wheel = mesh(new Three.TorusGeometry(5.5, 0.7, 7, 20), rubber, b, x, 5.5, 0);
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            rod(
              b,
              new Three.Vector3(x, 5.5, 0),
              new Three.Vector3(x + Math.cos(a) * 5, 5.5 + Math.sin(a) * 5, 0),
              0.13,
              chrome,
            );
          }
          wheels.push({
            wheel,
          });
        }
        for (const [a, d] of [
          [
            [-10, 5.5, 0],
            [-2, 13, 0],
          ],
          [
            [-2, 13, 0],
            [3, 5, 0],
          ],
          [
            [3, 5, 0],
            [-10, 5.5, 0],
          ],
          [
            [-2, 13, 0],
            [8, 14, 0],
          ],
          [
            [8, 14, 0],
            [3, 5, 0],
          ],
          [
            [8, 14, 0],
            [10, 5.5, 0],
          ],
        ])
          rod(b, new Three.Vector3(...a), new Three.Vector3(...d), 0.65, frame);
        box(b, -2, 14.5, 0, 6, 1.5, 3, rubber);
        rod(b, new Three.Vector3(8, 14, 0), new Three.Vector3(9, 18, 0), 0.55, chrome);
        box(b, 9, 18, 0, 1, 1, 9, chrome);
        const crank = new Three.Group();
        crank.position.set(3, 5, 0);
        b.add(crank);
        box(crank, 0, 0, 0, 1, 6, 1, chrome);
        box(crank, 0, 3, 2, 3, 0.8, 3, rubber);
        box(crank, 0, -3, -2, 3, 0.8, 3, rubber);
        const rider = new Three.Group();
        b.add(rider);
        box(rider, -1, 20, 0, 4, 8, 6, mat('#4d7782'));
        mesh(sphereGeo, mat('#c4a489'), rider, 2, 26, 0, 2.2, 2.7, 2.2);
        mesh(sphereGeo, frame, rider, 2, 28, 0, 2.5, 1.4, 2.5);
        for (const side of [-1, 1]) {
          rod(
            rider,
            new Three.Vector3(0, 22, side * 3),
            new Three.Vector3(9, 18, side * 4),
            0.8,
            mat('#c4a489'),
          );
          rod(
            rider,
            new Three.Vector3(-3, 16, side * 2),
            new Three.Vector3(3, 9, side * 3),
            1,
            mat('#334d59'),
          );
        }
        model.rider = rider;
        model.crank = crank;
        model.wheels = wheels;
        return model;
      }
      // END SUBSYSTEM: src/vehicles3d.js
