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
      // Raise an incident at a map point without firing: gunfire, explosion, crash.
      alarm(kind = 'gunfire', x = player.x, y = player.y) {
        const inc = crowdAlarm(kind, { x, y }, kind === 'crash' ? null : player, 1.4);
        return inc ? { kind: inc.kind, x: Math.round(inc.x), y: Math.round(inc.y) } : null;
      },
    });
    // END SUBSYSTEM: src/game-console-crowd.js
