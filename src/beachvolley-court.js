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
