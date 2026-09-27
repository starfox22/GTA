    // Ridgeline's scenic roads: smooth centrelines through the plan's corners, grading over the range (profile, cross-fall, cuttings and fills), guard rails, reflector posts and viewpoints.
    /**
     * SCENIC ROADS
     * The county's mountain roads (SCENIC_ROAD_NAMES) keep their plan in
     * COUNTY_ROADS but not its corners. Once the trails exist (buildScenicRoads,
     * run at the end of terrain.js's includes, before anything reads the roads)
     * every free corner of a control polygon becomes a circular arc tangent to
     * both legs, as large as the legs allow (scenicFillet), a light Laplacian
     * easing then spreads each arc's step in curvature like a transition spiral,
     * and held vertices (the ends, town corners, bridge landings) keep their
     * corner and a straight either side. A road or trail that started on a
     * rounded corner is moved to the nearest point of the new curve, which
     * becomes a vertex of both. The curve is resampled every SCENIC_SAMPLE units
     * (`road.dense`: what grading, the ribbon and the furniture read) and thinned
     * to within SCENIC_CHORD of it with every pinned vertex kept (`road.points`:
     * what everything else reads, the route graph, police routing, street names,
     * the maps, the terrain masks and the ground sheets). One centreline, so the
     * drawn road, the ground under it, the GPS and the map cannot disagree.
     *
     * Over the Ridgeline Range the roads are graded (gradeScenicRoads, called by
     * the terrain generator between erosion and the caps): the relief under the
     * road, smoothed, is the target; the road comes down to street level wherever
     * the plan lays something flat beside it (a town, a bridge, another road) and
     * runs on an earlier graded road's surface across its carriageway; between
     * those anchors it climbs and falls no steeper than SCENIC_MAX_GRADE and the
     * profile is the smoothest line near the target through the anchors (a
     * penalised spline, terrain-grading.js), so every change of grade is a long
     * vertical curve and the road leaves a town level.
     * The caps that made each road a valley floor now rise from its profile
     * (cuttings), and a fill floor under it builds embankments where it crosses a
     * hollow. The carriageway itself is carved last (carveScenicRoads): exactly
     * the profile plus the cross-fall (a 2% crown on the straights,
     * superelevation up to SCENIC_MAX_BANK through the curves, run in and out
     * over ~250 units, level at junctions), gravel shoulders, batters at about 42
     * degrees and the viewpoints' lay-bys. Contact is terrainHeight, as everywhere
     * on the range; the renderer's ribbon (county3d-roads.js) samples the same
     * surface, and offroadDrive treats the carriageway as tarmac.
     */
    const SCENIC_ROAD_NAMES = ['RIDGELINE HIGHWAY', 'EAGLE PASS', 'REGENCY ROAD', 'STONECREEK CONNECTOR', 'EASTGATE APPROACH', 'FOOTHILL ROAD'],
      SCENIC_SAMPLE = 4,
      SCENIC_CHORD = 0.35,
      // 8%: the steepest a mountain highway is built to.
      SCENIC_MAX_GRADE = 0.08,
      SCENIC_SHOULDER = 9,
      SCENIC_CROWN = 0.02,
      SCENIC_MAX_BANK = 0.06,
      // Lay-bys at the viewpoints: how far they widen the road, their full length and tapers (units).
      SCENIC_BAY = { width: 34, length: 70, taper: 55 };
    // In grading order: at a junction the later road meets the earlier one at its height.
    const SCENIC_ROADS = [];
    function scenicHeldVertex(points, i) {
      if (i === 0 || i === points.length - 1) return true;
      const [x, y] = points[i];
      return (
        COUNTY_TOWNS.some((t) => x > t.x - 2 && x < t.x + BLOCK_SIZE * 2 + 2 && y > t.y - 2 && y < t.y + BLOCK_SIZE * 2 + 2) ||
        BRIDGES.some((b) => Math.hypot(x - b.a[0], y - b.a[1]) < 2 || Math.hypot(x - b.b[0], y - b.b[1]) < 2)
      );
    }
    // Design radius of each road's curves (units): what a bend gets if its legs are long enough.
    const SCENIC_DESIGN_RADIUS = { 'RIDGELINE HIGHWAY': 1600, 'STONECREEK CONNECTOR': 1400, 'EASTGATE APPROACH': 1400 },
      SCENIC_DEFAULT_RADIUS = 900,
      // At a corner another road or a trail starts from.
      SCENIC_JOIN_RADIUS = 320;
    /* Each free corner becomes a circular arc tangent to both legs, as large as
       the legs allow: first no corner takes more of a leg than an equal radius at
       both its ends would (so a gentle bend beside a sharp one is not squeezed
       into a kink), then a corner held back by a leg its neighbour hardly uses
       takes the rest of it; a leg keeps 40 units of straight beside a town
       corner (it stays square) and 12 at a road's own end. */
    function scenicFillet(plan, held, design, joined) {
      const n = plan.length,
        T = new Float64Array(n),
        R = new Float64Array(n),
        cap = new Float64Array(n),
        tanHalf = new Float64Array(n),
        theta = new Float64Array(n),
        turn = new Int8Array(n),
        legLength = (i) => Math.hypot(plan[i + 1][0] - plan[i][0], plan[i + 1][1] - plan[i][1]),
        straight = (j) => (!held[j] ? 0 : j === 0 || j === n - 1 ? 12 : 40),
        room = (i) => Math.max(0, legLength(i) - straight(i) - straight(i + 1) - 6);
      for (let i = 1; i < n - 1; i++) {
        if (held[i]) continue;
        const ax = plan[i][0] - plan[i - 1][0],
          ay = plan[i][1] - plan[i - 1][1],
          bx = plan[i + 1][0] - plan[i][0],
          by = plan[i + 1][1] - plan[i][1],
          cross = ax * by - ay * bx;
        theta[i] = Math.abs(Math.atan2(cross, ax * bx + ay * by));
        turn[i] = Math.sign(cross);
        if (theta[i] <= 0.01) continue;
        tanHalf[i] = Math.tan(theta[i] / 2);
        // A corner something else starts from is rounded tighter, so the road stays near it.
        cap[i] = R[i] = joined[i] ? Math.min(design, SCENIC_JOIN_RADIUS) : design;
      }
      for (let i = 0; i < n - 1; i++) {
        const a = tanHalf[i],
          b = tanHalf[i + 1];
        if (!a && !b) continue;
        const even = room(i) / (a + b);
        if (a) R[i] = Math.min(R[i], even);
        if (b) R[i + 1] = Math.min(R[i + 1], even);
      }
      for (let i = 1; i < n - 1; i++) {
        if (!tanHalf[i]) continue;
        const before = (room(i - 1) - R[i - 1] * tanHalf[i - 1]) / tanHalf[i],
          after = (room(i) - R[i + 1] * tanHalf[i + 1]) / tanHalf[i];
        R[i] = Math.max(R[i], Math.min(cap[i], before, after));
        T[i] = R[i] * tanHalf[i];
      }
      // The arc at corner i for radius r: from the tangent point on the incoming leg
      // round to the one on the outgoing leg.
      const arc = (i, r) => {
        const t = r * tanHalf[i],
          [vx, vy] = plan[i],
          li = Math.hypot(vx - plan[i - 1][0], vy - plan[i - 1][1]),
          lo = legLength(i),
          ux = (vx - plan[i - 1][0]) / li,
          uy = (vy - plan[i - 1][1]) / li,
          ax = vx - ux * t,
          ay = vy - uy * t,
          // The centre is a radius in from the arc's start, on the side it turns to.
          cx = ax - uy * r * turn[i],
          cy = ay + ux * r * turn[i],
          from = Math.atan2(ay - cy, ax - cx),
          steps = Math.max(2, Math.ceil((theta[i] * r) / 6)),
          points = [];
        for (let s = 0; s < steps; s++) {
          const f = from + (turn[i] * theta[i] * s) / steps;
          points.push([cx + Math.cos(f) * r, cy + Math.sin(f) * r]);
        }
        points.push([vx + ((plan[i + 1][0] - vx) / lo) * t, vy + ((plan[i + 1][1] - vy) / lo) * t]);
        return points;
      };
      // A bend never sweeps deeper into a town than its legs ran (a big arc cut
      // the corner of Eastgate's blocks): depth is how far inside a town's grid
      // (plus 20) a point lies.
      const townDepth = ([x, y]) => {
          let depth = -Infinity;
          for (const t of COUNTY_TOWNS) depth = Math.max(depth, Math.min(x - t.x + 20, t.x + BLOCK_SIZE * 2 + 20 - x, y - t.y + 20, t.y + BLOCK_SIZE * 2 + 20 - y));
          return depth;
        },
        legPoint = (i, [x, y]) => {
          const pick = (a, b) => {
            const dx = b[0] - a[0],
              dy = b[1] - a[1],
              u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
            return [a[0] + dx * u, a[1] + dy * u];
          };
          const p = pick(plan[i - 1], plan[i]),
            q = pick(plan[i], plan[i + 1]);
          return Math.hypot(p[0] - x, p[1] - y) < Math.hypot(q[0] - x, q[1] - y) ? p : q;
        },
        intrudes = (i, point) => {
          const depth = townDepth(point);
          return depth > 0 && depth > townDepth(legPoint(i, point)) + 4;
        };
      for (let i = 1; i < n - 1; i++)
        for (let tries = 0; tries < 24 && T[i] >= 1 && arc(i, R[i]).some((point) => intrudes(i, point)); tries++) {
          R[i] *= 0.85;
          T[i] = R[i] * tanHalf[i];
        }
      const out = [plan[0].slice()];
      for (let i = 1; i < n - 1; i++) {
        if (T[i] < 1) out.push(plan[i].slice());
        else out.push(...arc(i, R[i]));
      }
      out.push(plan[n - 1].slice());
      return out;
    }
    /* A road's centreline: the plan's free corners filleted, resampled every
       SCENIC_SAMPLE units between the held vertices, then eased (a light
       Laplacian pass spreads each arc's step in curvature over its approach, as a
       transition spiral does) with the held vertices and 24 units either side of
       them kept straight. `attach` lists the points other roads and trails
       started from on this road's free corners: each is moved to the nearest
       point of the finished curve, which becomes a vertex of both. */
    function scenicCentreline(road, attach) {
      const plan = road.points.map(([x, y]) => [x, y]),
        held = plan.map((_, i) => scenicHeldVertex(plan, i)),
        heldKeys = new Set(plan.filter((_, i) => held[i]).map(([x, y]) => x + ',' + y)),
        isHeld = (p) => heldKeys.has(p[0] + ',' + p[1]),
        joined = plan.map(([x, y]) => attach.some((a) => a.x === x && a.y === y)),
        fillet = scenicFillet(plan, held, SCENIC_DESIGN_RADIUS[road.name] || SCENIC_DEFAULT_RADIUS, joined),
        dense = [fillet[0].slice()],
        pinned = [true];
      // Resample between held vertices at equal steps along the filleted line.
      let piece = [fillet[0]];
      for (let i = 1; i < fillet.length; i++) {
        piece.push(fillet[i]);
        if (i < fillet.length - 1 && !isHeld(fillet[i])) continue;
        const acc = [0];
        for (let q = 1; q < piece.length; q++) acc.push(acc[q - 1] + Math.hypot(piece[q][0] - piece[q - 1][0], piece[q][1] - piece[q - 1][1]));
        const length = acc[acc.length - 1],
          steps = Math.max(1, Math.round(length / SCENIC_SAMPLE));
        let q = 1;
        for (let k = 1; k < steps; k++) {
          const target = (length * k) / steps;
          while (acc[q] < target) q++;
          const f = (target - acc[q - 1]) / Math.max(1e-9, acc[q] - acc[q - 1]);
          dense.push([piece[q - 1][0] + (piece[q][0] - piece[q - 1][0]) * f, piece[q - 1][1] + (piece[q][1] - piece[q - 1][1]) * f]);
          pinned.push(false);
        }
        dense.push(fillet[i].slice());
        pinned.push(true);
        piece = [fillet[i]];
      }
      const hold = pinned.slice();
      for (let k = 0; k < dense.length; k++) if (pinned[k]) for (let j = Math.max(0, k - 6); j <= Math.min(dense.length - 1, k + 6); j++) hold[j] = true;
      for (let pass = 0; pass < 40; pass++)
        for (let k = 1; k < dense.length - 1; k++) {
          if (hold[k]) continue;
          const p = dense[k];
          p[0] += ((dense[k - 1][0] + dense[k + 1][0]) / 2 - p[0]) * 0.5;
          p[1] += ((dense[k - 1][1] + dense[k + 1][1]) / 2 - p[1]) * 0.5;
        }
      // Roads and trails that began at a corner begin on the curve.
      for (const { x, y, move } of attach) {
        let best = Infinity,
          bestK = 0,
          bestU = 0;
        for (let k = 0; k < dense.length - 1; k++) {
          const a = dense[k],
            b = dense[k + 1],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1),
            d = Math.hypot(x - a[0] - dx * u, y - a[1] - dy * u);
          if (d < best) {
            best = d;
            bestK = k;
            bestU = u;
          }
        }
        // The nearest sample, not a new one: the samples stay evenly spaced (grading
        // assumes so), and the join moves at most half a sample.
        const at = bestU > 0.5 ? bestK + 1 : bestK;
        pinned[at] = true;
        move(dense[at].slice());
      }
      // The shared polyline: every pinned vertex, and enough of the curve between them.
      const keep = pinned.map((v) => (v ? 1 : 0)),
        simplify = (a, b) => {
          let worst = -1,
            far = SCENIC_CHORD;
          for (let k = a + 1; k < b; k++) {
            const e = segmentDistance(dense[k][0], dense[k][1], dense[a], dense[b]);
            if (e > far) {
              far = e;
              worst = k;
            }
          }
          if (worst < 0) return;
          keep[worst] = 1;
          simplify(a, worst);
          simplify(worst, b);
        };
      let last = 0;
      for (let k = 1; k < dense.length; k++)
        if (keep[k]) {
          simplify(last, k);
          last = k;
        }
      road.points.splice(0, road.points.length, ...dense.filter((_, k) => keep[k]).map((p) => p.slice()));
      const n = dense.length,
        d = new Float64Array(n * 2),
        along = new Float32Array(n),
        tangent = new Float32Array(n * 2),
        curvature = new Float32Array(n);
      dense.forEach(([x, y], k) => {
        d[k * 2] = x;
        d[k * 2 + 1] = y;
        if (k) along[k] = along[k - 1] + Math.hypot(x - dense[k - 1][0], y - dense[k - 1][1]);
      });
      for (let k = 0; k < n; k++) {
        const a = dense[Math.max(0, k - 2)],
          b = dense[k],
          c = dense[Math.min(n - 1, k + 2)],
          tx = c[0] - a[0],
          ty = c[1] - a[1],
          tl = Math.hypot(tx, ty) || 1;
        tangent[k * 2] = tx / tl;
        tangent[k * 2 + 1] = ty / tl;
        if (k < 2 || k > n - 3) continue;
        const d1x = b[0] - a[0],
          d1y = b[1] - a[1],
          d2x = c[0] - b[0],
          d2y = c[1] - b[1];
        // Circumcircle curvature of the three points, signed: positive turns left (towards +normal).
        curvature[k] = (2 * (d1x * d2y - d1y * d2x)) / Math.max(1e-6, Math.hypot(d1x, d1y) * Math.hypot(d2x, d2y) * tl);
      }
      // A town corner or bridge landing is a junction, not a bend.
      for (let k = 1; k < n - 1; k++) if (isHeld(dense[k])) for (let j = Math.max(0, k - 3); j <= Math.min(n - 1, k + 3); j++) curvature[j] = 0;
      Object.assign(road, {
        scenic: true,
        plan,
        half: road.width / 2,
        n,
        dense: d,
        along,
        tangent,
        curvature,
        length: along[n - 1],
        profile: new Float32Array(n),
        fall: new Float32Array(n * 2),
        junction: null,
        bays: [],
      });
    }
    /* Run once the trails exist (end of terrain-roadside.js), before anything
       reads the county roads: finds what starts on each road's free corners, then
       builds the roads in order (an earlier road's move of a shared end is where
       the later one starts from). */
    function buildScenicRoads() {
      const roads = [];
      for (const name of SCENIC_ROAD_NAMES) {
        // (Monarch Isle has a REGENCY ROAD street of its own: `isle`.)
        const road = COUNTY_ROADS.find((r) => r.name === name && !r.bridge && !r.isle && r.points.length > 1);
        if (road) roads.push(road);
      }
      const attachments = new Map(roads.map((r) => [r, []]));
      for (const road of roads)
        road.points.forEach(([x, y], i) => {
          if (scenicHeldVertex(road.points, i)) return;
          for (const other of [...COUNTY_ROADS, ...MOUNTAIN_TRAILS]) {
            if (other === road) continue;
            for (const e of other.trail ? [0] : [0, other.points.length - 1]) {
              const p = other.points[e];
              if (Math.hypot(p[0] - x, p[1] - y) >= 1) continue;
              attachments.get(road).push({
                x,
                y,
                move: (q) => {
                  other.points.splice(e, 1, q);
                  // A trail's first bends that now fall on the road are dropped, or it
                  // would double back across the carriageway.
                  if (other.trail)
                    while (other.points.length > 3 && Math.hypot(other.points[1][0] - q[0], other.points[1][1] - q[1]) < road.width / 2 + 24) other.points.splice(1, 1);
                },
              });
            }
          }
        });
      for (const road of roads) {
        scenicCentreline(road, attachments.get(road));
        SCENIC_ROADS.push(road);
      }
      // The county road buckets (county-map.js) were filled from the old corners.
      countyRoadGrid = null;
    }
    /* ---- Queries ------------------------------------------------------------------------ */
    // Dense segments bucketed by 64-unit cell, grown by SCENIC_REACH: [road, k] pairs.
    const SCENIC_REACH = 80;
    let scenicGrid = null;
    function scenicRoadGrid() {
      if (scenicGrid) return scenicGrid;
      scenicGrid = new Map();
      SCENIC_ROADS.forEach((road, r) => {
        const d = road.dense,
          reach = road.half + SCENIC_REACH;
        for (let k = 0; k < road.n - 1; k++) {
          const x0 = Math.min(d[k * 2], d[k * 2 + 2]) - reach,
            x1 = Math.max(d[k * 2], d[k * 2 + 2]) + reach,
            y0 = Math.min(d[k * 2 + 1], d[k * 2 + 3]) - reach,
            y1 = Math.max(d[k * 2 + 1], d[k * 2 + 3]) + reach;
          for (let i = Math.floor(x0 / 64); i <= Math.floor(x1 / 64); i++)
            for (let j = Math.floor(y0 / 64); j <= Math.floor(y1 / 64); j++) {
              const key = i * 4096 + j;
              let cell = scenicGrid.get(key);
              if (!cell) scenicGrid.set(key, (cell = []));
              cell.push(r, k);
            }
        }
      });
      return scenicGrid;
    }
    /* The nearest scenic road centreline to (x, y) within the road's half-width
       plus SCENIC_REACH (null past that), optionally only road `only`: the road,
       the fractional sample index `k`, the signed offset `t` (positive on the
       left of travel), the distance `d`. `out` is reused when given. */
    function scenicRoadNear(x, y, out = {}, only = null) {
      const cell = scenicRoadGrid().get(Math.floor(x / 64) * 4096 + Math.floor(y / 64));
      if (!cell) return null;
      let best = Infinity;
      out.road = null;
      for (let i = 0; i < cell.length; i += 2) {
        const road = SCENIC_ROADS[cell[i]];
        if (only && road !== only) continue;
        const k = cell[i + 1],
          d = road.dense,
          ax = d[k * 2],
          ay = d[k * 2 + 1],
          dx = d[k * 2 + 2] - ax,
          dy = d[k * 2 + 3] - ay,
          len2 = dx * dx + dy * dy || 1,
          u = clamp(((x - ax) * dx + (y - ay) * dy) / len2, 0, 1),
          qx = x - ax - dx * u,
          qy = y - ay - dy * u,
          dist = Math.hypot(qx, qy) - road.half;
        if (dist < best) {
          best = dist;
          out.road = road;
          out.k = k + u;
          out.d = dist + road.half;
          out.t = Math.sign(dx * qy - dy * qx || 1) * out.d;
        }
      }
      return out.road ? out : null;
    }
    // A sample's position: x, y and the left normal (nx, ny).
    function scenicPointAt(road, kf, t = 0, out = {}) {
      const k = clamp(Math.floor(kf), 0, road.n - 2),
        f = clamp(kf - k, 0, 1),
        d = road.dense,
        tg = road.tangent,
        tx = tg[k * 2] * (1 - f) + tg[k * 2 + 2] * f,
        ty = tg[k * 2 + 1] * (1 - f) + tg[k * 2 + 3] * f,
        tl = Math.hypot(tx, ty) || 1;
      out.nx = -ty / tl;
      out.ny = tx / tl;
      out.x = d[k * 2] + (d[k * 2 + 2] - d[k * 2]) * f + out.nx * t;
      out.y = d[k * 2 + 1] + (d[k * 2 + 3] - d[k * 2 + 1]) * f + out.ny * t;
      out.a = Math.atan2(ty, tx);
      return out;
    }
    const lerpSample = (array, kf, n, stride = 1, offset = 0) => {
      const k = clamp(Math.floor(kf), 0, n - 2),
        f = clamp(kf - k, 0, 1);
      return array[k * stride + offset] * (1 - f) + array[(k + 1) * stride + offset] * f;
    };
    // How far a lay-by widens the road at sample kf on side (1 left, -1 right).
    function scenicBayWidth(road, kf, side) {
      let w = 0;
      for (const bay of road.bays)
        if (bay.side === side) {
          const run = (Math.abs(kf - bay.k) * SCENIC_SAMPLE - bay.length / 2) / bay.taper;
          w = Math.max(w, bay.width * (1 - smoothStep(0, 1, run)));
        }
      return w;
    }
    /* The finished road surface at sample kf, offset t: the profile plus the
       cross-fall on the carriageway, level across a lay-by, and a gravel
       shoulder falling gently away beyond the asphalt. */
    function scenicSurface(road, kf, t) {
      const side = t >= 0 ? 1 : -1,
        at = Math.abs(t),
        P = lerpSample(road.profile, kf, road.n),
        fall = lerpSample(road.fall, kf, road.n, 2, side > 0 ? 0 : 1),
        edge = road.half + scenicBayWidth(road, kf, side),
        top = P + fall * Math.min(at, road.half);
      return Math.max(0, at <= edge ? top : top - 0.06 * (at - edge));
    }
    // The road's own level (the profile) at the centreline sample nearest a point; 0 off the scenic roads.
    function scenicRoadLevel(x, y) {
      const hit = scenicRoadNear(x, y);
      return hit && hit.d < hit.road.half + 4 ? lerpSample(hit.road.profile, hit.k, hit.road.n) : 0;
    }
    // Whether a point is on the paved part of any county road (offroad.js grip).
    function countyPavedAt(x, y) {
      return onCountyRoad(x, y, 4);
    }
    // Graded over this terrain field: a scenic road the range field's box reaches.
    function scenicRoadGraded(road, field) {
      if (!road.scenic || field.kind !== 'range') return false;
      if (road.gradedIn === undefined) {
        road.gradedIn = false;
        for (let k = 0; k < road.n && !road.gradedIn; k++) {
          const x = road.dense[k * 2],
            y = road.dense[k * 2 + 1];
          road.gradedIn = x > field.x0 && x < field.x1 && y > field.y0 && y < field.y1;
        }
      }
      return road.gradedIn;
    }
    // A level pad beside a graded road (the Mount Ascent trailhead car park) rides at the road's height.
    function scenicPadRoad(pad, field) {
      if (field.kind !== 'range') return null;
      let found = null;
      for (const road of SCENIC_ROADS)
        if (scenicRoadGraded(road, field))
          for (let k = 0; k < road.n && !found; k += 4) {
            const x = road.dense[k * 2],
              y = road.dense[k * 2 + 1],
              dx = Math.max(pad.x - x, 0, x - pad.x - pad.w),
              dy = Math.max(pad.y - y, 0, y - pad.y - pad.h);
            if (Math.hypot(dx, dy) < road.half + 120) found = road;
          }
      return found;
    }
    /* Per sample: `junction` is 1 in another road's mouth fading to 0 over 60
       units (no bank, no posts, no rails, no centre line there); `mouth` has bit
       1 where the other carriageway covers the left edge, 2 the right (no edge
       line there). */
    function scenicJunctions() {
      for (const road of SCENIC_ROADS) {
        if (road.junction) continue;
        const others = [...COUNTY_ROADS, ...SERVICE_ROADS, ...MOUNTAIN_TRAILS].filter((o) => o !== road && o.points.length > 1),
          j = (road.junction = new Float32Array(road.n)),
          mouth = (road.mouth = new Uint8Array(road.n)),
          d = road.dense,
          near = (o, x, y) => {
            let best = Infinity;
            for (let i = 1; i < o.points.length; i++) best = Math.min(best, segmentDistance(x, y, o.points[i - 1], o.points[i]));
            return best;
          };
        for (const o of others) {
          let x0 = Infinity,
            x1 = -Infinity,
            y0 = Infinity,
            y1 = -Infinity;
          for (const [x, y] of o.points) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
          const oh = (o.width || 40) / 2,
            reach = oh + road.half + 70;
          for (let k = 0; k < road.n; k++) {
            const x = d[k * 2],
              y = d[k * 2 + 1];
            if (x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach) continue;
            const best = near(o, x, y);
            if (best > reach) continue;
            j[k] = Math.max(j[k], 1 - smoothStep(oh + road.half * 0.5, oh + road.half + 60, best));
            if (best < oh + road.half + 6) {
              const nx = -road.tangent[k * 2 + 1],
                ny = road.tangent[k * 2],
                e = road.half + 3;
              if (near(o, x + nx * e, y + ny * e) < oh + 3) mouth[k] |= 1;
              if (near(o, x - nx * e, y - ny * e) < oh + 3) mouth[k] |= 2;
            }
          }
        }
      }
    }
