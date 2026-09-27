    // Sirens: which vehicles run with lights (emergencyBeacons, sirenUnit), and traffic making way for
    // them: pulling over to the kerb and stopping (sirenPullOver), holding at a junction (sirenCrossing).
    /* The units under lights on the road this frame, gathered once in
       updateLivingCity (trafficControl runs 20 times a second per car and only
       scans this short list). */
    const sirenUnits = [];
    /* Beacons flashing (the renderer's strobes read this): a cruiser in a
       pursuit or after a gang, the air unit, an ambulance on a job. A parked
       ambulance at the hospital keeps its lamps dark. */
    function emergencyBeacons(c) {
      return (
        (c.cop && wantedStars > 0) ||
        !!c.airUnit ||
        !!c.gangTarget ||
        (c.type === 'ambulance' && (!!c.missionAmbulance || !!c.emergency))
      );
    }
    /* A vehicle traffic must make way for: on the road, crewed, beacons on and a
       siren running (an ambulance on scene keeps its lamps but no longer runs). */
    function sirenUnit(c) {
      if (c.hp <= 0 || c.airUnit || c.crewDeployed || c.blockade || c === player.car || isBoat(c) || isAircraft(c)) return false;
      if (c.type === 'ambulance') return !!c.emergency?.running || (!!c.missionAmbulance && !!c.countyRoute);
      return (c.cop && (wantedStars > 0 || !!c.gangTarget)) || !!c.gangTarget;
    }
    function gatherSirenUnits() {
      sirenUnits.length = 0;
      for (const c of vehicles)
        if (Math.abs(c.x - player.x) < 1800 && Math.abs(c.y - player.y) < 1800 && sirenUnit(c)) sirenUnits.push(c);
    }
    /* Room between a car's lane line and the kerb (grid streets: the lane line
       25 units off the centre, the kerb 44 out, 56 on the wide avenues). */
    function kerbRoom(c) {
      const vertical = Math.abs(Math.sin(c.navAngle ?? c.a)) > 0.5,
        wide = vertical ? wideColumn(roadNear(c.x)) : wideRow(rowNear(c.y));
      return clamp((wide ? 56 : 44) - 25 - vehicleSpec(c).w / 2 - 2, 0, 24);
    }
    /* How far right of its lane line a grid-street car is. */
    function laneShift(c) {
      const nav = c.navAngle ?? c.a;
      if (Math.abs(Math.sin(nav)) > 0.5) {
        const sign = Math.sign(Math.sin(nav));
        return (roadNear(c.x) - sign * 25 - c.x) * sign;
      }
      const sign = Math.sign(Math.cos(nav));
      return (c.y - rowNear(c.y) - sign * 25) * sign;
    }
    /* A siren closing from behind in our lane, or coming head-on down our side
       of the road: ease over to the kerb and slow to a stop until it is by.
       Returns the speed cap and the shift to the right, or null. Sets
       `c.sirenYield` (the time it last gave way) for reports and tests. */
    function sirenPullOver(c) {
      if (!sirenUnits.length || c.junction?.committed) return null;
      const ca = Math.cos(c.a),
        sa = Math.sin(c.a);
      for (let i = 0; i < sirenUnits.length; i++) {
        const e = sirenUnits[i];
        if (e === c) continue;
        const dx = e.x - c.x,
          dy = e.y - c.y;
        if (dx > 360 || dx < -360 || dy > 360 || dy < -360) continue;
        const moving = Math.hypot(e.vx || 0, e.vy || 0);
        if (moving < 6 * KMH) continue;
        const along = dx * ca + dy * sa,
          right = -dx * sa + dy * ca,
          heading = Math.cos(e.a - c.a);
        const behind = along < 20 && along > -340 && heading > 0.5 && Math.abs(right) < 70,
          // Head-on on our side of the centre line (overtaking the queue).
          oncoming = along > 0 && along < 300 && heading < -0.5 && right < 34 && right > -60;
        if (!behind && !oncoming) continue;
        const close = behind ? -along : along,
          shift = kerbRoom(c);
        c.sirenYield = gameTime;
        return {
          // Crawl over to the kerb; stop there once it is close (a car stopped
          // before it got over would not move across any more).
          speed: close < 150 && laneShift(c) >= shift - 2.5 ? 0 : 9 * KMH,
          shift,
        };
      }
      return null;
    }
    /* A unit under lights about to cross the junction a car is waiting at (or
       already in it): hold at the line. One behind us going our way is let
       through by pulling over instead. */
    function sirenCrossing(c, j) {
      for (let i = 0; i < sirenUnits.length; i++) {
        const e = sirenUnits[i];
        if (e === c) continue;
        const dx = j.x - e.x,
          dy = j.y - e.y;
        if (dx > 280 || dx < -280 || dy > 280 || dy < -280) continue;
        const vx = e.vx || 0,
          vy = e.vy || 0,
          speed = Math.hypot(vx, vy),
          d = Math.hypot(dx, dy);
        if (Math.cos(e.a - j.a) > 0.7 && (c.x - e.x) * Math.cos(j.a) + (c.y - e.y) * Math.sin(j.a) > 0) continue;
        if (d < 90 || (speed > 8 * KMH && (dx * vx + dy * vy) / (d * speed) > 0.6)) {
          c.sirenYield = gameTime;
          return true;
        }
      }
      return false;
    }
    /* An ambulance on a run (livingcity-medics.js) through countyRouteControl:
       its route is junction centres then the stop (and a point past it). Like a
       real one it straddles the centre line (a car in either lane, stopped or
       pulled over, leaves it a metre each side) at up to 58 km/h through red
       lights (traffic holds for it: sirenCrossing), slows for its turns, brakes
       for anything on the centre line and for people, and pulls up at the stop.
       `countyIndex` never wraps here. */
    function emergencyRunControl(c) {
      const route = c.countyRoute,
        spec = vehicleSpec(c),
        run = c.emergency,
        lastLeg = route.length - 2;
      let i = c.countyIndex || 0;
      while (i < route.length - 1 && Math.hypot(route[i].x - c.x, route[i].y - c.y) < (i >= lastLeg ? 12 : 45)) i++;
      c.countyIndex = i;
      const next = route[i],
        prev = i > 0 ? route[i - 1] : { x: c.x - Math.cos(c.a) * 100, y: c.y - Math.sin(c.a) * 100 },
        len = Math.max(1, Math.hypot(next.x - prev.x, next.y - prev.y)),
        ux = (next.x - prev.x) / len,
        uy = (next.y - prev.y) / len,
        t = (c.x - prev.x) * ux + (c.y - prev.y) * uy,
        look = Math.max(0, t) + 70,
        // Steering round a stopped car that pokes into our way (set below, held
        // a moment): the aim line moves across by the offset.
        dodge = run.dodge && run.dodge.until > gameTime && i < lastLeg ? run.dodge.offset : 0,
        // Near the junction the aim point runs on round the corner into the next
        // leg, so it turns onto the new centre line instead of overshooting it.
        after = i < lastLeg ? route[i + 1] : null,
        a2 = after ? Math.atan2(after.y - next.y, after.x - next.x) : 0,
        target =
          look <= len || !after
            ? { x: prev.x + ux * Math.min(look, len) - uy * dodge, y: prev.y + uy * Math.min(look, len) + ux * dodge }
            : { x: next.x + Math.cos(a2) * (look - len), y: next.y + Math.sin(a2) * (look - len) },
        da = normalizeAngle(headingBetween(c, target) - c.a);
      let desired = 58 * KMH;
      // A turn at the junction ahead: down to about 22 km/h at the corner.
      if (after) {
        const turn = Math.abs(normalizeAngle(a2 - Math.atan2(uy, ux)));
        if (turn > 0.5) desired = Math.min(desired, Math.sqrt((22 * KMH) ** 2 + 2 * 0.45 * GRAVITY * Math.max(0, len - t - 30)));
      } else {
        // The stop: pull up beside the victim.
        const stop = route[lastLeg],
          left = i === lastLeg ? Math.hypot(stop.x - c.x, stop.y - c.y) : Math.max(0, (stop.x - c.x) * ux + (stop.y - c.y) * uy);
        desired = Math.min(desired, Math.sqrt(2 * 30 * Math.max(0, left - 4)));
      }
      desired *= clamp(1 - Math.abs(da) * 0.5, 0.25, 1);
      const ca = Math.cos(c.a),
        sa = Math.sin(c.a),
        side = spec.w / 2;
      for (const o of vehicles) {
        if (o === c || (o.altitude || 0) > 20) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y;
        if (dx > 260 || dx < -260 || dy > 260 || dy < -260) continue;
        const along = dx * ca + dy * sa;
        if (along <= 0 || along > 240 || isBoat(o)) continue;
        const os = vehicleSpec(o),
          oc = Math.cos(o.a),
          osn = Math.sin(o.a),
          ol = (Math.abs(oc * ca + osn * sa) * os.l) / 2 + (Math.abs(-osn * ca + oc * sa) * os.w) / 2,
          ow = (Math.abs(-oc * sa + osn * ca) * os.l) / 2 + (Math.abs(osn * sa + oc * ca) * os.w) / 2;
        const lateral = -dx * sa + dy * ca;
        if (Math.abs(lateral) > side + ow + 2) continue;
        const gap = along - spec.l / 2 - ol - 8,
          lead = Math.max(0, (o.vx || 0) * ca + (o.vy || 0) * sa);
        // A stopped or crawling car poking into our way from one side (pulling
        // over, in its own lane after our turn): move the aim line across
        // by what it takes to clear it (up to 18 units) and creep past.
        const need = side + ow + 3 - Math.abs(lateral);
        if (lead < 12 * KMH && Math.abs(lateral) > 3 && need < 18 && gap < 90 && i < lastLeg) {
          const own = -(c.x - prev.x) * uy + (c.y - prev.y) * ux;
          if (!run.dodge || run.dodge.until < gameTime || Math.abs(run.dodge.offset) < Math.abs(own - Math.sign(lateral) * need))
            run.dodge = { offset: clamp(own - Math.sign(lateral) * need, -20, 20), until: gameTime + 1.5 };
          desired = Math.min(desired, 9 * KMH);
          continue;
        }
        desired = Math.min(desired, lead + Math.max(0, gap) * 1.2, Math.sqrt(lead * lead + 2 * 0.8 * GRAVITY * Math.max(0, gap)) * 0.9);
      }
      const yieldTo = (p) => {
        if (p.hp <= 0 || p.roof || p.cityRole) return;
        const dx = p.x - c.x,
          dy = p.y - c.y,
          along = dx * ca + dy * sa;
        if (along > 0 && along < 170 && Math.abs(-dx * sa + dy * ca) < side + 10)
          desired = Math.min(desired, Math.sqrt(2 * 0.7 * GRAVITY * Math.max(0, along - spec.l / 2 - 16)) * 0.8);
      };
      forEachPedestrianNear(c.x + ca * 85, c.y + sa * 85, 100, yieldTo);
      if (!player.car) yieldTo(player);
      return { steer: clamp(da * 2.6, -1.6, 1.6), desired: Math.max(0, desired) };
    }
