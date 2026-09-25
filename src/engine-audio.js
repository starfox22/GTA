    // BEGIN SUBSYSTEM: src/engine-audio.js — Engine sound
    /**
     * Engine sound
     * Source: src/engine-audio.js
     * Scope: shared game closure (after audio.js; updateEngineAudio() is called
     * from soundUpdate()).
     *
     * THE PLAYER'S ENGINE is a small simulation driving recorded loops:
     *
     *   RPM    idle when stopped; from standstill the clutch slips, so the revs
     *          flare with the throttle before the wheels pull them; then the
     *          wheel speed in the current gear sets them. An automatic box
     *          shifts up near the set's shift point (the revs fall to the next
     *          gear's, with a short throttle cut) and down when they sag, with a
     *          rev-matching blip. Reverse uses first gear.
     *   LOAD   throttle on (brighter, louder) or off (darker, quieter): lifting
     *          at high revs gives a deceleration burble on the V8 and sport sets.
     *   LAYERS each class has 1-5 loops recorded at known revs (ENGINE_SETS).
     *          Every loop plays at rate = rpm / its recorded rpm, and the two
     *          nearest the current revs are cross-faded (equal power, in log
     *          rpm), so pitch follows the revs continuously while the timbre
     *          stays that of a real engine near its own speed.
     *   START  getting into a vehicle plays a recorded starter and catch; the
     *          loops rise from a fast idle a moment later.
     *   ROAD   tyre roar (filtered noise) rising with speed, gravel crunch off
     *          the road (the tank-track recording, gentler), wind on open
     *          vehicles at speed; tank tracks clank with speed.
     *   AIR    the turboprop and the jets are synthesised from spool: turbine
     *          whine, the fan's roar and hiss, the propeller's blade buzz. The
     *          helicopter keeps its recorded rotor loop (audio.js).
     *
     * TRAFFIC: the nearest four driven vehicles within earshot get one cheap
     * voice each (their set's low or mid loop), with revs guessed from speed and
     * a gear count, distance level and low-pass, stereo pan and a Doppler shift
     * from the closing speed (sound travels 1756 map units a second).
     *
     * DeadEndCity.engineSound() reports the voice, the layers' rates and gains,
     * the traffic voices and a trace of the last seconds of revs and gears.
     */
    const ENGINE_SETS = {
      // Mazda 121 (J.Zazvurek, CC0): one car through its whole range.
      compact: { layers: [['engine-compact-idle', 880], ['engine-compact-low', 2640], ['engine-compact-mid', 3460], ['engine-compact-high', 4900]], idle: 820, shift: 5200, redline: 6300, gears: 5, level: 1 },
      // BMW 320 six (ninebilly, CC0), the Mazda at 4900 and a 4A-GE screaming at 7800 (qopsinonstudios, CC0).
      sport: { layers: [['engine-sport-idle', 654], ['engine-sport-low', 2330], ['engine-sport-mid', 3012], ['engine-compact-high', 4900], ['engine-sport-high', 7800]], idle: 850, shift: 7300, redline: 8200, gears: 6, level: 1.05, burble: 1 },
      // Lotus V8 idle (wikusv / jimmygu3, CC BY 4.0) and a Ford 5.0 V8 (noiseloop, CC BY 3.0).
      v8: { layers: [['engine-v8-idle', 657], ['engine-v8-low', 1722], ['engine-v8-mid', 2316]], idle: 700, shift: 4300, redline: 4900, gears: 4, level: 1.1, burble: 1.4 },
      // Heavy diesel (Nayckron, CC BY 3.0).
      diesel: { layers: [['engine-diesel-idle', 650], ['engine-diesel-mid', 920], ['engine-diesel-high', 1080]], idle: 600, shift: 1900, redline: 2150, gears: 6, level: 1.15 },
      // Twin tickover (richwise, CC0), then the four-cylinder loops high up.
      bike: { layers: [['engine-twin-idle', 1250], ['engine-compact-mid', 3460], ['engine-compact-high', 4900], ['engine-sport-high', 7800]], idle: 1250, shift: 9800, redline: 10800, gears: 6, level: 0.95, burble: 0.8 },
      // A big V-twin: the tickover and the V8 run slow.
      cruiser: { layers: [['engine-twin-idle', 1000], ['engine-v8-low', 3200], ['engine-v8-mid', 4300]], idle: 900, shift: 4800, redline: 5600, gears: 5, level: 1, burble: 1 },
      // The tank: the diesel pitched down, plus its tracks.
      tank: { layers: [['engine-diesel-idle', 820], ['engine-diesel-mid', 1150], ['engine-diesel-high', 1350]], idle: 650, shift: 2000, redline: 2300, gears: 4, level: 1.25, tracks: true },
      // Boats have no gearbox: throttle and speed set the revs.
      outboard: { layers: [['boat-outboard-low', 1800], ['boat-outboard-high', 3500]], idle: 950, redline: 5600, boat: true, level: 1 },
      marine: { layers: [['boat-diesel', 800]], idle: 620, redline: 1350, boat: true, level: 1.1 },
      jetski: { layers: [['boat-jetski', 4000]], idle: 1900, redline: 6400, boat: true, level: 0.9 },
    };
    // Vehicle type -> [set, pitch, level]. A limousine purrs a little lower, a supercar sings higher.
    const ENGINE_OF_TYPE = {
      coupe: ['compact', 1.05, 0.95],
      sedan: ['compact', 0.97, 1],
      taxi: ['compact', 0.95, 1],
      van: ['compact', 0.88, 1.05],
      sport: ['sport', 1, 1],
      supercar: ['sport', 1.12, 1.1],
      roadster: ['sport', 1.04, 0.95],
      rally: ['sport', 1.08, 1.05],
      muscle: ['v8', 1, 1.1],
      hotrod: ['v8', 0.94, 1.2],
      police: ['v8', 1.04, 1],
      luxury: ['v8', 1.1, 0.8],
      limousine: ['v8', 0.95, 0.75],
      suv: ['v8', 0.92, 0.95],
      pickup: ['v8', 0.9, 1],
      ambulance: ['v8', 0.9, 0.95],
      truck: ['diesel', 1, 1],
      flatbed: ['diesel', 0.95, 1.05],
      bus: ['diesel', 0.9, 1],
      bike: ['bike', 1, 1],
      cruiser: ['cruiser', 1, 1],
      tank: ['tank', 1, 1],
      speedboat: ['outboard', 1, 1],
      workboat: ['marine', 1, 1],
      jetski: ['jetski', 1, 1],
    };
    const SOUND_SPEED = 1756,
      TRAFFIC_VOICES = 4,
      TRAFFIC_REACH = 420;
    let engineAudio = null,
      engineTrace = [];
    function engineKind(car) {
      if (!car) return null;
      // A plane without an airframe is the courier (makeCar's default plane).
      if (car.type === 'plane') return (car.airframe || 'courier') === 'courier' ? 'turboprop' : 'turbofan';
      if (car.type === 'helicopter' || car.type === 'bicycle') return null;
      return ENGINE_OF_TYPE[car.type] ? ENGINE_OF_TYPE[car.type][0] : 'compact';
    }
    // Loops of a set whose buffers have been decoded.
    function engineSetReady(set) {
      return set.layers.every(([name]) => audioBuffers[name]);
    }
    // A plain noise buffer for road roar, wind and jet hiss (made once).
    function engineNoiseBuffer() {
      const rate = audio.sampleRate,
        buffer = audio.createBuffer(1, rate * 2, rate),
        data = buffer.getChannelData(0);
      let pink = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        pink = pink * 0.86 + white * 0.14;
        data[i] = pink * 2.2 + white * 0.15;
      }
      return buffer;
    }
    function buildEngineAudio() {
      if (engineAudio || !audio || !master) return engineAudio;
      const out = audio.createGain(),
        tone = audio.createBiquadFilter(),
        body = audio.createBiquadFilter();
      // The player's engine: layers -> tone (load low-pass) -> body (a little
      // presence so small speakers hear the firing harmonics) -> out.
      tone.type = 'lowpass';
      tone.frequency.value = 4000;
      tone.Q.value = 0.5;
      body.type = 'peaking';
      body.frequency.value = 420;
      body.Q.value = 0.8;
      body.gain.value = 3;
      out.gain.value = 0;
      tone.connect(body).connect(out).connect(master);
      const noise = engineNoiseBuffer(),
        noiseLayer = (type, frequency, q) => {
          const source = audio.createBufferSource(),
            filter = audio.createBiquadFilter(),
            gain = audio.createGain();
          source.buffer = noise;
          source.loop = true;
          filter.type = type;
          filter.frequency.value = frequency;
          filter.Q.value = q;
          gain.gain.value = 0;
          source.connect(filter).connect(gain).connect(master);
          source.start(0, Math.random() * 1.5);
          return { source, filter, gain };
        };
      engineAudio = {
        out,
        tone,
        noise,
        layers: [],
        setName: null,
        car: null,
        rpm: 0,
        gear: 1,
        throttle: 0,
        load: 0,
        shiftCut: 0,
        startDelay: 0,
        burble: 0,
        burbleClock: 0,
        misfire: 0,
        lastAlong: 0,
        road: noiseLayer('bandpass', 400, 0.7),
        wind: noiseLayer('highpass', 1800, 0.5),
        gravel: null,
        tracks: null,
        jet: null,
        traffic: [],
        trafficClock: 0,
        traceClock: 0,
      };
      return engineAudio;
    }
    // Swap the player's layers for another set (stop the old loops, start the new).
    function engineUseSet(a, setName) {
      if (a.setName === setName) return true;
      const set = ENGINE_SETS[setName];
      if (!set || !engineSetReady(set)) return false;
      for (const layer of a.layers) engineStopVoice(layer, 0.15);
      a.layers = set.layers.map(([name, root]) => {
        const source = loopingSource(name),
          gain = audio.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(a.tone);
        source.start(0, Math.random() * (LOOP_SECONDS[name] || 0.5));
        return { name, root, source, gain, rate: 1, level: 0 };
      });
      a.setName = setName;
      return true;
    }
    function engineStopVoice(voice, fade) {
      const now = audio.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, fade / 3);
      voice.source.stop(now + fade + 0.1);
      voice.source.onended = () => {
        voice.source.disconnect();
        voice.gain.disconnect();
      };
    }
    /*
     * Equal-power weights of a set's layers at `rpm` (in log rpm between the two
     * recorded speeds either side), written into `weights`.
     */
    function engineLayerWeights(layers, rpm, weights) {
      const n = layers.length;
      for (let i = 0; i < n; i++) weights[i] = 0;
      if (rpm <= layers[0].root) weights[0] = 1;
      else if (rpm >= layers[n - 1].root) weights[n - 1] = 1;
      else
        for (let i = 0; i < n - 1; i++)
          if (rpm < layers[i + 1].root) {
            // The fade sits in the middle half of the gap in log rpm, so neither
            // loop is pitched far from its own speed while it is heard.
            const f = clamp((Math.log(rpm / layers[i].root) / Math.log(layers[i + 1].root / layers[i].root) - 0.25) / 0.5, 0, 1);
            weights[i] = Math.cos((f * Math.PI) / 2);
            weights[i + 1] = Math.sin((f * Math.PI) / 2);
            break;
          }
      return weights;
    }
    const engineWeights = new Float32Array(8);
    /*
     * The revs, gear and load of the player's road vehicle for one frame.
     * `along` is the signed forward speed; `up`/`down` the throttle and brake.
     */
    function engineSimulate(a, set, spec, along, up, down, dt) {
      const speed = Math.abs(along),
        reversing = along < -5,
        drive = up || (down && along < 10),
        idle = set.idle,
        top = spec.max || 300;
      // Throttle pedal: quick to press, a touch slower to lift.
      a.throttle += ((drive ? 1 : 0) - a.throttle) * Math.min(1, dt * (drive ? 9 : 6));
      let target;
      if (set.boat) {
        // A propeller: the revs follow throttle, with the hull's speed holding them up.
        target = idle + (set.redline - idle) * clamp(0.55 * a.throttle + 0.42 * (speed / top), 0, 1);
        a.gear = 1;
      } else {
        const n = set.gears,
          // Gear i tops out at this fraction of the top speed (closer ratios high up).
          gearTop = (i) => Math.pow((i + 1) / n, 0.8),
          wheelRpm = (i) => idle * 0.9 + (speed / (gearTop(i) * top)) * (set.redline - idle * 0.9);
        if (reversing) a.gear = 1;
        let g = a.gear - 1;
        const w = wheelRpm(g);
        if (!reversing && a.shiftCut <= 0) {
          if (w > set.shift * (0.82 + 0.18 * a.throttle) && g < n - 1 && a.throttle > 0.2) {
            a.gear++;
            a.shiftCut = set.gears > 5 ? 0.16 : 0.22;
          } else if (g > 0 && wheelRpm(g - 1) < set.shift * (a.throttle > 0.5 ? 0.62 : 0.5) && w < idle * 1.9) {
            a.gear--;
            // Rev-matching blip on the way down.
            a.rpm = Math.max(a.rpm, wheelRpm(g - 1) * 1.08);
            a.shiftCut = 0.12;
          }
        }
        g = a.gear - 1;
        target = wheelRpm(g);
        // Pulling away: the clutch slips, so the engine revs ahead of the wheels.
        const slip = clamp(1 - speed / (gearTop(0) * top * 0.55), 0, 1);
        if (a.gear === 1) target = Math.max(target, idle + a.throttle * slip * (set.redline - idle) * 0.42);
        target = Math.max(idle, Math.min(set.redline, target));
      }
      const cutting = a.shiftCut > 0;
      a.shiftCut -= dt;
      // Load: the throttle, cut during a shift; brakes and lifting are off-load.
      const load = cutting ? 0.1 : a.throttle;
      a.load += (load - a.load) * Math.min(1, dt * 10);
      // Revs chase the target: fast when pulled down by a shift, slower when free.
      const rising = target > a.rpm;
      a.rpm += (target - a.rpm) * Math.min(1, dt * (rising ? (a.throttle > 0.5 ? 7 : 4) : cutting ? 14 : 3.2));
      // Lifting off at high revs: the exhaust burbles and pops for a moment.
      if (set.burble && !drive && a.rpm > set.idle * 3 && a.lastDrive) a.burble = 1.1;
      a.lastDrive = drive;
      if (a.burble > 0) a.burble -= dt;
    }
    // A pop or two in the exhaust while lifting off (V8 and sport sets).
    function engineBurblePop(a, set, level) {
      const now = audio.currentTime,
        n = Math.floor(audio.sampleRate * 0.06),
        buffer = audio.createBuffer(1, n, audio.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.exp((-i / n) * 7);
      const source = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        gain = audio.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = randomBetween(160, 420);
      filter.Q.value = 1.4;
      gain.gain.value = level * set.burble * randomBetween(0.4, 1);
      source.connect(filter).connect(gain).connect(engineAudio.out);
      source.start(now);
    }
    // Jet and turboprop voices, made the first time the player flies.
    function buildJetVoice(a) {
      if (a.jet) return a.jet;
      const roar = audio.createBufferSource(),
        roarFilter = audio.createBiquadFilter(),
        roarGain = audio.createGain(),
        hiss = audio.createBufferSource(),
        hissFilter = audio.createBiquadFilter(),
        hissGain = audio.createGain(),
        whine = audio.createOscillator(),
        whine2 = audio.createOscillator(),
        whineGain = audio.createGain(),
        prop = audio.createOscillator(),
        propFilter = audio.createBiquadFilter(),
        propGain = audio.createGain(),
        wobble = audio.createOscillator(),
        wobbleDepth = audio.createGain();
      roar.buffer = hiss.buffer = a.noise;
      roar.loop = hiss.loop = true;
      roarFilter.type = 'lowpass';
      roarFilter.frequency.value = 400;
      hissFilter.type = 'bandpass';
      hissFilter.frequency.value = 3500;
      hissFilter.Q.value = 0.6;
      whine.type = 'sine';
      whine2.type = 'triangle';
      prop.type = 'sawtooth';
      propFilter.type = 'lowpass';
      propFilter.frequency.value = 700;
      propFilter.Q.value = 1.2;
      wobble.frequency.value = 1.3;
      wobbleDepth.gain.value = 0;
      for (const g of [roarGain, hissGain, whineGain, propGain]) g.gain.value = 0;
      roar.connect(roarFilter).connect(roarGain).connect(master);
      hiss.connect(hissFilter).connect(hissGain).connect(master);
      whine.connect(whineGain);
      whine2.connect(whineGain);
      whineGain.connect(master);
      prop.connect(propFilter).connect(propGain).connect(master);
      // The blades beat slowly against the airframe: a gentle wobble on the buzz.
      wobble.connect(wobbleDepth).connect(propGain.gain);
      roar.start(0, 0.3);
      hiss.start(0, 1.1);
      whine.start();
      whine2.start();
      prop.start();
      wobble.start();
      return (a.jet = { roarFilter, roarGain, hissFilter, hissGain, whine, whine2, whineGain, prop, propGain, wobbleDepth });
    }
    function updateJetVoice(a, car, kind, on, now) {
      if (!a.jet && !(on && kind)) return;
      const j = buildJetVoice(a),
        aircraft = on && (kind === 'turbofan' || kind === 'turboprop'),
        power = aircraft ? clamp(car.power ?? car.throttle ?? 0, 0, 1) : 0,
        // Turbine speed: about 55 % at idle, 100 % at full power.
        spool = aircraft && car.hp > 0 ? 0.55 + 0.45 * power : 0,
        fan = kind === 'turbofan',
        big = car?.airframe === 'airliner' ? 0.8 : 1;
      glideParam(j.whine.frequency, (fan ? 2200 : 1500) * big * (0.6 + spool), now, 0.3);
      glideParam(j.whine2.frequency, (fan ? 3350 : 2350) * big * (0.6 + spool), now, 0.3);
      glideParam(j.whineGain.gain, spool ? (fan ? 0.018 : 0.012) * (0.5 + spool) : 0, now, 0.3);
      glideParam(j.roarFilter.frequency, 250 + power * (fan ? 1400 : 700), now, 0.4);
      glideParam(j.roarGain.gain, spool ? (fan ? 0.1 : 0.05) * (0.25 + power) * big * 1.2 : 0, now, 0.4);
      glideParam(j.hissFilter.frequency, 2500 + spool * 2500, now, 0.4);
      glideParam(j.hissGain.gain, spool ? (fan ? 0.05 : 0.025) * (0.3 + power) : 0, now, 0.4);
      // Turboprop: four blades at 1200-1700 rpm (80-113 Hz blade passing).
      const propeller = spool && !fan ? 0.07 + 0.09 * power : 0;
      glideParam(j.prop.frequency, (4 * (1200 + 500 * power)) / 60, now, 0.5);
      glideParam(j.propGain.gain, propeller, now, 0.3);
      glideParam(j.wobbleDepth.gain, propeller * 0.25, now, 0.3);
    }
    /* Revs of a traffic vehicle guessed from its speed through a simple gearbox. */
    function trafficRpm(c, set, speed, accelerating) {
      if (speed <= 6) return set.idle;
      const ratio = clamp(speed / (vehicleSpec(c).max || 300), 0, 1);
      if (set.boat) return set.idle + (set.redline - set.idle) * (0.3 + 0.6 * ratio);
      const n = set.gears || 1,
        g = Math.min(n - 1, Math.floor(ratio * n)),
        within = ratio * n - g;
      return set.idle + (set.shift - set.idle) * (0.3 + 0.62 * within) * (accelerating ? 1 : 0.85);
    }
    /* The index of the set's loop recorded nearest `rpm` (in log rpm). */
    function nearestLayer(set, rpm) {
      let best = 0;
      for (let i = 1; i < set.layers.length; i++)
        if (Math.abs(Math.log(rpm / set.layers[i][1])) < Math.abs(Math.log(rpm / set.layers[best][1]))) best = i;
      return best;
    }
    /*
     * Traffic: the nearest driven vehicles get one loop each. Voices are handed
     * out four times a second; each keeps its car until the car leaves earshot
     * or a nearer one needs the slot, and moves to another of its set's loops
     * when its revs stray far from the one it plays.
     */
    function updateTrafficEngines(a, on, now, dt) {
      a.trafficClock -= dt;
      if (a.trafficClock <= 0) {
        a.trafficClock = 0.25;
        const wanted = [];
        if (on)
          for (const c of vehicles) {
            if (c === player.car || c.hp <= 0 || !(c.ai || c.cop || c.gangTarget || c.pursuitTarget)) continue;
            const dx = c.x - player.x,
              dy = c.y - player.y;
            if (Math.abs(dx) > TRAFFIC_REACH || Math.abs(dy) > TRAFFIC_REACH) continue;
            const kind = engineKind(c);
            if (!kind || !ENGINE_SETS[kind]) continue;
            const d = Math.hypot(dx, dy);
            if (d < TRAFFIC_REACH) wanted.push({ c, d, kind });
          }
        wanted.sort((p, q) => p.d - q.d);
        const keep = wanted.slice(0, TRAFFIC_VOICES);
        // Let go of voices whose car is no longer among the nearest, or whose
        // revs have left their loop's range (a fresh voice picks a better loop).
        for (let i = a.traffic.length - 1; i >= 0; i--) {
          const v = a.traffic[i],
            strayed = (v.rate < 0.7 || v.rate > 1.5) && nearestLayer(ENGINE_SETS[v.kind], v.rpm) !== v.layer;
          if (strayed || !keep.some((w) => w.c === v.car)) {
            engineStopVoice(v, strayed ? 0.12 : 0.4);
            a.traffic.splice(i, 1);
          }
        }
        for (const w of keep) {
          if (a.traffic.some((v) => v.car === w.c)) continue;
          const set = ENGINE_SETS[w.kind],
            speed = Math.abs(w.c.speed || 0),
            rpm = trafficRpm(w.c, set, speed, true),
            index = nearestLayer(set, rpm),
            [name, root] = set.layers[index];
          if (!audioBuffers[name]) continue;
          const source = loopingSource(name),
            filter = audio.createBiquadFilter(),
            pan = audio.createStereoPanner(),
            gain = audio.createGain();
          filter.type = 'lowpass';
          filter.frequency.value = 3000;
          gain.gain.value = 0;
          source.connect(filter).connect(pan).connect(gain).connect(master);
          source.start(0, Math.random() * (LOOP_SECONDS[name] || 0.5));
          a.traffic.push({ car: w.c, kind: w.kind, name, root, layer: index, source, filter, pan, gain, lastSpeed: speed, rpm, rate: 1, level: 0 });
        }
      }
      const pvx = player.car ? player.car.vx || 0 : 0,
        pvy = player.car ? player.car.vy || 0 : 0;
      for (const v of a.traffic) {
        const c = v.car,
          set = ENGINE_SETS[v.kind],
          tuning = ENGINE_OF_TYPE[c.type] || ['compact', 1, 1],
          speed = Math.abs(c.speed || 0),
          accelerating = speed > v.lastSpeed + 2 * dt,
          dx = c.x - player.x,
          dy = c.y - player.y,
          d = Math.max(1, Math.hypot(dx, dy));
        v.lastSpeed = speed;
        v.rpm += (trafficRpm(c, set, speed, accelerating) - v.rpm) * Math.min(1, dt * 3);
        // Doppler: closing speed of the car on the listener along the line between them.
        const closing = ((c.vx || 0) * -dx + (c.vy || 0) * -dy) / d - (pvx * -dx + pvy * -dy) / d,
          doppler = clamp(SOUND_SPEED / (SOUND_SPEED - closing), 0.8, 1.25);
        v.rate = clamp((v.rpm * tuning[1] * doppler) / v.root, 0.4, 2.4);
        const near = 1 / (1 + d / 85),
          fade = clamp((TRAFFIC_REACH - d) / 80, 0, 1);
        v.level = on && c.hp > 0 ? 0.24 * (set.level || 1) * tuning[2] * (accelerating ? 1 : 0.7) * near * fade : 0;
        glideParam(v.source.playbackRate, v.rate, now, 0.12);
        glideParam(v.gain.gain, v.level, now, 0.15);
        glideParam(v.filter.frequency, clamp(9000 - d * 20, 700, 9000), now, 0.2);
        glideParam(v.pan.pan, clamp(dx / 450, -0.85, 0.85), now, 0.15);
      }
    }
    function updateEngineAudio(dt) {
      if (!audio || !master) return;
      const a = buildEngineAudio();
      if (!a) return;
      const now = audio.currentTime,
        on = gameMode === 'play' && soundOn,
        car = player.car,
        kind = engineKind(car),
        set = kind ? ENGINE_SETS[kind] : null,
        alive = !!car && car.hp > 0;
      // Getting into a vehicle: the starter, then the loops come up from a fast idle.
      if (car !== a.car) {
        a.car = car;
        if (set && alive) {
          a.gear = 1;
          a.rpm = set.idle * 1.5;
          a.throttle = 0;
          a.startDelay = 0.75;
          a.burble = 0;
          if (on && audioBuffers['engine-start'])
            playSample('engine-start', 0.34 * (set.level || 1), kind === 'diesel' || kind === 'tank' || kind === 'marine' ? 0.78 : kind === 'bike' || kind === 'jetski' ? 1.3 : kind === 'v8' || kind === 'cruiser' ? 0.95 : 1.12);
          else a.startDelay = 0;
        }
      }
      if (set && !engineUseSet(a, kind)) return;
      const tuning = car ? ENGINE_OF_TYPE[car.type] || ['compact', 1, 1] : ['compact', 1, 1],
        spec = car ? vehicleSpec(car) : null,
        along = car ? (car.vx || 0) * Math.cos(car.a) + (car.vy || 0) * Math.sin(car.a) || car.speed || 0 : 0,
        running = on && alive && !!set;
      a.startDelay -= dt;
      if (running) {
        const up = keys.KeyW || keys.ArrowUp,
          down = keys.KeyS || keys.ArrowDown;
        engineSimulate(a, set, spec, along, a.startDelay > 0 ? false : up, a.startDelay > 0 ? false : down, dt);
      }
      // Layers: rate from the revs, gain from the cross-fade and the load.
      const rpmNorm = set ? clamp((a.rpm - set.idle) / (set.redline - set.idle), 0, 1) : 0,
        starting = a.startDelay > 0,
        hurt = car && car.maxhp ? car.hp / car.maxhp : 1;
      // A badly hurt engine misfires: the note drops out for a beat now and then.
      if (running && hurt < 0.25 && a.misfire <= 0 && Math.random() < dt * (1 - hurt * 3) * 3) a.misfire = 0.06;
      a.misfire -= dt;
      const level = running && !starting ? 0.48 * (set.level || 1) * tuning[2] * (0.42 + 0.38 * a.load + 0.2 * rpmNorm) * (a.misfire > 0 ? 0.35 : 1) : 0;
      glideParam(a.out.gain, level, now, starting || !running ? 0.25 : 0.06);
      glideParam(a.tone.frequency, 900 + 2600 * a.load + 5200 * rpmNorm * (0.4 + 0.6 * a.load), now, 0.08);
      if (a.layers.length && running) {
        const weights = engineLayerWeights(a.layers, a.rpm * tuning[1], engineWeights);
        for (let i = 0; i < a.layers.length; i++) {
          const layer = a.layers[i];
          layer.rate = clamp((a.rpm * tuning[1]) / layer.root, 0.3, 2.6);
          layer.level = weights[i];
          glideParam(layer.source.playbackRate, layer.rate, now, 0.05);
          glideParam(layer.gain.gain, layer.level, now, 0.06);
        }
      }
      // Burble on the overrun.
      if (running && set.burble && a.burble > 0) {
        a.burbleClock -= dt;
        if (a.burbleClock <= 0) {
          a.burbleClock = randomBetween(0.05, 0.16);
          if (Math.random() < 0.7) engineBurblePop(a, set, 0.35 * a.burble * clamp(rpmNorm * 1.6, 0.3, 1));
        }
      }
      // Tyres on the road, gravel off it, wind on open vehicles, tank tracks.
      const road = car && alive && !set?.boat && !isAircraft(car) && car.type !== 'helicopter' ? Math.abs(along) : 0,
        offRoad = road > 5 && !onRoad(car.x, car.y),
        open = car && (spec?.bike || spec?.bicycle || spec?.jetski || car.type === 'roadster' || set?.boat),
        roll = clamp(road / 420, 0, 1);
      glideParam(a.road.gain.gain, on ? (car?.type === 'tank' ? 0 : 0.11 * Math.pow(roll, 1.3) * (offRoad ? 1.5 : 1)) : 0, now, 0.15);
      glideParam(a.road.filter.frequency, (offRoad ? 220 : 320) + road * 1.3, now, 0.2);
      const air = car && on ? clamp(Math.abs(car.speed || along) / 480, 0, 1) : 0;
      glideParam(a.wind.gain.gain, on && car && car.type !== 'helicopter' ? air * air * (open ? 0.09 : 0.025) : 0, now, 0.3);
      if (!a.gravel && audioBuffers['tank-tracks'] && (offRoad || car?.type === 'tank')) {
        const source = loopingSource('tank-tracks'),
          gain = audio.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(master);
        source.start();
        a.gravel = { source, gain };
      }
      if (a.gravel) {
        const tank = car?.type === 'tank' && alive,
          trackTop = spec?.max || 120,
          crunch = tank ? 0.1 + 0.3 * clamp(road / (trackTop * 0.77), 0, 1) : offRoad ? 0.12 * clamp(road / 200, 0, 1) : 0;
        glideParam(a.gravel.gain.gain, on ? crunch : 0, now, 0.15);
        glideParam(a.gravel.source.playbackRate, tank ? 0.75 + clamp(road / trackTop, 0, 1) * 0.5 : 0.9 + roll * 0.4, now, 0.2);
      }
      updateJetVoice(a, car, kind, on && alive, now);
      updateTrafficEngines(a, on, now, dt);
      // A short trace of the player's engine for DeadEndCity.engineSound().
      a.traceClock -= dt;
      if (running && a.traceClock <= 0) {
        a.traceClock = 0.1;
        engineTrace.push({
          t: +gameTime.toFixed(2),
          speed: Math.round(along),
          rpm: Math.round(a.rpm),
          gear: a.gear,
          throttle: +a.throttle.toFixed(2),
          load: +a.load.toFixed(2),
          gain: +level.toFixed(3),
          layers: a.layers.map((l) => [l.name.replace(/^(engine|boat)-/, ''), +l.rate.toFixed(3), +l.level.toFixed(2)]),
        });
        if (engineTrace.length > 120) engineTrace.shift();
      }
    }
    // What DeadEndCity.engineSound() reports.
    function engineReport() {
      const a = engineAudio;
      if (!a) return { ready: false };
      return {
        ready: true,
        vehicle: player.car ? player.car.type : null,
        set: a.setName,
        kind: engineKind(player.car),
        rpm: Math.round(a.rpm),
        gear: a.gear,
        throttle: +a.throttle.toFixed(2),
        load: +a.load.toFixed(2),
        gain: +a.out.gain.value.toFixed(3),
        tone: Math.round(a.tone.frequency.value),
        layers: a.layers.map((l) => ({ name: l.name, root: l.root, rate: +l.rate.toFixed(3), weight: +l.level.toFixed(2), gain: +l.gain.gain.value.toFixed(3) })),
        road: +a.road.gain.gain.value.toFixed(3),
        wind: +a.wind.gain.gain.value.toFixed(3),
        tracks: a.gravel ? +a.gravel.gain.gain.value.toFixed(3) : 0,
        jet: a.jet ? { whine: Math.round(a.jet.whine.frequency.value), whineGain: +a.jet.whineGain.gain.value.toFixed(3), roar: +a.jet.roarGain.gain.value.toFixed(3), prop: +a.jet.propGain.gain.value.toFixed(3) } : null,
        // Driven vehicles within earshot (the nearest four get a voice).
        nearbyDriven: vehicles.filter((c) => c !== player.car && c.hp > 0 && (c.ai || c.cop) && distanceBetween(c, player) < TRAFFIC_REACH).length,
        traffic: a.traffic.map((v) => ({ type: v.car.type, loop: v.name, distance: Math.round(distanceBetween(v.car, player)), rpm: Math.round(v.rpm), rate: +v.rate.toFixed(3), level: +v.level.toFixed(3) })),
        trace: engineTrace.slice(),
      };
    }
    // END SUBSYSTEM: src/engine-audio.js
