    // BEGIN SUBSYSTEM: src/themepark.js — Sunset Pier resort and theme park
    /**
     * Sunset Pier resort and theme park
     * Source: src/themepark.js
     * Scope: shared game closure.
     * Island layout, the Falcon coaster (circuit builder, gravity ride, boarding),
     * the Sunset Eye observation wheel (and riding it), ride and show schedules
     * (fountain, fireworks), colliders, the island ground, the park crowd and the
     * park's procedural sound.
     */
    /**
     * SUNSET PIER
     * A Gulf-style resort island north of the reclamation across North Sound,
     * reached by the Sunset Pier Bridge off the north end of Riverbank Dr. The
     * bridge lands at the main gate; behind it the Fountain Lagoon with the
     * Sunset Palace hotel beyond, the Falcon coaster filling the west half
     * (THEME_PARK_RESERVE) and running out over the shore, the Sunset Eye
     * observation wheel by the island drive, and the family rides, the log
     * flume, the dark ride and the midway in the east. The beach club sits on
     * the north shore behind the hotel.
     *
     * The rides are simulated here and only drawn by themepark3d.js, so what is
     * drawn is what the simulation believes: the coaster train's position and
     * speed, the Eye's rotation, the fountain show and the fireworks.
     */
    const PIER = {
      gate: { x: 3200, y: -6030 },
      plaza: { x: 3060, y: -6100, w: 280, h: 156 },
      eastGate: { x: 3898, y: -6140 },
      // The coaster station: the track runs west through it along y -6430; the
      // platform is on its south side, the queue hall south of that.
      station: { x: 2575, y: -6400 },
      // The Sunset Eye: rim in the plane y = wheel.y, facing the city.
      wheel: { x: 3600, y: -6050, r: 240, hub: 300 },
      terminal: { x: 3530, y: -6095, w: 140, h: 90, height: 30 },
      lagoon: { x: 3170, y: -6370, rx: 200, ry: 125 },
      hotel: { x: 3530, y: -6770, w: 440, d: 90, height: 240 },
      beachClub: { x: 3330, y: -7010, w: 480, h: 150 },
      carousel: { x: 3500, y: -6265, r: 42 },
      swing: { x: 3700, y: -6262, r: 30, reach: 62 },
      teacups: { x: 3505, y: -6610, r: 38 },
      dropTower: { x: 4085, y: -6225 },
      bumper: { x: 3445, y: -6495, w: 150, h: 100 },
      darkRide: { x: 3620, y: -6535, w: 200, h: 135 },
      foodCourt: { x: 3600, y: -6655, w: 220, h: 56 },
      flume: { x: 4090, y: -6480 },
      midway: { x: 3895, y: -6400 },
      busStop: { x: 3266, y: -5838 },
    };
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
    // ---- The Falcon: the train ------------------------------------------------------
    /**
     * One train of seven cars runs the circuit all day: it loads for a spell in
     * the station, is pushed out by the station tyres, hauled up the lift by the
     * chain, and from the crest runs on gravity alone (height traded for speed,
     * less rolling and air losses) until the magnetic brakes bring it home. `t`
     * is the front car's arc length; game.js resets `running` and `t` on death
     * and mission resets, which parks the train in the station.
     */
    let coasterTrain = {
      t: COASTER_STOP,
      speed: 0,
      running: false,
      dwell: 8,
      riders: 22,
      laps: 0,
    };
    function coasterParked() {
      return !coasterTrain.running;
    }
    function coasterSeat(car = 1, out = {}) {
      coasterFrame(coasterTrain.t - car * COASTER_CAR_GAP, out);
      return out;
    }
    function stepCoasterTrain(dt) {
      const train = coasterTrain,
        T = coasterCircuit();
      if (!train.running) {
        if (train.t !== COASTER_STOP) train.t = COASTER_STOP;
        train.speed = 0;
        train.dwell -= dt;
        if (train.dwell <= 0) {
          train.running = true;
          train.speed = 0.4 * UNITS_PER_METRE;
          train.riders = player.coaster?.kind === 'train' ? 27 : 18 + Math.floor(seededRandom() * 10);
          parkCrowdBoard('coaster', 6);
        }
        return;
      }
      const f = coasterFrame(train.t, parkScratch),
        ahead = coasterFrame(train.t + 3, parkScratch2),
        rise = (ahead.z - f.z) / 3,
        kind = f.kind;
      // The whole train feels gravity averaged over its length.
      let pull = 0;
      for (let c = 0; c < COASTER_CARS; c += 2) {
        const a = coasterFrame(train.t - c * COASTER_CAR_GAP, parkScratch3).z,
          b = coasterFrame(train.t - c * COASTER_CAR_GAP + 3, parkScratch3).z;
        pull += (b - a) / 3;
      }
      pull /= Math.ceil(COASTER_CARS / 2);
      const toStop = (COASTER_STOP - train.t + T.length) % T.length;
      if (kind === 1 && train.laps > 0 && toStop < 200) {
        // Home: the station tyres ease the train onto its mark.
        train.speed = Math.max(0.3 * UNITS_PER_METRE, Math.min(train.speed, Math.sqrt(2 * 1.76 * UNITS_PER_METRE * Math.max(0, toStop))));
        if (toStop < 0.8 || toStop > 190) {
          train.running = false;
          train.t = COASTER_STOP;
          train.speed = 0;
          train.dwell = 14;
          train.laps = 0;
          if (player.coaster?.kind === 'train') leaveCoaster();
          parkCrowdBoard('coaster', -6);
          return;
        }
      } else if (kind === 1) train.speed += (COASTER_STATION_SPEED - train.speed) * Math.min(1, dt * 2);
      else if (kind === 2) train.speed = Math.max(COASTER_LIFT_SPEED, train.speed + coasterAcceleration(train.speed, pull) * dt);
      else if (kind === 3) {
        // Magnetic trims above the brake pace, drive tyres below it.
        train.speed += coasterAcceleration(train.speed, pull) * dt;
        if (train.speed > COASTER_BRAKE_SPEED) train.speed = Math.max(COASTER_BRAKE_SPEED, train.speed - 13.7 * UNITS_PER_METRE * dt);
        else train.speed += (COASTER_BRAKE_SPEED - 4 - train.speed) * Math.min(1, dt * 1.2);
      } else train.speed = Math.max(0.78 * UNITS_PER_METRE, train.speed + coasterAcceleration(train.speed, pull) * dt);
      train.lastRise = rise;
      train.t += train.speed * dt;
      if (train.t >= T.length) {
        train.t -= T.length;
        train.laps++;
      }
    }
    const parkScratch = {},
      parkScratch2 = {},
      parkScratch3 = {};
    function boardCoaster() {
      if (player.car || playerOnRoof() || player.parachute || transitRide || player.coaster) return false;
      if (Math.abs(player.x - PIER.station.x) > 110 || Math.abs(player.y - PIER.station.y) > 70) return false;
      if (wantedStars > 0) {
        needToLosePolice();
        return true;
      }
      if (coasterTrain.running) {
        tell('The Falcon is out on the circuit. Wait for the next train.', 3);
        return true;
      }
      player.coaster = { kind: 'train', time: 0, car: 0, view: 0 };
      coasterTrain.dwell = Math.min(coasterTrain.dwell, 3);
      announce('SUNSET PIER', 'THE FALCON', 2.4);
      tell('Bars down. ' + keyName('interact') + ' changes the view, ' + keyName('radioPower') + ' / ' + keyName('radioNext') + ' the radio. ' + coasterBanner() + '.', 4);
      return true;
    }
    function leaveCoaster() {
      const kind = player.coaster?.kind;
      player.coaster = null;
      player.hidden = false;
      if (kind === 'wheel') {
        player.x = PIER.terminal.x - 18;
        player.y = PIER.wheel.y;
        tell('Welcome back to the ground.', 3);
      } else {
        player.x = PIER.station.x + 20;
        player.y = PIER.station.y + 52;
        tell('Mind the step. Again?', 3);
      }
      player.altitude = terrainHeight(player.x, player.y);
    }
    // ---- The Sunset Eye ------------------------------------------------------------
    /**
     * A 48-capsule observation wheel on twin A-frame legs, turning once every
     * four minutes; the capsules hang level on the outside of the rim. Ridden
     * from the terminal under the wheel: the player boards whichever capsule is
     * passing the platform and rides one revolution.
     */
    const WHEEL_CAPSULES = 48,
      WHEEL_PERIOD = 240,
      WHEEL_CAPSULE_RADIUS = 262;
    function wheelAngle() {
      return (gameTime / WHEEL_PERIOD) * TAU;
    }
    /* Capsule k: angle round the hub (0 = east, pi/2 = top) and its centre. */
    function wheelCapsule(k, out = {}) {
      const a = wheelAngle() + (k * TAU) / WHEEL_CAPSULES;
      out.a = a;
      out.x = PIER.wheel.x + Math.cos(a) * WHEEL_CAPSULE_RADIUS;
      out.y = PIER.wheel.y;
      out.z = PIER.wheel.hub + Math.sin(a) * WHEEL_CAPSULE_RADIUS;
      return out;
    }
    function boardWheel() {
      if (player.car || playerOnRoof() || player.parachute || transitRide || player.coaster) return false;
      const t = PIER.terminal;
      if (player.x < t.x - 40 || player.x > t.x + t.w + 40 || player.y < t.y - 40 || player.y > t.y + t.h + 40) return false;
      if (wantedStars > 0) {
        needToLosePolice();
        return true;
      }
      // The capsule nearest the bottom of the wheel.
      let best = 0,
        bestGap = Infinity;
      for (let k = 0; k < WHEEL_CAPSULES; k++) {
        const a = wheelCapsule(k, parkScratch).a,
          gap = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
        if (gap < bestGap) {
          bestGap = gap;
          best = k;
        }
      }
      player.coaster = { kind: 'wheel', capsule: best, time: 0, view: 0 };
      announce('SUNSET PIER', 'THE SUNSET EYE', 2.4);
      tell('One turn, four minutes, ' + Math.round(worldMeters(PIER.wheel.hub + WHEEL_CAPSULE_RADIUS + 12)) + ' metres up. ' + keyName('radioPower') + ' / ' + keyName('radioNext') + ' the radio, ' + keyName('interact') + ' at the bottom to step off.', 4);
      return true;
    }
    function updateWheelRide(deltaSeconds) {
      const ride = player.coaster,
        c = wheelCapsule(ride.capsule, parkScratch);
      ride.time += deltaSeconds;
      player.x = c.x;
      player.y = c.y;
      player.altitude = c.z - 6;
      if (ride.time > WHEEL_PERIOD) leaveCoaster();
    }
    // ---- Update, status, interaction -----------------------------------------------
    function updateCoaster(deltaSeconds) {
      player.hidden = !!player.coaster;
      if (gameMode !== 'play') return;
      // Fixed steps: at 180 u/s a long frame would otherwise skip a crest.
      let left = Math.min(0.25, deltaSeconds);
      while (left > 1e-6) {
        const dt = Math.min(1 / 90, left);
        stepCoasterTrain(dt);
        left -= dt;
      }
      const ride = player.coaster;
      if (ride?.kind === 'wheel') updateWheelRide(deltaSeconds);
      else if (ride) {
        const seat = coasterSeat(ride.car, parkScratch);
        ride.time += deltaSeconds;
        player.x = seat.x;
        player.y = seat.y;
        player.altitude = seat.z + 4;
        player.a = Math.atan2(seat.ty, seat.tx);
      }
      updateParkShows(deltaSeconds);
      updateParkCrowd(deltaSeconds);
      updateParkAudio(deltaSeconds);
    }
    function coasterStatusText() {
      const ride = player.coaster;
      if (!ride) return '';
      if (ride.kind === 'wheel')
        return 'THE SUNSET EYE · ' + Math.round(worldMeters(player.altitude)) + ' m · ' + Math.max(0, Math.ceil(WHEEL_PERIOD - ride.time)) + ' s';
      return (
        'THE FALCON · ' +
        Math.round(worldMeters(coasterTrain.speed) * 3.6) +
        ' KM/H · ' +
        Math.round(worldMeters(player.altitude)) +
        ' m'
      );
    }
    function parkInteract() {
      if (player.coaster) {
        const ride = player.coaster;
        if (ride.kind === 'wheel') {
          const a = wheelCapsule(ride.capsule, parkScratch).a,
            gap = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
          if (ride.time > 20 && gap < 0.2) leaveCoaster();
          else ride.view = (ride.view + 1) % 2;
          return true;
        }
        if (!coasterTrain.running) {
          leaveCoaster();
          return true;
        }
        ride.view = (ride.view + 1) % 3;
        return true;
      }
      return boardCoaster() || boardWheel();
    }
    // ---- Shows: the fountain and the fireworks -------------------------------------
    /**
     * The Fountain Lagoon plays a show every game hour after dark (every other
     * hour by day): 42 minutes of music and water on the hour (42 real seconds),
     * one of three choreographies in turn. Fireworks go up from the lagoon and
     * the north shore at nine on two nights in three.
     */
    const parkShow = {
      fountain: null,
      fireworks: false,
      rockets: [],
      launchClock: 0,
    };
    function fountainShowAt(minutes) {
      const hour = Math.floor(minutes / 60) % 24,
        t = minutes % 60,
        night = hour >= 19 || hour < 2;
      if (hour >= 2 && hour < 9) return null;
      if (!night && hour % 2) return null;
      if (t > 42) return null;
      return { t, index: Math.floor(minutes / 60) % 3, bpm: [96, 84, 112][Math.floor(minutes / 60) % 3], night };
    }
    function fireworksTonight(minutes) {
      const day = Math.floor(minutes / 1440),
        hour = (minutes % 1440) / 60;
      return day % 3 !== 1 && hour >= 21 && hour < 21.75;
    }
    function updateParkShows(deltaSeconds) {
      parkShow.fountain = fountainShowAt(worldMinutes);
      parkShow.fireworks = fireworksTonight(worldMinutes);
      // Rockets: launched in salvos while the display lasts, burst at the top.
      if (parkShow.fireworks) {
        parkShow.launchClock -= deltaSeconds;
        if (parkShow.launchClock <= 0) {
          parkShow.launchClock = 0.35 + seededRandom() * 0.9;
          const pads = [
            [PIER.lagoon.x - 120, PIER.lagoon.y],
            [PIER.lagoon.x + 120, PIER.lagoon.y],
            [2600, -7040],
            [3200, -7060],
            [3800, -7030],
          ];
          const salvo = seededRandom() < 0.2 ? 4 : 1;
          for (let i = 0; i < salvo; i++) {
            const [x, y] = randomChoice(pads);
            parkShow.rockets.push({
              x: x + randomBetween(-20, 20),
              y: y + randomBetween(-20, 20),
              z: 4,
              vz: randomBetween(230, 300),
              vx: randomBetween(-18, 18),
              vy: randomBetween(-18, 18),
              burstAt: randomBetween(210, 400),
              hue: seededRandom(),
              style: Math.floor(seededRandom() * 4),
              born: gameTime,
              burst: 0,
            });
            parkFireworkSound('launch', x, y);
          }
        }
      }
      for (let i = parkShow.rockets.length - 1; i >= 0; i--) {
        const r = parkShow.rockets[i];
        if (!r.burst) {
          r.vz -= 40 * deltaSeconds;
          r.x += r.vx * deltaSeconds;
          r.y += r.vy * deltaSeconds;
          r.z += r.vz * deltaSeconds;
          if (r.z >= r.burstAt || r.vz < 40) {
            r.burst = gameTime;
            parkFireworkSound('burst', r.x, r.y, r.z);
          }
        } else if (gameTime - r.burst > 3.2) parkShow.rockets.splice(i, 1);
      }
      if (parkShow.rockets.length > 60) parkShow.rockets.splice(0, parkShow.rockets.length - 60);
    }
    // ---- Colliders -----------------------------------------------------------------
    /**
     * Everything solid in the park as rectangles {x, y, w, h, height}: buildings,
     * ride bases, the Eye's legs and terminal, the lagoon's rim, the coaster's
     * station and its support footings. People test them through parkBlocked
     * (a 128-unit grid), vehicles through addStatic (physics.js).
     */
    let parkSolidList = null,
      parkSolidGrid = null;
    const PARK_CELL = 128;
    function parkSolids() {
      if (parkSolidList) return parkSolidList;
      const list = [],
        box = (x, y, w, h, height, kind) => list.push({ x, y, w, h, height, kind });
      const p = PIER;
      box(p.terminal.x, p.terminal.y, p.terminal.w, p.terminal.h, p.terminal.height, 'eye terminal');
      for (const side of [-1, 1]) box(p.gate.x + side * 77 - 22.5, p.gate.y - 30, 45, 30, 150, 'gate tower');
      for (const [fx, fy] of wheelFeet()) box(fx - 9, fy - 9, 18, 18, p.wheel.hub, 'eye leg');
      box(p.hotel.x - p.hotel.w / 2, p.hotel.y - p.hotel.d / 2, p.hotel.w, p.hotel.d, p.hotel.height, 'hotel');
      box(p.beachClub.x + 150, p.beachClub.y + 10, 180, 50, 36, 'beach club');
      box(p.bumper.x, p.bumper.y, p.bumper.w, p.bumper.h, 34, 'bumper cars');
      box(p.darkRide.x, p.darkRide.y, p.darkRide.w, p.darkRide.h, 58, 'dark ride');
      box(p.foodCourt.x, p.foodCourt.y, p.foodCourt.w, p.foodCourt.h, 30, 'food court');
      box(p.station.x - 70, -6460, 150, 44, 34, 'coaster station');
      for (const r of [p.carousel, p.teacups]) box(r.x - r.r, r.y - r.r, r.r * 2, r.r * 2, 20, 'ride');
      box(p.swing.x - p.swing.r, p.swing.y - p.swing.r, p.swing.r * 2, p.swing.r * 2, 90, 'swing ride');
      box(p.dropTower.x - 22, p.dropTower.y - 22, 44, 44, 300, 'drop tower');
      for (const s of flumeSolids()) list.push(s);
      for (const k of parkKiosks()) box(k.x - k.w / 2, k.y - k.h / 2, k.w, k.h, 18, 'kiosk');
      // The lagoon's rim, as a ring of rectangles round the ellipse.
      const L = p.lagoon;
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU,
          x = L.x + Math.cos(a) * (L.rx - 18),
          y = L.y + Math.sin(a) * (L.ry - 18),
          r = 22 + Math.abs(Math.cos(a)) * 8;
        box(x - r, y - r, r * 2, r * 2, 3, 'lagoon');
      }
      box(L.x - L.rx + 30, L.y - L.ry + 40, (L.rx - 30) * 2, (L.ry - 40) * 2, 3, 'lagoon');
      for (const f of coasterFootings()) box(f.x - 5, f.y - 5, 10, 10, f.height, 'coaster support');
      parkSolidList = list;
      parkSolidGrid = new Map();
      list.forEach((b, i) => {
        for (let cx = Math.floor(b.x / PARK_CELL); cx <= Math.floor((b.x + b.w) / PARK_CELL); cx++)
          for (let cy = Math.floor(b.y / PARK_CELL); cy <= Math.floor((b.y + b.h) / PARK_CELL); cy++) {
            const key = cx * 4096 + cy;
            if (!parkSolidGrid.has(key)) parkSolidGrid.set(key, []);
            parkSolidGrid.get(key).push(i);
          }
      });
      return list;
    }
    function parkBlocked(x, y, r = 0) {
      if (y > -5690 || y < -7100 || x < 1820 || x > 4270) return false;
      if (inLagoon(x, y, r - 4)) return true;
      const list = parkSolids(),
        cell = parkSolidGrid.get(Math.floor(x / PARK_CELL) * 4096 + Math.floor(y / PARK_CELL));
      if (!cell) return false;
      for (const i of cell) {
        const b = list[i];
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      return false;
    }
    /* In the air only (minHeight): the Eye's rim and capsules, the hotel's crown
       and the high parts of the coaster, so a helicopter cannot fly through them. */
    function parkAirSolids() {
      const w = PIER.wheel,
        list = [];
      // The wheel as a stack of slices across the disc.
      for (let z = w.hub - w.r - 30; z < w.hub + w.r + 30; z += 60) {
        const dz = Math.min(w.r + 30, Math.abs(z + 30 - w.hub)),
          half = Math.sqrt(Math.max(0, (w.r + 30) ** 2 - dz * dz));
        list.push({ x: w.x - half, y: w.y - 30, w: half * 2, h: 60, height: z + 60, minHeight: z });
      }
      // The coaster above 90 units: one box per 40 units of track.
      const T = coasterCircuit();
      for (let i = 0; i < T.count; i += 20)
        if (T.Z[i] > 90) list.push({ x: T.X[i] - 14, y: T.Y[i] - 14, w: 28, h: 28, height: T.Z[i] + 20, minHeight: 60 });
      return list;
    }
    /* The Eye's four feet: an A-frame either side of the rim plane. */
    function wheelFeet() {
      const w = PIER.wheel;
      return [
        [w.x - 130, w.y - 82],
        [w.x + 130, w.y - 82],
        [w.x - 130, w.y + 82],
        [w.x + 130, w.y + 82],
      ];
    }
    /* Kiosks, stalls and carts along the promenades (drawn by themepark3d.js). */
    function parkKiosks() {
      return [
        { x: 3050, y: -6180, w: 22, h: 16, kind: 'drinks', a: 0 },
        { x: 3300, y: -6170, w: 22, h: 16, kind: 'icecream', a: 0 },
        { x: 3420, y: -6330, w: 22, h: 16, kind: 'popcorn', a: 0 },
        { x: 2990, y: -6560, w: 22, h: 16, kind: 'dates', a: 0 },
        { x: 3830, y: -6300, w: 22, h: 16, kind: 'candy', a: 0 },
        { x: 3960, y: -6250, w: 60, h: 26, kind: 'games', a: 0 },
        { x: 3960, y: -6200, w: 60, h: 26, kind: 'games', a: 0 },
        { x: 3845, y: -6560, w: 40, h: 26, kind: 'games', a: 0 },
        { x: 2740, y: -6300, w: 22, h: 16, kind: 'drinks', a: 0 },
        { x: 3700, y: -6920, w: 26, h: 18, kind: 'bar', a: 0 },
      ];
    }
    /* Coaster supports: a footing every ~22 units where the track is in the air,
       kept off the paths, the lagoon and the buildings. Where the track is banked
       steeply or upside down the column stands beside it and an arm reaches the
       spine; a column never rises through a lower part of the track. */
    let coasterFootingList = null;
    function coasterFootings() {
      if (coasterFootingList) return coasterFootingList;
      const T = coasterCircuit(),
        list = [],
        f = {};
      for (let i = 0; i < T.count; i += 11) {
        coasterFrame(i * T.ds, f);
        if (f.kind === 1 || Math.abs(f.tz) > 0.75) continue;
        // The spine hangs 3.8 below the rails (above them when inverted).
        const sx = f.x - f.ux * 3.8,
          sy = f.y - f.uy * 3.8,
          sz = f.z - f.uz * 3.8;
        if (sz < 9) continue;
        const h = Math.hypot(f.tx, f.ty) || 1,
          hx = f.tx / h,
          hy = f.ty / h;
        let x = sx,
          y = sy,
          side = false;
        if (f.uz < 0.6) {
          // Beside the track, on the side the spine hangs towards.
          const k = -hy * f.ux + hx * f.uy > 0 ? -1 : 1;
          x = sx - hy * k * 26;
          y = sy + hx * k * 26;
          side = true;
        }
        const top = side ? sz : sz - 1.8;
        if (parkPathNear(x, y, 12) || inLagoon(x, y, 20) || parkBuildingAt(x, y, 12)) continue;
        if (list.some((o) => Math.hypot(o.x - x, o.y - y) < 18)) continue;
        // Nothing of the circuit may pass through the column below its top.
        let clear = true;
        for (let j = 0; j < T.count && clear; j += 2)
          if (Math.abs(j - i) > 12 && Math.abs(T.X[j] - x) < 9 && Math.abs(T.Y[j] - y) < 9 && T.Z[j] < top + 4) clear = false;
        if (!clear) continue;
        list.push({ x, y, height: top, top, side, attach: { x: sx, y: sy, z: sz }, dx: hx, dy: hy });
      }
      coasterFootingList = list;
      return list;
    }
    function inLagoon(x, y, pad = 0) {
      const L = PIER.lagoon;
      return ((x - L.x) / (L.rx + pad)) ** 2 + ((y - L.y) / (L.ry + pad)) ** 2 < 1;
    }
    function parkBuildingAt(x, y, pad = 0) {
      const p = PIER,
        rects = [
          [p.terminal.x, p.terminal.y, p.terminal.w, p.terminal.h],
          [p.hotel.x - p.hotel.w / 2, p.hotel.y - p.hotel.d / 2, p.hotel.w, p.hotel.d],
          [p.station.x - 70, -6460, 150, 44],
          [p.station.x - 70, -6412, 150, 62],
          [p.plaza.x, p.plaza.y, p.plaza.w, p.plaza.h],
        ];
      return rects.some(([rx, ry, rw, rh]) => x > rx - pad && x < rx + rw + pad && y > ry - pad && y < ry + rh + pad);
    }
    // ---- Paths ---------------------------------------------------------------------
    /**
     * The promenades as polylines with a width; painted on the ground tile and
     * joined into a graph the park crowd walks (shared end points are junctions).
     */
    const PARK_PATHS = [
      // Gate plaza to the lagoon, round the lagoon, and on to the hotel.
      { w: 64, points: [[3200, -6040], [3200, -6200]] },
      { w: 40, ring: true },
      { w: 48, points: [[3170, -6535], [3170, -6690], [3530, -6690], [3895, -6690]] },
      // West: past the lagoon to the Falcon's queue and the coaster garden.
      { w: 44, points: [[2930, -6370], [2780, -6370], [2690, -6370]] },
      { w: 36, points: [[3060, -6030], [2900, -6030], [2740, -6110], [2560, -6110], [2430, -6000]] },
      { w: 36, points: [[2780, -6370], [2780, -6110]] },
      // East: under the Eye to the midway.
      { w: 40, points: [[3340, -6030], [3515, -6050]] },
      { w: 44, points: [[3370, -6360], [3620, -6360], [3895, -6360]] },
      { w: 56, points: [[3895, -6150], [3895, -6360], [3895, -6690]] },
      { w: 36, points: [[3780, -6690], [3780, -6860], [3560, -6860]] },
      { w: 36, points: [[3895, -6450], [3985, -6450]] },
    ];
    let parkGraph = null;
    function parkPathSegments() {
      const segs = [];
      const L = PIER.lagoon;
      for (const p of PARK_PATHS) {
        let pts = p.points;
        if (p.ring) {
          pts = [];
          for (let i = 0; i <= 16; i++) {
            const a = (i / 16) * TAU;
            pts.push([Math.round(L.x + Math.cos(a) * (L.rx + 40)), Math.round(L.y + Math.sin(a) * (L.ry + 40))]);
          }
        }
        for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i], w: p.w });
      }
      return segs;
    }
    function parkPathNear(x, y, pad = 0) {
      for (const s of parkPathSegments.cache || (parkPathSegments.cache = parkPathSegments())) {
        const [ax, ay] = s.a,
          [bx, by] = s.b,
          dx = bx - ax,
          dy = by - ay,
          t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        if (Math.hypot(ax + dx * t - x, ay + dy * t - y) < s.w / 2 + pad) return true;
      }
      return false;
    }
    /* Junction graph: every path vertex is a node; the lagoon ring's nodes are
       also joined to the nearest spoke end so the ring connects to the spokes. */
    function parkPathGraph() {
      if (parkGraph) return parkGraph;
      const nodes = [],
        key = (p) => p[0] + ',' + p[1],
        index = new Map(),
        node = (p) => {
          if (!index.has(key(p))) {
            index.set(key(p), nodes.length);
            nodes.push({ x: p[0], y: p[1], links: [] });
          }
          return index.get(key(p));
        };
      const link = (a, b) => {
        if (a === b || nodes[a].links.includes(b)) return;
        nodes[a].links.push(b);
        nodes[b].links.push(a);
      };
      for (const s of parkPathSegments()) link(node(s.a), node(s.b));
      // Join ends that meet a path in the middle, and ring spokes, to their nearest node.
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].links.length > 1) continue;
        let best = -1,
          bestD = 60;
        for (let j = 0; j < nodes.length; j++) {
          if (j === i || nodes[i].links.includes(j)) continue;
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        }
        if (best >= 0) link(i, best);
      }
      parkGraph = nodes;
      return nodes;
    }
    function parkRoute(from, to) {
      const nodes = parkPathGraph(),
        prev = new Map([[from, -1]]),
        queue = [from];
      while (queue.length) {
        const n = queue.shift();
        if (n === to) break;
        for (const m of nodes[n].links)
          if (!prev.has(m)) {
            prev.set(m, n);
            queue.push(m);
          }
      }
      if (!prev.has(to)) return null;
      const route = [];
      for (let n = to; n !== -1; n = prev.get(n)) route.unshift(n);
      return route;
    }
    function nearestParkNode(x, y) {
      const nodes = parkPathGraph();
      let best = 0,
        bestD = Infinity;
      nodes.forEach((n, i) => {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    }
    // ---- The log flume ---------------------------------------------------------------
    /**
     * A trough on stilts round the east end of the island: out from the station
     * by the midway, a lift up to 90, a winding run back down, and the big drop
     * into the splash pool. Boats are points on the closed channel.
     */
    const FLUME_PATH = [
      [3990, -6450, 6],
      [4040, -6420, 6],
      [4120, -6380, 20],
      [4170, -6330, 60],
      [4200, -6290, 90],
      [4220, -6360, 90],
      [4215, -6480, 84],
      [4180, -6620, 78],
      [4100, -6680, 72],
      [4020, -6650, 68],
      [4000, -6590, 66],
      [4040, -6540, 64],
      [4080, -6510, 20],
      [4090, -6490, 6],
      [4060, -6476, 6],
      [4010, -6470, 6],
    ];
    let flumeCache = null;
    function flumeCircuit() {
      if (flumeCache) return flumeCache;
      const pts = [],
        n = FLUME_PATH.length;
      // Catmull-Rom through the control points, sampled every ~4 units.
      for (let i = 0; i < n; i++) {
        const p0 = FLUME_PATH[(i - 1 + n) % n],
          p1 = FLUME_PATH[i],
          p2 = FLUME_PATH[(i + 1) % n],
          p3 = FLUME_PATH[(i + 2) % n],
          steps = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 4));
        for (let k = 0; k < steps; k++) {
          const t = k / steps,
            t2 = t * t,
            t3 = t2 * t,
            c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
          pts.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2], p1[2], p2[2], p3[2])]);
        }
      }
      const cum = [0];
      for (let i = 1; i <= pts.length; i++) {
        const a = pts[i - 1],
          b = pts[i % pts.length];
        cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
      }
      flumeCache = { pts, cum, length: cum[cum.length - 1] };
      return flumeCache;
    }
    function flumePoint(s, out = {}) {
      const F = flumeCircuit(),
        L = F.length;
      s = ((s % L) + L) % L;
      let lo = 0,
        hi = F.pts.length;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (F.cum[mid] <= s) lo = mid;
        else hi = mid;
      }
      const a = F.pts[lo],
        b = F.pts[(lo + 1) % F.pts.length],
        f = (s - F.cum[lo]) / (F.cum[lo + 1] - F.cum[lo] || 1);
      out.x = a[0] + (b[0] - a[0]) * f;
      out.y = a[1] + (b[1] - a[1]) * f;
      out.z = a[2] + (b[2] - a[2]) * f;
      out.a = Math.atan2(b[1] - a[1], b[0] - a[0]);
      out.slope = (b[2] - a[2]) / Math.max(0.1, F.cum[lo + 1] - F.cum[lo]);
      return out;
    }
    /* Boat k's arc length now: the lift and the flats at a steady pace, the drops fast. */
    const FLUME_BOATS = 6;
    function flumeBoat(k, out = {}) {
      const F = flumeCircuit(),
        cycle = 70,
        u = (((gameTime + (k * cycle) / FLUME_BOATS) % cycle) / cycle),
        // Time is spent mostly on the lift and the winding run; the drop is quick.
        s = F.length * (u < 0.9 ? u / 0.9 * 0.93 : 0.93 + ((u - 0.9) / 0.1) * 0.07);
      return flumePoint(s, out);
    }
    function flumeSolids() {
      return FLUME_PATH.filter((p) => p[2] > 12).map((p) => ({ x: p[0] - 6, y: p[1] - 6, w: 12, h: 12, height: p[2], kind: 'flume' }))
        .concat([{ x: 4040, y: -6530, w: 70, h: 44, height: 4, kind: 'flume pool' }]);
    }
    // ---- The island ground -----------------------------------------------------------
    const PARK_TILE = { x: 1792, y: -7168, w: 2560, h: 1536, pixelsPerUnit: 0.64 },
      PARK_CAR_PARK = { x: 3290, y: -5846, w: 520, h: 110 };
    function paintParkIsland(g) {
      g.save();
      g.beginPath();
      SUNSET_ISLE.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = '#7d9a64';
      g.fill();
      g.clip();
      // A sand fringe and a paved sea wall round the island.
      g.lineJoin = 'round';
      g.strokeStyle = '#d8c9a0';
      g.lineWidth = 90;
      g.stroke();
      g.strokeStyle = '#c9c2b0';
      g.lineWidth = 26;
      g.stroke();
      // Lawn texture: mown stripes.
      g.globalAlpha = 0.08;
      g.fillStyle = '#e8f0d0';
      for (let x = 1792; x < 4352; x += 36) g.fillRect(x, -7168, 18, 1536);
      g.globalAlpha = 1;
      // Beach club sand and pool deck on the north shore.
      const bc = PIER.beachClub;
      g.fillStyle = '#e2d3a8';
      g.fillRect(bc.x - 40, bc.y - 60, bc.w + 80, bc.h + 60);
      g.fillStyle = '#efe7d6';
      g.fillRect(bc.x, bc.y + 60, bc.w, 90);
      // Car park and bus bay by the bridge.
      const lot = PARK_CAR_PARK;
      g.fillStyle = '#4b5458';
      g.fillRect(lot.x, lot.y, lot.w, lot.h);
      g.fillStyle = '#d6d3c4';
      for (let x = lot.x + 8; x < lot.x + lot.w - 8; x += 26) {
        g.fillRect(x, lot.y + 4, 2, 38);
        g.fillRect(x, lot.y + lot.h - 42, 2, 38);
      }
      g.fillStyle = '#c7ba8e';
      g.fillRect(3246, -5856, 44, 30);
      g.fillStyle = '#e8d24a';
      g.font = 'bold 10px monospace';
      g.fillText('BUS', 3256, -5836);
      g.restore();
      paintCountyRoads(g, true);
      drawBridgeGround(g);
      paintSunsetPier(g);
    }
    /* Paving, the lagoon, ride pads, flower beds and labels. */
    function paintSunsetPier(g) {
      g.save();
      g.beginPath();
      SUNSET_ISLE.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.clip();
      const p = PIER;
      // Gate plaza: a star pattern in two stones.
      g.fillStyle = '#e4d8bd';
      g.fillRect(p.plaza.x, p.plaza.y, p.plaza.w, p.plaza.h);
      g.strokeStyle = '#c8b58c';
      g.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.beginPath();
        g.moveTo(p.gate.x, p.gate.y - 20);
        g.lineTo(p.gate.x + Math.cos(a) * 70, p.gate.y - 20 + Math.sin(a) * 60);
        g.stroke();
      }
      // Promenades: light stone with a darker border and a tile grid.
      for (const s of parkPathSegments()) {
        for (const [color, extra] of [
          ['#b9a988', 6],
          ['#e6dcc4', 0],
        ]) {
          g.strokeStyle = color;
          g.lineWidth = s.w + extra;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(...s.a);
          g.lineTo(...s.b);
          g.stroke();
        }
      }
      g.strokeStyle = '#d3c6a8';
      g.lineWidth = 1;
      for (const s of parkPathSegments()) {
        const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]),
          nx = (s.b[0] - s.a[0]) / len,
          ny = (s.b[1] - s.a[1]) / len;
        for (let d = 0; d < len; d += 12) {
          const x = s.a[0] + nx * d,
            y = s.a[1] + ny * d;
          g.beginPath();
          g.moveTo(x - ny * s.w * 0.45, y + nx * s.w * 0.45);
          g.lineTo(x + ny * s.w * 0.45, y - nx * s.w * 0.45);
          g.stroke();
        }
      }
      // The lagoon bed (the water itself is a mesh) with a stone coping.
      const L = p.lagoon;
      g.fillStyle = '#d9cfb7';
      g.beginPath();
      g.ellipse(L.x, L.y, L.rx + 10, L.ry + 10, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#2d5a66';
      g.beginPath();
      g.ellipse(L.x, L.y, L.rx, L.ry, 0, 0, TAU);
      g.fill();
      // Ride pads and building plots.
      g.fillStyle = '#cfc6b4';
      for (const r of [p.carousel, p.teacups]) {
        g.beginPath();
        g.arc(r.x, r.y, r.r + 10, 0, TAU);
        g.fill();
      }
      g.beginPath();
      g.arc(p.swing.x, p.swing.y, p.swing.reach + 8, 0, TAU);
      g.fill();
      g.fillStyle = '#bfb5a0';
      for (const b of [p.bumper, p.darkRide, p.foodCourt]) g.fillRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
      g.fillRect(p.terminal.x - 10, p.terminal.y - 10, p.terminal.w + 20, p.terminal.h + 20);
      g.fillRect(p.hotel.x - p.hotel.w / 2 - 20, p.hotel.y - p.hotel.d / 2 - 20, p.hotel.w + 40, p.hotel.d + 60);
      g.fillRect(p.station.x - 80, -6468, 170, 130);
      // Flower beds: red and gold ribbons in the lawns by the gate and the lagoon.
      const bed = (x, y, w, h, c) => {
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(x, y, w, h, 0, 0, TAU);
        g.fill();
      };
      for (const [x, y] of [
        [3000, -5990],
        [3400, -5990],
        [2950, -6230],
        [3390, -6230],
        [3050, -6580],
        [3290, -6580],
      ]) {
        bed(x, y, 36, 14, '#5f7f45');
        bed(x, y, 30, 10, '#8f5a4a');
        for (let k = 0; k < 14; k++) bed(x - 26 + k * 4, y + Math.sin(k) * 4, 2.2, 2.2, k % 2 ? '#d8a23a' : '#c05a48');
      }
      // Map labels (the 2D view and the city map).
      g.fillStyle = '#5a4a2c';
      g.font = 'bold 26px monospace';
      g.textAlign = 'center';
      g.fillText('SUNSET PIER', p.gate.x, -5965);
      g.font = 'bold 14px monospace';
      g.fillText('THE FALCON', p.station.x, -6480);
      g.fillText('SUNSET EYE', p.wheel.x, p.wheel.y + 4);
      g.fillText('FOUNTAIN LAGOON', L.x, L.y + 5);
      g.fillText('SUNSET PALACE', p.hotel.x, p.hotel.y + 5);
      g.fillText('BEACH CLUB', p.beachClub.x + p.beachClub.w / 2, p.beachClub.y + 40);
      g.fillText('LOG FLUME', 4100, -6560);
      g.restore();
    }
    function buildSunsetPier() {
      const t = PARK_TILE,
        canvas = document.createElement('canvas');
      canvas.width = Math.round(t.w * t.pixelsPerUnit);
      canvas.height = Math.round(t.h * t.pixelsPerUnit);
      const g = canvas.getContext('2d');
      g.scale(t.pixelsPerUnit, t.pixelsPerUnit);
      g.translate(-t.x, -t.y);
      paintParkIsland(g);
      countyGroundTiles.push({ x: t.x, y: t.y, w: t.w, h: t.h, canvas });
      // The palms are the park's own (themepark3d.js); no generic trees here.
      for (let i = trees.length - 1; i >= 0; i--) if (onSunsetIsle(trees[i].x, trees[i].y)) trees.splice(i, 1);
    }
    /* Palm positions along the promenades and round the lagoon (drawn as instances). */
    let parkPalmList = null;
    function parkPalms() {
      if (parkPalmList) return parkPalmList;
      const list = [],
        L = PIER.lagoon,
        ok = (x, y) =>
          onSunsetIsle(x, y) &&
          !parkBlocked(x, y, 14) &&
          !parkPathNear(x, y, 4) &&
          !inLagoon(x, y, 16) &&
          !parkBuildingAt(x, y, 16) &&
          !coasterNear(x, y, 22) &&
          list.every((p) => Math.hypot(p.x - x, p.y - y) > 26);
      const add = (x, y, s) => ok(x, y) && list.push({ x, y, s: s ?? 0.9 + ((x * 7 + y * 13) % 7) / 14 });
      // Twin rows along every promenade.
      for (const s of parkPathSegments()) {
        const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]),
          nx = (s.b[0] - s.a[0]) / len,
          ny = (s.b[1] - s.a[1]) / len;
        for (let d = 20; d < len; d += 46)
          for (const side of [-1, 1]) add(s.a[0] + nx * d - ny * side * (s.w / 2 + 12), s.a[1] + ny * d + nx * side * (s.w / 2 + 12));
      }
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        add(L.x + Math.cos(a) * (L.rx + 88), L.y + Math.sin(a) * (L.ry + 88), 1.15);
      }
      // Groves in the coaster garden and along the shore.
      for (let i = 0; i < 160; i++) {
        const x = 1900 + ((i * 97.3) % 2300),
          y = -7040 + ((i * 61.7) % 1300);
        add(x, y);
      }
      parkPalmList = list;
      return list;
    }
    function coasterNear(x, y, pad) {
      const T = coasterCircuit();
      for (let i = 0; i < T.count; i += 4) if (Math.abs(T.X[i] - x) < pad && Math.abs(T.Y[i] - y) < pad && T.Z[i] < 140) return true;
      return false;
    }
    // ---- The park crowd --------------------------------------------------------------
    /**
     * Guests are ordinary pedestrians (drawn by the instanced crowd) flagged
     * `parkGuest`: they walk the promenade graph from attraction to attraction,
     * stop to watch, and stand in the queues for the Falcon, the Eye and the
     * flume, which move up when a train or a capsule takes the front of the line.
     * They are only on the island while the player is near it.
     */
    const PARK_LINES = [
      'One more go on the Falcon.',
      'I am not going on that.',
      'Look at the Eye, it goes up forever.',
      'The fountain show starts on the hour.',
      'Hold my phone.',
      'You can see the whole city from the top.',
      'Three tickets left.',
      'I felt my stomach leave.',
      'Best shawarma on the coast.',
      'Meet by the carousel at six.',
      'Did you hear them scream?',
      'The hotel has a pool on the roof.',
    ];
    const PARK_SPOTS = [
      { name: 'coaster', x: 2700, y: -6360 },
      { name: 'lagoon', x: 3170, y: -6205 },
      { name: 'lagoon', x: 3380, y: -6400 },
      { name: 'lagoon', x: 2960, y: -6400 },
      { name: 'eye', x: 3500, y: -6040 },
      { name: 'carousel', x: 3500, y: -6350 },
      { name: 'swing', x: 3700, y: -6350 },
      { name: 'dark', x: 3720, y: -6370 },
      { name: 'bumper', x: 3480, y: -6370 },
      { name: 'flume', x: 3960, y: -6450 },
      { name: 'midway', x: 3895, y: -6250 },
      { name: 'food', x: 3700, y: -6690 },
      { name: 'hotel', x: 3450, y: -6690 },
      { name: 'beach', x: 3600, y: -6860 },
      { name: 'garden', x: 2560, y: -6110 },
      { name: 'gate', x: 3200, y: -6060 },
    ];
    /* Queue lines: slots from the front of the line back. */
    const PARK_QUEUES = {
      coaster: { slots: queueSlots([[2610, -6395], [2510, -6395], [2510, -6380], [2640, -6380], [2640, -6365], [2690, -6365]], 7) },
      eye: { slots: queueSlots([[3520, -6050], [3440, -6050], [3440, -6035], [3380, -6035]], 7) },
      flume: { slots: queueSlots([[3995, -6450], [3950, -6450], [3950, -6435], [3920, -6435]], 7) },
    };
    function queueSlots(points, gap) {
      const slots = [];
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1],
          [bx, by] = points[i],
          len = Math.hypot(bx - ax, by - ay),
          heading = Math.atan2(ay - by, ax - bx);
        for (let d = 0; d < len; d += gap) slots.push({ x: ax + ((bx - ax) * d) / len, y: ay + ((by - ay) * d) / len, a: heading });
      }
      return slots;
    }
    let parkCrowdLive = false,
      parkCrowdClock = 0;
    const PARK_CENTER = { x: 3050, y: -6380 };
    function parkGuestTarget() {
      const hour = (worldMinutes % 1440) / 60;
      if (hour < 7) return 24;
      if (hour < 10) return 70;
      return 140;
    }
    function spawnParkGuest(x, y, queue) {
      const p = {
        x,
        y,
        a: randomBetween(0, TAU),
        hp: 30,
        color: randomChoice(DRIVER_COLORS),
        flee: 0,
        timer: randomBetween(1, 7),
        walk: seededRandom() * 5,
        state: 'walk',
        parkGuest: true,
        role: seededRandom() < 0.18 ? 'kid' : 'casual',
      };
      if (queue) {
        p.parkQueue = queue;
        p.walking = false;
      }
      pedestrians.push(p);
      return p;
    }
    function updateParkCrowd(deltaSeconds) {
      parkCrowdClock -= deltaSeconds;
      if (parkCrowdClock > 0) return;
      parkCrowdClock = 1.5;
      const near = Math.hypot(player.x - PARK_CENTER.x, player.y - PARK_CENTER.y) < 2900;
      if (!near) {
        if (parkCrowdLive) {
          for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].parkGuest) pedestrians.splice(i, 1);
          parkCrowdLive = false;
        }
        return;
      }
      const guests = pedestrians.filter((p) => p.parkGuest && p.hp > 0),
        target = parkGuestTarget();
      if (!parkCrowdLive) {
        parkCrowdLive = true;
        // Fill the queues first, then the promenades.
        for (const [name, q] of Object.entries(PARK_QUEUES)) {
          const filled = Math.floor(q.slots.length * (target > 60 ? 0.85 : 0.3));
          for (let i = 0; i < filled; i++) {
            const s = q.slots[i],
              p = spawnParkGuest(s.x + randomBetween(-1.5, 1.5), s.y + randomBetween(-1.5, 1.5), name);
            p.queueSlot = i;
            p.a = s.a;
          }
        }
        const nodes = parkPathGraph();
        for (let i = 0; i < target; i++) {
          const n = nodes[Math.floor(seededRandom() * nodes.length)],
            m = nodes[n.links[0] ?? 0],
            f = seededRandom(),
            x = n.x + (m.x - n.x) * f + randomBetween(-10, 10),
            y = n.y + (m.y - n.y) * f + randomBetween(-10, 10);
          if (!parkBlocked(x, y, 6)) spawnParkGuest(x, y);
        }
        return;
      }
      // Top up gently from the gate and the bus stop.
      if (guests.length < target + 20 && seededRandom() < 0.6) spawnParkGuest(PIER.gate.x + randomBetween(-40, 40), -6050);
    }
    /* A ride takes (n > 0) or returns (n < 0) riders: the queue moves up. */
    function parkCrowdBoard(name, n) {
      const q = PARK_QUEUES[name];
      if (!q || !parkCrowdLive || n < 0) return;
      const inLine = pedestrians.filter((p) => p.parkQueue === name).sort((a, b) => a.queueSlot - b.queueSlot);
      inLine.forEach((p, i) => {
        if (i < n) {
          // Off to ride: they leave the line and wander off afterwards.
          p.parkQueue = null;
          p.queueSlot = null;
          p.x = PIER.station.x + randomBetween(-30, 30);
          p.y = PIER.station.y + 60;
          p.parkGoal = null;
          p.timer = 0;
        } else p.queueSlot = i - n;
      });
    }
    function updateParkGuest(person, deltaSeconds) {
      if (!person.parkGuest || person.flee > 0 || person.hp <= 0) {
        if (person.parkGuest && person.parkQueue) person.parkQueue = null;
        return false;
      }
      if (person.parkQueue) {
        // Shuffle up to the slot, then stand facing the front of the line.
        const q = PARK_QUEUES[person.parkQueue],
          slot = q.slots[Math.min(q.slots.length - 1, person.queueSlot)],
          d = Math.hypot(slot.x - person.x, slot.y - person.y);
        if (d > 2) {
          person.a = Math.atan2(slot.y - person.y, slot.x - person.x);
          person.walking = true;
          person.walk += deltaSeconds * 5;
          const step = Math.min(d, 18 * deltaSeconds);
          person.x += Math.cos(person.a) * step;
          person.y += Math.sin(person.a) * step;
        } else {
          person.walking = false;
          person.a = slot.a + Math.sin(gameTime * 0.3 + person.walk) * 0.4;
        }
        if ((person.speechUntil || 0) <= gameTime && seededRandom() < deltaSeconds * 0.01) {
          person.speech = randomChoice(['Is it always this long?', 'Nearly there.', 'Front row!', 'I can hear them screaming.']);
          person.speechUntil = gameTime + 3;
        }
        return true;
      }
      person.timer -= deltaSeconds;
      if (!person.parkRoute || person.timer <= 0) {
        if (person.parkRoute && person.parkRoute.length) {
          // still walking
        } else {
          person.timer = 4 + seededRandom() * 10;
          // Now and then join a queue; otherwise pick an attraction to walk to.
          const q = seededRandom() < 0.12 ? randomChoice(Object.keys(PARK_QUEUES)) : null;
          if (q) {
            const taken = pedestrians.filter((p) => p.parkQueue === q).length;
            if (taken < PARK_QUEUES[q].slots.length) {
              person.parkQueue = q;
              person.queueSlot = taken;
              return true;
            }
          }
          const spot = randomChoice(PARK_SPOTS),
            route = parkRoute(nearestParkNode(person.x, person.y), nearestParkNode(spot.x, spot.y));
          person.parkRoute = route ? route.map((i) => parkPathGraph()[i]).map((n) => ({ x: n.x + randomBetween(-12, 12), y: n.y + randomBetween(-12, 12) })) : [];
          person.parkRoute.push({ x: spot.x + randomBetween(-20, 20), y: spot.y + randomBetween(-16, 16), linger: true });
          if ((person.speechUntil || 0) <= gameTime && seededRandom() < 0.25) {
            person.speech = randomChoice(PARK_LINES);
            person.speechUntil = gameTime + 3;
          }
        }
      }
      const goal = person.parkRoute?.[0];
      if (!goal) {
        person.walking = false;
        return true;
      }
      if (Math.hypot(goal.x - person.x, goal.y - person.y) < 8) {
        person.parkRoute.shift();
        if (goal.linger) {
          person.walking = false;
          person.parkRoute = null;
          person.timer = 3 + seededRandom() * 9;
          // Look at whatever they came for.
          person.a += randomBetween(-1, 1);
        }
        return true;
      }
      person.a = headingBetween(person, goal);
      person.walking = true;
      person.walk += deltaSeconds * 6;
      if (moveBody(person, Math.cos(person.a) * 4.5 * KMH * deltaSeconds, Math.sin(person.a) * 4.5 * KMH * deltaSeconds, 5)) {
        person.stuck = (person.stuck || 0) + deltaSeconds;
        if (person.stuck > 2) {
          person.parkRoute = null;
          person.stuck = 0;
        }
      }
      return true;
    }
    function populateSunsetPier() {
      // Guests arrive with the player (updateParkCrowd); nothing to do at world build.
      parkCrowdLive = false;
    }
    // ---- Park sound ------------------------------------------------------------------
    /**
     * All procedural (Web Audio): the fountain show's music (a plucked oud-like
     * line in the Hijaz mode over a drone and a frame drum, scheduled ahead on
     * the audio clock), the train's roar and the lift chain's clatter, riders'
     * screams (detuned voices through vowel formants, pitch swooping) and the
     * fireworks (a whistle up, a boom delayed by the distance, crackle).
     */
    const parkAudio = { bus: null, roar: null, nextNote: 0, step: 0, screamAt: 0, clackAt: 0 };
    function parkAudioBus() {
      if (!audio || !master) return null;
      if (parkAudio.bus) return parkAudio.bus;
      const bus = audio.createGain();
      bus.gain.value = 1;
      bus.connect(master);
      parkAudio.bus = bus;
      // Train roar: looping noise through a low-pass; gain follows speed and distance.
      const n = audio.sampleRate * 2,
        buffer = audio.createBuffer(1, n, audio.sampleRate),
        d = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) {
        last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
        d[i] = last * 6;
      }
      const src = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        gain = audio.createGain();
      src.buffer = buffer;
      src.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(bus);
      src.start();
      parkAudio.roar = { filter, gain };
      return bus;
    }
    function parkDistanceGain(x, y, reach = 400) {
      return 1 / (1 + Math.hypot(x - player.x, y - player.y) / reach);
    }
    function parkScream(x, y, loud = 1) {
      const bus = parkAudioBus();
      if (!bus || !voicesOn) return;
      const g0 = parkDistanceGain(x, y, 260) * loud;
      if (g0 < 0.03) return;
      const t = audio.currentTime,
        dur = randomBetween(0.9, 1.8),
        voices = 2 + Math.floor(seededRandom() * 3),
        out = audio.createGain(),
        pan = audio.createStereoPanner();
      pan.pan.value = clamp((x - player.x) / 450, -0.9, 0.9);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.09 * g0, t + 0.12);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      out.connect(pan).connect(bus);
      for (let v = 0; v < voices; v++) {
        const o = audio.createOscillator(),
          vib = audio.createOscillator(),
          vibGain = audio.createGain(),
          f1 = audio.createBiquadFilter(),
          f2 = audio.createBiquadFilter(),
          mix = audio.createGain(),
          base = randomBetween(520, 980);
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(base * 0.8, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.25, t + dur * 0.3);
        o.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur);
        vib.frequency.value = randomBetween(5, 8);
        vibGain.gain.value = base * 0.03;
        vib.connect(vibGain).connect(o.frequency);
        // "Aah": formants near 900 and 1400 Hz.
        f1.type = 'bandpass';
        f1.frequency.value = 900;
        f1.Q.value = 6;
        f2.type = 'bandpass';
        f2.frequency.value = 1450;
        f2.Q.value = 8;
        mix.gain.value = 0.5;
        o.connect(f1).connect(mix);
        o.connect(f2).connect(mix);
        mix.connect(out);
        o.start(t);
        vib.start(t);
        o.stop(t + dur + 0.05);
        vib.stop(t + dur + 0.05);
      }
    }
    // Hijaz on D: D Eb F# G A Bb C D.
    const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12];
    const FOUNTAIN_TUNES = [
      [0, 2, 3, 4, 3, 2, 1, 0, 4, 5, 6, 7, 6, 4, 3, 2],
      [7, 6, 4, 5, 4, 3, 2, 3, 1, 2, 3, 4, 2, 1, 0, 0],
      [0, 0, 4, 3, 4, 5, 4, 3, 2, 3, 4, 7, 6, 5, 4, 2],
    ];
    function parkNote(time, freq, dur, gain, type = 'triangle', cutoff = 2400) {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        f = audio.createBiquadFilter();
      o.type = type;
      o.frequency.value = freq;
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(f).connect(g).connect(parkAudio.bus);
      o.start(time);
      o.stop(time + dur + 0.05);
    }
    function parkDrum(time, gain, low) {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.frequency.setValueAtTime(low ? 90 : 220, time);
      o.frequency.exponentialRampToValueAtTime(low ? 45 : 120, time + 0.15);
      g.gain.setValueAtTime(gain, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + (low ? 0.35 : 0.12));
      o.connect(g).connect(parkAudio.bus);
      o.start(time);
      o.stop(time + 0.4);
    }
    function updateFountainMusic() {
      const show = parkShow.fountain,
        L = PIER.lagoon,
        level = parkDistanceGain(L.x, L.y, 350);
      if (!show || level < 0.08) {
        parkAudio.nextNote = 0;
        return;
      }
      const beat = 60 / show.bpm,
        now = audio.currentTime;
      if (parkAudio.nextNote < now) {
        parkAudio.nextNote = now + 0.05;
        parkAudio.step = Math.floor(show.t / beat);
      }
      const tune = FOUNTAIN_TUNES[show.index],
        root = [146.83, 130.81, 164.81][show.index];
      while (parkAudio.nextNote < now + 0.3) {
        const step = parkAudio.step++,
          t = parkAudio.nextNote,
          degree = tune[step % tune.length],
          f = root * Math.pow(2, HIJAZ[degree] / 12);
        // Oud-like pluck an octave up, the drone on the bar, the drum on the beat.
        parkNote(t, f * 2, beat * 0.9, 0.08 * level, 'triangle', 2600);
        if (step % 2 === 1) parkNote(t + beat / 2, f * 3, beat * 0.4, 0.03 * level, 'sine', 3000);
        if (step % 8 === 0) {
          parkNote(t, root / 2, beat * 8, 0.05 * level, 'sawtooth', 500);
          parkNote(t, (root * 3) / 4, beat * 8, 0.025 * level, 'sawtooth', 600);
        }
        parkDrum(t, (step % 4 === 0 ? 0.22 : 0.1) * level, step % 4 === 0);
        if (step % 4 === 3) parkDrum(t + beat / 2, 0.06 * level, false);
        parkAudio.nextNote += beat;
      }
    }
    function parkFireworkSound(kind, x, y, z = 0) {
      const bus = parkAudioBus();
      if (!bus) return;
      const gain = parkDistanceGain(x, y, 700);
      if (gain < 0.04) return;
      // Sound travels 1760 units a second: the boom follows the flash.
      const t = audio.currentTime + Math.hypot(x - player.x, y - player.y, z) / 1760;
      if (kind === 'launch') {
        const o = audio.createOscillator(),
          g = audio.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(900, t);
        o.frequency.exponentialRampToValueAtTime(2600, t + 1.4);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.025 * gain, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + 1.6);
        return;
      }
      parkDrum(t, 0.6 * gain, true);
      const n = Math.floor(audio.sampleRate * 1.2),
        b = audio.createBuffer(1, n, audio.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const k = i / n;
        // A dull boom then scattered crackle.
        d[i] = (Math.random() * 2 - 1) * (Math.exp(-k * 18) + (Math.random() < 0.004 ? 0.8 : 0) * (1 - k));
      }
      const s = audio.createBufferSource(),
        g = audio.createGain(),
        f = audio.createBiquadFilter();
      s.buffer = b;
      f.type = 'lowpass';
      f.frequency.value = 1800;
      g.gain.value = 0.35 * gain;
      s.connect(f).connect(g).connect(bus);
      s.start(t);
    }
    function parkSplashSound(x, y) {
      const bus = parkAudioBus();
      if (!bus) return;
      const gain = parkDistanceGain(x, y, 250);
      if (gain < 0.05) return;
      const n = Math.floor(audio.sampleRate * 1.4),
        b = audio.createBuffer(1, n, audio.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
      const s = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        g = audio.createGain();
      s.buffer = b;
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 0.6;
      g.gain.value = 0.5 * gain;
      s.connect(f).connect(g).connect(bus);
      s.start();
      if (seededRandom() < 0.7) parkScream(x, y, 0.8);
    }
    function updateParkAudio(deltaSeconds) {
      if (!audio || !soundOn) return;
      const near = Math.hypot(player.x - PARK_CENTER.x, player.y - PARK_CENTER.y) < 2400;
      if (!near && !parkAudio.bus) return;
      if (!parkAudioBus()) return;
      const riding = player.coaster?.kind === 'train',
        front = coasterSeat(0, parkScratch),
        speed = coasterTrain.running ? coasterTrain.speed : 0,
        level = riding ? 0.5 : parkDistanceGain(front.x, front.y, 300);
      // The roar: rumble of wheels on steel, brighter with speed.
      const roar = parkAudio.roar;
      glideParam(roar.gain.gain, near ? clamp(speed / 180, 0, 1) * 0.5 * level : 0, audio.currentTime, 0.1);
      glideParam(roar.filter.frequency, 200 + speed * 6, audio.currentTime, 0.1);
      // The lift chain's anti-rollback clack.
      if (coasterTrain.running && front.kind === 2 && gameTime > parkAudio.clackAt && level > 0.05) {
        parkAudio.clackAt = gameTime + 0.16;
        parkNote(audio.currentTime, 1800, 0.03, 0.05 * level, 'square', 4000);
      }
      // Screams on the drops, through the inversions and at speed.
      if (coasterTrain.running && speed > 110 && gameTime > parkAudio.screamAt) {
        const falling = (coasterTrain.lastRise || 0) < -0.3,
          inverted = front.uz < 0;
        if (falling || inverted || seededRandom() < 0.3) {
          parkAudio.screamAt = gameTime + randomBetween(0.5, 1.4);
          parkScream(front.x, front.y, riding ? 0.7 : 1);
        }
      }
      if (near) updateFountainMusic();
    }
    /* DeadEndCity.ride('coaster' | 'wheel'): walk the player to the ride and board it. */
    function rideAttraction(kind) {
      // A test may call this from the air: set the aircraft down where it is first.
      const craft = player.car;
      if (craft && isAircraft(craft)) {
        craft.altitude = terrainHeight(craft.x, craft.y);
        craft.vx = craft.vy = craft.speed = 0;
      }
      if (kind === 'wheel') {
        teleportPlayer(PIER.terminal.x - 10, PIER.wheel.y);
        return boardWheel();
      }
      teleportPlayer(PIER.station.x, PIER.station.y + 40);
      coasterTrain.running = false;
      coasterTrain.t = COASTER_STOP;
      coasterTrain.dwell = 1;
      return boardCoaster();
    }
    // The Falcon's height and top speed as a rider is told them (from the circuit itself).
    function coasterBanner() {
      const T = coasterCircuit();
      let maxZ = 0,
        maxV = 0;
      for (let i = 0; i < T.count; i++) {
        maxZ = Math.max(maxZ, T.Z[i]);
        maxV = Math.max(maxV, T.speed[i]);
      }
      return Math.round(worldMeters(maxZ)) + ' metres, ' + Math.round(speedKmh(maxV)) + ' km/h';
    }
    // ---- Console report --------------------------------------------------------------
    /* DeadEndCity.park(): ride states, coaster numbers and an overlap self-check. */
    function parkReport() {
      const T = coasterCircuit();
      let maxZ = 0,
        maxV = 0;
      for (let i = 0; i < T.count; i++) {
        maxZ = Math.max(maxZ, T.Z[i]);
        maxV = Math.max(maxV, T.speed[i]);
      }
      const solids = parkSolids(),
        overlaps = [];
      for (let i = 0; i < solids.length; i++)
        for (let j = i + 1; j < solids.length; j++) {
          const a = solids[i],
            b = solids[j];
          if (a.kind === b.kind && (a.kind === 'lagoon' || a.kind === 'flume')) continue;
          if (a.kind.startsWith('flume') && b.kind.startsWith('flume')) continue;
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
            overlaps.push(a.kind + ' x ' + b.kind + ' at ' + Math.round(a.x) + ',' + Math.round(a.y));
        }
      for (const s of solids) {
        if (s.kind === 'lagoon' || s.kind === 'coaster support' || s.kind === 'flume') continue;
        if (parkPathNear(s.x + s.w / 2, s.y + s.h / 2, -4) && s.w < 60) overlaps.push(s.kind + ' on a path at ' + Math.round(s.x) + ',' + Math.round(s.y));
        if (!onSunsetIsle(s.x + s.w / 2, s.y + s.h / 2)) overlaps.push(s.kind + ' off the island at ' + Math.round(s.x) + ',' + Math.round(s.y));
      }
      return {
        coaster: {
          length: Math.round(worldMeters(T.length)) + ' m',
          height: Math.round(worldMeters(maxZ)) + ' m',
          topSpeed: Math.round(worldMeters(maxV) * 3.6) + ' km/h',
          supports: coasterFootings().length,
          train: { t: Math.round(coasterTrain.t), speed: Math.round(coasterTrain.speed), running: coasterTrain.running, dwell: +coasterTrain.dwell.toFixed(1) },
        },
        wheel: { height: Math.round(worldMeters(PIER.wheel.hub + WHEEL_CAPSULE_RADIUS + 12)) + ' m', capsules: WHEEL_CAPSULES, angle: +(wheelAngle() % TAU).toFixed(2) },
        riding: player.coaster ? { kind: player.coaster.kind, view: player.coaster.view, altitude: Math.round(player.altitude) } : null,
        fountain: parkShow.fountain,
        fireworks: parkShow.fireworks,
        rockets: parkShow.rockets.length,
        guests: pedestrians.filter((p) => p.parkGuest).length,
        queued: pedestrians.filter((p) => p.parkQueue).length,
        palms: parkPalms().length,
        solids: solids.length,
        overlaps,
      };
    }
    // END SUBSYSTEM: src/themepark.js
