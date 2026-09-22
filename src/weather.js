    // BEGIN SUBSYSTEM: src/weather.js — Weather
    /**
     * Weather
     * Source: src/weather.js
     * Scope: shared game closure.
     * The weather state machine, road wetness, wind and the rain on the audio bus.
     */
    /**
     * WEATHER
     * A chain of states from clear through to heavy rain, walked one step at a
     * time so the sky always changes plausibly: it clouds over before it rains and
     * clears the same way round. Everything downstream reads the smoothed values
     * rather than the state, so a change of weather is a slow drift rather than a
     * cut: `weather.cloud` dims the sun and greys the sky, `weather.rain` drives
     * the fall and the hiss, and `weather.wet` lags both so the roads stay dark and
     * greasy for a while after the shower has passed.
     */
    const WEATHER_STATES = [
      { id: 'clear', name: 'CLEAR', cloud: 0.06, rain: 0, hold: [90, 260] },
      { id: 'fair', name: 'FAIR', cloud: 0.34, rain: 0, hold: [70, 200] },
      { id: 'cloudy', name: 'CLOUDY', cloud: 0.68, rain: 0, hold: [55, 150] },
      { id: 'overcast', name: 'OVERCAST', cloud: 0.9, rain: 0.04, hold: [40, 110] },
      { id: 'rain', name: 'RAIN', cloud: 0.95, rain: 0.6, hold: [30, 80] },
      { id: 'storm', name: 'HEAVY RAIN', cloud: 1, rain: 1, hold: [14, 40] },
    ];
    const weather = {
      index: 1,
      cloud: WEATHER_STATES[1].cloud,
      rain: 0,
      wet: 0,
      wind: 0.42,
      windAngle: -0.7,
      flash: 0,
      thunderIn: 0,
      until: 0,
      locked: false,
    };
    function weatherState() {
      return WEATHER_STATES[weather.index];
    }
    function weatherLabel() {
      return weatherState().name;
    }
    // Asked for directly, the sky snaps rather than drifting, so what you set is
    // what you immediately get; left alone, advanceWeather() always eases in.
    function setWeather(id) {
      const next = WEATHER_STATES.findIndex((s) => s.id === id);
      if (next < 0) return weatherLabel();
      weather.index = next;
      weather.cloud = WEATHER_STATES[next].cloud;
      weather.rain = WEATHER_STATES[next].rain;
      weather.wet = Math.max(weather.wet, Math.min(1, weather.rain * 1.25));
      weather.until = worldMinutes + randomBetween(...WEATHER_STATES[next].hold);
      return weatherLabel();
    }
    function advanceWeather() {
      const here = weather.index,
        // Settled weather drifts; a downpour is always on its way out.
        up = here < WEATHER_STATES.length - 1,
        down = here > 0,
        toward =
          here >= 4 ? -1 : here === 0 ? 1 : seededRandom() < 0.55 ? 1 : -1,
        next = clamp(here + (toward > 0 ? (up ? 1 : -1) : down ? -1 : 1), 0, WEATHER_STATES.length - 1);
      weather.index = next;
      weather.until = worldMinutes + randomBetween(...WEATHER_STATES[next].hold);
    }
    function updateWeather(deltaSeconds) {
      if (!weather.until) weather.until = worldMinutes + randomBetween(...weatherState().hold);
      if (!weather.locked && worldMinutes > weather.until) advanceWeather();
      const target = weatherState(),
        // Cloud builds and clears slowly; rain starts and stops faster than that.
        toCloud = 1 - Math.exp(-deltaSeconds / 26),
        toRain = 1 - Math.exp(-deltaSeconds / 11);
      weather.cloud += (target.cloud - weather.cloud) * toCloud;
      weather.rain += (target.rain - weather.rain) * toRain;
      // Standing water builds while it rains and takes several minutes to dry.
      weather.wet +=
        weather.rain > 0.05
          ? (Math.min(1, weather.rain * 1.25) - weather.wet) * (1 - Math.exp(-deltaSeconds / 20))
          : -weather.wet * (1 - Math.exp(-deltaSeconds / 140));
      weather.wet = clamp(weather.wet, 0, 1);
      weather.wind += (0.3 + weather.rain * 0.9 - weather.wind) * (1 - Math.exp(-deltaSeconds / 30));
      weather.windAngle += Math.sin(gameTime * 0.07) * deltaSeconds * 0.05;
      weather.flash = Math.max(0, weather.flash - deltaSeconds * 4.5);
      if (weather.thunderIn > 0) {
        weather.thunderIn -= deltaSeconds;
        if (weather.thunderIn <= 0) thunder();
      } else if (weather.rain > 0.75 && seededRandom() < deltaSeconds * 0.09) {
        weather.flash = 1;
        weather.thunderIn = randomBetween(0.8, 4.5);
      }
      updateRainSound();
    }
    // Slower going in the wet: tyres let go earlier and stopping takes longer.
    function wetGrip() {
      return 1 - weather.wet * 0.28;
    }
    /* Rain is one looping band of filtered noise whose gain and brightness follow
       the fall, so there is no sample to ship and nothing to start or stop. */
    let rainSource = null,
      rainGain = null,
      rainFilter = null;
    function startRainSound() {
      if (!audio || rainSource) return;
      const seconds = 3,
        n = Math.floor(audio.sampleRate * seconds),
        buffer = audio.createBuffer(1, n, audio.sampleRate),
        data = buffer.getChannelData(0);
      let low = 0;
      for (let i = 0; i < n; i++) {
        const white = Math.random() * 2 - 1;
        low = low * 0.86 + white * 0.14;
        data[i] = white * 0.42 + low * 1.4;
      }
      // Cross-fade the seam so the loop does not tick.
      const fade = Math.floor(audio.sampleRate * 0.25);
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        data[i] = data[i] * t + data[n - fade + i] * (1 - t);
      }
      rainSource = audio.createBufferSource();
      rainGain = audio.createGain();
      rainFilter = audio.createBiquadFilter();
      rainSource.buffer = buffer;
      rainSource.loop = true;
      rainFilter.type = 'lowpass';
      rainFilter.frequency.value = 2400;
      rainGain.gain.value = 0;
      rainSource.connect(rainFilter).connect(rainGain).connect(master);
      rainSource.start();
    }
    function updateRainSound() {
      if (!audio || !soundOn) return;
      if (!rainSource) startRainSound();
      if (!rainGain) return;
      const indoors = player.car && !vehicleSpec(player.car).bike && !isBoat(player.car),
        level = weather.rain * (indoors ? 0.12 : 0.3);
      rainGain.gain.value += (level - rainGain.gain.value) * 0.05;
      rainFilter.frequency.value = indoors ? 900 : 1700 + weather.rain * 2600;
    }
    function thunder() {
      if (!audio || !soundOn) return;
      noise(1.6, 0.5, 190);
      tone(46, 1.4, 0.24, 'sine', 28);
    }
    // END SUBSYSTEM: src/weather.js
