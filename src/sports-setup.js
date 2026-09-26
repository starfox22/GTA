    const SPORTS_VENUES = {
      basketball: {
        id: 'riverside-basketball',
        name: 'RIVERSIDE BASKETBALL',
        league: 'RIVERSIDE 3 ON 3',
        x: 1306,
        y: 2862,
        w: 145,
        h: 88,
        hoopInset: 8,
        hoopHeight: 31,
        hoopRadius: 2.3,
        ballRadius: 1.2,
        playerHeight: 18,
        threePointRadius: 43,
      },
      soccer: {
        id: 'city-football-stadium',
        name: 'SOUTH COAST STADIUM',
        league: 'SOUTH COAST LEAGUE',
        x: 2420,
        y: 4405,
        w: 538,
        h: 348,
        goalWidth: 74,
        goalHeight: 24,
        goalDepth: 17,
        ballRadius: 1.1,
        playerHeight: 18,
      },
    };

    // The stadium scenery and the world collision system share these exact stand
    // bases. The southern split leaves a sixty-unit entrance facing the city street.
    const STADIUM_STANDS = [
      { id: 'north', x: 2270, y: 4305, w: 835, h: 68, height: 72 },
      { id: 'south-west', x: 2270, y: 4785, w: 389, h: 100, height: 88 },
      { id: 'south-east', x: 2719, y: 4785, w: 386, h: 100, height: 88 },
      { id: 'west', x: 2270, y: 4373, w: 118, h: 412, height: 82 },
      { id: 'east', x: 2990, y: 4373, w: 115, h: 412, height: 82 },
    ];

    // Where people leave the field. At the stadium the teams use the tunnel under
    // the north stand and vanish into it; panicking players also run out through
    // the south gap towards the turnstiles. Courtside, the teams wait at the bench.
    const SPORTS_EXITS = {
      soccer: [
        { x: 2689, y: 4384, tunnel: true },
        { x: 2689, y: 4776, tunnel: true },
      ],
      basketball: [{ x: 1378.5, y: 2849, tunnel: false }],
    };
    // The ball's owner id while the player dribbles it.
    const SPORTS_HUMAN = 'player';
    // Stewards walk you out to the plaza outside the turnstiles.
    const STADIUM_ESCORT_SPOT = { x: 2689, y: 4916 };

    // Independent random streams keep sporting decisions reproducible and avoid
    // changing world generation, combat or traffic randomness when a match advances.
    function sportsRandom(match) {
      match.randomSeed = (Math.imul(match.randomSeed, 1664525) + 1013904223) >>> 0;
      return match.randomSeed / 4294967296;
    }

    function sportsDistance(first, second) {
      return Math.hypot(first.x - second.x, first.y - second.y);
    }

    function sportsLimit(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }

    function sportsAttackDirection(team) {
      return team === 0 ? 1 : -1;
    }

    function sportsGoal(match, team) {
      const venue = match.venue;
      const inset = match.sport === 'basketball' ? venue.hoopInset : 0;
      return {
        x: team === 0 ? venue.x + venue.w - inset : venue.x + inset,
        y: venue.y + venue.h / 2,
      };
    }

    function sportsPoint(match, team, along, across) {
      return {
        x: match.venue.x + match.venue.w * (team === 0 ? along : 1 - along),
        y: match.venue.y + match.venue.h * across,
      };
    }

    /* A person on the field: the fields strikePerson(), bleed() and the crowd read. */
    function sportsPerson(match, id, kind, x, y, look) {
      return {
        id: match.sport + '-' + id,
        sport: match.sport,
        kind,
        team: -1,
        number: 0,
        role: kind,
        x,
        y,
        a: 0,
        walk: 0,
        walking: false,
        hp: 30,
        lastHp: 30,
        flee: 0,
        hidden: false,
        fleeing: false,
        knockedFor: 0,
        color: look.primary,
        kit: look,
        height: match.venue.playerHeight,
        action: 'ready',
        actionTime: 0,
        actionDuration: 0,
        jump: 0,
        possessionTime: 0,
        tackleCooldown: 0,
        // The renderer can use vx/vy to orient running and kicking animations.
        vx: 0,
        vy: 0,
      };
    }

    function sportsPlayer(match, team, number, role, along, across) {
      const kit = match.kits[team],
        keeper = role === 'goalkeeper',
        look = keeper
          ? { primary: kit.keeper || '#e5c84c', secondary: '#1b1b20', pattern: 'plain', shorts: '#1b1b20', socks: kit.keeper || '#e5c84c' }
          : kit,
        spot = sportsPoint(match, team, along, across);
      return Object.assign(sportsPerson(match, team + '-' + number, 'athlete', spot.x, spot.y, look), {
        team,
        number,
        role,
        formationAlong: along,
        formationAcross: across,
        a: team === 0 ? 0 : Math.PI,
      });
    }

    // Referees in black, assistants with their flags, stewards in yellow bibs.
    const SPORTS_OFFICIAL_KIT = { primary: '#16171b', secondary: '#16171b', pattern: 'plain', shorts: '#16171b', socks: '#16171b' };
    const SPORTS_STEWARD_KIT = { primary: '#e6e23a', secondary: '#f08c1c', pattern: 'hoops', shorts: '#232a36', socks: '#232a36' };

    function createSportsMatch(sport, fixture) {
      const venue = SPORTS_VENUES[sport];
      const match = {
        sport,
        venue,
        fixture,
        teams: [fixture.home, fixture.away],
        kits: fixture.kits,
        calendar: SPORTS_CALENDAR[sport],
        randomSeed: fixture.seed || 22111,
        time: 0,
        players: [],
        officials: [],
        stewards: [],
        people: [],
        ball: {
          x: venue.x + venue.w / 2,
          y: venue.y + venue.h / 2,
          z: venue.ballRadius,
          radius: venue.ballRadius,
          mode: 'loose',
          ownerId: null,
          flight: null,
          vx: 0,
          vy: 0,
          vz: 0,
          spin: 0,
          lastTouchTeam: 0,
          lastTouch: null,
          looseTime: 0,
        },
        scores: [0, 0],
        possessionTeam: 0,
        possessionClock: 0,
        decisionTimer: 0,
        status: 'NEXT MATCH',
        stage: 'new',
        period: -1,
        clock: 0,
        remaining: 0,
        phase: 'play',
        restart: null,
        lastEvent: null,
        events: [],
        goalFlash: null,
        invader: null,
        abandoned: false,
        panicAt: null,
        panicSource: null,
        casualties: 0,
        policeCallAt: null,
        humanGoals: 0,
        freeGoals: 0,
        stats: {
          passes: 0,
          completedPasses: 0,
          interceptions: 0,
          tackles: 0,
          shots: 0,
          scores: 0,
          rebounds: 0,
          saves: 0,
          restarts: 0,
          offside: 0,
        },
      };
      const formation =
        sport === 'basketball'
          ? [
              ['guard', 0.43, 0.5],
              ['wing', 0.56, 0.24],
              ['wing', 0.57, 0.76],
            ]
          : [
              ['goalkeeper', 0.045, 0.5],
              ['defender', 0.23, 0.13],
              ['defender', 0.2, 0.37],
              ['defender', 0.2, 0.63],
              ['defender', 0.23, 0.87],
              ['midfielder', 0.41, 0.24],
              ['midfielder', 0.39, 0.5],
              ['midfielder', 0.41, 0.76],
              ['forward', 0.64, 0.17],
              ['forward', 0.67, 0.5],
              ['forward', 0.64, 0.83],
            ];
      for (let team = 0; team < 2; team++) {
        for (let index = 0; index < formation.length; index++) {
          match.players.push(sportsPlayer(match, team, index + 1, ...formation[index]));
        }
      }
      const centerX = venue.x + venue.w / 2,
        centerY = venue.y + venue.h / 2;
      match.officials.push(sportsPerson(match, 'referee', 'referee', centerX - 30, centerY + 40, SPORTS_OFFICIAL_KIT));
      if (sport === 'soccer') {
        match.officials.push(sportsPerson(match, 'assistant-1', 'assistant', venue.x + venue.w * 0.25, venue.y - 2, SPORTS_OFFICIAL_KIT));
        match.officials.push(sportsPerson(match, 'assistant-2', 'assistant', venue.x + venue.w * 0.75, venue.y + venue.h + 2, SPORTS_OFFICIAL_KIT));
      }
      match.people.push(...match.players, ...match.officials);
      // Until the teams come out, nobody is on the field.
      for (const person of match.people) person.hidden = true;
      return match;
    }

    const sportsMatches = {
      basketball: null,
      soccer: null,
    };
    // A fixture abandoned after violence: that day's other fixtures are called off.
    const sportsAbandoned = { basketball: null, soccer: null };
    // Everything the combat code may hit, rebuilt once a frame (sportsTargets()).
    const sportsTargetList = [];
    // The player as the matches see them: how fast they are moving (for dribbling)
    // and when (in gameTime) they may next touch or kick the ball.
    const sportsHuman = { x: 0, y: 0, speed: 0, vx: 0, vy: 0, kickLock: 0, touchLock: 0, possessedFor: 0 };
    let sportsStepAccumulator = 0;

    function resetSports() {
      sportsMatches.basketball = null;
      sportsMatches.soccer = null;
      sportsAbandoned.basketball = null;
      sportsAbandoned.soccer = null;
      sportsTargetList.length = 0;
      sportsStepAccumulator = 0;
      for (const sport of Object.keys(sportsMatches)) sportsFollowSchedule(sport);
      // A new game clears the betting slips too (campaign.js load() restores them).
      resetSportsbook();
    }
