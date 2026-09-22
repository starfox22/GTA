    // BEGIN SUBSYSTEM: src/car-radio.js — Vehicle radio stations
    /**
     * Vehicle radio stations
     * Source: src/car-radio.js
     * Scope: shared game closure.
     * Three embedded tracks, station selection, playback and saved audio settings.
     */
    /* Three in-vehicle music stations; a single streaming decoder keeps memory bounded.
       Oddball is preset one: it is the station the dashboard comes up on.
       `lead` is how far into the file playback starts and loops back to. MP3 decoders
       need a frame of priming and these files carry no gapless metadata, so the first
       few hundredths of a second decode as noise. Starting past it, and ramping the
       gain from silence, removes the click on both the first play and every loop. */
    const MUSIC_STATIONS = [
      {
        id: 'oddball',
        name: 'ODDBALL 99.3',
        genre: 'After-hours mix',
        preset: 'ODDBALL',
        lead: 0.34,
      },
      {
        id: 'synth',
        name: 'NEON 88.7',
        genre: '80s synth',
        preset: 'NEON',
        lead: 0.06,
      },
      {
        id: 'rock',
        name: 'RIOT 104.5',
        genre: 'Rock',
        preset: 'RIOT',
        lead: 0.06,
      },
    ];
    const RADIO_FADE_IN = 3.6;
    let carRadioEnabled = true,
      carRadioStation = 0,
      carRadioPlayer = null,
      carRadioLoaded = -1,
      carRadioPending = false,
      carRadioBlocked = false,
      carRadioUnavailable = false,
      carRadioRevision = 0,
      carRadioLead = MUSIC_STATIONS[0].lead,
      carRadioGain = 0;
    try {
      const pref = JSON.parse(localStorage.getItem('dead-end-city-radio-v2'));
      if (pref && typeof pref === 'object') {
        carRadioEnabled = pref.enabled !== false;
        if (Number.isInteger(pref.station))
          carRadioStation = clamp(pref.station, 0, MUSIC_STATIONS.length - 1);
      }
    } catch {}
    function saveCarRadio() {
      try {
        localStorage.setItem(
          'dead-end-city-radio-v2',
          JSON.stringify({
            enabled: carRadioEnabled,
            station: carRadioStation,
          }),
        );
      } catch {}
    }
    function radioTrack() {
      return typeof ASSETS !== 'undefined' ? ASSETS.music?.[MUSIC_STATIONS[carRadioStation].id] : null;
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
    function syncCarRadio(gesture = false, deltaSeconds = 0) {
      const party = gameMode === 'play' && player.roof && !document.hidden,
        // A bicycle has no radio to play.
        riding = gameMode === 'play' && player.car?.hp > 0 && !ridingBicycle() && !document.hidden,
        wants = (party || (riding && carRadioEnabled)) && soundOn,
        station = party ? -2 : carRadioStation,
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
      if (carRadioLoaded !== station) {
        carRadioRevision++;
        carRadioPending = false;
        carRadioPlayer.pause();
        carRadioLead = party ? 0.06 : MUSIC_STATIONS[carRadioStation].lead || 0;
        carRadioGain = 0;
        carRadioPlayer.volume = 0;
        carRadioPlayer.src = track.src;
        carRadioLoaded = station;
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
      carRadioPlayer.volume = clamp(target * carRadioGain, 0, 1);
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
      carRadioStation = (index + MUSIC_STATIONS.length) % MUSIC_STATIONS.length;
      carRadioEnabled = true;
      carRadioBlocked = false;
      saveCarRadio();
      initAudio();
      syncCarRadio(true);
      updateCarRadioUI();
    }
    function toggleCarRadio() {
      if (carRadioBlocked && carRadioEnabled) {
        carRadioBlocked = false;
        if (carRadioUnavailable) carRadioLoaded = -1;
      } else carRadioEnabled = !carRadioEnabled;
      saveCarRadio();
      initAudio();
      syncCarRadio(true);
      updateCarRadioUI();
    }
    function updateCarRadioUI() {
      const riding = gameMode === 'play' && player.car?.hp > 0 && !ridingBicycle();
      getElement('carRadio').classList.toggle('hidden', !riding);
      const station = MUSIC_STATIONS[carRadioStation],
        track = radioTrack();
      getElement('radioStation').textContent = station.name;
      getElement('radioGenre').textContent = station.genre.toUpperCase();
      getElement('radioTrack').textContent = !carRadioEnabled
        ? 'Radio off'
        : !soundOn
          ? 'Game sound muted · M to unmute'
          : carRadioUnavailable
            ? 'Track unavailable · N to retry'
            : carRadioBlocked
              ? 'Press N to start playback'
              : track
                ? track.title + ' · ' + track.artist
                : 'Tuning…';
      getElement('radioPower').textContent = 'N · ' + (carRadioEnabled ? 'ON' : 'OFF');
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
