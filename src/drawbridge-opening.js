    // Drawbridge openings: clearing the span, camera zoom, swinging the leaves, updateDrawbridge(), map, console command and report.
    /* People still on the span while the tender waits to open it walk off by the
       nearer end (a walker keeps to its axis, `dir`). */
    function drawbridgeUsherPeople(d) {
      const g = drawbridgeGeometry(d);
      forEachPedestrianNear(g.channel.x, g.channel.y, g.leaf + 30, (p) => {
        if (p.hp <= 0 || p.react || p.scene || p.state !== 'walk' || !drawbridgeOnSpanOf(d, p.x, p.y, 2)) return;
        const out = drawbridgeLocal(d, p.x, p.y).u < g.m ? g.f.a + Math.PI : g.f.a;
        p.dir = snapAxis(out);
      });
    }
    /* The event camera: for a player close to an opening (on foot, or driving
       slowly), the view eases back to about three quarters of the zoom so both
       leaves and the ship fit the screen. A factor on the zoom the player chose,
       eased like the speed zoom (world-view.js), never a take-over; the Event
       camera setting (settings.js) turns it off. The nearest opening wins. */
    function drawbridgeCameraZoom() {
      if (drawbridgesQuiet) return 1;
      const list = drawbridgeList();
      let zoom = 1;
      for (let i = 0; i < list.length; i++) zoom = Math.min(zoom, drawbridgeCameraZoomAt(list[i]));
      return zoom;
    }
    function drawbridgeCameraZoomAt(d) {
      if (d.phase === 'idle' || d.reason === 'hold' || !eventCameraOn()) return 1;
      const g = drawbridgeGeometry(d),
        c = player.car;
      if (c && (isAircraft(c) || Math.hypot(c.vx || 0, c.vy || 0) > 45 * KMH)) return 1;
      const show = ['unlock', 'raising', 'open', 'lowering'].includes(d.phase) || (d.phase === 'seating' && d.timer < 1),
        near = 1 - clamp((distanceBetween(player, g.channel) - 700) / 600, 0, 1);
      return show ? 1 - 0.26 * near : 1;
    }
    /* ---- The operating sequence ------------------------------------------------------ */
    // Who is on the moving span: the tender waits for them.
    function drawbridgeSpanOccupants(d) {
      const g = drawbridgeGeometry(d),
        found = { player: false, people: 0, vehicles: [] };
      for (const c of vehicles) {
        if (isBoat(c) || c.sunk || (isAircraft(c) && (c.altitude || 0) > 20)) continue;
        if (!drawbridgeOnSpanOf(d, c.x, c.y, 4)) continue;
        if (c === player.car) found.player = true;
        else found.vehicles.push(c);
      }
      if (!player.car && drawbridgeOnSpanOf(d, player.x, player.y, 2) && !player.swimming) found.player = true;
      forEachPedestrianNear(g.channel.x, g.channel.y, g.leaf + 30, (p) => {
        if (p.hp > 0 && drawbridgeOnSpanOf(d, p.x, p.y, 2)) found.people++;
      });
      return found;
    }
    function startDrawbridgeOpening(d, reason = 'schedule') {
      if (d.phase !== 'idle') return false;
      drawbridgeArms(d);
      d.phase = 'warning';
      d.timer = 0;
      d.waited = 0;
      d.reason = reason;
      d.warnedPlayer = false;
      d.openings++;
      // The ship asks for the bridge; the tender answers with one long blast.
      d.hornDue = reason !== 'hold' ? 2.6 : 0;
      if (reason !== 'hold') drawbridgeVesselSetOff(d);
      drawbridgesQuiet = false;
      return true;
    }
    // Swing the leaves toward `target` with an eased speed profile.
    function swingDrawbridge(d, target, deltaSeconds) {
      const remaining = target - d.angle,
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
    // Every drawbridge, each on its own timetable (game-update.js).
    function updateDrawbridge(deltaSeconds) {
      const list = drawbridgeList();
      for (let i = 0; i < list.length; i++) updateOneDrawbridge(list[i], deltaSeconds);
      noteDrawbridgeStates();
      drawbridgeShare.seconds += deltaSeconds;
      for (let i = 0; i < list.length; i++)
        if (drawbridgeSpanClosed(list[i])) {
          drawbridgeShare.open += deltaSeconds;
          break;
        }
    }
    // What the game has seen since it started: seconds played and seconds with a span up (drawbridgesReport).
    const drawbridgeShare = { seconds: 0, open: 0 };
    // This drawbridge's timetable (minutes of the day).
    function drawbridgeOpenings(d) {
      return d.plan.openings || DRAWBRIDGE_OPENINGS;
    }
    function updateOneDrawbridge(d, deltaSeconds) {
      const g = drawbridgeGeometry(d);
      drawbridgeArms(d);
      // The timetable: an opening starts in the first couple of minutes after its slot.
      const minute = worldMinutes % 1440,
        day = Math.floor(worldMinutes / 1440),
        slots = drawbridgeOpenings(d);
      if (d.phase === 'idle')
        for (let i = 0; i < slots.length; i++) {
          const key = day * 16 + i;
          if (minute >= slots[i] && minute < slots[i] + 3 && d.lastSlot !== key) {
            d.lastSlot = key;
            startDrawbridgeOpening(d, 'schedule');
          }
        }
      d.timer += deltaSeconds;
      if (drawbridgeSpanClosed(d)) d.openSeconds += deltaSeconds;
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
          const entryDown = moveDrawbridgeArms(d, true, 1, deltaSeconds);
          // The exit arms follow once the entry arms are down and the lanes out are clear.
          const exitDown = d.timer > 3 ? moveDrawbridgeArms(d, false, 1, deltaSeconds) : false;
          if (entryDown && exitDown) {
            drawbridgeClank(g.channel.x, g.channel.y, 0.4);
            d.phase = 'clearing';
            d.timer = 0;
          }
          break;
        }
        case 'clearing': {
          const on = drawbridgeSpanOccupants(d);
          if (!on.player && !on.people && !on.vehicles.length) {
            d.phase = 'unlock';
            d.timer = 0;
            drawbridgeClank(g.channel.x, g.channel.y, 1);
            break;
          }
          d.waited += deltaSeconds;
          if (on.people) drawbridgeUsherPeople(d);
          if (on.player && d.waited > 6 && gameTime - d.hornAt > 12) {
            d.hornAt = gameTime;
            drawbridgeHorn(g.channel.x, g.channel.y, 150, [0.6, 0.6, 0.6]);
            tell('BRIDGE TENDER · Clear the span, the bridge is opening.', 3.5);
          }
          // A stalled or abandoned car nobody is watching is towed after a while
          // (the span is long: after a minute even one in sight of the player).
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
          if (swingDrawbridge(d, d.held ?? DRAWBRIDGE_MAX_ANGLE, deltaSeconds)) {
            d.phase = 'open';
            d.timer = 0;
            drawbridgeClank(g.channel.x, g.channel.y, 0.6);
            if (d.held === null) drawbridgeHorn(g.channel.x, g.channel.y, 150);
          }
          break;
        case 'open':
          if (d.held !== null) {
            if (Math.abs(d.angle - d.held) > 0.001) swingDrawbridge(d, d.held, deltaSeconds);
            break;
          }
          // The ship needs about 40 s from the hold point to clear the span; the
          // tender gives her well over twice that before lowering regardless.
          if ((d.timer > 8 && drawbridgeVesselClear(d)) || d.timer > 100) {
            d.phase = 'lowering';
            d.timer = 0;
          }
          break;
        case 'lowering':
          motor = Math.abs(d.rate) / DRAWBRIDGE_RATE + 0.25;
          if (swingDrawbridge(d, 0, deltaSeconds)) {
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
          const exitUp = moveDrawbridgeArms(d, false, 0, deltaSeconds),
            entryUp = d.timer > 1.5 ? moveDrawbridgeArms(d, true, 0, deltaSeconds) : false;
          if (exitUp && entryUp) {
            d.phase = 'idle';
            d.timer = 0;
          }
          break;
        }
      }
      updateDrawbridgeMotor(d, motor * (d.phase === 'raising' || d.phase === 'lowering' ? 1 : 0));
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
          const reach = Math.max(0, drawbridgeTipReach(d)) * Math.random(),
            u = Math.random() < 0.5 ? g.hinge[0] + reach : g.hinge[1] - reach,
            p = bridgePoint(g.bridge, u, (Math.random() - 0.5) * g.bridge.width);
          drawbridgeDrip(p.x, p.y, wet);
        }
      }
      drawbridgeSpectators(d);
      // Bells ring from the first warning until the arms are down, and again as they rise.
      const ringing = d.phase === 'warning' || d.phase === 'gates' || d.phase === 'lifting';
      if (ringing) {
        d.bellClock -= deltaSeconds;
        if (d.bellClock <= 0) {
          d.bellClock = 0.5;
          const gate = bridgePoint(g.bridge, g.gates[drawbridgeLocal(d, player.x, player.y).u < g.m ? 0 : 1]);
          drawbridgeBell(gate.x, gate.y);
        }
      }
      // A word for a player driving toward a bridge that is going up.
      if (d.phase !== 'idle' && !d.warnedPlayer && player.car && !isBoat(player.car) && distanceBetween(player, g.channel) < 900) {
        d.warnedPlayer = true;
        tell('DRAWBRIDGE · The ' + (d.plan.title || g.bridge.name) + ' is opening. Traffic is held.', 3.5);
      }
      // Snapped arms are replaced once the bridge is down and nobody is watching.
      if (d.phase === 'idle' && distanceBetween(player, g.channel) > 800)
        for (const arm of d.arms) if (arm.broken && gameTime - arm.brokenAt > 20) arm.broken = false;
      updateDrawbridgeRamming(d);
      updateDrawbridgeVessel(d, deltaSeconds);
    }
