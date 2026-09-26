    /**
     * HANDLING TESTS (developer console)
     * turnTest() drives a fresh vehicle on the open strip beside the Oceanview
     * runway through the real game step (contacts, weather, everything) and
     * measures what the steering achieves: the path's radius, the lateral g, and
     * how far the car runs forward and sideways to turn 90 degrees from a straight
     * entry (a city corner). pose() is the player's vehicle as the physics sees it.
     */
    function handlingConsole() {
      const TRACK = { x: -2600, y: 9650 };
      // The last test car, taken away before the next test so none pile up.
      let testCar = null;
      // Kasa least-squares circle through the points: returns the radius.
      const fitRadius = (points) => {
        if (points.length < 5) return null;
        let mx = 0,
          my = 0;
        for (const p of points) {
          mx += p.x;
          my += p.y;
        }
        mx /= points.length;
        my /= points.length;
        let suu = 0,
          svv = 0,
          suv = 0,
          suuu = 0,
          svvv = 0,
          suvv = 0,
          svuu = 0;
        for (const p of points) {
          const u = p.x - mx,
            v = p.y - my;
          suu += u * u;
          svv += v * v;
          suv += u * v;
          suuu += u * u * u;
          svvv += v * v * v;
          suvv += u * v * v;
          svuu += v * u * u;
        }
        const det = suu * svv - suv * suv;
        if (Math.abs(det) < 1e-9) return null;
        const b1 = (suuu + suvv) / 2,
          b2 = (svvv + svuu) / 2,
          uc = (b1 * svv - b2 * suv) / det,
          vc = (b2 * suu - b1 * suv) / det;
        return Math.sqrt(uc * uc + vc * vc + (suu + svv) / points.length);
      };
      const pose = () => {
        const c = player.car;
        if (!c) return null;
        const speed = Math.hypot(c.vx || 0, c.vy || 0);
        return {
          type: c.type,
          x: +c.x.toFixed(1),
          y: +c.y.toFixed(1),
          heading: +((c.a * 180) / Math.PI).toFixed(1),
          yawRate: +((c.av || 0) * 1).toFixed(3),
          kmh: +(speed / KMH).toFixed(1),
          // Angle between where the car points and where it is going (a slide).
          slip: speed > 5 ? +((normalizeAngle(Math.atan2(c.vy, c.vx) - c.a) * 180) / Math.PI).toFixed(1) : 0,
          hp: Math.round(c.hp),
          lift: +(c.deckLift || 0).toFixed(1),
          air: !!c.deckAir,
        };
      };
      return {
        pose,
        /* Traffic and police driving since the last reset: crashes and slides per
           minute of game time, the road's wetness, and the mean speed of the
           traffic within 1500 units of the player now. */
        aiDriving(reset = false) {
          const minutes = Math.max(1e-6, (physicsClock - driverStats.since) / 60);
          let n = 0,
            sum = 0,
            police = 0;
          for (const c of vehicles)
            if (c.hp > 0 && c.ai && !isBoat(c) && !isAircraft(c) && distanceBetween(c, player) < 1500 && Math.abs(c.speed) > 3 * KMH) {
              n++;
              sum += Math.abs(c.speed);
            } else if (c.cop && c.hp > 0) police++;
          const out = {
            minutes: +minutes.toFixed(2),
            wet: +weather.wet.toFixed(2),
            grip: +wetGrip().toFixed(2),
            trafficMoving: n,
            trafficKmh: n ? +(sum / n / KMH).toFixed(1) : null,
            police,
            trafficCrashes: driverStats.trafficCrashes,
            policeCrashes: driverStats.policeCrashes,
            trafficSlides: driverStats.trafficSlides,
            policeSlides: driverStats.policeSlides,
            crashesPerMinute: +((driverStats.trafficCrashes + driverStats.policeCrashes) / minutes).toFixed(2),
            closingsKmh: driverStats.closings.slice(-10),
          };
          if (reset) Object.assign(driverStats, { since: physicsClock, trafficCrashes: 0, policeCrashes: 0, trafficSlides: 0, policeSlides: 0, closings: [] });
          return out;
        },
        /* Flat out in a fresh `type` along the strip by the Oceanview runway
           (tarmac-grade, dry; about 1.1 km): from a standstill for the 0-100 and
           0-200 km/h times, then again rolling from 90% of the spec's top speed
           for the plateau (the strip is too short to reach 300 from rest).
           Returns both against the spec (VEHICLE_DEFINITIONS topKmh, zeroTo). */
        accelTest(type = 'sedan') {
          const savedWet = weather.wet,
            x = TRACK.x,
            y = TRACK.y,
            end = x + 8600,
            run = (startKmh, seconds) => {
              if (player.car) exitCar();
              if (testCar && vehicles.includes(testCar)) vehicles.splice(vehicles.indexOf(testCar), 1);
              teleportPlayer(x, y - 60);
              const c = (testCar = makeCar(type, x, y, 0, false));
              c.authorized = true;
              enterVehicle(c);
              Object.assign(c, { vx: startKmh * KMH, vy: 0, speed: startKmh * KMH });
              handlingTestPaved = true;
              const out = { time: 0, zeroTo100: null, zeroTo200: null, top: 0 };
              for (let i = 0; i < Math.round(seconds * 30) && gameMode === 'play' && player.car === c && c.x < end; i++) {
                weather.wet = 0;
                keys.KeyW = true;
                update(1 / 30);
                out.time += 1 / 30;
                const kmh = Math.hypot(c.vx, c.vy) / KMH;
                if (out.zeroTo100 === null && kmh >= 100) out.zeroTo100 = +out.time.toFixed(2);
                if (out.zeroTo200 === null && kmh >= 200) out.zeroTo200 = +out.time.toFixed(2);
                out.top = Math.max(out.top, kmh);
              }
              keys.KeyW = false;
              handlingTestPaved = false;
              if (player.car) exitCar();
              return out;
            };
          const spec = VEHICLE_DEFINITIONS[type],
            standing = run(0, 30),
            rolling = run(spec.topKmh * 0.9, 14);
          weather.wet = savedWet;
          return {
            type,
            name: spec.name,
            zeroTo100: standing.zeroTo100,
            zeroTo200: standing.zeroTo200,
            topKmh: +rolling.top.toFixed(1),
            spec: { topKmh: spec.topKmh, zeroTo: spec.zeroTo, mass: spec.mass, lengthM: +(spec.l / UNITS_PER_METRE).toFixed(2), widthM: +(spec.w / UNITS_PER_METRE).toFixed(2) },
          };
        },
        /* Brake a fresh `type` from `kmh` to a stop on the strip by the Oceanview
           runway, the brake key (S) held from the first step. options: wet 0..1;
           steer 1 right / -1 left (the key held with the brake: braking in a
           turn), entry (seconds of the steering alone first, to load the car
           into the bend); seconds (the cap). Returns the stopping distance (m),
           the time, the mean deceleration (g), how far the car moved sideways
           and turned while stopping (a locked car goes straight on), the peak
           slip and, where the assists exist, how long ABS worked. */
        brakeTest(type = 'sedan', kmh = 100, options = {}) {
          const { wet = 0, steer = 0, entry = 0, seconds = 12, x = TRACK.x, y = TRACK.y, trace = false } = options;
          if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
          const savedWet = weather.wet;
          if (player.car) exitCar();
          if (testCar && vehicles.includes(testCar)) vehicles.splice(vehicles.indexOf(testCar), 1);
          for (let i = vehicles.length - 1; i >= 0; i--) if (vehicles[i].rideTarget) vehicles.splice(i, 1);
          teleportPlayer(x, y - 60);
          const c = (testCar = spawnClearCar(type, x, y, 0, false));
          c.authorized = true;
          enterVehicle(c);
          Object.assign(c, { x, y, a: 0, av: 0, vx: kmh * KMH, vy: 0, speed: kmh * KMH });
          player.x = x;
          player.y = y;
          const turnKey = steer > 0 ? 'KeyD' : 'KeyA',
            samples = [];
          let time = 0,
            from = null,
            heading0 = 0,
            peakSlip = 0,
            absTime = 0,
            lockTime = 0,
            stopped = false;
          handlingTestPaved = true;
          // Frames of 1/30 s (four physics steps each), as the other tests.
          for (let i = 0; i < Math.round((seconds + entry) * 30) && gameMode === 'play' && player.car === c; i++) {
            weather.wet = wet;
            for (const k of ['KeyW', 'KeyS', 'Space', 'KeyA', 'KeyD']) keys[k] = false;
            if (steer) keys[turnKey] = true;
            if (time >= entry) {
              if (!from) {
                from = { x: c.x, y: c.y, kmh: Math.hypot(c.vx, c.vy) / KMH };
                heading0 = c.a;
              }
              keys.KeyS = true;
            } else keys.KeyW = Math.hypot(c.vx, c.vy) < kmh * KMH;
            update(1 / 30);
            time += 1 / 30;
            if (from) {
              const speed = Math.hypot(c.vx, c.vy);
              if (speed > 3 * KMH) peakSlip = Math.max(peakSlip, Math.abs(normalizeAngle(Math.atan2(c.vy, c.vx) - c.a)));
              if (c.absActive) absTime += 1 / 30;
              const lock = c.tyres ? Math.max(c.tyres.lock[0], c.tyres.lock[1]) : 0;
              if (lock > 0.5) lockTime += 1 / 30;
              if (trace && i % 3 === 0) samples.push({ t: +(time - entry).toFixed(2), ...pose(), lock: +lock.toFixed(2), abs: !!c.absActive });
              // Stopped: below walking pace the brake would start reversing.
              if (c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a) < 0.5 * KMH && speed < 1.5 * KMH) {
                stopped = true;
                break;
              }
            }
          }
          for (const k of ['KeyW', 'KeyS', 'Space', 'KeyA', 'KeyD']) keys[k] = false;
          handlingTestPaved = false;
          weather.wet = savedWet;
          if (!from) return { type, error: 'the test car was lost before braking', mode: gameMode, inCar: player.car === c };
          const dx = c.x - from.x,
            dy = c.y - from.y,
            distance = worldMeters(Math.hypot(dx, dy)),
            stopTime = time - entry,
            v0 = (from.kmh * KMH) / UNITS_PER_METRE;
          return {
            type,
            kmh: Math.round(from.kmh),
            wet,
            steer,
            stopped,
            distance: +distance.toFixed(1),
            seconds: +stopTime.toFixed(2),
            meanG: +((v0 * v0) / (2 * Math.max(0.1, distance)) / 9.81).toFixed(2),
            // Along and across the heading the braking began on.
            forward: +worldMeters(dx * Math.cos(heading0) + dy * Math.sin(heading0)).toFixed(1),
            side: +worldMeters(Math.abs(-dx * Math.sin(heading0) + dy * Math.cos(heading0))).toFixed(1),
            turnedDeg: Math.round((Math.abs(normalizeAngle(c.a - heading0)) * 180) / Math.PI),
            peakSlipDeg: Math.round((peakSlip * 180) / Math.PI),
            absSeconds: +absTime.toFixed(2),
            // The front axle's pressure cycles a second while ABS worked.
            absHz: absTime > 0.2 ? +((c.tyres?.absCycles || 0) / absTime).toFixed(1) : 0,
            lockSeconds: +lockTime.toFixed(2),
            ...(trace ? { samples } : {}),
          };
        },
        /* Lift-off oversteer: a fresh `type` at `kmh` on the strip, steered hard
           into a bend on full throttle for `hold` seconds, then the throttle lifted
           with the wheel held for `after` seconds (Settings · Driving decides ESC).
           Returns the peak body slip (degrees), the peak yaw the tyres added
           beyond the wheel's (rad/s), whether the car spun (slip past 90
           degrees), the heading turned after the lift, how long ESC worked and
           the speed at the end. */
        liftOffTest(type = 'muscle', kmh = 80, options = {}) {
          const { dir = 1, hold = 1.5, after = 2.5, wet = 0, x = TRACK.x, y = TRACK.y } = options;
          if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
          const savedWet = weather.wet;
          if (player.car) exitCar();
          if (testCar && vehicles.includes(testCar)) vehicles.splice(vehicles.indexOf(testCar), 1);
          teleportPlayer(x, y - 60);
          const c = (testCar = spawnClearCar(type, x, y, 0, false));
          c.authorized = true;
          enterVehicle(c);
          Object.assign(c, { x, y, a: 0, av: 0, vx: kmh * KMH, vy: 0, speed: kmh * KMH });
          player.x = x;
          player.y = y;
          const turnKey = dir > 0 ? 'KeyD' : 'KeyA';
          let time = 0,
            liftA = null,
            peakSlip = 0,
            peakYaw = 0,
            escTime = 0,
            slipAtLift = 0;
          handlingTestPaved = true;
          for (let i = 0; i < Math.round((hold + after) * 30) && gameMode === 'play' && player.car === c; i++) {
            weather.wet = wet;
            for (const k of ['KeyW', 'KeyS', 'Space', 'KeyA', 'KeyD']) keys[k] = false;
            keys[turnKey] = true;
            keys.KeyW = time < hold;
            update(1 / 30);
            time += 1 / 30;
            const speed = Math.hypot(c.vx, c.vy),
              slip = speed > 3 * KMH ? Math.abs(normalizeAngle(Math.atan2(c.vy, c.vx) - c.a)) : 0;
            if (time >= hold) {
              if (liftA === null) {
                liftA = c.a;
                slipAtLift = slip;
              }
              peakSlip = Math.max(peakSlip, slip);
              peakYaw = Math.max(peakYaw, Math.abs(c.tyres?.yawSlide || 0));
              if (physicsClock - (c.tyres?.escAt ?? -10) < 0.034) escTime += 1 / 30;
            }
          }
          for (const k of ['KeyW', 'KeyS', 'Space', 'KeyA', 'KeyD']) keys[k] = false;
          handlingTestPaved = false;
          weather.wet = savedWet;
          return {
            type,
            kmh,
            wet,
            esc: drivingAssists(c).esc,
            slipAtLiftDeg: Math.round((slipAtLift * 180) / Math.PI),
            peakSlipDeg: Math.round((peakSlip * 180) / Math.PI),
            peakYawSlide: +peakYaw.toFixed(2),
            spun: peakSlip > Math.PI / 2,
            turnedAfterLiftDeg: liftA === null ? null : Math.round((Math.abs(normalizeAngle(c.a - liftA)) * 180) / Math.PI),
            escSeconds: +escTime.toFixed(2),
            endKmh: +(Math.hypot(c.vx, c.vy) / KMH).toFixed(1),
          };
        },
        // The player's throw off a bike now and the last few throws (riders.js),
        // and the last aircraft broken up by a strike (AIRCRAFT STRIKES).
        riderReport: () => ({ ...riderReport(), aircraft: aircraftCrashes.slice() }),
        /* Fly a fresh helicopter at `kmh` (level, the speed held) from `metres` short
           of a downtown tower's west face, `heightM` above the street; `offsetM` puts the mast that far north
           of the tower's corner, so only the rotor reaches it (a rotor-strike test).
           Returns what became of it and the last aircraft crashes. */
        heliInto(kmh = 60, heightM = 15, metres = 30, offsetM = 0, seconds = 3) {
          if (player.car) exitCar();
          if (testCar && vehicles.includes(testCar)) vehicles.splice(vehicles.indexOf(testCar), 1);
          // The west face of the tallest tower with a clear street in front.
          const tower = buildings
              .filter((b) => b.height > 30 * UNITS_PER_METRE && b.h > 12 * UNITS_PER_METRE)
              .filter((b) => !solid(b.x - 12, b.y + b.h / 2, 4) && !solid(b.x - 12, b.y - 40, 4))
              .sort((p, q) => q.height - p.height)[0],
            wall = { x: tower.x, y: tower.y + tower.h / 2 },
            x = wall.x - metres * UNITS_PER_METRE,
            // Off the wall's line: `offsetM` north of the tower's north-west corner.
            y = offsetM ? tower.y - offsetM * UNITS_PER_METRE : wall.y;
          teleportPlayer(x, y);
          const c = (testCar = makeCar('helicopter', x, y, 0, false));
          c.authorized = true;
          enterVehicle(c);
          c.altitude = terrainHeight(x, y) + heightM * UNITS_PER_METRE;
          c.rotorSpeed = 1;
          Object.assign(c, { vx: kmh * KMH, vy: 0, vz: 0, speed: kmh * KMH, av: 0 });
          const hp = c.hp;
          // Held at the speed, on and off the cyclic.
          for (let i = 0; i < Math.round(seconds * 30) && gameMode === 'play'; i++) {
            keys.KeyW = player.car === c && Math.hypot(c.vx, c.vy) < kmh * KMH;
            update(1 / 30);
          }
          keys.KeyW = false;
          return {
            kmh,
            heightM,
            offsetM,
            destroyed: c.hp <= 0,
            hpLost: Math.round(hp - Math.max(0, c.hp)),
            playerHp: Math.round(player.hp),
            gameMode,
            onFoot: !player.car,
            thrown: !!player.thrown,
            crashes: aircraftCrashes.slice(-2),
          };
        },
        /* The drawbridge jump: both leaves held at `degrees`, a fresh `type` set
           going at `kmh` 25 m short of the west trunnion, held at that speed (flooring it up the leaf if it drops). Returns
           the outcome ('clears', 'falls short', 'strikes the far leaf' (and falls),
           "can't climb"), the gap and tip height the leaves make, the speed up the
           leaf at the tip, the flight's length and the landing's speed into the road. */
        bridgeJump(degrees = 15, kmh = 60, type = 'sedan', seconds = 9, trace = false) {
          const d = drawbridge,
            g = drawbridgeGeometry();
          if (player.car) exitCar();
          if (testCar && vehicles.includes(testCar)) vehicles.splice(vehicles.indexOf(testCar), 1);
          drawbridgeArms();
          d.held = d.angle = clamp((degrees * Math.PI) / 180, 0, DRAWBRIDGE_MAX_ANGLE);
          d.rate = 0;
          d.phase = 'open';
          d.timer = 0;
          d.jumps.length = 0;
          // The ship back at an anchorage, out of the channel.
          const ship = drawbridgeVessel();
          if (ship.leg !== 'anchored') {
            ship.across = (ship.across >= 0 ? 1 : -1) * DRAWBRIDGE_VESSEL.anchor;
            Object.assign(ship, { leg: 'anchored', speed: 0, sails: 0, dir: ship.across > 0 ? -1 : 1 });
          }
          // A clear run: nothing else on the causeway (a cop stopped at the trunnion
          // from an earlier chase, traffic queued at the stop line).
          for (let i = vehicles.length - 1; i >= 0; i--) {
            const o = vehicles[i];
            if (o === player.car || isBoat(o) || isAircraft(o) || !drawbridgeNear(o.x, o.y)) continue;
            if (Math.abs(drawbridgeLocal(o.x, o.y).v) < g.half + 20) vehicles.splice(i, 1);
          }
          const start = bridgePoint(g.bridge, g.hinge[0] - 25 * UNITS_PER_METRE, g.road / 4);
          teleportPlayer(start.x, start.y);
          const c = (testCar = makeCar(type, start.x, start.y, g.f.a, false));
          c.authorized = true;
          enterVehicle(c);
          Object.assign(c, { vx: g.f.ux * kmh * KMH, vy: g.f.uy * kmh * KMH, speed: kmh * KMH, av: 0 });
          const hp = c.hp;
          let tipKmh = null,
            maxLift = 0,
            rolledBack = false;
          const samples = [];
          handlingTestPaved = true;
          for (let i = 0; i < Math.round(seconds * 30) && gameMode === 'play'; i++) {
            // The driver holds the speed (on and off the throttle) up to and up the
            // leaf, flooring it if the slope pulls the car below it.
            const forward = c.vx * g.f.ux + c.vy * g.f.uy;
            keys.KeyW = forward < kmh * KMH;
            update(1 / 30);
            if (trace && i % 3 === 0) samples.push([+(i / 30).toFixed(2), Math.round(drawbridgeLocal(c.x, c.y).u - g.hinge[0]), Math.round(forward / KMH), +(c.deckLift || 0).toFixed(1), c.deckLeaf, !!c.deckAir, +(c.deckSlope || 0).toFixed(2)]);
            maxLift = Math.max(maxLift, c.deckLift || 0);
            if (tipKmh === null && c.deckAir) tipKmh = Math.round(Math.hypot(c.vx, c.vy, c.deckVz || 0) / KMH);
            const along = c.vx * g.f.ux + c.vy * g.f.uy;
            if (!c.deckAir && tipKmh === null && along < -5) rolledBack = true;
            const jump = d.jumps[0];
            if ((jump && (jump.landed !== undefined || jump.splash)) || rolledBack || c.sinkFor > 0) {
              // Run on a moment for the landing to settle.
              for (let k = 0; k < 10; k++) update(1 / 30);
              break;
            }
          }
          keys.KeyW = false;
          handlingTestPaved = false;
          const jump = d.jumps[0],
            outcome = !jump
              ? "can't climb"
              : jump.crossed && jump.landed
                ? 'clears'
                : jump.struck
                  ? 'strikes the far leaf'
                  : 'falls short';
          const report = drawbridgeReport();
          return {
            degrees,
            kmh,
            type,
            outcome,
            gapM: +worldMeters(report.gap).toFixed(1),
            tipM: +worldMeters(report.tipHeight).toFixed(1),
            tipKmh,
            peakM: +worldMeters(maxLift).toFixed(1),
            flightM: jump?.distance ?? null,
            landingMs: jump?.impact != null ? +(jump.impact / UNITS_PER_METRE).toFixed(1) : null,
            hpLost: Math.round(hp - c.hp),
            ...(trace ? { samples } : {}),
          };
        },
        /* Ride a fresh `type` east along the runway strip at `kmh` (held there)
           into a parked `targetType` turned across the way (or 'none'), `gap`
           metres ahead; stepped for `seconds`. `trafficRider`: a traffic bike
           (flat out at the player's side) instead. Returns the riders' report. */
        rideInto(type = 'bike', kmh = 50, targetType = 'sedan', gap = 25, seconds = 0.05, trafficRider = false) {
          if (player.car) exitCar();
          if (testCar && vehicles.includes(testCar)) vehicles.splice(vehicles.indexOf(testCar), 1);
          for (let i = vehicles.length - 1; i >= 0; i--)
            if (vehicles[i].rideTarget) vehicles.splice(i, 1);
          const x = TRACK.x,
            y = TRACK.y + 60;
          teleportPlayer(x, y - 60);
          if (targetType !== 'none') {
            const t = makeCar(targetType, x + gap * UNITS_PER_METRE, y, Math.PI / 2, false);
            t.rideTarget = true;
          }
          // With `trafficRider` the bike is traffic's, ridden by its own rider, and
          // the player watches from the verge.
          const c = (testCar = makeCar(type, x, y, 0, trafficRider));
          c.authorized = true;
          if (trafficRider) {
            // Its rider aims past the parked car at the player standing beyond it.
            c.occupied = true;
            c.ramUntil = gameTime + 30;
            teleportPlayer(x + (gap + 8) * UNITS_PER_METRE, y);
          } else enterVehicle(c);
          Object.assign(c, { vx: kmh * KMH, vy: 0, speed: kmh * KMH, av: 0 });
          handlingTestPaved = true;
          for (let i = 0; i < Math.round(seconds * 30) && gameMode === 'play'; i++) {
            // Held at the speed (on and off the throttle) until the crash.
            keys.KeyW = !!player.car && c.vx < kmh * KMH;
            update(1 / 30);
          }
          keys.KeyW = false;
          handlingTestPaved = false;
          return riderReport();
        },
        /* Steer a fresh `type` at `kmh` and measure. options:
           dir 1 right / -1 left; seconds; mode 'cruise' (throttle on and off to hold
           the speed), 'coast', 'throttle' (held), 'brake' (S held) or 'handbrake'
           (Space held); wet 0..1 (the road's wetness for the test); entry: seconds
           driven straight first. Returns the radius (m, fitted while the heading
           turns from 20 to 110 degrees, at the mean speed there, fitKmh), the yaw and lateral g, the run to 90 degrees
           (forward and sideways, m, and seconds), the heading turned, the speed at
           the end and whether anything was touched. */
        turnTest(type = 'sedan', kmh = 30, options = {}) {
          const { dir = 1, seconds = 6, mode = 'cruise', wet = 0, entry = 0.3, x = TRACK.x, y = TRACK.y, trace = false } = options;
          const samples = [];
          if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
          const savedWet = weather.wet;
          if (player.car) exitCar();
          if (testCar && vehicles.includes(testCar)) vehicles.splice(vehicles.indexOf(testCar), 1);
          // Nothing left on the strip from a ride test.
          for (let i = vehicles.length - 1; i >= 0; i--) if (vehicles[i].rideTarget) vehicles.splice(i, 1);
          teleportPlayer(x, y - 60);
          const c = (testCar = spawnClearCar(type, x, y, 0, false));
          c.authorized = true;
          enterVehicle(c);
          Object.assign(c, { x, y, a: 0, av: 0, vx: kmh * KMH, vy: 0, speed: kmh * KMH });
          player.x = x;
          player.y = y;
          const target = kmh * KMH,
            turnKey = dir > 0 ? 'KeyD' : 'KeyA',
            path = [];
          let turned = 0,
            lastA = c.a,
            at90 = null,
            touched = false,
            fitSpeed = 0,
            turnFrom = null,
            time = 0;
          c.contactPass = -1;
          handlingTestPaved = true;
          for (let i = 0; i < Math.round(seconds * 30) && gameMode === 'play'; i++) {
            weather.wet = wet;
            for (const k of ['KeyW', 'KeyS', 'Space', 'KeyA', 'KeyD']) keys[k] = false;
            const along = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
            if (mode === 'cruise' || time < entry) keys.KeyW = along < target;
            if (mode === 'throttle') keys.KeyW = true;
            if (time >= entry) {
              keys[turnKey] = true;
              if (mode === 'brake') keys.KeyS = true;
              if (mode === 'handbrake') keys.Space = true;
            }
            update(1 / 30);
            time += 1 / 30;
            if (c.contactPass >= 0) touched = true;
            if (trace && i % 3 === 0) samples.push({ t: +time.toFixed(2), ...pose(), skid: +c.skid.toFixed(2) });
            turned += normalizeAngle(c.a - lastA) * dir;
            lastA = c.a;
            if (turned > (20 * Math.PI) / 180 && turned < (110 * Math.PI) / 180) {
              path.push({ x: c.x, y: c.y });
              fitSpeed += Math.hypot(c.vx, c.vy);
            }
            if (!turnFrom && time >= entry) turnFrom = { x: c.x, y: c.y };
            if (!at90 && turned >= Math.PI / 2)
              at90 = {
                // From where the key went down.
                forward: +worldMeters(c.x - turnFrom.x).toFixed(1),
                side: +worldMeters(Math.abs(c.y - turnFrom.y)).toFixed(1),
                seconds: +(time - entry).toFixed(2),
                kmh: +(Math.hypot(c.vx, c.vy) / KMH).toFixed(1),
              };
          }
          for (const k of ['KeyW', 'KeyS', 'Space', 'KeyA', 'KeyD']) keys[k] = false;
          handlingTestPaved = false;
          weather.wet = savedWet;
          // The radius over 20-110 degrees of the turn, at the mean speed there.
          const radius = fitRadius(path),
            speed = path.length ? fitSpeed / path.length : Math.hypot(c.vx, c.vy);
          return {
            type,
            kmh,
            mode,
            wet,
            radius: radius ? +worldMeters(radius).toFixed(1) : null,
            // Kerb-to-kerb circle: the path's diameter plus the car's width.
            kerbToKerb: radius ? +worldMeters(2 * radius + vehicleSpec(c).w).toFixed(1) : null,
            yawRate: +Math.abs(c.av).toFixed(2),
            lateralG: radius ? +((speed * speed) / radius / GRAVITY).toFixed(2) : null,
            at90,
            turnedDeg: Math.round((turned * 180) / Math.PI),
            fitKmh: +(speed / KMH).toFixed(1),
            endKmh: +(Math.hypot(c.vx, c.vy) / KMH).toFixed(1),
            slip: pose().slip,
            touched,
            ...(trace ? { samples } : {}),
          };
        },
      };
    }
