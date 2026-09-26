    // ---- Park sound ------------------------------------------------------------------
    /**
     * All procedural (Web Audio): the fountain show's music (a plucked oud-like
     * line in the Hijaz mode over a drone and a frame drum, scheduled ahead on
     * the audio clock), the train's roar and the lift chain's clatter, screams
     * from the flume and the drop tower (detuned voices through vowel formants,
     * pitch swooping; the Falcon's riders use recorded voices, RIDERS' VOICES)
     * and the fireworks (a whistle up, a boom delayed by the distance, crackle).
     */
    const parkAudio = { bus: null, roar: null, nextNote: 0, step: 0, clackAt: 0 };
    function parkAudioBus() {
      if (!audio || !master) return null;
      if (parkAudio.bus) return parkAudio.bus;
      const bus = audio.createGain();
      bus.gain.value = 1;
      bus.connect(ambienceBus);
      parkAudio.bus = bus;
      // Train roar: looping noise through a low-pass; gain follows speed and distance.
      const n = audio.sampleRate * 2,
        buffer = audio.createBuffer(1, n, audio.sampleRate),
        d = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) {
        last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
        d[i] = last * 6;
      }
      const src = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        gain = audio.createGain();
      src.buffer = buffer;
      src.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(bus);
      src.start();
      parkAudio.roar = { filter, gain };
      return bus;
    }
    function parkDistanceGain(x, y, reach = 400) {
      return 1 / (1 + Math.hypot(x - player.x, y - player.y) / reach);
    }
    function parkScream(x, y, loud = 1) {
      const bus = parkAudioBus();
      if (!bus || !voicesOn) return;
      const g0 = parkDistanceGain(x, y, 260) * loud;
      if (g0 < 0.03) return;
      const t = audio.currentTime,
        dur = randomBetween(0.9, 1.8),
        voices = 2 + Math.floor(seededRandom() * 3),
        out = audio.createGain(),
        pan = audio.createStereoPanner();
      pan.pan.value = clamp((x - player.x) / 450, -0.9, 0.9);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.09 * g0, t + 0.12);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      out.connect(pan).connect(bus);
      for (let v = 0; v < voices; v++) {
        const o = audio.createOscillator(),
          vib = audio.createOscillator(),
          vibGain = audio.createGain(),
          f1 = audio.createBiquadFilter(),
          f2 = audio.createBiquadFilter(),
          mix = audio.createGain(),
          base = randomBetween(520, 980);
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(base * 0.8, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.25, t + dur * 0.3);
        o.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur);
        vib.frequency.value = randomBetween(5, 8);
        vibGain.gain.value = base * 0.03;
        vib.connect(vibGain).connect(o.frequency);
        // "Aah": formants near 900 and 1400 Hz.
        f1.type = 'bandpass';
        f1.frequency.value = 900;
        f1.Q.value = 6;
        f2.type = 'bandpass';
        f2.frequency.value = 1450;
        f2.Q.value = 8;
        mix.gain.value = 0.5;
        o.connect(f1).connect(mix);
        o.connect(f2).connect(mix);
        mix.connect(out);
        o.start(t);
        vib.start(t);
        o.stop(t + dur + 0.05);
        vib.stop(t + dur + 0.05);
      }
    }
    // Hijaz on D: D Eb F# G A Bb C D.
    const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12];
    const FOUNTAIN_TUNES = [
      [0, 2, 3, 4, 3, 2, 1, 0, 4, 5, 6, 7, 6, 4, 3, 2],
      [7, 6, 4, 5, 4, 3, 2, 3, 1, 2, 3, 4, 2, 1, 0, 0],
      [0, 0, 4, 3, 4, 5, 4, 3, 2, 3, 4, 7, 6, 5, 4, 2],
    ];
    function parkNote(time, freq, dur, gain, type = 'triangle', cutoff = 2400) {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        f = audio.createBiquadFilter();
      o.type = type;
      o.frequency.value = freq;
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(f).connect(g).connect(parkAudio.bus);
      o.start(time);
      o.stop(time + dur + 0.05);
    }
    function parkDrum(time, gain, low) {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.frequency.setValueAtTime(low ? 90 : 220, time);
      o.frequency.exponentialRampToValueAtTime(low ? 45 : 120, time + 0.15);
      g.gain.setValueAtTime(gain, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + (low ? 0.35 : 0.12));
      o.connect(g).connect(parkAudio.bus);
      o.start(time);
      o.stop(time + 0.4);
    }
    function updateFountainMusic() {
      const show = parkShow.fountain,
        L = PIER.lagoon,
        level = parkDistanceGain(L.x, L.y, 350);
      if (!show || level < 0.08) {
        parkAudio.nextNote = 0;
        return;
      }
      const beat = 60 / show.bpm,
        now = audio.currentTime;
      if (parkAudio.nextNote < now) {
        parkAudio.nextNote = now + 0.05;
        parkAudio.step = Math.floor(show.t / beat);
      }
      const tune = FOUNTAIN_TUNES[show.index],
        root = [146.83, 130.81, 164.81][show.index];
      while (parkAudio.nextNote < now + 0.3) {
        const step = parkAudio.step++,
          t = parkAudio.nextNote,
          degree = tune[step % tune.length],
          f = root * Math.pow(2, HIJAZ[degree] / 12);
        // Oud-like pluck an octave up, the drone on the bar, the drum on the beat.
        parkNote(t, f * 2, beat * 0.9, 0.08 * level, 'triangle', 2600);
        if (step % 2 === 1) parkNote(t + beat / 2, f * 3, beat * 0.4, 0.03 * level, 'sine', 3000);
        if (step % 8 === 0) {
          parkNote(t, root / 2, beat * 8, 0.05 * level, 'sawtooth', 500);
          parkNote(t, (root * 3) / 4, beat * 8, 0.025 * level, 'sawtooth', 600);
        }
        parkDrum(t, (step % 4 === 0 ? 0.22 : 0.1) * level, step % 4 === 0);
        if (step % 4 === 3) parkDrum(t + beat / 2, 0.06 * level, false);
        parkAudio.nextNote += beat;
      }
    }
    function parkFireworkSound(kind, x, y, z = 0) {
      const bus = parkAudioBus();
      if (!bus) return;
      const gain = parkDistanceGain(x, y, 700);
      if (gain < 0.04) return;
      // Sound travels 1760 units a second: the boom follows the flash.
      const t = audio.currentTime + Math.hypot(x - player.x, y - player.y, z) / 1760;
      if (kind === 'launch') {
        const o = audio.createOscillator(),
          g = audio.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(900, t);
        o.frequency.exponentialRampToValueAtTime(2600, t + 1.4);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.025 * gain, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + 1.6);
        return;
      }
      parkDrum(t, 0.6 * gain, true);
      const n = Math.floor(audio.sampleRate * 1.2),
        b = audio.createBuffer(1, n, audio.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const k = i / n;
        // A dull boom then scattered crackle.
        d[i] = (Math.random() * 2 - 1) * (Math.exp(-k * 18) + (Math.random() < 0.004 ? 0.8 : 0) * (1 - k));
      }
      const s = audio.createBufferSource(),
        g = audio.createGain(),
        f = audio.createBiquadFilter();
      s.buffer = b;
      f.type = 'lowpass';
      f.frequency.value = 1800;
      g.gain.value = 0.35 * gain;
      s.connect(f).connect(g).connect(bus);
      s.start(t);
    }
    function parkSplashSound(x, y) {
      const bus = parkAudioBus();
      if (!bus) return;
      const gain = parkDistanceGain(x, y, 250);
      if (gain < 0.05) return;
      const n = Math.floor(audio.sampleRate * 1.4),
        b = audio.createBuffer(1, n, audio.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
      const s = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        g = audio.createGain();
      s.buffer = b;
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 0.6;
      g.gain.value = 0.5 * gain;
      s.connect(f).connect(g).connect(bus);
      s.start();
      if (seededRandom() < 0.7) parkScream(x, y, 0.8);
    }
    function updateParkAudio(deltaSeconds) {
      if (!audio || !soundOn) return;
      const near = Math.hypot(player.x - PARK_CENTER.x, player.y - PARK_CENTER.y) < 2400;
      if (!near && !parkAudio.bus) return;
      if (!parkAudioBus()) return;
      const riding = player.coaster?.kind === 'train',
        front = coasterSeat(0, parkScratch),
        speed = coasterTrain.running ? coasterTrain.speed : 0,
        level = riding ? 0.5 : parkDistanceGain(front.x, front.y, 300);
      // The roar: rumble of wheels on steel, brighter with speed.
      const roar = parkAudio.roar;
      glideParam(roar.gain.gain, near ? clamp(speed / 180, 0, 1) * 0.5 * level : 0, audio.currentTime, 0.1);
      glideParam(roar.filter.frequency, 200 + speed * 6, audio.currentTime, 0.1);
      // The lift chain's anti-rollback clack.
      if (coasterTrain.running && front.kind === 2 && gameTime > parkAudio.clackAt && level > 0.05) {
        parkAudio.clackAt = gameTime + 0.16;
        parkNote(audio.currentTime, 1800, 0.03, 0.05 * level, 'square', 4000);
      }
      // The riders' screams are recorded voices cued by the track (updateFalconVoices).
      if (near) updateFountainMusic();
    }
    /* DeadEndCity.ride('coaster' | 'wheel'): walk the player to the ride and board it. */
    function rideAttraction(kind) {
      // A test may call this from the air: set the aircraft down where it is first.
      const craft = player.car;
      if (craft && isAircraft(craft)) {
        craft.altitude = terrainHeight(craft.x, craft.y);
        craft.vx = craft.vy = craft.speed = 0;
      }
      if (kind === 'wheel') {
        teleportPlayer(PIER.terminal.x - 10, PIER.wheel.y);
        return boardWheel();
      }
      teleportPlayer(PIER.station.x, PIER.station.y + 40);
      coasterTrain.running = false;
      coasterTrain.t = COASTER_STOP;
      coasterTrain.dwell = 1;
      return boardCoaster();
    }
    // The Falcon's height and top speed as a rider is told them (from the circuit itself).
    function coasterBanner() {
      const T = coasterCircuit();
      let maxZ = 0,
        maxV = 0;
      for (let i = 0; i < T.count; i++) {
        maxZ = Math.max(maxZ, T.Z[i]);
        maxV = Math.max(maxV, T.speed[i]);
      }
      return Math.round(worldMeters(maxZ)) + ' metres, ' + speedText(maxV).toLowerCase();
    }
    // ---- Console report --------------------------------------------------------------
    /* DeadEndCity.park(): ride states, coaster numbers and an overlap self-check. */
    function parkReport() {
      const T = coasterCircuit();
      let maxZ = 0,
        maxV = 0;
      for (let i = 0; i < T.count; i++) {
        maxZ = Math.max(maxZ, T.Z[i]);
        maxV = Math.max(maxV, T.speed[i]);
      }
      const solids = parkSolids(),
        overlaps = [];
      for (let i = 0; i < solids.length; i++)
        for (let j = i + 1; j < solids.length; j++) {
          const a = solids[i],
            b = solids[j];
          if (a.kind === b.kind && (a.kind === 'lagoon' || a.kind === 'flume' || a.kind === 'unicorn statue')) continue;
          if (a.kind.startsWith('flume') && b.kind.startsWith('flume')) continue;
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
            overlaps.push(a.kind + ' x ' + b.kind + ' at ' + Math.round(a.x) + ',' + Math.round(a.y));
        }
      for (const s of solids) {
        if (s.kind === 'lagoon' || s.kind === 'coaster support' || s.kind === 'flume') continue;
        if (parkPathNear(s.x + s.w / 2, s.y + s.h / 2, -4) && s.w < 60) overlaps.push(s.kind + ' on a path at ' + Math.round(s.x) + ',' + Math.round(s.y));
        if (!onSunsetIsle(s.x + s.w / 2, s.y + s.h / 2)) overlaps.push(s.kind + ' off the island at ' + Math.round(s.x) + ',' + Math.round(s.y));
      }
      return {
        coaster: {
          length: Math.round(worldMeters(T.length)) + ' m',
          height: Math.round(worldMeters(maxZ)) + ' m',
          topSpeed: Math.round(worldMeters(maxV) * 3.6) + ' km/h',
          supports: coasterFootings().length,
          train: { t: Math.round(coasterTrain.t), speed: Math.round(coasterTrain.speed), running: coasterTrain.running, dwell: +coasterTrain.dwell.toFixed(1) },
        },
        wheel: { height: Math.round(worldMeters(PIER.wheel.hub + WHEEL_CAPSULE_RADIUS + 12)) + ' m', capsules: WHEEL_CAPSULES, angle: +(wheelAngle() % TAU).toFixed(2) },
        riding: player.coaster ? { kind: player.coaster.kind, view: player.coaster.view, altitude: Math.round(player.altitude) } : null,
        fountain: parkShow.fountain,
        fireworks: parkShow.fireworks,
        rockets: parkShow.rockets.length,
        guests: pedestrians.filter((p) => p.parkGuest).length,
        queued: pedestrians.filter((p) => p.parkQueue).length,
        palms: parkPalms().length,
        solids: solids.length,
        overlaps,
      };
    }
