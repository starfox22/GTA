    // BEGIN SUBSYSTEM: src/ambience.js — City soundscape
    /**
     * City soundscape
     * Source: src/ambience.js
     * Scope: shared game closure.
     * Procedural Web Audio layers under the effects: the hum of traffic, the
     * murmur of a crowd, wind, birds by day and crickets by night, horns and far
     * sirens, the thump through a club wall, a busker's guitar, bus air brakes.
     * Nothing here is a sample; it is all filtered noise and oscillators, so it
     * costs nothing in download size. (Rain is weather.js's own layer.)
     */
    let ambience = null;
    function buildAmbience() {
      if (!audio || ambience) return ambience;
      const rate = audio.sampleRate,
        seconds = 3,
        white = audio.createBuffer(1, rate * seconds, rate),
        brown = audio.createBuffer(1, rate * seconds, rate),
        w = white.getChannelData(0),
        b = brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < w.length; i++) {
        w[i] = Math.random() * 2 - 1;
        last = (last + 0.02 * w[i]) / 1.02;
        b[i] = last * 3.5;
      }
      const bus = audio.createGain();
      bus.gain.value = 0;
      bus.connect(master);
      // One looping noise source feeding a filter and a gain: a layer.
      const layer = (buffer, type, frequency, q = 0.7, second) => {
        const source = audio.createBufferSource(),
          filter = audio.createBiquadFilter(),
          gain = audio.createGain();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = Math.random();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        gain.gain.value = 0;
        let node = source.connect(filter);
        if (second) {
          const extra = audio.createBiquadFilter();
          extra.type = second.type;
          extra.frequency.value = second.frequency;
          node = node.connect(extra);
        }
        node.connect(gain).connect(bus);
        source.start(0, Math.random() * (seconds - 0.5));
        return { source, filter, gain };
      };
      ambience = {
        bus,
        white,
        traffic: layer(brown, 'lowpass', 240),
        murmur: layer(white, 'bandpass', 700, 0.9, { type: 'lowpass', frequency: 1500 }),
        murmurHigh: layer(white, 'bandpass', 1500, 1.4),
        wind: layer(brown, 'lowpass', 420),
        clock: { bird: 2, cricket: 0, horn: 6, siren: 30, beat: 0, pluck: 0, bark: 0 },
        beatIndex: 0,
        pluckIndex: 0,
      };
      return ambience;
    }
    /* Volume and stereo position for a sound at a map point. */
    function spatial(position, reach = 230) {
      if (!position) return { gain: 1, pan: 0 };
      const d = distanceBetween(position, player);
      return { gain: 1 / (1 + d / reach), pan: clamp((position.x - player.x) / 450, -0.9, 0.9), d };
    }
    function voice(type, frequency, start, length, peak, to, panValue = 0, filterFrequency = 0) {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        pan = audio.createStereoPanner();
      o.type = type;
      o.frequency.setValueAtTime(frequency, start);
      if (to) o.frequency.exponentialRampToValueAtTime(to, start + length);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, length * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, start + length);
      pan.pan.value = panValue;
      let node = o;
      if (filterFrequency) {
        const f = audio.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = filterFrequency;
        node = o.connect(f);
      }
      node.connect(g).connect(pan).connect(ambience.bus);
      o.start(start);
      o.stop(start + length + 0.05);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
        pan.disconnect();
      };
    }
    function noiseBurst(start, length, peak, type, frequency, panValue = 0, q = 0.8) {
      const s = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        g = audio.createGain(),
        pan = audio.createStereoPanner();
      s.buffer = ambience.white;
      f.type = type;
      f.frequency.value = frequency;
      f.Q.value = q;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + length);
      pan.pan.value = panValue;
      s.connect(f).connect(g).connect(pan).connect(ambience.bus);
      s.start(start, Math.random() * 2);
      s.stop(start + length + 0.05);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        g.disconnect();
        pan.disconnect();
      };
    }
    /**
     * HORNS
     * Two detuned square waves a third apart through a low-pass: the classic
     * car horn. Length sets a tap or a lean; `double` makes it beep-beep.
     */
    function hornSound(position, length = 0.3, double = false) {
      if (!audio || !soundOn || gameMode !== 'play' || !buildAmbience()) return;
      const where = spatial(position, 260);
      if (where.gain < 0.08) return;
      const base = 360 + ((position?.id || 0) % 7) * 22,
        now = audio.currentTime,
        peak = 0.11 * where.gain;
      for (let k = 0; k < (double ? 2 : 1); k++) {
        const start = now + k * (length + 0.09);
        voice('square', base, start, length, peak, 0, where.pan, 1700);
        voice('square', base * 1.26, start, length, peak * 0.8, 0, where.pan, 1700);
      }
    }
    function airBrakeSound(position) {
      if (!audio || !soundOn || !buildAmbience()) return;
      const where = spatial(position, 260);
      noiseBurst(audio.currentTime, 0.55, 0.12 * where.gain, 'highpass', 2600, where.pan);
    }
    function barkSound(position) {
      if (!audio || !soundOn || !buildAmbience()) return;
      const where = spatial(position, 200),
        now = audio.currentTime;
      for (let k = 0; k < 2; k++) {
        voice('sawtooth', 520, now + k * 0.2, 0.12, 0.07 * where.gain, 260, where.pan, 1400);
        noiseBurst(now + k * 0.2, 0.1, 0.05 * where.gain, 'bandpass', 900, where.pan);
      }
    }
    /* Birdsong: a few quick rising chirps from somewhere off to one side. */
    function birdCall(near) {
      const now = audio.currentTime,
        pan = randomBetween(-0.8, 0.8),
        base = randomBetween(2400, 3600),
        count = Math.floor(randomBetween(2, 6));
      for (let k = 0; k < count; k++)
        voice('sine', base, now + k * randomBetween(0.09, 0.16), randomBetween(0.05, 0.1), 0.018 * near, base * randomBetween(1.25, 1.6), pan);
    }
    function cricketCall(near) {
      const now = audio.currentTime,
        pan = randomBetween(-0.8, 0.8);
      for (let k = 0; k < 6; k++) voice('sine', 4300, now + k * 0.045, 0.03, 0.008 * near, 0, pan);
    }
    function distantSiren() {
      const now = audio.currentTime,
        pan = randomBetween(-0.9, 0.9),
        length = randomBetween(3, 5);
      for (let t = 0; t < length; t += 0.9) {
        voice('triangle', 620, now + t, 0.45, 0.012, 1250, pan, 1400);
        voice('triangle', 1250, now + t + 0.45, 0.45, 0.012, 620, pan, 1400);
      }
    }
    /* Club: a muffled four-on-the-floor through the wall. */
    function clubBeat(level, pan) {
      const now = audio.currentTime,
        i = ambience.beatIndex++;
      voice('sine', 120, now, 0.22, 0.14 * level, 45, pan, 300);
      if (i % 2) noiseBurst(now, 0.05, 0.02 * level, 'bandpass', 5000, pan, 1);
      if (i % 8 === 4) voice('sawtooth', 110, now, 0.3, 0.03 * level, 0, pan, 420);
    }
    /* Busker: an arpeggiated progression, plucked and quickly damped. */
    const BUSKER_CHORDS = [
      [196, 247, 294, 392],
      [165, 196, 247, 330],
      [131, 165, 196, 262],
      [147, 185, 220, 294],
    ];
    function buskerPluck(level, pan) {
      const i = ambience.pluckIndex++,
        chord = BUSKER_CHORDS[Math.floor(i / 8) % BUSKER_CHORDS.length],
        note = chord[[0, 2, 1, 3, 2, 1, 3, 2][i % 8]],
        now = audio.currentTime;
      voice('triangle', note, now, 0.6, 0.06 * level, 0, pan, 2200);
      voice('sine', note * 2, now, 0.3, 0.015 * level, 0, pan);
    }
    function updateAmbience(deltaSeconds) {
      if (!audio || !buildAmbience()) return;
      const a = ambience,
        now = audio.currentTime,
        active = gameMode === 'play' && soundOn,
        inside = !!(taxiRide || transitRide),
        city = inCityGrid(player.x, player.y);
      a.bus.gain.setTargetAtTime(active ? (inside ? 0.45 : 1) : 0, now, 0.4);
      if (!active) return;
      // Traffic hum follows the moving cars around you; the city never falls silent.
      let moving = 0;
      for (const c of vehicles)
        if (c.hp > 0 && Math.abs(c.x - player.x) < 700 && Math.abs(c.y - player.y) < 700 && Math.abs(c.speed || 0) > 12) moving++;
      const hour = crowdHour(),
        light = daylight(),
        night = hour > 22 || hour < 5.5;
      a.traffic.gain.gain.setTargetAtTime((city ? 0.05 : 0.015) + Math.min(0.1, moving * 0.006), now, 0.8);
      // Crowd murmur: louder with more people close by, jittered like speech.
      let people = 0,
        panic = 0;
      forPeopleNear(player.x, player.y, 260, (p) => {
        if (p.hp <= 0) return;
        people++;
        if (p.react && ['flee', 'cower'].includes(p.react.kind)) panic++;
      });
      const murmur = Math.min(0.07, people * 0.0022) * (0.75 + Math.random() * 0.5);
      a.murmur.gain.gain.setTargetAtTime(murmur, now, 0.12);
      a.murmurHigh.gain.gain.setTargetAtTime(murmur * 0.35 * (1 + Math.min(2, panic * 0.4)), now, 0.1);
      a.wind.gain.gain.setTargetAtTime(Math.max(0, weather.wind - 0.35) * 0.06, now, 1.2);
      const clock = a.clock;
      for (const k in clock) clock[k] -= deltaSeconds;
      // Birds by day (more in parks and near trees), crickets by night.
      const green = districtAt(player.x, player.y) === 'CENTRAL GARDEN' || !city ? 1.6 : 1;
      if (clock.bird <= 0) {
        clock.bird = randomBetween(2, 7) / green;
        if (light > 0.45 && weather.rain < 0.2) birdCall(green * 0.8);
      }
      if (clock.cricket <= 0) {
        clock.cricket = randomBetween(0.6, 2.2);
        if (light < 0.25 && weather.rain < 0.2 && (green > 1 || Math.random() < 0.25)) cricketCall(green);
      }
      // Horns and a siren somewhere across the city.
      if (clock.horn <= 0) {
        clock.horn = randomBetween(6, 18) * (night ? 2.5 : 1);
        if (city) {
          const a2 = Math.random() * TAU;
          hornSound({ x: player.x + Math.cos(a2) * 520, y: player.y + Math.sin(a2) * 520, id: Math.floor(Math.random() * 9) }, randomChoice([0.18, 0.3, 0.6]), Math.random() < 0.3);
        }
      }
      if (clock.siren <= 0) {
        clock.siren = randomBetween(35, 90);
        if (city && wantedStars <= 0) distantSiren();
      }
      // Music from the nearest open club or bar, and the busker if one is playing.
      let club = null,
        busker = null;
      for (const s of crowd.scenes) {
        const d = distanceBetween(s, player);
        if (s.kind === 'nightlife' && d < 320 && (!club || d < club.d)) club = { s, d };
        if (s.kind === 'busker' && d < 340 && s.members.some((p) => p.sceneRole === 'busker' && p.pose === 'strum')) busker = { s, d };
      }
      if (club && clock.beat <= 0) {
        clock.beat = 60 / 124 / 2;
        clubBeat((1 - club.d / 320) * (club.s.place.kind === 'club' ? 1 : 0.6), clamp((club.s.x - player.x) / 450, -0.9, 0.9));
      }
      if (busker && clock.pluck <= 0) {
        clock.pluck = 0.24;
        buskerPluck(1 - busker.d / 340, clamp((busker.s.x - player.x) / 450, -0.9, 0.9));
      }
      // Dogs bark when people panic near them.
      if (clock.bark <= 0) {
        clock.bark = 0.8;
        forPeopleNear(player.x, player.y, 400, (p) => {
          if (p.dog && p.react && ['flee', 'cower', 'startle'].includes(p.react.kind) && Math.random() < 0.4) barkSound(p.dog);
        });
      }
    }
    // END SUBSYSTEM: src/ambience.js
