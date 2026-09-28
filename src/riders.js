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
     * if it came down hard, tumbles over and over while it is quick (RIDER_ROLL_G),
     * slides on its riding gear at RIDER_SLIDE_G and lies still a moment before
     * getting up (knocked out for a while after a bad one). A locked front wheel
     * drops the rider on their side (a lowside, a slide more than a tumble); a
     * wheelie taken too far (wheelie.js) puts them off the back ('loopout').
     *
     * What it costs is falls-body.js's scale (riderInjury, fallInjury): the body
     * into a wall or a vehicle ('strike', fatal from 75 km/h), the first touch of
     * the ground ('tumble', by the speed along it), the drop into it, and the road
     * rash of the slide. A fall that is survived leaves no blood on the road
     * (hurt() kind 'fall', no wound for traffic's riders); a rider it kills
     * bleeds as any body does (bleed()). The bike goes on alone on its side
     * (`fallen`: it tumbles while fast, then lies there and slides on Coulomb
     * friction) until someone picks it up by getting on.
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
      RIDER_ROLL_G = 0.8, // a body tumbling over and over scrubs speed quicker
      RIDER_ROLL_RADIUS = 0.45 * UNITS_PER_METRE, // a tucked body rolling (rad/s = speed / this)
      RIDER_KNOCKOUT = 45, // hit points taken in one fall that leave the rider out cold
      RIDER_RADIUS = 5;
    // How a throw starts, by cause: over the bars, off a hard landing, down on
    // the side (a lowside), off the back of a wheelie. `keep` of the speed,
    // `climb` (m/s, or null: from the speed), somersault `spin` share and sign,
    // `roll` share of the tumble on the ground.
    const RIDER_THROW_STYLES = {
      crash: { keep: 0.85, climb: null, spin: 1, roll: 1 },
      landing: { keep: 0.9, climb: 1.2, spin: 0.6, roll: 1 },
      lowside: { keep: 1, climb: 0.4, spin: 0.25, roll: 0.3 },
      loopout: { keep: 0.95, climb: 0, spin: -0.3, roll: 0.5 },
    };
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
        style = RIDER_THROW_STYLES[cause] || RIDER_THROW_STYLES.crash,
        landing = cause === 'landing',
        loopout = cause === 'loopout';
      // Over the bars: the bike's nose stops, the hips keep going and pivot over
      // the tank, turning part of the speed into a climb (a little one at a
      // walking pace: the rider stumbles over the bars). Off a landing the rider
      // is pitched forward rather than up; in a lowside or off the back of a
      // wheelie they drop from the saddle with the bike's speed.
      const climb = style.climb === null ? clamp(speed * 0.22, 0.6 * UNITS_PER_METRE, 6 * UNITS_PER_METRE) : style.climb * UNITS_PER_METRE,
        // The bike and whatever it hit are passed through for a moment while the
        // body clears them; a car low enough is vaulted, a van's side is not.
        throwState = riderThrowState(vx * style.keep, vy * style.keep, RIDER_SEAT, climb, cause, [c, other && riderObstacleTop(other) - entityElevation(other) < 2.2 * UNITS_PER_METRE ? other : null], c);
      throwState.spin *= style.spin;
      throwState.rollShare = style.roll;
      if (loopout) throwState.heading = c.a;
      // The rider starts at the handlebars, just ahead of the bike's middle (off
      // the back of a wheelie, over the rear wheel).
      const reach = loopout ? -0.3 : 0.2;
      let x = c.x + Math.cos(c.a) * spec.l * reach,
        y = c.y + Math.sin(c.a) * spec.l * reach;
      if (solid(x, y, RIDER_RADIUS)) {
        x = c.x;
        y = c.y;
      }
      c.wheelie = 0;
      c.wheelieRate = 0;
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
        tell(
          landing
            ? 'Too hard a landing: you are thrown off the bike.'
            : loopout
              ? 'Looped it: off the back of the bike!'
              : cause === 'lowside'
                ? 'The front tucks: down on your side.'
                : speed < 25 * KMH
                  ? 'Over the bars.'
                  : 'Thrown over the bars!',
          2.4,
        );
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
    /* One step of a thrown body. `hurtBody(amount)` applies what it costs (the
       scale is falls-body.js riderInjury / fallInjury; Infinity is fatal).
       Returns true once the body has got up. */
    function stepThrownBody(body, t, deltaSeconds, hurtBody) {
      t.time += deltaSeconds;
      if (t.phase === 'down') {
        t.downFor -= deltaSeconds;
        return t.downFor <= 0;
      }
      const hit = (amount) => {
        if (!(amount > 0)) return;
        t.hurt += Math.min(amount, 1000);
        hurtBody(amount);
      };
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
          const into = Math.abs(v);
          if (into > 2 * UNITS_PER_METRE) {
            const injury = riderInjury(into, 'strike');
            hit(injury);
            t.hits++;
            t.strike = Math.max(t.strike || 0, Math.round(into / KMH));
            playSample(into > 30 * KMH ? 'crash-medium-1' : 'crash-bump-1', clamp(into / (60 * KMH), 0.2, 0.7), 1.25, body);
            if (body === player) shake = Math.max(shake, clamp(into / 25, 2, 8));
            // A struck vehicle feels it (a 75 kg body).
            if (blocked !== true && blocked.hp > 0) damageVehicle(blocked, Math.min(injury, 100) * 0.15, nx, ny);
          }
          if (axis === 'x') {
            t.vx = -t.vx * 0.15;
            t.vy *= 0.6;
          } else {
            t.vy = -t.vy * 0.15;
            t.vx *= 0.6;
          }
          t.spin *= 0.5;
          t.roll = (t.roll || 0) * 0.5;
        }
        if (t.phase === 'air' && t.z <= 0) {
          // Touchdown: the drop into the road (the fall scale) and, the first
          // time, the tumble at the speed along it.
          const into = -t.vz,
            along = Math.hypot(t.vx, t.vy);
          t.z = 0;
          hit(fallInjury(into) + (t.bounces ? 0 : riderInjury(along, 'tumble')));
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
            // Over and over along the road: quicker the faster it goes (a tucked
            // body's radius), the way the somersault was turning.
            t.roll = Math.min(11, (Math.hypot(t.vx, t.vy) / RIDER_ROLL_RADIUS) * (t.rollShare ?? 1));
            t.rollSign = t.spin < 0 ? -1 : 1;
            if (along > 6 * UNITS_PER_METRE) noise(0.5, 0.12, 900);
          }
        } else if (t.phase === 'slide') {
          // Tumbling, then sliding on the riding gear: Coulomb friction (less on a
          // wet road; a tumble scrubs more), a little road rash per metre, the
          // body turning as it goes.
          const v = Math.hypot(t.vx, t.vy),
            rolling = t.roll > 1.5,
            slow = Math.min(v, (rolling ? RIDER_ROLL_G : RIDER_SLIDE_G) * wetGrip() * GRAVITY * dt),
            f = v > 0 ? (v - slow) / v : 0;
          t.vx *= f;
          t.vy *= f;
          t.slid += v * dt;
          // Road rash, a little per metre, dealt a few points at a time.
          t.rash += ((v * dt) / UNITS_PER_METRE) * riderInjury(v, 'rash');
          if (t.rash >= 2) {
            hit(t.rash);
            t.rash = 0;
          }
          t.heading += t.slideSpin * dt * clamp(v / (30 * KMH), 0, 1);
          // Lie on the back or the front, whichever the tumble left nearer.
          const lie = Math.round((t.pitch - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
          if (rolling) {
            t.pitch += t.roll * t.rollSign * dt;
            t.roll = Math.min(t.roll * Math.exp(-1.4 * dt), v / RIDER_ROLL_RADIUS);
          } else t.pitch += (lie - t.pitch) * (1 - Math.exp(-8 * dt));
          if (v < 0.6 * UNITS_PER_METRE) {
            if (t.rash > 0) hit(t.rash);
            t.rash = 0;
            t.vx = t.vy = 0;
            t.roll = 0;
            t.phase = 'down';
            t.pitch = lie;
            // Lying still a moment, longer the worse it was: up again at once
            // after a roll, a few seconds after a bad one, out cold after a very
            // bad one.
            t.knockedOut = t.hurt >= RIDER_KNOCKOUT;
            t.downFor = t.knockedOut ? clamp(5 + (t.hurt - RIDER_KNOCKOUT) / 8, 5, 9) : clamp(0.5 + t.hurt / 14, 0.5, 3.4);
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
      const up = stepThrownBody(player, t, deltaSeconds, (amount) => {
        if (player.hp <= 0) return;
        // Kind 'fall': a fall that is survived draws no blood (hurt()).
        hurt(Math.min(amount, 1000), 'fall');
        // Killed by it: the body bleeds where it lies, as any body does.
        if (player.hp <= 0) bleed(player, 1.5, t.heading + Math.PI);
      });
      player.a = t.heading;
      if (player.thrown && t.phase === 'down' && t.knockedOut && !t.toldOut) {
        t.toldOut = true;
        tell('KNOCKED OUT', Math.max(2, t.downFor), { tone: 'warn' });
      }
      if (player.thrown && up) {
        player.thrown = null;
        player.inv = Math.max(player.inv, 0.4);
        tell(
          t.knockedOut
            ? 'You come round on the road. The bike is where it landed.'
            : t.hurt > 25
              ? 'You drag yourself up. The bike is where it landed.'
              : 'Back on your feet. The bike is where it landed.',
          2.4,
        );
      }
      return true;
    }
    /* Traffic's rider, from carjack.js stepEjection: the same throw, then the
       usual knockdown and a dazed walk away. A fall they live through leaves no
       wound and no blood; one that kills them is a death like any other. */
    function stepRiderEjection(person, e, deltaSeconds) {
      const up = stepThrownBody(person, e, deltaSeconds, (amount) => {
        if (person.hp <= 0) return;
        if (amount < person.hp) {
          person.hp -= amount;
          person.flee = 8;
          return;
        }
        strikePerson(person, person.hp + 1, e.heading + Math.PI, null, false, 'impact');
        bleed(person, 1.6, e.heading + Math.PI);
      });
      person.a = e.heading;
      if (person.hp <= 0) {
        person.ejected = null;
        return;
      }
      if (e.phase === 'down' && !e.settled) {
        e.settled = true;
        person.knockedFor = e.downFor + 0.6;
      } else if (e.phase !== 'down') person.knockedFor = Math.max(person.knockedFor, 1);
      if (up || e.time > 16) {
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
          strikeKmh: t.strike || 0,
          bounces: t.bounces,
          rolling: +(t.roll || 0).toFixed(1),
          knockedOut: !!t.knockedOut,
          downFor: t.phase === 'down' ? +t.downFor.toFixed(1) : undefined,
          slidM: +worldMeters(t.slid).toFixed(1),
          fromM: +worldMeters(Math.hypot(player.x - t.from.x, player.y - t.from.y)).toFixed(1),
        };
      return {
        thrown: pack(player.thrown),
        hp: Math.round(player.hp),
        dead: gameMode === 'dead' || player.hp <= 0,
        onFoot: !player.car,
        // Blood on the ground within 40 m of the player (a fall survived leaves none).
        bloodNear: bloodPools.filter((b) => Math.abs(b.x - player.x) < 320 && Math.abs(b.y - player.y) < 320).length,
        throws: riderThrows.map((r) => ({
          who: r.who,
          type: r.type,
          cause: r.cause,
          kmh: r.speed,
          at: r.at,
          phase: r.state.phase,
          hurt: Math.round(r.state.hurt),
          hits: r.state.hits,
          strikeKmh: r.state.strike || 0,
          knockedOut: !!r.state.knockedOut,
          personHp: r.person ? Math.round(r.person.hp) : undefined,
          travelledM: r.person ? +worldMeters(distanceBetween(r.person, r.state.from)).toFixed(1) : undefined,
        })),
      };
    }
    // END SUBSYSTEM: src/riders.js
