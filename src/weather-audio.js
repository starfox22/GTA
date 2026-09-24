    // BEGIN SUBSYSTEM: src/weather-audio.js — Rain and thunder sound
    /**
     * Rain and thunder sound
     * Source: src/weather-audio.js
     * Scope: shared game closure (after weather.js).
     *
     * Rain is built from a few looping layers made once, the first time it
     * rains, so nothing is shipped and nothing is allocated per frame:
     *
     *   hiss     fine, bright noise: the curtain of drops in the air
     *   patter   thousands of individual drop impacts (short damped pings at
     *            random pitches) painted into a buffer, a light and a dense one
     *            cross-faded with the intensity
     *   roar     the low body of a downpour on the whole city
     *   roof     drumming on sheet metal: the car's roof when the player is
     *            inside, while everything outside goes through a low-pass as if
     *            heard through the glass
     *   spray    tyres on a wet road: a hiss that rises with speed and wetness
     *
     * One-shots on top: gutter and awning drips (plinks at random pitches and
     * pans, while it rains and for a while after), splashes under the player's
     * feet in the wet, and thunder. Thunder is made per strike: a near one
     * starts with the tearing crack of the channel, then the rolling rumble
     * (brown noise under a low-pass, several swells as the sound of different
     * parts of the channel arrives); the farther away, the later, lower, softer
     * and longer it is, and a distant storm is only a low grumble.
     */
    let rainAudio = null;
    // A looping buffer from a sample function; the seam is cross-faded.
    function rainLoopBuffer(seconds, fill) {
      const rate = audio.sampleRate,
        n = Math.floor(rate * seconds),
        buffer = audio.createBuffer(2, n, rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        fill(data, rate, ch);
        const fade = Math.floor(rate * 0.15);
        for (let i = 0; i < fade; i++) {
          const t = i / fade;
          data[i] = data[i] * t + data[n - fade + i] * (1 - t);
        }
      }
      return buffer;
    }
    // Drop impacts: each a short damped sine at a random pitch and level.
    function paintDrops(data, rate, perSecond, low, high, decay, level) {
      const count = Math.floor((data.length / rate) * perSecond);
      for (let k = 0; k < count; k++) {
        const start = Math.floor(Math.random() * data.length),
          f = low * Math.pow(high / low, Math.random()),
          d = decay * (0.6 + Math.random() * 0.8),
          len = Math.min(Math.floor(rate * d * 5), data.length - start),
          a = level * Math.pow(Math.random(), 2.2),
          w = (TAU * f) / rate;
        for (let i = 0; i < len; i++) data[start + i] += Math.sin(w * i) * Math.exp(-i / (rate * d)) * a;
      }
    }
    function buildRainAudio() {
      if (!audio || !master || rainAudio) return rainAudio;
      const bus = audio.createGain(),
        // Outside sounds pass through this: open on foot, the glass in a car.
        cabin = audio.createBiquadFilter();
      cabin.type = 'lowpass';
      cabin.frequency.value = 18000;
      cabin.Q.value = 0.4;
      bus.gain.value = 1;
      cabin.connect(bus).connect(master);
      const hissBuffer = rainLoopBuffer(3.1, (d) => {
          let b = 0;
          for (let i = 0; i < d.length; i++) {
            const w = Math.random() * 2 - 1;
            b = b * 0.55 + w * 0.45;
            d[i] = (w - b) * 0.5;
          }
        }),
        lightBuffer = rainLoopBuffer(4.3, (d, rate) => paintDrops(d, rate, 260, 1400, 7000, 0.0035, 0.5)),
        heavyBuffer = rainLoopBuffer(3.7, (d, rate) => {
          paintDrops(d, rate, 2200, 900, 6500, 0.003, 0.32);
          paintDrops(d, rate, 180, 300, 900, 0.008, 0.35);
        }),
        roarBuffer = rainLoopBuffer(3.3, (d) => {
          let b = 0;
          for (let i = 0; i < d.length; i++) {
            b = (b + 0.03 * (Math.random() * 2 - 1)) / 1.03;
            d[i] = b * 4;
          }
        }),
        // Drops on a car roof: dull knocks with the panel's ring under them.
        roofBuffer = rainLoopBuffer(3.9, (d, rate) => {
          paintDrops(d, rate, 900, 160, 520, 0.012, 0.55);
          paintDrops(d, rate, 500, 900, 2400, 0.004, 0.25);
        });
      const layer = (buffer, type, frequency, q, out = cabin) => {
        const source = audio.createBufferSource(),
          filter = audio.createBiquadFilter(),
          gain = audio.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(out);
        source.start(0, Math.random() * buffer.duration);
        return { source, filter, gain };
      };
      rainAudio = {
        bus,
        cabin,
        hiss: layer(hissBuffer, 'highpass', 2600, 0.5),
        light: layer(lightBuffer, 'highpass', 700, 0.5),
        heavy: layer(heavyBuffer, 'highpass', 400, 0.5),
        roar: layer(roarBuffer, 'lowpass', 900, 0.6),
        // The roof and the tyres are not behind the glass.
        roof: layer(roofBuffer, 'lowpass', 1400, 0.7, bus),
        spray: layer(hissBuffer, 'bandpass', 1900, 0.6, bus),
        dripClock: 1,
        stepX: player.x,
        stepY: player.y,
      };
      return rainAudio;
    }
    function updateWeatherAudio(deltaSeconds) {
      if (!audio || !master) return;
      const raining = weather.rain > 0.02 || weather.wet > 0.05;
      if (!rainAudio && !raining) return;
      const a = buildRainAudio();
      if (!a) return;
      const now = audio.currentTime,
        on = soundOn && gameMode === 'play',
        r = on ? weather.rain : 0,
        heavy = clamp((r - 0.45) / 0.45, 0, 1),
        c = player.car,
        spec = c ? vehicleSpec(c) : null,
        // Inside a closed vehicle: the glass muffles the street, the roof drums.
        cabin = !!c && !spec.bike && !spec.bicycle && !spec.jetski && c.type !== 'roadster' && !(spec.boat && c.type !== 'workboat'),
        set = (node, value, time = 0.4) => node.gain.gain.setTargetAtTime(value, now, time);
      a.cabin.frequency.setTargetAtTime(cabin ? 620 : 16000, now, 0.15);
      const outside = cabin ? 0.55 : 1;
      set(a.hiss, r * 0.075 * outside);
      set(a.light, r * (1 - heavy * 0.6) * 0.34 * outside);
      set(a.heavy, heavy * 0.3 * outside);
      set(a.roar, (r * 0.05 + heavy * 0.12) * outside);
      set(a.roof, cabin ? r * (0.22 + heavy * 0.2) : 0, 0.2);
      // Tyres on a wet road.
      const rolling = c && !spec.boat && !spec.jetski && !isAircraft(c) ? Math.abs(c.speed || 0) : 0;
      set(a.spray, on ? clamp(rolling / 260, 0, 1) * weather.wet * 0.2 : 0, 0.15);
      a.spray.filter.frequency.setTargetAtTime(1300 + rolling * 3, now, 0.2);
      if (!on) return;
      // Drips from gutters, awnings and trees: on foot, while it is wet.
      a.dripClock -= deltaSeconds;
      if (a.dripClock <= 0) {
        a.dripClock = randomBetween(0.25, 1.4) / (0.4 + weather.wet);
        if (!c && weather.wet > 0.25) dripSound(randomBetween(-0.8, 0.8), 0.03 + weather.wet * 0.05);
      }
      // Splashes underfoot: one per stride through standing water.
      if (!c && !player.parachute && !player.swimming) {
        const stride = Math.hypot(player.x - a.stepX, player.y - a.stepY);
        if (stride > 26) {
          a.stepX = player.x;
          a.stepY = player.y;
          if (weather.wet > 0.2 && stride < 120) splashSound(weather.wet);
        }
      } else {
        a.stepX = player.x;
        a.stepY = player.y;
      }
    }
    // One drop off a gutter into a puddle: a plink that falls in pitch.
    function dripSound(pan, level) {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        p = audio.createStereoPanner(),
        now = audio.currentTime,
        f = randomBetween(1300, 3400);
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, now + 0.05);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(level, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      p.pan.value = pan;
      o.connect(g).connect(p).connect(rainAudio ? rainAudio.cabin : master);
      o.start(now);
      o.stop(now + 0.1);
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
      s.connect(f).connect(g).connect(master);
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
