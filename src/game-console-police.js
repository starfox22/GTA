    // BEGIN SUBSYSTEM: src/game-console-police.js — DeadEndCity console, police: wanted, policeReport, shotLog, cover, Apache, arm, roadblocks, military
    // Police and combat: wanted level, the police report and shot log, overhead cover,
    // the Apache, weapons (arm), roadblocks and containment, Fort Sentinel.
    addConsoleMethods('police', {
      // Set the wanted level directly. Useful for looking at containment and air
      // support without having to earn them.
      wanted(stars = 5) {
        const n = clamp(Math.round(stars), 0, 5);
        // Clearing reports the escape exactly like losing them in play would.
        if (n <= 0) clearPolice(true);
        else {
          setWantedLevel(n);
          searchActive = false;
          searchRemaining = policeSearchSeconds(n);
          lastSeen = {
            x: player.x,
            y: player.y,
          };
        }
        return this.status();
      },
      // The police response as data: stars, heat and the next star's threshold,
      // the incident's body count, the search, arrest progress, the tier's
      // allowances and every unit (patrol, swat, fed, army, air) and officer.
      policeReport: () => policeReportData(),
      // Hostile rounds aimed at the player since the last reset, by source, with
      // the shooter's distance and whether it was on screen (combat-rules.js SHOT
      // LOG); `reset` clears the log after reading it.
      shotLog: (reset = false) => shotLogReport(reset),
      // Fort Sentinel's Apache (apache.js): position, pad, ammunition, turret, aim
      // and a clearance check of its parked footprint.
      apache: () => apacheReport(),
      // Overhead cover (air-cover.js OVERHEAD COVER) at a map point (default: the
      // player): the cover over it or null, whether the player is hidden from the
      // police helicopter, and how many covers of each kind are registered (with
      // one example point each, for tests).
      cover(x = player.x, y = player.y) {
        const elevation = x === player.x && y === player.y ? entityElevation(player.car || player) : terrainHeight(x, y),
          c = overheadCover(x, y, elevation),
          kinds = {};
        for (const k of overheadCovers) {
          const entry = (kinds[k.kind] ??= { count: 0, example: [Math.round(k.x), Math.round(k.y)] });
          entry.count++;
        }
        return {
          x: Math.round(x),
          y: Math.round(y),
          cover: c ? { kind: c.kind, bottom: Math.round(c.bottom), top: Math.round(c.top) } : null,
          // Where the helicopter's searchlight lands (air-cover.js overheadCoverHeight).
          roofHeight: overheadCoverHeight(x, y, elevation),
          playerHiddenFromAir: hiddenFromAir(player.car || player),
          air: airPursuitStatus(),
          registered: kinds,
        };
      },
      // Put a fresh Apache back on its pad (the old one, wrecked or not, is removed
      // unless the player is aboard). Returns apache().
      apacheReset() {
        for (let i = vehicles.length - 1; i >= 0; i--)
          if (isApache(vehicles[i]) && vehicles[i] !== player.car) vehicles.splice(i, 1);
        if (!isApache(player.car)) parkApache();
        return apacheReport();
      },
      // Fix the Apache's aim point on the ground (map x, y) as the mouse would;
      // no arguments hands the aim back to the mouse. Returns apache().
      apacheAim(x, y) {
        apacheAimOverride = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
        return apacheReport();
      },
      // Combat tests: own weapon `index` (0 pistol ... 5 precision rifle) with a
      // full clip and reserve, and select it. Returns its name.
      arm(index = 4) {
        // 6 the knife, 7 no weapon (fists): selected as they are.
        if (index === KNIFE_INDEX || index === FISTS_INDEX) {
          selectedWeaponIndex = index;
          reloadSecondsRemaining = 0;
          drawWeapon();
          return currentWeapon().name;
        }
        const w = weapons[index];
        if (!w) return null;
        w.owned = true;
        w.ammo = w.clip;
        w.reserve = Math.max(w.reserve, w.clip * 8);
        selectedWeaponIndex = index;
        reloadSecondsRemaining = 0;
        drawWeapon();
        return w.name;
      },
      // Fort Sentinel security: alert, lockdown, gate pieces, garrison and vehicles.
      military: () => militaryReport(),
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
      // Witnesses and 911 (witnesses.js): crimes nobody has reported yet, the calls
      // under way (who, about what, how far through), the player's incidents and
      // their witnesses, the response to the last report and running totals.
      witnesses: () => witnessReportData(),
      // A 911 call that got through about (x, y) (witnesses.js reportedCrime): one
      // star, the search on that spot, the first unit sent after `eta` seconds.
      // Returns the response (witnesses().response).
      reportCall(x = player.x, y = player.y, kind = 'gunfire', eta = 1.5) {
        crime(1, { x, y, kind, eta, note: false });
        return witnessReportData().response;
      },
      // A crewed patrol cruiser answering the call from (x, y), pointing `heading`
      // (radians) and already doing `speed` units/s (policeReport shows it by id).
      // Null when the spot, or the road 40 and 80 units ahead, is not clear.
      respondingUnit(x, y, heading = 0, speed = 0) {
        if ([0, 40, 80].some((d) => !canSpawnCar('police', x + Math.cos(heading) * d, y + Math.sin(heading) * d, heading, 4))) return null;
        const c = makeCar('police', x, y, heading, true);
        Object.assign(c, { speed, vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed, routeTime: 0 });
        return { id: c.id, x: Math.round(c.x), y: Math.round(c.y) };
      },
      // Stage a witness test round the player: nobody else within `radius` (people,
      // officers and police vehicles removed, stars, calls and unreported crimes
      // cleared), a victim standing 60 units in front of the player, `count`
      // onlookers 170+ units off to the side facing the victim, and with `police`
      // a crewed patrol car 180 units behind the player. `lookAway` stands them
      // 120 units off facing away (they notice a body, not a quiet killing);
      // `traffic` removes every other road vehicle within `radius` as well.
      // Returns the positions.
      witnessStage(count = 1, police = false, radius = 1100, lookAway = false, isle = false, traffic = false) {
        if (player.car) exitCar();
        clearPolice(false);
        const far = (e) => distanceBetween(e, player) >= radius;
        for (let i = pedestrians.length - 1; i >= 0; i--) if (!far(pedestrians[i])) pedestrians.splice(i, 1);
        for (let i = officers.length - 1; i >= 0; i--) if (!far(officers[i])) officers.splice(i, 1);
        for (let i = vehicles.length - 1; i >= 0; i--) {
          const c = vehicles[i];
          if (c !== player.car && (c.type === 'police' || c.cop || c.lawUnit || c.airUnit || (traffic && !isBoat(c) && !isAircraft(c))) && !far(c)) vehicles.splice(i, 1);
        }
        crowd.incidents.length = 0;
        forgetWitnessedCrimes();
        const a = player.a,
          fx = Math.cos(a),
          fy = Math.sin(a),
          round = (e) => ({ x: Math.round(e.x), y: Math.round(e.y) });
        const person = (x, y, face, walker = false) => {
          const p = { x, y, a: face, dir: face, hp: 30, flee: 0, timer: 999, walk: 0, state: 'idle', stateTime: 900 };
          dressPerson(p, 'casual');
          // `isle`: a Monarch Isle walker, run by its own routine (monarch-life-crowd.js), stopped a while to look.
          if (walker) {
            p.isle = { route: null, stay: 30 };
            dressIsleWalker(p, 'casual');
          }
          p.nerve = 0.6;
          pedestrians.push(p);
          return p;
        };
        const victim = person(player.x + fx * 60, player.y + fy * 60, a + Math.PI),
          onlookers = [];
        for (let i = 0; i < count; i++) {
          const side = i % 2 ? -1 : 1,
            off = (lookAway ? 120 : 170) + Math.floor(i / 2) * 30,
            x = victim.x - fy * off * side,
            y = victim.y + fx * off * side;
          onlookers.push(person(x, y, Math.atan2(victim.y - y, victim.x - x) + (lookAway ? Math.PI : 0), isle));
        }
        let car = null;
        if (police) {
          car = spawnClearCar('police', player.x - fx * 180, player.y - fy * 180, a, true);
          if (car) car.vx = car.vy = car.speed = 0;
        }
        return { player: round(player), victim: round(victim), witnesses: onlookers.map(round), police: car ? round(car) : null };
      },
      // Carjack tests: a stopped, unlocked traffic car with a driver at the wheel
      // right beside the player (interact() then hauls the driver out); `mood` is
      // how the driver takes it (carjack.js: flee, angry, defiant, plead, witness).
      carjackTarget(type = 'sedan', mood = 'flee') {
        if (player.car) exitCar();
        const a = player.a + Math.PI / 2,
          c = spawnClearCar(type, player.x + Math.cos(a) * 22, player.y + Math.sin(a) * 22, player.a, true);
        if (!c) return null;
        Object.assign(c, { occupied: true, locked: false, driverMood: mood, vx: 0, vy: 0, speed: 0 });
        return { type: c.type, x: Math.round(c.x), y: Math.round(c.y), d: Math.round(distanceBetween(c, player)) };
      },
    });
    // Mounted guns: mountedGuns(), driveArmed(), mountedGunAim(), mountedGunTargets() (mounted-guns.js).
    addConsoleMethods('police', mountedGunConsole());
    // Ammunition supply: bodies to search, police vehicles' stock (ammo-supply.js).
    addConsoleMethods('ammoSupply', ammoSupplyConsole());
    // NPC body armour: shotsToKill(), strikeTest() (see combat-rules.js armourConsole).
    addConsoleMethods('police', armourConsole());
    // END SUBSYSTEM: src/game-console-police.js
