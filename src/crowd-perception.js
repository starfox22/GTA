    const ALARM_REACH = { gunfire: 560, explosion: 950, crash: 380, knock: 300, melee: 170, body: 150 };
    function crowdIncident(kind, source, attacker, severity = 1) {
      const loud = kind === 'gunfire' || kind === 'explosion';
      // Merge repeats: an automatic burst is one incident, not thirty.
      let inc = crowd.incidents.find(
        (i) => i.kind === kind && gameTime - i.time < (loud ? 1.6 : 3) && Math.hypot(i.x - source.x, i.y - source.y) < 90,
      );
      if (inc) {
        inc.time = gameTime;
        inc.x = source.x;
        inc.y = source.y;
        inc.severity = Math.max(inc.severity, severity);
        inc.shots++;
        if (attacker) inc.attacker = attacker;
        return inc;
      }
      inc = {
        id: crowd.incidentId++,
        kind,
        x: source.x,
        y: source.y,
        time: gameTime,
        start: gameTime,
        attacker,
        severity,
        loud,
        callers: 0,
        filmers: 0,
        watchers: 0,
        helpers: 0,
        spread: 0,
        shots: 1,
        reported: false,
        focus: kind === 'body' || kind === 'knock' ? source : null,
      };
      crowd.incidents.push(inc);
      if (crowd.incidents.length > 32) crowd.incidents.shift();
      return inc;
    }
    function crowdAlarm(kind, source, attacker = null, severity = 1) {
      if (!source) return null;
      const inc = crowdIncident(kind, source, attacker, severity);
      if (attacker === player && (kind === 'gunfire' || kind === 'explosion')) crowd.playerShotAt = gameTime;
      const reach = ALARM_REACH[kind] * (kind === 'crash' ? clamp(severity, 0.6, 1.4) : 1),
        nearPlayer = Math.abs(source.x - player.x) < 1100 && Math.abs(source.y - player.y) < 1100;
      const perceive = (p, d) => {
        if (p.hp <= 0 || p === attacker || p === source || personIncapacitated(p)) return;
        if (p.onDeck) {
          // Deck passengers keep their old, simpler panic.
          p.flee = 8;
          p.threat = { x: source.x, y: source.y };
          return;
        }
        const sees = d < Math.min(reach, 460) && crowdSight(p, source);
        if (!inc.loud && !sees && d > 90) return;
        const delay = 0.06 + d / 1700 + seededRandom() * (p.texting || p.onPhone ? 0.7 : 0.25);
        if (p.pending && p.pending.inc === inc) return;
        p.pending = { inc, at: gameTime + delay, sees, d };
        if (sees && attacker === player) p.sawPlayerAt = gameTime;
      };
      if (nearPlayer) forPeopleNear(source.x, source.y, reach, perceive);
      else
        for (const p of pedestrians) {
          const d = Math.hypot(p.x - source.x, p.y - source.y);
          if (d <= reach) perceive(p, d);
        }
      return inc;
    }
    /* Where the danger is, as this person understands it. */
    function perceivedSource(inc, sees, d) {
      if (sees || d < 120) return { x: inc.x, y: inc.y };
      return { x: inc.x + randomBetween(-1, 1) * d * 0.3, y: inc.y + randomBetween(-1, 1) * d * 0.3 };
    }
    /**
     * CHOOSING A REACTION
     * The same shot produces different people: most near it drop and cover
     * their heads, some freeze, some run for the nearest doorway, the rest run.
     * Further out a few brave (or foolish) ones film it or call it in, one might
     * shout at the shooter, and at the edge of hearing people just stop and ask
     * each other what that was. Crashes and bodies draw onlookers instead.
     */
    function decideReaction(p, pending) {
      const { inc, sees, d, contagion } = pending;
      if (p.hp <= 0 || personIncapacitated(p) || !inc) return;
      const cur = p.react?.kind,
        nerve = p.nerve ?? 0.5,
        r = seededRandom(),
        guess = perceivedSource(inc, sees, d);
      if (contagion) {
        if (cur) return;
        if (r < 0.55) startReaction(p, 'flee', randomBetween(3.5, 6), guess, inc, { scream: r < 0.15 });
        else if (r < 0.82) startReaction(p, 'startle', randomBetween(0.5, 1.1), guess, inc, { then: 'hurry' });
        else startReaction(p, 'cower', randomBetween(1, 2.2), guess, inc, { then: 'flee' });
        return;
      }
      if (inc.kind === 'gunfire' || inc.kind === 'explosion' || inc.kind === 'melee') {
        const boom = inc.kind === 'explosion';
        if (cur === 'flee' || cur === 'shelter') {
          p.react.dur = Math.max(p.react.dur, p.react.t + 7);
          p.react.from = guess;
          return;
        }
        if (['cower', 'freeze', 'handsUp', 'kneel', 'groan', 'dodge'].includes(cur)) {
          p.react.dur = Math.max(p.react.dur, p.react.t + 1.5);
          return;
        }
        const close = d < (boom ? 330 : 170) || (sees && d < 240);
        if (['film', 'call', 'watch', 'shout', 'point'].includes(cur) && !close) return;
        let door;
        if (close) {
          if (r < 0.42) startReaction(p, 'cower', randomBetween(1.3, 3.2), guess, inc, { then: 'flee' });
          else if (r < 0.56) startReaction(p, 'freeze', randomBetween(0.8, 2), guess, inc, { then: 'flee' });
          else if (r < 0.74 && (door = doorNear(p, 110))) startReaction(p, 'shelter', 25, guess, inc, { door });
          else startReaction(p, 'flee', randomBetween(5, 8), guess, inc, { scream: true });
          return;
        }
        if (sees || d < 330) {
          if (nerve > 0.9 && inc.callers < 1 && inc.attacker) startReaction(p, 'call', randomBetween(8, 11), guess, inc);
          else if (nerve > 0.78 && inc.filmers < 2 && sees) startReaction(p, 'film', randomBetween(7, 13), guess, inc, { then: 'hurry' });
          else if (nerve > 0.95 && sees && d < 300 && inc.attacker === player)
            startReaction(p, 'shout', 1.8, guess, inc, { then: 'flee' });
          else if (r < 0.3 && (door = doorNear(p, 90))) startReaction(p, 'shelter', 25, guess, inc, { door });
          else if (r < 0.55) startReaction(p, 'cower', randomBetween(0.7, 1.6), guess, inc, { then: 'flee' });
          else startReaction(p, 'flee', randomBetween(4, 7), guess, inc, { scream: r > 0.85 });
          return;
        }
        // At the edge of hearing: stop, look, decide.
        if (r < (boom ? 0.5 : 0.22)) startReaction(p, 'flee', randomBetween(3.5, 6), guess, inc);
        else if (nerve > 0.82 && inc.callers < 2 && inc.attacker) startReaction(p, 'call', randomBetween(8, 10), guess, inc);
        else {
          startReaction(p, 'startle', randomBetween(0.7, 1.3), guess, inc, { then: 'hurry' });
          crowdSay(p, boom ? 'boom' : 'heard', 0.5);
        }
        return;
      }
      if (inc.kind === 'crash' || inc.kind === 'knock' || inc.kind === 'body') {
        if (cur && !['startle', 'hurry'].includes(cur)) return;
        // A crowd forms, but only so big: past a dozen, newcomers look and move on.
        let gathered = 0;
        for (const other of crowd.incidents)
          if (Math.abs(other.x - inc.x) < 260 && Math.abs(other.y - inc.y) < 260) gathered += other.watchers + other.filmers;
        const severe = inc.severity > 1.1 || inc.kind !== 'crash',
          victim = inc.focus,
          helping = inc.kind === 'knock' && victim && victim.hp > 0 && nerve > 0.55 && inc.helpers < 1,
          then = helping
            ? 'help'
            : r < 0.52 && inc.watchers < 8 && gathered < 12
              ? 'watch'
              : r < 0.66 && severe && inc.callers < 1 && (inc.attacker || inc.kind !== 'crash')
                ? 'call'
                : r < 0.74 && inc.filmers < 2 && gathered < 14
                  ? 'film'
                  : 'hurry';
        startReaction(p, inc.kind === 'crash' && d > 90 ? 'startle' : 'gasp', randomBetween(0.8, 1.5), guess, inc, { then });
        if (inc.kind !== 'crash') crowdSay(p, 'gasp', 0.5);
      }
    }
    function reactionDuration(kind) {
      return (
        {
          flee: randomBetween(4.5, 7),
          watch: randomBetween(12, 28),
          call: randomBetween(8, 11),
          film: randomBetween(7, 13),
          fist: randomBetween(1.8, 3),
          help: randomBetween(12, 22),
          argue: randomBetween(8, 13),
          returnCar: 20,
          cower: randomBetween(1, 2),
        }[kind] || 2
      );
    }
    const REACTION_LINES = {
      cower: ['cower', 0.4],
      flee: ['flee', 0.3],
      film: ['film', 0.7],
      shout: ['shout', 1],
      fist: ['fist', 0.9],
      help: ['helper', 0.8],
      argue: ['angryDriver', 1],
    };
    /* Incidents count their callers, filmers, watchers and helpers while they last. */
    const ROLE_COUNTS = { call: 'callers', film: 'filmers', watch: 'watchers', help: 'helpers' };
    function releaseReactionRole(p) {
      const r = p.react,
        key = r && ROLE_COUNTS[r.kind];
      if (key && r.inc && !r.released) {
        r.released = true;
        r.inc[key] = Math.max(0, r.inc[key] - 1);
      }
    }
    function startReaction(p, kind, dur, from, inc, extra = {}) {
      releaseReactionRole(p);
      if (kind === 'hurry') return settleAfterReaction(p, from);
      if (p.bench) p.bench.taken = null;
      p.bench = null;
      if (p.state !== 'walk' && p.state !== 'sit') p.state = 'walk';
      if (p.state === 'sit') p.state = 'walk';
      p.sitting = false;
      p.chatWith = null;
      p.onPhone = false;
      p.waiting = false;
      if (p.scene) leaveScene(p);
      p.react = {
        kind,
        t: 0,
        dur,
        from: from ? { x: from.x, y: from.y } : p.react?.from || null,
        inc: inc || null,
        ...extra,
      };
      p.flee = Math.max(p.flee || 0, 1);
      if (from) p.threat = { x: from.x, y: from.y };
      if (inc && ROLE_COUNTS[kind]) inc[ROLE_COUNTS[kind]]++;
      const line = REACTION_LINES[kind];
      if (line) crowdSay(p, line[0], line[1]);
      if (extra.scream || (kind === 'cower' && seededRandom() < 0.25)) scream(p);
      // Companions do what their partner does rather than walking on alone.
      if (['flee', 'cower', 'freeze', 'shelter'].includes(kind))
        for (const q of pedestrians)
          if (q.leader === p) {
            q.leader = null;
            startReaction(q, kind === 'shelter' ? 'flee' : kind, dur + randomBetween(-0.3, 0.6), from, inc);
          }
    }
    /* Back to ordinary life, a little shaken, heading away from whatever it was. */
    function settleAfterReaction(p, from) {
      releaseReactionRole(p);
      p.react = null;
      p.flee = 0;
      p.pose = null;
      p.onPhone = false;
      p.state = 'walk';
      p.timer = randomBetween(6, 12);
      p.shakenUntil = gameTime + randomBetween(12, 25);
      if (from) p.dir = snapAxis(headingBetween(from, p));
      else p.dir = snapAxis(p.a);
      if (p.sceneHome && !p.scene) rejoinScene(p);
    }
    function endReaction(p) {
      const r = p.react;
      releaseReactionRole(p);
      p.react = null;
      if (r.kind === 'groan') p.injured = true;
      if (r.kind === 'handsUp' || r.kind === 'kneel') {
        startReaction(p, 'flee', randomBetween(5, 9), player, r.inc);
        return;
      }
      if (r.then && r.then !== 'hurry') {
        startReaction(p, r.then, reactionDuration(r.then), r.from, r.inc, r.thenExtra || {});
        return;
      }
      // Once clear, plenty of people stop and look back at what they ran from.
      if (r.kind === 'flee' && r.from && distanceBetween(p, r.from) > 200 && seededRandom() < 0.5) {
        const call = (p.nerve ?? 0.5) > 0.65 && r.inc?.attacker && r.inc.callers < 2 && seededRandom() < 0.4;
        startReaction(p, call ? 'call' : 'lookBack', call ? reactionDuration('call') : randomBetween(3, 7), r.from, r.inc, {
          filming: seededRandom() < 0.25,
        });
        return;
      }
      if (['flee', 'shelter', 'cower', 'freeze', 'film', 'call'].includes(r.kind) && seededRandom() < 0.3)
        crowdSay(p, 'recover', 1);
      settleAfterReaction(p, r.from);
    }
    /**
     * FLEEING ALONG THE STREET
     * Running away is not a straight line through walls. On the grid people run
     * along sidewalks, choosing whichever of the four street directions takes
     * them furthest from the danger; they turn at corners, and they will not
     * sprint across a road with traffic bearing down on the crossing — they take
     * the corner instead. Off the grid (parks, quays) they steer around
     * obstacles by probing a fan of headings.
     */
    function crossingUnsafe(x, y) {
      for (const c of vehicles) {
        if (c.hp <= 0 || Math.abs(c.x - x) > 190 || Math.abs(c.y - y) > 190) continue;
        if (isAircraft(c) || isBoat(c)) continue;
        const speed = Math.hypot(c.vx || 0, c.vy || 0);
        if (speed < 25) continue;
        const toward = (x - c.x) * (c.vx || 0) + (y - c.y) * (c.vy || 0);
        if (toward > 0 && Math.hypot(x - c.x, y - c.y) < 60 + speed * 1.1) return true;
      }
      return false;
    }
    function chooseFleeHeading(p, r) {
      const away = headingBetween(r.from || player, p);
      if (!inCityGrid(p.x, p.y)) {
        for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) {
          const a = away + off;
          if (!solid(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, 5)) return a;
        }
        return away + Math.PI;
      }
      const R = roadNear(p.x),
        C = rowNear(p.y),
        onVertical = Math.abs(p.x - R) > 36 && Math.abs(p.x - R) < 100,
        onHorizontal = Math.abs(p.y - C) > 36 && Math.abs(p.y - C) < 100,
        inRoad = crowdOnRoad(p.x, p.y);
      // Already out in the road: finish crossing in the direction already chosen.
      if (inRoad && r.fleeDir !== undefined) return r.fleeDir;
      let best = null,
        bestScore = -Infinity;
      for (const dir of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const vertical = Math.abs(Math.sin(dir)) > 0.5,
          cx = Math.cos(dir),
          cy = Math.sin(dir);
        if (solid(p.x + cx * 20, p.y + cy * 20, 5)) continue;
        let score = Math.cos(dir - away);
        const parallel = vertical ? onVertical : onHorizontal;
        if (!parallel) {
          // Leaving the sidewalk sideways means stepping into the road.
          const crossX = vertical ? p.x : R,
            crossY = vertical ? C : p.y;
          if (crowdOnRoad(p.x + cx * 30, p.y + cy * 30)) {
            if (crossingUnsafe(crossX, crossY)) score -= 1.6;
            else score -= 0.25;
          }
        } else {
          // Running along the sidewalk toward a crossing: is the crossing clear?
          const next = nextCrossing(vertical ? ROAD_ROWS : ROAD_CENTERS, vertical ? p.y : p.x, vertical ? Math.sign(cy) : Math.sign(cx));
          if (next !== undefined && Math.abs(next - (vertical ? p.y : p.x)) < 110) {
            const qx = vertical ? p.x : next,
              qy = vertical ? next : p.y;
            if (crossingUnsafe(qx, qy)) score -= 1.2;
          }
        }
        if (r.fleeDir !== undefined && Math.abs(normalizeAngle(dir - r.fleeDir)) < 0.1) score += 0.3;
        if (score > bestScore) {
          bestScore = score;
          best = dir;
        }
      }
      return best ?? away;
    }
    function fleeStep(p, deltaSeconds, r) {
      const attacker = r.inc?.attacker;
      // Keep track of a visible attacker: the danger moves.
      if (attacker && attacker.hp > 0 && (r.track || 0) <= 0) {
        r.track = 0.8;
        if (distanceBetween(p, attacker) < 420 && crowdSight(p, attacker)) r.from = { x: attacker.x, y: attacker.y };
      }
      r.track = (r.track || 0) - deltaSeconds;
      r.choose = (r.choose || 0) - deltaSeconds;
      if (r.choose <= 0 || r.fleeDir === undefined) {
        r.choose = 0.4;
        r.fleeDir = chooseFleeHeading(p, r);
      }
      let heading = r.fleeDir;
      // On a sidewalk, run down its middle rather than along the building line.
      if (inCityGrid(p.x, p.y) && !crowdOnRoad(p.x, p.y)) {
        const vertical = Math.abs(Math.sin(heading)) > 0.5,
          beside = vertical ? roadNear(p.x) : rowNear(p.y),
          lateral = (vertical ? p.x : p.y) - beside;
        if (Math.abs(lateral) > 36 && Math.abs(lateral) < 100) {
          const centre = beside + Math.sign(lateral || 1) * sidewalkOffset(beside, vertical),
            error = centre - (vertical ? p.x : p.y),
            correction = clamp(error * 0.03, -0.35, 0.35);
          heading += vertical ? -correction * Math.sign(Math.sin(heading)) : correction * Math.sign(Math.cos(heading));
        }
      }
      // Running for it: 17-21 km/h for most, slower for the old, the young and the hurt.
      const top = (p.injured ? 7 : p.role === 'elder' ? 10 : p.role === 'kid' ? 13 : 17 + (p.nerve || 0) * 2.5) * KMH,
        speed = top * clamp(r.t / 0.35, 0.35, 1);
      if (crowdStep(p, heading, speed, deltaSeconds)) {
        r.stuck = (r.stuck || 0) + deltaSeconds;
        if (r.stuck > 0.5) {
          r.fleeDir = normalizeAngle(r.fleeDir + (seededRandom() < 0.5 ? 1 : -1) * Math.PI / 2);
          r.choose = 0.8;
          r.stuck = 0;
        }
      } else r.stuck = 0;
      p.pose = p.injured ? 'limp' : 'run';
      // Panic is contagious: people who see others running start running.
      r.spreadIn = (r.spreadIn ?? 0.2) - deltaSeconds;
      if (r.spreadIn <= 0 && r.t < 4 && r.inc && r.inc.spread < 90) {
        r.spreadIn = 0.6;
        forPeopleNear(p.x, p.y, 75, (q) => {
          if (q.react || q.pending || q.hp <= 0 || q.onDeck || personIncapacitated(q)) return;
          q.pending = {
            inc: r.inc,
            at: gameTime + randomBetween(0.25, 0.75),
            sees: false,
            d: distanceBetween(q, r.inc),
            contagion: true,
          };
          r.inc.spread++;
        });
      }
      if (seededRandom() < deltaSeconds * 0.25) crowdSay(p, 'flee', 0.5);
    }
    /* Onlookers keep a ring around what they are looking at, off the carriageway. */
    function watchFrom(p, r, focus, ringMin, ringMax, deltaSeconds) {
      if (!r.spot) {
        const a = headingBetween(focus, p) + randomBetween(-0.5, 0.5),
          ring = randomBetween(ringMin, ringMax);
        r.spot = snapToSidewalk(focus.x + Math.cos(a) * ring, focus.y + Math.sin(a) * ring);
        if (solid(r.spot.x, r.spot.y, 5)) r.spot = { x: p.x, y: p.y };
      }
      const d = distanceBetween(p, r.spot);
      if (d > 5) {
        if (crowdStep(p, headingBetween(p, r.spot), d > 60 ? 40 : 26, deltaSeconds)) {
          r.stuckWatch = (r.stuckWatch || 0) + deltaSeconds;
          if (r.stuckWatch > 1.2) r.spot = { x: p.x, y: p.y };
        }
        p.pose = null;
        return false;
      }
      p.walking = false;
      faceToward(p, focus, deltaSeconds, 4);
      return true;
    }
