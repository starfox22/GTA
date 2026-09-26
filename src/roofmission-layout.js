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
      drink: roofAt(273, 131),
      seat: roofAt(294, 131),
      home: roofAt(304, 90),
      bossName: 'Luciano Vescari',
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
    function roofRayLength(origin, a, range = 118) {
      const headingCosine = Math.cos(a),
        headingSine = Math.sin(a);
      let limit = range;
      for (const r of roofCover) {
        if (r.sight === false) continue;
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
    function roofSight(a, b) {
      return (
        sameFloor(a, b) &&
        roofRayLength(a, headingBetween(a, b), distanceBetween(a, b)) >= distanceBetween(a, b) - 0.01
      );
    }
    function roofSees(a, b, range = 130) {
      return (
        distanceBetween(a, b) < range &&
        Math.abs(normalizeAngle(headingBetween(a, b) - a.a)) < 0.82 &&
        roofSight(a, b)
      );
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
