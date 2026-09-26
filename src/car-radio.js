    // BEGIN SUBSYSTEM: src/car-radio.js — Vehicle radio stations
    /**
     * Vehicle radio stations
     * Source: src/car-radio.js
     * Scope: shared game closure.
     * Six stations of licensed tracks, selection, playback and saved settings;
     * the same radio box on the title menu (TITLE RADIO).
     */
    /* In-vehicle music stations; a single streaming decoder keeps memory bounded.
       Oddball is preset one: it is the station the dashboard comes up on. New stations
       go on the end so a saved preset index keeps naming the same station.
       `tracks` are keys of ASSETS.music played in order; a station with more than one
       moves on to its next track when one ends and remembers where it was.
       `lead` is how far into the file playback starts and loops back to. MP3 decoders
       need a frame of priming and these files carry no gapless metadata, so the first
       few hundredths of a second decode as noise. Starting past it, and ramping the
       gain from silence, removes the click on both the first play and every loop.
       `tagline` is the DJ line the radio box shows for a few seconds after tuning in;
       it is text only: a change of station cuts straight to the new music. */
    const MUSIC_STATIONS = [
      {
        id: 'oddball',
        name: 'ODDBALL 99.3',
        genre: 'After-hours mix',
        preset: 'ODDBALL',
        tracks: ['oddball'],
        lead: 0.34,
        tagline: 'Oddball 99.3 · music for people who drive at night',
      },
      {
        id: 'synth',
        name: 'NEON 88.7',
        genre: '80s synth',
        preset: 'NEON',
        tracks: ['synth'],
        lead: 0.06,
        tagline: 'Neon 88.7 · the future, as seen from 1985',
      },
      {
        id: 'rock',
        name: 'RIOT 104.5',
        genre: 'Rock',
        preset: 'RIOT',
        tracks: ['rock'],
        lead: 0.06,
        tagline: 'Riot 104.5 · turn it up, the neighbours are armed anyway',
      },
      {
        id: 'velvet',
        name: 'VELVET 91.5',
        genre: 'Lounge jazz',
        preset: 'VELVET',
        tracks: ['lounge-martini', 'lounge-heists'],
        lead: 0.06,
        tagline: 'Velvet 91.5 · smooth jazz for smooth operators',
      },
      {
        id: 'palms',
        name: 'PALMS 95.9',
        genre: 'Island grooves',
        preset: 'PALMS',
        tracks: ['island-dub', 'island-colada'],
        lead: 0.06,
        tagline: 'Palms 95.9 · island time, all the time',
      },
      {
        id: 'block',
        name: 'BLOCK 101.7',
        genre: 'Lo-fi beats',
        preset: 'BLOCK',
        tracks: ['lofi-hooptie', 'lofi-freeway'],
        lead: 0.06,
        tagline: 'Block 101.7 · beats to cruise and lie low to',
      },
    ];
    const RADIO_FADE_IN = 3.6,
      RADIO_TAGLINE_MS = 4200,
      RADIO_PARTY = 'party';
    let carRadioEnabled = true,
      carRadioStation = 0,
      // Track position per station id, so each station picks up where it left off.
      carRadioTrack = {},
      carRadioPlayer = null,
      // What the player element holds: RADIO_PARTY, or '<station id>/<track key>'.
      carRadioLoaded = null,
      carRadioPending = false,
      carRadioBlocked = false,
      carRadioUnavailable = false,
      carRadioRevision = 0,
      carRadioLead = MUSIC_STATIONS[0].lead,
      carRadioGain = 0,
      // performance.now() time until which the station's tagline shows.
      carRadioTaglineUntil = 0,
      carRadioTaglineTimer = null;
    /**
     * TITLE RADIO
     * The same radio box plays on the title menu, and behind the settings,
     * mission select, help and credits screens opened from it: docked on the
     * right of the screen and open (the box moves into #menu, so the screens
     * opened over the title cover it). The title has its own station, NEON 88.7
     * until the player tunes another there (saved as `titleStation`), and its
     * own power switch for the visit; Settings · Audio · Radio on title screen
     * (titleRadioEnabled, saved by settings.js) hides it. The volume is the one
     * radio level (settings.radioVolume: the knob, the mute and the Settings
     * slider).
     *
     * Browsers refuse to start sound before the page has had a user gesture:
     * the first attempt is made at once and, while it is refused, the box says
     * "Click anywhere to play radio" and the first click, tap or key anywhere
     * starts it (titleRadioGesture). A refusal throws nothing: play()'s promise
     * is caught and only marks the radio blocked.
     *
     * Leaving the title for the game hands over (setTitleRadio): in a vehicle
     * with the radio on, the in-car radio carries on with the same station and
     * track without a break; otherwise the music fades out over
     * RADIO_HANDOVER_MS (wall-clock time, so a slow frame rate does not stretch
     * it) and pauses. Back on the title it resumes.
     */
    const TITLE_RADIO_STATION = 1, // NEON 88.7
      RADIO_HANDOVER_MS = 1500,
      // The element's level on the title before the fade-in and volumeScale('radio').
      RADIO_TITLE_LEVEL = 0.27;
    let titleRadioStation = TITLE_RADIO_STATION,
      // Settings · Audio · Radio on title screen (saved with the settings, settings.js).
      titleRadioEnabled = true,
      titleRadioPower = true,
      // Whether the box is on the title now (syncCarRadio keeps it up to date).
      titleRadioShown = false,
      // The handover's fade-out while it lasts: { from: element volume, start: ms }.
      carRadioFade = null,
      carRadioFadeTimer = null;
    try {
      const pref = JSON.parse(localStorage.getItem('dead-end-city-radio-v2'));
      if (pref && typeof pref === 'object') {
        carRadioEnabled = pref.enabled !== false;
        if (Number.isInteger(pref.station))
          carRadioStation = clamp(pref.station, 0, MUSIC_STATIONS.length - 1);
        for (const station of MUSIC_STATIONS)
          if (Number.isInteger(pref.tracks?.[station.id]))
            carRadioTrack[station.id] = clamp(pref.tracks[station.id], 0, station.tracks.length - 1);
        if (Number.isInteger(pref.titleStation))
          titleRadioStation = clamp(pref.titleStation, 0, MUSIC_STATIONS.length - 1);
      }
    } catch {}
    function saveCarRadio() {
      try {
        localStorage.setItem(
          'dead-end-city-radio-v2',
          JSON.stringify({
            enabled: carRadioEnabled,
            station: carRadioStation,
            tracks: carRadioTrack,
            titleStation: titleRadioStation,
          }),
        );
      } catch {}
    }
    /* The station the box shows and plays: the title's own on the title menu. */
    function radioStationIndex() {
      return titleRadioShown ? titleRadioStation : carRadioStation;
    }
    function stationTrackKey(index = radioStationIndex()) {
      const station = MUSIC_STATIONS[index];
      return station.tracks[(carRadioTrack[station.id] || 0) % station.tracks.length];
    }
    function radioTrack() {
      return typeof ASSETS !== 'undefined' ? ASSETS.music?.[stationTrackKey()] : null;
    }
    function seekCarRadioLead() {
      if (!carRadioPlayer || !(carRadioLead > 0)) return;
      const apply = () => {
        try {
          if (carRadioPlayer.currentTime < carRadioLead) carRadioPlayer.currentTime = carRadioLead;
        } catch {}
      };
      if (carRadioPlayer.readyState >= 1) apply();
      else
        carRadioPlayer.addEventListener('loadedmetadata', apply, {
          once: true,
        });
    }
    function carRadioReady() {
      if (carRadioPlayer) return true;
      if (typeof Audio === 'undefined') return false;
      carRadioPlayer = getElement('carRadioAudio');
      carRadioPlayer.preload = 'auto';
      // Looping is handled here rather than by the element so the seam skips the
      // priming frames as well, and so every restart fades up from silence.
      carRadioPlayer.loop = false;
      carRadioPlayer.volume = 0;
      carRadioPlayer.addEventListener('ended', () => {
        carRadioGain = 0;
        const station = MUSIC_STATIONS[radioStationIndex()];
        if (station.tracks.length > 1 && carRadioLoaded?.startsWith(station.id + '/')) {
          // Next track in the station's rotation; syncCarRadio loads and starts it.
          carRadioTrack[station.id] = ((carRadioTrack[station.id] || 0) + 1) % station.tracks.length;
          saveCarRadio();
          carRadioLoaded = null;
          updateCarRadioUI();
          return;
        }
        seekCarRadioLead();
        try {
          carRadioPlayer.currentTime = carRadioLead;
        } catch {}
        carRadioPlayer.play().catch(() => {});
      });
      carRadioPlayer.addEventListener('error', () => {
        carRadioPending = false;
        carRadioBlocked = true;
        carRadioUnavailable = true;
        updateCarRadioUI();
      });
      return true;
    }
    /* Somewhere with a radio: a working vehicle (a bicycle has none), or a Sunset
       Pier ride, the Falcon's train or an Eye capsule (themepark.js), which play
       the same stations through the same player. */
    function radioAboard() {
      // A hired cab has the driver's radio on (taxi.js), and it plays on through
      // a skipped ride's fade (ride-skip.js ducks the effects bus, not the radio).
      return gameMode === 'play' && ((player.car?.hp > 0 && !ridingBicycle()) || !!player.coaster || !!taxiRide);
    }
    /* Whether the radio is on where the player is. On the Falcon it starts off
       every ride and the switch (N / B, a click) holds for that ride only
       (`player.coaster.radio`, themepark.js); everywhere else it is the saved
       carRadioEnabled. */
    function radioSwitchedOn() {
      if (titleRadioShown) return titleRadioPower;
      return player.coaster?.kind === 'train' ? !!player.coaster.radio : carRadioEnabled;
    }
    function setRadioSwitch(on) {
      if (titleRadioShown) titleRadioPower = on;
      else if (player.coaster?.kind === 'train') player.coaster.radio = on;
      else carRadioEnabled = on;
    }
    const titleMenuBox = getElement('menu'),
      // Where the radio box lives in the HUD, to put it back after the title.
      radioBoxHome = { parent: getElement('carRadio').parentNode, next: getElement('carRadio').nextSibling };
    function titleRadioWanted() {
      return titleRadioEnabled && gameMode !== 'play' && !titleMenuBox.classList.contains('hidden');
    }
    /* The box onto the title menu (docked right, open) or back into the HUD,
       and the handover when the title closes. */
    function setTitleRadio(on) {
      titleRadioShown = on;
      const box = getElement('carRadio');
      box.classList.toggle('title-radio', on);
      if (on) {
        carRadioFade = null;
        titleMenuBox.append(box);
      } else {
        radioBoxHome.parent.insertBefore(box, radioBoxHome.next);
        // A refusal on the title (no gesture yet) must not keep the car radio
        // waiting for N: the game's first ride tries again.
        if (!carRadioUnavailable) carRadioBlocked = false;
        const playing = !!carRadioPlayer && !carRadioPlayer.paused;
        if (playing && radioAboard() && radioSwitchedOn() && carRadioLoaded !== RADIO_PARTY) {
          // Into a vehicle: its radio carries on with the title's station, no break.
          carRadioStation = titleRadioStation;
          saveCarRadio();
        } else if (playing) {
          carRadioFade = { from: carRadioPlayer.volume, start: performance.now() };
          // Stepped on its own clock: the first frames of play can be slow.
          clearInterval(carRadioFadeTimer);
          carRadioFadeTimer = setInterval(() => {
            syncCarRadio();
            if (!carRadioFade) clearInterval(carRadioFadeTimer);
          }, 40);
        }
      }
      updateCarRadioUI();
    }
    // The title opening or closing (the start buttons, a mission picked, the
    // option) moves the box at once rather than on the next frame.
    new MutationObserver(() => syncCarRadio()).observe(titleMenuBox, { attributes: true, attributeFilter: ['class'] });
    function syncCarRadio(gesture = false, deltaSeconds = 0) {
      const title = titleRadioWanted();
      if (title !== titleRadioShown) {
        // setTitleRadio redraws the box, which syncs again with the new state.
        setTitleRadio(title);
        return;
      }
      const party = gameMode === 'play' && player.roof && !document.hidden,
        riding = radioAboard() && !document.hidden,
        wants = (party || ((riding || (title && !document.hidden)) && radioSwitchedOn())) && soundOn,
        station = MUSIC_STATIONS[radioStationIndex()],
        // The Blue Hour rooftop party always plays the synth track, whatever is tuned.
        loadKey = party ? RADIO_PARTY : station.id + '/' + stationTrackKey(),
        track = party ? (typeof ASSETS !== 'undefined' ? ASSETS.music?.synth : null) : radioTrack();
      if (!wants) {
        if (carRadioPlayer && (!carRadioPlayer.paused || carRadioPending)) {
          // The title's handover: fade out, then pause (a hidden page stops at once).
          if (carRadioFade && !carRadioPlayer.paused && !document.hidden && soundOn) {
            const t = (performance.now() - carRadioFade.start) / RADIO_HANDOVER_MS;
            if (t < 1) {
              carRadioPlayer.volume = clamp(carRadioFade.from * (1 - t) * (1 - t), 0, 1);
              return;
            }
          }
          carRadioFade = null;
          carRadioPlayer.pause();
          carRadioRevision++;
          carRadioPending = false;
          carRadioGain = 0;
        }
        carRadioFade = null;
        return;
      }
      carRadioFade = null;
      if (!track?.src || !carRadioReady()) return;
      if (carRadioLoaded !== loadKey) {
        carRadioRevision++;
        carRadioPending = false;
        carRadioPlayer.pause();
        carRadioLead = party ? 0.06 : station.lead || 0;
        carRadioGain = 0;
        carRadioPlayer.volume = 0;
        carRadioPlayer.src = track.src;
        carRadioLoaded = loadKey;
        carRadioBlocked = false;
        carRadioUnavailable = false;
        seekCarRadioLead();
      }
      const target = title
        ? RADIO_TITLE_LEVEL
        : party
        ? (rooftopJob()?.boss.speech?.length ? 0.055 : 0.18) *
          clamp(1 - distanceBetween(player, roofAt(195, 310)) / 600, 0.35, 1)
        : gameTime < radioUntil || gameTime < (mission?.lineUntil || 0)
          ? 0.11
          : 0.27;
      if (!carRadioPlayer.paused)
        carRadioGain = clamp(carRadioGain + (deltaSeconds || 0.016) * RADIO_FADE_IN, 0, 1);
      carRadioPlayer.volume = clamp(target * carRadioGain * volumeScale('radio'), 0, 1);
      if (gesture) carRadioBlocked = false;
      if (carRadioPlayer.paused && !carRadioPending && !carRadioBlocked) {
        const revision = carRadioRevision;
        carRadioPending = true;
        const attempt = carRadioPlayer.play();
        Promise.resolve(attempt)
          .then(() => {
            if (revision === carRadioRevision) {
              carRadioPending = false;
              carRadioBlocked = false;
            }
          })
          .catch((error) => {
            if (revision !== carRadioRevision) return;
            carRadioPending = false;
            if (error?.name !== 'AbortError') carRadioBlocked = true;
            updateCarRadioUI();
          });
      }
    }
    function tuneCarRadio(index) {
      // The radio box pops open to show the new station, then tucks away (hud.js).
      hudPop('carRadio');
      const next = (index + MUSIC_STATIONS.length) % MUSIC_STATIONS.length,
        changed = next !== radioStationIndex() || !radioSwitchedOn();
      if (titleRadioShown) titleRadioStation = next;
      else carRadioStation = next;
      setRadioSwitch(true);
      carRadioBlocked = false;
      saveCarRadio();
      initAudio();
      if (changed && !player.roof) {
        // Straight to the new station's music (a short fade-up hides the decoder's
        // first frame); the DJ line shows in the radio box, silently.
        carRadioTaglineUntil = performance.now() + RADIO_TAGLINE_MS;
        clearTimeout(carRadioTaglineTimer);
        carRadioTaglineTimer = setTimeout(updateCarRadioUI, carRadioTaglineUntil - performance.now() + 50);
        // Keep the radio box open while the DJ line shows, and a moment after.
        hudPop('carRadio', carRadioTaglineUntil - performance.now() + 1500);
      }
      syncCarRadio(true);
      updateCarRadioUI();
    }
    function toggleCarRadio() {
      hudPop('carRadio');
      if (carRadioBlocked && radioSwitchedOn()) {
        carRadioBlocked = false;
        if (carRadioUnavailable) carRadioLoaded = null;
      } else setRadioSwitch(!radioSwitchedOn());
      saveCarRadio();
      initAudio();
      syncCarRadio(true);
      updateCarRadioUI();
    }
    function updateCarRadioUI() {
      const riding = radioAboard() || titleRadioShown,
        // On the title, a browser that refused to start sound before a gesture.
        waiting = titleRadioShown && carRadioBlocked && !carRadioUnavailable && radioSwitchedOn() && soundOn;
      getElement('carRadio').classList.toggle('hidden', !riding);
      getElement('carRadio').classList.toggle('radio-waiting', waiting);
      const station = MUSIC_STATIONS[radioStationIndex()],
        track = radioTrack();
      getElement('radioStation').textContent = station.name;
      getElement('radioGenre').textContent = station.genre.toUpperCase();
      const on = radioSwitchedOn();
      getElement('radioTrack').textContent = !on
        ? 'Radio off'
        : !soundOn
          ? 'Game sound muted · ' + keyName('mute') + ' to unmute'
          : carRadioUnavailable
            ? 'Track unavailable · ' + keyName('radioPower') + ' to retry'
            : waiting
              ? '♪ ' + (touchEnabled() ? 'Tap' : 'Click') + ' anywhere to play radio'
              : carRadioBlocked
              ? 'Press ' + keyName('radioPower') + ' to start playback'
              : performance.now() < carRadioTaglineUntil
                ? '“' + station.tagline + '”'
                : track
                  ? track.title + ' · ' + track.artist
                  : 'Tuning…';
      getElement('radioPower').textContent = keyName('radioPower') + ' · ' + (on ? 'ON' : 'OFF');
      getElement('radioPower').setAttribute?.('aria-pressed', String(on));
      getElement('carRadio').classList.toggle('radio-off', !on);
      const tuned = radioStationIndex();
      for (let i = 0; i < MUSIC_STATIONS.length; i++) {
        getElement('radioPreset' + i).setAttribute?.('aria-pressed', String(i === tuned));
        getElement('radioPreset' + i).classList.toggle('selected', i === tuned);
      }
      syncCarRadio();
    }
    /* After a click on the box the keys go back where they were: to the game
       canvas in play; on the title to the menu item last selected, so Enter
       still starts the game and the arrows still move through the menu (a
       keyboard press on a radio button keeps its focus there). */
    let titleMenuFocus = null;
    titleMenuBox.addEventListener('focusin', (e) => {
      if (e.target.classList?.contains('menu-item')) titleMenuFocus = e.target;
    });
    function radioFocusBack(e) {
      if (!titleRadioShown) canvas.focus();
      else if (!e || e.detail > 0 || e.pointerType)
        (titleMenuFocus || getElement('startBtn')).focus({ preventScroll: true });
    }
    getElement('radioPower').onclick = (e) => {
      toggleCarRadio();
      radioFocusBack(e);
    };
    getElement('radioNext').onclick = (e) => {
      tuneCarRadio(radioStationIndex() + 1);
      radioFocusBack(e);
    };
    for (let i = 0; i < MUSIC_STATIONS.length; i++)
      getElement('radioPreset' + i).onclick = (e) => {
        tuneCarRadio(i);
        radioFocusBack(e);
      };
    /* TITLE RADIO: the first gesture anywhere starts the refused playback. The
       events are the ones that count as a user activation (a touch counts on
       touchend / pointerup, a mouse on mousedown / pointerdown), listened for
       on the capture phase because the radio's own rows stop theirs. The
       radio's power key and button do it themselves (a press there that
       started the radio here would then switch it off). */
    function titleRadioGesture(e) {
      if (!titleRadioShown || !carRadioBlocked || carRadioUnavailable) return;
      if (e.type === 'keydown' && (e.key === 'Escape' || controlBindings.radioPower.includes(e.code))) return;
      if (e.target?.closest?.('#radioPower')) return;
      initAudio();
      carRadioRevision++;
      carRadioPending = false;
      carRadioBlocked = false;
      syncCarRadio(true);
      updateCarRadioUI();
    }
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'touchend', 'keydown'])
      window.addEventListener(type, titleRadioGesture, true);
    /**
     * RADIO VOLUME
     * A 90s head-unit volume knob in the radio box: a knurled rubber knob with a
     * machined cap inside an arc of twenty amber LED segments (one per 5 steps)
     * over 270 degrees, an LCD readout and the speaker. It sets the same value as
     * Settings · Audio · Radio & music: settings.radioVolume, through
     * setRadioVolume() (settings.js), which redraws the knob through
     * applyVolumes() whoever changed it, and saves it. The speaker mutes (0) and
     * unmutes to the level it had (settings.radioUnmute); so does a double-click
     * on the knob.
     *
     * Turning it: press on the knob and drag. Straight movement counts right and
     * up as louder, left and down as quieter (dx - dy, 1.6 px a step: 160 px
     * sweeps the range; Shift is four times finer). A drag that curves round the
     * centre (its path has turned 50 degrees, in the same sense as it has swept
     * 30 or more round the knob) becomes a turn: from then on the knob follows
     * the pointer's angle one for one (270 degrees = the whole range). The wheel
     * anywhere over the box steps 5, so do the knob's arrow keys (Page Up / Down
     * 10, Home / End) and radioQuieter / radioLouder (, / .) in a vehicle. Each
     * 5-step detent ticks softly on the effects bus.
     *
     * The box floats over the game canvas, whose own listeners fire, aim and
     * zoom, and the window's keydown listener reads the arrows and Space as
     * driving and firing: the row stops its events so none of them reach the
     * game. The pointer is captured and the box held open while a drag lasts.
     */
    const RADIO_VOLUME_STEP = 5,
      // The knob turns clockwise from -135 degrees (0, lower left) to +135 (100).
      KNOB_SWEEP = 270,
      KNOB_LEDS = 20,
      // Straight drags: pixels of (right - up) movement per volume step.
      KNOB_PX_PER_STEP = 1.6,
      KNOB_FINE = 0.25,
      // Movement before a press turns anything, so a click or double-click stays put.
      KNOB_DEAD_ZONE = 3,
      // How far (radians) the path must turn, and sweep round the centre, to be a turn.
      KNOB_CIRCLE_TURN = (50 * Math.PI) / 180,
      KNOB_CIRCLE_SWEEP = (30 * Math.PI) / 180,
      // Volume steps per radian of turn: the pointer and the knob's notch agree.
      KNOB_STEPS_PER_RADIAN = 100 / ((KNOB_SWEEP * Math.PI) / 180),
      // Seven-segment glyphs, segments a..g as bits 0..6.
      LCD_GLYPHS = { 0: 63, 1: 6, 2: 91, 3: 79, 4: 102, 5: 109, 6: 125, 7: 7, 8: 127, 9: 111, O: 63, F: 113, ' ': 0 },
      radioVolumeRow = getElement('radioVolumeRow'),
      radioKnob = getElement('radioKnob'),
      knobLeds = [],
      knobLedState = [],
      lcdSegments = [];
    let radioWheelCarry = 0,
      // The drag under way ({ id, type, from, value, mode, ... }) and the last one's summary.
      knobDrag = null,
      lastKnobDrag = null,
      knobClickAt = 0,
      // What the knob last drew, so a redraw with nothing new writes nothing.
      knobDrawn = '';
    function knobAngle(value) {
      return -KNOB_SWEEP / 2 + (value / 100) * KNOB_SWEEP;
    }
    function lcdReadout(value) {
      return value === 0 ? 'OFF' : String(value).padStart(3, ' ');
    }
    /* The LED arc and the LCD's three digits, built once as SVG. */
    (function buildRadioKnob() {
      const ns = 'http://www.w3.org/2000/svg',
        make = (parent, tag, attributes) => {
          const node = document.createElementNS(ns, tag);
          for (const name in attributes) node.setAttribute(name, attributes[name]);
          parent.append(node);
          return node;
        },
        leds = getElement('radioKnobLeds'),
        pitch = KNOB_SWEEP / KNOB_LEDS;
      for (let i = 0; i < KNOB_LEDS; i++) {
        knobLeds.push(
          make(leds, 'rect', {
            x: -1.9,
            y: -48.5,
            width: 3.8,
            height: 8.5,
            rx: 1.1,
            transform: 'rotate(' + (-KNOB_SWEEP / 2 + (i + 0.5) * pitch).toFixed(2) + ')',
            // The last three run hot, like a head unit's red zone.
            class: i >= KNOB_LEDS - 3 ? 'led hot' : 'led',
          }),
        );
        knobLedState.push(0);
      }
      for (const angle of [-KNOB_SWEEP / 2 - 7, KNOB_SWEEP / 2 + 7])
        make(leds, 'circle', { cx: 0, cy: -44.2, r: 1.5, class: 'end', transform: 'rotate(' + angle + ')' });
      // Hexagonal segments on an 11 x 20 cell, slanted like a car stereo's LCD.
      const t = 2.6,
        h = t / 2,
        gap = 0.5,
        [left, right, top, middle, bottom] = [h, 11 - h, h, 10, 20 - h],
        across = (y, x1, x2) =>
          [x1, y, x1 + h, y - h, x2 - h, y - h, x2, y, x2 - h, y + h, x1 + h, y + h].join(' '),
        down = (x, y1, y2) => [x, y1, x + h, y1 + h, x + h, y2 - h, x, y2, x - h, y2 - h, x - h, y1 + h].join(' '),
        shapes = [
          across(top, left + gap, right - gap),
          down(right, top + gap, middle - gap),
          down(right, middle + gap, bottom - gap),
          across(bottom, left + gap, right - gap),
          down(left, middle + gap, bottom - gap),
          down(left, top + gap, middle - gap),
          across(middle, left + gap, right - gap),
        ],
        digits = make(getElement('radioLcdDigits'), 'g', { transform: 'translate(2.8 0) skewX(-8)' });
      for (let d = 0; d < 3; d++) {
        const cell = make(digits, 'g', { transform: 'translate(' + d * 15.5 + ' 0)' });
        lcdSegments.push(shapes.map((points) => make(cell, 'polygon', { points, class: 'seg' })));
      }
    })();
    function renderRadioVolume() {
      const value = settings.radioVolume,
        muted = value === 0,
        keys = keyName('radioQuieter') + ' / ' + keyName('radioLouder'),
        drawn = value + '|' + keys;
      if (drawn === knobDrawn) return;
      knobDrawn = drawn;
      radioKnob.style.setProperty('--angle', knobAngle(value) + 'deg');
      radioKnob.setAttribute('aria-valuenow', String(value));
      radioKnob.setAttribute('aria-valuetext', muted ? 'Muted' : value + '%');
      radioKnob.title = 'Radio volume · drag or scroll · ' + keys + ' · double-click mutes';
      // Lit LEDs, the last one dimmed by how far into its 5 steps the level is.
      const lit = value / RADIO_VOLUME_STEP;
      for (let i = 0; i < KNOB_LEDS; i++) {
        const level = clamp(lit - i, 0, 1),
          led = knobLeds[i];
        if (level === knobLedState[i]) continue;
        knobLedState[i] = level;
        led.classList.toggle('on', level > 0);
        led.style.opacity = level > 0 && level < 1 ? (0.35 + 0.65 * level).toFixed(2) : '';
      }
      const text = lcdReadout(value);
      for (let d = 0; d < 3; d++) {
        const bits = LCD_GLYPHS[text[d]];
        lcdSegments[d].forEach((segment, s) => segment.classList.toggle('on', ((bits >> s) & 1) === 1));
      }
      radioVolumeRow.classList.toggle('muted', muted);
      radioVolumeRow.classList.toggle('quiet', value > 0 && value < 50);
      getElement('carRadio').classList.toggle('radio-muted', muted);
      const mute = getElement('radioMute');
      mute.setAttribute('aria-pressed', String(muted));
      mute.setAttribute('aria-label', muted ? 'Unmute radio' : 'Mute radio');
      mute.title = muted ? 'Unmute radio' : 'Mute radio';
    }
    /* A soft detent tick on the effects bus each time the level crosses a
       5-step mark (at most one every 28 ms however fast the knob spins). */
    function knobDetent(before, after) {
      if (Math.floor(before / RADIO_VOLUME_STEP) === Math.floor(after / RADIO_VOLUME_STEP)) return;
      const now = performance.now();
      if (now - knobClickAt < 28) return;
      knobClickAt = now;
      noise(0.012, 0.06, 5200);
      tone(after > before ? 2300 : 2050, 0.014, 0.03, 'triangle');
    }
    function turnRadioVolume(next, options) {
      const before = settings.radioVolume;
      if (next === before) return;
      setRadioVolume(next, options);
      knobDetent(before, settings.radioVolume);
    }
    /* A step up or down (the keys, the wheel) to the next 5-step mark, showing
       the box while it changes. */
    function stepRadioVolume(steps) {
      if (!steps) return;
      const from = settings.radioVolume,
        mark = (steps > 0 ? Math.floor : Math.ceil)(from / RADIO_VOLUME_STEP) * RADIO_VOLUME_STEP;
      turnRadioVolume(clamp(mark + steps * RADIO_VOLUME_STEP, 0, 100), { from });
      hudPop('carRadio');
    }
    function wrapAngle(radians) {
      return Math.atan2(Math.sin(radians), Math.cos(radians));
    }
    // Not mouseup: the window's listener must still see a fire button let go over the box.
    for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'touchstart'])
      radioVolumeRow.addEventListener(type, (e) => e.stopPropagation());
    getElement('radioMute').addEventListener('click', (e) => {
      toggleRadioMute();
      hudPop('carRadio');
      // A mouse click hands the keys back to the game (or the title menu), like the other radio buttons.
      if (e.detail > 0) radioFocusBack(e);
    });
    radioKnob.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || knobDrag) return;
      initAudio();
      const box = radioKnob.getBoundingClientRect(),
        centre = { x: box.left + box.width / 2, y: box.top + box.height / 2, radius: box.width / 2 };
      knobDrag = {
        id: e.pointerId,
        type: e.pointerType,
        from: settings.radioVolume,
        value: settings.radioVolume,
        mode: 'linear',
        centre,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        distance: 0,
        // Angle round the centre (null near it): the last one and the total swept (clockwise +).
        angle:
          Math.hypot(e.clientX - centre.x, e.clientY - centre.y) < centre.radius * 0.25
            ? null
            : Math.atan2(e.clientY - centre.y, e.clientX - centre.x),
        swept: 0,
        // The path's own heading, sampled every 4 px, and how far it has turned.
        segmentX: 0,
        segmentY: 0,
        heading: null,
        turn: 0,
      };
      radioKnob.setPointerCapture?.(e.pointerId);
      radioVolumeRow.classList.add('dragging');
      hudPop('carRadio', 600000);
    });
    radioKnob.addEventListener('pointermove', (e) => {
      const drag = knobDrag;
      if (!drag || e.pointerId !== drag.id) return;
      e.stopPropagation();
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < KNOB_DEAD_ZONE) return;
        drag.moved = true;
      }
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y,
        centre = drag.centre,
        angle = Math.atan2(e.clientY - centre.y, e.clientX - centre.x),
        fine = e.shiftKey ? KNOB_FINE : 1;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.distance += Math.hypot(dx, dy);
      // Too near the centre the angle means nothing.
      const near = Math.hypot(e.clientX - centre.x, e.clientY - centre.y) < centre.radius * 0.25,
        turned = near || drag.angle === null ? 0 : wrapAngle(angle - drag.angle);
      drag.angle = near ? null : angle;
      drag.swept += turned;
      drag.segmentX += dx;
      drag.segmentY += dy;
      if (Math.hypot(drag.segmentX, drag.segmentY) >= 4) {
        const heading = Math.atan2(drag.segmentY, drag.segmentX);
        if (drag.heading !== null) drag.turn += wrapAngle(heading - drag.heading);
        drag.heading = heading;
        drag.segmentX = drag.segmentY = 0;
      }
      if (drag.mode === 'linear') {
        drag.value = clamp(drag.value + ((dx - dy) / KNOB_PX_PER_STEP) * fine, 0, 100);
        // Circling: from here on the knob turns with the pointer's angle. It
        // carries on from the level it has (no jump to where the curve began).
        if (
          Math.abs(drag.turn) >= KNOB_CIRCLE_TURN &&
          Math.abs(drag.swept) >= KNOB_CIRCLE_SWEEP &&
          Math.sign(drag.turn) === Math.sign(drag.swept)
        )
          drag.mode = 'circular';
      } else drag.value = clamp(drag.value + turned * KNOB_STEPS_PER_RADIAN * fine, 0, 100);
      turnRadioVolume(Math.round(drag.value), { from: drag.from, save: false });
    });
    function endKnobDrag(e) {
      const drag = knobDrag;
      if (!drag || e.pointerId !== drag.id) return;
      knobDrag = null;
      lastKnobDrag = {
        mode: drag.mode,
        from: drag.from,
        to: settings.radioVolume,
        distance: Math.round(drag.distance),
        swept: Math.round((drag.swept * 180) / Math.PI),
      };
      radioVolumeRow.classList.remove('dragging');
      if (drag.moved) saveSettings();
      hudPop('carRadio', drag.type === 'mouse' ? HUD_POP_MS : 6000);
      if (drag.type === 'mouse') radioFocusBack();
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) radioKnob.addEventListener(type, endKnobDrag);
    radioKnob.addEventListener('dblclick', () => {
      toggleRadioMute();
      hudPop('carRadio');
    });
    radioKnob.addEventListener('keydown', (e) => {
      const steps = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 2, PageDown: -2 }[e.code];
      if (steps) stepRadioVolume(steps);
      else if (e.code === 'Home' || e.code === 'End') {
        turnRadioVolume(e.code === 'Home' ? 0 : 100, { from: settings.radioVolume });
        hudPop('carRadio');
      } else return;
      e.preventDefault();
      e.stopPropagation();
    });
    radioVolumeRow.addEventListener('keydown', (e) => {
      // Space / Enter on the speaker stay here.
      if (e.target !== radioKnob && ['Space', 'Enter', 'NumpadEnter'].includes(e.code)) {
        e.stopPropagation();
        hudPop('carRadio');
      }
    });
    // The wheel anywhere over the radio box (open or resting) steps the volume;
    // a trackpad's small deltas add up to whole steps.
    getElement('carRadio').addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1,
          amount = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
        radioWheelCarry = clamp(radioWheelCarry + amount * scale, -400, 400);
        // One wheel notch (about 100) is one step.
        const steps = Math.trunc(radioWheelCarry / 90);
        radioWheelCarry -= steps * 90;
        stepRadioVolume(steps);
        if (!steps) hudPop('carRadio');
      },
      { passive: false },
    );
    // Console (DeadEndCity.radio()): the radio and its volume knob as shown.
    function radioReport() {
      const box = getElement('carRadio');
      return {
        shown: !box.classList.contains('hidden'),
        open: box.classList.contains('open') || box.matches(':hover, :focus-within'),
        station: MUSIC_STATIONS[radioStationIndex()].name,
        // The title menu's radio (TITLE RADIO): docked on the title, its own station.
        title: {
          enabled: titleRadioEnabled,
          shown: titleRadioShown,
          station: MUSIC_STATIONS[titleRadioStation].name,
          power: titleRadioPower,
          // Refused before a user gesture: the box asks for a click.
          waiting: box.classList.contains('radio-waiting'),
          inMenu: box.parentNode === titleMenuBox,
        },
        carStation: MUSIC_STATIONS[carRadioStation].name,
        blocked: carRadioBlocked,
        unavailable: carRadioUnavailable,
        loaded: carRadioLoaded,
        src: carRadioPlayer ? String(carRadioPlayer.currentSrc || '').slice(0, 80) : null,
        time: carRadioPlayer ? +carRadioPlayer.currentTime.toFixed(2) : null,
        fading: !!carRadioFade,
        // On where the player is (the Falcon's own per-ride switch while riding it).
        enabled: radioSwitchedOn(),
        saved: carRadioEnabled,
        playing: !!carRadioPlayer && !carRadioPlayer.paused,
        volume: settings.radioVolume,
        muted: settings.radioVolume === 0,
        unmuteTo: settings.radioUnmute,
        // Whether the player has set the level (settings.js RADIO DEFAULT).
        volumeSet: settings.radioVolumeSet,
        master: settings.masterVolume,
        // The element's volume: level for the moment x fade-in x volumeScale('radio').
        elementVolume: carRadioPlayer ? +carRadioPlayer.volume.toFixed(4) : null,
        scale: +volumeScale('radio').toFixed(4),
        knob: {
          value: Number(radioKnob.getAttribute('aria-valuenow')),
          angle: parseFloat(radioKnob.style.getPropertyValue('--angle')),
          lit: knobLedState.filter((level) => level > 0).length,
          readout: lcdReadout(settings.radioVolume),
          valueText: radioKnob.getAttribute('aria-valuetext'),
          dragging: radioVolumeRow.classList.contains('dragging'),
          mode: knobDrag ? knobDrag.mode : null,
          lastDrag: lastKnobDrag,
          pixelsPerStep: KNOB_PX_PER_STEP,
          sweep: KNOB_SWEEP,
        },
      };
    }
    // END SUBSYSTEM: src/car-radio.js
