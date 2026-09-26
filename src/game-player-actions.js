    function district() {
      return districtAt(player.x, player.y);
    }
    function particle(x, y, color, n = 8, speed = 100, size = 3) {
      for (let i = 0; i < n; i++) {
        let a = randomBetween(0, TAU),
          v = randomBetween(speed * 0.2, speed);
        particles.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: randomBetween(0.25, 0.8),
          max: 0.8,
          color,
          size: randomBetween(1, size),
        });
      }
    }
    function explode(x, y, power = 1, source = 'player', altitude = terrainHeight(x, y)) {
      const blast = {
          x,
          y,
          altitude,
        },
        distance = (e) => Math.hypot(e.x - x, e.y - y, entityElevation(e) - altitude),
        attacker = source === 'player' ? player : typeof source === 'object' ? source : null,
        proximity = clamp(1 - distance(player) / 800, 0, 1);
      notifyViolence(blast, 'explosion', attacker);
      playSample('explosion', 0.9, 0.9 + Math.random() * 0.12, blast);
      if (city3D) city3D.explosion(x, y, power, altitude);
      shake = Math.max(shake, 11 * power * proximity);
      flash = Math.max(flash, 0.15 * proximity);
      fires.push({
        x,
        y,
        altitude,
        power,
        life: 13 + power * 5,
        max: 13 + power * 5,
        emit: 0,
      });
      if (fires.length > 24) fires.shift();
      particle(x, y, '#e0b769', 40, 180, 9);
      particle(x, y, '#6c7165', 22, 110, 16);
      debris.push({
        x,
        y,
        altitude,
        life: 45,
      });
      for (const c of vehicles)
        if (c.hp > 0 && distance(c) < 95 * power && clearSight(blast, c))
          damageVehicle(c, Math.max(0, 200 * power - distance(c) * 1.6), x, y, attacker, {
            kind: 'blast',
            x,
            y,
            power,
            falloff: 1 - distance(c) / (95 * power),
          });
      // The shock wave shoves and spins cars, blows out glass, flattens street
      // furniture and scorches the nearest facades (damage.js).
      blastEffects(x, y, altitude, power);
      for (const e of [
        ...pedestrians,
        ...enemies,
        ...gangMembers,
        ...officers,
        ...sportsTargets(),
        ...storyActors.filter(
          (p) => p.missionTag === 'flight-witness' && !p.hidden && mission?.stage >= 4,
        ),
      ])
        if (e.hp > 0 && distance(e) < 85 * power && clearSight(blast, e)) {
          strikePerson(e, 200, headingBetween(blast, e), attacker, true, 'blast');
        }
      for (const animal of wildlife)
        if (animal.hp > 0 && distance(animal) < 85 * power && clearSight(blast, animal))
          strikeWildlife(animal, Math.max(0, 200 * power - distance(animal) * 1.6));
      const pd = distance(player);
      if (pd < 95 * power && clearSight(blast, player))
        hurt(Math.max(0, (95 * power - pd) * 0.75), 'blast');
      if (attacker === player) crime(0.5);
    }
    function hurt(d, kind = 'ballistic') {
      // At GOALLINE's counter (sportsbook.js) nobody lays a finger on you.
      if (player.inv > 0 || gameMode !== 'play' || player.godMode || sportsbookShelters()) return;
      d = ballisticDamage(player, d, kind);
      player.hp -= d;
      if (d > 1 && !player.car) bleed(player, d / 35, player.a + Math.PI);
      flash = 0.12;
      if (player.hp <= 0) die();
    }
    function die() {
      if (transitRide) leaveTransit(transitRide.from, true);
      if (taxiRide) endTaxiRide(false);
      player.deck = null;
      if (player.coaster) {
        player.coaster = null;
        coasterTrain.running = false;
        coasterTrain.t = 0;
      }
      player.tumble = null;
      player.tumbleRoll = 0;
      player.thrown = null;
      if (player.roof || player.buildingRoof) {
        player.roof = false;
        player.buildingRoof = null;
        player.altitude = 0;
      }
      player.parachute = null;
      if (gameMode !== 'play') return;
      gameMode = 'dead';
      player.hp = 0;
      if (player.car) {
        player.car.ai = false;
        player.car.speed = 0;
        if (player.car.vx !== undefined) player.car.vx = player.car.vy = 0;
        player.car.av = 0;
        // A pilot who dies at the controls leaves the aircraft to fall, not hover.
        if (isAircraft(player.car)) player.car.abandonedFlight = true;
        player.car = null;
      }
      announce('THE CITY ALWAYS COLLECTS', 'WASTED', 4.6);
      document.body?.classList.add('wasted');
      noise(0.3, 0.4);
      setTimeout(() => {
        document.body?.classList.remove('wasted');
        if (gameMode !== 'dead') return;
        cash = Math.max(0, cash - 250);
        player.hp = 100;
        player.armor = 0;
        player.inv = 3;
        player.x = PLACES.find((p) => p.kind === 'hospital').door.x;
        player.y = PLACES.find((p) => p.kind === 'hospital').door.y;
        clearPolice();
        resetOfficerCrews();
        gameMode = 'play';
        if (mission) failMission('Hospital bill: $250. Your job is ready to retry.');
        else tell('Back on your feet. Hospital bill: $250.', 4);
        save();
      }, 4200);
    }
    /* The ringing payphone's reach, shared by its prompt and E (hysteresis). */
    function payphoneInReach() {
      return withinRange('payphone', distanceBetween(player, phone), 68, 84);
    }
    function nearestCar() {
      if (player.parachute) return null;
      let best = null,
        bd = 64;
      for (const vehicle of vehicles) {
        if (player.roof) return null;
        const d = distanceBetween(vehicle, player);
        // A helicopter parked on a roof is reached from that roof, not the street.
        if (isAircraft(vehicle) && Math.abs(entityElevation(vehicle) - entityElevation(player)) > 30) continue;
        if (vehicle.hp > 0 && aircraftClearance(vehicle) < 2 && d < bd) {
          best = vehicle;
          bd = d;
        }
      }
      return best;
    }
    function exitCar() {
      const vehicle = player.car;
      if (!vehicle) return;
      if (
        isAircraft(vehicle) &&
        (aircraftClearance(vehicle) > 1 || Math.hypot(vehicle.vx || 0, vehicle.vy || 0) > 12)
      ) {
        tell('Land and stop to exit, or press J to bail out with a parachute.');
        return;
      }
      // Parked on a roof: out onto the roof beside it (rooftops.js).
      if (vehicle.roofSite && isAircraft(vehicle)) {
        if (!exitOntoRoof(vehicle, vehicle.roofSite)) {
          tell('No room to get out on this roof.');
          return;
        }
        vehicle.vx = vehicle.vy = vehicle.speed = 0;
        player.car = null;
        player.inv = 0.5;
        tell('ROOFTOP · E at the helicopter to fly on', 2.5);
        tone(160, 0.06, 0.15, 'triangle');
        return;
      }
      let found = false;
      const vehicleDefinition = vehicleSpec(vehicle),
        candidates = isBoat(vehicle)
          ? [36, 48, 60, 72].flatMap((r) =>
              [Math.PI / 2, -Math.PI / 2, Math.PI, 0].map((a) => ({
                a: vehicle.a + a,
                r,
              })),
            )
          : [0, 14, 28].flatMap((extra) =>
              [Math.PI / 2, -Math.PI / 2, Math.PI, 0].map((a) => ({
                a: vehicle.a + a,
                r:
                  (Math.abs(Math.sin(a)) > 0.5 ? vehicleDefinition.w : vehicleDefinition.l) / 2 +
                  18 +
                  extra,
              })),
            );
      for (const { a, r } of candidates) {
        const x = vehicle.x + Math.cos(a) * r,
          y = vehicle.y + Math.sin(a) * r,
          floor = terrainHeight(x, y);
        if (
          !solid(x, y, 8) &&
          !vehicles.some((o) => Math.abs(entityElevation(o) - floor) < 20 && pointInCar(x, y, o, 9))
        ) {
          player.x = x;
          player.y = y;
          player.altitude = floor;
          found = true;
          break;
        }
      }
      if (!found && vehicle.hp <= 0) {
        // A wreck must never trap its driver: climb out onto the nearest clear ground.
        for (let r = 24; r < 1200 && !found; r += 32)
          for (let i = 0; i < 16 && !found; i++) {
            const x = vehicle.x + Math.cos((i * TAU) / 16) * r,
              y = vehicle.y + Math.sin((i * TAU) / 16) * r;
            if (!solid(x, y, 8) && !vehicles.some((o) => pointInCar(x, y, o, 9))) {
              player.x = x;
              player.y = y;
              player.altitude = terrainHeight(x, y);
              found = true;
            }
          }
      }
      // Out of a flooding car there is only the water (water.js).
      if (!found && vehicle.sinkFor > 0) found = exitIntoWater(vehicle);
      if (!found) {
        tell(
          isBoat(vehicle)
            ? 'Pull alongside a wooden dock to step off, or press J to dive in.'
            : 'No room to get out. Move away from the wall.',
        );
        return;
      }
      vehicle.ai = false;
      // Physics derives `speed` from vx/vy each step, so the rolling velocity must be cut too.
      vehicle.speed *= 0.45;
      if (vehicle.vx !== undefined) {
        vehicle.vx *= 0.45;
        vehicle.vy *= 0.45;
      }
      player.car = null;
      player.inv = 0.5;
      tell('On foot · ' + keyName('fire') + ' to fire · hold ' + keyName('walk') + ' to walk', 1.8);
      tone(160, 0.06, 0.15, 'triangle');
    }
    function interact() {
      if (gameMode !== 'play' || player.parachute || player.thrown || rideSkipActive()) return;
      // On a building roof the only thing to do is fly off again.
      if (player.buildingRoof && !player.car) {
        const c = nearestCar();
        if (c) enterVehicle(c);
        else tell('ROOFTOP · The helicopter is the only way down.', 2.5);
        return;
      }
      if (policeBlocksMissionDelivery()) return;
      if (transitInteract()) return;
      if (parkInteract()) return;
      if (beachClubInteract()) return;
      // The Marea pool, club conversations and beach volleyball (leisure.js).
      if (leisureInteract()) return;
      if (marinaInteract()) return;
      if (taxiInteract()) return;
      if (
        rooftopMissionInteract() ||
        challengeMissionInteract() ||
        militaryInteract() ||
        harborInteract() ||
        interactRooftop()
      )
        return;
      // The hill climb at the 4x4 club's sign, from a vehicle (offroad.js).
      if (offroadClubInteract()) return;
      // MONARCH MOTORS: a car on display, the concierge, ending a test drive (dealership.js).
      if (dealershipInteract()) return;
      if (player.car) {
        if (garageInteract()) return;
        // Riding a share bike into a station docks it (cycles.js BIKE SHARE).
        if (bikeShareInteract()) return;
        exitCar();
        return;
      }
      // On the stadium pitch E kicks the ball at your feet (sports.js).
      if (sportsInteract()) return;
      // PLACE A BET inside GOALLINE by the stadium (sportsbook.js).
      if (sportsbookInteract()) return;
      // A Monarch Isle payphone (monarch-life.js).
      if (monarchInteract()) return;
      const place = nearestPlace();
      if (place) {
        openService(place);
        return;
      }
      if (payphoneInReach() && !mission && storyCallWaiting()) {
        offerMission();
        return;
      }
      // RENT BIKE at a South Coast Cycle station (cycles.js BIKE SHARE).
      if (bikeShareInteract()) return;
      const c = nearestCar();
      if (c) {
        if (vehicleIsLocked(c)) {
          tell('LOCKED', 1.8);
          tone(140, 0.07, 0.2, 'square');
          return;
        }
        if (c.occupied) {
          ejectDriver(c, 'hijack');
          crime(0.8);
        }
        enterVehicle(c);
        return;
      }
      if (GARAGES.some((s) => distanceBetween(player, s) < 140))
        tell('Drive up to the door and press E: respray from $200, repairs by the damage.');
    }
    /* Taking the wheel: shared by the action key, the cab hijack and the getaway
       cars missions hand you, so every entry sets the same state. */
    function enterVehicle(c) {
        player.buildingRoof = null;
        player.car = c;
        // A bike that went down is picked up and ridden on (riders.js).
        c.fallen = null;
        c.ramUntil = 0;
        enforceVehicleHandgun();
        c.abandonedFlight = false;
        if (c.type === 'police' || c.military) c.stolen = true;
        c.gangTarget = null;
        player.x = c.x;
        player.y = c.y;
        player.a = c.a;
        if (c.ai || c.type === 'police') crime(c.type === 'police' ? 1.25 : 0.65);
        c.ai = false;
        c.cop = false;
        c.junction = null;
        c.navAngle = undefined;
        if (c.type === 'plane') {
          tell(
            'AIRPLANE · ' + keyName('forward') + '/' + keyName('back') + ' throttle · ' + keyName('left') + '/' + keyName('right') +
              ' bank · ' + keyName('ascend') + ' nose up · ' + keyName('descend') + ' nose down',
            8,
          );
        } else if (c.type === 'helicopter') {
          if (!c.authorized) crime(2);
          tell(
            'HELICOPTER · ' + keyName('ascend') + ' rise · ' + keyName('descend') + ' descend · ' + keyName('forward') + '/' +
              keyName('back') + ' fly · ' + keyName('left') + '/' + keyName('right') + ' turn',
            7,
          );
          radio('call-backup');
          // Fort Sentinel's attack helicopter: theft of military hardware (apache.js).
          if (isApache(c)) apacheBoarded(c);
        } else if (c.type === 'tank') {
          // Taking one of Fort Sentinel's tanks raises the base; a pursuit tank
          // taken off the army is a crime of its own.
          if (c.military) militaryAlarm();
          else if (c.lawUnit) crime(2);
          tell(
            'TRACKED ARMOR · ' + keyName('forward') + '/' + keyName('back') + ' drive · ' + keyName('left') + '/' + keyName('right') +
              ' pivot · the mouse lays the turret · ' + keyName('fire') + ' fire · ' + keyName('cycleWeapon') + ' main gun / MG · right click MG',
            7,
          );
        } else if (isBoat(c))
          tell(
            keyName('forward') + '/' + keyName('back') + ' throttle · ' + keyName('left') + '/' + keyName('right') + ' steer · ' +
              keyName('handbrake') + ' slow · ' + keyName('interact') + ' exit alongside a dock',
            5,
          );
        else if (c.type === 'bicycle')
          tell(
            'CITY CYCLE · HOLD ' + keyName('forward') + ' to pedal · ' + keyName('sprint') + ' stand on the pedals · ' +
              keyName('back') + ' brake',
            6,
          );
        else
          tell(
            vehicleSpec(c).name + ' · ' + keyName('forward') + ' accelerate · ' + keyName('left') + '/' + keyName('right') +
              ' steer · ' + keyName('handbrake') + ' handbrake',
            3,
          );
        tone(200, 0.12, 0.25, 'triangle');
    }
    function roofClearanceText(c) {
      const roof = roofHeightNear(c.x, c.y),
        clearance = c.altitude - roof;
      if (roof < 12) return Math.round(worldMeters(c.altitude - terrainHeight(c.x, c.y))) + ' m AGL';
      if (clearance < 0) return 'BELOW ROOFTOPS';
      return Math.round(worldMeters(clearance)) + ' m OVER ROOFS';
    }
    function startReload() {
      const w = currentWeapon();
      if (
        w.melee ||
        !weaponIsEquipped(selectedWeaponIndex) ||
        reloadSecondsRemaining ||
        w.ammo === w.clip ||
        w.reserve <= 0
      )
        return;
      reloadSecondsRemaining = w.load;
      reloadSound();
    }
    function aim() {
      if (touchAim !== null) return touchAim;
      if (mouse.active && city3D) return city3D.aim(mouse.x, mouse.y);
      let a = player.car ? player.car.a : player.a;
      if (mouse.active) {
        a = Math.atan2(
          mouse.y - ((player.y - cameraTarget.y) * canvasScale + viewportHeight / 2),
          mouse.x - ((player.x - cameraTarget.x) * canvasScale + viewportWidth / 2),
        );
      } else {
        let best = 0.8;
        for (const target of [
          ...enemies,
          ...gangMembers,
          ...officers,
          ...vehicles.filter((c) => c.cop),
        ]) {
          if (target.hp <= 0 || combatDistance(target, player) > 370 || !clearSight(player, target))
            continue;
          const ta = headingBetween(player, target),
            diff = Math.abs(normalizeAngle(ta - a));
          if (diff < best) {
            best = diff;
            a = ta;
          }
        }
      }
      return a;
    }
    function shoot() {
      if (player.parachute || transitRide) return;
      enforceVehicleHandgun();
      if (gameMode === 'play' && isApache(player.car)) {
        // The Apache's chin gun, laid by the mouse (apache.js).
        if (player.car.hp > 0) apacheGun(player.car);
        return;
      }
      if (gameMode === 'play' && player.car?.type === 'tank') {
        // The gun fires where the turret is laid, not where the mouse is (armor.js).
        tankPlayerFire(player.car);
        return;
      }
      if (
        shotCooldownSeconds > 0 ||
        reloadSecondsRemaining > 0 ||
        gameMode !== 'play' ||
        player.swimming ||
        (player.roof && !rooftopJob()) ||
        !weaponIsEquipped(selectedWeaponIndex)
      )
        return;
      // Empty-handed at the wheel: fire draws the pistol.
      if (player.car && player.car.type !== 'tank' && selectedWeaponIndex === FISTS_INDEX && weapons[0]?.owned) selectWeapon(0);
      if (player.car && player.car.type !== 'tank' && selectedWeaponIndex !== 0) {
        tell('Carry the 9mm pistol to fire from a vehicle.');
        shotCooldownSeconds = 0.5;
        return;
      }
      const w = currentWeapon();
      if (w.melee) {
        meleeAttack();
        return;
      }
      if (w.ammo <= 0) {
        if (w.reserve > 0) startReload();
        else {
          tell('Empty. Find a purple ammo crate or switch weapon.');
          shotCooldownSeconds = 0.5;
          tone(100, 0.03, 0.06);
        }
        return;
      }
      if (player.roof) rooftopShot();
      let a = aim();
      const shotTarget = playerShotTarget(a);
      if (shotTarget) a = headingBetween(player, shotTarget);
      let muzzle = player.car ? 30 : 14;
      w.ammo--;
      shotCooldownSeconds = w.rate;
      const ox = player.x + Math.cos(a) * muzzle,
        oy = player.y + Math.sin(a) * muzzle;
      for (let j = 0; j < (w.pellets || 1); j++) {
        let ba = a + randomBetween(-w.spread, w.spread);
        bullets.push({
          x: ox,
          y: oy,
          altitude: entityElevation(player),
          ...shotVelocity(
            {
              x: ox,
              y: oy,
              altitude: entityElevation(player),
            },
            shotTarget,
            w.speed,
            ba,
          ),
          life: w.rocket ? 1.8 : selectedWeaponIndex === 5 ? 1 : 0.6,
          dmg: w.dmg,
          rocket: w.rocket,
          enemy: false,
          headshotTarget: selectedWeaponIndex === 5 && shotTarget && !shotTarget.type ? shotTarget : null,
        });
      }
      particle(ox, oy, '#f4d990', 5, 70, 4);
      weaponSound(selectedWeaponIndex, ox, oy);
      if (city3D) city3D.fire(ox, oy, a, w.rocket, entityElevation(player));
      player.recoilUntil = gameTime + 0.12;
      player.lastShotAt = gameTime;
      notifyViolence(player, 'gunfire', player);
      crime(w.rocket ? 0.4 : 0.075);
      shake = Math.max(shake, w.rocket ? 5 : 1.4);
      if (!w.ammo && w.reserve) startReload();
    }
