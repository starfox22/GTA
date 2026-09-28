    // Wheelies: a motorbike's or bicycle's front wheel lifted by the throttle and the rider's weight,
    // pitching about the rear tyre (c.wheelie, radians; the renderer only reads it), held, set down
    // with a bounce of the fork, or looped out backwards (riders.js throwRider 'loopout').
    /**
     * THE PITCH ABOUT THE REAR TYRE
     * The bike and rider are one body pivoting on the rear contact patch. Its
     * centre of mass stands `b` ahead of the patch and `h` above it; the drive
     * the rear tyre puts down (a, the acceleration the physics settled on) turns
     * it nose-up with the lever h cos θ + b sin θ, gravity nose-down with
     * b cos θ - h sin θ. So it lifts once a > g b / h, and past the balance
     * point (tan θ = b / h) gravity lifts it too: that is the loop-out, and the
     * tail touches the road at `loop`. A sport bike with its rider tucked needs
     * 1.2 g (it stays down); leaning back (the climb key with the throttle)
     * moves the mass back and up, so 0.8 g lifts it and a clutch `pop` kicks it
     * off the ground (the rider then works the throttle for a pace of lift).
     * The engine's pull falls with speed (power / speed), so a
     * wheelie comes easily in the low gears and not at all near the top.
     * Cornering leans the bike: the drive's lift shrinks with cos² of the lean
     * and no pop starts in a bend.
     *
     * CONTROL (wheelieHeld, controls.js): throttle + climb lifts the front at
     * the rider's pace (WHEELIE_RISE, as far as the power allows: about 20° a
     * second on a sport bike), and keeps lifting: past the balance point the
     * throttle cannot hold it and it loops (held about three seconds); throttle
     * alone with the front up feathers the throttle to let it settle slowly
     * (tap climb to hold a wheelie); off the throttle it drops; the brake (the
     * rear alone, 0.55 g at most) brings it down at once. The front
     * lands on its fork (a stiff, half-damped spring: a small bounce). While it
     * is up the bike steers only by leaning: WHEELIE_STEER at full height.
     * Heavy bikes barely lift (the cruiser: a hop of a degree or two); a
     * bicycle lifts from a pull on the bars and a pedal stroke, a small, low
     * wheelie that is past its balance at about 15 degrees.
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
      WHEELIE_RISE = 0.45, // rad/s: the front lifted by a rider who has the power for it
      WHEELIE_SETTLE = 0.35, // rad/s: the front let down on a feathered throttle
      WHEELIE_DAMP = 1.2, // the rider's body soaking up the pitch (1/s)
      WHEELIE_FORK = 900, // the fork's spring (rad/s² a radian) ...
      WHEELIE_FORK_DAMP = 30, // ... and damping: about half critical, one small bounce
      wheelieLog = { lifts: 0, loops: 0, pops: 0, bestDeg: 0, bestSeconds: 0, lastLoop: null };
    function wheelieGeometry(c, spec) {
      return WHEELIE_GEOMETRY[WHEELIE_BY_TYPE[c.type] || (spec.bicycle ? 'bicycle' : 'sport')];
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
      const geo = wheelieGeometry(c, spec),
        g = GRAVITY / UNITS_PER_METRE,
        throttle = ridden && actionHeld('forward'),
        brake = ridden && actionHeld('back'),
        ask = ridden && throttle && along > -1 * KMH && wheelieHeld(),
        up = th > 0.03;
      // The rider's weight eases back and forward rather than jumping.
      c.wheelieLean = (c.wheelieLean || 0) + ((ask ? 1 : 0) - (c.wheelieLean || 0)) * Math.min(1, stepSeconds * 6);
      const lean = c.wheelieLean,
        b = geo.b - geo.back * lean,
        h = geo.h + geo.back * 0.5 * lean,
        cos = Math.cos(th),
        sin = Math.sin(th),
        lever = h * cos + b * sin,
        weight = g * (b * cos - h * sin),
        // Leaned over in a bend the drive's lift shrinks (cos² of the lean).
        bank = Math.atan(Math.abs(along * (c.av || 0)) / GRAVITY),
        upright = Math.cos(bank) ** 2;
      // `a` drives the bike on; `lift` (the drive plus the arms' pull) turns it up.
      let a = acceleration / UNITS_PER_METRE,
        lift = a;
      if (up && brake) lift = a = Math.max(a, -WHEELIE_REAR_BRAKE * g);
      else if (throttle && a > 0 && (ask || up)) {
        // The rider works the throttle for a pace of pitch: lifting while the
        // climb key is held (as far as the power allows), letting it settle
        // without. Past the balance point no throttle can hold it (only the brake).
        const pace = ask ? WHEELIE_RISE * geo.rise : -WHEELIE_SETTLE,
          want = 5 * (pace - w);
        lift = clamp((want * geo.k2 + weight) / Math.max(0.2, lever * upright), 0, a + (ask ? geo.pull * g : 0));
        a = Math.min(a, lift);
      }
      // The clutch popped (or the bars pulled) as the climb key goes down.
      if (ask && !c.wheeliePopped && th < 0.05 && upright > 0.8) {
        const kick = geo.pop * clamp(lift / (geo.popG * g), 0, 1);
        if (kick > 0.05) {
          w += kick;
          wheelieLog.pops++;
        }
        c.wheeliePopped = true;
      } else if (!ask) c.wheeliePopped = false;
      const torque = (lift * lever * upright - weight) / geo.k2;
      // Up: the pitch's own torque (damped by the rider's body); down on the
      // fork: its spring, until the drive lifts it off again.
      const angular = th > 0 ? torque - WHEELIE_DAMP * w : -WHEELIE_FORK * th - WHEELIE_FORK_DAMP * w + Math.max(0, torque);
      w += angular * stepSeconds;
      th = Math.max(-0.06, th + w * stepSeconds);
      if (th <= 0 && w < 0 && w > -0.05 && th > -0.002) th = w = 0;
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
      return a * UNITS_PER_METRE;
    }
    // The steering a lifted front leaves (the bike steers by leaning alone).
    function wheelieSteerShare(c) {
      return 1 - (1 - WHEELIE_STEER) * clamp((c.wheelie || 0) / 0.3, 0, 1);
    }
    // Console: wheelieState() (docs/console/vehicles.md).
    function wheelieConsole() {
      return {
        wheelieState() {
          const c = player.car,
            spec = c && vehicleSpec(c);
          if (!spec?.bike) return { onBike: false, log: { ...wheelieLog } };
          const geo = wheelieGeometry(c, spec);
          return {
            onBike: true,
            type: c.type,
            geometry: WHEELIE_BY_TYPE[c.type] || 'sport',
            deg: +(((c.wheelie || 0) * 180) / Math.PI).toFixed(1),
            rate: +(c.wheelieRate || 0).toFixed(2),
            lean: +(c.wheelieLean || 0).toFixed(2),
            asked: wheelieHeld(),
            kmh: Math.round(Math.hypot(c.vx || 0, c.vy || 0) / KMH),
            balanceDeg: Math.round((Math.atan2(geo.b - geo.back, geo.h + geo.back * 0.5) * 180) / Math.PI),
            loopDeg: Math.round((geo.loop * 180) / Math.PI),
            steerShare: +wheelieSteerShare(c).toFixed(2),
            log: { ...wheelieLog },
          };
        },
      };
    }
