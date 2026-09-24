    // BEGIN SUBSYSTEM: src/controls.js — Key bindings
    /**
     * Key bindings
     * Source: src/controls.js
     * Scope: shared game closure.
     *
     * Every keyboard action the game understands is listed once in
     * CONTROL_ACTIONS with its default keys. The player can rebind any of them
     * from SETTINGS · CONTROLS (settings.js); the bindings are saved in
     * localStorage under 'dead-end-city-controls'.
     *
     * THE VIRTUAL KEY TABLE
     * `keys` (game.js) is not a table of physical keys. It is keyed by each
     * action's `code`, which is the action's first default key: keys.KeyW means
     * "the forward action is held", whatever key the player bound to it. The
     * keydown/keyup listeners translate physical keys through the bindings, so
     * the many `keys.KeyW || keys.ArrowUp`-style reads across the simulation keep
     * working unchanged, and tests that hold ['KeyW'] or ['KeyT'] through
     * DeadEndCity.simulate() hold the action, not a key. New code should prefer
     * actionHeld('ascend') over reading `keys` directly.
     *
     * CONTEXTS
     * One physical key may drive several actions when they can never be wanted
     * at the same time: Space is the handbrake in a car and fires on foot. Each
     * action lists the contexts it is used in (foot, drive, air, chute); two
     * actions conflict only when their contexts overlap. The settings screen
     * warns about a conflict and offers to swap the two keys. The exception is
     * an action that `overrides` another: climb and descend share the arrows
     * with forward and back, and win inside their own context (controlContext()),
     * so in an aircraft ↑ / ↓ climb and descend while W / S keep the throttle.
     *
     * Menu keys are fixed and not listed here: Escape (pause / back), Enter
     * (accept), and inside the city map the arrows, + / −, 0 and C.
     */
    const CONTROL_CONTEXTS = ['foot', 'drive', 'air', 'chute'];
    const EVERYWHERE = CONTROL_CONTEXTS;
    const CONTROL_GROUPS = [
      ['move', 'MOVEMENT'],
      ['combat', 'ON FOOT & COMBAT'],
      ['vehicle', 'VEHICLES'],
      ['air', 'AIRCRAFT & PARACHUTE'],
      ['weapons', 'WEAPONS'],
      ['interface', 'INTERFACE'],
    ];
    /* id, label, note (one line of help), group, default keys (the first is the
       action's virtual code unless `code` names it), contexts, and `overrides`:
       another action this one replaces on a shared key inside its own contexts
       (so ↑ is forward on foot and in a car, but climb in an aircraft). Order is
       the order on the settings screen. */
    const CONTROL_ACTIONS = [
      { id: 'forward', label: 'Forward', note: 'Walk, accelerate, pedal, fly forward, add throttle', group: 'move', keys: ['KeyW', 'ArrowUp'], ctx: EVERYWHERE },
      { id: 'back', label: 'Back / brake', note: 'Walk back, brake and reverse, cut throttle, flare the canopy', group: 'move', keys: ['KeyS', 'ArrowDown'], ctx: EVERYWHERE },
      { id: 'left', label: 'Left', note: 'Walk or steer left, bank or turn left', group: 'move', keys: ['KeyA', 'ArrowLeft'], ctx: EVERYWHERE },
      { id: 'right', label: 'Right', note: 'Walk or steer right, bank or turn right', group: 'move', keys: ['KeyD', 'ArrowRight'], ctx: EVERYWHERE },
      { id: 'sprint', label: 'Sprint', note: 'Run on foot, swim harder, stand on the bicycle pedals', group: 'move', keys: ['ShiftLeft', 'ShiftRight'], ctx: ['foot', 'drive'] },
      { id: 'interact', label: 'Interact', note: 'Enter or leave a vehicle, payphones, shops, stations, boarding; hold for objectives', group: 'combat', keys: ['KeyE'], ctx: EVERYWHERE },
      { id: 'fire', label: 'Fire', note: 'Fire the equipped weapon; the handgun from a vehicle', group: 'combat', keys: ['KeyF'], ctx: ['foot', 'drive', 'air'] },
      { id: 'handbrake', label: 'Handbrake / alt fire', note: 'Handbrake in a vehicle, fires on foot, opens the parachute', group: 'combat', keys: ['Space'], ctx: ['foot', 'drive', 'chute'] },
      { id: 'poison', label: 'Spike the drink', note: 'Mission 2: poison the reserved drink', group: 'combat', keys: ['KeyP'], ctx: ['foot'] },
      { id: 'horn', label: 'Horn', note: 'Sound the horn', group: 'vehicle', keys: ['KeyH'], ctx: ['drive'] },
      { id: 'radioPower', label: 'Radio on / off', note: 'Car radio power', group: 'vehicle', keys: ['KeyN'], ctx: ['drive', 'air'] },
      { id: 'radioNext', label: 'Next station', note: 'Tune the next radio station', group: 'vehicle', keys: ['KeyB'], ctx: ['drive', 'air'] },
      // The arrows climb and descend in an aircraft (they take over from forward /
      // back there, `overrides`); T / G stay as second keys and as the virtual codes.
      { id: 'ascend', label: 'Climb', note: 'Helicopter rise and take off · plane nose up', group: 'air', code: 'KeyT', keys: ['ArrowUp', 'KeyT'], ctx: ['air'], overrides: 'forward' },
      { id: 'descend', label: 'Descend', note: 'Helicopter descend and land · plane nose down', group: 'air', code: 'KeyG', keys: ['ArrowDown', 'KeyG'], ctx: ['air'], overrides: 'back' },
      { id: 'flapsDown', label: 'Flaps down', note: 'Plane: extend the flaps a notch (UP, 1, 2, FULL) for take-off and landing', group: 'air', keys: ['KeyX'], ctx: ['air'] },
      { id: 'flapsUp', label: 'Flaps up', note: 'Plane: retract the flaps a notch', group: 'air', keys: ['KeyZ'], ctx: ['air'] },
      { id: 'gear', label: 'Landing gear', note: 'Plane: raise or lower the landing gear (it cannot retract on the ground)', group: 'air', keys: ['KeyL'], ctx: ['air'] },
      { id: 'bail', label: 'Bail out / dive', note: 'Jump from an aircraft; dive off a boat or out of a sinking car', group: 'air', keys: ['KeyJ'], ctx: ['drive', 'air'] },
      { id: 'divert', label: 'Divert landing', note: 'Mission 11: change the landing site once the manifest is exposed', group: 'air', keys: ['KeyV'], ctx: ['air'] },
      { id: 'reload', label: 'Reload', note: 'Reload the equipped weapon', group: 'weapons', keys: ['KeyR'], ctx: ['foot', 'drive', 'air'] },
      { id: 'cycleWeapon', label: 'Next weapon', note: 'Cycle through equipped weapons', group: 'weapons', keys: ['KeyQ'], ctx: ['foot', 'drive', 'air'] },
      { id: 'fists', label: 'Fists (no weapon)', note: 'Put every weapon away and fight with your fists', group: 'weapons', keys: ['Backquote', 'Digit8'], ctx: ['foot', 'drive', 'air'] },
      { id: 'knife', label: 'Knife', note: 'Equip the knife (no ammunition)', group: 'weapons', keys: ['KeyK', 'Digit7'], ctx: ['foot', 'drive', 'air'] },
      { id: 'weapon1', label: 'Pistol', note: 'Equip the pistol (slot 1)', group: 'weapons', keys: ['Digit1'], ctx: ['foot', 'drive', 'air'] },
      { id: 'weapon2', label: 'Machine pistol', note: 'Equip the machine pistol (slot 2)', group: 'weapons', keys: ['Digit2'], ctx: ['foot', 'drive', 'air'] },
      { id: 'weapon3', label: 'Shotgun', note: 'Equip the shotgun (slot 3)', group: 'weapons', keys: ['Digit3'], ctx: ['foot', 'drive', 'air'] },
      { id: 'weapon4', label: 'Bazooka', note: 'Equip the bazooka (slot 4)', group: 'weapons', keys: ['Digit4'], ctx: ['foot', 'drive', 'air'] },
      { id: 'weapon5', label: 'Assault rifle', note: 'Equip the assault rifle (slot 5)', group: 'weapons', keys: ['Digit5'], ctx: ['foot', 'drive', 'air'] },
      { id: 'weapon6', label: 'Precision rifle', note: 'Equip the precision rifle (slot 6)', group: 'weapons', keys: ['Digit6'], ctx: ['foot', 'drive', 'air'] },
      { id: 'arsenal', label: 'Arsenal', note: 'Open the arsenal', group: 'weapons', keys: ['KeyI'], ctx: EVERYWHERE },
      { id: 'map', label: 'City map', note: 'Open or close the county map', group: 'interface', keys: ['Tab'], ctx: EVERYWHERE },
      { id: 'missionCard', label: 'Mission card', note: 'Show the mission card again', group: 'interface', keys: ['KeyO'], ctx: EVERYWHERE },
      { id: 'zoomIn', label: 'Zoom in', note: 'Bring the street camera closer', group: 'interface', keys: ['Equal', 'NumpadAdd'], ctx: EVERYWHERE },
      { id: 'zoomOut', label: 'Zoom out', note: 'Pull the street camera back', group: 'interface', keys: ['Minus', 'NumpadSubtract'], ctx: EVERYWHERE },
      { id: 'zoomReset', label: 'Reset zoom', note: 'Street camera back to normal', group: 'interface', keys: ['Digit0'], ctx: EVERYWHERE },
      { id: 'mute', label: 'Mute', note: 'All game sound on or off', group: 'interface', keys: ['KeyM'], ctx: EVERYWHERE },
      { id: 'help', label: 'Controls card', note: 'The quick controls reference', group: 'interface', keys: ['Slash'], ctx: EVERYWHERE },
    ];
    const CONTROL_ACTION = Object.fromEntries(CONTROL_ACTIONS.map((a) => [a.id, a]));
    // Keys that can never be bound: they close menus and accept dialogs.
    const RESERVED_KEYS = new Set(['Escape', 'Enter', 'NumpadEnter', 'MetaLeft', 'MetaRight', 'ContextMenu', 'OSLeft', 'OSRight']);
    // Every default key, bound or not: a default key the player unbound must stay silent
    // rather than fall through as its old action's virtual code.
    const DEFAULT_KEYS = new Set(CONTROL_ACTIONS.flatMap((a) => a.keys));
    const CONTROLS_STORAGE = 'dead-end-city-controls';
    let controlBindings = defaultBindings(),
      // Physical code -> ids of the actions bound to it.
      controlIndex = new Map();
    // Physical keys currently down, so releasing one of two keys bound to the same
    // action (W and the up arrow) does not let go of the action.
    const physicalKeysDown = new Set();
    function defaultBindings() {
      return Object.fromEntries(CONTROL_ACTIONS.map((a) => [a.id, [a.keys[0] || null, a.keys[1] || null]]));
    }
    function validKeyCode(code) {
      return typeof code === 'string' && /^[A-Za-z0-9]{2,24}$/.test(code) && !RESERVED_KEYS.has(code);
    }
    function loadControlBindings() {
      try {
        const saved = JSON.parse(localStorage.getItem(CONTROLS_STORAGE));
        if (saved && typeof saved === 'object')
          for (const a of CONTROL_ACTIONS) {
            const slots = saved[a.id];
            if (Array.isArray(slots))
              controlBindings[a.id] = [0, 1].map((i) => (validKeyCode(slots[i]) ? slots[i] : null));
          }
        // Saved before the arrows became climb / descend (30.x): a pair still on the
        // old T / G defaults moves to the new ones.
        for (const [id, old] of [
          ['ascend', 'KeyT'],
          ['descend', 'KeyG'],
        ])
          if (controlBindings[id][0] === old && !controlBindings[id][1]) controlBindings[id] = [...CONTROL_ACTION[id].keys];
      } catch {}
      indexControlBindings();
    }
    function saveControlBindings() {
      try {
        localStorage.setItem(CONTROLS_STORAGE, JSON.stringify(controlBindings));
      } catch {}
    }
    function indexControlBindings() {
      controlIndex = new Map();
      for (const a of CONTROL_ACTIONS)
        for (const code of controlBindings[a.id])
          if (code) controlIndex.set(code, [...(controlIndex.get(code) || []), a.id]);
    }
    /* Where the player is, in CONTROL_CONTEXTS terms. */
    function controlContext() {
      if (player.parachute) return 'chute';
      if (isAircraft(player.car)) return 'air';
      return player.car ? 'drive' : 'foot';
    }
    /* The actions a physical key drives now, in list order: an action that
       overrides another on this key, in the current context, drops the other. */
    function actionsForKey(code) {
      const ids = controlIndex.get(code) || [];
      if (ids.length < 2) return ids;
      const context = controlContext(),
        replaced = ids
          .map((id) => CONTROL_ACTION[id])
          .filter((a) => a.overrides && a.ctx.includes(context))
          .map((a) => a.overrides);
      return replaced.length ? ids.filter((id) => !replaced.includes(id)) : ids;
    }
    /* An action's entry in the virtual key table. */
    function actionCode(id) {
      return CONTROL_ACTION[id].code || CONTROL_ACTION[id].keys[0];
    }
    function actionHeld(id) {
      return !!keys[actionCode(id)];
    }
    /* Keydown: remember the physical key and return the actions it drives. The
       caller decides (by game mode) whether they become held in `keys`. */
    function pressControlKey(code) {
      physicalKeysDown.add(code);
      return actionsForKey(code);
    }
    function holdActions(ids) {
      for (const id of ids) keys[actionCode(id)] = true;
    }
    /* Keyup: an action stays held while any of its keys is still down. */
    function releaseControlKey(code) {
      physicalKeysDown.delete(code);
      // Every action on the key, whatever the context now: it may have changed
      // while the key was held.
      for (const id of controlIndex.get(code) || [])
        keys[actionCode(id)] = controlBindings[id].some((k) => k && physicalKeysDown.has(k));
      // An unbound key that is not anyone's default still clears its own entry
      // (older code and tests may have set it directly).
      if (!controlIndex.has(code) && !DEFAULT_KEYS.has(code)) keys[code] = false;
    }
    function releaseAllControlKeys() {
      physicalKeysDown.clear();
    }
    /**
     * KEY NAMES
     * keyLabel('ShiftLeft') -> 'L-SHIFT'; keyName('ascend') -> '↑' (the first bound
     * key, for prompts and help); keyNames('forward') -> 'W / ↑'.
     */
    const KEY_LABELS = {
      Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'CTRL', ControlRight: 'R-CTRL',
      AltLeft: 'ALT', AltRight: 'ALT GR', Tab: 'TAB', CapsLock: 'CAPS', Backspace: 'BKSP', Backquote: '`',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Equal: '=', Minus: '−', Slash: '/',
      Backslash: '\\', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
      NumpadAdd: 'NUM +', NumpadSubtract: 'NUM −', NumpadMultiply: 'NUM *', NumpadDivide: 'NUM /', NumpadDecimal: 'NUM .',
      Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PG UP', PageDown: 'PG DN', IntlBackslash: 'INTL \\',
    };
    function keyLabel(code) {
      if (!code) return '—';
      if (KEY_LABELS[code]) return KEY_LABELS[code];
      if (/^Key[A-Z]$/.test(code)) return code.slice(3);
      if (/^Digit\d$/.test(code)) return code.slice(5);
      if (/^Numpad\d$/.test(code)) return 'NUM ' + code.slice(6);
      return code.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toUpperCase();
    }
    function keyName(id) {
      const code = controlBindings[id]?.find(Boolean);
      return code ? keyLabel(code) : '(UNBOUND)';
    }
    function keyNames(id) {
      const codes = (controlBindings[id] || []).filter(Boolean);
      return codes.length ? codes.map(keyLabel).join(' / ') : '(UNBOUND)';
    }
    /* 'WASD' while the defaults hold, otherwise the four keys spelled out. */
    function moveKeysName() {
      const names = ['forward', 'left', 'back', 'right'].map(keyName);
      return names.every((n) => n.length === 1) ? names.join('') : names.join(' ');
    }
    /**
     * REBINDING
     * controlConflicts(id, code) lists the other actions using that key in an
     * overlapping context. bindControl() applies a binding; with `swap` each
     * conflicting action takes over the key this slot held before (or loses the
     * key when the slot was empty), which is how the settings screen resolves a
     * clash.
     */
    function controlConflicts(id, code) {
      const action = CONTROL_ACTION[id],
        ctx = action.ctx;
      return CONTROL_ACTIONS.filter(
        (a) =>
          a.id !== id &&
          controlBindings[a.id].includes(code) &&
          a.ctx.some((c) => ctx.includes(c)) &&
          // Sharing a key with the action one overrides is the point of overriding.
          a.overrides !== id &&
          action.overrides !== a.id,
      ).map((a) => a.id);
    }
    function bindControl(id, slot, code, swap = false) {
      if (!CONTROL_ACTION[id] || (slot !== 0 && slot !== 1)) return false;
      if (code !== null && !validKeyCode(code)) return false;
      const previous = controlBindings[id][slot];
      if (code) {
        // The same key twice on one action is pointless: move it to this slot.
        const other = controlBindings[id][1 - slot];
        if (other === code) controlBindings[id][1 - slot] = previous !== code ? previous : null;
        for (const conflict of controlConflicts(id, code)) {
          if (!swap) return false;
          const slots = controlBindings[conflict],
            at = slots.indexOf(code);
          slots[at] = previous && !slots.includes(previous) ? previous : null;
        }
      }
      controlBindings[id][slot] = code;
      indexControlBindings();
      saveControlBindings();
      keys = {};
      physicalKeysDown.clear();
      return true;
    }
    function resetControlBindings(id = null) {
      if (id) {
        const a = CONTROL_ACTION[id];
        // Resetting one action can clash with a key moved onto another action.
        for (let slot = 0; slot < 2; slot++) bindControl(id, slot, a.keys[slot] || null, true);
      } else controlBindings = defaultBindings();
      indexControlBindings();
      saveControlBindings();
      keys = {};
      physicalKeysDown.clear();
    }
    function controlsAreDefault() {
      const d = defaultBindings();
      return CONTROL_ACTIONS.every((a) => d[a.id][0] === controlBindings[a.id][0] && d[a.id][1] === controlBindings[a.id][1]);
    }
    loadControlBindings();
    // END SUBSYSTEM: src/controls.js
