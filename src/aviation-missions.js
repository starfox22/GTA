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
