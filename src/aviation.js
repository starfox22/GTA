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
    const AIRFIELDS = [
      {
        name: 'OCEANVIEW',
        x: 3600,
        y: 9800,
        w: 2480,
        h: 168,
        a: 0,
      },
      {
        name: 'SOUTHPORT',
        ...AIRPORT.runway,
        a: Math.PI / 2,
      },
    ];
    const FLIGHT = {
      plane: {
        x: 3800,
        y: 9884,
        a: 0,
      },
      heli: {
        x: 3690,
        y: 8830,
      },
      pickup: {
        x: 8130,
        y: 2740,
      },
      arrival: {
        x: 418,
        y: 4670,
      },
      approach: {
        x: 418,
        y: 5520,
        altitude: 80,
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
    // Assisted light-aircraft model. Speeds/forces are converted from metres to world units.
    // Pitch sets angle of attack; lift acts normal to the flight path and banks into a turn.
    const AIRFRAME_SPECS = {
      courier: {
        name: 'SERRANO C200 COURIER',
        l: 112,
        w: 100,
        hp: 250,
        flightMass: 1450,
        wing: 14,
        thrust: 95,
        roll: 2.7,
        bank: 1,
        stall: 140,
        rotate: 165,
        assist: 0.55,
      },
      jet: {
        name: 'AURELIA J8 PRIVATE JET',
        l: 150,
        w: 118,
        height: 47,
        hp: 320,
        mass: 5.2,
        flightMass: 2400,
        wing: 22,
        thrust: 112,
        roll: 2.35,
        bank: 0.92,
        stall: 155,
        rotate: 183,
        assist: 0.46,
      },
      airliner: {
        name: 'MERIDIAN 220 AIRLINER',
        l: 214,
        w: 148,
        height: 60,
        hp: 520,
        mass: 14,
        flightMass: 4300,
        wing: 35,
        thrust: 108,
        roll: 1.55,
        bank: 0.78,
        stall: 170,
        rotate: 205,
        assist: 0.32,
      },
    };
    function populateAircraft() {
      for (const [airframe, x, y, a] of [
        ['jet', 5530, 9500, 0],
        ['airliner', 4880, 9520, 0],
        ['jet', 690, 5390, -Math.PI / 2],
      ]) {
        const vehicle = makeCar('plane', x, y, a, false, airframe === 'jet' ? '#e1e4db' : '#d0dfde');
        vehicle.airframe = airframe;
        vehicle.hp = vehicle.maxhp = vehicleSpec(vehicle).hp;
        vehicle.authorized = true;
      }
    }
    const PLANE_FLIGHT = {
      gravity: 9.81 / METERS_PER_UNIT,
      mass: 1450,
      wing: 14,
      stallAngle: 0.27,
      ceilingStart: 2000,
      ceiling: 2400,
    };
    function planeTouchdown(c, sink) {
      const runway = runwayAt(c),
        dry = corners(vehicleShape(c)).every((p) => landAt(p.x, p.y));
      const aligned = runway && Math.abs(Math.sin(c.a - runway.a)) < 0.22;
      const unsafe =
        Math.max(0, sink - 13) * 3 +
        Math.max(0, Math.abs(c.bank) - 0.18) * 180 +
        Math.max(0, Math.abs(c.pitch) - 0.23) * 180;
      let damage = unsafe + (aligned ? 0 : dry ? 35 + Math.max(0, c.airspeed - 160) * 0.35 : c.maxhp);
      if (!aircraftClear(c)) damage += 90;
      if (damage > 0) damageVehicle(c, damage, c.x, c.y);
      c.altitude = terrainHeight(c.x, c.y);
      c.vz = 0;
      c.landedAt = aligned ? runway.name : null;
      c.throttle = Math.min(c.throttle, 0.2);
      c.bank = 0;
      c.pitch = 0;
      c.stalled = false;
      if (c === player.car)
        tell(
          !dry
            ? 'DITCHING · Aircraft lost'
            : damage > 20
              ? 'HARD LANDING · Aircraft damaged'
              : 'TOUCHDOWN · Hold S to brake',
          4,
        );
    }
    function planeControl(aircraft, stepSeconds, active) {
      const controlled = aircraft === player.car && active,
        up = controlled && (keys.KeyW || keys.ArrowUp),
        down = controlled && (keys.KeyS || keys.ArrowDown),
        turn = controlled
          ? (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
          : 0;
      const pull = controlled && keys.Space,
        push = controlled && (keys.ShiftLeft || keys.ShiftRight),
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
      if (aircraft.hp <= 0) {
        aircraft.throttle = 0;
        if (aircraft.altitude > 0) {
          aircraft.vz -= flightModel.gravity * stepSeconds;
          aircraft.altitude = Math.max(0, aircraft.altitude + aircraft.vz * stepSeconds);
        }
        aircraft.vx *= Math.exp(-stepSeconds * 0.3);
        aircraft.vy *= Math.exp(-stepSeconds * 0.3);
        return;
      }
      const horizontalSpeed = Math.hypot(aircraft.vx, aircraft.vy),
        speed = Math.hypot(horizontalSpeed, aircraft.vz),
        airborne = aircraft.altitude > terrainHeight(aircraft.x, aircraft.y) + 1e-7,
        flightPathAngle = Math.atan2(aircraft.vz, Math.max(1, horizontalSpeed));
      const q = 0.5 * 1.225 * Math.pow(speed * METERS_PER_UNIT, 2),
        liftScale = (q * flightModel.wing) / flightModel.mass / METERS_PER_UNIT;
      const authority = clamp(horizontalSpeed / 190, 0.08, 1),
        trim = clamp(
          (flightModel.gravity / Math.max(1, liftScale) / Math.max(0.5, Math.cos(aircraft.bank)) -
            0.22) /
            4.6 -
            0.04,
          -0.085,
          0.16,
        );
      let pitchTarget = airborne
        ? clamp(trim + (pull ? 0.21 : push ? -0.16 : 0), -0.24, 0.39)
        : pull
          ? 0.11
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
      aircraft.pitch +=
        (pitchTarget - aircraft.pitch) * (1 - Math.exp(-stepSeconds * 1.65 * authority));
      aircraft.bank +=
        ((airborne
          ? turn * airframeProfile.bank * (0.65 + 0.35 * clamp((horizontalSpeed - 170) / 90, 0, 1))
          : 0) -
          aircraft.bank) *
        (1 - Math.exp(-stepSeconds * airframeProfile.roll * authority));
      const angleOfAttack = aircraft.pitch - flightPathAngle + 0.04,
        stallAngleExcess = Math.max(0, Math.abs(angleOfAttack) - flightModel.stallAngle);
      aircraft.stalled =
        airborne && (stallAngleExcess > 0.015 || horizontalSpeed < airframeProfile.stall);
      aircraft.angleOfAttack = angleOfAttack;
      const attached = clamp(0.22 + angleOfAttack * 4.6, -1.1, 1.46),
        liftCoefficient =
          attached * (stallAngleExcess > 0 ? Math.max(0.18, Math.exp(-stallAngleExcess * 9)) : 1);
      const lift = liftScale * liftCoefficient,
        drag =
          liftScale * (0.3 + 0.068 * liftCoefficient * liftCoefficient + stallAngleExcess * 0.85) +
          (airborne ? 0 : 5);
      const thrust =
          aircraft.throttle * airframeProfile.thrust * clamp(aircraft.hp / aircraft.maxhp, 0.3, 1),
        pathA = horizontalSpeed > 1 ? Math.atan2(aircraft.vy, aircraft.vx) : aircraft.a;
      // Lift rotates the velocity vector; the fuselage follows its slip angle instead of snapping velocity.
      if (airborne) {
        const yawRate = clamp(
            ((lift * Math.sin(aircraft.bank)) / Math.max(50, horizontalSpeed)) *
              (1 +
                airframeProfile.assist *
                  clamp((horizontalSpeed - airframeProfile.stall) / 70, 0, 1) *
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
          flightPathAngle + (normalAccel / Math.max(60, speed)) * stepSeconds,
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
        along = Math.max(0, along + (thrust - drag - (down ? 95 : 0)) * stepSeconds);
        aircraft.av +=
          ((turn * 0.5 * clamp(along / 60, 0, 1)) / (1 + along / 120) - aircraft.av) *
          (1 - Math.exp(-stepSeconds * 4));
        aircraft.a = normalizeAngle(aircraft.a + aircraft.av * stepSeconds);
        aircraft.vx = Math.cos(aircraft.a) * along;
        aircraft.vy = Math.sin(aircraft.a) * along;
        aircraft.vz = 0;
        if (lift > flightModel.gravity * 1.02 && pull && along > airframeProfile.rotate) {
          aircraft.vz = 2;
          aircraft.altitude = terrainHeight(aircraft.x, aircraft.y) + 0.1;
          aircraft.landedAt = null;
        }
        if (!landAt(aircraft.x, aircraft.y)) {
          damageVehicle(aircraft, aircraft.maxhp, aircraft.x, aircraft.y);
          aircraft.throttle = 0;
        }
      }
      aircraft.airspeed = Math.hypot(aircraft.vx, aircraft.vy, aircraft.vz);
      aircraft.speed = aircraft.vx * Math.cos(aircraft.a) + aircraft.vy * Math.sin(aircraft.a);
      if (controlled && aircraft.stalled && physicsClock - (aircraft.stallWarning || -100) > 4) {
        aircraft.stallWarning = physicsClock;
        tell('STALL · Release Space, lower nose with Shift, add W throttle', 4);
      }
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
          if (vehicles[i].type === 'plane' && distanceBetween(vehicles[i], FLIGHT.plane) < 180)
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
        ? {
            x: 2750,
            y: 9884,
            altitude: 120,
          }
        : {
            x: 418,
            y: 6000,
            altitude: 120,
          };
      setStage(
        2,
        m.approach,
        divert
          ? 'DIVERT OCEANVIEW · APPROACH EASTBOUND · V SWITCH'
          : 'SOUTHPORT EXPOSED · APPROACH NORTHBOUND · V DIVERT',
      );
    }
    function beginFlightEscape(missionState) {
      const c = missionState.car;
      missionState.aircraft = c;
      const spot = missionState.divert
        ? {
            x: 3750,
            y: 9520,
          }
        : {
            x: 1180,
            y: 5005,
          };
      missionState.car = spawnClearCar('van', spot.x, spot.y, Math.PI / 2, false, '#829da1');
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
        }
        if (distanceBetween(p, player) > 30) footStepTowards(p, player, deltaSeconds, 118);
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
          tell('Space climbs · Shift descends · W/S flies · A/D turns', 7);
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
            'W THROTTLE · SPACE ROTATE · FOLLOW THE COAST MARKERS',
            'rafe',
            'Daniel authenticates the ledger. Southport has a protected connection out, provided the clearance holds.',
          );
          tell(
            'A/D banks · Space raises nose · Shift lowers nose · Release pitch to trim · Slow + flare gently to land',
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
                    x: 5100,
                    y: 9884,
                  }
                : FLIGHT.arrival,
              'LAND ' + missionState.landingName + ' · REDUCE POWER · LEVEL WINGS · FLARE · S BRAKES',
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
