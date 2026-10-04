    // Traffic AI: signals, junction planning, road-line following (trafficControl).
    function trafficSignal(x, y) {
      const phase =
        (((physicsClock + Math.round(x / BLOCK_SIZE) * 3 + Math.round(y / BLOCK_SIZE) * 5) % 24) + 24) %
        24;
      return {
        horizontal: phase < 9 ? 'green' : phase < 11 ? 'amber' : 'red',
        vertical: phase >= 12 && phase < 21 ? 'green' : phase >= 21 && phase < 23 ? 'amber' : 'red',
      };
    }
    function trafficRoadValid(x, y, a, reach = 260) {
      // The heading and the right-hand normal as plain numbers (every car asks this each physics step).
      const ux = Math.cos(a),
        uy = Math.sin(a),
        rx = -uy,
        ry = ux;
      for (let d = 80; d <= reach + 79; d += 80) {
        const step = Math.min(d, reach),
          px = x + ux * step + rx * 25,
          py = y + uy * step + ry * 25;
        if (!cityStreetAt(px, py) || !groundAt(px, py, 20) || solid(px, py, 16) || inHarbor(px, py, 50))
          return false;
      }
      return true;
    }
    function trafficExitValid(x, y, a) {
      if (!trafficRoadValid(x, y, a, BLOCK_SIZE)) return false;
      const nx = x + Math.cos(a) * BLOCK_SIZE,
        ny = y + Math.sin(a) * BLOCK_SIZE;
      return [a, a + Math.PI / 2, a - Math.PI / 2].some((q) => trafficRoadValid(nx, ny, q, BLOCK_SIZE));
    }
    // The next road line ahead (more than 2 units on in the direction `sign`), or
    // undefined: the nearest such entry of `lines`, found without sorting a copy.
    function nextRoadLine(lines, value, sign) {
      let best;
      for (let i = 0; i < lines.length; i++) {
        const v = lines[i];
        if ((v - value) * sign > 2 && (best === undefined || (v - best) * sign < 0)) best = v;
      }
      return best;
    }
    function trafficSpawnValid(x, y, a) {
      const headingCosine = Math.cos(a),
        headingSine = Math.sin(a),
        vertical = Math.abs(headingSine) > 0.5,
        sign = vertical ? Math.sign(headingSine) : Math.sign(headingCosine),
        value = vertical ? y : x,
        next = nextRoadLine(vertical ? ROAD_ROWS : ROAD_CENTERS, value, sign);
      if (next === undefined) return false;
      const nx = vertical ? roadNear(x) : next,
        ny = vertical ? next : rowNear(y);
      if (![a, a + Math.PI / 2, a - Math.PI / 2].some((q) => trafficExitValid(nx, ny, q))) return false;
      for (let d = 0; d < Math.abs(next - value); d += 32) {
        const px = x + headingCosine * d,
          py = y + headingSine * d;
        if (!cityStreetAt(px, py) || !groundAt(px, py, 20) || solid(px, py, 16) || inHarbor(px, py, 50))
          return false;
      }
      return true;
    }
    function planJunction(c, x, y, a) {
      const options = [a, a + Math.PI / 2, a - Math.PI / 2].filter((q) => trafficExitValid(x, y, q));
      if (!options.length) return null;
      let exit = options[0];
      if (options.length > 1 && seededRandom() < 0.24) exit = randomChoice(options.slice(1));
      const u = {
          x: Math.cos(a),
          y: Math.sin(a),
        },
        r = {
          x: -u.y,
          y: u.x,
        },
        v = {
          x: Math.cos(exit),
          y: Math.sin(exit),
        },
        rr = {
          x: -v.y,
          y: v.x,
        };
      const start = {
          x: x - u.x * 125 + r.x * 25,
          y: y - u.y * 125 + r.y * 25,
        },
        end = {
          x: x + v.x * 125 + rr.x * 25,
          y: y + v.y * 125 + rr.y * 25,
        },
        points = [];
      const turn = Math.abs(normalizeAngle(exit - a)) > 0.5;
      if (turn) {
        const delta = {
            x: end.x - start.x,
            y: end.y - start.y,
          },
          cross = u.x * v.y - u.y * v.x,
          k = (delta.x * v.y - delta.y * v.x) / cross,
          control = {
            x: start.x + u.x * k,
            y: start.y + u.y * k,
          };
        for (let i = 1; i <= 12; i++) {
          const t = i / 12;
          points.push({
            x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
            y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
          });
        }
      } else points.push(end);
      return {
        x,
        y,
        a,
        exit,
        points,
        index: 0,
        turn,
        committed: false,
      };
    }
    /* The scans trafficControl makes at a junction and in the lane, as functions of their own
       (they were closures made afresh on every call). */
    // Another car already committed to this junction, in its box.
    function junctionBoxBusy(c, j) {
      for (let i = 0; i < vehicles.length; i++) {
        const o = vehicles[i];
        if (
          o !== c &&
          Math.abs(o.x - j.x) < 200 &&
          Math.abs(o.y - j.y) < 200 &&
          o.hp > 0 &&
          o.junction?.committed &&
          Math.abs(o.junction.x - j.x) < 5 &&
          Math.abs(o.junction.y - j.y) < 5 &&
          Math.abs(o.x - j.x) < 110 + vehicleSpec(o).l / 2 &&
          Math.abs(o.y - j.y) < 110 + vehicleSpec(o).l / 2 &&
          (Math.abs(normalizeAngle(o.junction.a - j.a)) > 0.2 || o.junction.turn || j.turn)
        )
          return true;
      }
      return false;
    }
    // A car standing or crawling where the exit lane begins (`end`, heading cosine / sine).
    function junctionExitOccupied(c, end, headingCosine3, headingSine3, vehicleDefinition) {
      for (let i = 0; i < vehicles.length; i++) {
        const o = vehicles[i],
          dx = o.x - end.x,
          dy = o.y - end.y;
        if (o === c || Math.abs(dx) > 120 || Math.abs(dy) > 120) continue;
        if (isBoat(o) || (o.altitude || 0) > 20 || Math.abs(o.speed) > 18) continue;
        if (
          Math.abs(-dx * headingSine3 + dy * headingCosine3) < (vehicleDefinition.w + vehicleSpec(o).w) / 2 + 7 &&
          Math.abs(dx * headingCosine3 + dy * headingSine3) < (vehicleDefinition.l + vehicleSpec(o).l) / 2 + 22
        )
          return true;
      }
      return false;
    }
    // Nothing in the oncoming lane (left of `c`) from just behind to well past the obstacle,
    // moving or not: room to pull out round it. (cos / sin of c's heading, its right-hand normal.)
    function oncomingLaneClear(c, obstacle, reach, headingCosine2, headingSine2, rx, ry) {
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        if (v === c || v === obstacle || isBoat(v) || (v.altitude || 0) > 20) continue;
        const vx = v.x - c.x,
          vy = v.y - c.y,
          ahead = vx * headingCosine2 + vy * headingSine2,
          left = -(vx * rx + vy * ry);
        if (ahead > -60 && ahead < reach + 260 && left > 6 && left < 80) return false;
      }
      return true;
    }
    // The pedestrian scan's state (set per call, read by trafficYieldTo, which the crowd grid calls).
    const trafficYield = { c: null, desired: 0, heldBy: null, heldAt: Infinity, hc: 0, hs: 0, rx: 0, ry: 0, side: 0, half: 0 },
      trafficEase = { amount: 0, side: 1 };
    function trafficYieldTo(p) {
      if (p.hp <= 0 || p.roof) return;
      const s = trafficYield,
        c = s.c,
        dx = p.x - c.x,
        dy = p.y - c.y;
      if (dx > 210 || dx < -210 || dy > 210 || dy < -210) return;
      const along = dx * s.hc + dy * s.hs,
        lateral = Math.abs(dx * s.rx + dy * s.ry);
      // Only people out on the carriageway: mid-turn the look-ahead box sweeps
      // across the pavement, and a bus used to wait for ever on walkers who
      // were themselves waiting at the kerb for it to clear.
      if (along > 0 && along < 200 && lateral < s.side + 11 && cityStreetAt(p.x, p.y)) {
        s.desired = Math.min(s.desired, Math.sqrt(2 * 0.7 * GRAVITY * Math.max(0, along - s.half - 22)) * 0.8);
        if (along < s.heldAt) {
          s.heldBy = p;
          s.heldAt = along;
        }
      }
    }
    function trafficControl(c, stepSeconds) {
      // A driver who decided to answer a gunshot with the accelerator.
      if (c.ramUntil > gameTime && gameMode === 'play') {
        c.hazard = true;
        c.junction = null;
        return ramControl(c);
      }
      if (c.ramUntil) {
        c.ramUntil = 0;
        c.navAngle = undefined;
      }
      if (c.navAngle === undefined) c.navAngle = (Math.round(c.a / (Math.PI / 2)) * Math.PI) / 2;
      const vehicleDefinition = vehicleSpec(c),
        nav = c.navAngle,
        headingCosine = Math.cos(nav),
        headingSine = Math.sin(nav),
        vertical = Math.abs(headingSine) > 0.5,
        sign = vertical ? Math.sign(headingSine) : Math.sign(headingCosine),
        value = vertical ? c.y : c.x;
      const next = nextRoadLine(vertical ? ROAD_ROWS : ROAD_CENTERS, value, sign);
      // City traffic keeps to about 40-55 km/h (a few drivers quicker than
      // others), 70-85 out on the long bridges; a panicking driver floors it.
      let desired =
          (c.panicUntil > gameTime ? 75 : onBridgeDeck(c.x, c.y) ? 70 + (c.id % 4) * 5 : 40 + (c.id % 4) * 5) * KMH,
        target;
      if (c.panicUntil > gameTime) c.hazard = true;
      else c.hazard = false;
      if (
        !c.junction &&
        next !== undefined &&
        // Planned early enough to stop for a red from town speed.
        Math.abs(next - value) < 330 &&
        Math.abs(next - value) > 90
      ) {
        const x = vertical ? roadNear(c.x) : next,
          y = vertical ? next : rowNear(c.y);
        // Grid lines run on over the water (columns -896 and -384 cross Palm
        // Sound): no junction, and no signal to wait at, out on a bridge.
        if (landAt(x, y)) c.junction = planJunction(c, x, y, nav);
      }
      const j = c.junction;
      if (j) {
        const progress = (j.x - c.x) * headingCosine + (j.y - c.y) * headingSine,
          signal = trafficSignal(j.x, j.y)[vertical ? 'vertical' : 'horizontal'],
          gap = progress - 88 - vehicleDefinition.l / 2;
        const headingCosine3 = Math.cos(j.exit),
          headingSine3 = Math.sin(j.exit),
          end = j.points[j.points.length - 1];
        // A green light with the box and the exit clear is driven through at
        // speed, committing about half a second out; anything else is a stop
        // at the line, braked for at about half a g. Only a car still short of
        // the line on a green looks at the box and the exit (the scans cost more
        // than the rest of the decision), each skipping far cars first.
        const proceed =
          !j.committed &&
          signal === 'green' &&
          !junctionBoxBusy(c, j) &&
          !junctionExitOccupied(c, end, headingCosine3, headingSine3, vehicleDefinition) &&
          // An ambulance or a cruiser under lights crossing: wait at the line
          // (livingcity-sirens.js).
          !sirenCrossing(c, j);
        if (!j.committed && gap < 25 + Math.max(0, c.speed || 0) * 0.5 && proceed) j.committed = true;
        if (!j.committed) {
          if (!proceed) {
            desired = Math.min(
              desired,
              Math.sqrt(2 * 0.45 * GRAVITY * Math.max(0, gap - 3)) * 0.9,
              Math.max(0, gap - 6) * 1.25,
            );
            if (gap < 3) desired = 0;
          }
          // Slowing for the corner ahead before the turn itself.
          if (j.turn) desired = Math.min(desired, Math.sqrt((20 * KMH) ** 2 + 2 * 0.4 * GRAVITY * Math.max(0, gap)));
          target = {
            x: c.x + headingCosine * 75 + (vertical ? roadNear(c.x) - sign * 25 - c.x : 0),
            y: c.y + headingSine * 75 + (!vertical ? rowNear(c.y) + sign * 25 - c.y : 0),
          };
        } else {
          while (j.index < j.points.length - 1 && distanceBetween(c, j.points[j.index]) < 24) j.index++;
          target = j.points[j.index];
          if (j.turn) desired = Math.min(desired, (vehicleDefinition.truck ? 15 : 20) * KMH);
          if (distanceBetween(c, j.points[j.points.length - 1]) < 26) {
            c.navAngle = normalizeAngle(j.exit);
            c.junction = null;
          }
        }
      } else {
        target = vertical
          ? {
              x: roadNear(c.x) - sign * 25,
              y: c.y + sign * 85,
            }
          : {
              x: c.x + sign * 85,
              y: rowNear(c.y) + sign * 25,
            };
        if (
          !trafficRoadValid(
            c.x - headingCosine * 80 + headingSine * 25,
            c.y - headingSine * 80 - headingCosine * 25,
            nav,
          )
        )
          desired = 0;
      }
      const da = normalizeAngle(headingBetween(c, target) - c.a);
      desired *= clamp(1 - Math.abs(da) * 0.45, 0.25, 1);
      const headingCosine2 = Math.cos(c.a),
        headingSine2 = Math.sin(c.a),
        rx = -headingSine2,
        ry = headingCosine2,
        half = vehicleDefinition.l / 2,
        side = vehicleDefinition.w / 2,
        through = c.junction?.committed && c.junction.turn ? c.junction : null,
        // The rest of a committed turn, carried on 120 units down the exit lane so
        // a car stopped just past the corner still holds us back.
        pathAhead = through && [
          ...through.points.slice(through.index),
          ...[40, 80, 120].map((d) => ({
            x: through.points.at(-1).x + Math.cos(through.exit) * d,
            y: through.points.at(-1).y + Math.sin(through.exit) * d,
          })),
        ],
        ease = trafficEase,
        // Right across the lane (not the car: turned out round a parked car or a
        // walker, a car-frame measure grew by the look-ahead's sideways swing), and
        // how far right of its lane's centre line the car is (the target sits on it).
        laneRx = -headingSine,
        laneRy = headingCosine,
        laneOffset = -((target.x - c.x) * laneRx + (target.y - c.y) * laneRy);
      ease.amount = 0;
      ease.side = 1;
      // The gap beside a parked car to steer for when caught close behind it.
      let passAim = null,
        passAt = Infinity,
        pivotOut = 0;
      // An indexed loop with the box test in plain comparisons: this runs for every vehicle in the city, and a
      // for-of iterator result or a Math.abs call per vehicle allocated (~86 bytes a vehicle, 24 KB a call) in code
      // V8 has not fully optimised (the function deoptimises often as vehicles change shape).
      for (let k = 0; k < vehicles.length; k++) {
        const o = vehicles[k];
        if (o === c) continue;
        const dx = o.x - c.x;
        if (dx > 350 || dx < -350) continue;
        const dy = o.y - c.y;
        if (dy > 350 || dy < -350 || (o.altitude || 0) > 20 || isBoat(o) || hypot2(dx, dy) > 350) continue;
        let standoff = 0;
        const along = dx * headingCosine2 + dy * headingSine2,
          lateral = Math.abs(dx * rx + dy * ry),
          vehicleDefinition2 = vehicleSpec(o),
          headingCosine3 = Math.cos(o.a),
          headingSine3 = Math.sin(o.a),
          ol =
            (Math.abs(headingCosine3 * headingCosine2 + headingSine3 * headingSine2) *
              vehicleDefinition2.l) /
              2 +
            (Math.abs(-headingSine3 * headingCosine2 + headingCosine3 * headingSine2) *
              vehicleDefinition2.w) /
              2,
          ow =
            (Math.abs(headingCosine3 * rx + headingSine3 * ry) * vehicleDefinition2.l) / 2 +
            (Math.abs(-headingSine3 * rx + headingCosine3 * ry) * vehicleDefinition2.w) / 2;
        if (along <= 0 || lateral > side + ow + 4) continue;
        // Mid-turn the look-ahead box swings across the cross street and the kerb,
        // and found cars waiting there for us to clear the junction (each then
        // waited for the other for ever) or parked at the kerb beside our exit.
        // While committed, a car only counts if it stands on the rest of our path.
        // (A plain loop, not pathAhead.some(closure): a closure capturing this body's constants made V8 allocate a
        // context for every vehicle the loop visited, used or not: ~8 KB a call.)
        if (pathAhead) {
          let onPath = false;
          for (let i = 0; i < pathAhead.length && !onPath; i++) {
            const px = pathAhead[i].x - o.x,
              py = pathAhead[i].y - o.y;
            onPath =
              Math.abs(px * headingCosine3 + py * headingSine3) < vehicleDefinition2.l / 2 + side + 4 &&
              Math.abs(-px * headingSine3 + py * headingCosine3) < vehicleDefinition2.w / 2 + side + 4;
          }
          if (!onPath) continue;
        }
        // A parked car, a wreck, a double-parked delivery van or a car its driver
        // walked away from: nobody is coming back to move it. Ease across the lane
        // past one poking a little way in from the kerb; pull out round one that
        // fills the lane when the oncoming lane is clear and no junction is near.
        // Traffic used to queue behind any of them for ever.
        if (!through && !o.ai && !o.cop && o !== player.car && Math.abs(o.speed || 0) < 5) {
          // Measured from our lane's centre line, not from where we are now: the
          // shift must hold while we pull across, or it shrinks as we move.
          const laneLateral = laneOffset + dx * laneRx + dy * laneRy,
            intrusion = side + ow + 4 - Math.abs(laneLateral),
            overtake =
              intrusion >= 12 && intrusion < 38 && laneLateral > -12 && !c.junction && oncomingLaneClear(c, o, along, headingCosine2, headingSine2, rx, ry);
          if (intrusion < 12 || overtake) {
            // Pass on the left of anything in the middle of the lane.
            const passLeft = overtake || laneLateral >= 0,
              shift = side + ow + 4 + (passLeft ? -laneLateral : laneLateral);
            if (shift > ease.amount) {
              ease.amount = shift;
              ease.side = passLeft ? 1 : -1;
            }
            if (intrusion < 12 || along - half - ol > 45) continue;
            // Close behind one filling the lane, the far-off lane point is too
            // shallow a line: steer for the gap beside its far corner until we are
            // by (swinging back to that point put the nose into its corner).
            if (along < passAt) {
              const passing = passLeft ? 1 : -1,
                reach = side + ow + 4;
              passAt = along;
              passAim = {
                x: o.x + headingCosine * ol - laneRx * passing * reach,
                y: o.y + headingSine * ol - laneRy * passing * reach,
              };
            }
            if (lateral > side + ow) continue;
            // Still in line: creep out round it rather than stopping, which would
            // leave the car unable to turn out at all, but stop short of the bumper
            // and swing the nose out on the spot: nose to tail it shoved the
            // parked car along the kerb (a mission's parked ambulance, 1 m in 15 s).
            desired = Math.min(desired, 20, Math.max(0, along - half - ol - 2) * 2.5);
            if (along - half - ol < 6) pivotOut = passLeft ? 1 : -1;
            continue;
          }
          // Waiting for the oncoming lane to clear: hold back far enough to pull out,
          // and hold the line if already part way out (swinging back into the lane
          // put the nose into the parked car's corner).
          if (intrusion < 38 && laneLateral > -12) {
            standoff = 40;
            if (laneOffset < -4 && -laneOffset > ease.amount) {
              ease.amount = -laneOffset;
              ease.side = 1;
            }
          }
        }
        // Follow at about 0.8 s behind the car ahead (plus a car's length of
        // slack), never faster than lets us stop behind it if it brakes.
        const gap = along - half - ol - 12 - standoff,
          lead = Math.max(0, (o.vx || 0) * headingCosine2 + (o.vy || 0) * headingSine2);
        desired = Math.min(
          desired,
          Math.sqrt(lead * lead + 2 * 0.8 * GRAVITY * Math.max(0, gap)) * 0.8,
          lead + Math.max(0, gap - 8 - lead * 0.8) * 1.25,
        );
      }
      // Give crossing pedestrians and an innocent player time to clear the lane.
      // Runs 120 times a second per car, so it scans in place without building arrays
      // and skips anyone farther than the look-ahead box before doing any trigonometry.
      const beforePeople = desired,
        scan = trafficYield;
      scan.c = c;
      scan.desired = desired;
      scan.heldBy = null;
      scan.heldAt = Infinity;
      scan.hc = headingCosine2;
      scan.hs = headingSine2;
      scan.rx = rx;
      scan.ry = ry;
      scan.side = side;
      scan.half = half;
      // Everyone the box can hold (0-200 ahead, a lane's width either side) is
      // within 103 units of the point 100 ahead: a quarter of the old query.
      forEachPedestrianNear(c.x + headingCosine2 * 100, c.y + headingSine2 * 100, 110, trafficYieldTo);
      if (!player.car) trafficYieldTo(player);
      desired = scan.desired;
      const heldBy = scan.heldBy;
      scan.c = scan.heldBy = null;
      // Pulling in for a fare or a bus stop, or stopped after a crash (src/crowd.js).
      const curb = curbsideStop(c);
      desired = Math.min(desired, curb);
      // Held at the drawbridge's stop line while it opens (src/drawbridge.js).
      desired = drawbridgeTrafficLimit(c, desired);
      // A siren behind or coming head-on down our side: over to the kerb and
      // stop until it is by (livingcity-sirens.js); not while passing a parked
      // car, which already has us steering round it.
      const pull = sirenPullOver(c);
      if (pull) {
        desired = Math.min(desired, pull.speed);
        if (!ease.amount && pull.shift > 0) {
          ease.amount = pull.shift;
          ease.side = -1;
        }
      }
      // Nobody holds a car for ever: someone standing or stalled in the lane (a
      // walker paused mid-crossing or stuck in the road) held traffic, and every
      // car queued behind it, until they moved or the player left. After
      // a few seconds stopped for the same person the driver eases round them at a
      // walking pace, on whichever side leaves them room. Never round the player
      // (the honk is their cue), nor while already easing round a parked car or
      // pulling over for a siren (an ambulance runs down the centre line).
      let e = c.easePerson;
      if (heldBy && heldBy !== player && e?.p !== heldBy && desired < 3 * KMH && Math.abs(c.speed || 0) < 6 * KMH)
        e = c.easePerson = { p: heldBy, since: gameTime, going: false };
      if (e) {
        const dx = e.p.x - c.x,
          dy = e.p.y - c.y,
          along = dx * headingCosine2 + dy * headingSine2,
          // Right of our lane's centre line (steady while we pull across).
          fromLane = dx * laneRx + dy * laneRy + laneOffset;
        if (e.p.hp <= 0 || along < -half - 10 || Math.abs(fromLane) > side + 44 || gameTime - e.since > 40 || (!e.going && heldBy !== e.p))
          c.easePerson = null;
        else if ((e.going || gameTime - e.since > 4) && !ease.amount && !pull) {
          // Round the left of someone right of the centre line, else round the right.
          e.going = true;
          ease.amount = Math.max(4, side + 6 - Math.abs(fromLane));
          ease.side = fromLane >= 0 ? 1 : -1;
          // The crawl never beats a red, a car ahead, a kerbside stop or the drawbridge.
          if (heldBy === e.p) desired = drawbridgeTrafficLimit(c, Math.min(beforePeople, 7 * KMH, curb));
        }
      }
      // Steer for a point shifted away from whatever was easing us across the lane.
      const steerA = pivotOut
        ? -0.35 * pivotOut
        : passAim
        ? normalizeAngle(headingBetween(c, passAim) - c.a)
        : ease.amount
        ? normalizeAngle(
            headingBetween(c, {
              x: target.x - rx * ease.side * (ease.amount + 1),
              y: target.y - ry * ease.side * (ease.amount + 1),
            }) - c.a,
          )
        : da;
      return {
        steer: clamp(steerA * 3, -1.7, 1.7),
        desired: Math.max(0, desired),
      };
    }
