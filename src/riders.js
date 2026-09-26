    // BEGIN SUBSYSTEM: src/riders.js — Riders thrown from motorbikes and bicycles
    /**
     * Riders thrown from motorbikes and bicycles
     * Source: src/riders.js
     * Scope: shared game closure (after physics.js and carjack.js).
     *
     * A rider is not belted in. When a two-wheeler's crash delta-v (physics.js
     * CRASH SEVERITY, the same number that bends it) passes RIDER_THROW, or it
     * comes down off a drawbridge leaf hard, the bike stops and the rider does
     * not: the body keeps the speed the bike had going in and pitches over the
     * bars, part of that speed turning into a climb. It flies a real ballistic
     * arc (GRAVITY), somersaulting, strikes whatever stands in its way (walls,
     * trunks, a van's side; it goes over a car's roof or a bench), lands, bounces
     * if it came down hard, slides on its riding gear at RIDER_SLIDE_G and lies
     * still a moment before getting up. Every hit hurts by the speed into it:
     * the body into a wall or a vehicle, the landing, the slide. The bike goes on
     * alone on its side (`fallen`: it tumbles while fast, then lies there and
     * slides on Coulomb friction) until someone picks it up by getting on.
     *
     * The same throw serves the player (`player.thrown`, stepped in place of
     * walking) and traffic's riders, who become a pedestrian thrown along the
     * same arc (`person.ejected.rider`, stepped by carjack.js stepEjection). The
     * crime and wanted rules are those of the crash itself: a throw adds none.
     */
    const RIDER_THROW = {
        // Delta-v that throws the rider: a motorbike's, a bicycle's.
        motorbike: 24 * KMH,
        bicycle: 18 * KMH,
        // Speed into the surface on a landing that throws the rider (m/s).
        landing: 6.5 * UNITS_PER_METRE,
      },
      RIDER_SEAT = 0.95 * UNITS_PER_METRE, // hips above the road on the saddle
      RIDER_SLIDE_G = 0.62, // a body in riding gear sliding on asphalt
      RIDER_RADIUS = 5;
    /* Hit points a body loses striking something at `speed` (map units a second)
       along the contact: 4 at 20 km/h, 27 at 40, 64 at 60, lethal from about 75. */
    function riderImpactDamage(speed) {
      const kmh = speed / KMH;
      return kmh <= 10 ? 0 : Math.pow((kmh - 10) / 10, 1.7) * 4.2;
    }
    // A landing: `into` the speed down into the ground (a 2 m fall is 22 km/h, 5).
    function riderLandingDamage(into, along) {
      const kmh = into / KMH,
        slide = along / KMH;
      return (kmh <= 12 ? 0 : Math.pow((kmh - 12) / 10, 1.6) * 5) + (slide <= 30 ? 0 : Math.pow((slide - 30) / 10, 1.3) * 1.5);
    }
    // Whether someone is riding `c` (the player, or traffic's rider on its bike).
    function riderAboard(c) {
      const spec = vehicleSpec(c);
      if (!spec?.bike || c.hp <= 0 || c.fallen) return false;
      return c === player.car || (!!c.ai && c.occupied !== false && !c.cop);
    }
    /* From collisionImpact: a crash of `deltaV` on a two-wheeler. `others` are the
       vehicles in the crash (the rider vaults a car's roof, not a van's side). */
    function riderCrash(c, deltaV, other) {
      if (!riderAboard(c)) return false;
      const spec = vehicleSpec(c);
      if (deltaV < (spec.bicycle ? RIDER_THROW.bicycle : RIDER_THROW.motorbike)) return false;
      // The speed the bike had going in (resolveContact keeps it), which the rider still has.
      throwRider(c, c.impactVx || c.vx, c.impactVy || c.vy, 'crash', other, 0, deltaV);
      return true;
    }
    // From drawbridgeSettle: a two-wheeler landing `into` the road this hard.
    function riderLanding(c, into) {
      if (!riderAboard(c) || into < RIDER_THROW.landing) return false;
      throwRider(c, c.vx, c.vy, 'landing', null, into);
      return true;
    }
    // How high a vehicle stands, for a body flying at it (a car's roof, a van's).
    function riderObstacleTop(o) {
      const spec = vehicleSpec(o);
      const tall = spec.bike ? 1.1 : spec.bus || spec.truck || (spec.mass || 1.25) >= 2.8 ? 3 : (spec.mass || 1.25) >= 2 ? 1.9 : 1.45;
      return entityElevation(o) + tall * UNITS_PER_METRE;
    }
    /* A body in flight: velocity (vx, vy), hips `z` above the road climbing at
       `vz`, somersaulting quicker the faster it goes; `ignore` the vehicles it may
       pass through at first (its own [0] always, what it hit [1] briefly). */
    function riderThrowState(vx, vy, z, vz, cause, ignore, from) {
      const speed = Math.hypot(vx, vy);
      return {
        vx,
        vy,
        z,
        vz,
        heading: speed > 5 ? Math.atan2(vy, vx) : from.a,
        pitch: 0,
        spin: clamp((speed / UNITS_PER_METRE) * 0.65, 3, 11),
        slideSpin: randomBetween(-1, 1) * clamp(speed / 60, 0.5, 4),
        phase: 'air',
        time: 0,
        downFor: 0,
        hurt: 0,
        hits: 0,
        bounces: 0,
        slid: 0,
        rash: 0,
        peak: z,
        from: { x: from.x, y: from.y },
        ignore,
        cause,
        speed: Math.round(speed / KMH),
      };
    }
    function throwRider(c, vx, vy, cause, other = null, into = 0, deltaV = 0) {
      const spec = vehicleSpec(c),
        speed = Math.hypot(vx, vy),
        heading = speed > 5 ? Math.atan2(vy, vx) : c.a,
        landing = cause === 'landing';
      // Over the bars: the bike's nose stops, the hips keep going and pivot over
      // the tank, turning part of the speed into a climb. Off a landing the rider
      // is pitched forward rather than up.
      const keep = landing ? 0.9 : 0.85,
        climb = landing ? 1.2 * UNITS_PER_METRE : clamp(speed * 0.22, 1.5 * UNITS_PER_METRE, 6 * UNITS_PER_METRE),
        // The bike and whatever it hit are passed through for a moment while the
        // body clears them; a car low enough is vaulted, a van's side is not.
        throwState = riderThrowState(vx * keep, vy * keep, RIDER_SEAT, climb, cause, [c, other && riderObstacleTop(other) - entityElevation(other) < 2.2 * UNITS_PER_METRE ? other : null], c);
      throwState.spin *= landing ? 0.6 : 1;
      // The rider starts at the handlebars, just ahead of the bike's middle.
      let x = c.x + Math.cos(c.a) * spec.l * 0.2,
        y = c.y + Math.sin(c.a) * spec.l * 0.2;
      if (solid(x, y, RIDER_RADIUS)) {
        x = c.x;
        y = c.y;
      }
      // The bike carries on alone and goes down, tumbling while it is quick.
      c.fallen = {
        roll: 0,
        side: Math.random() < 0.5 ? -1 : 1,
        tumble: clamp(Math.hypot(c.vx, c.vy) / UNITS_PER_METRE * 0.6, 0, 9),
      };
      c.speed = Math.hypot(c.vx, c.vy);
      c.damageVersion = (c.damageVersion || 0) + 1;
      playSample(speed > 40 * KMH ? 'crash-medium-2' : 'crash-bump-2', clamp(speed / (80 * KMH), 0.3, 0.8), 1.1, { x, y });
      if (c === player.car) {
        // Off the bike without climbing off: nothing of exitCar's search for a door.
        c.ai = false;
        player.car = null;
        player.x = x;
        player.y = y;
        player.a = heading;
        player.altitude = terrainHeight(x, y);
        player.thrown = throwState;
        riderThrows.push({ who: 'player', type: c.type, cause, speed: throwState.speed, at: +gameTime.toFixed(1), state: throwState });
        if (riderThrows.length > 6) riderThrows.shift();
        tell(landing ? 'Too hard a landing: you are thrown off the bike.' : 'Thrown over the bars!', 2.4);
        shake = Math.max(shake, clamp(speed / 30, 3, 9));
        return throwState;
      }
      // Traffic's rider: off the bike and into the crowd as a thrown pedestrian.
      c.ai = false;
      c.occupied = false;
      c.aiControl = null;
      const rider = {
        x,
        y,
        a: heading,
        color: c.driverColor || randomChoice(DRIVER_COLORS),
        flee: 0,
        timer: 1,
        walk: 0,
        state: 'walk',
        mood: 'flee',
        // The legs and body into the bars and whatever the bike hit (the player's
        // share of this is collisionImpact's crashInjury).
        hp: Math.max(1, 70 - crashInjury(c, deltaV)),
        // Held down while in the air and sliding; the lie-still afterwards is the
        // usual knockdown (the daze and every rule about people on the ground).
        knockedFor: 60,
        dazedFor: 0,
        impactCooldown: 0.6,
        ejected: { ...throwState, rider: true, reason: 'rider' },
      };
      pedestrians.push(rider);
      scream(rider);
      riderThrows.push({ who: 'traffic', type: c.type, cause, speed: throwState.speed, at: +gameTime.toFixed(1), state: rider.ejected, person: rider });
      if (riderThrows.length > 6) riderThrows.shift();
      return rider.ejected;
    }
    // The last few throws (the developer console's riderReport()).
    const riderThrows = [];
    /* Whether a flying or sliding body at height `z` above the ground can move to
       (x, y): walls and buildings always stop it, trunks and posts below about a
       metre and a half, furniture only on the ground, vehicles below their roofs. */
    function riderBlocked(t, x, y) {
      if (solid(x, y, RIDER_RADIUS)) return true;
      if (t.z < 1.2 * UNITS_PER_METRE && footObstacleBlocked(x, y, 3.5)) return true;
      const ground = terrainHeight(x, y) + t.z;
      for (const o of vehicles) {
        if (o.x - x > 90 || x - o.x > 90 || o.y - y > 90 || y - o.y > 90) continue;
        // Never the rider's own bike (behind, then lying down); what it hit only
        // while the body clears it.
        if (o === t.ignore[0] || (t.time < 0.3 && o === t.ignore[1])) continue;
        if (isAircraft(o) && aircraftClearance(o) > 20) continue;
        if (ground < riderObstacleTop(o) && pointInCar(x, y, o, RIDER_RADIUS)) return o;
      }
      return false;
    }
    /* One step of a thrown body. `hurtBody(amount, kind)` applies what it costs.
       Returns true once the body has got up. */
    function stepThrownBody(body, t, deltaSeconds, hurtBody) {
      t.time += deltaSeconds;
      if (t.phase === 'down') {
        t.downFor -= deltaSeconds;
        return t.downFor <= 0;
      }
      const speed = Math.hypot(t.vx, t.vy),
        steps = Math.max(1, Math.ceil((speed * deltaSeconds) / 4)),
        dt = deltaSeconds / steps;
      for (let i = 0; i < steps; i++) {
        if (t.phase === 'air') {
          t.vz -= GRAVITY * dt;
          t.z += t.vz * dt;
          t.peak = Math.max(t.peak, t.z);
          t.pitch += t.spin * dt;
          const drag = Math.exp(-0.04 * dt);
          t.vx *= drag;
          t.vy *= drag;
        }
        // Sideways and along, one axis at a time, so a wall stops only the part of
        // the motion into it (that part is the speed of the hit).
        for (const axis of ['x', 'y']) {
          const v = axis === 'x' ? t.vx : t.vy,
            nx = body.x + (axis === 'x' ? v * dt : 0),
            ny = body.y + (axis === 'y' ? v * dt : 0),
            blocked = Math.abs(v) > 0.01 && riderBlocked(t, nx, ny);
          if (!blocked) {
            body.x = nx;
            body.y = ny;
            continue;
          }
          // The body strikes it: what hurts is the speed into it.
          const hit = Math.abs(v);
          if (hit > 2 * UNITS_PER_METRE) {
            hurtBody(riderImpactDamage(hit), 'impact');
            t.hits++;
            playSample(hit > 30 * KMH ? 'crash-medium-1' : 'crash-bump-1', clamp(hit / (60 * KMH), 0.2, 0.7), 1.25, body);
            if (body === player) shake = Math.max(shake, clamp(hit / 25, 2, 8));
            // A struck vehicle feels it (a 75 kg body).
            if (blocked !== true && blocked.hp > 0) damageVehicle(blocked, riderImpactDamage(hit) * 0.15, nx, ny);
          }
          if (axis === 'x') {
            t.vx = -t.vx * 0.15;
            t.vy *= 0.6;
          } else {
            t.vy = -t.vy * 0.15;
            t.vx *= 0.6;
          }
          t.spin *= 0.5;
        }
        if (t.phase === 'air' && t.z <= 0) {
          // Touchdown: the speed into the road and the tumble at the first contact.
          const into = -t.vz,
            along = Math.hypot(t.vx, t.vy);
          t.z = 0;
          hurtBody(riderLandingDamage(into, t.bounces ? 0 : along), 'impact');
          playSample('crash-bump-1', clamp(into / (8 * UNITS_PER_METRE), 0.15, 0.6), 0.8, body);
          t.vx *= 0.7;
          t.vy *= 0.7;
          t.bounces++;
          if (into > 3.2 * UNITS_PER_METRE && t.bounces < 4) {
            t.vz = into * 0.28;
            t.spin *= 0.6;
          } else {
            t.vz = 0;
            t.phase = 'slide';
            if (along > 6 * UNITS_PER_METRE) noise(0.5, 0.12, 900);
          }
        } else if (t.phase === 'slide') {
          // Sliding on the riding gear: Coulomb friction (less on a wet road), a
          // little road rash per metre, the body turning as it goes.
          const v = Math.hypot(t.vx, t.vy),
            slow = Math.min(v, RIDER_SLIDE_G * wetGrip() * GRAVITY * dt),
            f = v > 0 ? (v - slow) / v : 0;
          t.vx *= f;
          t.vy *= f;
          t.slid += v * dt;
          // Road rash, a little per metre, dealt a few points at a time.
          if (v > 20 * KMH) t.rash += ((v * dt) / UNITS_PER_METRE) * 0.3;
          if (t.rash >= 2) {
            hurtBody(t.rash, 'impact');
            t.rash = 0;
          }
          t.heading += t.slideSpin * dt * clamp(v / (30 * KMH), 0, 1);
          // Lie on the back or the front, whichever the somersault was nearer.
          const lie = Math.round((t.pitch - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
          t.pitch += (lie - t.pitch) * (1 - Math.exp(-8 * dt));
          if (v < 0.6 * UNITS_PER_METRE) {
            if (t.rash > 0) hurtBody(t.rash, 'impact');
            t.rash = 0;
            t.vx = t.vy = 0;
            t.phase = 'down';
            t.pitch = lie;
            // Lying still a moment, longer the worse it was.
            t.downFor = clamp(1.2 + t.hurt / 30, 1.2, 3.4);
            break;
          }
        }
      }
      return false;
    }
    /* The player's throw, in place of walking (game.js update). Returns true while
       thrown: no walking, firing or getting into anything until back on their feet. */
    function updateThrownPlayer(deltaSeconds) {
      const t = player.thrown;
      if (!t) return false;
      const up = stepThrownBody(player, t, deltaSeconds, (amount, kind) => {
        if (amount <= 0) return;
        t.hurt += amount;
        hurt(amount, kind);
      });
      player.a = t.heading;
      if (player.thrown && up) {
        player.thrown = null;
        player.inv = Math.max(player.inv, 0.4);
        tell(t.hurt > 40 ? 'You drag yourself up. The bike is where it landed.' : 'Back on your feet. The bike is where it landed.', 2.4);
      }
      return true;
    }
    /* Traffic's rider, from carjack.js stepEjection: the same throw, then the
       usual knockdown and a dazed walk away. */
    function stepRiderEjection(person, e, deltaSeconds) {
      const up = stepThrownBody(person, e, deltaSeconds, (amount) => {
        if (amount <= 0 || person.hp <= 0) return;
        e.hurt += amount;
        const fatal = amount >= person.hp;
        strikePerson(person, amount, e.heading + Math.PI, null, fatal || amount > 8, 'impact');
      });
      person.a = e.heading;
      if (person.hp <= 0) {
        person.ejected = null;
        return;
      }
      if (e.phase === 'down' && person.knockedFor > 2) person.knockedFor = e.downFor + 0.6;
      else if (e.phase !== 'down') person.knockedFor = Math.max(person.knockedFor, 1);
      if (up || e.time > 12) {
        person.ejected = null;
        person.knockedFor = 0.01;
        person.flee = 6;
        person.threat = { x: e.from.x, y: e.from.y };
      }
    }
    /* A bike lying where it came down: it cartwheels while quick, settles on one
       side, and slides on the friction of its bodywork (physics.js). */
    function updateFallenBike(c, deltaSeconds) {
      const f = c.fallen;
      if (!f) return;
      const speed = Math.hypot(c.vx || 0, c.vy || 0);
      f.tumble *= Math.exp(-(speed > 8 * UNITS_PER_METRE ? 0.6 : 3) * deltaSeconds);
      const rest = f.side * 1.42;
      if (f.tumble > 0.8) f.roll += f.tumble * f.side * deltaSeconds;
      else {
        const lie = Math.round((f.roll - rest) / TAU) * TAU + rest;
        f.roll += (lie - f.roll) * (1 - Math.exp(-6 * deltaSeconds));
      }
    }
    // Riders' console report: the player's throw now and the last few throws.
    function riderReport() {
      const pack = (t) =>
        t && {
          phase: t.phase,
          time: +t.time.toFixed(2),
          height: +worldMeters(t.z).toFixed(2),
          peak: +worldMeters(t.peak).toFixed(2),
          kmh: Math.round(Math.hypot(t.vx, t.vy) / KMH),
          vz: +(t.vz / UNITS_PER_METRE).toFixed(1),
          pitch: +t.pitch.toFixed(2),
          hurt: Math.round(t.hurt),
          hits: t.hits,
          bounces: t.bounces,
          slidM: +worldMeters(t.slid).toFixed(1),
          fromM: +worldMeters(Math.hypot(player.x - t.from.x, player.y - t.from.y)).toFixed(1),
        };
      return {
        thrown: pack(player.thrown),
        hp: Math.round(player.hp),
        onFoot: !player.car,
        throws: riderThrows.map((r) => ({
          who: r.who,
          type: r.type,
          cause: r.cause,
          kmh: r.speed,
          at: r.at,
          phase: r.state.phase,
          hurt: Math.round(r.state.hurt),
          hits: r.state.hits,
          personHp: r.person ? Math.round(r.person.hp) : undefined,
          travelledM: r.person ? +worldMeters(distanceBetween(r.person, r.state.from)).toFixed(1) : undefined,
        })),
      };
    }
    // END SUBSYSTEM: src/riders.js
