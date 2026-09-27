    // Headlights on slopes: the lamps' body frame as a vehicle sits on the ground (headlightFrame) and the terrain
    // horizon a beam sees (headlightHorizon), read by the renderer's CAR LAMPS; the headlightAim() console report.
    /**
     * HEADLIGHT AIM
     * Lamps are bolted to the body, so on the range they aim where the body
     * points: up a climb, down a descent, tilted on a side slope. The frame is
     * the one render3d-frame.js poses the model with (yaw -a, then the terrain
     * pitch and roll, slopePitch / slopeRoll from terrain-field.js; not the
     * suspension's weight transfer, which would make the far end of a beam
     * pump with every throttle change): forward F, right R (the kerb side) and
     * up U in map terms (x, y along the map, z up). The lamps sit `fwd` ahead
     * of the centre and `height` up the body (the model's own lamps when the
     * renderer passes them, else the class default). The renderer evaluates
     * the LOW BEAM pattern in this frame, so a constant grade is lit like a
     * level road and the light lands where the body really aims it.
     *
     * TERRAIN HORIZON
     * Light cannot pass through a hill. For a lamp with terrain in reach, the
     * ground is sampled along `angles` rays fanned `halfAngle` either side of
     * the heading, every half `step` out to `rows` steps (60 m, the beam's
     * reach); row k (k + 1 steps out) keeps the highest tangent (rise over
     * distance from the lamp point) of the ground at least one step nearer,
     * and the ground's own height there. A point is lit when it stands above
     * that line (cityHorizonShade in lighting3d-sky.js; headlightHorizonLit
     * below is its mirror, keep them in step). The step of slack keeps the
     * top of a crest itself lit; the ground just past it falls into shadow as
     * the beam grazes over it. The beam haze uses the heights to thin out where
     * the ground rises into it and to thicken where the beam leaves the ground.
     */
    const HEADLIGHT_HORIZON = Object.freeze({ angles: 24, rows: 24, step: 20, halfAngle: 1.1 }),
      HEADLIGHT_HORIZON_SIZE = HEADLIGHT_HORIZON.angles * HEADLIGHT_HORIZON.rows * 2;
    // Height of a vehicle's head lamps over the road (world units) when no model says otherwise.
    function headlampHeight(spec) {
      return (spec.truck ? 1.0 : spec.offroad ? 1.1 : spec.bike ? 0.8 : 0.65) * UNITS_PER_METRE;
    }
    function newHeadlightFrame() {
      return { x: 0, y: 0, z: 0, heading: 0, forward: { x: 1, y: 0, z: 0 }, right: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: 1 }, sinPitch: 0, sinRoll: 0, cosRoll: 1, fwd: 0, height: 0 };
    }
    // Vehicle c's lamp point and body frame into `out` (see HEADLIGHT AIM). `mount`
    // { fwd, height } in world units, or null for the class default; `level` keeps the
    // car level (the old frame: lookSwitches terrainBeams false).
    function headlightFrame(c, out, mount, level) {
      const spec = vehicleSpec(c),
        posed = !level && !isAircraft(c) && !isBoat(c),
        pitch = posed ? c.slopePitch || 0 : 0,
        roll = posed ? c.slopeRoll || 0 : 0,
        sp = Math.sin(pitch),
        cp = Math.cos(pitch),
        sr = Math.sin(roll),
        cr = Math.cos(roll),
        hx = Math.cos(c.a),
        hy = Math.sin(c.a),
        fwd = mount ? mount.fwd : spec.l * 0.5,
        height = mount ? mount.height : headlampHeight(spec),
        f = out.forward,
        r = out.right,
        u = out.up;
      // Yaw, then pitch about the right axis, then roll about the forward one.
      f.x = cp * hx - sp * sr * hy;
      f.y = cp * hy + sp * sr * hx;
      f.z = sp * cr;
      r.x = -cr * hy;
      r.y = cr * hx;
      r.z = -sr;
      u.x = -sp * hx - cp * sr * hy;
      u.y = -sp * hy + cp * sr * hx;
      u.z = cp * cr;
      out.x = c.x + f.x * fwd + u.x * height;
      out.y = c.y + f.y * fwd + u.y * height;
      out.z = entityElevation(c) + f.z * fwd + u.z * height;
      out.heading = c.a;
      out.sinPitch = sp;
      out.sinRoll = sr;
      out.cosRoll = cr;
      out.fwd = fwd;
      out.height = height;
      return out;
    }
    // Any terrain field within `reach` of (x, y)?
    function terrainWithin(x, y, reach) {
      for (const f of TERRAIN_FIELDS) if (x + reach >= f.x0 && x - reach <= f.x1 && y + reach >= f.y0 && y - reach <= f.y1) return true;
      return false;
    }
    // The TERRAIN HORIZON round a lamp point into `table` (HEADLIGHT_HORIZON_SIZE floats,
    // row-major: [row][angle] x (tangent, height)). False, table untouched, when no terrain
    // is in reach (the city: nothing to hide behind).
    function headlightHorizon(frame, table) {
      const { angles, rows, step, halfAngle } = HEADLIGHT_HORIZON,
        half = step * 0.5,
        x = frame.x,
        y = frame.y,
        z = frame.z;
      if (!terrainWithin(x, y, rows * step)) return false;
      for (let i = 0; i < angles; i++) {
        const bearing = frame.heading + ((i / (angles - 1)) * 2 - 1) * halfAngle,
          dx = Math.cos(bearing),
          dy = Math.sin(bearing);
        // `highest` trails the samples by two (one step): row k sees the ground out to k steps.
        let highest = -8,
          pending = -8;
        for (let m = 1; m <= rows * 2; m++) {
          const d = m * half,
            rise = terrainHeight(x + dx * d, y + dy * d) - z;
          if (!(m & 1)) {
            const at = ((m / 2 - 1) * angles + i) * 2;
            table[at] = highest;
            table[at + 1] = rise;
          }
          highest = Math.max(highest, pending);
          pending = rise / d;
        }
      }
      return true;
    }
    // How lit map point (px, py) at elevation pz is by the lamp at `frame` with horizon
    // `table` (0 hidden behind the ground .. 1), bilinear like the GPU's lookup.
    function headlightHorizonLit(table, frame, px, py, pz) {
      const { angles, rows, step, halfAngle } = HEADLIGHT_HORIZON,
        dx = px - frame.x,
        dy = py - frame.y,
        dist = Math.hypot(dx, dy),
        hx = Math.cos(frame.heading),
        hy = Math.sin(frame.heading),
        bearing = Math.atan2(-dx * hy + dy * hx, dx * hx + dy * hy),
        a = (clamp(bearing / halfAngle, -1, 1) * 0.5 + 0.5) * (angles - 1),
        row = clamp(dist / step - 1, 0, rows - 1),
        a0 = Math.min(Math.floor(a), angles - 2),
        r0 = Math.min(Math.floor(row), rows - 2),
        fa = a - a0,
        fr = row - r0,
        at = (r, i) => table[(r * angles + i) * 2],
        tangent = (at(r0, a0) * (1 - fa) + at(r0, a0 + 1) * fa) * (1 - fr) + (at(r0 + 1, a0) * (1 - fa) + at(r0 + 1, a0 + 1) * fa) * fr,
        above = dy === 0 && dx === 0 ? 1 : pz - frame.z - tangent * dist;
      return smoothStep(-4, 2, above);
    }
    // DeadEndCity.headlightAim(metres): the player's lamps on the ground they stand on:
    // the pose, the aim (body forward) and up vectors, the lamp point's height over the
    // ground, and for points on the ground straight ahead (the heading, `metres` out) the
    // ground's height, the beam coordinates in the body frame (`t` to the kerb side, `v`
    // above the lamps' axis, as the LOW BEAM pattern reads them), `vLevel` (the old level
    // frame) and `lit` (the terrain horizon: 0 behind a hill).
    const aimFrame = newHeadlightFrame(),
      aimLevel = newHeadlightFrame(),
      aimTable = new Float32Array(HEADLIGHT_HORIZON_SIZE);
    function headlightAimReport(metres = [5, 10, 20, 30, 40, 50]) {
      const c = player.car;
      if (!c) return null;
      const round = (v, k = 1000) => Math.round(v * k) / k,
        frame = headlightFrame(c, aimFrame, null, false),
        level = headlightFrame(c, aimLevel, null, true),
        started = performance.now(),
        horizon = headlightHorizon(frame, aimTable),
        horizonMs = performance.now() - started,
        f = frame.forward,
        r = frame.right,
        u = frame.up,
        hx = Math.cos(c.a),
        hy = Math.sin(c.a);
      const probes = (Array.isArray(metres) ? metres : [metres]).map((m) => {
        const px = c.x + hx * (m * UNITS_PER_METRE + frame.fwd),
          py = c.y + hy * (m * UNITS_PER_METRE + frame.fwd),
          pz = terrainHeight(px, py),
          dx = px - frame.x,
          dy = py - frame.y,
          dz = pz - frame.z,
          ahead = dx * f.x + dy * f.y + dz * f.z,
          across = dx * r.x + dy * r.y + dz * r.z,
          rise = dx * u.x + dy * u.y + dz * u.z,
          levelAhead = (px - level.x) * hx + (py - level.y) * hy;
        return {
          m,
          ground: round(pz / UNITS_PER_METRE, 100),
          t: round(across / ahead),
          v: round(rise / ahead),
          vLevel: round((pz - level.z) / levelAhead),
          lit: horizon ? round(headlightHorizonLit(aimTable, frame, px, py, pz), 100) : 1,
        };
      });
      return {
        type: c.type,
        pitchDeg: round(((c.slopePitch || 0) * 180) / Math.PI, 10),
        rollDeg: round(((c.slopeRoll || 0) * 180) / Math.PI, 10),
        aim: [round(f.x), round(f.y), round(f.z)],
        up: [round(u.x), round(u.y), round(u.z)],
        lampHeightM: round(frame.height / UNITS_PER_METRE, 100),
        lampOverGroundM: round((frame.z - terrainHeight(frame.x, frame.y)) / UNITS_PER_METRE, 100),
        horizon,
        // One lamp's horizon (24 rays x 48 ground samples), as the renderer recomputes it.
        horizonMs: round(horizonMs, 100),
        probes,
      };
    }
