    /* Suppressive fire at the corner the runner ducked behind. */
    function officerSuppress(o, deltaSeconds) {
      if (!lastSeen || gameTime - (o.lastSawPlayerAt ?? -100) > 3.5 || !policeTier().deadly || policeHoldFire() || !shooterInView(o)) return false;
      if (distanceBetween(o, lastSeen) > officerKind(o).range * 1.2) return false;
      o.timer -= deltaSeconds * 0.5;
      if (o.timer > 0) return true;
      o.timer = randomBetween(1.2, 2);
      const a = headingBetween(o, lastSeen) + randomBetween(-0.08, 0.08),
        origin = { x: o.x + Math.cos(a) * 14, y: o.y + Math.sin(a) * 14, altitude: entityElevation(o) },
        kind = officerKind(o);
      bullets.push({
        ...origin,
        ...shotVelocity(origin, null, kind.speed, a),
        life: 0.6,
        dmg: kind.dmg,
        playerDmg: kind.playerDmg,
        enemy: true,
        faction: 'police',
        owner: o,
        target: player,
      });
      playSample(kind.sample, 0.24, 1, o);
      if (city3D) city3D.fire(o.x, o.y, a, false, entityElevation(o));
      return true;
    }
    /**
     * Where an officer engaging the player wants to stand (null: hold still).
     * A patrol officer whose cruiser is close uses it: crouched behind the far
     * corner while waiting, stepped out past the corner to fire while holding a
     * firing token, so they can be shot back exactly when they are shooting.
     * Everyone else waiting for a token works round the player's flank and
     * closes in; SWAT and agents with a token hold at rifle range off the flank.
     */
    function officerPosition(o, target, d, advancing = false) {
      if (target !== player || o.blockade) return null;
      // A SWAT team: the shield walks at the player, the stack keeps file (swat.js).
      const stack = swatLeadSpot(o, d) || swatStackSpot(o);
      if (stack) return stack;
      if (!o.flankSide) o.flankSide = seededRandom() < 0.5 ? -1 : 1;
      const car = o.car,
        free = (spot, margin) => !solid(spot.x, spot.y, 8) && distanceBetween(o, spot) > margin;
      if (
        !o.rifle &&
        car?.hp > 0 &&
        !car.stolen &&
        car !== player.car &&
        distanceBetween(o, car) < 110 &&
        distanceBetween(car, player) > 60
      ) {
        const away = headingBetween(player, car) + o.flankSide * (advancing ? 0.5 : 1.4),
          spot = { x: car.x + Math.cos(away) * 25, y: car.y + Math.sin(away) * 25 };
        return free(spot, 6) ? spot : null;
      }
      if (advancing) {
        const base = headingBetween(player, o) + o.flankSide * 0.35,
          r = clamp(d - 40, 90, 170),
          spot = { x: player.x + Math.cos(base) * r, y: player.y + Math.sin(base) * r };
        return free(spot, 12) ? spot : null;
      }
      if (o.rifle) {
        const base = headingBetween(player, o) + o.flankSide * 0.3,
          r = clamp(d, 130, 190),
          spot = { x: player.x + Math.cos(base) * r, y: player.y + Math.sin(base) * r };
        return free(spot, 14) ? spot : null;
      }
      return null;
    }

    /* Behind the officer's own car, on the side away from the player. */
    function officerCoverSpot(o) {
      const car = o.car;
      if (!car || car.hp <= 0 || car === player.car || distanceBetween(o, car) > 260) return null;
      const away = headingBetween(player, car),
        spot = { x: car.x + Math.cos(away) * 28, y: car.y + Math.sin(away) * 28 };
      return solid(spot.x, spot.y, 8) ? null : spot;
    }
    /**
     * A partner drags a downed officer behind their car: runs over, then walks
     * backwards to cover towing the wounded along the ground. Only a partner
     * without a firing token and within 220 units takes it on; returns true
     * while the drag owns this officer's turn.
     */
    function assignOfficerDrags() {
      for (const hurt of officers) {
        if (!hurt.downed || hurt.hp <= 0 || hurt.draggedBy || hurt.inCover || !hurt.car) continue;
        const partner = (hurt.car.crew || []).find(
          (o) =>
            o !== hurt &&
            o.hp > 0 &&
            !o.downed &&
            !o.dragging &&
            !o.fireToken &&
            !personIncapacitated(o) &&
            distanceBetween(o, hurt) < 220,
        );
        if (!partner || !officerCoverSpot(hurt)) continue;
        partner.dragging = hurt;
        hurt.draggedBy = partner;
        radio('call-backup', partner);
      }
    }
    function updateOfficerDrag(o, deltaSeconds) {
      const hurt = o.dragging,
        cover = hurt && officerCoverSpot(hurt);
      if (!hurt || hurt.hp <= 0 || !cover || wantedStars <= 0) {
        if (hurt) hurt.draggedBy = null;
        o.dragging = null;
        return false;
      }
      o.state = 'drag';
      if (distanceBetween(o, hurt) > 13) {
        footStepTowards(o, hurt, deltaSeconds, 18 * KMH);
        return true;
      }
      if (distanceBetween(o, cover) < 9) {
        hurt.inCover = true;
        hurt.draggedBy = null;
        o.dragging = null;
        return false;
      }
      footStepTowards(o, cover, deltaSeconds, 4 * KMH);
      // Walking backwards with the wounded in tow, facing the threat.
      o.a = headingBetween(o, player);
      const behind = headingBetween(cover, o) + Math.PI;
      const x = o.x - Math.cos(behind) * 12,
        y = o.y - Math.sin(behind) * 12;
      if (!solid(x, y, 6)) {
        hurt.x = x;
        hurt.y = y;
      }
      hurt.a = behind + Math.PI;
      hurt.walk = (hurt.walk || 0) + deltaSeconds * 4;
      return true;
    }
    /**
     * ARREST
     * An officer who reaches a player who is not fighting back cuffs them: the
     * bar fills over about two seconds while an officer is within arm's reach;
     * firing, striking, driving off or running clear breaks it.
     *
     * SURRENDER: from one to four stars, a player who stands still (on foot, or
     * in a stopped car on the ground) without firing for a moment is giving up.
     * Officers then hold their fire, walk up
     * and make the arrest, exactly as their "YOU ARE UNDER ARREST" calls promise.
     * At three and four stars they want two officers close before they cuff.
     * At five stars the response shoots on sight and only a player close to dead
     * is taken alive; the callouts there never promise an arrest.
     */
    const SURRENDER_SECONDS = 1.5;
    let policeMayArrest = false,
      surrenderAnchor = null,
      surrenderFor = 0;
    function arrestable() {
      const car = player.car,
        // A driver sitting still is pulled out of the car: at one or two stars
        // straight away, up to four once they have clearly given up.
        stopped = car && !isAircraft(car) && !isBoat(car) && Math.abs(car.speed || 0) < 10,
        caughtInCar = stopped && (wantedStars <= 2 || (wantedStars <= 4 && surrenderFor >= SURRENDER_SECONDS));
      return (
        gameMode === 'play' &&
        wantedStars > 0 &&
        !player.godMode &&
        (!car || caughtInCar) &&
        !player.parachute &&
        !player.swimming &&
        !player.coaster &&
        !player.deck &&
        !transitRide &&
        !taxiRide &&
        !playerOnRoof() &&
        player.hp > 0 &&
        !harborPoliceProtected(player.x, player.y, 30) &&
        // Shut in Vinny's sealed warehouse with no officer inside: nobody to
        // surrender to (chase.js depotSealed).
        !(depotSealed && !officers.some((o) => o.hp > 0 && !o.downed && !depotSeparates(o, player)))
      );
    }
    /* Standing (or sitting in a stopped car) still, not fighting: giving up. */
    function trackSurrender(deltaSeconds) {
      const fought = Math.min(gameTime - (player.lastShotAt ?? -100), gameTime - (player.lastStrikeAt ?? -100)) < 3,
        afloat = isAircraft(player.car) || (player.car && isBoat(player.car));
      if (!surrenderAnchor || distanceBetween(player, surrenderAnchor) > 6 || fought || afloat || wantedStars <= 0) {
        surrenderAnchor = { x: player.x, y: player.y };
        surrenderFor = 0;
        return;
      }
      surrenderFor += deltaSeconds;
    }
    function playerSurrendering() {
      return surrenderFor >= SURRENDER_SECONDS && Math.ceil(wantedStars) <= 4 && arrestable();
    }
    /* Police officers hold fire on a player giving up. */
    function policeHoldFire() {
      return policeMayArrest && playerSurrendering();
    }
    function updateArrest(deltaSeconds) {
      trackSurrender(deltaSeconds);
      const stars = Math.ceil(wantedStars),
        surrendering = playerSurrendering(),
        calm = gameTime - (player.lastShotAt ?? -100) > 2.5 && gameTime - (player.lastStrikeAt ?? -100) > 2.5;
      let cuffing = null,
        near = 0;
      if (arrestable() && calm)
        for (const o of officers) {
          if (o.hp <= 0 || o.downed || personIncapacitated(o) || o.state === 'return' || o.returned) continue;
          // Not through the walls of Vinny's sealed warehouse (chase.js).
          if (depotSeparates(o, player)) continue;
          const d = combatDistance(o, player);
          if (d < 90) near++;
          // Arm's reach, a little generous: a parked car or a kerb can keep an officer a step off.
          if (d < (player.car ? 50 : 42) && (!cuffing || d < combatDistance(cuffing, player))) cuffing = o;
        }
      // Who the police will take alive: anyone at one or two stars; at three and
      // four a player who gives up (or is badly hurt); at five only one close to dead.
      const tierAllows =
        stars <= 2 || (stars <= 4 && (surrendering || near >= 2 || player.hp < 35)) || (stars >= 5 && player.hp < 25);
      // Officers close by move in to cuff rather than shoot (updateOfficers).
      policeMayArrest = arrestable() && calm && tierAllows;
      // At three and four stars the cuffs go on once a second officer covers.
      const allowed = cuffing && policeMayArrest && (stars <= 2 || stars >= 5 || near >= 2 || player.hp < 35);
      if (allowed) {
        arrestProgress = Math.min(1, arrestProgress + deltaSeconds / 2);
        cuffing.state = 'arrest';
        cuffing.a = headingBetween(cuffing, player);
        if (arrestProgress > 0.05 && !cuffing.arrestSaid) {
          cuffing.arrestSaid = true;
          radio(randomChoice(['police-under-arrest', 'police-hands-on-head', 'police-get-down']), cuffing);
        }
        if (arrestProgress >= 1) bust();
      } else {
        arrestProgress = Math.max(0, arrestProgress - deltaSeconds * 1.5);
      }
      const el = getElement('arrestStatus');
      if (el) {
        const show = (arrestProgress > 0.02 || (surrendering && policeMayArrest)) && gameMode === 'play';
        el.classList.toggle('show', show);
        if (show) {
          const label = getElement('arrestLabel');
          if (label)
            label.textContent =
              arrestProgress > 0.02 ? 'BEING ARRESTED · FIGHT OR RUN' : 'SURRENDERING · STAY STILL';
          getElement('arrestFill').style.width = Math.round(arrestProgress * 100) + '%';
        }
      }
    }
    /* What officers shout as they get out: an arrest only when one can happen. */
    function policeChallengeLine() {
      if (Math.ceil(wantedStars) >= 5 && !policeMayArrest) return randomChoice(['police-drop-weapon', 'target-engaged']);
      return randomChoice(['police-hands-on-head', 'police-drop-weapon', 'police-get-down', 'police-challenge', 'police-under-arrest']);
    }
    function policeRespawnPoint() {
      const hq = HELIPADS.find((h) => /POLICE/.test(h.name)) || HELIPADS[0];
      for (let r = 60; r < 900; r += 30)
        for (let i = 0; i < 16; i++) {
          const x = hq.x + Math.cos((i * TAU) / 16) * r,
            y = hq.y + Math.sin((i * TAU) / 16) * r;
          if (groundAt(x, y, 12) && !solid(x, y, 10) && !vehicles.some((c) => pointInCar(x, y, c, 10)))
            return { x, y };
        }
      return PLACES.find((p) => p.kind === 'hospital').door;
    }
    function bust() {
      if (gameMode !== 'play') return;
      const stars = Math.ceil(wantedStars);
      gameMode = 'dead';
      pursuitStats.arrests++;
      arrestProgress = 0;
      document.body?.classList.add('wasted', 'busted');
      announce('YOU HAVE THE RIGHT TO REMAIN SILENT', 'BUSTED', 4.6);
      noise(0.2, 0.3, 500);
      const fine = 100 + stars * 150;
      setTimeout(() => {
        if (gameMode !== 'dead') return;
        document.body?.classList.remove('wasted', 'busted');
        cash = Math.max(0, cash - fine);
        // Confiscated: everything but the pistol, which keeps a couple of clips.
        let seized = 0;
        for (const [i, w] of weapons.entries()) {
          if (!w.owned || w.melee) continue;
          if (i === 0) w.reserve = Math.min(w.reserve, 24);
          else {
            seized += w.reserve;
            w.reserve = 0;
            w.ammo = Math.min(w.ammo, Math.ceil(w.clip / 3));
          }
        }
        player.hp = Math.max(player.hp, 60);
        player.armor = 0;
        player.inv = 3;
        const spot = policeRespawnPoint();
        if (player.car) {
          // Pulled from the car: it stays where it stopped.
          const car = player.car;
          car.vx = car.vy = car.speed = car.av = 0;
          player.car = null;
        }
        teleportPlayer(spot.x, spot.y);
        clearPolice();
        resetOfficerCrews();
        gameMode = 'play';
        const note = 'Released from Police HQ. Fine: $' + fine + (seized ? ' · ammunition confiscated' : '') + '.';
        if (mission) failMission(note);
        else tell(note, 5);
        save();
      }, 4200);
    }

    /**
     * ARMOR (5 stars)
     * The tank rolls with the pursuit, turret tracking the player. It needs a
     * clear line, holds fire while officers are close to the player, warns for
     * two and a half seconds before each round, and reloads slowly.
     */
    function updatePursuitArmor(deltaSeconds) {
      for (const c of vehicles) {
        if (c.lawUnit !== 'army' || c.hp <= 0 || c === player.car || c.stolen) continue;
        const d = distanceBetween(c, player),
          sees = wantedStars > 0 && d < 680 && d > 110 && sameFloor(c, player) && shooterInView(c) && clearSight(c, player),
          // Holds fire while its own people are inside the blast: officers on foot
          // or any police vehicle within reach of the shell.
          officersClose =
            officers.some((o) => o.hp > 0 && distanceBetween(o, player) < 140) ||
            vehicles.some(
              (v) => v !== c && v.hp > 0 && (v.cop || v.lawUnit) && !v.airUnit && distanceBetween(v, player) < 150,
            );
        const want = headingBetween(c, player);
        // A real traverse (armor.js), a little quicker than the player's: the crew is waiting for it.
        traverseTurret(c, want, deltaSeconds, 0.7, 1.4);
        if (!sees || officersClose) {
          c.lockTime = Math.max(0, (c.lockTime || 0) - deltaSeconds);
          continue;
        }
        c.lockTime = (c.lockTime || 0) + deltaSeconds;
        if (c.lockTime > 0.4 && gameTime - armorWarningAt > 6) {
          armorWarningAt = gameTime;
          tell('TANK TARGETING YOU · GET BEHIND COVER', 2.5);
          tone(300, 0.2, 0.18, 'sawtooth', 200);
        }
        if (c.lockTime > 2.5 && Math.abs(normalizeAngle(want - c.turretA)) < 0.08 && tankFire(c, true)) {
          c.lockTime = 0;
          c.cannonReadyAt = gameTime + 6.5;
          pursuitStats.tankShots++;
          const shell = bullets[bullets.length - 1];
          if (shell?.owner === c) {
            shell.faction = 'police';
            shell.blastPower = 1.1;
          }
        }
      }
    }

    /**
     * ARMY GUNNERS (5 stars): the jeeps' roof guns and the APC's turret gun track
     * the player at a real traverse rate and fire bursts of five when they have a
     * clear line within 480 units. Their rounds are police rounds, so they never
     * hit officers or police vehicles.
     */
    function updateArmyGunners(deltaSeconds) {
      for (const c of vehicles) {
        if (!c.armyUnit || !c.gunner || c.hp <= 0 || c === player.car || c.stolen || !c.cop) continue;
        const d = combatDistance(c, player),
          want = headingBetween(c, player);
        traverseTurret(c, want, deltaSeconds, c.type === 'apc' ? 0.9 : 1.6, 3);
        // Line of sight is looked up about eight times a second, like the other units.
        if (gameTime >= (c.gunnerLookAt || 0)) {
          c.gunnerLookAt = gameTime + 0.12 + seededRandom() * 0.05;
          c.gunnerSees = d < 480 && sameFloor(c, player) && clearSight(c, player);
        }
        const sees = wantedStars >= 5 && c.gunnerSees && !playerOnRoof() && !policeHoldFire() && shooterInView(c);
        if (!sees) {
          c.targetAcquired = 0;
          continue;
        }
        if (!c.targetAcquired) c.targetAcquired = gameTime + 1.2;
        if (gameTime < c.targetAcquired || gameTime < (c.gunReadyAt || 0) || Math.abs(normalizeAngle(want - c.turretA)) > 0.12)
          continue;
        c.burst = (c.burst || 0) + 1;
        c.gunReadyAt = gameTime + (c.burst % 5 ? 0.11 : 1.3);
        const speed = Math.hypot(player.car?.vx || 0, player.car?.vy || 0),
          chance = policeTier().accuracy * clamp(1.15 - d / 480, 0.4, 1) * clamp(1 - speed / 450, 0.4, 1);
        let a = c.turretA + randomBetween(-0.02, 0.02);
        if (seededRandom() > chance) a += (seededRandom() < 0.5 ? -1 : 1) * randomBetween(0.06, 0.14);
        const origin = { x: c.x + Math.cos(a) * 22, y: c.y + Math.sin(a) * 22, altitude: entityElevation(c) + 16 };
        bullets.push({
          ...origin,
          ...shotVelocity(origin, player, 760, a),
          life: 0.8,
          dmg: 16,
          playerDmg: 5,
          enemy: true,
          faction: 'police',
          owner: c,
          target: player,
        });
        playSample('automatic', 0.3, 0.82, c);
        if (city3D) city3D.fire(origin.x, origin.y, a, false, origin.altitude);
      }
    }
    /* Being hit: a jolt of the camera, a thud, and a red arc on the side the
       shot came from, so the player can tell where the fire is. */
    let damageArcTimer = null;
    function playerHitFeedback(b) {
      shake = Math.max(shake, 3);
      noise(0.05, 0.14, 180);
      const el = getElement('damageArc'),
        from = b.owner || { x: b.x - (b.vx || 0), y: b.y - (b.vy || 0) };
      if (!el) return;
      const a = headingBetween(player, from);
      el.style.transform = 'translate(-50%, -50%) rotate(' + ((a * 180) / Math.PI + 90).toFixed(1) + 'deg)';
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(damageArcTimer);
      damageArcTimer = setTimeout(() => el.classList.remove('show'), 700);
    }
    /* A hit on someone: no marker on screen (blood and the victim's reaction
       show it), only a faint tick, or a thump for a kill. */
    function playerHitConfirm(victim, killed) {
      if (killed) tone(150, 0.08, 0.13, 'triangle', 90);
      else tone(1700, 0.025, 0.04, 'square');
    }
    /**
     * MARINE UNITS
     * A runner who takes to the water at two stars or more is chased by police
     * launches (one at two stars, two at three, three from four) launched out of
     * sight on open water, and by a helicopter. A launch steers for where the
     * boat will be, feels ahead for the shore and backs off it, rams from three
     * stars, and its crew fires from the deck.
     */
    const MARINE_CAP = [0, 0, 1, 2, 3, 3];
    let marineTimer = 3;
    function playerAtSea() {
      return (!!player.car && isBoat(player.car)) || (!!player.swimming && !player.pool);
    }
    function spawnMarineUnit() {
      // Ahead of a boat under way (they come out of a marina in its path),
      // anywhere around a swimmer or a boat lying still.
      const boat = player.car && isBoat(player.car) ? player.car : null,
        speed = boat ? Math.hypot(boat.vx || 0, boat.vy || 0) : 0,
        course = speed > 60 ? Math.atan2(boat.vy, boat.vx) : null;
      for (let tries = 0; tries < 32; tries++) {
        const a = course !== null && tries < 20 ? course + randomBetween(-1, 1) : randomBetween(0, TAU),
          r = randomBetween(520, 980),
          x = player.x + Math.cos(a) * r,
          y = player.y + Math.sin(a) * r;
        if (crowdInView(x, y, 120)) continue;
        const heading = headingBetween({ x, y }, player);
        if (!boatFits({ type: 'speedboat', x, y, a: heading })) continue;
        if (vehicles.some((c) => Math.abs(c.x - x) < 80 && Math.abs(c.y - y) < 80)) continue;
        const c = makeCar('speedboat', x, y, heading, false, '#e4ebf0');
        Object.assign(c, {
          cop: true,
          ai: false,
          occupied: false,
          locked: false,
          pursuitUnit: true,
          dispatched: true,
          lawUnit: 'marine',
          marineUnit: true,
          crewSize: 0,
          shotTimer: 2,
        });
        c.maxhp = c.hp = Math.round(c.hp * 1.4);
        pursuitStats.marine++;
        if (gameTime - lastDispatchLine > 5) dispatchCaption('MARINE UNIT LAUNCHED · SUSPECT ON THE WATER', 'call-backup');
        return c;
      }
      return null;
    }
    function updateMarineUnits(deltaSeconds) {
      const stars = Math.ceil(wantedStars),
        atSea = playerAtSea(),
        cap = atSea ? MARINE_CAP[clamp(stars, 0, 5)] : 0;
      marineTimer -= deltaSeconds;
      if (cap && marineTimer <= 0) {
        marineTimer = 5;
        const live = vehicles.filter((c) => c.marineUnit && c.hp > 0).length;
        if (live < cap) spawnMarineUnit();
      }
      for (const c of vehicles) {
        if (!c.marineUnit || c.hp <= 0 || c === player.car || c.stolen) continue;
        c.shotTimer = (c.shotTimer || 0) - deltaSeconds;
        if (!c.seesPlayer || c.shotTimer > 0 || stars < 2 || !shooterInView(c)) continue;
        const d = combatDistance(c, player);
        if (d > 330) continue;
        c.shotTimer = randomBetween(1.1, 1.6);
        const speed = Math.hypot(player.car?.vx || 0, player.car?.vy || 0),
          chance = policeTier().accuracy * clamp(1.2 - d / 420, 0.4, 1) * clamp(1 - speed / 450, 0.4, 1);
        let a = headingBetween(c, player);
        if (seededRandom() > chance) a += (seededRandom() < 0.5 ? -1 : 1) * randomBetween(0.07, 0.15);
        const origin = { x: c.x + Math.cos(a) * 24, y: c.y + Math.sin(a) * 24, altitude: entityElevation(c) };
        bullets.push({
          ...origin,
          ...shotVelocity(origin, player, 700, a),
          life: 0.8,
          dmg: 18,
          playerDmg: 5.5,
          enemy: true,
          faction: 'police',
          owner: c,
          target: player,
        });
        pursuitStats.marineShots++;
        playSample('automatic', 0.26, 1, c);
        if (city3D) city3D.fire(origin.x, origin.y, a, false, origin.altitude);
      }
    }
    /* Throttle and helm for a police launch (boatControl, physics.js). */
    function marineBoatInput(c, along) {
      if (physicsClock < (c.helmAt || 0) && c.helm) return c.helm;
      c.helmAt = physicsClock + 0.1;
      const quarry = player.car && isBoat(player.car) ? player.car : player,
        d = distanceBetween(c, quarry),
        seen = c.seesPlayer || d < 260,
        base = seen ? quarry : lastSeen || quarry,
        t = clamp(d / 300, 0, 1.2),
        ram = Math.ceil(wantedStars) >= 3;
      let target = seen ? { x: base.x + (quarry.vx || 0) * t, y: base.y + (quarry.vy || 0) * t } : base;
      // Two stars: come alongside, 70 units off the beam, and let the deck crew
      // do the work. From three stars the launch rams.
      if (seen && !ram && d < 240) {
        const qa = Math.atan2(quarry.vy || 0, quarry.vx || 0) || quarry.a || 0,
          side = (c.x - quarry.x) * -Math.sin(qa) + (c.y - quarry.y) * Math.cos(qa) >= 0 ? 1 : -1;
        target = {
          x: quarry.x + (quarry.vx || 0) * 0.4 - Math.sin(qa) * side * 70,
          y: quarry.y + (quarry.vy || 0) * 0.4 + Math.cos(qa) * side * 70,
        };
      }
      let da = normalizeAngle(headingBetween(c, target) - c.a);
      // Feel ahead for the shore: turn toward whichever side is open water.
      const ahead = (angle, dist) => boatFits(c, c.x + Math.cos(c.a + angle) * dist, c.y + Math.sin(c.a + angle) * dist, c.a + angle);
      const reach = clamp(Math.abs(along) * 0.6, 40, 140);
      let slow = false;
      if (!ahead(0, reach)) {
        const left = ahead(-0.6, reach * 0.8),
          right = ahead(0.6, reach * 0.8);
        da = left && !right ? -1 : right && !left ? 1 : da > 0 ? 1 : -1;
        slow = true;
      }
      // Pinned against a quay: back off with the helm over.
      if (Math.abs(along) < 10 && d > 60) c.pinned = (c.pinned || 0) + 0.1;
      else c.pinned = 0;
      if (c.pinned > 1.5) c.reverseUntil = physicsClock + 1.2;
      const reversing = physicsClock < (c.reverseUntil || 0),
        quarrySpeed = Math.hypot(quarry.vx || 0, quarry.vy || 0),
        // Alongside at two stars: hold the runner's speed rather than overrun.
        overrun = !ram && seen && d < 240 && along > quarrySpeed + 25;
      c.helm = {
        up: !reversing && Math.abs(da) < 1.5 && !overrun && !(slow && Math.abs(along) > 120),
        down: reversing || (slow && Math.abs(along) > 120),
        turn: Math.abs(da) < 0.06 ? 0 : clamp(da * 2, -1, 1) * (reversing ? -1 : 1),
      };
      return c.helm;
    }
    /* The per-frame pursuit update (called from updateWanted). */
    function updatePursuit(deltaSeconds) {
      player.carStoppedFor =
        player.car && !isAircraft(player.car) && Math.abs(player.car.speed || 0) < 18
          ? (player.carStoppedFor || 0) + deltaSeconds
          : 0;
      recyclePursuitUnits(deltaSeconds);
      updatePursuitArmor(deltaSeconds);
      updateArmyGunners(deltaSeconds);
      updateRoofSnipers(deltaSeconds);
      updateMarineUnits(deltaSeconds);
      updateArrest(deltaSeconds);
    }
    function policeSearchRadius(stars = wantedStars) {
      return 300 + Math.ceil(clamp(stars, 0, 5)) * 120;
    }
    function pursuitSearchSeconds(stars) {
      return PURSUIT_SEARCH_SECONDS[clamp(Math.ceil(stars), 0, 5)];
    }

    /* The radar: while the police search, the area they are combing and the way
       each unit is looking. */
    function drawPoliceSearch(drawingContext, scale) {
      if (wantedStars <= 0 || !lastSeen) return;
      const r = policeSearchRadius();
      drawingContext.save();
      if (searchActive) {
        const pulse = 0.5 + 0.5 * Math.sin(gameTime * 4);
        drawingContext.fillStyle = 'rgba(236, 196, 96, ' + (0.1 + pulse * 0.08).toFixed(3) + ')';
        drawingContext.strokeStyle = 'rgba(240, 206, 120, 0.75)';
        drawingContext.lineWidth = 3 / scale;
        drawingContext.beginPath();
        drawingContext.arc(lastSeen.x, lastSeen.y, r, 0, TAU);
        drawingContext.fill();
        drawingContext.setLineDash([12 / scale, 9 / scale]);
        drawingContext.stroke();
        drawingContext.setLineDash([]);
        // Sight cones: what each searching unit can see.
        drawingContext.fillStyle = 'rgba(255, 110, 100, 0.16)';
        for (const { unit: u, kind } of policeMapUnits()) {
          if (kind === 'air') continue;
          const reach = kind === 'foot' ? 440 : 440;
          if (Math.abs(u.x - player.x) > 1600 || Math.abs(u.y - player.y) > 1600) continue;
          const a = kind === 'foot' ? u.a || 0 : Math.atan2(u.vy || 0, u.vx || 0) || u.a || 0;
          drawingContext.beginPath();
          drawingContext.moveTo(u.x, u.y);
          drawingContext.arc(u.x, u.y, reach * 0.55, a - 0.6, a + 0.6);
          drawingContext.closePath();
          drawingContext.fill();
        }
      }
      drawingContext.restore();
    }

    /* DeadEndCity.policeReport(): the whole response as data. */
    function policeReportData() {
      const round = (v) => Math.round(v);
      const units = vehicles
        .filter((c) => (c.cop || c.lawUnit || c.airUnit) && c !== player.car)
        .map((c) => ({
          id: c.id,
          kind: c.airUnit ? 'air' : pursuitUnitKind(c) || c.type,
          hp: round(c.hp),
          d: round(distanceBetween(c, player)),
          x: round(c.x),
          y: round(c.y),
          speed: round(c.speed || 0),
          mode: c.airUnit ? c.airState : c.blockade ? 'roadblock' : c.crewDeployed ? 'deployed' : c.pursuitPlan?.mode || 'route',
          sees: !!c.seesPlayer,
          reversals: c.reversals || 0,
          crew: (c.crew || []).filter((o) => o.hp > 0).length,
        }));
      const foot = officers.map((o) => ({
        unit: o.unit || 'patrol',
        hp: round(o.hp),
        vest: round(o.vest || 0),
        d: round(distanceBetween(o, player)),
        state: o.state,
        sees: !!o.seesPlayer,
      }));
      return {
        stars: Math.ceil(wantedStars),
        heat: Math.round(wantedHeat * 10) / 10,
        nextStarAt: HEAT_STARS[Math.min(5, Math.ceil(wantedStars) + 1)] ?? null,
        unreported: Math.round(unreportedHeat * 10) / 10,
        crimes: crimeLog.slice(),
        rampage: { ...rampage },
        search: { active: searchActive, remaining: Math.round(searchRemaining * 10) / 10, lastSeen: lastSeen ? { x: round(lastSeen.x), y: round(lastSeen.y) } : null },
        seen: wantedStars > 0 && policeCanSeePlayer(),
        arrest: Math.round(arrestProgress * 100) / 100,
        // Surrender (standing still) and whether officers may cuff rather than shoot.
        surrender: { seconds: Math.round(surrenderFor * 10) / 10, surrendering: playerSurrendering(), mayArrest: policeMayArrest, holdFire: policeHoldFire() },
        pursuit: { ...pursuitStats },
        swat: { ...swatStats },
        // Sniper rounds at the player (rooftop and helicopter) and how many struck.
        sniperFire: { ...sniperFireStats },
        wounds: woundReport(),
        marine: vehicles
          .filter((c) => c.marineUnit)
          .map((c) => ({ hp: Math.round(c.hp), d: Math.round(distanceBetween(c, player)), speed: Math.round(Math.hypot(c.vx || 0, c.vy || 0)), sees: !!c.seesPlayer })),
        tier: wantedStars > 0 ? policeTier() : null,
        counts: {
          patrol: units.filter((u) => u.kind === 'patrol' && u.hp > 0).length,
          swat: units.filter((u) => u.kind === 'swat' && u.hp > 0).length,
          fed: units.filter((u) => u.kind === 'fed' && u.hp > 0).length,
          army: units.filter((u) => u.kind === 'army' && u.hp > 0).length,
          armyJeep: units.filter((u) => u.kind === 'armyJeep' && u.hp > 0).length,
          armyApc: units.filter((u) => u.kind === 'armyApc' && u.hp > 0).length,
          armyTruck: units.filter((u) => u.kind === 'armyTruck' && u.hp > 0).length,
          soldiers: foot.filter((o) => o.unit === 'soldier' && o.hp > 0).length,
          snipers: foot.filter((o) => o.unit === 'sniper' && o.hp > 0).length,
          shields: officers.filter((o) => o.shield && o.hp > 0).length,
          air: units.filter((u) => u.kind === 'air' && u.hp > 0 && u.mode !== 'retreating').length,
          officers: foot.filter((o) => o.hp > 0).length,
          roadblocks: roadblocks.length,
        },
        units,
        foot,
        playerHp: Math.ceil(player.hp),
        mode: gameMode,
      };
    }
