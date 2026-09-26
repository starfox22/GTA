    // BEGIN SUBSYSTEM: src/monarch-life.js — Monarch Isle: traffic, people, boats and sound
    /**
     * Monarch Isle: life
     * Source: src/monarch-life.js
     * Scope: shared game closure (after monarch.js and crowd.js).
     *
     * TRAFFIC. The island's streets are a graph (isleRoadGraph): nodes at the
     * grid junctions, the two roundabouts, the city end of the Sovereign Bridge
     * and the Eagle Pass end of the Regency Road; links along the streets with a
     * lane each way (right-hand traffic: 24 off the centre line on a plain
     * street, 36 on a boulevard's carriageway). A car (`c.isle`) follows its
     * lane and, as it nears a node, picks the next link (mostly straight on),
     * then drives the crossing: a straight line or a curve through a junction,
     * round the ring anticlockwise at a roundabout (entering only when the ring
     * is clear to its left), a U-turn at the end of the road. At a junction it
     * waits while another car is in the box (an all-way stop). Past the
     * Sovereign Bridge's city end the car becomes ordinary city traffic; city
     * traffic that drives east over the bridge becomes island traffic. The cars
     * follow, slow for corners and stop for people as the county traffic does.
     *
     * PEOPLE. Walkers (`p.isle`) use a pavement graph: the corners of every
     * junction, the pavements between them, the zebra crossings, the ring walks
     * of the roundabouts, the marina promenade, the beach paths, the garden's
     * walks. They go from place to place (shop doors, where they may go in for a
     * while, the Palm House, the pond, the fountains, the marina, the beach),
     * stop to look and take photographs, and some jog or walk the dog. Doormen
     * and valets stand at the hotel and the restaurant, security guards at the
     * villa gates. They only exist while the player is near the island.
     *
     * BOATS. A few tenders, speedboats and a launch cruise loops out of the
     * basin and along the channel (`c.isleBoat`, steered by isleBoatHelm).
     *
     * SOUND. Rigging clinking and halyards slapping in the marina, gulls,
     * running water near the fountains and the pond, birdsong in the garden.
     */
    const ISLE_CITY_END = { x: 3290, y: -2944 },
      ISLE_RIDGE_END = { x: 6500, y: 1800 };
    let isleGraphCache = null;
    function isleRoadGraph() {
      if (isleGraphCache) return isleGraphCache;
      const nodes = [],
        links = [],
        nodeAt = (x, y, kind, extra = {}) => {
          let n = nodes.find((o) => Math.abs(o.x - x) < 1 && Math.abs(o.y - y) < 1);
          if (!n) nodes.push((n = { id: nodes.length, x, y, kind, links: [], ...extra }));
          return n;
        };
      for (const j of isleJunctions()) nodeAt(j.x, j.y, 'junction', { kx: isleKerbHalf(j.x, true), ky: isleKerbHalf(j.y, false) });
      for (const c of ISLE_CIRCLES) nodeAt(c.x, c.y, 'circle', { circle: c });
      const link = (a, b, points, lane, speed, name) => {
        let length = 0;
        for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        const l = { id: links.length, a, b, points, lane, speed, name, length };
        links.push(l);
        a.links.push(l);
        b.links.push(l);
        return l;
      };
      for (const s of ISLE_STREETS) {
        const on = nodes
          .filter((n) => (s.vertical ? Math.abs(n.x - s.at) < 1 && n.y >= s.from - 1 && n.y <= s.to + 1 : Math.abs(n.y - s.at) < 1 && n.x >= s.from - 1 && n.x <= s.to + 1))
          .sort((p, q) => (s.vertical ? p.y - q.y : p.x - q.x));
        for (let i = 1; i < on.length; i++)
          link(on[i - 1], on[i], [[on[i - 1].x, on[i - 1].y], [on[i].x, on[i].y]], s.divided ? ISLE_DIVIDED_LANE : ISLE_LANE, (s.divided ? 50 : 42) * KMH, s.name);
      }
      const west = nodes.find((n) => Math.abs(n.x - 5600) < 1 && Math.abs(n.y + 2944) < 1),
        harbour = nodes.find((n) => n.circle?.id === 'harbour'),
        cityEnd = nodeAt(ISLE_CITY_END.x, ISLE_CITY_END.y, 'city'),
        ridgeEnd = nodeAt(ISLE_RIDGE_END.x, ISLE_RIDGE_END.y, 'end');
      link(cityEnd, west, [[cityEnd.x, cityEnd.y], [west.x, west.y]], 30, 70 * KMH, 'SOVEREIGN BRIDGE');
      link(harbour, ridgeEnd, [[harbour.x, harbour.y], ...MONARCH_RIDGE_ROAD.points], 24, 60 * KMH, 'REGENCY BRIDGE');
      return (isleGraphCache = { nodes, links });
    }
    // A point on a link's lane at distance d from its start, travelling in `dir`.
    function isleLanePoint(link, dir, d, out = {}) {
      const pts = link.points,
        n = pts.length;
      let remaining = dir > 0 ? d : link.length - d;
      for (let i = 1; i < n; i++) {
        const a = pts[i - 1],
          b = pts[i],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (remaining <= len || i === n - 1) {
          const t = clamp(remaining / len, 0, 1),
            ux = (b[0] - a[0]) / len,
            uy = (b[1] - a[1]) / len,
            // Right of the direction of travel (map y points south).
            hx = dir > 0 ? ux : -ux,
            hy = dir > 0 ? uy : -uy;
          out.x = a[0] + (b[0] - a[0]) * t - hy * link.lane;
          out.y = a[1] + (b[1] - a[1]) * t + hx * link.lane;
          out.a = Math.atan2(hy, hx);
          return out;
        }
        remaining -= len;
      }
      return out;
    }
    // How far from a node a lane stops before the crossing.
    function isleNodeTrim(node, link) {
      if (node.kind === 'circle') return node.circle.outer + 10;
      if (node.kind === 'junction') {
        const alongX = Math.abs(link.points[1][1] - link.points[0][1]) < 1;
        return (alongX ? node.kx : node.ky) + 22;
      }
      return 0;
    }
    /* The drive along a link toward the node at its far end: lane points from the
       start trim to the end trim. */
    function isleLinkPath(link, dir) {
      const from = dir > 0 ? link.a : link.b,
        to = dir > 0 ? link.b : link.a,
        d0 = isleNodeTrim(from, link),
        d1 = link.length - isleNodeTrim(to, link),
        path = [];
      for (let d = d0; d < d1; d += 60) path.push({ ...isleLanePoint(link, dir, d) });
      path.push({ ...isleLanePoint(link, dir, d1) });
      return path;
    }
    /* The crossing of a node from the end of one lane to the start of the next. */
    function isleCrossing(node, inLink, inDir, outLink, outDir) {
      const E = isleLanePoint(inLink, inDir, inLink.length - isleNodeTrim(node, inLink)),
        X = isleLanePoint(outLink, outDir, isleNodeTrim(node, outLink)),
        points = [];
      if (node.kind === 'circle') {
        const c = node.circle,
          aIn = Math.atan2(E.y - c.y, E.x - c.x),
          aOut = Math.atan2(X.y - c.y, X.x - c.x);
        // Anticlockwise seen from above: the map angle decreases.
        let sweep = aIn - aOut;
        while (sweep <= 0.35) sweep += TAU;
        const r = c.lane,
          steps = Math.max(3, Math.ceil(sweep / 0.3));
        for (let k = 0; k <= steps; k++) {
          const a = aIn - 0.12 - ((sweep - 0.24) * k) / steps;
          points.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
        }
        points.push({ x: X.x, y: X.y });
        return { points, entry: E, exit: X, ring: true };
      }
      if (node.kind === 'end') {
        // A U-turn: a half circle to the other lane.
        const back = E.a + Math.PI,
          r = inLink.lane;
        for (let k = 1; k <= 8; k++) {
          const t = (k / 8) * Math.PI,
            cx = E.x + Math.cos(E.a + Math.PI / 2) * -r,
            cy = E.y + Math.sin(E.a + Math.PI / 2) * -r;
          points.push({ x: cx + Math.cos(E.a + Math.PI / 2 - t) * r + Math.cos(E.a) * Math.sin(t) * 16, y: cy + Math.sin(E.a + Math.PI / 2 - t) * r + Math.sin(E.a) * Math.sin(t) * 16 });
        }
        void back;
        return { points, entry: E, exit: points.at(-1), uturn: true };
      }
      const turn = Math.abs(normalizeAngle(X.a - E.a)) > 0.3;
      if (!turn) return { points: [{ x: X.x, y: X.y }], entry: E, exit: X };
      // A quadratic curve with its control where the two lanes cross.
      const ux = Math.cos(E.a),
        uy = Math.sin(E.a),
        vx = Math.cos(X.a),
        vy = Math.sin(X.a),
        cross = ux * vy - uy * vx,
        k = ((X.x - E.x) * vy - (X.y - E.y) * vx) / cross,
        cx = E.x + ux * k,
        cy = E.y + uy * k;
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        points.push({ x: (1 - t) ** 2 * E.x + 2 * (1 - t) * t * cx + t * t * X.x, y: (1 - t) ** 2 * E.y + 2 * (1 - t) * t * cy + t * t * X.y });
      }
      return { points, entry: E, exit: X, turn: true };
    }
    // The next link out of a node: straight on is likeliest, never straight back.
    function isleNextLink(node, inLink) {
      const options = node.links.filter((l) => l !== inLink);
      if (!options.length) return inLink;
      const inDir = inLink.b === node ? 1 : -1,
        inA = isleLanePoint(inLink, inDir, inLink.length - 1).a;
      const weight = (l) => {
        const outDir = l.a === node ? 1 : -1,
          a = isleLanePoint(l, outDir, 1).a,
          straight = Math.abs(normalizeAngle(a - inA)) < 0.4;
        // The city end of the bridge and the Regency Road are taken now and then.
        const rare = l.name === 'SOVEREIGN BRIDGE' || l.name === 'REGENCY BRIDGE' ? 0.3 : 1;
        return (straight ? 2.4 : 1) * rare;
      };
      let total = 0;
      for (const l of options) total += weight(l);
      let r = seededRandom() * total;
      for (const l of options) {
        r -= weight(l);
        if (r <= 0) return l;
      }
      return options[0];
    }
    /* Put a car on a link, `d` along it in direction `dir`. */
    function isleTrafficJoin(c, link, dir, d = 0) {
      const path = isleLinkPath(link, dir);
      let index = 0;
      while (index < path.length - 1 && Math.hypot(path[index].x - c.x, path[index].y - c.y) > Math.hypot(path[index + 1].x - c.x, path[index + 1].y - c.y)) index++;
      c.isle = { link, dir, path, index: Math.min(index + 1, path.length - 1), crossing: null, node: null, waited: 0, d };
      c.countyRoute = null;
      c.junction = null;
    }
    /* The island's traffic controller (physics.js calls it for `c.isle` cars):
       returns the steering and the speed wanted, as trafficControl does. */
    function isleTrafficControl(c) {
      const s = c.isle,
        spec = vehicleSpec(c);
      if (!s.crossing && s.index >= s.path.length - 1 && Math.hypot(s.path.at(-1).x - c.x, s.path.at(-1).y - c.y) < 34) {
        // At the end of the lane: plan the crossing of the node ahead.
        const node = s.dir > 0 ? s.link.b : s.link.a;
        if (node.kind === 'city') {
          // Hand over to city traffic on Crown Avenue's Northbank end.
          c.isle = null;
          c.navAngle = Math.PI;
          c.junction = null;
          return trafficControl(c, 1 / 60);
        }
        const out = node.kind === 'end' ? s.link : isleNextLink(node, s.link),
          outDir = out.a === node ? 1 : -1;
        s.crossing = isleCrossing(node, s.link, s.dir, out, node.kind === 'end' ? -s.dir : outDir);
        s.node = node;
        s.next = { link: out, dir: node.kind === 'end' ? -s.dir : outDir };
        s.cIndex = 0;
        s.granted = false;
      }
      let target,
        desired = s.link.speed * (0.92 + (c.id % 5) * 0.04);
      if (s.crossing) {
        const X = s.crossing;
        if (!s.granted) {
          // Wait at the line while the box (or the ring to the left) is busy.
          const busy = isleNodeBusy(c, s.node, X);
          s.waited += busy ? 1 / 20 : 0;
          // A long wait (a ring that never clears, a stalled car) lets the car
          // go, but never into a box that already has a car in it.
          if (busy && (s.waited < 8 || isleBoxOccupied(c, s.node))) {
            const gap = Math.hypot(X.entry.x - c.x, X.entry.y - c.y) - spec.l / 2;
            desired = Math.min(desired, Math.max(0, gap - 4) * 1.2);
            target = X.points[0];
          } else {
            s.granted = true;
            s.waited = 0;
          }
        }
        if (s.granted) {
          while (s.cIndex < X.points.length - 1 && Math.hypot(X.points[s.cIndex].x - c.x, X.points[s.cIndex].y - c.y) < 18) s.cIndex++;
          target = X.points[s.cIndex];
          desired = Math.min(desired, X.ring ? 24 * KMH : X.turn || X.uturn ? 18 * KMH : 32 * KMH);
          if (s.cIndex >= X.points.length - 1 && Math.hypot(X.exit.x - c.x, X.exit.y - c.y) < 22) {
            isleTrafficJoin(c, s.next.link, s.next.dir);
            return isleTrafficControl(c);
          }
        }
      } else {
        while (s.index < s.path.length - 1 && Math.hypot(s.path[s.index].x - c.x, s.path[s.index].y - c.y) < 40) s.index++;
        target = s.path[s.index];
        // Ease off for the node ahead.
        const end = s.path.at(-1),
          left = Math.hypot(end.x - c.x, end.y - c.y);
        desired = Math.min(desired, Math.sqrt((22 * KMH) ** 2 + 2 * 0.35 * GRAVITY * Math.max(0, left - 20)));
      }
      const da = normalizeAngle(headingBetween(c, target) - c.a);
      desired *= clamp(1 - Math.abs(da) * 0.5, 0.2, 1);
      s.blocker = null;
      // Follow whatever is ahead in the lane.
      const hc = Math.cos(c.a),
        hs = Math.sin(c.a);
      for (const o of vehicles) {
        if (o === c || (o.altitude || 0) > 15 || o.hp <= 0) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y;
        if (dx > 240 || dx < -240 || dy > 240 || dy < -240) continue;
        const along = dx * hc + dy * hs,
          side = Math.abs(-dx * hs + dy * hc);
        if (along > 0 && along < 200 && side < (spec.w + vehicleSpec(o).w) / 2 + 6) {
          const lead = Math.max(0, (o.vx || 0) * hc + (o.vy || 0) * hs),
            limit = lead + Math.max(0, along - (spec.l + vehicleSpec(o).l) / 2 - 18 - lead * 0.8) * 1.2;
          if (limit < desired) {
            desired = limit;
            s.blocker = o;
          }
        }
      }
      // People in the carriageway ahead (on a zebra, or wandering): not those on the pavement.
      const yieldTo = (p) => {
        // Nobody frozen out of the player's range (people there do not move).
        if (p.hp <= 0 || Math.abs(p.x - player.x) > 1500 || Math.abs(p.y - player.y) > 1500 || !monarchRoadAt(p.x, p.y, 3)) return;
        const dx = p.x - c.x,
          dy = p.y - c.y,
          along = dx * hc + dy * hs,
          side = Math.abs(-dx * hs + dy * hc);
        if (along > 0 && along < 130 && side < spec.w / 2 + 14) {
          const limit = Math.sqrt(2 * 0.6 * GRAVITY * Math.max(0, along - spec.l / 2 - 16));
          if (limit < desired) (desired = limit), (s.yielding = { x: Math.round(p.x), y: Math.round(p.y), role: p.role, post: !!p.isle?.post, player: p === player });
        }
      };
      s.yielding = null;
      forEachPedestrianNear(c.x, c.y, 130, yieldTo);
      if (!player.car) yieldTo(player);
      if (c.panicUntil > gameTime) desired = 80 * KMH;
      s.desired = desired;
      // How long it has stood still (the report's stuck test).
      const now = gameTime;
      if (Math.hypot(c.vx || 0, c.vy || 0) > 8) s.stillSince = now;
      else s.stillSince ??= now;
      s.target = target;
      return { steer: clamp(da * 2.6, -1.6, 1.6), desired };
    }
    function isleBoxOccupied(c, node) {
      if (node.kind !== 'junction') return false;
      for (const o of vehicles) {
        if (o === c || o.hp <= 0 || (o.altitude || 0) > 15) continue;
        if (Math.abs(o.x - node.x) < node.kx + 4 && Math.abs(o.y - node.y) < node.ky + 4) return true;
      }
      return false;
    }
    // Is anything in the way of crossing this node?
    function isleNodeBusy(c, node, X) {
      for (const o of vehicles) {
        if (o === c || o.hp <= 0 || (o.altitude || 0) > 15) continue;
        if (Math.abs(o.x - node.x) > 260 || Math.abs(o.y - node.y) > 260) continue;
        if (node.kind === 'circle') {
          // On the ring and coming round toward the entry, within a quarter turn.
          const r = Math.hypot(o.x - node.x, o.y - node.y);
          if (r < node.circle.island || r > node.circle.outer + 4) continue;
          const aO = Math.atan2(o.y - node.y, o.x - node.x),
            aE = Math.atan2(X.entry.y - node.y, X.entry.x - node.x),
            ahead = normalizeAngle(aO - aE);
          if (ahead > 0 && ahead < 1.6) return true;
        } else if (o.isle?.node === node && o.isle.granted && o.isle.crossing) return true;
        else if (node.kind === 'junction' && !o.isle && Math.abs(o.x - node.x) < node.kx + 6 && Math.abs(o.y - node.y) < node.ky + 6 && Math.hypot(o.vx || 0, o.vy || 0) > 8) return true;
      }
      if (player.car && Math.abs(player.car.x - node.x) < (node.kx || 80) + 6 && Math.abs(player.car.y - node.y) < (node.ky || 80) + 6) return true;
      return false;
    }
    /* ---- Spawning the traffic, the parked cars and the boats ---- */
    const ISLE_CAR_TYPES = ['luxury', 'luxury', 'supercar', 'roadster', 'sport', 'suv', 'suv', 'limousine', 'coupe', 'luxury', 'taxi', 'sport'],
      ISLE_CAR_PAINT = ['#101214', '#f2f2ee', '#b8bcc0', '#1c2a44', '#1f3d2c', '#5a1a22', '#c9b48a', '#2a2d33', '#8a8f94', '#f4efe4'];
    function populateMonarchIsle() {
      const { links } = isleRoadGraph(),
        random = isleRandomSource(7717);
      // Moving traffic: spread along the island's streets, both ways.
      const streets = links.filter((l) => l.name !== 'SOVEREIGN BRIDGE' && l.name !== 'REGENCY BRIDGE');
      let placed = 0;
      for (let tries = 0; tries < 120 && placed < 30; tries++) {
        const link = streets[Math.floor(random() * streets.length)],
          dir = random() < 0.5 ? 1 : -1,
          path = isleLinkPath(link, dir);
        if (path.length < 3) continue;
        const p = path[1 + Math.floor(random() * (path.length - 2))],
          type = ISLE_CAR_TYPES[Math.floor(random() * ISLE_CAR_TYPES.length)];
        if (!canSpawnCar(type, p.x, p.y, p.a, 10)) continue;
        const c = makeCar(type, p.x, p.y, p.a, true, type === 'taxi' ? VEHICLE_DEFINITIONS.taxi.color : ISLE_CAR_PAINT[Math.floor(random() * ISLE_CAR_PAINT.length)]);
        isleTrafficJoin(c, link, dir);
        placed++;
      }
      // Parked: two cars on every villa's forecourt, the showroom's supercars, the
      // hotel's cars at the kerb, the marina car park, the police substation.
      const park = (type, x, y, a, color) => {
        if (!canSpawnCar(type, x, y, a, 4)) return null;
        return makeCar(type, x, y, a, false, color);
      };
      for (const plan of monarchPlan.villas) {
        const H = plan.house,
          v = plan.villa;
        if (plan.gateAxis === 'y') {
          const fy = v.gate === 'south' ? H.y + H.h + 40 : H.y - 40;
          park(['supercar', 'luxury', 'roadster', 'suv'][Math.floor(random() * 4)], H.x + H.w / 2 - 22, fy, Math.PI / 2 + 0.3, ISLE_CAR_PAINT[Math.floor(random() * ISLE_CAR_PAINT.length)]);
          park(['limousine', 'luxury', 'sport', 'suv'][Math.floor(random() * 4)], H.x + H.w / 2 + 24, fy + 4, -Math.PI / 2 + 0.2, ISLE_CAR_PAINT[Math.floor(random() * ISLE_CAR_PAINT.length)]);
        } else park('luxury', H.x - 40, H.y + H.h / 2, Math.PI / 2, ISLE_CAR_PAINT[0]);
      }
      for (const plan of monarchPlan.blocks) {
        if (plan.forecourt) {
          const f = plan.forecourt;
          ['supercar', 'roadster', 'supercar', 'sport'].forEach((type, k) => park(type, f.x + 40 + k * ((f.w - 80) / 3), f.y + 24, 0.5 + k * 0.7, ['#c8102e', '#f2c21b', '#101214', '#f4efe4'][k]));
        }
        if (plan.policeYard) {
          const p = plan.policeYard,
            cop = park('police', p.x + p.w / 2, p.y + p.h / 2, 0);
          if (cop) cop.cop = false;
        }
      }
      for (let k = 0; k < 6; k++) park(['suv', 'luxury', 'roadster', 'sport', 'coupe', 'suv'][k], 9730 + (k % 2) * 118, -1160 + Math.floor(k / 2) * 72, k % 2 ? Math.PI : 0, ISLE_CAR_PAINT[k]);
      // Boats cruising out of the basin and along the channel.
      for (const [type, route] of ISLE_BOAT_ROUTES) {
        const p = route[0];
        if (!boatFits({ type, x: p[0], y: p[1], a: 0 })) continue;
        const b = makeCar(type, p[0], p[1], headingBetween({ x: p[0], y: p[1] }, { x: route[1][0], y: route[1][1] }), false);
        b.isleBoat = { route, index: 1 };
      }
      // A helicopter on Monarch One's pad.
      const pad = MONARCH_TOWERS.find((t) => t.helipad && t.building?.helipad);
      if (pad) {
        const h = makeCar('helicopter', pad.building.helipad.x, pad.building.helipad.y, -Math.PI / 2, false);
        h.altitude = pad.building.height;
        h.roofSite = pad.building;
      }
    }
    const ISLE_BOAT_ROUTES = [
      ['speedboat', [[9300, -722], [8300, -722], [7840, -722], [7700, -540], [7400, -330], [8600, -300], [9900, -330], [10420, -620], [10300, -300], [8600, -330], [7500, -380], [7760, -640], [8300, -722]]],
      ['workboat', [[8900, -700], [7900, -700], [7700, -520], [6900, -300], [6000, -380], [5700, -300], [6900, -260], [7650, -470], [8000, -722]]],
      ['speedboat', [[5100, -4600], [5200, -3000], [5100, -1500], [4700, -900], [4400, -2400], [4600, -4400], [5600, -5500], [7600, -5600], [9600, -5500], [7600, -5550], [5500, -5450]]],
    ];
    /* The helm of a cruising boat: head for the next point, slow down to turn. */
    function isleBoatHelm(c, along) {
      const s = c.isleBoat,
        p = s.route[s.index],
        d = Math.hypot(p[0] - c.x, p[1] - c.y);
      if (d < 70) s.index = (s.index + 1) % s.route.length;
      const da = normalizeAngle(Math.atan2(p[1] - c.y, p[0] - c.x) - c.a),
        cruise = c.type === 'workboat' ? 9 * KNOTS : 20 * KNOTS,
        want = Math.abs(da) > 0.8 ? cruise * 0.4 : cruise;
      // Nobody else aboard: the player takes over by boarding (the helm is ignored then).
      if (player.car === c) return null;
      if (!nearMonarchIsle(player.x, player.y, 2600)) return { up: false, down: along > 1, turn: 0 };
      return { up: along < want, down: along > want * 1.3, turn: clamp(da * 2, -1, 1) };
    }
    /* ---- People ---- */
    let isleWalkGraph = null;
    function isleWalkNodes() {
      if (isleWalkGraph) return isleWalkGraph;
      const nodes = [],
        add = (x, y, tag) => {
          let n = nodes.find((o) => Math.abs(o.x - x) < 2 && Math.abs(o.y - y) < 2);
          if (!n) nodes.push((n = { id: nodes.length, x, y, links: [], tag }));
          return n;
        },
        join = (a, b) => {
          if (a === b || a.links.includes(b.id)) return;
          a.links.push(b.id);
          b.links.push(a.id);
        };
      // Junction corners (18 in from the kerb), joined along the pavements and
      // across the zebras.
      const corners = new Map();
      for (const j of isleJunctions()) {
        const kx = isleKerbHalf(j.x, true) + 18,
          ky = isleKerbHalf(j.y, false) + 18,
          set = {};
        for (const [sx, sy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ])
          set[sx + ',' + sy] = add(j.x + sx * kx, j.y + sy * ky, 'corner');
        corners.set(j.x + ',' + j.y, set);
        for (const arm of j.arms) {
          const up = arm.a === -Math.PI / 2,
            down = arm.a === Math.PI / 2,
            west = arm.a === Math.PI,
            east = arm.a === 0;
          if (up) join(set['-1,-1'], set['1,-1']);
          if (down) join(set['-1,1'], set['1,1']);
          if (west) join(set['-1,-1'], set['-1,1']);
          if (east) join(set['1,-1'], set['1,1']);
        }
      }
      // Pavements between consecutive junctions on each street, both sides.
      for (const s of ISLE_STREETS) {
        const on = isleJunctions()
          .filter((j) => (s.vertical ? j.x === s.at : j.y === s.at))
          .sort((p, q) => (s.vertical ? p.y - q.y : p.x - q.x));
        for (let i = 1; i < on.length; i++) {
          const A = corners.get(on[i - 1].x + ',' + on[i - 1].y),
            B = corners.get(on[i].x + ',' + on[i].y);
          // A roundabout between them: the pavements meet its ring walk instead.
          if (
            ISLE_CIRCLES.some((c) =>
              s.vertical ? c.x === s.at && c.y > on[i - 1].y && c.y < on[i].y : c.y === s.at && c.x > on[i - 1].x && c.x < on[i].x,
            )
          )
            continue;
          if (s.vertical) {
            join(A['-1,1'], B['-1,-1']);
            join(A['1,1'], B['1,-1']);
          } else {
            join(A['1,-1'], B['-1,-1']);
            join(A['1,1'], B['-1,1']);
          }
        }
      }
      // The roundabouts' ring walks, joined to the pavements that meet them.
      for (const c of ISLE_CIRCLES) {
        const R = c.walk - 18,
          ring = [];
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * TAU;
          ring.push(add(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R, 'ring'));
        }
        for (let k = 0; k < 24; k++) join(ring[k], ring[(k + 1) % 24]);
        for (const n of nodes)
          if (n.tag === 'corner' && Math.hypot(n.x - c.x, n.y - c.y) < c.walk + 700) {
            // A corner on a street into the ring: join it to the nearest ring point
            // if nothing lies between (the pavement runs straight into the ring walk).
            const d = Math.hypot(n.x - c.x, n.y - c.y);
            if (d > c.walk + 690 || d < c.walk) continue;
            const alongX = Math.abs(n.y - c.y) < 140,
              alongY = Math.abs(n.x - c.x) < 140;
            if (!alongX && !alongY) continue;
            // Straight along the pavement to where its line meets the ring walk,
            // then onto the ring's two nearest points: never a diagonal across a
            // carriageway.
            const off = alongX ? n.y - c.y : n.x - c.x;
            if (Math.abs(off) >= R - 4) continue;
            const reach = Math.sqrt(R * R - off * off),
              meet = alongX ? add(c.x + Math.sign(n.x - c.x) * reach, n.y, 'ring') : add(n.x, c.y + Math.sign(n.y - c.y) * reach, 'ring');
            join(n, meet);
            const near = ring
              .filter((q) => q !== meet)
              .sort((p, q) => Math.hypot(p.x - meet.x, p.y - meet.y) - Math.hypot(q.x - meet.x, q.y - meet.y));
            join(meet, near[0]);
            join(meet, near[1]);
          }
      }
      // The marina promenade, joined to the corners on Marina Drive's south side.
      const prom = [];
      for (let x = 7480; x <= 9860; x += 120) prom.push(add(x, -1232, 'promenade'));
      for (let k = 1; k < prom.length; k++) join(prom[k - 1], prom[k]);
      for (const n of nodes) if (n.tag === 'corner' && Math.abs(n.y - (-1344 + ISLE_STREET / 2 + 18)) < 3 && n.x > 7400) join(n, prom.reduce((p, q) => (Math.abs(q.x - n.x) < Math.abs(p.x - n.x) ? q : p)));
      // The garden: the Broad Walk from the south gate to the terrace, round the
      // pond, the terrace walk, the Palm House doors, the side gates.
      const G = MONARCH_GARDEN,
        gate = add(8000, -3812, 'garden'),
        pondS = add(8000, G.pond.y + G.pond.ry + 30, 'garden'),
        pondW = add(G.pond.x - G.pond.rx - 30, G.pond.y, 'photo'),
        pondE = add(G.pond.x + G.pond.rx + 30, G.pond.y, 'photo'),
        pondN = add(8000, G.pond.y - G.pond.ry - 30, 'photo'),
        terrace = add(8000, G.house.y + G.house.d / 2 + 20, 'photo'),
        terraceW = add(7400, -4040, 'garden'),
        terraceE = add(8600, -4040, 'garden'),
        gateW = add(7280, -4040, 'garden'),
        gateE = add(8732, -4040, 'garden');
      for (const [a, b] of [
        [gate, pondS],
        [pondS, pondW],
        [pondS, pondE],
        [pondW, pondN],
        [pondE, pondN],
        [pondN, terrace],
        [terrace, terraceW],
        [terrace, terraceE],
        [terraceW, gateW],
        [terraceE, gateE],
      ])
        join(a, b);
      // The garden's gates onto the pavements outside.
      for (const n of [gate, gateW, gateE]) {
        const best = nodes.filter((o) => o.tag === 'corner').reduce((p, q) => (Math.hypot(q.x - n.x, q.y - n.y) < Math.hypot(p.x - n.x, p.y - n.y) ? q : p));
        if (Math.hypot(best.x - n.x, best.y - n.y) < 420) join(n, best);
      }
      // The beach, down the boardwalks at Monarch Boulevard and St James Street.
      for (const x of [7200, 8800]) {
        const top = nodes.filter((o) => o.tag === 'corner' && Math.abs(o.x - x) < 80 && o.y < -4400).reduce((p, q) => (q.y < p.y ? q : p), { y: 0 }),
          sand = add(x, -5140, 'beach');
        if (top.id !== undefined) join(top, sand);
      }
      const b1 = nodes.find((n) => n.tag === 'beach' && n.x === 7200),
        b2 = nodes.find((n) => n.tag === 'beach' && n.x === 8800);
      if (b1 && b2) join(b1, b2);
      return (isleWalkGraph = nodes);
    }
    // A route over the walk graph (breadth-first: the graph is small).
    function isleWalkRoute(from, to) {
      const nodes = isleWalkNodes(),
        prev = new Map([[from.id, null]]),
        queue = [from.id];
      while (queue.length) {
        const id = queue.shift();
        if (id === to.id) break;
        for (const next of nodes[id].links)
          if (!prev.has(next)) {
            prev.set(next, id);
            queue.push(next);
          }
      }
      if (!prev.has(to.id)) return null;
      const path = [];
      for (let id = to.id; id !== null; id = prev.get(id)) path.unshift(nodes[id]);
      return path;
    }
    function isleNearestWalkNode(x, y) {
      let best = null,
        bd = Infinity;
      for (const n of isleWalkNodes()) {
        if (!n.links.length) continue;
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      return best;
    }
    // Where walkers go: shop doors (and in), the garden's sights, the fountains, the marina, the beach.
    function isleDestinations() {
      const list = [];
      for (const s of monarchPlan.shops) if (s.door) list.push({ x: s.door.x, y: s.door.y, kind: 'door', name: s.name });
      for (const n of isleWalkNodes()) if (n.tag === 'photo' || n.tag === 'beach' || n.tag === 'promenade') list.push({ x: n.x, y: n.y, kind: n.tag, node: n });
      for (const c of ISLE_CIRCLES) list.push({ x: c.x, y: c.y + c.walk - 18, kind: 'fountain', face: c });
      return list;
    }
    const ISLE_PALETTE = {
      tops: ['#f4f1ea', '#1c2a44', '#e8dcc0', '#2a2d33', '#c9b48a', '#f2e6e0', '#6b2f36', '#dfe8ee', '#b8c8b0', '#101214'],
      pants: ['#f2efe6', '#1c2a44', '#c9b48a', '#2a2d33', '#e8e2d6', '#3a3f4a'],
      shoes: ['#3a2618', '#f0eee8', '#141414', '#8a6d4a'],
    };
    function dressIsleWalker(p, role) {
      dressPerson(p, role);
      const L = p.look;
      if (role !== 'jogger') {
        L.top = p.color = randomChoice(ISLE_PALETTE.tops);
        L.pants = randomChoice(ISLE_PALETTE.pants);
        L.shoes = randomChoice(ISLE_PALETTE.shoes);
        if (role === 'shopper' || role === 'tourist') p.carry = randomChoice(['shopping', 'shopping', 'handbag', 'handbag', null]);
        L.hat = seededRandom() < 0.18 ? 1 : 0;
        L.hatColor = randomChoice(['#e8dcc0', '#f4f1ea', '#1c2a44']);
      }
      return p;
    }
    let isleCrowdClock = 0,
      isleCrowdLive = false;
    function isleCrowdTarget() {
      const hour = (worldMinutes % 1440) / 60;
      if (hour < 6) return 18;
      if (hour < 8) return 44;
      if (hour < 20) return 110;
      return 60;
    }
    function spawnIsleWalker(node, role) {
      const p = {
        x: node.x + randomBetween(-6, 6),
        y: node.y + randomBetween(-6, 6),
        a: randomBetween(0, TAU),
        hp: 30,
        flee: 0,
        timer: randomBetween(0, 4),
        walk: seededRandom() * 5,
        state: 'walk',
        isle: { route: null, stay: 0 },
      };
      dressIsleWalker(p, role);
      if (solid(p.x, p.y, 5)) return null;
      pedestrians.push(p);
      return p;
    }
    /* Standing staff: doormen and valets at the hotel and the restaurant, guards at the villa gates. */
    function isleStaffPosts() {
      const posts = [];
      for (const s of monarchPlan.shops) {
        if (!s.door) continue;
        if (s.trade === 'hotel') posts.push({ x: s.door.x - 16, y: s.door.y + 4, a: Math.PI / 2, role: 'doorman' }, { x: s.door.x + 16, y: s.door.y + 4, a: Math.PI / 2, role: 'doorman' }, { x: s.door.x + 40, y: s.door.y + 40, a: Math.PI / 2, role: 'valet' });
        if (s.trade === 'restaurant') posts.push({ x: s.door.x + 20, y: s.door.y + 10, a: Math.PI / 2, role: 'valet' });
        if (s.trade === 'bank' || s.trade === 'jewellery') posts.push({ x: s.door.x + 14, y: s.door.y + 6, a: Math.PI / 2, role: 'guard' });
      }
      for (const plan of monarchPlan.villas) {
        const g = plan.gateAt,
          out = plan.villa.gate === 'south' ? 1 : plan.villa.gate === 'west' ? 0 : -1;
        if (plan.gateAxis === 'y') posts.push({ x: g.x + plan.gateWidth / 2 + 12, y: g.y + out * 10, a: out > 0 ? Math.PI / 2 : -Math.PI / 2, role: 'guard' });
        else posts.push({ x: g.x - 10, y: g.y + plan.gateWidth / 2 + 12, a: Math.PI, role: 'guard' });
      }
      return posts;
    }
    function spawnIsleStaff(post) {
      const p = {
        x: post.x,
        y: post.y,
        a: post.a,
        hp: 30,
        flee: 0,
        timer: 0,
        walk: 0,
        state: 'walk',
        isle: { post },
      };
      dressPerson(p, post.role === 'guard' ? 'bouncer' : 'worker');
      if (post.role === 'guard') {
        p.look.top = p.color = '#15171a';
        p.look.pants = '#15171a';
      } else {
        p.look.top = p.color = post.role === 'valet' ? '#6b1f24' : '#1c2a44';
        p.look.pants = '#15171a';
        p.look.hat = post.role === 'doorman' ? 1 : 0;
        p.look.hatColor = '#1c2a44';
      }
      p.pace = 0.9;
      pedestrians.push(p);
    }
    function updateMonarchCrowd(deltaSeconds) {
      isleCrowdClock -= deltaSeconds;
      if (isleCrowdClock > 0) return;
      isleCrowdClock = 1.5;
      const near = nearMonarchIsle(player.x, player.y, 1400);
      if (!near) {
        if (isleCrowdLive) {
          for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].isle && pedestrians[i].hp > 0 && !crowdInView(pedestrians[i].x, pedestrians[i].y, 100)) pedestrians.splice(i, 1);
          isleCrowdLive = pedestrians.some((p) => p.isle);
        }
        return;
      }
      const nodes = isleWalkNodes().filter((n) => n.links.length),
        walkers = pedestrians.filter((p) => p.isle && !p.isle.post && p.hp > 0).length;
      if (!isleCrowdLive) {
        isleCrowdLive = true;
        for (const post of isleStaffPosts()) spawnIsleStaff(post);
      }
      const target = isleCrowdTarget(),
        add = Math.min(isleCrowdLive && walkers === 0 ? target : 6, target - walkers);
      for (let i = 0; i < add; i++) {
        const node = nodes[Math.floor(seededRandom() * nodes.length)];
        if (crowdInView(node.x, node.y, 40) && walkers > 0) continue;
        const hour = (worldMinutes % 1440) / 60,
          role = pickWeighted(hour < 9 ? { jogger: 3, dogWalker: 3, commuter: 2, casual: 1 } : hour < 19 ? { shopper: 4, tourist: 3, casual: 2, dogWalker: 1.2, jogger: 0.8, elder: 1, couple: 1 } : { couple: 3, casual: 2, tourist: 1, dogWalker: 1 });
        const p = spawnIsleWalker(node, role === 'couple' ? 'casual' : role);
        if (p && role === 'couple') {
          const q = addCompanion(p, 'casual');
          if (q) {
            dressIsleWalker(q, 'casual');
            q.isle = { follow: p };
          }
        }
      }
    }
    /* A walker's turn (updatePeople calls it for everyone; it takes `p.isle`). */
    function updateIsleWalker(p, deltaSeconds) {
      if (!p.isle || p.hp <= 0) return false;
      if (p.flee > 0 || p.react || p.knockedFor || p.injured) return false;
      const s = p.isle;
      if (s.follow) {
        // A companion keeps to the leader's side and stops when they stop.
        const L = s.follow;
        if (L.hp <= 0 || !pedestrians.includes(L)) {
          s.follow = null;
          s.route = null;
          return true;
        }
        const tx = L.x + Math.cos(L.a + Math.PI / 2) * 9,
          ty = L.y + Math.sin(L.a + Math.PI / 2) * 9,
          d = Math.hypot(tx - p.x, ty - p.y);
        p.walking = d > 3;
        if (p.walking) {
          const speed = Math.min(d * 2, 7 * KMH);
          p.a = Math.atan2(ty - p.y, tx - p.x);
          p.walk += deltaSeconds * strideRate(speed);
          moveBody(p, Math.cos(p.a) * speed * deltaSeconds, Math.sin(p.a) * speed * deltaSeconds, 5);
        } else {
          p.a = L.a;
          p.pose = L.pose === 'film' ? 'watch' : null;
        }
        return true;
      }
      if (s.post) {
        // Staff keep their post: a glance round now and then, arms folded.
        const d = Math.hypot(s.post.x - p.x, s.post.y - p.y);
        if (d > 4) {
          p.a = headingBetween(p, s.post);
          p.walking = true;
          p.walk += deltaSeconds * strideRate(4 * KMH);
          moveBody(p, Math.cos(p.a) * 4 * KMH * deltaSeconds, Math.sin(p.a) * 4 * KMH * deltaSeconds, 5);
          return true;
        }
        p.walking = false;
        p.pose = s.post.role === 'guard' ? 'arms' : s.post.role === 'valet' ? 'wait' : null;
        p.a = s.post.a + Math.sin(gameTime * 0.2 + p.walk) * 0.4;
        if (distanceBetween(p, player) < 60 && (p.speechUntil || 0) < gameTime && seededRandom() < deltaSeconds * 0.4) {
          p.speech = randomChoice(s.post.role === 'guard' ? ISLE_LINES.guard : ISLE_LINES.valet);
          p.speechUntil = gameTime + 3;
        }
        return true;
      }
      if (s.stay > 0) {
        // Stopped: looking, photographing, or indoors (hidden) for a while.
        s.stay -= deltaSeconds;
        p.walking = false;
        if (s.stay <= 0) {
          p.pose = p.dog ? 'leash' : null;
          s.route = null;
        }
        return true;
      }
      if (!s.route || !s.route.length) {
        const start = isleNearestWalkNode(p.x, p.y);
        if (!start) return false;
        const dests = isleDestinations(),
          dest = p.role === 'jogger' ? null : dests[Math.floor(seededRandom() * dests.length)],
          goal = dest ? dest.node || isleNearestWalkNode(dest.x, dest.y) : isleWalkNodes()[start.links[Math.floor(seededRandom() * start.links.length)]],
          route = goal ? isleWalkRoute(start, goal) : null;
        s.route = route ? route.map((n) => ({ x: n.x + randomBetween(-5, 5), y: n.y + randomBetween(-5, 5) })) : [];
        s.dest = dest;
        if (dest && dest.kind === 'door') s.route.push({ x: dest.x, y: dest.y, door: true });
        if (dest && (dest.kind === 'photo' || dest.kind === 'fountain' || dest.kind === 'promenade' || dest.kind === 'beach')) s.route.push({ x: dest.x + randomBetween(-14, 14), y: dest.y + randomBetween(-10, 10), look: true });
        if (!s.route.length) {
          s.stay = 3;
          return true;
        }
      }
      const goal = s.route[0];
      if (Math.hypot(goal.x - p.x, goal.y - p.y) < 8) {
        s.route.shift();
        if (goal.door && seededRandom() < 0.5) {
          // In through the door for a minute or two.
          s.stay = randomBetween(20, 70);
          goIndoors(p, goal, s.stay, 'shop');
          return true;
        }
        if (goal.look) {
          s.stay = randomBetween(5, 14);
          const sight = s.dest?.face || (s.dest?.kind === 'photo' ? MONARCH_GARDEN.house : null);
          if (sight) p.a = headingBetween(p, { x: sight.x, y: sight.y });
          else p.a += randomBetween(-1, 1);
          p.pose = seededRandom() < 0.55 ? 'film' : seededRandom() < 0.5 ? 'point' : null;
          if ((p.speechUntil || 0) < gameTime && seededRandom() < 0.3) {
            p.speech = randomChoice(ISLE_LINES[s.dest?.kind] || ISLE_LINES.street);
            p.speechUntil = gameTime + 3;
          }
        }
        return true;
      }
      // At the kerb, look both ways: wait while a car is coming (up to 12 s).
      const onRoadNow = monarchRoadAt(p.x, p.y, 2),
        toward = headingBetween(p, goal);
      if (!onRoadNow && monarchRoadAt(p.x + Math.cos(toward) * 10, p.y + Math.sin(toward) * 10, 2) && (s.kerb || 0) < 12) {
        let coming = false;
        for (const o of vehicles) {
          if (o.hp <= 0 || (o.altitude || 0) > 15) continue;
          const dx = p.x - o.x,
            dy = p.y - o.y,
            d = Math.hypot(dx, dy);
          if (d > 190) continue;
          const v = Math.hypot(o.vx || 0, o.vy || 0);
          if (d < 50 || (v > 12 && (dx * (o.vx || 0) + dy * (o.vy || 0)) / (v * d) > 0.55)) {
            coming = true;
            break;
          }
        }
        if (coming) {
          s.kerb = (s.kerb || 0) + deltaSeconds;
          p.walking = false;
          p.a = toward;
          return true;
        }
      }
      if (!onRoadNow) s.kerb = 0;
      // Brisker across a carriageway, so traffic is not held for long.
      const speed = (p.role === 'jogger' ? 11 : 4.6) * KMH * (p.pace || 1) * (p.role === 'jogger' ? 1 : 0.9) * (onRoadNow ? 1.5 : 1);
      p.a = headingBetween(p, goal);
      p.walking = true;
      p.pose = p.dog ? 'leash' : p.texting ? 'text' : null;
      p.walk += deltaSeconds * strideRate(speed);
      const stepX = Math.cos(p.a) * speed * deltaSeconds,
        stepY = Math.sin(p.a) * speed * deltaSeconds;
      let held = moveBody(p, stepX, stepY, 5);
      if (held && onRoadNow && !solid(p.x + stepX, p.y + stepY, 5)) {
        // On a zebra with a car's nose over it: squeeze past the bumper rather
        // than stand in the road (the car is waiting for them).
        p.x += stepX;
        p.y += stepY;
        held = false;
      }
      if (held) {
        // Held up (a tree, a lantern, a parked car): step round it to one side,
        // then the other; after a few tries plan afresh from where they stand. A
        // node is never skipped for the next one, which would send them in a
        // straight line across whatever lies between (a carriageway, a garden).
        s.stuck = (s.stuck || 0) + deltaSeconds;
        if (s.stuck > 1.2) {
          s.stuck = 0;
          s.tries = (s.tries || 0) + 1;
          if (goal.detour || Math.hypot(goal.x - p.x, goal.y - p.y) < 20) s.route.shift();
          if (s.tries > 4) {
            s.route = null;
            s.tries = 0;
          } else {
            const side = (s.tries % 2 ? 1 : -1) * Math.PI / 2,
              d = 10 + s.tries * 4;
            s.route.unshift({ x: p.x + Math.cos(p.a + side) * d + Math.cos(p.a) * 6, y: p.y + Math.sin(p.a + side) * d + Math.sin(p.a) * 6, detour: true });
          }
        }
      } else {
        s.stuck = 0;
        if (!goal.detour) s.tries = 0;
      }
      if (p.dog) updateDog(p, deltaSeconds);
      if (distanceBetween(p, player) < 50 && (p.speechUntil || 0) < gameTime && seededRandom() < deltaSeconds * 0.06) {
        p.speech = randomChoice(wantedStars > 0 ? ISLE_LINES.wanted : ISLE_LINES.street);
        p.speechUntil = gameTime + 2.8;
      }
      return true;
    }
    const ISLE_LINES = {
      street: ['The Regent does a divine afternoon tea.', 'Darling, the boat is simply too small.', 'We summer on the island, of course.', 'Have you seen the new Valmont?', 'My driver is always late.', 'Lunch at L’Étoile? I’ll call ahead.', 'The club has a waiting list, you know.', 'Isn’t the light lovely today?'],
      photo: ['Stand by the Palm House, I’ll take one.', 'The lilies are enormous!', 'Get the dome in the shot.', 'Look at that dragon tree.', 'It’s like Kew, isn’t it?'],
      fountain: ['One for the album.', 'Lovely fountain.', 'Smile!'],
      promenade: ['That one’s sixty metres at least.', 'Whose yacht is that?', 'We should charter next summer.', 'Look, a helipad on a boat.'],
      beach: ['The water’s perfect.', 'Private beach, I’m afraid.', 'Towel, please.'],
      guard: ['Private property, sir.', 'Keep moving, please.', 'Can I help you?', 'The residents are not receiving visitors.'],
      valet: ['Your keys, sir?', 'Welcome to the Regent.', 'I’ll bring the car round.', 'Enjoy your evening.'],
      wanted: ['Someone call security!', 'Is that… oh my.', 'Not on this island, surely.'],
    };
    /* ---- Payphones ---- */
    function monarchPayphoneNear() {
      if (player.car) return null;
      return MONARCH_PAYPHONES.find((p) => withinRange('isle-phone-' + p.name, distanceBetween(player, p), 40, 52)) || null;
    }
    function monarchInteract() {
      const phone = monarchPayphoneNear();
      if (!phone) return false;
      const lines = [
        'Monarch Isle concierge. A table at L’Étoile tonight? Certainly.',
        'Harbour master. The Sovereign Lady sails at dawn.',
        'Crown Private Bank. Your balance is… confidential.',
        'The Regent Hotel. The penthouse is available from Friday.',
        'A voice: “Not on this line. Try the yellow phone in the city.”',
      ];
      tell(randomChoice(lines), 4);
      tone(620, 0.08, 0.12, 'sine');
      return true;
    }
    function monarchPrompt() {
      return monarchPayphoneNear() ? 'USE PAYPHONE' : '';
    }
    /* ---- Adopting city traffic that crosses the bridge ---- */
    let isleAdoptClock = 0;
    function updateMonarchTraffic(deltaSeconds) {
      isleAdoptClock -= deltaSeconds;
      if (isleAdoptClock > 0) return;
      isleAdoptClock = 0.5;
      const graph = isleRoadGraph(),
        bridge = graph.links.find((l) => l.name === 'SOVEREIGN BRIDGE');
      for (const c of vehicles) {
        if (!c.ai || c.isle || c.countyRoute || c.cop || c.hp <= 0 || isBoat(c) || isAircraft(c)) continue;
        if (c.x < 4200 || c.x > 5560 || Math.abs(c.y + 2944) > 80) continue;
        if (Math.cos(c.a) < 0.7) continue;
        isleTrafficJoin(c, bridge, 1);
      }
    }
    /* ---- Sound ---- */
    const isleSound = { water: null, clock: 0, rig: 1, bird: 2 };
    function updateMonarchSound(deltaSeconds) {
      if (!audio || !soundOn) return;
      const near = nearMonarchIsle(player.x, player.y, 600);
      // Running water: a band of noise that swells near a fountain or the pond.
      let fountain = Infinity;
      for (const c of ISLE_CIRCLES) fountain = Math.min(fountain, Math.hypot(player.x - c.x, player.y - c.y) - c.island);
      fountain = Math.min(fountain, Math.hypot(player.x - MONARCH_GARDEN.pond.x, player.y - MONARCH_GARDEN.pond.y) - 80);
      const level = near ? clamp(1 - fountain / 320, 0, 1) * 0.1 : 0;
      if (!isleSound.water && level > 0) {
        const n = audio.sampleRate * 2,
          buffer = audio.createBuffer(1, n, audio.sampleRate),
          d = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        const src = audio.createBufferSource(),
          band = audio.createBiquadFilter(),
          gain = audio.createGain();
        src.buffer = buffer;
        src.loop = true;
        band.type = 'bandpass';
        band.frequency.value = 1500;
        band.Q.value = 0.6;
        gain.gain.value = 0;
        src.connect(band).connect(gain).connect(ambienceBus);
        src.start();
        isleSound.water = gain;
      }
      if (isleSound.water) isleSound.water.gain.setTargetAtTime(level, audio.currentTime, 0.4);
      if (!near) return;
      // The marina: rigging and halyards, gulls.
      const marina = Math.hypot(player.x - clamp(player.x, 7700, 9900), player.y - clamp(player.y, -1200, -560));
      isleSound.rig -= deltaSeconds;
      if (marina < 500 && isleSound.rig <= 0) {
        isleSound.rig = 0.4 + Math.random() * 1.4;
        const at = { x: clamp(player.x + (Math.random() - 0.5) * 400, 7700, 9900), y: -900 + (Math.random() - 0.5) * 300 },
          f = 1800 + Math.random() * 1600;
        waterTone({ freq: f, to: f * 0.98, duration: 0.5, gain: 0.02, wave: 'triangle', position: at });
        if (Math.random() < 0.3) shapedNoise({ type: 'bandpass', freq: 700, q: 2, attack: 0.005, decay: 0.12, gain: 0.03, position: at });
        if (Math.random() < 0.08 && daylight() > 0.3) gullCall(at);
      }
      // The garden: birdsong by day.
      isleSound.bird -= deltaSeconds;
      const garden = Math.hypot(player.x - 8000, player.y + 4100);
      if (garden < 700 && isleSound.bird <= 0 && daylight() > 0.2) {
        isleSound.bird = 0.6 + Math.random() * 2.2;
        const at = { x: 8000 + (Math.random() - 0.5) * 900, y: -4100 + (Math.random() - 0.5) * 500 },
          f = 2600 + Math.random() * 2400,
          notes = 2 + Math.floor(Math.random() * 4);
        for (let k = 0; k < notes; k++) waterTone({ freq: f * (1 + (k % 2) * 0.18), to: f * (1.3 - (k % 2) * 0.3), duration: 0.09, gain: 0.018, delay: k * 0.13, position: at });
      }
    }
    function updateMonarchIsle(deltaSeconds) {
      updateMonarchTraffic(deltaSeconds);
      updateMonarchCrowd(deltaSeconds);
      updateMonarchSound(deltaSeconds);
    }
    function monarchReport() {
      const cars = vehicles.filter((c) => c.isle),
        walkers = pedestrians.filter((p) => p.isle);
      return {
        ...monarchLayout(),
        traffic: cars.length,
        trafficMoving: cars.filter((c) => Math.hypot(c.vx || 0, c.vy || 0) > 20).length,
        trafficStuck: cars.filter((c) => gameTime - (c.isle.stillSince ?? gameTime) > 30).length,
        trafficWaiting: cars.filter((c) => c.isle?.crossing && !c.isle.granted).length,
        stopped: cars
          .filter((c) => Math.hypot(c.vx || 0, c.vy || 0) < 8)
          .map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), a: Math.round((c.a * 180) / Math.PI), type: c.type, link: c.isle.link.name, crossing: !!c.isle.crossing, node: c.isle.node?.kind, granted: !!c.isle.granted, waited: Math.round(c.isle.waited || 0), index: c.isle.index + '/' + c.isle.path.length, hp: Math.round(c.hp), still: Math.round(gameTime - (c.isle.stillSince ?? gameTime)), desired: Math.round(c.isle.desired || 0), target: c.isle.target && [Math.round(c.isle.target.x), Math.round(c.isle.target.y)], yielding: c.isle.yielding, blocker: c.isle.blocker ? { type: c.isle.blocker.type, x: Math.round(c.isle.blocker.x), y: Math.round(c.isle.blocker.y), isle: !!c.isle.blocker.isle, ai: !!c.isle.blocker.ai } : null })),
        boats: vehicles.filter((c) => c.isleBoat).map((c) => ({ type: c.type, x: Math.round(c.x), y: Math.round(c.y) })),
        people: walkers.length,
        onRoad: walkers
          .filter((p) => monarchRoadAt(p.x, p.y, 3))
          .map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), role: p.role, walking: !!p.walking, stay: Math.round(p.isle.stay || 0), post: !!p.isle.post, follow: !!p.isle.follow, goal: p.isle.route?.[0] && [Math.round(p.isle.route[0].x), Math.round(p.isle.route[0].y)], left: p.isle.route?.length, dest: p.isle.dest?.kind, hidden: !!p.indoors, react: p.react || null, flee: p.flee || 0, knocked: p.knockedFor || 0, injured: !!p.injured, kerb: +(p.isle.kerb || 0).toFixed(1), stuck: +(p.isle.stuck || 0).toFixed(1), tries: p.isle.tries || 0, state: p.state, pose: p.pose || null })),
        staff: walkers.filter((p) => p.isle.post).length,
        roles: walkers.reduce((m, p) => ((m[p.role || 'casual'] = (m[p.role || 'casual'] || 0) + 1), m), {}),
        roadGraph: { nodes: isleRoadGraph().nodes.length, links: isleRoadGraph().links.length },
        walkGraph: isleWalkNodes().length,
        // Walk links that run along a carriageway rather than across it.
        walkOnRoad: (() => {
          const nodes = isleWalkNodes(),
            bad = [];
          for (const n of nodes)
            for (const id of n.links) {
              if (id < n.id) continue;
              const m = nodes[id],
                d = Math.hypot(m.x - n.x, m.y - n.y);
              let onRoad = 0;
              for (let t = 0; t <= d; t += 8) if (monarchRoadAt(n.x + ((m.x - n.x) * t) / d, n.y + ((m.y - n.y) * t) / d, 0)) onRoad += 8;
              if (onRoad > 120) bad.push([Math.round(n.x), Math.round(n.y), Math.round(m.x), Math.round(m.y), onRoad, n.tag, m.tag]);
            }
          return bad;
        })(),
      };
    }
    // END SUBSYSTEM: src/monarch-life.js
