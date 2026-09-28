    // The carjack struggle: walking round to the driver's door, the door, reaching in, a tug
    // of war, hauling the driver out and taking the seat (startCarjack, updateCarjack, skipCarjack, cancelCarjack).
    /**
     * THE STRUGGLE AT THE DOOR
     * E at an occupied car starts `player.carjack`, phase by phase:
     *  - approach: the player jogs to the driver's door, round the free end of the
     *    car if they stand on the far side (the way is kept in car-local points, so
     *    it follows a car still braking to a stop);
     *  - door: a hand to the handle, the door hauled open on its hinge (the hijack's
     *    crime(0.8, 'carjack') happens here, the street sees it: crowdAlarm
     *    'carjack', and any passenger bails out of the far door);
     *  - reach: leaning in, both hands to the driver's collar; the driver is an
     *    ordinary pedestrian from here (`carjackHeld` while held) and a sure 911
     *    caller (witnessReport);
     *  - tug: a tug of war of about one to two seconds by the driver's temper
     *    (CARJACK.tug), both bodies rocking in uneven heaves, the driver gripping the
     *    wheel; an angry one shoves the player back, a defiant one lands a punch; a
     *    pleading one climbs out with the hands up instead;
     *  - pull: hauled out by the collar and swung clear, then let go: an angry or
     *    defiant driver is thrown to the ground, anyone else staggers away backwards
     *    and runs (carjack.js reactions);
     *  - enter: a step to the open door, the usual enterVehicle (its crime for taking
     *    traffic unchanged; the renderer ducks the player in) and the door pulled shut.
     * About three to four seconds from E to the seat. A car still rolling faster than
     * CARJACK.maxSpeed, or a door with no room to reach, gets the same phases cut
     * short (`job.quick`, CARJACK.quick): the player grabs the door as the driver
     * brakes. Only a boat, an aircraft or a bike is still pushed off at once
     * (carjack.js ejectDriver). Moving off during the walk calls it off; E again cuts
     * the struggle short. The renderer draws the door (carjack3d.js), the poses and
     * the hands on the driver from `player.carjack` and the driver's `pose`.
     */
    const CARJACK = {
      maxSpeed: 24 * KMH, // rolling faster: the short version (quick)
      brake: 0.9 * GRAVITY, // the driver's foot on the brake once the player has hold
      walk: 46, // the walk to the door, map units a second (a brisk jog)
      approachMax: 1.3,
      door: 0.46,
      doorOpensAt: 0.16, // the hand on the handle first, then the door swings
      reach: 0.34,
      tug: { flee: 1.05, witness: 1.15, plead: 0.7, angry: 1.55, defiant: 1.8 },
      pull: 0.62,
      swingFor: 0.44, // swung round the player this long, through CARJACK.swing radians, then let go
      swing: 1.9,
      enter: 0.26,
      throwSpeed: 58,
      rhythm: 1.55, // heaves a second in the tug of war (carjack3d.js poses in time)
      // The short version: a snap to the door, and every phase quicker.
      quick: { approach: 0.24, door: 0.24, doorOpensAt: 0.06, reach: 0.14, tug: 0.34, pull: 0.44, swingFor: 0.3, enter: 0.18 },
      stand: 7, // the stand, map units out from the driver's side
      tight: 4.5, // squeezed in beside a car in the next lane
    };
    // The last victim, for the console (carjackState): `phases` the run of the last struggle.
    const carjackLast = { driver: null, inc: null, passengers: 0, instant: null, quick: null, cancelled: null, phases: [] };
    /* Car-local point (along the car, out of the driver's side) to the map. */
    function carjackLocal(c, along, out, into) {
      const ca = Math.cos(c.a),
        sa = Math.sin(c.a);
      // The driver's side is a - 90 degrees: (sin a, -cos a).
      into.x = c.x + ca * along + sa * out;
      into.y = c.y + sa * along - ca * out;
      return into;
    }
    /* A phase's length: the full struggle, or the short one. */
    function carjackFor(job, phase) {
      if (job.quick) return CARJACK.quick[phase];
      if (phase === 'tug') return job.tugFor;
      return CARJACK[phase];
    }
    function carjackSpots(job) {
      const c = job.car,
        spec = vehicleSpec(c);
      job.doorA = c.a - Math.PI / 2;
      carjackLocal(c, -spec.l * 0.03, spec.w / 2 + job.standOut, job.stand);
      // The driver's seat, under the roof's edge, and the doorway they are hauled through.
      carjackLocal(c, spec.l * 0.03, spec.w / 2 - 2.5, job.seat);
      carjackLocal(c, spec.l * 0.03, spec.w / 2 + 3.5, job.doorway);
      // Where enterVehicle's duck into the seat starts (crowd3d-frame.js drawEnterCar).
      carjackLocal(c, spec.l * 0.08, spec.w / 2 + 1.5, job.sill);
    }
    function carjackRoomAt(c, x, y, margin = 4) {
      if (solid(x, y, 6)) return false;
      for (const o of vehicles) if (o !== c && Math.abs(o.x - x) < 90 && Math.abs(o.y - y) < 90 && pointInCar(x, y, o, margin)) return false;
      return true;
    }
    /* The way to the door in car-local points ({ along, out }), round the free end of
       the car when it is in the way; null when neither end has room to pass (with
       `anyway`, round the nearer end whatever is there). */
    function carjackPath(job, from = player, anyway = false) {
      const c = job.car,
        spec = vehicleSpec(c),
        dx = from.x - c.x,
        dy = from.y - c.y,
        along = dx * Math.cos(c.a) + dy * Math.sin(c.a),
        out = dx * Math.sin(c.a) - dy * Math.cos(c.a),
        L2 = spec.l / 2,
        W2 = spec.w / 2,
        stand = { along: -spec.l * 0.03, out: W2 + job.standOut },
        room = (q) => {
          const p = carjackLocal(c, q.along, q.out, {});
          return carjackRoomAt(c, p.x, p.y, 2.5);
        },
        // Every few units along a leg of the way (the corner points alone would miss a
        // parked car across the gap between them).
        clear = (a, b) => {
          const n = Math.ceil(Math.hypot(b.along - a.along, b.out - a.out) / 4);
          for (let i = 1; i <= n; i++)
            if (!room({ along: a.along + ((b.along - a.along) * i) / n, out: a.out + ((b.out - a.out) * i) / n })) return false;
          return true;
        };
      if (out >= W2 + 2) return [stand];
      const near = along >= 0 ? 1 : -1;
      // The nearer end first, then the far one; a tight gap is squeezed through.
      for (const end of [near, -near])
        for (const gap of [7, 5, 3.5]) {
          const path = [];
          if (Math.abs(along) < L2 + 4 || end !== near) path.push({ along: end * (L2 + gap), out: clamp(out, -W2 - 7, W2 + 7) });
          path.push({ along: end * (L2 + gap), out: W2 + 7.5 }, stand);
          if (anyway || path.slice(0, -1).every((q, i) => clear(i ? path[i - 1] : { along, out }, q))) return path;
        }
      return null;
    }
    /* The struggle a car would get (no side effects): { job, why } with `why` null for
       a struggle, 'kind' for a vehicle with no door to pull anyone out of (pushed off
       at once); `job.quick` says why it is the short version ('rolling', 'no room'). */
    function planCarjack(c, from = player) {
      const job = {
        car: c,
        phase: 'approach',
        t: 0,
        mood: c.driverMood || 'flee',
        stand: { x: 0, y: 0 },
        seat: { x: 0, y: 0 },
        doorway: { x: 0, y: 0 },
        sill: { x: 0, y: 0 },
        lean: 0,
        standOut: CARJACK.stand,
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
        shoveAt: -10,
        quick: null,
        wasAi: !!c.ai,
      };
      const spec = vehicleSpec(c);
      if (!c.occupied || c.hp <= 0 || spec.bike || isAircraft(c) || isBoat(c) || player.roof || player.buildingRoof) return { job, why: 'kind' };
      // No room to stand at the door (a car in the next lane): squeezed in closer.
      const wide = carjackLocal(c, -spec.l * 0.03, spec.w / 2 + CARJACK.stand, {});
      if (!carjackRoomAt(c, wide.x, wide.y)) job.standOut = CARJACK.tight;
      carjackSpots(job);
      job.path = carjackPath(job, from);
      if (Math.hypot(c.vx || 0, c.vy || 0) >= CARJACK.maxSpeed) job.quick = 'rolling';
      else if (!job.path || !carjackRoomAt(c, job.stand.x, job.stand.y, 1.5)) job.quick = 'no room';
      // Grabbed in passing or hemmed in: a dash to the door, round the nearer end if
      // need be, whatever is in the way.
      if (job.quick) job.path = carjackPath(job, from, true);
      return { job, why: null };
    }
    /* E at an occupied car. Returns true when the car is being (or has been) taken. */
    function startCarjack(c) {
      if (player.carjack) return true;
      const { job, why } = planCarjack(c);
      carjackLast.instant = why;
      carjackLast.quick = job.quick;
      carjackLast.cancelled = null;
      carjackLast.phases = ['approach'];
      if (why) {
        // A boat, an aircraft or a bike: pushed off at once, as before.
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
        const p = carjackLocal(c, q.along, q.out, {});
        walk += distanceBetween(from, p);
        from = p;
      }
      job.approachFor = job.quick ? clamp(walk / (CARJACK.walk * 2.4), CARJACK.quick.approach, 0.7) : clamp(walk / CARJACK.walk, 0.12, CARJACK.approachMax);
      job.tugFor = CARJACK.tug[job.mood] ?? 1.05;
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
      carjackLast.phases.push(phase);
      if (phase === 'door') {
        // Yanked open: the crime, and a fight the street can see.
        c.doorSwing = { openAt: gameTime + carjackFor(job, 'doorOpensAt'), closeAt: 0 };
        crime(0.8, 'carjack');
        job.inc = crowdAlarm('carjack', { x: job.seat.x, y: job.seat.y }, player, 1.2);
        carjackLast.passengers = c.passengers || 0;
        bailPassengers(c, job.inc);
        noise(0.05, 0.12, 2600);
      } else if (phase === 'reach') {
        // Hands on the driver, still in the seat.
        const d = makeCarDriver(c, job.seat.x, job.seat.y, job.doorA);
        carjackLast.driver = d;
        c.occupied = false;
        d.carjackHeld = job;
        d.carjackT = 0;
        d.carjackPull = 0;
        // A sure 911 caller once up and clear of the player (crowd-witnesses.js).
        carjackLast.inc = witnessReport(d, 'carjack', c.x, c.y) || job.inc;
        d.pose = job.mood === 'plead' ? 'handsUp' : 'carjackCling';
        job.driver = d;
        driverTalk(d, job.mood === 'plead' ? 'plead' : 'pulled', true);
        if (job.mood !== 'plead') scream(d);
      } else if (phase === 'pull') {
        const d = job.driver;
        if (d && job.mood === 'plead') {
          // Climbs out and freezes, hands up, then runs (carjack.js reactions).
          d.carjackHeld = null;
          d.pose = null;
          d.x = job.doorway.x;
          d.y = job.doorway.y;
          moveBody(d, Math.cos(job.doorA - 0.6) * 7, Math.sin(job.doorA - 0.6) * 7, 5);
          d.handsUpUntil = gameTime + 1.4;
          d.threat = { x: player.x, y: player.y };
        } else if (d) {
          // Hauled out by the collar, swung round the player and away from the car.
          job.swingFrom = headingBetween(player, d);
          job.swingR = clamp(distanceBetween(player, d), 3.5, 5);
          d.pose = 'carjackHauled';
          d.carjackT = 0;
          scream(d);
          kickCamera(job.doorA, 1.2);
        }
      }
    }
    /* The end of the swing: let go. An angry or defiant driver goes down hard, anyone
       else staggers away backwards and runs (carjack.js updateCarjackReactions). */
    function releaseSwing(job, angle) {
      const d = job.driver;
      d.carjackHeld = null;
      d.pose = null;
      const away = angle + Math.PI / 2 - 0.6;
      if (job.mood === 'angry' || job.mood === 'defiant' || d.hp <= 0) {
        throwDriver(d, away, CARJACK.throwSpeed, 1.1, 'hijack');
        particle(d.x, d.y, '#b9b3a0', 4, 40, 2);
      } else {
        d.stagger = { vx: Math.cos(away) * 34, vy: Math.sin(away) * 34, t: 0, for: 0.85, face: normalizeAngle(away + Math.PI) };
        d.pose = 'carjackStagger';
        d.carjackT = 0;
      }
      scream(d);
    }
    /* The driver brakes once the player has hold (a car pulled up at a light is
       already stopped). */
    function carjackBrake(c, deltaSeconds) {
      const v = Math.hypot(c.vx || 0, c.vy || 0);
      if (v < 0.01) return;
      const k = Math.max(0, v - CARJACK.brake * deltaSeconds) / v;
      c.vx *= k;
      c.vy *= k;
      if (c.speed != null) c.speed *= k;
    }
    /* Per frame, before on-foot movement (game-update.js); true while it holds the player. */
    function updateCarjack(deltaSeconds) {
      const job = player.carjack;
      if (!job) return false;
      const c = job.car;
      if (player.hp <= 0 || player.car || player.thrown || player.tumble || player.swimming || c.hp <= 0 || gameMode !== 'play') {
        cancelCarjack(player.hp <= 0 ? 'dead' : player.car ? 'car' : player.thrown ? 'thrown' : player.tumble ? 'tumble' : player.swimming ? 'swim' : c.hp <= 0 ? 'wreck' : gameMode);
        return false;
      }
      job.t += deltaSeconds;
      carjackBrake(c, deltaSeconds);
      carjackSpots(job);
      const out = job.doorA,
        ox = Math.cos(out),
        oy = Math.sin(out),
        k = clamp(job.t / Math.max(carjackFor(job, job.phase) || 0, 1e-3), 0, 1);
      if (job.phase === 'approach') {
        // Walking off calls it off.
        if (playerMoveHeading() !== null && job.t > 0.12) {
          cancelCarjack('walked off');
          return false;
        }
        const leg = job.path[job.leg],
          target = carjackLocal(c, leg.along, leg.out, {}),
          remaining = Math.max(0.001, job.approachFor - job.t),
          d = distanceBetween(player, target);
        // The pace that reaches the door on time over what is left of the way.
        let ahead = d,
          prev = target;
        for (let i = job.leg + 1; i < job.path.length; i++) {
          const q = carjackLocal(c, job.path[i].along, job.path[i].out, {});
          ahead += distanceBetween(prev, q);
          prev = q;
        }
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
        } else if (job.t > job.approachFor + 0.8) cancelCarjack('late');
        return true;
      }
      // At the door, facing the car.
      player.a = normalizeAngle(out + Math.PI);
      if (job.phase === 'door') {
        // Hand on the handle, then a step back as the door swings out past the hip.
        const opening = clamp((job.t - carjackFor(job, 'doorOpensAt')) / 0.22, 0, 1),
          back = Math.sin(opening * Math.PI) * 1.4;
        player.x = job.stand.x + ox * back;
        player.y = job.stand.y + oy * back;
        if (k >= 1) carjackPhase(job, 'reach');
        return true;
      }
      if (job.phase === 'reach') {
        // Leaning into the cabin, the hands going to the collar.
        const e = k * k * (3 - 2 * k);
        job.lean = -2.4 * e;
        player.x = job.stand.x + ox * job.lean;
        player.y = job.stand.y + oy * job.lean;
        const d = job.driver;
        if (d) {
          d.x = job.seat.x;
          d.y = job.seat.y;
          d.a = out;
          d.carjackT += deltaSeconds;
        }
        if (k >= 1) carjackPhase(job, 'tug');
        return true;
      }
      if (job.phase === 'tug') {
        const d = job.driver,
          T = job.t * TAU * CARJACK.rhythm,
          // Uneven heaves, both bodies rocking together, a little further out with each.
          rock = job.mood === 'plead' ? 0 : (Math.sin(T) + 0.35 * Math.sin(T * 2.3 + 1.1)) * 0.75 * (1 - 0.35 * k),
          // Out of the seat and into the doorway, slowly at first.
          pulled = k * k * (3 - 2 * k),
          // An angry driver shoves the player back a step.
          shove = clamp((gameTime - job.shoveAt) / 0.45, 0, 1),
          jolt = Math.sin(shove * Math.PI) * 2.6;
        // Leaning in at first, then braced back as the driver comes out.
        job.lean = rock * 0.6 + pulled * 3.2 + jolt - 2.4;
        player.x = job.stand.x + ox * job.lean;
        player.y = job.stand.y + oy * job.lean;
        if (d) {
          d.x = job.seat.x + (job.doorway.x - job.seat.x) * pulled + ox * rock;
          d.y = job.seat.y + (job.doorway.y - job.seat.y) * pulled + oy * rock;
          d.a = out;
          d.carjackT += deltaSeconds;
          d.carjackPull = k;
          if (job.mood === 'defiant' && !job.punched && k > 0.45) {
            // A defiant driver lands one punch before letting go.
            job.punched = true;
            d.punchAt = gameTime;
            hurt(2.5, 'impact');
            noise(0.07, 0.22, 420);
            shake = Math.max(shake, 2.5);
            kickCamera(out, 2);
          } else if (job.mood === 'angry' && !job.punched && k > 0.4) {
            // An angry one shoves the player off, and is grabbed again.
            job.punched = true;
            job.shoveAt = gameTime;
            d.punchAt = gameTime;
            noise(0.05, 0.14, 520);
            kickCamera(out, 1.4);
          }
          if (d.hp <= 0) {
            // Killed in the struggle (a stray round): let go of the body.
            d.carjackHeld = null;
            d.pose = null;
            job.driver = null;
            carjackPhase(job, 'pull');
            return true;
          }
        }
        if (k >= 1) carjackPhase(job, 'pull');
        return true;
      }
      if (job.phase === 'pull') {
        // The swing: the driver goes round the player toward the back of the car
        // (the door is open ahead) and is let go moving out and away.
        const d = job.driver,
          s = clamp(job.t / carjackFor(job, 'swingFor'), 0, 1),
          e = s * s * (3 - 2 * s),
          heave = job.lean * (1 - e) + Math.sin(s * Math.PI) * 1.2;
        player.x = job.stand.x + ox * heave;
        player.y = job.stand.y + oy * heave;
        if (d?.carjackHeld) {
          const angle = job.swingFrom + CARJACK.swing * s * s * (3 - 2 * s);
          d.x = job.stand.x + Math.cos(angle) * job.swingR;
          d.y = job.stand.y + Math.sin(angle) * job.swingR;
          d.a = angle + Math.PI;
          d.carjackT += deltaSeconds;
          if (s >= 1 || d.hp <= 0) releaseSwing(job, angle);
        }
        if (k >= 1) carjackPhase(job, 'enter');
        return true;
      }
      if (job.phase === 'enter') {
        // A step in to the sill, facing the seat; enterVehicle ducks the player in.
        const e = k * k * (3 - 2 * k);
        player.x = job.stand.x + (job.sill.x - job.stand.x) * e;
        player.y = job.stand.y + (job.sill.y - job.stand.y) * e;
        if (k >= 1) finishCarjack(job);
        return true;
      }
      return true;
    }
    function finishCarjack(job) {
      const c = job.car;
      if (job.driver?.carjackHeld) releaseSwing(job, headingBetween(player, job.driver));
      player.carjack = null;
      // Pulled shut once the player is in (crowd3d-frame.js ducks in over 0.4 s).
      if (c.doorSwing) c.doorSwing.closeAt = gameTime + 0.34;
      // enterVehicle charges for taking traffic as it always has (c.ai).
      c.ai = job.wasAi;
      enterVehicle(c);
    }
    /* E again during the struggle: straight to the pull, or into the seat. */
    function skipCarjack() {
      const job = player.carjack;
      if (!job) return false;
      if (job.phase === 'door' || job.phase === 'reach' || job.phase === 'tug') {
        if (job.phase === 'door') carjackPhase(job, 'reach');
        carjackPhase(job, 'pull');
      } else if (job.phase === 'pull' && !job.driver?.carjackHeld) carjackPhase(job, 'enter');
      else if (job.phase === 'enter') finishCarjack(job);
      return true;
    }
    /* Let go of it all (walked off, hurt, a teleport, death or a reset). */
    function cancelCarjack(why = 'reset') {
      const job = player.carjack;
      if (!job) return;
      carjackLast.cancelled = why;
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
        },
        last = { passengers: carjackLast.passengers, instant: carjackLast.instant, quick: carjackLast.quick, cancelled: carjackLast.cancelled, phases: carjackLast.phases.join(' > ') };
      if (!job) return { running: false, inCar: player.car?.type || null, victim, ...last };
      return {
        running: true,
        victim,
        ...last,
        phase: job.phase,
        t: +job.t.toFixed(2),
        mood: job.mood,
        tugFor: job.tugFor,
        approachFor: +job.approachFor.toFixed(2),
        waypoints: job.path.length,
        car: job.car.type,
        kmh: Math.round(Math.hypot(job.car.vx || 0, job.car.vy || 0) / KMH),
        driver: job.driver ? { x: Math.round(job.driver.x), y: Math.round(job.driver.y), pose: job.driver.pose, female: personFemale(job.driver) } : null,
        player: { x: Math.round(player.x), y: Math.round(player.y) },
      };
    }
    /* Console (DeadEndCity.carjackScan): occupied traffic near the player and what E would do. */
    function carjackScan(radius, count, from = 'here') {
      const near = [];
      for (const c of vehicles) {
        if (!c.occupied || c === player.car || isAircraft(c) || isBoat(c)) continue;
        const d = distanceBetween(c, player);
        if (d < radius) near.push({ c, d });
      }
      near.sort((a, b) => a.d - b.d);
      return near.slice(0, count).map(({ c, d }) => {
        const spec = vehicleSpec(c),
          at = from === 'here' ? player : carjackLocal(c, 0, (from === 'driver' ? 1 : -1) * (spec.w / 2 + 14), {}),
          { job, why } = planCarjack(c, at),
          r = (q) => ({ x: Math.round(q.x), y: Math.round(q.y) });
        return {
          id: vehicles.indexOf(c),
          type: c.type,
          x: Math.round(c.x),
          y: Math.round(c.y),
          a: +c.a.toFixed(2),
          d: Math.round(d),
          kmh: Math.round(Math.hypot(c.vx || 0, c.vy || 0) / KMH),
          ai: !!c.ai,
          // Locked: E only says so (shoot the glass first, carjack.js breakVehicleLock).
          locked: vehicleIsLocked(c),
          // Waiting at a signal: the light on its way through the junction ahead.
          light: c.junction ? trafficSignal(c.junction.x, c.junction.y)[Math.abs(Math.sin(c.a)) > Math.abs(Math.cos(c.a)) ? 'vertical' : 'horizontal'] : null,
          why,
          quick: job.quick,
          waypoints: job.path ? job.path.length : 0,
          tight: job.standOut < CARJACK.stand,
          driverSide: r(carjackLocal(c, 0, spec.w / 2 + 14, {})),
          passengerSide: r(carjackLocal(c, 0, -spec.w / 2 - 14, {})),
        };
      });
    }
    /* Console (DeadEndCity.carjackStage): a stopped sedan with a driver of `mood` on open
       ground, `hem` 'open', 'kerb' (parked cars a short gap ahead and behind), 'lane' (a
       car in the next lane beside the driver's door) or 'boxed' (both, bumper to bumper),
       and the player on its `side`, the car rolling east at `kmh`; nothing started:
       press the action key. */
    function carjackStage(hem, mood, side, kmh = 0) {
      if (player.car) exitCar();
      for (let i = vehicles.length - 1; i >= 0; i--) if (vehicles[i].carjackTest) vehicles.splice(i, 1);
      const c = spawnClearCar('sedan', player.x, player.y - 60, 0, true),
        spec = vehicleSpec(c),
        others = [];
      Object.assign(c, { carjackTest: true, vx: kmh * KMH, vy: 0, speed: kmh * KMH, occupied: true, locked: false, driverMood: mood, passengers: 0 });
      const put = (along, out) => {
        const p = carjackLocal(c, along, out, {}),
          o = makeCar('sedan', p.x, p.y, c.a, false);
        o.carjackTest = true;
        others.push(o);
      };
      if (hem === 'kerb' || hem === 'boxed') {
        const gap = hem === 'kerb' ? 9 : 1;
        put(spec.l + gap, 0);
        put(-spec.l - gap, 0);
      }
      if (hem === 'lane' || hem === 'boxed') put(0, spec.w + 10);
      const p = carjackLocal(c, 0, (side === 'driver' ? 1 : -1) * (spec.w / 2 + 14), {});
      teleportPlayer(p.x, p.y);
      player.a = headingBetween(player, c);
      return { car: c.type, hem, parked: others.length, plan: carjackScan(80, 1)[0] };
    }
