    // HUD state and pop boxes, saved settings, weapon and radio watches, stars, minimap fold and zoom (hudState, hudPop).
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
      // GPS route on the minimap (Settings · Gameplay, navigation.js).
      gps: true,
      // The flight instruments (Settings · Gameplay); warnings show either way.
      flightHud: true,
      // Speed readouts in km/h or mph (Settings · Gameplay · Speed units).
      units: 'kmh',
      // The speed box on foot, swimming and falling (Settings · Gameplay).
      footSpeed: true,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(HUD_STORAGE));
      if (saved && typeof saved === 'object') {
        hudState.minimapFolded = saved.minimapFolded === true;
        hudState.keyHints = saved.keyHints !== false;
        hudState.gps = saved.gps !== false;
        hudState.flightHud = saved.flightHud !== false;
        hudState.units = saved.units === 'mph' ? 'mph' : 'kmh';
        hudState.footSpeed = saved.footSpeed !== false;
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
    const hudSeen = { weapon: -1, ammo: -1, reserve: -1, reloading: false, radioShown: false, stars: -1, pendingStar: 0, keys: '' };
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
    // `pending` is the star dispatch is about to add (it flashes red, heat.js);
    // `searching` greys the earned stars while the police have lost sight.
    function renderStars(level, pending = 0, searching = false) {
      const el = getElement('stars');
      el.classList.toggle('searching', level > 0 && searching);
      if (level === hudSeen.stars && pending === hudSeen.pendingStar) return;
      const gained = level > hudSeen.stars && hudSeen.stars >= 0;
      el.replaceChildren();
      for (let i = 0; i < 5; i++) {
        const star = document.createElement('i');
        star.textContent = '★';
        if (i < level) star.className = 'on' + (gained && i >= hudSeen.stars ? ' gained' : '');
        else if (i === pending - 1) star.className = 'next';
        el.append(star);
      }
      el.classList.toggle('wanted', level > 0);
      el.setAttribute('aria-label', 'Wanted level ' + level + ' of 5');
      hudSeen.stars = level;
      hudSeen.pendingStar = pending;
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
    function setGps(on) {
      hudState.gps = !!on;
      saveHudState();
    }
    /* Off hides the tapes, attitude, power and heading strip; STALL / PULL UP and
       the other warnings still flash, briefly and only when they apply, because
       they are the difference between a landing and a crash. */
    function setFlightHud(on) {
      hudState.flightHud = !!on;
      getElement('flightHud').classList.toggle('instruments-off', !hudState.flightHud);
      saveHudState();
    }
    setFlightHud(hudState.flightHud);
    /**
     * SPEED BOX (#vehicleStats)
     * One readout for however the player is moving, written by updateSpeedBox()
     * on every updateUI() pass: the vehicle's name and speed (knots on a boat,
     * km/h or mph everywhere else), and on foot the movement state (STANDING,
     * WALKING, RUNNING, WADING, CLIMBING, SWIMMING, FALLING under a parachute)
     * over the same big figure. The figure on foot is the player's measured
     * ground speed (trackPlayerPace, every simulation step: what the legs
     * actually cover, walls and slopes included), eased over PACE_SMOOTHING so
     * footsteps and a scrape along a wall do not make it jitter, and snapped to
     * a clean 0 once the player stands. The thin meter under it is the vehicle's
     * condition in a vehicle and the breath while swimming (the old breath
     * figure moved there, so the number is always a speed); on foot there is no
     * stamina to show, so it folds away. The units (Settings · Gameplay · Speed
     * units, `hudState.units`) apply to every speed the game prints: this box,
     * the flight HUD's airspeed tape and the Falcon's ride card.
     */
    const SPEED_UNITS = {
        kmh: { label: 'KM/H', perUnit: KMH },
        mph: { label: 'MPH', perUnit: KMH * 1.609344 },
      },
      // Seconds for the on-foot figure to settle (an exponential ease).
      PACE_SMOOTHING = 0.35,
      // Under this (map units a second) the player is standing: the figure reads 0.
      PACE_STANDING = 0.6 * KMH;
    function speedUnits() {
      return SPEED_UNITS[hudState.units] || SPEED_UNITS.kmh;
    }
    function speedUnitLabel() {
      return speedUnits().label;
    }
    // Map units a second in the chosen unit.
    function speedReading(unitsPerSecond) {
      return Math.abs(unitsPerSecond) / speedUnits().perUnit;
    }
    // A figure already in km/h (the flight data, the Falcon) in the chosen unit.
    function kmhReading(kmh) {
      return hudState.units === 'mph' ? kmh / 1.609344 : kmh;
    }
    // Rounded, with its unit: "37 KM/H" (the bike-share and ride copy use it).
    function speedText(unitsPerSecond) {
      return Math.round(speedReading(unitsPerSecond)) + ' ' + speedUnitLabel();
    }
    function setSpeedUnits(units) {
      hudState.units = units === 'mph' ? 'mph' : 'kmh';
      getElement('fhSpeedCap').textContent = 'IAS · ' + speedUnitLabel();
      saveHudState();
    }
    setSpeedUnits(hudState.units);
    function setFootSpeed(on) {
      hudState.footSpeed = !!on;
      saveHudState();
    }
    /* The player's own ground speed on foot or in the water, measured from where
       each simulation step leaves them. Carriers (a vehicle, a train, a cab, a
       ride) and jumps (teleports, a respawn) reset it instead of reading as a
       sprint. `shown` is the whole number on screen, changed only when the eased
       speed has moved most of a unit away from it. */
    const paceMeter = { x: 0, y: 0, ready: false, speed: 0, shown: 0 };
    function trackPlayerPace(deltaSeconds) {
      if (!(deltaSeconds > 0)) return;
      const carried = !!(player.car || transitRide || taxiRide || player.coaster || player.parachute),
        dx = player.x - paceMeter.x,
        dy = player.y - paceMeter.y;
      paceMeter.x = player.x;
      paceMeter.y = player.y;
      if (carried || !paceMeter.ready) {
        paceMeter.ready = !carried;
        paceMeter.speed = 0;
        return;
      }
      const raw = Math.hypot(dx, dy) / deltaSeconds;
      // Faster than anything on foot can go (a deck under way tops out far
      // below): a teleport or respawn, so start again from standing.
      if (raw > 80 * KMH) {
        paceMeter.speed = 0;
        return;
      }
      paceMeter.speed += (raw - paceMeter.speed) * (1 - Math.exp(-deltaSeconds / PACE_SMOOTHING));
      if (paceMeter.speed < PACE_STANDING && raw < PACE_STANDING) paceMeter.speed = 0;
    }
    function paceFigure() {
      const value = speedReading(paceMeter.speed);
      if (value < 0.5) paceMeter.shown = 0;
      else if (Math.abs(value - paceMeter.shown) >= 0.75) paceMeter.shown = Math.round(value);
      return paceMeter.shown;
    }
    /* What the player is doing on foot, as the box names it. */
    function footMovement() {
      const moving = paceMeter.speed >= PACE_STANDING;
      if (player.climbing) return 'CLIMBING';
      if (player.swimming)
        return moving ? (swimHard() ? 'SWIMMING · CRAWL' : 'SWIMMING · BREASTSTROKE') : 'SWIMMING · TREADING WATER';
      if (!moving) return 'STANDING';
      if (player.wading) return 'WADING';
      // The measured speed decides, so the word always agrees with the figure:
      // anything well past a walk (a run slowed by a slope still counts) runs.
      return paceMeter.speed > FOOT_WALK * 1.7 ? 'RUNNING' : 'WALKING';
    }
    function updateSpeedBox() {
      const c = player.car,
        box = getElement('vehicleStats'),
        chute = !c && player.parachute,
        swimming = !c && !chute && !!player.swimming,
        // On foot in the open: not a passenger, not on a ride.
        onFoot = !c && !chute && !transitRide && !taxiRide && !player.coaster && gameMode !== 'elevator',
        units = speedUnitLabel();
      let name = '',
        figure = '',
        unit = '',
        meter = null,
        meterKind = '';
      if (transitRide) name = 'CITY RAIL';
      else if (c) {
        name = vehicleSpec(c).name;
        if (isBoat(c)) {
          figure = Math.round(Math.hypot(c.vx || 0, c.vy || 0) / KNOTS);
          unit = 'KNOTS';
        } else {
          figure = Math.round(speedReading(c.type === 'plane' ? c.airspeed || Math.abs(c.speed) : c.speed));
          unit = isAircraft(c)
            ? units + ' · ' + Math.round(worldMeters(c.altitude)) + ' m ALT · ' + roofClearanceText(c)
            : ridingBicycle()
              ? units + ' · ' + Math.round(pedalCadence() * 60) + ' RPM · LEGS ' + Math.round((cycleStamina / CYCLE_STAMINA_MAX) * 100) + '%'
              : units;
        }
        meter = c.hp / c.maxhp;
        meterKind = 'condition';
      } else if (chute && hudState.footSpeed) {
        // Freefall and canopy: the speed through the air, the rate of descent and
        // the height left.
        const p = player.parachute;
        name = p.stage === 'freefall' ? 'FALLING · FREEFALL' : 'FALLING · CANOPY';
        figure = Math.round(speedReading(Math.hypot(p.vx || 0, p.vy || 0, p.vz || 0)));
        unit =
          units + ' · ↓ ' + Math.round(speedReading(Math.min(0, p.vz || 0))) + ' · ' +
          Math.round(worldMeters(Math.max(0, (player.altitude || 0) - terrainHeight(player.x, player.y)))) + ' m';
      } else if (swimming || (onFoot && hudState.footSpeed)) {
        name = footMovement();
        figure = paceFigure();
        unit = units;
        if (swimming) {
          // The breath gauge, as a bar and in words (it used to be the big figure).
          meter = breathFraction();
          meterKind = 'breath';
          unit = units + ' · BREATH ' + Math.round(meter * 100) + '%';
        }
      }
      // The assists' lamps (driving.js): road vehicles only.
      const assists = c ? drivingAssistStates(c) : null;
      box.classList.toggle('assists', !!assists);
      if (assists) {
        const signature = assists.abs + assists.esc + assists.tcs;
        if (signature !== hudSeen.assists) {
          hudSeen.assists = signature;
          for (const lamp of getElement('assistLamps').children) {
            const state = assists[lamp.dataset.assist];
            lamp.dataset.state = state;
            lamp.title = lamp.textContent + (state === 'na' ? ': not fitted to this vehicle' : state === 'off' ? ': switched off (Settings · Driving)' : state === 'active' ? ': working' : ': ready');
          }
        }
      }
      const active = !!name;
      getElement('vehicleName').textContent = name || 'ON FOOT';
      getElement('speed').textContent = figure;
      getElement('speedUnit').textContent = unit;
      getElement('carFill').style.width = meter === null ? '0%' : clamp(meter * 100, 0, 100).toFixed(1) + '%';
      box.classList.toggle('active', active);
      box.classList.toggle('no-meter', meter === null);
      box.classList.toggle('breath', meterKind === 'breath');
      box.classList.toggle('damaged', meterKind === 'condition' ? meter < 0.3 : meterKind === 'breath' && meter < 0.3);
      box.dataset.mode = c ? 'vehicle' : chute ? 'falling' : swimming ? 'swim' : transitRide ? 'rail' : 'foot';
    }
    /**
     * KEY HINTS
     * The strip follows the context; it is rebuilt only when the context or the
     * bindings change.
     */
    function hudContext() {
      const c = player.car;
      if (player.parachute) return 'chute';
      if (player.coaster) return player.coaster.kind === 'train' ? 'coaster' : 'ride';
      if (!c) return player.swimming ? 'swim' : 'foot';
      if (c.type === 'helicopter') return 'heli';
      if (c.type === 'plane') return 'plane';
      if (isBoat(c)) return 'boat';
      return c.type === 'bicycle' ? 'bike' : 'car';
    }
    const QUICK_KEYS = {
      foot: [['move', 'RUN'], ['walk', 'WALK'], ['interact', 'INTERACT'], ['fire', 'FIRE'], ['help', 'CONTROLS']],
      swim: [['move', 'SWIM'], ['walk', 'EASY STROKE'], ['help', 'CONTROLS']],
      car: [['move', 'DRIVE'], ['handbrake', 'HANDBRAKE'], ['interact', 'EXIT'], ['radioNext', 'STATION'], ['help', 'CONTROLS']],
      bike: [['forward', 'PEDAL'], ['sprint', 'STAND'], ['back', 'BRAKE'], ['interact', 'EXIT']],
      boat: [['move', 'STEER'], ['handbrake', 'SLOW'], ['bail', 'DIVE'], ['interact', 'EXIT']],
      heli: [['ascend', 'RISE'], ['descend', 'DESCEND'], ['move', 'FLY'], ['bail', 'BAIL OUT']],
      plane: [['forward', 'THROTTLE'], ['ascend', 'NOSE UP'], ['descend', 'NOSE DOWN'], ['flapsDown', 'FLAPS'], ['gear', 'GEAR'], ['bail', 'BAIL OUT']],
      chute: [['handbrake', 'OPEN'], ['move', 'STEER']],
      // Sunset Pier rides: E changes the view (and steps off), the radio plays.
      ride: [['interact', 'VIEW'], ['radioPower', 'RADIO'], ['radioNext', 'STATION']],
      // The Falcon has no radio: only the view.
      coaster: [['interact', 'VIEW']],
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
      getElement('radioNext').textContent = keyName('radioNext') + ' · NEXT';
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
    /**
     * INTERACTION PROMPT (#interaction)
     * One owner for the context prompt under the player. During an updateUI()
     * pass every system that has something to say calls offerPrompt(); the
     * last offer of the pass wins (the specific mission prompts are offered
     * after the generic vehicle / payphone one, as before). commitPrompt() at
     * the end of the pass decides what is on screen:
     *
     *   - a new prompt shows at once, with the pop-in, in the middle under the
     *     player;
     *   - the same prompt (same `id`) only has its text refreshed, so a
     *     counter or a car name changing never restarts the animation;
     *   - a different prompt replaces it only after PROMPT_SWAP_AFTER, so two
     *     systems flipping at a range edge cannot strobe it;
     *   - when nobody offers it any more it stays PROMPT_HIDE_GRACE, and at
     *     least PROMPT_MIN_SHOW in all, then fades (visibility, not display,
     *     so the pop-in is never re-triggered by a style flush);
     *   - after PROMPT_DOCK_AFTER it slides out of the middle into a compact
     *     chip under the navigation pill (touch: between the thumb clusters),
     *     and comes back to full size when the action changes or the player
     *     comes newly into range.
     *
     * Keys are named from the bindings (keyName), never spelled literally.
     * Wall-clock time drives it, like the pop boxes.
     */
    /* The HUD's clock in seconds: wall time, plus the time DeadEndCity.simulate()
       has stepped (it runs many updates within one wall-clock moment). */
    let hudClockOffset = 0;
    function hudNow() {
      return performance.now() / 1000 + hudClockOffset;
    }
    const PROMPT_MIN_SHOW = 0.8,
      PROMPT_HIDE_GRACE = 0.35,
      PROMPT_SWAP_AFTER = 0.35,
      PROMPT_DOCK_AFTER = 3;
    let promptOffer = null;
    const promptView = {
      id: null,
      text: '',
      freshAt: 0,
      seenAt: 0,
      docked: false,
    };
    /**
     * Offer the prompt for this pass. `key` is a control action id whose key
     * leads the prompt (null for none), `hold` says "HOLD <key>", `id` keeps
     * the prompt's identity when its text changes (defaults to the text with
     * its numbers taken out).
     */
    function offerPrompt(text, { key = 'interact', hold = false, id } = {}) {
      if (!text) return;
      promptOffer = {
        text,
        key,
        hold,
        id: id || (key || '') + '|' + String(text).replace(/[\d.,:$]+/g, '#'),
      };
    }
    /**
     * Range with hysteresis for anything that shows a prompt: inside once closer
     * than `enter`, outside again only past `exit`, remembered under `key`. The
     * prompt and the action key ask the same question, so they always agree,
     * and a player standing on the edge does not flip it.
     */
    const promptRanges = new Map();
    function withinRange(key, distance, enter, exit = enter * 1.25) {
      const inside = distance < (promptRanges.get(key) ? exit : enter);
      promptRanges.set(key, inside);
      return inside;
    }
    function clearPromptOffer() {
      promptOffer = null;
    }
    function promptKeyText(offer) {
      return offer.key ? (offer.hold ? 'HOLD ' : '') + keyName(offer.key) : '';
    }
    function promptText(offer) {
      const keyText = promptKeyText(offer);
      return (keyText ? keyText + ' ' : '') + offer.text;
    }
    /* The key cap and the words, as text nodes (place names never become markup). */
    function renderPrompt(el, offer) {
      const keyText = promptKeyText(offer),
        words = document.createElement('span');
      words.textContent = offer.text;
      if (keyText) {
        const cap = document.createElement('kbd');
        cap.textContent = keyText;
        el.replaceChildren(cap, words);
      } else el.replaceChildren(words);
    }
    function commitPrompt() {
      const el = getElement('interaction'),
        now = hudNow(),
        view = promptView,
        offer = gameMode === 'play' ? promptOffer : null;
      if (offer) {
        const text = promptText(offer);
        if (view.id === null || (offer.id !== view.id && now - view.freshAt >= PROMPT_SWAP_AFTER)) {
          // A new action (or newly in range): full size in the middle, pop in.
          view.id = offer.id;
          view.freshAt = now;
          view.docked = false;
          view.text = text;
          renderPrompt(el, offer);
          // Jump to the middle without sliding, then pop in (the one place
          // the animation is restarted, on purpose).
          el.classList.add('snap');
          el.classList.remove('docked', 'pop');
          void el.offsetWidth;
          el.classList.remove('snap');
          el.classList.add('show', 'pop');
          el.dataset.prompt = offer.id;
        } else if (offer.id === view.id && text !== view.text) {
          view.text = text;
          renderPrompt(el, offer);
        }
        view.seenAt = now;
      } else if (
        view.id !== null &&
        (gameMode !== 'play' ||
          (now - view.seenAt >= PROMPT_HIDE_GRACE && now - view.freshAt >= PROMPT_MIN_SHOW))
      ) {
        view.id = null;
        el.classList.remove('show');
        delete el.dataset.prompt;
      }
      const dock = view.id !== null && now - view.freshAt >= PROMPT_DOCK_AFTER;
      if (dock !== view.docked) {
        view.docked = dock;
        if (dock) placeDockLine();
        el.classList.toggle('docked', dock);
      }
    }
    /**
     * The docked prompt sits just under the navigation pill, and a settled
     * headline under that (CSS --hud-dock-top). The pill moves with the layout
     * and comes and goes, so it is measured when something docks and when the
     * pill is shown or hidden, not every pass.
     */
    let dockNavShown = null;
    function placeDockLine() {
      const nav = getElement('navigation'),
        shown = nav.style.display !== 'none',
        box = shown ? nav.getBoundingClientRect() : null;
      dockNavShown = dockLineKey();
      let bottom = box && box.height ? box.bottom : 12;
      // In an aircraft: below the heading strip and its warning line.
      if (flightHud.shown) bottom = Math.max(bottom, flightHud.root.querySelector('.fh-top').getBoundingClientRect().bottom);
      const root = document.documentElement.style;
      root.setProperty('--hud-dock-top', Math.round(bottom + 8) + 'px');
      // Touch: above the column of action buttons on the right.
      if (document.body.classList.contains('touch-mode')) {
        const buttons = [...document.querySelectorAll('.touch-actions button')]
          .map((button) => button.getBoundingClientRect())
          .filter((r) => r.width > 0);
        if (buttons.length) {
          const top = Math.min(...buttons.map((r) => r.top)),
            right = Math.max(...buttons.map((r) => r.right));
          root.setProperty('--touch-dock-top', Math.round(top - 8) + 'px');
          root.setProperty('--touch-dock-right', Math.round(Math.max(8, innerWidth - right)) + 'px');
        }
      }
    }
    function dockLineKey() {
      return (
        (getElement('navigation').style.display !== 'none' ? 'nav' : '') +
        (flightHud.shown ? (hudState.flightHud ? '|flight' : '|warnings') : '')
      );
    }
    function watchDockLine() {
      if (dockLineKey() !== dockNavShown && (promptView.docked || getElement('announcement').classList.contains('docked')))
        placeDockLine();
    }
