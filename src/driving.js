    // BEGIN SUBSYSTEM: src/driving.js — Tyres, brakes and driving assists
    /**
     * Tyres, brakes and driving assists
     * Source: src/driving.js
     * Scope: shared game closure.
     *
     * The player's road vehicle (physics.js controlVehicle calls in here):
     *
     *   TYRE AND BRAKE MODEL  a pedal that ramps (a tap is gentle, a hold is full),
     *                front / rear brake bias and weight transfer, per-axle wheel slip
     *                with a friction peak (MU_PEAK_SLIP) and a lower sliding
     *                friction, so a locked wheel stops longer and cannot steer.
     *   ABS          keeps each axle near its peak slip with a pressure cycle of
     *                about 12 Hz: steering is kept and the stop is near the best.
     *                Off (or on a car built without it) a hard stop locks the
     *                wheels: marks, squeal, the car goes straight on; a locked
     *                front on a motorbike lowsides the rider.
     *   ESC          stability control: compares the yaw with what the steering
     *                asks and trims it with single-wheel braking and a throttle
     *                cut (a gentle correction, not a rail); it relaxes on the
     *                handbrake. Off, lift-off and power oversteer can spin the car
     *                (each class's character: `balance`, the drive layout).
     *   TCS          traction control: no wheelspin past the tyres' peak off the
     *                line or out of a corner. Off, a strong car spins its driven
     *                wheels (slower, and a rear-driven one steps its tail out).
     *   STEERING     the keys feed the wheel through a short ramp (faster back to
     *                the centre), set by the steering sensitivity.
     *
     * `spec.brakeG` stays what the car achieves: the mean deceleration of an ABS
     * stop from 100 km/h on dry tarmac (the figure road tests print). The tyres'
     * peak is found from it (ABS_EFFICIENCY), so the AI's clamp (spec.brake) and
     * the player's ABS stop agree. Which assists a vehicle was built with:
     * `spec.abs`, `spec.esc`, `spec.tcs` (false on the classics); by default cars
     * have all three, motorbikes ABS (the superbikes and the naked bike TCS),
     * bicycles and the tank none (the HUD shows N/A).
     *
     * DRIVING SETTINGS (Settings · Driving, saved under 'dead-end-city-driving'):
     * ABS, stability control, traction control, steering sensitivity, speed units
     * (hud.js) and the driving camera's look-ahead.
     */
    const DRIVING_STORAGE = 'dead-end-city-driving',
      DRIVING_DEFAULTS = { abs: true, esc: true, tcs: true, steering: 100, lookAhead: 100 };
    const drivingSettings = { ...DRIVING_DEFAULTS };
    try {
      const saved = JSON.parse(localStorage.getItem(DRIVING_STORAGE));
      if (saved && typeof saved === 'object') {
        for (const key of ['abs', 'esc', 'tcs']) if (typeof saved[key] === 'boolean') drivingSettings[key] = saved[key];
        if (Number.isFinite(saved.steering)) drivingSettings.steering = clamp(Math.round(saved.steering), 50, 150);
        if (Number.isFinite(saved.lookAhead)) drivingSettings.lookAhead = clamp(Math.round(saved.lookAhead), 0, 150);
      }
    } catch {}
    function saveDrivingSettings() {
      try {
        localStorage.setItem(DRIVING_STORAGE, JSON.stringify(drivingSettings));
      } catch {}
    }
    function drivingSettingsAreDefault() {
      return Object.keys(DRIVING_DEFAULTS).every((k) => drivingSettings[k] === DRIVING_DEFAULTS[k]) && hudState.units === 'kmh';
    }
    function resetDrivingSettings() {
      Object.assign(drivingSettings, DRIVING_DEFAULTS);
      setSpeedUnits('kmh');
      saveDrivingSettings();
    }
    // The console's settings() and the rows below: one place that validates.
    function setDrivingSetting(key, value) {
      if (['abs', 'esc', 'tcs'].includes(key)) drivingSettings[key] = !!value;
      else if (key === 'steering') drivingSettings.steering = clamp(Math.round(Number(value) || 100), 50, 150);
      else if (key === 'lookAhead') drivingSettings.lookAhead = clamp(Math.round(Number(value) || 0), 0, 150);
      else return;
      saveDrivingSettings();
    }
    // The camera's lead ahead of a moving vehicle (game.js), as a factor.
    function drivingLookAhead() {
      return drivingSettings.lookAhead / 100;
    }

    /**
     * VEHICLE CHARACTER
     * `front`: the share of the weight on the front axle at rest; `hL`: the
     * centre of gravity's height over the wheelbase (how much weight moves
     * forward under braking); `bias`: the front brakes' share (set so the fronts
     * lock first on a dry road, as manufacturers do). Classes by default, a few
     * types by name.
     */
    const DRIVING_CHARACTER = {
      sedan: [0.61, 0.2],
      taxi: [0.56, 0.21],
      coupe: [0.52, 0.17],
      muscle: [0.56, 0.19],
      sport: [0.39, 0.16],
      roadster: [0.51, 0.17],
      rally: [0.6, 0.19],
      hotrod: [0.52, 0.21],
      supercar: [0.47, 0.15],
      luxury: [0.52, 0.21],
      limousine: [0.5, 0.14],
      suv: [0.53, 0.27],
      van: [0.56, 0.3],
      pickup: [0.57, 0.27],
      police: [0.55, 0.2],
      ambulance: [0.5, 0.3],
      truck: [0.45, 0.28],
      flatbed: [0.45, 0.28],
      bus: [0.35, 0.22],
      chevette: [0.4, 0.15],
      brutini: [0.43, 0.14],
      cavalino: [0.42, 0.15],
    };
    // Built before ABS and stability control (whatever the settings say).
    const CLASSIC_TYPES = new Set(['hotrod', 'series', 'jeep', 'armytruck']);
    const drivingCharacterCache = new Map();
    function drivingCharacter(c) {
      const spec = vehicleSpec(c),
        key = c.type + (c.airframe ? ':' + c.airframe : '');
      let ch = drivingCharacterCache.get(key);
      if (ch && ch.spec === spec) return ch;
      const named = DRIVING_CHARACTER[c.type],
        bike = !!spec.bike && !spec.bicycle,
        [front, hL] = named || (bike ? [0.5, 0.5] : spec.truck ? [0.45, 0.28] : spec.offroad ? [0.53, 0.3] : (spec.balance || 0) > 0.2 ? [0.44, 0.15] : [0.56, 0.2]),
        classic = CLASSIC_TYPES.has(c.type),
        none = !!spec.bicycle || !!spec.tank || isBoat(c) || isAircraft(c);
      ch = {
        spec,
        bike,
        front,
        hL,
        // A bike's front brake does most of the work; a car's bias locks the fronts first.
        bias: bike ? 0.72 : clamp(front + hL * 1.2, 0.55, 0.85),
        drive: bike ? 'rwd' : spec.drive || (spec.offroad || spec.tank ? '4x4' : 'rwd'),
        abs: none ? false : spec.abs ?? !classic,
        esc: none || bike ? false : spec.esc ?? !(classic || c.type === 'expedition'),
        tcs: none ? false : spec.tcs ?? (bike ? !!spec.flagship || c.type === 'bike' : !(classic || c.type === 'expedition')),
        // How readily the tail steps out when the throttle is lifted mid-corner.
        liftOff: bike ? 0 : clamp(0.35 + Math.max(0, spec.balance || 0) * 0.8 + (front < 0.46 ? 0.2 : 0), 0.1, 1.1) * ((spec.balance || 0) < -0.3 ? 0.3 : 1),
      };
      drivingCharacterCache.set(key, ch);
      return ch;
    }
    // What the player's vehicle has and what is switched on.
    function drivingAssists(c) {
      const ch = drivingCharacter(c);
      return {
        abs: ch.abs && drivingSettings.abs,
        esc: ch.esc && drivingSettings.esc,
        tcs: ch.tcs && drivingSettings.tcs,
        has: ch,
      };
    }

    /**
     * TYRE AND BRAKE MODEL
     * Each axle's longitudinal force follows its wheel slip: it grows with the
     * slip to the tyre's peak at MU_PEAK_SLIP (12%), then falls toward the sliding
     * friction as the wheel locks (SLIDE_DRY 0.8 of the peak on a dry road, down
     * to SLIDE_WET 0.58 on a soaked one). The brakes can ask more than the tyre
     * gives (BRAKE_CAPACITY): past the peak the extra torque slows the wheel
     * until it locks, faster at low speed (the wheel has less spin to lose).
     * ABS watches each axle's slip: over ABS_SLIP_HIGH it dumps pressure for a
     * moment, then builds it again, a cycle of about 12 Hz.
     */
    const MU_PEAK_SLIP = 0.12,
      SLIDE_DRY = 0.8,
      SLIDE_WET = 0.58,
      BRAKE_CAPACITY = 1.5,
      ABS_SLIP_HIGH = 0.19,
      ABS_DUMP = 0.8,
      ABS_DUMP_TIME = 0.025,
      ABS_BUILD_RATE = 3.2,
      // The mean share of the peak an ABS stop uses (measured with brakeTest):
      // spec.brakeG / ABS_EFFICIENCY is the tyres' peak.
      ABS_EFFICIENCY = 0.93,
      // The pedal: a key press pushes it down over PEDAL_APPLY and lets go faster;
      // the pressure grows as its PEDAL_CURVE power, so an 80 ms tap brakes at
      // about 0.4 g and a hold locks an unassisted car's wheels in 0.15 s.
      PEDAL_APPLY = 0.2,
      PEDAL_RELEASE = 0.08,
      PEDAL_CURVE = 1.5;
    // Force over the axle's peak capacity at slip s.
    function tyreForceShare(s, slideRatio) {
      if (s <= MU_PEAK_SLIP) return s / MU_PEAK_SLIP;
      return 1 - (1 - slideRatio) * Math.pow((s - MU_PEAK_SLIP) / (1 - MU_PEAK_SLIP), 0.6);
    }
    function tyreState(c) {
      return (
        c.tyres ||
        (c.tyres = {
          pedal: 0,
          steer: 0,
          slip: [0, 0],
          pressure: [1, 1],
          dump: [0, 0],
          lock: [0, 0],
          lateral: [1, 1],
          absAt: -10,
          escAt: -10,
          tcsAt: -10,
          yawSlide: 0,
          throttleAvg: 0,
          wasThrottle: false,
          lift: 0,
          spin: 0,
          frontLockTime: 0,
          handbrakeAt: -10,
        })
      );
    }
    /* The brake pedal for one step: `pressed` is the key. Returns the line
       pressure, 0..1. */
    function brakePedal(t, pressed, stepSeconds) {
      t.pedal = pressed ? Math.min(1, t.pedal + stepSeconds / PEDAL_APPLY) : Math.max(0, t.pedal - stepSeconds / PEDAL_RELEASE);
      return Math.pow(t.pedal, PEDAL_CURVE);
    }
    /* One step of the brakes on the player's road vehicle.
       mu: the tyres' peak (g) with the surface already in; wet: 0..1;
       lateralUse: the share of the grip the corner is using (0..1);
       speed: forward speed (u/s). Returns the deceleration (u/s², positive) and
       leaves each axle's slip, lock and remaining sideways share in `t`. */
    function brakeStep(c, t, ch, abs, pedal, mu, wet, lateralUse, speed, stepSeconds) {
      const slideRatio = SLIDE_DRY + (SLIDE_WET - SLIDE_DRY) * clamp(wet, 0, 1),
        // The corner takes its share of each tyre first (the friction circle).
        cornerLeft = Math.sqrt(Math.max(0.15, 1 - lateralUse * lateralUse)),
        metres = Math.max(1.5, speed / UNITS_PER_METRE),
        // How fast extra brake torque drags a wheel toward locking (1/s).
        lockRate = Math.min(260, 600 / metres),
        demand = pedal * BRAKE_CAPACITY * mu;
      // Weight on each axle with the deceleration of the last step (in g).
      const decelG = clamp(t.lastDecel || 0, 0, 1.6),
        frontLoad = clamp(ch.front + ch.hL * decelG, 0.2, ch.bike ? 0.94 : 0.9),
        loads = [frontLoad, 1 - frontLoad],
        bias = [ch.bias, 1 - ch.bias];
      let force = 0;
      for (let i = 0; i < 2; i++) {
        const cap = mu * loads[i] * cornerLeft,
          asked = demand * bias[i] * t.pressure[i];
        let s = t.slip[i];
        if (asked <= cap && s <= MU_PEAK_SLIP) s = MU_PEAK_SLIP * (asked / Math.max(1e-6, cap));
        else {
          // Past the peak: the wheel slows while the brake asks more than the road gives.
          s = Math.max(MU_PEAK_SLIP * 0.5, s);
          s += ((asked - tyreForceShare(s, slideRatio) * cap) / Math.max(1e-6, cap)) * lockRate * stepSeconds;
          s = clamp(s, 0, 1);
          if (s < MU_PEAK_SLIP && asked <= cap) s = MU_PEAK_SLIP * (asked / Math.max(1e-6, cap));
        }
        t.slip[i] = s;
        const delivered = s <= MU_PEAK_SLIP ? Math.min(asked, cap) : tyreForceShare(s, slideRatio) * cap;
        force += delivered;
        // ABS: past ABS_SLIP_HIGH, dump; hold a moment; build again.
        if (abs && pedal > 0.05) {
          if (t.dump[i] > 0) t.dump[i] -= stepSeconds;
          else if (s > ABS_SLIP_HIGH) {
            t.pressure[i] *= ABS_DUMP;
            t.dump[i] = ABS_DUMP_TIME;
            t.absAt = physicsClock;
            if (i === 0) t.absCycles = (t.absCycles || 0) + 1;
          } else t.pressure[i] = Math.min(1, t.pressure[i] + ABS_BUILD_RATE * stepSeconds);
          if (t.pressure[i] < 0.999) t.absAt = Math.max(t.absAt, physicsClock - 0.05);
        } else {
          t.pressure[i] = 1;
          t.dump[i] = 0;
        }
        // Lock 0..1 from the slip (0.5 and more: sliding, the wheel is as good as stopped).
        t.lock[i] = clamp((s - MU_PEAK_SLIP * 1.4) / (0.5 - MU_PEAK_SLIP * 1.4), 0, 1);
        // What is left of the tyre sideways: the friction circle while rolling,
        // next to nothing once locked.
        const share = cap > 0 ? delivered / (mu * loads[i]) : 0;
        t.lateral[i] = Math.sqrt(Math.max(0, 1 - share * share)) * (1 - t.lock[i]) + (1 - t.lock[i]) * 0.12;
      }
      t.lastDecel = force;
      return force * GRAVITY;
    }
    // Nothing on the brakes: the wheels roll again.
    function brakesOff(t) {
      t.slip[0] = t.slip[1] = 0;
      t.lock[0] = t.lock[1] = 0;
      t.lateral[0] = t.lateral[1] = 1;
      t.pressure[0] = t.pressure[1] = 1;
      t.lastDecel = 0;
    }
    /* The steering wheel from the keys: a short ramp in, quicker back to the
       centre and quicker still across it; slower at speed so a lane change is
       smooth, instant-ish on the handbrake. Sensitivity scales the rates. */
    function steeringRamp(t, turn, along, handbrake, stepSeconds) {
      const sens = drivingSettings.steering / 100,
        speedEase = 1 - 0.35 * clamp((Math.abs(along) - 40 * KMH) / (100 * KMH), 0, 1),
        toward = turn - t.steer,
        across = turn !== 0 && Math.sign(turn) !== Math.sign(t.steer) && Math.abs(t.steer) > 0.05,
        rate = (turn === 0 ? 9 : across ? 11 : 6.5 * speedEase) * sens * (handbrake ? 2 : 1);
      t.steer += clamp(toward, -rate * stepSeconds, rate * stepSeconds);
      return t.steer;
    }
    /**
     * STABILITY
     * The physics steers the car's yaw toward what the wheel asks (within the
     * tyres' grip). `yawSlide` is the yaw the rear tyres add on top of that when
     * they run out of grip: lifting off mid-corner after a spell of heavy
     * throttle (the weight goes forward: `liftOff`, stronger in tail-happy and
     * mid-engined cars, weak in the push-wide trucks), wheelspin at the back
     * (power oversteer), locked rear wheels, a little trail-braking. It feeds on
     * itself (the tail swinging out loads the rear further) until the grip
     * returns or the driver counter-steers; past about 1.5 rad/s the car spins.
     * ESC reads it as the yaw-rate error (the car turning more than the wheel
     * asks) and damps it, braking the outer front wheel (a deceleration) and
     * cutting the throttle; pushing wide against the grip it brakes the inner
     * rear and eases the throttle, so the nose tucks in. It stands back while
     * the handbrake is pulled and for 0.8 s after, so handbrake turns still swing.
     * Returns the throttle cut (0..1), the ESC brake (u/s²) and a factor on the
     * tyres' sideways hold.
     */
    const stabilityOut = { cut: 0, brake: 0, hold: 1 };
    function yawStability(c, t, ch, assists, s) {
      const speed = Math.abs(s.along),
        dt = s.stepSeconds,
        out = stabilityOut;
      out.cut = 0;
      out.brake = 0;
      out.hold = 1;
      // Throttle history: a lift only unsettles the car after a spell of heavy throttle.
      t.throttleAvg += ((s.up ? 1 : 0) - t.throttleAvg) * (1 - Math.exp(-dt / 0.45));
      if (t.wasThrottle && !s.up && t.throttleAvg > 0.8 && s.lateralUse > 0.65 && speed > 45 * KMH) t.lift = 0.7;
      t.wasThrottle = s.up;
      t.lift = s.up ? 0 : Math.max(0, t.lift - dt);
      if (speed < 12 * KMH || physicsClock < (c.spinUntil || 0)) {
        t.yawSlide *= Math.exp(-6 * dt);
        return out;
      }
      const dir = Math.sign(c.av) || Math.sign(s.steer) || (c.id % 2 ? 1 : -1),
        wetness = 1 + (1 - clamp(s.surface, 0.5, 1)) * 2.2;
      let deficit = 0;
      if (t.lift > 0) deficit += ch.liftOff * (t.lift / 0.7) * s.lateralUse * 1.1;
      if (ch.drive !== 'fwd') deficit += t.spin * (ch.drive === '4x4' ? 0.3 : 1) * (0.1 + 1.2 * s.lateralUse);
      // (A motorbike's light rear just skips; the rider holds it straight.)
      // Only a wheel really locked counts (ABS's brief slips keep a straight stop straight).
      // A locked rear with the fronts still rolling swings the tail round (the
      // unstable case); all four locked, the car slides on straight. Only a
      // wheel really locked counts: ABS's brief slips keep a straight stop straight.
      deficit += clamp((s.lockRear - 0.4) / 0.6, 0, 1) * (1 - s.lockFront) * (0.4 + s.lateralUse) * (ch.bike ? 0.3 : 1.5);
      if (s.slowing && !s.handbrake) deficit += Math.max(0, s.balance + 0.3) * 0.25 * s.longUse * s.lateralUse;
      deficit *= wetness;
      const slide = t.yawSlide,
        size = Math.abs(slide),
        counter = s.turnKey !== 0 && Math.sign(s.turnKey) === -Math.sign(slide) && size > 0.05,
        relaxed = s.handbrake || physicsClock - t.handbrakeAt < 0.8,
        esc = assists.esc && !relaxed;
      // Dead straight with nothing turning it, there is nothing to swing the tail
      // either way (a real car needs a nudge too).
      const nudged = size > 0.01 || Math.abs(c.av) > 0.02 || s.turnKey !== 0,
        grow = nudged ? deficit * 2.3 * clamp(speed / (70 * KMH), 0.3, 1.4) * (1 + 1.4 * size) * (Math.sign(slide) || dir) : 0,
        // The rear finds its grip again as the cause goes; slower once the car is well round.
        settle = (1.7 * clamp(1 - deficit, 0, 1)) / (1 + Math.max(0, size - 0.8) * 1.5) + (counter ? (esc ? 5.5 : 3.6) : 0);
      let escDamp = 0;
      if (esc && size > 0.06) {
        escDamp = 4.5;
        out.brake = Math.min(0.35, size * 0.55) * GRAVITY;
        out.cut = clamp((size - 0.04) * 3, 0, 1);
        t.escAt = physicsClock;
      }
      // Pushing wide (the understeer skid): brake the inner rear, ease the throttle.
      if (esc && s.skid > 0.15) {
        out.brake = Math.max(out.brake, 0.14 * s.skid * GRAVITY);
        out.cut = Math.max(out.cut, 0.6 * s.skid);
        t.escAt = physicsClock;
      }
      // Spinning wheels mid-slide with TCS off: ESC still cuts the throttle.
      if (esc && t.spin > 0.2 && size > 0.1) out.cut = Math.max(out.cut, 0.7);
      t.yawSlide = clamp(slide + (grow - slide * (settle + escDamp)) * dt, -3.2, 3.2);
      // The rear tyres sliding hold the car less sideways.
      out.hold = 1 / (1 + 0.7 * Math.abs(t.yawSlide));
      return out;
    }
    /* The assists' HUD indicators: 'na' (the vehicle has none), 'off' (switched
       off in Settings · Driving), 'ready' or 'active' (working now). */
    function drivingAssistStates(c) {
      if (!c || isAircraft(c) || isBoat(c)) return null;
      const ch = drivingCharacter(c),
        t = c.tyres,
        recent = (at) => !!t && physicsClock - at < 0.22;
      const state = (key, at) => (!ch[key] ? 'na' : !drivingSettings[key] ? 'off' : recent(at) ? 'active' : 'ready');
      return { abs: state('abs', t?.absAt ?? -10), esc: state('esc', t?.escAt ?? -10), tcs: state('tcs', t?.tcsAt ?? -10) };
    }

    /**
     * SETTINGS · DRIVING
     * Rows drawn by settings.js; speed units moved here from Gameplay.
     */
    SETTING_ROWS.driving = [
      {
        id: 'abs',
        kind: 'toggle',
        label: 'ABS (anti-lock brakes)',
        note: () =>
          'Keeps the wheels turning under hard braking: you can still steer, and stops are the shortest. Off, a hard stop locks the wheels: the car skids straight on, and stops longer (much longer in the rain). Pump the brake to stop well. Classic cars and bicycles have none.',
        get: () => drivingSettings.abs,
        set: (on) => setDrivingSetting('abs', on),
      },
      {
        id: 'esc',
        kind: 'toggle',
        label: 'Stability control',
        note: () =>
          'Brakes single wheels and eases the throttle when the car starts to slide or spin, and helps you catch a slide. It stands back on the handbrake. Off, the tail can step out when you lift or floor it mid-corner. Not on motorbikes or classic cars.',
        get: () => drivingSettings.esc,
        set: (on) => setDrivingSetting('esc', on),
      },
      {
        id: 'tcs',
        kind: 'toggle',
        label: 'Traction control',
        note: () =>
          'Stops the driven wheels spinning when you floor it off the line or out of a corner. Off, powerful cars light up their tyres: slower launches and a rear-driven car can slide sideways.',
        get: () => drivingSettings.tcs,
        set: (on) => setDrivingSetting('tcs', on),
      },
      {
        id: 'steering',
        kind: 'slider',
        label: 'Steering sensitivity',
        min: 50,
        max: 150,
        step: 10,
        format: (v) => v + '%',
        note: () => 'How quickly the wheel turns while a steering key is held. Lower is smoother at speed, higher is sharper.',
        get: () => drivingSettings.steering,
        set: (value) => setDrivingSetting('steering', value),
      },
      {
        id: 'lookAhead',
        kind: 'slider',
        label: 'Camera look-ahead',
        min: 0,
        max: 150,
        step: 10,
        format: (v) => v + '%',
        note: () => 'How far the camera leads a moving vehicle, so you see the road coming. 0 keeps the car in the middle of the screen.',
        get: () => drivingSettings.lookAhead,
        set: (value) => setDrivingSetting('lookAhead', value),
      },
      {
        id: 'units',
        kind: 'choice',
        label: 'Speed units',
        note: () =>
          'Kilometres or miles an hour for every speed the game shows: the speed box, the flight HUD’s airspeed and the rides. Boats keep knots; distances stay in metres.',
        options: [
          ['kmh', 'KM/H'],
          ['mph', 'MPH'],
        ],
        get: () => hudState.units,
        set: (value) => setSpeedUnits(value),
      },
      {
        id: 'drivingReset',
        kind: 'action',
        label: 'Default driving settings',
        note: () => 'ABS, stability and traction control on, steering and look-ahead at 100%, km/h.',
        button: 'RESET DRIVING TO DEFAULTS',
        disabled: drivingSettingsAreDefault,
        run: () => {
          resetDrivingSettings();
          tell('Driving settings reset to defaults', 2);
        },
      },
    ];
    // END SUBSYSTEM: src/driving.js
