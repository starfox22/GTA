    // SUN PATH: where the shadow light (the sun, the moon by night) and the sun the sky draws stand at a time of day
    // (sunPathAt), and the light clock the renderer follows (litMinutes: the world clock, eased across time skips).
    /* The light swings from the sun to the moon through twilight as a slerp spread over SUN_HANDOVER game minutes,
       and its strength dips through the middle of the swing (`shade`), so the shadows fade and turn slowly instead
       of swinging 100 degrees in a quarter of a minute (the old handover ran over the last ~16 minutes of sun).
       A jump of the world clock (sleep, a meal, the god panel's time, a mission setting the hour, a ride skip) is
       not drawn at once: sunClock keeps an offset that eases to nothing over SUN_SKIP seconds of frames. */
    const SUN_RISE_HOUR = 5.66,
      SUN_DAY_HOURS = 14.17,
      SUN_RISE_MINUTES = SUN_RISE_HOUR * 60,
      SUN_SET_MINUTES = (SUN_RISE_HOUR + SUN_DAY_HOURS) * 60,
      // Game minutes of the sun/moon swing round sunset: from `before` sunset to `after` it (mirrored at sunrise).
      SUN_HANDOVER = { before: 20, after: 70 },
      // How far the shadow light dims at the middle of the swing (0 none, 1 out).
      SUN_HANDOVER_DIM = 0.7,
      // Seconds a time skip takes to draw: `min` + `perHour` a game hour skipped, at most `max`.
      SUN_SKIP = { min: 2, perHour: 0.75, max: 6 },
      SUN_MOON = (() => {
        const x = -0.42,
          y = 0.78,
          z = -0.46,
          l = Math.hypot(x, y, z);
        return { x: x / l, y: y / l, z: z / l };
      })();
    const sunClock = { last: NaN, offset: 0, offset0: 0, speed0: 0, age: 0, span: 0, skips: 0 };
    // Sun up 05:40, down 19:50; the curve is flattened so golden hour lingers.
    function daylightAt(minutes) {
      const hour = (minutes % 1440) / 60,
        arc = Math.sin(((hour - SUN_RISE_HOUR) / SUN_DAY_HOURS) * Math.PI);
      return clamp(Math.pow(Math.max(0, arc), 0.75), 0, 1);
    }
    // The time of day the light is drawn at (minutes, may lead or trail worldMinutes for a few seconds after a skip).
    function litMinutes() {
      return worldMinutes + sunClock.offset;
    }
    // daylight() as the renderer draws it: at the light clock.
    function litDaylight() {
      return daylightAt((((litMinutes() % 1440) + 1440) % 1440));
    }
    // Draw the clock as it stands, no blend (a loaded game, a new game).
    function snapSunClock() {
      sunClock.last = worldMinutes;
      sunClock.offset = sunClock.offset0 = sunClock.speed0 = sunClock.age = sunClock.span = 0;
    }
    // The blend's rate of change now (game minutes of offset per second).
    function sunClockSpeed() {
      const c = sunClock;
      if (!c.span) return 0;
      const s = clamp(c.age / c.span, 0, 1);
      return (c.offset0 * (6 * s * s - 6 * s)) / c.span + c.speed0 * (3 * s * s - 4 * s + 1);
    }
    /* Called every frame on the frame clock (game-loop.js runFrame, also behind menus, so the god panel's time
       blends live behind it). The clock runs a game minute a second: a change of more than that (with slack)
       is a skip, taken the short way round the day, or forwards for a forward skip (sleep runs through the night).
       The offset runs out along a cubic (Hermite) curve that starts at the speed the last blend had, so skips
       that come while one is blending (a dragged time slider) carry on smoothly. */
    function stepSunClock(dt) {
      const c = sunClock;
      if (!Number.isFinite(c.last)) return snapSunClock();
      const moved = worldMinutes - c.last;
      c.last = worldMinutes;
      if (Math.abs(moved) > Math.max(0, dt) * 1.5 + 0.5) {
        let skip = moved > 0 ? moved % 1440 : -(-moved % 1440);
        if (skip < -720) skip += 1440;
        const speed = sunClockSpeed();
        c.offset0 = c.offset = c.offset - skip;
        c.age = 0;
        c.span = clamp(SUN_SKIP.min + (Math.abs(c.offset0) / 60) * SUN_SKIP.perHour, SUN_SKIP.min, SUN_SKIP.max);
        // The speed carried over, never more than would overshoot the new blend.
        c.speed0 = c.offset0 * speed < 0 ? clamp(speed, -Math.abs(c.offset0) / c.span, Math.abs(c.offset0) / c.span) : 0;
        c.skips++;
        return;
      }
      if (!c.span) return;
      c.age += Math.max(0, dt);
      const s = clamp(c.age / c.span, 0, 1);
      if (s >= 1) c.offset = c.offset0 = c.speed0 = c.span = 0;
      else c.offset = c.offset0 * (2 * s * s * s - 3 * s * s + 1) + c.span * c.speed0 * (s * s * s - 2 * s * s + s);
    }
    // How far through the sun/moon swing the light is at a time of day (0 the sun, 1 the moon).
    function sunHandover(minutes) {
      const m = ((minutes % 1440) + 1440) % 1440,
        span = SUN_HANDOVER.before + SUN_HANDOVER.after,
        u =
          m < (SUN_RISE_MINUTES + SUN_SET_MINUTES) / 2
            ? (SUN_RISE_MINUTES + SUN_HANDOVER.before - m) / span
            : (m - (SUN_SET_MINUTES - SUN_HANDOVER.before)) / span,
        k = clamp(u, 0, 1);
      return k * k * (3 - 2 * k);
    }
    /* The light and the sky's sun at `minutes` into `out` (plain numbers, no allocation):
       l* the shadow light (unit, never flatter than ~15 degrees), shade its strength share (1, dipping through
       the handover), s* the sun the sky draws (it sets), k* the sky light (that sun handing over to the moon). */
    function sunPathAt(minutes, out) {
      const m = ((minutes % 1440) + 1440) % 1440,
        t = (m / 60 - SUN_RISE_HOUR) / SUN_DAY_HOURS,
        arc = Math.sin(clamp(t, 0, 1) * Math.PI);
      // East (t 0) through north-north-west at noon to west (t 1); the noon sun
      // leans to the west-north-west, where the old fixed light stood.
      const azimuth = -Math.PI * clamp(t, -0.05, 1.05) - 0.95 * arc,
        // Never flatter than ~15 degrees for shadows, so dusk streets stay readable.
        elevation = 0.27 + (1.02 - 0.27) * Math.pow(arc, 0.8),
        h = sunHandover(m),
        ce = Math.cos(elevation);
      sunSlerp(Math.cos(azimuth) * ce, Math.sin(elevation), Math.sin(azimuth) * ce, h, out, 'l');
      out.handover = h;
      out.shade = 1 - SUN_HANDOVER_DIM * 4 * h * (1 - h);
      // The sky's sun: the same bearing, the same noon height, on the horizon at t 0 and 1.
      const rise = Math.sin(t * Math.PI),
        skyElevation = Math.sign(rise) * 1.02 * Math.pow(Math.abs(rise), 0.8),
        cs = Math.cos(skyElevation);
      out.sx = Math.cos(azimuth) * cs;
      out.sy = Math.sin(skyElevation);
      out.sz = Math.sin(azimuth) * cs;
      sunSlerp(out.sx, out.sy, out.sz, h, out, 'k');
      return out;
    }
    // Unit (x, y, z) turned a share h of the way to the moon along the great circle, into out[p + 'x'|'y'|'z'].
    function sunSlerp(x, y, z, h, out, p) {
      const l = Math.hypot(x, y, z) || 1;
      x /= l;
      y /= l;
      z /= l;
      const dot = clamp(x * SUN_MOON.x + y * SUN_MOON.y + z * SUN_MOON.z, -1, 1),
        angle = Math.acos(dot),
        s = Math.sin(angle);
      let a = 1 - h,
        b = h;
      if (s > 1e-5) {
        a = Math.sin((1 - h) * angle) / s;
        b = Math.sin(h * angle) / s;
      }
      const rx = a * x + b * SUN_MOON.x,
        ry = a * y + b * SUN_MOON.y,
        rz = a * z + b * SUN_MOON.z,
        r = Math.hypot(rx, ry, rz) || 1;
      if (p === 'l') {
        out.lx = rx / r;
        out.ly = ry / r;
        out.lz = rz / r;
      } else {
        out.kx = rx / r;
        out.ky = ry / r;
        out.kz = rz / r;
      }
    }
    /* Console sunReport(): the light clock now, and a sweep of the path (degrees the shadow light turns per game
       minute, weighted by its strength) across a day and through a skip of `skipMinutes` drawn at 30 frames a second. */
    function sunReport(skipMinutes = 360) {
      const p = sunPathAt(litMinutes(), {}),
        r3 = (v) => Math.round(v * 1000) / 1000,
        q = {},
        w = {};
      let worst = 0,
        worstSeen = 0,
        at = 0;
      sunPathAt(0, w);
      for (let m = 0.25; m <= 1440; m += 0.25) {
        sunPathAt(m, q);
        const deg = (Math.acos(clamp(q.lx * w.lx + q.ly * w.ly + q.lz * w.lz, -1, 1)) * 180) / Math.PI / 0.25;
        if (deg > worst) worst = deg;
        if (deg * Math.min(q.shade, w.shade) > worstSeen) {
          worstSeen = deg * Math.min(q.shade, w.shade);
          at = m;
        }
        w.lx = q.lx;
        w.ly = q.ly;
        w.lz = q.lz;
        w.shade = q.shade;
      }
      let minUp = 1;
      for (let m = 0; m < 1440; m += 1) minUp = Math.min(minUp, sunPathAt(m, q).ly);
      // A skip drawn through a scratch copy of the clock (the live one is untouched).
      const saved = { ...sunClock },
        savedWorld = worldMinutes;
      let skipWorst = 0,
        frames = 0;
      try {
        sunClock.last = worldMinutes;
        sunClock.offset = sunClock.offset0 = sunClock.speed0 = sunClock.span = 0;
        worldMinutes += skipMinutes;
        sunPathAt(litMinutes() - skipMinutes, w);
        for (; frames < 30 * 10; frames++) {
          stepSunClock(1 / 30);
          sunPathAt(litMinutes(), q);
          const deg = (Math.acos(clamp(q.lx * w.lx + q.ly * w.ly + q.lz * w.lz, -1, 1)) * 180) / Math.PI;
          skipWorst = Math.max(skipWorst, deg);
          w.lx = q.lx;
          w.ly = q.ly;
          w.lz = q.lz;
          if (!sunClock.span) break;
        }
      } finally {
        worldMinutes = savedWorld;
        Object.assign(sunClock, saved);
      }
      return {
        clock: clockText(),
        litMinutes: Math.round(litMinutes() * 10) / 10,
        blending: !!sunClock.span,
        skipOffset: Math.round(sunClock.offset * 10) / 10,
        skips: sunClock.skips,
        light: [r3(p.lx), r3(p.ly), r3(p.lz)],
        sky: [r3(p.sx), r3(p.sy), r3(p.sz)],
        handover: r3(p.handover),
        shade: r3(p.shade),
        dayMaxDegPerMin: r3(worst),
        dayMaxSeenDegPerMin: r3(worstSeen),
        dayMaxSeenAt: Math.floor(at / 60) + ':' + String(Math.floor(at % 60)).padStart(2, '0'),
        minElevationDeg: r3((Math.asin(minUp) * 180) / Math.PI),
        skip: { minutes: skipMinutes, seconds: Math.round((frames / 30) * 100) / 100, maxDegPerFrame: r3(skipWorst) },
      };
    }
