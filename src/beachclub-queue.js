    /**
     * THE QUEUE
     * Groups of one to three stand along the rope, the head of the line at the
     * door end. The head bouncer (with the host) talks to the front group, then
     * lets them in or sends them off.
     */
    /* The line snakes along the ropes east of the door: row A (v 33) runs from
       the door east, row B (v 22) comes back west; people face the way it moves. */
    function mareaQueueSpot(i) {
      const rowA = i < 8,
        u = rowA ? 324 + i * 9.4 : 390 - (i - 8) * 9.4,
        p = mareaPoint(u, rowA ? 33 : 22.5);
      p.a = rowA ? Math.PI : 0;
      p.row = rowA ? 'A' : 'B';
      return p;
    }
    function mareaQueueCount() {
      return marea.queue.reduce((n, g) => n + g.members.length, 0);
    }
    function mareaLayoutQueue() {
      let i = 0;
      for (const g of marea.queue)
        for (const m of g.members) {
          if (m.club) m.club.spot = mareaQueueSpot(i);
          i++;
        }
    }
    function mareaQueueArrival(instant) {
      const size = mareaRandom() < 0.45 ? 1 : mareaRandom() < 0.7 ? 2 : 3,
        group = { id: marea.groupId++, members: [], lads: false };
      const index = mareaQueueCount();
      if (index + size > 16) return;
      const west = mareaRandom() < 0.6;
      for (let k = 0; k < size; k++) {
        const spot = mareaQueueSpot(index + k),
          start = instant ? spot : mareaPoint(west ? -220 - k * 10 : 620 + k * 10, 8 + k * 3),
          p = mareaSpawn(null, start.x, start.y, 'party');
        if (!p) break;
        p.club.group = group;
        p.club.spot = spot;
        p.club.mode = instant ? 'queue' : 'queueWalk';
        // Along the kerb to the rope, round its east end for row A.
        const along = spot.row === 'A' ? [mareaPoint(398, 10), mareaPoint(398, 28)] : [mareaPoint(spot.x - MAREA.plot.x, 10)];
        p.club.route = instant ? [] : [mareaPoint(west ? 20 : 400, 10), ...along, spot];
        group.members.push(p);
      }
      group.lads = group.members.length >= 2 && group.members.every((m) => !m.look.skirt && m.look.hairStyle !== 2);
      if (group.members.length) marea.queue.push(group);
    }
    function mareaHeadBouncer() {
      return mareaSlots.find((s) => s.head)?.person || null;
    }
    function mareaHost() {
      return mareaSlots.find((s) => s.clipboard)?.person || null;
    }
    /* A free place for someone just let in: an empty night slot, the emptiest first. */
    function mareaFreeNightSlot() {
      let best = null;
      for (const s of mareaSlots)
        if (s.mode === 'night' && s.fromQueue && !s.person && (!best || s.t < best.t)) best = s;
      return best;
    }
    function updateMareaQueue(step) {
      const L = marea.levels,
        head = mareaHeadBouncer(),
        count = mareaQueueCount();
      // Arrivals.
      marea.queueClock -= step;
      const target = Math.round(3 + 13 * L.queue);
      if (L.queue > 0.02 && marea.queueClock <= 0 && gameTime > marea.spookedUntil) {
        marea.queueClock = randomBetween(4, 10) / Math.max(0.35, L.queue);
        if (count < target) mareaQueueArrival(!marea.inView || marea.instant);
      }
      // Top up the line at once when nobody is looking (a teleport, a long drive).
      if ((!marea.inView || marea.instant) && L.queue > 0.05 && count < target * 0.6 && gameTime > marea.spookedUntil) mareaQueueArrival(true);
      // The conversation at the front.
      const talk = marea.talk;
      if (talk) {
        talk.clock -= step;
        if (talk.clock > 0) return;
        const group = talk.group;
        if (!group.members.length || !head || head.hp <= 0) {
          marea.talk = null;
          return;
        }
        const line = talk.script[talk.i++];
        if (line) {
          const who = line[0] === 'b' ? head : line[0] === 'h' ? mareaHost() || head : group.members[talk.i > 2 && group.members[1] ? 1 : 0];
          mareaSay(who, line[1]);
          talk.clock = 2.7;
          for (const m of group.members) m.club.talking = true;
          return;
        }
        // Verdict.
        marea.talk = null;
        const k = marea.queue.indexOf(group);
        if (k >= 0) marea.queue.splice(k, 1);
        for (const m of group.members) m.club.talking = false;
        if (talk.admit) {
          marea.admitted += group.members.length;
          for (const m of group.members) {
            const slot = mareaFreeNightSlot();
            m.club.group = null;
            if (!slot) {
              mareaLeave(m, 'street');
              continue;
            }
            mareaAssign(m, slot);
            mareaRouteTo(m, 'out', slot);
            m.club.route.unshift(mareaPoint(310, 35));
          }
        } else {
          marea.rejected += group.members.length;
          const speaker = group.members[0];
          for (const m of group.members) {
            m.club.group = null;
            m.club.mode = 'leave';
            const west = mareaRandom() < 0.5;
            m.club.route = [mareaPoint(318, 30), mareaPoint(314, 12), mareaPoint(west ? -40 : 440, 6 + mareaRandom() * 6)];
          }
          // Their parting shot comes once the bouncer's last word has faded.
          speaker.club.pendingLine = 'walkOff';
        }
        mareaLayoutQueue();
        return;
      }
      // Start the next conversation when the front group is in place.
      marea.admitClock -= step;
      const front = marea.queue[0];
      if (!front || !head || marea.admitClock > 0 || gameTime < marea.spookedUntil) return;
      const lead = front.members[0];
      if (!lead || lead.club?.mode !== 'queue' || distanceBetween(lead, mareaQueueSpot(0)) > 6) return;
      const full = !mareaFreeNightSlot();
      const rejectChance = full ? 0.8 : front.lads ? 0.55 : 0.18;
      const admit = mareaRandom() > rejectChance;
      marea.talk = { group: front, admit, script: randomChoice(MAREA_DOOR_TALK[admit ? 'admit' : 'reject']), i: 0, clock: 0.5 };
      marea.admitClock = randomBetween(2, 6) / Math.max(0.4, L.night);
    }

    /**
     * TAXIS AT CLOSING
     */
    function mareaTaxiSpot(i) {
      return { x: MAREA.plot.x + 140 + i * 58, y: MAREA.plot.y - 34 };
    }
    function updateMareaTaxis(step) {
      const want = marea.phase === 'closing' || (marea.phase === 'night' && mareaHour() > 27.6);
      marea.taxis = marea.taxis.filter((c) => vehicles.includes(c) && c.hp > 0 && c.mareaTaxi);
      if (!want) return;
      marea.taxiClock -= step;
      if (marea.taxiClock > 0) return;
      marea.taxiClock = 3;
      for (let i = 0; i < 3; i++) {
        if (marea.taxis.some((c) => c.mareaSpot === i)) continue;
        const spot = mareaTaxiSpot(i);
        if (crowdInView(spot.x, spot.y, 80) || !cityStreetAt(spot.x, spot.y) || !canSpawnCar('taxi', spot.x, spot.y, 0, 6)) continue;
        const c = makeCar('taxi', spot.x, spot.y, 0, false);
        c.mareaTaxi = true;
        c.mareaSpot = i;
        c.riders = 0;
        c.occupied = true;
        c.locked = false;
        marea.taxis.push(c);
      }
    }
    function mareaBoardTaxi(p, c) {
      mareaRemove(p);
      if (!vehicles.includes(c) || c.hp <= 0 || c === player.car) return;
      c.riders = (c.riders || 0) + 1;
      if (c.riders >= 1 + Math.floor(mareaRandom() * 2)) {
        // Away it goes into the traffic.
        assignDriver(c);
        c.locked = false;
        c.ai = true;
        c.mareaTaxi = false;
      }
    }

    /**
     * TROUBLE
     */
    function beachClubHearsViolence(source, kind = 'gunfire', attacker = null) {
      if (!source || !marea.built) return;
      const d = mareaDistance(source.x, source.y);
      if (d > (kind === 'explosion' ? 700 : 480)) return;
      const first = gameTime > marea.spookedUntil;
      if (first) marea.spookStart = gameTime;
      marea.spookedUntil = gameTime + 150;
      marea.alarmSource = { x: source.x, y: source.y };
      // The crowd records the incident just after this call (notifyViolence);
      // mareaAlarmIncident() picks it up.
      marea.alarmInc = null;
      if (attacker === player) {
        marea.enforceUntil = gameTime + 45;
        marea.pass = false;
        marea.vip = false;
        marea.banned = gameTime + 600;
      }
      marea.talk = null;
      if (first) for (const p of marea.people) if (p.club && !p.club.staff && p.club.slot?.kind !== 'bouncer') p.club.alarmed = true;
    }
    /* The crowd incident behind the current alarm (for witness calls and flight). */
    function mareaAlarmIncident() {
      const src = marea.alarmSource;
      if (!marea.alarmInc && src)
        for (let i = crowd.incidents.length - 1; i >= 0; i--)
          if (Math.hypot(crowd.incidents[i].x - src.x, crowd.incidents[i].y - src.y) < 120) {
            marea.alarmInc = crowd.incidents[i];
            break;
          }
      return marea.alarmInc;
    }
    /* Run for the nearest way out: the door, or the beach gate (thrown open). */
    function mareaEvacuate(p) {
      const c = p.club;
      if (!c) return;
      const slot = c.slot;
      if (slot && slot.person === p) slot.person = null;
      c.slot = null;
      const pts = [];
      if (slot) for (const [u, v] of [...(slot.via || [])].reverse()) pts.push(mareaPoint(u, v));
      if (slot?.swim && pts[0]) {
        p.x = pts[0].x;
        p.y = pts[0].y;
      }
      p.altitude = undefined;
      p.sitting = false;
      p.pose = null;
      const here = slot?.node || mareaNearestNode(p.x, p.y);
      if (c.mode === 'queue' || c.mode === 'queueWalk' || !mareaInside(p.x, p.y)) {
        mareaRelease(p);
        startReaction(p, 'flee', randomBetween(5, 9), marea.alarmSource, mareaAlarmIncident());
        return;
      }
      const toDoor = mareaPath(here, 'street'),
        toBeach = mareaPath(here, 'beach'),
        len = (path) => path.reduce((s, id, i) => (i ? s + Math.hypot(MAREA_NODES[id][0] - MAREA_NODES[path[i - 1]][0], MAREA_NODES[id][1] - MAREA_NODES[path[i - 1]][1]) : 0), 0),
        src = marea.alarmSource ? mareaLocal(marea.alarmSource.x, marea.alarmSource.y) : { u: 200, v: -100 },
        // Away from the danger: a shot on the street side sends everyone to the beach.
        doorBias = src.v < 60 ? 400 : src.v > 250 ? -300 : 0;
      const path = len(toDoor) + doorBias < len(toBeach) ? toDoor : toBeach;
      for (const id of path) pts.push(mareaNodePoint(id));
      c.route = pts;
      c.mode = 'evac';
      if (mareaRandom() < 0.3) mareaSayOne(p, 'evac');
      else crowdSay(p, 'flee', 0.25);
    }

    /**
     * THE PLAYER
     */
    function mareaDoorClosed() {
      if (gameTime < marea.spookedUntil) return false;
      return marea.phase === 'night' && !marea.pass && marea.levels?.door > 0;
    }
    function beachClubBlocked(x, y, r = 0) {
      if (x < MAREA_BOX.x0 || x > MAREA_BOX.x1 || y < MAREA_BOX.y0 || y > MAREA_BOX.y1) return false;
      for (const b of MAREA_SOLIDS) if (x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1) return true;
      const hit = (g) => x + r > g.x0 && x - r < g.x1 && y + r > g.y0 && y - r < g.y1;
      if (hit(MAREA_GATES.door) && mareaDoorClosed()) return true;
      if (hit(MAREA_GATES.vip) && !marea.vip) return true;
      if (hit(MAREA_GATES.beach) && (marea.phase === 'night' || marea.phase === 'closed') && gameTime > marea.spookedUntil) return true;
      return false;
    }
    function addBeachClubColliders() {
      for (const b of MAREA_SOLIDS)
        if (['wall', 'glass', 'staff', 'restrooms', 'kiosk', 'screen', 'booth', 'speaker', 'bar', 'pool', 'poolbar', 'cabana'].includes(b.kind))
          addStatic(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, b.height, 'beach club');
      // Vehicles never fit through the door or the beach gate.
      for (const g of [MAREA_GATES.door, MAREA_GATES.beach]) addStatic(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, g.height, 'beach club');
      // Bollards along the forecourt keep cars off the queue.
      for (let u = 12; u < 400; u += 26) {
        const p = mareaPoint(u, 12);
        addStatic(p.x - 2, p.y - 2, 4, 4, 8, 'bollard');
      }
    }
    /* Hints and the doorman's word as the player walks up to the door or the VIP rope. */
    function updateMareaPlayer() {
      if (player.car || marea.phase !== 'night') return;
      const door = mareaPoint(302, 40),
        dDoor = distanceBetween(player, door),
        head = mareaHeadBouncer();
      if (!marea.pass && dDoor < 42 && gameTime - marea.hintAt > 4 && gameTime > marea.spookedUntil) {
        marea.hintAt = gameTime;
        if (marea.banned > gameTime) {
          mareaSay(head, MAREA_DOOR_TALK.player.banned);
          tell('MAREA · The bouncers remember you.', 2.5);
        } else {
          if (dDoor < 24) mareaSay(head, marea.queue.length ? MAREA_DOOR_TALK.player.line : MAREA_DOOR_TALK.player.cover);
          tell('MAREA BEACH CLUB · Cover $40 · E to pay the door', 2.5);
        }
      }
      const vip = mareaPoint(314, 148);
      if (marea.pass && !marea.vip && distanceBetween(player, vip) < 26 && gameTime - marea.hintAt > 4) {
        marea.hintAt = gameTime;
        mareaSay(mareaSlots.find((s) => s.vipGuard)?.person, MAREA_DOOR_TALK.player.vipAsk);
        tell('MAREA VIP · $250 band · E to buy', 2.5);
      }
    }
    /* E by the door or the VIP rope. True when handled. */
    function beachClubInteract() {
      if (player.car || !marea.built || marea.phase !== 'night') return false;
      const door = mareaPoint(302, 40),
        vip = mareaPoint(314, 148),
        head = mareaHeadBouncer(),
        T = MAREA_DOOR_TALK.player;
      if (!marea.pass && distanceBetween(player, door) < 46) {
        if (gameTime < marea.spookedUntil) tell('MAREA · Closed. Something happened.', 2.5);
        else if (marea.banned > gameTime) {
          mareaSay(head, T.banned);
          tell('MAREA · Banned for the night.', 2.5);
        } else if (wantedStars > 0) {
          mareaSay(head, T.wanted);
          tell('MAREA · Not while the police want you.', 2.5);
        } else if (cash < 40) {
          mareaSay(head, T.broke);
          tell('MAREA · You need $40.', 2.5);
        } else {
          cash -= 40;
          marea.pass = true;
          marea.passNight = Math.floor((worldMinutes - 300) / 1440);
          mareaSay(head, T.paid);
          tell('MAREA BEACH CLUB · Cover paid ($40). Enjoy your night.', 3);
          tone(520, 0.08, 0.12, 'triangle');
          const grumbler = marea.queue[0]?.members[0];
          if (grumbler) mareaSayOne(grumbler, 'cutLine');
        }
        return true;
      }
      if (marea.pass && !marea.vip && distanceBetween(player, vip) < 30) {
        const guard = mareaSlots.find((s) => s.vipGuard)?.person;
        if (cash < 250) {
          mareaSay(guard, T.broke);
          tell('MAREA VIP · You need $250.', 2.5);
        } else {
          cash -= 250;
          marea.vip = true;
          mareaSay(guard, T.vipPaid);
          tell('MAREA VIP · Band on. The terrace is yours.', 3);
          tone(660, 0.1, 0.14, 'triangle');
        }
        return true;
      }
      return false;
    }

    /**
     * THE DIRECTOR
     * Twice a second: which slots should be filled, who leaves, the queue, the
     * taxis. Everyone is removed when the player is far away.
     */
    function slotWanted(slot, L) {
      if (gameTime < marea.spookedUntil) return !!slot.staff && slot.kind === 'bouncer' && L.door > 0;
      const level = slot.mode === 'both' ? Math.max(L.day, L.night * 0.9, L.sunset * 0.6) : L[slot.mode] ?? 0;
      return level > slot.t;
    }
    function mareaFill(slot) {
      const inView = !marea.instant && crowdInView(slot.x, slot.y, 50);
      if (inView && slot.fromQueue && marea.levels.queue > 0.05) return; // they come in from the line
      let entry = null;
      if (inView) {
        if (slot.entry === 'staff' || slot.entry === 'booth') entry = 'staffDoor';
        else if (slot.entry === 'bar') entry = 'bar';
        else if (slot.node === 'beach' || (marea.phase === 'day' && mareaRandom() < 0.3)) entry = 'beach';
        else entry = 'street';
      }
      const start = !entry ? slot : entry === 'bar' ? mareaPoint(30, 100) : mareaNodePoint(entry);
      const p = mareaSpawn(slot, start.x, start.y);
      if (!p) return;
      mareaAssign(p, slot);
      if (slot.staff || slot.kind === 'bouncer' || slot.kind === 'host') p.club.staff = true;
      if (!entry) mareaSettle(p, slot);
      else if (entry === 'bar') {
        p.club.route = [{ x: slot.x, y: slot.y }];
        p.club.mode = 'arrive';
      } else if (slot.entry === 'booth') {
        p.club.route = [mareaNodePoint('wn'), mareaPoint(160, 94), mareaPoint(170, 88), { x: slot.x, y: slot.y }];
        p.club.mode = 'arrive';
      } else mareaRouteTo(p, entry, slot);
    }
    function updateBeachClub(deltaSeconds) {
      if (!marea.built) buildMareaCast();
      const far = mareaDistance(player.x, player.y);
      marea.near = far < 1400;
      marea.phase = mareaPhase();
      marea.levels = mareaLevels();
      marea.inView = crowdInView(MAREA.plot.x + 200, MAREA.plot.y + 150, 180);
      updateMareaMusic(deltaSeconds, far);
      if (marea.passNight >= 0 && (marea.phase === 'closed' || marea.phase === 'day')) {
        marea.pass = false;
        marea.vip = false;
        marea.passNight = -1;
      }
      if (!marea.near) {
        marea.wasNear = false;
        if (marea.people.length && far > 1700) for (const p of [...marea.people]) mareaRemove(p);
        marea.queue = [];
        marea.talk = null;
        return;
      }
      // Just arrived (a teleport, a fast drive) or the clock jumped: the club is
      // as it should be at once instead of filling up in front of the camera.
      const hour = crowdHour(),
        jumped = marea.lastHour != null && Math.abs(normalizeAngle(((hour - marea.lastHour) / 24) * TAU)) > 0.08;
      if (!marea.wasNear || jumped) marea.instantUntil = gameTime + 1.2;
      marea.wasNear = true;
      marea.lastHour = hour;
      marea.instant = gameTime < marea.instantUntil;
      updateMareaPlayer();
      marea.tick -= deltaSeconds;
      if (marea.tick > 0 && !marea.instant) return;
      const step = 0.5;
      marea.tick = step;
      const L = marea.levels,
        spooked = gameTime < marea.spookedUntil;
      // Anyone the rest of the game took away (a mission reset, a respawn).
      if (marea.people.length) {
        const alive = new Set(pedestrians);
        for (const p of [...marea.people]) if (!alive.has(p)) mareaRelease(p);
      }
      // Alarmed people run (once, from here, so the crowd's own perception has had its say).
      for (const p of [...marea.people]) if (p.club?.alarmed && p.club.mode !== 'evac') {
        p.club.alarmed = false;
        mareaEvacuate(p);
      }
      if (spooked)
        for (const g of marea.queue)
          for (const m of [...g.members]) {
            mareaRelease(m);
            startReaction(m, 'flee', randomBetween(4, 8), marea.alarmSource, mareaAlarmIncident());
          }
      if (spooked) marea.queue = [];
      for (const p of marea.people) if (p.club?.pendingLine && p.club.mode === 'leave' && (p.speechUntil || 0) < gameTime) {
        mareaSayOne(p, p.club.pendingLine);
        p.club.pendingLine = null;
      }
      // Slots.
      let budget = marea.inView && !marea.instant ? 3 : 60;
      for (const slot of mareaSlots) {
        const p = slot.person;
        if (p && (!p.club || p.hp <= 0 || p.club.slot !== slot)) {
          slot.person = null;
          slot.next = gameTime + (p && p.hp <= 0 ? 90 : 8);
          continue;
        }
        const want = slotWanted(slot, L);
        if (want && !p && gameTime > slot.next && budget > 0) {
          budget--;
          mareaFill(slot);
        } else if (!want && p && p.club.mode === 'slot') {
          if (marea.instant || !crowdInView(p.x, p.y, 40)) mareaRemove(p);
          else if (mareaRandom() < (marea.phase === 'closing' ? 0.25 : 0.12)) {
            const exit = marea.phase === 'closing' && marea.taxis.length && mareaRandom() < 0.5 ? 'street' : undefined;
            mareaLeave(p, exit);
            if (exit && p.club) {
              const taxi = randomChoice(marea.taxis);
              p.club.taxi = taxi;
              const door = driverDoor(taxi);
              p.club.route.pop();
              p.club.route.push({ x: door.x, y: door.y + 10 });
            }
          }
        }
      }
      if (!spooked) updateMareaQueue(step);
      updateMareaTaxis(step);
      // Queue members nobody wants any more (the doors are closing) drift off.
      if (L.queue <= 0.01 && marea.queue.length && !marea.talk)
        for (const g of marea.queue.splice(0))
          for (const m of g.members) {
            m.club.group = null;
            mareaLeave(m, 'street');
          }
    }
    /* Developer console: what the club is doing. */
    function beachClubReport() {
      const tally = (fn) => {
        const out = {};
        for (const p of marea.people) {
          const k = fn(p);
          if (k != null) out[k] = (out[k] || 0) + 1;
        }
        return out;
      };
      const round = (v) => Math.round(v * 100) / 100;
      return {
        name: 'MAREA BEACH CLUB',
        plot: MAREA.plot,
        door: mareaPoint(302, 40),
        phase: marea.phase,
        hour: round(crowdHour()),
        levels: marea.levels && Object.fromEntries(Object.entries(marea.levels).map(([k, v]) => [k, round(v)])),
        people: marea.people.length,
        slots: mareaSlots.length,
        filled: mareaSlots.filter((s) => s.person).length,
        byKind: tally((p) => p.club?.slot?.kind || p.club?.mode),
        byMode: tally((p) => p.club?.mode),
        poses: tally((p) => (p.club?.mode === 'slot' ? p.pose || 'stand' : null)),
        queue: { groups: marea.queue.length, people: mareaQueueCount(), talking: marea.talk ? marea.talk.script.map((l) => l[1]).join(' / ') : null },
        admitted: marea.admitted,
        rejected: marea.rejected,
        evacuated: marea.evacuated,
        shoves: marea.shoves,
        spooked: gameTime < marea.spookedUntil,
        enforcing: gameTime < marea.enforceUntil,
        doorClosed: mareaDoorClosed(),
        pass: marea.pass,
        vip: marea.vip,
        taxis: marea.taxis.length,
        music: mareaMusicReport(),
        inView: marea.inView,
      };
    }
