      // Theme park 3D Sunset Palace carousel, teacups and flume boats (updateFlume).
      // ---- The Sunset Palace ----------------------------------------------------------
      /**
       * A crescent hotel opening to the lagoon: two stepped wings on an arc, joined
       * at the top by a bridge over a great central arch, crowned with a dome.
       */
      {
        const H = PIER.hotel,
          b = parkParts(),
          cx = H.x,
          cy = H.y + 420,
          radius = 460,
          span = H.w / radius,
          segs = 22,
          depth = H.d;
        for (let i = 0; i < segs; i++) {
          const a0 = -Math.PI / 2 - span / 2 + (i / segs) * span,
            a1 = -Math.PI / 2 - span / 2 + ((i + 1) / segs) * span,
            mid = Math.abs(i + 0.5 - segs / 2) / (segs / 2),
            // Tiers step down towards the wing ends.
            top = H.height - Math.floor(mid * 4) * 32,
            arch = Math.abs(i + 0.5 - segs / 2) < 1.6,
            bottom = arch ? H.height - 64 : 0,
            inner = radius - depth / 2,
            outer = radius + depth / 2,
            q = (a, r, z) => new Three.Vector3(cx + Math.cos(a) * r, z, cy + Math.sin(a) * r);
          // Front (south, the concave side) and back faces, and the ends of each tier.
          parkFacadeQuad(b, hotelFacade, q(a0, inner, bottom), q(a1, inner, bottom), q(a1, inner, top), q(a0, inner, top), 14, 12);
          parkFacadeQuad(b, hotelFacade, q(a1, outer, bottom), q(a0, outer, bottom), q(a0, outer, top), q(a1, outer, top), 14, 12);
          b.add(parkMats.cream, boxGeo, parkPlaced((q(a0, radius, 0).x + q(a1, radius, 0).x) / 2, (q(a0, radius, 0).z + q(a1, radius, 0).z) / 2, top + 2, (a1 - a0) * radius + 1, 4, depth + 4, a0 + (a1 - a0) / 2 + Math.PI / 2));
          if (arch) b.add(parkMats.gold, boxGeo, parkPlaced((q(a0, radius, 0).x + q(a1, radius, 0).x) / 2, (q(a0, radius, 0).z + q(a1, radius, 0).z) / 2, bottom - 2, (a1 - a0) * radius + 1, 4, depth + 2, a0 + (a1 - a0) / 2 + Math.PI / 2));
          if (i === 0 || i === segs - 1) {
            const a = i === 0 ? a0 : a1;
            parkFacadeQuad(b, hotelFacade, q(a, outer, 0), q(a, inner, 0), q(a, inner, top), q(a, outer, top), 14, 12);
            if (i === 0) parkFacadeQuad(b, hotelFacade, q(a, inner, 0), q(a, outer, 0), q(a, outer, top), q(a, inner, top), 14, 12);
          }
          const prevTop = H.height - Math.floor((Math.abs(i - 0.5 - segs / 2 + 1) / (segs / 2)) * 4) * 32;
          if (i > 0 && prevTop !== top) {
            const lo = Math.min(prevTop, top),
              hi = Math.max(prevTop, top);
            parkFacadeQuad(b, hotelFacade, q(a0, inner, lo), q(a0, outer, lo), q(a0, outer, hi), q(a0, inner, hi), 14, 12);
            parkFacadeQuad(b, hotelFacade, q(a0, outer, lo), q(a0, inner, lo), q(a0, inner, hi), q(a0, outer, hi), 14, 12);
          }
          // Arch sides.
          if (arch && Math.abs(i + 0.5 - segs / 2) > 0.6) {
            const a = i < segs / 2 ? a0 : a1;
            parkFacadeQuad(b, parkMats.cream, q(a, inner, 0), q(a, outer, 0), q(a, outer, bottom), q(a, inner, bottom), 20, 20);
            parkFacadeQuad(b, parkMats.cream, q(a, outer, 0), q(a, inner, 0), q(a, inner, bottom), q(a, outer, bottom), 20, 20);
          }
        }
        // Crown: a gold dome on a drum over the arch, and minaret-like finials.
        const crown = { x: cx, y: cy - radius };
        b.add(parkMats.cream, new Three.CylinderGeometry(1, 1, 1, 24), parkPlaced(crown.x, crown.y, H.height + 14, 34, 24, 34));
        b.add(parkMats.gold, parkDomeGeo, parkPlaced(crown.x, crown.y, H.height + 26, 34, 34, 34));
        b.add(parkMats.gold, parkConeGeo, parkPlaced(crown.x, crown.y, H.height + 68, 4, 20, 4));
        for (const side of [-1, 1]) {
          const a = -Math.PI / 2 + side * span * 0.28,
            x = cx + Math.cos(a) * radius,
            y = cy + Math.sin(a) * radius,
            t = H.height - 32;
          b.add(parkMats.cream, new Three.CylinderGeometry(1, 1, 1, 12), parkPlaced(x, y, t + 20, 12, 40, 12));
          b.add(parkMats.gold, parkDomeGeo, parkPlaced(x, y, t + 40, 12, 16, 12));
        }
        // Entrance canopy and fountain court in front of the arch.
        b.box(parkMats.gold, parkPlaced(crown.x, crown.y + depth / 2 + 16, 22, 90, 3, 30));
        for (const dx of [-40, 40]) b.add(parkMats.white, parkTubeGeo, parkBetween(parkP3(crown.x + dx, crown.y + depth / 2 + 28, 0), parkP3(crown.x + dx, crown.y + depth / 2 + 28, 21), 1.4));
        b.flush(parkRoot, 'sunset palace');
        for (let i = 0; i < 40; i++) {
          const a = -Math.PI / 2 - span / 2 + (i / 39) * span;
          parkBulbs.add(cx + Math.cos(a) * (radius - depth / 2 - 1), cy + Math.sin(a) * (radius - depth / 2 - 1), 6, 5, '#ffd08a');
        }
        parkBulbs.add(crown.x, crown.y, H.height + 80, 16, '#ffe9b0');
        const s = sign('SUNSET PALACE', crown.x, crown.y + depth / 2 + 3, 90, '#f3cf7a');
        s.position.y = H.height - 90;
        s.userData.backing.position.y = H.height - 90;
      }
      // ---- The beach club -------------------------------------------------------------
      {
        const c = PIER.beachClub,
          b = parkParts();
        // Deck, infinity pool, cabanas, loungers and umbrellas, the club house.
        b.box(parkMats.cream, parkPlaced(c.x + c.w / 2, c.y + 105, 1.2, c.w, 2.4, 90));
        const pool = new Three.Mesh(new Three.PlaneGeometry(300, 44), parkMats.pool);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(c.x + c.w / 2, 2.6, c.y + 105);
        pool.userData.dynamic = true;
        parkRoot.add(pool);
        for (let i = 0; i < 9; i++) {
          const x = c.x + 30 + i * 52,
            y = c.y + 20;
          b.box(parkMats.canvasWhite, parkPlaced(x, y, 9, 20, 1, 20));
          b.add(parkMats.canvasWhite, parkConeGeo, parkPlaced(x, y, 15, 14, 12, 14, Math.PI / 4));
          for (const dx of [-9, 9]) for (const dy of [-9, 9]) b.add(parkMats.wood, parkThinGeo, parkBetween(parkP3(x + dx, y + dy, 0), parkP3(x + dx, y + dy, 9), 0.5));
        }
        for (let i = 0; i < 18; i++) {
          const x = c.x + 20 + i * 26,
            y = c.y + 140;
          b.box(parkMats.white, parkPlaced(x, y, 1.5, 5, 1.2, 12));
          if (i % 2 === 0) {
            b.add(parkMats.wood, parkThinGeo, parkBetween(parkP3(x + 6, y, 0), parkP3(x + 6, y, 14), 0.4));
            b.add(i % 4 ? parkMats.canvasRed : parkMats.canvasWhite, parkConeGeo, parkPlaced(x + 6, y, 15.5, 10, 3, 10));
          }
        }
        b.box(parkMats.white, parkPlaced(c.x + 240, c.y + 35, 16, 180, 32, 50));
        b.box(parkMats.gold, parkPlaced(c.x + 240, c.y + 35, 33, 196, 2, 66));
        b.box(parkMats.glassDark, parkPlaced(c.x + 240, c.y + 60.5, 12, 160, 18, 1));
        b.flush(parkRoot, 'beach club');
        for (let i = 0; i < 20; i++) parkBulbs.add(c.x + 150 + i * 9.5, c.y + 68, 32, 3, '#ffcf8a', i);
      }
      // ---- The gate ------------------------------------------------------------------
      {
        const g = PIER.gate,
          b = parkParts();
        for (const side of [-1, 1]) {
          const x = g.x + side * 77;
          b.box(parkMats.cream, parkPlaced(x, g.y - 15, 55, 45, 110, 30));
          b.box(parkMats.gold, parkPlaced(x, g.y - 15, 112, 49, 4, 34));
          b.add(parkMats.gold, parkDomeGeo, parkPlaced(x, g.y - 15, 114, 20, 24, 20));
          b.add(parkMats.gold, parkConeGeo, parkPlaced(x, g.y - 15, 146, 2, 14, 2));
          // Pointed arch niches.
          for (const dz of [-1, 1]) b.box(parkMats.turquoise, parkPlaced(x, g.y - 15 + dz * 15.2, 45, 18, 50, 0.6));
        }
        // The great arch across the promenade: a lintel carrying the sign.
        b.box(parkMats.cream, parkPlaced(g.x, g.y - 15, 92, 120, 22, 26));
        b.box(parkMats.gold, parkPlaced(g.x, g.y - 15, 104, 124, 3, 30));
        const archGeo = new Three.TorusGeometry(52, 4, 8, 32, Math.PI);
        b.add(parkMats.gold, archGeo, parkPlaced(g.x, g.y - 1, 28, 1, 1.2, 1));
        b.flush(parkRoot, 'gate');
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI;
          parkBulbs.add(g.x + Math.cos(a) * 52, g.y + 3, 28 + Math.sin(a) * 62, 3, i % 2 ? '#ffd79a' : '#8fe8ff', i);
        }
        const s = sign('SUNSET PIER', g.x, g.y - 1, 110, '#f6d27f');
        s.position.y = 93;
        s.userData.backing.position.y = 93;
      }
      // @include src/unicorn3d.js
      // ---- Carousel ------------------------------------------------------------------
      const carousel = new Three.Group();
      carousel.position.set(PIER.carousel.x, 0, PIER.carousel.y);
      carousel.userData.dynamic = true;
      carousel.name = 'carousel';
      parkRoot.add(carousel);
      const carouselHorses = [];
      {
        const R = PIER.carousel.r,
          b = parkParts();
        b.add(parkMats.wood, new Three.CylinderGeometry(1, 1, 1, 32), parkPlaced(0, 0, 2, R, 4, R));
        b.add(parkMats.gold, new Three.CylinderGeometry(1, 1, 1, 16), parkPlaced(0, 0, 18, 6, 32, 6));
        b.add(parkMats.cream, new Three.CylinderGeometry(1, 1, 1, 32, 1, true), parkPlaced(0, 0, 31, R + 4, 6, R + 4));
        // Striped canopy: alternating red and white gores.
        for (let i = 0; i < 16; i++) {
          const gore = new Three.ConeGeometry(R + 7, 16, 2, 1, true, (i / 16) * TAU, TAU / 16);
          b.add(i % 2 ? parkMats.canvasRed : parkMats.canvasWhite, gore, parkPlaced(0, 0, 42, 1, 1, 1));
        }
        b.add(parkMats.gold, parkConeGeo, parkPlaced(0, 0, 54, 3, 10, 3));
        b.flush(carousel, 'carousel');
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU,
            r = R - 9,
            horse = new Three.Group(),
            hb = parkParts();
          hb.box(i % 2 ? parkMats.white : parkMats.cream, parkPlaced(0, 0, 0, 12, 5.5, 4.2));
          hb.box(i % 2 ? parkMats.white : parkMats.cream, parkPlaced(5.5, 0, 4, 4, 7, 3.4));
          hb.box(parkMats.gold, parkPlaced(0, 0, 3, 5, 1.2, 4.6));
          for (const dx of [-4.5, 4]) hb.box(parkMats.gold, parkPlaced(dx, 0, -4, 1.6, 6, 1.6));
          hb.add(parkMats.gold, parkThinGeo, parkPlaced(0, 0, 8, 0.5, 44, 0.5));
          hb.flush(horse, 'horse');
          horse.position.set(Math.cos(a) * r, 12, Math.sin(a) * r);
          horse.rotation.y = -a + Math.PI / 2;
          carousel.add(horse);
          carouselHorses.push(horse);
        }
        instanceRideParts(carouselHorses, 'carousel horses');
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          parkBulbs.add(PIER.carousel.x + Math.cos(a) * (R + 5), PIER.carousel.y + Math.sin(a) * (R + 5), 34, 3, i % 2 ? '#ffd79a' : '#ff9fc4', i);
        }
      }
      // ---- Swing carousel --------------------------------------------------------------
      const SW = PIER.swing,
        swingTop = new Three.Group(),
        swingSeats = [];
      {
        const b = parkParts();
        b.add(parkMats.white, new Three.CylinderGeometry(3.5, 6, 1, 16), parkPlaced(SW.x, SW.y, 45, 1, 90, 1));
        b.add(parkMats.stone, new Three.CylinderGeometry(1, 1, 1, 32), parkPlaced(SW.x, SW.y, 1.5, SW.r, 3, SW.r));
        b.flush(parkRoot, 'swing tower');
        swingTop.position.set(SW.x, 84, SW.y);
        swingTop.userData.dynamic = true;
        parkRoot.add(swingTop);
        const tb = parkParts();
        for (let i = 0; i < 16; i++) {
          const gore = new Three.ConeGeometry(34, 10, 2, 1, true, (i / 16) * TAU, TAU / 16);
          tb.add(i % 2 ? parkMats.turquoise : parkMats.gold, gore, parkPlaced(0, 0, 8, 1, 1, 1));
        }
        tb.add(parkMats.white, new Three.CylinderGeometry(34, 34, 3, 32, 1, true), parkPlaced(0, 0, 1.5, 1, 1, 1));
        tb.flush(swingTop, 'swing top');
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU,
            arm = new Three.Group();
          arm.position.set(Math.cos(a) * 30, 0, Math.sin(a) * 30);
          arm.rotation.y = -a;
          swingTop.add(arm);
          const seat = parkParts();
          seat.add(parkMats.steel, parkThinGeo, parkPlaced(0, 0, -21, 0.25, 42, 0.25));
          seat.box(parkMats.seat, parkPlaced(0, 0, -43, 3.4, 1, 3.4));
          seat.box(i % 3 ? parkMats.white : parkMats.red, parkPlaced(0, -1.6, -41, 1.6, 3.2, 1.2));
          seat.add(parkMats.skin, sphereGeo, parkPlaced(0, 0, -37.6, 0.9, 1.1, 0.9));
          seat.flush(arm, 'swing seat');
          swingSeats.push(arm);
        }
        instanceRideParts(swingSeats, 'swing seats');
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * TAU;
          parkBulbs.add(SW.x + Math.cos(a) * 34, SW.y + Math.sin(a) * 34, 85, 3, i % 2 ? '#8fe8ff' : '#ffd79a', i);
        }
      }
      // ---- Teacups -------------------------------------------------------------------
      const teacups = new Three.Group(),
        teacupCups = [];
      teacups.position.set(PIER.teacups.x, 0, PIER.teacups.y);
      teacups.userData.dynamic = true;
      parkRoot.add(teacups);
      {
        const b = parkParts();
        b.add(parkMats.cream, new Three.CylinderGeometry(1, 1, 1, 32), parkPlaced(0, 0, 1.2, PIER.teacups.r, 2.4, PIER.teacups.r));
        b.add(parkMats.gold, new Three.CylinderGeometry(1, 1, 1, 16), parkPlaced(0, 0, 4, 8, 6, 8));
        b.flush(teacups, 'teacup deck');
        const cup = new Three.LatheGeometry(
          [
            [0, 0],
            [5, 0.4],
            [7.5, 3],
            [8.4, 7],
            [8.2, 9],
          ].map(([r, y]) => new Three.Vector2(r, y)),
          20,
        );
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU,
            g = new Three.Group();
          g.position.set(Math.cos(a) * 25, 2.4, Math.sin(a) * 25);
          const m = new Three.Mesh(cup, [parkMats.turquoise, parkMats.canvasRed, parkMats.gold][i % 3]);
          m.castShadow = true;
          g.add(m);
          const riders = parkParts();
          for (const d of [-3, 3]) riders.add(parkMats.skin, sphereGeo, parkPlaced(d, 0, 9.5, 1, 1.2, 1));
          riders.flush(g, 'cup riders');
          teacups.add(g);
          teacupCups.push(g);
        }
        instanceRideParts(teacupCups, 'teacups');
      }
      // ---- Drop tower ----------------------------------------------------------------
      const DT = PIER.dropTower,
        dropCar = new Three.Group(),
        dropLeds = [];
      {
        const b = parkParts(),
          H = 300;
        b.add(parkMats.white, new Three.CylinderGeometry(1, 1, 1, 16), parkPlaced(DT.x, DT.y, H / 2, 9, H, 9));
        for (let y = 0; y < H; y += 24)
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * TAU + Math.PI / 4;
            b.add(parkMats.gold, parkThinGeo, parkBetween(parkP3(DT.x + Math.cos(a) * 9, DT.y + Math.sin(a) * 9, y), parkP3(DT.x + Math.cos(a + Math.PI / 2) * 9, DT.y + Math.sin(a + Math.PI / 2) * 9, y + 24), 0.5));
          }
        b.add(parkMats.gold, parkDomeGeo, parkPlaced(DT.x, DT.y, H, 14, 12, 14));
        b.add(parkMats.gold, parkConeGeo, parkPlaced(DT.x, DT.y, H + 22, 2, 26, 2));
        b.add(parkMats.stone, new Three.CylinderGeometry(1, 1, 1, 24), parkPlaced(DT.x, DT.y, 2, 22, 4, 22));
        b.flush(parkRoot, 'drop tower');
        for (let y = 10; y < H; y += 8) {
          dropLeds.push(parkBulbs.add(DT.x, DT.y + 9.6, y, 2.4, '#ffffff'));
        }
        dropCar.userData.dynamic = true;
        parkRoot.add(dropCar);
        const c = parkParts();
        c.add(parkMats.turquoise, new Three.CylinderGeometry(16, 16, 5, 24, 1, true), parkPlaced(0, 0, 0, 1, 1, 1));
        c.add(parkMats.gold, new Three.CylinderGeometry(17, 17, 1.5, 24), parkPlaced(0, 0, 3, 1, 1, 1));
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          c.box(parkMats.seat, parkPlaced(Math.cos(a) * 18, Math.sin(a) * 18, -3, 3, 6, 3, a));
          c.add(parkMats.skin, sphereGeo, parkPlaced(Math.cos(a) * 18, Math.sin(a) * 18, 1.4, 1, 1.2, 1));
          c.add(i % 2 ? parkMats.red : parkMats.white, boxGeo, parkPlaced(Math.cos(a) * 18.4, Math.sin(a) * 18.4, -4.5, 1.4, 3.4, 2, a));
        }
        c.flush(dropCar, 'drop car');
        const s = sign('FREE FALL', DT.x, DT.y + 24, 50, '#ffb4a0');
        s.position.y = 30;
        s.userData.backing.position.y = 30;
      }
      // ---- Log flume ------------------------------------------------------------------
      const flumeBoats = [],
        flumeSplash = parkGlowPoints(160, 'flume splash'),
        splashParticles = [];
      {
        const F = flumeCircuit(),
          b = parkParts(),
          n = F.pts.length;
        for (let i = 0; i < n; i++) {
          const a = F.pts[i],
            c = F.pts[(i + 1) % n],
            len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]),
            yaw = Math.atan2(c[1] - a[1], c[0] - a[0]),
            pitch = Math.atan2(c[2] - a[2], Math.hypot(c[0] - a[0], c[1] - a[1])),
            mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2],
            m = parkPlaced(mid[0], mid[1], mid[2], 1, 1, 1, yaw);
          // Trough: floor and two walls, pitched along the run; water inside.
          const tilt = new Three.Matrix4().makeRotationZ(pitch);
          for (const [dz, sy, h, material] of [
            [0, 1.2, 0, parkMats.wood],
            [-6, 7, 3.5, parkMats.wood],
            [6, 7, 3.5, parkMats.wood],
            [0, 0.3, 2.2, parkMats.pool],
          ])
            b.add(material, boxGeo, m.clone().multiply(tilt).multiply(new Three.Matrix4().compose(new Three.Vector3(0, h, dz), new Three.Quaternion(), new Three.Vector3(len + 0.6, sy, dz ? 1 : 11))));
          if (i % 5 === 0 && mid[2] > 6)
            for (const dz of [-5, 5]) {
              const px = mid[0] - Math.sin(yaw) * dz,
                py = mid[1] + Math.cos(yaw) * dz;
              b.add(parkMats.wood, parkThinGeo, parkBetween(parkP3(px, py, 0), parkP3(px, py, mid[2]), 0.8));
            }
        }
        // Splash pool, station hut with a thatched roof, rock work round the drop.
        b.add(parkMats.pool, new Three.CylinderGeometry(1, 1, 1, 24), parkPlaced(4075, -6508, 1.5, 36, 3, 24));
        b.box(parkMats.wood, parkPlaced(4025, -6470, 14, 50, 28, 22));
        b.add(parkMats.sand, parkConeGeo, parkPlaced(4025, -6470, 34, 34, 16, 20, Math.PI / 4));
        for (let i = 0; i < 9; i++) b.add(parkMats.terracotta, new Three.DodecahedronGeometry(1), parkPlaced(4050 + (i % 3) * 16, -6560 + Math.floor(i / 3) * 14, 6, 10 + (i % 4) * 3, 8 + (i % 3) * 6, 9));
        b.flush(parkRoot, 'log flume');
        for (let k = 0; k < FLUME_BOATS; k++) {
          const g = new Three.Group(),
            bb = parkParts();
          bb.box(parkMats.wood, parkPlaced(0, 0, 2.5, 16, 4, 8));
          bb.box(parkMats.wood, parkPlaced(7, 0, 4.5, 3, 4, 7.6));
          for (let r = 0; r < 3; r++) {
            bb.box([parkMats.red, parkMats.white, parkMats.turquoise][r], parkPlaced(-4 + r * 4, 0, 6, 2, 3, 3));
            bb.add(parkMats.skin, sphereGeo, parkPlaced(-4 + r * 4, 0, 8.4, 1, 1.2, 1));
          }
          bb.flush(g, 'flume boat');
          g.userData.dynamic = true;
          parkRoot.add(g);
          flumeBoats.push({ g, wasHigh: false });
        }
        instanceRideParts(
          flumeBoats.map((boat) => boat.g),
          'flume boats',
        );
        for (let i = 0; i < 160; i++) flumeSplash.add(0, 0, -100, 4, '#e8f6ff');
        flumeSplash.done();
        const s = sign('WADI SPLASH', 4025, -6458, 50, '#9fe6ff');
        s.position.y = 30;
        s.userData.backing.position.y = 30;
      }
      const boatSpot = {};
      function updateFlume(dt) {
        for (let k = 0; k < flumeBoats.length; k++) {
          const boat = flumeBoats[k];
          flumeBoat(k, boatSpot);
          boat.g.position.set(boatSpot.x, boatSpot.z + 1.5, boatSpot.y);
          boat.g.rotation.set(0, -boatSpot.a, Math.atan(boatSpot.slope));
          // At the foot of the big drop the boat throws up a wall of spray.
          const high = boatSpot.z > 40;
          if (boat.wasHigh && boatSpot.z < 10) {
            for (let i = 0; i < 70; i++)
              splashParticles.push({
                x: boatSpot.x,
                y: boatSpot.y,
                z: 4,
                vx: randomBetween(-30, 30) + Math.cos(boatSpot.a) * 40,
                vy: randomBetween(-30, 30) + Math.sin(boatSpot.a) * 40,
                vz: randomBetween(40, 110),
                life: randomBetween(0.8, 1.6),
              });
            parkSplashSound(boatSpot.x, boatSpot.y);
          }
          if (boatSpot.z > 40) boat.wasHigh = true;
          else if (boatSpot.z < 10) boat.wasHigh = false;
        }
        const attr = flumeSplash.points.geometry.attributes;
        for (let i = splashParticles.length - 1; i >= 0; i--) {
          const p = splashParticles[i];
          p.life -= dt;
          p.vz -= 120 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.life <= 0 || p.z < 0) splashParticles.splice(i, 1);
        }
        if (splashParticles.length > 160) splashParticles.splice(0, splashParticles.length - 160);
        for (let i = 0; i < 160; i++) {
          const p = splashParticles[i];
          if (p) {
            attr.position.setXYZ(i, p.x, p.z, p.y);
            attr.size.setX(i, 5 + (1 - p.life) * 5);
          } else attr.size.setX(i, 0);
        }
        attr.position.needsUpdate = attr.size.needsUpdate = true;
      }
      // ---- Dark ride: Arabian Nights ---------------------------------------------------
      {
        const d = PIER.darkRide,
          b = parkParts(),
          cx = d.x + d.w / 2,
          front = d.y + d.h;
        b.box(parkMats.sand, parkPlaced(cx, d.y + d.h / 2, 26, d.w, 52, d.h));
        // Facade: a crenellated wall with three horseshoe-arched gateways.
        b.box(parkMats.stone, parkPlaced(cx, front - 2, 34, d.w + 10, 68, 6));
        for (let x = d.x; x <= d.x + d.w; x += 12) b.box(parkMats.stone, parkPlaced(x, front - 2, 71, 6, 6, 6));
        for (const dx of [-60, 0, 60]) {
          b.box(parkMats.seat, parkPlaced(cx + dx, front + 1.2, 16, 22, 32, 1));
          b.add(parkMats.gold, new Three.TorusGeometry(12, 1.6, 6, 20, Math.PI * 1.25), parkPlaced(cx + dx, front + 1.6, 31, 1, 1, 1).multiply(new Three.Matrix4().makeRotationZ(-Math.PI * 0.125)));
          b.add(parkMats.turquoise, parkDomeGeo, parkPlaced(cx + dx, d.y + d.h / 2, 52, 20, 24, 20));
        }
        // Towers with onion domes at the corners of the facade.
        for (const dx of [-d.w / 2 - 4, d.w / 2 + 4]) {
          b.add(parkMats.stone, new Three.CylinderGeometry(1, 1, 1, 12), parkPlaced(cx + dx, front - 4, 45, 11, 90, 11));
          b.add(parkMats.gold, new Three.SphereGeometry(1, 14, 10), parkPlaced(cx + dx, front - 4, 96, 12, 14, 12));
          b.add(parkMats.gold, parkConeGeo, parkPlaced(cx + dx, front - 4, 114, 3, 16, 3));
        }
        b.flush(parkRoot, 'dark ride');
        for (let i = 0; i < 16; i++) parkBulbs.add(d.x + 6 + i * 12.6, front + 3, 60, 4, i % 2 ? '#ff9f5a' : '#ffd79a', i);
        for (const dx of [-60, 0, 60]) parkBulbs.add(cx + dx, front + 4, 22, 9, '#ffb060', 1 + dx);
        const s = sign('ARABIAN NIGHTS', cx, front + 3, 100, '#f6d27f');
        s.position.y = 48;
        s.userData.backing.position.y = 48;
      }
