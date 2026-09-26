    // BEGIN SUBSYSTEM: src/sealife.js — Sea life: dolphins, gulls and the great white
    /**
     * Sea life: dolphins, gulls and the great white
     * Source: src/sealife.js
     * Scope: shared game closure.
     * What lives in and over the sea, as data the renderer (sealife3d.js) and
     * the sound (sealife-audio.js) read: pods of bottlenose dolphins that
     * surface, breathe, leap and ride bow waves; flocks of herring gulls that
     * circle the beach and the harbours, perch on piers, roofs and moored boats
     * and follow working boats; and one great white shark that patrols deep
     * water, shows its fin now and then, frightens the beach, bumps a small boat
     * and, very rarely, takes a swimmer who has gone too far out.
     */
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
    /* Who a perched gull minds: the player on foot, their vehicle, anyone firing. */
    function gullScared(g) {
      const threat = player.car || player,
        d = Math.hypot(threat.x - g.x, threat.y - g.y),
        dz = Math.abs(entityElevation(threat) - g.z);
      if (dz > 60) return false;
      const moving = player.car ? Math.abs(player.car.speed || 0) : player.swimming ? 0 : footPace();
      const reach = player.car ? 70 + moving * 0.4 : 42 + moving * 0.9;
      if (d < reach) return true;
      return shotCooldownSeconds > 0 && d < 380;
    }
    function gullTakeOff(g) {
      if (g.perch) g.perch.taken = null;
      g.perch = null;
      g.mode = 'flee';
      g.fold = 0;
      g.vz = (3.5 + Math.random() * 2) * UNITS_PER_METRE;
      g.speed = 6 * UNITS_PER_METRE;
      const threat = player.car || player;
      g.a = Math.atan2(g.y - threat.y, g.x - threat.x) + (Math.random() - 0.5) * 1.2;
      g.timer = 2.5 + Math.random() * 1.5;
      g.flapping = 3;
      if (gameTime - g.calledAt > 3 && Math.random() < 0.5) {
        g.calledAt = gameTime;
        gullCallAt(g, 1);
      }
    }
    /* Steer a flying gull toward a point: banked turns, climb and descent, flap or glide. */
    function gullFly(g, tx, ty, tz, deltaSeconds, cruise = 9 * UNITS_PER_METRE) {
      const desired = Math.atan2(ty - g.y, tx - g.x),
        turn = clamp(normalizeAngle(desired - g.a), -1.3 * deltaSeconds, 1.3 * deltaSeconds);
      g.a = normalizeAngle(g.a + turn);
      const rate = turn / Math.max(1e-4, deltaSeconds);
      g.bank += (clamp((rate * g.speed) / GRAVITY, -0.9, 0.9) - g.bank) * Math.min(1, deltaSeconds * 3);
      g.speed += (cruise - g.speed) * Math.min(1, deltaSeconds * 0.8);
      const climb = clamp((tz - g.z) * 0.6, -3 * UNITS_PER_METRE, 2.5 * UNITS_PER_METRE);
      g.vz += (climb - g.vz) * Math.min(1, deltaSeconds * 2);
      g.x += Math.cos(g.a) * g.speed * deltaSeconds;
      g.y += Math.sin(g.a) * g.speed * deltaSeconds;
      g.z += g.vz * deltaSeconds;
      g.pitch = clamp(g.vz / Math.max(20, g.speed), -0.5, 0.5);
      // Flap to climb or keep speed; otherwise long glides with bursts between.
      if (g.flapping > 0) g.flapping -= deltaSeconds;
      else if (g.vz > 1.2 * UNITS_PER_METRE || g.speed < cruise * 0.75) g.flapping = 0.8 + Math.random() * 1.2;
      else {
        g.glideFor -= deltaSeconds;
        if (g.glideFor <= 0) {
          g.glideFor = 3 + Math.random() * 6;
          g.flapping = 0.6 + Math.random() * 1.4;
        }
      }
    }
    function gullAnimate(g, deltaSeconds) {
      if (g.mode === 'perch') {
        g.flap = 0;
        g.fold += (1 - g.fold) * Math.min(1, deltaSeconds * 6);
        return;
      }
      g.fold += (0 - g.fold) * Math.min(1, deltaSeconds * 8);
      if (g.flapping > 0) {
        // About three wingbeats a second, a little quicker climbing away.
        g.flapPhase += deltaSeconds * TAU * (g.mode === 'flee' ? 3.8 : 3);
        g.flap = Math.sin(g.flapPhase) * 0.62 + 0.08;
      } else {
        // Gliding: wings held in a shallow dihedral, the odd adjustment.
        g.flap += (0.1 + Math.sin(gameTime * 0.7 + g.id) * 0.04 - g.flap) * Math.min(1, deltaSeconds * 4);
      }
    }
    function gullCallAt(g, strength) {
      if (daylight() < 0.05 && strength < 1) return;
      gullCallSound(g, strength);
    }
    /* A boat worth following: moving, near a gull flock or the coast, not too fast. */
    function gullFollowTargets() {
      const list = [];
      const c = player.car;
      if (isBoat(c) && Math.abs(c.speed || 0) > 3 * KNOTS && Math.abs(c.speed || 0) < 30 * KNOTS) list.push(c);
      const v = typeof drawbridge !== 'undefined' ? drawbridge.vessel : null;
      if (v && (v.speed || 0) > 1) list.push(v);
      for (const s of LINERS) if (s.voyage && (s.speed || 0) > 2 * KNOTS) list.push(s);
      return list;
    }
    function updateGulls(deltaSeconds) {
      const viewer = seaViewer(),
        day = gullDayShare(),
        vx = viewer.x,
        vy = viewer.y;
      // Flocks come and go with the view (and the flock's share of the hour).
      for (const f of GULL_FLOCKS) {
        const near = Math.hypot(f.x - vx, f.y - vy) < 1500 + f.r;
        f.active = near;
        if (!near) {
          for (const g of gulls)
            if (g.flock === f && !g.follow) {
              if (g.perch) g.perch.taken = null;
              g.perch = null;
              g.flock = null;
              g.mode = 'off';
            }
          continue;
        }
        let flying = 0,
          perched = 0;
        for (const g of gulls)
          if (g.flock === f) {
            if (g.mode === 'perch') perched++;
            else flying++;
          }
        const wantFly = Math.round(f.fly * day),
          wantPerch = f.perch + (f.fly - wantFly);
        // One more gull at a time: a flier while the flock is short of them, a
        // percher while there is a free perch; never more than the flock's size.
        const perches = gullPerches(f),
          room = flying + perched < f.fly + f.perch,
          wantsPercher = perched < Math.min(wantPerch, perches.length) && perches.some((p) => !p.taken);
        if (room && (flying < wantFly || wantsPercher)) {
          const free = gulls.find((g) => g.mode === 'off');
          if (free) gullAssign(f, free, flying >= wantFly || (wantsPercher && Math.random() < 0.5));
        } else if (flying > wantFly + 1) {
          // Dusk: a flier goes to roost.
          const g = gulls.find((q) => q.flock === f && q.mode === 'circle');
          if (g) {
            g.mode = 'return';
            g.timer = 0;
          }
        }
      }
      // A few gulls pick up a working boat and hang over its wake.
      gullFollowClock -= deltaSeconds;
      if (gullFollowClock <= 0) {
        gullFollowClock = 3;
        for (const boat of gullFollowTargets()) {
          if (Math.hypot(boat.x - vx, boat.y - vy) > 1600 || daylight() < 0.15) continue;
          const already = gulls.filter((g) => g.follow === boat).length,
            want = boat.l > 600 ? 6 : 4;
          if (already >= want) continue;
          const g = gulls.find((q) => q.mode === 'circle' && q.flock && Math.hypot(q.x - boat.x, q.y - boat.y) < 1200) || gulls.find((q) => q.mode === 'off');
          if (!g) continue;
          if (g.mode === 'off') {
            g.flock = null;
            g.x = boat.x + (Math.random() - 0.5) * 300;
            g.y = boat.y + (Math.random() - 0.5) * 300;
            g.z = 160;
            g.speed = 9 * UNITS_PER_METRE;
          }
          g.mode = 'follow';
          g.follow = boat;
          g.followOffset = { back: 30 + Math.random() * 70, side: (Math.random() - 0.5) * 70, z: 90 + Math.random() * 110, wobble: Math.random() * TAU };
          g.timer = 40 + Math.random() * 60;
        }
      }
      for (const g of gulls) {
        if (g.mode === 'off') continue;
        g.timer -= deltaSeconds;
        switch (g.mode) {
          case 'perch': {
            if (gullScared(g)) {
              gullTakeOff(g);
              break;
            }
            // A shuffle round on the rail now and then; a call over a busy beach.
            if (g.timer <= 0) {
              g.timer = 4 + Math.random() * 14;
              g.a += (Math.random() - 0.5) * 1.6;
              if (Math.random() < 0.12) gullCallAt(g, 0.5);
            }
            break;
          }
          case 'flee': {
            gullFly(g, g.x + Math.cos(g.a) * 100, g.y + Math.sin(g.a) * 100, g.z + 60, deltaSeconds, 8 * UNITS_PER_METRE);
            if (g.timer <= 0) {
              if (g.flock) {
                g.mode = 'circle';
                gullNewOrbit(g);
                g.orbit.until = gameTime + 15 + Math.random() * 25;
                g.wantPerch = true;
              } else g.mode = 'off';
            }
            break;
          }
          case 'circle': {
            const o = g.orbit;
            o.t += (o.dir * g.speed * deltaSeconds) / o.r;
            gullFly(g, o.x + Math.cos(o.t + o.dir * 0.5) * o.r, o.y + Math.sin(o.t + o.dir * 0.5) * o.r, o.z + Math.sin(gameTime * 0.3 + g.id) * 20, deltaSeconds);
            if (gameTime > o.until) {
              if (g.wantPerch || (g.flock && daylight() < 0.1)) {
                g.mode = 'return';
                g.wantPerch = false;
              } else gullNewOrbit(g);
            }
            if (Math.random() < deltaSeconds * 0.02 && gameTime - g.calledAt > 8) {
              g.calledAt = gameTime;
              gullCallAt(g, 0.6);
            }
            break;
          }
          case 'return': {
            // Back to a free perch, if the one who scared it has gone.
            if (!g.flock) {
              g.mode = 'off';
              break;
            }
            if (!g.perch) {
              const threat = player.car || player,
                free = gullPerches(g.flock).filter((p) => !p.taken && Math.hypot(p.x - threat.x, p.y - threat.y) > 140);
              if (!free.length) {
                g.mode = 'circle';
                gullNewOrbit(g);
                break;
              }
              g.perch = free[Math.floor(Math.random() * free.length)];
              g.perch.taken = g;
            }
            const p = g.perch,
              d = Math.hypot(p.x - g.x, p.y - g.y);
            gullFly(g, p.x, p.y, p.z + Math.min(80, d * 0.35), deltaSeconds, clamp(d * 0.25, 3 * UNITS_PER_METRE, 9 * UNITS_PER_METRE));
            if (d < 30) {
              // The flare: wings up and beating, dropping onto the perch.
              g.flapping = 0.4;
              const k = Math.min(1, deltaSeconds * 4);
              g.x += (p.x - g.x) * k;
              g.y += (p.y - g.y) * k;
              g.z += (p.z - g.z) * k;
              if (d < 3 && Math.abs(g.z - p.z) < 2) {
                g.mode = 'perch';
                g.x = p.x;
                g.y = p.y;
                g.z = p.z;
                g.bank = g.pitch = 0;
                g.timer = 5 + Math.random() * 15;
              }
            }
            if (gullScared(g) && d < 60) {
              if (g.perch) g.perch.taken = null;
              g.perch = null;
              gullTakeOff(g);
            }
            break;
          }
          case 'follow': {
            const b = g.follow,
              o = g.followOffset;
            const gone = !b || (b.hp !== undefined && b.hp <= 0) || Math.abs(b.speed || 0) < 1 || g.timer <= 0 || Math.hypot(b.x - vx, b.y - vy) > 2000;
            if (gone) {
              g.follow = null;
              if (g.flock) {
                g.mode = 'circle';
                gullNewOrbit(g);
              } else g.mode = 'flee';
              g.timer = 4;
              break;
            }
            const len = b.l || (b.type ? vehicleSpec(b).l : 90),
              back = len * 0.5 + o.back,
              c = Math.cos(b.a),
              s = Math.sin(b.a),
              w = Math.sin(gameTime * 0.6 + o.wobble);
            gullFly(g, b.x - c * back - s * (o.side + w * 25), b.y - s * back + c * (o.side + w * 25), o.z + Math.sin(gameTime * 0.9 + o.wobble) * 25, deltaSeconds, Math.max(8 * UNITS_PER_METRE, Math.abs(b.speed || 0) * 1.05));
            if (Math.random() < deltaSeconds * 0.06 && gameTime - g.calledAt > 5) {
              g.calledAt = gameTime;
              gullCallAt(g, 0.8);
            }
            break;
          }
        }
        gullAnimate(g, deltaSeconds);
      }
    }
    // ============================================================================
    /**
     * THE GREAT WHITE
     * One shark, about 5 m. While the viewer is near deep water it patrols it
     * (SHARK_WATER from land, never in a harbour), mostly 4-5 m down, where it
     * reads as a long dark shape under the surface. Every minute or so it cruises
     * up with the dorsal fin cutting the water and a wake off it, for anyone on a
     * boat or the beach to see. Now and then (rarely) it makes a pass along the
     * beach just outside the buoy line, which starts the beach's SHARK! alarm.
     *
     * THE ENCOUNTER ("occasionally eat me if I'm swimming")
     * Interest builds only while the player swims in deep water: more than
     * SHARK_DEEP_SWIM from land, outside the beach's buoys, not in a harbour
     * or the Marea pool, not during a mission, and not within SHARK_COOLDOWN of
     * the last encounter. It grows faster the farther out, with hard crawling
     * (splashing), at night and when bleeding; it takes about half a minute or
     * more. Then:
     *   approach  the fin appears offshore (never between the player and the
     *             nearest way out), the score starts, SHARK! and an arrow
     *   circle    it circles, closer and closer; the window is sized from the
     *             swim to the nearest way out (a beach, rocks, a ladder, a boat)
     *             so a player who heads for it at once makes it
     *   dive      the fin goes under; a shape rises beneath the swimmer
     *   breach    it lunges up out of the water, jaws open, and takes them:
     *             a huge splash, the water turns red, WASTED. In god mode it
     *             bites down, finds nothing it can hurt, lets go and leaves.
     *   escape    out of the water, on a ladder, aboard a boat or back inside
     *             the buoy line in time: the shark loses interest and leaves
     * Beach swimmers are never taken. A small boat idling in deep water may get
     * a bump from below (a jolt and a scare, no damage) and a look at the fin.
     */
    const shark = {
      active: false,
      x: 0,
      y: 0,
      z: SEA_SURFACE - 34,
      a: 0,
      pitch: 0,
      roll: 0,
      speed: 12,
      phase: 0,
      mouth: 0,
      mode: 'patrol',
      waypoint: null,
      depth: SEA_SURFACE - 34,
      finClock: 25,
      finFor: 0,
      finUp: 0,
      beachPass: null,
      beachPassClock: 150,
      bumpFor: 0,
      bumpClock: 0,
      circle: null,
      spawnClock: 0,
    };
    const sharkEncounter = {
      phase: 'none',
      t: 0,
      window: 0,
      interest: 0,
      cooldown: 90,
      exit: null,
      orbit: 0,
      radius: 0,
      bite: false,
      taken: false,
      god: false,
      last: null,
      count: 0,
      escapes: 0,
      attacks: 0,
    };
    let beachAlarm = { until: 0, started: 0, whistleAt: 0, shoutAt: 0, speakers: [] };
    function sharkPlace(x, y, a) {
      shark.x = x;
      shark.y = y;
      shark.a = a;
      shark.active = true;
      shark.waypoint = null;
    }
    function sharkSpawnNear(viewer) {
      const p = seaPointNear(viewer.x, viewer.y, 900, 1900, SHARK_WATER, 20);
      if (!p) return false;
      sharkPlace(p.x, p.y, Math.random() * TAU);
      shark.z = shark.depth = SEA_SURFACE - 30 - Math.random() * 10;
      shark.mode = 'patrol';
      return true;
    }
    /* Is the player in the shark's water? (see THE ENCOUNTER) */
    function sharkWaterForPlayer() {
      if (!player.swimming || player.pool || player.climbing || player.car || player.parachute) return false;
      if (seaNoGo(player.x, player.y)) return false;
      if (beachShelfDistance(player.x, player.y) < SHARK_BUOY_CLEAR) return false;
      return seaDistance(player.x, player.y) > SHARK_DEEP_SWIM;
    }
    /* Somewhere the swimmer counts as out of reach. */
    function sharkPlayerSafe() {
      if (gameMode !== 'play') return false;
      if (!player.swimming || player.climbing || player.car || player.pool) return true;
      return beachShelfDistance(player.x, player.y) < SHARK_BUOY_CLEAR - 30;
    }
    /* The nearest way out for the fairness window: a ladder, a beach or rocks, or a boat in reach. */
    function sharkNearestExit() {
      let best = nearestWaterExit(player.x, player.y);
      for (const c of vehicles)
        if (isBoat(c) && c.hp > 0 && !c.cop) {
          const d = distanceBetween(c, player);
          if (!best || d < best.d) best = { x: c.x, y: c.y, kind: 'boat', d };
        }
      // The buoy line counts as safety off the beach.
      const shelf = beachShelfDistance(player.x, player.y);
      if (Number.isFinite(shelf) && (!best || shelf - SHARK_BUOY_CLEAR < best.d)) {
        const s = nearestShore(player.x, player.y, SHORE_CELL);
        if (s) best = { x: (s.seg.ax + s.seg.bx) / 2, y: (s.seg.ay + s.seg.by) / 2, kind: 'swim zone', d: Math.max(0, shelf - SHARK_BUOY_CLEAR + 30) };
      }
      return best;
    }
    function sharkStartEncounter(reason = 'interest') {
      const e = sharkEncounter,
        exit = sharkNearestExit(),
        swim = SWIM_SPRINT,
        // Heading straight for the way out at the hard crawl makes it with room.
        need = exit ? exit.d / swim : 30;
      e.phase = 'approach';
      e.t = 0;
      e.exit = exit ? { x: Math.round(exit.x), y: Math.round(exit.y), kind: exit.kind, d: Math.round(exit.d) } : null;
      e.window = clamp(need * 1.25 + 5, 20, 90);
      e.bite = false;
      e.taken = false;
      e.god = !!player.godMode;
      e.count++;
      e.interest = 0;
      // The fin comes in from the open sea, never from the way out.
      const away = exit ? Math.atan2(player.y - exit.y, player.x - exit.x) : Math.random() * TAU;
      let at = null;
      for (let i = 0; i < 12 && !at; i++) {
        const a = away + (Math.random() - 0.5) * 1.6,
          x = player.x + Math.cos(a) * 380,
          y = player.y + Math.sin(a) * 380;
        if (seaOpen(x, y, 60)) at = { x, y };
      }
      if (!at) at = { x: player.x + Math.cos(away) * 300, y: player.y + Math.sin(away) * 300 };
      sharkPlace(at.x, at.y, Math.atan2(player.y - at.y, player.x - at.x));
      shark.mode = 'hunt';
      shark.z = SEA_SURFACE - 8;
      shark.beachPass = null;
      e.orbit = Math.atan2(at.y - player.y, at.x - player.x);
      e.radius = distanceBetween(at, player);
      shark.finUp = 1;
      seaNote('shark: interest → warning', reason + ' · way out: ' + (e.exit ? e.exit.kind + ' ' + distanceLabel(e.exit.d) : 'none') + ' · window ' + e.window.toFixed(0) + ' s');
      tell('SHARK! · swim for ' + (exit ? (exit.kind === 'boat' ? 'the boat' : exit.kind === 'ladder' ? 'the ladder' : exit.kind === 'swim zone' ? 'the buoys' : 'the shore') + ' · ' + distanceLabel(exit.d) : 'your life'), 5);
      sharkScore('start');
      return e;
    }
    function sharkEndEncounter(outcome) {
      const e = sharkEncounter;
      e.last = { outcome, at: +gameTime.toFixed(1), clock: clockText() };
      e.phase = 'none';
      e.cooldown = SHARK_COOLDOWN;
      shark.mode = 'retreat';
      shark.retreatFor = 14;
      shark.waypoint = seaPointNear(shark.x, shark.y, 700, 1200, SHARK_WATER, 16, Math.atan2(shark.y - player.y, shark.x - player.x), 0.8);
      if (outcome === 'escape') {
        e.escapes++;
        seaNote('shark: escape', 'the player got out in time (' + e.t.toFixed(1) + ' s)');
        tell('The shark loses interest and slides away.', 3.5);
        sharkScore('release');
      } else if (outcome === 'god') {
        seaNote('shark: god mode', 'bit down, let go and left');
        sharkScore('release');
      } else if (outcome === 'aborted') {
        seaNote('shark: encounter called off', 'the swimmer left the water another way');
        sharkScore('release');
      } else {
        e.attacks++;
        seaNote('shark: attack', 'taken');
      }
    }
    function updateSharkEncounter(deltaSeconds) {
      const e = sharkEncounter;
      if (e.phase === 'none') return false;
      e.t += deltaSeconds;
      // Gone before it came to anything: died some other way, or moved away.
      if ((e.phase === 'approach' || e.phase === 'circle' || e.phase === 'dive') && (gameMode === 'dead' || distanceBetween(player, shark) > 900)) {
        sharkEndEncounter('aborted');
        return false;
      }
      if ((e.phase === 'approach' || e.phase === 'circle' || e.phase === 'dive') && gameMode === 'play') {
        if (sharkPlayerSafe()) {
          sharkEndEncounter('escape');
          return false;
        }
      }
      const px = player.x,
        py = player.y;
      if (e.phase === 'approach' || e.phase === 'circle') {
        // Close in on a circle round the swimmer; it tightens over the window.
        const left = Math.max(0, e.window - e.t),
          target = e.phase === 'approach' ? 170 : clamp(55 + left * 5, 55, 170);
        e.radius += (target - e.radius) * Math.min(1, deltaSeconds * (e.phase === 'approach' ? 0.5 : 0.25));
        if (e.phase === 'approach' && e.radius < 190) {
          e.phase = 'circle';
          seaNote('shark: circling', 'radius ' + distanceLabel(e.radius));
        }
        const tangential = 4.2 * UNITS_PER_METRE;
        e.orbit += (tangential / Math.max(40, e.radius)) * deltaSeconds;
        const tx = px + Math.cos(e.orbit) * e.radius,
          ty = py + Math.sin(e.orbit) * e.radius,
          want = Math.atan2(ty - shark.y, tx - shark.x),
          gap = Math.hypot(tx - shark.x, ty - shark.y);
        shark.a = normalizeAngle(shark.a + clamp(normalizeAngle(want - shark.a), -1.4 * deltaSeconds, 1.4 * deltaSeconds));
        shark.speed += (clamp(gap * 0.8, 2.5 * UNITS_PER_METRE, 6.5 * UNITS_PER_METRE) - shark.speed) * Math.min(1, deltaSeconds);
        shark.x += Math.cos(shark.a) * shark.speed * deltaSeconds;
        shark.y += Math.sin(shark.a) * shark.speed * deltaSeconds;
        shark.depth = SEA_SURFACE - 7;
        shark.finUp = 1;
        if (e.t > e.window) {
          e.phase = 'dive';
          e.t = 0;
          e.diveFrom = { x: shark.x, y: shark.y, z: shark.z };
          seaNote('shark: dive', 'the fin goes under');
          sharkScore('dive');
        }
        return true;
      }
      if (e.phase === 'dive') {
        // Down, and round under the swimmer.
        const k = clamp(e.t / 2.2, 0, 1);
        shark.finUp = 0;
        shark.depth = SEA_SURFACE - 8 - 42 * Math.sin(k * Math.PI * 0.5);
        const tx = px - Math.cos(shark.a) * 12,
          ty = py - Math.sin(shark.a) * 12;
        shark.x += (tx - shark.x) * Math.min(1, deltaSeconds * 1.2);
        shark.y += (ty - shark.y) * Math.min(1, deltaSeconds * 1.2);
        shark.pitch += (0.3 - shark.pitch) * Math.min(1, deltaSeconds * 2);
        if (e.t > 2.4) {
          e.phase = 'breach';
          e.t = 0;
          e.at = { x: px, y: py };
          e.bite = false;
          seaNote('shark: breach', e.god ? 'god mode' : 'attack');
          sharkScore('attack');
          sharkRushSound(e.at);
        }
        return true;
      }
      if (e.phase === 'breach') {
        const t = e.t,
          at = e.at;
        shark.finUp = 0;
        shark.x += (at.x - shark.x) * Math.min(1, deltaSeconds * 10);
        shark.y += (at.y - shark.y) * Math.min(1, deltaSeconds * 10);
        if (t < 0.55) {
          // The lunge: nearly vertical, jaws opening, up through the swimmer.
          const k = t / 0.55;
          shark.z = SEA_SURFACE - 40 + 52 * (1 - Math.pow(1 - k, 2.2));
          shark.pitch = 0.5 + 0.85 * Math.min(1, k * 1.6);
          shark.mouth = Math.min(1, k * 1.8);
          shark.roll = 0;
          if (!e.surfaced && shark.z > SEA_SURFACE - 16) {
            e.surfaced = true;
            seaEvent('breach', at.x, at.y, 2.2, { a: shark.a });
            sharkBreachSound(at);
            shake = Math.max(shake, 6);
          }
        } else if (t < 0.85) {
          // The bite at the top.
          shark.z = SEA_SURFACE + 12 + Math.sin((t - 0.55) * 6) * 1.5;
          shark.mouth = Math.max(0, 1 - (t - 0.55) * 7);
          if (!e.bite) {
            e.bite = true;
            sharkBite();
          }
        } else if (t < 1.7) {
          // Over on its side and down, a wall of water.
          const k = (t - 0.85) / 0.85;
          shark.z = SEA_SURFACE + 12 - 40 * k * k;
          shark.pitch = 1.35 - 1.5 * k;
          shark.roll = (e.side || 1) * 1.45 * Math.min(1, k * 1.4);
          shark.mouth = e.god ? 0.25 * Math.sin(k * 9) : 0;
          if (!e.fell && shark.z < SEA_SURFACE + 2) {
            e.fell = true;
            seaEvent('breach', at.x + Math.cos(shark.a) * 18, at.y + Math.sin(shark.a) * 18, 2.8, { a: shark.a, fall: true });
            sharkFallSound(at);
            shake = Math.max(shake, 8);
          }
        } else {
          shark.roll *= Math.exp(-deltaSeconds * 2);
          shark.pitch += (-0.3 - shark.pitch) * Math.min(1, deltaSeconds * 2);
          shark.depth = SEA_SURFACE - 34;
          shark.z += (shark.depth - shark.z) * Math.min(1, deltaSeconds * 1.5);
          if (t > 2.6) {
            e.surfaced = false;
            e.fell = false;
            sharkEndEncounter(e.god ? 'god' : 'attack');
          }
        }
        return true;
      }
      return false;
    }
    /* The jaws close. God mode: it bites down and lets go. */
    function sharkBite() {
      const e = sharkEncounter;
      e.side = Math.random() < 0.5 ? -1 : 1;
      if (e.god || player.godMode || gameMode !== 'play' || !player.swimming) {
        e.god = true;
        seaEvent('splash', player.x, player.y, 1.6, { a: shark.a });
        seaEvent('blood', player.x, player.y, 0.35);
        // Shaken off and thrown clear.
        const a = shark.a + (Math.PI / 2) * e.side;
        teleportClear(player.x + Math.cos(a) * 34, player.y + Math.sin(a) * 34);
        player.swimming = true;
        player.altitude = SWIM_ALTITUDE;
        shake = Math.max(shake, 5);
        tell('GOD MODE · the shark bites down on something it cannot hurt, lets go and swims off', 4);
        seaNote('shark: bite', 'god mode: immune');
        return;
      }
      e.taken = true;
      seaEvent('blood', player.x, player.y, 1.4);
      seaEvent('splash', player.x, player.y, 1.9, { a: shark.a });
      seaNote('shark: bite', 'the player is taken');
      player.hidden = true;
      player.hp = 0;
      die();
      announce('TAKEN BY A GREAT WHITE', 'WASTED', 4.6);
      shake = Math.max(shake, 10);
    }
    /* Move the swimmer a little way without leaving the water (the god-mode shake-off). */
    function teleportClear(x, y) {
      if (landAt(x, y) || solid(x, y, 8, true)) return;
      player.x = x;
      player.y = y;
    }
    function updateShark(deltaSeconds) {
      const viewer = seaViewer(),
        e = sharkEncounter;
      e.cooldown = Math.max(0, e.cooldown - deltaSeconds);
      // A player taken stays hidden until the hospital puts them back.
      if (e.taken) {
        if (gameMode === 'play' && distanceBetween(player, shark) > 400) e.taken = false;
        else player.hidden = true;
      }
      if (!shark.active) {
        shark.spawnClock -= deltaSeconds;
        if (shark.spawnClock <= 0) {
          shark.spawnClock = 6;
          if (seaDistance(viewer.x, viewer.y) < 2400) sharkSpawnNear(viewer);
        }
        if (!shark.active && e.phase === 'none') return;
      }
      // Interest: swimming in its water, for a while.
      if (e.phase === 'none' && gameMode === 'play') {
        if (sharkWaterForPlayer() && !mission && e.cooldown <= 0) {
          const out = clamp(seaDistance(player.x, player.y) / 420, 0.7, 2),
            splash = (player.swimDrive || 0) > 0.8 ? 1.5 : 1,
            night = daylight() < 0.2 ? 1.3 : 1,
            blood = player.hp < 60 ? 1.5 : 1;
          e.interest += (deltaSeconds / 38) * out * splash * night * blood;
          if (e.interest >= 1 && Math.random() < deltaSeconds * 0.25) sharkStartEncounter('interest ' + e.interest.toFixed(2));
        } else e.interest = Math.max(0, e.interest - deltaSeconds / 20);
      }
      const hunting = updateSharkEncounter(deltaSeconds);
      if (!hunting && e.phase === 'none') {
        if (distanceBetween(shark, viewer) > 3400 && shark.mode !== 'retreat') {
          shark.active = false;
          shark.spawnClock = 4;
          return;
        }
        updateSharkPatrol(deltaSeconds, viewer);
      }
      // Body: depth, tail beat, fin wake bookkeeping.
      if (e.phase !== 'breach') {
        shark.z += (shark.depth - shark.z) * Math.min(1, deltaSeconds * 0.9);
        shark.mouth += (0 - shark.mouth) * Math.min(1, deltaSeconds * 3);
        if (e.phase !== 'dive') shark.pitch += (clamp((shark.depth - shark.z) * 0.03, -0.35, 0.35) - shark.pitch) * Math.min(1, deltaSeconds * 2);
        shark.roll *= Math.exp(-deltaSeconds * 2);
      }
      shark.phase += deltaSeconds * (2.2 + shark.speed * 0.09);
      updateBeachSharkAlarm(deltaSeconds);
    }
    function updateSharkPatrol(deltaSeconds, viewer) {
      // The occasional beach pass: along the buoy line with the fin up.
      shark.beachPassClock -= deltaSeconds;
      const nearBeach = Math.abs(viewer.x + 1970) < 1300 && Math.abs(viewer.y - 5650) < 1100;
      if (!shark.beachPass && shark.mode === 'patrol' && nearBeach && shark.beachPassClock <= 0) {
        shark.beachPassClock = 60;
        if (daylight() > 0.3 && beachDensity() > 0.25 && Math.random() < 0.2) sharkStartBeachPass();
      }
      if (shark.mode === 'retreat') {
        shark.retreatFor -= deltaSeconds;
        shark.finUp = 0;
        shark.depth = SEA_SURFACE - 38;
        if (shark.retreatFor <= 0) shark.mode = 'patrol';
      }
      if (shark.mode === 'bump') {
        updateSharkBump(deltaSeconds);
        return;
      }
      let target = shark.waypoint;
      if (shark.beachPass) {
        const bp = shark.beachPass;
        target = bp.points[bp.i];
        if (!target) {
          shark.beachPass = null;
          seaNote('shark: beach pass over');
          target = null;
        } else if (distanceBetween(shark, target) < 40) bp.i++;
        shark.finUp = 1;
        shark.depth = SEA_SURFACE - 7;
      }
      if (!target || distanceBetween(shark, target) < 90) {
        shark.waypoint = seaPointNear(viewer.x, viewer.y, 500, 1700, SHARK_WATER, 20) || seaPointNear(shark.x, shark.y, 300, 900, SHARK_WATER * 0.7, 20);
        target = shark.waypoint || { x: shark.x + Math.cos(shark.a) * 200, y: shark.y + Math.sin(shark.a) * 200 };
      }
      const cruise = (shark.beachPass ? 1.9 : shark.finUp > 0.5 ? 1.7 : 1.3) * UNITS_PER_METRE;
      shark.speed += (cruise - shark.speed) * Math.min(1, deltaSeconds * 0.5);
      seaSteer(shark, headingBetween(shark, target), deltaSeconds, 0.3, 160, shark.beachPass ? 150 : SHARK_WATER * 0.6);
      shark.x += Math.cos(shark.a) * shark.speed * deltaSeconds;
      shark.y += Math.sin(shark.a) * shark.speed * deltaSeconds;
      if (!shark.beachPass && shark.mode === 'patrol') {
        // Up to cruise with the fin out now and then.
        shark.finClock -= deltaSeconds;
        if (shark.finFor > 0) {
          shark.finFor -= deltaSeconds;
          shark.depth = SEA_SURFACE - 7;
          if (shark.z > SEA_SURFACE - 9) shark.finUp = Math.min(1, shark.finUp + deltaSeconds);
          if (shark.finFor <= 0) shark.finClock = 35 + Math.random() * 50;
        } else {
          shark.finUp = Math.max(0, shark.finUp - deltaSeconds * 0.5);
          shark.depth = SEA_SURFACE - 30 - Math.sin(gameTime * 0.05) * 8;
          if (shark.finClock <= 0) {
            shark.finFor = 10 + Math.random() * 12;
            seaNote('shark: fin up', Math.round(distanceBetween(shark, viewer)) + ' from the viewer');
          }
        }
      }
      // A small boat idling out here may get a bump from below.
      const c = player.car;
      shark.bumpClock = Math.max(0, shark.bumpClock - deltaSeconds);
      if (isBoat(c) && vehicleSpec(c).l < 80 && Math.abs(c.speed || 0) < 6 * KNOTS && seaDistance(c.x, c.y) > SHARK_WATER && !mission) {
        shark.bumpFor += deltaSeconds;
        if (shark.bumpFor > 25 && shark.bumpClock <= 0 && Math.random() < deltaSeconds / 40) sharkStartBump(c);
      } else shark.bumpFor = 0;
    }
    function sharkStartBeachPass() {
      if (typeof beachWaterline !== 'function' || sharkEncounter.phase !== 'none') return false;
      const { length } = beachWaterline(),
        west = Math.random() < 0.5,
        points = [];
      for (let i = 0; i <= 8; i++) {
        const s = 140 + ((length - 280) * (west ? i : 8 - i)) / 8,
          p = shoreAt(s, -275 - Math.sin(i * 0.9) * 25);
        if (seaOpen(p.x, p.y, 60)) points.push({ x: p.x, y: p.y });
      }
      if (points.length < 4) return false;
      // Come in from offshore of the first point.
      const start = points[0],
        a = Math.atan2(start.y - 5550, start.x + 1970);
      sharkPlace(start.x + Math.cos(a) * 250, start.y + Math.sin(a) * 250 + 200, 0);
      shark.z = SEA_SURFACE - 20;
      shark.mode = 'patrol';
      shark.beachPass = { points, i: 0, started: gameTime };
      seaNote('shark: beach pass', 'along the buoy line');
      return true;
    }
    function sharkStartBump(c) {
      shark.mode = 'bump';
      shark.bumpBoat = c;
      shark.bumpT = 0;
      shark.bumped = false;
      const a = Math.random() * TAU;
      shark.x = c.x + Math.cos(a) * 220;
      shark.y = c.y + Math.sin(a) * 220;
      shark.a = a + Math.PI;
      shark.z = SEA_SURFACE - 30;
      seaNote('shark: boat bump', vehicleSpec(c).label || c.type);
    }
    function updateSharkBump(deltaSeconds) {
      const c = shark.bumpBoat;
      shark.bumpT += deltaSeconds;
      if (!c || c !== player.car) {
        shark.mode = 'retreat';
        shark.retreatFor = 10;
        return;
      }
      if (!shark.bumped) {
        // Up from below, straight at the hull.
        const want = headingBetween(shark, c);
        shark.a = normalizeAngle(shark.a + clamp(normalizeAngle(want - shark.a), -1.5 * deltaSeconds, 1.5 * deltaSeconds));
        shark.speed += (6 * UNITS_PER_METRE - shark.speed) * Math.min(1, deltaSeconds);
        shark.depth = SEA_SURFACE - 14;
        shark.finUp = 0;
        shark.x += Math.cos(shark.a) * shark.speed * deltaSeconds;
        shark.y += Math.sin(shark.a) * shark.speed * deltaSeconds;
        if (distanceBetween(shark, c) < 16 || shark.bumpT > 9) {
          shark.bumped = true;
          shark.bumpT = 0;
          const side = Math.sin(normalizeAngle(shark.a - c.a)) > 0 ? 1 : -1;
          c.av = (c.av || 0) + side * 1.1;
          const push = 1.4 * UNITS_PER_METRE;
          c.vx = (c.vx || 0) + Math.cos(shark.a) * push;
          c.vy = (c.vy || 0) + Math.sin(shark.a) * push;
          c.bumpRock = 1;
          shake = Math.max(shake, 4.5);
          seaEvent('splash', c.x + Math.cos(shark.a + Math.PI) * 8, c.y + Math.sin(shark.a + Math.PI) * 8, 1.1, { a: shark.a });
          sharkBumpSound(c);
          tell('THUD · something big just hit the hull', 3.5);
          shark.bumpClock = 300;
          shark.bumpFor = 0;
        }
        return;
      }
      // Then one slow circle with the fin out, and away.
      const r = 60,
        t = shark.bumpT * 0.12;
      const tx = c.x + Math.cos(t * TAU + shark.a) * r,
        ty = c.y + Math.sin(t * TAU + shark.a) * r;
      shark.a = normalizeAngle(shark.a + clamp(normalizeAngle(Math.atan2(ty - shark.y, tx - shark.x) - shark.a), -1.2 * deltaSeconds, 1.2 * deltaSeconds));
      shark.speed += (2.4 * UNITS_PER_METRE - shark.speed) * Math.min(1, deltaSeconds);
      shark.x += Math.cos(shark.a) * shark.speed * deltaSeconds;
      shark.y += Math.sin(shark.a) * shark.speed * deltaSeconds;
      shark.depth = SEA_SURFACE - 7;
      shark.finUp = Math.min(1, shark.finUp + deltaSeconds);
      if (shark.bumpT > 11) {
        shark.mode = 'retreat';
        shark.retreatFor = 12;
        shark.waypoint = null;
      }
    }
    /**
     * THE BEACH ALARM
     * The fin seen off the beach (a pass along the buoy line, or the shark
     * circling a swimmer within sight of it): the nearest people on the sand
     * turn and point and shout, the lifeguards whistle and call everyone in,
     * and the swimmers race for the shore, wade out and stand at the waterline
     * watching until the fin has gone. They leave the water a while afterwards.
     * (Hooked into updateBeach through `beachSharkStep`.)
     */
    const BEACH_SHOUTS = ['SHARK!', 'SHARK!!', 'Get out of the water!', 'There, look! A fin!', 'Oh my God, SHARK!', 'Everybody out!', 'Is that a shark?!'];
    function beachFinInSight() {
      if (!shark.active || shark.finUp < 0.5 || typeof beachgoers === 'undefined' || !beachgoers.length) return false;
      if (Math.abs(shark.x + 1970) > 1000 || shark.y < 5400 || shark.y > 6500) return false;
      const shelf = beachShelfDistance(shark.x, shark.y);
      return shelf < 560;
    }
    function updateBeachSharkAlarm(deltaSeconds) {
      const a = beachAlarm;
      if (beachFinInSight()) {
        if (a.until < gameTime) {
          a.started = gameTime;
          seaNote('beach: SHARK! alarm', 'fin ' + Math.round(beachShelfDistance(shark.x, shark.y)) + ' off the waterline');
          beachSharkAlarmStart();
        }
        a.until = gameTime + 25;
      }
      if (a.until < gameTime) {
        if (a.speakers.length) a.speakers.length = 0;
        return;
      }
      // Whistles and shouts while it lasts.
      if (gameTime > a.whistleAt) {
        a.whistleAt = gameTime + 1.6 + Math.random() * 1.2;
        const tower = (BEACH_LAYOUT.towers || [])[Math.floor(Math.random() * BEACH_LAYOUT.towers.length)];
        if (tower && gameTime - a.started < 30) lifeguardWhistle(tower);
      }
      for (const s of a.speakers) {
        const p = s.person;
        s.x = p.x;
        s.y = p.y;
        s.bubbleZ = (p.z || 0) + PERSON_HEIGHT + 9.5;
        if (s.speechUntil < gameTime && gameTime < a.until - 10 && Math.random() < deltaSeconds * 0.25) {
          s.speech = BEACH_SHOUTS[Math.floor(Math.random() * BEACH_SHOUTS.length)];
          s.speechUntil = gameTime + 2.6;
        }
      }
      if (gameTime > a.shoutAt && gameTime - a.started < 20) {
        a.shoutAt = gameTime + 2.5 + Math.random() * 3;
        beachShoutSound();
      }
    }
    function beachSharkAlarmStart() {
      const a = beachAlarm,
        fin = { x: shark.x, y: shark.y },
        lookers = [];
      a.speakers.length = 0;
      for (const p of beachgoers) {
        if (!p.visible || p.state === 'off' || p.state === 'flee') continue;
        if (p.kind === 'swimmer' || p.kind === 'wader') {
          // Race for the shore, wade out, stand and watch.
          const s = shoreS(p.x),
            land = shoreAt(s, 30 + Math.random() * 40);
          p.sharkRush = { phase: p.kind === 'swimmer' ? 'swim' : 'wade', target: land, watch: 0 };
          continue;
        }
        if (p.kind === 'rider' || p.kind === 'vendor' || p.kind === 'patron') continue;
        const d = Math.hypot(p.x - fin.x, p.y - fin.y);
        if (d < 1100) lookers.push({ p, d });
      }
      lookers.sort((q, r) => q.d - r.d);
      lookers.slice(0, 14).forEach(({ p }, i) => {
        p.sharkRush = { phase: 'point', until: gameTime + 12 + Math.random() * 14, delay: i * 0.25 + Math.random() * 0.6 };
      });
      // Three voices at a time carry the shouting (their bubbles).
      for (const { p } of lookers.slice(0, 3))
        a.speakers.push({ person: p, x: p.x, y: p.y, bubbleZ: PERSON_HEIGHT + 9.5, hp: 1, speech: 'SHARK!', speechUntil: gameTime + 2.6 + Math.random(), speechKind: 'shout', speechKindText: 'SHARK!' });
      const guard = beachgoers.find((p) => p.kind === 'lifeguard' && p.visible);
      if (guard) {
        guard.sharkRush = { phase: 'point', until: gameTime + 25, delay: 0 };
        a.speakers.push({ person: guard, x: guard.x, y: guard.y, bubbleZ: (guard.z || 0) + PERSON_HEIGHT + 9.5, hp: 1, speech: 'EVERYBODY OUT OF THE WATER!', speechUntil: gameTime + 3.5, speechKind: 'shout', speechKindText: 'EVERYBODY OUT OF THE WATER!' });
      }
      a.whistleAt = gameTime;
      a.shoutAt = gameTime + 0.3;
      beachSpooked = Math.max(beachSpooked, 120);
    }
    /**
     * Called by updateBeach for a beachgoer caught up in the alarm, in place of
     * its usual behaviour; returns false once it is over (the slot goes back to
     * its routine, or leaves the water for a while).
     */
    function beachSharkStep(p, deltaSeconds) {
      const r = p.sharkRush,
        fin = shark,
        finAngle = Math.atan2(fin.y - p.y, fin.x - p.x);
      p.phase += deltaSeconds;
      if (r.phase === 'point') {
        if (r.delay > 0) {
          r.delay -= deltaSeconds;
          return false;
        }
        if (gameTime > r.until && beachAlarm.until < gameTime + 15) {
          p.sharkRush = null;
          return false;
        }
        p.a += normalizeAngle(finAngle - p.a) * Math.min(1, deltaSeconds * 4);
        // Everyone on their feet (off the towel, up on the tower deck), pointing.
        p.pose = 'point';
        p.z = p.tower ? 19.2 : 0;
        return true;
      }
      if (r.phase === 'swim') {
        const d = Math.hypot(r.target.x - p.x, r.target.y - p.y),
          a = Math.atan2(r.target.y - p.y, r.target.x - p.x);
        p.a += normalizeAngle(a - p.a) * Math.min(1, deltaSeconds * 3);
        const sp = 5.5 * KMH;
        p.x += Math.cos(p.a) * sp * deltaSeconds;
        p.y += Math.sin(p.a) * sp * deltaSeconds;
        p.pose = 'swim';
        p.z = -4.4 + Math.sin(gameTime * 2 + p.threshold * 9) * 0.4;
        if (beachShelfDistance(p.x, p.y) < WADE_DEPTH - 10 || d < 20) r.phase = 'wade';
        return true;
      }
      if (r.phase === 'wade') {
        const done = beachWalkTo(p, r.target, 32, deltaSeconds);
        const depth = clamp(beachShelfDistance(p.x, p.y) / WADE_DEPTH, 0, 1);
        const wet = !groundAt(p.x, p.y, 2);
        p.pose = wet ? 'wadeWalk' : 'run';
        p.z = wet && Number.isFinite(depth) ? -1.5 - depth * 6.5 : 0;
        if (wet && Math.random() < deltaSeconds * 3) particle(p.x, p.y, '#e6f4f7', 2, 25, 2);
        if (done) {
          r.phase = 'watch';
          r.watch = 0;
        }
        return true;
      }
      if (r.phase === 'watch') {
        r.watch += deltaSeconds;
        p.z = 0;
        p.a += normalizeAngle(finAngle - p.a) * Math.min(1, deltaSeconds * 3);
        p.pose = Math.sin(r.watch * 0.7 + p.threshold * 5) > -0.2 ? 'point' : 'stand';
        if (beachAlarm.until < gameTime && r.watch > 8) {
          // Nobody goes back in for a while: the slot leaves and comes back later.
          p.sharkRush = null;
          p.state = 'off';
          p.visible = false;
          p.fledFor = 120 + Math.random() * 120;
          return true;
        }
        return true;
      }
      p.sharkRush = null;
      return false;
    }
    /* The alarm's voices, for the speech bubbles (crowd.js speechBubbles). */
    function sealifeSpeakers() {
      return beachAlarm.until > gameTime ? beachAlarm.speakers : [];
    }
    // ============================================================================
    /**
     * UPDATE
     * Called from update() every frame of play, and while WASTED plays out (so
     * a breach finishes its fall). Nothing runs until the sea field is ready.
     */
    function updateSeaLife(deltaSeconds) {
      if (!seaFieldStep()) return;
      const dt = Math.min(deltaSeconds, 0.1);
      updateDolphinPods(dt);
      updateGulls(dt);
      updateShark(dt);
    }
    /* The HUD's warning: SHARK! with the bearing and distance to the fin. */
    function sharkWarning() {
      const e = sharkEncounter;
      if (e.phase !== 'approach' && e.phase !== 'circle' && e.phase !== 'dive') return null;
      return {
        phase: e.phase,
        x: shark.x,
        y: shark.y,
        d: distanceBetween(shark, player),
        left: e.phase === 'dive' ? 0 : Math.max(0, e.window - e.t),
        exit: e.exit,
      };
    }
    // ---- Console ------------------------------------------------------------------
    function sealifeReport() {
      const r = (v) => Math.round(v);
      const counts = {};
      for (const g of gulls) counts[g.mode] = (counts[g.mode] || 0) + 1;
      return {
        clock: clockText(),
        field: seaField.state,
        here: { seaDistanceM: +worldMeters(seaDistance(player.x, player.y)).toFixed(1), noGo: seaNoGo(player.x, player.y), sharkWater: sharkWaterForPlayer() },
        dolphins: {
          ratePerGameHour: +dolphinRate().toFixed(2),
          sightings: dolphinSightings,
          pods: dolphinPods.map((p) => ({
            id: p.id,
            x: r(p.x),
            y: r(p.y),
            count: p.members.length,
            age: r(p.age),
            riding: p.ride ? (p.ride.boat === player.car ? 'player boat' : 'liner') : null,
            modes: p.members.map((m) => m.mode),
            z: p.members.map((m) => +(m.z - SEA_SURFACE).toFixed(1)),
          })),
        },
        gulls: {
          pool: GULL_POOL,
          byMode: counts,
          flocks: GULL_FLOCKS.filter((f) => f.active).map((f) => ({ name: f.name, perches: (f.perches || []).length, gulls: gulls.filter((g) => g.flock === f).length })),
          following: gulls.filter((g) => g.mode === 'follow').length,
        },
        shark: {
          active: shark.active,
          mode: shark.mode,
          x: r(shark.x),
          y: r(shark.y),
          depthM: +worldMeters(SEA_SURFACE - shark.z).toFixed(1),
          finUp: +shark.finUp.toFixed(2),
          speedKmh: +speedKmh(shark.speed).toFixed(1),
          beachPass: !!shark.beachPass,
          distanceM: r(worldMeters(distanceBetween(shark, player))),
          seaDistanceM: r(worldMeters(seaDistance(shark.x, shark.y))),
        },
        encounter: {
          phase: sharkEncounter.phase,
          t: +sharkEncounter.t.toFixed(1),
          window: +sharkEncounter.window.toFixed(1),
          interest: +sharkEncounter.interest.toFixed(2),
          cooldown: r(sharkEncounter.cooldown),
          exit: sharkEncounter.exit,
          count: sharkEncounter.count,
          escapes: sharkEncounter.escapes,
          attacks: sharkEncounter.attacks,
          last: sharkEncounter.last,
        },
        beachAlarm: beachAlarm.until > gameTime ? { seconds: r(beachAlarm.until - gameTime), rushing: beachgoers.filter((p) => p.sharkRush).length } : null,
        log: seaLog.slice(-24),
        render: sealifeRenderStats ? sealifeRenderStats() : null,
      };
    }
    /**
     * Test: start the shark encounter. If the player is not swimming in deep
     * water they are put in the sea 90 m off Palm Keys Beach first. `stage`
     * 'breach' skips to the attack itself; 'fin' only brings the fin up nearby.
     */
    function sharkAttackConsole(stage = 'approach') {
      seaFieldStep(1e9);
      if (stage === 'fin') {
        const p = seaPointNear(player.x, player.y, 120, 400, 150, 40) || seaPointNear(-1980, 6300, 0, 200, 100, 20);
        if (!p) return sealifeReport();
        sharkPlace(p.x, p.y, Math.random() * TAU);
        shark.mode = 'patrol';
        shark.z = shark.depth = SEA_SURFACE - 7;
        shark.finFor = 30;
        shark.finUp = 1;
        return sealifeReport();
      }
      if (stage === 'beach') {
        sharkStartBeachPass();
        const bp = shark.beachPass;
        if (bp) {
          // Straight onto the second point with the fin up.
          sharkPlace(bp.points[1].x, bp.points[1].y, headingBetween(bp.points[1], bp.points[2]));
          bp.i = 2;
          shark.z = SEA_SURFACE - 7;
          shark.finUp = 1;
        }
        return sealifeReport();
      }
      if (!sharkWaterForPlayer()) {
        const spot = seaPointNear(-1980, 6380, 0, 160, SHARK_DEEP_SWIM + 20, 40) || { x: -1980, y: 6420 };
        teleportPlayer(spot.x, spot.y);
        player.swimming = true;
        player.wading = 0;
        player.altitude = SWIM_ALTITUDE;
      }
      sharkEncounter.cooldown = 0;
      sharkEncounter.phase = 'none';
      sharkStartEncounter('console');
      if (stage === 'breach') {
        sharkEncounter.phase = 'dive';
        sharkEncounter.t = 2.3;
        sharkPlace(player.x, player.y, shark.a);
        shark.z = SEA_SURFACE - 40;
      } else if (stage === 'circle') {
        sharkEncounter.radius = 150;
        sharkEncounter.phase = 'circle';
      }
      return sealifeReport();
    }
    /* Test: a pod of `count` dolphins near the player (or at x, y), leaping soon. */
    function spawnDolphinsConsole(count = 4, x, y, leap = true) {
      seaFieldStep(1e9);
      const pod = spawnDolphinPod({ count, x, y, leap, near: x === undefined });
      if (pod && leap)
        pod.members.forEach((m, i) => {
          m.next = 0.4 + i * 0.7;
          m.leapNext = true;
        });
      return pod ? { id: pod.id, x: Math.round(pod.x), y: Math.round(pod.y), count: pod.members.length } : null;
    }
    // END SUBSYSTEM: src/sealife.js
