    // BEGIN SUBSYSTEM: src/game-console-crowd.js — DeadEndCity console, crowd: pedestrianReport, fireShot, alarm, lifeScene, lineups, crowd render cost
    // People: the crowd report, shots and alarms the crowd reacts to, street scenes,
    // character/pose lineups, speech bubbles, crowd render cost.
    addConsoleMethods('crowd', {
      // Living people near the player, nearest first, for play-tests that pick a
      // victim: kind 'civilian', 'police', 'gang' or 'all' (default).
      nearbyPeople(radius = 500, kind = 'all') {
        const lists = {
          civilian: [pedestrians],
          police: [officers],
          gang: [gangMembers, enemies],
          all: [pedestrians, officers, gangMembers, enemies],
        }[kind] || [];
        const found = [];
        for (const list of lists)
          for (const p of list)
            if (p.hp > 0 && !p.hidden && distanceBetween(p, player) < radius)
              found.push({
                kind: p.police ? 'police:' + (p.unit || 'patrol') : p.faction ? 'gang:' + p.faction : 'civilian',
                x: Math.round(p.x),
                y: Math.round(p.y),
                hp: Math.round(p.hp),
                d: Math.round(distanceBetween(p, player)),
                sight: clearSight(player, p),
                // Police extras: a riot shield (swat.js), a rooftop post, their heading.
                ...(p.police ? { shield: !!p.shield, roof: !!p.roofSniper, aim: +(p.sniperAim || 0).toFixed(2), a: +(p.a || 0).toFixed(2), state: p.state } : {}),
              });
        return found.sort((a, b) => a.d - b.d).slice(0, 40);
      },
      // Speech bubbles and height: the view's height over someone on the ground at the view's centre, and their bubble's fade.
      speechView: () => speechViewReport(),
      // The three ways a 911 caller names the player's vehicle (crowd-chatter.js carSightingLines).
      witnessCarLines: (type, color, dir = 'north') => carSightingLines({ type, color }, dir),
      // The crowd around the player: counts by reaction, pose, role and state,
      // street scenes, recent incidents and witness reports (src/crowd.js).
      pedestrianReport: () => pedestrianReport(),
      // Fire the equipped weapon toward a map point, exactly as the player would.
      fireShot(x, y) {
        if (player.car) exitCar();
        player.a = Math.atan2(y - player.y, x - player.x);
        shotCooldownSeconds = 0;
        reloadSecondsRemaining = 0;
        const w = currentWeapon();
        if (!w.melee && w.ammo <= 0) w.ammo = w.clip;
        const aimWasActive = mouse.active;
        mouse.active = false;
        shoot();
        mouse.active = aimWasActive;
        return { x: Math.round(player.x), y: Math.round(player.y), heading: +player.a.toFixed(2) };
      },
      // Stage a street scene next to the player: vendor, busker, cafe, smokers,
      // delivery, hail, nightlife (nearest bar or club) or busStop (nearest shelter).
      lifeScene(kind) {
        crowd.settleStamp = gameTime;
        const near = (list) => list.reduce((a, b) => (distanceBetween(a, player) < distanceBetween(b, player) ? a : b));
        const place = near(PLACES.filter((p) => (p.kind === 'bar' || p.kind === 'club') && p.door)),
          stop = BUS_STOPS.length ? near(BUS_STOPS) : null,
          existing = crowd.scenes.find((s) => (kind === 'nightlife' && s.place === place) || (kind === 'busStop' && s.stop === stop));
        const s = existing
          ? existing
          : kind === 'nightlife'
            ? stageNightlife(place)
            : kind === 'busStop'
              ? stop
                ? stageBusStop(stop)
                : null
              : kind === 'hail'
                ? stageHail()
                : { vendor: stageVendor, busker: stageBusker, cafe: stageCafe, smokers: stageSmokers, delivery: stageDelivery }[kind]?.(true);
        return s ? { kind: s.kind, x: Math.round(s.x), y: Math.round(s.y), members: s.members.length } : null;
      },
      // Put an occupied car across the road ahead and drive the player's car into
      // it at `metersPerSecond`, for looking at crash reactions.
      stageCrash(metersPerSecond = 18) {
        if (!player.car) this.drive('sedan', 0, 0);
        const c = player.car,
          target = spawnClearCar('sedan', c.x + Math.cos(c.a) * 120, c.y + Math.sin(c.a) * 120, c.a + Math.PI / 2, true, '#b57374');
        target.occupied = true;
        target.driverMood = 'angry';
        target.vx = target.vy = target.speed = 0;
        this.launch(metersPerSecond);
        return { target: { x: Math.round(target.x), y: Math.round(target.y) } };
      },
      // Line up one pedestrian per pose in front of the player (for screenshots);
      // `role` dresses them all alike, e.g. 'commuter'.
      poseGallery: (role) => poseGallery(role),
      // One of each kind of character in a row in front of the player, facing the
      // camera (crowd.js CHARACTER LINEUP): stance 'stand', 'walk' or 'aim'.
      characterLineup: (stance, spacing) => characterLineup(stance, spacing),
      // What the people cost in the last frame (crowd3d.js): parts, draw calls, instances, triangles.
      crowdStats: (byPart) => city3D?.crowdStats?.(byPart) || null,
      // Pack the people `frames` times back to back: the rig's CPU cost per frame in ms.
      crowdBenchmark: (frames) => city3D?.crowdBenchmark?.(frames) ?? null,
      // The player's own body (player-body3d.js): build, vertices, triangles, parts, whether it drew this frame;
      // `finish` true completes a build still running behind the title at once. Null without the 3D renderer.
      playerModel: (finish) => city3D?.playerModel?.(finish === true) ?? null,
      // Voices (voices.js): who near the player screams as a woman or a man and, with
      // the 3D renderer, how the rig draws them (`mismatches`); the last screams played.
      voiceReport: (radius) => voiceReport(radius),
      // The `count` nearest living people (street, police, gangs) scream in their own
      // voices; returns who, the sex the voice used, the take and the rig's sex.
      screamTest(count = 6) {
        const near = [];
        for (const list of [pedestrians, officers, gangMembers, enemies])
          for (const p of list) if (p.hp > 0 && !p.hidden && distanceBetween(p, player) < 700) near.push(p);
        near.sort((a, b) => distanceBetween(a, player) - distanceBetween(b, player));
        return near.slice(0, count).map((p) => {
          const sample = playPersonScream(p, 0.3);
          return { who: voiceWho(p), female: personFemale(p), sample, drawn: city3D?.drawnFemale ? city3D.drawnFemale(p) : null };
        });
      },
      // Carjack (carjack-struggle.js): a stopped sedan beside the player with a driver of
      // `mood` (flee, plead, angry, witness, defiant; `female` true/false, `passengers`
      // 0/1), the player on its `side` ('driver' or 'passenger'), and E pressed at it.
      // Returns the struggle as carjack() does.
      carjackTest(mood = 'flee', side = 'driver', female = null, passengers = 0) {
        if (player.car) exitCar();
        // The last test's car goes, so it is never in the way of this one's door.
        for (let i = vehicles.length - 1; i >= 0; i--) if (vehicles[i].carjackTest) vehicles.splice(i, 1);
        const c = spawnClearCar('sedan', player.x, player.y - 40, 0, true),
          spec = vehicleSpec(c),
          out = side === 'passenger' ? -1 : 1;
        c.carjackTest = true;
        c.vx = c.vy = c.speed = 0;
        c.occupied = true;
        c.locked = false;
        c.driverMood = mood;
        if (female !== null) c.driverFemale = !!female;
        c.passengers = passengers ? 1 : 0;
        // An eastbound car's driver's side is north (heading minus 90 degrees).
        teleportPlayer(c.x, c.y - out * (spec.w / 2 + 16));
        startCarjack(c);
        return carjackState();
      },
      // The struggle in progress (phase, seconds, the driver's temper, waypoints round
      // the car, positions) and the last victim: sex, pose, down or up, what they are
      // saying, whether they have reported it and how many passengers ran.
      carjack: () => carjackState(),
      // Occupied traffic near the player and what E at each would do from where the
      // player stands (carjack-struggle.js planCarjack: why null = the struggle at the
      // door, else 'kind' / 'rolling' / 'no room'), nearest first; `side` spots are map
      // points a step off the driver's and the passenger's doors; `from` 'here' (the
      // player), 'kerb' or 'driver' plans each car as if E were pressed at that side.
      carjackScan: (radius = 600, count = 8, from = 'here') => carjackScan(radius, count, from),
      // A stopped sedan staged for a carjack by the action key (nothing started):
      // `hem` 'open', 'kerb' (parked cars close ahead and behind), 'lane' (a car beside
      // the driver's door) or 'boxed' (both); the player on its `side`; the car rolling
      // east at `kmh` (0: stopped). Returns its plan.
      carjackStage: (hem = 'open', mood = 'flee', side = 'passenger', kmh = 0) => carjackStage(hem, mood, side, kmh),
      // Raise an incident at a map point without firing: gunfire, explosion, crash.
      alarm(kind = 'gunfire', x = player.x, y = player.y) {
        const inc = crowdAlarm(kind, { x, y }, kind === 'crash' ? null : player, 1.4);
        return inc ? { kind: inc.kind, x: Math.round(inc.x), y: Math.round(inc.y) } : null;
      },
    });
    // The living city (livingcity-console.js): traffic streaming.
    addConsoleMethods('livingCity', livingCityConsole());
    // Blood (blood.js): the decals round a point, a wounded bystander for tests.
    addConsoleMethods('blood', bloodConsole());
    addConsoleMethods('gore', goreConsole());
    // Blood a vehicle carries (car-stains.js): the stain report, a bystander to run over.
    addConsoleMethods('blood', carStainConsole());
    // Who sees a car coming (crowd-awareness.js) and the second pass over someone on the ground (runover.js): test staging and reports.
    addConsoleMethods('crowd', awarenessConsole());
    addConsoleMethods('blood', runOverConsole());
    // END SUBSYSTEM: src/game-console-crowd.js
