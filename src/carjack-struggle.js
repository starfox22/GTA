    // The carjack struggle: walking round to the driver's door, the door, a short tug of
    // war, the throw and taking the seat (startCarjack, updateCarjack, skipCarjack, cancelCarjack).
    /**
     * THE STRUGGLE AT THE DOOR
     * E at an occupied car that is (nearly) stopped starts `player.carjack`: the
     * player walks (round the front or the back if need be) to the driver's door,
     * yanks it open (the hijack's crime(0.8, 'carjack') happens here, the street
     * sees it: crowdAlarm 'carjack', and any passenger bails out of the far door;
     * the driver becomes a sure 911 caller, witnessReport), grabs the
     * driver and hauls: a tug of war of a third of a second to about one second by
     * the driver's temper (CARJACK.tug) with the driver clinging to the wheel, arms
     * flailing, a defiant one landing a punch, then throws them out and behind; a
     * pleading one just climbs out with their hands up. The player takes the seat
     * through the usual enterVehicle (its crime for taking traffic unchanged) about a
     * second or two after pressing E. Moving off during the walk calls it off; E
     * again cuts the struggle short. The driver is an ordinary pedestrian from the
     * moment the door opens (`carjackHeld` while held, carjack.js reactions after).
     * The renderer draws the door (carjack3d.js), the poses and the hands on the
     * driver from `player.carjack` and the driver's `pose`.
     */
    const CARJACK = {
      maxSpeed: 14 * KMH, // rolling faster: yanked out at once (carjack.js ejectDriver)
      walk: 46, // the walk to the door, map units a second (a brisk jog)
      approachMax: 1.1,
      door: 0.22,
      tug: { flee: 0.55, witness: 0.6, plead: 0.32, angry: 0.85, defiant: 0.95 },
      throwFor: 0.36,
      swingFor: 0.22, // swung round the player this long, through CARJACK.swing radians, then let go
      swing: 2.0,
      throwSpeed: 58,
      rhythm: 3.1, // heaves a second in the tug of war (carjack3d.js poses in time)
    };
    // The last victim, for the console (carjackState).
    const carjackLast = { driver: null, inc: null, passengers: 0, instant: null };
    /* Car-local point (along the car, out of the driver's side) to the map. */
    function carjackLocal(c, along, out, into) {
      const ca = Math.cos(c.a),
        sa = Math.sin(c.a);
      // The driver's side is a - 90 degrees: (sin a, -cos a).
      into.x = c.x + ca * along + sa * out;
      into.y = c.y + sa * along - ca * out;
      return into;
    }
    function carjackSpots(job) {
      const c = job.car,
        spec = vehicleSpec(c);
      job.doorA = c.a - Math.PI / 2;
      carjackLocal(c, 0, spec.w / 2 + 7, job.stand);
      carjackLocal(c, spec.l * 0.03, spec.w / 2 + 3, job.seat);
    }
    /* The way to the door: round the nearer end of the car when it is in the way. */
    function carjackPath(job) {
      const c = job.car,
        spec = vehicleSpec(c),
        dx = player.x - c.x,
        dy = player.y - c.y,
        along = dx * Math.cos(c.a) + dy * Math.sin(c.a),
        out = dx * Math.sin(c.a) - dy * Math.cos(c.a),
        L2 = spec.l / 2,
        W2 = spec.w / 2,
        end = along >= 0 ? 1 : -1,
        path = [];
      if (out < W2 + 2) {
        if (Math.abs(along) < L2 + 4) path.push(carjackLocal(c, end * (L2 + 7), clamp(out, -W2 - 7, W2 + 7), {}));
        path.push(carjackLocal(c, end * (L2 + 7), W2 + 7.5, {}));
      }
      path.push(job.stand);
      return path;
    }
    function carjackRoomAt(c, x, y) {
      if (solid(x, y, 6)) return false;
      for (const o of vehicles) if (o !== c && Math.abs(o.x - x) < 90 && Math.abs(o.y - y) < 90 && pointInCar(x, y, o, 4)) return false;
      return true;
    }
    /* E at an occupied car. Returns true when the car is being (or has been) taken. */
    function startCarjack(c) {
      if (player.carjack) return true;
      const job = {
        car: c,
        phase: 'approach',
        t: 0,
        mood: c.driverMood || 'flee',
        stand: { x: 0, y: 0 },
        seat: { x: 0, y: 0 },
        doorA: 0,
        path: null,
        leg: 0,
        approachFor: 0,
        tugFor: 0,
        driver: null,
        swingFrom: 0,
        swingR: 4,
        inc: null,
        punched: false,
        wasAi: !!c.ai,
      };
      carjackSpots(job);
      job.path = carjackPath(job);
      const why =
        !c.occupied || c.hp <= 0 || vehicleSpec(c).bike || isAircraft(c) || isBoat(c) || player.roof || player.buildingRoof
          ? 'kind'
          : Math.hypot(c.vx || 0, c.vy || 0) >= CARJACK.maxSpeed
            ? 'rolling'
            : job.path.every((q) => carjackRoomAt(c, q.x, q.y))
              ? null
              : 'no room';
      carjackLast.instant = why;
      if (why) {
        // No room at the door or rolling too fast: yanked out at once, as before.
        carjackLast.passengers = c.passengers || 0;
        const driver = ejectDriver(c, 'hijack');
        carjackLast.driver = driver;
        crime(0.8, 'carjack');
        // Once back on their feet and clear of the player they phone it in.
        carjackLast.inc = witnessReport(driver, 'carjack', c.x, c.y);
        enterVehicle(c);
        return true;
      }
      let walk = 0,
        from = player;
      for (const q of job.path) {
        walk += distanceBetween(from, q);
        from = q;
      }
      job.approachFor = clamp(walk / CARJACK.walk, 0.08, CARJACK.approachMax);
      job.tugFor = CARJACK.tug[job.mood] ?? 0.55;
      // The driver's foot comes off the pedal: the car stops on its brakes.
      c.ai = false;
      c.aiControl = null;
      player.carjack = job;
      return true;
    }
    function carjackPhase(job, phase) {
      const c = job.car;
      job.phase = phase;
      job.t = 0;
      if (phase === 'door') {
        // Yanked open: the crime, and a fight the street can see.
        c.doorSwing = { openAt: gameTime, closeAt: 0 };
        crime(0.8, 'carjack');
        job.inc = crowdAlarm('carjack', { x: job.seat.x, y: job.seat.y }, player, 1.2);
        carjackLast.passengers = c.passengers || 0;
        bailPassengers(c, job.inc);
        noise(0.05, 0.12, 2600);
      } else if (phase === 'tug') {
        const d = makeCarDriver(c, job.seat.x, job.seat.y, job.doorA);
        carjackLast.driver = d;
        c.occupied = false;
        d.carjackHeld = job;
        // A sure 911 caller once up and clear of the player (crowd-witnesses.js).
        carjackLast.inc = witnessReport(d, 'carjack', c.x, c.y) || job.inc;
        d.pose = job.mood === 'plead' ? 'handsUp' : 'carjackCling';
        job.driver = d;
        driverTalk(d, job.mood === 'plead' ? 'plead' : 'pulled', true);
        if (job.mood !== 'plead') scream(d);
      } else if (phase === 'throw') {
        const d = job.driver;
        if (d && job.mood === 'plead') {
          // Climbs out and freezes, hands up, then runs (carjack.js reactions).
          d.carjackHeld = null;
          d.pose = null;
          moveBody(d, Math.cos(job.doorA - 0.6) * 7, Math.sin(job.doorA - 0.6) * 7, 5);
          d.handsUpUntil = gameTime + 1.4;
          d.threat = { x: player.x, y: player.y };
        } else if (d) {
          // Swung round the player, out of the door and away from the car.
          job.swingFrom = headingBetween(player, d);
          job.swingR = clamp(distanceBetween(player, d), 3.5, 5);
        }
      }
    }
    /* The end of the swing: let go, the driver flying on along it. */
    function releaseSwing(job, angle) {
      const d = job.driver;
      d.carjackHeld = null;
      d.pose = null;
      throwDriver(d, angle + Math.PI / 2 - 0.6, CARJACK.throwSpeed, 1.1, 'hijack');
      scream(d);
      particle(d.x, d.y, '#b9b3a0', 4, 40, 2);
    }
    /* Per frame, before on-foot movement (game-update.js); true while it holds the player. */
    function updateCarjack(deltaSeconds) {
      const job = player.carjack;
      if (!job) return false;
      const c = job.car;
      if (player.hp <= 0 || player.car || player.thrown || player.tumble || player.swimming || c.hp <= 0 || gameMode !== 'play') {
        cancelCarjack();
        return false;
      }
      job.t += deltaSeconds;
      carjackSpots(job);
      const out = job.doorA,
        ox = Math.cos(out),
        oy = Math.sin(out);
      if (job.phase === 'approach') {
        // Walking off calls it off.
        if (playerMoveHeading() !== null && job.t > 0.12) {
          cancelCarjack();
          return false;
        }
        const target = job.path[job.leg],
          remaining = Math.max(0.001, job.approachFor - job.t),
          d = distanceBetween(player, target);
        // The pace that reaches the door on time over what is left of the way.
        let ahead = d;
        for (let i = job.leg + 1; i < job.path.length; i++) ahead += distanceBetween(job.path[i - 1], job.path[i]);
        const step = Math.min(d, Math.max(CARJACK.walk * 0.6, ahead / remaining) * deltaSeconds);
        if (d > 0.01) {
          const a = headingBetween(player, target);
          player.x += Math.cos(a) * step;
          player.y += Math.sin(a) * step;
          player.a = a;
        }
        if (distanceBetween(player, target) < 0.5) {
          if (job.leg < job.path.length - 1) job.leg++;
          else {
            player.a = normalizeAngle(out + Math.PI);
            carjackPhase(job, 'door');
          }
        } else if (job.t > job.approachFor + 0.8) cancelCarjack();
        return true;
      }
      // At the door, facing the car.
      player.a = normalizeAngle(out + Math.PI);
      if (job.phase === 'door') {
        player.x = job.stand.x;
        player.y = job.stand.y;
        if (job.t >= CARJACK.door) carjackPhase(job, 'tug');
        return true;
      }
      if (job.phase === 'tug') {
        const d = job.driver,
          k = clamp(job.t / job.tugFor, 0, 1),
          // Both bodies rock together, a little further out with every heave.
          rock = job.mood === 'plead' ? 0 : Math.sin(job.t * TAU * CARJACK.rhythm) * 0.8 * (1 - 0.4 * k),
          pulled = 2.2 * k * k;
        player.x = job.stand.x + ox * (rock * 0.6 + pulled * 0.5);
        player.y = job.stand.y + oy * (rock * 0.6 + pulled * 0.5);
        if (d) {
          d.x = job.seat.x + ox * (rock + pulled);
          d.y = job.seat.y + oy * (rock + pulled);
          d.a = out;
          d.carjackT = job.t;
          // A defiant driver lands one punch before letting go.
          if (job.mood === 'defiant' && !job.punched && k > 0.45) {
            job.punched = true;
            d.punchAt = gameTime;
            hurt(2.5, 'impact');
            noise(0.07, 0.22, 420);
            shake = Math.max(shake, 2.5);
          }
          if (d.hp <= 0) {
            // Killed in the struggle (a stray round): let go of the body.
            d.carjackHeld = null;
            d.pose = null;
            job.driver = null;
            carjackPhase(job, 'throw');
            return true;
          }
        }
        if (job.t >= job.tugFor) carjackPhase(job, 'throw');
        return true;
      }
      if (job.phase === 'throw') {
        // The swing: the driver goes round the player toward the back of the car
        // (the door is open ahead) and is let go moving out and away.
        const d = job.driver,
          k = clamp(job.t / CARJACK.swingFor, 0, 1);
        if (d?.carjackHeld) {
          const angle = job.swingFrom + CARJACK.swing * k * k * (3 - 2 * k);
          d.x = job.stand.x + Math.cos(angle) * job.swingR;
          d.y = job.stand.y + Math.sin(angle) * job.swingR;
          d.a = angle + Math.PI;
          d.carjackT += deltaSeconds;
          if (k >= 1 || d.hp <= 0) releaseSwing(job, angle);
        }
        // Then a step in toward the seat.
        const s = clamp((job.t - CARJACK.swingFor * 0.7) / (CARJACK.throwFor - CARJACK.swingFor * 0.7), 0, 1),
          e = s * s * (3 - 2 * s);
        player.x = job.stand.x - ox * 4 * e;
        player.y = job.stand.y - oy * 4 * e;
        if (job.t >= CARJACK.throwFor) finishCarjack(job);
        return true;
      }
      return true;
    }
    function finishCarjack(job) {
      const c = job.car;
      if (job.driver?.carjackHeld) releaseSwing(job, headingBetween(player, job.driver));
      player.carjack = null;
      if (c.doorSwing) c.doorSwing.closeAt = gameTime + 0.12;
      // enterVehicle charges for taking traffic as it always has (c.ai).
      c.ai = job.wasAi;
      enterVehicle(c);
    }
    /* E again during the struggle: straight to the throw, or into the seat. */
    function skipCarjack() {
      const job = player.carjack;
      if (!job) return false;
      if (job.phase === 'door' || job.phase === 'tug') {
        if (job.phase === 'door') carjackPhase(job, 'tug');
        carjackPhase(job, 'throw');
      } else if (job.phase === 'throw' && !job.driver?.carjackHeld) finishCarjack(job);
      return true;
    }
    /* Let go of it all (walked off, hurt, a teleport, death or a reset). */
    function cancelCarjack() {
      const job = player.carjack;
      if (!job) return;
      player.carjack = null;
      const c = job.car,
        d = job.driver;
      if (c.doorSwing && !c.doorSwing.closeAt) c.doorSwing.closeAt = gameTime;
      if (d?.carjackHeld) {
        // Let go mid-struggle: they stumble free and run.
        d.carjackHeld = null;
        d.pose = null;
        throwDriver(d, job.doorA, 24, 0.5, 'hijack');
      }
      // Still at the wheel: they drive on; pulled out: the car is left standing.
      if (c.occupied) c.ai = job.wasAi;
    }
    /* Console (DeadEndCity.carjack, carjackTest): the running struggle and the last victim. */
    function carjackState() {
      const job = player.carjack,
        v = carjackLast.driver,
        victim = v && {
          female: personFemale(v),
          role: v.role,
          mood: v.mood,
          pose: v.pose || (v.ejected ? 'thrown' : v.handsUpUntil > gameTime ? 'handsUp' : v.onPhone ? 'phone' : null),
          down: (v.knockedFor || 0) > 0,
          speech: v.speechUntil > gameTime ? v.speech : '',
          reported: !!carjackLast.inc?.reported,
          calling: !!v.onPhone,
          d: Math.round(distanceBetween(v, player)),
        };
      if (!job) return { running: false, inCar: player.car?.type || null, victim, passengers: carjackLast.passengers, instant: carjackLast.instant };
      return {
        running: true,
        victim,
        passengers: carjackLast.passengers,
        phase: job.phase,
        t: +job.t.toFixed(2),
        mood: job.mood,
        tugFor: job.tugFor,
        approachFor: +job.approachFor.toFixed(2),
        waypoints: job.path.length,
        car: job.car.type,
        driver: job.driver ? { x: Math.round(job.driver.x), y: Math.round(job.driver.y), pose: job.driver.pose, female: personFemale(job.driver) } : null,
        player: { x: Math.round(player.x), y: Math.round(player.y) },
      };
    }
