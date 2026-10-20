    // BEGIN SUBSYSTEM: src/apache.js — Fort Sentinel's AH-64 attack helicopter
    /**
     * Fort Sentinel's AH-64 attack helicopter
     * Source: src/apache.js
     * Scope: shared game closure.
     *
     * ONE AIRCRAFT, PARKED: an AH-64D-style attack helicopter stands on the west
     * helipad of Fort Sentinel's airfield (SENTINEL.helipads[0], 10200 / 9365,
     * nose south to the apron). It is an ordinary `helicopter` vehicle with
     * `airframe: 'apache'` (HELICOPTER_AIRFRAMES: size, armour, name; vehicleSpec
     * merges it), so it flies with the existing helicopter flight model and
     * controls (physics.js helicopterControl) and lands, roofs and bails out like
     * any helicopter. apache3d.js draws it. Nothing but the player ever flies it:
     * no AI takes it, the police helicopter is a separate unarmed airframe
     * (combat-rules.js POLICE HELICOPTER), and pursuits never send it.
     *
     * STEALING IT: boarding it is theft of military hardware. The base's own
     * rules apply as they do for its tanks (militaryAlarm: siren, lockdown, the
     * garrison engages an intruder near the ground), and the heat goes to the
     * top of the scale. Taken from its pad (inside the fence) it is five stars
     * at once, as for every vehicle of the base (fort-cover.js
     * fortCoverBoarded). No snipers come (swat.js SNIPERS_ENABLED).
     *
     * WEAPONS (player only):
     *   - Cycle aircraft weapons selects the 30 mm gun, rocket pods, guided
     *     anti-armour missiles or air-target missiles; Fire uses that selection.
     *     The rocket action / right click remains a direct rocket-pod shortcut.
     *   - the M230-style 30 mm chin gun: the turret turns
     *     toward the mouse (or the touch aim, or dead ahead) at a real slew rate,
     *     limited to APACHE_GUN_ARC either side of the nose, and the rounds go
     *     where the barrel points, down to the ground point under the mouse.
     *     Tracers, sparks and a small high-explosive splash (apacheRoundImpact).
     *   - Hydra-style 70 mm rockets (`rockets`, SPACE / right click): a salvo of
     *     APACHE_SALVO rippled from the two pods, aimed along the nose (up to
     *     APACHE_ROCKET_ARC off it) to the range of the aim point. They are
     *     rocket rounds with `shell` set: they explode through `explode()`
     *     (vehicle damage, burning wrecks, blast effects, the explosion sound)
     *     and breach facades like a tank round (damage.js heavyRoundHitsBuilding).
     *   - Guided weapons acquire visible vehicles under the reticle, with a
     *     short lock time. Their finite flight uses the ordinary swept bullet,
     *     armour and explosion rules (apache-guided.js), even after the pilot exits.
     *   - Ammunition is limited for every type. Landed on one
     *     of Fort Sentinel's helipads the ground crew rearms it over some twenty
     *     seconds (APACHE_REARM_*); the weapon chip reads REARMING. The base is
     *     hostile by then, so it is a fight: the armoured airframe takes only
     *     APACHE_SMALL_ARMS_SHARE of rifle and machine-gun damage, rockets and
     *     tank rounds in full.
     *
     * A wreck, or an Apache lost somewhere, is replaced on its pad after
     * APACHE_RESPAWN_SECONDS once the player is well away from the base.
     * `DeadEndCity.apache()` reports it; `apacheAim(x, y)` fixes the aim point
     * for headless tests.
     */
    const HELICOPTER_AIRFRAMES = {
      apache: {
        name: 'AH-64 APACHE',
        // Downloaded source body, fitted stores and offset main-rotor sweep.
        l: 116.72,
        w: 47.3,
        rotorRadius: 58.52,
        rotorX: 22.041211714,
        hp: 640,
        mass: 5,
        color: '#4a5141',
      },
    };
    const APACHE_PAD = { x: SENTINEL.helipads[0].x, y: SENTINEL.helipads[0].y, a: Math.PI / 2 },
      APACHE_GUN_ROUNDS = 320,
      APACHE_GUN_INTERVAL = 0.1,
      APACHE_GUN_SPEED = 1050,
      APACHE_GUN_DAMAGE = 44,
      APACHE_GUN_ARC = (110 * Math.PI) / 180,
      APACHE_GUN_SLEW = (120 * Math.PI) / 180,
      APACHE_GUN_REST_PITCH = -0.10529590596017684,
      APACHE_GUN_REST_YAW = 0.003490235,
      APACHE_ROCKETS = 38,
      APACHE_SALVO = 4,
      APACHE_RIPPLE = 0.13,
      APACHE_SALVO_REST = 1.3,
      APACHE_ROCKET_SPEED = 760,
      APACHE_ROCKET_ARC = 0.35,
      APACHE_REARM_ROUNDS_PER_SECOND = 25,
      APACHE_REARM_ROCKET_SECONDS = 0.45,
      // Armour against rifle and machine-gun rounds (combat-rules.js vehicleArmorShare).
      APACHE_SMALL_ARMS_SHARE = 0.3,
      APACHE_RESPAWN_SECONDS = 240;
    // A fixed aim point for tests (DeadEndCity.apacheAim), or null.
    let apacheAimOverride = null,
      apacheRespawnAt = 0,
      apacheMissingSince = -1;
    function isApache(c) {
      return !!c && c.type === 'helicopter' && c.airframe === 'apache';
    }
    function apacheArms(c) {
      if (!c.arms)
        c.arms = {
          weapon: 'cannon',
          rounds: APACHE_GUN_ROUNDS,
          rockets: APACHE_ROCKETS,
          missiles: 8,
          airMissiles: 4,
          hellfireReadyAt: 0,
          stingerReadyAt: 0,
          lockTarget: null,
          lockSince: 0,
          lockReady: false,
          lockNextAt: 0,
          lockHintAt: 0,
          gunReadyAt: 0,
          salvoLeft: 0,
          nextRocketAt: 0,
          salvoReadyAt: 0,
          pod: 1,
          rearming: false,
          rearmRockets: 0,
          rearmRounds: 0,
          rearmMissiles: 0,
          rearmAirMissiles: 0,
        };
      return c.arms;
    }
    // Measured downloaded source release points (game units, local nose/right/up).
    const APACHE_HARDPOINTS = {
      gun: {
        pivot: { x: 38.55438523592196, y: 0.08224280532820015, z: 6.2728859500377965 },
        muzzle: { x: 49.05432280588573, y: 0.09089941722512332, z: 1.3113685154341794 },
      },
      pods: [
        { x: 26.734676807117587, y: 19.06230233523766, z: 9.082014673260925 },
        { x: 26.734679061548874, y: -19.017265965661654, z: 9.056688605196639 },
      ],
      antiarmor: [
        { x: 26.838523593826682, y: -12.3262907573607, z: 7.591094220648155 },
        { x: 26.530495748350535, y: 12.352535573181635, z: 7.501511862741542 },
        { x: 26.838523738719292, y: -14.245451593443414, z: 7.591093907977257 },
        { x: 26.530495603457926, y: 14.271695932619286, z: 7.501512175412594 },
        { x: 26.864095244163263, y: -12.326291053789431, z: 9.422410562578548 },
        { x: 26.556067398687112, y: 12.352535276752905, z: 9.332828204671936 },
        { x: 26.864095389055873, y: -14.245451889872145, z: 9.422410249907653 },
        { x: 26.556067253794506, y: 14.27169563619055, z: 9.332828517342989 },
      ],
      air: [
        { x: 26.880000000000003, y: -23.28, z: 12.88 },
        { x: 26.880000000000003, y: 23.28, z: 12.88 },
        { x: 26.880000000000003, y: -23.28, z: 10.96 },
        { x: 26.880000000000003, y: 23.28, z: 10.96 },
      ],
    };
    // The renderer reads these same attitudes: release points never depend on a drawn model.
    function apacheBodyPitch(c) {
      return clamp(-(c.speed || 0) * 0.00035, -0.13, 0.13);
    }
    function apacheBodyRoll(c) {
      return clamp((c.av || 0) * 0.065, -0.1, 0.1);
    }
    function apacheHardpoint(c, point) {
      const pitch = apacheBodyPitch(c), roll = apacheBodyRoll(c),
        x = point.x * Math.cos(pitch) - point.z * Math.sin(pitch),
        up = point.x * Math.sin(pitch) + point.z * Math.cos(pitch),
        y = point.y * Math.cos(roll) + up * Math.sin(roll),
        z = up * Math.cos(roll) - point.y * Math.sin(roll);
      return { x: c.x + x * Math.cos(c.a) - y * Math.sin(c.a), y: c.y + x * Math.sin(c.a) + y * Math.cos(c.a), altitude: entityElevation(c) + z };
    }
    function apacheGunMuzzle(c, heading) {
      const pivot = APACHE_HARDPOINTS.gun.pivot, tip = APACHE_HARDPOINTS.gun.muzzle,
        rel = apacheGunYaw(c, heading), pitch = c.gunPitch || 0,
        dx = tip.x - pivot.x, dy = tip.y - pivot.y, dz = tip.z - pivot.z,
        x = dx * Math.cos(pitch) - dz * Math.sin(pitch),
        z = dx * Math.sin(pitch) + dz * Math.cos(pitch);
      return apacheHardpoint(c, { x: pivot.x + x * Math.cos(rel) - dy * Math.sin(rel),
        y: pivot.y + x * Math.sin(rel) + dy * Math.cos(rel), z: pivot.z + z });
    }
    function apacheGunYaw(c, heading = c.turretA ?? c.a) {
      return normalizeAngle(heading - c.a) - APACHE_GUN_REST_YAW;
    }
    // @include src/apache-guided.js
    function apacheEmpty(arms, name) {
      if (gameTime - (arms.emptySaidAt ?? -100) > 3) {
        arms.emptySaidAt = gameTime;
        tell(name + ' · EMPTY · land on a Fort Sentinel helipad to rearm', 2.5);
        tone(100, 0.03, 0.06);
      }
      return false;
    }
    /* Parked on its pad, rotor still (populateMilitary, and the respawn). */
    function parkApache() {
      const c = makeCar('helicopter', APACHE_PAD.x, APACHE_PAD.y, APACHE_PAD.a, false, HELICOPTER_AIRFRAMES.apache.color);
      c.airframe = 'apache';
      c.hp = c.maxhp = vehicleSpec(c).hp;
      c.military = true;
      c.turretA = c.a;
      c.gunPitch = 0;
      apacheArms(c);
      return c;
    }
    function apacheVehicle() {
      return vehicles.find((c) => isApache(c) && c.hp > 0) || null;
    }
    /* The player takes the controls (enterVehicle, game.js). */
    function apacheBoarded(c) {
      apacheClearLock(apacheArms(c));
      if (!c.apacheTaken) {
        c.apacheTaken = true;
        militaryAlarm();
        // Theft of an armed military aircraft: the heat goes to the top of the
        // scale (the five-star floor plus room for the climb, heat.js), and the
        // stars rise to the military response at the usual pace.
        const short = HEAT_MAX - wantedHeat;
        if (short > 0) crime(short / CRIME_HEAT, 'seen');
        if (gameTime - lastDispatchLine > 3) dispatchCaption('MILITARY ATTACK HELICOPTER STOLEN · ARMY RESPONSE AUTHORISED', 'call-backup');
      }
      tell(
        'AH-64 APACHE · ' + keyName('ascend') + ' rise · ' + keyName('descend') + ' descend · ' + moveKeysName() + ' fly · aim at targets · ' +
          keyName('fire') + ' FIRE · ' + keyName('cycleAircraftWeapon') + ' WEAPON · ' + keyName('rockets') + ' ROCKETS',
        8,
      );
    }
    /* Where the gunner wants the rounds: a ground point (map x, y and height). */
    function apacheAimPoint(c) {
      const ground = terrainHeight(c.x, c.y);
      let p = null;
      if (apacheAimOverride) p = { x: apacheAimOverride.x, y: apacheAimOverride.y };
      // The chase view: the ground under the reticle (or the cursor), whatever aims (chase-rules.js).
      else if (chaseCameraLive() && touchAim === null) p = chaseGroundPoint(ground + 4);
      else if (mouse.active && touchAim === null && city3D) p = city3D.groundPoint(mouse.x, mouse.y, ground + 4);
      if (!p) {
        const a = touchAim ?? (chaseCameraLive() ? (chaseCam.viewYaw ?? c.a) : c.a);
        p = { x: c.x + Math.cos(a) * 340, y: c.y + Math.sin(a) * 340 };
      }
      // Between a short and a long burst's reach.
      const d = Math.hypot(p.x - c.x, p.y - c.y),
        range = clamp(d, 60, 1100),
        a = Math.atan2(p.y - c.y, p.x - c.x);
      return {
        x: c.x + Math.cos(a) * range,
        y: c.y + Math.sin(a) * range,
        altitude: terrainHeight(c.x + Math.cos(a) * range, c.y + Math.sin(a) * range) + 4,
        range,
        a,
      };
    }
    /* Per frame while the player flies the Apache (after updatePlayerArmor). */
    function updatePlayerApache(deltaSeconds) {
      updateApacheRespawn();
      const c = player.car;
      if (!isApache(c) || c.hp <= 0) return;
      const arms = apacheArms(c),
        aim = apacheAimPoint(c);
      c.gunAim = aim;
      // The chin turret slews toward the aim, stopping at its arc.
      const limit = (want) => c.a + clamp(normalizeAngle(want - c.a), -APACHE_GUN_ARC, APACHE_GUN_ARC);
      traverseTurret(c, limit(aim.a), deltaSeconds, APACHE_GUN_SLEW, 7);
      c.turretA = limit(c.turretA ?? c.a);
      const pivot = apacheHardpoint(c, APACHE_HARDPOINTS.gun.pivot),
        drop = pivot.altitude - aim.altitude;
      // The downloaded source bore rests six degrees down; its hinge angle is an offset.
      c.gunPitch = clamp(-Math.atan2(drop, aim.range), -1.05, 0.2) - APACHE_GUN_REST_PITCH - apacheBodyPitch(c);
      updateApacheLock(c, aim);
      if (gameMode === 'play' && (actionHeld('rockets') || mouse.alt)) apacheSalvo(c);
      // A salvo ripples out over a few frames.
      while (arms.salvoLeft > 0 && gameTime >= arms.nextRocketAt) {
        if (!apacheRocket(c, aim)) {
          arms.salvoLeft = 0;
          break;
        }
        arms.salvoLeft--;
        arms.nextRocketAt += APACHE_RIPPLE;
      }
      updateApacheRearm(c, deltaSeconds);
    }
    /* Fire: the selected armament (shoot()). The legacy entry name remains stable. */
    function apacheGun(c) {
      const arms = apacheArms(c);
      if (arms.rearming) return false;
      if (arms.weapon === 'rockets') return apacheSalvo(c);
      if (arms.weapon === 'hellfire' || arms.weapon === 'stinger') return apacheGuidedFire(c);
      if (gameTime < arms.gunReadyAt) return false;
      if (arms.rounds <= 0) return apacheEmpty(arms, '30 MM');
      arms.gunReadyAt = gameTime + APACHE_GUN_INTERVAL;
      arms.rounds--;
      const aim = c.gunAim || apacheAimPoint(c),
        a = (c.turretA ?? c.a) + randomBetween(-0.012, 0.012),
        // The muzzle, under the nose.
        origin = apacheGunMuzzle(c, a),
        // Where the barrel is laid, at the aim's range.
        reach = Math.max(40, Math.hypot(aim.x - origin.x, aim.y - origin.y)) + randomBetween(-10, 10),
        target = { x: origin.x + Math.cos(a) * reach, y: origin.y + Math.sin(a) * reach, altitude: aim.altitude },
        distance = combatDistance(origin, target);
      bullets.push({
        ...origin,
        ...shotVelocity(origin, target, APACHE_GUN_SPEED, a),
        life: distance / APACHE_GUN_SPEED + 0.25,
        dmg: APACHE_GUN_DAMAGE,
        enemy: false,
        owner: player,
        // Every round a tracer, a longer streak than a rifle's.
        tracer: 0.022,
        heavyRound: true,
        cal: 'rifle',
        goreCal: 'heavy',
      });
      playSample('automatic', 0.34, randomBetween(0.6, 0.66), c);
      if (city3D) city3D.fire(origin.x, origin.y, a, false, origin.altitude - 9);
      shake = Math.max(shake, 1.6);
      player.lastShotAt = gameTime;
      if (arms.rounds % 4 === 0) {
        notifyViolence(player, 'gunfire', player);
        crime(0.075);
      }
      return true;
    }
    /* A 30 mm high-explosive round going off where it struck (updateBullets):
       sparks and a small splash that hurts people standing right there. */
    function apacheRoundImpact(b) {
      const altitude = b.altitude || 0;
      if (city3D) city3D.impact(b.x, b.y, 'metal', altitude);
      particle(b.x, b.y, '#ffd08a', 3, 60, 3, true);
      for (const list of [pedestrians, enemies, gangMembers, officers])
        for (const p of list)
          if (p.hp > 0 && Math.abs(p.x - b.x) < 14 && Math.abs(p.y - b.y) < 14 && Math.abs(entityElevation(p) - altitude) < 20)
            strikePerson(p, 18, headingBetween(b, p), player, true, 'blast');
    }
    /* Rockets: start a salvo if the pods are ready. */
    function apacheSalvo(c) {
      const arms = apacheArms(c);
      if (arms.rearming || arms.salvoLeft > 0 || gameTime < arms.salvoReadyAt) return false;
      if (arms.rockets <= 0) return apacheEmpty(arms, 'ROCKET PODS');
      arms.salvoLeft = Math.min(APACHE_SALVO, arms.rockets);
      arms.nextRocketAt = gameTime;
      arms.salvoReadyAt = gameTime + APACHE_SALVO_REST + APACHE_RIPPLE * arms.salvoLeft;
      return true;
    }
    function apacheRocket(c, aim) {
      const arms = apacheArms(c);
      if (arms.rockets <= 0) return false;
      arms.rockets--;
      arms.pod = -arms.pod;
      // From the source pod on the outer pylon of that wing.
      const origin = apacheHardpoint(c, APACHE_HARDPOINTS.pods[arms.pod < 0 ? 0 : 1]),
        // Fired along the nose (the pilot points the aircraft); the aim sets the
        // range and pulls them a little toward it.
        a = c.a + clamp(normalizeAngle(aim.a - c.a), -APACHE_ROCKET_ARC, APACHE_ROCKET_ARC) + randomBetween(-0.012, 0.012),
        reach = aim.range * randomBetween(0.97, 1.03),
        target = { x: c.x + Math.cos(a) * reach, y: c.y + Math.sin(a) * reach },
        distance = Math.hypot(target.x - origin.x, target.y - origin.y, 0);
      target.altitude = terrainHeight(target.x, target.y) + 2;
      const flight = combatDistance(origin, target) / APACHE_ROCKET_SPEED;
      bullets.push({
        ...origin,
        ...shotVelocity(origin, target, APACHE_ROCKET_SPEED, Math.atan2(target.y - origin.y, target.x - origin.x)),
        // Goes off at the aim point if nothing stops it first.
        life: flight,
        motorOut: flight * 0.35,
        dmg: 150,
        rocket: true,
        // Breaches a facade it strikes, like a tank round (damage3d.js shellImpact).
        shell: true,
        blastPower: 0.9,
        enemy: false,
        owner: player,
        tracer: 0.02,
        apacheRocket: true,
        reach: distance,
      });
      apacheLaunchFeedback(c, origin, a);
      return true;
    }
    function apacheLaunchFeedback(c, origin, a) {
      playSample('explosion', 0.3, randomBetween(1.65, 1.8), c);
      noise(0.3, 0.16, 900);
      if (city3D) city3D.fire(origin.x, origin.y, a, true, origin.altitude - 9);
      shake = Math.max(shake, 3);
      player.lastShotAt = gameTime;
      notifyViolence(player, 'gunfire', player);
      crime(0.4);
    }
    /* Landed on one of Fort Sentinel's helipads: the ground crew rearms it. */
    function apacheOnBasePad(c) {
      return (
        aircraftClearance(c) < 1 &&
        Math.hypot(c.vx || 0, c.vy || 0) < 12 &&
        SENTINEL.helipads.some((p) => Math.hypot(c.x - p.x, c.y - p.y) < p.r + 24)
      );
    }
    function updateApacheRearm(c, deltaSeconds) {
      const arms = apacheArms(c),
        full = arms.rounds >= APACHE_GUN_ROUNDS && arms.rockets >= APACHE_ROCKETS && arms.missiles >= 8 && arms.airMissiles >= 4,
        rearming = !full && apacheOnBasePad(c);
      if (rearming && !arms.rearming) {
        tell('FORT SENTINEL PAD · REARMING · stay on the pad', 3);
        reloadSound();
      }
      if (!rearming && arms.rearming && full) tone(560, 0.06, 0.12, 'square', 760);
      arms.rearming = rearming;
      if (!rearming) return;
      // No firing or lock progress while a grounded crew is fitting live stores.
      arms.salvoLeft = 0;
      apacheClearLock(arms);
      arms.rearmRounds += deltaSeconds * APACHE_REARM_ROUNDS_PER_SECOND;
      const rounds = Math.floor(arms.rearmRounds);
      arms.rearmRounds -= rounds;
      arms.rounds = Math.min(APACHE_GUN_ROUNDS, arms.rounds + rounds);
      arms.rearmRockets += deltaSeconds;
      if (arms.rearmRockets >= APACHE_REARM_ROCKET_SECONDS) {
        arms.rearmRockets -= APACHE_REARM_ROCKET_SECONDS;
        if (arms.rockets < APACHE_ROCKETS) {
          arms.rockets++;
          tone(380, 0.03, 0.05, 'square');
        }
      }
      for (let i = 2; i < APACHE_LOADOUT.length; i++) {
        const w = APACHE_LOADOUT[i], clock = w.id === 'hellfire' ? 'rearmMissiles' : 'rearmAirMissiles';
        if (arms[w.ammo] >= w.capacity) continue;
        arms[clock] += deltaSeconds;
        if (arms[clock] >= w.rearm) {
          arms[clock] -= w.rearm;
          arms[w.ammo]++;
        }
      }
      if (arms.rounds >= APACHE_GUN_ROUNDS && arms.rockets >= APACHE_ROCKETS && arms.missiles >= 8 && arms.airMissiles >= 4) {
        arms.rearming = false;
        tell('REARMED · 30 MM ' + arms.rounds + ' · RKT ' + arms.rockets + ' · AT ' + arms.missiles + ' · AIR ' + arms.airMissiles, 2.5);
        tone(560, 0.06, 0.12, 'square', 760);
      }
    }
    /* A wrecked or missing Apache is replaced on its pad, out of sight. */
    function updateApacheRespawn() {
      if (gameTime < apacheRespawnAt) return;
      apacheRespawnAt = gameTime + 10;
      // An idle/wrecked airframe cannot keep another vehicle alive through its last lock.
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i];
        if (isApache(c) && (c !== player.car || c.hp <= 0) && c.arms?.lockTarget) apacheClearLock(c.arms);
      }
      if (apacheVehicle()) {
        apacheMissingSince = -1;
        return;
      }
      if (apacheMissingSince < 0) apacheMissingSince = gameTime;
      if (
        gameTime - apacheMissingSince < APACHE_RESPAWN_SECONDS ||
        distanceBetween(player, APACHE_PAD) < 1600 ||
        crowdInView(APACHE_PAD.x, APACHE_PAD.y, 200)
      )
        return;
      // Clear the pad of the old wreck first.
      for (let i = vehicles.length - 1; i >= 0; i--)
        if (vehicles[i] !== player.car && isApache(vehicles[i])) vehicles.splice(i, 1);
      parkApache();
      apacheMissingSince = -1;
    }
    /* The weapon chip while flying the Apache (after updateHud, game.js). */
    function apacheHud(c) {
      const arms = apacheArms(c), w = apacheWeapon(c), state = apacheWeaponStatus(c);
      getElement('weaponSlot').textContent = 'AH-64 · ' + keyName('fire') + ' FIRE · ' + keyName('cycleAircraftWeapon') + ' WEAPON';
      getElement('weaponName').textContent = w.name;
      getElement('ammo').textContent = String(arms[w.ammo]).padStart(w.capacity > 99 ? 3 : 2, '0');
      getElement('reserve').textContent = '/ ' + w.capacity + ' · ' + state;
      getElement('reloadHint').textContent = arms.rearming ? 'REARM' : w.lock ? arms.lockReady ? 'LOCK' : 'AIM' : keyName('rockets') + ' RKT';
      getElement('weaponButton').classList.toggle('reloading', arms.rearming);
      const art = getElement('weaponArt');
      if (art.dataset.tankIcon !== 'apache-' + w.id) {
        art.dataset.tankIcon = 'apache-' + w.id;
        if (w.id === 'cannon') drawShellIcon(art);
        else drawRocketIcon(art);
      }
    }
    function apacheWeaponStatus(c) {
      const arms = apacheArms(c), w = apacheWeapon(c);
      if (arms.rearming) return 'REARMING';
      if (arms[w.ammo] <= 0) return 'EMPTY';
      const ready = w.id === 'cannon' ? arms.gunReadyAt : w.id === 'rockets' ? arms.salvoReadyAt : arms[w.id + 'ReadyAt'];
      if (gameTime < ready) return 'WAIT ' + (ready - gameTime).toFixed(1) + ' s';
      if (w.lock) return arms.lockReady ? 'LOCK' : arms.lockTarget ? 'LOCKING ' + Math.round(clamp((gameTime - arms.lockSince) / w.lock, 0, 1) * 100) + '%' : 'SEEK TARGET';
      return 'READY';
    }
    /* A 70 mm rocket, nose forward, for the weapon chip. */
    function drawRocketIcon(targetCanvas) {
      const g = targetCanvas.getContext('2d');
      g.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      g.save();
      const scale = Math.min(targetCanvas.width / 150, targetCanvas.height / 50);
      g.translate(targetCanvas.width / 2, targetCanvas.height / 2);
      g.scale(scale, scale);
      g.strokeStyle = '#1b1712';
      g.lineWidth = 1.6;
      // Fins, motor tube, warhead with its ogive, and the band.
      g.fillStyle = '#3d4234';
      g.beginPath();
      g.moveTo(-66, -15);
      g.lineTo(-50, -7);
      g.lineTo(-50, 7);
      g.lineTo(-66, 15);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#8f927f';
      g.fillRect(-60, -7, 70, 14);
      g.strokeRect(-60, -7, 70, 14);
      g.fillStyle = '#56604b';
      g.beginPath();
      g.moveTo(10, -8);
      g.lineTo(38, -8);
      g.quadraticCurveTo(66, -5, 70, 0);
      g.quadraticCurveTo(66, 5, 38, 8);
      g.lineTo(10, 8);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#d6b23c';
      g.fillRect(16, -8, 4, 16);
      g.fillStyle = '#2a2d27';
      g.fillRect(-64, -4, 4, 8);
      g.restore();
    }
    /**
     * RETICLE: the tank's reticle (armor.js) serves the Apache too: a ring at the
     * ground point the gunner is aiming at, a pip where the chin gun is laid at
     * that range, green while it has rounds.
     */
    function updateApacheReticle(el, c) {
      el.classList.toggle('hidden', !city3D || gameMode !== 'play' || c.hp <= 0);
      if (!city3D || gameMode !== 'play' || c.hp <= 0) return;
      const arms = apacheArms(c), w = apacheWeapon(c),
        aim = w.lock && arms.lockTarget ? apacheTargetPoint(arms.lockTarget) : c.gunAim || apacheAimPoint(c),
        range = distanceBetween(c, aim),
        ring = city3D.project(aim.x, aim.y, aim.altitude),
        barrel = w.id === 'cannon' ? c.turretA ?? c.a : c.a,
        pip = w.lock && arms.lockTarget ? ring : city3D.project(c.x + Math.cos(barrel) * range, c.y + Math.sin(barrel) * range, aim.altitude),
        ringEl = getElement('tankAimRing'),
        pipEl = getElement('tankBarrelPip');
      ringEl.style.transform = 'translate(' + ring.x.toFixed(0) + 'px,' + ring.y.toFixed(0) + 'px)';
      pipEl.style.transform = 'translate(' + pip.x.toFixed(0) + 'px,' + pip.y.toFixed(0) + 'px)';
      pipEl.classList.toggle('ready', arms[w.ammo] > 0 && !arms.rearming && (!w.lock || arms.lockReady));
      pipEl.classList.toggle('mg', w.id === 'cannon');
    }
    /* DeadEndCity.apache(): where it is, its state, ammunition and a clearance check. */
    function apacheReport() {
      const c = vehicles.find((v) => isApache(v)) || null;
      if (!c) return { exists: false, pad: APACHE_PAD };
      const arms = apacheArms(c),
        spec = vehicleSpec(c),
        shape = vehicleShape(c),
        rotor = spec.rotorRadius || spec.l * 0.5,
        mastX = c.x + Math.cos(c.a) * (spec.rotorX || 0),
        mastY = c.y + Math.sin(c.a) * (spec.rotorX || 0);
      return {
        exists: true,
        id: c.id,
        name: spec.name,
        pad: { x: APACHE_PAD.x, y: APACHE_PAD.y },
        x: Math.round(c.x),
        y: Math.round(c.y),
        heading: Math.round((c.a * 180) / Math.PI),
        altitude: +worldMeters(aircraftClearance(c)).toFixed(1),
        hp: Math.round(c.hp),
        maxhp: c.maxhp,
        aboard: player.car === c,
        taken: !!c.apacheTaken,
        ai: !!c.ai || !!c.airUnit,
        onBasePad: apacheOnBasePad(c),
        arms: { weapon: apacheWeapon(c).id, rounds: arms.rounds, rockets: arms.rockets, missiles: arms.missiles, airMissiles: arms.airMissiles,
          rearming: arms.rearming, salvoLeft: arms.salvoLeft, status: apacheWeaponStatus(c),
          lock: { target: arms.lockTarget?.id ?? null, ready: arms.lockReady, since: arms.lockSince } },
        projectiles: bullets.filter((b) => b.apacheGuided || b.apacheRocket).map((b) => ({ kind: b.apacheGuided || 'rockets', life: +b.life.toFixed(2), target: b.apacheTarget?.id ?? null })),
        turret: Math.round((normalizeAngle((c.turretA ?? c.a) - c.a) * 180) / Math.PI),
        gunPitch: Math.round(((c.gunPitch || 0) * 180) / Math.PI),
        aim: c.gunAim ? { x: Math.round(c.gunAim.x), y: Math.round(c.gunAim.y), range: Math.round(c.gunAim.range) } : null,
        // Parked, its airframe and rotor disc must not touch the base's solids or
        // another vehicle.
        clearance: {
          solids: militaryWalls.filter((b) => boxContact(shape, { x: b.x + b.w / 2, y: b.y + b.h / 2, hx: b.w / 2, hy: b.h / 2, a: 0 })).length,
          rotorSolids: militaryWalls.filter((b) => Math.hypot(mastX - clamp(mastX, b.x, b.x + b.w), mastY - clamp(mastY, b.y, b.y + b.h)) < rotor).length,
          buildings: buildings.filter((b) => b.military && mastX + rotor > b.x && mastX - rotor < b.x + b.w && mastY + rotor > b.y && mastY - rotor < b.y + b.h).length,
          vehicles: vehicles
            .filter((v) => v !== c && Math.hypot(v.x - mastX, v.y - mastY) < rotor + Math.max(vehicleSpec(v).l, vehicleSpec(v).w) / 2 + (isAircraft(v) ? 20 : 0))
            .map((v) => v.type + ' ' + Math.round(Math.hypot(v.x - mastX, v.y - mastY))),
        },
      };
    }
    // END SUBSYSTEM: src/apache.js
