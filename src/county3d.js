      // BEGIN SUBSYSTEM: src/county3d.js — County and mountain meshes
      /**
       * County and mountain meshes
       * Source: src/county3d.js
       * Scope: createCityRenderer() closure.
       * Terrain surface, snow colors, rural scenery, bridges and region visibility.
       */
      // Regional ground is tiled separately so the original city's ground detail stays sharp.
      for (const tile of countyGroundTiles) {
        const tx = new Three.CanvasTexture(tile.canvas);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = 8;
        const m = new Three.Mesh(
          new Three.PlaneGeometry(CITY_SIZE, CITY_SIZE),
          new Three.MeshStandardMaterial({
            map: tx,
            roughness: 0.94,
            alphaTest: 0.5,
          }),
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(tile.x + CITY_SIZE / 2, 0.025, tile.y + CITY_SIZE / 2);
        m.receiveShadow = true;
        scene.add(m);
      }
      const countyStone = mat('#778078', 0.96),
        countyRock = mat('#6b7468', 0.97),
        countySand = mat('#bfb79a', 0.95),
        countyRail = mat('#a5b2b0', 0.64, 0.4),
        countyAsphalt = mat('#485356', 0.94),
        countyCream = mat('#d6cbb3', 0.86);
      for (const peak of COUNTY_PEAKS) {
        const surface = mountainSurface(peak),
          geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.BufferAttribute(surface.positions, 3));
        geo.setAttribute('uv', new Three.BufferAttribute(surface.uvs, 2));
        geo.setIndex(new Three.BufferAttribute(surface.indices, 1));
        geo.computeVertexNormals();
        const colors = [],
          normal = geo.attributes.normal;
        for (let i = 0; i < surface.positions.length / 3; i++) {
          const height = surface.positions[i * 3 + 1],
            slope = 1 - Math.abs(normal.getY(i)),
            rock = clamp(slope * 1.8 + (height / peak.h - 0.4) * 0.7, 0, 1),
            grass = new Three.Color('#879879'),
            stone = new Three.Color('#b2b2a3');
          grass.lerp(stone, rock);
          grass.lerp(
            new Three.Color('#f1f7fa'),
            snowAmount(
              peak,
              peak.x + surface.positions[i * 3],
              peak.y + surface.positions[i * 3 + 2],
              height,
              slope,
            ),
          );
          colors.push(grass.r, grass.g, grass.b);
        }
        geo.setAttribute('color', new Three.Float32BufferAttribute(colors, 3));
        const textureCanvas = document.createElement('canvas');
        textureCanvas.width = textureCanvas.height = 1024;
        paintMountainTexture(textureCanvas.getContext('2d'), peak, 1024);
        const texture = new Three.CanvasTexture(textureCanvas);
        texture.colorSpace = Three.SRGBColorSpace;
        texture.anisotropy = 4;
        const mountain = new Three.Mesh(
          geo,
          new Three.MeshStandardMaterial({
            map: texture,
            vertexColors: true,
            roughness: 0.97,
          }),
        );
        mountain.name = peak.name || 'County hill';
        mountain.userData.sharedTerrain = true;
        mountain.position.set(peak.x, 0, peak.y);
        mountain.receiveShadow = true;
        scene.add(mountain);
        statics.push({
          x: peak.x,
          y: peak.y,
          group: mountain,
          radius: Math.max(surface.rx, surface.ry) + 200,
        });
      }
      // Gravel markings live on the mountain material itself; no second floating road surface.
      for (const trail of MOUNTAIN_TRAILS) {
        const group = new Three.Group();
        group.name = trail.peak.name + ' overlook';
        scene.add(group);
        const p = trail.peak,
          h = terrainHeight(p.x, p.y);
        box(group, p.x, h + 18, p.y, 1.3, 36, 1.3, chrome);
        box(group, p.x + 10, h + 31, p.y, 19, 10, 0.8, mat('#eab876'));
        // Small stone viewpoint details sit beyond the end of the driving line.
        for (const [dx, dz] of [
          [26, -18],
          [28, -5],
          [29, 8],
        ]) {
          const x = p.x + dx,
            z = p.y + dz,
            y = terrainHeight(x, z);
          const rock = mesh(
            new Three.IcosahedronGeometry(1, 0),
            countyStone,
            group,
            x,
            y + 1.2,
            z,
            4.5,
            3,
            3.5,
          );
          rock.rotation.y = dx * 0.3;
        }
        const boardX = p.x + 27,
          boardZ = p.y - 27,
          boardY = terrainHeight(boardX, boardZ);
        for (const side of [-1, 1]) box(group, boardX + side * 6, boardY + 5, boardZ, 1.2, 10, 1.2, wood);
        const board = box(group, boardX, boardY + 10, boardZ, 17, 1.5, 10, mat('#9e9c79'));
        board.rotation.x = -0.22;
        box(group, boardX, boardY + 11, boardZ, 12, 0.3, 6, mat('#506d64'));
        sign(
          trail.peak.name + ' · 4×4 TRAIL',
          trail.points[0][0] + 55,
          trail.points[0][1] + 30,
          150,
          '#d4cb92',
        );
        statics.push({
          x: p.x,
          y: p.y,
          group,
          radius: p.r + 350,
        });
      }
      for (const [i, r] of MOUNTAIN_OUTCROPS.entries()) {
        const group = new Three.Group();
        group.name = 'Mountain outcrop ' + i;
        scene.add(group);
        const base = terrainHeight(r.x, r.y),
          rock = mesh(
            new Three.IcosahedronGeometry(1, 1),
            i % 2 ? countyStone : countyRock,
            group,
            r.x,
            base + r.rise * 0.35,
            r.y,
            r.w * 0.5,
            r.rise * 0.65,
            r.h * 0.5,
          );
        rock.rotation.y = i * 0.7;
        rock.receiveShadow = rock.castShadow = true;
        const seam = mesh(
          new Three.IcosahedronGeometry(1, 0),
          countyStone,
          group,
          r.x + r.w * 0.18,
          base + r.rise * 0.13,
          r.y - r.h * 0.1,
          r.w * 0.22,
          r.rise * 0.38,
          r.h * 0.34,
        );
        seam.rotation.y = i * 0.8;
        statics.push({
          x: r.x,
          y: r.y,
          group,
          radius: 65,
        });
      }
      for (const bridge of COUNTY_BRIDGES) {
        const dx = bridge.b[0] - bridge.a[0],
          dz = bridge.b[1] - bridge.a[1],
          length = Math.hypot(dx, dz),
          group = new Three.Group(),
          a = Math.atan2(dz, dx);
        group.position.set((bridge.a[0] + bridge.b[0]) / 2, 0, (bridge.a[1] + bridge.b[1]) / 2);
        group.rotation.y = -a;
        scene.add(group);
        box(group, 0, -3, 0, length, 6, bridge.width + 6, concrete);
        box(group, 0, 0.2, 0, length, 0.4, bridge.width, countyAsphalt);
        for (let x = -length / 2 + 25; x < length / 2; x += 48) {
          box(group, x, 0.5, 0, 23, 0.1, 2.7, countyCream);
        }
        for (const part of countyBridgeRails(bridge)) {
          box(
            group,
            part.localX,
            7,
            part.side * (bridge.width / 2 - 1),
            part.hx * 2,
            1.5,
            1.8,
            countyRail,
          );
          box(group, part.localX, 3.6, part.side * (bridge.width / 2 - 1), 1, 7, 1, countyRail);
        }
        for (const side of [-1, 1])
          box(group, 0, 0.6, side * (bridge.width / 2 - 8), length, 0.1, 2, countyCream);
        for (const x of (bridge.name.includes('CAUSEWAY') ? [] : [-length * 0.18, length * 0.18]).filter(
          (x) => !landAt(group.position.x + Math.cos(a) * x, group.position.z + Math.sin(a) * x),
        )) {
          for (const side of [-1, 1]) {
            box(group, x, 69, side * (bridge.width / 2 + 9), 13, 140, 14, countyStone);
            for (let k = -5; k <= 5; k++) {
              const end = x + (k * length) / 22;
              rod(
                group,
                new Three.Vector3(x, 135, side * (bridge.width / 2 + 9)),
                new Three.Vector3(end, 8, side * (bridge.width / 2 - 2)),
                0.8,
                countyRail,
              );
            }
          }
          box(group, x, 129, 0, 13, 8, bridge.width + 30, countyStone);
        }
        statics.push({
          x: group.position.x,
          y: group.position.z,
          group,
          radius: length / 2 + 150,
        });
      }
      for (const t of COUNTY_TOWNS) {
        sign(t.name, t.x + 200, t.y - 72, 150, t.style === 'resort' ? '#e3b9b5' : '#d6d6be');
        for (let j = 0; j < 5; j++) {
          const group = new Three.Group();
          scene.add(group);
          const x = t.x + 70 + j * 185,
            z = t.y + 67;
          box(group, x, 19, z, 1.4, 38, 1.4, darkMetal);
          box(group, x + 4, 38, z, 9, 1.3, 1.4, darkMetal);
          box(group, x + 8, 37, z, 5, 1, 4, warmLamp);
          halo(group, x + 8, 37, z, 17);
          box(group, x + 23, 2, z + 2, 20, 3, 7, wood);
          for (const side of [-1, 1]) box(group, x + 23 + side * 7, 1, z + 2, 1.5, 3, 6, darkMetal);
          statics.push({
            x,
            y: z,
            group,
            radius: 65,
          });
        }
      }
      sign('EAGLE PASS · SCENIC ROUTE', 6650, 2460, 195, '#d5d6b9');
      sign('OCEANVIEW / AIRPORT', 2245, 6920, 190, '#c3ded5');
      sign('CORAL COAST', 7080, 7360, 165, '#f2ccae');
      const airportGroup = new Three.Group();
      scene.add(airportGroup);
      const air = COUNTY_AIRPORT;
      for (let x = air.terminal.x + 12; x < air.terminal.x + air.terminal.w - 10; x += 24) {
        box(airportGroup, x, 25, air.terminal.y + air.terminal.h + 1, 22, 35, 1.5, terminalGlass);
        box(airportGroup, x, 25, air.terminal.y + air.terminal.h + 2, 1, 37, 2, chrome);
      }
      box(airportGroup, 4200, 37, 8680, 610, 3, 60, countyCream);
      for (const x of [3920, 4200, 4480]) box(airportGroup, x, 18, 8698, 2.5, 36, 2.5, chrome);
      box(airportGroup, 3530, 64, 8980, 22, 128, 22, concrete);
      box(airportGroup, 3530, 135, 8980, 62, 24, 55, terminalGlass);
      box(airportGroup, 3530, 150, 8980, 68, 4, 61, airWhite);
      box(airportGroup, 3530, 170, 8980, 1, 37, 1, chrome);
      const radar = box(airportGroup, 3530, 183, 8980, 32, 8, 1, countyRail);
      const terminalTitle = sign('OCEANVIEW INTERNATIONAL', 4215, 8642, 380, '#d1e5df');
      terminalTitle.position.y = terminalTitle.userData.backing.position.y = 55;
      const arrivalsTitle = sign('DEPARTURES / ARRIVALS', 4190, 8709, 215, '#c2dcd5');
      arrivalsTitle.position.y = arrivalsTitle.userData.backing.position.y = 37;
      for (const [x, z, a, size] of [
        [4100, 9160, Math.PI / 2, 1.8],
        [4460, 9160, Math.PI / 2, 1.6],
        [5710, 9300, 0, 1.4],
      ]) {
        const before = ag.children.length;
        parkedJet(x, z, a, size);
        const model = ag.children[before];
        airportGroup.attach(model);
      }
      for (const x of [4100, 4460]) {
        box(airportGroup, x, 17, 8900, 20, 25, 360, countyCream);
        box(airportGroup, x, 23, 9080, 32, 30, 32, terminalGlass);
      }
      for (let x = 3620; x < 6070; x += 75)
        for (const z of [9793, 9976]) {
          box(airportGroup, x, 1.5, z, 3, 3, 3, warmLamp);
          halo(airportGroup, x, 2, z, 10, '#e6dab1');
        }
      for (let i = 0; i < 8; i++) {
        box(airportGroup, 4730 + i * 36, 5, 8910, 24, 10, 14, mat(i % 2 ? '#bea077' : '#90a4a2'));
      }
      statics.push({
        x: 4800,
        y: 9280,
        group: airportGroup,
        radius: 1800,
      });
      const militaryGroup = new Three.Group();
      scene.add(militaryGroup);
      const armyPaint = mat('#647557', 0.85, 0.15),
        fenceMat = new Three.MeshStandardMaterial({
          color: '#99aa98',
          wireframe: true,
          transparent: true,
          opacity: 0.52,
        });
      for (const wall of militaryWalls) {
        const cx = wall.x + wall.w / 2,
          cz = wall.y + wall.h / 2;
        box(militaryGroup, cx, 3, cz, wall.w, 6, wall.h, concrete);
        box(militaryGroup, cx, 15, cz, wall.w, 20, wall.h, armyPaint);
        const length = Math.max(wall.w, wall.h);
        for (let d = 0; d < length; d += 42) {
          const x = wall.w > wall.h ? wall.x + d : cx,
            z = wall.h > wall.w ? wall.y + d : cz;
          box(militaryGroup, x, 16, z, 2, 32, 2, countyRail);
          for (const y of [29, 32]) {
            const wire = mesh(
              new Three.TorusGeometry(3.5, 0.16, 4, 7),
              countyRail,
              militaryGroup,
              x,
              y,
              z,
            );
            wire.rotation.y = wall.w > wall.h ? 0 : Math.PI / 2;
          }
        }
      }
      const baseBarrier = new Three.Group();
      baseBarrier.position.set(9303, 2, 8056);
      militaryGroup.add(baseBarrier);
      box(baseBarrier, 0, 5, 94, 10, 10, 188, countyCream);
      for (let z = 8; z < 184; z += 20) {
        const stripe = box(baseBarrier, -5.1, 5, z, 0.3, 11, 8, mat('#a34935'));
        stripe.rotation.x = 0.3;
      }
      for (const [x, z] of [
        [9328, 7800],
        [10490, 7800],
        [10490, 9190],
        [9350, 9190],
      ]) {
        for (const sx of [-1, 1])
          for (const sz of [-1, 1])
            box(militaryGroup, x + sx * 15, 26, z + sz * 15, 3, 52, 3, countyRail);
        box(militaryGroup, x, 52, z, 42, 5, 42, armyPaint);
        box(militaryGroup, x, 66, z, 39, 25, 39, terminalGlass);
        box(militaryGroup, x, 80, z, 47, 3, 47, armyPaint);
        halo(militaryGroup, x, 68, z, 35, '#efb77a');
      }
      sign('FORT SENTINEL', 9160, 8025, 190, '#e3cba0');
      sign('ARMED SECURITY', 9160, 8260, 175, '#e69e7b');
      for (let x = 9720; x < 9960; x += 50)
        for (let z = 8760; z < 8850; z += 40) {
          box(militaryGroup, x, 6, z, 36, 12, 25, armyPaint);
          for (let i = 0; i < 3; i++) box(militaryGroup, x - 12 + i * 12, 12.5, z, 2, 1, 25, countyRail);
        }
      statics.push({
        x: 9950,
        y: 8510,
        group: militaryGroup,
        radius: 1300,
      });
      function updateCountyVisuals() {
        baseBarrier.rotation.x = (-militaryGate * Math.PI) / 2;
        radar.rotation.y = gameTime * 0.7;
      }
      function makeTank(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body;
        model.tank = true;
        const armor = model.paint,
          track = mat('#29352c', 0.9, 0.3);
        box(b, 0, 10, 0, 79, 15, 41, armor);
        const bow = box(b, 30, 17, 0, 20, 9, 40, armor);
        bow.rotation.z = -0.23;
        box(b, -29, 18, 0, 20, 7, 38, armor);
        for (const side of [-1, 1]) {
          box(b, 0, 8, side * 22, 81, 15, 9, track);
          for (let x = -36; x <= 36; x += 8) {
            box(b, x, 15.7, side * 22, 5, 0.8, 9, countyRail);
            box(b, x, 1, side * 22, 5, 0.8, 9, countyRail);
          }
          for (let x = -29; x < 32; x += 12) {
            const w = mesh(wheelGeo, armor, b, x, 8, side * 26.5, 5.3, 1, 5.3);
            w.rotation.x = Math.PI / 2;
          }
          box(b, 0, 19, side * 22, 82, 3, 11, armor);
          box(b, 12, 24, side * 17, 19, 6, 5, armor);
        }
        for (let i = 0; i < 7; i++) box(b, -24 + i * 3, 22, 0, 1, 1, 25, darkMetal);
        const turret = new Three.Group();
        turret.position.set(0, 24, 0);
        b.add(turret);
        mesh(new Three.CylinderGeometry(17, 21, 10, 8), armor, turret, 0, 1, 0);
        box(turret, -1, 9, 0, 27, 9, 30, armor);
        mesh(new Three.CylinderGeometry(6, 6, 2, 12), countyRail, turret, -4, 15, -5);
        const barrel = new Three.Group();
        turret.add(barrel);
        rod(barrel, new Three.Vector3(12, 8, 0), new Three.Vector3(58, 8, 0), 2.2, armor);
        box(barrel, 59, 8, 0, 5, 5, 5, darkMetal);
        box(barrel, 19, 8, 0, 9, 10, 10, armor);
        rod(turret, new Three.Vector3(-10, 13, 11), new Three.Vector3(-12, 49, 12), 0.35, countyRail);
        for (const side of [-1, 1]) {
          box(b, 40, 15, side * 16, 1, 3, 5, warmLamp);
          box(b, -40, 14, side * 15, 1, 3, 3, tailLamp);
        }
        model.turret = turret;
        model.barrel = barrel;
        return model;
      }
      // END SUBSYSTEM: src/county3d.js
