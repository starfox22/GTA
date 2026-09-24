      // BEGIN SUBSYSTEM: src/county3d.js — County and mountain meshes
      /**
       * County and mountain meshes
       * Source: src/county3d.js
       * Scope: createCityRenderer() closure.
       * Terrain surface, snow colors, rural scenery, bridges and region visibility.
       */
      // Regional ground is tiled separately so the original city's ground detail stays sharp.
      // Their materials get the same procedural ground detail as the city sheet
      // (surfaces3d.js), or the county is a flat, textureless pastel.
      const countyGroundMaterials = [];
      for (const tile of countyGroundTiles) {
        const tx = new Three.CanvasTexture(tile.canvas);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = 8;
        const m = new Three.Mesh(
          new Three.PlaneGeometry(tile.w, tile.h),
          new Three.MeshStandardMaterial({
            map: tx,
            roughness: 0.94,
            alphaTest: 0.5,
          }),
        );
        countyGroundMaterials.push(m.material);
        m.rotation.x = -Math.PI / 2;
        m.position.set(tile.x + tile.w / 2, 0.025, tile.y + tile.h / 2);
        m.receiveShadow = true;
        scene.add(m);
      }
      const countyStone = mat('#778078', 0.96),
        countyRock = mat('#6b7468', 0.97),
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
          normal = geo.attributes.normal,
          // The foot of the hill is the colour of the ground it rises from (the
          // region fill in paintCountyGround), so the mesh's stepped outline on the
          // 10-unit grid does not show as a pale ring; stone and snow come in above.
          region = countyRegionAt(peak.x, peak.y),
          foot = new Three.Color(
            region && region.id === 'ridgeline' ? '#52694a' : region && region.id === 'sentinel' ? '#657057' : '#7e9068',
          ),
          stone = new Three.Color('#6f7369');
        for (let i = 0; i < surface.positions.length / 3; i++) {
          const height = surface.positions[i * 3 + 1],
            slope = 1 - Math.abs(normal.getY(i)),
            // Grassy lower slopes giving way to bare rock with height and steepness.
            rock = clamp(slope * 1.3 + (height / peak.h - 0.45) * 0.9, 0, 1) * clamp(height / (peak.h * 0.15), 0, 1),
            grass = foot.clone();
          grass.lerp(stone, rock);
          grass.lerp(
            new Three.Color('#e6edf1'),
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
        countyGroundMaterials.push(mountain.material);
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
        batchGroups.push(group);
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
        batchGroups.push(group);
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
      for (const bridge of BRIDGES) {
        const dx = bridge.b[0] - bridge.a[0],
          dz = bridge.b[1] - bridge.a[1],
          length = Math.hypot(dx, dz),
          group = new Three.Group(),
          a = Math.atan2(dz, dx);
        group.position.set((bridge.a[0] + bridge.b[0]) / 2, 0, (bridge.a[1] + bridge.b[1]) / 2);
        group.rotation.y = -a;
        scene.add(group);
        batchGroups.push(group);
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
        for (const x of [...new Set(bridgePylons(bridge).map((p) => p.along))]) {
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
          batchGroups.push(group);
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
      sign('OCEANVIEW / AIRPORT', 3370, 6920, 190, '#c3ded5');
      sign('CORAL COAST', 7080, 7360, 165, '#f2ccae');
      // The county airport is merged by the static batcher; the radar (which
      // turns) is flagged dynamic.
      const airportGroup = new Three.Group();
      scene.add(airportGroup);
      batchGroups.push(airportGroup);
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
      radar.userData.dynamic = true;
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
      // Fort Sentinel is drawn by base3d.js (included next).
      function updateCountyVisuals() {
        radar.rotation.y = gameTime * 0.7;
        updateBaseVisuals();
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
