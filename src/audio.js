    // BEGIN SUBSYSTEM: src/audio.js — Effects and voice audio
    /**
     * Effects and voice audio
     * Source: src/audio.js
     * Scope: shared game closure.
     * Embedded samples, Web Audio lifecycle, spatial volume and procedural sound.
     */
    /**
     * THE MIX
     * One gain per category, each set by its Settings · Audio slider
     * (settings.js AUDIO_BUSES, `busLevel()`):
     *
     *   master       effects: weapons, impacts, crashes, explosions, UI tones.
     *                The historical name: anything connected to `master` is an
     *                effect.
     *   engineBus    engines and vehicles: engine-audio.js (the player's engine,
     *                road and wind noise, traffic, jets, boats, tank tracks), the
     *                tyre and rotor loops
     *   ambienceBus  the city (ambience.js), weather, the sea and swimming, the
     *                stadium, the pier rides, the drawbridge, parachute wind
     *   sirenBus     police sirens and Fort Sentinel's air-raid siren
     *   musicBus     music played in the world (the beach club) at the radio
     *                level; the car radio is its own <audio> element, scaled by
     *                volumeScale('radio')
     *   voiceBus     the police and dispatch callouts
     *
     * The first five meet in `duckBus` (the ride-skip fade, ride-skip.js, dips
     * them under the black while the radio and the callouts play on;
     * `setMixDuck()` moves it), then the ear filter (dulled while swimming),
     * where the callouts join; `mixBus` (the master volume and the Sound switch)
     * and the limiter follow.
     */
    let soundOn = true,
      audio = null,
      master = null,
      engineBus = null,
      ambienceBus = null,
      sirenBus = null,
      musicBus = null,
      voiceBus = null,
      duckBus = null,
      mixBus = null;
    let audioBuffers = {},
      audioLoops = {},
      reverb = null,
      reverbSend = null,
      // A low-pass across the whole mix: open on land, dulled while swimming
      // (water-audio.js dips it each time the face goes under).
      earFilter = null,
      footstepClock = 0;
    function initAudio() {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      if (audio) {
        audio.resume().catch(() => {});
        return;
      }
      try {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        const limiter = audio.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 18;
        limiter.ratio.value = 5;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.22;
        earFilter = audio.createBiquadFilter();
        earFilter.type = 'lowpass';
        earFilter.frequency.value = 20000;
        earFilter.Q.value = 0.5;
        duckBus = audio.createGain();
        mixBus = audio.createGain();
        mixBus.gain.value = mixLevel();
        duckBus.connect(earFilter).connect(mixBus).connect(limiter).connect(audio.destination);
        const bus = (channel, into = duckBus) => {
          const node = audio.createGain();
          node.gain.value = busLevel(channel);
          node.connect(into);
          return node;
        };
        master = bus('sound');
        engineBus = bus('engine');
        ambienceBus = bus('ambience');
        sirenBus = bus('siren');
        musicBus = bus('radio');
        voiceBus = bus('voice', earFilter);
        reverb = audio.createConvolver();
        const n = Math.floor(audio.sampleRate * 1.3),
          ir = audio.createBuffer(2, n, audio.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const d = ir.getChannelData(ch);
          for (let i = 0; i < n; i++) {
            const t = i / audio.sampleRate;
            d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.09;
            if (Math.abs(t - 0.083 - ch * 0.007) < 0.001 || Math.abs(t - 0.173 - ch * 0.004) < 0.001)
              d[i] += (Math.random() * 2 - 1) * 0.28;
          }
        }
        reverb.buffer = ir;
        const wet = audio.createGain();
        wet.gain.value = 0.2;
        reverb.connect(wet).connect(master);
        for (const [name, url] of Object.entries(ASSETS.audio || {})) {
          const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
          audio
            .decodeAudioData(bytes.buffer)
            .then((buffer) => {
              audioBuffers[name] = buffer;
              if (['tires', 'siren', 'rotor-loop'].includes(name)) startLoop(name);
            })
            .catch(() => {});
        }
      } catch (error) {
        console.warn('Audio unavailable', error);
      }
    }
    function startLoop(name) {
      if (!audio || !audioBuffers[name] || audioLoops[name]) return;
      const s = audio.createBufferSource(),
        g = audio.createGain(),
        filter = audio.createBiquadFilter();
      s.buffer = audioBuffers[name];
      s.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 4800;
      g.gain.value = 0;
      // The tyres and the rotor are vehicles; the siren has its own slider.
      s.connect(filter).connect(g).connect(name === 'siren' ? sirenBus : engineBus);
      s.start();
      audioLoops[name] = {
        source: s,
        gain: g,
        filter,
      };
    }
    /*
     * Exact loop lengths (seconds) of the recorded loops made for this game
     * (engines, boats, tank tracks, rain). Each file carries its loop plus the
     * loop's own first 0.2 s, and plays with loopEnd at this length, so an
     * encoder's padding or trimming at the end of the file never reaches the
     * seam (Vorbis ends are not sample-exact across decoders).
     */
    const LOOP_SECONDS = {
      'boat-diesel': 2.325646,
      'boat-jetski': 0.696259,
      'boat-outboard-high': 2.02424,
      'boat-outboard-low': 1.994603,
      'engine-compact-high': 2.592925,
      'engine-compact-idle': 2.003379,
      'engine-compact-low': 0.837596,
      'engine-compact-mid': 2.186939,
      'engine-diesel-high': 2.22966,
      'engine-diesel-idle': 3.678912,
      'engine-diesel-mid': 2.62771,
      'engine-sport-high': 1.403016,
      'engine-sport-idle': 1.575669,
      'engine-sport-low': 1.408707,
      'engine-sport-mid': 0.760499,
      'engine-twin-idle': 2.055692,
      'engine-v8-idle': 1.920431,
      'engine-v8-low': 0.592948,
      'engine-v8-mid': 0.686576,
      'rain-heavy': 10.2,
      'rain-light': 16.0,
      'rain-steady': 14.0,
      'tank-tracks': 5.3,
    };
    /* A looping source for a decoded buffer, looped at its exact length. */
    function loopingSource(name) {
      const source = audio.createBufferSource(),
        buffer = audioBuffers[name],
        seconds = LOOP_SECONDS[name];
      source.buffer = buffer;
      source.loop = true;
      if (seconds && seconds < buffer.duration) {
        source.loopStart = 0;
        source.loopEnd = seconds;
      }
      return source;
    }
    // A category bus's gain: its slider (0.62 is the mix's nominal level). The
    // master volume and the Sound switch are on `mixBus`.
    function busLevel(channel) {
      return 0.62 * channelVolume(channel);
    }
    function mixLevel() {
      return soundOn ? settings.masterVolume / 100 : 0;
    }
    /* Push every slider into the live mix (settings.js applyVolumes). */
    function applyMixLevels() {
      if (!audio || !mixBus) return;
      const now = audio.currentTime;
      mixBus.gain.setTargetAtTime(mixLevel(), now, 0.05);
      for (const [node, channel] of [
        [master, 'sound'],
        [engineBus, 'engine'],
        [ambienceBus, 'ambience'],
        [sirenBus, 'siren'],
        [musicBus, 'radio'],
        [voiceBus, 'voice'],
      ])
        node.gain.setTargetAtTime(busLevel(channel), now, 0.05);
    }
    /* Duck the effects bus to `level` (1 = open) over about `seconds`. */
    function setMixDuck(level, seconds = 0.3) {
      if (!audio || !duckBus) return;
      duckBus.gain.cancelScheduledValues(audio.currentTime);
      duckBus.gain.setTargetAtTime(clamp(level, 0, 1), audio.currentTime, Math.max(0.01, seconds / 3));
    }
    /* A recorded sample, optionally from a map position (attenuated and panned
       from the player; a position with an `elevation` also counts the height
       between it and the player, e.g. the Falcon's train) and `delay` seconds
       from now. */
    function playSample(name, volume = 0.5, rate = 1, position = null, bus = master, delay = 0) {
      if (!audio || !soundOn) return;
      const b = audioBuffers[name];
      if (!b) return;
      const s = audio.createBufferSource(),
        g = audio.createGain(),
        pan = audio.createStereoPanner();
      s.buffer = b;
      s.playbackRate.value = rate;
      let attenuation = 1;
      if (position) {
        const rise = position.elevation === undefined ? 0 : position.elevation - entityElevation(player),
          distance = Math.hypot(distanceBetween(position, player), rise);
        attenuation = 1 / (1 + distance / 230);
        pan.pan.value = clamp((position.x - player.x) / 450, -0.9, 0.9);
      }
      g.gain.value = volume * attenuation;
      s.connect(g).connect(pan).connect(bus || master);
      if (['pistol', 'automatic', 'shotgun', 'rifle', 'explosion'].includes(name)) pan.connect(reverb);
      s.start(delay > 0 ? audio.currentTime + delay : 0);
      s.onended = () => {
        s.disconnect();
        g.disconnect();
        pan.disconnect();
      };
    }
    function tone(f, d = 0.1, v = 0.2, type = 'sine', end) {
      if (!audio || !soundOn) return;
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = type === 'square' ? 'triangle' : type;
      o.frequency.setValueAtTime(f, audio.currentTime);
      if (end) o.frequency.exponentialRampToValueAtTime(end, audio.currentTime + d);
      g.gain.setValueAtTime(v * 0.35, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d);
      o.connect(g).connect(master);
      o.start();
      o.stop(audio.currentTime + d);
    }
    function noise(d = 0.1, v = 0.25, freq = 1300) {
      if (!audio || !soundOn) return;
      const n = Math.floor(audio.sampleRate * d),
        b = audio.createBuffer(1, n, audio.sampleRate),
        data = b.getChannelData(0);
      let low = 0;
      for (let i = 0; i < n; i++) {
        low = low * 0.6 + (Math.random() * 2 - 1) * 0.4;
        data[i] = low * Math.pow(1 - i / n, 2);
      }
      const s = audio.createBufferSource(),
        g = audio.createGain(),
        filter = audio.createBiquadFilter();
      s.buffer = b;
      g.gain.value = v;
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      s.connect(filter).connect(g).connect(master);
      s.start();
    }
    function reloadSound() {
      if (!audio || !soundOn) return;
      const at = selectedWeaponIndex === 2 ? 0.18 : 0.32;
      noise(0.055, 0.14, 2600);
      setTimeout(() => {
        if (gameMode === 'play') {
          noise(0.08, 0.11, 1600);
          tone(270, 0.025, 0.1, 'triangle', 180);
        }
      }, at * 1000);
      setTimeout(
        () => {
          if (gameMode === 'play') noise(0.035, 0.15, 3500);
        },
        Math.max(200, currentWeapon().load * 780),
      );
    }
    function weaponSound(slot, x, y) {
      const names = ['pistol', 'automatic', 'shotgun', 'explosion', 'automatic', 'rifle'];
      if (slot === 3) {
        playSample('explosion', 0.36, 1.35, {
          x,
          y,
        });
        noise(0.22, 0.2, 650);
      } else
        playSample(
          names[slot],
          [0.52, 0.34, 0.68, 0.36, 0.44, 0.65][slot],
          (slot === 4 ? 0.85 : 0.965) + Math.random() * 0.06,
          {
            x,
            y,
          },
        );
    }
    /**
     * Per-frame audio parameters (engine, ambience, surf, stadium roar...) glide
     * toward a target with setTargetAtTime. Re-sending the same target every
     * frame only piles automation events onto the parameter, so a call whose
     * target is (nearly) the one already set is skipped; it is re-sent at least
     * twice a second in case something else moved the parameter.
     */
    const glideTargets = new WeakMap();
    function glideParam(param, target, startTime, timeConstant) {
      const last = glideTargets.get(param),
        now = audio ? audio.currentTime : 0;
      if (
        last &&
        now - last.at < 0.5 &&
        last.constant === timeConstant &&
        Math.abs(last.target - target) <= Math.max(1e-4, Math.abs(target) * 0.004)
      )
        return;
      param.setTargetAtTime(target, startTime, timeConstant);
      if (last) {
        last.target = target;
        last.at = now;
        last.constant = timeConstant;
      } else glideTargets.set(param, { target, at: now, constant: timeConstant });
    }
    function soundUpdate(deltaSeconds) {
      syncCarRadio(false, deltaSeconds);
      if (!audio) return;
      const active = gameMode === 'play' && soundOn,
        c = player.car;
      // Engines, road noise and traffic (engine-audio.js).
      updateEngineAudio(deltaSeconds);
      const tires = audioLoops.tires;
      if (tires) {
        /* TYRES: as loud as the tyres are slipping (physics.js c.tyreSlip: a
           slide, locked wheels, wheelspin, the understeer scrub, the handbrake),
           a locked tyre lower and harsher than a cornering howl. */
        const road =
            c &&
            !isAircraft(c) &&
            !vehicleSpec(c).boat &&
            // Narrow bicycle tyres do not howl through a turn.
            !vehicleSpec(c).bicycle,
          slip = road ? clamp(c.tyreSlip || 0, 0, 1) : 0,
          locked = road && c.tyres ? Math.max(c.tyres.lock[0], c.tyres.lock[1]) : 0;
        glideParam(tires.gain.gain, active && slip > 0.08 ? 0.05 + 0.19 * Math.pow(slip, 0.8) : 0, audio.currentTime, 0.07);
        glideParam(tires.source.playbackRate, 1.04 - 0.14 * locked + 0.06 * (c?.tyres?.spin || 0), audio.currentTime, 0.1);
      }
      absBuzz(active && !!c?.absActive);
      const siren = audioLoops.siren;
      if (siren) {
        let d = 10000;
        for (const car of vehicles)
          if (car.hp > 0 && ((car.cop && wantedStars > 0) || car.gangTarget))
            d = Math.min(d, distanceBetween(car, player));
        glideParam(siren.gain.gain, 
          active ? clamp(1 - d / 700, 0, 1) * 0.18 : 0,
          audio.currentTime,
          0.2,
        );
        glideParam(siren.filter.frequency, clamp(6500 - d * 7, 800, 6500), audio.currentTime, 0.2);
      }
      const rotor = audioLoops['rotor-loop'];
      if (rotor) {
        const chopper =
            c?.type === 'helicopter' && c.hp > 0
              ? c
              : vehicles.find((v) => v.airUnit && v.hp > 0 && distanceBetween(v, player) < 700),
          flying = !!chopper;
        glideParam(rotor.gain.gain, 
          active && flying
            ? chopper === c
              ? 0.25
              : 0.18 * clamp(1 - distanceBetween(chopper, player) / 900, 0, 1)
            : 0,
          audio.currentTime,
          0.45,
        );
        glideParam(rotor.source.playbackRate, 
          flying
            ? 0.82 + Math.min(chopper.altitude / 300, 0.15) + Math.abs(chopper.speed) * 0.0003
            : 0.8,
          audio.currentTime,
          0.3,
        );
      }
      updateWaterAudio(deltaSeconds);
      // The shark's score and the dolphins' voices (sealife-audio.js).
      updateSeaLifeAudio(deltaSeconds);
      if (!active) return;
      footstepClock -= deltaSeconds;
      const walking =
        !c &&
        !player.swimming &&
        !player.climbing &&
        (keys.KeyW ||
          keys.KeyA ||
          keys.KeyS ||
          keys.KeyD ||
          keys.ArrowUp ||
          keys.ArrowLeft ||
          keys.ArrowDown ||
          keys.ArrowRight);
      if (walking && footstepClock <= 0) {
        // One footfall per step at the pace the legs are going (game.js strideRate).
        footstepClock = Math.PI / strideRate(footPace());
        if (player.wading) {
          // Striding through the shallows: slower steps, each one a swish.
          footstepClock *= 1.35;
          wadeStepSound(player.wading);
        } else if (onBeach(player.x, player.y) && !player.roof) {
          // Soft sand gives under the foot: a dull crunch and no heel strike.
          noise(0.12, 0.07, 300 + Math.random() * 180);
        } else {
          noise(0.09, 0.095, 520 + Math.random() * 260);
          tone(95 + Math.random() * 40, 0.045, 0.09, 'sine', 45);
        }
      }
    }
    /* ABS: while it works, a faint rattle on the effects bus, the pump and the
       valves pulsing at about 12 Hz under the pedal. Built on first use. */
    let absVoice = null;
    function absBuzz(on) {
      if (!audio) return;
      if (!absVoice) {
        if (!on) return;
        const buzz = audio.createOscillator(),
          pulse = audio.createOscillator(),
          depth = audio.createGain(),
          body = audio.createGain(),
          tone = audio.createBiquadFilter(),
          level = audio.createGain();
        buzz.type = 'sawtooth';
        buzz.frequency.value = 74;
        pulse.type = 'square';
        pulse.frequency.value = 12.5;
        // The pulse swings the body's gain between 0 and 1.
        body.gain.value = 0.5;
        depth.gain.value = 0.5;
        pulse.connect(depth).connect(body.gain);
        tone.type = 'bandpass';
        tone.frequency.value = 420;
        tone.Q.value = 1.4;
        level.gain.value = 0;
        buzz.connect(body).connect(tone).connect(level).connect(master);
        buzz.start();
        pulse.start();
        absVoice = { level };
      }
      glideParam(absVoice.level.gain, on ? 0.075 : 0, audio.currentTime, on ? 0.02 : 0.06);
    }
    function mute() {
      soundOn = !soundOn;
      applyVolumes();
      applySoundLabels();
      saveSettings();
      updateCarRadioUI();
    }
    function applySoundLabels() {
      const menuSound = getElement('menuSound');
      menuSound.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
      menuSound.setAttribute('aria-pressed', String(soundOn));
    }
    let voicesOn = true,
      radioUntil = 0,
      radioCaptionTimer = null;
    const radioText = {
      'mission-complete': 'MISSION COMPLETED',
      'mission-failed': 'MISSION FAILED',
      'call-backup': 'CALL FOR BACKUP',
      'target-engaged': 'TARGET ENGAGED',
      'look-out': 'LOOK OUT!',
      'police-challenge': 'DROP YOUR WEAPON! HANDS ON YOUR HEAD! GET DOWN!',
      'police-drop-weapon': 'DROP YOUR WEAPON!',
      'police-hands-on-head': 'PUT YOUR HANDS ON YOUR HEAD!',
      'police-under-arrest': 'YOU ARE UNDER ARREST!',
      'police-get-down': 'GET DOWN!',
    };
    function radio(name, position = null) {
      const priority = name.startsWith('mission-'),
        police = name.startsWith('police-') || name === 'target-engaged';
      if (
        !voicesOn ||
        gameMode !== 'play' ||
        (!priority && gameTime < radioUntil) ||
        (police && position && distanceBetween(position, player) > 450)
      )
        return false;
      if (
        name === 'target-engaged' &&
        (!position?.police || position.state !== 'aim' || position.hp <= 0 || !policeSees(position))
      )
        return false;
      const duration = audioBuffers[name]?.duration || (name === 'police-challenge' ? 3.8 : 1.8);
      radioUntil = gameTime + Math.max(police ? 6 : 3, duration + 0.4);
      playSample(name, 0.7, 1, position, voiceBus);
      const el = getElement('radioCaption');
      el.textContent = (police ? 'POLICE / ' : 'RADIO / ') + (radioText[name] || name.toUpperCase());
      el.classList.add('show');
      clearTimeout(radioCaptionTimer);
      radioCaptionTimer = setTimeout(
        () => el.classList.remove('show'),
        Math.max(2400, duration * 1000 + 400),
      );
      return true;
    }
    function toggleVoices() {
      voicesOn = !voicesOn;
      saveSettings();
    }
    // Developer console (DeadEndCity.audioMix()): the live mix for tests.
    function audioConsole() {
      return {
        audioMix: () => ({
          context: audio ? audio.state : null,
          time: audio ? +audio.currentTime.toFixed(2) : 0,
          soundOn,
          // Each bus's live gain (THE MIX above): `mix` is the master volume
          // and the Sound switch, the rest are the category sliders x 0.62.
          buses: mixBus
            ? Object.fromEntries(
                [
                  ['mix', mixBus],
                  ['effects', master],
                  ['engines', engineBus],
                  ['ambience', ambienceBus],
                  ['sirens', sirenBus],
                  ['music', musicBus],
                  ['voices', voiceBus],
                ].map(([k, node]) => [k, +node.gain.value.toFixed(4)]),
              )
            : null,
          master: master ? +master.gain.value.toFixed(3) : null,
          duck: duckBus ? +duckBus.gain.value.toFixed(3) : null,
          buffers: Object.keys(audioBuffers).length,
          loops: Object.fromEntries(
            Object.entries(audioLoops).map(([k, l]) => [
              k,
              { gain: +l.gain.gain.value.toFixed(4), rate: +l.source.playbackRate.value.toFixed(3), filter: Math.round(l.filter.frequency.value) },
            ]),
          ),
        }),
        // The player's engine (revs, gear, load, layer rates and gains), road
        // noise, the traffic voices and a trace of the last 12 s (engine-audio.js).
        engineSound: () => engineReport(),
        // The rain beds' gains, cover and cabin filter (weather-audio.js).
        rainSound: () => rainReport(),
      };
    }
    // END SUBSYSTEM: src/audio.js
