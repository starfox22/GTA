    // BEGIN SUBSYSTEM: src/sports.js — Live basketball and soccer matches
    /**
     * Live city sports
     * Source: src/sports.js
     * Scope: shared game closure.
     * Six basketball players and twenty-two football players make possession-based
     * decisions. Passes, shots, rebounds, saves and scores come from persistent match
     * state; the ball and the players do not follow a prerecorded decorative loop.
     *
     * Integration contract:
     * - Call updateSports(deltaSeconds) during play and resetSports() on a new game.
     * - Render sportsMatches.*.players using the regular human model, with optional
     *   action-specific arm poses. The separate ball has world x/y and height z.
     * - Venue x/y is its top-left corner; both matches attack along the world x axis.
     * - drawSports(context) draws players, balls and scores for the two-dimensional
     *   fallback renderer; sports-world.js owns the static ground markings.
     * - getSportsSnapshot() returns copies for tests and independent browser review.
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
        teamNames: ['RIVERSIDE', 'DOWNTOWN'],
        teamColors: ['#ee854b', '#537ee5'],
      },
      soccer: {
        id: 'city-football-stadium',
        name: 'SOUTH COAST STADIUM',
        x: 2420,
        y: 4405,
        w: 538,
        h: 348,
        goalWidth: 74,
        goalHeight: 24,
        goalDepth: 17,
        ballRadius: 1.1,
        playerHeight: 18,
        teamNames: ['CITY', 'UNITED'],
        teamColors: ['#e44f58', '#5294ef'],
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

    function sportsPlayer(match, team, number, role, along, across) {
      return {
        id: match.sport + '-' + team + '-' + number,
        sport: match.sport,
        team,
        number,
        role,
        formationAlong: along,
        formationAcross: across,
        ...sportsPoint(match, team, along, across),
        a: team === 0 ? 0 : Math.PI,
        walk: 0,
        walking: false,
        hp: 100,
        color:
          role === 'goalkeeper' ? (team === 0 ? '#e5c84c' : '#74c99b') : match.venue.teamColors[team],
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

    function createSportsMatch(sport, seed) {
      const venue = SPORTS_VENUES[sport];
      const match = {
        sport,
        venue,
        randomSeed: seed,
        time: 0,
        players: [],
        ball: {
          x: venue.x + venue.w / 2,
          y: venue.y + venue.h / 2,
          z: venue.ballRadius,
          radius: venue.ballRadius,
          mode: 'restart',
          ownerId: null,
          flight: null,
          vx: 0,
          vy: 0,
          vz: 0,
          spin: 0,
          lastTouchTeam: 0,
        },
        scores: [0, 0],
        possessionTeam: 0,
        possessionClock: 0,
        decisionTimer: 0,
        status: 'KICKOFF',
        phase: 'play',
        restart: null,
        lastEvent: null,
        events: [],
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
      const firstCarrier = match.players[sport === 'basketball' ? 0 : 6];
      firstCarrier.x = venue.x + venue.w * 0.5;
      firstCarrier.y = venue.y + venue.h * 0.5;
      sportsGivePossession(match, firstCarrier);
      return match;
    }

    const sportsMatches = {
      basketball: createSportsMatch('basketball', 22017),
      soccer: createSportsMatch('soccer', 22111),
    };
    let sportsStepAccumulator = 0;

    function resetSports() {
      sportsMatches.basketball = createSportsMatch('basketball', 22017);
      sportsMatches.soccer = createSportsMatch('soccer', 22111);
      sportsStepAccumulator = 0;
    }

    function sportsRecordEvent(match, type, player, detail = '') {
      const event = {
        time: Number(match.time.toFixed(2)),
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

    function sportsCarrier(match) {
      return match.players.find((athlete) => athlete.id === match.ball.ownerId) || null;
    }

    function sportsGivePossession(match, player) {
      if (match.possessionTeam !== player.team) match.possessionClock = 0;
      match.possessionTeam = player.team;
      match.ball.ownerId = player.id;
      match.ball.lastTouchTeam = player.team;
      match.ball.mode = 'dribble';
      match.ball.flight = null;
      match.ball.vx = match.ball.vy = match.ball.vz = 0;
      player.possessionTime = 0;
      player.tackleCooldown = Math.max(player.tackleCooldown, 0.5);
      match.decisionTimer = (match.sport === 'basketball' ? 0.65 : 0.9) + sportsRandom(match) * 0.65;
      match.status = match.venue.teamNames[player.team] + ' IN POSSESSION';
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

    function sportsMovePlayer(match, athlete, target, speed, deltaSeconds) {
      const venue = match.venue;
      const inset = match.sport === 'basketball' ? 5 : 4;
      const targetX = sportsLimit(target.x, venue.x + inset, venue.x + venue.w - inset);
      const targetY = sportsLimit(target.y, venue.y + inset, venue.y + venue.h - inset);
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
    }

    function sportsKeepPlayersApart(match) {
      // Small body separation prevents teammates occupying one exact catch point.
      const minimum = match.sport === 'basketball' ? 7.2 : 8;
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

    function sportsScore(match, team, points, scorer) {
      match.scores[team] += points;
      match.stats.scores++;
      match.status =
        match.venue.teamNames[team] + (match.sport === 'basketball' ? ' +' + points : ' GOAL!');
      match.phase = 'celebrate';
      match.celebrationTimer = match.sport === 'basketball' ? 1.1 : 2.4;
      match.nextRestartTeam = 1 - team;
      sportsRecordEvent(match, 'score', scorer, String(points));
      for (const athlete of match.players) {
        if (athlete.team === team) sportsSetAction(athlete, 'celebrate', match.celebrationTimer);
      }
      match.ball.flight = null;
      match.ball.mode = 'scored';
      match.ball.ownerId = null;
    }

    function sportsLooseBall(match, velocityX, velocityY, verticalSpeed = 0) {
      match.ball.flight = null;
      match.ball.ownerId = null;
      match.ball.mode = 'loose';
      match.ball.vx = velocityX;
      match.ball.vy = velocityY;
      match.ball.vz = verticalSpeed;
      match.ball.looseTime = 0;
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

    function sportsUpdateBall(match, deltaSeconds) {
      const ball = match.ball;
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
      if (ball.mode !== 'loose') return;
      ball.looseTime += deltaSeconds;
      ball.x += ball.vx * deltaSeconds;
      ball.y += ball.vy * deltaSeconds;
      ball.vz -= 76 * deltaSeconds;
      ball.z += ball.vz * deltaSeconds;
      if (ball.z <= ball.radius) {
        ball.z = ball.radius;
        ball.vz = Math.abs(ball.vz) > 6 ? -ball.vz * 0.48 : 0;
        ball.vx *= Math.exp(-1.3 * deltaSeconds);
        ball.vy *= Math.exp(-1.3 * deltaSeconds);
      }
      ball.spin += (Math.hypot(ball.vx, ball.vy) * deltaSeconds) / ball.radius;
      const venue = match.venue;
      if (
        ball.x < venue.x ||
        ball.x > venue.x + venue.w ||
        ball.y < venue.y ||
        ball.y > venue.y + venue.h
      ) {
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
            : ball;
        sportsBeginRestart(match, team, spot, label, 1);
        return;
      }
      if (ball.z < (match.sport === 'basketball' ? 17 : 5)) {
        const nearest = [...match.players].sort(
          (first, second) => sportsDistance(first, ball) - sportsDistance(second, ball),
        )[0];
        if (sportsDistance(nearest, ball) < 8) {
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
      const pressing = match.players
        .filter((athlete) => athlete.team !== match.possessionTeam && athlete.role !== 'goalkeeper')
        .sort((first, second) => sportsDistance(first, ball) - sportsDistance(second, ball))
        .slice(0, 2);
      const looseChasers =
        ball.mode === 'loose'
          ? match.players
              .filter((athlete) => athlete.role !== 'goalkeeper')
              .sort((first, second) => sportsDistance(first, ball) - sportsDistance(second, ball))
              .slice(0, 4)
          : [];
      for (const athlete of match.players) {
        let target;
        let speed = 33;
        const direction = sportsAttackDirection(athlete.team);
        const ownGoal = sportsGoal(match, 1 - athlete.team);
        if (athlete.role === 'goalkeeper' && athlete !== carrier) {
          const shot =
            ball.flight && ball.flight.type === 'soccer-shot' && ball.flight.team !== athlete.team;
          target = {
            x: ownGoal.x + direction * 9,
            y: sportsLimit(
              shot ? ball.flight.endY : ownGoal.y + (ball.y - ownGoal.y) * 0.32,
              ownGoal.y - match.venue.goalWidth * 0.48,
              ownGoal.y + match.venue.goalWidth * 0.48,
            ),
          };
          speed = shot ? 30 : 23;
          if (shot && ball.flight.elapsed > 0.15) sportsSetAction(athlete, 'save', 0.3);
        } else if (ball.flight && ball.flight.receiverId === athlete.id) {
          target = { x: ball.flight.endX, y: ball.flight.endY };
          speed = 39;
        } else if (athlete === carrier) {
          const goal = sportsGoal(match, athlete.team);
          const opponent = sportsNearestOpponent(match, athlete);
          target = { x: goal.x - direction * 48, y: goal.y + (athlete.y - goal.y) * 0.58 };
          if (opponent.distance < 17) target.y += athlete.y < opponent.player.y ? -23 : 23;
          speed = athlete.role === 'goalkeeper' ? 8 : 29;
        } else if (pressing.includes(athlete) || looseChasers.includes(athlete)) {
          target = {
            x: ball.x + (carrier ? carrier.vx * 0.2 : 0),
            y: ball.y + (carrier ? carrier.vy * 0.2 : 0),
          };
          speed = 36;
        } else {
          const ownProgress = ((ball.x - ownGoal.x) * direction) / match.venue.w;
          const attacking = athlete.team === match.possessionTeam;
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
          (opponent.distance < 24 || carrier.possessionTime > 2.8 || sportsRandom(match) < 0.38)
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
        sportsMovePlayer(match, athlete, target, 40, deltaSeconds);
      }
      if (restart.delay <= 0 && sportsDistance(taker, restart) < 7) {
        match.phase = 'play';
        match.restart = null;
        sportsGivePossession(match, taker);
        sportsRecordEvent(match, 'restart', taker, restart.label);
      }
    }

    function sportsUpdateMatch(match, deltaSeconds) {
      match.time += deltaSeconds;
      for (const athlete of match.players) {
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
      if (match.phase === 'celebrate') {
        match.celebrationTimer -= deltaSeconds;
        match.ball.z = Math.max(match.ball.radius, match.ball.z - deltaSeconds * 28);
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
        return;
      }
      if (match.sport === 'basketball') sportsBasketballPositions(match, deltaSeconds);
      else sportsSoccerPositions(match, deltaSeconds);
      sportsKeepPlayersApart(match);
      sportsDecide(match, deltaSeconds);
      sportsUpdateBall(match, deltaSeconds);
    }

    function updateSports(deltaSeconds) {
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
      // Bounded 30 Hz match stepping keeps low frame rates from skipping catches.
      // A background-tab gap is not fast-forwarded through minutes of invisible play.
      sportsStepAccumulator = Math.min(0.25, sportsStepAccumulator + deltaSeconds);
      while (sportsStepAccumulator >= 1 / 30 - 1e-10) {
        sportsUpdateMatch(sportsMatches.basketball, 1 / 30);
        sportsUpdateMatch(sportsMatches.soccer, 1 / 30);
        sportsStepAccumulator -= 1 / 30;
      }
    }

    function drawSports(context) {
      for (const match of Object.values(sportsMatches)) {
        const venue = match.venue;
        context.save();
        for (const athlete of match.players) {
          context.fillStyle = 'rgba(0,0,0,0.24)';
          context.beginPath();
          context.ellipse(athlete.x + 1, athlete.y + 2, 5, 3, 0, 0, Math.PI * 2);
          context.fill();
          context.save();
          context.translate(athlete.x, athlete.y - athlete.jump * 0.3);
          context.rotate(athlete.a);
          context.fillStyle = athlete.color;
          context.fillRect(-3, -4, 6, 8);
          context.fillStyle = '#d1a789';
          context.beginPath();
          context.arc(2, 0, 2.7, 0, Math.PI * 2);
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
          venue.teamNames[0] +
            ' ' +
            match.scores[0] +
            ' — ' +
            match.scores[1] +
            ' ' +
            venue.teamNames[1],
          venue.x + venue.w / 2,
          venue.y - 12,
        );
        context.restore();
      }
    }

    function getSportsSnapshot() {
      const snapshot = {};
      for (const [sport, match] of Object.entries(sportsMatches)) {
        snapshot[sport] = {
          venue: {
            ...match.venue,
            teamNames: [...match.venue.teamNames],
            teamColors: [...match.venue.teamColors],
          },
          time: Number(match.time.toFixed(2)),
          phase: match.phase,
          status: match.status,
          scores: [...match.scores],
          possessionTeam: match.possessionTeam,
          stats: { ...match.stats },
          ball: { ...match.ball, flight: match.ball.flight ? { ...match.ball.flight } : null },
          players: match.players.map((athlete) => ({ ...athlete })),
          events: match.events.map((event) => ({ ...event })),
        };
      }
      return snapshot;
    }

    // A read-only data-copy hook; callers cannot mutate the running matches through
    // the returned object. No browser/network access or evaluation is involved.
    window.getSportsSnapshot = getSportsSnapshot;
    // END SUBSYSTEM: src/sports.js
