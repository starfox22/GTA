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
      if (insideGoal) {
        if (!sportsKeeperSave(match, flight)) sportsScore(match, flight.team, 1, source);
      } else {
        sportsRecordEvent(match, 'wide', source);
        const restartPoint = sportsPoint(match, 1 - flight.team, 0.075, 0.5);
        sportsBeginRestart(match, 1 - flight.team, restartPoint, 'GOAL KICK', 1.3);
      }
    }

    /**
     * A shot on target meets the keeper: it goes in with the fixture's finishing
     * chance (sports-fixtures.js sportsFinishChance: the clubs' ratings), else
     * the keeper saves. Close to the ball he holds it; otherwise he parries it
     * back into play from the line. A keeper who is down saves nothing.
     */
    function sportsKeeperSave(match, flight) {
      const keeper = match.players.find(
        (athlete) =>
          athlete.team !== flight.team && athlete.role === 'goalkeeper' && athlete.hp > 0 && !athlete.hidden && !(athlete.knockedFor > 0),
      );
      if (!keeper || sportsRandom(match) < sportsFinishChance(match.fixture, flight.team)) return false;
      const ball = match.ball,
        goal = sportsGoal(match, flight.team),
        outward = -sportsAttackDirection(flight.team);
      match.stats.saves++;
      sportsSetAction(keeper, 'save', 0.9);
      sportsRecordEvent(match, 'save', keeper);
      // The ball stops just in front of the line, and the keeper dives across to it.
      ball.x = goal.x + outward * 4;
      keeper.y += sportsLimit(ball.y - keeper.y, -9, 9);
      if (Math.abs(ball.y - keeper.y) < 14 && sportsRandom(match) < 0.6) {
        sportsGivePossession(match, keeper);
        match.status = 'SAVED · KEEPER HOLDS IT';
      } else {
        sportsLooseBall(match, outward * (55 + sportsRandom(match) * 45), (sportsRandom(match) - 0.5) * 90, 10);
        ball.lastTouch = keeper.id;
        ball.lastTouchTeam = keeper.team;
        match.status = 'WHAT A SAVE!';
      }
      return true;
    }
