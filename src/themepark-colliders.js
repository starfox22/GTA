    // ---- Colliders -----------------------------------------------------------------
    /**
     * Everything solid in the park as rectangles {x, y, w, h, height}: buildings,
     * ride bases, the Eye's legs and terminal, the lagoon's rim, the coaster's
     * station and its support footings. People test them through parkBlocked
     * (a 128-unit grid), vehicles through addStatic (physics.js).
     */
    let parkSolidList = null,
      parkSolidGrid = null;
    const PARK_CELL = 128;
    function parkSolids() {
      if (parkSolidList) return parkSolidList;
      const list = [],
        box = (x, y, w, h, height, kind) => list.push({ x, y, w, h, height, kind });
      const p = PIER;
      box(p.terminal.x, p.terminal.y, p.terminal.w, p.terminal.h, p.terminal.height, 'eye terminal');
      for (const side of [-1, 1]) box(p.gate.x + side * 77 - 22.5, p.gate.y - 30, 45, 30, 150, 'gate tower');
      for (const [fx, fy] of wheelFeet()) box(fx - 9, fy - 9, 18, 18, p.wheel.hub, 'eye leg');
      box(p.hotel.x - p.hotel.w / 2, p.hotel.y - p.hotel.d / 2, p.hotel.w, p.hotel.d, p.hotel.height, 'hotel');
      box(p.beachClub.x + 150, p.beachClub.y + 10, 180, 50, 36, 'beach club');
      box(p.bumper.x, p.bumper.y, p.bumper.w, p.bumper.h, 34, 'bumper cars');
      box(p.darkRide.x, p.darkRide.y, p.darkRide.w, p.darkRide.h, 58, 'dark ride');
      box(p.foodCourt.x, p.foodCourt.y, p.foodCourt.w, p.foodCourt.h, 30, 'food court');
      box(p.station.x - 70, -6460, 150, 44, 34, 'coaster station');
      for (const r of [p.carousel, p.teacups]) box(r.x - r.r, r.y - r.r, r.r * 2, r.r * 2, 20, 'ride');
      box(p.swing.x - p.swing.r, p.swing.y - p.swing.r, p.swing.r * 2, p.swing.r * 2, 90, 'swing ride');
      box(p.dropTower.x - 22, p.dropTower.y - 22, 44, 44, 300, 'drop tower');
      for (const s of flumeSolids()) list.push(s);
      for (const k of parkKiosks()) box(k.x - k.w / 2, k.y - k.h / 2, k.w, k.h, 18, 'kiosk');
      // The lagoon's rim, as a ring of rectangles round the ellipse.
      const L = p.lagoon;
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU,
          x = L.x + Math.cos(a) * (L.rx - 18),
          y = L.y + Math.sin(a) * (L.ry - 18),
          r = 22 + Math.abs(Math.cos(a)) * 8;
        box(x - r, y - r, r * 2, r * 2, 3, 'lagoon');
      }
      box(L.x - L.rx + 30, L.y - L.ry + 40, (L.rx - 30) * 2, (L.ry - 40) * 2, 3, 'lagoon');
      for (const f of coasterFootings()) box(f.x - 5, f.y - 5, 10, 10, f.height, 'coaster support');
      // UNICORN STATUE: the granite plinth is solid stone to people and cars,
      // its octagon (apothem 24, sides 19.9 long) as two slabs and a square
      // whose corners stay inside it; the statue's core stands in the middle
      // as tall as her horn tip (13 m above the lawn).
      const U = p.unicorn;
      box(U.x - 24, U.y - 9.9, 48, 19.8, 10.4, 'unicorn statue');
      box(U.x - 9.9, U.y - 24, 19.8, 48, 10.4, 'unicorn statue');
      box(U.x - 16.9, U.y - 16.9, 33.8, 33.8, 10.4, 'unicorn statue');
      box(U.x - 10, U.y - 10, 20, 20, 106, 'unicorn statue');
      parkSolidList = list;
      parkSolidGrid = new Map();
      list.forEach((b, i) => {
        for (let cx = Math.floor(b.x / PARK_CELL); cx <= Math.floor((b.x + b.w) / PARK_CELL); cx++)
          for (let cy = Math.floor(b.y / PARK_CELL); cy <= Math.floor((b.y + b.h) / PARK_CELL); cy++) {
            const key = cx * 4096 + cy;
            if (!parkSolidGrid.has(key)) parkSolidGrid.set(key, []);
            parkSolidGrid.get(key).push(i);
          }
      });
      return list;
    }
    function parkBlocked(x, y, r = 0) {
      if (y > -5690 || y < -7100 || x < 1820 || x > 4270) return false;
      if (inLagoon(x, y, r - 4)) return true;
      const list = parkSolids(),
        cell = parkSolidGrid.get(Math.floor(x / PARK_CELL) * 4096 + Math.floor(y / PARK_CELL));
      if (!cell) return false;
      for (const i of cell) {
        const b = list[i];
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      return false;
    }
    /* In the air only (minHeight): the Eye's rim and capsules, the hotel's crown
       and the high parts of the coaster, so a helicopter cannot fly through them. */
    function parkAirSolids() {
      const w = PIER.wheel,
        list = [];
      // The wheel as a stack of slices across the disc.
      for (let z = w.hub - w.r - 30; z < w.hub + w.r + 30; z += 60) {
        const dz = Math.min(w.r + 30, Math.abs(z + 30 - w.hub)),
          half = Math.sqrt(Math.max(0, (w.r + 30) ** 2 - dz * dz));
        list.push({ x: w.x - half, y: w.y - 30, w: half * 2, h: 60, height: z + 60, minHeight: z });
      }
      // The coaster above 90 units: one box per 40 units of track.
      const T = coasterCircuit();
      for (let i = 0; i < T.count; i += 20)
        if (T.Z[i] > 90) list.push({ x: T.X[i] - 14, y: T.Y[i] - 14, w: 28, h: 28, height: T.Z[i] + 20, minHeight: 60 });
      return list;
    }
    /* The Eye's four feet: an A-frame either side of the rim plane. */
    function wheelFeet() {
      const w = PIER.wheel;
      return [
        [w.x - 130, w.y - 82],
        [w.x + 130, w.y - 82],
        [w.x - 130, w.y + 82],
        [w.x + 130, w.y + 82],
      ];
    }
    /* Kiosks, stalls and carts along the promenades (drawn by themepark3d.js). */
    function parkKiosks() {
      return [
        { x: 3050, y: -6180, w: 22, h: 16, kind: 'drinks', a: 0 },
        { x: 3300, y: -6170, w: 22, h: 16, kind: 'icecream', a: 0 },
        { x: 3420, y: -6330, w: 22, h: 16, kind: 'popcorn', a: 0 },
        { x: 2990, y: -6560, w: 22, h: 16, kind: 'dates', a: 0 },
        { x: 3830, y: -6300, w: 22, h: 16, kind: 'candy', a: 0 },
        { x: 3960, y: -6250, w: 60, h: 26, kind: 'games', a: 0 },
        { x: 3960, y: -6200, w: 60, h: 26, kind: 'games', a: 0 },
        { x: 3845, y: -6560, w: 40, h: 26, kind: 'games', a: 0 },
        { x: 2740, y: -6300, w: 22, h: 16, kind: 'drinks', a: 0 },
        { x: 3700, y: -6920, w: 26, h: 18, kind: 'bar', a: 0 },
      ];
    }
    /* Coaster supports: a footing every ~22 units where the track is in the air,
       kept off the paths, the lagoon and the buildings. Where the track is banked
       steeply or upside down the column stands beside it and an arm reaches the
       spine; a column never rises through a lower part of the track. */
    let coasterFootingList = null;
    function coasterFootings() {
      if (coasterFootingList) return coasterFootingList;
      const T = coasterCircuit(),
        list = [],
        f = {};
      for (let i = 0; i < T.count; i += 11) {
        coasterFrame(i * T.ds, f);
        if (f.kind === 1 || Math.abs(f.tz) > 0.75) continue;
        // The spine hangs 3.8 below the rails (above them when inverted).
        const sx = f.x - f.ux * 3.8,
          sy = f.y - f.uy * 3.8,
          sz = f.z - f.uz * 3.8;
        if (sz < 9) continue;
        const h = Math.hypot(f.tx, f.ty) || 1,
          hx = f.tx / h,
          hy = f.ty / h;
        let x = sx,
          y = sy,
          side = false;
        if (f.uz < 0.6) {
          // Beside the track, on the side the spine hangs towards.
          const k = -hy * f.ux + hx * f.uy > 0 ? -1 : 1;
          x = sx - hy * k * 26;
          y = sy + hx * k * 26;
          side = true;
        }
        const top = side ? sz : sz - 1.8;
        if (parkPathNear(x, y, 12) || inLagoon(x, y, 20) || parkBuildingAt(x, y, 12)) continue;
        if (list.some((o) => Math.hypot(o.x - x, o.y - y) < 18)) continue;
        // Nothing of the circuit may pass through the column below its top.
        let clear = true;
        for (let j = 0; j < T.count && clear; j += 2)
          if (Math.abs(j - i) > 12 && Math.abs(T.X[j] - x) < 9 && Math.abs(T.Y[j] - y) < 9 && T.Z[j] < top + 4) clear = false;
        if (!clear) continue;
        list.push({ x, y, height: top, top, side, attach: { x: sx, y: sy, z: sz }, dx: hx, dy: hy });
      }
      coasterFootingList = list;
      return list;
    }
    function inLagoon(x, y, pad = 0) {
      const L = PIER.lagoon;
      return ((x - L.x) / (L.rx + pad)) ** 2 + ((y - L.y) / (L.ry + pad)) ** 2 < 1;
    }
    function parkBuildingAt(x, y, pad = 0) {
      const p = PIER,
        rects = [
          [p.terminal.x, p.terminal.y, p.terminal.w, p.terminal.h],
          [p.hotel.x - p.hotel.w / 2, p.hotel.y - p.hotel.d / 2, p.hotel.w, p.hotel.d],
          [p.station.x - 70, -6460, 150, 44],
          [p.station.x - 70, -6412, 150, 62],
          [p.plaza.x, p.plaza.y, p.plaza.w, p.plaza.h],
        ];
      return rects.some(([rx, ry, rw, rh]) => x > rx - pad && x < rx + rw + pad && y > ry - pad && y < ry + rh + pad);
    }
    // ---- Paths ---------------------------------------------------------------------
    /**
     * The promenades as polylines with a width; painted on the ground tile and
     * joined into a graph the park crowd walks (shared end points are junctions).
     */
    const PARK_PATHS = [
      // Gate plaza to the lagoon, round the lagoon, and on to the hotel.
      { w: 64, points: [[3200, -6040], [3200, -6200]] },
      { w: 40, ring: true },
      { w: 48, points: [[3170, -6535], [3170, -6690], [3530, -6690], [3895, -6690]] },
      // West: past the lagoon to the Falcon's queue and the coaster garden.
      { w: 44, points: [[2930, -6370], [2780, -6370], [2690, -6370]] },
      { w: 36, points: [[3060, -6030], [2900, -6030], [2740, -6110], [2560, -6110], [2430, -6000]] },
      { w: 36, points: [[2780, -6370], [2780, -6110]] },
      // East: under the Eye to the midway.
      { w: 40, points: [[3340, -6030], [3515, -6050]] },
      { w: 44, points: [[3370, -6360], [3620, -6360], [3895, -6360]] },
      { w: 56, points: [[3895, -6150], [3895, -6360], [3895, -6690]] },
      { w: 36, points: [[3780, -6690], [3780, -6860], [3560, -6860]] },
      { w: 36, points: [[3895, -6450], [3985, -6450]] },
    ];
    let parkGraph = null;
    function parkPathSegments() {
      const segs = [];
      const L = PIER.lagoon;
      for (const p of PARK_PATHS) {
        let pts = p.points;
        if (p.ring) {
          pts = [];
          for (let i = 0; i <= 16; i++) {
            const a = (i / 16) * TAU;
            pts.push([Math.round(L.x + Math.cos(a) * (L.rx + 40)), Math.round(L.y + Math.sin(a) * (L.ry + 40))]);
          }
        }
        for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i], w: p.w });
      }
      return segs;
    }
    function parkPathNear(x, y, pad = 0) {
      for (const s of parkPathSegments.cache || (parkPathSegments.cache = parkPathSegments())) {
        const [ax, ay] = s.a,
          [bx, by] = s.b,
          dx = bx - ax,
          dy = by - ay,
          t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        if (Math.hypot(ax + dx * t - x, ay + dy * t - y) < s.w / 2 + pad) return true;
      }
      return false;
    }
    /* Junction graph: every path vertex is a node; the lagoon ring's nodes are
       also joined to the nearest spoke end so the ring connects to the spokes. */
    function parkPathGraph() {
      if (parkGraph) return parkGraph;
      const nodes = [],
        key = (p) => p[0] + ',' + p[1],
        index = new Map(),
        node = (p) => {
          if (!index.has(key(p))) {
            index.set(key(p), nodes.length);
            nodes.push({ x: p[0], y: p[1], links: [] });
          }
          return index.get(key(p));
        };
      const link = (a, b) => {
        if (a === b || nodes[a].links.includes(b)) return;
        nodes[a].links.push(b);
        nodes[b].links.push(a);
      };
      for (const s of parkPathSegments()) link(node(s.a), node(s.b));
      // Join ends that meet a path in the middle, and ring spokes, to their nearest node.
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].links.length > 1) continue;
        let best = -1,
          bestD = 60;
        for (let j = 0; j < nodes.length; j++) {
          if (j === i || nodes[i].links.includes(j)) continue;
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        }
        if (best >= 0) link(i, best);
      }
      parkGraph = nodes;
      return nodes;
    }
    function parkRoute(from, to) {
      const nodes = parkPathGraph(),
        prev = new Map([[from, -1]]),
        queue = [from];
      while (queue.length) {
        const n = queue.shift();
        if (n === to) break;
        for (const m of nodes[n].links)
          if (!prev.has(m)) {
            prev.set(m, n);
            queue.push(m);
          }
      }
      if (!prev.has(to)) return null;
      const route = [];
      for (let n = to; n !== -1; n = prev.get(n)) route.unshift(n);
      return route;
    }
    function nearestParkNode(x, y) {
      const nodes = parkPathGraph();
      let best = 0,
        bestD = Infinity;
      nodes.forEach((n, i) => {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    }
