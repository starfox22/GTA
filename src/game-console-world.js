      // What the vehicle under the player is actually doing.
      ride: () => ({
        type: player.car ? player.car.type : null,
        speed: player.car ? Math.round((player.car.speed || 0) * 10) / 10 : 0,
        vx: player.car ? Math.round((player.car.vx || 0) * 10) / 10 : 0,
        vy: player.car ? Math.round((player.car.vy || 0) * 10) / 10 : 0,
        cadence: Math.round(pedalCadence() * 100) / 100,
        effort: Math.round(pedalEffort() * 100) / 100,
        // Aircraft: absolute altitude in map units (0 on the ground).
        altitude: player.car ? Math.round(player.car.altitude || 0) : 0,
        // Tanks: hull and turret headings (degrees), where the gunner is aiming,
        // the traverse rate (deg/s) and the ammunition (armor.js).
        ...(player.car?.type === 'tank'
          ? {
              hull: Math.round((player.car.a * 180) / Math.PI),
              turret: Math.round(((player.car.turretA ?? player.car.a) * 180) / Math.PI),
              aim: Math.round(((player.car.turretAim ?? player.car.a) * 180) / Math.PI),
              traverse: Math.round(((player.car.turretRate || 0) * 180) / Math.PI),
              arms: { ...tankArms(player.car), reload: Math.max(0, Math.round(((player.car.cannonReadyAt || 0) - gameTime) * 10) / 10) },
            }
          : {}),
      }),
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
      // South Coast Cycle (cycles.js BIKE SHARE): every station, its docks and
      // bikes, the prompt in reach, what renting and docking have cost.
      bikeShare: () => bikeShareReport(),
      // Stand at bike-share station `id` (from bikeShare().list), facing its bikes.
      bikeStation(id = 0) {
        return goToBikeStation(id);
      },
      // The speed box as shown: mode, label, figure and unit line (hud.js SPEED BOX).
      speedBox: () => (updateSpeedBox(), {
        active: getElement('vehicleStats').classList.contains('active'),
        mode: getElement('vehicleStats').dataset.mode,
        label: getElement('vehicleName').textContent,
        speed: getElement('speed').textContent,
        unit: getElement('speedUnit').textContent,
        units: hudState.units,
      }),
      // Rack a bicycle beside the player.
      bike(headingRadians = player.a) {
        spawnClearCar(
          'bicycle',
          player.x + Math.cos(headingRadians) * 30,
          player.y + Math.sin(headingRadians) * 30,
          headingRadians,
          false,
        );
        return this.status();
      },
      // Spawn a vehicle of any VEHICLE_DEFINITIONS type beside the player and put
      // them at the controls. Aircraft can be lifted straight to an altitude in
      // metres above the ground so tests can look at the flight view. An optional
      // heading (radians, 0 = east) points it down a chosen road. A plane takes
      // an optional airframe ('courier' default, 'jet', 'airliner').
      drive(type = 'sedan', altitudeMeters = 0, headingRadians = player.a, airframe) {
        if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
        if (airframe && (type !== 'plane' || !AIRFRAME_SPECS[airframe])) throw Error('Unknown airframe ' + airframe);
        if (player.car) exitCar();
        let car = null;
        if (['speedboat', 'workboat', 'jetski'].includes(type)) {
          // Boats go on the nearest open water (spawnClearCar wants dry land).
          for (let r = 0; r < 600 && !car; r += 20)
            for (let i = 0; i < (r ? 24 : 1) && !car; i++) {
              const x = player.x + Math.cos((i * TAU) / 24) * r,
                y = player.y + Math.sin((i * TAU) / 24) * r;
              if (boatFits({ type, x, y, a: headingRadians })) car = makeCar(type, x, y, headingRadians, false);
            }
          if (!car) throw Error('No open water near the player for ' + type);
          player.swimming = false;
        } else car = spawnClearCar(type, player.x + 60, player.y, headingRadians, false);
        if (airframe) {
          car.airframe = airframe;
          car.hp = car.maxhp = vehicleSpec(car).hp;
        }
        car.authorized = true;
        enterVehicle(car);
        if (altitudeMeters > 0 && isAircraft(car)) {
          car.altitude = terrainHeight(car.x, car.y) + altitudeMeters * UNITS_PER_METRE;
          if (car.type === 'plane') {
            car.vx = Math.cos(car.a) * 295 * KMH;
            car.vy = Math.sin(car.a) * 295 * KMH;
            // Cruising: gear up, cruise power.
            car.gearDown = false;
            car.gearPos = 0;
            car.throttle = car.power = 0.75;
          }
        }
        return this.status();
      },
      // Runways, their thresholds, lights and PAPI indications, the piers and
      // where every plane is (airfields.js).
      airfields: () => airfieldReport(),
      // The player and the water: swimming, wading, stamina, shore type and the
      // nearest way out (see water.js).
      swim: () => swimStatus(),
      // Every ladder out of the sea: foot in the water, top on the quay.
      ladders: () =>
        ladderList().map((l) => ({
          kind: l.kind,
          x: Math.round(l.x),
          y: Math.round(l.y),
          top: { x: Math.round(l.top.x), y: Math.round(l.top.y) },
        })),
      // Palm Keys Beach: how busy it is and what everyone is doing (beach.js).
      beach: () => beachStatus(),
      // Sea life (sealife.js): dolphin pods, gull flocks, the shark, the encounter
      // (phase, interest, cooldown, way out, outcomes), the beach alarm, the log
      // and the renderer's counts and cost.
      sealife: () => sealifeReport(),
      // Start the shark encounter (puts the player in deep water off Palm Keys
      // Beach first if needed); stage 'approach' (default), 'circle', 'breach',
      // 'fin' (the fin up nearby, no encounter) or 'beach' (a pass along the buoys).
      sharkAttack: (stage) => sharkAttackConsole(stage),
      // A pod of dolphins near the player (or at x, y) that starts leaping.
      spawnDolphins: (count, x, y, leap) => spawnDolphinsConsole(count, x, y, leap),
      // The Marea pool (clubpool.js): the water, the player's phase in it (dive,
      // swim, out), whether SWIM / GET OUT are offered, breath, club swimmers.
      clubPool: () => clubPoolReport(),
      // Stand on the deck at the pool's south edge (then interact() dives in).
      clubPoolEdge: () => clubPoolEdge(),
      // Club conversations (clubtalk.js): the script count by personality, the one
      // running (lines, pose), the candidate and stand timer, the bubbles on screen.
      clubTalk: () => clubTalkReport(),
      // Stand beside the nearest club-goer who can talk (standing still starts it).
      clubTalkApproach: () => clubTalkApproach(),
      // Beach volleyball (beachvolley.js): court, phase, score, ball, players, the
      // player in the match, rallies and the recent log.
      volley: () => volleyReport(),
      // Step onto the court on a side (0 west, 1 east) and join the match.
      volleyJoin: (team = 0) => volleyJoinConsole(team),
      // Lob the ball from across the net to the player in the match.
      volleyLob: () => volleyLobToPlayer(),
      // The court against the beach plan: anything laid on it or its clear zone.
      volleyCourtCheck: () => volleyCourtCheck(),
      // Marea Beach Club: phase, levels, who is where, the queue and the door,
      // the music (beachclub.js). `beachClub('trouble')` raises gunfire on its
      // dance floor as if someone fired there, for tests of the evacuation.
      beachClub(action) {
        if (action === 'trouble') {
          const p = mareaPoint(205, 140);
          notifyViolence(p, 'gunfire', null);
        }
        return beachClubReport();
      },
      // Rooftop helipads, the roof the player stands on and the roof under the
      // player's helicopter (rooftops.js); with a map point, that roof and its plant.
      rooftops: (x, y) => ({
        ...(x !== undefined
          ? (() => {
              const b = buildingRoofAt(x, y);
              return {
                roofAt: b
                  ? {
                      x: b.x, y: b.y, w: b.w, h: b.h, height: Math.round(b.height), landable: roofLandable(b), archetype: b.archetype || null,
                      keepOuts: (b.roofKeepOuts || []).map((k) => [Math.round(k.x), Math.round(k.y), Math.round(k.hx * 2), Math.round(k.hy * 2)]),
                    }
                  : null,
              };
            })()
          : {}),
        helipads: roofHelipads.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(p.r), z: Math.round(p.z) })),
        onRoof: player.buildingRoof
          ? { x: player.buildingRoof.x, y: player.buildingRoof.y, height: Math.round(player.buildingRoof.height) }
          : null,
        helicopter:
          player.car?.type === 'helicopter'
            ? {
                altitude: Math.round(player.car.altitude),
                roof: player.car.roofSite ? Math.round(player.car.roofSite.height) : null,
                clearance: Math.round(aircraftClearance(player.car)),
              }
            : null,
      }),
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
      // Fort Sentinel security: alert, lockdown, gate pieces, garrison and vehicles.
      military: () => militaryReport(),
      // The Palm Sound drawbridge (drawbridge.js): 'status', 'open' (start an opening
      // now), 'close' (bring it down, lift the arms), 'hold' with degrees (arms down,
      // leaves held there until 'close'), 'snap' with degrees (leaves there at once).
      drawbridge: (action, degrees) => drawbridgeCommand(action, degrees),
      // Put `count` traffic cars on each approach, heading onto the drawbridge.
      drawbridgeTraffic: (count) => drawbridgeSpawnTraffic(count),
      // Stand at a drawbridge viewpoint ('channel', 'west', 'east', 'north', 'south',
      // 'tower', 'overview', 'pit') at a zoom; returns the point and the bridge's state.
      drawbridgeLook(spot = 'channel', zoom) {
        const p = drawbridgeViewpoint(spot);
        this.look(p.x, p.y, zoom);
        return { x: Math.round(p.x), y: Math.round(p.y), ...drawbridgeReport() };
      },
      // The plan as data, for layout audits: coast, streets, rail, footprints and
      // every static collider in map units. A test renders it as a debug map and
      // checks for overlaps (a road through a helipad, a viaduct over a berth).
      layout: () => ({
        land: LAND_REGIONS.map((r) => ({ id: r.id, polygon: r.polygon })),
        lakes: COUNTY_LAKES.map((r) => r.polygon),
        beach: BEACH,
        peaks: COUNTY_PEAKS.map((p) => ({ x: p.x, y: p.y, r: p.r })),
        streets: cityStreets().map((r) => ({ points: r.points, width: r.width })),
        boulevards: [...BOULEVARDS, ...SERVICE_ROADS].map((r) => ({ name: r.name, points: r.points, width: r.width })),
        countyRoads: COUNTY_ROADS.map((r) => ({ name: r.name, points: r.points, width: r.width, bridge: !!r.bridge })),
        bridges: BRIDGES.map((b) => ({ id: b.id, name: b.name, link: b.link, a: b.a, b: b.b, width: b.width, deck: b.deck, style: b.style, pylons: bridgePylons(b), footings: bridgeFootings(b), channels: bridgeStructure(b).channels.map(([from, to]) => [bridgePoint(b, from), bridgePoint(b, to)]) })),
        reserved: { beachClub: BEACH_CLUB_PLOT, themePark: THEME_PARK_RESERVE },
        rail: RAIL_LINES.map((l) => ({ id: l.id, name: l.name, color: l.color, points: l.points })),
        railDecks: railDecks(),
        railPiers: railPiers.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
        stations: RAIL_STATIONS.map((s) => ({ name: s.name, x: s.x, y: s.y, entry: s.entry, lift: s.lift })),
        buildings: buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, height: Math.round(b.height) })),
        helipads: HELIPADS,
        trees: trees.map((t) => [Math.round(t.x), Math.round(t.y), t.r]),
        lamps: lamps.map((l) => [Math.round(l.x), Math.round(l.y)]),
        benches: benchSpots().map((b) => [Math.round(b.x), Math.round(b.y)]),
        // Knockable street furniture as placed by the renderer (empty in 2D) and
        // the registered foot obstacles (circles r, or boxes hx/hy turned by a).
        props: streetProps.map((p) => ({ kind: p.kind, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, hx: p.hx, hy: p.hy, a: p.a })),
        footObstacles: addFootTrees() || [...new Set([...footObstacleGrid.values()].flat())].map((o) =>
          o.r !== undefined ? { x: o.x, y: o.y, r: o.r } : { x: o.x, y: o.y, hx: o.hx, hy: o.hy, a: Math.atan2(o.s, o.c) },
        ),
        streetEnds: streetEndPlan().map((e) => ({ x: e.p.x, y: e.p.y, a: e.a, width: e.width, kind: e.kind })),
        crosswalks: cityCrosswalks(),
        doors: PLACES.filter((p) => p.door).map((p) => ({ name: p.name, x: p.door.x, y: p.door.y })),
        docks: DOCKS.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, boatX: d.boatX, boatY: d.boatY })),
        parks: CITY_PARKS.map((p) => ({ name: p.name, x: p.x, y: p.y, w: p.w, h: p.h })),
        places: PLACES.filter((p) => p.w).map((p) => ({ name: p.name, x: p.x, y: p.y, w: p.w, h: p.h })),
        ships: [
          { name: 'harbor ship', x: HARBOR.ship.x, y: HARBOR.ship.y, hx: HARBOR.ship.w / 2, hy: HARBOR.ship.l / 2, a: 0 },
          ...LINERS.map((s) => ({ name: s.name, ...shipHull(s) })),
        ],
        marina: MARINA,
        statics: staticBodies
          .filter((b) => b.kind !== 'coast' && b.kind !== 'building')
          .map((b) => ({ x: b.x, y: b.y, hx: b.hx, hy: b.hy, a: b.a, kind: b.kind })),
      }),
      // Sunset Pier: ride states, the coaster's numbers, shows, guests and an overlap check.
      themePark: () => parkReport(),
      // Monarch Isle: the plan (grid, streets, villas, towers, businesses, marina,
      // garden) and its life (monarch.js, monarch-life.js).
      monarch: () => monarchReport(),
      // Board the Falcon ('coaster') or the Sunset Eye ('wheel') from its platform.
      boardRide(kind = 'coaster') {
        rideAttraction(kind);
        return parkReport().riding;
      },
      // The Falcon riders' scream cues (track position, height, vertical speed, g) and lines; `reset` clears the log.
      coasterVoices: (reset = false) => falconVoicesReport(!!reset),
      // Speech bubbles and height: the view's height over someone on the ground at the view's centre, and their bubble's fade.
      speechView: () => speechViewReport(),
      // Every train on the network: where it is, how fast, and whether it carries the player.
      trains: () =>
        railTrains.map((t) => ({
          x: Math.round(t.x),
          y: Math.round(t.y),
          speed: Math.round(t.speed),
          passenger: !!t.passenger,
          target: t.passenger ? transitRide?.target.name : null,
        })),
      // Run the railway forward by `seconds` in 1/30 s steps: a ride takes minutes
      // of game time, which headless test browsers render at a few frames a second.
      advanceTrains(seconds = 10) {
        for (let t = 0; t < seconds; t += 1 / 30) updateTransit(1 / 30);
        return this.trains();
      },
      // The sailing liner: where she is, her leg of the voyage, speed (units/s
      // and knots) and heading, and who is aboard.
      liners: () => {
        const ship = sailingLiner(),
          leg = LINER_VOYAGE[linerVoyage.leg];
        return {
          name: ship.name,
          x: Math.round(ship.x),
          y: Math.round(ship.y),
          heading: Math.round((((ship.a * 180) / Math.PI) % 360 + 360) % 360),
          leg: linerVoyage.leg,
          kind: leg.kind,
          along: Math.round(linerVoyage.s),
          legLength: leg.kind === 'call' ? leg.seconds : Math.round(leg.length || 0),
          speed: Math.round(ship.speed * 10) / 10,
          knots: Math.round((Math.abs(ship.speed) / KNOTS) * 10) / 10,
          playerAboard: player.deck === ship,
          passengers: (ship.passengers || []).length,
        };
      },
      // Run only the liner's voyage forward by `seconds` (1/30 s steps).
      advanceLiner(seconds = 10) {
        for (let t = 0; t < seconds; t += 1 / 30) sailLiner(1 / 30);
        return this.liners();
      },
      // Sweep the liner's hull down the whole voyage: land, bridges, jetties, ships.
      linerVoyageCheck: (step = 24) => linerVoyageCheck(step),
      // Named places the tests can visit: every PLACES entry plus the landmarks.
      places: () => PLACES.map((p) => ({ name: p.name, x: Math.round(p.x), y: Math.round(p.y) })),
      // GPS: set a map waypoint and report the route the navigation graph finds
      // from the player (status, road length, the islands it passes through).
      route(x, y) {
        setWaypoint(x, y);
        let length = 0;
        for (let i = 1; i < userRoute.length; i++) length += distanceBetween(userRoute[i - 1], userRoute[i]);
        return {
          status: routeStatus,
          points: userRoute.length,
          length: Math.round(length),
          bridges: [...new Set(userRoute.map((p) => BRIDGES.find((b) => segmentDistance(p.x, p.y, b.a, b.b) <= b.width / 2)?.id).filter(Boolean))],
          first: userRoute[0] || null,
          last: userRoute.at(-1) || null,
        };
      },
      // Board a City Rail train at station `from` bound for `to` (names, as
      // RAIL_STATIONS spells them, or indices), as the platform menu would.
      boardTrain(from = 'CRUISE TERMINAL', to = 'SOUTHPORT AIRPORT') {
        const find = (k) => (typeof k === 'number' ? RAIL_STATIONS[k] : RAIL_STATIONS.find((s) => s.name === String(k).toUpperCase()));
        const a = find(from),
          b = find(to);
        if (!a || !b || a === b) throw Error('Unknown or identical stations');
        teleportPlayer(a.entry.x, a.entry.y);
        openTransit(a);
        return { boarded: boardTransit(b), from: a.name, to: b.name, trains: this.trains() };
      },
      // Skip the current passenger ride (cab, train, the sailing liner) as the
      // skip key would: the fade starts, and the jump happens at full black
      // (simulate(2.5) runs it through). Returns rideSkip().
      skipRide() {
        rideSkipKey('skip');
        return rideSkipReport();
      },
      // On a train: move the skip to the next choice of stop (the skipStop key).
      skipStop() {
        rideSkipKey('cycle');
        return rideSkipReport();
      },
      // The skip on offer (prompt, allowed or why not, destination, fare, ride
      // seconds, the train's choices), the fade in progress, and the last skip:
      // ride seconds, game clock before / after, cash before / after, from / to.
      rideSkip: () => rideSkipReport(),
      // Set the cash in the player's pocket (fares, shops); returns it.
      setCash(dollars = 1000) {
        cash = clamp(Math.round(Number(dollars) || 0), 0, 99999999);
        return cash;
      },
      // Put a cab at the kerb and ride it somewhere, without hunting for one.
      cab(x, y) {
        const car = spawnClearCar('taxi', player.x + 44, player.y, 0, true);
        assignDriver(car);
        if (x === undefined) return this.status();
        startTaxiRide(car, { x, y });
        return { riding: !!taxiRide, fare: taxiRide?.fare ?? null, stops: taxiRide?.route.length ?? 0 };
      },
      // The chokepoint catalogue and the state of the cordon.
      containment: () => ({
        sites: roadblockSites().length,
        budget: containmentBudget(),
        active: roadblocks.length,
        nextPlanIn: Math.round(Math.max(0, containmentTimer) * 10) / 10,
      }),
      // Where the police have cut the map right now.
      roadblocks: () =>
        roadblocks.map((b) => ({
          name: b.site.name,
          x: Math.round(b.x),
          y: Math.round(b.y),
          cars: b.cars.filter((c) => c.hp > 0).length,
          officers: b.crew.filter((o) => o.hp > 0).length,
          // Cruisers still anchored; a heavy rammer knocks them loose.
          braced: b.cars.filter((c) => c.hp > 0 && c.braced).length,
          conesKnocked: b.cones.filter((c) => c.tipped).length,
          breached: !!b.breached,
        })),
      // Build a police cut at chokepoint `siteIndex` (see containment().sites),
      // or at the one nearest the player, and describe it. Dispatch's next re-plan
      // is held off for a minute so the cut survives a clean wanted level.
      roadblock(siteIndex) {
        containmentTimer = 60;
        const sites = roadblockSites(),
          site =
            sites[siteIndex] ||
            sites.reduce((best, s) => (distanceBetween(s, player) < distanceBetween(best, player) ? s : best));
        const block = roadblockAt(site) || buildRoadblock(site);
        return block
          ? { name: site.name, x: site.x, y: site.y, axis: site.axis, cars: block.cars.length }
          : null;
      },
      // Take down every police cut at once (repeatable ram tests).
      clearRoadblocks() {
        clearRoadblocks();
        return roadblocks.length;
      },
      // Set the current vehicle moving along its heading at `metersPerSecond`.
      launch(metersPerSecond = 20) {
        const c = player.car;
        if (!c) return null;
        const speed = metersPerSecond * UNITS_PER_METRE;
        c.vx = Math.cos(c.a) * speed;
        c.vy = Math.sin(c.a) * speed;
        c.speed = speed;
        return this.ride();
      },
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
      // Inspection only: zoom the camera in past the player's limit to look at
      // people up close. Anything above 1.5 is not reachable in play.
      closeUp(zoom = 4) {
        worldZoom = worldZoomTarget = clamp(zoom, 0.14, 24);
        return worldZoom;
      },
      // Line up one pedestrian per pose in front of the player (for screenshots);
      // `role` dresses them all alike, e.g. 'commuter'.
      poseGallery: (role) => poseGallery(role),
      // One of each kind of character in a row in front of the player, facing the
      // camera (crowd.js CHARACTER LINEUP): stance 'stand', 'walk' or 'aim'.
      characterLineup: (stance, spacing) => characterLineup(stance, spacing),
      // Inspection only: look at the street from bearing `yaw` (0 = from the south,
      // as the game camera does; 90 = from the east) and `pitch` degrees above the
      // horizon, aimed `lift` units up; no arguments restores the game camera.
      inspectView: (yaw, pitch, lift) => city3D?.inspectView?.(yaw, pitch, lift),
      // What the people cost in the last frame (crowd3d.js): parts, draw calls, instances, triangles.
      crowdStats: (byPart) => city3D?.crowdStats?.(byPart) || null,
      vegetation: () => city3D?.vegetation?.() ?? null,
      treeLineup: (x = player.x, y = player.y, spacing, lod, perRow) => city3D?.treeLineup?.(x, y, spacing, lod, perRow) ?? null,
      // Pack the people `frames` times back to back: the rig's CPU cost per frame in ms.
      crowdBenchmark: (frames) => city3D?.crowdBenchmark?.(frames) ?? null,
      // Raise an incident at a map point without firing: gunfire, explosion, crash.
      alarm(kind = 'gunfire', x = player.x, y = player.y) {
        const inc = crowdAlarm(kind, { x, y }, kind === 'crash' ? null : player, 1.4);
        return inc ? { kind: inc.kind, x: Math.round(inc.x), y: Math.round(inc.y) } : null;
      },
      // Where the player stands aboard the superyacht (null when not aboard), and a
      // shortcut onto her swim platform so tests can go straight to the decks.
      yacht: () => superyachtDeckState(),
      boardYacht() {
        teleportPlayer(SUPERYACHT.board.x, SUPERYACHT.board.y);
        boardLiner(SUPERYACHT);
        return superyachtDeckState();
      },
      // Walk the player on foot `distance` units toward `heading` (radians, 0 is
      // east) in small steps through the normal collision code. Headless frames
      // are far too slow to walk anywhere by holding a key.
      // Barrier audit (tools/layout-audit.mjs): every visible barrier line as data
      // -- the sea railing runs, the street-end guardrails, gate piers and
      // railings -- and how many foot obstacles are registered.
      barriers() {
        const rails = [];
        for (const spot of promenadeSpots())
          for (const [a, b] of spot.rail || []) {
            const { cx, cy, ux, uy } = spot.railLine;
            rails.push({ x0: cx + ux * a, y0: cy + uy * a, x1: cx + ux * b, y1: cy + uy * b, nx: spot.nx, ny: spot.ny });
          }
        addFootTrees();
        let obstacles = 0;
        for (const list of footObstacleGrid.values()) obstacles += list.length;
        return { rails, streetEnds: streetEndSolids(), streetEndPlan: streetEndPlan(), footObstacleCells: footObstacleGrid.size, footObstacleEntries: obstacles };
      },
      // solid() (and, with `foot`, the player's foot obstacles) at many points at once.
      solidAt(points, r = 1, foot = false) {
        return points.map(([x, y]) => solid(x, y, r) || (foot && footObstacleBlocked(x, y, r)));
      },
      walk(heading, distance = 50) {
        for (let i = 0; i < Math.ceil(distance / 2); i++) {
          moveBody(player, Math.cos(heading) * 2, Math.sin(heading) * 2, 8);
          updateMarinaFooting();
        }
        player.a = heading;
        return { x: Math.round(player.x), y: Math.round(player.y), yacht: superyachtDeckState() };
      },
