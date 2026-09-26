    // Off-road club lot: vehicles, colliders, ground, club talk and scenes, the hill climb.
    /* ---- The lot: vehicles, colliders, ground ---------------------------------------- */
    const clubState = {
      slots: [],
      scene: null,
      talkClock: 4,
      theftTold: 0,
      armed: -1,
      climb: null,
      last: null,
      records: null,
      respawnClock: 5,
    };
    function parkClubVehicle(i) {
      const [u, v, type, color] = OFFROAD_CLUB.slots[i],
        p = clubPoint(u, v),
        c = makeCar(type, p.x, p.y, OFFROAD_CLUB.heading, false, color);
      c.clubSlot = i;
      c.vx = c.vy = 0;
      clubState.slots[i] = c;
      return c;
    }
    function populateOffroadClub() {
      for (let i = 0; i < OFFROAD_CLUB.slots.length; i++) parkClubVehicle(i);
      // The members' own rigs, parked in the second row.
      for (const [u, v, type, color, heading] of OFFROAD_CLUB.memberCars) {
        const p = clubPoint(u, v);
        if (canSpawnCar(type, p.x, p.y, heading, 2)) makeCar(type, p.x, p.y, heading, false, color);
      }
    }
    function addOffroadClubColliders() {
      const l = OFFROAD_CLUB.lot;
      // Log rails stop vehicles only (people step over them).
      for (const [u0, v0, u1, v1] of OFFROAD_CLUB.rails) {
        const x = l.x + Math.min(u0, u1) - 2,
          y = l.y + Math.min(v0, v1) - 2;
        addStatic(x, y, Math.abs(u1 - u0) + 4, Math.abs(v1 - v0) + 4, 4, 'rail');
      }
      // The gate posts (the carved sign spans the lane between them, 5.5 m up).
      const g = OFFROAD_CLUB.gate;
      for (const u of [g.u0, g.u1]) {
        const p = clubPoint(u, g.v);
        addStatic(p.x - 3, p.y - 3, 6, 6, 60, 'gate post');
      }
      // The veranda's posts, the stone fire pit, the BBQ and the smoker in the yard.
      const d = OFFROAD_CLUB.deck;
      for (const x of clubDeckPosts()) addStatic(x - 1.6, d.y + d.h - 4, 3.2, 3.2, 50, 'post');
      for (const [x0, x1] of OFFROAD_CLUB.deckRail) addStatic(x0, d.y + d.h - 3.5, x1 - x0, 2, 8, 'rail');
      const f = OFFROAD_CLUB.fire;
      addStatic(f.x - 7, f.y - 7, 14, 14, 4, 'fire pit');
      for (const [p, hw, hd, h] of [
        [OFFROAD_CLUB.grill, 14, 5, 9],
        [OFFROAD_CLUB.smoker, 5, 4, 12],
      ])
        addStatic(p.x - hw, p.y - hd, hw * 2, hd * 2, h, 'grill');
      const pole = OFFROAD_CLUB.flag;
      addStatic(pole.x - 1.5, pole.y - 1.5, 3, 3, 60, 'pole');
      for (const f of OFFROAD_CLUB.furniture) if (f.kind === 'chimney') addStatic(f.x, f.y, f.w, f.h, 130, 'chimney');
    }
    // The veranda posts along the deck's front edge (map x): the renderer and the colliders share them.
    function clubDeckPosts() {
      // Paired either side of the steps in front of the doors.
      return [8563, 8601, 8639, 8662, 8698, 8729, 8759, 8787];
    }
    // The block on the county sheet (2D view, the map, and the 3D ground under
    // the renderer's gravel and yard decals): the gravel lot, the yard's grass,
    // the buildings' footprints, the tracks in from the gate; and the trailhead
    // car park where the club used to be.
    function paintOffroadClubGround(drawingContext) {
      const l = OFFROAD_CLUB.lot,
        H = OFFROAD_CLUB.house,
        S = OFFROAD_CLUB.workshop,
        p = TRAILHEAD_PARKING;
      drawingContext.save();
      drawingContext.fillStyle = '#8d7b62';
      drawingContext.fillRect(l.x - 6, l.y - 6, l.w + 12, l.h + 12);
      drawingContext.fillStyle = '#a3906f';
      drawingContext.fillRect(l.x, l.y + 196, l.w, l.h - 196);
      drawingContext.fillStyle = '#6f7d52';
      drawingContext.fillRect(l.x, l.y, 100, 196);
      drawingContext.fillStyle = '#6b5a48';
      drawingContext.fillRect(H.x, H.y, H.w, H.h);
      drawingContext.fillRect(S.x, S.y, S.w, S.h);
      drawingContext.strokeStyle = 'rgba(92,74,52,0.5)';
      drawingContext.lineWidth = 12;
      drawingContext.beginPath();
      drawingContext.moveTo(l.x + 126, l.y + l.h);
      drawingContext.quadraticCurveTo(l.x + 126, l.y + 212, l.x + 260, l.y + 206);
      drawingContext.lineTo(l.x + 400, l.y + 206);
      drawingContext.stroke();
      drawingContext.fillStyle = '#8d7b62';
      drawingContext.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
      drawingContext.fillStyle = '#a3906f';
      drawingContext.fillRect(p.x, p.y, p.w, p.h);
      drawingContext.restore();
    }
    /* ---- The members ----------------------------------------------------------------- */
    const TRAIL_CLUB_TALK = [
        'Aired down to 15 psi!',
        'Lockers engaged?',
        'Last one to the summit buys the beers.',
        'Momentum, not speed. Momentum.',
        'Stay on the crown, out of the ruts.',
        'The bog ate a Hilux last spring.',
        'She walked up the rock steps in low range.',
        'Who brought the recovery straps?',
        'Snorkel’s not for show.',
        'Thirty-sevens on stock axles? Brave.',
        'Burgers in five!',
        'That winch saved my weekend.',
        'Two-thirty to the top. Beat that.',
      ],
      TRAIL_CLUB_NIGHT = ['Stars are unreal up here.', 'Pass the lantern.', 'Night run to the summit?', 'Who’s got the marshmallows?'],
      TRAIL_CLUB_RAIN = ['Here comes the good mud!', 'The hairpin’s going to be soup.', 'Lock the hubs, boys.'],
      TRAIL_CLUB_THEFT = ['HEY! That’s my rig!', 'Somebody stop him!', 'Not the Series, she’s older than you!', 'Bring it back in one piece!'],
      TRAIL_CLUB_ROAD_CAR = ['You’re not taking THAT up the trail?', 'Road tyres? Good luck.', 'Nice car. Wrong hobby.'],
      TRAIL_CLUB_MUDDY = ['Now THAT’s a proper paint job.', 'Somebody found the bog!', 'Looks like you had fun.'];
    function clubSay(p, lines) {
      if (!p || p.hp <= 0 || (p.speechUntil || 0) > gameTime || p.react) return false;
      p.speech = randomChoice(lines);
      p.speechUntil = gameTime + 3.4;
      p.speechKind = 'club';
      p.speechKindText = p.speech;
      return true;
    }
    function stageClubScene() {
      const l = OFFROAD_CLUB.lot,
        s = makeScene('club', l.x + l.w / 2, l.y + l.h / 2);
      for (const [u, v, a, role, dress] of OFFROAD_CLUB.members) {
        const p = spawnSceneMember(s, role, { x: l.x + u, y: l.y + v, a }, dress);
        if (!p) continue;
        // Club colours: flannel, work jackets, caps.
        p.look.top = randomChoice(['#7a2e26', '#3c4f36', '#5a4632', '#2f3f52', '#8a6a35', '#a13d2d']);
        p.look.pants = randomChoice(['#3b3a35', '#4a4033', '#27303b']);
        p.look.hat = seededRandom() < 0.6 ? 1 : 0;
        p.look.hatColor = randomChoice(['#3c5b47', '#8e1f2a', '#d8d2c4', '#23272e', '#c7862e']);
        p.color = p.look.top;
        p.clubMember = true;
      }
      return s;
    }
    function updateClubScene(deltaSeconds) {
      const l = OFFROAD_CLUB.lot,
        d = Math.hypot(player.x - (l.x + l.w / 2), player.y - (l.y + l.h / 2));
      if (clubState.scene && !crowd.scenes.includes(clubState.scene)) clubState.scene = null;
      if (!clubState.scene && d < 1400) clubState.scene = stageClubScene();
      const s = clubState.scene;
      if (!s || d > 700) return;
      clubState.talkClock -= deltaSeconds;
      const members = s.members.filter((p) => p.hp > 0 && !p.react);
      if (!members.length) return;
      // Somebody drives off in a club truck.
      const car = player.car;
      if (car && car.clubSlot >= 0 && gameTime - clubState.theftTold > 20 && distanceBetween(car, clubPoint(250, 260)) < 320 && Math.abs(car.speed) > 12) {
        clubState.theftTold = gameTime;
        const shout = members.reduce((a, b) => (distanceBetween(a, car) < distanceBetween(b, car) ? a : b));
        clubSay(shout, TRAIL_CLUB_THEFT);
        shout.speechKind = 'shout';
        crime(0.6);
        clubState.talkClock = 3;
        return;
      }
      if (clubState.talkClock > 0) return;
      clubState.talkClock = randomBetween(4.5, 8);
      const hour = (worldMinutes % 1440) / 60,
        someone = randomChoice(members);
      if (car && d < 260 && car.mudCoat > 0.45) clubSay(someone, TRAIL_CLUB_MUDDY);
      else if (car && d < 260 && !vehicleSpec(car).offroad && !isAircraft(car) && !isBoat(car)) clubSay(someone, TRAIL_CLUB_ROAD_CAR);
      else if ((weather.rain || 0) > 0.2) clubSay(someone, TRAIL_CLUB_RAIN);
      else if (hour > 20.5 || hour < 5) clubSay(someone, seededRandom() < 0.5 ? TRAIL_CLUB_NIGHT : TRAIL_CLUB_TALK);
      else clubSay(someone, TRAIL_CLUB_TALK);
    }
    // A club truck taken or wrecked is replaced while nobody is looking.
    function refillClubSlots(deltaSeconds) {
      clubState.respawnClock -= deltaSeconds;
      if (clubState.respawnClock > 0) return;
      clubState.respawnClock = 6;
      const l = OFFROAD_CLUB.lot;
      if (Math.hypot(player.x - l.x - l.w / 2, player.y - l.y - l.h / 2) < 1500) return;
      OFFROAD_CLUB.slots.forEach(([u, v, type], i) => {
        const c = clubState.slots[i],
          p = clubPoint(u, v);
        if (c && vehicles.includes(c) && c.hp > 0 && distanceBetween(c, p) < 60) return;
        if (c === player.car) return;
        if (c && vehicles.includes(c) && distanceBetween(c, p) < 60) vehicles.splice(vehicles.indexOf(c), 1);
        if (canSpawnCar(type, p.x, p.y, OFFROAD_CLUB.heading, 2)) parkClubVehicle(i);
      });
    }
    /* ---- Hill climb ------------------------------------------------------------------- */
    const HILL_CLIMB_KEY = 'dead-end-city-hillclimb';
    function hillClimbRecords() {
      if (clubState.records) return clubState.records;
      try {
        clubState.records = JSON.parse(localStorage.getItem(HILL_CLIMB_KEY) || '{}') || {};
      } catch {
        clubState.records = {};
      }
      return clubState.records;
    }
    function saveHillClimbRecords() {
      try {
        localStorage.setItem(HILL_CLIMB_KEY, JSON.stringify(clubState.records));
      } catch {
        /* private window: the record lasts the session */
      }
    }
    function climbClock(seconds) {
      const m = Math.floor(seconds / 60),
        s = seconds - m * 60;
      return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
    }
    // The start gate (a few metres up the trail) and the checkpoints of a trail.
    function trailCourse(t) {
      const trail = MOUNTAIN_TRAILS[t];
      terrainField(TERRAIN_FIELDS[0]);
      if (trail.course) return trail.course;
      const sections = OFFROAD_SECTIONS[t],
        start = Math.min(8, trail.path.length - 1),
        at = (i) => ({ x: trail.path[i][0], y: trail.path[i][1], i });
      trail.course = {
        start: at(start),
        from: at(start - 3),
        checkpoints: sections.checkpoints.map((mark) => at(trailMarkIndex(trail, mark))),
        peak: trail.peak,
        target: sections.target,
      };
      return trail.course;
    }
    function startClimb(t, c, challenge) {
      clubState.climb = { trail: t, vehicle: c, start: gameTime, next: 0, splits: [], challenge, failed: null };
      if (clubState.armed === t) clubState.armed = -1;
      const course = trailCourse(t);
      tell(challenge ? 'HILL CLIMB · GO! Beat ' + climbClock(course.target) + ' to the summit' : 'CLIMB TIMER · ' + course.peak.name + ' · clock running', 3);
      tone(880, 0.12, 0.18, 'square');
    }
    function updateHillClimb() {
      const c = player.car;
      let climb = clubState.climb;
      if (climb && (c !== climb.vehicle || !c || c.hp <= 0)) {
        if (climb.challenge) tell('HILL CLIMB ABANDONED', 2.5);
        climb = clubState.climb = null;
      }
      if (!c || isAircraft(c) || isBoat(c) || vehicleSpec(c).bicycle) return;
      for (let t = 0; t < MOUNTAIN_TRAILS.length && !climb; t++) {
        const course = trailCourse(t),
          gate = course.start;
        if (Math.hypot(c.x - gate.x, c.y - gate.y) > 34) continue;
        const dx = gate.x - course.from.x,
          dy = gate.y - course.from.y,
          up = ((c.vx || 0) * dx + (c.vy || 0) * dy) / Math.hypot(dx, dy);
        if (up > 3 * KMH) {
          startClimb(t, c, clubState.armed === t);
          climb = clubState.climb;
        }
      }
      if (!climb) return;
      const course = trailCourse(climb.trail),
        cp = course.checkpoints[climb.next];
      if (cp && Math.hypot(c.x - cp.x, c.y - cp.y) < 44) {
        climb.splits.push(gameTime - climb.start);
        climb.next++;
        tell('CHECKPOINT ' + climb.next + ' / ' + course.checkpoints.length + ' · ' + climbClock(gameTime - climb.start), 1.8);
        tone(660 + climb.next * 110, 0.08, 0.14, 'triangle');
      }
      // Back down at the start: the run is off.
      if (climb.next === 0 && Math.hypot(c.x - course.from.x, c.y - course.from.y) < 20 && gameTime - climb.start > 3) {
        if (climb.challenge) clubState.armed = climb.trail;
        clubState.climb = null;
      }
    }
    // terrain.js calls this when the player's vehicle reaches a summit.
    function offroadSummit(c, peak) {
      const climb = clubState.climb,
        t = MOUNTAIN_TRAILS.findIndex((trail) => trail.peak === peak);
      if (!climb || climb.trail !== t) {
        // No clock running (driven up some other way): the view is the reward.
        if (!c.summits?.includes(peak.name)) {
          c.summits = c.summits || [];
          c.summits.push(peak.name);
          announce('SUMMIT REACHED', peak.name, 4);
        }
        return;
      }
      const course = trailCourse(t),
        time = gameTime - climb.start,
        clean = climb.next >= course.checkpoints.length,
        records = hillClimbRecords(),
        best = records[peak.name];
      clubState.climb = null;
      c.summits = c.summits || [];
      if (!c.summits.includes(peak.name)) c.summits.push(peak.name);
      let note;
      if (!clean) note = 'MISSED ' + (course.checkpoints.length - climb.next) + ' CHECKPOINT' + (course.checkpoints.length - climb.next > 1 ? 'S' : '') + ' · NO RECORD';
      else if (best === undefined || time < best) {
        records[peak.name] = +time.toFixed(2);
        saveHillClimbRecords();
        note = best === undefined ? 'FIRST CLEAN RUN · RECORD SET' : 'NEW RECORD · ' + climbClock(best - time) + ' FASTER';
      } else note = 'BEST ' + climbClock(best);
      announce('SUMMIT REACHED', peak.name + ' · ' + climbClock(time), 6);
      if (climb.challenge) {
        if (clean && time <= course.target) {
          cash += 1000;
          tell('HILL CLIMB WON · ' + climbClock(time) + ' · $1,000 · ' + note, 7);
        } else tell('HILL CLIMB · ' + (clean ? climbClock(time) + ' is over ' + climbClock(course.target) : note) + ' · try again at the club', 6);
      } else tell(note, 5);
      clubState.last = { peak: peak.name, time: +time.toFixed(2), clean, challenge: climb.challenge, splits: climb.splits.map((s) => +s.toFixed(2)) };
      tone(523, 0.14, 0.2, 'triangle');
      tone(784, 0.3, 0.2, 'triangle');
    }
    // The running clock on screen (made on first use; hidden off the trail).
    let climbHud = null;
    function updateClimbHud() {
      const climb = clubState.climb,
        show = gameMode === 'play' && (!!climb || clubState.armed >= 0);
      if (!climbHud) {
        if (!show) return;
        climbHud = document.createElement('div');
        climbHud.id = 'hillClimbHud';
        climbHud.style.cssText =
          'position:fixed;left:50%;top:78px;transform:translateX(-50%);z-index:30;pointer-events:none;' +
          'padding:7px 16px;border-radius:7px;background:rgba(14,16,19,0.74);border:1px solid rgba(233,190,120,0.45);' +
          'color:#f6ead0;font:700 14px/1.25 system-ui,"Segoe UI",Arial,sans-serif;letter-spacing:0.08em;text-align:center;' +
          'text-shadow:0 1px 2px #000;white-space:nowrap';
        document.body.appendChild(climbHud);
      }
      climbHud.style.display = show ? 'block' : 'none';
      if (!show) return;
      if (!climb) {
        climbHud.textContent = 'HILL CLIMB ARMED · CROSS THE START GATE AT THE TRAILHEAD';
        return;
      }
      const course = trailCourse(climb.trail),
        time = gameTime - climb.start,
        best = hillClimbRecords()[course.peak.name],
        over = climb.challenge && time > course.target;
      climbHud.style.color = over ? '#ff9a7a' : '#f6ead0';
      climbHud.textContent =
        (climb.challenge ? 'HILL CLIMB ' : 'CLIMB ') +
        climbClock(time) +
        (climb.challenge ? ' / ' + climbClock(course.target) : '') +
        ' · CP ' + climb.next + '/' + course.checkpoints.length +
        (best !== undefined ? ' · BEST ' + climbClock(best) : '') +
        (player.car?.lowRange ? ' · 4LO' : '');
    }
    /* ---- Interaction ------------------------------------------------------------------ */
    function nearClubSign() {
      const s = OFFROAD_CLUB.sign;
      return withinRange('club-sign', Math.hypot(player.x - s.x, player.y - (s.y + 40)), 120, 150);
    }
    function offroadClubUI() {
      if (gameMode !== 'play' || !nearClubSign()) return;
      const c = player.car,
        best = hillClimbRecords()['MOUNT ASCENT'];
      if (!c) offerPrompt('4X4 CLUB · HILL CLIMB · TAKE A TRUCK', { key: null, id: 'club-hillclimb-foot' });
      else if (isAircraft(c) || isBoat(c) || vehicleSpec(c).bicycle) return;
      else if (clubState.armed === 0) offerPrompt('HILL CLIMB ARMED · START GATE AT THE MOUNT ASCENT TRAILHEAD', { key: null, id: 'club-hillclimb-armed' });
      else offerPrompt('HILL CLIMB · BEAT 2:30' + (best !== undefined ? ' · BEST ' + climbClock(best) : ''), { id: 'club-hillclimb' });
    }
    function offroadClubInteract() {
      const c = player.car;
      if (!c || isAircraft(c) || isBoat(c) || vehicleSpec(c).bicycle || !nearClubSign() || clubState.armed === 0) return false;
      clubState.armed = 0;
      clubState.climb = null;
      // The start gate is up Eagle Pass at the Mount Ascent trailhead (about 200 m
      // by road from the club): the GPS takes the player there.
      const gate = trailCourse(0).start;
      setWaypoint(gate.x, gate.y);
      tell('HILL CLIMB · Mount Ascent · drive up Eagle Pass to the trailhead: the clock starts at the gate. Beat 2:30 for $1,000.', 7);
      tone(520, 0.1, 0.16, 'triangle');
      return true;
    }
    /* ---- Per frame -------------------------------------------------------------------- */
    function updateOffroad(deltaSeconds) {
      if (deltaSeconds <= 0) return;
      for (const c of vehicles) {
        if (c.mudCoat > 0 || c.surfaceMud > 0.05 || (c === player.car && c.offroadState))
          if (c === player.car || (Math.abs(c.x - player.x) < 1200 && Math.abs(c.y - player.y) < 1200)) updateBodyMud(c, deltaSeconds);
      }
      updateHillClimb();
      updateClimbHud();
      updateClubScene(deltaSeconds);
      refillClubSlots(deltaSeconds);
    }
    /* ---- Console ---------------------------------------------------------------------- */
    function offroadReport() {
      const l = OFFROAD_CLUB.lot,
        roadClear = Math.round(
          Math.min(
            ...COUNTY_ROADS.flatMap((r) =>
              r.points.map((p, i) => {
                if (!i) return Infinity;
                let d = Infinity;
                for (const [x, y] of [[l.x, l.y], [l.x + l.w, l.y], [l.x, l.y + l.h], [l.x + l.w, l.y + l.h], [l.x + l.w / 2, l.y]])
                  d = Math.min(d, segmentDistance(x, y, r.points[i - 1], p));
                return d - r.width / 2;
              }),
            ),
          ),
        ),
        trailClear = Math.round(
          Math.min(...MOUNTAIN_TRAILS.flatMap((t) => t.points.map((p, i) => (i ? segmentDistance(l.x + l.w / 2, l.y, t.points[i - 1], p) - t.width / 2 : Infinity)))),
        ),
        c = player.car,
        s = c ? offroadSurfaceAt(c.x, c.y, { ...offroadSurface }) : null;
      let padLevel = 0;
      for (let u = 0; u <= l.w; u += 29) for (let v = 0; v <= l.h; v += 32) padLevel = Math.max(padLevel, terrainHeight(l.x + u, l.y + v));
      return {
        club: { town: OFFROAD_CLUB.town, lot: l, house: OFFROAD_CLUB.house, workshop: OFFROAD_CLUB.workshop, sign: OFFROAD_CLUB.sign, walls: clubWalls().length, trailhead: TRAILHEAD_PARKING, padMaxHeight: +padLevel.toFixed(2), roadClearance: roadClear, trailClearance: trailClear },
        vehicles: OFFROAD_CLUB.slots.map(([, , type], i) => {
          const spec = VEHICLE_DEFINITIONS[type],
            v = clubState.slots[i];
          return {
            type,
            name: spec.name,
            lengthM: +(spec.l / OFFROAD_M).toFixed(2),
            widthM: +(spec.w / OFFROAD_M).toFixed(2),
            massT: spec.mass,
            topKmh: spec.topKmh,
            zeroTo: spec.zeroTo,
            tyre: spec.tyre,
            drive: spec.drive,
            lowRange: !!spec.lowRange,
            parked: !!v && vehicles.includes(v),
            id: v?.id,
          };
        }),
        members: clubState.scene ? clubState.scene.members.map((p) => ({ role: p.sceneRole, pose: p.pose, speech: p.speechUntil > gameTime ? p.speech : null })) : [],
        player: c
          ? {
              type: c.type,
              kmh: +(Math.abs(c.speed) / KMH).toFixed(1),
              wheelKmh: +((Math.abs(c.speed) + c.spinSpeed) / KMH).toFixed(1),
              wheelSpin: +c.wheelSpin.toFixed(2),
              lowRange: c.lowRange,
              mud: +s.mud.toFixed(2),
              rock: +s.rock.toFixed(2),
              across: +s.across.toFixed(2),
              trailSample: s.seg,
              grade: c.offroadState ? +c.offroadState.along.toFixed(3) : 0,
              height: +terrainHeight(c.x, c.y).toFixed(1),
              mudCoat: +c.mudCoat.toFixed(3),
              mudWet: +c.mudWet.toFixed(2),
            }
          : null,
        climb: clubState.climb
          ? { trail: MOUNTAIN_TRAILS[clubState.climb.trail].name, seconds: +(gameTime - clubState.climb.start).toFixed(2), next: clubState.climb.next, challenge: clubState.climb.challenge }
          : null,
        armed: clubState.armed,
        last: clubState.last,
        records: { ...hillClimbRecords() },
        courses: MOUNTAIN_TRAILS.map((t, i) => {
          const course = trailCourse(i);
          return { trail: t.name, start: [Math.round(course.start.x), Math.round(course.start.y)], checkpoints: course.checkpoints.map((p) => [Math.round(p.x), Math.round(p.y), p.i]), hairpins: t.hairpins.map(([x, y]) => [Math.round(x), Math.round(y)]), target: course.target };
        }),
        wet: +(weather.wet || 0).toFixed(2),
        effects: city3D ? city3D.offroadInfo() : null,
      };
    }
    // Every club truck side by side facing south (the camera), for a close look.
    function clubLineup(x = player.x, y = player.y + 60) {
      const types = Object.keys(OFFROAD_TYPES),
        ids = [];
      types.forEach((type, i) => {
        const c = makeCar(type, x + (i - (types.length - 1) / 2) * 30, y, Math.PI / 2 - 0.5, false);
        c.vx = c.vy = 0;
        ids.push(c.id);
      });
      return ids;
    }
    /*
     * TRAIL PILOT (console): drives the player's vehicle up a trail through the
     * real physics and controls (keys, 30 steps a second, no drawing), following
     * the graded path with a look-ahead, easing off before the hairpins and
     * holding at most `maxKmh`. Reports how far it got, the time, the wheelspin,
     * and why it stopped (the summit, stuck, time). `keysHeld` go in as extra
     * keys (e.g. Space).
     */
    function trailPilot(seconds = 240, maxKmh = 40, t = 0) {
      const c = player.car,
        trail = MOUNTAIN_TRAILS[t],
        path = trail.path,
        n = path.length - 1;
      if (!c) return null;
      let idx = 0,
        best = 0,
        bestAt = 0,
        time = 0,
        spinSum = 0,
        slid = 0,
        maxSpeed = 0,
        reason = 'time',
        lastProgress = 0,
        stall = 0,
        backing = 0;
      // Start from the nearest sample.
      let nearest = Infinity;
      for (let i = 0; i <= n; i++) {
        const d = Math.hypot(path[i][0] - c.x, path[i][1] - c.y);
        if (d < nearest) {
          nearest = d;
          idx = i;
        }
      }
      best = idx;
      const dt = 1 / 30;
      for (; time < seconds; time += dt) {
        if (player.car !== c || c.hp <= 0) {
          reason = 'lost vehicle';
          break;
        }
        // Advance along the path while the next samples are closer.
        for (let k = 0; k < 6 && idx < n; k++) {
          const here = Math.hypot(path[idx][0] - c.x, path[idx][1] - c.y),
            next = Math.hypot(path[idx + 1][0] - c.x, path[idx + 1][1] - c.y);
          if (next <= here + 2) idx++;
          else break;
        }
        if (idx > best) {
          best = idx;
          bestAt = time;
        }
        if (idx >= n - 2 || distanceBetween(c, trail.peak) < 40) {
          reason = 'summit';
          break;
        }
        if (time - bestAt > 12) {
          reason = 'stuck';
          break;
        }
        const speed = c.speed || 0,
          kmh = speed / KMH,
          heading = (i) => Math.atan2(path[Math.min(n, i + 1)][1] - path[Math.min(n, i)][1], path[Math.min(n, i + 1)][0] - path[Math.min(n, i)][0]),
          // In a hairpin, follow the line closely (a long look cuts across the bank inside it).
          tight = Math.abs(normalizeAngle(heading(idx + 6) - heading(idx))) > 1.1,
          look = Math.min(n, idx + (tight ? 2 : 4 + Math.floor(Math.max(0, kmh) / 8))),
          [tx, ty] = path[look],
          err = normalizeAngle(Math.atan2(ty - c.y, tx - c.x) - c.a);
        // Ease off in time for the bends ahead: the sharpest heading change within
        // braking reach (farther ahead at speed).
        let bend = 0;
        const h0 = heading(idx),
          reach = 6 + Math.floor(Math.max(0, kmh) / 2.5);
        for (let j = idx + 1; j <= Math.min(n - 1, idx + reach); j++) bend = Math.max(bend, Math.abs(normalizeAngle(heading(j) - h0)));
        const desired = Math.min(maxKmh, bend > 2.2 ? 9 : bend > 1.3 ? 14 : bend > 0.6 ? 24 : maxKmh);
        // Wedged (nose in a bank past a hairpin): back off a moment on opposite lock.
        stall = keys.KeyW && Math.abs(kmh) < 1 && c.wheelSpin < 0.3 ? stall + dt : 0;
        if (stall > 1.5) backing = 1.4;
        // Facing away from the line (overshot a hairpin): a three-point turn.
        if (backing <= 0 && Math.abs(err) >= 1.5 && Math.abs(kmh) < 6) backing = 1.2;
        if (backing > 0) {
          backing -= dt;
          keys.KeyW = false;
          keys.KeyS = true;
          keys.KeyD = err < 0;
          keys.KeyA = err > 0;
        } else {
          keys.KeyW = kmh < desired && Math.abs(err) < 1.6;
          keys.KeyS = kmh > desired + 8 || (Math.abs(err) >= 1.6 && kmh > 4);
          keys.KeyD = err > 0.05;
          keys.KeyA = err < -0.05;
        }
        if (speed < -2 * KMH && keys.KeyW) slid += -speed * dt;
        spinSum += c.wheelSpin * dt;
        maxSpeed = Math.max(maxSpeed, kmh);
        update(dt);
        if (idx !== lastProgress) lastProgress = idx;
      }
      keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false;
      return {
        reason,
        seconds: +time.toFixed(1),
        sample: best,
        of: n,
        progress: +(best / n).toFixed(3),
        height: Math.round(terrainHeight(c.x, c.y)),
        meanSpin: +(spinSum / Math.max(time, 1)).toFixed(2),
        slidBackM: +worldMeters(slid).toFixed(1),
        maxKmh: Math.round(maxSpeed),
        hp: Math.round(c.hp),
        mudCoat: +c.mudCoat.toFixed(2),
        last: clubState.last,
      };
    }
    // The graded path of a trail with its mud and rock, every `step` samples (console).
    function trailProfile(t = 0, step = 4) {
      const trail = MOUNTAIN_TRAILS[t],
        out = [],
        s = { ...offroadSurface };
      for (let i = 0; i < trail.path.length; i += step) {
        const [x, y] = trail.path[i],
          j = Math.min(trail.path.length - 1, i + step),
          run = Math.hypot(trail.path[j][0] - x, trail.path[j][1] - y) || 1;
        offroadSurfaceAt(x, y, s);
        out.push([i, Math.round(x), Math.round(y), +terrainHeight(x, y).toFixed(1), +((terrainHeight(...trail.path[j]) - terrainHeight(x, y)) / run).toFixed(3), +s.mud.toFixed(2), +s.rock.toFixed(2)]);
      }
      return out;
    }
    // Place the player's vehicle at a trail's start gate (or a checkpoint), facing up the trail.
    function hillClimbConsole(action = 'state', t = 0) {
      const course = trailCourse(t);
      if (action === 'arm') {
        clubState.armed = t;
        clubState.climb = null;
      } else if (action === 'reset') {
        clubState.armed = -1;
        clubState.climb = null;
      } else if (action === 'clear') {
        clubState.records = {};
        saveHillClimbRecords();
      } else if (action === 'gate' || action.startsWith?.('cp')) {
        const c = player.car,
          point = action === 'gate' ? course.from : course.checkpoints[+action.slice(2)] || course.from,
          path = MOUNTAIN_TRAILS[t].path,
          next = path[Math.min(path.length - 1, point.i + 2)];
        if (c) {
          c.x = point.x;
          c.y = point.y;
          c.a = Math.atan2(next[1] - point.y, next[0] - point.x);
          c.vx = c.vy = c.av = 0;
          c.speed = 0;
          player.x = c.x;
          player.y = c.y;
        }
      }
      return offroadReport();
    }
