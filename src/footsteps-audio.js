    // Footsteps and foley on foot: the ground under each step (footSurfaceAt), a step's sound
    // for that ground and pace, puddles in the wet, landings, and the rustle of a run.
    /**
     * FOOTSTEPS
     * A step falls every half stride of the distance the player actually covers
     * (strideCycle, game-state.js: the legs' own clock), so a wall stops them, a slope
     * slows them and a run quickens them; wading keeps its own swish (water-audio.js).
     * The ground comes from footSurfaceAt(x, y, roof): asphalt on any road or bridge,
     * pavement on the city's sidewalks and plazas, tile on North Point Key and the Blue
     * Hour terrace, a building's roof, wood on the docks, piers, pontoons and the beach
     * boardwalk, steel grating on the drawbridge span, sand, park lawns and county
     * grass, and on the Ridgeline trail dirt or mud, rock, scree above the treeline and
     * snow above the snowline.
     *
     * A step is up to four short layers into one gain and pan (torn down when it ends):
     * the HEEL (a band of noise: the click of a sole), the BODY (a sine falling an octave:
     * the weight), the GRIT (the prebuilt crackle buffer through the ground's filter: sand
     * crunching, gravel, snow, a lawn's swish) and a RING (a resonance: a boardwalk's
     * hollow, the steel's ring, a stone plaza's small room). A walk is softer and longer
     * than a run; left and right feet sit a little apart. In the wet, hard ground splashes
     * (puddles on some steps) and soft ground squelches. A run adds the rustle of clothes
     * and, with a long gun, the tick of its sling. Landings (footLandSound, from
     * falls-body.js playerImpact) are a heavier two-footed step scaled by the speed.
     * Nothing is allocated per frame; a step makes 6-12 nodes that end within 0.35 s.
     */
    const FOOT_SURFACES = {
      // heel: [band Hz, Q, gain, seconds]; body: [Hz, gain, seconds];
      // grit: [filter, Hz, Q, gain, attack, seconds]; ring: [Hz, Q, gain, seconds].
      asphalt: { heel: [1900, 1.2, 0.07, 0.035], body: [105, 0.08, 0.06], grit: ['highpass', 3800, 0.7, 0.018, 0.004, 0.05], hard: true },
      pavement: { heel: [2400, 1.4, 0.075, 0.03], body: [115, 0.075, 0.055], grit: ['highpass', 4200, 0.7, 0.016, 0.004, 0.045], hard: true },
      tile: { heel: [3300, 2, 0.08, 0.025], body: [150, 0.06, 0.05], ring: [950, 9, 0.02, 0.14], hard: true },
      roof: { heel: [1600, 1, 0.045, 0.03], body: [100, 0.06, 0.05], grit: ['bandpass', 2600, 0.9, 0.055, 0.006, 0.1], hard: true },
      wood: { heel: [800, 1.4, 0.06, 0.03], body: [92, 0.08, 0.08], ring: [210, 7, 0.11, 0.16], creak: 0.06, hard: true },
      metal: { heel: [2600, 1.6, 0.06, 0.03], body: [85, 0.07, 0.06], ring: [1240, 14, 0.045, 0.3], ring2: 1.47, hard: true },
      grass: { body: [80, 0.05, 0.07], grit: ['bandpass', 3000, 0.6, 0.05, 0.02, 0.12] },
      sand: { body: [70, 0.035, 0.08], grit: ['lowpass', 1100, 0.7, 0.08, 0.015, 0.15] },
      gravel: { heel: [1500, 1, 0.03, 0.03], body: [90, 0.05, 0.06], grit: ['bandpass', 2600, 0.8, 0.09, 0.008, 0.14] },
      dirt: { heel: [700, 1, 0.05, 0.04], body: [85, 0.07, 0.07], grit: ['bandpass', 1700, 0.8, 0.032, 0.008, 0.08] },
      rock: { heel: [2800, 1.2, 0.07, 0.03], body: [130, 0.06, 0.05], grit: ['highpass', 3600, 0.8, 0.028, 0.005, 0.07], hard: true },
      snow: { body: [70, 0.04, 0.08], grit: ['bandpass', 1300, 0.7, 0.075, 0.04, 0.17], squeak: 0.018 },
      mud: { body: [75, 0.05, 0.08], grit: ['lowpass', 700, 1.2, 0.075, 0.02, 0.16], squelch: 0.05 },
    };
    const footGround = { mud: 0, rock: 0, across: 9, seg: -1, trail: -1 };
    /* The ground under a point, a FOOT_SURFACES key. `roof` is 'terrace' on the Blue
       Hour terrace, truthy on a building's roof. */
    function footSurfaceAt(x, y, roof = null) {
      if (roof === 'terrace') return 'tile';
      if (roof) return 'roof';
      if (drawbridgeOnSpan(x, y)) return 'metal';
      if (onBeachPier(x, y) || onDock(x, y) || onIslePontoon(x, y)) return 'wood';
      const walk = BEACH.boardwalk;
      if (x > walk.x0 && x < walk.x1 && Math.abs(y - walk.y) < walk.width / 2) return 'wood';
      if (onBeach(x, y)) return 'sand';
      if (onRoad(x, y)) return 'asphalt';
      if (onNorthPointKey(x, y)) return 'tile';
      if (parkAt(x, y)) return 'grass';
      if (onMonarchIsle(x, y)) {
        const d = monarchDistrictAt(x, y);
        return d === 'MONARCH BEACH' ? 'sand' : d === 'ROYAL BOTANIC GARDEN' ? 'grass' : 'pavement';
      }
      if (terrainFieldAt(x, y)) {
        const h = terrainHeight(x, y);
        if (h > TERRAIN_SNOWLINE - 120 && terrainSnowAmount(x, y, h, 0, 0) > 0.45) return 'snow';
        offroadSurfaceAt(x, y, footGround);
        if (footGround.rock > 0.5) return 'rock';
        if (footGround.across < 1.15) return footGround.mud > 0.45 ? 'mud' : 'dirt';
        if (h > TERRAIN_TREELINE) return 'gravel';
        if (h > 2 && onMountainTrail(x, y)) return 'dirt';
        if (h > 2) return 'grass';
      }
      if (inAirport(x, y)) return 'asphalt';
      if (x > CITY_SIZE || y > CITY_SIZE || countyRegionAt(x, y)) {
        const town = COUNTY_TOWNS.some((t) => x > t.x - 180 && x < t.x + 1200 && y > t.y - 180 && y < t.y + 1200);
        return town || inMilitary(x, y) ? 'pavement' : 'grass';
      }
      return 'pavement';
    }
    let foleyAudio = null;
    /* The foley buffers (steps, doors, scrub), built on first use: white noise and a
       sparse crackle (grit). */
    function foleyBuffers() {
      if (foleyAudio || !audio) return foleyAudio;
      const rate = audio.sampleRate,
        n = Math.floor(rate * 1.2),
        white = audio.createBuffer(1, n, rate),
        grit = audio.createBuffer(1, n, rate),
        w = white.getChannelData(0),
        g = grit.getChannelData(0);
      for (let i = 0; i < n; i++) {
        w[i] = Math.random() * 2 - 1;
        // Grains: a few sharp crackles over a bed of fine noise.
        g[i] = Math.random() < 0.08 ? Math.random() * 2 - 1 : (Math.random() * 2 - 1) * 0.22;
      }
      foleyAudio = { white, grit };
      return foleyAudio;
    }
    const footTrail = { x: 0, y: 0, ready: false, phase: 0.6, still: 0, speed: 0, side: 1, steps: 0, surface: '', wet: 0, landings: 0, lastLand: null };
    /* One layer of noise: `buffer` through a filter into `out`, shaped by an envelope. */
    function foleyNoise(out, buffer, type, frequency, q, gain, t, attack, length) {
      if (gain < 0.001) return;
      const s = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        g = audio.createGain();
      s.buffer = buffer;
      f.type = type;
      f.frequency.value = frequency;
      f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + length);
      s.connect(f).connect(g).connect(out);
      s.start(t, Math.random() * 0.9);
      s.stop(t + attack + length + 0.03);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        g.disconnect();
      };
    }
    /* A sine (or another wave) gliding from `from` to `to` Hz, for thumps and rings. */
    function foleyTone(out, type, from, to, gain, t, length) {
      if (gain < 0.001) return;
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(from, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + length);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + length + 0.03);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    }
    /* A step's (or a door's) bus on the effects: one gain and pan, torn down after the
       longest layer (`seconds`). */
    function foleyBus(level, pan, seconds = 0.7) {
      const g = audio.createGain(),
        p = audio.createStereoPanner(),
        // Under a deck or between close walls the steps ring back (acoustics-audio.js).
        room = acoustics.cover * 0.7 + acoustics.enclosure * 0.12,
        send = room > 0.03 && reverbSend ? audio.createGain() : null;
      g.gain.value = level;
      p.pan.value = pan;
      g.connect(p).connect(master);
      if (send) {
        send.gain.value = room;
        g.connect(send).connect(reverbSend);
      }
      setTimeout(() => {
        g.disconnect();
        p.disconnect();
        if (send) send.disconnect();
      }, seconds * 1000);
      return g;
    }
    /**
     * One footfall on `surface` (FOOT_SURFACES), `run` 0 (a stroll) to 1 (a full run),
     * `weight` 1 for a step (more for a landing), `wet` 0..1, `pan` the foot's side (or
     * where someone else is), `gain` for someone else's steps at a distance.
     */
    function footstepSound(surface, run, weight = 1, wet = 0, pan = 0, delay = 0, gain = 1) {
      const fa = foleyBuffers();
      if (!fa || !soundOn) return;
      const k = FOOT_SURFACES[surface] || FOOT_SURFACES.pavement,
        t = audio.currentTime + delay,
        out = foleyBus((0.5 + 0.35 * run) * weight * gain, pan),
        pitch = sfxRandom(0.92, 1.08),
        // A walk rolls from heel to toe (longer, softer); a run slaps.
        stretch = 1.25 - 0.3 * run;
      if (k.heel) foleyNoise(out, fa.white, 'bandpass', k.heel[0] * pitch, k.heel[1], k.heel[2] * (0.8 + 0.4 * run), t, 0.003, k.heel[3] * stretch);
      if (k.body) foleyTone(out, 'sine', k.body[0] * pitch * (1.1 - 0.2 * weight / 2), k.body[0] * pitch * 0.5, k.body[1] * Math.min(1.8, weight), t, k.body[2] * (0.8 + 0.3 * weight));
      if (k.grit) {
        const [type, f, q, gain, attack, length] = k.grit;
        foleyNoise(out, fa.grit, type, f * pitch, q, gain, t + 0.004, attack * stretch, length * stretch);
      }
      if (k.ring) {
        foleyNoise(out, fa.white, 'bandpass', k.ring[0] * pitch, k.ring[1], k.ring[2], t + 0.002, 0.004, k.ring[3]);
        if (k.ring2) foleyTone(out, 'sine', k.ring[0] * pitch * k.ring2, 0, k.ring[2] * 0.25, t, k.ring[3] * 0.8);
      }
      // A plank that has seen better days.
      if (k.creak && Math.random() < k.creak) foleyTone(out, 'sawtooth', 340 * pitch, 290 * pitch, 0.008, t + 0.05, 0.22);
      if (k.squeak) foleyNoise(out, fa.grit, 'highpass', 5200, 1, k.squeak, t + 0.03, 0.03, 0.08);
      if (k.squelch) foleyTone(out, 'sine', 420 * pitch, 150, k.squelch * 0.4, t + 0.03, 0.12);
      if (wet > 0.2) {
        if (k.hard) {
          // Wet ground, and now and then a puddle.
          const puddle = wet > 0.45 && Math.random() < 0.35 ? 2.2 : 1;
          foleyNoise(out, fa.white, 'bandpass', sfxRandom(1900, 2800), 0.9, 0.04 * wet * puddle, t + 0.006, 0.004, 0.07 * puddle);
          if (puddle > 1) foleyNoise(out, fa.white, 'lowpass', 900, 0.8, 0.03 * wet, t + 0.01, 0.01, 0.1);
        } else if (surface === 'grass' || surface === 'dirt') foleyTone(out, 'sine', 380 * pitch, 160, 0.02 * wet, t + 0.02, 0.1);
      }
    }
    /* The rustle of a run: clothes every step, a long gun's sling every other one. */
    function runFoley(run, side) {
      const fa = foleyBuffers();
      if (!fa || run < 0.6) return;
      const t = audio.currentTime,
        heavy = selectedWeaponIndex >= 2 && selectedWeaponIndex <= 5 && !!weapons[selectedWeaponIndex]?.owned,
        out = foleyBus(1, side * 0.04);
      foleyNoise(out, fa.white, 'bandpass', sfxRandom(1200, 1700), 0.6, 0.011 * (heavy ? 1.3 : 1), t + 0.02, 0.025, 0.09);
      if (heavy && side > 0) foleyNoise(out, fa.grit, 'bandpass', sfxRandom(3400, 4200), 7, 0.012, t + 0.03, 0.003, 0.05);
    }
    /* Coming down on both feet from a jump or a drop at `into` map units a second. */
    function footLandSound(into) {
      if (!audio || !soundOn || gameMode !== 'play' || player.car || player.swimming) return;
      const surface = footSurfaceAt(player.x, player.y, player.roof ? 'terrace' : player.buildingRoof),
        weight = clamp(into / (7 * UNITS_PER_METRE), 0.6, 2.2),
        wet = weather.wet * (1 - rainShelter());
      footstepSound(surface, 1, weight, wet, -0.05);
      footstepSound(surface, 0.6, weight * 0.7, wet, 0.05, 0.035);
      footTrail.landings++;
      footTrail.lastLand = { surface, into: Math.round(into), weight: +weight.toFixed(2), at: +gameTime.toFixed(2) };
      footTrail.phase = 0.5;
    }
    /* Per frame (audio.js soundUpdate): step when the legs have covered half a stride. */
    function updateFootsteps(deltaSeconds, active) {
      const onFoot =
        active &&
        !player.car &&
        !player.swimming &&
        !player.climbing &&
        !player.fall &&
        !player.tumble &&
        !player.parachute &&
        !player.thrown &&
        !player.carjack &&
        !player.coaster &&
        !transitRide &&
        !taxiRide &&
        player.hp > 0 &&
        !((player.jumpUntil || 0) > gameTime);
      // Runners round about (officers, people fleeing).
      updateNpcSteps(deltaSeconds, active);
      const moved = Math.hypot(player.x - footTrail.x, player.y - footTrail.y);
      footTrail.x = player.x;
      footTrail.y = player.y;
      if (!onFoot || !footTrail.ready || deltaSeconds <= 0 || moved > 40) {
        footTrail.ready = true;
        footTrail.phase = 0.6;
        footTrail.speed = 0;
        return;
      }
      const speed = moved / deltaSeconds;
      footTrail.speed += (speed - footTrail.speed) * Math.min(1, deltaSeconds * 8);
      if (speed < 3) {
        // Standing still: the first step of the next start comes quickly.
        footTrail.still += deltaSeconds;
        if (footTrail.still > 0.3) footTrail.phase = Math.max(footTrail.phase, 0.6);
        return;
      }
      footTrail.still = 0;
      footTrail.phase += moved / (strideCycle(Math.max(footTrail.speed, 8)) / 2) / (player.wading ? 1.35 : 1);
      if (footTrail.phase < 1) return;
      footTrail.phase %= 1;
      footTrail.side = -footTrail.side;
      footTrail.steps++;
      if (player.wading) {
        // Striding through the shallows: each step a swish.
        footTrail.surface = 'water';
        wadeStepSound(player.wading);
        return;
      }
      const run = clamp((footTrail.speed - 5.4 * KMH) / ((25 - 5.4) * KMH), 0, 1),
        surface = footSurfaceAt(player.x, player.y, player.roof ? 'terrace' : player.buildingRoof),
        wet = weather.wet * (1 - rainShelter());
      footTrail.surface = surface;
      footTrail.wet = wet;
      footstepSound(surface, run, 1, wet, footTrail.side * 0.05);
      runFoley(run, footTrail.side);
    }
    /**
     * OTHER PEOPLE'S STEPS: runners near the player on foot (officers giving chase,
     * people fleeing, joggers) step too. Each person within NPC_STEP_REACH keeps a stride
     * clock (a WeakMap of the last position and the phase) and steps on their own ground,
     * placed and quieter with distance, an officer's boots a little heavier. Walkers are
     * left out (a busy street would patter) and a token bucket holds them to about
     * NPC_STEP_RATE steps a second.
     */
    const NPC_STEP_REACH = 150,
      NPC_STEP_RATE = 8,
      NPC_STEP_BURST = 3,
      npcStride = new WeakMap(),
      npcSteps = { tokens: NPC_STEP_BURST, heard: 0, dropped: 0, dt: 0, wet: 0, seen: 0, runners: 0 };
    function updateNpcSteps(deltaSeconds, active) {
      if (!active || deltaSeconds <= 0 || player.car) return;
      npcSteps.tokens = Math.min(NPC_STEP_BURST, npcSteps.tokens + deltaSeconds * NPC_STEP_RATE);
      npcSteps.dt = deltaSeconds;
      npcSteps.wet = weather.wet * (1 - rainShelter());
      for (const o of officers) if (Math.abs(o.x - player.x) < NPC_STEP_REACH && Math.abs(o.y - player.y) < NPC_STEP_REACH) npcStepVisit(o);
      forPeopleNear(player.x, player.y, NPC_STEP_REACH, npcStepVisit);
    }
    function npcStepVisit(p) {
      if (p === player || p.hp <= 0 || p.car || p.hidden || p.sitting || p.swimming) return;
      let s = npcStride.get(p);
      if (!s) {
        npcStride.set(p, { x: p.x, y: p.y, phase: Math.random(), at: gameTime });
        return;
      }
      const moved = Math.hypot(p.x - s.x, p.y - s.y),
        gap = gameTime - s.at;
      s.x = p.x;
      s.y = p.y;
      s.at = gameTime;
      npcSteps.seen++;
      if (gap > 0.25 || gap <= 0 || moved > 30) return;
      const speed = moved / npcSteps.dt;
      if (speed < 2.4 * UNITS_PER_METRE || speed > 9 * UNITS_PER_METRE) return;
      npcSteps.runners++;
      s.phase += moved / (strideCycle(speed) / 2);
      if (s.phase < 1) return;
      s.phase %= 1;
      const d = Math.hypot(p.x - player.x, p.y - player.y),
        gain = (p.police ? 0.8 : 0.6) / (1 + d / 45);
      if (gain < 0.05) return;
      if (npcSteps.tokens < 1) {
        npcSteps.dropped++;
        return;
      }
      npcSteps.tokens--;
      npcSteps.heard++;
      footstepSound(footSurfaceAt(p.x, p.y), 1, p.police ? 1.2 : 0.9, npcSteps.wet, clamp((p.x - player.x) / 300, -0.8, 0.8), 0, gain);
    }
    // Console (DeadEndCity.footsteps): the last steps, and the ground at a point.
    function footstepsReport(x, y) {
      const at = Number.isFinite(x) && Number.isFinite(y);
      return {
        surface: at ? footSurfaceAt(x, y) : footTrail.surface,
        here: footSurfaceAt(player.x, player.y, player.roof ? 'terrace' : player.buildingRoof),
        steps: footTrail.steps,
        speedKmh: +(footTrail.speed / KMH).toFixed(1),
        wet: +footTrail.wet.toFixed(2),
        landings: footTrail.landings,
        lastLand: footTrail.lastLand,
        // Other people's steps: people looked at (per frame, summed), runners among them, steps heard and dropped.
        others: { seen: npcSteps.seen, runners: npcSteps.runners, heard: npcSteps.heard, dropped: npcSteps.dropped },
      };
    }
