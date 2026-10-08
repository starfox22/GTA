    // Fort Sentinel cover, the garrison's eyes: each soldier's forward cone (fortSoldierSees), the restricted spots,
    // and the suspicion it fills while the player walks the base in uniform (updateFortWatch, fortCoverBlow at 100).
    /* What a soldier sees: a forward cone of FORT_VIEW.half either side of where he faces, out to FORT_VIEW.range
       (tower sentries further, from their cabins), with a clear line of sight (clearSight: walls and buildings).
       No all-round awareness. Seen doing something no soldier does fills the meter (running, standing in a
       restricted spot, hanging about in a soldier's face, climbing); a weapon in hand or a blow seen, or a shot
       anywhere on the base, blows the cover at once. Unseen it drains slowly. */
    const FORT_VIEW = { half: (55 * Math.PI) / 180, range: 420, towerRange: 650, face: 42 },
      FORT_RUN_SPEED = 9 * KMH,
      // Places a private has no business in: the soldiers there say so.
      FORT_RESTRICTED = [
        { name: 'AMMUNITION BUNKERS', x: 10290, y: 8775, w: 160, h: 370 },
        { name: 'FUEL DEPOT', x: 10040, y: 8800, w: 240, h: 180 },
        { name: 'CONTROL TOWER', x: 10010, y: 9255, w: 110, h: 110 },
        { name: 'FLIGHT LINE', x: 10144, y: 9309, w: 252, h: 112 },
        // The HQ's main doorway between its two sentries (the records office has its own door).
        { name: 'HQ ENTRANCE', x: 9712, y: 8036, w: 56, h: 28 },
      ],
      FORT_LINES = {
        running: 'HEY. WALK, SOLDIER.',
        restricted: 'OFF LIMITS, PRIVATE. MOVE ALONG.',
        loitering: 'DON’T KNOW YOU. WHAT UNIT?',
        climbing: 'GET DOWN FROM THERE!',
        wary: 'WHO’S YOUR SERGEANT, PRIVATE?',
        stop: 'YOU. HOLD IT RIGHT THERE.',
      };
    function fortRestrictedAt(x, y) {
      for (let i = 0; i < FORT_RESTRICTED.length; i++) {
        const r = FORT_RESTRICTED[i];
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return r;
      }
      return null;
    }
    function fortSoldierSees(e) {
      const range = e.elevated ? FORT_VIEW.towerRange : FORT_VIEW.range,
        d = distanceBetween(e, player);
      if (d > range || d < 0.5) return false;
      if (Math.abs(normalizeAngle(headingBetween(e, player) - (e.a || 0))) > FORT_VIEW.half) return false;
      return clearSight(e, player);
    }
    // A soldier's line, at most once every `gap` seconds each and one voice at a time across the base.
    function fortSay(e, kind, gap = 9) {
      e.coverSaid = e.coverSaid || {};
      if (gameTime < (e.coverSaid[kind] ?? -99) + gap || gameTime - fortCover.saidAt < 2.4) return;
      e.coverSaid[kind] = gameTime;
      fortCover.saidAt = gameTime;
      militarySpeak(e, FORT_LINES[kind], 2.6);
    }
    function fortCoverClearWatch() {
      for (let i = 0; i < gangMembers.length; i++) {
        const e = gangMembers[i];
        if (!e.military) continue;
        e.coverSees = false;
        e.coverFace = 0;
      }
    }
    // The player's pace from how far he actually moved (a teleport is not a run).
    function trackFortPace(deltaSeconds) {
      const last = fortCover.lastSpot;
      let speed = 0;
      if (last && deltaSeconds > 0) {
        const moved = Math.hypot(player.x - last.x, player.y - last.y);
        if (moved < 40) speed = moved / deltaSeconds;
      } else fortCover.lastSpot = { x: 0, y: 0 };
      fortCover.lastSpot.x = player.x;
      fortCover.lastSpot.y = player.y;
      fortCover.speed += (speed - fortCover.speed) * Math.min(1, deltaSeconds * 8);
    }
    function updateFortWatch(deltaSeconds) {
      trackFortPace(deltaSeconds);
      fortCover.seen = 0;
      fortCover.rate = 0;
      fortCover.reason = null;
      if (!fortCoverShielded() || !inMilitary(player.x, player.y, 60)) {
        if (fortCover.cleared && !fortCover.alarmed) fortCover.suspicion = Math.max(0, fortCover.suspicion - 5 * deltaSeconds);
        return;
      }
      // A shot anywhere on the base is heard by everyone.
      const shot = (player.lastShotAt ?? -100) > fortCover.lastShotAt,
        struck = (player.lastStrikeAt ?? -100) > fortCover.lastStrikeAt;
      fortCover.lastShotAt = player.lastShotAt ?? -100;
      fortCover.lastStrikeAt = player.lastStrikeAt ?? -100;
      if (shot) {
        fortCoverBlow('gunfire', null);
        return;
      }
      const running = fortCover.speed > FORT_RUN_SPEED,
        armed = selectedWeaponIndex !== FISTS_INDEX,
        spot = fortRestrictedAt(player.x, player.y),
        climbing = !!player.climbing || (player.jumpUntil || 0) > gameTime || (player.altitude || 0) > 3;
      let top = 0,
        sum = 0,
        watcher = null,
        watcherRate = 0;
      for (let i = 0; i < gangMembers.length; i++) {
        const e = gangMembers[i];
        if (!e.military || e.hp <= 0 || personIncapacitated(e)) {
          if (e.military) e.coverSees = false;
          continue;
        }
        const sees = fortSoldierSees(e);
        e.coverSees = sees;
        if (!sees) {
          e.coverFace = Math.max(0, (e.coverFace || 0) - deltaSeconds * 2);
          continue;
        }
        fortCover.seen++;
        if (armed) {
          fortCoverBlow('weapon', e);
          return;
        }
        if (struck) {
          fortCoverBlow('attack', e);
          return;
        }
        const d = distanceBetween(e, player),
          close = clamp(1 - d / (e.elevated ? FORT_VIEW.towerRange : FORT_VIEW.range), 0, 1);
        e.coverFace = d < FORT_VIEW.face ? (e.coverFace || 0) + deltaSeconds : Math.max(0, (e.coverFace || 0) - deltaSeconds * 2);
        let rate = 0,
          why = null;
        if (climbing) {
          rate += 25;
          why = 'climbing';
        }
        if (spot) {
          rate += 12 + 10 * close;
          why = why || 'restricted';
        }
        if (e.coverFace > 3) {
          rate += 14;
          why = why || 'loitering';
        }
        if (running) {
          rate += 16 + 22 * close;
          why = 'running';
        }
        // Marching eyes front: the drill platoon half notices.
        if (e.role === 'drill') rate *= 0.5;
        if (rate > 0) {
          fortSay(e, why);
          if (rate > watcherRate) {
            watcherRate = rate;
            watcher = e;
            fortCover.reason = why;
          }
        } else if (fortCover.suspicion > 78) fortSay(e, 'stop', 12);
        else if (fortCover.suspicion > 45) fortSay(e, 'wary', 14);
        // A soldier who has noticed keeps his eyes on him.
        if (rate > 0 || fortCover.suspicion > 35) e.a = turnToward(e.a || 0, headingBetween(e, player), deltaSeconds * 3);
        top = Math.max(top, rate);
        sum += rate;
      }
      const rate = top + 0.35 * (sum - top);
      fortCover.rate = rate;
      if (rate > 0) {
        fortCover.suspicion += rate * deltaSeconds;
        fortCover.unseenFor = 0;
      } else if (fortCover.seen === 0) {
        fortCover.unseenFor += deltaSeconds;
        if (fortCover.unseenFor > 1.5) fortCover.suspicion -= 5 * deltaSeconds;
      }
      fortCover.suspicion = clamp(fortCover.suspicion, 0, 100);
      if (fortCover.suspicion >= 100) fortCoverBlow(fortCover.reason || 'suspicion', watcher);
    }
