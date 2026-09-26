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
