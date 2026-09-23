      // BEGIN SUBSYSTEM: src/transit3d.js — Railway meshes
      /**
       * Railway meshes
       * Source: src/transit3d.js
       * Scope: createCityRenderer() closure.
       * A continuous viaduct (deck, parapets, ballast bed, two rails on sleepers),
       * piers of three kinds, catenary masts, detailed stations (platforms,
       * canopies, departure boards, benches, kiosks, passengers, stair towers) and
       * articulated trains with lit windows and headlights at night.
       *
       * DESIGN NOTES
       * Geometry follows transit.js exactly: each line's `points` is the smoothed
       * track, swept here into one extrusion per ~600-unit run; railPiers are the
       * supports and RAIL_STATIONS the stops. The train rides at elevation 62
       * (RAIL_DECK_TOP + 2). Repeated pieces (sleepers, masts, pier shafts and
       * caps) are InstancedMesh pools placed by arc length along the track;
       * station groups are pushed to `statics` for distance culling and to
       * `batchGroups` so their small meshes are merged after construction.
       */
      const railConcrete = mat('#8b948f', 0.9),
        railSteel = mat('#5f7079', 0.45, 0.65),
        // Worn rail heads: a glint, not a mirror. Polished (0.25 rough, 0.8 metal)
        // they caught the sun along whole curves from the air and bloomed into a
        // white streak over the viaduct.
        railTrack = mat('#b4bcbf', 0.42, 0.7),
        railWood = mat('#5c5346'),
        railParapet = mat('#a3aba6', 0.85),
        railGlassCanopy = new Three.MeshStandardMaterial({
          color: '#9fc7d6',
          roughness: 0.15,
          metalness: 0.4,
          transparent: true,
          opacity: 0.55,
        }),
        railPaint = mat('#c6533f', 0.5, 0.3),
        railModels = new Map(),
        railFades = [],
        railLampHalos = [];
      const ballastTexture = canvasTexture(128, (g, s) => {
        g.fillStyle = '#6d6a66';
        g.fillRect(0, 0, s, s);
        speckle(g, s, 900, ['#8b877f', '#57544f', '#a09b92', '#4a4744'], 0.7, 1.9);
      });
      ballastTexture.repeat.set(4, 1);
      const ballastMat = new Three.MeshStandardMaterial({ map: ballastTexture, roughness: 0.95 });
      const railPools = {
        tie: instanced(boxGeo, railWood, 6000),
        mast: instanced(boxGeo, railSteel, 900),
        mastArm: instanced(boxGeo, railSteel, 900),
        pierShaft: instanced(boxGeo, railConcrete, 1600),
        pierCap: instanced(boxGeo, railConcrete, 1600),
        lamp: instanced(boxGeo, warmLamp, 900),
      };
      // ---- Viaduct -----------------------------------------------------------------
      /**
       * The viaduct is swept, not stacked: each cross-section below is extruded
       * along a line's whole track with mitred joints, so the deck, the ballast
       * bed, the rails and the parapets run through every curve without a seam.
       * (One box per segment left a wedge-shaped gap on the outside of each bend
       * and an overlap on the inside, which is what made the curves look patchy.)
       * Profiles are [offset from the centre line, elevation] pairs, listed left
       * to right over the top, so a face's outward normal is (-dh, do).
       */
      const RAIL_SECTIONS = [
        // Box-girder deck with its parapet walls.
        {
          part: 'deck',
          closed: true,
          points: [[-23, 52], [-23, 63.4], [-20.6, 63.4], [-20.6, 58], [20.6, 58], [20.6, 63.4], [23, 63.4], [23, 52]],
        },
        // Ballast bed with sloped shoulders.
        { part: 'ballast', points: [[-15.5, 58.05], [-12.8, 59.5], [12.8, 59.5], [15.5, 58.05]] },
        // Two running rails, standard spacing for the bogies at +-8.5.
        ...[-8.5, 8.5].map((o) => ({
          part: 'rail',
          points: [[o - 0.8, 60.3], [o - 0.8, 61.9], [o + 0.8, 61.9], [o + 0.8, 60.3]],
        })),
        // Steel coping along both parapets.
        ...[-1, 1].map((side) => ({
          part: 'steel',
          points: [[side * 21.8 - 1.5, 63.4], [side * 21.8 - 1.5, 64.2], [side * 21.8 + 1.5, 64.2], [side * 21.8 + 1.5, 63.4]],
        })),
      ];
      // Mitred frame at each vertex of a run: the unit normal (left of travel) and
      // the stretch that keeps the section's width true through the joint.
      function railFrames(track) {
        return track.map((p, i) => {
          const prev = track[Math.max(0, i - 1)],
            next = track[Math.min(track.length - 1, i + 1)],
            d0 = i > 0 ? Math.atan2(p[1] - prev[1], p[0] - prev[0]) : null,
            d1 = i < track.length - 1 ? Math.atan2(next[1] - p[1], next[0] - p[0]) : null,
            a0 = d0 ?? d1,
            a1 = d1 ?? d0,
            tx = Math.cos(a0) + Math.cos(a1),
            ty = Math.sin(a0) + Math.sin(a1),
            tl = Math.hypot(tx, ty) || 1,
            nx = -ty / tl,
            ny = tx / tl,
            miter = 1 / Math.max(0.5, nx * -Math.sin(a1) + ny * Math.cos(a1));
          return { x: p[0], y: p[1], nx, ny, miter };
        });
      }
      function railSweep(track, along, sections) {
        const frames = railFrames(track),
          position = [],
          normal = [],
          uv = [];
        for (const section of sections) {
          const pts = section.points,
            edges = pts.length - (section.closed ? 0 : 1);
          for (let k = 0; k < edges; k++) {
            const [o0, h0] = pts[k],
              [o1, h1] = pts[(k + 1) % pts.length],
              en = Math.hypot(h1 - h0, o1 - o0),
              no = -(h1 - h0) / en,
              nh = (o1 - o0) / en;
            for (let i = 0; i < frames.length - 1; i++) {
              const quad = [
                [frames[i], o0, h0, along[i], 0],
                [frames[i], o1, h1, along[i], 1],
                [frames[i + 1], o1, h1, along[i + 1], 1],
                [frames[i + 1], o0, h0, along[i + 1], 0],
              ].map(([f, o, h, s, v]) => ({
                p: [f.x + f.nx * o * f.miter, h, f.y + f.ny * o * f.miter],
                n: [f.nx * no, nh, f.ny * no],
                t: [s / 30, v],
              }));
              // Wind each quad so its face points the way its profile edge does.
              const [a, b, c] = quad,
                ux = b.p[0] - a.p[0],
                uy = b.p[1] - a.p[1],
                uz = b.p[2] - a.p[2],
                vx = c.p[0] - a.p[0],
                vy = c.p[1] - a.p[1],
                vz = c.p[2] - a.p[2],
                facing = (uy * vz - uz * vy) * a.n[0] + (uz * vx - ux * vz) * a.n[1] + (ux * vy - uy * vx) * a.n[2],
                order = facing >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
              for (const j of order) {
                position.push(...quad[j].p);
                normal.push(...quad[j].n);
                uv.push(...quad[j].t);
              }
            }
          }
        }
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geometry.setAttribute('normal', new Three.Float32BufferAttribute(normal, 3));
        geometry.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geometry.computeBoundingSphere();
        return geometry;
      }
      ballastTexture.repeat.set(1, 1);
      const railPartMaterial = { deck: railConcrete, ballast: ballastMat, rail: railTrack, steel: railSteel };
      for (const line of RAIL_LINES) {
        // Cut the line into runs of about 600 units for culling and fading.
        const along = [0];
        for (let i = 1; i < line.points.length; i++)
          along.push(along[i - 1] + Math.hypot(line.points[i][0] - line.points[i - 1][0], line.points[i][1] - line.points[i - 1][1]));
        let first = 0;
        while (first < line.points.length - 1) {
          let last = first + 1;
          while (last < line.points.length - 1 && along[last] - along[first] < 600) last++;
          const track = line.points.slice(first, last + 1),
            runAlong = along.slice(first, last + 1),
            group = new Three.Group(),
            materials = [];
          group.name = 'Elevated railway';
          scene.add(group);
          for (const part of ['deck', 'ballast', 'rail', 'steel']) {
            const material = railPartMaterial[part].clone();
            material.transparent = true;
            materials.push(material);
            const m = new Three.Mesh(
              railSweep(track, runAlong, RAIL_SECTIONS.filter((s) => s.part === part)),
              material,
            );
            m.castShadow = part === 'deck';
            m.receiveShadow = true;
            m.userData.dynamic = true;
            group.add(m);
          }
          const decks = railDecks().filter((b) =>
              track.some((p, i) => i && Math.abs(b.x - (p[0] + track[i - 1][0]) / 2) < 0.01 && Math.abs(b.y - (p[1] + track[i - 1][1]) / 2) < 0.01),
            ),
            mid = track[Math.floor(track.length / 2)];
          const radius = (runAlong.at(-1) - runAlong[0]) / 2 + 160;
          railFades.push({ decks, materials, x: mid[0], y: mid[1], radius });
          statics.push({ x: mid[0], y: mid[1], group, radius });
          first = last;
        }
        // Sleepers every 6 units, masts every 96 on the outer edge with a lamp on
        // every other one, and expansion joints every 48; none on a platform.
        const nearStation = (p, r) => RAIL_STATIONS.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < r);
        for (const p of railTrackSamples(line, 3, 6))
          place(railPools.tie, p.x, 60, p.y, 2.2, 0.8, 22, -p.a);
        for (const [k, p] of railTrackSamples(line, 48, 96).entries()) {
          if (nearStation(p, 100)) continue;
          const nx = -Math.sin(p.a),
            ny = Math.cos(p.a),
            mx = p.x + nx * 24,
            mz = p.y + ny * 24;
          place(railPools.mast, mx, 74, mz, 1.6, 26, 1.6, -p.a);
          place(railPools.mastArm, p.x + nx * 14, 85, p.y + ny * 14, 1.2, 1.2, 22, -p.a);
          if (k % 2) continue;
          place(railPools.lamp, mx - nx * 2, 70, mz - ny * 2, 3, 1.5, 3, -p.a);
          railLampHalos.push({ sprite: halo(scene, mx - nx * 2, 70, mz - ny * 2, 16, '#ffe1b3'), x: mx, y: mz });
        }
      }
      // ---- Piers -----------------------------------------------------------------
      for (const p of railPiers) {
        const px = p.x + p.w / 2,
          pz = p.y + p.h / 2,
          dx = p.cx - px,
          dz = p.cy - pz,
          yaw = Math.atan2(dx, dz);
        if (p.kind === 'marine') {
          // Pile: the shaft runs down past the waterline to a submerged cap, and a
          // cap beam under the deck reaches across to its partner.
          place(railPools.pierShaft, px, 22, pz, 6, 64, 6, yaw);
          place(railPools.pierShaft, px, -9, pz, 9, 10, 9, yaw);
        } else {
          place(railPools.pierShaft, px, 24, pz, p.kind === 'straddle' ? 6.5 : 7.5, 48, p.kind === 'straddle' ? 6.5 : 7.5, yaw);
          place(railPools.pierShaft, px, 3, pz, 11, 6, 11, yaw);
        }
        // Cross-head to the centre line; the partner's meets it there.
        const reach = Math.hypot(dx, dz);
        place(railPools.pierCap, (px + p.cx) / 2, 49.5, (pz + p.cy) / 2, 8, 5, reach + 5, yaw);
        place(railPools.pierCap, px, 49, pz, 11, 3, 11, yaw);
      }
      for (const im of Object.values(railPools)) im.instanceMatrix.needsUpdate = true;
      // ---- Stations -------------------------------------------------------------
      const departureBoards = [];
      function departureBoard(parent, x, y, z, yaw, stationName) {
        const cv = document.createElement('canvas');
        cv.width = 512;
        cv.height = 128;
        const g = cv.getContext('2d');
        g.fillStyle = '#0d1418';
        g.fillRect(0, 0, 512, 128);
        g.fillStyle = '#f2b94a';
        g.font = '700 34px monospace';
        g.textBaseline = 'middle';
        g.fillText(stationName, 18, 32);
        g.fillStyle = '#9fe8b8';
        g.font = '600 26px monospace';
        g.fillText('NEXT TRAIN   2 MIN', 18, 72);
        g.fillText('ALL STOPS    7 MIN', 18, 104);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        const board = new Three.Mesh(
          new Three.PlaneGeometry(30, 7.5),
          new Three.MeshBasicMaterial({ map: tx, toneMapped: false, side: Three.DoubleSide }),
        );
        board.position.set(x, y, z);
        board.rotation.y = yaw;
        board.userData.sign = true;
        parent.add(board);
        box(parent, x, y, z, 31, 8.5, 1, darkMetal).rotation.y = yaw;
        departureBoards.push(board);
        return board;
      }
      const passengerMats = ['#c96b5a', '#5d7fa6', '#d9b56a', '#7a9b6a', '#8a6b9a', '#e0d8c5'].map((c) => mat(c, 0.85));
      function passenger(parent, x, z, yaw, seated, i) {
        const g = new Three.Group();
        g.position.set(x, seated ? 58.5 : 60.5, z);
        g.rotation.y = yaw;
        parent.add(g);
        const cloth = passengerMats[i % passengerMats.length];
        box(g, 0, seated ? 6.5 : 9.5, 0, 4.2, seated ? 5 : 6.5, 5.5, cloth);
        mesh(sphereGeo, mat(['#d6af88', '#b88964', '#875e43'][i % 3]), g, 0, seated ? 11.5 : 14.5, 0, 2, 2.4, 2);
        if (seated) {
          box(g, 2.6, 3.2, 0, 4, 1.8, 5, mat('#343b44'));
        } else {
          box(g, 0, 3, 1.3, 2, 6, 2.2, mat('#343b44'));
          box(g, 0, 3, -1.3, 2, 6, 2.2, mat('#343b44'));
        }
      }
      for (const [si, s] of RAIL_STATIONS.entries()) {
        const group = new Three.Group();
        group.name = s.name + ' station';
        scene.add(group);
        batchGroups.push(group);
        const a = railStationAngle(s),
          platform = new Three.Group();
        platform.position.set(s.x, 0, s.y);
        platform.rotation.y = -a;
        group.add(platform);
        const lift = railLift(s),
          access = railAccessEnd(s),
          accessSide = Math.sign(-(access.x - s.x) * Math.sin(a) + (access.y - s.y) * Math.cos(a)) || 1;
        for (const side of [-1, 1]) {
          // Platform slab, tactile edge strip, yellow line, canopy with glass roof.
          box(platform, 0, 56.5, side * 33, 168, 5, 20, railConcrete);
          box(platform, 0, 59.2, side * 24.5, 162, 0.5, 2.2, mat('#d8b64a', 0.8));
          box(platform, 0, 59.15, side * 27.5, 162, 0.4, 3, mat('#9a9f9a', 0.95));
          for (const x of [-70, -35, 0, 35, 70]) {
            box(platform, x, 74, side * 40, 1.8, 30, 1.8, railSteel);
            box(platform, x, 88.5, side * 33, 1.4, 1.4, 24, railSteel);
          }
          box(platform, 0, 89.5, side * 33, 176, 0.6, 26, railGlassCanopy).userData.dynamic = true;
          box(platform, 0, 89, side * 33, 178, 0.8, 1.2, railSteel);
          box(platform, 0, 89, side * 45.5, 178, 0.8, 1.2, railSteel);
          // Under-canopy lights.
          for (const x of [-60, -20, 20, 60]) {
            box(platform, x, 87.5, side * 33, 6, 0.8, 1.6, warmLamp);
            railLampHalos.push({ sprite: halo(platform, x, 86, side * 33, 20, '#ffe9c4'), x: s.x, y: s.y });
          }
          // Benches, bins and a route-map board.
          for (const x of [-52, 0, 52]) {
            box(platform, x, 61.5, side * 41, 16, 1, 4.5, railWood);
            box(platform, x, 64, side * 43, 16, 4, 0.8, railWood);
            for (const dx of [-6.5, 6.5]) box(platform, x + dx, 60.2, side * 41, 1, 2.4, 4, darkMetal);
          }
          mesh(cylinderGeo, mat('#3f5a4a', 0.7, 0.3), platform, 76, 62, side * 41, 2.4, 5.5, 2.4);
          box(platform, -76, 66, side * 43, 10, 9, 0.8, mat('#e8e2d2', 0.8));
          box(platform, -76, 66, side * 43.5, 8.5, 7, 0.3, mat(['#e2b766', '#67c6bd', '#b3a1d8'][si % 3], 0.6));
          // Station name signs hanging from the canopy at both ends.
          for (const x of [-60, 60]) {
            const nameSign = sign(s.name, 0, 0, 44, '#e9f1ea');
            nameSign.position.set(x, 80, side * 33);
            nameSign.rotation.y = 0;
            nameSign.userData.backing.position.set(x, 80, side * 33 - 1.5);
            group.remove(nameSign);
            group.remove(nameSign.userData.backing);
            platform.add(nameSign);
            platform.add(nameSign.userData.backing);
          }
          // Departure board facing along the platform.
          departureBoard(platform, 30 * -side, 78, side * 33, side > 0 ? 0 : Math.PI, s.name);
          // Waiting passengers.
          for (let k = 0; k < 4; k++) {
            const seatedHere = k % 2 === 0,
              x = seatedHere ? -52 + k * 26 : -30 + k * 24 + (si % 3) * 6;
            passenger(platform, x, side * (seatedHere ? 41 : 30), seatedHere ? (side > 0 ? Math.PI : 0) : (k % 2 ? 0.4 : -0.6), seatedHere, si * 4 + k + (side > 0 ? 2 : 0));
          }
        }
        // Clocks on the central canopy posts.
        for (const x of [-35, 35]) {
          mesh(new Three.CylinderGeometry(3.2, 3.2, 0.8, 20), mat('#f4f1e8'), platform, x, 82, 0).rotation.z = Math.PI / 2;
          box(platform, x + 0.5, 82, 0, 0.2, 2.2, 0.4, darkMetal);
          box(platform, x + 0.5, 82.6, 0.8, 0.2, 0.4, 1.6, darkMetal);
        }
        // Street-level access: stair and lift tower, footbridge to the platform, turnstiles.
        const ex = lift.x,
          ez = lift.y,
          towerMat = mat('#a6bab6', 0.4, 0.35);
        box(group, ex, 30, ez, 18, 60, 18, towerMat);
        for (let y = 8; y < 56; y += 12) box(group, ex, y, ez + 9.2, 12, 6, 0.5, glass);
        box(group, ex, 61, ez, 22, 2, 22, railConcrete);
        box(group, ex, 62.5, ez, 8, 1.4, 8, railSteel);
        box(group, ex + 12, 6, ez, 6, 12, 8, mat('#2d3b44', 0.6, 0.3));
        for (let step = 0; step < 6; step++) box(group, ex + 10, 1 + step * 2, ez - 6 - step * 2.2, 8, 2, 2.2, railConcrete);
        const entranceSign = sign('M · ' + s.name, ex, ez - 13, 105, '#b7e5d5');
        entranceSign.position.y = entranceSign.userData.backing.position.y = 24;
        railLampHalos.push({ sprite: halo(group, ex, 26, ez - 12, 34, '#9be3d0'), x: ex, y: ez });
        // Turnstile pair at the base of the tower.
        for (const dx of [-7, 7]) {
          box(group, ex + dx, 5, ez - 14, 1.5, 10, 4, railSteel);
          box(group, ex + dx, 6.5, ez - 12.5, 5, 0.4, 0.4, chrome);
        }
        const dx = access.x - ex,
          dz = access.y - ez,
          len = Math.hypot(dx, dz),
          bridge = new Three.Group();
        bridge.position.set((ex + access.x) / 2, 0, (ez + access.y) / 2);
        bridge.rotation.y = -Math.atan2(dz, dx);
        group.add(bridge);
        box(bridge, 0, 58.8, 0, len, 4, 14, railConcrete);
        for (const z of [-7, 7]) {
          box(bridge, 0, 62.5, z, len, 0.8, 0.8, railSteel);
          for (let x = -len / 2 + 6; x < len / 2; x += 12) box(bridge, x, 61.5, z, 0.8, 5, 0.8, railSteel);
        }
        box(bridge, 0, 66, 0, len, 0.6, 16, railGlassCanopy).userData.dynamic = true;
        // Kiosk on the access-side platform end.
        box(platform, 88 * -accessSide, 63.5, accessSide * 33, 10, 9, 8, mat('#b7413a', 0.7));
        box(platform, 88 * -accessSide, 68.5, accessSide * 33, 12, 1, 10, mat('#efe6d3', 0.9));
        statics.push({ x: s.x, y: s.y, group, radius: 240 });
      }
      // ---- Trains ----------------------------------------------------------------
      function makeRailTrain(t) {
        const group = new Three.Group();
        scene.add(group);
        const bodyMat = mat('#dfe3e1', 0.35, 0.5),
          stripe = mat(t.color, 0.4, 0.4),
          dark = mat('#1f2f3a', 0.24, 0.6),
          windowMat = new Three.MeshStandardMaterial({
            color: '#243a48',
            roughness: 0.15,
            metalness: 0.6,
            emissive: '#ffe2b0',
            emissiveIntensity: 0,
          }),
          cars = [];
        for (let j = 0; j < 3; j++) {
          const car = new Three.Group();
          car.position.x = -j * 58;
          group.add(car);
          cars.push(car);
          box(car, 0, 9.5, 0, 54, 13, 22, bodyMat);
          box(car, 0, 4.2, 0, 54, 2.6, 21, dark);
          box(car, 0, 16.8, 0, 50, 1.6, 20, mat('#aeb5b3', 0.5, 0.4));
          box(car, 0, 7.4, 0, 54.2, 2.2, 22.4, stripe);
          for (const z of [-11.3, 11.3]) {
            box(car, 0, 11.5, z, 46, 5.5, 0.6, windowMat);
            for (const x of [-20, 20]) box(car, x, 9, z, 7, 11, 0.8, dark);
            for (const x of [-12, 0, 12]) box(car, x, 11.5, z + 0.1, 0.8, 6, 0.9, bodyMat);
          }
          // Roof equipment and bogies.
          box(car, -8, 18.2, 0, 14, 1.6, 9, mat('#7e8a8c', 0.5, 0.5));
          box(car, 14, 18, 0, 6, 1.2, 6, mat('#7e8a8c', 0.5, 0.5));
          for (const x of [-17, 17]) {
            box(car, x, 2.6, 0, 12, 2.4, 16, dark);
            for (const z of [-8.5, 8.5]) {
              const w = mesh(wheelGeo, rubber, car, x - 4, 2.4, z, 2.6, 2, 2.6);
              w.rotation.x = Math.PI / 2;
              const w2 = mesh(wheelGeo, rubber, car, x + 4, 2.4, z, 2.6, 2, 2.6);
              w2.rotation.x = Math.PI / 2;
            }
          }
          if (j === 0) {
            // Streamlined cab: sloped nose, windscreen, headlights and destination display.
            const nose = box(car, 29, 9.5, 0, 6, 12, 21, bodyMat);
            nose.rotation.z = -0.35;
            box(car, 30, 11.5, 0, 1.2, 6, 17, dark);
            box(car, 31.5, 14, 0, 0.6, 2.2, 14, new Three.MeshBasicMaterial({ color: '#fff0c8', toneMapped: false }));
            for (const z of [-7, 7]) {
              box(car, 31.8, 6.5, z, 0.6, 2, 3, warmLamp);
              group.userData.headlights = group.userData.headlights || [];
              group.userData.headlights.push(halo(car, 33, 6.5, z, 14, '#fff1cc'));
            }
          }
          if (j === 2)
            for (const z of [-7, 7]) box(car, -27.6, 6.5, z, 0.6, 1.6, 2.4, tailLamp);
        }
        group.userData.windowMat = windowMat;
        return group;
      }
      function updateTransitVisuals() {
        const night = nightAmount;
        for (const t of railTrains) {
          let m = railModels.get(t);
          if (!m) {
            m = makeRailTrain(t);
            railModels.set(t, m);
          }
          m.position.set(0, 62, 0);
          m.rotation.y = 0;
          for (let i = 0; i < m.children.length; i++) {
            const car = m.children[i],
              p = railCarPosition(t, i * 58);
            car.position.set(p.x, 0, p.y);
            car.rotation.y = -p.a;
          }
          m.visible = Math.hypot(t.x - cameraTarget.x, t.y - cameraTarget.y) < 7000 / worldZoom;
          m.userData.windowMat.emissiveIntensity = 0.9 * night;
          for (const h of m.userData.headlights || []) h.material.opacity = 0.15 + 0.85 * night;
        }
        for (const [t, m] of railModels)
          if (!railTrains.includes(t)) {
            scene.remove(m);
            collectResources(m, retiredGeometries, retiredMaterials);
            railModels.delete(t);
          }
        // A run of viaduct turns see-through while the player is underneath it.
        const low = !transitRide && entityElevation(player) < 50;
        for (let i = 0; i < railFades.length; i++) {
          const { decks, materials, x, y, radius } = railFades[i],
            under =
              low &&
              Math.hypot(player.x - x, player.y - y) < radius &&
              decks.some((b) => {
                const q = coverLocal(b, player.x, player.y);
                return Math.abs(q.x) < b.hx + 2 && Math.abs(q.y) < 45;
              });
          if (materials[0].opacity === (under ? 0.22 : 1)) continue;
          for (const material of materials) {
            material.opacity = under ? 0.22 : 1;
            material.depthWrite = !under;
          }
        }
        const glow = 0.08 + 0.92 * night;
        for (let i = 0; i < railLampHalos.length; i++) railLampHalos[i].sprite.material.opacity = glow;
      }
      // END SUBSYSTEM: src/transit3d.js
