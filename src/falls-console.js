    // Falls console: the cliff finder (cliffSpots), bail-out and parachute helpers, scripted fall and descent tests (fallsConsole).
    /**
     * CLIFF FINDER
     * Lips on the terrain fields where a walkable, drivable run-up (grade under
     * 0.3 for 10 m) meets a face that drops 8 m within the next 5 m, along one
     * of the eight key directions (so a test can walk off it with the movement
     * keys). Each is flown once as a body running off it (and as a car at 35
     * km/h) to see what the landing would be; the list is built once.
     */
    const CLIFF_DIRECTIONS = [
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
      [0, -1],
      [1, -1],
    ].map(([x, y]) => ({ x: x / Math.hypot(x, y), y: y / Math.hypot(x, y), keys: [x, y] }));
    let cliffSpotCache = null;
    // A body (or car) leaving (x, y, z) along d at `speed`: where it comes down and how hard.
    function cliffFlightPreview(x, y, z, d, speed) {
      let vz = 0;
      for (let t = 0; t < 8; t += 1 / 60) {
        vz -= GRAVITY / 60;
        z += vz / 60;
        x += (d.x * speed) / 60;
        y += (d.y * speed) / 60;
        const water = !groundAt(x, y),
          ground = water ? 0 : terrainHeight(x, y);
        if (z <= ground) {
          const s = terrainSlope(x, y),
            into = Math.max(0, (s.x * d.x * speed + s.y * d.y * speed - vz) / Math.sqrt(1 + s.x * s.x + s.y * s.y));
          return { x, y, ground, water, into, time: t };
        }
      }
      return null;
    }
    function cliffSpots() {
      if (cliffSpotCache) return cliffSpotCache;
      const raw = [];
      for (const field of TERRAIN_FIELDS) {
        const f = terrainField(field);
        for (let y = f.y0 + 100; y < f.y1 - 100; y += 20)
          for (let x = f.x0 + 100; x < f.x1 - 100; x += 20) {
            const top = terrainHeight(x, y);
            if (top < 64 || !groundAt(x, y)) continue;
            for (const d of CLIFF_DIRECTIONS) {
              const face = top - terrainHeight(x + d.x * 40, y + d.y * 40);
              if (face < 64) continue;
              const b1 = terrainHeight(x - d.x * 30, y - d.y * 30),
                b2 = terrainHeight(x - d.x * 80, y - d.y * 80),
                approach = Math.max(Math.abs(b1 - top) / 30, Math.abs(b2 - b1) / 50);
              if (approach < 0.3) raw.push({ x, y, d, top, face, approach });
            }
          }
      }
      raw.sort((a, b) => b.face - a.face);
      const spots = [];
      for (const r of raw.slice(0, 600)) {
        const clear = (r2) => {
          for (let s = 0; s <= 100; s += 10) {
            const px = r.x - r.d.x * s,
              py = r.y - r.d.y * s;
            if (!groundAt(px, py) || solid(px, py, r2)) return false;
          }
          return true;
        };
        if (!clear(8)) continue;
        const body = cliffFlightPreview(r.x, r.y, r.top, r.d, FOOT_RUN),
          car = cliffFlightPreview(r.x, r.y, r.top, r.d, 35 * KMH);
        if (!body || !car || body.water || car.water) continue;
        spots.push({
          x: Math.round(r.x),
          y: Math.round(r.y),
          heading: +Math.atan2(r.d.y, r.d.x).toFixed(3),
          keys: r.d.keys,
          topM: +worldMeters(r.top).toFixed(1),
          dropM: +worldMeters(r.top - body.ground).toFixed(1),
          bodyInto: +worldMeters(body.into).toFixed(1),
          carDropM: +worldMeters(r.top - car.ground).toFixed(1),
          carInto: +worldMeters(car.into).toFixed(1),
          carRunUp: clear(15) && canSpawnCar('sedan', r.x - r.d.x * 90, r.y - r.d.y * 90, Math.atan2(r.d.y, r.d.x)),
          approach: +r.approach.toFixed(2),
          trail: onMountainTrail(r.x, r.y),
          // Metres of ground along the way off, every 2.5 m from 5 m before the lip.
          profile: Array.from({ length: 40 }, (_, i) => +worldMeters(terrainHeight(r.x + r.d.x * (i * 20 - 40), r.y + r.d.y * (i * 20 - 40))).toFixed(1)),
        });
      }
      return (cliffSpotCache = spots);
    }
    /* The best spot for a test: 'lethal' (a body running off it comes down hard
       enough to die, over 20 m/s at the first landing) or 'car' (the biggest
       drop with room for a car's run-up). */
    function cliffSpot(kind = 'lethal') {
      const spots = cliffSpots().filter((s) => !s.trail);
      const pick =
        kind === 'car'
          ? spots.filter((s) => s.carRunUp).sort((a, b) => b.carDropM - a.carDropM)[0]
          : spots.filter((s) => s.bodyInto > 20).sort((a, b) => a.approach - b.approach || b.bodyInto - a.bodyInto)[0];
      return pick ? { ...pick, candidates: spots.length } : { candidates: spots.length };
    }
    // The movement actions for one of the eight directions (screen: +y is down, the back key).
    function directionActions(kx, ky) {
      return [kx > 0 ? 'right' : kx < 0 ? 'left' : null, ky > 0 ? 'back' : ky < 0 ? 'forward' : null].filter(Boolean);
    }
    function holdMovement(actions) {
      for (const id of ['forward', 'back', 'left', 'right']) keys[actionCode(id)] = actions.includes(id);
    }
    function fallStateReport() {
      const c = player.car,
        p = player.parachute;
      return {
        mode: gameMode,
        hp: Math.max(0, Math.round(player.hp)),
        x: Math.round(player.x),
        y: Math.round(player.y),
        altitudeM: +worldMeters(entityElevation(player)).toFixed(1),
        groundM: +worldMeters(terrainHeight(player.x, player.y)).toFixed(1),
        falling: player.fall ? { time: +player.fall.time.toFixed(2), vzMs: +worldMeters(player.fall.vz).toFixed(1) } : null,
        tumbling: !!player.tumble,
        splat: player.splat && gameTime - player.splat.at < 10 ? player.splat : null,
        parachute: p ? parachuteReport() : null,
        vehicle: c
          ? {
              type: c.type,
              hp: Math.round(c.hp),
              airborne: !!c.cliffAir,
              overturned: c.overturned ? (Math.abs(c.overturned.roll) > 2 ? 'roof' : 'side') : null,
            }
          : null,
        impacts: fallLog.slice(-4),
        vehicleLandings: cliffLog.slice(-4),
      };
    }
    function parachuteReport() {
      const p = player.parachute;
      if (!p) return null;
      const cue = parachuteCueState();
      return {
        stage: p.stage,
        armed: !!p.armed,
        phase: p.stage === 'canopy' ? p.phase : null,
        deployS: p.stage === 'canopy' ? +p.deploy.toFixed(2) : null,
        opening: +p.opening.toFixed(2),
        aglM: +worldMeters(Math.max(0, player.altitude - parachuteFloor(player.x, player.y))).toFixed(1),
        altitudeM: +worldMeters(player.altitude).toFixed(1),
        descentMs: +worldMeters(-p.vz).toFixed(1),
        loadG: +(p.load ?? 1).toFixed(2),
        peakLoadG: p.peakLoad != null ? +p.peakLoad.toFixed(2) : null,
        from: p.from,
        openedAtM: p.openedAt ?? null,
        pullMs: p.pullRate != null ? +worldMeters(p.pullRate).toFixed(1) : null,
        openAtM: p.openAt ?? null,
        openTimeS: p.openTime ?? null,
        openLostM: p.openLost ?? null,
        safeLostM: p.safeLost ?? null,
        safeTimeS: p.safeTime ?? null,
        brakesSet: p.stage === 'canopy' ? !!p.brakesSet : null,
        flownS: p.flown != null ? +p.flown.toFixed(2) : null,
        cue: cue ? { state: cue.state, needM: +worldMeters(cue.need).toFixed(1), seconds: +cue.seconds.toFixed(2) } : null,
      };
    }
    /* Console: step the jump at 30 Hz (as simulate does) until the height above
       the ground is down to `target` metres or, for a word, until the cue shows that
       state (soon, now, danger, opening, short) or the deployment reaches that
       phase (lines, snivel, snap, open); at most 120 s, or until the jump ends. */
    function parachuteFallTo(target) {
      const reached = () => {
        const p = player.parachute;
        if (!p) return true;
        if (typeof target === 'number') return worldMeters(player.altitude - parachuteFloor(player.x, player.y)) <= target;
        const cue = parachuteCueState();
        return (cue && cue.state === target) || (p.stage === 'canopy' && p.phase === target);
      };
      const steppedS = stepFor(120, () => !reached());
      return { steppedS, ...(parachuteReport() || { landed: true }) };
    }
    // Put the player on foot at (x, y), healed, nothing chasing them.
    function stagePlayer(x, y) {
      teleportPlayer(x, y);
      player.hp = 100;
      player.godMode = false;
      player.inv = 0;
      keys = {};
      shake = 0;
      if (gameMode === 'dead') gameMode = 'play';
    }
    function stepFor(seconds, each) {
      const dt = 1 / 30;
      let t = 0;
      for (; t < seconds && gameMode === 'play'; t += dt) {
        if (each && each(t) === false) break;
        update(dt);
      }
      return +t.toFixed(2);
    }
    /* A line-following pilot down (or along) a path of [x, y] points in the
       player's vehicle, easing off for bends (after offroad-club.js trailPilot). */
    function drivePath(path, seconds, maxKmh) {
      const c = player.car,
        n = path.length - 1;
      let idx = 0,
        nearest = Infinity,
        best = 0,
        bestAt = 0,
        backing = 0,
        stall = 0,
        reason = 'time',
        minHp = c.hp,
        airborne = 0,
        maxKmh2 = 0;
      for (let i = 0; i <= n; i++) {
        const d = Math.hypot(path[i][0] - c.x, path[i][1] - c.y);
        if (d < nearest) {
          nearest = d;
          idx = i;
        }
      }
      const heading = (i) => Math.atan2(path[Math.min(n, i + 1)][1] - path[Math.min(n, i)][1], path[Math.min(n, i + 1)][0] - path[Math.min(n, i)][0]);
      const time = stepFor(seconds, (t) => {
        if (player.car !== c || c.hp <= 0) {
          reason = 'lost vehicle';
          return false;
        }
        for (let k = 0; k < 6 && idx < n; k++) {
          if (Math.hypot(path[idx + 1][0] - c.x, path[idx + 1][1] - c.y) <= Math.hypot(path[idx][0] - c.x, path[idx][1] - c.y) + 2) idx++;
          else break;
        }
        if (idx > best) {
          best = idx;
          bestAt = t;
        }
        if (idx >= n - 2) {
          reason = 'end';
          return false;
        }
        if (t - bestAt > 14) {
          reason = 'stuck';
          return false;
        }
        const kmh = (c.speed || 0) / KMH,
          tight = Math.abs(normalizeAngle(heading(idx + 6) - heading(idx))) > 1.1,
          look = Math.min(n, idx + (tight ? 2 : 4 + Math.floor(Math.max(0, kmh) / 8))),
          err = normalizeAngle(Math.atan2(path[look][1] - c.y, path[look][0] - c.x) - c.a);
        // Downhill the brakes need room: look for bends over the stopping distance
        // at 2.5 m/s^2 plus 4 m, and take them slower than a climb would.
        let bend = 0,
          ahead = 0;
        const h0 = heading(idx),
          reach = 32 + Math.max(0, c.speed || 0) ** 2 / (2 * 2.5 * UNITS_PER_METRE);
        for (let j = idx + 1; j < n && ahead < reach; j++) {
          ahead += Math.hypot(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]);
          bend = Math.max(bend, Math.abs(normalizeAngle(heading(j) - h0)));
        }
        const desired = Math.min(maxKmh, bend > 2.2 ? 7 : bend > 1.3 ? 11 : bend > 0.6 ? 18 : maxKmh, Math.abs(err) > 0.45 ? 8 : maxKmh);
        stall = actionHeld('forward') && Math.abs(kmh) < 1 ? stall + 1 / 30 : 0;
        if (stall > 1.5) backing = 1.4;
        if (backing <= 0 && Math.abs(err) >= 1.5 && Math.abs(kmh) < 6) backing = 1.2;
        const hold = [];
        if (backing > 0) {
          backing -= 1 / 30;
          hold.push('back');
          if (err < 0) hold.push('right');
          if (err > 0) hold.push('left');
        } else {
          if (kmh < desired - 1 && Math.abs(err) < 1.6) hold.push('forward');
          if (kmh > desired + 2 || (Math.abs(err) >= 1.6 && kmh > 4)) hold.push('back');
          if (err > 0.05) hold.push('right');
          if (err < -0.05) hold.push('left');
        }
        holdMovement(hold);
        if (c.cliffAir) airborne += 1 / 30;
        minHp = Math.min(minHp, c.hp);
        maxKmh2 = Math.max(maxKmh2, kmh);
      });
      holdMovement([]);
      return { reason, seconds: time, progress: +(best / n).toFixed(3), minHp: Math.round(minHp), airborneS: +airborne.toFixed(2), maxKmh: Math.round(maxKmh2) };
    }
    /* Walk a path on foot (eight-way keys toward a point a few steps ahead). */
    function walkPath(path, seconds) {
      const n = path.length - 1;
      let idx = 0,
        nearest = Infinity,
        minHp = player.hp,
        falls = 0,
        tumbles = 0,
        reason = 'time';
      for (let i = 0; i <= n; i++) {
        const d = Math.hypot(path[i][0] - player.x, path[i][1] - player.y);
        if (d < nearest) {
          nearest = d;
          idx = i;
        }
      }
      const time = stepFor(seconds, () => {
        for (let k = 0; k < 8 && idx < n; k++) {
          if (Math.hypot(path[idx + 1][0] - player.x, path[idx + 1][1] - player.y) <= Math.hypot(path[idx][0] - player.x, path[idx][1] - player.y) + 1) idx++;
          else break;
        }
        if (idx >= n - 1) {
          reason = 'end';
          return false;
        }
        const look = Math.min(n, idx + 2),
          a = Math.atan2(path[look][1] - player.y, path[look][0] - player.x),
          dx = Math.cos(a),
          dy = Math.sin(a);
        holdMovement(directionActions(Math.abs(dx) > 0.38 ? Math.sign(dx) : 0, Math.abs(dy) > 0.38 ? Math.sign(dy) : 0));
        if (player.fall) falls++;
        if (player.tumble) tumbles++;
        minHp = Math.min(minHp, player.hp);
      });
      holdMovement([]);
      return { reason, seconds: time, progress: +(idx / n).toFixed(3), minHp: Math.round(Math.max(0, minHp)), fallFrames: falls, tumbleFrames: tumbles };
    }
    // The county road through the range with the biggest climb: its points from the top down.
    function steepestMountainRoad() {
      let best = null;
      for (const road of COUNTY_ROADS) {
        const heights = road.points.map(([x, y]) => terrainHeight(x, y)),
          range = Math.max(...heights) - Math.min(...heights);
        if (!best || range > best.range) best = { road, range, heights };
      }
      if (!best || best.range < 40) return null;
      const top = best.heights.indexOf(Math.max(...best.heights)),
        down = best.heights[0] < best.heights[best.heights.length - 1] ? best.road.points.slice(0, top + 1).reverse() : best.road.points.slice(top);
      // Every ~8 units along it, for the pilot.
      const path = [];
      for (let i = 1; i < down.length; i++) {
        const [ax, ay] = down[i - 1],
          [bx, by] = down[i],
          steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
        for (let s = 0; s < steps; s++) path.push([ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps]);
      }
      path.push(down[down.length - 1]);
      return { name: best.road.name, rangeM: +worldMeters(best.range).toFixed(1), path };
    }
    /* Scripted runs through the real game step, each from a fresh stand:
       'drop' lets the player fall `arg` metres onto flat ground (the body scale);
       'walk-cliff' runs off a lethal drop; 'walk-trail' walks the Mount Ascent
       trail down from the summit; 'drive-cliff' drives a sedan off the biggest
       drop; 'drive-trail' brings a 4x4 down the trail; 'drive-road' a sedan
       down the steepest county road through the range. `arg` is otherwise the
       time limit in seconds. */
    function fallTest(kind = 'walk-cliff', arg) {
      terrainField(TERRAIN_FIELDS[0]);
      const since = fallSeq,
        seconds = kind === 'drop' ? 0 : arg;
      if (kind === 'drop') {
        // Straight down onto the ground at the spawn point: nothing but the drop.
        const metres = clamp(Number(arg) || 10, 0.5, 400);
        stagePlayer(spawn.x, spawn.y);
        startPlayerFall(player.x, player.y, terrainHeight(player.x, player.y) + metres * UNITS_PER_METRE, 1 / 30);
        player.fall.vx = player.fall.vy = 0;
        const time = stepFor(30, () => !!player.fall);
        return { kind, metres, seconds: time, ...fallStateReport() };
      }
      if (kind === 'walk-cliff') {
        const s = cliffSpot('lethal');
        if (s.x === undefined) return { error: 'no cliff found', ...s };
        stagePlayer(s.x - Math.cos(s.heading) * 40, s.y - Math.sin(s.heading) * 40);
        const hold = directionActions(...s.keys);
        let fell = false;
        const time = stepFor(seconds || 10, () => {
          holdMovement(player.fall || fell ? [] : hold);
          if (player.fall) fell = true;
          return !(fell && !player.fall && !player.tumble);
        });
        holdMovement([]);
        return { kind, spot: s, fell, seconds: time, ...fallStateReport() };
      }
      if (kind === 'walk-trail') {
        const path = MOUNTAIN_TRAILS[0].path.slice().reverse();
        stagePlayer(path[2][0], path[2][1]);
        const run = walkPath(path, seconds || 110);
        return { kind, ...run, ...fallStateReport() };
      }
      if (kind === 'drive-cliff') {
        const s = cliffSpot('car');
        if (s.x === undefined) return { error: 'no cliff found', ...s };
        stagePlayer(s.x - Math.cos(s.heading) * 140, s.y - Math.sin(s.heading) * 140);
        const car = makeCar('sedan', s.x - Math.cos(s.heading) * 90, s.y - Math.sin(s.heading) * 90, s.heading, false);
        car.authorized = true;
        enterVehicle(car);
        let flew = false,
          landedAt = null;
        const time = stepFor(seconds || 14, (t) => {
          if (player.car !== car) return false;
          if (car.cliffAir) flew = true;
          else if (flew && landedAt === null) landedAt = t;
          if (landedAt !== null && t - landedAt > 1.5 && (Math.hypot(car.vx, car.vy) < 30 || car.hp <= 0)) return false;
          const err = normalizeAngle(s.heading - car.a);
          holdMovement(flew ? [] : ['forward', ...(err > 0.03 ? ['right'] : err < -0.03 ? ['left'] : [])]);
        });
        holdMovement([]);
        return {
          kind,
          spot: s,
          flew,
          seconds: time,
          car: { hp: Math.round(car.hp), destroyed: car.hp <= 0, overturned: car.overturned ? (Math.abs(car.overturned.roll) > 2 ? 'roof' : 'side') : null, airborne: !!car.cliffAir },
          ...fallStateReport(),
          vehicleLandings: cliffLog.slice(-6),
        };
      }
      if (kind === 'drive-trail' || kind === 'drive-road') {
        const road = kind === 'drive-road' ? steepestMountainRoad() : { name: MOUNTAIN_TRAILS[0].name, path: MOUNTAIN_TRAILS[0].path.slice().reverse() };
        if (!road) return { error: 'no mountain road' };
        const path = road.path,
          start = path[Math.min(4, path.length - 1)],
          next = path[Math.min(12, path.length - 1)];
        stagePlayer(start[0] + 30, start[1] + 30);
        const car = makeCar(kind === 'drive-road' ? 'sedan' : 'suv', start[0], start[1], Math.atan2(next[1] - start[1], next[0] - start[0]), false);
        car.authorized = true;
        enterVehicle(car);
        const run = drivePath(path, seconds || 150, kind === 'drive-road' ? 70 : 28);
        return {
          kind,
          road: road.name,
          rangeM: road.rangeM,
          ...run,
          car: { type: car.type, hp: Math.round(car.hp), maxhp: car.maxhp, overturned: !!car.overturned },
          newLandings: cliffLog.filter((l) => l.seq > since),
          ...fallStateReport(),
        };
      }
      throw Error('fallTest kinds: drop, walk-cliff, walk-trail, drive-cliff, drive-trail, drive-road');
    }
    /* Console: bail out over the player at `metres` above the ground (a fresh
       helicopter, boarded and jumped from), the parachute and fall state. */
    function consoleBailOut(metres = 400, x = player.x, y = player.y, heading = player.a) {
      stagePlayer(x, y);
      const heli = spawnClearCar('helicopter', x, y, heading, false);
      heli.authorized = true;
      enterVehicle(heli);
      heli.altitude = terrainHeight(heli.x, heli.y) + metres * UNITS_PER_METRE;
      heli.vx = heli.vy = 0;
      bailOut();
      return parachuteReport();
    }
    function fallsConsole() {
      return {
        // Jump from a fresh helicopter `metres` above the ground at (x, y), facing `heading` (default: here, as the player faces).
        bailOut: (metres, x, y, heading) => consoleBailOut(metres, x, y, heading),
        // Pull the ripcord as a fresh press of the bail key would (freefall only).
        openParachute: () => (openParachuteByHand(), parachuteReport()),
        // Stage, deployment phase and load, height above ground, descent rate, where it was pulled and fully open, the cue's state and the height it needs.
        parachuteState: () => parachuteReport(),
        // Step the jump until `target` metres above the ground, or a cue state / deployment phase by name.
        parachuteFallTo: (target) => parachuteFallTo(target),
        // The player's fall: altitude, ground, falling / tumbling, the last impacts and vehicle landings.
        fallState: () => fallStateReport(),
        // A cliff to test on: 'lethal' or 'car' (see CLIFF FINDER), with the profile of the way down.
        cliffSpot: (kind) => cliffSpot(kind),
        // Scripted runs: 'drop' (metres), 'walk-cliff', 'walk-trail', 'drive-cliff', 'drive-trail', 'drive-road' (seconds).
        fallTest: (kind, arg) => fallTest(kind, arg),
      };
    }
