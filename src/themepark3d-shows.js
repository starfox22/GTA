      // ---- Bumper cars ----------------------------------------------------------------
      const BC = PIER.bumper,
        BUMPERS = 10,
        bumperCars = new Three.InstancedMesh(new Three.BoxGeometry(9, 4, 6), new Three.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 }), BUMPERS),
        bumperPoles = new Three.InstancedMesh(parkThinGeo, parkMats.steel, BUMPERS),
        bumperState = [];
      {
        const b = parkParts(),
          cx = BC.x + BC.w / 2,
          cy = BC.y + BC.h / 2;
        b.box(parkMats.darkSteel, parkPlaced(cx, cy, 0.8, BC.w - 6, 1.6, BC.h - 6));
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
          [0, -1],
          [0, 1],
        ])
          b.add(parkMats.gold, parkTubeGeo, parkBetween(parkP3(cx + dx * (BC.w / 2 - 3), cy + dy * (BC.h / 2 - 3), 0), parkP3(cx + dx * (BC.w / 2 - 3), cy + dy * (BC.h / 2 - 3), 30), 1.6));
        b.box(parkMats.canvasWhite, parkPlaced(cx, cy, 31, BC.w + 6, 2, BC.h + 6));
        b.box(parkMats.turquoise, parkPlaced(cx, cy, 34, BC.w - 20, 4, BC.h - 20));
        b.box(parkMats.red, parkPlaced(cx, BC.y + BC.h + 2, 26, BC.w + 6, 8, 1));
        b.flush(parkRoot, 'bumper cars');
        const c = new Three.Color();
        for (let i = 0; i < BUMPERS; i++) {
          bumperCars.setColorAt(i, c.setHSL(i / BUMPERS, 0.75, 0.5));
          bumperState.push({ x: cx + randomBetween(-50, 50), y: cy + randomBetween(-30, 30), a: randomBetween(0, TAU), v: 30 });
        }
        for (const m of [bumperCars, bumperPoles]) {
          m.frustumCulled = false;
          m.castShadow = true;
          m.userData.dynamic = true;
          parkRoot.add(m);
        }
        for (let i = 0; i < 14; i++) parkBulbs.add(BC.x + 6 + i * 10.5, BC.y + BC.h + 3, 30, 3, i % 2 ? '#ff7fb0' : '#8fe8ff', i);
        const s = sign('DODGEMS', cx, BC.y + BC.h + 4, 56, '#ff9fc4');
        s.position.y = 40;
        s.userData.backing.position.y = 40;
      }
      function updateBumpers(dt) {
        const cx = BC.x + BC.w / 2,
          cy = BC.y + BC.h / 2;
        for (let i = 0; i < BUMPERS; i++) {
          const s = bumperState[i];
          s.a += Math.sin(gameTime * 0.7 + i * 2.1) * dt * 1.4;
          s.x += Math.cos(s.a) * s.v * dt;
          s.y += Math.sin(s.a) * s.v * dt;
          // Off the rails of the floor, and off each other: bounce.
          if (Math.abs(s.x - cx) > BC.w / 2 - 12 || Math.abs(s.y - cy) > BC.h / 2 - 10) {
            s.a = Math.atan2(cy - s.y, cx - s.x) + randomBetween(-0.6, 0.6);
            s.x = clamp(s.x, BC.x + 12, BC.x + BC.w - 12);
            s.y = clamp(s.y, BC.y + 10, BC.y + BC.h - 10);
          }
          for (let j = 0; j < i; j++) {
            const o = bumperState[j];
            if (Math.hypot(o.x - s.x, o.y - s.y) < 9) {
              s.a += Math.PI * 0.8;
              o.a -= Math.PI * 0.7;
            }
          }
          bumperCars.setMatrixAt(i, jetMatrix.compose(parkV.set(s.x, 3.4, s.y), pq.setFromAxisAngle(parkUpAxis, -s.a), ps.set(1, 1, 1)));
          bumperPoles.setMatrixAt(i, jetMatrix.compose(parkV.set(s.x - Math.cos(s.a) * 3, 18, s.y - Math.sin(s.a) * 3), pq.identity(), ps.set(0.3, 28, 0.3)));
        }
        bumperCars.instanceMatrix.needsUpdate = true;
        bumperPoles.instanceMatrix.needsUpdate = true;
      }
      // ---- Food court (souk), kiosks and stalls --------------------------------------
      {
        const f = PIER.foodCourt,
          b = parkParts();
        b.box(parkMats.sand, parkPlaced(f.x + f.w / 2, f.y + f.h / 2, 15, f.w, 30, f.h));
        for (let i = 0; i < 7; i++) {
          const x = f.x + 16 + i * ((f.w - 32) / 6);
          b.box(parkMats.seat, parkPlaced(x, f.y + f.h + 0.6, 11, 16, 22, 1));
          b.box(i % 2 ? parkMats.canvasRed : parkMats.canvasWhite, parkPlaced(x, f.y + f.h + 7, 23, 22, 1, 14));
          if (i % 2 === 0) b.add(parkMats.turquoise, parkDomeGeo, parkPlaced(x, f.y + f.h / 2, 30, 14, 14, 14));
        }
        for (const k of parkKiosks()) {
          const games = k.kind === 'games',
            h = games ? 20 : 14;
          b.box(games ? parkMats.cream : parkMats.white, parkPlaced(k.x, k.y, h / 2, k.w, h, k.h));
          b.box(k.kind === 'bar' || k.kind === 'dates' ? parkMats.wood : parkMats.canvasRed, parkPlaced(k.x, k.y + k.h / 2 + 4, h + 1, k.w + 6, 1, 10));
          b.box(parkMats.canvasWhite, parkPlaced(k.x, k.y, h + 3, k.w + 2, 4, k.h + 2));
          if (games) for (let i = 0; i < 6; i++) b.box([parkMats.red, parkMats.turquoise, parkMats.gold][i % 3], parkPlaced(k.x - k.w / 2 + 6 + i * 9.6, k.y + k.h / 2 + 0.8, 12, 5, 5, 1));
          parkBulbs.add(k.x, k.y + k.h / 2 + 6, h + 2, 4, '#ffd79a', k.x);
        }
        // Bus shelter by the car park.
        const bs = PIER.busStop;
        b.box(parkMats.glassDark, parkPlaced(bs.x, bs.y - 6, 7, 30, 14, 1));
        b.box(parkMats.white, parkPlaced(bs.x, bs.y, 15, 34, 1.2, 14));
        for (const dx of [-15, 15]) b.add(parkMats.steel, parkThinGeo, parkBetween(parkP3(bs.x + dx, bs.y + 5, 0), parkP3(bs.x + dx, bs.y + 5, 15), 0.6));
        b.add(parkMats.steel, parkThinGeo, parkBetween(parkP3(bs.x + 20, bs.y + 6, 0), parkP3(bs.x + 20, bs.y + 6, 22), 0.5));
        b.box(parkMats.gold, parkPlaced(bs.x + 20, bs.y + 6, 22, 6, 6, 0.6));
        b.flush(parkRoot, 'souk and kiosks');
      }
      // ---- Palms and lamps -------------------------------------------------------------
      {
        // Coconut and royal palms from the species library (vegetation3d.js), one
        // instanced mesh per species; nothing here can be knocked down.
        const palms = parkPalms(),
          bySpecies = { coconut: [], royal: [] },
          m4 = new Three.Matrix4();
        for (const p of palms) bySpecies[vegHash(p.x, p.y, 5) < 0.62 ? 'coconut' : 'royal'].push(p);
        for (const [key, list] of Object.entries(bySpecies)) {
          if (!list.length) continue;
          const S = TREE_SPECIES[key],
            m = foliageInstances(speciesGeometry(key, 0), list.length);
          list.forEach((p, i) => {
            const v = treeVariation(S, p.x, p.y);
            m4.compose(parkV.set(p.x, 0, p.y), pq.setFromAxisAngle(parkUpAxis, v.yaw), ps.setScalar(p.s * 0.62 * v.scale));
            m.setMatrixAt(i, m4);
            setFoliageInstance(m, i, v.tint, v.morph, 0);
          });
          m.computeBoundingSphere();
          m.userData.dynamic = true;
          m.name = 'park palms';
          parkRoot.add(m);
        }
        // Lamp posts: bronze posts with lantern heads along the promenades.
        const spots = [];
        for (const s of parkPathSegments()) {
          const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]),
            nx = (s.b[0] - s.a[0]) / len,
            ny = (s.b[1] - s.a[1]) / len;
          for (let d = 10; d < len; d += 58) {
            const side = Math.floor(d / 58) % 2 ? 1 : -1,
              x = s.a[0] + nx * d - ny * side * (s.w / 2 + 3),
              y = s.a[1] + ny * d + nx * side * (s.w / 2 + 3);
            if (!parkBlocked(x, y, 3) && spots.every((o) => Math.hypot(o[0] - x, o[1] - y) > 30)) spots.push([x, y]);
          }
        }
        const posts = new Three.InstancedMesh(parkThinGeo, parkMats.darkSteel, spots.length),
          heads = new Three.InstancedMesh(new Three.SphereGeometry(1, 10, 8), parkMats.lampHead, spots.length);
        spots.forEach(([x, y], i) => {
          posts.setMatrixAt(i, m4.compose(parkV.set(x, 11, y), pq.identity(), ps.set(0.7, 22, 0.7)));
          heads.setMatrixAt(i, m4.compose(parkV.set(x, 23.5, y), pq.identity(), ps.set(2.2, 3, 2.2)));
          parkBulbs.add(x, y, 23.5, 7, '#ffdca0');
        });
        for (const m of [posts, heads]) {
          m.castShadow = true;
          m.userData.dynamic = true;
          m.name = 'park lamps';
          parkRoot.add(m);
        }
        parkLampSpots.push(...spots);
      }
      // ---- Night light on the ground ---------------------------------------------------
      /**
       * The island lies outside the city's night light map (lighting3d.js), so it
       * carries its own: warm pools under every lamp, colour spill round the rides,
       * the lagoon's glow and the hotel's forecourt, painted once and laid over the
       * ground as an additive sheet whose strength follows the night.
       */
      const parkNightSheet = (() => {
        const t = PARK_TILE,
          scale = 0.25,
          c = document.createElement('canvas');
        c.width = Math.round(t.w * scale);
        c.height = Math.round(t.h * scale);
        const g = c.getContext('2d'),
          pool = (x, y, r, color, a) => {
            const px = (x - t.x) * scale,
              py = (y - t.y) * scale,
              gr = g.createRadialGradient(px, py, 0, px, py, r * scale);
            gr.addColorStop(0, color.replace('A', a));
            gr.addColorStop(0.4, color.replace('A', a * 0.5));
            gr.addColorStop(1, color.replace('A', 0));
            g.fillStyle = gr;
            g.fillRect(px - r * scale, py - r * scale, r * 2 * scale, r * 2 * scale);
          };
        g.fillStyle = '#000';
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'lighter';
        for (const [x, y] of parkLampSpots) pool(x, y, 48, 'rgba(255,200,130,A)', 0.55);
        pool(LAG.x, LAG.y, 300, 'rgba(90,170,255,A)', 0.3);
        pool(PIER.hotel.x, PIER.hotel.y + 60, 260, 'rgba(255,190,120,A)', 0.35);
        for (const r of [PIER.carousel, PIER.swing, PIER.teacups]) pool(r.x, r.y, 90, 'rgba(255,170,200,A)', 0.4);
        pool(PIER.darkRide.x + 100, PIER.darkRide.y + PIER.darkRide.h + 20, 130, 'rgba(255,150,80,A)', 0.45);
        pool(PIER.bumper.x + 75, PIER.bumper.y + 50, 110, 'rgba(160,120,255,A)', 0.45);
        pool(PIER.gate.x, PIER.gate.y, 170, 'rgba(255,215,150,A)', 0.55);
        pool(PIER.unicorn.x, PIER.unicorn.y, 100, 'rgba(255,222,180,A)', 0.42);
        pool(PIER.wheel.x, PIER.wheel.y, 200, 'rgba(140,220,255,A)', 0.3);
        pool(PIER.station.x, PIER.station.y, 140, 'rgba(255,200,120,A)', 0.4);
        pool(PIER.beachClub.x + 240, PIER.beachClub.y + 100, 220, 'rgba(120,230,255,A)', 0.3);
        for (let x = PARK_CAR_PARK.x + 40; x < PARK_CAR_PARK.x + PARK_CAR_PARK.w; x += 110) pool(x, PARK_CAR_PARK.y + 55, 70, 'rgba(255,210,150,A)', 0.4);
        const tx = new Three.CanvasTexture(c);
        tx.colorSpace = Three.SRGBColorSpace;
        const sheet = new Three.Mesh(
          new Three.PlaneGeometry(t.w, t.h),
          new Three.MeshBasicMaterial({ map: tx, transparent: true, blending: Three.AdditiveBlending, depthWrite: false, opacity: 0 }),
        );
        sheet.rotation.x = -Math.PI / 2;
        sheet.position.set(t.x + t.w / 2, 0.5, t.y + t.h / 2);
        sheet.userData.dynamic = true;
        sheet.renderOrder = 2;
        sheet.name = 'park night light';
        parkRoot.add(sheet);
        return sheet;
      })();
      parkBulbs.done();
      // ---- Fireworks -------------------------------------------------------------------
      const FIREWORK_SPARKS = 2400,
        fireworkSparks = parkGlowPoints(FIREWORK_SPARKS, 'fireworks'),
        sparkSeen = new Map(),
        sparkColor = new Three.Color();
      for (let i = 0; i < FIREWORK_SPARKS; i++) fireworkSparks.add(0, 0, -500, 0, '#ffffff');
      fireworkSparks.done();
      fireworkSparks.points.material.uniforms.uIntensity.value = 3.5;
      /* Each burst is drawn from its rocket's seed, so no particle state is kept:
         a sphere (or ring, willow, crossette) of sparks that falls and fades. */
      function updateFireworks() {
        const attr = fireworkSparks.points.geometry.attributes,
          rockets = parkShow.rockets;
        let i = 0;
        fireworkSparks.points.visible = rockets.length > 0;
        if (!rockets.length) return;
        for (const r of rockets) {
          if (!r.burst) {
            // The rising trail.
            for (let k = 0; k < 4 && i < FIREWORK_SPARKS; k++, i++) {
              attr.position.setXYZ(i, r.x - r.vx * k * 0.02, r.z - r.vz * k * 0.02, r.y - r.vy * k * 0.02);
              attr.size.setX(i, 5 - k);
              attr.color.setXYZ(i, 1, 0.75, 0.4);
            }
            continue;
          }
          const age = gameTime - r.burst,
            fade = Math.max(0, 1 - age / 3),
            count = r.style === 1 ? 90 : 140;
          sparkColor.setHSL(r.hue, 0.9, 0.6);
          for (let k = 0; k < count && i < FIREWORK_SPARKS; k++, i++) {
            // Fibonacci sphere directions; ring style flattens them.
            const t = (k + 0.5) / count,
              inc = Math.acos(1 - 2 * t),
              az = k * 2.39996 + r.hue * 10,
              speed = r.style === 2 ? 190 : 270,
              dx = Math.sin(inc) * Math.cos(az),
              dy = Math.sin(inc) * Math.sin(az),
              dz = r.style === 1 ? 0.1 * Math.cos(inc) : Math.cos(inc),
              drag = (1 - Math.exp(-age * 1.6)) / 1.6,
              fall = age * age * (r.style === 2 ? 30 : 18);
            attr.position.setXYZ(i, r.x + dx * speed * drag, r.z + dz * speed * drag - fall, r.y + dy * speed * drag);
            const twinkle = r.style === 3 && Math.sin(gameTime * 30 + k) > 0.3 ? 0.2 : 1;
            attr.size.setX(i, (age < 0.08 ? 22 : 9) * fade * twinkle);
            const white = Math.max(0, 1 - age * 4);
            attr.color.setXYZ(i, sparkColor.r + white, sparkColor.g + white, sparkColor.b + white);
          }
        }
        for (let k = i; k < FIREWORK_SPARKS; k++) attr.size.setX(k, 0);
        attr.position.needsUpdate = attr.size.needsUpdate = attr.color.needsUpdate = true;
      }
      // ---- Per frame -------------------------------------------------------------------
      let parkLastTime = 0;
      function updateParkVisuals() {
        const dt = clamp(gameTime - parkLastTime, 0, 0.1);
        parkLastTime = gameTime;
        if (!parkRoot.visible) return;
        const night = nightAmount;
        sceneBufferSize(parkGlowViewport);
        for (const s of parkGlowSets) {
          s.points.material.uniforms.uHalfHeight.value = parkGlowViewport.y / 2;
          s.points.material.uniforms.uTime.value = gameTime;
        }
        parkBulbs.points.material.uniforms.uIntensity.value = night * 2.2;
        parkBulbs.points.visible = night > 0.03;
        parkNightSheet.material.opacity = night * 0.9;
        parkNightSheet.visible = night > 0.03;
        parkMats.lampHead.emissiveIntensity = night * 2;
        hotelFacade.emissiveIntensity = night * 1.3;
        eyePods.material.emissiveIntensity = night * 0.55;
        // The Eye.
        eyeGroup.rotation.z = wheelAngle();
        updateEyeCapsules();
        updateEyeLeds(night);
        // The Falcon.
        updateCoasterTrain(true);
        // Rides.
        carousel.rotation.y = gameTime * 0.5;
        for (let i = 0; i < carouselHorses.length; i++) carouselHorses[i].position.y = 12 + Math.sin(gameTime * 2.4 + i * 1.7) * 3;
        const swingCycle = (gameTime % 50) / 50,
          spin = swingCycle < 0.1 ? swingCycle / 0.1 : swingCycle < 0.75 ? 1 : swingCycle < 0.9 ? 1 - (swingCycle - 0.75) / 0.15 : 0,
          omega = 1.15 * spin;
        swingTop.rotation.y = (swingTop.rotation.y + omega * dt) % TAU;
        swingTop.rotation.x = Math.sin(gameTime * 0.4) * 0.08 * spin;
        const fling = Math.atan((omega * omega * 50) / COASTER_G);
        for (const arm of swingSeats) arm.rotation.z = fling;
        teacups.rotation.y = -gameTime * 0.6;
        for (let i = 0; i < teacupCups.length; i++) teacupCups[i].rotation.y = gameTime * (1.6 + (i % 3) * 0.5);
        // Drop tower: haul up, hold, fall, brake, settle.
        const dp = (gameTime % 26) / 26;
        let dropY;
        if (dp < 0.45) dropY = 12 + (dp / 0.45) * 258;
        else if (dp < 0.55) dropY = 270;
        else if (dp < 0.64) dropY = 270 - Math.pow((dp - 0.55) / 0.09, 2) * 220;
        else if (dp < 0.72) dropY = 50 - ((dp - 0.64) / 0.08) * 38;
        else dropY = 12;
        dropCar.position.set(DT.x, dropY, DT.y);
        if (dp > 0.55 && dp < 0.6 && !updateParkVisuals.dropScreamed) {
          updateParkVisuals.dropScreamed = true;
          parkScream(DT.x, DT.y, 0.9);
        }
        if (dp < 0.5) updateParkVisuals.dropScreamed = false;
        // The tower's chaser runs up while the car climbs.
        if (night > 0.03) {
          const col = parkBulbs.points.geometry.attributes.color;
          for (let k = 0; k < dropLeds.length; k++) {
            const on = (k - Math.floor(gameTime * 12)) % 10 === 0 || (k * 8 + 10 < dropY + 6 && k * 8 + 10 > dropY - 6);
            col.setXYZ(dropLeds[k], on ? 1 : 0.15, on ? 0.35 : 0.1, on ? 0.9 : 0.25);
          }
          col.needsUpdate = true;
        }
        updateFlume(dt);
        updateBumpers(dt);
        syncRideInstances();
        updateFountain(night);
        updateUnicornStatue(night);
        updateFireworks();
      }
      // ---- Ride cameras ----------------------------------------------------------------
      /**
       * While the player rides, the view is the perspective flight camera placed
       * on the ride: on the Falcon a chase view over the train (up follows the
       * track halfway, so loops and rolls turn the horizon), the front seat
       * (fully with the track), or a trackside camera that follows the train; on
       * the Eye the view from the capsule over the island and the city, or the
       * wheel seen from outside. E cycles the views. Called right after the
       * street/flight camera is set up each frame (render3d.js).
       */
      const rideCam = { pos: new Three.Vector3(), look: new Three.Vector3(), up: new Three.Vector3(0, 1, 0), ready: false },
        rideA = parkNewFrame3(),
        rideB = parkNewFrame3(),
        parkWorldUp = new Three.Vector3(0, 1, 0),
        TRACKSIDE = [
          [2300, -6250, 60],
          [1790, -6600, 40],
          [2150, -7030, 30],
          [2700, -7000, 90],
          [3150, -6520, 40],
          [2700, -6200, 50],
          [2000, -5900, 30],
          [2800, -5780, 40],
        ];
      // The Falcon station roof (THE FALCON: STATION): x st.x-70..st.x+80 over the
      // track on y -6430, posts at -6452 / -6408, eaves 50, ridge 62. A ride camera
      // inside or just over it would show the roof panels instead of the train, so
      // the roof and its posts are cut away while the camera or the train is there.
      function coasterUnderStationRoof(p) {
        const st = PIER.station;
        return p.x > st.x - 90 && p.x < st.x + 100 && p.z > -6475 && p.z < -6385 && p.y < 90;
      }
      function setStationRoofCut(cut) {
        for (const m of stationRoofMeshes) m.visible = !cut;
      }
      function updateParkCamera(deltaSeconds) {
        const ride = player.coaster;
        if (!ride) {
          rideCam.ready = false;
          setStationRoofCut(false);
          return false;
        }
        const target = new Three.Vector3(),
          look = new Three.Vector3(),
          up = new Three.Vector3();
        let fov = 60;
        if (ride.kind === 'wheel') {
          wheelCapsule(ride.capsule, podSpot);
          if (ride.view === 1) {
            // Outside: a slow orbit that keeps the whole wheel in frame.
            const a = gameTime * 0.05;
            target.set(EYE.x + Math.sin(a) * 900, EYE.hub + 120, EYE.y + Math.cos(a) * 900 + 300);
            look.set(EYE.x, EYE.hub, EYE.y);
            fov = 55;
          } else {
            // Inside the capsule, looking out across the island and the sound.
            const pan = Math.sin(gameTime * 0.05) * 1.1;
            target.set(podSpot.x, podSpot.z + 2, podSpot.y + 10);
            look.set(podSpot.x + Math.sin(pan) * 400, podSpot.z - 110, podSpot.y + Math.cos(pan) * 400 + 200);
            fov = 65;
          }
          up.copy(parkWorldUp);
        } else {
          const t = coasterTrain.t;
          if (ride.view === 1) {
            // Front row of the front car, over the falcon's head.
            coasterFrame3(t + 6, rideA);
            coasterFrame3(t + 28, rideB);
            target.copy(rideA.p).addScaledVector(rideA.u, 11.5);
            look.copy(rideB.p).addScaledVector(rideB.u, 7);
            up.copy(rideA.u);
            fov = 75;
          } else if (ride.view === 2) {
            // Trackside: the nearest of a set of cameras round the circuit.
            coasterFrame3(t - COASTER_CAR_GAP * 3, rideA);
            let best = TRACKSIDE[0],
              bestD = Infinity;
            for (const c of TRACKSIDE) {
              const d = Math.hypot(c[0] - rideA.p.x, c[1] - rideA.p.z);
              if (d < bestD) {
                bestD = d;
                best = c;
              }
            }
            target.set(best[0], best[2], best[1]);
            look.copy(rideA.p);
            up.copy(parkWorldUp);
            fov = clamp(8000 / Math.max(80, bestD), 25, 70);
          } else {
            // Chase: behind and above the front of the train.
            coasterFrame3(t - COASTER_CAR_GAP * COASTER_CARS - 26, rideA);
            coasterFrame3(t + 30, rideB);
            target.copy(rideA.p).addScaledVector(rideA.u, 22).addScaledVector(parkWorldUp, 8);
            look.copy(rideB.p).addScaledVector(rideB.u, 6);
            up.copy(rideA.u).lerp(parkWorldUp, 0.5).normalize();
            fov = 68;
          }
        }
        // Cut the station roof away while the train (or the camera) is under it.
        if (ride.kind === 'train') {
          coasterFrame3(coasterTrain.t - COASTER_CAR_GAP * (ride.car || 0), rideB);
          setStationRoofCut(coasterUnderStationRoof(rideB.p) || coasterUnderStationRoof(target) || coasterUnderStationRoof(rideCam.pos));
        } else setStationRoofCut(false);
        if (!rideCam.ready || rideCam.pos.distanceTo(target) > 400) {
          rideCam.pos.copy(target);
          rideCam.look.copy(look);
          rideCam.up.copy(up);
          rideCam.ready = true;
        } else {
          const k = 1 - Math.exp(-deltaSeconds * (ride.view === 1 ? 30 : 9));
          rideCam.pos.lerp(target, k);
          rideCam.look.lerp(look, k);
          rideCam.up.lerp(up, k).normalize();
        }
        camera = flightCamera;
        flightViewActive = true;
        flightCamera.fov = fov;
        flightCamera.aspect = viewportWidth / viewportHeight;
        flightCamera.near = 1.5;
        flightCamera.far = 24000;
        flightCamera.position.copy(rideCam.pos);
        flightCamera.up.copy(rideCam.up);
        flightCamera.lookAt(rideCam.look);
        flightCamera.updateProjectionMatrix();
        flightCamera.updateMatrixWorld(true);
        flightCamera.up.set(0, 1, 0);
        // What the renderer considers in view: the park and a good way beyond.
        viewCenter.x = (rideCam.look.x + rideCam.pos.x) / 2;
        viewCenter.y = (rideCam.look.z + rideCam.pos.z) / 2;
        viewReach = 2600;
        viewZoom = 0.5;
        viewGroundDistance = 700;
        scene.fog.near = 900;
        scene.fog.density = STREET_FOG_DENSITY * 0.8;
        return true;
      }
