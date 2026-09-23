    // BEGIN SUBSYSTEM: src/military.js — Fort Sentinel
    /**
     * Fort Sentinel
     * Source: src/military.js
     * Scope: shared game closure.
     * Base security, military vehicles, barriers and combat.
     */
    /* An independent restricted island: physical perimeter, alert guards and stealable tracked armor. */
    const MILITARY = {
      name: 'FORT SENTINEL',
      x: 9300,
      y: 7750,
      w: 1260,
      h: 1500,
      gate: {
        x: 9300,
        y: 8150,
        half: 94,
      },
      helipad: {
        x: 10200,
        y: 8850,
      },
    };
    let militaryGate = 0,
      militaryGateUntil = 0,
      militaryAlertUntil = 0,
      militaryWarningAt = -100;
    const militaryWalls = [
      {
        x: 9300,
        y: 7750,
        w: 1260,
        h: 9,
        height: 23,
      },
      {
        x: 9300,
        y: 9241,
        w: 1260,
        h: 9,
        height: 23,
      },
      {
        x: 10551,
        y: 7750,
        w: 9,
        h: 1500,
        height: 23,
      },
      {
        x: 9300,
        y: 7750,
        w: 9,
        h: 306,
        height: 23,
      },
      {
        x: 9300,
        y: 8244,
        w: 9,
        h: 1006,
        height: 23,
      },
    ];
    function inMilitary(x, y, margin = 0) {
      return (
        x > MILITARY.x - margin &&
        x < MILITARY.x + MILITARY.w + margin &&
        y > MILITARY.y - margin &&
        y < MILITARY.y + MILITARY.h + margin
      );
    }
    function militarySolids() {
      return militaryGate > 0.85
        ? militaryWalls
        : [
            ...militaryWalls,
            {
              x: 9300,
              y: 8056,
              w: 10,
              h: 188,
              height: 18,
              barrier: true,
            },
          ];
    }
    function militaryBlocked(x, y, r = 8) {
      return militarySolids().some(
        (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h,
      );
    }
    function militaryVehicleBlocked(vehicle) {
      const shape = vehicleShape(vehicle);
      return militarySolids().some((b) =>
        boxContact(shape, {
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          hx: b.w / 2,
          hy: b.h / 2,
          a: 0,
        }),
      );
    }
    function militaryAlarm() {
      if (militaryAlertUntil < gameTime) {
        announce('FORT SENTINEL · TRESPASSING', 'BASE SECURITY ALERT', 2.5);
        tell('Armed sentries and armored patrols are responding. Leave the restricted perimeter.', 5);
        crime(3);
      }
      militaryAlertUntil = gameTime + 22;
    }
    function militaryInteract() {
      if (
        playerOnRoof() ||
        (player.car?.altitude || 0) > 4 ||
        distanceBetween(player, MILITARY.gate) > 125
      )
        return false;
      if (militaryGate > 0.85) return false;
      militaryGateUntil = gameTime + 18;
      militaryAlarm();
      tell('Security barrier breached. It will stay open while you cross.', 4);
      return true;
    }
    function paintMilitaryGround(drawingContext) {
      drawingContext.fillStyle = '#7b8272';
      drawingContext.fillRect(MILITARY.x, MILITARY.y, MILITARY.w, MILITARY.h);
      drawingContext.fillStyle = '#475453';
      drawingContext.fillRect(9290, 8082, 1220, 136);
      drawingContext.fillRect(9465, 7910, 960, 130);
      drawingContext.fillRect(9465, 9000, 960, 135);
      drawingContext.fillRect(9465, 7910, 130, 1225);
      drawingContext.fillRect(10300, 7910, 125, 1225);
      drawingContext.fillStyle = '#c0b987';
      for (let x = 9360; x < 10500; x += 52) drawingContext.fillRect(x, 8148, 24, 3);
      drawingContext.fillStyle = '#c4c2a3';
      drawingContext.font = 'bold 44px monospace';
      drawingContext.fillText('RESTRICTED', 9540, 8300);
      drawingContext.strokeStyle = '#d1c7a5';
      drawingContext.lineWidth = 5;
      drawingContext.beginPath();
      drawingContext.arc(MILITARY.helipad.x, MILITARY.helipad.y, 65, 0, TAU);
      drawingContext.stroke();
      drawingContext.font = 'bold 65px Arial';
      drawingContext.fillText('H', MILITARY.helipad.x - 22, MILITARY.helipad.y + 22);
    }
    function buildMilitary() {
      const old = randomSeed;
      randomSeed = 77077;
      for (const b of [
        {
          x: 9650,
          y: 8390,
          w: 370,
          h: 155,
        },
        {
          x: 9650,
          y: 8610,
          w: 190,
          h: 210,
        },
        {
          x: 9940,
          y: 7790,
          w: 240,
          h: 90,
        },
        {
          x: 9860,
          y: 8930,
          w: 250,
          h: 60,
        },
        {
          x: 9335,
          y: 7980,
          w: 80,
          h: 65,
        },
      ]) {
        makeBuilding(b.x, b.y, b.w, b.h, 2, true);
        Object.assign(buildings.at(-1), {
          county: true,
          tropical: false,
          height: b.w > 300 ? 46 : 27,
          military: true,
        });
      }
      randomSeed = old;
    }
    function populateMilitary() {
      militaryGate = 0;
      militaryGateUntil = militaryAlertUntil = 0;
      militaryWarningAt = -100;
      const route = [
        {
          x: 9530,
          y: 7970,
        },
        {
          x: 10355,
          y: 7970,
        },
        {
          x: 10355,
          y: 9070,
        },
        {
          x: 9530,
          y: 9070,
        },
      ];
      for (const [i, p] of [
        [9700, 8150],
        [10120, 8670],
        [9840, 9120],
        [9530, 7970],
      ].entries()) {
        const c = makeCar('tank', p[0], p[1], i === 3 ? 0 : Math.PI, i === 3);
        c.military = true;
        c.turretA = c.a;
        if (i === 3) {
          c.countyRoute = route;
          c.countyIndex = 1;
        }
      }
      for (const [i, p] of [
        [9360, 8070],
        [9360, 8230],
        [9500, 7820],
        [10450, 7830],
        [10460, 9150],
        [9400, 9110],
        [9550, 8370],
        [10080, 8390],
        [10080, 8810],
        [9550, 8860],
        [10300, 8330],
        [9810, 8030],
      ].entries())
        gangMembers.push({
          x: p[0],
          y: p[1],
          home: {
            x: p[0],
            y: p[1],
          },
          a: i % 2 ? Math.PI : 0,
          hp: 115,
          maxhp: 115,
          // Base security wear plate carriers: small arms need several rounds to matter.
          vest: 110,
          color: '#657653',
          faction: 'military',
          military: true,
          name: 'SENTINEL SECURITY',
          timer: 1.5 + i * 0.13,
          walk: 0,
        });
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
    function updateMilitary(deltaSeconds) {
      const inside = inMilitary(player.x, player.y),
        near = distanceBetween(player, MILITARY.gate) < 480;
      if (near && !inside && militaryAlertUntil < gameTime && gameTime - militaryWarningAt > 25) {
        militaryWarningAt = gameTime;
        tell(
          'FORT SENTINEL · Restricted military island. Crossing the security gate will trigger an armed response.',
          6,
        );
      }
      if (
        inside ||
        gangMembers.some((g) => g.military && (g.playerThreatUntil || 0) > gameTime) ||
        vehicles.some(
          (c) =>
            c.military &&
            c.hp > 0 &&
            c.lastAttacker === player &&
            gameTime - (c.lastDamagedAt ?? -100) < 22 &&
            distanceBetween(c, player) < 700,
        )
      )
        militaryAlarm();
      if (player.x > 9300 && distanceBetween(player, MILITARY.gate) < 180)
        militaryGateUntil = Math.max(militaryGateUntil, gameTime + 4);
      const occupied = vehicles.some(
        (c) =>
          (c.altitude || 0) < 20 &&
          Math.abs(c.x - 9305) < vehicleSpec(c).l + 15 &&
          Math.abs(c.y - 8150) < 120,
      );
      militaryGate = clamp(
        militaryGate +
          (gameTime < militaryGateUntil || (occupied && militaryGate > 0.85) ? 1 : -1) *
            deltaSeconds *
            0.9,
        0,
        1,
      );
      const alert = militaryAlertUntil > gameTime;
      for (const c of vehicles.filter((c) => c.military && c.hp > 0)) {
        if (c === player.car) {
          c.turretA = aim();
          continue;
        }
        if (c.stolen) continue;
        const d = distanceBetween(c, player);
        if (alert && d < 700 && !playerOnRoof() && sameFloor(c, player) && clearSight(c, player)) {
          c.turretA = headingBetween(c, player);
          if (!c.targetAcquired) {
            c.targetAcquired = gameTime + 2.8;
          }
          if (gameTime > c.targetAcquired && d > 150) tankFire(c, true);
        } else {
          c.targetAcquired = 0;
          c.turretA = c.a;
        }
      }
      for (const e of gangMembers) {
        if (!e.military || e.hp <= 0 || personIncapacitated(e) || distanceBetween(e, player) > 1200)
          continue;
        e.timer -= deltaSeconds;
        const d = distanceBetween(e, player);
        e.aiming = alert && d < 590 && sameFloor(e, player) && !playerOnRoof();
        if (e.aiming) {
          e.a = headingBetween(e, player);
          if (d > 245 && inMilitary(player.x, player.y, 220))
            footStepTowards(e, player, deltaSeconds, 49);
          if (e.timer <= 0 && clearSight(e, player)) {
            e.timer = 0.55 + seededRandom() * 0.35;
            const a = e.a + randomBetween(-0.055, 0.055);
            bullets.push({
              x: e.x + Math.cos(a) * 15,
              y: e.y + Math.sin(a) * 15,
              altitude: entityElevation(e),
              vx: Math.cos(a) * 680,
              vy: Math.sin(a) * 680,
              life: 0.9,
              dmg: 13,
              enemy: true,
              faction: 'military',
              owner: e,
              target: player,
            });
            playSample('automatic', 0.28, 1, e);
            if (city3D) city3D.fire(e.x, e.y, a, false, entityElevation(e));
          }
        } else if (distanceBetween(e, e.home) > 12) footStepTowards(e, e.home, deltaSeconds, 26);
      }
    }
    function militaryUI() {
      if (gameMode !== 'play') return;
      if (distanceBetween(player, MILITARY.gate) < 125 && militaryGate < 0.85) {
        getElement('interaction').style.display = 'block';
        getElement('interaction').textContent = 'E · BREACH SECURITY BARRIER · ARMED RESPONSE';
      }
      if (player.car?.type === 'tank') {
        getElement('weaponName').textContent = '120 MM TANK CANNON';
        getElement('ammo').textContent = gameTime < (player.car.cannonReadyAt || 0) ? '··' : '01';
        getElement('reserve').textContent = ' / AUTOLOAD';
        getElement('reloadHint').textContent = 'F';
      }
    }
    function drawMilitary2D() {
      for (const b of militarySolids()) {
        worldContext.fillStyle = b.barrier ? '#d3af5c' : '#566352';
        worldContext.fillRect(b.x, b.y, b.w, b.h);
      }
      if (visible(MILITARY.gate, 300)) {
        worldContext.fillStyle = '#e3c598';
        worldContext.font = 'bold 12px Arial';
        worldContext.fillText('FORT SENTINEL · RESTRICTED', 9300, 8020);
      }
    }
    // END SUBSYSTEM: src/military.js
