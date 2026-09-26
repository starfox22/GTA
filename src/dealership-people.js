    // BEGIN SUBSYSTEM: src/dealership-people.js — MONARCH MOTORS: salesmen, guards and enthusiasts
    /**
     * The people of MONARCH MOTORS
     * Source: src/dealership-people.js
     * Scope: shared game closure (after dealership.js; game.js updatePeople hands
     * each pedestrian to updateDealerPerson first, dealership.js calls
     * updateDealershipPeople every frame near the lot).
     *
     *   STAFF        three salesmen in sharp suits (charcoal, navy, black, with a
     *                tie or a pocket square), a receptionist at the desk by the
     *                door and a barista in the VIP lounge: pedestrians with a
     *                `dealer` record, dressed by the character rig's suit.
     *   SALESMEN     when the player walks in, the nearest free one comes over
     *                ("Welcome to Monarch Motors…"), then walks with the player;
     *                stop by a car and he goes round to stand beside it and talks
     *                about it: its own lines (the Wayron's 430 flat out, the
     *                Valkyrie's 11,100 rpm), lines that know what you can afford
     *                ("Perhaps our pre-owned… no, we don't do pre-owned."), lines
     *                for a scruffy or wanted customer ("Sir, security is
     *                watching…"), and after a sale ("Congratulations, an
     *                exquisite choice"). Walk out and he wishes you well.
     *   ENTHUSIASTS  visitors wandering from car to car along the aisles, taking
     *                photos, pointing, gasping, with things to say ("I will never
     *                be able to afford this."); more by day, a few late at night.
     *   GUARDS       private security in dark suits: two at the entrance, one at
     *                the vehicle door, two walking the floor. Gang members of the
     *                'prestige' faction, so story.js updateGangFights arms them and
     *                fights by the combat rules once dealershipGuardsProvoked()
     *                has marked the player; two more arrive twelve seconds into an
     *                alarm.
     *
     * Walking inside keeps to the hall's three aisles (between the rows of cars)
     * and their connectors (dealerAislePath), so nobody walks through a car.
     * Speech goes through the crowd's bubbles (crowd.js speechBubbles: two at a
     * time, the NPC chatter setting); salesmen talking to the player rank first.
     * An attack on anyone here sounds the alarm (dealership.js); the staff and
     * visitors then cower or run for the doors.
     */
    const DEALER_LINES = {
      welcome: [
        'Welcome to Monarch Motors. Can I interest you in something exceptional?',
        'Good to see you, sir. Everything on this floor is available today.',
        'Welcome. Take your time. The cars aren’t going anywhere… unless you take one.',
        'Ah, a discerning eye. Welcome to the Prestige Collection.',
      ],
      reception: ['Good {time}, welcome to Monarch Motors.', 'Welcome. May I offer you a glass of champagne?', 'A salesman will be right with you, sir.', 'Welcome back to Monarch Motors.'],
      barista: ['Espresso? Champagne? Both?', 'The lounge is yours, sir.', 'Single origin, from our own estate in Colombia.', 'Something to celebrate with?'],
      follow: ['Anything catch your eye?', 'This way, sir, the collection continues.', 'Each of these is a masterpiece.', 'Shall I tell you about any of them?'],
      affordable: [
        'I see sir is a man of means. Shall I have it prepared for delivery?',
        'Within reach, if I may say. We could hand you the keys today.',
        'Cash buyer? How refreshing.',
        'An excellent choice for a gentleman of your… liquidity.',
      ],
      stretch: [
        'We do offer financing… for those with a yacht as collateral.',
        'A few more good weeks and she could be yours.',
        'Many of our clients buy two. You might start with one.',
      ],
      broke: [
        'Perhaps our pre-owned… no, we don’t do pre-owned.',
        'Would sir like a brochure? They’re free.',
        'The gift shop is… actually, we don’t have a gift shop.',
        'Looking is complimentary, sir.',
      ],
      scruffy: ['Sir, security is watching you… closely.', 'Is that… blood on your sleeve, sir?', 'We don’t usually see customers in that condition.'],
      armed: ['Would sir mind holstering that? It frightens the Mugattis.', 'Weapons away in the showroom, please.', 'Please. Not near the paintwork.'],
      wanted: ['Sir, security is watching… and so, I think, are the police.', 'I’m afraid we can’t trade while there are sirens outside.', 'Perhaps come back when things are… calmer.'],
      farewell: ['Do come back. They don’t sell themselves… well, they do.', 'Thank you for visiting Monarch Motors.', 'Until next time, sir.', 'My card, sir. Call me when the bonus comes in.'],
      sold: ['Congratulations. An exquisite choice.', 'Magnificent. You won’t regret it.', 'She suits you, sir.', 'Welcome to the family.'],
      keys: ['Your keys, sir. Drive her gently… for the first hour.', 'Full tank, champagne in the door pocket. Enjoy.', 'She’s all yours. Do send us a photo.'],
      alarm: ['Get down!', 'Security!', 'Not the cars! Please, not the cars!', 'Call the police!', 'Oh my god!'],
      guard: ['Welcome, sir.', 'Enjoy the collection.', 'Mind the paintwork, sir.', 'Good {time}.'],
      guardArmed: ['Holster the weapon, sir. Now.', 'Hands where I can see them.', 'Not in here. Put it away.'],
      guardWanted: ['We’ve been told to watch you.', 'Keep walking, sir.', 'The police are asking about you.'],
      fan: [
        'Look at that carbon weave!',
        'I will never be able to afford this.',
        'My whole house costs less than this wheel.',
        'One day…',
        'Do they do payment plans?',
        'Smell that leather.',
        'That’s not a car, that’s a spaceship.',
        'My insurance just fainted.',
        'I’d sell a kidney. Maybe both.',
        'Honey, don’t touch it!',
        'The brake calipers alone…',
        'Is that real carbon? It’s ALL real carbon.',
        'Take my picture with it. Quick, before security sees.',
        'I came here for a keyring and I’m leaving with trust issues.',
        'The paint has more layers than my personality.',
        'My mortgage has a mortgage.',
        'If I squint, it’s basically my Corolla.',
        'Imagine turning up to work in this.',
        'I just want to sit in it. Five minutes.',
        'Look how low it is!',
      ],
      fanNight: ['Worth the late visit.', 'They look even better under these lights.', 'Nobody tell my wife I’m here again.'],
      fanScared: ['Run!', 'He’s got a gun!', 'Get out, get out!', 'Not the Mugatti!'],
    };
    // Car by car: what the salesmen say and what the visitors gasp at.
    const DEALER_CAR_LINES = {
      valkyrie: {
        pitch: ['The Valkyrie revs to eleven thousand one hundred. Naturally aspirated.', 'More downforce than it weighs. It could drive on the ceiling, in theory.', 'Formula One engineers drew this. Mostly with the wind tunnel.', 'Two seats, one of them is yours.'],
        fan: ['Those tunnels go right through it!', 'It looks like a Le Mans car!', 'Eleven thousand RPM… in a road car!'],
      },
      dbs: {
        pitch: ['The DBS: seven hundred and fifteen horsepower in a dinner jacket.', 'Nine hundred newton-metres from eighteen hundred rpm. Effortless.', 'A grand tourer. Monaco by lunchtime.', 'Carbon body, twelve cylinders, and a boot for the luggage.'],
        fan: ['Now that is a proper gentleman’s car.', 'I’d drive this to a wedding. Mine, ideally.'],
      },
      zr1x: {
        pitch: ['The ZR1X: twelve hundred and fifty horsepower, under two seconds to a hundred.', 'Twin turbos at the back, an electric motor at the front.', 'An American hypercar, at a very American price.', 'Three hundred and seventy-five flat out. For a fifth of the Europeans.'],
        fan: ['A Chevette that beats Mugattis?', 'Look at the size of that wing!', 'Under two seconds to a hundred!'],
      },
      chevetteSE: {
        pitch: ['The Z06 in carbon aero trim: the biggest naturally aspirated V8 ever built.', 'Eighty-six hundred rpm from a flat-plane crank. Listen to it sometime.', 'Carbon wheels, carbon brakes, carbon everything.'],
        fan: ['Carbon wheels! Carbon WHEELS!', 'That yellow is unreal.'],
      },
      wayron: {
        pitch: ['The Wayron does four-thirty flat out. Quad turbos.', 'Sixteen cylinders and ten radiators. Ten.', 'The tyres cost more than most cars. They last about fifteen minutes at top speed.', 'The C-line is polished by hand. Eleven hours.'],
        fan: ['Four hundred and thirty km/h… in a car!', 'Sixteen cylinders. Sixteen!', 'That’s the one from the posters!'],
      },
      tourbillon: {
        pitch: ['The Tourbillon: a V16 and three motors, eighteen hundred horsepower.', 'The instrument cluster was made by watchmakers. Actual watchmakers.', 'Four hundred and forty-five km/h. Our fastest Mugatti yet.', 'Four million, one hundred thousand. Delivery in time for summer.'],
        fan: ['Four MILLION?', 'It has a watch for a dashboard!', 'Don’t breathe on it.'],
      },
      jasko: {
        pitch: ['The Jasko Absolut: built for one number. The top speed.', 'Sixteen hundred horsepower on E85.', 'No wing. It doesn’t need one. It needs a runway.', 'The fastest car in this room. By some distance.'],
        fan: ['This is the fastest one here!', 'Those fins are like a jet!'],
      },
      sirocco: {
        pitch: ['The Sirocco: carbo-titanium, a V12, and a manual gearbox, if you ask.', 'Every bolt has the maker’s name on it. Every bolt.', 'Art you can drive, sir.'],
        fan: ['The four exhausts in a circle!', 'It’s like a sculpture.', 'Every single bolt has a logo…'],
      },
      novera: {
        pitch: ['The Novera: nineteen hundred horsepower and silence.', 'One point eight five to a hundred. Nothing on the road is quicker.', 'Four motors, one for each wheel. It thinks faster than you do.'],
        fan: ['It’s electric? And it does four hundred?', 'Quicker than a fighter jet off the line.'],
      },
      w1: {
        pitch: ['The W1: ground effect for the road. The wing moves on its own.', 'Twelve hundred and fifty-eight horsepower in fourteen hundred kilos.', 'Designed by the people who design the race cars.'],
        fan: ['Papaya orange! Proper racing colour.', 'Look at that diffuser…'],
      },
      lafera: {
        pitch: ['La Fera. The prancing horse’s own hypercar.', 'A V12 to nine thousand two hundred and fifty, with a hybrid system from Formula One.', 'Red, obviously. We could do yellow.'],
        fan: ['A La Fera! A real one!', 'That red is hypnotic.'],
      },
      brutini: {
        pitch: ['The SVJ: the last of the pure V12 wedges.', 'Its aero moves downforce from side to side, corner by corner.', 'Loud. Proudly loud.'],
        fan: ['That wing is the size of my kitchen table.', 'It’s so green!'],
      },
    };
    const dealerPeople = { live: false, staff: [], guards: [], fans: [], clock: 0, fanClock: 0, escort: null, lastFanLine: -1e9, lastReception: -1e9, reinforced: false, playerInside: false, insideSince: -1e9, outsideSince: -1e9 };
    function dealerTimeWord() {
      const h = (worldMinutes % 1440) / 60;
      return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    }
    function dealerSay(p, text, seconds = 3.2, toPlayer = false) {
      if (!p || p.hp <= 0 || !text) return;
      p.speech = text.replace('{time}', dealerTimeWord());
      p.speechUntil = gameTime + seconds;
      p.speechKind = toPlayer ? 'dealer' : 'dealerIdle';
      p.speechKindText = p.speech;
      // A salesman talking to the player takes a bubble ahead of idle remarks.
      p.inConversation = toPlayer;
      if (p.dealer) p.dealer.spokeAt = gameTime;
    }
    /* ---- Looks ---------------------------------------------------------------------- */
    const DEALER_SUITS = [
      { top: '#1f2229', accent: '#7a1f2a' },
      { top: '#1a2233', accent: '#c9a24e' },
      { top: '#141518', accent: '#1d2a44' },
      { top: '#2b2e33', accent: '#4a2a5a' },
    ];
    function dressDealerPerson(p, role, index = 0) {
      dressPerson(p, role === 'fan' ? randomChoice(['tourist', 'casual', 'shopper', 'commuter', 'casual']) : 'commuter');
      const L = p.look;
      if (role === 'salesman') {
        const suit = DEALER_SUITS[index % DEALER_SUITS.length];
        Object.assign(L, { garment: 'suit', top: suit.top, inner: '#f4f4f0', accent: suit.accent, pants: suit.top, pantsPattern: 0, shoes: '#0f0f10', footwear: 'shoe', skirt: false, sleeves: true, hat: 0, female: index === 2, hairStyle: index === 2 ? 'hairPony' : 1, beard: index === 1 ? 1 : 0, build: 1.02, height: 1.02 });
        p.color = suit.top;
        p.carry = index === 0 ? 'tablet' : null;
      } else if (role === 'receptionist') {
        Object.assign(L, { garment: 'suit', top: '#ece6da', inner: '#1c1d20', accent: '#ece6da', pants: '#16171a', pantsPattern: 0, shoes: '#111', footwear: 'shoe', skirt: true, female: true, hairStyle: 3, sleeves: true, hat: 0, beard: 0 });
        p.color = L.top;
        p.carry = null;
      } else if (role === 'barista') {
        Object.assign(L, { garment: 'suit', top: '#f4f1ea', inner: '#ffffff', accent: '#16171b', pants: '#17181b', pantsPattern: 0, shoes: '#111', footwear: 'shoe', skirt: false, sleeves: true, hat: 0, beard: 0 });
        p.color = L.top;
        p.carry = null;
      } else {
        // Visitors: whatever they came in, a camera for many.
        if (seededRandom() < 0.45) p.carry = 'camera';
        L.umbrella = null;
      }
      if (p.carry === 'tablet') p.carry = null;
      return p;
    }
    function spawnDealerPerson(role, post, index = 0) {
      const p = { x: post.x, y: post.y, a: post.a || 0, hp: 30, flee: 0, timer: 0, walk: 0, state: 'walk', dealer: { role, post, index, state: 'post', route: [], stay: 0, spokeAt: -1e9, hp: 30, visits: 0, target: null, blocked: 0, sidestep: 0 } };
      dressDealerPerson(p, role, index);
      p.pace = role === 'fan' ? randomBetween(0.85, 1.05) : 1;
      pedestrians.push(p);
      return p;
    }
    function spawnDealerGuard(post, index) {
      const g = {
        x: post.x,
        y: post.y,
        a: post.a,
        hp: 100,
        color: '#15171b',
        faction: 'prestige',
        guard: true,
        timer: 1 + index * 0.3,
        walk: 0,
        home: { x: post.x, y: post.y },
        dealerGuard: { post, index, patrolIndex: 0, hp: 100, spokeAt: -1e9 },
      };
      gangMembers.push(g);
      return g;
    }
    /* ---- Walking the aisles --------------------------------------------------------- */
    // The hall's aisles (rows between the rows of cars) and the gaps joining them.
    function dealerAisles() {
      const H = DEALER.hall;
      return {
        rows: [H.y + 124, H.y + 232, H.y + 320],
        // [from row, to row, x]
        links: [
          [0, 1, H.x + 239],
          [0, 1, H.x + 373],
          [1, 2, H.x + 303],
          [0, 1, H.x + 150],
          [1, 2, H.x + 150],
        ],
        x0: H.x + 146,
        x1: H.x + 462,
      };
    }
    function dealerNearestRow(y) {
      const A = dealerAisles();
      let best = 0;
      for (let i = 1; i < A.rows.length; i++) if (Math.abs(A.rows[i] - y) < Math.abs(A.rows[best] - y)) best = i;
      return best;
    }
    // A route along the aisles from (x, y) to a point on (or near) an aisle.
    function dealerAislePath(x, y, tx, ty) {
      const A = dealerAisles(),
        from = dealerNearestRow(y),
        to = dealerNearestRow(ty),
        route = [];
      const clampX = (v) => clamp(v, A.x0, A.x1);
      route.push({ x: clampX(x), y: A.rows[from] });
      let row = from,
        cx = clampX(x);
      while (row !== to) {
        const next = row + Math.sign(to - row),
          links = A.links.filter(([a, b]) => (a === row && b === next) || (b === row && a === next)),
          link = links.reduce((best, l) => (!best || Math.abs(l[2] - cx) + Math.abs(l[2] - tx) < Math.abs(best[2] - cx) + Math.abs(best[2] - tx) ? l : best), null);
        route.push({ x: link[2], y: A.rows[row] }, { x: link[2], y: A.rows[next] });
        cx = link[2];
        row = next;
      }
      route.push({ x: clampX(tx), y: A.rows[to] });
      route.push({ x: tx, y: ty });
      return route;
    }
    // One step towards (tx, ty); true on arrival. Blocked, it sidesteps a moment.
    function dealerStep(p, tx, ty, speed, deltaSeconds, arrive = 4) {
      const dx = tx - p.x,
        dy = ty - p.y,
        d = Math.hypot(dx, dy);
      if (d < arrive) {
        p.walking = false;
        return true;
      }
      const s = p.dealer || p.dealerGuard;
      let a = Math.atan2(dy, dx);
      if (s && s.sidestep > 0) {
        s.sidestep -= deltaSeconds;
        a += s.sideSign * 1.1;
      }
      p.a = a;
      p.walking = true;
      const step = Math.min(d, speed * deltaSeconds);
      p.walk += deltaSeconds * strideRate(speed);
      const hit = moveBody(p, Math.cos(a) * step, Math.sin(a) * step, 4);
      if (hit && s) {
        s.blocked += deltaSeconds;
        if (s.blocked > 0.25) {
          s.blocked = 0;
          s.sidestep = 0.5;
          s.sideSign = seededRandom() < 0.5 ? -1 : 1;
        }
      } else if (s) s.blocked = 0;
      return false;
    }
    // Follow a route; true once it is walked.
    function dealerFollow(p, speed, deltaSeconds) {
      const s = p.dealer,
        r = s.route;
      // A waypoint that cannot be reached (someone standing on it, a car nudged
      // across it) is given up after a few seconds.
      if (r.length && r[0] !== s.waypoint) {
        s.waypoint = r[0];
        s.waypointSince = gameTime;
      }
      while (r.length && (Math.hypot(r[0].x - p.x, r[0].y - p.y) < 6 || gameTime - s.waypointSince > 3)) {
        r.shift();
        s.waypoint = r[0];
        s.waypointSince = gameTime;
      }
      if (!r.length) {
        p.walking = false;
        return true;
      }
      dealerStep(p, r[0].x, r[0].y, speed, deltaSeconds, 5);
      return false;
    }
    // Where one stands to look at a slot's car: the nearest aisle point beside it.
    function dealerViewPoint(s, fromX, fromY) {
      if (s.where !== 'hall') {
        const a = Math.atan2(fromY - s.y, fromX - s.x);
        return { x: s.x + Math.cos(a) * (s.r + 14), y: s.y + Math.sin(a) * (s.r + 14) };
      }
      const A = dealerAisles(),
        rows = A.rows.filter((r) => Math.abs(r - s.y) < 70);
      const y = rows.reduce((b, r) => (b === null || Math.abs(r - fromY) < Math.abs(b - fromY) ? r : b), null) ?? A.rows[1];
      return { x: s.x + (fromX < s.x ? -10 : 10), y };
    }
    /* ---- Spawning and the frame ----------------------------------------------------- */
    function dealerFanTarget() {
      const h = (worldMinutes % 1440) / 60;
      return h >= 9 && h < 21 ? 8 : h >= 21 || h < 1 ? 4 : 2;
    }
    function ensureDealerPeople() {
      const P = DEALER.posts;
      if (!dealerPeople.live) {
        dealerPeople.live = true;
        dealerPeople.staff = [
          spawnDealerPerson('receptionist', P.receptionist),
          spawnDealerPerson('barista', P.barista),
          ...P.salesmen.map((post, i) => spawnDealerPerson('salesman', post, i)),
        ];
        dealerPeople.guards = P.guards.map((post, i) => spawnDealerGuard(post, i));
        dealerPeople.reinforced = false;
        // Visitors already looking round.
        const slots = DEALER.slots.filter((s) => s.where === 'hall' || seededRandom() < 0.5);
        for (let i = 0; i < dealerFanTarget(); i++) {
          const s = slots[Math.floor(seededRandom() * slots.length)],
            v = dealerViewPoint(s, s.x + randomBetween(-40, 40), s.y + randomBetween(-60, 60)),
            p = spawnDealerPerson('fan', { x: v.x + randomBetween(-6, 6), y: v.y + randomBetween(-4, 4), a: 0 });
          p.dealer.slot = s;
          p.dealer.state = 'look';
          p.dealer.stay = randomBetween(2, 12);
          dealerPeople.fans.push(p);
        }
      }
    }
    function removeDealerPeople() {
      for (const p of [...dealerPeople.staff, ...dealerPeople.fans]) {
        const i = pedestrians.indexOf(p);
        if (i >= 0) pedestrians.splice(i, 1);
      }
      for (const g of dealerPeople.guards) {
        const i = gangMembers.indexOf(g);
        if (i >= 0) gangMembers.splice(i, 1);
      }
      dealerPeople.staff = [];
      dealerPeople.fans = [];
      dealerPeople.guards = [];
      dealerPeople.escort = null;
      dealerPeople.live = false;
    }
    function updateDealershipPeople(deltaSeconds) {
      const near = onDealerLot(player.x, player.y, 1100),
        alarmed = dealer.alarmUntil > gameTime;
      dealerPeople.clock -= deltaSeconds;
      if (dealerPeople.clock <= 0) {
        dealerPeople.clock = 1.2;
        if (!near && dealerPeople.live && !alarmed && !dealerPeople.staff.some((p) => crowdInView(p.x, p.y, 60))) removeDealerPeople();
        else if (near) {
          // The people list may have been cleared (a new game, a load): start again.
          if (dealerPeople.live && !dealerPeople.staff.some((p) => pedestrians.includes(p))) removeDealerPeople();
          ensureDealerPeople();
          dealerPeople.fans = dealerPeople.fans.filter((p) => pedestrians.includes(p) && p.hp > 0);
          // Fresh visitors come in through the door by day.
          if (!alarmed && dealerPeople.fans.length < dealerFanTarget() && seededRandom() < 0.35 && !crowdInView(DEALER.doorPeople.x0, DEALER.hall.y1 + 90, 30)) {
            const d = DEALER.doorPeople,
              p = spawnDealerPerson('fan', { x: (d.x0 + d.x1) / 2 + randomBetween(-8, 8), y: DEALER.hall.y1 + 100, a: -Math.PI / 2 });
            p.dealer.state = 'enter';
            dealerPeople.fans.push(p);
          }
        }
      }
      if (!dealerPeople.live) return;
      // The player in the hall: note when they came in and went out.
      const inside = !player.car && inDealerHall(player.x, player.y, 2);
      if (inside !== dealerPeople.playerInside) {
        dealerPeople.playerInside = inside;
        if (inside) dealerPeople.insideSince = gameTime;
        else dealerPeople.outsideSince = gameTime;
      }
      updateDealerGuards(deltaSeconds, alarmed);
      // Anyone here hurt by the player: the alarm.
      for (const p of [...dealerPeople.staff, ...dealerPeople.fans]) {
        const s = p.dealer;
        if (p.hp < s.hp - 0.5 && Math.hypot(player.x - p.x, player.y - p.y) < 320) dealershipAlarm(p.hp <= 0 ? 'someone killed in the showroom' : 'someone attacked in the showroom');
        s.hp = p.hp;
      }
    }
    /* ---- Guards --------------------------------------------------------------------- */
    function dealershipGuardsProvoked() {
      ensureDealerPeople();
      for (const g of dealerPeople.guards) {
        if (g.hp <= 0) continue;
        g.playerThreatUntil = gameTime + 240;
        g.lastPlayerSeen = { x: player.x, y: player.y };
        if ((g.dealerGuard.spokeAt || 0) < gameTime - 4) {
          g.speech = randomChoice(['Security! Drop it!', 'Armed intruder, main floor!', 'Down on the ground!', 'Shutters, now!']);
          g.speechUntil = gameTime + 2.5;
          g.dealerGuard.spokeAt = gameTime;
        }
      }
    }
    function updateDealerGuards(deltaSeconds, alarmed) {
      const armed = !currentWeapon().fists && !currentWeapon().melee;
      // Reinforcements twelve seconds into an alarm, through the vehicle door.
      if (alarmed && !dealerPeople.reinforced && gameTime - dealer.alarmStartedAt > 12) {
        dealerPeople.reinforced = true;
        const d = DEALER.doorCars;
        for (let i = 0; i < 2; i++) {
          const g = spawnDealerGuard({ x: (d.x0 + d.x1) / 2 + (i ? 12 : -12), y: DEALER.hall.y1 + 40, a: -Math.PI / 2, kind: 'response' }, 5 + i);
          g.playerThreatUntil = gameTime + 240;
          dealerPeople.guards.push(g);
        }
        tell('A MONARCH SECURITY response team is coming in through the vehicle door.', 3.5);
      }
      for (const g of dealerPeople.guards) {
        if (g.hp <= 0) continue;
        // Back on the list if something cleared it (populateStoryWorld on a new game).
        if (!gangMembers.includes(g)) gangMembers.push(g);
        // Police treat private security as allies (citylife.js policeGangTarget reads these).
        g.lastShotAt = -100;
        g.policeThreatUntil = 0;
        const s = g.dealerGuard;
        if (g.hp < s.hp - 0.5) dealershipAlarm('a guard attacked');
        s.hp = g.hp;
        if (alarmed) {
          if ((g.playerThreatUntil || 0) < gameTime + 30) g.playerThreatUntil = gameTime + 240;
          g.pose = null;
          continue;
        }
        // Peacetime: back to the post, arms folded, a word for a customer who looks like trouble.
        g.playerThreatUntil = 0;
        g.aiming = false;
        const post = s.post,
          target = post.patrol ? post.patrol[s.patrolIndex] : post;
        if (dealerStep(g, target.x, target.y, 3.6 * KMH, deltaSeconds, 3)) {
          if (post.patrol) {
            s.wait = (s.wait || 0) + deltaSeconds;
            g.pose = 'arms';
            if (s.wait > 6) {
              s.wait = 0;
              s.patrolIndex = (s.patrolIndex + 1) % post.patrol.length;
            }
          } else {
            g.pose = 'arms';
            g.a = post.a + Math.sin(gameTime * 0.25 + s.index) * 0.35;
          }
        } else g.pose = null;
        const d = Math.hypot(player.x - g.x, player.y - g.y);
        if (d < 52 && !player.car && gameTime - s.spokeAt > 9) {
          s.spokeAt = gameTime;
          g.speech = randomChoice(wantedStars > 0 ? DEALER_LINES.guardWanted : armed ? DEALER_LINES.guardArmed : DEALER_LINES.guard).replace('{time}', dealerTimeWord());
          g.speechUntil = gameTime + 2.8;
          g.a = headingBetween(g, player);
        }
      }
    }
    /* ---- Staff and visitors (game.js updatePeople) --------------------------------- */
    function updateDealerPerson(p, deltaSeconds) {
      const s = p.dealer;
      if (!s || p.hp <= 0) return false;
      if (p.knockedFor || personIncapacitated(p)) return false;
      if (dealer.alarmUntil > gameTime) return dealerPanic(p, s, deltaSeconds);
      if (s.state === 'panic' || s.state === 'cower') {
        s.state = 'post';
        s.route = [];
        p.pose = null;
      }
      if (s.role === 'fan') return updateDealerFan(p, s, deltaSeconds);
      if (s.role === 'salesman') return updateDealerSalesman(p, s, deltaSeconds);
      return updateDealerDesk(p, s, deltaSeconds);
    }
    // The receptionist and the barista keep their places and greet the customer.
    function updateDealerDesk(p, s, deltaSeconds) {
      if (s.state === 'reveal') return dealerRevealStand(p, s, deltaSeconds);
      if (dealerStep(p, s.post.x, s.post.y, 4 * KMH, deltaSeconds, 3)) {
        p.pose = s.role === 'barista' ? 'serve' : null;
        p.a = s.post.a + Math.sin(gameTime * 0.3 + s.index) * 0.25;
      }
      const d = Math.hypot(player.x - p.x, player.y - p.y);
      if (!player.car && d < (s.role === 'barista' ? 70 : 95) && gameTime - s.spokeAt > (s.role === 'barista' ? 25 : 40) && dealerPeople.playerInside) {
        dealerSay(p, randomChoice(DEALER_LINES[s.role === 'barista' ? 'barista' : 'reception']), 3.2, true);
        p.pose = s.role === 'barista' ? 'serve' : 'wave';
        p.a = headingBetween(p, player);
      }
      return true;
    }
    // What a salesman says next about the car the player is looking at.
    function dealerPitchLine(slot) {
      const item = slot ? PRESTIGE_BY_TYPE.get(slot.type) : null,
        armed = !currentWeapon().fists && !currentWeapon().melee;
      if (wantedStars > 0) return randomChoice(DEALER_LINES.wanted);
      if (armed && seededRandom() < 0.7) return randomChoice(DEALER_LINES.armed);
      if (player.hp < 45 && seededRandom() < 0.5) return randomChoice(DEALER_LINES.scruffy);
      if (!item) return randomChoice(DEALER_LINES.follow);
      const roll = seededRandom();
      if (roll < 0.6) return randomChoice(DEALER_CAR_LINES[slot.type]?.pitch || DEALER_LINES.follow);
      if (cash >= item.price) return randomChoice(DEALER_LINES.affordable);
      if (cash >= item.price * 0.4) return randomChoice(DEALER_LINES.stretch);
      return randomChoice(DEALER_LINES.broke);
    }
    // A line from the salesman nearest the player (the card opened, a refused sale).
    function dealershipSalesPitch(slot, kind) {
      const p = dealerPeople.escort && pedestrians.includes(dealerPeople.escort) ? dealerPeople.escort : dealerPeople.staff.filter((q) => q.dealer?.role === 'salesman' && q.hp > 0).sort((a, b) => distanceBetween(a, player) - distanceBetween(b, player))[0];
      if (!p || distanceBetween(p, player) > 220) return;
      if (kind === 'wanted') dealerSay(p, randomChoice(DEALER_LINES.wanted), 3.4, true);
      else dealerSay(p, dealerPitchLine(slot), 3.8, true);
    }
    function updateDealerSalesman(p, s, deltaSeconds) {
      if (s.state === 'reveal') return dealerRevealStand(p, s, deltaSeconds);
      const inside = dealerPeople.playerInside,
        escort = dealerPeople.escort && pedestrians.includes(dealerPeople.escort) && dealerPeople.escort.hp > 0 ? dealerPeople.escort : null;
      // The player walks in: the nearest free salesman goes to meet them.
      if (!escort && inside && !dealer.menu && gameTime - dealerPeople.insideSince > 0.6) {
        const free = dealerPeople.staff.filter((q) => q.dealer?.role === 'salesman' && q.hp > 0 && q.dealer.state !== 'reveal').sort((a, b) => distanceBetween(a, player) - distanceBetween(b, player))[0];
        if (free === p) {
          dealerPeople.escort = p;
          s.state = 'approach';
          s.greeted = false;
          s.route = [];
        }
      }
      if (dealerPeople.escort === p) {
        if (!inside && gameTime - dealerPeople.outsideSince > 3) {
          dealerSay(p, randomChoice(DEALER_LINES.farewell), 3.4, true);
          dealerPeople.escort = null;
          s.state = 'return';
          s.route = [];
        } else return dealerEscort(p, s, deltaSeconds);
      }
      // Back to the post, or waiting there.
      if (s.state === 'return' || s.state === 'post') {
        const post = s.post;
        if (!s.route.length && Math.hypot(post.x - p.x, post.y - p.y) > 6) s.route = dealerAislePath(p.x, p.y, post.x, post.y);
        if (dealerFollow(p, 4.2 * KMH, deltaSeconds)) {
          s.state = 'post';
          p.pose = s.index === 1 ? 'arms' : null;
          p.a = post.a + Math.sin(gameTime * 0.2 + s.index * 2) * 0.5;
          // A word with a visitor now and then.
          if (gameTime - s.spokeAt > 22 && seededRandom() < deltaSeconds * 0.05) {
            const fan = dealerPeople.fans.find((f) => distanceBetween(f, p) < 60);
            if (fan) dealerSay(p, randomChoice(['Beautiful, isn’t she?', 'Would you like to sit in it? No? Very wise.', 'Please, no touching the paint.', 'Photos are welcome. Flash is not.']), 3);
          }
        } else p.pose = null;
      }
      return true;
    }
    function dealerEscort(p, s, deltaSeconds) {
      const d = distanceBetween(p, player);
      if (s.state === 'approach') {
        const reached = d < 26;
        if (!reached) {
          if (!s.route.length) {
            s.route = dealerAislePath(p.x, p.y, player.x, player.y);
            s.routeAt = gameTime;
          }
          dealerFollow(p, 7.5 * KMH, deltaSeconds);
          p.pose = null;
          return true;
        }
        s.state = 'escort';
        s.route = [];
        p.a = headingBetween(p, player);
        p.pose = 'wave';
        dealerSay(p, dealer.sold ? randomChoice(['Welcome back, sir. The family grows?', 'Good to see you again. Another one?']) : randomChoice(DEALER_LINES.welcome), 4, true);
        s.lookSlot = null;
        s.lookSince = gameTime;
        return true;
      }
      // Beside a car the player lingers at, or a pace behind them.
      const slot = displayCarNear(player.x, player.y, 7 * UNITS_PER_METRE);
      if (slot !== s.lookSlot) {
        s.lookSlot = slot;
        s.lookSince = gameTime;
      }
      const lingering = slot && gameTime - s.lookSince > 1.2;
      let tx, ty;
      if (lingering) {
        // Stand at the car's flank on the player's side, a little ahead of them.
        const c = slot.car || slot,
          side = Math.atan2(player.y - c.y, player.x - c.x) + 0.7,
          r = (vehicleSpec(c).l || 36) * 0.5 + 8;
        tx = c.x + Math.cos(side) * r;
        ty = c.y + Math.sin(side) * r;
      } else {
        const back = player.a + Math.PI + 0.6;
        tx = player.x + Math.cos(back) * 20;
        ty = player.y + Math.sin(back) * 20;
      }
      if (d > 110) {
        // Lost the customer: catch up along the aisles.
        if (!s.route.length) {
          s.route = dealerAislePath(p.x, p.y, player.x, player.y);
          s.routeAt = gameTime;
        }
        dealerFollow(p, 9 * KMH, deltaSeconds);
        p.pose = null;
        return true;
      }
      const arrived = dealerStep(p, tx, ty, d > 40 ? 7.5 * KMH : 4.5 * KMH, deltaSeconds, 5);
      if (arrived) {
        p.a = lingering ? headingBetween(p, slot.car || slot) : headingBetween(p, player);
        const talk = gameTime - s.spokeAt;
        if (lingering && talk > 6.5) {
          dealerSay(p, dealerPitchLine(slot), 4.2, true);
          p.pose = 'point';
          p.a = headingBetween(p, slot.car || slot);
        } else if (!lingering && talk > 14 && seededRandom() < deltaSeconds * 0.3) dealerSay(p, randomChoice(DEALER_LINES.follow), 3, true);
        else if (talk > 2.5) p.pose = s.index === 1 ? 'arms' : null;
      } else if (p.pose === 'point' || p.pose === 'wave') p.pose = null;
      return true;
    }
    // During the delivery the escort (or the first salesman) stands by the stage.
    function dealershipRevealStaff(starting) {
      const salesman = (dealerPeople.escort && pedestrians.includes(dealerPeople.escort) ? dealerPeople.escort : null) || dealerPeople.staff.find((q) => q.dealer?.role === 'salesman' && q.hp > 0);
      if (!salesman) return;
      const s = salesman.dealer,
        v = DEALER.viewing,
        h = DEALER.handover;
      if (starting) {
        s.state = 'reveal';
        s.revealSpot = { x: v.x + 26, y: v.y - 10 };
        salesman.x = s.revealSpot.x;
        salesman.y = s.revealSpot.y;
        s.revealLine = 0;
        dealerPeople.escort = salesman;
      } else {
        s.revealSpot = { x: h.x + 22, y: h.y - 26 };
        salesman.x = s.revealSpot.x;
        salesman.y = s.revealSpot.y;
        salesman.a = headingBetween(salesman, player);
        dealerSay(salesman, randomChoice(DEALER_LINES.keys), 4.5, true);
        salesman.pose = 'wave';
        s.state = 'escort';
        s.revealDone = gameTime;
      }
    }
    function dealerRevealStand(p, s, deltaSeconds) {
      const r = dealer.reveal;
      if (!r) {
        s.state = 'post';
        return true;
      }
      if (s.revealSpot) dealerStep(p, s.revealSpot.x, s.revealSpot.y, 3 * KMH, deltaSeconds, 3);
      p.a = headingBetween(p, DEALER.stage);
      if (r.t > 3.4 && !s.revealLine) {
        s.revealLine = 1;
        dealerSay(p, randomChoice(DEALER_LINES.sold), 4.5, true);
        p.pose = 'clap';
      } else if (r.t > 5 && s.revealLine === 1) {
        s.revealLine = 2;
        p.pose = 'point';
      }
      return true;
    }
    function updateDealerFan(p, s, deltaSeconds) {
      const H = DEALER.hall,
        d = DEALER.doorPeople;
      if (s.state === 'enter') {
        if (!s.route.length) s.route = [{ x: (d.x0 + d.x1) / 2, y: H.y1 + 20 }, { x: (d.x0 + d.x1) / 2, y: H.y1 - 16 }];
        if (dealerFollow(p, 4.5 * KMH * p.pace, deltaSeconds)) s.state = 'choose';
        return true;
      }
      if (s.state === 'choose') {
        s.visits++;
        if (s.visits > 4 + (s.index % 3)) {
          s.state = 'leave';
          s.route = [...dealerAislePath(p.x, p.y, (d.x0 + d.x1) / 2, H.y1 - 16), { x: (d.x0 + d.x1) / 2, y: H.y1 + 30 }, { x: (d.x0 + d.x1) / 2 + randomBetween(-30, 30), y: DEALER.lot.y + DEALER.lot.h + 30 }];
          return true;
        }
        const choices = DEALER.slots.filter((q) => q.car && q !== s.slot),
          slot = choices[Math.floor(seededRandom() * choices.length)];
        if (!slot) return true;
        s.slot = slot;
        const v = dealerViewPoint(slot, p.x, p.y);
        s.route = slot.where === 'hall' && inDealerHall(p.x, p.y) ? dealerAislePath(p.x, p.y, v.x + randomBetween(-8, 8), v.y + randomBetween(-4, 4)) : [{ x: (d.x0 + d.x1) / 2, y: H.y1 + 26 }, v];
        s.state = 'walk';
        return true;
      }
      if (s.state === 'walk') {
        if (dealerFollow(p, 4.6 * KMH * p.pace, deltaSeconds)) {
          s.state = 'look';
          s.stay = randomBetween(6, 15);
          s.pose = randomChoice(['film', 'film', 'watch', 'point', 'gasp', 'watch', 'film']);
        }
        p.pose = null;
        return true;
      }
      if (s.state === 'look') {
        s.stay -= deltaSeconds;
        const c = s.slot?.car || s.slot;
        if (c) p.a = headingBetween(p, c);
        p.pose = s.pose;
        p.walking = false;
        // Something to say, now and then, near the player.
        const near = Math.hypot(player.x - p.x, player.y - p.y) < 300;
        if (near && gameTime - s.spokeAt > 12 && gameTime - dealerPeople.lastFanLine > 3.5 && seededRandom() < deltaSeconds * 0.35) {
          const hour = (worldMinutes % 1440) / 60,
            own = DEALER_CAR_LINES[s.slot?.type]?.fan,
            pool = own && seededRandom() < 0.45 ? own : hour >= 21 || hour < 6 ? (seededRandom() < 0.4 ? DEALER_LINES.fanNight : DEALER_LINES.fan) : DEALER_LINES.fan;
          dealerSay(p, randomChoice(pool), 3.2);
          dealerPeople.lastFanLine = gameTime;
          if (seededRandom() < 0.4) p.pose = 'point';
        }
        if (s.stay <= 0) {
          s.state = 'choose';
          p.pose = null;
        }
        return true;
      }
      if (s.state === 'leave') {
        if (dealerFollow(p, 4.8 * KMH * p.pace, deltaSeconds)) {
          const i = pedestrians.indexOf(p);
          if (i >= 0) pedestrians.splice(i, 1);
        }
        return true;
      }
      s.state = 'choose';
      return true;
    }
    // The alarm: staff drop behind the desks and the cars, visitors run for the doors.
    function dealerPanic(p, s, deltaSeconds) {
      const H = DEALER.hall;
      if (s.state !== 'panic' && s.state !== 'cower') {
        s.state = s.role === 'fan' ? 'panic' : 'cower';
        s.route = [];
        if (seededRandom() < 0.6) dealerSay(p, randomChoice(s.role === 'fan' ? DEALER_LINES.fanScared : DEALER_LINES.alarm), 2.4);
        if (dealerPeople.escort === p) dealerPeople.escort = null;
        if (s.role === 'fan') {
          const exits = [
            { x: (DEALER.doorPeople.x0 + DEALER.doorPeople.x1) / 2, y: H.y1 },
            { x: (DEALER.doorCars.x0 + DEALER.doorCars.x1) / 2, y: H.y1 },
          ];
          const exit = exits.reduce((b, e) => (!b || Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? e : b), null);
          s.route = inDealerHall(p.x, p.y) ? [...dealerAislePath(p.x, p.y, exit.x, H.y1 - 14), { x: exit.x, y: H.y1 + 30 }] : [];
          s.route.push({ x: p.x + randomBetween(-60, 60), y: DEALER.lot.y + DEALER.lot.h + 80 });
        }
      }
      if (s.state === 'panic') {
        p.pose = null;
        if (dealerFollow(p, 18 * KMH, deltaSeconds)) {
          const i = pedestrians.indexOf(p);
          if (i >= 0) pedestrians.splice(i, 1);
        }
        return true;
      }
      p.walking = false;
      p.pose = 'cower';
      return true;
    }
    function dealershipCalmPeople() {
      for (const p of dealerPeople.staff) if (p.dealer) {
        p.dealer.state = 'post';
        p.dealer.route = [];
        p.pose = null;
      }
      for (const g of dealerPeople.guards) {
        g.playerThreatUntil = 0;
        g.aiming = false;
      }
      dealerPeople.reinforced = false;
    }
    function dealershipPeopleReport() {
      const person = (p) => ({ role: p.dealer?.role || 'guard', state: p.dealer?.state || (p.aiming ? 'firing' : 'post'), x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), speech: p.speechUntil > gameTime ? p.speech : null, pose: p.pose || null, route: p.dealer?.route?.[0] ? [Math.round(p.dealer.route[0].x), Math.round(p.dealer.route[0].y), p.dealer.route.length] : null });
      return {
        live: dealerPeople.live,
        staff: dealerPeople.staff.filter((p) => pedestrians.includes(p)).map(person),
        guards: dealerPeople.guards.map(person),
        fans: dealerPeople.fans.filter((p) => pedestrians.includes(p)).map(person),
        escort: dealerPeople.escort ? Math.round(distanceBetween(dealerPeople.escort, player)) : null,
        playerInside: dealerPeople.playerInside,
      };
    }
    // END SUBSYSTEM: src/dealership-people.js
