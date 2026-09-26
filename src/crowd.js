    // BEGIN SUBSYSTEM: src/crowd.js — Crowd life, perception and reactions
    /**
     * Crowd life, perception and reactions
     * Source: src/crowd.js
     * Scope: shared game closure.
     * Who is on the pavement (appearance, role, time of day, streaming around the
     * player), how they walk it (lanes, corners, signals, doors), the little scenes
     * that make a street feel used (vendors, buskers, cafes, bus stops, club queues,
     * deliveries, taxi fares), and how people perceive and react to danger:
     * gunfire, crashes, near misses, bodies, a gun pointed at them, and the police
     * asking which way you went.
     *
     * The renderer never decides behaviour. Everything it needs is on the person:
     * `look` (appearance), `pose` (what the body is doing), `carry`, `dog`, and the
     * movement itself, from which it derives stride and speed.
     */

    /**
     * APPEARANCE
     * A look is chosen once per person and kept: skin, hair, clothes, build and
     * the few things they carry. Palettes are deliberately broad so a street of
     * forty people never repeats itself in an obvious way.
     */
    const CROWD_SKIN = ['#f3d6c1', '#eac0a0', '#dcaa85', '#c99169', '#b27a52', '#95603e', '#7a4b31', '#5e3825', '#452a1d'];
    const CROWD_HAIR = ['#16110e', '#231a15', '#33241b', '#4b3424', '#6a4a30', '#8c6a42', '#b89060', '#d8bd84', '#9c3f26', '#6f6f6f', '#b9b8b2'];
    const CROWD_TOPS = [
      '#2f3e57', '#6b2f36', '#d8d2c4', '#3c5b47', '#8a6d4a', '#1f2327', '#c6b99a', '#5a6f86', '#a4462f', '#e3c35a',
      '#6e5a7d', '#3a7a7a', '#b8563f', '#f0ebe0', '#44505c', '#7f8f5a', '#c78da1', '#2d6a93', '#8b8f96', '#e07b4f',
    ];
    const CROWD_PANTS = ['#2a3444', '#34465e', '#1d2126', '#4a4a4f', '#6e6553', '#8c7f63', '#23303f', '#565d66', '#3c2f2a', '#7a8290'];
    const CROWD_SHOES = ['#141414', '#1e1a18', '#f0eee8', '#5a3b28', '#2b2f3a', '#8a8d93'];
    const CROWD_UMBRELLAS = ['#1b1d22', '#8e1f2a', '#23355e', '#2f5d44', '#d9b43c', '#6d3f76', '#e5e1d6'];
    const CROWD_DOGS = ['#6b4a2e', '#1c1a18', '#d8c9a8', '#b98845', '#8a8d93', '#f1ece2', '#4a3526'];

    /**
     * ROLES
     * Who is out depends on the hour: commuters with briefcases and coffee in
     * the rush, shoppers and tourists through the day, dog walkers morning and
     * evening, joggers at the edges of the day, revellers after dark. A role sets
     * pace, clothes and props; the behaviour below reads it.
     */
    function crowdRoleWeights(hour) {
      if (hour < 5) return { reveller: 5, casual: 3, worker: 2, texter: 1, dogWalker: 0.4 };
      if (hour < 6.5) return { jogger: 3, worker: 3, commuter: 2, dogWalker: 2, casual: 1 };
      if (hour < 9.5) return { commuter: 7, jogger: 1.2, dogWalker: 1.4, texter: 2, casual: 2, family: 0.8, worker: 1 };
      if (hour < 11.5) return { shopper: 3, tourist: 2, casual: 3, texter: 1.5, dogWalker: 1, family: 1, elder: 1.4 };
      if (hour < 14.5) return { commuter: 3, shopper: 3, tourist: 2, casual: 3, texter: 2, couple: 1, elder: 1 };
      if (hour < 17.5) return { shopper: 4, tourist: 2.5, casual: 3, texter: 2, family: 1.6, elder: 1.2, dogWalker: 0.8 };
      if (hour < 19.5) return { commuter: 6, jogger: 1.3, dogWalker: 1.4, texter: 2, casual: 2, shopper: 1 };
      if (hour < 23) return { couple: 3, casual: 3, reveller: 2.5, dogWalker: 1, texter: 1.5, tourist: 1 };
      return { reveller: 4, casual: 2.5, couple: 1.5, texter: 1 };
    }
    function pickWeighted(weights) {
      let total = 0;
      for (const k in weights) total += weights[k];
      let r = seededRandom() * total;
      for (const k in weights) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return 'casual';
    }
    function crowdHour() {
      return (worldMinutes / 60) % 24;
    }
    /* Give a person a look, a temperament and (optionally) a role. Safe to call again. */
    function dressPerson(p, role = p.role) {
      const hour = crowdHour(),
        pick = randomChoice;
      p.role = role || 'casual';
      const old = p.role === 'elder',
        kid = p.role === 'kid',
        night = hour > 20 || hour < 5;
      let top = p.color || pick(CROWD_TOPS),
        pants = pick(CROWD_PANTS),
        shoes = pick(CROWD_SHOES),
        hairStyle = pick([0, 1, 1, 1, 2, 2, 3, 4]),
        skirt = seededRandom() < 0.18,
        hat = seededRandom() < 0.1 ? 1 : 0,
        backpack = seededRandom() < 0.14,
        carry = null,
        sleeves = seededRandom() < 0.55,
        build = randomBetween(0.86, 1.2),
        height = randomBetween(0.93, 1.07);
      // Hair style: 0 bald or shaved, 1 short, 2 long, 3 bun, 4 curly/volume.
      if (p.role === 'commuter') {
        top = pick(['#23272e', '#2f3e57', '#44505c', '#3a3230', '#5a6f86', '#e8e4da']);
        pants = pick(['#1d2126', '#23303f', '#2a3444', '#3a3a3f']);
        shoes = pick(['#141414', '#1e1a18', '#3a2618']);
        carry = pick(['briefcase', 'briefcase', 'coffee', 'coffee', null]);
        sleeves = true;
        skirt = seededRandom() < 0.22;
        backpack = seededRandom() < 0.18;
      } else if (p.role === 'shopper') carry = pick(['shopping', 'shopping', 'shopping', 'handbag']);
      else if (p.role === 'tourist') {
        top = pick(['#e3c35a', '#e07b4f', '#f0ebe0', '#3a7a7a', '#c78da1', '#2d6a93']);
        pants = pick(['#c2b089', '#8c7f63', '#34465e']);
        hat = seededRandom() < 0.45 ? 1 : 0;
        backpack = seededRandom() < 0.55;
        carry = seededRandom() < 0.3 ? 'camera' : null;
        sleeves = false;
      } else if (p.role === 'jogger') {
        top = pick(['#e24a3b', '#2fa3c7', '#f2f2ec', '#1f2327', '#9ad14b', '#f08bb0']);
        pants = pick(['#1d2126', '#23303f', '#2a3444']);
        shoes = pick(['#f0eee8', '#e24a3b', '#2fa3c7']);
        sleeves = false;
        skirt = false;
        backpack = false;
        hairStyle = pick([0, 1, 3]);
      } else if (p.role === 'worker') {
        top = pick(['#e8761e', '#d8c93a', '#6b5638', '#3d4c5c']);
        pants = pick(['#34465e', '#3c2f2a', '#565d66']);
        shoes = '#3a2618';
        hat = seededRandom() < 0.4 ? 1 : 0;
        skirt = false;
      } else if (p.role === 'reveller' || (night && seededRandom() < 0.4)) {
        top = pick(['#1d1f24', '#8e1f2a', '#6d3f76', '#d4b24a', '#e5e1d6', '#1f5f7a', '#c23b6b']);
        pants = pick(['#1d2126', '#141414', '#2a3444']);
        skirt = seededRandom() < 0.4;
      } else if (p.role === 'texter') carry = null;
      else if (old) {
        hairStyle = pick([0, 1, 1, 3]);
        top = pick(['#8a6d4a', '#6b2f36', '#c6b99a', '#3c5b47', '#44505c']);
        pants = pick(['#6e6553', '#4a4a4f', '#23303f']);
        hat = seededRandom() < 0.3 ? 1 : 0;
        carry = seededRandom() < 0.3 ? 'shopping' : null;
      }
      if (kid) {
        backpack = seededRandom() < 0.6;
        carry = null;
        height = randomBetween(0.58, 0.7);
        build = randomBetween(0.9, 1.05);
        top = pick(['#e24a3b', '#2fa3c7', '#e3c35a', '#9ad14b', '#f08bb0', '#f0ebe0']);
      }
      if (p.role === 'bouncer') {
        top = '#16181c';
        pants = '#16181c';
        build = randomBetween(1.3, 1.45);
        height = randomBetween(1.04, 1.1);
        hairStyle = 0;
        skirt = false;
        hat = 0;
        carry = null;
        backpack = false;
      }
      p.color = top;
      p.look = {
        skin: pick(CROWD_SKIN),
        hair: old ? pick(['#9a9a96', '#c9c8c2', '#e2e0d8', '#6f6f6f']) : pick(CROWD_HAIR),
        hairStyle,
        top,
        pants,
        shoes,
        skirt,
        sleeves,
        hat,
        hatColor: pick(['#23272e', '#8e1f2a', '#2d6a93', '#d8d2c4', '#3c5b47', '#e3c35a']),
        backpack,
        bagColor: pick(['#2b2f3a', '#6b2f36', '#3c5b47', '#8a6d4a', '#1d1f24', '#d9b43c']),
        build,
        height,
        stoop: old ? randomBetween(0.12, 0.22) : 0,
        umbrella: seededRandom() < 0.65 ? pick(CROWD_UMBRELLAS) : null,
      };
      p.carry = carry;
      p.texting = p.role === 'texter';
      p.pace =
        {
          commuter: 1.18,
          jogger: 2.1,
          tourist: 0.8,
          elder: 0.68,
          texter: 0.82,
          shopper: 0.92,
          reveller: 0.9,
          kid: 1.05,
          worker: 1,
        }[p.role] || randomBetween(0.9, 1.08);
      // Temperament: how likely to film, shout or call instead of running.
      p.nerve = kid ? 0.1 : clamp(seededRandom() * (p.role === 'worker' ? 1.1 : 1) + (old ? -0.2 : 0), 0, 1);
      p.lane = randomBetween(3, 9);
      if (p.role === 'dogWalker' && !p.dog)
        p.dog = { x: p.x - 10, y: p.y + 6, a: p.a || 0, color: pick(CROWD_DOGS), size: randomBetween(0.75, 1.25), sniff: 0 };
      return p;
    }
    function ensureLook(p) {
      if (!p.look) dressPerson(p, p.role || (p.jogger ? 'jogger' : p.gymStation ? 'jogger' : 'casual'));
      return p.look;
    }

    /**
     * SPOKEN LINES
     * Short enough to read in a bubble at a glance. The pedestrian lines in
     * game.js still cover the everyday chatter; these are the reactions.
     */
    const CROWD_LINES = {
      cower: ['Get down!', 'Oh god, oh god…', 'Don’t shoot!', 'Stay down!', 'Please, no!'],
      flee: ['Run!', 'He’s got a gun!', 'Move, move!', 'Get out of here!', 'Somebody help!', 'Go, go, go!'],
      heard: ['Was that a gunshot?', 'Fireworks?', 'That was close…', 'What was that?', 'Did you hear that?'],
      boom: ['What the hell was that?!', 'Something blew up!', 'Oh my god!', 'Everybody get back!'],
      film: ['Are you getting this?', 'This is going online.', 'I’m filming, I’m filming!', 'Nobody’s gonna believe this.'],
      shout: ['Put the gun down!', 'Hey! Stop!', 'Police are coming, pal!', 'Are you out of your mind?!'],
      handsUp: ['Don’t shoot!', 'Take my wallet!', 'Please, I have kids!', 'I didn’t see anything!', 'Easy, easy…', 'Whatever you want!'],
      plead: ['Please… please…', 'I won’t tell anyone.', 'I just want to go home.', 'Please don’t.'],
      dodge: ['Whoa!', 'Jesus!', 'Hey!', 'Look out!'],
      fist: ['Learn to drive!', 'You maniac!', 'I’ve got your plate!', 'Sidewalk, pal!', 'Slow down, idiot!', 'You nearly killed me!'],
      gasp: ['Oh my god…', 'Is he… dead?', 'Don’t look.', 'Somebody help him!', 'Jesus Christ…'],
      crashWatch: ['Is everyone okay?', 'Did you see that?', 'He came out of nowhere!', 'Somebody call an ambulance!', 'That’s gonna cost him.', 'Total wreck.'],
      bodyWatch: ['Somebody cover him up.', 'Don’t touch anything.', 'Who would do this?', 'Where are the cops?', 'I saw the whole thing.'],
      injured: ['Ugh… my leg…', 'Help me…', 'I’m hit… I’m hit…', 'Somebody… please…', 'Oww…'],
      helper: ['Stay with me!', 'Don’t move, help’s coming.', 'Can you hear me?', 'Breathe. Just breathe.'],
      point: ['He went that way!', 'That way, officer!', 'Over there!', 'He ran down there!'],
      greet: ['Hey.', 'Evening.', 'Nice day for it.', 'How’s it going?', 'Morning.', 'Hey, man.', 'Alright?'],
      relief: ['Okay… okay.', 'Thank god.', 'Jesus, man.', 'I’m going. I’m going.'],
      recover: ['Is it over?', 'I think he’s gone.', 'My heart’s still pounding.', 'Unbelievable. This city.', 'I need a drink.'],
      angryDriver: ['Look at my car!', 'You’re paying for this!', 'Where’d you learn to drive?!', 'Are you blind?!', 'Unbelievable!', 'Insurance. Now.'],
      shakenDriver: ['My neck…', 'I didn’t see him…', 'Is everyone alright?', 'I need to sit down.'],
      honk: ['Move it!', 'Come ON!', 'Green means go!', 'Some of us work!', 'Get out of the road!'],
      chat: ['No way! Since when?', 'We should grab lunch.', 'How’s the new place?', 'Did you hear about Mike?', 'Ha! Classic.', 'Same time next week?'],
      phoneTalk: ['No, I’m on my way.', 'Can you hear me now?', 'Tell her I said hi.', 'Ten minutes, tops.', 'I’ll call you back.'],
      hail: ['Taxi!', 'Hey, taxi!', 'Over here!'],
      queue: ['Is the line always this long?', 'Do you know the DJ?', 'I’m on the list. Somewhere.', 'Twenty bucks cover? Really?'],
      bouncer: ['ID.', 'Not tonight.', 'Wait your turn.', 'Next.'],
      busker: ['Thank you, thank you.', 'This one’s an old one.', 'Requests? Anyone?'],
      listener: ['He’s actually good.', 'Got any change?', 'I love this song.'],
      delivery: ['Sign here.', 'Last one on this street.', 'Who orders forty kilos of rice?'],
      bus: ['Finally.', 'Twenty minutes late.', 'Is this the 12?'],
      cafe: ['This coffee is terrible. I love it.', 'Check, please.', 'Another round?', 'So then he says…'],
      // The weather (weather.js): a shower building, arriving, and gone.
      rainComing: ['Looks like rain is coming.', 'Smell that? Rain.', 'Those clouds look nasty.', 'Here comes the rain.', 'Did you hear thunder?', 'I should have brought an umbrella.'],
      rainStart: ['Great. Just great.', 'Here it comes!', 'Run for it!', 'My hair!', 'It’s pouring!', 'Of course it’s raining.'],
      rainUmbrella: ['Told you to bring one.', 'Good thing I checked the forecast.', 'Stay under here.'],
      rainStop: ['Finally.', 'Think it’s done?', 'Smells like rain.', 'Look at those puddles.'],
    };
    function crowdSay(p, kind, chance = 1, extra = '') {
      if ((p.speechUntil || 0) > gameTime || seededRandom() > chance) return false;
      const lines = CROWD_LINES[kind] || PED_LINES[kind];
      if (!lines) return false;
      p.speech = randomChoice(lines) + extra;
      p.speechUntil = gameTime + 2.6;
      // What kind of line this is, for the bubble priority (speechBubbles).
      p.speechKind = kind;
      p.speechKindText = p.speech;
      return true;
    }

    /**
     * SPEECH BUBBLES ON SCREEN
     * Street speech sets `p.speech` / `p.speechUntil` on a pedestrian, a driver or
     * a gang member or soldier, from many places. The renderer asks
     * speechBubbles() which of those lines to draw: never more than
     * SPEECH_BUBBLES_MAX at once, so they can be read. A bubble keeps its slot
     * until its line ends, and every shown line stays up long enough to read
     * (speechReadSeconds). Free slots go to the most important waiting line:
     * soldiers, police and mission characters first, then lines aimed at the
     * player (hands up, pleading, a carjacked or rammed driver, anyone speaking
     * right beside them), then the nearest. A command or a line to the player
     * takes the slot of an idle remark. A line that finds no slot waits up to
     * SPEECH_QUEUE_SECONDS and is then dropped. Mission and contact dialogue
     * (the dialogue box, the Blue Hour boss) is drawn elsewhere and not counted.
     */
    const SPEECH_BUBBLES_MAX = 2,
      SPEECH_QUEUE_SECONDS = 2.5,
      SPEECH_RANGE = 460,
      SPEECH_TO_PLAYER = new Set(['handsUp', 'plead', 'fist', 'angryDriver', 'shout', 'point', 'dodge', 'carjack']);
    let speechShown = [];
    function speechReadSeconds(text) {
      return clamp(1.5 + text.length * 0.065, 2.4, 6);
    }
    function speechPriority(p) {
      // The Falcon's riders come first while the player rides with them (themepark.js).
      if (p.coasterRider && player.coaster?.kind === 'train') return 4;
      if (p.military || p.police || p.missionTag || p.ally || p.inConversation) return 3;
      const kind = p.speechKindText === p.speech ? p.speechKind : '';
      if (SPEECH_TO_PLAYER.has(kind) || distanceBetween(p, player) < 70) return 2;
      return 1;
    }
    function speechLive(p) {
      return (
        !!p.speech &&
        p.speechUntil >= gameTime &&
        p.hp > 0 &&
        distanceBetween(p, cameraTarget) <= SPEECH_RANGE &&
        speechHeightFade(p) > 0
      );
    }
    /**
     * SPEECH SEEN FROM ABOVE
     * A bubble is a line heard at street level: from 50 m up nobody could hear
     * it, so bubbles fade out between SPEECH_FADE_FROM (40 m) and SPEECH_HIDDEN
     * (50 m) of height between the view and the speaker, and a hidden line takes
     * no bubble slot. The height is:
     *   - flying (an aircraft, the parachute) or riding (the Falcon, the Eye):
     *     the player's elevation over the speaker's; for someone on the ground
     *     under a helicopter that is the AGL the flight HUD shows, and riders on
     *     the player's own train are level with the player, so theirs stay up
     *     however high the track climbs (the ride camera stays by the train);
     *   - otherwise the street camera's zoom as a height (streetZoomHeight,
     *     flight-view3d.js: about 30 m at zoom 0.8, 50 m at 0.64) plus the
     *     player's elevation over the speaker (looking down from a roof). The
     *     player's own zoom counts, not the pull-back at speed, which is
     *     momentary and is when drivers shout at the player.
     * Someone above the view (riders on the Falcon watched from the ground)
     * counts as level. Covers every bubble: the street (crowd, drivers,
     * carjacks, police, soldiers, Falcon riders) and the Blue Hour rooftop.
     */
    const SPEECH_FADE_FROM = 40 * UNITS_PER_METRE,
      SPEECH_HIDDEN = 50 * UNITS_PER_METRE;
    function speechViewHeight(p) {
      let eye = entityElevation(player);
      if (!player.coaster && !player.parachute && !isAircraft(player.car)) {
        const zoom = worldZoom / Math.max(0.1, speedZoom);
        eye += city3D?.zoomHeight ? city3D.zoomHeight(zoom) : Math.max(0, 1 / zoom - 1) * 780;
      }
      return Math.max(0, eye - entityElevation(p));
    }
    function speechHeightFade(p) {
      return clamp((SPEECH_HIDDEN - speechViewHeight(p)) / (SPEECH_HIDDEN - SPEECH_FADE_FROM), 0, 1);
    }
    // DeadEndCity.speechView(): the rule as it stands for someone on the ground at the view's centre.
    function speechViewReport() {
      const ground = { x: cameraTarget.x, y: cameraTarget.y };
      return {
        viewHeight: +worldMeters(speechViewHeight(ground)).toFixed(1),
        fade: +speechHeightFade(ground).toFixed(2),
        fadeFrom: worldMeters(SPEECH_FADE_FROM),
        hiddenAt: worldMeters(SPEECH_HIDDEN),
        zoom: +(worldZoom / Math.max(0.1, speedZoom)).toFixed(3),
        riding: player.coaster?.kind || null,
        flying: !!(player.parachute || isAircraft(player.car)),
        bubbles: speechShown.map((p) => ({ text: p.speech, rider: !!p.coasterRider, fade: +speechHeightFade(p).toFixed(2) })),
      };
    }
    // The bubbles to draw this frame, most important first: at most SPEECH_BUBBLES_MAX.
    function speechBubbles() {
      if (!npcChatterOn()) {
        speechShown = [];
        return [];
      }
      // A holder keeps its bubble while the line it was given is still running.
      speechShown = speechShown.filter((p) => speechLive(p) && p.speechShownText === p.speech);
      const waiting = [],
        labels = [];
      // coasterSpeakers(): the Falcon's riders (themepark.js); clubTalkSpeakers(): the
      // player, while talking with a club-goer (clubtalk.js).
      for (const list of [pedestrians, vehicles, gangMembers, coasterSpeakers(), clubTalkSpeakers()])
        for (const p of list) {
          if (!p.speech || p.speechUntil < gameTime) continue;
          if (p.speechHeard !== p.speech) {
            // A new line: note when it was said, so it can only wait so long.
            p.speechHeard = p.speech;
            p.speechSaidAt = gameTime;
          }
          // The pose gallery's labels (a console tool) are not speech: all shown.
          if (p.posed && p.speech === p.posed) {
            if (speechLive(p)) labels.push(p);
            continue;
          }
          if (speechShown.includes(p) || !speechLive(p)) continue;
          waiting.push(p);
        }
      if (waiting.length) {
        for (const p of waiting) {
          p.speechRank = speechPriority(p);
          p.speechDistance = distanceBetween(p, player);
        }
        waiting.sort((a, b) => b.speechRank - a.speechRank || a.speechDistance - b.speechDistance);
        for (const p of waiting) {
          if (speechShown.length >= SPEECH_BUBBLES_MAX) {
            // An important line bumps the least important idle remark on screen.
            const weakest = speechShown.reduce((w, q) => (!w || speechPriority(q) < speechPriority(w) ? q : w), null);
            if (p.speechRank >= 2 && speechPriority(weakest) < p.speechRank) {
              weakest.speechUntil = gameTime;
              speechShown = speechShown.filter((q) => q !== weakest);
            }
          }
          if (speechShown.length < SPEECH_BUBBLES_MAX) {
            speechShown.push(p);
            p.speechShownText = p.speech;
            p.speechUntil = Math.max(p.speechUntil, gameTime + speechReadSeconds(p.speech));
          } else if (gameTime - (p.speechSaidAt ?? gameTime) < SPEECH_QUEUE_SECONDS)
            // Hold the line a moment for a free slot; after that it lapses unheard.
            p.speechUntil = Math.max(p.speechUntil, gameTime + 0.05);
        }
      }
      return speechShown
        .map((p) => ({ p, rank: speechPriority(p) }))
        .sort((a, b) => b.rank - a.rank)
        .map((e) => e.p)
        .concat(labels);
    }

    /**
     * SHARED STATE
     * One object holds the director's timers and lists so the rest of the closure
     * sees a single name.
     */
    const crowd = {
      grid: new Map(),
      gridStamp: -1,
      incidents: [],
      bodies: [],
      indoors: [],
      scenes: [],
      props: [],
      tempo: null,
      hour: 12,
      timers: { stream: 0, bodies: 0, aim: 0, tips: 0, scenes: 0, traffic: 0, near: 0, chat: 0 },
      playerShotAt: -100,
      lastTipAt: -100,
      lastNodAt: -100,
      lastReportAt: -100,
      settledAt: null,
      settleStamp: -100,
      reports: 0,
      honks: 0,
      incidentId: 1,
    };
    // Bus shelters register themselves here when the renderer builds them.
    const BUS_STOPS = [];
    function registerBusStop(x, y) {
      if (BUS_STOPS.some((s) => Math.abs(s.x - x) < 20 && Math.abs(s.y - y) < 20)) return;
      BUS_STOPS.push({ x, y, nextBus: 0 });
    }

    /* Rough camera footprint in map units, used to keep spawning off screen. */
    // Asked for every pedestrian every frame: the footprint is recomputed only
    // when the viewport or the zoom changes, and the same record is returned.
    const crowdView = { w: 0, h: 0, width: -1, height: -1, zoom: -1 };
    function crowdViewHalf() {
      if (crowdView.width !== viewportWidth || crowdView.height !== viewportHeight || crowdView.zoom !== worldZoom) {
        const viewH = clamp(viewportHeight * 0.68, 430, 630) / Math.max(0.2, worldZoom);
        crowdView.w = (viewH * viewportWidth) / viewportHeight / 2 + 40;
        crowdView.h = viewH * 0.75 + 40;
        crowdView.width = viewportWidth;
        crowdView.height = viewportHeight;
        crowdView.zoom = worldZoom;
      }
      return crowdView;
    }
    function crowdInView(x, y, margin = 0) {
      const v = crowdViewHalf();
      return Math.abs(x - cameraTarget.x) < v.w + margin && Math.abs(y - cameraTarget.y) < v.h + margin;
    }
    /* Inside the street grid of the city proper, where sidewalks follow the roads. */
    function inCityGrid(x, y) {
      return x > CITY_LEFT + 60 && x < CITY_SIZE - 60 && y > CITY_TOP + 60 && y < CITY_SIZE - 60;
    }
    /* Cheap carriageway test: within a road's asphalt on the grid. */
    function crowdOnRoad(x, y) {
      if (!inCityGrid(x, y)) return false;
      const rx = Math.abs(x - roadNear(x)),
        ry = Math.abs(y - rowNear(y)),
        wideX = wideColumn(roadNear(x)),
        wideY = wideRow(rowNear(y));
      return rx < (wideX ? 56 : 44) || ry < (wideY ? 56 : 44);
    }
    /* Sidewalk centre offset from a road's centre line. */
    function sidewalkOffset(road, column) {
      return (column ? wideColumn(road) : wideRow(road)) ? 72 : 67;
    }
    /* Pull a point off the carriageway onto the nearer sidewalk, keeping it on land. */
    function snapToSidewalk(x, y) {
      if (!crowdOnRoad(x, y)) return { x, y };
      const R = roadNear(x),
        C = rowNear(y),
        dx = Math.abs(x - R),
        dy = Math.abs(y - C);
      if (dx < dy) return { x: R + Math.sign(x - R || 1) * sidewalkOffset(R, true), y };
      return { x, y: C + Math.sign(y - C || 1) * sidewalkOffset(C, false) };
    }
    /**
     * LINE OF SIGHT
     * clearSight() walks every building in the city; perception runs it for
     * dozens of people per shot, so this version marches the ray through the
     * building grid instead and only asks the few buildings in each cell.
     */
    function crowdSight(a, b) {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy),
        steps = Math.ceil(d / 16);
      for (let i = 1; i < steps; i++) {
        const t = i / steps,
          x = a.x + dx * t,
          y = a.y + dy * t;
        for (const bld of buildingsNear(x, y))
          if (x > bld.x && x < bld.x + bld.w && y > bld.y && y < bld.y + bld.h && (bld.height || 30) > 12) return false;
      }
      return true;
    }
    /**
     * DOORS
     * A building that fronts a street to the south has a shop door in the middle
     * bay of its shopfront, where the renderer draws it; those are the doors the
     * street scenes use. People ducking inside can also use a door on any other
     * street-facing side: north faces are hidden from the camera and the side
     * faces are seen edge on, so someone walking into one reads as going in.
     * Named businesses use their own door.
     */
    function buildingDoor(b) {
      if (b.crowdDoor !== undefined) return b.crowdDoor;
      b.crowdDoor = null;
      if (b.place || b.depotWall || b.w < 40 || !inCityGrid(b.x, b.y)) return null;
      if (!cityStreetAt(b.x + b.w / 2, b.y + b.h + 44, 10)) return null;
      const bays = Math.max(1, Math.floor((b.w - 16) / 46)),
        bayWidth = (b.w - 16) / bays,
        x = b.x + 8 + bayWidth * (Math.floor(bays / 2) + 0.5),
        y = b.y + b.h + 3;
      if (solid(x, y + 6, 4)) return null;
      b.crowdDoor = { x, y, out: { x, y: y + 16 }, building: b, shop: true };
      return b.crowdDoor;
    }
    function buildingEntrances(b) {
      if (b.crowdEntrances) return b.crowdEntrances;
      const list = [];
      const shop = buildingDoor(b);
      if (shop) list.push(shop);
      if (!b.place && !b.depotWall && b.w >= 30 && b.h >= 30 && inCityGrid(b.x, b.y)) {
        const cx = b.x + b.w / 2,
          cy = b.y + b.h / 2;
        for (const [x, y, ox, oy] of [
          [cx, b.y - 3, 0, -1],
          [b.x - 3, cy, -1, 0],
          [b.x + b.w + 3, cy, 1, 0],
          [cx, b.y + b.h + 3, 0, 1],
        ]) {
          if (oy === 1 && shop) continue;
          const out = { x: x + ox * 16, y: y + oy * 16 };
          if (!cityStreetAt(x + ox * 60, y + oy * 60, 12) || solid(out.x, out.y, 4)) continue;
          list.push({ x, y, out, building: b, shop: false });
        }
      }
      b.crowdEntrances = list;
      return list;
    }
    function doorNear(p, range, shopOnly = false) {
      let best = null,
        bestD = range;
      for (const place of PLACES)
        if (place.door && place.kind !== 'rooftop') {
          const d = distanceBetween(p, place.door);
          if (d < bestD) {
            best = { x: place.door.x, y: place.door.y, out: { x: place.door.x, y: place.door.y + 14 }, place };
            bestD = d;
          }
        }
      const seen = new Set();
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (const b of buildingsNear(p.x + i * range, p.y + j * range)) {
            if (seen.has(b)) continue;
            seen.add(b);
            for (const door of shopOnly ? [buildingDoor(b)] : buildingEntrances(b)) {
              if (!door) continue;
              const d = distanceBetween(p, door);
              if (d < bestD) {
                best = door;
                bestD = d;
              }
            }
          }
      return best;
    }

    /**
     * NEIGHBOUR GRID
     * Rebuilt once a frame for the people near the player. Perception, panic
     * spreading, chats and near misses all ask it "who is around this point".
     */
    const CROWD_CELL = 64;
    function crowdKey(x, y) {
      return Math.floor(x / CROWD_CELL) * 65536 + Math.floor(y / CROWD_CELL);
    }
    const CROWD_GRID_REACH = 1300;
    function buildCrowdGrid() {
      // Cell arrays are reused frame to frame; empty ones are swept now and then.
      const sweep = ++crowd.gridStamp % 120 === 0;
      if (sweep) {
        for (const [k, cell] of crowd.grid) if (!cell.length) crowd.grid.delete(k);
      }
      for (const cell of crowd.grid.values()) cell.length = 0;
      crowd.gridX = player.x;
      crowd.gridY = player.y;
      for (const p of pedestrians) {
        if (p.hp <= 0 || Math.abs(p.x - player.x) > CROWD_GRID_REACH || Math.abs(p.y - player.y) > CROWD_GRID_REACH) continue;
        const k = crowdKey(p.x, p.y);
        let cell = crowd.grid.get(k);
        if (!cell) crowd.grid.set(k, (cell = []));
        cell.push(p);
      }
    }
    /**
     * Visit living pedestrians near a point. Inside the grid's reach this asks
     * only the nearby cells; elsewhere it falls back to the whole list. Traffic
     * uses it to yield to people without scanning every pedestrian per car.
     */
    function forEachPedestrianNear(x, y, r, fn) {
      const reach = CROWD_GRID_REACH - r - 20;
      if (crowd.gridStamp >= 0 && Math.abs(x - crowd.gridX) < reach && Math.abs(y - crowd.gridY) < reach) {
        const x0 = Math.floor((x - r) / CROWD_CELL),
          x1 = Math.floor((x + r) / CROWD_CELL),
          y0 = Math.floor((y - r) / CROWD_CELL),
          y1 = Math.floor((y + r) / CROWD_CELL);
        for (let i = x0; i <= x1; i++)
          for (let j = y0; j <= y1; j++) {
            const cell = crowd.grid.get(i * 65536 + j);
            if (cell) for (let k = 0; k < cell.length; k++) fn(cell[k]);
          }
        return;
      }
      // Far from the player (distant traffic yielding to walkers): a second grid of
      // everyone, dead included as the old full scan was, built at most once a frame.
      const far = crowdFarGrid;
      if (far.stamp !== crowd.gridStamp || far.count !== pedestrians.length) {
        far.stamp = crowd.gridStamp;
        far.count = pedestrians.length;
        const build = ++far.build;
        if (far.cells.size > 4000) far.cells.clear();
        for (let i = 0; i < pedestrians.length; i++) {
          const p = pedestrians[i],
            k = crowdKey(p.x, p.y);
          let cell = far.cells.get(k);
          if (!cell) far.cells.set(k, (cell = []));
          // Reset lazily: a cell with an old build number is empty.
          if (cell.build !== build) {
            cell.build = build;
            cell.length = 0;
          }
          cell.push(p);
        }
      }
      // People move a little between the grid being built and this query: widen it.
      const reachFar = r + 24,
        x0 = Math.floor((x - reachFar) / CROWD_CELL),
        x1 = Math.floor((x + reachFar) / CROWD_CELL),
        y0 = Math.floor((y - reachFar) / CROWD_CELL),
        y1 = Math.floor((y + reachFar) / CROWD_CELL);
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++) {
          const cell = far.cells.get(i * 65536 + j);
          if (cell && cell.build === far.build) for (let k = 0; k < cell.length; k++) fn(cell[k]);
        }
    }
    const crowdFarGrid = { stamp: -1, count: -1, build: 0, cells: new Map() };
    function forPeopleNear(x, y, r, fn) {
      const x0 = Math.floor((x - r) / CROWD_CELL),
        x1 = Math.floor((x + r) / CROWD_CELL),
        y0 = Math.floor((y - r) / CROWD_CELL),
        y1 = Math.floor((y + r) / CROWD_CELL);
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++) {
          const cell = crowd.grid.get(i * 65536 + j);
          if (!cell) continue;
          for (const p of cell) {
            const d = Math.hypot(p.x - x, p.y - y);
            if (d <= r) fn(p, d);
          }
        }
    }

    /**
     * STREAMING
     * The city is large and the camera is small. Rather than spreading six
     * hundred people evenly across forty square kilometres, ordinary walkers are
     * kept in a ring around the player: whoever drifts far away and out of sight
     * is re-dressed and placed back on a sidewalk just beyond the edge of the
     * screen, so the streets you can see are always busy. How busy follows the
     * hour (cityTempo) and the district (the docks are quiet, Broadway is not).
     */
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

    /**
     * WALKING THE GRID
     * Walkers keep to the right-hand side of the sidewalk (so two streams pass
     * without walking through each other), turn at corners onto the cross
     * street, wait at the kerb for their signal and glance before stepping out,
     * and break the walk with small routines: stopping to take a call, looking
     * in a window, going into a shop, sitting on a bench, or stopping to talk to
     * someone they know.
     */
    function nextCrossing(lines, v, sign) {
      let best;
      for (const r of lines) if ((r - v) * sign > 0 && (best === undefined || (r - best) * sign < 0)) best = r;
      return best;
    }
    function snapAxis(a) {
      return (Math.round(a / (Math.PI / 2)) * Math.PI) / 2;
    }
    function walkerSpeed(p) {
      let s = crowd.tempo.speed * (p.pace || 1);
      if (p.shakenUntil > gameTime) s *= 1.35;
      if (p.injured) s *= 0.45;
      if (weather.rain > 0.3 && !p.look?.umbrella && p.role !== 'jogger') s *= p.rainRun ? 2.9 : 1.25;
      return s;
    }
    /* Step a person along a heading at a speed; returns true when something stopped them. */
    function crowdStep(p, heading, speed, deltaSeconds, radius = 5) {
      p.a = heading;
      p.walking = speed > 0.5;
      p.walk += deltaSeconds * strideRate(speed);
      return moveBody(p, Math.cos(heading) * speed * deltaSeconds, Math.sin(heading) * speed * deltaSeconds, radius);
    }
    function faceToward(p, target, deltaSeconds, rate = 6) {
      const d = normalizeAngle(headingBetween(p, target) - p.a);
      p.a += clamp(d, -rate * deltaSeconds, rate * deltaSeconds);
    }
    function goIndoors(p, door, seconds, why) {
      const i = pedestrians.indexOf(p);
      if (i < 0) return;
      if (p.bench) p.bench.taken = null;
      p.bench = null;
      pedestrians.splice(i, 1);
      const party = [p];
      for (let k = pedestrians.length - 1; k >= 0; k--)
        if (pedestrians[k].leader === p) party.push(...pedestrians.splice(k, 1));
      crowd.indoors.push({ party, door, until: gameTime + seconds, why });
    }
    function updateIndoors() {
      for (let i = crowd.indoors.length - 1; i >= 0; i--) {
        const stay = crowd.indoors[i];
        if (gameTime < stay.until) continue;
        // Sheltering from a shower: wait until it has eased off.
        if (stay.why === 'rain' && weather.rain > 0.3) {
          stay.until = gameTime + 8;
          continue;
        }
        // Nobody comes out while shooting is still going on nearby.
        if (crowd.incidents.some((inc) => inc.loud && gameTime - inc.time < 12 && distanceBetween(inc, stay.door) < 380)) {
          stay.until = gameTime + 6;
          continue;
        }
        crowd.indoors.splice(i, 1);
        if (distanceBetween(stay.door, player) > 1700 || pedestrians.length >= CROWD_HARD_CAP) continue;
        for (const p of stay.party) {
          if (p.hp <= 0) continue;
          const leader = p.leader;
          resetWalkerState(p);
          p.leader = leader;
          p.x = stay.door.out.x + randomBetween(-3, 3);
          p.y = stay.door.out.y;
          p.a = p.dir = randomChoice([0, Math.PI]);
          if (stay.why === 'shelter') {
            p.shakenUntil = gameTime + 20;
            crowdSay(p, 'recover', 0.6);
          } else if (stay.why === 'shop' && !p.carry && p.role !== 'kid' && seededRandom() < 0.7)
            p.carry = randomChoice(['shopping', 'shopping', 'coffee']);
          pedestrians.push(p);
        }
      }
    }
    /**
     * RAIN ON THE STREET
     * Ahead of a shower (weather.approach) people look up and remark on it. When
     * it starts (once per shower, `weather.shower`), those with an umbrella open
     * it (crowd3d.js) and walk on; of the rest some duck into the nearest door
     * and wait it out, some run for it and the others hurry, heads down. When it
     * stops someone may say so. Lines go through crowdSay, so the chatter
     * setting and the two-bubble limit apply.
     */
    function rainReaction(p, deltaSeconds) {
      if (p.hp <= 0 || p.react || p.role === 'jogger' || p.military || p.police) return false;
      const near = distanceBetween(p, cameraTarget) < 480;
      if (weather.approach > 0.1 && weather.rain < 0.25 && near && seededRandom() < deltaSeconds * 0.01 * weather.approach) crowdSay(p, 'rainComing');
      if (weather.rain > 0.3 && p.rainShower !== weather.shower) {
        p.rainShower = weather.shower;
        p.rainRun = false;
        if (p.look?.umbrella) {
          if (near) crowdSay(p, 'rainUmbrella', 0.05);
          return false;
        }
        const roll = seededRandom();
        if (near) crowdSay(p, 'rainStart', 0.12);
        if (roll < 0.35 && (p.state === 'walk' || p.state === 'idle' || p.state === 'phone')) {
          const door = doorNear(p, 200);
          if (door && !/hospital|school|guns/.test(door.place?.kind || '')) {
            p.state = 'enter';
            p.enterDoor = door;
            p.atDoorFront = false;
            p.rainShelter = true;
            p.walking = true;
            return true;
          }
        }
        p.rainRun = roll < 0.75;
      }
      if (weather.rain < 0.12 && p.rainRun) {
        p.rainRun = false;
        if (near) crowdSay(p, 'rainStop', 0.08);
      }
      return false;
    }
    function updateStreetWalker(p, deltaSeconds) {
      const tempo = crowd.tempo;
      p.timer -= deltaSeconds;
      p.pose = null;
      if (!p.leader && rainReaction(p, deltaSeconds)) return;
      // Walking pairs: the follower keeps a shoulder offset from the leader.
      if (p.leader) {
        const leader = p.leader;
        if (leader.hp <= 0 || personIncapacitated(leader) || !pedestrians.includes(leader)) {
          p.leader = null;
          if (leader.hp <= 0) startReaction(p, 'gasp', 1.4, leader, null, { then: 'flee' });
          return;
        }
        const side = p.pairSide || 1,
          gap = p.role === 'kid' ? 7 : 9,
          tx = leader.x + Math.cos(leader.a + Math.PI / 2) * gap * side,
          ty = leader.y + Math.sin(leader.a + Math.PI / 2) * gap * side,
          d = Math.hypot(tx - p.x, ty - p.y);
        p.sitting = false;
        p.walking = d > 2;
        p.pose = ['chat', 'phone', 'idle', 'sit', 'wait'].includes(leader.pose) || !leader.walking ? 'idle' : null;
        if (d > 2) {
          const speed = Math.min((p.role === 'kid' ? 14 : 12) * KMH, 4.5 * KMH + d * 1.2);
          crowdStep(p, Math.atan2(ty - p.y, tx - p.x), speed, deltaSeconds);
        } else p.a += normalizeAngle(leader.a - p.a) * Math.min(1, deltaSeconds * 5);
        return;
      }
      if (p.state === 'idle' || p.state === 'shop' || p.state === 'phone') {
        p.stateTime -= deltaSeconds;
        p.walking = false;
        p.pose = p.state === 'phone' ? 'phone' : p.texting ? 'text' : 'idle';
        if (p.state === 'idle' && seededRandom() < deltaSeconds * 0.08) pedSay(p, 'idle');
        if (p.state === 'phone' && seededRandom() < deltaSeconds * 0.18) crowdSay(p, 'phoneTalk');
        if (p.state === 'idle' && seededRandom() < deltaSeconds * 0.4) p.a += (seededRandom() - 0.5) * 0.6;
        if (p.stateTime <= 0) {
          p.state = 'walk';
          p.walking = true;
          p.a = p.dir = snapAxis(p.a);
          p.timer = randomBetween(4, 10);
        }
        return;
      }
      if (p.state === 'chat') {
        p.stateTime -= deltaSeconds;
        p.walking = false;
        p.pose = 'chat';
        const other = p.chatWith;
        if (other && other.hp > 0 && other.state === 'chat') faceToward(p, other, deltaSeconds);
        if (seededRandom() < deltaSeconds * 0.22) crowdSay(p, 'chat');
        if (p.stateTime <= 0 || !other || other.state !== 'chat' || other.hp <= 0) {
          p.state = 'walk';
          p.chatWith = null;
          p.a = p.dir ?? snapAxis(p.a);
          p.timer = randomBetween(4, 10);
        }
        return;
      }
      if (p.state === 'enter') {
        const door = p.enterDoor;
        if (!door) {
          p.state = 'walk';
          return;
        }
        if (!p.atDoorFront && distanceBetween(p, door.out) < 5) p.atDoorFront = true;
        const target = p.atDoorFront ? door : door.out;
        if (p.atDoorFront && distanceBetween(p, door) < 4) {
          p.atDoorFront = false;
          goIndoors(p, door, p.rainShelter ? randomBetween(40, 120) : randomBetween(18, 75), p.rainShelter ? 'rain' : 'shop');
          p.rainShelter = false;
          return;
        }
        if (crowdStep(p, headingBetween(p, target), walkerSpeed(p) * 0.8, deltaSeconds)) {
          p.blocked = (p.blocked || 0) + deltaSeconds;
          if (p.blocked > 2.5 && !p.atDoorFront) {
            p.state = 'walk';
            p.blocked = 0;
          } else if (p.blocked > 1 && p.atDoorFront) {
            // The door is flush with the wall: arriving against it counts.
            p.atDoorFront = false;
            p.blocked = 0;
            goIndoors(p, door, p.rainShelter ? randomBetween(40, 120) : randomBetween(18, 75), p.rainShelter ? 'rain' : 'shop');
            p.rainShelter = false;
          }
        }
        return;
      }
      if (p.state === 'toBench') {
        const spot = p.bench;
        if (!spot || (spot.taken && spot.taken !== p)) {
          p.state = 'walk';
          p.bench = null;
          return;
        }
        if (distanceBetween(p, spot) < 4) {
          Object.assign(p, { state: 'sit', sitting: true, walking: false, a: spot.a, x: spot.x, y: spot.y });
          p.stateTime = randomBetween(9, 24);
        } else if (crowdStep(p, headingBetween(p, spot), 24, deltaSeconds)) {
          p.state = 'walk';
          spot.taken = null;
          p.bench = null;
        }
        return;
      }
      if (p.state === 'sit') {
        p.stateTime -= deltaSeconds;
        p.pose = 'sit';
        p.walking = false;
        if (seededRandom() < deltaSeconds * 0.05) pedSay(p, 'idle');
        if (p.stateTime <= 0) {
          p.sitting = false;
          p.walking = true;
          p.state = 'walk';
          if (p.bench) p.bench.taken = null;
          p.bench = null;
          p.a = p.dir = randomChoice([0, Math.PI]);
          p.timer = randomBetween(5, 12);
        }
        return;
      }
      if (p.timer < 0) {
        p.timer = randomBetween(5, 12);
        const roll = seededRandom(),
          wet = weather.rain > 0.3 ? 0.4 : 1;
        if (p.role === 'jogger') {
          if (roll > 0.9) p.dir = snapAxis((p.dir ?? p.a) + Math.PI);
        } else {
          if (roll < tempo.idle * wet) {
            p.state = seededRandom() < 0.3 ? 'phone' : 'idle';
            p.stateTime = randomBetween(2.5, p.state === 'phone' ? 12 : 6);
            p.walking = false;
            return;
          }
          if (roll < tempo.shop) {
            const door = crowd.hour > 7 && crowd.hour < 21.5 && seededRandom() < 0.45 ? doorNear(p, 60) : null;
            if (door && !/hospital|school|guns/.test(door.place?.kind || '')) {
              p.state = 'enter';
              p.enterDoor = door;
              p.atDoorFront = false;
              return;
            }
            if (shopfrontNear(p)) {
              p.state = 'shop';
              p.stateTime = randomBetween(3, 7);
              p.a = -Math.PI / 2;
              p.walking = false;
              return;
            }
          }
          if (roll < tempo.bench * wet) {
            const spot = nearestFreeBench(p, 160);
            if (spot) {
              spot.taken = p;
              p.bench = spot;
              p.state = 'toBench';
              return;
            }
          }
          if (roll > 0.88) p.dir = snapAxis((p.dir ?? p.a) + Math.PI);
        }
      }
      walkSidewalk(p, deltaSeconds);
    }
    /* The actual stride along the grid: lanes, corners, kerbs and overtaking. */
    function walkSidewalk(p, deltaSeconds) {
      const dir = snapAxis(p.dir ?? p.a);
      p.dir = dir;
      const vertical = Math.abs(Math.sin(dir)) > 0.5,
        sign = vertical ? Math.sign(Math.sin(dir)) : Math.sign(Math.cos(dir)),
        v = vertical ? p.y : p.x,
        next = nextCrossing(vertical ? ROAD_ROWS : ROAD_CENTERS, v, sign),
        remaining = Math.abs((next ?? 1e6) - v),
        beside = vertical ? roadNear(p.x) : rowNear(p.y),
        lateral = (vertical ? p.x : p.y) - beside,
        crossOff = next !== undefined ? sidewalkOffset(next, !vertical) : 67,
        // Walking down the middle of the road they run alongside (knocked or
        // shoved off the kerb, dodged a car, turned a corner short): steer back
        // onto the pavement instead of carrying on along the lane, where traffic
        // stopped for them and they stood blocked by the traffic, for ever.
        strayed =
          inCityGrid(p.x, p.y) && Math.abs(lateral) <= 40 && remaining > crossOff + 25 && cityStreetAt(p.x, p.y),
        onWalk = strayed || (inCityGrid(p.x, p.y) && Math.abs(lateral) > 40 && Math.abs(lateral) < 100);
      let speed = walkerSpeed(p);
      // Corners: decide once per junction whether to carry straight on or turn
      // onto the cross street (turning away from the road, so no crossing).
      if (onWalk && next !== undefined && remaining < 120) {
        const key = next * 4 + sign;
        if (p.cornerKey !== key) {
          p.cornerKey = key;
          p.turnPlan = seededRandom() < (p.role === 'jogger' ? 0.25 : 0.38) ? Math.sign(lateral) : 0;
        }
        if (p.turnPlan && remaining <= crossOff + 1) {
          const turned = vertical ? (p.turnPlan > 0 ? 0 : Math.PI) : p.turnPlan > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (!solid(p.x + Math.cos(turned) * 22, p.y + Math.sin(turned) * 22, 5)) p.dir = turned;
          p.turnPlan = 0;
          return;
        }
        // The kerb: wait for the walk signal, then glance and go.
        if (!p.turnPlan && remaining > crossOff + 3 && remaining < crossOff + 21 && !(p.shakenUntil > gameTime)) {
          const signal = trafficSignal(roadNear(p.x), rowNear(p.y))[vertical ? 'vertical' : 'horizontal'];
          if (signal !== 'green') {
            p.walking = false;
            p.waiting = true;
            p.pose = p.texting ? 'text' : 'wait';
            p.a += normalizeAngle(dir - p.a) * Math.min(1, deltaSeconds * 6);
            return;
          }
          if (p.waiting) {
            p.waiting = false;
            p.glanceUntil = gameTime + 0.9;
          }
        }
        // Caught mid-crossing by the change: hurry.
        if (remaining < crossOff - 10 && remaining > 20) {
          const signal = trafficSignal(roadNear(p.x), rowNear(p.y))[vertical ? 'vertical' : 'horizontal'];
          if (signal !== 'green') speed *= 1.6;
        }
      }
      p.waiting = false;
      // Keep right: hold a lane offset from the sidewalk centre, and step out
      // further to pass someone slow or standing in the way.
      let lateralSpeed = 0;
      if (onWalk) {
        const centre = beside + Math.sign(lateral || 1) * sidewalkOffset(beside, vertical),
          right = vertical ? -Math.sin(dir) : Math.cos(dir),
          pass = p.passUntil > gameTime ? p.passSide * 10 : 0,
          targetLateral = centre + right * clamp((p.lane || 5) + pass, -12, 14),
          error = targetLateral - (vertical ? p.x : p.y);
        lateralSpeed = clamp(error * 2.5, -speed * 0.45, speed * 0.45);
      }
      if (p.tipsy) lateralSpeed += Math.sin(gameTime * 1.7 + (p.walk || 0) * 0.3) * speed * 0.3;
      const vx = Math.cos(dir) * speed + (vertical ? lateralSpeed : 0),
        vy = Math.sin(dir) * speed + (vertical ? 0 : lateralSpeed),
        heading = Math.atan2(vy, vx),
        pace = Math.hypot(vx, vy);
      p.pose = p.texting ? 'text' : p.dog ? 'leash' : null;
      if (crowdStep(p, heading, pace, deltaSeconds)) {
        p.blocked = (p.blocked || 0) + deltaSeconds;
        if (p.blocked > 0.35) {
          const a = dir + (Math.PI / 2) * (p.passSide || 1);
          if (!solid(p.x + Math.cos(a) * 15, p.y + Math.sin(a) * 15, 7))
            moveBody(p, Math.cos(a) * speed * deltaSeconds, Math.sin(a) * speed * deltaSeconds, 5);
          if (p.blocked > 2) {
            p.dir = snapAxis(dir + Math.PI);
            p.blocked = 0;
          }
        }
      } else p.blocked = 0;
    }
    /* A few times a second: overtake slow walkers, and now and then stop to chat. */
    function crowdEncounters(deltaSeconds) {
      crowd.timers.chat -= deltaSeconds;
      if (crowd.timers.chat > 0) return;
      crowd.timers.chat = 0.3;
      for (const cell of crowd.grid.values())
        for (const p of cell) {
          if (p.state !== 'walk' || p.react || p.leader || p.flee > 0 || p.hp <= 0 || p.scene) continue;
          const dir = p.dir ?? p.a,
            c = Math.cos(dir),
            s = Math.sin(dir);
          forPeopleNear(p.x + c * 10, p.y + s * 10, 10, (q) => {
            if (q === p || q.leader === p || p.passUntil > gameTime) return;
            const along = (q.x - p.x) * c + (q.y - p.y) * s,
              side = -(q.x - p.x) * s + (q.y - p.y) * c;
            if (along < 2 || along > 16 || Math.abs(side) > 6) return;
            const facing = Math.cos((q.dir ?? q.a) - dir);
            // Two walkers meeting head on occasionally know each other.
            if (
              facing < -0.8 &&
              q.state === 'walk' &&
              !q.react &&
              !q.leader &&
              !q.scene &&
              !(q.flee > 0) &&
              crowd.tempo.idle > 0.07 &&
              seededRandom() < 0.035
            ) {
              for (const [a, b] of [
                [p, q],
                [q, p],
              ]) {
                a.state = 'chat';
                a.chatWith = b;
                a.stateTime = randomBetween(8, 18);
                a.walking = false;
              }
              crowdSay(p, 'chat');
              return;
            }
            if (facing > 0.5 || !q.walking) {
              p.passUntil = gameTime + 1.3;
              p.passSide = side > 0 ? -1 : 1;
            }
          });
        }
    }

    /**
     * PERCEPTION
     * An incident (a shot, a blast, a crash, a person hit by a car, a body) is
     * heard and seen outward from where it happened. Each person within reach
     * decides whether they perceived it: gunfire and explosions are heard by
     * everyone in range, the rest must be seen (building-aware line of sight) or
     * be very close. The reaction is scheduled after a delay that grows with
     * distance, so a shot sends a visible ripple through a street instead of
     * flipping everyone at once. Someone staring at their phone is slower.
     */
    const ALARM_REACH = { gunfire: 560, explosion: 950, crash: 380, knock: 300, melee: 170, body: 150 };
    function crowdIncident(kind, source, attacker, severity = 1) {
      const loud = kind === 'gunfire' || kind === 'explosion';
      // Merge repeats: an automatic burst is one incident, not thirty.
      let inc = crowd.incidents.find(
        (i) => i.kind === kind && gameTime - i.time < (loud ? 1.6 : 3) && Math.hypot(i.x - source.x, i.y - source.y) < 90,
      );
      if (inc) {
        inc.time = gameTime;
        inc.x = source.x;
        inc.y = source.y;
        inc.severity = Math.max(inc.severity, severity);
        inc.shots++;
        if (attacker) inc.attacker = attacker;
        return inc;
      }
      inc = {
        id: crowd.incidentId++,
        kind,
        x: source.x,
        y: source.y,
        time: gameTime,
        start: gameTime,
        attacker,
        severity,
        loud,
        callers: 0,
        filmers: 0,
        watchers: 0,
        helpers: 0,
        spread: 0,
        shots: 1,
        reported: false,
        focus: kind === 'body' || kind === 'knock' ? source : null,
      };
      crowd.incidents.push(inc);
      if (crowd.incidents.length > 32) crowd.incidents.shift();
      return inc;
    }
    function crowdAlarm(kind, source, attacker = null, severity = 1) {
      if (!source) return null;
      const inc = crowdIncident(kind, source, attacker, severity);
      if (attacker === player && (kind === 'gunfire' || kind === 'explosion')) crowd.playerShotAt = gameTime;
      const reach = ALARM_REACH[kind] * (kind === 'crash' ? clamp(severity, 0.6, 1.4) : 1),
        nearPlayer = Math.abs(source.x - player.x) < 1100 && Math.abs(source.y - player.y) < 1100;
      const perceive = (p, d) => {
        if (p.hp <= 0 || p === attacker || p === source || personIncapacitated(p)) return;
        if (p.onDeck) {
          // Deck passengers keep their old, simpler panic.
          p.flee = 8;
          p.threat = { x: source.x, y: source.y };
          return;
        }
        const sees = d < Math.min(reach, 460) && crowdSight(p, source);
        if (!inc.loud && !sees && d > 90) return;
        const delay = 0.06 + d / 1700 + seededRandom() * (p.texting || p.onPhone ? 0.7 : 0.25);
        if (p.pending && p.pending.inc === inc) return;
        p.pending = { inc, at: gameTime + delay, sees, d };
        if (sees && attacker === player) p.sawPlayerAt = gameTime;
      };
      if (nearPlayer) forPeopleNear(source.x, source.y, reach, perceive);
      else
        for (const p of pedestrians) {
          const d = Math.hypot(p.x - source.x, p.y - source.y);
          if (d <= reach) perceive(p, d);
        }
      return inc;
    }
    /* Where the danger is, as this person understands it. */
    function perceivedSource(inc, sees, d) {
      if (sees || d < 120) return { x: inc.x, y: inc.y };
      return { x: inc.x + randomBetween(-1, 1) * d * 0.3, y: inc.y + randomBetween(-1, 1) * d * 0.3 };
    }
    /**
     * CHOOSING A REACTION
     * The same shot produces different people: most near it drop and cover
     * their heads, some freeze, some run for the nearest doorway, the rest run.
     * Further out a few brave (or foolish) ones film it or call it in, one might
     * shout at the shooter, and at the edge of hearing people just stop and ask
     * each other what that was. Crashes and bodies draw onlookers instead.
     */
    function decideReaction(p, pending) {
      const { inc, sees, d, contagion } = pending;
      if (p.hp <= 0 || personIncapacitated(p) || !inc) return;
      const cur = p.react?.kind,
        nerve = p.nerve ?? 0.5,
        r = seededRandom(),
        guess = perceivedSource(inc, sees, d);
      if (contagion) {
        if (cur) return;
        if (r < 0.55) startReaction(p, 'flee', randomBetween(3.5, 6), guess, inc, { scream: r < 0.15 });
        else if (r < 0.82) startReaction(p, 'startle', randomBetween(0.5, 1.1), guess, inc, { then: 'hurry' });
        else startReaction(p, 'cower', randomBetween(1, 2.2), guess, inc, { then: 'flee' });
        return;
      }
      if (inc.kind === 'gunfire' || inc.kind === 'explosion' || inc.kind === 'melee') {
        const boom = inc.kind === 'explosion';
        if (cur === 'flee' || cur === 'shelter') {
          p.react.dur = Math.max(p.react.dur, p.react.t + 7);
          p.react.from = guess;
          return;
        }
        if (['cower', 'freeze', 'handsUp', 'kneel', 'groan', 'dodge'].includes(cur)) {
          p.react.dur = Math.max(p.react.dur, p.react.t + 1.5);
          return;
        }
        const close = d < (boom ? 330 : 170) || (sees && d < 240);
        if (['film', 'call', 'watch', 'shout', 'point'].includes(cur) && !close) return;
        let door;
        if (close) {
          if (r < 0.42) startReaction(p, 'cower', randomBetween(1.3, 3.2), guess, inc, { then: 'flee' });
          else if (r < 0.56) startReaction(p, 'freeze', randomBetween(0.8, 2), guess, inc, { then: 'flee' });
          else if (r < 0.74 && (door = doorNear(p, 110))) startReaction(p, 'shelter', 25, guess, inc, { door });
          else startReaction(p, 'flee', randomBetween(5, 8), guess, inc, { scream: true });
          return;
        }
        if (sees || d < 330) {
          if (nerve > 0.9 && inc.callers < 1 && inc.attacker) startReaction(p, 'call', randomBetween(8, 11), guess, inc);
          else if (nerve > 0.78 && inc.filmers < 2 && sees) startReaction(p, 'film', randomBetween(7, 13), guess, inc, { then: 'hurry' });
          else if (nerve > 0.95 && sees && d < 300 && inc.attacker === player)
            startReaction(p, 'shout', 1.8, guess, inc, { then: 'flee' });
          else if (r < 0.3 && (door = doorNear(p, 90))) startReaction(p, 'shelter', 25, guess, inc, { door });
          else if (r < 0.55) startReaction(p, 'cower', randomBetween(0.7, 1.6), guess, inc, { then: 'flee' });
          else startReaction(p, 'flee', randomBetween(4, 7), guess, inc, { scream: r > 0.85 });
          return;
        }
        // At the edge of hearing: stop, look, decide.
        if (r < (boom ? 0.5 : 0.22)) startReaction(p, 'flee', randomBetween(3.5, 6), guess, inc);
        else if (nerve > 0.82 && inc.callers < 2 && inc.attacker) startReaction(p, 'call', randomBetween(8, 10), guess, inc);
        else {
          startReaction(p, 'startle', randomBetween(0.7, 1.3), guess, inc, { then: 'hurry' });
          crowdSay(p, boom ? 'boom' : 'heard', 0.5);
        }
        return;
      }
      if (inc.kind === 'crash' || inc.kind === 'knock' || inc.kind === 'body') {
        if (cur && !['startle', 'hurry'].includes(cur)) return;
        // A crowd forms, but only so big: past a dozen, newcomers look and move on.
        let gathered = 0;
        for (const other of crowd.incidents)
          if (Math.abs(other.x - inc.x) < 260 && Math.abs(other.y - inc.y) < 260) gathered += other.watchers + other.filmers;
        const severe = inc.severity > 1.1 || inc.kind !== 'crash',
          victim = inc.focus,
          helping = inc.kind === 'knock' && victim && victim.hp > 0 && nerve > 0.55 && inc.helpers < 1,
          then = helping
            ? 'help'
            : r < 0.52 && inc.watchers < 8 && gathered < 12
              ? 'watch'
              : r < 0.66 && severe && inc.callers < 1 && (inc.attacker || inc.kind !== 'crash')
                ? 'call'
                : r < 0.74 && inc.filmers < 2 && gathered < 14
                  ? 'film'
                  : 'hurry';
        startReaction(p, inc.kind === 'crash' && d > 90 ? 'startle' : 'gasp', randomBetween(0.8, 1.5), guess, inc, { then });
        if (inc.kind !== 'crash') crowdSay(p, 'gasp', 0.5);
      }
    }
    function reactionDuration(kind) {
      return (
        {
          flee: randomBetween(4.5, 7),
          watch: randomBetween(12, 28),
          call: randomBetween(8, 11),
          film: randomBetween(7, 13),
          fist: randomBetween(1.8, 3),
          help: randomBetween(12, 22),
          argue: randomBetween(8, 13),
          returnCar: 20,
          cower: randomBetween(1, 2),
        }[kind] || 2
      );
    }
    const REACTION_LINES = {
      cower: ['cower', 0.4],
      flee: ['flee', 0.3],
      film: ['film', 0.7],
      shout: ['shout', 1],
      fist: ['fist', 0.9],
      help: ['helper', 0.8],
      argue: ['angryDriver', 1],
    };
    /* Incidents count their callers, filmers, watchers and helpers while they last. */
    const ROLE_COUNTS = { call: 'callers', film: 'filmers', watch: 'watchers', help: 'helpers' };
    function releaseReactionRole(p) {
      const r = p.react,
        key = r && ROLE_COUNTS[r.kind];
      if (key && r.inc && !r.released) {
        r.released = true;
        r.inc[key] = Math.max(0, r.inc[key] - 1);
      }
    }
    function startReaction(p, kind, dur, from, inc, extra = {}) {
      releaseReactionRole(p);
      if (kind === 'hurry') return settleAfterReaction(p, from);
      if (p.bench) p.bench.taken = null;
      p.bench = null;
      if (p.state !== 'walk' && p.state !== 'sit') p.state = 'walk';
      if (p.state === 'sit') p.state = 'walk';
      p.sitting = false;
      p.chatWith = null;
      p.onPhone = false;
      p.waiting = false;
      if (p.scene) leaveScene(p);
      p.react = {
        kind,
        t: 0,
        dur,
        from: from ? { x: from.x, y: from.y } : p.react?.from || null,
        inc: inc || null,
        ...extra,
      };
      p.flee = Math.max(p.flee || 0, 1);
      if (from) p.threat = { x: from.x, y: from.y };
      if (inc && ROLE_COUNTS[kind]) inc[ROLE_COUNTS[kind]]++;
      const line = REACTION_LINES[kind];
      if (line) crowdSay(p, line[0], line[1]);
      if (extra.scream || (kind === 'cower' && seededRandom() < 0.25)) scream(p);
      // Companions do what their partner does rather than walking on alone.
      if (['flee', 'cower', 'freeze', 'shelter'].includes(kind))
        for (const q of pedestrians)
          if (q.leader === p) {
            q.leader = null;
            startReaction(q, kind === 'shelter' ? 'flee' : kind, dur + randomBetween(-0.3, 0.6), from, inc);
          }
    }
    /* Back to ordinary life, a little shaken, heading away from whatever it was. */
    function settleAfterReaction(p, from) {
      releaseReactionRole(p);
      p.react = null;
      p.flee = 0;
      p.pose = null;
      p.onPhone = false;
      p.state = 'walk';
      p.timer = randomBetween(6, 12);
      p.shakenUntil = gameTime + randomBetween(12, 25);
      if (from) p.dir = snapAxis(headingBetween(from, p));
      else p.dir = snapAxis(p.a);
      if (p.sceneHome && !p.scene) rejoinScene(p);
    }
    function endReaction(p) {
      const r = p.react;
      releaseReactionRole(p);
      p.react = null;
      if (r.kind === 'groan') p.injured = true;
      if (r.kind === 'handsUp' || r.kind === 'kneel') {
        startReaction(p, 'flee', randomBetween(5, 9), player, r.inc);
        return;
      }
      if (r.then && r.then !== 'hurry') {
        startReaction(p, r.then, reactionDuration(r.then), r.from, r.inc, r.thenExtra || {});
        return;
      }
      // Once clear, plenty of people stop and look back at what they ran from.
      if (r.kind === 'flee' && r.from && distanceBetween(p, r.from) > 200 && seededRandom() < 0.5) {
        const call = (p.nerve ?? 0.5) > 0.65 && r.inc?.attacker && r.inc.callers < 2 && seededRandom() < 0.4;
        startReaction(p, call ? 'call' : 'lookBack', call ? reactionDuration('call') : randomBetween(3, 7), r.from, r.inc, {
          filming: seededRandom() < 0.25,
        });
        return;
      }
      if (['flee', 'shelter', 'cower', 'freeze', 'film', 'call'].includes(r.kind) && seededRandom() < 0.3)
        crowdSay(p, 'recover', 1);
      settleAfterReaction(p, r.from);
    }
    /**
     * FLEEING ALONG THE STREET
     * Running away is not a straight line through walls. On the grid people run
     * along sidewalks, choosing whichever of the four street directions takes
     * them furthest from the danger; they turn at corners, and they will not
     * sprint across a road with traffic bearing down on the crossing — they take
     * the corner instead. Off the grid (parks, quays) they steer around
     * obstacles by probing a fan of headings.
     */
    function crossingUnsafe(x, y) {
      for (const c of vehicles) {
        if (c.hp <= 0 || Math.abs(c.x - x) > 190 || Math.abs(c.y - y) > 190) continue;
        if (isAircraft(c) || isBoat(c)) continue;
        const speed = Math.hypot(c.vx || 0, c.vy || 0);
        if (speed < 25) continue;
        const toward = (x - c.x) * (c.vx || 0) + (y - c.y) * (c.vy || 0);
        if (toward > 0 && Math.hypot(x - c.x, y - c.y) < 60 + speed * 1.1) return true;
      }
      return false;
    }
    function chooseFleeHeading(p, r) {
      const away = headingBetween(r.from || player, p);
      if (!inCityGrid(p.x, p.y)) {
        for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) {
          const a = away + off;
          if (!solid(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, 5)) return a;
        }
        return away + Math.PI;
      }
      const R = roadNear(p.x),
        C = rowNear(p.y),
        onVertical = Math.abs(p.x - R) > 36 && Math.abs(p.x - R) < 100,
        onHorizontal = Math.abs(p.y - C) > 36 && Math.abs(p.y - C) < 100,
        inRoad = crowdOnRoad(p.x, p.y);
      // Already out in the road: finish crossing in the direction already chosen.
      if (inRoad && r.fleeDir !== undefined) return r.fleeDir;
      let best = null,
        bestScore = -Infinity;
      for (const dir of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const vertical = Math.abs(Math.sin(dir)) > 0.5,
          cx = Math.cos(dir),
          cy = Math.sin(dir);
        if (solid(p.x + cx * 20, p.y + cy * 20, 5)) continue;
        let score = Math.cos(dir - away);
        const parallel = vertical ? onVertical : onHorizontal;
        if (!parallel) {
          // Leaving the sidewalk sideways means stepping into the road.
          const crossX = vertical ? p.x : R,
            crossY = vertical ? C : p.y;
          if (crowdOnRoad(p.x + cx * 30, p.y + cy * 30)) {
            if (crossingUnsafe(crossX, crossY)) score -= 1.6;
            else score -= 0.25;
          }
        } else {
          // Running along the sidewalk toward a crossing: is the crossing clear?
          const next = nextCrossing(vertical ? ROAD_ROWS : ROAD_CENTERS, vertical ? p.y : p.x, vertical ? Math.sign(cy) : Math.sign(cx));
          if (next !== undefined && Math.abs(next - (vertical ? p.y : p.x)) < 110) {
            const qx = vertical ? p.x : next,
              qy = vertical ? next : p.y;
            if (crossingUnsafe(qx, qy)) score -= 1.2;
          }
        }
        if (r.fleeDir !== undefined && Math.abs(normalizeAngle(dir - r.fleeDir)) < 0.1) score += 0.3;
        if (score > bestScore) {
          bestScore = score;
          best = dir;
        }
      }
      return best ?? away;
    }
    function fleeStep(p, deltaSeconds, r) {
      const attacker = r.inc?.attacker;
      // Keep track of a visible attacker: the danger moves.
      if (attacker && attacker.hp > 0 && (r.track || 0) <= 0) {
        r.track = 0.8;
        if (distanceBetween(p, attacker) < 420 && crowdSight(p, attacker)) r.from = { x: attacker.x, y: attacker.y };
      }
      r.track = (r.track || 0) - deltaSeconds;
      r.choose = (r.choose || 0) - deltaSeconds;
      if (r.choose <= 0 || r.fleeDir === undefined) {
        r.choose = 0.4;
        r.fleeDir = chooseFleeHeading(p, r);
      }
      let heading = r.fleeDir;
      // On a sidewalk, run down its middle rather than along the building line.
      if (inCityGrid(p.x, p.y) && !crowdOnRoad(p.x, p.y)) {
        const vertical = Math.abs(Math.sin(heading)) > 0.5,
          beside = vertical ? roadNear(p.x) : rowNear(p.y),
          lateral = (vertical ? p.x : p.y) - beside;
        if (Math.abs(lateral) > 36 && Math.abs(lateral) < 100) {
          const centre = beside + Math.sign(lateral || 1) * sidewalkOffset(beside, vertical),
            error = centre - (vertical ? p.x : p.y),
            correction = clamp(error * 0.03, -0.35, 0.35);
          heading += vertical ? -correction * Math.sign(Math.sin(heading)) : correction * Math.sign(Math.cos(heading));
        }
      }
      // Running for it: 17-21 km/h for most, slower for the old, the young and the hurt.
      const top = (p.injured ? 7 : p.role === 'elder' ? 10 : p.role === 'kid' ? 13 : 17 + (p.nerve || 0) * 2.5) * KMH,
        speed = top * clamp(r.t / 0.35, 0.35, 1);
      if (crowdStep(p, heading, speed, deltaSeconds)) {
        r.stuck = (r.stuck || 0) + deltaSeconds;
        if (r.stuck > 0.5) {
          r.fleeDir = normalizeAngle(r.fleeDir + (seededRandom() < 0.5 ? 1 : -1) * Math.PI / 2);
          r.choose = 0.8;
          r.stuck = 0;
        }
      } else r.stuck = 0;
      p.pose = p.injured ? 'limp' : 'run';
      // Panic is contagious: people who see others running start running.
      r.spreadIn = (r.spreadIn ?? 0.2) - deltaSeconds;
      if (r.spreadIn <= 0 && r.t < 4 && r.inc && r.inc.spread < 90) {
        r.spreadIn = 0.6;
        forPeopleNear(p.x, p.y, 75, (q) => {
          if (q.react || q.pending || q.hp <= 0 || q.onDeck || personIncapacitated(q)) return;
          q.pending = {
            inc: r.inc,
            at: gameTime + randomBetween(0.25, 0.75),
            sees: false,
            d: distanceBetween(q, r.inc),
            contagion: true,
          };
          r.inc.spread++;
        });
      }
      if (seededRandom() < deltaSeconds * 0.25) crowdSay(p, 'flee', 0.5);
    }
    /* Onlookers keep a ring around what they are looking at, off the carriageway. */
    function watchFrom(p, r, focus, ringMin, ringMax, deltaSeconds) {
      if (!r.spot) {
        const a = headingBetween(focus, p) + randomBetween(-0.5, 0.5),
          ring = randomBetween(ringMin, ringMax);
        r.spot = snapToSidewalk(focus.x + Math.cos(a) * ring, focus.y + Math.sin(a) * ring);
        if (solid(r.spot.x, r.spot.y, 5)) r.spot = { x: p.x, y: p.y };
      }
      const d = distanceBetween(p, r.spot);
      if (d > 5) {
        if (crowdStep(p, headingBetween(p, r.spot), d > 60 ? 40 : 26, deltaSeconds)) {
          r.stuckWatch = (r.stuckWatch || 0) + deltaSeconds;
          if (r.stuckWatch > 1.2) r.spot = { x: p.x, y: p.y };
        }
        p.pose = null;
        return false;
      }
      p.walking = false;
      faceToward(p, focus, deltaSeconds, 4);
      return true;
    }

    /**
     * RUNNING A REACTION
     * One branch per reaction. Each sets the pose the renderer shows and moves
     * the person if the reaction moves them; `dur` ends it, and `then` chains
     * the next (cover → run, gasp → watch, dodge → shake a fist).
     */
    function updateReaction(p, deltaSeconds) {
      const r = p.react;
      r.t += deltaSeconds;
      p.flee = Math.max(0.5, r.dur - r.t + 0.5);
      p.sitting = false;
      p.walking = false;
      const from = r.from || p.threat || player;
      switch (r.kind) {
        case 'startle':
          p.pose = 'startle';
          faceToward(p, from, deltaSeconds, 9);
          break;
        case 'cower':
          p.pose = 'cower';
          if (seededRandom() < deltaSeconds * 0.3) crowdSay(p, 'cower', 0.4);
          break;
        case 'freeze':
          p.pose = 'freeze';
          faceToward(p, from, deltaSeconds, 5);
          break;
        case 'flee':
          fleeStep(p, deltaSeconds, r);
          break;
        case 'shelter': {
          const door = r.door;
          if (!door) {
            r.kind = 'flee';
            break;
          }
          p.pose = 'run';
          if (!r.atFront && distanceBetween(p, door.out) < 6) r.atFront = true;
          const target = r.atFront ? door : door.out;
          const blocked = crowdStep(p, headingBetween(p, target), 70, deltaSeconds);
          if ((r.atFront && (distanceBetween(p, door) < 5 || blocked)) || r.t > 12) {
            if (r.t > 12 && !r.atFront) {
              r.kind = 'flee';
              break;
            }
            goIndoors(p, door, randomBetween(25, 60), 'shelter');
            return true;
          }
          break;
        }
        case 'film': {
          p.pose = 'film';
          faceToward(p, from, deltaSeconds, 4);
          const threat = r.inc?.attacker;
          if (threat && threat.hp > 0 && distanceBetween(p, threat) < 110) {
            startReaction(p, 'flee', randomBetween(6, 9), threat, r.inc, { scream: true });
            return true;
          }
          if (seededRandom() < deltaSeconds * 0.12) crowdSay(p, 'film', 1);
          break;
        }
        case 'call': {
          p.pose = 'phone';
          p.onPhone = true;
          const threat = r.inc?.attacker;
          if (threat && threat.hp > 0 && distanceBetween(p, threat) < 100) {
            startReaction(p, 'flee', randomBetween(6, 9), threat, r.inc, { scream: true });
            return true;
          }
          // Turned half away, the way people talk on the phone about something.
          faceToward(p, from, deltaSeconds, 2);
          if (!r.opened && r.t > 0.8) {
            r.opened = true;
            const street = streetNameAt(p.x, p.y);
            p.speech =
              (r.inc?.kind === 'gunfire'
                ? 'Police? Shots fired'
                : r.inc?.kind === 'body'
                  ? 'Police? Someone’s dead'
                  : r.inc?.kind === 'crash' || r.inc?.kind === 'knock'
                    ? '911? There’s been an accident'
                    : 'Police? Send someone') + (street ? ' on ' + street.split(' & ')[0] : '') + '!';
            p.speechUntil = gameTime + 3.2;
          }
          if (!r.reported && r.t > 5.5) {
            r.reported = true;
            crowdReport(p, r.inc);
          }
          break;
        }
        case 'lookBack': {
          p.pose = r.filming ? 'film' : r.t % 5 < 1.1 ? 'despair' : 'watch';
          faceToward(p, from, deltaSeconds, 5);
          const threat = r.inc?.attacker;
          if (threat && threat.hp > 0 && distanceBetween(p, threat) < 170) {
            startReaction(p, 'flee', randomBetween(4, 6), threat, r.inc, { scream: true });
            return true;
          }
          if (seededRandom() < deltaSeconds * 0.1) crowdSay(p, r.inc?.kind === 'explosion' ? 'boom' : 'recover', 1);
          break;
        }
        case 'shout':
          p.pose = 'shout';
          faceToward(p, from, deltaSeconds, 8);
          break;
        case 'point':
          p.pose = 'point';
          faceToward(p, player, deltaSeconds, 8);
          break;
        case 'handsUp':
        case 'kneel': {
          p.pose = r.kind;
          faceToward(p, player, deltaSeconds, 6);
          const aimed = gameTime - (p.aimedAt || -10) < 0.5;
          if (aimed) r.aimTime = (r.aimTime || 0) + deltaSeconds;
          if (r.kind === 'handsUp' && !r.escalated && (r.aimTime || 0) > 3.5) {
            r.escalated = true;
            const roll = seededRandom();
            if (roll < 0.35) {
              r.kind = 'kneel';
              crowdSay(p, 'plead', 1);
            } else if (roll < 0.6 - (p.nerve || 0) * 0.2) {
              startReaction(p, 'flee', randomBetween(6, 10), player, null, { scream: true });
              return true;
            }
          }
          if (seededRandom() < deltaSeconds * 0.2) crowdSay(p, r.kind === 'kneel' ? 'plead' : 'handsUp', 0.8);
          // Once the gun is off them for a moment, they go. If the player put it
          // away altogether, they back off relieved rather than run.
          if (gameTime - (p.aimedAt || -10) > (r.kind === 'kneel' ? 2 : 1.3)) {
            if (playerUnarmed()) {
              releaseReactionRole(p);
              p.react = null;
              crowdSay(p, 'relief', 0.9);
              startReaction(p, 'startle', randomBetween(0.6, 1), player, null, { then: 'hurry' });
              return true;
            }
            endReaction(p);
            return true;
          }
          break;
        }
        case 'dodge': {
          p.pose = 'dodge';
          if (r.t < 0.42) {
            const speed = 55 * (1 - r.t / 0.42) + 10;
            moveBody(p, Math.cos(r.leap) * speed * deltaSeconds, Math.sin(r.leap) * speed * deltaSeconds, 5);
          }
          break;
        }
        case 'fist': {
          p.pose = r.t % 1.6 < 1.1 ? 'fist' : 'shout';
          const car = r.car;
          faceToward(p, car && car.hp > 0 ? car : from, deltaSeconds, 8);
          if (seededRandom() < deltaSeconds * 0.4) crowdSay(p, 'fist', 1);
          break;
        }
        case 'gasp': {
          p.pose = 'gasp';
          faceToward(p, from, deltaSeconds, 6);
          // Backing away from it, a step or two.
          const away = headingBetween(from, p);
          moveBody(p, Math.cos(away) * 9 * deltaSeconds, Math.sin(away) * 9 * deltaSeconds, 5);
          break;
        }
        case 'watch': {
          const focus = r.focusCar || (r.inc?.focus && r.inc.focus.hp !== undefined ? r.inc.focus : r.inc || from),
            body = r.inc?.kind === 'body' || (focus && focus.hp <= 0 && !r.focusCar),
            ring = r.focusCar ? [18, 30] : body ? [45, 85] : [65, 120];
          if (watchFrom(p, r, focus, ring[0], ring[1], deltaSeconds)) {
            r.gesture = (r.gesture ?? randomBetween(2, 6)) - deltaSeconds;
            if (r.gesture < 0) r.gesture = randomBetween(4, 9);
            p.pose = r.gesture < 1.2 ? (body ? 'gasp' : 'despair') : r.filming ? 'film' : 'watch';
            if (r.filming === undefined) r.filming = seededRandom() < 0.18;
            if (seededRandom() < deltaSeconds * 0.1) crowdSay(p, body ? 'bodyWatch' : 'crashWatch', 1);
          }
          break;
        }
        case 'help': {
          const victim = r.inc?.focus;
          if (!victim || !pedestrians.includes(victim) || (victim.hp > 0 && !victim.react && !personIncapacitated(victim))) {
            endReaction(p);
            return true;
          }
          const side = { x: victim.x + Math.cos(victim.a + Math.PI / 2) * 9, y: victim.y + Math.sin(victim.a + Math.PI / 2) * 9 };
          if (distanceBetween(p, side) > 4) {
            p.pose = 'run';
            crowdStep(p, headingBetween(p, side), 55, deltaSeconds);
          } else {
            p.pose = 'help';
            faceToward(p, victim, deltaSeconds, 6);
            if (seededRandom() < deltaSeconds * 0.2) crowdSay(p, victim.hp > 0 ? 'helper' : 'gasp', 1);
          }
          break;
        }
        case 'groan': {
          // Close to the danger and able to: crawl away, leaving a trail
          // (wounds.js); otherwise lie there and writhe.
          const from = r.from || p.threat;
          if (from && p.hp > 5 && r.t < 7 && distanceBetween(p, from) < 260) {
            p.pose = 'crawl';
            crowdStep(p, headingBetween(from, p), 8, deltaSeconds);
          } else p.pose = 'lie';
          if (seededRandom() < deltaSeconds * 0.25) crowdSay(p, 'injured', 1);
          break;
        }
        case 'argue':
          updateArgument(p, r, deltaSeconds);
          break;
        case 'returnCar':
          if (updateReturnToCar(p, r, deltaSeconds)) return true;
          break;
        default:
          p.pose = 'idle';
      }
      if (p.react === r && r.t >= r.dur) endReaction(p);
      return true;
    }
    /**
     * PICKING UP THE PIECES
     * Anybody the older systems marked as fleeing (hit by a car, shot, pulled
     * out of their car) is given a reaction that fits their state: badly hurt
     * people go down and groan, the lightly hurt limp away, the rest run.
     */
    function adoptLegacyFlee(p) {
      const from = p.threat || player;
      if (p.hp < 13) {
        p.injured = true;
        startReaction(p, 'groan', randomBetween(9, 20), from, null, { then: 'hurry' });
        crowdSay(p, 'injured', 1);
        return;
      }
      if (p.hp < 26) p.injured = true;
      startReaction(p, 'flee', Math.max(4, p.flee), from, null);
    }
    /**
     * POSE GALLERY (developer console)
     * Lines up one person per pose in front of the player so every pose can be
     * inspected in a screenshot. Movers walk small circles round their spot.
     */
    const GALLERY_POSES = [
      'idle', 'walk', 'run', 'limp', 'text', 'phone', 'film', 'leash',
      'cower', 'freeze', 'handsUp', 'kneel', 'startle', 'gasp', 'despair', 'watch',
      'shout', 'fist', 'point', 'dodge', 'sit', 'lie', 'help', 'carry',
      'serve', 'strum', 'clap', 'smoke', 'sway', 'wave', 'chat', 'arms',
    ];
    const GALLERY_MOVERS = { walk: 26, run: 70, limp: 14, text: 20, leash: 24, carry: 22 };
    function poseGallery(dressAs) {
      for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].posed) pedestrians.splice(i, 1);
      GALLERY_POSES.forEach((pose, i) => {
        const x = player.x - 175 + (i % 8) * 50,
          y = player.y - 80 + Math.floor(i / 8) * 50;
        const p = { x, y, a: Math.PI / 2, hp: 30, flee: 0, timer: 5, walk: 0, state: 'walk', posed: pose, anchor: { x, y } };
        dressPerson(p, dressAs || (pose === 'leash' ? 'dogWalker' : pickWeighted(crowdRoleWeights(12))));
        if (pose === 'carry') p.carry = 'box';
        if (pose === 'lie') p.injured = true;
        pedestrians.push(p);
      });
      return GALLERY_POSES;
    }
    function updatePosed(p, deltaSeconds) {
      const speed = GALLERY_MOVERS[p.posed] || 0;
      p.pose = p.posed === 'walk' ? null : p.posed;
      p.injured = p.posed === 'limp' || p.posed === 'lie';
      p.sitting = p.posed === 'sit';
      if (speed) {
        const w = speed / 16,
          t = gameTime * w;
        p.x = p.anchor.x + Math.cos(t) * 16;
        p.y = p.anchor.y + Math.sin(t) * 16;
        p.a = t + Math.PI / 2;
        p.walking = true;
        if (p.dog) updateDog(p, deltaSeconds);
      } else {
        p.walking = false;
        p.a = Math.PI / 2;
      }
      // Label each one with its pose.
      p.speech = p.posed;
      p.speechUntil = gameTime + 1;
      return true;
    }
    /* Per person: pending perception, then the reaction if any. True when handled. */
    function updateCrowdPerson(p, deltaSeconds) {
      if (p.posed) return updatePosed(p, deltaSeconds);
      if (p.pending && gameTime >= p.pending.at) {
        const pending = p.pending;
        p.pending = null;
        decideReaction(p, pending);
      }
      if (!p.react && p.flee > 0) adoptLegacyFlee(p);
      if (p.react) return updateReaction(p, deltaSeconds);
      if (p.scene) return updateSceneMember(p, deltaSeconds);
      if (p.dog) updateDog(p, deltaSeconds);
      return false;
    }
    /**
     * DOGS
     * A dog walks at heel on a leash, stops to sniff, trots to catch up, and
     * when its owner runs, it runs. If its owner goes down, it stays.
     */
    function updateDog(p, deltaSeconds) {
      const dog = p.dog;
      if (!dog) return;
      if (p.hp <= 0) {
        dog.moving = 0;
        dog.sit = true;
        return;
      }
      const behind = { x: p.x - Math.cos(p.a) * 11 + Math.cos(p.a + Math.PI / 2) * 6, y: p.y - Math.sin(p.a) * 11 + Math.sin(p.a + Math.PI / 2) * 6 };
      dog.sniff -= deltaSeconds;
      if (dog.sniff < -8) dog.sniff = randomBetween(1, 2.5);
      const d = distanceBetween(dog, behind),
        leash = 20;
      let speed = 0;
      if (dog.sniff > 0 && d < leash && p.react?.kind !== 'flee') speed = 0;
      else if (d > 2) speed = Math.min(110, d * 5);
      if (speed > 0) {
        const a = headingBetween(dog, behind);
        dog.a += normalizeAngle(a - dog.a) * Math.min(1, deltaSeconds * 8);
        dog.x += Math.cos(a) * speed * deltaSeconds;
        dog.y += Math.sin(a) * speed * deltaSeconds;
      }
      if (distanceBetween(dog, p) > leash + 6) {
        const a = headingBetween(p, dog);
        dog.x = p.x + Math.cos(a) * (leash + 6);
        dog.y = p.y + Math.sin(a) * (leash + 6);
      }
      dog.moving = speed;
      dog.sit = false;
    }

    /**
     * WITNESS CALLS
     * A completed call is the only way a bystander changes the wanted level, and
     * only for what the player did: with no stars, a call brings the police;
     * while they are already searching, a caller who can see you tells them
     * where you are. Stop the caller (or scare them off) and the call never ends.
     */
    const WITNESS_REPORT_WINDOW = 30;
    function crowdReport(caller, inc) {
      if (!inc || inc.reported) return;
      inc.reported = true;
      crowd.reports++;
      crowd.lastReportAt = gameTime;
      if (inc.attacker !== player || gameMode !== 'play' || distanceBetween(inc, player) > 1800) return;
      // A call is prompt or it is nothing: a witness who rings in half a minute
      // after the last shot (or the killing, for a body) no longer brings the
      // police, so stars never rise long after the player stopped.
      // A body keeps drawing onlookers for minutes; what counts is when it fell.
      const crimeAt = inc.kind === 'body' ? (inc.focus?.deadTime ?? inc.start) : inc.time;
      if (gameTime - crimeAt > WITNESS_REPORT_WINDOW) return;
      if (wantedStars <= 0) {
        const amount = { gunfire: 0.5, explosion: 0.6, knock: 0.45, crash: 0.25, body: 0.45, melee: 0.4 }[inc.kind] || 0.3;
        crime(amount);
        tell('A WITNESS CALLED THE POLICE', 2.6);
      } else if (searchActive && distanceBetween(caller, player) < 450 && crowdSight(caller, player)) {
        lastSeen = { x: player.x, y: player.y };
        searchRemaining = Math.min(policeSearchSeconds(), searchRemaining + 2);
        tell('A WITNESS IS GIVING THE POLICE YOUR POSITION', 2.6);
      }
    }
    /**
     * BODIES
     * A body on the pavement stops people. Whoever walks into sight of one
     * gasps and backs off; some stay and stare from a distance, one calls it in.
     */
    const bodyIncidents = new WeakMap();
    function refreshBodies(deltaSeconds) {
      crowd.timers.bodies -= deltaSeconds;
      if (crowd.timers.bodies > 0) return;
      crowd.timers.bodies = 0.4;
      crowd.bodies.length = 0;
      for (const list of [pedestrians, enemies, gangMembers, officers])
        for (const e of list)
          if (
            e.hp <= 0 &&
            gameTime - (e.deadTime || 0) < 240 &&
            Math.abs(e.x - player.x) < 1200 &&
            Math.abs(e.y - player.y) < 1200 &&
            crowd.bodies.length < 16
          )
            crowd.bodies.push(e);
      for (const body of crowd.bodies) {
        let inc = bodyIncidents.get(body);
        forPeopleNear(body.x, body.y, ALARM_REACH.body, (p, d) => {
          if (p.hp <= 0 || p.react || p.pending || p.leader || p.onDeck || personIncapacitated(p)) return;
          if (d > 55 && !crowdSight(p, body)) return;
          if (!inc) {
            inc = crowdIncident('body', body, body.killedBy === player ? player : null, 1);
            inc.focus = body;
            bodyIncidents.set(body, inc);
          }
          inc.time = gameTime;
          p.pending = { inc, at: gameTime + randomBetween(0.15, 0.6), sees: true, d };
        });
      }
    }
    /**
     * A GUN POINTED AT YOU
     * With a firearm out and aimed (mouse or touch aim, or after a recent shot),
     * whoever the barrel is on puts their hands up and pleads; held there long
     * enough some drop to their knees, some bolt.
     */
    function aimReactions(deltaSeconds) {
      crowd.timers.aim -= deltaSeconds;
      if (crowd.timers.aim > 0) return;
      crowd.timers.aim = 0.12;
      if (player.car || gameMode !== 'play' || transitRide || taxiRide || player.swimming) return;
      // Empty-handed, the player is just another person on the street: nobody
      // puts their hands up, and now and then someone passing says hello.
      if (playerUnarmed()) {
        friendlyNods();
        return;
      }
      if (selectedWeaponIndex === KNIFE_INDEX || !weapons[selectedWeaponIndex]?.owned) return;
      if (!(mouse.active || touchAim !== null || gameTime - crowd.playerShotAt < 8)) return;
      const aimA = aim();
      forPeopleNear(player.x, player.y, 240, (p, d) => {
        if (p.hp <= 0 || d < 6 || personIncapacitated(p) || p.onDeck) return;
        if (Math.abs(normalizeAngle(headingBetween(player, p) - aimA)) > Math.max(0.1, 13 / d)) return;
        if (!crowdSight(player, p)) return;
        p.aimedAt = gameTime;
        p.sawPlayerAt = gameTime;
        const cur = p.react?.kind;
        if (cur === 'handsUp' || cur === 'kneel' || cur === 'groan') return;
        if (cur === 'flee' && (d > 110 || seededRandom() < 0.5)) return;
        startReaction(p, 'handsUp', 60, player, null);
        crowdSay(p, 'handsUp', 0.9);
      });
    }
    /* An unarmed player walking by calm people gets the odd nod or hello. */
    function friendlyNods() {
      if (gameTime - (crowd.lastNodAt ?? -100) < 7 || wantedStars > 0) return;
      let best = null,
        bestD = 46;
      forPeopleNear(player.x, player.y, 46, (p, d) => {
        if (p.hp <= 0 || p.react || p.pending || p.onDeck || personIncapacitated(p) || p.speechUntil > gameTime) return;
        if (gameTime - (p.aimedAt ?? -100) < 60 || d >= bestD) return;
        best = p;
        bestD = d;
      });
      if (best && crowdSay(best, 'greet', 0.6)) crowd.lastNodAt = gameTime;
    }
    /**
     * TIPPING OFF THE POLICE
     * While the police are searching, an officer on foot near someone who saw
     * the player gets pointed the right way, and the search moves with them.
     */
    function policeTips(deltaSeconds) {
      crowd.timers.tips -= deltaSeconds;
      if (crowd.timers.tips > 0) return;
      crowd.timers.tips = 1;
      if (wantedStars <= 0 || !searchActive || gameTime - crowd.lastTipAt < 8) return;
      for (const o of officers) {
        if (o.hp <= 0 || o.returned || o.state === 'return') continue;
        let witness = null;
        forPeopleNear(o.x, o.y, 130, (p) => {
          if (witness || p.hp <= 0 || gameTime - (p.sawPlayerAt ?? -100) > 45) return;
          if (p.react && !['watch', 'startle'].includes(p.react.kind)) return;
          witness = p;
        });
        if (!witness) continue;
        startReaction(witness, 'point', 2.8, player, null);
        crowdSay(witness, 'point', 1);
        lastSeen = { x: player.x + randomBetween(-50, 50), y: player.y + randomBetween(-50, 50) };
        searchRemaining = Math.min(policeSearchSeconds(), searchRemaining + 1.5);
        crowd.lastTipAt = gameTime;
        tell('A WITNESS IS POINTING THE POLICE YOUR WAY', 2.4);
        return;
      }
    }
    /**
     * NEAR MISSES
     * A car coming fast along a line that would clip someone makes them leap
     * clear; once safe, most turn round and let the driver have it.
     */
    function nearMisses(deltaSeconds) {
      crowd.timers.near -= deltaSeconds;
      if (crowd.timers.near > 0) return;
      crowd.timers.near = 0.08;
      for (const c of vehicles) {
        if (c.hp <= 0 || isBoat(c) || (isAircraft(c) && aircraftClearance(c) > 3)) continue;
        if (Math.abs(c.x - player.x) > 1000 || Math.abs(c.y - player.y) > 1000) continue;
        const speed = Math.hypot(c.vx || 0, c.vy || 0);
        if (speed < 70) continue;
        const ux = c.vx / speed,
          uy = c.vy / speed,
          look = 18 + speed * 0.42,
          half = vehicleSpec(c).w / 2 + vehicleSpec(c).l * 0.1;
        forPeopleNear(c.x + (ux * look) / 2, c.y + (uy * look) / 2, look / 2 + 34, (p) => {
          if (p.hp <= 0 || personIncapacitated(p) || p.onDeck || ['dodge', 'groan'].includes(p.react?.kind)) return;
          const dx = p.x - c.x,
            dy = p.y - c.y,
            along = dx * ux + dy * uy,
            side = -dx * uy + dy * ux;
          if (along < 0 || along > look || Math.abs(side) > half + 18) return;
          const s = Math.sign(side) || (seededRandom() < 0.5 ? -1 : 1),
            leap = Math.atan2(ux * s, -uy * s);
          const angry = (c === player.car || speed > 110) && (p.nerve ?? 0.5) > 0.2;
          startReaction(p, 'dodge', 0.5, c, null, { leap, car: c, then: angry ? 'fist' : 'hurry', thenExtra: { car: c } });
          crowdSay(p, 'dodge', 0.7);
          if (c === player.car) p.sawPlayerAt = gameTime;
        });
      }
    }

    /**
     * STREET SCENES
     * Small set pieces staged around the player, off screen, so there is always
     * something going on when you arrive: a hot-dog cart with a queue, a busker
     * with a few people listening, cafe tables with people over coffee, smokers
     * outside an office door, a delivery van double-parked with its driver
     * wheeling boxes in (and the traffic behind it leaning on the horn), people
     * waiting at bus shelters, and after dark a queue and a bouncer outside every
     * bar and club. Members are ordinary pedestrians with a `scene`: anything
     * that frightens them breaks the scene like it would break anyone's walk, and
     * the people who work there come back once it is over.
     */
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
    /**
     * TAXIS AND BUSES
     * A free cab heading down a street picks up the person waving at the kerb:
     * it pulls in, they get in, it goes. Buses stop at shelters and take on
     * whoever is waiting. The stop itself is a speed cap the traffic AI obeys
     * (curbsideStop), so it brakes like it does for anything else.
     */
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

    /**
     * TRAFFIC LIFE
     * Drivers are people too. A car stuck behind something that is not a red
     * light (a double-parked van, a wreck, the player's car, people standing in
     * the road) waits a moment and then leans on the horn, harder the longer it
     * goes on. After a real crash both drivers stop; they get out, and depending
     * on who they are they argue, stand holding their head, call it in, or leave
     * the car and walk away shaken. A fender-bender earns a horn blast.
     */
    function blockerAhead(c) {
      const ca = Math.cos(c.a),
        sa = Math.sin(c.a),
        half = vehicleSpec(c).l / 2,
        vertical = Math.abs(Math.sin(c.navAngle ?? c.a)) > 0.5;
      if (c.junction && !c.junction.committed) {
        const signal = trafficSignal(c.junction.x, c.junction.y)[vertical ? 'vertical' : 'horizontal'];
        if (signal !== 'green') return null;
      }
      for (const o of vehicles) {
        if (o === c || (o.altitude || 0) > 20 || isBoat(o)) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y;
        if (Math.abs(dx) > 110 || Math.abs(dy) > 110) continue;
        const along = dx * ca + dy * sa,
          lateral = Math.abs(-dx * sa + dy * ca);
        if (along < half || along > half + 70 + vehicleSpec(o).l / 2 || lateral > 15) continue;
        if (o === player.car || !o.ai || o.hp <= 0 || !o.occupied || o.crashStop) return { kind: 'car', o };
        if ((o.blockedFor || 0) > 3) return { kind: 'queue', o };
        return null;
      }
      let person = null;
      forPeopleNear(c.x + ca * (half + 26), c.y + sa * (half + 26), 24, (p) => {
        if (!person && p.hp > 0 && crowdOnRoad(p.x, p.y)) person = p;
      });
      if (person) return { kind: 'person', p: person };
      if (!player.car && Math.hypot(player.x - (c.x + ca * (half + 26)), player.y - (c.y + sa * (half + 26))) < 24)
        return { kind: 'person', p: player };
      return null;
    }
    function driverOut(c) {
      const crash = c.crashStop;
      c.crashStop = null;
      const door = driverDoor(c);
      let x = door.x,
        y = door.y;
      if (solid(x, y, 6)) {
        const other = c.a + Math.PI / 2;
        x = c.x + Math.cos(other) * (vehicleSpec(c).w / 2 + 11);
        y = c.y + Math.sin(other) * (vehicleSpec(c).w / 2 + 11);
        if (solid(x, y, 6)) return;
      }
      const d = { x, y, a: door.a, hp: 30, flee: 0, timer: 1, walk: 0, state: 'walk', car: c };
      dressPerson(d, 'casual');
      d.look.top = d.color = c.driverColor || d.color;
      pedestrians.push(d);
      c.occupied = false;
      c.ai = false;
      c.vx = c.vy = c.speed = 0;
      c.driverOut = d;
      const hurt = crash.severity > 230 || c.hp < c.maxhp * 0.35,
        mood = c.driverMood || 'flee',
        other = crash.other,
        target = other === player.car ? player : other;
      if (hurt) {
        d.injured = true;
        startReaction(d, 'gasp', 1.6, c, crash.inc, { then: 'hurry' });
        crowdSay(d, 'shakenDriver', 1);
      } else if (mood === 'angry' || mood === 'defiant' || (mood === 'flee' && seededRandom() < 0.4)) {
        startReaction(d, 'argue', reactionDuration('argue'), target || c, crash.inc, { target, car: c, then: 'returnCar' });
      } else if (mood === 'witness' && crash.inc?.attacker === player) {
        startReaction(d, 'call', reactionDuration('call'), target || c, crash.inc, { then: 'returnCar' });
      } else {
        startReaction(d, 'watch', randomBetween(6, 10), c, crash.inc, { then: 'returnCar', focusCar: c });
        crowdSay(d, 'shakenDriver', 0.8);
      }
    }
    function updateArgument(p, r, deltaSeconds) {
      const target = r.target && (r.target.hp > 0 || r.target === player) ? r.target : r.car;
      if (!target) {
        r.dur = 0;
        return;
      }
      // Someone pulls a gun or drives off: the argument is over.
      if (target === player && p.aimedAt > gameTime - 0.3) return;
      const d = distanceBetween(p, target);
      if (d > 26 && d < 300) {
        p.pose = null;
        crowdStep(p, headingBetween(p, target), 34, deltaSeconds);
      } else {
        p.walking = false;
        faceToward(p, target, deltaSeconds, 6);
        p.pose = r.t % 2.4 < 1.4 ? 'fist' : 'shout';
        if (seededRandom() < deltaSeconds * 0.45) crowdSay(p, 'angryDriver', 1);
      }
    }
    function updateReturnToCar(p, r, deltaSeconds) {
      const c = p.car || r.car;
      if (!c || c.hp <= 0 || !vehicles.includes(c)) {
        r.dur = 0;
        r.then = null;
        return false;
      }
      if (player.car === c || c.occupied) {
        // Somebody took it while they were busy shouting.
        p.react = null;
        startReaction(p, 'fist', 2.5, c, null, { car: c, then: 'hurry' });
        return true;
      }
      const door = driverDoor(c);
      if (distanceBetween(p, door) < 7) {
        const k = pedestrians.indexOf(p);
        if (k >= 0) pedestrians.splice(k, 1);
        c.occupied = true;
        c.driverOut = null;
        c.ai = c.hp > c.maxhp * 0.3 && !c.stolen;
        return true;
      }
      p.pose = null;
      crowdStep(p, headingBetween(p, door), 30, deltaSeconds);
      r.dur = r.t + 5;
      return false;
    }
    /* Called from collisionImpact for every hard enough contact. */
    function crowdCrash(a, b, hit, closing) {
      if (closing < 70 || !hit) return;
      if (Math.abs(hit.x - player.x) > 1400 || Math.abs(hit.y - player.y) > 1400) return;
      // The player is the culprit only for ramming someone hard, not for being hit.
      const other = a === player.car ? b : b === player.car ? a : null,
        playerFaster =
          !!other && (player.car?.impactSpeed || 0) > (other.impactSpeed || 0),
        culprit = other && other.occupied && playerFaster && closing > RECKLESS_CRASH_SPEED ? player : null;
      const inc = crowdAlarm('crash', hit, culprit, clamp(closing / 160, 0.5, 2));
      for (const c of [a, b]) {
        if (!c || c === player.car || !c.occupied || !c.ai || c.hp <= 0 || c.type === 'police') continue;
        if (isBoat(c) || isAircraft(c) || c.ramUntil > gameTime || c.crashStop) continue;
        if (closing < 75) {
          c.honkAt = gameTime + randomBetween(0.2, 0.6);
          continue;
        }
        c.crashStop = { time: gameTime, other: c === a ? b : a, severity: closing, inc };
      }
    }
    function updateTrafficLife(deltaSeconds) {
      crowd.timers.traffic -= deltaSeconds;
      if (crowd.timers.traffic > 0) return;
      const step = 0.25;
      crowd.timers.traffic = step;
      for (const c of vehicles) {
        if (c.hp <= 0 || isAircraft(c) || isBoat(c)) continue;
        if (Math.abs(c.x - player.x) > 950 || Math.abs(c.y - player.y) > 950) continue;
        if (c.crashStop) {
          c.honkAt = 0;
          if (Math.hypot(c.vx || 0, c.vy || 0) < 6 && gameTime - c.crashStop.time > 0.9) driverOut(c);
          else if (gameTime - c.crashStop.time > 6) c.crashStop = null;
          continue;
        }
        if (!c.ai || !c.occupied) continue;
        if (c.honkAt && gameTime >= c.honkAt) {
          c.honkAt = 0;
          hornSound(c, 0.4);
        }
        if (Math.abs(c.speed || 0) > 6 || c.curbStop) {
          c.blockedFor = 0;
          continue;
        }
        const blocker = blockerAhead(c);
        if (!blocker) {
          c.blockedFor = 0;
          continue;
        }
        c.blockedFor = (c.blockedFor || 0) + step;
        const patience = 2 + (c.id % 5) * 0.7;
        if (c.blockedFor > patience && gameTime > (c.nextHonk || 0)) {
          const fed = c.blockedFor > patience + 7;
          if (blocker.kind === 'queue' && seededRandom() < 0.6) {
            c.nextHonk = gameTime + randomBetween(3, 6);
            continue;
          }
          hornSound(c, fed ? randomBetween(0.7, 1.2) : randomChoice([0.16, 0.28, 0.4]), fed && seededRandom() < 0.4);
          crowd.honks++;
          c.nextHonk = gameTime + (fed ? randomBetween(1.3, 2.6) : randomBetween(2.2, 4.5));
          if (fed && blocker.kind !== 'queue' && seededRandom() < 0.4) {
            c.speech = randomChoice(CROWD_LINES.honk);
            c.speechUntil = gameTime + 2.4;
          }
          // People standing in the road get out of it when honked at.
          if (blocker.kind === 'person' && blocker.p !== player && blocker.p.react?.kind === 'watch') {
            blocker.p.react.spot = snapToSidewalk(blocker.p.x, blocker.p.y);
            crowdSay(blocker.p, 'fist', 0.4);
          }
        }
      }
    }

    /**
     * KNOCKED SCENE FURNITURE
     * A street scene's furniture (a vendor's cart, cafe tables and chairs, a menu
     * board, a busker's case, delivery boxes, a club rope) is loose: a vehicle
     * driving into it throws it ahead and aside with the car's momentum shared
     * (masses in kg below), tips it over, and it tumbles to a stop. Whoever was
     * working or sitting there scatters. The scene carries on around the mess
     * and takes its furniture away when it packs up.
     */
    const SCENE_PROP_KG = { cart: 160, cafeTable: 35, menuBoard: 10, guitarCase: 5, boxes: 25, rope: 15 },
      SCENE_PROP_MATERIAL = { cart: 'metal', cafeTable: 'metal', menuBoard: 'wood', guitarCase: 'plastic', boxes: 'fabric', rope: 'metal' };
    function knockSceneProps(deltaSeconds) {
      const props = crowd.props;
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (Math.abs(prop.x - player.x) > 1200 || Math.abs(prop.y - player.y) > 1200) continue;
        if (!prop.knocked || prop.vx || prop.vy) {
          for (let v = 0; v < vehicles.length; v++) {
            const c = vehicles[v];
            if (Math.abs(c.x - prop.x) > 70 || Math.abs(c.y - prop.y) > 70) continue;
            if (isBoat(c) || (isAircraft(c) && (c.altitude || 0) > 8)) continue;
            const speed = Math.hypot(c.vx || 0, c.vy || 0);
            if (speed < 2 * UNITS_PER_METRE || !pointInCar(prop.x, prop.y, c, 4)) continue;
            const kg = SCENE_PROP_KG[prop.kind] || 20,
              mass = (vehicleSpec(c).mass || 1.25) * 1000,
              share = kg / (kg + mass),
              side = Math.sign(-(prop.x - c.x) * Math.sin(c.a) + (prop.y - c.y) * Math.cos(c.a)) || 1,
              throwSpeed = speed * (1 + seededRandom() * 0.2);
            prop.vx = c.vx * 1.05 - Math.sin(c.a) * side * throwSpeed * 0.35;
            prop.vy = c.vy * 1.05 + Math.cos(c.a) * side * throwSpeed * 0.35;
            prop.spin = side * (3 + speed * 0.02);
            prop.tipTo = prop.kind === 'rope' || prop.kind === 'boxes' ? 0.4 : 1.45;
            // The car gives up the momentum it hands on.
            c.vx *= 1 - share;
            c.vy *= 1 - share;
            if (!prop.knocked) {
              prop.knocked = true;
              if (distanceBetween(prop, player) < 900)
                crashSound({ x: prop.x, y: prop.y, closing: speed, mass: mass / 1000, other: 'prop', material: SCENE_PROP_MATERIAL[prop.kind], propKg: kg, glass: 0, sliding: 0, key: 'scene' + c.id });
              crowdAlarm('crash', { x: prop.x, y: prop.y }, null, 0.9);
              if (c === player.car) shake = Math.max(shake, kg > 100 ? 2 : 0.6);
            }
            break;
          }
        }
        if (!prop.vx && !prop.vy && prop.tip === prop.tipTo) continue;
        prop.x += prop.vx * deltaSeconds;
        prop.y += prop.vy * deltaSeconds;
        prop.a += prop.spin * deltaSeconds;
        prop.tip += (prop.tipTo - prop.tip) * Math.min(1, deltaSeconds * 7);
        if (Math.abs(prop.tipTo - prop.tip) < 0.01) prop.tip = prop.tipTo;
        // Sliding and tumbling on the pavement: about 0.6 g, harder once it is over.
        const friction = Math.exp(-(prop.tip > 0.7 ? 4 : 2.2) * deltaSeconds);
        prop.vx *= friction;
        prop.vy *= friction;
        prop.spin *= friction;
        if (Math.hypot(prop.vx, prop.vy) < 3 || solid(prop.x, prop.y, 3)) prop.vx = prop.vy = prop.spin = 0;
      }
    }
    /**
     * THE DIRECTOR
     * Runs once a frame before the people loop.
     */
    function updateCrowd(deltaSeconds) {
      crowd.hour = crowdHour();
      crowd.tempo = cityTempo();
      buildCrowdGrid();
      refreshBodies(deltaSeconds);
      aimReactions(deltaSeconds);
      policeTips(deltaSeconds);
      nearMisses(deltaSeconds);
      crowdEncounters(deltaSeconds);
      updateScenes(deltaSeconds);
      knockSceneProps(deltaSeconds);
      updateIndoors();
      updateTrafficLife(deltaSeconds);
      for (let i = crowd.incidents.length - 1; i >= 0; i--)
        if (gameTime - crowd.incidents[i].time > 90) crowd.incidents.splice(i, 1);
    }
    /* Developer console summary: who is where doing what. */
    function pedestrianReport() {
      const tally = (fn) => {
        const out = {};
        for (const p of pedestrians) {
          const k = fn(p);
          if (k !== undefined && k !== null) out[k] = (out[k] || 0) + 1;
        }
        return out;
      };
      const nearby = pedestrians.filter((p) => p.hp > 0 && crowdInView(p.x, p.y, 0));
      return {
        total: pedestrians.length,
        alive: pedestrians.filter((p) => p.hp > 0).length,
        inView: nearby.length,
        withinRing: pedestrians.filter((p) => p.hp > 0 && Math.abs(p.x - player.x) < CROWD_RING && Math.abs(p.y - player.y) < CROWD_RING).length,
        target: Math.round(CROWD_STREET_TARGET * cityTempo().out * districtBustle(player.x, player.y)),
        tempo: cityTempo().name,
        reactions: tally((p) => p.react?.kind),
        poses: tally((p) => (p.hp > 0 && crowdInView(p.x, p.y, 0) ? p.pose || (p.walking ? 'walk' : 'stand') : null)),
        roles: tally((p) => p.role),
        states: tally((p) => p.state),
        indoors: crowd.indoors.reduce((n, s) => n + s.party.length, 0),
        scenes: crowd.scenes.map((s) => ({ kind: s.kind, x: Math.round(s.x), y: Math.round(s.y), members: s.members.length })),
        incidents: crowd.incidents.map((i) => ({ kind: i.kind, age: +(gameTime - i.time).toFixed(1), callers: i.callers, watchers: i.watchers, filmers: i.filmers, spread: i.spread, reported: i.reported })),
        reports: crowd.reports,
        dogs: pedestrians.filter((p) => p.dog).length,
        busStops: BUS_STOPS.length,
        frontages: streetFrontages().length,
        props: crowd.props.length,
        // The speech bubbles on screen (at most SPEECH_BUBBLES_MAX) and the lines
        // still live but not shown (waiting for a slot, or out of range).
        bubbles: speechShown.map((p) => ({
          text: p.speech,
          rank: speechPriority(p),
          seconds: +(p.speechUntil - gameTime).toFixed(1),
          d: Math.round(distanceBetween(p, player)),
          // Height of the view over the speaker (m) and the bubble's fade for it.
          viewHeight: +worldMeters(speechViewHeight(p)).toFixed(1),
          fade: +speechHeightFade(p).toFixed(2),
          rider: !!p.coasterRider,
        })),
        unshownLines: [...pedestrians, ...vehicles, ...gangMembers, ...coasterSpeakers()].filter(
          (p) => p.speech && p.speechUntil >= gameTime && !speechShown.includes(p) && !(p.posed && p.speech === p.posed),
        ).length,
        honking: vehicles.filter((c) => (c.blockedFor || 0) > 2).length,
        honks: crowd.honks,
        driversOut: pedestrians.filter((p) => p.car && p.hp > 0).length,
        nearestDoor: (() => {
          const door = doorNear(player, 250);
          return door ? { x: Math.round(door.x), y: Math.round(door.y), place: door.place?.name || null } : null;
        })(),
      };
    }
    // END SUBSYSTEM: src/crowd.js
