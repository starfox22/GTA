    // The beach cast: slots and hours, populateBeach, time-of-day density, updateBeach and each kind's behaviour (beachBehave).
    /**
     * THE CAST
     * A slot per person. `hours` is when that kind of person is on the beach at
     * all; `threshold` is how busy it has to be before this one turns up.
     */
    const beachgoers = [];
    // The volleyball: a projectile moved by beachvolley.js (beach3d.js draws it).
    const beachBall = { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mode: 'held', kind: 'volley' },
      beachDiscs = [];
    let beachSpooked = 0,
      beachCrowdCache = { at: -1, x: 0, y: 0, level: 0 },
      beachWhistleClock = 40,
      beachClock = 0;
    const BEACH_HOURS = {
      sunbather: [8.5, 18.8],
      sitter: [8, 20.2],
      lounger: [9, 18.5],
      kid: [9, 18],
      swimmer: [8, 19],
      wader: [8.5, 20],
      volley: [10, 19.2],
      fan: [10, 19.2],
      thrower: [9, 19.5],
      jogger: [6, 21],
      stroller: [6.5, 23],
      lifeguard: [9, 19],
      vendor: [8, 24],
      patron: [11, 24],
      rider: [10, 18],
    };
    function beachPerson(kind, anchor, extra = {}) {
      const female = beachRandom() < 0.5,
        child = kind === 'kid',
        p = {
          kind,
          anchor,
          x: anchor.x,
          y: anchor.y,
          z: 0,
          a: anchor.a ?? 0,
          pose: 'stand',
          phase: beachRandom() * 10,
          timer: beachBetween(2, 20),
          state: 'off',
          threshold: beachRandom(),
          female,
          scale: child ? beachBetween(0.55, 0.7) : beachBetween(0.92, 1.06),
          skin: beachPick(BEACH_SKIN),
          hair: beachPick(BEACH_HAIR),
          suit: beachPick(BEACH_SWIM),
          // Most women on the beach wear a top; the shirt is for strollers and staff.
          top: female && kind !== 'jogger',
          shirt: null,
          visible: false,
          ...extra,
        };
      if (kind === 'stroller' || kind === 'patron') p.shirt = beachPick(BEACH_CLOTH);
      if (kind === 'jogger') p.shirt = beachPick(['#e8e4da', '#3a70b8', '#d9534a', '#222a33']);
      if (kind === 'lifeguard') {
        p.suit = '#d9302c';
        p.shirt = p.female ? null : '#e8e24c';
      }
      if (kind === 'vendor') p.shirt = '#f3efe4';
      beachgoers.push(p);
      return p;
    }
    function populateBeach() {
      buildBeachLayout();
      beachgoers.length = 0;
      beachDiscs.length = 0;
      beachSpooked = 0;
      beachSeed = 7331;
      const L = BEACH_LAYOUT,
        { length } = beachWaterline();
      for (const t of L.towels) {
        const kind = beachRandom() < 0.72 ? 'sunbather' : 'sitter';
        beachPerson(kind, t);
        // Some towels are shared by a couple lying side by side.
        if (t.umbrella && beachRandom() < 0.25)
          beachPerson('sitter', { x: t.x - Math.cos(t.a + Math.PI / 2) * 9, y: t.y - Math.sin(t.a + Math.PI / 2) * 9, a: t.a });
      }
      for (const t of L.loungers) beachPerson('lounger', t);
      for (const c of L.castles) {
        beachPerson('kid', { x: c.x + 9, y: c.y - 4, a: Math.PI });
        if (beachRandom() < 0.6) beachPerson('kid', { x: c.x - 9, y: c.y + 3, a: 0 });
      }
      for (let i = 0; i < 26; i++) {
        const s = beachBetween(200, length - 170),
          p = shoreAt(s, -beachBetween(66, 160));
        if (landAt(p.x, p.y) || onBeachPier(p.x, p.y, -10)) continue;
        beachPerson('swimmer', { x: p.x, y: p.y, a: p.a, s }, { home: { x: p.x, y: p.y } });
      }
      for (let i = 0; i < 18; i++) {
        const s = beachBetween(180, length - 150),
          d = beachBetween(8, 40),
          p = shoreAt(s, -d);
        if (Math.abs(p.x + 1710) < 40) continue;
        beachPerson('wader', { x: p.x, y: p.y, a: p.a + Math.PI, s, d }, { home: { x: p.x, y: p.y } });
      }
      // Volleyball: four players, two a side, all on court or none.
      const court = L.court,
        volleyThreshold = beachBetween(0.1, 0.45);
      for (const [fx, fy] of [
        [-0.3, -0.25],
        [-0.3, 0.25],
        [0.3, 0.25],
        [0.3, -0.25],
      ])
        beachPerson('volley', { x: court.x + fx * court.w, y: court.y + fy * court.h, a: fx < 0 ? 0 : Math.PI }, { threshold: volleyThreshold, side: Math.sign(fx) });
      // People watching the game: sitting along the south side of the pit, standing at the ends.
      for (const [dx, dy, pose] of [
        [-44, 1, 'sit'],
        [-18, 1, 'sit'],
        [12, 1, 'sit'],
        [40, 1, 'sit'],
        [-(court.w / 2 + court.pit + 8), -0.3, 'stand'],
        [court.w / 2 + court.pit + 8, 0.25, 'stand'],
      ]) {
        const onSide = pose === 'sit',
          x = court.x + dx,
          y = onSide ? court.y + court.h / 2 + court.pit + 6 : court.y + dy * court.h;
        beachPerson('fan', { x, y, a: onSide ? -Math.PI / 2 : dx < 0 ? 0 : Math.PI }, { threshold: volleyThreshold + beachBetween(0, 0.2), seat: pose });
      }
      // Frisbee and ball throwers in pairs on the lower sand.
      for (let i = 0; i < 4; i++) {
        const s = beachBetween(260, length - 260),
          a = shoreAt(s, beachBetween(40, 64)),
          b = shoreAt(s + beachBetween(60, 85), beachBetween(40, 70));
        if (!beachSpotFree(a.x, a.y, 6) || !beachSpotFree(b.x, b.y, 6)) continue;
        const threshold = beachBetween(0.2, 0.7),
          first = beachPerson('thrower', { x: a.x, y: a.y, a: 0 }, { threshold }),
          second = beachPerson('thrower', { x: b.x, y: b.y, a: 0 }, { threshold });
        first.partner = second;
        second.partner = first;
        beachDiscs.push({ a: first, b: second, ball: i % 2 === 1, t: 0, dur: 1.3, holder: first, wait: 1, x: a.x, y: a.y, z: 0 });
      }
      // Joggers along the firm sand at the waterline, strollers a little higher up.
      for (let i = 0; i < 6; i++)
        beachPerson('jogger', shoreAt(beachBetween(100, length - 100), 26), {
          s: beachBetween(100, length - 100),
          dir: beachRandom() < 0.5 ? 1 : -1,
          speed: beachBetween(9, 12) * KMH,
          lane: beachBetween(18, 34),
          threshold: beachBetween(0, 0.5),
        });
      for (let i = 0; i < 14; i++)
        beachPerson('stroller', shoreAt(beachBetween(100, length - 100), 40), {
          s: beachBetween(100, length - 100),
          dir: beachRandom() < 0.5 ? 1 : -1,
          speed: beachBetween(3.5, 5) * KMH,
          lane: beachBetween(30, 60),
          // The boardwalk walkers are the last to go home: a few are out at night.
          threshold: i >= 8 ? beachBetween(0, 0.12) : beachBetween(0, 0.8),
          boardwalk: i >= 8,
        });
      for (const t of L.towers) beachPerson('lifeguard', { x: t.x, y: t.y, a: t.a }, { threshold: 0, tower: t });
      for (const k of L.kiosks) {
        const staff = k.kind === 'bar' ? 2 : k.kind === 'station' ? 0 : 1;
        for (let i = 0; i < staff; i++)
          beachPerson('vendor', { x: k.x + k.w * (0.35 + i * 0.3), y: k.y + k.h - 8, a: Math.PI / 2 }, { threshold: 0, kiosk: k });
      }
      for (const t of L.tables)
        for (const side of [-1, 1])
          beachPerson('patron', { x: t.x + side * 8, y: t.y, a: side < 0 ? 0 : Math.PI }, { threshold: beachBetween(0, 0.9), stool: true });
      for (const boat of [...L.pedalos.filter((b) => !b.beached), ...L.jetskis])
        beachPerson('rider', { x: boat.cx, y: boat.cy, a: 0 }, { boat, threshold: beachBetween(0.1, 0.6) });
      // A lifeguard pickup parked by the station, and a jet ski for hire off the pier head.
      const station = L.kiosks.find((k) => k.kind === 'station');
      if (canSpawnCar('pickup', station.x - 50, station.y + 24, 0)) {
        const truck = makeCar('pickup', station.x - 50, station.y + 24, 0, false, '#e9c23a');
        truck.beachPatrol = true;
      }
      const head = BEACH.pier[1];
      if (canSpawnCar('jetski', head.x + head.w / 2, head.y + head.h + 26, 0)) makeCar('jetski', head.x + head.w / 2, head.y + head.h + 26, 0, false, '#e2574c');
    }
    /**
     * TIME OF DAY
     * 0 = empty, 1 = a packed summer afternoon. Rain and heavy cloud thin it out,
     * and so does a recent shooting.
     */
    function beachDensity(hour = (worldMinutes % 1440) / 60) {
      const ramp = (a, b) => clamp((hour - a) / (b - a), 0, 1);
      let d;
      if (hour < 6) d = 0.04;
      else if (hour < 9) d = 0.08 + 0.2 * ramp(6, 9);
      else if (hour < 11.5) d = 0.28 + 0.72 * ramp(9, 11.5);
      else if (hour < 16) d = 1;
      else if (hour < 18.5) d = 1 - 0.55 * ramp(16, 18.5);
      else if (hour < 20.5) d = 0.45 - 0.3 * ramp(18.5, 20.5);
      else d = 0.15 - 0.1 * ramp(20.5, 23);
      d *= 1 - 0.85 * weather.rain;
      d *= 1 - 0.5 * clamp((weather.cloud - 0.6) / 0.4, 0, 1);
      if (beachSpooked > 0) d *= 0.2 + 0.8 * clamp(1 - beachSpooked / 150, 0, 1);
      return clamp(d, 0, 1);
    }
    function beachHourOk(kind, hour) {
      const [from, to] = BEACH_HOURS[kind];
      return hour >= from && hour <= to;
    }
    /* Roughly what the camera can see, so people only pop in and out off screen. */
    function beachInView(x, y, margin = 90) {
      // The chase view: the chase camera's frustum within its sight reach (chase-rules.js).
      if (chaseCameraLive()) return chaseInView(x, y, margin);
      const vh = clamp(viewportHeight * 0.68, 430, 630) / Math.max(0.14, worldZoom),
        halfW = (vh * viewportWidth) / Math.max(1, viewportHeight) / 2 + margin,
        halfH = vh * 0.66 + margin;
      return Math.abs(x - cameraTarget.x) < halfW && Math.abs(y - cameraTarget.y) < halfH;
    }
    /* The boardwalk point straight up the sand from a spot: where people come and go. */
    function boardwalkEntry(p) {
      const w = BEACH.boardwalk;
      return { x: clamp(p.x, w.x0 + 20, w.x1 - 20), y: w.y + 4 };
    }
    function beachWalkTo(p, target, speed, deltaSeconds) {
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      if (d < 3) return true;
      p.a = Math.atan2(target.y - p.y, target.x - p.x);
      const step = Math.min(d, speed * deltaSeconds);
      p.x += Math.cos(p.a) * step;
      p.y += Math.sin(p.a) * step;
      p.phase += deltaSeconds * (speed > 60 ? 14 : 8);
      p.pose = speed > 60 ? 'run' : 'walk';
      return false;
    }
    const BEACH_WATER_KINDS = ['swimmer', 'wader', 'rider'];
    function updateBeach(deltaSeconds) {
      if (!beachgoers.length) return;
      beachSpooked = Math.max(0, beachSpooked - deltaSeconds);
      // Nobody needs thinking about while the player is far from the strand.
      if (Math.abs(player.x + 1970) > 2600 || Math.abs(player.y - 5600) > 2400) {
        for (const p of beachgoers) p.visible = false;
        beachBall.active = false;
        if (volleyPlayerInMatch()) volleyLeave('You left the beach volleyball.');
        return;
      }
      beachClock += deltaSeconds;
      const hour = (worldMinutes % 1440) / 60,
        density = beachDensity(hour),
        barCrowd = hour > 18 ? 0.75 * (1 - 0.8 * weather.rain) * (beachSpooked > 0 ? 0.3 : 1) : 0;
      beachCarThreats(deltaSeconds);
      for (const p of beachgoers) {
        // Staff keep their hours whatever the crowd; the bar fills up after dark.
        const level = p.kind === 'lifeguard' || p.kind === 'vendor' ? 1 : p.kind === 'patron' ? Math.max(density, barCrowd) : density,
          want = level >= p.threshold && beachHourOk(p.kind, hour) && !(p.fledFor > 0),
          seen = beachInView(p.x, p.y) || beachInView(p.anchor.x, p.anchor.y),
          water = BEACH_WATER_KINDS.includes(p.kind);
        if (p.fledFor > 0) p.fledFor -= deltaSeconds;
        if (p.state === 'off') {
          p.visible = false;
          if (!want) continue;
          if (!seen) beachArrive(p, false);
          else if (!water && p.kind !== 'lifeguard' && p.kind !== 'vendor') beachArrive(p, true);
          else continue;
        } else if (!want && p.state !== 'leave' && p.state !== 'flee') {
          if (!seen || water) {
            if (!seen) {
              p.state = 'off';
              p.visible = false;
              continue;
            }
          } else {
            p.state = 'leave';
            p.target = boardwalkEntry(p);
          }
        }
        p.visible = true;
        if (p.state === 'arrive') {
          p.z = 0;
          if (beachWalkTo(p, beachHome(p), 30, deltaSeconds)) p.state = 'on';
          continue;
        }
        if (p.state === 'leave' || p.state === 'flee') {
          p.z = 0;
          if (beachWalkTo(p, p.target, p.state === 'flee' ? 120 : 30, deltaSeconds)) {
            p.state = 'off';
            p.visible = false;
          }
          continue;
        }
        // Caught up in the SHARK! alarm (sealife.js): pointing, or out of the water.
        if (p.sharkRush && beachSharkStep(p, deltaSeconds)) continue;
        beachBehave(p, deltaSeconds, hour);
      }
      updateBeachGames(deltaSeconds);
      // The lifeguards' whistle carries over a busy beach now and then.
      beachWhistleClock -= deltaSeconds;
      if (beachWhistleClock <= 0) {
        beachWhistleClock = 45 + Math.random() * 70;
        const tower = BEACH_LAYOUT.towers[Math.floor(Math.random() * BEACH_LAYOUT.towers.length)];
        if (density > 0.4 && beachHourOk('lifeguard', hour) && distanceBetween(tower, player) < 900) lifeguardWhistle(tower);
      }
    }
    /* Where a slot belongs: its towel, its patch of sea, its stool. */
    function beachHome(p) {
      if (p.boardwalk) return { x: shoreAt(p.s).x, y: BEACH.boardwalk.y };
      if (p.kind === 'jogger' || p.kind === 'stroller') return shoreAt(p.s, p.lane);
      return p.anchor;
    }
    function beachArrive(p, walking) {
      const home = beachHome(p);
      p.fledFor = 0;
      if (walking) {
        const entry = boardwalkEntry(home);
        p.x = entry.x + beachBetween(-20, 20);
        p.y = entry.y;
        p.state = 'arrive';
      } else {
        p.x = home.x;
        p.y = home.y;
        p.state = 'on';
      }
      p.timer = beachBetween(2, 25);
      p.visible = true;
    }
    function beachBehave(p, deltaSeconds, hour) {
      p.phase += deltaSeconds;
      p.timer -= deltaSeconds;
      const home = p.anchor;
      switch (p.kind) {
        case 'sunbather': {
          // Lie on the back, turn over, sit up for a while, lie down again.
          p.x = home.x;
          p.y = home.y;
          p.a = home.a;
          p.z = 0.6;
          if (p.timer <= 0) {
            p.pose = p.pose === 'lie' ? beachPick(['lieFront', 'sit', 'lie']) : 'lie';
            p.timer = p.pose === 'sit' ? beachBetween(6, 16) : beachBetween(18, 60);
          }
          if (!['lie', 'lieFront', 'sit'].includes(p.pose)) p.pose = 'lie';
          break;
        }
        case 'sitter':
        case 'lounger': {
          p.x = home.x;
          p.y = home.y;
          p.a = home.a;
          p.z = p.kind === 'lounger' ? 3.2 : 0.6;
          if (p.timer <= 0) {
            p.pose = p.kind === 'lounger' ? (p.pose === 'recline' ? 'sit' : 'recline') : p.pose === 'sit' ? beachPick(['sit', 'lie']) : 'sit';
            p.timer = beachBetween(10, 40);
          }
          if (!['sit', 'lie', 'recline'].includes(p.pose)) p.pose = p.kind === 'lounger' ? 'recline' : 'sit';
          break;
        }
        case 'kid': {
          p.x = home.x;
          p.y = home.y;
          p.a = home.a;
          p.z = 0;
          if (p.timer <= 0) {
            p.pose = p.pose === 'kneel' ? beachPick(['kneel', 'stand']) : 'kneel';
            p.timer = p.pose === 'kneel' ? beachBetween(6, 18) : beachBetween(2, 5);
          }
          if (p.pose !== 'kneel' && p.pose !== 'stand') p.pose = 'kneel';
          break;
        }
        case 'swimmer': {
          // Drift about the swim zone: a few lengths of crawl, a float on the back,
          // treading water to chat. Never onto the sand, never past the buoys.
          if (!p.goal || p.timer <= 0) {
            const s = clamp((p.anchor.s || 800) + beachBetween(-90, 90), 170, beachWaterline().length - 170);
            p.goal = shoreAt(s, -beachBetween(64, 165));
            p.mode = beachPick(['swim', 'swim', 'float', 'tread']);
            p.timer = beachBetween(8, 22);
          }
          const speed = p.mode === 'swim' ? 2.5 * KMH : p.mode === 'float' ? 0.5 * KMH : 0;
          if (speed && !landAt(p.goal.x, p.goal.y)) {
            const d = Math.hypot(p.goal.x - p.x, p.goal.y - p.y);
            if (d > 4) {
              const a = Math.atan2(p.goal.y - p.y, p.goal.x - p.x);
              p.a += normalizeAngle(a - p.a) * Math.min(1, deltaSeconds * 1.5);
              const nx = p.x + Math.cos(p.a) * speed * deltaSeconds,
                ny = p.y + Math.sin(p.a) * speed * deltaSeconds;
              if (!landAt(nx, ny) && beachShelfDistance(nx, ny) > 50) {
                p.x = nx;
                p.y = ny;
              } else p.timer = 0;
            } else p.mode = 'tread';
          }
          p.pose = p.dive > 0 ? 'dive' : p.mode;
          if (p.dive > 0) p.dive -= deltaSeconds;
          p.z = -4.4 + Math.sin(beachClock * 1.6 + p.threshold * 9) * 0.5;
          break;
        }
        case 'wader': {
          // Stand about in the shallows, turn, take a few steps along the shore.
          if (p.timer <= 0) {
            p.timer = beachBetween(4, 12);
            const s = clamp((p.anchor.s || 800) + beachBetween(-40, 40), 170, beachWaterline().length - 150);
            p.goal = beachRandom() < 0.5 ? shoreAt(s, -beachBetween(6, 42)) : null;
            if (!p.goal) p.a += beachBetween(-1.2, 1.2);
          }
          if (p.goal && !beachWalkTo(p, p.goal, 12, deltaSeconds)) p.pose = 'wadeWalk';
          else {
            p.goal = null;
            p.pose = 'wade';
          }
          const depth = clamp(beachShelfDistance(p.x, p.y) / WADE_DEPTH, 0, 1);
          p.z = Number.isFinite(depth) ? -1.5 - depth * 6.5 : -4;
          // Children kick up spray.
          if (p.scale < 0.8 && Math.random() < deltaSeconds * 0.8) particle(p.x, p.y, '#e6f4f7', 3, 25, 2);
          break;
        }
        case 'jogger':
        case 'stroller': {
          const { length } = beachWaterline();
          if (p.boardwalk) {
            // Evening walkers keep to the lit boardwalk.
            const w = BEACH.boardwalk;
            p.pose = 'walk';
            p.x += p.dir * p.speed * deltaSeconds;
            if (p.x < w.x0 + 20 || p.x > w.x1 - 20) p.dir *= -1;
            p.y = w.y + (p.dir > 0 ? 8 : -8);
            p.a = p.dir > 0 ? 0 : Math.PI;
            p.phase += deltaSeconds * strideRate(p.speed);
            p.z = 0;
            break;
          }
          if (p.kind === 'stroller' && p.pause > 0) {
            p.pause -= deltaSeconds;
            p.pose = 'stand';
            p.a = shoreAt(p.s).a;
            break;
          }
          p.s += p.dir * p.speed * deltaSeconds;
          if (p.s < 90 || p.s > length - 90) {
            p.dir *= -1;
            p.s = clamp(p.s, 90, length - 90);
          }
          const q = shoreAt(p.s, p.lane + Math.sin(p.s * 0.02) * 4);
          // The pier stands across the path: go round the landward end of it.
          if (Math.abs(q.x + 1710) < 34) {
            q.y = Math.min(q.y, BEACH.pier[0].y - 18);
          }
          p.a = Math.atan2(q.y - p.y, q.x - p.x);
          p.x = q.x;
          p.y = q.y;
          p.z = 0;
          p.pose = p.kind === 'jogger' ? 'run' : 'walk';
          p.phase += deltaSeconds * strideRate(p.speed);
          if (p.kind === 'stroller' && p.timer <= 0) {
            p.timer = beachBetween(15, 40);
            p.pause = beachBetween(3, 9);
          }
          break;
        }
        case 'lifeguard': {
          // On the front of the tower deck, in front of the cabin.
          const t = p.tower;
          p.x = t.x + Math.cos(t.a) * 5;
          p.y = t.y + Math.sin(t.a) * 5;
          if (p.timer <= 0) {
            p.pose = p.pose === 'sit' ? 'stand' : 'sit';
            p.timer = p.pose === 'sit' ? beachBetween(20, 50) : beachBetween(4, 9);
          }
          if (p.pose !== 'sit' && p.pose !== 'stand') p.pose = 'sit';
          // Scanning the water.
          p.a = t.a + Math.sin(beachClock * 0.3 + t.s) * 0.6;
          p.z = p.pose === 'sit' ? 20 : 19.2;
          break;
        }
        case 'vendor': {
          p.x = home.x;
          p.y = home.y;
          p.a = home.a + Math.sin(beachClock * 0.4 + p.threshold * 6) * 0.3;
          p.z = 0;
          p.pose = 'stand';
          break;
        }
        case 'patron': {
          p.x = home.x;
          p.y = home.y;
          p.a = home.a;
          p.z = 3.4;
          p.pose = 'sit';
          break;
        }
        case 'rider': {
          const boat = p.boat;
          p.x = boat.x;
          p.y = boat.y;
          p.a = boat.a;
          p.z = 0;
          p.pose = 'ride';
          break;
        }
        case 'fan': {
          // Watching the volleyball: follow the ball, cheer the points.
          p.x = home.x;
          p.y = home.y;
          p.z = 0;
          const ball = beachBall,
            look = ball.active ? Math.atan2(ball.y - p.y, ball.x - p.x) : home.a;
          p.a = home.a + clamp(normalizeAngle(look - home.a), -1.1, 1.1);
          p.pose = volley.cheerUntil > beachClock && ball.active ? (p.seat === 'sit' && p.threshold % 0.1 < 0.05 ? 'sit' : 'cheer') : p.seat;
          break;
        }
        case 'volley':
        case 'thrower': {
          // Positioned by updateBeachGames; here they just face the play.
          p.z = 0;
          break;
        }
      }
    }
