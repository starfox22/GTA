    // BEGIN SUBSYSTEM: src/game-console-vehicles.js — DeadEndCity console, vehicles: drive, ride, steerTo, flight, drivingState, garage, off-road (+ damage, handling, dealership consoles)
    // Vehicles and driving: spawn/board/place/steer, telemetry (ride, flight, drivingState,
    // speedBox), repair and respray, off-road trails; damage, handling and dealership consoles.
    addConsoleMethods('vehicles', {
      // Mend the player's vehicle as a repair bay would (for repeatable physics tests).
      repair() {
        if (!player.car) return null;
        repairVehicle(player.car);
        return this.damageReport();
      },
      // Bring the player's vehicle down to `percent` of its health through the ordinary
      // damage path (never up: repair() mends). Returns its hp, share, fire and mission flag.
      vehicleHealth(percent = 100) {
        const c = player.car;
        if (!c) return null;
        const target = (clamp(Number(percent) || 0, 0, 100) / 100) * c.maxhp;
        if (target < c.hp) damageVehicle(c, c.hp - target);
        return { hp: Math.round(c.hp), maxhp: c.maxhp, percent: Math.round((100 * c.hp) / c.maxhp), burning: !!c.damage?.burning, mission: !!c.mission };
      },
      // The 4x4 club and the trails (offroad.js): the lot and its clearances, the
      // club trucks, the members, the player's traction state, the hill climb.
      offroad: () => offroadReport(),
      clubLineup: (x, y) => clubLineup(x, y),
      // 'state', 'arm', 'reset', 'clear' (records), 'gate', 'cp0'..'cp3', 'top' (just below the summit, facing down) or 'at0.42' (that fraction of the trail): move the player's vehicle there.
      hillClimb: (action, trail) => hillClimbConsole(action, trail),
      // Drive the player's vehicle up a trail (or 'down' it) through the real physics (a line-following
      // pilot) with frames of `frame` seconds (1/30 default): progress, time and the ride telemetry.
      trailDrive: (seconds, maxKmh, trail, frame, direction) => trailPilot(seconds, maxKmh, trail, frame, direction),
      // The ride on the terrain of the player's vehicle (terrain-suspension.js): lift, pitch, roll, load, each wheel's travel and load.
      ride3d: () => rideReport(),
      // What the ride costs: µs a ride step for the player's vehicle, vehicles on the terrain, rides still working.
      rideBenchmark: (n) => rideBenchmark(n),
      // A trail's path: [sample, x, y, height, grade, mud, rock] every `step` samples.
      trailProfile: (trail, step) => trailProfile(trail, step),
      // Set the mud on the player's vehicle (0..1) and how wet it is.
      mud: (amount = 1, wet = 1) => {
        const c = player.car;
        if (!c) return null;
        c.mudCoat = clamp(amount, 0, 1);
        c.mudWet = clamp(wet, 0, 1);
        return { mudCoat: c.mudCoat, mudWet: c.mudWet };
      },
      // Drive the player's road vehicle or boat toward (x, y) through the real
      // physics for up to `seconds`, holding W and steering with A/D, easing off
      // near the point. A straight-line pilot for checking that a route is
      // passable (it does not path-find); returns where it stopped and why. With
      // `passThrough` it does not stop: it counts the point reached at speed.
      steerTo(x, y, seconds = 30, radius = 50, passThrough = false) {
        const c = player.car;
        if (!c || isAircraft(c)) return null;
        let t = 0,
          reason = 'time',
          stuckFor = 0,
          backUp = 0;
        for (; t < seconds; t += 1 / 30) {
          if (gameMode !== 'play' || player.car !== c) {
            reason = 'left vehicle';
            break;
          }
          const d = Math.hypot(x - c.x, y - c.y);
          if (d < radius && (passThrough || Math.abs(c.speed) < 8)) {
            reason = 'arrived';
            break;
          }
          const err = normalizeAngle(Math.atan2(y - c.y, x - c.x) - c.a);
          const fast = !passThrough && c.speed > Math.max(40, d * 0.9);
          // Wedged against a wall or a shore: back off for a moment, wheel turned.
          stuckFor = d > radius && Math.abs(c.speed) < 5 ? stuckFor + 1 / 30 : 0;
          if (stuckFor > 1) backUp = 1;
          if (backUp > 0) {
            backUp -= 1 / 30;
            keys.KeyW = false;
            keys.KeyS = true;
            keys.KeyD = err < 0;
            keys.KeyA = err > 0;
          } else if (Math.abs(err) > 1.9 && c.speed < 25 && !isBoat(c)) {
            // Facing away: back up on opposite lock, a three-point turn.
            keys.KeyW = false;
            keys.KeyS = true;
            keys.KeyD = err < 0;
            keys.KeyA = err > 0;
          } else if (d < radius) {
            // On the spot: just brake to a stop, whichever way it is rolling.
            keys.KeyW = c.speed < -10;
            keys.KeyS = c.speed > 10;
            keys.KeyA = keys.KeyD = false;
          } else {
            keys.KeyW = !fast && (Math.abs(err) < 1.4 || c.speed < 20);
            keys.KeyS = fast || (Math.abs(err) >= 1.4 && c.speed > 20);
            keys.KeyD = err > 0.06;
            keys.KeyA = err < -0.06;
          }
          update(1 / 30);
        }
        keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false;
        return {
          reason,
          seconds: Math.round(t),
          x: Math.round(c.x),
          y: Math.round(c.y),
          speed: Math.round(c.speed || 0),
          hp: Math.round(c.hp),
          left: Math.round(Math.hypot(x - c.x, y - c.y)),
          wanted: Math.ceil(wantedStars),
        };
      },
      // Drive the player's road vehicle along the GPS road route to (x, y) through the real
      // physics, as a player holding W/S/A/D would: steer at a point a little way along the
      // route, slow for the turns ahead (to `maxKmh` on the straights), back off when wedged,
      // and plan again from where it is when shoved off the route (traffic, police rams).
      // Returns where it stopped and why ('arrived', 'time', 'left vehicle', 'no route'),
      // with the re-plans, back-offs and the wanted level.
      followRoute(x, y, seconds = 120, maxKmh = 80) {
        const c = player.car;
        if (!c || isAircraft(c) || isBoat(c)) return null;
        const nodes = navigationGraph(),
          goal = { x, y },
          plan = () => {
            const r = navShortestPath(nodes, closestNavNode(c, nodes), closestNavNode(goal, nodes));
            r.push(goal);
            return r;
          };
        let route = plan(),
          at = 0,
          t = 0,
          reason = 'time',
          stuckFor = 0,
          backUp = 0,
          replans = 0,
          backoffs = 0,
          lastPlan = 0;
        if (route.length < 2) return { reason: 'no route' };
        for (; t < seconds; t += 1 / 30) {
          if (gameMode !== 'play' || player.car !== c) {
            reason = 'left vehicle';
            break;
          }
          if (Math.hypot(x - c.x, y - c.y) < 70 && Math.abs(c.speed) < 32) {
            reason = 'arrived';
            break;
          }
          // Progress along the route, and how far off it the vehicle is.
          let off = Infinity;
          for (let i = at; i < Math.min(route.length, at + 10); i++) {
            const d = Math.hypot(route[i].x - c.x, route[i].y - c.y);
            if (d < off) {
              off = d;
              at = i;
            }
          }
          if (off > 170 && t - lastPlan > 2) {
            route = plan();
            at = 0;
            lastPlan = t;
            replans++;
          }
          // The point to steer at: about `look` units along the route.
          const look = 60 + Math.abs(c.speed) * 0.6;
          let tx = route[Math.min(at + 1, route.length - 1)].x,
            ty = route[Math.min(at + 1, route.length - 1)].y;
          for (let i = at, left = look; i < route.length - 1; i++) {
            const a = i === at ? c : route[i],
              b = route[i + 1],
              seg = Math.hypot(b.x - a.x, b.y - a.y);
            tx = b.x;
            ty = b.y;
            if (seg >= left) {
              tx = a.x + ((b.x - a.x) * left) / seg;
              ty = a.y + ((b.y - a.y) * left) / seg;
              break;
            }
            left -= seg;
          }
          // The sharpest turn within braking reach (~320 units) sets the speed.
          let turn = 0;
          for (let i = at, run = 0; i < route.length - 2 && run < 320; i++) {
            const a1 = Math.atan2(route[i + 1].y - route[i].y, route[i + 1].x - route[i].x),
              a2 = Math.atan2(route[i + 2].y - route[i + 1].y, route[i + 2].x - route[i + 1].x);
            turn = Math.max(turn, Math.abs(normalizeAngle(a2 - a1)));
            run += Math.hypot(route[i + 1].x - route[i].x, route[i + 1].y - route[i].y);
          }
          // ...and so does the end of the route: brake to stop there (about 3 m/s²).
          const toGoal = Math.hypot(x - c.x, y - c.y),
            limit = Math.min((turn > 1 ? 24 : turn > 0.45 ? 40 : maxKmh) * KMH, Math.sqrt(48 * Math.max(0, toGoal - 45)) + 18),
            err = normalizeAngle(Math.atan2(ty - c.y, tx - c.x) - c.a);
          // Wedged (a wall, a box-in): back off at once, before the police can call it a
          // surrender (pursuit-officers.js, 1.5 s within 6 units).
          stuckFor = Math.abs(c.speed) < 5 && backUp <= 0 ? stuckFor + 1 / 30 : 0;
          if (stuckFor > 0.5) {
            backUp = 0.9;
            stuckFor = 0;
            backoffs++;
          }
          if (backUp > 0) {
            backUp -= 1 / 30;
            keys.KeyW = false;
            keys.KeyS = true;
            keys.KeyD = err < 0;
            keys.KeyA = err > 0;
          } else if (Math.abs(err) > 1.9 && c.speed < 25) {
            // Facing away: back round on opposite lock.
            keys.KeyW = false;
            keys.KeyS = true;
            keys.KeyD = err < 0;
            keys.KeyA = err > 0;
          } else {
            const fast = c.speed > limit + 6 * KMH;
            keys.KeyW = !fast && c.speed < limit && Math.abs(err) < 1.3;
            keys.KeyS = fast || (Math.abs(err) >= 1.3 && c.speed > 20);
            keys.KeyD = err > 0.05;
            keys.KeyA = err < -0.05;
          }
          update(1 / 30);
        }
        keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false;
        return {
          reason,
          seconds: Math.round(t),
          x: Math.round(c.x),
          y: Math.round(c.y),
          speed: Math.round(c.speed || 0),
          hp: Math.round(c.hp),
          left: Math.round(Math.hypot(x - c.x, y - c.y)),
          replans,
          backoffs,
          wanted: Math.ceil(wantedStars),
        };
      },
      // Move the player's vehicle (with the player aboard) to a point, stopped,
      // facing `heading`; aircraft can be lifted to an altitude in metres.
      placeVehicle(x, y, heading = player.car?.a ?? 0, altitudeMeters = 0) {
        const c = player.car;
        if (!c) return null;
        Object.assign(c, { x, y, a: heading, vx: 0, vy: 0, vz: 0, av: 0, speed: 0 });
        if (isAircraft(c))
          c.altitude = altitudeMeters > 0 ? terrainHeight(x, y) + altitudeMeters * UNITS_PER_METRE : terrainHeight(x, y);
        player.x = x;
        player.y = y;
        cameraTarget.x = x;
        cameraTarget.y = y;
        return this.status();
      },
      // The respray garages (garages.js): shops, doors, prices, the offer for the
      // player's vehicle, the drive-in job in progress and the last service.
      garage: () => garageReport(),
      // The player's aircraft instruments as the flight HUD shows them (aviation.js
      // flightData): airspeed km/h, altitude and AGL m, vertical speed m/s, heading,
      // pitch, bank, throttle and spooled power, flaps, gear, g, stall warnings.
      flight() {
        const data = flightData(player.car);
        if (!data) return null;
        const out = {};
        for (const [key, value] of Object.entries(data))
          out[key] = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
        out.hud = !!document.getElementById('flightHud')?.classList.contains('on');
        out.instruments = hudState.flightHud;
        return out;
      },
      // What the vehicle under the player is actually doing.
      ride: () => ({
        type: player.car ? player.car.type : null,
        speed: player.car ? Math.round((player.car.speed || 0) * 10) / 10 : 0,
        vx: player.car ? Math.round((player.car.vx || 0) * 10) / 10 : 0,
        vy: player.car ? Math.round((player.car.vy || 0) * 10) / 10 : 0,
        cadence: Math.round(pedalCadence() * 100) / 100,
        effort: Math.round(pedalEffort() * 100) / 100,
        // Aircraft: absolute altitude in map units (0 on the ground).
        altitude: player.car ? Math.round(player.car.altitude || 0) : 0,
        // Tanks: hull and turret headings (degrees), where the gunner is aiming,
        // the traverse rate (deg/s) and the ammunition (armor.js).
        ...(player.car?.type === 'tank'
          ? {
              hull: Math.round((player.car.a * 180) / Math.PI),
              turret: Math.round(((player.car.turretA ?? player.car.a) * 180) / Math.PI),
              aim: Math.round(((player.car.turretAim ?? player.car.a) * 180) / Math.PI),
              traverse: Math.round(((player.car.turretRate || 0) * 180) / Math.PI),
              arms: { ...tankArms(player.car), reload: Math.max(0, Math.round(((player.car.cannonReadyAt || 0) - gameTime) * 10) / 10) },
            }
          : {}),
      }),
      // The speed box as shown: mode, label, figure and unit line (hud.js SPEED BOX).
      speedBox: () => (updateSpeedBox(), {
        active: getElement('vehicleStats').classList.contains('active'),
        mode: getElement('vehicleStats').dataset.mode,
        label: getElement('vehicleName').textContent,
        speed: getElement('speed').textContent,
        unit: getElement('speedUnit').textContent,
        units: hudState.units,
      }),
      // Rack a bicycle beside the player.
      bike(headingRadians = player.a) {
        spawnClearCar(
          'bicycle',
          player.x + Math.cos(headingRadians) * 30,
          player.y + Math.sin(headingRadians) * 30,
          headingRadians,
          false,
        );
        return this.status();
      },
      // Spawn a vehicle of any VEHICLE_DEFINITIONS type beside the player and put
      // them at the controls. Aircraft can be lifted straight to an altitude in
      // metres above the ground so tests can look at the flight view. An optional
      // heading (radians, 0 = east) points it down a chosen road. A plane takes
      // an optional airframe ('courier' default, 'jet', 'airliner').
      drive(type = 'sedan', altitudeMeters = 0, headingRadians = player.a, airframe) {
        if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
        if (airframe && (type !== 'plane' || !AIRFRAME_SPECS[airframe])) throw Error('Unknown airframe ' + airframe);
        if (player.car) exitCar();
        let car = null;
        if (['speedboat', 'workboat', 'jetski'].includes(type)) {
          // Boats go on the nearest open water (spawnClearCar wants dry land).
          for (let r = 0; r < 600 && !car; r += 20)
            for (let i = 0; i < (r ? 24 : 1) && !car; i++) {
              const x = player.x + Math.cos((i * TAU) / 24) * r,
                y = player.y + Math.sin((i * TAU) / 24) * r;
              if (boatFits({ type, x, y, a: headingRadians })) car = makeCar(type, x, y, headingRadians, false);
            }
          if (!car) throw Error('No open water near the player for ' + type);
          player.swimming = false;
        } else car = spawnClearCar(type, player.x + 60, player.y, headingRadians, false);
        if (airframe) {
          car.airframe = airframe;
          car.hp = car.maxhp = vehicleSpec(car).hp;
        }
        car.authorized = true;
        enterVehicle(car);
        if (altitudeMeters > 0 && isAircraft(car)) {
          car.altitude = terrainHeight(car.x, car.y) + altitudeMeters * UNITS_PER_METRE;
          if (car.type === 'plane') {
            car.vx = Math.cos(car.a) * 295 * KMH;
            car.vy = Math.sin(car.a) * 295 * KMH;
            // Cruising: gear up, cruise power.
            car.gearDown = false;
            car.gearPos = 0;
            car.throttle = car.power = 0.75;
          }
        }
        return this.status();
      },
      // Set the current vehicle moving along its heading at `metersPerSecond`.
      launch(metersPerSecond = 20) {
        const c = player.car;
        if (!c) return null;
        const speed = metersPerSecond * UNITS_PER_METRE;
        c.vx = Math.cos(c.a) * speed;
        c.vy = Math.sin(c.a) * speed;
        c.speed = speed;
        return this.ride();
      },
      // The flagships and dirt bikes in the world (SHOWCASE PARKING and traffic):
      // id, type, where (x, y, district), the showcase place it stands at, driven or parked.
      showcase() {
        return vehicles
          .filter((c) => VEHICLE_DEFINITIONS[c.type]?.flagship || c.type === 'kr500')
          .map((c) => {
            const spot = SHOWCASE_PARKING.find((p) => Math.hypot(p.x - c.x, p.y - c.y) < 260);
            return { id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y), district: districtAt(c.x, c.y), place: spot ? spot.place : null, driven: !!c.ai };
          });
      },
      /* The player's tyres (tyre-effects.js): the burnout, what they throw up now and
         the totals since `reset` (smoke, dust and spray puffs, skid marks, metres). */
      tyreEffects: (reset = false) => tyreEffectsReport(!!reset),
      /* The player's road vehicle through the tyre model (driving.js): the
         assists it has and has switched on, the HUD lamps, the pedal and
         steering ramps, each axle's slip, lock, ABS pressure and sideways share,
         the wheelspin and the stability yaw. */
      drivingState() {
        const c = player.car;
        if (!c || isAircraft(c) || isBoat(c)) return null;
        const ch = drivingCharacter(c),
          t = c.tyres,
          round = (v) => +(+v).toFixed(3);
        return {
          type: c.type,
          fitted: { abs: ch.abs, esc: ch.esc, tcs: ch.tcs },
          lamps: drivingAssistStates(c),
          character: { front: ch.front, cgOverWheelbase: ch.hL, bias: round(ch.bias), drive: ch.drive, liftOff: round(ch.liftOff) },
          settings: { ...drivingSettings },
          tyres: t
            ? {
                pedal: round(t.pedal),
                steer: round(t.steer),
                slip: t.slip.map(round),
                lock: t.lock.map(round),
                pressure: t.pressure.map(round),
                lateral: t.lateral.map(round),
                spin: round(t.spin),
                yawSlide: round(t.yawSlide),
                decelG: round(t.lastDecel || 0),
              }
            : null,
          absActive: !!c.absActive,
          tyreSlip: round(c.tyreSlip || 0),
        };
      },
    });
    // Drive-bys: driveBy(), driveByArcs(), driveByCheck(), driveByAim() (see driveby.js driveByConsole).
    addConsoleMethods('vehicles', driveByConsole());
    // Damage testing: park(), shootAt(), blast(), crashTest(), damageReport(),
    // streetProps(), damageStats() (see damage.js damageConsole).
    addConsoleMethods('damage', damageConsole());
    // Handling: turnTest(), pose(), aiDriving(), riderReport(), rideInto(),
    // bridgeJump() (see physics-console.js handlingConsole).
    addConsoleMethods('handling', handlingConsole());
    // Wheelies: wheelieState() (see wheelie.js wheelieConsole).
    addConsoleMethods('handling', wheelieConsole());
    // MONARCH MOTORS: dealership(), prestigeCatalog(), dealershipVisit(), dealerMenu(),
    // dealerBuy(), dealerAlarm(), dealerShatter(), dealerCalm(), dealerResetGarage()
    // (see dealership.js dealershipConsole).
    addConsoleMethods('dealership', dealershipConsole());
    // END SUBSYSTEM: src/game-console-vehicles.js
