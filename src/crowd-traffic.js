    // Traffic life: drivers getting out, arguments, returning to cars, crashes (updateTrafficLife) and knocked scene props.
    function blockerAhead(c) {
      const ca = Math.cos(c.a),
        sa = Math.sin(c.a),
        half = vehicleSpec(c).l / 2,
        vertical = Math.abs(Math.sin(c.navAngle ?? c.a)) > 0.5;
      if (c.junction && !c.junction.committed) {
        const signal = trafficSignal(c.junction.x, c.junction.y)[vertical ? 'vertical' : 'horizontal'];
        if (signal !== 'green') return null;
      }
      for (const o of vehicles) {
        if (o === c || (o.altitude || 0) > 20 || isBoat(o)) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y;
        if (Math.abs(dx) > 110 || Math.abs(dy) > 110) continue;
        const along = dx * ca + dy * sa,
          lateral = Math.abs(-dx * sa + dy * ca);
        if (along < half || along > half + 70 + vehicleSpec(o).l / 2 || lateral > 15) continue;
        if (o === player.car || !o.ai || o.hp <= 0 || !o.occupied || o.crashStop) return { kind: 'car', o };
        if ((o.blockedFor || 0) > 3) return { kind: 'queue', o };
        return null;
      }
      let person = null;
      forPeopleNear(c.x + ca * (half + 26), c.y + sa * (half + 26), 24, (p) => {
        if (!person && p.hp > 0 && crowdOnRoad(p.x, p.y)) person = p;
      });
      if (person) return { kind: 'person', p: person };
      if (!player.car && Math.hypot(player.x - (c.x + ca * (half + 26)), player.y - (c.y + sa * (half + 26))) < 24)
        return { kind: 'person', p: player };
      return null;
    }
    function driverOut(c) {
      const crash = c.crashStop;
      c.crashStop = null;
      const door = driverDoor(c);
      let x = door.x,
        y = door.y;
      if (solid(x, y, 6)) {
        const other = c.a + Math.PI / 2;
        x = c.x + Math.cos(other) * (vehicleSpec(c).w / 2 + 11);
        y = c.y + Math.sin(other) * (vehicleSpec(c).w / 2 + 11);
        if (solid(x, y, 6)) return;
      }
      const d = { x, y, a: door.a, hp: 30, flee: 0, timer: 1, walk: 0, state: 'walk', car: c };
      dressPerson(d, 'casual');
      d.look.top = d.color = c.driverColor || d.color;
      pedestrians.push(d);
      c.occupied = false;
      c.ai = false;
      c.vx = c.vy = c.speed = 0;
      c.driverOut = d;
      const hurt = crash.severity > 230 || c.hp < c.maxhp * 0.35,
        mood = c.driverMood || 'flee',
        other = crash.other,
        target = other === player.car ? player : other;
      if (hurt) {
        d.injured = true;
        startReaction(d, 'gasp', 1.6, c, crash.inc, { then: 'hurry' });
        crowdSay(d, 'shakenDriver', 1);
      } else if (mood === 'angry' || mood === 'defiant' || (mood === 'flee' && seededRandom() < 0.4)) {
        startReaction(d, 'argue', reactionDuration('argue'), target || c, crash.inc, { target, car: c, then: 'returnCar' });
      } else if (mood === 'witness' && crash.inc?.attacker === player) {
        startReaction(d, 'call', reactionDuration('call'), target || c, crash.inc, { then: 'returnCar' });
      } else {
        startReaction(d, 'watch', randomBetween(6, 10), c, crash.inc, { then: 'returnCar', focusCar: c });
        crowdSay(d, 'shakenDriver', 0.8);
      }
    }
    function updateArgument(p, r, deltaSeconds) {
      const target = r.target && (r.target.hp > 0 || r.target === player) ? r.target : r.car;
      if (!target) {
        r.dur = 0;
        return;
      }
      // Someone pulls a gun or drives off: the argument is over.
      if (target === player && p.aimedAt > gameTime - 0.3) return;
      const d = distanceBetween(p, target);
      if (d > 26 && d < 300) {
        p.pose = null;
        crowdStep(p, headingBetween(p, target), 34, deltaSeconds);
      } else {
        p.walking = false;
        faceToward(p, target, deltaSeconds, 6);
        p.pose = r.t % 2.4 < 1.4 ? 'fist' : 'shout';
        if (seededRandom() < deltaSeconds * 0.45) crowdSay(p, 'angryDriver', 1);
      }
    }
    function updateReturnToCar(p, r, deltaSeconds) {
      const c = p.car || r.car;
      if (!c || c.hp <= 0 || !vehicles.includes(c)) {
        r.dur = 0;
        r.then = null;
        return false;
      }
      if (player.car === c || c.occupied) {
        // Somebody took it while they were busy shouting.
        p.react = null;
        startReaction(p, 'fist', 2.5, c, null, { car: c, then: 'hurry' });
        return true;
      }
      const door = driverDoor(c);
      if (distanceBetween(p, door) < 7) {
        const k = pedestrians.indexOf(p);
        if (k >= 0) pedestrians.splice(k, 1);
        c.occupied = true;
        c.driverOut = null;
        c.ai = c.hp > c.maxhp * 0.3 && !c.stolen;
        return true;
      }
      p.pose = null;
      crowdStep(p, headingBetween(p, door), 30, deltaSeconds);
      r.dur = r.t + 5;
      return false;
    }
    /* Called from collisionImpact for every hard enough contact. */
    function crowdCrash(a, b, hit, closing) {
      if (closing < 70 || !hit) return;
      if (Math.abs(hit.x - player.x) > 1400 || Math.abs(hit.y - player.y) > 1400) return;
      // The player is the culprit only for ramming someone hard, not for being hit.
      const other = a === player.car ? b : b === player.car ? a : null,
        playerFaster =
          !!other && (player.car?.impactSpeed || 0) > (other.impactSpeed || 0),
        culprit = other && other.occupied && playerFaster && closing > RECKLESS_CRASH_SPEED ? player : null;
      const inc = crowdAlarm('crash', hit, culprit, clamp(closing / 160, 0.5, 2));
      for (const c of [a, b]) {
        if (!c || c === player.car || !c.occupied || !c.ai || c.hp <= 0 || c.type === 'police') continue;
        if (isBoat(c) || isAircraft(c) || c.ramUntil > gameTime || c.crashStop) continue;
        if (closing < 75) {
          c.honkAt = gameTime + randomBetween(0.2, 0.6);
          continue;
        }
        c.crashStop = { time: gameTime, other: c === a ? b : a, severity: closing, inc };
      }
    }
    function updateTrafficLife(deltaSeconds) {
      crowd.timers.traffic -= deltaSeconds;
      if (crowd.timers.traffic > 0) return;
      const step = 0.25;
      crowd.timers.traffic = step;
      for (const c of vehicles) {
        if (c.hp <= 0 || isAircraft(c) || isBoat(c)) continue;
        if (Math.abs(c.x - player.x) > 950 || Math.abs(c.y - player.y) > 950) continue;
        if (c.crashStop) {
          c.honkAt = 0;
          if (Math.hypot(c.vx || 0, c.vy || 0) < 6 && gameTime - c.crashStop.time > 0.9) driverOut(c);
          else if (gameTime - c.crashStop.time > 6) c.crashStop = null;
          continue;
        }
        if (!c.ai || !c.occupied) continue;
        if (c.honkAt && gameTime >= c.honkAt) {
          c.honkAt = 0;
          hornSound(c, 0.4);
        }
        if (Math.abs(c.speed || 0) > 6 || c.curbStop) {
          c.blockedFor = 0;
          continue;
        }
        const blocker = blockerAhead(c);
        if (!blocker) {
          c.blockedFor = 0;
          continue;
        }
        c.blockedFor = (c.blockedFor || 0) + step;
        const patience = 2 + (c.id % 5) * 0.7;
        if (c.blockedFor > patience && gameTime > (c.nextHonk || 0)) {
          const fed = c.blockedFor > patience + 7;
          if (blocker.kind === 'queue' && seededRandom() < 0.6) {
            c.nextHonk = gameTime + randomBetween(3, 6);
            continue;
          }
          hornSound(c, fed ? randomBetween(0.7, 1.2) : randomChoice([0.16, 0.28, 0.4]), fed && seededRandom() < 0.4);
          crowd.honks++;
          c.nextHonk = gameTime + (fed ? randomBetween(1.3, 2.6) : randomBetween(2.2, 4.5));
          if (fed && blocker.kind !== 'queue' && seededRandom() < 0.4) {
            c.speech = randomChoice(CROWD_LINES.honk);
            c.speechUntil = gameTime + 2.4;
          }
          // People standing in the road get out of it when honked at.
          if (blocker.kind === 'person' && blocker.p !== player && blocker.p.react?.kind === 'watch') {
            blocker.p.react.spot = snapToSidewalk(blocker.p.x, blocker.p.y);
            crowdSay(blocker.p, 'fist', 0.4);
          }
        }
      }
    }

    /**
     * KNOCKED SCENE FURNITURE
     * A street scene's furniture (a vendor's cart, cafe tables and chairs, a menu
     * board, a busker's case, delivery boxes, a club rope) is loose: a vehicle
     * driving into it throws it ahead and aside with the car's momentum shared
     * (masses in kg below), tips it over, and it tumbles to a stop. Whoever was
     * working or sitting there scatters. The scene carries on around the mess
     * and takes its furniture away when it packs up.
     */
    const SCENE_PROP_KG = { cart: 160, cafeTable: 35, menuBoard: 10, guitarCase: 5, boxes: 25, rope: 15 },
      SCENE_PROP_MATERIAL = { cart: 'metal', cafeTable: 'metal', menuBoard: 'wood', guitarCase: 'plastic', boxes: 'fabric', rope: 'metal' };
    function knockSceneProps(deltaSeconds) {
      const props = crowd.props;
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (Math.abs(prop.x - player.x) > 1200 || Math.abs(prop.y - player.y) > 1200) continue;
        if (!prop.knocked || prop.vx || prop.vy) {
          for (let v = 0; v < vehicles.length; v++) {
            const c = vehicles[v];
            if (Math.abs(c.x - prop.x) > 70 || Math.abs(c.y - prop.y) > 70) continue;
            if (isBoat(c) || (isAircraft(c) && (c.altitude || 0) > 8)) continue;
            const speed = Math.hypot(c.vx || 0, c.vy || 0);
            if (speed < 2 * UNITS_PER_METRE || !pointInCar(prop.x, prop.y, c, 4)) continue;
            const kg = SCENE_PROP_KG[prop.kind] || 20,
              mass = (vehicleSpec(c).mass || 1.25) * 1000,
              share = kg / (kg + mass),
              side = Math.sign(-(prop.x - c.x) * Math.sin(c.a) + (prop.y - c.y) * Math.cos(c.a)) || 1,
              throwSpeed = speed * (1 + seededRandom() * 0.2);
            prop.vx = c.vx * 1.05 - Math.sin(c.a) * side * throwSpeed * 0.35;
            prop.vy = c.vy * 1.05 + Math.cos(c.a) * side * throwSpeed * 0.35;
            prop.spin = side * (3 + speed * 0.02);
            prop.tipTo = prop.kind === 'rope' || prop.kind === 'boxes' ? 0.4 : 1.45;
            // The car gives up the momentum it hands on.
            c.vx *= 1 - share;
            c.vy *= 1 - share;
            if (!prop.knocked) {
              prop.knocked = true;
              if (distanceBetween(prop, player) < 900)
                crashSound({ x: prop.x, y: prop.y, closing: speed, mass: mass / 1000, other: 'prop', material: SCENE_PROP_MATERIAL[prop.kind], propKg: kg, glass: 0, sliding: 0, key: 'scene' + c.id });
              crowdAlarm('crash', { x: prop.x, y: prop.y }, null, 0.9);
              if (c === player.car) shake = Math.max(shake, kg > 100 ? 2 : 0.6);
            }
            break;
          }
        }
        if (!prop.vx && !prop.vy && prop.tip === prop.tipTo) continue;
        prop.x += prop.vx * deltaSeconds;
        prop.y += prop.vy * deltaSeconds;
        prop.a += prop.spin * deltaSeconds;
        prop.tip += (prop.tipTo - prop.tip) * Math.min(1, deltaSeconds * 7);
        if (Math.abs(prop.tipTo - prop.tip) < 0.01) prop.tip = prop.tipTo;
        // Sliding and tumbling on the pavement: about 0.6 g, harder once it is over.
        const friction = Math.exp(-(prop.tip > 0.7 ? 4 : 2.2) * deltaSeconds);
        prop.vx *= friction;
        prop.vy *= friction;
        prop.spin *= friction;
        if (Math.hypot(prop.vx, prop.vy) < 3 || solid(prop.x, prop.y, 3)) prop.vx = prop.vy = prop.spin = 0;
      }
    }
