      // BEGIN SUBSYSTEM: src/apache3d.js — The AH-64 attack helicopter model
      /**
       * The AH-64 attack helicopter model
       * Source: src/apache3d.js
       * Scope: createCityRenderer() closure.
       *
       * Fort Sentinel's Apache (apache.js), built procedurally at game scale (8 units
       * to the metre, x forward, y up, z to starboard, like helicopter3d.js):
       *   - a lofted fuselage (superellipse sections, `apacheLoft`): the narrow
       *     sensor nose, the tandem cockpit with the gunner low in front and the
       *     pilot stepped up behind under flat-panelled glazing, the avionics
       *     sponsons, the engine nacelles high on either side with their intakes
       *     and upturned exhaust suppressors, the long tail boom;
       *   - stub wings with two pylons each: a 19-tube rocket pod inboard (tube
       *     mouths on a canvas texture) and a four-missile Hellfire launcher
       *     outboard; wingtip nav lights and chaff dispensers;
       *   - the chin turret with its 30 mm chain gun (`gunYaw` / `gunPitch`
       *     groups, laid by apache.js: c.turretA, c.gunPitch), the TADS/PNVS
       *     sensor turret in the nose;
       *   - a four-blade main rotor with a mast-mounted radar dome, the swept
       *     fin with the scissor tail rotor on the port side, the stabilator,
       *     tailwheel and trailing-arm main gear;
       *   - olive drab with dark grey detail and a black anti-glare panel, low-
       *     visibility markings; red / green / white navigation lights and a red
       *     anti-collision beacon while it is flying.
       * Static parts are merged per material (aircraftBatch, plane3d.js); only the
       * rotors, the gun and the lights move. `animateApache` runs from the vehicle
       * pass after the shared helicopter animation (rotor spin, body tilt).
       */
      let apacheMaterials = null;
      function apacheMaterialSet() {
        if (apacheMaterials) return apacheMaterials;
        // Tube mouths of a 19-shot rocket pod, drawn once.
        const cv = document.createElement('canvas');
        cv.width = cv.height = 128;
        const g = cv.getContext('2d');
        g.fillStyle = '#5a5f4d';
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#16171a';
        const tubes = [[0, 0]];
        for (let i = 0; i < 6; i++) tubes.push([Math.cos((i * Math.PI) / 3) * 22, Math.sin((i * Math.PI) / 3) * 22]);
        for (let i = 0; i < 12; i++) tubes.push([Math.cos((i * Math.PI) / 6 + Math.PI / 12) * 44, Math.sin((i * Math.PI) / 6 + Math.PI / 12) * 44]);
        for (const [x, y] of tubes) {
          g.beginPath();
          g.arc(64 + x, 64 + y, 9.5, 0, TAU);
          g.fill();
        }
        g.strokeStyle = '#2d3027';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(64, 64, 61, 0, TAU);
        g.stroke();
        const podFace = new Three.CanvasTexture(cv);
        podFace.colorSpace = Three.SRGBColorSpace;
        apacheMaterials = {
          podFace: new Three.MeshStandardMaterial({ map: podFace, roughness: 0.8, metalness: 0.2 }),
          grey: mat('#3b4042', 0.72, 0.3),
          black: mat('#141618', 0.6, 0.2),
          blade: mat('#26292a', 0.62, 0.35),
          metal: mat('#6d7275', 0.45, 0.7),
          rubber: mat('#161618', 0.95),
          missile: mat('#5b5c43', 0.6, 0.25),
          band: mat('#c9a53a', 0.6, 0.1),
          sensor: new Three.MeshStandardMaterial({ color: '#10161c', roughness: 0.06, metalness: 0.9 }),
        };
        return apacheMaterials;
      }
      /**
       * A lofted body along x: `stations` fore to aft, each { x, w, h, y } (half
       * width in z, half height in y, centre height). Sections are superellipses
       * of exponent `n` (2 an ellipse, higher squarer); `flat` (0..1) flattens the
       * lower half toward a keel. Both ends are closed.
       */
      function apacheLoft(stations, segments = 18, n = 2.6, flat = 0) {
        const positions = [],
          indices = [],
          ring = (st) => {
            const out = [];
            for (let j = 0; j < segments; j++) {
              const t = (j / segments) * TAU,
                c = Math.cos(t),
                s = Math.sin(t);
              let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * st.h;
              if (s < 0) y *= 1 - flat * 0.35;
              out.push([st.x, st.y + y, Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * st.w]);
            }
            return out;
          };
        const rings = stations.map(ring);
        for (const r of rings) for (const p of r) positions.push(...p);
        for (let i = 0; i < rings.length - 1; i++)
          for (let j = 0; j < segments; j++) {
            const a = i * segments + j,
              b = (i + 1) * segments + j,
              c = i * segments + ((j + 1) % segments),
              d = (i + 1) * segments + ((j + 1) % segments);
            indices.push(a, c, b, c, d, b);
          }
        // End caps: their own vertices, so the rim keeps a crisp edge.
        for (const [k, front] of [
          [0, true],
          [rings.length - 1, false],
        ]) {
          const st = stations[k],
            base = positions.length / 3;
          positions.push(st.x, st.y, 0);
          for (const p of rings[k]) positions.push(...p);
          for (let j = 0; j < segments; j++) {
            const p0 = base + 1 + j,
              p1 = base + 1 + ((j + 1) % segments);
            if (front) indices.push(base, p1, p0);
            else indices.push(base, p0, p1);
          }
        }
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
      }
      function makeApache(vehicle) {
        const group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        const M = apacheMaterialSet(),
          paint = new Three.MeshStandardMaterial({ color: vehicle.color, roughness: 0.74, metalness: 0.22 }),
          canopy = glass.clone(),
          batch = aircraftBatch(),
          V = (x, y, z) => new Three.Vector3(x, y, z);
        canopy.color.set('#1c2a2c');
        canopy.roughness = 0.1;
        // ---- Fuselage: nose, tandem cockpit, engine bay, tail boom ----
        batch.add(
          apacheLoft(
            [
              { x: 47, w: 1.2, h: 1.6, y: 12.2 },
              { x: 45, w: 3.2, h: 3.8, y: 12.4 },
              { x: 40, w: 4.4, h: 5.2, y: 12.8 },
              { x: 32, w: 5.2, h: 6, y: 13.2 },
              { x: 20, w: 5.8, h: 6.6, y: 13.6 },
              { x: 8, w: 6.4, h: 7.2, y: 14 },
              { x: -4, w: 6.2, h: 7, y: 14.4 },
              { x: -14, w: 5, h: 5.6, y: 15.2 },
              { x: -24, w: 3.4, h: 3.9, y: 16.4 },
              { x: -40, w: 2.6, h: 3.1, y: 17.1 },
              { x: -56, w: 2.1, h: 2.7, y: 17.7 },
              { x: -64, w: 1.8, h: 2.4, y: 18 },
              { x: -67, w: 1.2, h: 1.8, y: 18 },
            ],
            20,
            2.7,
            0.4,
          ),
          paint,
        );
        // Spine fairing over the engine bay up to the rotor pylon.
        batch.add(
          apacheLoft(
            [
              { x: 12, w: 1.2, h: 0.8, y: 20.4 },
              { x: 6, w: 3.6, h: 2.4, y: 21 },
              { x: -6, w: 3.8, h: 2.8, y: 21.2 },
              { x: -16, w: 2.4, h: 1.8, y: 20.4 },
              { x: -24, w: 0.8, h: 0.6, y: 19.4 },
            ],
            14,
            2.4,
          ),
          paint,
        );
        // Avionics sponsons along both sides of the cockpit and bay.
        for (const side of [-1, 1])
          batch.add(
            apacheLoft(
              [
                { x: 30, w: 0.6, h: 1.2, y: 11.4 },
                { x: 26, w: 2.4, h: 3, y: 11.6 },
                { x: 4, w: 2.8, h: 3.4, y: 11.8 },
                { x: -8, w: 2.2, h: 2.8, y: 12.4 },
                { x: -12, w: 0.6, h: 1, y: 12.8 },
              ].map((st) => st),
              12,
              3.2,
            ).translate(0, 0, side * 6.2),
            paint,
          );
        // Canopy: the gunner's lower front glazing, the pilot's raised rear one,
        // flat panels framed in dark grey.
        batch.add(
          apacheLoft(
            [
              { x: 40, w: 2.2, h: 0.4, y: 17.2 },
              { x: 36, w: 3.9, h: 2.2, y: 18.2 },
              { x: 29, w: 4.5, h: 3.1, y: 19 },
              { x: 24, w: 4.6, h: 3.2, y: 19.1 },
            ],
            12,
            4,
          ),
          canopy,
        );
        batch.add(
          apacheLoft(
            [
              { x: 24.5, w: 4.3, h: 3.6, y: 20.8 },
              { x: 19, w: 4.8, h: 4.6, y: 21.9 },
              { x: 12, w: 4.8, h: 4.4, y: 22 },
              { x: 8, w: 3.6, h: 1.6, y: 21.4 },
            ],
            12,
            4,
          ),
          canopy,
        );
        // Canopy frames: the step between the cockpits, the centre bows and sills.
        batch.place(boxGeo, M.grey, 24.3, 20.3, 0, 0.9, 5.4, 9.6);
        batch.place(boxGeo, M.grey, 18, 26.2, 0, 11.5, 0.6, 1);
        batch.place(boxGeo, M.grey, 31.5, 21.9, 0, 11, 0.5, 0.9, 0, 0, -0.22);
        for (const side of [-1, 1]) {
          batch.place(boxGeo, M.grey, 31, 17.2, side * 4.2, 15, 0.7, 0.6);
          batch.place(boxGeo, M.grey, 16, 18.4, side * 4.6, 16, 0.7, 0.6);
          batch.place(boxGeo, M.grey, 29, 19.2, side * 4.45, 0.6, 5, 0.5);
          batch.place(boxGeo, M.grey, 16, 22, side * 4.75, 0.6, 7.4, 0.5);
        }
        // Black anti-glare panel ahead of the gunner.
        batch.place(sphereGeo, M.black, 41.5, 16.6, 0, 5.8, 1.1, 3.1);
        // ---- Nose sensors: TADS drums low, PNVS above ----
        batch.place(boxGeo, M.grey, 47.5, 13.4, 0, 3.4, 3, 3.4);
        batch.place(cylinderGeo, M.grey, 49.5, 10.4, 0, 3.4, 7.6, 3.4, Math.PI / 2, 0, 0);
        for (const side of [-1, 1]) {
          batch.place(cylinderGeo, M.grey, 50, 10.4, side * 4.6, 3.1, 2.4, 3.1, Math.PI / 2, 0, 0);
          batch.place(boxGeo, M.sensor, 52.9, 10.4, side * 4.6, 0.5, 2.6, 1.8);
        }
        batch.place(boxGeo, M.sensor, 52.9, 10.4, 0, 0.5, 2.2, 2.4);
        batch.place(sphereGeo, M.grey, 48, 16.4, 0, 2.6, 1.6, 2);
        batch.place(sphereGeo, M.sensor, 50.2, 16.4, 0, 0.9, 1, 1.2);
        // ---- Engine nacelles, intakes and exhaust suppressors ----
        for (const side of [-1, 1]) {
          const z = side * 8.6;
          batch.add(
            apacheLoft(
              [
                { x: 7, w: 2.3, h: 2.3, y: 19.2 },
                { x: 5, w: 3.3, h: 3.4, y: 19.2 },
                { x: -8, w: 3.4, h: 3.6, y: 19.4 },
                { x: -15, w: 2.8, h: 3, y: 19.6 },
                { x: -18, w: 2, h: 2.2, y: 19.8 },
              ],
              14,
              2.2,
            ).translate(0, 0, z),
            paint,
          );
          batch.place(cylinderGeo, M.black, 7.2, 19.2, z, 2.2, 0.6, 2.2, 0, 0, Math.PI / 2);
          batch.place(sphereGeo, M.metal, 7.6, 19.2, z, 0.9, 0.9, 0.9);
          // Pylon from the nacelle down to the fuselage.
          batch.place(boxGeo, paint, -3, 18, side * 6.2, 14, 3, 2.6);
          // The "black hole" IR suppressor: a flat box turned out and up.
          batch.place(boxGeo, M.grey, -20.5, 20.4, z + side * 0.8, 6, 2.8, 4.4, side * 0.3, side * 0.25, 0.2);
          batch.place(boxGeo, M.black, -23.4, 21.3, z + side * 1.2, 0.5, 2.2, 3.6, side * 0.3, side * 0.25, 0.2);
        }
        // ---- Stub wings, pylons, rocket pods and Hellfire launchers ----
        for (const side of [-1, 1]) {
          // The wing: root to tip with a little anhedral.
          batch.place(boxGeo, paint, 2, 15.6, side * 16, 11.5, 1.3, 20, side * 0.05, 0, 0);
          batch.place(boxGeo, M.grey, -3.8, 15.4, side * 16, 1.4, 0.9, 19.6, side * 0.05, 0, 0);
          // Wingtip chaff dispenser.
          batch.place(boxGeo, M.grey, 2.2, 14.9, side * 26.4, 7, 1.6, 1.4);
          for (const [pz, kind] of [
            [12.5, 'pod'],
            [21.5, 'hellfire'],
          ]) {
            const z = side * pz;
            batch.place(boxGeo, M.grey, 2.2, 13.6, z, 6.5, 2.8, 1.3);
            if (kind === 'pod') {
              // M261-style pod: a drum of 19 tubes with faceted fairings.
              batch.place(cylinderGeo, M.missile, 1.8, 10.1, z, 3.2, 14.6, 3.2, 0, 0, Math.PI / 2);
              batch.place(cylinderGeo, M.grey, 1.8, 10.1, z, 3.3, 1.2, 3.3, 0, 0, Math.PI / 2);
              for (const x of [9.12, -5.52]) {
                const face = new Three.CircleGeometry(3.15, 20);
                face.rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2);
                face.translate(x, 10.1, z);
                batch.add(face, M.podFace);
              }
            } else {
              // M299-style launcher: a rail box with four missiles in two rows.
              batch.place(boxGeo, M.grey, 2, 11.1, z, 12, 1.4, 2);
              for (const [dy, dz] of [
                [-1.7, -1.9],
                [-1.7, 1.9],
                [-5.1, -1.9],
                [-5.1, 1.9],
              ]) {
                const y = 11.1 + dy,
                  mz = z + dz;
                batch.place(cylinderGeo, M.missile, 1.4, y, mz, 0.95, 12.6, 0.95, 0, 0, Math.PI / 2);
                batch.place(sphereGeo, M.missile, 7.7, y, mz, 1.4, 0.95, 0.95);
                batch.place(boxGeo, M.band, 5.6, y, mz, 0.5, 2, 2);
                // Cruciform fins.
                batch.place(boxGeo, M.grey, -3.8, y, mz, 2.4, 3.2, 0.2);
                batch.place(boxGeo, M.grey, -3.8, y, mz, 2.4, 0.2, 3.2);
                batch.place(boxGeo, M.grey, 3.6, y, mz, 1.6, 2.4, 0.18);
              }
            }
          }
        }
        // ---- Main gear on trailing arms, tailwheel ----
        for (const side of [-1, 1]) {
          const z = side * 9.6;
          batch.rod(V(17, 9.5, side * 5.4), V(13.5, 3.6, z), 0.8, M.metal);
          batch.rod(V(9, 12, side * 5.6), V(13.5, 3.6, z), 0.55, M.metal);
          batch.place(boxGeo, M.grey, 13.5, 3.6, z - side * 0.4, 2.2, 1.6, 1.6);
          batch.place(wheelGeo, M.rubber, 13.5, 3.3, z + side * 1.2, 3.3, 2.2, 3.3, Math.PI / 2, 0, 0);
          batch.place(cylinderGeo, M.metal, 13.5, 3.3, z + side * 2.4, 1.4, 0.3, 1.4, Math.PI / 2, 0, 0);
        }
        batch.rod(V(-58, 16.2, 0), V(-61, 3, 0), 0.6, M.metal);
        batch.place(wheelGeo, M.rubber, -61.6, 2.4, 0, 2.4, 1.4, 2.4, Math.PI / 2, 0, 0);
        // ---- Tail: swept fin with the tail-rotor gearbox, stabilator ----
        const fin = new Three.Shape();
        fin.moveTo(-54, 16.8);
        fin.lineTo(-61, 30.4);
        fin.lineTo(-66.5, 31);
        fin.lineTo(-67.4, 18.4);
        fin.lineTo(-66, 15.6);
        fin.closePath();
        const finGeo = new Three.ExtrudeGeometry(fin, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 1 });
        finGeo.translate(0, 0, -0.7);
        batch.add(finGeo, paint);
        batch.place(boxGeo, M.grey, -64.2, 28.4, -1.8, 3.2, 3, 2.4);
        batch.place(boxGeo, paint, -64.5, 16.4, 0, 6.4, 0.7, 20);
        // ---- Chin turret base, ALQ jammer, antennas, steps ----
        batch.place(cylinderGeo, M.grey, 33, 6.7, 0, 3, 1.6, 3);
        batch.place(boxGeo, M.grey, -11, 23.2, 0, 3.4, 3, 3.4);
        batch.place(sphereGeo, M.metal, -11, 25, 0, 1.3, 1.1, 1.3);
        batch.place(boxGeo, M.black, -30, 20.2, 0, 3, 0.25, 0.4);
        batch.place(boxGeo, M.black, 2, 7.1, 0, 5, 0.3, 0.4);
        batch.rod(V(-36, 19.8, 0), V(-40, 23.8, 0), 0.25, M.black);
        for (const side of [-1, 1]) batch.place(boxGeo, M.metal, 22, 8.2, side * 6.4, 2.6, 0.35, 1.4);
        // ---- Rotor pylon and mast ----
        batch.place(cylinderGeo, M.grey, -2, 24.4, 0, 2.2, 4, 2.2);
        batch.place(cylinderGeo, M.metal, -2, 28, 0, 1.2, 4, 1.2);
        // Markings: low-visibility tail number and base name.
        for (const side of [-1, 1]) {
          const tailNumber = aircraftLabel(body, 'S-064', -48, 18.2, side * 2.95, 11, '#1f2320', side > 0 ? 0 : Math.PI);
          tailNumber.material.opacity = 0.8;
          aircraftLabel(body, 'FORT SENTINEL', -2, 12.4, side * 9.2, 12, '#23261f', side > 0 ? 0 : Math.PI).material.opacity = 0.7;
        }
        batch.flush(body, 'apache airframe');
        // ---- Moving parts: main rotor, radar dome, tail rotor, gun ----
        const rotor = new Three.Group();
        rotor.position.set(-2, 30.4, 0);
        body.add(rotor);
        mesh(cylinderGeo, M.metal, rotor, 0, 0, 0, 3.4, 1.4, 3.4);
        for (let i = 0; i < 4; i++) {
          const arm = new Three.Group();
          arm.rotation.y = (i * Math.PI) / 2;
          rotor.add(arm);
          // Blade root cuff, the blade (a slight taper toward the swept tip).
          box(arm, 4.2, 0, 0, 5, 0.9, 2.2, M.grey);
          box(arm, 30, 0, 0, 50, 0.5, 4.2, M.blade);
          box(arm, 56, 0, 0.3, 4, 0.45, 3.4, M.blade).rotation.y = 0.25;
        }
        // Longbow radar dome on a fixed mast above the hub (it does not turn).
        mesh(sphereGeo, M.grey, body, -2, 34.6, 0, 4.4, 2.4, 4.4);
        mesh(cylinderGeo, M.grey, body, -2, 32.2, 0, 1.2, 2.4, 1.2);
        const disc = new Three.Mesh(
          new Three.CircleGeometry(58, 48),
          new Three.MeshBasicMaterial({ color: '#9ea39a', transparent: true, opacity: 0.1, side: Three.DoubleSide, depthWrite: false }),
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(-2, 30.5, 0);
        body.add(disc);
        // The scissor tail rotor on the port side: two pairs of blades 55° apart.
        const tail = new Three.Group();
        tail.position.set(-64.2, 28.4, -3.4);
        body.add(tail);
        mesh(cylinderGeo, M.metal, tail, 0, 0, 0, 1.1, 1.2, 1.1).rotation.x = Math.PI / 2;
        for (const a of [0, 0.96, Math.PI, Math.PI + 0.96]) {
          const b = box(tail, Math.cos(a) * 5.6, Math.sin(a) * 5.6, 0, 11.2, 1.3, 0.3, M.blade);
          b.rotation.z = a;
        }
        // Chin gun: the turret turns (gunYaw), the gun elevates (gunPitch).
        const gunYaw = new Three.Group();
        gunYaw.position.set(33, 5.6, 0);
        body.add(gunYaw);
        mesh(sphereGeo, M.grey, gunYaw, 0, 0, 0, 2.6, 1.8, 2.6);
        const gunPitch = new Three.Group();
        gunYaw.add(gunPitch);
        box(gunPitch, 3, -0.6, 0, 6, 2, 2.2, M.grey);
        box(gunPitch, 2.2, -0.4, 1.7, 4, 1.4, 1.2, M.black);
        const barrel = new Three.Group();
        gunPitch.add(barrel);
        mesh(cylinderGeo, M.black, barrel, 11, -0.6, 0, 0.45, 12, 0.45).rotation.z = Math.PI / 2;
        mesh(cylinderGeo, M.black, barrel, 16.8, -0.6, 0, 0.75, 1.6, 0.75).rotation.z = Math.PI / 2;
        mesh(cylinderGeo, M.grey, barrel, 7, -0.6, 0, 0.8, 3, 0.8).rotation.z = Math.PI / 2;
        // Lights: red port, green starboard wingtips, white tail, red beacons.
        const lights = {
          nav: [halo(body, 2.2, 15, -27.4, 6, '#ff4a3a'), halo(body, 2.2, 15, 27.4, 6, '#57f08a'), halo(body, -67.8, 20, 0, 5, '#fff4dc')],
          beacons: [halo(body, -11, 26.6, 0, 9, '#ff2e22'), halo(body, 8, 6.6, 0, 8, '#ff2e22')],
        };
        for (const s of [...lights.nav, ...lights.beacons]) s.visible = false;
        return {
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          rotor,
          disc,
          tail,
          canopy: { material: canopy },
          shell: null,
          helicopter: true,
          apache: true,
          gunYaw,
          gunPitch,
          barrel,
          lights,
        };
      }
      /* Gun laying, recoil and lights (the vehicle pass, after the shared rotor spin). */
      function animateApache(c, m) {
        const flying = c.hp > 0 && (c === player.car || (c.abandonedFlight && entityElevation(c) > terrainHeight(c.x, c.y) + 2));
        m.gunYaw.rotation.y = -normalizeAngle((c.turretA ?? c.a) - c.a);
        m.gunPitch.rotation.z = c.gunPitch || 0;
        // The barrel runs back a little with each round.
        const sinceShot = gameTime - (c.arms?.gunReadyAt ?? -1) + 0.1;
        m.barrel.position.x = sinceShot >= 0 && sinceShot < 0.06 ? -1.1 : 0;
        const beat = (gameTime * 1.1) % 1;
        for (const s of m.lights.nav) s.visible = flying;
        for (const s of m.lights.beacons) s.visible = flying && beat < 0.12;
      }
      // END SUBSYSTEM: src/apache3d.js
