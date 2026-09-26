    // BEGIN SUBSYSTEM: src/sealife-audio.js — Sea life sound
    /**
     * Sea life sound
     * Source: src/sealife-audio.js
     * Scope: shared game closure.
     * The gulls, the dolphins and the shark's score (sealife.js calls these).
     */
    /**
     * RECORDINGS (assets/audio/sealife-*.ogg, CC0; docs/THIRD_PARTY_CREDITS.txt)
     * Each file is a sprite of short takes laid end to end; SEA_SPRITES lists
     * where each take starts, how long it runs and its loudness, so every take
     * plays at the same level (`seaSprite`):
     *   sealife-gulls   six herring gull calls
     *   sealife-splash  four splashes (a body into the water)
     *   sealife-big     two big splashes (a breach and the fall back)
     *   sealife-blow    three cetacean breaths, played up in pitch for the
     *                   dolphins' blow
     * PROCEDURAL
     *   whistles  bottlenose signature whistles: a sine gliding along a contour
     *             (up, down, a U, a looping wave) with a quiet second harmonic,
     *             pitched down into the audible band, heard near the pod (and
     *             more clearly with the ears under water)
     *   clicks    echolocation trains: 1 ms clicks whose rate climbs into a buzz
     *   score     the shark's music (on the music bus): a low stab and boom when
     *             the fin appears, a heartbeat of bowed double basses that
     *             quickens as it closes, a dissonant string drone opening up
     *             over it, all cut to a rising swell when it dives, then the hit
     *             of the attack or a soft release when the swimmer gets away
     */
    const SEA_SPRITES = {
      'sealife-gulls': { slices: [[0.08, 1.001], [1.161, 1.404], [2.645, 0.904], [3.629, 1.114], [4.823, 1.044], [5.947, 0.527]], lufs: [-15.9, -16.2, -18.1, -11.8, -12.8, -12.8] },
      'sealife-splash': { slices: [[0.08, 1.604], [1.764, 2.207], [4.051, 2.213], [6.344, 1.906]], lufs: [-19, -18, -14.1, -15.5] },
      'sealife-big': { slices: [[0.08, 2.148], [2.308, 1.778]], lufs: [-15.6, -18.7] },
      'sealife-blow': { slices: [[0.08, 2.006], [2.166, 1.333], [3.579, 1.514]], lufs: [-13.3, -14.2, -14.4] },
    };
    const SEA_SPRITE_LUFS = -16;
    /* One take of a sprite from a map position; false if the recording is not loaded. */
    function seaSprite(name, slice, volume, rate = 1, position = null, options = {}) {
      if (!audio || !soundOn) return false;
      const buffer = audioBuffers[name],
        sprite = SEA_SPRITES[name];
      if (!buffer || !sprite) return false;
      const i = slice === undefined || slice === null ? Math.floor(Math.random() * sprite.slices.length) : slice % sprite.slices.length,
        [start, duration] = sprite.slices[i],
        level = volume * Math.pow(10, (SEA_SPRITE_LUFS - sprite.lufs[i]) / 20) * (position ? 1 / (1 + distanceBetween(position, player) / 260) : 1);
      if (level < 0.003) return true;
      const t = audio.currentTime + (options.delay || 0),
        s = audio.createBufferSource(),
        g = audio.createGain(),
        p = audio.createStereoPanner();
      let tail = g;
      s.buffer = buffer;
      s.playbackRate.value = rate;
      g.gain.value = level;
      s.connect(g);
      if (options.lowpass) {
        const f = audio.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = options.lowpass;
        g.connect(f);
        tail = f;
      }
      p.pan.value = position ? clamp((position.x - player.x) / 450, -0.9, 0.9) : 0;
      tail.connect(p).connect(options.bus || ambienceBus);
      s.start(t, start, duration);
      s.onended = () => {
        s.disconnect();
        g.disconnect();
        if (tail !== g) tail.disconnect();
        p.disconnect();
      };
      return true;
    }
    function seaAudible(position, reach) {
      return !!audio && soundOn && gameMode === 'play' && distanceBetween(position, player) < reach;
    }
    // ---- Gulls ----------------------------------------------------------------------
    /* A recorded gull call from a flock position (water-audio.js gullCall uses it too). */
    function gullRecording(position, strength = 0.7) {
      return seaSprite('sealife-gulls', null, 0.2 * strength, 0.92 + Math.random() * 0.16, position);
    }
    let gullHeardAt = -99;
    function gullCallSound(g, strength) {
      // A flock calls now and then, not all at once: one call every couple of seconds at most.
      if (!seaAudible(g, 900) || gameTime - gullHeardAt < 1.6 + Math.random() * 1.6) return;
      gullHeardAt = gameTime;
      // A gull high overhead is heard a little dulled.
      if (!seaSprite('sealife-gulls', null, 0.22 * strength, 0.9 + Math.random() * 0.2, g, { lowpass: g.z > 150 ? 5000 : 0 })) gullCall(g);
    }
    // ---- Dolphins ---------------------------------------------------------------------
    function dolphinBlowSound(m) {
      if (!seaAudible(m, 700)) return;
      if (!seaSprite('sealife-blow', null, 0.26 * m.scale, 1.7 + Math.random() * 0.35 + (1 - m.scale) * 0.8, m, { lowpass: 5200 }))
        shapedNoise({ type: 'bandpass', freq: 1500, sweepTo: 700, q: 0.8, attack: 0.02, decay: 0.35, gain: 0.05, position: m });
      if (Math.random() < 0.35) dolphinVoice(m, 0.5);
    }
    function dolphinSplashSound(m, force) {
      if (!seaAudible(m, 900)) return;
      const big = force > 1.2;
      if (!seaSprite(big ? 'sealife-big' : 'sealife-splash', big ? 1 : null, (big ? 0.4 : 0.34) * force, (big ? 1.35 : 1.1) + Math.random() * 0.15, m))
        waterSplashSound(force, m);
    }
    /**
     * A dolphin's voice: usually a whistle, sometimes a click train or a burst of
     * both. Pitched into the audible band and kept quiet; louder with the ears
     * under water (a swimmer near the pod).
     */
    function dolphinVoice(m, strength = 1) {
      if (!seaAudible(m, 520)) return;
      const under = player.swimming && !player.car ? 1.6 : 1,
        level = 0.03 * strength * under;
      const r = Math.random();
      if (r < 0.62) dolphinWhistle(m, level);
      else if (r < 0.85) dolphinClicks(m, level * 1.4);
      else {
        dolphinWhistle(m, level);
        dolphinClicks(m, level, 0.35);
      }
    }
    const WHISTLE_CONTOURS = [
      (k) => 0.55 + 0.45 * k, // upsweep
      (k) => 1 - 0.5 * k, // downsweep
      (k) => 0.6 + 0.4 * Math.pow(2 * k - 1, 2), // U
      (k) => 0.75 + 0.2 * Math.sin(k * TAU * 1.5), // wave
      (k) => 0.6 + 0.4 * Math.sin(k * Math.PI), // hill
    ];
    function dolphinWhistle(m, level, delay = 0) {
      const t = audio.currentTime + delay,
        duration = 0.35 + Math.random() * 0.6,
        top = 3600 + Math.random() * 3200,
        contour = WHISTLE_CONTOURS[Math.floor(Math.random() * WHISTLE_CONTOURS.length)],
        curve = new Float32Array(24);
      for (let i = 0; i < curve.length; i++) {
        const k = i / (curve.length - 1);
        curve[i] = top * contour(k) * (1 + Math.sin(k * 40) * 0.006);
      }
      const place = waterPlacement(m),
        gainValue = level * place.gain;
      if (gainValue < 0.002) return;
      const o1 = audio.createOscillator(),
        o2 = audio.createOscillator(),
        h = audio.createGain(),
        g = audio.createGain(),
        p = audio.createStereoPanner();
      o1.frequency.setValueCurveAtTime(curve, t, duration);
      const curve2 = curve.map((f) => f * 2);
      o2.frequency.setValueCurveAtTime(curve2, t, duration);
      h.gain.value = 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gainValue, t + 0.04);
      g.gain.setValueAtTime(gainValue, t + duration - 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      o1.connect(g);
      o2.connect(h).connect(g);
      p.pan.value = place.pan;
      g.connect(p).connect(ambienceBus);
      o1.start(t);
      o2.start(t);
      o1.stop(t + duration + 0.02);
      o2.stop(t + duration + 0.02);
      o1.onended = () => {
        o1.disconnect();
        o2.disconnect();
        h.disconnect();
        g.disconnect();
        p.disconnect();
      };
    }
    function dolphinClicks(m, level, delay = 0) {
      // A train whose rate climbs from a slow tick to a creaking buzz.
      const count = 12 + Math.floor(Math.random() * 20);
      let at = delay,
        gap = 0.06 + Math.random() * 0.04;
      for (let i = 0; i < count; i++) {
        shapedNoise({ type: 'bandpass', freq: 3800 + Math.random() * 1600, q: 1.8, attack: 0.0008, decay: 0.004, gain: level * (0.6 + Math.random() * 0.4), delay: at, position: m });
        at += gap;
        gap = Math.max(0.012, gap * 0.9);
      }
    }
    // ---- The shark ---------------------------------------------------------------------
    /**
     * The score's voices, built on first use: a drone of three detuned saws
     * through a low-pass whose cutoff opens with the tension, into the music bus.
     */
    let sharkMusic = null;
    function sharkMusicVoices() {
      if (sharkMusic || !audio) return sharkMusic;
      const out = audio.createGain();
      out.gain.value = 0;
      out.connect(musicBus);
      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      filter.Q.value = 2;
      filter.connect(out);
      const drone = [];
      for (const f of [82.4, 87.3, 116.5, 123.5]) {
        const o = audio.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = (Math.random() - 0.5) * 14;
        const g = audio.createGain();
        g.gain.value = 0.05;
        o.connect(g).connect(filter);
        o.start();
        drone.push({ o, g });
      }
      sharkMusic = { out, filter, drone, next: 0, beat: 0, tension: 0, running: false };
      return sharkMusic;
    }
    /* One bowed double-bass note (the heartbeat), into the music bus. */
    function sharkBassNote(freq, level, when, length = 0.42) {
      const t = audio.currentTime + when,
        g = audio.createGain(),
        f = audio.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(220, t);
      f.frequency.linearRampToValueAtTime(520, t + 0.05);
      f.frequency.exponentialRampToValueAtTime(180, t + length);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      const oscs = [];
      for (const [mul, det, type] of [[1, -6, 'sawtooth'], [1, 7, 'sawtooth'], [0.5, 0, 'sine']]) {
        const o = audio.createOscillator();
        o.type = type;
        o.frequency.value = freq * mul;
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + length + 0.05);
        oscs.push(o);
      }
      f.connect(g).connect(musicBus);
      oscs[0].onended = () => {
        for (const o of oscs) o.disconnect();
        f.disconnect();
        g.disconnect();
      };
    }
    /* A low cluster stab with a boom under it: the fin appears, and the attack. */
    function sharkStab(level, when = 0) {
      const t = audio.currentTime + when;
      for (const f of [41.2, 43.65, 58.3, 61.7, 87.3]) sharkBassNote(f, level * 0.5, when, 2.6);
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 1.2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(musicBus);
      o.start(t);
      o.stop(t + 1.7);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    }
    function sharkScore(cue) {
      if (!audio || !soundOn) return;
      const m = sharkMusicVoices(),
        t = audio.currentTime;
      if (!m) return;
      if (cue === 'start') {
        m.running = true;
        m.next = 1.4;
        m.beat = 0;
        sharkStab(0.3);
        glideParam(m.out.gain, 0.5, t, 1.2);
      } else if (cue === 'dive') {
        // The heartbeat stops; the strings swell and rise into silence.
        m.running = false;
        glideParam(m.filter.frequency, 2400, t, 0.8);
        glideParam(m.out.gain, 0.8, t, 0.6);
        for (const v of m.drone) v.o.detune.setTargetAtTime(v.o.detune.value + 300, t, 0.9);
      } else if (cue === 'attack') {
        glideParam(m.out.gain, 0, t + 0.05, 0.02);
        sharkStab(0.55, 0.05);
        for (const v of m.drone) v.o.detune.setTargetAtTime((Math.random() - 0.5) * 14, t + 1, 0.2);
      } else if (cue === 'release') {
        m.running = false;
        glideParam(m.out.gain, 0, t, 1.2);
        glideParam(m.filter.frequency, 300, t, 1.5);
        for (const v of m.drone) v.o.detune.setTargetAtTime((Math.random() - 0.5) * 14, t, 0.5);
        // A soft low chord that lets the breath out.
        for (const f of [82.4, 123.5, 164.8]) sharkBassNote(f, 0.05, 0.2, 2.8);
      }
    }
    function sharkRushSound(at) {
      if (!audio || !soundOn) return;
      shapedNoise({ type: 'lowpass', freq: 180, sweepTo: 1200, q: 1.2, attack: 0.45, decay: 0.2, gain: 0.25, position: at });
      waterTone({ freq: 45, to: 90, duration: 0.6, gain: 0.25, lowpass: 300, position: at });
    }
    function sharkBreachSound(at) {
      if (!audio || !soundOn) return;
      if (!seaSprite('sealife-big', 0, 1, 0.92, at)) waterSplashSound(3, at);
      waterTone({ freq: 80, to: 32, duration: 0.7, gain: 0.35, lowpass: 400, position: at });
    }
    function sharkFallSound(at) {
      if (!audio || !soundOn) return;
      if (!seaSprite('sealife-big', 1, 1, 0.78, at)) waterSplashSound(3, at);
      waterTone({ freq: 60, to: 28, duration: 0.9, gain: 0.35, lowpass: 300, position: at });
      droplets(14, 1.6, 0.03, at);
    }
    function sharkBumpSound(c) {
      if (!audio || !soundOn) return;
      // A dull knock through the hull, and the slap of the water after it.
      waterTone({ freq: 70, to: 36, duration: 0.35, gain: 0.45, lowpass: 260 });
      shapedNoise({ type: 'lowpass', freq: 420, sweepTo: 120, attack: 0.004, decay: 0.3, gain: 0.3 });
      if (!seaSprite('sealife-splash', 2, 0.45, 0.85, c, { delay: 0.08 })) waterSplashSound(1.2, c);
    }
    function beachShoutSound() {
      const beach = { x: -1970, y: 5560 };
      if (!seaAudible(beach, 1400)) return;
      const names = ['civilian-scream-female-1', 'civilian-scream-female-2', 'civilian-scream-male-1', 'civilian-scream-male-2'];
      if (Math.random() < 0.45) playSample(names[Math.floor(Math.random() * names.length)], 0.16, 0.95 + Math.random() * 0.1, { x: beach.x + (Math.random() - 0.5) * 500, y: beach.y }, ambienceBus);
    }
    /**
     * Per frame (from audio.js soundUpdate): the score's heartbeat and drone
     * follow the encounter; a pod near the listener talks now and then.
     */
    let seaVoiceClock = 3;
    function updateSeaLifeAudio(deltaSeconds) {
      if (!audio) return;
      const m = sharkMusic,
        e = sharkEncounter;
      if (m && m.running) {
        const w = sharkWarning(),
          closeness = w ? clamp(1 - (w.d - 50) / 330, 0, 1) : 0;
        m.tension += (closeness - m.tension) * Math.min(1, deltaSeconds * 0.8);
        glideParam(m.filter.frequency, 260 + m.tension * 1400, audio.currentTime, 0.4);
        m.next -= deltaSeconds;
        if (m.next <= 0 && soundOn) {
          // da-DUM: a lighter note, then the heavy one; faster as it closes.
          const period = 1.25 - 0.9 * m.tension;
          sharkBassNote(41.2, 0.12 + m.tension * 0.08, 0, 0.3);
          sharkBassNote(43.65, 0.2 + m.tension * 0.12, period * 0.3, 0.45);
          m.next = period;
          m.beat++;
        }
        if (e.phase === 'none') sharkScore('release');
      }
      // Dolphins chatter while a pod is near the listener.
      seaVoiceClock -= deltaSeconds;
      if (seaVoiceClock <= 0) {
        seaVoiceClock = 2 + Math.random() * 4;
        for (const pod of dolphinPods)
          if (distanceBetween(pod, player) < 420) {
            dolphinVoice(pod.members[Math.floor(Math.random() * pod.members.length)], 0.8);
            break;
          }
      }
    }
    // END SUBSYSTEM: src/sealife-audio.js
