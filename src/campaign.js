    // BEGIN SUBSYSTEM: src/campaign.js — Campaign saves and replay
    /**
     * Campaign saves and replay
     * Source: src/campaign.js
     * Scope: shared game closure.
     * Save schema, progression frontier, ammunition persistence and mission selection.
     */
    /* Campaign frontier is independent from the mission currently selected for replay. */
    let missionMenuOrigin = 'menu';
    /* Jobs the picker offers: everything up to the frontier, or every job while
       the godmode cheat is on. */
    function missionUnlocked(index) {
      return index <= completed || !!player.godMode;
    }
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
      hidePoliceNotice();
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
        completed + ' / ' + missions.length + ' MISSIONS COMPLETED' + (player.godMode ? ' · GOD MODE: ALL JOBS OPEN' : '');
      getElement('missionSelect').classList.toggle('god-mode', !!player.godMode);
      getElement('missionSelectNote').textContent = player.godMode
        ? 'God mode: every job is open. A job played ahead of the story does not skip it.'
        : 'Replay a completed job or continue your story. Future jobs stay secret.';
      for (let i = 0; i < missions.length; i++) {
        const unlocked = missionUnlocked(i),
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
            ? (i < completed
                ? 'COMPLETED · REPLAY'
                : i > completed
                  ? 'GOD MODE · UNLOCKED'
                  : 'CURRENT ' + (i >= SIDE_JOB_FIRST ? 'CONTRACT' : 'MISSION')) +
              (i >= SIDE_JOB_FIRST ? ' · ' + CHARACTERS[missions[i].contact].name.split(' ')[0].toUpperCase() : '')
            : 'LOCKED · KEEP PLAYING') +
          '</small></span><span class="mission-lock">' +
          (unlocked ? '↗' : '🔒') +
          '</span>';
        if (unlocked) b.onclick = () => chooseMission(i);
        list.appendChild(b);
      }
      renderGodWorld();
      getElement('missionSelect').classList.remove('hidden');
      list.children[Math.min(completed, missions.length - 1)]?.focus();
    }
    /**
     * GOD MODE · TIME OF DAY
     * With the godmode cheat on, the mission picker also sets the clock and the
     * sky. Presets jump to a time, the slider (the day drawn as a sky gradient)
     * picks any five minutes, and the weather row locks a sky or hands it back to
     * the weather machine (AUTO). Everything applies at once; the clock keeps
     * running from the chosen time. Arrow keys step through a row or the slider.
     */
    const GOD_TIMES = [
      [360, 'DAWN'],
      [540, 'MORNING'],
      [720, 'NOON'],
      [1140, 'GOLDEN HOUR'],
      [1230, 'DUSK'],
      [1380, 'NIGHT'],
      [180, '3 AM'],
    ];
    const GOD_WEATHER = [
      ['auto', 'AUTO'],
      ['clear', 'CLEAR'],
      ['fair', 'FAIR'],
      ['cloudy', 'CLOUDY'],
      ['overcast', 'OVERCAST'],
      ['rain', 'RAIN'],
      ['storm', 'STORM'],
    ];
    function godTimeName(minute) {
      const h = minute / 60;
      return h < 4.5 || h >= 22 ? 'NIGHT' : h < 7 ? 'DAWN' : h < 11 ? 'MORNING' : h < 14 ? 'NOON' : h < 18 ? 'AFTERNOON' : h < 20 ? 'GOLDEN HOUR' : 'DUSK';
    }
    function setGodTime(minute) {
      minute = clamp(Math.round(minute), 0, 1439);
      worldMinutes = Math.floor(worldMinutes / 1440) * 1440 + minute;
      save();
      renderGodWorld();
      updateUI();
    }
    function setGodWeather(id) {
      if (id === 'auto') weather.locked = false;
      else {
        weather.locked = true;
        setWeather(id);
      }
      renderGodWorld();
      updateUI();
    }
    // A radio row: one button per option, the current one checked; arrows step.
    function godChoiceRow(group, options, current, pick) {
      const focused = group.contains(document.activeElement);
      group.replaceChildren();
      options.forEach(([id, label], i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(id === current));
        b.tabIndex = id === current || (current === null && i === 0) ? 0 : -1;
        b.onclick = () => pick(id);
        b.onkeydown = (e) => {
          const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          e.stopPropagation();
          pick(options[(i + step + options.length) % options.length][0]);
          group.querySelector('[aria-checked="true"]')?.focus();
        };
        group.appendChild(b);
      });
      if (focused) (group.querySelector('[aria-checked="true"]') || group.firstChild)?.focus();
    }
    function renderGodWorld() {
      const panel = getElement('godWorld');
      panel.classList.toggle('hidden', !player.godMode);
      if (!player.godMode) return;
      const minute = Math.floor(worldMinutes) % 1440,
        preset = GOD_TIMES.find(([m]) => m === minute);
      getElement('godClock').textContent = clockText();
      getElement('godClockName').textContent = preset ? preset[1] : godTimeName(minute);
      godChoiceRow(getElement('godTimePresets'), GOD_TIMES, preset ? preset[0] : null, setGodTime);
      godChoiceRow(getElement('godWeather'), GOD_WEATHER, weather.locked ? weatherState().id : 'auto', setGodWeather);
      const slider = getElement('godTimeSlider');
      if (document.activeElement !== slider) slider.value = String(minute - (minute % 5));
      slider.setAttribute('aria-valuetext', clockText() + ', ' + getElement('godClockName').textContent.toLowerCase());
    }
    getElement('godTimeSlider').oninput = (e) => setGodTime(Number(e.target.value));
    function closeMissionSelect() {
      if (gameMode !== 'missions') return;
      getElement('missionSelect').classList.add('hidden');
      gameMode = missionMenuOrigin;
      keys = {};
      if (gameMode === 'play') canvas.focus();
      else {
        if (gameMode === 'menu') updateTitleMenu();
        getElement(gameMode === 'pause' ? 'chooseMissionPause' : 'chooseMissionStart').focus();
      }
    }
    function chooseMission(index) {
      if (!Number.isInteger(index) || index < 0 || index >= missions.length || !missionUnlocked(index))
        return false;
      initAudio();
      resetMissionState();
      mission = null;
      clearMissionOverlays();
      player.car = null;
      player.roof = false;
      player.buildingRoof = null;
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
      // A job played ahead of the story under god mode does not skip the story.
      if (missionState.index <= completed) completed = Math.max(completed, missionState.index + 1);
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
