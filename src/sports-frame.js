    // updateSports() and drawSports(): per-frame match update, board clock, console snapshot.
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
      // GOALLINE settles what the match just decided (sportsbook.js).
      sportsbookUpdate(deltaSeconds);
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
