    // BEGIN SUBSYSTEM: src/sports-audio.js — Crowd chants, roars and whistles
    /**
     * Crowd chants, roars and whistles
     * Source: src/sports-audio.js
     * Scope: shared game closure (uses ambience.js's bus, voice() and noiseBurst()).
     *
     * All procedural Web Audio, like the rest of the soundscape:
     * - The stadium bed: a band of filtered noise that rises and falls like a
     *   crowd, as loud as the stands are full and as close as the player is.
     * - Chants between the noise: a few dozen detuned sawtooth "voices" through
     *   a vowel formant singing a terrace tune, or rhythmic clapping.
     * - Goal roars (a swelling noise wave and air horns), the "ooh" of a save or a
     *   near miss, screams when the stands panic.
     * - The referee's whistle (a trilled pea whistle) and the thud of a kick.
     */
    const STADIUM_SOUND_CENTRE = { x: 2689, y: 4579 };
    // Terrace tunes as [semitones from the root, beats]; the root is a low G.
    const SPORTS_CHANTS = [
      // "Here we go, here we go, here we go"
      [[0, 1], [0, 1], [0, 1], [2, 0.5], [0, 0.5], [-3, 2], [0, 1], [0, 1], [0, 1], [2, 0.5], [0, 0.5], [-3, 2]],
      // A rising "o-le, o-le, o-le-e" style tune.
      [[0, 1.5], [4, 0.5], [7, 2], [0, 1.5], [4, 0.5], [7, 2], [9, 1], [7, 1], [4, 1], [0, 2]],
      // Two long calls of a club name.
      [[0, 0.5], [0, 0.5], [3, 1.5], [0, 0.5], [0, 0.5], [3, 1.5], [5, 0.5], [3, 0.5], [0, 2]],
    ];
    let sportsSound = null;

    function sportsSoundReady() {
      return !!(audio && soundOn && gameMode === 'play' && buildAmbience());
    }

    function buildSportsSound() {
      if (sportsSound || !sportsSoundReady()) return sportsSound;
      // The bed: looping white noise through a band-pass that wanders like voices.
      const source = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        gain = audio.createGain(),
        pan = audio.createStereoPanner();
      source.buffer = ambience.white;
      source.loop = true;
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.7;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(pan).connect(ambience.bus);
      source.start(0, Math.random() * 2);
      sportsSound = { filter, gain, pan, chantClock: 6, clapClock: 12, surge: 0 };
      return sportsSound;
    }

    /* How loud the stadium is where the player stands (0..1) and its stereo side. */
    function stadiumHearing() {
      const d = Math.hypot(player.x - STADIUM_SOUND_CENTRE.x, player.y - STADIUM_SOUND_CENTRE.y);
      return {
        level: clamp(1.2 - d / 1100, 0, 1) ** 1.6,
        pan: clamp((STADIUM_SOUND_CENTRE.x - player.x) / 700, -0.8, 0.8),
      };
    }

    function updateSportsAudio(deltaSeconds) {
      if (!sportsSoundReady() || !buildSportsSound()) return;
      const sound = sportsSound,
        match = sportsMatches.soccer,
        now = audio.currentTime,
        hearing = stadiumHearing(),
        crowdFull = sportsCrowdPresence(match),
        panic = match.abandoned && match.time - match.panicAt < 12;
      sound.surge = Math.max(0, sound.surge - deltaSeconds * 0.25);
      // Murmur of the crowd, swelling now and then, louder in a panic or after a goal.
      const wave = 0.75 + 0.25 * Math.sin(gameTime * 0.7) * Math.sin(gameTime * 0.23 + 1),
        level = hearing.level * (crowdFull * 0.09 * wave + sound.surge * 0.16 + (panic ? 0.12 : 0));
      sound.gain.gain.setTargetAtTime(level, now, 0.25);
      sound.filter.frequency.setTargetAtTime(700 + sound.surge * 900 + (panic ? 700 : 0) + wave * 150, now, 0.3);
      sound.pan.pan.setTargetAtTime(hearing.pan, now, 0.5);
      if (hearing.level < 0.03 || crowdFull < 0.1 || match.abandoned) return;
      // Chants and clapping while the teams are out.
      sound.chantClock -= deltaSeconds;
      sound.clapClock -= deltaSeconds;
      if (sound.chantClock <= 0) {
        sound.chantClock = randomBetween(14, 26);
        sportsChant(hearing.level * crowdFull, hearing.pan);
      }
      if (sound.clapClock <= 0) {
        sound.clapClock = randomBetween(18, 34);
        sportsClapping(hearing.level * crowdFull, hearing.pan);
      }
    }

    /* A few thousand voices on one note: detuned saws through an "oh" formant. */
    function sportsSing(frequency, start, length, peak, pan) {
      const formant = audio.createBiquadFilter(),
        body = audio.createBiquadFilter(),
        gain = audio.createGain(),
        panner = audio.createStereoPanner();
      formant.type = 'bandpass';
      formant.frequency.value = 620;
      formant.Q.value = 1.4;
      body.type = 'lowpass';
      body.frequency.value = 1500;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.08, length * 0.3));
      gain.gain.setValueAtTime(peak, start + length * 0.75);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      panner.pan.value = pan;
      formant.connect(body).connect(gain).connect(panner).connect(ambience.bus);
      const voices = [];
      for (let k = 0; k < 6; k++) {
        const o = audio.createOscillator();
        o.type = 'sawtooth';
        // Octave doubling and a crowd's worth of pitch spread.
        o.frequency.value = frequency * (k % 3 === 2 ? 2 : 1) * (1 + (Math.random() - 0.5) * 0.03);
        o.connect(formant);
        o.start(start);
        o.stop(start + length + 0.05);
        voices.push(o);
      }
      voices[0].onended = () => {
        for (const o of voices) o.disconnect();
        formant.disconnect();
        body.disconnect();
        gain.disconnect();
        panner.disconnect();
      };
    }

    function sportsChant(level, pan) {
      const tune = randomChoice(SPORTS_CHANTS),
        beat = 0.36,
        root = 98 * 2 ** (randomBetween(-1, 2) / 12);
      let t = audio.currentTime + 0.05;
      for (const [semitones, beats] of tune) {
        sportsSing(root * 2 ** (semitones / 12), t, beats * beat * 0.95, 0.05 * level, pan);
        t += beats * beat;
      }
    }

    /* Clap, clap, clap-clap-clap. */
    function sportsClapping(level, pan) {
      const start = audio.currentTime + 0.05,
        pattern = [0, 0.5, 1, 1.25, 1.5];
      for (let bar = 0; bar < 3; bar++)
        for (const beat of pattern)
          noiseBurst(start + bar * 2.1 + beat * 0.55, 0.09, 0.06 * level, 'bandpass', 1300, pan, 0.9);
    }

    /* The whole ground erupts: a noise wave and a couple of air horns. */
    function sportsCrowdRoar(match, strength = 1) {
      if (!sportsSoundReady() || !buildSportsSound()) return;
      const hearing = stadiumHearing(),
        present = match.sport === 'soccer' ? Math.max(0.15, sportsCrowdPresence(match)) : 0.3,
        level = Math.max(hearing.level, match.sport === 'soccer' ? 0 : 0.2) * present * strength,
        now = audio.currentTime;
      if (level < 0.02) return;
      sportsSound.surge = Math.min(1.4, sportsSound.surge + strength);
      noiseBurst(now, 3.2, 0.22 * level, 'bandpass', 900, hearing.pan, 0.5);
      noiseBurst(now + 0.15, 2.6, 0.12 * level, 'bandpass', 2100, hearing.pan, 0.7);
      for (let k = 0; k < 3; k++) {
        voice('square', 466, now + 0.4 + k * 0.5, 0.35, 0.03 * level, 0, hearing.pan, 1800);
        voice('square', 587, now + 0.4 + k * 0.5, 0.35, 0.025 * level, 0, hearing.pan, 1800);
      }
    }

    /* "Ooh" from the stands: a save, a shot wide, a post. */
    function sportsCrowdGasp(match) {
      if (match.sport !== 'soccer' || !sportsSoundReady() || !buildSportsSound()) return;
      const hearing = stadiumHearing(),
        level = hearing.level * sportsCrowdPresence(match);
      if (level < 0.03) return;
      const now = audio.currentTime;
      noiseBurst(now, 1.3, 0.1 * level, 'bandpass', 520, hearing.pan, 2.2);
      sportsSing(110, now, 1.1, 0.03 * level, hearing.pan);
    }

    /* Screaming in the stands as everyone runs for the exits. */
    function sportsCrowdPanicSound(match) {
      if (!sportsSoundReady() || !buildSportsSound()) return;
      const where = match.sport === 'soccer' ? stadiumHearing() : { level: 1 / (1 + distanceBetween(player, match.venue) / 300), pan: 0 },
        now = audio.currentTime;
      if (where.level < 0.03) return;
      sportsSound.surge = Math.min(1.4, sportsSound.surge + 0.8);
      for (let k = 0; k < 6; k++)
        noiseBurst(now + k * randomBetween(0.2, 0.5), randomBetween(0.5, 0.9), 0.08 * where.level, 'bandpass', randomBetween(1800, 3200), where.pan + randomBetween(-0.2, 0.2), 3);
      playSample(randomChoice(['civilian-scream-female-1', 'civilian-scream-male-1']), 0.5 * where.level, 1, player);
    }

    /* The referee: short (kickoff, goal), double (break), triple (full time), long. */
    function sportsWhistle(match, pattern = 'short') {
      if (!sportsSoundReady()) return;
      const centre = { x: match.venue.x + match.venue.w / 2, y: match.venue.y + match.venue.h / 2 },
        where = spatial(centre, 420);
      if (where.gain < 0.05) return;
      const blasts = { short: [0.28], double: [0.25, 0.25], triple: [0.3, 0.3, 0.9], long: [1.4] }[pattern] || [0.3];
      let t = audio.currentTime + 0.02;
      for (const length of blasts) {
        // A pea whistle trills: one tone chopped quickly on and off.
        for (let trill = 0; trill < length; trill += 0.035)
          voice('sine', 2850 + Math.sin(trill * 90) * 60, t + trill, 0.03, 0.05 * where.gain, 0, where.pan);
        t += length + 0.14;
      }
    }

    function sportsKickSound(position, strength = 1) {
      if (!sportsSoundReady()) return;
      const where = spatial(position, 200),
        now = audio.currentTime;
      voice('sine', 150, now, 0.12, 0.12 * where.gain * strength, 55, where.pan);
      noiseBurst(now, 0.05, 0.05 * where.gain * strength, 'bandpass', 1200, where.pan, 1);
    }
    // END SUBSYSTEM: src/sports-audio.js
