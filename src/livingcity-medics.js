    // Ambulances in free roam: a body left in a city street brings an ambulance under lights and
    // siren (dispatchMedics); two paramedics work on the victim, who now and then comes round (medicJob).
    /* One job at a time, only in free roam (no mission running), with the
       streets calm (at most one star, no shooting close by in the last few
       seconds) and the player near enough to see it. The ambulance comes in off
       screen on the centre line of the road like a real one on a run
       (countyRouteControl drives its junction route; traffic pulls over,
       livingcity-sirens.js), stops by the victim, and two paramedics get out of
       the back: one kneels and works, the other radios in. Most victims found
       within a couple of minutes come round (the game's old mercy: GTA's
       paramedics did it too); the rest are lost. Then the crew climbs back in
       and the ambulance joins the traffic. Anyone hurt or scared on the way is
       ordinary crowd: a gunshot sends the medics running like anyone else. */
    const MEDIC_DELAY = 9,
      MEDIC_BODY_MAX_AGE = 150,
      MEDIC_REVIVE_AGE = 120,
      MEDIC_COOLDOWN = 25;
    const medicService = { job: null, timer: 1, cooldownUntil: 0, jobs: 0, revived: 0, lost: 0, aborted: 0, last: null };
    const MEDIC_LINES = {
      arrive: ['Coming through!', 'Paramedics, stand back!', 'Give us some room, folks.', 'Where is he? Over here!'],
      radio: ['Dispatch, Medic Four on scene.', 'Medic Four, we are with the patient.', 'Dispatch, one down, working on him now.'],
      work: ['Stay with me...', 'Come on, come on...', 'Starting compressions.', 'Can you hear me? Squeeze my hand.'],
      revived: ['We have a pulse!', 'He is breathing! Easy, easy.', 'There you are. Stay down a second.'],
      lost: ['We lost him.', 'Nothing. Call it.', 'Too late for this one.'],
      victim: ['What... what happened?', 'Oh God, my head...', 'I am okay... I think.', 'Where am I?'],
      leave: ['Let us go, next call.', 'Back in the rig.', 'Dispatch, Medic Four clear.'],
    };
    function medicSay(p, kind, seconds = 2.8) {
      const lines = MEDIC_LINES[kind];
      if (!lines || !p) return;
      p.speech = pickLine(lines, p);
      p.speechUntil = gameTime + seconds;
      p.speechKind = 'medic';
      p.speechKindText = p.speech;
    }
    /* A body the service would come for: a street pedestrian, dead long enough
       for someone to have called, not so long it has been left, on the city's
       ground within reach of a street, near the player. */
    function medicBodyCandidate(p) {
      if (p.hp > 0 || p.medicSeen || p.cityRole || p.roof || p.hidden) return false;
      const age = gameTime - (p.deadTime || 0);
      if (age < MEDIC_DELAY || age > MEDIC_BODY_MAX_AGE) return false;
      if (Math.abs(p.x - player.x) > 1100 || Math.abs(p.y - player.y) > 1100) return false;
      if (!inCityGrid(p.x, p.y) || !landAt(p.x, p.y) || entityElevation(p) > 4) return false;
      return Math.min(Math.abs(p.x - roadNear(p.x)), Math.abs(p.y - rowNear(p.y))) < 160;
    }
    function medicStreetCalm(x, y) {
      return !crowd.incidents.some(
        (inc) => (inc.kind === 'gunfire' || inc.kind === 'explosion') && gameTime - inc.time < 8 && Math.abs(inc.x - x) < 500 && Math.abs(inc.y - y) < 500,
      );
    }
    /* Where the ambulance stops for a body: on the body's street, off the
       junction box, on the side of the road nearest the body. Returns the stop,
       the junction at the end of the route and the street's direction. */
    function medicStopFor(body) {
      const colX = roadNear(body.x),
        rowY = rowNear(body.y),
        onColumn = Math.abs(body.x - colX) < Math.abs(body.y - rowY),
        junction = { x: colX, y: rowY };
      if (onColumn) {
        const side = Math.sign(body.x - colX) || 1,
          y = rowY + clamp(body.y - rowY, -BLOCK_SIZE + 130, BLOCK_SIZE - 130),
          yy = Math.abs(y - rowY) < 110 ? rowY + Math.sign(y - rowY || 1) * 110 : y;
        return { stop: { x: colX + side * 22, y: yy }, junction, heading: Math.sign(yy - rowY) * (Math.PI / 2) };
      }
      const side = Math.sign(body.y - rowY) || 1,
        x = colX + clamp(body.x - colX, -BLOCK_SIZE + 130, BLOCK_SIZE - 130),
        xx = Math.abs(x - colX) < 110 ? colX + Math.sign(x - colX || 1) * 110 : x;
      return { stop: { x: xx, y: rowY + side * 22 }, junction, heading: xx > colX ? 0 : Math.PI };
    }
    /* A start off screen: 150 units short of a junction 650-1300 units from the
       body, pointing at it, on the centre line of a real street. */
    function medicStartFor(body) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const jx = roadNear(body.x + randomBetween(-1300, 1300)),
          jy = rowNear(body.y + randomBetween(-1300, 1300)),
          d = Math.hypot(jx - body.x, jy - body.y);
        if (d < 650 || d > 1400 || !inCityGrid(jx, jy) || !landAt(jx, jy)) continue;
        const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        const a = dirs[Math.floor(seededRandom() * 4)],
          x = jx - Math.cos(a) * 150,
          y = jy - Math.sin(a) * 150;
        if (crowdInView(x, y, 160) || !cityStreetAt(x, y) || !groundAt(x, y, 20) || solid(x, y, 16)) continue;
        if (!canSpawnCar('ambulance', x, y, a, 8)) continue;
        return { x, y, a, junction: { x: jx, y: jy } };
      }
      return null;
    }
    /* Send an ambulance to `body`; false when no route or start was found. */
    function dispatchMedics(body) {
      const plan = medicStopFor(body),
        start = medicStartFor(body);
      if (!start) return false;
      const route = copRoute({ x: start.junction.x, y: start.junction.y, pursuitTarget: plan.junction }, plan.junction),
        last = route.length ? route[route.length - 1] : start.junction;
      // The route must end at the body's own junction, or the last leg would cut a block.
      if (Math.abs(last.x - plan.junction.x) > 4 || Math.abs(last.y - plan.junction.y) > 4) return false;
      const c = makeCar('ambulance', start.x, start.y, start.a, true, VEHICLE_DEFINITIONS.ambulance.color);
      Object.assign(c, { speed: 40 * KMH, occupied: true, locked: true, countyIndex: 0 });
      // A point well past the stop keeps it heading on down the street while the
      // stop brakes it (emergencyRunControl, driveMedicJob).
      const beyond = { x: plan.stop.x + Math.cos(plan.heading) * 400, y: plan.stop.y + Math.sin(plan.heading) * 400 };
      c.countyRoute = [
        { x: start.junction.x, y: start.junction.y },
        ...route.filter((p) => Math.abs(p.x - start.junction.x) > 4 || Math.abs(p.y - start.junction.y) > 4),
        plan.stop,
        beyond,
      ];
      const job = {
        body,
        ambulance: c,
        stop: plan.stop,
        heading: plan.heading,
        phase: 'driving',
        startedAt: gameTime,
        phaseAt: gameTime,
        stuckFor: 0,
        medics: [],
        outcome: null,
        revivable: gameTime - (body.deadTime || 0) < MEDIC_REVIVE_AGE && seededRandom() < 0.75,
      };
      c.emergency = { running: true, job };
      body.medicSeen = true;
      medicService.job = job;
      medicService.jobs++;
      return true;
    }
    function medicJobEnd(job, why) {
      const c = job.ambulance;
      if (c && vehicles.includes(c) && c !== player.car) {
        // Back into the traffic, lamps off (livingcity-traffic.js may stream it away).
        c.emergency = null;
        c.countyRoute = null;
        c.junction = null;
        c.navAngle = undefined;
        c.aiControl = null;
        if (c.hp > 0) Object.assign(c, { ai: true, occupied: true, locked: true, streamed: true });
      } else if (c) c.emergency = null;
      for (const p of job.medics)
        if (p.cityRole?.job === job) {
          p.cityRole = null;
          p.pose = null;
        }
      if (why === 'aborted') medicService.aborted++;
      medicService.last = { why, outcome: job.outcome, seconds: Math.round(gameTime - job.startedAt) };
      medicService.job = null;
      medicService.cooldownUntil = gameTime + MEDIC_COOLDOWN;
    }
    /* The drive in: brake for the stop along the last leg, get past a jam out of
       sight, give up after a minute and a half. */
    function driveMedicJob(job, deltaSeconds) {
      const c = job.ambulance,
        route = c.countyRoute,
        index = c.countyIndex || 0,
        speed = Math.hypot(c.vx || 0, c.vy || 0);
      // The last leg to the stop, then the run on past it (index wrapping to 0
      // after that would turn it round): measured along the street once on it.
      const last = route && index >= route.length - 2,
        along = (job.stop.x - c.x) * Math.cos(job.heading) + (job.stop.y - c.y) * Math.sin(job.heading),
        left = !last ? Infinity : index === route.length - 1 ? Math.max(0, along) : Math.hypot(job.stop.x - c.x, job.stop.y - c.y);
      if (last) {
        const limit = Math.sqrt(2 * 30 * Math.max(0, left - 4));
        if (speed > limit && speed > 0.01) {
          c.vx *= limit / speed;
          c.vy *= limit / speed;
          c.speed = Math.sign(c.speed || 1) * Math.min(Math.abs(c.speed || 0), limit);
        }
      }
      job.stuckFor = speed < 3 && left > 40 ? job.stuckFor + deltaSeconds : 0;
      if (
        (job.stuckFor > 8 || gameTime - job.startedAt > 70) &&
        !crowdInView(c.x, c.y, 120) &&
        !crowdInView(job.stop.x, job.stop.y, 60) &&
        canSpawnCar('ambulance', job.stop.x, job.stop.y, job.heading, 4)
      ) {
        Object.assign(c, { x: job.stop.x, y: job.stop.y, a: job.heading, vx: 0, vy: 0, speed: 0 });
        return arriveMedicJob(job);
      }
      // Boxed in for good where everyone can see: it gives up and drives on.
      if (gameTime - job.startedAt > 90 || job.stuckFor > 35) return medicJobEnd(job, 'aborted');
      if (left < 8 || (left < 40 && speed < 4)) arriveMedicJob(job);
    }
    function arriveMedicJob(job) {
      const c = job.ambulance;
      Object.assign(c, { ai: false, countyRoute: null, vx: 0, vy: 0, av: 0, speed: 0, braking: true, occupied: false, locked: false });
      c.emergency.running = false;
      c.doorsOpenAt = gameTime;
      job.phase = 'scene';
      job.phaseAt = gameTime;
      // Out on the victim's side (the cab door and the side door), so nobody has
      // to walk round the ambulance to reach them.
      const spec = vehicleSpec(c),
        toBody = -(job.body.x - c.x) * Math.sin(c.a) + (job.body.y - c.y) * Math.cos(c.a),
        side = toBody >= 0 ? 1 : -1;
      job.side = side;
      for (let i = 0; i < 2; i++) {
        const back = i ? -spec.l * 0.3 : spec.l * 0.15,
          out = side * (spec.w / 2 + 7);
        let x = c.x + Math.cos(c.a) * back - Math.sin(c.a) * out,
          y = c.y + Math.sin(c.a) * back + Math.cos(c.a) * out;
        if (solid(x, y, 5)) {
          x = c.x + Math.cos(c.a) * -(spec.l / 2 + 8);
          y = c.y + Math.sin(c.a) * -(spec.l / 2 + 8);
        }
        const m = { x, y, a: c.a + (side * Math.PI) / 2, dir: c.a, hp: 30, flee: 0, timer: 999, walk: 0, state: 'idle', stateTime: 900 };
        dressPerson(m, 'casual');
        // Whites over navy trousers, a kit bag for the one who works on the victim.
        Object.assign(m.look, { top: '#eef1f2', pants: '#243b5a', shoes: '#17191d', skirt: false, hat: 0, backpack: false, umbrella: null, sleeves: true });
        m.color = m.look.top;
        m.carry = i ? null : 'briefcase';
        m.texting = false;
        m.nerve = 0.9;
        m.bodySeen = job.body;
        m.cityRole = { kind: 'medic', job, index: i };
        pedestrians.push(m);
        job.medics.push(m);
      }
      medicSay(job.medics[0], 'arrive');
    }
    /* The scene: kneel and work, radio in, the outcome, back to the ambulance. */
    function updateMedicScene(job) {
      const c = job.ambulance,
        body = job.body,
        t = gameTime - job.phaseAt,
        working = job.medics.filter((m) => m.hp > 0 && m.cityRole?.job === job);
      if (!working.length) return medicJobEnd(job, 'aborted');
      // Scared off and never back, or held up for good: they call it a day.
      if (gameTime - job.startedAt > 150) return medicJobEnd(job, 'timeout');
      if (job.phase === 'scene' && working.some((m) => m.cityRole.at)) {
        job.phase = 'treat';
        job.phaseAt = gameTime;
      } else if (job.phase === 'treat' && t > 9) {
        job.phase = 'outcome';
        job.phaseAt = gameTime;
        const medic = working[0];
        if (job.revivable && body.hp <= 0 && pedestrians.includes(body)) {
          reviveBody(body, medic);
          job.outcome = 'revived';
          medicService.revived++;
          medicSay(medic, 'revived');
        } else {
          job.outcome = 'lost';
          medicService.lost++;
          medicSay(medic, 'lost');
        }
      } else if (job.phase === 'outcome' && t > 4.5) {
        job.phase = 'leave';
        job.phaseAt = gameTime;
        for (const m of working) Object.assign(m.cityRole, { stall: 0, checkD: undefined });
        medicSay(working[working.length - 1], 'leave');
      } else if (job.phase === 'leave' && (working.every((m) => m.cityRole.boarded) || t > 30)) {
        for (const m of job.medics) {
          const i = pedestrians.indexOf(m);
          if (i >= 0 && m.cityRole?.boarded) pedestrians.splice(i, 1);
        }
        c.doorsOpenAt = 0;
        medicJobEnd(job, 'done');
      }
    }
    /* The victim comes round: down a moment longer, then up and away, shaken. */
    function reviveBody(body, medic) {
      Object.assign(body, { hp: 30, injured: true, knockedFor: 2.4, deathStyle: null, pending: null, react: null, killedBy: body.killedBy });
      body.deadTime = undefined;
      body.threat = { x: body.x, y: body.y };
      body.revivedAt = gameTime;
      medicSay(body, 'victim', 3.2);
      if (medic) body.a = headingBetween(body, medic);
    }
    /* A paramedic's own step (updatePeople, after perception): walk to their
       place by the victim, work there, walk back and climb in. A reaction (a
       gunshot, the player's gun) takes over until it ends. */
    function updateCityRolePerson(p, deltaSeconds) {
      const role = p.cityRole;
      if (!role || p.react || p.flee > 0 || p.hp <= 0) return false;
      // A thief closing on his mark (livingcity-events.js); a victim walks on as anyone.
      if (role.kind === 'thief') return updateThief(p, deltaSeconds);
      if (role.kind !== 'medic') return false;
      const job = role.job;
      if (medicService.job !== job) {
        p.cityRole = null;
        return false;
      }
      const body = job.body,
        c = job.ambulance;
      let spot;
      if (job.phase === 'leave') {
        if (role.boarded) {
          p.walking = false;
          p.pose = null;
          return true;
        }
        // Back to their door on the victim's side.
        const spec = vehicleSpec(c),
          back = role.index ? -spec.l * 0.3 : spec.l * 0.15,
          out = (job.side || 1) * (spec.w / 2 + 6);
        spot = { x: c.x + Math.cos(c.a) * back - Math.sin(c.a) * out, y: c.y + Math.sin(c.a) * back + Math.cos(c.a) * out };
      } else {
        // The one who works kneels at the victim's side; the other stands off
        // toward the ambulance with the radio.
        const away = headingBetween(body, c);
        spot = role.index
          ? { x: body.x + Math.cos(away + 0.5) * 20, y: body.y + Math.sin(away + 0.5) * 20 }
          : { x: body.x + Math.cos(away) * 8, y: body.y + Math.sin(away) * 8 };
      }
      const d = Math.hypot(spot.x - p.x, spot.y - p.y);
      // Getting nowhere (a wall, a parked car, a body against a shopfront): every
      // 1.5 s the distance must drop by 4 units; twice not, and they work from
      // where they stand (or climb in from there).
      if (gameTime - (role.checkAt ?? -9) > 1.5) {
        role.stall = role.checkD !== undefined && role.checkD - d < 4 && d > 3 ? (role.stall || 0) + 1 : 0;
        role.checkD = d;
        role.checkAt = gameTime;
      }
      const stalled = role.stall >= 2 && (job.phase === 'leave' || d < 30);
      if (d > 3 && !stalled && !(role.at && job.phase !== 'leave' && d < 12)) {
        p.pose = null;
        if (crowdStep(p, headingBetween(p, spot), Math.min(d / deltaSeconds, 7 * KMH), deltaSeconds)) {
          // A wall or a car in the way: sidestep round it.
          crowdStep(p, headingBetween(p, spot) + (role.index ? 1.2 : -1.2), 5 * KMH, deltaSeconds);
        }
        if (job.phase === 'leave' && d < 16) role.boarded = true;
        return true;
      }
      p.walking = false;
      if (job.phase === 'leave') {
        role.boarded = true;
        return true;
      }
      if (!role.at) {
        role.at = gameTime;
        if (role.index) medicSay(p, 'radio');
      }
      p.a = headingBetween(p, body);
      if (job.phase === 'treat' || job.phase === 'scene') {
        p.pose = role.index ? 'phone' : 'help';
        if (!role.index && gameTime - (role.saidAt ?? -9) > 4) {
          role.saidAt = gameTime;
          medicSay(p, 'work', 2.4);
        }
      } else p.pose = null;
      return true;
    }
    function updateMedics(deltaSeconds) {
      const job = medicService.job;
      if (job) {
        const c = job.ambulance;
        // Taken by the player, wrecked, gone, or the player left the area: the job is off.
        if (
          !vehicles.includes(c) ||
          c === player.car ||
          c.hp < c.maxhp * 0.5 ||
          Math.abs(job.body.x - player.x) > 2200 ||
          Math.abs(job.body.y - player.y) > 2200 ||
          mission
        )
          return medicJobEnd(job, 'aborted');
        if (job.phase === 'driving') driveMedicJob(job, deltaSeconds);
        else updateMedicScene(job);
        return;
      }
      medicService.timer -= deltaSeconds;
      if (medicService.timer > 0) return;
      medicService.timer = 1;
      if (gameMode !== 'play' || mission || wantedStars > 1 || gameTime < medicService.cooldownUntil) return;
      let best = null,
        bestD = Infinity;
      for (const p of pedestrians) {
        if (!medicBodyCandidate(p)) continue;
        const d = Math.abs(p.x - player.x) + Math.abs(p.y - player.y);
        if (d < bestD && medicStreetCalm(p.x, p.y)) {
          best = p;
          bestD = d;
        }
      }
      if (best && !dispatchMedics(best)) best.medicTries = (best.medicTries || 0) + 1;
      if (best && best.medicTries > 3) best.medicSeen = true;
    }
    function medicBlocker(c) {
      let best = null;
      for (const o of vehicles) {
        if (o === c) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y,
          along = dx * Math.cos(c.a) + dy * Math.sin(c.a),
          lateral = -dx * Math.sin(c.a) + dy * Math.cos(c.a);
        if (along > 0 && along < 240 && Math.abs(lateral) < 30 && (!best || along < best.along))
          best = { type: o.type, along: Math.round(along), lateral: Math.round(lateral), kmh: Math.round(Math.hypot(o.vx || 0, o.vy || 0) / KMH), ai: !!o.ai };
      }
      return best;
    }
    /* Developer console: the ambulance service. */
    function medicReport() {
      const job = medicService.job,
        c = job?.ambulance,
        round = (v) => Math.round(v);
      return {
        jobs: medicService.jobs,
        revived: medicService.revived,
        lost: medicService.lost,
        aborted: medicService.aborted,
        last: medicService.last,
        cooldown: Math.max(0, +(medicService.cooldownUntil - gameTime).toFixed(1)),
        job: job
          ? {
              phase: job.phase,
              seconds: +(gameTime - job.startedAt).toFixed(1),
              outcome: job.outcome,
              revivable: job.revivable,
              body: { x: round(job.body.x), y: round(job.body.y), hp: round(job.body.hp) },
              stop: { x: round(job.stop.x), y: round(job.stop.y) },
              ambulance: c ? { x: round(c.x), y: round(c.y), kmh: round(Math.hypot(c.vx || 0, c.vy || 0) / KMH), d: round(distanceBetween(c, job.stop)), siren: !!c.emergency?.running, leg: c.countyIndex || 0, legs: c.countyRoute?.length || 0 } : null,
              medics: job.medics.map((m) => ({ x: round(m.x), y: round(m.y), d: round(distanceBetween(m, job.body)), pose: m.pose || null, react: m.react?.kind || null, boarded: !!m.cityRole?.boarded })),
              stuckFor: +job.stuckFor.toFixed(1),
              // The ambulance's wanted speed and whatever stands nearest ahead of it.
              desiredKmh: c?.aiControl ? Math.round(c.aiControl.desired / KMH) : null,
              ahead: c ? medicBlocker(c) : null,
            }
          : null,
      };
    }
