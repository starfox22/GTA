    // Vehicle suspension on the terrain: four tyres on spring-dampers over the height field (rideStep), heave, pitch and roll, wheel loads, the ground's push, hops, take-off into a flight, ride telemetry.
    /**
     * RIDE ON THE TERRAIN
     * A road vehicle on a terrain field rides on four tyres, each on a spring and a
     * damper (rideModel, from the spec: wheelbase and track from the body; travel,
     * stiffness and tyre size from `travel`: about 1.4 Hz for a car, 1.2 for a
     * crawler, 1.1 for a trophy truck, damped at 0.35 of critical). Every physics
     * step (terrainVehiclePose) each tyre finds the ground under it (rideTyreGround:
     * the tyre's round profile over the height field's triangles, so a crease or a
     * ledge is met as a curve, not a corner), the springs push on the body where
     * they stand, and the body (one rigid mass: heave, pitch and roll, the load
     * shifting downhill with the body's tilt) answers. A spring past its bump travel
     * meets a stiff rubber stop and then the axle: the corner's speed into the
     * ground is taken out in one blow, an inelastic impulse along the ground's
     * normal, which against a steep bank is mostly the truck's speed into the bank,
     * not a lift (it used to drive up a 60 degree cut at 40 km/h and leave its top).
     *
     * The ground's push: each tyre's load acts along the normal of the ground under
     * it, so its horizontal part is what pulls a truck back down a climb
     * (offroadDrive reads rideAx / rideAy in place of a slope term), and the load
     * (rideLoad, 1 g standing) is what the tyres can grip with: light over a crest,
     * nothing in the air, more on a landing.
     *
     * Leaving the ground: only where the ground falls away faster than the body can
     * follow on full droop (a crest taken fast) do the wheels lift; the body flies
     * on its own momentum and comes down on its springs. A gap of RIDE_FREE_FLIGHT
     * under every wheel is a real flight: falls-vehicles.js takes it from there
     * (startCliffFlight: the arc, the landing's damage). While this model holds a
     * vehicle it keeps the falls state pinned to the ground under it, so
     * cliffSettle has nothing to do.
     *
     * Outputs: slopePitch / slopeRoll (the body's own angles), rideLift (the body's
     * height over the ground under its middle, drawn only: entityElevation stays on
     * the ground), rideLoad, rideAx / rideAy, ride.d (each wheel's travel for the
     * club trucks' axles), rideThumpAt / rideThumpVz (a stop or a landing, for the
     * foley). A vehicle standing on its springs is settled (rideActive false) and
     * costs nothing: settleIsTrivial keeps that in step.
     */
    const RIDE_WHEEL_X = [1, 1, -1, -1],
      RIDE_WHEEL_Y = [-1, 1, -1, 1],
      // Rubber in the bump stops before the axle meets the frame.
      RIDE_STOP = 0.05 * UNITS_PER_METRE,
      // Every wheel this far off the ground: a flight (falls-vehicles.js).
      RIDE_FREE_FLIGHT = 0.6 * UNITS_PER_METRE,
      // Fastest the axle on its stops lifts the body onto higher ground.
      RIDE_LIFT_RATE = 3 * UNITS_PER_METRE,
      rideModels = new Map(),
      rideTyre = { h: 0, gx: 0, gy: 0 },
      rideSample = { h: 0, gx: 0, gy: 0 },
      rideG = new Float64Array(4),
      rideGX = new Float64Array(4),
      rideGY = new Float64Array(4);
    // Telemetry for one vehicle (console: trailDrive), null when nobody is watching.
    let rideWatch = null;
    function rideModel(spec) {
      let m = rideModels.get(spec);
      if (m) return m;
      const travel = spec.travel || (spec.offroad || spec.tank ? 1 : 0.6),
        heavy = !!(spec.bus || spec.truck || (spec.mass || 1.25) >= 2.8),
        hz = clamp(1.55 - 0.25 * travel + (heavy ? 0.15 : 0), 0.95, 1.7),
        w = 2 * Math.PI * hz,
        k = (w * w) / 4,
        sag = GRAVITY / (w * w),
        total = (0.1 + 0.16 * travel) * UNITS_PER_METRE;
      m = {
        a: spec.l * 0.29,
        b: spec.w * 0.42,
        k,
        c: (0.35 * w) / 2,
        kb: k * 14,
        cb: (0.35 * w) / 2 * 2.5,
        sag,
        droop: sag,
        bump: Math.max(total - sag, sag),
        rp2: (spec.l * 0.32) ** 2,
        rr2: (spec.w * 0.3) ** 2,
        h: (0.45 + 0.17 * travel + (heavy ? 0.35 : 0)) * UNITS_PER_METRE,
        r: (0.3 + 0.08 * travel + (heavy ? 0.12 : 0)) * UNITS_PER_METRE,
        // Blows through the stops past this speed damage it (long-travel trucks take more).
        harm: (spec.offroad || spec.tank ? 4.5 : 3) * UNITS_PER_METRE,
        // A two-wheeler has no roll stiffness of its own (the rider balances it;
        // riders.js leans it): its roll follows the ground across its tyres.
        twoWheel: !!(spec.bike || spec.bicycle),
      };
      rideModels.set(spec, m);
      return m;
    }
    /* Height and gradient of the terrain triangle under a point (the exact surface
       sampleTerrainField draws and terrainHeight reads), into `out`. */
    function rideGroundAt(x, y, out) {
      out.h = 0;
      out.gx = 0;
      out.gy = 0;
      const f = terrainFieldAt(x, y);
      if (!f) return out;
      const { x0, y0, nx, ny, cols, heights, triangles } = terrainField(f),
        lx = (x - x0) / TERRAIN_CELL,
        lz = (y - y0) / TERRAIN_CELL;
      if (lx < 0 || lz < 0 || lx > nx || lz > ny) return out;
      const ix = Math.min(nx - 1, Math.floor(lx)),
        iz = Math.min(ny - 1, Math.floor(lz)),
        u = lx - ix,
        v = lz - iz,
        side = u + v <= 1 ? 0 : 1;
      if (!triangles[(iz * nx + ix) * 2 + side]) return out;
      const a = iz * cols + ix,
        h00 = heights[a],
        h10 = heights[a + 1],
        h01 = heights[a + cols],
        h11 = heights[a + cols + 1];
      if (side === 0) {
        out.h = h00 * (1 - u - v) + h10 * u + h01 * v;
        out.gx = (h10 - h00) / TERRAIN_CELL;
        out.gy = (h01 - h00) / TERRAIN_CELL;
      } else {
        out.h = h11 * (u + v - 1) + h01 * (1 - u) + h10 * (1 - v);
        out.gx = (h11 - h01) / TERRAIN_CELL;
        out.gy = (h11 - h10) / TERRAIN_CELL;
      }
      return out;
    }
    /* Rock under a tyre on a trail's rock sections (offroad-trails.js rockField: the
       rock garden, the slickrock): ledges and boulders up to RIDE_ROCK_RELIEF that
       the tyres climb and the springs work over (the club trucks' axles follow
       them). Nothing anywhere else. */
    const RIDE_ROCK_RELIEF = 0.3 * UNITS_PER_METRE;
    function rideRelief(x, y) {
      const f = terrainFieldAt(x, y);
      if (!f || !f.rockField) return 0;
      const lx = (x - f.x0) / TERRAIN_CELL,
        ly = (y - f.y0) / TERRAIN_CELL;
      if (lx < 0 || ly < 0 || lx >= f.nx || ly >= f.ny) return 0;
      const c = Math.floor(lx),
        r = Math.floor(ly),
        u = lx - c,
        v = ly - r,
        i = r * f.cols + c,
        k = f.rockField;
      if (!(k[i] + k[i + 1] + k[i + f.cols] + k[i + f.cols + 1] > 0.02)) return 0;
      const rock = (k[i] * (1 - u) + k[i + 1] * u) * (1 - v) + (k[i + f.cols] * (1 - u) + k[i + f.cols + 1] * u) * v;
      return rock * RIDE_ROCK_RELIEF * rockReliefShape(x, y);
    }
    // 0..1: slabs and ledges a few metres across with stones on them (the renderer
    // draws its rocks from the same shape).
    function rockReliefShape(x, y) {
      const slab = terrainNoise(x / 14, y / 14, 51),
        stone = terrainNoise(x / 4.5, y / 4.5, 77);
      return clamp(smoothStep(-0.15, 0.35, slab) * 0.75 + Math.max(0, stone) * 0.5, 0, 1);
    }
    /* Where a tyre of `radius` rolling along (cos, sin) stands on the ground: the
       middle of its footprint and 0.6 of the radius fore and aft, each lowered by
       the tyre's curve there; the highest wins, with its triangle's gradient. */
    function rideTyreGround(x, y, cos, sin, radius, out) {
      rideGroundAt(x, y, out);
      out.h += rideRelief(x, y);
      const s = radius * 0.6,
        drop = radius * 0.2;
      rideGroundAt(x + cos * s, y + sin * s, rideSample);
      rideSample.h += rideRelief(x + cos * s, y + sin * s);
      if (rideSample.h - drop > out.h) {
        out.h = rideSample.h - drop;
        out.gx = rideSample.gx;
        out.gy = rideSample.gy;
      }
      rideGroundAt(x - cos * s, y - sin * s, rideSample);
      rideSample.h += rideRelief(x - cos * s, y - sin * s);
      if (rideSample.h - drop > out.h) {
        out.h = rideSample.h - drop;
        out.gx = rideSample.gx;
        out.gy = rideSample.gy;
      }
      return out;
    }
    function rideGrounds(c, m, cos, sin) {
      for (let i = 0; i < 4; i++) {
        const fx = RIDE_WHEEL_X[i] * m.a,
          sy = RIDE_WHEEL_Y[i] * m.b;
        rideTyreGround(c.x + cos * fx - sin * sy, c.y + sin * fx + cos * sy, cos, sin, m.r, rideTyre);
        rideG[i] = rideTyre.h;
        rideGX[i] = rideTyre.gx;
        rideGY[i] = rideTyre.gy;
      }
    }
    // The body standing on its springs over the four grounds (their best plane).
    function rideRest(c, r, m, groundMid) {
      r.z = (rideG[0] + rideG[1] + rideG[2] + rideG[3]) / 4;
      r.p = (rideG[0] + rideG[1] - rideG[2] - rideG[3]) / (4 * m.a);
      r.q = -(rideG[1] + rideG[3] - rideG[0] - rideG[2]) / (4 * m.b);
      r.vz = r.vp = r.vq = 0;
      r.air = 0;
      r.still = 0;
      r.handed = false;
      for (let i = 0; i < 4; i++) {
        r.g[i] = rideG[i];
        r.d[i] = rideG[i] - (r.z + RIDE_WHEEL_X[i] * m.a * r.p - RIDE_WHEEL_Y[i] * m.b * r.q);
        r.load[i] = GRAVITY / 4;
      }
      r.gm = groundMid;
      c.rideLoad = GRAVITY;
      let ax = 0,
        ay = 0;
      for (let i = 0; i < 4; i++) {
        const along = GRAVITY / 4 / Math.sqrt(1 + rideGX[i] * rideGX[i] + rideGY[i] * rideGY[i]);
        ax -= along * rideGX[i];
        ay -= along * rideGY[i];
      }
      c.rideAx = ax;
      c.rideAy = ay;
      c.rideAir = false;
    }
    /* ---- For the driving model (offroadDrive, offroadPaved) ----------------------------- */
    // The tyres' load as a share of standing on level ground (`cn`, the cosine of the
    // slope, standing on it): light over a crest, none in the air, more on a landing.
    function rideLoadShare(c, cn) {
      return c.ride && !c.ride.handed ? clamp((c.rideLoad * cn) / GRAVITY, 0, 1.6) : cn;
    }
    // The ground's push on the vehicle along it this step (gravity's share down the
    // slope under each tyre; without a ride yet, the slope under its middle).
    function rideGroundPush(c, t, cn, stepSeconds) {
      if (c.ride && !c.ride.handed) {
        c.vx += c.rideAx * stepSeconds;
        c.vy += c.rideAy * stepSeconds;
      } else {
        c.vx -= t.slope.x * GRAVITY * cn * stepSeconds;
        c.vy -= t.slope.y * GRAVITY * cn * stepSeconds;
      }
    }
    // That push along the heading (what the brakes must hold standing still).
    function ridePushAlong(c, t, cn) {
      return c.ride && !c.ride.handed ? c.rideAx * Math.cos(c.a) + c.rideAy * Math.sin(c.a) : -GRAVITY * t.along * cn;
    }
    function rideRecord() {
      return { x: NaN, y: NaN, a: NaN, z: 0, vz: 0, p: 0, vp: 0, q: 0, vq: 0, air: 0, still: 0, gm: 0, handed: false, g: new Float64Array(4), d: new Float64Array(4), load: new Float64Array(4) };
    }
    /*
     * One physics step of the ride (terrainVehiclePose, after the step's motion and
     * contacts): `t` is the vehicle's terrain record (roadVehicleTerrain).
     */
    function rideStep(c, t, stepSeconds) {
      const spec = vehicleSpec(c),
        m = rideModel(spec),
        cos = Math.cos(c.a),
        sin = Math.sin(c.a),
        groundMid = t.z;
      let r = c.ride;
      if (!r) r = c.ride = rideRecord();
      rideGrounds(c, m, cos, sin);
      // First sight, moved by hand, or back from a flight: standing on its springs.
      if (r.handed || !(Math.abs(c.x - r.x) + Math.abs(c.y - r.y) < 60)) {
        rideRest(c, r, m, groundMid);
        rideOutputs(c, r, groundMid);
        r.x = c.x;
        r.y = c.y;
        r.a = c.a;
        c.rideActive = true;
        return;
      }
      const dt = stepSeconds,
        watch = rideWatch && rideWatch.car === c ? rideWatch : null,
        wasAir = r.air > 0;
      let F = 0,
        MP = 0,
        MR = 0,
        AX = 0,
        AY = 0,
        touching = 0,
        gap = Infinity,
        landing = 0;
      for (let i = 0; i < 4; i++) {
        const X = RIDE_WHEEL_X[i] * m.a,
          Y = RIDE_WHEEL_Y[i] * m.b,
          d = rideG[i] - (r.z + X * r.p - Y * r.q),
          rate = (rideG[i] - r.g[i]) / dt - (r.vz + X * r.vp - Y * r.vq);
        let a = 0;
        if (d > -m.droop) {
          touching++;
          a = m.k * (m.sag + d) + m.c * rate;
          if (d > m.bump) a += m.kb * (d - m.bump) + m.cb * Math.max(0, rate);
          if (a < 0) a = 0;
          if (wasAir) landing = Math.max(landing, rate);
        } else gap = Math.min(gap, -d - m.droop);
        r.d[i] = d;
        r.load[i] = a;
        F += a;
        MP += a * X;
        MR -= a * Y;
        // Along the ground: gravity's share down the slope under this tyre.
        const along = a / Math.sqrt(1 + rideGX[i] * rideGX[i] + rideGY[i] * rideGY[i]);
        AX -= along * rideGX[i];
        AY -= along * rideGY[i];
      }
      if (touching) gap = 0;
      // On its wheels the body's tilt moves its weight downhill (the centre of mass
      // stands above the tyres); in the air it turns about itself.
      const tilt = touching >= 3 ? (GRAVITY * m.h) : 0;
      r.vz += (F - GRAVITY) * dt;
      r.vp += ((MP + tilt * (r.p / Math.sqrt(1 + r.p * r.p))) / m.rp2) * dt;
      r.vq += ((MR + tilt * (r.q / Math.sqrt(1 + r.q * r.q))) / m.rr2) * dt;
      r.z += r.vz * dt;
      r.p += r.vp * dt;
      r.q += r.vq * dt;
      if (m.twoWheel) {
        r.q = -(rideG[1] + rideG[3] - rideG[0] - rideG[2]) / (4 * m.b);
        r.vq = 0;
      }
      // Through the stops: the axle meets the frame. Take the corner's speed into
      // the ground out along the ground's normal (an inelastic blow) and lift the
      // body clear of the axle.
      let blow = 0;
      for (let i = 0; i < 4; i++) {
        const X = RIDE_WHEEL_X[i] * m.a,
          Y = RIDE_WHEEL_Y[i] * m.b,
          over = rideG[i] - (r.z + X * r.p - Y * r.q) - (m.bump + RIDE_STOP);
        if (over <= 0) continue;
        const K = 1 + (X * X) / m.rp2 + (Y * Y) / m.rr2,
          closing = (rideG[i] - r.g[i]) / dt - (r.vz + X * r.vp - Y * r.vq);
        // A tyre climbs a ledge but not a wall: the body is lifted at most
        // RIDE_LIFT_RATE (the stop's spring and the ground's push hold it off the rest).
        const lift = Math.min(over, RIDE_LIFT_RATE * dt);
        r.z += lift / K;
        r.p += (lift * X) / m.rp2 / K;
        r.q -= (lift * Y) / m.rr2 / K;
        if (closing > 0) {
          const gg = rideGX[i] * rideGX[i] + rideGY[i] * rideGY[i],
            J = closing / (K + gg),
            // The speed taken out along the ground's normal: what the blow is.
            into = J * Math.sqrt(1 + gg);
          r.vz += J;
          r.vp += (J * X) / m.rp2;
          r.vq -= (J * Y) / m.rr2;
          c.vx -= J * rideGX[i];
          c.vy -= J * rideGY[i];
          if (watch && into > watch.maxBlow && into > blow) watch.blowAt = [Math.round(c.x), Math.round(c.y), i, +Math.sqrt(gg).toFixed(2), Math.round(Math.abs(c.speed || 0) / KMH)];
          blow = Math.max(blow, into);
        }
      }
      // How fast the ground under the tyres rises (their mean), for the telemetry.
      const groundRate = (rideG[0] + rideG[1] + rideG[2] + rideG[3] - r.g[0] - r.g[1] - r.g[2] - r.g[3]) / (4 * dt);
      for (let i = 0; i < 4; i++) r.g[i] = rideG[i];
      r.gm = groundMid;
      r.air = touching ? 0 : r.air + dt;
      c.rideLoad = F;
      c.rideAx = AX;
      c.rideAy = AY;
      c.rideAir = !touching;
      // A knock through the body: a stop met hard, or a landing.
      const knock = Math.max(blow, landing);
      if (knock > 1.2 * UNITS_PER_METRE) {
        c.rideThumpAt = physicsClock;
        c.rideThumpVz = knock;
        if (c === player.car) shake = Math.max(shake, clamp(knock / (2.5 * UNITS_PER_METRE), 0.3, 3));
        if (blow > m.harm) damageVehicle(c, ((blow - m.harm) / UNITS_PER_METRE) * 5, c.x, c.y);
      }
      if (watch) rideWatchStep(watch, c, r, m, dt, gap, groundRate, blow, touching);
      // Every wheel well clear of the ground: a flight (falls-vehicles.js).
      if (!touching && gap > RIDE_FREE_FLIGHT) return rideTakeOff(c, r, groundMid, watch);
      // Settled on its springs, standing still: nothing to do until it moves.
      const moved = c.x !== r.x || c.y !== r.y || c.a !== r.a;
      r.x = c.x;
      r.y = c.y;
      r.a = c.a;
      const calm = touching >= 3 && Math.abs(r.vz) < 0.03 && Math.abs(r.vp) < 0.0006 && Math.abs(r.vq) < 0.0006;
      r.still = !moved && calm ? r.still + 1 : 0;
      if (r.still > 24) {
        r.vz = r.vp = r.vq = 0;
        if (c.rideActive) c.rideActive = false;
      } else if (!c.rideActive) c.rideActive = true;
      rideOutputs(c, r, groundMid);
    }
    function rideOutputs(c, r, groundMid) {
      const pitch = Math.atan(r.p),
        roll = Math.atan(r.q),
        lift = r.z - groundMid;
      if (c.slopePitch !== pitch) c.slopePitch = pitch;
      if (c.slopeRoll !== roll) c.slopeRoll = roll;
      if (c.rideLift !== lift) c.rideLift = lift;
      // The falls state stays on the ground under it: cliffSettle has nothing to do.
      if (c.fallZ !== groundMid) c.fallZ = groundMid;
      if (c.fallGround !== groundMid) c.fallGround = groundMid;
      if (c.fallVz !== 0) c.fallVz = 0;
      if (c.fallX !== c.x) c.fallX = c.x;
      if (c.fallY !== c.y) c.fallY = c.y;
    }
    // Off the ground for real: the flight is falls-vehicles.js's from here.
    function rideTakeOff(c, r, groundMid, watch) {
      c.fallZ = r.z;
      c.fallVz = r.vz;
      c.fallGround = groundMid;
      c.fallX = c.x;
      c.fallY = c.y;
      c.slopePitch = Math.atan(r.p);
      c.slopeRoll = Math.atan(r.q);
      c.rideLift = 0;
      c.rideAir = false;
      c.rideActive = false;
      r.handed = true;
      startCliffFlight(c, groundMid);
      // It goes on turning as it left (the springs already tipped it over the lip).
      if (c.cliffAir) {
        c.cliffAir.vp = r.vp / (1 + r.p * r.p);
        c.cliffAir.vr = r.vq / (1 + r.q * r.q);
      }
      if (watch) watch.flights++;
    }
    // The vehicle leaves the terrain (or turns over): the ride ends.
    function rideEnd(c) {
      if (c.ride) c.ride.handed = true;
      if (c.rideLift) c.rideLift = 0;
      if (c.rideActive) c.rideActive = false;
      if (c.rideAir) c.rideAir = false;
    }
    /* ---- Telemetry (console) ---------------------------------------------------------- */
    function rideWatchStart(car) {
      rideWatch = { car, steps: 0, airS: 0, hops: 0, inAir: 0, maxGap: 0, maxLift: 0, minLift: 0, maxRise: 0, maxUp: 0, maxDown: 0, stops: 0, maxBlow: 0, flights: 0, nan: 0, maxPitchRate: 0, maxRollRate: 0, gapAt: null, blowAt: null, liftAt: null };
      return rideWatch;
    }
    function rideWatchStep(w, c, r, m, dt, gap, groundRate, blow, touching) {
      w.steps++;
      if (!Number.isFinite(r.z + r.vz + r.p + r.q + r.vp + r.vq)) w.nan++;
      if (!touching) {
        w.airS += dt;
        w.inAir += dt;
        if (gap > w.maxGap) {
          w.maxGap = gap;
          w.gapAt = [Math.round(c.x), Math.round(c.y), Math.round(Math.abs(c.speed || 0) / KMH)];
        }
      } else {
        if (w.inAir > 0.05) w.hops++;
        w.inAir = 0;
      }
      const lift = r.z - r.gm;
      if (lift > w.maxLift) w.liftAt = [Math.round(c.x), Math.round(c.y), +(r.gm / UNITS_PER_METRE).toFixed(1), Array.from(rideG, (g) => +((g - r.gm) / UNITS_PER_METRE).toFixed(2))];
      w.maxLift = Math.max(w.maxLift, lift);
      w.minLift = Math.min(w.minLift, lift);
      // Rising faster than the ground under it carries it: what a launch looks like.
      w.maxRise = Math.max(w.maxRise, r.vz - groundRate);
      w.maxUp = Math.max(w.maxUp, r.vz);
      w.maxDown = Math.min(w.maxDown, r.vz);
      w.maxPitchRate = Math.max(w.maxPitchRate, Math.abs(r.vp));
      w.maxRollRate = Math.max(w.maxRollRate, Math.abs(r.vq));
      if (blow > 0) {
        w.stops++;
        w.maxBlow = Math.max(w.maxBlow, blow);
      }
    }
    function rideWatchReport(w) {
      if (!w) return null;
      const ms = (v) => +(v / UNITS_PER_METRE).toFixed(2);
      return {
        airS: +w.airS.toFixed(2),
        hops: w.hops,
        maxGapM: ms(w.maxGap),
        gapAt: w.gapAt,
        maxLiftM: ms(w.maxLift),
        liftAt: w.liftAt,
        minLiftM: ms(w.minLift),
        maxRiseMs: ms(w.maxRise),
        maxUpMs: ms(w.maxUp),
        maxDownMs: ms(w.maxDown),
        stops: w.stops,
        maxBlowMs: ms(w.maxBlow),
        blowAt: w.blowAt,
        flights: w.flights,
        maxPitchRate: +w.maxPitchRate.toFixed(2),
        maxRollRate: +w.maxRollRate.toFixed(2),
        nan: w.nan,
      };
    }
    /* Console: what the ride costs. Times `n` ride steps of the player's vehicle where
       it stands (µs a step) and counts the vehicles on the terrain, the rides still
       working and those that ran this step (settleIsTrivial skips the rest). */
    function rideBenchmark(n = 2000) {
      const c = player.car,
        t = c && roadVehicleTerrain(c);
      let onTerrain = 0,
        active = 0;
      for (const v of vehicles)
        if (v.offroadState) {
          onTerrain++;
          if (v.rideActive) active++;
        }
      if (!t) return { onTerrain, active, usPerStep: null };
      const count = clamp(Number(n) || 2000, 1, 100000),
        start = performance.now();
      for (let i = 0; i < count; i++) rideStep(c, t, 1 / 120);
      return { onTerrain, active, usPerStep: +(((performance.now() - start) * 1000) / count).toFixed(2) };
    }
    // The ride of the player's vehicle now (console `ride`-style report).
    function rideReport(c = player.car) {
      if (!c) return null;
      const r = c.ride,
        m = rideModel(vehicleSpec(c)),
        ms = (v) => +(v / UNITS_PER_METRE).toFixed(3);
      return {
        type: c.type,
        onTerrain: !!c.offroadState,
        active: !!c.rideActive,
        air: !!c.rideAir,
        liftM: ms(c.rideLift || 0),
        pitchDeg: +(((c.slopePitch || 0) * 180) / Math.PI).toFixed(2),
        rollDeg: +(((c.slopeRoll || 0) * 180) / Math.PI).toFixed(2),
        loadG: +((c.rideLoad || 0) / GRAVITY).toFixed(3),
        wheelTravelM: r ? Array.from(r.d, (d) => ms(d)) : null,
        wheelLoadG: r ? Array.from(r.load, (a) => +(a / GRAVITY).toFixed(3)) : null,
        model: { hz: +(Math.sqrt(m.k * 4) / (2 * Math.PI)).toFixed(2), sagM: ms(m.sag), droopM: ms(m.droop), bumpM: ms(m.bump), tyreM: ms(m.r), wheelbaseM: ms(m.a * 2), trackM: ms(m.b * 2) },
      };
    }
