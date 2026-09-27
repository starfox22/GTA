    // North Point Key visitors: cabs, limousines and fine cars that come over the Key bridge, round
    // the drop-off circle (a pause by the valet), and back into the city's traffic (keyRunControl).
    /* City traffic never plans onto the Key (the street ends at the circle, so
       the bridge is no exit for trafficControl). While the player is about the
       Key a few visitors are sent over instead: one spawns out of sight on the
       Key avenue's city end, drives its own lane over the bridge, goes round the
       circle anticlockwise (right-hand traffic), may stop for a few seconds by
       the valet, and leaves over the bridge; at the last junction it is handed
       to trafficControl as ordinary streamed traffic. At most KEY_VISITORS_MAX at
       once, none during a mission. The route runs through countyRouteControl
       (c.countyRoute is set, which also keeps the traffic streamer off it). */
    const KEY_VISITORS_MAX = 3,
      // Where the run starts (the south lane just past the Crown boulevard junction)
      // and where it hands back (the north lane, planned early enough for x 3200).
      KEY_RUN_START_X = 3290,
      KEY_RUN_HANDBACK_X = 3340,
      // The lanes' offsets from the centre line. The sea-wall rail at the bridge's
      // west end reaches 12 units into the deck's south side (the rail gap is not
      // centred on the row), so the lane in keeps a little north of the usual 24.
      KEY_LANE_IN = 17,
      KEY_LANE_OUT = 24,
      KEY_TYPES = { limousine: 4, luxury: 3, taxi: 3, supercar: 1.5, sedan: 1, suv: 1 };
    const keyVisitors = { lastFail: '', spawned: 0, handedBack: 0, dropOffs: 0, timer: 0, lastSpawnAt: -1e9, route: null };
    /* The run's points: the avenue in, the ring (flagged), the avenue out; `stop`
       is the index beside the valet. */
    function keyRunRoute() {
      if (keyVisitors.route) return keyVisitors.route;
      const K = NORTH_POINT_KEY,
        C = K.circle,
        meetIn = Math.sqrt(C.r * C.r - KEY_LANE_IN * KEY_LANE_IN),
        meetOut = Math.sqrt(C.r * C.r - KEY_LANE_OUT * KEY_LANE_OUT),
        points = [],
        line = (x0, x1, y) => {
          const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 40));
          for (let i = 0; i <= n; i++) points.push({ x: x0 + ((x1 - x0) * i) / n, y });
        };
      line(KEY_RUN_START_X, C.x - meetIn - 36, K.row + KEY_LANE_IN);
      const ringFrom = points.length,
        a0 = Math.atan2(KEY_LANE_IN, -meetIn),
        // Anticlockwise on the map (north up): the angle falls from the west entry to the west exit.
        sweep = a0 - Math.atan2(-KEY_LANE_OUT, -meetOut),
        steps = Math.ceil(sweep / 0.2),
        valet = -Math.acos(30 / C.r);
      let stop = -1,
        best = Infinity;
      for (let i = 0; i <= steps; i++) {
        const a = a0 - (sweep * i) / steps;
        points.push({ x: C.x + Math.cos(a) * C.r, y: C.y + Math.sin(a) * C.r, ring: true });
        if (Math.abs(a - valet) < best) {
          best = Math.abs(a - valet);
          stop = points.length - 1;
        }
      }
      const exitFrom = points.length;
      line(C.x - meetOut - 36, KEY_RUN_HANDBACK_X - 60, K.row - KEY_LANE_OUT);
      return (keyVisitors.route = { points, ringFrom, exitFrom, stop });
    }
    function keyVisitorCars() {
      return vehicles.filter((c) => c.keyRun);
    }
    /* How many visitors the hour brings (evenings are the Key's busy time). */
    function keyVisitorTarget() {
      const h = crowdHour();
      return h >= 18 || h < 1 ? 3 : h >= 8 ? 2 : 1;
    }
    /* A visitor on the start of the run, rolling. `force` ignores the view and
       `dropOff` true/false decides the pause by the valet (tests). */
    function spawnKeyVisitor(force = false, dropOff = null) {
      const R = keyRunRoute(),
        p = R.points[0];
      const fail = (why) => ((keyVisitors.lastFail = why), null);
      if (!force && crowdInView(p.x, p.y, 160)) return fail('in view');
      for (const o of vehicles) if (Math.abs(o.x - p.x) < 90 && Math.abs(o.y - p.y) < 90) return fail('car ' + o.type + ' ' + o.id + ' at ' + Math.round(o.x) + ',' + Math.round(o.y));
      const type = pickWeighted(KEY_TYPES);
      if (!canSpawnCar(type, p.x, p.y, 0, 8)) return fail('no room');
      const c = makeCar(type, p.x, p.y, 0, true, vehiclePaint(type));
      c.speed = 30 * KMH;
      c.keyRun = { index: 1, stopUntil: 0, stopped: dropOff === null ? seededRandom() < 0.35 : !dropOff, leg: 'avenue' };
      c.countyRoute = R.points;
      keyVisitors.spawned++;
      keyVisitors.lastSpawnAt = gameTime;
      return c;
    }
    /* Once a second: visitors while the player is about the Key; far ones that
       nobody can see and nobody touched go home. */
    function updateKeyVisitors(deltaSeconds) {
      if ((keyVisitors.timer -= deltaSeconds) > 0) return;
      keyVisitors.timer = 1;
      const C = NORTH_POINT_KEY.circle,
        d = Math.hypot(player.x - C.x, player.y - C.y),
        cars = keyVisitorCars();
      for (const c of cars) {
        const untouched = c.ai && c.occupied && c.hp >= c.maxhp && !c.lastAttacker && c !== player.car;
        if (d > 2400 && untouched && !crowdInView(c.x, c.y, 220)) {
          const i = vehicles.indexOf(c);
          if (i >= 0) vehicles.splice(i, 1);
        } else if (!c.ai || c.hp <= 0) {
          // Taken, wrecked or abandoned: an ordinary car from now on.
          keyVisitors.lastDropped = { id: c.id, x: Math.round(c.x), y: Math.round(c.y), ai: !!c.ai, hp: Math.round(c.hp), driverOut: !!c.driverOut, crashStop: !!c.crashStop, taken: c === player.car, at: +gameTime.toFixed(1) };
          c.keyRun = null;
          if (c.countyRoute === keyVisitors.route?.points) c.countyRoute = null;
        }
      }
      if (gameMode !== 'play' || mission || d > 1500 || gameTime - keyVisitors.lastSpawnAt < 14) return;
      if (cars.length < Math.min(KEY_VISITORS_MAX, keyVisitorTarget())) spawnKeyVisitor();
    }
    /* Drives a visitor along the run (from countyRouteControl): pure pursuit on
       the points, town pace on the avenue, a crawl round the ring, the pause by
       the valet, the car ahead and anyone in the road; the hand-back at the end. */
    function keyRunControl(c) {
      const k = c.keyRun,
        R = keyRunRoute(),
        pts = R.points,
        spec = vehicleSpec(c);
      // (Short of the drop-off the target waits at the stop until the pause is over.)
      const last = k.stopped ? pts.length - 1 : Math.min(pts.length - 1, R.stop + 1);
      while (k.index < last && Math.hypot(pts[k.index].x - c.x, pts[k.index].y - c.y) < (pts[k.index].ring ? 26 : 44)) k.index++;
      if (k.index >= R.exitFrom && (k.index >= pts.length - 1 || c.x < KEY_RUN_HANDBACK_X)) {
        // Back on the city grid: ordinary streamed traffic heading west.
        c.keyRun = null;
        c.countyRoute = null;
        c.countyIndex = 0;
        c.navAngle = Math.PI;
        c.junction = null;
        c.streamed = true;
        keyVisitors.handedBack++;
        keyVisitors.lastHandedBack = c;
        return trafficControl(c, 1 / 60);
      }
      k.leg = k.index >= R.exitFrom ? 'exit' : k.index >= R.ringFrom ? 'ring' : 'avenue';
      // Going round someone who would not clear the lane: the aim shifts sideways
      // along the run's normal by k.dodge (set below, from the last frame).
      const on = pts[k.index],
        from = pts[Math.max(0, k.index - 1)],
        runLen = Math.hypot(on.x - from.x, on.y - from.y) || 1,
        target = k.dodge ? { x: on.x - ((on.y - from.y) / runLen) * k.dodge, y: on.y + ((on.x - from.x) / runLen) * k.dodge } : on,
        da = normalizeAngle(headingBetween(c, target) - c.a),
        ringSpeed = 20 * KMH,
        brake = 0.35 * GRAVITY;
      let desired = (k.leg === 'ring' ? 20 : 38 + (c.id % 3) * 3) * KMH;
      if (k.leg === 'avenue') {
        const entry = pts[R.ringFrom];
        desired = Math.min(desired, Math.sqrt(ringSpeed ** 2 + 2 * brake * Math.max(0, Math.hypot(entry.x - c.x, entry.y - c.y) - 30)));
      }
      // The drop-off: pull up beside the valet, wait, drive on.
      if (!k.stopped && k.index >= R.stop - 4) {
        const s = pts[R.stop],
          left = Math.hypot(s.x - c.x, s.y - c.y);
        if (k.stopUntil > 0) {
          desired = 0;
          if (gameTime >= k.stopUntil) {
            k.stopped = true;
            keyVisitors.dropOffs++;
          }
        } else {
          desired = Math.min(desired, Math.sqrt(2 * brake * Math.max(0, left - 6)));
          if (left < 14 && Math.hypot(c.vx || 0, c.vy || 0) < 4 * KMH) k.stopUntil = gameTime + randomBetween(4, 8);
        }
        if (k.stopUntil > 0) k.leg = 'stop';
      }
      desired *= clamp(1 - Math.abs(da) * 0.5, 0.25, 1);
      k.holdup = null;
      // The car ahead (a wider, shorter look round the ring).
      const cos = Math.cos(c.a),
        sin = Math.sin(c.a),
        reach = k.leg === 'avenue' || k.leg === 'exit' ? 220 : 110,
        wide = k.leg === 'avenue' || k.leg === 'exit' ? 7 : 16;
      for (const o of vehicles) {
        if (o === c || (o.altitude || 0) > 15) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y;
        if (dx > reach + 40 || dx < -reach - 40 || dy > reach + 40 || dy < -reach - 40) continue;
        const along = dx * cos + dy * sin,
          side = Math.abs(-dx * sin + dy * cos);
        if (along > 0 && along < reach && side < (spec.w + vehicleSpec(o).w) / 2 + wide) {
          const lead = Math.max(0, (o.vx || 0) * cos + (o.vy || 0) * sin),
            follow = lead + Math.max(0, along - (spec.l + vehicleSpec(o).l) / 2 - 22 - lead * 0.8) * 1.2;
          if (follow < desired) {
            desired = follow;
            k.holdup = o;
          }
        }
      }
      // People on the stretch of the run just ahead (the path, not a cone: on the
      // ring a cone takes in the pavements and the island's edge). Only someone in
      // the car's own swath holds it (its half-width and a little over half a
      // metre): a walker on the pavement or the lane's edge is passed.
      const reachPath = Math.min(pts.length - 1, k.index + (k.leg === 'ring' || k.leg === 'stop' ? 6 : 3)),
        room = spec.w / 2 + 5,
        free = desired;
      let held = null;
      const yieldTo = (p) => {
        if (!(p.hp > 0) || p.altitude || (p.x - c.x) * Math.cos(c.a) + (p.y - c.y) * Math.sin(c.a) < 0) return;
        for (let i = Math.max(1, k.index); i <= reachPath; i++) {
          const a = pts[i - 1],
            b = pts[i];
          if (keyPathDistance(p.x, p.y, a, b) < room) {
            const d = distanceBetween(c, p),
              stop = Math.sqrt(2 * 0.6 * GRAVITY * Math.max(0, d - spec.l / 2 - 18));
            if (stop < desired) {
              desired = stop;
              k.holdup = p;
            }
            if (!held || d < held.d) {
              // Signed offset from the run (positive to the left of travel on the map).
              const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
              held = { p, d, side: ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len };
            }
            return;
          }
        }
      };
      forEachPedestrianNear(c.x, c.y, 150, yieldTo);
      if (!player.car) yieldTo(player);
      // Nobody waits for ever: a person holding the car up (standing at a kerb that
      // is not there, walking down the lane) gets a toot after a couple of seconds,
      // then the car creeps round them on the far side at walking pace.
      if (held && (k.dodge || desired < 4 * KMH)) {
        k.heldSince ||= gameTime;
        const waited = gameTime - k.heldSince;
        if (waited > 2 && !k.tooted) {
          k.tooted = true;
          hornSound(c, 0.25);
        }
        if (waited > 3.5) {
          if (!k.dodge || Math.abs(held.side - k.dodge) < spec.w / 2 + 3)
            k.dodge = -Math.sign(held.side || 1) * Math.min(14, Math.max(8, room + 4 - Math.abs(held.side)));
          if (Math.abs(held.side - k.dodge) >= spec.w / 2 + 3) desired = Math.min(free, 7 * KMH);
        }
      } else {
        k.heldSince = 0;
        k.tooted = false;
        k.dodge = 0;
      }
      return { steer: clamp(da * 2.5, -1.6, 1.6), desired };
    }
    function keyPathDistance(x, y, a, b) {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      return Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
    }
    function keyVisitorAhead(c) {
      let best = null;
      const look = (o, kind) => {
        const d = distanceBetween(c, o);
        if (o === c || d > 140 || Math.abs(normalizeAngle(headingBetween(c, o) - c.a)) > 0.8) return;
        if (!best || d < best.d)
          best = {
            kind: kind === 'car' ? o.type : kind,
            d: Math.round(d),
            x: Math.round(o.x),
            y: Math.round(o.y),
            ...(kind === 'person' ? { who: o.keyPerson?.role || o.cityRole?.kind || (o.guest ? 'guest' : 'walker'), react: o.react?.kind || null, walking: !!o.walking, pose: o.pose || null } : {}),
          };
      };
      for (const o of vehicles) look(o, 'car');
      forEachPedestrianNear(c.x, c.y, 140, (p) => p.hp > 0 && look(p, 'person'));
      if (!player.car) look(player, 'player');
      return best;
    }
    function keyHoldupReport(h) {
      if (!h) return null;
      const car = vehicles.includes(h);
      return {
        kind: car ? h.type : h === player ? 'player' : 'person',
        x: Math.round(h.x),
        y: Math.round(h.y),
        kmh: Math.round(Math.hypot(h.vx || 0, h.vy || 0) / KMH),
        ...(car ? { id: h.id, ai: !!h.ai, occupied: !!h.occupied, keyRun: !!h.keyRun } : { walking: !!h.walking, pose: h.pose || null }),
      };
    }
    function keyVisitorsReport() {
      const R = keyRunRoute();
      return {
        target: keyVisitorTarget(),
        spawned: keyVisitors.spawned,
        handedBack: keyVisitors.handedBack,
        dropOffs: keyVisitors.dropOffs,
        lastFail: keyVisitors.lastFail,
        lastDropped: keyVisitors.lastDropped || null,
        // The last car handed back, while it stays about (it is city traffic now).
        handed: (() => {
          const h = keyVisitors.lastHandedBack;
          if (!h || !vehicles.includes(h)) return null;
          const j = h.junction;
          return { id: h.id, x: Math.round(h.x), y: Math.round(h.y), kmh: Math.round(Math.hypot(h.vx || 0, h.vy || 0) / KMH), ai: !!h.ai, navAngle: +(h.navAngle ?? 0).toFixed(2), junction: j ? { x: j.x, y: j.y, committed: !!j.committed, turn: !!j.turn, exit: +j.exit.toFixed(2), signal: trafficSignal(j.x, j.y) } : null };
        })(),
        route: { points: R.points.length, ringFrom: R.ringFrom, exitFrom: R.exitFrom, stop: R.stop },
        cars: keyVisitorCars().map((c) => ({
          id: c.id,
          type: c.type,
          x: Math.round(c.x),
          y: Math.round(c.y),
          kmh: Math.round(Math.hypot(c.vx || 0, c.vy || 0) / KMH),
          leg: c.keyRun.leg,
          index: c.keyRun.index,
          hp: Math.round(c.hp),
          // What stands nearest in front (a person or a car), and what last set the
          // visitor's pace below its free speed (for a visitor held up).
          ahead: keyVisitorAhead(c),
          heldBy: keyHoldupReport(c.keyRun.holdup),
          waited: c.keyRun.heldSince ? +(gameTime - c.keyRun.heldSince).toFixed(1) : 0,
        })),
      };
    }
