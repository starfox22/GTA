    // The Meridian Star's voyage: legs, speed zones, the path, sailing, carrying her decks, the horn and the route check (LINER_VOYAGE, sailLiner).
    /**
     * THE VOYAGE
     * The Meridian Star's grand tour of the islands, as legs sailed in turn and
     * then again (about 18 minutes of play a lap; linerVoyageCheck() times it):
     *   call    riding at anchor for `seconds`: off the cruise terminal in North
     *           Sound (where her stern platform takes passengers from the water),
     *           and a tender call off Palm Keys' public beach
     *   astern  backing out of North Sound along `points`
     *   ahead   under way: out north about Sunset Pier island, east along Monarch
     *           Isle's north shore and back, down the open sea past Ocean Drive's
     *           strand and slow along the beach to her anchorage there; then out
     *           to sea, north well offshore and in to North Sound
     * The islands are all joined by bridges and she never passes under one
     * (every deck is at road level, far below her funnels), so the tour keeps to
     * the open water outside them and doubles back where a bridge closes the way:
     * Sunset Pier's bridge closes North Sound to the east, so the way to Monarch
     * Isle is north about Sunset Pier, out and back.
     * A leg's `points` are a control polygon; each corner is filleted with a
     * circular arc of its own radius (`[x, y, radius]`), a turning circle a
     * 170 m ship can hold. Speed is limited by where she is (LINER_SPEED_ZONES:
     * slow in the sound and off the beach, moderate along the islands, 20 knots
     * at sea) and by the curve (lateral acceleration LINER_TURN_GRIP), and she
     * brakes in good time for every stop. linerVoyageCheck() sweeps her hull
     * down the whole tour against land, bridge footings, docks, the other ships
     * and the world edge (LINER_EDGE_MARGIN inside worldEdgeLine).
     */
    const LINER_VOYAGE = [
      { kind: 'call', seconds: 50, name: 'NORTH SOUND ANCHORAGE', detail: 'OFF THE CRUISE TERMINAL' },
      {
        kind: 'astern',
        points: [
          [2150, -5000],
          [960, -5000],
        ],
        top: 6 * KNOTS,
      },
      {
        kind: 'ahead',
        // North about Sunset Pier, Monarch Isle's north shore and back, then down
        // past Ocean Drive and slow along the public beach to her anchorage.
        points: [
          [960, -5000],
          [1320, -5000, 450],
          [1320, -7420, 1000],
          [4900, -7420, 1100],
          [6300, -5950, 1100],
          [9400, -5950, 750],
          [9400, -7400, 750],
          [1100, -7450, 1100],
          [-3500, -2000, 1500],
          [-3500, 6650, 1000],
          [-1900, 6650],
        ],
        top: 21 * KNOTS,
      },
      // At anchor off the beach she swings round on her thrusters (`swing`, radians
      // over the call's middle) to leave westward.
      { kind: 'call', seconds: 40, name: 'PALM KEYS ANCHORAGE', detail: 'OFF THE PUBLIC BEACH', swing: Math.PI },
      {
        kind: 'ahead',
        // West past the beach-club point, north well offshore, in to North Sound.
        points: [
          [-1900, 6650],
          [-4350, 6650, 1000],
          [-4350, -3000, 1500],
          [-1000, -5000, 1200],
          [2150, -5000],
        ],
        top: 21 * KNOTS,
      },
    ];
    // Speed limits by area, in knots: dead slow in the sound and off the beach, moderate along the islands.
    const LINER_SPEED_ZONES = [
      { x0: -300, x1: 3300, y0: -6000, y1: -4000, top: 7.6 * KNOTS },
      { x0: -1800, x1: 1900, y0: -5800, y1: -4000, top: 12 * KNOTS },
      { x0: 1000, x1: 4600, y0: -8000, y1: -7000, top: 19 * KNOTS },
      { x0: 5500, x1: 9800, y0: -6400, y1: -5500, top: 19 * KNOTS },
      { x0: -3800, x1: -3200, y0: -2400, y1: 5600, top: 19 * KNOTS },
      { x0: -2900, x1: -1000, y0: 6000, y1: 7100, top: 8 * KNOTS },
    ];
    // Named waters on the tour, in its order, for liners() and the tests.
    const LINER_PASSAGES = [
      { name: 'HARBOR POINT', x0: 0, x1: 3300, y0: -5800, y1: -4000 },
      { name: 'SUNSET PIER', x0: 1000, x1: 4600, y0: -8000, y1: -7000 },
      { name: 'MONARCH ISLE', x0: 5500, x1: 9800, y0: -6500, y1: -5500 },
      { name: 'OCEAN DRIVE', x0: -3800, x1: -3200, y0: -1600, y1: 5000 },
      { name: 'PALM KEYS BEACH', x0: -3300, x1: -1000, y0: 6000, y1: 7100 },
      { name: 'OPEN SEA', x0: -4928, x1: -4000, y0: -3000, y1: 6000 },
    ];
    // Her hull keeps at least this far inside the world-edge line (world-edge.js).
    const LINER_EDGE_MARGIN = 200;
    function linerPassageAt(x, y) {
      return LINER_PASSAGES.find((p) => x > p.x0 && x < p.x1 && y > p.y0 && y < p.y1)?.name ?? null;
    }
    // Lateral grip (a brisk turn: she heels a couple of degrees), acceleration and braking in m/s², as map units.
    const LINER_TURN_GRIP = 0.4 * UNITS_PER_METRE,
      LINER_ACCELERATION = 0.16 * UNITS_PER_METRE,
      LINER_BRAKING = 0.13 * UNITS_PER_METRE;
    /* A leg's path: the control polygon with filleted corners, resampled every 8
       units into {x, y, a (heading of travel), k (curvature)} and a speed cap per
       sample that already allows for braking into slower water and the stop. */
    function linerLegPath(leg) {
      if (leg.path) return leg.path;
      const pts = leg.points,
        raw = [{ x: pts[0][0], y: pts[0][1] }],
        add = (x, y) => {
          const last = raw[raw.length - 1];
          if (Math.hypot(x - last.x, y - last.y) > 0.5) raw.push({ x, y });
        };
      for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i - 1],
          [cx, cy, radius = 600] = pts[i],
          [nx, ny] = pts[i + 1],
          l1 = Math.hypot(cx - px, cy - py),
          l2 = Math.hypot(nx - cx, ny - cy),
          d1 = { x: (cx - px) / l1, y: (cy - py) / l1 },
          d2 = { x: (nx - cx) / l2, y: (ny - cy) / l2 },
          turn = Math.atan2(d1.x * d2.y - d1.y * d2.x, d1.x * d2.x + d1.y * d2.y),
          half = Math.tan(Math.abs(turn) / 2);
        if (half < 1e-3) {
          add(cx, cy);
          continue;
        }
        // A corner shares each side with its neighbour except at the ends.
        const t = Math.min(radius * half, i === 1 ? l1 : l1 / 2, i === pts.length - 2 ? l2 : l2 / 2),
          r = t / half,
          sx = cx - d1.x * t,
          sy = cy - d1.y * t,
          side = Math.sign(turn),
          ox = sx - d1.y * r * side,
          oy = sy + d1.x * r * side,
          a0 = Math.atan2(sy - oy, sx - ox),
          steps = Math.max(2, Math.ceil((Math.abs(turn) * r) / 10));
        add(sx, sy);
        for (let k = 1; k <= steps; k++) {
          const th = a0 + (turn * k) / steps;
          add(ox + Math.cos(th) * r, oy + Math.sin(th) * r);
        }
      }
      add(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      // Resample evenly by arc length.
      const samples = [];
      let carried = 0;
      for (let i = 0; i < raw.length - 1; i++) {
        const a = raw[i],
          b = raw[i + 1],
          len = Math.hypot(b.x - a.x, b.y - a.y);
        for (let d = carried; d < len; d += 8) samples.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
        carried = (carried - len) % 8;
        if (carried < 0) carried += 8;
      }
      samples.push({ x: raw[raw.length - 1].x, y: raw[raw.length - 1].y });
      for (let i = 0; i < samples.length; i++) {
        const p = samples[Math.max(0, i - 1)],
          n = samples[Math.min(samples.length - 1, i + 1)];
        samples[i].a = Math.atan2(n.y - p.y, n.x - p.x);
        samples[i].s = i * 8;
      }
      samples[samples.length - 1].s = samples.length > 1 ? samples[samples.length - 2].s + Math.hypot(samples.at(-1).x - samples.at(-2).x, samples.at(-1).y - samples.at(-2).y) : 0;
      for (let i = 0; i < samples.length; i++) {
        const p = samples[Math.max(0, i - 3)],
          n = samples[Math.min(samples.length - 1, i + 3)];
        samples[i].k = n.s > p.s ? normalizeAngle(n.a - p.a) / (n.s - p.s) : 0;
      }
      // Speed caps: area and curve, then a backward pass so she brakes in time.
      for (const p of samples) {
        let top = leg.top;
        for (const z of LINER_SPEED_ZONES) if (p.x > z.x0 && p.x < z.x1 && p.y > z.y0 && p.y < z.y1) top = Math.min(top, z.top);
        if (Math.abs(p.k) > 1e-5) top = Math.min(top, Math.sqrt(LINER_TURN_GRIP / Math.abs(p.k)));
        p.top = top;
      }
      samples[samples.length - 1].top = 0;
      for (let i = samples.length - 2; i >= 0; i--)
        samples[i].top = Math.min(samples[i].top, Math.sqrt(samples[i + 1].top ** 2 + 2 * LINER_BRAKING * 0.8 * (samples[i + 1].s - samples[i].s)));
      leg.length = samples[samples.length - 1].s;
      return (leg.path = samples);
    }
    function linerPathAt(path, s) {
      const i = clamp(Math.floor(s / 8), 0, path.length - 2),
        p = path[i],
        n = path[i + 1],
        f = clamp((s - p.s) / Math.max(1e-6, n.s - p.s), 0, 1);
      return {
        x: p.x + (n.x - p.x) * f,
        y: p.y + (n.y - p.y) * f,
        a: p.a + normalizeAngle(n.a - p.a) * f,
        k: p.k + (n.k - p.k) * f,
        top: p.top + (n.top - p.top) * f,
      };
    }
    // Where she is in the voyage. She starts at anchor, a little before sailing.
    const linerVoyage = { leg: 0, s: 0, speed: 0, timer: 45, drift: 0, heel: 0, horn: 0, hornQueue: [] };
    function sailingLiner() {
      return LINERS.find((ship) => ship.voyage);
    }
    /**
     * One step of the voyage: speed toward the path's cap within the ship's
     * acceleration and braking, along the path, heading with a little drift into
     * each turn. Everything aboard goes with her; boats and swimmers in her way
     * are pushed aside.
     */
    function sailLiner(deltaSeconds) {
      const ship = sailingLiner();
      if (!ship) return;
      const v = linerVoyage,
        leg = LINER_VOYAGE[v.leg],
        before = { x: ship.x, y: ship.y, a: ship.a },
        carried = player.deck === ship ? deckLocal(ship, player.x, player.y) : null;
      if (leg.kind === 'call') {
        v.speed = 0;
        v.timer += deltaSeconds;
        if (leg.swing) ship.a = linerCallHeading(v.leg, v.timer);
        // One prolonged blast before she weighs anchor.
        if (v.timer >= leg.seconds - 9 && !v.warned) {
          v.warned = true;
          linerHorn(ship, [5]);
        }
        if (v.timer >= leg.seconds) nextLinerLeg(ship);
      } else {
        const path = linerLegPath(leg),
          here = linerPathAt(path, v.s),
          cap = Math.max(here.top, v.s < leg.length - 1 ? 1.2 : 0);
        v.speed += clamp(cap - v.speed, -LINER_BRAKING * deltaSeconds, LINER_ACCELERATION * deltaSeconds);
        v.s = Math.min(leg.length, v.s + Math.max(0, v.speed) * deltaSeconds);
        const at = linerPathAt(path, v.s),
          astern = leg.kind === 'astern';
        // Drift: the bow stays a little inside the turn, more as she goes faster.
        v.drift += (clamp(at.k * v.speed * 2.2, -0.07, 0.07) - v.drift) * Math.min(1, deltaSeconds * 0.5);
        v.heel += (clamp(-at.k * v.speed * v.speed * 0.012, -0.03, 0.03) - v.heel) * Math.min(1, deltaSeconds * 0.4);
        ship.x = at.x;
        ship.y = at.y;
        ship.a = normalizeAngle(at.a + (astern ? Math.PI : 0) + (astern ? 0 : v.drift));
        if (v.s >= leg.length - 0.01) nextLinerLeg(ship);
      }
      ship.speed = leg.kind === 'astern' ? -v.speed : leg.kind === 'call' ? 0 : v.speed;
      if (v.hornQueue.length && (v.horn -= deltaSeconds) <= 0) linerHorn(ship, v.hornQueue.shift());
      const moved = ship.x !== before.x || ship.y !== before.y || ship.a !== before.a;
      if (!moved) return;
      carryLinerDeck(ship, carried);
      clearLinerWay(ship);
    }
    /* Where and how she rides during call `index`, `timer` seconds into it: at
       the end of the leg before, heading as she came to rest there, swung round
       by the call's `swing` (radians, eased over the middle 60 % of the call). */
    function linerCallPose(index, timer = 0) {
      const leg = LINER_VOYAGE[index],
        prev = LINER_VOYAGE[(index + LINER_VOYAGE.length - 1) % LINER_VOYAGE.length],
        end = linerLegPath(prev).at(-1),
        base = end.a + (prev.kind === 'astern' ? Math.PI : 0),
        k = leg.swing ? clamp((timer - leg.seconds * 0.2) / (leg.seconds * 0.6), 0, 1) : 0;
      return { x: end.x, y: end.y, a: normalizeAngle(base + (leg.swing || 0) * k * k * (3 - 2 * k)) };
    }
    function linerCallHeading(index, timer) {
      return linerCallPose(index, timer).a;
    }
    function nextLinerLeg(ship) {
      const v = linerVoyage;
      v.leg = (v.leg + 1) % LINER_VOYAGE.length;
      v.s = 0;
      v.timer = 0;
      v.warned = false;
      const leg = LINER_VOYAGE[v.leg];
      // Sound signals: three short blasts going astern, one short blast as she
      // gets under way ahead, a long one as she comes to anchor.
      if (leg.kind === 'astern') {
        v.hornQueue.push([1, 1, 1]);
        v.horn = 3;
      } else if (leg.kind === 'ahead') {
        v.hornQueue.push([1.2]);
        v.horn = 2;
      } else {
        v.hornQueue.push([4]);
        v.horn = 1;
      }
      if (leg.kind !== 'call') {
        const start = linerPathAt(linerLegPath(leg), 0);
        ship.x = start.x;
        ship.y = start.y;
      }
      v.speed = 0;
    }
    /* Everyone aboard stays where they stand on deck while she moves: passengers
       keep ship-frame positions (du, dv) and the player is carried by the same
       rule. */
    function carryLinerDeck(ship, carried) {
      for (const p of ship.passengers || []) {
        const w = deckWorld(ship, p.du, p.dv);
        p.x = w.x;
        p.y = w.y;
        p.a = ship.a + p.da;
      }
      if (carried && player.deck === ship) {
        const w = deckWorld(ship, carried.u, carried.v);
        player.a += normalizeAngle(ship.a - (player.deckHeading ?? ship.a));
        player.x = w.x;
        player.y = w.y;
      }
      player.deckHeading = ship.a;
    }
    /* A 50,000-tonne ship does not stop for a jet ski: boats in her way are
       shoved clear across her side (and knocked about if caught at speed), and a
       swimmer is pushed off her hull. */
    function clearLinerWay(ship) {
      const hull = shipHull(ship),
        reach = ship.l / 2 + 60;
      for (const c of vehicles) {
        if (!isBoat(c) || Math.abs(c.x - ship.x) > reach || Math.abs(c.y - ship.y) > reach) continue;
        if (!boxContact(vehicleShape(c, 1), hull)) continue;
        const { u, v } = deckLocal(ship, c.x, c.y),
          side = v >= 0 ? 1 : -1,
          out = ship.w / 2 + Math.hypot(vehicleSpec(c).l, vehicleSpec(c).w) / 2 + 4,
          target = deckWorld(ship, u, side * out),
          push = { x: target.x - c.x, y: target.y - c.y };
        if (boatFits(c, target.x, target.y, c.a)) {
          c.x = target.x;
          c.y = target.y;
        }
        const n = Math.hypot(push.x, push.y) || 1;
        c.vx = (c.vx || 0) + (push.x / n) * 40;
        c.vy = (c.vy || 0) + (push.y / n) * 40;
        if (Math.abs(linerVoyage.speed) > 12 && physicsClock - (c.linerHit || -9) > 1) {
          damageVehicle(c, Math.abs(linerVoyage.speed) * 0.4, c.x, c.y);
          c.linerHit = physicsClock;
        }
      }
      if (player.swimming && linerHullAt(ship, player.x, player.y, 8)) {
        const { u, v } = deckLocal(ship, player.x, player.y),
          w = deckWorld(ship, u, (v >= 0 ? 1 : -1) * (hullHalfBeam(ship, u) + 12));
        player.x = w.x;
        player.y = w.y;
      }
    }
    // Inside a liner's hull in plan (for swimmers and the checks).
    function linerHullAt(ship, x, y, r = 0) {
      const { u, v } = deckLocal(ship, x, y);
      return Math.abs(u) < ship.l / 2 + r && Math.abs(v) < hullHalfBeam(ship, u) + r;
    }
    /* The liner's horn: a deep chord of sawtooth through a low-pass, swelling
       and dying slowly, heard right across the harbour. `blasts` are lengths in
       seconds (1 is short, 4 or more prolonged). */
    function linerHorn(ship, blasts) {
      if (!audio || !soundOn || gameMode !== 'play' || !buildAmbience()) return;
      const where = spatial(ship, 1000);
      if (where.gain < 0.12) return;
      let start = audio.currentTime + 0.05;
      for (const length of blasts) {
        for (const [frequency, level] of [
          [72, 1],
          [108, 0.62],
          [144, 0.3],
        ]) {
          const o = audio.createOscillator(),
            filter = audio.createBiquadFilter(),
            g = audio.createGain(),
            pan = audio.createStereoPanner(),
            peak = 0.2 * level * where.gain;
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(frequency * 0.96, start);
          o.frequency.linearRampToValueAtTime(frequency, start + 0.4);
          filter.type = 'lowpass';
          filter.frequency.value = 480;
          filter.Q.value = 1.4;
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(peak, start + 0.35);
          g.gain.setValueAtTime(peak, start + Math.max(0.4, length - 0.3));
          g.gain.exponentialRampToValueAtTime(0.0001, start + length + 0.8);
          pan.pan.value = where.pan;
          o.connect(filter).connect(g).connect(pan).connect(ambience.bus);
          o.start(start);
          o.stop(start + length + 0.9);
          o.onended = () => {
            o.disconnect();
            filter.disconnect();
            g.disconnect();
            pan.disconnect();
          };
        }
        start += length + 1;
      }
    }
    /* Seconds a leg takes from rest to rest, stepped as sailLiner() steps it,
       and her top speed on it (units a second). */
    function linerLegTiming(leg) {
      if (leg.kind === 'call') return { seconds: leg.seconds, top: 0 };
      const path = linerLegPath(leg),
        dt = 1 / 10;
      let s = 0,
        speed = 0,
        top = 0,
        t = 0;
      while (s < leg.length - 0.01 && t < 3600) {
        const cap = Math.max(linerPathAt(path, s).top, s < leg.length - 1 ? 1.2 : 0);
        speed += clamp(cap - speed, -LINER_BRAKING * dt, LINER_ACCELERATION * dt);
        s = Math.min(leg.length, s + Math.max(0, speed) * dt);
        top = Math.max(top, speed);
        t += dt;
      }
      return { seconds: t, top };
    }
    /**
     * Sweep the sailing liner's hull down every leg of the voyage and report
     * where it would touch land, a bridge footing, tower or deck, a jetty, a
     * moored ship or the Ironworks freighter, or come within LINER_EDGE_MARGIN of
     * the world-edge line (the console's linerVoyageCheck()). Also: each leg's
     * length, seconds and top speed, the lap time, the named waters in the
     * order she passes them, the closest the hull comes to the world-edge line,
     * and `tight`, where it passes within 60 units of land (not a problem).
     */
    function linerVoyageCheck(step = 24) {
      const ship = sailingLiner(),
        problems = [],
        tight = [],
        passages = [],
        line = worldEdgeLine,
        others = [
          ...LINERS.filter((l) => l !== ship).map((l) => ({ name: l.name, ...shipHull(l) })),
          { name: SUPERYACHT.name, ...deckWorld(SUPERYACHT, (SUPERYACHT.aft - 20 + SUPERYACHT.fwd) / 2, 0), hx: (SUPERYACHT.fwd - SUPERYACHT.aft + 20) / 2, hy: SUPERYACHT.beam / 2 + 4, a: SUPERYACHT.a },
          { name: 'freighter', x: HARBOR.ship.x, y: HARBOR.ship.y, hx: HARBOR.ship.w / 2, hy: HARBOR.ship.l / 2, a: 0 },
          ...DOCKS.map((d) => ({ name: 'dock', x: d.x + d.w / 2, y: d.y + d.h / 2, hx: d.w / 2, hy: d.h / 2, a: 0 })),
          ...monarchBoatObstacles().map((o) => ({ name: 'Monarch Harbour', ...o })),
          ...BRIDGES.flatMap((b) => [...bridgeFootings(b), ...bridgePylons(b)].map((f) => ({ name: b.name, ...f }))),
          ...BRIDGES.map((b) => ({ name: b.name + ' deck', ...bridgeBox(b, { along: 0, across: 0, hx: bridgeFrame(b).length / 2, hy: b.width / 2 }) })),
        ];
      let edgeMargin = Infinity;
      // Her hull in one pose (`s` along leg `index`, or degrees swung at a call).
      const testPose = (index, s, at) => {
        const pose = { x: at.x, y: at.y, a: at.a, l: ship.l, w: ship.w },
          where = { leg: index, s: Math.round(s) };
        // Outline points of the hull plan, with a margin.
        for (let u = -ship.l / 2; u <= ship.l / 2; u += 40) {
          const half = hullHalfBeam(ship, u);
          for (const v of [-half - 10, 0, half + 10]) {
            const p = deckWorld(pose, u, v);
            if (landAt(p.x, p.y)) problems.push({ ...where, x: Math.round(p.x), y: Math.round(p.y), hit: 'land' });
          }
          for (const v of [-half - 60, half + 60]) {
            const p = deckWorld(pose, u, v);
            if (landAt(p.x, p.y)) tight.push({ ...where, x: Math.round(p.x), y: Math.round(p.y) });
          }
          for (const v of [-half, half]) {
            const p = deckWorld(pose, u, v),
              margin = Math.min(p.x - line.left, line.right - p.x, p.y - line.top, line.bottom - p.y);
            edgeMargin = Math.min(edgeMargin, margin);
            if (margin < LINER_EDGE_MARGIN) problems.push({ ...where, x: Math.round(p.x), y: Math.round(p.y), hit: 'world edge' });
          }
        }
        const hull = { x: at.x, y: at.y, hx: ship.l / 2 + 10, hy: ship.w / 2 + 10, a: at.a };
        for (const o of others) if (boxContact(hull, o)) problems.push({ ...where, x: Math.round(at.x), y: Math.round(at.y), hit: o.name });
      };
      for (const [index, leg] of LINER_VOYAGE.entries()) {
        if (leg.kind === 'call') {
          if (leg.name && passages.at(-1) !== leg.name) passages.push(leg.name);
          // Swinging at anchor sweeps a circle: every heading on the way round.
          if (leg.swing) for (let t = 0; t <= leg.seconds; t += leg.seconds / 36) testPose(index, Math.round(t), linerCallPose(index, t));
          continue;
        }
        const path = linerLegPath(leg);
        for (let s = 0; s <= leg.length; s += step) {
          const at = linerPathAt(path, s),
            area = linerPassageAt(at.x, at.y);
          if (area && passages.at(-1) !== area) passages.push(area);
          testPose(index, s, at);
        }
      }
      const seen = new Set(),
        once = (list, key) =>
          list.filter((p) => {
            const k = key(p);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          }),
        legs = LINER_VOYAGE.map((leg) => {
          const timing = linerLegTiming(leg);
          return leg.kind === 'call'
            ? { kind: 'call', name: leg.name, seconds: leg.seconds }
            : { kind: leg.kind, length: Math.round(leg.length), seconds: Math.round(timing.seconds), topKnots: Math.round((timing.top / KNOTS) * 10) / 10 };
        });
      return {
        legs,
        lapSeconds: legs.reduce((sum, leg) => sum + leg.seconds, 0),
        lapMinutes: Math.round((legs.reduce((sum, leg) => sum + leg.seconds, 0) / 60) * 10) / 10,
        passages,
        edgeMargin: Math.round(edgeMargin),
        problems: once(problems, (p) => p.leg + p.hit + Math.round(p.s / 400)),
        tight: once(tight, (p) => 'tight' + p.leg + Math.round(p.s / 400)),
      };
    }
    /* A sea chart for planning the voyage (the console's linerChart): one
       character a `cell` units square over [x0, x1) x [y0, y1) (default the world
       box): '#' land, '=' a bridge deck, 'o' a bridge footing, ':' beyond the
       world-edge line, '.' open sea, and the voyage drawn over it, each leg by its
       index in base 36, '@' where she is now. */
    function linerChart(cell = 256, x0 = WORLD_LEFT, y0 = WORLD_TOP, x1 = WORLD_SIZE, y1 = WORLD_SIZE) {
      const cols = Math.ceil((x1 - x0) / cell),
        rows = Math.ceil((y1 - y0) / cell),
        grid = [],
        at = (x, y) => {
          const c = Math.floor((x - x0) / cell),
            r = Math.floor((y - y0) / cell);
          return r >= 0 && r < rows && c >= 0 && c < cols ? [r, c] : null;
        },
        mark = (x, y, ch) => {
          const rc = at(x, y);
          if (rc) grid[rc[0]][rc[1]] = ch;
        };
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          const x = x0 + (c + 0.5) * cell,
            y = y0 + (r + 0.5) * cell,
            q = cell * 0.35;
          let ch = '.';
          if (worldEdgeDepth(x, y) > 0) ch = ':';
          else if ([[0, 0], [q, q], [-q, q], [q, -q], [-q, -q]].some(([dx, dy]) => landAt(x + dx, y + dy))) ch = '#';
          row.push(ch);
        }
        grid.push(row);
      }
      for (const b of BRIDGES) {
        const f = bridgeFrame(b);
        for (let s = 0; s <= f.length; s += cell / 4) mark(b.a[0] + f.ux * s, b.a[1] + f.uy * s, '=');
        for (const o of bridgeFootings(b)) mark(o.x, o.y, 'o');
      }
      for (const [index, leg] of LINER_VOYAGE.entries())
        if (leg.kind !== 'call') for (const p of linerLegPath(leg)) mark(p.x, p.y, index.toString(36));
      const ship = sailingLiner();
      if (ship) mark(ship.x, ship.y, '@');
      return { cell, x0, y0, x1, y1, rows: grid.map((r) => r.join('')) };
    }
