      // Palms, the Keys' resort hotels, the airport apron, the Blue Hour rooftop bar, updateWorldVisuals and the rescue buoy.
      // A palm of the species library (vegetation3d.js plantPalm): the species by
      // place (fan palms down Ocean Drive, coconuts on the beach...). A palm is a
      // breakable prop (damage.js) drawn as instances (render3d.js BREAKABLE
      // SCENERY): it snaps and falls when a vehicle brings enough energy. Returns
      // the prop.
      function makePalm(x, z, size = 1, species = null) {
        return plantPalm(x, z, size, species);
      }
      // The keys trade brick canyons for pastel hotels, pools, palms and beach
      // furniture. Palms line both kerbs of Ocean Dr (x -2432) on the sea side.
      for (const p of oceanDrivePalms()) makePalm(p.x, p.y, p.size);
      const resortColors = ['#e3b7a6', '#a7cbc5', '#d8cba8', '#aebbd8'];
      for (const b of buildings.filter((b) => b.tropical && !b.place && !b.roofBar)) {
        const group = new Three.Group();
        scene.add(group);
        batchGroups.push(group);
        const co = mat(resortColors[Math.floor(b.y / 200) % 4]);
        // A balcony slab and its glass rail at every storey (game.js STOREY).
        for (let y = SHOP_FLOOR; y < b.height; y += STOREY) {
          box(group, b.x + b.w / 2, y, b.y + b.h + 3, b.w - 12, 1.1, 7, co);
          box(group, b.x + b.w / 2, y + 4.4, b.y + b.h + 6, b.w - 14, 7.6, 0.6, glass);
        }
        for (const x of [b.x + 10, b.x + b.w - 10])
          box(group, x, b.height / 2, b.y + b.h + 3, 3, b.height, 5, co);
        if (b.w > 220) {
          const px = b.x + b.w / 2,
            pz = b.y + b.h + 47;
          box(group, px, 0.18, pz, 99, 0.35, 40, staticMat('#c9c1a7'));
          box(group, px, 0.4, pz, 86, 0.4, 29, staticMat('#65b8b7', 0.15, 0.3));
          for (const side of [-1, 1])
            for (let j = -1; j <= 1; j++)
              box(group, px + j * 29, 1.8, pz + side * 25, 15, 2, 5, staticMat('#d1ddd4'));
        }
        statics.push({
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          group,
          radius: 230,
        });
      }
      // Beach umbrellas on Ocean Drive's strand.
      for (let z = 1100; z < 4200; z += 180) {
        const x = z < 2600 ? -2584 : -2574;
        if (!landAt(x, z)) continue;
        const group = new Three.Group();
        scene.add(group);
        batchGroups.push(group);
        box(group, x, 9, z, 0.8, 18, 0.8, wood);
        mesh(new Three.ConeGeometry(12, 5, 10), mat(z % 360 ? '#dca48f' : '#92bbbd'), group, x, 18, z);
        for (const side of [-1, 1]) {
          box(group, x + side * 13, 1.4, z + 10, 5, 2, 15, staticMat('#e5dac6'));
        }
        statics.push({
          x,
          y: z,
          group,
          radius: 30,
        });
      }
      // No district or street name boards over the carriageway (OCEAN DRIVE,
      // PALM KEYS and NORTHBANK used to hang over Ocean Dr and both ends of the
      // Keys Bridge): district names belong to the HUD and the map.
      // A terminal, gate arms, control tower, service equipment and parked aircraft.
      const ag = new Three.Group();
      scene.add(ag);
      batchGroups.push(ag);
      const terminalGlass = staticMat('#446875', 0.16, 0.55),
        airWhite = staticMat('#d8dfdc', 0.36, 0.3);
      box(
        ag,
        AIRPORT.x + AIRPORT.w / 2,
        22,
        AIRPORT.y + AIRPORT.h + 1,
        AIRPORT.w - 12,
        29,
        1.1,
        terminalGlass,
      );
      for (let x = AIRPORT.x + 12; x < AIRPORT.x + AIRPORT.w; x += 19)
        box(ag, x, 22, AIRPORT.y + AIRPORT.h + 2, 1, 30, 1, chrome);
      sign('SOUTHPORT INTERNATIONAL', 1010, 4990, 235, '#bcd9dc');
      box(ag, 790, 54, 5075, 19, 108, 19, concrete);
      box(ag, 790, 113, 5075, 46, 20, 40, terminalGlass);
      box(ag, 790, 124, 5075, 50, 3, 44, airWhite);
      box(ag, 790, 139, 5075, 1, 27, 1, chrome);
      // Static apron aircraft share the flying airframes' geometry (plane3d.js).
      function parkedJet(x, z, a, size = 1) {
        const group = new Three.Group();
        group.position.set(x, 0, z);
        group.rotation.y = a;
        const kind = size >= 0.9 ? 'airliner' : 'jet';
        group.scale.setScalar(size * (kind === 'airliner' ? 0.63 : 0.9));
        ag.add(group);
        buildAircraft(kind, group, { color: kind === 'airliner' ? '#e6ebe8' : '#dfe3e0', accent: kind === 'airliner' ? '#2c6f8e' : '#8a3b46' });
      }
      // Southport is a GA strip (airfields.js): light aircraft on its apron
      // (AIRPORT_SCENERY_SOLIDS). The runway, its lights and markings are
      // airfields3d.js.
      for (const [x, z, a, color, accent] of [
        [800, 4650, 0, '#e8e2d2', '#8a3b46'],
        [800, 4930, 0, '#dfe6ea', '#2c6f8e'],
        [1000, 5420, Math.PI / 2, '#ece4c8', '#3d6b4a'],
      ]) {
        const group = new Three.Group();
        group.position.set(x, 0, z);
        group.rotation.y = a;
        ag.add(group);
        buildAircraft('courier', group, { color, accent });
      }
      for (let x = 840; x < 1070; x += 30) box(ag, x, 3, 5140, 21, 6, 12, staticMat('#91836d'));
      statics.push({
        x: 750,
        y: 4900,
        group: ag,
        radius: 850,
      });
      // The Blue Hour hotel: its terrace (mission 2) and its street entrance, in their
      // own scope; the frame update is all that comes out.
      const updateBlueHourVisuals = (() => {
        // @include src/world3d-bluehour-terrace.js
        return blueHourFrame;
      })();
      function updateWorldVisuals() {
        updateBeachVisuals();
        updateBlueHourVisuals();
        const light = daylight();
        waterUniforms.uRain.value = weather.rain;
        waterUniforms.uTime.value = gameTime;
        waterUniforms.uDay.value = 0.12 + 0.88 * light;
        waterUniforms.uDusk.value = clamp(1 - Math.abs(light - 0.3) / 0.28, 0, 1);
        camera.getWorldDirection(waterUniforms.uViewDir.value).multiplyScalar(-1);
        waterUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
        // The swell mesh follows the middle of the view and grows to cover what
        // the camera can see, which from the air is far more than the street view.
        const waterScale = Math.max(1, 1 / viewZoom / 2, (viewReach * 2.2) / 7000);
        waterSurface.scale.set(waterScale, waterScale, 1);
        waterSurface.position.x = Math.round(viewCenter.x / 25) * 25;
        waterSurface.position.z = Math.round(viewCenter.y / 25) * 25;
        // The flat far sea follows too, so it still reaches the horizon out past the map (world-edge.js).
        farWater.position.x = Math.round(viewCenter.x / 500) * 500;
        farWater.position.z = Math.round(viewCenter.y / 500) * 500;
        farWater.material.color
          .set('#061421')
          .lerp(new Three.Color(cameraTarget.x < -600 ? '#0c5a68' : '#0f3a52'), light);
      }

      const rescueBuoy = new Three.Group();
      rescueBuoy.position.set(LOC.waterCase.x, 0, LOC.waterCase.y);
      scene.add(rescueBuoy);
      mesh(cylinderGeo, staticMat('#cfa74c'), rescueBuoy, 0, 1, 0, 8, 5, 8);
      box(rescueBuoy, 0, 11, 0, 1, 20, 1, chrome);
      box(rescueBuoy, 0, 19, 0, 9, 7, 1, staticMat('#e0c56e'));
      halo(rescueBuoy, 0, 23, 0, 10, '#efd197');
      box(rescueBuoy, 8, 3, 1, 8, 5, 6, staticMat('#353f43'));
      statics.push({
        x: LOC.waterCase.x,
        y: LOC.waterCase.y,
        group: rescueBuoy,
        radius: 28,
      });
