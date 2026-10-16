    // Wheelie distance and milestones: actual airborne path, one bounded player-bike reference,
    // pause-safe result/milestone clocks and a compact HUD. Physics calls after each displacement.
    const WHEELIE_SCORE_START = 0.075,
      WHEELIE_SCORE_KEEP = 0.05,
      WHEELIE_SCORE_CONFIRM = 0.08,
      WHEELIE_SCORE_TOUCHDOWN = 0.12,
      WHEELIE_SCORE_STOP = 0.18,
      wheelieScoreState = {
        car: null, phase: 'idle', metres: 0, air: 0, ground: 0, stopped: 0,
        lastX: 0, lastY: 0, hp: 0, clock: 0, grade: 0, pulse: 0,
        milestoneUntil: 0, resultUntil: 0, reason: '', runs: 0, best: 0, blockedId: null,
      },
      wheelieScoreHud = { on: false, progress: '', fadeAt: -1e9, faded: false };
    // Releasing this reference matters: a world reset replaces every vehicle.
    function resetWheelieScore() {
      const S = wheelieScoreState;
      S.car = null;
      S.phase = 'idle';
      S.metres = S.air = S.ground = S.stopped = S.clock = 0;
      S.grade = S.pulse = S.runs = S.best = 0;
      S.milestoneUntil = S.resultUntil = 0;
      S.reason = '';
      S.blockedId = null;
      wheelieScoreHud.faded = false;
      wheelieScoreHud.fadeAt = -1e9;
      updateWheelieScoreHud();
    }
    function finishWheelieScore(reason) {
      const S = wheelieScoreState;
      if (S.phase !== 'active' && S.phase !== 'confirming') return;
      const confirmed = S.phase === 'active';
      S.blockedId = reason === 'landed' ? null : (S.car?.id ?? -1);
      S.car = null;
      S.reason = reason;
      if (confirmed) {
        S.phase = 'result';
        S.best = Math.max(S.best, S.metres);
        S.runs++;
        S.resultUntil = S.clock + 4;
      } else {
        S.phase = 'idle';
        S.metres = S.grade = 0;
      }
    }
    // A rendered lift: the front tyre is completely unloaded at 0.04 rad. Higher
    // start/keep thresholds and 80 ms confirmation exclude fork chatter and tiny hops.
    function wheelieScoreStep(c, dt, fromX, fromY) {
      if (gameMode !== 'play' || !(dt > 0) || dt > 0.1) return;
      const S = wheelieScoreState;
      if (S.car && (S.car.fallen || S.car.hp <= 0 || player.thrown || player.hp <= 0)) finishWheelieScore('crashed');
      else if (S.car && (S.car !== c || player.car !== S.car)) finishWheelieScore('exited');
      if (!c || player.car !== c || !vehicleSpec(c).bike) return;
      if (S.blockedId !== null) {
        if (S.blockedId !== (c.id ?? -1) || (c.wheelie || 0) <= WHEELIE_SCORE_KEEP) S.blockedId = null;
        else return;
      }
      if (c.fallen || c.hp <= 0 || player.thrown || player.hp <= 0) {
        finishWheelieScore('crashed');
        return;
      }
      if (c.rideAir || c.cliffAir || c.deckAir || c.overturned) {
        finishWheelieScore('airborne');
        return;
      }
      const step = Math.hypot(c.x - fromX, c.y - fromY),
        speed = Math.hypot(c.vx || 0, c.vy || 0),
        // A displaced origin catches console/travel repositioning before this step;
        // an implausible segment catches relocation during it. Never score either.
        discontinuous = !Number.isFinite(step + fromX + fromY) ||
          step > Math.max(UNITS_PER_METRE * 0.5, Math.min(speed, UNITS_PER_METRE * 160) * dt * 1.6 + 0.5) ||
          (S.car === c && Math.hypot(fromX - S.lastX, fromY - S.lastY) > UNITS_PER_METRE * 0.5);
      if (discontinuous) {
        finishWheelieScore('relocated');
        return;
      }
      if (S.car === c && c.hp < S.hp - 0.01) {
        finishWheelieScore('crashed');
        return;
      }
      const airborne = (c.wheelie || 0) > (S.car === c ? WHEELIE_SCORE_KEEP : WHEELIE_SCORE_START);
      if (!S.car) {
        if (!airborne || step < 0.0001 || speed < UNITS_PER_METRE * 0.3) return;
        S.car = c;
        S.phase = 'confirming';
        S.metres = S.air = S.ground = S.stopped = 0;
        S.grade = 0;
        S.milestoneUntil = S.resultUntil = 0;
        S.reason = '';
      }
      S.lastX = c.x;
      S.lastY = c.y;
      S.hp = c.hp;
      if (speed < UNITS_PER_METRE * 0.3 || step < 0.0001) {
        S.stopped += dt;
        if (S.stopped + 1e-8 >= WHEELIE_SCORE_STOP) finishWheelieScore('stopped');
      } else S.stopped = 0;
      if (!S.car) return;
      if (!airborne) {
        if (S.phase === 'confirming') S.metres = S.air = 0;
        S.ground += dt;
        if (S.ground + 1e-8 >= WHEELIE_SCORE_TOUCHDOWN) finishWheelieScore('landed');
        return;
      }
      S.ground = 0;
      S.air += dt;
      // Position deltas, not a speed integral: curves count their path; a spinning
      // tyre or stationary balance contributes zero. Ground segments never count.
      if (speed >= UNITS_PER_METRE * 0.3) S.metres += step / UNITS_PER_METRE;
      if (S.phase === 'confirming' && S.air + 1e-8 >= WHEELIE_SCORE_CONFIRM && S.metres >= 0.1) S.phase = 'active';
      const grade = S.metres > 200 ? 2 : S.metres > 100 ? 1 : 0;
      if (grade > S.grade) {
        S.grade = grade;
        S.pulse++;
        S.milestoneUntil = S.clock + 1.6;
        // Existing tone() uses the game's master bus and Sound/volume settings.
        tone(grade === 2 ? 880 : 660, 0.22, 0.07, 'sine', grade === 2 ? 1320 : 990);
        tone(grade === 2 ? 1320 : 990, 0.36, 0.035, 'sine');
      }
    }
    // Once per gameplay update, after the car steps. The result also ages while on
    // foot; pause, map and other panels hold both animation and reading time.
    function updateWheelieScore(dt) {
      const S = wheelieScoreState;
      if (S.car && (S.car.fallen || S.car.hp <= 0 || player.thrown || player.hp <= 0 || gameMode === 'dead')) finishWheelieScore('crashed');
      else if (S.car && player.car !== S.car) finishWheelieScore('exited');
      else if (S.car && S.car.hp < S.hp - 0.01) finishWheelieScore('crashed');
      if (gameMode !== 'play') return;
      S.clock += Math.max(0, Math.min(dt, 0.1));
      if (S.phase === 'result' && S.clock >= S.resultUntil) S.phase = 'idle';
    }
    function updateWheelieScoreHud() {
      const S = wheelieScoreState, H = wheelieScoreHud, el = getElement('wheelieScore'),
        on = gameMode === 'play' && (S.phase === 'active' || S.phase === 'result');
      if (!el) return;
      if (on !== H.on) {
        H.on = on;
        if (el.classList.contains('on') !== on) el.classList.toggle('on', on);
        remeasureMissionCard();
      }
      hudAttr(el, 'aria-hidden', !on);
      if (!on) return;
      const label = S.grade === 2 ? 'Amazing!' : S.grade === 1 ? 'GREAT!' : '',
        result = S.phase === 'result',
        progress = String((S.grade === 2 ? 1 : Math.min(1, (S.metres - S.grade * 100) / 100)).toFixed(4)),
        p = hudPlayerBox(cardClear.player), b = cardClear.wheelie,
        covers = b.ok && clearBoxesMeet(p, b.l, b.t, b.r, b.b, H.faded ? CLEAR_MARGIN_BACK : CLEAR_MARGIN);
      if (covers) { H.faded = true; H.fadeAt = gameTime; }
      else if (H.faded && gameTime - H.fadeAt >= CLEAR_HOLD) H.faded = false;
      if (el.classList.contains('yield-fade') !== H.faded) el.classList.toggle('yield-fade', H.faded);
      getElement('wheelieScoreDistance').textContent = String(Math.floor(S.metres + 1e-8));
      getElement('wheelieScoreLabel').textContent = result ? (S.reason === 'landed' ? 'WHEELIE LANDED' : 'WHEELIE ENDED') : 'WHEELIE DISTANCE';
      getElement('wheelieScoreGrade').textContent = label || (result ? 'Nice ride' : 'Keep it up');
      getElement('wheelieScoreNext').textContent = result ? 'FINAL DISTANCE' : S.grade === 2 ? 'KEEP THE STREAK ALIVE' : (S.grade === 1 ? '200 m · Amazing!' : '100 m · GREAT!');
      hudAttr(el, 'data-grade', S.grade);
      hudAttr(el, 'data-phase', result ? 'result' : 'active');
      hudAttr(el, 'data-celebrate', S.clock < S.milestoneUntil ? (S.pulse % 2 ? 'a' : 'b') : '');
      if (H.progress !== progress) {
        H.progress = progress;
        el.style.setProperty('--wheelie-progress', progress);
      }
    }
    // Read-only console evidence: no vehicle object or writable module state escapes.
    function wheelieScoreReport() {
      const S = wheelieScoreState;
      return {
        phase: S.phase, tracking: !!S.car, type: S.car?.type || null,
        metres: +S.metres.toFixed(3), grade: S.grade,
        distanceM: +S.metres.toFixed(3), tier: S.grade,
        milestone: S.grade === 2 ? 'Amazing!' : S.grade === 1 ? 'GREAT!' : '',
        milestonePulses: S.pulse, reason: S.reason,
        airborneSeconds: +S.air.toFixed(3), touchdownSeconds: +S.ground.toFixed(3),
        resultSeconds: S.phase === 'result' ? +Math.max(0, S.resultUntil - S.clock).toFixed(3) : 0,
        runs: S.runs, bestMetres: +S.best.toFixed(3),
      };
    }
