    // Theme park crowd: lines, spots, queues and guests (spawnParkGuest).
    // ---- The park crowd --------------------------------------------------------------
    /**
     * Guests are ordinary pedestrians (drawn by the instanced crowd) flagged
     * `parkGuest`: they walk the promenade graph from attraction to attraction,
     * stop to watch, and stand in the queues for the Falcon, the Eye and the
     * flume, which move up when a train or a capsule takes the front of the line.
     * They are only on the island while the player is near it.
     */
    const PARK_LINES = [
      'One more go on the Falcon.',
      'I am not going on that.',
      'Look at the Eye, it goes up forever.',
      'The fountain show starts on the hour.',
      'Hold my phone.',
      'You can see the whole city from the top.',
      'Three tickets left.',
      'I felt my stomach leave.',
      'Best shawarma on the coast.',
      'Meet by the carousel at six.',
      'Did you hear them scream?',
      'The hotel has a pool on the roof.',
    ];
    const PARK_SPOTS = [
      { name: 'coaster', x: 2700, y: -6360 },
      { name: 'lagoon', x: 3170, y: -6205 },
      { name: 'lagoon', x: 3380, y: -6400 },
      { name: 'lagoon', x: 2960, y: -6400 },
      { name: 'eye', x: 3500, y: -6040 },
      { name: 'carousel', x: 3500, y: -6350 },
      { name: 'swing', x: 3700, y: -6350 },
      { name: 'dark', x: 3720, y: -6370 },
      { name: 'bumper', x: 3480, y: -6370 },
      { name: 'flume', x: 3960, y: -6450 },
      { name: 'midway', x: 3895, y: -6250 },
      { name: 'food', x: 3700, y: -6690 },
      { name: 'hotel', x: 3450, y: -6690 },
      { name: 'beach', x: 3600, y: -6860 },
      { name: 'garden', x: 2560, y: -6110 },
      { name: 'gate', x: 3200, y: -6060 },
      { name: 'unicorn', x: PIER.unicorn.x, y: PIER.unicorn.y },
      { name: 'unicorn', x: PIER.unicorn.x, y: PIER.unicorn.y },
    ];
    /* UNICORN STATUE: where a guest stops to look at (and photograph) Aurora:
       somewhere round her plinth on the paving or the lawn, a few metres
       back. Guests come along the walk from the east gate promenade (west of
       her) and go round the plinth in steps (unicornArc), and leave the same
       way (unicornExit), so they never cut across it. */
    function unicornArc(a) {
      const U = PIER.unicorn,
        ring = U.r + 16,
        points = [];
      for (let k = 1, steps = Math.ceil((Math.PI - Math.abs(a)) / 0.7); k <= steps; k++) {
        const b = Math.sign(a || 1) * (Math.PI - ((Math.PI - Math.abs(a)) * k) / steps);
        points.push({ x: U.x + Math.cos(b) * ring, y: U.y + Math.sin(b) * ring });
      }
      return points;
    }
    const unicornWalkEnd = () => ({ x: PIER.unicorn.x - PIER.unicorn.apron - 6, y: PIER.unicorn.y + 6 });
    function unicornViewpoint() {
      const U = PIER.unicorn,
        a = randomBetween(-Math.PI, Math.PI),
        r = U.r + randomBetween(12, 34);
      return [unicornWalkEnd(), ...unicornArc(a), { x: U.x + Math.cos(a) * r, y: U.y + Math.sin(a) * r, linger: true, faceTo: U }];
    }
    function unicornExit(person) {
      const U = PIER.unicorn;
      if (Math.hypot(person.x - U.x, person.y - U.y) > U.apron + 24) return [];
      return [...unicornArc(Math.atan2(person.y - U.y, person.x - U.x)).reverse(), unicornWalkEnd()];
    }
    /* Queue lines: slots from the front of the line back. */
    const PARK_QUEUES = {
      coaster: { slots: queueSlots([[2610, -6395], [2510, -6395], [2510, -6380], [2640, -6380], [2640, -6365], [2690, -6365]], 7) },
      eye: { slots: queueSlots([[3520, -6050], [3440, -6050], [3440, -6035], [3380, -6035]], 7) },
      flume: { slots: queueSlots([[3995, -6450], [3950, -6450], [3950, -6435], [3920, -6435]], 7) },
    };
    function queueSlots(points, gap) {
      const slots = [];
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1],
          [bx, by] = points[i],
          len = Math.hypot(bx - ax, by - ay),
          heading = Math.atan2(ay - by, ax - bx);
        for (let d = 0; d < len; d += gap) slots.push({ x: ax + ((bx - ax) * d) / len, y: ay + ((by - ay) * d) / len, a: heading });
      }
      return slots;
    }
    let parkCrowdLive = false,
      parkCrowdClock = 0;
    const PARK_CENTER = { x: 3050, y: -6380 };
    function parkGuestTarget() {
      const hour = (worldMinutes % 1440) / 60;
      if (hour < 7) return 24;
      if (hour < 10) return 70;
      return 140;
    }
    function spawnParkGuest(x, y, queue) {
      const p = {
        x,
        y,
        a: randomBetween(0, TAU),
        hp: 30,
        color: randomChoice(DRIVER_COLORS),
        flee: 0,
        timer: randomBetween(1, 7),
        walk: seededRandom() * 5,
        state: 'walk',
        parkGuest: true,
        role: seededRandom() < 0.18 ? 'kid' : 'casual',
      };
      if (queue) {
        p.parkQueue = queue;
        p.walking = false;
      }
      pedestrians.push(p);
      return p;
    }
    function updateParkCrowd(deltaSeconds) {
      parkCrowdClock -= deltaSeconds;
      if (parkCrowdClock > 0) return;
      parkCrowdClock = 1.5;
      const near = Math.hypot(player.x - PARK_CENTER.x, player.y - PARK_CENTER.y) < 2900;
      if (!near) {
        if (parkCrowdLive) {
          for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].parkGuest) pedestrians.splice(i, 1);
          parkCrowdLive = false;
        }
        return;
      }
      const guests = pedestrians.filter((p) => p.parkGuest && p.hp > 0),
        target = parkGuestTarget();
      if (!parkCrowdLive) {
        parkCrowdLive = true;
        // Fill the queues first, then the promenades.
        for (const [name, q] of Object.entries(PARK_QUEUES)) {
          const filled = Math.floor(q.slots.length * (target > 60 ? 0.85 : 0.3));
          for (let i = 0; i < filled; i++) {
            const s = q.slots[i],
              p = spawnParkGuest(s.x + randomBetween(-1.5, 1.5), s.y + randomBetween(-1.5, 1.5), name);
            p.queueSlot = i;
            p.a = s.a;
          }
        }
        const nodes = parkPathGraph();
        for (let i = 0; i < target; i++) {
          const n = nodes[Math.floor(seededRandom() * nodes.length)],
            m = nodes[n.links[0] ?? 0],
            f = seededRandom(),
            x = n.x + (m.x - n.x) * f + randomBetween(-10, 10),
            y = n.y + (m.y - n.y) * f + randomBetween(-10, 10);
          if (!parkBlocked(x, y, 6)) spawnParkGuest(x, y);
        }
        return;
      }
      // Top up gently from the gate and the bus stop.
      if (guests.length < target + 20 && seededRandom() < 0.6) spawnParkGuest(PIER.gate.x + randomBetween(-40, 40), -6050);
    }
    /* A ride takes (n > 0) or returns (n < 0) riders: the queue moves up. */
    function parkCrowdBoard(name, n) {
      const q = PARK_QUEUES[name];
      if (!q || !parkCrowdLive || n < 0) return;
      const inLine = pedestrians.filter((p) => p.parkQueue === name).sort((a, b) => a.queueSlot - b.queueSlot);
      inLine.forEach((p, i) => {
        if (i < n) {
          // Off to ride: they leave the line and wander off afterwards.
          p.parkQueue = null;
          p.queueSlot = null;
          p.x = PIER.station.x + randomBetween(-30, 30);
          p.y = PIER.station.y + 60;
          p.parkGoal = null;
          p.timer = 0;
        } else p.queueSlot = i - n;
      });
    }
    function updateParkGuest(person, deltaSeconds) {
      if (!person.parkGuest || person.flee > 0 || person.hp <= 0) {
        if (person.parkGuest && person.parkQueue) person.parkQueue = null;
        return false;
      }
      if (person.parkQueue) {
        // Shuffle up to the slot, then stand facing the front of the line.
        const q = PARK_QUEUES[person.parkQueue],
          slot = q.slots[Math.min(q.slots.length - 1, person.queueSlot)],
          d = Math.hypot(slot.x - person.x, slot.y - person.y);
        if (d > 2) {
          person.a = Math.atan2(slot.y - person.y, slot.x - person.x);
          person.walking = true;
          person.walk += deltaSeconds * 5;
          const step = Math.min(d, 18 * deltaSeconds);
          person.x += Math.cos(person.a) * step;
          person.y += Math.sin(person.a) * step;
        } else {
          person.walking = false;
          person.a = slot.a + Math.sin(gameTime * 0.3 + person.walk) * 0.4;
        }
        if ((person.speechUntil || 0) <= gameTime && seededRandom() < deltaSeconds * 0.01) {
          person.speech = randomChoice(['Is it always this long?', 'Nearly there.', 'Front row!', 'I can hear them screaming.']);
          person.speechUntil = gameTime + 3;
        }
        return true;
      }
      person.timer -= deltaSeconds;
      if (!person.parkRoute || person.timer <= 0) {
        if (person.parkRoute && person.parkRoute.length) {
          // still walking
        } else {
          person.timer = 4 + seededRandom() * 10;
          // Now and then join a queue; otherwise pick an attraction to walk to.
          const q = seededRandom() < 0.12 ? randomChoice(Object.keys(PARK_QUEUES)) : null;
          if (q) {
            const taken = pedestrians.filter((p) => p.parkQueue === q).length;
            if (taken < PARK_QUEUES[q].slots.length) {
              person.parkQueue = q;
              person.queueSlot = taken;
              return true;
            }
          }
          const spot = randomChoice(PARK_SPOTS),
            route = parkRoute(nearestParkNode(person.x, person.y), nearestParkNode(spot.x, spot.y));
          person.pose = null;
          person.parkRoute = route ? route.map((i) => parkPathGraph()[i]).map((n) => ({ x: n.x + randomBetween(-12, 12), y: n.y + randomBetween(-12, 12) })) : [];
          // UNICORN STATUE: away from her round the plinth, not across it.
          person.parkRoute.unshift(...unicornExit(person));
          if (spot.name === 'unicorn') person.parkRoute.push(...unicornViewpoint());
          else person.parkRoute.push({ x: spot.x + randomBetween(-20, 20), y: spot.y + randomBetween(-16, 16), linger: true });
          if ((person.speechUntil || 0) <= gameTime && seededRandom() < 0.25) {
            person.speech = randomChoice(PARK_LINES);
            person.speechUntil = gameTime + 3;
          }
        }
      }
      const goal = person.parkRoute?.[0];
      if (!goal) {
        person.walking = false;
        return true;
      }
      if (Math.hypot(goal.x - person.x, goal.y - person.y) < 8) {
        person.parkRoute.shift();
        if (goal.linger) {
          person.walking = false;
          person.parkRoute = null;
          person.timer = 3 + seededRandom() * 9;
          // Look at whatever they came for; at the unicorn most hold up a
          // phone for a photo (the crowd's filming pose).
          if (goal.faceTo) {
            person.a = headingBetween(person, goal.faceTo);
            person.pose = seededRandom() < 0.65 ? 'film' : null;
            person.timer += 4;
          } else person.a += randomBetween(-1, 1);
        }
        return true;
      }
      person.a = headingBetween(person, goal);
      person.walking = true;
      person.walk += deltaSeconds * 6;
      if (moveBody(person, Math.cos(person.a) * 4.5 * KMH * deltaSeconds, Math.sin(person.a) * 4.5 * KMH * deltaSeconds, 5)) {
        person.stuck = (person.stuck || 0) + deltaSeconds;
        if (person.stuck > 2) {
          person.parkRoute = null;
          person.stuck = 0;
        }
      }
      return true;
    }
    function populateSunsetPier() {
      // Guests arrive with the player (updateParkCrowd); nothing to do at world build.
      parkCrowdLive = false;
    }
