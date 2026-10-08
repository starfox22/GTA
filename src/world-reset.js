    // World reset: resetWorld(reason) puts the city back as it was at boot (vehicles, people, wrecks, damage, blood,
    // gore, fires, knocked furniture, shop glass, scorch) on WASTED, a mission pick, RESTART CURRENT JOB, a taken
    // job call and a new game; populateWorld() is the one population pass (boot and reset); worldResetReport().
    /**
     * WORLD RESET
     * The owner's rule: when the player dies or picks a new mission, everything in the world returns to normal.
     * The world is entities (game-populate.js populate, story.js populateStoryWorld, county-build.js
     * populateCounty: every vehicle, walker, gang member, crew and ship) plus the damage that outlives them
     * (knocked street props, the renderer's wall decals, blown shop and upper windows, rubble). A reset
     * rebuilds the entities from the boot seed (`worldPopulateSeed`), so parked cars, boats and the motor pool
     * stand where they stood at boot, then each subsystem clears its own leftovers through its own helper:
     *   clearCarStains (car-stains.js) for every old vehicle, resetWreckPass (livingcity-wrecks.js),
     *   restoreAllStreetProps (damage-upkeep.js), resetCrowdLife (crowd-space.js), clearBleeders (wounds.js),
     *   dealershipWorldReset (dealership-lot.js: display cars and the owned cars back in their bays),
     *   clearPolice / resetOfficerCrews (citylife-police.js: stars, units, witnesses, roadblocks).
     * The renderer only reads `worldResetSerial`: damage3d-world.js clears its decals, panes and debris when the
     * serial changes (renderers never change game rules).
     * KEPT (progress, never part of the world): cash, weapons and ammo, armour, the story and contract pointers,
     * campaign stats, bets, the owned dealership cars (brought back repaired), settings, the clock and weather,
     * the drawbridge timetables, the transit timetable's clock.
     * The callers move the player first (teleportPlayer, which also leaves any vehicle), then reset: the view
     * cuts there, and #worldResetFade fades the new scene in so nothing pops on screen.
     */
    let worldPopulateSeed = null,
      // Bumped by every reset; renderers clear their cosmetic damage when it changes.
      worldResetSerial = 0;
    const worldResetLog = { count: 0, last: null, byReason: {} };
    /* Every entity the world starts with. The first call (boot) records the seed; later calls replay it and then
       hand the running stream back, so the rest of the game's randomness carries on as before. */
    function populateWorld() {
      const running = randomSeed,
        again = worldPopulateSeed !== null;
      if (again) randomSeed = worldPopulateSeed;
      else worldPopulateSeed = randomSeed;
      populate();
      populateStoryWorld();
      populateCounty();
      if (again) randomSeed = running;
    }
    /* Counts of everything a reset puts back (worldResetReport, tools/tests/world-reset.mjs). */
    function worldDamageCounts() {
      let wrecks = 0,
        abandoned = 0,
        damaged = 0,
        burning = 0,
        stains = 0,
        dead = 0,
        panes = 0;
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i];
        if (c.hp <= 0) wrecks++;
        else if (wreckKind(c) === 2) abandoned++;
        if (c.hp > 0 && (c.hp < c.maxhp || (c.dents && c.dents.length))) damaged++;
        if (c.damage && c.damage.burning) burning++;
        if (c.stains) stains += c.stains.length;
      }
      for (let i = 0; i < pedestrians.length; i++) if (pedestrians[i].hp <= 0) dead++;
      for (let i = 0; i < officers.length; i++) if (officers[i].hp <= 0) dead++;
      for (let i = 0; i < gangMembers.length; i++) if (gangMembers[i].hp <= 0) dead++;
      for (let i = 0; i < buildings.length; i++) {
        const list = buildings[i].shopPanes;
        if (list) for (let k = 0; k < list.length; k++) if (list[k].state) panes++;
      }
      const drawn = city3D && city3D.damageInfo ? city3D.damageInfo() : null;
      return {
        vehicles: vehicles.length,
        wrecks,
        abandoned,
        damaged,
        burning,
        stainedCars: carStained.size,
        carStains: stains,
        knockedProps: knockedProps.length,
        bloodPools: bloodPools.length,
        bleeders: bleeders.length,
        severedParts: severedParts.length,
        goreStumps: goreStumps.length,
        bodies: dead,
        fires: fires.length,
        scorch: debris.length,
        skids: skids.length,
        incidents: crowd.incidents.length,
        wanted: wantedStars,
        shopPanesBroken: panes,
        // The renderer's side (null without the 3D view): wall decals, rubble, blown upper windows.
        worldDecals: drawn ? drawn.worldDecals : null,
        rubble: drawn ? drawn.chunks + drawn.panels : null,
        windowsBroken: drawn ? drawn.windowsBroken : null,
      };
    }
    /* The fade the new scene comes in under (#worldResetFade, base.css): black at once, then clear. */
    function worldResetFade() {
      const el = typeof document !== 'undefined' ? getElement('worldResetFade') : null;
      if (!el) return;
      el.classList.remove('run');
      void getComputedStyle(el).animationName; // restarts the animation
      el.classList.add('run');
    }
    /* `reason`: 'wasted', 'mission' (a pick in the mission picker), 'retry', 'job' (a job call taken), 'new-game'.
       `onlyIfStale`: skip when no game time has passed since the last reset (a pick then its call, back to back). */
    function resetWorld(reason, onlyIfStale = false) {
      if (onlyIfStale && worldResetLog.last && worldResetLog.last.gameTime === gameTime) return false;
      const started = performance.now(),
        before = worldDamageCounts();
      // Callers step the player out first (teleportPlayer); a car still held would be dropped from the world.
      if (player.car) player.car = null;
      clearPolice();
      resetOfficerCrews();
      for (let i = 0; i < vehicles.length; i++) clearCarStains(vehicles[i]);
      resetWreckPass();
      bullets.length = 0;
      clearBleeders();
      resetCrowdLife();
      populateWorld();
      restoreAllStreetProps();
      dealershipWorldReset();
      worldResetSerial++;
      worldResetFade();
      const after = worldDamageCounts();
      worldResetLog.count++;
      worldResetLog.byReason[reason] = (worldResetLog.byReason[reason] || 0) + 1;
      worldResetLog.last = { reason, gameTime, serial: worldResetSerial, ms: +(performance.now() - started).toFixed(1), before, after };
      return true;
    }
    // Console worldResetReport(): how many resets (by reason), the last one's counts before and after, and now.
    function worldResetReportRun() {
      return { count: worldResetLog.count, byReason: { ...worldResetLog.byReason }, serial: worldResetSerial, last: worldResetLog.last, now: worldDamageCounts() };
    }
