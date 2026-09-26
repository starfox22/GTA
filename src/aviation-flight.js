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
      // The Mountain Rescue helipad at the Northridge ranger station
      // (mountain-village.js). It used to be a lone pad by the Ridgeline
      // Highway west of town, with a helicopter parked on it.
      pickup: {
        x: 8570,
        y: 3462,
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
