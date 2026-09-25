    // BEGIN SUBSYSTEM: src/weather.js — Weather
    /**
     * Weather
     * Source: src/weather.js
     * Scope: shared game closure.
     * The weather state machine, the build-up before a shower, road wetness,
     * wind, lightning and thunder timing. The sound is weather-audio.js.
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
     *
     * The next step is chosen when a state begins (`weather.next`), so the sky
     * can announce a shower: over the last FRONT_MINUTES of an overcast spell
     * that will turn to rain, `weather.approach` climbs 0 -> 1: the cloud deck
     * thickens and darkens, the wind picks up and gusts, distant thunder rolls
     * in and people on the street remark on it (crowd.js). `weather.shower`
     * counts the showers, so each person reacts once per shower.
     *
     * LIGHTNING
     * A strike (`lightningStrike`) has a place and so a distance from the
     * player: its flash is a flicker of two or three return strokes, brighter
     * the nearer it is, and its thunder arrives distance / speed of sound later
     * (weather-audio.js shapes it by distance: a near strike cracks, a far one
     * only rumbles). Strikes close enough to see draw a bolt (weather3d.js).
     * Storms strike often and near, steady rain now and then and far away, and a
     * front on its way brings the odd far rumble.
     */
    const WEATHER_STATES = [
      { id: 'clear', name: 'CLEAR', cloud: 0.06, rain: 0, hold: [90, 260] },
      { id: 'fair', name: 'FAIR', cloud: 0.34, rain: 0, hold: [70, 200] },
      { id: 'cloudy', name: 'CLOUDY', cloud: 0.68, rain: 0, hold: [55, 150] },
      { id: 'overcast', name: 'OVERCAST', cloud: 0.9, rain: 0.04, hold: [40, 110] },
      { id: 'rain', name: 'RAIN', cloud: 0.95, rain: 0.6, hold: [30, 80] },
      { id: 'storm', name: 'HEAVY RAIN', cloud: 1, rain: 1, hold: [14, 40] },
    ];
    // World minutes of build-up before a shower (one world minute is a second).
    const FRONT_MINUTES = 34,
      // Map units per second: sound in air (512 units = 100 m).
      THUNDER_SPEED = 1756;
    const weather = {
      index: 1,
      next: 2,
      cloud: WEATHER_STATES[1].cloud,
      rain: 0,
      wet: 0,
      wind: 0.42,
      windAngle: -0.7,
      gust: 0,
      approach: 0,
      shower: 0,
      flash: 0,
      // The current strike: where, how bright, how far, when (gameTime).
      strike: null,
      strikes: 0,
      thunder: [],
      until: 0,
      locked: false,
    };
    function weatherState() {
      return WEATHER_STATES[weather.index];
    }
    function weatherLabel() {
      return weatherState().name;
    }
    // Settled weather drifts; a downpour is always on its way out.
    function pickNextWeather(here) {
      const toward = here >= 4 ? -1 : here === 0 ? 1 : seededRandom() < 0.55 ? 1 : -1;
      return clamp(here + toward, 0, WEATHER_STATES.length - 1);
    }
    function enterWeather(index, holdScale = 1) {
      weather.index = index;
      weather.next = pickNextWeather(index);
      weather.until = worldMinutes + randomBetween(...WEATHER_STATES[index].hold) * holdScale;
    }
    // Asked for directly, the sky snaps rather than drifting, so what you set is
    // what you immediately get; left alone, advanceWeather() always eases in.
    function setWeather(id) {
      const next = WEATHER_STATES.findIndex((s) => s.id === id);
      if (next < 0) return weatherLabel();
      enterWeather(next);
      weather.cloud = WEATHER_STATES[next].cloud;
      weather.rain = WEATHER_STATES[next].rain;
      weather.wet = Math.max(weather.wet, Math.min(1, weather.rain * 1.25));
      weather.approach = 0;
      return weatherLabel();
    }
    // A shower on its way: overcast now, rain in `seconds` (the machine runs on).
    function weatherFront(seconds = FRONT_MINUTES) {
      weather.locked = false;
      if (weather.index !== 3) setWeather('overcast');
      weather.next = 4;
      weather.until = worldMinutes + Math.max(1, seconds);
      return weatherReport();
    }
    function advanceWeather() {
      const from = weather.index;
      enterWeather(weather.next);
      if (weather.index >= 4 && from < 4) weather.shower++;
    }
    function weatherReport() {
      return {
        state: weatherState().id,
        next: WEATHER_STATES[weather.next].id,
        locked: weather.locked,
        secondsToNext: Math.round(weather.until - worldMinutes),
        cloud: +weather.cloud.toFixed(2),
        rain: +weather.rain.toFixed(2),
        wet: +weather.wet.toFixed(2),
        wind: +weather.wind.toFixed(2),
        approach: +weather.approach.toFixed(2),
        shower: weather.shower,
        strikes: weather.strikes,
        thunderPending: weather.thunder.length,
      };
    }
    /**
     * A lightning strike `distance` map units from the player (a random bearing),
     * or at a given point. Returns the strike.
     */
    function lightningStrike(distance, at = null) {
      const bearing = seededRandom() * TAU,
        x = at ? at.x : player.x + Math.cos(bearing) * distance,
        y = at ? at.y : player.y + Math.sin(bearing) * distance,
        d = Math.max(60, Math.hypot(x - player.x, y - player.y)),
        // Two to four return strokes down the same channel, a few tens of ms apart.
        strokes = [0];
      for (let k = 1, n = 2 + Math.floor(seededRandom() * 3); k < n; k++) strokes.push(strokes[k - 1] + randomBetween(0.05, 0.16));
      weather.strike = {
        id: ++weather.strikes,
        x,
        y,
        distance: d,
        at: gameTime,
        strength: clamp(1.25 - d / 7000, 0.12, 1),
        strokes,
        seed: seededRandom(),
      };
      weather.thunder.push({ at: gameTime + d / THUNDER_SPEED, distance: d, strength: weather.strike.strength, x, y });
      return weather.strike;
    }
    // The flash: each stroke a sharp rise and a fast fall, the channel glowing between.
    function lightningFlash() {
      const s = weather.strike;
      if (!s) return 0;
      const t = gameTime - s.at;
      if (t > 1.2) return 0;
      let f = 0;
      for (const at of s.strokes) {
        const dt = t - at;
        if (dt >= 0) f = Math.max(f, Math.exp(-dt * 16) * (dt < 0.012 ? dt / 0.012 : 1));
      }
      return f * s.strength;
    }
    function updateWeather(deltaSeconds) {
      stepWeatherMachine(deltaSeconds);
      weather.gust = Math.max(0, Math.sin(gameTime * 0.9) * Math.sin(gameTime * 0.37 + 1.3)) * clamp(weather.wind - 0.5, 0, 1);
      weather.windAngle += Math.sin(gameTime * 0.07) * deltaSeconds * 0.05;
      // Lightning: near and often in a storm, far off in steady rain or ahead of a front.
      const strikeRate = weather.rain > 0.75 ? 0.11 : weather.rain > 0.35 ? 0.025 : weather.approach * 0.035;
      if (gameMode === 'play' && seededRandom() < deltaSeconds * strikeRate) {
        const near = weather.rain > 0.75 ? seededRandom() < 0.45 : weather.rain > 0.35 && seededRandom() < 0.15;
        lightningStrike(near ? randomBetween(250, 1600) : randomBetween(2400, 11000));
      }
      weather.flash = lightningFlash();
      for (let i = weather.thunder.length - 1; i >= 0; i--)
        if (gameTime >= weather.thunder[i].at) {
          const clap = weather.thunder.splice(i, 1)[0];
          thunderSound(clap.distance, clap.strength, clap);
        }
      updateWeatherAudio(deltaSeconds);
      updateParachuteWind();
    }
    /**
     * The weather machine itself, with no sound or lightning: the state moves on
     * when its time is up, then cloud, rain, standing water, the build-up and the
     * wind ease toward it. updateWeather() runs it every frame; a skipped ride
     * (ride-skip.js) runs it in one-second steps across the time it jumps, so the
     * sky after the fade is the one the clock would have brought.
     */
    function stepWeatherMachine(deltaSeconds) {
      if (!weather.until) enterWeather(weather.index);
      if (!weather.locked && worldMinutes > weather.until) advanceWeather();
      const target = weatherState(),
        // Build-up: the last minutes of an overcast spell that turns to rain.
        front = !weather.locked && weather.index === 3 && weather.next === 4 ? clamp(1 - (weather.until - worldMinutes) / FRONT_MINUTES, 0, 1) : 0;
      weather.approach += (front - weather.approach) * (1 - Math.exp(-deltaSeconds / 3));
      const cloudTarget = Math.min(1, target.cloud + weather.approach * 0.08),
        // Cloud builds and clears slowly; rain starts and stops faster than that.
        toCloud = 1 - Math.exp(-deltaSeconds / 26),
        toRain = 1 - Math.exp(-deltaSeconds / 11);
      weather.cloud += (cloudTarget - weather.cloud) * toCloud;
      weather.rain += (target.rain - weather.rain) * toRain;
      // Standing water builds while it rains and takes several minutes to dry.
      weather.wet +=
        weather.rain > 0.05
          ? (Math.min(1, weather.rain * 1.25) - weather.wet) * (1 - Math.exp(-deltaSeconds / 20))
          : -weather.wet * (1 - Math.exp(-deltaSeconds / 140));
      weather.wet = clamp(weather.wet, 0, 1);
      // The wind rises ahead of the rain and gusts while it blows hard.
      const windTarget = 0.3 + weather.rain * 0.9 + weather.approach * 0.55;
      weather.wind += (windTarget - weather.wind) * (1 - Math.exp(-deltaSeconds / (weather.approach > 0.05 ? 12 : 30)));
    }
    // Slower going in the wet: tyres let go earlier and stopping takes longer.
    function wetGrip() {
      return 1 - weather.wet * 0.28;
    }
    // END SUBSYSTEM: src/weather.js
