    // Crowd spoken lines (CROWD_LINES, crowdSay) and speech bubbles.
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
      // sealifeSpeakers(): the beach shouting SHARK! (sealife.js).
      for (const list of [pedestrians, vehicles, gangMembers, coasterSpeakers(), clubTalkSpeakers(), sealifeSpeakers()])
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
