    // BEGIN SUBSYSTEM: src/carjack.js — Carjacking and driver reactions
    /**
     * Carjacking and driver reactions
     * Source: src/carjack.js
     * Scope: shared game closure.
     * Occupied traffic, locked doors, the ejection throw and what drivers do next.
     */
    /**
     * TAKING A CAR OFF SOMEBODY
     * Traffic carries drivers (and now and then a passenger). Taking the car is a
     * short struggle at the driver's door (carjack-struggle.js); a car rolling too
     * fast for that, a bike or a cab hijacked from its window has the driver thrown
     * clear along the door line at once. Either way the driver lands, gets up dazed
     * and only then decides what to do: most shout and run, some plead, a few chase
     * or fight, one in eight goes straight for the phone; every victim is a sure
     * 911 caller once up and clear of the player (witnessReport, crowd-witnesses.js).
     * Roughly one car in three is locked; the window has to go first, and how that
     * driver answers a gunshot through their glass depends on who they are. Every
     * reaction is a normal pedestrian state afterwards, so the panic, police and
     * crowd systems all see it. Drivers are men and women, young and old, and what
     * they shout fits them (VICTIM_SHOUTS, voices.js for the scream).
     */
    const DRIVER_COLORS = [
      '#cab392', '#879eb3', '#b57374', '#c2bd95', '#778e70', '#9689a7',
      '#d9a066', '#5f7c9c', '#c95a4a', '#e0d8c0', '#4c5a6b', '#8a5c7a',
    ];
    const DRIVER_MOODS = ['flee', 'flee', 'flee', 'flee', 'plead', 'angry', 'witness', 'defiant'];
    const CARJACK_LINES = {
      pulled: ['Hey! HEY!', 'No, no, no!', 'Get off me!', 'Let go of me!', 'What are you doing?!', 'Please — don’t!'],
      plead: ['Okay, okay — it’s yours.', 'Don’t hurt me, please.', 'Just take it and go.', 'Take it! Take it!'],
      angry: ['I know your face!', 'Come back here!', 'You’re dead, you hear me?', 'That’s my livelihood!'],
      witness: ['Blue sedan, heading south!', 'I’m calling it in right now.', 'Someone get the plate!', '911? My car’s just been stolen!'],
      defiant: ['Get off my car!', 'Not today, pal.', 'You picked the wrong one.'],
    };
    const PASSENGER_LINES = ['Run! RUN!', 'Oh my God!', 'Get out, get out!', 'He’s crazy!'];
    /* What the victim shouts once back on their feet, by who they are. */
    const VICTIM_SHOUTS = {
      any: [
        'Police! Someone took my car!',
        'Hey! That’s my car!',
        'Are you out of your mind?!',
        'My laptop’s in there!',
        'Somebody stop him!',
        'Help! He took my car!',
        'I just made the last payment on that!',
      ],
      woman: ['My purse is in there!', 'Somebody call the police!', 'Get your hands off me!', 'My kids’ car seats are in there!'],
      man: ['My tools are in the trunk!', 'You’ll regret that, pal!', 'Get back here, punk!', 'That’s my ride, man!'],
      elder: ['Young man, that is my car!', 'Have you no shame?!', 'My pills are in the glovebox!', 'Forty years I’ve driven that car!'],
    };
    function driverTalk(person, kind, force = false) {
      let lines = CARJACK_LINES[kind];
      if (kind === 'victim') {
        const own = person.role === 'elder' ? VICTIM_SHOUTS.elder : personFemale(person) ? VICTIM_SHOUTS.woman : VICTIM_SHOUTS.man;
        lines = seededRandom() < 0.6 ? VICTIM_SHOUTS.any : own;
      }
      if (!lines || (!force && (person.speechUntil || 0) > gameTime)) return;
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
      const bike = !!vehicleSpec(vehicle).bike;
      vehicle.locked = !bike && seededRandom() < 0.32;
      vehicle.driverMood = randomChoice(DRIVER_MOODS);
      vehicle.driverColor = randomChoice(DRIVER_COLORS);
      // Who is driving: a man or a woman, now and then someone older.
      vehicle.driverFemale = seededRandom() < 0.44;
      vehicle.driverRole = seededRandom() < 0.12 ? 'elder' : seededRandom() < 0.4 ? 'commuter' : 'casual';
      // A passenger in about one car in five (they bail out of the far door).
      vehicle.passengers = !bike && !vehicleSpec(vehicle).truck && seededRandom() < 0.2 ? 1 : 0;
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
    /* Give a person the look of someone of this sex (after dressPerson). */
    function dressAsSex(p, female) {
      const look = p.look;
      look.female = female;
      if (female) {
        if (look.hairStyle === 0 || look.hairStyle === 1) look.hairStyle = seededRandom() < 0.5 ? 2 : 3;
      } else {
        look.skirt = false;
        if (look.hairStyle === 2 || look.hairStyle === 3) look.hairStyle = 1;
      }
    }
    /* The person behind the wheel, dressed as the car said (assignDriver), on foot at (x, y). */
    function makeCarDriver(vehicle, x, y, a) {
      const driver = {
        x,
        y,
        a,
        hp: 30,
        color: vehicle.driverColor || randomChoice(DRIVER_COLORS),
        flee: 0,
        timer: 1,
        walk: 0,
        state: 'walk',
        mood: vehicle.driverMood || 'flee',
        knockedFor: 0,
        dazedFor: 0,
        impactCooldown: 0.6,
        ejected: null,
      };
      dressPerson(driver, vehicle.driverRole || 'casual');
      driver.color = vehicle.driverColor || driver.color;
      if (vehicle.driverFemale !== undefined) dressAsSex(driver, !!vehicle.driverFemale);
      driver.carry = null;
      // A story character at the wheel (fortjob.js: Kessler) stays himself on foot.
      if (vehicle.missionDriver) driver.missionDriver = vehicle.missionDriver;
      pedestrians.push(driver);
      return driver;
    }
    /* Throw a driver clear: `speed` along heading `a` (map units a second). */
    function throwDriver(driver, a, speed, knocked, reason) {
      driver.knockedFor = knocked;
      driver.impactCooldown = 0.6;
      // The throw and the landing are one knockdown, so the fall animation,
      // the daze and every collision rule already in the game apply to it.
      driver.ejected = {
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        spin: randomBetween(-8, 8),
        time: 0,
        reason,
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
      const driver = makeCarDriver(vehicle, x, y, normalizeAngle(door.a + Math.PI));
      throwDriver(driver, door.a, throwSpeed, reason === 'hijack' ? 1.35 : 0.9, reason);
      driverTalk(driver, reason === 'hijack' ? 'pulled' : 'plead');
      scream(driver);
      particle(x, y, '#b9b3a0', 5, 45, 2);
      // The street sees it (crowd-perception.js); passengers get out and run.
      const inc = reason === 'hijack' ? crowdAlarm('carjack', driver, player, 1.2) : null;
      bailPassengers(vehicle, inc);
      return driver;
    }
    /* Passengers get out of the far door and run (crowd-perception.js startReaction). */
    function bailPassengers(vehicle, inc) {
      const count = vehicle.passengers || 0;
      vehicle.passengers = 0;
      const spec = vehicleSpec(vehicle);
      for (let i = 0; i < count; i++) {
        const side = vehicle.a + Math.PI / 2;
        let x = vehicle.x + Math.cos(side) * (spec.w / 2 + 9),
          y = vehicle.y + Math.sin(side) * (spec.w / 2 + 9);
        if (solid(x, y, 6)) {
          x = vehicle.x - Math.cos(vehicle.a) * (spec.l / 2 + 9);
          y = vehicle.y - Math.sin(vehicle.a) * (spec.l / 2 + 9);
          if (solid(x, y, 6)) continue;
        }
        const p = { x, y, a: side, hp: 30, flee: 0, timer: 1, walk: 0, state: 'walk' };
        dressPerson(p, seededRandom() < 0.2 ? 'elder' : 'casual');
        p.carry = null;
        pedestrians.push(p);
        startReaction(p, 'flee', randomBetween(6, 9), player, inc, { scream: true });
        p.speech = randomChoice(PASSENGER_LINES);
        p.speechUntil = gameTime + 2.4;
        p.speechKind = 'carjack';
        p.speechKindText = p.speech;
      }
    }
    function finishEjection(person) {
      const mood = person.mood || 'flee';
      person.ejected = null;
      person.ejectRoll = 0;
      person.threat = {
        x: player.x,
        y: player.y,
      };
      // The 911 call itself is the witness system's (witnessReport, crowd-witnesses.js):
      // it waits until they are up, done shouting and clear of the player.
      if (mood === 'angry' || mood === 'defiant') {
        // Chases the car a few steps, shouting, before thinking better of it.
        person.angryUntil = gameTime + 3 + seededRandom() * 2;
        driverTalk(person, mood === 'angry' ? 'angry' : 'defiant', true);
      } else if (mood === 'witness') {
        // Straight for the phone: no running first.
        driverTalk(person, 'witness', true);
      } else {
        person.flee = 10 + seededRandom() * 4;
        driverTalk(person, mood === 'plead' && seededRandom() < 0.4 ? 'plead' : 'victim', true);
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
      // Held at the door in the struggle: carjack-struggle.js places and poses them.
      if (person.carjackHeld) return true;
      if (person.stagger) {
        // Hauled out and let go: a few stumbling steps backwards, then away
        // (carjack-struggle.js releaseSwing). A shot or a scare takes over at once.
        const s = person.stagger;
        if (person.hp <= 0 || person.react || person.knockedFor > 0 || person.ejected) {
          person.stagger = null;
          if (person.pose === 'carjackStagger') person.pose = null;
          return false;
        }
        s.t += deltaSeconds;
        const slow = Math.max(0, 1 - s.t / s.for);
        moveBody(person, s.vx * slow * deltaSeconds, s.vy * slow * deltaSeconds, 5);
        person.a = s.face;
        person.walking = false;
        person.sitting = false;
        person.carjackT = s.t;
        if (s.t >= s.for) {
          person.stagger = null;
          person.pose = null;
          finishEjection(person);
        }
        return true;
      }
      if (person.handsUpUntil > gameTime) {
        // Frozen with the hands up, watching whoever took the car.
        person.pose = 'handsUp';
        person.walking = false;
        person.a = headingBetween(person, player.car || player);
        return true;
      }
      if (person.handsUpUntil) {
        person.handsUpUntil = 0;
        person.pose = null;
        person.flee = Math.max(person.flee || 0, 9);
      }
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
