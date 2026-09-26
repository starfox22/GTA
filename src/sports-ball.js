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
