    // BEGIN SUBSYSTEM: src/sports-audio.js — Stadium goal cheers and whistles
    /**
     * Stadium goal cheers and whistles
     * Source: src/sports-audio.js
     * Scope: shared game closure (uses ambience.js's bus, voice() and noiseBurst()).
     *
     * The stadium is quiet between goals: there is no crowd bed, no chanting and
     * no clapping (a filtered-noise bed read as white noise from the street).
     * - A goal: the recorded roar of a real football crowd (`stadium-goal-cheer`,
     *   8 s: a swell, the roar, the decay) from the scoring club's end, and the
     *   other end's groan (`stadium-goal-groan`) under it; a goal the player puts
     *   in (or a kickabout goal in front of the fans) has the whole ground cheering.
     *   How loud is the fixture's attendance times the player's distance to the
     *   stadium (`stadiumAudibility`): full inside and on the plaza, faint a few
     *   blocks away, silent beyond STADIUM_CHEER_SILENT. Each voice follows the
     *   player while it plays (level, stereo side, a low-pass that dulls with
     *   distance) and goes through the ambience bus, so it is on the effects
     *   volume and falls silent while the game is paused.
     * - Screams when the stands panic (the recorded civilian screams).
     * - The referee's whistle (a trilled pea whistle) and the thud of a kick.
     */
    const STADIUM_SOUND_CENTRE = { x: 2689, y: 4579 };
    // Where each club's fans sit (sports3d.js seat.end: team 0 west, team 1 east).
    const STADIUM_ENDS = [
      { x: 2420, y: 4579 },
      { x: 2960, y: 4579 },
    ];
    // Map units from the stadium lot's edge: the level halves at STADIUM_CHEER_REACH
    // and is gone at STADIUM_CHEER_SILENT (a city block is ~500 units).
    const STADIUM_CHEER_REACH = 280,
      STADIUM_CHEER_FADE = 1100,
      STADIUM_CHEER_SILENT = 1700;
    // Playing goal reactions (updated each frame) and the last one started, for tests.
    const stadiumCheers = [];
    let stadiumCheerLog = null;

    function sportsSoundReady() {
      return !!(audio && soundOn && gameMode === 'play' && buildAmbience());
    }

    /**
     * How well the player hears the stadium (0..1): 1 inside the lot and on the
     * forecourt, then an inverse-power fall-off with distance from the lot's edge
     * that fades to nothing between STADIUM_CHEER_FADE and STADIUM_CHEER_SILENT.
     */
    function stadiumAudibility(listener = player) {
      const lot = STADIUM_LOT,
        dx = Math.max(lot.x - listener.x, 0, listener.x - (lot.x + lot.w)),
        dy = Math.max(lot.y - listener.y, 0, listener.y - (STADIUM_FORECOURT.y + STADIUM_FORECOURT.h)),
        distance = Math.hypot(dx, dy),
        falloff = 1 / (1 + (distance / STADIUM_CHEER_REACH) ** 1.7),
        edge = clamp((STADIUM_CHEER_SILENT - distance) / (STADIUM_CHEER_SILENT - STADIUM_CHEER_FADE), 0, 1);
      return { distance, level: falloff * edge * edge * (3 - 2 * edge) };
    }

    /* Level, stereo side and brightness of a stand-side source for the player. */
    function stadiumCheerMix(source, gain) {
      const hearing = stadiumAudibility(),
        // Inside the ground the two ends are left and right; from the street the
        // whole stadium is one direction.
        spread = clamp(hearing.distance / 400, 0, 1),
        from = { x: source.x + (STADIUM_SOUND_CENTRE.x - source.x) * spread, y: source.y },
        pan = clamp((from.x - player.x) / 500, -0.85, 0.85);
      return {
        gain: gain * hearing.level,
        pan,
        cutoff: 14000 / (1 + hearing.distance / 260),
        distance: hearing.distance,
        level: hearing.level,
      };
    }

    /* One recorded reaction from a stand, followed round by updateSportsAudio. */
    function playStadiumCrowd(name, source, gain) {
      const buffer = audioBuffers[name];
      if (!buffer) return null;
      const mix = stadiumCheerMix(source, gain);
      if (mix.gain < 0.004) return { name, gain: 0, distance: mix.distance, skipped: true };
      const node = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        level = audio.createGain(),
        pan = audio.createStereoPanner();
      node.buffer = buffer;
      node.playbackRate.value = randomBetween(0.97, 1.03);
      filter.type = 'lowpass';
      filter.frequency.value = Math.max(700, mix.cutoff);
      filter.Q.value = 0.5;
      level.gain.value = mix.gain;
      pan.pan.value = mix.pan;
      node.connect(filter).connect(level).connect(pan).connect(ambience.bus);
      node.start();
      const cheer = { name, source, gain, node, filter, level, pan, mix };
      stadiumCheers.push(cheer);
      node.onended = () => {
        node.disconnect();
        filter.disconnect();
        level.disconnect();
        pan.disconnect();
        const index = stadiumCheers.indexOf(cheer);
        if (index >= 0) stadiumCheers.splice(index, 1);
      };
      return { name, gain: +mix.gain.toFixed(4), pan: +mix.pan.toFixed(2), distance: Math.round(mix.distance), level: +mix.level.toFixed(3) };
    }

    /* Each playing cheer tracks the player's distance from the stadium. */
    function updateSportsAudio() {
      if (!audio || !stadiumCheers.length) return;
      const now = audio.currentTime;
      for (const cheer of stadiumCheers) {
        const mix = (cheer.mix = stadiumCheerMix(cheer.source, cheer.gain));
        glideParam(cheer.level.gain, mix.gain, now, 0.15);
        glideParam(cheer.pan.pan, mix.pan, now, 0.2);
        glideParam(cheer.filter.frequency, Math.max(700, mix.cutoff), now, 0.2);
      }
    }

    /**
     * A goal at the stadium. `team` scored (null when everyone cheers: the
     * player's goal, a kickabout); the strength scales the whole reaction.
     */
    function sportsCrowdRoar(match, strength = 1, team = null) {
      if (match.sport !== 'soccer' || !sportsSoundReady()) return;
      const present = sportsCrowdPresence(match);
      if (present < 0.05) return;
      const crowd = (0.35 + 0.65 * Math.min(1, present)) * strength,
        home = team === 0,
        played = [];
      if (team === null) played.push(playStadiumCrowd('stadium-goal-cheer', STADIUM_SOUND_CENTRE, 0.62 * crowd));
      else {
        // The scorers' end goes up; the other end groans (the home crowd is the louder).
        played.push(playStadiumCrowd('stadium-goal-cheer', STADIUM_ENDS[team], (home ? 0.62 : 0.5) * crowd));
        played.push(playStadiumCrowd('stadium-goal-groan', STADIUM_ENDS[1 - team], (home ? 0.22 : 0.38) * crowd));
      }
      stadiumCheerLog = {
        time: +gameTime.toFixed(1),
        team,
        crowd: +present.toFixed(2),
        audibility: +stadiumAudibility().level.toFixed(3),
        voices: played.filter(Boolean),
      };
    }

    /* Screaming in the stands as everyone runs for the exits. */
    function sportsCrowdPanicSound(match) {
      if (!sportsSoundReady()) return;
      const level = match.sport === 'soccer' ? stadiumAudibility().level : 1 / (1 + distanceBetween(player, match.venue) / 300);
      if (level < 0.03) return;
      playSample('civilian-scream-female-1', 0.45 * level, randomBetween(0.95, 1.05), player);
      playSample('civilian-scream-male-1', 0.4 * level, randomBetween(0.95, 1.05), player);
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

    /* DeadEndCity.stadiumSound(): what the stadium is playing (for tests). */
    function stadiumSoundReport() {
      const hearing = stadiumAudibility();
      return {
        // There is no continuous stadium layer any more; only goal reactions play.
        bed: null,
        distance: Math.round(hearing.distance),
        audibility: +hearing.level.toFixed(3),
        bus: ambience ? +ambience.bus.gain.value.toFixed(3) : null,
        // The street murmur of pedestrians nearby (ambience.js), for comparison.
        streetMurmur: ambience ? +ambience.murmur.gain.gain.value.toFixed(4) : null,
        // Each voice's target for where the player is now (`gain`, `pan`,
        // `cutoff`) and the live parameter (`gainNow`) gliding towards it.
        playing: stadiumCheers.map((cheer) => ({
          name: cheer.name,
          gain: +cheer.mix.gain.toFixed(4),
          gainNow: +cheer.level.gain.value.toFixed(4),
          pan: +cheer.mix.pan.toFixed(2),
          cutoff: Math.round(Math.max(700, cheer.mix.cutoff)),
          distance: Math.round(cheer.mix.distance),
        })),
        lastGoal: stadiumCheerLog,
        samples: ['stadium-goal-cheer', 'stadium-goal-groan'].filter((name) => audioBuffers[name]),
      };
    }
    // END SUBSYSTEM: src/sports-audio.js
