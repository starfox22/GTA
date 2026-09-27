    // DeadEndCity console methods for the living city (registered by game-console-crowd.js as
    // 'livingCity'): traffic reports and switches, the siren pass, the ambulance service.
    let sirenPassCars = null;
    function sirenPassState() {
      const s = sirenPassCars;
      if (!s) return null;
      const lane = (c) => Math.round(s.column ? s.road - c.x : c.y - s.road),
        state = (c) => ({ x: Math.round(c.x), y: Math.round(c.y), kmh: Math.round(Math.hypot(c.vx || 0, c.vy || 0) / KMH), lane: lane(c), along: Math.round(s.column ? c.y : c.x) });
      return { ambulance: state(s.amb), car: { ...state(s.car), yieldedAgo: s.car.sirenYield ? +(gameTime - s.car.sirenYield).toFixed(2) : null }, passed: (s.column ? s.amb.y - s.car.y : s.amb.x - s.car.x) > 0 };
    }
    function livingCityConsole() {
      return {
        // The traffic round the player: pool, cars in the ring and in view, moving,
        // yielding to a siren, the target for the hour and district, types.
        trafficReport: () => trafficReport(),
        // Switch the traffic streamer on or off (A/B measurements); returns the report.
        // Step the vehicle physics `steps` times back to back (1/120 s each, the
        // simulation advances) and time it: ms per step and per 60 fps frame (two
        // steps), with the traffic counts it ran on.
        trafficBenchmark(steps = 240) {
          const t0 = performance.now();
          for (let i = 0; i < steps; i++) physicsStep(1 / 120, true);
          const ms = (performance.now() - t0) / steps;
          const r = trafficReport();
          return { msPerStep: +ms.toFixed(3), msPerFrame60: +(ms * 2).toFixed(3), vehicles: vehicles.length, near: r.near, moving: r.moving, pool: r.pool };
        },
        // The ambulance service (livingcity-medics.js): jobs, outcomes and the one
        // under way (phase, the ambulance and its siren, the medics and their poses).
        medicReport: () => medicReport(),
        // A body at (x, y) (default: 60 units along the pavement from the player),
        // dead 12 s and nobody's victim, and an ambulance sent for it at once;
        // `revive` true/false forces the outcome. Returns medicReport().
        medicTest(x = null, y = null, revive = true) {
          if (medicService.job) medicJobEnd(medicService.job, 'aborted');
          medicService.cooldownUntil = 0;
          if (x === null || y === null) {
            const column = Math.abs(player.x - roadNear(player.x)) < Math.abs(player.y - rowNear(player.y));
            x = player.x + (column ? 0 : 60);
            y = player.y + (column ? 60 : 0);
          }
          const a = player.a;
          const body = { x, y, a: a + Math.PI, dir: a, hp: 0, flee: 0, timer: 999, walk: 0, state: 'idle', stateTime: 900 };
          dressPerson(body, 'casual');
          body.deadTime = gameTime - 12;
          pedestrians.push(body);
          for (let i = 0; i < 8 && !medicService.job; i++) dispatchMedics(body);
          if (medicService.job) medicService.job.revivable = !!revive;
          return medicReport();
        },
        // A siren test on the street the player stands on: an ambulance on a run
        // `behind` units back and a traffic sedan `gap` units ahead of it in its
        // lane, both heading along the street (+x or +y, by the street), the
        // player on the pavement. Read the pass with sirenPassState().
        sirenPass(behind = 260, gap = 150) {
          const column = Math.abs(player.x - roadNear(player.x)) < Math.abs(player.y - rowNear(player.y)),
            a = column ? Math.PI / 2 : 0,
            ux = Math.cos(a),
            uy = Math.sin(a),
            road = column ? roadNear(player.x) : rowNear(player.y),
            along0 = (column ? player.y : player.x) - behind,
            at = (along, lane) => (column ? { x: road - lane, y: along } : { x: along, y: road + lane }),
            start = at(along0, 0),
            mid = at(along0 + behind + 450, 0),
            stop = at(along0 + behind + 900, 22),
            beyond = at(along0 + behind + 1300, 22),
            ahead = at(along0 + gap, 25);
          const amb = makeCar('ambulance', start.x, start.y, a, true, VEHICLE_DEFINITIONS.ambulance.color);
          Object.assign(amb, { speed: 50 * KMH, vx: ux * 50 * KMH, vy: uy * 50 * KMH, occupied: true, locked: true, countyIndex: 0 });
          amb.countyRoute = [mid, stop, beyond];
          amb.emergency = { running: true, job: null };
          const car = makeCar('sedan', ahead.x, ahead.y, a, true, '#8a9aa8');
          Object.assign(car, { speed: 35 * KMH, vx: ux * 35 * KMH, vy: uy * 35 * KMH });
          sirenPassCars = { amb, car, a, road, column };
          return sirenPassState();
        },
        sirenPassState: () => sirenPassState(),
        // What the streamer would put on the street here now: `n` picks by type.
        trafficMix(n = 400) {
          const out = {};
          for (let i = 0; i < n; i++) {
            const type = pickTrafficType(player.x, player.y);
            out[type] = (out[type] || 0) + 1;
          }
          return { district: districtAt(player.x, player.y), hour: +crowdHour().toFixed(2), picks: out };
        },
        // Street events (livingcity-events.js): counts, the next one's timer, the
        // one under way (thief and victim, the gap between them).
        streetEvents: () => streetEventReport(),
        // Stage a bag snatch round the player now (a victim with a bag in view,
        // a thief close by); returns streetEvents(), `active` null when nobody fits.
        snatchTest() {
          if (streetEvents.active) endStreetEvent(streetEvents.active, 'restaged');
          stageSnatch();
          return streetEventReport();
        },
        trafficStreaming(on = true) {
          trafficStream.enabled = !!on;
          trafficStream.settledAt = null;
          return trafficReport();
        },
      };
    }
