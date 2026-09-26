    function sportsUpdateOfficials(match, deltaSeconds) {
      const ball = match.ball,
        venue = match.venue;
      for (const official of match.officials) {
        if (official.hidden || official.hp <= 0) continue;
        let target;
        if (official.kind === 'referee') {
          const side = sportsAttackDirection(match.possessionTeam);
          target =
            match.sport === 'soccer'
              ? { x: ball.x - side * 34, y: ball.y + (ball.y > venue.y + venue.h / 2 ? -42 : 42) }
              : { x: ball.x - side * 16, y: venue.y + venue.h + 7 };
        } else if (official.id.endsWith('1'))
          target = { x: sportsLimit(ball.x, venue.x + 6, venue.x + venue.w / 2), y: venue.y - 2 };
        else target = { x: sportsLimit(ball.x, venue.x + venue.w / 2, venue.x + venue.w - 6), y: venue.y + venue.h + 2 };
        const distance = sportsMovePlayer(match, official, target, 34, deltaSeconds, false);
        // Face the play when standing still.
        if (distance < 2) official.a = Math.atan2(ball.y - official.y, ball.x - official.x);
        official.actionTime = Math.max(0, official.actionTime - deltaSeconds);
      }
    }

    /**
     * MATCH TIMELINE
     * Once a frame each venue asks the calendar which fixture it is showing and
     * where in it the world clock stands, and steps the match through its
     * stages: out of the tunnel to warm up, kickoff, the break, the second
     * half, full time and away.
     */
    function sportsFollowSchedule(sport) {
      let match = sportsMatches[sport];
      const fixture = sportsCurrentFixture(sport, worldMinutes, sportsAbandoned[sport]);
      if (!match || match.fixture.id !== fixture.id) match = sportsMatches[sport] = createSportsMatch(sport, fixture);
      if (match.abandoned) return match;
      const line = sportsTimeline(fixture, worldMinutes);
      match.clock = line.clock;
      match.remaining = line.remaining;
      if (line.stage !== match.stage || line.period !== match.period) sportsEnterStage(match, line);
      return match;
    }

    function sportsEnterStage(match, line) {
      const previous = match.stage,
        fresh = previous === 'new',
        calendar = match.calendar;
      match.stage = line.stage;
      match.period = line.period;
      match.phase = 'play';
      match.restart = null;
      match.goalFlash = null;
      match.invader = null;
      match.stewards.length = 0;
      match.people = [...match.players, ...match.officials];
      const everyone = match.people;
      if (line.stage === 'upcoming' || line.stage === 'over') {
        for (const person of everyone) person.hidden = true;
        match.status = line.stage === 'over' ? 'FULL TIME' : 'NEXT MATCH';
        sportsRespotBall(match);
        return;
      }
      if (line.stage === 'warmup') {
        // Out of the tunnel (or off the bench) to loosen up in their own half.
        for (const person of everyone) sportsComeOut(match, person, fresh);
        match.status = 'WARM UP';
        sportsRespotBall(match);
        return;
      }
      // Joining a match already under way: a plausible score for the time played.
      if (fresh && line.clock > 0.5) sportsCatchUpScore(match, line.clock);
      if (line.stage === 'live') {
        for (const person of everyone) {
          if (person.hidden || fresh) sportsComeOut(match, person, fresh);
          person.leaving = false;
          person.action = 'run';
        }
        if (fresh)
          for (const athlete of match.players) Object.assign(athlete, sportsPoint(match, athlete.team, athlete.formationAlong, athlete.formationAcross));
        const kickoffTeam = line.period % 2;
        const centre = { x: match.venue.x + match.venue.w / 2, y: match.venue.y + match.venue.h / 2 };
        sportsBeginRestart(match, kickoffTeam, centre, match.sport === 'basketball' ? 'TIP OFF' : 'KICKOFF', fresh ? 0.4 : 1.5);
        match.status = calendar.periodNames[line.period] + ' · ' + match.restart.label;
        return;
      }
      // A break or full time: the whistle, then everyone walks off.
      sportsWhistle(match, line.stage === 'fulltime' ? 'triple' : 'double');
      match.status = line.stage === 'fulltime' ? 'FULL TIME' : calendar.breakName;
      if (line.stage === 'fulltime') {
        sportsRecordEvent(match, 'fulltime', null, match.scores.join('-'));
        // The winners applaud their fans; everyone heads off.
        const winner = match.scores[0] === match.scores[1] ? -1 : match.scores[0] > match.scores[1] ? 0 : 1;
        for (const athlete of match.players) if (athlete.team === winner) sportsSetAction(athlete, 'celebrate', 3);
      }
      for (const person of everyone) person.leaving = !person.hidden;
      if (fresh) for (const person of everyone) person.hidden = true;
      if (match.ball.ownerId !== SPORTS_HUMAN) sportsRespotBall(match);
    }

    /* Someone walks on: from the tunnel at the stadium, from the bench courtside. */
    function sportsComeOut(match, person, instantly) {
      const exit = SPORTS_EXITS[match.sport][0];
      person.hidden = false;
      person.leaving = false;
      if (instantly) {
        const spot =
          person.team >= 0
            ? sportsPoint(match, person.team, person.formationAlong * 0.8, person.formationAcross)
            : { x: person.x, y: person.y };
        person.x = spot.x;
        person.y = spot.y;
      } else if (person.hp > 0) {
        person.x = exit.x + (sportsRandom(match) - 0.5) * 14;
        person.y = exit.y + (match.sport === 'soccer' ? 0 : 4);
      }
    }

    /* Joining a match already under way: a plausible score for the minutes played. */
    function sportsCatchUpScore(match, clock) {
      const calendar = match.calendar,
        share = clock / (calendar.periods * calendar.periodMinutes);
      for (const team of [0, 1]) {
        if (match.sport === 'soccer') {
          // A Poisson draw on the side's expected goals for the minutes played
          // (the sportsbook's goal model, sportsbook-odds.js).
          const rate = sportsbookRates(match.fixture)[team] * share,
            roll = sportsRandom(match);
          let goals = 0,
            term = Math.exp(-rate),
            sum = term;
          while (roll > sum && goals < 9) {
            goals++;
            term *= rate / goals;
            sum += term;
          }
          match.scores[team] = goals;
        } else match.scores[team] = Math.round(share * (44 + sportsRandom(match) * 22));
      }
    }

    /* Warming up: gentle jogs between spots in their own half. */
    function sportsUpdateWarmup(match, deltaSeconds) {
      for (const person of match.people) {
        if (person.hidden || person.hp <= 0 || person.knockedFor > 0) continue;
        if (!person.warmupSpot || sportsDistance(person, person.warmupSpot) < 3 || sportsRandom(match) < 0.002) {
          const team = person.team >= 0 ? person.team : sportsRandom(match) < 0.5 ? 0 : 1;
          person.warmupSpot = sportsPoint(match, team, 0.08 + sportsRandom(match) * 0.38, 0.12 + sportsRandom(match) * 0.76);
        }
        sportsMovePlayer(match, person, person.warmupSpot, person.team >= 0 ? 22 : 12, deltaSeconds);
      }
    }

    /* Walking off at a break or full time. */
    function sportsUpdateLeaving(match, deltaSeconds) {
      const exit = SPORTS_EXITS[match.sport][0];
      for (const person of match.people) {
        if (person.hidden || person.hp <= 0 || person.knockedFor > 0) continue;
        if (!person.leaving) {
          person.walking = false;
          continue;
        }
        const spot =
          exit.tunnel || person.team < 0
            ? exit
            : { x: exit.x + (person.team ? 1 : -1) * (12 + person.number * 7), y: exit.y };
        const distance = sportsMovePlayer(match, person, spot, person.actionTime > 0 ? 6 : 24, deltaSeconds, false);
        if (distance < 3) {
          if (exit.tunnel) person.hidden = true;
          else {
            person.leaving = false;
            person.a = Math.PI / 2;
          }
        }
      }
    }

    /**
     * HARM AND PANIC
     * The combat code hurts athletes through strikePerson() and knockPerson()
     * like anyone else; here the match notices. Any casualty (or gunfire, a
     * blast or a stabbing inside the venue) abandons the match.
     */
    function sportsHarmedByPlayer(person) {
      if (person.killedBy === player) return true;
      return !!person.threat && Math.hypot(person.threat.x - player.x, person.threat.y - player.y) < 90;
    }

    function sportsCheckHarm(match, deltaSeconds) {
      for (const person of match.people) {
        if (person.knockedFor > 0) person.knockedFor = Math.max(0, person.knockedFor - deltaSeconds);
        if (person.impactCooldown > 0) person.impactCooldown = Math.max(0, person.impactCooldown - deltaSeconds);
        const hurt = person.hp < person.lastHp - 0.01,
          knocked = person.knockedFor > 0 && !person.wasKnocked;
        person.wasKnocked = person.knockedFor > 0;
        person.lastHp = person.hp;
        if (!hurt && !knocked) continue;
        const byPlayer = sportsHarmedByPlayer(person);
        if (person.hp <= 0 && !person.counted) {
          person.counted = true;
          person.deadTime = person.deadTime || gameTime;
          match.casualties++;
          sportsRecordEvent(match, 'casualty', person, person.kind);
          // A killing in front of thousands of witnesses: a civilian death in the
          // heat model (heat.js), counted once even if strikePerson already did.
          if (byPlayer) recordKill(person);
        }
        if (byPlayer && match.policeCallAt === null) match.policeCallAt = match.time + 2.5;
        sportsAbandon(match, person.threat || person, byPlayer ? player : null);
      }
      // Gunfire, blasts and stabbings inside the venue stop play even if nobody is
      // hit. An incident counts from the check before it (shots fired later in
      // the same frame carry that frame's time, so the comparison is inclusive).
      const since = match.incidentCheckTime ?? gameTime;
      match.incidentCheckTime = gameTime;
      if (match.abandoned || (match.stage !== 'live' && match.stage !== 'warmup')) return;
      for (const incident of crowd.incidents) {
        if (incident.time < since) continue;
        if (!['gunfire', 'explosion', 'melee'].includes(incident.kind)) continue;
        if (!sportsInVenue(match, incident.x, incident.y, match.sport === 'soccer' ? 40 : 160)) continue;
        sportsAbandon(match, incident, incident.attacker);
        if (incident.attacker === player && match.policeCallAt === null) match.policeCallAt = match.time + 3;
        break;
      }
    }

    function sportsInVenue(match, x, y, margin) {
      if (match.sport === 'soccer') return inStadiumLot(x, y, margin);
      const venue = match.venue;
      return x > venue.x - margin && x < venue.x + venue.w + margin && y > venue.y - margin && y < venue.y + venue.h + margin;
    }

    function sportsAbandon(match, source, attacker) {
      if (match.abandoned) return;
      const onField = match.people.some((person) => !person.hidden);
      match.abandoned = true;
      match.stage = 'abandoned';
      match.phase = 'abandoned';
      match.status = 'MATCH ABANDONED';
      match.restart = null;
      match.goalFlash = null;
      match.invader = null;
      match.panicAt = match.time;
      match.panicSource = { x: source.x, y: source.y };
      sportsAbandoned[match.sport] = { id: match.fixture.id, day: match.fixture.day, slot: match.fixture.slot };
      sportsRecordEvent(match, 'abandoned', null);
      const ball = match.ball;
      if (ball.ownerId || ball.flight) sportsLooseBall(match, 0, 0, 0);
      if (ball.mode === 'restart') ball.mode = 'loose';
      for (const person of match.people) {
        if (person.hidden || person.hp <= 0) continue;
        person.fleeing = true;
        person.leaving = false;
        person.fleeTarget = sportsFleeTarget(match, person, source);
      }
      if (onField) sportsWhistle(match, 'long');
      // The crowd heads for the exits; those near the gates see and hear it.
      if (sportsCrowdPresence(match) > 0.05 || onField) {
        sportsCrowdPanicSound(match);
        const gate = match.sport === 'soccer' ? { x: 2689, y: 4872 } : { x: match.venue.x + match.venue.w / 2, y: match.venue.y + match.venue.h / 2 };
        crowdAlarm('melee', gate, attacker, 1.4);
        if (match.sport === 'soccer') sportsFansStampede(match, source, attacker);
      }
      if (Math.hypot(player.x - match.venue.x - match.venue.w / 2, player.y - match.venue.y - match.venue.h / 2) < 1400)
        tell(match.sport === 'soccer' ? 'MATCH ABANDONED · PANIC IN THE STANDS' : 'GAME OVER · THE COURT EMPTIES', 3);
    }

    function sportsFleeTarget(match, person, source) {
      if (match.sport === 'soccer') {
        let best = null,
          bestScore = -Infinity;
        for (const exit of SPORTS_EXITS.soccer) {
          const score = sportsDistance(exit, source) - 0.6 * sportsDistance(exit, person);
          if (score > bestScore) {
            best = exit;
            bestScore = score;
          }
        }
        return best;
      }
      const away = Math.atan2(person.y - source.y, person.x - source.x) + (sportsRandom(match) - 0.5) * 0.8;
      return { x: person.x + Math.cos(away) * 280, y: person.y + Math.sin(away) * 280, tunnel: true };
    }

    function sportsUpdatePanic(match, deltaSeconds) {
      for (const person of match.people) {
        if (person.hidden || person.hp <= 0 || person.knockedFor > 0 || !person.fleeing) {
          person.walking = false;
          person.vx = person.vy = 0;
          continue;
        }
        // The wounded limp; everyone else sprints.
        const speed = person.hp < 20 ? 28 : 62,
          distance = sportsMovePlayer(match, person, person.fleeTarget, speed, deltaSeconds, false);
        person.action = 'run';
        if (distance < 4) person.hidden = true;
      }
      if (match.policeCallAt !== null && match.time >= match.policeCallAt) {
        match.policeCallAt = Infinity;
        if (gameMode === 'play') {
          crime(0.5);
          tell(match.sport === 'soccer' ? 'STADIUM SECURITY CALLED THE POLICE' : 'A WITNESS CALLED THE POLICE', 2.6);
        }
      }
    }

    /* Fans pour out of the turnstiles as ordinary (panicking) pedestrians. */
    function sportsFansStampede(match, source, attacker) {
      if (distanceBetween(player, STADIUM_ESCORT_SPOT) > 1400) return;
      const inc = crowdIncident('melee', source, attacker, 1.4),
        count = Math.round(8 + sportsCrowdPresence(match) * 14);
      for (let index = 0; index < count && pedestrians.length < CROWD_HARD_CAP; index++) {
        const gate = STADIUM_ENTRANCE.gates[index % 2],
          x = gate.x + 4 + sportsRandom(match) * (gate.w - 8),
          y = 4852 + sportsRandom(match) * 34;
        const fan = makeStreetWalker({ x, y, a: Math.PI / 2 }, 'casual');
        const team = index % 3 === 2 ? 1 : 0;
        if (fan.look) fan.look.top = match.kits[team].primary;
        fan.fan = true;
        startReaction(fan, 'flee', 6 + sportsRandom(match) * 5, { x: 2689, y: 4700 }, inc, { scream: index % 4 === 0 });
      }
    }
