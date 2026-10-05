    // Open-sea countdown: 10 s flying or sailing away from all land starts RETURN TO THE CITY and 10 s more;
    // at zero a missile comes in from the coast and kills the player in whatever they are in. The tick, the cue.
    /**
     * OPEN SEA (file and names kept from the old world-edge rule)
     * Nothing turned aircraft, boats or swimmers back at the end of the map. The rule is about land,
     * not the map's edge: over land, near it or moving along a coast nothing shows. `worldEdge.out`
     * counts the seconds spent moving away from the nearest land (LAND_REGIONS and the bridge decks,
     * `worldEdgeLandDistance`) more than WORLD_EDGE_OPEN_SEA out; heading back takes them off again,
     * holding still keeps them. At WORLD_EDGE_AWAY the RETURN TO THE CITY card starts its
     * WORLD_EDGE_SECONDS countdown (now holding still counts too; only heading back for land winds it
     * back up, and coming within WORLD_EDGE_OPEN_SEA of land ends it). At zero a missile is fired
     * from the coast (`worldEdge.missile`): it homes on the player and its hit destroys the vehicle
     * (damageVehicle, the same path as any wreck) or kills the player on foot. God mode is warned
     * only. Far past the map (WORLD_EDGE_OUTER beyond `worldEdgeLine`) the countdown starts at once,
     * so a slow drift still meets it. Derived from where the player is each step: a teleport, a
     * respawn or a load simply starts again (`resetWorldEdge`, also clears a missile); nothing saved.
     * Only the player is watched: AI aircraft and boats keep their own limits.
     */
    const WORLD_EDGE_SECONDS = 10,
      // Seconds of moving away from land before the countdown shows.
      WORLD_EDGE_AWAY = 10,
      // Units (24 m) inside the world box: outside every piece of land (`worldEdge().landGap`). The liner's course
      // keeps inside it (marina-voyage.js); the countdown starts at once WORLD_EDGE_OUTER beyond it.
      WORLD_EDGE_INSET = 192,
      WORLD_EDGE_OUTER = 7000,
      // Within this distance of land (150 m) nothing counts: the bays, the harbours and a swim off the beach.
      WORLD_EDGE_OPEN_SEA = 1200,
      // Units/s of movement away from land (0.75 m/s: a swimmer counts) or toward it that counts as either.
      WORLD_EDGE_TOWARD = 6,
      WORLD_EDGE_ALLCLEAR = 2.4,
      // How often (game s) the nearest land is looked up again.
      WORLD_EDGE_LAND_EVERY = 0.2,
      // The missile: fired this far toward the coast from the player, this fast (160 m/s, over twice a plane at full power), turning this fast.
      WORLD_EDGE_MISSILE_RANGE = 2000,
      WORLD_EDGE_MISSILE_SPEED = 1300,
      WORLD_EDGE_MISSILE_TURN = 4,
      worldEdgeLine = {
        left: WORLD_LEFT + WORLD_EDGE_INSET,
        top: WORLD_TOP + WORLD_EDGE_INSET,
        right: WORLD_SIZE - WORLD_EDGE_INSET,
        bottom: WORLD_SIZE - WORLD_EDGE_INSET,
      },
      worldEdge = {
        // Seconds moving away from land (0 near land); the countdown runs from WORLD_EDGE_AWAY.
        out: 0,
        active: false,
        // Seconds left of the countdown (WORLD_EDGE_SECONDS until it starts).
        left: WORLD_EDGE_SECONDS,
        // Heading back for land while the countdown shows (it winds back up).
        back: false,
        // The whole second last ticked, so the tick sounds once per number.
        ticked: -1,
        // Seconds the all-clear stays on the card after a return.
        clear: 0,
        fired: false,
        spared: false,
        outAt: 0,
        history: [],
        // Measured movement of the player (smoothed units/s).
        px: 0,
        py: 0,
        vx: 0,
        vy: 0,
        moving: false,
        // The nearest land: distance (units), the point, when it was looked up, and the speed away from it (units/s).
        land: 0,
        landX: 0,
        landY: 0,
        landAt: -1,
        away: 0,
        // The missile in flight (null when none): position, altitude, velocity, seconds flown.
        missile: null,
        missileBeep: 0,
        hitAt: 0,
      };
    // How far (units) a point is outside the line; 0 inside it.
    function worldEdgeDepth(x, y) {
      return Math.max(0, worldEdgeLine.left - x, x - worldEdgeLine.right, worldEdgeLine.top - y, y - worldEdgeLine.bottom);
    }
    function resetWorldEdge() {
      worldEdge.out = 0;
      worldEdge.active = false;
      worldEdge.back = false;
      worldEdge.left = WORLD_EDGE_SECONDS;
      worldEdge.ticked = -1;
      worldEdge.clear = 0;
      worldEdge.fired = false;
      worldEdge.spared = false;
      worldEdge.moving = false;
      worldEdge.vx = worldEdge.vy = 0;
      worldEdge.landAt = -1;
      worldEdge.away = 0;
      worldEdge.missile = null;
    }
    // The coast as one list of segments (x0, y0, x1, y1), with each polygon's span and bounds for skipping far ones.
    const worldEdgeCoast = { count: -1, seg: null, spans: [] };
    function worldEdgeCoastBuild() {
      const lines = [];
      for (const r of LAND_REGIONS) {
        const poly = r.polygon || [];
        const pts = [];
        for (let i = 0; i < poly.length; i++) pts.push(poly[i][0], poly[i][1], poly[(i + 1) % poly.length][0], poly[(i + 1) % poly.length][1]);
        lines.push(pts);
      }
      for (const b of [...BRIDGES, ...MONARCH_BRIDGES]) lines.push([b.a[0], b.a[1], b.b[0], b.b[1]]);
      let n = 0;
      for (const l of lines) n += l.length;
      const seg = new Float64Array(n),
        spans = [];
      let at = 0;
      for (const l of lines) {
        let minx = Infinity,
          miny = Infinity,
          maxx = -Infinity,
          maxy = -Infinity;
        for (let i = 0; i < l.length; i += 2) {
          minx = Math.min(minx, l[i]);
          maxx = Math.max(maxx, l[i]);
          miny = Math.min(miny, l[i + 1]);
          maxy = Math.max(maxy, l[i + 1]);
        }
        seg.set(l, at);
        spans.push({ from: at, to: at + l.length, minx, miny, maxx, maxy });
        at += l.length;
      }
      worldEdgeCoast.count = LAND_REGIONS.length;
      worldEdgeCoast.seg = seg;
      worldEdgeCoast.spans = spans;
    }
    // Distance (units) from (x, y) to the nearest land or bridge deck, 0 over land; the nearest point goes in `out`.
    function worldEdgeLandDistance(x, y, out = worldEdge) {
      if (landAt(x, y)) {
        out.landX = x;
        out.landY = y;
        return 0;
      }
      if (worldEdgeCoast.count !== LAND_REGIONS.length) worldEdgeCoastBuild();
      const seg = worldEdgeCoast.seg,
        spans = worldEdgeCoast.spans;
      let best = Infinity,
        bx = x,
        by = y;
      for (let k = 0; k < spans.length; k++) {
        const s = spans[k],
          ox = Math.max(0, s.minx - x, x - s.maxx),
          oy = Math.max(0, s.miny - y, y - s.maxy);
        if (ox * ox + oy * oy >= best) continue;
        for (let i = s.from; i < s.to; i += 4) {
          const ax = seg[i],
            ay = seg[i + 1],
            dx = seg[i + 2] - ax,
            dy = seg[i + 3] - ay,
            len = dx * dx + dy * dy,
            t = len > 0 ? clamp(((x - ax) * dx + (y - ay) * dy) / len, 0, 1) : 0,
            px = ax + t * dx,
            py = ay + t * dy,
            d = (x - px) * (x - px) + (y - py) * (y - py);
          if (d < best) {
            best = d;
            bx = px;
            by = py;
          }
        }
      }
      out.landX = bx;
      out.landY = by;
      return Math.sqrt(best);
    }
    // The player's own movement, measured from where they were last step (a teleport resets it).
    function worldEdgeMeasure(dt) {
      const w = worldEdge;
      if (w.moving && dt > 0) {
        const rx = (player.x - w.px) / dt,
          ry = (player.y - w.py) / dt;
        // A jump (not a way of moving) is not a velocity.
        if (hypot2(rx, ry) < 3000) {
          const k = 1 - Math.exp(-dt / 0.35);
          w.vx += (rx - w.vx) * k;
          w.vy += (ry - w.vy) * k;
        } else w.vx = w.vy = 0;
      } else w.vx = w.vy = 0;
      w.px = player.x;
      w.py = player.y;
      w.moving = true;
    }
    /* Only a player who can get out to sea counts: in the air (an aircraft, a parachute, a fall) or afloat (a
       boat, swimming), never aboard a ship (player.deck: she goes where she goes, inside the line). */
    function worldEdgeCanReach() {
      if (player.deck) return false;
      const c = player.car;
      if (c) return isAircraft(c) || isBoat(c);
      return !!(player.swimming || player.parachute || player.fall);
    }
    function worldEdgeNote(kind) {
      worldEdge.history.push({ kind, at: +gameTime.toFixed(1), x: Math.round(player.x), y: Math.round(player.y), vehicle: player.car?.type || null });
      if (worldEdge.history.length > 8) worldEdge.history.shift();
    }
    // The tick: higher and sharper as the numbers run down.
    function worldEdgeTick(n) {
      tone(n <= 3 ? 1040 : 780, n <= 3 ? 0.09 : 0.06, 0.1, 'square');
    }
    // The countdown ended, or the player came back: the card goes, an all-clear if it was showing.
    function worldEdgeEnd(kind) {
      const w = worldEdge,
        shown = w.active && !w.spared;
      w.out = kind === 'back' ? Math.min(w.out, WORLD_EDGE_AWAY - 0.01) : 0;
      if (!w.active) return;
      w.active = false;
      w.back = false;
      w.left = WORLD_EDGE_SECONDS;
      w.ticked = -1;
      w.spared = false;
      w.clear = WORLD_EDGE_ALLCLEAR;
      worldEdgeNote(kind);
      tone(660, 0.16, 0.1, 'sine', 990);
      if (shown) tell('ALL CLEAR · HEADING BACK TO THE CITY', 2.4, { id: 'world-edge', tone: 'good' });
    }
    function worldEdgePlayerElevation() {
      return entityElevation(player.car || player);
    }
    // Zero: the missile is fired from the coast side of the player, a little above them.
    function worldEdgeFire() {
      const w = worldEdge,
        dx = w.landX - player.x,
        dy = w.landY - player.y,
        d = hypot2(dx, dy) || 1,
        ux = d > 1 ? dx / d : -Math.sign(w.vx || 1),
        uy = d > 1 ? dy / d : 0,
        x = player.x + ux * WORLD_EDGE_MISSILE_RANGE,
        y = player.y + uy * WORLD_EDGE_MISSILE_RANGE,
        altitude = worldEdgePlayerElevation() + 240;
      w.missile = { x, y, altitude, vx: -ux * WORLD_EDGE_MISSILE_SPEED, vy: -uy * WORLD_EDGE_MISSILE_SPEED, vz: 0, flown: 0 };
      w.missileBeep = 0;
      worldEdgeNote('missile');
      playSample('explosion', 0.25, 1.7, { x, y, altitude });
      tone(320, 1.1, 0.08, 'sawtooth', 1300);
    }
    // The missile in flight: it steers onto the player (they cannot outrun it) and goes off on them.
    function worldEdgeMissileStep(dt) {
      const w = worldEdge,
        m = w.missile,
        tz = worldEdgePlayerElevation() + 6,
        dx = player.x - m.x,
        dy = player.y - m.y,
        dz = tz - m.altitude,
        d = Math.sqrt(dx * dx + dy * dy + dz * dz),
        step = WORLD_EDGE_MISSILE_SPEED * dt;
      m.flown += dt;
      if (d <= Math.max(30, step) || m.flown > 8) {
        w.missile = null;
        worldEdgeHit();
        return;
      }
      // Steer the velocity toward the player, then hold the speed.
      const k = Math.min(1, WORLD_EDGE_MISSILE_TURN * dt),
        s = WORLD_EDGE_MISSILE_SPEED / d;
      m.vx += (dx * s - m.vx) * k;
      m.vy += (dy * s - m.vy) * k;
      m.vz += (dz * s - m.vz) * k;
      const v = Math.sqrt(m.vx * m.vx + m.vy * m.vy + m.vz * m.vz) || 1;
      m.vx *= WORLD_EDGE_MISSILE_SPEED / v;
      m.vy *= WORLD_EDGE_MISSILE_SPEED / v;
      m.vz *= WORLD_EDGE_MISSILE_SPEED / v;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.altitude += m.vz * dt;
      if (city3D) city3D.smokePuff(m.x, m.y, m.altitude, 1);
      // The lock warning, faster as it closes.
      w.missileBeep -= dt;
      if (w.missileBeep <= 0) {
        w.missileBeep = clamp(d / 6000, 0.07, 0.3);
        tone(1480, 0.045, 0.07, 'square');
      }
    }
    function worldEdgeHit() {
      const car = player.car;
      worldEdgeNote('fatal');
      explode(player.x, player.y, 1.2, 'world', worldEdgePlayerElevation());
      // God mode (switched on while it flew) is shaken, never harmed, and the clock starts over.
      if (player.godMode || gameMode !== 'play') {
        if (gameMode === 'play') resetWorldEdge();
        return;
      }
      worldEdge.hitAt = gameTime;
      if (car && car.hp > 0) {
        // The same path as any wreck: physics-update.js explodes it and the blast kills the occupant.
        damageVehicle(car, car.hp + 1, car.x, car.y, null, { kind: 'blast', x: car.x, y: car.y, power: 1, falloff: 1 });
        if (isAircraft(car)) car.abandonedFlight = true;
      } else {
        player.hp = 0;
        die();
      }
    }
    function updateWorldEdge(dt) {
      if (gameMode !== 'play') return;
      const w = worldEdge;
      worldEdgeMeasure(dt);
      if (w.missile) worldEdgeMissileStep(dt);
      // Still in play a while after the hit (nothing left to kill): start over.
      if (w.fired) {
        if (!w.missile && gameTime - w.hitAt > 3) resetWorldEdge();
        return;
      }
      if (!worldEdgeCanReach()) {
        worldEdgeEnd('land');
        if (w.clear > 0) w.clear = Math.max(0, w.clear - dt);
        return;
      }
      if (w.landAt < 0 || gameTime - w.landAt >= WORLD_EDGE_LAND_EVERY || gameTime < w.landAt) {
        w.land = worldEdgeLandDistance(player.x, player.y);
        w.landAt = gameTime;
      }
      const ldx = player.x - w.landX,
        ldy = player.y - w.landY,
        ld = hypot2(ldx, ldy);
      // Speed straight away from the nearest land (negative: toward it).
      w.away = ld > 1 ? (w.vx * ldx + w.vy * ldy) / ld : 0;
      const far = worldEdgeDepth(player.x, player.y) > WORLD_EDGE_OUTER;
      if (w.land < WORLD_EDGE_OPEN_SEA && !far) {
        worldEdgeEnd('back');
        w.out = 0;
        if (w.clear > 0) w.clear = Math.max(0, w.clear - dt);
        return;
      }
      const heading = w.away < -WORLD_EDGE_TOWARD;
      if (w.active) w.out += heading ? -dt : dt;
      else if (w.away > WORLD_EDGE_TOWARD) w.out += dt;
      else if (heading) w.out = Math.max(0, w.out - dt);
      if (far) w.out = Math.max(w.out, WORLD_EDGE_AWAY);
      if (w.out < WORLD_EDGE_AWAY) {
        if (w.active) worldEdgeEnd('back');
        else if (w.clear > 0) w.clear = Math.max(0, w.clear - dt);
        return;
      }
      if (!w.active) {
        w.active = true;
        w.ticked = -1;
        w.clear = 0;
        w.spared = false;
        w.outAt = gameTime;
        worldEdgeNote('out');
      }
      w.out = Math.min(w.out, WORLD_EDGE_AWAY + WORLD_EDGE_SECONDS);
      w.back = heading;
      w.left = WORLD_EDGE_AWAY + WORLD_EDGE_SECONDS - w.out;
      const second = Math.ceil(w.left - 1e-6);
      if (second !== w.ticked) {
        // Only the numbers going down tick.
        if (second > 0 && (w.ticked < 0 || second < w.ticked)) worldEdgeTick(second);
        w.ticked = second;
      }
      if (w.left > 0) {
        w.spared = false;
        return;
      }
      // Zero. God mode is warned, never harmed.
      if (player.godMode) {
        w.spared = true;
        return;
      }
      w.fired = true;
      worldEdgeFire();
    }
    // The cue's state for the HUD: null when nothing shows.
    function worldEdgeCueState() {
      const w = worldEdge;
      if (w.fired && (w.missile || gameMode === 'play')) return { state: 'missile' };
      if (!w.active && w.clear <= 0) return null;
      if (!w.active) return { state: 'clear' };
      const dx = w.landX - player.x,
        dy = w.landY - player.y,
        // Screen degrees clockwise from straight up (north is up the screen, -y): toward the nearest land.
        turn = (Math.atan2(dx, -dy) * 180) / Math.PI,
        way = compassWord(dx, dy).toUpperCase();
      return {
        state: w.back ? 'back' : w.left <= 3 ? 'danger' : w.left <= 6 ? 'warn' : 'count',
        count: Math.max(0, Math.ceil(w.left - 1e-6)),
        fraction: clamp(w.left / WORLD_EDGE_SECONDS, 0, 1),
        turn,
        way,
        metres: Math.round(worldMeters(w.land)),
        god: !!player.godMode,
      };
    }
    function worldEdgeLength(metres) {
      return metres >= 1000 ? (metres / 1000).toFixed(1) + ' KM' : Math.round(metres / 10) * 10 + ' M';
    }
    const worldEdgeCue = { shown: '', big: '', note: '', call: '', turn: -999, fraction: -1 };
    // From updateHud(): the countdown, the missile and briefly the all-clear, and only in play.
    function updateWorldEdgeCue() {
      const root = getElement('worldEdgeCue');
      if (!root) return;
      // A title menu, WASTED or a new life starts afresh; a pause or the map only freezes it.
      if (gameMode === 'dead' || gameMode === 'menu') resetWorldEdge();
      const cue = worldEdgeCueState();
      if (!cue) {
        if (worldEdgeCue.shown) {
          worldEdgeCue.shown = '';
          root.classList.remove('on');
        }
        return;
      }
      if (!worldEdgeCue.shown) root.classList.add('on');
      if (cue.state !== worldEdgeCue.shown) {
        worldEdgeCue.shown = cue.state;
        root.dataset.state = cue.state;
      }
      const call = cue.state === 'clear' ? 'ALL CLEAR' : cue.state === 'missile' ? 'MISSILE INBOUND' : 'RETURN TO THE CITY',
        god = cue.god ? 'GOD MODE · ' : '';
      let big = '',
        note = '';
      if (cue.state === 'clear') {
        big = 'OK';
        note = 'HEADING BACK TO THE CITY';
      } else if (cue.state === 'missile') {
        big = '!';
        note = 'TOO LATE TO TURN BACK';
      } else {
        big = String(cue.count);
        note = god + (cue.state === 'back' ? 'HEADING BACK · LAND ' + worldEdgeLength(cue.metres) : 'LAND ' + worldEdgeLength(cue.metres) + ' · HEAD ' + cue.way);
      }
      if (call !== worldEdgeCue.call) {
        worldEdgeCue.call = call;
        getElement('worldEdgeCall').textContent = call;
      }
      if (big !== worldEdgeCue.big) {
        const prev = +worldEdgeCue.big,
          down = !(prev <= +big);
        worldEdgeCue.big = big;
        getElement('worldEdgeCount').textContent = big;
        // Restart the one-second pulse on each new number going down (and the missile's mark).
        if (down || cue.state === 'missile') {
          root.classList.remove('beat');
          void getComputedStyle(root).animationName; // a style pass restarts the animation (offsetWidth also laid out the page)
          root.classList.add('beat');
        }
      }
      if (note !== worldEdgeCue.note) {
        worldEdgeCue.note = note;
        getElement('worldEdgeNote').textContent = note;
      }
      if (cue.state === 'clear' || cue.state === 'missile') return;
      if (Math.abs(cue.turn - worldEdgeCue.turn) >= 1) {
        worldEdgeCue.turn = cue.turn;
        root.style.setProperty('--we-turn', cue.turn.toFixed(0) + 'deg');
      }
      if (Math.abs(cue.fraction - worldEdgeCue.fraction) >= 0.004) {
        worldEdgeCue.fraction = cue.fraction;
        root.style.setProperty('--we-left', cue.fraction.toFixed(3));
      }
    }
    function worldEdgeCueRect() {
      const el = document.getElementById('worldEdgeCue');
      if (!el) return null;
      const r = el.getBoundingClientRect(),
        css = getComputedStyle(el);
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visibility: css.visibility, opacity: +css.opacity, viewport: [innerWidth, innerHeight] };
    }
    // The sea point inside the line farthest from any land (256-unit grid, worked out once): how far out the map itself goes.
    let worldEdgeFarthest = null;
    function worldEdgeFarthestSea() {
      if (worldEdgeFarthest) return worldEdgeFarthest;
      const probe = { landX: 0, landY: 0 };
      let best = { x: 0, y: 0, metres: 0 };
      for (let x = worldEdgeLine.left; x <= worldEdgeLine.right; x += 256)
        for (let y = worldEdgeLine.top; y <= worldEdgeLine.bottom; y += 256) {
          const d = worldEdgeLandDistance(x, y, probe);
          if (d > best.metres) best = { x, y, metres: d };
        }
      best.metres = Math.round(worldMeters(best.metres));
      return (worldEdgeFarthest = best);
    }
    // Console worldEdge(): the open-sea clock, the countdown, the missile, the nearest land and the line.
    function worldEdgeReport() {
      const land = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      for (const r of LAND_REGIONS)
        for (const [x, y] of r.polygon || []) {
          land.left = Math.min(land.left, x);
          land.top = Math.min(land.top, y);
          land.right = Math.max(land.right, x);
          land.bottom = Math.max(land.bottom, y);
        }
      const cue = worldEdgeCueState();
      return {
        seconds: WORLD_EDGE_SECONDS,
        inset: WORLD_EDGE_INSET,
        line: { ...worldEdgeLine },
        box: { left: WORLD_LEFT, top: WORLD_TOP, right: WORLD_SIZE, bottom: WORLD_SIZE },
        land,
        // Land to line, per side (positive: the line is clear of the land).
        landGap: { left: land.left - worldEdgeLine.left, top: land.top - worldEdgeLine.top, right: worldEdgeLine.right - land.right, bottom: worldEdgeLine.bottom - land.bottom },
        active: worldEdge.active,
        // Seconds moving away from land (the countdown starts at `away`), the nearest land (m) and the speed away from it (m/s).
        out: +worldEdge.out.toFixed(2),
        awaySeconds: WORLD_EDGE_AWAY,
        openSea: Math.round(worldMeters(WORLD_EDGE_OPEN_SEA)),
        landMetres: Math.round(worldMeters(worldEdge.land)),
        awaySpeed: +worldMeters(worldEdge.away).toFixed(1),
        back: worldEdge.back,
        canReach: worldEdgeCanReach(),
        v: [Math.round(worldMeters(worldEdge.vx)), Math.round(worldMeters(worldEdge.vy))],
        missile: worldEdge.missile
          ? { x: Math.round(worldEdge.missile.x), y: Math.round(worldEdge.missile.y), altitude: Math.round(worldEdge.missile.altitude), flown: +worldEdge.missile.flown.toFixed(2), metres: Math.round(worldMeters(hypot2(player.x - worldEdge.missile.x, player.y - worldEdge.missile.y))) }
          : null,
        left: +worldEdge.left.toFixed(2),
        fired: worldEdge.fired,
        spared: worldEdge.spared,
        clear: +worldEdge.clear.toFixed(2),
        outside: worldEdgeDepth(player.x, player.y) > 0,
        depth: Math.round(worldEdgeDepth(player.x, player.y)),
        outer: WORLD_EDGE_OUTER,
        farthestSea: worldEdgeFarthestSea(),
        cue,
        shown: !!document.getElementById('worldEdgeCue')?.classList.contains('on'),
        count: document.getElementById('worldEdgeCount')?.textContent,
        note: document.getElementById('worldEdgeNote')?.textContent,
        // Where the card is on screen (CSS pixels) and whether it is visible.
        rect: worldEdgeCueRect(),
        history: worldEdge.history.slice(),
      };
    }
