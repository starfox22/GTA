    // Fixed-wing engine families, procedural combustion/blade/turbine voices and a bounded exterior mix.
    // Included from engine-audio.js; every source feeds engineBus and the saved audio controls.
    const AIRCRAFT_ENGINE_PROFILES = {
      // The downloaded C172: one four-cylinder, four-stroke piston engine and a two-blade fixed-pitch prop.
      skyhawk: { kind: 'piston', engines: 1, cylinders: 4, blades: 2, idleRpm: 700, maxRpm: 2700, level: 0.36 },
      // The procedural PC-12-like courier: one turbine, four propeller blades.
      courier: { kind: 'turboprop', engines: 1, blades: 4, idleRpm: 1050, maxRpm: 1700, level: 1 },
      jet: { kind: 'turbofan', engines: 2, blades: 0, fanHz: 150, whineHz: 2100, level: 1.4 },
      airliner: { kind: 'turbofan', engines: 2, blades: 0, fanHz: 95, whineHz: 1450, level: 1.5 },
    };
    const AIRCRAFT_SOUND_REACH = 2400,
      AIRCRAFT_EXTERIOR_VOICES = 3;
    function aircraftEngineProfile(car) {
      // Unknown/default planes use the same courier fallback as vehicleSpec and the renderer.
      return AIRCRAFT_ENGINE_PROFILES[car?.airframe || 'courier'] || AIRCRAFT_ENGINE_PROFILES.courier;
    }
    function aircraftEngineRunning(car) {
      return car?.type === 'plane' && car.hp > 0 &&
        (car === player.car || !!car.ai || (!!car.abandonedFlight && (car.altitude || 0) > terrainHeight(car.x, car.y) + 1));
    }
    // Shared by the sound plan and visual propeller animation; no per-call allocation.
    function aircraftPropellerRpm(car) {
      const p = aircraftEngineProfile(car);
      if (!p.blades) return 0;
      const power = clamp(car.power ?? car.throttle ?? 0, 0, 1),
        speed = Math.abs(car.airspeed ?? car.speed ?? 0);
      // Fixed-pitch RPM increases with power; airflow can keep it turning on descent.
      return p.idleRpm + (p.maxRpm - p.idleRpm) * (p.kind === 'piston' ? clamp(power * 0.91 + Math.min(speed / 520, 1) * 0.09, 0, 1) : Math.sqrt(power));
    }
    // Pure parameter plan, also consumed by the offline sound fixture. Power is the
    // flight model's spooled output, so advancing the lever cannot instantly rev a turbine.
    function aircraftSoundPlan(car) {
      const p = aircraftEngineProfile(car),
        power = clamp(car.power ?? car.throttle ?? 0, 0, 1),
        piston = p.kind === 'piston',
        propeller = p.blades > 0,
        rpm = aircraftPropellerRpm(car),
        bladeHz = propeller ? rpm * p.blades / 60 : 0,
        firingHz = piston ? rpm * p.cylinders / 120 : 0,
        // Unloaded idle still fires; high load adds exhaust and propeller harmonics.
        load = 0.22 + 0.78 * power,
        spool = 0.52 + 0.48 * power;
      return {
        kind: p.kind, engines: p.engines, power, rpm, bladeHz, firingHz, load,
        waveA: piston ? 'combustion' : 'sine',
        waveB: propeller ? 'propeller' : 'sine',
        aHz: piston ? firingHz : (p.whineHz || 1700) * (0.65 + spool),
        bHz: propeller ? bladeHz : p.fanHz * (0.65 + spool),
        aGain: piston ? 0.15 + 0.12 * load : (propeller ? 0.009 : 0.014) * (0.5 + spool),
        bGain: propeller ? (piston ? 0.055 : 0.09) + (piston ? 0.075 : 0.11) * power : 0.04 + 0.08 * power,
        aCutoff: piston ? 470 + 1800 * load : 9000,
        bCutoff: propeller ? 450 + 1400 * load : 3500,
        roarGain: piston ? 0.012 + 0.023 * load : (propeller ? 0.035 : 0.28) * (0.3 + power),
        roarHz: piston ? 250 + 700 * load : 280 + power * (propeller ? 780 : 1900),
        // A piston has no turbine hiss or high-frequency turbine oscillator.
        hissGain: piston ? 0 : (propeller ? 0.014 : 0.09) * (0.3 + power),
        hissHz: 2500 + 2300 * spool,
        level: p.level,
      };
    }
    let aircraftWaves = null;
    function aircraftPulseWave(kind) {
      if (!aircraftWaves) aircraftWaves = {};
      if (aircraftWaves[kind]) return aircraftWaves[kind];
      // Band-limited pulses with different exhaust/blade spectra, rather than a
      // raw sawtooth's electrical buzz. Four-stroke firing Hz is cylinders * RPM / 120.
      const harmonics = kind === 'combustion' ? [0, 1, 0.72, 0.46, 0.29, 0.18, 0.12, 0.07, 0.045] : [0, 1, 0.42, 0.17, 0.075, 0.03],
        real = new Float32Array(harmonics.length),
        imag = new Float32Array(harmonics);
      return aircraftWaves[kind] = audio.createPeriodicWave(real, imag);
    }
    function buildAircraftVoice(noise) {
      const filter = audio.createBiquadFilter(),
        pan = audio.createStereoPanner(),
        out = audio.createGain(),
        nodes = [],
        tones = [],
        beds = [];
      filter.type = 'lowpass';
      filter.frequency.value = 9500;
      filter.Q.value = 0.5;
      out.gain.value = 0;
      filter.connect(pan).connect(out).connect(engineBus);
      for (let i = 0; i < 2; i++) {
        const source = audio.createOscillator(), tone = audio.createBiquadFilter(), gain = audio.createGain();
        source.type = 'sine';
        tone.type = 'lowpass';
        tone.Q.value = 0.5;
        gain.gain.value = 0;
        source.connect(tone).connect(gain).connect(filter);
        source.start();
        tones.push({ source, filter: tone, gain, wave: 'sine' });
        nodes.push(source, tone, gain);
      }
      for (let i = 0; i < 2; i++) {
        const source = audio.createBufferSource(), band = audio.createBiquadFilter(), gain = audio.createGain();
        source.buffer = noise;
        source.loop = true;
        band.type = i ? 'bandpass' : 'lowpass';
        band.Q.value = 0.55;
        gain.gain.value = 0;
        source.connect(band).connect(gain).connect(filter);
        source.start(0, sfxRandom(0, 1.5));
        beds.push({ source, filter: band, gain });
        nodes.push(source, band, gain);
      }
      // Four voices maximum, each 4 sources and 15 nodes. Reuse across aircraft/families;
      // no oscillator, buffer or AudioNode allocations in the per-frame update.
      return { filter, pan, out, tones, beds, nodes, car: null, plan: null, placement: null };
    }
    function aircraftSoundPlacement(car) {
      if (car === player.car) return { distance: 0, pan: 0, level: 0.85, doppler: 1, cutoff: 9500 };
      const ear = player.car || player,
        dx = car.x - player.x,
        dy = car.y - player.y,
        dz = entityElevation(car) - entityElevation(ear),
        distance = Math.hypot(dx, dy, dz),
        d = Math.max(1, distance),
        closing = -((car.vx || 0) - (ear.vx || 0)) * dx / d - ((car.vy || 0) - (ear.vy || 0)) * dy / d - ((car.vz || 0) - (ear.vz || 0)) * dz / d,
        shade = soundShade(car, distance);
      return {
        distance,
        pan: clamp(soundRight(dx, dy) / 450, -0.9, 0.9),
        level: 0.9 / (1 + distance / 150) * clamp((AIRCRAFT_SOUND_REACH - distance) / 450, 0, 1) * shade.gain,
        doppler: clamp(SOUND_SPEED / (SOUND_SPEED - closing), 0.78, 1.3),
        cutoff: Math.min(clamp(10500 - distance * 3, 650, 10500), shade.cutoff),
      };
    }
    function updateAircraftVoice(voice, car, playing, now) {
      voice.car = car;
      if (!car || !playing || !aircraftEngineRunning(car)) {
        glideParam(voice.out.gain, 0, now, 0.12);
        voice.plan = null;
        return;
      }
      const plan = voice.plan = aircraftSoundPlan(car),
        placement = voice.placement = aircraftSoundPlacement(car),
        waves = [plan.waveA, plan.waveB],
        hz = [plan.aHz, plan.bHz],
        gains = [plan.aGain, plan.bGain],
        cutoffs = [plan.aCutoff, plan.bCutoff];
      for (let i = 0; i < 2; i++) {
        const t = voice.tones[i];
        if (t.wave !== waves[i]) {
          if (waves[i] === 'sine') t.source.type = 'sine';
          else t.source.setPeriodicWave(aircraftPulseWave(waves[i]));
          t.wave = waves[i];
        }
        glideParam(t.source.frequency, hz[i] * placement.doppler, now, 0.08);
        glideParam(t.gain.gain, gains[i], now, 0.1);
        glideParam(t.filter.frequency, cutoffs[i], now, 0.15);
      }
      glideParam(voice.beds[0].gain.gain, plan.roarGain, now, 0.15);
      glideParam(voice.beds[0].filter.frequency, plan.roarHz, now, 0.2);
      glideParam(voice.beds[1].gain.gain, plan.hissGain, now, 0.15);
      glideParam(voice.beds[1].filter.frequency, plan.hissHz, now, 0.2);
      for (const bed of voice.beds) glideParam(bed.source.playbackRate, placement.doppler, now, 0.1);
      glideParam(voice.filter.frequency, placement.cutoff, now, 0.15);
      glideParam(voice.pan.pan, placement.pan, now, 0.1);
      glideParam(voice.out.gain, plan.level * placement.level, now, 0.12);
    }
    function updateAircraftAudio(a, car, on, now, dt) {
      const own = on && aircraftEngineRunning(car) ? car : null;
      if (own && !a.aircraft[0]) a.aircraft[0] = buildAircraftVoice(a.noise);
      if (a.aircraft[0]) updateAircraftVoice(a.aircraft[0], own, on, now);
      a.aircraftClock -= dt;
      if (!on || a.aircraftClock <= 0) {
        a.aircraftClock = 0.25;
        const nearby = [];
        if (on) for (const c of vehicles) {
          if (c === car || !aircraftEngineRunning(c)) continue;
          const distance = Math.hypot(c.x - player.x, c.y - player.y, entityElevation(c) - entityElevation(player.car || player));
          if (distance < AIRCRAFT_SOUND_REACH) nearby.push({ car: c, distance });
        }
        nearby.sort((p, q) => p.distance - q.distance);
        for (let i = 0; i < AIRCRAFT_EXTERIOR_VOICES; i++) {
          const next = nearby[i]?.car || null;
          if (next && !a.aircraft[i + 1]) a.aircraft[i + 1] = buildAircraftVoice(a.noise);
          if (a.aircraft[i + 1]) a.aircraft[i + 1].car = next;
        }
      }
      for (let i = 1; i < a.aircraft.length; i++) if (a.aircraft[i])
        updateAircraftVoice(a.aircraft[i], a.aircraft[i].car === car ? null : a.aircraft[i].car, on, now);
    }
    function aircraftVoiceReport(voice) {
      if (!voice) return null;
      const p = voice.plan, s = voice.placement;
      return {
        airframe: voice.car?.airframe || (voice.car ? 'courier' : null),
        kind: p?.kind || null, engines: p?.engines || 0,
        power: +(p?.power || 0).toFixed(3), rpm: Math.round(p?.rpm || 0),
        firingHz: +(p?.firingHz || 0).toFixed(2), bladeHz: +(p?.bladeHz || 0).toFixed(2),
        gain: +voice.out.gain.value.toFixed(4),
        hiss: +voice.beds[1].gain.gain.value.toFixed(4),
        distance: s ? Math.round(s.distance) : null,
        pan: +voice.pan.pan.value.toFixed(3), doppler: +(s?.doppler || 1).toFixed(3),
      };
    }
