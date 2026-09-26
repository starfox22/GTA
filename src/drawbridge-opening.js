    /* People still on the span while the tender waits to open it walk off by the
       nearer end (a walker keeps to its axis, `dir`). */
    function drawbridgeUsherPeople() {
      const g = drawbridgeGeometry();
      forEachPedestrianNear(g.channel.x, g.channel.y, g.leaf + 30, (p) => {
        if (p.hp <= 0 || p.react || p.scene || p.state !== 'walk' || !drawbridgeOnSpan(p.x, p.y, 2)) return;
        const out = drawbridgeLocal(p.x, p.y).u < g.m ? g.f.a + Math.PI : g.f.a;
        p.dir = snapAxis(out);
      });
    }
    /* The event camera: for a player close to an opening (on foot, or driving
       slowly), the view eases back to about three quarters of the zoom so both
       leaves and the ship fit the screen. A factor on the zoom the player chose,
       eased like the speed zoom (world-view.js), never a take-over; the Event
       camera setting (settings.js) turns it off. */
    function drawbridgeCameraZoom() {
      const d = drawbridge;
      if (d.phase === 'idle' || d.reason === 'hold' || !eventCameraOn()) return 1;
      const g = drawbridgeGeometry(),
        c = player.car;
      if (c && (isAircraft(c) || Math.hypot(c.vx || 0, c.vy || 0) > 45 * KMH)) return 1;
      const show = ['unlock', 'raising', 'open', 'lowering'].includes(d.phase) || (d.phase === 'seating' && d.timer < 1),
        near = 1 - clamp((distanceBetween(player, g.channel) - 700) / 600, 0, 1);
      return show ? 1 - 0.26 * near : 1;
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
      // The ship asks for the bridge; the tender answers with one long blast.
      d.hornDue = reason !== 'hold' ? 2.6 : 0;
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
          if (d.hornDue && d.timer > d.hornDue) {
            d.hornDue = 0;
            drawbridgeHorn(g.channel.x, g.channel.y, 150, [3]);
          }
          if (d.timer > 8) {
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
            d.phase = 'clearing';
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
          if (on.people) drawbridgeUsherPeople();
          if (on.player && d.waited > 6 && gameTime - d.hornAt > 12) {
            d.hornAt = gameTime;
            drawbridgeHorn(g.channel.x, g.channel.y, 150, [0.6, 0.6, 0.6]);
            tell('BRIDGE TENDER · Clear the span, the bridge is opening.', 3.5);
          }
          // A stalled or abandoned car nobody is watching is towed after a while
          // (the 88 m span is long: after a minute even one in sight of the player).
          if (d.waited > 20 && !on.player && !on.people)
            for (const c of on.vehicles)
              if ((distanceBetween(c, player) > 900 || !crowdInView(c.x, c.y, 40) || d.waited > 60) && Math.abs(c.speed || 0) < 3 && c !== mission?.car && !c.taxiHire) {
                const k = vehicles.indexOf(c);
                if (k >= 0) vehicles.splice(k, 1);
              }
          break;
        }
        case 'unlock':
          // The lock bars draw back out of the far leaf's sockets; a clank as each stroke ends.
          if (d.locks < 1) {
            d.locks = Math.min(1, d.locks + deltaSeconds / DRAWBRIDGE_LOCK_SECONDS);
            if (d.locks >= 1) drawbridgeClank(g.channel.x, g.channel.y, 0.9);
          }
          if (d.timer > DRAWBRIDGE_LOCK_SECONDS + 1) {
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
          // The ship needs about 40 s from the hold point to clear the span; the
          // tender gives her well over twice that before lowering regardless.
          if ((d.timer > 8 && drawbridgeVesselClear()) || d.timer > 100) {
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
          // The leaves settle on their live-load shoes, then the lock bars drive home.
          if (d.timer > 0.8 && d.locks > 0) {
            d.locks = Math.max(0, d.locks - deltaSeconds / DRAWBRIDGE_LOCK_SECONDS);
            if (d.locks <= 0) drawbridgeClank(g.channel.x, g.channel.y, 1.1);
          }
          if (d.timer > DRAWBRIDGE_LOCK_SECONDS + 1.6) {
            d.phase = 'lifting';
            d.timer = 0;
            d.locks = 0;
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
      // The rack's teeth rolling through the pinions: a soft knock each tooth.
      if (Math.abs(d.rate) > 0.002) {
        d.rackClock += Math.abs(d.rate) * deltaSeconds;
        if (d.rackClock > 0.034) {
          d.rackClock = 0;
          for (const u of g.hinge) {
            const p = bridgePoint(g.bridge, u, g.half + 30);
            drawbridgeClank(p.x, p.y, 0.12);
          }
        }
      }
      // Water off the leaves as they rise from the wet: drips and a patter from the
      // tips and girders into the Sound, most in the first twenty degrees.
      if (d.phase === 'raising' && d.rate > 0.001) {
        const wet = clamp(1 - d.angle / 0.5, 0.15, 1);
        if (Math.random() < deltaSeconds * 7 * wet) {
          const reach = Math.max(0, drawbridgeTipReach()) * Math.random(),
            u = Math.random() < 0.5 ? g.hinge[0] + reach : g.hinge[1] - reach,
            p = bridgePoint(g.bridge, u, (Math.random() - 0.5) * g.bridge.width);
          drawbridgeDrip(p.x, p.y, wet);
        }
      }
      drawbridgeSpectators();
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
        // Arms straight down, then the usual wait for an empty span (or straight on
        // to the new angle if the leaves are already up).
        for (const arm of d.arms) arm.pos = arm.broken ? arm.pos : 1;
        d.phase = d.angle > 0.004 ? 'raising' : 'clearing';
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
        d.locks = d.angle > 0 ? 1 : d.locks;
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
        leafM: +worldMeters(g.leaf).toFixed(1),
        // The clear width between the leaves at the ship's mastheads (DRAWBRIDGE_VESSEL.masts over the water).
        mastheadClearM: +worldMeters(drawbridgeClearWidth(DRAWBRIDGE_VESSEL.masts * UNITS_PER_METRE)).toFixed(1),
        locks: +d.locks.toFixed(2),
        cameraZoom: +drawbridgeCameraZoom().toFixed(2),
        spectators: d.audience ? d.audience.members.length : 0,
        spectatorsSpawned: d.audience ? d.audience.spawned || 0 : 0,
        spectatorsAtSpots: d.audience ? d.audience.members.filter((p) => p.sceneSpot && distanceBetween(p, p.sceneSpot) < 6).length : 0,
        trafficHeld: drawbridgeStopsTraffic(),
        spanClosed: drawbridgeSpanClosed(),
        arms: d.arms.map((a) => ({ id: a.id, pos: +a.pos.toFixed(2), broken: a.broken })),
        schedule: DRAWBRIDGE_OPENINGS.map((t) => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0')),
        nextOpeningIn: Math.round(next - minute),
        routeDelay: Math.round(drawbridgeRouteDelay()),
        occupants: (({ player, people, vehicles: list }) => ({ player, people, vehicles: list.length }))(drawbridgeSpanOccupants()),
        queued: vehicles.filter((c) => c.ai && drawbridgeNear(c.x, c.y) && Math.abs(c.speed || 0) < 3 && Math.abs(drawbridgeLocal(c.x, c.y).v) < g.half).length,
        // Every road vehicle on the causeway: where, how fast, what traffic AI wants.
        traffic: vehicles
          .filter((c) => !isBoat(c) && !isAircraft(c) && drawbridgeNear(c.x, c.y) && Math.abs(drawbridgeLocal(c.x, c.y).v) < g.half)
          .map((c) => ({ id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y), speed: Math.round(c.speed || 0), ai: !!c.ai, desired: c.aiControl ? Math.round(c.aiControl.desired) : null, hp: Math.round(c.hp), crashed: !!c.crashStop })),
        vessel: v ? { leg: v.leg, x: Math.round(v.x), y: Math.round(v.y), across: Math.round(v.across), speed: +v.speed.toFixed(1), sails: +v.sails.toFixed(2), saluted: !!v.saluted } : null,
        openings: d.openings,
        jumps: d.jumps.map((j) => ({ speed: j.speed, angle: j.angle, crossed: j.crossed, landed: j.landed ?? null, splash: !!j.splash, struck: !!j.struck, distance: j.distance ?? null, impact: j.impact ?? null })),
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
          // The whole bridge from off its south side; the west pier's south pit.
          overview: [g.m, g.half + 520],
          pit: [g.hinge[0] - 40, g.half + 40],
        },
        [u, v] = views[spot] || views.channel;
      return bridgePoint(g.bridge, u, v);
    }
