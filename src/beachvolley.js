    // BEGIN SUBSYSTEM: src/beachvolley.js — Beach volleyball on Palm Keys Beach
    /**
     * Beach volleyball
     * Source: src/beachvolley.js
     * Scope: shared game closure.
     *
     * THE COURT
     * A regulation beach court (16 x 8 m, net 2.43 m) in a raked sand pit on the
     * upper sand at the west end of Palm Keys Beach, north of the umbrella rows
     * and clear of the kiosks (`volleyCourtPlan`, placed by buildBeachLayout and
     * reserved there so nothing else is laid on it). The long axis runs east-west:
     * team 0 plays the west half, team 1 the east. beachvolley3d.js draws the
     * pit, lines, poles, net and the scoreboard from the same plan; the poles and
     * the net are solid on foot (`volleyBlocked`, from beachBlocked).
     *
     * THE MATCH
     * The four `volley` beachgoers (beach.js) play 2 v 2 by rally scoring to 15
     * (win by two). The ball is a real projectile (gravity, a sand bounce that
     * kills most of its speed, the net), not a scripted arc: every touch is a
     * launch solved for a target and an apex, so the AI knows where it will come
     * down and can run there. A side has three touches: the receiver bumps it to
     * the setter by the net, the setter puts it up for the attacker, and the
     * attacker jumps and spikes into the open court (or rolls a shot over it).
     * Every touch can go wrong (a shanked pass, a set too tight, a spike into the
     * net or long), which is what ends rallies. A ball landing in (lines count)
     * scores for the other side; out, it scores against whoever touched it last.
     *
     * THE PLAYER
     * Walk onto the court and JOIN MATCH (E): the player takes the place of the
     * nearer player of the side they stand on, who goes and watches from the
     * sideline, and a fresh game starts. Move with the movement keys; E or a left
     * click hits a ball in reach (a press a moment early is held for it). The hit
     * goes to the other side, aimed with the mouse, or across the court with the
     * movement keys; with Walk (Shift) held it is a soft set to the partner; run
     * into a high ball by the net for a jump spike. The partner reads the play:
     * it takes balls nearer to it and sets the player up at the net. A ring on the
     * sand marks where a ball the player should take will come down. Walking off
     * the court, or LEAVE MATCH (E) while the ball is dead, hands the place back.
     * A hint card (`#volleyCard`) shows the score and the controls meanwhile.
     */
    const VOLLEY = {
      lengthM: 16,
      widthM: 8,
      netM: 2.43,
      // Raked sand round the lines, and the clear zone kept free of towels.
      pitM: 2,
      freeM: 2,
      target: 15,
      // How high a player meets the ball: a bump, standing overhead, at the top of a jump.
      bumpZ: 11,
      reachZ: 22,
      jumpZ: 32,
      ballRadius: 1.4,
      gravity: GRAVITY,
      runSpeed: 6.2 * UNITS_PER_METRE,
      shuffleSpeed: 2.5 * UNITS_PER_METRE,
      pointPause: 2.6,
      servePause: 1.8,
      winPause: 7,
    };
    const VU = UNITS_PER_METRE;
    /* The court plan in map units, centred on the chosen spot. */
    function volleyCourtPlan() {
      const w = VOLLEY.lengthM * VU,
        h = VOLLEY.widthM * VU,
        pit = VOLLEY.pitM * VU,
        free = VOLLEY.freeM * VU;
      return {
        x: -2322,
        y: 5450,
        w,
        h,
        pit,
        free,
        net: VOLLEY.netM * VU,
        // Poles stand a metre outside each sideline.
        poleOffset: h / 2 + VU,
        // The scoreboard on two posts on the sand north of the pit, facing the sea.
        board: { x: -2322, y: 5450 - h / 2 - pit - 12, w: 5 * VU, h: 1.4 * VU },
      };
    }
    const volley = {
      phase: 'idle',
      timer: 0,
      score: [0, 0],
      serveTeam: 0,
      server: [0, 0],
      touches: 0,
      touchTeam: -1,
      lastToucher: null,
      receiver: null,
      intercept: null,
      marker: null,
      players: [],
      human: null,
      humanAthlete: { human: true, x: 0, y: 0, team: 0, a: 0 },
      pressAt: -100,
      mouseWas: false,
      rallies: 0,
      hits: 0,
      humanHits: 0,
      humanOver: 0,
      matches: 0,
      lastPoint: null,
      winner: -1,
      cheerUntil: -100,
      scoreVersion: 0,
      log: [],
      cardShown: false,
    };
    const court = () => BEACH_LAYOUT.court;
    const teamSide = (team) => (team === 0 ? -1 : 1);
    const volleyTeamOf = (x) => (x < court().x ? 0 : 1);
    function volleyLog(text) {
      volley.log.push((Math.round(beachClock * 10) / 10) + 's ' + text);
      if (volley.log.length > 40) volley.log.shift();
    }
    /* Poles and the net are solid on foot (called from beachBlocked). */
    function volleyBlocked(x, y, r) {
      const c = court();
      return !!c && Math.abs(x - c.x) < r + 1 && Math.abs(y - c.y) < c.poleOffset + r + 1;
    }
    /* Inside the pit (with a margin), where the match can be joined and is left. */
    function onVolleyCourt(x, y, margin = 0) {
      const c = court();
      return Math.abs(x - c.x) <= c.w / 2 + c.pit + margin && Math.abs(y - c.y) <= c.h / 2 + c.pit + margin;
    }
    function volleyInBounds(x, y, slack = VOLLEY.ballRadius) {
      const c = court();
      return Math.abs(x - c.x) <= c.w / 2 + slack && Math.abs(y - c.y) <= c.h / 2 + slack;
    }
    /* The athletes of a team: beachgoers, and the player in place of one. */
    function volleyTeam(team) {
      const out = [];
      for (const p of volley.players) if (p.vteam === team && !p.benched) out.push(p);
      if (volley.human && volley.human.team === team) out.push(volley.humanAthlete);
      return out;
    }
    function volleyPartner(athlete) {
      return volleyTeam(athlete.team ?? athlete.vteam).find((q) => q !== athlete) || null;
    }
    const athleteTeam = (a) => (a.human ? a.team : a.vteam);
    /**
     * FLIGHT
     * `volleyLaunch` solves the velocity that takes the ball from where it is to
     * a target point at height `endZ`, peaking at `apex`. Without drag the
     * prediction is exact, which is what lets the players read it.
     */
    function volleyLaunch(tx, ty, apex, endZ = 0) {
      const b = beachBall,
        g = VOLLEY.gravity,
        z0 = b.z,
        top = Math.max(apex, z0 + 1, endZ + 1),
        vz = Math.sqrt(2 * g * (top - z0)),
        t = vz / g + Math.sqrt((2 * (top - endZ)) / g);
      b.vx = (tx - b.x) / t;
      b.vy = (ty - b.y) / t;
      b.vz = vz;
      b.mode = 'flight';
      b.netHit = false;
      b.landed = false;
      return t;
    }
    /* Height of the current flight when it crosses the net (null if it does not). */
    function volleyNetHeight() {
      const b = beachBall,
        c = court();
      if (!b.vx || (c.x - b.x) / b.vx <= 0) return null;
      const t = (c.x - b.x) / b.vx;
      return b.z + b.vz * t - 0.5 * VOLLEY.gravity * t * t;
    }
    /* Launch toward a target on the other side, raising the apex until it clears the net. */
    function volleyLaunchOver(tx, ty, apex, clearance = 2.5) {
      const net = court().net + VOLLEY.ballRadius + clearance;
      let t = volleyLaunch(tx, ty, apex);
      for (let tries = 0; tries < 30; tries++) {
        const z = volleyNetHeight();
        if (z === null || z > net) break;
        apex += 3;
        t = volleyLaunch(tx, ty, apex);
      }
      return t;
    }
    /* Where and when the flight comes down through a height (descending), and lands. */
    function volleyPredict(atZ = VOLLEY.bumpZ) {
      const b = beachBall,
        g = VOLLEY.gravity,
        landDisc = b.vz * b.vz + 2 * g * (b.z - VOLLEY.ballRadius),
        tLand = landDisc > 0 ? (b.vz + Math.sqrt(landDisc)) / g : 0,
        disc = b.vz * b.vz + 2 * g * (b.z - atZ),
        tHit = disc > 0 ? (b.vz + Math.sqrt(disc)) / g : tLand;
      return {
        x: b.x + b.vx * tHit,
        y: b.y + b.vy * tHit,
        t: beachClock + tHit,
        landX: b.x + b.vx * tLand,
        landY: b.y + b.vy * tLand,
        landT: beachClock + tLand,
      };
    }
    /* After every launch: who goes for it. */
    function volleyPlan(fromTeam) {
      const p = volleyPredict();
      volley.intercept = p;
      volley.receiver = null;
      volley.marker = null;
      const team = volleyTeamOf(p.landX),
        overNet = team !== fromTeam;
      volley.receivingTeam = team;
      // A ball going well out is left alone (most of the time: people misjudge).
      if (overNet && !volleyInBounds(p.landX, p.landY, 0.8 * VU) && Math.random() < 0.85) {
        volley.leaving = true;
        return;
      }
      volley.leaving = false;
      // A good attack is often a kill: the defender gets there late (the player is never slowed).
      volley.beaten = overNet && volley.attack && Math.random() < (volley.attack === 'spike' ? 0.45 : 0.2);
      volley.attack = null;
      volleyChooseReceiver();
    }
    /* The nearer athlete of the receiving side takes it (never the last toucher). */
    function volleyChooseReceiver() {
      const p = volley.intercept;
      if (!p) return;
      let best = null,
        bd = Infinity;
      for (const a of volleyTeam(volley.receivingTeam)) {
        if (a === volley.lastToucher && volley.touchTeam === volley.receivingTeam) continue;
        let d = Math.hypot(a.x - p.x, a.y - p.y);
        // The player gets first call on a ball they can still reach; one they cannot
        // (standing still, too far) is left to their partner: forgiving on a keyboard.
        if (a.human) d = d / FOOT_RUN > p.t - beachClock + 0.3 ? d * 3 : d * 0.8;
        if (d < bd) {
          bd = d;
          best = a;
        }
      }
      volley.receiver = best;
      volley.marker = best?.human ? { x: p.x, y: p.y } : null;
    }
    /**
     * TOUCHES
     * Every touch counts toward the side's three; a fourth is a fault.
     */
    function volleyTouch(athlete) {
      const team = athleteTeam(athlete);
      if (volley.touchTeam === team) volley.touches++;
      else {
        volley.touchTeam = team;
        volley.touches = 1;
      }
      volley.lastToucher = athlete;
      volley.hits++;
      if (volley.touches > 3) {
        volleyLog((athlete.human ? 'player' : 'team ' + team) + ': four touches');
        volleyPoint(1 - team, 'FOUR TOUCHES');
        return false;
      }
      return true;
    }
    /* Somewhere on the other side away from its defenders (inside the lines by `inset`). */
    function volleyOpenSpot(team, inset = 0.7 * VU, deep = 0.5) {
      const c = court(),
        other = 1 - team,
        side = teamSide(other),
        defenders = volleyTeam(other);
      let best = null,
        bestScore = -Infinity;
      for (let i = 0; i < 8; i++) {
        const along = c.w / 2 * (0.25 + Math.random() * 0.75 * (0.5 + deep)),
          x = c.x + side * Math.min(c.w / 2 - inset, along),
          y = c.y + (Math.random() * 2 - 1) * (c.h / 2 - inset),
          score = Math.min(...defenders.map((d) => Math.hypot(d.x - x, d.y - y)), 999) + Math.random() * 10;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
      return best;
    }
    function volleyNetSpot(team, across = 0) {
      const c = court();
      return { x: c.x + teamSide(team) * 1.8 * VU, y: c.y + across };
    }
    /* A hit sound, a little sand when it is dug out low. */
    function volleyHitEffects(athlete, strength) {
      sportsKickSound(beachBall, strength);
      if (beachBall.z < 8) particle(beachBall.x, beachBall.y, '#e3d2a4', 4, 30, 2);
      athlete.poseUntil = beachClock + 0.45;
    }
    /* An AI player plays the ball: bump, set or attack by the touch count. */
    function volleyAiHit(p) {
      const team = p.vteam,
        partner = volleyPartner(p),
        next = volley.touchTeam === team ? volley.touches + 1 : 1,
        c = court(),
        side = teamSide(team);
      if (!volleyTouch(p)) return;
      const err = Math.random();
      if (next === 1) {
        // Dig or bump to the setter's spot by the net.
        p.pose = beachBall.z < 8 ? 'dig' : 'bump';
        // To the setter's spot by the net; to the player, wherever they stand (they only
        // have to press the hit key as it drops to them).
        const spot = partner?.human
          ? { x: c.x + side * clamp((partner.x - c.x) * side, 1.5 * VU, c.w / 2), y: clamp(partner.y, c.y - c.h / 2, c.y + c.h / 2) }
          : volleyNetSpot(team, (partner ? partner.y - c.y : 0) * 0.3);
        if (err < 0.06) {
          // Shanked: off the arms into the stands.
          volleyLaunch(p.x + side * randomBetween(-40, 10), c.y + randomBetween(-1, 1) * (c.h / 2 + 40), randomBetween(26, 48));
          volleyLog('team ' + team + ' shanks the pass');
        } else volleyLaunch(spot.x + randomBetween(-6, 6), spot.y + randomBetween(-6, 6), randomBetween(36, 46), VOLLEY.reachZ - 2);
        volleyHitEffects(p, 0.8);
      } else if (next === 2 && partner && !(Math.random() < 0.12)) {
        // Set it up for the partner (the player, if they are at the net).
        p.pose = 'set';
        const toHuman = partner.human,
          nearNet = Math.abs(partner.x - c.x) < 6 * VU,
          tx = toHuman ? (nearNet ? partner.x : c.x + side * 2.2 * VU) : c.x + side * 1.4 * VU,
          ty = toHuman ? clamp(partner.y, c.y - c.h / 2 + 8, c.y + c.h / 2 - 8) : partner.y + randomBetween(-10, 10) * 0.5;
        if (err < 0.04) volleyLaunch(c.x - side * 3, ty, randomBetween(24, 30));
        else volleyLaunch(tx, ty, randomBetween(38, 46), VOLLEY.reachZ);
        volleyHitEffects(p, 0.6);
      } else {
        // Attack: a jump spike from high by the net, or a shot over from anywhere else.
        const spot = volleyOpenSpot(team, 0.7 * VU, Math.random()),
          nearNet = Math.abs(p.x - c.x) < 3.5 * VU && beachBall.z > 17;
        volley.attack = nearNet ? 'spike' : 'shot';
        if (err < 0.12) {
          // Into the net, or long.
          if (Math.random() < 0.5 && nearNet) volleyLaunch(c.x + side * -1, spot.y, beachBall.z + 1, 6);
          else volleyLaunchOver(spot.x - side * randomBetween(20, 50), spot.y + randomBetween(-30, 30), 40);
          volleyLog('team ' + team + ' attack error');
        } else if (nearNet && Math.random() < 0.75) {
          p.jumpAt = beachClock;
          volleyLaunchOver(spot.x, spot.y, beachBall.z + 1, 1.5);
        } else volleyLaunchOver(spot.x, spot.y, randomBetween(36, 50));
        p.pose = nearNet ? 'spike' : 'set';
        volleyHitEffects(p, nearNet ? 1.5 : 0.9);
      }
      volleyPlan(team);
    }
    /**
     * THE PLAYER'S HIT
     * `soft` is the Walk (Shift) set; a spike when running in by the net under a
     * high ball. The aim comes from the mouse (if it is in use) or the movement keys.
     */
    function volleyAimPoint(team) {
      const c = court(),
        other = teamSide(1 - team),
        inset = 0.6 * VU;
      let x = c.x + other * c.w * 0.3,
        y = c.y;
      if (mouse.active && city3D?.groundPoint) {
        const g = city3D.groundPoint(mouse.x, mouse.y, 0);
        if (g) {
          y = g.y;
          // A point on the other side sets the depth too; on this side only the line.
          if ((g.x - c.x) * other > 0) x = g.x;
        }
      } else {
        const across = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0),
          toward = ((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)) * other;
        y = c.y + across * c.h * 0.33;
        // Running at the net hits deep; backing off drops it short.
        x = c.x + other * c.w * (toward > 0 ? 0.42 : toward < 0 ? 0.14 : 0.3);
      }
      return {
        x: c.x + other * clamp((x - c.x) * other, 1.2 * VU, c.w / 2 - inset),
        y: clamp(y, c.y - c.h / 2 + inset, c.y + c.h / 2 - inset),
      };
    }
    function volleyHumanReach() {
      const b = beachBall,
        d = Math.hypot(b.x - player.x, b.y - player.y);
      return { d, ok: b.mode === 'flight' && d < 2.6 * VU && b.z > 2 && b.z < VOLLEY.jumpZ + 4 };
    }
    function volleyHumanHit() {
      const h = volley.human,
        me = volley.humanAthlete,
        b = beachBall,
        c = court();
      if (!h) return false;
      // Serving: the ball is in the player's hands.
      if (volley.phase === 'serve' && volley.serverAthlete === me) {
        const aim = volleyAimPoint(h.team);
        b.z = 16;
        volley.phase = 'rally';
        volley.touchTeam = h.team;
        volley.touches = 0;
        volley.lastToucher = me;
        volleyLaunchOver(aim.x, aim.y, 46);
        volley.humanHits++;
        volleyHitEffects(me, 1.2);
        player.kickUntil = gameTime + 0.3;
        volleyLog('player serves');
        volleyPlan(h.team);
        return true;
      }
      if (volley.phase !== 'rally') return false;
      const reach = volleyHumanReach();
      if (!reach.ok) return false;
      const soft = actionHeld('walk'),
        next = volley.touchTeam === h.team ? volley.touches + 1 : 1,
        moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight,
        nearNet = Math.abs(player.x - c.x) < 3.5 * VU,
        spike = !soft && nearNet && b.z > 15 && moving,
        // Timing: best met at chest height for a pass, as high as possible for a spike.
        ideal = spike ? VOLLEY.jumpZ - 4 : soft ? 16 : 13,
        quality = clamp(1 - Math.max(0, Math.abs(b.z - ideal) - 10) / 24 - (reach.d / (2.6 * VU)) * 0.2, 0.35, 1),
        spread = (1 - quality) * 1.4 * VU;
      if (!volleyTouch(me)) return true;
      volley.humanHits++;
      const partner = volleyPartner(me);
      if (soft && next < 3) {
        // A soft set to the partner (or up by the net if there is none).
        const to = partner && !partner.human ? { x: partner.x, y: partner.y } : volleyNetSpot(h.team);
        const spot = { x: clamp(to.x, c.x - c.w / 2, c.x + c.w / 2), y: to.y };
        if ((spot.x - c.x) * teamSide(h.team) < 1.2 * VU) spot.x = c.x + teamSide(h.team) * 1.4 * VU;
        volleyLaunch(spot.x + randomBetween(-1, 1) * spread, spot.y + randomBetween(-1, 1) * spread, 40, VOLLEY.reachZ - 2);
        volleyHitEffects(me, 0.6);
        volleyLog('player sets (quality ' + quality.toFixed(2) + ')');
      } else {
        const aim = volleyAimPoint(h.team),
          tx = aim.x + randomBetween(-1, 1) * spread,
          ty = aim.y + randomBetween(-1, 1) * spread;
        if (spike) {
          player.jumpUntil = gameTime + 0.55;
          player.jumpAt = gameTime;
          volley.attack = 'spike';
          volleyLaunchOver(tx, ty, b.z + 1, 1.5);
          volleyHitEffects(me, 1.6);
          volleyLog('player spikes');
        } else {
          volley.attack = soft ? null : 'shot';
          volleyLaunchOver(tx, ty, soft ? 30 : 44);
          volleyHitEffects(me, soft ? 0.7 : 1.1);
          volleyLog('player hits it over (quality ' + quality.toFixed(2) + ')');
        }
        volley.humanOver++;
      }
      player.kickUntil = gameTime + 0.3;
      volleyPlan(h.team);
      return true;
    }
    /**
     * POINTS AND GAMES
     */
    function volleyPoint(team, why) {
      if (volley.phase !== 'rally') return;
      volley.score[team]++;
      volley.scoreVersion++;
      volley.rallies++;
      volley.lastPoint = { team, why, score: [...volley.score] };
      volleyLog('point team ' + team + ' (' + why + ') ' + volley.score.join('-'));
      volley.phase = 'dead';
      volley.timer = VOLLEY.pointPause;
      volley.receiver = null;
      volley.marker = null;
      volley.cheerUntil = beachClock + 1.4;
      volley.cheerTeam = team;
      // Rally scoring: the side that won the point serves; a side that wins the
      // serve back sends its other player to the line.
      if (volley.serveTeam !== team) {
        volley.serveTeam = team;
        volley.server[team] = 1 - volley.server[team];
      }
      sportsWhistle({ venue: { x: court().x, y: court().y, w: 1, h: 1 } }, 'short');
      const [a, b] = volley.score;
      if (Math.max(a, b) >= VOLLEY.target && Math.abs(a - b) >= 2) volleyWin(a > b ? 0 : 1);
      else if (volley.human) {
        const mine = team === volley.human.team;
        tell((mine ? 'POINT! ' : 'Point to them · ') + volleyScoreText() + (why ? ' · ' + why : ''), 2);
      }
    }
    function volleyScoreText() {
      const h = volley.human;
      if (!h) return volley.score[0] + '–' + volley.score[1];
      return 'YOU ' + volley.score[h.team] + '–' + volley.score[1 - h.team] + ' THEM';
    }
    function volleyWin(team) {
      volley.phase = 'won';
      volley.winner = team;
      volley.timer = VOLLEY.winPause;
      volley.matches++;
      volley.cheerUntil = beachClock + 4;
      volley.cheerTeam = team;
      volleyLog('game to team ' + team + ' ' + volley.score.join('-'));
      const c = court();
      // The beach cheers: the stadium's recorded roar, small and far off.
      if (sportsSoundReady()) playSample('stadium-goal-cheer', 0.22, 1.08, { x: c.x, y: c.y }, ambience.bus);
      sportsWhistle({ venue: { x: c.x, y: c.y, w: 1, h: 1 } }, 'triple');
      for (let i = 0; i < 5; i++)
        particle(c.x + teamSide(team) * c.w / 4 + randomBetween(-20, 20), c.y + randomBetween(-20, 20), ['#f2c230', '#e04a3f', '#2d6fbe', '#f5f1e6'][i % 4], 6, 60, 2.5);
      if (volley.human) {
        const won = team === volley.human.team,
          s = volley.score[volley.human.team] + '–' + volley.score[1 - volley.human.team];
        announce('BEACH VOLLEY', won ? 'YOU WIN ' + s : 'GAME LOST ' + s, 3.5);
      }
    }
    function volleyNewGame(serveTeam = Math.random() < 0.5 ? 0 : 1) {
      volley.score = [0, 0];
      volley.scoreVersion++;
      volley.serveTeam = serveTeam;
      volley.winner = -1;
      volleyStartServe();
    }
    function volleyStartServe() {
      volley.phase = 'serve';
      volley.timer = VOLLEY.servePause;
      volley.touches = 0;
      volley.touchTeam = -1;
      volley.lastToucher = null;
      volley.receiver = null;
      volley.marker = null;
      volley.intercept = null;
      const team = volleyTeam(volley.serveTeam);
      volley.serverAthlete = team[volley.server[volley.serveTeam] % Math.max(1, team.length)] || team[0] || null;
      const b = beachBall;
      b.mode = 'held';
      b.vx = b.vy = b.vz = 0;
    }
    /* The server's spot behind the end line, and everyone else's for a serve. */
    function volleyServePosition(a) {
      const c = court(),
        team = athleteTeam(a),
        side = teamSide(team),
        serving = team === volley.serveTeam,
        mate = volleyPartner(a),
        upper = !mate || a.y <= mate.y || (mate.human && !a.human);
      if (serving && a === volley.serverAthlete) return { x: c.x + side * (c.w / 2 + 0.8 * VU), y: c.y + (volley.server[team] ? 1 : -1) * c.h * 0.2 };
      if (serving) return { x: c.x + side * 2 * VU, y: c.y + (upper ? -1 : 1) * c.h * 0.2 };
      return { x: c.x + side * c.w * 0.3, y: c.y + (upper ? -1 : 1) * c.h * 0.25 };
    }
    /**
     * THE STEP
     * Called from updateBeachGames with the four volley players on the sand.
     */
    function updateVolleyball(deltaSeconds, players) {
      const b = beachBall;
      volley.players = players;
      for (const p of players) p.vteam = p.side < 0 ? 0 : 1;
      if (players.length < 4) {
        if (volley.human) volleyLeave('The game broke up.');
        volley.phase = 'idle';
        b.active = false;
        volley.marker = null;
        return;
      }
      b.active = true;
      if (volley.phase === 'idle') volleyNewGame();
      if (volley.human) {
        const me = volley.humanAthlete;
        me.x = player.x;
        me.y = player.y;
        me.a = player.a;
        me.team = volley.human.team;
        updateVolleyHuman(deltaSeconds);
        if (!volley.human) return;
      }
      volley.timer -= deltaSeconds;
      if (volley.phase === 'serve') updateVolleyServe(deltaSeconds);
      else if (volley.phase === 'dead' || volley.phase === 'won') {
        if (volley.timer <= 0) {
          if (volley.phase === 'won') volleyNewGame(1 - volley.winner);
          else volleyStartServe();
        }
      }
      updateVolleyBall(deltaSeconds);
      updateVolleyAthletes(deltaSeconds);
    }
    function updateVolleyServe() {
      const b = beachBall,
        s = volley.serverAthlete;
      if (!s) return;
      if (s.human) {
        b.x = player.x + Math.cos(player.a) * 4;
        b.y = player.y + Math.sin(player.a) * 4;
        b.z = 13;
        if (volley.timer < -12) volleyHumanHit(); // nobody pressed: serve anyway
        return;
      }
      // Toss at the end of the pause, hit on the way down.
      const tossAt = 0.55;
      if (volley.timer > tossAt) {
        b.x = s.x + Math.cos(s.a) * 3;
        b.y = s.y + Math.sin(s.a) * 3;
        b.z = 12;
        return;
      }
      if (b.mode === 'held') {
        b.mode = 'toss';
        b.vz = 34;
        b.vx = b.vy = 0;
        s.pose = 'serve';
        s.poseUntil = beachClock + 0.8;
      }
      if (b.mode === 'toss' && b.vz < 0 && b.z < 22) {
        const team = s.vteam,
          spot = volleyOpenSpot(team, 0.8 * VU, 1);
        volley.phase = 'rally';
        volley.touchTeam = team;
        volley.touches = 0;
        volley.lastToucher = s;
        if (Math.random() < 0.07) {
          volleyLaunchOver(spot.x + teamSide(1 - team) * randomBetween(30, 60), spot.y, 46);
          volleyLog('team ' + team + ' serves long');
        } else volleyLaunchOver(spot.x, spot.y, randomBetween(42, 54));
        volleyHitEffects(s, 1.2);
        volleyPlan(team);
      }
    }
    /* Ball physics: flight, the net, the sand. Small steps so the net is never skipped. */
    function updateVolleyBall(deltaSeconds) {
      const b = beachBall,
        c = court(),
        g = VOLLEY.gravity;
      if (b.mode === 'held') return;
      const steps = Math.max(1, Math.ceil(deltaSeconds / (1 / 120)));
      const h = deltaSeconds / steps;
      for (let i = 0; i < steps; i++) {
        const px = b.x;
        b.x += b.vx * h;
        b.y += b.vy * h;
        b.vz -= g * h;
        b.z += b.vz * h;
        // The net: a band from the tape down a metre, between the poles.
        if ((px - c.x) * (b.x - c.x) < 0 && Math.abs(b.y - c.y) < c.poleOffset && b.z < c.net + VOLLEY.ballRadius && b.z > c.net - VU - VOLLEY.ballRadius) {
          b.x = c.x + Math.sign(px - c.x) * (VOLLEY.ballRadius + 0.2);
          b.vx *= -0.25;
          b.vy *= 0.5;
          b.vz = Math.min(b.vz, 0) * 0.3;
          if (!b.netHit) {
            b.netHit = true;
            if (sportsSoundReady()) noiseBurst(audio.currentTime, 0.12, 0.03 * spatial(b, 220).gain, 'lowpass', 500, 0, 0.8);
            volleyLog('into the net');
          }
          if (volley.phase === 'rally') volleyPlan(volleyTeamOf(b.x) === 0 ? 1 : 0);
        }
        if (b.z <= VOLLEY.ballRadius) {
          b.z = VOLLEY.ballRadius;
          const impact = -b.vz;
          if (!b.landed) {
            b.landed = true;
            particle(b.x, b.y, '#e6d4a6', 8, 45, 2.6);
            if (sportsSoundReady()) {
              const where = spatial(b, 220);
              noiseBurst(audio.currentTime, 0.09, 0.05 * where.gain, 'lowpass', 380, where.pan, 0.7);
            }
            if (volley.phase === 'rally') volleyLanded(b.x, b.y);
          }
          // Sand swallows the bounce.
          b.vz = impact > 18 ? impact * 0.28 : 0;
          const friction = Math.exp(-6 * h);
          b.vx *= friction;
          b.vy *= friction;
        }
      }
      // A ball gone well away from the court between points is fetched back.
      if (volley.phase !== 'rally' && !onVolleyCourt(b.x, b.y, 60)) {
        b.vx = b.vy = 0;
      }
      if (volley.phase === 'rally' && b.mode === 'flight' && volley.intercept && volley.receiver === null && !volley.leaving) volleyChooseReceiver();
    }
    function volleyLanded(x, y) {
      const inside = volleyInBounds(x, y),
        landedTeam = volleyTeamOf(x);
      if (inside) volleyPoint(1 - landedTeam, landedTeam === volley.touchTeam ? '' : 'IN');
      else volleyPoint(volley.touchTeam < 0 ? 1 - landedTeam : 1 - volley.touchTeam, 'OUT');
    }
    /* The AI players: run to the ball, cover, set up, and play it when it arrives. */
    function updateVolleyAthletes(deltaSeconds) {
      const b = beachBall,
        c = court(),
        rally = volley.phase === 'rally';
      // Re-read who takes it while the ball is up (the player may have moved).
      if (rally && volley.intercept && !volley.leaving && b.mode === 'flight' && volley.intercept.t - beachClock > 0.45) volleyChooseReceiver();
      for (const p of volley.players) {
        if (p.benched) {
          volleyBench(p, deltaSeconds);
          continue;
        }
        const team = p.vteam,
          side = teamSide(team),
          partner = volleyPartner(p);
        let goal;
        if (volley.phase === 'serve') goal = volleyServePosition(p);
        else if (rally) {
          if (volley.receiver === p && volley.intercept) goal = { x: volley.intercept.x - Math.cos(p.a) * 2, y: volley.intercept.y - Math.sin(p.a) * 2 };
          else if (volley.receivingTeam === team && !volley.leaving) {
            const touches = volley.touchTeam === team ? volley.touches : 0;
            // Waiting for the pass: the setter by the net; after the set: the attacker's approach.
            goal = touches === 0 ? volleyNetSpot(team, (p.y - c.y) * 0.3) : { x: c.x + side * 3.2 * VU, y: c.y + (p.y < (partner?.y ?? c.y) ? -1 : 1) * c.h * 0.22 };
          } else goal = { x: c.x + side * c.w * 0.3, y: c.y + (p.y <= (partner?.y ?? c.y + 1) ? -1 : 1) * c.h * 0.24 };
        } else goal = volleyServePosition(p);
        // Players stay on their own half (and in the pit).
        goal.x = c.x + side * clamp((goal.x - c.x) * side, 0.8 * VU, c.w / 2 + c.pit - 4);
        goal.y = clamp(goal.y, c.y - c.h / 2 - c.pit + 4, c.y + c.h / 2 + c.pit - 4);
        const dx = goal.x - p.x,
          dy = goal.y - p.y,
          d = Math.hypot(dx, dy),
          urgent = rally && volley.receiver === p,
          speed = (urgent || d > 12 ? VOLLEY.runSpeed : VOLLEY.shuffleSpeed) * (urgent && volley.beaten ? 0.35 : 1),
          step = Math.min(d, speed * deltaSeconds);
        if (d > 0.5) {
          p.x += (dx / d) * step;
          p.y += (dy / d) * step;
          if (speed > VOLLEY.shuffleSpeed && Math.random() < deltaSeconds * 6) particle(p.x, p.y, '#e3d2a4', 2, 20, 1.6);
        }
        // Face the ball (or the net when it is dead).
        const look = b.active && !(volley.phase === 'serve' && p === volley.serverAthlete) ? Math.atan2(b.y - p.y, b.x - p.x) : side < 0 ? 0 : Math.PI;
        p.a += normalizeAngle(look - p.a) * Math.min(1, deltaSeconds * 8);
        // Poses: a hit holds for a moment, a jump arcs, otherwise run or wait ready.
        const jumpT = (beachClock - (p.jumpAt ?? -10)) / 0.6;
        p.z = jumpT >= 0 && jumpT < 1 ? Math.sin(jumpT * Math.PI) * 9 : 0;
        if ((p.poseUntil || 0) > beachClock) {
          // keep the hit pose
        } else if (volley.cheerUntil > beachClock && volley.cheerTeam === team) {
          p.pose = 'cheer';
          if (volley.phase === 'won') p.z = Math.abs(Math.sin(beachClock * 7 + p.threshold * 9)) * 4;
        } else if (step > speed * deltaSeconds * 0.5 && speed > VOLLEY.shuffleSpeed) {
          p.pose = 'run';
          p.phase += deltaSeconds * 14;
        } else if (d > 0.5) {
          p.pose = 'walk';
          p.phase += deltaSeconds * 8;
        } else p.pose = 'ready';
        // Play the ball when it arrives.
        if (rally && volley.receiver === p && b.mode === 'flight' && b.vz < 0) {
          const reach = Math.hypot(b.x - p.x, b.y - p.y),
            nearNet = Math.abs(p.x - c.x) < 3.5 * VU,
            attack = volley.touchTeam === team && volley.touches === 2,
            top = attack && nearNet ? VOLLEY.jumpZ : VOLLEY.reachZ;
          if (reach < 1.2 * VU && b.z < top && b.z > 3) {
            if (attack && nearNet && b.z > 17) p.jumpAt = beachClock - 0.25;
            volleyAiHit(p);
          }
        }
      }
    }
    /* The player's stand-in: off to the sideline, watching, back when the player leaves. */
    function volleyBench(p, deltaSeconds) {
      const c = court(),
        spot = { x: c.x + teamSide(p.vteam) * 3 * VU, y: c.y + c.h / 2 + c.pit + 10 },
        d = Math.hypot(spot.x - p.x, spot.y - p.y);
      p.z = 0;
      if (d > 2) {
        beachWalkTo(p, spot, 30, deltaSeconds);
        return;
      }
      p.a = Math.atan2(beachBall.y - p.y, beachBall.x - p.x);
      p.pose = volley.cheerUntil > beachClock && volley.cheerTeam === p.vteam ? 'cheer' : 'stand';
    }
    /**
     * THE PLAYER IN THE MATCH
     */
    function volleyPlayerInMatch() {
      return !!volley.human;
    }
    function volleyCanJoin() {
      if (volley.human || gameMode !== 'play' || player.car || player.swimming || player.wading || player.pool) return false;
      if (volley.phase === 'idle' || volley.players.length < 4 || !beachBall.active) return false;
      return onVolleyCourt(player.x, player.y);
    }
    function volleyJoin() {
      if (!volleyCanJoin()) return false;
      const team = volleyTeamOf(player.x),
        mates = volley.players.filter((p) => p.vteam === team);
      const out = mates.reduce((best, p) => (!best || distanceBetween(p, player) < distanceBetween(best, player) ? p : best), null);
      if (!out) return false;
      out.benched = true;
      volley.human = { team, replaced: out, joinedAt: gameTime };
      volley.humanAthlete.team = team;
      volley.humanAthlete.x = player.x;
      volley.humanAthlete.y = player.y;
      volley.server[team] = 0;
      volley.pressAt = -100;
      volleyLog('player joins team ' + team);
      volleyNewGame(1 - team);
      tell('BEACH VOLLEY · first to ' + VOLLEY.target + ' · you receive', 3);
      showVolleyCard(true);
      return true;
    }
    function volleyLeave(message = 'You leave the court. The game goes on without you.') {
      if (!volley.human) return;
      const out = volley.human.replaced;
      if (out) out.benched = false;
      volley.human = null;
      volley.marker = null;
      player.jumpUntil = 0;
      showVolleyCard(false);
      tell(message, 2.6);
      volleyLog('player leaves');
      if (volley.phase !== 'idle') volleyNewGame();
    }
    function updateVolleyHuman(deltaSeconds) {
      const c = court(),
        side = teamSide(volley.human.team);
      if (player.car || player.swimming || !onVolleyCourt(player.x, player.y, 1.5 * VU) || gameMode !== 'play') {
        volleyLeave();
        return;
      }
      // Own half only: the net is solid, and past the poles the player is held back.
      const over = (player.x - c.x) * side;
      if (over < 3) player.x = c.x + side * 3;
      // A jump for the spike (game.js leaves the altitude alone meanwhile).
      if ((player.jumpUntil || 0) > gameTime) {
        const t = clamp((gameTime - (player.jumpAt || gameTime)) / 0.55, 0, 1);
        player.altitude = terrainHeight(player.x, player.y) + Math.sin(t * Math.PI) * 9;
      }
      // A press a moment early is held until the ball comes into reach.
      if (gameTime - volley.pressAt < 0.3 && volleyHumanReach().ok && volley.phase === 'rally') {
        volley.pressAt = -100;
        volleyHumanHit();
      }
      if (Math.random() < deltaSeconds * 5 && playerDriving()) particle(player.x, player.y, '#e3d2a4', 2, 18, 1.6);
      updateVolleyCard();
    }
    /* E (or a click) on the court while playing. */
    function volleyPress() {
      if (!volley.human) return false;
      if (volley.phase === 'serve' && volley.serverAthlete === volley.humanAthlete) return volleyHumanHit();
      if (volley.phase === 'rally') {
        if (!volleyHumanHit()) volley.pressAt = gameTime;
        return true;
      }
      return false;
    }
    /* A left click on the court hits instead of firing (game.js asks before shoot()). */
    function volleyTakesFire() {
      const click = mouse.down && !volley.mouseWas;
      volley.mouseWas = mouse.down;
      if (!volley.human) return false;
      if (click) volleyPress();
      return true;
    }
    function volleyPrompt() {
      if (volley.human) {
        if (volley.phase === 'serve' && volley.serverAthlete === volley.humanAthlete) return { text: 'SERVE', id: 'volley' };
        if (volley.phase === 'rally') return volleyHumanReach().ok ? { text: 'HIT', id: 'volley' } : null;
        if (volley.phase === 'dead' || volley.phase === 'won' || volley.phase === 'serve') return { text: 'LEAVE MATCH', id: 'volley' };
        return null;
      }
      if (volleyCanJoin()) return { text: 'JOIN MATCH', id: 'volley-join' };
      return null;
    }
    function volleyInteract() {
      if (volley.human) {
        if (volleyPress()) return true;
        if (volley.phase === 'dead' || volley.phase === 'won' || volley.phase === 'serve') {
          volleyLeave();
          return true;
        }
        return true;
      }
      return volleyJoin();
    }
    /**
     * THE HINT CARD
     * A small panel at the left edge while the player is in a match: the score
     * and the controls, named with the player's own key bindings.
     */
    function volleyCardElement() {
      let el = document.getElementById('volleyCard');
      if (el) return el;
      el = document.createElement('div');
      el.id = 'volleyCard';
      el.setAttribute('role', 'status');
      el.style.cssText =
        'position:fixed;left:16px;top:38%;z-index:30;max-width:250px;padding:10px 12px;border-radius:10px;' +
        'background:rgba(11,16,21,0.72);color:#eee7d6;font:600 12px/1.45 Arial,sans-serif;pointer-events:none;' +
        'box-shadow:0 4px 18px rgba(0,0,0,0.35);border:1px solid rgba(226,200,151,0.35);display:none';
      document.body.appendChild(el);
      return el;
    }
    function showVolleyCard(on) {
      const el = volleyCardElement();
      el.style.display = on ? 'block' : 'none';
      volley.cardShown = on;
      if (on) updateVolleyCard(true);
    }
    function updateVolleyCard(force = false) {
      if (!volley.cardShown || !volley.human) return;
      const key = volley.scoreVersion + '|' + volley.phase + '|' + (volley.serverAthlete === volley.humanAthlete);
      if (!force && key === volley.cardKey) return;
      volley.cardKey = key;
      const el = volleyCardElement(),
        h = volley.human,
        me = volley.score[h.team],
        them = volley.score[1 - h.team],
        row = (k, t) => {
          const line = document.createElement('div'),
            cap = document.createElement('b');
          cap.textContent = k;
          cap.style.color = '#e2c897';
          line.append(cap, ' ' + t);
          return line;
        };
      const title = document.createElement('div');
      title.textContent = 'BEACH VOLLEY · FIRST TO ' + VOLLEY.target;
      title.style.cssText = 'color:#7fe3ee;letter-spacing:0.06em;margin-bottom:2px';
      const score = document.createElement('div');
      score.textContent = 'YOU ' + me + ' – ' + them + ' THEM' + (volley.phase === 'serve' && volley.serverAthlete === volley.humanAthlete ? ' · YOUR SERVE' : '');
      score.style.cssText = 'font-size:16px;margin-bottom:6px';
      el.replaceChildren(
        title,
        score,
        row(moveKeysName(), 'move'),
        row(keyName('interact') + ' / CLICK', 'hit the ball when it is in reach'),
        row('MOUSE', 'aims the hit (or steer it with the movement keys)'),
        row(keyName('walk') + ' + HIT', 'soft set to your partner'),
        row('RUN + HIT AT THE NET', 'jump spike'),
        row('RING', 'where your ball comes down'),
        row('LEAVE', 'walk off the court, or ' + keyName('interact') + ' between points'),
      );
    }
    /* Developer console: DeadEndCity.volley(). */
    function volleyReport() {
      const c = court(),
        b = beachBall,
        round = (v) => Math.round(v * 10) / 10;
      return {
        court: { x: c.x, y: c.y, lengthM: VOLLEY.lengthM, widthM: VOLLEY.widthM, netM: VOLLEY.netM, pit: [c.x - c.w / 2 - c.pit, c.y - c.h / 2 - c.pit, c.x + c.w / 2 + c.pit, c.y + c.h / 2 + c.pit] },
        phase: volley.phase,
        score: [...volley.score],
        serveTeam: volley.serveTeam,
        server: volley.serverAthlete ? (volley.serverAthlete.human ? 'player' : 'team ' + volley.serverAthlete.vteam) : null,
        touches: volley.touches,
        touchTeam: volley.touchTeam,
        ball: b.active ? { x: round(b.x), y: round(b.y), z: round(b.z), vx: round(b.vx || 0), vy: round(b.vy || 0), vz: round(b.vz || 0), mode: b.mode } : null,
        receiver: volley.receiver ? (volley.receiver.human ? 'player' : 'team ' + volley.receiver.vteam) : null,
        intercept: volley.intercept
          ? { x: round(volley.intercept.x), y: round(volley.intercept.y), landX: round(volley.intercept.landX), landY: round(volley.intercept.landY), inSeconds: round(volley.intercept.t - beachClock) }
          : null,
        reach: volley.human ? volleyHumanReach().ok : null,
        players: volley.players.map((p) => ({ team: p.vteam, x: round(p.x), y: round(p.y), pose: p.pose, benched: !!p.benched })),
        human: volley.human ? { team: volley.human.team, x: round(player.x), y: round(player.y), hits: volley.humanHits, over: volley.humanOver } : null,
        canJoin: volleyCanJoin(),
        rallies: volley.rallies,
        hits: volley.hits,
        matches: volley.matches,
        lastPoint: volley.lastPoint,
        fans: beachgoers.filter((p) => p.kind === 'fan' && p.state === 'on').length,
        log: volley.log.slice(-12),
      };
    }
    /* Developer console: stand on the court on a side (0 west, 1 east) and join. */
    function volleyJoinConsole(team = 0) {
      const c = court();
      teleportPlayer(c.x + teamSide(team) * c.w * 0.3, c.y);
      volley.phase === 'idle' || volleyJoin();
      return volleyReport();
    }
    /* Developer console: lob the ball to the player (on their side, a serve from across). */
    function volleyLobToPlayer() {
      if (!volley.human) return null;
      const c = court(),
        b = beachBall,
        other = 1 - volley.human.team,
        from = { x: c.x + teamSide(other) * c.w * 0.3, y: c.y };
      b.x = from.x;
      b.y = from.y;
      b.z = 16;
      volley.phase = 'rally';
      volley.touchTeam = other;
      volley.touches = 1;
      volley.lastToucher = volleyTeam(other)[0] || null;
      volleyLaunchOver(player.x, player.y, 44, VOLLEY.bumpZ + 3);
      volleyPlan(other);
      return volleyReport();
    }
    /* Developer console: the court against the beach plan (towels, umbrellas, kiosks...). */
    function volleyCourtCheck() {
      const c = court(),
        L = BEACH_LAYOUT,
        x0 = c.x - c.w / 2 - c.pit - c.free,
        x1 = c.x + c.w / 2 + c.pit + c.free,
        y0 = c.y - c.h / 2 - c.pit - c.free,
        y1 = c.y + c.h / 2 + c.pit + c.free,
        hits = [];
      const inBox = (x, y, r = 0) => x + r > x0 && x - r < x1 && y + r > y0 && y - r < y1;
      for (const [kind, list, r] of [
        ['umbrella', L.umbrellas, 8],
        ['towel', L.towels, 9],
        ['lounger', L.loungers, 9],
        ['tower', L.towers, 18],
        ['shower', L.showers, 6],
        ['bin', L.bins, 3],
        ['rack', L.racks, 22],
        ['lamp', L.lamps, 2],
        ['table', L.tables, 10],
        ['castle', L.castles, 8],
        ['board', L.boards, 3],
      ])
        for (const p of list) if (inBox(p.x, p.y, r)) hits.push(kind + ' (' + Math.round(p.x) + ', ' + Math.round(p.y) + ')');
      for (const k of L.kiosks) if (k.x + k.w > x0 && k.x < x1 && k.y + k.h > y0 && k.y < y1) hits.push('kiosk ' + k.name);
      // The lines and the pit are dry sand on the beach, nothing solid on them but the poles.
      let wet = 0,
        blocked = 0;
      for (let x = x0 + 4; x < x1; x += 8)
        for (let y = y0 + 4; y < y1; y += 8) {
          if (!onBeach(x, y) || !landAt(x, y)) wet++;
          else if (Math.abs(x - c.x) > 6 && solid(x, y, 2)) blocked++;
        }
      if (wet) hits.push(wet + ' court points off the sand');
      if (blocked) hits.push(blocked + ' court points blocked');
      return { box: [x0, y0, x1, y1].map(Math.round), clear: !hits.length, hits };
    }
    // END SUBSYSTEM: src/beachvolley.js
