    /**
     * DEVELOPER CONSOLE
     * `DeadEndCity` on window is a small, documented debugging surface used by
     * tools/smoke.mjs and by anyone maintaining the game from the browser
     * console. It reads and writes the same state the game itself uses; it is
     * not a cheat menu wired into the UI. Example: DeadEndCity.teleport(-1844, 2600).
     */
    window.DeadEndCity = Object.freeze({
      version: GAME_VERSION,
      // The world scale (game.js WORLD SCALE): map units to the metre.
      unitsPerMetre: UNITS_PER_METRE,
      // World-scale audit, everything in metres: each road vehicle's spec
      // (length, width), the built models within `radius` of the player measured
      // from their meshes (length, width, height), the player's model, the crowd
      // rig's stature range and the city's building heights.
      scaleReport(radius = 400) {
        const m = (units) => Math.round(worldMeters(units) * 100) / 100,
          near = vehicles.filter((c) => distanceBetween(c, player) < radius),
          extents = city3D?.modelExtents?.([...near, player]) || [],
          size = (e) => (e ? { l: m(e.l), w: m(e.w), h: m(e.h) } : null),
          rig = city3D?.crowdRigHeight?.() || 0,
          statures = pedestrians
            .filter((p) => p.look && p.role !== 'kid')
            .map((p) => city3D?.personStature?.(p) || 0)
            .filter(Boolean),
          heights = buildings.map((b) => b.height).sort((a, b) => a - b),
          pick = (list, q) => (list.length ? m(list[Math.min(list.length - 1, Math.floor(q * list.length))]) : null);
        return {
          unitsPerMetre: UNITS_PER_METRE,
          specs: Object.fromEntries(Object.entries(VEHICLE_DEFINITIONS).map(([type, s]) => [type, { l: m(s.l), w: m(s.w) }])),
          models: near
            .map((c, i) => ({ id: c.id, type: c.type, look: c.policeLook?.body || c.lawUnit || null, ...size(extents[i]) }))
            .filter((row) => row.l),
          player: size(extents[near.length]),
          crowd: {
            rig: m(rig),
            player: m(city3D?.personStature?.(player) || 0),
            shortest: pick(statures.sort((a, b) => a - b), 0),
            average: statures.length ? m(statures.reduce((s, v) => s + v, 0) / statures.length) : null,
            tallest: pick(statures.sort((a, b) => a - b), 1),
          },
          buildings: { count: heights.length, lowest: pick(heights, 0), median: pick(heights, 0.5), p90: pick(heights, 0.9), tallest: pick(heights, 1) },
        };
      },
      // Mend the player's vehicle as a repair bay would (for repeatable physics tests).
      repair() {
        if (!player.car) return null;
        repairVehicle(player.car);
        return this.damageReport();
      },
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
      // The interaction prompt as the player sees it (hud.js INTERACTION PROMPT):
      // visible, text, identity, docked, seconds since it popped in, this pass's offer.
      promptState: () => promptReport(),
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
      // What occupies a map point: land or water, anything solid, road, rail, beach,
      // and whether a car could be parked there. Mission tests use it to check that
      // objectives, spawns and waypoints are not inside buildings or the sea.
      probe(x, y, r = 8) {
        let car = false;
        try {
          car = canSpawnCar('sedan', x, y, 0);
        } catch {}
        return {
          x: Math.round(x),
          y: Math.round(y),
          land: !!landAt(x, y),
          ground: !!groundAt(x, y, r),
          solid: solid(x, y, r),
          rail: railBlocked(x, y, r),
          road: !!onRoad(x, y),
          beach: onBeach(x, y),
          terrain: Math.round(terrainHeight(x, y)),
          carFits: car,
          boatFits: boatFits({ type: 'jetski', x, y, a: 0 }),
          district: districtAt(x, y),
        };
      },
      // The Ridgeline Range (terrain.js): each field's grid, top and build time,
      // each trail's length, summit and steepest graded pitch, scenery counts and
      // the outcrops' footing. Terrain tests read it alongside probe().
      terrain: () => terrainReport(),
      // The 4x4 club and the trails (offroad.js): the lot and its clearances, the
      // club trucks, the members, the player's traction state, the hill climb.
      offroad: () => offroadReport(),
      // The mountain villages (mountain-village.js): each town's buildings by kind,
      // its businesses (footprint, eaves and ridge in metres, door), the street
      // dressing, the rescue helipad, the club block and, with WebGL, the
      // renderer's meshes, draw calls and triangles per town.
      mountainTowns: () => mountainVillageReport(),
      clubLineup: (x, y) => clubLineup(x, y),
      // 'state', 'arm', 'reset', 'clear' (records), 'gate' or 'cp0'..'cp2' (move the player's vehicle there).
      hillClimb: (action, trail) => hillClimbConsole(action, trail),
      // Drive the player's vehicle up a trail through the real physics (a line-following pilot).
      trailDrive: (seconds, maxKmh, trail) => trailPilot(seconds, maxKmh, trail),
      // A trail's path: [sample, x, y, height, grade, mud, rock] every `step` samples.
      trailProfile: (trail, step) => trailProfile(trail, step),
      // Set the mud on the player's vehicle (0..1) and how wet it is.
      mud: (amount = 1, wet = 1) => {
        const c = player.car;
        if (!c) return null;
        c.mudCoat = clamp(amount, 0, 1);
        c.mudWet = clamp(wet, 0, 1);
        return { mudCoat: c.mudCoat, mudWet: c.mudWet };
      },
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
      // Drive the player's road vehicle or boat toward (x, y) through the real
      // physics for up to `seconds`, holding W and steering with A/D, easing off
      // near the point. A straight-line pilot for checking that a route is
      // passable (it does not path-find); returns where it stopped and why. With
      // `passThrough` it does not stop: it counts the point reached at speed.
      steerTo(x, y, seconds = 30, radius = 50, passThrough = false) {
        const c = player.car;
        if (!c || isAircraft(c)) return null;
        let t = 0,
          reason = 'time',
          stuckFor = 0,
          backUp = 0;
        for (; t < seconds; t += 1 / 30) {
          if (gameMode !== 'play' || player.car !== c) {
            reason = 'left vehicle';
            break;
          }
          const d = Math.hypot(x - c.x, y - c.y);
          if (d < radius && (passThrough || Math.abs(c.speed) < 8)) {
            reason = 'arrived';
            break;
          }
          const err = normalizeAngle(Math.atan2(y - c.y, x - c.x) - c.a);
          const fast = !passThrough && c.speed > Math.max(40, d * 0.9);
          // Wedged against a wall or a shore: back off for a moment, wheel turned.
          stuckFor = d > radius && Math.abs(c.speed) < 5 ? stuckFor + 1 / 30 : 0;
          if (stuckFor > 1) backUp = 1;
          if (backUp > 0) {
            backUp -= 1 / 30;
            keys.KeyW = false;
            keys.KeyS = true;
            keys.KeyD = err < 0;
            keys.KeyA = err > 0;
          } else if (Math.abs(err) > 1.9 && c.speed < 25 && !isBoat(c)) {
            // Facing away: back up on opposite lock, a three-point turn.
            keys.KeyW = false;
            keys.KeyS = true;
            keys.KeyD = err < 0;
            keys.KeyA = err > 0;
          } else if (d < radius) {
            // On the spot: just brake to a stop, whichever way it is rolling.
            keys.KeyW = c.speed < -10;
            keys.KeyS = c.speed > 10;
            keys.KeyA = keys.KeyD = false;
          } else {
            keys.KeyW = !fast && (Math.abs(err) < 1.4 || c.speed < 20);
            keys.KeyS = fast || (Math.abs(err) >= 1.4 && c.speed > 20);
            keys.KeyD = err > 0.06;
            keys.KeyA = err < -0.06;
          }
          update(1 / 30);
        }
        keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false;
        return {
          reason,
          seconds: Math.round(t),
          x: Math.round(c.x),
          y: Math.round(c.y),
          speed: Math.round(c.speed || 0),
          hp: Math.round(c.hp),
          left: Math.round(Math.hypot(x - c.x, y - c.y)),
          wanted: Math.ceil(wantedStars),
        };
      },
      // Press the action key once, exactly as E would.
      interact() {
        interact();
        return this.missionState();
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
      // Move the player's vehicle (with the player aboard) to a point, stopped,
      // facing `heading`; aircraft can be lifted to an altitude in metres.
      placeVehicle(x, y, heading = player.car?.a ?? 0, altitudeMeters = 0) {
        const c = player.car;
        if (!c) return null;
        Object.assign(c, { x, y, a: heading, vx: 0, vy: 0, vz: 0, av: 0, speed: 0 });
        if (isAircraft(c))
          c.altitude = altitudeMeters > 0 ? terrainHeight(x, y) + altitudeMeters * UNITS_PER_METRE : terrainHeight(x, y);
        player.x = x;
        player.y = y;
        cameraTarget.x = x;
        cameraTarget.y = y;
        return this.status();
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
      // GOD PANEL: godPanel(), godTeleport(x, y), godRefill(), godLosePolice(), godFreeze(on), mapScreenPoint(x, y) (god-panel.js).
      ...godPanelConsole(),
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
      // The respray garages (garages.js): shops, doors, prices, the offer for the
      // player's vehicle, the drive-in job in progress and the last service.
      garage: () => garageReport(),
      // Fix the Apache's aim point on the ground (map x, y) as the mouse would;
      // no arguments hands the aim back to the mouse. Returns apache().
      // Put a fresh Apache back on its pad (the old one, wrecked or not, is removed
      // unless the player is aboard). Returns apache().
      apacheReset() {
        for (let i = vehicles.length - 1; i >= 0; i--)
          if (isApache(vehicles[i]) && vehicles[i] !== player.car) vehicles.splice(i, 1);
        if (!isApache(player.car)) parkApache();
        return apacheReport();
      },
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
      // Force the sky: clear, fair, cloudy, overcast, rain, storm. Passing nothing
      // hands the sky back to the weather machine.
      sky(id) {
        if (id === undefined) {
          weather.locked = false;
          return weatherLabel();
        }
        weather.locked = true;
        return setWeather(id);
      },
      // The weather machine's state: sky, next step, rain, wetness, wind, the
      // build-up to a shower (approach), strikes so far and thunder on its way.
      weather: () => weatherReport(),
      // Bring a shower in: overcast now, rain after `seconds` (the machine runs on).
      weatherFront: (seconds) => weatherFront(seconds),
      // Set how wet the streets are (0 dry .. 1 soaked); after rain it dries on
      // from there (weather.js), so a test can look at a drying street at once.
      wetness: (value) => {
        weather.wet = clamp(Number(value) || 0, 0, 1);
        return weatherReport();
      },
      // A lightning strike `distance` map units from the player (thunder follows).
      lightning: (distance = 900) => {
        const s = lightningStrike(distance);
        return { x: Math.round(s.x), y: Math.round(s.y), distance: Math.round(s.distance), thunderIn: +(s.distance / THUNDER_SPEED).toFixed(2) };
      },
      // The player's aircraft instruments as the flight HUD shows them (aviation.js
      // flightData): airspeed km/h, altitude and AGL m, vertical speed m/s, heading,
      // pitch, bank, throttle and spooled power, flaps, gear, g, stall warnings.
      flight() {
        const data = flightData(player.car);
        if (!data) return null;
        const out = {};
        for (const [key, value] of Object.entries(data))
          out[key] = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
        out.hud = !!document.getElementById('flightHud')?.classList.contains('on');
        out.instruments = hudState.flightHud;
        return out;
      },
