    // BEGIN SUBSYSTEM: src/hud.js — HUD behaviour and the title menu
    /**
     * HUD behaviour and the title menu
     * Source: src/hud.js
     * Scope: shared game closure.
     *
     * updateUI() (game.js) writes the numbers; this file decides what the HUD
     * shows and how it moves:
     *
     *   POP BOXES   The car radio and the weapon box rest as compact chips (the
     *               station name; the weapon icon and ammo). hudPop(el) opens one
     *               for a few seconds: a new station, a weapon change, firing,
     *               reloading. Hovering (or focusing) a chip opens it too, so the
     *               presets and the arsenal stay one click away. The motion is CSS
     *               (.hud-pop.open, .hud-more), cut under prefers-reduced-motion.
     *   MINIMAP     Stays up; its fold button tucks it into a small chip. The
     *               mouse wheel and a two-finger pinch zoom it (MINIMAP_ZOOM_MIN..MAX,
     *               never the street camera). Both are saved in localStorage
     *               under 'dead-end-city-hud'.
     *   KEY HINTS   The strip under the mission card, the interaction prompt and
     *               the HOW TO PLAY grid name the player's own bindings
     *               (controls.js), and the strip follows what they are doing:
     *               on foot, driving, flying.
     *   TITLE MENU  CONTINUE / NEW GAME / CHOOSE MISSION / SETTINGS / HOW TO
     *               PLAY / CREDITS, arrow-key navigation, a caption for the
     *               focused item and a second press to confirm NEW GAME over a
     *               saved story.
     */
    const HUD_STORAGE = 'dead-end-city-hud',
      // The overlays (labels, markers) are drawn in world units and grow with
      // the zoom, so the range stays modest.
      MINIMAP_ZOOM_MIN = 0.5,
      MINIMAP_ZOOM_MAX = 2.2,
      // How long a pop box stays open after something happens to it (ms).
      HUD_POP_MS = 3200;
    const hudState = {
      minimapFolded: false,
      minimapZoom: 1,
      // The key-hint strip under the mission card (Settings · Gameplay).
      keyHints: true,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(HUD_STORAGE));
      if (saved && typeof saved === 'object') {
        hudState.minimapFolded = saved.minimapFolded === true;
        hudState.keyHints = saved.keyHints !== false;
        if (Number.isFinite(saved.minimapZoom))
          hudState.minimapZoom = clamp(saved.minimapZoom, MINIMAP_ZOOM_MIN, MINIMAP_ZOOM_MAX);
      }
    } catch {}
    function saveHudState() {
      try {
        localStorage.setItem(HUD_STORAGE, JSON.stringify(hudState));
      } catch {}
    }
    /**
     * POP BOXES
     * `open` is a wall-clock deadline: game time is clamped per frame and stops
     * in menus, and a box that popped open should close on the player's clock.
     */
    const hudPops = new Map();
    function hudPop(id, ms = HUD_POP_MS) {
      const el = getElement(id);
      if (!el) return;
      hudPops.set(id, performance.now() + ms);
      el.classList.add('open');
    }
    function updateHudPops() {
      const now = performance.now();
      for (const [id, until] of hudPops)
        if (now >= until) {
          hudPops.delete(id);
          getElement(id).classList.remove('open');
        }
    }
    // Touch has no hover: a tap on a resting chip opens it instead.
    for (const id of ['carRadio']) {
      getElement(id).addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' && !getElement(id).classList.contains('open')) hudPop(id, 6000);
      });
    }
    /* What changed since the last HUD refresh, to decide what pops. */
    const hudSeen = { weapon: -1, ammo: -1, reserve: -1, reloading: false, radioShown: false, stars: -1, keys: '' };
    function watchWeaponBox() {
      const w = currentWeapon(),
        reloading = reloadSecondsRemaining > 0;
      if (
        hudSeen.weapon !== selectedWeaponIndex ||
        hudSeen.ammo !== w.ammo ||
        hudSeen.reserve !== w.reserve ||
        reloading !== hudSeen.reloading
      ) {
        // The first refresh after startup only records the state.
        if (hudSeen.weapon !== -1 && gameMode === 'play') hudPop('weaponButton', hudSeen.weapon !== selectedWeaponIndex ? 4200 : HUD_POP_MS);
        hudSeen.weapon = selectedWeaponIndex;
        hudSeen.ammo = w.ammo;
        hudSeen.reserve = w.reserve;
        hudSeen.reloading = reloading;
      }
      getElement('weaponButton').classList.toggle('reloading', reloading);
    }
    function watchRadioBox() {
      const shown = !getElement('carRadio').classList.contains('hidden');
      // Getting into a car shows what is playing, then tucks it away.
      if (shown && !hudSeen.radioShown) hudPop('carRadio', 4200);
      hudSeen.radioShown = shown;
    }
    /* Five stars; lit ones flash as they are earned (CSS .gained). */
    function renderStars(level) {
      if (level === hudSeen.stars) return;
      const el = getElement('stars'),
        gained = level > hudSeen.stars && hudSeen.stars >= 0;
      el.replaceChildren();
      for (let i = 0; i < 5; i++) {
        const star = document.createElement('i');
        star.textContent = '★';
        if (i < level) star.className = 'on' + (gained && i >= hudSeen.stars ? ' gained' : '');
        el.append(star);
      }
      el.classList.toggle('wanted', level > 0);
      el.setAttribute('aria-label', 'Wanted level ' + level + ' of 5');
      hudSeen.stars = level;
    }
    /**
     * MINIMAP FOLD AND ZOOM
     */
    function setMinimapFolded(folded) {
      hudState.minimapFolded = !!folded;
      const box = getElement('minimapBox'),
        button = getElement('minimapFold');
      box.classList.toggle('folded', hudState.minimapFolded);
      button.setAttribute('aria-expanded', String(!hudState.minimapFolded));
      button.setAttribute('aria-label', hudState.minimapFolded ? 'Show minimap' : 'Minimize minimap');
      button.title = hudState.minimapFolded ? 'Show minimap' : 'Minimize minimap';
      saveHudState();
    }
    function minimapZoom() {
      return hudState.minimapZoom;
    }
    let minimapZoomLabelTimer = null;
    function setMinimapZoom(value) {
      const next = clamp(value, MINIMAP_ZOOM_MIN, MINIMAP_ZOOM_MAX);
      if (Math.abs(next - hudState.minimapZoom) < 1e-3) return;
      hudState.minimapZoom = next;
      const label = getElement('minimapZoomLabel');
      label.textContent = '×' + next.toFixed(1);
      label.classList.add('show');
      clearTimeout(minimapZoomLabelTimer);
      minimapZoomLabelTimer = setTimeout(() => {
        label.classList.remove('show');
        saveHudState();
      }, 900);
      drawMap(minimapContext, getElement('minimap').width, getElement('minimap').height);
    }
    getElement('minimapFold').onclick = (e) => {
      e.stopPropagation();
      setMinimapFolded(!hudState.minimapFolded);
      canvas.focus();
    };
    const minimapFrame = getElement('minimapFrame');
    minimapFrame.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
        // One wheel notch (100) is about a 1.5x step.
        setMinimapZoom(hudState.minimapZoom * Math.exp(-clamp(delta, -160, 160) * 0.004));
      },
      { passive: false },
    );
    // Two-finger pinch on the minimap zooms the minimap only.
    const minimapPointers = new Map();
    let minimapPinch = null;
    minimapFrame.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      minimapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      minimapFrame.setPointerCapture?.(e.pointerId);
      if (minimapPointers.size === 2) {
        const [a, b] = [...minimapPointers.values()];
        minimapPinch = { distance: Math.max(1, distanceBetween(a, b)), zoom: hudState.minimapZoom };
      }
    });
    minimapFrame.addEventListener('pointermove', (e) => {
      if (!minimapPointers.has(e.pointerId)) return;
      e.preventDefault();
      minimapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (minimapPinch && minimapPointers.size === 2) {
        const [a, b] = [...minimapPointers.values()];
        setMinimapZoom((minimapPinch.zoom * distanceBetween(a, b)) / minimapPinch.distance);
      }
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      minimapFrame.addEventListener(event, (e) => {
        minimapPointers.delete(e.pointerId);
        if (minimapPointers.size < 2) minimapPinch = null;
      });
    setMinimapFolded(hudState.minimapFolded);
    function setKeyHints(on) {
      hudState.keyHints = !!on;
      document.body.classList.toggle('no-key-hints', !hudState.keyHints);
      saveHudState();
    }
    setKeyHints(hudState.keyHints);
    /**
     * KEY HINTS
     * The strip follows the context; it is rebuilt only when the context or the
     * bindings change.
     */
    function hudContext() {
      const c = player.car;
      if (player.parachute) return 'chute';
      if (!c) return player.swimming ? 'swim' : 'foot';
      if (c.type === 'helicopter') return 'heli';
      if (c.type === 'plane') return 'plane';
      if (isBoat(c)) return 'boat';
      return c.type === 'bicycle' ? 'bike' : 'car';
    }
    const QUICK_KEYS = {
      foot: [['move', 'MOVE'], ['sprint', 'RUN'], ['interact', 'INTERACT'], ['fire', 'FIRE'], ['help', 'CONTROLS']],
      swim: [['move', 'SWIM'], ['sprint', 'HARDER'], ['help', 'CONTROLS']],
      car: [['move', 'DRIVE'], ['handbrake', 'HANDBRAKE'], ['interact', 'EXIT'], ['radioNext', 'STATION'], ['help', 'CONTROLS']],
      bike: [['forward', 'PEDAL'], ['sprint', 'STAND'], ['back', 'BRAKE'], ['interact', 'EXIT']],
      boat: [['move', 'STEER'], ['handbrake', 'SLOW'], ['bail', 'DIVE'], ['interact', 'EXIT']],
      heli: [['ascend', 'RISE'], ['descend', 'DESCEND'], ['move', 'FLY'], ['bail', 'BAIL OUT']],
      plane: [['forward', 'THROTTLE'], ['ascend', 'NOSE UP'], ['descend', 'NOSE DOWN'], ['bail', 'BAIL OUT']],
      chute: [['handbrake', 'OPEN'], ['move', 'STEER']],
    };
    function hintKey(id) {
      return id === 'move' ? moveKeysName() : keyName(id);
    }
    function renderQuickKeys() {
      const context = hudContext(),
        signature = context + '|' + JSON.stringify(controlBindings);
      if (signature === hudSeen.keys) return;
      hudSeen.keys = signature;
      const strip = getElement('quickKeys');
      strip.replaceChildren();
      for (const [id, label] of QUICK_KEYS[context]) {
        const item = document.createElement('span'),
          key = document.createElement('kbd');
        key.textContent = hintKey(id) === '/' ? '?' : hintKey(id);
        item.append(key, ' ' + label);
        strip.append(item);
      }
      getElement('mapKeyHint').textContent = keyName('map');
      getElement('cycleKeyHint').textContent = keyName('cycleWeapon');
      getElement('pagerHint').textContent = keyName('missionCard');
      getElement('radioNext').textContent = keyName('radioNext') + ' ▸';
    }
    /* HOW TO PLAY: the key grid, built from the bindings when the card opens. */
    function renderControlsHelp() {
      const grid = getElement('controlGrid');
      grid.replaceChildren();
      for (const [group, title] of CONTROL_GROUPS) {
        const section = document.createElement('section'),
          heading = document.createElement('h3');
        heading.textContent = title;
        section.append(heading);
        for (const action of CONTROL_ACTIONS.filter((a) => a.group === group)) {
          const row = document.createElement('div'),
            key = document.createElement('kbd'),
            text = document.createElement('p');
          key.textContent = keyNames(action.id);
          text.textContent = action.note;
          row.append(key, text);
          section.append(row);
        }
        grid.append(section);
      }
    }
    /* Called at the end of updateUI(). */
    function updateHud() {
      watchWeaponBox();
      watchRadioBox();
      updateHudPops();
      renderQuickKeys();
      getElement('bottom').dataset.context = hudContext();
    }
    /**
     * TITLE MENU
     */
    const titleItems = () => [...getElement('menu').querySelectorAll('.menu-item')];
    let newGameArmedUntil = 0;
    function hasSavedStory() {
      return completed > 0 || missionIndex > 0;
    }
    function updateTitleMenu() {
      const saved = hasSavedStory(),
        next = missions[Math.min(missionIndex, missions.length - 1)];
      getElement('startBtn').querySelector('.menu-label').textContent = saved ? 'CONTINUE' : 'ENTER THE CITY';
      getElement('startMeta').textContent = saved
        ? missionIndex >= missions.length
          ? 'FREE ROAM'
          : (missionIndex >= SIDE_JOB_FIRST ? 'CONTRACT ' + (missionIndex + 1 - SIDE_JOB_FIRST) : 'MISSION ' + String(missionIndex + 1).padStart(2, '0')) +
            (next ? ' · ' + next.title.toUpperCase() : '')
        : 'NEW STORY';
      getElement('startBtn').dataset.caption = saved
        ? 'Pick up where you left off: $' + Math.floor(cash).toLocaleString() + ' in your pocket, ' + completed + ' of ' + missions.length + ' jobs done.'
        : 'Take the wheel. Work the payphones. Keep one step ahead of the law.';
      getElement('newGameMeta').textContent = saved ? 'ERASES PROGRESS' : '';
      getElement('chooseMeta').textContent = completed + ' / ' + missions.length;
      getElement('menuVersion').textContent = 'VERSION ' + GAME_VERSION + ' · AN ORIGINAL TOP-DOWN CRIME GAME';
      const focused = document.activeElement?.classList?.contains('menu-item') ? document.activeElement : null;
      // The title menu opens with its first item selected, so Enter plays.
      if (!focused && gameMode === 'menu') getElement('startBtn').focus({ preventScroll: true });
      showTitleCaption(focused || getElement('startBtn'));
    }
    function showTitleCaption(item) {
      getElement('menuCaption').textContent = item?.dataset.caption || '';
    }
    for (const item of titleItems()) {
      item.addEventListener('focus', () => showTitleCaption(item));
      item.addEventListener('pointerenter', () => {
        if (gameMode === 'menu') item.focus({ preventScroll: true });
      });
    }
    // NEW GAME over a saved story asks for a second press.
    getElement('newGameStart').onclick = () => {
      if (hasSavedStory() && performance.now() > newGameArmedUntil) {
        newGameArmedUntil = performance.now() + 4000;
        getElement('newGameMeta').textContent = 'PRESS AGAIN TO ERASE';
        getElement('newGameStart').classList.add('armed');
        setTimeout(() => {
          getElement('newGameStart').classList.remove('armed');
          if (gameMode === 'menu') updateTitleMenu();
        }, 4000);
        return;
      }
      newGameArmedUntil = 0;
      getElement('newGameStart').classList.remove('armed');
      getElement('menu').classList.add('hidden');
      newGame();
    };
    let creditsOpener = null;
    function openCredits(opener) {
      creditsOpener = opener;
      getElement('credits').classList.remove('hidden');
      getElement('closeCredits').focus();
    }
    getElement('creditsMenuBtn').onclick = () => openCredits(getElement('creditsMenuBtn'));
    /* Up/down through the buttons of the title menu or the pause menu. */
    function menuArrowKey(e) {
      const root = gameMode === 'menu' ? getElement('menu') : getElement('pauseMenu'),
        items =
          gameMode === 'menu'
            ? titleItems()
            : [...root.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
      if (!items.length || !getElement('credits').classList.contains('hidden')) return false;
      e.preventDefault();
      const at = items.indexOf(document.activeElement),
        step = e.code === 'ArrowDown' ? 1 : -1;
      items[at < 0 ? 0 : (at + step + items.length) % items.length].focus();
      return true;
    }
    // END SUBSYSTEM: src/hud.js
