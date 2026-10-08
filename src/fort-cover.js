    // Fort Sentinel cover: the borrowed army uniform (wearUniform), the stolen pass shown at the gate, the cover
    // state and its small API for a mission (fortCoverBegin/End/Report), military vehicles and walking out.
    /* FORT COVER
       A mission drives it: fortCoverBegin() when the player holds the stolen badge, wearUniform(true) when he has
       the uniform on, then polls fortCover (or fortCoverReport()). On foot, in uniform, with no stars and nothing
       in his hands, the gate guard asks for ID instead of challenging him; shown papers clear him and while cleared
       (and not alarmed) the base leaves him alone (militaryThreatened, updateGateChallenge). The garrison watches
       him instead: fort-cover-watch.js fills `fortCover.suspicion`; at 100 the cover is blown (militaryAlarm).
       The records office on the HQ (fort-cover-records.js) hands over the papers. With the cover inactive nothing
       here touches the base's rules (free roam is unchanged). */
    const fortCover = {
      active: false,
      cleared: false,
      suspicion: 0,
      alarmed: false,
      papers: false,
      insideBase: false,
      leftWithPapers: false,
      // Detail (reports, the HUD and the watch).
      entered: false,
      halted: false,
      inspect: null,
      blownBy: null,
      rate: 0,
      seen: 0,
      reason: null,
      unseenFor: 0,
      speed: 0,
      lastSpot: null,
      lastShotAt: -100,
      lastStrikeAt: -100,
      saidAt: -100,
      leftAt: -100,
    };
    const FORT_COVER_GATE = {
      // Where the player stands to show his papers: the inbound lane at the booth's window.
      check: { x: 9236, y: 8182 },
      reach: 42,
      // The approach (the gate challenge's own zone) and the line he crosses on the way out.
      zone: { x0: 9040, x1: 9450, y0: 8032, y1: 8268 },
      outX: 9200,
      // How far past the arm a man on foot who has shown nothing is called back before the challenge takes over.
      grace: 56,
    };
    /* The papers at the gate: [second, who, line]. The sergeant reads the ID, the roster says Kessler is on leave,
       the cover story holds, the photo nearly does not. Subtitled on the HUD (missionLine) and in speech bubbles. */
    const FORT_GATE_TALK = [
        [0.4, 'guard', 'Kessler, D. First Lieutenant, Logistics.'],
        [2.8, 'guard', 'Roster has you on leave until Monday, sir.'],
        [5.3, 'you', 'Tell that to the colonel. He moved the inventory audit up and wants the manifests on his desk by oh-six-hundred.'],
        [9.4, 'guard', 'This photo doesn’t look much like you, sir.'],
        [11.9, 'you', 'Three days at the Marea will do that to a man, Sergeant.'],
        [14.2, 'guard', 'Can’t argue with that. Go on through, Lieutenant. Records is the side door, left of headquarters.'],
      ],
      FORT_GATE_CLEARED_AT = 16.4;
    /* ---- The uniform ------------------------------------------------------------------ */
    // An off-duty soldier's field uniform (personOutfit 'playerArmy': camo, belt, boots, patrol cap) on the player's
    // own face and build. Putting it on stows whatever was in his hands. Returns player.uniform.
    function wearUniform(on = true) {
      player.uniform = on ? 'army' : null;
      if (on && selectedWeaponIndex !== FISTS_INDEX) {
        selectedWeaponIndex = FISTS_INDEX;
        reloadSecondsRemaining = 0;
        drawWeapon();
      }
      return player.uniform;
    }
    /* ---- API ---------------------------------------------------------------------------- */
    // The player now holds the stolen ID badge: the gate will ask for it. Clears every result of a previous run.
    function fortCoverBegin() {
      Object.assign(fortCover, {
        active: true,
        cleared: false,
        suspicion: 0,
        alarmed: false,
        papers: false,
        insideBase: inMilitary(player.x, player.y),
        leftWithPapers: false,
        entered: false,
        halted: false,
        inspect: null,
        blownBy: null,
        rate: 0,
        seen: 0,
        reason: null,
        unseenFor: 0,
        speed: 0,
        lastSpot: null,
        lastShotAt: player.lastShotAt ?? -100,
        lastStrikeAt: player.lastStrikeAt ?? -100,
        saidAt: -100,
        leftAt: -100,
      });
      fortCoverClearWatch();
      return fortCoverReport();
    }
    // The cover is over (the mission ended or moved on): the base's normal rules again. The results stay readable.
    function fortCoverEnd() {
      fortCover.active = false;
      fortCover.cleared = false;
      fortCover.inspect = null;
      fortCover.rate = 0;
      fortCover.seen = 0;
      fortCoverClearWatch();
      return fortCoverReport();
    }
    // A new game, WASTED / BUSTED, a mission ending: cover over, uniform off, no records search under way.
    function fortCoverReset() {
      if (fortCover.active) fortCoverEnd();
      player.uniform = null;
      resetFortRecords();
    }
    function fortCoverReport() {
      const g = FORT_COVER_GATE;
      return {
        active: fortCover.active,
        cleared: fortCover.cleared,
        suspicion: Math.round(fortCover.suspicion * 10) / 10,
        alarmed: fortCover.alarmed,
        papers: fortCover.papers,
        insideBase: fortCover.insideBase,
        leftWithPapers: fortCover.leftWithPapers,
        entered: fortCover.entered,
        uniform: player.uniform || null,
        inspecting: fortCover.inspect ? Math.round(fortCover.inspect.t * 10) / 10 : null,
        records: fortRecords ? Math.round(fortRecords.t * 10) / 10 : null,
        shielded: fortCoverShielded(),
        ownsGate: fortCoverOwnsGate(),
        walkDefault: fortCoverPace(),
        rate: Math.round(fortCover.rate * 10) / 10,
        seenBy: fortCover.seen,
        reason: fortCover.reason,
        pace: Math.round(speedKmh(fortCover.speed) * 10) / 10,
        restricted: fortRestrictedAt(player.x, player.y)?.name || null,
        blownBy: fortCover.blownBy,
        gateCheck: { x: g.check.x, y: g.check.y, distance: Math.round(distanceBetween(player, g.check)) },
        recordsDoor: { ...FORT_RECORDS.door, distance: Math.round(distanceBetween(player, FORT_RECORDS.spot)) },
        player: { x: Math.round(player.x), y: Math.round(player.y), onFoot: !player.car },
      };
    }
    /* ---- The rules the base asks --------------------------------------------------------- */
    // On foot in uniform with the cover on and not blown: the walk is the default here (as on the Blue Hour terrace).
    function fortCoverPace() {
      return fortCover.active && player.uniform === 'army' && !player.car && !fortCover.alarmed && inMilitary(player.x, player.y, 400);
    }
    // Cleared and still believed: the base does not treat him as an intruder (militaryThreatened).
    function fortCoverShielded() {
      return (
        fortCover.active &&
        fortCover.cleared &&
        !fortCover.alarmed &&
        player.uniform === 'army' &&
        !player.car &&
        !playerOnRoof() &&
        militaryAlertUntil <= gameTime
      );
    }
    // The gate's guards deal with him through the cover (papers) rather than the challenge.
    function fortCoverOwnsGate() {
      if (!fortCover.active || fortCover.alarmed || player.uniform !== 'army' || playerOnRoof()) return false;
      if (wantedStars > 0 || militaryAlertUntil > gameTime) return false;
      // Driven up in uniform: sent back to park outside the wire, not shot at; driven past the arm, the challenge.
      if (player.car) return !fortCover.cleared && !isAircraft(player.car) && !player.car.military && player.x < SENTINEL.gate.armX + 8;
      // Walked past the booth without showing anything: called back first, then (FORT_COVER_GATE.grace on) the challenge.
      if (!fortCover.cleared && !fortCover.inspect && player.x > SENTINEL.gate.armX + FORT_COVER_GATE.grace) return false;
      return true;
    }
    function fortCoverInGateZone() {
      const z = FORT_COVER_GATE.zone;
      return player.x > z.x0 && player.x < z.x1 && player.y > z.y0 && player.y < z.y1;
    }
    function fortGateSpeaker() {
      const guards = militaryGuards('gate');
      let best = null,
        bestD = Infinity;
      for (let i = 0; i < guards.length; i++) {
        const d = distanceBetween(guards[i], player);
        if (d < bestD) {
          bestD = d;
          best = guards[i];
        }
      }
      return best;
    }
    // Any vehicle of the base's taken while the cover is on, or inside the base: the alarm at once.
    function fortCoverBoarded(c) {
      if (!c.military || !(fortCover.active || inMilitary(c.x, c.y))) return;
      if (fortCover.active) fortCoverBlow('vehicle', null);
      else militaryAlarm();
    }
    // The cover is blown: the whole base turns on him.
    function fortCoverBlow(reason, by) {
      if (fortCover.alarmed) return;
      fortCover.alarmed = true;
      fortCover.blownBy = reason;
      fortCover.suspicion = 100;
      fortCover.inspect = null;
      if (by) militarySpeak(by, 'INTRUDER! HE’S NOT ONE OF OURS!', 3);
      fortCover.inspect = null;
      militaryAlarm();
      announce('FORT SENTINEL · INTRUDER ALERT', 'COVER BLOWN', 3);
    }
    /* ---- The gate ------------------------------------------------------------------------- */
    function fortCoverGateReady() {
      return (
        fortCoverOwnsGate() &&
        !player.car &&
        !fortCover.cleared &&
        !fortCover.inspect &&
        selectedWeaponIndex === FISTS_INDEX &&
        withinRange('fort-papers', distanceBetween(player, FORT_COVER_GATE.check), FORT_COVER_GATE.reach)
      );
    }
    // A line at the gate: the speech bubble and, while a story job runs, the subtitle.
    function fortGateLine(who, text) {
      const p = who === 'you' ? player : who;
      if (!p) return;
      const seconds = Math.max(2.4, speechReadSeconds(text) * 0.9);
      // A long line reads in the subtitle only: a bubble that size would span the screen.
      if (mission && text.length > 52) {
        missionLine(who === 'you' ? 'YOU' : 'GATE SERGEANT', text);
        return;
      }
      if (p === player) {
        player.speech = text.toUpperCase();
        player.speechUntil = gameTime + seconds;
      } else militarySpeak(p, text.toUpperCase(), seconds);
      if (mission) missionLine(who === 'you' ? 'YOU' : 'GATE SERGEANT', text);
    }
    // In the middle of showing the papers: the feet stay put (game-update.js), he faces the sergeant.
    function fortGateTalking() {
      return !!fortCover.inspect && !player.car;
    }
    function updateFortGate(deltaSeconds) {
      const own = fortCoverOwnsGate(),
        zone = fortCoverInGateZone();
      if (!own || !zone) {
        if (!zone) fortCover.halted = fortCover.carWarned = false;
        if (fortCover.inspect && !own) fortCover.inspect = null;
        return;
      }
      const guard = fortGateSpeaker();
      if (!guard) return;
      const I = fortCover.inspect,
        d = distanceBetween(player, FORT_COVER_GATE.check);
      if (!fortCover.cleared) {
        // The nearest guard turns to him (after the garrison's own step, which turns posts back to their post).
        guard.a = headingBetween(guard, player);
        guard.aimingOnly = false;
        if (player.car) {
          if (!fortCover.carWarned && d < 260) {
            fortCover.carWarned = true;
            fortGateLine(guard, 'Sir, private vehicles stay outside the wire. Park it there and walk up.');
            tone(660, 0.12, 0.1, 'square', 650);
          }
          return;
        }
        if (!fortCover.halted && d < 160) {
          fortCover.halted = true;
          fortGateLine(guard, 'Evening, sir. ID, please.');
          tone(660, 0.12, 0.12, 'square', 650);
        } else if (selectedWeaponIndex !== FISTS_INDEX && gameTime - fortCover.saidAt > 6) {
          fortCover.saidAt = gameTime;
          fortGateLine(guard, 'Sir, put that weapon away before you come any closer.');
        } else if (!I && player.x > SENTINEL.gate.armX + 8 && gameTime - fortCover.saidAt > 5) {
          fortCover.saidAt = gameTime;
          fortGateLine(guard, 'Sir! I need to see your ID first.');
        }
      }
      if (!I) return;
      // Pushed away from the window (a car, a blast): the sergeant wants his papers back.
      if (d > FORT_COVER_GATE.reach * 1.8) {
        fortCover.inspect = null;
        fortGateLine(guard, 'Sir? Your ID!');
        return;
      }
      // A weapon out in the middle of it: no papers today.
      if (selectedWeaponIndex !== FISTS_INDEX) {
        fortCover.inspect = null;
        fortCover.saidAt = gameTime;
        fortGateLine(guard, 'Sir, put that weapon away.');
        return;
      }
      player.a = headingBetween(player, guard);
      guard.a = headingBetween(guard, player);
      const t0 = I.t;
      I.t += deltaSeconds;
      for (let i = 0; i < FORT_GATE_TALK.length; i++) {
        const beat = FORT_GATE_TALK[i];
        if (t0 < beat[0] && I.t >= beat[0]) fortGateLine(beat[1] === 'you' ? 'you' : guard, beat[2]);
      }
      // The card turned over, a long look at the photo.
      if (t0 < 0.6 && I.t >= 0.6) noise(0.06, 0.05, 4200);
      if (t0 < 9.2 && I.t >= 9.2) noise(0.05, 0.04, 4600);
      if (I.t >= FORT_GATE_CLEARED_AT) {
        fortCover.inspect = null;
        fortCover.cleared = true;
        tone(1040, 0.1, 0.08, 'sine');
      }
    }
    function startFortInspection() {
      const guard = fortGateSpeaker();
      // The conversation takes the middle of the screen: a step brief still up folds into the strip.
      foldMissionBrief();
      fortCover.inspect = { t: 0 };
      fortCover.halted = true;
      if (guard) {
        guard.a = headingBetween(guard, player);
        player.a = headingBetween(player, guard);
      }
      noise(0.08, 0.06, 3800);
      return true;
    }
    // The action key: show the papers at the booth, or the records office door (fort-cover-records.js).
    function fortCoverInteract() {
      if (gameMode !== 'play' || player.car) return false;
      if (fortCoverGateReady()) return startFortInspection();
      return fortRecordsInteract();
    }
    /* ---- The update (end of updateMilitary, after the garrison's own step) ------------------------- */
    function updateFortCover(deltaSeconds) {
      if (!fortCover.active) return;
      fortCover.insideBase = inMilitary(player.x, player.y);
      // Any alarm while he is cleared ends the cover too.
      if (fortCover.cleared && !fortCover.alarmed && militaryAlertUntil > gameTime) {
        fortCover.alarmed = true;
        fortCover.blownBy = fortCover.blownBy || 'alarm';
      }
      updateFortGate(deltaSeconds);
      if (fortCover.cleared && fortCover.insideBase) fortCover.entered = true;
      // Out past the checkpoint with the papers, cleared and calm: the guard waves him off.
      if (
        fortCover.entered &&
        fortCover.papers &&
        fortCover.cleared &&
        !fortCover.alarmed &&
        !fortCover.leftWithPapers &&
        !player.car &&
        player.x < FORT_COVER_GATE.outX &&
        player.y > FORT_COVER_GATE.zone.y0 - 200 &&
        player.y < FORT_COVER_GATE.zone.y1 + 200
      ) {
        fortCover.leftWithPapers = true;
        fortCover.leftAt = gameTime;
        const guard = fortGateSpeaker();
        if (guard && distanceBetween(guard, player) < 260) fortGateLine(guard, 'Good night, Lieutenant. Hope the colonel’s happy.');
      }
      updateFortWatch(deltaSeconds);
    }
    /* ---- HUD: the prompts and the suspicion meter (#stealthStatus, mission 2's) --------------------- */
    function fortCoverMeterShown() {
      return fortCover.active && fortCover.cleared && gameMode === 'play' && inMilitary(player.x, player.y, 120);
    }
    // What the meter shows now (written on change only; forgotten while hidden, as the Blue Hour shares the box).
    const fortCoverHud = { on: false, label: '', hint: '', fill: -1 };
    function fortCoverUI() {
      if (gameMode !== 'play' || !fortCover.active) {
        fortCoverHud.on = false;
        return;
      }
      if (fortCoverGateReady()) offerPrompt('SHOW YOUR ID TO THE SERGEANT', { id: 'fort-papers' });
      else if (fortCover.inspect) offerPrompt('SHOWING YOUR ID · STAY CALM', { key: null, id: 'fort-papers-wait' });
      else if (fortCoverOwnsGate() && !fortCover.cleared && fortCoverInGateZone()) {
        const d = distanceBetween(player, FORT_COVER_GATE.check);
        if (player.car) {
          if (d < 320) offerPrompt('PARK OUTSIDE THE GATE · WALK UP ON FOOT', { key: null, id: 'fort-papers-wait' });
        } else if (selectedWeaponIndex !== FISTS_INDEX && d < 200)
          offerPrompt('PUT YOUR WEAPON AWAY · ' + keyName('fists'), { key: null, id: 'fort-papers-wait' });
        else if (player.x > SENTINEL.gate.armX + 8) offerPrompt('GO BACK TO THE BOOTH · SHOW YOUR ID', { key: null, id: 'fort-papers-wait' });
        else if (d < 200) offerPrompt('WALK UP TO THE GUARD BOOTH', { key: null, id: 'fort-papers-wait' });
      }
      fortRecordsUI();
      const H = fortCoverHud;
      if (!fortCoverMeterShown()) {
        H.on = false;
        return;
      }
      if (!H.on) {
        H.on = true;
        H.label = H.hint = '';
        H.fill = -1;
      }
      const box = getElement('stealthStatus'),
        seen = !fortCover.alarmed && fortCover.seen > 0,
        hot = fortCover.alarmed || fortCover.suspicion >= 70,
        running = fortCover.speed > FORT_RUN_SPEED,
        why = fortCover.reason,
        label = fortCover.alarmed
          ? 'COVER BLOWN · GET OUT ALIVE'
          : hot
            ? seen
              ? 'ALMOST MADE · GET OUT OF SIGHT'
              : 'ALMOST MADE · STAY OUT OF SIGHT'
            : seen
              ? why === 'running'
                ? 'SEEN RUNNING · SLOW DOWN'
                : why === 'restricted'
                  ? 'OFF LIMITS · MOVE ALONG'
                  : why === 'loitering'
                    ? 'TOO CLOSE · KEEP MOVING'
                    : why === 'climbing'
                      ? 'SEEN UP THERE · GET DOWN'
                      : 'IN A SOLDIER’S SIGHT'
              : fortCover.suspicion > 8
                ? 'SUSPICION FADING'
                : 'IN UNIFORM · WALK LIKE YOU BELONG',
        hint = fortCover.alarmed
          ? ''
          : running
            ? 'RUNNING · LET GO OF ' + keyName('walk') + ' TO WALK'
            : hintDevice() === 'touch'
              ? 'WALK TO BLEND IN · HOLD RUN TO RUN'
              : 'WALK TO BLEND IN · ' + keyName('walk') + ' TO RUN',
        fill = Math.round(fortCover.suspicion);
      if (H.label !== label) getElement('stealthLabel').textContent = H.label = label;
      if (H.hint !== hint) getElement('stealthHint').textContent = H.hint = hint;
      if (H.fill !== fill) getElement('stealthFill').style.width = (H.fill = fill) + '%';
      if (box.classList.contains('seen') !== seen) box.classList.toggle('seen', seen);
      if (box.classList.contains('hot') !== hot) box.classList.toggle('hot', hot);
    }
