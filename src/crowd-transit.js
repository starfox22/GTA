    function curbsideStop(c) {
      if (c.crashStop) return 0;
      const s = c.curbStop;
      if (!s) return Infinity;
      if (gameTime > s.expire || c.hp <= 0) {
        c.curbStop = null;
        return Infinity;
      }
      if (s.dwellUntil) {
        if (gameTime < s.dwellUntil) return 0;
        c.curbStop = null;
        c.curbCooldown = gameTime + 30;
        return Infinity;
      }
      const along = (s.x - c.x) * Math.cos(c.a) + (s.y - c.y) * Math.sin(c.a);
      if (along < -24) {
        c.curbStop = null;
        return Infinity;
      }
      return Math.sqrt(2 * 200 * Math.max(0, along - 2)) * 0.8;
    }
    function vehicleAlongside(c, s) {
      const along = (s.x - c.x) * Math.cos(c.a) + (s.y - c.y) * Math.sin(c.a);
      return Math.abs(c.speed || 0) < 4 && Math.abs(along) < 16;
    }
    function updateBusArrival(s) {
      const stop = s.stop,
        laneY = rowNear(stop.y + 60) - 25;
      if (!s.bus) {
        if (gameTime < (stop.nextBus || 0)) return;
        const bus = vehicles.find(
          (c) =>
            c.type === 'bus' &&
            c.ai &&
            c.occupied &&
            c.hp > 0 &&
            !c.curbStop &&
            !(c.curbCooldown > gameTime) &&
            Math.abs(c.y - laneY) < 14 &&
            Math.cos(c.a) < -0.9 &&
            c.x - stop.x > 30 &&
            c.x - stop.x < 500,
        );
        if (!bus) return;
        s.bus = bus;
        bus.curbStop = { x: stop.x, y: laneY, kind: 'bus', expire: gameTime + 40 };
        return;
      }
      const bus = s.bus,
        halt = bus.curbStop;
      if (!halt || bus.hp <= 0) {
        s.bus = null;
        stop.nextBus = gameTime + 20;
        return;
      }
      if (!halt.dwellUntil && vehicleAlongside(bus, halt)) {
        halt.dwellUntil = gameTime + 6;
        airBrakeSound(bus);
        // Waiters board through the kerb-side door.
        for (const p of s.members.filter((q) => q.sceneRole === 'waiter')) {
          p.sceneRole = 'boarding';
          p.sceneSpot = { x: bus.x - 20, y: bus.y - vehicleSpec(bus).w / 2 - 5, a: Math.PI / 2 };
        }
        // And somebody gets off.
        for (let i = 0; i < Math.floor(randomBetween(0, 2.6)); i++) {
          const spot = crowdSpawnSpot(true);
          if (!spot || pedestrians.length >= CROWD_HARD_CAP) break;
          const p = makeStreetWalker({ x: bus.x - 20 + i * 6, y: bus.y - vehicleSpec(bus).w / 2 - 8, a: -Math.PI / 2 }, 'commuter');
          p.dir = randomChoice([0, Math.PI]);
          p.timer = 1;
        }
      }
      for (const p of s.members)
        if (p.sceneRole === 'boarding' && distanceBetween(p, p.sceneSpot) < 5) {
          const k = pedestrians.indexOf(p);
          leaveScene(p);
          if (k >= 0) pedestrians.splice(k, 1);
        }
      if (halt.dwellUntil && gameTime > halt.dwellUntil - 0.5) {
        for (const p of s.members.filter((q) => q.sceneRole === 'boarding')) leaveScene(p);
        s.bus = null;
        stop.nextBus = gameTime + randomBetween(40, 90);
      }
    }
    function stageHail() {
      if (!(crowd.hour > 6.5 || crowd.hour < 2)) return null;
      const taxi = vehicles.find(
        (c) =>
          c.type === 'taxi' &&
          c.ai &&
          c.occupied &&
          c.hp > 0 &&
          !c.taxiHire &&
          !c.curbStop &&
          !(c.fareUntil > gameTime) &&
          Math.abs(c.speed || 0) > 20 &&
          Math.abs(c.x - player.x) < 900 &&
          Math.abs(c.y - player.y) < 700,
      );
      if (!taxi) return null;
      const nav = snapAxis(taxi.a),
        cx = Math.cos(nav),
        cy = Math.sin(nav),
        ahead = randomBetween(230, 330),
        lx = taxi.x + cx * ahead,
        ly = taxi.y + cy * ahead,
        // The kerb is on the cab's right.
        rx = -cy,
        ry = cx,
        vertical = Math.abs(cy) > 0.5,
        road = vertical ? roadNear(lx) : rowNear(ly),
        laneX = vertical ? road + rx * 25 : lx,
        laneY = vertical ? ly : road + ry * 25,
        kerbX = vertical ? road + rx * (sidewalkOffset(road, true) - 14) : lx,
        kerbY = vertical ? ly : road + ry * (sidewalkOffset(road, false) - 14),
        crossing = nextCrossing(vertical ? ROAD_ROWS : ROAD_CENTERS, vertical ? ly : lx, vertical ? Math.sign(cy) : Math.sign(cx));
      if (!inCityGrid(kerbX, kerbY) || solid(kerbX, kerbY, 5) || !landAt(kerbX, kerbY)) return null;
      if (crossing !== undefined && Math.abs(crossing - (vertical ? ly : lx)) < 110) return null;
      const previous = vertical ? ly - Math.sign(cy) * 110 : lx - Math.sign(cx) * 110;
      if (Math.abs((vertical ? rowNear(previous) : roadNear(previous)) - previous) < 90) return null;
      const s = makeScene('hail', kerbX, kerbY, { taxi });
      // Facing the road, turned a little toward the oncoming cab.
      const spot = { x: kerbX, y: kerbY, a: Math.atan2(-ry - cy * 0.6, -rx - cx * 0.6) };
      let hailer = null;
      recruit(s, 140, (p) => (hailer = sceneMember(s, p, 'hailer', spot, 40)));
      if (!hailer) {
        if (crowdInView(kerbX, kerbY, 60)) {
          removeScene(s);
          return null;
        }
        hailer = spawnSceneMember(s, 'hailer', spot, 'commuter', 40);
      }
      if (!hailer) {
        removeScene(s);
        return null;
      }
      taxi.curbStop = { x: laneX, y: laneY, kind: 'fare', expire: gameTime + 30, scene: s };
      return s;
    }
    function updateHailScene(s) {
      const taxi = s.taxi,
        hailer = s.members[0];
      if (!hailer || !taxi || taxi.hp <= 0 || !taxi.curbStop || taxi.curbStop.scene !== s || player.car === taxi) {
        if (taxi?.curbStop?.scene === s) taxi.curbStop = null;
        s.done = true;
        return;
      }
      const halt = taxi.curbStop;
      if (!halt.dwellUntil && vehicleAlongside(taxi, halt) && hailer.sceneRole === 'hailer') {
        hailer.sceneRole = 'boarding';
        const side = headingBetween(taxi, hailer);
        hailer.sceneSpot = { x: taxi.x + Math.cos(side) * (vehicleSpec(taxi).w / 2 + 7), y: taxi.y + Math.sin(side) * (vehicleSpec(taxi).w / 2 + 7), a: 0 };
        halt.dwellUntil = gameTime + 8;
      }
      if (hailer.sceneRole === 'boarding' && distanceBetween(hailer, hailer.sceneSpot) < 5) {
        const k = pedestrians.indexOf(hailer);
        leaveScene(hailer);
        if (k >= 0) pedestrians.splice(k, 1);
        halt.dwellUntil = gameTime + 1.2;
        taxi.fareUntil = gameTime + 120;
        s.done = true;
      }
    }
    function updateDeliveryScene(s, step) {
      const van = s.van,
        worker = s.members.find((p) => p.sceneRole === 'worker' || p.sceneRole === 'driving');
      if (!van || van.hp <= 0 || player.car === van || van.stolen) {
        s.done = true;
        return;
      }
      if (!worker) {
        if (s.timer > 60) s.done = true;
        return;
      }
      const door = s.door,
        rear = { x: van.x + 30, y: van.y - 22 };
      if (worker.sceneRole === 'driving') {
        const cab = { x: van.x - 10, y: van.y - vehicleSpec(van).w / 2 - 6 };
        worker.sceneSpot = { ...cab, a: Math.PI / 2 };
        if (distanceBetween(worker, cab) < 5) {
          const k = pedestrians.indexOf(worker);
          leaveScene(worker);
          if (k >= 0) pedestrians.splice(k, 1);
          assignDriver(van);
          van.locked = false;
          van.ai = true;
          van.deliveryScene = null;
          s.van = null;
          s.done = true;
        }
        return;
      }
      // Back and forth: van to door with a box, door to van empty-handed.
      if (!s.leg) s.leg = 'toDoor';
      const target = s.leg === 'toDoor' ? door.out : rear;
      worker.sceneSpot = { x: target.x, y: target.y, a: headingBetween(worker, target) };
      worker.carry = s.leg === 'toDoor' ? 'box' : null;
      if (distanceBetween(worker, target) < 6) {
        if (s.leg === 'toDoor') {
          s.leg = 'toVan';
          s.boxes--;
          if (seededRandom() < 0.3) crowdSay(worker, 'delivery', 1);
        } else s.leg = s.boxes > 0 ? 'toDoor' : 'done';
      }
      if (s.leg === 'done' || s.timer > 75) worker.sceneRole = 'driving';
    }
    /* How a scene member stands (or sits) once they are in place. */
    const SCENE_POSES = {
      vendor: 'serve',
      customer: 'wait',
      busker: 'strum',
      listener: 'watch',
      sitter: 'sit',
      smoker: 'smoke',
      queue: 'sway',
      bouncer: 'arms',
      waiter: 'wait',
      hailer: 'wave',
      worker: 'carry',
      // The 4x4 club (offroad.js).
      clubGrill: 'serve',
      clubChat: 'chat',
      clubSit: 'sit',
      clubArms: 'arms',
      // A garage's mechanics (garages.js staffGarages); their spot may name a pose.
      mechanic: 'serve',
    };
    function updateSceneMember(p, deltaSeconds) {
      const spot = p.sceneSpot;
      if (!spot) {
        leaveScene(p);
        return false;
      }
      p.sceneTime -= deltaSeconds;
      if (p.sceneTime <= 0) {
        leaveScene(p);
        return false;
      }
      const d = distanceBetween(p, spot);
      if (d > 3) {
        p.sitting = false;
        p.pose = p.carry === 'box' ? 'carry' : null;
        const speed = p.sceneRole === 'entering' || p.sceneRole === 'boarding' ? 30 : Math.max(22, walkerSpeed(p));
        if (crowdStep(p, headingBetween(p, spot), Math.min(speed, d * 6 + 6), deltaSeconds)) {
          p.sceneBlocked = (p.sceneBlocked || 0) + deltaSeconds;
          if (p.sceneBlocked > 3) {
            if (['entering', 'boarding'].includes(p.sceneRole) || p.sceneBlocked > 5) {
              p.x = spot.x;
              p.y = spot.y;
            }
          }
        } else p.sceneBlocked = 0;
        return true;
      }
      p.walking = false;
      p.a += normalizeAngle(spot.a - p.a) * Math.min(1, deltaSeconds * 5);
      const role = p.sceneRole;
      p.pose = SCENE_POSES[role] || 'idle';
      if (role === 'waiter' && spot.seat) p.pose = 'sit';
      if (role === 'waiter' && !spot.seat && p.texting) p.pose = 'text';
      if (role === 'worker') p.pose = p.carry === 'box' ? 'carry' : 'idle';
      if (spot.pose) p.pose = spot.pose;
      p.sitting = p.pose === 'sit';
      if (role === 'sitter') {
        p.sipping = (gameTime + (p.walk || 0)) % 7 < 1.4;
        if (seededRandom() < deltaSeconds * 0.05) crowdSay(p, 'cafe', 1);
      }
      if (role === 'listener' && (gameTime + (p.walk || 0) * 3) % 11 < 1.2) p.pose = 'clap';
      if (role === 'queue' && seededRandom() < deltaSeconds * 0.04) crowdSay(p, 'queue', 1);
      if (role === 'hailer' && seededRandom() < deltaSeconds * 0.4) crowdSay(p, 'hail', 1);
      if (role === 'smoker' && seededRandom() < deltaSeconds * 0.04) crowdSay(p, 'chat', 1);
      if (role === 'waiter' && seededRandom() < deltaSeconds * 0.01) crowdSay(p, 'bus', 1);
      return true;
    }
    /* Keep the right scenes alive around the player. */
    function updateScenes(deltaSeconds) {
      crowd.timers.scenes -= deltaSeconds;
      if (crowd.timers.scenes > 0) return;
      const step = 1;
      crowd.timers.scenes = step;
      for (const s of [...crowd.scenes]) {
        const far = Math.abs(s.x - player.x) > 1800 || Math.abs(s.y - player.y) > 1800,
          closed = SCENE_HOURS[s.kind] && !sceneOpen(s.kind) && !crowdInView(s.x, s.y, 80);
        if (s.done || (far && !crowdInView(s.x, s.y, 80)) || closed) {
          removeScene(s);
          continue;
        }
        tickScene(s, step);
      }
      if (districtBustle(player.x, player.y) <= 0) return;
      // Right after the crowd settles around a new spot, or a teleport, scenes may
      // appear in view: there was nothing on screen for them to pop into.
      const jumped = crowd.sceneAnchor && Math.hypot(player.x - crowd.sceneAnchor.x, player.y - crowd.sceneAnchor.y) > 600;
      crowd.sceneAnchor = { x: player.x, y: player.y };
      const allowInView = gameTime - crowd.settleStamp < 3 || jumped;
      const count = (kind) => crowd.scenes.filter((s) => s.kind === kind).length,
        quota = { vendor: 2, busker: 1, cafe: 3, smokers: 1, delivery: 1 };
      for (const [kind, n] of Object.entries(quota)) {
        if (!sceneOpen(kind) || count(kind) >= n || seededRandom() > 0.5) continue;
        ({ vendor: stageVendor, busker: stageBusker, cafe: stageCafe, smokers: stageSmokers, delivery: stageDelivery })[kind](allowInView);
      }
      if (sceneOpen('nightlife'))
        for (const place of PLACES)
          if (
            (place.kind === 'bar' || place.kind === 'club') &&
            place.door &&
            distanceBetween(place.door, player) < 1500 &&
            !crowd.scenes.some((s) => s.place === place) &&
            (allowInView || !crowdInView(place.door.x, place.door.y, 60))
          )
            stageNightlife(place);
      if (crowd.hour >= 6 || crowd.hour < 0.5)
        for (const stop of BUS_STOPS)
          if (
            distanceBetween(stop, player) < 1100 &&
            !crowd.scenes.some((s) => s.stop === stop) &&
            (allowInView || !crowdInView(stop.x, stop.y, 60)) &&
            count('busStop') < 5
          )
            stageBusStop(stop);
      if (!count('hail') && seededRandom() < 0.35) stageHail();
    }
