    // BEGIN SUBSYSTEM: src/weather-audio.js — Rain and thunder sound
    /**
     * Rain and thunder sound
     * Source: src/weather-audio.js
     * Scope: shared game closure (after weather.js).
     *
     * Rain is three recorded beds, cross-faded by the rain's intensity
     * (RAIN_BEDS; sources in docs/THIRD_PARTY_CREDITS.txt):
     *
     *   light    soft rain pattering on a tile roof, drops you can pick out
     *   steady   a steady rain heard from a half-open window, an even wash
     *   heavy    a dense downpour, the bright hiss of a cloudburst
     *
     * Each loops seamlessly (its seam cross-faded when it was made, looped at
     * its exact length, LOOP_SECONDS in audio.js) from a random point. All
     * three pass through one `cabin` low-pass: open on foot, muffled under
     * cover (the underpass, under the railway decks and station canopies,
     * aboard a train or a cab, in the elevator), and through the glass inside a
     * closed vehicle, where the same recordings also drum on the roof (a
     * resonant low band of the light and steady beds, not behind the glass).
     * Tyres on a wet road hiss with a band of the heavy bed; a foot in a puddle
     * splashes. The build-up before a shower (wind, far thunder) is weather.js
     * and ambience.js. Thunder is made per strike: a near one starts with the
     * tearing crack of the channel, then the rolling rumble (brown noise under
     * a low-pass, several swells as the sound of different parts of the channel
     * arrives); the farther away, the later, lower, softer and longer it is,
     * and a distant storm is only a low grumble.
     */
    const RAIN_BEDS = ['rain-light', 'rain-steady', 'rain-heavy'];
    let rainAudio = null;
    function buildRainAudio() {
      if (!audio || !master || rainAudio) return rainAudio;
      if (!RAIN_BEDS.every((name) => audioBuffers[name])) return null;
      const bus = audio.createGain(),
        // Outside sounds pass through this: open on foot, the glass in a car.
        cabin = audio.createBiquadFilter();
      cabin.type = 'lowpass';
      cabin.frequency.value = 16000;
      cabin.Q.value = 0.4;
      bus.gain.value = 1;
      cabin.connect(bus).connect(ambienceBus);
      // One recorded bed through a filter and a gain into `out`.
      const bed = (name, type, frequency, q, out = cabin) => {
        const source = loopingSource(name),
          filter = audio.createBiquadFilter(),
          gain = audio.createGain();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(out);
        source.start(0, Math.random() * (LOOP_SECONDS[name] || 4));
        return { source, filter, gain };
      };
      // The roof: drops on sheet metal ring low and dull. Both beds feed one
      // resonant band so the drumming follows the rain as the street does.
      const roofBand = audio.createBiquadFilter(),
        roofGain = audio.createGain();
      roofBand.type = 'peaking';
      roofBand.frequency.value = 260;
      roofBand.Q.value = 1.1;
      roofBand.gain.value = 9;
      roofGain.gain.value = 0;
      roofBand.connect(roofGain).connect(bus);
      rainAudio = {
        bus,
        cabin,
        // A gentle top cut keeps the beds soft; the heavy one is the brightest.
        light: bed('rain-light', 'lowpass', 11000, 0.5),
        steady: bed('rain-steady', 'lowpass', 10000, 0.5),
        heavy: bed('rain-heavy', 'lowpass', 8500, 0.5),
        roofLight: bed('rain-light', 'lowpass', 1500, 0.7, roofBand),
        roofSteady: bed('rain-steady', 'lowpass', 1200, 0.7, roofBand),
        roof: { gain: roofGain },
        // Tyres on a wet road: a band of the downpour's hiss, not behind the glass.
        spray: bed('rain-heavy', 'bandpass', 1900, 0.8, bus),
        shelter: 0,
        stepX: player.x,
        stepY: player.y,
      };
      return rainAudio;
    }
    /*
     * 1 under a roof that keeps the rain off (the Northbank underpass, beneath
     * the railway decks and station canopies, a bridge over a swimmer, aboard a
     * train or a cab, in the Blue Hour elevator), 0 in the open.
     */
    function rainShelter() {
      if (taxiRide || transitRide || gameMode === 'elevator') return 1;
      if (player.car) return 0;
      const h = entityElevation(player),
        blocks = airCoverVolumes();
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        // Only overhead volumes (walls and piers start at the ground).
        if (b.bridge ? !player.swimming : (b.minHeight || 0) < 8) continue;
        if (h < (b.minHeight || 0) - 2 && inCoverFootprint(b, player.x, player.y)) return 1;
      }
      return 0;
    }
    /* How loud each bed is at rain intensity r (0..1), before the mix levels. */
    function rainBedLevels(r) {
      const ramp = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
      return {
        light: ramp(r, 0.02, 0.3) * (1 - 0.65 * ramp(r, 0.35, 0.8)),
        steady: ramp(r, 0.2, 0.55) * (1 - 0.4 * ramp(r, 0.75, 1)),
        heavy: ramp(r, 0.5, 0.95),
      };
    }
    // Mix level of each bed at full weight (the loops are matched at -26 dBFS RMS).
    const RAIN_LEVEL = { light: 0.42, steady: 0.5, heavy: 0.75, roof: 0.55, spray: 0.6 };
    function updateWeatherAudio(deltaSeconds) {
      if (!audio || !master) return;
      const raining = weather.rain > 0.02 || weather.wet > 0.05;
      if (!rainAudio && !raining) return;
      const a = buildRainAudio();
      if (!a) return;
      const now = audio.currentTime,
        on = soundOn && gameMode === 'play',
        r = on ? weather.rain : 0,
        c = player.car,
        spec = c ? vehicleSpec(c) : null,
        // Inside a closed vehicle: the glass muffles the street, the roof drums.
        cabin = !!c && !spec.bike && !spec.bicycle && !spec.jetski && c.type !== 'roadster' && !(spec.boat && c.type !== 'workboat');
      // Under cover the rain is a softer, duller wash off the edges.
      a.shelter += (rainShelter() - a.shelter) * Math.min(1, deltaSeconds * 3);
      glideParam(a.cabin.frequency, cabin ? 620 : 16000 - a.shelter * 13500, now, 0.15);
      const outside = cabin ? 0.55 : 1 - a.shelter * 0.45,
        beds = rainBedLevels(r);
      glideParam(a.light.gain.gain, beds.light * RAIN_LEVEL.light * outside, now, 0.4);
      glideParam(a.steady.gain.gain, beds.steady * RAIN_LEVEL.steady * outside, now, 0.4);
      glideParam(a.heavy.gain.gain, beds.heavy * RAIN_LEVEL.heavy * outside, now, 0.4);
      // The roof drums with the rain: the patter's band, then the wash's.
      glideParam(a.roofLight.gain.gain, cabin ? 0.5 + beds.light * 0.5 : 0, now, 0.3);
      glideParam(a.roofSteady.gain.gain, cabin ? beds.steady + beds.heavy * 0.8 : 0, now, 0.3);
      glideParam(a.roof.gain.gain, cabin ? r * RAIN_LEVEL.roof : 0, now, 0.2);
      // Tyres on a wet road.
      const rolling = c && !spec.boat && !spec.jetski && !isAircraft(c) ? Math.abs(c.speed || 0) : 0;
      glideParam(a.spray.gain.gain, on ? clamp(rolling / 260, 0, 1) * weather.wet * RAIN_LEVEL.spray : 0, now, 0.15);
      glideParam(a.spray.filter.frequency, 1300 + rolling * 3, now, 0.2);
      if (!on) return;
      // Splashes underfoot: one per stride through standing water.
      if (!c && !player.parachute && !player.swimming) {
        const stride = Math.hypot(player.x - a.stepX, player.y - a.stepY);
        if (stride > 26) {
          a.stepX = player.x;
          a.stepY = player.y;
          if (weather.wet > 0.2 && stride < 120 && a.shelter < 0.5) splashSound(weather.wet);
        }
      } else {
        a.stepX = player.x;
        a.stepY = player.y;
      }
    }
    // What DeadEndCity.rainSound() reports: the beds' gains and the filters.
    function rainReport() {
      const a = rainAudio,
        base = { rain: +weather.rain.toFixed(2), wet: +weather.wet.toFixed(2), targets: rainBedLevels(weather.rain) };
      if (!a) return { ready: false, ...base };
      const g = (layer) => +layer.gain.gain.value.toFixed(3);
      return {
        ready: true,
        ...base,
        light: g(a.light),
        steady: g(a.steady),
        heavy: g(a.heavy),
        roof: g(a.roof),
        spray: g(a.spray),
        cabin: Math.round(a.cabin.frequency.value),
        shelter: +a.shelter.toFixed(2),
      };
    }
    // A foot in a puddle: a wet slap and the spray settling.
    function splashSound(wet) {
      const now = audio.currentTime,
        n = Math.floor(audio.sampleRate * 0.16),
        b = audio.createBuffer(1, n, audio.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 9) * (t < 0.03 ? t / 0.03 : 1) + (Math.random() < 0.004 ? (Math.random() - 0.5) * 1.5 : 0);
      }
      const s = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        g = audio.createGain();
      s.buffer = b;
      f.type = 'bandpass';
      f.frequency.value = randomBetween(900, 1600);
      f.Q.value = 0.8;
      g.gain.value = 0.05 + wet * 0.09;
      s.connect(f).connect(g).connect(ambienceBus);
      s.start(now);
    }
    /**
     * Thunder `distance` map units away. Near (under ~1500): the crack of the
     * channel first, then a long rumble; far: the rumble only, lower and softer.
     */
    function thunderSound(distance, strength, at) {
      if (!audio || !master || !soundOn) return;
      const rate = audio.sampleRate,
        near = clamp(1 - distance / 2500, 0, 1),
        far = clamp(distance / 11000, 0, 1),
        seconds = 4.5 + far * 4 + Math.random() * 1.5,
        n = Math.floor(rate * seconds),
        buffer = audio.createBuffer(2, n, rate);
      // Swells: the rumble arrives in rolls as sound from farther along the
      // channel catches up.
      const rolls = [];
      for (let k = 0, count = 3 + Math.floor(Math.random() * 4); k < count; k++)
        rolls.push({ t: (k === 0 ? 0.05 : Math.random() * seconds * 0.55) + far * 0.3, rise: 0.08 + Math.random() * 0.4 + far * 0.3, fall: 0.6 + Math.random() * 1.4 + far, a: 0.35 + Math.random() * 0.65 });
      // The envelope changes slowly: work it out once per 64 samples.
      const block = 64,
        envelope = new Float32Array(Math.ceil(n / block) + 1);
      for (let j = 0; j < envelope.length; j++) {
        const t = (j * block) / rate;
        let env = 0;
        for (const r of rolls) {
          const dt = t - r.t;
          if (dt > 0) env += r.a * (dt < r.rise ? dt / r.rise : Math.exp(-(dt - r.rise) / r.fall));
        }
        envelope[j] = env * 0.45 * Math.min(1, t / 0.02) * (1 - t / seconds);
      }
      const crackleChance = 0.0015 * (1 + near * 4);
      for (let ch = 0; ch < 2; ch++) {
        const d = buffer.getChannelData(ch);
        let brown = 0,
          mid = 0;
        for (let i = 0; i < n; i++) {
          const w = Math.random() * 2 - 1;
          brown = (brown + 0.02 * w) / 1.02;
          mid = mid * 0.8 + w * 0.2;
          // Crackle riding on the rumble, stronger close by.
          const crackle = Math.random() < crackleChance ? (Math.random() - 0.5) * 3 * near : 0;
          d[i] = (brown * 7 + mid * (0.25 + near * 0.6) + crackle) * envelope[(i / block) | 0];
        }
      }
      const now = audio.currentTime,
        source = audio.createBufferSource(),
        low = audio.createBiquadFilter(),
        body = audio.createBiquadFilter(),
        gain = audio.createGain(),
        pan = audio.createStereoPanner();
      source.buffer = buffer;
      low.type = 'lowpass';
      low.frequency.value = 180 + near * 2400 + (1 - far) * 300;
      low.Q.value = 0.5;
      // A chest-deep body around 50-70 Hz.
      body.type = 'peaking';
      body.frequency.value = 60;
      body.Q.value = 0.9;
      body.gain.value = 6;
      gain.gain.value = (0.18 + strength * 0.5) * (0.35 + 0.65 * (1 - far));
      pan.pan.value = at ? clamp((at.x - player.x) / Math.max(400, distance), -0.8, 0.8) : 0;
      source.connect(low).connect(body).connect(gain).connect(pan);
      pan.connect(rainAudio ? rainAudio.cabin : master);
      if (reverb && near > 0.2) pan.connect(reverb);
      source.start(now);
      source.onended = () => {
        source.disconnect();
        pan.disconnect();
      };
      // The crack: a tearing burst of bright noise, only for a near strike.
      if (near > 0.15) {
        noise(0.35 + near * 0.3, 0.2 + near * 0.55, 2800 + near * 3000);
        setTimeout(() => {
          if (gameMode === 'play') noise(0.5, 0.15 + near * 0.3, 900);
        }, 60 + Math.random() * 80);
      }
    }
    // END SUBSYSTEM: src/weather-audio.js
