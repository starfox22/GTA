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
     * top of the scale, so the wanted level climbs star by star to the military
     * response (five stars) at the normal pace (heat.js ESCALATE_SECONDS). No
     * snipers come (swat.js SNIPERS_ENABLED).
     *
     * WEAPONS (player only):
     *   - the M230-style 30 mm chin gun (`fire`, F / left click): the turret turns
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
     *   - Ammunition is limited (APACHE_GUN_ROUNDS, APACHE_ROCKETS). Landed on one
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
        // About 15 m of fuselage with the tail wheel, 5.2 m of stub wing.
        l: 118,
        w: 42,
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
          rounds: APACHE_GUN_ROUNDS,
          rockets: APACHE_ROCKETS,
          gunReadyAt: 0,
          salvoLeft: 0,
          nextRocketAt: 0,
          salvoReadyAt: 0,
          pod: 1,
          rearming: false,
          rearmRockets: 0,
          rearmRounds: 0,
        };
      return c.arms;
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
      apacheArms(c);
      if (!c.apacheTaken) {
        c.apacheTaken = true;
        militaryAlarm();
        // Theft of an armed military aircraft: the heat goes to the top of the
        // scale (the five-star floor plus room for the climb, heat.js), and the
        // stars rise to the military response at the usual pace.
        const short = HEAT_MAX - wantedHeat;
        if (short > 0) crime(short / CRIME_HEAT);
        if (gameTime - lastDispatchLine > 3) dispatchCaption('MILITARY ATTACK HELICOPTER STOLEN · ARMY RESPONSE AUTHORISED', 'call-backup');
      }
      tell(
        'AH-64 APACHE · ' + keyName('ascend') + ' rise · ' + keyName('descend') + ' descend · ' + moveKeysName() + ' fly · the mouse aims the chin gun · ' +
          keyName('fire') + ' / click 30 MM GUN · ' + keyName('rockets') + ' / right click ROCKETS',
        8,
      );
    }
    /* Where the gunner wants the rounds: a ground point (map x, y and height). */
    function apacheAimPoint(c) {
      const ground = terrainHeight(c.x, c.y);
      let p = null;
      if (apacheAimOverride) p = { x: apacheAimOverride.x, y: apacheAimOverride.y };
      else if (mouse.active && touchAim === null && city3D) p = city3D.groundPoint(mouse.x, mouse.y, ground + 4);
      if (!p) {
        const a = touchAim ?? c.a;
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
      const drop = entityElevation(c) + 3 - aim.altitude;
      c.gunPitch = clamp(-Math.atan2(drop, aim.range), -1.05, 0.2);
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
      // Smoke from the motors of the rockets in flight (they fly high above the
      // ground, where the 2D particles are not drawn).
      if (city3D)
        for (const b of bullets)
          if (b.apacheRocket && seededRandom() < 0.9) city3D.smokePuff(b.x, b.y, b.altitude || 0, b.life > b.motorOut ? 1 : 0.5);
    }
    /* Fire: the chin gun (shoot(), game.js). Called every frame the trigger is held. */
    function apacheGun(c) {
      const arms = apacheArms(c);
      if (gameTime < arms.gunReadyAt) return false;
      if (arms.rounds <= 0) {
        if (gameTime - (arms.emptySaidAt ?? -100) > 3) {
          arms.emptySaidAt = gameTime;
          tell('30 MM · WINCHESTER · land on a Fort Sentinel helipad to rearm', 2.5);
          tone(100, 0.03, 0.06);
        }
        return false;
      }
      arms.gunReadyAt = gameTime + APACHE_GUN_INTERVAL;
      arms.rounds--;
      const aim = c.gunAim || apacheAimPoint(c),
        a = (c.turretA ?? c.a) + randomBetween(-0.012, 0.012),
        // The muzzle, under the nose.
        origin = {
          x: c.x + Math.cos(c.a) * 34 + Math.cos(a) * 9,
          y: c.y + Math.sin(c.a) * 34 + Math.sin(a) * 9,
          altitude: entityElevation(c) + 1,
        },
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
      particle(b.x, b.y, '#ffd08a', 3, 60, 3);
      for (const list of [pedestrians, enemies, gangMembers, officers])
        for (const p of list)
          if (p.hp > 0 && Math.abs(p.x - b.x) < 14 && Math.abs(p.y - b.y) < 14 && Math.abs(entityElevation(p) - altitude) < 20)
            strikePerson(p, 18, headingBetween(b, p), player, true, 'blast');
    }
    /* Rockets: start a salvo if the pods are ready. */
    function apacheSalvo(c) {
      const arms = apacheArms(c);
      if (arms.salvoLeft > 0 || gameTime < arms.salvoReadyAt) return false;
      if (arms.rockets <= 0) {
        if (gameTime - (arms.rocketsEmptyAt ?? -100) > 3) {
          arms.rocketsEmptyAt = gameTime;
          tell('ROCKETS · PODS EMPTY · land on a Fort Sentinel helipad to rearm', 2.5);
          tone(100, 0.03, 0.06);
        }
        return false;
      }
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
      // From the pod on the inner pylon of that wing.
      const side = c.a + Math.PI / 2,
        origin = {
          x: c.x + Math.cos(c.a) * 12 + Math.cos(side) * 13 * arms.pod,
          y: c.y + Math.sin(c.a) * 12 + Math.sin(side) * 13 * arms.pod,
          altitude: entityElevation(c) + 1,
        },
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
      playSample('explosion', 0.3, randomBetween(1.65, 1.8), c);
      noise(0.3, 0.16, 900);
      if (city3D) city3D.fire(origin.x, origin.y, a, true, origin.altitude - 9);
      shake = Math.max(shake, 3);
      player.lastShotAt = gameTime;
      notifyViolence(player, 'gunfire', player);
      crime(0.4);
      return true;
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
        full = arms.rounds >= APACHE_GUN_ROUNDS && arms.rockets >= APACHE_ROCKETS,
        rearming = !full && apacheOnBasePad(c);
      if (rearming && !arms.rearming) {
        tell('FORT SENTINEL PAD · REARMING · stay on the pad', 3);
        reloadSound();
      }
      if (!rearming && arms.rearming && full) tone(560, 0.06, 0.12, 'square', 760);
      arms.rearming = rearming;
      if (!rearming) return;
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
      if (arms.rounds >= APACHE_GUN_ROUNDS && arms.rockets >= APACHE_ROCKETS) {
        arms.rearming = false;
        tell('REARMED · 30 MM ' + arms.rounds + ' · ROCKETS ' + arms.rockets, 2.5);
        tone(560, 0.06, 0.12, 'square', 760);
      }
    }
    /* A wrecked or missing Apache is replaced on its pad, out of sight. */
    function updateApacheRespawn() {
      if (gameTime < apacheRespawnAt) return;
      apacheRespawnAt = gameTime + 10;
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
      const arms = apacheArms(c);
      getElement('weaponSlot').textContent = 'AH-64 · ' + keyName('fire') + ' GUN · ' + keyName('rockets') + ' ROCKETS';
      getElement('weaponName').textContent = '30 MM GUN · 70 MM ROCKETS';
      getElement('ammo').textContent = String(arms.rounds).padStart(3, '0');
      getElement('reserve').textContent = arms.rearming
        ? 'REARMING · RKT ' + arms.rockets
        : '/ RKT ' + String(arms.rockets).padStart(2, '0') + (gameTime < arms.salvoReadyAt && arms.rockets ? ' ··' : '');
      getElement('reloadHint').textContent = arms.rearming ? 'REARM' : keyName('fire');
      getElement('weaponButton').classList.toggle('reloading', arms.rearming);
      const art = getElement('weaponArt');
      if (art.dataset.tankIcon !== 'apache') {
        art.dataset.tankIcon = 'apache';
        drawRocketIcon(art);
      }
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
      const aim = c.gunAim || apacheAimPoint(c),
        ring = city3D.project(aim.x, aim.y, aim.altitude),
        barrel = c.turretA ?? c.a,
        pip = city3D.project(c.x + Math.cos(barrel) * aim.range, c.y + Math.sin(barrel) * aim.range, aim.altitude),
        ringEl = getElement('tankAimRing'),
        pipEl = getElement('tankBarrelPip');
      ringEl.style.transform = 'translate(' + ring.x.toFixed(0) + 'px,' + ring.y.toFixed(0) + 'px)';
      pipEl.style.transform = 'translate(' + pip.x.toFixed(0) + 'px,' + pip.y.toFixed(0) + 'px)';
      pipEl.classList.toggle('ready', apacheArms(c).rounds > 0);
      pipEl.classList.add('mg');
    }
    /* DeadEndCity.apache(): where it is, its state, ammunition and a clearance check. */
    function apacheReport() {
      const c = vehicles.find((v) => isApache(v)) || null;
      if (!c) return { exists: false, pad: APACHE_PAD };
      const arms = apacheArms(c),
        spec = vehicleSpec(c),
        shape = vehicleShape(c),
        rotor = 56;
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
        arms: { rounds: arms.rounds, rockets: arms.rockets, rearming: arms.rearming, salvoLeft: arms.salvoLeft },
        turret: Math.round((normalizeAngle((c.turretA ?? c.a) - c.a) * 180) / Math.PI),
        gunPitch: Math.round(((c.gunPitch || 0) * 180) / Math.PI),
        aim: c.gunAim ? { x: Math.round(c.gunAim.x), y: Math.round(c.gunAim.y), range: Math.round(c.gunAim.range) } : null,
        // Parked, its airframe and rotor disc must not touch the base's solids or
        // another vehicle.
        clearance: {
          solids: militaryWalls.filter((b) => boxContact(shape, { x: b.x + b.w / 2, y: b.y + b.h / 2, hx: b.w / 2, hy: b.h / 2, a: 0 })).length,
          buildings: buildings.filter((b) => b.military && c.x + rotor > b.x && c.x - rotor < b.x + b.w && c.y + rotor > b.y && c.y - rotor < b.y + b.h).length,
          vehicles: vehicles
            .filter((v) => v !== c && Math.hypot(v.x - c.x, v.y - c.y) < rotor + Math.max(vehicleSpec(v).l, vehicleSpec(v).w) / 2 + (isAircraft(v) ? 20 : 0))
            .map((v) => v.type + ' ' + Math.round(Math.hypot(v.x - c.x, v.y - c.y))),
        },
      };
    }
    // END SUBSYSTEM: src/apache.js
