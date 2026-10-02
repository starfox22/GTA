    // BEGIN SUBSYSTEM: src/game-console-soak.js — DeadEndCity console, long-session health: soakReport (sizes of every list that can grow, DOM, non-finite positions)
    // Read-only report for tools/soak.mjs: the sizes of the game's lists, logs and caches, the DOM
    // nodes under each top-level container and any NaN/Infinity in positions. Registered in the
    // 'graphics' group beside simProfile(). A name that does not exist reads as null, never throws.
    function soakSize(v) {
      if (Array.isArray(v)) return v.length;
      if (v instanceof Map || v instanceof Set) return v.size;
      if (v && typeof v === 'object') return Object.keys(v).length;
      return null;
    }
    // Every list, log, queue and cache that something appends to (name -> getter; a getter keeps the
    // names live and survives a renamed binding as `null`).
    function soakLists() {
      return {
        // entities
        vehicles: () => vehicles, pedestrians: () => pedestrians, bullets: () => bullets, particles: () => particles,
        skids: () => skids, enemies: () => enemies, debris: () => debris, fires: () => fires,
        officers: () => officers, gangMembers: () => gangMembers, storyActors: () => storyActors, wildlife: () => wildlife,
        beachgoers: () => beachgoers, roadblocks: () => roadblocks, sirenUnits: () => sirenUnits,
        seaEvents: () => seaEvents, dolphinPods: () => dolphinPods, gulls: () => gulls,
        // blood, wounds, stains, wrecks
        bloodPools: () => bloodPools, bleeders: () => bleeders, carStained: () => carStained,
        bloodTrackSources: () => bloodTrackSources, knockedProps: () => knockedProps, streetProps: () => streetProps,
        // contacts and physics
        impactContacts: () => impactContacts, staticBodies: () => staticBodies, specRadii: () => specRadii,
        // crime, witnesses, calls, reactions
        crimeLog: () => crimeLog, unreportedCrimes: () => unreportedCrimes, offstageCalls: () => offstageCalls,
        offstageCallTails: () => offstageCallTails, runOvers: () => runOvers, riderThrows: () => riderThrows,
        voiceLog: () => voiceLog, speechShown: () => speechShown,
        // logs
        crashLog: () => crashLog, crashRecent: () => crashRecent, crashPairs: () => crashPairs, fallLog: () => fallLog,
        cliffLog: () => cliffLog, seaLog: () => seaLog, engineTrace: () => engineTrace, aircraftCrashes: () => aircraftCrashes,
        shotLogRecent: () => shotLog.recent, shotLogSources: () => shotLog.bySource, bikeShareSkipped: () => bikeShareLog.skipped,
        // HUD and pointers
        notices: () => notices, hudPops: () => hudPops, mapPointers: () => mapPointers, minimapPointers: () => minimapPointers,
        promptRanges: () => promptRanges, worldPointers: () => worldPointers, physicalKeysDown: () => physicalKeysDown,
        // audio
        audioBuffers: () => audioBuffers, audioLoops: () => audioLoops,
        // caches keyed by id, position or type
        drivingCharacterCache: () => drivingCharacterCache, arcCache: () => arcCache, seatCache: () => seatCache,
        policeProfiles: () => policeProfiles, airframeSpecCache: () => airframeSpecCache, mountainGroundCache: () => mountainGroundCache,
        railLiftCache: () => railLiftCache, bikePointCache: () => bikePointCache, godRoadCache: () => godRoadCache,
        countyMarkingCache: () => countyMarkingCache, oceanPalmCache: () => oceanPalmCache, benchCache: () => benchCache,
        streetEndCache: () => streetEndCache, streetEndSolidCache: () => streetEndSolidCache, crosswalkCache: () => crosswalkCache,
        promenadeCache: () => promenadeCache, ladderCache: () => ladderCache, staticGrid: () => staticGrid,
        buildingGrid: () => buildingGrid, vehicleGrid: () => vehicleGrid, vehicleDenseCells: () => vehicleDense.filter(Boolean), shoreGrid: () => shoreGrid,
      };
    }
    function soakReportRun() {
      const lists = {};
      for (const [name, get] of Object.entries(soakLists())) {
        try {
          lists[name] = soakSize(get());
        } catch (e) {
          lists[name] = null;
        }
      }
      // Counts over the entities: what is awake, wrecked, mid-reaction, carrying nested lists.
      let awake = 0, wrecks = 0, ai = 0, stains = 0, contacts = 0, resting = 0,
        react = 0, flee = 0, pending = 0, hidden = 0;
      // What keeps a vehicle awake (the physics step skips only the resting): traffic, police, a burning wreck, the rest.
      const awakeBy = { ai: 0, cop: 0, burning: 0, moving: 0, other: 0 };
      for (const c of vehicles) {
        if (c.resting) resting++;
        else {
          awake++;
          if (c.hp <= 0 && c.damage?.burning) awakeBy.burning++;
          else if (c.ai) awakeBy.ai++;
          else if (c.cop) awakeBy.cop++;
          else if (Math.abs(c.vx || 0) + Math.abs(c.vy || 0) >= 0.6) awakeBy.moving++;
          else awakeBy.other++;
        }
        if (c.hp <= 0) wrecks++;
        if (c.ai) ai++;
        if (c.stains) stains += c.stains.length;
        if (c.pedestrianContacts) contacts += c.pedestrianContacts.size;
      }
      for (const p of pedestrians) {
        if (p.react) react++;
        if (p.flee) flee++;
        if (p.pending) pending++;
        if (p.hidden) hidden++;
      }
      // Non-finite numbers in anything that has a position.
      const bad = { count: 0, first: null };
      const check = (kind, e, i, fields) => {
        for (const f of fields) {
          const v = e[f];
          if (typeof v === 'number' && !Number.isFinite(v) && !(kind === 'vehicle' && (f === 'vx' || f === 'vy') && v !== v)) {
            bad.count++;
            if (!bad.first) bad.first = kind + '#' + i + '.' + f + '=' + v + (e.type ? ' ' + e.type : '');
          }
        }
      };
      check('player', player, 0, ['x', 'y', 'a', 'hp', 'altitude']);
      vehicles.forEach((c, i) => check('vehicle', c, i, ['x', 'y', 'a', 'vx', 'vy', 'av', 'hp', 'altitude']));
      pedestrians.forEach((p, i) => check('pedestrian', p, i, ['x', 'y', 'a', 'hp']));
      for (const [kind, list] of [['enemy', enemies], ['gang', gangMembers], ['officer', officers], ['bullet', bullets], ['particle', particles], ['blood', bloodPools], ['fire', fires]])
        list.forEach((e, i) => check(kind, e, i, ['x', 'y']));
      // DOM nodes under each top-level container (the HUD, notifications and map overlays are where a
      // forgotten element piles up).
      const domTop = {};
      let domTotal = 0;
      if (typeof document !== 'undefined' && document.body) {
        domTotal = document.getElementsByTagName('*').length;
        for (const el of document.body.children) {
          const n = el.getElementsByTagName('*').length;
          if (n > 20) domTop[el.id || el.tagName.toLowerCase() + '.' + (el.className || '')] = n;
        }
      }
      const heap = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null;
      return {
        gameTime: +gameTime.toFixed(1),
        clock: clockText(),
        mode: gameMode,
        lists,
        counts: { awake, ...Object.fromEntries(Object.entries(awakeBy).map(([k, v]) => ['awake_' + k, v])), resting, wrecks, ai, carStainEntries: stains, pedestrianContacts: contacts, react, flee, pending, hidden },
        bad,
        dom: { total: domTotal, top: domTop },
        heapMB: heap,
      };
    }
    // A fingerprint of the world's state (every number that decides what happens next), so two builds or two runs
    // can be compared exactly: the same seeded play must give the same hash after the same steps.
    const soakBits = new Float64Array(1),
      soakWords = new Uint32Array(soakBits.buffer);
    function soakHashRun() {
      let a = 0x811c9dc5,
        b = 0x01000193;
      const mix = (v) => {
        soakBits[0] = typeof v === 'number' ? v : v ? 1 : 0;
        for (let i = 0; i < 2; i++) {
          a = Math.imul(a ^ soakWords[i], 0x01000193);
          b = Math.imul(b + soakWords[i], 0x85ebca6b) ^ (b >>> 13);
        }
      };
      mix(gameTime);
      for (const k of ['x', 'y', 'a', 'hp', 'armor', 'altitude']) mix(player[k] || 0);
      for (const c of vehicles) for (const k of ['x', 'y', 'a', 'vx', 'vy', 'av', 'hp', 'altitude', 'restSteps']) mix(c[k] || 0);
      for (const p of pedestrians) for (const k of ['x', 'y', 'a', 'hp']) mix(p[k] || 0);
      for (const list of [enemies, gangMembers, officers, bullets, particles, bloodPools, fires, debris, skids]) {
        mix(list.length);
        for (const e of list) {
          mix(e.x || 0);
          mix(e.y || 0);
        }
      }
      mix(wantedStars);
      mix(cash);
      mix(worldMinutes);
      return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
    }
    // Every cell of the promenade rail grid's neighbourhood against its cell mask (game-collision.js cellMask): the
    // mask must be set exactly where one of the nine cells around holds something. Returns the cells checked and the
    // mismatches (0).
    function cellMaskAuditRun() {
      const grid = promenadeRailGrid;
      if (!grid) return { grid: false, checked: 0, mismatches: 0 };
      const mask = cellMask(grid, 1);
      let checked = 0,
        mismatches = 0;
      for (let i = -60; i < 90; i++)
        for (let j = -80; j < 100; j++) {
          let any = false;
          for (let a = -1; a <= 1 && !any; a++) for (let b = -1; b <= 1; b++) if (grid.get((i + a) * 4096 + j + b)) any = true;
          checked++;
          if (any !== cellMaskHas(mask, i, j)) mismatches++;
        }
      return { grid: true, cells: grid.size, checked, mismatches };
    }
    // hypot2 (game-state.js) against Math.hypot, bit for bit, over random magnitudes from tiny to huge, signs, zeros and
    // the special values. Returns how many pairs were compared and how many differed (0).
    function hypotAuditRun(count) {
      const bits = new Float64Array(2),
        words = new Uint32Array(bits.buffer),
        same = (u, v) => {
          if (u !== u && v !== v) return true;
          bits[0] = u;
          bits[1] = v;
          return words[0] === words[2] && words[1] === words[3];
        };
      const special = [0, -0, 1, -1, Infinity, -Infinity, NaN, 5e-324, 1e-310, 1e308, 1.7976931348623157e308, 2.5, 1e-200, 3e200];
      let checked = 0,
        bad = 0,
        first = null;
      const test = (x, y) => {
        checked++;
        if (!same(hypot2(x, y), Math.hypot(x, y))) {
          bad++;
          first ||= [x, y, hypot2(x, y), Math.hypot(x, y)];
        }
      };
      for (const x of special) for (const y of special) test(x, y);
      for (let i = 0; i < count; i++) {
        const scale = 10 ** (Math.random() * 12 - 4),
          x = (Math.random() - 0.5) * scale,
          y = (Math.random() - 0.5) * scale * (Math.random() < 0.3 ? 1e-3 : 1);
        test(x, y);
        test(Math.round(x), Math.round(y));
      }
      // Speed of the two over the same 1,000,000 pairs (a sum is kept so neither loop can be dropped).
      const n = 1000000,
        xs = new Float64Array(n),
        ys = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        xs[i] = (Math.random() - 0.5) * 2000;
        ys[i] = (Math.random() - 0.5) * 2000;
      }
      let sum = 0;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) sum += Math.hypot(xs[i], ys[i]);
      const t1 = performance.now();
      for (let i = 0; i < n; i++) sum += hypot2(xs[i], ys[i]);
      const t2 = performance.now();
      return { checked, bad, first, msPerMillionHypot: +(t1 - t0).toFixed(1), msPerMillionHypot2: +(t2 - t1).toFixed(1), sum: Math.round(sum) };
    }
    // The foot collision test on its own: `count` calls of solid() at fixed pseudo-random points within `span` units of
    // the player (the same points on every run), for `dev.mjs call solidBench ... --cpu --alloc 12` (time and garbage per
    // call, helper by helper). Returns how many were blocked and the milliseconds.
    function solidBenchRun(count, span, r) {
      let state = 12345,
        blocked = 0;
      const next = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const t0 = performance.now();
      for (let i = 0; i < count; i++) {
        if (solid(player.x + (next() - 0.5) * 2 * span, player.y + (next() - 0.5) * 2 * span, r, false)) blocked++;
      }
      return { count, blocked, ms: +(performance.now() - t0).toFixed(1), nsPerCall: Math.round(((performance.now() - t0) * 1e6) / count) };
    }
    // The helpers solid() calls, rewritten without closures or with early-outs (railBlocked, underpassBlocked, countyBlocked,
    // insidePondEllipse), against the code they replaced, over `count` points: random across the map, round the station
    // lifts, the underpass, the Commons lake and the county solids, with radii 0 to 40. Returns the checks and differences (0).
    function solidAuditRun(count) {
      let state = 424242;
      const next = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const hit = (x, y, r) => (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h;
      const refPond = (x, y, r, cx, cy, rx, ry, a) => {
        const dx = x - cx,
          dy = y - cy,
          c = Math.cos(a),
          s = Math.sin(a);
        return ((dx * c + dy * s) / (rx + r)) ** 2 + ((-dx * s + dy * c) / (ry + r)) ** 2 < 1;
      };
      const refRail = (x, y, r) => {
        if (RAIL_STATIONS.some((st) => {
          const p = railLift(st);
          return Math.abs(x - p.x) < 8.5 + r && Math.abs(y - p.y) < 8.5 + r;
        })) return true;
        const cell = railPierCells().get(Math.floor(x / 512) * 4096 + Math.floor(y / 512));
        if (!cell) return false;
        for (let i = 0; i < cell.length; i++) if (hit(x, y, r)(cell[i])) return true;
        return false;
      };
      let checked = 0,
        bad = 0,
        first = null;
      const same = (name, x, y, r, got, want) => {
        checked++;
        if (got !== want) {
          bad++;
          first ||= name + ' at ' + Math.round(x) + ',' + Math.round(y) + ' r' + r + ' got ' + got + ' want ' + want;
        }
      };
      const lake = COMMONS.lake,
        around = [
          ...RAIL_STATIONS.map((st) => railLift(st)),
          ...UNDERPASS_WALLS.map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })),
          { x: lake.x, y: lake.y },
          ...countyStaticSolids.map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })),
        ];
      for (let i = 0; i < count; i++) {
        const r = Math.floor(next() * 41),
          anchor = next() < 0.7 ? around[Math.floor(next() * around.length)] : null,
          x = anchor ? anchor.x + (next() - 0.5) * 260 : -4000 + next() * 13000,
          y = anchor ? anchor.y + (next() - 0.5) * 260 : -5000 + next() * 15000;
        same('rail', x, y, r, railBlocked(x, y, r), refRail(x, y, r));
        same('underpass', x, y, r, underpassBlocked(x, y, r), UNDERPASS_WALLS.some(hit(x, y, r)));
        same('county', x, y, r, countyBlocked(x, y, r), countyStaticSolids.some(hit(x, y, r)) || AIRPORT_SCENERY_SOLIDS.some(hit(x, y, r)));
        same('lake', x, y, r, insidePondEllipse(x, y, r, lake.x, lake.y, lake.rx, lake.ry, lake.a), refPond(x, y, r, lake.x, lake.y, lake.rx, lake.ry, lake.a));
        for (const p of parkPondList()) same('pond', x, y, r, insidePondEllipse(x, y, r, p.cx, p.cy, p.rx, p.ry, 0.25), refPond(x, y, r, p.cx, p.cy, p.rx, p.ry, 0.25));
      }
      // The vehicle grid's foot test against a scan of every vehicle (the grid's cells cover more than `reach`, so the answers match).
      for (let n = 0; n < count / 4 && vehicles.length; n++) {
        const v = vehicles[Math.floor(next() * vehicles.length)],
          radius = next() < 0.8 ? 8 : 3 + Math.floor(next() * 20),
          x = v.x + (next() - 0.5) * 220,
          y = v.y + (next() - 0.5) * 220,
          reach = 90 + radius;
        same('vehiclegrid', x, y, radius, footStepVehicleBlocked(x, y, radius, reach), vehicles.some((c) => !(c.x - x > reach || x - c.x > reach || c.y - y > reach || y - c.y > reach) && (!isAircraft(c) || aircraftClearance(c) < 20) && pointInCar(x, y, c, radius)));
      }
      // The rectangle lists (rectListBlocked's cell index) against the plain walk, radii up to 120, points on and round the rectangles.
      const lists = [garageWalls(), AIRPORT_SCENERY_SOLIDS, harborSolids(), marinaSolids(), monarchSolidList, SPORTSBOOK_SOLIDS];
      for (let n = 0; n < count; n++) {
        const list = lists[n % lists.length],
          r = next() < 0.8 ? Math.floor(next() * 41) : Math.floor(next() * 121),
          b = list.length && next() < 0.8 ? list[Math.floor(next() * list.length)] : null,
          x = b ? b.x + next() * b.w + (next() - 0.5) * 300 : -4000 + next() * 13000,
          y = b ? b.y + next() * b.h + (next() - 0.5) * 300 : -5000 + next() * 15000;
        same('rectlist' + (n % lists.length), x, y, r, rectListBlocked(list, x, y, r), list.some(hit(x, y, r)));
      }
      return { checked, bad, first };
    }
    // One helper of solid() on its own over `count` points like solidBench's: ns per call (and, with --alloc, its garbage), to
    // find which of the twenty is dear. `name` is the helper (sports, rail, pond, underpass, airport, garage, park, monarch,
    // northpoint, marina, beach, promenade, streetend, beachclub, ground, harbor, depot, county, military, buildings).
    function solidPartRun(name, count, span, r) {
      const parts = {
        sports: sportsBlocked, rail: railBlocked, pond: parkPondBlocked, underpass: underpassBlocked, airport: airportSceneryBlocked,
        garage: garageBlocked, park: parkBlocked, monarch: monarchBlocked, northpoint: northPointKeyBlocked, marina: marinaBlocked,
        beach: beachBlocked, promenade: promenadeRailBlocked, streetend: streetEndBlocked, beachclub: beachClubBlocked,
        ground: (x, y, rr) => !groundAt(x, y, rr), harbor: harborBlocked, depot: depotBlocked, county: countyBlocked, military: militaryBlocked,
        buildings: (x, y, rr) => {
          const list = buildingsNear(x, y);
          for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (x + rr > b.x && x - rr < b.x + b.w && y + rr > b.y && y - rr < b.y + b.h) return true;
          }
          return false;
        },
      };
      const fn = parts[name];
      if (!fn) return { error: 'unknown part', parts: Object.keys(parts) };
      let state = 12345,
        hits = 0;
      const next = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const t0 = performance.now();
      for (let i = 0; i < count; i++) if (fn(player.x + (next() - 0.5) * 2 * span, player.y + (next() - 0.5) * 2 * span, r)) hits++;
      const ms = performance.now() - t0;
      return { name, count, hits, nsPerCall: Math.round((ms * 1e6) / count) };
    }
    addConsoleMethods('graphics', {
      // One solid() helper alone (see solidPartRun): ns per call at points within `span` of the player.
      solidPart: (name, count = 200000, span = 1500, r = 8) => solidPartRun(String(name), clamp(Number(count) || 200000, 1, 5000000), Number(span) || 1500, Number(r) || 8),
      // Rewritten solid() helpers against the code they replaced over `count` points: bad must be 0.
      solidAudit: (count = 100000) => solidAuditRun(clamp(Number(count) || 100000, 1, 5000000)),
      // `count` solid() calls at fixed pseudo-random points within `span` units of the player with radius `r`: time and garbage of the
      // foot collision test (use with --cpu / --alloc).
      solidBench: (count = 200000, span = 1500, r = 8) => solidBenchRun(clamp(Number(count) || 200000, 1, 5000000), Number(span) || 1500, Number(r) || 8),
      // hypot2 against Math.hypot over `count` random pairs and the special values: bad must be 0.
      hypotAudit: (count = 200000) => hypotAuditRun(clamp(Number(count) || 200000, 1, 20000000)),
      // The promenade rail grid's cell mask against the grid itself over the whole map (mismatches must be 0).
      cellMaskAudit: () => cellMaskAuditRun(),
      // A fingerprint (16 hex digits) of the positions, velocities and health of the player, vehicles, people, the
      // armed lists and the effects, the wanted level, cash and clock. Equal after the same seeded play on two builds
      // means the change behaved identically (`seedRandom` first).
      stateHash: () => soakHashRun(),
      // Replace Math.random with a seeded generator, so the same play (the same calls, the same steps) gives the same
      // world on every run and every build: the exactness check of a performance change (`stateHash`). Returns the seed.
      seedRandom(seed = 1) {
        let state = (Number(seed) >>> 0) || 1;
        Math.random = () => {
          state = (state + 0x6d2b79f5) >>> 0;
          let t = state;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        return Number(seed) >>> 0 || 1;
      },
      // Long-session health (tools/soak.mjs): the size of every list, log and cache that something appends
      // to (`lists`; null where a binding is gone), counts over the entities (`counts`), any NaN/Infinity
      // in a position (`bad`), the DOM node counts per top-level container (`dom`) and the JS heap.
      soakReport: () => soakReportRun(),
    });
    // END SUBSYSTEM: src/game-console-soak.js
