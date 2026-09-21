    // BEGIN SUBSYSTEM: src/campaign.js — Campaign saves and replay
    /**
     * Campaign saves and replay
     * Source: src/campaign.js
     * Scope: shared game closure.
     * Save schema, progression frontier, ammunition persistence and mission selection.
     */
    /* Campaign frontier is independent from the mission currently selected for replay. */
    let missionMenuOrigin = 'menu';
    const initialAmmo = [96, 150, 36, 8, 150, 30];
    function campaignCount(value) {
      return typeof value === 'number' && Number.isFinite(value)
        ? clamp(Math.trunc(value), 0, missions.length)
        : 0;
    }
    function savedSupply(value, fallback, max) {
      return typeof value === 'number' && Number.isFinite(value)
        ? clamp(Math.trunc(value), 0, max)
        : fallback;
    }
    function save() {
      try {
        localStorage.setItem(
          'dead-end-city-v1',
          JSON.stringify({
            saveVersion: 11,
            selectedWeaponIndex,
            missionIndex,
            completed,
            highestCompleted: completed,
            cash,
            worldMinutes,
            owned: weapons.map((w) => w.owned),
            armor: player.armor,
            ammo: weapons.map((w) => w.ammo),
            reserve: weapons.map((w) => w.reserve),
          }),
        );
      } catch {}
    }
    function load() {
      try {
        const s = JSON.parse(localStorage.getItem('dead-end-city-v1'));
        if (!s || typeof s !== 'object') return;
        completed =
          s.saveVersion >= 8
            ? campaignCount(s.highestCompleted ?? s.completed)
            : Math.max(campaignCount(s.completed), campaignCount(s.missionIndex));
        missionIndex = Math.min(campaignCount(s.missionIndex), completed);
        cash = clamp(Number(s.cash) || 0, 0, 99999999);
        worldMinutes = Number.isFinite(s.worldMinutes) ? Math.max(0, s.worldMinutes) : worldMinutes;
        if (Array.isArray(s.owned)) weapons.forEach((w, i) => (w.owned = i === 0 || !!s.owned[i]));
        else if (completed > 0) weapons.forEach((w, i) => (w.owned = i < 4));
        if (Number.isFinite(s.armor)) player.armor = clamp(s.armor, 0, 100);
        weapons.forEach((w, i) => {
          if (Array.isArray(s.ammo)) w.ammo = savedSupply(s.ammo[i], w.ammo, w.clip);
          if (Array.isArray(s.reserve)) w.reserve = savedSupply(s.reserve[i], w.reserve, 999999);
        });
        restoreWeaponSelection(s.selectedWeaponIndex);
        if (completed > 0 || missionIndex > 0)
          getElement('startBtn').innerHTML = 'CONTINUE YOUR STORY <span>↗</span>';
      } catch {}
    }
    function clearMissionOverlays() {
      for (const id of [
        'menu',
        'pauseMenu',
        'missionSelect',
        'callOverlay',
        'mapOverlay',
        'serviceOverlay',
        'arsenalOverlay',
        'elevatorOverlay',
      ])
        getElement(id).classList.add('hidden');
      policeNoticeSeconds = 0;
      getElement('policeNotice').classList.remove('show');
      document.body?.classList.remove('police-notice-visible');
      dialogueAction = null;
      liftTravel = null;
      servicePlace = null;
      mapOpen = false;
      keys = {};
      mouse.down = false;
    }
    function openMissionSelect() {
      if (!['menu', 'pause', 'play'].includes(gameMode)) return;
      missionMenuOrigin = gameMode;
      gameMode = 'missions';
      keys = {};
      mouse.down = false;
      const list = getElement('missionChoices');
      list.replaceChildren();
      getElement('campaignProgress').textContent =
        completed + ' / ' + missions.length + ' MISSIONS COMPLETED';
      for (let i = 0; i < missions.length; i++) {
        const unlocked = i <= completed,
          b = document.createElement('button');
        b.className = 'mission-choice' + (unlocked ? '' : ' locked');
        b.disabled = !unlocked;
        b.setAttribute?.(
          'aria-label',
          unlocked
            ? 'Mission ' + (i + 1) + ': ' + missions[i].title
            : 'Mission ' + (i + 1) + ': locked',
        );
        b.innerHTML =
          '<span class="mission-number">' +
          String(i + 1).padStart(2, '0') +
          '</span><span><b>' +
          (unlocked ? missions[i].title : '???') +
          '</b><small>' +
          (unlocked
            ? (i < completed ? 'COMPLETED · REPLAY' : 'CURRENT ' + (i >= SIDE_JOB_FIRST ? 'CONTRACT' : 'MISSION')) +
              (i >= SIDE_JOB_FIRST ? ' · ' + CHARACTERS[missions[i].contact].name.split(' ')[0].toUpperCase() : '')
            : 'LOCKED · KEEP PLAYING') +
          '</small></span><span class="mission-lock">' +
          (unlocked ? '↗' : '🔒') +
          '</span>';
        if (unlocked) b.onclick = () => chooseMission(i);
        list.appendChild(b);
      }
      getElement('missionSelect').classList.remove('hidden');
      list.children[Math.min(completed, missions.length - 1)]?.focus();
    }
    function closeMissionSelect() {
      if (gameMode !== 'missions') return;
      getElement('missionSelect').classList.add('hidden');
      gameMode = missionMenuOrigin;
      keys = {};
      if (gameMode === 'play') canvas.focus();
      else getElement(gameMode === 'pause' ? 'chooseMissionPause' : 'chooseMissionStart').focus();
    }
    function chooseMission(index) {
      if (!Number.isInteger(index) || index < 0 || index >= missions.length || index > completed)
        return false;
      initAudio();
      resetMissionState();
      mission = null;
      clearMissionOverlays();
      player.car = null;
      player.roof = false;
      player.altitude = 0;
      Object.assign(player, spawn);
      cameraTarget.x = player.x;
      cameraTarget.y = player.y;
      missionIndex = index;
      gameMode = 'play';
      save();
      offerMission();
      updateUI();
      return true;
    }
    function finishCampaignMission(missionState) {
      completed = Math.max(completed, missionState.index + 1);
      missionIndex = completed;
    }
    function resetCampaign() {
      completed = 0;
      missionIndex = 0;
      clearMissionOverlays();
      weapons.forEach((w, i) => {
        w.owned = i === 0;
        w.ammo = w.clip;
        w.reserve = initialAmmo[i];
      });
      selectedWeaponIndex = 0;
      reloadSecondsRemaining = shotCooldownSeconds = 0;
      player.disguised = false;
    }
    getElement('chooseMissionStart').onclick = openMissionSelect;
    getElement('chooseMissionPause').onclick = openMissionSelect;
    getElement('closeMissions').onclick = closeMissionSelect;
    getElement('newGameStart').onclick = newGame;
    // END SUBSYSTEM: src/campaign.js
