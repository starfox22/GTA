    // Street scenes: set pieces staged round the player, their members and props (sceneOpen, spawnSceneMember, streetFrontages).
    const SCENE_HOURS = {
      vendor: [7, 21],
      busker: [10, 23],
      cafe: [7, 22],
      smokers: [8.5, 18.5],
      delivery: [6, 18],
      nightlife: [20, 28],
    };
    function sceneOpen(kind, hour = crowd.hour) {
      const [a, b] = SCENE_HOURS[kind] || [0, 24];
      return (hour >= a && hour < b) || (b > 24 && hour < b - 24);
    }
    function addSceneProp(scene, kind, x, y, a = 0) {
      // vx, vy, spin and tip move it once a vehicle has knocked it (knockSceneProps).
      const prop = { kind, x, y, a, scene, knocked: false, vx: 0, vy: 0, spin: 0, tip: 0, tipTo: 0 };
      crowd.props.push(prop);
      scene.props.push(prop);
      return prop;
    }
    function sceneMember(scene, p, role, spot, seconds = Infinity) {
      if (p.bench) p.bench.taken = null;
      p.bench = null;
      p.state = 'walk';
      p.sitting = false;
      p.scene = scene;
      p.sceneRole = role;
      p.sceneSpot = spot;
      p.sceneTime = seconds;
      if (['vendor', 'busker', 'bouncer', 'worker', 'mechanic'].includes(role)) {
        p.sceneHome = scene;
        p.homeSpot = spot;
      }
      scene.members.push(p);
      return p;
    }
    function spawnSceneMember(scene, role, spot, dressAs = 'casual', seconds = Infinity) {
      if (pedestrians.length >= CROWD_HARD_CAP) return null;
      const p = { x: spot.x, y: spot.y, a: spot.a, hp: 30, flee: 0, timer: 5, walk: 0, state: 'walk' };
      dressPerson(p, dressAs);
      pedestrians.push(p);
      return sceneMember(scene, p, role, spot, seconds);
    }
    function leaveScene(p) {
      const s = p.scene;
      if (s) {
        const i = s.members.indexOf(p);
        if (i >= 0) s.members.splice(i, 1);
        if (s.served === p) s.served = null;
      }
      p.scene = null;
      p.sceneSpot = null;
      p.sitting = false;
      p.state = 'walk';
      p.sipping = false;
      p.dir = snapAxis(p.a);
      p.timer = randomBetween(3, 9);
    }
    function rejoinScene(p) {
      const s = p.sceneHome;
      if (!s || !crowd.scenes.includes(s) || distanceBetween(p, s) > 500) {
        p.sceneHome = null;
        return;
      }
      sceneMember(s, p, p.sceneRole, p.homeSpot);
    }
    /* A passing walker who might stop for this scene. */
    function recruitable(p) {
      return (
        p.hp > 0 &&
        p.state === 'walk' &&
        !p.react &&
        !p.pending &&
        !p.scene &&
        !p.leader &&
        !p.dog &&
        !(p.flee > 0) &&
        p.role !== 'jogger' &&
        p.role !== 'kid' &&
        ordinaryWalker(p)
      );
    }
    function recruit(scene, radius, fn) {
      let taken = null;
      forPeopleNear(scene.x, scene.y, radius, (p) => {
        if (!taken && recruitable(p)) taken = p;
      });
      if (taken) fn(taken);
      return taken;
    }
    function sceneScared(scene) {
      return crowd.incidents.some(
        (inc) => (inc.loud || inc.kind === 'body') && gameTime - inc.time < 30 && distanceBetween(inc, scene) < 420,
      );
    }
    /**
     * STREET FRONTAGE
     * Scenes happen in front of south-facing building fronts, the side of every
     * building the camera sees: the middle of the front (or its shop door when
     * the renderer drew one), with the sidewalk between it and the kerb.
     */
    let frontageCache = null;
    function streetFrontages() {
      if (!frontageCache) {
        frontageCache = [];
        for (const b of buildings) {
          if (b.place || b.depotWall || b.w < 60 || !inCityGrid(b.x, b.y + b.h)) continue;
          const face = b.y + b.h,
            row = rowNear(face + 60),
            gap = row - face;
          if (gap < 60 || gap > 118 || !cityStreetAt(b.x + b.w / 2, row)) continue;
          const shop = buildingDoor(b),
            x = shop ? shop.x : b.x + b.w / 2,
            y = face + 3;
          if (solid(x, y + 13, 4) || inHarbor(x, y, 30)) continue;
          frontageCache.push(shop || { x, y, out: { x, y: y + 13 }, building: b, shop: false });
        }
      }
      return frontageCache;
    }
    /* A building front on a street near the player, out of sight, not already in use. */
    function frontageNear(minD, maxD, allowInView) {
      const options = streetFrontages().filter((door) => {
        const d = distanceBetween(door, player);
        if (d < (allowInView ? 60 : minD) || d > maxD) return false;
        if (!allowInView && crowdInView(door.x, door.y, 80)) return false;
        return !crowd.scenes.some((s) => distanceBetween(s, door) < 150);
      });
      if (!options.length) return null;
      // Right after a teleport, prefer fronts the player can see.
      if (allowInView) options.sort((a, b) => distanceBetween(a, player) - distanceBetween(b, player));
      return allowInView ? options[Math.floor(seededRandom() * Math.min(3, options.length))] : randomChoice(options);
    }
    function makeScene(kind, x, y, extra = {}) {
      const scene = { kind, x, y, members: [], props: [], born: gameTime, timer: 0, ...extra };
      crowd.scenes.push(scene);
      return scene;
    }
    function removeScene(scene) {
      const i = crowd.scenes.indexOf(scene);
      if (i >= 0) crowd.scenes.splice(i, 1);
      for (const prop of scene.props) {
        const k = crowd.props.indexOf(prop);
        if (k >= 0) crowd.props.splice(k, 1);
      }
      for (const p of [...scene.members]) {
        const k = pedestrians.indexOf(p);
        const far = distanceBetween(p, player) > 900 && !crowdInView(p.x, p.y, 80);
        leaveScene(p);
        p.sceneHome = null;
        if (far && k >= 0 && !p.react) pedestrians.splice(k, 1);
      }
      for (const p of pedestrians) if (p.sceneHome === scene) p.sceneHome = null;
      if (scene.van && scene.van !== player.car && !scene.van.stolen && scene.van.hp > 0 && !scene.van.ai) {
        const k = vehicles.indexOf(scene.van);
        if (k >= 0 && distanceBetween(scene.van, player) > 900) vehicles.splice(k, 1);
        else if (k >= 0) {
          // The delivery ended without its driver (scared off, hurt): the van used to
          // stay double-parked in the lane for good. Someone from the firm drives it off.
          assignDriver(scene.van);
          scene.van.locked = false;
          scene.van.ai = true;
          scene.van.deliveryScene = null;
        }
      }
    }
    function stageVendor(allowInView) {
      const door = frontageNear(350, 1100, allowInView);
      if (!door) return null;
      const row = rowNear(door.y + 40),
        x = door.x + randomChoice([-70, 70]),
        y = row - sidewalkOffset(row, false) + 8;
      if (solid(x, y, 8) || crowdOnRoad(x, y + 6)) return null;
      const s = makeScene('vendor', x, y);
      addSceneProp(s, 'cart', x, y, 0);
      const vendor = spawnSceneMember(s, 'vendor', { x, y: y - 11, a: Math.PI / 2 }, 'worker');
      if (vendor) vendor.look.hat = 1;
      for (let i = 0; i < 2; i++) spawnSceneMember(s, 'customer', { x: x + randomBetween(-3, 3), y: y + 12 + i * 9, a: -Math.PI / 2 }, 'casual', randomBetween(6, 14));
      s.serveIn = 4;
      return s;
    }
    function stageBusker(allowInView) {
      const door = frontageNear(350, 1100, allowInView);
      if (!door) return null;
      const x = door.x + randomChoice([-46, 46]),
        y = door.y + 9;
      if (solid(x, y + 3, 5)) return null;
      const s = makeScene('busker', x, y);
      spawnSceneMember(s, 'busker', { x, y, a: Math.PI / 2 }, 'casual');
      addSceneProp(s, 'guitarCase', x + 1, y + 12, 0);
      for (let i = 0; i < 2; i++) {
        const a = Math.PI / 2 + randomBetween(-0.9, 0.9),
          spot = { x: x + Math.cos(a) * 34, y: y + Math.sin(a) * 30 };
        spot.a = headingBetween(spot, { x, y });
        spawnSceneMember(s, 'listener', spot, 'casual', randomBetween(10, 25));
      }
      return s;
    }
    function stageCafe(allowInView) {
      const door = frontageNear(300, 1100, allowInView);
      if (!door) return null;
      const s = makeScene('cafe', door.x, door.y + 12);
      addSceneProp(s, 'menuBoard', door.x + 12, door.y + 14, 0);
      for (const dx of [-34, 34, -62]) {
        const tx = door.x + dx,
          ty = door.y + 12;
        if (solid(tx, ty + 2, 6)) continue;
        addSceneProp(s, 'cafeTable', tx, ty, 0);
        for (const side of [-1, 1])
          if (seededRandom() < 0.7) {
            const p = spawnSceneMember(s, 'sitter', { x: tx + side * 7.5, y: ty, a: side > 0 ? Math.PI : 0 }, 'casual', randomBetween(30, 90));
            if (p) p.carry = 'coffee';
          }
      }
      return s;
    }
    function stageSmokers(allowInView) {
      const door = frontageNear(300, 1100, allowInView);
      if (!door) return null;
      const s = makeScene('smokers', door.x + 16, door.y + 8);
      for (const side of [-1, 1])
        spawnSceneMember(s, 'smoker', { x: door.x + 16 + side * 6, y: door.y + 9, a: side > 0 ? Math.PI : 0 }, 'commuter', randomBetween(25, 60));
      return s;
    }
    function stageDelivery(allowInView) {
      const door = frontageNear(450, 1100, allowInView);
      if (!door) return null;
      const row = rowNear(door.y + 40),
        // Westbound traffic keeps to the north lane: double-park there, nose west.
        vx = door.x + 34,
        vy = row - 25,
        a = Math.PI;
      if (!cityStreetAt(vx, vy) || !canSpawnCar('van', vx, vy, a, 10)) return null;
      if (Math.abs(vx - roadNear(vx)) < 140) return null;
      const s = makeScene('delivery', door.x, door.y + 20, { door });
      s.van = makeCar('van', vx, vy, a, false, randomChoice(['#e8e4da', '#c9a342', '#8a2d2a', '#2f4f6a']));
      s.van.deliveryScene = s;
      s.van.occupied = false;
      s.stack = addSceneProp(s, 'boxes', vx + 38, row - sidewalkOffset(row, false) + 12, 0);
      s.boxes = Math.floor(randomBetween(4, 8));
      spawnSceneMember(s, 'worker', { x: vx + 32, y: row - 50, a: -Math.PI / 2 }, 'worker');
      return s;
    }
    function stageNightlife(place) {
      const door = place.door,
        s = makeScene('nightlife', door.x, door.y + 10, { place });
      spawnSceneMember(s, 'bouncer', { x: door.x + 13, y: door.y + 9, a: Math.PI }, 'bouncer');
      addSceneProp(s, 'rope', door.x - 20, door.y + 16, 0);
      const n = Math.floor(randomBetween(4, 8));
      for (let i = 0; i < n; i++)
        spawnSceneMember(s, 'queue', { x: door.x - 12 - i * 9, y: door.y + 9 + (i % 2) * 2, a: 0 }, 'reveller');
      for (const side of [-1, 1])
        spawnSceneMember(s, 'smoker', { x: door.x + 38 + side * 6, y: door.y + 14, a: side > 0 ? Math.PI : 0 }, 'reveller', randomBetween(30, 70));
      s.admitIn = randomBetween(6, 12);
      return s;
    }
    function stageBusStop(stop) {
      const s = makeScene('busStop', stop.x, stop.y, { stop });
      const n = Math.floor(randomBetween(1, 4.5));
      for (let i = 0; i < n; i++) {
        const seat = i < 2 && seededRandom() < 0.6,
          spot = seat
            ? { x: stop.x + (i ? 6 : -6), y: stop.y + 1, a: Math.PI / 2, seat: true }
            : { x: stop.x + randomBetween(-22, 22), y: stop.y + randomBetween(7, 12), a: Math.PI / 2 };
        spawnSceneMember(s, 'waiter', spot, pickWeighted(crowdRoleWeights(crowd.hour)) === 'commuter' ? 'commuter' : 'casual', randomBetween(40, 120));
      }
      return s;
    }
    /* The scene's own clock: serving, admitting, unloading, refilling. */
    function tickScene(s, step) {
      s.timer += step;
      const scared = sceneScared(s);
      if (s.kind === 'vendor') {
        s.serveIn -= step;
        const queue = s.members.filter((p) => p.sceneRole === 'customer');
        if (s.serveIn <= 0 && queue.length) {
          const first = queue.reduce((a, b) => (distanceBetween(a, s) < distanceBetween(b, s) ? a : b));
          s.serveIn = randomBetween(5, 9);
          first.carry = 'food';
          crowdSay(first, 'idle', 0.3);
          leaveScene(first);
          queue.splice(queue.indexOf(first), 1);
          queue.forEach((p, i) => (p.sceneSpot = { x: s.x + randomBetween(-3, 3), y: s.y + 12 + i * 9, a: -Math.PI / 2 }));
          const vendor = s.members.find((p) => p.sceneRole === 'vendor');
          if (vendor) crowdSay(vendor, 'vendor', 0.8);
        }
        if (!scared && queue.length < 3 && seededRandom() < 0.25)
          recruit(s, 110, (p) => sceneMember(s, p, 'customer', { x: s.x + randomBetween(-3, 3), y: s.y + 12 + queue.length * 9, a: -Math.PI / 2 }, 20));
      } else if (s.kind === 'busker') {
        const listeners = s.members.filter((p) => p.sceneRole === 'listener');
        if (!scared && listeners.length < 4 && seededRandom() < 0.3)
          recruit(s, 120, (p) => {
            const a = Math.PI / 2 + randomBetween(-1, 1),
              spot = { x: s.x + Math.cos(a) * randomBetween(28, 40), y: s.y + Math.sin(a) * randomBetween(24, 34) };
            spot.a = headingBetween(spot, s);
            sceneMember(s, p, 'listener', spot, randomBetween(8, 22));
          });
        const busker = s.members.find((p) => p.sceneRole === 'busker');
        if (busker && seededRandom() < step * 0.05) crowdSay(busker, 'busker', 1);
      } else if (s.kind === 'cafe') {
        const sitters = s.members.filter((p) => p.sceneRole === 'sitter');
        if (!scared && sitters.length < 4 && seededRandom() < 0.12) {
          const tables = s.props.filter((q) => q.kind === 'cafeTable'),
            t = randomChoice(tables);
          if (t) {
            const side = randomChoice([-1, 1]),
              spot = { x: t.x + side * 7.5, y: t.y, a: side > 0 ? Math.PI : 0 };
            if (!sitters.some((q) => distanceBetween(q.sceneSpot || q, spot) < 3))
              recruit(s, 110, (p) => {
                sceneMember(s, p, 'sitter', spot, randomBetween(30, 90));
                p.carry = 'coffee';
              });
          }
        }
      } else if (s.kind === 'nightlife') {
        const queue = s.members.filter((p) => p.sceneRole === 'queue'),
          bouncer = s.members.find((p) => p.sceneRole === 'bouncer'),
          door = s.place.door;
        s.admitIn -= step;
        if (s.admitIn <= 0 && queue.length && bouncer) {
          s.admitIn = randomBetween(7, 14);
          const first = queue.reduce((a, b) => (a.sceneSpot.x > b.sceneSpot.x ? a : b));
          crowdSay(bouncer, 'bouncer', 0.7);
          if (seededRandom() < 0.15) {
            // Turned away.
            leaveScene(first);
            crowdSay(first, 'queue', 1);
          } else {
            first.sceneRole = 'entering';
            first.sceneSpot = { x: door.x, y: door.y + 2, a: -Math.PI / 2 };
          }
          queue.splice(queue.indexOf(first), 1);
          queue
            .sort((a, b) => b.sceneSpot.x - a.sceneSpot.x)
            .forEach((p, i) => (p.sceneSpot = { x: door.x - 12 - i * 9, y: door.y + 9 + (i % 2) * 2, a: 0 }));
        }
        if (!scared && queue.length < 7 && seededRandom() < 0.3)
          recruit(s, 160, (p) => sceneMember(s, p, 'queue', { x: door.x - 12 - queue.length * 9, y: door.y + 9, a: 0 }));
        for (const p of s.members)
          if (p.sceneRole === 'entering' && distanceBetween(p, door) < 5) {
            const k = pedestrians.indexOf(p);
            leaveScene(p);
            if (k >= 0) pedestrians.splice(k, 1);
          }
      } else if (s.kind === 'busStop') {
        const waiters = s.members.filter((p) => p.sceneRole === 'waiter');
        if (!scared && waiters.length < 4 && seededRandom() < 0.08)
          recruit(s, 100, (p) =>
            sceneMember(s, p, 'waiter', { x: s.x + randomBetween(-22, 22), y: s.y + randomBetween(7, 12), a: Math.PI / 2 }, randomBetween(40, 120)),
          );
        updateBusArrival(s);
      } else if (s.kind === 'delivery') updateDeliveryScene(s, step);
      else if (s.kind === 'hail') updateHailScene(s);
    }
