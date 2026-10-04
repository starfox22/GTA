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
     * and the limiter follow, then a brick-wall ceiling at -1 dBFS. The ambience
     * bus passes `loudDuck` first: gunfire and explosions near the ear dip it.
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
      mixBus = null,
      ambienceDuck = null;
    let audioBuffers = {},
      audioLoops = {},
      reverb = null,
      reverbSend = null,
      // A low-pass across the whole mix: open on land, dulled while swimming
      // (water-audio.js dips it each time the face goes under).
      earFilter = null;
    // The bytes of a base64 data URL. A plain loop: Uint8Array.from(string, fn) calls fn per byte and
    // took ~0.3 s for the 65 samples at the first click (ENTER); the bytes are the same.
    function dataUrlBytes(url) {
      const binary = atob(url.slice(url.indexOf(',') + 1)),
        bytes = new Uint8Array(binary.length);
      for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    function initAudio() {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      // A seeded boot (game-state.js DETERMINISTIC BOOT) runs silent: the sound code draws on Math.random every frame,
      // the held live frames included, which would make the seeded sequence depend on the wall clock.
      if (DEV_BOOT_SEED) return;
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
        // The ceiling only catches peaks the limiter's soft knee lets past.
        const ceiling = audio.createDynamicsCompressor();
        ceiling.threshold.value = -1;
        ceiling.knee.value = 0;
        ceiling.ratio.value = 20;
        ceiling.attack.value = 0.001;
        ceiling.release.value = 0.1;
        duckBus.connect(earFilter).connect(mixBus).connect(limiter).connect(ceiling).connect(audio.destination);
        ambienceDuck = audio.createGain();
        ambienceDuck.connect(duckBus);
        const bus = (channel, into = duckBus) => {
          const node = audio.createGain();
          node.gain.value = busLevel(channel);
          node.connect(into);
          return node;
        };
        master = bus('sound');
        engineBus = bus('engine');
        ambienceBus = bus('ambience', ambienceDuck);
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
        // The room's returns (slap-back, open-country echo) and `reverbSend` (acoustics-audio.js).
        buildRoom();
        for (const [name, url] of Object.entries(ASSETS.audio || {})) {
          const bytes = dataUrlBytes(url);
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
      // The tyres and the rotor are vehicles; the siren has its own slider and is
      // placed on the nearest cruiser (pan, Doppler: soundUpdate).
      const pan = audio.createStereoPanner();
      s.connect(filter).connect(g).connect(pan).connect(name === 'siren' ? sirenBus : engineBus);
      s.start();
      audioLoops[name] = {
        source: s,
        gain: g,
        filter,
        pan,
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
    /**
     * LOUD DUCK: a shot or a blast near the ear dips the ambience (the beds, the street,
     * rain) by up to 5 dB in ~15 ms, holds 0.12 s and lets it back over ~1 s, so gunfire
     * punches out of the street. `level` is the sound's direct level (volume x distance
     * and occlusion); far shots (under ~0.1) do not duck. Released in soundUpdate.
     */
    const loudDuck = { depth: 0, hold: 0, events: 0 };
    function duckForLoud(level) {
      if (!ambienceDuck) return;
      const depth = clamp((level - 0.08) * 0.7, 0, 0.45);
      if (depth < 0.02) return;
      loudDuck.events++;
      loudDuck.hold = 0.12;
      if (depth <= loudDuck.depth) return;
      loudDuck.depth = depth;
      ambienceDuck.gain.setTargetAtTime(1 - depth, audio.currentTime, 0.006);
    }
    function updateLoudDuck(deltaSeconds) {
      if (!ambienceDuck || loudDuck.depth <= 0) return;
      if (loudDuck.hold > 0) {
        loudDuck.hold -= deltaSeconds;
        return;
      }
      loudDuck.depth *= Math.exp(-deltaSeconds / 0.35);
      if (loudDuck.depth < 0.005) loudDuck.depth = 0;
      glideParam(ambienceDuck.gain, 1 - loudDuck.depth, audio.currentTime, 0.12);
    }
    /* A recorded sample, optionally from a map position (attenuated and panned
       from the player; a position with an `elevation` also counts the height
       between it and the player, e.g. the Falcon's train) and `delay` seconds
       from now. A positioned sound is dulled by distance and muffled behind a
       building (acoustics-audio.js soundShade); gunfire and explosions also send
       to the room (the reverb, a street's slap-back, the county's echo). */
    const ROOM_SAMPLES = new Set(['pistol', 'automatic', 'shotgun', 'rifle', 'explosion']);
    function playSample(name, volume = 0.5, rate = 1, position = null, bus = master, delay = 0) {
      if (!audio || !soundOn) return;
      const b = audioBuffers[name];
      if (!b) return;
      const s = audio.createBufferSource(),
        g = audio.createGain(),
        pan = audio.createStereoPanner();
      s.buffer = b;
      s.playbackRate.value = rate;
      let attenuation = 1,
        distance = 0,
        air = null,
        send = null;
      if (position) {
        const rise = position.elevation === undefined ? 0 : position.elevation - entityElevation(player);
        distance = Math.hypot(distanceBetween(position, player), rise);
        attenuation = 1 / (1 + distance / 230);
        pan.pan.value = clamp((position.x - player.x) / 450, -0.9, 0.9);
        if (distance > 24) {
          const shade = soundShade(position, distance);
          attenuation *= shade.gain;
          air = audio.createBiquadFilter();
          air.type = 'lowpass';
          air.frequency.value = shade.cutoff;
          air.Q.value = 0.5;
        }
      }
      g.gain.value = volume * attenuation;
      (air ? s.connect(air) : s).connect(g).connect(pan).connect(bus || master);
      if (ROOM_SAMPLES.has(name)) duckForLoud(volume * attenuation);
      if (ROOM_SAMPLES.has(name) && reverbSend) {
        send = audio.createGain();
        send.gain.value = volume * roomSendLevel(distance);
        s.connect(send).connect(reverbSend);
      }
      s.start(delay > 0 ? audio.currentTime + delay : 0);
      s.onended = () => {
        s.disconnect();
        g.disconnect();
        pan.disconnect();
        if (air) air.disconnect();
        if (send) send.disconnect();
      };
    }
    function tone(f, d = 0.1, v = 0.2, type = 'sine', end) {
      if (!audio || !soundOn) return;
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = type === 'square' ? 'triangle' : type;
      o.frequency.setValueAtTime(f, audio.currentTime);
      if (end) o.frequency.exponentialRampToValueAtTime(end, audio.currentTime + d);
      // A 4 ms attack: a beep that starts at full level clicks in.
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.linearRampToValueAtTime(v * 0.35, audio.currentTime + Math.min(0.004, d * 0.2));
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d);
      o.connect(g).connect(master);
      o.start();
      o.stop(audio.currentTime + d);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
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
          locked = road && c.tyres ? Math.max(c.tyres.lock[0], c.tyres.lock[1]) : 0,
          // Only tarmac howls: sand, grass and dirt hiss and crunch instead (the
          // scrub, vehicle-foley-audio.js), and a wet road squeals softer and lower.
          ground = road ? tyreGround(c) : null,
          squeal = !ground ? 0 : ground.loose ? 0.12 : 1 - 0.45 * ground.wet;
        glideParam(tires.gain.gain, active && slip > 0.08 ? (0.05 + 0.19 * Math.pow(slip, 0.8)) * squeal : 0, audio.currentTime, 0.07);
        glideParam(tires.source.playbackRate, (1.04 - 0.14 * locked + 0.06 * (c?.tyres?.spin || 0)) * (1 - 0.07 * (ground?.wet || 0)), audio.currentTime, 0.1);
      }
      // The horn, the loose-ground scrub and traffic skids (vehicle-foley-audio.js).
      updateVehicleFoley(deltaSeconds, active);
      // The ear probe and the room's returns (acoustics-audio.js).
      updateAcoustics(deltaSeconds);
      // The ambience coming back up after a shot or a blast (LOUD DUCK).
      updateLoudDuck(deltaSeconds);
      // Enemy rounds passing close: the whizz and the crack (bullets-audio.js).
      updateBulletWhizz(deltaSeconds, active);
      absBuzz(active && !!c?.absActive);
      const siren = audioLoops.siren;
      if (siren) {
        let d = 10000,
          nearest = null;
        for (let k = 0; k < vehicles.length; k++) {
          const car = vehicles[k];
          if (car.hp > 0 && ((car.cop && wantedStars > 0) || car.gangTarget || car.emergency?.running)) {
            const dc = distanceBetween(car, player);
            if (dc < d) {
              d = dc;
              nearest = car;
            }
          }
        }
        glideParam(siren.gain.gain,
          active ? clamp(1 - d / 700, 0, 1) * 0.18 : 0,
          audio.currentTime,
          0.2,
        );
        // From where the cruiser is, pitched by its closing speed (the traffic
        // engines' Doppler, engine-audio.js), dull behind a building.
        const shade = nearest && d < 700 ? soundShade(nearest, d) : null;
        glideParam(siren.filter.frequency, Math.min(clamp(6500 - d * 7, 800, 6500), shade ? Math.max(650, shade.cutoff) : 6500), audio.currentTime, 0.2);
        if (nearest) {
          const dx = nearest.x - player.x,
            dy = nearest.y - player.y,
            dd = Math.max(1, d),
            ear = player.car || null,
            closing = ((nearest.vx || 0) * -dx + (nearest.vy || 0) * -dy) / dd - ((ear?.vx || 0) * -dx + (ear?.vy || 0) * -dy) / dd;
          glideParam(siren.pan.pan, clamp(dx / 450, -0.8, 0.8), audio.currentTime, 0.15);
          glideParam(siren.source.playbackRate, clamp(SOUND_SPEED / (SOUND_SPEED - closing), 0.86, 1.16), audio.currentTime, 0.12);
        }
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
      // Footsteps by surface, landings and the rustle of a run (footsteps-audio.js).
      updateFootsteps(deltaSeconds, active);
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
      // Every police recording is a man's voice: an officer who is a woman has a male
      // colleague nearby shout it, or it is only captioned (voices.js maleVoiceNear).
      const speaker = police && position && officers.includes(position) ? maleVoiceNear(position) : position;
      if (speaker || !police || !position) playSample(name, 0.7, 1, speaker, voiceBus);
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
          // LOUD DUCK: the ambience dip under nearby gunfire (1 = open) and dips so far.
          loudDuck: ambienceDuck ? { gain: +ambienceDuck.gain.value.toFixed(3), depth: +loudDuck.depth.toFixed(3), events: loudDuck.events } : null,
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
        // The ear probe (enclosure, walls, relief, lift), the zone and the room's
        // returns (acoustics-audio.js).
        acoustics: (x, y) => acousticsReport(x, y),
        // The ambience beds: zone weights, gusts, bed levels, events heard (ambience-beds.js).
        soundscape: () => ({ ...ambienceBedsReport(), cabin: ambience ? Math.round(ambience.cabin.frequency.value) : null, acoustics: acousticsReport() }),
        // The ground under the player's steps (or at x, y), steps and landings (footsteps-audio.js).
        footsteps: (x, y) => footstepsReport(x, y),
        // The horn, the tyres' ground, the scrub, the traffic skid voice, doors (vehicle-foley-audio.js).
        vehicleFoley: () => vehicleFoleyReport(),
      };
    }
    // END SUBSYSTEM: src/audio.js
