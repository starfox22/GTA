      // BEGIN SUBSYSTEM: src/transit3d.js — Railway meshes
      /**
       * Railway meshes
       * Source: src/transit3d.js
       * Scope: createCityRenderer() closure.
       * Decks, instanced ties, piers, station platforms, canopies and moving trains.
       */
      // Continuous rail infrastructure: structural deck, ties, rails, columns and accessible stations.
      const railConcrete = mat('#7e8b87', 0.9),
        railSteel = mat('#65818a', 0.48, 0.6),
        railTrack = mat('#b6c4c3', 0.28, 0.72),
        railWood = mat('#666556'),
        railModels = new Map(),
        railFades = [];
      for (const b of railDecks()) {
        const group = new Three.Group();
        group.name = 'Elevated railway';
        group.position.set(b.x, 0, b.y);
        group.rotation.y = -b.a;
        scene.add(group);
        const deckMaterial = railConcrete.clone();
        deckMaterial.transparent = true;
        box(group, 0, 56, 0, b.hx * 2, 8, 46, deckMaterial);
        for (const side of [-1, 1]) {
          box(group, 0, 63, side * 22, b.hx * 2, 5, 1.2, railSteel);
          box(group, 0, 61.5, side * 10, b.hx * 2, 2, 1.4, railTrack);
        }
        const tieCount = Math.max(0, Math.ceil((b.hx * 2 - 8) / 30)),
          ties = new Three.InstancedMesh(boxGeo, railWood, tieCount),
          tieTransform = new Three.Object3D();
        for (let i = 0; i < tieCount; i++) {
          tieTransform.position.set(-b.hx + 8 + i * 30, 60.4, 0);
          tieTransform.scale.set(3, 0.8, 28);
          tieTransform.updateMatrix();
          ties.setMatrixAt(i, tieTransform.matrix);
        }
        ties.receiveShadow = true;
        group.add(ties);
        railFades.push({
          b,
          material: deckMaterial,
        });
        statics.push({
          x: b.x,
          y: b.y,
          group,
          radius: b.hx + 100,
        });
      }
      const pierGroup = new Three.Group();
      scene.add(pierGroup);
      const pierMesh = new Three.InstancedMesh(boxGeo, railConcrete, railPiers.length),
        dummy = new Three.Object3D();
      railPiers.forEach((p, i) => {
        dummy.position.set(p.x + 3, 26, p.y + 3);
        dummy.scale.set(6, 52, 6);
        dummy.updateMatrix();
        pierMesh.setMatrixAt(i, dummy.matrix);
      });
      pierMesh.receiveShadow = pierMesh.castShadow = true;
      pierGroup.add(pierMesh);
      for (const p of railPiers)
        rod(
          pierGroup,
          new Three.Vector3(p.x + 3, 50, p.y + 3),
          new Three.Vector3(p.cx, 53, p.cy),
          2.3,
          railSteel,
        );
      for (const s of RAIL_STATIONS) {
        const group = new Three.Group();
        group.name = s.name + ' station';
        scene.add(group);
        const a = railStationAngle(s);
        const platform = new Three.Group();
        platform.position.set(s.x, 0, s.y);
        platform.rotation.y = -a;
        group.add(platform);
        for (const side of [-1, 1]) {
          box(platform, 0, 57, side * 33, 165, 6, 19, railConcrete);
          box(platform, 0, 60.4, side * 25, 158, 0.5, 2, warmLamp);
          for (const x of [-65, 65]) box(platform, x, 74, side * 39, 2, 28, 2, railSteel);
          box(platform, 0, 88, side * 33, 174, 3, 24, railSteel);
        }
        const lift = railLift(s),
          ex = lift.x,
          ez = lift.y;
        box(group, ex, 30, ez, 17, 60, 17, mat('#a4b8b5', 0.4, 0.35));
        box(group, ex, 31, ez + 8.7, 11, 49, 0.6, glass);
        box(group, ex, 61, ez, 21, 2, 21, railConcrete);
        const access = railAccessEnd(s),
          dx = access.x - ex,
          dz = access.y - ez,
          len = Math.hypot(dx, dz),
          bridge = new Three.Group();
        bridge.position.set((ex + access.x) / 2, 0, (ez + access.y) / 2);
        bridge.rotation.y = -Math.atan2(dz, dx);
        group.add(bridge);
        box(bridge, 0, 58.8, 0, len, 4, 14, railConcrete);
        for (const z of [-7, 7]) box(bridge, 0, 64, z, len, 8, 0.7, railSteel);
        const name = sign('M · ' + s.name, ex, ez - 13, 105, '#b7e5d5');
        name.position.y = name.userData.backing.position.y = 24;
        statics.push({
          x: s.x,
          y: s.y,
          group,
          radius: 220,
        });
      }
      function makeRailTrain(t) {
        const group = new Three.Group();
        scene.add(group);
        const bodyMat = mat(t.color, 0.4, 0.45),
          dark = mat('#263c48', 0.24, 0.6);
        for (let j = 0; j < 3; j++) {
          const car = new Three.Group();
          car.position.x = -j * 58;
          group.add(car);
          box(car, 0, 9, 0, 53, 14, 23, bodyMat);
          box(car, 0, 16.5, 0, 50, 1.8, 24, railConcrete);
          for (const z of [-11.8, 11.8]) {
            box(car, 0, 11, z, 46, 6, 0.7, dark);
            for (const x of [-17, 0, 17]) box(car, x, 10, z, 1, 9, 1, railConcrete);
          }
          for (const x of [-17, 17])
            for (const z of [-8, 8]) {
              const w = mesh(wheelGeo, rubber, car, x, 2, z, 2.7, 2, 2.7);
              w.rotation.x = Math.PI / 2;
            }
          if (j === 0) box(car, 27, 11, 0, 0.5, 7, 17, dark);
        }
        return group;
      }
      function updateTransitVisuals() {
        for (const t of railTrains) {
          let m = railModels.get(t);
          if (!m) {
            m = makeRailTrain(t);
            railModels.set(t, m);
          }
          m.position.set(0, 62, 0);
          m.rotation.y = 0;
          m.children.forEach((car, i) => {
            const p = railCarPosition(t, i * 58);
            car.position.set(p.x, 0, p.y);
            car.rotation.y = -p.a;
          });
          m.visible = Math.hypot(t.x - cameraTarget.x, t.y - cameraTarget.y) < 7000 / worldZoom;
        }
        for (const [t, m] of railModels)
          if (!railTrains.includes(t)) {
            scene.remove(m);
            collectResources(m, retiredGeometries, retiredMaterials);
            railModels.delete(t);
          }
        for (const { b, material } of railFades) {
          const q = coverLocal(b, player.x, player.y),
            under =
              !transitRide && entityElevation(player) < 50 && Math.abs(q.x) < b.hx && Math.abs(q.y) < 45;
          material.opacity = under ? 0.22 : 1;
          material.depthWrite = !under;
        }
      }
      // END SUBSYSTEM: src/transit3d.js
