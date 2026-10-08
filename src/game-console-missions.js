    // BEGIN SUBSYSTEM: src/game-console-missions.js — DeadEndCity console, missions: startMission, missionState, missionTargets, demo, stage-skip shortcuts
    // Missions and the public demo: start a job, its state and targets, and the
    // test shortcuts that skip stages already verified.
    addConsoleMethods('missions', {
      startMission(index) {
        // A public demo's gated jobs need god mode or ?dev in the URL (campaign.js).
        if (demoLocked(index) && !/[?&]dev\b/.test(location.search)) return { ...this.status(), demoLocked: true };
        if (index >= 0 && index < missions.length) {
          missionIndex = index;
          startMission();
        }
        return this.status();
      },
      // PUBLIC DEMO (campaign.js): the build flag, which jobs are open, the stats
      // recap, whether the demo was completed and whether the card is up.
      demo: () => ({
        build: DEMO_BUILD,
        missions: DEMO_MISSIONS,
        godMode: !!player.godMode,
        open: missions.map((m, i) => i).filter((i) => !demoLocked(i)),
        storyOver: demoStoryOver(),
        callWaiting: storyCallWaiting(),
        completed: demoCompleted,
        cardShown: gameMode === 'demo',
        cardIn: Math.round(demoCardIn * 10) / 10,
        // What the mission picker lists: locked jobs read ???.
        picker: missions.map((m, i) => missionPickerTitle(i)),
        stats: { ...campaignStats, playSeconds: Math.round(campaignStats.playSeconds) },
      }),
      // Every on-screen pointer that refers to the story (HUD refreshed first):
      // the objective the 3D arrow, minimap and map draw, the navigation pill,
      // the pager, the flight strip's bearing and the ringing payphone.
      pointers() {
        updateUI();
        const target = objective(),
          bearing = objectiveBearing();
        return {
          objective: target ? { x: Math.round(target.x), y: Math.round(target.y) } : null,
          navigation: navigationState().visible && getElement('navigation').style.display !== 'none',
          navName: getElement('navTitle').textContent,
          pagerShown: !getElement('pager').classList.contains('hidden'),
          distanceLine: getElement('missionDistance').textContent,
          bearing: bearing === null ? null : Math.round(bearing),
          waypoint: !!userWaypoint,
          payphoneRinging: !mission && storyCallWaiting(),
          missionIndex,
          completed,
        };
      },
      // The HUD's mission card (refreshed first) and the last announcement's small line:
      // 'MISSION 1', 'CONTRACT 2', 'DEMO COMPLETE'; `text` is the card's sentence, `distance` its pill.
      missionCard() {
        updateUI();
        return {
          counter: getElement('missionCounter').textContent,
          announce: getElement('announceSmall').textContent,
          text: getElement('missionText').textContent,
          distance: getElement('missionDistance').textContent,
          // The card open (not the one-line strip), the story line (subtitle) up, and the viewport.
          open: !getElement('pager').classList.contains('compact'),
          line: mission && gameTime <= (mission.lineUntil || 0) ? mission.lastLine : null,
          viewport: [viewportWidth, viewportHeight],
        };
      },
      // The mission card's O key: open the strip or fold the open card (game-ui.js toggleMissionCard).
      toggleMissionCard() {
        toggleMissionCard();
        return this.missionCard();
      },
      // Mission 2 test shortcut: start A Seat at the Table if needed, put Vescari
      // down and the player on the street for the last stage (reach the motel).
      skipToRooftopEscape() {
        if (mission?.index !== 1) {
          missionIndex = 1;
          startMission();
        }
        const m = mission;
        m.boss.hp = 0;
        m.boss.deadTime = gameTime;
        m.killRegistered = true;
        player.roof = false;
        player.buildingRoof = null;
        player.altitude = 0;
        // South of the motel (the spot 120 north of it is inside a building).
        teleportPlayer(ROOF_HIT.escape.x, ROOF_HIT.escape.y + 120);
        setStage(4, ROOF_HIT.escape, 'LOSE THE POLICE · REACH CORAL PALMS MOTEL ON FOOT');
        return this.missionState();
      },
      // Mission 3 (High Ground, summitjob.js): the job's stage, dig progress, where the
      // package rides (hand, backpack or a vehicle), the cairn and Vinny.
      summitJob: () => summitJobReport(),
      // Mission 3 test shortcuts: start High Ground if needed, then 'summit' puts the player
      // on foot beside the cairn (stage 1); 'deliver' skips the dig with the package in the
      // backpack and stands the player on the pavement outside Vinny's warehouse (stage 3).
      summitSkip(where = 'summit') {
        if (mission?.index !== 2) {
          missionIndex = 2;
          startMission();
        }
        const m = mission;
        if (where === 'summit') {
          if (player.car) exitCar();
          teleportPlayer(SUMMIT_JOB.cache.x - 18, SUMMIT_JOB.cache.y + 8);
          missionUpdate(0);
        } else if (where === 'deliver') {
          if (player.car) exitCar();
          m.dig = 1;
          m.carrier = 'backpack';
          summitDeliverStage(m, 'In the backpack, then. Don’t drop it.');
          teleportPlayer(VINNY_DEPOT.door.x, VINNY_DEPOT.door.y - 70);
          missionUpdate(0);
        }
        return summitJobReport();
      },
      // Mission 4 (Borrowed Stripes, fortjob.js): the stage, Kessler's car (route progress,
      // trunk), Kessler on foot, the tail's heat, keys, the uniform.
      fortJob: () => fortJobReport(),
      // Mission 2: put the player on the Blue Hour terrace at roof-local (x, y)
      // (default: out of the lift), starting A Seat at the Table dressed as a
      // guest if needed. Arrives the way the lift does (story.js updateElevator).
      roofPlace(x = 71, y = 303) {
        if (mission?.index !== 1) {
          missionIndex = 1;
          startMission();
        }
        const m = mission;
        m.disguise = true;
        player.disguised = true;
        if (m.stage < 1) setStage(1, ROOFTOP.door, 'ENTER THE BLUE HOUR AS A GUEST');
        if (!player.roof) teleportPlayer(ROOFTOP.door.x, ROOFTOP.door.y);
        player.roof = true;
        player.altitude = ROOFTOP.height + 3;
        player.x = ROOFTOP.x + clamp(Number(x) || 0, 20, ROOFTOP.w - 20);
        player.y = ROOFTOP.y + clamp(Number(y) || 0, 20, ROOFTOP.h - 20);
        m.lastPlayerSpot = null;
        m.playerSpeed = 0;
        cameraTarget.x = player.x;
        cameraTarget.y = player.y;
        missionUpdate(0);
        return roofStealthReport();
      },
      // Mission 2 test helper: hold bodyguard `i` still at roof-local (x, y)
      // facing `heading` (radians, map angle), head straight. roofGuard(-1)
      // lets every guard go back to his beat.
      roofGuard(i, x, y, heading = 0) {
        const guards = enemies.filter((e) => e.guard && e.missionTag === 'rooftop-hit');
        if (i < 0) {
          for (const e of guards) {
            e.pinned = false;
            e.roofRoute = null;
          }
          return roofStealthReport();
        }
        const e = guards[i];
        if (!e) return null;
        Object.assign(e, { x: ROOFTOP.x + x, y: ROOFTOP.y + y, a: heading, look: 0, pinned: true, roofRoute: null, investigate: null });
        return roofStealthReport();
      },
      // What marks the objective and the player (markers.js): arrow, no ring, the player ring setting.
      markers: () => markersReport(),
      // Mission 2: the stealth state (suspicion, pace, each guard's view and
      // whether he sees the player) and the drink's progress and aftermath.
      roofStealth: () => {
        updateUI();
        return roofStealthReport();
      },
      roofPoison: () => roofPoisonReport(),
      // Mission 2 test helper: set the party's suspicion meter (0-100).
      roofSuspicion(value = 0) {
        const m = rooftopJob();
        if (!m) return null;
        m.suspicion = clamp(Number(value) || 0, 0, 100);
        return m.suspicion;
      },
      // Mission 2: the spike-the-glass action (the poison key) where the player stands.
      spikeGlass() {
        poisonDrink();
        return roofPoisonReport();
      },
      // Mission 1 test helper: `n` patrol officers on foot just inside Vinny's
      // front doorway, as if they had run in after the truck.
      depotOfficers(n = 2) {
        const spawned = [];
        for (let i = 0; i < n; i++) {
          const o = makeOfficer(-1700 + (i % 4) * 24, 4372 + Math.floor(i / 4) * 22, Math.PI / 2, 'patrol', {
            car: null,
            timer: 1.2 + i * 0.3,
          });
          officers.push(o);
          spawned.push({ x: Math.round(o.x), y: Math.round(o.y) });
        }
        return spawned;
      },
      // Mission 1 test helper: every officer still fighting inside the sealed
      // warehouse takes a fatal shot from the player (the ordinary hit path).
      neutraliseDepotPolice() {
        const inside = depotPoliceInside();
        for (const o of inside) strikePerson(o, 999, headingBetween(player, o), player, true, 'headshot');
        return inside.length;
      },
      missions: () => missions.map((m, i) => ({ index: i, title: m.title, contact: m.contact })),
      // The pause menu's RESTART CURRENT JOB (story.js retryMission).
      retryMission() {
        retryMission();
        return { mode: gameMode, ...this.missionState() };
      },
      // Open (true) or close (false) the pause menu as Escape does; its RESTART
      // CURRENT JOB button as shown (disabled with nothing to restart).
      pauseMenu(open) {
        if (open !== undefined && !!open !== (gameMode === 'pause')) togglePause();
        const restart = getElement('restartMission');
        return {
          mode: gameMode,
          open: gameMode === 'pause',
          info: getElement('pauseInfo').textContent,
          restart: { disabled: restart.disabled, note: restart.querySelector('span')?.textContent || null },
        };
      },
      // A pick in the mission picker (campaign.js chooseMission, gated as the
      // picker is): the job's call comes up (accept it with Enter or E).
      chooseMission(index) {
        // A job running: the pick is made in the picker, which asks first (ABANDON CONFIRM).
        if (mission && gameMode !== 'missions') openMissionSelect();
        const chosen = chooseMission(index);
        return { chosen, mode: gameMode, missionIndex, abandonConfirm: abandonConfirmReport(), ...this.missionState() };
      },
      // The ABANDON <job>? confirm (campaign.js): true presses ABANDON JOB, false KEEP PLAYING.
      abandonJob(yes = true) {
        const chosen = answerAbandonConfirm(!!yes);
        return { chosen, mode: gameMode, missionIndex, abandonConfirm: abandonConfirmReport(), ...this.missionState() };
      },
      // Mission 1 test shortcut: start Dockside Favor if needed, load all three
      // crates, and put the player in the truck on the road outside Vinny's
      // warehouse, facing its shutter, with the harbor alarm already raised.
      skipToDepotDelivery() {
        if (mission?.index !== 0) {
          missionIndex = 0;
          startMission();
        }
        const m = mission;
        for (const p of m.packages) p.got = true;
        m.collected = 3;
        m.loading = null;
        teleportPlayer(-1664, 4180);
        Object.assign(m.car, { x: -1664, y: 4232, a: Math.PI / 2, vx: 0, vy: 0, av: 0, speed: 0 });
        m.car.cargoCount = 3;
        enterVehicle(m.car);
        setStage(3, HARBOR.delivery, 'LEAVE THE HARBOR WITH ALL THREE CRATES');
        notifyCargoPolice(m);
        return { stage: m.stage, instruction: m.instruction, ...this.status() };
      },
      // Where the current mission stands, including Vinny's depot doors.
      missionState: () =>
        mission
          ? {
              index: mission.index,
              stage: mission.stage,
              instruction: mission.instruction,
              target: mission.target
                ? { x: Math.round(mission.target.x), y: Math.round(mission.target.y) }
                : null,
              depotShutter: +depotFrontShutter.toFixed(2),
              depotBackDoor: +depotBackDoor.toFixed(2),
              depotSealed,
              policeInside: mission.index === 0 ? depotPoliceInside().length : undefined,
              // Mission 1's sealed warehouse: who is still in there, and how.
              depotPolice:
                mission.index === 0 && mission.stage === 5
                  ? depotPoliceInside().map((o) => ({ x: Math.round(o.x), y: Math.round(o.y), hp: Math.round(o.hp), downed: !!o.downed, state: o.state || null }))
                  : undefined,
              wanted: Math.ceil(wantedStars),
            }
          : { mission: null, last: lastMissionOutcome, completed, depotShutter: +depotFrontShutter.toFixed(2), depotBackDoor: +depotBackDoor.toFixed(2) },
      // The current mission in full: target (with altitude), timer, the mission
      // vehicles, its guards and actors, and each job's own list of points.
      missionTargets() {
        const m = mission;
        if (!m) return null;
        const pt = (p) =>
          p ? { x: Math.round(p.x), y: Math.round(p.y), ...(p.altitude !== undefined ? { altitude: Math.round(p.altitude) } : {}) } : null;
        const car = (c) =>
          c
            ? {
                id: c.id,
                type: c.type,
                x: Math.round(c.x),
                y: Math.round(c.y),
                altitude: Math.round(c.altitude || 0),
                hp: Math.round(c.hp),
                maxhp: c.maxhp,
                speed: Math.round(c.speed || 0),
                burning: !!c.damage?.burning,
                fireSpent: !!c.damage?.fireSpent,
                driver: c === player.car,
                inWorld: vehicles.includes(c),
              }
            : null;
        return {
          index: m.index,
          title: missions[m.index].title,
          stage: m.stage,
          instruction: m.instruction,
          target: pt(m.target),
          timer: m.timeLimit ? Math.round(m.timer) : null,
          wanted: Math.ceil(wantedStars),
          player: { x: Math.round(player.x), y: Math.round(player.y), vehicle: player.car?.type || null, roof: !!player.roof, swimming: !!player.swimming, hp: Math.ceil(player.hp) },
          car: car(m.car),
          missionVehicles: vehicles.filter((c) => c.mission).map(car),
          guards: enemies
            .filter((e) => e.missionTag)
            .map((e) => ({ tag: e.missionTag, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp), solidSpot: solid(e.x, e.y, 6) })),
          // Anyone armed within 600 units who is aiming at something right now.
          hostiles: [...gangMembers, ...enemies]
            .filter((e) => e.hp > 0 && e.aiming && distanceBetween(e, player) < 600)
            .map((e) => ({ faction: e.faction, tag: e.missionTag || null, x: Math.round(e.x), y: Math.round(e.y) })),
          actors: storyActors
            .filter((p) => p.missionTag || p.name === 'ELENA CRUZ')
            .map((p) => ({ name: p.name, x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), hidden: !!p.hidden })),
          points: {
            waterRoute: m.waterRoute?.map(pt),
            gates: m.gates?.map(pt),
            checkpoints: m.checkpoints?.map(pt),
            bombs: m.bombs?.map(pt),
            substations: m.substations?.map(pt),
            rings: m.rings?.map(pt),
            repos: m.repos?.map((r) => ({ label: r.label, delivered: r.delivered, car: car(r.car) })),
            approach: pt(m.approach),
          },
        };
      },
      // Put the player at the controls of the current mission's vehicle.
      boardMissionVehicle() {
        const c = mission?.car;
        if (!c) return null;
        if (player.car && player.car !== c) exitCar();
        teleportPlayer(c.x, c.y);
        enterVehicle(c);
        return this.missionState();
      },
      // Test shortcut for fights already verified: every live guard of the current
      // mission (or only those with `tag`) is put down.
      defeatMissionGuards(tag) {
        let n = 0;
        for (const e of enemies)
          if (e.missionTag && (!tag || e.missionTag === tag) && e.hp > 0) {
            e.hp = 0;
            n++;
          }
        return n;
      },
    });
    // END SUBSYSTEM: src/game-console-missions.js
