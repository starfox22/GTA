      // Motels, inns and lodges ('sleep' places with a building of their own): a porte-cochere on slender
      // columns over a stepped and ramped lobby with lit glazed doors, a covered walkway of numbered
      // room doors with windows and air-conditioners, planters, a vending alcove and the VACANCY pylon.
      // Static batched meshes only; the footprint, the door and the fascia sign are civic3d.js's.
      const hotelWhite = staticMat('#e8e4da', 0.5),
        hotelBronze = staticMat('#3a332e', 0.4, 0.6),
        hotelStone = staticMat('#bbb4a4', 0.85),
        hotelAc = staticMat('#cfd2d1', 0.6, 0.2),
        hotelVent = staticMat('#3c4145', 0.6, 0.3),
        hotelFlower = staticMat('#d9647a', 0.8),
        hotelCurtain = staticMat('#c9b48e', 0.9),
        hotelVending = staticMat('#a4382f', 0.5, 0.2),
        hotelVendingLit = new Three.MeshBasicMaterial({ color: '#8fb6d6' });
      // Room-number plates: one atlas of 64 plates (101..164), one shared material.
      const hotelNumbers = (() => {
        const cols = 8,
          rows = 8,
          cv = document.createElement('canvas');
        cv.width = cols * 64;
        cv.height = rows * 32;
        const g = cv.getContext('2d');
        for (let i = 0; i < cols * rows; i++) {
          const cx = (i % cols) * 64,
            cy = Math.floor(i / cols) * 32;
          g.fillStyle = '#ece8dc';
          g.fillRect(cx, cy, 64, 32);
          g.strokeStyle = '#7d6b4f';
          g.lineWidth = 2;
          g.strokeRect(cx + 1, cy + 1, 62, 30);
          g.fillStyle = '#2a2622';
          g.font = '700 22px Georgia, serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(101 + i), cx + 32, cy + 17);
        }
        const map = new Three.CanvasTexture(cv);
        map.colorSpace = Three.SRGBColorSpace;
        map.anisotropy = 4;
        return { cols, rows, material: new Three.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.15 }), geometry: new Map() };
      })();
      function hotelNumberPlate(group, index, x, y, z) {
        const n = hotelNumbers;
        let geo = n.geometry.get(index);
        if (!geo) {
          geo = new Three.PlaneGeometry(1, 1);
          const uv = geo.attributes.uv,
            u0 = (index % n.cols) / n.cols,
            v0 = 1 - (Math.floor(index / n.cols) + 1) / n.rows;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / n.cols, v0 + uv.getY(i) / n.rows);
          n.geometry.set(index, geo);
        }
        const plate = mesh(geo, n.material, group, x, y, z, 4.6, 2.4, 1);
        plate.castShadow = false;
        return plate;
      }
      const ROOM = 22;
      function dressHotel(p, group, x, face) {
        const accent = new Three.Color(p.color),
          trim = staticMat('#' + accent.clone().multiplyScalar(0.62).getHexString(), 0.55),
          doorPaint = staticMat('#' + accent.clone().multiplyScalar(0.46).getHexString(), 0.5),
          lobbyW = clamp(p.w * 0.22, 36, 50),
          canW = Math.min(lobbyW + 26, p.w * 0.75),
          // How deep the building's front may be dressed: to the nearest carriageway (a town lodge stands
          // close to its street, a city motel has a car park).
          room = (() => {
            for (let k = 6; k <= 44; k += 2) if ([-30, 0, 30].some((dx) => onRoad(x + dx, face + k))) return k - 2;
            return 44;
          })(),
          canD = clamp(room - 4, 10, 18);
        // The entrance court: two shallow steps under the doors and a wheelchair ramp at one side.
        box(group, x, 0.8, face + 5, lobbyW + 14, 1.6, 10, hotelStone);
        box(group, x, 0.4, face + 12, lobbyW + 6, 0.8, 5, hotelStone);
        const rampX = x + lobbyW / 2 + 13,
          ramp = box(group, rampX, 0.85, face + 6, 12, 0.5, 8, hotelStone);
        ramp.rotation.z = -0.13;
        box(group, rampX, 3.6, face + 10.4, 12, 0.5, 0.5, chrome);
        for (const dx of [-5.5, 5.5]) box(group, rampX + dx, 1.8, face + 10.4, 0.5, 3.6, 0.5, chrome);
        // The forecourt: stone paving in a darker border, a band of the hotel's colour leading to the doors.
        const courtW = canW + 12,
          border = staticMat('#8f8a7e', 0.9);
        const courtD = clamp(room - 8, 8, 24);
        box(group, x, 0.25, face + 10 + courtD / 2, courtW, 0.5, courtD, border);
        box(group, x, 0.32, face + 10 + courtD / 2, courtW - 4, 0.5, Math.max(1, courtD - 4), hotelStone);
        box(group, x, 0.4, face + 12 + courtD / 2, 6, 0.5, Math.max(1, courtD - 4), trim);
        // The lobby: a glazed wall in bronze mullions with a pair of glass doors, lit from inside at night.
        box(group, x, 12.5, face + 0.9, lobbyW, 25, 1.2, shopGlassMaterial);
        const bays = Math.max(4, Math.round(lobbyW / 10));
        for (let i = 0; i <= bays; i++) box(group, x - lobbyW / 2 + (i * lobbyW) / bays, 12.5, face + 1.6, 0.9, 25.4, 1.5, hotelBronze);
        for (const y of [0.9, 19.6, 25]) box(group, x, y, face + 1.6, lobbyW + 1, y > 10 ? 1.2 : 1.8, 1.7, hotelBronze);
        for (const dx of [-7.4, 0, 7.4]) box(group, x + dx, 9.6, face + 1.8, 0.7, 19.2, 1.4, hotelBronze);
        for (const dx of [-1.7, 1.7]) box(group, x + dx, 10, face + 2.6, 0.5, 6.5, 0.5, chrome);
        box(group, x, 14, face - 0.4, lobbyW + 6, 29, 0.8, trim);
        // The porte-cochere: a thin slab with a coloured fascia on four slender columns.
        const slabY = 26.4;
        box(group, x, slabY, face + canD / 2, canW, 1.4, canD, hotelWhite);
        box(group, x, slabY, face + canD + 0.4, canW + 1.4, 3.2, 1, trim);
        box(group, x, slabY - 1.1, face + canD - 1.4, canW - 6, 0.3, 1.4, warmLamp);
        for (const side of [-1, 1]) {
          box(group, x + side * (canW / 2 - 3.5), 12.8, face + canD - 2, 1.5, 25.6, 1.5, hotelWhite);
          box(group, x + side * (canW / 2 - 3.5), 0.4, face + canD - 2, 3, 0.8, 3, hotelStone);
        }
        for (const side of [-1, 1]) box(group, x + side * canW * 0.25, slabY + 1, face + canD * 0.5, canW * 0.28, 0.5, canD * 0.5, glass);
        registerOverheadCover(x, face + canD / 2, canW / 2, canD / 2, 0, 25, 28, 'entrance canopy');
        addGlow(x, 16, face + 7, 34, '#ffd9a0', 0.5, {});
        addGlow(x, 24, face + canD - 4, 26, '#ffd9a0', 0.4, {});
        signSpill(x, face + canD + 8, 64, '#ffd9a0', 0.38, { width: Math.min(canW, 80), length: 80, strength: 0.8 });
        // Planters either side of the court: concrete boxes of clipped shrubs with a little colour.
        for (const side of [-1, 1]) {
          const px = x + side * (canW / 2 + 8);
          box(group, px, 1.6, face + 6, 14, 3.2, 6, concrete);
          for (let j = 0; j < 3; j++) mesh(sphereGeo, stillLeafMat, group, px + (j - 1) * 4.2, 5.2, face + 6, 4.4, 3.6, 3.8);
          mesh(sphereGeo, hotelFlower, group, px + side * 2.2, 6.4, face + 7.4, 1.6, 1.4, 1.6);
        }
        // A potted palm either side of the court (it reads from the street camera as nothing else does).
        if (room >= 30)
          for (const side of [-1, 1]) {
          const fx = x + side * (courtW / 2 + 4),
            fz = face + 26;
          box(group, fx, 1.2, fz, 6, 2.4, 6, concrete);
          mesh(cylinderGeo, wood, group, fx, 11, fz, 1.3, 18, 1.3);
          for (let j = 0; j < 7; j++) {
            const a = (j / 7) * Math.PI * 2,
              frond = mesh(sphereGeo, palmFrondMaterial, group, fx + Math.cos(a) * 5.2, 19.6 - (j % 2), fz + Math.sin(a) * 5.2, 6.5, 0.7, 1.7);
            frond.rotation.y = -a;
            frond.rotation.z = Math.cos(a) * 0 + 0.12;
          }
          mesh(sphereGeo, palmFrondMaterial, group, fx, 20.6, fz, 2.4, 1.2, 2.4);
        }
        // The covered walkway: room doors under a shallow roof, a numbered plate over each.
        let roomNo = 0;
        for (const side of [-1, 1]) {
          const from = x + side * (canW / 2 + 15),
            edge = side < 0 ? p.x + 7 : p.x + p.w - 7,
            count = Math.floor(Math.abs(edge - from) / ROOM);
          if (count < 1) continue;
          const span = count * ROOM,
            mid = from + (side * span) / 2;
          box(group, mid, 25, face + 5.6, span + 6, 1, 11.2, hotelWhite);
          box(group, mid, 24.4, face + 11.4, span + 6, 2.4, 0.9, trim);
          registerOverheadCover(mid, face + 5.6, span / 2 + 3, 5.6, 0, 22, 26, 'awning');
          for (let k = 0; k <= count; k += 2) box(group, from + side * k * ROOM, 12.2, face + 10.6, 1.1, 24.4, 1.1, hotelWhite);
          for (let k = 0; k < count; k++, roomNo++) {
            const rx = from + side * (k * ROOM + ROOM / 2),
              doorX = rx - side * 5.6,
              winX = rx + side * 5.6,
              lit = (roomNo * 5 + (side > 0 ? 2 : 0)) % 3 === 1;
            box(group, doorX, 9.6, face + 0.5, 8.2, 19.4, 0.5, hotelBronze);
            box(group, doorX, 9.2, face + 0.9, 6.8, 18.4, 0.8, doorPaint);
            box(group, doorX + side * 2.6, 9, face + 1.5, 0.5, 2.6, 0.6, chrome);
            hotelNumberPlate(group, roomNo % 64, doorX, 21.2, face + 0.7);
            box(group, rx - side * 0.6, 24, face + 5.4, 6, 0.3, 1.6, warmLamp);
            box(group, winX, 11.4, face + 0.5, 10.6, 11.6, 0.5, hotelBronze);
            box(group, winX, 11.4, face + 0.9, 9.2, 10, 0.4, lit ? shopGlassMaterial : glass);
            if (lit) box(group, winX + side * 2.2, 11, face + 1.3, 4, 9.4, 0.3, hotelCurtain);
            box(group, winX, 5.3, face + 1.4, 11, 0.8, 1.8, concrete);
            if (roomNo % 2 === 0) {
              box(group, winX, 2.3, face + 0.9, 8, 3.6, 1.6, hotelAc);
              box(group, winX, 2.3, face + 1.75, 6, 1.4, 0.3, hotelVent);
            }
            if (roomNo % 2 === 0) addGlow(doorX, 22, face + 5, 9, '#ffd9a0', 0.28, {});
          }
          // The end of the wing: a lit vending and ice alcove.
          if (count >= 3 && side > 0) {
            const vx = from + side * (span + 5);
            box(group, vx, 6.2, face + 2.4, 5.4, 12.4, 4, hotelVending);
            box(group, vx, 8, face + 4.5, 4.2, 6.4, 0.3, hotelVendingLit);
          }
        }
        // The VACANCY pylon at the driveway (it stutters), on the side away from the bike-share rack.
        const vx = x - Math.min(canW / 2 + 26, p.w / 2 - 6),
          pz = face + clamp(room - 6, 8, 22);
        box(group, vx, 13, pz, 1.2, 26, 1.2, darkMetal);
        atlasSign(group, windowNeonCell('VACANCY'), vx, 29, pz + 0.8, 22, 11, neonBoardFlicker[0]);
        box(group, vx, 29, pz, 23, 12, 1, darkMetal);
        signSpill(vx, pz + 12, 40, '#ff4f6d', 0.35, { width: 16, length: 60, strength: 0.9, mode: 'flicker' });
      }
