    // `air` is the helicopter the tier sends: never more than one at a time
    // (AIR_UNITS_MAX, combat-rules.js), and unarmed (it tracks, lights and reports;
    // it never fires), so the top tiers escalate on the ground. `snipers` is the
    // most rooftop marksmen at once (swat.js: one, a second only deep into a long
    // five-star chase) and only counts while swat.js SNIPERS_ENABLED is true
    // (off for now: no snipers at any level).
    const POLICE_TIERS = [
      null,
      // 1 star: the nearest patrols investigate and try to make an arrest.
      { patrols: 2, swat: 0, feds: 0, tanks: 0, every: 7, air: 0, roadblocks: 0, ram: false, accuracy: 0.42, deadly: false },
      // 2: several cruisers, contact tactics (PIT, box), officers shoot.
      { patrols: 4, swat: 0, feds: 0, tanks: 0, every: 4.5, air: 0, roadblocks: 0, ram: true, accuracy: 0.46, deadly: true },
      // 3: more units, the (unarmed) police helicopter, a roadblock ahead.
      { patrols: 5, swat: 0, feds: 0, tanks: 0, every: 3.8, air: 1, roadblocks: 1, ram: true, accuracy: 0.5, deadly: true },
      // 4: SWAT vans with armoured rifle teams, an extra cruiser, two roadblocks.
      { patrols: 5, swat: 2, feds: 0, tanks: 0, every: 3.2, air: 1, roadblocks: 2, ram: true, accuracy: 0.55, deadly: true },
      // 5: federal agents, SWAT in five-strong teams, three roadblocks and the army:
      // jeeps with gunners, an APC and a troop truck first, the tank later.
      // (`snipers`: rooftop marksmen, only while swat.js SNIPERS_ENABLED.)
      { patrols: 5, swat: 3, feds: 2, tanks: 1, jeeps: 2, apcs: 1, trucks: 1, snipers: 2, every: 2.8, air: 1, roadblocks: 3, ram: true, accuracy: 0.6, deadly: true },
    ];
    // Seconds at five stars before the tank is sent: the light army units come first.
    const TANK_AFTER_SECONDS = 45;
    // How each kind of officer fights; `run` is the pace on foot (the player's
    // default run, game.js FOOT_RUN 25 km/h, outpaces every one of them). `dmg` is against NPCs, `playerDmg` against
    // the player (before the lethality scale in combat-rules.js, so 5.5 is about 11
    // health: an unarmoured player survives eight or nine pistol hits).
    const OFFICER_KINDS = {
      patrol: { hp: 85, vest: 25, color: '#2d455e', rate: [1.05, 1.5], burst: 1, dmg: 17, playerDmg: 5.5, speed: 560, range: 210, run: 18 * KMH, sample: 'pistol' },
      road: { hp: 85, vest: 40, color: '#2d455e', rate: [1.0, 1.4], burst: 1, dmg: 17, playerDmg: 5.5, speed: 560, range: 230, run: 17 * KMH, sample: 'pistol' },
      swat: { hp: 110, vest: 120, color: '#1b2026', rate: [1.5, 2.1], burst: 3, dmg: 20, playerDmg: 5, speed: 820, range: 270, run: 16 * KMH, sample: 'automatic', rifle: true },
      fed: { hp: 95, vest: 90, color: '#15171b', rate: [0.8, 1.15], burst: 1, dmg: 22, playerDmg: 6.5, speed: 780, range: 250, run: 18 * KMH, sample: 'automatic', rifle: true },
      // Army riflemen out of an APC or a truck at five stars.
      soldier: { hp: 100, vest: 90, color: '#4a5638', rate: [1.3, 1.8], burst: 3, dmg: 19, playerDmg: 5, speed: 800, range: 260, run: 18 * KMH, sample: 'automatic', rifle: true },
      // A police marksman on a roof (swat.js fires the rounds).
      sniper: { hp: 90, vest: 60, color: '#1b2026', rate: [2, 3], burst: 1, dmg: 60, playerDmg: 14, speed: 1500, range: 760, run: 0, sample: 'pistol', rifle: true },
    };
    const PURSUIT_SEARCH_SECONDS = [0, 6, 9, 13, 18, 24];
    // Running totals for policeReport(): pursuit contacts with the player's car.
    const pursuitStats = { contacts: 0, pits: 0, spinouts: 0, spawned: 0, tankShots: 0, sniperShots: 0, arrests: 0, shortcuts: 0, marine: 0, marineShots: 0 };
    // Until then no cruiser tries contact (set when one spins the runner out).
    let contactHoldUntil = 0;
    let dispatchTimer = 2,
      dispatchBurst = 0,
      arrestProgress = 0,
      lastDispatchLine = -100,
      armorWarningAt = -100;
    function policeTier(stars = Math.ceil(wantedStars)) {
      return POLICE_TIERS[clamp(stars, 1, 5)];
    }
    function policeCanSeePlayer() {
      return (
        officers.some((o) => o.hp > 0 && o.state !== 'return' && policeSees(o)) ||
        vehicles.some((c) => c.cop && !c.crewDeployed && c.hp > 0 && policeSees(c))
      );
    }
    function pursuitUnitKind(c) {
      return c.lawUnit || (c.type === 'police' ? 'patrol' : null);
    }

    /* DISPATCH RADIO: a caption for each new star, and a few event calls. */
    const WANTED_DISPATCH = [
      '',
      'ALL UNITS · REPORT OF A DISTURBANCE · NEAREST PATROL RESPOND',
      'SHOTS FIRED · ALL UNITS PURSUE · USE OF FORCE AUTHORISED',
      'AIR UNIT LAUNCHED · SPOTLIGHT ON THE SUSPECT · ROADBLOCKS GOING UP',
      'SWAT DEPLOYED · AIR UNIT DIRECTING · CLOSE THE AVENUES',
      'FEDERAL RESPONSE · ARMY UNITS ROLLING · SHOOT ON SIGHT',
    ];
    function dispatchCaption(text, sample = null) {
      const el = getElement('radioCaption');
      el.textContent = 'DISPATCH / ' + text;
      el.classList.add('show');
      clearTimeout(radioCaptionTimer);
      radioCaptionTimer = setTimeout(() => el.classList.remove('show'), 4200);
      if (sample && voicesOn && gameMode === 'play') {
        playSample(sample, 0.6, 1, null);
        radioUntil = gameTime + 4;
      }
      lastDispatchLine = gameTime;
    }
    function announceWantedLevel(stars) {
      if (!stars || gameMode !== 'play') return;
      dispatchCaption(WANTED_DISPATCH[stars], stars >= 2 ? 'call-backup' : null);
      if (stars >= 2) tone(660 + stars * 60, 0.09, 0.12, 'square', 880);
      // Reinforcements for the new tier start rolling in straight away: the
      // first couple of units come in a burst, the rest on the tier's cadence.
      dispatchTimer = Math.min(dispatchTimer, 0.4);
      dispatchBurst = Math.max(dispatchBurst, stars >= 2 ? 2 : 1);
    }
    function policeRadioEvent(kind, where) {
      if (gameTime - lastDispatchLine < 5) return;
      if (kind === 'officer-down') {
        dispatchCaption('OFFICER DOWN · ALL UNITS CONVERGE', null);
        radio('call-backup', where);
      } else if (kind === 'unit-down') dispatchCaption('UNIT DOWN · SUSPECT IS ARMED AND DANGEROUS', null);
      else if (kind === 'swat') dispatchCaption('SWAT TEAM ON SCENE · DEPLOYING', null);
      else if (kind === 'tank') dispatchCaption('ARMOR ON SCENE · CIVILIANS CLEAR THE AREA', null);
      else if (kind === 'army') dispatchCaption('ARMY UNITS INBOUND · GUNNERS WEAPONS FREE', null);
      else if (kind === 'lost') dispatchCaption('LOST VISUAL · UNITS SEARCH THE AREA', null);
    }

    /**
     * REINFORCEMENTS
     * One unit at a time, on the tier's cadence, at a road junction 520-1250
     * units away and outside the camera. Interceptors are placed ahead of a
     * moving runner so they come at them rather than trail behind.
     */
    function pursuitSpawnPoint(ahead) {
      const heading = Math.atan2(player.car?.vy || 0, player.car?.vx || 0),
        moving = Math.hypot(player.car?.vx || 0, player.car?.vy || 0) > 60,
        points = [];
      for (const x of ROAD_CENTERS)
        for (const y of ROAD_ROWS) {
          const d = Math.hypot(x - player.x, y - player.y);
          if (d < 520 || d > 1250 || crowdInView(x, y, 140)) continue;
          if (inHarbor(x, y, 100) || harborPoliceProtected(x, y, 60) || !groundAt(x, y, 30)) continue;
          if (solid(x, y, 30) || vehicles.some((c) => Math.abs(c.x - x) < 70 && Math.abs(c.y - y) < 70)) continue;
          const toward = Math.cos(normalizeAngle(Math.atan2(y - player.y, x - player.x) - heading));
          points.push({ x, y, score: (ahead && moving ? toward * 2 : 0) + seededRandom() });
        }
      points.sort((a, b) => b.score - a.score);
      return points.slice(0, 5);
    }
    const UNIT_BUILDS = {
      patrol: { type: 'police', color: undefined, hp: 1, crew: 2 },
      swat: { type: 'van', color: '#1b2433', hp: 1.9, crew: 4 },
      fed: { type: 'suv', color: '#121417', hp: 1.5, crew: 3 },
      army: { type: 'tank', color: undefined, hp: 1, crew: 0 },
      armyJeep: { type: 'jeep', color: '#56613f', hp: 1.3, crew: 0, gunner: true },
      armyApc: { type: 'apc', color: '#56613f', hp: 1, crew: 4, gunner: true },
      armyTruck: { type: 'armytruck', color: '#56613f', hp: 1, crew: 5 },
    };
    function armyUnitKind(kind) {
      return kind === 'army' || kind === 'armyJeep' || kind === 'armyApc' || kind === 'armyTruck';
    }
    function spawnPursuitUnit(kind) {
      if (offCityStreets(player.x, player.y)) {
        if (kind === 'patrol') spawnCountyCop();
        return null;
      }
      const build = UNIT_BUILDS[kind],
        count = vehicles.filter((c) => c.cop && c.hp > 0 && !c.blockade && !c.airUnit).length,
        p = pursuitSpawnPoint(kind === 'patrol' ? count % 2 === 1 : kind !== 'army').find((q) =>
          canSpawnCar(build.type, q.x, q.y, headingBetween(q, player), 4),
        );
      if (!p) return null;
      const a = headingBetween(p, player);
      const c = makeCar(build.type, p.x, p.y, a, kind === 'patrol', build.color);
      Object.assign(c, {
        cop: true,
        ai: false,
        occupied: false,
        locked: false,
        pursuitUnit: true,
        dispatched: true,
        lawUnit: kind === 'patrol' ? null : kind,
        // A SWAT van carries four operators at four stars, five at five (swat.js).
        crewSize: kind === 'swat' ? swatCrewSize() : build.crew,
        armyUnit: armyUnitKind(kind),
        gunner: !!build.gunner,
        crewed: kind === 'army' || !!build.gunner,
        speed: 120,
        interceptor: count % 2 === 1,
        spawnedAt: physicsClock,
        role: ['pit', 'flank', 'block'][count % 3],
        routeTime: 0,
      });
      c.vx = Math.cos(a) * 120;
      c.vy = Math.sin(a) * 120;
      c.maxhp = c.hp = Math.round(c.hp * build.hp);
      c.route = copRoute(c);
      c.routeTime = 2;
      pursuitStats.spawned++;
      if (kind === 'swat') policeRadioEvent('swat', c);
      if (kind === 'army') policeRadioEvent('tank', c);
      else if (armyUnitKind(kind)) policeRadioEvent('army', c);
      return c;
    }
    function dispatchPolice(deltaSeconds) {
      dispatchTimer -= deltaSeconds;
      if (dispatchTimer > 0) return;
      const stars = Math.ceil(wantedStars),
        tier = policeTier(stars);
      // While the police are searching they send fewer new units, unless the
      // search has nobody in it at all.
      const units = vehicles.filter((c) => c.cop && c.hp > 0 && !c.blockade && !c.airUnit && c !== player.car),
        have = { patrol: 0, swat: 0, fed: 0, army: 0, armyJeep: 0, armyApc: 0, armyTruck: 0 };
      for (const c of units) {
        const kind = pursuitUnitKind(c);
        if (kind in have) have[kind]++;
      }
      if (dispatchBurst > 0) {
        dispatchBurst--;
        dispatchTimer = 0.6;
      } else dispatchTimer = tier.every * (searchActive ? 1.3 : 1) * randomBetween(0.8, 1.2);
      // Patrol cars already cruising nearby join the pursuit before any new unit
      // is sent: the response starts with whoever is closest.
      if (have.patrol < tier.patrols && !offCityStreets(player.x, player.y)) {
        let nearest = null;
        for (const c of vehicles)
          if (
            c.type === 'police' &&
            !c.cop &&
            c.hp > 0 &&
            !c.blockade &&
            !c.stolen &&
            !c.crewLost &&
            !c.crewDeployed &&
            c !== player.car &&
            distanceBetween(c, player) < 1100 &&
            (!nearest || distanceBetween(c, player) < distanceBetween(nearest, player))
          )
            nearest = c;
        if (nearest) {
          Object.assign(nearest, {
            cop: true,
            ai: false,
            pursuitUnit: true,
            crewSize: 2,
            role: ['pit', 'flank', 'block'][units.length % 3],
            interceptor: units.length % 2 === 1,
            routeTime: 0,
            spawnedAt: physicsClock,
          });
          nearest.junction = null;
          nearest.navAngle = undefined;
          dispatchTimer = Math.min(dispatchTimer, 1);
          return;
        }
      }
      // Heaviest missing unit first: the tier's character arrives early. At five
      // stars the army's light units lead; the tank waits until the player has
      // lasted TANK_AFTER_SECONDS.
      const order = [
        ['armyJeep', tier.jeeps || 0],
        ['swat', tier.swat],
        ['armyApc', tier.apcs || 0],
        ['fed', tier.feds],
        ['armyTruck', tier.trucks || 0],
        ['army', tier.tanks],
        ['patrol', tier.patrols],
      ];
      for (const [kind, cap] of order)
        if (have[kind] < cap) {
          if (kind === 'army' && starElapsed < TANK_AFTER_SECONDS) continue;
          if (spawnPursuitUnit(kind)) return;
          dispatchTimer = 1;
          return;
        }
    }
    /* Units a long way off and out of sight are sent home; the dispatcher replaces
       them with closer ones. Law units with no one to chase leave off-camera. */
    function recyclePursuitUnits(deltaSeconds) {
      for (let i = vehicles.length - 1; i >= 0; i--) {
        const c = vehicles[i];
        if (!c.pursuitUnit || c === player.car || c.blockade || c.stolen) continue;
        const d = distanceBetween(c, player),
          inView = crowdInView(c.x, c.y, 200),
          // Cars the dispatcher created go home when it is over; patrol cars that
          // were recalled out of traffic stay in the city.
          // A law unit stood down by a clear (cop off) never rejoins a later chase.
          idle = c.dispatched && !c.cop && (wantedStars <= 0 || !!c.lawUnit);
        c.stuckOffscreen = !inView && c.hp > 0 && Math.abs(c.speed || 0) < 8 && !c.crewDeployed && wantedStars > 0
          ? (c.stuckOffscreen || 0) + deltaSeconds
          : 0;
        const crewOut = c.crew?.some((o) => o.hp > 0 && !o.returned);
        if (
          !inView &&
          !crewOut &&
          ((d > 2400 && (c.hp <= 0 || !c.seesPlayer)) || (idle && d > 700) || c.stuckOffscreen > 7 || (c.hp <= 0 && d > 1200))
        ) {
          for (const o of c.crew || []) {
            const k = officers.indexOf(o);
            if (k >= 0) officers.splice(k, 1);
          }
          vehicles.splice(i, 1);
        }
      }
    }

    /**
     * COUNTY ROUTES
     * Outside the street grid a pursuit follows the same road graph as the
     * map's GPS (navigation.js): county roads, boulevards, service roads, trails
     * and the bridges, with A* between the nearest connected nodes.
     */
    function policeNavRoute(from, to) {
      const nodes = navigationGraph();
      if (!nodes.length) return [];
      const nearest = (p) => {
        let best = -1,
          bestD = Infinity;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (!n.links.length) continue;
          const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        return best;
      };
      const start = nearest(from),
        end = nearest(to);
      if (start < 0 || end < 0) return [];
      const route = navShortestPath(nodes, start, end);
      if (route.length && distanceBetween(from, route[0]) < 55) route.shift();
      return route;
    }
    /**
     * PURSUIT DRIVING
     * Called from physicsStep for every chasing unit. The plan (where to aim,
     * how fast, which role) is refreshed ten times a second; steering and
     * throttle follow it every physics step.
     *  - chase: lead pursuit on the runner's predicted position.
     *  - pit: at 2 stars and up the nearest car aims at the runner's rear
     *    quarter and pushes; the contact physics spins the runner out.
     *  - flank / block: the others run alongside or aim well ahead to box.
     *  - search: drive to the last sighting, then sweep the streets around it.
     * Whiskers slow and steer the car round walls; a car pinned against one
     * reverses out on opposite lock.
     */
    /* The next point to drive at on the way to `destination` (null: the runner,
       or where an interceptor expects them): straight there when it is close and
       in plain sight, otherwise the next junction of a road-network route, which
       is refreshed every two seconds or when the destination moves. */
    /**
     * OFF-ROAD SHORTCUTS
     * Whether a car could drive straight from `a` to `b`: open ground all the
     * way (parks, plazas, lots, verges), nothing solid, no water. Sampled every
     * 24 units; the answer is kept for half a second per car and destination.
     */
    function drivableLine(a, b) {
      const d = distanceBetween(a, b),
        steps = Math.ceil(d / 24);
      for (let i = 1; i < steps; i++) {
        const t = i / steps,
          x = a.x + (b.x - a.x) * t,
          y = a.y + (b.y - a.y) * t;
        if (!groundAt(x, y, 12) || solid(x, y, 12)) return false;
      }
      return true;
    }
    function shortcutTo(c, to) {
      const d = distanceBetween(c, to);
      if (d > 700 || d < 60) return false;
      const memo = c.shortcut;
      if (memo && physicsClock < memo.until && Math.abs(memo.x - to.x) < 40 && Math.abs(memo.y - to.y) < 40) return memo.ok;
      const ok = drivableLine(c, to);
      c.shortcut = { x: to.x, y: to.y, ok, until: physicsClock + 0.5 };
      if (ok) pursuitStats.shortcuts++;
      return ok;
    }
    function routeToward(c, destination) {
      if (destination && distanceBetween(c, destination) < 420 && clearSight(c, destination))
        return destination;
      // Straight across open ground when the whole line is drivable.
      if (destination && shortcutTo(c, destination)) return destination;
      const moved =
        destination && (!c.routeFor || Math.hypot(c.routeFor.x - destination.x, c.routeFor.y - destination.y) > 90);
      if ((c.routeTime || 0) <= 0 || !c.route?.length || moved) {
        c.route = copRoute(c, destination);
        c.routeFor = destination;
        c.routeTime = 2;
      }
      while (c.route.length && distanceBetween(c, c.route[0]) < 45) c.route.shift();
      // Already past the first junction (between it and the next): skip it
      // rather than turning back for it.
      if (c.route.length > 1 && distanceBetween(c, c.route[1]) < distanceBetween(c.route[0], c.route[1]))
        c.route.shift();
      return c.route[0] || destination || { x: roadNear(player.x), y: rowNear(player.y) };
    }
    function planPursuit(c, spec, along) {
      const stars = Math.ceil(wantedStars),
        tier = policeTier(stars),
        quarry = c.pursuitTarget?.hp > 0 ? c.pursuitTarget : player.car || player,
        onFoot = !c.pursuitTarget && (!player.car || isAircraft(player.car)),
        d = distanceBetween(c, quarry),
        plan = c.pursuitPlan || (c.pursuitPlan = {});
      plan.mode = 'route';
      plan.stop = false;
      let target;
      const qvx = quarry.vx || 0,
        qvy = quarry.vy || 0,
        qspeed = Math.hypot(qvx, qvy);
      if (c.pursuitTarget && d < 330 && clearSight(c, c.pursuitTarget)) {
        target = c.pursuitTarget;
        plan.mode = 'chase';
      } else if (!c.pursuitTarget && c.seesPlayer && d < 480) {
        plan.mode = 'chase';
        if (onFoot) {
          target = player;
          plan.stop = d < 150;
        } else {
          // Lead pursuit: where the runner will be when we get there.
          const t = clamp(d / Math.max(120, Math.abs(along) + 60), 0, 1.4);
          target = { x: quarry.x + qvx * t, y: quarry.y + qvy * t };
          const qa = qspeed > 20 ? Math.atan2(qvy, qvx) : quarry.a || 0,
            fx = Math.cos(qa),
            fy = Math.sin(qa),
            side = (c.x - quarry.x) * -fy + (c.y - quarry.y) * fx >= 0 ? 1 : -1,
            qspec = vehicleSpec(quarry) || { l: 40, w: 20 };
          // After a spin-out the pack gives the runner a few seconds to recover.
          if (tier.ram && d < 170 && qspeed > 40 && gameTime >= contactHoldUntil) {
            if (c.role === 'pit' || c.role === undefined) {
              // Rear quarter panel, pushed through.
              target = {
                x: quarry.x - fx * qspec.l * 0.3 + -fy * side * qspec.w * 0.55 + qvx * 0.25,
                y: quarry.y - fy * qspec.l * 0.3 + fx * side * qspec.w * 0.55 + qvy * 0.25,
              };
              plan.mode = 'pit';
            } else if (c.role === 'flank') {
              target = { x: quarry.x + fx * 50 + -fy * side * 40 + qvx * 0.3, y: quarry.y + fy * 50 + fx * side * 40 + qvy * 0.3 };
              plan.mode = 'flank';
            } else {
              target = { x: quarry.x + qvx * 1.3, y: quarry.y + qvy * 1.3 };
              plan.mode = 'block';
            }
          }
        }
      } else if (searchActive) {
        // Search: the last sighting first, then the streets around it.
        plan.mode = 'search';
        if (!c.searchPoint || distanceBetween(c, c.searchPoint) < 70 || gameTime > (c.searchUntil || 0)) {
          const first = !c.searchPoint || c.searchFrom !== lastSeen;
          c.searchFrom = lastSeen;
          const r = first ? 0 : randomBetween(120, policeSearchRadius() * 0.8),
            a = randomBetween(0, TAU);
          c.searchPoint = {
            x: roadNear(lastSeen.x + Math.cos(a) * r),
            y: rowNear(lastSeen.y + Math.sin(a) * r),
          };
          c.searchUntil = gameTime + 9;
        }
        target = routeToward(c, c.searchPoint);
      } else {
        target = routeToward(c, null);
        // The last leg: straight at the runner once there is a clear line, or
        // across a park or plaza when the ground between is open.
        if ((d < 380 && c.seesPlayer) || shortcutTo(c, quarry)) target = quarry;
      }
      // Coming at the runner nose to nose: no suicide rams. Brake hard and angle
      // across the lane to make a rolling block the runner has to swerve round.
      plan.headOn = false;
      if (!onFoot && plan.mode !== 'search' && d < 260 && qspeed > 40) {
        const cvx = Math.cos(c.a),
          cvy = Math.sin(c.a),
          facing = (cvx * qvx + cvy * qvy) / qspeed,
          toward = ((quarry.x - c.x) * cvx + (quarry.y - c.y) * cvy) / Math.max(1, d);
        if (facing < -0.5 && toward > 0.6) {
          plan.headOn = true;
          plan.mode = 'block';
          const side = c.role === 'flank' ? 1 : -1;
          target = { x: c.x - qvy / qspeed * side * 60 + cvx * 20, y: c.y + qvx / qspeed * side * 60 + cvy * 20 };
        }
      }
      plan.target = target;
      plan.distance = d;
      plan.quarrySpeed = qspeed;
      plan.onFoot = onFoot;
      // Whiskers: a wall ahead slows the car and turns it toward the open side.
      const speed = Math.abs(along),
        reach = clamp(speed * 0.5, 34, 150),
        heading = c.a,
        probe = (angle, dist) =>
          solid(c.x + Math.cos(heading + angle) * dist, c.y + Math.sin(heading + angle) * dist, 10);
      plan.avoid = 0;
      plan.wall = Infinity;
      if (probe(0, reach) || probe(0, reach * 0.55)) {
        plan.wall = probe(0, reach * 0.55) ? reach * 0.55 : reach;
        const left = probe(-0.5, reach * 0.8),
          right = probe(0.5, reach * 0.8);
        plan.avoid = left && !right ? 1 : right && !left ? -1 : 0;
      } else {
        if (probe(-0.42, reach * 0.8)) plan.avoid = 0.55;
        else if (probe(0.42, reach * 0.8)) plan.avoid = -0.55;
      }
      // Top speed by tier; a unit far behind and out of sight drives harder.
      plan.top = spec.max * (0.8 + stars * 0.035) * (d > 700 && !crowdInView(c.x, c.y, 100) ? 1.12 : 1);
    }
    function pursuitControl(c, stepSeconds, along, spec) {
      c.routeTime = (c.routeTime || 0) - stepSeconds;
      if (!c.pursuitPlan || physicsClock >= (c.pursuitPlanAt || 0)) {
        // Ten plans a second near the player, three for units a long way off.
        const far = Math.abs(c.x - player.x) > 800 || Math.abs(c.y - player.y) > 800;
        c.pursuitPlanAt = physicsClock + (far ? 0.3 : 0.1);
        planPursuit(c, spec, along);
      }
      const plan = c.pursuitPlan,
        target = plan.target || player;
      // Pinned against something: back out on opposite lock for a moment.
      if (physicsClock < (c.reverseUntil || 0))
        return { steer: (c.reverseSteer || 1) * 1.6, acceleration: -spec.acc * 0.9, drag: 0.4 };
      const da = normalizeAngle(headingBetween(c, target) - c.a);
      let steer = clamp(da * 3 + plan.avoid * 1.4, -2.2, 2.2),
        desired = plan.top * clamp(1.15 - Math.abs(da) * 0.75, 0.22, 1);
      if (plan.wall < Infinity) desired = Math.min(desired, 40 + plan.wall * 1.1);
      if (plan.onFoot && distanceBetween(c, player) < 320) {
        // Pull up short of a runner on foot so the crew can get out.
        desired = clamp((distanceBetween(c, player) - 150) * 1.5, 0, 150);
        if (distanceBetween(c, player) < 150) steer = 0;
      } else if (player.car && !isAircraft(player.car) && (player.carStoppedFor || 0) > 0.8 && distanceBetween(c, player) < 300) {
        // A driver who has stopped is surrounded, not rammed: pull up short so the
        // crew can get out and make the arrest (a shove would spoil a surrender).
        desired = clamp((distanceBetween(c, player) - 95) * 1.5, 0, 150);
        if (distanceBetween(c, player) < 110) steer = 0;
      } else if (plan.mode === 'pit' || plan.mode === 'flank')
        desired = Math.max(desired, plan.quarrySpeed + (plan.mode === 'pit' ? 70 : 40));
      else if (plan.headOn) desired = Math.min(desired, 35);
      else if (plan.mode === 'block') desired = Math.max(desired, plan.quarrySpeed + 90);
      else if (plan.mode === 'chase' && (!policeTier().ram || gameTime < contactHoldUntil) && plan.distance < 110)
        // One star: tail the runner, do not ram them.
        desired = Math.min(desired, plan.quarrySpeed * 0.95);
      // Yaw needs rolling wheels: a stopped car cannot spin on the spot.
      steer *= clamp(Math.abs(along) / 55, 0.3, 1) * (along < -5 ? -1 : 1);
      // Stuck: wanting to go, not going.
      if (desired > 60 && Math.abs(along) < 14 && physicsClock - (c.spawnedAt || 0) > 1)
        c.pinnedFor = (c.pinnedFor || 0) + stepSeconds;
      else c.pinnedFor = 0;
      if (c.pinnedFor > 1.1) {
        c.pinnedFor = 0;
        c.reverseUntil = physicsClock + randomBetween(0.8, 1.2);
        c.reverseSteer = da > 0 ? -1 : 1;
        c.reversals = (c.reversals || 0) + 1;
      }
      return {
        steer,
        acceleration: clamp((desired - along) * 3, -spec.brake * (plan.onFoot ? 1.2 : 1.05), engineAcceleration(spec, along)),
        drag: 0,
      };
    }

    /**
     * OFFICERS ON FOOT
     * Weapon profile, a fair hit roll, cover behind their own car, flanking,
     * and when the runner ducks out of sight, suppressive fire at where they
     * went. Called from updateOfficers (citylife.js).
     */
    function officerKind(o) {
      return OFFICER_KINDS[o.unit] || OFFICER_KINDS.patrol;
    }
    function makeOfficer(x, y, a, unit, extra = {}) {
      const kind = OFFICER_KINDS[unit] || OFFICER_KINDS.patrol;
      return {
        x,
        y,
        a,
        hp: kind.hp,
        vest: kind.vest,
        color: kind.color,
        unit,
        rifle: !!kind.rifle,
        police: true,
        state: 'pursue',
        walk: 0,
        timer: randomBetween(0.7, 1.2),
        engagedSaid: false,
        sightTime: 0,
        gangTarget: null,
        ...extra,
      };
    }
    /* Whether the player is a threat an officer may shoot at. At one star the
       police come to arrest, and only open fire on someone who is fighting. */
    function playerResisting() {
      return (
        gameTime - (player.lastShotAt ?? -100) < 6 ||
        gameTime - (player.lastStrikeAt ?? -100) < 6 ||
        (player.car && Math.abs(player.car.speed || 0) > 60)
      );
    }
    function officerMayShoot(o, target) {
      if (target !== player) return true;
      if (policeHoldFire()) return false;
      return policeTier().deadly || playerResisting() || o.hp < (o.maxhp || officerKind(o).hp);
    }
    function officerShoot(o, target, deltaSeconds) {
      const kind = officerKind(o),
        stars = Math.ceil(wantedStars);
      o.timer -= deltaSeconds;
      if (o.timer > 0) return;
      // Never from off screen (combat-rules.js ON-SCREEN RULE).
      if (target === player && !shooterInView(o)) return;
      if (o.burstLeft > 0) {
        o.burstLeft--;
        o.timer = o.burstLeft > 0 ? 0.11 : randomBetween(kind.rate[0], kind.rate[1]);
      } else {
        o.burstLeft = kind.burst - 1;
        o.timer = o.burstLeft > 0 ? 0.11 : randomBetween(kind.rate[0], kind.rate[1]);
        // Faster reactions at higher alert.
        if (!o.burstLeft) o.timer *= 1.12 - stars * 0.05;
      }
      let a = headingBetween(o, target);
      if (target === player) {
        // A fair hit roll: a first shot at a newly seen target, a runner moving
        // fast, range and a stagger all spoil the aim. A miss goes visibly wide.
        const speed = player.car
            ? Math.hypot(player.car.vx || 0, player.car.vy || 0)
            : keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD
              ? footPace() * 3
              : 0,
          d = combatDistance(o, player);
        let chance = policeTier().accuracy * (o.rifle ? 1.08 : 1);
        chance *= clamp(1.25 - d / 420, 0.45, 1.1);
        chance *= clamp(1 - speed / 420, 0.45, 1);
        if (o.sightTime < 0.8) chance *= 0.35;
        if (gameTime < (o.staggerUntil || 0)) chance *= 0.3;
        if (seededRandom() > chance) a += (seededRandom() < 0.5 ? -1 : 1) * randomBetween(0.07, 0.16);
        else a += randomBetween(-0.012, 0.012);
      } else a += randomBetween(-0.045, 0.045);
      const origin = { x: o.x + Math.cos(a) * 14, y: o.y + Math.sin(a) * 14, altitude: entityElevation(o) };
      bullets.push({
        ...origin,
        ...shotVelocity(origin, target, kind.speed, a),
        life: 0.75,
        dmg: kind.dmg,
        playerDmg: kind.playerDmg,
        enemy: true,
        faction: 'police',
        owner: o,
        target,
      });
      if (target !== player) {
        target.policeAggroUntil = gameTime + 15;
        target.policeThreatUntil = gameTime + 15;
      }
      o.muzzleAt = gameTime;
      playSample(kind.sample, o.rifle ? 0.26 : 0.3, randomBetween(0.95, 1.05), o);
      if (city3D) city3D.fire(o.x, o.y, a, false, entityElevation(o));
    }
    /**
     * FIRING TOKENS
     * However many officers can see the player, only a few shoot at once: two
     * at one star up to five at five. Tokens go to those with the best view
     * (closest, already firing) and are reshuffled every two seconds, so the
     * fire comes from changing directions but never as a firing squad.
     */
    const FIRE_TOKENS = [0, 2, 3, 3, 4, 5];
    let tokenShuffleAt = 0;
    function assignFireTokens() {
      assignOfficerDrags();
      const cap = FIRE_TOKENS[clamp(Math.ceil(wantedStars), 0, 5)],
        reshuffle = gameTime >= tokenShuffleAt;
      if (reshuffle) tokenShuffleAt = gameTime + 2;
      const shooters = [];
      for (const o of officers) {
        if (o.hp <= 0 || o.downed || o.dragging || o.roofSniper || !o.seesPlayer || o.state === 'return' || personIncapacitated(o)) {
          o.fireToken = false;
          continue;
        }
        shooters.push(o);
      }
      if (!reshuffle && shooters.filter((o) => o.fireToken).length >= Math.min(cap, shooters.length)) return;
      for (const o of shooters)
        o.tokenScore = distanceBetween(o, player) - (o.fireToken && !reshuffle ? 120 : 0) - seededRandom() * 60;
      shooters.sort((a, b) => a.tokenScore - b.tokenScore);
      shooters.forEach((o, i) => {
        o.fireToken = i < cap;
      });
    }
