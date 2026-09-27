    // Crowd witnesses: who really saw or heard what the player did, who gets somewhere safe and phones 911,
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
     * Most react first (duck, run, gasp). A few seconds after it, once they are
     * out of the fear reaction and the player is not on top of them, the
     * director below hands the incident's phone to one of them: someone who saw
     * a serious crime always calls, someone who only heard it sometimes. The call
     * (CALL, below) takes 5-12 s; only when it ends does crowdReport() reach the
     * police. Kill the caller, hold them at gunpoint (they may not dare call
     * again) or get to them and the call is lost; another witness may try later.
     */
    const WITNESS_FOV = 1.75,
      WITNESS_FOV_PHONE = 0.8,
      // Seconds after an incident within which a call still brings the police
      // (a body: after the death, see UNREPORTED_KEEP in witnesses.js).
      WITNESS_REPORT_WINDOW = 75,
      // Incident kinds that are always crimes, and how sure a witness is to call.
      WITNESS_CALL_CHANCE = { gunfire: 1, explosion: 1, melee: 1, knock: 1, body: 1, carjack: 1, theft: 0.8, crime: 0.6, crash: 0.35 },
      // Reactions that leave no hand free for a phone (or no nerve).
      CALL_BLOCKING = new Set(['flee', 'cower', 'freeze', 'shelter', 'dodge', 'handsUp', 'kneel', 'groan', 'call', 'point', 'fist', 'shout', 'argue', 'help', 'returnCar']);
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
      if (inc.witnesses.length < 12 && !inc.witnesses.includes(p)) inc.witnesses.push(p);
      // Seeing something beats having heard something else.
      const prev = p.witnessOf;
      if (prev && prev !== inc && !prev.reported && gameTime - (p.witnessAt ?? -100) < 30 && p.witnessSaw && !sees) return;
      p.witnessOf = inc;
      p.witnessSaw = sees;
      p.witnessD = d;
      p.witnessAt = gameTime;
      p.witnessReadyAt = gameTime + randomBetween(2.5, 6) + d / 500;
      if (p.witnessDeclined === inc) return;
      p.witnessDeclined = null;
    }
    function witnessCrimeTime(inc) {
      return inc.kind === 'body' ? (inc.focus?.deadTime ?? inc.start) : inc.time;
    }
    function witnessWindow(inc) {
      return inc.kind === 'body' ? UNREPORTED_KEEP : WITNESS_REPORT_WINDOW;
    }
    /* Free, calm enough and far enough from the player to make the call. */
    function witnessCanCall(p, inc) {
      if (p.hp <= 0 || p.witnessOf !== inc || gameTime < (p.witnessReadyAt ?? 0) || p.silencedUntil > gameTime) return false;
      if (p.pending || p.onDeck || p.posed || p.ejected || personIncapacitated(p)) return false;
      if (p.react && CALL_BLOCKING.has(p.react.kind)) return false;
      // A carjacked driver still chasing the car or shouting at it (carjack.js).
      if (p.angryUntil > gameTime || p.witnessUntil > gameTime) return false;
      // Clear of the player, and near enough to be simulated (updatePeople runs 1,500 units round).
      const d = distanceBetween(p, player);
      return d > 140 && d < 1400;
    }
    /**
     * THE DIRECTOR (four times a second)
     * For each unreported incident of the player's with nobody on the phone yet,
     * the best placed witness (saw it, nearest, bravest) decides whether to call;
     * one who decides not to is not asked again about that incident.
     */
    function witnessDirector(deltaSeconds) {
      witnessDirectorTimer -= deltaSeconds;
      if (witnessDirectorTimer > 0) return;
      witnessDirectorTimer = 0.25;
      if (gameMode !== 'play') return;
      for (const inc of crowd.incidents) {
        if (inc.attacker !== player || inc.reported || inc.callers > 0 || !inc.witnesses?.length) continue;
        if (gameTime - witnessCrimeTime(inc) > witnessWindow(inc)) continue;
        let best = null,
          bestScore = -Infinity;
        for (const p of inc.witnesses) {
          if (p.witnessDeclined === inc || !witnessCanCall(p, inc)) continue;
          const score = (p.witnessMust === inc ? 3 : 0) + (p.witnessSaw ? 1.5 : 0) + (p.nerve ?? 0.5) - (p.witnessD || 0) / 800;
          if (score > bestScore) {
            best = p;
            bestScore = score;
          }
        }
        if (!best) continue;
        const chance = best.witnessMust === inc ? 1 : (WITNESS_CALL_CHANCE[inc.kind] ?? 0.5) * (best.witnessSaw ? 1 : 0.55);
        if (seededRandom() > chance) {
          best.witnessDeclined = inc;
          continue;
        }
        beginWitnessCall(best, inc);
      }
    }
    function beginWitnessCall(p, inc) {
      const callTime = randomBetween(5, 12);
      startReaction(p, 'call', callTime + 2.5, { x: inc.x, y: inc.y }, inc, { callTime });
    }
    /**
     * THE CALL
     * The phone comes out (a second of dialling, head down), then the line to the
     * operator, the details a moment later, and when it ends the report goes in.
     * The player walking up (100 units) or a gun on them cuts it off.
     */
    function callStep(p, r, deltaSeconds) {
      if (!r.counted) {
        r.counted = true;
        r.callTime ??= clamp(r.dur - 2.5, 5, 12);
        witnessStats.calls++;
      }
      p.onPhone = true;
      p.pose = r.t < 1 ? 'text' : 'phone';
      const threat = r.inc?.attacker;
      if (!r.reported && (p.silencedUntil > gameTime || (threat && threat.hp > 0 && distanceBetween(p, threat) < 100))) {
        witnessStats.dropped++;
        startReaction(p, 'flee', randomBetween(6, 9), threat || r.from, r.inc, { scream: true });
        return true;
      }
      // Turned half away, the way people talk on the phone about something.
      faceToward(p, r.from || player, deltaSeconds, 2);
      if (!r.opened && r.t > 1.1) {
        r.opened = true;
        sayCallLine(p, call911Opening(r.inc, p), 3.6);
        // On screen and about the player: the one warning they get.
        if (r.inc?.attacker === player && !r.inc.reported && wantedStars <= 0 && crowdInView(p.x, p.y, 0) && gameTime - witnessToldAt > 12) {
          witnessToldAt = gameTime;
          tell('SOMEONE IS CALLING 911', 2.2);
        }
      }
      if (r.opened && !r.detailed && r.t > Math.max(4.2, r.callTime * 0.6)) {
        r.detailed = true;
        sayCallLine(p, call911Detail(r.inc, p), 3.2);
      }
      if (!r.reported && r.t >= r.callTime) {
        r.reported = true;
        crowdReport(p, r.inc);
        if (seededRandom() < 0.6) sayCallLine(p, randomChoice(CALL_CLOSING), 2.4);
        r.dur = Math.min(r.dur, r.t + 2);
      }
      return false;
    }
    function sayCallLine(p, text, seconds) {
      if (!text) return;
      p.speech = text;
      p.speechUntil = gameTime + seconds;
      p.speechKind = 'call911';
      p.speechKindText = text;
      p.lastLine = text;
    }
    /* A witness put under the gun: most will not dare call now. */
    function witnessThreatened(p) {
      const inc = p.witnessOf;
      if (!inc || inc.reported || p.silencedUntil > gameTime) return;
      if ((p.nerve ?? 0.5) < 0.85 || seededRandom() < 0.5) {
        p.silencedUntil = gameTime + 180;
        witnessStats.silenced++;
      }
    }
    /* Someone who ran inside a shop can still make the call from in there. */
    function witnessCallsFromInside(p) {
      const inc = p.witnessOf;
      if (!inc || inc.reported || inc.attacker !== player || inc.callers > 0 || p.silencedUntil > gameTime) return;
      if (seededRandom() > 0.5 * (WITNESS_CALL_CHANCE[inc.kind] ?? 0.5)) return;
      offstageCalls.push({ person: p, inc, readyAt: gameTime + randomBetween(2, 5), startedAt: -1, callTime: randomBetween(6, 12), hidden: true });
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
