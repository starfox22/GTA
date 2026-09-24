    // BEGIN SUBSYSTEM: src/pursuit.js — Police response and pursuit tactics
    /**
     * Police response and pursuit tactics
     * Source: src/pursuit.js
     * Scope: shared game closure.
     * What each wanted star sends (POLICE_TIERS), where the reinforcements come
     * from, how the cars drive a pursuit (intercept, PIT, box, flank, stuck
     * recovery), how officers on foot fight (weapon profiles, fair accuracy, cover
     * behind their own car, flanking, suppressive fire), the arrest (BUSTED), the
     * tank the fifth star can bring, dispatch radio, and the search area drawn on
     * the radar.
     *
     * Units are vehicles with `cop` set. `lawUnit` marks the heavier kinds:
     * 'swat' (tactical van, four armoured officers with rifles), 'fed' (black SUV,
     * three agents with rifles) and 'army' (a Fort Sentinel tank, no crew on
     * foot). Patrol cars keep `type === 'police'` and no `lawUnit`.
     */
    // `air` is the helicopter the tier sends: never more than one at a time
    // (AIR_UNITS_MAX, combat-rules.js), so the top tiers escalate on the ground and
    // with a sharper `marksman` in that one helicopter (lock-on seconds, hit chance
    // at a standstill, seconds between rounds).
    const POLICE_TIERS = [
      null,
      // 1 star: the nearest patrols investigate and try to make an arrest.
      { patrols: 2, swat: 0, feds: 0, tanks: 0, every: 7, air: 0, roadblocks: 0, ram: false, accuracy: 0.42, deadly: false },
      // 2: several cruisers, contact tactics (PIT, box), officers shoot.
      { patrols: 4, swat: 0, feds: 0, tanks: 0, every: 4.5, air: 0, roadblocks: 0, ram: true, accuracy: 0.46, deadly: true },
      // 3: more units, a helicopter with a marksman, a roadblock ahead.
      { patrols: 5, swat: 0, feds: 0, tanks: 0, every: 3.8, air: 1, roadblocks: 1, ram: true, accuracy: 0.5, deadly: true, marksman: { lock: 1.6, hit: 0.85, rest: [2.4, 3.4] } },
      // 4: SWAT vans with armoured rifle teams, an extra cruiser, two roadblocks, and a
      // police sniper in the helicopter who lines up faster and misses less.
      { patrols: 5, swat: 2, feds: 0, tanks: 0, every: 3.2, air: 1, roadblocks: 2, ram: true, accuracy: 0.55, deadly: true, marksman: { lock: 1.3, hit: 0.9, rest: [2.0, 2.8] } },
      // 5: federal agents and the army: a tank from Fort Sentinel, a third SWAT van,
      // three roadblocks, and the helicopter's sharpest marksman.
      { patrols: 5, swat: 3, feds: 2, tanks: 1, every: 2.8, air: 1, roadblocks: 3, ram: true, accuracy: 0.6, deadly: true, marksman: { lock: 1.1, hit: 0.94, rest: [1.7, 2.4] } },
    ];
    // How each kind of officer fights. `dmg` is against NPCs, `playerDmg` against
    // the player (before the lethality scale in combat-rules.js, so 5.5 is about 11
    // health: an unarmoured player survives eight or nine pistol hits).
    const OFFICER_KINDS = {
      patrol: { hp: 85, vest: 25, color: '#2d455e', rate: [1.05, 1.5], burst: 1, dmg: 17, playerDmg: 5.5, speed: 560, range: 210, run: 112, sample: 'pistol' },
      road: { hp: 85, vest: 40, color: '#2d455e', rate: [1.0, 1.4], burst: 1, dmg: 17, playerDmg: 5.5, speed: 560, range: 230, run: 100, sample: 'pistol' },
      swat: { hp: 110, vest: 120, color: '#1b2026', rate: [1.5, 2.1], burst: 3, dmg: 20, playerDmg: 5, speed: 820, range: 270, run: 118, sample: 'automatic', rifle: true },
      fed: { hp: 95, vest: 90, color: '#15171b', rate: [0.8, 1.15], burst: 1, dmg: 22, playerDmg: 6.5, speed: 780, range: 250, run: 122, sample: 'automatic', rifle: true },
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
      'AIR UNIT LAUNCHED · MARKSMAN ON BOARD · ROADBLOCKS GOING UP',
      'SWAT DEPLOYED · SECOND AIR UNIT UP · CLOSE THE AVENUES',
      'FEDERAL RESPONSE · FORT SENTINEL ARMOR ROLLING · SHOOT ON SIGHT',
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
      swat: { type: 'van', color: '#1d242b', hp: 1.9, crew: 4 },
      fed: { type: 'suv', color: '#121417', hp: 1.5, crew: 3 },
      army: { type: 'tank', color: undefined, hp: 1, crew: 0 },
    };
    function spawnPursuitUnit(kind) {
      if (player.x > CITY_SIZE || player.y > CITY_SIZE) {
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
        crewSize: build.crew,
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
        have = { patrol: 0, swat: 0, fed: 0, army: 0 };
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
      if (have.patrol < tier.patrols && !(player.x > CITY_SIZE || player.y > CITY_SIZE)) {
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
      // Heaviest missing unit first: the tier's character arrives early.
      const order = [
        ['army', tier.tanks],
        ['swat', tier.swat],
        ['fed', tier.feds],
        ['patrol', tier.patrols],
      ];
      for (const [kind, cap] of order)
        if (have[kind] < cap) {
          if (kind === 'army' && starElapsed < 20) continue;
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
        acceleration: clamp((desired - along) * 3, -(plan.onFoot ? 620 : 380), spec.acc),
        drag: 0.2,
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
            : keys.ShiftLeft || keys.ShiftRight
              ? 150
              : keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD
                ? 90
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
        if (o.hp <= 0 || o.downed || o.dragging || !o.seesPlayer || o.state === 'return' || personIncapacitated(o)) {
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
    /* Suppressive fire at the corner the runner ducked behind. */
    function officerSuppress(o, deltaSeconds) {
      if (!lastSeen || gameTime - (o.lastSawPlayerAt ?? -100) > 3.5 || !policeTier().deadly || policeHoldFire()) return false;
      if (distanceBetween(o, lastSeen) > officerKind(o).range * 1.2) return false;
      o.timer -= deltaSeconds * 0.5;
      if (o.timer > 0) return true;
      o.timer = randomBetween(1.2, 2);
      const a = headingBetween(o, lastSeen) + randomBetween(-0.08, 0.08),
        origin = { x: o.x + Math.cos(a) * 14, y: o.y + Math.sin(a) * 14, altitude: entityElevation(o) },
        kind = officerKind(o);
      bullets.push({
        ...origin,
        ...shotVelocity(origin, null, kind.speed, a),
        life: 0.6,
        dmg: kind.dmg,
        playerDmg: kind.playerDmg,
        enemy: true,
        faction: 'police',
        owner: o,
        target: player,
      });
      playSample(kind.sample, 0.24, 1, o);
      if (city3D) city3D.fire(o.x, o.y, a, false, entityElevation(o));
      return true;
    }
    /**
     * Where an officer engaging the player wants to stand (null: hold still).
     * A patrol officer whose cruiser is close uses it: crouched behind the far
     * corner while waiting, stepped out past the corner to fire while holding a
     * firing token, so they can be shot back exactly when they are shooting.
     * Everyone else waiting for a token works round the player's flank and
     * closes in; SWAT and agents with a token hold at rifle range off the flank.
     */
    function officerPosition(o, target, d, advancing = false) {
      if (target !== player || o.blockade) return null;
      if (!o.flankSide) o.flankSide = seededRandom() < 0.5 ? -1 : 1;
      const car = o.car,
        free = (spot, margin) => !solid(spot.x, spot.y, 8) && distanceBetween(o, spot) > margin;
      if (
        !o.rifle &&
        car?.hp > 0 &&
        !car.stolen &&
        car !== player.car &&
        distanceBetween(o, car) < 110 &&
        distanceBetween(car, player) > 60
      ) {
        const away = headingBetween(player, car) + o.flankSide * (advancing ? 0.5 : 1.4),
          spot = { x: car.x + Math.cos(away) * 25, y: car.y + Math.sin(away) * 25 };
        return free(spot, 6) ? spot : null;
      }
      if (advancing) {
        const base = headingBetween(player, o) + o.flankSide * 0.35,
          r = clamp(d - 40, 90, 170),
          spot = { x: player.x + Math.cos(base) * r, y: player.y + Math.sin(base) * r };
        return free(spot, 12) ? spot : null;
      }
      if (o.rifle) {
        const base = headingBetween(player, o) + o.flankSide * 0.3,
          r = clamp(d, 130, 190),
          spot = { x: player.x + Math.cos(base) * r, y: player.y + Math.sin(base) * r };
        return free(spot, 14) ? spot : null;
      }
      return null;
    }

    /* Behind the officer's own car, on the side away from the player. */
    function officerCoverSpot(o) {
      const car = o.car;
      if (!car || car.hp <= 0 || car === player.car || distanceBetween(o, car) > 260) return null;
      const away = headingBetween(player, car),
        spot = { x: car.x + Math.cos(away) * 28, y: car.y + Math.sin(away) * 28 };
      return solid(spot.x, spot.y, 8) ? null : spot;
    }
    /**
     * A partner drags a downed officer behind their car: runs over, then walks
     * backwards to cover towing the wounded along the ground. Only a partner
     * without a firing token and within 220 units takes it on; returns true
     * while the drag owns this officer's turn.
     */
    function assignOfficerDrags() {
      for (const hurt of officers) {
        if (!hurt.downed || hurt.hp <= 0 || hurt.draggedBy || hurt.inCover || !hurt.car) continue;
        const partner = (hurt.car.crew || []).find(
          (o) =>
            o !== hurt &&
            o.hp > 0 &&
            !o.downed &&
            !o.dragging &&
            !o.fireToken &&
            !personIncapacitated(o) &&
            distanceBetween(o, hurt) < 220,
        );
        if (!partner || !officerCoverSpot(hurt)) continue;
        partner.dragging = hurt;
        hurt.draggedBy = partner;
        radio('call-backup', partner);
      }
    }
    function updateOfficerDrag(o, deltaSeconds) {
      const hurt = o.dragging,
        cover = hurt && officerCoverSpot(hurt);
      if (!hurt || hurt.hp <= 0 || !cover || wantedStars <= 0) {
        if (hurt) hurt.draggedBy = null;
        o.dragging = null;
        return false;
      }
      o.state = 'drag';
      if (distanceBetween(o, hurt) > 13) {
        footStepTowards(o, hurt, deltaSeconds, 120);
        return true;
      }
      if (distanceBetween(o, cover) < 9) {
        hurt.inCover = true;
        hurt.draggedBy = null;
        o.dragging = null;
        return false;
      }
      footStepTowards(o, cover, deltaSeconds, 42);
      // Walking backwards with the wounded in tow, facing the threat.
      o.a = headingBetween(o, player);
      const behind = headingBetween(cover, o) + Math.PI;
      const x = o.x - Math.cos(behind) * 12,
        y = o.y - Math.sin(behind) * 12;
      if (!solid(x, y, 6)) {
        hurt.x = x;
        hurt.y = y;
      }
      hurt.a = behind + Math.PI;
      hurt.walk = (hurt.walk || 0) + deltaSeconds * 4;
      return true;
    }
    /**
     * ARREST
     * An officer who reaches a player who is not fighting back cuffs them: the
     * bar fills over about two seconds while an officer is within arm's reach;
     * firing, striking, driving off or running clear breaks it.
     *
     * SURRENDER: from one to four stars, a player who stands still (on foot, or
     * in a stopped car on the ground) without firing for a moment is giving up.
     * Officers then hold their fire (so does the helicopter marksman), walk up
     * and make the arrest, exactly as their "YOU ARE UNDER ARREST" calls promise.
     * At three and four stars they want two officers close before they cuff.
     * At five stars the response shoots on sight and only a player close to dead
     * is taken alive; the callouts there never promise an arrest.
     */
    const SURRENDER_SECONDS = 1.5;
    let policeMayArrest = false,
      surrenderAnchor = null,
      surrenderFor = 0;
    function arrestable() {
      const car = player.car,
        // A driver sitting still is pulled out of the car: at one or two stars
        // straight away, up to four once they have clearly given up.
        stopped = car && !isAircraft(car) && !isBoat(car) && Math.abs(car.speed || 0) < 10,
        caughtInCar = stopped && (wantedStars <= 2 || (wantedStars <= 4 && surrenderFor >= SURRENDER_SECONDS));
      return (
        gameMode === 'play' &&
        wantedStars > 0 &&
        !player.godMode &&
        (!car || caughtInCar) &&
        !player.parachute &&
        !player.swimming &&
        !player.coaster &&
        !player.deck &&
        !transitRide &&
        !taxiRide &&
        !playerOnRoof() &&
        player.hp > 0 &&
        !harborPoliceProtected(player.x, player.y, 30)
      );
    }
    /* Standing (or sitting in a stopped car) still, not fighting: giving up. */
    function trackSurrender(deltaSeconds) {
      const fought = Math.min(gameTime - (player.lastShotAt ?? -100), gameTime - (player.lastStrikeAt ?? -100)) < 3,
        afloat = isAircraft(player.car) || (player.car && isBoat(player.car));
      if (!surrenderAnchor || distanceBetween(player, surrenderAnchor) > 6 || fought || afloat || wantedStars <= 0) {
        surrenderAnchor = { x: player.x, y: player.y };
        surrenderFor = 0;
        return;
      }
      surrenderFor += deltaSeconds;
    }
    function playerSurrendering() {
      return surrenderFor >= SURRENDER_SECONDS && Math.ceil(wantedStars) <= 4 && arrestable();
    }
    /* Police (officers and the air marksman) hold fire on a player giving up. */
    function policeHoldFire() {
      return policeMayArrest && playerSurrendering();
    }
    function updateArrest(deltaSeconds) {
      trackSurrender(deltaSeconds);
      const stars = Math.ceil(wantedStars),
        surrendering = playerSurrendering(),
        calm = gameTime - (player.lastShotAt ?? -100) > 2.5 && gameTime - (player.lastStrikeAt ?? -100) > 2.5;
      let cuffing = null,
        near = 0;
      if (arrestable() && calm)
        for (const o of officers) {
          if (o.hp <= 0 || o.downed || personIncapacitated(o) || o.state === 'return' || o.returned) continue;
          const d = combatDistance(o, player);
          if (d < 90) near++;
          if (d < (player.car ? 44 : 32) && (!cuffing || d < combatDistance(cuffing, player))) cuffing = o;
        }
      // Who the police will take alive: anyone at one or two stars; at three and
      // four a player who gives up (or is badly hurt); at five only one close to dead.
      const tierAllows =
        stars <= 2 || (stars <= 4 && (surrendering || near >= 2 || player.hp < 35)) || (stars >= 5 && player.hp < 25);
      // Officers close by move in to cuff rather than shoot (updateOfficers).
      policeMayArrest = arrestable() && calm && tierAllows;
      // At three and four stars the cuffs go on once a second officer covers.
      const allowed = cuffing && policeMayArrest && (stars <= 2 || stars >= 5 || near >= 2 || player.hp < 35);
      if (allowed) {
        arrestProgress = Math.min(1, arrestProgress + deltaSeconds / 2);
        cuffing.state = 'arrest';
        cuffing.a = headingBetween(cuffing, player);
        if (arrestProgress > 0.05 && !cuffing.arrestSaid) {
          cuffing.arrestSaid = true;
          radio(randomChoice(['police-under-arrest', 'police-hands-on-head', 'police-get-down']), cuffing);
        }
        if (arrestProgress >= 1) bust();
      } else {
        arrestProgress = Math.max(0, arrestProgress - deltaSeconds * 1.5);
      }
      const el = getElement('arrestStatus');
      if (el) {
        const show = (arrestProgress > 0.02 || (surrendering && policeMayArrest)) && gameMode === 'play';
        el.classList.toggle('show', show);
        if (show) {
          const label = getElement('arrestLabel');
          if (label)
            label.textContent =
              arrestProgress > 0.02 ? 'BEING ARRESTED · FIGHT OR RUN' : 'SURRENDERING · STAY STILL';
          getElement('arrestFill').style.width = Math.round(arrestProgress * 100) + '%';
        }
      }
    }
    /* What officers shout as they get out: an arrest only when one can happen. */
    function policeChallengeLine() {
      if (Math.ceil(wantedStars) >= 5 && !policeMayArrest) return randomChoice(['police-drop-weapon', 'target-engaged']);
      return randomChoice(['police-hands-on-head', 'police-drop-weapon', 'police-get-down', 'police-challenge', 'police-under-arrest']);
    }
    function policeRespawnPoint() {
      const hq = HELIPADS.find((h) => /POLICE/.test(h.name)) || HELIPADS[0];
      for (let r = 60; r < 900; r += 30)
        for (let i = 0; i < 16; i++) {
          const x = hq.x + Math.cos((i * TAU) / 16) * r,
            y = hq.y + Math.sin((i * TAU) / 16) * r;
          if (groundAt(x, y, 12) && !solid(x, y, 10) && !vehicles.some((c) => pointInCar(x, y, c, 10)))
            return { x, y };
        }
      return PLACES.find((p) => p.kind === 'hospital').door;
    }
    function bust() {
      if (gameMode !== 'play') return;
      const stars = Math.ceil(wantedStars);
      gameMode = 'dead';
      pursuitStats.arrests++;
      arrestProgress = 0;
      document.body?.classList.add('wasted', 'busted');
      announce('YOU HAVE THE RIGHT TO REMAIN SILENT', 'BUSTED', 4.6);
      noise(0.2, 0.3, 500);
      const fine = 100 + stars * 150;
      setTimeout(() => {
        if (gameMode !== 'dead') return;
        document.body?.classList.remove('wasted', 'busted');
        cash = Math.max(0, cash - fine);
        // Confiscated: everything but the pistol, which keeps a couple of clips.
        let seized = 0;
        for (const [i, w] of weapons.entries()) {
          if (!w.owned || w.melee) continue;
          if (i === 0) w.reserve = Math.min(w.reserve, 24);
          else {
            seized += w.reserve;
            w.reserve = 0;
            w.ammo = Math.min(w.ammo, Math.ceil(w.clip / 3));
          }
        }
        player.hp = Math.max(player.hp, 60);
        player.armor = 0;
        player.inv = 3;
        const spot = policeRespawnPoint();
        if (player.car) {
          // Pulled from the car: it stays where it stopped.
          const car = player.car;
          car.vx = car.vy = car.speed = car.av = 0;
          player.car = null;
        }
        teleportPlayer(spot.x, spot.y);
        clearPolice();
        resetOfficerCrews();
        gameMode = 'play';
        const note = 'Released from Police HQ. Fine: $' + fine + (seized ? ' · ammunition confiscated' : '') + '.';
        if (mission) failMission(note);
        else tell(note, 5);
        save();
      }, 4200);
    }

    /**
     * ARMOR (5 stars)
     * The tank rolls with the pursuit, turret tracking the player. It needs a
     * clear line, holds fire while officers are close to the player, warns for
     * two and a half seconds before each round, and reloads slowly.
     */
    function updatePursuitArmor(deltaSeconds) {
      for (const c of vehicles) {
        if (c.lawUnit !== 'army' || c.hp <= 0 || c === player.car || c.stolen) continue;
        const d = distanceBetween(c, player),
          sees = wantedStars > 0 && d < 680 && d > 110 && sameFloor(c, player) && clearSight(c, player),
          // Holds fire while its own people are inside the blast: officers on foot
          // or any police vehicle within reach of the shell.
          officersClose =
            officers.some((o) => o.hp > 0 && distanceBetween(o, player) < 140) ||
            vehicles.some(
              (v) => v !== c && v.hp > 0 && (v.cop || v.lawUnit) && !v.airUnit && distanceBetween(v, player) < 150,
            );
        const want = headingBetween(c, player);
        c.turretA = (c.turretA ?? c.a) + clamp(normalizeAngle(want - (c.turretA ?? c.a)), -deltaSeconds * 1.3, deltaSeconds * 1.3);
        if (!sees || officersClose) {
          c.lockTime = Math.max(0, (c.lockTime || 0) - deltaSeconds);
          continue;
        }
        c.lockTime = (c.lockTime || 0) + deltaSeconds;
        if (c.lockTime > 0.4 && gameTime - armorWarningAt > 6) {
          armorWarningAt = gameTime;
          tell('TANK TARGETING YOU · GET BEHIND COVER', 2.5);
          tone(300, 0.2, 0.18, 'sawtooth', 200);
        }
        if (c.lockTime > 2.5 && Math.abs(normalizeAngle(want - c.turretA)) < 0.08 && tankFire(c, true)) {
          c.lockTime = 0;
          c.cannonReadyAt = gameTime + 6.5;
          pursuitStats.tankShots++;
          const shell = bullets[bullets.length - 1];
          if (shell?.owner === c) {
            shell.faction = 'police';
            shell.blastPower = 1.1;
          }
        }
      }
    }

    /* Being hit: a jolt of the camera, a thud, and a red arc on the side the
       shot came from, so the player can tell where the fire is. */
    let damageArcTimer = null;
    function playerHitFeedback(b) {
      shake = Math.max(shake, 3);
      noise(0.05, 0.14, 180);
      const el = getElement('damageArc'),
        from = b.owner || { x: b.x - (b.vx || 0), y: b.y - (b.vy || 0) };
      if (!el) return;
      const a = headingBetween(player, from);
      el.style.transform = 'translate(-50%, -50%) rotate(' + ((a * 180) / Math.PI + 90).toFixed(1) + 'deg)';
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(damageArcTimer);
      damageArcTimer = setTimeout(() => el.classList.remove('show'), 700);
    }
    /* A hit on someone: a white cross where they stand, red for a kill, with a
       tick (or a thump for a kill) and HEADSHOT for a precision-rifle one-shot. */
    let hitMarkerTimer = null;
    function playerHitMarker(victim, killed, headshot) {
      const el = getElement('hitMarker');
      if (!el) return;
      const q = city3D
        ? city3D.project(victim.x, victim.y, entityElevation(victim) + 12)
        : {
            x: (victim.x - cameraTarget.x) * canvasScale + viewportWidth / 2,
            y: (victim.y - cameraTarget.y) * canvasScale + viewportHeight / 2,
          };
      el.style.left = q.x.toFixed(0) + 'px';
      el.style.top = q.y.toFixed(0) + 'px';
      el.className = killed ? 'kill' : '';
      el.textContent = headshot ? 'HEADSHOT' : '';
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(hitMarkerTimer);
      hitMarkerTimer = setTimeout(() => el.classList.remove('show'), killed ? 520 : 260);
      if (killed) tone(150, 0.08, 0.13, 'triangle', 90);
      else tone(1700, 0.025, 0.04, 'square');
    }
    /**
     * MARINE UNITS
     * A runner who takes to the water at two stars or more is chased by police
     * launches (one at two stars, two at three, three from four) launched out of
     * sight on open water, and by a helicopter. A launch steers for where the
     * boat will be, feels ahead for the shore and backs off it, rams from three
     * stars, and its crew fires from the deck.
     */
    const MARINE_CAP = [0, 0, 1, 2, 3, 3];
    let marineTimer = 3;
    function playerAtSea() {
      return (!!player.car && isBoat(player.car)) || !!player.swimming;
    }
    function spawnMarineUnit() {
      // Ahead of a boat under way (they come out of a marina in its path),
      // anywhere around a swimmer or a boat lying still.
      const boat = player.car && isBoat(player.car) ? player.car : null,
        speed = boat ? Math.hypot(boat.vx || 0, boat.vy || 0) : 0,
        course = speed > 60 ? Math.atan2(boat.vy, boat.vx) : null;
      for (let tries = 0; tries < 32; tries++) {
        const a = course !== null && tries < 20 ? course + randomBetween(-1, 1) : randomBetween(0, TAU),
          r = randomBetween(520, 980),
          x = player.x + Math.cos(a) * r,
          y = player.y + Math.sin(a) * r;
        if (crowdInView(x, y, 120)) continue;
        const heading = headingBetween({ x, y }, player);
        if (!boatFits({ type: 'speedboat', x, y, a: heading })) continue;
        if (vehicles.some((c) => Math.abs(c.x - x) < 80 && Math.abs(c.y - y) < 80)) continue;
        const c = makeCar('speedboat', x, y, heading, false, '#e4ebf0');
        Object.assign(c, {
          cop: true,
          ai: false,
          occupied: false,
          locked: false,
          pursuitUnit: true,
          dispatched: true,
          lawUnit: 'marine',
          marineUnit: true,
          crewSize: 0,
          shotTimer: 2,
        });
        c.maxhp = c.hp = Math.round(c.hp * 1.4);
        pursuitStats.marine++;
        if (gameTime - lastDispatchLine > 5) dispatchCaption('MARINE UNIT LAUNCHED · SUSPECT ON THE WATER', 'call-backup');
        return c;
      }
      return null;
    }
    function updateMarineUnits(deltaSeconds) {
      const stars = Math.ceil(wantedStars),
        atSea = playerAtSea(),
        cap = atSea ? MARINE_CAP[clamp(stars, 0, 5)] : 0;
      marineTimer -= deltaSeconds;
      if (cap && marineTimer <= 0) {
        marineTimer = 5;
        const live = vehicles.filter((c) => c.marineUnit && c.hp > 0).length;
        if (live < cap) spawnMarineUnit();
      }
      for (const c of vehicles) {
        if (!c.marineUnit || c.hp <= 0 || c === player.car || c.stolen) continue;
        c.shotTimer = (c.shotTimer || 0) - deltaSeconds;
        if (!c.seesPlayer || c.shotTimer > 0 || stars < 2) continue;
        const d = combatDistance(c, player);
        if (d > 330) continue;
        c.shotTimer = randomBetween(1.1, 1.6);
        const speed = Math.hypot(player.car?.vx || 0, player.car?.vy || 0),
          chance = policeTier().accuracy * clamp(1.2 - d / 420, 0.4, 1) * clamp(1 - speed / 450, 0.4, 1);
        let a = headingBetween(c, player);
        if (seededRandom() > chance) a += (seededRandom() < 0.5 ? -1 : 1) * randomBetween(0.07, 0.15);
        const origin = { x: c.x + Math.cos(a) * 24, y: c.y + Math.sin(a) * 24, altitude: entityElevation(c) };
        bullets.push({
          ...origin,
          ...shotVelocity(origin, player, 700, a),
          life: 0.8,
          dmg: 18,
          playerDmg: 5.5,
          enemy: true,
          faction: 'police',
          owner: c,
          target: player,
        });
        pursuitStats.marineShots++;
        playSample('automatic', 0.26, 1, c);
        if (city3D) city3D.fire(origin.x, origin.y, a, false, origin.altitude);
      }
    }
    /* Throttle and helm for a police launch (boatControl, physics.js). */
    function marineBoatInput(c, along) {
      if (physicsClock < (c.helmAt || 0) && c.helm) return c.helm;
      c.helmAt = physicsClock + 0.1;
      const quarry = player.car && isBoat(player.car) ? player.car : player,
        d = distanceBetween(c, quarry),
        seen = c.seesPlayer || d < 260,
        base = seen ? quarry : lastSeen || quarry,
        t = clamp(d / 300, 0, 1.2),
        ram = Math.ceil(wantedStars) >= 3;
      let target = seen ? { x: base.x + (quarry.vx || 0) * t, y: base.y + (quarry.vy || 0) * t } : base;
      // Two stars: come alongside, 70 units off the beam, and let the deck crew
      // do the work. From three stars the launch rams.
      if (seen && !ram && d < 240) {
        const qa = Math.atan2(quarry.vy || 0, quarry.vx || 0) || quarry.a || 0,
          side = (c.x - quarry.x) * -Math.sin(qa) + (c.y - quarry.y) * Math.cos(qa) >= 0 ? 1 : -1;
        target = {
          x: quarry.x + (quarry.vx || 0) * 0.4 - Math.sin(qa) * side * 70,
          y: quarry.y + (quarry.vy || 0) * 0.4 + Math.cos(qa) * side * 70,
        };
      }
      let da = normalizeAngle(headingBetween(c, target) - c.a);
      // Feel ahead for the shore: turn toward whichever side is open water.
      const ahead = (angle, dist) => boatFits(c, c.x + Math.cos(c.a + angle) * dist, c.y + Math.sin(c.a + angle) * dist, c.a + angle);
      const reach = clamp(Math.abs(along) * 0.6, 40, 140);
      let slow = false;
      if (!ahead(0, reach)) {
        const left = ahead(-0.6, reach * 0.8),
          right = ahead(0.6, reach * 0.8);
        da = left && !right ? -1 : right && !left ? 1 : da > 0 ? 1 : -1;
        slow = true;
      }
      // Pinned against a quay: back off with the helm over.
      if (Math.abs(along) < 10 && d > 60) c.pinned = (c.pinned || 0) + 0.1;
      else c.pinned = 0;
      if (c.pinned > 1.5) c.reverseUntil = physicsClock + 1.2;
      const reversing = physicsClock < (c.reverseUntil || 0),
        quarrySpeed = Math.hypot(quarry.vx || 0, quarry.vy || 0),
        // Alongside at two stars: hold the runner's speed rather than overrun.
        overrun = !ram && seen && d < 240 && along > quarrySpeed + 25;
      c.helm = {
        up: !reversing && Math.abs(da) < 1.5 && !overrun && !(slow && Math.abs(along) > 120),
        down: reversing || (slow && Math.abs(along) > 120),
        turn: Math.abs(da) < 0.06 ? 0 : clamp(da * 2, -1, 1) * (reversing ? -1 : 1),
      };
      return c.helm;
    }
    /* The per-frame pursuit update (called from updateWanted). */
    function updatePursuit(deltaSeconds) {
      player.carStoppedFor =
        player.car && !isAircraft(player.car) && Math.abs(player.car.speed || 0) < 18
          ? (player.carStoppedFor || 0) + deltaSeconds
          : 0;
      recyclePursuitUnits(deltaSeconds);
      updatePursuitArmor(deltaSeconds);
      updateMarineUnits(deltaSeconds);
      updateArrest(deltaSeconds);
    }
    function policeSearchRadius(stars = wantedStars) {
      return 300 + Math.ceil(clamp(stars, 0, 5)) * 120;
    }
    function pursuitSearchSeconds(stars) {
      return PURSUIT_SEARCH_SECONDS[clamp(Math.ceil(stars), 0, 5)];
    }

    /* The radar: while the police search, the area they are combing and the way
       each unit is looking. */
    function drawPoliceSearch(drawingContext, scale) {
      if (wantedStars <= 0 || !lastSeen) return;
      const r = policeSearchRadius();
      drawingContext.save();
      if (searchActive) {
        const pulse = 0.5 + 0.5 * Math.sin(gameTime * 4);
        drawingContext.fillStyle = 'rgba(236, 196, 96, ' + (0.1 + pulse * 0.08).toFixed(3) + ')';
        drawingContext.strokeStyle = 'rgba(240, 206, 120, 0.75)';
        drawingContext.lineWidth = 3 / scale;
        drawingContext.beginPath();
        drawingContext.arc(lastSeen.x, lastSeen.y, r, 0, TAU);
        drawingContext.fill();
        drawingContext.setLineDash([12 / scale, 9 / scale]);
        drawingContext.stroke();
        drawingContext.setLineDash([]);
        // Sight cones: what each searching unit can see.
        drawingContext.fillStyle = 'rgba(255, 110, 100, 0.16)';
        for (const { unit: u, kind } of policeMapUnits()) {
          if (kind === 'air') continue;
          const reach = kind === 'foot' ? 440 : 440;
          if (Math.abs(u.x - player.x) > 1600 || Math.abs(u.y - player.y) > 1600) continue;
          const a = kind === 'foot' ? u.a || 0 : Math.atan2(u.vy || 0, u.vx || 0) || u.a || 0;
          drawingContext.beginPath();
          drawingContext.moveTo(u.x, u.y);
          drawingContext.arc(u.x, u.y, reach * 0.55, a - 0.6, a + 0.6);
          drawingContext.closePath();
          drawingContext.fill();
        }
      }
      drawingContext.restore();
    }

    /* DeadEndCity.policeReport(): the whole response as data. */
    function policeReportData() {
      const round = (v) => Math.round(v);
      const units = vehicles
        .filter((c) => (c.cop || c.lawUnit || c.airUnit) && c !== player.car)
        .map((c) => ({
          id: c.id,
          kind: c.airUnit ? 'air' : pursuitUnitKind(c) || c.type,
          hp: round(c.hp),
          d: round(distanceBetween(c, player)),
          speed: round(c.speed || 0),
          mode: c.airUnit ? c.airState : c.blockade ? 'roadblock' : c.crewDeployed ? 'deployed' : c.pursuitPlan?.mode || 'route',
          sees: !!c.seesPlayer,
          reversals: c.reversals || 0,
          crew: (c.crew || []).filter((o) => o.hp > 0).length,
        }));
      const foot = officers.map((o) => ({
        unit: o.unit || 'patrol',
        hp: round(o.hp),
        vest: round(o.vest || 0),
        d: round(distanceBetween(o, player)),
        state: o.state,
      }));
      return {
        stars: Math.ceil(wantedStars),
        heat: Math.round(wantedHeat * 10) / 10,
        nextStarAt: HEAT_STARS[Math.min(5, Math.ceil(wantedStars) + 1)] ?? null,
        unreported: Math.round(unreportedHeat * 10) / 10,
        crimes: crimeLog.slice(),
        rampage: { ...rampage },
        search: { active: searchActive, remaining: Math.round(searchRemaining * 10) / 10, lastSeen: lastSeen ? { x: round(lastSeen.x), y: round(lastSeen.y) } : null },
        seen: wantedStars > 0 && policeCanSeePlayer(),
        arrest: Math.round(arrestProgress * 100) / 100,
        pursuit: { ...pursuitStats },
        wounds: woundReport(),
        marine: vehicles
          .filter((c) => c.marineUnit)
          .map((c) => ({ hp: Math.round(c.hp), d: Math.round(distanceBetween(c, player)), speed: Math.round(Math.hypot(c.vx || 0, c.vy || 0)), sees: !!c.seesPlayer })),
        tier: wantedStars > 0 ? policeTier() : null,
        counts: {
          patrol: units.filter((u) => u.kind === 'patrol' && u.hp > 0).length,
          swat: units.filter((u) => u.kind === 'swat' && u.hp > 0).length,
          fed: units.filter((u) => u.kind === 'fed' && u.hp > 0).length,
          army: units.filter((u) => u.kind === 'army' && u.hp > 0).length,
          air: units.filter((u) => u.kind === 'air' && u.hp > 0 && u.mode !== 'retreating').length,
          officers: foot.filter((o) => o.hp > 0).length,
          roadblocks: roadblocks.length,
        },
        units,
        foot,
        playerHp: Math.ceil(player.hp),
        mode: gameMode,
      };
    }
    // END SUBSYSTEM: src/pursuit.js
