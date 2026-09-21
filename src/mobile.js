    // BEGIN SUBSYSTEM: src/mobile.js — Touch controls
    /**
     * Touch controls
     * Source: src/mobile.js
     * Scope: shared game closure.
     * Independent movement/aim fingers, context actions, touch state and overlay cleanup.
     */
    /* Pointer-owned controls use the same game actions as the keyboard; no synthetic keyboard events. */
    let touchAim = null,
      touchMode = 'auto',
      touchKeys = new Set(),
      touchApplied = new Set(),
      touchPointerKeys = new Map(),
      touchSticks = new Map(),
      touchLastMode = gameMode,
      touchLastContext = null;
    try {
      touchMode = localStorage.getItem('dead-end-city-touch') || 'auto';
    } catch {}
    function touchEnabled() {
      return (
        touchMode === 'on' ||
        (touchMode !== 'off' &&
          ((typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
            (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)))
      );
    }
    function clearTouchInput() {
      for (const k of touchApplied) keys[k] = false;
      touchKeys.clear();
      touchApplied.clear();
      touchPointerKeys.clear();
      touchSticks.clear();
      touchAim = null;
      for (const id of ['moveNub', 'aimNub']) getElement(id).style.transform = 'translate(-50%,-50%)';
    }
    function rebuildTouchKeys() {
      touchKeys.clear();
      for (const values of touchPointerKeys.values()) for (const k of values) touchKeys.add(k);
    }
    function syncTouchInput() {
      const context = player.car || player.parachute || 'foot';
      if (context !== touchLastContext || gameMode !== touchLastMode) {
        clearTouchInput();
        touchLastContext = context;
        touchLastMode = gameMode;
      }
      if (gameMode !== 'play' || !touchEnabled()) {
        if (touchApplied.size) clearTouchInput();
        return;
      }
      for (const k of touchApplied) if (!touchKeys.has(k)) keys[k] = false;
      for (const k of touchKeys) keys[k] = true;
      touchApplied = new Set(touchKeys);
    }
    function holdTouch(e, list) {
      if (gameMode !== 'play') return;
      syncTouchInput();
      e.preventDefault();
      e.currentTarget?.setPointerCapture?.(e.pointerId);
      touchPointerKeys.set(e.pointerId, list);
      rebuildTouchKeys();
      syncTouchInput();
      initAudio();
    }
    function releaseTouch(e) {
      touchPointerKeys.delete(e.pointerId);
      const stick = touchSticks.get(e.pointerId);
      if (stick) {
        getElement(stick.aim ? 'aimNub' : 'moveNub').style.transform = 'translate(-50%,-50%)';
        if (stick.aim) touchAim = null;
        touchSticks.delete(e.pointerId);
      }
      rebuildTouchKeys();
      syncTouchInput();
    }
    function moveTouchStick(e) {
      const stick = touchSticks.get(e.pointerId);
      if (!stick) return;
      e.preventDefault();
      const r = getElement(stick.aim ? 'aimStick' : 'moveStick').getBoundingClientRect(),
        radius = Math.min(r.width, r.height) * 0.34,
        dx = e.clientX - r.left - r.width / 2,
        dy = e.clientY - r.top - r.height / 2,
        m = Math.hypot(dx, dy),
        scale = Math.min(1, radius / Math.max(1, m)),
        x = dx * scale,
        y = dy * scale;
      getElement(stick.aim ? 'aimNub' : 'moveNub').style.transform =
        'translate(calc(-50% + ' + x + 'px),calc(-50% + ' + y + 'px))';
      const list = [];
      if (m > radius * 0.23) {
        if (stick.aim) {
          touchAim = Math.atan2(dy, dx);
          list.push('KeyF');
        } else {
          if (x > radius * 0.24) list.push('KeyD');
          if (x < -radius * 0.24) list.push('KeyA');
          if (!player.car && !player.parachute) {
            if (y > radius * 0.24) list.push('KeyS');
            if (y < -radius * 0.24) list.push('KeyW');
          }
        }
      } else if (stick.aim) touchAim = null;
      touchPointerKeys.set(e.pointerId, list);
      rebuildTouchKeys();
      syncTouchInput();
    }
    for (const [id, aiming] of [
      ['moveStick', false],
      ['aimStick', true],
    ]) {
      const el = getElement(id);
      el.addEventListener('pointerdown', (e) => {
        if (gameMode !== 'play') return;
        holdTouch(e, []);
        touchSticks.set(e.pointerId, {
          aim: aiming,
        });
        moveTouchStick(e);
      });
      el.addEventListener('pointermove', moveTouchStick);
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        el.addEventListener(event, releaseTouch);
    }
    const touchButtons = [
      ['touchGo', () => ['KeyW']],
      ['touchBrake', () => ['KeyS']],
      ['touchUp', () => ['Space']],
      ['touchDown', () => ['ShiftLeft']],
      ['touchRun', () => ['ShiftLeft']],
      ['touchFire', () => ['KeyF']],
      ['touchAction', () => ['KeyE']],
    ];
    for (const [id, codes] of touchButtons) {
      const el = getElement(id);
      el.addEventListener('pointerdown', (e) => {
        holdTouch(e, codes());
        if (id === 'touchAction') interact();
        if (id === 'touchUp' && player.parachute) deployParachute();
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        el.addEventListener(event, releaseTouch);
    }
    for (const [id, fn] of [
      ['touchReload', startReload],
      ['touchWeapon', cycleWeapon],
      ['touchPoison', poisonDrink],
      ['touchJump', bailOut],
      ['touchDivert', () => chooseFlightLanding(!mission?.divert)],
      ['touchMap', toggleMap],
      ['touchRadio', toggleCarRadio],
      ['touchStation', () => tuneCarRadio(carRadioStation + 1)],
    ])
      getElement(id).onclick = (e) => {
        e.preventDefault();
        fn();
        syncTouchInput();
        updateTouchUI();
      };
    getElement('touchToggle').onclick = () => {
      touchMode = touchEnabled() ? 'off' : 'on';
      try {
        localStorage.setItem('dead-end-city-touch', touchMode);
      } catch {}
      clearTouchInput();
      updateTouchUI();
      resize();
    };
    for (const event of ['blur', 'resize']) window.addEventListener(event, clearTouchInput);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTouchInput();
    });
    function updateTouchUI() {
      const enabled = touchEnabled(),
        active = enabled && gameMode === 'play';
      getElement('touchControls').classList.toggle('hidden', !active);
      document.body?.classList.toggle('touch-mode', enabled);
      getElement('touchToggle').textContent = 'TOUCH CONTROLS: ' + (enabled ? 'ON' : 'OFF');
      if (!active) return;
      if (transitRide) {
        for (const id of [
          'moveStick',
          'aimStick',
          'touchFire',
          'touchGo',
          'touchBrake',
          'touchUp',
          'touchDown',
          'touchRun',
          'touchReload',
          'touchWeapon',
          'touchPoison',
          'touchJump',
          'touchDivert',
          'touchRadio',
          'touchStation',
        ])
          getElement(id).classList.add('hidden');
        getElement('touchAction').classList.remove('hidden');
        getElement('touchAction').textContent = 'NEXT STOP';
        return;
      }
      getElement('moveStick').classList.remove('hidden');
      const c = player.car,
        air = isAircraft(c),
        chute = !!player.parachute,
        foot = !c && !chute;
      document.body?.classList.toggle('touch-driving', !!c || chute);
      const show = (id, on) => getElement(id).classList.toggle('hidden', !on);
      show('aimStick', foot);
      show('touchFire', !!c);
      show('touchGo', !!c || chute);
      show('touchBrake', !!c || chute);
      show('touchUp', !!c || chute);
      show('touchDown', air);
      show('touchRun', foot);
      show('touchAction', !chute);
      show('touchReload', foot || !!c);
      show('touchWeapon', foot || c?.type === 'tank');
      show('touchPoison', foot && player.roof && !!rooftopJob());
      show('touchJump', air && aircraftClearance(c) >= 60);
      show(
        'touchDivert',
        mission?.index === 10 && mission.compromised && [1, 2, 3].includes(mission.stage),
      );
      show('touchRadio', !!c);
      show('touchStation', !!c);
      getElement('moveLabel').textContent = foot ? 'MOVE' : 'STEER';
      getElement('touchGo').textContent = chute
        ? 'GLIDE'
        : air
          ? 'POWER +'
          : c?.type === 'bicycle'
            ? 'PEDAL'
            : 'GAS';
      getElement('touchBrake').textContent = chute ? 'FLARE' : air ? 'POWER −' : 'BRAKE';
      getElement('touchUp').textContent = chute
        ? 'OPEN'
        : c?.type === 'plane'
          ? 'NOSE UP'
          : c?.type === 'helicopter'
            ? 'RISE'
            : 'HANDBRAKE';
      getElement('touchDown').textContent = c?.type === 'plane' ? 'NOSE DOWN' : 'DESCEND';
      getElement('touchAction').textContent = c ? 'EXIT' : 'ACTION';
    }
    // END SUBSYSTEM: src/mobile.js
