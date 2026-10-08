    // The meeting at CIRRUS, a scene a story job drives: a diplomat waiting at EVOLUTION's door, the lift up together,
    // his reserved table, two cocktails, a short talk and the handover (skyMeetingBegin/End/Report/Target).
    /**
     * Sky meeting
     * Source: src/skyline-meeting.js
     * Scope: game closure. The story's mission code starts it with skyMeetingBegin(opts), points the
     * objective at skyMeetingTarget() and wins when skyMeeting.stage === 'done'; it never moves
     * anyone itself. skyMeetingEnd() (also from cleanupMissionExtras) leaves nothing behind.
     *
     * Stages: 'waiting' (he idles on the pavement beside the lobby door) → 'greeted' (talked to,
     * he waits at the lobby door) → 'lift' (riding up with the player: one ride, skyline-lift.js
     * calls skyMeetingRide*) → 'terrace' (he walks to his reserved table and sits; also where the
     * scene goes back to if the player gets up early) → 'seated' (the player sits; the waiter brings
     * two cocktails) → 'drinks' (they drink and talk) → 'handover' (the folder can be passed) →
     * 'done' (he has it, slides an envelope back, stands and leaves for the lift). 'failed' if he
     * is killed.
     *
     * - He is a story actor (`missionTag` 'sky-meeting') in his own look (`p.ownLook`: charcoal
     *   suit, grey hair); the crowd rig draws him; `p.handProp` / `p.drinkLift` / `p.sitReach` drive his hand.
     * - The player sits through `player.sceneSeat` ({x, y, a, lift, hand, reach}): game-update.js
     *   holds his feet while it is set (skyMeetingSeatHold; a movement key stands him up),
     *   crowd3d-special.js poses him (sit, the glass raised by `lift`), teleportPlayer clears it.
     * - The reserved table is SKY_BAR.tables[SKY_MEETING_TABLE]: skyBarArrive seats no guests there
     *   while a meeting runs; its RESERVED card and the envelope are skyMeetingProps() (drawn by
     *   crowd3d-frame.js). The drinks come from CIRRUS's own waiter (`keyPerson.errand`).
     */
    const SKY_MEETING_TABLE = 2,
      SKY_MEETING_STAGES = ['waiting', 'greeted', 'lift', 'terrace', 'seated', 'drinks', 'handover', 'done'],
      // Charcoal three-piece suit, white shirt, burgundy tie, grey hair, a man in his fifties.
      SKY_MEETING_LOOK = {
        outfit: 'diplomat',
        skin: '#d6ad8c',
        hair: '#aeaca6',
        hairStyle: 'hairShort',
        beard: 0,
        build: 1.08,
        height: 1.0,
        female: false,
        garment: 'suit',
        top: '#3b3d42',
        inner: '#efede7',
        accent: '#5b1f29',
        pants: '#3b3d42',
        pantsPattern: 0,
        shoes: '#111214',
        footwear: 'shoe',
        sleeves: true,
        stoop: 0.05,
      },
      // [who, line]: 'them' is the diplomat, 'you' the player. Any of these can be replaced through opts.lines.
      SKY_MEETING_LINES = {
        door: [
          ['them', 'You’re Vinny’s friend.'],
          ['you', 'Depends who’s asking.'],
          ['them', 'Not here. Upstairs, I have a table.'],
        ],
        arrive: [['them', 'This way. I keep a table by the glass.']],
        sit: [['them', 'Sit. Nobody up here listens to anybody else.']],
        order: [
          ['waiter', 'Good evening, sir. The usual?'],
          ['them', 'Two. My friend has had a long week.'],
        ],
        bar: [
          ['waiter', 'Two CIRRUS martinis for the consul’s table.'],
          ['bartender', 'Coming up.'],
        ],
        serve: [['waiter', 'Two CIRRUS martinis. Enjoy the view, gentlemen.']],
        talk: [
          ['them', 'To Vinny. May his luck outlive him.'],
          ['you', 'He said you pay on delivery.'],
          ['them', 'I pay for what I can read. Copies?'],
          ['you', 'None. That’s the only one.'],
          ['them', 'Good. Then the army is missing one folder, not a photocopier.'],
          ['you', 'They’ll miss more than that before the week is out.'],
          ['them', 'The people I work for are discreet. They are generous to discreet men.'],
        ],
        read: [['them', 'Project Hawthorn. Vinny wasn’t exaggerating.']],
        envelope: [['them', 'For your trouble. Finish your drink.']],
        leave: [['them', 'Enjoy the view, my friend.']],
      };
    const SKY_MEETING_PROMPTS = {
      talk: { text: 'TALK TO VARGA', id: 'sky-meet-talk' },
      sit: { text: 'SIT WITH VARGA', id: 'sky-meet-sit' },
      hand: { text: 'HAND OVER THE PAPERS', id: 'sky-meet-hand' },
      // Seated with nothing to do: no prompt, and the action key does nothing else.
      quiet: { text: '', id: 'sky-meet-quiet', key: null },
    };
    const skyMeeting = {
      active: false,
      stage: null,
      failed: null,
      name: '',
      speaker: '',
      title: '',
      lines: SKY_MEETING_LINES,
      diplomat: null,
      // A running exchange: { lines, at, wait } (skyMeetingSay).
      script: null,
      idleAt: 0,
      service: null,
      drinks: 0,
      talkLine: 0,
      talkDone: false,
      hand: null,
      handedOver: false,
      props: [],
      envelopeTaken: false,
      sat: false,
      leaveAt: 0,
      playerName: 'YOU',
      // Wrapping up after the job (skyMeetingWrapUp).
      closing: false,
      walkAt: 0,
    };
    let skyMeetingSpots = null;
    const SKY_MEETING_NOBODY = [];
    // Where everything happens, in world units, measured once the Key's lifts stand.
    function skyMeetingPlaces() {
      if (skyMeetingSpots) return skyMeetingSpots;
      const lift = SKY_LIFTS.find((l) => l.id === 'bar');
      if (!lift) return null;
      const plan = lift.bar,
        b = lift.b,
        H = b.height,
        c = plan.center,
        at = (x, y, a = 0) => ({ x: c.x + x, y: c.y + y, a }),
        table = plan.tables[SKY_MEETING_TABLE],
        T = SKY_BAR.tables[SKY_MEETING_TABLE];
      skyMeetingSpots = {
        lift,
        b,
        H,
        table,
        // The player faces east across the table, he faces west: both in profile to the street camera.
        mine: table.seats[0],
        his: table.seats[1],
        // On the pavement west of the lobby door (the doorman stands east of it), looking at the street.
        door: { x: lift.lobby.x - 34, y: lift.lobby.y + 10, a: Math.PI / 2 },
        lobbyWait: { x: lift.lobby.x - 12, y: lift.lobby.y + 6, a: -Math.PI / 2 },
        // From beside the lift door to his chair, round the business table and the lounge.
        path: [at(18, -6), at(T.x + 9, T.y - 12), { x: table.seats[1].x, y: table.seats[1].y }],
        leave: [at(T.x + 9, T.y - 12), at(18, -6), { x: lift.door.x + 6, y: lift.door.y + 4 }],
        // The waiter stands on the table's north side to take the order and serve; picks up at the bar's north end.
        waiterSpot: at(T.x, T.y - 9, Math.PI / 2),
        pickup: at(SKY_BAR.counter.x + 10, SKY_BAR.counter.y - 14, Math.PI),
        // Standing up: north of the chair, clear of the table's keep-out.
        stand: { x: table.seats[0].x, y: table.seats[0].y - 10 },
      };
      return skyMeetingSpots;
    }
    /* ---- API -------------------------------------------------------------------------- */
    // Start the scene: opts { name, title, speaker, playerName, lines: { door, arrive, ... } }.
    function skyMeetingBegin(opts = {}) {
      skyMeetingEnd();
      const P = skyMeetingPlaces();
      if (!P) return false;
      const M = skyMeeting,
        name = opts.name || 'ANTON VARGA',
        d = actor(name, P.door.x, P.door.y, SKY_MEETING_LOOK.top);
      Object.assign(d, {
        a: P.door.a,
        missionTag: 'sky-meeting',
        ownLook: SKY_MEETING_LOOK,
        pose: 'smoke',
        handProp: null,
        drinkLift: null,
        sitReach: 0,
        sitting: false,
        leg: 0,
        hidden: false,
        speech: '',
        speechUntil: 0,
      });
      storyActors.push(d);
      Object.assign(M, {
        active: true,
        stage: 'waiting',
        failed: null,
        name,
        speaker: opts.speaker || name.split(' ').at(-1),
        playerName: opts.playerName || 'YOU',
        title: opts.title || 'the consul',
        lines: { ...SKY_MEETING_LINES, ...(opts.lines || {}) },
        diplomat: d,
        script: null,
        idleAt: gameTime + 6,
        service: null,
        drinks: 0,
        talkLine: 0,
        talkDone: false,
        hand: null,
        handedOver: false,
        envelopeTaken: false,
        sat: false,
        leaveAt: 0,
        closing: false,
        walkAt: 0,
        props: [{ kind: 'card', owner: null, x: P.table.x - 1.5, y: P.table.y - 1.2, z: P.H + 6.55, a: 0.3 }],
      });
      SKY_MEETING_PROMPTS.talk.text = 'TALK TO ' + M.speaker;
      SKY_MEETING_PROMPTS.sit.text = 'SIT WITH ' + M.speaker;
      // A terrace already filled had guests at the reserved table: it fills again without them.
      if (skyBar.live) skyBarLeave();
      return true;
    }
    // Everything the scene made goes: the diplomat, the player's chair, the waiter's errand, the props.
    function skyMeetingEnd() {
      const M = skyMeeting,
        d = M.diplomat;
      if (d) {
        const i = storyActors.indexOf(d);
        if (i >= 0) storyActors.splice(i, 1);
      }
      for (let i = storyActors.length - 1; i >= 0; i--) if (storyActors[i].missionTag === 'sky-meeting') storyActors.splice(i, 1);
      if (player.sceneSeat) player.sceneSeat = null;
      for (const p of skyBar.people) if (p.keyPerson?.errand) p.keyPerson.errand = null;
      Object.assign(M, { active: false, stage: null, diplomat: null, script: null, service: null, hand: null, props: [], closing: false });
    }
    /* A job's end (cleanupMissionExtras): a finished meeting plays out (he walks into the lift, the
       glasses stay on the table) and ends itself once the player has left the roof; any other ends now. */
    function skyMeetingWrapUp() {
      if (skyMeeting.active && skyMeeting.stage === 'done') skyMeeting.closing = true;
      else skyMeetingEnd();
    }
    function skyMeetingReport() {
      const M = skyMeeting,
        d = M.diplomat,
        r = (v) => Math.round(v * 10) / 10,
        seat = player.sceneSeat;
      return {
        active: M.active,
        stage: M.stage,
        failed: M.failed,
        diplomat: d
          ? { name: d.name, x: r(d.x), y: r(d.y), altitude: r(entityElevation(d)), pose: d.pose || null, sitting: !!d.sitting, hidden: !!d.hidden, hand: d.handProp, hp: d.hp }
          : null,
        player: { x: r(player.x), y: r(player.y), altitude: r(entityElevation(player)), roof: player.buildingRoof?.skyline?.id || null },
        playerSeated: !!seat,
        seat: seat ? { lift: r(seat.lift || 0), hand: seat.hand, reach: r(seat.reach || 0), a: r(seat.a) } : null,
        service: M.service ? M.service.phase : null,
        waiter: M.service?.waiter
          ? { x: r(M.service.waiter.x), y: r(M.service.waiter.y), errand: !!M.service.waiter.keyPerson.errand, at: !!M.service.waiter.keyPerson.errand?.at, hp: M.service.waiter.hp, scared: M.service.waiter.keyPerson.scaredUntil > gameTime }
          : null,
        drinks: M.drinks,
        talkLine: M.talkLine,
        talkDone: M.talkDone,
        handedOver: M.handedOver,
        closing: M.closing,
        props: M.props.map((q) => q.kind),
        line: M.script ? M.script.lines[Math.max(0, M.script.at - 1)]?.[1] || null : null,
        target: skyMeetingTarget(),
        actors: storyActors.filter((p) => p.missionTag === 'sky-meeting').length,
      };
    }
    // Where the story should send the player now (altitude on the roof), or null.
    function skyMeetingTarget() {
      const M = skyMeeting,
        P = skyMeetingPlaces();
      if (!M.active || !P || !M.diplomat) return null;
      const lobby = { x: P.lift.lobby.x, y: P.lift.lobby.y, altitude: 0 },
        up = player.buildingRoof === P.b;
      switch (M.stage) {
        case 'waiting':
          return { x: M.diplomat.x, y: M.diplomat.y, altitude: 0 };
        case 'greeted':
          return lobby;
        case 'lift':
          return { x: P.lift.arrive.x, y: P.lift.arrive.y, altitude: P.H };
        case 'terrace':
        case 'seated':
        case 'drinks':
        case 'handover':
          return up ? { x: P.mine.x, y: P.mine.y, altitude: P.H } : lobby;
        default:
          return null;
      }
    }
    // The diplomat for the speech bubbles (crowd-speech.js).
    function skyMeetingSpeakers() {
      const d = skyMeeting.diplomat;
      return d && d.speech && !d.hidden ? [d] : SKY_MEETING_NOBODY;
    }
    // On the table: the RESERVED card, the envelope, glasses put down ({kind, x, y, z, a}; crowd3d-frame.js draws them).
    function skyMeetingProps() {
      return skyMeeting.props;
    }
    // Whether CIRRUS keeps this table free (skyBarArrive), and keeps its other tables quiet while the scene talks.
    function skyMeetingHolds(table) {
      const P = skyMeeting.active && skyMeetingPlaces();
      return !!P && table.x === P.table.x && table.y === P.table.y;
    }
    function skyMeetingBusy() {
      return skyMeeting.active && !!player.sceneSeat;
    }
    /* ---- Lines ------------------------------------------------------------------------- */
    function skyMeetingSay(list, then = null) {
      skyMeeting.script = { lines: list, at: 0, wait: 0.4, then };
    }
    function skyMeetingSpeak(who, text) {
      const M = skyMeeting;
      let p = null,
        name = who;
      if (who === 'them') {
        p = M.diplomat;
        name = M.speaker;
      } else if (who === 'you') {
        p = player;
        name = M.playerName;
      } else p = skyBar.people.find((q) => q.keyPerson?.role === who && q.hp > 0);
      if (p) keySay(p, text);
      // The subtitle line on the HUD, while a story job runs (story.js).
      if (who === 'them' || who === 'you') missionLine(name, text);
    }
    function skyMeetingStepScript(dt) {
      const S = skyMeeting.script;
      if (!S) return;
      if ((S.wait -= dt) > 0) return;
      if (S.at >= S.lines.length) {
        skyMeeting.script = null;
        if (S.then) S.then();
        return;
      }
      const [who, text] = S.lines[S.at++];
      skyMeetingSpeak(who, text);
      S.wait = Math.max(1.8, speechReadSeconds(text) * 0.85) + 0.2;
    }
    /* ---- Moving him ------------------------------------------------------------------------ */
    // One step along `path` from d.leg; true once at its end.
    function skyMeetWalk(d, path, dt) {
      const next = path[d.leg];
      if (!next) return true;
      const dx = next.x - d.x,
        dy = next.y - d.y,
        dist = Math.hypot(dx, dy),
        step = Math.min(dist, FOOT_WALK * dt);
      d.sitting = false;
      d.pose = null;
      if (dist > 0.01) {
        d.a = Math.atan2(dy, dx);
        d.x += (dx / dist) * step;
        d.y += (dy / dist) * step;
        d.walk += step * 0.19;
      }
      if (dist - step < 0.3) d.leg++;
      return d.leg >= path.length;
    }
    function skyMeetFace(d, target, dt) {
      d.a += normalizeAngle(Math.atan2(target.y - d.y, target.x - d.x) - d.a) * Math.min(1, dt * 4);
    }
    // A drink's arm, 0 at rest to 1 at the lips: raise, sip, lower, then a while with the glass held.
    function skyMeetSipCurve(t, period) {
      const k = ((t % period) + period) % period;
      if (k < 0.8) return k / 0.8;
      if (k < 2.2) return 1;
      if (k < 3) return 1 - (k - 2.2) / 0.8;
      return 0;
    }
    /* ---- The frame (skyline-bar.js updateNorthPointKey) -------------------------------------- */
    function updateSkyMeeting(dt) {
      const M = skyMeeting,
        d = M.diplomat,
        P = skyMeetingPlaces();
      if (!M.active || !d || !P) return;
      if (!storyActors.includes(d)) {
        skyMeetingEnd();
        return;
      }
      if (d.hp <= 0) {
        if (M.stage !== 'failed') {
          M.failed = 'diplomat';
          M.stage = 'failed';
          M.script = null;
          if (player.sceneSeat) skyMeetingStand();
        }
        return;
      }
      if (M.closing && d.hidden && !player.sceneSeat && player.buildingRoof !== P.b) {
        skyMeetingEnd();
        return;
      }
      skyMeetingStepScript(dt);
      const seat = player.sceneSeat;
      switch (M.stage) {
        case 'waiting': {
          // A cigarette, a look at his watch, the street; he turns to anyone who comes close.
          if (gameTime > M.idleAt) {
            d.pose = d.pose === 'smoke' ? 'wait' : d.pose === 'wait' ? 'watchCheck' : 'smoke';
            M.idleAt = gameTime + (d.pose === 'watchCheck' ? 2.6 : randomBetween(6, 10));
          }
          const near = !player.car && !player.buildingRoof && distanceBetween(d, player) < 60;
          skyMeetFace(d, near ? player : { x: d.x + Math.cos(P.door.a), y: d.y + Math.sin(P.door.a) }, dt);
          break;
        }
        case 'greeted':
          // Talk first, then to the lobby door to wait for the lift.
          if (M.script) {
            d.pose = 'chat';
            skyMeetFace(d, player, dt);
          } else if (skyMeetWalk(d, [P.lobbyWait], dt)) {
            d.pose = 'wait';
            skyMeetFace(d, player.buildingRoof ? P.lift.lobby : player, dt);
          }
          break;
        case 'lift':
          break;
        default: {
          if (!d.sitting && M.stage !== 'done' && gameTime >= M.walkAt) {
            if (skyMeetWalk(d, P.path, dt)) {
              d.sitting = true;
              d.pose = 'sit';
              d.x = P.his.x;
              d.y = P.his.y;
              d.a = P.his.a;
            }
          }
          if (M.stage === 'done') skyMeetingLeaving(d, P, dt);
          else if (d.sitting) {
            d.a = P.his.a;
            d.pose = 'sit';
          }
          break;
        }
      }
      skyMeetingService(dt, P);
      // Drinks in hand once served: they sip in turn, never while speaking.
      const served = M.drinks > 0;
      if (d.sitting) {
        d.handProp = M.hand?.his || (served ? 'cocktail' : null);
        d.drinkLift = served && !M.hand ? (d.speechUntil > gameTime ? 0 : skyMeetSipCurve(gameTime + 4.5, 9.5)) : null;
        if (!M.hand) d.sitReach = 0;
      } else if (M.stage !== 'done') {
        d.handProp = null;
        d.drinkLift = null;
      }
      if (seat) {
        if (!M.hand) {
          seat.hand = served ? 'cocktail' : null;
          seat.lift = served ? (player.speechUntil > gameTime ? 0 : skyMeetSipCurve(gameTime, 8.5)) : 0;
          seat.reach = 0;
        }
        if (M.stage === 'drinks' && !M.script && !M.talkDone) skyMeetingTalk();
      }
      if (M.hand) skyMeetingHandStep(dt, P);
    }
    // The conversation over the drinks, one line at a time; it waits while the player is up.
    function skyMeetingTalk() {
      const M = skyMeeting,
        talk = M.lines.talk;
      if (M.talkLine >= talk.length) {
        M.talkDone = true;
        M.stage = 'handover';
        return;
      }
      const line = talk[M.talkLine++];
      skyMeetingSay([line]);
      M.script.wait = M.talkLine === 1 ? 1.2 : 0.6;
    }
    /* The drinks: the diplomat catches the waiter's eye, the waiter takes the order, fetches two
       glasses from the bar and serves them. Without a waiter on the floor they come anyway. */
    function skyMeetingService(dt, P) {
      const M = skyMeeting,
        d = M.diplomat;
      if (!M.service) {
        if (M.drinks === 0 && d.sitting && player.sceneSeat) M.service = { phase: 'call', t: 0, waiter: null };
        return;
      }
      const S = M.service,
        waiter = S.waiter && S.waiter.hp > 0 && !(S.waiter.keyPerson.scaredUntil > gameTime) ? S.waiter : null;
      S.t += dt;
      const go = (phase) => {
        S.phase = phase;
        S.t = 0;
      };
      const errand = (spot) => {
        if (!waiter) return true;
        const k = waiter.keyPerson;
        if (!k.errand || k.errand.to !== spot) k.errand = { to: spot, at: false };
        return k.errand.at;
      };
      switch (S.phase) {
        case 'call':
          if (S.t < 1.2) return;
          S.waiter = skyBar.people.find((p) => p.keyPerson?.role === 'waiter' && p.hp > 0) || null;
          go('come');
          return;
        case 'come':
          if (errand(P.waiterSpot) || S.t > 25) {
            skyMeetingSay(waiter ? M.lines.order : M.lines.order.filter((l) => l[0] !== 'waiter'));
            go('order');
          }
          return;
        case 'order':
          if (!M.script && S.t > 1) go('fetch');
          return;
        case 'fetch':
          if (errand(P.pickup) || S.t > 25) {
            if (waiter) skyMeetingSay(M.lines.bar);
            go('pour');
          }
          return;
        case 'pour':
          if (S.t > 3 && !M.script) go('bring');
          return;
        case 'bring':
          if (errand(P.waiterSpot) || S.t > 25) {
            if (waiter) skyMeetingSay(M.lines.serve);
            M.drinks = 2;
            // The RESERVED card goes with the order.
            M.props = M.props.filter((q) => q.kind !== 'card');
            go('served');
          }
          return;
        case 'served':
          if (S.t > 2.5) {
            if (waiter) waiter.keyPerson.errand = null;
            M.service = null;
            if (M.stage === 'seated') M.stage = 'drinks';
          }
          return;
      }
    }
    // The waiter's walk on an errand (skyline-bar.js updateKeyPerson): true while it has him.
    function skyMeetingErrandStep(p, k, dt) {
      const e = k.errand;
      if (!e) return false;
      const dx = e.to.x - p.x,
        dy = e.to.y - p.y,
        dist = Math.hypot(dx, dy),
        step = Math.min(dist, FOOT_WALK * 0.9 * dt);
      p.pose = 'tray';
      if (dist > 0.4) {
        p.a = Math.atan2(dy, dx);
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        p.walk += step * 0.19;
        p.walking = true;
      } else {
        e.at = true;
        p.walking = false;
        if (e.to.a != null) p.a = e.to.a;
      }
      return true;
    }
    /* The handover: the player reaches the folder across, he takes it and reads, an envelope slides
       back, he stands, nods and goes. */
    function skyMeetingHandStep(dt, P) {
      const M = skyMeeting,
        H = M.hand,
        d = M.diplomat,
        seat = player.sceneSeat;
      H.t += dt;
      const t = H.t;
      if (seat) {
        seat.lift = 0;
        seat.hand = t < 1.25 ? 'folder' : null;
        seat.reach = t < 0.9 ? t / 0.9 : t < 1.25 ? 1 : Math.max(0, 1 - (t - 1.25) / 0.6);
      }
      d.drinkLift = null;
      d.sitReach = t < 0.7 ? 0 : t < 1.25 ? (t - 0.7) / 0.55 : t < 2 ? 1 - ((t - 1.25) / 0.75) * 0.55 : 0.45;
      H.his = t >= 1.25 ? 'folder' : 'cocktail';
      if (t >= 1.6 && !H.read) {
        H.read = true;
        skyMeetingSay(M.lines.read);
      }
      if (H.read && !M.script && !H.slid) {
        H.slid = t;
        M.props.push({ kind: 'envelope', owner: null, x: P.his.x - 3, y: P.table.y + 0.6, z: P.H + 6.6, a: 0.12, from: P.his.x - 3, to: P.mine.x + 3.2 });
        skyMeetingSay(M.lines.envelope);
      }
      if (H.slid) {
        const env = M.props.find((q) => q.kind === 'envelope');
        if (env) env.x = env.from + (env.to - env.from) * clamp((t - H.slid) / 1.2, 0, 1);
      }
      if (H.slid && !M.script && t - H.slid > 2 && !H.stood) {
        // He stands, with the folder under his arm, and nods.
        H.stood = t;
        d.sitting = false;
        d.pose = 'wait';
        d.sitReach = 0;
        d.x = P.his.x + 2;
        M.handedOver = true;
        M.stage = 'done';
        skyMeetingSay(M.lines.leave);
        d.leg = 0;
        M.hand = null;
        d.handProp = 'folder';
        M.leaveAt = gameTime + 1.6;
        // His glass stays on the table.
        M.props.push({ kind: 'glass', owner: 'his', x: P.his.x - 3.6, y: P.table.y - 1, z: P.H + 7.1, a: 0 });
      }
    }
    function skyMeetingLeaving(d, P, dt) {
      if (d.hidden) return;
      d.handProp = 'folder';
      if (gameTime < skyMeeting.leaveAt) {
        d.pose = 'wait';
        skyMeetFace(d, player, dt);
        return;
      }
      if (skyMeetWalk(d, P.leave, dt)) {
        // Into the lift: he rides down on his own, out of the scene.
        d.hidden = true;
        d.speech = '';
      }
    }
    /* ---- The player's chair --------------------------------------------------------------- */
    function skyMeetingSit() {
      const M = skyMeeting,
        P = skyMeetingPlaces(),
        s = P.mine;
      teleportPlayer(s.x, s.y);
      player.buildingRoof = P.b;
      player.altitude = P.H;
      player.a = s.a;
      player.sceneSeat = { x: s.x, y: s.y, a: s.a, lift: 0, hand: null, reach: 0, at: gameTime };
      // His glass back in hand, if he had put it down.
      M.props = M.props.filter((q) => q.owner !== 'mine');
      M.stage = M.drinks > 0 ? (M.talkDone ? 'handover' : 'drinks') : 'seated';
      if (!M.sat) {
        M.sat = true;
        skyMeetingSay(M.lines.sit);
      }
    }
    function skyMeetingStand() {
      const P = skyMeetingPlaces(),
        M = skyMeeting;
      player.sceneSeat = null;
      teleportPlayer(P.stand.x, P.stand.y);
      player.buildingRoof = P.b;
      player.altitude = P.H;
      player.a = -Math.PI / 2;
      // A served drink is left on the table.
      if (M.drinks > 0) M.props.push({ kind: 'glass', owner: 'mine', x: P.mine.x + 3.6, y: P.table.y + 1, z: P.H + 7.1, a: 0 });
      if (M.stage === 'done') {
        // The envelope goes into his jacket.
        M.envelopeTaken = true;
        M.props = M.props.filter((q) => q.kind !== 'envelope');
      } else if (M.active && M.stage !== 'failed') M.stage = 'terrace';
    }
    /* Seated: the feet stay put (game-update.js asks before the walk); a movement key stands him
       up, except in the middle of passing the folder. False once he is up (or never sat). */
    function skyMeetingSeatHold() {
      const seat = player.sceneSeat;
      if (!seat) return false;
      const P = skyMeetingPlaces();
      if (!skyMeeting.active || player.car || !P || player.buildingRoof !== P.b) {
        player.sceneSeat = null;
        return false;
      }
      if (playerMoveHeading() !== null && !skyMeeting.hand && gameTime - seat.at > 0.6) {
        skyMeetingStand();
        return false;
      }
      return true;
    }
    /* ---- Prompts and the action key (skyline-lift.js asks first) ----------------------------- */
    function skyMeetingPrompt() {
      const M = skyMeeting;
      if (!M.active || !M.diplomat || M.diplomat.hp <= 0 || player.car) return null;
      const P = skyMeetingPlaces(),
        d = M.diplomat;
      if (player.sceneSeat) return M.stage === 'handover' && !M.hand ? SKY_MEETING_PROMPTS.hand : SKY_MEETING_PROMPTS.quiet;
      if (M.stage === 'waiting' && !player.buildingRoof && withinRange('sky-meet-talk', distanceBetween(d, player), 30)) return SKY_MEETING_PROMPTS.talk;
      if (['terrace', 'seated', 'drinks', 'handover'].includes(M.stage) && d.sitting && player.buildingRoof === P.b && withinRange('sky-meet-sit', distanceBetween(P.mine, player), 22))
        return SKY_MEETING_PROMPTS.sit;
      return null;
    }
    function skyMeetingInteract() {
      const M = skyMeeting,
        offer = skyMeetingPrompt();
      if (!offer) return false;
      if (offer === SKY_MEETING_PROMPTS.talk) {
        M.stage = 'greeted';
        M.diplomat.pose = 'chat';
        M.diplomat.leg = 0;
        skyMeetingSay(M.lines.door);
      } else if (offer === SKY_MEETING_PROMPTS.sit) skyMeetingSit();
      else if (offer === SKY_MEETING_PROMPTS.hand) {
        M.script = null;
        M.hand = { t: 0, his: 'cocktail' };
      }
      return true;
    }
    /* ---- The lift (skyline-lift.js): he rides with the player, one ride -------------------- */
    function skyMeetingRideStart(lift, up) {
      const M = skyMeeting;
      if (!M.active || !up || lift.id !== 'bar' || M.stage !== 'greeted') return;
      M.stage = 'lift';
      M.script = null;
      M.diplomat.hidden = true;
      M.diplomat.speech = '';
    }
    // At the dark moment: he steps out beside the player.
    function skyMeetingRideMoved(L) {
      const M = skyMeeting,
        d = M.diplomat;
      if (!M.active || M.stage !== 'lift' || !L.up) return;
      Object.assign(d, { x: L.lift.arrive.x + 10, y: L.lift.arrive.y + 2, altitude: L.lift.b.height, a: Math.PI / 2, hidden: false, pose: null, sitting: false, leg: 0 });
    }
    // The ride over: true when the scene speaks for the arrival (no venue notice).
    function skyMeetingRideEnd(L) {
      const M = skyMeeting;
      if (!M.active || M.stage !== 'lift' || !L.up) return false;
      M.stage = 'terrace';
      skyMeetingSay(M.lines.arrive);
      // A word first, then he leads the way.
      M.walkAt = gameTime + 1.4;
      return true;
    }
    /* ---- Console (registered by game-console-missions.js) ------------------------------------ */
    // Put the scene at a stage with everyone in place (tests): the stages before it count as done.
    function skyMeetingSkip(stage = 'waiting') {
      const want = SKY_MEETING_STAGES.indexOf(stage);
      if (want < 0) return { error: 'stages: ' + SKY_MEETING_STAGES.join(', ') };
      if (!skyMeeting.active) skyMeetingBegin();
      const M = skyMeeting,
        P = skyMeetingPlaces(),
        d = M.diplomat;
      if (!d) return skyMeetingReport();
      player.sceneSeat = null;
      M.script = null;
      M.hand = null;
      M.service = null;
      if (want <= 1) {
        teleportPlayer(P.door.x + 14, P.door.y + 14);
        Object.assign(d, want ? P.lobbyWait : P.door, { altitude: undefined, hidden: false, sitting: false, pose: want ? 'wait' : 'smoke', leg: 0 });
        M.stage = stage;
        return skyMeetingReport();
      }
      // On the roof from 'lift' on: the lift's arrival spot, the terrace filled.
      teleportPlayer(P.lift.arrive.x, P.lift.arrive.y);
      player.buildingRoof = P.b;
      player.altitude = P.H;
      skyBarArrive();
      if (want === 2) {
        Object.assign(d, { x: P.lift.arrive.x + 10, y: P.lift.arrive.y + 2, altitude: P.H, hidden: false, sitting: false, pose: null, leg: 0 });
        M.stage = 'terrace';
        return skyMeetingReport();
      }
      Object.assign(d, { x: P.his.x, y: P.his.y, a: P.his.a, altitude: P.H, hidden: false, sitting: true, pose: 'sit', leg: P.path.length });
      M.stage = 'terrace';
      M.drinks = want >= 5 ? 2 : 0;
      if (M.drinks) M.props = M.props.filter((q) => q.kind !== 'card');
      M.talkDone = want >= 6;
      M.talkLine = M.talkDone ? M.lines.talk.length : 0;
      M.sat = want >= 4;
      if (want >= 4) skyMeetingSit();
      if (want === 7) {
        M.handedOver = true;
        M.stage = 'done';
        d.sitting = false;
        M.leaveAt = gameTime;
      }
      return skyMeetingReport();
    }
    function skyMeetingConsole() {
      return {
        // skyMeeting('begin' | 'end' | 'report', opts): the CIRRUS meeting scene (skyline-meeting.js).
        skyMeeting(action = 'report', opts = {}) {
          if (action === 'begin') skyMeetingBegin(opts && typeof opts === 'object' ? opts : {});
          else if (action === 'end') skyMeetingEnd();
          else if (action !== 'report') return { error: "actions: 'begin', 'end', 'report'" };
          return skyMeetingReport();
        },
        // skyMeetingSkip(stage): everyone in place for that stage (begins the scene if needed).
        skyMeetingSkip: (stage) => skyMeetingSkip(stage),
      };
    }
