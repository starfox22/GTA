    // Monarch Isle walkers and staff: walk routes, destinations, dress and updateMonarchCrowd().
    // A route over the walk graph (breadth-first: the graph is small).
    function isleWalkRoute(from, to) {
      const nodes = isleWalkNodes(),
        prev = new Map([[from.id, null]]),
        queue = [from.id];
      while (queue.length) {
        const id = queue.shift();
        if (id === to.id) break;
        for (const next of nodes[id].links)
          if (!prev.has(next)) {
            prev.set(next, id);
            queue.push(next);
          }
      }
      if (!prev.has(to.id)) return null;
      const path = [];
      for (let id = to.id; id !== null; id = prev.get(id)) path.unshift(nodes[id]);
      return path;
    }
    function isleNearestWalkNode(x, y) {
      let best = null,
        bd = Infinity;
      for (const n of isleWalkNodes()) {
        if (!n.links.length) continue;
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      return best;
    }
    // Where walkers go: shop doors (and in), the garden's sights, the fountains, the marina, the beach.
    function isleDestinations() {
      const list = [];
      for (const s of monarchPlan.shops) if (s.door) list.push({ x: s.door.x, y: s.door.y, kind: 'door', name: s.name });
      for (const n of isleWalkNodes()) if (n.tag === 'photo' || n.tag === 'beach' || n.tag === 'promenade') list.push({ x: n.x, y: n.y, kind: n.tag, node: n });
      for (const c of ISLE_CIRCLES) list.push({ x: c.x, y: c.y + c.walk - 18, kind: 'fountain', face: c });
      return list;
    }
    const ISLE_PALETTE = {
      tops: ['#f4f1ea', '#1c2a44', '#e8dcc0', '#2a2d33', '#c9b48a', '#f2e6e0', '#6b2f36', '#dfe8ee', '#b8c8b0', '#101214'],
      pants: ['#f2efe6', '#1c2a44', '#c9b48a', '#2a2d33', '#e8e2d6', '#3a3f4a'],
      shoes: ['#3a2618', '#f0eee8', '#141414', '#8a6d4a'],
    };
    function dressIsleWalker(p, role) {
      dressPerson(p, role);
      const L = p.look;
      if (role !== 'jogger') {
        L.top = p.color = randomChoice(ISLE_PALETTE.tops);
        L.pants = randomChoice(ISLE_PALETTE.pants);
        L.shoes = randomChoice(ISLE_PALETTE.shoes);
        if (role === 'shopper' || role === 'tourist') p.carry = randomChoice(['shopping', 'shopping', 'handbag', 'handbag', null]);
        L.hat = seededRandom() < 0.18 ? 1 : 0;
        L.hatColor = randomChoice(['#e8dcc0', '#f4f1ea', '#1c2a44']);
      }
      return p;
    }
    let isleCrowdClock = 0,
      isleCrowdLive = false;
    function isleCrowdTarget() {
      const hour = (worldMinutes % 1440) / 60;
      if (hour < 6) return 18;
      if (hour < 8) return 44;
      if (hour < 20) return 110;
      return 60;
    }
    function spawnIsleWalker(node, role) {
      const p = {
        x: node.x + randomBetween(-6, 6),
        y: node.y + randomBetween(-6, 6),
        a: randomBetween(0, TAU),
        hp: 30,
        flee: 0,
        timer: randomBetween(0, 4),
        walk: seededRandom() * 5,
        state: 'walk',
        isle: { route: null, stay: 0 },
      };
      dressIsleWalker(p, role);
      if (solid(p.x, p.y, 5)) return null;
      pedestrians.push(p);
      return p;
    }
    /* Standing staff: doormen and valets at the hotel and the restaurant, guards at the villa gates. */
    function isleStaffPosts() {
      const posts = [];
      for (const s of monarchPlan.shops) {
        if (!s.door) continue;
        if (s.trade === 'hotel') posts.push({ x: s.door.x - 16, y: s.door.y + 4, a: Math.PI / 2, role: 'doorman' }, { x: s.door.x + 16, y: s.door.y + 4, a: Math.PI / 2, role: 'doorman' }, { x: s.door.x + 40, y: s.door.y + 40, a: Math.PI / 2, role: 'valet' });
        if (s.trade === 'restaurant') posts.push({ x: s.door.x + 20, y: s.door.y + 10, a: Math.PI / 2, role: 'valet' });
        if (s.trade === 'bank' || s.trade === 'jewellery') posts.push({ x: s.door.x + 14, y: s.door.y + 6, a: Math.PI / 2, role: 'guard' });
      }
      for (const plan of monarchPlan.villas) {
        const g = plan.gateAt,
          out = plan.villa.gate === 'south' ? 1 : plan.villa.gate === 'west' ? 0 : -1;
        if (plan.gateAxis === 'y') posts.push({ x: g.x + plan.gateWidth / 2 + 12, y: g.y + out * 10, a: out > 0 ? Math.PI / 2 : -Math.PI / 2, role: 'guard' });
        else posts.push({ x: g.x - 10, y: g.y + plan.gateWidth / 2 + 12, a: Math.PI, role: 'guard' });
      }
      return posts;
    }
    function spawnIsleStaff(post) {
      const p = {
        x: post.x,
        y: post.y,
        a: post.a,
        hp: 30,
        flee: 0,
        timer: 0,
        walk: 0,
        state: 'walk',
        isle: { post },
      };
      dressPerson(p, post.role === 'guard' ? 'bouncer' : 'worker');
      if (post.role === 'guard') {
        p.look.top = p.color = '#15171a';
        p.look.pants = '#15171a';
      } else {
        p.look.top = p.color = post.role === 'valet' ? '#6b1f24' : '#1c2a44';
        p.look.pants = '#15171a';
        p.look.hat = post.role === 'doorman' ? 1 : 0;
        p.look.hatColor = '#1c2a44';
      }
      p.pace = 0.9;
      pedestrians.push(p);
    }
    function updateMonarchCrowd(deltaSeconds) {
      isleCrowdClock -= deltaSeconds;
      if (isleCrowdClock > 0) return;
      isleCrowdClock = 1.5;
      const near = nearMonarchIsle(player.x, player.y, 1400);
      if (!near) {
        if (isleCrowdLive) {
          for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].isle && pedestrians[i].hp > 0 && !crowdInView(pedestrians[i].x, pedestrians[i].y, 100)) pedestrians.splice(i, 1);
          isleCrowdLive = pedestrians.some((p) => p.isle);
        }
        return;
      }
      const nodes = isleWalkNodes().filter((n) => n.links.length),
        walkers = pedestrians.filter((p) => p.isle && !p.isle.post && p.hp > 0).length;
      if (!isleCrowdLive) {
        isleCrowdLive = true;
        for (const post of isleStaffPosts()) spawnIsleStaff(post);
      }
      const target = isleCrowdTarget(),
        add = Math.min(isleCrowdLive && walkers === 0 ? target : 6, target - walkers);
      for (let i = 0; i < add; i++) {
        const node = nodes[Math.floor(seededRandom() * nodes.length)];
        if (crowdInView(node.x, node.y, 40) && walkers > 0) continue;
        const hour = (worldMinutes % 1440) / 60,
          role = pickWeighted(hour < 9 ? { jogger: 3, dogWalker: 3, commuter: 2, casual: 1 } : hour < 19 ? { shopper: 4, tourist: 3, casual: 2, dogWalker: 1.2, jogger: 0.8, elder: 1, couple: 1 } : { couple: 3, casual: 2, tourist: 1, dogWalker: 1 });
        const p = spawnIsleWalker(node, role === 'couple' ? 'casual' : role);
        if (p && role === 'couple') {
          const q = addCompanion(p, 'casual');
          if (q) {
            dressIsleWalker(q, 'casual');
            q.isle = { follow: p };
          }
        }
      }
    }
    /* A walker's turn (updatePeople calls it for everyone; it takes `p.isle`). */
    function updateIsleWalker(p, deltaSeconds) {
      if (!p.isle || p.hp <= 0) return false;
      if (p.flee > 0 || p.react || p.knockedFor || p.injured) return false;
      const s = p.isle;
      if (s.follow) {
        // A companion keeps to the leader's side and stops when they stop.
        const L = s.follow;
        if (L.hp <= 0 || !pedestrians.includes(L)) {
          s.follow = null;
          s.route = null;
          return true;
        }
        const tx = L.x + Math.cos(L.a + Math.PI / 2) * 9,
          ty = L.y + Math.sin(L.a + Math.PI / 2) * 9,
          d = Math.hypot(tx - p.x, ty - p.y);
        p.walking = d > 3;
        if (p.walking) {
          const speed = Math.min(d * 2, 7 * KMH);
          p.a = Math.atan2(ty - p.y, tx - p.x);
          p.walk += deltaSeconds * strideRate(speed);
          moveBody(p, Math.cos(p.a) * speed * deltaSeconds, Math.sin(p.a) * speed * deltaSeconds, 5);
        } else {
          p.a = L.a;
          p.pose = L.pose === 'film' ? 'watch' : null;
        }
        return true;
      }
      if (s.post) {
        // Staff keep their post: a glance round now and then, arms folded.
        const d = Math.hypot(s.post.x - p.x, s.post.y - p.y);
        if (d > 4) {
          p.a = headingBetween(p, s.post);
          p.walking = true;
          p.walk += deltaSeconds * strideRate(4 * KMH);
          moveBody(p, Math.cos(p.a) * 4 * KMH * deltaSeconds, Math.sin(p.a) * 4 * KMH * deltaSeconds, 5);
          return true;
        }
        p.walking = false;
        p.pose = s.post.role === 'guard' ? 'arms' : s.post.role === 'valet' ? 'wait' : null;
        p.a = s.post.a + Math.sin(gameTime * 0.2 + p.walk) * 0.4;
        if (distanceBetween(p, player) < 60 && (p.speechUntil || 0) < gameTime && seededRandom() < deltaSeconds * 0.4) {
          p.speech = randomChoice(s.post.role === 'guard' ? ISLE_LINES.guard : ISLE_LINES.valet);
          p.speechUntil = gameTime + 3;
        }
        return true;
      }
      if (s.stay > 0) {
        // Stopped: looking, photographing, or indoors (hidden) for a while.
        s.stay -= deltaSeconds;
        p.walking = false;
        if (s.stay <= 0) {
          p.pose = p.dog ? 'leash' : null;
          s.route = null;
        }
        return true;
      }
      if (!s.route || !s.route.length) {
        const start = isleNearestWalkNode(p.x, p.y);
        if (!start) return false;
        const dests = isleDestinations(),
          dest = p.role === 'jogger' ? null : dests[Math.floor(seededRandom() * dests.length)],
          goal = dest ? dest.node || isleNearestWalkNode(dest.x, dest.y) : isleWalkNodes()[start.links[Math.floor(seededRandom() * start.links.length)]],
          route = goal ? isleWalkRoute(start, goal) : null;
        s.route = route ? route.map((n) => ({ x: n.x + randomBetween(-5, 5), y: n.y + randomBetween(-5, 5) })) : [];
        s.dest = dest;
        if (dest && dest.kind === 'door') s.route.push({ x: dest.x, y: dest.y, door: true });
        if (dest && (dest.kind === 'photo' || dest.kind === 'fountain' || dest.kind === 'promenade' || dest.kind === 'beach')) s.route.push({ x: dest.x + randomBetween(-14, 14), y: dest.y + randomBetween(-10, 10), look: true });
        if (!s.route.length) {
          s.stay = 3;
          return true;
        }
      }
      const goal = s.route[0];
      if (Math.hypot(goal.x - p.x, goal.y - p.y) < 8) {
        s.route.shift();
        if (goal.door && seededRandom() < 0.5) {
          // In through the door for a minute or two.
          s.stay = randomBetween(20, 70);
          goIndoors(p, goal, s.stay, 'shop');
          return true;
        }
        if (goal.look) {
          s.stay = randomBetween(5, 14);
          const sight = s.dest?.face || (s.dest?.kind === 'photo' ? MONARCH_GARDEN.house : null);
          if (sight) p.a = headingBetween(p, { x: sight.x, y: sight.y });
          else p.a += randomBetween(-1, 1);
          p.pose = seededRandom() < 0.55 ? 'film' : seededRandom() < 0.5 ? 'point' : null;
          if ((p.speechUntil || 0) < gameTime && seededRandom() < 0.3) {
            p.speech = randomChoice(ISLE_LINES[s.dest?.kind] || ISLE_LINES.street);
            p.speechUntil = gameTime + 3;
          }
        }
        return true;
      }
      // At the kerb, look both ways: wait while a car is coming (up to 12 s).
      const onRoadNow = monarchRoadAt(p.x, p.y, 2),
        toward = headingBetween(p, goal);
      if (!onRoadNow && monarchRoadAt(p.x + Math.cos(toward) * 10, p.y + Math.sin(toward) * 10, 2) && (s.kerb || 0) < 12) {
        let coming = false;
        for (const o of vehicles) {
          if (o.hp <= 0 || (o.altitude || 0) > 15) continue;
          const dx = p.x - o.x,
            dy = p.y - o.y,
            d = Math.hypot(dx, dy);
          if (d > 190) continue;
          const v = Math.hypot(o.vx || 0, o.vy || 0);
          if (d < 50 || (v > 12 && (dx * (o.vx || 0) + dy * (o.vy || 0)) / (v * d) > 0.55)) {
            coming = true;
            break;
          }
        }
        if (coming) {
          s.kerb = (s.kerb || 0) + deltaSeconds;
          p.walking = false;
          p.a = toward;
          return true;
        }
      }
      if (!onRoadNow) s.kerb = 0;
      // Brisker across a carriageway, so traffic is not held for long.
      const speed = (p.role === 'jogger' ? 11 : 4.6) * KMH * (p.pace || 1) * (p.role === 'jogger' ? 1 : 0.9) * (onRoadNow ? 1.5 : 1);
      p.a = headingBetween(p, goal);
      p.walking = true;
      p.pose = p.dog ? 'leash' : p.texting ? 'text' : null;
      p.walk += deltaSeconds * strideRate(speed);
      const stepX = Math.cos(p.a) * speed * deltaSeconds,
        stepY = Math.sin(p.a) * speed * deltaSeconds;
      let held = moveBody(p, stepX, stepY, 5);
      if (held && onRoadNow && !solid(p.x + stepX, p.y + stepY, 5)) {
        // On a zebra with a car's nose over it: squeeze past the bumper rather
        // than stand in the road (the car is waiting for them).
        p.x += stepX;
        p.y += stepY;
        held = false;
      }
      if (held) {
        // Held up (a tree, a lantern, a parked car): step round it to one side,
        // then the other; after a few tries plan afresh from where they stand. A
        // node is never skipped for the next one, which would send them in a
        // straight line across whatever lies between (a carriageway, a garden).
        s.stuck = (s.stuck || 0) + deltaSeconds;
        if (s.stuck > 1.2) {
          s.stuck = 0;
          s.tries = (s.tries || 0) + 1;
          if (goal.detour || Math.hypot(goal.x - p.x, goal.y - p.y) < 20) s.route.shift();
          if (s.tries > 4) {
            s.route = null;
            s.tries = 0;
          } else {
            const side = (s.tries % 2 ? 1 : -1) * Math.PI / 2,
              d = 10 + s.tries * 4;
            s.route.unshift({ x: p.x + Math.cos(p.a + side) * d + Math.cos(p.a) * 6, y: p.y + Math.sin(p.a + side) * d + Math.sin(p.a) * 6, detour: true });
          }
        }
      } else {
        s.stuck = 0;
        if (!goal.detour) s.tries = 0;
      }
      if (p.dog) updateDog(p, deltaSeconds);
      if (distanceBetween(p, player) < 50 && (p.speechUntil || 0) < gameTime && seededRandom() < deltaSeconds * 0.06) {
        p.speech = randomChoice(wantedStars > 0 ? ISLE_LINES.wanted : ISLE_LINES.street);
        p.speechUntil = gameTime + 2.8;
      }
      return true;
    }
    const ISLE_LINES = {
      street: ['The Regent does a divine afternoon tea.', 'Darling, the boat is simply too small.', 'We summer on the island, of course.', 'Have you seen the new Valmont?', 'My driver is always late.', 'Lunch at L’Étoile? I’ll call ahead.', 'The club has a waiting list, you know.', 'Isn’t the light lovely today?'],
      photo: ['Stand by the Palm House, I’ll take one.', 'The lilies are enormous!', 'Get the dome in the shot.', 'Look at that dragon tree.', 'It’s like Kew, isn’t it?'],
      fountain: ['One for the album.', 'Lovely fountain.', 'Smile!'],
      promenade: ['That one’s sixty metres at least.', 'Whose yacht is that?', 'We should charter next summer.', 'Look, a helipad on a boat.'],
      beach: ['The water’s perfect.', 'Private beach, I’m afraid.', 'Towel, please.'],
      guard: ['Private property, sir.', 'Keep moving, please.', 'Can I help you?', 'The residents are not receiving visitors.'],
      valet: ['Your keys, sir?', 'Welcome to the Regent.', 'I’ll bring the car round.', 'Enjoy your evening.'],
      wanted: ['Someone call security!', 'Is that… oh my.', 'Not on this island, surely.'],
    };
    /* ---- Payphones ---- */
    function monarchPayphoneNear() {
      if (player.car) return null;
      return MONARCH_PAYPHONES.find((p) => withinRange('isle-phone-' + p.name, distanceBetween(player, p), 40, 52)) || null;
    }
    function monarchInteract() {
      const phone = monarchPayphoneNear();
      if (!phone) return false;
      const lines = [
        'Monarch Isle concierge. A table at L’Étoile tonight? Certainly.',
        'Harbour master. The Sovereign Lady sails at dawn.',
        'Crown Private Bank. Your balance is… confidential.',
        'The Regent Hotel. The penthouse is available from Friday.',
        'A voice: “Not on this line. Try the yellow phone in the city.”',
      ];
      tell(randomChoice(lines), 4);
      tone(620, 0.08, 0.12, 'sine');
      return true;
    }
    function monarchPrompt() {
      return monarchPayphoneNear() ? 'USE PAYPHONE' : '';
    }
    /* ---- Adopting city traffic that crosses the bridge ---- */
    let isleAdoptClock = 0;
    function updateMonarchTraffic(deltaSeconds) {
      isleAdoptClock -= deltaSeconds;
      if (isleAdoptClock > 0) return;
      isleAdoptClock = 0.5;
      const graph = isleRoadGraph(),
        bridge = graph.links.find((l) => l.name === 'SOVEREIGN BRIDGE');
      for (const c of vehicles) {
        if (!c.ai || c.isle || c.countyRoute || c.cop || c.hp <= 0 || isBoat(c) || isAircraft(c)) continue;
        if (c.x < 4200 || c.x > 5560 || Math.abs(c.y + 2944) > 80) continue;
        if (Math.cos(c.a) < 0.7) continue;
        isleTrafficJoin(c, bridge, 1);
      }
    }
    /* ---- Sound ---- */
    const isleSound = { water: null, clock: 0, rig: 1, bird: 2 };
    function updateMonarchSound(deltaSeconds) {
      if (!audio || !soundOn) return;
      const near = nearMonarchIsle(player.x, player.y, 600);
      // Running water: a band of noise that swells near a fountain or the pond.
      let fountain = Infinity;
      for (const c of ISLE_CIRCLES) fountain = Math.min(fountain, Math.hypot(player.x - c.x, player.y - c.y) - c.island);
      fountain = Math.min(fountain, Math.hypot(player.x - MONARCH_GARDEN.pond.x, player.y - MONARCH_GARDEN.pond.y) - 80);
      const level = near ? clamp(1 - fountain / 320, 0, 1) * 0.1 : 0;
      if (!isleSound.water && level > 0) {
        const n = audio.sampleRate * 2,
          buffer = audio.createBuffer(1, n, audio.sampleRate),
          d = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        const src = audio.createBufferSource(),
          band = audio.createBiquadFilter(),
          gain = audio.createGain();
        src.buffer = buffer;
        src.loop = true;
        band.type = 'bandpass';
        band.frequency.value = 1500;
        band.Q.value = 0.6;
        gain.gain.value = 0;
        src.connect(band).connect(gain).connect(ambienceBus);
        src.start();
        isleSound.water = gain;
      }
      if (isleSound.water) isleSound.water.gain.setTargetAtTime(level, audio.currentTime, 0.4);
      if (!near) return;
      // The marina: rigging and halyards, gulls.
      const marina = Math.hypot(player.x - clamp(player.x, 7700, 9900), player.y - clamp(player.y, -1200, -560));
      isleSound.rig -= deltaSeconds;
      if (marina < 500 && isleSound.rig <= 0) {
        isleSound.rig = 0.4 + Math.random() * 1.4;
        const at = { x: clamp(player.x + (Math.random() - 0.5) * 400, 7700, 9900), y: -900 + (Math.random() - 0.5) * 300 },
          f = 1800 + Math.random() * 1600;
        waterTone({ freq: f, to: f * 0.98, duration: 0.5, gain: 0.02, wave: 'triangle', position: at });
        if (Math.random() < 0.3) shapedNoise({ type: 'bandpass', freq: 700, q: 2, attack: 0.005, decay: 0.12, gain: 0.03, position: at });
        if (Math.random() < 0.08 && daylight() > 0.3) gullCall(at);
      }
      // The garden: birdsong by day.
      isleSound.bird -= deltaSeconds;
      const garden = Math.hypot(player.x - 8000, player.y + 4100);
      if (garden < 700 && isleSound.bird <= 0 && daylight() > 0.2) {
        isleSound.bird = 0.6 + Math.random() * 2.2;
        const at = { x: 8000 + (Math.random() - 0.5) * 900, y: -4100 + (Math.random() - 0.5) * 500 },
          f = 2600 + Math.random() * 2400,
          notes = 2 + Math.floor(Math.random() * 4);
        for (let k = 0; k < notes; k++) waterTone({ freq: f * (1 + (k % 2) * 0.18), to: f * (1.3 - (k % 2) * 0.3), duration: 0.09, gain: 0.018, delay: k * 0.13, position: at });
      }
    }
    function updateMonarchIsle(deltaSeconds) {
      updateMonarchTraffic(deltaSeconds);
      updateMonarchCrowd(deltaSeconds);
      updateMonarchSound(deltaSeconds);
    }
    function monarchReport() {
      const cars = vehicles.filter((c) => c.isle),
        walkers = pedestrians.filter((p) => p.isle);
      return {
        ...monarchLayout(),
        traffic: cars.length,
        trafficMoving: cars.filter((c) => Math.hypot(c.vx || 0, c.vy || 0) > 20).length,
        trafficStuck: cars.filter((c) => gameTime - (c.isle.stillSince ?? gameTime) > 30).length,
        trafficWaiting: cars.filter((c) => c.isle?.crossing && !c.isle.granted).length,
        stopped: cars
          .filter((c) => Math.hypot(c.vx || 0, c.vy || 0) < 8)
          .map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), a: Math.round((c.a * 180) / Math.PI), type: c.type, link: c.isle.link.name, crossing: !!c.isle.crossing, node: c.isle.node?.kind, granted: !!c.isle.granted, waited: Math.round(c.isle.waited || 0), index: c.isle.index + '/' + c.isle.path.length, hp: Math.round(c.hp), still: Math.round(gameTime - (c.isle.stillSince ?? gameTime)), desired: Math.round(c.isle.desired || 0), target: c.isle.target && [Math.round(c.isle.target.x), Math.round(c.isle.target.y)], yielding: c.isle.yielding, blocker: c.isle.blocker ? { type: c.isle.blocker.type, x: Math.round(c.isle.blocker.x), y: Math.round(c.isle.blocker.y), isle: !!c.isle.blocker.isle, ai: !!c.isle.blocker.ai } : null })),
        boats: vehicles.filter((c) => c.isleBoat).map((c) => ({ type: c.type, x: Math.round(c.x), y: Math.round(c.y) })),
        people: walkers.length,
        onRoad: walkers
          .filter((p) => monarchRoadAt(p.x, p.y, 3))
          .map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), role: p.role, walking: !!p.walking, stay: Math.round(p.isle.stay || 0), post: !!p.isle.post, follow: !!p.isle.follow, goal: p.isle.route?.[0] && [Math.round(p.isle.route[0].x), Math.round(p.isle.route[0].y)], left: p.isle.route?.length, dest: p.isle.dest?.kind, hidden: !!p.indoors, react: p.react || null, flee: p.flee || 0, knocked: p.knockedFor || 0, injured: !!p.injured, kerb: +(p.isle.kerb || 0).toFixed(1), stuck: +(p.isle.stuck || 0).toFixed(1), tries: p.isle.tries || 0, state: p.state, pose: p.pose || null })),
        staff: walkers.filter((p) => p.isle.post).length,
        roles: walkers.reduce((m, p) => ((m[p.role || 'casual'] = (m[p.role || 'casual'] || 0) + 1), m), {}),
        roadGraph: { nodes: isleRoadGraph().nodes.length, links: isleRoadGraph().links.length },
        walkGraph: isleWalkNodes().length,
        // Walk links that run along a carriageway rather than across it.
        walkOnRoad: (() => {
          const nodes = isleWalkNodes(),
            bad = [];
          for (const n of nodes)
            for (const id of n.links) {
              if (id < n.id) continue;
              const m = nodes[id],
                d = Math.hypot(m.x - n.x, m.y - n.y);
              let onRoad = 0;
              for (let t = 0; t <= d; t += 8) if (monarchRoadAt(n.x + ((m.x - n.x) * t) / d, n.y + ((m.y - n.y) * t) / d, 0)) onRoad += 8;
              if (onRoad > 120) bad.push([Math.round(n.x), Math.round(n.y), Math.round(m.x), Math.round(m.y), onRoad, n.tag, m.tag]);
            }
          return bad;
        })(),
      };
    }
