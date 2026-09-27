    // Pursuit steering aids: room to swing onto a straight run (roomToTurn), the speed the
    // corners on the route ahead allow (routeCornerSpeed) and traffic in the path (carInPath).
    /**
     * ROOM TO TURN
     * A car carries its speed the way it points, so a straight run at `to`
     * (close and in sight, or a shortcut) is only taken when `to` lies within
     * about 60° of the nose and, if it is off the nose, the way ahead is open
     * for as far as the car needs to brake. Otherwise the road route leads it
     * round. (Cruisers answering a call on Monarch Isle came up Monarch
     * Boulevard fast, aimed across Crown Circus at the reported spot round the
     * corner, a 70-80° turn, hit the fountain, backed off and aimed again, for
     * seconds on end.)
     */
    function roomToTurn(c, to) {
      const da = Math.abs(normalizeAngle(headingBetween(c, to) - c.a));
      if (da < 0.45) return true;
      if (da > 1.05) return false;
      const fx = Math.cos(c.a),
        fy = Math.sin(c.a),
        along = Math.max(0, (c.vx || 0) * fx + (c.vy || 0) * fy),
        spec = vehicleSpec(c),
        reach = spec.l / 2 + (along * along) / (2 * spec.brake);
      for (let s = 12; s < reach + 12; s += 16) {
        const x = c.x + fx * Math.min(s, reach),
          y = c.y + fy * Math.min(s, reach);
        if (!groundAt(x, y, 10) || solid(x, y, 10)) return false;
      }
      return true;
    }
    /**
     * CORNERS AHEAD
     * The fastest a unit following its road route may go now and still take the
     * turns ahead: each node within ~260 units is a corner whose radius follows
     * from the turn there and the room either side of it (half of each leg, 45 at
     * most: a ring's polyline gives the ring's own radius), taken at the speed
     * the tyres hold on that radius (never under 45 units/s); the car must be
     * able to brake to it on half its brakes by the time it starts the turn
     * (pursuitControl brakes in earnest when it is over). A cruiser coming up
     * Monarch Boulevard at 70 km/h could not take Crown Circus and ran onto the
     * island.
     */
    function routeCornerSpeed(c, spec) {
      const route = c.route || [],
        wet = wetGrip(),
        grip = (spec.cornerG || 1.2) * GRAVITY * wet,
        // Planned on half the brakes: the throttle follows the plan a little late.
        brake = spec.brake * 0.5 * wet;
      let from = c,
        travelled = 0,
        top = Infinity;
      for (let i = 0; i < route.length - 1 && i < 8 && travelled < 260; i++) {
        const node = route[i],
          next = route[i + 1],
          inLeg = distanceBetween(from, node),
          outLeg = distanceBetween(node, next);
        travelled += inLeg;
        const turn = Math.abs(normalizeAngle(headingBetween(node, next) - headingBetween(from, node)));
        if (turn > 0.1 && inLeg > 1 && outLeg > 1) {
          const room = Math.min(45, inLeg / 2, outLeg / 2),
            radius = room / Math.tan(Math.min(turn, 2.8) / 2),
            corner = Math.max(45, Math.sqrt(grip * radius));
          // Braked for by the time the node is 45 away: routeToward lets it go
          // there and the car starts cutting the corner.
          top = Math.min(top, Math.sqrt(corner * corner + 2 * brake * Math.max(0, travelled - 45)));
        }
        from = node;
      }
      return top;
    }
    /**
     * TRAFFIC IN THE WAY
     * The nearest vehicle in a unit's path within `reach` of its bumper, other
     * than `skip` (the one it is chasing): { car, gap (bumper to bumper), side
     * (lateral offset, positive on the side a positive steer turns toward),
     * across / along (its half extents across and along this car's heading),
     * approach (its speed toward this car) }.
     * An oncoming car on a one-way carriageway, a queue or a parked car is
     * steered round instead of shoved (planPursuit): responding cruisers used to
     * push an oncoming island car backwards at walking pace.
     */
    function carInPath(c, skip, reach) {
      const spec = vehicleSpec(c),
        fx = Math.cos(c.a),
        fy = Math.sin(c.a),
        far = reach + spec.l + 40;
      let best = null;
      for (const o of vehicles) {
        if (o === c || o === skip || (o.altitude || 0) > 15) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y;
        if (dx > far || dx < -far || dy > far || dy < -far) continue;
        const ahead = dx * fx + dy * fy;
        if (ahead <= 0) continue;
        const os = vehicleSpec(o),
          l = os?.l || 36,
          w = os?.w || 16,
          cr = Math.abs(Math.cos(o.a - c.a)),
          sr = Math.abs(Math.sin(o.a - c.a)),
          side = -dx * fy + dy * fx;
        if (Math.abs(side) > spec.w / 2 + (sr * l + cr * w) / 2 + 3) continue;
        // Its near end in front of this car's nose (touching counts; alongside does not).
        const gap = ahead - (cr * l + sr * w) / 2 - spec.l / 2;
        if (gap > -8 && gap <= reach && (!best || gap < best.gap))
          best = { car: o, gap, side, across: (sr * l + cr * w) / 2, along: (cr * l + sr * w) / 2, approach: -((o.vx || 0) * fx + (o.vy || 0) * fy) };
      }
      return best;
    }
