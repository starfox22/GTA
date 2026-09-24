    // BEGIN SUBSYSTEM: src/transit.js — Public railway simulation
    /**
     * Public railway simulation
     * Source: src/transit.js
     * Scope: shared game closure.
     * Track graph, station access, boarding, travel, stops and safe disembarkation.
     */
    /**
     * RAILWAY
     * Three lines on their own elevated right of way, all of it on the west and
     * south of the map:
     *   SHORE LINE  Cruise Terminal (on the apron street) -> an el down Garden St
     *               and west along the avenue south of the marina (it never
     *               crosses the basin's mouth) -> down the west sea wall (the
     *               old West Quay alignment, x = 150) ->
     *               across Viaduct Green onto Harbor Ave -> south down Royal Ave
     *               -> Southport Airport, where it stands over the terminal
     *               forecourt on Airport Way. The avenue legs are an "el":
     *               the deck rides the centre of the avenue on straddle bents
     *               planted on the pavements, as elevated lines do downtown.
     *   COAST LINE  Southport Airport -> a sea viaduct across the channel ->
     *               Oceanview (west of the town) -> Oceanview International,
     *               behind the terminal -> across the Coral Sound narrows ->
     *               Palmshore.
     *   RIDGE LINE  Palmshore -> its own bridge across the sound, west of the
     *               road viaduct -> Eastgate -> Northridge -> Stonecreek.
     * The railway never shares a road's alignment in the county, never passes
     * over a ship, berth, pier, helipad or building, and crosses every road it
     * meets as a flyover (the deck is 52 units up; vehicles pass beneath).
     *
     * `route` holds the authored control polygon: [x, y] or [x, y, radius].
     * `railTrackGeometry` turns it into the track actually built and run: every
     * corner becomes a circular arc (radius from the point, else RAIL_RADIUS),
     * then a short smoothing pass eases curvature in and out along the tangents
     * the way a transition spiral does, and the curve is thinned back to the
     * fewest points that stay within RAIL_CHORD_ERROR of it. Straights stay one
     * segment; curves get a point every 30-60 units. Stations and the ends of
     * lines are held exactly and kept straight for a platform's length either
     * side, which is why a station has to sit on a straight leg of its route
     * (it is inserted into the route automatically).
     *
     * Trains brake for the next stop, never for the next point, and their cars
     * take their heading from the track a few units ahead and behind, so they
     * swing through the curves instead of snapping from chord to chord.
     */
    const RAIL_RADIUS = 450,
      RAIL_MIN_RADIUS = 180,
      RAIL_PLATFORM_CLEAR = 100,
      RAIL_CHORD_ERROR = 0.6,
      RAIL_SAMPLE = 8;
    const RAIL_LINES = [
      {
        id: 'shore',
        name: 'SHORE LINE',
        color: '#e2b766',
        route: [
          // Buffer stops on the terminal apron street (y -3968), short of Garden
          // Ave; the station is in front of the cruise terminal.
          [2600, -3968],
          // West along the apron, then an el down Garden St, well east of the
          // marina: the basin's mouth stays open water for the superyacht and
          // the masts, with no viaduct or piers across the channel.
          [2176, -3968, 200],
          [2176, -2944, 200],
          // West along the avenue south of the marina to the sea wall.
          [150, -2944, 200],
          // Down the west sea wall, then off it across Viaduct Green.
          [150, 3200, 330],
          // Along Harbor Ave; the Royal Ave corner is an el curve kept inside
          // the junction.
          [1152, 3200, 200],
          // Straight on past the end of Royal Ave into the airport, clear of the
          // Battery St blocks, then a gentle S onto Airport Way to stand over the
          // terminal forecourt.
          [1152, 4440, 500],
          [1220, 4720, 500],
          [1220, 4890],
        ],
      },
      {
        id: 'coast',
        name: 'COAST LINE',
        color: '#67c6bd',
        route: [
          [1220, 4890],
          // Off the airport's south shore and across the channel on a sea
          // viaduct past the south-west corner of Northbank.
          [1220, 5320, 900],
          [1990, 6720, 900],
          // Down the west edge of Oceanview, round the town's south-west corner
          // and east between the town and the parkway.
          [1990, 8200, 500],
          [3450, 8200, 700],
          // Behind Oceanview International's terminal (the forecourt and the
          // apron are on its south side, the helipad at 3690, 8830 with them).
          [3950, 8330, 700],
          [4800, 8330, 700],
          [5550, 8520, 700],
          // Over the Coral Sound narrows and north to Palmshore.
          [6600, 8800, 400],
          [6600, 8150],
        ],
      },
      {
        id: 'ridge',
        name: 'RIDGE LINE',
        color: '#b3a1d8',
        route: [
          [6600, 8150],
          [6600, 7300, 500],
          [6980, 6900, 600],
          // Its own bridge across the sound, 700 units west of the road viaduct.
          [6980, 5900, 400],
          [8790, 5620, 350],
          [8790, 3740, 300],
          [7850, 3740, 200],
          // Buffer stops south of Stonecreek station, short of Eastgate Approach.
          [7850, 4200],
        ],
      },
    ];
    // `entry` is where a passenger stands to use the station (the street door of
    // the lift tower is found next to it); on the west sea wall it is on the
    // esplanade, on the avenues it is the pavement.
    const RAIL_STATIONS = [
      { name: 'CRUISE TERMINAL', x: 2480, y: -3968, entry: { x: 2480, y: -3902 } },
      { name: 'HARBOR POINT', x: 1408, y: -2944, entry: { x: 1408, y: -3014 } },
      { name: 'RECLAMATION', x: 150, y: -2176, entry: { x: 64, y: -2176 } },
      { name: 'OLD QUARTER', x: 150, y: 896, entry: { x: 64, y: 896 } },
      { name: 'WEST QUAY', x: 150, y: 2432, entry: { x: 64, y: 2432 } },
      { name: 'BROADWAY', x: 860, y: 3200, entry: { x: 860, y: 3126 } },
      { name: 'SOUTHPORT AIRPORT', x: 1220, y: 4890, entry: { x: 1292, y: 4890 } },
      { name: 'OCEANVIEW', x: 1990, y: 7300, entry: { x: 2064, y: 7300 } },
      { name: 'OCEANVIEW AIRPORT', x: 4215, y: 8330, entry: { x: 4215, y: 8258 } },
      { name: 'PALMSHORE', x: 6600, y: 8150, entry: { x: 6674, y: 8150 } },
      { name: 'EASTGATE', x: 8790, y: 5000, entry: { x: 8716, y: 5000 } },
      { name: 'NORTHRIDGE', x: 8300, y: 3740, entry: { x: 8300, y: 3812 } },
      { name: 'STONECREEK', x: 7850, y: 4050, entry: { x: 7924, y: 4050 } },
    ];
    /**
     * TRACK GEOMETRY (see RAILWAY above). `held` is a set of "x,y" keys that
     * must survive as exact vertices with straight track either side.
     */
    const railKey = (p) => Math.round(p[0]) + ',' + Math.round(p[1]);
    function railFilletRoute(route, held) {
      const pts = route.map((p) => [p[0], p[1]]),
        n = pts.length,
        dir = [],
        len = [];
      for (let i = 1; i < n; i++) {
        const dx = pts[i][0] - pts[i - 1][0],
          dy = pts[i][1] - pts[i - 1][1],
          l = Math.hypot(dx, dy);
        len.push(l);
        dir.push([dx / l, dy / l]);
      }
      // Tangent length of each corner's arc, from its radius and turn angle.
      const turn = pts.map(() => 0),
        tangent = pts.map(() => 0);
      for (let i = 1; i < n - 1; i++) {
        const a = dir[i - 1],
          b = dir[i],
          angle = Math.acos(clamp(a[0] * b[0] + a[1] * b[1], -1, 1));
        if (angle < 0.002 || held.has(railKey(pts[i]))) continue;
        turn[i] = angle;
        tangent[i] = (route[i][2] || RAIL_RADIUS) * Math.tan(angle / 2);
      }
      // Neighbouring arcs share a leg, and a held point keeps a platform's length
      // of straight track. Shrink any pair of arcs that would not fit.
      for (let i = 0; i < n - 1; i++) {
        const room =
            len[i] -
            (held.has(railKey(pts[i])) ? RAIL_PLATFORM_CLEAR : 0) -
            (held.has(railKey(pts[i + 1])) ? RAIL_PLATFORM_CLEAR : 0),
          need = tangent[i] + tangent[i + 1];
        if (need > room) {
          const f = Math.max(0, room) / need;
          tangent[i] *= f;
          tangent[i + 1] *= f;
        }
      }
      const out = [pts[0].slice()];
      for (let i = 1; i < n - 1; i++) {
        if (!turn[i] || tangent[i] < 1) {
          out.push(pts[i].slice());
          continue;
        }
        const a = dir[i - 1],
          b = dir[i],
          t = tangent[i],
          radius = t / Math.tan(turn[i] / 2),
          side = Math.sign(a[0] * b[1] - a[1] * b[0]),
          sx = pts[i][0] - a[0] * t,
          sy = pts[i][1] - a[1] * t,
          // Centre of the arc: one radius to the inside of the turn from its start.
          cx = sx - a[1] * side * radius,
          cy = sy + a[0] * side * radius,
          a0 = Math.atan2(sy - cy, sx - cx),
          steps = Math.max(2, Math.ceil((radius * turn[i]) / RAIL_SAMPLE));
        if (radius < RAIL_MIN_RADIUS - 1)
          console.warn('Rail curve at ' + railKey(pts[i]) + ' is below the minimum radius: ' + Math.round(radius));
        for (let k = 0; k <= steps; k++) {
          const q = a0 + (side * turn[i] * k) / steps;
          out.push([cx + Math.cos(q) * radius, cy + Math.sin(q) * radius]);
        }
      }
      out.push(pts[n - 1].slice());
      return out;
    }
    // Even resampling of one stretch of track.
    function railResample(points, spacing) {
      const out = [points[0].slice()];
      let carry = 0;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i],
          l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        let d = spacing - carry;
        while (d < l) {
          out.push([a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l]);
          d += spacing;
        }
        carry = l - (d - spacing);
      }
      const last = points[points.length - 1];
      if (Math.hypot(last[0] - out.at(-1)[0], last[1] - out.at(-1)[1]) < spacing * 0.4) out.pop();
      out.push(last.slice());
      return out;
    }
    // Douglas-Peucker: keep only the points the curve needs.
    function railThin(points, tolerance) {
      if (points.length < 3) return points;
      const a = points[0],
        b = points[points.length - 1];
      let worst = 0,
        at = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const d = segmentDistance(points[i][0], points[i][1], a, b);
        if (d > worst) {
          worst = d;
          at = i;
        }
      }
      if (worst <= tolerance) return [a, b];
      return [
        ...railThin(points.slice(0, at + 1), tolerance).slice(0, -1),
        ...railThin(points.slice(at), tolerance),
      ];
    }
    function railTrackGeometry(route, held) {
      const filleted = railFilletRoute(route, held),
        pieces = [[filleted[0]]];
      for (let i = 1; i < filleted.length; i++) {
        pieces.at(-1).push(filleted[i]);
        if (held.has(railKey(filleted[i])) && i < filleted.length - 1) pieces.push([filleted[i]]);
      }
      const track = [];
      for (const piece of pieces) {
        const dense = railResample(piece, RAIL_SAMPLE),
          start = dense[0],
          end = dense[dense.length - 1],
          near = (p, q) => held.has(railKey(q)) && Math.hypot(p[0] - q[0], p[1] - q[1]) < RAIL_PLATFORM_CLEAR - 8,
          // Points by a station stay put so that its platform stays straight.
          pinned = dense.map((p, i) => i === 0 || i === dense.length - 1 || near(p, start) || near(p, end));
        // Easing: a light Laplacian pass spreads each arc's step in curvature over
        // ~50 units of its approach, like a transition spiral, and moves the arc
        // itself by about a unit.
        for (let pass = 0; pass < 36; pass++)
          for (let i = 1; i < dense.length - 1; i++) {
            if (pinned[i]) continue;
            const p = dense[i];
            p[0] += ((dense[i - 1][0] + dense[i + 1][0]) / 2 - p[0]) * 0.5;
            p[1] += ((dense[i - 1][1] + dense[i + 1][1]) / 2 - p[1]) * 0.5;
          }
        const thin = railThin(dense, RAIL_CHORD_ERROR);
        track.push(...(track.length ? thin.slice(1) : thin));
      }
      return track;
    }
    // Stations become vertices of their routes, then every line is built. Held
    // points are the stations and each line's two ends, which is also where the
    // lines meet one another.
    {
      const held = new Set();
      for (const line of RAIL_LINES) {
        held.add(railKey(line.route[0]));
        held.add(railKey(line.route.at(-1)));
      }
      for (const s of RAIL_STATIONS) {
        const key = railKey([s.x, s.y]);
        held.add(key);
        let placed = false;
        for (const line of RAIL_LINES)
          for (let i = 1; i < line.route.length && !placed; i++) {
            const a = line.route[i - 1],
              b = line.route[i];
            if (railKey(a) === key || railKey(b) === key) placed = true;
            else if (segmentDistance(s.x, s.y, a, b) < 1) {
              line.route.splice(i, 0, [s.x, s.y]);
              placed = true;
            }
          }
        if (!placed) console.warn('Rail station ' + s.name + ' is not on a line');
      }
      for (const line of RAIL_LINES) line.points = railTrackGeometry(line.route, held);
    }
    const RAIL_TOP_SPEED = 530;
    // How far the train can run before it must be stopped: to the next station on
    // its path, or to the end of the line, whichever comes first. Path points are
    // marked as stops once when the path is built, so this walk is just addition.
    const RAIL_LOOKAHEAD = 1600;
    function railStopDistance(t) {
      let total = 0,
        from = t;
      for (let i = t.index; i < t.path.length; i++) {
        const p = t.path[i];
        total += distanceBetween(from, p);
        from = p;
        if (p.stop) return total;
        if (total > RAIL_LOOKAHEAD) return RAIL_LOOKAHEAD;
      }
      return total;
    }
    const RAIL_DECK_TOP = 60,
      RAIL_DECK_HALF = 23,
      railTrains = [],
      railPiers = [];
    let railGraph = null,
      transitRide = null,
      transitStation = null,
      railDeckCache = null;
    // One straight deck box per track segment: collision, cover, the minimap and
    // the station orientation all read these. The track is fixed once built, so
    // the list is made once.
    function railDecks() {
      return (railDeckCache ||= RAIL_LINES.flatMap((line) =>
        line.points.slice(1).map((b, i) => {
          const a = line.points[i];
          return {
            x: (a[0] + b[0]) / 2,
            y: (a[1] + b[1]) / 2,
            hx: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2,
            hy: RAIL_DECK_HALF,
            a: Math.atan2(b[1] - a[1], b[0] - a[0]),
            minHeight: 52,
            height: RAIL_DECK_TOP,
            rail: true,
          };
        }),
      ));
    }
    // Points along a line at even arc length, with the track heading there.
    function railTrackSamples(line, first, spacing) {
      const out = [];
      let next = first,
        travelled = 0;
      for (let i = 1; i < line.points.length; i++) {
        const a = line.points[i - 1],
          b = line.points[i],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        while (next < travelled + len) {
          const d = next - travelled;
          out.push({ x: a[0] + Math.cos(angle) * d, y: a[1] + Math.sin(angle) * d, a: angle, along: next });
          next += spacing;
        }
        travelled += len;
      }
      return out;
    }
    // How far the carriageway under a bent reaches to either side of the deck's
    // centre line: 0 when the deck is not over a road, Infinity when the road runs
    // across the deck (a crossing is spanned, never propped).
    function railRoadReach(cx, cy, a) {
      if (!cityStreetAt(cx, cy)) return 0;
      let reach = 0;
      for (const side of [-1, 1]) {
        let d = 0;
        while (d <= 90 && cityStreetAt(cx - Math.sin(a) * side * d, cy + Math.cos(a) * side * d)) d += 3;
        if (d > 90) return Infinity;
        reach = Math.max(reach, d);
      }
      // A junction ahead or behind: leave the span clear.
      for (const along of [-70, 70])
        for (const side of [-1, 1])
          if (cityStreetAt(cx + Math.cos(a) * along - Math.sin(a) * side * (reach + 14), cy + Math.sin(a) * along + Math.cos(a) * side * (reach + 14)))
            return Infinity;
      return reach;
    }
    function prepareRailInfrastructure() {
      for (const s of RAIL_STATIONS) {
        const a = railStationAngle(s),
          candidates = [35, -35, 55, -55, 80, -80].map((d) => ({
            x: s.entry.x + Math.cos(a) * d,
            y: s.entry.y + Math.sin(a) * d,
          }));
        s.lift = candidates.find(
          (p) =>
            groundAt(p.x, p.y, 16) &&
            !onRoad(p.x, p.y) &&
            !buildings.some(
              (b) => p.x > b.x - 17 && p.x < b.x + b.w + 17 && p.y > b.y - 17 && p.y < b.y + b.h + 17,
            ) &&
            !garageBlocked(p.x, p.y, 15),
        ) || {
          x: s.entry.x,
          y: s.entry.y,
        };
      }
      railPiers.length = 0;
      /**
       * BENTS
       * One every 190 units of track, by travelled distance so that curves carry
       * theirs too. Three kinds, all drawn by transit3d.js:
       *   marine   over water: a pair of piles under the deck edges;
       *   portal   on open ground: a pair of columns under the deck edges;
       *   straddle over a street the deck follows (the el on Harbor Ave, Royal
       *            Ave and Airport Way): columns on the pavements either side of
       *            the carriageway and a cross-head spanning it, so traffic and
       *            the route graph keep the whole road.
       * Where the deck crosses a road, a dock, a bridge or a station forecourt the
       * bent is left out and the deck spans it.
       */
      const blockedAt = (x, y, r) =>
        !groundAt(x, y, r) ||
        cityStreetAt(x, y, r + 4) ||
        buildings.some((o) => x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r) ||
        garageBlocked(x, y, r) ||
        harborBlocked(x, y, r) ||
        airportSceneryBlocked(x, y, r) ||
        RAIL_STATIONS.some((s) => distanceBetween(s.entry, { x, y }) < 40 || distanceBetween(railLift(s), { x, y }) < 30);
      for (const line of RAIL_LINES)
        for (const bent of railTrackSamples(line, 95, 190)) {
          const { x: cx, y: cy, a } = bent;
          if (underpassContains(cx, cy, -30) || terrainHeight(cx, cy) > 12) continue;
          const nx = -Math.sin(a),
            ny = Math.cos(a),
            pair = (offset, kind, size) =>
              [-1, 1].map((side) => ({
                x: cx + nx * side * offset - size / 2,
                y: cy + ny * side * offset - size / 2,
                w: size,
                h: size,
                height: 52,
                cx,
                cy,
                kind,
                marine: kind === 'marine',
              }));
          if (!landAt(cx, cy)) {
            if (onBridge(cx, cy, 40) || onDock(cx, cy, 20)) continue;
            railPiers.push(...pair(17, 'marine', 7));
            continue;
          }
          const reach = railRoadReach(cx, cy, a);
          if (reach === Infinity) continue;
          const legs = reach ? pair(reach + 10, 'straddle', 6) : pair(17, 'portal', 7);
          if (legs.some((p) => blockedAt(p.x + p.w / 2, p.y + p.h / 2, reach ? 4 : 6))) continue;
          railPiers.push(...legs);
        }
      airCoverCache = null;
      routeGraph = null;
    }
    function railStationAngle(s) {
      const b = railDecks().reduce(
        (best, b) => {
          const q = coverLocal(b, s.x, s.y),
            d = Math.hypot(Math.max(0, Math.abs(q.x) - b.hx), q.y);
          return d < best.d
            ? {
                b,
                d,
              }
            : best;
        },
        {
          b: null,
          d: Infinity,
        },
      ).b;
      return b.a;
    }
    // Where a station's lift stands. It depends only on the track, so it is worked
    // out once per built track (solid() asks for every station on every call).
    const railLiftCache = new Map();
    function railLift(s) {
      if (s.lift) return s.lift;
      const decks = railDecks(),
        cached = railLiftCache.get(s);
      if (cached && cached.decks === decks) return cached.point;
      const a = railStationAngle(s),
        point = {
          x: s.entry.x + Math.cos(a) * 35,
          y: s.entry.y + Math.sin(a) * 35,
        };
      railLiftCache.set(s, { decks, point });
      return point;
    }
    function railAccessEnd(s) {
      const a = railStationAngle(s),
        lift = railLift(s),
        side = Math.sign(-(lift.x - s.x) * Math.sin(a) + (lift.y - s.y) * Math.cos(a)) || 1;
      return {
        x: s.x - Math.sin(a) * side * 33,
        y: s.y + Math.cos(a) * side * 33,
      };
    }
    function railStationCovers() {
      const blocks = [];
      for (const s of RAIL_STATIONS) {
        const a = railStationAngle(s),
          lift = railLift(s),
          end = railAccessEnd(s);
        for (const side of [-1, 1]) {
          const x = s.x - Math.sin(a) * side * 33,
            y = s.y + Math.cos(a) * side * 33;
          blocks.push(
            {
              x,
              y,
              hx: 82.5,
              hy: 9.5,
              a,
              minHeight: 54,
              height: 60,
              rail: true,
            },
            {
              x,
              y,
              hx: 87,
              hy: 12,
              a,
              minHeight: 86.5,
              height: 89.5,
              rail: true,
            },
          );
        }
        blocks.push({
          x: (end.x + lift.x) / 2,
          y: (end.y + lift.y) / 2,
          hx: distanceBetween(end, lift) / 2,
          hy: 7,
          a: headingBetween(lift, end),
          minHeight: 56.8,
          height: 60.8,
          rail: true,
        });
      }
      return blocks;
    }
    function railBlocked(x, y, r = 0) {
      if (
        RAIL_STATIONS.some((s) => {
          const p = railLift(s);
          return Math.abs(x - p.x) < 8.5 + r && Math.abs(y - p.y) < 8.5 + r;
        })
      )
        return true;
      const cell = railPierCells().get(Math.floor(x / 512) * 4096 + Math.floor(y / 512));
      if (!cell) return false;
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i];
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      return false;
    }
    // Piers bucketed by 512-unit cell; solid() asks about them for every pedestrian step.
    let railPierGrid = null,
      railPierGridCount = -1;
    function railPierCells() {
      if (railPierGrid && railPierGridCount === railPiers.length) return railPierGrid;
      railPierGrid = new Map();
      railPierGridCount = railPiers.length;
      for (const b of railPiers)
        for (let i = Math.floor((b.x - 16) / 512); i <= Math.floor((b.x + b.w + 16) / 512); i++)
          for (let j = Math.floor((b.y - 16) / 512); j <= Math.floor((b.y + b.h + 16) / 512); j++) {
            const key = i * 4096 + j;
            if (!railPierGrid.has(key)) railPierGrid.set(key, []);
            railPierGrid.get(key).push(b);
          }
      return railPierGrid;
    }
    function railNetwork() {
      if (railGraph) return railGraph;
      const nodes = [],
        segments = [],
        lookup = new Map(),
        add = (x, y) => {
          const key = Math.round(x * 10) + ',' + Math.round(y * 10);
          if (lookup.has(key)) return lookup.get(key);
          const id = nodes.length;
          nodes.push({
            x,
            y,
            links: [],
          });
          lookup.set(key, id);
          return id;
        };
      for (const l of RAIL_LINES)
        for (let i = 1; i < l.points.length; i++)
          segments.push({
            a: l.points[i - 1],
            b: l.points[i],
            cuts: [0, 1],
          });
      for (const s of segments) {
        const dx = s.b[0] - s.a[0],
          dy = s.b[1] - s.a[1],
          len2 = dx * dx + dy * dy;
        for (const p of [
          ...RAIL_LINES.flatMap((l) => l.points).map((p) => ({
            x: p[0],
            y: p[1],
          })),
          ...RAIL_STATIONS,
        ]) {
          const t = ((p.x - s.a[0]) * dx + (p.y - s.a[1]) * dy) / len2;
          if (t > 0 && t < 1 && segmentDistance(p.x, p.y, s.a, s.b) < 1) s.cuts.push(t);
        }
        s.cuts.sort((a, b) => a - b);
        for (let i = 1; i < s.cuts.length; i++) {
          const a = s.cuts[i - 1],
            b = s.cuts[i],
            u = add(s.a[0] + dx * a, s.a[1] + dy * a),
            v = add(s.a[0] + dx * b, s.a[1] + dy * b),
            cost = Math.hypot(dx, dy) * (b - a);
          if (u !== v) {
            nodes[u].links.push({
              id: v,
              cost,
            });
            nodes[v].links.push({
              id: u,
              cost,
            });
          }
        }
      }
      return (railGraph = nodes);
    }
    function railRoute(a, b) {
      const nodes = railNetwork(),
        nearest = (p) =>
          nodes.reduce(
            (best, q, i) => (distanceBetween(p, q) < distanceBetween(p, nodes[best]) ? i : best),
            0,
          );
      return navShortestPath(nodes, nearest(a), nearest(b));
    }
    function nearestStation() {
      return !player.car && !playerOnRoof() && !player.parachute
        ? RAIL_STATIONS.find((s, i) => withinRange('station' + i, distanceBetween(player, s.entry), 48, 60))
        : null;
    }
    function openTransit(s) {
      transitStation = s;
      gameMode = 'transit';
      keys = {};
      mouse.down = false;
      getElement('transitOverlay').classList.remove('hidden');
      getElement('transitTitle').textContent = s.name;
      getElement('transitOptions').replaceChildren();
      for (const target of RAIL_STATIONS) {
        if (target === s) continue;
        const route = railRoute(s, target);
        if (route.length < 2) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = target.name;
        button.onclick = () => boardTransit(target);
        getElement('transitOptions').appendChild(button);
      }
      getElement('transitTitle').focus();
      getElement('transitPanel').scrollTop = 0;
    }
    function closeTransit() {
      transitStation = null;
      getElement('transitOverlay').classList.add('hidden');
      if (gameMode === 'transit') gameMode = 'play';
      keys = {};
      canvas.focus();
    }
    function boardTransit(target) {
      if (gameMode !== 'transit' || !transitStation || player.car) return false;
      const from = transitStation,
        // Mark the stations on the way so the train brakes and calls at each.
        path = railRoute(from, target).map((p) => ({
          ...p,
          stop: RAIL_STATIONS.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 6),
        }));
      if (path.length < 2) return false;
      closeTransit();
      const train = {
        x: from.x,
        y: from.y,
        a: headingBetween(path[0], path[1]),
        speed: 0,
        path,
        index: 1,
        color: '#e2b766',
        passenger: true,
      };
      transitRide = {
        train,
        from,
        target,
        boarding: 2,
        exitRequested: false,
      };
      railTrains.push(train);
      player.x = train.x;
      player.y = train.y;
      player.altitude = 62;
      tell('CITY RAIL · ' + target.name + ' · E to get off at the next station', 5);
      return true;
    }
    function transitInteract() {
      if (transitRide) {
        transitRide.exitRequested = true;
        tell('Stop requested. Getting off at the next station.', 3);
        return true;
      }
      const s = nearestStation();
      if (s) {
        openTransit(s);
        return true;
      }
      return false;
    }
    function railExitPoint(s) {
      for (const r of [0, 24, 40, 60, 85, 110])
        for (let i = 0; i < (r ? 16 : 1); i++) {
          const x = s.entry.x + Math.cos((i * TAU) / 16) * r,
            y = s.entry.y + Math.sin((i * TAU) / 16) * r;
          if (
            !solid(x, y, 9) &&
            !vehicles.some(
              (c) => Math.abs(entityElevation(c) - terrainHeight(x, y)) < 20 && pointInCar(x, y, c, 12),
            )
          )
            return {
              x,
              y,
            };
        }
      return null;
    }
    function leaveTransit(s, force = false) {
      if (!transitRide) return true;
      const exit = railExitPoint(s);
      if (!exit && !force) {
        transitRide.blockedStop = s;
        transitRide.train.speed = 0;
        return false;
      }
      const train = transitRide.train;
      railTrains.splice(railTrains.indexOf(train), 1);
      transitRide = null;
      player.x = exit?.x ?? spawn.x;
      player.y = exit?.y ?? spawn.y;
      player.altitude = terrainHeight(player.x, player.y);
      player.inv = 1;
      keys = {};
      tell('ARRIVED · ' + s.name + ' · Your vehicle is where you left it.', 4);
      return true;
    }
    function resetTransit() {
      transitRide = null;
      railTrains.length = 0;
      // One scenic train shuttles up and down each line.
      RAIL_LINES.forEach((l, i) => {
        const points = l.points.map((p) => ({
            x: p[0],
            y: p[1],
            stop: RAIL_STATIONS.some((s) => Math.hypot(s.x - p[0], s.y - p[1]) < 6),
          })),
          path = [...points, ...points.slice(0, -1).reverse()];
        const a = headingBetween(path[0], path[1]),
          d = Math.min(160, distanceBetween(path[0], path[1]) * 0.65);
        railTrains.push({
          x: path[0].x + Math.cos(a) * d,
          y: path[0].y + Math.sin(a) * d,
          a,
          speed: 0,
          path,
          index: 1,
          color: l.color,
          wait: i * 3,
        });
      });
    }
    // Scenic trains dwell at every station; a passenger's train pauses briefly.
    const RAIL_DWELL = 4;
    function updateTransit(deltaSeconds) {
      if (transitRide?.blockedStop) {
        leaveTransit(transitRide.blockedStop);
        if (transitRide?.blockedStop) return;
      }
      for (const t of railTrains) {
        if (transitRide?.train === t && transitRide.boarding > 0) {
          transitRide.boarding -= deltaSeconds;
          continue;
        }
        if (t.wait > 0) {
          t.wait -= deltaSeconds;
          continue;
        }
        if (!t.path[t.index]) continue;
        // Brake for the next stop, not for the next point on the line: a curve is
        // a run of points 30-60 units apart and the train takes it at speed.
        t.speed = Math.min(
          RAIL_TOP_SPEED,
          Math.sqrt(Math.max(0, railStopDistance(t)) * 300),
          t.speed + 150 * deltaSeconds,
        );
        // Run on through as many track points as this frame's travel covers, so a
        // slow frame never holds the train back to one point per frame.
        let travel = Math.max(0.5, t.speed * deltaSeconds),
          ended = false;
        while (travel > 0) {
          const q = t.path[t.index],
            d = distanceBetween(t, q);
          if (d > travel) {
            t.a = headingBetween(t, q);
            t.x += Math.cos(t.a) * travel;
            t.y += Math.sin(t.a) * travel;
            break;
          }
          t.x = q.x;
          t.y = q.y;
          travel -= d;
          t.index++;
          if (t.index >= t.path.length) {
            if (t.passenger) {
              leaveTransit(transitRide.target);
              ended = true;
              break;
            }
            t.index = 1;
            t.wait = RAIL_DWELL + 1;
            t.speed = 0;
            break;
          }
          if (d > 0.01) t.a = headingBetween(q, t.path[t.index]);
          if (!q.stop) continue;
          if (t.passenger) {
            const station = RAIL_STATIONS.find((s) => distanceBetween(s, t) < 6);
            if (station && station !== transitRide.from) {
              if (transitRide.exitRequested) {
                leaveTransit(station);
                ended = true;
                break;
              }
              t.wait = 1.2;
              t.speed = 0;
              break;
            }
          } else {
            t.wait = RAIL_DWELL;
            t.speed = 0;
            break;
          }
        }
        if (ended) break;
        if (t.passenger) {
          player.x = t.x;
          player.y = t.y;
          player.a = t.a;
          player.altitude = 62;
        }
      }
    }
    // Where a car `behind` units back from the head of train `t` sits, and which
    // way it faces. The heading comes from the track 14 units either side of the
    // car's centre, so bodies swing smoothly through a curve's chords.
    function railPathPoint(t, behind) {
      let p = {
          x: t.x,
          y: t.y,
        },
        index = t.index - 1,
        left = behind,
        a = t.a;
      if (left < 0) {
        // Ahead of the head: along the path towards its next points.
        let ahead = -left,
          i = t.index;
        while (i < t.path.length) {
          const q = t.path[i],
            d = distanceBetween(p, q);
          if (d >= ahead) {
            const h = headingBetween(p, q);
            return { x: p.x + Math.cos(h) * ahead, y: p.y + Math.sin(h) * ahead };
          }
          ahead -= d;
          if (d > 0.01) a = headingBetween(p, q);
          p = q;
          i++;
        }
        return { x: p.x + Math.cos(a) * ahead, y: p.y + Math.sin(a) * ahead };
      }
      while (index >= 0) {
        const q = t.path[index],
          d = distanceBetween(p, q);
        if (d > left) {
          const heading = headingBetween(q, p);
          return {
            x: p.x - Math.cos(heading) * left,
            y: p.y - Math.sin(heading) * left,
          };
        }
        left -= d;
        if (d > 0.01) a = headingBetween(q, p);
        p = q;
        index--;
      }
      return {
        x: p.x - Math.cos(a) * left,
        y: p.y - Math.sin(a) * left,
      };
    }
    function railCarPosition(t, behind = 0) {
      const p = railPathPoint(t, behind),
        front = railPathPoint(t, behind - 14),
        back = railPathPoint(t, behind + 14);
      return {
        x: p.x,
        y: p.y,
        a: Math.hypot(front.x - back.x, front.y - back.y) > 1 ? headingBetween(back, front) : t.a,
      };
    }
    function drawTransit2D() {
      worldContext.save();
      for (const b of railDecks()) {
        if (!visible(b, b.hx + 40)) continue;
        worldContext.save();
        worldContext.translate(b.x, b.y - 18);
        worldContext.rotate(b.a);
        worldContext.fillStyle = '#354c5666';
        worldContext.fillRect(-b.hx, -23, b.hx * 2, 46);
        worldContext.fillStyle = '#92a9ab';
        for (const z of [-10, 10]) worldContext.fillRect(-b.hx, z, b.hx * 2, 2);
        worldContext.restore();
      }
      for (const t of railTrains) {
        if (!visible(t, 190)) continue;
        for (let i = 0; i < 3; i++) {
          const p = railCarPosition(t, i * 54);
          worldContext.save();
          worldContext.translate(p.x, p.y - 18);
          worldContext.rotate(p.a);
          worldContext.fillStyle = t.color;
          worldContext.fillRect(-23, -12, 47, 24);
          worldContext.fillStyle = '#234655';
          worldContext.fillRect(-13, -8, 26, 16);
          worldContext.restore();
        }
      }
      for (const s of RAIL_STATIONS) {
        if (visible(s.entry, 65)) {
          worldContext.fillStyle = '#224653';
          worldContext.fillRect(s.entry.x - 10, s.entry.y - 10, 20, 20);
          worldContext.fillStyle = '#d4e7cf';
          worldContext.font = 'bold 14px Arial';
          worldContext.textAlign = 'center';
          worldContext.fillText('M', s.entry.x, s.entry.y + 5);
        }
      }
      worldContext.restore();
    }
    function drawTransitMap(drawingContext, scale, big) {
      for (const line of RAIL_LINES) {
        drawingContext.save();
        drawingContext.setLineDash([7 / scale, 3 / scale]);
        strokeRoad(drawingContext, line.points, 2 / scale, line.color);
        drawingContext.restore();
      }
      drawingContext.save();
      drawingContext.font = 'bold ' + 10 / scale + 'px Arial';
      drawingContext.textAlign = 'center';
      for (const s of RAIL_STATIONS) {
        drawingContext.fillStyle = '#173f4b';
        drawingContext.beginPath();
        drawingContext.arc(s.x, s.y, 7 / scale, 0, TAU);
        drawingContext.fill();
        drawingContext.strokeStyle = '#d3e9ca';
        drawingContext.lineWidth = 1.5 / scale;
        drawingContext.stroke();
        drawingContext.fillStyle = '#e5f1d1';
        drawingContext.fillText('M', s.x, s.y + 3.5 / scale);
        if (big && mapZoom > 2) {
          drawingContext.fillText(s.name, s.x, s.y - 12 / scale);
        }
      }
      drawingContext.restore();
    }
    getElement('closeTransit').onclick = closeTransit;
    // END SUBSYSTEM: src/transit.js
