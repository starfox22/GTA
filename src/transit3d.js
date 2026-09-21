      // BEGIN SUBSYSTEM: src/transit3d.js — Railway meshes
      /**
       * Railway meshes
       * Source: src/transit3d.js
       * Scope: createCityRenderer() closure.
       * Viaduct decks with ballast, rails and ties, tapered piers with cross-heads,
       * catenary masts, detailed stations (platforms, canopies, departure boards,
       * benches, kiosks, passengers, stair towers) and articulated trains with lit
       * windows and headlights at night.
       *
       * DESIGN NOTES
       * Geometry follows transit.js exactly: railDecks() gives straight deck
       * segments, railPiers the support positions, RAIL_STATIONS the stops. The
       * train rides at elevation 62 (RAIL_DECK_TOP + 2). Repeated pieces (ties,
       * mast posts, parapet posts, pier shafts) are InstancedMesh pools; station
       * groups and deck groups are pushed to `statics` for distance culling and
       * to `batchGroups` so their small meshes are merged after construction.
       */
      const railConcrete = mat('#8b948f', 0.9),
        railSteel = mat('#5f7079', 0.45, 0.65),
        railTrack = mat('#c4ced0', 0.25, 0.8),
        railWood = mat('#5c5346'),
        railParapet = mat('#a3aba6', 0.85),
        railGlassCanopy = new Three.MeshStandardMaterial({
          color: '#9fc7d6',
          roughness: 0.15,
          metalness: 0.4,
          transparent: true,
          opacity: 0.55,
        }),
        railPaint = mat('#c6533f', 0.5, 0.3),
        railModels = new Map(),
        railFades = [],
        railLampHalos = [];
      const ballastTexture = canvasTexture(128, (g, s) => {
        g.fillStyle = '#6d6a66';
        g.fillRect(0, 0, s, s);
        speckle(g, s, 900, ['#8b877f', '#57544f', '#a09b92', '#4a4744'], 0.7, 1.9);
      });
      ballastTexture.repeat.set(4, 1);
      const ballastMat = new Three.MeshStandardMaterial({ map: ballastTexture, roughness: 0.95 });
      const railPools = {
        tie: instanced(boxGeo, railWood, 6000),
        parapetPost: instanced(boxGeo, railSteel, 4000),
        mast: instanced(boxGeo, railSteel, 900),
        mastArm: instanced(boxGeo, railSteel, 900),
        pierShaft: instanced(boxGeo, railConcrete, 1200),
        pierCap: instanced(boxGeo, railConcrete, 1200),
        lamp: instanced(boxGeo, warmLamp, 900),
      };
      // ---- Viaduct decks -------------------------------------------------------
      for (const b of railDecks()) {
        const group = new Three.Group();
        group.name = 'Elevated railway';
        group.position.set(b.x, 0, b.y);
        group.rotation.y = -b.a;
        scene.add(group);
        batchGroups.push(group);
        const length = b.hx * 2,
          deckMaterial = railConcrete.clone();
        deckMaterial.transparent = true;
        const deck = box(group, 0, 55, 0, length, 6, 46, deckMaterial);
        deck.userData.dynamic = true;
        // Ballast bed, two rails, parapets and drainage channel.
        const ballast = new Three.Mesh(new Three.BoxGeometry(1, 1, 1), ballastMat);
        ballast.position.set(0, 58.6, 0);
        ballast.scale.set(length, 1.4, 30);
        ballast.receiveShadow = true;
        group.add(ballast);
        for (const side of [-1, 1]) {
          box(group, 0, 61.4, side * 10, length, 1.6, 1.3, railTrack);
          box(group, 0, 60.6, side * 10, length, 0.3, 2.6, railSteel);
          box(group, 0, 60.5, side * 21.5, length, 5, 2, railParapet);
          box(group, 0, 63.4, side * 21.5, length, 0.8, 2.6, railSteel);
        }
        const cos = Math.cos(b.a),
          sin = Math.sin(b.a);
        const tieCount = Math.max(0, Math.ceil((length - 8) / 14));
        for (let i = 0; i < tieCount; i++) {
          const along = -b.hx + 6 + i * 14;
          place(railPools.tie, b.x + cos * along, 59.9, b.y + sin * along, 3.2, 0.9, 27, -b.a);
        }
        for (let along = -b.hx + 24; along < b.hx - 10; along += 48)
          for (const side of [-1, 1])
            place(
              railPools.parapetPost,
              b.x + cos * along - sin * side * 21.5,
              63.5,
              b.y + sin * along + cos * side * 21.5,
              1.4,
              4,
              1.4,
              -b.a,
            );
        // Catenary masts with a lamp every 96 units along the outer edge.
        for (let along = -b.hx + 48; along < b.hx - 20; along += 96) {
          const mx = b.x + cos * along - sin * 24,
            mz = b.y + sin * along + cos * 24;
          place(railPools.mast, mx, 74, mz, 1.6, 26, 1.6, -b.a);
          place(railPools.mastArm, b.x + cos * along - sin * 14, 85, b.y + sin * along + cos * 14, 1.2, 1.2, 22, -b.a);
          place(railPools.lamp, mx + sin * 2, 70, mz - cos * 2, 3, 1.5, 3, -b.a);
          railLampHalos.push({ sprite: halo(group, along, 70, 24, 16, '#ffe1b3'), x: mx, y: mz });
        }
        // Expansion joint plates at both ends.
        for (const end of [-1, 1]) box(group, end * (b.hx - 1.5), 58.4, 0, 3, 0.6, 46, railSteel);
        railFades.push({ b, material: deckMaterial });
        statics.push({ x: b.x, y: b.y, group, radius: b.hx + 120 });
      }
      // ---- Piers -----------------------------------------------------------------
      for (const p of railPiers) {
        const px = p.x + 3,
          pz = p.y + 3,
          dx = p.cx - px,
          dz = p.cy - pz,
          yaw = Math.atan2(dx, dz);
        place(railPools.pierShaft, px, 24, pz, 7.5, 48, 7.5, yaw);
        place(railPools.pierShaft, px, 3, pz, 11, 6, 11, yaw);
        // Cross-head reaching under the deck centre line.
        const reach = Math.hypot(dx, dz);
        place(railPools.pierCap, (px + p.cx) / 2, 51, (pz + p.cy) / 2, 8, 5, Math.max(8, reach + 8), yaw);
        place(railPools.pierCap, px, 49, pz, 12, 3, 12, yaw);
      }
      for (const im of Object.values(railPools)) im.instanceMatrix.needsUpdate = true;
      // ---- Stations -------------------------------------------------------------
      const departureBoards = [];
      function departureBoard(parent, x, y, z, yaw, stationName) {
        const cv = document.createElement('canvas');
        cv.width = 512;
        cv.height = 128;
        const g = cv.getContext('2d');
        g.fillStyle = '#0d1418';
        g.fillRect(0, 0, 512, 128);
        g.fillStyle = '#f2b94a';
        g.font = '700 34px monospace';
        g.textBaseline = 'middle';
        g.fillText(stationName, 18, 32);
        g.fillStyle = '#9fe8b8';
        g.font = '600 26px monospace';
        g.fillText('NEXT TRAIN   2 MIN', 18, 72);
        g.fillText('ALL STOPS    7 MIN', 18, 104);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        const board = new Three.Mesh(
          new Three.PlaneGeometry(30, 7.5),
          new Three.MeshBasicMaterial({ map: tx, toneMapped: false, side: Three.DoubleSide }),
        );
        board.position.set(x, y, z);
        board.rotation.y = yaw;
        board.userData.sign = true;
        parent.add(board);
        box(parent, x, y, z, 31, 8.5, 1, darkMetal).rotation.y = yaw;
        departureBoards.push(board);
        return board;
      }
      const passengerMats = ['#c96b5a', '#5d7fa6', '#d9b56a', '#7a9b6a', '#8a6b9a', '#e0d8c5'].map((c) => mat(c, 0.85));
      function passenger(parent, x, z, yaw, seated, i) {
        const g = new Three.Group();
        g.position.set(x, seated ? 58.5 : 60.5, z);
        g.rotation.y = yaw;
        parent.add(g);
        const cloth = passengerMats[i % passengerMats.length];
        box(g, 0, seated ? 6.5 : 9.5, 0, 4.2, seated ? 5 : 6.5, 5.5, cloth);
        mesh(sphereGeo, mat(['#d6af88', '#b88964', '#875e43'][i % 3]), g, 0, seated ? 11.5 : 14.5, 0, 2, 2.4, 2);
        if (seated) {
          box(g, 2.6, 3.2, 0, 4, 1.8, 5, mat('#343b44'));
        } else {
          box(g, 0, 3, 1.3, 2, 6, 2.2, mat('#343b44'));
          box(g, 0, 3, -1.3, 2, 6, 2.2, mat('#343b44'));
        }
      }
      for (const [si, s] of RAIL_STATIONS.entries()) {
        const group = new Three.Group();
        group.name = s.name + ' station';
        scene.add(group);
        batchGroups.push(group);
        const a = railStationAngle(s),
          platform = new Three.Group();
        platform.position.set(s.x, 0, s.y);
        platform.rotation.y = -a;
        group.add(platform);
        const lift = railLift(s),
          access = railAccessEnd(s),
          accessSide = Math.sign(-(access.x - s.x) * Math.sin(a) + (access.y - s.y) * Math.cos(a)) || 1;
        for (const side of [-1, 1]) {
          // Platform slab, tactile edge strip, yellow line, canopy with glass roof.
          box(platform, 0, 56.5, side * 33, 168, 5, 20, railConcrete);
          box(platform, 0, 59.2, side * 24.5, 162, 0.5, 2.2, mat('#d8b64a', 0.8));
          box(platform, 0, 59.15, side * 27.5, 162, 0.4, 3, mat('#9a9f9a', 0.95));
          for (const x of [-70, -35, 0, 35, 70]) {
            box(platform, x, 74, side * 40, 1.8, 30, 1.8, railSteel);
            box(platform, x, 88.5, side * 33, 1.4, 1.4, 24, railSteel);
          }
          box(platform, 0, 89.5, side * 33, 176, 0.6, 26, railGlassCanopy).userData.dynamic = true;
          box(platform, 0, 89, side * 33, 178, 0.8, 1.2, railSteel);
          box(platform, 0, 89, side * 45.5, 178, 0.8, 1.2, railSteel);
          // Under-canopy lights.
          for (const x of [-60, -20, 20, 60]) {
            box(platform, x, 87.5, side * 33, 6, 0.8, 1.6, warmLamp);
            railLampHalos.push({ sprite: halo(platform, x, 86, side * 33, 20, '#ffe9c4'), x: s.x, y: s.y });
          }
          // Benches, bins and a route-map board.
          for (const x of [-52, 0, 52]) {
            box(platform, x, 61.5, side * 41, 16, 1, 4.5, railWood);
            box(platform, x, 64, side * 43, 16, 4, 0.8, railWood);
            for (const dx of [-6.5, 6.5]) box(platform, x + dx, 60.2, side * 41, 1, 2.4, 4, darkMetal);
          }
          mesh(cylinderGeo, mat('#3f5a4a', 0.7, 0.3), platform, 76, 62, side * 41, 2.4, 5.5, 2.4);
          box(platform, -76, 66, side * 43, 10, 9, 0.8, mat('#e8e2d2', 0.8));
          box(platform, -76, 66, side * 43.5, 8.5, 7, 0.3, mat(['#e2b766', '#67c6bd', '#b3a1d8'][si % 3], 0.6));
          // Station name signs hanging from the canopy at both ends.
          for (const x of [-60, 60]) {
            const nameSign = sign(s.name, 0, 0, 44, '#e9f1ea');
            nameSign.position.set(x, 80, side * 33);
            nameSign.rotation.y = 0;
            nameSign.userData.backing.position.set(x, 80, side * 33 - 1.5);
            group.remove(nameSign);
            group.remove(nameSign.userData.backing);
            platform.add(nameSign);
            platform.add(nameSign.userData.backing);
          }
          // Departure board facing along the platform.
          departureBoard(platform, 30 * -side, 78, side * 33, side > 0 ? 0 : Math.PI, s.name);
          // Waiting passengers.
          for (let k = 0; k < 4; k++) {
            const seatedHere = k % 2 === 0,
              x = seatedHere ? -52 + k * 26 : -30 + k * 24 + (si % 3) * 6;
            passenger(platform, x, side * (seatedHere ? 41 : 30), seatedHere ? (side > 0 ? Math.PI : 0) : (k % 2 ? 0.4 : -0.6), seatedHere, si * 4 + k + (side > 0 ? 2 : 0));
          }
        }
        // Clocks on the central canopy posts.
        for (const x of [-35, 35]) {
          mesh(new Three.CylinderGeometry(3.2, 3.2, 0.8, 20), mat('#f4f1e8'), platform, x, 82, 0).rotation.z = Math.PI / 2;
          box(platform, x + 0.5, 82, 0, 0.2, 2.2, 0.4, darkMetal);
          box(platform, x + 0.5, 82.6, 0.8, 0.2, 0.4, 1.6, darkMetal);
        }
        // Street-level access: stair and lift tower, footbridge to the platform, turnstiles.
        const ex = lift.x,
          ez = lift.y,
          towerMat = mat('#a6bab6', 0.4, 0.35);
        box(group, ex, 30, ez, 18, 60, 18, towerMat);
        for (let y = 8; y < 56; y += 12) box(group, ex, y, ez + 9.2, 12, 6, 0.5, glass);
        box(group, ex, 61, ez, 22, 2, 22, railConcrete);
        box(group, ex, 62.5, ez, 8, 1.4, 8, railSteel);
        box(group, ex + 12, 6, ez, 6, 12, 8, mat('#2d3b44', 0.6, 0.3));
        for (let step = 0; step < 6; step++) box(group, ex + 10, 1 + step * 2, ez - 6 - step * 2.2, 8, 2, 2.2, railConcrete);
        const entranceSign = sign('M · ' + s.name, ex, ez - 13, 105, '#b7e5d5');
        entranceSign.position.y = entranceSign.userData.backing.position.y = 24;
        railLampHalos.push({ sprite: halo(group, ex, 26, ez - 12, 34, '#9be3d0'), x: ex, y: ez });
        // Turnstile pair at the base of the tower.
        for (const dx of [-7, 7]) {
          box(group, ex + dx, 5, ez - 14, 1.5, 10, 4, railSteel);
          box(group, ex + dx, 6.5, ez - 12.5, 5, 0.4, 0.4, chrome);
        }
        const dx = access.x - ex,
          dz = access.y - ez,
          len = Math.hypot(dx, dz),
          bridge = new Three.Group();
        bridge.position.set((ex + access.x) / 2, 0, (ez + access.y) / 2);
        bridge.rotation.y = -Math.atan2(dz, dx);
        group.add(bridge);
        box(bridge, 0, 58.8, 0, len, 4, 14, railConcrete);
        for (const z of [-7, 7]) {
          box(bridge, 0, 62.5, z, len, 0.8, 0.8, railSteel);
          for (let x = -len / 2 + 6; x < len / 2; x += 12) box(bridge, x, 61.5, z, 0.8, 5, 0.8, railSteel);
        }
        box(bridge, 0, 66, 0, len, 0.6, 16, railGlassCanopy).userData.dynamic = true;
        // Kiosk on the access-side platform end.
        box(platform, 88 * -accessSide, 63.5, accessSide * 33, 10, 9, 8, mat('#b7413a', 0.7));
        box(platform, 88 * -accessSide, 68.5, accessSide * 33, 12, 1, 10, mat('#efe6d3', 0.9));
        statics.push({ x: s.x, y: s.y, group, radius: 240 });
      }
      // ---- Trains ----------------------------------------------------------------
      function makeRailTrain(t) {
        const group = new Three.Group();
        scene.add(group);
        const bodyMat = mat('#dfe3e1', 0.35, 0.5),
          stripe = mat(t.color, 0.4, 0.4),
          dark = mat('#1f2f3a', 0.24, 0.6),
          windowMat = new Three.MeshStandardMaterial({
            color: '#243a48',
            roughness: 0.15,
            metalness: 0.6,
            emissive: '#ffe2b0',
            emissiveIntensity: 0,
          }),
          cars = [];
        for (let j = 0; j < 3; j++) {
          const car = new Three.Group();
          car.position.x = -j * 58;
          group.add(car);
          cars.push(car);
          box(car, 0, 9.5, 0, 54, 13, 22, bodyMat);
          box(car, 0, 4.2, 0, 54, 2.6, 21, dark);
          box(car, 0, 16.8, 0, 50, 1.6, 20, mat('#aeb5b3', 0.5, 0.4));
          box(car, 0, 7.4, 0, 54.2, 2.2, 22.4, stripe);
          for (const z of [-11.3, 11.3]) {
            box(car, 0, 11.5, z, 46, 5.5, 0.6, windowMat);
            for (const x of [-20, 20]) box(car, x, 9, z, 7, 11, 0.8, dark);
            for (const x of [-12, 0, 12]) box(car, x, 11.5, z + 0.1, 0.8, 6, 0.9, bodyMat);
          }
          // Roof equipment and bogies.
          box(car, -8, 18.2, 0, 14, 1.6, 9, mat('#7e8a8c', 0.5, 0.5));
          box(car, 14, 18, 0, 6, 1.2, 6, mat('#7e8a8c', 0.5, 0.5));
          for (const x of [-17, 17]) {
            box(car, x, 2.6, 0, 12, 2.4, 16, dark);
            for (const z of [-8.5, 8.5]) {
              const w = mesh(wheelGeo, rubber, car, x - 4, 2.4, z, 2.6, 2, 2.6);
              w.rotation.x = Math.PI / 2;
              const w2 = mesh(wheelGeo, rubber, car, x + 4, 2.4, z, 2.6, 2, 2.6);
              w2.rotation.x = Math.PI / 2;
            }
          }
          if (j === 0) {
            // Streamlined cab: sloped nose, windscreen, headlights and destination display.
            const nose = box(car, 29, 9.5, 0, 6, 12, 21, bodyMat);
            nose.rotation.z = -0.35;
            box(car, 30, 11.5, 0, 1.2, 6, 17, dark);
            box(car, 31.5, 14, 0, 0.6, 2.2, 14, new Three.MeshBasicMaterial({ color: '#fff0c8', toneMapped: false }));
            for (const z of [-7, 7]) {
              box(car, 31.8, 6.5, z, 0.6, 2, 3, warmLamp);
              group.userData.headlights = group.userData.headlights || [];
              group.userData.headlights.push(halo(car, 33, 6.5, z, 14, '#fff1cc'));
            }
          }
          if (j === 2)
            for (const z of [-7, 7]) box(car, -27.6, 6.5, z, 0.6, 1.6, 2.4, tailLamp);
        }
        group.userData.windowMat = windowMat;
        return group;
      }
      const railNoStop = new Three.Vector3();
      function updateTransitVisuals() {
        const night = nightAmount;
        for (const t of railTrains) {
          let m = railModels.get(t);
          if (!m) {
            m = makeRailTrain(t);
            railModels.set(t, m);
          }
          m.position.set(0, 62, 0);
          m.rotation.y = 0;
          for (let i = 0; i < m.children.length; i++) {
            const car = m.children[i],
              p = railCarPosition(t, i * 58);
            car.position.set(p.x, 0, p.y);
            car.rotation.y = -p.a;
          }
          m.visible = Math.hypot(t.x - cameraTarget.x, t.y - cameraTarget.y) < 7000 / worldZoom;
          m.userData.windowMat.emissiveIntensity = 0.9 * night;
          for (const h of m.userData.headlights || []) h.material.opacity = 0.15 + 0.85 * night;
        }
        for (const [t, m] of railModels)
          if (!railTrains.includes(t)) {
            scene.remove(m);
            collectResources(m, retiredGeometries, retiredMaterials);
            railModels.delete(t);
          }
        for (let i = 0; i < railFades.length; i++) {
          const { b, material } = railFades[i],
            q = coverLocal(b, player.x, player.y),
            under =
              !transitRide && entityElevation(player) < 50 && Math.abs(q.x) < b.hx && Math.abs(q.y) < 45;
          material.opacity = under ? 0.22 : 1;
          material.depthWrite = !under;
        }
        const glow = 0.08 + 0.92 * night;
        for (let i = 0; i < railLampHalos.length; i++) railLampHalos[i].sprite.material.opacity = glow;
      }
      // END SUBSYSTEM: src/transit3d.js
