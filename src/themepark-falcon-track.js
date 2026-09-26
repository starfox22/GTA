    // ---- The Falcon: circuit builder -----------------------------------------------
    /**
     * THE FALCON
     * The circuit is authored the way a real track is designed: as a list of
     * elements, each an arc length over which the heading (yaw), the pitch and an
     * authored roll change. Each change is eased (its rate follows a smoothstep
     * bell), so curvature ramps in and out instead of jumping; that is what keeps
     * the forces smooth. `to` elements search for the straight run that lands on
     * a target height with the pitch back to level. A loop is a full turn of
     * pitch (a teardrop, tightest at the top) with a sideways shift so the exit
     * clears the entry; a corkscrew or heartline roll displaces the track round a
     * straight heartline while the roll turns once (`screw` is that radius).
     * After resampling at even arc length the circuit is banked so every turn is
     * felt straight down through the seat at the speed the train really carries
     * there (see coasterSpeedProfile), the authored rolls added on top.
     * Heights are in world units above the ground (UNITS_PER_METRE to the metre).
     */
    const COASTER_START = { x: 2640, y: -6430, z: 22, yaw: Math.PI },
      COASTER_ELEMENTS = [
        { len: 130, kind: 'station' },
        { len: 20, kind: 'lift' },
        { to: 330, angle: 45, bend: 50, bend2: 90, kind: 'lift' },
        { len: 10 },
        // First drop: 72 degrees, turning right out over the west shore.
        { to: 16, angle: 72, bend: 100, bend2: 460, turn: 90 },
        { len: 20 },
        { len: 300, turn: 90 },
        { len: 20 },
        // Vertical loop along the north shore, facing the city.
        { len: 760, pitch: 360, shift: -18 },
        { len: 20 },
        // Camelback: airtime over the crest.
        { to: 170, angle: 36, bend: 180, bend2: 170 },
        { to: 40, angle: 45, bend: 160, bend2: 200 },
        // Overbanked turnaround at the east end of the north run.
        { to: 120, angle: 22, bend: 80, bend2: 60, turn: 90 },
        { to: 100, angle: 10, bend: 60, bend2: 80, turn: 90 },
        // Heartline roll, west towards the lift.
        { len: 280, roll: 360, screw: 7 },
        { len: 10 },
        { len: 170, turn: -90 },
        { to: 70, angle: 12, bend: 60, bend2: 60 },
        { len: 170, turn: 90 },
        { len: 20 },
        // Corkscrew, west past the station.
        { len: 300, roll: -360, screw: 22 },
        { len: 20 },
        // Helix in the south-west corner, one and a half turns.
        { len: 1300, turn: -540, drop: 40 },
        { len: 60 },
        // Bunny hop along the south shore, then the brakes home.
        { to: 70, angle: 20, bend: 90, bend2: 90 },
        { to: 22, angle: 20, bend: 90, bend2: 90 },
        { len: 60 },
        { len: 200, turn: -90, kind: 'brake' },
        { len: 352, kind: 'brake' },
        { len: 170, turn: -90, kind: 'brake' },
        { len: 137, kind: 'brake' },
      ];
    const COASTER_SAMPLE = 2,
      COASTER_KINDS = { track: 0, station: 1, lift: 2, brake: 3 },
      // Real gravity; the chain, station tyres and brake pace in metres a second.
      COASTER_G = GRAVITY,
      COASTER_LIFT_SPEED = 6.6 * UNITS_PER_METRE,
      COASTER_STATION_SPEED = 2 * UNITS_PER_METRE,
      COASTER_BRAKE_SPEED = 7.8 * UNITS_PER_METRE,
      // Seven cars of four riders, 15.5 units apart, front car first.
      COASTER_CARS = 7,
      COASTER_CAR_GAP = 15.5,
      // Where the front car stops in the station (arc length from the circuit start).
      COASTER_STOP = 118;
    const coasterSmooth = (u) => u * u * (3 - 2 * u);
    function walkCoaster(start, elements) {
      const pts = [];
      let x = start.x,
        y = start.y,
        z = start.z,
        yaw = start.yaw,
        pitch = 0,
        roll = 0;
      const push = (kind, dx, dy, screw) => pts.push({ x: x + dx, y: y + dy, z, yaw, pitch, roll, kind, screw });
      push('station', 0, 0, 0);
      function run(e, record = true) {
        const n = Math.max(1, Math.ceil(e.len)),
          ds = e.len / n,
          dyaw = ((e.turn || 0) * Math.PI) / 180,
          dpitch = e.pitchTo !== undefined ? (e.pitchTo * Math.PI) / 180 - pitch : ((e.pitch || 0) * Math.PI) / 180,
          droll = ((e.roll || 0) * Math.PI) / 180,
          ease = e.ease === 'linear' ? (u) => u : coasterSmooth,
          yaw0 = yaw,
          pitch0 = pitch,
          roll0 = roll;
        for (let i = 1; i <= n; i++) {
          const u0 = (i - 1) / n,
            u1 = i / n,
            f = ease((u0 + u1) / 2),
            py = yaw0 + dyaw * f,
            pp = pitch0 + dpitch * f;
          x += Math.cos(pp) * Math.cos(py) * ds;
          y += Math.cos(pp) * Math.sin(py) * ds;
          z += Math.sin(pp) * ds;
          if (e.drop) z -= e.drop * (coasterSmooth(u1) - coasterSmooth(u0));
          const g = ease(u1);
          yaw = yaw0 + dyaw * g;
          pitch = pitch0 + dpitch * g;
          roll = roll0 + droll * g;
          if (!record) continue;
          const shift = (e.shift || 0) * coasterSmooth(u1);
          push(e.kind || 'track', -Math.sin(yaw0) * shift, Math.cos(yaw0) * shift, e.screw || 0);
        }
        // A loop's sideways shift stays with the track after it.
        if (e.shift && record) {
          x -= Math.sin(yaw0) * e.shift;
          y += Math.cos(yaw0) * e.shift;
          const last = pts[pts.length - 1];
          last.x = x;
          last.y = y;
        }
      }
      for (const e of elements) {
        if (e.to === undefined) run(e);
        else {
          // Ramp the pitch to +-angle over `bend`, hold, ramp back to level over
          // `bend2`; the hold is found by bisection on the end height.
          const up = e.to > z ? 1 : -1,
            bend = e.bend || 60,
            bend2 = e.bend2 || bend,
            parts = (hold) => {
              const total = bend + hold + bend2,
                t = e.turn || 0;
              return [
                { len: bend, pitchTo: up * (e.angle || 40), turn: (t * bend) / total, kind: e.kind },
                { len: Math.max(0.5, hold), turn: (t * hold) / total, kind: e.kind, ease: 'linear' },
                { len: bend2, pitchTo: 0, turn: (t * bend2) / total, kind: e.kind },
              ];
            };
          let lo = 0,
            hi = 3000;
          for (let k = 0; k < 40; k++) {
            const mid = (lo + hi) / 2,
              save = [x, y, z, yaw, pitch, roll];
            for (const p of parts(mid)) run(p, false);
            const end = z;
            [x, y, z, yaw, pitch, roll] = save;
            if ((end - e.to) * up < 0) lo = mid;
            else hi = mid;
          }
          for (const p of parts((lo + hi) / 2)) run(p);
        }
        // A loop ends a whole turn of pitch up: carry on from level.
        pitch = Math.atan2(Math.sin(pitch), Math.cos(pitch));
      }
      // Close the circuit: whatever the authored elements miss the station by is
      // spread over the last stretch, easing in, so no kink shows at the seam.
      const close = Math.min(1600, pts.length - 400),
        ex = start.x - x,
        ey = start.y - y,
        ez = start.z - z;
      for (let i = pts.length - close; i < pts.length; i++) {
        const w = coasterSmooth((i - (pts.length - close)) / (close - 1));
        pts[i].x += ex * w;
        pts[i].y += ey * w;
        pts[i].z += ez * w;
      }
      pts.pop();
      return pts;
    }
    /* Resample the walked circuit at even arc length: positions, the authored up
       vector (pitch-up normal turned by the authored roll) and the section kind. */
    function buildCoasterCircuit() {
      const P = walkCoaster(COASTER_START, COASTER_ELEMENTS).map((p) => {
        const cp = Math.cos(p.pitch),
          sp = Math.sin(p.pitch),
          cy = Math.cos(p.yaw),
          sy = Math.sin(p.yaw),
          n = [-sp * cy, -sp * sy, cp],
          side = [-sy, cy, 0],
          cr = Math.cos(p.roll),
          sr = Math.sin(p.roll),
          u = [n[0] * cr + side[0] * sr, n[1] * cr + side[1] * sr, n[2] * cr + side[2] * sr];
        // Corkscrew: the track swings round a heartline `screw` above it.
        return {
          x: p.x + p.screw * (n[0] - u[0]),
          y: p.y + p.screw * (n[1] - u[1]),
          z: p.z + p.screw * (n[2] - u[2]),
          u,
          kind: p.kind,
        };
      });
      const cum = [0];
      for (let i = 1; i < P.length; i++)
        cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y, P[i].z - P[i - 1].z));
      const length = cum[cum.length - 1],
        count = Math.round(length / COASTER_SAMPLE),
        ds = length / count,
        T = {
          X: new Float32Array(count),
          Y: new Float32Array(count),
          Z: new Float32Array(count),
          UX: new Float32Array(count),
          UY: new Float32Array(count),
          UZ: new Float32Array(count),
          kind: new Uint8Array(count),
          count,
          ds,
          length,
        };
      for (let i = 0, j = 0; i < count; i++) {
        const s = i * ds;
        while (j < P.length - 2 && cum[j + 1] < s) j++;
        const a = P[j],
          b = P[j + 1],
          f = clamp((s - cum[j]) / (cum[j + 1] - cum[j] || 1), 0, 1);
        T.X[i] = a.x + (b.x - a.x) * f;
        T.Y[i] = a.y + (b.y - a.y) * f;
        T.Z[i] = a.z + (b.z - a.z) * f;
        T.UX[i] = a.u[0] + (b.u[0] - a.u[0]) * f;
        T.UY[i] = a.u[1] + (b.u[1] - a.u[1]) * f;
        T.UZ[i] = a.u[2] + (b.u[2] - a.u[2]) * f;
        T.kind[i] = COASTER_KINDS[f < 0.5 ? a.kind : b.kind] ?? 0;
      }
      bankCoaster(T);
      return T;
    }
    /* Along-track acceleration: gravity on the gradient less rolling and air losses. */
    function coasterAcceleration(speed, rise) {
      // Wheel losses of about 0.18 m/s², air drag growing with the square of the speed.
      return -COASTER_G * rise - 0.18 * UNITS_PER_METRE - (0.0000614 / UNITS_PER_METRE) * speed * speed;
    }
    /* The speed a train carries round the circuit from a dispatch (for banking). */
    function coasterSpeedProfile(T) {
      const n = T.count,
        v = new Float32Array(n);
      let speed = COASTER_STATION_SPEED;
      for (let i = 0; i < n; i++) {
        const k = T.kind[i],
          rise = (T.Z[(i + 1) % n] - T.Z[i]) / T.ds;
        if (k === 1) speed = COASTER_STATION_SPEED;
        else if (k === 2) speed = Math.max(COASTER_LIFT_SPEED, Math.sqrt(Math.max(1, speed * speed - 2 * COASTER_G * rise * T.ds)));
        else if (k === 3) speed = Math.max(COASTER_BRAKE_SPEED, speed - (23.4 * UNITS_PER_METRE * T.ds) / Math.max(speed, 1));
        else speed = Math.sqrt(Math.max((0.78 * UNITS_PER_METRE) ** 2, speed * speed + 2 * coasterAcceleration(speed, rise) * T.ds));
        v[i] = speed;
      }
      return v;
    }
    /* Bank every sample so the rider feels the turn through the seat, not sideways. */
    function bankCoaster(T) {
      const n = T.count,
        ds = T.ds,
        v = coasterSpeedProfile(T),
        wrap = (i) => ((i % n) + n) % n,
        tangent = (i, out) => {
          const a = wrap(i - 1),
            b = wrap(i + 1),
            dx = T.X[b] - T.X[a],
            dy = T.Y[b] - T.Y[a],
            dz = T.Z[b] - T.Z[a],
            l = Math.hypot(dx, dy, dz) || 1;
          out[0] = dx / l;
          out[1] = dy / l;
          out[2] = dz / l;
          return out;
        },
        bank = new Float32Array(n),
        t = [0, 0, 0],
        t0 = [0, 0, 0],
        t1 = [0, 0, 0],
        W = 4;
      for (let i = 0; i < n; i++) {
        tangent(i, t);
        tangent(i - W, t0);
        tangent(i + W, t1);
        const v2 = (v[i] * v[i]) / (2 * W * ds),
          fx = (t1[0] - t0[0]) * v2,
          fy = (t1[1] - t0[1]) * v2,
          fz = (t1[2] - t0[2]) * v2 + COASTER_G;
        let ux = T.UX[i],
          uy = T.UY[i],
          uz = T.UZ[i];
        const d = ux * t[0] + uy * t[1] + uz * t[2];
        ux -= d * t[0];
        uy -= d * t[1];
        uz -= d * t[2];
        const l = Math.hypot(ux, uy, uz) || 1;
        T.UX[i] = ux /= l;
        T.UY[i] = uy /= l;
        T.UZ[i] = uz /= l;
        const sx = uy * t[2] - uz * t[1],
          sy = uz * t[0] - ux * t[2],
          sz = ux * t[1] - uy * t[0];
        bank[i] = T.kind[i] === 1 ? 0 : clamp(Math.atan2(fx * sx + fy * sy + fz * sz, Math.abs(fx * ux + fy * uy + fz * uz)), -1.75, 1.75);
      }
      // Roll in and out over ~50 units of track.
      const R = 20,
        weights = [];
      for (let j = -R; j <= R; j++) weights.push(Math.exp(-(j * j) / (2 * (R / 2.8) ** 2)));
      const total = weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = -R; j <= R; j++) s += bank[wrap(i + j)] * weights[j + R];
        const angle = s / total,
          c = Math.cos(angle),
          sn = Math.sin(angle);
        tangent(i, t);
        const ux = T.UX[i],
          uy = T.UY[i],
          uz = T.UZ[i];
        T.UX[i] = ux * c + (uy * t[2] - uz * t[1]) * sn;
        T.UY[i] = uy * c + (uz * t[0] - ux * t[2]) * sn;
        T.UZ[i] = uz * c + (ux * t[1] - uy * t[0]) * sn;
      }
      T.speed = v;
    }
    let coasterCircuitCache = null;
    function coasterCircuit() {
      return coasterCircuitCache || (coasterCircuitCache = buildCoasterCircuit());
    }
    /* Position, unit tangent and up vector at arc length s (wrapped), interpolated. */
    function coasterFrame(s, out = {}) {
      const T = coasterCircuit(),
        n = T.count,
        u = ((((s % T.length) + T.length) % T.length) / T.ds),
        i = Math.floor(u) % n,
        j = (i + 1) % n,
        f = u - Math.floor(u),
        k = (i + 2) % n,
        h = (i + n - 1) % n;
      out.x = T.X[i] + (T.X[j] - T.X[i]) * f;
      out.y = T.Y[i] + (T.Y[j] - T.Y[i]) * f;
      out.z = T.Z[i] + (T.Z[j] - T.Z[i]) * f;
      const tx = T.X[k] - T.X[h],
        ty = T.Y[k] - T.Y[h],
        tz = T.Z[k] - T.Z[h],
        tl = Math.hypot(tx, ty, tz) || 1;
      out.tx = tx / tl;
      out.ty = ty / tl;
      out.tz = tz / tl;
      out.ux = T.UX[i] + (T.UX[j] - T.UX[i]) * f;
      out.uy = T.UY[i] + (T.UY[j] - T.UY[i]) * f;
      out.uz = T.UZ[i] + (T.UZ[j] - T.UZ[i]) * f;
      out.kind = T.kind[i];
      return out;
    }
