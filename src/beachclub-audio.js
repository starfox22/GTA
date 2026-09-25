    // BEGIN SUBSYSTEM: src/beachclub-audio.js — Marea Beach Club music
    /**
     * Marea Beach Club music
     * Source: src/beachclub-audio.js
     * Scope: shared game closure.
     *
     * Procedural sets for the club, played through Web Audio with a look-ahead
     * scheduler (notes are queued on the audio clock a fraction of a second
     * ahead, so the groove holds steady whatever the frame rate):
     *   day     102 BPM  balearic: soft kick, rim, shaker, dub bass, electric
     *                    piano chords and a kalimba line through a tape echo
     *   sunset  114 BPM  the same palette on a four-to-the-floor kick
     *   night   124 BPM  house: kick, clap, hats, offbeat bass, chord stabs; a
     *                    32-bar cycle of groove, breakdown (pads and arpeggio),
     *                    a snare-roll build with a riser, and the drop
     * One bus carries it all: a section filter (the build opens it), then a
     * "wall" low-pass set by where the listener is. Inside the club it is open;
     * on the street side the white wall leaves only the thump; across the sand
     * the open deck lets more through. Volume falls off with distance.
     *
     * `mareaGroove` is the musical clock the dancers read (crowd3d.js): the beat
     * position (from the audio clock while music plays, from game time when the
     * sound is off), the section, an energy level and when the last drop hit.
     */
    const MAREA_SETS = {
      day: {
        bpm: 102,
        level: 0.34,
        cycle: 16,
        chords: [
          [146.83, 185.0, 220.0, 277.18],
          [123.47, 146.83, 185.0, 220.0],
          [98.0, 123.47, 146.83, 185.0],
          [110.0, 138.59, 164.81, 220.0],
        ],
        roots: [73.42, 61.74, 49.0, 55.0],
        scale: [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99],
      },
      sunset: {
        bpm: 114,
        level: 0.46,
        cycle: 16,
        chords: [
          [164.81, 196.0, 246.94, 293.66],
          [130.81, 164.81, 196.0, 246.94],
          [146.83, 174.61, 220.0, 261.63],
          [123.47, 146.83, 185.0, 220.0],
        ],
        roots: [82.41, 65.41, 73.42, 61.74],
        scale: [329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0],
      },
      night: {
        bpm: 124,
        level: 0.62,
        cycle: 32,
        chords: [
          [220.0, 261.63, 329.63],
          [174.61, 220.0, 261.63],
          [261.63, 329.63, 392.0],
          [196.0, 246.94, 293.66],
        ],
        roots: [55.0, 43.65, 65.41, 49.0],
        scale: [440.0, 523.25, 587.33, 659.25, 783.99, 880.0],
      },
    };
    const mareaGroove = { beat: 0, bpm: 124, set: null, section: 'off', energy: 0, dropAt: -100, bar: 0, playing: false };
    const mareaMusic = {
      nodes: null,
      noise: null,
      set: null,
      step: 0,
      stepTime: 0,
      gain: 0,
      cutoff: 20000,
      fading: false,
    };
    function mareaMusicNodes() {
      if (mareaMusic.nodes || !audio || !master) return mareaMusic.nodes;
      const input = audio.createGain(),
        tone = audio.createBiquadFilter(),
        wall = audio.createBiquadFilter(),
        out = audio.createGain(),
        delay = audio.createDelay(1.5),
        feedback = audio.createGain(),
        echo = audio.createGain(),
        verb = audio.createGain();
      tone.type = 'lowpass';
      tone.frequency.value = 18000;
      tone.Q.value = 0.9;
      wall.type = 'lowpass';
      wall.frequency.value = 800;
      wall.Q.value = 0.6;
      out.gain.value = 0;
      delay.delayTime.value = 0.44;
      feedback.gain.value = 0.38;
      echo.gain.value = 1;
      verb.gain.value = 0.35;
      input.connect(tone).connect(wall).connect(out).connect(musicBus);
      echo.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(tone);
      if (reverb) wall.connect(verb).connect(reverb);
      const rate = audio.sampleRate,
        buffer = audio.createBuffer(1, rate, rate),
        d = buffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      mareaMusic.noise = buffer;
      mareaMusic.nodes = { input, tone, wall, out, delay, feedback, echo };
      return mareaMusic.nodes;
    }
    /* Deterministic per-step variation, so a pattern repeats like a real loop. */
    function mareaHash(n) {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    }
    /* ---- instruments: each builds a few nodes that disconnect themselves ---- */
    function mareaEnvelope(g, t, peak, attack, decay) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function mareaOsc(type, f, t, peak, attack, decay, dest, filter, detune = 0) {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      o.detune.value = detune;
      mareaEnvelope(g, t, peak, attack, decay);
      let node = o;
      if (filter) node = o.connect(filter);
      node.connect(g).connect(dest || mareaMusic.nodes.input);
      o.start(t);
      o.stop(t + attack + decay + 0.05);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
        if (filter) filter.disconnect();
      };
      return o;
    }
    function mareaNoise(t, peak, attack, decay, type, frequency, q = 0.8, dest) {
      const s = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        g = audio.createGain();
      s.buffer = mareaMusic.noise;
      f.type = type;
      f.frequency.setValueAtTime(frequency, t);
      f.Q.value = q;
      mareaEnvelope(g, t, peak, attack, decay);
      s.connect(f).connect(g).connect(dest || mareaMusic.nodes.input);
      s.start(t, Math.random() * 0.5);
      s.stop(t + attack + decay + 0.05);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        g.disconnect();
      };
      return f;
    }
    function mareaLowpass(t, from, to, time, q = 1) {
      const f = audio.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = q;
      f.frequency.setValueAtTime(from, t);
      f.frequency.exponentialRampToValueAtTime(to, t + time);
      return f;
    }
    function mareaKick(t, level) {
      const o = mareaOsc('sine', 150, t, 0.9 * level, 0.004, 0.36);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
      mareaNoise(t, 0.05 * level, 0.001, 0.012, 'highpass', 3000);
    }
    function mareaClap(t, level) {
      for (let k = 0; k < 3; k++) mareaNoise(t + k * 0.011, 0.16 * level, 0.001, 0.03, 'bandpass', 1500, 1.2);
      mareaNoise(t + 0.03, 0.12 * level, 0.002, 0.16, 'bandpass', 1200, 0.9);
    }
    function mareaHat(t, level, open) {
      mareaNoise(t, (open ? 0.07 : 0.05) * level, 0.001, open ? 0.22 : 0.035, 'highpass', open ? 7500 : 9000, 0.7);
    }
    function mareaBass(t, f, len, level, cutoff = 520) {
      mareaOsc('sawtooth', f, t, 0.28 * level, 0.005, len, null, mareaLowpass(t, cutoff * 2.2, cutoff * 0.5, len, 4));
      mareaOsc('sine', f, t, 0.3 * level, 0.005, len);
    }
    function mareaStab(t, chord, len, level) {
      for (const f of chord)
        for (const dt of [-8, 8]) mareaOsc('sawtooth', f, t, 0.05 * level, 0.004, len, null, mareaLowpass(t, 3200, 600, len, 2), dt);
    }
    function mareaPad(t, chord, len, level) {
      for (const f of chord) {
        mareaOsc('triangle', f, t, 0.05 * level, len * 0.35, len * 0.8, null, null, -5);
        mareaOsc('sawtooth', f * 0.5, t, 0.02 * level, len * 0.4, len * 0.7, null, mareaLowpass(t, 900, 1400, len, 0.5), 6);
      }
    }
    function mareaPluck(t, f, level, echo = true) {
      mareaOsc('square', f, t, 0.05 * level, 0.003, 0.2, echo ? mareaMusic.nodes.echo : null, mareaLowpass(t, 4200, 900, 0.2, 3));
      if (echo) mareaOsc('square', f, t, 0.04 * level, 0.003, 0.2, null, mareaLowpass(t, 4200, 900, 0.2, 3));
    }
    function mareaKeys(t, chord, len, level) {
      for (const f of chord) {
        mareaOsc('sine', f, t, 0.06 * level, 0.01, len);
        mareaOsc('triangle', f * 2, t, 0.012 * level, 0.005, len * 0.35);
      }
    }
    function mareaKalimba(t, f, level) {
      mareaOsc('sine', f, t, 0.08 * level, 0.002, 0.5, mareaMusic.nodes.echo);
      mareaOsc('sine', f, t, 0.07 * level, 0.002, 0.45);
      mareaOsc('sine', f * 5.4, t, 0.012 * level, 0.001, 0.06);
    }
    function mareaShaker(t, level) {
      mareaNoise(t, 0.035 * level, 0.008, 0.05, 'bandpass', 6500, 1.4);
    }
    function mareaRim(t, level) {
      mareaNoise(t, 0.1 * level, 0.001, 0.03, 'bandpass', 2400, 4);
      mareaOsc('sine', 820, t, 0.05 * level, 0.001, 0.03);
    }
    function mareaRiser(t, length, level) {
      const f = mareaNoise(t, 0.09 * level, length * 0.9, 0.1, 'bandpass', 400, 2.5);
      f.frequency.exponentialRampToValueAtTime(7000, t + length);
    }
    function mareaCrash(t, level) {
      mareaNoise(t, 0.12 * level, 0.002, 1.8, 'highpass', 5200, 0.6);
    }
    /* Which part of the night set a bar is in. */
    function mareaSection(set, bar) {
      if (!set) return 'off';
      if (set === 'night') {
        const b = bar % 32;
        return b < 16 ? 'groove' : b < 24 ? 'break' : b < 28 ? 'build' : 'drop';
      }
      return bar % 16 >= 8 && bar % 16 < 12 ? 'lift' : 'groove';
    }
    function mareaEnergy(set, bar, beat) {
      const section = mareaSection(set, bar);
      if (set === 'day') return 0.25;
      if (set === 'sunset') return section === 'lift' ? 0.5 : 0.42;
      if (section === 'break') return 0.35;
      if (section === 'build') return 0.45 + ((bar % 32) - 24 + (beat % 4) / 4) * 0.12;
      if (section === 'drop') return 1;
      return 0.8;
    }
    /* One sixteenth of the current set, scheduled at audio time t. */
    function mareaScheduleStep(setName, n, t) {
      const set = MAREA_SETS[setName],
        bar = Math.floor(n / 16),
        s = n % 16,
        chord = set.chords[((bar % 4) + 4) % 4],
        root = set.roots[((bar % 4) + 4) % 4],
        sixteenth = 60 / set.bpm / 4,
        section = mareaSection(setName, bar),
        h = mareaHash(n);
      if (setName === 'night') {
        const cb = bar % 32;
        if (section !== 'break' && s % 4 === 0 && !(cb === 27 && s >= 8)) mareaKick(t, cb === 28 && s === 0 ? 1.15 : 1);
        if ((section === 'groove' || section === 'drop') && (s === 4 || s === 12)) mareaClap(t, 1);
        if (section === 'build') {
          const every = cb === 24 ? 4 : cb === 25 ? 2 : 1;
          if (s % every === 0) mareaClap(t, 0.35 + ((cb - 24) * 16 + s) / 64);
          if (cb === 24 && s === 0) mareaRiser(t, sixteenth * 64, 1);
          if (cb === 27) mareaMusic.nodes.tone.frequency.setTargetAtTime(700 + s * 700, t, 0.05);
        }
        if (section === 'groove' || section === 'drop') {
          if (s % 2 === 1) mareaHat(t, s % 4 === 3 ? 0.7 : 1, false);
          if (s % 4 === 2) mareaHat(t, 1, true);
          if (s % 4 === 2) mareaBass(t, section === 'drop' && (s === 6 || s === 14) ? root * 2 : root, sixteenth * 1.7, 1, section === 'drop' ? 700 : 520);
          const stabs = section === 'drop' ? [0, 3, 6, 10, 12] : [6, 14];
          if (stabs.includes(s)) mareaStab(t, chord, sixteenth * (section === 'drop' ? 1.4 : 1.8), section === 'drop' ? 1.1 : 0.9);
          if (section === 'drop' && s % 2 === 0) mareaPluck(t, set.scale[Math.floor(mareaHash(bar * 7 + s) * set.scale.length)], 0.8);
        }
        if (section === 'break' || section === 'build') {
          if (s === 0 && section === 'break') mareaPad(t, chord, sixteenth * 16, 1.2);
          if (s === 0 && section === 'break') mareaOsc('sine', root, t, 0.2, 0.08, sixteenth * 14);
          if (cb >= 18) mareaPluck(t, chord[s % chord.length] * (s % 8 < 4 ? 2 : 4), 0.55 + (cb - 18) * 0.05);
          if (s % 4 === 2) mareaHat(t, 0.5, false);
        }
        if ((cb === 28 || cb === 0) && s === 0) mareaCrash(t, cb === 28 ? 1.2 : 0.6);
        if (cb === 28 && s === 0) {
          mareaMusic.nodes.tone.frequency.cancelScheduledValues(t);
          mareaMusic.nodes.tone.frequency.setValueAtTime(18000, t);
        }
        if (cb === 16 && s === 0) mareaMusic.nodes.tone.frequency.setTargetAtTime(2400, t, 0.4);
        if (cb === 0 && s === 0) mareaMusic.nodes.tone.frequency.setTargetAtTime(18000, t, 0.1);
        return;
      }
      // Day and sunset: the same palette, sunset on a steady kick.
      const sunset = setName === 'sunset',
        lift = section === 'lift';
      if (sunset ? s % 4 === 0 : s === 0 || s === 10) mareaKick(t, sunset ? 0.7 : 0.55);
      if (s === 4 || s === 12) mareaRim(t, 0.8);
      mareaShaker(t, s % 2 ? 1 : 0.55);
      if (sunset && s % 4 === 2) mareaHat(t, 0.6, true);
      const bassSteps = sunset ? [2, 6, 10, 14] : [0, 3, 8, 11];
      if (bassSteps.includes(s)) mareaBass(t, s === 8 && !sunset ? root * 1.5 : root, sixteenth * (sunset ? 1.6 : 2.6), 0.8, 380);
      if (s === 0) mareaKeys(t, chord, sixteenth * 10, 1);
      if (s === 8 && h < 0.6) mareaKeys(t, chord.slice(1), sixteenth * 6, 0.6);
      if ((lift || bar % 16 >= 4) && s % 2 === 0 && h < (lift ? 0.55 : 0.28))
        mareaKalimba(t, set.scale[Math.floor(mareaHash(n + 99) * set.scale.length)], lift ? 1 : 0.8);
    }
    /* Which set should be playing now (null for silence). */
    function mareaWantedSet() {
      if (gameTime < marea.spookedUntil) return null;
      const t = mareaHour();
      if (!marea.levels?.dj) return null;
      if (marea.phase === 'day') return 'day';
      if (marea.phase === 'sunset') return t < 21.5 ? 'sunset' : null;
      if (marea.phase === 'night' || (marea.phase === 'closing' && t < 28.4)) return 'night';
      return null;
    }
    function updateMareaMusic(deltaSeconds, far) {
      const setName = mareaWantedSet(),
        set = setName && MAREA_SETS[setName],
        audible = !!(set && audio && soundOn && gameMode === 'play' && far < 1100 && audio.state === 'running');
      // The groove clock runs whether or not anyone can hear it.
      if (set) mareaGroove.bpm = set.bpm;
      if (!audible || !mareaMusicNodes()) {
        if (mareaMusic.nodes) glideParam(mareaMusic.nodes.out.gain, 0, audio.currentTime, 0.3);
        mareaMusic.set = null;
        mareaGroove.playing = false;
        mareaGroove.beat += deltaSeconds * (mareaGroove.bpm / 60);
      } else {
        const now = audio.currentTime,
          sixteenth = 60 / set.bpm / 4;
        if (mareaMusic.set !== setName || mareaMusic.stepTime < now - 0.4) {
          // Start (or re-sync) on the next bar of the groove clock, so dancers never jump.
          mareaMusic.set = setName;
          mareaMusic.step = Math.ceil((mareaGroove.beat * 4) / 16) * 16;
          mareaMusic.stepTime = now + 0.08;
          mareaMusic.nodes.tone.frequency.setValueAtTime(18000, now);
        }
        const horizon = now + clamp(deltaSeconds * 2.5, 0.2, 0.9);
        while (mareaMusic.stepTime < horizon) {
          mareaScheduleStep(setName, mareaMusic.step, mareaMusic.stepTime);
          mareaMusic.step++;
          mareaMusic.stepTime += sixteenth;
        }
        // The beat the listener hears right now.
        mareaGroove.beat = (mareaMusic.step - (mareaMusic.stepTime - now) / sixteenth) / 4;
        mareaGroove.playing = true;
        // Where the listener is: inside, on the street behind the wall, or out on the sand.
        const who = player.car || player,
          inside = mareaInside(who.x, who.y),
          d = mareaDistance(who.x, who.y),
          local = mareaLocal(who.x, who.y),
          seaSide = local.v > 240 || (local.u > 380 && local.v > 180),
          gain = set.level * (inside ? 1 : 1 / (1 + d / (seaSide ? 240 : 150))) * (player.car && !inside ? 0.7 : 1),
          cutoff = inside ? 16000 : seaSide ? 700 + 3200 / (1 + d / 160) : 260 + 900 / (1 + d / 40);
        mareaMusic.gain = gain;
        mareaMusic.cutoff = cutoff;
        glideParam(mareaMusic.nodes.out.gain, gain, now, 0.25);
        glideParam(mareaMusic.nodes.wall.frequency, cutoff, now, 0.25);
      }
      mareaGroove.set = setName;
      mareaGroove.bar = Math.floor(mareaGroove.beat / 4);
      const section = mareaSection(setName, mareaGroove.bar);
      if (section === 'drop' && mareaGroove.section === 'build') mareaGroove.dropAt = gameTime;
      mareaGroove.section = section;
      mareaGroove.energy = setName ? mareaEnergy(setName, mareaGroove.bar, mareaGroove.beat) : 0;
    }
    function mareaMusicReport() {
      return {
        set: mareaGroove.set,
        playing: mareaGroove.playing,
        bpm: mareaGroove.bpm,
        bar: mareaGroove.bar,
        section: mareaGroove.section,
        energy: Math.round(mareaGroove.energy * 100) / 100,
        gain: Math.round(mareaMusic.gain * 1000) / 1000,
        cutoff: Math.round(mareaMusic.cutoff),
      };
    }
    // END SUBSYSTEM: src/beachclub-audio.js
