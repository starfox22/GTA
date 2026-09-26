    // Marea beach club people: door talk, spawning, routing, walking and leaving (mareaSay, mareaSpawn, mareaWalk).
    /**
     * WHAT PEOPLE SAY
     * Every line goes through crowdSay (crowd.js), registered as its own
     * one-line kind, so the club's chatter follows the crowd's speech rules.
     */
    const MAREA_DOOR_TALK = {
      reject: [
        [['b', 'Name?'], ['p', 'Uh… Dave. Plus four.'], ['b', 'Not on the list.'], ['p', 'Check again, man!'], ['b', 'Not tonight.']],
        [['b', 'How many?'], ['p', 'Just us guys.'], ['b', 'Not tonight, fellas.'], ['p', 'Seriously?!']],
        [['b', 'Those shoes?'], ['p', 'They’re vintage!'], ['b', 'They’re flip-flops. Walk.']],
        [['b', 'You been drinking?'], ['p', 'Me? Nooo… hic.'], ['b', 'Go home, champ.']],
        [['b', 'ID.'], ['p', 'Left it in the car.'], ['b', 'Then go get it.']],
        [['p', 'I know the DJ!'], ['b', 'Everybody knows the DJ.'], ['p', 'Unbelievable.']],
        [['p', 'Do you know who I am?'], ['b', 'Nope. Step aside.']],
        [['b', 'Private event tonight.'], ['p', 'Since when?!'], ['b', 'Since you showed up.']],
        [['h', 'Name?'], ['p', 'Try under “Rick”.'], ['h', 'No Rick.'], ['b', 'Next!']],
        [['p', 'Five minutes, you said!'], ['b', 'And now I’m saying no.']],
      ],
      admit: [
        [['b', 'Nice shoes. You’re in.'], ['p', 'Thank you!']],
        [['h', 'Name?'], ['p', 'Marisol. Plus one.'], ['h', 'Enjoy your night.']],
        [['b', 'ID.'], ['p', 'Here.'], ['b', 'Go ahead.']],
        [['h', 'VIP? Right this way.']],
        [['b', 'Forty cover.'], ['p', 'Keep the change.'], ['b', 'Have a good one.']],
        [['b', 'Just the two of you?'], ['p', 'Just us.'], ['b', 'In you go.']],
        [['h', 'You’re on the list.'], ['p', 'Told you!']],
        [['b', 'Behave in there.'], ['p', 'Always.']],
      ],
      queue: [
        'Is the line always this long?', 'I heard Kaito’s spinning tonight.', 'My feet are killing me.', 'Act sober. ACT SOBER.',
        'Did you put us on the list?', 'Two hours for this?', 'They let HIM in?', 'Is that a celebrity?', 'If we don’t get in, Neon Palace.',
        'I love this song!', 'Can you hear that bass?', 'Text Marco, he’s inside.',
      ],
      bouncerToLine: ['Five-minute wait, step back.', 'Single file, people.', 'Behind the rope.', 'Keep it moving.', 'Nobody gets in if you push.', 'Have your IDs ready.'],
      walkOff: ['This place sucks anyway.', 'Whatever. Neon Palace it is.', 'I’m leaving a review!', 'Your loss, big guy!', 'Worst night ever.', 'We didn’t want in anyway.'],
      cutLine: ['Hey! He cut the line!', 'Are you kidding me?', 'Line’s back here, pal!', 'Must be nice…'],
      floor: ['Wooo!', 'This DJ!', 'I love this song!', 'One more!', 'Hands up!', 'Best night ever!', 'Here comes the drop!'],
      dj: ['Make some noise!', 'Marea, are you with me?!', 'Hands in the air!', 'One more time!'],
      day: ['Another spritz?', 'Pass the sunscreen?', 'This is the life.', 'Is the pool heated?', 'Two mojitos, please.', 'I’m never leaving.', 'Wake me at sunset.'],
      waiter: ['Your drinks.', 'Anything else?', 'Mind your step.', 'Two mojitos?'],
      sunset: ['Look at that sky.', 'Here it goes…', 'Best seat in town.', 'Cheers to that.'],
      evac: ['Everybody out!', 'Move! Move!', 'Out the back!', 'Get to the beach!'],
      bouncerAlarm: ['Everybody back!', 'Doors are shut!', 'Nobody in, nobody out!'],
      bouncerCall: ['Shots fired at Marea, send units!', 'Yeah, Marina Road. Hurry.'],
      shove: ['You’re done here!', 'Out! Now!', 'Walk away, pal.', 'Not in my club!'],
      player: {
        line: 'Back of the line, pal.',
        cover: 'Forty cover. Cash.',
        paid: 'Money talks. Go ahead.',
        broke: 'No cash, no entry.',
        wanted: 'Not with that heat on you.',
        banned: 'You? Not a chance.',
        vipAsk: 'VIP band’s two-fifty.',
        vipPaid: 'Enjoy the view.',
        welcome: 'Welcome to Marea!',
      },
    };
    (function registerMareaLines() {
      const add = (text) => (CROWD_LINES['marea ' + text] = [text]);
      for (const kind of ['reject', 'admit']) for (const script of MAREA_DOOR_TALK[kind]) for (const [, text] of script) add(text);
      for (const kind of Object.keys(MAREA_DOOR_TALK))
        if (Array.isArray(MAREA_DOOR_TALK[kind]) && typeof MAREA_DOOR_TALK[kind][0] === 'string') for (const text of MAREA_DOOR_TALK[kind]) add(text);
      for (const text of Object.values(MAREA_DOOR_TALK.player)) add(text);
    })();
    /* Say a line now (a scripted line interrupts idle chatter) through the crowd's speech. */
    // Settings · Gameplay · NPC chatter off (settings.js) silences the door too;
    // the conversations still run, so people are let in and turned away as before.
    function mareaSay(p, text) {
      if (!p || p.hp <= 0 || !text || !npcChatterOn()) return false;
      p.speechUntil = 0;
      return crowdSay(p, 'marea ' + text, 1);
    }
    function mareaSayOne(p, kind, chance = 1) {
      if (!p || !npcChatterOn() || (p.speechUntil || 0) > gameTime || mareaRandom() > chance) return false;
      return crowdSay(p, 'marea ' + randomChoice(MAREA_DOOR_TALK[kind]), 1);
    }

    /**
     * PEOPLE
     */
    function mareaSpawn(slot, x, y, style) {
      // The club brings its own crowd on top of the street crowd's cap (only people on
      // screen are drawn, and the club never holds more than its slots).
      if (pedestrians.length >= CROWD_HARD_CAP + 260 || marea.people.length >= 260) return null;
      const p = { x, y, a: slot?.a ?? 0, hp: 30, flee: 0, timer: 5, walk: 0, state: 'club' };
      mareaDress(p, style || slot?.dress || 'mixed');
      p.club = { slot: null, route: [], mode: 'walk', since: gameTime, speed: (4.3 + mareaRandom() * 1.2) * KMH };
      p.phase = mareaRandom() * 10;
      pedestrians.push(p);
      marea.people.push(p);
      return p;
    }
    /* Put someone in their slot: seat, pose, altitude, heading, carried things. */
    function mareaSettle(p, slot) {
      const c = p.club;
      c.slot = slot;
      c.mode = 'slot';
      c.route = [];
      p.x = slot.x;
      p.y = slot.y;
      p.a = slot.a;
      p.altitude = slot.z;
      p.danceStyle = slot.style ?? Math.floor(mareaRandom() * 7);
      p.carry = slot.carry ?? p.carry ?? null;
      p.sitting = slot.pose === 'sit';
      p.pose = slot.pose;
      c.swimTarget = null;
      c.wander = 0;
    }
    function mareaAssign(p, slot) {
      slot.person = p;
      p.club.slot = slot;
    }
    /* The walkway route from wherever someone is (a node) to a slot, or out. */
    function mareaRouteTo(p, fromNode, slot) {
      const pts = [];
      for (const id of mareaPath(fromNode, slot.node || 'floor')) pts.push(mareaNodePoint(id));
      for (const [u, v] of slot.via || []) pts.push(mareaPoint(u, v));
      pts.push({ x: slot.x, y: slot.y });
      p.club.route = pts;
      p.club.mode = 'arrive';
    }
    function mareaNearestNode(x, y) {
      let best = 'floor',
        bd = Infinity;
      for (const [id, [u, v]] of Object.entries(MAREA_NODES)) {
        const q = mareaPoint(u, v),
          d = Math.hypot(q.x - x, q.y - y);
        if (d < bd) {
          bd = d;
          best = id;
        }
      }
      return best;
    }
    /* Leave by the door (or the beach gate by day) and hand them to the street. */
    function mareaLeave(p, exit) {
      const c = p.club,
        slot = c.slot;
      if (slot && slot.person === p) slot.person = null;
      c.slot = null;
      p.pose = null;
      p.sitting = false;
      const from = slot ? slot.node || mareaNearestNode(p.x, p.y) : mareaNearestNode(p.x, p.y);
      const pts = [];
      if (slot) for (const [u, v] of [...(slot.via || [])].reverse()) pts.push(mareaPoint(u, v));
      if (slot?.swim) {
        const edge = pts[0] || mareaPoint(p.x - MAREA.plot.x, 216);
        p.x = edge.x;
        p.y = edge.y;
      }
      p.altitude = undefined;
      const target = exit || (marea.phase === 'day' && mareaRandom() < 0.3 ? 'beach' : 'street');
      for (const id of mareaPath(from, target)) pts.push(mareaNodePoint(id));
      if (target === 'street') {
        // Along the forecourt to its west or east end, then off down the pavement.
        const west = mareaRandom() < 0.5;
        pts.push(mareaPoint(west ? -30 : 430, 8));
      }
      c.route = pts;
      c.mode = 'leave';
    }
    /* Hand a person back to the ordinary crowd (walking on, or reacting). */
    function mareaRelease(p) {
      const c = p.club;
      if (c?.slot && c.slot.person === p) c.slot.person = null;
      if (c?.group) c.group.members = c.group.members.filter((q) => q !== p);
      p.club = null;
      p.altitude = undefined;
      p.sitting = false;
      p.pose = null;
      p.state = 'walk';
      p.dir = snapAxis(p.a);
      p.timer = randomBetween(3, 8);
      const i = marea.people.indexOf(p);
      if (i >= 0) marea.people.splice(i, 1);
      const q = marea.queue.findIndex((g) => g.members.includes(p));
      if (q >= 0) marea.queue[q].members = marea.queue[q].members.filter((m) => m !== p);
    }
    function mareaRemove(p) {
      mareaRelease(p);
      const k = pedestrians.indexOf(p);
      if (k >= 0) pedestrians.splice(k, 1);
    }
    function mareaDistance(x, y) {
      const dx = Math.max(MAREA.plot.x - x, 0, x - (MAREA.plot.x + MAREA.plot.w)),
        dy = Math.max(MAREA.plot.y - y, 0, y - (MAREA.plot.y + MAREA.plot.h));
      return Math.hypot(dx, dy);
    }
    function mareaInside(x, y) {
      const { u, v } = mareaLocal(x, y);
      return u > 0 && u < 400 && v > MAREA.wallV + MAREA.wallDepth && v < 300;
    }
    function mareaWalk(p, deltaSeconds, speed) {
      const c = p.club,
        target = c.route[0];
      if (!target) return true;
      const dx = target.x - p.x,
        dy = target.y - p.y,
        d = Math.hypot(dx, dy),
        step = speed * deltaSeconds;
      if (d <= Math.max(1.5, step)) {
        p.x = target.x;
        p.y = target.y;
        c.route.shift();
        return !c.route.length;
      }
      p.a = Math.atan2(dy, dx);
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      p.walk = (p.walk || 0) + deltaSeconds * 6;
      return false;
    }

    /* Per-person update from updatePeople (game.js); true when the club handled them. */
    function updateClubGoer(p, deltaSeconds) {
      const c = p.club;
      if (!c) return false;
      if (p.hp <= 0 || personIncapacitated(p)) {
        mareaRelease(p);
        return false;
      }
      // Danger: right next to it, the crowd decides; otherwise run for an exit.
      if (p.react || p.flee > 0) {
        mareaRelease(p);
        return false;
      }
      if (p.pending) {
        // Right next to it, the crowd decides; a shot the club heard empties it;
        // anything else is lost under the music.
        const inc = p.pending.inc;
        if (c.staff && c.slot?.kind === 'bouncer') p.pending = null;
        else if (!inc || Math.hypot(inc.x - p.x, inc.y - p.y) < 90) {
          mareaRelease(p);
          return false;
        } else {
          p.pending = null;
          if (inc.loud && gameTime < marea.spookedUntil && c.mode !== 'evac') mareaEvacuate(p);
          // People on the pavement are handed straight to the crowd to flee.
          if (!p.club) return false;
        }
      }
      p.walking = false;
      if (c.mode === 'evac') {
        if (mareaWalk(p, deltaSeconds, 72)) {
          marea.evacuated++;
          const from = marea.alarmSource;
          mareaRelease(p);
          startReaction(p, 'flee', randomBetween(5, 9), from, mareaAlarmIncident());
        }
        return true;
      }
      if (c.mode === 'arrive' || c.mode === 'leave' || c.mode === 'queueWalk') {
        const speed = c.mode === 'leave' && marea.phase === 'closing' ? c.speed * 0.8 : c.speed;
        p.pose = c.carryPose || null;
        p.sitting = false;
        p.walking = true;
        if (mareaWalk(p, deltaSeconds, speed)) {
          if (c.mode === 'arrive' && c.slot) mareaSettle(p, c.slot);
          else if (c.mode === 'queueWalk') {
            c.mode = 'queue';
            p.pose = 'sway';
          } else if (c.mode === 'leave') {
            if (c.taxi) mareaBoardTaxi(p, c.taxi);
            else if (!crowdInView(p.x, p.y, 40)) mareaRemove(p);
            else mareaRelease(p);
          }
        }
        return true;
      }
      if (c.mode === 'queue') {
        const spot = c.spot;
        if (spot && Math.hypot(spot.x - p.x, spot.y - p.y) > 1.5) {
          p.walking = true;
          p.pose = null;
          c.route = [spot];
          mareaWalk(p, deltaSeconds, 16);
        } else {
          if (spot) p.a += normalizeAngle(spot.a - p.a) * Math.min(1, deltaSeconds * 4);
          p.pose = c.talking ? 'chat' : 'sway';
          if (mareaRandom() < deltaSeconds * 0.02) mareaSayOne(p, 'queue');
        }
        return true;
      }
      if (c.mode === 'slot') updateMareaSlotPerson(p, c.slot, deltaSeconds);
      return true;
    }
    function updateMareaSlotPerson(p, slot, deltaSeconds) {
      const c = p.club;
      if (!slot) return;
      p.pose = slot.pose;
      // Bouncers in trouble mode hold the door or go for the player.
      if (slot.kind === 'bouncer' && updateMareaBouncer(p, slot, deltaSeconds)) return;
      // Talking with the player, or clapping a dive (clubtalk.js).
      if (clubGoerOverride(p, slot, deltaSeconds)) return;
      if (slot.swim) {
        // Drift about the pool, turning now and then.
        const w = MAREA.poolWater;
        if (!c.swimTarget || Math.hypot(c.swimTarget.x - p.x, c.swimTarget.y - p.y) < 3 || mareaRandom() < deltaSeconds * 0.05)
          c.swimTarget = mareaPoint(w[0] + 8 + mareaRandom() * (w[2] - w[0] - 16), w[1] + 6 + mareaRandom() * (w[3] - w[1] - 12));
        const a = Math.atan2(c.swimTarget.y - p.y, c.swimTarget.x - p.x);
        p.a += normalizeAngle(a - p.a) * Math.min(1, deltaSeconds * 1.5);
        p.x += Math.cos(p.a) * 5 * deltaSeconds;
        p.y += Math.sin(p.a) * 5 * deltaSeconds;
        p.altitude = slot.z + Math.sin(gameTime * 1.7 + p.phase) * 0.35;
        return;
      }
      if (slot.kind === 'bartender') {
        // Working along the counter: a few steps, shake, serve.
        c.wander -= deltaSeconds;
        if (c.wander <= 0) {
          c.wander = randomBetween(3, 8);
          c.dv = slot.pace ? (mareaRandom() - 0.5) * slot.pace * 2 : 0;
        }
        const target = slot.y + (c.dv || 0);
        if (Math.abs(target - p.y) > 0.5) {
          p.y += Math.sign(target - p.y) * Math.min(Math.abs(target - p.y), 14 * deltaSeconds);
          p.pose = null;
          p.a = Math.sign(target - p.y) > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else p.a += normalizeAngle(slot.a - p.a) * Math.min(1, deltaSeconds * 5);
        return;
      }
      if (slot.kind === 'waiter') return updateMareaWaiter(p, slot, deltaSeconds);
      if (slot.crew) return updateMareaCrew(p, slot, deltaSeconds);
      if (slot.wanderFloor) {
        c.wander -= deltaSeconds;
        if (c.wander <= 0) {
          c.wander = randomBetween(4, 9);
          const f = MAREA.floor;
          c.goal = mareaPoint(f[0] + mareaRandom() * (f[2] - f[0]), f[1] + mareaRandom() * (f[3] - f[1]));
        }
        if (c.goal && Math.hypot(c.goal.x - p.x, c.goal.y - p.y) > 2) {
          c.route = [c.goal];
          mareaWalk(p, deltaSeconds, 9);
        }
        return;
      }
      // Idle chatter by kind and hour.
      const say = deltaSeconds * 0.012;
      if (slot.kind === 'dj' && marea.phase === 'night' && mareaRandom() < say * 2) mareaSayOne(p, 'dj');
      else if (slot.pose === 'dance' && marea.phase === 'night' && mareaRandom() < say) mareaSayOne(p, 'floor');
      else if (slot.kind === 'watcher' && mareaRandom() < say) mareaSayOne(p, 'sunset');
      else if (marea.phase === 'day' && ['lounger', 'barGuest', 'tableGuest', 'stool', 'loungeGuest'].includes(slot.kind) && mareaRandom() < say * 0.6)
        mareaSayOne(p, 'day');
      if (slot.greeter && mareaDistance(player.x, player.y) < 40 && distanceBetween(p, player) < 50 && (p.greetedAt || -100) < gameTime - 40) {
        p.greetedAt = gameTime;
        mareaSay(p, MAREA_DOOR_TALK.player.welcome);
      }
      // Dancers who lose their groove for a moment, and sippers.
      if (slot.pose === 'drink') p.sipping = (gameTime + p.phase) % 6 < 1.2;
    }
    /* Waiters: pick up at the bar, carry a tray to a daybed or table, come back. */
    function updateMareaWaiter(p, slot, deltaSeconds) {
      const c = p.club;
      if (c.route.length) {
        p.walking = true;
        p.pose = 'tray';
        p.carry = 'tray';
        mareaWalk(p, deltaSeconds, 26);
        if (!c.route.length && c.leg === 'out') {
          c.leg = 'serve';
          c.wander = randomBetween(2, 4);
          mareaSayOne(p, 'waiter', 0.7);
        }
        return;
      }
      c.wander -= deltaSeconds;
      p.pose = c.leg === 'serve' ? 'serve' : 'wait';
      if (c.wander > 0) return;
      if (c.leg === 'serve') {
        // Back to the bar by the same walkway.
        c.leg = 'back';
        c.route = [...(c.back || [])];
        c.route.push({ x: slot.x, y: slot.y });
        return;
      }
      // At the bar: choose someone to serve.
      const guests = marea.people.filter(
        (q) => q.club?.mode === 'slot' && q.club.slot && !q.club.slot.staff && ['lounger', 'vip', 'loungeGuest', 'poolside', 'tableGuest', 'watcher'].includes(q.club.slot.kind),
      );
      if (!guests.length) {
        c.wander = randomBetween(4, 8);
        return;
      }
      const guest = randomChoice(guests),
        gs = guest.club.slot,
        pts = mareaPath(slot.node, gs.node || 'floor').map(mareaNodePoint);
      // Along the walkways to the guest's last approach point, or beside them.
      for (const [u, v] of gs.via || []) pts.push(mareaPoint(u, v));
      if (!gs.via?.length) pts.push({ x: guest.x + 7, y: guest.y + 3 });
      c.back = [...pts].reverse();
      c.route = pts;
      c.leg = 'out';
    }
    /* Setup crew at sunset: crates from the staff door to the booth and the bars. */
    function updateMareaCrew(p, slot, deltaSeconds) {
      const c = p.club;
      if (c.route.length) {
        p.pose = c.loaded ? 'carry' : null;
        p.carry = c.loaded ? 'box' : null;
        mareaWalk(p, deltaSeconds, 22);
        return;
      }
      c.loaded = !c.loaded;
      const staff = mareaNodePoint('staffDoor');
      const drop = randomChoice([mareaPoint(200, 96), mareaPoint(66, 150), mareaPoint(300, 190), mareaPoint(250, 100)]);
      c.route = c.loaded ? [mareaNodePoint('wn'), drop] : [mareaNodePoint('wn'), staff];
    }

    /**
     * THE BOUNCERS
     */
    function updateMareaBouncer(p, slot, deltaSeconds) {
      const c = p.club,
        trouble = gameTime < marea.enforceUntil || gameTime < marea.spookedUntil - 90;
      if (!trouble) {
        if (Math.hypot(slot.x - p.x, slot.y - p.y) > 2) {
          c.route = [{ x: slot.x, y: slot.y }];
          p.pose = null;
          mareaWalk(p, deltaSeconds, 40);
          return true;
        }
        p.a += normalizeAngle(slot.a - p.a) * Math.min(1, deltaSeconds * 5);
        if (slot.head && !marea.talk && marea.queue.length && mareaRandom() < deltaSeconds * 0.02) mareaSayOne(p, 'bouncerToLine');
        return false;
      }
      // Trouble: go for the player if they are on foot and close, else hold the door.
      const d = distanceBetween(p, player),
        chase = gameTime < marea.enforceUntil && !player.car && d < 170 && !slot.vipGuard && mareaDistance(player.x, player.y) < 140 && player.hp > 0;
      if (chase) {
        p.a = headingBetween(p, player);
        p.pose = null;
        if (d > 10) {
          const step = Math.min(d - 9, 18 * KMH * deltaSeconds);
          moveBody(p, Math.cos(p.a) * step, Math.sin(p.a) * step, 5);
        } else if ((c.shoveAt || -10) < gameTime - 1.6) {
          c.shoveAt = gameTime;
          marea.shoves++;
          const a = headingBetween(p, player);
          moveBody(player, Math.cos(a) * 26, Math.sin(a) * 26, 8);
          hurt(6, 'melee');
          mareaSay(p, randomChoice(MAREA_DOOR_TALK.shove));
          p.pose = 'shove';
          tone(90, 0.08, 0.2, 'square');
        }
        return true;
      }
      const door = slot.head ? mareaPoint(298, 40) : slot.vipGuard ? { x: slot.x, y: slot.y } : mareaPoint(306, 40);
      if (Math.hypot(door.x - p.x, door.y - p.y) > 2) {
        c.route = [door];
        p.pose = null;
        mareaWalk(p, deltaSeconds, 60);
      } else {
        p.a = -Math.PI / 2;
        p.pose = slot.head && gameTime - (c.calledAt ?? -100) < 8 ? 'phone' : 'stop';
        if (mareaRandom() < deltaSeconds * 0.15) mareaSayOne(p, 'bouncerAlarm');
      }
      if (slot.head && (c.calledAt ?? -100) < marea.spookStart && mareaAlarmIncident()) {
        c.calledAt = gameTime;
        mareaSay(p, randomChoice(MAREA_DOOR_TALK.bouncerCall));
        crowdReport(p, marea.alarmInc);
      }
      return true;
    }
