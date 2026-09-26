      // Fort Sentinel buildings from SENTINEL.buildings (planOf): window rows and flags.
      const planOf = (id) => SENTINEL.buildings.find((b) => b.id === id);
      // Window rows on the south and north faces (and optionally east/west).
      function windowRows(b, rows, spacing, w, h, { skip = null, ends = true } = {}) {
        for (const y of rows) {
          for (let x = b.x + spacing * 0.7; x < b.x + b.w - spacing * 0.4; x += spacing) {
            if (skip && x > skip[0] && x < skip[1]) continue;
            for (const [z, s] of [
              [b.y + b.h, 1],
              [b.y, -1],
            ]) {
              box(baseGroup, x, y, z + s * 0.35, w, h, 0.6, B.window);
              box(baseGroup, x, y - h / 2 - 0.6, z + s * 0.9, w + 1.6, 0.8, 1.6, B.cream);
            }
          }
          if (ends)
            for (let z = b.y + spacing * 0.7; z < b.y + b.h - spacing * 0.4; z += spacing)
              for (const [x, s] of [
                [b.x, -1],
                [b.x + b.w, 1],
              ])
                box(baseGroup, x + s * 0.35, y, z, 0.6, h, w, B.window);
        }
      }
      // Headquarters: two storeys, portico, flagpoles in front.
      {
        const b = planOf('hq'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2;
        box(baseGroup, cx, 1.5, cz, b.w + 6, 3, b.h + 6, B.concreteLight);
        box(baseGroup, cx, 21, cz, b.w, 40, b.h, B.sand);
        box(baseGroup, cx, 19.5, cz, b.w + 1.2, 1.4, b.h + 1.2, B.sandDark);
        box(baseGroup, cx, 40.3, cz, b.w - 4, 0.6, b.h - 4, B.roofGrey);
        for (const [dx, dz, w, d] of [
          [0, -b.h / 2, b.w + 2, 2],
          [0, b.h / 2, b.w + 2, 2],
          [-b.w / 2, 0, 2, b.h],
          [b.w / 2, 0, 2, b.h],
        ])
          box(baseGroup, cx + dx, 42.5, cz + dz, w, 4, d, B.sandDark);
        windowRows(b, [11, 28], 20, 11, 9, { skip: [cx - 60, cx + 60] });
        // Portico: columns, canopy, steps, entrance glazing and the crest.
        const pz = b.y + b.h;
        box(baseGroup, cx, 20, pz + 1, 118, 38, 2, B.cream);
        for (let x = cx - 50; x <= cx + 50; x += 20) cylinder(baseGroup, x, 16, pz + 18, 2.4, 32, B.white, 12);
        box(baseGroup, cx, 33.5, pz + 11, 116, 3, 26, B.cream);
        box(baseGroup, cx, 37, pz + 11, 116, 4, 24, B.sandDark);
        box(baseGroup, cx, 12, pz + 2.3, 34, 22, 0.6, B.window);
        box(baseGroup, cx, 28, pz + 2.3, 70, 8, 0.6, B.window);
        for (let s = 0; s < 3; s++) box(baseGroup, cx, 0.8 + s * 1.2, pz + 26 + s * -3, 60 - s * 4, 1.6, 6, B.concreteLight);
        plate(baseGroup, cx, 37, pz + 23.2, 96, 5, plateMaterial('HEADQUARTERS · FORT SENTINEL', { w: 1024, h: 56, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        const crest = cylinder(baseGroup, cx, 28, pz + 2.6, 6, 0.8, B.yellow, 24);
        crest.rotation.x = Math.PI / 2;
        plate(baseGroup, cx, 28, pz + 3.1, 10, 10, B.star, 0);
        glowPool(cx, pz + 30, 60, '#ffe2b0', 1);
        baseHalo(cx, 31, pz + 20, 26, '#ffe8c0');
        // Roof plant: AC units, a stair head, antennas and a satellite dish.
        for (let x = b.x + 40; x < b.x + b.w - 30; x += 60) {
          box(baseGroup, x, 43.5, cz - 25, 18, 6, 12, B.steel);
          cylinder(baseGroup, x - 4, 46.8, cz - 25, 3.5, 0.6, B.black, 12);
          cylinder(baseGroup, x + 4, 46.8, cz - 25, 3.5, 0.6, B.black, 12);
        }
        box(baseGroup, b.x + b.w - 40, 45, cz + 20, 22, 9, 18, B.sandDark);
        rodTo(baseGroup, b.x + 50, 40, cz + 30, b.x + 50, 72, cz + 30, 0.5, B.galv);
        rodTo(baseGroup, b.x + 58, 40, cz + 30, b.x + 58, 64, cz + 30, 0.4, B.galv);
        const dish = cylinder(baseGroup, b.x + 90, 47, cz + 30, 6, 1, B.white, 16, 1.2);
        dish.rotation.z = -0.6;
        redBeacon(b.x + 50, 73, cz + 30, 2.2);
        // Parking lot: staff cars (static props).
        for (let i = 0; i < 3; i++) {
          const z = SENTINEL.hqLot.y + 31 + i * 38;
          box(baseGroup, SENTINEL.hqLot.x + 30, 5, z, 46, 7, 22, [B.oliveDark, B.cream, B.steel][i]);
          box(baseGroup, SENTINEL.hqLot.x + 28, 11, z, 24, 5, 19, B.window);
        }
      }
      // Flags (waving) on the poles in front of HQ and beside the stand.
      const flagTextures = {
        coast: baseTexture(128, 80, (g) => {
          for (let i = 0; i < 7; i++) {
            g.fillStyle = i % 2 ? '#f1eee4' : '#2f4e8c';
            g.fillRect(0, i * 11.5, 128, 11.5);
          }
          g.fillStyle = '#b8322a';
          g.fillRect(0, 0, 48, 46);
          g.fillStyle = '#f1eee4';
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 6 : 15,
              a = -Math.PI / 2 + (i * Math.PI) / 5;
            g.lineTo(24 + Math.cos(a) * r, 23 + Math.sin(a) * r);
          }
          g.fill();
        }, false),
        unit: baseTexture(128, 80, (g) => {
          g.fillStyle = '#3f4d34';
          g.fillRect(0, 0, 128, 80);
          g.fillStyle = '#d8b65a';
          g.fillRect(0, 0, 128, 7);
          g.fillRect(0, 73, 128, 7);
          g.beginPath();
          g.arc(64, 40, 22, 0, TAU);
          g.fill();
          g.fillStyle = '#3f4d34';
          g.font = 'bold 24px Arial';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('XII', 64, 41);
        }, false),
        base: baseTexture(128, 80, (g) => {
          g.fillStyle = '#1e2d44';
          g.fillRect(0, 0, 128, 80);
          g.fillStyle = '#e9d9a0';
          g.font = 'bold 15px Arial';
          g.textAlign = 'center';
          g.fillText('FORT', 64, 30);
          g.fillText('SENTINEL', 64, 52);
          g.strokeStyle = '#e9d9a0';
          g.lineWidth = 3;
          g.strokeRect(6, 6, 116, 68);
        }, false),
      };
      const flags = [];
      for (const p of SENTINEL.flagpoles) {
        cylinder(baseGroup, p.x, p.height / 2, p.y, 0.7, p.height, B.white, 8, 0.45);
        mesh(sphereGeo, B.yellow, baseGroup, p.x, p.height + 0.8, p.y, 1.1, 1.1, 1.1);
        box(baseGroup, p.x, 1, p.y, 6, 2, 6, B.concreteLight);
        const geo = new Three.PlaneGeometry(20, 12.5, 8, 1);
        geo.translate(10, 0, 0);
        const flag = new Three.Mesh(geo, new Three.MeshStandardMaterial({ map: flagTextures[p.flag], side: Three.DoubleSide, roughness: 0.85 }));
        flag.position.set(p.x + 0.6, p.height - 6.5, p.y);
        flag.castShadow = true;
        baseDynamic.add(flag);
        flags.push({ mesh: flag, base: geo.attributes.position.array.slice(), phase: p.x * 0.1 });
        glowPool(p.x, p.y, 20, '#fff1d8', 0.5);
      }
      // Barracks: two-storey blocks, gable roofs, a gallery on the south face.
      for (const id of ['barracks-a', 'barracks-b', 'barracks-c']) {
        const b = planOf(id),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2,
          wall = 22;
        box(baseGroup, cx, 1, cz, b.w + 4, 2, b.h + 4, B.concreteLight);
        box(baseGroup, cx, wall / 2, cz, b.w, wall, b.h, B.sand);
        box(baseGroup, cx, 11, cz, b.w + 0.8, 1, b.h + 0.8, B.sandDark);
        gableRoof(baseGroup, cx, wall, cz, b.w + 8, b.h + 10, 9, B.roofGreen);
        box(baseGroup, cx, wall + 9, cz, b.w + 8, 0.8, 1.6, B.oliveDark);
        windowRows(b, [6, 16.5], 18, 8, 5.5, { ends: false });
        // Gallery with railings on the south face; stair towers at both ends.
        const gz = b.y + b.h;
        box(baseGroup, cx, 11.5, gz + 5, b.w - 20, 1, 10, B.concreteLight);
        box(baseGroup, cx, 15.5, gz + 9.6, b.w - 20, 0.6, 0.6, B.galv);
        for (let x = b.x + 12; x <= b.x + b.w - 12; x += 16) {
          box(baseGroup, x, 13.5, gz + 9.6, 0.5, 4, 0.5, B.galv);
          box(baseGroup, x, 5.5, gz + 9.2, 1, 11, 1, B.cream);
        }
        for (const x of [b.x + 6, b.x + b.w - 6]) {
          box(baseGroup, x, 13, gz + 6, 12, 26, 12, B.sandDark);
          box(baseGroup, x, 27, gz + 6, 14, 1.4, 14, B.roofGreen);
          box(baseGroup, x, 4, gz + 12.2, 6, 8, 0.4, B.oliveDark);
        }
        for (let x = b.x + 60; x < b.x + b.w - 40; x += 90) box(baseGroup, x, 4.5, gz + 0.5, 6, 9, 0.6, B.oliveDark);
        // AC condensers along the north wall, vents on the roof.
        for (let x = b.x + 20; x < b.x + b.w - 10; x += 36) box(baseGroup, x, 2.5, b.y - 3.5, 8, 5, 5, B.steel);
        for (let x = b.x + 50; x < b.x + b.w; x += 100) cylinder(baseGroup, x, wall + 7, cz - 12, 1.5, 6, B.steel, 8);
        plate(baseGroup, b.x + 34, 20, gz + 12.3, 34, 5, plateMaterial(b.name, { w: 256, h: 40, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        glowPool(b.x + 6, gz + 18, 26, '#ffe0a8', 0.8);
        glowPool(b.x + b.w - 6, gz + 18, 26, '#ffe0a8', 0.8);
        glowPool(cx, gz + 12, 70, '#ffdca0', 0.5);
      }
      // Mess hall.
      {
        const b = planOf('mess'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2;
        box(baseGroup, cx, 1, cz, b.w + 4, 2, b.h + 4, B.concreteLight);
        box(baseGroup, cx, 10, cz, b.w, 20, b.h, B.sand);
        gableRoof(baseGroup, cx, 20, cz, b.w + 6, b.h + 6, 6, B.cladding);
        windowRows(b, [11], 16, 11, 7, { skip: [cx - 30, cx + 30], ends: false });
        const fz = b.y + b.h;
        box(baseGroup, cx, 16, fz + 8, 60, 1.5, 16, B.olive);
        for (const dx of [-28, 28]) box(baseGroup, cx + dx, 8, fz + 15, 1.2, 16, 1.2, B.galv);
        box(baseGroup, cx, 7, fz + 0.4, 22, 14, 0.6, B.window);
        plate(baseGroup, cx, 18.5, fz + 16.3, 58, 5, plateMaterial('DINING FACILITY', { w: 512, h: 44, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        glowPool(cx, fz + 18, 45, '#ffe0a8', 1);
        // Kitchen: extract stacks, a loading dock with a roller door, bins.
        for (const x of [b.x + 30, b.x + 60, b.x + 90]) {
          cylinder(baseGroup, x, 26, b.y + 20, 2.4, 12, B.galv, 10);
          cylinder(baseGroup, x, 32.5, b.y + 20, 3.4, 1.2, B.galv, 10);
        }
        box(baseGroup, b.x + b.w - 40, 2, b.y - 8, 40, 4, 16, B.concreteLight);
        box(baseGroup, b.x + b.w - 40, 8, b.y - 0.4, 30, 12, 0.6, B.cladding);
        for (const x of [b.x + b.w - 80, b.x + b.w - 96]) box(baseGroup, x, 4, b.y - 10, 12, 8, 8, B.olive);
      }
      // Clinic.
      {
        const b = planOf('clinic'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2;
        box(baseGroup, cx, 10, cz, b.w, 20, b.h, B.white);
        box(baseGroup, cx, 20.5, cz, b.w + 2, 1.4, b.h + 2, B.sandDark);
        windowRows(b, [11], 18, 9, 6, { skip: [b.x + 40, b.x + 70] });
        box(baseGroup, b.x + 55, 14, b.y + b.h + 9, 34, 1.4, 18, B.white);
        for (const dx of [-15, 15]) box(baseGroup, b.x + 55 + dx, 7, b.y + b.h + 17, 1, 14, 1, B.galv);
        const cross = plateMaterial('+', { bg: '#f4f2ea', fg: '#c62f2a', w: 128, h: 128 });
        plate(baseGroup, b.x + b.w - 30, 12, b.y + b.h + 0.4, 14, 14, cross, 0);
        plate(baseGroup, b.x + 55, 17, b.y + b.h + 18.2, 30, 4, plateMaterial('MEDICAL AID STATION', { w: 512, h: 60, bg: '#f4f2ea', fg: '#c62f2a' }), 0);
        glowPool(b.x + 55, b.y + b.h + 20, 36, '#fff1d8', 0.9);
      }
      // Motor pool maintenance shed: five bays facing the parking rows.
      {
        const b = planOf('motorpool'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2,
          fz = b.y + b.h;
        box(baseGroup, cx, 13, cz - 4, b.w, 26, b.h - 8, B.claddingOlive);
        gableRoof(baseGroup, cx, 26, cz, b.w + 6, b.h + 8, 8, B.cladding);
        const bays = 5,
          bayW = b.w / bays;
        for (let i = 0; i < bays; i++) {
          const x = b.x + bayW * (i + 0.5),
            open = i !== 3;
          box(baseGroup, x, 11, fz - 6, bayW - 10, 22, 0.8, B.black);
          box(baseGroup, x, open ? 20 : 11, fz - 5.4, bayW - 10, open ? 4 : 22, 0.8, B.cladding);
          box(baseGroup, x, 0.6, fz + 6, bayW - 14, 0.2, 12, B.concreteLight);
          const lamp = box(baseGroup, x, 23.5, fz - 4, 8, 0.6, 2, B.lamp);
          lamp.castShadow = false;
          glowPool(x, fz + 10, 40, '#ffe8c6', 0.7);
        }
        for (let i = 0; i <= bays; i++) box(baseGroup, b.x + bayW * i, 13, fz - 4, 5, 26, 4, B.olive);
        plate(baseGroup, cx, 29, fz + 0.6, 110, 6, plateMaterial('MOTOR POOL · VEHICLE MAINTENANCE', { w: 1024, h: 56, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        // Oil drums, tyre stack, a work bench.
        for (let i = 0; i < 6; i++) cylinder(baseGroup, b.x + b.w + 12 + (i % 3) * 5.5, 4, fz - 12 + Math.floor(i / 3) * 5.5, 2.5, 8, i % 2 ? B.olive : B.red, 10);
        for (let i = 0; i < 4; i++) {
          const t = new Three.Mesh(new Three.TorusGeometry(4.2, 1.5, 6, 12), B.black);
          t.rotation.x = Math.PI / 2;
          t.position.set(b.x - 10, 1.5 + i * 3, fz - 16);
          baseGroup.add(t);
        }
      }
      // Camouflage net over the tank row.
      {
        for (const [x, z] of [
          [9458, 9028],
          [9458, 9132],
          [9602, 9028],
          [9602, 9132],
          [9530, 9028],
          [9530, 9132],
        ])
          box(baseGroup, x, 18, z, 1, 36, 1, B.wood);
        const net = new Three.Mesh(new Three.PlaneGeometry(160, 118, 8, 6), B.net),
          p = net.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, -((Math.abs(p.getX(i)) / 80) ** 2) * 5 - ((Math.abs(p.getY(i)) / 59) ** 2) * 6 + Math.sin(i * 1.7) * 1.2);
        net.geometry.computeVertexNormals();
        net.rotation.x = -Math.PI / 2;
        net.position.set(9530, 37, 9080);
        baseGroup.add(net);
      }
      // Containers.
      for (const [i, c] of SENTINEL.containers.entries())
        for (let layer = 0; layer < c.layers; layer++)
          for (let row = 0; row < 5; row++) {
            if (layer && row === 4) continue;
            const z = c.y + 7 + row * 14,
              x = c.x + c.w / 2 + (layer ? 3 : 0),
              y = 6.6 + layer * 13.2,
              m = containerMats[(i * 3 + row + layer * 2) % containerMats.length];
            box(baseGroup, x, y, z, 62, 13, 12.4, m);
            box(baseGroup, x + 31.2, y, z, 0.5, 12.4, 11.8, B.oliveDark);
            for (const dz of [-3, 3]) box(baseGroup, x + 31.5, y, z + dz, 0.3, 12, 0.4, B.galv);
          }
      // Generators.
      for (const g2 of SENTINEL.generators) {
        const x = g2.x + g2.w / 2,
          z = g2.y + g2.h / 2;
        box(baseGroup, x, 1, z, g2.w + 2, 2, g2.h + 2, B.steel);
        box(baseGroup, x, 6.5, z, g2.w, 9, g2.h, B.olive);
        box(baseGroup, x + g2.w / 2 - 2, 6.5, z, 0.5, 7, g2.h - 3, B.black);
        cylinder(baseGroup, x - g2.w / 2 + 5, 14, z, 0.9, 6, B.black, 8);
        for (let k = -2; k <= 2; k++) box(baseGroup, x + k * 4, 11.2, z, 0.5, 0.4, g2.h, B.oliveDark);
      }
      // Hangars: barrel vaults with part-open doors and ribs.
      for (const id of ['hangar-1', 'hangar-2']) {
        const b = planOf(id),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2,
          fz = b.y + b.h,
          H = b.height,
          doorW = 170,
          doorH = 44;
        const vault = new Three.Mesh(vaultGeometry(b.w, H, b.h, 24), B.vault);
        vault.position.set(cx, 0, cz);
        vault.castShadow = vault.receiveShadow = true;
        baseGroup.add(vault);
        for (let z = b.y + 6; z < fz; z += 24) {
          const rib = new Three.Mesh(vaultGeometry(b.w + 1.2, H + 0.8, 2, 24), B.steel);
          rib.position.set(cx, 0, z);
          baseGroup.add(rib);
        }
        const front = new Three.Mesh(archWallGeometry(b.w, H, doorW, doorH), B.cladding);
        front.position.set(cx, 0, fz);
        baseGroup.add(front);
        const back = new Three.Mesh(archWallGeometry(b.w, H), B.cladding);
        back.position.set(cx, 0, b.y);
        back.rotation.y = Math.PI;
        baseGroup.add(back);
        box(baseGroup, cx, doorH + 2, fz + 1, doorW + 6, 4, 2, B.olive);
        // Door leaves stacked to both sides, leaving a 110-wide opening.
        for (const s of [-1, 1])
          for (let k = 0; k < 2; k++) {
            const x = cx + s * (doorW / 2 - 17 - k * 13);
            box(baseGroup, x, doorH / 2, fz + 2 + k * 1.6, 26, doorH, 1.2, B.claddingOlive);
          }
        // Interior: dark floor, work lights, a tug and a rack of crates.
        box(baseGroup, cx, 0.55, cz, b.w - 10, 0.2, b.h - 6, B.roofGrey);
        box(baseGroup, cx - 40, 3, cz, 14, 6, 9, B.yellow);
        for (let i = 0; i < 3; i++) box(baseGroup, cx + 70, 3 + i * 6, b.y + 30, 18, 6, 14, B.olive);
        for (const dx of [-50, 0, 50]) {
          const l = box(baseGroup, cx + dx, H * 0.8, cz, 10, 0.5, 3, B.lamp);
          l.castShadow = false;
        }
        plate(baseGroup, cx, doorH + 8, fz + 0.6, 60, 9, plateMaterial(b.name, { w: 512, h: 80, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        const big = plateMaterial(b.id === 'hangar-1' ? '1' : '2', { bg: '#6c7658', fg: '#e6dfc6', w: 128, h: 128 });
        plate(baseGroup, cx - doorW / 2 + 17, doorH / 2 + 4, fz + 4.4, 18, 18, big, 0);
        glowPool(cx, fz + 30, 90, '#ffe6bb', 0.7);
        baseHalo(cx, doorH + 4, fz + 4, 24, '#ffe8c0');
      }
