      // Control tower.
      {
        const b = planOf('atc'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2;
        box(baseGroup, cx, 29, cz, 30, 58, 30, B.concreteLight);
        box(baseGroup, cx, 5, cz + 20, 44, 10, 12, B.concreteLight);
        for (let y = 12; y < 56; y += 11) box(baseGroup, cx, y, cz + 15.3, 6, 5, 0.6, B.window);
        cylinder(baseGroup, cx, 59, cz, 25, 2, B.white, 8);
        const cab = cylinder(baseGroup, cx, 65, cz, 21, 10, B.glassBlue, 8, 24);
        cab.material = B.glassBlue;
        cylinder(baseGroup, cx, 71, cz, 26, 2, B.white, 8);
        rodTo(baseGroup, cx, 72, cz, cx, 92, cz, 0.5, B.galv);
        box(baseGroup, cx + 8, 76, cz, 10, 0.6, 0.6, B.galv);
        redBeacon(cx, 93, cz, 2.4);
        plate(baseGroup, cx, 50, cz + 15.4, 26, 4, plateMaterial('SENTINEL TOWER', { w: 256, h: 40, bg: '#2a3326', fg: '#e8d7a3' }), 0);
      }
      // Comms compound: lattice mast with obstruction lights, dishes and a shelter.
      {
        const c = SENTINEL.comms,
          H = c.height,
          legs = [0, 1, 2].map((k) => (k * TAU) / 3 + Math.PI / 6),
          rAt = (y) => 13 - (y / H) * 9;
        // Legs banded red and white for aircraft, 30 units a band.
        for (const a of legs)
          for (let y = 0, k = 0; y < H; y += 30, k++) {
            const y1 = Math.min(H, y + 30);
            rodTo(baseGroup, c.x + Math.cos(a) * rAt(y), y, c.y + Math.sin(a) * rAt(y), c.x + Math.cos(a) * rAt(y1), y1, c.y + Math.sin(a) * rAt(y1), 0.9, k % 2 ? B.white : B.red);
          }
        for (let y = 0; y < H - 10; y += 16) {
          const y1 = y + 16;
          for (let k = 0; k < 3; k++) {
            const a = legs[k],
              b2 = legs[(k + 1) % 3];
            rodTo(baseGroup, c.x + Math.cos(a) * rAt(y), y, c.y + Math.sin(a) * rAt(y), c.x + Math.cos(b2) * rAt(y1), y1, c.y + Math.sin(b2) * rAt(y1), 0.3, B.galv);
            rodTo(baseGroup, c.x + Math.cos(a) * rAt(y1), y1, c.y + Math.sin(a) * rAt(y1), c.x + Math.cos(b2) * rAt(y1), y1, c.y + Math.sin(b2) * rAt(y1), 0.3, B.galv);
          }
        }
        for (const y of [80, 160]) cylinder(baseGroup, c.x, y, c.y, rAt(y) + 3, 1, B.steel, 6);
        for (const [y, a] of [
          [110, 0.4],
          [128, 2.6],
          [176, 4.4],
        ]) {
          const d = cylinder(baseGroup, c.x + Math.cos(a) * (rAt(y) + 4), y, c.y + Math.sin(a) * (rAt(y) + 4), 7, 2, B.white, 16, 1.5);
          d.rotation.set(0, -a, Math.PI / 2 - 0.1);
        }
        for (let k = 0; k < 3; k++) box(baseGroup, c.x + Math.cos(legs[k]) * 5, H - 14, c.y + Math.sin(legs[k]) * 5, 2, 18, 5, B.white);
        rodTo(baseGroup, c.x, H, c.y, c.x, H + 18, c.y, 0.4, B.galv);
        redBeacon(c.x, H + 19, c.y, 3.2);
        for (const y of [H * 0.66, H * 0.33]) for (const a of [legs[0], legs[2]]) redBeacon(c.x + Math.cos(a) * (rAt(y) + 1.5), y, c.y + Math.sin(a) * (rAt(y) + 1.5), 2.2);
        const s = SENTINEL.shelter;
        box(baseGroup, s.x + s.w / 2, 8, s.y + s.h / 2, s.w, 16, s.h, B.cream);
        box(baseGroup, s.x + s.w / 2, 16.6, s.y + s.h / 2, s.w + 2, 1.2, s.h + 2, B.roofGreen);
        box(baseGroup, s.x + 8, 7, s.y + s.h + 0.3, 7, 13, 0.5, B.steel);
        for (let x = c.x + 10; x < s.x; x += 8) box(baseGroup, x, 12, c.y + 16, 8, 0.6, 3, B.galv);
        box(baseGroup, (c.x + s.x) / 2 + 5, 6, c.y + 16, 0.8, 12, 0.8, B.galv);
        // Compound fence.
        for (const [ax, az, bx2, bz] of [
          [10000, 7920, 10140, 7920],
          [10000, 7920, 10000, 8050],
          [10140, 7920, 10140, 8050],
        ])
          strip(baseGroup, ax, az, bx2, bz, 0.5, 10, B.fence, 6);
        plate(baseGroup, 10070, 6, 8050.2, 22, 8, plateMaterial(['DANGER', 'RF RADIATION'], { header: 'AUTHORIZED ONLY', bg: '#f1eee4', fg: '#1d1f22', headerBg: '#c9392d', w: 256, h: 128 }), 0);
      }
      // Radome and the rotating surveillance radar.
      let radarHead = null;
      {
        const r = SENTINEL.radome;
        cylinder(baseGroup, r.x, 15, r.y, r.base / 2, 30, B.cream, 8);
        cylinder(baseGroup, r.x, 30.6, r.y, r.base / 2 + 1, 1.2, B.sandDark, 8);
        mesh(new Three.IcosahedronGeometry(1, 2), B.dome, baseGroup, r.x, 50, r.y, r.r, r.r, r.r);
        box(baseGroup, r.x, 8, r.y + r.base / 2 - 3, 10, 16, 8, B.steel);
        const q = SENTINEL.radar;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) rodTo(baseGroup, q.x + sx * 7, 0, q.y + sz * 7, q.x + sx * 3, 46, q.y + sz * 3, 0.6, B.galv);
        for (let y = 8; y < 46; y += 12) for (const [a, b2] of [[-1, 1], [1, -1]]) rodTo(baseGroup, q.x + a * 6.5, y, q.y - 6, q.x + b2 * 5, y + 12, q.y - 5, 0.25, B.galv);
        box(baseGroup, q.x, 47, q.y, 9, 2, 9, B.steel);
        radarHead = new Three.Group();
        radarHead.position.set(q.x, 49, q.y);
        baseDynamic.add(radarHead);
        cylinder(radarHead, 0, 1.5, 0, 2, 3, B.steel, 10);
        const reflector = box(radarHead, 0, 6, -2, 30, 7, 1.2, B.white);
        reflector.rotation.x = -0.35;
        rodTo(radarHead, 0, 3, 0, 0, 5, 5, 0.4, B.steel);
        box(radarHead, 0, 5.5, 5.5, 2, 2, 2, B.steel);
        redBeacon(q.x, 58, q.y, 1.8);
      }
      // Water tower.
      {
        const w = SENTINEL.waterTower,
          top = w.height - 22;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) rodTo(baseGroup, w.x + sx * w.spread, 0, w.y + sz * w.spread, w.x + sx * 12, top, w.y + sz * 12, 1.1, B.steel);
        for (const y of [20, 40]) {
          const r = w.spread - ((w.spread - 12) * y) / top;
          box(baseGroup, w.x, y, w.y - r, r * 2, 0.6, 0.6, B.steel);
          box(baseGroup, w.x, y, w.y + r, r * 2, 0.6, 0.6, B.steel);
          box(baseGroup, w.x - r, y, w.y, 0.6, 0.6, r * 2, B.steel);
          box(baseGroup, w.x + r, y, w.y, 0.6, 0.6, r * 2, B.steel);
        }
        rodTo(baseGroup, w.x, 0, w.y, w.x, top, w.y, 1.4, B.steel);
        cylinder(baseGroup, w.x, top + 11, w.y, w.r, 22, B.checker, 20);
        cylinder(baseGroup, w.x, top + 26, w.y, w.r + 1, 8, B.white, 20, 2);
        cylinder(baseGroup, w.x, top + 0.5, w.y, w.r + 3, 1, B.steel, 20);
        redBeacon(w.x, top + 31, w.y, 2.4);
      }
      // Fuel depot: bund wall, tanks, pipes and the pump island.
      {
        const f = SENTINEL.fuel,
          bd = f.bund;
        for (const [x, z, w, d] of [
          [bd.x + bd.w / 2, bd.y + 1.5, bd.w, 3],
          [bd.x + bd.w / 2, bd.y + bd.h - 1.5, bd.w, 3],
          [bd.x + 1.5, bd.y + bd.h / 2, 3, bd.h],
          [bd.x + bd.w - 1.5, bd.y + bd.h / 2, 3, bd.h],
        ])
          box(baseGroup, x, 3.5, z, w, 7, d, B.concreteLight);
        for (const [i, t] of f.vertical.entries()) {
          cylinder(baseGroup, t.x, t.h / 2, t.y, t.r, t.h, B.tank, 24);
          cylinder(baseGroup, t.x, t.h + 2.5, t.y, t.r, 5, B.tank, 24, 4);
          const railRing = new Three.Mesh(new Three.TorusGeometry(t.r - 1, 0.35, 4, 24), B.galv);
          railRing.rotation.x = Math.PI / 2;
          railRing.position.set(t.x, t.h + 4, t.y);
          baseGroup.add(railRing);
          for (let y = 3; y < t.h; y += 3) box(baseGroup, t.x + t.r + 1, y, t.y + 8, 0.4, 0.4, 4, B.galv);
          box(baseGroup, t.x, t.h * 0.55, t.y + t.r - 0.6, 14, 1.2, 1.4, B.olive);
          plate(baseGroup, t.x, t.h * 0.42, t.y + t.r + 0.3, 20, 8, plateMaterial(i === 1 ? ['JP-8', 'AVIATION FUEL'] : ['DIESEL', 'F-54'], { bg: '#e7e2d2', fg: '#1d1f22', w: 256, h: 104 }), 0);
          rodTo(baseGroup, t.x, 3, t.y + t.r, t.x, 3, f.pump.y, 1.1, B.yellow);
        }
        for (const h of f.horizontal) {
          const m = cylinder(baseGroup, (h.x0 + h.x1) / 2, h.r + 4, h.y, h.r, h.x1 - h.x0, B.olive, 18);
          m.rotation.z = Math.PI / 2;
          for (const x of [h.x0 + 12, h.x1 - 12]) box(baseGroup, x, 3, h.y, 6, 6, h.r * 1.6, B.concreteLight);
        }
        rodTo(baseGroup, bd.x + 30, 3, f.pump.y - 6, bd.x + bd.w - 20, 3, f.pump.y - 6, 1.1, B.yellow);
        const p = f.pump;
        box(baseGroup, p.x + p.w / 2, 1.2, p.y + p.h / 2, p.w, 2.4, p.h, B.concreteLight);
        for (const dx of [-16, 16]) {
          box(baseGroup, p.x + p.w / 2 + dx, 6, p.y + p.h / 2, 7, 9, 5, B.red);
          box(baseGroup, p.x + p.w / 2 + dx, 8, p.y + p.h / 2 + 2.6, 4, 3, 0.3, B.lamp);
        }
        box(baseGroup, p.x + p.w / 2, 19, p.y + p.h / 2 + 8, p.w + 30, 1.6, 42, B.white);
        for (const dx of [-38, 38]) box(baseGroup, p.x + p.w / 2 + dx, 9.5, p.y + p.h / 2 + 8, 1.4, 19, 1.4, B.galv);
        plate(baseGroup, p.x + p.w / 2, 21.5, p.y + p.h / 2 + 29.2, 60, 4, plateMaterial('FUEL POINT · NO SMOKING · NO NAKED FLAMES', { w: 1024, h: 64, bg: '#b8322a', fg: '#ffffff' }), 0);
        glowPool(p.x + p.w / 2, p.y + 20, 50, '#fff0d0', 1);
      }
      // Ammunition bunkers: earth-covered vaults with concrete headwalls.
      for (const b of SENTINEL.bunkers) {
        const mound = new Three.Mesh(vaultGeometry(b.h, 26, b.w, 16), B.earth);
        mound.rotation.y = Math.PI / 2;
        mound.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
        mound.castShadow = mound.receiveShadow = true;
        baseGroup.add(mound);
        box(baseGroup, b.x + 1.5, 13, b.y + b.h / 2, 3, 26, b.h + 10, B.concreteLight);
        for (const s of [-1, 1]) box(baseGroup, b.x - 6, 7, b.y + b.h / 2 + s * (b.h / 2 + 3), 14, 14, 4, B.concreteLight);
        box(baseGroup, b.x - 0.4, 8, b.y + b.h / 2, 0.6, 16, 26, B.oliveDark);
        box(baseGroup, b.x - 0.8, 8, b.y + b.h / 2, 0.4, 16, 0.6, B.black);
        plate(baseGroup, b.x - 0.8, 19, b.y + b.h / 2, 16, 5, plateMaterial(b.label, { bg: '#d8b23a', fg: '#1d1f22', w: 128, h: 40 }), -Math.PI / 2);
        const light = box(baseGroup, b.x - 1.2, 22, b.y + b.h / 2, 1.2, 1.2, 4, B.lamp);
        light.castShadow = false;
        rodTo(baseGroup, b.x + b.w / 2, 24, b.y + b.h / 2, b.x + b.w / 2, 44, b.y + b.h / 2, 0.35, B.galv);
        glowPool(b.x - 14, b.y + b.h / 2, 30, '#ffe6bb', 0.7);
      }
      plate(baseGroup, 10300, 7, 9142.2, 22, 9, plateMaterial(['EXPLOSIVES', 'NO UNAUTHORIZED ENTRY'], { header: 'DANGER', bg: '#f1eee4', fg: '#1d1f22', headerBg: '#c9392d', w: 256, h: 128 }), 0);
      box(baseGroup, 10300, 3.5, 9141, 1, 7, 1, B.galv);
      // Rifle range: firing-line shelter, lane berms, targets, backstop.
      {
        const r = SENTINEL.range;
        for (const x of [r.x + 14, r.x + 40]) for (const z of [r.y + 2, r.y + r.h / 2, r.y + r.h - 2]) box(baseGroup, x, 7, z, 1.2, 14, 1.2, B.galv);
        box(baseGroup, r.x + 27, 14.5, r.y + r.h / 2, 36, 1.2, r.h + 8, B.roofGreen);
        for (let i = 0; i < 4; i++) {
          box(baseGroup, r.x + 32, 1.6, r.y + 10 + i * 20, 5, 3.2, 9, B.sandbag);
          const board = box(baseGroup, r.targetsX, 7, r.y + 10 + i * 20, 0.6, 9, 7, B.white);
          board.material = plateMaterial('◎', { bg: '#efeadb', fg: '#1d1f22', w: 128, h: 128 });
          for (const dz of [-3.5, 3.5]) box(baseGroup, r.targetsX + 0.8, 4, r.y + 10 + i * 20 + dz, 0.8, 8, 0.8, B.wood);
        }
        for (let i = 1; i < 4; i++) box(baseGroup, (r.x + 60 + r.targetsX) / 2, 1.2, r.y + i * 20, r.targetsX - r.x - 60, 2.4, 3, B.earth);
        const berm = new Three.Mesh(vaultGeometry(45, 22, r.h + 20, 10), B.earth);
        berm.position.set(r.x + r.w - 22.5, 0, r.y + r.h / 2);
        berm.castShadow = berm.receiveShadow = true;
        baseGroup.add(berm);
        cylinder(baseGroup, r.x + 6, 14, r.y - 8, 0.5, 28, B.white, 6);
        const rangeFlag = box(baseGroup, r.x + 11, 25, r.y - 8, 10, 6, 0.3, B.red);
        rangeFlag.castShadow = false;
        plate(baseGroup, r.x + 120, 6, r.y - 13.8, 34, 10, plateMaterial(['LIVE FIRE RANGE', 'DO NOT ENTER WHEN RED FLAG FLIES'], { header: 'DANGER', bg: '#f1eee4', fg: '#1d1f22', headerBg: '#c9392d', w: 512, h: 160 }), 0);
        box(baseGroup, r.x + 120, 3, r.y - 14.6, 1, 6, 1, B.galv);
      }
      // Obstacle course.
      {
        const o = SENTINEL.obstacleCourse,
          cx = o.x + o.w / 2;
        for (let k = 0; k < 3; k++) {
          const log = cylinder(baseGroup, cx, 2.5, o.y + 16 + k * 10, 1.4, o.w - 30, B.wood, 8);
          log.rotation.z = Math.PI / 2;
          for (const s of [-1, 1]) box(baseGroup, cx + s * (o.w / 2 - 16), 1.5, o.y + 16 + k * 10, 1.2, 3, 1.2, B.wood);
        }
        for (let k = 0; k < 4; k++) {
          const beam = cylinder(baseGroup, cx + (k % 2 ? 10 : -10), 3, o.y + 60 + k * 7, 1, 30, B.wood, 8);
          beam.rotation.set(0, (k % 2 ? 1 : -1) * 0.5, Math.PI / 2);
        }
        box(baseGroup, cx, 6, o.y + 100, o.w - 30, 12, 3, B.wood);
        for (const dx of [-25, 0, 25]) rodTo(baseGroup, cx + dx, 0, o.y + 110, cx + dx, 10, o.y + 101.5, 0.6, B.wood);
        // Cargo-net A-frame.
        for (const dx of [-30, 30]) {
          rodTo(baseGroup, cx + dx, 0, o.y + 140, cx + dx, 28, o.y + 160, 0.9, B.wood);
          rodTo(baseGroup, cx + dx, 0, o.y + 180, cx + dx, 28, o.y + 160, 0.9, B.wood);
        }
        cylinder(baseGroup, cx, 28, o.y + 160, 0.9, 62, B.wood, 8).rotation.z = Math.PI / 2;
        for (const s of [-1, 1]) {
          const net = new Three.Mesh(new Three.PlaneGeometry(58, 34), B.net);
          net.position.set(cx, 14, o.y + 160 + s * 10);
          net.rotation.x = s * 0.53;
          baseGroup.add(net);
        }
        // Monkey bars.
        for (const dx of [-8, 8]) {
          for (const z of [o.y + 215, o.y + 265]) box(baseGroup, cx + dx, 7.5, z, 1, 15, 1, B.steel);
          box(baseGroup, cx + dx, 15, o.y + 240, 1, 1, 50, B.steel);
        }
        for (let z = o.y + 217; z < o.y + 264; z += 4) box(baseGroup, cx, 15, z, 16, 0.5, 0.5, B.steel);
        // Tyre run.
        for (let i = 0; i < 12; i++) {
          const t = new Three.Mesh(new Three.TorusGeometry(3.6, 1.4, 6, 10), B.black);
          t.rotation.x = Math.PI / 2;
          t.position.set(cx + ((i % 4) - 1.5) * 9, 1.4, o.y + 290 + Math.floor(i / 4) * 9);
          baseGroup.add(t);
        }
        // Low crawl under wire.
        for (let z = o.y + 330; z <= o.y + 380; z += 12) for (const dx of [-30, 30]) box(baseGroup, cx + dx, 2.5, z, 0.8, 5, 0.8, B.wood);
        for (let z = o.y + 330; z <= o.y + 380; z += 12) box(baseGroup, cx, 4.6, z, 60, 0.25, 0.25, B.galv);
        // Rope climb gantry.
        for (const dx of [-24, 24]) box(baseGroup, cx + dx, 16, o.y + 420, 1.6, 32, 1.6, B.wood);
        box(baseGroup, cx, 31, o.y + 420, 50, 1.8, 1.8, B.wood);
        for (const dx of [-12, 0, 12]) rodTo(baseGroup, cx + dx, 30, o.y + 420, cx + dx, 2, o.y + 420, 0.4, B.canvasTop);
        plate(baseGroup, cx, 5, o.y + o.h + 1.5, 40, 6, plateMaterial('OBSTACLE COURSE', { w: 512, h: 64, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        box(baseGroup, cx, 2.5, o.y + o.h + 1, 1, 5, 1, B.wood);
      }
      // Reviewing stand at the parade ground.
      {
        const s = SENTINEL.stand,
          cx = s.x + s.w / 2;
        for (let k = 0; k < 3; k++) box(baseGroup, cx, 1.5 + k * 3, s.y + 6 + k * 7, s.w, 3 + k * 6, 8, B.concreteLight);
        box(baseGroup, cx, 11, s.y + 1, s.w, 22, 2, B.sand);
        for (const x of [s.x + 2, s.x + s.w - 2]) for (const z of [s.y + 2, s.y + s.h]) box(baseGroup, x, 11, z, 1.4, 22, 1.4, B.white);
        box(baseGroup, cx, 22.5, s.y + s.h / 2, s.w + 8, 1.4, s.h + 10, B.olive);
        box(baseGroup, cx, 20.3, s.y + s.h + 4, s.w + 8, 2.4, 0.4, B.red);
        box(baseGroup, cx, 18.2, s.y + s.h + 4, s.w + 8, 1.8, 0.4, B.white);
        box(baseGroup, cx, 16.4, s.y + s.h + 4, s.w + 8, 1.8, 0.4, B.blueLamp);
        box(baseGroup, cx, 5, s.y + s.h + 6, 10, 8, 6, B.oliveDark);
      }
      // Airfield lights: runway edges, thresholds, taxiway, helipads; the windsock.
      const windsock = new Three.Group();
      {
        const rw = SENTINEL.runway,
          light = (x, z, material, size = 1.4) => {
            const m = box(baseGroup, x, 0.9, z, size, 1.2, size, material);
            m.castShadow = false;
            glowPool(x, z, 12, material === B.redLamp ? '#ff5a40' : material === B.greenLamp ? '#62ff90' : material === B.blueLamp ? '#6090ff' : '#fff2cf', 1.4);
          };
        for (let x = rw.x + 10; x <= rw.x + rw.w - 10; x += 60) {
          light(x, rw.y - 4, B.lamp);
          light(x, rw.y + rw.h + 4, B.lamp);
        }
        for (let z = rw.y + 6; z < rw.y + rw.h; z += 12) {
          light(rw.x - 4, z, B.greenLamp);
          light(rw.x + rw.w + 4, z, B.redLamp);
        }
        for (let k = 1; k <= 3; k++) for (let z = rw.y + 25; z < rw.y + rw.h - 20; z += 10) light(rw.x - 4 - k * 14, z, B.lamp, 1.1);
        for (let z = 9600; z < 9665; z += 20) {
          light(9956, z, B.blueLamp, 1.1);
          light(10024, z, B.blueLamp, 1.1);
        }
        for (const p of SENTINEL.helipads)
          for (let a = 0; a < 8; a++) light(p.x + Math.cos((a * TAU) / 8) * (p.r + 4), p.y + Math.sin((a * TAU) / 8) * (p.r + 4), B.amberLamp, 1.2);
        // PAPI boxes.
        for (let k = 0; k < 4; k++) box(baseGroup, rw.x + 140, 1.4, rw.y - 16 - k * 6, 4, 2.8, 4, B.white);
        const w = SENTINEL.windsock;
        box(baseGroup, w.x, 12, w.y, 1, 24, 1, B.galv);
        windsock.position.set(w.x, 23, w.y);
        baseDynamic.add(windsock);
        for (let k = 0; k < 5; k++) {
          const seg = cylinder(windsock, 2.2 + k * 3.2, 0, 0, 2.6 - k * 0.3, 3.2, k % 2 ? B.white : B.amberLamp, 10, 2.3 - k * 0.3);
          seg.rotation.z = Math.PI / 2;
        }
        redBeacon(w.x, 25, w.y, 1.4);
      }
      // A few ornamental pines round HQ and the parade ground.
      for (const [x, z, s] of [
        [9555, 8060, 1],
        [9925, 8060, 1.1],
        [9555, 8230, 0.9],
        [9955, 8230, 1],
        [9960, 8600, 1],
        [9570, 8765, 0.8],
        [10025, 8740, 0.9],
      ]) {
        cylinder(baseGroup, x, 5 * s, z, 1.2 * s, 10 * s, B.dirt, 6);
        cylinder(baseGroup, x, 13 * s, z, 9 * s, 14 * s, leafMats[0], 8, 0.5);
        cylinder(baseGroup, x, 22 * s, z, 6 * s, 11 * s, leafMats[0], 8, 0.3);
      }
      // One mesh of ground light pools, lit at night.
      const baseGlowMesh = (() => {
        const positions = new Float32Array(glowPools.length * 12),
          colors = new Float32Array(glowPools.length * 12),
          uvs = new Float32Array(glowPools.length * 8),
          indices = new Uint32Array(glowPools.length * 6);
        glowPools.forEach((p, i) => {
          const corners = [
            [-1, -1, 0, 0],
            [1, -1, 1, 0],
            [1, 1, 1, 1],
            [-1, 1, 0, 1],
          ];
          corners.forEach(([dx, dz, u, v], k) => {
            positions.set([p.x + dx * p.r, 0.9, p.z + dz * p.r], (i * 4 + k) * 3);
            colors.set([p.color.r, p.color.g, p.color.b], (i * 4 + k) * 3);
            uvs.set([u, v], (i * 4 + k) * 2);
          });
          indices.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6);
        });
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.BufferAttribute(positions, 3));
        geo.setAttribute('color', new Three.BufferAttribute(colors, 3));
        geo.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
        geo.setIndex(new Three.BufferAttribute(indices, 1));
        geo.computeBoundingSphere();
        const m = new Three.Mesh(
          geo,
          new Three.MeshBasicMaterial({ map: haloTx, vertexColors: true, transparent: true, opacity: 0, blending: Three.AdditiveBlending, depthWrite: false }),
        );
        m.name = 'Fort Sentinel light pools';
        m.renderOrder = 2;
        m.visible = false;
        scene.add(m);
        return m;
      })();
