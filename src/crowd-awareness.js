    // Crowd awareness of vehicles: who sees or hears a car coming, how long they take, and whether they dodge, step aside, freeze, jump back or are hit unaware (nearMisses calls watchVehicle).
    /**
     * WHO SEES THE CAR COMING
     * A pedestrian in a car's path (nearMisses, crowd-reactions.js) reacts only to a car they
     * could perceive. Each person in the path keeps a `p.carWatch` for that car: an awareness
     * that fills from what they see and hear and, once full (`need`, 0.55-1.4), is the moment
     * they notice. They then take a reaction time (`carSense().react` 0.36-0.56 s, plus a lag for
     * their attention) and only then decide, from the time to impact left:
     *   - SIGHT: the angle between where they face (`p.a`) and the car. Sharp inside ~30 degrees
     *     either side, fading to 60, peripheral and slow out to 100, nothing beyond ~120. People who
     *     just looked both ways at a kerb (`p.glanceUntil`) see all round for a few seconds; once
     *     committed to crossing they look where they walk. Buildings block sight (crowdSight).
     *   - HEARING: omnidirectional but weak: tyre roar and engine rising with speed and by type
     *     (CAR_NOISE: a bicycle barely, a bike or supercar loud), fading with distance (half at
     *     ~7 m), masked by traffic round them and rain, nearly gone for earbuds. A horn, a siren or
     *     a screech adds a lot. Someone who only hears it first turns (a startled half-turn,
     *     +0.28 s) before they can see and judge it.
     *   - ATTENTION (carAttention): a phone, a chat, drink, a camera or a scare scale both senses
     *     and the lag; the old, the young and the drunk are slower.
     * The decision, with t the seconds left before the bumper: under 0.08 s nothing (a startled
     * flinch, hit); otherwise most dodge sideways (towards the nearer edge of the path, some the
     * wrong way), more calmly with time to spare (a sidestep, facing the car), a few jump back
     * along the path, a few freeze; people only just outside the wheel track often just watch it
     * pass. A person who never noticed is hit unaware: no dodge, no cry (knockPerson reads
     * `carNoticed`). Damage, crime and witness rules are untouched.
     */
    const CAR_HORIZON = 2.4,
      // Slower than this (units/s) is a car edging along, not a threat: 16 km/h for the player's car, 31 for
      // the traffic (which keeps its own manners round people: a pedestrian does not need to leap for it).
      CAR_MIN_SPEED = 36,
      CAR_MIN_SPEED_TRAFFIC = 70,
      // Cars further than this from the player are not watched.
      CAR_REACH = 600,
      CAR_NOISE = {
        bicycle: 0.06,
        bike: 0.9,
        cruiser: 0.9,
        dolcati: 0.95,
        yamasaki: 0.95,
        kr500: 0.95,
        supercar: 1,
        chevette: 1,
        brutini: 1,
        cavalino: 0.9,
        muscle: 1,
        hotrod: 1,
        sport: 0.8,
        rally: 0.9,
        truck: 1,
        flatbed: 1,
        bus: 1,
        tank: 1.2,
        luxury: 0.3,
        limousine: 0.3,
        ambulance: 0.7,
        jetski: 0.5,
      };
    /* Whoever honks sets the time its horn is on for: what a pedestrian can hear (and ambience.js plays). */
    function carHorn(c, length = 0.3, double = false) {
      c.hornUntil = gameTime + length * (double ? 2.4 : 1) + 0.1;
      hornSound(c, length, double);
    }
    function carHorning(c) {
      return gameTime < (c.hornUntil || 0) || (c === player.car && actionHeld('horn'));
    }
    /* The person's fixed habits, rolled once: sight, hearing, reaction time, earbuds. */
    function carSense(p) {
      if (p.carSense) return p.carSense;
      const role = p.role,
        s = { eyes: 1, ears: 1, react: 0.36 + seededRandom() * 0.2, buds: false };
      if (role === 'elder') {
        s.react += 0.22;
        s.ears = 0.7;
      } else if (role === 'kid') {
        s.react += 0.08;
        s.eyes = 0.85;
      } else if (role === 'tourist') s.eyes = 0.85;
      else if (role === 'reveller') {
        s.react += 0.15;
        s.eyes = s.ears = 0.8;
      } else if (role === 'worker') s.react -= 0.04;
      if (seededRandom() < (role === 'jogger' || role === 'commuter' ? 0.34 : 0.12)) {
        s.buds = true;
        s.ears *= 0.15;
      }
      return (p.carSense = s);
    }
    /* What they are doing right now: how much of each sense is on the road, and the lag it adds. */
    const carAttn = { eyes: 1, ears: 1, lag: 0 };
    function carAttention(p) {
      const a = carAttn,
        kind = p.react?.kind;
      a.eyes = a.ears = 1;
      a.lag = 0;
      if (p.texting || p.pose === 'text') {
        a.eyes = 0.3;
        a.lag = 0.3;
      } else if (p.state === 'phone' || p.pose === 'phone' || p.onPhone || kind === 'call') {
        a.eyes = 0.55;
        a.ears = 0.5;
        a.lag = 0.15;
      } else if (p.state === 'chat' || p.pose === 'chat') {
        a.eyes = 0.65;
        a.ears = 0.6;
        a.lag = 0.1;
      } else if (p.state === 'shop' || p.pose === 'serve') {
        // At a shop window or a till: their mind is on it.
        a.eyes = 0.6;
        a.ears = 0.8;
        a.lag = 0.1;
      } else if (p.leader) a.eyes = a.ears = 0.85;
      if (kind === 'film' || p.pose === 'film') a.eyes *= 0.5;
      if (p.tipsy) {
        a.eyes *= 0.6;
        a.ears *= 0.6;
        a.lag += 0.25;
      }
      if (kind === 'flee' || kind === 'shelter' || kind === 'cower' || p.shakenUntil > gameTime) {
        a.eyes *= 1.25;
        a.ears *= 1.2;
        a.lag -= 0.1;
      }
      return a;
    }
    /* Awareness a second per second from sight: `off` is the angle (radians) between facing and the car. */
    function carVisualRate(off) {
      if (off <= 0.5) return 4;
      if (off <= 1.05) return 4 - ((off - 0.5) / 0.55) * 2;
      if (off <= 1.75) return 2 - ((off - 1.05) / 0.7) * 1.7;
      if (off <= 2.1) return 0.3 - ((off - 1.75) / 0.35) * 0.3;
      return 0;
    }
    /* 1 for a few seconds after someone looked both ways at a kerb, fading to 0: they see all round. */
    function carScan(p) {
      const g = p.glanceUntil;
      if (!(g > 0)) return 0;
      const since = gameTime - g;
      return since < 1.4 ? 1 : since < 2.6 ? 1 - (since - 1.4) / 1.2 : 0;
    }
    /* Awareness a second from sound at `dist` units: type, speed, horn, siren, screech; half at ~7 m. */
    function carHeard(c, speed, dist) {
      let loud = (CAR_NOISE[c.type] ?? 0.5) * (0.3 + 0.7 * clamp(speed / (60 * KMH), 0, 1.2));
      if (carHorning(c)) loud += 2;
      else if (emergencyBeacons(c)) loud += 2.5;
      if ((c === player.car ? (c.tyreSlip || 0) > 0.45 : c.sliding) || (c.skid || 0) > 0.3) loud += 1.4;
      return (loud * 2.8) / (1 + (dist / 60) ** 2);
    }
    /* How much the traffic round them (and rain) covers a car's sound, 0..0.7. */
    function carDin(p, c) {
      let n = 0;
      for (const v of vehicles) {
        if (v === c || v.hp <= 0 || Math.abs(v.x - p.x) > 260 || Math.abs(v.y - p.y) > 260 || isBoat(v)) continue;
        if (Math.abs(v.vx || 0) + Math.abs(v.vy || 0) > 20) n++;
      }
      return clamp(n * 0.12 + (weather.rain || 0) * 0.2, 0, 0.7);
    }
    /* Did this person notice that car before it reached them? (knockPerson: a cry only if so.) */
    function carNoticed(p, c) {
      const w = p.carWatch;
      return !!w && w.car === c && w.noticed >= 0;
    }
    /**
     * One look at a car coming along its line at a person in its path (nearMisses, every ~0.08 s).
     * `o`: { speed, ux, uy, along, side } (units: along the car's heading and to its left from the
     * car's centre).
     */
    function watchVehicle(p, c, o) {
      const now = gameTime;
      let w = p.carWatch;
      if (!w || w.car !== c || now - w.seen > 1.5)
        w = p.carWatch = { car: c, born: now, seen: now, aware: 0, need: 0.55 + seededRandom() * 0.85, noticed: -1, by: null, actAt: 0, outcome: null, mask: 0, maskAt: -9, los: true, losAt: -9 };
      const dt = clamp(now - w.seen, 0, 0.25);
      w.seen = now;
      if (w.outcome) return;
      const spec = vehicleSpec(c),
        heading = Math.atan2(o.uy, o.ux),
        closing = Math.max(o.speed * 0.5, o.speed - (p.walking ? 11 * Math.cos(normalizeAngle((p.a || 0) - heading)) : 0)),
        tti = (o.along - spec.l / 2 - 3) / closing;
      // Alongside or under the bumper already: it is on them, seen or not.
      if (tti <= 0) {
        w.outcome = w.noticed >= 0 ? 'late' : 'unaware';
        return;
      }
      if (w.noticed < 0) {
        const s = carSense(p),
          att = carAttention(p),
          dist = Math.hypot(c.x - p.x, c.y - p.y);
        let off = Math.abs(normalizeAngle(Math.atan2(c.y - p.y, c.x - p.x) - (p.a || 0)));
        const scan = carScan(p);
        if (scan > 0) off *= 1 - 0.75 * scan;
        if (off < 2.1 && now - w.losAt > 0.5) {
          w.los = crowdSight(p, c);
          w.losAt = now;
        }
        if (now - w.maskAt > 1) {
          w.mask = carDin(p, c);
          w.maskAt = now;
        }
        const eyes = off < 2.1 && w.los ? carVisualRate(off) * clamp(1.3 - dist / 520, 0.35, 1) * s.eyes * att.eyes : 0,
          ears = carHeard(c, o.speed, dist) * (1 - w.mask) * s.ears * att.ears;
        w.aware += (eyes + ears) * dt;
        if (w.aware < w.need) return;
        // The moment they notice it: by eye if that is what carried it, else by ear.
        w.noticed = now;
        w.by = ears > eyes ? 'ears' : 'eyes';
        w.tti = tti;
        let lag = s.react + att.lag + randomBetween(0, 0.2);
        if (w.by === 'eyes' && off < 0.5) lag -= 0.08;
        // Heard from behind: a startled turn to look before they can judge it.
        if (w.by === 'ears' && off > 1.2) {
          lag += 0.28;
          if (Math.abs(o.side) < spec.w / 2 + 4) startReaction(p, 'startle', Math.max(0.5, lag + 0.1), c, null, { then: 'hurry' });
        }
        w.actAt = now + Math.max(0.12, lag);
        return;
      }
      if (now >= w.actAt) carAct(p, c, w, o, tti, spec);
    }
    /* They have noticed it and had their reaction time: what do they do about it, with `tti` seconds left? */
    function carAct(p, c, w, o, tti, spec) {
      const kph = o.speed / KMH,
        nerve = p.nerve ?? 0.5,
        inPath = Math.abs(o.side) < spec.w / 2 + 4;
      if (c === player.car) p.sawPlayerAt = gameTime;
      // Just outside the wheel track: most watch it go by.
      if (!inPath && seededRandom() > clamp((kph - 20) / 60, 0.25, 0.8)) {
        w.outcome = 'passed';
        return;
      }
      // Too late to do anything but flinch.
      if (tti < 0.08) {
        w.outcome = 'late';
        startReaction(p, 'startle', 0.6, c, null, { then: 'hurry' });
        return;
      }
      const roll = seededRandom(),
        late = tti < 0.55,
        freezeP = 0.08 + (1 - nerve) * 0.16 + (late ? 0.1 : 0) + (p.role === 'kid' || p.role === 'elder' ? 0.1 : 0),
        backP = 0.07 + (late ? 0.06 : 0);
      if (roll < freezeP) {
        w.outcome = 'freeze';
        startReaction(p, 'freeze', randomBetween(0.9, 1.6), c, null, { then: 'hurry' });
        if (seededRandom() < 0.5) scream(p);
        return;
      }
      let side = Math.sign(o.side) || (seededRandom() < 0.5 ? -1 : 1);
      // Panic is not geometry: a few go the wrong way, into the car's path.
      if (inPath && seededRandom() < 0.08 + (late ? 0.1 : 0)) side = -side;
      const angry = (c === player.car || o.speed > 110) && nerve > 0.2,
        across = Math.atan2(o.ux * side, -o.uy * side),
        heading = Math.atan2(o.uy, o.ux),
        then = angry ? 'fist' : 'hurry';
      if (roll < freezeP + backP) {
        // Back along the path, a half-sideways stumble: rarely enough.
        w.outcome = 'back';
        startReaction(p, 'dodge', 0.5, c, null, { leap: heading + side * 0.45, car: c, then, thenExtra: { car: c }, leapV: 46, leapFor: 0.36 });
        crowdSay(p, 'dodge', 0.7);
        if (seededRandom() < 0.5) scream(p);
        return;
      }
      const calm = tti > 1.1;
      w.outcome = calm ? 'sidestep' : 'dodge';
      startReaction(p, 'dodge', calm ? 0.95 : 0.5, c, null, calm ? { leap: across, car: c, then, thenExtra: { car: c }, calm: true, leapV: 30, leapFor: 0.8 } : { leap: across, car: c, then, thenExtra: { car: c } });
      crowdSay(p, 'dodge', calm ? 0.35 : 0.7);
      if (late && seededRandom() < 0.45) scream(p);
    }
    /* Console `carAwarenessReport`: the watch the person nearest a point keeps (tests, tuning). */
    function carWatchReport(p) {
      const w = p?.carWatch;
      return w
        ? { aware: +w.aware.toFixed(2), need: +w.need.toFixed(2), noticed: w.noticed >= 0, by: w.by, outcome: w.outcome, mask: +w.mask.toFixed(2), tti: w.tti !== undefined ? +w.tti.toFixed(2) : null }
        : null;
    }
