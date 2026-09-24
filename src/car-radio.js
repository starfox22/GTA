    // BEGIN SUBSYSTEM: src/car-radio.js — Vehicle radio stations
    /**
     * Vehicle radio stations
     * Source: src/car-radio.js
     * Scope: shared game closure.
     * Six stations of licensed tracks, station idents, selection, playback and saved settings.
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
       `tagline` is the DJ line shown while the station ident plays; `ident` describes
       that short procedural jingle (see playStationIdent): a motif in semitones above
       `root` Hz, one step every `step` seconds, played by one of the `voice`s below. */
    const MUSIC_STATIONS = [
      {
        id: 'oddball',
        name: 'ODDBALL 99.3',
        genre: 'After-hours mix',
        preset: 'ODDBALL',
        tracks: ['oddball'],
        lead: 0.34,
        tagline: 'Oddball 99.3 · music for people who drive at night',
        ident: { voice: 'wobble', root: 330, step: 0.13, notes: [0, 7, 3, 10, 12] },
      },
      {
        id: 'synth',
        name: 'NEON 88.7',
        genre: '80s synth',
        preset: 'NEON',
        tracks: ['synth'],
        lead: 0.06,
        tagline: 'Neon 88.7 · the future, as seen from 1985',
        ident: { voice: 'saw', root: 220, step: 0.09, notes: [0, 7, 12, 16, 19, 24] },
      },
      {
        id: 'rock',
        name: 'RIOT 104.5',
        genre: 'Rock',
        preset: 'RIOT',
        tracks: ['rock'],
        lead: 0.06,
        tagline: 'Riot 104.5 · turn it up, the neighbours are armed anyway',
        ident: { voice: 'stab', root: 110, step: 0.17, notes: [0, 0, 3, 5] },
      },
      {
        id: 'velvet',
        name: 'VELVET 91.5',
        genre: 'Lounge jazz',
        preset: 'VELVET',
        tracks: ['lounge-martini', 'lounge-heists'],
        lead: 0.06,
        tagline: 'Velvet 91.5 · smooth jazz for smooth operators',
        ident: { voice: 'vibes', root: 293.66, step: 0.11, notes: [0, 4, 7, 11, 14] },
      },
      {
        id: 'palms',
        name: 'PALMS 95.9',
        genre: 'Island grooves',
        preset: 'PALMS',
        tracks: ['island-dub', 'island-colada'],
        lead: 0.06,
        tagline: 'Palms 95.9 · island time, all the time',
        ident: { voice: 'pan', root: 392, step: 0.12, notes: [0, 4, 7, 4, 9, 12] },
      },
      {
        id: 'block',
        name: 'BLOCK 101.7',
        genre: 'Lo-fi beats',
        preset: 'BLOCK',
        tracks: ['lofi-hooptie', 'lofi-freeway'],
        lead: 0.06,
        tagline: 'Block 101.7 · beats to cruise and lie low to',
        ident: { voice: 'keys', root: 220, step: 0.2, notes: [0, 3, 7, 10, 14] },
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
      // performance.now() times: music stays silent under the ident, the tagline shows.
      carRadioHoldUntil = 0,
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
    /* Station ident: a quarter second of tuning static, then the station's motif. It
       plays through the effects mix (so mute and the swimming filter apply). Returns
       the seconds until its last note sounds: the music holds at silence until then
       and fades up under the ringing tail. */
    function playStationIdent(station) {
      if (!audio || !master || !soundOn || audio.state === 'closed') return 0;
      const ident = station.ident,
        start = audio.currentTime + 0.02,
        motifAt = start + 0.24,
        bus = audio.createGain(),
        voices = [];
      bus.gain.value = 0.45;
      bus.connect(master);
      const noiseBuffer = (seconds, shape) => {
        const n = Math.max(1, Math.floor(audio.sampleRate * seconds)),
          buffer = audio.createBuffer(1, n, audio.sampleRate),
          data = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = shape(i / n) * (Math.random() * 2 - 1);
        return buffer;
      };
      const play = (node, at, seconds) => {
        node.start(at);
        node.stop(at + seconds);
        voices.push(node);
      };
      // Tuning sweep: band-passed static whistling down into the station.
      const staticSource = audio.createBufferSource(),
        sweep = audio.createBiquadFilter(),
        staticGain = audio.createGain();
      staticSource.buffer = noiseBuffer(0.3, (x) => Math.sin(Math.PI * x) * (0.6 + 0.4 * Math.sin(x * 60)));
      sweep.type = 'bandpass';
      sweep.Q.value = 2.2;
      sweep.frequency.setValueAtTime(3600, start);
      sweep.frequency.exponentialRampToValueAtTime(650, start + 0.3);
      staticGain.gain.value = 0.55;
      staticSource.connect(sweep).connect(staticGain).connect(bus);
      play(staticSource, start, 0.3);
      // One oscillator with its own envelope; returns both so voices can bend the pitch.
      const partial = (type, frequency, at, peak, decay, destination = bus) => {
        const osc = audio.createOscillator(),
          env = audio.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, at);
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(peak, at + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
        osc.connect(env).connect(destination);
        play(osc, at, decay + 0.02);
        return { osc, env };
      };
      const lowpass = (frequency) => {
        const filter = audio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = frequency;
        filter.connect(bus);
        return filter;
      };
      let end = motifAt,
        lastAt = motifAt;
      ident.notes.forEach((semitones, i) => {
        const at = motifAt + i * ident.step,
          last = i === ident.notes.length - 1,
          f = ident.root * Math.pow(2, semitones / 12);
        let decay = 0.3;
        if (ident.voice === 'vibes') {
          // Vibraphone: a pure bar tone and its two-octave overtone, with motor tremolo.
          decay = last ? 1.6 : 0.9;
          const motor = audio.createGain(),
            tremolo = audio.createOscillator(),
            depth = audio.createGain();
          motor.gain.value = 1;
          motor.connect(bus);
          tremolo.frequency.value = 5.2;
          depth.gain.value = 0.3;
          tremolo.connect(depth).connect(motor.gain);
          play(tremolo, at, decay);
          partial('sine', f, at, 0.5, decay, motor);
          partial('sine', f * 3.99, at, 0.12, 0.25);
        } else if (ident.voice === 'pan') {
          // Steel pan: fundamental, octave and a slightly sharp twelfth, quick decay.
          decay = last ? 0.9 : 0.45;
          const note = partial('sine', f * 0.985, at, 0.42, decay);
          note.osc.frequency.exponentialRampToValueAtTime(f, at + 0.04);
          partial('sine', f * 2, at, 0.22, decay * 0.7);
          partial('sine', f * 3.02, at, 0.1, decay * 0.4);
        } else if (ident.voice === 'keys') {
          // Worn electric piano: two detuned tines and a soft bell, rolled off.
          decay = last ? 1.8 : 1.1;
          const tone = lowpass(1500);
          partial('sine', f * 0.997, at, 0.32, decay, tone);
          partial('triangle', f * 1.003, at, 0.16, decay, tone);
          partial('sine', f * 7.1, at, 0.03, 0.12, tone);
        } else if (ident.voice === 'saw') {
          // Analogue arpeggio: saw through a closing filter.
          decay = last ? 0.7 : 0.22;
          const filter = audio.createBiquadFilter();
          filter.type = 'lowpass';
          filter.Q.value = 6;
          filter.frequency.setValueAtTime(4200, at);
          filter.frequency.exponentialRampToValueAtTime(500, at + decay);
          filter.connect(bus);
          partial('sawtooth', f, at, 0.5, decay, filter);
          partial('sawtooth', f * 1.006, at, 0.3, decay, filter);
        } else if (ident.voice === 'stab') {
          // Overdriven power chord: root and fifth through a soft clipper.
          decay = last ? 0.9 : 0.16;
          const drive = audio.createWaveShaper(),
            curve = new Float32Array(512);
          for (let k = 0; k < curve.length; k++) curve[k] = Math.tanh(((k / 511) * 2 - 1) * 4);
          drive.curve = curve;
          drive.connect(lowpass(2600));
          partial('sawtooth', f, at, 0.3, decay, drive);
          partial('sawtooth', f * 1.498, at, 0.24, decay, drive);
          partial('sawtooth', f * 2, at, 0.12, decay, drive);
        } else {
          // Wobble: a warbling triangle that slides up into each note.
          decay = last ? 0.8 : 0.24;
          const note = partial('triangle', f * 0.94, at, 0.8, decay);
          note.osc.frequency.exponentialRampToValueAtTime(f, at + 0.05);
          const wobble = audio.createOscillator(),
            depth = audio.createGain();
          wobble.frequency.value = 7;
          depth.gain.value = f * 0.02;
          wobble.connect(depth).connect(note.osc.frequency);
          play(wobble, at, decay);
        }
        end = Math.max(end, at + decay);
        lastAt = at;
      });
      if (ident.voice === 'keys') {
        // Vinyl crackle under the lo-fi ident.
        const crackle = audio.createBufferSource();
        crackle.buffer = noiseBuffer(end - start, (x) =>
          Math.random() < 0.0022 ? 1.1 * Math.sin(Math.PI * x) : 0.04 * Math.sin(Math.PI * x),
        );
        crackle.connect(lowpass(5200));
        play(crackle, start, end - start);
      }
      setTimeout(
        () => {
          for (const node of voices) node.disconnect();
          bus.disconnect();
        },
        (end - audio.currentTime + 0.2) * 1000,
      );
      return lastAt - start + 0.25;
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
    function syncCarRadio(gesture = false, deltaSeconds = 0) {
      const party = gameMode === 'play' && player.roof && !document.hidden,
        // A bicycle has no radio to play.
        riding = gameMode === 'play' && player.car?.hp > 0 && !ridingBicycle() && !document.hidden,
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
          : 0.27,
        holding = !party && performance.now() < carRadioHoldUntil;
      if (!carRadioPlayer.paused && !holding)
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
        // The ident plays over silence; the new station fades up under its last note.
        const seconds = playStationIdent(MUSIC_STATIONS[next]);
        carRadioHoldUntil = performance.now() + seconds * 1000;
        carRadioTaglineUntil = performance.now() + Math.max(RADIO_TAGLINE_MS, seconds * 1000);
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
      const riding = gameMode === 'play' && player.car?.hp > 0 && !ridingBicycle();
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
