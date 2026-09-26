    // SIMULATION UPDATE: only active play advances gameplay clocks and state.
    function update(deltaSeconds) {
      const active = gameMode === 'play';
      gameTime += deltaSeconds;
      // A skipped ride's fade (ride-skip.js): runs on this step's time, so a
      // pause holds it; death or the title menu cancels it.
      updateRideSkip(deltaSeconds);
      if (toastTime > 0) {
        toastTime -= deltaSeconds;
        if (toastTime <= 0) getElement('toast').classList.remove('show');
      }
      if (active) timed('knockdowns', () => updateKnockdowns(deltaSeconds));
      if (active || gameMode === 'menu') timed('cars', () => updateCars(deltaSeconds, active));
      // A shark's breach plays out while WASTED is on screen (sealife.js).
      if (gameMode === 'dead') updateSeaLife(deltaSeconds);
      if (active) {
        // Play time, cash earned, wanted peak; the demo card's timer (campaign.js).
        trackCampaignStats(deltaSeconds);
        player.inv = Math.max(0, player.inv - deltaSeconds);
        shotCooldownSeconds = Math.max(0, shotCooldownSeconds - deltaSeconds);
        if (reloadSecondsRemaining > 0) {
          reloadSecondsRemaining -= deltaSeconds;
          if (reloadSecondsRemaining <= 0) {
            let w = currentWeapon(),
              n = Math.min(w.clip - w.ammo, w.reserve);
            w.ammo += n;
            w.reserve -= n;
            reloadSecondsRemaining = 0;
            tone(230, 0.035, 0.06);
          }
        }
        timed('transit', () => updateTransit(deltaSeconds));
        // The Meridian Star under way (marina.js), before the player walks her deck.
        timed('liner', () => sailLiner(deltaSeconds));
        // The Palm Sound drawbridge: timetable, gates, leaves and the tall ship (drawbridge.js).
        timed('drawbridge', () => updateDrawbridge(deltaSeconds));
        timed('taxi', () => updateTaxiRide(deltaSeconds));
        updateCycling(deltaSeconds);
        // The on-foot figure in the speed box (hud.js SPEED BOX).
        trackPlayerPace(deltaSeconds);
        updateWeather(deltaSeconds);
        updateSwimming(deltaSeconds);
        updateMarinaFooting();
        updateSinking(deltaSeconds);
        timed('beach', () => updateBeach(deltaSeconds));
        timed('beachclub', () => updateBeachClub(deltaSeconds));
        timed('leisure', () => updateLeisure(deltaSeconds));
        timed('coaster', () => updateCoaster(deltaSeconds));
        timed('monarch', () => updateMonarchIsle(deltaSeconds));
        // MONARCH MOTORS: display, sale, delivery, owned cars, alarm (dealership.js).
        timed('dealership', () => updateDealership(deltaSeconds));
        timed('wildlife', () => updateWildlife(deltaSeconds));
        // Dolphins, gulls and the shark (sealife.js); after the coaster, which
        // resets player.hidden that a shark attack sets.
        timed('sealife', () => updateSeaLife(deltaSeconds));
        timed('sports', () => updateSports(deltaSeconds));
        if (player.parachute) updateParachute(deltaSeconds);
        else if (
          !player.car &&
          !transitRide &&
          !taxiRide &&
          !player.coaster &&
          // Thrown off a bike: flying, sliding or lying there (riders.js).
          !updateThrownPlayer(deltaSeconds) &&
          !updateMountainFooting(deltaSeconds)
        ) {
          const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
            y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
          if (x || y) {
            player.a = Math.atan2(y, x);
            // On foot the player runs; holding the walk action (Shift) walks.
            let s = player.swimming ? swimSpeed() : footPace();
            if (player.wading) s *= wadeFactor();
            player.walk += deltaSeconds * strideRate(s);
            moveBody(
              player,
              (x / Math.hypot(x, y)) * s * deltaSeconds,
              (y / Math.hypot(x, y)) * s * deltaSeconds,
              8,
            );
          }
        }
        if (
          !player.car &&
          !player.roof &&
          !player.buildingRoof &&
          !player.deck &&
          !player.parachute &&
          !player.swimming &&
          !player.wading &&
          !player.climbing &&
          !player.pool &&
          !((player.jumpUntil || 0) > gameTime) &&
          !transitRide &&
          !taxiRide &&
          !player.coaster
        )
          player.altitude = terrainHeight(player.x, player.y);
        // On the volleyball court a click hits the ball instead (beachvolley.js);
        // nothing is fired while thrown off a bike (riders.js).
        if (!volleyTakesFire() && !player.thrown && (keys.KeyF || (!player.car && keys.Space) || mouse.down)) shoot();
        if (keys.KeyH && player.car && Math.floor(gameTime * 6) % 3 === 0)
          tone(220, 0.08, 0.04, 'sawtooth');
        if (keys.KeyE && canSilentHit(rooftopJob())) {
          rooftopMissionInteract();
          keys.KeyE = false;
        }
        timed('people', () => updatePeople(deltaSeconds));
        timed('bullets', () => updateBullets(deltaSeconds));
        timed('damage', () => updateDamage(deltaSeconds));
        if (gameMode !== 'play') return;
        for (const p of pickups)
          if (
            !transitRide &&
            !player.parachute &&
            !playerOnRoof() &&
            (player.car?.altitude || 0) < 2 &&
            gameTime > p.ready &&
            distanceBetween(player, p) < 27
          ) {
            if (p.type === 'health') {
              if (player.hp >= 100) continue;
              player.hp = 100;
              tell('Health restored');
            }
            if (p.type === 'ammo') {
              for (const w of weapons) {
                if (!w.owned) continue;
                w.ammo = w.clip;
                w.reserve = Math.max(w.reserve, w.clip * 8);
              }
              tell('Ammo restocked · all weapons');
            }
            if (p.type === 'armor') {
              player.armor = 100;
              tell('Body armor acquired');
            }
            p.ready = gameTime + 70;
            tone(840, 0.15, 0.15, 'triangle');
            particle(p.x, p.y, '#d5efa8', 9, 70);
          }
        timed('garage', () => updateGarage(deltaSeconds));
        timed('civic', () => updateCivic(deltaSeconds));
        timed('roofencounter', () => updateRoofEncounter(deltaSeconds));
        timed('military', () => updateMilitary(deltaSeconds));
        // The 4x4 club, body mud and the hill climb (offroad.js).
        timed('offroad', () => updateOffroad(deltaSeconds));
        updatePlayerArmor(deltaSeconds);
        updatePlayerApache(deltaSeconds);
        timed('combat', () => updateCombat(deltaSeconds));
        timed('mission', () => missionUpdate(deltaSeconds));
        timed('waypoint', () => {
          updateWaypoint(deltaSeconds);
          updateGpsRoute(deltaSeconds);
        });
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= deltaSeconds;
        p.x += p.vx * deltaSeconds;
        p.y += p.vy * deltaSeconds;
        const drag = Math.exp(-2.5 * deltaSeconds);
        p.vx *= drag;
        p.vy *= drag;
        if (p.flame) {
          p.z += p.vz * deltaSeconds;
        }
        if (p.blood) {
          p.vz -= 160 * deltaSeconds;
          p.z += p.vz * deltaSeconds;
          if (p.z <= (p.surface ?? bloodSurface(p.x, p.y)) + 0.3) {
            addBloodPool(p.x, p.y, p.size * 0.8, Math.atan2(p.vy, p.vx), {
              opacity: 0.83,
              surface: p.surface ?? bloodSurface(p.x, p.y),
            });
            p.life = 0;
          }
        }
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = skids.length - 1; i >= 0; i--) {
        skids[i].life -= deltaSeconds;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
      if (skids.length > 1100) skids.splice(0, skids.length - 1100);
      for (let i = debris.length - 1; i >= 0; i--) {
        debris[i].life -= deltaSeconds;
        if (debris[i].life <= 0) debris.splice(i, 1);
      }
      shake *= Math.pow(0.008, deltaSeconds);
      flash = Math.max(0, flash - deltaSeconds);
      // Look ahead of a moving vehicle: about 0.45 s of travel, up to 300 units
      // (scaled by Settings · Driving · Camera look-ahead, driving.js).
      const look = player.car ? clamp(player.car.speed * 0.45, -80, 300) * drivingLookAhead() : 0,
        // A coaster outruns the usual trailing camera; stay with the train.
        follow = Math.min(1, deltaSeconds * (player.coaster ? 10 : 4.5));
      if (player.car?.type === 'plane') {
        const lead = 1 - Math.exp(-deltaSeconds * 1.4);
        planeCameraLead.x += ((player.car.vx || 0) * 0.42 - planeCameraLead.x) * lead;
        planeCameraLead.y += ((player.car.vy || 0) * 0.42 - planeCameraLead.y) * lead;
        const hold = Math.min(1, deltaSeconds * 7);
        cameraTarget.x += (player.x + planeCameraLead.x - cameraTarget.x) * hold;
        cameraTarget.y += (player.y + planeCameraLead.y - cameraTarget.y) * hold;
      } else {
        planeCameraLead.x = Math.cos(player.a) * look;
        planeCameraLead.y = Math.sin(player.a) * look;
        // A garage's drive-in show frames the bay (garages.js garageCameraFrame).
        const frame = garageCameraFrame();
        cameraTarget.x += ((frame ? frame.x : player.x + Math.cos(player.a) * look) - cameraTarget.x) * follow;
        cameraTarget.y += ((frame ? frame.y : player.y + Math.sin(player.a) * look) - cameraTarget.y) * follow;
      }
      timed('sound', () => {
        soundUpdate(deltaSeconds);
        updateAmbience(deltaSeconds);
      });
      // The flight instruments move every frame (hud.js, FLIGHT HUD).
      timed('flighthud', updateFlightHud);
      uiTime += deltaSeconds;
      if (uiTime > 0.09) {
        uiTime = 0;
        timed('ui', updateUI);
      }
    }
