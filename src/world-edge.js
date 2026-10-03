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
     * Only the player is watched: AI aircraft and boats keep their own limits.
     */
    const WORLD_EDGE_SECONDS = 10,
      // Units (24 m) inside the box: the county's coast is 234 units short of the east edge and the south coast 314, so the line clears all land; the north sea plane ends 176 units past WORLD_TOP.
      WORLD_EDGE_INSET = 192,
      WORLD_EDGE_ALLCLEAR = 2.4,
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
      if (worldEdgeDepth(player.x, player.y) <= 0) {
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
      if (!w.active && w.clear <= 0) return null;
      if (!w.active) return { state: 'clear' };
      const cx = (worldEdgeLine.left + worldEdgeLine.right) / 2,
        cy = (worldEdgeLine.top + worldEdgeLine.bottom) / 2,
        dx = cx - player.x,
        dy = cy - player.y,
        // Screen degrees clockwise from straight up (north is up the screen, -y).
        turn = (Math.atan2(dx, -dy) * 180) / Math.PI;
      return {
        state: w.left <= 3 ? 'danger' : w.left <= 6 ? 'warn' : 'count',
        count: Math.max(0, Math.ceil(w.left - 1e-6)),
        fraction: clamp(w.left / WORLD_EDGE_SECONDS, 0, 1),
        turn,
        way: compassWord(dx, dy).toUpperCase(),
        metres: Math.round(worldMeters(worldEdgeDepth(player.x, player.y))),
        god: !!player.godMode,
      };
    }
    const worldEdgeCue = { shown: '', count: -1, note: '', call: '', turn: -999, fraction: -1 };
    // From updateHud(): the card shows while the countdown runs (and briefly the all-clear), and only in play.
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
      const call = cue.state === 'clear' ? 'ALL CLEAR' : 'RETURN TO THE CITY';
      if (call !== worldEdgeCue.call) {
        worldEdgeCue.call = call;
        getElement('worldEdgeCall').textContent = call;
      }
      if (cue.state === 'clear') {
        if (worldEdgeCue.count !== -2) {
          worldEdgeCue.count = -2;
          getElement('worldEdgeCount').textContent = 'OK';
          getElement('worldEdgeNote').textContent = 'BACK INSIDE THE CITY LIMITS';
        }
        return;
      }
      if (cue.count !== worldEdgeCue.count) {
        worldEdgeCue.count = cue.count;
        getElement('worldEdgeCount').textContent = cue.count;
        // Restart the one-second pulse on each new number.
        root.classList.remove('beat');
        void root.offsetWidth;
        root.classList.add('beat');
      }
      const note = (cue.god ? 'GOD MODE · ' : '') + (cue.metres >= 1000 ? (cue.metres / 1000).toFixed(1) + ' KM' : cue.metres + ' M') + ' PAST THE EDGE · HEAD ' + cue.way;
      if (note !== worldEdgeCue.note) {
        worldEdgeCue.note = note;
        getElement('worldEdgeNote').textContent = note;
      }
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
        left: +worldEdge.left.toFixed(2),
        fired: worldEdge.fired,
        spared: worldEdge.spared,
        clear: +worldEdge.clear.toFixed(2),
        outside: worldEdgeDepth(player.x, player.y) > 0,
        depth: Math.round(worldEdgeDepth(player.x, player.y)),
        cue,
        shown: !!document.getElementById('worldEdgeCue')?.classList.contains('on'),
        count: document.getElementById('worldEdgeCount')?.textContent,
        // Where the card is on screen (CSS pixels) and whether it is visible.
        rect: worldEdgeCueRect(),
        history: worldEdge.history.slice(),
      };
    }
