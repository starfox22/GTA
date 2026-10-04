    // Vehicle foley: horns by class (the player's and traffic's), doors and a locked handle,
    // the tyres' ground (squeal or scrub), traffic skids, suspension knocks and pass-by whooshes.
    /**
     * VEHICLE FOLEY
     * HORNS (hornKind, HORN_VOICES): a car's two-tone disc horn (square waves a major
     * third apart, a nasal peak near 1.8 kHz), a sports car's brighter pair, a luxury
     * car's low warm chord, a van's, the three-note air horn of a truck, bus or ambulance
     * (it starts flat and rises into pitch), a motorbike's thin beep, a jet ski's, a
     * speedboat's and the harbour launch's deep ship horn, the tank's klaxon and the
     * bicycle's bell (a double strike of inharmonic partials). The player's horn sounds
     * while `horn` is held (actionHeld; the voice is made on the press and let go on the
     * release); traffic honks (ambience.js hornSound) use the same voicing.
     *
     * DOORS (vehicleDoorSound): the latch, then the door shutting into its seal (a low
     * thump, a damped panel and a rattle); heavier for trucks and vans (the bus's doors
     * hiss), a kickstand for bikes, a knock on the hull for boats, a hatch for the tank, a
     * light panel for aircraft. Entering starts it before the engine's starter; leaving
     * slams it. A locked car rattles its handle twice.
     *
     * TYRES (tyreGround, updateVehicleFoley): tarmac (and any hard ground) squeals
     * (audio.js tyres loop); sand, grass, gravel, dirt, mud and snow do not squeal but
     * SCRUB (the grit buffer looping through the ground's band) as loud as the slip; a
     * wet road squeals softer and lower. TRAFFIC SKIDS: the nearest traffic or police car
     * sliding (c.sliding, or its lateral speed) within 500 units gets one squeal voice,
     * placed and dulled by distance. SUSPENSION: each new hop of the player's vehicle (a
     * kerb, a rock, a rut, a landing) knocks through the body. PASS-BYS (below): a whoosh as
     * a moving car goes by.
     */
    const HORN_VOICES = {
      // wave, notes (Hz), low-pass (Hz), level, attack (s), sag (the pitch it starts from).
      car: { wave: 'square', notes: [415, 523], cut: 2300, level: 0.26, attack: 0.012 },
      compact: { wave: 'square', notes: [466, 587], cut: 2600, level: 0.22, attack: 0.01 },
      sport: { wave: 'square', notes: [440, 554], cut: 2900, level: 0.25, attack: 0.008 },
      luxury: { wave: 'sawtooth', notes: [349, 440], cut: 1500, level: 0.26, attack: 0.02 },
      van: { wave: 'square', notes: [370, 466], cut: 1900, level: 0.26, attack: 0.012 },
      air: { wave: 'sawtooth', notes: [185, 233, 277], cut: 1600, level: 0.3, attack: 0.07, sag: 0.93 },
      bike: { wave: 'square', notes: [523], cut: 2600, level: 0.18, attack: 0.008 },
      jetski: { wave: 'square', notes: [622], cut: 2400, level: 0.15, attack: 0.006 },
      boat: { wave: 'sawtooth', notes: [220, 277], cut: 1100, level: 0.28, attack: 0.05, sag: 0.97 },
      ship: { wave: 'sawtooth', notes: [110, 165], cut: 700, level: 0.34, attack: 0.14, sag: 0.95 },
      tank: { wave: 'sawtooth', notes: [147, 175], cut: 900, level: 0.3, attack: 0.05 },
      bell: { bell: [2450, 1.52, 2.06, 2.74], level: 0.16 },
    };
    const SPORT_HORNS = new Set(['sport', 'supercar', 'roadster', 'rally', 'chevette', 'cavalino', 'brutini', 'muscle', 'hotrod']);
    /* Which horn a vehicle has (a HORN_VOICES key). */
    function hornKind(c) {
      const t = c?.type;
      if (!t) return 'car';
      const spec = vehicleSpec(c) || {};
      if (spec.bicycle) return 'bell';
      if (spec.jetski) return 'jetski';
      if (t === 'workboat') return 'ship';
      if (spec.boat) return 'boat';
      if (spec.bike) return 'bike';
      if (t === 'tank') return 'tank';
      if (t === 'bus' || t === 'truck' || t === 'flatbed' || t === 'ambulance') return 'air';
      if (t === 'van' || t === 'pickup' || t === 'suv') return 'van';
      if (t === 'luxury' || t === 'limousine') return 'luxury';
      if (SPORT_HORNS.has(t) || spec.flagship || spec.prestige) return 'sport';
      if (t === 'coupe') return 'compact';
      return 'car';
    }
    /**
     * A horn voice into `out` from `t`: the oscillators, a low-pass and a nasal peak,
     * the envelope rising over the voice's attack. `detune` shifts a traffic car's pitch
     * a little. Returns { oscs, env, stopAt } for the caller to release.
     */
    function hornVoice(v, out, t, level, detune = 1) {
      const filter = audio.createBiquadFilter(),
        peak = audio.createBiquadFilter(),
        env = audio.createGain(),
        oscs = [];
      filter.type = 'lowpass';
      filter.frequency.value = v.cut;
      filter.Q.value = 0.8;
      peak.type = 'peaking';
      peak.frequency.value = 1800;
      peak.Q.value = 1.2;
      peak.gain.value = 5;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(level, t + v.attack);
      filter.connect(peak).connect(env).connect(out);
      for (const f of v.notes) {
        const o = audio.createOscillator(),
          g = audio.createGain();
        o.type = v.wave;
        o.frequency.setValueAtTime(f * detune * (v.sag || 1), t);
        if (v.sag) o.frequency.exponentialRampToValueAtTime(f * detune, t + v.attack * 1.4);
        g.gain.value = 1 / v.notes.length;
        o.connect(g).connect(filter);
        o.start(t);
        oscs.push(o);
        o.onended = () => {
          o.disconnect();
          g.disconnect();
        };
      }
      return { oscs, env, filter, peak, v, level, detune };
    }
    /* Let a horn voice go at `t` (now, or later for a traffic honk of a set length): a
       short release (an air horn sags in pitch), then stop and tear down. */
    function releaseHorn(h, t) {
      const later = t > audio.currentTime + 0.01,
        from = later ? h.level : Math.max(0.0001, h.env.gain.value);
      h.env.gain.cancelScheduledValues(t);
      h.env.gain.setValueAtTime(from, t);
      h.env.gain.exponentialRampToValueAtTime(0.0001, t + (h.v.sag ? 0.12 : 0.05));
      h.oscs.forEach((o, i) => {
        if (h.v.sag) {
          o.frequency.setValueAtTime(h.v.notes[i] * h.detune, t);
          o.frequency.exponentialRampToValueAtTime(h.v.notes[i] * h.detune * 0.96, t + 0.12);
        }
        o.stop(t + 0.16);
      });
      setTimeout(() => {
        h.env.disconnect();
        h.filter.disconnect();
        h.peak.disconnect();
      }, 400);
    }
    /* A bicycle bell: a quick double strike of four inharmonic partials. */
    function bellRing(out, t, level, partials) {
      for (let k = 0; k < 2; k++)
        for (let i = 0; i < partials.length; i++) {
          const f = partials[0] * (i ? partials[i] : 1) * sfxRandom(0.995, 1.005);
          foleyTone(out, 'sine', f, 0, (level / (i + 1)) * (k ? 0.8 : 1), t + k * 0.11, 0.6 - i * 0.1);
        }
    }
    /* A traffic horn at a map point (ambience.js hornSound): the car's voicing, placed. */
    function trafficHorn(c, length, double, gain, pan, cutoff) {
      const kind = hornKind(c),
        v = HORN_VOICES[kind],
        out = audio.createGain(),
        p = audio.createStereoPanner(),
        air = audio.createBiquadFilter(),
        now = audio.currentTime;
      out.gain.value = gain;
      p.pan.value = pan;
      air.type = 'lowpass';
      air.frequency.value = cutoff;
      out.connect(air).connect(p).connect(ambience.bus);
      const detune = 1 + (((c?.id || 0) % 7) - 3) * 0.025;
      for (let k = 0; k < (double ? 2 : 1); k++) {
        const start = now + k * (length + 0.09);
        if (v.bell) bellRing(out, start, v.level, v.bell);
        else releaseHorn(hornVoice(v, out, start, v.level, detune), start + length);
      }
      setTimeout(() => {
        out.disconnect();
        air.disconnect();
        p.disconnect();
      }, (length * 2 + 1.2) * 1000);
    }
    const vehicleFoley = {
      horn: null,
      hornKind: null,
      bellClock: 0,
      honks: 0,
      scrub: null,
      skid: null,
      skidCar: null,
      skidLevel: 0,
      skidClock: 0,
      doors: [],
      hop: null,
      thumpAt: -1,
      thumps: 0,
      passTokens: 3,
      passBys: 0,
    };
    /* The player's horn while `horn` is held. */
    function updatePlayerHorn(c, held, dt) {
      const f = vehicleFoley,
        now = audio.currentTime;
      if (!held) {
        if (f.horn) releaseHorn(f.horn, now);
        f.horn = null;
        f.bellClock = 0;
        return;
      }
      const kind = hornKind(c),
        v = HORN_VOICES[kind];
      f.hornKind = kind;
      if (v.bell) {
        f.bellClock -= dt;
        if (f.bellClock <= 0) {
          f.bellClock = 0.55;
          f.honks++;
          bellRing(engineBus, now, v.level, v.bell);
        }
        return;
      }
      if (!f.horn || f.horn.v !== v) {
        if (f.horn) releaseHorn(f.horn, now);
        f.horn = hornVoice(v, engineBus, now, v.level);
        f.honks++;
      }
    }
    /* What the player's tyres are on: `loose` ground scrubs, a `wet` road squeals softer. */
    const tyreGroundOut = { kind: 'asphalt', loose: false, wet: 0, car: null, at: -1 };
    const LOOSE_GROUND = { sand: 900, grass: 2300, gravel: 1600, dirt: 1300, mud: 520, snow: 1150 };
    function tyreGround(c) {
      const out = tyreGroundOut;
      if (out.car === c && gameTime - out.at < 0.2 && gameTime >= out.at) return out;
      out.car = c;
      out.at = gameTime;
      out.kind = footSurfaceAt(c.x, c.y);
      out.loose = out.kind in LOOSE_GROUND;
      out.wet = out.loose ? 0 : clamp(weather.wet, 0, 1);
      return out;
    }
    /* A persistent looped layer: `buffer` through a band into a gain on `bus`. */
    function foleyLoop(buffer, type, frequency, q, bus, pan = false) {
      const s = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        g = audio.createGain(),
        p = pan ? audio.createStereoPanner() : null;
      s.buffer = buffer;
      s.loop = true;
      f.type = type;
      f.frequency.value = frequency;
      f.Q.value = q;
      g.gain.value = 0;
      s.connect(f).connect(g);
      (p ? g.connect(p) : g).connect(bus);
      s.start(0, Math.random() * Math.max(0, buffer.duration - 0.2));
      return { source: s, filter: f, gain: g, pan: p };
    }
    /* Per frame (audio.js soundUpdate): the horn, the loose-ground scrub, traffic skids. */
    function updateVehicleFoley(deltaSeconds, active) {
      if (!audio || !engineBus) return;
      const f = vehicleFoley,
        now = audio.currentTime,
        c = player.car,
        road = c && c.hp > 0 && !isAircraft(c) && !isBoat(c);
      updatePlayerHorn(c, active && !!c && c.hp > 0 && !isAircraft(c) && actionHeld('horn'), deltaSeconds);
      // Scrub: a slide on loose ground.
      const fa = foleyBuffers();
      if (!fa) return;
      if (!f.scrub) f.scrub = foleyLoop(fa.grit, 'bandpass', 1300, 0.7, engineBus);
      const ground = road && !vehicleSpec(c).bicycle ? tyreGround(c) : null,
        slip = ground ? clamp(c.tyreSlip || 0, 0, 1) : 0,
        loose = ground && ground.loose;
      glideParam(f.scrub.gain.gain, active && loose && slip > 0.06 ? 0.06 + 0.22 * Math.pow(slip, 0.8) : 0, now, 0.08);
      if (loose) glideParam(f.scrub.filter.frequency, LOOSE_GROUND[ground.kind], now, 0.2);
      glideParam(f.scrub.source.playbackRate, 0.8 + 0.5 * clamp(Math.abs(c?.speed || 0) / 400, 0, 1), now, 0.2);
      // The body jolted into a hop: a kerb at speed (physics-driving.js kerbStrike), a rock
      // or a rut on the trails (offroad-trails.js), a landing (falls-vehicles.js).
      if (road && active && c.hop && c.hop !== f.hop) suspensionThump(c, c.hop.vz || 20);
      f.hop = c ? c.hop || null : null;
      // A stop met hard or a landing on the springs on the terrain (terrain-suspension.js).
      if (road && active && c.rideThumpAt > 0 && c.rideThumpAt !== f.thumpAt) suspensionThump(c, c.rideThumpVz);
      f.thumpAt = c ? c.rideThumpAt : -1;
      updateTrafficSkid(deltaSeconds, active, now);
      updatePassBys(deltaSeconds, active);
    }
    /* The suspension taking a kerb or a rock: a low knock through the body and a rattle. */
    function suspensionThump(c, vz) {
      const fa = foleyBuffers();
      if (!fa) return;
      const k = clamp(vz / 40, 0.35, 1.1),
        heavy = !!vehicleSpec(c).truck,
        t = audio.currentTime,
        out = foleyBus(1, 0, 0.8, engineBus);
      foleyTone(out, 'sine', heavy ? 58 : 72, heavy ? 32 : 40, 0.26 * k, t, 0.14);
      foleyNoise(out, fa.white, 'lowpass', 260, 0.8, 0.14 * k, t, 0.004, 0.09);
      foleyNoise(out, fa.grit, 'bandpass', heavy ? 700 : 1000, 2, 0.04 * k, t + 0.02, 0.004, 0.08);
      vehicleFoley.thumps++;
    }
    /**
     * PASS-BYS: a moving car going past the ear (on foot, or past the player's car) at a
     * closing speed over 25 km/h and within 80 units: a whoosh of tyres and air, its band
     * falling as it goes (a Doppler of sorts), panned across. Heard on the ambience bus, so a
     * closed cabin dulls it; a token bucket keeps a busy road to about two a second.
     */
    const passByState = new WeakMap();
    function updatePassBys(deltaSeconds, active) {
      const f = vehicleFoley;
      if (!active || deltaSeconds <= 0 || !ambience) return;
      f.passTokens = Math.min(3, f.passTokens + deltaSeconds * 2);
      const ear = player.car || player,
        evx = player.car ? player.car.vx || 0 : 0,
        evy = player.car ? player.car.vy || 0 : 0;
      for (const c of vehicles) {
        if (c === player.car || c.hp <= 0) continue;
        const dx = ear.x - c.x,
          dy = ear.y - c.y;
        if (Math.abs(dx) > 90 || Math.abs(dy) > 90 || isAircraft(c) || isBoat(c)) continue;
        const cvx = c.vx || 0,
          cvy = c.vy || 0,
          rvx = cvx - evx,
          rvy = cvy - evy,
          rs = Math.hypot(rvx, rvy);
        if (rs < 25 * KMH || Math.hypot(cvx, cvy) < 15 * KMH) continue;
        const along = (dx * rvx + dy * rvy) / rs,
          across = Math.abs(dx * rvy - dy * rvx) / rs;
        let s = passByState.get(c);
        if (!s) passByState.set(c, (s = { along, at: gameTime }));
        else {
          if (gameTime - s.at < 0.25 && s.along > 0 && along <= 0 && across < 80 && f.passTokens >= 1) {
            f.passTokens--;
            f.passBys++;
            passByWhoosh(c, rs, across);
          }
          s.along = along;
          s.at = gameTime;
        }
      }
    }
    function passByWhoosh(c, closing, across) {
      const fa = foleyBuffers();
      if (!fa) return;
      const spec = vehicleSpec(c) || {},
        size = spec.truck ? 1.4 : spec.bike || spec.bicycle ? 0.55 : 1,
        level = 0.1 * size * clamp(closing / (110 * KMH), 0.2, 1.3) * (1 - across / 80),
        t = audio.currentTime,
        s = audio.createBufferSource(),
        band = audio.createBiquadFilter(),
        g = audio.createGain(),
        p = audio.createStereoPanner(),
        from = clamp((c.x - (player.car || player).x) / 60, -0.9, 0.9),
        to = clamp(from + ((c.vx || 0) > 0 ? 0.9 : -0.9), -0.9, 0.9);
      s.buffer = fa.white;
      band.type = 'bandpass';
      band.Q.value = 0.8;
      band.frequency.setValueAtTime(1500, t);
      band.frequency.exponentialRampToValueAtTime(520, t + 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
      p.pan.setValueAtTime(from, t);
      p.pan.linearRampToValueAtTime(to, t + 0.5);
      s.connect(band).connect(g).connect(p).connect(ambience.bus);
      s.start(t, Math.random() * 0.5);
      s.stop(t + 0.7);
      s.onended = () => {
        s.disconnect();
        band.disconnect();
        g.disconnect();
        p.disconnect();
      };
    }
    /* The nearest sliding traffic or police car's squeal (one voice). */
    function updateTrafficSkid(deltaSeconds, active, now) {
      const f = vehicleFoley,
        tyres = audioBuffers.tires;
      if (!tyres) return;
      if (!f.skid) {
        f.skid = foleyLoop(tyres, 'lowpass', 6000, 0.5, engineBus, true);
      }
      f.skidClock -= deltaSeconds;
      if (f.skidClock <= 0) {
        f.skidClock = 0.15;
        let best = null,
          bestLevel = 0;
        if (active)
          for (const car of vehicles) {
            if (car === player.car || car.hp <= 0 || !(car.ai || car.cop) || isAircraft(car) || isBoat(car)) continue;
            const dx = car.x - player.x,
              dy = car.y - player.y;
            if (Math.abs(dx) > 500 || Math.abs(dy) > 500) continue;
            const speed = Math.hypot(car.vx || 0, car.vy || 0);
            if (speed < 30 * KMH) continue;
            const lateral = Math.abs(-(car.vx || 0) * Math.sin(car.a) + (car.vy || 0) * Math.cos(car.a)),
              amount = Math.max(car.sliding ? 0.55 : 0, clamp((lateral / speed - 0.14) / 0.3, 0, 1)),
              d = Math.hypot(dx, dy),
              level = amount * (1 / (1 + d / 140)) * clamp((500 - d) / 80, 0, 1);
            if (level > bestLevel) {
              best = car;
              bestLevel = level;
            }
          }
        f.skidCar = best;
        f.skidLevel = bestLevel;
      }
      const car = f.skidCar,
        d = car ? distanceBetween(car, player) : 500;
      glideParam(f.skid.gain.gain, active && car ? 0.17 * f.skidLevel : 0, now, 0.08);
      if (car) {
        glideParam(f.skid.pan.pan, clamp((car.x - player.x) / 450, -0.85, 0.85), now, 0.1);
        glideParam(f.skid.filter.frequency, airCutoff(d) * 0.5, now, 0.15);
        glideParam(f.skid.source.playbackRate, 0.96 + ((car.id || 0) % 5) * 0.02, now, 0.2);
      }
    }
    /* Which door a vehicle has. */
    function doorKind(c) {
      const spec = vehicleSpec(c) || {};
      if (spec.bicycle || spec.bike) return 'stand';
      if (spec.boat) return 'hull';
      if (c.type === 'tank') return 'hatch';
      if (isAircraft(c)) return 'cockpit';
      if (c.type === 'bus') return 'bus';
      if (spec.truck || c.type === 'van' || c.type === 'suv') return 'heavy';
      return 'car';
    }
    /* A door shutting at `t` into `out`: the thump, the panel and a rattle. */
    function doorThunk(out, fa, t, heavy, level) {
      foleyTone(out, 'sine', heavy ? 62 : 78, heavy ? 34 : 42, 0.22 * level, t, heavy ? 0.16 : 0.12);
      foleyNoise(out, fa.white, 'lowpass', heavy ? 300 : 420, 0.8, 0.16 * level, t, 0.003, heavy ? 0.13 : 0.1);
      foleyNoise(out, fa.grit, 'bandpass', heavy ? 900 : 1500, heavy ? 3 : 2, 0.035 * level, t + 0.01, 0.003, heavy ? 0.09 : 0.04);
    }
    /* Getting in ('enter': the door opens, shuts behind you) or out ('exit': open, slam). */
    function vehicleDoorSound(c, action) {
      const fa = foleyBuffers();
      if (!fa || !soundOn || !c) return;
      const kind = doorKind(c),
        t = audio.currentTime,
        out = foleyBus(1, 0, 1.4),
        slam = action === 'exit' ? 1.2 : 1,
        shut = t + (action === 'exit' ? 0.5 : 0.4) * sfxRandom(0.9, 1.1);
      doorLog(kind, action);
      switch (kind) {
        case 'stand':
          // A kickstand up (entering) or down (leaving): a sprung metal clack.
          foleyNoise(out, fa.grit, 'bandpass', 2600, 6, 0.05, t + 0.05, 0.002, 0.04);
          foleyTone(out, 'sine', 1900, 1500, 0.012, t + 0.05, 0.08);
          break;
        case 'hull':
          foleyNoise(out, fa.white, 'lowpass', 260, 1, 0.12, t + 0.05, 0.004, 0.12);
          foleyNoise(out, fa.white, 'bandpass', 520, 1.4, 0.05, t + 0.12, 0.05, 0.25);
          break;
        case 'hatch':
          foleyTone(out, 'sine', 330, 0, 0.05, shut, 0.45);
          foleyTone(out, 'sine', 523, 0, 0.03, shut, 0.35);
          doorThunk(out, fa, shut, true, slam * 1.1);
          break;
        case 'cockpit':
          foleyNoise(out, fa.white, 'bandpass', 2900, 3, 0.04, t, 0.002, 0.025);
          foleyNoise(out, fa.white, 'bandpass', 520, 1.2, 0.09 * slam, shut, 0.004, 0.09);
          break;
        default:
          // The latch and the handle, then the door into its seal.
          foleyNoise(out, fa.white, 'bandpass', 2800, 3, 0.05, t, 0.002, 0.025);
          foleyNoise(out, fa.grit, 'bandpass', 1800, 4, 0.03, t + 0.05, 0.003, 0.03);
          if (kind === 'bus') foleyNoise(out, fa.white, 'highpass', 2600, 0.7, 0.07, t + 0.02, 0.03, 0.5);
          doorThunk(out, fa, shut, kind !== 'car', slam);
      }
    }
    function doorLog(kind, action) {
      vehicleFoley.doors.push({ kind, action, at: +gameTime.toFixed(2) });
      if (vehicleFoley.doors.length > 6) vehicleFoley.doors.shift();
    }
    /* A locked car: the handle yanked twice against the lock. */
    function lockedHandleSound() {
      const fa = foleyBuffers();
      if (!fa || !soundOn) return;
      const t = audio.currentTime,
        out = foleyBus(1, 0, 0.8);
      for (let k = 0; k < 2; k++) {
        foleyNoise(out, fa.grit, 'bandpass', 1900, 4, 0.05, t + k * 0.15, 0.003, 0.04);
        foleyNoise(out, fa.white, 'lowpass', 320, 1, 0.05, t + k * 0.15 + 0.01, 0.003, 0.05);
      }
      doorLog('locked', 'try');
    }
    // Console (DeadEndCity.vehicleFoley): the horn, the tyres' ground, the skid voice, doors.
    function vehicleFoleyReport() {
      const f = vehicleFoley,
        c = player.car,
        g = c ? tyreGround(c) : null;
      return {
        horn: { held: !!f.horn, kind: c ? hornKind(c) : null, level: f.horn ? +f.horn.env.gain.value.toFixed(3) : 0, honks: f.honks },
        ground: g ? { kind: g.kind, loose: g.loose, wet: +g.wet.toFixed(2) } : null,
        scrub: f.scrub ? +f.scrub.gain.gain.value.toFixed(3) : 0,
        skid: f.skid ? { car: f.skidCar ? f.skidCar.type : null, level: +f.skidLevel.toFixed(3), gain: +f.skid.gain.gain.value.toFixed(3) } : null,
        thumps: f.thumps,
        passBys: f.passBys,
        doors: f.doors.slice(),
      };
    }
