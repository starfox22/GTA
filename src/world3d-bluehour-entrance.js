      // The Blue Hour's street entrance in 3D: stone portal, revolving door, glass canopy with marquee bulbs,
      // red carpet, topiary, brass rope posts and bollards, lantern standards and the valet stand
      // (plan: BLUE_HOUR_ENTRANCE, roofmission-entrance.js; the camera sees it from the south).
      const bhEntrance = new Three.Group();
      bhEntrance.name = 'Blue Hour entrance';
      scene.add(bhEntrance);
      batchGroups.push(bhEntrance);
      const BHE = BLUE_HOUR_ENTRANCE,
        bhx = BHE.cx,
        bhFace = BHE.face,
        bhTravertine = staticMat('#d6cab1', 0.55),
        bhTravertineDark = staticMat('#c9bb9d', 0.6),
        bhBrass = staticMat('#c9a35f', 0.28, 0.8),
        bhNavy = staticMat('#1c2a44', 0.55, 0.2),
        bhGranite = staticMat('#34373b', 0.35, 0.15),
        bhCarpet = staticMat('#8a1321', 0.95),
        bhRope = staticMat('#7a0f1c', 0.8),
        bhIron = staticMat('#1d1f22', 0.45, 0.6),
        bhBox = staticMat('#34502f', 0.9),
        bhBoxLight = staticMat('#46663d', 0.9),
        bhWood = staticMat('#4a2e1e', 0.5),
        bhRoundGeo = new Three.CylinderGeometry(1, 1, 1, 20),
        // See-through glass (not batched: a handful of draws).
        bhClear = new Three.MeshStandardMaterial({ color: '#cfe4e8', transparent: true, opacity: 0.3, roughness: 0.06, metalness: 0.25, depthWrite: false }),
        // The canopy's roof: bronze-tinted glass, so it reads as a roof over the carpet.
        bhCanopyGlass = new Three.MeshStandardMaterial({ color: '#6f7f86', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.45, depthWrite: false }),
        // The lobby behind the glass, lit day and night.
        bhLobby = new Three.MeshStandardMaterial({ color: '#4d3a26', emissive: '#f1c27a', emissiveIntensity: 0.55, roughness: 0.6 });
      const bhRound = (parent, x, y, z, r, h, material) => mesh(bhRoundGeo, material, parent, x, y, z, r, h, r),
        // Clear glass casts no shadow (the carpet stays lit under the canopy).
        bhGlassy = (m) => ((m.castShadow = false), m);
      // Paving: travertine slabs framed in brass under the canopy, a granite kerb band.
      // Paving: warm travertine slabs, a darker diamond set in each (seen from the camera above).
      box(bhEntrance, bhx, 0.16, bhFace + 16, 124, 0.32, 32, staticMat('#c7b89a', 0.5));
      for (let dx = -56; dx <= 56; dx += 8) box(bhEntrance, bhx + dx, 0.34, bhFace + 16, 0.2, 0.04, 32, bhTravertineDark);
      for (let dz = 4; dz < 32; dz += 8) box(bhEntrance, bhx, 0.34, bhFace + dz, 124, 0.04, 0.2, bhTravertineDark);
      for (let dx = -52; dx <= 52; dx += 8)
        for (let dz = 8; dz < 32; dz += 8) {
          if (Math.abs(dx) < 12) continue;
          const d = box(bhEntrance, bhx + dx, 0.35, bhFace + dz, 2.2, 0.04, 2.2, staticMat('#8f7f63', 0.45));
          d.rotation.y = Math.PI / 4;
        }
      for (const dz of [1, 31]) box(bhEntrance, bhx, 0.36, bhFace + dz, 124, 0.06, 0.5, bhBrass);
      for (const dx of [-62, 62]) box(bhEntrance, bhx + dx, 0.36, bhFace + 16, 0.5, 0.06, 32, bhBrass);
      box(bhEntrance, bhx, 0.5, BHE.kerb - 1.2, 128, 1, 2.4, bhGranite);
      // The red carpet from the door to the kerb, gold-edged, with brass stair rods at the kerb.
      const cw = BHE.carpet.w;
      box(bhEntrance, bhx, 0.5, bhFace + 16.5, cw, 0.22, 33, bhCarpet);
      for (const side of [-1, 1]) box(bhEntrance, bhx + side * (cw / 2 - 0.8), 0.63, bhFace + 16.5, 0.7, 0.05, 33, bhBrass);
      box(bhEntrance, bhx, 0.66, bhFace + 32.4, cw + 0.6, 0.3, 0.4, bhBrass);
      // The portal: travertine pilasters and lintel round a lit lobby and its glass front.
      box(bhEntrance, bhx, 14, bhFace + 1.4, 58, 26, 0.6, bhLobby);
      for (const side of [-1, 1]) {
        box(bhEntrance, bhx + side * 32, 18, bhFace + 3, 7, 36, 3.6, bhTravertine);
        box(bhEntrance, bhx + side * 32, 1.5, bhFace + 3.2, 8.2, 3, 4.2, bhTravertineDark);
        box(bhEntrance, bhx + side * 32, 35, bhFace + 3.3, 8, 1.6, 4.2, bhBrass);
      }
      box(bhEntrance, bhx, 37.5, bhFace + 3, 72, 5, 3.8, bhTravertine);
      box(bhEntrance, bhx, 34.6, bhFace + 4.9, 72, 0.6, 0.4, bhBrass);
      // Glass front: brass mullions, the transom lit from behind.
      for (const dx of [-28, -16, 16, 28]) box(bhEntrance, bhx + dx, 13, bhFace + 2.3, 0.8, 26, 0.8, bhBrass);
      box(bhEntrance, bhx, 20.2, bhFace + 2.3, 58, 0.8, 0.8, bhBrass);
      box(bhEntrance, bhx, 0.8, bhFace + 2.3, 58, 1.6, 1, bhBrass);
      const bhFront = new Three.Mesh(new Three.PlaneGeometry(56, 26), bhClear);
      bhFront.position.set(bhx, 13, bhFace + 2.1);
      bhEntrance.add(bhGlassy(bhFront));
      // Swing doors either side of the drum: glass leaves, long brass push bars.
      for (const side of [-1, 1])
        for (const k of [-1, 1]) box(bhEntrance, bhx + side * 22 + k * 1.2, 9.5, bhFace + 2.9, 0.35, 11, 0.5, bhBrass);
      // The revolving door: a brass drum with glass sides; its four leaves turn (updateBlueHourEntrance).
      const drumZ = bhFace + 4.5,
        drumR = 9.5;
      bhRound(bhEntrance, bhx, 19.8, drumZ, drumR + 0.6, 1.8, bhBrass);
      bhRound(bhEntrance, bhx, 21, drumZ, drumR - 1, 0.8, bhNavy);
      bhRound(bhEntrance, bhx, 0.55, drumZ, drumR + 0.3, 0.5, bhBrass);
      for (const a of [0.5, Math.PI - 0.5]) {
        const drumGlass = new Three.Mesh(new Three.CylinderGeometry(drumR, drumR, 18, 20, 1, true, a, Math.PI / 2 - 0.5), bhClear);
        drumGlass.position.set(bhx, 10, drumZ);
        bhEntrance.add(bhGlassy(drumGlass));
      }
      const bhWings = new Three.Group();
      bhWings.userData.dynamic = true;
      bhWings.position.set(bhx, 0, drumZ);
      bhEntrance.add(bhWings);
      bhRound(bhWings, 0, 10, 0, 0.7, 18.4, bhBrass);
      for (let k = 0; k < 4; k++) {
        const wing = new Three.Group();
        wing.rotation.y = (k * Math.PI) / 2;
        bhWings.add(wing);
        const leaf = new Three.Mesh(boxGeo, bhClear);
        leaf.position.set(drumR / 2, 10, 0);
        leaf.scale.set(drumR - 1.4, 17, 0.3);
        wing.add(bhGlassy(leaf));
        box(wing, drumR / 2, 9, 0, drumR - 1.4, 0.5, 0.5, bhBrass);
        box(wing, drumR - 0.8, 10, 0, 0.5, 17, 0.5, bhBrass);
      }
      // The canopy: cantilevered from the wall on two brass consoles (no posts on
      // the pavement), a glass roof in a brass frame, a navy fascia ringed with bulbs.
      const C = BHE.canopy,
        ccx = C.x + C.w / 2,
        cz0 = bhFace + 2,
        cz1 = bhFace + C.depth,
        cy = C.underside;
      bhGlassy(box(bhEntrance, ccx, cy + 1.4, (cz0 + cz1) / 2, C.w - 2, 0.4, cz1 - cz0 - 2, bhCanopyGlass));
      for (let dz = 7; dz < C.depth - 2; dz += 7) box(bhEntrance, ccx, cy + 1.6, bhFace + dz, C.w - 2, 0.6, 0.5, bhBrass);
      for (const dx of [-C.w / 2, C.w / 2]) box(bhEntrance, ccx + dx, cy + 1, (cz0 + cz1) / 2, 1.2, 2.2, cz1 - cz0, bhBrass);
      for (let dx = -C.w / 2 + 12.5; dx < C.w / 2; dx += 12.5) box(bhEntrance, ccx + dx, cy + 1.6, (cz0 + cz1) / 2, 0.5, 0.6, cz1 - cz0, bhBrass);
      box(bhEntrance, ccx, cy + 1, cz0 + 0.6, C.w + 1, 2.4, 1.2, bhBrass);
      box(bhEntrance, ccx, cy + 1.2, cz1, C.w + 1.4, 3.6, 1.2, bhNavy);
      box(bhEntrance, ccx, cy + 3.1, cz1, C.w + 1.8, 0.4, 1.6, bhBrass);
      box(bhEntrance, ccx, cy - 0.6, cz1, C.w + 1.8, 0.4, 1.6, bhBrass);
      for (let dx = -C.w / 2 + 2; dx <= C.w / 2 - 2; dx += 4) mesh(sphereGeo, warmLamp, bhEntrance, ccx + dx, cy + 1.2, cz1 + 0.8, 0.5, 0.5, 0.5);
      for (const side of [-1, 1]) {
        for (let dz = 5; dz < C.depth - 2; dz += 4) mesh(sphereGeo, warmLamp, bhEntrance, ccx + side * (C.w / 2 + 0.7), cy + 1, bhFace + dz, 0.45, 0.45, 0.45);
        rod(bhEntrance, new Three.Vector3(ccx + side * 40, 16, bhFace + 2.5), new Three.Vector3(ccx + side * 40, cy - 0.2, bhFace + 16), 0.55, bhBrass);
        box(bhEntrance, ccx + side * 40, 16, bhFace + 2.8, 3, 3, 1, bhBrass);
      }
      // Downlights under the canopy over the carpet.
      for (const dx of [-24, 0, 24]) for (const dz of [10, 22]) bhRound(bhEntrance, ccx + dx, cy - 0.1, bhFace + dz, 1.1, 0.3, warmLamp);
      halo(bhEntrance, ccx, cy - 3, bhFace + 16, 26, '#ffd9a0');
      // The name in lit letters standing on the canopy's front edge; the hotel's board higher up the facade.
      const bhCanopySign = sign('THE BLUE HOUR', bhx, cz1 - 0.2, 48, '#9fdad8');
      bhCanopySign.position.y = cy + 9.5;
      bhCanopySign.userData.backing.position.y = cy + 9.5;
      bhCanopySign.userData.backing.position.z = cz1 - 1.6;
      const entrySign = sign('BLUE HOUR HOTEL', bhx, bhFace + 3, 150, '#d4c4a1');
      entrySign.position.y = 64;
      entrySign.userData.backing.position.y = 64;
      // Wall sconces on the pilasters.
      for (const side of [-1, 1]) {
        const x = bhx + side * 32;
        box(bhEntrance, x, 24, bhFace + 5.2, 2.2, 3.4, 1.6, bhBrass);
        mesh(sphereGeo, warmLamp, bhEntrance, x, 25.6, bhFace + 5.6, 0.9, 1.2, 0.9);
        halo(bhEntrance, x, 25.6, bhFace + 6.5, 9, '#ffe0a8');
      }
      // Topiary in travertine planters: spirals by the door, standards further out.
      for (const p of BHE.planters) {
        box(bhEntrance, p.x, 3.4, p.y, 8.4, 6.8, 8.4, bhTravertine);
        box(bhEntrance, p.x, 6.5, p.y, 8.8, 0.6, 8.8, bhBrass);
        box(bhEntrance, p.x, 0.5, p.y, 9.2, 1, 9.2, bhTravertineDark);
        box(bhEntrance, p.x, 6.9, p.y, 7.6, 0.3, 7.6, staticMat('#3a2a20', 0.95));
        if (p.kind === 'spiral') {
          box(bhEntrance, p.x, 12, p.y, 0.6, 10, 0.6, bhWood);
          [
            [9.2, 3.4],
            [14.4, 2.7],
            [18.8, 2],
            [22.2, 1.3],
          ].forEach(([y, r], i) => mesh(sphereGeo, i % 2 ? bhBoxLight : bhBox, bhEntrance, p.x, y, p.y, r, r * 0.85, r));
          mesh(sphereGeo, bhBox, bhEntrance, p.x, 24.4, p.y, 0.7, 1, 0.7);
        } else {
          box(bhEntrance, p.x, 11, p.y, 0.8, 9, 0.8, bhWood);
          mesh(sphereGeo, bhBox, bhEntrance, p.x, 17.5, p.y, 4.4, 4.2, 4.4);
          for (let k = 0; k < 6; k++) {
            const a = (k * TAU) / 6;
            mesh(sphereGeo, bhBoxLight, bhEntrance, p.x + Math.cos(a) * 3, 18.4 + (k % 2) * 1.4, p.y + Math.sin(a) * 3, 1.6, 1.4, 1.6);
          }
        }
      }
      // Brass rope posts and red velvet ropes to the door.
      for (const side of [-1, 1]) {
        const posts = BHE.stanchions.filter((p) => Math.sign(p.x - bhx) === side);
        for (const p of posts) {
          bhRound(bhEntrance, p.x, 0.5, p.y, 1.4, 0.6, bhBrass);
          bhRound(bhEntrance, p.x, 4.2, p.y, 0.35, 7.2, bhBrass);
          mesh(sphereGeo, bhBrass, bhEntrance, p.x, 8, p.y, 0.7, 0.7, 0.7);
        }
        const [a, b] = posts,
          mid = new Three.Vector3((a.x + b.x) / 2, 5.4, (a.y + b.y) / 2);
        rod(bhEntrance, new Three.Vector3(a.x, 7.2, a.y), mid, 0.32, bhRope);
        rod(bhEntrance, mid, new Three.Vector3(b.x, 7.2, b.y), 0.32, bhRope);
      }
      // Brass bollards on the kerb, a lit band under the dome.
      for (const p of BHE.bollards) {
        bhRound(bhEntrance, p.x, 3.4, p.y, 1.05, 6.8, bhBrass);
        mesh(sphereGeo, bhBrass, bhEntrance, p.x, 6.8, p.y, 1.05, 0.8, 1.05);
        bhRound(bhEntrance, p.x, 5.6, p.y, 1.1, 0.5, warmLamp);
      }
      // Lantern standards past the canopy's ends.
      for (const p of BHE.lamps) {
        box(bhEntrance, p.x, 1, p.y, 3.4, 2, 3.4, bhGranite);
        bhRound(bhEntrance, p.x, 14, p.y, 0.6, 26, bhIron);
        bhRound(bhEntrance, p.x, 4, p.y, 1.1, 4, bhIron);
        box(bhEntrance, p.x, 28.5, p.y, 3.4, 5, 3.4, bhBrass);
        box(bhEntrance, p.x, 28.5, p.y, 2.6, 4.2, 3.6, warmLamp);
        box(bhEntrance, p.x, 28.5, p.y, 3.6, 4.2, 2.6, warmLamp);
        mesh(new Three.ConeGeometry(2.6, 2.4, 4), bhIron, bhEntrance, p.x, 32.2, p.y).rotation.y = Math.PI / 4;
        halo(bhEntrance, p.x, 28.5, p.y, 16, '#ffd9a0');
      }
      // The valet's podium: walnut and brass, a key box and a reading lamp.
      const vs = BHE.valetStand;
      box(bhEntrance, vs.x, 4.4, vs.y, 5.4, 8.8, 3.6, bhWood);
      box(bhEntrance, vs.x, 9, vs.y, 6, 0.5, 4.2, bhBrass);
      box(bhEntrance, vs.x, 4.4, vs.y - 1.9, 4.2, 6.8, 0.2, bhBrass);
      box(bhEntrance, vs.x + 1.6, 10.2, vs.y + 0.6, 2, 1.8, 1.2, bhNavy);
      bhRound(bhEntrance, vs.x - 1.8, 10.6, vs.y, 0.18, 2.6, bhBrass);
      mesh(sphereGeo, warmLamp, bhEntrance, vs.x - 1.8, 12, vs.y + 0.5, 0.6, 0.45, 0.6);
      statics.push({ x: bhx, y: bhFace + 16, group: bhEntrance, radius: 120 });
      function updateBlueHourEntrance() {
        // One slow turn every 12 s (a guest pushing through, not a turbine).
        if (bhEntrance.visible !== false) bhWings.rotation.y = -gameTime * 0.52;
      }
