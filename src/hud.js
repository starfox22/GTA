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
     *               GPS setting draws the road route on it (navigation.js). The
     *               mouse wheel and a two-finger pinch zoom it (MINIMAP_ZOOM_MIN..MAX,
     *               never the street camera). Both are saved in localStorage
     *               under 'dead-end-city-hud'.
     *   FLIGHT HUD  Instruments framing the aircraft while flying (below).
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
      // Faster than anything on foot can go (a deck under way tops out far below).
      if (raw > 80 * KMH) return;
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
      if (player.coaster) return 'ride';
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
    /* What the prompt shows, for DeadEndCity.promptState(). */
    function promptReport() {
      return {
        visible: promptView.id !== null,
        text: promptView.id !== null ? promptView.text : '',
        id: promptView.id,
        docked: promptView.docked,
        age: promptView.id !== null ? +(hudNow() - promptView.freshAt).toFixed(2) : 0,
        offered: promptOffer ? promptOffer.text : null,
      };
    }
    /**
     * CENTRE CARDS
     * The headline card (#announcement) and, in touch mode, the toast settle
     * after CARD_SETTLE_AFTER seconds on screen: the headline slides up and
     * shrinks out of the middle, the touch toast dims. WASTED / BUSTED stay
     * put (the round is over). announce() and tell() (game.js) reset them.
     */
    const CARD_SETTLE_AFTER = 3;
    const centreCards = { announceAt: 0, toastAt: 0 };
    function freshAnnouncement() {
      centreCards.announceAt = hudNow();
      getElement('announcement').classList.remove('docked');
    }
    function freshToast() {
      centreCards.toastAt = hudNow();
      getElement('toast').classList.remove('settled');
    }
    function settleCentreCards() {
      const now = hudNow(),
        card = getElement('announcement'),
        toastBox = getElement('toast'),
        roundOver = document.body.classList.contains('wasted') || document.body.classList.contains('busted');
      const settle = card.classList.contains('show') && !roundOver && now - centreCards.announceAt >= CARD_SETTLE_AFTER;
      if (settle && !card.classList.contains('docked')) placeDockLine();
      card.classList.toggle('docked', settle);
      toastBox.classList.toggle(
        'settled',
        toastBox.classList.contains('show') && now - centreCards.toastAt >= CARD_SETTLE_AFTER,
      );
    }
    /**
     * SNIPER WARNING
     * While a rooftop sniper locks on (combat-rules.js sniperThreat), the screen
     * edge toward the shooter glows red, stronger as the lock closes. The
     * direction is taken on screen (the camera is tilted), or on the map without
     * the 3D view. Never shown while the snipers are switched off
     * (swat.js SNIPERS_ENABLED); the police helicopter no longer shoots.
     */
    function updateSniperWarning() {
      const box = getElement('sniperWarning'),
        on = SNIPERS_ENABLED && gameMode === 'play' && gameTime - sniperThreat.at < 0.25 && sniperThreat.aim > 0;
      box.classList.toggle('on', on);
      if (!on) return;
      let dx = sniperThreat.x - player.x,
        dy = sniperThreat.y - player.y;
      if (city3D) {
        const from = city3D.project(player.x, player.y, entityElevation(player) + 20),
          to = city3D.project(sniperThreat.x, sniperThreat.y, sniperThreat.altitude + 20);
        if (Number.isFinite(to.x) && Number.isFinite(to.y) && Math.hypot(to.x - from.x, to.y - from.y) > 1) {
          dx = to.x - from.x;
          dy = to.y - from.y;
        }
      }
      const a = Math.atan2(dy, dx),
        c = Math.cos(a),
        s = Math.sin(a),
        k = 1 / Math.max(Math.abs(c), Math.abs(s));
      box.style.setProperty('--sniper-x', (50 + 50 * c * k).toFixed(1) + '%');
      box.style.setProperty('--sniper-y', (50 + 50 * s * k).toFixed(1) + '%');
      box.style.setProperty('--sniper-aim', (0.35 + 0.65 * sniperThreat.aim).toFixed(2));
    }
    /* Called at the end of updateUI(). */
    function updateHud() {
      commitPrompt();
      updateSniperWarning();
      settleCentreCards();
      watchDockLine();
      updateFlightHud();
      watchWeaponBox();
      watchRadioBox();
      updateHudPops();
      renderQuickKeys();
      getElement('bottom').dataset.context = hudContext();
    }
    /**
     * FLIGHT HUD
     * In an aircraft (flightData(), aviation.js) a glass-cockpit HUD frames the
     * aircraft without covering it: an attitude indicator (pitch ladder, bank
     * scale), the airspeed tape with its stall band, and the power lever / engine
     * power, flaps and gear on the left; the altitude tape with the ground band
     * and a vertical-speed scale, AGL, vertical speed and g on the right; a
     * heading strip with the objective's bearing above; and STALL / GEAR / PULL
     * UP warnings under it. The helicopter gets the slim version (no attitude,
     * flaps or gear; ROTOR for power). The instruments are 2D canvases redrawn
     * every frame (updateFlightHud, from the game loop); showing and hiding is a
     * CSS transition on #flightHud.on.
     */
    const FLIGHT_HUD_FONT = "'Helvetica Neue', Arial, Helvetica, sans-serif",
      FH_LINE = '#e9efe6',
      FH_ACCENT = '#7fe3ee',
      FH_GOLD = '#e2c897',
      FH_DANGER = '#f08672',
      FH_PANEL = 'rgba(11, 16, 21, 0.62)';
    const flightHud = {
      root: getElement('flightHud'),
      shown: false,
      canvases: {},
      text: {},
    };
    // Canvases are sized once for the device pixel ratio; drawing is in CSS pixels.
    for (const [key, id, width, height] of [
      ['attitude', 'fhAttitude', 124, 124],
      ['speed', 'fhSpeed', 92, 200],
      ['altitude', 'fhAltitude', 124, 200],
      ['heading', 'fhHeading', 352, 34],
    ]) {
      const canvasElement = getElement(id),
        ratio = Math.min(2, window.devicePixelRatio || 1);
      canvasElement.width = Math.round(width * ratio);
      canvasElement.height = Math.round(height * ratio);
      canvasElement.style.width = width + 'px';
      canvasElement.style.height = height + 'px';
      const context = canvasElement.getContext('2d');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      flightHud.canvases[key] = { context, width, height };
    }
    for (const id of ['fhPower', 'fhPowerLabel', 'fhPowerFill', 'fhThrottleMark', 'fhFlaps', 'fhGear', 'fhAgl', 'fhVs', 'fhG', 'fhWarning'])
      flightHud.text[id] = getElement(id);
    function fhSetText(id, value) {
      const el = flightHud.text[id];
      if (el.textContent !== value) el.textContent = value;
    }
    function fhRoundedRect(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }
    /* A vertical tape: `value` at the middle, `scale` pixels per unit, a tick every
       `minor`, a label every `major`; `side` is where the readout points ('right'
       for the airspeed on the left of the screen, 'left' for the altitude). */
    function drawFlightTape(g, w, h, value, scale, minor, major, side, format, bands) {
      g.clearRect(0, 0, w, h);
      g.save();
      fhRoundedRect(g, 0, 0, w, h, 9);
      g.fillStyle = FH_PANEL;
      g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.11)';
      g.lineWidth = 1;
      g.stroke();
      g.clip();
      const mid = h / 2,
        edge = side === 'right' ? w : 0,
        dir = side === 'right' ? -1 : 1,
        valueAt = (v) => mid - (v - value) * scale;
      // Coloured bands along the pointer edge (stall, ground).
      for (const band of bands || []) {
        const top = clamp(valueAt(band.to), -10, h + 10),
          bottom = clamp(valueAt(band.from), -10, h + 10);
        if (bottom <= top) continue;
        g.fillStyle = band.color;
        g.fillRect(side === 'right' ? w - band.width : 0, top, band.width, bottom - top);
      }
      const span = h / 2 / scale,
        first = Math.floor((value - span) / minor) * minor;
      g.font = '600 11px ' + FLIGHT_HUD_FONT;
      g.textBaseline = 'middle';
      g.textAlign = side === 'right' ? 'right' : 'left';
      for (let v = first; v <= value + span + minor; v += minor) {
        const y = valueAt(v),
          isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        g.strokeStyle = isMajor ? FH_LINE : 'rgba(233, 239, 230, 0.55)';
        g.lineWidth = isMajor ? 1.4 : 1;
        g.beginPath();
        g.moveTo(edge, y);
        g.lineTo(edge + dir * (isMajor ? 12 : 7), y);
        g.stroke();
        const label = isMajor ? format(v) : '';
        if (label) {
          g.fillStyle = FH_LINE;
          g.fillText(label, edge + dir * 17, y);
        }
      }
      // Fade the ends so the scale reads as a drum.
      const fade = g.createLinearGradient(0, 0, 0, h);
      fade.addColorStop(0, 'rgba(11, 16, 21, 0.85)');
      fade.addColorStop(0.18, 'rgba(11, 16, 21, 0)');
      fade.addColorStop(0.82, 'rgba(11, 16, 21, 0)');
      fade.addColorStop(1, 'rgba(11, 16, 21, 0.85)');
      g.fillStyle = fade;
      g.fillRect(0, 0, w, h);
      g.restore();
      // The readout box, pointing at the aircraft.
      const boxW = w - 16,
        boxH = 28,
        boxX = side === 'right' ? 4 : 12,
        tip = side === 'right' ? w : 0;
      g.save();
      g.beginPath();
      if (side === 'right') {
        g.moveTo(boxX, mid - boxH / 2);
        g.lineTo(boxX + boxW - 2, mid - boxH / 2);
        g.lineTo(tip, mid);
        g.lineTo(boxX + boxW - 2, mid + boxH / 2);
        g.lineTo(boxX, mid + boxH / 2);
      } else {
        g.moveTo(boxX + boxW, mid - boxH / 2);
        g.lineTo(boxX + 2, mid - boxH / 2);
        g.lineTo(tip, mid);
        g.lineTo(boxX + 2, mid + boxH / 2);
        g.lineTo(boxX + boxW, mid + boxH / 2);
      }
      g.closePath();
      g.fillStyle = '#081015';
      g.fill();
      g.strokeStyle = FH_ACCENT;
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.font = '700 17px ' + FLIGHT_HUD_FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(format(value, true), boxX + boxW / 2 + (side === 'right' ? -3 : 3), mid + 1);
      g.restore();
    }
    function drawAttitude(g, size, pitchDeg, bankDeg) {
      const r = size / 2,
        pxPerDeg = 2.3;
      g.clearRect(0, 0, size, size);
      g.save();
      g.beginPath();
      g.arc(r, r, r - 1, 0, TAU);
      g.clip();
      g.translate(r, r);
      g.rotate((-bankDeg * Math.PI) / 180);
      const horizon = clamp(pitchDeg, -40, 40) * pxPerDeg;
      const sky = g.createLinearGradient(0, -size, 0, horizon);
      sky.addColorStop(0, '#1f4f7c');
      sky.addColorStop(1, '#6fb3dc');
      g.fillStyle = sky;
      g.fillRect(-size, -size * 1.5, size * 2, size * 1.5 + horizon);
      const ground = g.createLinearGradient(0, horizon, 0, size);
      ground.addColorStop(0, '#8a6139');
      ground.addColorStop(1, '#3a2716');
      g.fillStyle = ground;
      g.fillRect(-size, horizon, size * 2, size * 1.5);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-size, horizon);
      g.lineTo(size, horizon);
      g.stroke();
      // Pitch ladder every 5 degrees, labelled every 10.
      g.font = '700 9px ' + FLIGHT_HUD_FONT;
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.lineWidth = 1.1;
      for (let d = -30; d <= 30; d += 5) {
        if (!d) continue;
        const y = horizon - d * pxPerDeg;
        if (Math.abs(y) > r - 8) continue;
        const half = d % 10 ? 9 : 18;
        g.beginPath();
        g.moveTo(-half, y);
        g.lineTo(half, y);
        g.stroke();
        if (!(d % 10)) {
          g.textAlign = 'right';
          g.fillText(String(Math.abs(d)), -half - 3, y);
          g.textAlign = 'left';
          g.fillText(String(Math.abs(d)), half + 3, y);
        }
      }
      g.restore();
      // Bank scale (fixed) and pointer (turns with the horizon).
      g.save();
      g.translate(r, r);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(0, 0, r - 12, (-150 * Math.PI) / 180, (-30 * Math.PI) / 180);
      g.stroke();
      for (const d of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
        const a = ((d - 90) * Math.PI) / 180,
          long = d % 30 === 0;
        g.beginPath();
        g.moveTo(Math.cos(a) * (r - 12), Math.sin(a) * (r - 12));
        g.lineTo(Math.cos(a) * (r - (long ? 3 : 7)), Math.sin(a) * (r - (long ? 3 : 7)));
        g.stroke();
      }
      g.rotate((-bankDeg * Math.PI) / 180);
      g.fillStyle = Math.abs(bankDeg) > 45 ? FH_DANGER : FH_GOLD;
      g.beginPath();
      g.moveTo(0, -r + 13);
      g.lineTo(-5, -r + 22);
      g.lineTo(5, -r + 22);
      g.closePath();
      g.fill();
      g.restore();
      // The aircraft symbol, fixed.
      g.save();
      g.translate(r, r);
      g.strokeStyle = '#0b0f12';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const wings = () => {
        g.beginPath();
        g.moveTo(-34, 0);
        g.lineTo(-13, 0);
        g.lineTo(-7, 6);
        g.moveTo(34, 0);
        g.lineTo(13, 0);
        g.lineTo(7, 6);
        g.stroke();
      };
      wings();
      g.strokeStyle = FH_GOLD;
      g.lineWidth = 2.6;
      wings();
      g.fillStyle = FH_GOLD;
      g.beginPath();
      g.arc(0, 0, 2.6, 0, TAU);
      g.fill();
      g.restore();
      g.beginPath();
      g.arc(r, r, r - 1, 0, TAU);
      g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      g.lineWidth = 1.5;
      g.stroke();
    }
    function drawHeadingStrip(g, w, h, heading, bearing) {
      g.clearRect(0, 0, w, h);
      g.save();
      fhRoundedRect(g, 0, 6, w, h - 6, 8);
      g.fillStyle = FH_PANEL;
      g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.11)';
      g.stroke();
      g.clip();
      const pxPerDeg = 3.1,
        mid = w / 2,
        names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const first = Math.floor((heading - mid / pxPerDeg) / 5) * 5;
      for (let d = first; d <= heading + mid / pxPerDeg + 5; d += 5) {
        const x = mid + (d - heading) * pxPerDeg,
          compass = ((d % 360) + 360) % 360,
          major = compass % 15 === 0;
        g.strokeStyle = major ? FH_LINE : 'rgba(233, 239, 230, 0.5)';
        g.lineWidth = major ? 1.3 : 1;
        g.beginPath();
        g.moveTo(x, h);
        g.lineTo(x, h - (major ? 8 : 5));
        g.stroke();
        if (compass % 45 === 0 || compass % 30 === 0) {
          const name = names[compass];
          g.font = (name ? '800 12px ' : '600 10px ') + FLIGHT_HUD_FONT;
          g.fillStyle = name ? FH_GOLD : FH_LINE;
          g.fillText(name || String(compass / 10).padStart(2, '0'), x, h - 16);
        }
      }
      // The objective's bearing, a gold marker (clamped to the ends when off-strip).
      if (bearing !== null) {
        const off = ((bearing - heading + 540) % 360) - 180,
          x = clamp(mid + off * pxPerDeg, 8, w - 8);
        g.fillStyle = FH_GOLD;
        g.beginPath();
        g.moveTo(x, h - 3);
        g.lineTo(x - 5, h - 10);
        g.lineTo(x + 5, h - 10);
        g.closePath();
        g.fill();
      }
      const fade = g.createLinearGradient(0, 0, w, 0);
      fade.addColorStop(0, 'rgba(11, 16, 21, 0.9)');
      fade.addColorStop(0.16, 'rgba(11, 16, 21, 0)');
      fade.addColorStop(0.84, 'rgba(11, 16, 21, 0)');
      fade.addColorStop(1, 'rgba(11, 16, 21, 0.9)');
      g.fillStyle = fade;
      g.fillRect(0, 0, w, h);
      g.restore();
      // Lubber box with the heading.
      g.save();
      fhRoundedRect(g, mid - 25, 0, 50, 21, 5);
      g.fillStyle = '#081015';
      g.fill();
      g.strokeStyle = FH_ACCENT;
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.font = '700 13px ' + FLIGHT_HUD_FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(Math.round(heading) % 360).padStart(3, '0') + '°', mid, 11);
      g.fillStyle = FH_ACCENT;
      g.beginPath();
      g.moveTo(mid, 26);
      g.lineTo(mid - 4, 21);
      g.lineTo(mid + 4, 21);
      g.closePath();
      g.fill();
      g.restore();
    }
    // Altitude tape plus a vertical-speed scale down its right edge (+-10 m/s).
    function drawAltitudeTape(g, w, h, data) {
      const tapeW = w - 14,
        ground = data.altitude - data.agl;
      drawFlightTape(g, tapeW, h, data.altitude, 0.8, 10, 50, 'left', (v, box) => (box || v >= 0 ? String(Math.round(v)) : ''), [
        { from: ground - 400, to: ground, color: 'rgba(160, 110, 60, 0.55)', width: 10 },
      ]);
      g.save();
      const x = tapeW + 4,
        mid = h / 2,
        range = 10,
        pxPer = (h / 2 - 16) / range;
      g.clearRect(tapeW, 0, w - tapeW, h);
      g.strokeStyle = 'rgba(233, 239, 230, 0.5)';
      g.lineWidth = 1;
      for (const v of [-10, -5, 0, 5, 10]) {
        const y = mid - v * pxPer;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (v ? 5 : 9), y);
        g.stroke();
      }
      const vs = clamp(data.vs, -range, range),
        y = mid - vs * pxPer;
      g.strokeStyle = data.vs < -8 && data.agl < 150 ? FH_DANGER : FH_ACCENT;
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + 2, mid);
      g.lineTo(x + 2, y);
      g.stroke();
      g.beginPath();
      g.moveTo(x - 1, y);
      g.lineTo(x + 9, y);
      g.stroke();
      g.restore();
    }
    function objectiveBearing() {
      const target = userWaypoint || objective();
      if (!target) return null;
      return (((headingBetween(player, target) * 180) / Math.PI + 90) % 360 + 360) % 360;
    }
    function updateFlightHud() {
      const c = player.car,
        data = (gameMode === 'play' || gameMode === 'pause') && c?.hp > 0 ? flightData(c) : null,
        show = !!data;
      if (show !== flightHud.shown) {
        flightHud.shown = show;
        flightHud.root.classList.toggle('on', show);
        flightHud.root.setAttribute('aria-hidden', String(!show));
      }
      if (!show) return;
      const heli = data.type === 'helicopter';
      // Instruments off: only the warning line below is kept up to date.
      if (hudState.flightHud) drawFlightInstruments(data, heli);
      // One warning at a time, the most urgent first.
      const pullUp = data.agl < 90 && data.vs < -14 && data.agl > 2,
        warning = data.stall
          ? 'STALL'
          : pullUp
            ? 'PULL UP'
            : data.gearWarning
              ? 'GEAR'
              : data.stallWarning
                ? 'STALL WARNING'
                : data.hp < 0.3
                  ? 'ENGINE DAMAGE'
                  : '';
      // On a runway with nothing more urgent: which runway and how much is left.
      const runway = !warning && data.runway ? 'RWY ' + data.runway.designation + ' · ' + data.runway.remaining + ' M LEFT' : '';
      const box = flightHud.text.fhWarning;
      fhSetText('fhWarning', warning || runway);
      box.classList.toggle('show', !!(warning || runway));
      box.classList.toggle('caution', warning === 'STALL WARNING' || warning === 'ENGINE DAMAGE' || !!runway);
    }
    function drawFlightInstruments(data, heli) {
      flightHud.root.classList.toggle('heli', heli);
      const { attitude, speed, altitude, heading } = flightHud.canvases;
      if (!heli) drawAttitude(attitude.context, attitude.width, data.pitch, data.bank);
      drawFlightTape(
        speed.context,
        speed.width,
        speed.height,
        kmhReading(data.airspeed),
        1.5,
        10,
        20,
        'right',
        // No labels below zero on the scale; the readout never shows a negative.
        (v, box) => (box ? String(Math.max(0, Math.round(v))) : v < 0 ? '' : String(Math.round(v))),
        heli
          ? []
          : [
              { from: -100, to: kmhReading(data.stallSpeed), color: 'rgba(240, 134, 114, 0.85)', width: 6 },
              { from: kmhReading(data.stallSpeed), to: kmhReading(data.stallSpeed) * 1.1, color: 'rgba(226, 200, 151, 0.85)', width: 6 },
            ],
      );
      drawAltitudeTape(altitude.context, altitude.width, altitude.height, data);
      drawHeadingStrip(heading.context, heading.width, heading.height, data.heading, objectiveBearing());
      // Power: the fill is the engine, the tick is the lever.
      fhSetText('fhPowerLabel', heli ? 'ROTOR' : 'PWR');
      fhSetText('fhPower', Math.round(data.power * 100) + '%');
      flightHud.text.fhPowerFill.style.width = (data.power * 100).toFixed(1) + '%';
      flightHud.text.fhThrottleMark.style.left = (data.throttle * 100).toFixed(1) + '%';
      fhSetText('fhAgl', Math.round(data.agl) + ' m');
      fhSetText('fhVs', (data.vs >= 0 ? '+' : '−') + Math.abs(data.vs).toFixed(1) + ' m/s');
      fhSetText('fhG', data.g.toFixed(1) + ' g');
      if (!heli) {
        const flapsMoving = Math.abs(data.flapPos - ['UP', '1', '2', 'FULL'].indexOf(data.flaps) / 3) > 0.02,
          flaps = flightHud.text.fhFlaps,
          gear = flightHud.text.fhGear;
        fhSetText('fhFlaps', 'FLAPS ' + data.flaps);
        flaps.classList.toggle('set', data.flaps !== 'UP' && !flapsMoving);
        flaps.classList.toggle('moving', flapsMoving);
        fhSetText('fhGear', data.gear === 'DOWN' ? 'GEAR ▼' : data.gear === 'UP' ? 'GEAR ▲' : 'GEAR ···');
        gear.classList.toggle('set', data.gear === 'DOWN');
        gear.classList.toggle('moving', data.gear === 'TRANSIT' && !data.gearWarning);
        gear.classList.toggle('alert', data.gearWarning);
      }
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
