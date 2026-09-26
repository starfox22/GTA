    // Resize, begin/newGame, pause, help, big map toggle.
    function resize() {
      viewportWidth = innerWidth;
      viewportHeight = innerHeight;
      devicePixelRatioLimit = Math.min(devicePixelRatio || 1, 2);
      canvas.width = viewportWidth * devicePixelRatioLimit;
      canvas.height = viewportHeight * devicePixelRatioLimit;
      worldContext.setTransform(devicePixelRatioLimit, 0, 0, devicePixelRatioLimit, 0, 0);
      worldContext.imageSmoothingEnabled = false;
      canvasScale =
        clamp(Math.min(viewportWidth / 1250, viewportHeight / 850), 0.72, 1.35) * worldZoom;
      if (city3D) {
        city3D.resize();
        // LOW caps the scene's pixel count (quality.js LOW RESOLUTION CAP).
        applyTierResolution();
      }
    }
    function begin() {
      if (gameMode !== 'menu') return;
      initAudio();
      newCallNotice();
      gameMode = 'play';
      getElement('menu').classList.add('hidden');
      canvas.focus();
      keys = {};
      tell(
        demoStoryOver()
          ? 'Welcome back. The demo story is complete: the city is yours to explore.'
          : 'Welcome to South Coast. Answer the yellow payphone, or take a ride.',
        5,
      );
      announce('SOUTH COAST · 1997', 'DEAD END CITY', 1.8);
    }
    function togglePause() {
      closeSportsbook();
      if (gameMode === 'arsenal') {
        closeArsenal();
        return;
      }
      if (gameMode === 'transit') {
        closeTransit();
        return;
      }
      if (gameMode === 'service') {
        closeService();
        return;
      }
      // MONARCH MOTORS' purchase card (dealership.js).
      if (gameMode === 'dealer') {
        closeDealerMenu();
        return;
      }
      if (gameMode === 'taxi') {
        closeTaxiOffer();
        return;
      }
      if (!getElement('credits').classList.contains('hidden')) {
        // Close as the BACK button does, returning focus to whatever opened it.
        getElement('closeCredits').click();
        return;
      }
      if (gameMode === 'menu' || gameMode === 'dead') return;
      if (gameMode === 'help') {
        closeHelp();
        return;
      }
      if (mapOpen) {
        toggleMap();
        return;
      }
      if (gameMode === 'play') {
        gameMode = 'pause';
        getElement('pauseMenu').classList.remove('hidden');
        getElement('pauseInfo').textContent =
          completed +
          ' of ' +
          missions.length +
          ' jobs complete · $' +
          cash.toLocaleString() +
          ' earned and in your pocket.';
        getElement('resumeBtn').focus();
      } else if (gameMode === 'pause') {
        initAudio();
        gameMode = 'play';
        getElement('pauseMenu').classList.add('hidden');
        canvas.focus();
      }
      keys = {};
      mouse.down = false;
      syncCarRadio();
    }
    function openHelp() {
      if (gameMode === 'help') {
        closeHelp();
        return;
      }
      if (gameMode === 'dead') return;
      previousMode = gameMode;
      gameMode = 'help';
      renderControlsHelp();
      getElement('help').classList.remove('hidden');
      // Focus the button without scrolling the manual to its end.
      getElement('closeHelp').focus({ preventScroll: true });
      getElement('help').querySelector('.dialog').scrollTop = 0;
      keys = {};
    }
    function closeHelp() {
      gameMode = previousMode;
      getElement('help').classList.add('hidden');
      if (gameMode === 'play') canvas.focus();
    }
    function toggleMap() {
      if ((gameMode !== 'play' || rideSkipActive()) && !mapOpen) return;
      clearMapGesture();
      clearTouchInput();
      mapOpen = !mapOpen;
      if (!mapOpen) cancelTaxiPick();
      gameMode = mapOpen ? 'map' : 'play';
      getElement('mapOverlay').classList.toggle('hidden', !mapOpen);
      keys = {};
      mouse.down = false;
      if (mapOpen) {
        if (taxiPicking)
          getElement('mapRouteStatus').textContent = 'CAB WAITING · Tap where you want to be dropped off';
        drawMap(cityMapContext, 800, 660, true);
        getElement('closeMap').focus();
      } else canvas.focus();
      godMapToggled(); // GOD PANEL: the teleport pick mode (god-panel.js)
    }
    function newGame() {
      initAudio();
      cancelRideSkip();
      worldZoom = worldZoomTarget = STREET_ZOOM;
      airDispatchTimer = 0;
      casinoRound = null;
      casinoAngle = 0;
      casinoResult = 'Choose your bet, then spin.';
      clearWaypoint();
      resetMissionState();
      resetCampaign();
      worldMinutes = 17 * 60 + 20;
      harborGate = harborGateUntil = 0;
      weapons.forEach((w, i) => (w.owned = i === 0));
      selectedWeaponIndex = 0;
      missionIndex = 0;
      completed = 0;
      cash = 0;
      mission = null;
      player.car = null;
      player.x = spawn.x;
      player.y = spawn.y;
      player.hp = 100;
      player.armor = 0;
      cameraTarget.x = player.x;
      cameraTarget.y = player.y;
      populate();
      populateStoryWorld();
      populateCounty();
      save();
      gameMode = 'play';
      getElement('pauseMenu').classList.add('hidden');
      announce('A FRESH START', 'DEAD END CITY', 1.8);
      tell('Your story starts at the yellow payphone.');
      newCallNotice();
      canvas.focus();
      updateUI();
    }
