    /* ---- Buildings ------------------------------------------------------------------- */
    function buildMilitary() {
      const old = randomSeed;
      randomSeed = 77077;
      for (const plan of SENTINEL.buildings) {
        makeBuilding(plan.x, plan.y, plan.w, plan.h, plan.style, true);
        Object.assign(buildings.at(-1), {
          county: true,
          tropical: false,
          height: plan.height,
          military: true,
          // Drawn by base3d.js, not the city facade builder.
          baseBuilding: plan.id,
          baseName: plan.name,
        });
      }
      randomSeed = old;
    }
    /* ---- Garrison -------------------------------------------------------------------- */
    function soldier(x, y, a, role, extra = {}) {
      const s = {
        x,
        y,
        home: { x, y, a },
        a,
        hp: 115,
        maxhp: 115,
        // Base security wear plate carriers: small arms need several rounds to matter.
        vest: 110,
        color: '#5f6b4b',
        faction: 'military',
        military: true,
        role,
        name: role === 'gate' ? 'MILITARY POLICE' : 'FORT SENTINEL',
        timer: 1.2 + seededRandom() * 0.6,
        walk: 0,
        walking: false,
        ...extra,
      };
      gangMembers.push(s);
      return s;
    }
    // Drill: 3 ranks of 4 march a loop of the parade ground by day.
    const DRILL_LOOP = [
      { x: 9650, y: 8330 },
      { x: 9870, y: 8330 },
      { x: 9870, y: 8480 },
      { x: 9650, y: 8480 },
    ];
    const militaryDrill = { index: 1, x: 9650, y: 8330, a: 0, pauseUntil: 0, callAt: 0, step: 0 };
    function populateMilitary() {
      militaryGate = 0;
      militaryGateUntil = militaryAlertUntil = militaryLockdownUntil = 0;
      militaryWarningAt = -100;
      militaryChallenge = { level: 0, since: 0, spokeAt: -100, leftAt: -100 };
      militarySupplyAt = gameTime + 60;
      militarySupply = null;
      for (const s of militaryGateState) {
        s.arm = s.bollards = s.slide = 0;
        s.armBroken = s.bollardsBroken = s.slideBroken = false;
      }
      const park = (type, x, y, a, extra = {}) => {
        const c = makeCar(type, x, y, a, false, extra.color);
        c.military = true;
        c.turretA = c.a;
        return Object.assign(c, extra);
      };
      const north = -Math.PI / 2;
      // Motor pool: two ranks facing the shed, tanks under camouflage netting.
      for (const x of [9470, 9515, 9560, 9605]) park('jeep', x, 8950, north);
      for (const x of [9665, 9715]) park('armytruck', x, 8950, north);
      for (const x of [9780, 9830]) park('apc', x, 8950, north);
      park('tank', 9490, 9080, north, { crewed: true });
      // The second tank is an older variant without the coaxial MG (armor.js).
      park('tank', 9565, 9080, north, { crewed: true, noCoax: true });
      park('apc', 9645, 9080, north, { crewed: true, gunner: true });
      for (const x of [9715, 9765]) park('armytruck', x, 9080, north);
      for (const x of [9835, 9880, 9925]) park('jeep', x, 9080, north);
      // The fuel bowser at the pump island.
      park('armytruck', 10160, 9042, 0, { fuelBowser: true });
      // Quick-reaction jeeps with gunners at HQ.
      for (const x of [9470, 9512]) park('jeep', x, 7962, Math.PI / 2, { gunner: true, qrf: true, qrfHome: { x, y: 7962, a: Math.PI / 2 } });
      // Perimeter patrol jeeps drive the ring road clockwise.
      const pr = SENTINEL.perimeterRoad,
        ring = [
          { x: pr.x0, y: pr.y0 + 55 },
          { x: pr.x0 + 55, y: pr.y0 },
          { x: pr.x1 - 55, y: pr.y0 },
          { x: pr.x1, y: pr.y0 + 55 },
          { x: pr.x1, y: pr.y1 - 55 },
          { x: pr.x1 - 55, y: pr.y1 },
          { x: pr.x0 + 55, y: pr.y1 },
          { x: pr.x0, y: pr.y1 - 55 },
        ];
      for (const [x, y, a, index] of [
        [9800, pr.y0, 0, 2],
        [10100, pr.y1, Math.PI, 6],
      ]) {
        const c = makeCar('jeep', x, y, a, true);
        c.military = true;
        c.gunner = true;
        c.patrol = true;
        c.turretA = a;
        c.countyRoute = ring;
        c.countyIndex = index;
      }
      // Helicopters on the apron and a pad.
      for (const [x, y, a] of [
        [9550, 9522, 0],
        [9810, 9522, 0],
        [10340, 9365, Math.PI],
      ])
        park('helicopter', x, y, a, { color: '#4d5641' });
      // The attack helicopter on the other pad: only ever flown by the player (apache.js).
      parkApache();
      // Posts.
      const g = SENTINEL.gate;
      soldier(g.island.x + 8, 8150, Math.PI, 'gate');
      soldier(g.booth.x + g.booth.w / 2, 8150, Math.PI, 'gate', { hold: true });
      soldier(g.island.x + g.island.w - 16, 8150, Math.PI, 'gate');
      for (const n of SENTINEL.nests) soldier(n.x + 6, n.y, n.a, 'post', { hold: true });
      for (const t of SENTINEL.towers) soldier(t.x, t.y, t.a, 'tower', { altitude: SENTINEL.towerFloor, hold: true, elevated: true });
      soldier(9725, 8050, Math.PI / 2, 'post', { hold: true });
      soldier(9755, 8050, Math.PI / 2, 'post', { hold: true });
      soldier(9505, 8895, north, 'post');
      soldier(9640, 8898, north, 'post');
      soldier(9760, 9460, Math.PI / 2, 'post');
      soldier(10200, 9440, Math.PI / 2, 'post');
      soldier(10300, 9010, Math.PI, 'post');
      // Rifle range: four firers on the firing line.
      const r = SENTINEL.range;
      for (let i = 0; i < 4; i++) soldier(r.x + 24, r.y + 10 + i * 20, 0, 'range', { lane: i, hold: true });
      // Foot patrols.
      const patrol = (route, offset = 0) =>
        soldier(route[0].x, route[0].y + offset, 0, 'patrol', { route, routeIndex: 1, pauseUntil: 0, offset });
      patrol([{ x: 9366, y: 8300 }, { x: 9366, y: 9860 }]);
      patrol([{ x: 9420, y: 7815 }, { x: 10480, y: 7815 }]);
      patrol([{ x: 10494, y: 9820 }, { x: 10494, y: 7880 }]);
      patrol([{ x: 10480, y: 9886 }, { x: 9420, y: 9886 }]);
      const barracksLoop = [
        { x: 10028, y: 8212 },
        { x: 10425, y: 8212 },
        { x: 10425, y: 8640 },
        { x: 10028, y: 8640 },
      ];
      patrol(barracksLoop);
      patrol(barracksLoop, 16);
      patrol([{ x: 9440, y: 9612 }, { x: 10430, y: 9612 }]);
      patrol([
        { x: 10308, y: 8790 },
        { x: 10430, y: 8790 },
        { x: 10430, y: 9135 },
        { x: 10308, y: 9135 },
      ]);
      patrol([{ x: 9560, y: 8090 }, { x: 9920, y: 8090 }]);
      // Drill platoon and its sergeant.
      Object.assign(militaryDrill, { index: 1, x: DRILL_LOOP[0].x, y: DRILL_LOOP[0].y, a: 0, pauseUntil: 0 });
      for (let i = 0; i < 12; i++) {
        const home = { x: 10070 + (i % 6) * 55, y: 8355 + Math.floor(i / 6) * 150 };
        soldier(home.x, home.y, Math.PI / 2, 'drill', { slot: i, barracksHome: home });
      }
      soldier(DRILL_LOOP[0].x, DRILL_LOOP[0].y - 50, 0, 'sergeant', { barracksHome: { x: 10390, y: 8355 } });
    }
    function drillSlot(i) {
      const rank = Math.floor(i / 4),
        file = i % 4,
        back = -rank * 24,
        side = (file - 1.5) * 20,
        c = Math.cos(militaryDrill.a),
        s = Math.sin(militaryDrill.a);
      return { x: militaryDrill.x + back * c - side * s, y: militaryDrill.y + back * s + side * c };
    }
    function drillHours() {
      const hour = (worldMinutes % 1440) / 60;
      return hour > 6.5 && hour < 18;
    }
    function updateDrill(deltaSeconds) {
      const d = militaryDrill;
      if (gameTime < d.pauseUntil) return false;
      const target = DRILL_LOOP[d.index],
        dist = distanceBetween(d, target);
      if (dist < 3) {
        d.index = (d.index + 1) % DRILL_LOOP.length;
        d.pauseUntil = gameTime + 2.5;
        d.a = headingBetween(d, DRILL_LOOP[d.index]);
        return false;
      }
      d.a = headingBetween(d, target);
      // Quick time: about 5.5 km/h (the platoon follows at up to 7 to keep station).
      const step = Math.min(dist, 5.5 * KMH * deltaSeconds);
      d.x += Math.cos(d.a) * step;
      d.y += Math.sin(d.a) * step;
      return true;
    }
    // Tanks, APCs and gunner jeeps: aim, acquire, fire.
    function militaryGunnerFire(c, target) {
      const a = (c.turretA ?? c.a) + randomBetween(-0.05, 0.05),
        origin = { x: c.x + Math.cos(a) * 20, y: c.y + Math.sin(a) * 20, altitude: entityElevation(c) + 16 },
        v = shotVelocity(origin, target, 720, a);
      bullets.push({
        x: origin.x,
        y: origin.y,
        altitude: origin.altitude,
        vx: v.vx,
        vy: v.vy,
        vz: v.vz,
        life: 0.85,
        dmg: 12,
        enemy: true,
        faction: 'military',
        owner: c,
        target,
      });
      playSample('automatic', 0.3, 0.82, c);
      if (city3D) city3D.fire(origin.x, origin.y, a, false, origin.altitude);
    }
    function tankFire(c, enemy = false) {
      if (c.hp <= 0 || gameTime < (c.cannonReadyAt || 0)) return false;
      c.cannonReadyAt = gameTime + 2.3;
      const a = c.turretA ?? c.a,
        x = c.x + Math.cos(a) * 65,
        y = c.y + Math.sin(a) * 65;
      c.cannonRecoilUntil = gameTime + 0.25;
      bullets.push({
        x,
        y,
        altitude: entityElevation(c),
        vx: Math.cos(a) * 610,
        vy: Math.sin(a) * 610,
        life: 1.7,
        dmg: 155,
        rocket: true,
        // A main-gun round: it breaches facades it hits (damage3d.js shellImpact).
        shell: true,
        blastPower: 1.35,
        enemy,
        faction: enemy ? 'military' : undefined,
        owner: enemy ? c : player,
        target: player,
      });
      playSample('explosion', 0.6, 1.5, c);
      if (city3D) city3D.fire(x, y, a, true, entityElevation(c));
      particle(x, y, '#f9d18a', 12, 110, 7);
      if (!enemy) {
        shake = Math.max(shake, 6);
        notifyViolence(player, 'gunfire', player);
        crime(0.45);
      }
      return true;
    }
    /* ---- Supply runs: an authorized truck in through the checkpoint and out again. ---- */
    let militarySupply = null;
    function updateSupplyRun() {
      const g = SENTINEL.gate,
        inbound = SENTINEL.laneCenter(g.lanes[1]),
        outbound = SENTINEL.laneCenter(g.lanes[0]);
      if (!militarySupply) {
        if (gameTime < militarySupplyAt || militaryAlertUntil > gameTime) return;
        militarySupplyAt = gameTime + 150 + seededRandom() * 90;
        const start = { x: 8200, y: 8185 };
        if (distanceBetween(player, start) < 650 || !canSpawnCar('armytruck', start.x, start.y, 0)) return;
        const c = makeCar('armytruck', start.x, start.y, 0, true);
        c.military = true;
        c.supply = true;
        c.countyRoute = [
          { x: 9100, y: 8192 },
          { x: g.checkpoint - 30, y: inbound },
          { x: 9360, y: inbound },
          { x: 9960, y: 8178 },
          { x: 9990, y: 8700 },
          { x: 9990, y: 9175 },
          { x: 9720, y: 9175 },
        ];
        c.countyIndex = 0;
        militarySupply = { car: c, stage: 'in', checked: false, parkedAt: 0 };
        return;
      }
      const s = militarySupply,
        c = s.car;
      if (c.hp <= 0 || c === player.car || !vehicles.includes(c)) {
        militarySupply = null;
        return;
      }
      if (s.stage === 'in') {
        // Stop at the booth for the paperwork.
        if (!s.checked && distanceBetween(c, { x: g.checkpoint - 30, y: inbound }) < 70) {
          c.ai = false;
          if (!s.checkUntil) {
            s.checkUntil = gameTime + 4;
            const guard = militaryGuards('gate')[0];
            if (guard) militarySpeak(guard, 'PAPERS. ...YOU’RE CLEARED.', 3.4);
          }
          if (gameTime > s.checkUntil) {
            s.checked = true;
            c.ai = true;
            c.countyIndex = 2;
          }
        }
        if (c.countyIndex === 0 && c.ai && distanceBetween(c, c.countyRoute[6]) < 70) {
          // Arrived: park until the load is off.
          c.ai = false;
          s.stage = 'parked';
          s.parkedAt = gameTime;
        }
      } else if (s.stage === 'parked') {
        if (gameTime - s.parkedAt > 70 && militaryAlertUntil < gameTime) {
          c.countyRoute = [
            { x: 9990, y: 9175 },
            { x: 9990, y: 8200 },
            { x: 9900, y: outbound },
            { x: 9330, y: outbound },
            { x: 9100, y: 8112 },
            { x: 8150, y: 8112 },
          ];
          c.countyIndex = 0;
          c.ai = true;
          s.stage = 'out';
        }
      } else if (s.stage === 'out') {
        if (c.countyIndex === 0 && c.x < 8300) {
          c.ai = false;
          if (distanceBetween(c, player) > 600) {
            vehicles.splice(vehicles.indexOf(c), 1);
            militarySupply = null;
          }
        }
      }
    }
    /* ---- The update ------------------------------------------------------------------- */
    function militaryThreatened() {
      return (
        (inMilitary(player.x, player.y) && !isAircraft(player.car)) ||
        (isAircraft(player.car) && inMilitary(player.x, player.y) && entityElevation(player.car) - terrainHeight(player.x, player.y) < 90) ||
        gangMembers.some((g) => g.military && (g.playerThreatUntil || 0) > gameTime) ||
        vehicles.some(
          (c) =>
            c.military &&
            c.hp > 0 &&
            c.lastAttacker === player &&
            gameTime - (c.lastDamagedAt ?? -100) < 22 &&
            distanceBetween(c, player) < 700,
        )
      );
    }
    function updateMilitary(deltaSeconds) {
      const near = distanceBetween(player, MILITARY.gate) < 480,
        inside = inMilitary(player.x, player.y);
      if (near && !inside && militaryAlertUntil < gameTime && gameTime - militaryWarningAt > 25) {
        militaryWarningAt = gameTime;
        tell('FORT SENTINEL · Restricted military installation. Use of deadly force authorized beyond the gate.', 6);
      }
      if (militaryThreatened()) militaryAlarm();
      updateGateChallenge(deltaSeconds);
      updateGatePieces(deltaSeconds);
      updateGateRamming();
      updateMilitarySiren(deltaSeconds);
      updateSupplyRun();
      const alert = militaryAlertUntil > gameTime;
      // A base at war with an intruder still inside it keeps the police on them:
      // the search is refreshed, but no heat is added (heat only comes from new
      // crimes, heat.js). Once over the fence and away, the search runs down.
      if (alert && wantedStars > 0 && inMilitary(player.x, player.y) && gameTime - militaryWantedAt > 4) {
        militaryWantedAt = gameTime;
        lastSeen = { x: player.x, y: player.y };
        searchActive = false;
        searchRemaining = Math.max(searchRemaining, policeSearchSeconds());
      }
      if (alert && gameTime - militaryAnnounceAt > 14 && inMilitary(player.x, player.y, 600)) {
        militaryAnnounceAt = gameTime;
        tell(
          randomChoice([
            'BASE PA · Lockdown, lockdown. Intruder on base. All units respond.',
            'BASE PA · All personnel to shelter. Security forces, weapons free.',
            'BASE PA · Gates are sealed. Quick reaction force, move out.',
          ]),
          3.5,
        );
      }
      const threat = player.car || player;
      // Vehicles: crewed armour and gunner jeeps engage; the QRF drives at the intruder.
      for (const c of vehicles) {
        if (!c.military || c.hp <= 0) continue;
        // The player's turret traverses in armor.js.
        if (c === player.car) continue;
        if (c.stolen || isAircraft(c)) continue;
        const d = distanceBetween(c, player),
          canEngage = alert && !playerOnRoof() && sameFloor(c, threat),
          gun = c.type === 'tank' || c.gunner;
        if (c.qrf) {
          if (alert && inMilitary(player.x, player.y, 300)) {
            const goal = { x: player.x, y: player.y };
            if (d > 170) {
              c.ai = true;
              c.panicUntil = gameTime + 2;
              c.countyRoute = [goal];
              c.countyIndex = 0;
            } else c.ai = false;
          } else if (!alert && c.ai && !c.patrol) {
            // Stand down: back to the HQ lot.
            c.countyRoute = [c.qrfHome];
            c.countyIndex = 0;
            if (distanceBetween(c, c.qrfHome) < 60) c.ai = false;
          }
        }
        if (!gun || (!c.crewed && !c.gunner)) continue;
        // Only on screen (combat-rules.js ON-SCREEN RULE).
        if (canEngage && d < (c.type === 'tank' ? 700 : 480) && shooterInView(c) && clearSight(c, threat)) {
          c.turretA = headingBetween(c, player);
          if (!c.targetAcquired) c.targetAcquired = gameTime + (c.type === 'tank' ? 2.8 : 1.4);
          if (gameTime > c.targetAcquired) {
            if (c.type === 'tank') {
              if (d > 150) tankFire(c, true);
            } else if (gameTime > (c.gunReadyAt || 0)) {
              // Bursts of five.
              c.burst = (c.burst || 0) + 1;
              c.gunReadyAt = gameTime + (c.burst % 5 ? 0.11 : 1.1);
              militaryGunnerFire(c, threat);
            }
          }
        } else {
          c.targetAcquired = 0;
          if (!alert || d > 800) c.turretA = c.a + (c.patrol ? Math.sin(gameTime * 0.4 + c.id) * 0.9 : 0);
        }
      }
      // People.
      const drilling = !alert && drillHours();
      if (drilling) updateDrill(deltaSeconds);
      const hour = (worldMinutes % 1440) / 60,
        rangeOpen = !alert && hour > 8 && hour < 17;
      for (const e of gangMembers) {
        if (!e.military || e.hp <= 0 || personIncapacitated(e)) continue;
        const d = distanceBetween(e, player);
        if (d > 1500) continue;
        e.timer -= deltaSeconds;
        e.walking = false;
        const elevated = !!e.elevated;
        e.aiming =
          alert && d < (elevated ? 650 : 590) && (sameFloor(e, player) || elevated) && !playerOnRoof() && !(isAircraft(player.car) && entityElevation(player.car) > 120);
        if (e.aiming) {
          e.a = headingBetween(e, player);
          if (!e.hold && d > 245 && inMilitary(player.x, player.y, 220)) {
            footStepTowards(e, player, deltaSeconds, 9 * KMH);
            e.walking = true;
          }
          if (e.timer <= 0 && shooterInView(e) && clearSight(e, threat)) {
            e.timer = 0.55 + seededRandom() * 0.35;
            const a = e.a + randomBetween(-0.055, 0.055),
              v = shotVelocity(e, threat, 680, a);
            bullets.push({
              x: e.x + Math.cos(a) * 15,
              y: e.y + Math.sin(a) * 15,
              altitude: entityElevation(e),
              vx: v.vx,
              vy: v.vy,
              vz: v.vz,
              life: 0.95,
              dmg: 13,
              enemy: true,
              faction: 'military',
              owner: e,
              target: player,
            });
            playSample('automatic', 0.28, 1, e);
            if (city3D) city3D.fire(e.x, e.y, a, false, entityElevation(e));
          }
          continue;
        }
        // Gate guards raise their rifles while challenging someone.
        if (e.role === 'gate' && militaryChallenge.level > 0 && d < 400) {
          e.a = headingBetween(e, player);
          e.aimingOnly = true;
          continue;
        }
        e.aimingOnly = false;
        if (e.role === 'range' && rangeOpen) {
          e.a = 0;
          if (e.timer <= 0 && d < 1100) {
            // Aimed shots at the lane's target; the berm stops them.
            e.timer = 1.1 + seededRandom() * 1.6;
            const r = SENTINEL.range,
              target = { x: r.targetsX, y: r.y + 10 + e.lane * 20 },
              a = headingBetween(e, target) + randomBetween(-0.01, 0.01);
            bullets.push({ x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14, altitude: 0, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.6, dmg: 13, enemy: true, faction: 'military', owner: e, target: null });
            playSample('rifle', 0.16, 1, e);
            if (city3D) city3D.fire(e.x, e.y, a, false, 0);
          }
          continue;
        }
        let goal = null,
          speed = 4.8 * KMH;
        if (e.role === 'drill' || e.role === 'sergeant') {
          if (drilling) {
            if (e.role === 'drill') goal = drillSlot(e.slot);
            else {
              const c = Math.cos(militaryDrill.a),
                s = Math.sin(militaryDrill.a);
              goal = { x: militaryDrill.x - 20 * c + 62 * s, y: militaryDrill.y - 20 * s - 62 * c };
              if (gameTime > militaryDrill.callAt && d < 700) {
                militaryDrill.callAt = gameTime + 2.6;
                militaryDrill.step = (militaryDrill.step + 1) % 4;
                militarySpeak(e, gameTime < militaryDrill.pauseUntil ? 'PLATOON... HALT!' : ['LEFT!', 'LEFT! RIGHT!', 'LEFT, RIGHT, LEFT!', 'SOUND OFF!'][militaryDrill.step], 1.6);
              }
            }
            speed = 7 * KMH;
          } else goal = e.barracksHome;
          if (goal && distanceBetween(e, goal) < 2.5) {
            if (drilling) e.a = militaryDrill.a;
            goal = null;
          }
        } else if (e.route) {
          if (gameTime < (e.pauseUntil || 0)) goal = null;
          else {
            const target = e.route[e.routeIndex],
              t = { x: target.x, y: target.y + (e.offset || 0) };
            if (distanceBetween(e, t) < 6) {
              e.routeIndex = (e.routeIndex + 1) % e.route.length;
              e.pauseUntil = gameTime + 2 + seededRandom() * 4;
            } else goal = t;
          }
        } else if (distanceBetween(e, e.home) > 10) goal = e.home;
        else e.a = e.home.a ?? e.a;
        if (goal) {
          footStepTowards(e, goal, deltaSeconds, Math.min(speed, distanceBetween(e, goal) / Math.max(deltaSeconds, 1e-3)));
          e.walking = true;
        }
      }
      // Casualties are replaced once things are quiet and nobody is looking.
      if (!alert && gameTime > militaryRespawnAt && gameTime - militaryAlarmStartedAt > 120) {
        militaryRespawnAt = gameTime + 20;
        for (const e of gangMembers)
          if (e.military && e.hp <= 0 && distanceBetween(e.home, player) > 900) {
            Object.assign(e, e.home, {
              hp: e.maxhp,
              vest: 110,
              knockedFor: 0,
              dazedFor: 0,
              impactCooldown: 0,
              playerThreatUntil: 0,
              policeThreatUntil: 0,
              aiming: false,
              timer: 1.5,
            });
            if (e.route) e.routeIndex = 1;
          }
      }
    }
    function militaryUI() {
      if (gameMode !== 'play') return;
      if (distanceBetween(player, MILITARY.gate) < 125 && militaryGateClosedToPlayer() && !isAircraft(player.car)) {
        offerPrompt('FORCE THE GATE CONTROLS · ARMED RESPONSE', { id: 'fort-gate' });
      }
      if (player.car?.type === 'tank') {
        getElement('weaponName').textContent = '120 MM TANK CANNON';
        getElement('ammo').textContent = gameTime < (player.car.cannonReadyAt || 0) ? '··' : '01';
        getElement('reserve').textContent = ' / AUTOLOAD';
        getElement('reloadHint').textContent = 'F';
      }
    }
    function drawMilitary2D() {
      for (const b of militaryWalls) {
        if (!visible({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, Math.max(b.w, b.h))) continue;
        worldContext.fillStyle = b.fence ? '#4d5a4b' : b.kind === 'barrier' ? '#b9b6a8' : '#667058';
        worldContext.fillRect(b.x, b.y, b.w, b.h);
      }
      for (const b of militaryGateSolids()) {
        worldContext.fillStyle = b.part === 'slide' ? '#3b4245' : '#d3af5c';
        worldContext.fillRect(b.x, b.y, b.w, b.h);
      }
      if (visible(MILITARY.gate, 300)) {
        worldContext.fillStyle = '#e3c598';
        worldContext.font = 'bold 12px Arial';
        worldContext.fillText('FORT SENTINEL · RESTRICTED', 9120, 8030);
      }
    }
    // Console snapshot of the base's security state (tests and tuning).
    function militaryReport() {
      const people = gangMembers.filter((e) => e.military),
        roles = {};
      for (const e of people) roles[e.role] = (roles[e.role] || 0) + (e.hp > 0 ? 1 : 0);
      return {
        alert: militaryAlertUntil > gameTime,
        lockdown: militaryLockdown(),
        challenge: militaryChallenge.level,
        gate: militaryGateState.map((s) => ({
          arm: +s.arm.toFixed(2),
          bollards: +s.bollards.toFixed(2),
          slide: +s.slide.toFixed(2),
          broken: [s.armBroken && 'arm', s.bollardsBroken && 'bollards', s.slideBroken && 'slide'].filter(Boolean),
        })),
        soldiers: roles,
        aiming: people.filter((e) => e.hp > 0 && e.aiming).length,
        vehicles: vehicles
          .filter((c) => c.military)
          .map((c) => ({ type: c.type, x: Math.round(c.x), y: Math.round(c.y), hp: Math.round(c.hp), ai: !!c.ai, role: c.qrf ? 'qrf' : c.patrol ? 'patrol' : c.supply ? 'supply' : c.crewed ? 'crewed' : 'parked' })),
        supply: militarySupply ? militarySupply.stage : null,
        drill: { x: Math.round(militaryDrill.x), y: Math.round(militaryDrill.y), active: drillHours() && militaryAlertUntil < gameTime },
      };
    }
