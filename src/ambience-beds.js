    // Ambience beds by place and time: the city's far wash, gusting wind (the open, the
    // heights, the range), leaves, cicadas and the night chorus, harbour rigging and ship
    // horns, frogs, the hawk, Monarch Isle's sprinklers; cross-faded by the ear's zone.
    /**
     * AMBIENCE BEDS (updateAmbienceBeds, from ambience.js updateAmbience)
     * The ear probe (acoustics-audio.js earProbe) names the place three times a second;
     * each zone's weight (`ambienceBeds.weights`: city, harbour, green, country, mountain, monarch,
     * height, beach) glides to it over a couple of seconds, so walking or driving from
     * one place to the next cross-fades the beds, never cuts them. All of it is filtered
     * noise and oscillators on the ambience bus (no samples):
     *  - CITY WASH: the far roar of the whole city (brown noise round 480 Hz) swelling
     *    and ebbing every few seconds; quieter at night, stronger up on a roof, where the
     *    near traffic hum (ambience.js) thins out.
     *  - WIND: the gusts (`ambienceBeds.gust`, a slow random walk, plus weather.gust) push the
     *    bed's level and its low-pass together; exposure is low in a street canyon
     *    (acoustics.enclosure), higher in the open, on the beach, on a roof or a tower
     *    (acoustics.lift) and up the range; weather.wind scales it all. On exposed heights
     *    the gusts also WHISTLE (a narrow band that bends with them).
     *  - LEAVES rustle with the gusts in parks, gardens and the county's woods.
     *  - CICADAS by day in the warm hours over green ground, in slow swells; a NIGHT
     *    CHORUS of insects (a fine high trill) under ambience.js's crickets.
     * Events on their own clocks: rigging clinking on the masts and a creak of timber in
     * the marinas and docks (more in wind), a ship's horn far off, a bell buoy; a dove
     * cooing, a crow, a woodpecker in the county's woods; a hawk over the range; frogs
     * by the reservoir at night; Monarch Isle's lawn sprinklers at dawn and dusk and a
     * mower far off by day. Rain silences the birds and insects.
     * Everything is built once (five noise layers) and steered with glideParam; events
     * make short-lived oscillators like ambience.js's `voice`.
     */
    const BED_ZONES = ['city', 'harbour', 'green', 'country', 'mountain', 'monarch', 'height', 'beach'];
    const ambienceBeds = {
      layers: null,
      weights: { city: 0, harbour: 0, green: 0, country: 0, mountain: 0, monarch: 0, height: 0, beach: 0 },
      targets: { city: 0, harbour: 0, green: 0, country: 0, mountain: 0, monarch: 0, height: 0, beach: 0 },
      gust: 0.5,
      gustTarget: 0.6,
      gustClock: 0,
      swell: 1,
      swellTarget: 1,
      swellClock: 0,
      cicadaPhase: 0,
      exposure: 0,
      windLevel: 0,
      clock: { rigging: 1, creak: 5, ship: 40, buoy: 20, dove: 8, crow: 30, woodpecker: 15, hawk: 20, frog: 1, sprinkler: 10, mower: 60 },
      heard: { rigging: 0, creak: 0, ship: 0, buoy: 0, dove: 0, crow: 0, woodpecker: 0, hawk: 0, frog: 0, sprinkler: 0, mower: 0 },
    };
    /* One looping noise layer on the ambience bus (like ambience.js's layers). */
    function bedLayer(buffer, type, frequency, q, second) {
      const source = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        gain = audio.createGain();
      source.buffer = buffer;
      source.loop = true;
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
      node.connect(gain).connect(ambience.bus);
      source.start(0, Math.random() * 2.4);
      return { source, filter, gain };
    }
    function buildBeds() {
      if (ambienceBeds.layers) return ambienceBeds.layers;
      const a = ambience;
      ambienceBeds.layers = {
        wash: bedLayer(a.brown, 'bandpass', 480, 0.5, { type: 'lowpass', frequency: 1400 }),
        whistle: bedLayer(a.white, 'bandpass', 900, 10),
        leaves: bedLayer(a.white, 'highpass', 1800, 0.5, { type: 'lowpass', frequency: 6500 }),
        cicada: bedLayer(a.white, 'bandpass', 5200, 5),
        chorus: bedLayer(a.white, 'bandpass', 4300, 12),
      };
      return ambienceBeds.layers;
    }
    /* A short tone on the ambience bus at `pan` (ambience.js `voice`, with a Q'd band). */
    function bedTone(type, from, to, start, length, peak, pan, band = 0, q = 1) {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        p = audio.createStereoPanner();
      o.type = type;
      o.frequency.setValueAtTime(from, start);
      if (to) o.frequency.exponentialRampToValueAtTime(to, start + length);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.03, length * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, start + length);
      p.pan.value = pan;
      let node = o;
      let f = null;
      if (band) {
        f = audio.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = band;
        f.Q.value = q;
        node = o.connect(f);
      }
      node.connect(g).connect(p).connect(ambience.bus);
      o.start(start);
      o.stop(start + length + 0.05);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
        p.disconnect();
        if (f) f.disconnect();
      };
    }
    /* A long tone with a slow swell (a ship's horn, a far mower): attack, hold, release. */
    function bedDrone(type, frequency, start, attack, hold, release, peak, pan, lowpass, wobble = 0) {
      const o = audio.createOscillator(),
        f = audio.createBiquadFilter(),
        g = audio.createGain(),
        p = audio.createStereoPanner(),
        end = start + attack + hold + release;
      o.type = type;
      o.frequency.setValueAtTime(frequency, start);
      if (wobble) {
        // A mower's engine labouring over the grass: the pitch wanders a little.
        for (let t = start + 1.5; t < end; t += 1.5) o.frequency.linearRampToValueAtTime(frequency * sfxRandom(1 - wobble, 1 + wobble), t);
      }
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + attack);
      g.gain.setValueAtTime(peak, start + attack + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      p.pan.value = pan;
      o.connect(f).connect(g).connect(p).connect(ambience.bus);
      o.start(start);
      o.stop(end + 0.05);
      o.onended = () => {
        o.disconnect();
        f.disconnect();
        g.disconnect();
        p.disconnect();
      };
    }
    /* A metallic clink: a halyard's shackle against an aluminium mast. */
    function riggingClink(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.85, 0.85),
        f = sfxRandom(2100, 3500),
        count = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) {
        const t = now + k * sfxRandom(0.09, 0.2),
          decay = sfxRandom(0.12, 0.26);
        bedTone('sine', f, 0, t, decay, 0.016 * level, pan);
        bedTone('sine', f * 2.76, 0, t, decay * 0.6, 0.006 * level, pan);
      }
    }
    function timberCreak(level) {
      const now = audio.currentTime,
        f = sfxRandom(120, 170);
      bedTone('sawtooth', f, f * sfxRandom(0.82, 0.92), now, sfxRandom(0.35, 0.7), 0.012 * level, sfxRandom(-0.7, 0.7), 520, 4);
    }
    /* A ship's horn somewhere out on the water: a long deep chord. */
    function shipHorn(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.8, 0.8),
        hold = sfxRandom(1.4, 2.6);
      bedDrone('sawtooth', 98, now, 0.3, hold, 0.9, 0.028 * level, pan, 520);
      bedDrone('sawtooth', 147, now + 0.04, 0.3, hold, 0.9, 0.02 * level, pan, 520);
    }
    function buoyBell(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.8, 0.8);
      for (const [ratio, gain] of [
        [1, 0.012],
        [1.5, 0.006],
        [2.12, 0.004],
      ])
        bedTone('sine', 880 * ratio, 0, now, 1.6, gain * level, pan);
    }
    /* A collared dove: "coo-COO-coo", low and soft. */
    function doveCoo(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.8, 0.8),
        f = sfxRandom(470, 540);
      [
        [0, 0.22, 1],
        [0.32, 0.42, 1.3],
        [0.86, 0.3, 0.9],
      ].forEach(([at, length, lift]) => bedTone('sine', f * lift * 0.94, f * lift, now + at, length, 0.012 * level, pan, 0));
    }
    function crowCaw(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.9, 0.9),
        count = 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < count; k++) bedTone('sawtooth', sfxRandom(640, 720), 520, now + k * 0.42, 0.28, 0.012 * level, pan, 1200, 2);
    }
    function woodpecker(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.9, 0.9),
        count = 10 + Math.floor(Math.random() * 8);
      for (let k = 0; k < count; k++) bedTone('triangle', 1400, 900, now + k * 0.055, 0.03, 0.02 * level * (1 - k / (count * 1.5)), pan, 1400, 5);
    }
    /* A red-tailed hawk: one long rasping "kee-eeer" falling away. */
    function hawkCry(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.9, 0.9);
      bedTone('sawtooth', 3300, 2200, now, 1.0, 0.012 * level, pan, 2800, 3);
      bedTone('sine', 3300, 2250, now, 1.0, 0.006 * level, pan, 0);
    }
    function frogCall(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.9, 0.9),
        f = sfxRandom(260, 360);
      for (let k = 0; k < 2; k++) bedTone('square', f, f * 0.9, now + k * 0.07, 0.05, 0.01 * level, pan, 800, 2);
    }
    /* An impact sprinkler: tsk-tsk-tsk round the lawn, then the quick rattle back. */
    function sprinkler(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.8, 0.8);
      for (let k = 0; k < 14; k++) bedTone('square', 3600, 0, now + k * 0.22, 0.03, 0.006 * level, pan, 4200, 1.5);
      for (let k = 0; k < 26; k++) bedTone('square', 3900, 0, now + 3.1 + k * 0.035, 0.02, 0.005 * level, pan, 4200, 1.5);
    }
    function farMower(level) {
      const now = audio.currentTime,
        pan = sfxRandom(-0.8, 0.8),
        hold = sfxRandom(14, 26);
      bedDrone('sawtooth', 58, now, 3, hold, 4, 0.008 * level, pan, 380, 0.05);
    }
    /* The zone weights' targets from the probe (acoustics.zone) and the ear's height. */
    function bedTargets() {
      const z = acoustics.zone,
        t = ambienceBeds.targets,
        onFoot = !player.car;
      t.city = z.city;
      t.harbour = z.harbour;
      t.green = z.green;
      t.country = z.country;
      t.mountain = z.mountain;
      t.monarch = z.monarch;
      t.beach = z.beach;
      t.height = onFoot ? clamp((acoustics.lift - 30) / 250, 0, 1) : 0;
    }
    /* Per frame: glide the zone weights, move the gusts, set the beds, fire the events. */
    function updateAmbienceBeds(deltaSeconds, now) {
      const L = buildBeds(),
        a = ambience;
      if (!L) return;
      bedTargets();
      const w = ambienceBeds.weights,
        k = 1 - Math.exp(-deltaSeconds / 1.6);
      for (let i = 0; i < BED_ZONES.length; i++) {
        const name = BED_ZONES[i];
        w[name] += (ambienceBeds.targets[name] - w[name]) * k;
      }
      // Gusts: a slow random walk toward a new target every few seconds.
      ambienceBeds.gustClock -= deltaSeconds;
      if (ambienceBeds.gustClock <= 0) {
        ambienceBeds.gustClock = sfxRandom(1.8, 5.5);
        ambienceBeds.gustTarget = Math.random() < 0.3 ? sfxRandom(0.75, 1) : sfxRandom(0.2, 0.6);
      }
      ambienceBeds.gust += (ambienceBeds.gustTarget - ambienceBeds.gust) * (1 - Math.exp(-deltaSeconds / (ambienceBeds.gustTarget > ambienceBeds.gust ? 1.1 : 2.2)));
      ambienceBeds.swellClock -= deltaSeconds;
      if (ambienceBeds.swellClock <= 0) {
        ambienceBeds.swellClock = sfxRandom(3, 8);
        ambienceBeds.swellTarget = sfxRandom(0.65, 1.2);
      }
      ambienceBeds.swell += (ambienceBeds.swellTarget - ambienceBeds.swell) * (1 - Math.exp(-deltaSeconds / 2.5));
      const hour = crowdHour(),
        light = daylight(),
        night = clamp(1 - light * 3, 0, 1),
        dry = clamp(1 - weather.rain * 5, 0, 1),
        windy = 0.2 + 0.8 * clamp(weather.wind / 1.2, 0, 1),
        gust = clamp(ambienceBeds.gust + weather.gust * 0.5, 0, 1.2),
        exposure = clamp(0.25 + 0.4 * acoustics.open * (1 - w.city * 0.4) + 0.5 * w.mountain + 0.6 * w.height + 0.3 * w.beach + 0.15 * w.harbour, 0, 1.4);
      ambienceBeds.exposure = exposure;
      // City wash: the whole city far off; louder by day and from up on a roof.
      const wash = w.city * (0.012 + 0.02 * light) * ambienceBeds.swell * (1 + 0.6 * w.height);
      glideParam(L.wash.gain.gain, wash, now, 1.2);
      // Wind: level and colour move with the gusts.
      ambienceBeds.windLevel = 0.05 * windy * exposure * (0.45 + 0.55 * gust);
      glideParam(a.wind.gain.gain, ambienceBeds.windLevel, now, 0.6);
      glideParam(a.wind.filter.frequency, 260 + 520 * gust + 220 * exposure, now, 0.8);
      const whistle = 0.02 * windy * Math.max(0, exposure - 0.6) * gust;
      glideParam(L.whistle.gain.gain, whistle, now, 0.5);
      glideParam(L.whistle.filter.frequency, 650 + 800 * gust + 120 * Math.sin(gameTime * 0.7), now, 0.4);
      // Leaves in the trees.
      glideParam(L.leaves.gain.gain, (w.green + 0.15 * w.monarch) * windy * (0.25 + 0.75 * gust) * 0.028, now, 0.5);
      // Insects: cicadas in the warm hours, a night chorus after dark.
      ambienceBeds.cicadaPhase += deltaSeconds / 7;
      const warm = hour > 10 && hour < 18.5 && light > 0.6 ? 1 : 0,
        insectGround = clamp(w.green + 0.6 * w.country + 0.5 * w.monarch, 0, 1) * (1 - clamp((w.mountain - 0.5) * 2, 0, 1)),
        pulse = 0.3 + 0.7 * Math.pow(Math.sin(ambienceBeds.cicadaPhase * Math.PI), 2);
      glideParam(L.cicada.gain.gain, 0.011 * insectGround * warm * dry * pulse, now, 0.6);
      glideParam(L.chorus.gain.gain, 0.006 * insectGround * night * dry, now, 1.5);
      bedEvents(deltaSeconds, hour, light, dry, windy);
    }
    /* An event whose clock ran out: next time in `next` seconds; heard if `when` holds. */
    function bedFire(key, when, next, fn, level) {
      if (ambienceBeds.clock[key] > 0) return;
      ambienceBeds.clock[key] = next;
      if (when && level > 0.05) {
        fn(level);
        ambienceBeds.heard[key]++;
      }
    }
    function bedEvents(deltaSeconds, hour, light, dry, windy) {
      const w = ambienceBeds.weights,
        c = ambienceBeds.clock,
        day = light > 0.35,
        rigged = Math.max(w.harbour, w.height * (acoustics.zone.district === NORTH_POINT_KEY.name ? 0.7 : 0));
      for (const key in c) c[key] -= deltaSeconds;
      const fire = bedFire;
      fire('rigging', rigged > 0.1, sfxRandom(0.4, 2.6) / (0.5 + windy), riggingClink, rigged * (0.5 + 0.6 * windy));
      fire('creak', w.harbour > 0.2, sfxRandom(5, 14), timberCreak, w.harbour);
      fire('ship', w.harbour > 0.3 || w.beach > 0.5, sfxRandom(50, 140), shipHorn, Math.max(w.harbour, w.beach * 0.6));
      fire('buoy', w.harbour > 0.3, sfxRandom(18, 45), buoyBell, w.harbour * 0.8);
      fire('dove', day && dry > 0.5, sfxRandom(9, 26), doveCoo, Math.max(w.green, w.monarch * 0.8, w.city * 0.35) * dry);
      fire('crow', day && dry > 0.5, sfxRandom(25, 60), crowCaw, Math.max(w.green * 0.8, w.country, w.city * 0.3));
      fire('woodpecker', day && dry > 0.5, sfxRandom(18, 45), woodpecker, w.country * (1 - w.mountain) * (acoustics.zone.green > 0 ? 1 : 0));
      fire('hawk', day && dry > 0.3, sfxRandom(25, 70), hawkCry, w.mountain);
      fire('frog', !day && dry > 0.5, sfxRandom(0.5, 2.2), frogCall, clamp(1 - acoustics.zone.lake / 700, 0, 1) + 0.3 * w.green * w.country);
      const sprinklerHour = (hour > 6 && hour < 8) || (hour > 18 && hour < 20);
      fire('sprinkler', sprinklerHour && dry > 0.5, sfxRandom(20, 45), sprinkler, w.monarch);
      fire('mower', day && hour > 9 && hour < 17 && dry > 0.5, sfxRandom(60, 150), farMower, Math.max(w.monarch, 0.4 * w.country));
    }
    // Console (DeadEndCity.soundscape): the zone weights, the gusts and the beds' levels.
    function ambienceBedsReport() {
      const f = (v) => +v.toFixed(3),
        L = ambienceBeds.layers,
        weights = {};
      for (const name of BED_ZONES) weights[name] = f(ambienceBeds.weights[name]);
      return {
        weights,
        gust: f(ambienceBeds.gust),
        exposure: f(ambienceBeds.exposure),
        wind: f(ambienceBeds.windLevel),
        beds: L
          ? {
              wash: f(L.wash.gain.gain.value),
              whistle: f(L.whistle.gain.gain.value),
              leaves: f(L.leaves.gain.gain.value),
              cicada: f(L.cicada.gain.gain.value),
              chorus: f(L.chorus.gain.gain.value),
            }
          : null,
        heard: { ...ambienceBeds.heard },
      };
    }
