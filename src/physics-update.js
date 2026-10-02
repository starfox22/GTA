    // updateCars(): per-frame vehicle update driving the fixed steps.
    // The pedestrian contact test of one vehicle (updateCars): a function of its own that reads the vehicle
    // under test from these, where a closure per vehicle per frame was garbage.
    let touchVehicle = null,
      touchSpeed = 0,
      touchReach = 0,
      touchContacts = null;
    function touchPerson(p) {
      const vehicle = touchVehicle;
      if (
        p.hp > 0 &&
        !p.hidden &&
        Math.abs(p.x - vehicle.x) < touchReach &&
        Math.abs(p.y - vehicle.y) < touchReach &&
        sameFloor(vehicle, p) &&
        distanceBetween(vehicle, p) < touchReach &&
        sweptPersonContact(p, vehicle, vehicle.personSweepStart)
      ) {
        if (vehicle.pedestrianContacts?.has(p) || knockPerson(p, vehicle, touchSpeed)) touchContacts.add(p);
      }
    }
    function updateCars(deltaSeconds, active) {
      bloodTrackCandidates.length = 0;
      for (let i = 0; i < bloodPools.length; i++) {
        const b = bloodPools[i];
        // Tyres pick blood up from a pool, not from spatter and drops (blood.js).
        if (!b.track && b.variant < BLOOD_SPATTER && b.r >= 2.5 && gameTime - b.created < 180) bloodTrackCandidates.push(b);
      }
      // Where each vehicle starts the frame (swept contacts with people), kept in place.
      for (const vehicle of vehicles) {
        const start = vehicle.personSweepStart || (vehicle.personSweepStart = { x: 0, y: 0, a: 0 });
        start.x = vehicle.x;
        start.y = vehicle.y;
        start.a = vehicle.a;
      }
      physicsAccumulator = Math.min(physicsAccumulator + deltaSeconds, 0.1);
      while (physicsAccumulator >= 1 / 120) {
        physicsStep(1 / 120, active);
        physicsAccumulator -= 1 / 120;
      }
      for (const vehicle of vehicles) {
        if (vehicle.hp <= 0 && !vehicle.deadTime) {
          vehicle.deadTime = gameTime || 0.001;
          vehicle.ai = false;
          vehicle.cop = false;
          vehicle.sprite = null;
          // Only a wreck the player caused recently is theirs: a car they scraped
          // a minute ago that burns out later is not a crime.
          const byPlayer = vehicle.lastAttacker === player && gameTime - (vehicle.lastDamagedAt ?? -100) < 30;
          if (byPlayer && vehicle !== player.car) recordVehicleKill(vehicle);
          if (!vehicleSpec(vehicle).bicycle)
            explode(
              vehicle.x,
              vehicle.y,
              0.65,
              vehicle.lastAttacker === player && !byPlayer ? 'world' : vehicle.lastAttacker || 'world',
              entityElevation(vehicle),
            );
          if (vehicle === player.car) {
            // Riding a vehicle when it detonates is fatal: the blast happens in the cabin.
            // Any lingering exit/landing invulnerability is cleared first so the hit lands,
            // and the clear happens after exitCar(), which grants its own half second.
            if (isAircraft(vehicle) && aircraftClearance(vehicle) > 2) {
              player.car = null;
            } else {
              exitCar();
              player.car = null;
            }
            player.inv = 0;
            shake = Math.max(shake, 16);
            flash = Math.max(flash, 0.5);
            hurt(1000, 'blast');
          }
        }
        if (
          vehicle === player.car &&
          vehicle.hp > 0 &&
          vehicle.hp < vehicle.maxhp * 0.26 &&
          !vehicleSpec(vehicle).bicycle &&
          gameTime - (vehicle.bailWarnedAt || -100) > 6
        ) {
          vehicle.bailWarnedAt = gameTime;
          tell('ENGINE ON FIRE · BAIL OUT (' + keyName('interact') + ') BEFORE IT GOES UP', 3.5);
          tone(520, 0.14, 0.2, 'square', 240);
        }
        updateBloodTracks(vehicle, active);
        if (
          !active ||
          isBoat(vehicle) ||
          vehicle.hp <= 0 ||
          (isAircraft(vehicle) && aircraftClearance(vehicle) > 3) ||
          distanceBetween(vehicle, player) > 800
        )
          continue;
        const speed = hypot2(vehicle.vx || 0, vehicle.vy || 0);
        // Standing still (under 0.1 km/h) with nobody pressed against it: knockPerson() turns away
        // anything slower at once, so no person near this car can be knocked or kept in contact.
        // Most vehicles near the player are parked, and each used to test every person near it
        // (the crowd's cells and the four armed lists) every frame.
        if (worldMeters(speed) * 3.6 < 0.1 && !(vehicle.pedestrianContacts && vehicle.pedestrianContacts.size)) continue;
        // Two contact sets per vehicle, swapped each frame: last frame's is read
        // while this frame's is filled.
        const contacts = vehicle.spareContacts || new Set(),
          reach = vehicleSpec(vehicle).l + 100;
        contacts.clear();
        touchVehicle = vehicle;
        touchSpeed = speed;
        touchReach = reach;
        touchContacts = contacts;
        // Some 650 pedestrians: ask the crowd's neighbour grid for the ones near
        // this car instead of testing all of them for every car near the player.
        // The swept test reaches back to where the car was a frame ago, so the
        // query grows by the distance it covered.
        const swept = hypot2(vehicle.x - vehicle.personSweepStart.x, vehicle.y - vehicle.personSweepStart.y);
        forEachPedestrianNear(vehicle.x, vehicle.y, reach + swept, touchPerson);
        for (let i = 0; i < enemies.length; i++) touchPerson(enemies[i]);
        for (let i = 0; i < gangMembers.length; i++) touchPerson(gangMembers[i]);
        for (let i = 0; i < officers.length; i++) touchPerson(officers[i]);
        const athletes = sportsTargets();
        for (let i = 0; i < athletes.length; i++) touchPerson(athletes[i]);
        touchVehicle = touchContacts = null;
        vehicle.spareContacts = vehicle.pedestrianContacts || null;
        vehicle.pedestrianContacts = contacts;
        if (
          speed >= 40 &&
          !player.parachute &&
          !player.car &&
          !playerOnRoof() &&
          sameFloor(vehicle, player) &&
          pointInCar(player.x, player.y, vehicle, 6)
        ) {
          const a = Math.atan2(vehicle.vy, vehicle.vx);
          hurt(speed * 0.15, 'impact');
          player.inv = 1;
          moveBody(player, Math.cos(a) * 25, Math.sin(a) * 25, 8);
        }
      }
      if (impactContacts.size > 300)
        for (const [k, v] of impactContacts) if (physicsClock - v.time > 2) impactContacts.delete(k);
    }
