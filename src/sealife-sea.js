    // The sea field: distance to land, steering, viewer, hour and events for sea life (seaField, seaSteer).
    /**
     * THE SEA FIELD
     * A coarse distance-to-land field (SEA_FIELD_CELL units a cell) over the
     * world box, built a slice per frame the first time sea life needs it (no
     * hitch at boot) with a two-pass chamfer transform. `seaDistance(x, y)` is
     * how far a point is from the nearest land in map units (0 on land, large
     * outside the box: the open ocean). Harbour basins and berths are "no go"
     * for dolphins and the shark (`seaNoGo`), whatever their depth.
     *
     * WHERE THINGS ARE
     * Heights are three.js elevations: the calm sea stands at SEA_SURFACE (the
     * water mesh, world3d.js); a dolphin's `z` is its centre, under the
     * surface while it cruises and above it in a leap.
     */
    const SEA_SURFACE = -3.1,
      SEA_FIELD_CELL = 64,
      // Open water for a pod of dolphins (m from land, in map units).
      DOLPHIN_WATER = 150,
      // Deep water the shark keeps to while it patrols.
      SHARK_WATER = 380,
      // A swimmer this far from land, and outside the beach's buoy line, is in
      // the shark's water.
      SHARK_DEEP_SWIM = 240,
      SHARK_BUOY_CLEAR = 230,
      // Seconds between one encounter (escaped or not) and the next.
      SHARK_COOLDOWN = 480,
      SHARK_LENGTH = 5 * UNITS_PER_METRE,
      DOLPHIN_LENGTH = 2.6 * UNITS_PER_METRE,
      GULL_POOL = 60;
    const seaField = { state: 'idle', cols: 0, rows: 0, dist: null, next: 0 };
    function seaFieldStep(budget = 9000) {
      const f = seaField;
      if (f.state === 'ready') return true;
      if (f.state === 'idle') {
        f.cols = Math.ceil(WORLD_WIDTH / SEA_FIELD_CELL);
        f.rows = Math.ceil(WORLD_HEIGHT / SEA_FIELD_CELL);
        f.dist = new Float32Array(f.cols * f.rows);
        f.next = 0;
        f.state = 'sampling';
      }
      const n = f.cols * f.rows,
        far = 1e6;
      if (f.state === 'sampling') {
        const end = Math.min(n, f.next + budget);
        for (let i = f.next; i < end; i++) {
          const col = i % f.cols,
            row = (i / f.cols) | 0,
            x = WORLD_LEFT + (col + 0.5) * SEA_FIELD_CELL,
            y = WORLD_TOP + (row + 0.5) * SEA_FIELD_CELL,
            h = SEA_FIELD_CELL * 0.3;
          // The centre and four inner points: a thin spit still counts as land.
          const land = landAt(x, y) || landAt(x - h, y - h) || landAt(x + h, y - h) || landAt(x - h, y + h) || landAt(x + h, y + h);
          f.dist[i] = land ? 0 : far;
        }
        f.next = end;
        if (end < n) return false;
        // Two-pass chamfer (3-4) in cell units.
        const d = f.dist,
          C = f.cols,
          relax = (i, j, cost) => {
            if (d[j] + cost < d[i]) d[i] = d[j] + cost;
          };
        for (let r = 0; r < f.rows; r++)
          for (let c = 0; c < C; c++) {
            const i = r * C + c;
            if (c > 0) relax(i, i - 1, 3);
            if (r > 0) {
              relax(i, i - C, 3);
              if (c > 0) relax(i, i - C - 1, 4);
              if (c < C - 1) relax(i, i - C + 1, 4);
            }
          }
        for (let r = f.rows - 1; r >= 0; r--)
          for (let c = C - 1; c >= 0; c--) {
            const i = r * C + c;
            if (c < C - 1) relax(i, i + 1, 3);
            if (r < f.rows - 1) {
              relax(i, i + C, 3);
              if (c < C - 1) relax(i, i + C + 1, 4);
              if (c > 0) relax(i, i + C - 1, 4);
            }
          }
        // To map units, less half a cell (the samples stand at cell centres).
        for (let i = 0; i < n; i++) d[i] = d[i] ? Math.max(0, (d[i] / 3) * SEA_FIELD_CELL - SEA_FIELD_CELL * 0.5) : 0;
        f.state = 'ready';
      }
      return true;
    }
    function seaDistance(x, y) {
      const f = seaField;
      if (f.state !== 'ready') return 0;
      const gx = (x - WORLD_LEFT) / SEA_FIELD_CELL - 0.5,
        gy = (y - WORLD_TOP) / SEA_FIELD_CELL - 0.5;
      if (gx < 0 || gy < 0 || gx >= f.cols - 1 || gy >= f.rows - 1) return 3000;
      const c = gx | 0,
        r = gy | 0,
        u = gx - c,
        v = gy - r,
        i = r * f.cols + c,
        d = f.dist;
      return (d[i] * (1 - u) + d[i + 1] * u) * (1 - v) + (d[i + f.cols] * (1 - u) + d[i + f.cols + 1] * u) * v;
    }
    /* Harbour basins, berths and the freighter's quay: never dolphin or shark water. */
    const SEA_NO_GO = [
      { x0: MARINA.basin.x - 80, y0: MARINA.basin.y - 80, x1: MARINA.basin.x + MARINA.basin.w + 80, y1: MARINA.basin.y + MARINA.basin.h + 80 },
      { x0: MONARCH_MARINA.basin.x - 80, y0: MONARCH_MARINA.basin.y - 80, x1: MONARCH_MARINA.basin.x + MONARCH_MARINA.basin.w + 80, y1: MONARCH_MARINA.basin.y + MONARCH_MARINA.basin.h + 120 },
      { x0: HARBOR.ship.x - 260, y0: HARBOR.ship.y - 360, x1: HARBOR.ship.x + 260, y1: HARBOR.ship.y + 360 },
      // The cruise terminal's berth (the Coral Dawn lies alongside).
      { x0: 1640, y0: -4560, x1: 3140, y1: -4100 },
    ];
    function seaNoGo(x, y) {
      for (const z of SEA_NO_GO) if (x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1) return true;
      return false;
    }
    function seaOpen(x, y, min) {
      return seaDistance(x, y) >= min && !seaNoGo(x, y);
    }
    /**
     * Turn `e` (x, y, a) toward heading `desired`, choosing the nearest heading
     * whose water `look` units ahead is at least `min` from land; returns the
     * heading steered for. Every swimmer here keeps off the shore this way.
     */
    const SEA_STEER_TRIES = [0, 0.45, -0.45, 0.9, -0.9, 1.45, -1.45, 2.1, -2.1, 2.8];
    function seaSteer(e, desired, deltaSeconds, turnRate, look, min) {
      let chosen = desired + Math.PI;
      for (const k of SEA_STEER_TRIES) {
        const h = desired + k,
          c = Math.cos(h),
          s = Math.sin(h);
        if (seaOpen(e.x + c * look, e.y + s * look, min) && seaOpen(e.x + c * look * 0.5, e.y + s * look * 0.5, min * 0.8)) {
          chosen = h;
          break;
        }
      }
      e.a = normalizeAngle(e.a + clamp(normalizeAngle(chosen - e.a), -turnRate * deltaSeconds, turnRate * deltaSeconds));
      return chosen;
    }
    /* A point in water at least `min` from land, `r0..r1` from (x, y); null if none found. */
    function seaPointNear(x, y, r0, r1, min, tries = 24, bearing = null, spread = Math.PI) {
      for (let i = 0; i < tries; i++) {
        const a = bearing === null ? Math.random() * TAU : bearing + (Math.random() * 2 - 1) * spread,
          r = r0 + Math.random() * (r1 - r0),
          px = x + Math.cos(a) * r,
          py = y + Math.sin(a) * r;
        if (seaOpen(px, py, min)) return { x: px, y: py };
      }
      return null;
    }
    /* Where the viewer is: the camera's focus, or the player's craft. */
    function seaViewer() {
      return player.car || cameraTarget || player;
    }
    function seaHour() {
      return (worldMinutes % 1440) / 60;
    }
    /* 0 night .. 1 at dawn and dusk (sea life is busiest then). */
    function seaTwilight() {
      const h = seaHour();
      return Math.max(clamp(1 - Math.abs(h - 6.6) / 1.4, 0, 1), clamp(1 - Math.abs(h - 19.2) / 1.4, 0, 1));
    }
    /**
     * EVENTS
     * Splashes, blows, foam rings and blood are handed to the renderer (and read
     * back by tests) as a short list of numbered events; sealife3d.js keeps the
     * last number it drew.
     */
    const seaEvents = [];
    let seaEventId = 0;
    function seaEvent(kind, x, y, size = 1, extra = null) {
      seaEvents.push({ id: ++seaEventId, kind, x, y, size, t: gameTime, ...(extra || {}) });
      if (seaEvents.length > 64) seaEvents.splice(0, seaEvents.length - 64);
    }
    const seaLog = [];
    // The renderer's numbers for sealife(): set by sealife3d.js once it is built.
    let sealifeRenderStats = null;
    function seaNote(event, detail = '') {
      seaLog.push({ t: +gameTime.toFixed(1), clock: clockText(), event, detail });
      if (seaLog.length > 60) seaLog.shift();
    }
    // ============================================================================
    /**
     * DOLPHINS
     * A pod (2-5 bottlenose dolphins) arrives out of sight in open water now and
     * then (`dolphinRate`: about two visits an in-game hour by day, four at dawn
     * and dusk, fewer at night; more for a player out on a boat), crosses the
     * water in view and leaves. The pod steers as one; each dolphin keeps a slot
     * in a loose formation and has its own breathing rhythm:
     *   swim   cruising 1.5-3 m down (seen only as a shape under the surface)
     *   arc    a breath: the back rolls up through the surface, the blowhole
     *          clears with a puff of spray, the dorsal fin and the flukes follow
     *   leap   now and then (more when excited, riding a bow) a dolphin drives up
     *          from below and clears the water on a real ballistic arc (about
     *          2.5 m high, 1.4 s in the air), sometimes landing on its side
     * A pod near a boat doing 8-30 knots (the player's, or the Meridian Star
     * under way) may ride its bow wave: each dolphin takes a slot off the bow,
     * matches the boat's speed and porpoises. Too fast, or the boat stops, and
     * they drop back and go on their way.
     */
    const dolphinPods = [];
    let dolphinClock = 20,
      dolphinPodId = 0,
      dolphinSightings = 0;
    function dolphinRate() {
      // Pods an in-game hour (one game minute passes a real second).
      const day = daylight(),
        base = day > 0.15 ? 2 : 0.7,
        boat = isBoat(player.car) ? 1.5 : 1;
      return (base + 2 * seaTwilight()) * boat;
    }
    function spawnDolphinPod(options = {}) {
      if (!seaFieldStep()) return null;
      const viewer = seaViewer(),
        count = options.count ? clamp(Math.round(options.count), 1, 6) : 2 + Math.floor(Math.random() * 4);
      let at = options.x !== undefined ? { x: options.x, y: options.y } : null;
      if (at && !seaOpen(at.x, at.y, 40)) at = seaPointNear(at.x, at.y, 20, 400, DOLPHIN_WATER * 0.6);
      if (!at) at = seaPointNear(viewer.x, viewer.y, options.near ? 180 : 650, options.near ? 420 : 1150, DOLPHIN_WATER, 30);
      if (!at) return null;
      // Heading across the view, toward the viewer's side of the water.
      const toward = Math.atan2(viewer.y - at.y, viewer.x - at.x) + (Math.random() - 0.5) * 1.4;
      const pod = {
        id: ++dolphinPodId,
        x: at.x,
        y: at.y,
        a: toward,
        speed: 3.2 * UNITS_PER_METRE,
        age: 0,
        life: 60 + Math.random() * 60,
        waypoint: null,
        ride: null,
        rideFor: 0,
        excitement: options.leap ? 1 : 0.2,
        members: [],
      };
      for (let i = 0; i < count; i++) {
        const row = Math.floor((i + 1) / 2),
          side = i === 0 ? 0 : i % 2 ? 1 : -1,
          calf = count > 3 && i === count - 1 && Math.random() < 0.6;
        pod.members.push({
          slotF: -row * 16 + (Math.random() - 0.5) * 6,
          slotS: side * (9 + row * 4) + (Math.random() - 0.5) * 5,
          x: at.x + (Math.random() - 0.5) * 30,
          y: at.y + (Math.random() - 0.5) * 30,
          z: SEA_SURFACE - 14 - Math.random() * 8,
          a: toward,
          pitch: 0,
          roll: 0,
          speed: pod.speed,
          phase: Math.random() * TAU,
          scale: calf ? 0.62 : 0.92 + Math.random() * 0.16,
          mode: 'swim',
          t: 0,
          dur: 0,
          next: 1 + Math.random() * 6,
          cruise: SEA_SURFACE - 12 - Math.random() * 12,
          vz: 0,
          vh: 0,
          spin: 0,
          blown: false,
          surfaced: false,
        });
      }
      dolphinPods.push(pod);
      dolphinSightings++;
      seaNote('dolphins', count + ' at ' + Math.round(at.x) + ', ' + Math.round(at.y));
      return pod;
    }
    /* The boat (the player's, or the liner under way) a pod might ride. */
    function dolphinBowCandidate(pod) {
      const c = player.car;
      if (isBoat(c) && c.hp > 0) {
        const kn = Math.abs(c.speed || 0) / KNOTS;
        if (kn > 8 && kn < 30 && distanceBetween(c, pod) < 650) return { boat: c, length: vehicleSpec(c).l, beam: vehicleSpec(c).w, speed: Math.abs(c.speed), a: c.a };
      }
      const liner = LINERS.find((s) => s.voyage);
      if (liner && (liner.speed || 0) / KNOTS > 6 && distanceBetween(liner, pod) < 1400)
        return { boat: liner, length: liner.l, beam: liner.w, speed: liner.speed, a: liner.a };
      return null;
    }
    function updateDolphinPods(deltaSeconds) {
      const viewer = seaViewer();
      dolphinClock -= deltaSeconds * (dolphinRate() / 60);
      if (dolphinClock <= 0) {
        dolphinClock = -Math.log(1 - Math.random() * 0.95) + 0.05;
        // Only near water someone could see it from, two pods at most.
        if (dolphinPods.length < 2 && seaDistance(viewer.x, viewer.y) < 1600 && seaPointNear(viewer.x, viewer.y, 200, 1400, DOLPHIN_WATER, 6)) spawnDolphinPod();
      }
      for (let p = dolphinPods.length - 1; p >= 0; p--) {
        const pod = dolphinPods[p];
        pod.age += deltaSeconds;
        const far = distanceBetween(pod, viewer);
        if ((pod.age > pod.life && far > 1300) || far > 2600) {
          dolphinPods.splice(p, 1);
          continue;
        }
        pod.excitement = Math.max(0.15, pod.excitement - deltaSeconds * 0.02);
        // Bow riding: join a passing boat, hold station off its bow, drop back.
        const bow = pod.ride ? dolphinBowCandidate(pod) : pod.age > 4 && Math.random() < deltaSeconds * 0.25 ? dolphinBowCandidate(pod) : null;
        if (bow && (pod.ride || Math.random() < 0.6)) {
          if (!pod.ride) seaNote('bow ride', bow.boat === player.car ? 'the player\'s boat' : 'the liner');
          pod.ride = bow;
          pod.rideFor += deltaSeconds;
          pod.excitement = Math.min(1, pod.excitement + deltaSeconds * 0.3);
          const ahead = bow.length * 0.5 + 14;
          pod.x = bow.boat.x + Math.cos(bow.a) * ahead;
          pod.y = bow.boat.y + Math.sin(bow.a) * ahead;
          pod.a = bow.a;
          pod.speed = bow.speed;
          pod.life = Math.max(pod.life, pod.age + 30);
          if (pod.rideFor > 90) {
            pod.ride = null;
            pod.rideFor = -1e9;
          }
        } else {
          if (pod.ride) seaNote('bow ride over');
          pod.ride = null;
          // Wander: a waypoint in open water, re-picked on arrival; leave when old.
          if (!pod.waypoint || distanceBetween(pod, pod.waypoint) < 80) {
            const leaving = pod.age > pod.life;
            pod.waypoint = seaPointNear(pod.x, pod.y, 500, 900, DOLPHIN_WATER, 16, leaving ? Math.atan2(pod.y - viewer.y, pod.x - viewer.x) : pod.a, leaving ? 0.6 : 1.2) || { x: pod.x - Math.cos(pod.a) * 600, y: pod.y - Math.sin(pod.a) * 600 };
          }
          seaSteer(pod, headingBetween(pod, pod.waypoint), deltaSeconds, 0.35, 140, DOLPHIN_WATER * 0.7);
          const want = (3 + pod.excitement * 2.5) * UNITS_PER_METRE;
          pod.speed += (want - pod.speed) * Math.min(1, deltaSeconds * 0.8);
          pod.x += Math.cos(pod.a) * pod.speed * deltaSeconds;
          pod.y += Math.sin(pod.a) * pod.speed * deltaSeconds;
        }
        const c = Math.cos(pod.a),
          s = Math.sin(pod.a),
          riding = !!pod.ride;
        for (const m of pod.members) updateDolphin(pod, m, c, s, riding, deltaSeconds);
      }
    }
    function updateDolphin(pod, m, c, s, riding, deltaSeconds) {
      // The slot: off the bow either side when riding, else the pod's formation.
      const slotF = riding ? -Math.abs(m.slotS) * 0.6 : m.slotF,
        slotS = riding ? Math.sign(m.slotS || 1) * (pod.ride.beam * 0.35 + 4 + Math.abs(m.slotS) * 0.4) : m.slotS,
        tx = pod.x + c * slotF - s * slotS,
        ty = pod.y + s * slotF + c * slotS,
        dx = tx - m.x,
        dy = ty - m.y,
        gap = Math.hypot(dx, dy);
      if (m.mode !== 'leap') {
        const desired = gap > 4 ? Math.atan2(dy, dx) : pod.a;
        const blend = clamp(gap / 40, 0, 1);
        const head = normalizeAngle(pod.a + normalizeAngle(desired - pod.a) * blend);
        m.a = normalizeAngle(m.a + clamp(normalizeAngle(head - m.a), -1.6 * deltaSeconds, 1.6 * deltaSeconds));
        m.speed = pod.speed + clamp(gap * 0.6, -pod.speed * 0.4, 3 * UNITS_PER_METRE) * Math.cos(normalizeAngle(desired - m.a));
      }
      const sp = m.mode === 'leap' ? m.vh : Math.max(0, m.speed);
      m.x += Math.cos(m.a) * sp * deltaSeconds;
      m.y += Math.sin(m.a) * sp * deltaSeconds;
      // A tail beat about twice a second at cruise, faster flat out.
      m.phase += deltaSeconds * (m.mode === 'leap' ? 1.5 : 5 + sp * 0.12);
      m.next -= deltaSeconds;
      if (m.mode === 'swim') {
        m.z += (m.cruise - m.z) * Math.min(1, deltaSeconds * 0.8);
        m.pitch += (clamp((m.cruise - m.z) * 0.05, -0.3, 0.3) - m.pitch) * Math.min(1, deltaSeconds * 3);
        m.roll *= Math.exp(-deltaSeconds * 3);
        if (m.next <= 0) {
          const leapChance = m.leapNext ? 1 : riding ? 0.35 : 0.08 + pod.excitement * 0.22;
          m.leapNext = false;
          if (Math.random() < leapChance && seaOpen(m.x + Math.cos(m.a) * 40, m.y + Math.sin(m.a) * 40, 60)) {
            m.mode = 'rise';
            m.t = 0;
            m.dur = 0.55;
            m.from = m.z;
          } else {
            m.mode = 'arc';
            m.t = 0;
            m.dur = 1.3 + Math.random() * 0.6;
            m.from = m.z;
            m.blown = false;
          }
        }
      } else if (m.mode === 'arc') {
        // The rolling breath: up through the surface and back down.
        m.t += deltaSeconds;
        const k = clamp(m.t / m.dur, 0, 1),
          peak = SEA_SURFACE + 1.4 * m.scale,
          bump = Math.sin(k * Math.PI);
        m.z = m.from + (peak - m.from) * Math.pow(bump, 0.7);
        m.pitch = Math.cos(k * Math.PI) * 0.42;
        if (!m.blown && k > 0.38) {
          m.blown = true;
          seaEvent('blow', m.x + Math.cos(m.a) * 5, m.y + Math.sin(m.a) * 5, m.scale);
          dolphinBlowSound(m);
        }
        if (!m.surfaced && k > 0.3) {
          m.surfaced = true;
          seaEvent('ripple', m.x, m.y, 0.6 * m.scale, { a: m.a });
        }
        if (k >= 1) {
          m.mode = 'swim';
          m.surfaced = false;
          m.next = (riding ? 2.5 : 6) + Math.random() * (riding ? 4 : 12);
        }
      } else if (m.mode === 'rise') {
        // Driving up from below at speed, flukes pumping.
        m.t += deltaSeconds;
        const k = clamp(m.t / m.dur, 0, 1);
        m.z = m.from + (SEA_SURFACE - m.from) * k * k;
        m.pitch = 0.2 + 0.7 * k;
        m.phase += deltaSeconds * 8;
        if (k >= 1) {
          const height = (riding ? 1.8 : 2.2 + Math.random() * 1.8) * UNITS_PER_METRE * m.scale;
          m.mode = 'leap';
          m.vz = Math.sqrt(2 * GRAVITY * height);
          m.vh = Math.max(m.speed, (7 + Math.random() * 2) * UNITS_PER_METRE);
          if (riding) m.vh = Math.max(m.vh, pod.speed);
          m.z = SEA_SURFACE;
          m.spin = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0;
          m.t = 0;
          seaEvent('splash', m.x, m.y, 0.8 * m.scale, { a: m.a, exit: true });
          dolphinSplashSound(m, 0.6);
          if (Math.random() < 0.7) dolphinVoice(m);
        }
      } else if (m.mode === 'leap') {
        m.t += deltaSeconds;
        m.vz -= GRAVITY * deltaSeconds;
        m.z += m.vz * deltaSeconds;
        m.pitch = Math.atan2(m.vz, m.vh) * 0.95;
        // A side-flop: the body rolls over at the top and lands flank first.
        if (m.spin) m.roll = m.spin * clamp((m.t - 0.35) * 1.6, 0, 1.45);
        if (m.z <= SEA_SURFACE && m.vz < 0) {
          m.mode = 'dive';
          m.t = 0;
          m.dur = 0.8;
          m.from = SEA_SURFACE;
          m.speed = m.vh * 0.7;
          const size = (m.spin ? 1.5 : 1.1) * m.scale;
          seaEvent('splash', m.x, m.y, size, { a: m.a, ring: true });
          dolphinSplashSound(m, m.spin ? 1.3 : 1);
        }
      } else if (m.mode === 'dive') {
        m.t += deltaSeconds;
        const k = clamp(m.t / m.dur, 0, 1);
        m.z = SEA_SURFACE - (SEA_SURFACE - m.cruise) * Math.sin(k * Math.PI * 0.5) - 6 * Math.sin(k * Math.PI);
        m.pitch = -0.7 * (1 - k);
        m.roll *= Math.exp(-deltaSeconds * 2.5);
        if (k >= 1) {
          m.mode = 'swim';
          m.next = (riding ? 2 : 5) + Math.random() * (riding ? 4 : 10);
        }
      }
    }
    // ============================================================================
    /**
     * GULLS
     * Flocks belong to places (`GULL_FLOCKS`): the beach, the marinas, the
     * docks, the sea walls. A flock near the view is given gulls from a fixed
     * pool (GULL_POOL); one far off gives them back. Each gull is either
     * perched (a pier edge, a lifeguard tower, a roof parapet, a moored boat's
     * bow), circling (soaring on banked turns round the flock, bursts of
     * flapping between long glides), following a working boat (hanging over its
     * wake), or on its way between them. A perched gull that is approached (by
     * the player on foot or in a vehicle), or that hears a shot, takes off,
     * circles a while and comes back to a free perch once the coast is clear.
     * At night most of the flock roosts on its perches and only a couple fly.
     */
    const GULL_FLOCKS = [
      { name: 'Palm Keys Beach', x: -1980, y: 5620, r: 520, fly: 6, perch: 5, lo: 90, hi: 300 },
      { name: 'Beach pier', x: -1710, y: 5900, r: 180, fly: 2, perch: 5, lo: 70, hi: 200 },
      { name: 'Harbor Point Marina', x: 1100, y: -3700, r: 420, fly: 7, perch: 9, lo: 90, hi: 280 },
      { name: 'Cruise terminal', x: 2300, y: -4300, r: 500, fly: 5, perch: 3, lo: 140, hi: 380 },
      { name: 'Ironworks Docks', x: 3350, y: 1500, r: 380, fly: 6, perch: 5, lo: 100, hi: 300 },
      { name: 'Battery Park sea wall', x: 2450, y: 5420, r: 520, fly: 5, perch: 5, lo: 90, hi: 260 },
      { name: 'Monarch Marina', x: 8700, y: -900, r: 600, fly: 6, perch: 8, lo: 100, hi: 300 },
      { name: 'Coral Marina docks', x: -1180, y: 2940, r: 360, fly: 4, perch: 4, lo: 80, hi: 240 },
    ];
    const gulls = [];
    let gullFollowClock = 0;
    for (let i = 0; i < GULL_POOL; i++)
      gulls.push({
        id: i,
        flock: null,
        mode: 'off',
        x: 0,
        y: 0,
        z: 0,
        a: 0,
        bank: 0,
        pitch: 0,
        speed: 0,
        vz: 0,
        flap: 0,
        flapPhase: Math.random() * TAU,
        flapping: 0,
        glideFor: 0,
        fold: 0,
        perch: null,
        timer: 0,
        orbit: null,
        target: { x: 0, y: 0, z: 0 },
        follow: null,
        calledAt: -99,
      });
    /**
     * Perches for a flock: deck edges and rails of the pier and the jetties,
     * lifeguard tower roofs, moored boats' bows, the quay edge and the roofs of
     * buildings by the water. Built once per flock, the first time it is near.
     */
    function gullPerches(flock) {
      if (flock.perches) return flock.perches;
      const list = [],
        add = (x, y, z, a = Math.random() * TAU) => {
          if (list.some((p) => Math.hypot(p.x - x, p.y - y) < 7)) return;
          list.push({ x, y, z, a, taken: null });
        },
        near = (x, y) => Math.hypot(x - flock.x, y - flock.y) < flock.r + 120;
      // The beach pier: along both edges of the stem and round the head.
      for (const d of BEACH.pier)
        if (near(d.x + d.w / 2, d.y + d.h / 2))
          for (let t = 6; t < Math.max(d.w, d.h) - 4; t += 13) {
            if (d.h > d.w) {
              add(d.x + 1.5, d.y + t, 7.6, Math.PI);
              add(d.x + d.w - 1.5, d.y + t, 7.6, 0);
            } else {
              add(d.x + t, d.y + d.h - 1.5, 7.6, Math.PI / 2);
              add(d.x + t, d.y + 1.5, 7.6, -Math.PI / 2);
            }
          }
      // Jetties.
      for (const d of DOCKS)
        if (near(d.x + d.w / 2, d.y + d.h / 2))
          for (let t = 8; t < d.w - 4; t += 16) {
            add(d.x + t, d.y + 1.5, 2.4);
            add(d.x + t, d.y + d.h - 1.5, 2.4);
          }
      // Lifeguard towers (the cabin roof).
      if (typeof BEACH_LAYOUT !== 'undefined' && BEACH_LAYOUT)
        for (const t of BEACH_LAYOUT.towers || []) if (near(t.x, t.y)) add(t.x, t.y, 31, t.a);
      // Moored boats' bows and sterns (Harbor Point).
      for (const b of marinaBoats())
        if (near(b.x, b.y)) {
          add(b.x, b.y + b.len * 0.4, 9.5, Math.PI / 2);
          if (Math.random() < 0.5) add(b.x, b.y - b.len * 0.38, 9.5, -Math.PI / 2);
        }
      // Monarch Marina pontoons.
      for (const f of MONARCH_MARINA.fingers)
        if (near(f.x, f.y + f.h / 2))
          for (let t = 30; t < f.h; t += 70) add(f.x + (Math.random() < 0.5 ? 2 : f.w - 2), f.y + t, 2.4);
      // Harbor Point fingers.
      for (const f of MARINA.fingers)
        if (near(f.x, f.y + f.h / 2))
          for (let t = 40; t < f.h; t += 90) add(f.x + (Math.random() < 0.5 ? 2 : f.w - 2), f.y + t, 2.4);
      // Roofs by the water: a few parapet corners of flat roofs within the flock.
      let roofs = 0;
      for (const b of buildingsNear(flock.x, flock.y)) {
        if (roofs >= 8 || !roofLandable(b) || !near(b.x + b.w / 2, b.y + b.h / 2) || b.height > realBuildingHeight(140)) continue;
        if (seaDistance(b.x + b.w / 2, b.y + b.h / 2) > 260) continue;
        const inset = 3;
        add(b.x + inset, b.y + inset, b.height + 1.2);
        add(b.x + b.w - inset, b.y + b.h - inset, b.height + 1.2);
        roofs++;
      }
      // The sea wall or quay edge: points on the shore near the flock.
      for (const e of coastSegments()) {
        if (list.length > 40) break;
        if (e.opening || !near(e.x, e.y) || Math.random() < 0.6) continue;
        const { nx, ny } = shoreNormal(e),
          px = e.x + nx * 4,
          py = e.y + ny * 4;
        if (groundAt(px, py, 2) && !solid(px, py, 2)) add(px, py, terrainHeight(px, py) + 0.2, Math.atan2(-ny, -nx));
      }
      flock.perches = list;
      return list;
    }
    function gullDayShare() {
      const d = daylight();
      return clamp(d * 1.4, 0.12, 1);
    }
    function gullAssign(flock, g, perched) {
      g.flock = flock;
      g.follow = null;
      g.fold = 0;
      g.perch = null;
      if (perched) {
        const free = gullPerches(flock).filter((p) => !p.taken);
        if (free.length) {
          const p = free[Math.floor(Math.random() * free.length)];
          p.taken = g;
          g.perch = p;
          g.mode = 'perch';
          g.x = p.x;
          g.y = p.y;
          g.z = p.z;
          g.a = p.a;
          g.fold = 1;
          g.speed = 0;
          g.timer = 5 + Math.random() * 20;
          return;
        }
        g.flock = null;
        g.mode = 'off';
        return;
      }
      g.mode = 'circle';
      gullNewOrbit(g);
      const o = g.orbit;
      g.x = o.x + Math.cos(o.t) * o.r;
      g.y = o.y + Math.sin(o.t) * o.r;
      g.z = o.z;
      g.a = o.t + (o.dir * Math.PI) / 2;
      g.speed = 9 * UNITS_PER_METRE;
    }
    function gullNewOrbit(g) {
      const f = g.flock,
        a = Math.random() * TAU,
        d = Math.random() * f.r * 0.6;
      g.orbit = {
        x: f.x + Math.cos(a) * d,
        y: f.y + Math.sin(a) * d,
        r: 45 + Math.random() * 110,
        t: Math.random() * TAU,
        dir: Math.random() < 0.5 ? -1 : 1,
        z: f.lo + Math.random() * (f.hi - f.lo),
        until: gameTime + 12 + Math.random() * 25,
      };
    }
