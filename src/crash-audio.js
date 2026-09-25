    // BEGIN SUBSYSTEM: src/crash-audio.js — Vehicle crash sound
    /**
     * Vehicle crash sound
     * Source: src/crash-audio.js
     * Scope: shared game closure.
     * One positioned sound per vehicle impact (`crashSound`), called by physics.js
     * collisionImpact for car-car and car-wall hits (light knocks below its damage
     * threshold too) and by damage.js for street props.
     *
     * Each impact plays ONE recorded crash, picked by the closing speed (units/s;
     * UNITS_PER_METRE, 8 units = 1 m/s), with a small random pitch (+-5 %) and gain spread:
     *   12-75 u/s (~5-34 km/h)   a light bump (a dull metal knock) at low gain, or a
     *                            metal scrape when the contact is mostly sideways;
     *   75-160 u/s (~34-72 km/h) one of three medium crashes;
     *   over 160 u/s             a heavy crash (the one with glass in it only when
     *                            a pane broke).
     * Trucks, buses and tanks (mass 4 and up) use the heavy set from 60 u/s (27 km/h) and
     * play a little lower. Extra layers are added only when something happened:
     * a glass shatter when a pane actually broke in this hit, a recorded tyre
     * skid when the two were sliding across each other, and a short debris
     * settle after a really hard hit. No synthesised layers.
     * Street furniture (damage.js) passes its `material`: metal knocks and crashes
     * as before; wood, plastic and fabric play the light knock higher and softer,
     * with the debris settle for splintered timber; stone and trees use the
     * medium or heavy crash a little lower, and a tree adds the thud of the trunk
     * landing a second and a half later (`tree`).
     * The bus plays everything at CRASH_LEVEL (-3.5 dB), `heard` in the log
     * includes it. Placement is by distance (level and a low-pass), stereo pan and, for hard
     * hits, a little reverb. A pair of vehicles makes one event per 0.7 s at most
     * (a much harder hit may break through) and no more than four crashes start
     * in the same quarter second. `crashLog` keeps the last choices for tests
     * (DeadEndCity.crashSounds()).
     */
    const CRASH_PAIR_SECONDS = 0.7,
      // The whole crash bus sits 3.5 dB under the level the samples were
      // matched at, so crashes stay dramatic without towering over gunfire,
      // engines and the street (every layer is scaled alike, so a bump is still
      // as far under a heavy crash as before).
      CRASH_LEVEL = 0.67,
      CRASH_AUDIBLE = 1100,
      CRASH_SETS = {
        bump: ['crash-bump-1', 'crash-bump-2'],
        scrape: ['crash-scrape'],
        medium: ['crash-medium-1', 'crash-medium-2', 'crash-medium-3'],
        // The second heavy crash has glass breaking in it, so it is kept for hits
        // that really broke a pane; without glass the medium FxKid2 crash, a
        // little lower and louder, stands in as the second heavy take.
        heavy: ['crash-heavy-1', 'crash-medium-2'],
        heavyGlass: ['crash-heavy-2', 'crash-heavy-1'],
        glass: ['crash-glass-1', 'crash-glass-2'],
      };
    let crashPairs = new Map(),
      crashRecent = [],
      crashLast = {},
      crashLog = [];
    /* A sample from the set, never the one this set played last time. */
    function crashPick(set) {
      const names = CRASH_SETS[set].filter((n) => audioBuffers[n] || !audio),
        fresh = names.length > 1 ? names.filter((n) => n !== crashLast[set]) : names;
      if (!fresh.length) return null;
      const name = fresh[Math.floor(Math.random() * fresh.length)];
      crashLast[set] = name;
      return name;
    }
    /*
     * One sample into the event's bus at `delay` seconds; `offset`/`length` play
     * a slice of it (with a short fade at both ends so it does not click).
     */
    function crashLayer(bus, name, delay, gain, rate, offset = 0, length = 0) {
      const buffer = name && audioBuffers[name];
      if (!buffer || gain < 0.004) return;
      const s = audio.createBufferSource(),
        g = audio.createGain(),
        t = audio.currentTime + delay;
      s.buffer = buffer;
      s.playbackRate.value = rate;
      if (length) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.04);
        g.gain.setValueAtTime(gain, t + Math.max(0.05, length / rate - 0.15));
        g.gain.linearRampToValueAtTime(0.0001, t + length / rate);
        s.start(t, offset, length);
      } else {
        g.gain.value = gain;
        s.start(t);
      }
      s.connect(g).connect(bus);
      s.onended = () => {
        s.disconnect();
        g.disconnect();
      };
    }
    /*
     * What to play for an impact: the one recorded crash with its gain and rate,
     * plus the optional glass, skid and debris layers.
     */
    function crashChoice(o) {
      const closing = o.closing,
        mass = o.mass || 1.25,
        heavyVehicle = mass >= 4,
        glancing = (o.sliding || 0) > closing * 1.5,
        // Heavier bodies ring lower: a truck about 10 % down, a tank 14 %.
        body = heavyVehicle ? 1 - clamp((mass - 4) / 14, 0, 1) * 0.06 - 0.08 : 1,
        solid = o.other === 'building' || o.other === 'wall';
      let set,
        gain,
        tone = 1;
      const material = o.material || 'metal';
      if (o.other === 'prop' && o.tree) {
        // A trunk snapping: a real crash, lower than sheet metal.
        set = closing < 110 ? 'medium' : 'heavy';
        gain = set === 'medium' ? 0.5 : 0.78;
        tone = 0.86;
      } else if (o.other === 'prop' && material === 'stone') {
        set = closing < 90 ? 'bump' : 'medium';
        gain = set === 'bump' ? 0.3 : 0.55;
        tone = 0.85;
      } else if (o.other === 'prop' && (material === 'wood' || material === 'plastic' || material === 'fabric')) {
        // A bench, a bin, a lounger: a light knock, higher and softer than metal.
        set = 'bump';
        const light = material === 'wood' ? 1 : material === 'plastic' ? 0.7 : 0.45;
        gain = (0.12 + clamp((closing - 30) / 120, 0, 1) * 0.2) * light;
        tone = material === 'wood' ? 1.18 : material === 'plastic' ? 1.32 : 1.45;
      } else if (o.other === 'prop') {
        // A bollard, hydrant or lamp post: a knock, or a real crash if it was hit fast.
        set = closing < 140 ? 'bump' : 'medium';
        gain = set === 'bump' ? 0.18 + clamp((closing - 40) / 100, 0, 1) * 0.22 : 0.45;
      } else if (closing < 75 && !(heavyVehicle && closing >= 60)) {
        set = glancing ? 'scrape' : 'bump';
        // 12 u/s (1.5 m/s) is barely a tap; 75 u/s (34 km/h) a solid knock.
        gain = 0.06 + clamp((closing - 12) / 63, 0, 1) * 0.32;
        if (glancing) gain *= 0.8;
      } else if (closing < 160 && !heavyVehicle) {
        set = 'medium';
        gain = 0.5 + clamp((closing - 75) / 85, 0, 1) * 0.32;
      } else {
        set = o.glass > 0 ? 'heavyGlass' : 'heavy';
        gain = 0.82 + clamp((closing - 160) / 140, 0, 1) * 0.2;
      }
      if (solid) gain *= 1.08;
      const sample = crashPick(set),
        energy = clamp((closing - 40) / 230, 0, 1);
      return {
        set,
        sample,
        gain: gain * randomBetween(0.9, 1.05),
        rate: body * tone * randomBetween(0.95, 1.05) * (sample === 'crash-medium-2' && set === 'heavy' ? 0.94 : 1),
        // Glass only when a pane broke in this very hit (the second heavy crash
        // carries its own glass, so the shatter under it is kept low).
        glass:
          o.glass > 0
            ? { sample: crashPick('glass'), gain: (0.3 + energy * 0.3) * (sample === 'crash-heavy-2' ? 0.5 : 1) }
            : null,
        // A recorded tyre skid while the two slide across each other.
        skid: (o.sliding || 0) > 110 && set !== 'scrape' ? { gain: clamp(o.sliding / 1600, 0.04, 0.13), length: clamp(o.sliding / 500, 0.25, 0.6) } : null,
        // Bits settling after a really hard hit.
        debris:
          closing >= 130 && o.other !== 'prop'
            ? { gain: 0.14 + energy * 0.14 }
            : o.other === 'prop' && (material === 'wood' || material === 'stone')
              ? { gain: 0.1 + energy * 0.12, early: true }
              : null,
        // The trunk landing: a deep thud once the tree has toppled.
        fall: o.tree ? { sample: crashPick('bump'), delay: randomBetween(1.35, 1.7), gain: 0.42 + clamp(((o.propKg || 900) - 900) / 3600, 0, 1) * 0.25 } : null,
      };
    }
    /**
     * `o`: { x, y, closing (units/s along the contact normal), mass (heavier of the
     * two, 1.25 = a coupe), other ('car', 'wall', 'building', 'prop'), glass (panes
     * broken by this hit), sliding (units/s across the contact), key (pair id for
     * the cooldown), and for furniture material ('metal', 'wood', 'plastic',
     * 'fabric', 'glass', 'stone'), tree and propKg }.
     */
    function crashSound(o) {
      if (gameMode !== 'play') return;
      const d = distanceBetween(o, player);
      if (d > CRASH_AUDIBLE || o.closing < 12) return;
      const now = audio ? audio.currentTime : gameTime,
        last = o.key ? crashPairs.get(o.key) : null;
      // A soft knock straight after a crash between the same two is lost in its tail.
      if (last && now - last.at < 1.6 && o.closing < last.closing * 0.35) return;
      // One event per pair in a pile-up of contacts, unless this one is much harder.
      if (last && now - last.at < CRASH_PAIR_SECONDS && o.closing < last.closing * 1.6 + 20) return;
      // Nor more than four crashes starting in the same quarter second anywhere.
      crashRecent = crashRecent.filter((t) => now - t < 0.25);
      if (crashRecent.length >= 4) return;
      crashRecent.push(now);
      if (o.key) crashPairs.set(o.key, { at: now, closing: o.closing });
      if (crashPairs.size > 200) for (const [k, v] of crashPairs) if (now - v.at > 3) crashPairs.delete(k);
      const c = crashChoice(o),
        attenuation = (1 / (1 + d / 230)) * CRASH_LEVEL;
      crashLog.push({
        closing: Math.round(o.closing),
        metersPerSecond: +worldMeters(o.closing).toFixed(1),
        mass: o.mass,
        other: o.other,
        set: c.set,
        sample: c.sample,
        gain: +c.gain.toFixed(3),
        rate: +c.rate.toFixed(3),
        heard: +(c.gain * attenuation).toFixed(3),
        glass: c.glass ? c.glass.sample : null,
        skid: !!c.skid,
        debris: !!c.debris,
        material: o.material || null,
        fall: !!c.fall,
        played: !!(audio && soundOn),
      });
      if (crashLog.length > 20) crashLog.shift();
      if (!audio || !soundOn) return;
      const bus = audio.createGain(),
        pan = audio.createStereoPanner(),
        tone = audio.createBiquadFilter();
      // Far crashes lose their top end as well as their level.
      tone.type = 'lowpass';
      tone.frequency.value = clamp(16000 - d * 11, 2500, 16000);
      bus.gain.value = attenuation;
      pan.pan.value = clamp((o.x - player.x) / 450, -0.9, 0.9);
      bus.connect(tone).connect(pan).connect(master);
      if (c.set !== 'bump' && c.set !== 'scrape') pan.connect(reverb);
      crashLayer(bus, c.sample, 0, c.gain, c.rate);
      if (c.glass) crashLayer(bus, c.glass.sample, randomBetween(0.02, 0.05), c.glass.gain, randomBetween(0.95, 1.05));
      if (c.skid) {
        const tyres = audioBuffers.tires;
        if (tyres) crashLayer(bus, 'tires', 0.03, c.skid.gain, randomBetween(0.92, 1.05), Math.random() * Math.max(0, tyres.duration - 0.7), c.skid.length);
      }
      if (c.debris)
        crashLayer(bus, 'crash-debris', c.debris.early ? randomBetween(0.05, 0.12) : randomBetween(0.45, 0.7), c.debris.gain, c.rate * randomBetween(0.97, 1.05));
      if (c.fall) {
        crashLayer(bus, c.fall.sample, c.fall.delay, c.fall.gain, randomBetween(0.52, 0.6));
        crashLayer(bus, 'crash-debris', c.fall.delay + 0.08, c.fall.gain * 0.5, randomBetween(0.8, 0.9));
      }
      // Tear the event's nodes down once its longest layer has finished.
      setTimeout(() => {
        bus.disconnect();
        tone.disconnect();
        pan.disconnect();
      }, c.fall ? 5000 : 3500);
    }
    // END SUBSYSTEM: src/crash-audio.js
