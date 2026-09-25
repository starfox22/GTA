    // BEGIN SUBSYSTEM: src/sports.js — Live basketball and soccer matches
    /**
     * Live city sports
     * Source: src/sports.js
     * Scope: shared game closure.
     * Six basketball players and twenty-two football players make possession-based
     * decisions. Passes, shots, rebounds, saves and scores come from persistent match
     * state; the ball and the players do not follow a prerecorded decorative loop.
     *
     * MATCH DAY (sports-fixtures.js decides who plays and when)
     * - Each venue shows one fixture at a time. The world clock places it: before
     *   the warm-up the pitch is empty and the boards announce the next match;
     *   the teams come out to warm up, kick off at the listed time, break at half
     *   time (quarter breaks on the court), and leave after full time while the
     *   result stays on the boards. `match.stage` is that timeline stage and
     *   `match.phase` the state of play within it (play, restart, celebrate).
     * - Officials: a referee and two assistants at the stadium, one referee on the
     *   court. They whistle kickoffs, goals, breaks, full time and pitch invaders.
     *
     * PEOPLE LIKE ANYONE ELSE
     * - Athletes, officials and stewards are ordinary people to the combat code:
     *   sportsTargets() is added to the bullet, knife, blast and vehicle target
     *   lists, so they are hit by strikePerson()/knockPerson() like pedestrians
     *   and bleed the same way. sportsCheckHarm() notices the damage: the match
     *   is abandoned, everyone on the field runs for the exits, the stands empty
     *   (sports3d.js), fans stream out of the gates as real pedestrians who panic
     *   through crowd.js, and the crowd calls it in (crime()). The dead stay down
     *   and the venue stays closed until the next day's fixture.
     *
     * THE PLAYER ON THE PITCH (soccer)
     * - Gaps in the perimeter boards (sports-world.js) lead from the concourse on
     *   to the grass. Walking into the ball dribbles it (ownerId SPORTS_HUMAN);
     *   E kicks it the way you face (hold Shift, walking, for a softer, lower
     *   strike): sportsKick(). The ball rolls with friction, bounces off posts,
     *   the bar and the boards, and a goal is the whole ball crossing the line
     *   between the posts and under the bar.
     * - During a match the players contest the ball (chase, tackle, the keeper
     *   saves), the referee whistles, and after a while (or a goal) two stewards
     *   come to walk you out of the ground. Score and the crowd roars, the boards
     *   flash GOAL! and there is a small reward.
     *
     * Integration contract:
     * - Call updateSports(deltaSeconds) during play and resetSports() on a new game.
     * - Render match.people (players, officials, stewards; skip `hidden`) using the
     *   athlete model, with optional action-specific poses. The separate ball has
     *   world x/y and height z. Venue x/y is its top-left corner; both matches
     *   attack along the world x axis (team 0, the home side, attacks east).
     * - drawSports(context) draws people, balls and scores for the two-dimensional
     *   fallback renderer; sports-world.js owns the static ground markings.
     * - getSportsSnapshot() returns copies for tests and independent browser review;
     *   sportsConsole() adds the developer-console methods (match, ballState...).
     *
     * The established human meshes are approximately 18 world units tall. The court
     * and pitch use the existing city's compressed map scale; hoops, goals and balls
     * deliberately follow the HUMAN mesh proportions, rather than applying the
     * nominal map distance conversion to those visible objects.
     */

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
    }

    function sportsRecordEvent(match, type, player, detail = '') {
      const event = {
        time: Number(match.time.toFixed(2)),
        clock: Math.floor(match.clock),
        type,
        team: player ? player.team : null,
        playerId: player ? player.id : null,
        detail,
      };
      match.lastEvent = event;
      match.events.push(event);
      if (match.events.length > 24) match.events.shift();
    }

    function sportsSetAction(player, action, duration) {
      player.action = action;
      player.actionTime = duration;
      player.actionDuration = duration;
    }

    function sportsTeamName(match, team) {
      return match.teams[team].name;
    }

    function sportsCarrier(match) {
      if (!match.ball.ownerId || match.ball.ownerId === SPORTS_HUMAN) return null;
      return match.players.find((athlete) => athlete.id === match.ball.ownerId) || null;
    }

    function sportsGivePossession(match, player) {
      if (match.possessionTeam !== player.team) match.possessionClock = 0;
      match.possessionTeam = player.team;
      match.ball.ownerId = player.id;
      match.ball.lastTouchTeam = player.team;
      match.ball.lastTouch = player.id;
      match.ball.mode = 'dribble';
      match.ball.flight = null;
      match.ball.vx = match.ball.vy = match.ball.vz = 0;
      player.possessionTime = 0;
      player.tackleCooldown = Math.max(player.tackleCooldown, 0.5);
      match.decisionTimer = (match.sport === 'basketball' ? 0.65 : 0.9) + sportsRandom(match) * 0.65;
      match.status = sportsTeamName(match, player.team) + ' IN POSSESSION';
      sportsSetAction(player, 'dribble', 0);
      sportsAttachBall(match, player);
    }

    function sportsAttachBall(match, owner) {
      const basketball = match.sport === 'basketball';
      const heading = owner.a;
      const stride = match.time * (basketball ? 8 : 6) + owner.number;
      const reach = basketball ? 5.1 : 5.0 + Math.max(0, Math.sin(stride)) * 2.7;
      match.ball.x = owner.x + Math.cos(heading) * reach - (basketball ? Math.sin(heading) * 2.5 : 0);
      match.ball.y = owner.y + Math.sin(heading) * reach + (basketball ? Math.cos(heading) * 2.5 : 0);
      match.ball.z = basketball
        ? match.ball.radius + Math.abs(Math.sin(stride)) * 8.6
        : match.ball.radius + Math.max(0, Math.sin(stride)) * 0.45;
      match.ball.spin += Math.hypot(owner.vx, owner.vy) / match.ball.radius / 30;
    }

    /* Move toward a point without leaving the field (clamp) or freely (walking off). */
    function sportsMovePlayer(match, athlete, target, speed, deltaSeconds, clampToField = true) {
      const venue = match.venue;
      const inset = match.sport === 'basketball' ? 5 : 4;
      const targetX = clampToField ? sportsLimit(target.x, venue.x + inset, venue.x + venue.w - inset) : target.x;
      const targetY = clampToField ? sportsLimit(target.y, venue.y + inset, venue.y + venue.h - inset) : target.y;
      const dx = targetX - athlete.x;
      const dy = targetY - athlete.y;
      const distance = Math.hypot(dx, dy);
      const travel = Math.min(distance, speed * deltaSeconds);
      const previousX = athlete.x;
      const previousY = athlete.y;
      if (distance > 0.5) {
        athlete.x += (dx / distance) * travel;
        athlete.y += (dy / distance) * travel;
        athlete.a = Math.atan2(dy, dx);
      }
      athlete.vx = (athlete.x - previousX) / deltaSeconds;
      athlete.vy = (athlete.y - previousY) / deltaSeconds;
      athlete.walking = travel > 0.025;
      athlete.walk += travel * 0.34;
      return distance;
    }

    function sportsKeepPlayersApart(match) {
      // Small body separation prevents teammates occupying one exact catch point.
      const minimum = match.sport === 'basketball' ? 7.2 : 8;
      const human = sportsHumanOnField(match);
      for (let firstIndex = 0; firstIndex < match.players.length; firstIndex++) {
        const first = match.players[firstIndex];
        for (let secondIndex = firstIndex + 1; secondIndex < match.players.length; secondIndex++) {
          const second = match.players[secondIndex];
          const dx = second.x - first.x;
          const dy = second.y - first.y;
          const distance = Math.hypot(dx, dy);
          if (distance >= minimum) continue;
          const directionX = distance > 0.01 ? dx / distance : 1;
          const directionY = distance > 0.01 ? dy / distance : 0;
          const push = (minimum - distance) * 0.26;
          first.x -= directionX * push;
          first.y -= directionY * push;
          second.x += directionX * push;
          second.y += directionY * push;
        }
        // The player is a body on the pitch too: players step round them.
        if (human) {
          const dx = first.x - player.x,
            dy = first.y - player.y,
            distance = Math.hypot(dx, dy);
          if (distance < 12 && distance > 0.01) {
            first.x += (dx / distance) * (12 - distance) * 0.5;
            first.y += (dy / distance) * (12 - distance) * 0.5;
          }
        }
        first.x = sportsLimit(first.x, match.venue.x + 4, match.venue.x + match.venue.w - 4);
        first.y = sportsLimit(first.y, match.venue.y + 4, match.venue.y + match.venue.h - 4);
      }
    }

    function sportsNearestOpponent(match, athlete) {
      let nearest = null;
      let nearestDistance = Infinity;
      for (const opponent of match.players) {
        if (opponent.team === athlete.team) continue;
        const distance = sportsDistance(athlete, opponent);
        if (distance < nearestDistance) {
          nearest = opponent;
          nearestDistance = distance;
        }
      }
      return { player: nearest, distance: nearestDistance };
    }

    function sportsPassLaneClearance(match, passer, receiver) {
      const dx = receiver.x - passer.x;
      const dy = receiver.y - passer.y;
      const lengthSquared = dx * dx + dy * dy;
      let clearance = 100;
      for (const opponent of match.players) {
        if (opponent.team === passer.team) continue;
        const portion =
          ((opponent.x - passer.x) * dx + (opponent.y - passer.y) * dy) / Math.max(1, lengthSquared);
        if (portion < 0.1 || portion > 0.95) continue;
        clearance = Math.min(
          clearance,
          Math.hypot(opponent.x - passer.x - dx * portion, opponent.y - passer.y - dy * portion),
        );
      }
      return clearance;
    }

    function sportsBestReceiver(match, carrier) {
      let best = null;
      let bestValue = -Infinity;
      const direction = sportsAttackDirection(carrier.team);
      for (const teammate of match.players) {
        if (teammate.team !== carrier.team || teammate === carrier || teammate.role === 'goalkeeper')
          continue;
        const distance = sportsDistance(carrier, teammate);
        if (distance < 12 || distance > (match.sport === 'basketball' ? 100 : 210)) continue;
        if (match.sport === 'soccer' && sportsOffside(match, carrier, teammate)) continue;
        const space = sportsNearestOpponent(match, teammate).distance;
        const clearance = sportsPassLaneClearance(match, carrier, teammate);
        const progress = (teammate.x - carrier.x) * direction;
        const value =
          Math.min(space, 40) +
          Math.min(clearance, 24) * 1.2 +
          progress * (match.sport === 'basketball' ? 0.25 : 0.32) -
          distance * 0.06 +
          sportsRandom(match) * 5;
        if (value > bestValue) {
          best = teammate;
          bestValue = value;
        }
      }
      return best;
    }

    function sportsOffside(match, passer, receiver) {
      if (match.sport !== 'soccer') return false;
      const direction = sportsAttackDirection(passer.team);
      const defenders = match.players
        .filter((athlete) => athlete.team !== passer.team)
        .map((athlete) => athlete.x * direction)
        .sort((first, second) => second - first);
      const receiverProgress = receiver.x * direction;
      const midfield = (match.venue.x + match.venue.w / 2) * direction;
      return (
        receiverProgress > midfield &&
        receiverProgress > passer.x * direction + 2 &&
        receiverProgress > defenders[1] + 2
      );
    }

    function sportsLaunchBall(match, owner, type, destination, endHeight, duration, arc, extra = {}) {
      match.ball.mode = type;
      match.ball.ownerId = null;
      match.ball.lastTouch = owner.id;
      match.ball.flight = {
        type,
        team: owner.team,
        sourceId: owner.id,
        elapsed: 0,
        duration,
        startX: match.ball.x,
        startY: match.ball.y,
        startZ: type === 'basketball-shot' ? 19 : match.ball.z,
        endX: destination.x,
        endY: destination.y,
        endZ: endHeight,
        arc,
        ...extra,
      };
      match.ball.z = match.ball.flight.startZ;
      sportsSetAction(owner, type.includes('shot') ? 'shoot' : 'pass', 0.65);
    }

    function sportsPass(match, carrier, receiver) {
      if (match.sport === 'soccer' && sportsOffside(match, carrier, receiver)) {
        match.stats.offside++;
        sportsRecordEvent(match, 'offside', receiver);
        sportsWhistle(match, 'short');
        sportsBeginRestart(match, 1 - carrier.team, receiver, 'OFFSIDE · FREE KICK', 1);
        return;
      }
      const duration = sportsLimit(
        sportsDistance(carrier, receiver) / (match.sport === 'basketball' ? 110 : 145),
        0.25,
        1.4,
      );
      // Lead the actual receiver. A moving opponent can still reach the pass first.
      const target = {
        x: sportsLimit(
          receiver.x + receiver.vx * duration * 0.45,
          match.venue.x + 7,
          match.venue.x + match.venue.w - 7,
        ),
        y: sportsLimit(
          receiver.y + receiver.vy * duration * 0.45,
          match.venue.y + 7,
          match.venue.y + match.venue.h - 7,
        ),
      };
      const basketball = match.sport === 'basketball';
      sportsLaunchBall(
        match,
        carrier,
        'pass',
        target,
        basketball ? 9 : match.ball.radius,
        duration,
        basketball ? 2 : 2.6,
        { receiverId: receiver.id },
      );
      match.stats.passes++;
      sportsRecordEvent(match, 'pass', carrier, receiver.id);
    }

    function sportsBasketballShot(match, carrier) {
      const hoop = sportsGoal(match, carrier.team);
      const distance = sportsDistance(carrier, hoop);
      const pressure = sportsNearestOpponent(match, carrier).distance;
      const chance = sportsLimit(
        0.84 - distance * 0.0065 - Math.max(0, 15 - pressure) * 0.018,
        0.2,
        0.79,
      );
      const made = sportsRandom(match) < chance;
      const missAngle = sportsRandom(match) * Math.PI * 2;
      const missRadius = made ? 0 : 3.8 + sportsRandom(match) * 6;
      sportsLaunchBall(
        match,
        carrier,
        'basketball-shot',
        {
          x: hoop.x + Math.cos(missAngle) * missRadius,
          y: hoop.y + Math.sin(missAngle) * missRadius,
        },
        match.venue.hoopHeight,
        sportsLimit(0.6 + distance / 85, 0.7, 1.5),
        17 + distance * 0.08,
        { made, points: distance >= match.venue.threePointRadius ? 3 : 2 },
      );
      match.stats.shots++;
      match.status = 'SHOT IN THE AIR';
      sportsRecordEvent(match, 'shot', carrier);
    }

    function sportsSoccerShot(match, carrier) {
      const goal = sportsGoal(match, carrier.team);
      const distance = sportsDistance(carrier, goal);
      const pressure = sportsNearestOpponent(match, carrier).distance;
      const keeper = match.players.find(
        (athlete) => athlete.team !== carrier.team && athlete.role === 'goalkeeper',
      );
      // Aim away from the keeper; distance and pressure increase physical inaccuracy.
      const side = keeper.y > goal.y ? -1 : 1;
      const error = (sportsRandom(match) - 0.5) * (8 + distance * 0.12 + Math.max(0, 12 - pressure));
      const target = { x: goal.x, y: goal.y + side * match.venue.goalWidth * 0.36 + error };
      const endHeight = 1.2 + sportsRandom(match) * (distance > 125 ? 31 : 19);
      sportsLaunchBall(
        match,
        carrier,
        'soccer-shot',
        target,
        endHeight,
        sportsLimit(distance / 190, 0.25, 1.4),
        2.5 + sportsRandom(match) * 7,
      );
      match.stats.shots++;
      match.status = 'SHOT ON GOAL';
      sportsRecordEvent(match, 'shot', carrier);
    }

    function sportsBeginRestart(match, team, point, label, delay) {
      const inset = match.sport === 'basketball' ? 6 : 8;
      const spot = {
        x: sportsLimit(point.x, match.venue.x + inset, match.venue.x + match.venue.w - inset),
        y: sportsLimit(point.y, match.venue.y + inset, match.venue.y + match.venue.h - inset),
      };
      const candidates = match.players.filter(
        (athlete) =>
          athlete.team === team &&
          (label.includes('GOAL KICK') ? athlete.role === 'goalkeeper' : athlete.role !== 'goalkeeper'),
      );
      const taker = candidates.sort(
        (first, second) => sportsDistance(first, spot) - sportsDistance(second, spot),
      )[0];
      match.restart = { team, x: spot.x, y: spot.y, takerId: taker.id, delay, elapsed: 0, label };
      match.phase = 'restart';
      match.status = label;
      match.possessionClock = 0;
      match.ball.ownerId = null;
      match.ball.flight = null;
      match.ball.mode = 'restart';
      match.ball.x = spot.x;
      match.ball.y = spot.y;
      match.ball.z = match.ball.radius;
      match.ball.vx = match.ball.vy = match.ball.vz = 0;
      match.stats.restarts++;
    }

    /**
     * A score. `byPlayer` marks a goal the player put in: it counts for the side
     * attacking that end (the referee has given up arguing), and the boards,
     * the crowd and the player's wallet all make a fuss of it.
     */
    function sportsScore(match, team, points, scorer, byPlayer = false) {
      match.scores[team] += points;
      match.stats.scores++;
      match.status = byPlayer
        ? 'GOAL! PITCH INVADER SCORES'
        : sportsTeamName(match, team) + (match.sport === 'basketball' ? ' +' + points : ' GOAL!');
      match.phase = 'celebrate';
      match.celebrationTimer = match.sport === 'basketball' ? 1.1 : byPlayer ? 4 : 3;
      match.nextRestartTeam = 1 - team;
      match.goalFlash = { time: match.time, team, byPlayer, points };
      sportsRecordEvent(match, byPlayer ? 'invader-goal' : 'score', scorer, String(points));
      for (const athlete of match.players) {
        if (athlete.team === team && !byPlayer) sportsSetAction(athlete, 'celebrate', match.celebrationTimer);
      }
      match.ball.flight = null;
      match.ball.ownerId = null;
      if (match.sport === 'soccer') {
        // The ball carries on into the net.
        match.ball.mode = 'scored';
        const into = sportsAttackDirection(team);
        match.ball.vx = into * Math.max(40, Math.abs(match.ball.vx) * 0.5);
        match.ball.vy *= 0.3;
        sportsWhistle(match, 'short');
        // The player's goal has the whole ground up; otherwise the scorers' end.
        sportsCrowdRoar(match, byPlayer ? 1.2 : 1, byPlayer ? null : team);
      } else match.ball.mode = 'scored';
      if (byPlayer) sportsHumanGoal(match);
    }

    function sportsHumanGoal(match) {
      match.humanGoals++;
      if (match.invader) match.invader.goalAt = match.time;
      announce(match.teams[0].short + ' ' + match.scores[0] + ' - ' + match.scores[1] + ' ' + match.teams[1].short, 'GOAL!', 3);
      // A small reward for the first three goals of each match.
      if (match.humanGoals <= 3) {
        cash += 250;
        tell(
          match.humanGoals === 1
            ? 'PITCH INVADER SCORES · +$250 · THE STADIUM LOVES YOU'
            : 'ANOTHER ONE · +$250 · THEY ARE SINGING YOUR NAME',
          3.5,
        );
      } else tell('GOAL! The stewards are on their way.', 3);
    }

    function sportsLooseBall(match, velocityX, velocityY, verticalSpeed = 0) {
      match.ball.flight = null;
      match.ball.ownerId = null;
      match.ball.mode = 'loose';
      match.ball.vx = velocityX;
      match.ball.vy = velocityY;
      match.ball.vz = verticalSpeed;
      match.ball.looseTime = 0;
      match.ball.keeperTried = false;
    }

    function sportsResolveFlight(match, flight) {
      const source = match.players.find((athlete) => athlete.id === flight.sourceId);
      if (flight.type === 'pass') {
        const receiver = match.players.find((athlete) => athlete.id === flight.receiverId);
        if (receiver && sportsDistance(receiver, match.ball) < 15) {
          match.stats.completedPasses++;
          sportsGivePossession(match, receiver);
        } else
          sportsLooseBall(
            match,
            (flight.endX - flight.startX) * 0.18,
            (flight.endY - flight.startY) * 0.18,
          );
        return;
      }
      if (flight.type === 'basketball-shot') {
        if (flight.made) {
          sportsScore(match, flight.team, flight.points, source);
        } else {
          const hoop = sportsGoal(match, flight.team);
          sportsLooseBall(
            match,
            (match.ball.x - hoop.x) * 1.8 - sportsAttackDirection(flight.team) * 7,
            (match.ball.y - hoop.y) * 2,
            2,
          );
          match.status = 'REBOUND';
          sportsRecordEvent(match, 'miss', source);
        }
        return;
      }
      const goal = sportsGoal(match, flight.team);
      const insideGoal =
        Math.abs(match.ball.y - goal.y) < match.venue.goalWidth / 2 - match.ball.radius &&
        match.ball.z < match.venue.goalHeight - match.ball.radius;
      if (insideGoal) sportsScore(match, flight.team, 1, source);
      else {
        sportsRecordEvent(match, 'wide', source);
        const restartPoint = sportsPoint(match, 1 - flight.team, 0.075, 0.5);
        sportsBeginRestart(match, 1 - flight.team, restartPoint, 'GOAL KICK', 1.3);
      }
    }

    /**
     * BALL PHYSICS
     * A loose ball rolls with friction, bounces (losing half its speed), clips
     * the posts and the crossbar, and counts as a goal once it is wholly over
     * the line between the posts and under the bar. Outside live play the
     * perimeter boards keep it on the pitch; during play it goes out for a
     * throw-in, goal kick or corner as before.
     */
    const SPORTS_POST_RADIUS = 0.7;
    function sportsBounceOff(ball, normalX, normalY, restitution) {
      const along = ball.vx * normalX + ball.vy * normalY;
      if (along >= 0) return;
      ball.vx -= (1 + restitution) * along * normalX;
      ball.vy -= (1 + restitution) * along * normalY;
    }

    /* Posts, crossbar and net at both ends. Returns the scoring team if the ball
       crossed a goal line into the goal during this step, else -1. */
    function sportsGoalFrame(match, previousX) {
      const ball = match.ball,
        venue = match.venue,
        centerY = venue.y + venue.h / 2,
        half = venue.goalWidth / 2,
        reach = ball.radius + SPORTS_POST_RADIUS;
      let scored = -1;
      for (const end of [0, 1]) {
        const lineX = end ? venue.x + venue.w : venue.x,
          outward = end ? 1 : -1;
        // Posts: vertical cylinders at each end of the goal mouth.
        if (ball.z < venue.goalHeight + ball.radius)
          for (const postY of [centerY - half, centerY + half]) {
            const dx = ball.x - lineX,
              dy = ball.y - postY,
              distance = Math.hypot(dx, dy);
            if (distance < reach && distance > 0.001) {
              ball.x = lineX + (dx / distance) * reach;
              ball.y = postY + (dy / distance) * reach;
              sportsBounceOff(ball, dx / distance, dy / distance, 0.6);
              match.postHit = match.time;
            }
          }
        // Crossbar: a horizontal bar along the goal line at goalHeight.
        const barDx = ball.x - lineX,
          barDz = ball.z - venue.goalHeight,
          barDistance = Math.hypot(barDx, barDz);
        if (Math.abs(ball.y - centerY) < half && barDistance < reach && barDistance > 0.001) {
          const nx = barDx / barDistance,
            nz = barDz / barDistance,
            along = ball.vx * nx + ball.vz * nz;
          if (along < 0) {
            ball.vx -= 1.6 * along * nx;
            ball.vz -= 1.6 * along * nz;
          }
          ball.x = lineX + nx * reach;
          ball.z = venue.goalHeight + nz * reach;
          match.postHit = match.time;
        }
        // Over the line: the whole ball past it, between the posts, under the bar.
        const wasIn = (previousX - lineX) * outward < ball.radius,
          nowOut = (ball.x - lineX) * outward >= ball.radius;
        if (
          wasIn &&
          nowOut &&
          Math.abs(ball.y - centerY) < half - ball.radius &&
          ball.z < venue.goalHeight - ball.radius
        )
          scored = end ? 0 : 1;
      }
      return scored;
    }

    /* Keep a ball that went in inside the net: the back and sides soak it up. */
    function sportsHoldInNet(match) {
      const ball = match.ball,
        venue = match.venue,
        centerY = venue.y + venue.h / 2,
        half = venue.goalWidth / 2 - ball.radius,
        end = ball.x > venue.x + venue.w / 2 ? 1 : 0,
        lineX = end ? venue.x + venue.w : venue.x,
        outward = end ? 1 : -1,
        depth = venue.goalDepth - 2 - ball.radius;
      if ((ball.x - lineX) * outward > depth) {
        ball.x = lineX + outward * depth;
        ball.vx *= -0.15;
      }
      if (Math.abs(ball.y - centerY) > half) {
        ball.y = centerY + Math.sign(ball.y - centerY) * half;
        ball.vy *= -0.2;
      }
      if (ball.z > venue.goalHeight - 3) {
        ball.z = venue.goalHeight - 3;
        ball.vz = Math.min(0, ball.vz);
      }
    }

    function sportsIntegrateBall(match, deltaSeconds) {
      const ball = match.ball;
      ball.x += ball.vx * deltaSeconds;
      ball.y += ball.vy * deltaSeconds;
      ball.vz -= 76 * deltaSeconds;
      ball.z += ball.vz * deltaSeconds;
      if (ball.z <= ball.radius) {
        ball.z = ball.radius;
        ball.vz = Math.abs(ball.vz) > 6 ? -ball.vz * 0.48 : 0;
        // Rolling on grass (or the court) bleeds speed away.
        const friction = Math.exp(-(match.sport === 'soccer' ? 1.05 : 1.3) * deltaSeconds);
        ball.vx *= friction;
        ball.vy *= friction;
        if (Math.hypot(ball.vx, ball.vy) < 1.5) ball.vx = ball.vy = 0;
      }
      ball.spin += (Math.hypot(ball.vx, ball.vy) * deltaSeconds) / ball.radius;
    }

    /* The boards around the pitch (or the edge of the court) outside live play. */
    function sportsBallBoards(match) {
      const ball = match.ball,
        venue = match.venue,
        margin = match.sport === 'soccer' ? PITCH_FENCE.inset - 0.5 : 6,
        left = venue.x - margin + ball.radius,
        right = venue.x + venue.w + margin - ball.radius,
        top = venue.y - margin + ball.radius,
        bottom = venue.y + venue.h + margin - ball.radius;
      if (ball.x < left || ball.x > right) {
        ball.x = sportsLimit(ball.x, left, right);
        ball.vx *= -0.55;
        match.boardHit = match.time;
      }
      if (ball.y < top || ball.y > bottom) {
        ball.y = sportsLimit(ball.y, top, bottom);
        ball.vy *= -0.55;
        match.boardHit = match.time;
      }
    }

    function sportsUpdateBall(match, deltaSeconds, live) {
      const ball = match.ball;
      if (ball.ownerId === SPORTS_HUMAN) {
        sportsCarryWithHuman(match, live);
        return;
      }
      const carrier = sportsCarrier(match);
      if (carrier) {
        sportsAttachBall(match, carrier);
        return;
      }
      const flight = ball.flight;
      if (flight) {
        flight.elapsed += deltaSeconds;
        const fraction = Math.min(1, flight.elapsed / flight.duration);
        ball.x = flight.startX + (flight.endX - flight.startX) * fraction;
        ball.y = flight.startY + (flight.endY - flight.startY) * fraction;
        ball.z =
          flight.startZ +
          (flight.endZ - flight.startZ) * fraction +
          4 * flight.arc * fraction * (1 - fraction);
        ball.spin += deltaSeconds * 12;
        if (flight.type === 'pass' && flight.elapsed > 0.15) {
          for (const opponent of match.players) {
            if (opponent.team === flight.team || ball.z > (match.sport === 'basketball' ? 15 : 5))
              continue;
            if (sportsDistance(opponent, ball) < (match.sport === 'basketball' ? 5.6 : 5.1)) {
              match.stats.interceptions++;
              sportsRecordEvent(match, 'interception', opponent);
              sportsGivePossession(match, opponent);
              return;
            }
          }
        }
        if (flight.type === 'soccer-shot') {
          const keeper = match.players.find(
            (athlete) => athlete.team !== flight.team && athlete.role === 'goalkeeper',
          );
          if (ball.z < match.venue.goalHeight + 2 && sportsDistance(keeper, ball) < 12) {
            match.stats.saves++;
            ball.lastTouchTeam = keeper.team;
            sportsSetAction(keeper, 'save', 0.9);
            sportsRecordEvent(match, 'save', keeper);
            if (ball.z < 12 && sportsRandom(match) > 0.4) {
              sportsGivePossession(match, keeper);
              sportsSetAction(keeper, 'save', 0.8);
            } else {
              sportsLooseBall(
                match,
                sportsAttackDirection(keeper.team) * (26 + sportsRandom(match) * 24),
                (sportsRandom(match) - 0.5) * 48,
                7,
              );
              match.status = 'KEEPER PARRIES';
            }
            return;
          }
        }
        if (fraction >= 1) sportsResolveFlight(match, flight);
        return;
      }
      if (ball.mode === 'scored' || ball.mode === 'net') {
        sportsIntegrateBall(match, deltaSeconds);
        if (match.sport === 'soccer') sportsHoldInNet(match);
        else ball.vx = ball.vy = 0;
        // Outside a match a ball in the net comes back to the spot after a moment.
        if (ball.mode === 'net' && match.time - ball.scoredAt > 3.5) sportsRespotBall(match);
        return;
      }
      if (ball.mode === 'restart' && !live) ball.mode = 'loose';
      if (ball.mode !== 'loose') return;
      ball.looseTime += deltaSeconds;
      const previousX = ball.x;
      sportsIntegrateBall(match, deltaSeconds);
      if (match.sport === 'soccer') {
        const scored = sportsGoalFrame(match, previousX);
        if (scored >= 0) {
          sportsBallInGoal(match, scored, live);
          return;
        }
        if (live && match.phase === 'play') sportsKeeperReach(match);
      }
      if (!live) {
        sportsBallBoards(match);
        return;
      }
      const venue = match.venue;
      if (
        ball.x < venue.x ||
        ball.x > venue.x + venue.w ||
        ball.y < venue.y ||
        ball.y > venue.y + venue.h
      ) {
        if (match.phase !== 'play') {
          sportsBallBoards(match);
          return;
        }
        sportsBallOut(match);
        return;
      }
      if (match.phase === 'play' && ball.z < (match.sport === 'basketball' ? 17 : 5)) {
        // A hard kick from the player cannot be trapped by someone it merely passes.
        const hard = ball.lastTouch === SPORTS_HUMAN && Math.hypot(ball.vx, ball.vy) > 150;
        let nearest = null,
          nearestDistance = Infinity;
        for (const athlete of match.players) {
          const distance = sportsDistance(athlete, ball);
          if (distance < nearestDistance) {
            nearest = athlete;
            nearestDistance = distance;
          }
        }
        if (nearest && nearestDistance < (hard ? 4.5 : 8)) {
          if (match.sport === 'basketball') {
            match.stats.rebounds++;
            match.possessionClock = 0;
            sportsRecordEvent(match, 'rebound', nearest);
            sportsSetAction(nearest, 'rebound', 0.7);
          }
          sportsGivePossession(match, nearest);
          if (match.sport === 'basketball') sportsSetAction(nearest, 'rebound', 0.6);
        }
      }
    }

    /* The ball has left the field of play: throw-in, goal kick, corner, inbound. */
    function sportsBallOut(match) {
      const ball = match.ball,
        venue = match.venue;
      const behindGoal = ball.x < venue.x || ball.x > venue.x + venue.w;
      const defendingTeam = ball.x < venue.x ? 0 : 1;
      const corner = behindGoal && match.sport === 'soccer' && ball.lastTouchTeam === defendingTeam;
      const team =
        behindGoal && match.sport === 'soccer'
          ? corner
            ? 1 - defendingTeam
            : defendingTeam
          : 1 - ball.lastTouchTeam;
      const label =
        match.sport === 'basketball'
          ? 'SIDELINE INBOUND'
          : corner
            ? 'CORNER KICK'
            : behindGoal
              ? 'GOAL KICK'
              : 'THROW IN';
      const spot = corner
        ? {
            x: ball.x < venue.x ? venue.x : venue.x + venue.w,
            y: ball.y < venue.y + venue.h / 2 ? venue.y : venue.y + venue.h,
          }
        : behindGoal && match.sport === 'soccer'
          ? sportsPoint(match, team, 0.075, 0.5)
          : { x: ball.x, y: ball.y };
      sportsBeginRestart(match, team, spot, label, 1);
    }

    /* The ball crossed a goal line into the goal. */
    function sportsBallInGoal(match, team, live) {
      const ball = match.ball,
        byPlayer = ball.lastTouch === SPORTS_HUMAN;
      if (live && match.phase === 'play') {
        const scorer = match.players.find((athlete) => athlete.id === ball.lastTouch) || null;
        sportsScore(match, team, 1, scorer, byPlayer);
        return;
      }
      // Outside a match (or while play is stopped) it is a kickabout goal: the
      // boards and whoever is in the stands still cheer it.
      ball.mode = 'net';
      ball.scoredAt = match.time;
      if (!byPlayer) return;
      match.freeGoals++;
      match.goalFlash = { time: match.time, team, byPlayer: true, points: 1, friendly: true };
      sportsCrowdRoar(match, 1, null);
      tell(
        sportsCrowdPresence(match) > 0.05
          ? 'GOAL! The fans are loving the warm-up act.'
          : 'GOAL! Nobody saw it, but the boards did.',
        2.8,
      );
    }

    function sportsRespotBall(match) {
      const ball = match.ball,
        venue = match.venue;
      Object.assign(ball, {
        x: venue.x + venue.w / 2,
        y: venue.y + venue.h / 2,
        z: ball.radius,
        vx: 0,
        vy: 0,
        vz: 0,
        mode: 'loose',
        ownerId: null,
        flight: null,
        lastTouch: null,
      });
    }

    /* The keeper gets one chance at a loose ball heading for the goal. */
    function sportsKeeperReach(match) {
      const ball = match.ball,
        venue = match.venue;
      if (ball.keeperTried || ball.lastTouch !== SPORTS_HUMAN) return;
      for (const keeper of match.players) {
        if (keeper.role !== 'goalkeeper') continue;
        const goal = sportsGoal(match, 1 - keeper.team),
          outward = keeper.team === 0 ? -1 : 1,
          speed = Math.hypot(ball.vx, ball.vy);
        if (ball.vx * outward < 40 || Math.abs(ball.x - goal.x) > 26) continue;
        if (sportsDistance(keeper, ball) > 11 || ball.z > venue.goalHeight + 3) continue;
        ball.keeperTried = true;
        const chance = sportsLimit(0.72 - speed / 900, 0.28, 0.6);
        if (sportsRandom(match) < chance) {
          match.stats.saves++;
          sportsSetAction(keeper, 'save', 0.9);
          sportsRecordEvent(match, 'save', keeper, 'invader');
          ball.lastTouch = keeper.id;
          ball.lastTouchTeam = keeper.team;
          if (speed < 260 && sportsRandom(match) < 0.5) {
            sportsGivePossession(match, keeper);
            match.status = 'KEEPER HOLDS IT';
          } else {
            sportsLooseBall(match, -outward * (60 + sportsRandom(match) * 40), (sportsRandom(match) - 0.5) * 80, 12);
            ball.lastTouch = keeper.id;
            match.status = 'WHAT A SAVE!';
          }
        }
      }
    }

    function sportsBasketballPositions(match, deltaSeconds) {
      const carrier = sportsCarrier(match);
      const offense = match.possessionTeam;
      const goal = sportsGoal(match, offense);
      const activeFlight = match.ball.flight;
      for (const athlete of match.players) {
        let target;
        let speed = 32;
        if (match.ball.mode === 'loose') {
          target = match.ball;
          speed = 36;
        } else if (activeFlight && activeFlight.receiverId === athlete.id) {
          target = { x: activeFlight.endX, y: activeFlight.endY };
          speed = 37;
        } else if (athlete === carrier) {
          const direction = sportsAttackDirection(athlete.team);
          const defender = sportsNearestOpponent(match, athlete);
          const cut = Math.sin(match.time * 1.5 + athlete.number) * 12;
          target = { x: goal.x - direction * 20, y: goal.y + cut };
          if (defender.distance < 11) target.y += athlete.y < defender.player.y ? -13 : 13;
          speed = 26;
        } else if (athlete.team === offense) {
          const cutToRim = activeFlight && activeFlight.type === 'basketball-shot';
          const along = cutToRim ? 0.83 : 0.68 + (athlete.number === 1 ? -0.17 : 0.1);
          const across = cutToRim ? 0.5 + (athlete.number - 2) * 0.12 : athlete.formationAcross;
          target = sportsPoint(match, athlete.team, along, across);
          target.y += Math.sin(match.time * 0.8 + athlete.number * 2) * 6;
        } else {
          const assignment = match.players.find(
            (opponent) => opponent.team !== athlete.team && opponent.number === athlete.number,
          );
          const basket = sportsGoal(match, 1 - athlete.team);
          target = {
            x: assignment.x + (basket.x - assignment.x) * 0.17,
            y: assignment.y + (basket.y - assignment.y) * 0.1,
          };
          speed = 30;
        }
        sportsMovePlayer(match, athlete, target, speed, deltaSeconds);
      }
    }

    function sportsSoccerPositions(match, deltaSeconds) {
      const carrier = sportsCarrier(match);
      const ball = match.ball;
      const humanBall = ball.ownerId === SPORTS_HUMAN;
      const nearestToBall = (count, filter) =>
        match.players
          .filter(filter)
          .sort((first, second) => sportsDistance(first, ball) - sportsDistance(second, ball))
          .slice(0, count);
      // With the player on the ball both teams send their nearest three at them.
      const pressing = humanBall
        ? nearestToBall(3, (athlete) => athlete.role !== 'goalkeeper')
        : nearestToBall(
            2,
            (athlete) => athlete.team !== match.possessionTeam && athlete.role !== 'goalkeeper',
          );
      const looseChasers =
        ball.mode === 'loose' ? nearestToBall(4, (athlete) => athlete.role !== 'goalkeeper') : [];
      for (const athlete of match.players) {
        let target;
        let speed = 33;
        const direction = sportsAttackDirection(athlete.team);
        const ownGoal = sportsGoal(match, 1 - athlete.team);
        if (athlete.role === 'goalkeeper' && athlete !== carrier) {
          const shot =
            ball.flight && ball.flight.type === 'soccer-shot' && ball.flight.team !== athlete.team;
          // A loose ball rolling at goal: step across to where it will cross the line.
          const rolling =
            ball.mode === 'loose' && (ball.x - ownGoal.x) * direction > 0 && -ball.vx * direction > 40;
          const crossing = rolling ? ball.y + (ball.vy * (ownGoal.x - ball.x)) / ball.vx : 0;
          target = {
            x: ownGoal.x + direction * 9,
            y: sportsLimit(
              shot ? ball.flight.endY : rolling ? crossing : ownGoal.y + (ball.y - ownGoal.y) * 0.32,
              ownGoal.y - match.venue.goalWidth * 0.48,
              ownGoal.y + match.venue.goalWidth * 0.48,
            ),
          };
          // Come off the line to smother the player dribbling into the box.
          if (humanBall && Math.abs(ball.x - ownGoal.x) < 70 && Math.abs(ball.y - ownGoal.y) < 60)
            target = { x: ball.x - direction * 4, y: ball.y };
          speed = shot || rolling ? 34 : humanBall ? 30 : 23;
          if (shot && ball.flight.elapsed > 0.15) sportsSetAction(athlete, 'save', 0.3);
        } else if (ball.flight && ball.flight.receiverId === athlete.id) {
          target = { x: ball.flight.endX, y: ball.flight.endY };
          speed = 39;
        } else if (athlete === carrier) {
          const goal = sportsGoal(match, athlete.team);
          const opponent = sportsNearestOpponent(match, athlete);
          target = { x: goal.x - direction * 48, y: goal.y + (athlete.y - goal.y) * 0.58 };
          if (opponent.distance < 17) target.y += athlete.y < opponent.player.y ? -23 : 23;
          // Carry the ball away from the player too.
          if (sportsHumanOnField(match) && sportsDistance(athlete, player) < 30)
            target.y += athlete.y < player.y ? -18 : 18;
          speed = athlete.role === 'goalkeeper' ? 8 : 29;
        } else if (pressing.includes(athlete) || looseChasers.includes(athlete)) {
          const lead = carrier || (humanBall ? sportsHuman : null);
          target = {
            x: ball.x + (lead ? lead.vx * 0.2 : 0),
            y: ball.y + (lead ? lead.vy * 0.2 : 0),
          };
          speed = humanBall ? 38 : 36;
        } else {
          const ownProgress = ((ball.x - ownGoal.x) * direction) / match.venue.w;
          const attacking = athlete.team === match.possessionTeam && !humanBall;
          let along = athlete.formationAlong + (ownProgress - 0.5) * 0.29 + (attacking ? 0.055 : -0.09);
          if (athlete.role === 'forward' && attacking) along = Math.max(along, ownProgress + 0.09);
          along = sportsLimit(along, 0.1, 0.88);
          target = sportsPoint(match, athlete.team, along, athlete.formationAcross);
          target.y += (ball.y - match.venue.y - match.venue.h / 2) * 0.17;
          // Stay onside while providing an outlet. Offside is checked again when
          // a pass is actually kicked, so a defender moving up can stop the play.
          if (attacking && carrier && sportsOffside(match, carrier, { ...athlete, x: target.x })) {
            const defenders = match.players
              .filter((opponent) => opponent.team !== athlete.team)
              .map((opponent) => opponent.x * direction)
              .sort((first, second) => second - first);
            target.x = (Math.max(carrier.x * direction, defenders[1]) - 4) * direction;
          }
        }
        sportsMovePlayer(match, athlete, target, speed, deltaSeconds);
      }
    }

    function sportsDecide(match, deltaSeconds) {
      const carrier = sportsCarrier(match);
      if (!carrier) return;
      carrier.possessionTime += deltaSeconds;
      match.possessionClock += deltaSeconds;
      match.decisionTimer -= deltaSeconds;
      const opponent = sportsNearestOpponent(match, carrier);
      if (
        opponent.distance < (match.sport === 'basketball' ? 8 : 9) &&
        carrier.possessionTime > 0.65 &&
        opponent.player.tackleCooldown <= 0
      ) {
        opponent.player.tackleCooldown = 1.4;
        if (sportsRandom(match) < (match.sport === 'basketball' ? 0.22 : 0.44)) {
          match.stats.tackles++;
          sportsRecordEvent(match, 'steal', opponent.player);
          sportsGivePossession(match, opponent.player);
          return;
        }
      }
      if (match.decisionTimer > 0) return;
      const goal = sportsGoal(match, carrier.team);
      const distance = sportsDistance(carrier, goal);
      const receiver = sportsBestReceiver(match, carrier);
      if (match.sport === 'basketball') {
        const closeShot = distance < 32 && carrier.possessionTime > 0.5;
        const openShot = distance < 68 && opponent.distance > 12 && carrier.possessionTime > 1.0;
        const contestedShot =
          distance < 56 && carrier.possessionTime > 1.0 && sportsRandom(match) < 0.4;
        if (
          closeShot ||
          contestedShot ||
          (openShot && sportsRandom(match) < 0.66) ||
          match.possessionClock > 12
        ) {
          sportsBasketballShot(match, carrier);
          return;
        }
        if (
          receiver &&
          (opponent.distance < 17 || carrier.possessionTime > 2.2 || sportsRandom(match) < 0.4)
        ) {
          sportsPass(match, carrier, receiver);
          return;
        }
      } else {
        // Under pressure from the player, move it on.
        const hounded = sportsHumanOnField(match) && sportsDistance(carrier, player) < 22;
        if (carrier.role === 'goalkeeper' && receiver) {
          sportsPass(match, carrier, receiver);
          return;
        }
        const centrallyPlaced = Math.abs(carrier.y - goal.y) < match.venue.goalWidth * 1.2;
        if (
          (distance < 145 &&
            centrallyPlaced &&
            carrier.possessionTime > 0.65 &&
            (sportsRandom(match) < 0.58 || distance < 85)) ||
          match.possessionClock > 33
        ) {
          sportsSoccerShot(match, carrier);
          return;
        }
        if (
          receiver &&
          (hounded || opponent.distance < 24 || carrier.possessionTime > 2.8 || sportsRandom(match) < 0.38)
        ) {
          sportsPass(match, carrier, receiver);
          return;
        }
      }
      match.decisionTimer = 0.45 + sportsRandom(match) * 0.55;
    }

    function sportsUpdateRestart(match, deltaSeconds) {
      const restart = match.restart;
      restart.elapsed += deltaSeconds;
      restart.delay -= deltaSeconds;
      const taker = match.players.find((athlete) => athlete.id === restart.takerId);
      for (const athlete of match.players) {
        let target =
          athlete === taker
            ? restart
            : sportsPoint(
                match,
                athlete.team,
                Math.min(athlete.formationAlong, restart.label === 'KICKOFF' ? 0.46 : 0.8),
                athlete.formationAcross,
              );
        if (
          athlete !== taker &&
          athlete.team !== restart.team &&
          sportsDistance(target, restart) < 30
        ) {
          target = { x: target.x - sportsAttackDirection(restart.team) * 35, y: target.y };
        }
        // Walking out of the tunnel the players are still off the pitch.
        const onPitch = athlete.y > match.venue.y - 1;
        sportsMovePlayer(match, athlete, target, 40, deltaSeconds, onPitch);
      }
      if (restart.delay <= 0 && sportsDistance(taker, restart) < 7) {
        match.phase = 'play';
        match.restart = null;
        sportsGivePossession(match, taker);
        sportsRecordEvent(match, 'restart', taker, restart.label);
        if (restart.label === 'KICKOFF' || restart.label === 'TIP OFF') sportsWhistle(match, 'short');
      }
    }

    /**
     * OFFICIALS
     * The referee keeps a diagonal off the ball; the assistants run their
     * touchlines level with it, each covering one half.
     */
    function sportsUpdateOfficials(match, deltaSeconds) {
      const ball = match.ball,
        venue = match.venue;
      for (const official of match.officials) {
        if (official.hidden || official.hp <= 0) continue;
        let target;
        if (official.kind === 'referee') {
          const side = sportsAttackDirection(match.possessionTeam);
          target =
            match.sport === 'soccer'
              ? { x: ball.x - side * 34, y: ball.y + (ball.y > venue.y + venue.h / 2 ? -42 : 42) }
              : { x: ball.x - side * 16, y: venue.y + venue.h + 7 };
        } else if (official.id.endsWith('1'))
          target = { x: sportsLimit(ball.x, venue.x + 6, venue.x + venue.w / 2), y: venue.y - 2 };
        else target = { x: sportsLimit(ball.x, venue.x + venue.w / 2, venue.x + venue.w - 6), y: venue.y + venue.h + 2 };
        const distance = sportsMovePlayer(match, official, target, 34, deltaSeconds, false);
        // Face the play when standing still.
        if (distance < 2) official.a = Math.atan2(ball.y - official.y, ball.x - official.x);
        official.actionTime = Math.max(0, official.actionTime - deltaSeconds);
      }
    }

    /**
     * MATCH TIMELINE
     * Once a frame each venue asks the calendar which fixture it is showing and
     * where in it the world clock stands, and steps the match through its
     * stages: out of the tunnel to warm up, kickoff, the break, the second
     * half, full time and away.
     */
    function sportsFollowSchedule(sport) {
      let match = sportsMatches[sport];
      const fixture = sportsCurrentFixture(sport, worldMinutes, sportsAbandoned[sport]);
      if (!match || match.fixture.id !== fixture.id) match = sportsMatches[sport] = createSportsMatch(sport, fixture);
      if (match.abandoned) return match;
      const line = sportsTimeline(fixture, worldMinutes);
      match.clock = line.clock;
      match.remaining = line.remaining;
      if (line.stage !== match.stage || line.period !== match.period) sportsEnterStage(match, line);
      return match;
    }

    function sportsEnterStage(match, line) {
      const previous = match.stage,
        fresh = previous === 'new',
        calendar = match.calendar;
      match.stage = line.stage;
      match.period = line.period;
      match.phase = 'play';
      match.restart = null;
      match.goalFlash = null;
      match.invader = null;
      match.stewards.length = 0;
      match.people = [...match.players, ...match.officials];
      const everyone = match.people;
      if (line.stage === 'upcoming' || line.stage === 'over') {
        for (const person of everyone) person.hidden = true;
        match.status = line.stage === 'over' ? 'FULL TIME' : 'NEXT MATCH';
        sportsRespotBall(match);
        return;
      }
      if (line.stage === 'warmup') {
        // Out of the tunnel (or off the bench) to loosen up in their own half.
        for (const person of everyone) sportsComeOut(match, person, fresh);
        match.status = 'WARM UP';
        sportsRespotBall(match);
        return;
      }
      // Joining a match already under way: a plausible score for the time played.
      if (fresh && line.clock > 0.5) sportsCatchUpScore(match, line.clock);
      if (line.stage === 'live') {
        for (const person of everyone) {
          if (person.hidden || fresh) sportsComeOut(match, person, fresh);
          person.leaving = false;
          person.action = 'run';
        }
        if (fresh)
          for (const athlete of match.players) Object.assign(athlete, sportsPoint(match, athlete.team, athlete.formationAlong, athlete.formationAcross));
        const kickoffTeam = line.period % 2;
        const centre = { x: match.venue.x + match.venue.w / 2, y: match.venue.y + match.venue.h / 2 };
        sportsBeginRestart(match, kickoffTeam, centre, match.sport === 'basketball' ? 'TIP OFF' : 'KICKOFF', fresh ? 0.4 : 1.5);
        match.status = calendar.periodNames[line.period] + ' · ' + match.restart.label;
        return;
      }
      // A break or full time: the whistle, then everyone walks off.
      sportsWhistle(match, line.stage === 'fulltime' ? 'triple' : 'double');
      match.status = line.stage === 'fulltime' ? 'FULL TIME' : calendar.breakName;
      if (line.stage === 'fulltime') {
        sportsRecordEvent(match, 'fulltime', null, match.scores.join('-'));
        // The winners applaud their fans; everyone heads off.
        const winner = match.scores[0] === match.scores[1] ? -1 : match.scores[0] > match.scores[1] ? 0 : 1;
        for (const athlete of match.players) if (athlete.team === winner) sportsSetAction(athlete, 'celebrate', 3);
      }
      for (const person of everyone) person.leaving = !person.hidden;
      if (fresh) for (const person of everyone) person.hidden = true;
      if (match.ball.ownerId !== SPORTS_HUMAN) sportsRespotBall(match);
    }

    /* Someone walks on: from the tunnel at the stadium, from the bench courtside. */
    function sportsComeOut(match, person, instantly) {
      const exit = SPORTS_EXITS[match.sport][0];
      person.hidden = false;
      person.leaving = false;
      if (instantly) {
        const spot =
          person.team >= 0
            ? sportsPoint(match, person.team, person.formationAlong * 0.8, person.formationAcross)
            : { x: person.x, y: person.y };
        person.x = spot.x;
        person.y = spot.y;
      } else if (person.hp > 0) {
        person.x = exit.x + (sportsRandom(match) - 0.5) * 14;
        person.y = exit.y + (match.sport === 'soccer' ? 0 : 4);
      }
    }

    /* Joining a match already under way: a plausible score for the minutes played. */
    function sportsCatchUpScore(match, clock) {
      const calendar = match.calendar,
        share = clock / (calendar.periods * calendar.periodMinutes);
      for (const team of [0, 1]) {
        if (match.sport === 'soccer') {
          // About 1.4 goals a side over a match.
          let goals = 0;
          for (let chance = 0; chance < 6; chance++) if (sportsRandom(match) < share * 0.24) goals++;
          match.scores[team] = goals;
        } else match.scores[team] = Math.round(share * (44 + sportsRandom(match) * 22));
      }
    }

    /* Warming up: gentle jogs between spots in their own half. */
    function sportsUpdateWarmup(match, deltaSeconds) {
      for (const person of match.people) {
        if (person.hidden || person.hp <= 0 || person.knockedFor > 0) continue;
        if (!person.warmupSpot || sportsDistance(person, person.warmupSpot) < 3 || sportsRandom(match) < 0.002) {
          const team = person.team >= 0 ? person.team : sportsRandom(match) < 0.5 ? 0 : 1;
          person.warmupSpot = sportsPoint(match, team, 0.08 + sportsRandom(match) * 0.38, 0.12 + sportsRandom(match) * 0.76);
        }
        sportsMovePlayer(match, person, person.warmupSpot, person.team >= 0 ? 22 : 12, deltaSeconds);
      }
    }

    /* Walking off at a break or full time. */
    function sportsUpdateLeaving(match, deltaSeconds) {
      const exit = SPORTS_EXITS[match.sport][0];
      for (const person of match.people) {
        if (person.hidden || person.hp <= 0 || person.knockedFor > 0) continue;
        if (!person.leaving) {
          person.walking = false;
          continue;
        }
        const spot =
          exit.tunnel || person.team < 0
            ? exit
            : { x: exit.x + (person.team ? 1 : -1) * (12 + person.number * 7), y: exit.y };
        const distance = sportsMovePlayer(match, person, spot, person.actionTime > 0 ? 6 : 24, deltaSeconds, false);
        if (distance < 3) {
          if (exit.tunnel) person.hidden = true;
          else {
            person.leaving = false;
            person.a = Math.PI / 2;
          }
        }
      }
    }

    /**
     * HARM AND PANIC
     * The combat code hurts athletes through strikePerson() and knockPerson()
     * like anyone else; here the match notices. Any casualty (or gunfire, a
     * blast or a stabbing inside the venue) abandons the match.
     */
    function sportsHarmedByPlayer(person) {
      if (person.killedBy === player) return true;
      return !!person.threat && Math.hypot(person.threat.x - player.x, person.threat.y - player.y) < 90;
    }

    function sportsCheckHarm(match, deltaSeconds) {
      for (const person of match.people) {
        if (person.knockedFor > 0) person.knockedFor = Math.max(0, person.knockedFor - deltaSeconds);
        if (person.impactCooldown > 0) person.impactCooldown = Math.max(0, person.impactCooldown - deltaSeconds);
        const hurt = person.hp < person.lastHp - 0.01,
          knocked = person.knockedFor > 0 && !person.wasKnocked;
        person.wasKnocked = person.knockedFor > 0;
        person.lastHp = person.hp;
        if (!hurt && !knocked) continue;
        const byPlayer = sportsHarmedByPlayer(person);
        if (person.hp <= 0 && !person.counted) {
          person.counted = true;
          person.deadTime = person.deadTime || gameTime;
          match.casualties++;
          sportsRecordEvent(match, 'casualty', person, person.kind);
          // A killing in front of thousands of witnesses: a civilian death in the
          // heat model (heat.js), counted once even if strikePerson already did.
          if (byPlayer) recordKill(person);
        }
        if (byPlayer && match.policeCallAt === null) match.policeCallAt = match.time + 2.5;
        sportsAbandon(match, person.threat || person, byPlayer ? player : null);
      }
      // Gunfire, blasts and stabbings inside the venue stop play even if nobody is
      // hit. An incident counts from the check before it (shots fired later in
      // the same frame carry that frame's time, so the comparison is inclusive).
      const since = match.incidentCheckTime ?? gameTime;
      match.incidentCheckTime = gameTime;
      if (match.abandoned || (match.stage !== 'live' && match.stage !== 'warmup')) return;
      for (const incident of crowd.incidents) {
        if (incident.time < since) continue;
        if (!['gunfire', 'explosion', 'melee'].includes(incident.kind)) continue;
        if (!sportsInVenue(match, incident.x, incident.y, match.sport === 'soccer' ? 40 : 160)) continue;
        sportsAbandon(match, incident, incident.attacker);
        if (incident.attacker === player && match.policeCallAt === null) match.policeCallAt = match.time + 3;
        break;
      }
    }

    function sportsInVenue(match, x, y, margin) {
      if (match.sport === 'soccer') return inStadiumLot(x, y, margin);
      const venue = match.venue;
      return x > venue.x - margin && x < venue.x + venue.w + margin && y > venue.y - margin && y < venue.y + venue.h + margin;
    }

    function sportsAbandon(match, source, attacker) {
      if (match.abandoned) return;
      const onField = match.people.some((person) => !person.hidden);
      match.abandoned = true;
      match.stage = 'abandoned';
      match.phase = 'abandoned';
      match.status = 'MATCH ABANDONED';
      match.restart = null;
      match.goalFlash = null;
      match.invader = null;
      match.panicAt = match.time;
      match.panicSource = { x: source.x, y: source.y };
      sportsAbandoned[match.sport] = { id: match.fixture.id, day: match.fixture.day, slot: match.fixture.slot };
      sportsRecordEvent(match, 'abandoned', null);
      const ball = match.ball;
      if (ball.ownerId || ball.flight) sportsLooseBall(match, 0, 0, 0);
      if (ball.mode === 'restart') ball.mode = 'loose';
      for (const person of match.people) {
        if (person.hidden || person.hp <= 0) continue;
        person.fleeing = true;
        person.leaving = false;
        person.fleeTarget = sportsFleeTarget(match, person, source);
      }
      if (onField) sportsWhistle(match, 'long');
      // The crowd heads for the exits; those near the gates see and hear it.
      if (sportsCrowdPresence(match) > 0.05 || onField) {
        sportsCrowdPanicSound(match);
        const gate = match.sport === 'soccer' ? { x: 2689, y: 4872 } : { x: match.venue.x + match.venue.w / 2, y: match.venue.y + match.venue.h / 2 };
        crowdAlarm('melee', gate, attacker, 1.4);
        if (match.sport === 'soccer') sportsFansStampede(match, source, attacker);
      }
      if (Math.hypot(player.x - match.venue.x - match.venue.w / 2, player.y - match.venue.y - match.venue.h / 2) < 1400)
        tell(match.sport === 'soccer' ? 'MATCH ABANDONED · PANIC IN THE STANDS' : 'GAME OVER · THE COURT EMPTIES', 3);
    }

    function sportsFleeTarget(match, person, source) {
      if (match.sport === 'soccer') {
        let best = null,
          bestScore = -Infinity;
        for (const exit of SPORTS_EXITS.soccer) {
          const score = sportsDistance(exit, source) - 0.6 * sportsDistance(exit, person);
          if (score > bestScore) {
            best = exit;
            bestScore = score;
          }
        }
        return best;
      }
      const away = Math.atan2(person.y - source.y, person.x - source.x) + (sportsRandom(match) - 0.5) * 0.8;
      return { x: person.x + Math.cos(away) * 280, y: person.y + Math.sin(away) * 280, tunnel: true };
    }

    function sportsUpdatePanic(match, deltaSeconds) {
      for (const person of match.people) {
        if (person.hidden || person.hp <= 0 || person.knockedFor > 0 || !person.fleeing) {
          person.walking = false;
          person.vx = person.vy = 0;
          continue;
        }
        // The wounded limp; everyone else sprints.
        const speed = person.hp < 20 ? 28 : 62,
          distance = sportsMovePlayer(match, person, person.fleeTarget, speed, deltaSeconds, false);
        person.action = 'run';
        if (distance < 4) person.hidden = true;
      }
      if (match.policeCallAt !== null && match.time >= match.policeCallAt) {
        match.policeCallAt = Infinity;
        if (gameMode === 'play') {
          crime(0.5);
          tell(match.sport === 'soccer' ? 'STADIUM SECURITY CALLED THE POLICE' : 'A WITNESS CALLED THE POLICE', 2.6);
        }
      }
    }

    /* Fans pour out of the turnstiles as ordinary (panicking) pedestrians. */
    function sportsFansStampede(match, source, attacker) {
      if (distanceBetween(player, STADIUM_ESCORT_SPOT) > 1400) return;
      const inc = crowdIncident('melee', source, attacker, 1.4),
        count = Math.round(8 + sportsCrowdPresence(match) * 14);
      for (let index = 0; index < count && pedestrians.length < CROWD_HARD_CAP; index++) {
        const gate = STADIUM_ENTRANCE.gates[index % 2],
          x = gate.x + 4 + sportsRandom(match) * (gate.w - 8),
          y = 4852 + sportsRandom(match) * 34;
        const fan = makeStreetWalker({ x, y, a: Math.PI / 2 }, 'casual');
        const team = index % 3 === 2 ? 1 : 0;
        if (fan.look) fan.look.top = match.kits[team].primary;
        fan.fan = true;
        startReaction(fan, 'flee', 6 + sportsRandom(match) * 5, { x: 2689, y: 4700 }, inc, { scream: index % 4 === 0 });
      }
    }

    /**
     * THE PLAYER ON THE PITCH
     */
    function sportsHumanOnField(match) {
      if (!match || match.sport !== 'soccer' || gameMode !== 'play' || player.car || player.parachute) return false;
      if (player.roof || player.buildingRoof || player.deck || player.swimming) return false;
      const f = PITCH_FENCE;
      return player.x > f.left + f.thickness && player.x < f.right && player.y > f.top + f.thickness && player.y < f.bottom;
    }

    function sportsCarryWithHuman(match, live) {
      const ball = match.ball;
      if (!sportsHumanOnField(match)) {
        // Walked off the pitch (or teleported): the ball stays where it was.
        sportsLooseBall(match, 0, 0, 0);
        ball.lastTouch = SPORTS_HUMAN;
        sportsBallBoards(match);
        return;
      }
      const moving = sportsHuman.speed > 20,
        reach = 6.2 + (moving ? Math.max(0, Math.sin(match.time * 10)) * 2.4 : 0),
        previousX = ball.x;
      // Lead by a step: the player moves after the matches update each frame.
      ball.x = player.x + Math.cos(player.a) * reach + sportsHuman.vx / 30;
      ball.y = player.y + Math.sin(player.a) * reach + sportsHuman.vy / 30;
      ball.z = ball.radius;
      ball.spin += (sportsHuman.speed / ball.radius) / 30;
      ball.lastTouch = SPORTS_HUMAN;
      // Walking the ball into the net counts.
      const scored = sportsGoalFrame(match, previousX);
      if (scored >= 0) {
        sportsLooseBall(match, Math.cos(player.a) * 40, Math.sin(player.a) * 40, 0);
        ball.lastTouch = SPORTS_HUMAN;
        sportsBallInGoal(match, scored, live);
        return;
      }
      const venue = match.venue;
      if (live && match.phase === 'play' && (ball.x < venue.x || ball.x > venue.x + venue.w || ball.y < venue.y || ball.y > venue.y + venue.h)) {
        // Dribbled over a line: out of play, to the side the ball did not come from.
        ball.lastTouchTeam = sportsRandom(match) < 0.5 ? 0 : 1;
        sportsHuman.touchLock = gameTime + 1.5;
        sportsBallOut(match);
        return;
      }
      if (!live || match.phase !== 'play') sportsBallBoards(match);
    }

    /* Walking into the ball takes it; walking into a dribbler tries to. */
    function sportsHumanTouch(match, live) {
      const ball = match.ball;
      if (!sportsHumanOnField(match) || ball.ownerId === SPORTS_HUMAN) return;
      if (match.phase === 'celebrate' || ball.mode === 'scored' || ball.mode === 'net') return;
      if (gameTime < sportsHuman.touchLock || ball.z > 6) return;
      const distance = Math.hypot(ball.x - player.x, ball.y - player.y);
      const carrier = sportsCarrier(match);
      if (carrier) {
        if (distance > 9 || carrier.role === 'goalkeeper') return;
        sportsHuman.touchLock = gameTime + 0.7;
        if (sportsRandom(match) > 0.5) return;
        carrier.tackleCooldown = 1.2;
        sportsRecordEvent(match, 'invader-tackle', carrier);
        match.status = 'PITCH INVADER WINS THE BALL';
      } else if (distance > 8.5) return;
      if (match.phase === 'restart') {
        match.phase = 'play';
        match.restart = null;
      }
      ball.flight = null;
      ball.ownerId = SPORTS_HUMAN;
      ball.mode = 'player';
      ball.vx = ball.vy = ball.vz = 0;
      ball.lastTouch = SPORTS_HUMAN;
      sportsHuman.possessedFor = 0;
      if (live && match.invader) match.status = 'PITCH INVADER ON THE BALL';
    }

    /* Players close in and try to win it back. */
    function sportsContestHuman(match, deltaSeconds) {
      if (match.ball.ownerId !== SPORTS_HUMAN) return;
      sportsHuman.possessedFor += deltaSeconds;
      if (sportsHuman.possessedFor < 0.6) return;
      for (const athlete of match.players) {
        if (athlete.tackleCooldown > 0 || sportsDistance(athlete, match.ball) > 8.5) continue;
        athlete.tackleCooldown = 1.3;
        sportsSetAction(athlete, 'pass', 0.4);
        if (sportsRandom(match) < (athlete.role === 'goalkeeper' ? 0.6 : 0.36)) {
          match.stats.tackles++;
          sportsRecordEvent(match, 'tackle-invader', athlete);
          sportsGivePossession(match, athlete);
          sportsHuman.touchLock = gameTime + 1;
          match.status = athlete.role === 'goalkeeper' ? 'KEEPER CLAIMS IT' : 'TACKLED!';
          tell(athlete.role === 'goalkeeper' ? 'THE KEEPER SMOTHERS IT' : 'TACKLED!', 1.2);
          return;
        }
      }
    }

    /**
     * The kick (E near the ball, see interact() in game.js): a strike along the
     * way you face: a full, lofted strike, or a softer pass along the ground
     * while walking (the walk action, Shift).
     */
    function sportsKick() {
      const match = sportsMatches.soccer;
      if (!sportsHumanOnField(match)) return false;
      const ball = match.ball,
        owned = ball.ownerId === SPORTS_HUMAN,
        distance = Math.hypot(ball.x - player.x, ball.y - player.y);
      if (!owned) {
        if (distance > 15 || ball.z > 8 || sportsCarrier(match) || ball.mode === 'scored' || ball.mode === 'net')
          return false;
        if (match.phase === 'celebrate') return false;
      }
      if (gameTime < sportsHuman.kickLock) return true;
      const strike = !actionHeld('walk'),
        power = strike ? 430 : 330,
        lift = strike ? 34 : 17,
        heading = player.a;
      if (match.phase === 'restart') {
        match.phase = 'play';
        match.restart = null;
      }
      // Strike it from where it sits in front of the boot.
      ball.x = player.x + Math.cos(heading) * 6.5;
      ball.y = player.y + Math.sin(heading) * 6.5;
      sportsLooseBall(match, Math.cos(heading) * power + sportsHuman.vx * 0.3, Math.sin(heading) * power + sportsHuman.vy * 0.3, lift);
      ball.lastTouch = SPORTS_HUMAN;
      sportsHuman.kickLock = gameTime + 0.3;
      sportsHuman.touchLock = gameTime + 0.35;
      player.kickUntil = gameTime + 0.3;
      sportsKickSound(ball, strike ? 1.3 : 1);
      if (match.stage === 'live' && match.phase === 'play') {
        const goalward = Math.cos(heading) * (ball.x < match.venue.x + match.venue.w / 2 ? -1 : 1) > 0.5;
        match.status = goalward ? 'THE INVADER SHOOTS!' : 'THE INVADER PLAYS IT ON';
      }
      return true;
    }

    /* The interaction prompt near the ball. */
    function sportsKickPrompt() {
      const match = sportsMatches.soccer;
      if (!sportsHumanOnField(match)) return '';
      const ball = match.ball;
      if (ball.ownerId !== SPORTS_HUMAN && (Math.hypot(ball.x - player.x, ball.y - player.y) > 15 || ball.z > 8 || sportsCarrier(match)))
        return '';
      return 'KICK THE BALL · HOLD ' + keyName('walk') + ' FOR A SOFT PASS';
    }

    /* E on the pitch: a kick when the ball is at your feet. */
    function sportsInteract() {
      if (!sportsKickPrompt()) return false;
      return sportsKick();
    }

    /**
     * Pitch invasions during a match: the whistle, the players contest the
     * ball, and after half a minute (or a goal) two stewards come for you. Run
     * rings round them if you can; if they catch you they walk you out.
     */
    function sportsUpdateInvader(match, deltaSeconds) {
      const onField = sportsHumanOnField(match);
      if (onField && !match.invader) {
        match.invader = { since: match.time, goalAt: null, leftAt: null };
        sportsWhistle(match, 'double');
        match.status = 'PITCH INVADER!';
        sportsRecordEvent(match, 'invader', null);
        tell('PITCH INVADER · Walk into the ball to dribble, E to kick it', 3.5);
      }
      const invader = match.invader;
      if (!invader) return;
      if (onField) invader.leftAt = null;
      else if (invader.leftAt === null) invader.leftAt = match.time;
      const onFor = match.time - invader.since;
      if (
        onField &&
        !match.stewards.length &&
        (onFor > 28 || (invader.goalAt !== null && match.time - invader.goalAt > 5))
      ) {
        for (const side of [-1, 1]) {
          const steward = sportsPerson(match, 'steward-' + (side > 0 ? 'b' : 'a') + Math.floor(match.time), 'steward', 2689 + side * 8, 4772, SPORTS_STEWARD_KIT);
          steward.a = -Math.PI / 2;
          match.stewards.push(steward);
          match.people.push(steward);
        }
        tell('STEWARDS ON THE PITCH', 2);
      }
      const giveUp = invader.leftAt !== null && match.time - invader.leftAt > 5;
      for (const steward of match.stewards) {
        if (steward.hidden || steward.hp <= 0 || steward.knockedFor > 0) continue;
        if (giveUp || !onField) {
          // Back to their post at the south gap.
          if (sportsMovePlayer(match, steward, SPORTS_EXITS.soccer[1], 40, deltaSeconds, false) < 3 && giveUp) steward.hidden = true;
          continue;
        }
        // Closing in from either side, a little slower than a jog.
        const offset = steward.id.includes('steward-a') ? -6 : 6;
        sportsMovePlayer(match, steward, { x: player.x + offset, y: player.y }, 86, deltaSeconds, false);
        if (Math.hypot(steward.x - player.x, steward.y - player.y) < 12) {
          sportsEscortOff(match);
          return;
        }
      }
      if (giveUp) {
        match.invader = null;
        if (match.status.startsWith('PITCH INVADER')) match.status = sportsTeamName(match, match.possessionTeam) + ' IN POSSESSION';
      }
    }

    function sportsEscortOff(match) {
      if (match.ball.ownerId === SPORTS_HUMAN) {
        const centre = { x: match.venue.x + match.venue.w / 2, y: match.venue.y + match.venue.h / 2 };
        sportsBeginRestart(match, match.possessionTeam, centre, 'DROPPED BALL', 1.2);
      }
      teleportPlayer(STADIUM_ESCORT_SPOT.x, STADIUM_ESCORT_SPOT.y);
      player.a = Math.PI / 2;
      for (const steward of match.stewards) steward.hidden = true;
      match.invader = null;
      sportsWhistle(match, 'short');
      tell(
        match.humanGoals
          ? 'THE STEWARDS WALK YOU OUT · WORTH IT FOR THAT GOAL'
          : 'THE STEWARDS WALK YOU OUT OF THE GROUND',
        3.5,
      );
    }

    /* How full the stands are right now (0..1): sports3d.js and the audio read it. */
    function sportsCrowdPresence(match) {
      if (!match || match.sport !== 'soccer') return match?.stage === 'live' ? 1 : 0;
      const calendar = match.calendar,
        attendance = match.fixture.attendance;
      if (match.abandoned) return attendance * sportsLimit(1 - (match.time - match.panicAt) / 14, 0, 1);
      switch (match.stage) {
        case 'warmup':
          return attendance * sportsLimit(1 - match.remaining / calendar.warmupSeconds, 0.15, 1);
        case 'live':
        case 'break':
          return attendance;
        case 'fulltime':
          return attendance * sportsLimit(match.remaining / calendar.afterSeconds, 0, 1);
        default:
          return 0;
      }
    }

    function sportsUpdateMatch(match, deltaSeconds) {
      match.time += deltaSeconds;
      for (const athlete of match.people) {
        athlete.tackleCooldown = Math.max(0, athlete.tackleCooldown - deltaSeconds);
        athlete.actionTime = Math.max(0, athlete.actionTime - deltaSeconds);
        if (athlete.actionTime === 0 && athlete.action !== 'dribble') athlete.action = 'run';
        const jumping =
          ['shoot', 'rebound', 'celebrate'].includes(athlete.action) && match.sport === 'basketball';
        athlete.jump =
          jumping && athlete.actionDuration > 0
            ? Math.sin((Math.PI * athlete.actionTime) / athlete.actionDuration) * 3
            : 0;
      }
      sportsCheckHarm(match, deltaSeconds);
      const live = match.stage === 'live' && !match.abandoned;
      if (match.abandoned) sportsUpdatePanic(match, deltaSeconds);
      else if (match.stage === 'warmup') sportsUpdateWarmup(match, deltaSeconds);
      else if (match.stage === 'break' || match.stage === 'fulltime') sportsUpdateLeaving(match, deltaSeconds);
      if (!live) {
        // A kickabout: the ball is the player's alone.
        sportsHumanTouch(match, false);
        sportsUpdateBall(match, deltaSeconds, false);
        return;
      }
      sportsUpdateInvader(match, deltaSeconds);
      sportsUpdateOfficials(match, deltaSeconds);
      if (match.phase === 'celebrate') {
        match.celebrationTimer -= deltaSeconds;
        sportsUpdateBall(match, deltaSeconds, true);
        for (const athlete of match.players) {
          athlete.walking = false;
          athlete.vx = athlete.vy = 0;
        }
        if (match.celebrationTimer <= 0) {
          const team = match.nextRestartTeam;
          const spot =
            match.sport === 'basketball'
              ? sportsPoint(match, team, 0.08, 0.5)
              : sportsPoint(match, team, 0.5, 0.5);
          sportsBeginRestart(
            match,
            team,
            spot,
            match.sport === 'basketball' ? 'BASELINE INBOUND' : 'KICKOFF',
            0.7,
          );
        }
        return;
      }
      if (match.phase === 'restart') {
        sportsUpdateRestart(match, deltaSeconds);
        sportsHumanTouch(match, true);
        if (match.phase === 'restart') return;
      }
      if (match.sport === 'basketball') sportsBasketballPositions(match, deltaSeconds);
      else sportsSoccerPositions(match, deltaSeconds);
      sportsKeepPlayersApart(match);
      sportsDecide(match, deltaSeconds);
      sportsContestHuman(match, deltaSeconds);
      sportsHumanTouch(match, true);
      sportsUpdateBall(match, deltaSeconds, true);
    }

    function updateSports(deltaSeconds) {
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
      // The player's pace, for dribbling and for leading a pass-or-tackle.
      const moved = Math.hypot(player.x - sportsHuman.x, player.y - sportsHuman.y);
      if (moved < 60) {
        sportsHuman.vx = (player.x - sportsHuman.x) / deltaSeconds;
        sportsHuman.vy = (player.y - sportsHuman.y) / deltaSeconds;
      } else sportsHuman.vx = sportsHuman.vy = 0;
      sportsHuman.speed = Math.hypot(sportsHuman.vx, sportsHuman.vy);
      sportsHuman.x = player.x;
      sportsHuman.y = player.y;
      for (const sport of Object.keys(sportsMatches)) sportsFollowSchedule(sport);
      // Bounded 30 Hz match stepping keeps low frame rates from skipping catches.
      // A background-tab gap is not fast-forwarded through minutes of invisible play.
      sportsStepAccumulator = Math.min(0.25, sportsStepAccumulator + deltaSeconds);
      while (sportsStepAccumulator >= 1 / 30 - 1e-10) {
        sportsUpdateMatch(sportsMatches.basketball, 1 / 30);
        sportsUpdateMatch(sportsMatches.soccer, 1 / 30);
        sportsStepAccumulator -= 1 / 30;
      }
      // Who the combat code can hit this frame: people at venues near the player.
      sportsTargetList.length = 0;
      for (const match of Object.values(sportsMatches)) {
        const venue = match.venue;
        if (Math.abs(venue.x + venue.w / 2 - player.x) > 1600 || Math.abs(venue.y + venue.h / 2 - player.y) > 1600) continue;
        for (const person of match.people) if (!person.hidden) sportsTargetList.push(person);
      }
      updateSportsAudio(deltaSeconds);
    }

    /* Athletes, officials and stewards the combat code may hit (see header). */
    function sportsTargets() {
      return sportsTargetList;
    }

    function drawSports(context) {
      for (const match of Object.values(sportsMatches)) {
        if (!match) continue;
        const venue = match.venue;
        context.save();
        for (const athlete of match.people) {
          if (athlete.hidden) continue;
          const down = athlete.hp <= 0 || athlete.knockedFor > 0;
          context.fillStyle = 'rgba(0,0,0,0.24)';
          context.beginPath();
          context.ellipse(athlete.x + 1, athlete.y + 2, 5, 3, 0, 0, Math.PI * 2);
          context.fill();
          context.save();
          context.translate(athlete.x, athlete.y - athlete.jump * 0.3);
          context.rotate(athlete.a);
          context.fillStyle = athlete.color;
          if (down) context.fillRect(-7, -3, 11, 6);
          else context.fillRect(-3, -4, 6, 8);
          context.fillStyle = '#d1a789';
          context.beginPath();
          context.arc(down ? 5 : 2, 0, 2.7, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
        const ball = match.ball;
        context.fillStyle = 'rgba(0,0,0,.3)';
        context.beginPath();
        context.ellipse(
          ball.x + 1,
          ball.y + 1,
          ball.radius * 1.3,
          ball.radius * 0.7,
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.fillStyle = match.sport === 'basketball' ? '#fa9b45' : '#f4f1e4';
        context.strokeStyle = '#272a26';
        context.lineWidth = 0.4;
        context.beginPath();
        context.arc(ball.x, ball.y - ball.z * 0.45, ball.radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.fillStyle = '#f4eddd';
        context.textAlign = 'center';
        context.font = 'bold ' + (match.sport === 'soccer' ? 13 : 9) + 'px Arial';
        context.fillText(
          match.teams[0].short + ' ' + match.scores[0] + ' — ' + match.scores[1] + ' ' + match.teams[1].short + ' · ' + sportsBoardClock(match),
          venue.x + venue.w / 2,
          venue.y - 12,
        );
        context.restore();
      }
    }

    /* The clock line the boards show: 63', HALF TIME, FULL TIME, KICK OFF 20:00. */
    function sportsBoardClock(match) {
      const calendar = match.calendar;
      if (match.abandoned) return 'ABANDONED ' + Math.floor(match.clock) + "'";
      switch (match.stage) {
        case 'live':
          return match.sport === 'soccer'
            ? Math.min(calendar.periods * calendar.periodMinutes, Math.floor(match.clock) + 1) + "'"
            : calendar.periodNames[match.period] + ' ' + sportsCountdown(match);
        case 'break':
          return calendar.breakName;
        case 'fulltime':
        case 'over':
          return 'FULL TIME';
        case 'warmup':
          return 'KICK OFF ' + sportsKickoffText(match.fixture.kickoff);
        default:
          return 'KICK OFF ' + sportsKickoffText(match.fixture.kickoff);
      }
    }

    /* Basketball shows the time left in the quarter (match minutes:seconds). */
    function sportsCountdown(match) {
      const calendar = match.calendar,
        left = Math.max(0, (match.period + 1) * calendar.periodMinutes - match.clock),
        minutes = Math.floor(left),
        seconds = Math.floor((left - minutes) * 60);
      return minutes + ':' + String(seconds).padStart(2, '0');
    }

    function getSportsSnapshot() {
      const snapshot = {};
      for (const [sport, match] of Object.entries(sportsMatches)) {
        if (!match) continue;
        snapshot[sport] = {
          venue: { ...match.venue },
          fixture: {
            id: match.fixture.id,
            day: match.fixture.day + 1,
            kickoff: sportsKickoffText(match.fixture.kickoff),
            home: match.teams[0].name,
            away: match.teams[1].name,
            attendance: Number(match.fixture.attendance.toFixed(2)),
          },
          time: Number(match.time.toFixed(2)),
          stage: match.stage,
          period: match.period,
          clock: sportsBoardClock(match),
          phase: match.phase,
          status: match.status,
          scores: [...match.scores],
          possessionTeam: match.possessionTeam,
          stats: { ...match.stats },
          ball: { ...match.ball, flight: match.ball.flight ? { ...match.ball.flight } : null },
          players: match.players.map((athlete) => ({ ...athlete, threat: null, killedBy: null, warmupSpot: null, fleeTarget: null })),
          events: match.events.map((event) => ({ ...event })),
        };
      }
      return snapshot;
    }

    /**
     * DEVELOPER CONSOLE (spread into window.DeadEndCity by game.js)
     * - match(sport): the fixture, stage, clock, score, status and who is down.
     * - ballState(): the stadium ball (position, mode, owner, speed).
     * - matchDay(day, minutesFromKickoff, slot): set the world clock relative to
     *   a fixture's kickoff (day 1 is the first day; negative minutes = warm-up).
     * - fixtures(sport, days): the coming fixtures.
     * - ballToPlayer(distance): put the stadium ball at the player's feet.
     */
    function sportsConsole() {
      const summary = (sport = 'soccer') => {
        const match = sportsMatches[sport];
        if (!match) return null;
        const count = (filter) => match.people.filter(filter).length;
        return {
          fixture: match.teams[0].name + ' v ' + match.teams[1].name,
          day: match.fixture.day + 1,
          kickoff: sportsKickoffText(match.fixture.kickoff),
          stage: match.stage,
          period: match.period,
          phase: match.phase,
          clock: sportsBoardClock(match),
          score: match.scores.join('-'),
          status: match.status,
          crowd: Number(sportsCrowdPresence(match).toFixed(2)),
          onField: count((person) => !person.hidden && person.hp > 0),
          fleeing: count((person) => person.fleeing && !person.hidden && person.hp > 0),
          dead: count((person) => person.hp <= 0),
          abandoned: match.abandoned,
          invader: match.invader ? { seconds: Math.round(match.time - match.invader.since), stewards: match.stewards.filter((s) => !s.hidden).length } : null,
          humanGoals: match.humanGoals,
          freeGoals: match.freeGoals,
          lastEvent: match.lastEvent,
        };
      };
      return {
        match: summary,
        ballState() {
          const ball = sportsMatches.soccer.ball;
          return {
            x: Math.round(ball.x * 10) / 10,
            y: Math.round(ball.y * 10) / 10,
            z: Math.round(ball.z * 10) / 10,
            mode: ball.mode,
            owner: ball.ownerId,
            speed: Math.round(Math.hypot(ball.vx, ball.vy)),
            lastTouch: ball.lastTouch,
            playerOnPitch: sportsHumanOnField(sportsMatches.soccer),
          };
        },
        matchDay(day = Math.floor(worldMinutes / 1440) + 1, minutesFromKickoff = 5, slot = 0, sport = 'soccer') {
          const fixture = sportsFixtureFor(sport, Math.max(0, day - 1), slot);
          worldMinutes = Math.max(0, fixture.kickoff + minutesFromKickoff);
          // Start that fixture afresh (players in place, a score for the time played).
          sportsAbandoned[sport] = null;
          sportsMatches[sport] = null;
          sportsFollowSchedule(sport);
          return summary(sport);
        },
        fixtures(sport = 'soccer', days = 3) {
          const today = Math.floor(worldMinutes / 1440),
            list = [];
          for (let day = today; day < today + days; day++)
            for (let slot = 0; slot < SPORTS_CALENDAR[sport].slots.length; slot++) {
              const fixture = sportsFixtureFor(sport, day, slot);
              list.push('DAY ' + (day + 1) + ' ' + sportsKickoffText(fixture.kickoff) + ' ' + fixture.home.name + ' v ' + fixture.away.name);
            }
          return list;
        },
        ballToPlayer(distance = 10) {
          const match = sportsMatches.soccer;
          sportsRespotBall(match);
          match.ball.x = player.x + Math.cos(player.a) * distance;
          match.ball.y = player.y + Math.sin(player.a) * distance;
          if (match.phase === 'restart') {
            match.phase = 'play';
            match.restart = null;
          }
          return this.ballState();
        },
        // Score a goal for `team` (0 home, 1 away) in the stadium's fixture now, as
        // the match would (whistle, cheer, boards); `byPlayer` scores it as the
        // pitch invader. Returns the match and what the stadium is playing.
        stadiumGoal(team = 0, byPlayer = false) {
          const match = sportsMatches.soccer;
          if (!match || match.abandoned || (team !== 0 && team !== 1)) return null;
          sportsScore(match, team, 1, null, !!byPlayer);
          return { match: summary('soccer'), sound: stadiumSoundReport() };
        },
        // The stadium's sound: goal reactions playing, the last goal's voices and
        // their distance-based gains (sports-audio.js).
        stadiumSound: () => stadiumSoundReport(),
      };
    }

    // The venues open on whatever the clock says at load.
    for (const sport of Object.keys(sportsMatches)) sportsFollowSchedule(sport);

    // A read-only data-copy hook; callers cannot mutate the running matches through
    // the returned object. No browser/network access or evaluation is involved.
    window.getSportsSnapshot = getSportsSnapshot;
    // END SUBSYSTEM: src/sports.js
