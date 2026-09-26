    // BEGIN SUBSYSTEM: src/carjack.js — Carjacking and driver reactions
    /**
     * Carjacking and driver reactions
     * Source: src/carjack.js
     * Scope: shared game closure.
     * Occupied traffic, locked doors, the ejection throw and what drivers do next.
     */
    /**
     * TAKING A CAR OFF SOMEBODY
     * Traffic carries drivers. Opening the door means hauling one of them out: the
     * driver is thrown clear along the door line, lands on their back and gets up
     * dazed, and only then decides what to do. Roughly one car in three is locked;
     * the window has to go first, and how that driver answers a gunshot through
     * their glass depends on who they are. Every reaction is a normal pedestrian
     * state afterwards, so the panic, police and crowd systems all see it.
     */
    const DRIVER_COLORS = [
      '#cab392', '#879eb3', '#b57374', '#c2bd95', '#778e70', '#9689a7',
      '#d9a066', '#5f7c9c', '#c95a4a', '#e0d8c0', '#4c5a6b', '#8a5c7a',
    ];
    const DRIVER_MOODS = ['flee', 'flee', 'flee', 'flee', 'plead', 'angry', 'witness', 'defiant'];
    const CARJACK_LINES = {
      pulled: ['That’s my car!', 'Take it! Take it!', 'Please — don’t!', 'Hey! HEY!', 'My keys!'],
      plead: ['Okay, okay — it’s yours.', 'Don’t hurt me, please.', 'Just take it and go.'],
      angry: ['I know your face!', 'Come back here!', 'You’re dead, you hear me?', 'That’s my livelihood!'],
      witness: ['Blue sedan, heading south!', 'I’m calling it in right now.', 'Someone get the plate!'],
      defiant: ['Get off my car!', 'Not today, pal.', 'You picked the wrong one.'],
    };
    function driverTalk(person, kind) {
      const lines = CARJACK_LINES[kind];
      if (!lines || (person.speechUntil || 0) > gameTime) return;
      person.speech = randomChoice(lines);
      person.speechUntil = gameTime + 2.8;
      // Said to the player: first claim on a speech bubble (crowd.js speechBubbles).
      person.speechKind = 'carjack';
      person.speechKindText = person.speech;
    }
    /* Ordinary traffic has somebody behind the wheel and a door that may be locked. */
    function assignDriver(vehicle) {
      if (
        vehicle.type === 'police' ||
        vehicle.type === 'bicycle' ||
        vehicle.military ||
        isAircraft(vehicle) ||
        isBoat(vehicle)
      )
        return;
      vehicle.occupied = true;
      // Motorbikes have no doors to lock: the rider can always be pulled off.
      vehicle.locked = !vehicleSpec(vehicle).bike && seededRandom() < 0.32;
      vehicle.driverMood = randomChoice(DRIVER_MOODS);
      vehicle.driverColor = randomChoice(DRIVER_COLORS);
    }
    function vehicleIsLocked(vehicle) {
      return !!vehicle?.locked && !vehicleSpec(vehicle).bike && !vehicle.lockBroken && vehicle.hp > 0 && vehicle.occupied !== false;
    }
    function driverDoor(vehicle) {
      const spec = vehicleSpec(vehicle),
        a = vehicle.a - Math.PI / 2;
      return {
        a,
        x: vehicle.x + Math.cos(a) * (spec.w / 2 + 11),
        y: vehicle.y + Math.sin(a) * (spec.w / 2 + 11),
      };
    }
    function ejectDriver(vehicle, reason = 'hijack') {
      if (!vehicle.occupied) return null;
      vehicle.occupied = false;
      const door = driverDoor(vehicle),
        rolling = Math.hypot(vehicle.vx || 0, vehicle.vy || 0),
        throwSpeed = reason === 'hijack' ? 62 + rolling * 0.55 : 34 + rolling * 0.3;
      let x = door.x,
        y = door.y;
      if (solid(x, y, 7)) {
        const other = vehicle.a + Math.PI / 2,
          spec = vehicleSpec(vehicle);
        x = vehicle.x + Math.cos(other) * (spec.w / 2 + 11);
        y = vehicle.y + Math.sin(other) * (spec.w / 2 + 11);
        if (solid(x, y, 7)) {
          x = vehicle.x;
          y = vehicle.y;
        }
      }
      const driver = {
        x,
        y,
        a: normalizeAngle(door.a + Math.PI),
        hp: 30,
        color: vehicle.driverColor || randomChoice(DRIVER_COLORS),
        flee: 0,
        timer: 1,
        walk: 0,
        state: 'walk',
        mood: vehicle.driverMood || 'flee',
        // The throw and the landing are one knockdown, so the fall animation,
        // the daze and every collision rule already in the game apply to it.
        knockedFor: reason === 'hijack' ? 1.35 : 0.9,
        dazedFor: 0,
        impactCooldown: 0.6,
        ejected: {
          vx: Math.cos(door.a) * throwSpeed,
          vy: Math.sin(door.a) * throwSpeed,
          spin: randomBetween(-8, 8),
          time: 0,
          reason,
        },
      };
      pedestrians.push(driver);
      driverTalk(driver, reason === 'hijack' ? 'pulled' : 'plead');
      scream(driver);
      particle(x, y, '#b9b3a0', 5, 45, 2);
      return driver;
    }
    function finishEjection(person) {
      const mood = person.mood || 'flee';
      person.ejected = null;
      person.ejectRoll = 0;
      person.threat = {
        x: player.x,
        y: player.y,
      };
      if (mood === 'angry' || mood === 'defiant') {
        // Chases the car for a few seconds, shouting, before thinking better of it.
        person.angryUntil = gameTime + 6 + seededRandom() * 4;
        driverTalk(person, mood === 'angry' ? 'angry' : 'defiant');
      } else if (mood === 'witness') {
        // Calls it in. That is a real cost: the description reaches dispatch.
        person.witnessUntil = gameTime + 7;
        driverTalk(person, 'witness');
        crime(0.7);
      } else {
        person.flee = 10 + seededRandom() * 4;
        if (mood === 'plead') driverTalk(person, 'plead');
      }
    }
    /* The throw itself: applied wherever knockdowns are stepped, so it runs for
       people the ordinary pedestrian loop skips while they are on the ground. */
    function stepEjection(person, deltaSeconds) {
      const e = person.ejected;
      if (!e) return;
      // Thrown off a motorbike: a flight, a landing and a slide (riders.js).
      if (e.rider) return stepRiderEjection(person, e, deltaSeconds);
      e.time += deltaSeconds;
      moveBody(person, e.vx * deltaSeconds, e.vy * deltaSeconds, 6);
      const drag = Math.exp(-4.4 * deltaSeconds);
      e.vx *= drag;
      e.vy *= drag;
      person.ejectRoll = (person.ejectRoll || 0) + e.spin * deltaSeconds;
      if (e.time > 0.34 && Math.hypot(e.vx, e.vy) < 8) {
        e.vx = e.vy = 0;
        e.spin *= 0.6;
      }
      if (person.knockedFor <= 0 || e.time > 3) finishEjection(person);
    }
    function updateCarjackReactions(person, deltaSeconds) {
      if (person.angryUntil > gameTime) {
        const chase = player.car || player;
        person.a = headingBetween(person, chase);
        person.walking = true;
        person.sitting = false;
        person.walk += deltaSeconds * strideRate(17 * KMH);
        if (distanceBetween(person, chase) > 26)
          moveBody(
            person,
            Math.cos(person.a) * 17 * KMH * deltaSeconds,
            Math.sin(person.a) * 17 * KMH * deltaSeconds,
            5,
          );
        if (seededRandom() < deltaSeconds * 0.5) driverTalk(person, person.mood === 'defiant' ? 'defiant' : 'angry');
        return true;
      }
      if (person.witnessUntil > gameTime) {
        person.walking = false;
        person.sitting = false;
        person.a = headingBetween(person, player.car || player);
        person.onPhone = true;
        if (seededRandom() < deltaSeconds * 0.45) driverTalk(person, 'witness');
        return true;
      }
      if (person.onPhone && person.witnessUntil <= gameTime) {
        person.onPhone = false;
        person.flee = 8;
      }
      return false;
    }
    /**
     * A round through the glass. What happens next is the driver's call: most bail
     * and run, a few put their foot down and aim the car at whoever is shooting.
     */
    function breakVehicleLock(vehicle, source) {
      if (!vehicle.locked || vehicle.lockBroken) return;
      vehicle.lockBroken = true;
      particle(vehicle.x, vehicle.y, '#cfe3ea', 9, 90, 2);
      noise(0.1, 0.16, 3200);
      if (!vehicle.occupied) return;
      const ram = vehicle.driverMood === 'defiant' || vehicle.driverMood === 'angry';
      if (ram && source === player && vehicle.hp > vehicle.maxhp * 0.35) {
        vehicle.ramUntil = gameTime + 13;
        vehicle.ai = true;
        vehicle.panicUntil = 0;
        tell('THE DRIVER IS COMING AT YOU', 2.6);
        playSample('tires', 0.4, 1.1, vehicle);
        return;
      }
      const driver = ejectDriver(vehicle, 'shot');
      if (driver) {
        driver.flee = 12;
        driver.mood = driver.mood === 'witness' ? 'witness' : 'flee';
      }
      vehicle.ai = false;
      vehicle.vx = vehicle.vy = vehicle.speed = 0;
      tell('The driver bailed out. The car is yours.', 2.6);
    }
    function ramControl(vehicle) {
      // Straight at the player, with a lead so they cannot simply sidestep.
      const lead = {
        x: player.x + (player.car?.vx || 0) * 0.3,
        y: player.y + (player.car?.vy || 0) * 0.3,
      };
      const da = normalizeAngle(headingBetween(vehicle, lead) - vehicle.a);
      return {
        steer: clamp(da * 3, -2.4, 2.4),
        desired: distanceBetween(vehicle, player) < 60 ? 150 : 210,
      };
    }
    // END SUBSYSTEM: src/carjack.js
