    // Bounded, physical ambulance detours around a stopped vehicle near a junction; no entity is moved.
    const MEDIC_ROUTE_TRIES = 3, MEDIC_ROUTE_RETRY = 8;
    /* Before changing a route, the ambulance must have room to reach the nearby junction. Check its
       whole footprint against cars and static colliders, and keep every corner on the road's ground.
       Farther than the junction box, never ask it to reverse or turn across a block to get there. */
    function medicJunctionReachable(c, junction) {
      const dx = junction.x - c.x, dy = junction.y - c.y, d = Math.hypot(dx, dy);
      if (d > 130 || (d > 35 && dx * Math.cos(c.a) + dy * Math.sin(c.a) < d * 0.8)) return false;
      const steps = Math.max(1, Math.ceil(d / 12));
      for (let i = 0; i <= steps; i++) {
        const probe = { type: c.type, x: c.x + dx * i / steps, y: c.y + dy * i / steps, a: c.a },
          shape = vehicleShape(probe, 2);
        if (!cityStreetAt(probe.x, probe.y) || corners(shape).some((p) => !groundAt(p.x, p.y, 2) || railBlocked(p.x, p.y, 2))) return false;
        for (const b of nearbyStatics(probe))
          if ((b.minHeight === undefined || terrainHeight(probe.x, probe.y) + vehicleCollisionHeight(c) >= b.minHeight) && boxContact(shape, b)) return false;
        for (const o of vehicles)
          if (o !== c && (o.altitude || 0) < 20 && boxContact(shape, vehicleShape(o, 2))) return false;
      }
      return true;
    }
    function medicRouteAvoids(from, route, avoid) {
      let at = from;
      for (const p of route) {
        if (avoid.some((b) => segmentDistance(b.x, b.y, [at.x, at.y], [p.x, p.y]) < b.r)) return false;
        at = p;
      }
      return true;
    }
    function tryMedicDetour(job) {
      const c = job.ambulance, blocker = c.emergency?.blocker;
      if (job.phase !== 'driving' || !c.emergency?.running || c.mission || c.missionDriver || c.missionAmbulance ||
          !blocker || !vehicles.includes(blocker) || Math.hypot(blocker.vx || 0, blocker.vy || 0) > 6 * KMH ||
          (job.routeTries || 0) >= MEDIC_ROUTE_TRIES || gameTime < (job.routeRetryAt || 0) ||
          distanceBetween(c, job.stop) < 170) return false;
      // Failed plans are bounded too: a permanent roadblock must not run a graph search every frame.
      job.routeTries = (job.routeTries || 0) + 1;
      job.routeRetryAt = gameTime + MEDIC_ROUTE_RETRY;
      const start = { x: roadNear(c.x), y: rowNear(c.y) };
      if (!ROAD_CENTERS.includes(start.x) || !ROAD_ROWS.includes(start.y) || !medicJunctionReachable(c, start)) return false;
      const bs = vehicleSpec(blocker),
        avoid = [...(job.avoidedRoads || []), { x: blocker.x, y: blocker.y, r: Math.max(bs.l, bs.w) / 2 + vehicleSpec(c).w / 2 + 6 }];
      let best = null, bestLength = Infinity;
      for (const end of [0, 1]) {
        const plan = medicStopFor(job.body, end);
        if (!landAt(plan.junction.x, plan.junction.y)) continue;
        const road = copRoute(start, plan.junction, avoid), last = road.at(-1) || start;
        if (Math.abs(last.x - plan.junction.x) > 4 || Math.abs(last.y - plan.junction.y) > 4) continue;
        const route = [...(distanceBetween(c, start) >= 35 ? [start] : []), ...road, plan.stop];
        if (!route.length || !medicRouteAvoids(c, route, avoid)) continue;
        // Inside the box a left or right turn is fine; a U-turn in a queue needs space this planner
        // cannot promise. Leave that case to the existing wait/arrival/offscreen recovery rules.
        if (Math.abs(normalizeAngle(headingBetween(c, route[0]) - c.a)) > Math.PI * 0.7) continue;
        const length = medicRouteLength(c, route);
        if (length < bestLength) {
          bestLength = length;
          best = { route, plan };
        }
      }
      if (!best) return false;
      const plan = best.plan;
      c.countyRoute = [...best.route, { x: plan.stop.x + Math.cos(plan.heading) * 400, y: plan.stop.y + Math.sin(plan.heading) * 400 }];
      c.countyIndex = 0;
      c.aiControl = null;
      c.emergency.dodge = null;
      job.stop = plan.stop;
      job.heading = plan.heading;
      job.avoidedRoads = avoid;
      job.detours = (job.detours || 0) + 1;
      job.stuckFor = 0;
      job.pace = null;
      job.slow = false;
      return true;
    }
