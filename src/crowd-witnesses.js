    // Crowd witnesses: who really saw or heard what the player did, who runs a short way and phones 911,
    // the call itself (phone out, the lines, cut short by a gun or a death) and crowdReport().
    /**
     * WITNESSES
     * A quiet crime (a stabbing, a theft, a carjacking) has to be seen: a clear
     * line of sight inside the person's field of view (WITNESS_FOV either side of
     * where they face, narrower for someone looking at their phone), or right
     * beside them. Gunfire and blasts are heard by everyone in reach and seen by
     * anyone with a clear line (a shot turns heads). Everyone who perceived
     * something the player did remembers it (`witnessOf`, `witnessSaw`).
     *
     * Most react first (duck, run, gasp). A second or two after it the director
     * below hands the incident's phone to one of them, preferring someone who
     * saw it and is on screen: a shooting, a blast, a stabbing, a hit-and-run, a
     * body or a carjacking is always called in (seen or only heard); lesser
     * crimes sometimes. The caller runs a short way if the player is close
     * (CALL_SAFE_DISTANCE), stops, and makes the call (CALL, below: 5-8 s, phone
     * at the ear, a speech bubble all the way); only when it ends does
     * crowdReport() reach the police. Kill the caller or hold them at gunpoint
     * (most will not dare call again) and the call is lost; walk up to them and
     * they run and try again once clear. While living witnesses remain, the
     * director keeps handing the phone on until someone gets through.
     */
    const WITNESS_FOV = 1.75,
      WITNESS_FOV_PHONE = 0.8,
      // Seconds after an incident within which a call still brings the police
      // (a body: after the death, see UNREPORTED_KEEP in witnesses.js).
      WITNESS_REPORT_WINDOW = 75,
      // How sure a witness is to call (1: always, even someone who only heard it).
      WITNESS_CALL_CHANCE = { gunfire: 1, explosion: 1, melee: 1, knock: 1, body: 1, carjack: 1, theft: 0.8, crime: 0.6, crash: 0.35 },
      // Remembered per incident (the nearest first when the list is full).
      WITNESS_LIST_MAX = 20,
      // Seconds of quiet after the last shot or blast before the phone is handed out.
      WITNESS_LULL = 1,
      // A caller runs until this far from the player (about 15 m: still on screen
      // at the street camera's zoom), then phones; the player coming within
      // CALL_CUT_DISTANCE cuts the call (they run and try again).
      CALL_SAFE_DISTANCE = 120,
      CALL_CUT_DISTANCE = 60,
      CALL_SECONDS = [5, 8],
      // Reactions nobody is pulled out of to make a call: hands up or kneeling
      // under the gun, hurt on the ground, already on a phone, busy with a car.
      CALL_BLOCKING = new Set(['handsUp', 'kneel', 'groan', 'call', 'argue', 'help', 'returnCar']),
      // Moments over in a second or two: the director waits for them.
      CALL_WAIT = new Set(['startle', 'gasp', 'dodge', 'shout', 'point', 'fist']),
      // Frightened states the caller first runs out of (unless already clear).
      CALL_RUN_FIRST = new Set(['flee', 'shelter', 'cower', 'freeze']);
    let witnessDirectorTimer = 0,
      witnessToldAt = -100;
    /* Within the person's field of view (or close enough to notice regardless). */
    function witnessFacing(p, source, d) {
      if (d < 55) return true;
      const off = Math.abs(normalizeAngle(Math.atan2(source.y - p.y, source.x - p.x) - (p.a || 0)));
      return off < (p.texting || p.onPhone || p.state === 'phone' ? WITNESS_FOV_PHONE : WITNESS_FOV);
    }
    /* Someone perceived an incident the player caused (crowdAlarm, bodies). */
    function noteWitness(p, inc, sees, d) {
      if (!inc.witnesses) inc.witnesses = [];
      const list = inc.witnesses;
      if (!list.includes(p)) {
        if (list.length < WITNESS_LIST_MAX) list.push(p);
        else {
          // Full: the dead, or whoever is furthest from it, makes room for someone nearer.
          let worst = -1,
            worstD = d;
          for (let i = 0; i < list.length; i++) {
            const q = list[i],
              qd = q.hp > 0 ? Math.hypot(q.x - inc.x, q.y - inc.y) : Infinity;
            if (qd > worstD) {
              worst = i;
              worstD = qd;
            }
          }
          if (worst >= 0) list[worst] = p;
        }
      }
      // Someone who must call about something (witnessReport: a carjacked driver)
      // sticks to it; seeing something beats having heard something else.
      if (witnessMustCall(p) && p.witnessMust !== inc) return;
      const prev = p.witnessOf;
      if (prev && prev !== inc && !prev.reported && gameTime - (p.witnessAt ?? -100) < 30 && p.witnessSaw && !sees) return;
      if (prev === inc) {
        // More of the same (the next shot): they keep what they saw.
        p.witnessSaw = p.witnessSaw || sees;
        p.witnessD = Math.min(p.witnessD ?? d, d);
        return;
      }
      p.witnessOf = inc;
      p.witnessSaw = sees;
      p.witnessD = d;
      p.witnessAt = gameTime;
      // A moment to take it in (the director also waits for a lull in the shooting).
      p.witnessReadyAt = gameTime + 0.9 + d / 2000;
      if (p.witnessDeclined === inc) return;
      p.witnessDeclined = null;
    }
    function witnessCrimeTime(inc) {
      return inc.kind === 'body' ? (inc.focus?.deadTime ?? inc.start) : inc.time;
    }
    function witnessWindow(inc) {
      return inc.kind === 'body' ? UNREPORTED_KEEP : WITNESS_REPORT_WINDOW;
    }
    /* Told to call (witnessReport) and not through yet. */
    function witnessMustCall(p) {
      const must = p.witnessMust;
      return !!must && !must.reported && p.hp > 0 && gameTime - witnessCrimeTime(must) < witnessWindow(must);
    }
    /* Still has a call to make: the crowd streamer (crowd-streaming.js) neither
       moves nor redresses them. */
    function witnessOwesCall(p) {
      if (witnessMustCall(p)) return true;
      const inc = p.witnessOf;
      return !!inc && !inc.reported && gameTime - (p.witnessAt ?? -100) < 90;
    }
    /* Someone who must call but has left the street (indoors, out of the
       simulated ring): the call is made off stage from where they were. */
    function witnessCallsOffstage(p, inc) {
      if (offstageCalls.some((c) => c.person === p)) return;
      offstageCalls.push({ person: p, inc, readyAt: gameTime + randomBetween(1, 3), startedAt: -1, callTime: randomBetween(CALL_SECONDS[0], CALL_SECONDS[1]), hidden: true });
    }
    /**
     * VENUE WITNESSES: people the crowd does not run (North Point Key's guests,
     * staff and doormen in skyline-bar.js; MONARCH MOTORS' staff and visitors)
     * keep their own routines and never took the phone. One of them per
     * incident now phones 911 about what the player did, from where they stand
     * (an off-stage call with the street's bubbles; a street caller already on
     * the phone goes first). One too near the player hands it to one further off.
     */
    const VENUE_REPORTS = new Set(['gunfire', 'explosion', 'melee', 'knock', 'carjack', 'theft', 'crime', 'body']);
    function venueWitness(p, inc) {
      if (!inc || inc.attacker !== player || inc.reported || !VENUE_REPORTS.has(inc.kind) || !(p.hp > 0) || gameMode !== 'play') return false;
      if (gameTime - witnessCrimeTime(inc) > witnessWindow(inc)) return false;
      const mine = offstageCalls.find((c) => c.inc === inc && c.venue),
        busy = offstageCalls.some((c) => c.person === p);
      if (mine) {
        if (mine.startedAt < 0 && !busy && distanceBetween(mine.person, player) < CALL_CUT_DISTANCE && distanceBetween(p, player) >= CALL_CUT_DISTANCE) mine.person = p;
        return false;
      }
      if (busy) return false;
      offstageCalls.push({ person: p, inc, readyAt: gameTime + randomBetween(2.5, 5), startedAt: -1, callTime: randomBetween(CALL_SECONDS[0], CALL_SECONDS[1]), venue: true });
      witnessStats.venueCalls++;
      return true;
    }
    /* MONARCH MOTORS' people (game-people.js, before their own routine): what they
       perceived becomes a venue call, unless the showroom's alarm (dealershipAlarm:
       four stars at once) has already gone to the police. */
    function dealerWitness(p) {
      if (!p.dealer || !p.pending || gameTime < p.pending.at) return;
      if (!(dealer.alarmUntil > gameTime)) venueWitness(p, p.pending.inc);
      p.pending = null;
    }
    /* Could this witness be handed the phone now? True when nothing stops them. */
    function witnessCanCall(p, inc) {
      return !witnessCallBlock(p, inc);
    }
    /* Why not (for DeadEndCity.witnesses() too): '' when they can. */
    function witnessCallBlock(p, inc) {
      if (p.hp <= 0) return 'dead';
      if (p.witnessOf !== inc) return 'other';
      // Already calling off stage; gone indoors, recycled or never on the street
      // (only the street crowd is run).
      if (offstageCalls.some((c) => c.person === p)) return 'offstage';
      if (!pedestrians.includes(p)) return 'gone';
      if (p.silencedUntil > gameTime) return 'silenced';
      // Out of the simulated ring (updatePeople runs 1,500 units round) nothing
      // about them moves on, whatever state they were left in.
      if (distanceBetween(p, player) >= 1400) return 'far';
      if (p.pending || p.onDeck || p.posed || p.ejected || personIncapacitated(p)) return 'busy';
      if (p.react && CALL_BLOCKING.has(p.react.kind)) return p.react.kind;
      // A carjacked driver held at the door, frozen with the hands up, still
      // chasing the car or shouting at it (carjack.js).
      if (p.carjackHeld || p.handsUpUntil > gameTime || p.angryUntil > gameTime || p.witnessUntil > gameTime) return 'carjack';
      if (gameTime < (p.witnessReadyAt ?? 0)) return 'shaken';
      if (p.react && CALL_WAIT.has(p.react.kind)) return p.react.kind;
      return '';
    }
    /* On the street and simulated (updatePeople runs 1,500 units round): a caller
       out of that ring or off the street is frozen mid-call. */
    function witnessOnStage(p) {
      return distanceBetween(p, player) < 1400 && pedestrians.includes(p);
    }
    /* Someone is on the phone about it, or on the way to a phone (the incident's
       caller count is not given back when a caller dies or leaves the street). */
    function witnessCallUnderWay(inc) {
      const due = inc.callerDue;
      if (due) {
        const r = due.react;
        if (due.hp > 0 && r && r.inc === inc && (r.kind === 'call' ? !r.reported : r.then === 'call') && witnessOnStage(due)) return true;
        inc.callerDue = null;
      }
      if (inc.callers <= 0) return false;
      let live = 0;
      for (const p of inc.witnesses)
        if (p.hp > 0 && p.react?.kind === 'call' && p.react.inc === inc && !p.react.released && !p.react.reported && witnessOnStage(p)) live++;
      for (const c of offstageCalls) if (c.inc === inc && c.startedAt > 0 && !c.hidden) live++;
      if (!live) inc.callers = 0;
      return live > 0;
    }
    /**
     * THE DIRECTOR (four times a second)
     * For each unreported incident of the player's with nobody on the phone or
     * on the way to one, the best placed witness (someone told it to, saw it, on
     * screen, a short run from the player, brave) is handed the phone; one who
     * decides not to (lesser crimes only) is not asked again about that incident.
     */
    function witnessDirector(deltaSeconds) {
      witnessDirectorTimer -= deltaSeconds;
      if (witnessDirectorTimer > 0) return;
      witnessDirectorTimer = 0.25;
      if (gameMode !== 'play') return;
      for (const inc of crowd.incidents) {
        if (inc.attacker !== player || inc.reported || !inc.witnesses?.length) continue;
        if (gameTime - witnessCrimeTime(inc) > witnessWindow(inc)) continue;
        // Nobody reaches for a phone while the shots are still coming.
        if (inc.loud && gameTime - inc.time < WITNESS_LULL) continue;
        if (witnessCallUnderWay(inc)) continue;
        let best = null,
          bestScore = -Infinity;
        for (const p of inc.witnesses) {
          if (p.witnessDeclined === inc) continue;
          const why = witnessCallBlock(p, inc);
          if (why) {
            // Someone who must call, or was on the phone about it, still gets
            // through when they leave the street or the simulated ring: off stage.
            if (
              (why === 'gone' || why === 'far') &&
              ((p.witnessMust === inc && witnessMustCall(p)) || (p.react?.kind === 'call' && p.react.inc === inc && !p.react.reported))
            )
              witnessCallsOffstage(p, inc);
            continue;
          }
          const d = distanceBetween(p, player),
            score =
              (p.witnessMust === inc ? 3 : 0) +
              (p.witnessSaw ? 1.5 : 0) +
              (crowdInView(p.x, p.y, -30) ? 1.2 : 0) +
              (p.nerve ?? 0.5) -
              Math.abs(d - CALL_SAFE_DISTANCE * 1.3) / 400;
          if (score > bestScore) {
            best = p;
            bestScore = score;
          }
        }
        if (!best) continue;
        const base = WITNESS_CALL_CHANCE[inc.kind] ?? 0.5,
          chance = best.witnessMust === inc || base >= 1 ? 1 : base * (best.witnessSaw ? 1 : 0.55);
        if (seededRandom() > chance) {
          best.witnessDeclined = inc;
          continue;
        }
        witnessTakesPhone(best, inc);
      }
    }
    /* The chosen caller: straight to the phone when clear of the player, otherwise a short run first. */
    function witnessTakesPhone(p, inc) {
      const r = p.react,
        clear = distanceBetween(p, player) >= CALL_SAFE_DISTANCE;
      if (clear && !(r && CALL_RUN_FIRST.has(r.kind))) {
        beginWitnessCall(p, inc);
        return;
      }
      if (r && r.kind === 'flee') {
        // Already running: they stop once clear (fleeStep) and phone.
        r.inc = inc;
        r.then = 'call';
        r.thenExtra = null;
        r.dur = Math.min(Math.max(r.dur, r.t + 1.2), r.t + 5);
      } else startReaction(p, 'flee', randomBetween(2.5, 4), player, inc, { then: 'call' });
      inc.callerDue = p;
    }
    /* The talking part of a call reaction lasting `dur` (it ends 2.5 s after the report goes in). */
    function witnessCallLength(dur) {
      return clamp(dur - 2.5, CALL_SECONDS[0], CALL_SECONDS[1]);
    }
    function beginWitnessCall(p, inc) {
      const callTime = randomBetween(CALL_SECONDS[0], CALL_SECONDS[1]);
      startReaction(p, 'call', callTime + 2.5, { x: inc.x, y: inc.y }, inc, { callTime });
    }
    /**
     * THE CALL
     * The phone comes out (a moment of dialling, head down), then the line to
     * the operator and the details, each in a bubble until the next, and when it
     * ends the report goes in and the caller says the police are coming. The
     * player walking up (CALL_CUT_DISTANCE) or a gun on them cuts it off: they
     * run, and try again once clear unless scared silent.
     */
    function callStep(p, r, deltaSeconds) {
      if (!r.counted) {
        // Someone else got through while they were running for it: no call.
        if (r.inc?.reported && r.inc.attacker === player) {
          r.dur = r.t;
          return false;
        }
        r.counted = true;
        r.callTime ??= witnessCallLength(r.dur);
        r.dur = Math.max(r.dur, r.callTime + 2.5);
        witnessStats.calls++;
      }
      p.onPhone = true;
      p.pose = r.t < 0.6 ? 'text' : 'phone';
      const threat = r.inc?.attacker;
      if (!r.reported && (p.silencedUntil > gameTime || (threat && threat.hp > 0 && distanceBetween(p, threat) < CALL_CUT_DISTANCE))) {
        witnessStats.dropped++;
        const inc = r.inc,
          retry = inc && inc.attacker === player && !inc.reported && !r.then && !(p.silencedUntil > gameTime);
        startReaction(p, 'flee', randomBetween(3, 5), threat || r.from, inc, retry ? { scream: true, then: 'call' } : { scream: true });
        if (retry) inc.callerDue = p;
        return true;
      }
      // Turned half away, the way people talk on the phone about something.
      faceToward(p, r.from || player, deltaSeconds, 2);
      witnessCallLines(p, r.inc, r.t, r.callTime, r);
      if (!r.reported && r.t >= r.callTime) {
        r.reported = true;
        crowdReport(p, r.inc);
        sayCallLine(p, randomChoice(CALL_CLOSING), 2.4);
        r.dur = Math.min(r.dur, r.t + 2);
      }
      return false;
    }
    /* The call's bubbles, back to back: the opening (what and where), then a
       detail until the end (crowd callers and off-stage callers alike). */
    function witnessCallLines(p, inc, t, callTime, s) {
      if (s.reported) return;
      if (!s.opened) {
        if (t < 0.5) return;
        s.opened = true;
        s.detailAt = t + clamp(callTime * 0.45, 2.4, 3.6);
        sayCallLine(p, call911Opening(inc, p), s.detailAt - t + 0.3);
        // On screen and about the player: the one warning they get.
        if (inc?.attacker === player && !inc.reported && wantedStars <= 0 && crowdInView(p.x, p.y, 0) && gameTime - witnessToldAt > 12) {
          witnessToldAt = gameTime;
          tell('SOMEONE IS CALLING 911', 2.2);
        }
        return;
      }
      if (!s.detailed && t >= s.detailAt) {
        s.detailed = true;
        sayCallLine(p, call911Detail(inc, p), Math.max(1.5, callTime - t) + 0.3);
      }
    }
    function sayCallLine(p, text, seconds) {
      if (!text) return;
      p.speech = text;
      p.speechUntil = gameTime + seconds;
      p.speechKind = 'call911';
      p.speechKindText = text;
      p.lastLine = text;
    }
    /* A witness held at gunpoint: most will not dare call now. */
    function witnessThreatened(p) {
      const inc = p.witnessOf;
      if (!inc || inc.reported || p.silencedUntil > gameTime) return;
      if ((p.nerve ?? 0.5) < 0.85 || seededRandom() < 0.5) {
        p.silencedUntil = gameTime + 180;
        witnessStats.silenced++;
      }
    }
    /* Someone who ran inside a shop can still make the call from in there (it
       waits while a caller on the street is on the phone about it). */
    function witnessCallsFromInside(p) {
      const inc = p.witnessOf;
      if (!inc || inc.reported || inc.attacker !== player || p.silencedUntil > gameTime) return;
      if (offstageCalls.some((c) => c.inc === inc && c.hidden)) return;
      if (seededRandom() > (WITNESS_CALL_CHANCE[inc.kind] ?? 0.5)) return;
      offstageCalls.push({ person: p, inc, readyAt: gameTime + randomBetween(2, 5), startedAt: -1, callTime: randomBetween(CALL_SECONDS[0], CALL_SECONDS[1]), hidden: true });
    }

    /**
     * WITNESS CALLS
     * A completed call is the only way a bystander changes the wanted level, and
     * only for what the player did: with no stars, a call brings the police to
     * where it happened (witnesses.js); while they are already searching, a
     * caller who can see you tells them where you are.
     */
    function crowdReport(caller, inc) {
      if (!inc || inc.reported) return;
      inc.reported = true;
      crowd.reports++;
      crowd.lastReportAt = gameTime;
      if (inc.attacker !== player || gameMode !== 'play' || distanceBetween(inc, player) > 1800) return;
      if (gameTime - witnessCrimeTime(inc) > witnessWindow(inc)) return;
      if (wantedStars <= 0) {
        reportIncidentToPolice(inc, caller);
        return;
      }
      // Already wanted: anything still unreported about it adds its heat...
      reportIncidentToPolice(inc, caller);
      // ...and a caller who can see the player gives the searchers a position.
      if (searchActive && caller && distanceBetween(caller, player) < 450 && crowdSight(caller, player)) {
        lastSeen = { x: player.x, y: player.y };
        searchRemaining = Math.min(policeSearchSeconds(), searchRemaining + 2);
        tell('A WITNESS IS GIVING THE POLICE YOUR POSITION', 2.6);
      }
    }
