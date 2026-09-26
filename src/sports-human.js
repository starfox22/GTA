    // The player on the pitch: touches, kicks, prompts, pitch invaders and escorts, crowd presence.
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
