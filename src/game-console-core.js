    // BEGIN SUBSYSTEM: src/game-console-core.js — DeadEndCity console, core: status, teleport, look, clock, zoom, simulate, heal, god, cash, walk (+ godPanelConsole)
    // Basics: version and scale, status, teleport/look, clock and zoom, stepping the
    // simulation (simulate, holdSimulation), the action key, health, god mode, cash, walking.
    addConsoleMethods('core', {
      version: GAME_VERSION,
      // The world scale (game.js WORLD SCALE): map units to the metre.
      unitsPerMetre: UNITS_PER_METRE,
      status: () => ({
        mode: gameMode,
        x: Math.round(player.x),
        y: Math.round(player.y),
        district: districtAt(player.x, player.y),
        hp: Math.ceil(player.hp),
        cash,
        wanted: Math.ceil(wantedStars),
        mission: mission ? missions[mission.index].title : null,
        completed,
        vehicle: player.car ? player.car.type : null,
        weapon: currentWeapon().name,
        clock: clockText(),
        renderer: city3D ? '3d' : '2d',
        vehicles: vehicles.length,
        pedestrians: pedestrians.length,
      }),
      teleport(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('teleport needs two finite numbers');
        teleportPlayer(x, y);
        return this.status();
      },
      setClock(hours) {
        worldMinutes = Math.floor(worldMinutes / 1440) * 1440 + clamp(hours, 0, 24) * 60;
        return clockText();
      },
      setZoom: (value) => setWorldZoom(value),
      // The interaction prompt as the player sees it (hud.js INTERACTION PROMPT):
      // visible, text, identity, docked, seconds since it popped in, this pass's offer.
      promptState: () => promptReport(),
      // Press the action key once, exactly as E would.
      interact() {
        interact();
        return this.missionState();
      },
      // Restore the player's health (and optionally armour) without god mode, so a
      // long test under fire can go on while every hit still lands and is logged.
      heal(armor = 0) {
        player.hp = 100;
        player.armor = clamp(armor, 0, 100) || player.armor;
        return { hp: player.hp, armor: player.armor };
      },
      god(on = true) {
        player.godMode = !!on;
        return player.godMode;
      },
      // Run the simulation forward without drawing, holding the given keys (for
      // example ['KeyW']), so physics tests do not depend on the headless frame
      // rate. Returns the vehicle telemetry at the end.
      simulate(seconds = 1, held = []) {
        for (const code of held) keys[code] = true;
        const steps = Math.round(clamp(seconds, 0, 120) * 30);
        for (let i = 0; i < steps; i++) {
          // A Blue Hour elevator ride runs on its own clock (frame()); step it too.
          if (gameMode === 'elevator') updateElevator(1 / 30);
          else if (gameMode === 'play') update(1 / 30);
          else break;
          hudClockOffset += 1 / 30; // HUD timers (prompt docking) follow the stepped time
        }
        for (const code of held) keys[code] = false;
        return this.ride();
      },
      // Place the camera/player at a map point without touching anything else.
      look(x, y, zoom) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('look needs two finite numbers');
        teleportPlayer(x, y);
        // The zoom is applied at once (headless frames are too slow to ease into it).
        if (zoom !== undefined) {
          setWorldZoom(zoom);
          worldZoom = worldZoomTarget;
        }
        return this.status();
      },
      // Set the cash in the player's pocket (fares, shops); returns it.
      setCash(dollars = 1000) {
        cash = clamp(Math.round(Number(dollars) || 0), 0, 99999999);
        return cash;
      },
      // Inspection only: zoom the camera in past the player's limit to look at
      // people up close. Anything above 1.5 is not reachable in play.
      closeUp(zoom = 4) {
        worldZoom = worldZoomTarget = clamp(zoom, 0.14, 24);
        return worldZoom;
      },
      // Walk the player on foot `distance` units toward `heading` (radians, 0 is
      // east) in small steps through the normal collision code. Headless frames
      // are far too slow to walk anywhere by holding a key.
      walk(heading, distance = 50) {
        for (let i = 0; i < Math.ceil(distance / 2); i++) {
          moveBody(player, Math.cos(heading) * 2, Math.sin(heading) * 2, 8);
          updateMarinaFooting();
        }
        player.a = heading;
        return { x: Math.round(player.x), y: Math.round(player.y), yacht: superyachtDeckState() };
      },
      // Stop the frame loop's simulation (it still draws) so a screenshot sequence
      // can be stepped with simulate(); false lets it run again.
      holdSimulation(on = true) {
        simulationHeld = !!on;
        return simulationHeld;
      },
    });
    // GOD PANEL: godPanel(), godTeleport(x, y), godRefill(), godLosePolice(), godFreeze(on), mapScreenPoint(x, y) (god-panel.js).
    addConsoleMethods('godPanel', godPanelConsole());
    // END SUBSYSTEM: src/game-console-core.js
