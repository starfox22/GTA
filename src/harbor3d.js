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
      const harborGroup = new Three.Group();
      scene.add(harborGroup);
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
      sign('IRONWORKS CARGO', 2940, 1438, 210, '#e6c581');
      sign('RESTRICTED · KEEP CLEAR', 2805, 1578, 119, '#e0b360');
      const gateRoot = new Three.Group();
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
      const sw = HARBOR.ship.w,
        sl = HARBOR.ship.l,
        hullShape = new Three.Shape();
      hullShape.moveTo(-sw * 0.47, sl * 0.5);
      hullShape.lineTo(-sw * 0.5, -sl * 0.28);
      hullShape.quadraticCurveTo(-sw * 0.45, -sl * 0.43, 0, -sl * 0.5);
      hullShape.quadraticCurveTo(sw * 0.45, -sl * 0.43, sw * 0.5, -sl * 0.28);
      hullShape.lineTo(sw * 0.47, sl * 0.5);
      hullShape.closePath();
      const hullGeo = new Three.ExtrudeGeometry(hullShape, {
        depth: 38,
        bevelEnabled: true,
        bevelThickness: 3,
        bevelSize: 3,
        bevelSegments: 2,
        steps: 1,
      });
      hullGeo.rotateX(Math.PI / 2);
      mesh(hullGeo, mat('#253d47', 0.64, 0.45), berthGroup, 0, 27, 0);
      box(berthGroup, 0, -9, 10, sw * 0.91, 6, sl * 0.88, mat('#805244', 0.75));
      const deckGeo = new Three.ShapeGeometry(hullShape);
      deckGeo.rotateX(Math.PI / 2);
      const shipDeckMaterial = mat('#978877', 0.85);
      shipDeckMaterial.side = Three.DoubleSide;
      mesh(deckGeo, shipDeckMaterial, berthGroup, 0, 27.3, 0);
      for (const side of [-1, 1]) {
        box(berthGroup, side * sw * 0.46, 31, 15, 1.2, 7, sl * 0.84, chrome);
        for (let z = -sl * 0.34; z < sl * 0.47; z += 19)
          box(berthGroup, side * sw * 0.46, 31, z, 1, 8, 1, chrome);
      }
      for (let z = -100; z < 80; z += 53)
        for (const x of [-35, 0, 35])
          for (let h = 0; h < (z < 0 ? 2 : 1); h++) {
            const cargo = portSteel.clone();
            cargo.color.set((z + 100) % 2 ? '#ba855c' : '#73929a');
            box(berthGroup, x, 39 + h * 23, z, 30, 22, 47, cargo);
            box(berthGroup, x, 51 + h * 23, z, 31, 1, 48, darkMetal);
          }
      box(berthGroup, 0, 42, 133, 103, 29, 66, mat('#d8d4bd'));
      box(berthGroup, 0, 62, 139, 92, 12, 43, mat('#eeead5'));
      box(berthGroup, 0, 62, 116, 85, 8, 1, glass);
      for (const side of [-1, 1]) box(berthGroup, side * 46.2, 62, 139, 1, 8, 35, glass);
      box(berthGroup, 0, 70, 139, 100, 3, 49, chrome);
      box(berthGroup, 12, 81, 148, 21, 23, 20, mat('#984b38'));
      box(berthGroup, 12, 94, 148, 23, 3, 22, darkMetal);
      box(berthGroup, -19, 85, 132, 1.2, 30, 1.2, chrome);
      box(berthGroup, -19, 95, 132, 25, 1, 1, chrome);
      for (const side of [-1, 1])
        mesh(new Three.CylinderGeometry(4, 4, 4, 12), darkMetal, berthGroup, side * 24, 31, -sl * 0.36);
      for (const y of [1290, 1615])
        rod(harborGroup, new Three.Vector3(3402, 5, y), new Three.Vector3(3470, 29, y + 25), 0.85, wood);
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
      const signalModels = [];
      for (const x of ROAD_CENTERS)
        for (const z of ROAD_CENTERS) {
          if (!cityIntersectionAt(x, z) || !groundAt(x, z, 92) || inHarbor(x, z, 100)) continue;
          const group = new Three.Group();
          scene.add(group);
          const heads = [];
          for (const [vertical, dx, dz] of [
            [true, 61, -65],
            [false, -65, 61],
          ]) {
            box(group, x + dx, 15, z + dz, 1.1, 30, 1.1, darkMetal);
            box(group, x + dx, 29, z + dz, 5, 12, 4, darkMetal);
            const bulbs = ['#a94332', '#d3aa44', '#80b987'].map((co, i) =>
              mesh(
                sphereGeo,
                new Three.MeshBasicMaterial({
                  color: co,
                }),
                group,
                x + dx,
                33 - i * 4,
                z + dz + 2.5,
                1.5,
                1.5,
                0.7,
              ),
            );
            heads.push({
              vertical,
              bulbs,
            });
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
      const signalBulbIndex = {
          red: 0,
          amber: 1,
          green: 2,
        },
        signalLitColors = ['#ff5141', '#ffc454', '#8cdb86'];
      function updateTrafficVisuals() {
        for (const s of signalModels) {
          if (!s.group.visible) continue;
          const state = trafficSignal(s.x, s.z);
          for (const h of s.heads) {
            const on = signalBulbIndex[state[h.vertical ? 'vertical' : 'horizontal']];
            h.bulbs.forEach((b, i) =>
              b.material.color.set(i === on ? signalLitColors[i] : '#252d30'),
            );
          }
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
      // END SUBSYSTEM: src/harbor3d.js
