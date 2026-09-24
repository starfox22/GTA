    // BEGIN SUBSYSTEM: src/crash-audio.js — Vehicle crash sound
    /**
     * Vehicle crash sound
     * Source: src/crash-audio.js
     * Scope: shared game closure.
     * One layered, positioned sound per vehicle impact (`crashSound`), called by
     * physics.js collisionImpact for car-car and car-wall hits and by damage.js
     * for street props.
     *
     * Layers, each scaled by the impact's energy (closing speed) and material:
     * - the body thump: a recorded low punch plus a sine drop for the chassis;
     * - the crunch: a real recorded car crash (kevp888, CC BY 4.0), its opening
     *   half second for ordinary knocks, the whole two seconds with its debris
     *   for a hard hit;
     * - metal: a heavy metal impact and a sheet-metal plate crumple on top
     *   (Kenney Impact Sounds, CC0), plus a band of crumpling noise;
     * - a plastic bumper crack: a few short, bright noise grains;
     * - glass: a heavy glass burst when a pane actually broke, then tinkling;
     * - debris: small bits landing a moment later;
     * - tyres: a short scrub when the cars were sliding sideways into each other.
     * Trucks, buses and tanks play lower and heavier; a building face adds weight
     * and loses the plastic. Every layer is randomised in pitch and timing, placed
     * by distance and stereo pan like other effects, and a pair of vehicles makes
     * one event per 0.7 s at most (a harder hit may still break through).
     */
    const CRASH_PAIR_SECONDS = 0.7,
      CRASH_AUDIBLE = 1100;
    let crashPairs = new Map(),
      crashRecent = [];
    function crashPick(names) {
      const ready = names.filter((n) => audioBuffers[n]);
      return ready.length ? ready[Math.floor(Math.random() * ready.length)] : null;
    }
    /* One sample layer into the event's bus, at `delay` seconds. */
    function crashLayer(bus, name, delay, gain, rate) {
      const buffer = name && audioBuffers[name];
      if (!buffer || gain < 0.004) return;
      const s = audio.createBufferSource(),
        g = audio.createGain();
      s.buffer = buffer;
      s.playbackRate.value = rate;
      g.gain.value = gain;
      s.connect(g).connect(bus);
      s.start(audio.currentTime + delay);
      s.onended = () => {
        s.disconnect();
        g.disconnect();
      };
    }
    /**
     * `o`: { x, y, closing (units/s along the contact normal), mass (heavier of the
     * two, 1 = a sedan-ish 1.25 spec), other ('car', 'wall', 'building', 'prop'),
     * glass (panes broken by this hit), sliding (units/s across the contact),
     * key (pair id for the cooldown) }.
     */
    function crashSound(o) {
      if (!audio || !soundOn || gameMode !== 'play') return;
      const d = distanceBetween(o, player);
      if (d > CRASH_AUDIBLE) return;
      const now = audio.currentTime,
        energy = clamp((o.closing - 40) / 230, 0, 1),
        last = o.key ? crashPairs.get(o.key) : null;
      // One event per pair in a pile-up of contacts, unless this one is much harder.
      if (last && now - last.at < CRASH_PAIR_SECONDS && energy < last.energy + 0.25) return;
      // Nor more than four crashes starting in the same quarter second anywhere.
      crashRecent = crashRecent.filter((t) => now - t < 0.25);
      if (crashRecent.length >= 4) return;
      crashRecent.push(now);
      if (o.key) crashPairs.set(o.key, { at: now, energy });
      if (crashPairs.size > 200) for (const [k, v] of crashPairs) if (now - v.at > 3) crashPairs.delete(k);
      const heavy = clamp(((o.mass || 1.25) - 1.25) / 2.5, 0, 1),
        // Heavier bodies sound lower; every hit a little different.
        pitch = (1 - heavy * 0.25) * randomBetween(0.93, 1.07),
        solid = o.other === 'building' || o.other === 'wall',
        prop = o.other === 'prop',
        bus = audio.createGain(),
        pan = audio.createStereoPanner(),
        body = audio.createBiquadFilter(),
        attenuation = 1 / (1 + d / 230);
      // Far crashes lose their top end as well as their level.
      body.type = 'lowpass';
      body.frequency.value = clamp(16000 - d * 11, 2500, 16000);
      bus.gain.value = attenuation * (0.55 + energy * 0.65);
      pan.pan.value = clamp((o.x - player.x) / 450, -0.9, 0.9);
      bus.connect(body).connect(pan).connect(master);
      if (energy > 0.3) pan.connect(reverb);
      const position = { x: o.x, y: o.y };
      // Body thump.
      crashLayer(bus, 'crash-thump', 0, (0.35 + energy * 0.45) * (solid ? 1.2 : 1), pitch * randomBetween(0.72, 0.86));
      {
        const osc = audio.createOscillator(),
          g = audio.createGain();
        osc.frequency.setValueAtTime(90 - heavy * 30, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.25 + energy * 0.35 + heavy * 0.2, now + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28 + heavy * 0.15);
        osc.connect(g).connect(bus);
        osc.start(now);
        osc.stop(now + 0.5);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
        };
      }
      if (prop) {
        // A bollard, hydrant or bin: a clang and a scatter, no car crunch.
        crashLayer(bus, crashPick(['crash-metal-1', 'crash-metal-2']), 0.004, 0.25 + energy * 0.35, pitch * randomBetween(1, 1.25));
        crashLayer(bus, 'crash-tinkle', randomBetween(0.18, 0.35), 0.12 + energy * 0.12, randomBetween(1.1, 1.5));
        return;
      }
      // The recorded crunch.
      if (energy > 0.55)
        crashLayer(bus, 'crash-heavy', 0.002, 0.55 + energy * 0.35, pitch * randomBetween(0.95, 1.03));
      else
        crashLayer(bus, 'crash-hit', 0.002, 0.3 + energy * 0.7, pitch * randomBetween(0.98, 1.12));
      // Metal impact and sheet-metal crumple.
      crashLayer(bus, crashPick(['crash-metal-1', 'crash-metal-2']), 0.003, 0.2 + energy * 0.35, pitch * randomBetween(0.8, 1));
      if (energy > 0.12)
        crashLayer(bus, crashPick(['crash-plate-1', 'crash-plate-2']), randomBetween(0.02, 0.06), 0.15 + energy * 0.35, pitch * randomBetween(0.78, 0.95));
      shapedNoise({
        position,
        type: 'bandpass',
        freq: 900 - heavy * 300,
        sweepTo: 320,
        q: 1.4,
        attack: 0.01,
        decay: 0.18 + energy * 0.3,
        gain: 0.12 + energy * 0.2,
        delay: 0.015,
      });
      // Plastic bumper cracking: two or three bright grains on car-to-car hits.
      if (!solid)
        for (let i = 0, n = 2 + Math.floor(Math.random() * 2); i < n; i++)
          shapedNoise({
            position,
            type: 'highpass',
            freq: randomBetween(2600, 4200),
            q: 0.9,
            attack: 0.001,
            decay: randomBetween(0.015, 0.035),
            gain: 0.1 + energy * 0.12,
            delay: randomBetween(0.005, 0.07),
          });
      // Glass: only when a pane broke.
      if (o.glass > 0) {
        crashLayer(bus, crashPick(['crash-glass-1', 'crash-glass-2']), randomBetween(0.025, 0.06), 0.35 + energy * 0.3, randomBetween(0.92, 1.1));
        for (let i = 0, n = 2 + Math.min(3, o.glass); i < n; i++)
          crashLayer(bus, 'crash-tinkle', randomBetween(0.18, 0.75), randomBetween(0.08, 0.16), randomBetween(0.9, 1.6));
      }
      // Debris landing: small bits of trim and lamp a moment later.
      if (energy > 0.3)
        for (let i = 0, n = 1 + Math.floor(energy * 3); i < n; i++)
          crashLayer(bus, crashPick(['crash-metal-2', 'crash-tinkle']), randomBetween(0.25, 0.9), randomBetween(0.04, 0.09), randomBetween(1.5, 2.2));
      // Tyres scrubbing as the two slide on together.
      if (o.sliding > 90)
        shapedNoise({
          position,
          type: 'bandpass',
          freq: randomBetween(1400, 1900),
          sweepTo: 900,
          q: 6,
          attack: 0.04,
          decay: clamp(o.sliding / 400, 0.25, 0.7),
          gain: clamp(o.sliding / 1400, 0.05, 0.16),
          delay: 0.06,
        });
    }
    // END SUBSYSTEM: src/crash-audio.js
