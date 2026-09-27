    // CIRRUS, the sky bar on EVOLUTION's roof: the terrace plan, its guests and staff, their conversations, drinks at the bar; the Key's doormen.
    /**
     * CIRRUS sky bar
     * Source: src/skyline-bar.js
     * Scope: game closure; the terrace is drawn by skyline3d-bar.js from skyBarPlan().
     *
     * The terrace is the oval top of the twisted tower, 180 m up, reached only
     * by the lobby lift (skyline-lift.js). Its plan is in tower-local units about
     * the tower's centre (x east, y south), placed once in world units by
     * skyBarPlan(b): the lift house on the north edge, the bar counter and back
     * bar on the west, a fire-pit lounge on the east, tables for two along the
     * south balustrade (the view back over the city) and a business table in the
     * middle. Every piece but the stools is a keep-out for the player
     * (b.deckKeepOuts): you stand at the bar between them.
     *
     * The people exist only while the player is near the tower (pedestrians
     * flagged `keyPerson`, state 'key', so the street crowd never recruits or
     * streams them; updateKeyPerson keeps them in place). Couples on dates and
     * business pairs talk in speech bubbles, one table at a time so every line
     * can be read, and only while the player is up there. Gunfire sends them
     * under the tables. The doormen at the lobbies and the valet at the circle
     * are the same kind of person on the ground.
     */
    const SKY_BAR = {
      // The oval deck is 182 x 117 (EVOLUTION's top, twisted half a turn); the
      // walker's centre keeps about 14 in from its edge.
      house: { x: 0, y: -50, hx: 16, hy: 7 },
      counter: { x: -62, y: -2, hx: 4, hy: 18 },
      backBar: { x: -82, y: -2, hx: 3, hy: 12 },
      stools: [
        [-52, -12],
        [-52, 0],
        [-52, 12],
      ],
      bartender: { x: -72, y: -2, a: 0 },
      // Tables for two: centre; the seats face each other across it.
      tables: [
        { x: -34, y: 26, kind: 'date' },
        { x: 0, y: 32, kind: 'date' },
        { x: 32, y: 28, kind: 'date' },
        { x: -26, y: -12, kind: 'business' },
      ],
      lounge: { x: 58, y: 0, pit: 7, kind: 'business' },
      planters: [
        [-40, -38],
        [40, -38],
      ],
      // A pair at the south-west balustrade, looking out.
      standing: [
        { x: -64, y: 18, a: 2.2 },
        { x: -56, y: 25, a: -2.4 },
      ],
      waiterRoute: [
        [-2, -24],
        [14, 4],
        [24, 16],
        [2, 18],
        [-18, 14],
        [-36, 2],
        [-40, -24],
      ],
    };
    /* The plan in world units for tower `b` (keep-outs are {x, y, hx, hy}). */
    function skyBarPlan(b) {
      const cx = b.x + b.w / 2,
        cy = b.y + b.h / 2,
        at = (x, y) => ({ x: cx + x, y: cy + y }),
        box = (x, y, hx, hy) => ({ x: cx + x, y: cy + y, hx, hy, a: 0 }),
        P = SKY_BAR,
        tables = P.tables.map((t) => ({
          ...at(t.x, t.y),
          kind: t.kind,
          seats: [
            { ...at(t.x - 9, t.y), a: 0 },
            { ...at(t.x + 9, t.y), a: Math.PI },
          ],
        })),
        L = P.lounge,
        lounge = {
          ...at(L.x, L.y),
          pit: L.pit,
          kind: L.kind,
          seats: [
            { ...at(L.x - 6, L.y - 14), a: Math.PI / 2 },
            { ...at(L.x + 6, L.y + 14), a: -Math.PI / 2 },
          ],
          sofas: [at(L.x, L.y - 15), at(L.x, L.y + 15)],
        };
      const house = box(P.house.x, P.house.y, P.house.hx, P.house.hy);
      return {
        center: { x: cx, y: cy },
        house,
        door: at(P.house.x, P.house.y + P.house.hy + 6),
        counter: box(P.counter.x, P.counter.y, P.counter.hx, P.counter.hy),
        backBar: box(P.backBar.x, P.backBar.y, P.backBar.hx, P.backBar.hy),
        stools: P.stools.map(([x, y]) => at(x, y)),
        bartender: { ...at(P.bartender.x, P.bartender.y), a: P.bartender.a },
        tables,
        lounge,
        planters: P.planters.map(([x, y]) => at(x, y)),
        standing: P.standing.map((s) => ({ ...at(s.x, s.y), a: s.a })),
        waiterRoute: P.waiterRoute.map(([x, y]) => at(x, y)),
        keepOuts: [
          { ...house, hx: house.hx + 1, hy: house.hy + 1 },
          box(P.counter.x, P.counter.y, P.counter.hx + 1, P.counter.hy + 1),
          box(P.backBar.x, P.backBar.y, P.backBar.hx + 1, P.backBar.hy + 1),
          ...P.tables.map((t) => box(t.x, t.y, 14, 5)),
          box(L.x, L.y, 16, 20),
          ...P.planters.map(([x, y]) => box(x, y, 6, 6)),
        ],
      };
    }
    const skyBarLift = () => SKY_LIFTS.find((l) => l.id === 'bar');
    /* ---- Lines ------------------------------------------------------------------ */
    // Scripts are [speaker, line] with speaker 0 or 1 of the pair.
    const SKY_BAR_TALKS = {
      date: [
        [[0, 'I still can’t believe you got us a table up here.'], [1, 'I know the maître d’. Well, his cousin.'], [0, 'The whole city looks like a jewellery box.'], [1, 'That’s the idea. Champagne?'], [0, 'Only if you’re having one.']],
        [[0, 'So… do you bring all your first dates here?'], [1, 'Only the ones I want a second date with.'], [0, 'Smooth. Very smooth.'], [1, 'Is it working?'], [0, 'Ask me after dessert.']],
        [[1, 'Look, the bridge lights just came on.'], [0, 'You planned that.'], [1, 'I booked the table for sunset. The bridge was luck.'], [0, 'I’ll take the luck.']],
        [[0, 'Ten years this Friday.'], [1, 'Ten years, and you still pick the view over me.'], [0, 'The view is behind you. I’m looking at you.'], [1, 'Good answer.']],
        [[1, 'Why do you keep touching your jacket pocket?'], [0, 'No reason. Nerves. The height.'], [1, 'You flew us here in a helicopter last month.'], [0, '…More champagne?']],
        [[0, 'So you’re in… pagers?'], [1, 'Telecommunications. Pagers are the past.'], [0, 'My dentist still carries one.'], [1, 'Your dentist is the past.']],
        [[1, 'My mother says you’re too old for me.'], [0, 'Your mother has excellent taste in wine.'], [1, 'That’s not a denial.'], [0, 'It’s a toast. To your mother.']],
        [[0, 'Dance with me.'], [1, 'There’s no dance floor.'], [0, 'There’s a whole sky.'], [1, 'One song. And don’t step on my shoes.']],
        [[1, 'Do you think it sways? The tower?'], [0, 'A little. They build them to.'], [1, 'I’m holding on to you, then.'], [0, 'That was my plan all along.']],
      ],
      business: [
        [[0, 'Hong Kong changes hands in July. Money will move.'], [1, 'And we want to be where it lands.'], [0, 'South Coast. Low taxes, deep harbour.'], [1, 'I’ll have the lawyers draft it tonight.']],
        [[1, 'Your numbers are good. Too good.'], [0, 'Eleven percent, quarter on quarter.'], [1, 'Nobody grows eleven percent without help.'], [0, 'Then consider this dinner the help.']],
        [[0, 'The Monarch Isle marina deal closes Monday.'], [1, 'If the council votes our way.'], [0, 'The council drinks at this bar every Thursday.'], [1, 'Then the next round is on me.']],
        [[1, 'Everyone keeps talking about the internet.'], [0, 'A fad. Like car phones.'], [1, 'I have a car phone.'], [0, 'Exactly my point.']],
        [[0, 'Sign here, and here. Initial there.'], [1, 'You brought a contract to a cocktail bar?'], [0, 'I brought a pen to a cocktail bar. Big difference.'], [1, 'Fine. But you’re paying.']],
        [[1, 'A computer beat the chess champion. Read it this morning.'], [0, 'Next it’ll be trading our portfolio.'], [1, 'It can have my job. I’m keeping the view.']],
        [[0, 'The baht is sliding. Asia could get ugly.'], [1, 'Ugly for them is cheap for us.'], [0, 'You’re a cold man.'], [1, 'I’m a rich man. It gets cold up here.']],
        [[1, 'Forty floors of offices and a hotel on top of Mercury.'], [0, 'And a waiting list for every one.'], [1, 'Then we build a fourth tower.'], [0, 'On what? The Key is full.'], [1, 'Then we build a second Key.']],
      ],
      view: [
        [[0, 'Is that the cruise ship? It looks like a toy.'], [1, 'Everything looks like a toy from here.']],
        [[1, 'Two hundred metres of nothing under us.'], [0, 'Don’t say that. Say it’s a lovely view.']],
        [[0, 'You can see all the way to the Ridgeline.'], [1, 'And the traffic on the bridge. Like fireflies.']],
      ],
    };
    const SKY_BAR_LINES = {
      solo: ['Another one. Make it a double.', 'She said eight o’clock.', 'Put it on the company card.', 'To absent friends.'],
      bartender: ['Good evening. What can I get you?', 'The house martini is excellent tonight.', 'Shaken, not stirred? Everyone says that.', 'Mind the edge. It’s a long way down.'],
      waiter: ['Right away, madam.', 'Another bottle for table four.', 'Excuse me. Pardon me.', 'The oysters came in this morning.', 'Your table is ready, sir.'],
      doorman: ['Good evening. Welcome to North Point Key.', 'The sky bar is on EVOLUTION’s roof, sir. Lift’s inside.', 'Mind the step, sir.', 'Lovely evening for it.'],
      valet: ['Keys, sir?', 'I’ll bring it round to the circle.', 'Nice wheels.'],
      scared: ['Get down!', 'Oh my god!', 'Somebody call security!', 'Under the table!'],
    };
    /* ---- People -------------------------------------------------------------------- */
    const SKY_BAR_DRESS = {
      suit: ['#1c2331', '#23272e', '#2f3e57', '#3a3230', '#1d1f24'],
      dress: ['#8e1f2a', '#1d1f24', '#e5e1d6', '#1f5f7a', '#6d3f76', '#d4b24a', '#c23b6b', '#0f3b4a'],
      shoes: ['#141414', '#1e1a18', '#3a2618'],
    };
    function dressKeyPerson(p, style) {
      dressPerson(p, style === 'staff' ? 'worker' : 'reveller');
      const L = p.look;
      L.hat = 0;
      L.backpack = false;
      L.umbrella = null;
      L.shoes = randomChoice(SKY_BAR_DRESS.shoes);
      if (style === 'gown') {
        L.top = p.color = randomChoice(SKY_BAR_DRESS.dress);
        L.pants = L.top;
        L.skirt = true;
        L.sleeves = seededRandom() < 0.3;
        L.hairStyle = randomChoice([2, 2, 3, 4]);
      } else if (style === 'suit') {
        L.top = p.color = randomChoice(SKY_BAR_DRESS.suit);
        L.pants = L.top;
        L.skirt = false;
        L.sleeves = true;
        L.hairStyle = randomChoice([0, 1, 1, 3]);
      } else {
        // Staff: white jacket, black trousers.
        L.top = p.color = '#f1efe8';
        L.pants = '#15171a';
        L.skirt = false;
        L.sleeves = true;
      }
      p.carry = null;
      return p;
    }
    function makeKeyPerson(spot, altitude, role, style, extra = {}) {
      const p = {
        x: spot.x,
        y: spot.y,
        a: spot.a ?? 0,
        hp: 30,
        flee: 0,
        timer: 0,
        walk: 0,
        state: 'key',
        keyPerson: { role, home: { x: spot.x, y: spot.y, a: spot.a ?? 0 }, ...extra },
      };
      if (altitude) p.altitude = altitude;
      dressKeyPerson(p, style);
      pedestrians.push(p);
      return p;
    }
    // A doorman or valet at a post on the ground (populateNorthPointKey).
    function spawnKeyStaff(post) {
      const p = makeKeyPerson(post, 0, post.role, 'staff');
      if (post.role === 'doorman') {
        p.look.top = p.color = '#1c2a44';
        p.look.hat = 1;
        p.look.hatColor = '#1c2a44';
      } else {
        p.look.top = p.color = '#6b1f24';
      }
      p.pose = 'wait';
      return p;
    }
    const skyBar = { live: false, clock: 0, groups: [], talker: null, rest: 3, staffLine: 8, people: [] };
    // Fill the terrace (the lift calls this on arrival; the update when the player comes near).
    function skyBarArrive() {
      if (skyBar.live) return;
      const lift = skyBarLift();
      if (!lift) return;
      const plan = lift.bar,
        z = lift.b.height,
        resume = randomSeed,
        people = [];
      randomSeed = 1997 + ((worldMinutes / 60) | 0);
      const seat = (s, role, style, extra) => {
        const p = makeKeyPerson(s, z, role, style, extra);
        p.sitting = true;
        p.pose = 'sit';
        p.sipping = false;
        people.push(p);
        return p;
      };
      skyBar.groups = [];
      for (const t of plan.tables) {
        const pair =
          t.kind === 'date'
            ? [seat(t.seats[0], 'guest', seededRandom() < 0.5 ? 'gown' : 'suit'), null]
            : [seat(t.seats[0], 'guest', 'suit'), seat(t.seats[1], 'guest', seededRandom() < 0.35 ? 'gown' : 'suit')];
        if (!pair[1]) pair[1] = seat(t.seats[1], 'guest', pair[0].look.skirt ? 'suit' : 'gown');
        skyBar.groups.push({ kind: t.kind, members: pair, used: [] });
      }
      const L = plan.lounge;
      skyBar.groups.push({ kind: L.kind, members: [seat(L.seats[0], 'guest', 'suit'), seat(L.seats[1], 'guest', 'suit')], used: [] });
      const standing = plan.standing.map((s, k) => {
        const p = makeKeyPerson(s, z, 'guest', k ? 'suit' : 'gown');
        p.pose = p.keyPerson.pose = 'drink';
        p.carry = 'cocktail';
        people.push(p);
        return p;
      });
      skyBar.groups.push({ kind: 'view', members: standing, used: [] });
      // A regular on a stool, facing the bar.
      const solo = seat({ ...plan.stools[1], a: Math.PI }, 'solo', 'suit');
      solo.carry = 'cocktail';
      const bartender = makeKeyPerson(plan.bartender, z, 'bartender', 'staff');
      bartender.pose = 'bartend';
      const waiter = makeKeyPerson({ ...plan.waiterRoute[0], a: 0 }, z, 'waiter', 'staff', { route: plan.waiterRoute, leg: 1, pause: 0 });
      waiter.carry = 'tray';
      waiter.pose = 'tray';
      people.push(bartender, waiter);
      // Everyone seated at a table has a glass in hand now and then (updateKeyPerson).
      for (const p of people) if (p.sitting) p.keyPerson.sipAt = gameTime + randomBetween(2, 12);
      skyBar.people = people;
      skyBar.talker = null;
      skyBar.rest = 2;
      skyBar.live = true;
      randomSeed = resume;
    }
    function skyBarLeave() {
      if (!skyBar.live) return;
      for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].keyPerson && pedestrians[i].altitude) pedestrians.splice(i, 1);
      skyBar.people = [];
      skyBar.groups = [];
      skyBar.talker = null;
      skyBar.live = false;
    }
    function keySay(p, text) {
      if (!p || p.hp <= 0) return;
      p.speech = text;
      p.speechUntil = gameTime + speechReadSeconds(text);
      p.speechKind = 'keyTalk';
      p.speechKindText = text;
    }
    /* ---- The bar's clock, once a frame (game-people.js) ------------------------------- */
    function updateNorthPointKey(deltaSeconds) {
      const lift = skyBarLift();
      if (!lift) return;
      const b = lift.b,
        onBar = player.buildingRoof === b,
        near = onBar || Math.hypot(player.x - (b.x + b.w / 2), player.y - (b.y + b.h / 2)) < 900;
      if (near && !skyBar.live) skyBarArrive();
      else if (!near && skyBar.live && Math.hypot(player.x - (b.x + b.w / 2), player.y - (b.y + b.h / 2)) > 1400) skyBarLeave();
      if (!skyBar.live || !onBar) return;
      // One table talks at a time, the nearest that has rested longest; staff chip in.
      if (skyBar.talker) {
        const g = skyBar.talker;
        g.wait -= deltaSeconds;
        if (g.members.some((p) => p.hp <= 0 || p.keyPerson.scaredUntil > gameTime)) skyBar.talker = null;
        else if (g.wait <= 0) {
          const [who, text] = g.script[g.line++];
          keySay(g.members[who], text);
          g.wait = speechReadSeconds(text) + 0.5;
          if (g.line >= g.script.length) {
            g.restUntil = gameTime + 20;
            skyBar.talker = null;
            skyBar.rest = randomBetween(2.5, 5);
          }
        }
      } else if ((skyBar.rest -= deltaSeconds) <= 0) {
        const ready = skyBar.groups.filter((g) => !(g.restUntil > gameTime) && g.members.every((p) => p.hp > 0 && !(p.keyPerson.scaredUntil > gameTime)));
        if (ready.length) {
          ready.sort((g, h) => distanceBetween(g.members[0], player) - distanceBetween(h.members[0], player));
          const g = ready[Math.min(ready.length - 1, seededRandom() < 0.7 ? 0 : 1)],
            pool = SKY_BAR_TALKS[g.kind],
            fresh = pool.map((_, i) => i).filter((i) => !g.used.includes(i)),
            pick = fresh.length ? randomChoice(fresh) : ((g.used.length = 0), Math.floor(seededRandom() * pool.length));
          g.used.push(pick);
          g.script = pool[pick];
          g.line = 0;
          g.wait = 0;
          skyBar.talker = g;
        } else skyBar.rest = 3;
      }
      if ((skyBar.staffLine -= deltaSeconds) <= 0) {
        skyBar.staffLine = randomBetween(14, 24);
        const staff = skyBar.people.filter((p) => ['waiter', 'bartender', 'solo'].includes(p.keyPerson.role) && p.hp > 0);
        const p = randomChoice(staff);
        if (p && !(p.speechUntil > gameTime) && !skyBar.talker?.members.some((q) => q.speechUntil > gameTime)) keySay(p, randomChoice(SKY_BAR_LINES[p.keyPerson.role]));
      }
    }
    // What sends one of the Key's people down: shots, a blast, a fight, someone running.
    const KEY_ALARMS = new Set(['gunfire', 'explosion', 'melee']),
      KEY_FRIGHTS = new Set(['flee', 'cower', 'shelter', 'handsUp', 'freeze', 'startle']);
    /* One of the Key's people this frame: true when handled (game-people.js). */
    function updateKeyPerson(p, deltaSeconds) {
      const k = p.keyPerson;
      if (!k) return false;
      // The street crowd's reactions are not theirs: a fright under the table (or a
      // crouch at a post) for a while, anything else forgotten. Up on the terrace only
      // what happens up there counts (the alarms reach by distance on the map).
      if (p.pending || p.react || p.flee > 0) {
        const fright = (p.pending && KEY_ALARMS.has(p.pending.inc?.kind)) || (p.react && KEY_FRIGHTS.has(p.react.kind)) || p.flee > 0,
          here = !p.altitude || player.buildingRoof?.skyline?.roof === 'bar';
        p.pending = null;
        p.react = null;
        p.flee = 0;
        if (fright && here) {
          if (!(k.scaredUntil > gameTime)) keySay(p, randomChoice(SKY_BAR_LINES.scared));
          k.scaredUntil = gameTime + randomBetween(9, 14);
        }
      }
      if (k.scaredUntil > gameTime) {
        p.pose = 'cower';
        p.walking = false;
        return true;
      }
      if (k.role === 'waiter') {
        p.pose = 'tray';
        if (k.pause > 0) {
          k.pause -= deltaSeconds;
          p.walking = false;
          return true;
        }
        const next = k.route[k.leg],
          d = distanceBetween(p, next),
          step = Math.min(d, FOOT_WALK * 0.9 * deltaSeconds);
        p.a = Math.atan2(next.y - p.y, next.x - p.x);
        p.x += Math.cos(p.a) * step;
        p.y += Math.sin(p.a) * step;
        p.walk += step * 0.19;
        p.walking = true;
        if (d < 1.5) {
          k.leg = (k.leg + 1) % k.route.length;
          if (k.leg % 2 === 0) k.pause = randomBetween(1.5, 3.5);
        }
        return true;
      }
      p.walking = false;
      p.x = k.home.x;
      p.y = k.home.y;
      if (k.pose) p.pose = k.pose;
      if (k.role === 'bartender') {
        p.pose = 'bartend';
        return true;
      }
      if (k.role === 'doorman' || k.role === 'valet') {
        p.pose = 'wait';
        p.a = k.home.a;
        // A word to the player walking past, now and then.
        if (!player.car && distanceBetween(p, player) < 46 && !(k.greetedAt > gameTime - 30)) {
          k.greetedAt = gameTime;
          keySay(p, randomChoice(SKY_BAR_LINES[k.role]));
        }
        return true;
      }
      if (p.sitting) {
        p.pose = 'sit';
        p.a = k.home.a;
        // A sip now and then (the sit pose lifts the glass while sipping).
        if (k.sipAt && gameTime > k.sipAt) {
          p.sipping = !p.sipping;
          p.carry = p.sipping ? 'cocktail' : k.role === 'solo' ? 'cocktail' : null;
          k.sipAt = gameTime + (p.sipping ? randomBetween(1.2, 2.2) : randomBetween(6, 16));
        }
      }
      return true;
    }
    /* ---- The bar itself ------------------------------------------------------------- */
    const SKY_BAR_DRINK = { price: 45, health: 10 };
    function skyBarCounterInReach() {
      const lift = skyBarLift();
      if (!lift || player.buildingRoof !== lift.b) return false;
      const c = lift.bar.counter,
        d = Math.hypot(Math.max(0, Math.abs(player.x - c.x) - c.hx), Math.max(0, Math.abs(player.y - c.y) - c.hy));
      return withinRange('key-bar', d, 16);
    }
    function skyBarPrompt() {
      const lift = skyBarLift();
      if (!lift || player.buildingRoof !== lift.b) return null;
      if (skyBarCounterInReach()) return { text: 'ORDER A DRINK · $' + SKY_BAR_DRINK.price, id: 'key-bar' };
      return { text: 'CIRRUS · SKY BAR', id: 'key-terrace', key: null };
    }
    function skyBarInteract() {
      if (!skyBarCounterInReach()) return false;
      const bartender = skyBar.people.find((p) => p.keyPerson.role === 'bartender' && p.hp > 0);
      if (!bartender || bartender.keyPerson.scaredUntil > gameTime) {
        tell('Nobody behind the bar right now.', 2);
        return true;
      }
      if (cash < SKY_BAR_DRINK.price) {
        keySay(bartender, 'That’s forty-five dollars, sir. Cash or card.');
        tell('Not enough cash.', 2);
        return true;
      }
      cash -= SKY_BAR_DRINK.price;
      player.hp = Math.min(100, player.hp + SKY_BAR_DRINK.health);
      keySay(bartender, randomChoice(['One CIRRUS martini. Enjoy the view.', 'On the rocks, as you like it.', 'Our signature. Gin, elderflower, a little gold leaf.']));
      tell('CIRRUS · A drink with a view · $' + SKY_BAR_DRINK.price, 2.5);
      save();
      return true;
    }
    // Lounge music and glasses up on the terrace (ambience.js voices), while the player is there.
    const SKY_BAR_CHORDS = [
      [220, 277, 330, 415],
      [196, 247, 294, 370],
      [175, 220, 262, 330],
      [165, 208, 247, 311],
    ];
    let skyBarMusicClock = 0,
      skyBarMusicIndex = 0;
    function skyBarSound(deltaSeconds) {
      const lift = skyBarLift();
      if (!lift || player.buildingRoof !== lift.b || !audio || !ambience) return;
      skyBarMusicClock -= deltaSeconds;
      if (skyBarMusicClock > 0) return;
      skyBarMusicClock = 0.42;
      const i = skyBarMusicIndex++,
        chord = SKY_BAR_CHORDS[Math.floor(i / 8) % SKY_BAR_CHORDS.length],
        now = audio.currentTime,
        pan = -0.35;
      if (i % 8 === 0) for (const note of chord) voice('sine', note, now, 3.2, 0.018, 0, pan, 1600);
      if (i % 2 === 0) voice('triangle', chord[[0, 2, 1, 3][(i / 2) % 4]] * 2, now, 0.5, 0.02, 0, pan, 2600);
      // A glass set down or a toast somewhere on the terrace.
      if (seededRandom() < 0.08) voice('sine', 2600 + seededRandom() * 900, now + 0.1, 0.25, 0.012, 0, seededRandom() - 0.5);
    }
