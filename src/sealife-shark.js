    /* The jaws close. God mode: it bites down and lets go. */
    function sharkBite() {
      const e = sharkEncounter;
      e.side = Math.random() < 0.5 ? -1 : 1;
      if (e.god || player.godMode || gameMode !== 'play' || !player.swimming) {
        e.god = true;
        seaEvent('splash', player.x, player.y, 1.6, { a: shark.a });
        seaEvent('blood', player.x, player.y, 0.35);
        // Shaken off and thrown clear.
        const a = shark.a + (Math.PI / 2) * e.side;
        teleportClear(player.x + Math.cos(a) * 34, player.y + Math.sin(a) * 34);
        player.swimming = true;
        player.altitude = SWIM_ALTITUDE;
        shake = Math.max(shake, 5);
        tell('GOD MODE · the shark bites down on something it cannot hurt, lets go and swims off', 4);
        seaNote('shark: bite', 'god mode: immune');
        return;
      }
      e.taken = true;
      seaEvent('blood', player.x, player.y, 1.4);
      seaEvent('splash', player.x, player.y, 1.9, { a: shark.a });
      seaNote('shark: bite', 'the player is taken');
      player.hidden = true;
      player.hp = 0;
      die();
      announce('TAKEN BY A GREAT WHITE', 'WASTED', 4.6);
      shake = Math.max(shake, 10);
    }
    /* Move the swimmer a little way without leaving the water (the god-mode shake-off). */
    function teleportClear(x, y) {
      if (landAt(x, y) || solid(x, y, 8, true)) return;
      player.x = x;
      player.y = y;
    }
    function updateShark(deltaSeconds) {
      const viewer = seaViewer(),
        e = sharkEncounter;
      e.cooldown = Math.max(0, e.cooldown - deltaSeconds);
      // A player taken stays hidden until the hospital puts them back.
      if (e.taken) {
        if (gameMode === 'play' && distanceBetween(player, shark) > 400) e.taken = false;
        else player.hidden = true;
      }
      if (!shark.active) {
        shark.spawnClock -= deltaSeconds;
        if (shark.spawnClock <= 0) {
          shark.spawnClock = 6;
          if (seaDistance(viewer.x, viewer.y) < 2400) sharkSpawnNear(viewer);
        }
        if (!shark.active && e.phase === 'none') return;
      }
      // Interest: swimming in its water, for a while.
      if (e.phase === 'none' && gameMode === 'play') {
        if (sharkWaterForPlayer() && !mission && e.cooldown <= 0) {
          const out = clamp(seaDistance(player.x, player.y) / 420, 0.7, 2),
            splash = (player.swimDrive || 0) > 0.8 ? 1.5 : 1,
            night = daylight() < 0.2 ? 1.3 : 1,
            blood = player.hp < 60 ? 1.5 : 1;
          e.interest += (deltaSeconds / 38) * out * splash * night * blood;
          if (e.interest >= 1 && Math.random() < deltaSeconds * 0.25) sharkStartEncounter('interest ' + e.interest.toFixed(2));
        } else e.interest = Math.max(0, e.interest - deltaSeconds / 20);
      }
      const hunting = updateSharkEncounter(deltaSeconds);
      if (!hunting && e.phase === 'none') {
        if (distanceBetween(shark, viewer) > 3400 && shark.mode !== 'retreat') {
          shark.active = false;
          shark.spawnClock = 4;
          return;
        }
        updateSharkPatrol(deltaSeconds, viewer);
      }
      // Body: depth, tail beat, fin wake bookkeeping.
      if (e.phase !== 'breach') {
        shark.z += (shark.depth - shark.z) * Math.min(1, deltaSeconds * 0.9);
        shark.mouth += (0 - shark.mouth) * Math.min(1, deltaSeconds * 3);
        if (e.phase !== 'dive') shark.pitch += (clamp((shark.depth - shark.z) * 0.03, -0.35, 0.35) - shark.pitch) * Math.min(1, deltaSeconds * 2);
        shark.roll *= Math.exp(-deltaSeconds * 2);
      }
      shark.phase += deltaSeconds * (2.2 + shark.speed * 0.09);
      updateBeachSharkAlarm(deltaSeconds);
    }
    function updateSharkPatrol(deltaSeconds, viewer) {
      // The occasional beach pass: along the buoy line with the fin up.
      shark.beachPassClock -= deltaSeconds;
      const nearBeach = Math.abs(viewer.x + 1970) < 1300 && Math.abs(viewer.y - 5650) < 1100;
      if (!shark.beachPass && shark.mode === 'patrol' && nearBeach && shark.beachPassClock <= 0) {
        shark.beachPassClock = 60;
        if (daylight() > 0.3 && beachDensity() > 0.25 && Math.random() < 0.2) sharkStartBeachPass();
      }
      if (shark.mode === 'retreat') {
        shark.retreatFor -= deltaSeconds;
        shark.finUp = 0;
        shark.depth = SEA_SURFACE - 38;
        if (shark.retreatFor <= 0) shark.mode = 'patrol';
      }
      if (shark.mode === 'bump') {
        updateSharkBump(deltaSeconds);
        return;
      }
      let target = shark.waypoint;
      if (shark.beachPass) {
        const bp = shark.beachPass;
        target = bp.points[bp.i];
        if (!target) {
          shark.beachPass = null;
          seaNote('shark: beach pass over');
          target = null;
        } else if (distanceBetween(shark, target) < 40) bp.i++;
        shark.finUp = 1;
        shark.depth = SEA_SURFACE - 6;
      }
      if (!target || distanceBetween(shark, target) < 90) {
        shark.waypoint = seaPointNear(viewer.x, viewer.y, 500, 1700, SHARK_WATER, 20) || seaPointNear(shark.x, shark.y, 300, 900, SHARK_WATER * 0.7, 20);
        target = shark.waypoint || { x: shark.x + Math.cos(shark.a) * 200, y: shark.y + Math.sin(shark.a) * 200 };
      }
      const cruise = (shark.beachPass ? 1.9 : shark.finUp > 0.5 ? 1.7 : 1.3) * UNITS_PER_METRE;
      shark.speed += (cruise - shark.speed) * Math.min(1, deltaSeconds * 0.5);
      seaSteer(shark, headingBetween(shark, target), deltaSeconds, 0.3, 160, shark.beachPass ? 150 : SHARK_WATER * 0.6);
      shark.x += Math.cos(shark.a) * shark.speed * deltaSeconds;
      shark.y += Math.sin(shark.a) * shark.speed * deltaSeconds;
      if (!shark.beachPass && shark.mode === 'patrol') {
        // Up to cruise with the fin out now and then.
        shark.finClock -= deltaSeconds;
        if (shark.finFor > 0) {
          shark.finFor -= deltaSeconds;
          shark.depth = SEA_SURFACE - 6;
          if (shark.z > SEA_SURFACE - 8) shark.finUp = Math.min(1, shark.finUp + deltaSeconds);
          if (shark.finFor <= 0) shark.finClock = 35 + Math.random() * 50;
        } else {
          shark.finUp = Math.max(0, shark.finUp - deltaSeconds * 0.5);
          shark.depth = SEA_SURFACE - 30 - Math.sin(gameTime * 0.05) * 8;
          if (shark.finClock <= 0) {
            shark.finFor = 10 + Math.random() * 12;
            seaNote('shark: fin up', Math.round(distanceBetween(shark, viewer)) + ' from the viewer');
          }
        }
      }
      // A small boat idling out here may get a bump from below.
      const c = player.car;
      shark.bumpClock = Math.max(0, shark.bumpClock - deltaSeconds);
      if (isBoat(c) && vehicleSpec(c).l < 80 && Math.abs(c.speed || 0) < 6 * KNOTS && seaDistance(c.x, c.y) > SHARK_WATER && !mission) {
        shark.bumpFor += deltaSeconds;
        if (shark.bumpFor > 25 && shark.bumpClock <= 0 && Math.random() < deltaSeconds / 40) sharkStartBump(c);
      } else shark.bumpFor = 0;
    }
    function sharkStartBeachPass() {
      if (typeof beachWaterline !== 'function' || sharkEncounter.phase !== 'none') return false;
      const { length } = beachWaterline(),
        west = Math.random() < 0.5,
        points = [];
      for (let i = 0; i <= 8; i++) {
        const s = 140 + ((length - 280) * (west ? i : 8 - i)) / 8,
          p = shoreAt(s, -275 - Math.sin(i * 0.9) * 25);
        if (seaOpen(p.x, p.y, 60)) points.push({ x: p.x, y: p.y });
      }
      if (points.length < 4) return false;
      // Come in from offshore of the first point.
      const start = points[0],
        a = Math.atan2(start.y - 5550, start.x + 1970);
      sharkPlace(start.x + Math.cos(a) * 250, start.y + Math.sin(a) * 250 + 200, 0);
      shark.z = SEA_SURFACE - 20;
      shark.mode = 'patrol';
      shark.beachPass = { points, i: 0, started: gameTime };
      seaNote('shark: beach pass', 'along the buoy line');
      return true;
    }
    function sharkStartBump(c) {
      shark.mode = 'bump';
      shark.bumpBoat = c;
      shark.bumpT = 0;
      shark.bumped = false;
      const a = Math.random() * TAU;
      shark.x = c.x + Math.cos(a) * 220;
      shark.y = c.y + Math.sin(a) * 220;
      shark.a = a + Math.PI;
      shark.z = SEA_SURFACE - 30;
      seaNote('shark: boat bump', vehicleSpec(c).label || c.type);
    }
    function updateSharkBump(deltaSeconds) {
      const c = shark.bumpBoat;
      shark.bumpT += deltaSeconds;
      if (!c || c !== player.car) {
        shark.mode = 'retreat';
        shark.retreatFor = 10;
        return;
      }
      if (!shark.bumped) {
        // Up from below, straight at the hull.
        const want = headingBetween(shark, c);
        shark.a = normalizeAngle(shark.a + clamp(normalizeAngle(want - shark.a), -1.5 * deltaSeconds, 1.5 * deltaSeconds));
        shark.speed += (6 * UNITS_PER_METRE - shark.speed) * Math.min(1, deltaSeconds);
        shark.depth = SEA_SURFACE - 14;
        shark.finUp = 0;
        shark.x += Math.cos(shark.a) * shark.speed * deltaSeconds;
        shark.y += Math.sin(shark.a) * shark.speed * deltaSeconds;
        if (distanceBetween(shark, c) < 16 || shark.bumpT > 9) {
          shark.bumped = true;
          shark.bumpT = 0;
          const side = Math.sin(normalizeAngle(shark.a - c.a)) > 0 ? 1 : -1;
          c.av = (c.av || 0) + side * 1.1;
          const push = 1.4 * UNITS_PER_METRE;
          c.vx = (c.vx || 0) + Math.cos(shark.a) * push;
          c.vy = (c.vy || 0) + Math.sin(shark.a) * push;
          c.bumpRock = 1;
          shake = Math.max(shake, 4.5);
          seaEvent('splash', c.x + Math.cos(shark.a + Math.PI) * 8, c.y + Math.sin(shark.a + Math.PI) * 8, 1.1, { a: shark.a });
          sharkBumpSound(c);
          tell('THUD · something big just hit the hull', 3.5);
          shark.bumpClock = 300;
          shark.bumpFor = 0;
        }
        return;
      }
      // Then one slow circle with the fin out, and away.
      const r = 60,
        t = shark.bumpT * 0.12;
      const tx = c.x + Math.cos(t * TAU + shark.a) * r,
        ty = c.y + Math.sin(t * TAU + shark.a) * r;
      shark.a = normalizeAngle(shark.a + clamp(normalizeAngle(Math.atan2(ty - shark.y, tx - shark.x) - shark.a), -1.2 * deltaSeconds, 1.2 * deltaSeconds));
      shark.speed += (2.4 * UNITS_PER_METRE - shark.speed) * Math.min(1, deltaSeconds);
      shark.x += Math.cos(shark.a) * shark.speed * deltaSeconds;
      shark.y += Math.sin(shark.a) * shark.speed * deltaSeconds;
      shark.depth = SEA_SURFACE - 6;
      shark.finUp = Math.min(1, shark.finUp + deltaSeconds);
      if (shark.bumpT > 11) {
        shark.mode = 'retreat';
        shark.retreatFor = 12;
        shark.waypoint = null;
      }
    }
    /**
     * THE BEACH ALARM
     * The fin seen off the beach (a pass along the buoy line, or the shark
     * circling a swimmer within sight of it): the nearest people on the sand
     * turn and point and shout, the lifeguards whistle and call everyone in,
     * and the swimmers race for the shore, wade out and stand at the waterline
     * watching until the fin has gone. They leave the water a while afterwards.
     * (Hooked into updateBeach through `beachSharkStep`.)
     */
    const BEACH_SHOUTS = ['SHARK!', 'SHARK!!', 'Get out of the water!', 'There, look! A fin!', 'Oh my God, SHARK!', 'Everybody out!', 'Is that a shark?!'];
    function beachFinInSight() {
      if (!shark.active || shark.finUp < 0.5 || typeof beachgoers === 'undefined' || !beachgoers.length) return false;
      if (Math.abs(shark.x + 1970) > 1000 || shark.y < 5400 || shark.y > 6500) return false;
      const shelf = beachOffshore(shark.x, shark.y);
      return shelf < 560;
    }
    function updateBeachSharkAlarm(deltaSeconds) {
      const a = beachAlarm;
      if (beachFinInSight()) {
        if (a.until < gameTime) {
          a.started = gameTime;
          seaNote('beach: SHARK! alarm', 'fin ' + distanceLabel(beachOffshore(shark.x, shark.y)) + ' off the waterline');
          beachSharkAlarmStart();
        }
        a.until = gameTime + 25;
      }
      if (a.until < gameTime) {
        if (a.speakers.length) a.speakers.length = 0;
        return;
      }
      // Whistles and shouts while it lasts.
      if (gameTime > a.whistleAt) {
        a.whistleAt = gameTime + 1.6 + Math.random() * 1.2;
        const tower = (BEACH_LAYOUT.towers || [])[Math.floor(Math.random() * BEACH_LAYOUT.towers.length)];
        if (tower && gameTime - a.started < 30) lifeguardWhistle(tower);
      }
      for (const s of a.speakers) {
        const p = s.person;
        s.x = p.x;
        s.y = p.y;
        s.bubbleZ = (p.z || 0) + PERSON_HEIGHT + 9.5;
        if (s.speechUntil < gameTime && gameTime < a.until - 10 && Math.random() < deltaSeconds * 0.25) {
          s.speech = BEACH_SHOUTS[Math.floor(Math.random() * BEACH_SHOUTS.length)];
          s.speechUntil = gameTime + 2.6;
        }
      }
      if (gameTime > a.shoutAt && gameTime - a.started < 20) {
        a.shoutAt = gameTime + 2.5 + Math.random() * 3;
        beachShoutSound();
      }
    }
    function beachSharkAlarmStart() {
      const a = beachAlarm,
        fin = { x: shark.x, y: shark.y },
        lookers = [];
      a.speakers.length = 0;
      for (const p of beachgoers) {
        if (!p.visible || p.state === 'off' || p.state === 'flee') continue;
        if (p.kind === 'swimmer' || p.kind === 'wader') {
          // Race for the shore, wade out, stand and watch.
          const s = shoreS(p.x),
            land = shoreAt(s, 30 + Math.random() * 40);
          p.sharkRush = { phase: p.kind === 'swimmer' ? 'swim' : 'wade', target: land, watch: 0 };
          continue;
        }
        if (p.kind === 'rider' || p.kind === 'vendor' || p.kind === 'patron') continue;
        const d = Math.hypot(p.x - fin.x, p.y - fin.y);
        if (d < 1100) lookers.push({ p, d });
      }
      lookers.sort((q, r) => q.d - r.d);
      lookers.slice(0, 14).forEach(({ p }, i) => {
        p.sharkRush = { phase: 'point', until: gameTime + 12 + Math.random() * 14, delay: i * 0.25 + Math.random() * 0.6 };
      });
      // Three voices at a time carry the shouting (their bubbles).
      for (const { p } of lookers.slice(0, 3))
        a.speakers.push({ person: p, x: p.x, y: p.y, bubbleZ: PERSON_HEIGHT + 9.5, hp: 1, speech: 'SHARK!', speechUntil: gameTime + 2.6 + Math.random(), speechKind: 'shout', speechKindText: 'SHARK!' });
      const guard = beachgoers.find((p) => p.kind === 'lifeguard' && p.visible);
      if (guard) {
        guard.sharkRush = { phase: 'point', until: gameTime + 25, delay: 0 };
        a.speakers.push({ person: guard, x: guard.x, y: guard.y, bubbleZ: (guard.z || 0) + PERSON_HEIGHT + 9.5, hp: 1, speech: 'EVERYBODY OUT OF THE WATER!', speechUntil: gameTime + 3.5, speechKind: 'shout', speechKindText: 'EVERYBODY OUT OF THE WATER!' });
      }
      a.whistleAt = gameTime;
      a.shoutAt = gameTime + 0.3;
      beachSpooked = Math.max(beachSpooked, 120);
    }
    /**
     * Called by updateBeach for a beachgoer caught up in the alarm, in place of
     * its usual behaviour; returns false once it is over (the slot goes back to
     * its routine, or leaves the water for a while).
     */
    function beachSharkStep(p, deltaSeconds) {
      const r = p.sharkRush,
        fin = shark,
        finAngle = Math.atan2(fin.y - p.y, fin.x - p.x);
      p.phase += deltaSeconds;
      if (r.phase === 'point') {
        if (r.delay > 0) {
          r.delay -= deltaSeconds;
          return false;
        }
        if (gameTime > r.until && beachAlarm.until < gameTime + 15) {
          p.sharkRush = null;
          return false;
        }
        p.a += normalizeAngle(finAngle - p.a) * Math.min(1, deltaSeconds * 4);
        // Everyone on their feet (off the towel, up on the tower deck), pointing.
        p.pose = 'point';
        p.z = p.tower ? 19.2 : 0;
        return true;
      }
      if (r.phase === 'swim') {
        const d = Math.hypot(r.target.x - p.x, r.target.y - p.y),
          a = Math.atan2(r.target.y - p.y, r.target.x - p.x);
        p.a += normalizeAngle(a - p.a) * Math.min(1, deltaSeconds * 3);
        const sp = 5.5 * KMH;
        p.x += Math.cos(p.a) * sp * deltaSeconds;
        p.y += Math.sin(p.a) * sp * deltaSeconds;
        p.pose = 'swim';
        p.z = -4.4 + Math.sin(gameTime * 2 + p.threshold * 9) * 0.4;
        if (beachShelfDistance(p.x, p.y) < WADE_DEPTH - 10 || d < 20) r.phase = 'wade';
        return true;
      }
      if (r.phase === 'wade') {
        const done = beachWalkTo(p, r.target, 32, deltaSeconds);
        const depth = clamp(beachShelfDistance(p.x, p.y) / WADE_DEPTH, 0, 1);
        const wet = !groundAt(p.x, p.y, 2);
        p.pose = wet ? 'wadeWalk' : 'run';
        p.z = wet && Number.isFinite(depth) ? -1.5 - depth * 6.5 : 0;
        if (wet && Math.random() < deltaSeconds * 3) particle(p.x, p.y, '#e6f4f7', 2, 25, 2);
        if (done) {
          r.phase = 'watch';
          r.watch = 0;
        }
        return true;
      }
      if (r.phase === 'watch') {
        r.watch += deltaSeconds;
        p.z = 0;
        p.a += normalizeAngle(finAngle - p.a) * Math.min(1, deltaSeconds * 3);
        p.pose = Math.sin(r.watch * 0.7 + p.threshold * 5) > -0.2 ? 'point' : 'stand';
        if (beachAlarm.until < gameTime && r.watch > 8) {
          // Nobody goes back in for a while: the slot leaves and comes back later.
          p.sharkRush = null;
          p.state = 'off';
          p.visible = false;
          p.fledFor = 120 + Math.random() * 120;
          return true;
        }
        return true;
      }
      p.sharkRush = null;
      return false;
    }
    /* The alarm's voices, for the speech bubbles (crowd.js speechBubbles). */
    function sealifeSpeakers() {
      return beachAlarm.until > gameTime ? beachAlarm.speakers : [];
    }
    // ============================================================================
    /**
     * UPDATE
     * Called from update() every frame of play, and while WASTED plays out (so
     * a breach finishes its fall). Nothing runs until the sea field is ready.
     */
    function updateSeaLife(deltaSeconds) {
      if (!seaFieldStep()) return;
      const dt = Math.min(deltaSeconds, 0.1);
      updateDolphinPods(dt);
      updateGulls(dt);
      updateShark(dt);
    }
    /* The HUD's warning: SHARK! with the bearing and distance to the fin. */
    function sharkWarning() {
      const e = sharkEncounter;
      if (e.phase !== 'approach' && e.phase !== 'circle' && e.phase !== 'dive') return null;
      return {
        phase: e.phase,
        x: shark.x,
        y: shark.y,
        d: distanceBetween(shark, player),
        left: e.phase === 'dive' ? 0 : Math.max(0, e.window - e.t),
        exit: e.exit,
      };
    }
    // ---- Console ------------------------------------------------------------------
    function sealifeReport() {
      const r = (v) => Math.round(v);
      const counts = {};
      for (const g of gulls) counts[g.mode] = (counts[g.mode] || 0) + 1;
      return {
        clock: clockText(),
        field: seaField.state,
        here: { seaDistanceM: +worldMeters(seaDistance(player.x, player.y)).toFixed(1), noGo: seaNoGo(player.x, player.y), sharkWater: sharkWaterForPlayer() },
        dolphins: {
          ratePerGameHour: +dolphinRate().toFixed(2),
          sightings: dolphinSightings,
          pods: dolphinPods.map((p) => ({
            id: p.id,
            x: r(p.x),
            y: r(p.y),
            count: p.members.length,
            age: r(p.age),
            riding: p.ride ? (p.ride.boat === player.car ? 'player boat' : 'liner') : null,
            modes: p.members.map((m) => m.mode),
            z: p.members.map((m) => +(m.z - SEA_SURFACE).toFixed(1)),
          })),
        },
        gulls: {
          pool: GULL_POOL,
          byMode: counts,
          flocks: GULL_FLOCKS.filter((f) => f.active).map((f) => ({ name: f.name, perches: (f.perches || []).length, gulls: gulls.filter((g) => g.flock === f).length })),
          following: gulls.filter((g) => g.mode === 'follow').length,
        },
        shark: {
          active: shark.active,
          mode: shark.mode,
          x: r(shark.x),
          y: r(shark.y),
          depthM: +worldMeters(SEA_SURFACE - shark.z).toFixed(1),
          finUp: +shark.finUp.toFixed(2),
          speedKmh: +speedKmh(shark.speed).toFixed(1),
          beachPass: !!shark.beachPass,
          distanceM: r(worldMeters(distanceBetween(shark, player))),
          seaDistanceM: r(worldMeters(seaDistance(shark.x, shark.y))),
        },
        encounter: {
          phase: sharkEncounter.phase,
          t: +sharkEncounter.t.toFixed(1),
          window: +sharkEncounter.window.toFixed(1),
          interest: +sharkEncounter.interest.toFixed(2),
          cooldown: r(sharkEncounter.cooldown),
          exit: sharkEncounter.exit,
          count: sharkEncounter.count,
          escapes: sharkEncounter.escapes,
          attacks: sharkEncounter.attacks,
          last: sharkEncounter.last,
        },
        beachAlarm: beachAlarm.until > gameTime ? { seconds: r(beachAlarm.until - gameTime), rushing: beachgoers.filter((p) => p.sharkRush).length } : null,
        log: seaLog.slice(-24),
        render: sealifeRenderStats ? sealifeRenderStats() : null,
      };
    }
    /**
     * Test: start the shark encounter. If the player is not swimming in deep
     * water they are put in the sea 90 m off Palm Keys Beach first. `stage`
     * 'breach' skips to the attack itself; 'fin' only brings the fin up nearby.
     */
    function sharkAttackConsole(stage = 'approach') {
      seaFieldStep(1e9);
      if (stage === 'fin') {
        const p = seaPointNear(player.x, player.y, 120, 400, 150, 40) || seaPointNear(-1980, 6300, 0, 200, 100, 20);
        if (!p) return sealifeReport();
        sharkPlace(p.x, p.y, Math.random() * TAU);
        shark.mode = 'patrol';
        shark.z = shark.depth = SEA_SURFACE - 6;
        shark.finFor = 30;
        shark.finUp = 1;
        return sealifeReport();
      }
      if (stage === 'beach') {
        sharkStartBeachPass();
        const bp = shark.beachPass;
        if (bp) {
          // Straight onto the second point with the fin up.
          sharkPlace(bp.points[1].x, bp.points[1].y, headingBetween(bp.points[1], bp.points[2]));
          bp.i = 2;
          shark.z = SEA_SURFACE - 7;
          shark.finUp = 1;
        }
        return sealifeReport();
      }
      // Off a boat first (a boat is only left at a dock, or over the side).
      if (player.car && isBoat(player.car)) diveOverboard();
      if (!sharkWaterForPlayer()) {
        const spot = seaPointNear(-1980, 6380, 0, 160, SHARK_DEEP_SWIM + 20, 40) || { x: -1980, y: 6420 };
        teleportPlayer(spot.x, spot.y);
        player.swimming = true;
        player.wading = 0;
        player.altitude = SWIM_ALTITUDE;
      }
      sharkEncounter.cooldown = 0;
      sharkEncounter.phase = 'none';
      sharkStartEncounter('console');
      if (stage === 'breach') {
        sharkEncounter.phase = 'dive';
        sharkEncounter.t = 2.3;
        sharkPlace(player.x, player.y, shark.a);
        shark.z = SEA_SURFACE - 40;
      } else if (stage === 'circle') {
        sharkEncounter.radius = 150;
        sharkEncounter.phase = 'circle';
      }
      return sealifeReport();
    }
    /* Test: a pod of `count` dolphins near the player (or at x, y), leaping soon. */
    function spawnDolphinsConsole(count = 4, x, y, leap = true) {
      seaFieldStep(1e9);
      const pod = spawnDolphinPod({ count, x, y, leap, near: x === undefined });
      if (pod && leap)
        pod.members.forEach((m, i) => {
          m.next = 0.4 + i * 0.7;
          m.leapNext = true;
        });
      return pod ? { id: pod.id, x: Math.round(pod.x), y: Math.round(pod.y), count: pod.members.length } : null;
    }
