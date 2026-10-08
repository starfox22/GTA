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
      // The light follows at once (screenshots and tours); `blend` true eases it over as a time skip in play does.
      setClock(hours, blend = false) {
        worldMinutes = Math.floor(worldMinutes / 1440) * 1440 + clamp(hours, 0, 24) * 60;
        if (!blend) snapSunClock();
        return clockText();
      },
      setZoom: (value) => setWorldZoom(value),
      // The street camera's framing: zoom in force, the player's zoom, the vehicle
      // context and speed shares, the metres of street on screen, a person's height in px.
      cameraView: () => cameraViewReport(),
      // The camera's lead, offset from the player, kick and shake (camera-feel.js).
      cameraFeel: () => cameraFeelReport(),
      // How the street camera moved over the last `seconds` (0.5-4): acceleration, jerk, zoom rate,
      // jolt and the player's drift on screen, in screen heights (camera-comfort.js).
      cameraComfort: (seconds = 4) => cameraComfortReport(seconds),
      // The view: 'street' (overhead) or 'chase' (behind the player); no argument reports it (chase-camera.js).
      viewMode(mode) {
        if (mode !== undefined) {
          if (mode !== 'street' && mode !== 'chase') throw Error("viewMode takes 'street' or 'chase'");
          setViewMode(mode, true);
        }
        return this.chaseCamera();
      },
      // Where the chase camera stands and looks, its boom and lens, the reticle's aim, and what the
      // renderer draws (chase-view3d.js: draw distance, culling reach, haze).
      chaseCamera: () => ({ ...chaseCameraReport(), view: city3D?.chaseView ? city3D.chaseView() : null }),
      // Turn the chase camera as the mouse would by (dx, dy) pixels, or set its heading and pitch in degrees.
      chaseLook(dx = 0, dy = 0, headingDeg, pitchDeg) {
        if (!chaseCameraLive()) throw Error("the chase view is off: viewMode('chase') first");
        if (Number.isFinite(headingDeg)) {
          chaseCam.idle = 0;
          if (chaseFollowsVehicle()) chaseCam.lookYaw = normalizeAngle((headingDeg * Math.PI) / 180 - chaseCam.yaw);
          else chaseCam.yaw = normalizeAngle((headingDeg * Math.PI) / 180);
        }
        if (Number.isFinite(pitchDeg)) chaseCam.pitch = clamp((pitchDeg * Math.PI) / 180, CHASE_PITCH_MIN, CHASE_PITCH_MAX);
        if (dx || dy) chaseTurn(dx * CHASE_LOOK_RATE, dy * CHASE_LOOK_RATE);
        updateChaseCamera(1 / 60);
        return chaseCameraReport();
      },
      // The screen point (CSS px) of a map point in the chase view, or null outside it.
      chaseProject(x, y, z = 0) {
        if (!chaseCameraLive()) return null;
        const p = chaseProject(x, y, z, { x: 0, y: 0, depth: 0, behind: false });
        return { x: Math.round(p.x), y: Math.round(p.y), depth: Math.round(p.depth), behind: p.behind, sees: chaseSees(x, y, z) };
      },
      // The interaction prompt as the player sees it (hud.js INTERACTION PROMPT):
      // visible, text, identity, docked, seconds since it popped in, this pass's offer.
      promptState: () => promptReport(),
      // The mission card's clearance of the player (hud-clearance.js): the player's box on screen, the
      // card's open and folded boxes, the dialogue line's and the waypoint pill's, and what yields or fades.
      // hudClearance('read') opens the card for a fresh read first, as a new call or objective does.
      hudClearance: (action) => hudClearanceReport(action),
      // Every HUD box on screen (id and rect, CSS px) and the pairs that overlap by more than `slack` px.
      hudOverlaps: (slack = 2) => hudOverlapReport(slack),
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
        // As the cheat does: a pick god mode made ahead of the story goes back to the frontier.
        if (!player.godMode && !mission) settleDemoStoryIndex();
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
          if (gameMode === 'elevator') {
            updateElevator(1 / 30);
            updateSkyLift(1 / 30);
            updateFortRecords(1 / 30);
          }
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
      // people up close. Anything above STREET_ZOOM_MAX (4.5) is not reachable in play.
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
      // Facing and footwork (footwork.js): with `aimDegrees` (0 east, 90 south) hold the
      // aim there as the touch aim stick does, `null` lets it go; returns where the
      // body faces, the movement keys' heading and the pace share (1, 0.8 side-step,
      // 0.6 backpedal) and km/h. Hold keys with simulate() to move.
      // For screenshots of the gait: `moveDegrees` holds the movement keys toward that
      // bearing (the nearest of eight) and `fire` the fire key, until footwork(null).
      footwork(aimDegrees, moveDegrees = null, fire = false) {
        if (aimDegrees === null) touchAim = null;
        else if (typeof aimDegrees === 'number') touchAim = (aimDegrees * Math.PI) / 180;
        for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF']) keys[code] = false;
        if (typeof moveDegrees === 'number') {
          const a = (moveDegrees * Math.PI) / 180,
            dx = Math.round(Math.cos(a)),
            dy = Math.round(Math.sin(a));
          keys.KeyD = dx > 0;
          keys.KeyA = dx < 0;
          keys.KeyS = dy > 0;
          keys.KeyW = dy < 0;
          keys.KeyF = !!fire;
        }
        return footworkReport();
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
    addConsoleMethods('godPanel', godSplashConsole());
    // godDrawbridges(action, pick): the GOD MODE tab's drawbridge row (god-drawbridges.js).
    addConsoleMethods('godPanel', godDrawbridgeConsole());
    // VIEW RULES: viewRules(x, y, margin) (chase-rules.js: what the rules that depend on the view say).
    addConsoleMethods('core', chaseRulesConsole());
    // END SUBSYSTEM: src/game-console-core.js
