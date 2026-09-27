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
        teleportPlayer(ROOF_HIT.escape.x, ROOF_HIT.escape.y - 120);
        setStage(4, ROOF_HIT.escape, 'LOSE THE POLICE · REACH CORAL PALMS MOTEL ON FOOT');
        return this.missionState();
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
            receipts: m.receipts?.map(pt),
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
