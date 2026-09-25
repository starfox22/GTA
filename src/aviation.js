    // BEGIN SUBSYSTEM: src/aviation.js — Fixed-wing flight and flight missions
    /**
     * Fixed-wing flight and flight missions
     * Source: src/aviation.js
     * Scope: shared game closure.
     * Three airframes, stall/lift/bank model, takeoff, landing, rescue and witness escape missions.
     */
    /* Fixed-wing flight and two additional campaign chapters. Coordinates share the playable map. */
    const isAircraft = (vehicle) =>
      !!vehicle && (vehicle.type === 'helicopter' || vehicle.type === 'plane');
    // Where a plane may land: every runway in airfields.js (RUNWAYS), plus Fort
    // Sentinel's short strip (military.js). `a` is the runway's axis.
    const AIRFIELDS = [
      ...RUNWAYS.map((r) => ({ name: r.name, ...runwayRect(r), a: r.axis === 'x' ? 0 : Math.PI / 2 })),
      { name: 'FORT SENTINEL', ...SENTINEL.runway, a: 0 },
    ];
    const FLIGHT = {
      // Mission 11's plane lines up on Oceanview's runway 09 at the west
      // stub, 1,000 m of runway ahead of it (the courier needs about 300).
      plane: {
        x: 3000,
        y: 9884,
        a: 0,
      },
      // The courier parked on Oceanview's apron in free roam.
      parked: {
        x: 5000,
        y: 9300,
      },
      heli: {
        x: 3690,
        y: 8830,
      },
      pickup: {
        x: 8130,
        y: 2740,
      },
      // Southport's touchdown zone on runway 36 (landing northbound).
      arrival: {
        x: 418,
        y: 7300,
      },
    };
    missions.push(
      {
        title: 'The Last Witness',
        contact: 'elena',
        reward: 10000,
        phoneMessage:
          'Elena gave you a mission: fly to Northridge, break Daniel out of custody, and escort him to the helicopter.',
        brief: 'Rescue Daniel from Vale’s guards and fly him to Oceanview.',
      },
      {
        title: 'The Manifest',
        contact: 'rafe',
        reward: 16000,
        phoneMessage:
          'Rafe gave you a mission: fly Daniel and the ledger to Southport. Be ready to divert if our clearance is compromised.',
        brief: 'Carry Daniel and the ledger; survive the exposed manifest and reach Vinny’s warehouse.',
      },
    );
    function runwayAt(c) {
      return AIRFIELDS.find((r) =>
        corners(vehicleShape(c)).every(
          (p) => p.x > r.x + 3 && p.x < r.x + r.w - 3 && p.y > r.y + 3 && p.y < r.y + r.h - 3,
        ),
      );
    }
    function aircraftClear(c) {
      // This checks the intended touchdown surface. Aircraft altitude is absolute,
      // so comparing other aircraft against sea level misses occupied mountain pads.
      const landingElevation = terrainHeight(c.x, c.y);
      return (
        ![...nearbyStatics(c)].some(
          (b) =>
            (b.minHeight === undefined ||
              landingElevation + vehicleCollisionHeight(c) >= b.minHeight) &&
            boxContact(vehicleShape(c, 2), b),
        ) &&
        !vehicles.some(
          (o) =>
            o !== c &&
            Math.abs(entityElevation(o) - landingElevation) < 22 &&
            boxContact(vehicleShape(c, 2), vehicleShape(o, 2)),
        )
      );
    }
    // Assisted light-aircraft model. Speeds and forces are real (km/h, m/s, g) and
    // converted to world units through UNITS_PER_METRE, so the instruments read true.
    // Pitch sets angle of attack; lift acts normal to the flight path and banks into a turn.
    const AIRFRAME_SPECS = {
      courier: {
        name: 'SERRANO C200 COURIER',
        l: 112,
        w: 100,
        hp: 250,
        flightMass: 1450,
        // Wing and drag sized for a lift-off near 115-140 km/h and about 400 km/h
        // flat out; `drag0` is the parasitic drag coefficient. Take-off thrust
        // is a loaded turboprop's share of its weight over the roll (a PC-12's
        // is about 0.3), and `drag0` came down with it so the top speed held:
        // the take-off roll is 230-300 m (AIRFRAME PERFORMANCE below).
        // `brake` is the wheel brakes' best, in g.
        wing: 20.3,
        drag0: 0.0263,
        thrust: 0.28 * GRAVITY,
        brake: 0.45,
        roll: 2.7,
        bank: 1,
        // Clean stall and rotation speeds (flaps lower both).
        stall: 100 * KMH,
        rotate: 115 * KMH,
        assist: 0.55,
        // Engine spool, fraction of full power per second (up, down).
        spoolUp: 0.9,
        spoolDown: 1.3,
      },
      jet: {
        name: 'AURELIA J8 PRIVATE JET',
        l: 150,
        w: 118,
        height: 47,
        hp: 320,
        mass: 5.2,
        flightMass: 2400,
        // Lift-off near 180-200 km/h, about 740 km/h flat out; a light
        // business jet's thrust-to-weight over the roll (0.3): 500-600 m.
        wing: 13.7,
        drag0: 0.0198,
        thrust: 0.3 * GRAVITY,
        brake: 0.45,
        roll: 2.35,
        bank: 0.92,
        stall: 157 * KMH,
        rotate: 180 * KMH,
        assist: 0.46,
        spoolUp: 0.38,
        spoolDown: 0.55,
      },
      airliner: {
        name: 'MERIDIAN 220 AIRLINER',
        l: 214,
        w: 148,
        height: 60,
        hp: 520,
        mass: 14,
        flightMass: 4300,
        // Lift-off near 210-230 km/h, about 830 km/h flat out; a regional
        // jet's thrust-to-weight over the roll (0.26): 800-950 m.
        wing: 18.3,
        drag0: 0.0184,
        thrust: 0.26 * GRAVITY,
        brake: 0.42,
        roll: 1.55,
        bank: 0.78,
        stall: 183 * KMH,
        rotate: 210 * KMH,
        assist: 0.32,
        spoolUp: 0.3,
        spoolDown: 0.45,
      },
    };
    function populateAircraft() {
      // Both jets and the airliner live at Oceanview: Southport's 460 m strip is
      // for the courier (a jet needs 500-600 m to lift off).
      for (const [airframe, x, y, a] of [
        ['jet', 5530, 9500, 0],
        ['airliner', 4880, 9520, 0],
        ['jet', 3790, 9230, 0],
      ]) {
        const vehicle = makeCar('plane', x, y, a, false, airframe === 'jet' ? '#e1e4db' : '#d0dfde');
        vehicle.airframe = airframe;
        vehicle.hp = vehicle.maxhp = vehicleSpec(vehicle).hp;
        vehicle.authorized = true;
      }
    }
    const PLANE_FLIGHT = {
      gravity: GRAVITY,
      mass: 1450,
      wing: 14,
      stallAngle: 0.27,
      // About 825-900 m: room to climb through the cloud layer (clouds3d.js,
      // 385-610 m) and fly above the tops.
      ceilingStart: 6600,
      ceiling: 7200,
    };
    function planeTouchdown(c, sink) {
      const runway = runwayAt(c),
        dry = corners(vehicleShape(c)).every((p) => landAt(p.x, p.y));
      const aligned = runway && Math.abs(Math.sin(c.a - runway.a)) < 0.22;
      const unsafe =
        Math.max(0, sink / UNITS_PER_METRE - 2.5) * 15 +
        Math.max(0, Math.abs(c.bank) - 0.18) * 180 +
        Math.max(0, Math.abs(c.pitch) - 0.23) * 180;
      let damage = unsafe + (aligned ? 0 : dry ? 35 + Math.max(0, c.airspeed / UNITS_PER_METRE - 31) * 1.8 : c.maxhp);
      if (!aircraftClear(c)) damage += 90;
      // Wheels not down and locked: a belly landing.
      const belly = dry && (c.gearPos ?? 1) < 0.9;
      if (belly) damage += 45 + Math.max(0, (c.airspeed || 0) / UNITS_PER_METRE - 23) * 1.5;
      if (damage > 0) damageVehicle(c, damage, c.x, c.y);
      c.altitude = terrainHeight(c.x, c.y);
      c.vz = 0;
      c.landedAt = aligned ? runway.name : null;
      c.throttle = Math.min(c.throttle, 0.2);
      c.pitchRate = c.bankRate = 0;
      c.bank = 0;
      c.pitch = 0;
      c.stalled = false;
      if (c === player.car)
        tell(
          !dry
            ? 'DITCHING · Aircraft lost'
            : belly
              ? 'BELLY LANDING · Gear was up'
              : damage > 20
              ? 'HARD LANDING · Aircraft damaged'
              : 'TOUCHDOWN · Hold S to brake',
          4,
        );
    }
    /**
     * FLIGHT CONTROLS
     * The pilot's inputs go through the airframe the way they would in a real
     * light aircraft, on top of the lift / drag / stall model below:
     *   - The throttle lever (W / S) sets `throttle`; the engine's `power` spools
     *     after it (the turboprop in about a second, turbofans in two to three).
     *   - Pitch and bank are damped springs with inertia (`pitchRate`,
     *     `bankRate`): the nose and the wings follow the stick smoothly and
     *     settle, and control authority grows with airspeed. Turns are
     *     auto-coordinated: bank turns the flight path through the lift vector and
     *     the fuselage follows its slip angle.
     *   - Flaps (X extends a notch, Z retracts: UP, 1, 2, FULL) add lift and drag
     *     and lower the stall and rotation speeds; they travel at a finite rate.
     *   - The landing gear (L) retracts and extends over a few seconds; it cannot
     *     retract on the ground, adds drag when down, and a gear-up touchdown is a
     *     belly landing. A horn sounds when low, slow and descending with it up.
     *   - A stall warning (horn and HUD) comes on a little before the stall; the
     *     buffet (`buffet`, shaking the airframe and the camera) grows into it.
     *   - On the ground A / D steer the nosewheel (less at speed) and S at idle
     *     power brakes.
     * `ctrlPitch`, `ctrlRoll`, `ctrlYaw` (-1..1) are the smoothed stick and pedal
     * positions the 3D model deflects its elevators, ailerons and rudder by.
     */
    const FLAP_NOTCHES = ['UP', '1', '2', 'FULL'],
      GEAR_TRAVEL_SECONDS = 4.5,
      FLAP_RATE = 0.4,
      // Drag coefficients added by full flap and by the gear down, on top of
      // `drag0` (a real airframe's gear adds about a third of its clean drag).
      FLAP_DRAG = 0.03,
      GEAR_DRAG = 0.012,
      // Tyres on a paved runway: about 0.025 g of rolling resistance.
      ROLLING_RESISTANCE = 0.025 * GRAVITY;
    function flightSetup(aircraft) {
      if (aircraft.flightReady) return;
      aircraft.flightReady = true;
      aircraft.flaps = aircraft.flaps || 0;
      aircraft.flapPos = aircraft.flapPos || 0;
      aircraft.gearDown = aircraft.gearDown ?? true;
      aircraft.gearPos = aircraft.gearPos ?? (aircraft.gearDown ? 1 : 0);
      aircraft.power = aircraft.power ?? aircraft.throttle ?? 0;
      aircraft.pitchRate = 0;
      aircraft.bankRate = 0;
      aircraft.gLoad = 1;
      aircraft.buffet = 0;
      aircraft.ctrlPitch = aircraft.ctrlRoll = aircraft.ctrlYaw = 0;
    }
    function setPlaneFlaps(aircraft, step) {
      flightSetup(aircraft);
      const next = clamp(aircraft.flaps + step, 0, FLAP_NOTCHES.length - 1);
      if (next === aircraft.flaps) return false;
      aircraft.flaps = next;
      if (aircraft === player.car) tell('FLAPS ' + FLAP_NOTCHES[next], 1.5);
      return true;
    }
    function togglePlaneGear(aircraft) {
      flightSetup(aircraft);
      const airborne = aircraft.altitude > terrainHeight(aircraft.x, aircraft.y) + 1e-7;
      if (aircraft.gearDown && !airborne) {
        if (aircraft === player.car) tell('GEAR LOCKED DOWN · Weight on wheels', 2);
        return false;
      }
      aircraft.gearDown = !aircraft.gearDown;
      if (aircraft === player.car) tell(aircraft.gearDown ? 'GEAR DOWN' : 'GEAR UP', 1.5);
      return true;
    }
    function planeControl(aircraft, stepSeconds, active) {
      flightSetup(aircraft);
      const controlled = aircraft === player.car && active,
        up = controlled && (keys.KeyW || keys.ArrowUp),
        down = controlled && (keys.KeyS || keys.ArrowDown),
        turn = controlled
          ? (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
          : 0;
      // Nose up / down are the climb and descend actions (↑ / ↓, controls.js).
      const pull = controlled && actionHeld('ascend'),
        push = controlled && actionHeld('descend'),
        airframeProfile = AIRFRAME_SPECS[aircraft.airframe || 'courier'],
        flightModel = {
          ...PLANE_FLIGHT,
          mass: airframeProfile.flightMass,
          wing: airframeProfile.wing,
        };
      aircraft.bank = aircraft.bank || 0;
      aircraft.pitch = aircraft.pitch || 0;
      aircraft.vz = aircraft.vz || 0;
      aircraft.vx = aircraft.vx || 0;
      aircraft.vy = aircraft.vy || 0;
      aircraft.throttle = clamp(
        (aircraft.throttle || 0) + (up ? 0.45 : down ? -0.65 : 0) * stepSeconds,
        0,
        1,
      );
      // Engine spool: the power follows the lever at the engine's own pace.
      const spool = aircraft.throttle > aircraft.power ? airframeProfile.spoolUp : airframeProfile.spoolDown;
      aircraft.power += clamp(aircraft.throttle - aircraft.power, -spool * stepSeconds, spool * stepSeconds);
      // Flaps and gear run toward their levers.
      const flapTarget = aircraft.flaps / (FLAP_NOTCHES.length - 1);
      aircraft.flapPos += clamp(flapTarget - aircraft.flapPos, -FLAP_RATE * stepSeconds, FLAP_RATE * stepSeconds);
      aircraft.gearPos = clamp(aircraft.gearPos + ((aircraft.gearDown ? 1 : -1) * stepSeconds) / GEAR_TRAVEL_SECONDS, 0, 1);
      // Stick and pedals, smoothed, for the control surfaces on the model.
      const ease = 1 - Math.exp(-stepSeconds * 7);
      aircraft.ctrlPitch += ((pull ? 1 : push ? -1 : 0) - aircraft.ctrlPitch) * ease;
      aircraft.ctrlRoll += (turn - aircraft.ctrlRoll) * ease;
      if (aircraft.hp <= 0) {
        aircraft.throttle = 0;
        const wreckFloor = terrainHeight(aircraft.x, aircraft.y);
        if (aircraft.altitude > wreckFloor) {
          aircraft.vz -= flightModel.gravity * stepSeconds;
          aircraft.altitude = Math.max(wreckFloor, aircraft.altitude + aircraft.vz * stepSeconds);
        }
        aircraft.vx *= Math.exp(-stepSeconds * 0.3);
        aircraft.vy *= Math.exp(-stepSeconds * 0.3);
        aircraft.stalled = aircraft.stallWarning = aircraft.gearWarning = false;
        aircraft.buffet = 0;
        return;
      }
      const flaps = aircraft.flapPos,
        stallSpeed = airframeProfile.stall * (1 - 0.16 * flaps),
        rotateSpeed = airframeProfile.rotate * (1 - 0.12 * flaps);
      const horizontalSpeed = Math.hypot(aircraft.vx, aircraft.vy),
        speed = Math.hypot(horizontalSpeed, aircraft.vz),
        airborne = aircraft.altitude > terrainHeight(aircraft.x, aircraft.y) + 1e-7,
        flightPathAngle = Math.atan2(aircraft.vz, Math.max(1, horizontalSpeed));
      const q = 0.5 * 1.225 * Math.pow(speed * METERS_PER_UNIT, 2),
        liftScale = (q * flightModel.wing) / flightModel.mass / METERS_PER_UNIT;
      const authority = clamp(horizontalSpeed / (37 * UNITS_PER_METRE), 0.08, 1),
        trim = clamp(
          (flightModel.gravity / Math.max(1, liftScale) / Math.max(0.5, Math.cos(aircraft.bank)) -
            0.22 -
            0.3 * flaps) /
            4.6 -
            0.04,
          -0.085,
          0.16,
        );
      let pitchTarget = airborne
        ? clamp(trim + (pull ? 0.21 : push ? -0.16 : 0), -0.24, 0.39)
        : pull
          ? 0.2
          : 0;
      if (airborne && push) pitchTarget = Math.min(pitchTarget, -0.16);
      if (airborne && aircraft.stalled && !pull)
        pitchTarget = Math.min(pitchTarget, flightPathAngle + 0.035);
      const ceiling = clamp(
        (aircraft.altitude - flightModel.ceilingStart) /
          (flightModel.ceiling - flightModel.ceilingStart),
        0,
        1,
      );
      if (airborne && ceiling > 0)
        pitchTarget = Math.min(pitchTarget, trim * (1 - ceiling) - 0.1 * ceiling);
      pitchTarget = clamp(pitchTarget, -0.7, 0.39);
      // Pitch and roll are damped springs: the airframe has inertia, and the
      // controls bite harder as the airspeed builds.
      const pitchOmega = 3 * Math.sqrt(authority),
        rollOmega = airframeProfile.roll * 1.25 * Math.sqrt(authority),
        bankTarget = airborne
          ? turn * airframeProfile.bank * (0.65 + 0.35 * clamp((horizontalSpeed - 33 * UNITS_PER_METRE) / (17.6 * UNITS_PER_METRE), 0, 1))
          : 0;
      aircraft.pitchRate +=
        (pitchOmega * pitchOmega * (pitchTarget - aircraft.pitch) - 2 * 0.85 * pitchOmega * aircraft.pitchRate) *
        stepSeconds;
      aircraft.pitch += aircraft.pitchRate * stepSeconds;
      if (airborne) {
        aircraft.bankRate +=
          (rollOmega * rollOmega * (bankTarget - aircraft.bank) - 2 * 0.8 * rollOmega * aircraft.bankRate) * stepSeconds;
        aircraft.bank += aircraft.bankRate * stepSeconds;
      } else {
        aircraft.bankRate = 0;
        aircraft.bank *= Math.exp(-stepSeconds * 6);
      }
      const angleOfAttack = aircraft.pitch - flightPathAngle + 0.04,
        stallAngleExcess = Math.max(0, Math.abs(angleOfAttack) - flightModel.stallAngle);
      aircraft.stalled = airborne && (stallAngleExcess > 0.015 || horizontalSpeed < stallSpeed);
      // The warning comes on a few degrees and a few knots before the stall.
      aircraft.stallWarning =
        airborne &&
        (aircraft.stalled ||
          Math.abs(angleOfAttack) > flightModel.stallAngle - 0.05 ||
          horizontalSpeed < stallSpeed * 1.1);
      aircraft.angleOfAttack = angleOfAttack;
      aircraft.stallSpeed = stallSpeed;
      const attached = clamp(0.22 + 0.3 * flaps + angleOfAttack * 4.6, -1.1, 1.46 + 0.3 * flaps),
        liftCoefficient =
          attached * (stallAngleExcess > 0 ? Math.max(0.18, Math.exp(-stallAngleExcess * 9)) : 1);
      const lift = liftScale * liftCoefficient,
        drag =
          liftScale *
            ((airframeProfile.drag0 ?? 0.3) +
              0.068 * liftCoefficient * liftCoefficient +
              stallAngleExcess * 0.85 +
              FLAP_DRAG * flaps +
              (airborne ? GEAR_DRAG * aircraft.gearPos : 0)) +
          (airborne ? 0 : ROLLING_RESISTANCE) +
          // No wheels under it: the belly scrapes along.
          (!airborne && aircraft.gearPos < 0.5 ? 3.2 * GRAVITY : 0);
      const thrust =
          aircraft.power * airframeProfile.thrust * clamp(aircraft.hp / aircraft.maxhp, 0.3, 1),
        pathA = horizontalSpeed > 1 ? Math.atan2(aircraft.vy, aircraft.vx) : aircraft.a;
      // Buffet: shakes in as the wing nears the stall, hard once it has let go;
      // on the ground a light rumble from the runway.
      const buffetTarget = airborne
        ? clamp(
            (Math.abs(angleOfAttack) - (flightModel.stallAngle - 0.05)) * 8 + (aircraft.stalled ? 0.45 : 0),
            0,
            1,
          )
        : clamp((horizontalSpeed - 11.7 * UNITS_PER_METRE) / (176 * UNITS_PER_METRE), 0, 0.12) * (aircraft.gearPos < 0.5 ? 6 : 1);
      aircraft.buffet += (buffetTarget - aircraft.buffet) * (1 - Math.exp(-stepSeconds * 6));
      aircraft.gLoad +=
        ((airborne ? (lift * Math.cos(angleOfAttack)) / flightModel.gravity : 1) - aircraft.gLoad) *
        (1 - Math.exp(-stepSeconds * 5));
      // Lift rotates the velocity vector; the fuselage follows its slip angle instead of snapping velocity.
      if (airborne) {
        const yawRate = clamp(
            ((lift * Math.sin(aircraft.bank)) / Math.max(9.8 * UNITS_PER_METRE, horizontalSpeed)) *
              (1 +
                airframeProfile.assist *
                  clamp((horizontalSpeed - stallSpeed) / (13.7 * UNITS_PER_METRE), 0, 1) *
                  (aircraft.stalled ? 0.3 : 1)),
            -0.7,
            0.7,
          ),
          nextA = pathA + yawRate * stepSeconds;
        const alongAccel =
          thrust * Math.cos(aircraft.pitch - flightPathAngle) -
          drag -
          flightModel.gravity * Math.sin(flightPathAngle);
        const nextSpeed = Math.max(0, speed + alongAccel * stepSeconds),
          normalAccel =
            lift * Math.cos(aircraft.bank) +
            thrust * Math.sin(aircraft.pitch - flightPathAngle) -
            flightModel.gravity * Math.cos(flightPathAngle);
        const nextGamma = clamp(
          flightPathAngle + (normalAccel / Math.max(11.7 * UNITS_PER_METRE, speed)) * stepSeconds,
          -1.4,
          1.1,
        );
        const hs = nextSpeed * Math.cos(nextGamma);
        aircraft.vx = Math.cos(nextA) * hs;
        aircraft.vy = Math.sin(nextA) * hs;
        aircraft.vz = nextSpeed * Math.sin(nextGamma);
        const old = aircraft.a;
        aircraft.a = normalizeAngle(
          aircraft.a + normalizeAngle(nextA - aircraft.a) * (1 - Math.exp(-stepSeconds * 4)),
        );
        aircraft.av = normalizeAngle(aircraft.a - old) / stepSeconds;
        // The rudder the auto-coordination feeds in, for the model.
        aircraft.ctrlYaw += (clamp(aircraft.av * 2.2, -1, 1) - aircraft.ctrlYaw) * ease;
        if (aircraft.stalled) {
          aircraft.pitch -= clamp(stallAngleExcess * 1.3 + 0.04, 0, 0.3) * stepSeconds;
          aircraft.bank += Math.sin(physicsClock * 12) * stallAngleExcess * 0.2 * stepSeconds;
        }
        const next = aircraft.altitude + aircraft.vz * stepSeconds;
        if (next <= terrainHeight(aircraft.x, aircraft.y)) {
          planeTouchdown(aircraft, -aircraft.vz);
        } else aircraft.altitude = next;
      } else {
        let along = Math.max(
          0,
          aircraft.vx * Math.cos(aircraft.a) + aircraft.vy * Math.sin(aircraft.a),
        );
        // Wheel brakes: S with the power at idle brakes hard; with power on it
        // pulls the lever back and drags a little.
        const braking =
          (down && aircraft.throttle < 0.05
            ? aircraft.gearPos > 0.5
              ? airframeProfile.brake ?? 0.45
              : 0.6
            : down
              ? 0.25
              : 0) * GRAVITY;
        along = Math.max(0, along + (thrust - drag - braking) * stepSeconds);
        // Nosewheel steering: full lock at taxi speed, tapering off as the rudder
        // takes over on the take-off roll.
        aircraft.av +=
          ((turn * 0.55 * clamp(along / (9.8 * UNITS_PER_METRE), 0, 1)) / (1 + along / (21.5 * UNITS_PER_METRE)) - aircraft.av) *
          (1 - Math.exp(-stepSeconds * 5));
        aircraft.ctrlYaw += (turn - aircraft.ctrlYaw) * ease;
        aircraft.a = normalizeAngle(aircraft.a + aircraft.av * stepSeconds);
        aircraft.vx = Math.cos(aircraft.a) * along;
        aircraft.vy = Math.sin(aircraft.a) * along;
        aircraft.vz = 0;
        if (lift > flightModel.gravity * 1.02 && pull && along > rotateSpeed) {
          aircraft.vz = 0.4 * UNITS_PER_METRE;
          aircraft.altitude = terrainHeight(aircraft.x, aircraft.y) + 0.1;
          aircraft.landedAt = null;
        }
        if (!landAt(aircraft.x, aircraft.y)) {
          damageVehicle(aircraft, aircraft.maxhp, aircraft.x, aircraft.y);
          aircraft.throttle = aircraft.power = 0;
        }
      }
      aircraft.airspeed = Math.hypot(aircraft.vx, aircraft.vy, aircraft.vz);
      aircraft.speed = aircraft.vx * Math.cos(aircraft.a) + aircraft.vy * Math.sin(aircraft.a);
      if (controlled) planeWarnings(aircraft);
      else aircraft.gearWarning = false;
    }
    /* Cockpit warnings for the player's aircraft: the stall horn, and a gear
       horn when low, slow and descending with the wheels up. */
    function planeWarnings(aircraft) {
      const clearance = aircraftClearance(aircraft),
        gearWarning =
          aircraft.gearPos < 1 && clearance > 1 && clearance < 320 && aircraft.vz < -1.5 * UNITS_PER_METRE && aircraft.power < 0.45;
      aircraft.gearWarning = gearWarning;
      if (aircraft.stallWarning && physicsClock - (aircraft.hornAt || -100) > 0.42) {
        aircraft.hornAt = physicsClock;
        tone(aircraft.stalled ? 880 : 760, 0.32, 0.22, 'square');
      } else if (gearWarning && physicsClock - (aircraft.hornAt || -100) > 0.9) {
        aircraft.hornAt = physicsClock;
        tone(520, 0.5, 0.16, 'square');
      }
      if (aircraft.stalled && physicsClock - (aircraft.stallToldAt || -100) > 4) {
        aircraft.stallToldAt = physicsClock;
        tell(
          'STALL · Release ' + keyName('ascend') + ', lower the nose with ' + keyName('descend') + ', add ' +
            keyName('forward') + ' throttle',
          4,
        );
      }
    }
    /* Instrument readings for the flight HUD (hud.js) and DeadEndCity.flight():
       airspeed in km/h, altitudes in metres (above sea level and above what the
       aircraft would land on), vertical speed in m/s, heading in compass degrees
       (0 = north), attitude in degrees (bank positive right wing down). */
    function flightData(c) {
      if (!isAircraft(c)) return null;
      const plane = c.type === 'plane',
        toDegrees = 180 / Math.PI;
      return {
        type: plane ? c.airframe || 'courier' : 'helicopter',
        airspeed: worldMeters(plane ? c.airspeed || 0 : Math.hypot(c.vx || 0, c.vy || 0)) * 3.6,
        altitude: worldMeters(c.altitude || 0),
        agl: worldMeters(aircraftClearance(c)),
        vs: worldMeters(c.vz || 0),
        heading: (((c.a * toDegrees + 90) % 360) + 360) % 360,
        pitch: plane ? (c.pitch || 0) * toDegrees : 0,
        bank: plane ? (c.bank || 0) * toDegrees : 0,
        throttle: plane ? c.throttle || 0 : c.rotorSpeed || 0,
        power: plane ? c.power ?? c.throttle ?? 0 : c.rotorSpeed || 0,
        flaps: plane ? FLAP_NOTCHES[c.flaps || 0] : null,
        flapPos: plane ? c.flapPos || 0 : 0,
        gear: plane ? ((c.gearPos ?? 1) >= 1 ? 'DOWN' : (c.gearPos ?? 1) <= 0 ? 'UP' : 'TRANSIT') : null,
        gearPos: plane ? c.gearPos ?? 1 : 1,
        g: plane ? c.gLoad ?? 1 : 1,
        aoa: plane ? (c.angleOfAttack || 0) * toDegrees : 0,
        stallSpeed: plane ? worldMeters(c.stallSpeed || AIRFRAME_SPECS[c.airframe || 'courier'].stall) * 3.6 : 0,
        stall: !!c.stalled,
        stallWarning: !!c.stallWarning,
        gearWarning: !!c.gearWarning,
        buffet: c.buffet || 0,
        hp: c.hp / c.maxhp,
        // On the ground on a runway: its designation this way and the metres left.
        runway: plane && aircraftClearance(c) < 2 ? runwayInfo(c) : null,
      };
    }
    function runwayInfo(c) {
      const under = runwayUnder(c.x, c.y, c.a);
      return under
        ? { name: under.runway.name, designation: under.designation, remaining: Math.round(worldMeters(under.remaining)) }
        : null;
    }
    function flightMissionStart(missionState) {
      if (missionState.index === 9) {
        for (let i = vehicles.length - 1; i >= 0; i--)
          if (vehicles[i] !== player.car && distanceBetween(vehicles[i], FLIGHT.pickup) < 100)
            vehicles.splice(i, 1);
        missionState.car =
          vehicles.find(
            (c) => c.type === 'helicopter' && c.hp > 0 && distanceBetween(c, FLIGHT.heli) < 80,
          ) || makeCar('helicopter', FLIGHT.heli.x, FLIGHT.heli.y, 0);
        repairVehicle(missionState.car);
        missionState.car.mission = true;
        missionState.car.authorized = true;
        missionState.witnessActor = {
          ...actor('DANIEL VEGA', FLIGHT.pickup.x + 75, FLIGHT.pickup.y, '#b7b690'),
          missionTag: 'flight-witness',
        };
        storyActors.push(missionState.witnessActor);
        challengeGuards(
          'glass',
          5,
          {
            x: FLIGHT.pickup.x + 150,
            y: FLIGHT.pickup.y,
          },
          'rescue',
        );
        setStage(0, missionState.car, 'BOARD ELENA’S HELICOPTER AT OCEANVIEW');
      }
      if (missionState.index === 10) {
        for (let i = vehicles.length - 1; i >= 0; i--)
          if (
            vehicles[i].type === 'plane' &&
            vehicles[i] !== player.car &&
            distanceBetween(vehicles[i], FLIGHT.plane) < 180
          )
            vehicles.splice(i, 1);
        missionState.car = makeCar('plane', FLIGHT.plane.x, FLIGHT.plane.y, 0, false, '#dfd7bd');
        missionState.car.mission = true;
        missionState.car.authorized = true;
        missionState.witness = true;
        missionState.gates = [
          {
            x: 6440,
            y: 9884,
            altitude: 200,
          },
          {
            x: 6700,
            y: 6850,
            altitude: 350,
          },
        ];
        missionState.gate = 0;
        setStage(0, missionState.car, 'DANIEL + LEDGER ABOARD · BOARD RAFE’S PLANE');
      }
    }
    function chooseFlightLanding(divert) {
      const m = mission;
      if (!m || m.index !== 10 || !m.compromised || m.stage >= 4) return;
      m.divert = divert;
      m.landingName = divert ? 'OCEANVIEW' : 'SOUTHPORT';
      m.approach = divert
        ? // Runway 27, landing westbound: in over the sea past Coral Coast.
          {
            x: 8500,
            y: 9884,
            altitude: 200,
          }
        : // Runway 36, landing northbound: in over the sea south of the pier.
          {
            x: 418,
            y: 10400,
            altitude: 200,
          };
      setStage(
        2,
        m.approach,
        divert
          ? 'DIVERT OCEANVIEW · APPROACH WESTBOUND · V SWITCH'
          : 'SOUTHPORT EXPOSED · APPROACH NORTHBOUND · V DIVERT',
      );
    }
    function beginFlightEscape(missionState) {
      const c = missionState.car;
      missionState.aircraft = c;
      // Southport: the van waits on the parallel taxiway beside the plane.
      const spot = missionState.divert
        ? {
            x: 3750,
            y: 9520,
          }
        : {
            x: 700,
            y: clamp(c.y, 4420, 7820),
          };
      missionState.car = spawnClearCar('van', spot.x, spot.y, missionState.divert ? Math.PI / 2 : -Math.PI / 2, false, '#829da1');
      missionState.car.mission = true;
      missionState.car.authorized = true;
      missionState.escapeHeat = missionState.divert ? 2 : 3;
      missionState.witnessActor = {
        ...actor('DANIEL VEGA', c.x, c.y, '#b7b690'),
        missionTag: 'flight-witness',
        hidden: true,
      };
      storyActors.push(missionState.witnessActor);
      challengeGuards(
        'glass',
        missionState.divert ? 2 : 5,
        findStreetPoint(c.x + (missionState.divert ? 210 : 170), c.y, 10),
        'manifest',
      );
      crime(missionState.escapeHeat);
      missionState.dispatchTimer = 5;
      setStage(
        4,
        missionState.car,
        'EXIT PLANE · ESCORT DANIEL TO THE MARKED ESCAPE VAN',
        'rafe',
        missionState.divert
          ? 'You avoided the airport cordon, but a lookout saw the landing. The van is north of the strip. Get Daniel to Vinny’s warehouse.'
          : 'They leaked the manifest. The terminal is covered. Fight through to the escape van and get Daniel to Vinny’s warehouse.',
      );
      announce(
        'MANIFEST COMPROMISED',
        missionState.divert ? 'LOOKOUTS ON THE STRIP' : 'SOUTHPORT AMBUSH',
        4,
      );
    }
    // One step of Daniel's walk: straight at the next crumb, or the smallest
    // turn off it that actually moves him, so he slides round a wingtip or a
    // parked car instead of pressing into it (moveBody stops at vehicles, while
    // footStepTowards' sidestep only checks buildings).
    function witnessStep(p, target, deltaSeconds, speed) {
      const a = headingBetween(p, target),
        step = speed * deltaSeconds;
      for (const turn of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3]) {
        if (personIncapacitated(p)) return;
        const x = p.x,
          y = p.y;
        moveBody(p, Math.cos(a + turn) * step, Math.sin(a + turn) * step, 8);
        if (Math.hypot(p.x - x, p.y - y) > step * 0.4) break;
      }
      p.a = a;
      p.walk += deltaSeconds * strideRate(speed);
    }
    function followWitness(missionState, deltaSeconds) {
      const p = missionState.witnessActor;
      if (!p) return;
      if (!player.car) {
        if (p.hidden) {
          Object.assign(p, {
            x: player.x,
            y: player.y,
          });
          p.hidden = false;
          missionState.witnessTrail = [];
        }
        // Daniel walks the path the player walked (breadcrumbs every 24 units),
        // so he rounds the parked plane, fences and buildings the player went
        // round. Heading straight for the player, he stuck fast against the wing
        // of the plane he had just climbed out of and the van would not board.
        const trail = missionState.witnessTrail || (missionState.witnessTrail = []),
          last = trail[trail.length - 1];
        if (!last || distanceBetween(last, player) > 24) trail.push({ x: player.x, y: player.y });
        if (trail.length > 400) trail.shift();
        // Drop every crumb up to the last one he is standing on (the player's
        // path may loop back past him).
        let reached = -1;
        for (let i = 0; i < trail.length - 1; i++) if (distanceBetween(p, trail[i]) < 16) reached = i;
        if (reached >= 0) trail.splice(0, reached + 1);
        if (distanceBetween(p, player) > 30) witnessStep(p, trail[0] || player, deltaSeconds, 26 * KMH);
      } else if (missionState.stage === 5) p.hidden = true;
    }
    function flightMissionUpdate(missionState, deltaSeconds) {
      if (missionState.witnessActor?.hp <= 0) {
        failMission('Daniel was killed. The ledger needs its witness.');
        return;
      }
      if (missionState.index === 9) {
        if (missionState.stage === 0 && player.car === missionState.car) {
          setStage(
            1,
            FLIGHT.pickup,
            'FLY TO NORTHRIDGE · LAND AT THE RESCUE PAD',
            'elena',
            'Daniel kept the original accounts. Vale’s men are holding him beside the pad. Land, get out and free him.',
          );
          tell(
            keyName('ascend') + ' climbs · ' + keyName('descend') + ' descends · ' + keyName('forward') + '/' + keyName('back') +
              ' flies · ' + keyName('left') + '/' + keyName('right') + ' turns',
            7,
          );
        } else if (
          missionState.stage === 1 &&
          distanceBetween(missionState.car, FLIGHT.pickup) < 60 &&
          missionState.car.altitude === 0 &&
          Math.abs(missionState.car.speed) < 8
        )
          setStage(2, FLIGHT.pickup, 'LAND SECURED · EXIT AND DEFEAT DANIEL’S GUARDS');
        else if (missionState.stage === 2 && cleared('rescue'))
          setStage(3, missionState.witnessActor, 'APPROACH DANIEL ON FOOT · E TO FREE HIM');
        else if (missionState.stage === 4) {
          followWitness(missionState, deltaSeconds);
          missionState.target = missionState.car;
        } else if (
          missionState.stage === 5 &&
          player.car === missionState.car &&
          distanceBetween(missionState.car, FLIGHT.heli) < 55 &&
          missionState.car.altitude === 0 &&
          Math.abs(missionState.car.speed) < 8
        )
          winMission();
      }
      if (missionState.index === 10) {
        if (missionState.stage === 0 && player.car === missionState.car) {
          setStage(
            1,
            missionState.gates[0],
            keyName('forward') + ' THROTTLE · ' + keyName('ascend') + ' ROTATE · FOLLOW THE COAST MARKERS',
            'rafe',
            'Daniel authenticates the ledger. Southport has a protected connection out, provided the clearance holds.',
          );
          tell(
            keyName('left') + '/' + keyName('right') + ' banks · ' + keyName('ascend') + ' raises nose · ' + keyName('descend') +
              ' lowers nose · ' + keyName('flapsDown') + '/' + keyName('flapsUp') + ' flaps · ' + keyName('gear') +
              ' gear · Slow + flare gently to land',
            11,
          );
        } else if (
          missionState.stage === 1 &&
          player.car === missionState.car &&
          distanceBetween(missionState.car, missionState.target) < 450 &&
          missionState.car.altitude > 65
        ) {
          missionState.gate++;
          if (missionState.gate < missionState.gates.length)
            setStage(
              1,
              missionState.gates[missionState.gate],
              'FLY NORTH ALONG THE COAST · KEEP DANIEL ABOVE THE RIDGE',
            );
          else {
            missionState.compromised = true;
            chooseFlightLanding(false);
            missionLine(
              'elena',
              'Police have our manifest. Southport is an ambush. Press V to return to Oceanview: fewer guards, but a longer drive to safety.',
            );
            announce('POLICE HAVE THE MANIFEST', 'V · CHOOSE YOUR LANDING', 5);
          }
        } else if ([2, 3].includes(missionState.stage) && player.car === missionState.car) {
          if (
            missionState.car.altitude === 0 &&
            missionState.car.landedAt === missionState.landingName &&
            Math.abs(missionState.car.speed) < 12
          )
            beginFlightEscape(missionState);
          else if (
            missionState.stage === 2 &&
            distanceBetween(missionState.car, missionState.approach) < 500
          ) {
            setStage(
              3,
              missionState.divert
                ? {
                    x: 5400,
                    y: 9884,
                  }
                : FLIGHT.arrival,
              'LAND ' + missionState.landingName + ' · GEAR DOWN (' + keyName('gear') + ') · FLAPS · REDUCE POWER · FLARE · ' +
                keyName('back') + ' BRAKES',
            );
          }
        } else if (missionState.stage === 4) {
          followWitness(missionState, deltaSeconds);
        } else if (missionState.stage === 5) {
          wantedStars = Math.max(missionState.escapeHeat, wantedStars);
          lastSeen = {
            x: player.x,
            y: player.y,
          };
          missionState.dispatchTimer -= deltaSeconds;
          if (missionState.dispatchTimer <= 0) {
            missionState.dispatchTimer = 8;
            if (vehicles.filter((c) => c.missionPursuit && c.hp > 0).length < 4)
              spawnCargoPatrol(missionState);
          }
          if (
            player.car === missionState.car &&
            truckInsideDepot(missionState.car) &&
            Math.abs(missionState.car.speed) < 15
          ) {
            clearPolice(true);
            winMission();
          }
        }
      }
    }
    function flightMissionInteract() {
      const missionState = mission;
      if (!missionState) return false;
      if (
        missionState.index === 9 &&
        missionState.stage === 3 &&
        !player.car &&
        distanceBetween(player, missionState.witnessActor) < 55
      ) {
        missionState.witness = true;
        setStage(4, missionState.car, 'ESCORT DANIEL TO THE HELICOPTER · E TO BOARD TOGETHER');
        return true;
      }
      if (
        missionState.index === 9 &&
        missionState.stage === 4 &&
        distanceBetween(player, missionState.car) < 65 &&
        distanceBetween(missionState.witnessActor, missionState.car) >= 100
      ) {
        tell('Wait for Daniel to reach the helicopter before boarding.');
        return true;
      }
      if (
        missionState.index === 9 &&
        missionState.stage === 4 &&
        distanceBetween(player, missionState.car) < 65 &&
        distanceBetween(missionState.witnessActor, missionState.car) < 100 &&
        missionState.car.altitude < 2 &&
        Math.abs(missionState.car.speed) < 8
      ) {
        player.car = missionState.car;
        player.x = missionState.car.x;
        player.y = missionState.car.y;
        missionState.witnessActor.hidden = true;
        setStage(5, FLIGHT.heli, 'DANIEL ABOARD · FLY TO OCEANVIEW AND LAND');
        return true;
      }
      if (
        missionState.index === 10 &&
        missionState.stage === 4 &&
        distanceBetween(player, missionState.car) < 65 &&
        distanceBetween(missionState.witnessActor, missionState.car) >= 110
      ) {
        tell('Keep Daniel close. Wait for him beside the van.');
        return true;
      }
      if (
        missionState.index === 10 &&
        missionState.stage === 4 &&
        distanceBetween(player, missionState.car) < 65 &&
        distanceBetween(missionState.witnessActor, missionState.car) < 110 &&
        (!player.car || player.car === missionState.car)
      ) {
        player.car = missionState.car;
        player.x = missionState.car.x;
        player.y = missionState.car.y;
        missionState.witnessActor.hidden = true;
        setStage(
          5,
          VINNY_DEPOT.inside,
          'DANIEL ABOARD · ESCAPE THE POLICE · DRIVE INSIDE VINNY’S WAREHOUSE',
        );
        for (let i = 0; i < 2; i++) spawnCargoPatrol(missionState);
        return true;
      }
      return false;
    }
    function drawPlane2D(vehicle) {
      if (!visible(vehicle, 180)) return;
      worldContext.save();
      worldContext.translate(vehicle.x, vehicle.y - vehicle.altitude * 0.3);
      worldContext.rotate(vehicle.a);
      worldContext.scale(vehicleSpec(vehicle).l / 112, vehicleSpec(vehicle).w / 100);
      worldContext.fillStyle = vehicle.hp > 0 ? vehicle.color : '#303136';
      if (vehicle.airframe === 'jet' || vehicle.airframe === 'airliner') {
        worldContext.beginPath();
        for (const [i, p] of [
          [56, 0],
          [45, -5],
          [10, -7],
          [-17, -50],
          [-28, -50],
          [-15, -7],
          [-43, -5],
          [-52, -18],
          [-56, -18],
          [-51, 0],
          [-56, 18],
          [-52, 18],
          [-43, 5],
          [-15, 7],
          [-28, 50],
          [-17, 50],
          [10, 7],
          [45, 5],
        ].entries())
          i ? worldContext.lineTo(...p) : worldContext.moveTo(...p);
        worldContext.closePath();
        worldContext.fill();
        worldContext.fillStyle = '#315469';
        worldContext.fillRect(38, -4, 9, 8);
        for (let x = -32; x < 33; x += 5) {
          worldContext.fillRect(x, -6, 2, 2);
          worldContext.fillRect(x, 4, 2, 2);
        }
        worldContext.fillStyle = '#8b9ea4';
        for (const y of [-17, 17])
          worldContext.fillRect(vehicle.airframe === 'airliner' ? -4 : -34, y - 3, 17, 6);
        worldContext.fillStyle = '#538798';
        worldContext.fillRect(-47, -2, 24, 4);
        worldContext.restore();
        return;
      }
      worldContext.beginPath();
      worldContext.moveTo(53, 0);
      worldContext.lineTo(20, -7);
      worldContext.lineTo(0, -50);
      worldContext.lineTo(-12, -50);
      worldContext.lineTo(-8, -7);
      worldContext.lineTo(-42, -4);
      worldContext.lineTo(-48, -20);
      worldContext.lineTo(-56, -20);
      worldContext.lineTo(-53, 0);
      worldContext.lineTo(-56, 20);
      worldContext.lineTo(-48, 20);
      worldContext.lineTo(-42, 4);
      worldContext.lineTo(-8, 7);
      worldContext.lineTo(-12, 50);
      worldContext.lineTo(0, 50);
      worldContext.lineTo(20, 7);
      worldContext.closePath();
      worldContext.fill();
      worldContext.fillStyle = '#305367';
      worldContext.fillRect(12, -6, 13, 12);
      worldContext.fillStyle = '#b96148';
      worldContext.fillRect(-6, -49, 5, 98);
      worldContext.strokeStyle = '#b8c8cb';
      worldContext.lineWidth = 2;
      worldContext.beginPath();
      worldContext.moveTo(51, -15);
      worldContext.lineTo(51, 15);
      worldContext.stroke();
      worldContext.restore();
    }
    function drawAviationGround(drawingContext) {
      for (const p of [FLIGHT.heli, FLIGHT.pickup]) {
        drawingContext.fillStyle = '#56656a';
        drawingContext.fillRect(p.x - 57, p.y - 57, 114, 114);
        drawingContext.strokeStyle = '#e7d5a0';
        drawingContext.lineWidth = 3;
        drawingContext.beginPath();
        drawingContext.arc(p.x, p.y, 46, 0, TAU);
        drawingContext.stroke();
        drawingContext.fillStyle = '#f0dfb3';
        drawingContext.textAlign = 'center';
        drawingContext.font = 'bold 54px Arial';
        drawingContext.fillText('H', p.x, p.y + 19);
      }
    }
    function drawAviationMap(drawingContext, scale) {
      drawingContext.save();
      drawingContext.textAlign = 'center';
      drawingContext.font = 'bold ' + 11 / scale + 'px Arial';
      for (const c of vehicles)
        if (c.type === 'plane' && c.hp > 0) {
          drawingContext.fillStyle = '#203b48';
          drawingContext.fillRect(c.x - 19 / scale, c.y - 9 / scale, 38 / scale, 17 / scale);
          drawingContext.fillStyle = '#f0dbae';
          drawingContext.fillText('PLANE', c.x, c.y + 4 / scale);
        }
      drawingContext.restore();
    }
    // END SUBSYSTEM: src/aviation.js
