    // World-edge countdown: past the line just inside the world box the player has 10 s to return, or the vehicle blows up and WASTED.
    // Holds the line, the countdown state (derived from the player's position every step), the tick sound and the RETURN TO THE CITY cue.
    /**
     * WORLD EDGE
     * The world box (game-state.js WORLD_LEFT..WORLD_SIZE x WORLD_TOP..WORLD_SIZE) is what the
     * sea plane, the map and the cloud and shore fields cover. Cars and people cannot reach its
     * edge, but aircraft (planes, helicopters, the Apache), boats, a swimmer, a parachutist or a
     * vehicle carried out there can, and nothing turned them back. The line is
     * WORLD_EDGE_INSET units inside the box (outside every piece of land, `worldEdge().landGap`):
     * crossing it starts a WORLD_EDGE_SECONDS countdown on game time; back inside cancels it; at
     * zero the player's vehicle is blown up (damageVehicle, so physics-update.js explodes it and
     * kills the occupant) or, with no vehicle, the player dies (die()); god mode only warns.
     * The state is derived from where the player is each step, so a teleport, a respawn, a new
     * game or a load that starts outside the line simply begins at once, and nothing is saved.
     * Before the line a calm APPROACH warning (never lethal, god mode sees it too): the card shows when
     * an edge is within WORLD_EDGE_APPROACH_SECONDS of travel along the player's measured velocity, or
     * within WORLD_EDGE_APPROACH_UNITS, and the player really is moving toward it; it clears when they turn.
     * Only the player is watched: AI aircraft and boats keep their own limits.
     */
    const WORLD_EDGE_SECONDS = 10,
      // Units (24 m) inside the box: the county's coast is 234 units short of the east edge and the south coast 314, so the line clears all land; the north sea plane ends 176 units past WORLD_TOP.
      WORLD_EDGE_INSET = 192,
      WORLD_EDGE_ALLCLEAR = 2.4,
      // The approach warning: the line is at most this many game seconds ahead along the way the player
      // is moving (a plane at full speed, ~640 units/s, is warned 16,000 units out: the whole box, but
      // turning back at that speed takes ~3,300 units), or within this distance whatever the speed
      // (a boat, a swimmer), provided there is real movement toward that edge; it clears with hysteresis.
      WORLD_EDGE_APPROACH_SECONDS = 25,
      WORLD_EDGE_APPROACH_UNITS = 3200,
      WORLD_EDGE_APPROACH_TOWARD = 16,
      worldEdgeLine = {
        left: WORLD_LEFT + WORLD_EDGE_INSET,
        top: WORLD_TOP + WORLD_EDGE_INSET,
        right: WORLD_SIZE - WORLD_EDGE_INSET,
        bottom: WORLD_SIZE - WORLD_EDGE_INSET,
      },
      worldEdge = {
        active: false,
        // Seconds left of the countdown (WORLD_EDGE_SECONDS while the player is inside).
        left: WORLD_EDGE_SECONDS,
        // The whole second last ticked, so the tick sounds once per number.
        ticked: -1,
        // Seconds the all-clear stays on the card after a return.
        clear: 0,
        fired: false,
        spared: false,
        outAt: 0,
        history: [],
        // Measured movement of the player (smoothed units/s) and the approach warning.
        px: 0,
        py: 0,
        vx: 0,
        vy: 0,
        moving: false,
        approach: false,
        approachSeconds: 0,
        approachDistance: 0,
        approachEdge: '',
      };
    // How far (units) a point is outside the line; 0 inside it.
    function worldEdgeDepth(x, y) {
      return Math.max(0, worldEdgeLine.left - x, x - worldEdgeLine.right, worldEdgeLine.top - y, y - worldEdgeLine.bottom);
    }
    function resetWorldEdge() {
      worldEdge.active = false;
      worldEdge.left = WORLD_EDGE_SECONDS;
      worldEdge.ticked = -1;
      worldEdge.clear = 0;
      worldEdge.fired = false;
      worldEdge.spared = false;
      worldEdge.moving = false;
      worldEdge.vx = worldEdge.vy = 0;
      worldEdge.approach = false;
    }
    // The player's own movement, measured from where they were last step (a teleport resets it).
    function worldEdgeMeasure(dt) {
      const w = worldEdge;
      if (w.moving && dt > 0) {
        const rx = (player.x - w.px) / dt,
          ry = (player.y - w.py) / dt;
        // A jump (not a way of moving) is not a velocity.
        if (Math.hypot(rx, ry) < 3000) {
          const k = 1 - Math.exp(-dt / 0.35);
          w.vx += (rx - w.vx) * k;
          w.vy += (ry - w.vy) * k;
        } else w.vx = w.vy = 0;
      } else w.vx = w.vy = 0;
      w.px = player.x;
      w.py = player.y;
      w.moving = true;
    }
    /* Only a player who can reach the line is warned: in the air (an aircraft, a parachute, a fall) or
       afloat (a boat, swimming). On foot or in a road vehicle the sea comes first, and the county's east
       coast ends only 42 units short of the line: a drive east up Mount Ascent used to raise the card
       400 m inland. */
    function worldEdgeCanReach() {
      const c = player.car;
      if (c) return isAircraft(c) || isBoat(c);
      return !!(player.swimming || player.parachute || player.fall);
    }
    // Inside the line: is an edge close enough along the way the player moves? Sets worldEdge.approach*.
    function worldEdgeApproach() {
      const w = worldEdge,
        more = w.approach ? 1.2 : 1;
      let best = null;
      if (!worldEdgeCanReach()) {
        w.approach = false;
        w.approachSeconds = w.approachDistance = 0;
        w.approachEdge = '';
        return;
      }
      for (const [edge, gap, speed] of [
        ['WEST', player.x - worldEdgeLine.left, -w.vx],
        ['EAST', worldEdgeLine.right - player.x, w.vx],
        ['NORTH', player.y - worldEdgeLine.top, -w.vy],
        ['SOUTH', worldEdgeLine.bottom - player.y, w.vy],
      ]) {
        // Aboard a ship (player.deck) the player goes where she goes, and the liner's
        // course keeps well inside the line (marina-voyage.js linerVoyageCheck).
        if (player.deck || speed < WORLD_EDGE_APPROACH_TOWARD) continue;
        const seconds = gap / speed;
        if ((seconds <= WORLD_EDGE_APPROACH_SECONDS * more || gap <= WORLD_EDGE_APPROACH_UNITS * more) && (!best || seconds < best.seconds)) best = { edge, gap, seconds };
      }
      w.approach = !!best;
      w.approachSeconds = best ? best.seconds : 0;
      w.approachDistance = best ? best.gap : 0;
      w.approachEdge = best ? best.edge : '';
    }
    function worldEdgeNote(kind) {
      worldEdge.history.push({ kind, at: +gameTime.toFixed(1), x: Math.round(player.x), y: Math.round(player.y), vehicle: player.car?.type || null });
      if (worldEdge.history.length > 8) worldEdge.history.shift();
    }
    // The tick: higher and sharper as the numbers run down.
    function worldEdgeTick(n) {
      tone(n <= 3 ? 1040 : 780, n <= 3 ? 0.09 : 0.06, 0.1, 'square');
    }
    function updateWorldEdge(dt) {
      if (gameMode !== 'play') return;
      const w = worldEdge;
      worldEdgeMeasure(dt);
      if (worldEdgeDepth(player.x, player.y) <= 0) {
        worldEdgeApproach();
        if (w.active) {
          const spared = w.spared;
          w.active = false;
          w.left = WORLD_EDGE_SECONDS;
          w.ticked = -1;
          w.fired = false;
          w.spared = false;
          w.clear = WORLD_EDGE_ALLCLEAR;
          worldEdgeNote('back');
          tone(660, 0.16, 0.1, 'sine', 990);
          if (!spared) tell('ALL CLEAR · BACK INSIDE THE CITY LIMITS', 2.4, { id: 'world-edge', tone: 'good' });
        } else if (w.clear > 0) w.clear = Math.max(0, w.clear - dt);
        return;
      }
      w.approach = false;
      if (!w.active) {
        w.active = true;
        w.left = WORLD_EDGE_SECONDS;
        w.ticked = -1;
        w.clear = 0;
        w.fired = false;
        w.spared = false;
        w.outAt = gameTime;
        worldEdgeNote('out');
      }
      if (w.fired) return;
      w.left = Math.max(0, w.left - dt);
      const second = Math.ceil(w.left - 1e-6);
      if (second !== w.ticked) {
        w.ticked = second;
        if (second > 0) worldEdgeTick(second);
      }
      if (w.left > 0) return;
      // Zero. God mode is warned, never harmed.
      if (player.godMode) {
        w.spared = true;
        return;
      }
      w.fired = true;
      worldEdgeNote('fatal');
      const car = player.car;
      if (car && car.hp > 0) {
        tell('YOU LEFT THE CITY · THE ' + (isAircraft(car) ? 'AIRCRAFT' : 'VEHICLE') + ' EXPLODES', 3, { id: 'world-edge', tone: 'warn' });
        // The same path as any wreck: physics-update.js explodes it and the blast kills the occupant.
        damageVehicle(car, car.hp + 1, car.x, car.y, null, { kind: 'blast', x: car.x, y: car.y, power: 1, falloff: 1 });
        if (isAircraft(car)) car.abandonedFlight = true;
      } else {
        player.hp = 0;
        die();
      }
    }
    // The cue's state for the HUD: null when nothing shows.
    function worldEdgeCueState() {
      const w = worldEdge;
      if (!w.active && w.clear <= 0 && !w.approach) return null;
      if (!w.active && w.clear > 0) return { state: 'clear' };
      const cx = (worldEdgeLine.left + worldEdgeLine.right) / 2,
        cy = (worldEdgeLine.top + worldEdgeLine.bottom) / 2,
        dx = cx - player.x,
        dy = cy - player.y,
        // Screen degrees clockwise from straight up (north is up the screen, -y).
        turn = (Math.atan2(dx, -dy) * 180) / Math.PI,
        way = compassWord(dx, dy).toUpperCase();
      if (!w.active)
        return {
          state: 'approach',
          edge: w.approachEdge,
          seconds: +w.approachSeconds.toFixed(1),
          turn,
          way,
          metres: Math.round(worldMeters(w.approachDistance)),
          god: !!player.godMode,
        };
      return {
        state: w.left <= 3 ? 'danger' : w.left <= 6 ? 'warn' : 'count',
        count: Math.max(0, Math.ceil(w.left - 1e-6)),
        fraction: clamp(w.left / WORLD_EDGE_SECONDS, 0, 1),
        turn,
        way,
        metres: Math.round(worldMeters(worldEdgeDepth(player.x, player.y))),
        god: !!player.godMode,
      };
    }
    function worldEdgeLength(metres) {
      return metres >= 1000 ? (metres / 1000).toFixed(1) + ' KM' : Math.round(metres / 10) * 10 + ' M';
    }
    const worldEdgeCue = { shown: '', big: '', note: '', call: '', turn: -999, fraction: -1 };
    // From updateHud(): the card shows the approach warning, the countdown and briefly the all-clear, and only in play.
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
      const call = cue.state === 'clear' ? 'ALL CLEAR' : cue.state === 'approach' ? 'APPROACHING THE WORLD EDGE' : 'RETURN TO THE CITY',
        god = cue.god ? 'GOD MODE · ' : '';
      let big = '',
        note = '';
      if (cue.state === 'clear') {
        big = 'OK';
        note = 'BACK INSIDE THE CITY LIMITS';
      } else if (cue.state === 'approach') {
        big = worldEdgeLength(cue.metres);
        note = god + 'TURN BACK · ' + cue.edge + ' EDGE · HEAD ' + cue.way;
      } else {
        big = String(cue.count);
        note = god + worldEdgeLength(cue.metres) + ' PAST THE EDGE · HEAD ' + cue.way;
      }
      if (call !== worldEdgeCue.call) {
        worldEdgeCue.call = call;
        getElement('worldEdgeCall').textContent = call;
      }
      if (big !== worldEdgeCue.big) {
        worldEdgeCue.big = big;
        getElement('worldEdgeCount').textContent = big;
        // Restart the one-second pulse on each new number of the countdown.
        if (cue.state !== 'approach' && cue.state !== 'clear') {
          root.classList.remove('beat');
          void getComputedStyle(root).animationName; // a style pass restarts the animation (offsetWidth also laid out the page)
          root.classList.add('beat');
        }
      }
      if (note !== worldEdgeCue.note) {
        worldEdgeCue.note = note;
        getElement('worldEdgeNote').textContent = note;
      }
      if (cue.state === 'clear') return;
      if (Math.abs(cue.turn - worldEdgeCue.turn) >= 1) {
        worldEdgeCue.turn = cue.turn;
        root.style.setProperty('--we-turn', cue.turn.toFixed(0) + 'deg');
      }
      if (cue.state !== 'approach' && Math.abs(cue.fraction - worldEdgeCue.fraction) >= 0.004) {
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
    // Console worldEdge(): the line, the countdown and the land's distance from it.
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
        // The approach warning: the edge, game seconds and metres to it along the measured velocity `v` (m/s).
        approach: worldEdge.approach,
        approachEdge: worldEdge.approachEdge,
        approachSeconds: +worldEdge.approachSeconds.toFixed(1),
        approachMetres: Math.round(worldMeters(worldEdge.approachDistance)),
        v: [Math.round(worldMeters(worldEdge.vx)), Math.round(worldMeters(worldEdge.vy))],
        left: +worldEdge.left.toFixed(2),
        fired: worldEdge.fired,
        spared: worldEdge.spared,
        clear: +worldEdge.clear.toFixed(2),
        outside: worldEdgeDepth(player.x, player.y) > 0,
        depth: Math.round(worldEdgeDepth(player.x, player.y)),
        cue,
        shown: !!document.getElementById('worldEdgeCue')?.classList.contains('on'),
        count: document.getElementById('worldEdgeCount')?.textContent,
        note: document.getElementById('worldEdgeNote')?.textContent,
        // Where the card is on screen (CSS pixels) and whether it is visible.
        rect: worldEdgeCueRect(),
        history: worldEdge.history.slice(),
      };
    }
