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
      // The entire block is the hotel; every substantial roof prop shares its collision footprint.
      const roofGroup = new Three.Group();
      roofGroup.name = 'Blue Hour rooftop';
      scene.add(roofGroup);
      roofGroup.position.set(ROOFTOP.x, ROOFTOP.height, ROOFTOP.y);
      const rw = ROOFTOP.w,
        rh = ROOFTOP.h,
        deckMat = staticMat('#a4917d'),
        ivory = staticMat('#e4d8bd'),
        navy = staticMat('#264354'),
        brass = staticMat('#bd9960', 0.35, 0.65),
        cushion = staticMat('#e5dbce'),
        poolMat = new Three.MeshStandardMaterial({
          color: '#48aeb7',
          roughness: 0.17,
          metalness: 0.35,
          emissive: '#15515a',
          emissiveIntensity: 0.25,
        }),
        wine = staticMat('#812e45', 0.25),
        bottleMats = [staticMat('#527e68', 0.22), staticMat('#b89463', 0.23), staticMat('#7796a2', 0.22)];
      box(roofGroup, rw / 2, 1.3, rh / 2, rw - 8, 2.6, rh - 8, deckMat);
      for (let z = 12; z < rh - 12; z += 12)
        box(roofGroup, rw / 2, 2.65, z, rw - 24, 0.08, 0.4, staticMat('#796954'));
      box(roofGroup, 84, 2.75, 161, 140, 0.12, 96, staticMat('#aa826a'));
      box(roofGroup, 285, 2.75, 122, 98, 0.12, 123, staticMat('#516574'));
      box(roofGroup, 195, 2.75, 247, 100, 0.12, 90, navy);
      for (const z of [6, rh - 6]) {
        box(roofGroup, rw / 2, 6, z, rw - 10, 9, 1, glass);
        box(roofGroup, rw / 2, 11, z, rw - 9, 0.8, 1, brass);
      }
      for (const x of [6, rw - 6]) {
        box(roofGroup, x, 6, rh / 2, 1, 9, rh - 10, glass);
        box(roofGroup, x, 11, rh / 2, 1, 0.8, rh - 9, brass);
      }
      for (let x = 15; x < rw; x += 30)
        for (const z of [6, rh - 6]) box(roofGroup, x, 7, z, 0.8, 12, 0.8, brass);
      for (let z = 35; z < rh - 20; z += 30)
        for (const x of [6, rw - 6]) box(roofGroup, x, 7, z, 0.8, 12, 0.8, brass);
      let roofPool;
      for (const p of roofCover) {
        const x = p.x - ROOFTOP.x + p.w / 2,
          z = p.y - ROOFTOP.y + p.h / 2;
        if (p.kind === 'pool') {
          box(roofGroup, x, 3, z, p.w, 1.6, p.h, ivory);
          roofPool = box(roofGroup, x, 3.9, z, p.w - 12, 0.35, p.h - 12, poolMat);
          for (let i = -1; i <= 1; i++)
            box(roofGroup, x + i * 29, 4.11, z, 1, 0.06, p.h - 13, staticMat('#94d9d7'));
          for (const side of [-1, 1]) {
            rod(
              roofGroup,
              new Three.Vector3(x + 38, 5, z + side * 6),
              new Three.Vector3(x + 46, 8, z + side * 6),
              0.65,
              chrome,
            );
            box(roofGroup, x + 39, 4.5, z + side * 6, 0.7, 1, 1, chrome);
          }
        } else if (p.kind === 'lift') {
          box(roofGroup, x, 17, z, p.w, 34, p.h, navy);
          box(roofGroup, x, 35, z, p.w + 3, 2, p.h + 3, ivory);
          box(roofGroup, x + p.w / 2 + 0.4, 13, z, 1, 22, 20, chrome);
          box(roofGroup, x + p.w / 2 + 1, 13, z, 0.6, 22, 0.5, navy);
          box(roofGroup, x + p.w / 2 + 1, 15, z + 14, 1, 4, 2, warmLamp);
        } else if (p.kind === 'bar') {
          box(roofGroup, x, 10, z, p.w, 20, p.h, navy);
          box(roofGroup, x, 21, z, p.w + 2, 2, p.h + 2, ivory);
          box(roofGroup, x, 13, z + p.h / 2 + 0.2, p.w - 6, 1, 0.6, brass);
          for (let i = 0; i < 15; i++) {
            const xx = x - p.w / 2 + 6 + i * 7.5;
            mesh(cylinderGeo, bottleMats[i % 3], roofGroup, xx, 25, z - 5, 1.5, 6, 1.5);
            box(roofGroup, xx, 28.5, z - 5, 1, 1.4, 1, brass);
          }
          for (const dx of [-43, -14, 14, 43]) {
            mesh(cylinderGeo, navy, roofGroup, x + dx, 7, z + 20, 4, 2, 4);
            box(roofGroup, x + dx, 4, z + 20, 0.8, 5, 0.8, brass);
          }
          box(roofGroup, x, 35, z - 8, p.w, 2, 3, brass);
          for (let i = -2; i <= 2; i++) halo(roofGroup, x + i * 22, 30, z - 8, 13, '#edd1a0');
        } else if (p.kind === 'hedge') {
          box(roofGroup, x, 7, z, p.w, 14, p.h, ivory);
          const along = p.w > p.h,
            steps = Math.ceil(Math.max(p.w, p.h) / 8);
          for (let i = 0; i < steps; i++)
            mesh(
              sphereGeo,
              stillLeafMat,
              roofGroup,
              along ? p.x - ROOFTOP.x + 4 + i * 8 : x,
              20,
              along ? z : p.y - ROOFTOP.y + 4 + i * 8,
              along ? 6 : 8,
              6,
              along ? 8 : 6,
            );
        } else if (p.kind === 'sofa') {
          box(roofGroup, x, 5, z, p.w, 6, p.h, navy);
          box(roofGroup, x, 8, z + 1, p.w - 3, 2, p.h - 4, cushion);
          box(roofGroup, x, 10, z - p.h / 2 + 2, p.w, 9, 4, navy);
          for (let i = 0; i < Math.floor(p.w / 12); i++)
            box(roofGroup, p.x - ROOFTOP.x + 7 + i * 12, 10, z - p.h / 2 + 5, 9, 5, 3, cushion);
        } else if (p.kind === 'table') {
          box(roofGroup, x, 5, z, 2, 7, 2, brass);
          box(roofGroup, x, 9, z, p.w, 1.5, p.h, ivory);
          box(roofGroup, x + 3, 10, z - 4, 5, 0.1, 3, navy);
          mesh(cylinderGeo, brass, roofGroup, x - 4, 11, z + 4, 1, 3, 1);
          halo(roofGroup, x - 4, 13, z + 4, 7, '#ffe1a9');
        } else if (p.kind === 'buffet') {
          box(roofGroup, x, 7, z, p.w, 14, p.h, navy);
          box(roofGroup, x, 14.8, z, p.w + 1, 1.4, p.h + 1, ivory);
          for (let i = -1; i <= 1; i++) mesh(sphereGeo, chrome, roofGroup, x + i * 12, 17, z, 4, 2.5, 4);
        } else if (p.kind === 'dj') {
          box(roofGroup, x, 5, z, p.w, 6, p.h, navy);
          box(roofGroup, x, 11, z - 3, p.w - 26, 7, 10, navy);
          for (const dx of [-23, 23]) {
            mesh(cylinderGeo, chrome, roofGroup, x + dx, 15, z - 3, 5, 0.6, 5);
            mesh(cylinderGeo, darkMetal, roofGroup, x + dx, 15.4, z - 3, 3.5, 0.1, 3.5);
          }
          box(roofGroup, x, 15, z - 3, 11, 1, 7, chrome);
          for (const dx of [-p.w / 2 + 6, p.w / 2 - 6]) {
            box(roofGroup, x + dx, 16, z, 10, 22, 10, darkMetal);
            for (const h of [12, 21]) {
              const speaker = mesh(cylinderGeo, rubber, roofGroup, x + dx, h, z - 5.1, 3.3, 0.8, 3.3);
              speaker.rotation.x = Math.PI / 2;
            }
          }
        }
      }
      const reservedGlass = new Three.Group();
      roofGroup.add(reservedGlass);
      reservedGlass.position.set(ROOF_HIT.drink.x - ROOFTOP.x, 10, ROOF_HIT.drink.y - ROOFTOP.y);
      mesh(new Three.CylinderGeometry(2.5, 1.7, 4, 12), glass, reservedGlass, 0, 4, 0);
      mesh(new Three.CylinderGeometry(2, 1.4, 2, 12), wine, reservedGlass, 0, 3.3, 0);
      box(reservedGlass, 0, 1, 0, 0.5, 2, 0.5, brass);
      mesh(cylinderGeo, brass, reservedGlass, 0, 0, 0, 2, 0.3, 2);
      const drinkLabel = sign(
        'RESERVED',
        ROOF_HIT.drink.x,
        ROOF_HIT.drink.y - 12,
        44,
        '#f2d491',
      );
      drinkLabel.position.y = ROOFTOP.height + 25;
      drinkLabel.userData.backing.position.y = ROOFTOP.height + 25;
      const danceTiles = [];
      for (let x = 0; x < 6; x++)
        for (let z = 0; z < 5; z++) {
          const material = new Three.MeshStandardMaterial({
            color: (x + z) % 2 ? '#406b77' : '#705878',
            emissive: (x + z) % 2 ? '#355b68' : '#62365e',
            emissiveIntensity: 0.35,
            roughness: 0.3,
          });
          danceTiles.push(box(roofGroup, 158 + x * 14, 2.95, 217 + z * 15, 13, 0.2, 14, material));
        }
      // Slim festoon cables give the party a ceiling without obscuring navigation.
      for (const z of [186, 289]) {
        for (const x of [22, 337]) box(roofGroup, x, 22, z, 1, 44, 1, brass);
        for (let i = 0; i < 15; i++) {
          const x = 22 + i * 22.5,
            y = 42 - Math.sin((i / 14) * Math.PI) * 5;
          rod(
            roofGroup,
            new Three.Vector3(x, y, z),
            new Three.Vector3(x + 22.5, 42 - Math.sin(((i + 1) / 14) * Math.PI) * 5, z),
            0.18,
            darkMetal,
          );
          if (i < 14) {
            mesh(sphereGeo, warmLamp, roofGroup, x, y - 1, z, 1, 1.3, 1);
            halo(roofGroup, x, y - 1, z, 9, '#efd6a2');
          }
        }
      }
      for (const [x, z] of [
        [92, 204],
        [300, 204],
        [283, 263],
      ]) {
        box(roofGroup, x, 22, z, 1.5, 31, 1.5, wood);
        for (let k = 0; k < 6; k++) {
          const a = (k * TAU) / 6,
            leaf = box(roofGroup, x + Math.cos(a) * 7, 38, z + Math.sin(a) * 7, 15, 1.4, 3, stillLeafMat);
          leaf.rotation.y = -a;
          leaf.rotation.z = 0.18;
        }
      }
      function roofSign(text, x, z, width, color, y = 27) {
        const s = sign(text, ROOFTOP.x + x, ROOFTOP.y + z, width, color);
        s.position.y = ROOFTOP.height + y;
        s.userData.backing.position.y = s.position.y;
        return s;
      }
      roofSign('THE BLUE HOUR', 180, rh + 2, 196, '#9fdad8', 20);
      roofSign('COCKTAILS', 251, 23, 77, '#edcc99', 40);
      roofSign('ELEVATOR', 37, 327, 54, '#c4d9d7', 29);
      roofSign('PRIVATE LOUNGE', 303, 74, 73, '#d6bf8b', 27);
      const entrySign = sign('BLUE HOUR HOTEL', ROOFTOP.door.x, ROOFTOP.y + rh + 3, 190, '#d4c4a1');
      entrySign.position.y = 34;
      entrySign.userData.backing.position.y = 34;
      statics.push({
        x: ROOFTOP.x + rw / 2,
        y: ROOFTOP.y + rh / 2,
        group: roofGroup,
        radius: 300,
      });
      function updateWorldVisuals() {
        updateBeachVisuals();
        const hit = rooftopJob();
        // Vescari picks it up mid-toast (roofmission-poison.js glassTaken).
        reservedGlass.visible = !hit?.glassTaken;
        poolMat.emissiveIntensity = 0.22 + Math.sin(gameTime * 1.8) * 0.055;
        danceTiles.forEach(
          (t, i) =>
            (t.material.emissiveIntensity = hit?.partyPanic
              ? 0.08
              : 0.23 + Math.sin(gameTime * 2.3 + i * 0.7) * 0.13),
        );
        // Down once the glass is spiked: the toast plays out in the open.
        drinkLabel.visible = drinkLabel.userData.backing.visible = !!hit && player.roof && !hit.poisonUsed && !hit.killRegistered;
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
