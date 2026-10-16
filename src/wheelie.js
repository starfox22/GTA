    // Wheelies: a motorbike's or bicycle's front wheel lifted by the throttle and the rider's weight,
    // pitching about the rear tyre (c.wheelie, radians; the renderer only reads it), held, set down
    // with a bounce of the fork, or looped out backwards (riders.js throwRider 'loopout').
    /**
     * The driven rear contact pitches the combined motorcycle/rider mass against
     * gravity. Up/Down shift that mass back/forward, independently of W/S drive.
     * A stopped or reversing bike cannot be pulled up by a key. On a rolling
     * bike a single clutch/body impulse can initiate lift, limited by available
     * engine force, cornering grip and speed. Rider balance assistance feathers
     * that actual force toward a sustainable 29-degree wheelie; it cannot add
     * engine power or rescue a bike past its balance point. Down changes the
     * mass, S/Space brakes the contacting rear, and an unloaded front contributes
     * no steering/brake force or tyre effects. Landing uses a substepped fork.
     */
    const WHEELIE_GEOMETRY = {
      // b, h: the centre of mass ahead of / above the rear patch (m), riding
      // normally; `back`: how far leaning back moves it (b less, h half of it
      // more); k2: radius of gyration squared about the patch (m²); rise: the
      // rider's pace of lift (x WHEELIE_RISE); pull: the arms' share of the lift
      // (g, a bicycle's yank on the bars); pop: the clutch's (or the arms') kick
      // (rad/s) at full pull `popG` (g); loop: where the tail meets the road (rad).
      sport: { b: 0.74, h: 0.62, back: 0.18, k2: 1.3, rise: 1, pull: 0, pop: 0.4, popG: 0.5, loop: 1.2 },
      enduro: { b: 0.66, h: 0.72, back: 0.2, k2: 1.2, rise: 1.2, pull: 0, pop: 0.5, popG: 0.4, loop: 1.25 },
      cruiser: { b: 0.92, h: 0.55, back: 0.1, k2: 1.3, rise: 0.5, pull: 0, pop: 0.45, popG: 0.4, loop: 1.0 },
      bicycle: { b: 0.42, h: 1.0, back: 0.12, k2: 1.2, rise: 0.8, pull: 0.25, pop: 0.5, popG: 0.08, loop: 1.3 },
    };
    const WHEELIE_BY_TYPE = { bike: 'sport', dolcati: 'sport', yamasaki: 'sport', kr500: 'enduro', cruiser: 'cruiser', bicycle: 'bicycle' },
      WHEELIE_STEER = 0.25, // the steering left with the front fully up
      WHEELIE_REAR_BRAKE = 0.55, // g: the rear brake alone, the front in the air
      WHEELIE_RISE = 0.55, // rad/s: the front lifted by a rider who has the power for it
      WHEELIE_SETTLE = 0.35,
      WHEELIE_HOLD = 0.50, // the rider balances below the unassisted tipping point
      WHEELIE_ROLL_MIN = 3 * KMH,
      WHEELIE_ROLL_FULL = 8 * KMH, // rad/s: the front let down on a feathered throttle
      WHEELIE_DAMP = 1.2, // the rider's body soaking up the pitch (1/s)
      WHEELIE_FORK = 900, // the fork's spring (rad/s² a radian) ...
      WHEELIE_FORK_DAMP = 30, // ... and damping: about half critical, one small bounce
      WHEELIE_PITCH_STEP = 1 / 240, // the stiff landing fork keeps the same response at 60/120 Hz
      wheelieLog = { lifts: 0, loops: 0, pops: 0, bestDeg: 0, bestSeconds: 0, lastLoop: null };
    function wheelieGeometry(c, spec) {
      return WHEELIE_GEOMETRY[WHEELIE_BY_TYPE[c.type] || (spec.bicycle ? 'bicycle' : 'sport')];
    }
    // The fork unloads over the first ~5 cm of front-wheel lift, then contributes no road force or effects.
    function wheelieFrontContact(c) {
      const share = clamp((0.04 - Math.max(0, c.wheelie || 0)) / 0.035, 0, 1);
      return share * share * (3 - 2 * share);
    }
    /* One physics step of the pitch (physics-driving.js controlVehicle, every
       two-wheeler on the road). `ridden`: the player is on it and in control.
       Returns the acceleration along the bike the rear tyre gives (a feathered
       throttle, the rear brake alone), which the caller applies. */
    function wheelieStep(c, spec, ridden, acceleration, along, stepSeconds) {
      let th = c.wheelie || 0,
        w = c.wheelieRate || 0;
      if (!ridden && !th && !w) return acceleration;
      if (c.hp <= 0 || c.fallen) {
        c.wheelie = c.wheelieRate = c.wheelieLean = 0;
        return acceleration;
      }
      // With both tyres airborne there is no rear contact about which engine
      // force, braking or gravity can pitch the bike. Carry its release momentum.
      if (c.rideAir) {
        c.wheelieRate = w * Math.exp(-0.25 * stepSeconds);
        c.wheelie = th + (w + c.wheelieRate) * 0.5 * stepSeconds;
        return 0;
      }
      const geo = wheelieGeometry(c, spec),
        g = GRAVITY / UNITS_PER_METRE,
        rolling = clamp((along - WHEELIE_ROLL_MIN) / (WHEELIE_ROLL_FULL - WHEELIE_ROLL_MIN), 0, 1),
        lower = ridden && rolling > 0 && wheelieLowerHeld(),
        brake = ridden && (actionHeld('back') || actionHeld('handbrake')),
        throttle = ridden && actionHeld('forward') && !brake,
        shiftBack = ridden && rolling > 0 && !brake && wheelieHeld(),
        ask = throttle && shiftBack,
        // Leaned over in a bend the drive's lift shrinks (cos² of the lean).
        bank = Math.atan(Math.abs(along * (c.av || 0)) / GRAVITY),
        upright = Math.cos(bank) ** 2,
        surface = spec.bicycle ? 1 : wetGrip() * tyreSurfaceGrip(c, spec, along),
        cornerUse = Math.abs(along * (c.av || 0)) / Math.max(1, (spec.cornerG || 1.2) * GRAVITY * surface),
        rearBrake = WHEELIE_REAR_BRAKE * g * surface * Math.sqrt(Math.max(0, 1 - cornerUse * cornerUse)),
        steps = Math.max(1, Math.ceil(stepSeconds / WHEELIE_PITCH_STEP)),
        dt = stepSeconds / steps;
      let lean = c.wheelieLean || 0, delivered = 0;
      for (let i = 0; i < steps; i++) {
        // The body is the control: ease mass back or forward only while rolling.
        // Forward shift keeps W available; a real brake remains a separate action.
        lean += ((lower || (brake && rolling) ? -0.65 * rolling : shiftBack ? rolling : 0) - lean) * (1 - Math.exp(-6 * dt));
        if (!rolling && Math.abs(lean) < 0.001) lean = 0;
        const b = geo.b - geo.back * lean,
          h = geo.h + geo.back * 0.5 * lean,
          cos = Math.cos(th), sin = Math.sin(th),
          lever = h * cos + b * sin,
          weight = g * (b * cos - h * sin),
          up = th > 0.03;
        // `a` drives the bike on; `lift` (the drive plus the arms' pull) turns it up.
        let a = acceleration / UNITS_PER_METRE, lift = a;
        if (up && brake) lift = a = clamp(a, -rearBrake, 0);
        else if (throttle && a > 0 && (ask || up)) {
          // The rider works the throttle for a pace of pitch, within the engine's actual pull.
          // Past the balance point only the rear brake and a forward weight shift can save it.
          const pace = lower ? -0.9 : ask ? clamp((WHEELIE_HOLD * geo.rise - th) * 2.8, -WHEELIE_SETTLE, WHEELIE_RISE * geo.rise) : -WHEELIE_SETTLE,
            want = 5 * (pace - w);
          lift = clamp((want * geo.k2 + weight) / Math.max(0.2, lever * upright), 0, a + (ask ? geo.pull * g : 0));
          a = Math.min(a, lift);
        }
        // One clutch pop per press; leaning in a bend cannot create a free lift impulse.
        if (ask && !c.wheeliePopped && th < 0.05 && upright > 0.8 && !c.rideAir && !c.deckAir && !c.cliffAir) {
          const kick = geo.pop * rolling * clamp(lift / (geo.popG * g), 0, 1);
          if (kick > 0.05) {
            w += kick;
            wheelieLog.pops++;
          }
          c.wheeliePopped = true;
        } else if (!ask) c.wheeliePopped = false;
        const torque = (lift * lever * upright - weight) / geo.k2,
          angular = th > 0 ? torque - WHEELIE_DAMP * w : -WHEELIE_FORK * th - WHEELIE_FORK_DAMP * w + Math.max(0, torque);
        w += angular * dt;
        th += w * dt;
        // The fork's bump stop dissipates excess landing energy instead of rebounding from a clipped angle.
        if (th < -0.06) { th = -0.06; w = Math.max(0, w); }
        if (th <= 0 && w < 0 && w > -0.05 && th > -0.002) th = w = 0;
        delivered += a;
      }
      c.wheelieLean = lean;
      // Up and away: count it, time it.
      if (th > 0.08 && !c.wheelieFrom) {
        c.wheelieFrom = gameTime;
        wheelieLog.lifts++;
      } else if (th <= 0 && c.wheelieFrom) {
        wheelieLog.bestSeconds = Math.max(wheelieLog.bestSeconds, +(gameTime - c.wheelieFrom).toFixed(1));
        c.wheelieFrom = 0;
      }
      wheelieLog.bestDeg = Math.max(wheelieLog.bestDeg, Math.round((th * 180) / Math.PI));
      c.wheelie = th;
      c.wheelieRate = w;
      if (th >= geo.loop) {
        // Past saving: the tail meets the road and the bike goes over backwards.
        wheelieLog.loops++;
        wheelieLog.lastLoop = { type: c.type, kmh: Math.round(Math.hypot(c.vx, c.vy) / KMH), at: +gameTime.toFixed(1) };
        c.wheelieFrom = 0;
        if (ridden && riderAboard(c)) throwRider(c, c.vx, c.vy, 'loopout');
        c.wheelie = c.wheelieRate = c.wheelieLean = 0;
        return acceleration;
      }
      return delivered / steps * UNITS_PER_METRE;
    }
    /* WHEELIE HINT: getting on a motorbike that can lift its front (not the cruiser's hop, not a bicycle) says how,
       in the names of the device in use (keyName: keys, gamepad or touch), until the player has pulled one, at most
       WHEELIE_HINT_RIDES rides a session (enterVehicle, game-player-actions.js). */
    const WHEELIE_HINT_RIDES = 3,
      wheelieHint = { shown: 0, last: '' };
    function wheelieHintDue(c) {
      const spec = c && vehicleSpec(c);
      if (!spec?.bike || spec.bicycle) return false;
      return wheelieGeometry(c, spec).rise >= 1 && wheelieLog.lifts === 0 && wheelieHint.shown < WHEELIE_HINT_RIDES;
    }
    function offerWheelieHint(c) {
      if (!wheelieHintDue(c)) return false;
      wheelieHint.shown++;
      wheelieHint.last = 'WHEELIE · HOLD ' + keyName('forward') + ' + ' + keyName('wheelieUp') + ' while moving · ' + wheelieLowerKeyName() + ' weight forward';
      tell(wheelieHint.last, 6, { id: 'wheelieHint', tone: 'info' });
      return true;
    }
    // The steering a lifted front leaves (the bike steers by leaning alone).
    function wheelieSteerShare(c) {
      return 1 - (1 - WHEELIE_STEER) * clamp((c.wheelie || 0) / 0.3, 0, 1);
    }
    function wheelieLowerKeyName() {
      return keyName('wheelieDown');
    }
    // Countersteering rolls a motorcycle before its path curves. The stable,
    // damped response is integrated at the same 240 Hz as pitch; at walking
    // pace the direct steering takes over smoothly. AI handling is unchanged.
    function motorcycleBalanceStep(c, requestedYaw, along, stepSeconds) {
      let roll = c.bikeRoll || 0, rate = c.bikeRollRate || 0;
      if (c.fallen || c.hp <= 0) { c.bikeRoll = c.bikeRollRate = 0; return requestedYaw; }
      if (c.rideAir) {
        c.bikeRollRate = rate * Math.exp(-0.4 * stepSeconds);
        c.bikeRoll = roll + (rate + c.bikeRollRate) * 0.5 * stepSeconds;
        return requestedYaw;
      }
      const speed = Math.abs(along),
        blend = clamp((speed - 6 * KMH) / (12 * KMH), 0, 1),
        target = clamp(Math.atan(along * requestedYaw / GRAVITY), -0.95, 0.95) * blend,
        steps = Math.max(1, Math.ceil(stepSeconds / WHEELIE_PITCH_STEP)),
        dt = stepSeconds / steps;
      for (let i = 0; i < steps; i++) {
        rate += (64 * (target - roll) - 16 * rate) * dt;
        rate = clamp(rate, -2.4, 2.4);
        roll += rate * dt;
      }
      if (Math.abs(roll) < 0.00001 && Math.abs(rate) < 0.0001) roll = rate = 0;
      c.bikeRoll = roll; c.bikeRollRate = rate;
      const balancedYaw = GRAVITY * Math.tan(roll) / Math.max(speed, 6 * KMH) * Math.sign(along || 1);
      return requestedYaw * (1 - blend) + balancedYaw * blend;
    }
    // Console: wheelieState() (docs/console/vehicles.md).
    function wheelieConsole() {
      return {
        wheelieState() {
          const c = player.car,
            spec = c && vehicleSpec(c);
          if (!spec?.bike) return { onBike: false, log: { ...wheelieLog }, hint: { ...wheelieHint, due: false } };
          const geo = wheelieGeometry(c, spec);
          return {
            onBike: true,
            type: c.type,
            geometry: WHEELIE_BY_TYPE[c.type] || 'sport',
            deg: +(((c.wheelie || 0) * 180) / Math.PI).toFixed(1),
            rate: +(c.wheelieRate || 0).toFixed(2),
            lean: +(c.wheelieLean || 0).toFixed(2),
            bankDeg: +((c.bikeRoll || 0) * 180 / Math.PI).toFixed(1),
            bankRate: +(c.bikeRollRate || 0).toFixed(2),
            rollingShare: +clamp((c.speed - WHEELIE_ROLL_MIN) / (WHEELIE_ROLL_FULL - WHEELIE_ROLL_MIN), 0, 1).toFixed(2),
            asked: wheelieHeld(),
            lowering: wheelieLowerHeld(),
            kmh: Math.round(Math.hypot(c.vx || 0, c.vy || 0) / KMH),
            balanceDeg: Math.round((Math.atan2(geo.b - geo.back, geo.h + geo.back * 0.5) * 180) / Math.PI),
            loopDeg: Math.round((geo.loop * 180) / Math.PI),
            steerShare: +wheelieSteerShare(c).toFixed(2),
            log: { ...wheelieLog },
            hint: { ...wheelieHint, due: wheelieHintDue(c) },
            // The game clock (a test holding real keys measures how fast the live frame loop runs).
            at: +gameTime.toFixed(2),
          };
        },
      };
    }
