    // Blue Hour stealth: the bodyguards' beats and scanning heads, the vision-cone suspicion meter, walking and running on the terrace.
    /* BODYGUARDS AND SUSPICION
       Four bodyguards walk fixed beats round the terrace, stop at each post facing
       into the party and sweep their heads across it. A guard notices the player
       only inside his cone (roofGuardSees: ROOF_VIEW's angle and range, a clear
       line of sight past the cover and inside the balustrade). While any guard
       sees the player the suspicion meter (m.suspicion, 0-100) fills: slowly for
       a guest walking at the far end of a cone, faster up close, faster again
       for running (nobody runs at a party) or hovering at Vescari's side; the
       longer one guard watches, the less he likes it. Out of every cone it drains
       after a second. At 100 the cover is blown (roofAlarm). Brushing past a
       guard from behind is a nudge (+10) and he turns his head to look. A guard
       watching someone suspicious follows them with his head, turns to face them
       past 60 and walks over past 80; when he loses them he checks where he last
       saw them, then goes back to his beat.
       During the job the terrace is walked: the walk key runs (footPace). */
    const ROOF_BUMP = 11,
      ROOF_RUN_SPEED = 9 * KMH,
      // After Vescari collapses, being seen walking never takes the meter past this.
      ROOF_WARY = 60;
    /* The Blue Hour job inverts the walk key on the terrace (game-state.js footPace). */
    function roofPartyPace() {
      return !!player.roof && !!rooftopJob();
    }
    /* The player's pace on the terrace, measured from how far they actually moved. */
    function trackRoofPace(m, deltaSeconds) {
      const last = m.lastPlayerSpot;
      let speed = 0;
      if (last && deltaSeconds > 0 && player.roof) {
        const moved = Math.hypot(player.x - last.x, player.y - last.y);
        // A jump (the lift arriving, a console move) is not a run.
        if (moved < 40) speed = moved / deltaSeconds;
      }
      m.lastPlayerSpot = { x: player.x, y: player.y };
      m.playerSpeed = (m.playerSpeed || 0) + (speed - (m.playerSpeed || 0)) * Math.min(1, deltaSeconds * 8);
    }
    function roofPlayerRunning(m) {
      return !!player.roof && (m.playerSpeed || 0) > ROOF_RUN_SPEED;
    }
    function turnToward(current, target, maxStep) {
      return current + clamp(normalizeAngle(target - current), -maxStep, maxStep);
    }
    /* A line from a guard at most once every `gap` seconds per kind. */
    function guardLine(e, kind, text, gap = 8) {
      e.said = e.said || {};
      if (gameTime < (e.said[kind] ?? -99) + gap) return;
      e.said[kind] = gameTime;
      roofSay(e, text, 2.2);
    }
    /* Anyone watching the player right now (cone and line of sight). */
    function poisonWitness(m) {
      return enemies.find(
        (e) => e.guard && e.hp > 0 && e.missionTag === 'rooftop-hit' && roofGuardSees(e, player),
      );
    }
    /* One bodyguard's frame before the alarm: what he sees, where he looks, where he walks. */
    function updateRoofGuard(m, e, deltaSeconds) {
      e.walking = false;
      e.scan = (e.scan || 0) + deltaSeconds;
      e.look = e.look || 0;
      const sees = player.roof && gameMode === 'play' && roofGuardSees(e, player),
        d = distanceBetween(e, player);
      e.sees = sees;
      if (sees) {
        e.seenFor = (e.seenFor || 0) + deltaSeconds;
        e.lastSeen = { x: player.x, y: player.y };
      } else e.seenFor = Math.max(0, (e.seenFor || 0) - deltaSeconds * 2);
      // How the cone is drawn (roofmission3d.js): warms while he watches.
      e.alert = clamp((e.alert || 0) + (sees ? deltaSeconds * (0.5 + m.suspicion / 100) : -deltaSeconds * 0.3), 0, 1);
      if (sees) {
        if (roofPlayerRunning(m)) guardLine(e, 'run', 'Easy. Nobody runs up here.', 6);
        else if (m.boss.hp > 0 && distanceBetween(player, m.boss) < 44) guardLine(e, 'boss', 'Give Mr. Vescari some room.');
        else if (m.suspicion > 30) guardLine(e, 'hm', 'Hm?', 10);
        if (m.suspicion > 78) guardLine(e, 'stop', 'You. Hold it right there.', 12);
      }
      // Brushing past him: a nudge and a look, not the alarm.
      if (player.roof && d < ROOF_BUMP && gameTime > (e.bumpAt ?? -9) + 2.5) {
        e.bumpAt = gameTime;
        m.suspicion = Math.min(99, m.suspicion + 10);
        guardLine(e, 'bump', 'Watch it, pal.', 3);
        e.look = clamp(normalizeAngle(headingBetween(e, player) - e.a), -1.1, 1.1);
      }
      if (e.pinned) return; // console roofGuard(): held still for a test
      if (m.partyPanic) {
        updateGuardAtScene(m, e, deltaSeconds);
        return;
      }
      // Watching someone who does not look right: the head follows them.
      const watching = sees && (m.suspicion > 25 || roofPlayerRunning(m) || d < ROOF_VIEW.near);
      if (watching) {
        const toward = headingBetween(e, player);
        if (m.suspicion > 60 || Math.abs(normalizeAngle(toward - e.a)) > 0.9)
          e.a = turnToward(e.a, toward, deltaSeconds * 2.2);
        e.look = turnToward(e.look, clamp(normalizeAngle(toward - e.a), -0.9, 0.9), deltaSeconds * 3);
        e.investigate = null;
        if (m.suspicion > 60) e.patrolWait = Math.max(e.patrolWait, 2.5);
        if (m.suspicion > 80 && d > 24) roofStep(e, player, deltaSeconds, 3.6 * KMH);
        return;
      }
      // Lost them while wary: go and look where they were.
      if (!sees && e.lastSeen && m.suspicion > 45 && !e.investigate) {
        e.investigate = { ...e.lastSeen, until: gameTime + 9, arrived: 0 };
        e.roofRoute = null;
        guardLine(e, 'lost', 'Where did he go?', 12);
      }
      e.lastSeen = sees ? e.lastSeen : m.suspicion > 45 ? e.lastSeen : null;
      if (e.investigate) {
        const spot = e.investigate;
        if (!spot.arrived && distanceBetween(e, spot) > 6 && gameTime < spot.until) {
          roofStep(e, spot, deltaSeconds, 3.8 * KMH);
          e.look = turnToward(e.look, 0, deltaSeconds * 2);
          if (!e.roofRoute) spot.arrived = gameTime; // unreachable (inside cover): look from here
        } else {
          spot.arrived = spot.arrived || gameTime;
          e.look = Math.sin((gameTime - spot.arrived) * 1.6) * 0.8;
          if (gameTime - spot.arrived > 2.8 || gameTime > spot.until + 3) {
            e.investigate = null;
            e.lastSeen = null;
            e.roofRoute = null;
          }
        }
        return;
      }
      if (e.patrolWait > 0) {
        // At his post: face into the party and sweep it.
        e.patrolWait -= deltaSeconds;
        if (e.postA !== undefined) e.a = turnToward(e.a, e.postA, deltaSeconds * 1.4);
        e.look = turnToward(e.look, Math.sin(e.scan * 0.75 + e.patrol * 1.9) * 0.62, deltaSeconds * 1.5);
        return;
      }
      const goal = e.patrolRoute[e.patrolIndex];
      roofStep(e, goal, deltaSeconds, 4 * KMH);
      // Walking his beat: glances either side.
      e.look = turnToward(e.look, Math.sin(e.scan * 0.5 + e.patrol * 1.3) * 0.32, deltaSeconds * 1.5);
      if (distanceBetween(e, goal) < 3) {
        e.patrolIndex = (e.patrolIndex + 1) % e.patrolRoute.length;
        e.patrolWait = 3 + e.patrol;
        e.roofRoute = null;
        e.postA = headingBetween(e, roofAt(180, 180)) + (e.patrol % 2 ? 0.35 : -0.35);
      }
    }
    /* Vescari down in front of everyone (or found later): the detail closes round
       him, facing out over the crowd; one radios the lobby (roofmission-poison.js). */
    function updateGuardAtScene(m, e, deltaSeconds) {
      const b = m.boss,
        radio = m.medical?.radio === e;
      // Each keeps his own place round him (found once: the body does not move).
      if (!e.scenePost)
        e.scenePost =
          roofSpotNear(b, radio ? 12 : 30, [0.8, 2.35, -2.35, -0.8][e.patrol % 4], radio ? 5 : 8) ||
          roofAt(ROOF_HIT.seat.x - ROOFTOP.x + (e.patrol - 1) * 23, ROOF_HIT.seat.y - ROOFTOP.y + 31);
      const goal = e.scenePost;
      e.atScene = distanceBetween(e, goal) <= 4;
      if (!e.atScene) {
        roofStep(e, goal, deltaSeconds, (radio ? 7 : 5.5) * KMH);
        e.look = turnToward(e.look, 0, deltaSeconds * 2);
        return;
      }
      if (radio) {
        e.a = turnToward(e.a, headingBetween(e, b), deltaSeconds * 3);
        e.look = turnToward(e.look, 0, deltaSeconds * 2);
        return;
      }
      // Holding the ring: facing away from him, sweeping the guests.
      e.a = turnToward(e.a, headingBetween(b, e), deltaSeconds * 1.5);
      if (e.sees && (m.suspicion > 25 || roofPlayerRunning(m)))
        e.look = turnToward(e.look, clamp(normalizeAngle(headingBetween(e, player) - e.a), -0.9, 0.9), deltaSeconds * 3);
      else e.look = turnToward(e.look, Math.sin(e.scan * 0.7 + e.patrol * 1.9) * 0.7, deltaSeconds * 1.5);
    }
    /* The meter: filled by whoever sees the player now, drained when nobody does. */
    function updateRoofSuspicion(m, deltaSeconds, guards) {
      if (m.alarm) return;
      const running = roofPlayerRunning(m);
      let top = 0,
        sum = 0;
      for (const e of guards) {
        if (!e.guard || !e.sees) continue;
        const d = distanceBetween(e, player),
          close = clamp(1 - d / ROOF_VIEW.range, 0, 1);
        // A guest walking at the far end of his cone barely registers.
        let rate = 2.5 + 15 * close * close;
        // Round Vescari on the floor every guest is staring: standing among them
        // is no giveaway (it tops out at WARY below), running still is.
        if (m.medical) rate *= 0.5;
        else if (d < ROOF_VIEW.near) rate += 7;
        if (running) rate += 8;
        if (m.boss.hp > 0 && distanceBetween(player, m.boss) < 44) rate += 6;
        rate *= 1 + Math.min(e.seenFor, 4) * 0.12;
        // Just brushed past him: a look, not a stare.
        if (gameTime - (e.bumpAt ?? -9) < 1.6) rate *= 0.4;
        top = Math.max(top, rate);
        sum += rate;
      }
      let rate = top + 0.35 * (sum - top);
      if (m.medical && !running && m.suspicion >= ROOF_WARY) rate = Math.min(rate, 0.0001);
      m.suspicionRate = rate;
      if (rate > 0) {
        m.suspicion += rate * deltaSeconds;
        m.unseenFor = 0;
      } else {
        m.unseenFor = (m.unseenFor || 0) + deltaSeconds;
        if (m.unseenFor > 1) m.suspicion -= 8 * deltaSeconds;
      }
      m.suspicion = clamp(m.suspicion, 0, 100);
      if (player.roof && (m.weaponDrawn || m.suspicion >= 100)) roofAlarm(m);
    }
    /* Console (game-console-missions.js): the stealth state in one object. */
    function roofStealthReport() {
      const m = rooftopJob();
      if (!m) return null;
      const local = (p) => ({ x: Math.round(p.x - ROOFTOP.x), y: Math.round(p.y - ROOFTOP.y) });
      return {
        stage: m.stage,
        onRoof: !!player.roof,
        player: local(player),
        pace: Math.round(speedKmh(m.playerSpeed || 0) * 10) / 10,
        running: roofPlayerRunning(m),
        suspicion: Math.round(m.suspicion * 10) / 10,
        rate: Math.round((m.suspicionRate || 0) * 10) / 10,
        alarm: !!m.alarm,
        partyPanic: !!m.partyPanic,
        guards: enemies
          .filter((e) => e.guard && e.missionTag === 'rooftop-hit')
          .map((e) => ({
            name: e.name,
            ...local(e),
            hp: Math.round(e.hp),
            heading: Math.round(e.a * 100) / 100,
            view: Math.round(roofGuardView(e) * 100) / 100,
            sees: !!e.sees,
            alert: Math.round((e.alert || 0) * 100) / 100,
            pinned: !!e.pinned,
          })),
      };
    }
