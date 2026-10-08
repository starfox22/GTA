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
    };
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
      if (!fortCover.active || fortCover.alarmed || player.uniform !== 'army' || player.car || playerOnRoof()) return false;
      if (wantedStars > 0 || militaryAlertUntil > gameTime) return false;
      // Walked past the booth without showing anything: the challenge takes over.
      if (!fortCover.cleared && !fortCover.inspect && player.x > SENTINEL.gate.armX + 8) return false;
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
      militaryAlarm();
      announce('FORT SENTINEL · INTRUDER ALERT', 'COVER BLOWN', 3);
    }
    /* ---- The gate ------------------------------------------------------------------------- */
    function fortCoverGateReady() {
      return (
        fortCoverOwnsGate() &&
        !fortCover.cleared &&
        !fortCover.inspect &&
        selectedWeaponIndex === FISTS_INDEX &&
        withinRange('fort-papers', distanceBetween(player, FORT_COVER_GATE.check), FORT_COVER_GATE.reach)
      );
    }
    function updateFortGate(deltaSeconds) {
      const own = fortCoverOwnsGate(),
        zone = fortCoverInGateZone();
      if (!own || !zone) {
        if (!zone) fortCover.halted = false;
        if (fortCover.inspect && !own) fortCover.inspect = null;
        return;
      }
      const guard = fortGateSpeaker();
      if (!guard) return;
      const I = fortCover.inspect;
      if (!fortCover.cleared) {
        // The nearest guard turns to him (after the garrison's own step, which turns posts back to their post).
        guard.a = headingBetween(guard, player);
        guard.aimingOnly = false;
        if (!fortCover.halted) {
          fortCover.halted = true;
          militarySpeak(guard, 'HALT. ID, PLEASE.', 2.6);
          tone(660, 0.12, 0.12, 'square', 650);
        } else if (selectedWeaponIndex !== FISTS_INDEX && gameTime - fortCover.saidAt > 6) {
          fortCover.saidAt = gameTime;
          militarySpeak(guard, 'SHOULDER THAT WEAPON, PRIVATE.', 2.6);
        }
      }
      if (!I) return;
      // The inspection: he reads the badge, a word, waved through. Walking off cancels it.
      if (distanceBetween(player, FORT_COVER_GATE.check) > FORT_COVER_GATE.reach * 1.8) {
        fortCover.inspect = null;
        militarySpeak(guard, 'HEY! YOUR PAPERS!', 2.4);
        return;
      }
      // A weapon out in the middle of it: no papers today.
      if (selectedWeaponIndex !== FISTS_INDEX) {
        fortCover.inspect = null;
        fortCover.saidAt = gameTime;
        militarySpeak(guard, 'SHOULDER THAT WEAPON, PRIVATE.', 2.6);
        return;
      }
      const t0 = I.t;
      I.t += deltaSeconds;
      const at = (s) => t0 < s && I.t >= s;
      if (at(1.5)) {
        player.speech = 'CAN’T SLEEP IN TOWN, SARGE.';
        player.speechUntil = gameTime + 1.8;
      }
      if (at(0.6)) noise(0.06, 0.05, 4200);
      if (at(3.1)) {
        fortCover.inspect = null;
        fortCover.cleared = true;
        militarySpeak(guard, 'GO ON THROUGH.', 2.4);
        tone(1040, 0.1, 0.08, 'sine');
        tell('FORT SENTINEL · Cleared at the gate. Walk like you belong here.', 4, { id: 'fort-cover' });
      }
    }
    function startFortInspection() {
      const guard = fortGateSpeaker();
      fortCover.inspect = { t: 0 };
      if (guard) militarySpeak(guard, 'KESSLER, D. ... PFC. BACK EARLY?', 2.6);
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
        if (guard && distanceBetween(guard, player) < 260) militarySpeak(guard, 'EVENING, PRIVATE. DON’T BE LATE BACK.', 3);
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
      if (fortCoverGateReady()) offerPrompt('SHOW YOUR PAPERS', { id: 'fort-papers' });
      else if (fortCoverOwnsGate() && !fortCover.cleared && fortCoverInGateZone() && distanceBetween(player, FORT_COVER_GATE.check) < 120)
        offerPrompt(selectedWeaponIndex !== FISTS_INDEX ? 'PUT YOUR WEAPON AWAY' : 'WALK UP TO THE BOOTH', { key: null, id: 'fort-papers-wait' });
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
