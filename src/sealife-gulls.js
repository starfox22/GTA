    // Gulls (updateGulls) and the shark's setup: encounters, beach alarm and placement.
    /* Who a perched gull minds: the player on foot, their vehicle, anyone firing. */
    function gullScared(g) {
      const threat = player.car || player,
        d = Math.hypot(threat.x - g.x, threat.y - g.y),
        dz = Math.abs(entityElevation(threat) - g.z);
      if (dz > 60) return false;
      const moving = player.car ? Math.abs(player.car.speed || 0) : player.swimming ? 0 : footPace();
      const reach = player.car ? 70 + moving * 0.4 : 42 + moving * 0.9;
      if (d < reach) return true;
      return shotCooldownSeconds > 0 && d < 380;
    }
    function gullTakeOff(g) {
      if (g.perch) g.perch.taken = null;
      g.perch = null;
      g.mode = 'flee';
      g.fold = 0;
      g.vz = (3.5 + Math.random() * 2) * UNITS_PER_METRE;
      g.speed = 6 * UNITS_PER_METRE;
      const threat = player.car || player;
      g.a = Math.atan2(g.y - threat.y, g.x - threat.x) + (Math.random() - 0.5) * 1.2;
      g.timer = 2.5 + Math.random() * 1.5;
      g.flapping = 3;
      if (gameTime - g.calledAt > 3 && Math.random() < 0.5) {
        g.calledAt = gameTime;
        gullCallAt(g, 1);
      }
    }
    /* Steer a flying gull toward a point: banked turns, climb and descent, flap or glide. */
    function gullFly(g, tx, ty, tz, deltaSeconds, cruise = 9 * UNITS_PER_METRE) {
      const desired = Math.atan2(ty - g.y, tx - g.x),
        turn = clamp(normalizeAngle(desired - g.a), -1.3 * deltaSeconds, 1.3 * deltaSeconds);
      g.a = normalizeAngle(g.a + turn);
      const rate = turn / Math.max(1e-4, deltaSeconds);
      g.bank += (clamp((rate * g.speed) / GRAVITY, -0.9, 0.9) - g.bank) * Math.min(1, deltaSeconds * 3);
      g.speed += (cruise - g.speed) * Math.min(1, deltaSeconds * 0.8);
      const climb = clamp((tz - g.z) * 0.6, -3 * UNITS_PER_METRE, 2.5 * UNITS_PER_METRE);
      g.vz += (climb - g.vz) * Math.min(1, deltaSeconds * 2);
      g.x += Math.cos(g.a) * g.speed * deltaSeconds;
      g.y += Math.sin(g.a) * g.speed * deltaSeconds;
      g.z += g.vz * deltaSeconds;
      g.pitch = clamp(g.vz / Math.max(20, g.speed), -0.5, 0.5);
      // Flap to climb or keep speed; otherwise long glides with bursts between.
      if (g.flapping > 0) g.flapping -= deltaSeconds;
      else if (g.vz > 1.2 * UNITS_PER_METRE || g.speed < cruise * 0.75) g.flapping = 0.8 + Math.random() * 1.2;
      else {
        g.glideFor -= deltaSeconds;
        if (g.glideFor <= 0) {
          g.glideFor = 3 + Math.random() * 6;
          g.flapping = 0.6 + Math.random() * 1.4;
        }
      }
    }
    function gullAnimate(g, deltaSeconds) {
      if (g.mode === 'perch') {
        g.flap = 0;
        g.fold += (1 - g.fold) * Math.min(1, deltaSeconds * 6);
        return;
      }
      g.fold += (0 - g.fold) * Math.min(1, deltaSeconds * 8);
      if (g.flapping > 0) {
        // About three wingbeats a second, a little quicker climbing away.
        g.flapPhase += deltaSeconds * TAU * (g.mode === 'flee' ? 3.8 : 3);
        g.flap = Math.sin(g.flapPhase) * 0.62 + 0.08;
      } else {
        // Gliding: wings held in a shallow dihedral, the odd adjustment.
        g.flap += (0.1 + Math.sin(gameTime * 0.7 + g.id) * 0.04 - g.flap) * Math.min(1, deltaSeconds * 4);
      }
    }
    function gullCallAt(g, strength) {
      if (daylight() < 0.05 && strength < 1) return;
      gullCallSound(g, strength);
    }
    /* A boat worth following: moving, near a gull flock or the coast, not too fast. */
    function gullFollowTargets() {
      const list = [];
      const c = player.car;
      if (isBoat(c) && Math.abs(c.speed || 0) > 3 * KNOTS && Math.abs(c.speed || 0) < 30 * KNOTS) list.push(c);
      const v = typeof drawbridge !== 'undefined' ? drawbridge.vessel : null;
      if (v && (v.speed || 0) > 1) list.push(v);
      for (const s of LINERS) if (s.voyage && (s.speed || 0) > 2 * KNOTS) list.push(s);
      return list;
    }
    function updateGulls(deltaSeconds) {
      const viewer = seaViewer(),
        day = gullDayShare(),
        vx = viewer.x,
        vy = viewer.y;
      // Flocks come and go with the view (and the flock's share of the hour).
      for (const f of GULL_FLOCKS) {
        const near = Math.hypot(f.x - vx, f.y - vy) < 1500 + f.r;
        f.active = near;
        if (!near) {
          for (const g of gulls)
            if (g.flock === f && !g.follow) {
              if (g.perch) g.perch.taken = null;
              g.perch = null;
              g.flock = null;
              g.mode = 'off';
            }
          continue;
        }
        let flying = 0,
          perched = 0;
        for (const g of gulls)
          if (g.flock === f) {
            if (g.mode === 'perch') perched++;
            else flying++;
          }
        const wantFly = Math.round(f.fly * day),
          wantPerch = f.perch + (f.fly - wantFly);
        // One more gull at a time: a flier while the flock is short of them, a
        // percher while there is a free perch; never more than the flock's size.
        const perches = gullPerches(f),
          room = flying + perched < f.fly + f.perch,
          wantsPercher = perched < Math.min(wantPerch, perches.length) && perches.some((p) => !p.taken);
        if (room && (flying < wantFly || wantsPercher)) {
          const free = gulls.find((g) => g.mode === 'off');
          if (free) gullAssign(f, free, flying >= wantFly || (wantsPercher && Math.random() < 0.5));
        } else if (flying > wantFly + 1) {
          // Dusk: a flier goes to roost.
          const g = gulls.find((q) => q.flock === f && q.mode === 'circle');
          if (g) {
            g.mode = 'return';
            g.timer = 0;
          }
        }
      }
      // A few gulls pick up a working boat and hang over its wake.
      gullFollowClock -= deltaSeconds;
      if (gullFollowClock <= 0) {
        gullFollowClock = 3;
        for (const boat of gullFollowTargets()) {
          if (Math.hypot(boat.x - vx, boat.y - vy) > 1600 || daylight() < 0.15) continue;
          const already = gulls.filter((g) => g.follow === boat).length,
            want = boat.l > 600 ? 6 : 4;
          if (already >= want) continue;
          const g = gulls.find((q) => q.mode === 'circle' && q.flock && Math.hypot(q.x - boat.x, q.y - boat.y) < 1200) || gulls.find((q) => q.mode === 'off');
          if (!g) continue;
          if (g.mode === 'off') {
            g.flock = null;
            g.x = boat.x + (Math.random() - 0.5) * 300;
            g.y = boat.y + (Math.random() - 0.5) * 300;
            g.z = 160;
            g.speed = 9 * UNITS_PER_METRE;
          }
          g.mode = 'follow';
          g.follow = boat;
          g.followOffset = { back: 30 + Math.random() * 70, side: (Math.random() - 0.5) * 70, z: 90 + Math.random() * 110, wobble: Math.random() * TAU };
          g.timer = 40 + Math.random() * 60;
        }
      }
      for (const g of gulls) {
        if (g.mode === 'off') continue;
        g.timer -= deltaSeconds;
        switch (g.mode) {
          case 'perch': {
            if (gullScared(g)) {
              gullTakeOff(g);
              break;
            }
            // A shuffle round on the rail now and then; a call over a busy beach.
            if (g.timer <= 0) {
              g.timer = 4 + Math.random() * 14;
              g.a += (Math.random() - 0.5) * 1.6;
              if (Math.random() < 0.12) gullCallAt(g, 0.5);
            }
            break;
          }
          case 'flee': {
            gullFly(g, g.x + Math.cos(g.a) * 100, g.y + Math.sin(g.a) * 100, g.z + 60, deltaSeconds, 8 * UNITS_PER_METRE);
            if (g.timer <= 0) {
              if (g.flock) {
                g.mode = 'circle';
                gullNewOrbit(g);
                g.orbit.until = gameTime + 15 + Math.random() * 25;
                g.wantPerch = true;
              } else g.mode = 'off';
            }
            break;
          }
          case 'circle': {
            const o = g.orbit;
            o.t += (o.dir * g.speed * deltaSeconds) / o.r;
            gullFly(g, o.x + Math.cos(o.t + o.dir * 0.5) * o.r, o.y + Math.sin(o.t + o.dir * 0.5) * o.r, o.z + Math.sin(gameTime * 0.3 + g.id) * 20, deltaSeconds);
            if (gameTime > o.until) {
              if (g.wantPerch || (g.flock && daylight() < 0.1)) {
                g.mode = 'return';
                g.wantPerch = false;
              } else gullNewOrbit(g);
            }
            if (Math.random() < deltaSeconds * 0.02 && gameTime - g.calledAt > 8) {
              g.calledAt = gameTime;
              gullCallAt(g, 0.6);
            }
            break;
          }
          case 'return': {
            // Back to a free perch, if the one who scared it has gone.
            if (!g.flock) {
              g.mode = 'off';
              break;
            }
            if (!g.perch) {
              const threat = player.car || player,
                free = gullPerches(g.flock).filter((p) => !p.taken && Math.hypot(p.x - threat.x, p.y - threat.y) > 140);
              if (!free.length) {
                g.mode = 'circle';
                gullNewOrbit(g);
                break;
              }
              g.perch = free[Math.floor(Math.random() * free.length)];
              g.perch.taken = g;
            }
            const p = g.perch,
              d = Math.hypot(p.x - g.x, p.y - g.y);
            gullFly(g, p.x, p.y, p.z + Math.min(80, d * 0.35), deltaSeconds, clamp(d * 0.25, 3 * UNITS_PER_METRE, 9 * UNITS_PER_METRE));
            if (d < 30) {
              // The flare: wings up and beating, dropping onto the perch.
              g.flapping = 0.4;
              const k = Math.min(1, deltaSeconds * 4);
              g.x += (p.x - g.x) * k;
              g.y += (p.y - g.y) * k;
              g.z += (p.z - g.z) * k;
              if (d < 3 && Math.abs(g.z - p.z) < 2) {
                g.mode = 'perch';
                g.x = p.x;
                g.y = p.y;
                g.z = p.z;
                g.bank = g.pitch = 0;
                g.timer = 5 + Math.random() * 15;
              }
            }
            if (gullScared(g) && d < 60) {
              if (g.perch) g.perch.taken = null;
              g.perch = null;
              gullTakeOff(g);
            }
            break;
          }
          case 'follow': {
            const b = g.follow,
              o = g.followOffset;
            const gone = !b || (b.hp !== undefined && b.hp <= 0) || Math.abs(b.speed || 0) < 1 || g.timer <= 0 || Math.hypot(b.x - vx, b.y - vy) > 2000;
            if (gone) {
              g.follow = null;
              if (g.flock) {
                g.mode = 'circle';
                gullNewOrbit(g);
              } else g.mode = 'flee';
              g.timer = 4;
              break;
            }
            const len = b.l || (b.type ? vehicleSpec(b).l : 90),
              back = len * 0.5 + o.back,
              c = Math.cos(b.a),
              s = Math.sin(b.a),
              w = Math.sin(gameTime * 0.6 + o.wobble);
            gullFly(g, b.x - c * back - s * (o.side + w * 25), b.y - s * back + c * (o.side + w * 25), o.z + Math.sin(gameTime * 0.9 + o.wobble) * 25, deltaSeconds, Math.max(8 * UNITS_PER_METRE, Math.abs(b.speed || 0) * 1.05));
            if (Math.random() < deltaSeconds * 0.06 && gameTime - g.calledAt > 5) {
              g.calledAt = gameTime;
              gullCallAt(g, 0.8);
            }
            break;
          }
        }
        gullAnimate(g, deltaSeconds);
      }
    }
    // ============================================================================
    /**
     * THE GREAT WHITE
     * One shark, about 5 m. While the viewer is near deep water it patrols it
     * (SHARK_WATER from land, never in a harbour), mostly 4-5 m down, where it
     * reads as a long dark shape under the surface. Every minute or so it cruises
     * up with the dorsal fin cutting the water and a wake off it, for anyone on a
     * boat or the beach to see. Now and then (rarely) it makes a pass along the
     * beach just outside the buoy line, which starts the beach's SHARK! alarm.
     *
     * THE ENCOUNTER ("occasionally eat me if I'm swimming")
     * Interest builds only while the player swims in deep water: more than
     * SHARK_DEEP_SWIM from land, outside the beach's buoys, not in a harbour
     * or the Marea pool, not during a mission, and not within SHARK_COOLDOWN of
     * the last encounter. It grows faster the farther out, with hard crawling
     * (splashing), at night and when bleeding; it takes about half a minute or
     * more. Then:
     *   approach  the fin appears offshore (never between the player and the
     *             nearest way out), the score starts, SHARK! and an arrow
     *   circle    it circles, closer and closer; the window is sized from the
     *             swim to the nearest way out (a beach, rocks, a ladder, a boat)
     *             so a player who heads for it at once makes it
     *   dive      the fin goes under; a shape rises beneath the swimmer
     *   breach    it lunges up out of the water, jaws open, and takes them:
     *             a huge splash, the water turns red, WASTED. In god mode it
     *             bites down, finds nothing it can hurt, lets go and leaves.
     *   escape    out of the water, on a ladder, aboard a boat or back inside
     *             the buoy line in time: the shark loses interest and leaves
     * Beach swimmers are never taken. A small boat idling in deep water may get
     * a bump from below (a jolt and a scare, no damage) and a look at the fin.
     */
    const shark = {
      active: false,
      x: 0,
      y: 0,
      z: SEA_SURFACE - 34,
      a: 0,
      pitch: 0,
      roll: 0,
      speed: 12,
      phase: 0,
      mouth: 0,
      mode: 'patrol',
      waypoint: null,
      depth: SEA_SURFACE - 34,
      finClock: 25,
      finFor: 0,
      finUp: 0,
      beachPass: null,
      beachPassClock: 150,
      bumpFor: 0,
      bumpClock: 0,
      circle: null,
      spawnClock: 0,
    };
    const sharkEncounter = {
      phase: 'none',
      t: 0,
      window: 0,
      interest: 0,
      cooldown: 90,
      exit: null,
      orbit: 0,
      radius: 0,
      bite: false,
      taken: false,
      god: false,
      last: null,
      count: 0,
      escapes: 0,
      attacks: 0,
    };
    let beachAlarm = { until: 0, started: 0, whistleAt: 0, shoutAt: 0, speakers: [] };
    function sharkPlace(x, y, a) {
      shark.x = x;
      shark.y = y;
      shark.a = a;
      shark.active = true;
      shark.waypoint = null;
    }
    function sharkSpawnNear(viewer) {
      const p = seaPointNear(viewer.x, viewer.y, 900, 1900, SHARK_WATER, 20);
      if (!p) return false;
      sharkPlace(p.x, p.y, Math.random() * TAU);
      shark.z = shark.depth = SEA_SURFACE - 30 - Math.random() * 10;
      shark.mode = 'patrol';
      return true;
    }
    /**
     * How far a point in the sea is out from Palm Keys Beach's waterline
     * (Infinity off the strand). water.js's beachShelfDistance only reaches a
     * shore cell (128 units); the buoy line lies 178 out.
     */
    function beachOffshore(x, y) {
      if (x < BEACH.polygon[0][0] - 60 || x > BEACH.polygon[1][0] + 60 || y < 5300 || typeof shoreAt !== 'function') return Infinity;
      if (landAt(x, y)) return 0;
      const p = shoreAt(shoreS(x));
      return Math.hypot(x - p.x, y - p.y);
    }
    /* Is the player in the shark's water? (see THE ENCOUNTER) */
    function sharkWaterForPlayer() {
      if (!player.swimming || player.pool || player.climbing || player.car || player.parachute) return false;
      if (seaNoGo(player.x, player.y)) return false;
      if (beachOffshore(player.x, player.y) < SHARK_BUOY_CLEAR) return false;
      return seaDistance(player.x, player.y) > SHARK_DEEP_SWIM;
    }
    /* Somewhere the swimmer counts as out of reach. */
    function sharkPlayerSafe() {
      if (gameMode !== 'play') return false;
      if (!player.swimming || player.climbing || player.car || player.pool) return true;
      return beachOffshore(player.x, player.y) < SHARK_BUOY_CLEAR - 30;
    }
    /* The nearest way out for the fairness window: a ladder, a beach or rocks, or a boat in reach. */
    function sharkNearestExit() {
      let best = nearestWaterExit(player.x, player.y);
      for (const c of vehicles)
        if (isBoat(c) && c.hp > 0 && !c.cop) {
          const d = distanceBetween(c, player);
          if (!best || d < best.d) best = { x: c.x, y: c.y, kind: 'boat', d };
        }
      // The buoy line counts as safety off the beach.
      const shelf = beachOffshore(player.x, player.y);
      if (Number.isFinite(shelf) && (!best || shelf - SHARK_BUOY_CLEAR < best.d)) {
        const p = shoreAt(shoreS(player.x));
        best = { x: p.x, y: p.y, kind: 'swim zone', d: Math.max(0, shelf - SHARK_BUOY_CLEAR + 30) };
      }
      return best;
    }
    function sharkStartEncounter(reason = 'interest') {
      const e = sharkEncounter,
        exit = sharkNearestExit(),
        swim = SWIM_SPRINT,
        // Heading straight for the way out at the hard crawl makes it with room.
        need = exit ? exit.d / swim : 30;
      e.phase = 'approach';
      e.t = 0;
      e.exit = exit ? { x: Math.round(exit.x), y: Math.round(exit.y), kind: exit.kind, d: Math.round(exit.d) } : null;
      e.window = clamp(need * 1.25 + 5, 20, 90);
      e.bite = false;
      e.taken = false;
      e.god = !!player.godMode;
      e.count++;
      e.interest = 0;
      // The fin comes in from the open sea, never from the way out.
      const away = exit ? Math.atan2(player.y - exit.y, player.x - exit.x) : Math.random() * TAU;
      let at = null;
      for (let i = 0; i < 12 && !at; i++) {
        const a = away + (Math.random() - 0.5) * 1.6,
          x = player.x + Math.cos(a) * 380,
          y = player.y + Math.sin(a) * 380;
        if (seaOpen(x, y, 60)) at = { x, y };
      }
      if (!at) at = { x: player.x + Math.cos(away) * 300, y: player.y + Math.sin(away) * 300 };
      sharkPlace(at.x, at.y, Math.atan2(player.y - at.y, player.x - at.x));
      shark.mode = 'hunt';
      shark.z = SEA_SURFACE - 8;
      shark.beachPass = null;
      e.orbit = Math.atan2(at.y - player.y, at.x - player.x);
      e.radius = distanceBetween(at, player);
      shark.finUp = 1;
      seaNote('shark: interest → warning', reason + ' · way out: ' + (e.exit ? e.exit.kind + ' ' + distanceLabel(e.exit.d) : 'none') + ' · window ' + e.window.toFixed(0) + ' s');
      tell('SHARK! · swim for ' + (exit ? (exit.kind === 'boat' ? 'the boat' : exit.kind === 'ladder' ? 'the ladder' : exit.kind === 'swim zone' ? 'the buoys' : 'the shore') + ' · ' + distanceLabel(exit.d) : 'your life'), 5);
      sharkScore('start');
      return e;
    }
    function sharkEndEncounter(outcome) {
      const e = sharkEncounter;
      e.last = { outcome, at: +gameTime.toFixed(1), clock: clockText() };
      e.phase = 'none';
      e.cooldown = SHARK_COOLDOWN;
      shark.mode = 'retreat';
      shark.retreatFor = 14;
      shark.waypoint = seaPointNear(shark.x, shark.y, 700, 1200, SHARK_WATER, 16, Math.atan2(shark.y - player.y, shark.x - player.x), 0.8);
      if (outcome === 'escape') {
        e.escapes++;
        seaNote('shark: escape', 'the player got out in time (' + e.t.toFixed(1) + ' s)');
        tell('The shark loses interest and slides away.', 3.5);
        sharkScore('release');
      } else if (outcome === 'god') {
        seaNote('shark: god mode', 'bit down, let go and left');
        sharkScore('release');
      } else if (outcome === 'aborted') {
        seaNote('shark: encounter called off', 'the swimmer left the water another way');
        sharkScore('release');
      } else {
        e.attacks++;
        seaNote('shark: attack', 'taken');
      }
    }
    function updateSharkEncounter(deltaSeconds) {
      const e = sharkEncounter;
      if (e.phase === 'none') return false;
      e.t += deltaSeconds;
      // Gone before it came to anything: died some other way, or moved away.
      if ((e.phase === 'approach' || e.phase === 'circle' || e.phase === 'dive') && (gameMode === 'dead' || distanceBetween(player, shark) > 900)) {
        sharkEndEncounter('aborted');
        return false;
      }
      if ((e.phase === 'approach' || e.phase === 'circle' || e.phase === 'dive') && gameMode === 'play') {
        if (sharkPlayerSafe()) {
          sharkEndEncounter('escape');
          return false;
        }
      }
      const px = player.x,
        py = player.y;
      if (e.phase === 'approach' || e.phase === 'circle') {
        // Close in on a circle round the swimmer; it tightens over the window.
        const left = Math.max(0, e.window - e.t),
          target = e.phase === 'approach' ? 170 : clamp(55 + left * 5, 55, 170);
        e.radius += (target - e.radius) * Math.min(1, deltaSeconds * (e.phase === 'approach' ? 0.5 : 0.25));
        if (e.phase === 'approach' && e.radius < 190) {
          e.phase = 'circle';
          seaNote('shark: circling', 'radius ' + distanceLabel(e.radius));
        }
        const tangential = 4.2 * UNITS_PER_METRE;
        e.orbit += (tangential / Math.max(40, e.radius)) * deltaSeconds;
        const tx = px + Math.cos(e.orbit) * e.radius,
          ty = py + Math.sin(e.orbit) * e.radius,
          want = Math.atan2(ty - shark.y, tx - shark.x),
          gap = Math.hypot(tx - shark.x, ty - shark.y);
        shark.a = normalizeAngle(shark.a + clamp(normalizeAngle(want - shark.a), -1.4 * deltaSeconds, 1.4 * deltaSeconds));
        shark.speed += (clamp(gap * 0.8, 2.5 * UNITS_PER_METRE, 6.5 * UNITS_PER_METRE) - shark.speed) * Math.min(1, deltaSeconds);
        shark.x += Math.cos(shark.a) * shark.speed * deltaSeconds;
        shark.y += Math.sin(shark.a) * shark.speed * deltaSeconds;
        shark.depth = SEA_SURFACE - 6;
        shark.finUp = 1;
        if (e.t > e.window) {
          e.phase = 'dive';
          e.t = 0;
          e.diveFrom = { x: shark.x, y: shark.y, z: shark.z };
          seaNote('shark: dive', 'the fin goes under');
          sharkScore('dive');
        }
        return true;
      }
      if (e.phase === 'dive') {
        // Down, and round under the swimmer.
        const k = clamp(e.t / 2.2, 0, 1);
        shark.finUp = 0;
        shark.depth = SEA_SURFACE - 8 - 42 * Math.sin(k * Math.PI * 0.5);
        const tx = px - Math.cos(shark.a) * 12,
          ty = py - Math.sin(shark.a) * 12;
        shark.x += (tx - shark.x) * Math.min(1, deltaSeconds * 1.2);
        shark.y += (ty - shark.y) * Math.min(1, deltaSeconds * 1.2);
        shark.pitch += (0.3 - shark.pitch) * Math.min(1, deltaSeconds * 2);
        if (e.t > 2.4) {
          e.phase = 'breach';
          e.t = 0;
          e.at = { x: px, y: py };
          e.bite = false;
          seaNote('shark: breach', e.god ? 'god mode' : 'attack');
          sharkScore('attack');
          sharkRushSound(e.at);
        }
        return true;
      }
      if (e.phase === 'breach') {
        const t = e.t,
          at = e.at;
        shark.finUp = 0;
        shark.x += (at.x - shark.x) * Math.min(1, deltaSeconds * 10);
        shark.y += (at.y - shark.y) * Math.min(1, deltaSeconds * 10);
        if (t < 0.55) {
          // The lunge: nearly vertical, jaws opening, up through the swimmer.
          const k = t / 0.55;
          shark.z = SEA_SURFACE - 40 + 52 * (1 - Math.pow(1 - k, 2.2));
          shark.pitch = 0.5 + 0.85 * Math.min(1, k * 1.6);
          shark.mouth = Math.min(1, k * 1.8);
          shark.roll = 0;
          if (!e.surfaced && shark.z > SEA_SURFACE - 16) {
            e.surfaced = true;
            seaEvent('breach', at.x, at.y, 2.2, { a: shark.a });
            sharkBreachSound(at);
            shake = Math.max(shake, 6);
          }
        } else if (t < 0.85) {
          // The bite at the top.
          shark.z = SEA_SURFACE + 12 + Math.sin((t - 0.55) * 6) * 1.5;
          shark.mouth = Math.max(0, 1 - (t - 0.55) * 7);
          if (!e.bite) {
            e.bite = true;
            sharkBite();
          }
        } else if (t < 1.7) {
          // Over on its side and down, a wall of water.
          const k = (t - 0.85) / 0.85;
          shark.z = SEA_SURFACE + 12 - 40 * k * k;
          shark.pitch = 1.35 - 1.5 * k;
          shark.roll = (e.side || 1) * 1.45 * Math.min(1, k * 1.4);
          shark.mouth = e.god ? 0.25 * Math.sin(k * 9) : 0;
          if (!e.fell && shark.z < SEA_SURFACE + 2) {
            e.fell = true;
            seaEvent('breach', at.x + Math.cos(shark.a) * 18, at.y + Math.sin(shark.a) * 18, 2.8, { a: shark.a, fall: true });
            sharkFallSound(at);
            shake = Math.max(shake, 8);
          }
        } else {
          shark.roll *= Math.exp(-deltaSeconds * 2);
          shark.pitch += (-0.3 - shark.pitch) * Math.min(1, deltaSeconds * 2);
          shark.depth = SEA_SURFACE - 34;
          shark.z += (shark.depth - shark.z) * Math.min(1, deltaSeconds * 1.5);
          if (t > 2.6) {
            e.surfaced = false;
            e.fell = false;
            sharkEndEncounter(e.god ? 'god' : 'attack');
          }
        }
        return true;
      }
      return false;
    }
