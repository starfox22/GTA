    // Drawbridges on the map, the console and god panel commands (open, close, hold), reports, the day's open share and the islands' access bridges.
    /* ---- Map ----------------------------------------------------------------------- */
    /* Each span on the minimap and the city map: the gap opens in the deck and an
       icon beside the channel shows the state (white down, amber closing, red up). */
    function drawDrawbridgeMap(drawingContext, scale, big) {
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) drawOneDrawbridgeMap(list[i], drawingContext, scale, big);
    }
    function drawOneDrawbridgeMap(d, drawingContext, scale, big) {
      const g = drawbridgeGeometry(d),
        c = g.channel,
        closed = d.phase !== 'idle';
      drawingContext.save();
      drawingContext.translate(c.x, c.y);
      drawingContext.rotate(g.f.a);
      // The span itself (the baked layers leave it out): the deck while the leaves
      // are down, then each leaf foreshortened toward its hinge with water between.
      const tip = d.angle > 0.004 ? Math.max(0, drawbridgeTipReach(d)) : g.leaf;
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
      // The icon: a disc with two leaves, raised or down, off the deck's left side.
      const r = Math.max(big ? 70 : 60, (big ? 11 : 9) / scale),
        colour = d.phase === 'idle' ? '#e9e4d2' : d.angle > 0.004 ? '#ff5a48' : '#ffb03a',
        at = bridgePoint(g.bridge, g.m, -g.half - r * 1.25);
      drawingContext.save();
      drawingContext.translate(at.x, at.y);
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
        const label = bridgePoint(g.bridge, g.m, -g.half - r * 2.6);
        drawingContext.save();
        drawingContext.font = 'bold ' + Math.round(11 / scale) + 'px Arial';
        drawingContext.textAlign = 'center';
        drawingContext.fillStyle = colour;
        drawingContext.fillText(d.angle > 0.004 ? 'BRIDGE UP' : 'BRIDGE CLOSING', label.x, label.y);
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
    /* ---- Commands (console and the god panel) ------------------------------------------ */
    /* Raise a drawbridge now through its own sequence (warning, gates, clearing the
       span, unlock, the swing): never a jump of the leaves. A span already coming
       down goes back up. */
    function drawbridgeOpenNow(d, reason = 'console') {
      d.held = null;
      if (d.phase === 'idle') startDrawbridgeOpening(d, reason);
      else if (d.phase === 'lowering' || d.phase === 'seating') {
        d.phase = 'raising';
        d.timer = 0;
      }
      noteDrawbridgeStates();
    }
    // Bring it down: the leaves lower and seat, the locks drive home, the arms lift.
    function drawbridgeCloseNow(d) {
      d.held = null;
      if (d.angle > 0.0005) {
        d.phase = 'lowering';
        d.timer = 0;
      } else if (d.locks > 0 && d.phase !== 'idle') {
        d.phase = 'seating';
        d.timer = 0;
      } else if (d.phase !== 'idle') {
        d.phase = 'lifting';
        d.timer = 0;
      }
      noteDrawbridgeStates();
    }
    // `open`: start an opening now; `close`: bring the leaves down and lift the arms;
    // `hold`: arms down and the leaves held at `degrees` until `close`; `snap`: the
    // leaves at `degrees` at once (screenshots); `status`. `id` picks the bridge
    // ('keys-harbor', the default, or any drawbridge's id or index; 'all' for every one).
    function drawbridgeCommand(action = 'status', degrees, id) {
      if (id === 'all') return drawbridgeList().map((d) => drawbridgeAct(d, action, degrees));
      const d = drawbridgeById(id);
      if (!d) return { error: 'no drawbridge ' + id, ids: drawbridgeList().map((o) => o.id) };
      return drawbridgeAct(d, action, degrees);
    }
    function drawbridgeAct(d, action, degrees) {
      drawbridgeArms(d);
      if (action === 'open') drawbridgeOpenNow(d);
      else if (action === 'hold') {
        d.held = clamp(((Number.isFinite(degrees) ? degrees : 15) * Math.PI) / 180, 0, DRAWBRIDGE_MAX_ANGLE);
        // Arms straight down, then the usual wait for an empty span (or straight on
        // to the new angle if the leaves are already up).
        for (const arm of d.arms) arm.pos = arm.broken ? arm.pos : 1;
        d.phase = d.angle > 0.004 ? 'raising' : 'clearing';
        d.timer = 0;
      } else if (action === 'close') drawbridgeCloseNow(d);
      else if (action === 'snap') {
        d.angle = clamp(((degrees || 0) * Math.PI) / 180, 0, DRAWBRIDGE_MAX_ANGLE);
        d.rate = 0;
        d.locks = d.angle > 0 ? 1 : d.locks;
      }
      noteDrawbridgeStates();
      return drawbridgeReport(d.id);
    }
    function drawbridgeClock(t) {
      return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.round(t % 60)).padStart(2, '0');
    }
    function drawbridgeReport(id) {
      const d = typeof id === 'object' && id ? id : drawbridgeById(id),
        g = drawbridgeGeometry(d),
        v = d.vessel,
        spec = drawbridgeVesselSpec(d),
        slots = drawbridgeOpenings(d),
        minute = worldMinutes % 1440,
        next = slots.find((t) => t > minute) ?? slots[0] + 1440;
      drawbridgeArms(d);
      return {
        bridge: g.bridge.id,
        name: g.bridge.name,
        link: g.bridge.link,
        phase: d.phase,
        seconds: +d.timer.toFixed(1),
        angle: +((d.angle * 180) / Math.PI).toFixed(2),
        rate: +((d.rate * 180) / Math.PI).toFixed(2),
        held: d.held === null ? null : +((d.held * 180) / Math.PI).toFixed(1),
        open: drawbridgeSpanClosed(d),
        gap: d.angle > 0.004 ? Math.round(g.hinge[1] - g.hinge[0] - drawbridgeTipReach(d) * 2) : 0,
        tipHeight: Math.round(drawbridgeSurface(d, g.hinge[0] + drawbridgeTipReach(d) - 0.01)?.h || 0),
        leafM: +worldMeters(g.leaf).toFixed(1),
        // The clear width between the leaves at the ship's mastheads (DRAWBRIDGE_VESSEL.masts over the water).
        mastheadClearM: +worldMeters(drawbridgeClearWidth(d, spec.masts * UNITS_PER_METRE)).toFixed(1),
        locks: +d.locks.toFixed(2),
        cameraZoom: +drawbridgeCameraZoomAt(d).toFixed(2),
        spectators: d.audience ? d.audience.members.length : 0,
        spectatorsSpawned: d.audience ? d.audience.spawned || 0 : 0,
        spectatorsAtSpots: d.audience ? d.audience.members.filter((p) => p.sceneSpot && distanceBetween(p, p.sceneSpot) < 6).length : 0,
        trafficHeld: drawbridgeStopsTraffic(d),
        spanClosed: drawbridgeSpanClosed(d),
        arms: d.arms.map((a) => ({ id: a.id, pos: +a.pos.toFixed(2), broken: a.broken })),
        schedule: slots.map(drawbridgeClock),
        nextOpeningIn: Math.round(next - minute),
        routeDelay: Math.round(drawbridgeRouteDelay(d)),
        occupants: (({ player, people, vehicles: list }) => ({ player, people, vehicles: list.length }))(drawbridgeSpanOccupants(d)),
        queued: vehicles.filter((c) => c.ai && drawbridgeNear(d, c.x, c.y) && Math.abs(c.speed || 0) < 3 && Math.abs(drawbridgeLocal(d, c.x, c.y).v) < g.half).length,
        // Every road vehicle on the causeway: where, how fast, what traffic AI wants.
        traffic: vehicles
          .filter((c) => !isBoat(c) && !isAircraft(c) && drawbridgeNear(d, c.x, c.y) && Math.abs(drawbridgeLocal(d, c.x, c.y).v) < g.half)
          .map((c) => ({ id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y), u: Math.round(drawbridgeLocal(d, c.x, c.y).u), speed: Math.round(c.speed || 0), ai: !!c.ai, cop: !!c.cop, desired: c.aiControl ? Math.round(c.aiControl.desired) : null, hp: Math.round(c.hp), crashed: !!c.crashStop })),
        vessel: v ? { name: v.name, leg: v.leg, x: Math.round(v.x), y: Math.round(v.y), across: Math.round(v.across), speed: +v.speed.toFixed(1), sails: +v.sails.toFixed(2), saluted: !!v.saluted } : null,
        openings: d.openings,
        openMinutes: Math.round(d.openSeconds),
        jumps: d.jumps.map((j) => ({ speed: j.speed, angle: j.angle, crossed: j.crossed, landed: j.landed ?? null, splash: !!j.splash, struck: !!j.struck, distance: j.distance ?? null, impact: j.impact ?? null })),
        splashes: d.splashes,
        player: player.car ? { lift: +(player.car.deckLift || 0).toFixed(1), air: !!player.car.deckAir, leaf: player.car.deckLeaf || 0, bridge: player.car.deckBridge?.id || null, sinking: +(player.car.sinkFor || 0).toFixed(1) } : null,
        centre: { x: Math.round(g.channel.x), y: Math.round(g.channel.y) },
        // Along the deck from its middle (u), and as map points.
        hinges: g.hinge.map((u) => Math.round(u)),
        trunnions: g.hinge.map((u) => Math.round(bridgePoint(g.bridge, u).x)),
        gates: g.gates.map((u) => Math.round(bridgePoint(g.bridge, u).x)),
        stopLines: g.stops.map((u) => Math.round(bridgePoint(g.bridge, u).x)),
        trunnionPoints: g.hinge.map((u) => roundPoint(bridgePoint(g.bridge, u))),
        stopPoints: g.stops.map((u) => roundPoint(bridgePoint(g.bridge, u))),
      };
    }
    function roundPoint(p) {
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }
    /* ---- The day's open share ------------------------------------------------------------ */
    /* One opening as the timetable plans it (nobody on the span, the ship on time),
       stepped with the real swing and the ship's own speeds: when after its slot the
       span stops being seated (`lead`, minutes) and for how long (`closed`). */
    function drawbridgeNominal(d) {
      if (d.nominal) return d.nominal;
      const dt = 0.05,
        spec = drawbridgeVesselSpec(d),
        g = drawbridgeGeometry(d),
        leaves = { angle: 0, rate: 0 },
        ship = { past: -spec.anchor, speed: 0, leg: 'approach' };
      let t = 0,
        phase = 'warning',
        timer = 0,
        entry = 0,
        exit = 0,
        from = null,
        to = null;
      const arms = (pos, target) => (target > pos ? Math.min(target, pos + dt / DRAWBRIDGE_ARM_SECONDS) : Math.max(target, pos - dt / DRAWBRIDGE_ARM_SECONDS)),
        next = (name) => {
          phase = name;
          timer = 0;
        };
      while (phase !== 'idle' && t < 1200) {
        t += dt;
        timer += dt;
        switch (phase) {
          case 'warning':
            if (timer > 8) next('gates');
            break;
          case 'gates':
            entry = arms(entry, 1);
            if (timer > 3) exit = arms(exit, 1);
            if (entry === 1 && exit === 1) next('unlock');
            break;
          case 'unlock':
            if (timer > DRAWBRIDGE_LOCK_SECONDS + 1) next('raising');
            break;
          case 'raising':
            if (swingDrawbridge(leaves, DRAWBRIDGE_MAX_ANGLE, dt)) next('open');
            break;
          case 'open':
            if ((timer > 8 && ship.leg === 'transit' && ship.past > g.half + spec.length / 2 + 70) || timer > 100) next('lowering');
            break;
          case 'lowering':
            if (swingDrawbridge(leaves, 0, dt)) next('seating');
            break;
          case 'seating':
            if (timer > DRAWBRIDGE_LOCK_SECONDS + 1.6) next('lifting');
            break;
          case 'lifting':
            exit = arms(exit, 0);
            if (timer > 1.5) entry = arms(entry, 0);
            if (entry === 0 && exit === 0) next('idle');
            break;
        }
        // The ship: in to the hold point, through once the leaves are up.
        let want = 0;
        if (ship.leg === 'approach') {
          const toHold = -spec.hold - ship.past;
          if (phase === 'open') ship.leg = 'transit';
          else want = toHold > 4 ? Math.min(spec.approach, Math.sqrt(2 * 6 * toHold)) : 0;
        }
        if (ship.leg === 'transit') {
          const remaining = spec.anchor - ship.past;
          want = remaining > 4 ? Math.min(spec.cruise, Math.sqrt(2 * 5 * remaining)) : 0;
        }
        ship.speed += clamp(want - ship.speed, -6 * dt, 3 * dt);
        ship.past += ship.speed * dt;
        const closed = leaves.angle > 0.0005 || ['unlock', 'raising', 'open', 'lowering', 'seating'].includes(phase);
        if (closed && from === null) from = t;
        if (closed) to = t;
      }
      return (d.nominal = { lead: +from.toFixed(1), closed: +(to - from).toFixed(1), held: +t.toFixed(1) });
    }
    /* The share of a day (minutes, one game second each) with at least one span
       up or moving, from every drawbridge's timetable and its nominal opening. The
       timetables are staggered to keep it at half or more (tools/tests/drawbridge-share.mjs). */
    function drawbridgeOpenShare() {
      const cells = new Uint8Array(1440 * 4),
        each = {};
      for (const d of drawbridgeList()) {
        const n = drawbridgeNominal(d);
        let own = 0;
        for (const slot of drawbridgeOpenings(d))
          for (let k = Math.ceil((slot + n.lead) * 4); k < (slot + n.lead + n.closed) * 4; k++) {
            const cell = k % cells.length;
            if (!(cells[cell] & (1 << d.index))) own++;
            cells[cell] |= 1 << d.index;
          }
        each[d.id] = +(own / cells.length).toFixed(3);
      }
      let any = 0,
        longestShut = 0,
        run = 0;
      for (let k = 0; k < cells.length * 2; k++) {
        const open = cells[k % cells.length] !== 0;
        if (k < cells.length && open) any++;
        run = open ? 0 : run + 1;
        longestShut = Math.max(longestShut, Math.min(run, cells.length));
      }
      return { share: +(any / cells.length).toFixed(3), each, longestAllShutMinutes: Math.round(longestShut / 4) };
    }
    /* ---- Islands and their access bridges ---------------------------------------------- */
    /* Every land mass (regions that touch count as one: the airport and its piers
       are Northbank) and the road bridges that land on it, each end found just
       past the deck's longest stretch over water. Rail viaducts are not access
       for traffic and are not counted. An island with more than one access bridge
       has at least one drawbridge among them (tools/tests/drawbridge-islands.mjs). */
    function bridgeIslands() {
      const regions = LAND_REGIONS.filter((r) => !r.lake),
        group = regions.map((_, i) => i),
        find = (i) => (group[i] === i ? i : (group[i] = find(group[i]))),
        inside = (p, r) => pointInPolygon(p[0], p[1], r.polygon);
      for (let i = 0; i < regions.length; i++)
        for (let j = i + 1; j < regions.length; j++)
          if (regions[i].polygon.some((p) => inside(p, regions[j])) || regions[j].polygon.some((p) => inside(p, regions[i]))) group[find(i)] = find(j);
      const regionOf = (x, y) => regions.findIndex((r) => inside([x, y], r)),
        islands = new Map();
      for (const bridge of BRIDGES) {
        const s = bridgeStructure(bridge);
        for (const along of [s.water[0] - 40, s.water[1] + 40]) {
          const p = bridgePoint(bridge, along),
            k = regionOf(p.x, p.y);
          if (k < 0) continue;
          const root = find(k);
          if (!islands.has(root)) islands.set(root, { regions: [], bridges: [], drawbridges: [] });
          const island = islands.get(root);
          if (!island.bridges.includes(bridge.id)) island.bridges.push(bridge.id);
          if (bridge.movable && !island.drawbridges.includes(bridge.id)) island.drawbridges.push(bridge.id);
        }
      }
      for (const [root, island] of islands) {
        island.regions = regions.filter((_, i) => find(i) === root).map((r) => r.id);
        island.name = regions.find((_, i) => find(i) === root && regions[i].name)?.name || island.regions[0];
      }
      return [...islands.values()]
        .map((island) => ({ name: island.name, regions: island.regions, bridges: island.bridges, drawbridges: island.drawbridges, ok: island.bridges.length < 2 || island.drawbridges.length > 0 }))
        .sort((p, q) => q.bridges.length - p.bridges.length);
    }
    // Every drawbridge at a glance, the day's open share and the islands (console drawbridges()).
    function drawbridgesReport() {
      const minute = worldMinutes % 1440;
      return {
        clock: drawbridgeClock(minute),
        drawbridges: drawbridgeList().map((d) => {
          const slots = drawbridgeOpenings(d),
            next = slots.find((t) => t > minute) ?? slots[0] + 1440,
            n = drawbridgeNominal(d);
          return {
            id: d.id,
            name: d.bridge.name,
            link: d.bridge.link,
            style: d.bridge.style,
            phase: d.phase,
            angle: +((d.angle * 180) / Math.PI).toFixed(1),
            open: drawbridgeSpanClosed(d),
            trafficHeld: drawbridgeStopsTraffic(d),
            schedule: slots.map(drawbridgeClock),
            nextOpeningIn: Math.round(next - minute),
            nominal: n,
            leafM: +worldMeters(drawbridgeGeometry(d).leaf).toFixed(1),
            vessel: d.vessel ? { name: d.vessel.name, leg: d.vessel.leg } : null,
            openings: d.openings,
          };
        }),
        anyOpen: drawbridgeList().some(drawbridgeSpanClosed),
        day: drawbridgeOpenShare(),
        measured: { seconds: Math.round(drawbridgeShare.seconds), share: drawbridgeShare.seconds ? +(drawbridgeShare.open / drawbridgeShare.seconds).toFixed(3) : null },
        islands: bridgeIslands(),
      };
    }
    /* Test traffic: `count` cars in the lanes into the bridge on each approach,
       driving toward it (traffic streams in round the player, and seldom out on
       a bridge). Returns how many were placed. */
    function drawbridgeSpawnTraffic(count = 4, id) {
      const d = drawbridgeById(id),
        g = drawbridgeGeometry(d),
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
          // Off the city grid (every drawbridge but Palm Sound's) they follow the deck
          // to the far approach as county traffic does (countyRouteControl).
          if (d.index > 0) {
            c.countyRoute = [bridgePoint(g.bridge, g.stops[approach < 0 ? 1 : 0] - approach * 160, -approach * 25)];
            c.countyIndex = 0;
          }
          placed++;
        }
      return placed;
    }
    // Viewpoints for tests: the approaches, the channel, the tender's house.
    function drawbridgeViewpoint(spot = 'channel', id) {
      const d = drawbridgeById(id),
        g = drawbridgeGeometry(d),
        views = {
          channel: [g.m, 0],
          west: [g.stops[0] - 60, g.road / 2],
          east: [g.stops[1] + 60, -g.road / 2],
          south: [g.m, g.half + 200],
          north: [g.m, -g.half - 200],
          tower: [g.b.piers[1], g.half + 40],
          // The whole bridge from off its right side; the a-end pier's right pit.
          overview: [g.m, g.half + 520],
          pit: [g.hinge[0] - 40, g.half + 40],
        },
        [u, v] = views[spot] || views.channel;
      return bridgePoint(g.bridge, u, v);
    }
