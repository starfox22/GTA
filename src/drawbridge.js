    // BEGIN SUBSYSTEM: src/drawbridge.js — The Palm Sound drawbridge: schedule, gates, leaves, jumps
    /**
     * The Palm Sound drawbridge
     * Source: src/drawbridge.js
     * Scope: shared game closure (after geography.js and water.js; drawn by
     * drawbridge3d.js).
     *
     * The Palm Sound Causeway (BRIDGES 'keys-harbor', Harbor Ave at y 3200) is a
     * working double-leaf trunnion bascule. Its layout comes from bridgeStructure()
     * (`s.bascule`: trunnions, leaf length, piers, gate and stop lines), so the
     * renderer, the physics and the boats agree on it.
     *
     * SCHEDULE. The bridge opens at DRAWBRIDGE_OPENINGS (minutes of the day) for
     * the ketch ALBATROSS, whose masts are far too tall for the deck; each
     * opening takes her across from one anchorage in Palm Sound to the other. An
     * opening runs like a real one, one phase after another:
     *   warning    bells, the traffic signals go amber then red, lamps flash
     *   gates      the entry arms come down on both approaches, then the exit
     *              arms (an arm waits while a vehicle is under it)
     *   clearing   the tender waits until nobody is left on the moving span
     *   unlock     the centre locks draw back (clank)
     *   raising    both leaves swing up together, eased, ~4 degrees a second, to 78
     *   open       the ketch passes through the channel
     *   lowering   the leaves come down, eased
     *   seating    the locks drive home
     *   lifting    the arms rise, the signals go green
     * The phase clock is game seconds (one second is an in-game minute), so an
     * opening lasts about ninety seconds of play.
     *
     * TRAFFIC AND PEOPLE. Traffic stops at the stop lines (drawbridgeTrafficLimit,
     * called from trafficControl), queues, and moves off when the arms rise. No
     * vehicle other than the player's may roll onto the span unless it is seated
     * (drawbridgeKeepsOff, from settleVehicle): cops and runaways stop at the
     * trunnion. The arms are solid for vehicles and snap for anything faster
     * than DRAWBRIDGE_ARM_SNAP (updateDrawbridgeRamming). People are kept behind
     * the sidewalk arms and off a moving span (drawbridgeFootBlocked). The GPS
     * weighs the crossing by how long the bridge will stay closed
     * (drawbridgeRouteDelay, navShortestPath), so a short trip waits and a long
     * one goes round by the Keys Bridge.
     *
     * LEAVES AND JUMPS. The leaves are ramps: a road vehicle on a leaf follows its
     * surface (deckLift, slopePitch; entityElevation adds deckLift), feels its
     * slope (drawbridgeSlopeDrive: gravity along the slope, tyres grip only up
     * to about 40 degrees) and leaves the tip ballistically into the gap
     * (deckAir, drawbridgeFlight: height, vertical speed, gravity, no grip).
     * It lands on the far leaf or the deck beyond (impact damage by the speed
     * into the surface), strikes the far leaf's end if it comes in low, or falls
     * into the Sound, where water.js floods it. A leaf steeper than
     * DRAWBRIDGE_WALL_ANGLE is a wall. The open gap is not deck (onBridgeDeck).
     */
    const DRAWBRIDGE_OPENINGS = [50, 330, 615, 900, 1240], // 00:50, 05:30, 10:15, 15:00, 20:40
      DRAWBRIDGE_MAX_ANGLE = (78 * Math.PI) / 180,
      DRAWBRIDGE_RATE = (4.2 * Math.PI) / 180, // top swing speed, radians a second
      DRAWBRIDGE_SWING_ACCEL = (1.4 * Math.PI) / 180, // how fast the swing speeds up and slows
      DRAWBRIDGE_WALL_ANGLE = (40 * Math.PI) / 180,
      DRAWBRIDGE_GRAVITY = 300, // units/s², matched to the game's driving speeds
      DRAWBRIDGE_GRIP = 0.84, // tyre friction on the steel: no climbing past ~40 degrees
      DRAWBRIDGE_ARM_SNAP = 70,
      DRAWBRIDGE_ARM_SECONDS = 5.5;
    const drawbridge = {
      phase: 'idle',
      timer: 0,
      angle: 0,
      rate: 0,
      target: 0,
      held: null,
      lastSlot: null,
      openings: 0,
      waited: 0,
      bellClock: 0,
      hornAt: -99,
      warnedPlayer: false,
      jumps: [],
      splashes: 0,
      arms: null,
      vessel: null,
      geo: null,
      motor: null,
    };
    /* ---- Layout ------------------------------------------------------------------ */
    function drawbridgeGeometry() {
      if (drawbridge.geo) return drawbridge.geo;
      const bridge = BRIDGES.find((b) => b.movable),
        s = bridgeStructure(bridge),
        f = bridgeFrame(bridge),
        b = s.bascule,
        centre = bridgePoint(bridge, 0),
        channel = bridgePoint(bridge, s.middle);
      return (drawbridge.geo = {
        bridge,
        s,
        f,
        b,
        m: s.middle,
        hinge: b.trunnions,
        leaf: b.leaf,
        drop: b.drop,
        half: bridge.width / 2,
        road: (bridge.width - 22) / 2,
        gates: b.gates,
        stops: b.stops,
        centre,
        channel,
        // A loose box round everything the drawbridge governs, for cheap rejects.
        reach: Math.max(Math.abs(b.stops[0]), Math.abs(b.stops[1])) + 320,
      });
    }
    // A map point in the bridge's frame: u along the deck, v across it.
    function drawbridgeLocal(x, y) {
      const g = drawbridgeGeometry(),
        dx = x - g.centre.x,
        dy = y - g.centre.y;
      return { u: dx * g.f.ux + dy * g.f.uy, v: -dx * g.f.uy + dy * g.f.ux };
    }
    function drawbridgeNear(x, y, pad = 0) {
      const g = drawbridgeGeometry(),
        dx = x - g.centre.x,
        dy = y - g.centre.y;
      return Math.abs(dx) < g.reach + pad && Math.abs(dy) < g.reach + pad;
    }
    // Horizontal reach of a leaf from its trunnion at `angle` (the tip's offset).
    function drawbridgeTipReach(angle = drawbridge.angle) {
      const g = drawbridgeGeometry();
      return g.leaf * Math.cos(angle) - g.drop * Math.sin(angle);
    }
    /* The road surface at `u` with the leaves at `angle`: {h, slope (dh/du),
       leaf (-1 west, 1 east)} on a leaf, null over the open gap, undefined off the
       moving span. The trunnion axis lies `drop` below the road, as the renderer
       hinges the leaf. */
    function drawbridgeSurface(u, angle = drawbridge.angle) {
      const g = drawbridgeGeometry();
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
    // Is this map point over the open gap between the leaf tips? (onBridgeDeck)
    function drawbridgeOpenGap(x, y, r = 0) {
      if (drawbridge.angle < 0.004 || drawbridge.routing) return false;
      const g = drawbridgeGeometry(),
        p = drawbridgeLocal(x, y);
      if (Math.abs(p.v) > g.half + 2) return false;
      const tip = drawbridgeTipReach();
      return p.u > g.hinge[0] + tip - r && p.u < g.hinge[1] - tip + r;
    }
    // On the moving span (trunnion to trunnion) and within the deck's width.
    function drawbridgeOnSpan(x, y, pad = 0) {
      const g = drawbridgeGeometry(),
        p = drawbridgeLocal(x, y);
      return Math.abs(p.v) < g.half + pad && p.u > g.hinge[0] - 2 - pad && p.u < g.hinge[1] + 2 + pad;
    }
    // Everything between the leaves' hinges is closed to traffic while not seated.
    function drawbridgeSpanClosed() {
      return drawbridge.angle > 0.0005 || ['unlock', 'raising', 'open', 'lowering', 'seating'].includes(drawbridge.phase);
    }
    // Traffic is held at the stop lines from the first bell until the arms are nearly up.
    function drawbridgeStopsTraffic() {
      if (drawbridge.phase === 'idle') return false;
      if (drawbridge.phase === 'lifting') return drawbridge.arms.some((a) => a.pos > 0.35 && !a.broken);
      return true;
    }
    /* ---- Barrier arms -------------------------------------------------------------- */
    /* Four arms: on each approach one over the lanes into the bridge (entry) and
       one over the lanes out (exit), each pivoting from a cabinet on the kerb
       with a short arm over the sidewalk. pos is 0 up (vertical) .. 1 down. */
    function drawbridgeArms() {
      if (drawbridge.arms) return drawbridge.arms;
      const g = drawbridgeGeometry();
      drawbridge.arms = [];
      for (const approach of [-1, 1])
        for (const side of [-1, 1]) {
          // Driving on the right: traffic heading into the bridge from the west
          // (toward +u) keeps to +v; from the east to -v.
          const entry = side === -approach;
          drawbridge.arms.push({
            approach,
            side,
            entry,
            u: g.gates[approach < 0 ? 0 : 1],
            pos: 0,
            broken: false,
            id: (approach < 0 ? 'west' : 'east') + '-' + (entry ? 'entry' : 'exit'),
          });
        }
      return drawbridge.arms;
    }
    // The arm's collision box across its half of the deck (road and sidewalk), on the map.
    function drawbridgeArmBody(arm) {
      const g = drawbridgeGeometry(),
        p = bridgePoint(g.bridge, arm.u, (arm.side * g.half) / 2);
      return { x: p.x, y: p.y, hx: 1.6, hy: g.half / 2, a: g.f.a, height: 10, kind: 'drawbridge arm', id: 'drawbridge ' + arm.id, arm };
    }
    function drawbridgeArmBlocking(arm) {
      return !arm.broken && arm.pos > 0.55;
    }
    // A vehicle under an arm's sweep stops it coming down.
    function drawbridgeArmClear(arm) {
      const body = drawbridgeArmBody(arm);
      body.hx = 7;
      for (const c of vehicles) {
        if (isBoat(c) || isAircraft(c) || c.hp <= 0) continue;
        if (Math.abs(c.x - body.x) > 80 || Math.abs(c.y - body.y) > 80) continue;
        if (boxContact(vehicleShape(c, 2), body)) return false;
      }
      return true;
    }
    function moveDrawbridgeArms(entry, target, deltaSeconds) {
      let done = true;
      for (const arm of drawbridgeArms()) {
        if (entry !== null && arm.entry !== entry) continue;
        if (arm.broken) continue;
        const step = deltaSeconds / DRAWBRIDGE_ARM_SECONDS;
        if (target > arm.pos && arm.pos < 0.3 && !drawbridgeArmClear(arm)) {
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
    function updateDrawbridgeRamming() {
      for (const arm of drawbridgeArms()) {
        if (!drawbridgeArmBlocking(arm)) continue;
        const body = drawbridgeArmBody(arm);
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
    /* The speed limit for traffic heading onto the bridge: brake to the stop line
       while the bridge is closed to traffic, or, already past it, to the trunnion
       while the span is not seated. `desired` is trafficControl's speed. */
    function drawbridgeTrafficLimit(c, desired) {
      if (drawbridge.phase === 'idle' || !drawbridgeNear(c.x, c.y)) return desired;
      const g = drawbridgeGeometry(),
        p = drawbridgeLocal(c.x, c.y);
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
      if ((stop - front) * sign > -2 && drawbridgeStopsTraffic()) {
        line = stop;
        // At the first amber a car too close to stop comfortably carries on.
        const speed = Math.max(0, c.speed || 0);
        if (drawbridge.phase === 'warning' && drawbridge.timer < 2.5 && (stop - front) * sign < (speed * speed) / (2 * 230) + 4) line = null;
      }
      if (line === null && drawbridgeSpanClosed()) line = span;
      if (line === null) return desired;
      const gap = (line - front) * sign;
      if (gap < 3) return 0;
      return Math.min(desired, Math.sqrt(2 * 230 * Math.max(0, gap - 3)) * 0.82, Math.max(0, gap - 6) * 1.25);
    }
    /* Keeps every vehicle but the player's own off a span that is not seated:
       true when the step took more of its corners onto the span (settleVehicle
       then puts it back, as at the water's edge). Police stop at the gap. */
    function drawbridgeKeepsOff(c) {
      if (!drawbridgeSpanClosed() || !drawbridgeNear(c.x, c.y, 60)) return false;
      const g = drawbridgeGeometry(),
        spec = vehicleSpec(c),
        p = drawbridgeLocal(c.x, c.y);
      if (Math.abs(p.v) > g.half + spec.l || p.u < g.hinge[0] - spec.l - 4 || p.u > g.hinge[1] + spec.l + 4) return false;
      // Corners on the span (no allocation: this runs every step for queued cars).
      const count = (x, y, a) => {
        const ux = Math.cos(a),
          uy = Math.sin(a);
        let n = 0;
        for (let i = -1; i <= 1; i += 2)
          for (let j = -1; j <= 1; j += 2)
            if (drawbridgeOnSpan(x + (ux * spec.l * i - uy * spec.w * j) / 2, y + (uy * spec.l * i + ux * spec.w * j) / 2)) n++;
        return n;
      };
      const now = count(c.x, c.y, c.a);
      return now > 0 && now > count(c.stepStartX, c.stepStartY, c.stepStartA);
    }
    /* People: behind the sidewalk arms while they are down, and never onto a span
       that is not seated. Only steps inward are refused, so anyone caught inside
       can always walk out. */
    function drawbridgeFootBlocked(body, x, y, r) {
      if (drawbridge.phase === 'idle' || !drawbridgeNear(x, y)) return false;
      const g = drawbridgeGeometry(),
        to = drawbridgeLocal(x, y);
      if (Math.abs(to.v) > g.half + r + 4) return false;
      const from = drawbridgeLocal(body.x, body.y),
        inward = Math.abs(to.u - g.m) < Math.abs(from.u - g.m);
      if (!inward) return false;
      if (drawbridgeSpanClosed() && to.u > g.hinge[0] - 4 - r && to.u < g.hinge[1] + 4 + r) return true;
      const sidewalkArmsDown = drawbridgeArms().some((a) => !a.broken && a.pos > 0.5);
      if (!sidewalkArmsDown || Math.abs(to.v) < g.road) return false;
      const inside = (p) => p.u > g.gates[0] + 1 && p.u < g.gates[1] - 1;
      return inside(to) && !inside(from);
    }
    // Barrier arms and steep leaves as bodies for the contact passes (vehicleBroadphase).
    function drawbridgeBarrierBodies(barrierCars, barrierBodies) {
      if (drawbridge.phase === 'idle' && drawbridge.angle < 0.001) return;
      const g = drawbridgeGeometry(),
        arms = drawbridgeArms().filter(drawbridgeArmBlocking),
        steep = drawbridge.angle > DRAWBRIDGE_WALL_ANGLE;
      if (!arms.length && !steep) return;
      const bodies = arms.map(drawbridgeArmBody);
      if (steep) {
        const tip = Math.max(4, drawbridgeTipReach());
        for (const leaf of [-1, 1]) {
          const hinge = g.hinge[leaf < 0 ? 0 : 1],
            p = bridgePoint(g.bridge, hinge - (leaf * tip) / 2 + leaf * 0);
          bodies.push({ x: p.x, y: p.y, hx: tip / 2 + 1, hy: g.half, a: g.f.a, height: 200, kind: 'drawbridge leaf', id: 'drawbridge leaf ' + leaf, leaf });
        }
      }
      for (const c of vehicles) {
        if (isBoat(c) || isAircraft(c) || !drawbridgeNear(c.x, c.y, 40)) continue;
        for (const b of bodies) {
          if (Math.abs(c.x - b.x) > 150 || Math.abs(c.y - b.y) > 150) continue;
          // A car already on a leaf slides down it; the wall is for those arriving.
          if (b.leaf && c.deckLeaf === b.leaf) continue;
          if (b.arm && (c.deckLift || 0) > 12) continue;
          barrierCars.push(c);
          barrierBodies.push(b);
        }
      }
    }
    /* The GPS: extra seconds a crossing of the span costs right now, as road
       units at a typical driving speed (0 while the bridge is open to traffic). */
    function drawbridgeRouteDelay() {
      if (drawbridge.phase === 'idle') return 0;
      return drawbridgeSecondsToTraffic() * 230;
    }
    // Roughly how long until traffic can cross again.
    function drawbridgeSecondsToTraffic() {
      const d = drawbridge,
        swing = d.angle / DRAWBRIDGE_RATE + 3;
      switch (d.phase) {
        case 'idle':
          return 0;
        case 'warning':
        case 'gates':
        case 'clearing':
        case 'unlock':
          return 75;
        case 'raising':
          return 60 - d.angle * 20;
        case 'open':
          return swing + 20;
        case 'lowering':
        case 'seating':
          return swing + 8;
        default:
          return 6;
      }
    }
    /* A navigation link crossing the span (tested while the route graph is built;
       the graph itself is built as if the bridge were down). */
    function drawbridgeLinkCrosses(a, b) {
      const g = drawbridgeGeometry();
      if (!drawbridgeNear(a.x, a.y) && !drawbridgeNear(b.x, b.y)) return false;
      const p = drawbridgeLocal(a.x, a.y),
        q = drawbridgeLocal(b.x, b.y);
      if (Math.abs(p.v) > g.half && Math.abs(q.v) > g.half) return false;
      return Math.min(p.u, q.u) < g.hinge[1] && Math.max(p.u, q.u) > g.hinge[0];
    }
    /* ---- Leaves as ramps, and the jump ---------------------------------------------- */
    /* Slope gravity and the tyres' limit on a leaf, applied in controlVehicle
       before the engine's push is added. Returns the engine acceleration allowed. */
    function drawbridgeSlopeDrive(c, acceleration, stepSeconds) {
      if (!c.deckLeaf || !c.deckSlope) return acceleration;
      const g = drawbridgeGeometry(),
        s = c.deckSlope,
        cosine = 1 / Math.sqrt(1 + s * s),
        pull = (-DRAWBRIDGE_GRAVITY * s) / (1 + s * s);
      c.vx += pull * g.f.ux * stepSeconds;
      c.vy += pull * g.f.uy * stepSeconds;
      const grip = DRAWBRIDGE_GRIP * DRAWBRIDGE_GRAVITY * cosine;
      return clamp(acceleration, -grip, grip);
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
      c.groundHeight = 0;
      c.slopePitch = 0;
      c.poseX = undefined;
    }
    /* After the contacts (settleVehicle): follow a leaf's surface, take off from
       its tip, land, strike the far leaf's end or fall into the Sound. */
    function drawbridgeSettle(c, stepSeconds) {
      if (isAircraft(c) || isBoat(c)) return;
      const active = c.deckAir || c.deckLeaf || c.deckLift;
      // In the Sound (water.js floods it): the leaves have nothing more to do with it.
      if (c.sinkFor > 0) {
        if (active) drawbridgeLeaveDeck(c);
        return;
      }
      if (!active && (drawbridge.angle < 0.004 || !drawbridgeNear(c.x, c.y, 60))) return;
      const g = drawbridgeGeometry(),
        p = drawbridgeLocal(c.x, c.y),
        onDeckWidth = Math.abs(p.v) < g.half - 2,
        surface = onDeckWidth ? drawbridgeSurface(p.u) : undefined,
        speedU = c.vx * g.f.ux + c.vy * g.f.uy;
      if (c.deckAir) {
        const ground = surface === undefined ? (groundAt(c.x, c.y) ? 0 : null) : surface ? surface.h : null;
        if (surface && c.deckLift < surface.h - 7) {
          // Came in under the far leaf's tip: strike its end and drop into the gap.
          const start = drawbridgeLocal(c.stepStartX, c.stepStartY),
            before = drawbridgeSurface(start.u);
          if (before === null) {
            const closing = Math.abs(speedU);
            c.x = c.stepStartX;
            c.y = c.stepStartY;
            c.vx -= g.f.ux * speedU * 1.3;
            c.vy -= g.f.uy * speedU * 1.3;
            damageVehicle(c, Math.max(4, closing * 0.12), c.x, c.y, null, { kind: 'crash', nx: -Math.sign(speedU) * g.f.ux, ny: -Math.sign(speedU) * g.f.uy, closing, otherMass: 0 });
            playSample('crash-heavy-1', 0.7, 0.9, c);
            if (c === player.car) shake = Math.max(shake, 7);
            return drawbridgePose(c, stepSeconds);
          }
        }
        if (ground !== null && c.deckLift <= ground) {
          // Touchdown: what hurts is the speed into the surface.
          const slope = surface ? surface.slope : 0,
            surfaceVz = slope * speedU,
            into = (surfaceVz - c.deckVz) / Math.sqrt(1 + slope * slope),
            jump = c.deckJump;
          c.deckAir = false;
          c.deckLift = ground;
          c.deckVz = surfaceVz;
          if (jump) jump.crossed = (p.u - g.m) * jump.leaf < 0;
          if (into > 70) {
            const hit = (into - 70) * 0.22;
            damageVehicle(c, hit, c.x, c.y, null, { kind: 'crash', nx: 0, ny: 0, closing: into, otherMass: 0 });
            playSample(into > 180 ? 'crash-heavy-2' : 'crash-medium-1', clamp(into / 260, 0.25, 0.9), 1, c);
            if (c === player.car) shake = Math.max(shake, Math.min(10, into / 30));
          } else playSample('crash-bump-1', 0.35, 1, c);
          const keep = into > 140 ? 0.8 : 0.93;
          c.vx *= keep;
          c.vy *= keep;
          if (jump) {
            jump.landed = true;
            jump.distance = Math.round(worldMeters(distanceBetween(jump, c)));
            jump.impact = Math.round(into);
            if (c === player.car && jump.crossed) announce('BRIDGE JUMP', jump.distance + ' M OVER PALM SOUND', 3.5);
            c.deckJump = null;
          }
          if (!surface) drawbridgeLeaveDeck(c);
          else {
            // Down on a leaf: it carries the car from this step on.
            c.deckLeaf = surface.leaf;
            c.deckSlope = surface.slope;
            c.slopePitch = Math.atan(surface.slope * Math.cos(c.a - g.f.a));
          }
        } else if (ground === null && c.deckLift <= 0) {
          // Into the Sound: water.js floods the car from here.
          c.deckAir = false;
          c.deckLift = 0;
          c.vx *= 0.3;
          c.vy *= 0.3;
          splashAt(c.x, c.y, 2.6);
          drawbridge.splashes++;
          if (c.deckJump) {
            c.deckJump.landed = false;
            c.deckJump.splash = true;
            c.deckJump = null;
          }
          if (c === player.car) tell('Short. The Sound takes the car.', 3);
          drawbridgeLeaveDeck(c);
          return;
        }
        return drawbridgePose(c, stepSeconds);
      }
      if (surface === undefined) {
        // Over the side of a raised leaf: down it goes. Otherwise back on the flat.
        if ((c.deckLift || 0) > 2) {
          c.deckAir = true;
          c.deckLeaf = 0;
          c.deckSlope = 0;
          return drawbridgePose(c, stepSeconds);
        }
        if (c.deckLeaf || c.deckLift) drawbridgeLeaveDeck(c);
        return;
      }
      if (surface === null) {
        // Already down in the gap (in the water): nothing to take off from.
        if (!c.deckLeaf && !((c.deckLift || 0) > 0.5)) return;
        // Off the tip: airborne, carrying the leaf's climb (and its lift as it rises).
        c.deckAir = true;
        c.deckVz = c.deckVz || 0;
        c.deckLeaf = 0;
        c.deckSlope = 0;
        c.deckJump = { x: c.x, y: c.y, leaf: p.u < g.m ? -1 : 1, speed: Math.round(Math.abs(speedU)), angle: Math.round((drawbridge.angle * 180) / Math.PI), at: gameTime, crossed: false };
        drawbridge.jumps.push(c.deckJump);
        if (drawbridge.jumps.length > 8) drawbridge.jumps.shift();
        return drawbridgePose(c, stepSeconds);
      }
      // On a leaf: ride its surface; the vertical speed is what a take-off carries.
      const rise = (surface.h - (c.deckLift || 0)) / stepSeconds;
      c.deckVz = (c.deckVz || 0) * 0.5 + rise * 0.5;
      c.deckLift = surface.h;
      c.deckLeaf = surface.h > 0.01 || drawbridge.angle > 0.004 ? surface.leaf : 0;
      c.deckSlope = surface.slope;
      c.slopePitch = Math.atan(surface.slope * Math.cos(c.a - g.f.a));
      drawbridgePose(c, stepSeconds);
    }
    function drawbridgePose(c) {
      c.groundHeight = c.deckLift || 0;
      c.poseX = undefined;
      if (c === player.car) player.altitude = c.groundHeight;
    }
    /* ---- Sound ------------------------------------------------------------------- */
    // Level of a bridge sound at the player: fades out over a couple of kilometres.
    function drawbridgeSoundLevel(x, y) {
      const d = Math.hypot(x - player.x, y - player.y);
      return d > 2600 ? 0 : 1 / (1 + d / 320);
    }
    function drawbridgeVoice(level, pan, build) {
      if (!audio || !soundOn || level < 0.01) return;
      const out = audio.createGain(),
        panner = audio.createStereoPanner();
      out.gain.value = level;
      panner.pan.value = clamp(pan, -0.85, 0.85);
      out.connect(panner).connect(master);
      build(out, audio.currentTime);
    }
    /* A warning bell: one strike, a few inharmonic partials ringing down (a
       struck bell's spectrum), repeated by the phase clock. */
    function drawbridgeBell(x, y) {
      drawbridgeVoice(drawbridgeSoundLevel(x, y) * 0.16, (x - player.x) / 500, (out, t) => {
        for (const [ratio, gain, decay] of [
          [1, 1, 0.5],
          [2.76, 0.45, 0.28],
          [5.4, 0.22, 0.16],
          [8.93, 0.1, 0.09],
        ]) {
          const o = audio.createOscillator(),
            g = audio.createGain();
          o.frequency.value = 1180 * ratio;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + decay + 0.02);
        }
      });
    }
    // A clank: the locks driving home, an arm reaching its stop.
    function drawbridgeClank(x, y, weight = 1) {
      drawbridgeVoice(drawbridgeSoundLevel(x, y) * 0.3 * weight, (x - player.x) / 500, (out, t) => {
        const n = Math.floor(audio.sampleRate * 0.35),
          buffer = audio.createBuffer(1, n, audio.sampleRate),
          data = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * 0.05));
        const s = audio.createBufferSource(),
          filter = audio.createBiquadFilter(),
          ring = audio.createOscillator(),
          rg = audio.createGain();
        s.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.value = 520;
        filter.Q.value = 1.8;
        s.connect(filter).connect(out);
        ring.frequency.value = 96;
        rg.gain.setValueAtTime(0.5, t);
        rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        ring.connect(rg).connect(out);
        s.start(t);
        ring.start(t);
        ring.stop(t + 0.32);
      });
    }
    // A ship's or the tender's horn: a prolonged and a short blast.
    function drawbridgeHorn(x, y, pitch, pattern = [1.6, 0.5]) {
      drawbridgeVoice(drawbridgeSoundLevel(x, y) * 0.22, (x - player.x) / 500, (out, t) => {
        let at = t;
        for (const length of pattern) {
          const filter = audio.createBiquadFilter(),
            g = audio.createGain();
          filter.type = 'lowpass';
          filter.frequency.value = pitch * 4;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.5, at + 0.06);
          g.gain.setValueAtTime(0.5, at + length - 0.1);
          g.gain.exponentialRampToValueAtTime(0.0001, at + length);
          filter.connect(g).connect(out);
          for (const detune of [0, 1.007, 1.5]) {
            const o = audio.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = pitch * (detune || 1);
            o.connect(filter);
            o.start(at);
            o.stop(at + length + 0.02);
          }
          at += length + 0.35;
        }
      });
    }
    // The drive motors' hum while the leaves swing: a held voice whose level follows the swing speed.
    function updateDrawbridgeMotor(level) {
      const d = drawbridge;
      if (!audio || !soundOn) return;
      if (level <= 0.001) {
        if (d.motor) {
          d.motor.gain.gain.setTargetAtTime(0, audio.currentTime, 0.3);
          const m = d.motor;
          d.motor = null;
          setTimeout(() => {
            for (const o of m.sources) o.stop();
            m.gain.disconnect();
          }, 1500);
        }
        return;
      }
      if (!d.motor) {
        const gain = audio.createGain(),
          filter = audio.createBiquadFilter(),
          hum = audio.createOscillator(),
          whine = audio.createOscillator(),
          whineGain = audio.createGain();
        gain.gain.value = 0;
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        hum.type = 'sawtooth';
        hum.frequency.value = 58;
        whine.type = 'triangle';
        whine.frequency.value = 232;
        whineGain.gain.value = 0.25;
        hum.connect(filter);
        whine.connect(whineGain).connect(filter);
        filter.connect(gain).connect(master);
        hum.start();
        whine.start();
        d.motor = { gain, whine, sources: [hum, whine] };
      }
      const g = drawbridgeGeometry();
      d.motor.gain.gain.setTargetAtTime(level * drawbridgeSoundLevel(g.channel.x, g.channel.y) * 0.1, audio.currentTime, 0.2);
      d.motor.whine.frequency.setTargetAtTime(180 + 90 * level, audio.currentTime, 0.2);
    }
    /* ---- The ketch ------------------------------------------------------------------ */
    /* ALBATROSS, a classic ketch whose masts clear 30 m: the reason the bridge opens.
       She lies at anchor on one side of the causeway and each opening takes her
       through the channel to the other. `across` is her distance from the deck's
       centre line (+ is the right of a -> b, south here). */
    const DRAWBRIDGE_VESSEL = { length: 132, beam: 32, anchor: 720, hold: 330, cruise: 46, approach: 24 };
    function drawbridgeVessel() {
      if (drawbridge.vessel) return drawbridge.vessel;
      // `dir` is the way she goes next: +1 toward +across.
      drawbridge.vessel = { across: DRAWBRIDGE_VESSEL.anchor, dir: -1, speed: 0, leg: 'anchored', swing: 0, x: 0, y: 0, a: 0 };
      placeDrawbridgeVessel(drawbridge.vessel, 0);
      return drawbridge.vessel;
    }
    function placeDrawbridgeVessel(v, deltaSeconds) {
      const g = drawbridgeGeometry(),
        p = bridgePoint(g.bridge, g.m + Math.sin(v.swing) * 18, v.across),
        heading = g.f.a + (v.dir * Math.PI) / 2;
      v.x = p.x;
      v.y = p.y;
      // At anchor she lies to the breeze, then turns to face the bridge for the next passage.
      const want = v.leg === 'anchored' ? heading + Math.sin(gameTime * 0.05) * 0.12 : heading;
      v.a = deltaSeconds ? normalizeAngle(v.a + clamp(normalizeAngle(want - v.a), -0.12 * deltaSeconds, 0.12 * deltaSeconds)) : want;
    }
    function drawbridgeVesselHulls() {
      const v = drawbridge.vessel;
      if (!v) return [];
      return [{ x: v.x, y: v.y, hx: DRAWBRIDGE_VESSEL.length / 2, hy: DRAWBRIDGE_VESSEL.beam / 2, a: v.a }];
    }
    function updateDrawbridgeVessel(deltaSeconds) {
      const v = drawbridgeVessel(),
        spec = DRAWBRIDGE_VESSEL,
        open = drawbridge.phase === 'open' && drawbridge.held === null;
      // How far she has come across: -anchor at her anchorage, +anchor at the far one.
      const past = v.dir * v.across;
      let want = 0;
      if (v.leg === 'approach') {
        const toHold = -spec.hold - past;
        if (open) v.leg = 'transit';
        else want = toHold > 4 ? Math.min(spec.approach, Math.sqrt(2 * 6 * toHold)) : 0;
      }
      if (v.leg === 'transit') {
        const remaining = spec.anchor - past;
        want = remaining > 4 ? Math.min(spec.cruise, Math.sqrt(2 * 5 * remaining)) : 0;
        // Stand off a boat stopped in the channel ahead of her (the player's).
        const pc = player.car;
        if (pc && isBoat(pc)) {
          const ahead = (pc.x - v.x) * Math.cos(v.a) + (pc.y - v.y) * Math.sin(v.a),
            side = Math.abs(-(pc.x - v.x) * Math.sin(v.a) + (pc.y - v.y) * Math.cos(v.a));
          if (ahead > 0 && ahead < spec.length + 60 && side < spec.beam + 20) want = 0;
        }
        if (remaining <= 4 && v.speed < 2) {
          v.leg = 'anchored';
          v.speed = 0;
          v.across = v.dir * spec.anchor;
          v.dir = -v.dir;
        }
      }
      v.speed += clamp(want - v.speed, -8 * deltaSeconds, 5 * deltaSeconds);
      if (v.leg === 'anchored') v.swing += deltaSeconds * 0.02;
      else v.across += v.dir * v.speed * deltaSeconds;
      placeDrawbridgeVessel(v, deltaSeconds);
    }
    function drawbridgeVesselSetOff() {
      const v = drawbridgeVessel();
      if (v.leg !== 'anchored') return;
      v.leg = 'approach';
      // One prolonged and one short blast: the signal asking for the bridge.
      drawbridgeHorn(v.x, v.y, 196);
    }
    // The ketch is clear of the span on her far side (or has nowhere to go).
    function drawbridgeVesselClear() {
      const v = drawbridge.vessel;
      if (!v || v.leg === 'anchored') return true;
      if (v.leg === 'approach') return false;
      return v.dir * v.across > drawbridgeGeometry().half + DRAWBRIDGE_VESSEL.length / 2 + 70;
    }
    /* ---- The operating sequence ------------------------------------------------------ */
    // Who is on the moving span: the tender waits for them.
    function drawbridgeSpanOccupants() {
      const g = drawbridgeGeometry(),
        found = { player: false, people: 0, vehicles: [] };
      for (const c of vehicles) {
        if (isBoat(c) || c.sunk || (isAircraft(c) && (c.altitude || 0) > 20)) continue;
        if (!drawbridgeOnSpan(c.x, c.y, 4)) continue;
        if (c === player.car) found.player = true;
        else found.vehicles.push(c);
      }
      if (!player.car && drawbridgeOnSpan(player.x, player.y, 2) && !player.swimming) found.player = true;
      forEachPedestrianNear(g.channel.x, g.channel.y, g.leaf + 30, (p) => {
        if (p.hp > 0 && drawbridgeOnSpan(p.x, p.y, 2)) found.people++;
      });
      return found;
    }
    function startDrawbridgeOpening(reason = 'schedule') {
      const d = drawbridge;
      if (d.phase !== 'idle') return false;
      drawbridgeArms();
      d.phase = 'warning';
      d.timer = 0;
      d.waited = 0;
      d.reason = reason;
      d.warnedPlayer = false;
      d.openings++;
      if (reason !== 'hold') drawbridgeVesselSetOff();
      return true;
    }
    // Swing the leaves toward `target` with an eased speed profile.
    function swingDrawbridge(target, deltaSeconds) {
      const d = drawbridge,
        remaining = target - d.angle,
        direction = Math.sign(remaining);
      // Speed that still stops in the remaining swing, capped at the top rate.
      const cap = Math.min(DRAWBRIDGE_RATE, Math.sqrt(2 * DRAWBRIDGE_SWING_ACCEL * Math.abs(remaining)) + 0.002),
        want = direction * cap;
      d.rate += clamp(want - d.rate, -DRAWBRIDGE_SWING_ACCEL * deltaSeconds * 1.5, DRAWBRIDGE_SWING_ACCEL * deltaSeconds * 1.5);
      let next = d.angle + d.rate * deltaSeconds;
      if ((target - next) * direction <= 0 || Math.abs(remaining) < 0.0008) {
        next = target;
        d.rate = 0;
      }
      d.angle = clamp(next, 0, DRAWBRIDGE_MAX_ANGLE);
      return d.angle === target;
    }
    function updateDrawbridge(deltaSeconds) {
      const d = drawbridge,
        g = drawbridgeGeometry();
      drawbridgeArms();
      // The timetable: an opening starts in the first couple of minutes after its slot.
      const minute = worldMinutes % 1440,
        day = Math.floor(worldMinutes / 1440);
      if (d.phase === 'idle')
        for (let i = 0; i < DRAWBRIDGE_OPENINGS.length; i++) {
          const key = day * 16 + i;
          if (minute >= DRAWBRIDGE_OPENINGS[i] && minute < DRAWBRIDGE_OPENINGS[i] + 3 && d.lastSlot !== key) {
            d.lastSlot = key;
            startDrawbridgeOpening('schedule');
          }
        }
      d.timer += deltaSeconds;
      let motor = 0;
      switch (d.phase) {
        case 'warning':
          if (d.timer > 6) {
            d.phase = 'gates';
            d.timer = 0;
          }
          break;
        case 'gates': {
          const entryDown = moveDrawbridgeArms(true, 1, deltaSeconds);
          // The exit arms follow once the entry arms are down and the lanes out are clear.
          const exitDown = d.timer > 3 ? moveDrawbridgeArms(false, 1, deltaSeconds) : false;
          if (entryDown && exitDown) {
            drawbridgeClank(g.channel.x, g.channel.y, 0.4);
            d.phase = d.held !== null ? 'unlock' : 'clearing';
            d.timer = 0;
          }
          break;
        }
        case 'clearing': {
          const on = drawbridgeSpanOccupants();
          if (!on.player && !on.people && !on.vehicles.length) {
            d.phase = 'unlock';
            d.timer = 0;
            drawbridgeClank(g.channel.x, g.channel.y, 1);
            break;
          }
          d.waited += deltaSeconds;
          if (on.player && d.waited > 6 && gameTime - d.hornAt > 12) {
            d.hornAt = gameTime;
            drawbridgeHorn(g.channel.x, g.channel.y, 150, [0.6, 0.6, 0.6]);
            tell('BRIDGE TENDER · Clear the span, the bridge is opening.', 3.5);
          }
          // A stalled or abandoned car nobody is watching is towed after a while.
          if (d.waited > 20 && !on.player && !on.people)
            for (const c of on.vehicles)
              if (distanceBetween(c, player) > 900 && Math.abs(c.speed || 0) < 3 && c !== mission?.car && !c.taxiHire) {
                const k = vehicles.indexOf(c);
                if (k >= 0) vehicles.splice(k, 1);
              }
          break;
        }
        case 'unlock':
          if (d.timer > 2) {
            d.phase = 'raising';
            d.timer = 0;
            d.target = d.held ?? DRAWBRIDGE_MAX_ANGLE;
          }
          break;
        case 'raising':
          motor = Math.abs(d.rate) / DRAWBRIDGE_RATE + 0.25;
          if (swingDrawbridge(d.held ?? DRAWBRIDGE_MAX_ANGLE, deltaSeconds)) {
            d.phase = 'open';
            d.timer = 0;
            drawbridgeClank(g.channel.x, g.channel.y, 0.6);
            if (d.held === null) drawbridgeHorn(g.channel.x, g.channel.y, 150);
          }
          break;
        case 'open':
          if (d.held !== null) {
            if (Math.abs(d.angle - d.held) > 0.001) swingDrawbridge(d.held, deltaSeconds);
            break;
          }
          if ((d.timer > 8 && drawbridgeVesselClear()) || d.timer > 45) {
            d.phase = 'lowering';
            d.timer = 0;
          }
          break;
        case 'lowering':
          motor = Math.abs(d.rate) / DRAWBRIDGE_RATE + 0.25;
          if (swingDrawbridge(0, deltaSeconds)) {
            d.phase = 'seating';
            d.timer = 0;
            drawbridgeClank(g.channel.x, g.channel.y, 1.2);
          }
          break;
        case 'seating':
          if (d.timer > 2.2) {
            d.phase = 'lifting';
            d.timer = 0;
            drawbridgeClank(g.channel.x, g.channel.y, 0.8);
          }
          break;
        case 'lifting': {
          const exitUp = moveDrawbridgeArms(false, 0, deltaSeconds),
            entryUp = d.timer > 1.5 ? moveDrawbridgeArms(true, 0, deltaSeconds) : false;
          if (exitUp && entryUp) {
            d.phase = 'idle';
            d.timer = 0;
          }
          break;
        }
      }
      updateDrawbridgeMotor(motor * (d.phase === 'raising' || d.phase === 'lowering' ? 1 : 0));
      // Bells ring from the first warning until the arms are down, and again as they rise.
      const ringing = d.phase === 'warning' || d.phase === 'gates' || d.phase === 'lifting';
      if (ringing) {
        d.bellClock -= deltaSeconds;
        if (d.bellClock <= 0) {
          d.bellClock = 0.5;
          const gate = bridgePoint(g.bridge, g.gates[player.x < g.channel.x ? 0 : 1]);
          drawbridgeBell(gate.x, gate.y);
        }
      }
      // A word for a player driving toward a bridge that is going up.
      if (d.phase !== 'idle' && !d.warnedPlayer && player.car && !isBoat(player.car) && distanceBetween(player, g.channel) < 900) {
        d.warnedPlayer = true;
        tell('DRAWBRIDGE · The Palm Sound Causeway is opening. Traffic is held.', 3.5);
      }
      // Snapped arms are replaced once the bridge is down and nobody is watching.
      if (d.phase === 'idle' && distanceBetween(player, g.channel) > 800)
        for (const arm of d.arms) if (arm.broken && gameTime - arm.brokenAt > 20) arm.broken = false;
      updateDrawbridgeRamming();
      updateDrawbridgeVessel(deltaSeconds);
    }
    /* ---- Map ----------------------------------------------------------------------- */
    /* The span on the minimap and the city map: the gap opens in the deck and an
       icon at the channel shows the state (white down, amber closing, red up). */
    function drawDrawbridgeMap(drawingContext, scale, big) {
      const d = drawbridge,
        g = drawbridgeGeometry(),
        c = g.channel,
        closed = d.phase !== 'idle';
      drawingContext.save();
      drawingContext.translate(c.x, c.y);
      drawingContext.rotate(g.f.a);
      // The span itself (the baked layers leave it out): the deck while the leaves
      // are down, then each leaf foreshortened toward its hinge with water between.
      const tip = d.angle > 0.004 ? Math.max(0, drawbridgeTipReach()) : g.leaf;
      for (const leaf of [-1, 1]) {
        const x0 = leaf < 0 ? -g.leaf : g.leaf - tip;
        drawingContext.fillStyle = d.angle > 0.004 ? '#6f7a80' : '#444f57';
        drawingContext.fillRect(x0, -g.half, tip, g.half * 2);
        drawingContext.fillStyle = '#b6b8af';
        drawingContext.fillRect(x0, -g.half - 1, tip, 5);
        drawingContext.fillRect(x0, g.half - 4, tip, 5);
        if (d.angle <= 0.004) {
          drawingContext.fillStyle = '#e3c98b';
          for (let x = x0; x < x0 + tip - 15; x += 31) drawingContext.fillRect(x, -1, 15, 2);
        }
      }
      if (closed) {
        drawingContext.fillStyle = '#ff5a48';
        for (const u of g.gates) drawingContext.fillRect(u - g.m - 5, -g.road, 10, g.road * 2);
      }
      drawingContext.restore();
      // The icon: a disc with two leaves, raised or down.
      const r = Math.max(big ? 70 : 60, (big ? 11 : 9) / scale),
        colour = d.phase === 'idle' ? '#e9e4d2' : d.angle > 0.004 ? '#ff5a48' : '#ffb03a';
      drawingContext.save();
      drawingContext.translate(c.x, c.y - g.half - r * 1.25);
      drawingContext.fillStyle = '#102d3ddd';
      drawingContext.beginPath();
      drawingContext.arc(0, 0, r, 0, TAU);
      drawingContext.fill();
      drawingContext.strokeStyle = colour;
      drawingContext.lineWidth = r * 0.16;
      drawingContext.stroke();
      const lift = Math.max(d.angle, d.phase === 'idle' ? 0 : 0.15);
      drawingContext.lineWidth = r * 0.2;
      drawingContext.lineCap = 'round';
      drawingContext.beginPath();
      for (const leaf of [-1, 1]) {
        const hx = leaf * r * 0.62,
          hy = r * 0.3;
        drawingContext.moveTo(hx, hy);
        drawingContext.lineTo(hx - leaf * Math.cos(lift) * r * 0.55, hy - Math.sin(lift) * r * 0.55);
      }
      drawingContext.stroke();
      drawingContext.restore();
      if (big && d.phase !== 'idle') {
        drawingContext.save();
        drawingContext.font = 'bold ' + Math.round(11 / scale) + 'px Arial';
        drawingContext.textAlign = 'center';
        drawingContext.fillStyle = colour;
        drawingContext.fillText(d.angle > 0.004 ? 'BRIDGE UP' : 'BRIDGE CLOSING', c.x, c.y - g.half - r * 2.6);
        drawingContext.restore();
      }
      const v = d.vessel;
      if (v && big) {
        drawingContext.save();
        drawingContext.translate(v.x, v.y);
        drawingContext.rotate(v.a);
        drawingContext.fillStyle = '#f2efe4';
        drawingContext.beginPath();
        drawingContext.moveTo(DRAWBRIDGE_VESSEL.length / 2, 0);
        drawingContext.lineTo(-DRAWBRIDGE_VESSEL.length / 2, -DRAWBRIDGE_VESSEL.beam / 2);
        drawingContext.lineTo(-DRAWBRIDGE_VESSEL.length / 2, DRAWBRIDGE_VESSEL.beam / 2);
        drawingContext.fill();
        drawingContext.restore();
      }
    }
    /* ---- Developer console ------------------------------------------------------------ */
    // `open`: start an opening now; `close`: bring the leaves down and lift the arms;
    // `hold`: arms down and the leaves held at `degrees` until `close`; `status`.
    function drawbridgeCommand(action = 'status', degrees) {
      const d = drawbridge;
      drawbridgeArms();
      if (action === 'open') {
        d.held = null;
        if (d.phase === 'idle') startDrawbridgeOpening('console');
        else if (d.phase === 'lowering' || d.phase === 'seating') {
          d.phase = 'raising';
          d.timer = 0;
        }
      } else if (action === 'hold') {
        d.held = clamp(((Number.isFinite(degrees) ? degrees : 15) * Math.PI) / 180, 0, DRAWBRIDGE_MAX_ANGLE);
        for (const arm of d.arms) arm.pos = arm.broken ? arm.pos : 1;
        d.phase = 'raising';
        d.timer = 0;
      } else if (action === 'close') {
        d.held = null;
        if (d.angle > 0.0005) {
          d.phase = 'lowering';
          d.timer = 0;
        } else if (d.phase !== 'idle') {
          d.phase = 'lifting';
          d.timer = 0;
        }
      } else if (action === 'snap') {
        // Put the leaves at `degrees` at once (screenshots); the phase is kept.
        d.angle = clamp(((degrees || 0) * Math.PI) / 180, 0, DRAWBRIDGE_MAX_ANGLE);
        d.rate = 0;
      }
      return drawbridgeReport();
    }
    function drawbridgeReport() {
      const d = drawbridge,
        g = drawbridgeGeometry(),
        v = d.vessel,
        minute = worldMinutes % 1440,
        next = DRAWBRIDGE_OPENINGS.find((t) => t > minute) ?? DRAWBRIDGE_OPENINGS[0] + 1440;
      return {
        bridge: g.bridge.id,
        phase: d.phase,
        seconds: +d.timer.toFixed(1),
        angle: +((d.angle * 180) / Math.PI).toFixed(2),
        rate: +((d.rate * 180) / Math.PI).toFixed(2),
        held: d.held === null ? null : +((d.held * 180) / Math.PI).toFixed(1),
        gap: d.angle > 0.004 ? Math.round(g.hinge[1] - g.hinge[0] - drawbridgeTipReach() * 2) : 0,
        tipHeight: Math.round(drawbridgeSurface(g.hinge[0] + drawbridgeTipReach() - 0.01)?.h || 0),
        trafficHeld: drawbridgeStopsTraffic(),
        spanClosed: drawbridgeSpanClosed(),
        arms: d.arms.map((a) => ({ id: a.id, pos: +a.pos.toFixed(2), broken: a.broken })),
        schedule: DRAWBRIDGE_OPENINGS.map((t) => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0')),
        nextOpeningIn: Math.round(next - minute),
        routeDelay: Math.round(drawbridgeRouteDelay()),
        occupants: (({ player, people, vehicles: list }) => ({ player, people, vehicles: list.length }))(drawbridgeSpanOccupants()),
        queued: vehicles.filter((c) => c.ai && drawbridgeNear(c.x, c.y) && Math.abs(c.speed || 0) < 3 && Math.abs(drawbridgeLocal(c.x, c.y).v) < g.half).length,
        vessel: v ? { leg: v.leg, x: Math.round(v.x), y: Math.round(v.y), across: Math.round(v.across), speed: +v.speed.toFixed(1) } : null,
        openings: d.openings,
        jumps: d.jumps.map((j) => ({ speed: j.speed, angle: j.angle, crossed: j.crossed, landed: j.landed ?? null, splash: !!j.splash, distance: j.distance ?? null, impact: j.impact ?? null })),
        splashes: d.splashes,
        player: player.car ? { lift: +(player.car.deckLift || 0).toFixed(1), air: !!player.car.deckAir, leaf: player.car.deckLeaf || 0, sinking: +(player.car.sinkFor || 0).toFixed(1) } : null,
        centre: { x: Math.round(g.channel.x), y: Math.round(g.channel.y) },
        trunnions: g.hinge.map((u) => Math.round(bridgePoint(g.bridge, u).x)),
        gates: g.gates.map((u) => Math.round(bridgePoint(g.bridge, u).x)),
        stopLines: g.stops.map((u) => Math.round(bridgePoint(g.bridge, u).x)),
      };
    }
    /* Test traffic: `count` cars in the lanes into the bridge on each approach,
       driving toward it (traffic streams in round the player, and seldom out on
       a bridge). Returns how many were placed. */
    function drawbridgeSpawnTraffic(count = 4) {
      const g = drawbridgeGeometry(),
        types = ['coupe', 'suv', 'cruiser', 'pickup', 'luxury', 'truck'];
      let placed = 0;
      for (const approach of [-1, 1])
        for (let k = 0; k < count; k++) {
          const u = g.stops[approach < 0 ? 0 : 1] + approach * (70 + k * 75),
            p = bridgePoint(g.bridge, u, -approach * 25),
            a = g.f.a + (approach < 0 ? 0 : Math.PI),
            type = types[(k + (approach > 0 ? 3 : 0)) % types.length];
          if (!canSpawnCar(type, p.x, p.y, a)) continue;
          const c = makeCar(type, p.x, p.y, a, true);
          c.speed = 55;
          placed++;
        }
      return placed;
    }
    // Viewpoints for tests: the approaches, the channel, the tender's house.
    function drawbridgeViewpoint(spot = 'channel') {
      const g = drawbridgeGeometry(),
        views = {
          channel: [g.m, 0],
          west: [g.stops[0] - 60, g.road / 2],
          east: [g.stops[1] + 60, -g.road / 2],
          south: [g.m, g.half + 200],
          north: [g.m, -g.half - 200],
          tower: [g.b.piers[1], g.half + 40],
        },
        [u, v] = views[spot] || views.channel;
      return bridgePoint(g.bridge, u, v);
    }
    // END SUBSYSTEM: src/drawbridge.js
