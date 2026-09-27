    // Input-aware hints: which device the player is using (keyboard and mouse, touch, gamepad) and
    // what an action is called on it (keyName's touch and gamepad paths, pressKey, moveKeysName).
    /**
     * INPUT DEVICE
     * The last device the player touched decides how every hint names an
     * action: a keyboard key cap (E), the on-screen button on a touch screen
     * (ACTION, EXIT, GAS...) or the gamepad button (A, RT...). Only real input
     * counts (the gamepad's own synthetic key events are untrusted). Until the
     * player does anything, a touch device (touchEnabled) reads touch.
     * body[data-input] carries it for the CSS (key caps become button chips).
     * DeadEndCity.inputHints(device) forces one for tests and screenshots.
     */
    const HINT_DEVICES = ['keyboard', 'touch', 'gamepad'];
    const hintInput = { last: null, forced: null, shown: null };
    function noteInputDevice(device) {
      if (hintInput.last === device) return;
      hintInput.last = device;
      refreshHintDevice();
    }
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.isTrusted) noteInputDevice('keyboard');
      },
      true,
    );
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.isTrusted) noteInputDevice(e.pointerType === 'mouse' ? 'keyboard' : 'touch');
      },
      true,
    );
    function hintDevice() {
      if (hintInput.forced) return hintInput.forced;
      const last = hintInput.last;
      if (last === 'gamepad' || last === 'keyboard') return last;
      // A tap counts only while the touch controls are on screen to be tapped.
      return touchEnabled() ? 'touch' : 'keyboard';
    }
    function setHintDevice(device) {
      hintInput.forced = HINT_DEVICES.includes(device) ? device : null;
      refreshHintDevice();
    }
    /* Called on every device change and every HUD pass (a touch-mode switch in
       the settings changes it too): rebuilds what names keys when it changes. */
    function refreshHintDevice() {
      const device = hintDevice();
      if (device === hintInput.shown) return;
      hintInput.shown = device;
      if (document.body) document.body.dataset.input = device;
      // The key strip, the chips' key caps and the prompt are rebuilt next pass.
      hudSeen.keys = '';
    }
    /**
     * TOUCH NAMES
     * The label of the on-screen control that does the action now (mobile.js
     * touchButtonLabel keeps the buttons and these names in step), or null when
     * no touch control does it (the key's name is used then: a tablet keyboard).
     */
    function touchKeyName(id) {
      const c = player.car,
        chute = !!player.parachute,
        air = isAircraft(c),
        foot = !c && !chute;
      switch (id) {
        case 'forward':
          return foot ? 'STICK ↑' : touchButtonLabel('touchGo');
        case 'back':
          return foot ? 'STICK ↓' : touchButtonLabel('touchBrake');
        case 'left':
          return foot ? 'STICK ←' : 'STEER ←';
        case 'right':
          return foot ? 'STICK →' : 'STEER →';
        case 'walk':
          return 'WALK';
        case 'interact':
          return touchButtonLabel('touchAction');
        case 'fire':
          return foot ? 'AIM STICK' : 'FIRE';
        case 'handbrake':
          return foot ? 'AIM STICK' : 'HANDBRAKE';
        case 'ascend':
          return air ? touchButtonLabel('touchUp') : 'RISE';
        case 'descend':
          return air ? touchButtonLabel('touchDown') : 'DESCEND';
        case 'bail':
          return air || chute ? touchButtonLabel('touchJump') : null;
        case 'reload':
          return 'RELOAD';
        case 'cycleWeapon':
          return 'WEAPON';
        case 'poison':
          return 'POISON';
        case 'divert':
          return 'DIVERT';
        case 'skipRide':
          return 'SKIP RIDE';
        case 'map':
          return 'MAP';
        case 'radioPower':
          return 'RADIO';
        case 'radioNext':
          return 'STATION';
        case 'missionCard':
          return 'MISSION CARD';
      }
      return null;
    }
    /* The name keyName() gives on the device in use, or null for the key's own. */
    function deviceKeyName(id) {
      const device = hintDevice();
      if (device === 'touch') return touchKeyName(id);
      if (device === 'gamepad') return gamepadKeyName(id);
      return null;
    }
    /* 'PRESS E' / 'TAP ACTION' / 'PRESS A'; `style` true gives 'Press E' / 'Tap
       ACTION' (a sentence), 'lower' 'press E' / 'tap ACTION' (mid-sentence). */
    function pressKey(id, style = false) {
      const verb = hintDevice() === 'touch' ? 'TAP' : 'PRESS',
        word = style === 'lower' ? verb.toLowerCase() : style ? verb[0] + verb.slice(1).toLowerCase() : verb;
      return word + ' ' + keyName(id);
    }
    /* 'E · ' before a chip's word on a keyboard or gamepad; nothing on touch,
       where the chip is itself the button. */
    function keyPrefix(id) {
      return hintDevice() === 'touch' ? '' : keyName(id) + ' · ';
    }
    /* ' · ENTER' / ' · A' after a dialog button's word ('accept'; 'back': ESCAPE /
       B); nothing on touch, where the button is tapped. */
    function menuKeySuffix(kind) {
      const device = hintDevice();
      if (device === 'touch') return '';
      return ' · ' + (device === 'gamepad' ? (kind === 'back' ? 'B' : 'A') : kind === 'back' ? 'ESCAPE' : 'ENTER');
    }
    /* What the tests and the console see: the device and a sample of names. */
    function inputHintsReport() {
      const sample = ['interact', 'forward', 'back', 'fire', 'bail', 'map', 'radioPower', 'radioNext', 'reload'];
      return {
        device: hintDevice(),
        forced: hintInput.forced,
        last: hintInput.last,
        touch: touchEnabled(),
        gamepad: gamepadReport(),
        names: Object.fromEntries(sample.map((id) => [id, keyName(id)])),
        move: moveKeysName(),
        press: pressKey('interact'),
        radioChip: getElement('radioPower').textContent,
        prompt: promptReport().text,
      };
    }
