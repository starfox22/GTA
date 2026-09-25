    // BEGIN SUBSYSTEM: src/god-panel.js — God mode settings
    /**
     * God mode settings
     * Source: src/god-panel.js
     * Scope: shared game closure (included after settings.js).
     *
     * While the godmode cheat is on, the SETTINGS screen gains a fifth tab, GOD
     * MODE, after CONTROLS (hidden, and left out of the Q / E cycle, otherwise):
     *
     *   Time of day   the mission picker's presets (campaign.js GOD_TIMES) as
     *                 chips, a 24 h sky slider in five-minute steps and FREEZE
     *                 TIME, which stops the world clock (citylife.js
     *                 updateCivic asks godTimeFrozen()). All through
     *                 setGodTime(), so the change is live behind the menu.
     *   Weather       GOD_WEATHER through setGodWeather(): AUTO hands the sky
     *                 back to the weather machine, anything else locks it.
     *   Refill        godRefill(): every weapon owned, a full clip and at least
     *                 the godmode reserve (clip x 9, rockets x 5); health and
     *                 armour 100; in a vehicle it is mended, and a tank gets its
     *                 40 shells and the full coax belt back.
     *   Lose police   godLosePolice(): the stars to zero through clearPolice(true),
     *                 the path an escape takes (POLICE CLEARED chip, units stand
     *                 down and head home, the helicopter leaves, roadblocks go),
     *                 witness calls already made are dropped, Fort Sentinel's
     *                 alarm ends. The mission's own state is not touched.
     *   Teleport      closes the menus and opens the city map in pick mode
     *                 (crosshair, "Click anywhere to teleport · Esc to cancel",
     *                 wheel / pinch zoom and drag pan as usual). A click goes
     *                 through godTeleport(); Esc, Tab or CLOSE go back to this tab.
     *
     * godTeleport(x, y) is the one safe god-mode move (the plain god-mode tap on
     * the map uses it too):
     *   on foot    the point if it is walkable, else the nearest walkable ground
     *              (a click on a roof or inside a building lands in the street
     *              outside); open water gets a speedboat there to board (a jet
     *              ski where only that fits, the nearest shore if neither does).
     *   road car   (car, bike, bicycle, tank) comes along to the nearest clear
     *              stretch of road, city street, boulevard, county road or
     *              bridge, lined up with it and facing the way it was going.
     *   boat       a click on the water brings it along (the nearest spot it
     *              floats clear); a click on land leaves it where it was and
     *              goes ashore on foot as above.
     *   aircraft   comes along, airborne, at its height above the ground (at
     *              least 50 m, a plane 120 m at no less than cruise speed).
     * Then it lets go of every other carrier (teleportPlayer), sets the ground
     * height, snaps the camera and has the crowd resettle round the new spot.
     *
     * Hooks elsewhere (each marked GOD PANEL): settings.js (openSettings,
     * renderSettings rows with `render`, the footer hint), game.js (toggleMap,
     * the console), navigation.js (the map click), citylife.js (the clock).
     */
    let godTimeFreeze = false,
      godLastTeleport = null,
      godLastRefill = null,
      godLastPolice = null,
      godRefillFlash = 0,
      godPoliceFlash = 0;
    // The map's pick mode: `active` while the TELEPORT map is open, `starting`
    // while it opens, `done` once a click has been taken.
    const godPick = { active: false, starting: false, done: false };
    function godTimeFrozen() {
      return godTimeFreeze && !!player.godMode;
    }
    /**
     * THE TAB
     * The button is added here, after CONTROLS, so the shell's tab row is left
     * alone; SETTINGS_TABS holds 'god' only while god mode is on, which keeps it
     * out of Q / E and the arrow keys otherwise.
     */
    const godTabButton = document.createElement('button');
    godTabButton.type = 'button';
    godTabButton.setAttribute('role', 'tab');
    godTabButton.dataset.tab = 'god';
    godTabButton.className = 'settings-tab-god hidden';
    godTabButton.textContent = 'GOD MODE';
    getElement('settingsTabs').insertBefore(godTabButton, getElement('settingsTabs').querySelector('.settings-tab-keys'));
    godTabButton.onclick = () => {
      if (!player.godMode) return;
      settingsTab = 'god';
      settingsListen = settingsClash = null;
      renderSettings(null, true);
      focusSettingsTab();
    };
    /* Called when the settings screen opens (and on each render of the tab). */
    function syncGodSettingsTab() {
      const on = !!player.godMode,
        at = SETTINGS_TABS.findIndex((t) => t[0] === 'god');
      godTabButton.classList.toggle('hidden', !on);
      if (on && at < 0) SETTINGS_TABS.push(['god', 'GOD MODE']);
      if (!on && at >= 0) SETTINGS_TABS.splice(at, 1);
      if (!on && settingsTab === 'god') settingsTab = 'graphics';
    }
    function godSettingsHint() {
      return 'Everything applies at once. Type GODMODE again during play to turn god mode off.';
    }
    /**
     * ROWS
     * Freeze and weather are ordinary toggle / choice rows (settings.js draws
     * them and steps them with the arrows); the clock, the slider and the two
     * actions draw themselves (`render`).
     */
    SETTING_ROWS.god = [
      { id: 'godHead', kind: 'custom', render: renderGodHead },
      { id: 'godTime', kind: 'custom', render: renderGodTimeRow },
      { id: 'godScrub', kind: 'custom', render: renderGodScrubRow },
      {
        id: 'godFreeze',
        kind: 'toggle',
        label: 'Freeze time',
        note: () => 'Hold the clock where it is: the sun stays put and the weather machine waits. The clock runs again when god mode ends.',
        get: () => godTimeFreeze,
        set: (on) => (godTimeFreeze = !!on),
      },
      {
        id: 'godWeather',
        kind: 'choice',
        label: 'Weather',
        note: () =>
          weather.locked
            ? 'Locked on ' + weatherLabel() + '. AUTO hands the sky back to the weather machine.'
            : 'AUTO: the weather machine drifts on its own (now ' + weatherLabel() + '). Pick a sky to lock it.',
        options: GOD_WEATHER,
        get: () => (weather.locked ? weatherState().id : 'auto'),
        set: (id) => setGodWeather(id),
      },
      { id: 'godRefill', kind: 'custom', render: renderGodRefillRow },
      { id: 'godPolice', kind: 'custom', render: renderGodPoliceRow },
      { id: 'godTeleport', kind: 'custom', render: renderGodTeleportRow },
    ];
    function godRow(id, extraClass) {
      const el = settingsElement('div', 'settings-row god-row' + (extraClass ? ' ' + extraClass : ''));
      el.dataset.row = id;
      return el;
    }
    function godLabel(title, note) {
      const text = settingsElement('div', 'settings-label');
      text.append(settingsElement('b', '', title), settingsElement('small', '', note));
      return text;
    }
    function renderGodHead(body) {
      syncGodSettingsTab();
      const head = settingsElement('div', 'god-head');
      head.append(
        settingsElement('span', 'god-head-badge', 'GOD MODE ON'),
        settingsElement('span', 'god-head-text', 'Invulnerable · every weapon · every job open'),
      );
      const clock = settingsElement('span', 'god-world-clock god-head-clock');
      clock.append(settingsElement('b', '', clockText()), settingsElement('small', '', godClockName()));
      clock.querySelector('b').id = 'godPanelClock';
      clock.querySelector('small').id = 'godPanelClockName';
      head.append(clock);
      body.append(head);
    }
    function godClockName() {
      const minute = Math.floor(worldMinutes) % 1440,
        preset = GOD_TIMES.find(([m]) => m === minute);
      return (preset ? preset[1] : godTimeName(minute)) + (godTimeFrozen() ? ' · FROZEN' : '');
    }
    // The preset chips: a radio row. Left / right step it; up / down are left to
    // the settings screen, which moves between rows.
    function renderGodTimeRow(body) {
      const row = godRow('godTime', 'god-time-row'),
        minute = Math.floor(worldMinutes) % 1440,
        current = GOD_TIMES.find(([m]) => m === minute)?.[0] ?? null,
        group = settingsElement('div', 'settings-choice god-choice');
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', 'Time of day presets');
      GOD_TIMES.forEach(([m, label], i) => {
        const b = settingsElement('button', '', label);
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(m === current));
        const home = m === current || (current === null && i === 0);
        b.tabIndex = home ? 0 : -1;
        if (home) {
          b.dataset.focus = 'godTime';
          b.dataset.nav = '';
        }
        b.title = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
        b.onclick = () => {
          setGodTime(m);
          renderSettings('godTime');
        };
        b.onkeydown = (e) => {
          const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          e.stopPropagation();
          const at = current === null ? (step > 0 ? -1 : 0) : GOD_TIMES.findIndex(([t]) => t === current);
          setGodTime(GOD_TIMES[(at + step + GOD_TIMES.length) % GOD_TIMES.length][0]);
          renderSettings('godTime');
        };
        group.append(b);
      });
      row.append(godLabel('Time of day', 'Jump to a time. The world behind the menu changes at once.'), group);
      body.append(row);
    }
    function renderGodScrubRow(body) {
      const row = godRow('godScrub', 'god-scrub-row'),
        wrap = settingsElement('label', 'god-slider'),
        input = document.createElement('input'),
        hours = settingsElement('span', 'god-slider-hours'),
        minute = Math.floor(worldMinutes) % 1440;
      input.type = 'range';
      input.min = '0';
      input.max = '1435';
      input.step = '5';
      input.value = String(minute - (minute % 5));
      input.dataset.focus = 'godScrub';
      input.dataset.nav = '';
      input.setAttribute('aria-label', 'Time of day, in minutes after midnight');
      input.setAttribute('aria-valuetext', clockText());
      input.oninput = () => {
        setGodTime(Number(input.value));
        input.setAttribute('aria-valuetext', clockText());
        refreshGodClock();
      };
      hours.setAttribute('aria-hidden', 'true');
      for (const h of ['00', '06', '12', '18', '24']) hours.append(settingsElement('i', '', h));
      wrap.append(input, hours);
      row.append(godLabel('24-hour clock', 'Drag across the day in five-minute steps. ← → nudge it.'), wrap);
      body.append(row);
    }
    /* The clock readout and the preset chips follow the slider without a re-render
       (which would drop the slider mid-drag). */
    function refreshGodClock() {
      const clock = getElement('godPanelClock');
      if (!clock) return;
      clock.textContent = clockText();
      getElement('godPanelClockName').textContent = godClockName();
      const minute = Math.floor(worldMinutes) % 1440;
      getElement('settingsBody')
        .querySelectorAll('.god-time-row [role="radio"]')
        .forEach((b, i) => b.setAttribute('aria-checked', String(GOD_TIMES[i][0] === minute)));
    }
    function godActionButton(id, text, onclick) {
      const b = settingsElement('button', 'god-action', text);
      b.type = 'button';
      b.dataset.focus = id;
      b.dataset.nav = '';
      b.onclick = onclick;
      return b;
    }
    function renderGodRefillRow(body) {
      const row = godRow('godRefill', 'god-action-row'),
        side = settingsElement('div', 'god-action-side'),
        done = settingsElement('span', 'god-done', 'REFILLED');
      done.setAttribute('role', 'status');
      if (godRefillFlash && performance.now() - godRefillFlash < 2600) done.classList.add('show');
      side.append(
        done,
        godActionButton('godRefill', 'REFILL ALL AMMO', () => {
          godRefill();
          godRefillFlash = performance.now();
          renderSettings('godRefill');
        }),
      );
      row.append(
        godLabel(
          'Refill everything',
          'Every weapon to a full clip and reserve, health and armour to 100' +
            (player.car ? ', your ' + vehicleSpec(player.car).name.toLowerCase() + ' mended' + (player.car.type === 'tank' ? ' with 40 shells and a full MG belt' : '') : '') +
            '.',
        ),
        side,
      );
      body.append(row);
    }
    function renderGodPoliceRow(body) {
      const row = godRow('godPolice', 'god-action-row'),
        side = settingsElement('div', 'god-action-side'),
        done = settingsElement('span', 'god-done', 'POLICE CLEARED'),
        stars = Math.ceil(wantedStars),
        button = godActionButton('godPolice', 'LOSE POLICE', () => {
          godLosePolice();
          godPoliceFlash = performance.now();
          renderSettings('godPolice');
        });
      done.setAttribute('role', 'status');
      if (godPoliceFlash && performance.now() - godPoliceFlash < 2600) done.classList.add('show');
      button.classList.toggle('idle', stars <= 0);
      side.append(done, button);
      row.append(
        godLabel(
          'Lose the police',
          stars > 0
            ? stars + (stars === 1 ? ' star' : ' stars') + ' now. Clear them as if you had escaped: units stand down and head home, the helicopter leaves, roadblocks lift.'
            : 'No stars right now. Clears the wanted level as if you had escaped.',
        ),
        side,
      );
      body.append(row);
    }
    function renderGodTeleportRow(body) {
      const row = godRow('godTeleport', 'god-action-row'),
        playing = settingsOrigin === 'pause',
        button = godActionButton('godTeleport', 'TELEPORT · PICK ON MAP', godStartTeleportPick);
      button.classList.add('god-action-map');
      button.disabled = !playing;
      row.append(
        godLabel(
          'Teleport',
          playing
            ? 'Opens the city map: click any point to be there. Inside a building you land in the street outside; on the water a speedboat waits; a car comes with you to the nearest road.'
            : 'Start or continue a game to teleport.',
        ),
        button,
      );
      body.append(row);
    }
    /**
     * REFILL
     */
    function godRefill() {
      const snapshot = () => ({
        weapons: weapons.map((w) => ({ name: w.name, owned: !!w.owned, ammo: w.ammo, reserve: w.reserve })),
        hp: Math.round(player.hp),
        armor: Math.round(player.armor || 0),
        vehicle: player.car
          ? {
              type: player.car.type,
              hp: Math.round(player.car.hp),
              maxhp: player.car.maxhp,
              ...(player.car.type === 'tank' ? { shells: tankArms(player.car).shells, belt: tankArms(player.car).belt, mg: tankArms(player.car).mg } : {}),
            }
          : null,
      });
      const before = snapshot();
      for (const w of weapons) {
        w.owned = true;
        w.ammo = w.clip;
        w.reserve = Math.max(w.reserve, w.clip * (w.rocket ? 5 : 9));
      }
      reloadSecondsRemaining = 0;
      player.hp = 100;
      player.armor = 100;
      const c = player.car;
      if (c) {
        repairVehicle(c);
        if (c.type === 'tank') {
          const arms = tankArms(c);
          arms.shells = TANK_MAIN_ROUNDS;
          arms.belt = c.noCoax ? 0 : TANK_MG_BELT;
          arms.mg = c.noCoax ? 0 : TANK_MG_TOTAL - TANK_MG_BELT;
          arms.beltReadyAt = 0;
          c.cannonReadyAt = 0;
        }
      }
      drawWeapon();
      updateUI();
      tone(880, 0.12, 0.12, 'sine');
      tell('REFILLED · every weapon full · health and armour 100' + (c ? ' · vehicle mended' : ''), 2.5);
      godLastRefill = { before, after: snapshot() };
      return godLastRefill;
    }
    /**
     * LOSE POLICE
     * The escape's own path: clearPolice(true). Calls witnesses already put in
     * would bring the police straight back, so those incidents count as
     * reported; the Fort Sentinel alarm (the base's own siren and lockdown)
     * ends too. Missions keep their state.
     */
    function godLosePolice() {
      const before = Math.ceil(wantedStars),
        units = () => vehicles.filter((c) => c.cop && c.hp > 0).length;
      const report = { before, unitsBefore: units(), baseAlarm: militaryAlertUntil > gameTime };
      if (before > 0) clearPolice(true);
      for (const inc of crowd.incidents) if (inc.attacker === player) inc.reported = true;
      if (militaryAlertUntil > gameTime || militaryLockdownUntil > gameTime) {
        militaryAlertUntil = militaryLockdownUntil = 0;
        militaryChallenge.level = 0;
      }
      updateUI();
      if (before > 0) tone(520, 0.14, 0.12, 'sine');
      else tell('No police after you.', 2);
      godLastPolice = { ...report, after: Math.ceil(wantedStars), unitsAfter: units() };
      return godLastPolice;
    }
    /**
     * TELEPORT PICK
     * From the pause menu's settings: close the menus, resume, open the map in
     * pick mode. The map keeps its zoom, pan and pinch.
     */
    function godStartTeleportPick() {
      if (!player.godMode || gameMode !== 'settings' || settingsOrigin !== 'pause') return;
      if (rideSkipActive()) {
        tell('Wait for the ride to arrive.', 2);
        return;
      }
      closeSettings();
      togglePause();
      godPick.active = godPick.starting = true;
      godPick.done = false;
      toggleMap();
      godPick.starting = false;
      if (!mapOpen) godPick.active = false;
    }
    // Every map open and close comes through here (game.js toggleMap).
    function godMapToggled() {
      if (mapOpen) {
        if (!godPick.starting) godPick.active = false;
        getElement('mapOverlay').classList.toggle('god-pick', godPick.active);
        godPickBanner.classList.toggle('hidden', !godPick.active);
        if (godPick.active) godPickHover.textContent = 'Point at a place on the map';
        return;
      }
      getElement('mapOverlay').classList.remove('god-pick');
      godPickBanner.classList.add('hidden');
      const cancelled = godPick.active && !godPick.done;
      godPick.active = false;
      godPick.done = false;
      // Cancelled: back to the god mode tab, over the pause menu.
      if (cancelled && player.godMode && gameMode === 'play') {
        togglePause();
        openSettings('god');
      }
    }
    // The map click (navigation.js): true when the click was a god-mode teleport.
    function godMapClick(x, y) {
      if (!player.godMode || !mapOpen) return false;
      if (!godPick.active && taxiPicking) return false;
      godPick.done = true;
      const report = godTeleport(x, y);
      toggleMap();
      tell(report.message, 3.5);
      return true;
    }
    const godPickBanner = settingsElement('div', 'god-pick-banner hidden'),
      godPickHover = settingsElement('small', '', '');
    godPickBanner.setAttribute('role', 'status');
    godPickBanner.append(settingsElement('b', '', 'Click anywhere to teleport · Esc to cancel'), godPickHover);
    getElement('bigmap').before(godPickBanner);
    // What a click here would do, under the banner as the pointer moves.
    getElement('bigmap').addEventListener('pointermove', (e) => {
      if (!godPick.active || !mapOpen) return;
      const p = mapLocalPoint(e);
      if (!p.valid) return;
      const w = mapWorldPoint(p);
      godPickHover.textContent = godPreview(w.x, w.y);
    });
    function godPreview(x, y) {
      const place = districtAt(x, y) || 'SOUTH COAST',
        c = player.car,
        water = !groundAt(x, y, 0);
      if (c && isAircraft(c)) return place + ' · your aircraft comes along, airborne';
      if (c && isBoat(c)) return place + (water ? ' · open water: the boat comes along' : ' · on land: you step ashore, the boat stays');
      if (c) return place + ' · your ' + vehicleSpec(c).name.toLowerCase() + ' comes along to the nearest road';
      if (water) return place + ' · open water: a speedboat waits there';
      if (solid(x, y, 8)) return place + ' · building: you land in the street outside';
      return place + (onRoad(x, y) ? ' · street' : '') + (terrainHeight(x, y) > 40 ? ' · ' + Math.round(worldMeters(terrainHeight(x, y))) + ' m up' : '');
    }
    /**
     * SAFE TELEPORT
     */
    function godWalkable(x, y, r = 8) {
      return !solid(x, y, r) && !footObstacleBlocked(x, y, 8) && !vehicles.some((o) => (o.altitude || 0) < 20 && pointInCar(x, y, o, 9));
    }
    /* The nearest walkable ground to a point: rings outward, about 12 units
       apart. A point that is already walkable is kept; otherwise (a roof, a
       building, the water) the search first wants room round the spot (24
       units clear, so nobody lands pressed to a wall or in a gap behind one)
       and settles for the player's own 8 only if nothing roomier is near. */
    function godFootSpot(x, y, reach = 2400) {
      if (godWalkable(x, y)) return { x, y };
      for (const [room, far] of [
        [24, 900],
        [8, reach],
      ])
        for (let r = 12; r < far; r += 12) {
          const n = Math.max(12, Math.round((TAU * r) / 12));
          for (let i = 0; i < n; i++) {
            const px = x + Math.cos((i * TAU) / n) * r,
              py = y + Math.sin((i * TAU) / n) * r;
            if (godWalkable(px, py, room)) return { x: px, y: py };
          }
        }
      return null;
    }
    // The nearest point where a boat of `type` floats clear.
    function godWaterSpot(type, x, y, reach = 600, a = 0) {
      for (let r = 0; r < reach; r += 16) {
        const n = r ? Math.max(12, Math.round((TAU * r) / 24)) : 1;
        for (let i = 0; i < n; i++) {
          const px = x + Math.cos((i * TAU) / n) * r,
            py = y + Math.sin((i * TAU) / n) * r;
          for (const heading of [a, a + Math.PI / 2])
            if (boatFits({ type, x: px, y: py, a: heading })) return { x: px, y: py, a: heading };
        }
      }
      return null;
    }
    // Every drivable centre line: city streets, boulevards, county roads, bridges.
    let godRoadCache = null;
    function godRoadSegments() {
      if (godRoadCache) return godRoadCache;
      godRoadCache = [];
      const add = (points, width) => {
        for (let i = 1; i < points.length; i++) godRoadCache.push({ a: points[i - 1], b: points[i], width });
      };
      for (const r of cityStreets()) add(r.points, r.width);
      for (const r of BOULEVARDS) add(r.points, r.width);
      for (const r of COUNTY_ROADS) add(r.points, r.width);
      for (const b of BRIDGES) add([b.a, b.b], b.width);
      return godRoadCache;
    }
    /* The nearest clear stretch of road for vehicle `c`, lined up with the road
       and facing the way the vehicle was going. Candidates step along each nearby
       centre line and across its lanes; the closest one the vehicle fits wins. */
    function godRoadSpot(c, x, y) {
      const candidates = [];
      const nearest = godRoadSegments()
        .map((s) => {
          const dx = s.b[0] - s.a[0],
            dy = s.b[1] - s.a[1],
            length = Math.hypot(dx, dy) || 1,
            t = clamp(((x - s.a[0]) * dx + (y - s.a[1]) * dy) / (length * length), 0, 1);
          return { s, t, length, ux: dx / length, uy: dy / length, d: Math.hypot(s.a[0] + dx * t - x, s.a[1] + dy * t - y) };
        })
        .sort((p, q) => p.d - q.d)
        .slice(0, 8);
      for (const { s, t, length, ux, uy } of nearest) {
        const along = t * length,
          road = Math.atan2(uy, ux),
          heading = Math.abs(normalizeAngle(road - c.a)) <= Math.PI / 2 ? road : normalizeAngle(road + Math.PI);
        for (let step = -480; step <= 480; step += 24) {
          const u = along + step;
          if (u < 0 || u > length) continue;
          for (const side of [0, -0.25, 0.25]) {
            const px = s.a[0] + ux * u - uy * side * s.width,
              py = s.a[1] + uy * u + ux * side * s.width;
            candidates.push({ x: px, y: py, a: heading, d: Math.hypot(px - x, py - y) });
          }
        }
      }
      candidates.sort((p, q) => p.d - q.d);
      // The vehicle itself must not count as being in its own way.
      const ox = c.x,
        oy = c.y;
      c.x = c.y = -1e7;
      try {
        for (const p of candidates.slice(0, 900))
          if (onRoad(p.x, p.y) && !solid(p.x, p.y, 8) && canSpawnCar(c.type, p.x, p.y, p.a, 4, c.airframe)) return p;
      } finally {
        c.x = ox;
        c.y = oy;
      }
      return null;
    }
    // Put vehicle `c` (with the player aboard) at a spot, at rest, its per-step
    // state reset as makeCar() declares it.
    function godPlaceVehicle(c, spot) {
      Object.assign(c, {
        x: spot.x,
        y: spot.y,
        a: spot.a ?? c.a,
        vx: 0,
        vy: 0,
        vz: 0,
        av: 0,
        speed: 0,
        stepStartX: spot.x,
        stepStartY: spot.y,
        stepStartA: spot.a ?? c.a,
        moveA: spot.a ?? c.a,
        poseX: NaN,
        poseY: NaN,
        poseA: NaN,
        restSteps: 0,
        resting: false,
        contactStatics: null,
        stepStatics: null,
        junction: null,
        offroadState: null,
        groundHeight: terrainHeight(spot.x, spot.y),
        sinkFor: 0,
        sinkDepth: 0,
        deckLift: 0,
        roofSite: null,
      });
      player.x = c.x;
      player.y = c.y;
      player.a = c.a;
    }
    function godAircraftTo(c, x, y) {
      const plane = c.type === 'plane',
        clearance = Math.max(aircraftClearance(c), (plane ? 120 : 50) * UNITS_PER_METRE),
        floor = Math.max(terrainHeight(x, y), roofHeightNear(x, y, 60)),
        speed = Math.hypot(c.vx || 0, c.vy || 0);
      godPlaceVehicle(c, { x, y, a: c.a });
      c.altitude = floor + clearance;
      if (plane) {
        const cruise = Math.max(speed, 295 * KMH);
        c.vx = Math.cos(c.a) * cruise;
        c.vy = Math.sin(c.a) * cruise;
        c.speed = cruise;
        if (speed < 200 * KMH) {
          c.gearDown = false;
          c.gearPos = 0;
          c.throttle = c.power = Math.max(c.throttle || 0, 0.75);
        }
      }
      return { kind: 'aircraft', message: 'TELEPORTED · ' + vehicleSpec(c).name + ' at ' + Math.round(worldMeters(clearance)) + ' m' };
    }
    function godOnFoot(x, y) {
      // Open water: a boat to board rather than a long swim.
      if (!groundAt(x, y, 0) && !onBridge(x, y, 0)) {
        for (const type of ['speedboat', 'jetski']) {
          const spot = godWaterSpot(type, x, y, 400);
          if (!spot) continue;
          teleportPlayer(spot.x, spot.y);
          const boat = makeCar(type, spot.x, spot.y, spot.a, false);
          boat.authorized = true;
          player.swimming = false;
          enterVehicle(boat);
          return { kind: 'boat', message: 'TELEPORTED · a ' + vehicleSpec(boat).name.toLowerCase() + ' on the water, all yours' };
        }
      }
      const spot = godFootSpot(x, y) || { x: spawn.x, y: spawn.y },
        moved = Math.hypot(spot.x - x, spot.y - y);
      teleportPlayer(spot.x, spot.y);
      player.altitude = terrainHeight(spot.x, spot.y);
      return {
        kind: 'foot',
        snapped: moved > 1,
        message: moved > 1 ? 'TELEPORTED · the nearest open ground, ' + Math.round(worldMeters(moved)) + ' m from the pick' : 'TELEPORTED',
      };
    }
    /* The god-mode teleport: see the file comment for how each case resolves.
       Returns a report (also kept for the console). */
    function godTeleport(x, y) {
      x = clamp(x, WORLD_LEFT + 40, WORLD_SIZE - 40);
      y = clamp(y, WORLD_TOP + 40, WORLD_SIZE - 40);
      const from = { x: Math.round(player.x), y: Math.round(player.y) };
      if (transitRide) leaveTransit(transitRide.from, true);
      let c = player.car,
        result = null;
      if (c && c.hp <= 0) {
        // A wreck stays behind.
        c.ai = false;
        player.car = null;
        c = null;
      }
      if (c && isAircraft(c)) result = godAircraftTo(c, x, y);
      else if (c && isBoat(c)) {
        // On water it comes along; a click on land leaves it and goes ashore.
        const spot = !groundAt(x, y, 0) && !onBridge(x, y, 0) ? godWaterSpot(c.type, x, y, 700, c.a) : null;
        if (spot) {
          godPlaceVehicle(c, spot);
          result = { kind: 'boat', message: 'TELEPORTED · ' + vehicleSpec(c).name + ' on the water' };
        } else {
          // Ashore: the boat stays where it was.
          c.ai = false;
          c.vx = c.vy = c.speed = 0;
          player.car = null;
          result = godOnFoot(x, y);
          result.message += ' · your boat stayed where it was';
        }
      } else if (c) {
        const spot = godRoadSpot(c, x, y);
        if (spot) {
          godPlaceVehicle(c, spot);
          const moved = Math.hypot(spot.x - x, spot.y - y);
          result = {
            kind: 'road',
            snapped: moved > 1,
            message: 'TELEPORTED · ' + vehicleSpec(c).name + ' on the nearest road' + (moved > 40 ? ', ' + Math.round(worldMeters(moved)) + ' m from the pick' : ''),
          };
        } else {
          c.ai = false;
          c.vx = c.vy = c.speed = 0;
          player.car = null;
          result = godOnFoot(x, y);
          result.message += ' · no road for your vehicle here';
        }
      } else result = godOnFoot(x, y);
      // Settle: camera on the spot, the street refilled round it, a moment's grace.
      cameraTarget.x = player.x;
      cameraTarget.y = player.y;
      crowd.settledAt = null;
      crowd.timers.stream = 0;
      player.inv = Math.max(player.inv || 0, 1);
      keys = {};
      mouse.down = false;
      updateUI();
      const v = player.car;
      godLastTeleport = {
        asked: { x: Math.round(x), y: Math.round(y) },
        from,
        to: { x: Math.round(player.x), y: Math.round(player.y) },
        kind: result.kind,
        snapped: !!result.snapped,
        message: result.message,
        district: districtAt(player.x, player.y),
        elevation: Math.round(entityElevation(player)),
        vehicle: v ? { type: v.type, heading: +v.a.toFixed(2), onRoad: !!onRoad(v.x, v.y), altitude: Math.round(v.altitude || 0) } : null,
        swimming: !!player.swimming,
        solidHere: solid(player.x, player.y, 8),
      };
      return godLastTeleport;
    }
    /**
     * CONSOLE (window.DeadEndCity, game.js): explicit methods only.
     */
    function godPanelConsole() {
      return {
        // The god mode tab: shown, freeze, clock, weather, pick mode, last refill / teleport.
        godPanel: () => ({
          godMode: !!player.godMode,
          tabShown: !godTabButton.classList.contains('hidden'),
          tabs: SETTINGS_TABS.map((t) => t[0]),
          freeze: godTimeFreeze,
          clock: clockText(),
          weather: weatherState().id,
          locked: weather.locked,
          picking: godPick.active,
          lastTeleport: godLastTeleport,
          lastRefill: godLastRefill,
          lastPolice: godLastPolice,
        }),
        // The god-mode teleport as a map click would do it (map not needed).
        godTeleport(x, y) {
          if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('godTeleport needs two finite numbers');
          return godTeleport(x, y);
        },
        godRefill: () => godRefill(),
        godLosePolice: () => godLosePolice(),
        godFreeze(on = true) {
          godTimeFreeze = !!on;
          return godTimeFrozen();
        },
        // Where map point (x, y) is on screen while the city map is open (client
        // pixels), for tests that click the map; null if it is off the map.
        mapScreenPoint(x, y) {
          if (!mapOpen) return null;
          const r = getElement('bigmap').getBoundingClientRect(),
            s = Math.min(r.width / 800, r.height / 660),
            left = r.left + (r.width - 800 * s) / 2,
            top = r.top + (r.height - 660 * s) / 2,
            k = Math.min(800 / WORLD_WIDTH, 660 / WORLD_HEIGHT) * 0.92 * mapZoom,
            px = 400 + (x - mapCenter.x) * k,
            py = 330 + (y - mapCenter.y) * k;
          if (px < 0 || px > 800 || py < 0 || py > 660) return null;
          return { x: Math.round(left + px * s), y: Math.round(top + py * s) };
        },
      };
    }
    // END SUBSYSTEM: src/god-panel.js
