    // Gamepad (standard mapping): play through the same actions as the bound keys, menus by focus,
    // the city map by a cursor; the button names hints use (gamepadKeyName) and DeadEndCity.gamepadFeed.
    /**
     * GAMEPAD
     * Polled once a frame (frame(), beside the touch sync). In play each button
     * drives the actions PAD_PLAY gives it in the player's control context
     * (controls.js controlContext): pressing it sends the key bound to that
     * action through the keyboard's own handler, so every rule, mode and
     * rebinding the keyboard obeys applies unchanged. The left stick is the
     * movement keys (on foot a gentle push walks, as on the touch stick; in an
     * aircraft ↑ / ↓ climb and descend), the right stick aims like the touch
     * aim stick (touchAim) and RT fires.
     * Menus: the D-pad and the left stick move the focus (the menus' own arrow
     * keys where they have them, otherwise to the nearest button that way), A
     * presses the focused button, B backs out (Escape), LB / RB change tabs.
     * The city map: the left stick pans, LT / RT zoom, A sets the waypoint
     * under the centre cross, X clears it, Y finds the player.
     * Synthetic key events are untrusted, so the hints stay on the gamepad
     * (input-hints.js).
     */
    const PAD_BUTTON_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L3', 'R3', 'D-PAD ↑', 'D-PAD ↓', 'D-PAD ←', 'D-PAD →'];
    const PAD_DEAD = 0.28,
      PAD_TRIGGER = 0.35,
      PAD_AIM = 0.35,
      // A push this far is a run; less walks (on foot).
      PAD_RUN = 0.72,
      PAD_MENU_DELAY = 0.38,
      PAD_MENU_REPEAT = 0.13;
    /* Buttons in standard-mapping order, per control context: the actions each drives. */
    const PAD_PLAY = {
      // R3 switches the street and chase views (chase-camera.js); in the chase view on foot LT aims over the shoulder.
      foot: [['interact'], ['poison'], ['reload'], ['skipRide'], ['cycleWeapon'], ['arsenal'], ['walk'], ['fire'], ['map'], [], ['missionCard'], ['cameraView'], ['zoomIn'], ['zoomOut'], ['skipStop'], ['help']],
      drive: [['interact'], ['handbrake'], ['reload'], ['bail'], ['horn'], ['fire'], ['back'], ['forward'], ['map'], [], ['sprint'], ['cameraView'], ['zoomIn'], ['zoomOut'], ['radioPower'], ['radioNext']],
      air: [['interact'], ['rockets', 'flapsUp'], ['reload'], ['bail'], ['flapsDown'], ['fire'], ['back'], ['forward'], ['map'], [], ['gear'], ['divert'], ['zoomIn'], ['zoomOut'], ['radioPower'], ['radioNext']],
      chute: [[], [], [], ['bail'], [], [], ['back'], ['forward'], ['map'], [], [], ['cameraView'], ['zoomIn'], ['zoomOut'], [], []],
    };
    /* The left stick's four ways, per context (null: that way does nothing there). */
    const PAD_STICK = {
      foot: { up: 'forward', down: 'back', left: 'left', right: 'right' },
      // The stick pushed up, with the throttle trigger: a wheelie on a two-wheeler (wheelie.js).
      drive: { up: 'ascend', down: null, left: 'left', right: 'right' },
      air: { up: 'ascend', down: 'descend', left: 'left', right: 'right' },
      chute: { up: null, down: null, left: 'left', right: 'right' },
    };
    const PAD_STICK_NAMES = { up: 'L-STICK ↑', down: 'L-STICK ↓', left: 'L-STICK ←', right: 'L-STICK →' };
    const gamepad = {
      // A pad has been seen (Chrome exposes one only after a button press).
      seen: false,
      // DeadEndCity.gamepadFeed(): a virtual pad for tests, used instead of the real one.
      feed: null,
      id: '',
      buttons: [],
      // Key codes held down on the pad's behalf -> how many pad inputs hold each.
      holds: new Map(),
      // Pad input -> the codes it holds ('b7', 'stick-up', ...).
      held: new Map(),
      aiming: false,
      // LT held on foot in the chase view: aiming over the shoulder (chase-camera.js chaseAiming).
      aimHeld: false,
      // The right stick as read in play (ride-look.js turns a rider's head with it, and the chase
      // camera turns with it: chase-camera.js updateStickLook); 0 in menus.
      lookX: 0,
      lookY: 0,
      menuDir: null,
      menuNext: 0,
      lastPoll: 0,
      mode: null,
    };
    window.addEventListener('gamepadconnected', (e) => {
      gamepad.seen = true;
      gamepad.id = e.gamepad?.id || 'gamepad';
    });
    window.addEventListener('gamepaddisconnected', () => padReleaseAll());
    /* The first connected pad's buttons (pressed, value) and axes, or null. */
    function readGamepad() {
      if (gamepad.feed) return gamepad.feed;
      if (!gamepad.seen || typeof navigator.getGamepads !== 'function') return null;
      const pad = [...navigator.getGamepads()].find((p) => p && p.connected);
      if (!pad) return null;
      return {
        buttons: pad.buttons.map((b) => (typeof b === 'object' ? b.value || (b.pressed ? 1 : 0) : b ? 1 : 0)),
        axes: [...pad.axes],
      };
    }
    function padKeyEvent(type, code) {
      window.dispatchEvent(new KeyboardEvent(type, { code, key: '', bubbles: true, cancelable: true }));
    }
    function padHoldCodes(input, codes) {
      const before = gamepad.held.get(input) || [];
      if (before.join() === codes.join()) return;
      for (const code of codes)
        if (!before.includes(code)) {
          const n = gamepad.holds.get(code) || 0;
          gamepad.holds.set(code, n + 1);
          if (!n) padKeyEvent('keydown', code);
        }
      for (const code of before)
        if (!codes.includes(code)) {
          const n = (gamepad.holds.get(code) || 1) - 1;
          if (n > 0) gamepad.holds.set(code, n);
          else {
            gamepad.holds.delete(code);
            padKeyEvent('keyup', code);
          }
        }
      if (codes.length) gamepad.held.set(input, codes);
      else gamepad.held.delete(input);
    }
    function padReleaseAll() {
      for (const input of [...gamepad.held.keys()]) padHoldCodes(input, []);
      if (gamepad.aiming) touchAim = null;
      gamepad.aiming = false;
      gamepad.aimHeld = false;
      gamepad.lookX = gamepad.lookY = 0;
      gamepad.buttons = [];
    }
    /* The physical key bound to an action (its first), or null when unbound. */
    function padCode(id) {
      return controlBindings[id]?.find(Boolean) || null;
    }
    function padCodes(ids) {
      return [...new Set(ids.map(padCode).filter(Boolean))];
    }
    /* A button's state: pressed, or a trigger past its threshold. */
    function padDown(state, i) {
      return (state.buttons[i] || 0) > (i === 6 || i === 7 ? PAD_TRIGGER : 0.5);
    }
    function pollGamepad() {
      const state = readGamepad();
      if (!state) {
        if (gamepad.held.size || gamepad.aiming) padReleaseAll();
        return;
      }
      const now = performance.now() / 1000,
        dt = Math.min(0.1, Math.max(0, now - (gamepad.lastPoll || now)));
      gamepad.lastPoll = now;
      const down = PAD_BUTTON_NAMES.map((_, i) => padDown(state, i)),
        was = gamepad.buttons,
        pressed = (i) => down[i] && !was[i],
        [lx = 0, ly = 0, rx = 0, ry = 0] = state.axes,
        active = down.some(Boolean) || Math.hypot(lx, ly) > 0.5 || Math.hypot(rx, ry) > 0.5;
      if (active) noteInputDevice('gamepad');
      gamepad.buttons = down;
      // Menus own the pad while one is up (the sportsbook sits over play).
      const menu = gameMode !== 'play' || sportsbook.open;
      const mode = menu ? 'menu:' + gameMode : 'play:' + controlContext();
      if (mode !== gamepad.mode) {
        // Nothing held carries from one mode or context into another.
        for (const input of [...gamepad.held.keys()]) padHoldCodes(input, []);
        gamepad.mode = mode;
      }
      if (menu) padMenu(down, pressed, lx, ly, dt, now);
      else padPlay(down, pressed, lx, ly, rx, ry);
    }
    function padPlay(down, pressed, lx, ly, rx, ry) {
      const context = controlContext(),
        row = PAD_PLAY[context],
        // In the chase view on foot LT aims over the shoulder instead of walking (a gentle push still walks).
        chaseFoot = chaseCameraLive() && context === 'foot';
      gamepad.aimHeld = chaseFoot && !!down[6];
      for (let i = 0; i < row.length; i++) padHoldCodes('b' + i, down[i] && !(chaseFoot && i === 6) ? padCodes(row[i]) : []);
      // MENU pauses (Escape), on the press only.
      if (pressed(9)) padTap('Escape');
      const m = Math.hypot(lx, ly),
        ways = PAD_STICK[context];
      for (const [way, on] of [
        ['up', ly < -PAD_DEAD],
        ['down', ly > PAD_DEAD],
        ['left', lx < -PAD_DEAD],
        ['right', lx > PAD_DEAD],
      ])
        padHoldCodes('stick-' + way, on && ways[way] ? padCodes([ways[way]]) : []);
      // On foot a gentle push walks, as on the touch stick (the terrace in
      // mission 2 walks by default, so there the hard push holds it to run).
      const gentle = context === 'foot' && m > PAD_DEAD && (roofPartyPace() ? m >= PAD_RUN : m < PAD_RUN);
      padHoldCodes('stick-walk', gentle ? padCodes(['walk']) : []);
      if (m > PAD_DEAD) mouse.active = false;
      if (gamepad.lookX !== rx) gamepad.lookX = rx;
      if (gamepad.lookY !== ry) gamepad.lookY = ry;
      // In the chase view the right stick turns the camera and the reticle is the aim (chase-camera.js).
      if (chaseCameraLive()) {
        if (gamepad.aiming) {
          touchAim = null;
          gamepad.aiming = false;
        }
        if (Math.hypot(rx, ry) > PAD_AIM) mouse.active = false;
        return;
      }
      // The right stick aims as the touch aim stick does (RT fires).
      if (Math.hypot(rx, ry) > PAD_AIM) {
        touchAim = Math.atan2(ry, rx);
        gamepad.aiming = true;
        mouse.active = false;
      } else if (gamepad.aiming) {
        touchAim = null;
        gamepad.aiming = false;
      }
    }
    /* Menus: a direction from the D-pad or the stick, repeated while held. */
    function padMenu(down, pressed, lx, ly, dt, now) {
      gamepad.lookX = gamepad.lookY = 0;
      gamepad.aimHeld = false;
      if (gamepad.aiming) {
        touchAim = null;
        gamepad.aiming = false;
      }
      if (gameMode === 'map') {
        padMap(down, pressed, lx, ly, dt);
        return;
      }
      const dir = down[12] || ly < -0.6 ? 'up' : down[13] || ly > 0.6 ? 'down' : down[14] || lx < -0.6 ? 'left' : down[15] || lx > 0.6 ? 'right' : null;
      if (dir !== gamepad.menuDir) {
        gamepad.menuDir = dir;
        gamepad.menuNext = now + PAD_MENU_DELAY;
        if (dir) padMenuStep(dir);
      } else if (dir && now >= gamepad.menuNext) {
        gamepad.menuNext = now + PAD_MENU_REPEAT;
        padMenuStep(dir);
      }
      if (pressed(0)) padAccept();
      else if (pressed(1) || pressed(9)) padTap('Escape');
      // LB / RB: the settings tabs (Q / E there).
      else if (gameMode === 'settings' && (pressed(4) || pressed(5))) padTap(pressed(4) ? 'KeyQ' : 'KeyE');
    }
    function padTap(code) {
      padKeyEvent('keydown', code);
      padKeyEvent('keyup', code);
    }
    const PAD_ARROW_MODES = new Set(['menu', 'pause', 'settings', 'dealer']);
    function padMenuStep(dir) {
      const code = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir];
      // The title and pause menus, settings, the dealer card and the betting
      // menu have their own arrow keys; everything else moves the focus.
      if (PAD_ARROW_MODES.has(gameMode) || sportsbook.open) {
        padTap(code);
        return;
      }
      padFocusStep(dir);
    }
    /* Buttons, links and fields that can take the focus and are on top where they stand. */
    function padFocusables() {
      const out = [];
      for (const el of document.querySelectorAll('button, [role="button"], [role="slider"], a[href], input, select, [tabindex="0"]')) {
        if (el.disabled || el.closest('.hidden,[hidden]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
        const top = document.elementFromPoint(clamp(r.left + r.width / 2, 0, innerWidth - 1), clamp(r.top + r.height / 2, 0, innerHeight - 1));
        if (!top || !(el === top || el.contains(top) || top.contains(el))) continue;
        out.push({ el, x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
      return out;
    }
    /* Move the focus to the nearest control that way (the first one if none has it). */
    function padFocusStep(dir) {
      const items = padFocusables();
      if (!items.length) return;
      const current = items.find((it) => it.el === document.activeElement);
      if (!current) {
        items.sort((a, b) => a.y - b.y || a.x - b.x);
        items[0].el.focus();
        return;
      }
      const [ux, uy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      let best = null,
        bestScore = Infinity;
      for (const it of items) {
        if (it === current) continue;
        const dx = it.x - current.x,
          dy = it.y - current.y,
          along = dx * ux + dy * uy;
        if (along <= 2) continue;
        const across = Math.abs(dx * uy - dy * ux),
          score = along + across * 2.5;
        if (score < bestScore) {
          bestScore = score;
          best = it;
        }
      }
      best?.el.focus();
    }
    /* A: press the focused control, or Enter where nothing is focused. */
    function padAccept() {
      const el = document.activeElement;
      if (el && el !== document.body && el.matches('button, [role="button"], a[href], input[type="checkbox"], input[type="radio"]')) {
        el.click();
        return;
      }
      padTap('Enter');
    }
    /* The city map: pan with the stick, zoom with the triggers, A drops the waypoint. */
    function padMap(down, pressed, lx, ly, dt) {
      const m = Math.hypot(lx, ly);
      if (m > PAD_DEAD || down[6] || down[7] || down[12] || down[13] || down[14] || down[15]) {
        const s = Math.min(800 / WORLD_WIDTH, 660 / WORLD_HEIGHT) * 0.92 * mapZoom,
          // Screen pixels a second at full tilt, so the pan feels the same at every zoom.
          speed = 520 / s,
          px = (m > PAD_DEAD ? lx : 0) + (down[15] ? 1 : 0) - (down[14] ? 1 : 0),
          py = (m > PAD_DEAD ? ly : 0) + (down[13] ? 1 : 0) - (down[12] ? 1 : 0);
        if (mapZoom === 1 && (px || py)) mapZoom = 1.5;
        mapCenter = {
          x: clamp(mapCenter.x + px * speed * dt, WORLD_LEFT, WORLD_SIZE),
          y: clamp(mapCenter.y + py * speed * dt, WORLD_TOP, WORLD_SIZE),
        };
        if (down[6] || down[7]) mapZoom = clamp(mapZoom * Math.pow(down[7] ? 2.2 : 1 / 2.2, dt), 1, 9);
        drawMap(cityMapContext, 800, 660, true);
      }
      if (pressed(0)) {
        const w = mapCenter;
        if (!godMapClick(w.x, w.y) && !taxiMapPick(w.x, w.y)) setWaypoint(w.x, w.y);
        drawMap(cityMapContext, 800, 660, true);
      }
      if (pressed(2)) clearWaypoint();
      if (pressed(3)) centerMapOnPlayer();
      if (pressed(1) || pressed(8) || pressed(9)) toggleMap();
    }
    /**
     * BUTTON NAMES (keyName's gamepad path): the button that drives the action in
     * the player's context now, the stick for movement, or null (the key's name).
     */
    function gamepadKeyName(id) {
      const context = controlContext(),
        ways = PAD_STICK[context];
      for (const way of ['up', 'down', 'left', 'right']) if (ways[way] === id) return PAD_STICK_NAMES[way];
      // In the chase view on foot LT aims: a gentle push of the stick walks.
      if (id === 'walk' && context === 'foot' && chaseCameraLive()) return 'L-STICK (LIGHT)';
      const row = PAD_PLAY[context],
        i = row.findIndex((ids) => ids.includes(id));
      if (i >= 0) return PAD_BUTTON_NAMES[i];
      if (id === 'walk' || id === 'forward') return context === 'foot' ? (id === 'walk' ? 'LT' : 'L-STICK ↑') : null;
      if (id === 'fire' && context === 'foot') return 'RT';
      return null;
    }
    function gamepadReport() {
      return {
        connected: !!readGamepad(),
        virtual: !!gamepad.feed,
        mode: gamepad.mode,
        held: [...gamepad.holds.keys()],
        aiming: gamepad.aiming,
      };
    }
    /* DeadEndCity.gamepadFeed({ buttons: { A: 1, RT: 1 }, axes: [lx, ly, rx, ry] }): a
       virtual pad, polled at once and on every frame until gamepadFeed(null). */
    function gamepadFeed(state) {
      if (!state) {
        gamepad.feed = null;
        padReleaseAll();
        return gamepadReport();
      }
      const buttons = PAD_BUTTON_NAMES.map(() => 0);
      for (const [name, value] of Object.entries(state.buttons || {})) {
        const i = PAD_BUTTON_NAMES.indexOf(String(name).toUpperCase());
        if (i >= 0) buttons[i] = Number(value) || 0;
      }
      const axes = [0, 1, 2, 3].map((i) => clamp(Number(state.axes?.[i]) || 0, -1, 1));
      gamepad.feed = { buttons, axes };
      pollGamepad();
      return gamepadReport();
    }
