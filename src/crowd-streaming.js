    // Streaming stops adding walkers at CROWD_STREET_CAP; scenes and drivers may
    // take the total up to CROWD_HARD_CAP.
    const CROWD_STREET_TARGET = 360,
      CROWD_STREET_CAP = 600,
      CROWD_HARD_CAP = 680,
      CROWD_RING = 1250;
    const DISTRICT_BUSTLE = {
      MIDTOWN: 1.15,
      BROADWAY: 1.25,
      'EXCHANGE DISTRICT': 1.1,
      'NORTHBANK · OLD QUARTER': 1,
      'SOUTH BANK': 0.9,
      'BATTERY POINT': 0.85,
      'IRONWORKS DOCKS': 0.35,
      'PALM KEYS · ART DECO': 1.05,
      'OCEAN DRIVE': 1.2,
      'LITTLE HAVANA': 1.1,
      'CORAL MARINA': 0.8,
      'NORTH POINT · FINANCIAL': 1.1,
      'THE RECLAMATION': 0.75,
      'CENTRAL GARDEN': 0.8,
    };
    function districtBustle(x, y) {
      if (!inCityGrid(x, y)) return 0;
      return DISTRICT_BUSTLE[districtAt(x, y)] ?? 0.5;
    }
    /* A walker the streamer may move: on the street grid and not busy with anything. */
    function streamableWalker(p) {
      return (
        ordinaryWalker(p) &&
        !p.posed &&
        !p.stroll &&
        !p.onDeck &&
        !p.parkGuest &&
        !p.react &&
        !p.pending &&
        !p.scene &&
        !p.injured &&
        !(p.flee > 0) &&
        !p.knockedFor &&
        inCityGrid(p.x, p.y)
      );
    }
    function crowdSpawnSpot(allowInView = false) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const vertical = seededRandom() < 0.5,
          road = vertical
            ? roadNear(player.x + randomBetween(-CROWD_RING, CROWD_RING))
            : rowNear(player.y + randomBetween(-CROWD_RING, CROWD_RING)),
          along = vertical
            ? player.y + randomBetween(-CROWD_RING, CROWD_RING)
            : player.x + randomBetween(-CROWD_RING, CROWD_RING),
          off = sidewalkOffset(road, vertical) * randomChoice([-1, 1]) + randomBetween(-6, 6),
          x = vertical ? road + off : along,
          y = vertical ? along : road + off;
        if (!inCityGrid(x, y) || (!allowInView && crowdInView(x, y, 70))) continue;
        if (crowdOnRoad(x, y) || solid(x, y, 5) || inHarbor(x, y, 8) || !landAt(x, y)) continue;
        if (!(vertical ? cityStreetAt(road, y) : cityStreetAt(x, road))) continue;
        let crowded = false;
        forPeopleNear(x, y, 12, () => (crowded = true));
        if (crowded || vehicles.some((c) => Math.abs(c.x - x) < 60 && Math.abs(c.y - y) < 60 && pointInCar(x, y, c, 10)))
          continue;
        return { x, y, vertical, a: vertical ? randomChoice([-Math.PI / 2, Math.PI / 2]) : randomChoice([0, Math.PI]) };
      }
      return null;
    }
    function resetWalkerState(p) {
      if (p.bench) p.bench.taken = null;
      Object.assign(p, {
        bench: null,
        sitting: false,
        state: 'walk',
        walking: true,
        flee: 0,
        react: null,
        pending: null,
        threat: null,
        speech: null,
        speechUntil: 0,
        shakenUntil: 0,
        onPhone: false,
        injured: false,
        pose: null,
        timer: randomBetween(2, 9),
        cornerKey: null,
        turnPlan: 0,
        waiting: false,
        chatWith: null,
        scene: null,
      });
    }
    function makeStreetWalker(spot, role) {
      const p = {
        x: spot.x,
        y: spot.y,
        a: spot.a,
        dir: spot.a,
        hp: 30,
        flee: 0,
        timer: randomBetween(1, 9),
        walk: seededRandom() * 5,
        state: 'walk',
      };
      dressPerson(p, role);
      pedestrians.push(p);
      return p;
    }
    /* Couples walk together and parents keep a child at their side. */
    function addCompanion(leader, role) {
      if (pedestrians.length >= CROWD_STREET_CAP) return null;
      const side = randomChoice([-1, 1]),
        x = leader.x + Math.cos(leader.a + Math.PI / 2) * 9 * side,
        y = leader.y + Math.sin(leader.a + Math.PI / 2) * 9 * side;
      if (solid(x, y, 5)) return null;
      const q = { x, y, a: leader.a, hp: 30, flee: 0, timer: 5, walk: 0, state: 'walk', leader, pairSide: side };
      dressPerson(q, role);
      pedestrians.push(q);
      return q;
    }
    function placeWalker(p, spot, followers) {
      resetWalkerState(p);
      p.x = spot.x;
      p.y = spot.y;
      p.a = p.dir = spot.a;
      let role = pickWeighted(crowdRoleWeights(crowd.hour));
      if (role === 'family' || role === 'couple') role = role === 'family' ? 'shopper' : 'casual';
      p.dog = null;
      dressPerson(p, role);
      if (p.dog) Object.assign(p.dog, { x: p.x - 10, y: p.y + 6 });
      for (const q of followers.get(p) || []) {
        resetWalkerState(q);
        q.x = p.x + Math.cos(p.a + Math.PI / 2) * 9 * (q.pairSide || 1);
        q.y = p.y + Math.sin(p.a + Math.PI / 2) * 9 * (q.pairSide || 1);
        q.a = p.a;
        dressPerson(q, q.role === 'kid' ? 'kid' : 'casual');
      }
    }
    function streamCrowd(deltaSeconds) {
      crowd.timers.stream -= deltaSeconds;
      if (crowd.timers.stream > 0) return;
      crowd.timers.stream = 0.5;
      const bustle = districtBustle(player.x, player.y);
      // Out in the county or over the water nobody is moved: the city keeps its crowd.
      if (bustle <= 0) return;
      const settle =
        crowd.settledAt === null || Math.hypot(player.x - crowd.settledAt.x, player.y - crowd.settledAt.y) > 2600;
      const target = Math.round(CROWD_STREET_TARGET * crowd.tempo.out * bustle),
        followers = new Map(),
        far = [];
      let near = 0;
      for (const p of pedestrians)
        if (p.leader && p.hp > 0) {
          if (!followers.has(p.leader)) followers.set(p.leader, []);
          followers.get(p.leader).push(p);
        }
      for (const p of pedestrians) {
        if (p.leader || !streamableWalker(p)) continue;
        const dx = Math.abs(p.x - player.x),
          dy = Math.abs(p.y - player.y);
        if (dx < CROWD_RING + 150 && dy < CROWD_RING + 150) near += 1 + (followers.get(p)?.length || 0);
        else if (!crowdInView(p.x, p.y, 100)) far.push(p);
      }
      if (near < target) {
        const moves = Math.min(far.length, target - near, settle ? 600 : 16);
        let moved = 0;
        for (; moved < moves; moved++) {
          const spot = crowdSpawnSpot(settle);
          if (!spot) break;
          placeWalker(far[moved], spot, followers);
        }
        // Not enough people in the whole city: add some.
        const add = Math.min(settle ? 200 : 10, target - near - moved, CROWD_STREET_CAP - pedestrians.length);
        for (let i = 0; i < add; i++) {
          const spot = crowdSpawnSpot(settle);
          if (!spot) break;
          const p = makeStreetWalker(spot, pickWeighted(crowdRoleWeights(crowd.hour)));
          if (p.role === 'family') {
            p.role = 'shopper';
            addCompanion(p, 'kid');
          } else if (p.role === 'couple' && seededRandom() < 0.8) addCompanion(p, 'casual');
          else if (seededRandom() < 0.12) addCompanion(p, 'casual');
        }
      } else if (near > target + 30) {
        // Thin quietly: people at the fringe, out of sight, go home.
        let remove = Math.min(8, near - target);
        for (let i = pedestrians.length - 1; i >= 0 && remove > 0; i--) {
          const p = pedestrians[i];
          if (p.leader || !streamableWalker(p) || followers.has(p)) continue;
          if (crowdInView(p.x, p.y, 120)) continue;
          pedestrians.splice(i, 1);
          remove--;
        }
      }
      // The day moves on even when the player does not: out of sight, people
      // whose role no longer fits the hour (commuters at midnight, revellers at
      // nine in the morning) are swapped for someone who does.
      const weights = crowdRoleWeights(crowd.hour);
      let swaps = 6;
      for (const p of pedestrians) {
        if (swaps <= 0) break;
        if (p.leader || !streamableWalker(p) || weights[p.role] || p.role === 'casual' || p.role === 'kid') continue;
        if (crowdInView(p.x, p.y, 120)) continue;
        const spot = crowdSpawnSpot(false);
        if (!spot) break;
        placeWalker(p, spot, followers);
        swaps--;
      }
      // The dead are left where they fell until nobody is looking.
      for (let i = pedestrians.length - 1; i >= 0; i--) {
        const p = pedestrians[i];
        if (p.hp > 0 || gameTime - (p.deadTime || 0) < 90) continue;
        if (distanceBetween(p, player) > 1400 && !crowdInView(p.x, p.y, 200)) {
          pedestrians.splice(i, 1);
          for (const q of pedestrians) if (q.leader === p) q.leader = null;
        }
      }
      if (settle) {
        crowd.settledAt = { x: player.x, y: player.y };
        crowd.settleStamp = gameTime;
      }
    }
