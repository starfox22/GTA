    // BEGIN SUBSYSTEM: src/car-radio.js — Vehicle radio stations
    /**
     * Vehicle radio stations
     * Source: src/car-radio.js
     * Scope: shared game closure.
     * Six stations of licensed tracks, selection, playback and saved settings.
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
    try {
      const pref = JSON.parse(localStorage.getItem('dead-end-city-radio-v2'));
      if (pref && typeof pref === 'object') {
        carRadioEnabled = pref.enabled !== false;
        if (Number.isInteger(pref.station))
          carRadioStation = clamp(pref.station, 0, MUSIC_STATIONS.length - 1);
        for (const station of MUSIC_STATIONS)
          if (Number.isInteger(pref.tracks?.[station.id]))
            carRadioTrack[station.id] = clamp(pref.tracks[station.id], 0, station.tracks.length - 1);
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
          }),
        );
      } catch {}
    }
    function stationTrackKey(index = carRadioStation) {
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
        const station = MUSIC_STATIONS[carRadioStation];
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
      return gameMode === 'play' && ((player.car?.hp > 0 && !ridingBicycle()) || !!player.coaster);
    }
    function syncCarRadio(gesture = false, deltaSeconds = 0) {
      const party = gameMode === 'play' && player.roof && !document.hidden,
        riding = radioAboard() && !document.hidden,
        wants = (party || (riding && carRadioEnabled)) && soundOn,
        // The Blue Hour rooftop party always plays the synth track, whatever is tuned.
        loadKey = party ? RADIO_PARTY : MUSIC_STATIONS[carRadioStation].id + '/' + stationTrackKey(),
        track = party ? (typeof ASSETS !== 'undefined' ? ASSETS.music?.synth : null) : radioTrack();
      if (!wants) {
        if (carRadioPlayer && (!carRadioPlayer.paused || carRadioPending)) {
          carRadioPlayer.pause();
          carRadioRevision++;
          carRadioPending = false;
          carRadioGain = 0;
        }
        return;
      }
      if (!track?.src || !carRadioReady()) return;
      if (carRadioLoaded !== loadKey) {
        carRadioRevision++;
        carRadioPending = false;
        carRadioPlayer.pause();
        carRadioLead = party ? 0.06 : MUSIC_STATIONS[carRadioStation].lead || 0;
        carRadioGain = 0;
        carRadioPlayer.volume = 0;
        carRadioPlayer.src = track.src;
        carRadioLoaded = loadKey;
        carRadioBlocked = false;
        carRadioUnavailable = false;
        seekCarRadioLead();
      }
      const target = party
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
        changed = next !== carRadioStation || !carRadioEnabled;
      carRadioStation = next;
      carRadioEnabled = true;
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
      if (carRadioBlocked && carRadioEnabled) {
        carRadioBlocked = false;
        if (carRadioUnavailable) carRadioLoaded = null;
      } else carRadioEnabled = !carRadioEnabled;
      saveCarRadio();
      initAudio();
      syncCarRadio(true);
      updateCarRadioUI();
    }
    function updateCarRadioUI() {
      const riding = radioAboard();
      getElement('carRadio').classList.toggle('hidden', !riding);
      const station = MUSIC_STATIONS[carRadioStation],
        track = radioTrack();
      getElement('radioStation').textContent = station.name;
      getElement('radioGenre').textContent = station.genre.toUpperCase();
      getElement('radioTrack').textContent = !carRadioEnabled
        ? 'Radio off'
        : !soundOn
          ? 'Game sound muted · ' + keyName('mute') + ' to unmute'
          : carRadioUnavailable
            ? 'Track unavailable · ' + keyName('radioPower') + ' to retry'
            : carRadioBlocked
              ? 'Press ' + keyName('radioPower') + ' to start playback'
              : performance.now() < carRadioTaglineUntil
                ? '“' + station.tagline + '”'
                : track
                  ? track.title + ' · ' + track.artist
                  : 'Tuning…';
      getElement('radioPower').textContent = keyName('radioPower') + ' · ' + (carRadioEnabled ? 'ON' : 'OFF');
      getElement('radioPower').setAttribute?.('aria-pressed', String(carRadioEnabled));
      getElement('carRadio').classList.toggle('radio-off', !carRadioEnabled);
      for (let i = 0; i < MUSIC_STATIONS.length; i++) {
        getElement('radioPreset' + i).setAttribute?.('aria-pressed', String(i === carRadioStation));
        getElement('radioPreset' + i).classList.toggle('selected', i === carRadioStation);
      }
      syncCarRadio();
    }
    getElement('radioPower').onclick = () => {
      toggleCarRadio();
      canvas.focus();
    };
    getElement('radioNext').onclick = () => {
      tuneCarRadio(carRadioStation + 1);
      canvas.focus();
    };
    for (let i = 0; i < MUSIC_STATIONS.length; i++)
      getElement('radioPreset' + i).onclick = () => {
        tuneCarRadio(i);
        canvas.focus();
      };
    // END SUBSYSTEM: src/car-radio.js
