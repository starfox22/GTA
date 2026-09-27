    // Beach games (volleyball rally, frisbee) and panic: beachHearsViolence, fleeing, car threats, crowd level, beachStatus.
    /**
     * GAMES
     * The volleyball rally and the frisbee pairs share one idea: a projectile
     * flies from one player to another on a parabola, the receiver reaches for
     * it as it arrives, and plays it on.
     */
    function updateBeachGames(deltaSeconds) {
      // Pedal boats and jet skis loop out beyond the buoys while someone is aboard.
      for (const boat of [...BEACH_LAYOUT.pedalos, ...BEACH_LAYOUT.jetskis]) {
        if (boat.beached) continue;
        const dir = Math.sign(boat.speed);
        boat.phase = (boat.phase || 0) + deltaSeconds * boat.speed;
        boat.x = boat.cx + Math.cos(boat.phase) * boat.r;
        boat.y = boat.cy + Math.sin(boat.phase) * boat.r * 0.55;
        boat.a = Math.atan2(Math.cos(boat.phase) * 0.55 * dir, -Math.sin(boat.phase) * dir);
        boat.active = beachgoers.some((p) => p.boat === boat && p.visible && p.state === 'on');
      }
      // Beach volleyball: the match, its ball and the player joining in (beachvolley.js).
      updateVolleyball(
        deltaSeconds,
        beachgoers.filter((p) => p.kind === 'volley' && p.state === 'on'),
      );
      for (const g of beachDiscs) {
        const on = g.a.state === 'on' && g.b.state === 'on';
        g.active = on;
        if (!on) continue;
        for (const p of [g.a, g.b]) {
          p.x = p.anchor.x;
          p.y = p.anchor.y;
          p.a = Math.atan2(p.partner.y - p.y, p.partner.x - p.x);
          if (p.pose !== 'throw' || beachClock > (p.poseUntil || 0)) p.pose = 'stand';
        }
        if (g.wait > 0) {
          g.wait -= deltaSeconds;
          g.x = g.holder.x;
          g.y = g.holder.y;
          g.z = 10;
          if (g.wait <= 0) {
            g.holder.pose = 'throw';
            g.holder.poseUntil = beachClock + 0.4;
            g.t = 0;
          }
          continue;
        }
        g.t += deltaSeconds / g.dur;
        const from = g.holder,
          to = g.holder.partner,
          k = Math.min(1, g.t),
          bend = Math.sin(k * Math.PI) * (g.ball ? 0 : 10);
        g.x = from.x + (to.x - from.x) * k - Math.sin(from.a) * bend;
        g.y = from.y + (to.y - from.y) * k + Math.cos(from.a) * bend;
        g.z = 10 + Math.sin(k * Math.PI) * (g.ball ? 26 : 9);
        if (k >= 1) {
          to.pose = 'throw';
          to.poseUntil = beachClock + 0.3;
          g.holder = to;
          g.wait = 0.8 + Math.random() * 1.4;
        }
      }
    }
    /**
     * PANIC
     * Called by notifyViolence for every shot and blast. Near the danger, people
     * on the sand join the city's pedestrians, already fleeing; further off they
     * run for the boardwalk and leave; swimmers duck under and strike out away.
     */
    function beachHearsViolence(source, kind = 'gunfire') {
      if (!beachgoers.length || Math.abs(source.x + 1970) > 1500 || Math.abs(source.y - 5600) > 900) return;
      // Only the nearest dozen become full pedestrians: each costs a whole person
      // model to draw, and the rest are just as convincing running off the sand.
      const heard = kind === 'explosion' ? 900 : 620,
        near = kind === 'explosion' ? 300 : 200;
      const hearing = [];
      for (const p of beachgoers) {
        if (!p.visible || p.state === 'off' || p.state === 'flee') continue;
        const d = Math.hypot(p.x - source.x, p.y - source.y);
        if (d <= heard) hearing.push({ p, d });
      }
      hearing.sort((a, b) => a.d - b.d);
      hearing.forEach(({ p, d }, i) => beachFlee(p, source, d < near && i < 12));
      if (hearing.length) beachSpooked = 180;
    }
    function beachFlee(p, threat, becomePedestrian) {
      p.fledFor = 90 + Math.random() * 90;
      if (p.kind === 'swimmer') {
        p.dive = 1.5 + Math.random() * 1.5;
        const away = Math.atan2(p.y - threat.y, p.x - threat.x);
        p.goal = { x: p.x + Math.cos(away) * 120, y: p.y + Math.sin(away) * 60 };
        p.mode = 'swim';
        p.timer = 10;
        return;
      }
      if (p.kind === 'rider') return;
      if (becomePedestrian && !p.tower && groundAt(p.x, p.y, 5) && !solid(p.x, p.y, 5)) {
        pedestrians.push({
          x: p.x,
          y: p.y,
          a: Math.atan2(p.y - threat.y, p.x - threat.x),
          color: p.shirt || p.suit,
          hp: 30,
          flee: 8 + Math.random() * 4,
          threat: { x: threat.x, y: threat.y },
          panicSaid: false,
          timer: 4,
          walk: 0,
          state: 'walk',
          fromBeach: true,
        });
        p.state = 'off';
        p.visible = false;
        return;
      }
      // Grab the towel and go: up the sand, away from the trouble, off the beach.
      const entry = boardwalkEntry(p),
        away = Math.sign(p.x - threat.x) || 1;
      p.state = 'flee';
      p.target = { x: clamp(entry.x + away * 160, BEACH.boardwalk.x0 + 10, BEACH.boardwalk.x1 - 10), y: entry.y - 4 };
      if (p.tower) p.z = 0;
    }
    /* A car on the sand scatters whoever is in its path, and runs down anyone it reaches. */
    function beachCarThreats(deltaSeconds) {
      for (const c of vehicles) {
        if (c.hp <= 0 || isBoat(c) || isAircraft(c) || Math.abs(c.speed || 0) < 45) continue;
        if (c.x < -2710 || c.x > -1250 || c.y < 5330 || c.y > 5860) continue;
        const ahead = { x: c.x + Math.cos(c.a) * 40, y: c.y + Math.sin(c.a) * 40 };
        for (const p of beachgoers) {
          if (!p.visible || p.state === 'flee' || p.state === 'off' || BEACH_WATER_KINDS.includes(p.kind) || p.tower) continue;
          const d = Math.hypot(p.x - ahead.x, p.y - ahead.y);
          if (d < 90) beachFlee(p, c, d < 45);
          if (d < 90 && !beachSpooked) beachSpooked = 60;
        }
      }
    }
    /* 0..1: how much crowd noise there is around a point (cached twice a second). */
    function beachCrowdLevel(x, y) {
      if (!beachgoers.length) return 0;
      if (gameTime - beachCrowdCache.at < 0.5 && Math.hypot(x - beachCrowdCache.x, y - beachCrowdCache.y) < 80) return beachCrowdCache.level;
      let n = 0;
      if (Math.abs(x + 1970) < 1400 && Math.abs(y - 5600) < 900)
        for (const p of beachgoers) if (p.visible && p.state !== 'off' && Math.hypot(p.x - x, p.y - y) < 480) n++;
      beachCrowdCache = { at: gameTime, x, y, level: clamp(n / 45, 0, 1) };
      return beachCrowdCache.level;
    }
    /* Developer console: how busy the beach is and who is doing what. */
    function beachStatus() {
      const byKind = {},
        byPose = {};
      for (const p of beachgoers)
        if (p.visible && p.state !== 'off') {
          byKind[p.kind] = (byKind[p.kind] || 0) + 1;
          byPose[p.pose] = (byPose[p.pose] || 0) + 1;
        }
      const L = BEACH_LAYOUT;
      return {
        clock: clockText(),
        density: +beachDensity().toFixed(2),
        spooked: Math.round(beachSpooked),
        slots: beachgoers.length,
        present: Object.values(byKind).reduce((a, b) => a + b, 0),
        byKind,
        byPose,
        props: {
          umbrellas: L.umbrellas.length,
          towels: L.towels.length,
          loungers: L.loungers.length,
          towers: L.towers.length,
          kiosks: L.kiosks.length,
          buoys: L.buoys.length,
          castles: L.castles.length,
        },
      };
    }
