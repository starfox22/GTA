    // BEGIN SUBSYSTEM: src/water-audio.js — Water and beach sound
    /**
     * Water and beach sound
     * Source: src/water-audio.js
     * Scope: shared game closure.
     * Procedural Web Audio for swimming, splashes, sinking cars and the shore.
     */
    /**
     * WATER SOUND
     * Nothing here is a sample. Water is noise with a shape: a splash is a
     * burst of low-passed noise (the body of water thrown up) over a short
     * band of hiss (the spray), with a sine "bloop" for the air pocket a heavy
     * body drags under, then a sprinkle of droplets falling back. A swimming
     * stroke is a softer slosh whose band rises as the hand enters and a low
     * whoosh as it pulls, with a few drips off the recovering arm; each stroke
     * also dips the ears under (`earFilter` in audio.js muffles the whole mix
     * for a moment). A sinking car gulps big bubbles: sine chirps that rise in
     * pitch as they shrink, the sound real bubbles make.
     *
     * Three loops carry the shore: the surf (a wave crash every seven seconds
     * or so, then the long hiss of the wash, loud on the sand and gone a few
     * blocks inland), lapping against walls and around a swimmer, and the
     * murmur of a crowd while the beach is busy. Gulls call now and then over
     * the water in daylight. Every one-shot is randomised a little so that two
     * strokes never sound the same.
     */
    let waterNoise = null,
      waterAmbience = null,
      shoreEars = { beach: 1e9, quay: 1e9, checkedAt: -1, x: 0, y: 0 },
      gullClock = 4,
      beachShorePoints = null;
    function waterNoiseBuffer() {
      if (waterNoise) return waterNoise;
      const n = Math.floor(audio.sampleRate * 3),
        b = audio.createBuffer(1, n, audio.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      waterNoise = b;
      return b;
    }
    /* Distance and stereo placement of a sound at a map position. */
    function waterPlacement(position) {
      if (!position) return { gain: 1, pan: 0 };
      const d = distanceBetween(position, player);
      return { gain: 1 / (1 + d / 230), pan: clamp((position.x - player.x) / 450, -0.9, 0.9) };
    }
    /**
     * One shaped burst of filtered noise: `type`/`freq`/`q` set the band, the
     * band can sweep to `sweepTo`, and the level rises over `attack` seconds and
     * dies away over `decay`. `delay` starts it later. Everything is torn down
     * when it ends.
     */
    function shapedNoise(o) {
      if (!audio || !soundOn) return;
      const t = audio.currentTime + (o.delay || 0),
        dur = (o.attack || 0.01) + (o.decay || 0.2),
        place = waterPlacement(o.position),
        level = (o.gain || 0.1) * place.gain;
      if (level < 0.002) return;
      const s = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        g = audio.createGain(),
        p = audio.createStereoPanner();
      s.buffer = waterNoiseBuffer();
      s.playbackRate.value = o.rate || 1;
      f.type = o.type || 'lowpass';
      f.frequency.setValueAtTime(o.freq || 800, t);
      if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + dur);
      f.Q.value = o.q ?? 0.8;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + (o.attack || 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      p.pan.value = clamp((o.pan || 0) + place.pan, -1, 1);
      s.connect(f).connect(g).connect(p).connect(master);
      if (o.wet) p.connect(reverbSend || reverb);
      // Start somewhere random in the noise, leaving room for the whole burst.
      s.start(t, Math.random() * Math.max(0, 2.9 - dur));
      s.stop(t + dur + 0.05);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        g.disconnect();
        p.disconnect();
      };
    }
    /* A pitched blip: bubbles, bloops, whistles. `to` glides the pitch. */
    function waterTone(o) {
      if (!audio || !soundOn) return;
      const t = audio.currentTime + (o.delay || 0),
        dur = o.duration || 0.08,
        place = waterPlacement(o.position),
        level = (o.gain || 0.05) * place.gain;
      if (level < 0.002) return;
      const osc = audio.createOscillator(),
        g = audio.createGain(),
        p = audio.createStereoPanner();
      let tail = g;
      osc.type = o.wave || 'sine';
      osc.frequency.setValueAtTime(o.freq, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      if (o.lowpass) {
        const f = audio.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = o.lowpass;
        g.connect(f);
        tail = f;
      }
      p.pan.value = clamp((o.pan || 0) + place.pan, -1, 1);
      tail.connect(p).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        tail.disconnect();
        p.disconnect();
      };
    }
    /* Water falling back: a few tiny bright ticks scattered over `spread` seconds. */
    function droplets(count, spread, gain, position) {
      for (let i = 0; i < count; i++)
        shapedNoise({
          type: 'bandpass',
          freq: 2200 + Math.random() * 3200,
          q: 4,
          attack: 0.002,
          decay: 0.02 + Math.random() * 0.03,
          gain: gain * (0.5 + Math.random()),
          delay: 0.05 + Math.random() * spread,
          pan: (Math.random() - 0.5) * 0.5,
          position,
        });
    }
    /* Something going into the water: 0.5 a stumble, 1 a person, 2+ a car. */
    function waterSplashSound(force = 1, position = null) {
      const f = clamp(force, 0.2, 3);
      shapedNoise({
        type: 'lowpass',
        freq: 650 + f * 350,
        sweepTo: 220,
        q: 0.7,
        attack: 0.008,
        decay: 0.22 + f * 0.22,
        gain: 0.16 * f,
        position,
      });
      shapedNoise({
        type: 'bandpass',
        freq: 2600 + Math.random() * 1400,
        sweepTo: 1600,
        q: 0.9,
        attack: 0.004,
        decay: 0.14 + f * 0.1,
        gain: 0.09 * f,
        delay: 0.012,
        position,
      });
      if (f > 0.9)
        waterTone({
          freq: 150 + Math.random() * 60,
          to: 55,
          duration: 0.14,
          gain: 0.08 * f,
          delay: 0.02,
          lowpass: 900,
          position,
        });
      droplets(Math.round(3 + f * 3), 0.35 + f * 0.25, 0.018 * f, position);
    }
    /* Walking into the shallows or pushing off from them: a slosh, not a splash. */
    function waterEntrySound(force = 0.5) {
      shapedNoise({ type: 'lowpass', freq: 900, sweepTo: 380, attack: 0.06, decay: 0.35, gain: 0.09 * force });
      shapedNoise({ type: 'bandpass', freq: 1800, q: 1.2, attack: 0.03, decay: 0.2, gain: 0.03 * force, delay: 0.05 });
    }
    /* One arm of a front crawl. `drive` 0..1 is effort; `side` pans it. */
    function swimStrokeSound(drive, side) {
      const d = clamp(drive, 0.15, 1),
        band = 380 + Math.random() * 320;
      // The hand going in: a slosh whose band rises as it cuts the surface.
      shapedNoise({
        type: 'bandpass',
        freq: band,
        sweepTo: band * (1.6 + Math.random() * 0.5),
        q: 1.1,
        attack: 0.05,
        decay: 0.2 + Math.random() * 0.08,
        gain: 0.035 + 0.06 * d,
        pan: side * 0.25,
      });
      // The pull: a deep whoosh under it.
      shapedNoise({
        type: 'lowpass',
        freq: 420 + Math.random() * 120,
        attack: 0.1,
        decay: 0.28,
        gain: 0.03 * d,
        delay: 0.07,
        pan: side * 0.15,
      });
      droplets(2 + Math.round(Math.random() * 2), 0.35, 0.008 + 0.01 * d, null);
      // The face rolls under with the stroke: the world goes dull for a moment.
      if (earFilter && d > 0.3) {
        const t = audio.currentTime;
        earFilter.frequency.cancelScheduledValues(t);
        earFilter.frequency.setTargetAtTime(900, t + 0.05, 0.03);
        earFilter.frequency.setTargetAtTime(5200, t + 0.28, 0.08);
      }
    }
    /* A snatched breath, harsher the more tired the swimmer is. */
    function swimGasp(tired) {
      const k = clamp(tired, 0, 1);
      shapedNoise({ type: 'bandpass', freq: 1500 + k * 300, q: 2.2, attack: 0.16, decay: 0.1, gain: 0.03 + 0.05 * k, delay: 0.1 });
      shapedNoise({ type: 'bandpass', freq: 2700, q: 3, attack: 0.15, decay: 0.08, gain: 0.015 + 0.03 * k, delay: 0.1 });
      shapedNoise({ type: 'bandpass', freq: 850, q: 1.6, attack: 0.02, decay: 0.22, gain: 0.02 + 0.03 * k, delay: 0.42 });
    }
    /* A stride through the shallows, deeper water, bigger swish. */
    function wadeStepSound(depth) {
      const k = clamp(depth, 0, 1);
      shapedNoise({
        type: 'bandpass',
        freq: 900 - k * 250 + Math.random() * 150,
        sweepTo: 340,
        q: 0.9,
        attack: 0.04,
        decay: 0.16 + k * 0.14,
        gain: 0.04 + k * 0.06,
      });
      droplets(1 + Math.round(k * 2), 0.25, 0.01, null);
    }
    /* Wet hands and feet on a steel ladder. */
    function ladderRungSound(i) {
      waterTone({ freq: 820 + i * 25, duration: 0.09, gain: 0.03, wave: 'triangle' });
      waterTone({ freq: 1370 + i * 30, duration: 0.05, gain: 0.015 });
      droplets(2, 0.3, 0.012, null);
    }
    /* A car going into the bay: a heavy plunge and the rush of water through the cabin. */
    function carFloodSound(c) {
      waterSplashSound(2.4, c);
      waterTone({ freq: 72, to: 38, duration: 0.45, gain: 0.2, lowpass: 400, position: c });
      shapedNoise({ type: 'lowpass', freq: 700, sweepTo: 260, attack: 0.3, decay: 1.4, gain: 0.12, delay: 0.25, position: c });
      sinkingBubbles(c);
    }
    /* Air escaping a flooding car: rising sine chirps, the bigger the lower. */
    function sinkingBubbles(c) {
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const f = 260 + Math.random() * 700;
        waterTone({
          freq: f,
          to: f * (1.5 + Math.random() * 0.4),
          duration: 0.04 + Math.random() * 0.05,
          gain: 0.035 + Math.random() * 0.045,
          delay: Math.random() * 0.8,
          lowpass: 1900,
          position: c,
        });
      }
      shapedNoise({ type: 'lowpass', freq: 320, attack: 0.08, decay: 0.5, gain: 0.05, delay: Math.random() * 0.3, position: c });
    }
    /* A herring gull: a rising "kee" and a falling "ahh", two to four times. */
    function gullCall(position) {
      const calls = 2 + Math.floor(Math.random() * 3),
        base = 1500 + Math.random() * 500;
      for (let i = 0; i < calls; i++) {
        const delay = i * (0.32 + Math.random() * 0.1);
        waterTone({ freq: base, to: base * 1.35, duration: 0.07, gain: 0.018, wave: 'sawtooth', lowpass: 3200, delay, position });
        waterTone({ freq: base * 1.3, to: base * 0.8, duration: 0.22, gain: 0.022, wave: 'sawtooth', lowpass: 2600, delay: delay + 0.07, position });
      }
    }
    /* The lifeguard's whistle: two sharp pips. */
    function lifeguardWhistle(position) {
      for (const delay of [0, 0.32])
        waterTone({ freq: 2950, to: 3050, duration: 0.2, gain: 0.05, wave: 'triangle', delay, attack: 0.01, position });
    }
    /**
     * SHORE AMBIENCE
     * Built once, the first time there is an audio context: noise loops through
     * filters into their own gains, all silent until updateWaterAudio opens them.
     */
    function loopedNoise(chain) {
      const s = audio.createBufferSource();
      s.buffer = waterNoiseBuffer();
      s.loop = true;
      let node = s;
      for (const f of chain) node = node.connect(f);
      const g = audio.createGain();
      g.gain.value = 0;
      node.connect(g).connect(master);
      s.start(0, Math.random() * 2);
      return { source: s, gain: g, filters: chain };
    }
    function waterFilter(type, freq, q = 0.8) {
      const f = audio.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    }
    function startWaterAmbience() {
      waterAmbience = {
        surf: loopedNoise([waterFilter('lowpass', 700, 0.5)]),
        lap: loopedNoise([waterFilter('bandpass', 360, 1.4), waterFilter('lowpass', 900)]),
        crowd: loopedNoise([waterFilter('bandpass', 520, 3.5), waterFilter('peaking', 1150, 3), waterFilter('lowpass', 2400)]),
        wavePhase: Math.random(),
        wavePeriod: 7.5,
        crowdLevel: 0,
      };
      waterAmbience.crowd.filters[1].gain.value = 8;
    }
    /* Every beach waterline point, sampled every ~90 units, for "how near is the surf". */
    function beachEarPoints() {
      if (beachShorePoints) return beachShorePoints;
      beachShorePoints = [];
      let run = 90;
      for (const e of coastSegments()) {
        if (e.opening || shoreStyle(e) !== 'beach') continue;
        run += e.length;
        if (run < 90) continue;
        run = 0;
        beachShorePoints.push({ x: e.x, y: e.y });
      }
      return beachShorePoints;
    }
    function updateWaterAudio(deltaSeconds) {
      if (!audio) return;
      if (!waterAmbience) startWaterAmbience();
      const amb = waterAmbience,
        t = audio.currentTime,
        active = gameMode === 'play' && soundOn,
        ear = player.car || player;
      // Re-measure the distance to the surf and to the nearest wall a few times a second.
      if (gameTime - shoreEars.checkedAt > 0.3 || Math.hypot(ear.x - shoreEars.x, ear.y - shoreEars.y) > 60) {
        shoreEars.checkedAt = gameTime;
        shoreEars.x = ear.x;
        shoreEars.y = ear.y;
        let beach = 1e9;
        for (const p of beachEarPoints()) {
          const d = Math.abs(p.x - ear.x) + Math.abs(p.y - ear.y);
          if (d < beach * 1.5) beach = Math.min(beach, Math.hypot(p.x - ear.x, p.y - ear.y));
        }
        shoreEars.beach = beach;
        shoreEars.quay = nearestShore(ear.x, ear.y, SHORE_CELL)?.d ?? 1e9;
      }
      const inWater = !player.car && (player.swimming || player.wading > 0),
        muffled = player.swimming && !player.car,
        high = isAircraft(player.car) ? clamp(1 - aircraftClearance(player.car) / 260, 0, 1) : 1,
        cabin = player.car && !isBoat(player.car) && !vehicleSpec(player.car).bike && !vehicleSpec(player.car).bicycle ? 0.55 : 1;
      // Surf: each wave crashes, then its wash hisses away up the sand.
      amb.wavePhase += deltaSeconds / amb.wavePeriod;
      if (amb.wavePhase >= 1) {
        amb.wavePhase -= 1;
        amb.wavePeriod = 6 + Math.random() * 3.5;
      }
      const p = amb.wavePhase,
        crash = p < 0.06 ? p / 0.06 : Math.exp(-(p - 0.06) * 3.2),
        second = p > 0.45 && p < 0.9 ? 0.35 * Math.sin(((p - 0.45) / 0.45) * Math.PI) : 0,
        swell = 0.18 + 0.82 * Math.max(crash, second),
        near = clamp(1 - shoreEars.beach / 700, 0, 1),
        surfLevel = active ? Math.pow(near, 1.6) * (0.16 + 0.1 * Math.min(1, worldZoom)) * swell * high * cabin + (inWater ? 0.04 * swell : 0) : 0;
      glideParam(amb.surf.gain.gain, surfLevel, t, 0.08);
      glideParam(amb.surf.filters[0].frequency, 420 + 1500 * crash * near + (muffled ? -150 : 0), t, 0.1);
      // Lapping: around a swimmer, and against walls when you stand at the edge.
      const lapNear = clamp(1 - shoreEars.quay / 140, 0, 1),
        lapBeat = 0.55 + 0.45 * Math.sin(gameTime * 4.4) * Math.sin(gameTime * 1.7 + 1),
        lapLevel = active ? (inWater ? 0.12 : 0.045 * lapNear * cabin) * lapBeat * high : 0;
      glideParam(amb.lap.gain.gain, lapLevel, t, 0.06);
      glideParam(amb.lap.filters[0].frequency, 300 + 140 * Math.sin(gameTime * 2.3), t, 0.1);
      // Crowd: the murmur of a busy beach, with the odd rise of a voice.
      const crowd = active ? beachCrowdLevel(ear.x, ear.y) : 0;
      amb.crowdLevel += (crowd - amb.crowdLevel) * Math.min(1, deltaSeconds * 1.5);
      const syllables = 0.6 + 0.4 * Math.abs(Math.sin(gameTime * 5.3) * Math.sin(gameTime * 3.1 + 2));
      glideParam(amb.crowd.gain.gain, amb.crowdLevel * 0.07 * syllables * cabin * high, t, 0.05);
      glideParam(amb.crowd.filters[0].frequency, 460 + 200 * Math.abs(Math.sin(gameTime * 2.2)), t, 0.07);
      // Ears at the waterline: the whole mix dulls while you swim.
      if (earFilter) {
        const open = muffled ? 5200 : 20000;
        if (!muffled || earFilter.frequency.value > 12000) earFilter.frequency.setTargetAtTime(open, t, 0.12);
      }
      // Gulls over the water in daylight.
      gullClock -= deltaSeconds;
      if (gullClock <= 0) {
        gullClock = 5 + Math.random() * 10;
        const coast = Math.min(shoreEars.beach, shoreEars.quay * 2.5);
        if (active && daylight() > 0.25 && coast < 800 && high > 0.5)
          gullCall({ x: ear.x + (Math.random() - 0.5) * 700, y: ear.y + (Math.random() - 0.5) * 400 });
      }
    }
    // END SUBSYSTEM: src/water-audio.js
