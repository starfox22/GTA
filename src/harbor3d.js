      // BEGIN SUBSYSTEM: src/harbor3d.js — Cargo terminal meshes
      /**
       * Cargo terminal meshes
       * Source: src/harbor3d.js
       * Scope: createCityRenderer() closure.
       * Cranes, ship, containers, cargo and terminal architecture.
       */
      // Working Ironworks terminal: textured cargo, gantry cranes and a moored freighter.
      const harborImage = visualAssets.harbor || visualAssets.ground;
      const portWood = new Three.MeshStandardMaterial({
        map: texture(harborImage, 0),
        color: '#dcc398',
        roughness: 0.88,
      });
      const portSteel = new Three.MeshStandardMaterial({
        map: texture(harborImage, 1, 3, 1),
        color: '#829aa2',
        roughness: 0.7,
        metalness: 0.38,
      });
      const cranePaint = new Three.MeshStandardMaterial({
        map: texture(harborImage, 2, 2, 2),
        color: '#e0bd69',
        roughness: 0.65,
        metalness: 0.48,
      });
      const portConcrete = new Three.MeshStandardMaterial({
        map: texture(harborImage, 3, 5, 5),
        color: '#b5b5a8',
        roughness: 0.94,
      });
      function makeCargoCrate(parent, size = 28, number = 0) {
        const group = new Three.Group();
        parent.add(group);
        box(group, 0, 2, 0, size + 4, 3, size + 4, wood);
        for (const z of [-size * 0.35, 0, size * 0.35])
          box(group, 0, 0.8, z, size + 5, 1.5, 2.5, darkMetal);
        box(group, 0, size * 0.5 + 3, 0, size, size, size, portWood);
        for (const side of [-1, 1]) {
          box(group, side * size * 0.28, size * 0.5 + 3, 0, 2, size + 1, size + 1, cranePaint);
          box(group, 0, size + 3.6, side * size * 0.35, size + 1, 1.2, 2, wood);
        }
        if (number) {
          const cv = document.createElement('canvas');
          cv.width = cv.height = 128;
          const cg = cv.getContext('2d');
          cg.fillStyle = '#e9d7a5';
          cg.fillRect(0, 0, 128, 128);
          cg.fillStyle = '#322c24';
          cg.font = 'bold 78px monospace';
          cg.textAlign = 'center';
          cg.fillText(String(number), 64, 90);
          const tx = new Three.CanvasTexture(cv);
          tx.colorSpace = Three.SRGBColorSpace;
          const label = new Three.Mesh(
            new Three.PlaneGeometry(size * 0.48, size * 0.48),
            new Three.MeshBasicMaterial({
              map: tx,
            }),
          );
          label.position.set(0, size * 0.62 + 3, size * 0.5 + 0.2);
          group.add(label);
        }
        return group;
      }
      // Static terminal scenery, merged by the static batcher once built; the gate
      // arm and the crane trolleys (which move) are flagged dynamic below.
      const harborGroup = new Three.Group();
      harborGroup.name = 'harbor terminal';
      scene.add(harborGroup);
      batchGroups.push(harborGroup);
      statics.push({
        x: 3100,
        y: 1500,
        group: harborGroup,
        radius: 650,
      });
      // Concrete caisson, rubber fenders, bollards, ladders and mooring ropes.
      box(harborGroup, 3412, -7, 1505, 16, 14, 550, portConcrete);
      for (let z = 1248; z < 1780; z += 46) {
        const fender = mesh(wheelGeo, rubber, harborGroup, 3423, -4, z, 7, 5, 7);
        fender.rotation.z = Math.PI / 2;
        box(harborGroup, 3403, 3, z, 6, 5, 7, darkMetal);
        if (z % 3 < 1) {
          for (let h = -6; h < 8; h += 3) box(harborGroup, 3421, h, z, 1, 1, 8, chrome);
          for (const side of [-1, 1]) box(harborGroup, 3421, 1, z + side * 5, 1, 19, 1, chrome);
        }
      }
      const fenceCanvas = document.createElement('canvas');
      fenceCanvas.width = fenceCanvas.height = 32;
      const fc = fenceCanvas.getContext('2d');
      fc.strokeStyle = '#a5ada7';
      fc.lineWidth = 1.5;
      fc.beginPath();
      fc.moveTo(0, 16);
      fc.lineTo(16, 0);
      fc.lineTo(32, 16);
      fc.lineTo(16, 32);
      fc.closePath();
      fc.stroke();
      for (const b of harborWalls) {
        box(harborGroup, b.x + b.w / 2, 2, b.y + b.h / 2, b.w, 4, b.h, concrete);
        const long = b.w > b.h,
          n = Math.floor(Math.max(b.w, b.h) / 18);
        const ft = new Three.CanvasTexture(fenceCanvas);
        ft.wrapS = ft.wrapT = Three.RepeatWrapping;
        ft.repeat.set(Math.max(b.w, b.h) / 6, 2);
        const fence = new Three.Mesh(
          new Three.PlaneGeometry(Math.max(b.w, b.h), 12),
          new Three.MeshStandardMaterial({
            map: ft,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            side: Three.DoubleSide,
            roughness: 0.72,
            metalness: 0.5,
          }),
        );
        fence.position.set(b.x + b.w / 2, 10, b.y + b.h / 2);
        if (!long) fence.rotation.y = Math.PI / 2;
        harborGroup.add(fence);
        for (let i = 0; i <= n; i++) {
          const x = b.x + (long ? (b.w * i) / n : b.w / 2),
            z = b.y + (long ? b.h / 2 : (b.h * i) / n);
          box(harborGroup, x, 10, z, 1, 16, 1, darkMetal);
        }
        box(
          harborGroup,
          b.x + b.w / 2,
          16,
          b.y + b.h / 2,
          Math.max(1, b.w),
          0.7,
          Math.max(1, b.h),
          chrome,
        );
      }
      for (const c of HARBOR.containers) {
        for (let level = 0; level < (c.y < 1400 ? 2 : 1); level++) {
          box(harborGroup, c.x + c.w / 2, 12 + level * 24, c.y + c.h / 2, c.w, 23, c.h, portSteel);
          for (const side of [-1, 1]) {
            box(
              harborGroup,
              c.x + c.w / 2,
              23 + level * 24,
              c.y + c.h / 2 + side * c.h * 0.48,
              c.w,
              1.3,
              1.5,
              chrome,
            );
            for (const end of [-1, 1])
              box(
                harborGroup,
                c.x + c.w / 2 + end * c.w * 0.48,
                12 + level * 24,
                c.y + c.h / 2 + side * c.h * 0.48,
                1.4,
                23,
                1.4,
                darkMetal,
              );
          }
        }
      }
      for (const b of HARBOR.warehouses) {
        const z = b.y + b.h;
        for (let x = b.x + 36; x < b.x + b.w - 15; x += 65) {
          box(harborGroup, x, 14, z + 1, 45, 27, 2, darkMetal);
          box(harborGroup, x, 15, z + 2, 40, 24, 1, portSteel);
          for (let h = 5; h < 27; h += 4) box(harborGroup, x, h, z + 2.7, 39, 0.5, 0.6, chrome);
          box(harborGroup, x, 2, z + 8, 52, 3, 13, portConcrete);
          box(harborGroup, x, 29, z + 6, 54, 1.5, 13, darkMetal);
          halo(harborGroup, x, 29, z + 7, 18, '#ffd7a0');
        }
        for (let x = b.x + 12; x < b.x + b.w; x += 18)
          box(harborGroup, x, b.height + 2, b.y + b.h / 2, 1.5, 2, b.h, chrome);
      }
      // On the facade above the loading-door canopy (y 29). At the default height
      // and 210 wide it hung from below ground level to 49, with the canopy and its
      // lamps running straight across the lettering.
      const cargoSign = sign('IRONWORKS CARGO', 2940, 1436, 150, '#e6c581');
      cargoSign.position.y = cargoSign.userData.backing.position.y = 50;
      sign('RESTRICTED · KEEP CLEAR', 2805, 1578, 119, '#e0b360');
      const gateRoot = new Three.Group();
      gateRoot.userData.dynamic = true;
      gateRoot.position.set(HARBOR.gate.x, 10, HARBOR.gate.y - 68);
      harborGroup.add(gateRoot);
      box(harborGroup, HARBOR.gate.x, 7, HARBOR.gate.y - 72, 11, 14, 11, cranePaint);
      box(gateRoot, 0, 0, 68, 3, 3, 136, mat('#d5d4bc'));
      for (let z = 8; z < 136; z += 16) box(gateRoot, 0.05, 0.1, z, 3.3, 3.3, 8, mat('#a94e39'));
      const gateLamp = box(
        harborGroup,
        HARBOR.gate.x,
        16,
        HARBOR.gate.y - 72,
        5,
        3,
        5,
        new Three.MeshBasicMaterial({
          color: '#dc483d',
        }),
      );
      const berthGroup = new Three.Group();
      berthGroup.position.set(HARBOR.ship.x, 0, HARBOR.ship.y);
      scene.add(berthGroup);
      statics.push({
        x: HARBOR.ship.x,
        y: HARBOR.ship.y,
        group: berthGroup,
        radius: 420,
      });
      // The freighter is built bow-forward in its own frame and turned to lie
      // north-south along the quay, port side to the cranes.
      const cargoShip = buildCargoShip();
      cargoShip.rotation.y = Math.PI / 2;
      berthGroup.add(cargoShip);
      kitMerge(cargoShip);
      for (const y of [1290, 1615])
        rod(harborGroup, new Three.Vector3(3402, 5, y), new Three.Vector3(3468, 31, y + 25), 0.85, wood);
      const craneMovers = [];
      for (const [index, z] of [1320, 1675].entries()) {
        const cg = new Three.Group();
        harborGroup.add(cg);
        for (const x of [3322, 3390])
          for (const dz of [-23, 23]) {
            box(cg, x, 2, z + dz, 14, 4, 14, darkMetal);
            box(cg, x, 47, z + dz, 5, 94, 5, cranePaint);
          }
        for (const dz of [-23, 23]) {
          box(cg, 3396, 95, z + dz, 282, 6, 5, cranePaint);
          rod(
            cg,
            new Three.Vector3(3322, 24, z + dz),
            new Three.Vector3(3390, 89, z + dz),
            1.4,
            cranePaint,
          );
          rod(
            cg,
            new Three.Vector3(3390, 24, z + dz),
            new Three.Vector3(3322, 89, z + dz),
            1.4,
            cranePaint,
          );
          for (let x = 3260; x < 3530; x += 28) {
            rod(
              cg,
              new Three.Vector3(x, 95, z + dz),
              new Three.Vector3(x + 28, 108, z + dz),
              1.2,
              cranePaint,
            );
            rod(
              cg,
              new Three.Vector3(x, 108, z + dz),
              new Three.Vector3(x + 28, 95, z + dz),
              1.2,
              cranePaint,
            );
          }
          box(cg, 3396, 108, z + dz, 282, 2, 2, cranePaint);
        }
        box(cg, 3335, 101, z, 34, 21, 29, cranePaint);
        box(cg, 3335, 104, z + 15, 28, 12, 0.6, glass);
        box(cg, 3387, 68, z - 26, 2, 65, 1, chrome);
        for (let h = 39; h < 98; h += 5) box(cg, 3387, h, z - 27, 9, 1, 1, chrome);
        const trolley = new Three.Group();
        trolley.userData.dynamic = true;
        cg.add(trolley);
        box(trolley, 0, 104, 0, 18, 8, 55, darkMetal);
        const load = new Three.Group();
        trolley.add(load);
        box(load, 0, 0, 0, 36, 23, 48, portSteel);
        const cables = [];
        for (const side of [-1, 1])
          cables.push(box(trolley, side * 13, 65, side * 16, 0.7, 60, 0.7, darkMetal));
        craneMovers.push({
          trolley,
          load,
          cables,
          index,
          z,
        });
      }
      const harborCrates = HARBOR.crates.map((p, i) => {
        const group = makeCargoCrate(scene, 28, i + 1);
        group.position.set(p.x, 0, p.y);
        return group;
      });
      const harborBayRing = new Three.Mesh(
        new Three.PlaneGeometry(96, 124),
        new Three.MeshBasicMaterial({
          color: '#f2c66d',
          transparent: true,
          opacity: 0.09,
          depthWrite: false,
        }),
      );
      harborBayRing.rotation.x = -Math.PI / 2;
      harborBayRing.position.set(HARBOR.bay.x, 0.25, HARBOR.bay.y);
      scene.add(harborBayRing);
      function updateHarborVisuals() {
        gateRoot.rotation.x = (-harborGate * Math.PI) / 2;
        gateLamp.material.color.set(harborGate > 0.82 ? '#96cc84' : '#dd5541');
        berthGroup.position.y = Math.sin(gameTime * 0.65) * 0.3;
        for (const c of craneMovers) {
          const phase = gameTime * 0.18 + c.index * 2.8,
            px = 3400 + Math.sin(phase) * 103,
            lift = 42 + Math.sin(phase * 2) * 12;
          c.trolley.position.set(px, 0, c.z);
          c.load.position.y = lift;
          for (const line of c.cables) {
            line.position.y = (104 + lift) / 2;
            line.scale.y = (104 - lift) / 60;
          }
        }
        const m = harborCargoJob();
        for (let i = 0; i < 3; i++) {
          const g = harborCrates[i],
            p = HARBOR.crates[i];
          g.visible = !m?.packages?.[i]?.got && (!!m || missionIndex === 0);
          g.position.set(p.x, 0, p.y);
          g.scale.setScalar(1);
          if (m?.loading?.index === i) {
            const t = clamp(m.loading.time / 2.1, 0, 1),
              end = cargoPosition(m.car, i);
            g.position.set(
              p.x + (end.x - p.x) * t,
              Math.sin(t * Math.PI) * 40 + t * 9,
              p.y + (end.y - p.y) * t,
            );
            g.scale.setScalar(1 - t * 0.36);
          }
          g.rotation.y = 0.04;
        }
        harborBayRing.visible = !!m && m.stage === 2;
        harborBayRing.material.opacity = 0.09 + 0.04 * Math.sin(gameTime * 3);
      }
      /**
       * TRAFFIC SIGNALS
       * Each post stands in its own (empty) group at its base, which damage.js tips
       * over when a car knocks it down. What is drawn is two instanced meshes for
       * the whole city, re-placed each frame from the groups of the signals in
       * view: the posts (pole and head merged into one geometry) and the bulbs,
       * coloured by the signal phase. Two draw calls in all instead of ten per
       * junction.
       */
      const signalPostGeometry = (() => {
        const pole = new Three.BoxGeometry(1.1, 30, 1.1).translate(0, 15, 0),
          head = new Three.BoxGeometry(5, 12, 4).translate(0, 29, 0),
          merged = new Three.BufferGeometry();
        for (const name of ['position', 'normal', 'uv'])
          merged.setAttribute(
            name,
            new Three.BufferAttribute(
              new Float32Array([...pole.attributes[name].array, ...head.attributes[name].array]),
              pole.attributes[name].itemSize,
            ),
          );
        const offset = pole.attributes.position.count;
        merged.setIndex([...pole.index.array, ...head.index.array].map((v, i) => (i < pole.index.count ? v : v + offset)));
        merged.computeBoundingSphere();
        return merged;
      })();
      const signalModels = [];
      for (const x of ROAD_CENTERS)
        for (const z of ROAD_ROWS) {
          if (!cityIntersectionAt(x, z) || !groundAt(x, z, 92) || inHarbor(x, z, 100)) continue;
          const group = new Three.Group();
          scene.add(group);
          const heads = [];
          for (const [vertical, dx, dz] of [
            [true, 61, -65],
            [false, -65, 61],
          ]) {
            const post = new Three.Group(),
              prop = registerStreetProp('signal', x + dx, z + dz);
            post.position.set(x + dx, 0, z + dz);
            group.add(post);
            prop.group = post;
            heads.push({ vertical, post, prop });
          }
          signalModels.push({
            x,
            z,
            group,
            heads,
          });
          statics.push({
            x,
            y: z,
            group,
            radius: 105,
          });
        }
      const signalBulbs = new Three.InstancedMesh(
          sphereGeo,
          new Three.MeshBasicMaterial({ color: '#ffffff' }),
          Math.max(1, signalModels.length * 6),
        ),
        // Red, amber, green from the top of the head, in the post's own frame.
        signalBulbLocal = [0, 1, 2].map((i) =>
          new Three.Matrix4().compose(new Three.Vector3(0, 33 - i * 4, 2.5), new Three.Quaternion(), new Three.Vector3(1.5, 1.5, 0.7)),
        ),
        signalBulbMatrix = new Three.Matrix4(),
        signalBulbColor = new Three.Color();
      signalBulbs.count = 0;
      signalBulbs.frustumCulled = false;
      signalBulbs.userData.dynamic = true;
      signalBulbs.setColorAt(0, signalBulbColor);
      scene.add(signalBulbs);
      const signalPosts = new Three.InstancedMesh(signalPostGeometry, darkMetal, Math.max(1, signalModels.length * 2));
      signalPosts.count = 0;
      signalPosts.frustumCulled = false;
      signalPosts.castShadow = signalPosts.receiveShadow = true;
      signalPosts.userData.dynamic = true;
      scene.add(signalPosts);
      const signalBulbIndex = {
          red: 0,
          amber: 1,
          green: 2,
        },
        // Lit bulbs are brighter than white so they glow through the bloom.
        signalLitColors = ['#ff5141', '#ffc454', '#8cdb86'].map((c) => new Three.Color(c).multiplyScalar(2.2)),
        signalDarkColor = new Three.Color('#252d30');
      function updateTrafficVisuals() {
        let n = 0,
          posts = 0;
        for (const s of signalModels) {
          if (!s.group.visible) continue;
          const state = trafficSignal(s.x, s.z);
          for (const h of s.heads) {
            // A signal lying in the road is dark.
            const on = h.prop.down ? -1 : signalBulbIndex[state[h.vertical ? 'vertical' : 'horizontal']];
            h.post.updateWorldMatrix(true, false);
            signalPosts.setMatrixAt(posts++, h.post.matrixWorld);
            for (let i = 0; i < 3; i++) {
              signalBulbs.setMatrixAt(n, signalBulbMatrix.multiplyMatrices(h.post.matrixWorld, signalBulbLocal[i]));
              signalBulbs.setColorAt(n, i === on ? signalLitColors[i] : signalDarkColor);
              n++;
            }
          }
        }
        signalBulbs.count = n;
        signalPosts.count = posts;
        if (posts) signalPosts.instanceMatrix.needsUpdate = true;
        if (n) {
          signalBulbs.instanceMatrix.needsUpdate = true;
          signalBulbs.instanceColor.needsUpdate = true;
        }
      }
      // Vinny's drive-in depot: real open doorway, interior loading lane and cutaway roof.
      const depotGroup = new Three.Group();
      scene.add(depotGroup);
      statics.push({
        x: 4480,
        y: 4460,
        group: depotGroup,
        radius: 400,
      });
      for (const w of depotWalls) {
        box(depotGroup, w.x + w.w / 2, 32, w.y + w.h / 2, w.w, 64, w.h, portSteel);
        box(depotGroup, w.x + w.w / 2, 3, w.y + w.h / 2, w.w + 1, 6, w.h + 1, portConcrete);
      }
      // The front roller shutter travels: it comes down behind the truck on the
      // first mission's drop.
      const shutterMat = mat('#8d9195', 0.62, 0.35);
      const depotFrontDoor = box(depotGroup, 4480, 29, 4341, 116, 58, 4, shutterMat);
      depotFrontDoor.userData.dynamic = true;
      // The back door: a steel personnel door hinged on its west jamb that swings
      // out onto the pavement, with a lintel and a lit EXIT sign on both faces.
      const backDoor = VINNY_DEPOT.backDoor,
        doorWest = backDoor.x - backDoor.half,
        doorWidth = backDoor.half * 2;
      box(depotGroup, backDoor.x, 53, 4576, doorWidth, 22, 8, portSteel);
      for (const x of [doorWest - 1.5, doorWest + doorWidth + 1.5])
        box(depotGroup, x, 21, 4576, 3, 42, 10, cranePaint);
      const depotBackHinge = new Three.Group();
      depotBackHinge.position.set(doorWest, 0, 4576);
      depotBackHinge.userData.dynamic = true;
      depotGroup.add(depotBackHinge);
      box(depotBackHinge, doorWidth / 2, 20.5, 0, doorWidth - 1, 41, 3, mat('#5f6e62', 0.55, 0.4));
      box(depotBackHinge, doorWidth - 5, 20, 2, 3, 1.5, 2.5, portSteel);
      depotBackHinge.traverse((o) => (o.userData.dynamic = true));
      const exitSignMat = new Three.MeshBasicMaterial({ color: '#58e08a' });
      for (const z of [4570, 4582]) {
        box(depotGroup, backDoor.x, 46, z, 12, 4, 1.5, exitSignMat);
        halo(depotGroup, backDoor.x, 46, z + (z > 4576 ? 3 : -3), 16, '#58e08a');
      }
      const depotRoof = box(depotGroup, 4480, 66, 4460, 286, 4, 246, portSteel.clone());
      for (let z = 4358; z < 4570; z += 35) box(depotGroup, 4480, 60, z, 274, 4, 3, cranePaint);
      box(depotGroup, 4480, 52, 4343, 116, 17, 5, portSteel);
      box(depotGroup, 4480, 42, 4341, 126, 3, 13, cranePaint);
      for (const x of [4418, 4542]) {
        box(depotGroup, x, 21, 4340, 4, 42, 5, cranePaint);
        halo(depotGroup, x, 39, 4335, 20, '#e7e0b0');
      }
      for (const x of [4370, 4580])
        for (const z of [4380, 4420, 4530]) {
          const g = makeCargoCrate(depotGroup, 24);
          g.position.set(x, 0, z);
        }
      sign('MORETTI FREIGHT', 4480, 4337, 180, '#e8ce83');
      const airBeam = new Three.Mesh(
        new Three.ConeGeometry(54, 1, 32, 1, true),
        new Three.MeshBasicMaterial({
          color: '#d7eaff',
          transparent: true,
          opacity: 0.07,
          side: Three.DoubleSide,
          depthWrite: false,
        }),
      );
      scene.add(airBeam);
      airBeam.visible = false;
      const airPool = new Three.Mesh(
        new Three.CircleGeometry(54, 40),
        new Three.MeshBasicMaterial({
          color: '#d8eaff',
          transparent: true,
          opacity: 0.11,
          depthWrite: false,
        }),
      );
      airPool.rotation.x = -Math.PI / 2;
      airPool.visible = false;
      scene.add(airPool);
      const airLight = new Three.SpotLight('#dceaff', 0, 600, 0.4, 0.7, 1);
      scene.add(airLight, airLight.target);
      const guardCones = Array.from(
        {
          length: 3,
        },
        () => {
          const geo = new Three.BufferGeometry();
          geo.setAttribute('position', new Three.BufferAttribute(new Float32Array(42 * 9), 3));
          const g = new Three.Mesh(
            geo,
            new Three.MeshBasicMaterial({
              color: '#e6c386',
              transparent: true,
              opacity: 0.075,
              depthWrite: false,
              side: Three.DoubleSide,
            }),
          );
          g.frustumCulled = false;
          g.visible = false;
          scene.add(g);
          return g;
        },
      );
      const beamTop = new Three.Vector3(),
        beamBottom = new Three.Vector3(),
        beamAxis = new Three.Vector3(),
        beamUp = new Three.Vector3(0, 1, 0);
      function updateMissionVisuals() {
        depotRoof.visible = distanceBetween(player, VINNY_DEPOT.inside) > 330;
        // The shutter slides up into its housing; 0 is open, 1 is fully down.
        depotFrontDoor.visible = depotFrontShutter > 0.01;
        depotFrontDoor.position.y = 29 + (1 - depotFrontShutter) * 59;
        // Closed is flush with the wall; open swings the leaf out ~100 degrees.
        depotBackHinge.rotation.y = -(1 - depotBackDoor) * 1.75;
        const h = vehicles.find((c) => c.airUnit && c.hp > 0 && !c.airRetreat),
          t = airSearchPoint(h);
        airBeam.visible = airPool.visible = !!t && distanceBetween(h, cameraTarget) < 950;
        if (t) {
          const top = beamTop.set(h.x, h.altitude + 9, h.y),
            bottom = beamBottom.set(t.x, entityElevation(t) + 1, t.y),
            d = beamAxis.copy(top).sub(bottom);
          airBeam.position.copy(top).add(bottom).multiplyScalar(0.5);
          airBeam.scale.set(1, d.length(), 1);
          airBeam.quaternion.setFromUnitVectors(beamUp, d.normalize());
          airPool.position.copy(bottom);
          airLight.position.copy(top);
          airLight.target.position.copy(bottom);
          airLight.intensity = 1200;
        } else airLight.intensity = 0;
        const missionState = rooftopJob(),
          guards = enemies.filter((e) => e.guard && e.hp > 0 && e.missionTag === 'rooftop-hit');
        guardCones.forEach((g, i) => {
          const e = guards[i];
          g.visible = !!e && !!missionState && player.roof && !missionState.alarm;
          if (e) {
            g.position.set(e.x, e.altitude + 0.2, e.y);
            const v = g.geometry.attributes.position.array;
            for (let j = 0; j < 42; j++) {
              let at = j * 9;
              v[at++] = 0;
              v[at++] = 0;
              v[at++] = 0;
              for (const a of [e.a - 0.82 + (j * 1.64) / 42, e.a - 0.82 + ((j + 1) * 1.64) / 42]) {
                const d = roofRayLength(e, a);
                v[at++] = Math.cos(a) * d;
                v[at++] = 0;
                v[at++] = Math.sin(a) * d;
              }
            }
            g.geometry.attributes.position.needsUpdate = true;
          }
        });
      }
      function drawHitTargetLabel() {
        const m = rooftopJob();
        if (!m || !player.roof) return;
        for (const actor of [
          m.boss,
          ...storyActors.filter((p) => p.missionTag === 'rooftop-hit' && !p.hidden),
        ]) {
          const p = api.project(actor.x, actor.y, actor.altitude + 33);
          if (p.x < 40 || p.x > viewportWidth - 40 || p.y < 70 || p.y > viewportHeight - 150) continue;
          if (actor.speech) roofSpeechBubble(actor, p.x, p.y);
          else if (actor === m.boss && actor.hp > 0) {
            worldContext.fillStyle = '#15222bef';
            worldContext.fillRect(p.x - 72, p.y - 16, 144, 24);
            worldContext.fillStyle = '#f3d592';
            worldContext.textAlign = 'center';
            worldContext.font = 'bold 11px Arial';
            worldContext.fillText('LUCIANO VESCARI', p.x, p.y);
          }
        }
      }
      // BEGIN CARGO SHIP
      /**
       * IRONWORKS TRADER, a geared feeder container ship: lofted hull with a
       * raised forecastle, four holds of containers stacked on hatch covers, two
       * deck cranes, the accommodation block and bridge aft with its funnel, a
       * free-fall lifeboat on the stern and mooring gear at both ends. Built in
       * its own frame (bow +x, starboard +z) from HARBOR.ship's length and beam.
       */
      function buildCargoShip() {
        const g = new Three.Group(),
          L = HARBOR.ship.l,
          B = HARBOR.ship.w,
          deck = 30;
        const spec = {
          length: L,
          beam: B,
          draft: 22,
          form: { transom: 0.8, maxAt: -0.08, entry: 2.6, bowShape: 0.62, sternCurve: 3.5 },
          sheer: [
            [-0.5, 34],
            [0.31, 33],
            [0.335, 42],
            [0.5, 45],
          ],
          rake: 0.035,
          forefoot: 0.1,
          keelRise: 0.15,
          bilge: 4,
          flare: 0.28,
          tuck: 0.12,
          boot: [-3.2, 1.2],
          colors: { bottom: '#8a2f2a', boot: '#1c1e21', top: '#23465a', bands: [[0.9, 0.93, '#e8e2d0']] },
          finish: 'satin',
          stations: 40,
        };
        hullMesh(g, spec);
        const steelDeck = tint('#5f6b66', 'matte'),
          white = tint('#eeece4', 'satin'),
          crane = tint('#e0b83a', 'gloss'),
          rust = tint('#7a4a36', 'matte');
        hullDeck(g, spec, deck, -L / 2, L * 0.33, 1.5, steelDeck);
        hullDeck(g, spec, 42, L * 0.33, L / 2 - 2, 1.5, steelDeck);
        // Breakwater across the forecastle and the step down to the main deck.
        box(g, L * 0.33, (deck + 42) / 2, 0, 2, 42 - deck, hullBeamAt(spec, L * 0.33, 36) * 2 - 2, white);
        for (const side of [-1, 1]) {
          const bw = strut(g, [L * 0.35, 43, side * 30], [L * 0.39, 49, 0], 2.4, white);
          bw.scale.x = bw.scale.z = 2.4;
        }
        // Holds: hatch covers and container stacks, fewer rows where the bow narrows.
        const palette = ['#1f5f8b', '#b23a2e', '#2f7d4f', '#d98e2b', '#e8e4da', '#6b6f73', '#8d3b72', '#c9b43c', '#1d3e6e', '#8a5a3a', '#3b8f96'];
        let seed = 11;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (const [bi, bu] of [-96, -44, 26, 78].entries()) {
          const halfWidth = hullBeamAt(spec, bu + 24, deck) - 6,
            rows = Math.min(5, Math.floor((halfWidth * 2) / 23));
          box(g, bu, deck + 2, 0, 50, 4, rows * 23 + 4, tint('#3d5a4a', 'satin'));
          for (let r = 0; r < rows; r++) {
            const v = (r - (rows - 1) / 2) * 23,
              tiers = 1 + Math.floor(rnd() * (bi === 3 ? 2.2 : 3.6));
            for (let k = 0; k < tiers; k++) {
              const c = palette[Math.floor(rnd() * palette.length)];
              box(g, bu, deck + 4 + 10.5 + k * 21, v, 48, 21, 22, tint(c, 'ribbed'));
            }
          }
        }
        // Deck cranes: pedestal, cab, jib and hook, both slewed toward the quay.
        for (const [cu, slew] of [
          [-9, 2.2],
          [114, 2.5],
        ]) {
          mesh(cylinderGeo, crane, g, cu, deck + 14, -30, 5, 28, 5);
          box(g, cu, deck + 31, -30, 12, 8, 10, crane);
          box(g, cu + 3, deck + 32, -24.8, 5, 4, 0.4, kitGlass);
          const tip = [cu + Math.cos(slew) * 70, deck + 64, -30 - Math.sin(slew) * 70];
          strut(g, [cu, deck + 30, -30], tip, 2.6, crane);
          strut(g, tip, [tip[0], deck + 20, tip[2]], 0.5, tint('#222222', 'metal'));
          box(g, tip[0], deck + 18, tip[2], 3, 3, 3, tint('#222222', 'metal'));
        }
        // Accommodation block, bridge with full-width wings, funnel and mast.
        const ab = deckOutline(-L * 0.46, -L * 0.33, B * 0.4, 0, 2, 12, 3);
        deckhouse(g, ab, deck, deck + 58, { paint: white, glassFrom: 0, glassTo: 0, roof: true });
        for (let z = deck + 8; z < deck + 56; z += 12) {
          const ring = offsetOutline(ab, 0.3);
          mesh(prismGeometry(ring, ring, z, z + 4, false), kitGlass, g, 0, 0, 0);
        }
        box(g, -L * 0.35, deck + 64, 0, 22, 12, B - 2, white);
        box(g, -L * 0.35 + 11.2, deck + 65, 0, 0.6, 5, B - 6, kitBridgeGlass);
        for (const side of [-1, 1]) {
          box(g, -L * 0.35, deck + 65, side * (B / 2 - 1.5), 16, 5, 0.6, kitBridgeGlass);
          box(g, -L * 0.35 + 6, deck + 67, side * (B / 2 - 0.5), 2, 2, 1, side > 0 ? kitStarboardLamp : kitPortLamp);
        }
        box(g, -L * 0.35, deck + 70.5, 0, 24, 1.2, B, tint('#d6d3c8', 'satin'));
        box(g, -L * 0.37, deck + 84, 0, 2, 26, 2, white);
        box(g, -L * 0.37, deck + 92, 0, 2, 2, 26, white);
        box(g, -L * 0.37 + 3, deck + 95, 0, 1.4, 1.2, 16, tint('#1d2226', 'satin'));
        const fb = deckOutline(-L * 0.47, -L * 0.42, 11, 8, 2, 12, 2),
          ft = fb.map(([u, v]) => [u - 5, v * 0.9]);
        mesh(prismGeometry(fb, ft, deck + 58, deck + 88, false), tint('#1f5f8b', 'gloss'), g, 0, 0, 0);
        mesh(prismGeometry(ft, ft.map(([u, v]) => [u - 1, v]), deck + 88, deck + 94, true), tint('#1a1c1f', 'satin'), g, 0, 0, 0);
        mesh(prismGeometry(offsetOutline(fb, 0.3), offsetOutline(ft, 0.3).map(([u, v]) => [u + 2.5, v * 1.02]), deck + 70, deck + 75, false), white, g, 0, 0, 0);
        // Free-fall lifeboat on its stern ramp.
        const lifeboat = new Three.Group();
        lifeboat.position.set(-L * 0.48, deck + 12, 0);
        lifeboat.rotation.z = -0.5;
        g.add(lifeboat);
        box(lifeboat, 0, 0, 0, 30, 9, 11, tint('#e46a2a', 'gloss'));
        box(lifeboat, 3, 5, 0, 18, 3, 8, tint('#e46a2a', 'gloss'));
        box(g, -L * 0.47, deck + 5, 0, 4, 10, 14, rust);
        // Forecastle: windlasses, foremast and anchors; bollards and winches aft.
        for (const side of [-1, 1]) {
          mesh(cylinderGeo, tint('#2b3a33', 'satin'), g, L * 0.43, 45, side * 9, 4, 5, 4);
          box(g, L * 0.47, 36, side * (hullBeamAt(spec, L * 0.47, 36) + 0.3), 7, 6, 0.8, tint('#1c1e21', 'satin'));
          for (const u of [-L * 0.44, -L * 0.3, L * 0.2, L * 0.4]) bollard(g, u, u > L * 0.33 ? 42 : deck, side * (hullBeamAt(spec, u, deck) - 5), 2.2);
        }
        box(g, L * 0.41, 60, 0, 2, 36, 2, white);
        box(g, L * 0.41, 74, 0, 1.4, 1.4, 12, white);
        // Deck edge rails.
        for (const side of [-1, 1])
          railing(g, hullEdge(spec, deck, -L * 0.48, L * 0.32, 1.5, 12).map(([u, v]) => [u, side * v]), deck, 5, { spacing: 12, material: white });
        // Names on both bows and across the stern.
        for (const side of [1, -1]) {
          const u = L * 0.38,
            board = kitNameBoard(g, 'IRONWORKS TRADER', null, '#f2f0e8', 60, u, 35, side * (hullBeamAt(spec, u, 35) + 0.6), side > 0 ? 0 : Math.PI);
          board.rotation.y += side * Math.atan2(hullBeamAt(spec, u - 10, 35) - hullBeamAt(spec, u + 10, 35), 20);
        }
        kitNameBoard(g, 'IRONWORKS TRADER', 'SOUTH COAST', '#f2f0e8', 66, -L / 2 - 0.6, 22, 0, -Math.PI / 2);
        return g;
      }
      // END CARGO SHIP
      // END SUBSYSTEM: src/harbor3d.js
