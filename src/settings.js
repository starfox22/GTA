    // BEGIN SUBSYSTEM: src/settings.js — Settings menu
    /**
     * Settings menu
     * Source: src/settings.js
     * Scope: shared game closure.
     *
     * One SETTINGS screen, reached from the title menu and the pause menu, with
     * four tabs:
     *
     *   GRAPHICS  quality tier (quality.js), FPS counter (game.js), character
     *             see-through: the cutaway round the player under a roof, owned
     *             by the renderer (city3D.setCharacterCutaway, which also reads
     *             localStorage 'dead-end-city-cutaway' at startup: 'off' = off)
     *   AUDIO     sound on/off, master / effects / radio music / voice volumes,
     *             radio voices (police and dispatch callouts)
     *   GAMEPLAY  NPC chatter (street speech bubbles), minimap, GPS route on the
     *             minimap, control hints
     *   CONTROLS  touch controls (mobile.js) and key remapping (controls.js)
     *
     * Everything applies the moment it changes and is saved in localStorage. The
     * settings that already had their own keys keep them (graphics, fps, touch,
     * cutaway, controls); the rest live in one JSON record under
     * 'dead-end-city-settings'.
     *
     * While the screen is open gameMode is 'settings' and the game's keydown
     * listener hands every key to settingsKeyDown(): arrows move between rows and
     * change values, Q / E (or Page Up / Down) switch tabs, Escape goes back.
     */
    const SETTINGS_STORAGE = 'dead-end-city-settings';
    const settings = {
      masterVolume: 80,
      soundVolume: 100,
      radioVolume: 80,
      voiceVolume: 100,
      npcChatter: true,
      cutaway: true,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE));
      if (saved && typeof saved === 'object') {
        for (const key of ['masterVolume', 'soundVolume', 'radioVolume', 'voiceVolume'])
          if (Number.isFinite(saved[key])) settings[key] = clamp(Math.round(saved[key]), 0, 100);
        if (typeof saved.npcChatter === 'boolean') settings.npcChatter = saved.npcChatter;
        if (typeof saved.soundOn === 'boolean') soundOn = saved.soundOn;
        if (typeof saved.voicesOn === 'boolean') voicesOn = saved.voicesOn;
      }
      settings.cutaway = localStorage.getItem('dead-end-city-cutaway') !== 'off';
    } catch {}
    function saveSettings() {
      try {
        localStorage.setItem(
          SETTINGS_STORAGE,
          JSON.stringify({
            masterVolume: settings.masterVolume,
            soundVolume: settings.soundVolume,
            radioVolume: settings.radioVolume,
            voiceVolume: settings.voiceVolume,
            npcChatter: settings.npcChatter,
            soundOn,
            voicesOn,
          }),
        );
        localStorage.setItem('dead-end-city-cutaway', settings.cutaway ? 'on' : 'off');
      } catch {}
    }
    /* 0..1 gain for a mix channel: 'sound' (effects and ambience), 'radio' (car
       music) or 'voice' (radio callouts), each scaled by the master volume. */
    function volumeScale(channel) {
      const own = channel === 'radio' ? settings.radioVolume : channel === 'voice' ? settings.voiceVolume : settings.soundVolume;
      return (settings.masterVolume / 100) * (own / 100);
    }
    function npcChatterOn() {
      return settings.npcChatter;
    }
    function setCharacterCutaway(on) {
      settings.cutaway = !!on;
      city3D?.setCharacterCutaway?.(settings.cutaway);
    }
    /**
     * SETTING ROWS
     * Each tab is a list of rows. kind 'choice' is a row of options (arrows step
     * through them), 'toggle' an ON/OFF switch, 'slider' a 0..100 volume, 'keys'
     * the remapping table. get() reads the current value, set() applies and saves.
     */
    const SETTINGS_TABS = [
      ['graphics', 'GRAPHICS'],
      ['audio', 'AUDIO'],
      ['gameplay', 'GAMEPLAY'],
      ['controls', 'CONTROLS'],
    ];
    const SETTING_ROWS = {
      graphics: [
        {
          id: 'quality',
          kind: 'choice',
          label: 'Graphics quality',
          note: () =>
            'Shadows, ambient occlusion, bloom, anti-aliasing and detail distance. AUTO picks a tier for this GPU' +
            (graphicsSetting === 'auto' ? ' (now ' + graphicsTier().name + ')' : '') +
            '.',
          options: GRAPHICS_ORDER.map((id) => [id, id === 'auto' ? 'AUTO' : GRAPHICS_TIERS[id].name]),
          get: () => graphicsSetting,
          set: (value) => cycleGraphicsSetting(value),
        },
        {
          id: 'fps',
          kind: 'toggle',
          label: 'FPS counter',
          note: () => 'Frame rate and frame time in the top corner.',
          get: () => fpsMeter.shown,
          set: (on) => {
            if (on !== fpsMeter.shown) toggleFpsCounter();
          },
        },
        {
          id: 'cutaway',
          kind: 'toggle',
          label: 'Character see-through',
          note: () => 'Cut a window through roofs, trees and decks above you so you can always see your character.',
          get: () => settings.cutaway,
          set: (on) => setCharacterCutaway(on),
        },
      ],
      audio: [
        {
          id: 'sound',
          kind: 'toggle',
          label: 'Sound',
          note: () => 'All game sound. ' + keyName('mute') + ' toggles it during play.',
          get: () => soundOn,
          set: (on) => {
            if (on !== soundOn) mute();
          },
        },
        { id: 'masterVolume', kind: 'slider', label: 'Master volume', note: () => 'Everything the game plays.' },
        { id: 'soundVolume', kind: 'slider', label: 'Effects & ambience', note: () => 'Engines, gunfire, the street, weather and the sea.' },
        { id: 'radioVolume', kind: 'slider', label: 'Radio music', note: () => 'The car radio stations and the rooftop bar.' },
        { id: 'voiceVolume', kind: 'slider', label: 'Voices', note: () => 'Police and dispatch radio callouts.' },
        {
          id: 'voices',
          kind: 'toggle',
          label: 'Radio voices',
          note: () => 'Spoken police challenges and mission radio callouts, with their captions.',
          get: () => voicesOn,
          set: (on) => {
            if (on !== voicesOn) toggleVoices();
          },
        },
      ],
      gameplay: [
        {
          id: 'chatter',
          kind: 'toggle',
          label: 'NPC chatter',
          note: () =>
            'Speech bubbles from people and drivers in the street, two at a time. Mission and contact dialogue always shows.',
          get: () => settings.npcChatter,
          set: (on) => (settings.npcChatter = on),
        },
        {
          id: 'minimap',
          kind: 'toggle',
          label: 'Minimap',
          note: () => 'Show the minimap, or fold it to a small chip (the button on the minimap does the same). Mouse wheel or pinch zooms it.',
          get: () => !hudState.minimapFolded,
          set: (on) => setMinimapFolded(!on),
        },
        {
          id: 'gps',
          kind: 'toggle',
          label: 'GPS route on minimap',
          note: () =>
            'Draw the road route to the mission objective (gold) and your map waypoint (cyan) on the minimap, with arrows showing the way. Off, the minimap shows a straight line to the objective.',
          get: () => hudState.gps,
          set: (on) => setGps(on),
        },        {
          id: 'keyHints',
          kind: 'toggle',
          label: 'Control hints',
          note: () => 'The strip of keys under the mission card, which follows what you are doing: on foot, driving, flying.',
          get: () => hudState.keyHints,
          set: (on) => setKeyHints(on),
        },
      ],
      controls: [
        {
          id: 'touch',
          kind: 'choice',
          label: 'Touch controls',
          note: () =>
            'On-screen sticks and buttons. AUTO shows them on phones and tablets' +
            (touchMode === 'auto' ? ' (now ' + (touchEnabled() ? 'on' : 'off') + ')' : '') +
            '.',
          options: [
            ['auto', 'AUTO'],
            ['on', 'ON'],
            ['off', 'OFF'],
          ],
          get: () => touchMode,
          set: (value) => setTouchMode(value),
        },
        { id: 'bindings', kind: 'keys' },
      ],
    };
    for (const row of SETTING_ROWS.audio)
      if (row.kind === 'slider') {
        row.get = () => settings[row.id];
        row.set = (value) => {
          settings[row.id] = clamp(Math.round(value), 0, 100);
          applyVolumes();
        };
      }
    /* Push the volumes into the live mix: effects bus, voice bus and radio. */
    function applyVolumes() {
      if (audio && master) master.gain.setTargetAtTime(effectsLevel(), audio.currentTime, 0.05);
      if (audio && voiceBus) voiceBus.gain.setTargetAtTime(voiceLevel(), audio.currentTime, 0.05);
      syncCarRadio();
    }
    let settingsOrigin = 'menu',
      settingsTab = 'graphics',
      // The binding being listened for: { id, slot } or null; and a clash waiting
      // for the player's answer: { id, slot, code, conflicts }.
      settingsListen = null,
      settingsClash = null;
    function openSettings(tab) {
      if (!['menu', 'pause'].includes(gameMode)) return;
      settingsOrigin = gameMode;
      gameMode = 'settings';
      if (tab) settingsTab = tab;
      keys = {};
      mouse.down = false;
      settingsListen = settingsClash = null;
      getElement('pauseMenu').classList.add('hidden');
      getElement('menu').classList.add('settings-behind');
      getElement('settingsOverlay').classList.remove('hidden');
      renderSettings(null, true);
      focusSettingsTab();
    }
    function closeSettings() {
      if (gameMode !== 'settings') return;
      saveSettings();
      settingsListen = settingsClash = null;
      getElement('settingsOverlay').classList.add('hidden');
      getElement('menu').classList.remove('settings-behind');
      gameMode = settingsOrigin;
      keys = {};
      if (gameMode === 'pause') {
        getElement('pauseMenu').classList.remove('hidden');
        getElement('pauseSettings').focus();
      } else getElement('menuSettings')?.focus();
      updateUI();
    }
    function focusSettingsTab() {
      getElement('settingsTabs').querySelector('[aria-selected="true"]')?.focus();
    }
    function settingsElement(tag, className, text) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    /* Rebuild the open tab. Cheap: a few dozen elements, only on change. The
       rows slide in only when a tab opens (`enter`), not on every change. */
    function renderSettings(focusId, enter = false) {
      const tabs = getElement('settingsTabs');
      for (const button of tabs.children) {
        const on = button.dataset.tab === settingsTab;
        button.setAttribute('aria-selected', String(on));
        button.tabIndex = on ? 0 : -1;
      }
      const body = getElement('settingsBody');
      body.replaceChildren();
      body.dataset.tab = settingsTab;
      body.classList.toggle('enter', enter);
      if (enter) body.scrollTop = 0;
      for (const row of SETTING_ROWS[settingsTab]) {
        if (row.kind === 'keys') {
          renderKeyBindings(body);
          continue;
        }
        const el = settingsElement('div', 'settings-row row-' + row.kind);
        el.dataset.row = row.id;
        const text = settingsElement('div', 'settings-label');
        text.append(settingsElement('b', '', row.label), settingsElement('small', '', row.note()));
        el.append(text, settingControl(row));
        body.append(el);
      }
      getElement('settingsHint').textContent =
        settingsTab === 'controls'
          ? 'Select a key, then press the new key. Delete clears it. Escape cancels.'
          : 'Changes apply at once and are saved on this browser.';
      if (focusId) body.querySelector('[data-focus="' + focusId + '"]')?.focus();
    }
    function settingControl(row) {
      const value = row.get();
      if (row.kind === 'toggle') {
        const button = settingsElement('button', 'settings-switch');
        button.type = 'button';
        button.dataset.focus = row.id;
        button.dataset.nav = '';
        button.setAttribute('role', 'switch');
        button.setAttribute('aria-checked', String(!!value));
        button.setAttribute('aria-label', row.label);
        button.innerHTML = '<i></i><span>' + (value ? 'ON' : 'OFF') + '</span>';
        button.onclick = () => changeSetting(row, !row.get());
        return button;
      }
      if (row.kind === 'slider') {
        const wrap = settingsElement('label', 'settings-slider'),
          input = document.createElement('input'),
          readout = settingsElement('output', '', String(value));
        input.type = 'range';
        input.min = '0';
        input.max = '100';
        input.step = '5';
        input.value = String(value);
        input.dataset.focus = row.id;
        input.dataset.nav = '';
        input.setAttribute('aria-label', row.label);
        input.style.setProperty('--fill', value + '%');
        input.oninput = () => {
          row.set(Number(input.value));
          readout.textContent = input.value;
          input.style.setProperty('--fill', input.value + '%');
        };
        input.onchange = saveSettings;
        wrap.append(input, readout);
        return wrap;
      }
      // choice: a segmented row; arrows step through the options.
      const group = settingsElement('div', 'settings-choice');
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', row.label);
      for (const [id, label] of row.options) {
        const option = settingsElement('button', '', label);
        option.type = 'button';
        option.setAttribute('role', 'radio');
        option.setAttribute('aria-checked', String(id === value));
        option.tabIndex = id === value ? 0 : -1;
        if (id === value) {
          option.dataset.focus = row.id;
          option.dataset.nav = '';
        }
        option.onclick = () => changeSetting(row, id);
        group.append(option);
      }
      return group;
    }
    function changeSetting(row, value) {
      row.set(value);
      saveSettings();
      renderSettings(row.id);
    }
    /* Left/right on the focused row: step a choice, flip a switch. Sliders are
       native range inputs and step themselves. */
    function stepSetting(rowId, direction) {
      const row = SETTING_ROWS[settingsTab].find((r) => r.id === rowId);
      if (!row) return false;
      if (row.kind === 'toggle') changeSetting(row, direction > 0);
      else if (row.kind === 'choice') {
        const ids = row.options.map((o) => o[0]),
          at = ids.indexOf(row.get());
        changeSetting(row, ids[clamp(at + direction, 0, ids.length - 1)]);
      } else return false;
      return true;
    }
    /**
     * KEY BINDINGS TABLE
     * One row per action, grouped as in controls.js: the action, a line of help,
     * and two key slots. A slot listens for the next key when chosen.
     */
    function renderKeyBindings(body) {
      const head = settingsElement('div', 'bindings-head');
      const reset = settingsElement('button', 'settings-reset', 'RESET ALL TO DEFAULTS');
      reset.type = 'button';
      reset.dataset.nav = '';
      reset.dataset.focus = 'resetAll';
      reset.disabled = controlsAreDefault();
      reset.onclick = () => {
        resetControlBindings();
        settingsClash = null;
        renderSettings('resetAll');
        tell('Controls reset to defaults', 2);
      };
      head.append(
        settingsElement('span', 'bindings-title', 'KEYBOARD'),
        settingsElement('span', 'bindings-cols', 'PRIMARY · SECONDARY'),
        reset,
      );
      body.append(head);
      if (settingsClash) body.append(clashBanner());
      for (const [group, title] of CONTROL_GROUPS) {
        body.append(settingsElement('h3', 'bindings-group', title));
        for (const action of CONTROL_ACTIONS.filter((a) => a.group === group)) {
          const row = settingsElement('div', 'settings-row binding-row');
          row.dataset.row = action.id;
          const text = settingsElement('div', 'settings-label');
          text.append(settingsElement('b', '', action.label), settingsElement('small', '', action.note));
          const slots = settingsElement('div', 'binding-slots');
          for (const slot of [0, 1]) slots.append(bindingSlot(action, slot));
          row.append(text, slots);
          row.classList.toggle(
            'custom',
            controlBindings[action.id].some((code, i) => code !== (action.keys[i] || null)),
          );
          body.append(row);
        }
      }
      body.append(settingsElement('h3', 'bindings-group', 'FIXED'));
      for (const [key, label] of [
        ['ESC', 'Pause · back · close'],
        ['ENTER', 'Accept a call or dialog · start'],
        ['ARROWS + − 0 C', 'City map: pan, zoom, reset, find me'],
        ['MOUSE', 'Aim; left button fires; wheel zooms the street (over the minimap: the minimap)'],
      ]) {
        const row = settingsElement('div', 'settings-row binding-row fixed');
        const text = settingsElement('div', 'settings-label');
        text.append(settingsElement('b', '', label));
        row.append(text, settingsElement('kbd', 'binding-fixed', key));
        body.append(row);
      }
    }
    function bindingSlot(action, slot) {
      const code = controlBindings[action.id][slot],
        listening = settingsListen?.id === action.id && settingsListen.slot === slot,
        button = settingsElement('button', 'binding-key' + (code ? '' : ' empty') + (listening ? ' listening' : ''));
      button.type = 'button';
      button.dataset.nav = '';
      button.dataset.focus = action.id + ':' + slot;
      button.textContent = listening ? 'PRESS A KEY…' : code ? keyLabel(code) : slot ? 'ADD' : 'UNBOUND';
      button.setAttribute(
        'aria-label',
        action.label + ', ' + (slot ? 'secondary' : 'primary') + ' key: ' + (code ? keyLabel(code) : 'none') + '. Press Enter to change.',
      );
      button.onclick = () => {
        settingsListen = { id: action.id, slot };
        settingsClash = null;
        renderSettings(action.id + ':' + slot);
      };
      return button;
    }
    function clashBanner() {
      const { id, code, conflicts } = settingsClash,
        banner = settingsElement('div', 'bindings-clash');
      banner.setAttribute('role', 'alert');
      banner.append(
        settingsElement(
          'p',
          '',
          keyLabel(code) +
            ' is already ' +
            conflicts.map((c) => CONTROL_ACTION[c].label.toUpperCase()).join(', ') +
            '. Swap the keys so ' +
            CONTROL_ACTION[id].label.toUpperCase() +
            ' takes it?',
        ),
      );
      const swap = settingsElement('button', 'settings-reset', 'SWAP · ENTER'),
        cancel = settingsElement('button', 'settings-reset ghost', 'CANCEL · ESC');
      swap.type = cancel.type = 'button';
      swap.dataset.focus = 'clashSwap';
      swap.onclick = resolveClash;
      cancel.onclick = () => {
        const focus = settingsClash.id + ':' + settingsClash.slot;
        settingsClash = null;
        renderSettings(focus);
      };
      banner.append(swap, cancel);
      return banner;
    }
    function resolveClash() {
      if (!settingsClash) return;
      const { id, slot, code } = settingsClash;
      bindControl(id, slot, code, true);
      settingsClash = null;
      renderSettings(id + ':' + slot);
    }
    /* The next key pressed while a slot listens becomes its binding. */
    function captureBinding(e) {
      const { id, slot } = settingsListen;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        settingsListen = null;
        renderSettings(id + ':' + slot);
        return;
      }
      if (e.code === 'Backspace' || e.code === 'Delete') {
        settingsListen = null;
        bindControl(id, slot, null);
        renderSettings(id + ':' + slot);
        return;
      }
      if (!validKeyCode(e.code)) {
        getElement('settingsHint').textContent = keyLabel(e.code) + ' is reserved for menus. Choose another key.';
        return;
      }
      settingsListen = null;
      const conflicts = controlConflicts(id, e.code);
      if (conflicts.length) {
        settingsClash = { id, slot, code: e.code, conflicts };
        renderSettings('clashSwap');
        return;
      }
      bindControl(id, slot, e.code);
      renderSettings(id + ':' + slot);
    }
    /* Keyboard for the whole settings screen (called by game.js's keydown). */
    function settingsKeyDown(e) {
      if (settingsListen) {
        if (!e.repeat) captureBinding(e);
        else e.preventDefault();
        return;
      }
      const code = e.code;
      if (settingsClash) {
        if (code === 'Escape') {
          e.preventDefault();
          const focus = settingsClash.id + ':' + settingsClash.slot;
          settingsClash = null;
          renderSettings(focus);
          return;
        }
        if (code === 'Enter' && document.activeElement?.dataset.focus === 'clashSwap') {
          e.preventDefault();
          resolveClash();
          return;
        }
      }
      if (code === 'Escape') {
        e.preventDefault();
        closeSettings();
        return;
      }
      if (['KeyQ', 'KeyE', 'PageUp', 'PageDown'].includes(code) || (code === 'Tab' && e.ctrlKey)) {
        e.preventDefault();
        const ids = SETTINGS_TABS.map((t) => t[0]),
          step = code === 'KeyQ' || code === 'PageUp' || (code === 'Tab' && e.shiftKey) ? -1 : 1;
        settingsTab = ids[(ids.indexOf(settingsTab) + step + ids.length) % ids.length];
        settingsClash = null;
        renderSettings(null, true);
        focusSettingsTab();
        return;
      }
      const active = document.activeElement,
        inTabs = active?.parentElement?.id === 'settingsTabs';
      if (code === 'ArrowLeft' || code === 'ArrowRight') {
        const direction = code === 'ArrowRight' ? 1 : -1;
        if (inTabs) {
          e.preventDefault();
          const ids = SETTINGS_TABS.map((t) => t[0]);
          settingsTab = ids[clamp(ids.indexOf(settingsTab) + direction, 0, ids.length - 1)];
          renderSettings(null, true);
          focusSettingsTab();
          return;
        }
        if (active?.type === 'range') return;
        const row = active?.closest?.('.settings-row')?.dataset.row;
        if (row && stepSetting(row, direction)) e.preventDefault();
        else if (active?.classList.contains('binding-key')) {
          // Between the two key slots of a binding row.
          e.preventDefault();
          (direction > 0 ? active.nextElementSibling : active.previousElementSibling)?.focus();
        }
        return;
      }
      if (code === 'ArrowUp' || code === 'ArrowDown') {
        e.preventDefault();
        const items = [
            getElement('settingsTabs').querySelector('[aria-selected="true"]'),
            ...getElement('settingsBody').querySelectorAll('[data-nav]'),
          ].filter((el) => el && !el.disabled),
          // Key slots: move to the same column in the next row.
          column = active?.classList.contains('binding-key') ? [...active.parentElement.children].indexOf(active) : 0,
          rows = [],
          seen = new Set();
        for (const el of items) {
          const row = el.closest('.settings-row') || el;
          if (seen.has(row)) continue;
          seen.add(row);
          rows.push(row);
        }
        const current = active?.closest?.('.settings-row') || active,
          at = rows.indexOf(current),
          next = rows[clamp((at < 0 ? -1 : at) + (code === 'ArrowDown' ? 1 : -1), 0, rows.length - 1)];
        const target = next?.classList?.contains('binding-row')
          ? next.querySelectorAll('.binding-key')[column] || next.querySelector('.binding-key')
          : next?.matches?.('[data-nav]')
            ? next
            : next?.querySelector('[data-nav]');
        target?.focus();
        target?.scrollIntoView?.({ block: 'nearest' });
      }
    }
    for (const button of getElement('settingsTabs').children)
      button.onclick = () => {
        settingsTab = button.dataset.tab;
        settingsListen = settingsClash = null;
        renderSettings(null, true);
        focusSettingsTab();
      };
    // The saved Sound switch was read above, after game.js labelled the button.
    applySoundLabels();
    getElement('closeSettings').onclick = closeSettings;
    getElement('pauseSettings').onclick = () => openSettings();
    getElement('menuSettings').onclick = () => openSettings();
    // A click on the dimmed backdrop outside the panel goes back as well.
    getElement('settingsOverlay').addEventListener('pointerdown', (e) => {
      if (e.target === getElement('settingsOverlay')) closeSettings();
    });
    // END SUBSYSTEM: src/settings.js
