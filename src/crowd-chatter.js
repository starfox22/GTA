    // Street chatter that fits the moment (the hour, the weather, the district, what the player looks like and
    // drives, what just happened), the lines witnesses say on the phone to 911, and the line picker (no repeats).
    /**
     * SAYING SOMETHING
     * pickLine() never hands a person the line they said last. Idle remarks are
     * rate-limited across the street (AMBIENT_GAP) so bubbles stay readable; the
     * bubble system (crowd-speech.js) still shows at most two.
     */
    const AMBIENT_GAP = 1.6,
      AMBIENT_KINDS = new Set(['idle', 'night', 'morning', 'lunch', 'evening', 'rainTalk', 'beachTalk', 'officeTalk', 'docksTalk', 'parkTalk', 'sirens', 'aftermath', 'crashTalk', 'chat', 'phoneTalk', 'greet']);
    let ambientSaidAt = -100,
      remarkTimer = 0,
      remarkSaidAt = -100;
    function pickLine(lines, p) {
      let line = randomChoice(lines);
      if (lines.length > 1 && line === p.lastLine) line = lines[(lines.indexOf(line) + 1) % lines.length];
      p.lastLine = line;
      return line;
    }
    /* An idle remark may go ahead: not too soon after the last one on screen. */
    function ambientAllowed(kind, p) {
      if (!AMBIENT_KINDS.has(kind)) return true;
      if (!crowdInView(p.x, p.y, 40)) return true;
      if (gameTime - ambientSaidAt < AMBIENT_GAP) return false;
      ambientSaidAt = gameTime;
      return true;
    }

    // The new kinds (the reactions' own lines are in CROWD_LINES, crowd-speech.js).
    Object.assign(CROWD_LINES, {
      // Time of day.
      night: [
        'Where’s a cab when you need one?',
        'One more bar. One.',
        'I’ve got work in six hours.',
        'This street’s creepy at night.',
        'Walk me to my car?',
        'Is anything still open?',
        'The ferry stopped an hour ago.',
        'Keep your wallet in your front pocket.',
      ],
      morning: [
        'Coffee. I need coffee.',
        'Late again. He’s gonna kill me.',
        'Traffic’s a nightmare already.',
        'Did you see the paper?',
        'Monday. It feels like a Monday.',
        'The bus drove right past me.',
      ],
      lunch: [
        'Tacos or noodles?',
        'I’ve got twenty minutes.',
        'That new deli any good?',
        'My boss eats at his desk. Every day.',
      ],
      evening: [
        'Drinks after this?',
        'Look at that sky.',
        'What a day.',
        'Let’s get something to eat.',
        'I’m not cooking tonight.',
      ],
      rainTalk: ['Soaked. Totally soaked.', 'My shoes are ruined.', 'It never rains like this back home.', 'Share the umbrella?', 'The gutters are overflowing again.'],
      // The district.
      beachTalk: ['Did you bring sunscreen?', 'The water’s perfect today.', 'I’m burning already.', 'Beach, then drinks.', 'Look at that boat.'],
      officeTalk: ['The market’s down again.', 'Can we push the meeting?', 'I left my badge upstairs.', 'Quarterly reports. Kill me.', 'He wants it by five.'],
      docksTalk: ['Shift starts at six.', 'That ship’s been sitting there a week.', 'Union meeting Thursday.', 'Watch the forklifts.', 'Smells like diesel and fish.'],
      parkTalk: ['Nice day for a walk.', 'The ducks are back.', 'Watch out for the joggers.', 'Let’s sit for a minute.', 'I love it here in the fall.'],
      // What has been going on.
      sirens: ['Cops everywhere today.', 'What’s with all the sirens?', 'Somebody’s in trouble.', 'Helicopter’s been up for ages.', 'Stay off the avenue, they’re chasing someone.'],
      aftermath: [
        'Did you hear the shots earlier?',
        'I’m not walking this way again.',
        'Somebody got hurt back there.',
        'This neighbourhood used to be quiet.',
        'Did anybody call the cops?',
        'I still can’t stop shaking.',
      ],
      crashTalk: ['Did you see that crash back there?', 'People drive like maniacs here.', 'Somebody’s gonna get killed on this street.', 'That car was flying.'],
      // Seeing something done in front of them.
      sawCrime: ['Hey! What are you doing?!', 'Oh my god!', 'Did he just…?', 'Somebody stop him!', 'Hey! That’s not yours!', 'Are you seeing this?'],
      // Onlookers round a body, holding each other up.
      comfort: ['Are you okay?', 'Come on, don’t look.', 'Let’s get out of here.', 'Breathe. It’s okay.', 'Stay with me, okay?', 'The police are coming.'],
      comforted: ['I can’t stop shaking.', 'I saw it. I saw everything.', 'I think I’m gonna be sick.', 'Who does something like that?', 'I just want to go home.'],
      // Said to the player.
      armedNear: ['Is that a real gun?', 'Whoa, put that away, man.', 'Easy with that thing.', 'Don’t point that anywhere near me.', 'I don’t want any trouble.', 'Somebody should call the cops.'],
      knifeNear: ['Is that a knife?!', 'Whoa, whoa, put that away.', 'Keep walking, buddy.'],
      playerHurt: ['You’re bleeding, man!', 'You need a hospital.', 'Are you okay? You look terrible.', 'Jesus, what happened to you?', 'Should I call an ambulance?'],
      niceCar: ['Nice ride!', 'Is that the new one?', 'Must be nice.', 'How much did that set you back?', 'Now that’s a car.', 'Can I get a ride?'],
      copCar: ['Is that… a cop car?', 'Since when do cops look like that?', 'That’s not a real cop.', 'Uh… officer?'],
      wreckCar: ['Your car’s smoking, man!', 'That thing’s gonna blow!', 'You should get that looked at.', 'Is that thing even legal?'],
      callCut: ['I’ll call back…', 'Oh no, he’s coming!', 'I have to go!'],
    });
    // Ground-level cues for what is going on: time of day, rain, the district, a
    // recent incident or a chase nearby. Returns the kind of idle remark to make.
    const DISTRICT_TALK = {
      'OCEAN DRIVE': 'beachTalk',
      'PALM KEYS · ART DECO': 'beachTalk',
      'CORAL MARINA': 'beachTalk',
      'NORTH POINT · FINANCIAL': 'officeTalk',
      'EXCHANGE DISTRICT': 'officeTalk',
      MIDTOWN: 'officeTalk',
      'IRONWORKS DOCKS': 'docksTalk',
      'CENTRAL GARDEN': 'parkTalk',
    };
    function chatterKind(p) {
      const h = crowd.hour,
        r = seededRandom();
      for (const inc of crowd.incidents)
        if (gameTime - inc.time < 150 && gameTime - inc.time > 20 && Math.abs(inc.x - p.x) < 900 && Math.abs(inc.y - p.y) < 900 && r < 0.5)
          if (inc.loud || inc.kind === 'body' || inc.kind === 'melee') return 'aftermath';
          else if (inc.kind === 'crash' && inc.severity > 1) return 'crashTalk';
      if (wantedStars > 0 && r < 0.35) return 'sirens';
      if (weather.rain > 0.3 && r < 0.5) return 'rainTalk';
      if (h >= 22 || h < 5) return r < 0.6 ? 'night' : 'idle';
      if (h >= 6 && h < 10 && r < 0.45) return 'morning';
      if (h >= 11.5 && h < 14 && r < 0.35) return 'lunch';
      if (h >= 17 && h < 21 && r < 0.3) return 'evening';
      if (r < 0.75) {
        const talk = DISTRICT_TALK[districtAt(p.x, p.y)];
        if (talk && (talk !== 'beachTalk' || (h > 8 && h < 19))) return talk;
      }
      return 'idle';
    }

    /**
     * REMARKS AT THE PLAYER
     * Every so often somebody close by says something about how the player looks
     * or what they drive: a gun on show, blood, a supercar crawling past, a
     * stolen cruiser, a smoking wreck. One remark every few seconds at most.
     */
    const SHOWY_CAR_TYPES = new Set(['supercar', 'roadster', 'luxury', 'limousine', 'sport', 'coupe']);
    function playerRemarks(deltaSeconds) {
      remarkTimer -= deltaSeconds;
      if (remarkTimer > 0) return;
      remarkTimer = 0.6;
      if (gameMode !== 'play' || gameTime - remarkSaidAt < 6 || player.swimming || transitRide || taxiRide) return;
      const car = player.car;
      let kind = null,
        reach = 60;
      if (car) {
        if (isAircraft(car) || isBoat(car)) return;
        const speed = Math.hypot(car.vx || 0, car.vy || 0);
        if (speed > 30 * KMH) return;
        reach = 90;
        if (car.type === 'police' && car.stolen) kind = 'copCar';
        else if (car.hp < (car.maxhp || 100) * 0.35) kind = 'wreckCar';
        else if (SHOWY_CAR_TYPES.has(car.type) || car.type in PRESTIGE_TYPES) kind = 'niceCar';
      } else {
        if (player.hp < 45) kind = 'playerHurt';
        else if (!playerUnarmed()) kind = selectedWeaponIndex === KNIFE_INDEX ? 'knifeNear' : 'armedNear';
        else if (wantedStars > 0) kind = 'wanted';
      }
      if (!kind || seededRandom() > 0.35) return;
      let best = null,
        bestD = reach;
      forPeopleNear(player.x, player.y, reach, (p, d) => {
        if (d >= bestD || p.hp <= 0 || p.react || p.pending || p.onDeck || p.posed || personIncapacitated(p)) return;
        if (p.speechUntil > gameTime || gameTime - (p.aimedAt ?? -100) < 30) return;
        best = p;
        bestD = d;
      });
      if (!best || !crowdSay(best, kind, 1)) return;
      remarkSaidAt = gameTime;
      best.sawPlayerAt = gameTime;
      // Somebody who just saw a gun on show keeps their distance.
      if (kind === 'armedNear' || kind === 'knifeNear') startReaction(best, 'startle', randomBetween(0.6, 1), player, null, { then: 'hurry' });
    }

    /**
     * 911 CALLS: WHAT THE CALLER SAYS
     * The opening names what happened and where (the street the incident was
     * on); a detail follows: which way the player went, in what, armed or not.
     */
    const CALL_OPENERS = {
      gunfire: [
        '911? Someone’s been shot on {street}!',
        '911? There’s been a shooting on {street}!',
        'Police? Someone’s shooting people on {street}!',
        'Shots fired, shots fired! {street}, please hurry!',
        'Somebody just opened fire on {street}!',
      ],
      gunfireHeard: ['911? I just heard gunshots near {street}.', 'Police? I think those were shots, over by {street}.', 'I heard shooting! Somewhere near {street}!'],
      explosion: ['911? Something just blew up on {street}!', 'There’s been an explosion on {street}!', 'Police, fire, anyone! Something exploded on {street}!'],
      melee: ['911? A man’s been stabbed on {street}!', 'Please hurry, somebody’s been stabbed!', 'Police? A guy just knifed someone on {street}!'],
      punch: ['Police? Some guy’s beating people up on {street}!', '911? There’s a fight on {street}, it’s bad!'],
      knock: ['911? A car just ran someone down on {street}!', 'Hit and run on {street}! Send an ambulance!', 'Somebody just got hit by a car on {street}!'],
      body: [
        '911? There’s a body on {street}.',
        'Police? I think someone’s dead on {street}.',
        'Please hurry, there’s a man lying here, he’s not moving!',
        'I just found someone on {street}… he’s not breathing.',
      ],
      carjack: ['911? Someone just stole my car!', 'Police? I’ve been carjacked on {street}!', 'He threw me out of my own car!', 'My car! Some guy just took my car on {street}!'],
      theft: ['911? Someone’s stealing a car on {street}!', 'Police? A guy just drove off in somebody’s car!'],
      crash: ['911? A maniac just rammed a car on {street}!', 'There’s been a crash on {street}, he did it on purpose!'],
      crime: ['Police? Something bad just happened on {street}.', '911? There’s a guy causing trouble on {street}.', 'Police? You need to send someone to {street}.'],
    };
    const CALL_DETAILS = {
      armed: ['He’s got a gun!', 'He’s armed! He’s still armed!', 'He had a gun, a big one!'],
      body: ['No, I didn’t touch anything.', 'I don’t know how long he’s been here.', 'There’s blood… a lot of blood.', 'Please, just send someone.'],
      hurt: ['He’s bleeding badly!', 'Send an ambulance, please!', 'She’s not moving!'],
      any: ['Yes, I’m still here.', 'No, I’m not hurt.', 'Please, just hurry!', 'I don’t know, it all happened so fast!', 'I didn’t get a good look at his face.', 'Dark jacket. That’s all I saw.'],
    };
    const CALL_CLOSING = ['They’re on their way.', 'Okay. Okay. They’re coming.', 'They said to stay put.', 'They’re sending a car.'];
    function fillStreet(line, street) {
      if (street) return line.replace('{street}', street);
      return line.replace(/ (on|near|by|over by) \{street\}/, '').replace(/,? ?Somewhere \{street\}/, '').replace('{street}', 'Here');
    }
    function call911Opening(inc, p) {
      if (!inc) return '911? Please send someone!';
      let kind = inc.kind in CALL_OPENERS ? inc.kind : 'crime';
      if (kind === 'gunfire' && p.witnessOf === inc && !p.witnessSaw) kind = 'gunfireHeard';
      if (kind === 'melee' && playerUnarmed()) kind = 'punch';
      return fillStreet(pickLine(CALL_OPENERS[kind], p), spokenStreet(inc.x, inc.y));
    }
    /* Compass word for a direction on the map (north is -y). */
    function compassWord(dx, dy) {
      const a = Math.atan2(dy, dx),
        words = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
      return words[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
    }
    const CAR_WORDS = {
      supercar: 'sports car', roadster: 'convertible', sport: 'sports car', coupe: 'coupe', luxury: 'fancy sedan', limousine: 'limo',
      sedan: 'sedan', taxi: 'cab', police: 'police car', van: 'van', truck: 'truck', pickup: 'pickup', suv: 'SUV', jeep: 'jeep',
      bus: 'bus', ambulance: 'ambulance', muscle: 'muscle car', motorbike: 'motorbike', sportbike: 'motorbike', bicycle: 'bike',
    };
    function colourWord(hex) {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
      if (!m) return '';
      const n = parseInt(m[1], 16),
        r = (n >> 16) / 255,
        g = ((n >> 8) & 255) / 255,
        b = (n & 255) / 255,
        max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        light = (max + min) / 2,
        sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
      if (sat < 0.18) return light > 0.8 ? 'white' : light > 0.55 ? 'silver' : light > 0.25 ? 'grey' : 'black';
      let hue = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
      hue = (hue * 60 + 360) % 360;
      if (light < 0.3 && hue < 50) return 'brown';
      return hue < 15 || hue >= 340 ? 'red' : hue < 40 ? 'orange' : hue < 68 ? 'yellow' : hue < 165 ? 'green' : hue < 255 ? 'blue' : hue < 300 ? 'purple' : 'pink';
    }
    function call911Detail(inc, p) {
      const sees = distanceBetween(p, player) < 500 && crowdSight(p, player),
        dir = compassWord(player.x - (inc?.x ?? p.x), player.y - (inc?.y ?? p.y)),
        car = player.car;
      if (inc?.kind === 'body') return pickLine(CALL_DETAILS.body, p);
      if (sees && car && !isAircraft(car)) {
        const what = [colourWord(car.color), CAR_WORDS[car.type] || (car.type in PRESTIGE_TYPES ? 'sports car' : 'car')].filter(Boolean).join(' ');
        return pickLine([`He’s in a ${what}!`, `He took off in a ${what}, heading ${dir}!`, `A ${what}, going ${dir}!`], p);
      }
      if (sees && !playerUnarmed() && selectedWeaponIndex !== KNIFE_INDEX && seededRandom() < 0.6) return pickLine(CALL_DETAILS.armed, p);
      if (sees && distanceBetween(player, inc || p) > 60) return pickLine([`He’s running ${dir}!`, `He went ${dir}, on foot!`, `He’s heading ${dir} right now!`], p);
      if (inc?.kind === 'melee' || inc?.kind === 'knock') return pickLine(CALL_DETAILS.hurt, p);
      return pickLine(CALL_DETAILS.any, p);
    }

    /* Two onlookers at a body turn to each other: one comforts, one answers. */
    function comfortStep(p, r, deltaSeconds) {
      const q = r.comfortWith;
      if (q) {
        if (q.hp <= 0 || q.react?.kind !== 'watch' || distanceBetween(p, q) > 34 || (r.comfortT -= deltaSeconds) <= 0) {
          r.comfortWith = null;
          r.comfortIn = randomBetween(8, 16);
          return false;
        }
        faceToward(p, q, deltaSeconds, 5);
        p.pose = r.comfortT % 2.4 < 1.3 ? 'chat' : 'despair';
        // The one being comforted answers a moment later.
        if (r.replyAt && gameTime >= r.replyAt) {
          r.replyAt = 0;
          crowdSay(p, 'comforted', 0.85);
        }
        return true;
      }
      r.comfortIn = (r.comfortIn ?? randomBetween(3, 9)) - deltaSeconds;
      if (r.comfortIn > 0) return false;
      r.comfortIn = randomBetween(8, 16);
      let mate = null;
      forPeopleNear(p.x, p.y, 30, (other) => {
        if (mate || other === p || other.hp <= 0 || other.react?.kind !== 'watch' || other.react.inc !== r.inc || other.react.comfortWith) return;
        mate = other;
      });
      if (!mate) return false;
      r.comfortWith = mate;
      r.comfortT = randomBetween(3.5, 5.5);
      mate.react.comfortWith = p;
      mate.react.comfortT = r.comfortT;
      mate.react.replyAt = gameTime + 2.2;
      crowdSay(p, 'comfort', 1);
      return true;
    }
