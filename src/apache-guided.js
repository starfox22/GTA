    // Apache guided loadout: target acquisition, hardpoint release and finite missile guidance.
    // Player-only weapons; every projectile uses updateBullets' swept hits and explode's shared damage.
    const APACHE_LOADOUT = [
      { id: 'cannon', name: '30 MM CHIN GUN', ammo: 'rounds', capacity: APACHE_GUN_ROUNDS },
      { id: 'rockets', name: '70 MM ROCKET PODS', ammo: 'rockets', capacity: APACHE_ROCKETS },
      { id: 'hellfire', name: 'HELLFIRE · ANTI-ARMOUR', ammo: 'missiles', capacity: 8, lock: 0.65, interval: 1.8, speed: 620, life: 4, turn: 3.5, damage: 330, blast: 1.15, rearm: 2.5 },
      { id: 'stinger', name: 'STINGER · AIR TARGETS', ammo: 'airMissiles', capacity: 4, lock: 0.45, interval: 1.3, speed: 760, life: 3.5, turn: 5, damage: 190, blast: 0.75, rearm: 3 },
    ];
    const apacheLockProjection = { x: 0, y: 0, depth: 0, behind: false };
    function apacheWeapon(c) {
      const id = apacheArms(c).weapon;
      for (let i = 0; i < APACHE_LOADOUT.length; i++) if (APACHE_LOADOUT[i].id === id) return APACHE_LOADOUT[i];
      return APACHE_LOADOUT[0];
    }
    function apacheClearLock(arms) {
      arms.lockTarget = null;
      arms.lockSince = 0;
      arms.lockReady = false;
    }
    function cycleApacheWeapon(c = player.car) {
      if (!isApache(c) || c.hp <= 0) return false;
      const arms = apacheArms(c),
        index = APACHE_LOADOUT.indexOf(apacheWeapon(c));
      arms.weapon = APACHE_LOADOUT[(index + 1) % APACHE_LOADOUT.length].id;
      arms.lockNextAt = 0;
      apacheClearLock(arms);
      tone(420, 0.03, 0.06);
      tell(apacheWeapon(c).name + ' · ' + pressKey('fire') + ' to fire', 2.5, { id: 'apache-weapon' });
      return true;
    }
    function apacheTargetAllowed(c, target, w) {
      return target !== c && target.hp > 0 &&
        (w.id === 'stinger' ? isAircraft(target) && aircraftClearance(target) > 20 : !isAircraft(target) && !isBoat(target));
    }
    function apacheTargetPoint(target) {
      return { x: target.x, y: target.y, altitude: entityElevation(target) + (isAircraft(target) ? 0 : 7) };
    }
    // The same solids and elevation rule as a projectile, sampled at its seven-unit swept resolution.
    // Only acquisition and a missile's 0.12 s sight checks ask this; never a candidate's bullet sub-step.
    function apacheLineClear(from, target) {
      const start = entityElevation(from), dx = target.x - from.x, dy = target.y - from.y,
        dz = entityElevation(target) - start,
        steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / 7));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        if (shotBlocked(from.x + dx * t, from.y + dy * t, start + dz * t)) return false;
      }
      return true;
    }
    function apacheTargetScore(c, target, aim, w) {
      const range = distanceBetween(c, target);
      if (range < 65 || range > 1400 || Math.abs(normalizeAngle(headingBetween(c, target) - c.a)) > 1.15) return Infinity;
      if (!apacheAimOverride && touchAim === null && (chaseCameraLive() || mouse.active)) {
        const z = entityElevation(target) + (isAircraft(target) ? 0 : 7),
          q = chaseCameraLive() ? chaseProject(target.x, target.y, z, apacheLockProjection)
            : city3D ? city3D.project(target.x, target.y, z)
              : { x: (target.x - cameraTarget.x) * canvasScale + viewportWidth / 2, y: (target.y - cameraTarget.y - z * 0.3) * canvasScale + viewportHeight / 2 },
          screen = chaseCameraLive() ? chaseAimScreen() : mouse,
          d = Math.hypot(q.x - screen.x, q.y - screen.y);
        return !q.behind && d < 60 ? d / 60 : Infinity;
      }
      if (w.id === 'stinger' && !apacheAimOverride) {
        const d = Math.abs(normalizeAngle(headingBetween(c, target) - aim.a));
        return d < 0.22 ? d / 0.22 + range * 0.00001 : Infinity;
      }
      const d = Math.hypot(target.x - aim.x, target.y - aim.y);
      return d < 90 ? d / 90 : Infinity;
    }
    function updateApacheLock(c, aim) {
      const arms = apacheArms(c), w = apacheWeapon(c);
      if (!w.lock) {
        if (arms.lockTarget) apacheClearLock(arms);
        return;
      }
      if (gameTime < arms.lockNextAt) return;
      arms.lockNextAt = gameTime + 0.1;
      let best = Infinity, target = null;
      for (let i = 0; i < vehicles.length; i++) {
        const candidate = vehicles[i];
        if (!apacheTargetAllowed(c, candidate, w)) continue;
        const score = apacheTargetScore(c, candidate, aim, w);
        if (score < best) {
          best = score;
          target = candidate;
        }
      }
      if (target && !apacheLineClear(apacheHardpoint(c, APACHE_HARDPOINTS.gun.pivot), apacheTargetPoint(target))) target = null;
      if (target !== arms.lockTarget) {
        apacheClearLock(arms);
        arms.lockTarget = target;
        arms.lockSince = gameTime;
      }
      arms.lockReady = !!target && gameTime - arms.lockSince >= w.lock;
    }
    function apacheGuidedFire(c) {
      const arms = apacheArms(c), w = apacheWeapon(c);
      if (arms.rearming || !w.lock || gameTime < (arms[w.id + 'ReadyAt'] || 0)) return false;
      if (arms[w.ammo] <= 0) return apacheEmpty(arms, w.name);
      const target = arms.lockTarget;
      const valid = !!target && apacheTargetAllowed(c, target, w) &&
        apacheLineClear(apacheHardpoint(c, APACHE_HARDPOINTS.gun.pivot), apacheTargetPoint(target));
      if (!arms.lockReady || !valid) {
        if (!valid) apacheClearLock(arms);
        if (gameTime > (arms.lockHintAt || 0)) {
          arms.lockHintAt = gameTime + 2;
          tell(w.id === 'stinger' ? 'AIR TARGETS · hold the aim on an airborne aircraft for LOCK' : 'ANTI-ARMOUR · hold the aim on a ground vehicle for LOCK', 2.5, { id: 'apache-lock' });
        }
        return false;
      }
      const slot = w.capacity - arms[w.ammo],
        origin = apacheHardpoint(c, (w.id === 'stinger' ? APACHE_HARDPOINTS.air : APACHE_HARDPOINTS.antiarmor)[slot]),
        point = apacheTargetPoint(target),
        // The release follows the rack; guidance turns it toward the target during flight.
        pitch = clamp(Math.atan2(point.altitude - origin.altitude, distanceBetween(origin, point)), -0.6, 0.6),
        speed = w.speed;
      arms[w.ammo]--;
      arms[w.id + 'ReadyAt'] = gameTime + w.interval;
      bullets.push({ ...origin, vx: Math.cos(c.a) * Math.cos(pitch) * speed, vy: Math.sin(c.a) * Math.cos(pitch) * speed,
        vz: Math.sin(pitch) * speed, life: w.life, dmg: w.damage, rocket: true, shell: true, antiTank: w.id === 'hellfire',
        blastPower: w.blast, enemy: false, owner: player, tracer: 0.02, apacheGuided: w.id,
        apacheTarget: target, apacheSightAt: gameTime + 0.12, apacheTrailAt: 0, apacheSpeed: speed, apacheTurn: w.turn,
      });
      apacheLaunchFeedback(c, origin, c.a);
      return true;
    }
    // Called once per projectile frame before the common sweep, including after bailout/destruction.
    // Losing sight retires its target reference permanently; no searching or new lock during flight.
    function updateApacheGuidance(b, deltaSeconds) {
      const target = b.apacheTarget;
      if (target && gameTime >= b.apacheSightAt) {
        b.apacheSightAt = gameTime + 0.12;
        if (target.hp <= 0 || !vehicles.includes(target) || distanceBetween(b, target) > 2200 || !apacheLineClear(b, apacheTargetPoint(target)))
          b.apacheTarget = null;
      }
      if (b.apacheTarget) {
        const t = b.apacheTarget,
          lead = Math.min(0.3, distanceBetween(b, t) / b.apacheSpeed),
          dx = t.x + (t.vx || 0) * lead - b.x, dy = t.y + (t.vy || 0) * lead - b.y,
          dz = entityElevation(t) + (isAircraft(t) ? 0 : 7) + (t.vz || 0) * lead - b.altitude,
          a = Math.atan2(b.vy, b.vx), pitch = Math.atan2(b.vz, Math.hypot(b.vx, b.vy)), turn = b.apacheTurn * deltaSeconds,
          heading = a + clamp(normalizeAngle(Math.atan2(dy, dx) - a), -turn, turn),
          climb = pitch + clamp(Math.atan2(dz, Math.hypot(dx, dy)) - pitch, -turn, turn), speed = b.apacheSpeed;
        b.vx = Math.cos(heading) * Math.cos(climb) * speed;
        b.vy = Math.sin(heading) * Math.cos(climb) * speed;
        b.vz = Math.sin(climb) * speed;
      }
      if (city3D && gameTime >= (b.apacheTrailAt || 0)) {
        b.apacheTrailAt = gameTime + 0.055;
        city3D.smokePuff(b.x, b.y, b.altitude || 0, 0.7);
      }
    }
