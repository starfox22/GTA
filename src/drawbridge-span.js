    // Drawbridge span: the drawbridges (drawbridgeList), opening timetables, geometry, surface, gap and on-span tests (drawbridgeSurface).
    // The Palm Sound Causeway's timetable: three a day, one of them after dark for
    // the floodlit show; an opening holds the traffic about three minutes of play.
    // Every drawbridge has its own (bridge.drawbridge.openings, staggered so one of
    // them is up or moving at least half the day: drawbridgeOpenShare).
    const DRAWBRIDGE_OPENINGS = [400, 860, 1290], // 06:40, 14:20, 21:30
      DRAWBRIDGE_MAX_ANGLE = (78 * Math.PI) / 180,
      DRAWBRIDGE_RATE = (1.6 * Math.PI) / 180, // top swing speed, radians a second: 78 degrees in about a minute
      DRAWBRIDGE_SWING_ACCEL = (0.16 * Math.PI) / 180, // how gently the swing speeds up and slows
      DRAWBRIDGE_LOCK_SECONDS = 2.6, // the centre lock bars' stroke
      DRAWBRIDGE_WALL_ANGLE = (40 * Math.PI) / 180,
      DRAWBRIDGE_GRAVITY = GRAVITY, // real gravity: a car off a leaf flies a true arc
      DRAWBRIDGE_GRIP = 0.84, // tyre friction on the leaf's surfacing, dry (times the driven wheels' share of the load)
      DRAWBRIDGE_ARM_SNAP = 50 * KMH, // barrier arms snap for anything faster
      DRAWBRIDGE_ARM_SECONDS = 5.5;
    /* ---- The drawbridges ----------------------------------------------------------- */
    /* One state per movable bridge in BRIDGES (`movable: true`, its plan in
       `bridge.drawbridge`), in BRIDGES order: the Palm Sound Causeway first. The
       list is rebuilt (keeping the states it has) if a bridge is appended after it
       was first asked for. */
    function makeDrawbridgeState(bridge, index) {
      return {
        index,
        id: bridge.id,
        bridge,
        plan: bridge.drawbridge || {},
        phase: 'idle',
        timer: 0,
        angle: 0,
        rate: 0,
        target: 0,
        // The centre lock bars: 0 driven home into the far leaf, 1 withdrawn.
        locks: 0,
        held: null,
        lastSlot: null,
        openings: 0,
        waited: 0,
        bellClock: 0,
        hornAt: -99,
        hornDue: 0,
        reason: null,
        warnedPlayer: false,
        jumps: [],
        splashes: 0,
        arms: null,
        vessel: null,
        geo: null,
        motor: null,
        // The onlookers' crowd scene for this opening (drawbridgeSpectators).
        audience: null,
        audienceFor: null,
        // Seconds the motors have run this swing, for the rack's clicks.
        rackClock: 0,
        // Game seconds this span has not been seated (drawbridgeOpenShare's measure).
        openSeconds: 0,
      };
    }
    const drawbridgeStates = { list: [], count: -1 };
    function drawbridgeList() {
      if (drawbridgeStates.count === BRIDGES.length) return drawbridgeStates.list;
      const old = drawbridgeStates.list;
      drawbridgeStates.list = BRIDGES.filter((b) => b.movable).map((bridge, index) => old.find((d) => d.bridge === bridge) || makeDrawbridgeState(bridge, index));
      drawbridgeStates.count = BRIDGES.length;
      return drawbridgeStates.list;
    }
    // A drawbridge by its bridge id ('keys-harbor' ...), by index, or the Palm Sound one.
    function drawbridgeById(id) {
      const list = drawbridgeList();
      if (id === undefined || id === null || id === '') return list[0];
      if (Number.isInteger(id)) return list[id] || null;
      return list.find((d) => d.id === id) || null;
    }
    /* Cheap gates for the hot paths: no drawbridge working (every one idle with its
       leaves seated), and no leaf off its seat. Refreshed every update and by
       every console or panel command (noteDrawbridgeStates). */
    let drawbridgesQuiet = true,
      drawbridgesShut = true,
      // Set while the route graph is built (navigation.js): the gap is road then.
      drawbridgeRouting = false;
    function noteDrawbridgeStates() {
      const list = drawbridgeList();
      let quiet = true,
        shut = true;
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (d.phase !== 'idle' || d.angle > 0.0005) quiet = false;
        if (d.angle >= 0.004) shut = false;
      }
      drawbridgesQuiet = quiet;
      drawbridgesShut = shut;
    }
    /* ---- Layout ------------------------------------------------------------------ */
    function drawbridgeGeometry(d) {
      if (d.geo) return d.geo;
      const bridge = d.bridge,
        s = bridgeStructure(bridge),
        f = bridgeFrame(bridge),
        b = s.bascule,
        centre = bridgePoint(bridge, 0),
        channel = bridgePoint(bridge, b.middle);
      return (d.geo = {
        bridge,
        s,
        f,
        b,
        m: b.middle,
        hinge: b.trunnions,
        leaf: b.leaf,
        drop: b.drop,
        tail: b.tail,
        wide: b.wide,
        half: bridge.width / 2,
        road: (bridge.width - 22) / 2,
        gates: b.gates,
        stops: b.stops,
        centre,
        channel,
        // A loose box round everything the drawbridge governs, for cheap rejects
        // (round the moving span: the deck may run on far beyond it).
        reachX: Math.abs(f.ux) * (Math.max(Math.abs(b.stops[0] - b.middle), Math.abs(b.stops[1] - b.middle)) + 320) + Math.abs(f.uy) * (bridge.width / 2 + 320),
        reachY: Math.abs(f.uy) * (Math.max(Math.abs(b.stops[0] - b.middle), Math.abs(b.stops[1] - b.middle)) + 320) + Math.abs(f.ux) * (bridge.width / 2 + 320),
      });
    }
    // A map point in the bridge's frame: u along the deck (from its middle), v across it.
    function drawbridgeLocal(d, x, y) {
      const g = drawbridgeGeometry(d),
        dx = x - g.centre.x,
        dy = y - g.centre.y;
      return { u: dx * g.f.ux + dy * g.f.uy, v: -dx * g.f.uy + dy * g.f.ux };
    }
    function drawbridgeNear(d, x, y, pad = 0) {
      const g = drawbridgeGeometry(d),
        dx = x - g.channel.x,
        dy = y - g.channel.y;
      return Math.abs(dx) < g.reachX + pad && Math.abs(dy) < g.reachY + pad;
    }
    // The drawbridge whose governed box holds this point (null for none).
    function drawbridgeAt(x, y, pad = 0) {
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) if (drawbridgeNear(list[i], x, y, pad)) return list[i];
      return null;
    }
    // Horizontal reach of a leaf from its trunnion at `angle` (the tip's offset).
    function drawbridgeTipReach(d, angle = d.angle) {
      const g = drawbridgeGeometry(d);
      return g.leaf * Math.cos(angle) - g.drop * Math.sin(angle);
    }
    /* The clear width between the raised leaves up to `height` over the road: the
       leaves' undersides (the main girders, DRAWBRIDGE_GIRDER deep at the
       trunnion, a third of that at the tip) lean in toward the channel, most at
       the top. 0 while the leaves are down. */
    const DRAWBRIDGE_GIRDER = 44;
    function drawbridgeClearWidth(d, height, angle = d.angle) {
      const g = drawbridgeGeometry(d);
      if (angle < 0.004) return 0;
      const c = Math.cos(angle),
        s = Math.sin(angle);
      let along = g.leaf,
        depth = DRAWBRIDGE_GIRDER / 3;
      for (let i = 0; i < 3; i++) {
        along = Math.min(g.leaf, Math.max(0, (height + g.drop - (g.drop - depth) * c) / s));
        depth = DRAWBRIDGE_GIRDER * (1 - (2 / 3) * (along / g.leaf));
      }
      const reach = along * c - (g.drop - depth) * s;
      return Math.max(0, g.hinge[1] - g.hinge[0] - 2 * reach);
    }
    /* The road surface at `u` with the leaves at `angle`: {h, slope (dh/du),
       leaf (-1 toward a, 1 toward b)} on a leaf, null over the open gap, undefined
       off the moving span. The trunnion axis lies `drop` below the road, as the
       renderer hinges the leaf. */
    function drawbridgeSurface(d, u, angle = d.angle) {
      const g = drawbridgeGeometry(d);
      if (u < g.hinge[0] - 1 || u > g.hinge[1] + 1) return undefined;
      const leaf = u < g.m ? -1 : 1;
      if (angle < 0.004) return { h: 0, slope: 0, leaf };
      const c = Math.cos(angle),
        sn = Math.sin(angle),
        rel = leaf < 0 ? u - g.hinge[0] : g.hinge[1] - u;
      if (rel > g.leaf * c - g.drop * sn) return null;
      const along = (Math.max(0, rel) + g.drop * sn) / c,
        h = Math.max(0, -g.drop + along * sn + g.drop * c);
      return { h, slope: leaf < 0 ? Math.tan(angle) : -Math.tan(angle), leaf };
    }
    // Is this map point over the open gap between one drawbridge's leaf tips?
    function drawbridgeOpenGapOn(d, x, y, r = 0) {
      if (d.angle < 0.004 || drawbridgeRouting) return false;
      const g = drawbridgeGeometry(d),
        p = drawbridgeLocal(d, x, y);
      if (Math.abs(p.v) > g.half + 2) return false;
      const tip = drawbridgeTipReach(d);
      return p.u > g.hinge[0] + tip - r && p.u < g.hinge[1] - tip + r;
    }
    // Over the open gap of any drawbridge? (air cover; onBridgeDeck asks per bridge)
    function drawbridgeOpenGap(x, y, r = 0) {
      if (drawbridgesShut) return false;
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) if (drawbridgeOpenGapOn(list[i], x, y, r)) return true;
      return false;
    }
    // The open gap of this movable bridge (onBridgeDeck).
    function drawbridgeOpenGapOfBridge(bridge, x, y, r = 0) {
      if (drawbridgesShut) return false;
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) if (list[i].bridge === bridge) return drawbridgeOpenGapOn(list[i], x, y, r);
      return false;
    }
    // On the moving span (trunnion to trunnion) and within the deck's width.
    function drawbridgeOnSpanOf(d, x, y, pad = 0) {
      const g = drawbridgeGeometry(d),
        p = drawbridgeLocal(d, x, y);
      return Math.abs(p.v) < g.half + pad && p.u > g.hinge[0] - 2 - pad && p.u < g.hinge[1] + 2 + pad;
    }
    // On any drawbridge's moving span (footsteps ring on its steel).
    function drawbridgeOnSpan(x, y, pad = 0) {
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) if (drawbridgeNear(list[i], x, y, pad) && drawbridgeOnSpanOf(list[i], x, y, pad)) return true;
      return false;
    }
    // Everything between the leaves' hinges is closed to traffic while not seated.
    function drawbridgeSpanClosed(d) {
      return d.angle > 0.0005 || d.phase === 'unlock' || d.phase === 'raising' || d.phase === 'open' || d.phase === 'lowering' || d.phase === 'seating';
    }
    // Traffic is held at the stop lines from the first bell until the arms are nearly up.
    function drawbridgeStopsTraffic(d) {
      if (d.phase === 'idle') return false;
      if (d.phase === 'lifting') return drawbridgeArms(d).some((a) => a.pos > 0.35 && !a.broken);
      return true;
    }
    /* ---- Barrier arms -------------------------------------------------------------- */
    /* Four arms: on each approach one over the lanes into the bridge (entry) and
       one over the lanes out (exit), each pivoting from a cabinet on the kerb
       with a short arm over the sidewalk. pos is 0 up (vertical) .. 1 down. */
    function drawbridgeArms(d) {
      if (d.arms) return d.arms;
      const g = drawbridgeGeometry(d),
        names = d.plan.ends || ['west', 'east'];
      d.arms = [];
      for (const approach of [-1, 1])
        for (const side of [-1, 1]) {
          // Driving on the right: traffic heading into the bridge from the a end
          // (toward +u) keeps to +v; from the b end to -v.
          const entry = side === -approach;
          d.arms.push({
            approach,
            side,
            entry,
            u: g.gates[approach < 0 ? 0 : 1],
            pos: 0,
            broken: false,
            id: names[approach < 0 ? 0 : 1] + '-' + (entry ? 'entry' : 'exit'),
          });
        }
      return d.arms;
    }
    // The arm's collision box across its half of the deck (road and sidewalk), on the map.
    function drawbridgeArmBody(d, arm) {
      const g = drawbridgeGeometry(d),
        p = bridgePoint(g.bridge, arm.u, (arm.side * g.half) / 2);
      return { x: p.x, y: p.y, hx: 1.6, hy: g.half / 2, a: g.f.a, height: 10, kind: 'drawbridge arm', id: 'drawbridge ' + (d.index ? d.id + ' ' : '') + arm.id, arm };
    }
    function drawbridgeArmBlocking(arm) {
      return !arm.broken && arm.pos > 0.55;
    }
    // A vehicle under an arm's sweep stops it coming down.
    function drawbridgeArmClear(d, arm) {
      const body = drawbridgeArmBody(d, arm);
      body.hx = 7;
      for (const c of vehicles) {
        if (isBoat(c) || isAircraft(c) || c.hp <= 0) continue;
        if (Math.abs(c.x - body.x) > 80 || Math.abs(c.y - body.y) > 80) continue;
        if (boxContact(vehicleShape(c, 2), body)) return false;
      }
      return true;
    }
    function moveDrawbridgeArms(d, entry, target, deltaSeconds) {
      let done = true;
      for (const arm of drawbridgeArms(d)) {
        if (entry !== null && arm.entry !== entry) continue;
        if (arm.broken) continue;
        const step = deltaSeconds / DRAWBRIDGE_ARM_SECONDS;
        if (target > arm.pos && arm.pos < 0.3 && !drawbridgeArmClear(d, arm)) {
          done = false;
          continue;
        }
        arm.pos = target > arm.pos ? Math.min(target, arm.pos + step) : Math.max(target, arm.pos - step);
        if (arm.pos !== target) done = false;
      }
      return done;
    }
    /* A vehicle arriving fast enough snaps an arm instead of stopping at it (the
       base gate's rule, military.js). Traffic crawling up to it just stops. */
    function updateDrawbridgeRamming(d) {
      for (const arm of drawbridgeArms(d)) {
        if (!drawbridgeArmBlocking(arm)) continue;
        const body = drawbridgeArmBody(d, arm);
        for (const c of vehicles) {
          if (c.hp <= 0 || isBoat(c) || isAircraft(c) || (c.deckLift || 0) > 12) continue;
          if (Math.abs(c.x - body.x) > 90 || Math.abs(c.y - body.y) > 90) continue;
          const speed = Math.hypot(c.vx || 0, c.vy || 0);
          if (speed < DRAWBRIDGE_ARM_SNAP || !boxContact(vehicleShape(c, 5 + speed * 0.04), body)) continue;
          arm.broken = true;
          arm.brokenAt = gameTime;
          arm.brokenBy = c === player.car ? 'player' : c.cop ? 'police' : 'traffic';
          c.vx *= 0.88;
          c.vy *= 0.88;
          c.speed *= 0.88;
          damageVehicle(c, 5, body.x, body.y, null, { kind: 'crash', nx: -Math.cos(c.a), ny: -Math.sin(c.a), closing: speed, otherMass: 0.3 });
          particle(body.x, body.y, '#f1ece2', 14, 150, 4);
          particle(body.x, body.y, '#c8302a', 8, 120, 3);
          playSample('crash-debris', 0.5, 1.15, body);
          if (c === player.car) {
            shake = Math.max(shake, 3);
            tell('Barrier arm snapped.', 2.5);
          }
          break;
        }
      }
    }
    /* ---- Traffic, police and people ----------------------------------------------- */
    /* The speed limit for traffic heading onto a drawbridge: brake to the stop line
       while the bridge is closed to traffic, or, already past it, to the trunnion
       while the span is not seated. `desired` is the traffic controller's speed
       (trafficControl, isleTrafficControl, countyRouteControl, the police). */
    function drawbridgeTrafficLimit(c, desired) {
      if (drawbridgesQuiet) return desired;
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) if (list[i].phase !== 'idle' || list[i].angle > 0.0005) desired = drawbridgeTrafficLimitAt(list[i], c, desired);
      return desired;
    }
    /* Police in pursuit run the lowered gates but never drive into a span that is
       not seated: they brake to the trunnion (pursuitControl). */
    function drawbridgeSpanLimit(c, desired) {
      if (drawbridgesQuiet) return desired;
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) if (drawbridgeSpanClosed(list[i])) desired = drawbridgeTrafficLimitAt(list[i], c, desired, true);
      return desired;
    }
    function drawbridgeTrafficLimitAt(d, c, desired, spanOnly = false) {
      if (!drawbridgeNear(d, c.x, c.y)) return desired;
      const g = drawbridgeGeometry(d),
        p = drawbridgeLocal(d, c.x, c.y);
      if (Math.abs(p.v) > g.half + 6) return desired;
      const heading = Math.cos(c.a - g.f.a);
      if (Math.abs(heading) < 0.6) return desired;
      const sign = heading > 0 ? 1 : -1,
        front = p.u + (sign * vehicleSpec(c).l) / 2,
        stop = g.stops[sign > 0 ? 0 : 1],
        span = g.hinge[sign > 0 ? 0 : 1] - sign * 6;
      // Only traffic heading toward the span from its own side of it.
      if ((span - p.u) * sign < 0) return desired;
      let line = null;
      if (!spanOnly && (stop - front) * sign > -2 && drawbridgeStopsTraffic(d)) {
        line = stop;
        // At the first amber a car too close to stop comfortably carries on.
        const speed = Math.max(0, c.speed || 0);
        if (d.phase === 'warning' && d.timer < 2.5 && (stop - front) * sign < (speed * speed) / (2 * 230) + 4) line = null;
      }
      if (line === null && drawbridgeSpanClosed(d)) line = span;
      if (line === null) return desired;
      const gap = (line - front) * sign;
      if (gap < 3) return 0;
      return Math.min(desired, Math.sqrt(2 * 230 * Math.max(0, gap - 3)) * 0.82, Math.max(0, gap - 6) * 1.25);
    }
    /* Keeps every vehicle but the player's own off a span that is not seated:
       true when the step took more of its corners onto the span (settleVehicle
       then puts it back, as at the water's edge). Police stop at the gap. */
    function drawbridgeKeepsOff(c) {
      if (drawbridgesQuiet) return false;
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) if (drawbridgeKeepsOffAt(list[i], c)) return true;
      return false;
    }
    function drawbridgeKeepsOffAt(d, c) {
      if (!drawbridgeSpanClosed(d) || !drawbridgeNear(d, c.x, c.y, 60)) return false;
      const g = drawbridgeGeometry(d),
        spec = vehicleSpec(c),
        p = drawbridgeLocal(d, c.x, c.y);
      if (Math.abs(p.v) > g.half + spec.l || p.u < g.hinge[0] - spec.l - 4 || p.u > g.hinge[1] + spec.l + 4) return false;
      // Corners on the span (no allocation: this runs every step for queued cars).
      const count = (x, y, a) => {
        const ux = Math.cos(a),
          uy = Math.sin(a);
        let n = 0;
        for (let i = -1; i <= 1; i += 2)
          for (let j = -1; j <= 1; j += 2)
            if (drawbridgeOnSpanOf(d, x + (ux * spec.l * i - uy * spec.w * j) / 2, y + (uy * spec.l * i + ux * spec.w * j) / 2)) n++;
        return n;
      };
      const now = count(c.x, c.y, c.a);
      return now > 0 && now > count(c.stepStartX, c.stepStartY, c.stepStartA);
    }
    /* People: behind the sidewalk arms while they are down, and never onto a span
       that is not seated. Only steps inward are refused, so anyone caught inside
       can always walk out. */
    function drawbridgeFootBlocked(body, x, y, r) {
      if (drawbridgesQuiet) return false;
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) if (list[i].phase !== 'idle' && drawbridgeFootBlockedAt(list[i], body, x, y, r)) return true;
      return false;
    }
    function drawbridgeFootBlockedAt(d, body, x, y, r) {
      if (!drawbridgeNear(d, x, y)) return false;
      const g = drawbridgeGeometry(d),
        to = drawbridgeLocal(d, x, y);
      if (Math.abs(to.v) > g.half + r + 4) return false;
      const from = drawbridgeLocal(d, body.x, body.y),
        inward = Math.abs(to.u - g.m) < Math.abs(from.u - g.m);
      if (!inward) return false;
      if (drawbridgeSpanClosed(d) && to.u > g.hinge[0] - 4 - r && to.u < g.hinge[1] + 4 + r) return true;
      const sidewalkArmsDown = drawbridgeArms(d).some((a) => !a.broken && a.pos > 0.5);
      if (!sidewalkArmsDown || Math.abs(to.v) < g.road) return false;
      const inside = (p) => p.u > g.gates[0] + 1 && p.u < g.gates[1] - 1;
      return inside(to) && !inside(from);
    }
    // Barrier arms and steep leaves as bodies for the contact passes (vehicleBroadphase).
    function drawbridgeBarrierBodies(barrierCars, barrierBodies) {
      if (drawbridgesQuiet) return;
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) drawbridgeBarrierBodiesAt(list[i], barrierCars, barrierBodies);
    }
    function drawbridgeBarrierBodiesAt(d, barrierCars, barrierBodies) {
      if (d.phase === 'idle' && d.angle < 0.001) return;
      const g = drawbridgeGeometry(d),
        arms = drawbridgeArms(d).filter(drawbridgeArmBlocking),
        steep = d.angle > DRAWBRIDGE_WALL_ANGLE;
      if (!arms.length && !steep) return;
      const bodies = arms.map((arm) => drawbridgeArmBody(d, arm));
      if (steep) {
        const tip = Math.max(4, drawbridgeTipReach(d));
        for (const leaf of [-1, 1]) {
          const hinge = g.hinge[leaf < 0 ? 0 : 1],
            p = bridgePoint(g.bridge, hinge - (leaf * tip) / 2 + leaf * 0);
          bodies.push({ x: p.x, y: p.y, hx: tip / 2 + 1, hy: g.half, a: g.f.a, height: 200, kind: 'drawbridge leaf', id: 'drawbridge leaf ' + (d.index ? d.id + ' ' : '') + leaf, leaf, drawbridge: d });
        }
      }
      for (const c of vehicles) {
        if (isBoat(c) || isAircraft(c) || !drawbridgeNear(d, c.x, c.y, 40)) continue;
        for (const b of bodies) {
          if (Math.abs(c.x - b.x) > 150 || Math.abs(c.y - b.y) > 150) continue;
          // A car already on a leaf slides down it; the wall is for those arriving.
          if (b.leaf && c.deckLeaf === b.leaf && c.deckBridge === d) continue;
          if (b.arm && (c.deckLift || 0) > 12) continue;
          barrierCars.push(c);
          barrierBodies.push(b);
        }
      }
    }
    /* The GPS: extra seconds a crossing of the span costs right now, as road
       units at a typical driving speed (0 while the bridge is open to traffic). */
    function drawbridgeRouteDelay(d) {
      if (!d || d.phase === 'idle') return 0;
      return drawbridgeSecondsToTraffic(d) * 45 * KMH;
    }
    // Roughly how long until traffic can cross again.
    function drawbridgeSecondsToTraffic(d) {
      // A full swing takes about a minute (eased at both ends); the lock bars,
      // seating and the arms add the rest.
      const fullSwing = DRAWBRIDGE_MAX_ANGLE / DRAWBRIDGE_RATE + 8,
        down = (d.angle / DRAWBRIDGE_MAX_ANGLE) * fullSwing + 12,
        passage = 34;
      switch (d.phase) {
        case 'idle':
          return 0;
        case 'warning':
        case 'gates':
        case 'clearing':
        case 'unlock':
          return fullSwing * 2 + passage + 12;
        case 'raising':
          return fullSwing * (1 - d.angle / DRAWBRIDGE_MAX_ANGLE) + passage + fullSwing + 12;
        case 'open':
          return Math.max(8, passage - d.timer) + down;
        case 'lowering':
        case 'seating':
          return down;
        default:
          return 6;
      }
    }
    /* A navigation link crossing a drawbridge's span (tested while the route graph
       is built; the graph itself is built as if the bridges were down): the
       drawbridge it crosses, or null. */
    function drawbridgeLinkCrosses(a, b) {
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) {
        const d = list[i],
          g = drawbridgeGeometry(d),
          p = drawbridgeLocal(d, a.x, a.y),
          q = drawbridgeLocal(d, b.x, b.y);
        if (Math.abs(p.v) > g.half && Math.abs(q.v) > g.half) continue;
        if (Math.min(p.u, q.u) < g.hinge[1] && Math.max(p.u, q.u) > g.hinge[0]) return d;
      }
      return null;
    }
    /* ---- Leaves as ramps, and the jump ---------------------------------------------- */
    /* Slope gravity and the tyres' limit on a leaf, applied in controlVehicle
       before the engine's push is added. The car's velocity is kept as its
       horizontal part (the climb is deckVz), so both forces enter as their
       horizontal components: gravity along the slope g sin(a) cos(a), and the
       wheels' push along the slope (at most DRAWBRIDGE_GRIP g cos(a)) times cos(a).
       Returns the horizontal acceleration the wheels give. */
    function drawbridgeSlopeDrive(c, acceleration, stepSeconds) {
      if (!c.deckLeaf || !c.deckSlope || !c.deckBridge) return acceleration;
      const g = drawbridgeGeometry(c.deckBridge),
        s = c.deckSlope,
        cosine = 1 / Math.sqrt(1 + s * s),
        pull = (-DRAWBRIDGE_GRAVITY * s) / (1 + s * s);
      c.vx += pull * g.f.ux * stepSeconds;
      c.vy += pull * g.f.uy * stepSeconds;
      /* Only the driven wheels push, and on a climb the load moves off the front:
         a front-wheel-drive saloon has about a third of its weight on the wheels
         that drive it up a 25 degree leaf (drivenShare, offroad.js; 4x4s all of
         it). The brakes act on all four. The deck is wetter and slicker in rain. */
      const mu = DRAWBRIDGE_GRIP - 0.3 * clamp(weather.wet || 0, 0, 1),
        forward = (c.speed || 0) >= 0 ? 1 : -1,
        grade = s * Math.cos(c.a - g.f.a) * forward,
        driving = acceleration * forward > 0,
        share = driving ? drivenShare(vehicleSpec(c), grade) : 1,
        grip = mu * share * DRAWBRIDGE_GRAVITY * cosine;
      return clamp(acceleration, -grip, grip) * cosine;
    }
    /* THE KINK AT THE TRUNNION. A raised leaf meets the approach at a sharp angle:
       the wheels hit the slope and the part of the car's speed square to it is
       lost into the springs and tyres (and, fast enough, the front end). The speed
       along the new slope is the old speed times cos(the change of angle), and the
       car keeps its horizontal part. At 35 degrees a car keeps 82% of its speed up
       the leaf; what it lost is the reason a steep leaf needs a fast car. */
    function drawbridgeKink(d, c, s0, s1, speedU) {
      const g = drawbridgeGeometry(d),
        direction = Math.sign(speedU),
        before = Math.atan(s0 * direction),
        after = Math.atan(s1 * direction),
        turn = after - before;
      if (turn < 0.004) return;
      const along = Math.abs(speedU) / Math.cos(before),
        into = along * Math.sin(turn),
        keep = (Math.cos(turn) * Math.cos(after)) / Math.cos(before) - 1;
      c.vx += g.f.ux * speedU * keep;
      c.vy += g.f.uy * speedU * keep;
      if (into > 5 * UNITS_PER_METRE) {
        damageVehicle(c, (into - 5 * UNITS_PER_METRE) * 0.7, c.x, c.y, null, { kind: 'crash', nx: -direction * g.f.ux, ny: -direction * g.f.uy, closing: into, otherMass: 0 });
        playSample(into > 12 * UNITS_PER_METRE ? 'crash-heavy-1' : 'crash-medium-1', clamp(into / (17 * UNITS_PER_METRE), 0.25, 0.9), 1, c);
        if (c === player.car) shake = Math.max(shake, Math.min(9, into / 12));
      } else if (into > 1.5 * UNITS_PER_METRE) playSample('crash-bump-1', 0.3, 1, c);
    }
    /* A road vehicle in the air: no grip, no steering, gravity. Called by
       controlVehicle instead of the driving model; drawbridgeSettle lands it. */
    function drawbridgeFlight(c, stepSeconds) {
      c.deckVz -= DRAWBRIDGE_GRAVITY * stepSeconds;
      c.deckLift += c.deckVz * stepSeconds;
      const drag = Math.exp(-0.05 * stepSeconds);
      c.vx *= drag;
      c.vy *= drag;
      c.av *= Math.exp(-1.5 * stepSeconds);
      c.a = normalizeAngle(c.a + c.av * stepSeconds);
      // The nose drops through the flight.
      c.slopePitch = Math.max(-0.7, (c.slopePitch || 0) - 0.55 * stepSeconds);
      c.moveA = Math.atan2(c.vy, c.vx);
      c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
    }
    function drawbridgeLeaveDeck(c) {
      c.deckLift = 0;
      c.deckVz = 0;
      c.deckAir = false;
      c.deckLeaf = 0;
      c.deckSlope = 0;
      c.deckBridge = undefined;
      c.groundHeight = 0;
      c.slopePitch = 0;
      c.poseX = undefined;
    }
