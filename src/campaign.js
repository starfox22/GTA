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
       the godmode cheat is on. A public demo build stops at DEMO_MISSIONS. */
    function missionUnlocked(index) {
      return !demoLocked(index) && (index <= completed || !!player.godMode);
    }
    /**
     * PUBLIC DEMO (game.js DEMO_BUILD)
     * In a demo build a normal player gets missions 1 and 2 (indices below
     * DEMO_MISSIONS). Everything later in `missions` is a story job or a
     * contract and is gated: the picker shows it locked with a FULL GAME badge
     * (a click shows the buy note), the payphone does not ring for it, and
     * RESTART CURRENT JOB cannot reach it. Free-roam activities are not
     * missions and stay open: the hill climb, beach volleyball, the stadium ball,
     * the Sunset Pier rides, the bike share, cabs, rail and the liner, the
     * casino, garages and the gun shop, Fort Sentinel and the Apache.
     * Completing mission 2 shows the DEMO COMPLETE card (thanks, a stats recap,
     * CONTINUE FREE ROAM / MAIN MENU); it is remembered in its own storage key,
     * `dead-end-city-demo`, which NEW GAME does not erase. God mode (the godmode
     * cheat) lifts every gate and never shows the card. The developer console's
     * startMission reaches a gated job only with god mode or `?dev` in the URL.
     */
    const DEMO_MISSIONS = 2;
    const DEMO_BUY_MESSAGE = 'Thanks for playing the demo! If you liked it, please buy the full game.';
    const DEMO_KEY = 'dead-end-city-demo';
    // Play time, cash earned and the highest wanted level of this story, saved
    // with it (the demo card's recap).
    const campaignStats = { playSeconds: 0, cashEarned: 0, wantedPeak: 0 };
    let statsCashSeen = null,
      demoCardIn = 0,
      demoCompleted = false;
    try {
      demoCompleted = !!JSON.parse(localStorage.getItem(DEMO_KEY))?.complete;
    } catch {}
    function demoLocked(index) {
      return DEMO_BUILD && !player.godMode && index >= DEMO_MISSIONS;
    }
    /* A story call is waiting at the payphone (none past the demo's end). */
    function storyCallWaiting() {
      return missionIndex < missions.length && !demoLocked(missionIndex);
    }
    /* The demo's story is done: free roam, no more calls. */
    function demoStoryOver() {
      return missionIndex < missions.length && demoLocked(missionIndex);
    }
    function resetCampaignStats() {
      campaignStats.playSeconds = campaignStats.cashEarned = campaignStats.wantedPeak = 0;
      statsCashSeen = null;
    }
    /* Called every play step (game.js update). Cash earned is every rise in the
       wallet; spending never takes it back. */
    function trackCampaignStats(deltaSeconds) {
      campaignStats.playSeconds += deltaSeconds;
      campaignStats.wantedPeak = Math.max(campaignStats.wantedPeak, Math.ceil(wantedStars));
      if (statsCashSeen !== null && cash > statsCashSeen) campaignStats.cashEarned += cash - statsCashSeen;
      statsCashSeen = cash;
      if (demoCardIn > 0) {
        demoCardIn = Math.max(0, demoCardIn - deltaSeconds);
        if (demoCardIn === 0) showDemoComplete();
      }
    }
    /* winMission: mission 2 closes the demo; the card follows the payday headline. */
    function demoMissionWon(index) {
      if (!DEMO_BUILD || player.godMode || index !== DEMO_MISSIONS - 1) return false;
      demoCompleted = true;
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify({ complete: true, version: GAME_VERSION }));
      } catch {}
      demoCardIn = 2.6;
      return true;
    }
    function playTimeText(seconds) {
      const minutes = Math.floor(seconds / 60),
        h = Math.floor(minutes / 60);
      return h > 0
        ? h + 'h ' + String(minutes % 60).padStart(2, '0') + 'm'
        : minutes + 'm ' + String(Math.floor(seconds % 60)).padStart(2, '0') + 's';
    }
    function showDemoComplete() {
      // Wait out a menu, a call or a death screen: the card comes up in play.
      if (gameMode !== 'play') {
        demoCardIn = 0.5;
        return;
      }
      if (mapOpen) toggleMap();
      gameMode = 'demo';
      keys = {};
      mouse.down = false;
      getElement('demoArt').style.backgroundImage = getElement('coverArt').style.backgroundImage;
      getElement('demoTime').textContent = playTimeText(campaignStats.playSeconds);
      getElement('demoCash').textContent = '$' + Math.floor(campaignStats.cashEarned).toLocaleString();
      const peak = clamp(campaignStats.wantedPeak, 0, 5),
        stars = getElement('demoWanted');
      stars.replaceChildren();
      for (let i = 0; i < 5; i++) {
        const star = document.createElement('i');
        star.textContent = '★';
        if (i < peak) star.className = 'on';
        stars.appendChild(star);
      }
      stars.setAttribute('aria-label', peak + ' of 5 stars');
      getElement('demoMore').textContent =
        'The full game: ' +
        (SIDE_JOB_FIRST - DEMO_MISSIONS) +
        ' more story missions and ' +
        (missions.length - SIDE_JOB_FIRST) +
        ' contracts across the South Coast.';
      getElement('demoComplete').classList.remove('hidden');
      getElement('demoContinue').focus();
      updateUI();
    }
    function closeDemoComplete(toMenu = false) {
      if (gameMode !== 'demo') return;
      getElement('demoComplete').classList.add('hidden');
      keys = {};
      save();
      if (toMenu) {
        gameMode = 'menu';
        getElement('menu').classList.remove('hidden');
        updateTitleMenu();
        return;
      }
      gameMode = 'play';
      canvas.focus();
      tell('Free roam: the city is yours. The hill climb, beach volleyball, the pier rides and the bike share are all open.', 6);
      updateUI();
    }
    getElement('demoContinue').onclick = () => closeDemoComplete(false);
    getElement('demoMenu').onclick = () => closeDemoComplete(true);
    /* A FULL GAME job picked in the demo: the buy note, in the picker. */
    function showDemoBuyNote() {
      const note = getElement('demoBuyNote');
      note.textContent = DEMO_BUY_MESSAGE;
      note.classList.remove('hidden', 'flash');
      void note.offsetWidth;
      note.classList.add('flash');
      tone(420, 0.08, 0.1, 'triangle');
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
            stats: campaignStats,
            cash,
            worldMinutes,
            owned: weapons.map((w) => w.owned),
            armor: player.armor,
            ammo: weapons.map((w) => w.ammo),
            reserve: weapons.map((w) => w.reserve),
            // GOALLINE: open bets (their stakes already out of the cash) and the history.
            sportsbook: sportsbookSaveData(),
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
        loadSportsbook(s.sportsbook);
        if (s.stats && typeof s.stats === 'object')
          for (const k of Object.keys(campaignStats))
            campaignStats[k] = Number.isFinite(s.stats[k]) ? Math.max(0, s.stats[k]) : 0;
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
      const demo = DEMO_BUILD && !player.godMode;
      getElement('campaignProgress').textContent = demo
        ? Math.min(completed, DEMO_MISSIONS) + ' / ' + DEMO_MISSIONS + ' DEMO MISSIONS COMPLETED'
        : completed + ' / ' + missions.length + ' MISSIONS COMPLETED' + (player.godMode ? ' · GOD MODE: ALL JOBS OPEN' : '');
      getElement('missionSelect').classList.toggle('god-mode', !!player.godMode);
      getElement('missionSelect').classList.toggle('demo-mode', demo);
      getElement('demoBuyNote').classList.add('hidden');
      getElement('missionSelectNote').textContent = player.godMode
        ? 'God mode: every job is open. A job played ahead of the story does not skip it.'
        : demo
          ? 'Demo: the first two missions are yours to play and replay. The rest of the story is in the full game.'
          : 'Replay a completed job or continue your story. Future jobs stay secret.';
      for (let i = 0; i < missions.length; i++) {
        const unlocked = missionUnlocked(i),
          b = document.createElement('button');
        if (demoLocked(i)) {
          // Shown, not secret: the full game's jobs, locked, each a buy note.
          b.className = 'mission-choice locked full-game';
          b.setAttribute?.('aria-label', 'Mission ' + (i + 1) + ': ' + missions[i].title + ', in the full game');
          b.innerHTML =
            '<span class="mission-number">' +
            String(i + 1).padStart(2, '0') +
            '</span><span><b>' +
            missions[i].title +
            '</b><small>' +
            (i >= SIDE_JOB_FIRST ? 'CONTRACT · ' : '') +
            'AVAILABLE IN THE FULL GAME</small></span><span class="mission-badge">FULL GAME</span>';
          b.onclick = showDemoBuyNote;
          list.appendChild(b);
          continue;
        }
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
      list.children[Math.min(completed, (demo ? DEMO_MISSIONS : missions.length) - 1)]?.focus();
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
      if (Number.isInteger(index) && index < missions.length && demoLocked(index)) {
        if (gameMode === 'missions') showDemoBuyNote();
        return false;
      }
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
      resetCampaignStats();
      demoCardIn = 0;
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
