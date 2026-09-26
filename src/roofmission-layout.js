    // Blue Hour layout: ROOF_HIT points, roof cover, entityElevation, sight rays and terrace routes (roofRoute, roofStep).
    /* The Blue Hour: shared scenery/collision, crowd navigation and a playable assassination scene. */
    const roofAt = (x, y) => ({
      x: ROOFTOP.x + x,
      y: ROOFTOP.y + y,
      altitude: ROOFTOP.height + 3,
    });
    const ROOF_HIT = {
      outfit: {
        x: 882,
        y: 1964,
      },
      escape: {
        x: -2183,
        y: 1972,
      },
      // A clean poisoning's way out: east along the hotel's pavement, past where
      // the ambulance pulls up. Anywhere ROOF_AWAY from the doors will do.
      away: {
        x: -1330,
        y: 2624,
      },
      // Vescari's reserved glass stands on the near (east) side of the VIP table;
      // he walks to `seat`, then steps up to the table edge (`sip`) to take it.
      drink: roofAt(278, 131),
      seat: roofAt(294, 131),
      sip: roofAt(287, 131),
      home: roofAt(304, 90),
      bossName: 'Luciano Vescari',
    };
    /* A bodyguard's view (roofmission-stealth.js): a cone `half` radians either
       side of where his head points, `range` units deep (15.5 m), stopped by
       the balustrade and by any cover but the pool (roofViewLength). The drawn
       cones (roofmission3d.js, drawRoofStealth2D) use these same numbers. */
    const ROOF_AWAY = 300;
    const ROOF_VIEW = {
      half: 0.7,
      range: 124,
      // Closer than this a guest is under his nose: suspicion climbs fast.
      near: 40,
    };
    const roofCover = [
      {
        kind: 'pool',
        x: 38,
        y: 44,
        w: 104,
        h: 56,
        height: 3,
        sight: false,
        // Flat water: the only cover a bodyguard sees across.
        view: false,
      },
      {
        kind: 'bar',
        x: 196,
        y: 26,
        w: 118,
        h: 25,
        height: 20,
      },
      {
        kind: 'lift',
        x: 18,
        y: 270,
        w: 40,
        h: 56,
        height: 34,
      },
      {
        kind: 'table',
        x: 265,
        y: 123,
        w: 16,
        h: 16,
        height: 8,
        sight: false,
      },
      {
        kind: 'hedge',
        x: 184,
        y: 102,
        w: 12,
        h: 62,
        height: 24,
      },
      {
        kind: 'hedge',
        x: 86,
        y: 198,
        w: 60,
        h: 12,
        height: 22,
      },
      {
        kind: 'hedge',
        x: 254,
        y: 198,
        w: 52,
        h: 12,
        height: 22,
      },
      {
        kind: 'sofa',
        x: 31,
        y: 142,
        w: 50,
        h: 24,
        height: 10,
        sight: false,
      },
      {
        kind: 'sofa',
        x: 87,
        y: 142,
        w: 32,
        h: 13,
        height: 10,
        sight: false,
      },
      {
        kind: 'hedge',
        x: 276,
        y: 257,
        w: 47,
        h: 12,
        height: 24,
      },
      {
        kind: 'buffet',
        x: 22,
        y: 220,
        w: 42,
        h: 15,
        height: 14,
        sight: false,
      },
      {
        kind: 'dj',
        x: 145,
        y: 298,
        w: 105,
        h: 26,
        height: 12,
        sight: false,
      },
    ].map((b) => ({
      ...b,
      x: b.x + ROOFTOP.x,
      y: b.y + ROOFTOP.y,
    }));
    function rooftopJob() {
      return mission?.index === 1 ? mission : null;
    }
    // Altitude is absolute for aircraft, bullets and rooftop actors; road vehicles follow terrain.
    function entityElevation(e) {
      if (!e) return 0;
      if (e === player && player.car) return entityElevation(player.car);
      if (e.type && vehicleSpec(e)) {
        if (isAircraft(e)) return e.altitude ?? 0;
        if (isBoat(e)) return boatSurfaceElevation(e);
        // A flooded car settles under the surface and takes its occupants with it;
        // one on (or flying off) a drawbridge leaf rides above the road (drawbridge.js).
        return terrainHeight(e.x, e.y) - (e.sinkDepth || 0) + (e.deckLift || 0);
      }
      return e.altitude ?? terrainHeight(e.x, e.y);
    }
    function sameFloor(a, b) {
      return Math.abs(entityElevation(a) - entityElevation(b)) < 24;
    }
    function rooftopFloor(e) {
      const z = e.surface ?? entityElevation(e);
      return (
        e.x >= ROOFTOP.x &&
        e.x <= ROOFTOP.x + ROOFTOP.w &&
        e.y >= ROOFTOP.y &&
        e.y <= ROOFTOP.y + ROOFTOP.h &&
        Math.abs(z - (ROOFTOP.height + 3)) < 16
      );
    }
    function roofPointFree(x, y, r = 7) {
      return (
        x > ROOFTOP.x + 14 + r &&
        x < ROOFTOP.x + ROOFTOP.w - 14 - r &&
        y > ROOFTOP.y + 14 + r &&
        y < ROOFTOP.y + ROOFTOP.h - 14 - r &&
        !roofCover.some((b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h)
      );
    }
    /* How far a ray from `origin` at heading `a` runs before cover stops it, up to
       `range`. Shots and the takedown (`view` false) pass over low cover (`sight:
       false`); a bodyguard's eyes (`view` true) are stopped by everything but the
       pool (`view: false`). */
    function roofRayLength(origin, a, range = 118, view = false) {
      const headingCosine = Math.cos(a),
        headingSine = Math.sin(a);
      let limit = range;
      for (const r of roofCover) {
        if ((view ? r.view : r.sight) === false) continue;
        let lo = 0,
          hi = limit;
        if (Math.abs(headingCosine) < 0.000001) {
          if (origin.x <= r.x || origin.x >= r.x + r.w) continue;
        } else {
          const t1 = (r.x - origin.x) / headingCosine,
            t2 = (r.x + r.w - origin.x) / headingCosine;
          lo = Math.max(lo, Math.min(t1, t2));
          hi = Math.min(hi, Math.max(t1, t2));
        }
        if (Math.abs(headingSine) < 0.000001) {
          if (origin.y <= r.y || origin.y >= r.y + r.h) continue;
        } else {
          const t1 = (r.y - origin.y) / headingSine,
            t2 = (r.y + r.h - origin.y) / headingSine;
          lo = Math.max(lo, Math.min(t1, t2));
          hi = Math.min(hi, Math.max(t1, t2));
        }
        if (lo < hi) limit = Math.max(0, lo);
      }
      return limit;
    }
    /* A bodyguard's line of sight: cover (roofRayLength with `view`) and the
       terrace's glass balustrade, 6 units in from the roof's edge. */
    function roofViewLength(origin, a, range = ROOF_VIEW.range) {
      const headingCosine = Math.cos(a),
        headingSine = Math.sin(a),
        left = ROOFTOP.x + 6,
        right = ROOFTOP.x + ROOFTOP.w - 6,
        top = ROOFTOP.y + 6,
        bottom = ROOFTOP.y + ROOFTOP.h - 6;
      let limit = range;
      if (headingCosine > 1e-6) limit = Math.min(limit, (right - origin.x) / headingCosine);
      else if (headingCosine < -1e-6) limit = Math.min(limit, (left - origin.x) / headingCosine);
      if (headingSine > 1e-6) limit = Math.min(limit, (bottom - origin.y) / headingSine);
      else if (headingSine < -1e-6) limit = Math.min(limit, (top - origin.y) / headingSine);
      return roofRayLength(origin, a, Math.max(0, limit), true);
    }
    function roofSight(a, b) {
      return (
        sameFloor(a, b) &&
        roofRayLength(a, headingBetween(a, b), distanceBetween(a, b)) >= distanceBetween(a, b) - 0.01
      );
    }
    /* Where a bodyguard is looking: his body's heading plus his head's turn
       (`look`, roofmission-stealth.js). The cone is centred on it. */
    function roofGuardView(e) {
      return (e.a || 0) + (e.look || 0);
    }
    /* Inside the cone (angle and range) with a clear line of sight: the only way a
       bodyguard sees anyone. There is no all-round awareness. */
    function roofGuardSees(e, target, range = ROOF_VIEW.range) {
      if (!sameFloor(e, target)) return false;
      const d = distanceBetween(e, target);
      if (d > range || d < 0.5) return false;
      const a = headingBetween(e, target);
      return (
        Math.abs(normalizeAngle(a - roofGuardView(e))) <= ROOF_VIEW.half &&
        roofViewLength(e, a, d) >= d - 0.01
      );
    }
    /* A free spot `radius` from `center`, as near the `prefer` heading as the
       cover allows (tried either side of it in steps), or null. */
    function roofSpotNear(center, radius, prefer = 0, margin = 8) {
      for (const r of [radius, radius + 8, radius + 16])
        for (let k = 0; k < 16; k++) {
          const a = prefer + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.4,
            x = center.x + Math.cos(a) * r,
            y = center.y + Math.sin(a) * r;
          if (roofPointFree(x, y, margin)) return { x, y };
        }
      return null;
    }
    function roofPathClear(a, b) {
      if (!roofPointFree(a.x, a.y, 8) || !roofPointFree(b.x, b.y, 8)) return false;
      for (const r of roofCover) {
        let lo = 0,
          hi = 1,
          hit = true;
        for (const [axis, min, max] of [
          ['x', r.x - 7.9999, r.x + r.w + 7.9999],
          ['y', r.y - 7.9999, r.y + r.h + 7.9999],
        ]) {
          const d = b[axis] - a[axis];
          if (Math.abs(d) < 0.00001) {
            if (a[axis] < min || a[axis] > max) {
              hit = false;
              break;
            }
          } else {
            const t1 = (min - a[axis]) / d,
              t2 = (max - a[axis]) / d;
            lo = Math.max(lo, Math.min(t1, t2));
            hi = Math.min(hi, Math.max(t1, t2));
            if (lo > hi) {
              hit = false;
              break;
            }
          }
        }
        if (hit) return false;
      }
      return true;
    }
    let roofNav = null;
    function roofRoute(a, b) {
      if (roofPathClear(a, b))
        return [
          {
            ...b,
          },
        ];
      if (!roofNav) {
        const nodes = roofCover
          .flatMap((b) =>
            [
              [-10, -10],
              [b.w + 10, -10],
              [-10, b.h + 10],
              [b.w + 10, b.h + 10],
            ].map(([x, y]) => ({
              x: b.x + x,
              y: b.y + y,
            })),
          )
          .filter((p) => roofPointFree(p.x, p.y, 8));
        roofNav = {
          nodes,
          edges: nodes.map((p, i) =>
            nodes.map((q, j) => (j !== i && roofPathClear(p, q) ? distanceBetween(p, q) : Infinity)),
          ),
        };
      }
      const nodes = [a, ...roofNav.nodes, b],
        last = nodes.length - 1,
        cost = nodes.map(() => Infinity),
        prev = [],
        closed = new Set();
      cost[0] = 0;
      for (let k = 0; k < nodes.length; k++) {
        let best = -1;
        for (let i = 0; i < nodes.length; i++)
          if (!closed.has(i) && (best < 0 || cost[i] < cost[best])) best = i;
        if (best < 0 || !isFinite(cost[best])) break;
        if (best === last) {
          const path = [];
          for (let i = last; i > 0; i = prev[i])
            path.unshift({
              ...nodes[i],
            });
          return path;
        }
        closed.add(best);
        for (let j = 1; j < nodes.length; j++) {
          if (closed.has(j)) continue;
          const edge =
            best > 0 && j < last
              ? roofNav.edges[best - 1][j - 1]
              : roofPathClear(nodes[best], nodes[j])
                ? distanceBetween(nodes[best], nodes[j])
                : Infinity;
          if (cost[best] + edge < cost[j]) {
            cost[j] = cost[best] + edge;
            prev[j] = best;
          }
        }
      }
      return [];
    }
    function roofStep(p, target, deltaSeconds, speed) {
      if (deltaSeconds <= 0 || distanceBetween(p, target) < 1) {
        p.walking = false;
        return;
      }
      if (!p.roofRoute || !p.routeGoal || distanceBetween(p.routeGoal, target) > 8) {
        p.roofRoute = roofRoute(p, target);
        p.routeGoal = {
          ...target,
        };
      }
      while (p.roofRoute.length && distanceBetween(p, p.roofRoute[0]) < 2) p.roofRoute.shift();
      const next = p.roofRoute[0];
      if (!next) {
        p.roofRoute = null;
        p.walking = false;
        return;
      }
      const a = headingBetween(p, next),
        d = Math.min(speed * deltaSeconds, distanceBetween(p, next)),
        x = p.x + Math.cos(a) * d,
        y = p.y + Math.sin(a) * d;
      p.a = a;
      p.walking = true;
      p.walk += d * 0.19;
      if (roofPointFree(x, y, 8)) {
        p.x = x;
        p.y = y;
      } else p.roofRoute = null;
    }
