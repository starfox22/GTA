    /**
     * CHEAT CODE
     * Letters typed during play accumulate in a short ring; when the tail spells a
     * known code it fires. The keys still do their normal jobs while you type, so
     * the character will walk about as you spell it -- which is part of the fun.
     */
    let cheatBuffer = '';
    const CHEAT_CODES = {
      godmode: () => {
        player.godMode = !player.godMode;
        if (player.godMode) {
          for (const w of weapons) {
            w.owned = true;
            w.ammo = w.clip;
            w.reserve = w.clip * (w.rocket ? 5 : 9);
          }
          player.hp = 100;
          player.armor = 100;
          announce('SOUTH COAST', 'GOD MODE ACTIVATED', 2.2);
          tell('GOD MODE ACTIVATED · every weapon · every mission unlocked · mission select, time, weather, ammo and teleport in Settings · God mode', 5);
        } else {
          announce('SOUTH COAST', 'GODMODE OFF', 1.8);
          tell('GODMODE OFF', 2.5);
        }
        drawWeapon();
        updateUI();
        tone(player.godMode ? 720 : 240, 0.22, 0.16, 'sine');
        // Straight to Settings · GOD MODE (god-panel.js), whose first row opens
        // the mission picker with every job unlocked. In play it opens over the
        // pause menu; on the title screen over the title, and BACK returns there.
        if (!player.godMode) return;
        if (gameMode === 'map') toggleMap();
        if (gameMode === 'play') togglePause();
        if (gameMode === 'pause' || gameMode === 'menu') openSettings('god');
      },
    };
    /* Put the player somewhere else, letting go of anything that was carrying
       them: a hired cab or a liner deck would otherwise drag them straight back. */
    function teleportPlayer(x, y) {
      if (player.car) exitCar();
      if (taxiRide) endTaxiRide(false);
      cancelTaxiPick();
      player.deck = null;
      player.coaster = null;
      player.parachute = null;
      player.climbing = null;
      player.thrown = null;
      player.pool = null;
      player.jumpUntil = 0;
      // Off any roof: the Blue Hour terrace or a building roof.
      if (player.roof || player.buildingRoof) {
        player.roof = false;
        player.buildingRoof = null;
        player.altitude = 0;
      }
      // Out of the water too: otherwise the first frame at the new spot still draws
      // the swimmer's pose and wake over dry land, and the SWIMMING toast lingers.
      if (player.swimming || player.wading) {
        player.swimming = false;
        player.wading = 0;
        if (!player.car) player.altitude = 0;
        toastTime = 0;
        getElement('toast').classList.remove('show');
      }
      // An airborne aircraft cannot be left (exitCar refuses), so it comes along
      // rather than being abandoned in the sky while the player jumps away.
      if (player.car && isAircraft(player.car)) {
        player.car.x = x;
        player.car.y = y;
      }
      player.x = x;
      player.y = y;
      cameraTarget.x = x;
      cameraTarget.y = y;
    }
    // Returns true once the tail of the buffer is going somewhere, so the caller
    // can swallow the keypress: spelling a code should not also drive the car.
    function feedCheatBuffer(key) {
      if (!/^[a-z]$/.test(key)) {
        cheatBuffer = '';
        return false;
      }
      cheatBuffer = (cheatBuffer + key).slice(-16);
      for (const [code, run] of Object.entries(CHEAT_CODES))
        if (cheatBuffer.endsWith(code)) {
          cheatBuffer = '';
          run();
          return true;
        }
      // Only from the second letter on: a lone first letter (G) is also a game
      // key (the aircraft's descend) and must not be eaten on every press.
      const tail = cheatBuffer.slice(-15);
      for (const code of Object.keys(CHEAT_CODES))
        for (let i = 2; i <= Math.min(tail.length, code.length); i++)
          if (code.startsWith(tail.slice(-i))) return true;
      return false;
    }
    /**
     * KEYBOARD
     * Physical keys go through the bindings (controls.js): `actions` are the ids
     * of the actions the key drives, and holding one sets its entry in the
     * virtual `keys` table. Menu keys (Escape, Enter, and in the city map the
     * arrows, + / −, 0 and C) are fixed and read from the physical code.
     */
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      // The settings screen owns the keyboard while it is open (and while it
      // listens for a key to bind).
      if (gameMode === 'settings') {
        settingsKeyDown(e);
        return;
      }
      // The betting menu owns the keyboard while it is open; the world runs on
      // (sportsbook-ui.js).
      if (sportsbook.open && gameMode === 'play') {
        sportsbookKey(e);
        return;
      }
      if (
        !e.repeat &&
        (gameMode === 'play' || gameMode === 'map' || gameMode === 'menu') &&
        feedCheatBuffer((e.key || '').toLowerCase())
      ) {
        e.preventDefault();
        return;
      }
      const actions = pressControlKey(code),
        is = (id) => actions.includes(id);
      // MONARCH MOTORS' purchase card owns the keyboard while it is open (dealership.js).
      if (gameMode === 'dealer') {
        dealershipKeyDown(e, code, is);
        return;
      }
      if (gameMode === 'map' && code === 'KeyC') {
        e.preventDefault();
        centerMapOnPlayer();
        return;
      }
      if (
        gameMode === 'play' &&
        is('divert') &&
        !e.repeat &&
        mission?.index === 10 &&
        mission.compromised &&
        [1, 2, 3].includes(mission.stage)
      ) {
        chooseFlightLanding(!mission.divert);
        return;
      }
      if (gameMode === 'map' && mapKey(e, code, is)) return;
      if (gameMode === 'arsenal') {
        if (code === 'Tab') trapArsenalFocus(e);
        if (!e.repeat && (code === 'Escape' || is('arsenal'))) {
          e.preventDefault();
          closeArsenal();
        } else if (!e.repeat && is('cycleWeapon')) {
          e.preventDefault();
          cycleWeapon();
          updateUI();
          renderArsenal(selectedWeaponIndex);
        } else if (!e.repeat && (is('knife') || is('fists') || weaponSlotKey(actions) >= 0)) {
          e.preventDefault();
          selectArsenalWeapon(is('knife') ? KNIFE_INDEX : is('fists') ? FISTS_INDEX : weaponSlotKey(actions));
        }
        return;
      }
      if (gameMode === 'missions') {
        if (code === 'Escape') {
          e.preventDefault();
          closeMissionSelect();
        } else if (/^Digit[0-9]$/.test(code)) {
          // 1-9 pick the first nine jobs; 0 picks the tenth. Later jobs use the buttons.
          e.preventDefault();
          chooseMission(code === 'Digit0' ? 9 : Number(code.slice(-1)) - 1);
        }
        return;
      }
      if (gameMode === 'dialogue') {
        e.preventDefault();
        if (!e.repeat) {
          if (code === 'Enter' || is('interact')) acceptDialogue();
          if (code === 'Escape') closeDialogue();
        }
        return;
      }
      // The DEMO COMPLETE card (campaign.js): a focused button takes Enter and
      // Space itself; Escape (or Enter elsewhere) carries on in free roam.
      if (gameMode === 'demo') {
        if (document.activeElement?.tagName === 'BUTTON' && ['Enter', 'NumpadEnter', 'Space'].includes(code)) return;
        e.preventDefault();
        if (!e.repeat && ['Escape', 'Enter', 'NumpadEnter'].includes(code)) closeDemoComplete(false);
        return;
      }
      if (gameMode === 'elevator') {
        e.preventDefault();
        return;
      }
      if (gameMode === 'transit' || gameMode === 'taxi') {
        if (code === 'Escape' || is('interact')) {
          e.preventDefault();
          if (gameMode === 'transit') closeTransit();
          else closeTaxiOffer();
        }
        return;
      }
      if (gameMode === 'service') {
        const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
        if (
          code === 'Tab' ||
          (editing && !['Enter', 'Escape'].includes(code)) ||
          (e.target?.tagName === 'BUTTON' && ['Enter', 'Space'].includes(code))
        )
          return;
        e.preventDefault();
        // The shop menus read E (leave) and the digits; E follows its binding.
        if (!e.repeat) serviceKey(is('interact') ? 'KeyE' : code);
        return;
      }
      // A focused menu button takes Enter and Space itself (a native click).
      const onButton =
        document.activeElement?.tagName === 'BUTTON' && ['menu', 'pause', 'help', 'dead'].includes(gameMode);
      if (onButton && ['Enter', 'NumpadEnter', 'Space'].includes(code)) return;
      if ((gameMode === 'menu' || gameMode === 'pause') && ['ArrowUp', 'ArrowDown'].includes(code) && menuArrowKey(e))
        return;
      // Keys the browser would otherwise use to scroll or move focus.
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code) ||
        is('map')
      )
        e.preventDefault();
      if (e.repeat) {
        if (gameMode === 'play') holdActions(actions);
        return;
      }
      if (code === 'Escape') {
        togglePause();
        return;
      }
      if (code === 'Enter' || code === 'NumpadEnter') {
        if (gameMode === 'menu') begin();
        else if (gameMode === 'pause') togglePause();
        else if (gameMode === 'help') closeHelp();
        return;
      }
      // Under a ride-skip fade only Escape (pause) and mute do anything.
      if (gameMode === 'play' && rideSkipActive() && !is('mute')) return;
      if (is('map')) {
        toggleMap();
        return;
      }
      if (is('mute')) {
        mute();
        return;
      }
      if (is('help')) {
        openHelp();
        return;
      }
      // The title menu's radio takes the same keys as in a vehicle (car-radio.js TITLE RADIO).
      if (gameMode === 'menu' && titleRadioShown) {
        if (is('radioPower')) toggleCarRadio();
        else if (is('radioNext')) tuneCarRadio(radioStationIndex() + 1);
        else if (is('radioLouder') || is('radioQuieter')) stepRadioVolume(is('radioLouder') ? 1 : -1);
        return;
      }
      if (gameMode !== 'play') return;
      if (is('zoomIn') || is('zoomOut') || is('zoomReset')) {
        e.preventDefault();
        setWorldZoom(is('zoomReset') ? STREET_ZOOM : worldZoomTarget * (is('zoomOut') ? 1 / 1.25 : 1.25));
        return;
      }
      if (is('bail')) {
        // Aircraft: parachute. Boats and flooding cars: over the side (water.js).
        if (!bailOut()) diveOverboard();
        return;
      }
      if (player.parachute && is('handbrake')) {
        deployParachute();
        return;
      }
      // Plane flaps and landing gear (aviation.js, FLIGHT CONTROLS).
      if (player.car?.type === 'plane' && player.car.hp > 0 && (is('flapsDown') || is('flapsUp') || is('gear'))) {
        if (is('gear')) togglePlaneGear(player.car);
        else setPlaneFlaps(player.car, is('flapsDown') ? 1 : -1);
        return;
      }
      // The radio plays in vehicles, in a hired cab and on the Sunset Pier rides
      // (car-radio.js).
      if ((player.car || player.coaster || taxiRide) && is('radioPower')) {
        toggleCarRadio();
        return;
      }
      if ((player.car || player.coaster || taxiRide) && is('radioNext')) {
        tuneCarRadio(radioStationIndex() + 1);
        return;
      }
      if (radioAboard() && (is('radioLouder') || is('radioQuieter'))) {
        stepRadioVolume(is('radioLouder') ? 1 : -1);
        return;
      }
      // Skip the ride, or pick the train's stop for it (ride-skip.js). Off a ride
      // the keys fall through and do nothing.
      if ((is('skipRide') && rideSkipKey('skip')) || (is('skipStop') && rideSkipKey('cycle'))) return;
      holdActions(actions);
      if (is('fire') || (is('handbrake') && !player.car)) shoot();
      if (is('interact')) interact();
      if (is('poison')) poisonDrink();
      if (is('reload')) startReload();
      if (is('arsenal')) openArsenal();
      if (is('knife')) selectWeapon(KNIFE_INDEX);
      if (is('fists')) selectWeapon(FISTS_INDEX);
      if (weaponSlotKey(actions) >= 0) selectWeapon(weaponSlotKey(actions));
      if (is('cycleWeapon')) cycleWeapon();
      if (is('missionCard')) toggleMissionCard();
      if (['forward', 'back', 'left', 'right'].some(is)) mouse.active = false;
    });
    /* weapon1..weapon6 -> 0..5, or -1. */
    function weaponSlotKey(actions) {
      const slot = actions.find((id) => /^weapon[1-6]$/.test(id));
      return slot ? Number(slot.slice(-1)) - 1 : -1;
    }
    /* City map keys: + / − zoom, arrows (and the movement keys) pan, 0 resets. */
    function mapKey(e, code, is) {
      const zoomIn = code === 'Equal' || code === 'NumpadAdd' || is('zoomIn'),
        zoomOut = code === 'Minus' || code === 'NumpadSubtract' || is('zoomOut'),
        reset = code === 'Digit0' || is('zoomReset'),
        panX =
          (code === 'ArrowRight' || is('right') ? 1 : 0) - (code === 'ArrowLeft' || is('left') ? 1 : 0),
        panY = (code === 'ArrowDown' || is('back') ? 1 : 0) - (code === 'ArrowUp' || is('forward') ? 1 : 0);
      if (!zoomIn && !zoomOut && !reset && !panX && !panY) return false;
      e.preventDefault();
      if (zoomIn) {
        if (mapZoom === 1)
          mapCenter = {
            x: player.x,
            y: player.y,
          };
        mapZoom = Math.min(9, mapZoom * 1.5);
      }
      if (zoomOut) mapZoom = Math.max(1, mapZoom / 1.5);
      if (mapZoom === 1 || reset) {
        mapZoom = 1;
        mapCenter = {
          x: (WORLD_LEFT + WORLD_SIZE) / 2,
          y: (WORLD_TOP + WORLD_SIZE) / 2,
        };
      } else {
        const step = 500 / mapZoom;
        mapCenter.x = clamp(mapCenter.x + panX * step, WORLD_LEFT, WORLD_SIZE);
        mapCenter.y = clamp(mapCenter.y + panY * step, WORLD_TOP, WORLD_SIZE);
      }
      drawMap(cityMapContext, 800, 660, true);
      return true;
    }
    window.addEventListener('keyup', (e) => {
      releaseControlKey(e.code);
    });
    window.addEventListener('blur', () => {
      keys = {};
      releaseAllControlKeys();
      mouse.down = false;
      if (gameMode === 'play') togglePause();
      syncCarRadio();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && gameMode === 'play') togglePause();
      syncCarRadio();
    });
    canvas.addEventListener('mousemove', (e) => {
      // Compatibility mouse events synthesized from touches must not hijack the aim.
      if (performance.now() < worldTouchUntil || e.sourceCapabilities?.firesTouchEvents) return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (performance.now() < worldTouchUntil || e.sourceCapabilities?.firesTouchEvents) return;
      // The right button fires a tank's machine gun (armor.js).
      if (e.button === 2 && gameMode === 'play') mouse.alt = true;
      if (e.button === 0 && gameMode === 'play') {
        mouse.down = true;
        mouse.active = true;
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        initAudio();
        shoot();
      }
    });
    window.addEventListener('mouseup', () => (mouse.down = mouse.alt = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    getElement('creditsBtn').onclick = () => openCredits(getElement('creditsBtn'));
    getElement('closeCredits').onclick = () => {
      getElement('credits').classList.add('hidden');
      (creditsOpener || getElement('creditsBtn')).focus();
    };
    getElement('startBtn').onclick = begin;
    getElement('helpBtn').onclick = openHelp;
    getElement('pauseHelp').onclick = openHelp;
    getElement('closeHelp').onclick = closeHelp;
    getElement('pauseBtn').onclick = togglePause;
    getElement('resumeBtn').onclick = togglePause;
    getElement('mapBtn').onclick = toggleMap;
    getElement('pager').onclick = () => {
      if (gameMode === 'play') toggleMissionCard();
    };
    getElement('closeMap').onclick = toggleMap;
    getElement('menuSound').onclick = mute;
    applySoundLabels();
    getElement('closeTaxi').onclick = closeTaxiOffer;
    // Sandboxed embeds and bare file:// copies cannot deliver this file, so hide
    // the offer instead of showing a link that silently does nothing.
    const offlineCopy = getElement('offlineCopy');
    let sandboxed = location.protocol === 'file:' || !!window.claude;
    try {
      if (window.top !== window.self) sandboxed = true;
    } catch (err) {
      sandboxed = true;
    }
    if (offlineCopy && sandboxed) offlineCopy.hidden = true;
    getElement('restartMission').onclick = retryMission;
    getElement('newGame').onclick = newGame;
    window.addEventListener('resize', resize);
