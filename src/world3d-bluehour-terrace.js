      // The Blue Hour terrace in 3D (mission 2): teak deck, travertine and brass, glass balustrade, pool and loungers,
      // marble bar, velvet lounges, clipped planters, palms, festoon lights; the VIP table is world3d-bluehour-table.js.
      /* Roof-local units (x east, z south from the block's corner; y 0 the roof slab, the
         deck's top at 2.8, a guest's feet at 3). One look throughout: teak, travertine,
         brass, navy velvet and cream. Every solid piece stands inside its roofCover
         footprint (roofmission-layout.js: collision and the guards' sight), or in the
         14-unit band along the balustrade that nobody walks (roofPointFree). The group
         is batched (one draw per material); only the reserved glass stays live. */
      const roofGroup = new Three.Group();
      roofGroup.name = 'Blue Hour rooftop';
      scene.add(roofGroup);
      batchGroups.push(roofGroup);
      roofGroup.position.set(ROOFTOP.x, ROOFTOP.height, ROOFTOP.y);
      const rw = ROOFTOP.w,
        rh = ROOFTOP.h,
        teak = staticMat('#8a6647', 0.6),
        teakSeam = staticMat('#5b4331', 0.75),
        ivory = staticMat('#e6dcc8', 0.55),
        stoneDark = staticMat('#cbbd9f', 0.6),
        navy = staticMat('#1f2d47', 0.88),
        lacquer = staticMat('#1a2740', 0.32, 0.2),
        brass = staticMat('#c9a35f', 0.3, 0.75),
        cushion = staticMat('#efe7d6', 0.88),
        gold = staticMat('#c9a24e', 0.6, 0.2),
        emerald = staticMat('#1f4a3c', 0.85),
        marble = staticMat('#17181b', 0.16, 0.25),
        iron = staticMat('#1d1f22', 0.45, 0.6),
        boxwood = staticMat('#3a5634', 0.9),
        boxwoodLight = staticMat('#4a6a41', 0.9),
        bloom = staticMat('#f3eee6', 0.8),
        soil = staticMat('#3a2a20', 0.95),
        mirror = staticMat('#34495a', 0.08, 0.85),
        palmDark = staticMat('#2e5a3e', 0.8),
        palmLight = staticMat('#4b7b4e', 0.8),
        trunk = staticMat('#76624c', 0.9),
        poolMat = new Three.MeshStandardMaterial({
          color: '#3fa6b4',
          roughness: 0.12,
          metalness: 0.3,
          emissive: '#15515a',
          emissiveIntensity: 0.25,
        }),
        bottleMats = [staticMat('#3f6b52', 0.2), staticMat('#b89463', 0.22), staticMat('#7796a2', 0.2), staticMat('#5a1e2a', 0.2)],
        roundGeo = new Three.CylinderGeometry(1, 1, 1, 14),
        // Clear glass (not batched): the balustrade's panes.
        clearGlass = new Three.MeshStandardMaterial({ color: '#cfe4e8', transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.2, depthWrite: false }),
        // Crystal and china for the tables: opaque (batched), double-sided so an open bowl shows its drink.
        crystal = new Three.MeshStandardMaterial({ color: '#e3eef0', roughness: 0.06, metalness: 0.55, side: Three.DoubleSide }),
        bowlGeo = new Three.CylinderGeometry(1, 0.72, 1, 16, 1, true);
      const round = (parent, x, y, z, r, h, material) => mesh(roundGeo, material, parent, x, y, z, r, h, r),
        unshadowed = (m) => ((m.castShadow = false), m);
      // ---- Deck: teak boards, a travertine band under the balustrade, stone and lacquer zones.
      box(roofGroup, rw / 2, 1.3, rh / 2, rw - 8, 2.6, rh - 8, teak);
      for (let z = 10; z < rh - 8; z += 4) box(roofGroup, rw / 2, 2.62, z, rw - 12, 0.05, 0.25, teakSeam);
      for (const z of [11, rh - 11]) box(roofGroup, rw / 2, 2.7, z, rw - 8, 0.2, 14, ivory);
      for (const x of [11, rw - 11]) box(roofGroup, x, 2.7, rh / 2, 14, 0.2, rh - 36, ivory);
      for (const z of [18.2, rh - 18.2]) box(roofGroup, rw / 2, 2.82, z, rw - 36, 0.06, 0.5, brass);
      for (const x of [18.2, rw - 18.2]) box(roofGroup, x, 2.82, rh / 2, 0.5, 0.06, rh - 36, brass);
      // The lounge: pale stone; the VIP corner: slate framed in brass; the dance floor: navy lacquer.
      function zone(x, z, w, d, material) {
        box(roofGroup, x, 2.75, z, w, 0.12, d, material);
        for (const dz of [-d / 2, d / 2]) box(roofGroup, x, 2.84, z + dz, w, 0.06, 0.5, brass);
        for (const dx of [-w / 2, w / 2]) box(roofGroup, x + dx, 2.84, z, 0.5, 0.06, d, brass);
      }
      zone(84, 161, 140, 96, staticMat('#d8ccb4', 0.6));
      for (let x = 14 + 14; x < 154; x += 14) box(roofGroup, x, 2.82, 161, 0.2, 0.03, 96, stoneDark);
      zone(285, 122, 98, 123, staticMat('#3b4450', 0.45, 0.1));
      zone(195, 247, 100, 90, lacquer);
      // ---- Balustrade: travertine plinth, frameless glass, a round brass handrail.
      for (const z of [6, rh - 6]) {
        box(roofGroup, rw / 2, 3.8, z, rw - 10, 2, 3, ivory);
        unshadowed(box(roofGroup, rw / 2, 8.8, z, rw - 12, 8, 0.5, clearGlass));
        rod(roofGroup, new Three.Vector3(5, 13, z), new Three.Vector3(rw - 5, 13, z), 0.55, brass);
      }
      for (const x of [6, rw - 6]) {
        box(roofGroup, x, 3.8, rh / 2, 3, 2, rh - 10, ivory);
        unshadowed(box(roofGroup, x, 8.8, rh / 2, 0.5, 8, rh - 12, clearGlass));
        rod(roofGroup, new Three.Vector3(x, 13, 5), new Three.Vector3(x, 13, rh - 5), 0.55, brass);
      }
      for (let x = 15; x < rw; x += 30) for (const z of [6, rh - 6]) round(roofGroup, x, 8.5, z, 0.45, 9, brass);
      for (let z = 35; z < rh - 20; z += 30) for (const x of [6, rw - 6]) round(roofGroup, x, 8.5, z, 0.45, 9, brass);
      // ---- Along the balustrade (the band nobody walks): clipped troughs and brass lanterns.
      function trough(x, z, length, along) {
        const w = along ? length : 5,
          d = along ? 5 : length;
        box(roofGroup, x, 5.3, z, w, 5, d, ivory);
        box(roofGroup, x, 7.9, z, w + 0.4, 0.4, d + 0.4, brass);
        box(roofGroup, x, 9.4, z, w - 0.8, 2.8, d - 0.8, boxwood);
        for (let k = 2; k < length - 1; k += 3.2) {
          const bx = along ? x - length / 2 + k : x,
            bz = along ? z : z - length / 2 + k;
          mesh(sphereGeo, k % 6.4 < 3.2 ? boxwoodLight : boxwood, roofGroup, bx, 10.9, bz, 1.7, 1.2, 1.7);
          if (k % 9.6 < 3.2) mesh(sphereGeo, bloom, roofGroup, bx + (along ? 0.8 : 1.2), 11.9, bz + (along ? 1.2 : 0.8), 0.55, 0.45, 0.55);
        }
      }
      function lantern(x, z, lit) {
        box(roofGroup, x, 4.4, z, 3.2, 3.2, 3.2, ivory);
        box(roofGroup, x, 8.3, z, 2.6, 4.6, 2.6, brass);
        box(roofGroup, x, 8.3, z, 1.9, 3.8, 2.8, warmLamp);
        box(roofGroup, x, 8.3, z, 2.8, 3.8, 1.9, warmLamp);
        mesh(new Three.ConeGeometry(2, 1.8, 4), brass, roofGroup, x, 11.5, z).rotation.y = Math.PI / 4;
        if (lit) halo(roofGroup, x, 8.5, z, 12, '#ffd9a0');
      }
      for (const [x0, x1] of [
        [66, 186],
        [322, 344],
      ])
        for (let x = x0; x + 20 <= x1; x += 26) trough(x + 10, 10.5, 20, true);
      for (let z = 64; z + 30 <= 336; z += 36) trough(rw - 10.5, z + 15, 30, false);
      for (let x = 72; x + 30 <= 344; x += 36) trough(x + 15, rh - 10.5, 30, true);
      for (let z = 120; z + 30 <= 262; z += 36) trough(10.5, z + 15, 30, false);
      for (const [x, z, lit] of [
        [12, 12, true],
        [rw - 12, 12, true],
        [rw - 12, rh - 12, true],
        [12, rh - 12, true],
        [194, 11, false],
        [rw - 11, 58, false],
        [rw - 11, 206, true],
        [66, rh - 11, false],
        [210, rh - 11, true],
        [11, 114, false],
      ])
        lantern(x, z, lit);
      // Sun loungers beside the pool on the west band, a furled parasol between each pair.
      function lounger(x, z) {
        box(roofGroup, x, 3.9, z, 5.2, 0.8, 15, teak);
        for (const dz of [-6.4, 6.4]) for (const dx of [-2.2, 2.2]) box(roofGroup, x + dx, 3.2, z + dz, 0.6, 1.4, 0.6, teak);
        box(roofGroup, x, 4.7, z + 2.2, 4.6, 0.8, 10.2, cushion);
        const back = box(roofGroup, x, 6.2, z - 5.4, 4.6, 0.8, 5.4, cushion);
        back.rotation.x = 0.6;
        box(roofGroup, x, 5.2, z + 3, 4.7, 0.3, 1.2, navy);
      }
      for (const z of [34, 54, 82, 102]) lounger(10.5, z);
      for (const z of [68, 118]) {
        round(roofGroup, 10.5, 12, z, 0.35, 18, brass);
        mesh(new Three.ConeGeometry(1.4, 11, 8), cushion, roofGroup, 10.5, 17, z);
        round(roofGroup, 10.5, 3.4, z, 1.6, 1, iron);
      }
      // ---- The solid pieces, each in its roofCover footprint.
      for (const p of roofCover) {
        const x = p.x - ROOFTOP.x + p.w / 2,
          z = p.y - ROOFTOP.y + p.h / 2;
        if (p.kind === 'pool') {
          // Travertine coping, a darker lip, mosaic lanes, chrome ladders.
          box(roofGroup, x, 3.2, z, p.w, 1.2, p.h, ivory);
          box(roofGroup, x, 3.85, z, p.w - 10, 0.2, p.h - 10, stoneDark);
          box(roofGroup, x, 3.9, z, p.w - 12, 0.35, p.h - 12, poolMat);
          for (let i = -1; i <= 1; i++) box(roofGroup, x + i * 29, 4.11, z, 0.8, 0.06, p.h - 13, staticMat('#94d9d7'));
          for (const side of [-1, 1]) {
            rod(roofGroup, new Three.Vector3(x + 38, 5, z + side * 6), new Three.Vector3(x + 46, 8, z + side * 6), 0.5, chrome);
            box(roofGroup, x + 39, 4.5, z + side * 6, 0.7, 1, 1, chrome);
          }
        } else if (p.kind === 'lift') {
          // A travertine lift house: brass doors to the east, a lit call button, lanterns.
          box(roofGroup, x, 17, z, p.w, 34, p.h, ivory);
          for (let y = 8; y < 32; y += 6) box(roofGroup, x, y, z, p.w + 0.4, 0.3, p.h + 0.4, stoneDark);
          box(roofGroup, x, 34.6, z, p.w + 3, 1.4, p.h + 3, lacquer);
          box(roofGroup, x, 35.6, z, p.w + 3.4, 0.5, p.h + 3.4, brass);
          box(roofGroup, x + p.w / 2 + 0.4, 12, z, 1, 19, 17, brass);
          box(roofGroup, x + p.w / 2 + 0.9, 12, z, 0.3, 19, 0.3, lacquer);
          box(roofGroup, x + p.w / 2 + 0.6, 12, z, 1.2, 22, 20, stoneDark);
          box(roofGroup, x + p.w / 2 + 1, 12, z + 12, 0.6, 2, 1.2, warmLamp);
          for (const dz of [-14, 14]) {
            box(roofGroup, x + p.w / 2 + 1, 20, z + dz, 1.4, 3.2, 2, brass);
            mesh(sphereGeo, warmLamp, roofGroup, x + p.w / 2 + 1.6, 20.6, z + dz, 0.8, 1.1, 0.8);
          }
        } else if (p.kind === 'bar') {
          // Back bar: lacquered cabinet, mirror, three lit shelves of bottles.
          const back = p.y - ROOFTOP.y,
            front = back + p.h;
          box(roofGroup, x, 12.4, back + 3, p.w, 19.2, 6, lacquer);
          box(roofGroup, x, 13, back + 6.1, p.w - 6, 13, 0.2, mirror);
          for (const [k, y] of [9.6, 13.6, 17.6].entries()) {
            box(roofGroup, x, y, back + 6.8, p.w - 6, 0.35, 1.6, brass);
            box(roofGroup, x, y - 0.3, back + 7.4, p.w - 6, 0.12, 0.3, warmLamp);
            for (let i = 0; i < 26; i++) {
              const bx = x - p.w / 2 + 5 + i * 4.3 + (k % 2) * 1.6;
              if ((i * 7 + k * 3) % 11 === 0) continue;
              round(roofGroup, bx, y + 1.4, back + 6.8, 0.6, 2.5, bottleMats[(i + k) % 4]);
              round(roofGroup, bx, y + 3, back + 6.8, 0.22, 0.9, bottleMats[(i + k) % 4]);
            }
          }
          box(roofGroup, x, 22.2, back + 3, p.w + 1, 0.6, 7, brass);
          // Counter: fluted lacquer front, brass kick and foot rail, black marble top.
          box(roofGroup, x, 7, front - 5, p.w, 8.4, 10, lacquer);
          for (let dx = -p.w / 2 + 1.5; dx < p.w / 2; dx += 2.5) box(roofGroup, x + dx, 7.3, front + 0.1, 1.1, 7.2, 0.4, navy);
          box(roofGroup, x, 3.5, front + 0.2, p.w, 1.2, 0.6, brass);
          box(roofGroup, x, 11.6, front - 5, p.w + 2, 0.8, 11.4, marble);
          box(roofGroup, x, 11.25, front + 0.8, p.w + 2, 0.25, 0.3, brass);
          rod(roofGroup, new Three.Vector3(x - p.w / 2, 4.6, front + 1.6), new Three.Vector3(x + p.w / 2, 4.6, front + 1.6), 0.3, brass);
          // Cocktails and shakers on the marble.
          for (let i = 0; i < 9; i++) {
            const gx = x - p.w / 2 + 9 + i * 12.5,
              gz = front - 2.5;
            round(roofGroup, gx, 12.1, gz, 0.4, 0.1, crystal);
            round(roofGroup, gx, 12.7, gz, 0.08, 1.1, crystal);
            mesh(bowlGeo, crystal, roofGroup, gx, 13.6, gz, 0.9, 0.7, 0.9);
            round(roofGroup, gx, 13.5, gz, 0.7, 0.3, [staticMat('#d9a441', 0.2), staticMat('#b8243a', 0.2), staticMat('#8fd0c8', 0.2)][i % 3]);
            if (i % 4 === 1) round(roofGroup, gx + 4, 13.4, gz - 2, 0.55, 2.6, chrome);
          }
          // Brass-footed stools with velvet seats and low backs.
          for (let i = 0; i < 6; i++) {
            const sx = x - p.w / 2 + 16 + i * 17.2,
              sz = front + 4.2;
            round(roofGroup, sx, 3.05, sz, 1.8, 0.3, brass);
            round(roofGroup, sx, 6, sz, 0.35, 6, brass);
            round(roofGroup, sx, 6.2, sz, 1.5, 0.25, brass);
            round(roofGroup, sx, 9.4, sz, 2, 1, navy);
            box(roofGroup, sx, 11.4, sz + 1.7, 3.4, 3, 0.5, navy);
            box(roofGroup, sx, 12.9, sz + 1.7, 3.6, 0.3, 0.7, brass);
          }
          // Pendant globes from a brass beam.
          box(roofGroup, x, 35, z - 8, p.w, 1.4, 1.6, brass);
          for (let i = -2; i <= 2; i++) {
            round(roofGroup, x + i * 22, 30.5, z - 8, 0.12, 8, brass);
            mesh(sphereGeo, warmLamp, roofGroup, x + i * 22, 26, z - 8, 1.5, 1.5, 1.5);
            halo(roofGroup, x + i * 22, 26, z - 8, 13, '#edd1a0');
          }
        } else if (p.kind === 'hedge') {
          // Travertine planter with a brass band, the boxwood clipped round on top.
          box(roofGroup, x, 6.8, z, p.w, 8, p.h, ivory);
          box(roofGroup, x, 3.4, z, p.w + 0.8, 1.2, p.h + 0.8, stoneDark);
          box(roofGroup, x, 10.9, z, p.w + 0.6, 0.5, p.h + 0.6, brass);
          box(roofGroup, x, 15.8, z, p.w - 1.4, 9.4, p.h - 1.4, boxwood);
          const along = p.w > p.h,
            steps = Math.ceil(Math.max(p.w, p.h) / 6);
          for (let i = 0; i < steps; i++) {
            const hx = along ? p.x - ROOFTOP.x + 3 + i * 6 : x,
              hz = along ? z : p.y - ROOFTOP.y + 3 + i * 6;
            mesh(sphereGeo, i % 2 ? boxwoodLight : boxwood, roofGroup, hx, 20.5, hz, along ? 3.6 : 4.8, 2.4, along ? 4.8 : 3.6);
            if (i % 3 === 1) mesh(sphereGeo, bloom, roofGroup, hx + 1.5, 22.6, hz - 1.2, 0.7, 0.6, 0.7);
          }
        } else if (p.kind === 'sofa') {
          // Channel-tufted navy velvet, cream cushions, gold and emerald pillows.
          const deep = Math.min(p.h, 11),
            back = p.y - ROOFTOP.y,
            sz = back + deep / 2;
          box(roofGroup, x, 4.4, sz, p.w, 3.2, deep, navy);
          for (const dx of [-p.w / 2 + 1, p.w / 2 - 1]) for (const dz of [-deep / 2 + 1, deep / 2 - 1]) box(roofGroup, x + dx, 2.9, sz + dz, 0.6, 0.6, 0.6, brass);
          box(roofGroup, x, 8.8, back + 1.3, p.w, 6, 2.6, navy);
          for (let dx = -p.w / 2 + 3; dx < p.w / 2 - 1; dx += 3) box(roofGroup, x + dx, 8.6, back + 2.65, 0.25, 5, 0.1, lacquer);
          for (const dx of [-p.w / 2 + 1.1, p.w / 2 - 1.1]) box(roofGroup, x + dx, 6.6, sz, 2.2, 3.6, deep, navy);
          const seats = Math.max(2, Math.floor(p.w / 11)),
            seatW = (p.w - 4.4) / seats;
          for (let i = 0; i < seats; i++) {
            const cx = x - p.w / 2 + 2.2 + seatW * (i + 0.5);
            box(roofGroup, cx, 6.7, sz + 1.2, seatW - 0.5, 1.4, deep - 3.6, cushion);
            const pillow = box(roofGroup, cx + (i % 2 ? 1.5 : -1.5), 8.4, back + 3.6, 3, 2.8, 0.9, i % 2 ? emerald : gold);
            pillow.rotation.z = i % 2 ? 0.25 : -0.2;
          }
          // Room in front (the long sofa): a travertine table with a candle and glasses.
          if (p.h - deep > 9) {
            const tz = back + deep + (p.h - deep) / 2 + 0.5;
            box(roofGroup, x, 4.4, tz, p.w * 0.55, 0.8, 7, ivory);
            box(roofGroup, x, 3.4, tz, p.w * 0.45, 1.2, 5, stoneDark);
            round(roofGroup, x - 5, 5.4, tz, 0.5, 1.2, cushion);
            mesh(sphereGeo, warmLamp, roofGroup, x - 5, 6.2, tz, 0.2, 0.35, 0.2);
            for (const dx of [2, 5])
              for (const [y, r, h, material] of [
                [4.9, 0.3, 0.1, crystal],
                [5.6, 0.07, 1.2, crystal],
              ])
                round(roofGroup, x + dx, y, tz, r, h, material);
            for (const dx of [2, 5]) {
              mesh(bowlGeo, crystal, roofGroup, x + dx, 6.6, tz, 0.55, 0.8, 0.55);
              round(roofGroup, x + dx, 6.5, tz, 0.45, 0.35, staticMat('#e8d28c', 0.2));
            }
            halo(roofGroup, x - 5, 6.4, tz, 5, '#ffd9a0');
          }
        } else if (p.kind === 'buffet') {
          // Linen to the floor, chafing dishes, a champagne tower at the end.
          box(roofGroup, x, 6.4, z, p.w, 7.2, p.h, staticMat('#f4f0e7', 0.92));
          box(roofGroup, x, 10.1, z, p.w + 0.8, 0.3, p.h + 0.8, staticMat('#f4f0e7', 0.92));
          box(roofGroup, x, 10.3, z, p.w - 2, 0.1, 3, navy);
          for (const dx of [-13, -4]) {
            box(roofGroup, x + dx, 10.9, z, 7, 0.9, 5, brass);
            const dome = mesh(sphereGeo, chrome, roofGroup, x + dx, 11.6, z, 3.2, 1.8, 2.3);
            dome.scale.y = 1.6;
          }
          const ty = 10.4,
            tx = x + 11;
          for (let tier = 0; tier < 4; tier++) {
            const n = 4 - tier;
            for (let i = 0; i < n; i++)
              for (let j = 0; j < n; j++) {
                const gx = tx + (i - (n - 1) / 2) * 1.5,
                  gz = z + (j - (n - 1) / 2) * 1.5,
                  gy = ty + tier * 1.3;
                round(roofGroup, gx, gy + 0.35, gz, 0.1, 0.7, crystal);
                round(roofGroup, gx, gy + 0.95, gz, 0.72, 0.4, staticMat('#e8d28c', 0.2));
              }
          }
          round(roofGroup, x - 18, 11.2, z - 4, 1, 2, crystal);
          for (const [dx, dz, material] of [
            [0, 0, bloom],
            [0.8, 0.5, staticMat('#e8b4b8', 0.8)],
            [-0.7, 0.4, bloom],
            [0.2, -0.8, staticMat('#e8b4b8', 0.8)],
          ])
            mesh(sphereGeo, material, roofGroup, x - 18 + dx, 13, z - 4 + dz, 0.9, 0.8, 0.9);
        } else if (p.kind === 'dj') {
          box(roofGroup, x, 5.8, z, p.w, 6, p.h, lacquer);
          for (let dx = -p.w / 2 + 2; dx < p.w / 2; dx += 3) box(roofGroup, x + dx, 5.8, z + p.h / 2 + 0.1, 1.2, 5.2, 0.3, navy);
          box(roofGroup, x, 8.9, z, p.w + 0.6, 0.4, p.h + 0.6, brass);
          box(roofGroup, x, 11, z - 3, p.w - 26, 4, 10, marble);
          for (const dx of [-23, 23]) {
            round(roofGroup, x + dx, 13.3, z - 3, 4.4, 0.6, chrome);
            round(roofGroup, x + dx, 13.7, z - 3, 3.4, 0.2, darkMetal);
          }
          box(roofGroup, x, 13.3, z - 3, 11, 0.8, 6, chrome);
          for (const dx of [-p.w / 2 + 6, p.w / 2 - 6]) {
            box(roofGroup, x + dx, 16, z, 10, 22, 10, iron);
            box(roofGroup, x + dx, 27.2, z, 10.4, 0.4, 10.4, brass);
            for (const h of [12, 21]) {
              const speaker = round(roofGroup, x + dx, h, z + 5.1, 3.3, 0.8, rubber);
              speaker.rotation.x = Math.PI / 2;
              round(roofGroup, x + dx, h, z + 5.5, 1.2, 0.2, brass).rotation.x = Math.PI / 2;
            }
          }
        }
      }
      // @include src/world3d-bluehour-table.js
      const danceTiles = [];
      for (let x = 0; x < 6; x++)
        for (let z = 0; z < 5; z++) {
          const material = new Three.MeshStandardMaterial({
            color: (x + z) % 2 ? '#3f6a78' : '#6c5578',
            emissive: (x + z) % 2 ? '#355b68' : '#62365e',
            emissiveIntensity: 0.35,
            roughness: 0.22,
          });
          danceTiles.push(box(roofGroup, 158 + x * 14, 2.95, 217 + z * 15, 13, 0.2, 14, material));
        }
      // Festoon lights on iron posts with brass finials: a ceiling for the party that hides nothing.
      for (const z of [186, 289]) {
        for (const x of [22, 337]) {
          round(roofGroup, x, 22, z, 0.7, 44, iron);
          round(roofGroup, x, 3.6, z, 1.6, 1.4, iron);
          mesh(sphereGeo, brass, roofGroup, x, 44.6, z, 1, 1, 1);
        }
        for (let i = 0; i < 15; i++) {
          const x = 22 + i * 22.5,
            y = 42 - Math.sin((i / 14) * Math.PI) * 5;
          rod(roofGroup, new Three.Vector3(x, y, z), new Three.Vector3(x + 22.5, 42 - Math.sin(((i + 1) / 14) * Math.PI) * 5, z), 0.16, iron);
          if (i < 14) {
            mesh(sphereGeo, warmLamp, roofGroup, x, y - 1.2, z, 0.9, 1.2, 0.9);
            if (i % 2 === 0) halo(roofGroup, x, y - 1.2, z, 12, '#efd6a2');
          }
        }
      }
      // Palms growing out of three of the planters: a ringed trunk and a drooping crown.
      for (const [x, z, lean] of [
        [92, 204, 0.08],
        [300, 204, -0.06],
        [283, 263, 0.05],
      ]) {
        const palm = new Three.Group();
        palm.position.set(x, 10, z);
        palm.rotation.z = lean;
        roofGroup.add(palm);
        for (let k = 0; k < 8; k++) round(palm, Math.sin(k * 0.5) * 0.3, 1.8 + k * 3.2, 0, 1.25 - k * 0.05, 3.3, k % 2 ? trunk : staticMat('#8a7458', 0.9));
        mesh(sphereGeo, staticMat('#6a5a40', 0.9), palm, 0, 27, 0, 1.6, 1.4, 1.6);
        for (let k = 0; k < 11; k++) {
          const frond = new Three.Group();
          frond.position.y = 27.5;
          frond.rotation.y = (k * TAU) / 11 + (k % 2) * 0.2;
          palm.add(frond);
          const inner = box(frond, 4, 1, 0, 8, 0.25, 2.2 + (k % 3) * 0.3, k % 2 ? palmLight : palmDark);
          inner.rotation.z = 0.22;
          const outer = box(frond, 11, -0.6, 0, 7.5, 0.22, 1.8, k % 2 ? palmDark : palmLight);
          outer.rotation.z = -0.42;
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
      statics.push({
        x: ROOFTOP.x + rw / 2,
        y: ROOFTOP.y + rh / 2,
        group: roofGroup,
        radius: 300,
      });
      // @include src/world3d-bluehour-entrance.js
      // Each frame (updateWorldVisuals): the reserved glass, the pool's shimmer, the dance floor, the door.
      function blueHourFrame() {
        const hit = rooftopJob();
        updateBlueHourTable(hit);
        poolMat.emissiveIntensity = 0.22 + Math.sin(gameTime * 1.8) * 0.055;
        danceTiles.forEach((t, i) => (t.material.emissiveIntensity = hit?.partyPanic ? 0.08 : 0.23 + Math.sin(gameTime * 2.3 + i * 0.7) * 0.13));
        updateBlueHourEntrance();
      }
