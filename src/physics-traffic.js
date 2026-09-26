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
      const u = {
          x: Math.cos(a),
          y: Math.sin(a),
        },
        r = {
          x: -u.y,
          y: u.x,
        };
      for (let d = 80; d <= reach + 79; d += 80) {
        const step = Math.min(d, reach),
          px = x + u.x * step + r.x * 25,
          py = y + u.y * step + r.y * 25;
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
        const occupied = vehicles.some(
          (o) =>
            o !== c &&
            o.hp > 0 &&
            o.junction?.committed &&
            Math.abs(o.junction.x - j.x) < 5 &&
            Math.abs(o.junction.y - j.y) < 5 &&
            Math.abs(o.x - j.x) < 110 + vehicleSpec(o).l / 2 &&
            Math.abs(o.y - j.y) < 110 + vehicleSpec(o).l / 2 &&
            (Math.abs(normalizeAngle(o.junction.a - j.a)) > 0.2 || o.junction.turn || j.turn),
        );
        const headingCosine3 = Math.cos(j.exit),
          headingSine3 = Math.sin(j.exit),
          end = j.points[j.points.length - 1];
        const exitBlocked = vehicles.some((o) => {
          if (o === c || isBoat(o) || (o.altitude || 0) > 20 || Math.abs(o.speed) > 18) return false;
          const dx = o.x - end.x,
            dy = o.y - end.y;
          return (
            Math.abs(-dx * headingSine3 + dy * headingCosine3) <
              (vehicleDefinition.w + vehicleSpec(o).w) / 2 + 7 &&
            Math.abs(dx * headingCosine3 + dy * headingSine3) <
              (vehicleDefinition.l + vehicleSpec(o).l) / 2 + 22
          );
        });
        // A green light with the box and the exit clear is driven through at
        // speed, committing about half a second out; anything else is a stop
        // at the line, braked for at about half a g.
        const proceed = signal === 'green' && !occupied && !exitBlocked;
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
        ease = { amount: 0, side: 1 },
        // How far right of its lane's centre line the car is (the target sits on it).
        laneOffset = -((target.x - c.x) * rx + (target.y - c.y) * ry),
        // Nothing in the oncoming lane (left of us) from just behind to well past
        // the obstacle, moving or not: room to pull out round it.
        oncomingClear = (obstacle, reach) =>
          !vehicles.some((v) => {
            if (v === c || v === obstacle || isBoat(v) || (v.altitude || 0) > 20) return false;
            const vx = v.x - c.x,
              vy = v.y - c.y,
              ahead = vx * headingCosine2 + vy * headingSine2,
              left = -(vx * rx + vy * ry);
            return ahead > -60 && ahead < reach + 260 && left > 6 && left < 80;
          });
      for (const o of vehicles) {
        if (
          o === c ||
          Math.abs(o.x - c.x) > 350 ||
          Math.abs(o.y - c.y) > 350 ||
          (o.altitude || 0) > 20 ||
          isBoat(o) ||
          distanceBetween(c, o) > 350
        )
          continue;
        let standoff = 0;
        const dx = o.x - c.x,
          dy = o.y - c.y,
          along = dx * headingCosine2 + dy * headingSine2,
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
        if (
          pathAhead &&
          !pathAhead.some((p) => {
            const px = p.x - o.x,
              py = p.y - o.y;
            return (
              Math.abs(px * headingCosine3 + py * headingSine3) < vehicleDefinition2.l / 2 + side + 4 &&
              Math.abs(-px * headingSine3 + py * headingCosine3) < vehicleDefinition2.w / 2 + side + 4
            );
          })
        )
          continue;
        // A parked car, a wreck, a double-parked delivery van or a car its driver
        // walked away from: nobody is coming back to move it. Ease across the lane
        // past one poking a little way in from the kerb; pull out round one that
        // fills the lane when the oncoming lane is clear and no junction is near.
        // Traffic used to queue behind any of them for ever.
        if (!through && !o.ai && !o.cop && o !== player.car && Math.abs(o.speed || 0) < 5) {
          // Measured from our lane's centre line, not from where we are now: the
          // shift must hold while we pull across, or it shrinks as we move.
          const laneLateral = laneOffset + dx * rx + dy * ry,
            intrusion = side + ow + 4 - Math.abs(laneLateral),
            overtake =
              intrusion >= 12 && intrusion < 38 && laneLateral > -12 && !c.junction && oncomingClear(o, along);
          if (intrusion < 12 || overtake) {
            // Pass on the left of anything in the middle of the lane.
            const passLeft = overtake || laneLateral >= 0,
              shift = side + ow + 4 + (passLeft ? -laneLateral : laneLateral);
            if (shift > ease.amount) {
              ease.amount = shift;
              ease.side = passLeft ? 1 : -1;
            }
            if (intrusion < 12 || lateral > side + ow || along - half - ol > 45) continue;
            // Caught close behind it still in line: creep out round it rather than
            // stopping, which would leave the car unable to turn out at all.
            desired = Math.min(desired, 20);
            continue;
          }
          // Waiting for the oncoming lane to clear: hold back far enough to pull out.
          if (intrusion < 38 && laneLateral > -12) standoff = 40;
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
      const yieldTo = (p) => {
        if (p.hp <= 0 || p.roof) return;
        const dx = p.x - c.x,
          dy = p.y - c.y;
        if (dx > 210 || dx < -210 || dy > 210 || dy < -210) return;
        const along = dx * headingCosine2 + dy * headingSine2,
          lateral = Math.abs(dx * rx + dy * ry);
        // Only people out on the carriageway: mid-turn the look-ahead box sweeps
        // across the pavement, and a bus used to wait for ever on walkers who
        // were themselves waiting at the kerb for it to clear.
        if (along > 0 && along < 200 && lateral < side + 11 && cityStreetAt(p.x, p.y))
          desired = Math.min(desired, Math.sqrt(2 * 0.7 * GRAVITY * Math.max(0, along - half - 22)) * 0.8);
      };
      forEachPedestrianNear(c.x, c.y, 220, yieldTo);
      if (!player.car) yieldTo(player);
      // Pulling in for a fare or a bus stop, or stopped after a crash (src/crowd.js).
      desired = Math.min(desired, curbsideStop(c));
      // Held at the drawbridge's stop line while it opens (src/drawbridge.js).
      desired = drawbridgeTrafficLimit(c, desired);
      // Steer for a point shifted away from whatever was easing us across the lane.
      const steerA = ease.amount
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
