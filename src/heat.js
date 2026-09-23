    // BEGIN SUBSYSTEM: src/heat.js — Heat and wanted stars
    /**
     * Heat and wanted stars
     * Source: src/heat.js
     * Scope: shared game closure.
     * Every crime adds heat in proportion to how serious it is; the stars are read
     * off the heat. Killing counts by who died (a civilian, a patrol officer, a
     * tactical officer, a soldier), and a run of kills close together counts more
     * than the same kills spread over an afternoon. The HUD shows the stars, the
     * climb toward the next one and the body count of the current incident.
     *
     * `crime(amount)` is the one way a system reports the player: amounts are in
     * the historic "crime units" (a gunshot 0.075, a carjacking 0.8, trespassing
     * on Fort Sentinel 3); `recordKill` and `recordVehicleKill` report deaths.
     * Missions that raise `wantedStars` directly keep working: the heat is lifted
     * to that star's floor on the next update.
     */
    // Heat needed for each star. 1 star is any reported crime; the rest are
    // spaced so that two dead civilians make 2, a dead officer on top makes 3,
    // a shoot-out with a couple more officers makes 4, and a massacre (six or
    // so officers, or SWAT) makes 5.
    const HEAT_STARS = [0, 0.01, 12, 32, 72, 125],
      HEAT_MAX = 150,
      // One historic crime unit in heat points.
      CRIME_HEAT = 4,
      // Heat for a death the player caused, by who died.
      KILL_HEAT = {
        civilian: 6,
        gang: 2.5,
        hostile: 0,
        cop: 14,
        swat: 18,
        fed: 18,
        soldier: 14,
      },
      // Seconds a newly earned star flashes before dispatch raises it: a lot of
      // heat at once still climbs one star at a time, 14 s from one to five.
      ESCALATE_SECONDS = [0, 0, 1.5, 2.5, 4, 6];
    let wantedLevel = 0,
      starElapsed = 0,
      wantedHeat = 0,
      // Heat from crimes nobody has reported yet (a silent knife kill with no
      // police around); the next witness call or crime adds it.
      unreportedHeat = 0,
      escalateSeconds = 0,
      heatFlashUntil = 0,
      heatUIKey = '';
    // What the player has done since the police were last cleared.
    const rampage = {
      civilians: 0,
      police: 0,
      soldiers: 0,
      gang: 0,
      vehicles: 0,
      aircraft: 0,
      streak: 0,
      lastKillAt: -100,
      startedAt: 0,
    };
    function starsForHeat(heat) {
      let stars = 0;
      for (let n = 1; n < HEAT_STARS.length; n++) if (heat >= HEAT_STARS[n]) stars = n;
      return stars;
    }
    function resetHeat() {
      wantedHeat = 0;
      unreportedHeat = 0;
      wantedLevel = 0;
      starElapsed = 0;
      escalateSeconds = 0;
      rampage.civilians = rampage.police = rampage.soldiers = rampage.gang = 0;
      rampage.vehicles = rampage.aircraft = rampage.streak = 0;
      rampage.lastKillAt = -100;
    }
    /* Set the level outright (the developer console, mission scripts). */
    function setWantedLevel(stars) {
      const rising = stars > Math.ceil(wantedStars);
      wantedStars = stars;
      wantedLevel = stars;
      wantedHeat = Math.max(HEAT_STARS[stars] || 0, Math.min(wantedHeat, (HEAT_STARS[stars + 1] || HEAT_MAX) - 1));
      starElapsed = 0;
      escalateSeconds = 0;
      if (rising) announceWantedLevel(stars);
    }
    function addHeat(points) {
      if (points <= 0) return;
      wantedHeat = Math.min(HEAT_MAX, wantedHeat + points);
    }
    function updateStarProgress(deltaSeconds) {
      let visible = Math.ceil(wantedStars);
      // A mission (or the console) that set the stars directly: the heat follows.
      if (visible > 0 && wantedHeat < HEAT_STARS[visible]) wantedHeat = HEAT_STARS[visible];
      if (visible !== wantedLevel) {
        wantedLevel = visible;
        starElapsed = 0;
      }
      unreportedHeat = Math.max(0, unreportedHeat - deltaSeconds * 0.1);
      if (!visible) {
        escalateSeconds = 0;
        return;
      }
      starElapsed += deltaSeconds;
      // Out of sight the surplus above the current star cools off, so a runner who
      // broke contact is not bumped up a star the moment they are seen again.
      if (searchActive)
        wantedHeat = Math.max(HEAT_STARS[visible], wantedHeat - deltaSeconds * 1.5);
      const earned = starsForHeat(wantedHeat);
      if (earned > visible && visible < 5) {
        escalateSeconds += deltaSeconds;
        if (escalateSeconds >= ESCALATE_SECONDS[visible + 1]) {
          escalateSeconds = 0;
          wantedStars = visible + 1;
          wantedLevel = visible + 1;
          starElapsed = 0;
          heatFlashUntil = gameTime + 2.5;
          searchRemaining = Math.max(searchRemaining, policeSearchSeconds());
          announceWantedLevel(wantedLevel);
        }
      } else escalateSeconds = 0;
    }
    function crime(amount = 1) {
      if (harborPoliceProtected(player.x, player.y, 40)) return;
      addHeat(Math.max(0, amount) * CRIME_HEAT + unreportedHeat);
      unreportedHeat = 0;
      if (wantedStars <= 0) {
        wantedStars = 1;
        wantedLevel = 1;
        starElapsed = 0;
        rampage.startedAt = gameTime;
        heatFlashUntil = gameTime + 2.5;
        announceWantedLevel(1);
      }
      searchActive = false;
      searchRemaining = policeSearchSeconds();
      lastSeen = {
        x: player.x,
        y: player.y,
      };
    }
    function killCategory(victim) {
      if (victim.police) return victim.unit === 'swat' ? 'swat' : victim.unit === 'fed' ? 'fed' : 'cop';
      if (victim.military) return 'soldier';
      if (enemies.includes(victim)) return 'hostile';
      if (victim.faction) return 'gang';
      return 'civilian';
    }
    /* Somebody the player hit has died (strikePerson). */
    function recordKill(victim, kind = 'ballistic') {
      if (victim.killRecorded) return;
      victim.killRecorded = true;
      const category = killCategory(victim);
      if (category === 'civilian') rampage.civilians++;
      else if (category === 'gang') rampage.gang++;
      else if (category === 'soldier') rampage.soldiers++;
      else if (category !== 'hostile') rampage.police++;
      let heat = KILL_HEAT[category] || 0;
      if (!heat) return;
      // A spree: every kill within eight seconds of the last adds 15% (up to 60%).
      rampage.streak = gameTime - rampage.lastKillAt < 8 ? rampage.streak + 1 : 0;
      rampage.lastKillAt = gameTime;
      heat *= 1 + Math.min(0.6, rampage.streak * 0.15);
      const lawman = category === 'cop' || category === 'swat' || category === 'fed';
      if (lawman) {
        tell(category === 'cop' ? 'OFFICER DOWN' : category === 'swat' ? 'SWAT OFFICER DOWN' : 'AGENT DOWN', 1.6);
        policeRadioEvent('officer-down', victim);
      }
      // A quiet kill with nobody watching waits for a witness to call it in.
      if (wantedStars <= 0 && kind === 'melee' && !lawman && !policeCanSeePlayer()) {
        unreportedHeat = Math.min(HEAT_MAX, unreportedHeat + heat);
        return;
      }
      if (harborPoliceProtected(player.x, player.y, 40)) return;
      addHeat(heat);
      if (wantedStars <= 0) crime(0);
      else {
        // The police know where the shooting is.
        lastSeen = { x: player.x, y: player.y };
        if (searchActive && lawman) {
          searchActive = false;
          searchRemaining = policeSearchSeconds();
        }
      }
    }
    /* A vehicle the player damaged last has blown up (updateCars). */
    function recordVehicleKill(vehicle) {
      if (vehicle.killRecorded) return;
      vehicle.killRecorded = true;
      rampage.vehicles++;
      let heat;
      if (vehicle.airUnit) {
        rampage.aircraft++;
        heat = 26;
        tell('POLICE HELICOPTER DOWN', 2);
      } else if (vehicle.type === 'tank' || vehicle.military) heat = 30;
      else if (vehicle.lawUnit === 'swat') heat = 14;
      else if (vehicle.type === 'police' || vehicle.lawUnit) heat = 9;
      else heat = vehicle.ai || vehicle.occupied ? 3.5 : 1.5;
      addHeat(heat);
      if (wantedStars <= 0) crime(0);
    }
    /**
     * The HUD: filled stars, the next star flashing while dispatch escalates,
     * grey stars while the police are searching, a thin meter of the climb to
     * the next star and the body count of this incident.
     */
    function heatUI() {
      const stars = Math.ceil(wantedStars),
        earned = starsForHeat(wantedHeat),
        pending = stars > 0 && earned > stars ? stars + 1 : 0,
        flashing = gameTime < heatFlashUntil,
        key = stars + '|' + pending + '|' + searchActive + '|' + flashing;
      if (key !== heatUIKey) {
        heatUIKey = key;
        let html = '';
        for (let n = 1; n <= 5; n++)
          html +=
            n <= stars
              ? '<span class="star on' + (flashing && n === stars ? ' fresh' : '') + '">★</span>'
              : n === pending
                ? '<span class="star next">★</span>'
                : '<span class="star">☆</span>';
        const el = getElement('stars');
        el.innerHTML = html;
        el.classList.toggle('searching', stars > 0 && searchActive);
      }
      const meter = getElement('heatFill');
      if (meter) {
        const lo = HEAT_STARS[Math.min(5, stars)] || 0,
          hi = HEAT_STARS[Math.min(5, stars + 1)] || HEAT_MAX,
          share = stars >= 5 ? clamp((wantedHeat - lo) / (HEAT_MAX - lo), 0, 1) : clamp((wantedHeat - lo) / (hi - lo), 0, 1);
        meter.style.width = (stars ? share * 100 : 0).toFixed(1) + '%';
        meter.parentElement.classList.toggle('hidden', !stars);
      }
      const count = getElement('bodyCount');
      if (count) {
        const parts = [];
        if (rampage.civilians) parts.push(rampage.civilians + ' CIV');
        if (rampage.police) parts.push(rampage.police + ' COP');
        if (rampage.soldiers) parts.push(rampage.soldiers + ' MIL');
        if (rampage.vehicles) parts.push(rampage.vehicles + ' VEH');
        count.textContent = stars && parts.length ? '☠ ' + parts.join(' · ') : '';
      }
    }
    // END SUBSYSTEM: src/heat.js
