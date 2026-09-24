    // BEGIN SUBSYSTEM: src/audio.js — Effects and voice audio
    /**
     * Effects and voice audio
     * Source: src/audio.js
     * Scope: shared game closure.
     * Embedded samples, Web Audio lifecycle, spatial volume and procedural sound.
     */
    let soundOn = true,
      audio = null,
      // `master` is the effects bus: everything but the radio callouts goes
      // through it. Its level is the Sound on/off switch times the master and
      // effects volumes (settings.js); `voiceBus` carries the callouts.
      master = null,
      voiceBus = null,
      engine = null;
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
        master = audio.createGain();
        master.gain.value = effectsLevel();
        earFilter = audio.createBiquadFilter();
        earFilter.type = 'lowpass';
        earFilter.frequency.value = 20000;
        earFilter.Q.value = 0.5;
        master.connect(earFilter).connect(limiter).connect(audio.destination);
        voiceBus = audio.createGain();
        voiceBus.gain.value = voiceLevel();
        voiceBus.connect(earFilter);
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
              if (['engine', 'tires', 'siren', 'rotor-loop'].includes(name)) startLoop(name);
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
      filter.frequency.value = name === 'engine' ? 2200 : 4800;
      g.gain.value = 0;
      s.connect(filter).connect(g).connect(master);
      s.start();
      audioLoops[name] = {
        source: s,
        gain: g,
        filter,
      };
    }
    // Output levels of the two buses (0.62 is the mix's nominal level).
    function effectsLevel() {
      return soundOn ? 0.62 * volumeScale('sound') : 0;
    }
    function voiceLevel() {
      return soundOn ? 0.62 * volumeScale('voice') : 0;
    }
    function playSample(name, volume = 0.5, rate = 1, position = null, bus = master) {
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
        const distance = distanceBetween(position, player);
        attenuation = 1 / (1 + distance / 230);
        pan.pan.value = clamp((position.x - player.x) / 450, -0.9, 0.9);
      }
      g.gain.value = volume * attenuation;
      s.connect(g).connect(pan).connect(bus || master);
      if (['pistol', 'automatic', 'shotgun', 'rifle', 'explosion'].includes(name)) pan.connect(reverb);
      s.start();
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
      const en = audioLoops.engine;
      if (en) {
        const speed = c ? Math.abs(c.speed) : 0,
          t = c ? vehicleSpec(c) : {},
          ratio = c ? clamp(speed / t.max, 0, 1) : 0,
          gear = Math.min(5, Math.floor(ratio * 5)),
          rpm = t.plane
            ? 0.75 + (c.throttle || 0) * 0.9
            : t.boat
              ? 0.65 + ratio * 0.7
              : t.bike
                ? 1 + ((ratio * 5) % 1) * 0.6 + gear * 0.07
                : t.truck
                  ? 0.5 + ((ratio * 5) % 1) * 0.3 + gear * 0.03
                  : 0.65 + ((ratio * 5) % 1) * 0.65 + gear * 0.07;
        glideParam(en.source.playbackRate, rpm, audio.currentTime, 0.13);
        glideParam(en.gain.gain, 
          active && c && !t.bicycle && c.type !== 'helicopter' && c.hp > 0 ? 0.11 + speed * 0.00038 : 0,
          audio.currentTime,
          0.1,
        );
        glideParam(en.filter.frequency, 900 + speed * 7, audio.currentTime, 0.15);
      }
      const tires = audioLoops.tires;
      if (tires) {
        const slipping =
          c &&
          !isAircraft(c) &&
          !vehicleSpec(c).boat &&
          // Narrow bicycle tyres do not howl through a turn.
          !vehicleSpec(c).bicycle &&
          Math.abs(c.speed) > 70 &&
          (keys.Space || Math.abs(normalizeAngle(c.a - (c.moveA ?? c.a))) > 0.14);
        glideParam(tires.gain.gain, active && slipping ? 0.19 : 0, audio.currentTime, 0.08);
      }
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
        footstepClock = keys.ShiftLeft ? 0.22 : 0.34;
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
    // END SUBSYSTEM: src/audio.js
