      // BEGIN SUBSYSTEM: src/plane3d.js — Airplane meshes
      /**
       * Airplane meshes
       * Source: src/plane3d.js
       * Scope: createCityRenderer() closure.
       * Courier propeller aircraft, executive jet and large airliner geometry.
       */
      /* Distinct native meshes. Local +X is forward; collision footprints include tips/tail. */
      function makePlane(vehicle) {
        return vehicle.airframe === 'jet' || vehicle.airframe === 'airliner'
          ? makeJetPlane(vehicle)
          : makeCourierPlane(vehicle);
      }
      function makeJetPlane(vehicle) {
        const airline = vehicle.airframe === 'airliner',
          group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        group.name = airline ? 'Oceanview airliner' : 'South Coast executive jet';
        const paint = mat(vehicle.color || '#e4e9e5', 0.33, 0.38),
          accent = mat(airline ? '#3f7790' : '#43566c', 0.36, 0.42),
          gold = mat('#d0af72', 0.4, 0.36),
          intake = mat('#19242b', 0.76, 0.2),
          windowMat = glass.clone();
        const wheels = [],
          span = airline ? 74 : 59,
          cy = airline ? 20 : 14;
        // An elliptical loft produces a rounded nose, full cabin and tapered tail without scaling a sphere.
        function loft(profiles) {
          const count = 20,
            positions = [],
            indices = [];
          for (const [x, ry, rz] of profiles)
            for (let j = 0; j < count; j++) {
              const a = (j / count) * Math.PI * 2;
              positions.push(x, cy + Math.cos(a) * ry, Math.sin(a) * rz);
            }
          for (let i = 0; i < profiles.length - 1; i++)
            for (let j = 0; j < count; j++) {
              const a = i * count + j,
                b = i * count + ((j + 1) % count),
                d = (i + 1) * count + j,
                e = (i + 1) * count + ((j + 1) % count);
              indices.push(a, b, d, b, e, d);
            }
          const geometry = new Three.BufferGeometry();
          geometry.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          return mesh(geometry, paint, body, 0, 0, 0);
        }
        loft(
          airline
            ? [
                [-106, 0.12, 0.12],
                [-99, 3.2, 3.1],
                [-79, 8.6, 8.8],
                [-61, 11.1, 11.2],
                [58, 11.1, 11.2],
                [78, 9.4, 10.4],
                [94, 5.3, 6.3],
                [107, 0.12, 0.12],
              ]
            : [
                [-74, 0.12, 0.12],
                [-63, 3.3, 3.4],
                [-47, 6.2, 6.5],
                [-28, 7.3, 7.7],
                [36, 7.3, 7.7],
                [52, 5.9, 6.6],
                [65, 3.4, 4.2],
                [75, 0.12, 0.12],
              ],
        );
        // Triangulated extruded profiles keep the wing silhouette swept, with actual thickness and clean edges.
        function panel(points, height, thickness, material, vertical = false) {
          let poly = points.map(([x, y]) => new Three.Vector2(x, y));
          if (Three.ShapeUtils.isClockWise(poly)) poly.reverse();
          const n = poly.length,
            positions = [],
            indices = [],
            triangles = Three.ShapeUtils.triangulateShape(poly, []);
          for (const side of [-1, 1])
            for (const p of poly)
              positions.push(
                p.x,
                vertical ? p.y : height + (side * thickness) / 2,
                vertical ? height + (side * thickness) / 2 : p.y,
              );
          for (const f of triangles) {
            if (vertical) indices.push(f[2], f[1], f[0], n + f[0], n + f[1], n + f[2]);
            else indices.push(f[0], f[1], f[2], n + f[2], n + f[1], n + f[0]);
          }
          for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            if (vertical) indices.push(i, j, n + i, j, n + j, n + i);
            else indices.push(j, i, n + i, n + j, j, n + i);
          }
          const geometry = new Three.BufferGeometry();
          geometry.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          return mesh(geometry, material, body, 0, 0, 0);
        }
        for (const side of [-1, 1]) {
          const wing = airline
            ? [
                [28, 9],
                [7, 32],
                [-30, 74],
                [-44, 74],
                [-19, 27],
                [-24, 9],
              ]
            : [
                [16, 6],
                [-4, 30],
                [-26, 59],
                [-36, 59],
                [-17, 24],
                [-20, 6],
              ];
          panel(
            wing.map(([x, z]) => [x, z * side]),
            airline ? 17 : 12,
            airline ? 2.4 : 1.6,
            paint,
          );
          // Distinct painted tip and flap surface, kept inside the collision envelope.
          const tip = airline
            ? [
                [-30, 73],
                [-35, 66],
                [-42, 66],
                [-43, 73],
              ]
            : [
                [-26, 58],
                [-29, 53],
                [-34, 53],
                [-35, 58],
              ];
          panel(
            tip.map(([x, z]) => [x, z * side]),
            airline ? 18.3 : 12.9,
            0.18,
            accent,
          );
          rod(
            body,
            new Three.Vector3(airline ? -20 : -16, airline ? 18.3 : 12.9, side * 24),
            new Three.Vector3(airline ? -38 : -32, airline ? 18.3 : 12.9, side * (span - 5)),
            0.23,
            darkMetal,
          );
          if (airline) {
            const winglet = panel(
              [
                [-30, 18],
                [-34, 27],
                [-40, 27],
                [-44, 18],
              ],
              side * 73.4,
              1,
              accent,
              true,
            );
            winglet.name = 'Blended wingtip';
          } else
            panel(
              [
                [-26, 13],
                [-28, 20],
                [-33, 20],
                [-36, 13],
              ],
              side * 58.4,
              0.8,
              accent,
              true,
            );
          const glow = new Three.MeshBasicMaterial({
            color: side > 0 ? '#79cfa4' : '#dd695c',
          });
          mesh(
            sphereGeo,
            glow,
            body,
            airline ? -34 : -29,
            airline ? 20 : 15,
            side * (span - 0.7),
            0.95,
            0.75,
            0.65,
          );
        }
        // Private jet has a T-tail; the airliner has a low stabilizer and taller swept vertical fin.
        const fin = airline
          ? [
              [-83, 24],
              [-92, 58],
              [-105, 60],
              [-103, 23],
            ]
          : [
              [-53, 17],
              [-62, 45],
              [-72, 47],
              [-71, 16],
            ];
        panel(fin, 0, airline ? 2.3 : 1.8, accent, true);
        for (const side of [-1, 1]) {
          const tail = airline
            ? [
                [-75, 3],
                [-89, 29],
                [-104, 29],
                [-98, 3],
              ]
            : [
                [-60, 1],
                [-67, 22],
                [-73, 22],
                [-69, 1],
              ];
          panel(
            tail.map(([x, z]) => [x, z * side]),
            airline ? 26 : 43,
            airline ? 1.5 : 1.1,
            paint,
          );
        }
        // Nacelle intake rings and recessed disks give engines depth at the normal city camera distance.
        function engine(x, y, z, length, radius) {
          const nacelle = mesh(
            new Three.CylinderGeometry(radius, radius * 0.86, length, 18, 1, false),
            paint,
            body,
            x,
            y,
            z,
          );
          nacelle.rotation.z = -Math.PI / 2;
          const ring = mesh(
            new Three.TorusGeometry(radius * 0.89, radius * 0.13, 8, 20),
            chrome,
            body,
            x + length / 2 + 0.08,
            y,
            z,
          );
          ring.rotation.y = Math.PI / 2;
          const mouth = mesh(
            new Three.CircleGeometry(radius * 0.8, 20),
            intake,
            body,
            x + length / 2 + 0.03,
            y,
            z,
          );
          mouth.rotation.y = Math.PI / 2;
          const spinner = mesh(
            new Three.ConeGeometry(radius * 0.24, radius * 0.56, 12),
            chrome,
            body,
            x + length / 2 + 0.12,
            y,
            z,
          );
          spinner.rotation.z = -Math.PI / 2;
          const exhaust = mesh(
            new Three.CircleGeometry(radius * 0.61, 16),
            intake,
            body,
            x - length / 2 - 0.04,
            y,
            z,
          );
          exhaust.rotation.y = -Math.PI / 2;
          for (let j = 0; j < 6; j++) {
            const a = (j * Math.PI) / 3;
            rod(
              body,
              new Three.Vector3(
                x + length / 2 + 0.05,
                y + Math.cos(a) * radius * 0.3,
                z + Math.sin(a) * radius * 0.3,
              ),
              new Three.Vector3(
                x + length / 2 + 0.06,
                y + Math.cos(a + 0.32) * radius * 0.69,
                z + Math.sin(a + 0.32) * radius * 0.69,
              ),
              radius * 0.045,
              chrome,
            );
          }
        }
        for (const side of [-1, 1]) {
          if (airline) {
            box(body, 6, 15, side * 32, 13, 9, 2.5, accent);
            engine(9, 10.7, side * 32, 25, 7.1);
          } else {
            box(body, -45, 15, side * 8.7, 19, 2, 12, accent);
            engine(-44, 15, side * 14.4, 23, 4.5);
          }
        }
        const canopy = mesh(
          new Three.SphereGeometry(1, 16, 8),
          windowMat,
          body,
          airline ? 78 : 48,
          airline ? 26.9 : 19.0,
          0,
          airline ? 11 : 9,
          airline ? 3.7 : 2.8,
          airline ? 7.6 : 5.8,
        );
        // Window ribbon follows the constant-radius cabin; dark individual panes retain a readable scale.
        const first = airline ? -66 : -34,
          last = airline ? 55 : 29,
          step = airline ? 8.4 : 11.8,
          windowZ = airline ? 10.85 : 7.32,
          windowY = airline ? 23.5 : 16.2;
        for (const side of [-1, 1]) {
          box(
            body,
            (first + last) / 2,
            airline ? 20.5 : 13.8,
            side * (windowZ + 0.05),
            last - first + 10,
            airline ? 2.1 : 1.2,
            0.45,
            accent,
          );
          if (!airline)
            box(
              body,
              (first + last) / 2,
              12.8,
              side * (windowZ + 0.04),
              last - first + 10,
              0.55,
              0.5,
              gold,
            );
          for (let x = first; x <= last; x += step)
            mesh(
              sphereGeo,
              windowMat,
              body,
              x,
              windowY,
              side * windowZ,
              airline ? 1.65 : 2.1,
              airline ? 2.3 : 2.2,
              0.34,
            );
          for (const x of airline ? [-72, 62] : [35]) {
            box(
              body,
              x,
              airline ? 21 : 15.5,
              side * (windowZ + 0.18),
              airline ? 5.3 : 4.4,
              airline ? 12 : 9,
              0.35,
              paint,
            );
            for (const dx of [-1, 1])
              box(
                body,
                x + dx * (airline ? 2.65 : 2.2),
                airline ? 21 : 15.5,
                side * (windowZ + 0.39),
                0.17,
                airline ? 12 : 9,
                0.15,
                accent,
              );
            box(body, x + 0.8, airline ? 21 : 15.5, side * (windowZ + 0.52), 1.5, 0.35, 0.15, chrome);
          }
        }
        // Nose and paired main landing gear are dynamic, matching the existing wheel animation interface.
        const gear = airline
            ? [
                [74, 0],
                [-13, -10],
                [-13, 10],
              ]
            : [
                [45, 0],
                [-12, -7],
                [-12, 7],
              ],
          radius = airline ? 3.2 : 2.4;
        for (const [x, z] of gear) {
          rod(
            body,
            new Three.Vector3(x, cy - 4, z * 0.7),
            new Three.Vector3(x, radius, z),
            airline ? 1 : 0.72,
            chrome,
          );
          for (const side of airline && x < 0 ? [-1, 1] : [0]) {
            // A pivot group spins about its axle; a pre-tilted cylinder would wobble instead.
            const wheel = new Three.Group();
            wheel.position.set(x, radius, z + side * 2.2);
            body.add(wheel);
            const tire = mesh(wheelGeo, rubber, wheel, 0, 0, 0, radius, airline ? 1.7 : 1.4, radius);
            tire.rotation.x = Math.PI / 2;
            wheels.push({
              wheel,
            });
          }
        }
        return {
          group,
          body,
          paint,
          canopy,
          prop: null,
          wheels,
          strobes: [],
          special: true,
          plane: true,
        };
      }
      function makeCourierPlane(vehicle) {
        const group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        const paint = mat(vehicle.color, 0.36, 0.45),
          stripe = mat('#a95640', 0.4, 0.3);
        mesh(new Three.SphereGeometry(1, 24, 12), paint, body, 0, 12, 0, 49, 7, 7);
        const nose = mesh(new Three.ConeGeometry(6, 14, 16), paint, body, 47, 12, 0);
        nose.rotation.z = -Math.PI / 2;
        const canopy = mesh(
          new Three.SphereGeometry(1, 16, 10),
          glass.clone(),
          body,
          17,
          15,
          0,
          13,
          6,
          6.3,
        );
        box(body, 16, 19, 0, 1, 3, 13, paint);
        for (const side of [-1, 1]) {
          const wing = box(body, -2, 11, side * 27, 23, 2, 46, paint);
          wing.rotation.y = side * 0.13;
          box(body, -3, 12.1, side * 44, 20, 0.3, 5, stripe);
          box(body, -40, 14, side * 12, 14, 1.4, 23, paint);
          rod(
            body,
            new Three.Vector3(-5, 5, side * 6),
            new Three.Vector3(0, 10, side * 33),
            0.65,
            chrome,
          );
          box(body, 4, 11, side * 6.5, 64, 1.5, 0.5, stripe);
          box(
            body,
            -2,
            12,
            side * 49,
            3,
            1.4,
            2,
            new Three.MeshBasicMaterial({
              color: side > 0 ? '#7cc39f' : '#d76457',
            }),
          );
        }
        const fin = box(body, -41, 23, 0, 16, 20, 1.5, paint);
        fin.rotation.z = 0.18;
        box(body, -44, 30, 0, 9, 2, 2, stripe);
        const wheels = [];
        for (const [x, z] of [
          [16, -10],
          [16, 10],
          [-35, 0],
        ]) {
          rod(body, new Three.Vector3(x, 10, z * 0.4), new Three.Vector3(x, 3, z), 0.9, chrome);
          const wheel = new Three.Group();
          wheel.position.set(x, 3, z);
          body.add(wheel);
          const tire = mesh(wheelGeo, rubber, wheel, 0, 0, 0, 3, 2, 3);
          tire.rotation.x = Math.PI / 2;
          wheels.push({
            wheel,
          });
        }
        const prop = new Three.Group();
        prop.position.set(54, 12, 0);
        body.add(prop);
        box(prop, 0, 0, 0, 1, 31, 2, darkMetal);
        box(prop, 0, 0, 0, 1, 2, 31, darkMetal);
        mesh(sphereGeo, chrome, prop, 0, 0, 0, 2.3, 2.3, 2.3);
        return {
          group,
          body,
          paint,
          canopy,
          prop,
          wheels,
          strobes: [],
          special: true,
          plane: true,
        };
      }
      // END SUBSYSTEM: src/plane3d.js
