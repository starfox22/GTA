      // Helicopter equipment: skids, lenses, nav lights, beacons, Nightsun, per-type kit and cabins.
      // ---- Shared light-single parts: skids, lamps ----------------------------------------------
      /*
       * Tubular skids with upturned toes, arched cross tubes clamped to the belly,
       * saddles and wear shoes. `o`: half track z, skid tube from x0 to x1 (the toe
       * curls up ahead of x1), height y, tube radius r, cross tubes, shoes.
       */
      function heliSkids(k, o) {
        const { trim, S, stationAt, look } = k,
          c = look.skid;
        for (const side of [-1, 1]) {
          const z = side * o.z;
          heliTube(trim, [[o.x0, o.y + 0.25, z], [o.x0 + 1.2, o.y, z], [(o.x0 + o.x1) / 2, o.y, z], [o.x1, o.y, z], [o.x1 + 2.6, o.y + 0.65, z], [o.x1 + 3.9, o.y + 2.3, z]], o.r, c, 40);
          policeAdd(trim, S.sphere, o.x0 - 0.02, o.y + 0.25, z, o.r, o.r, o.r, c);
          for (const x of o.shoes) policeAdd(trim, boxGeo, x, o.y - o.r * 0.95, z, 3.0, 0.2, o.r * 1.5, '#55595e');
        }
        for (const x of o.cross) {
          const keel = stationAt(x).yb + 0.3,
            h = o.z;
          heliTube(
            trim,
            [[x, o.y, -h], [x, o.y + 2.0, -h + 0.1], [x, keel - 0.5, -h * 0.74], [x, keel, -h * 0.4], [x, keel, 0], [x, keel, h * 0.4], [x, keel - 0.5, h * 0.74], [x, o.y + 2.0, h - 0.1], [x, o.y, h]],
            o.r * 1.12,
            c,
            40,
          );
          for (const side of [-1, 1]) policeAdd(trim, boxGeo, x, o.y + 0.25, side * h, 1.6, o.r * 2.2, o.r * 2.6, c);
        }
      }
      // A lens on the lights mesh (police light shader channel `ch`).
      function heliLens(k, ch, color, x, y, z, sx, sy, sz, geo = k.S.sphere) {
        policeAdd(k.lights, geo, x, y, z, sx, sy, sz, color, { channel: ch });
      }
      // Navigation lights (red port, green starboard) and white strobes at z = ±span.
      function heliNavLights(k, x, y, span, strobeX) {
        for (const side of [-1, 1]) {
          const z = side * span,
            navColor = side < 0 ? '#ff3a2c' : '#3dff79',
            ch = side < 0 ? HELI_CH.navRed : HELI_CH.navGreen;
          heliLens(k, ch, navColor, x, y, z, 0.5, 0.45, 0.35);
          heliLens(k, HELI_CH.strobe, '#ffffff', strobeX, y, z, 0.42, 0.38, 0.3);
          k.anchors.push({ x: x + 0.2, y, z: z + side * 0.3, size: 7, color: navColor, channel: ch, strength: 1 });
          k.anchors.push({ x: strobeX, y, z: z + side * 0.3, size: 18, color: '#ffffff', channel: HELI_CH.strobe, strength: 1 });
        }
      }
      function heliBeacon(k, x, y, lift) {
        heliLens(k, HELI_CH.beacon, '#ff2a1e', x, y, 0, 0.62, 0.45 * Math.sign(lift), 0.62, k.S.dome);
        k.anchors.push({ x, y: y + lift, z: 0, size: 12, color: '#ff3326', channel: HELI_CH.beacon, strength: 1 });
      }
      // ---- EC120 class (the police) equipment -----------------------------------------------------
      function heliColibriEquipment(k) {
        const { plan, look, S, trim, metal, anchors, stationAt } = k,
          dark = '#16181b',
          grey = '#383c41',
          police = look.kind === 'police';
        heliSkids(k, { z: 9.0, x0: -6.4, x1: 24.4, y: 0.9, r: 0.5, cross: [19.4, 1.4], shoes: [-2, 9, 19] });
        // Boarding steps on the cross tubes' legs.
        for (const side of [-1, 1])
          for (const x of [19.4, 1.4]) policeAdd(trim, boxGeo, x + 1.5, 3.0, side * 8.2, 2.4, 0.22, 1.5, '#43474c');
        // Cowl: intake grilles, the exhaust at its tail, the mast fairing and swashplate.
        for (const side of [-1, 1]) {
          policeAdd(trim, boxGeo, 12.2, 21.9, side * 3.95, 4.2, 1.1, 0.14, dark);
          for (let g = 0; g < 5; g++) policeAdd(trim, boxGeo, 10.6 + g * 0.8, 21.9, side * 4.02, 0.12, 1.0, 0.1, '#4b4f54');
          // The door handles.
          for (const [x, y] of [
            [16.6, 12.6],
            [4.2, 12.2],
          ])
            policeAdd(metal, boxGeo, x, y, heliSurfaceZ(stationAt(x), y, side) + side * 0.12, 1.2, 0.28, 0.2, '#b7bcc1');
        }
        heliRod(metal, [-12.2, 20.6, 0], [-15.4, 21.6, 0], 1.25, '#4a4d51', S.cylinder, 0.9);
        heliRod(trim, [-15.3, 21.57, 0], [-15.6, 21.66, 0], 1.0, '#0b0b0c', S.cylinder, 0.7);
        policeAdd(trim, S.cylinder, plan.rotor.x, 23.9, 0, 1.55, 0.9, 1.55, grey);
        policeAdd(metal, S.cylinder, plan.rotor.x, 24.6, 0, 2.1, 0.35, 2.1, '#7c8288');
        // Antennas: blade on the cowl's tail, GPS dome, VHF whips and blades under the belly, pitot.
        policeAdd(trim, boxGeo, -14.2, 19.4, 0, 1.3, 1.6, 0.14, dark, null, 0, 0, 0.4);
        policeAdd(trim, S.sphere, -9.5, 22.3, 0, 0.8, 0.32, 0.8, '#e4e4e0');
        policeAdd(trim, boxGeo, -2.5, 5.9, 0, 1.5, 1.6, 0.14, dark, null, 0, 0, -0.4);
        policeAdd(trim, boxGeo, -17.5, 12.1, 0, 1.3, 1.4, 0.14, dark, null, 0, 0, -0.4);
        heliRod(trim, [13, 5.6, 1.6], [11.2, 3.7, 1.8], 0.08, dark);
        heliRod(metal, [26.4, 19.3, 1.2], [29.4, 19.4, 1.2], 0.09, '#9aa0a6');
        // Tail bumper under the ventral fin.
        heliRod(trim, [-43.6, 8.8, 0], [-46.0, 7.7, 0], 0.26, look.skid);
        if (police) {
          // Wire strike cutters over the canopy and under the chin.
          policeAdd(trim, boxGeo, 29.4, 19.2, 0, 3.2, 0.85, 0.16, '#2b2e32', null, 0, 0, -0.45);
          policeAdd(trim, boxGeo, 36.6, 7.2, 0, 2.4, 0.7, 0.16, '#2b2e32', null, 0, 0, 0.55);
          // FLIR turret under the nose: yoke, ball and its window.
          policeAdd(trim, boxGeo, 33.4, 5.95, 0, 1.4, 0.9, 1.4, grey);
          policeAdd(trim, S.sphere, 33.5, 4.55, 0, 1.55, 1.55, 1.55, '#3b3f45');
          policeAdd(trim, boxGeo, 34.95, 4.5, 0, 0.3, 1.45, 1.9, '#07090c');
          policeAdd(trim, S.sphere, 35.08, 4.85, 0.42, 0.26, 0.32, 0.32, '#3d6c8c');
          policeAdd(trim, S.sphere, 35.08, 4.2, -0.4, 0.2, 0.24, 0.24, '#6a4a86');
          // The Nightsun's bracket from the belly to its gimbal.
          const m = HELI_SEARCHLIGHT_MOUNT;
          heliRod(trim, [m.x + 0.6, stationAt(m.x).yb + 0.4, m.z * 0.5], [m.x, m.y + 1.2, m.z], 0.34, grey, boxGeo);
          policeAdd(trim, boxGeo, m.x, m.y + 1.25, m.z, 1.5, 0.4, 1.5, grey);
          // PA speaker under the starboard cabin.
          policeAdd(trim, boxGeo, 3.6, 4.95, 3.8, 2.4, 1.2, 1.5, '#1e2124');
          policeAdd(trim, boxGeo, 4.85, 4.95, 3.8, 0.1, 0.95, 1.2, '#4c5055');
          k.nightsun = heliNightsunParts(S);
        }
        // ---- Lamps ----
        const s = plan.stab;
        heliNavLights(k, s.x + 0.9, s.y + 3.9, s.span + 0.45, s.x - 1.2);
        heliLens(k, HELI_CH.navWhite, '#fff6e6', -45.7, 16.4, 0, 0.36, 0.42, 0.42);
        anchors.push({ x: -46.0, y: 16.4, z: 0, size: 7, color: '#fff4e0', channel: HELI_CH.navWhite, strength: 1 });
        heliBeacon(k, -15.9, 18.95, 0.4);
        heliBeacon(k, 2.5, stationAt(2.5).yb + 0.05, -0.4);
        for (const z of [-1.4, 1.4]) {
          heliLens(k, HELI_CH.work, '#fff8e8', 30.2, 5.95, z, 0.75, 0.28, 0.75);
          anchors.push({ x: 30.6, y: 5.6, z, size: 13, color: '#fff3d6', channel: HELI_CH.work, strength: 0.8 });
        }
        if (police) {
          // Red (port) and blue (starboard) LED strobes: bars under the doors, a pair
          // flanking the nose, pods on the boom and a pair on the fin tip.
          for (const side of [-1, 1]) {
            const ch = side < 0 ? HELI_CH.red : HELI_CH.blue,
              color = side < 0 ? '#ff2d22' : '#2f62ff';
            for (let x = 5; x <= 20; x += 3) {
              const z = heliSurfaceZ(stationAt(x), 7.2, side) + side * 0.1;
              heliLens(k, ch, color, x, 7.2, z, 2.3, 0.4, 0.22, boxGeo);
              if (x % 6 === 5) anchors.push({ x, y: 7.2, z: z + side * 0.4, size: 10, color, channel: ch, strength: 1 });
            }
            const nz = heliSurfaceZ(stationAt(35.4), 8.4, side) + side * 0.08;
            heliLens(k, ch, color, 35.4, 8.4, nz, 1.1, 0.5, 0.3, boxGeo);
            anchors.push({ x: 35.8, y: 8.4, z: nz + side * 0.3, size: 11, color, channel: ch, strength: 1 });
            const bz = heliSurfaceZ(stationAt(-28.5), 14.4, side) + side * 0.14;
            heliLens(k, ch, color, -28.5, 14.4, bz, 1.5, 0.5, 0.28, boxGeo);
            anchors.push({ x: -28.5, y: 14.4, z: bz + side * 0.4, size: 9, color, channel: ch, strength: 1 });
          }
          heliLens(k, HELI_CH.red, '#ff2d22', -42.8, 27.2, 0, 0.9, 0.42, 0.7, boxGeo);
          heliLens(k, HELI_CH.blue, '#2f62ff', -44.6, 27.3, 0, 0.9, 0.42, 0.7, boxGeo);
          anchors.push({ x: -42.8, y: 27.7, z: 0, size: 12, color: '#ff2d22', channel: HELI_CH.red, strength: 1 });
          anchors.push({ x: -44.6, y: 27.8, z: 0, size: 12, color: '#2f62ff', channel: HELI_CH.blue, strength: 1 });
        } else heliBeacon(k, -43.8, 27.4, 0.45);
      }
      // ---- R44 / R66 class (the civilians) equipment ---------------------------------------------
      function heliRobinEquipment(k) {
        const { plan, look, S, trim, metal, anchors, stationAt } = k,
          dark = '#17191c',
          grey = '#3a3e43',
          news = look.kind === 'news';
        heliSkids(k, { z: 8.3, x0: -11.4, x1: 19.0, y: 0.8, r: 0.42, cross: [13.4, -4.4], shoes: [-7, 4, 14] });
        for (const side of [-1, 1]) policeAdd(trim, boxGeo, 14.8, 2.8, side * 7.6, 2.0, 0.2, 1.2, '#4a4e53');
        // The mast: a boot where it leaves the fairing, the swashplate.
        policeAdd(trim, S.cylinder, plan.rotor.x, 21.2, 0, 1.15, 0.9, 1.15, grey);
        policeAdd(metal, S.cylinder, plan.rotor.x, 21.9, 0, 1.6, 0.3, 1.6, '#80868c');
        // Engine bay: cooling louvres each side, the exhaust under the starboard side.
        for (const side of [-1, 1]) {
          const z = heliSurfaceZ(stationAt(-7.4), 11.6, side);
          policeAdd(trim, boxGeo, -7.4, 11.6, z + side * 0.05, 3.2, 1.5, 0.12, dark, null, 0, side * -0.35, 0);
          for (let g = 0; g < 4; g++) policeAdd(trim, boxGeo, -8.6 + g * 0.8, 11.6, z + side * 0.1, 0.12, 1.3, 0.1, '#4b4f54', null, 0, side * -0.35, 0);
          // Door handles.
          for (const [x, y] of [
            [10.4, 10.4],
            [-1.6, 10.8],
          ])
            policeAdd(metal, boxGeo, x, y, heliSurfaceZ(stationAt(x), y, side) + side * 0.1, 1.0, 0.24, 0.18, '#b7bcc1');
        }
        heliRod(metal, [-9, 8.8, 2.2], [-14.2, 9.6, 2.5], 0.42, '#6d7176');
        heliRod(trim, [-14.1, 9.58, 2.5], [-14.4, 9.62, 2.5], 0.34, '#0b0b0c');
        // Antennas and pitot; the tail rotor guard.
        policeAdd(trim, boxGeo, -20, 12.4, 0, 1.0, 1.3, 0.12, dark, null, 0, 0, -0.45);
        heliRod(trim, [2, 4.9, 1.2], [0.6, 3.4, 1.3], 0.07, dark);
        heliRod(metal, [11.5, 18.35, 0], [13.6, 18.4, 0], 0.08, '#9aa0a6');
        heliTube(trim, [[-38.2, 13.3, 0], [-40.4, 10.6, 0], [-43.2, 9.0, 0], [-45.8, 8.95, 0]], 0.2, look.skid, 16);
        // The tail rotor's gearbox and output shaft.
        const t = plan.tailRotor;
        policeAdd(trim, boxGeo, t.x, t.y, -0.55, 1.8, 1.9, 1.0, grey);
        policeAdd(trim, S.cylinder, t.x, t.y, t.z * 0.6, 0.45, 1.1, 0.45, grey, null, Math.PI / 2);
        if (news) {
          // The gyro-stabilised camera on the chin, the downlink dome under the boom.
          policeAdd(trim, boxGeo, 25.3, 5.6, 0, 1.5, 1.2, 1.5, grey);
          policeAdd(trim, S.sphere, 25.5, 3.7, 0, 1.75, 1.75, 1.75, '#e8e8e4');
          policeAdd(trim, boxGeo, 27.2, 3.6, 0, 0.36, 1.25, 1.45, '#08090b');
          policeAdd(trim, S.sphere, 27.35, 3.6, 0, 0.32, 0.5, 0.5, '#2f5d82');
          policeAdd(trim, S.sphere, -22, 12.5, 0, 1.6, 0.8, 1.2, '#e8e8e4');
        }
        // ---- Lamps ----
        const s = plan.stab;
        heliNavLights(k, s.x + 0.6, s.y, s.span + 0.3, s.x - 0.7);
        heliLens(k, HELI_CH.navWhite, '#fff6e6', -46.5, 15.4, 0, 0.32, 0.38, 0.38);
        anchors.push({ x: -46.8, y: 15.4, z: 0, size: 7, color: '#fff4e0', channel: HELI_CH.navWhite, strength: 1 });
        heliBeacon(k, -45.5, 22.1, 0.4);
        heliBeacon(k, 5, stationAt(5).yb + 0.05, -0.4);
        // Landing lights in the nose.
        for (const z of [-1.1, 1.1]) {
          heliLens(k, HELI_CH.work, '#fff8e8', 27.7, 8.2, z, 0.3, 0.6, 0.6);
          anchors.push({ x: 28.2, y: 8.2, z, size: 13, color: '#fff3d6', channel: HELI_CH.work, strength: 0.8 });
        }
      }
      // The police Nightsun: head on a yaw / pitch gimbal, pointing along +x.
      function heliNightsunParts(S) {
        const head = policeSet(),
          lens = policeSet();
        policeAdd(head, S.cylinder, 0.2, 0, 0, 1.25, 3.4, 1.25, '#2b2e33', null, 0, 0, Math.PI / 2);
        policeAdd(head, S.cylinder, 1.95, 0, 0, 1.45, 0.45, 1.45, '#6c7177', null, 0, 0, Math.PI / 2);
        policeAdd(head, S.sphere, -1.5, 0, 0, 0.9, 1.0, 1.0, '#2b2e33');
        policeAdd(head, boxGeo, 0, 1.25, 0, 0.8, 0.9, 0.5, '#44484d');
        policeAdd(lens, S.disc, 2.2, 0, 0, 1.2, 1.2, 1, '#fff6e2', { channel: HELI_CH.work }, 0, Math.PI / 2, 0);
        return { head: policeGeometry(head), lens: policeGeometry(lens, { channels: true }) };
      }
      // ---- Utility (UH-60 Black Hawk class) equipment -------------------------------------------
      function heliHawkEquipment(k) {
        const { plan, look, S, trim, metal, lights, anchors, stationAt } = k,
          dark = '#1c1e1b',
          grey = '#3c4039',
          od = look.paint;
        // Main gear: struts from the sponsons, drag beams, wheels; the tail wheel.
        for (const side of [-1, 1]) {
          const z = side * 11.2;
          policeAdd(trim, boxGeo, 13, 8.2, side * 8.9, 6.5, 2.2, 1.8, od);
          heliRod(metal, [13.6, 8.1, side * 9.2], [12.4, 3.6, z], 0.55, '#7d8279');
          heliRod(trim, [18.5, 7.3, side * 8.2], [12.6, 3.8, z - side * 0.6], 0.4, grey);
          policeAdd(trim, wheelGeo, 12.4, 3.3, z, 3.3, 2.2, 3.3, '#161716', null, Math.PI / 2);
          policeAdd(metal, S.cylinder, 12.4, 3.3, z + side * 1.15, 1.6, 0.3, 1.6, '#8a8f86', null, Math.PI / 2);
        }
        heliRod(trim, [-40, 15.2, 0], [-41.8, 3.6, 0], 0.5, grey);
        policeAdd(trim, wheelGeo, -41.8, 2.3, 0, 2.3, 1.4, 2.3, '#161716', null, Math.PI / 2);
        policeAdd(trim, boxGeo, -41.8, 3.2, 0, 1.2, 1.5, 2.4, grey);
        // Engines: intakes, the turned-out exhaust suppressors, the rotor mast base.
        for (const side of [-1, 1]) {
          const z = side * 5.1;
          policeAdd(trim, S.cylinder, 11.0, 23.2, z, 2.0, 0.35, 2.0, dark, null, 0, 0, Math.PI / 2);
          policeAdd(metal, S.sphere, 11.2, 23.2, z, 0.8, 0.8, 0.8, '#5c6059');
          policeAdd(trim, boxGeo, -15.4, 23.4, z + side * 0.9, 4.4, 2.4, 3.2, grey, null, side * 0.25, side * 0.45, 0);
          policeAdd(trim, boxGeo, -17.3, 23.6, z + side * 2.0, 0.4, 1.9, 2.5, '#0b0c0b', null, side * 0.25, side * 0.45, 0);
        }
        policeAdd(trim, S.cylinder, plan.rotor.x, 25.9, 0, 2.0, 1.2, 2.0, grey);
        policeAdd(metal, S.cylinder, plan.rotor.x, 26.9, 0, 2.7, 0.45, 2.7, '#7c8279');
        // IR jammer behind the pylon, antennas, cable cutters, steps and handholds.
        policeAdd(trim, S.cylinder, -14.4, 22.6, 0, 1.3, 2.6, 1.3, dark);
        policeAdd(trim, S.sphere, -14.4, 24.0, 0, 1.3, 0.6, 1.3, '#23261f');
        policeAdd(trim, boxGeo, -31, 19.3, 0, 1.5, 2.2, 0.15, dark, null, 0, 0, 0.35);
        policeAdd(trim, boxGeo, 22, 22.6, 0, 1.5, 1.6, 0.15, dark, null, 0, 0, 0.35);
        policeAdd(trim, boxGeo, 38.2, 20.8, 0, 3.6, 1.1, 0.18, '#2b2e2a', null, 0, 0, -0.4);
        policeAdd(trim, boxGeo, 44.3, 7.4, 0, 3.2, 0.8, 0.18, '#2b2e2a', null, 0, 0, 0.55);
        for (const side of [-1, 1]) {
          const z = heliSurfaceZ(stationAt(29), 9.2, side) + side * 0.2;
          policeAdd(trim, boxGeo, 29, 9.2, z, 1.6, 0.3, 0.6, dark);
          // The sliding door's rail fairing above the door.
          const rz = heliSurfaceZ(stationAt(8), 21.3, side) + side * 0.12;
          policeAdd(trim, boxGeo, 5.5, 21.3, rz, 26, 0.35, 0.25, grey);
          // M240 on the gunner's window mount.
          const gz = heliSurfaceZ(stationAt(21), 15.5, side) + side * 0.6;
          policeAdd(trim, boxGeo, 21, 15.4, gz, 2.2, 0.8, 0.7, '#1b1c1a');
          heliRod(trim, [22, 15.5, gz + side * 0.2], [26.6, 15.2, gz + side * 1.7], 0.22, '#141514');
        }
        // Tail rotor gearbox and drive fairing on the pylon.
        const t = plan.tailRotor;
        policeAdd(trim, boxGeo, t.x, t.y, 0.8, 2.6, 2.8, 1.6, grey);
        policeAdd(trim, S.cylinder, t.x, t.y, t.z * 0.7, 0.7, 1.2, 0.7, grey, null, Math.PI / 2);
        // ---- Lamps ----
        const lens = (ch, color, x, y, z, sx, sy, sz, geo = S.sphere) => policeAdd(lights, geo, x, y, z, sx, sy, sz, color, { channel: ch });
        for (const side of [-1, 1]) {
          const z = heliSurfaceZ(stationAt(19), 21, side) + side * 0.25,
            navColor = side < 0 ? '#ff3a2c' : '#3dff79',
            ch = side < 0 ? HELI_CH.navRed : HELI_CH.navGreen;
          lens(ch, navColor, 19, 21, z, 0.55, 0.45, 0.35);
          anchors.push({ x: 19, y: 21, z: z + side * 0.4, size: 7, color: navColor, channel: ch, strength: 1 });
          // Formation light strips (dim green) on the cabin and the pylon.
          const fz = heliSurfaceZ(stationAt(6), 19.6, side) + side * 0.1;
          lens(HELI_CH.navGreen, '#2a8a44', 6, 19.6, fz, 3.6, 0.3, 0.12, boxGeo);
          lens(HELI_CH.navGreen, '#2a8a44', -45.4, 27, side * (plan.fin.thick / 2 + 0.38), 0.3, 3.4, 0.1, boxGeo);
        }
        lens(HELI_CH.navWhite, '#fff6e6', -51.4, 20.6, 0, 0.4, 0.45, 0.45);
        anchors.push({ x: -51.8, y: 20.6, z: 0, size: 7, color: '#fff4e0', channel: HELI_CH.navWhite, strength: 1 });
        for (const [x, y, sy] of [
          [-48.2, 36.3, 0.4],
          [4, 5.8, -0.4],
        ]) {
          lens(HELI_CH.beacon, '#ff2a1e', x, y, 0, 0.75, 0.5, 0.75, S.dome);
          anchors.push({ x, y: y + sy, z: 0, size: 12, color: '#ff3326', channel: HELI_CH.beacon, strength: 1 });
        }
        lens(HELI_CH.strobe, '#ffffff', -20, 19.6, 0, 0.45, 0.4, 0.45);
        anchors.push({ x: -20, y: 20, z: 0, size: 18, color: '#ffffff', channel: HELI_CH.strobe, strength: 1 });
        for (const z of [-1.8, 1.8]) {
          lens(HELI_CH.work, '#fff8e8', 36, 6.25, z, 0.9, 0.3, 0.9);
          anchors.push({ x: 36.4, y: 5.9, z, size: 13, color: '#fff3d6', channel: HELI_CH.work, strength: 0.8 });
        }
      }
      // ---- Cabin: instrument panel, seats, sticks, the crew ----------------------------------------
      function heliCabin(k) {
        const { plan, look, S, interior, lights, crew } = k,
          seats = plan.seats,
          floor = plan.cabin.floor,
          seat = look.seat,
          dash = plan.dash,
          frame = '#2c2f33';
        // Instrument panel with its glareshield, screens on the pilots' side.
        const panel = plan.panel || 5.2;
        policeAdd(interior, boxGeo, dash + 0.9, floor + 4.5, 0, 2.2, 3.4, panel * 2, '#1f2124');
        policeAdd(interior, boxGeo, dash + 1.5, floor + 6.35, 0, 3.4, 0.45, panel * 2 + 0.8, '#141517');
        for (const z of [-panel / 2, panel / 2])
          for (const dz of [-1.05, 1.05]) policeAdd(lights, boxGeo, dash - 0.25, floor + 4.9, z + dz, 0.08, 1.5, 1.7, '#5fb3d8', { channel: HELI_CH.navWhite });
        policeAdd(interior, boxGeo, (seats.front + dash) / 2 + 0.6, floor + 1.4, 0, dash - seats.front - 1.5, 2.8, 2.0, '#232528');
        const chair = (x, z, height = 1) => {
          policeAdd(interior, boxGeo, x, floor + 2.3, z, 3.6, 0.9, 3.3, seat);
          policeAdd(interior, boxGeo, x - 2.0, floor + 5.0 * height, z, 0.9, 5.2 * height, 3.3, seat, null, 0, 0, 0.18);
          policeAdd(interior, boxGeo, x, floor + 1.1, z, 2.6, 2.2, 2.6, frame);
        };
        for (const side of [-1, 1]) {
          const z = side * seats.side;
          chair(seats.front, z);
          policeAdd(interior, boxGeo, seats.front - 2.6, floor + 8.1, z, 0.8, 1.5, 2.2, seat, null, 0, 0, 0.18);
          // Cyclic between the knees, collective beside the seat, pedals.
          heliRod(interior, [seats.front + 3.2, floor + 0.2, z], [seats.front + 3.4, floor + 4.6, z], 0.18, '#111214');
          heliRod(interior, [seats.front - 0.8, floor + 1.4, z - 2.2], [seats.front + 2.4, floor + 3.2, z - 2.2], 0.16, '#111214');
          for (const dz of [-0.8, 0.8]) policeAdd(interior, boxGeo, dash - 1.4, floor + 1.2, z + dz, 0.4, 1.6, 0.8, '#3a3d42');
        }
        for (const z of seats.rearSides) chair(seats.rear, z, 0.95);
        // Crew in flight suits and helmets: pilot on the right, observer on the left.
        const person = (set, z) => {
          const x = seats.front,
            suit = look.suit;
          policeAdd(set, S.sphere, x - 0.9, floor + 5.6, z, 1.4, 2.4, 1.55, suit);
          policeAdd(set, S.sphere, x - 0.8, floor + 7.3, z, 1.15, 0.9, 1.75, suit);
          policeAdd(set, S.cylinder, x - 0.6, floor + 8.0, z, 0.55, 0.8, 0.55, '#c49a7c');
          policeAdd(set, S.sphere, x - 0.5, floor + 9.0, z, 1.2, 1.25, 1.1, look.helmet);
          policeAdd(set, S.sphere, x + 0.35, floor + 8.9, z, 0.6, 0.62, 0.95, '#0b0f14');
          for (const dz of [-1, 1]) {
            heliRod(set, [x - 0.6, floor + 7.2, z + dz * 1.45], [x + 1.6, floor + 5.2, z + dz * 1.35], 0.42, suit);
            heliRod(set, [x + 1.6, floor + 5.2, z + dz * 1.35], [x + 3.2, floor + 4.6, z + dz * 0.6], 0.36, suit);
            heliRod(set, [x - 0.4, floor + 3.3, z + dz * 0.7], [x + 3.4, floor + 3.6, z + dz * 0.75], 0.55, suit);
            heliRod(set, [x + 3.4, floor + 3.6, z + dz * 0.75], [dash - 1.8, floor + 1.0, z + dz * 0.8], 0.45, suit);
          }
        };
        person(crew.pilot, seats.side);
        person(crew.observer, -seats.side);
      }
