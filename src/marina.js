    // BEGIN SUBSYSTEM: src/marina.js — Harbor Point marina, the superyacht and the cruise liners
    /**
     * Harbor Point marina, the superyacht and the cruise liners
     * Source: src/marina.js
     * Scope: shared game closure.
     * Yacht basin, the boardable superyacht, cruise terminal, walkable liner decks
     * and the crowds on them. Also the hull-form math the renderer lofts from.
     */
    /**
     * HARBOR POINT
     * The reclamation's north-west shore is cut open into a yacht basin: four
     * finger pontoons off the south quay, sixteen one-of-a-kind boats moored either
     * side, and a club house on the east quay. The superyacht AURELIA lies
     * stern-to the west quay across the head of the basin, with a passerelle down
     * onto her swim platform. East of the basin the cruise terminal takes the whole
     * north apron, with a liner alongside.
     *
     * A liner or the superyacht is a walkable surface rather than scenery.
     * `deckLocal()` puts a world point into a ship's frame (u forward, v to
     * starboard) and while `player.deck` is set the player moves inside that frame
     * instead of on the street grid. Elevation comes from the deck the player is
     * on, so bullets, sight-lines and the renderer all place people on board
     * correctly. Ship dimensions are world units, where 512 units is 100 metres.
     */
    const MARINA = {
      basin: { x: 672, y: -4128, w: 856, h: 828 },
      quay: { x: 640, y: -3300, w: 928, h: 46 },
      club: { x: 1560, y: -3742, w: 148, h: 128 },
      // North of the club: at y -3486 the fuel berth stood in the y -3456 street.
      fuel: { x: 1556, y: -3890, w: 96, h: 54 },
      terminal: { x: 1900, y: -4160, w: 724, h: 128 },
      terminalDoor: { x: 2262, y: -4024 },
      fingers: [760, 960, 1160, 1360].map((x) => ({ x, y: -3760, w: 17, h: 442 })),
      // The east quay between the basin and Commons St is pedestrian: the club,
      // the fuel berth and the jetties stand on it, so no street is laid there
      // (Commons St used to run straight through the club house).
      eastQuay: { x: 1518, y: -4150, w: 198, h: 646 },
    };
    /**
     * HULL FORM
     * One description of a hull's plan shape is shared by the walkable decks and
     * the renderer's lofted hulls, so the rail you walk along is the rail you see.
     * `t` runs from -0.5 (transom) to 0.5 (stem); the result is the deck-edge
     * half-beam as a fraction of the maximum.
     *   transom     stern half-beam as a fraction of the maximum (0 = canoe stern)
     *   maxAt       where along the length the beam is greatest
     *   entry       bow fullness: 1.5 is a fine yacht bow, 3 a bluff freighter
     *   bowShape    1 draws a knife-edge stem in plan, 0.5 a rounded one
     *   sternCurve  how late the quarters start to pull in toward the transom
     */
    function hullPlanFraction(form, t) {
      const m = form.maxAt ?? -0.05;
      if (t <= m) {
        const s = Math.min(1, (m - t) / (m + 0.5));
        return 1 - (1 - (form.transom ?? 0.85)) * Math.pow(s, form.sternCurve ?? 2.4);
      }
      const s = Math.min(1, (t - m) / (0.5 - m));
      return Math.pow(Math.max(0, 1 - Math.pow(s, form.entry ?? 1.8)), form.bowShape ?? 0.75);
    }
    /**
     * Plan outline of a deck level or deckhouse in ship-local (u, v) units: a
     * chamfered aft end, straight sides and a nose `nose` units long shaped as a
     * superellipse (exponent 2 is round, 1.2 is a pointed vee, 4 nearly square).
     * Points go aft-port, aft-starboard, forward along starboard, round the nose
     * and back down the port side.
     */
    function deckOutline(aft, fwd, hw, nose = 0, e = 2, segments = 12, corner = 3) {
      const c = Math.min(corner, hw * 0.4, (fwd - aft) * 0.2),
        pts = [
          [aft, -hw + c],
          [aft, hw - c],
          [aft + c, hw],
        ];
      if (nose <= 0) pts.push([fwd - c, hw], [fwd, hw - c], [fwd, -hw + c], [fwd - c, -hw]);
      else
        for (let i = 0; i <= segments; i++) {
          const th = (i / segments) * Math.PI,
            s = Math.sin(th),
            k = Math.cos(th);
          pts.push([fwd - nose + nose * Math.pow(s, 2 / e), hw * Math.sign(k) * Math.pow(Math.abs(k), 2 / e)]);
        }
      pts.push([aft + c, -hw]);
      return pts;
    }
    function circleOutline(cu, cv, r, segments = 28) {
      return Array.from({ length: segments }, (_, i) => {
        const th = (i / segments) * TAU;
        return [cu + Math.cos(th) * r, cv + Math.sin(th) * r];
      });
    }
    function marinaQuayAt(x, y) {
      const q = MARINA.eastQuay;
      return x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h;
    }
    // Moored boats: [finger index, side, distance along the finger, design]. Every
    // boat is one of a kind; `type` picks its builder in marina3d.js.
    const MARINA_BERTHS = [
      [0, -1, 72, { type: 'sloop', name: 'SEA WHISPER', len: 100, beam: 30, hull: '#f4f2ea', accent: '#1d3f6e' }],
      [0, -1, 284, { type: 'trawler', name: 'SLOW TIDE', len: 102, beam: 32, hull: '#27503f', accent: '#e7dcc0' }],
      [0, 1, 90, { type: 'flybridge', name: 'LA DOLCE VITA', len: 136, beam: 36, hull: '#f5f5f1', accent: '#23364d' }],
      [0, 1, 330, { type: 'launch', name: 'MISS ELEANOR', len: 70, beam: 22, hull: '#7a3f22', accent: '#efe6d0' }],
      [1, -1, 88, { type: 'explorer', name: 'NORTHERN STAR', len: 150, beam: 40, hull: '#2b3136', accent: '#e07a2e' }],
      [1, -1, 300, { type: 'dayCruiser', name: 'SUNCHASER', len: 76, beam: 26, hull: '#f2f2ee', accent: '#c7392f' }],
      [1, 1, 96, { type: 'catamaran', name: 'TWIN TIDES', len: 96, beam: 48, hull: '#f4f4f0', accent: '#2c8a9a' }],
      [1, 1, 300, { type: 'sportfisher', name: 'REEL DEAL', len: 112, beam: 34, hull: '#f3f4f2', accent: '#2a5d8f' }],
      [2, -1, 82, { type: 'ketch', name: 'ALBATROSS', len: 132, beam: 34, hull: '#1b2c4a', accent: '#c8a45a' }],
      [2, -1, 290, { type: 'centerConsole', name: 'BAIT & SWITCH', len: 74, beam: 26, hull: '#dce8ee', accent: '#1f2b33' }],
      [2, 1, 118, { type: 'megayacht', name: 'ORION', len: 180, beam: 44, hull: '#8e979e', accent: '#ecece8' }],
      [2, 1, 330, { type: 'sportYacht', name: 'VELOCE', len: 112, beam: 32, hull: '#17191c', accent: '#dcdcd8' }],
      [3, -1, 86, { type: 'gulet', name: 'ANATOLIA', len: 138, beam: 36, hull: '#7b4628', accent: '#f0e6cc' }],
      [3, -1, 300, { type: 'racer', name: 'BLUE MOON', len: 112, beam: 30, hull: '#2d5f9a', accent: '#e6e6e6' }],
      [3, 1, 92, { type: 'commuter', name: 'GATSBY', len: 112, beam: 28, hull: '#1f3d33', accent: '#b8864f' }],
      [3, 1, 296, { type: 'runabout', name: 'KIWI', len: 66, beam: 24, hull: '#f2c230', accent: '#233040' }],
    ];
    /**
     * Two ships of the same class. The Coral Dawn lies alongside the terminal and
     * is boarded down the gangway. The Meridian Star is under way: she calls at
     * the anchorage off the terminal, where she is boarded from the water by her
     * stern platform, then sails a circuit of the open sea (LINER_VOYAGE).
     */
    const LINERS = [
      {
        id: 'coraldawn',
        name: 'MS CORAL DAWN',
        x: 2380,
        y: -4292,
        a: 0,
        l: 1360,
        w: 186,
        deck: 44,
        berthed: true,
        // The gangway meets the quay here; boarding from the apron needs no boat.
        board: { x: 2380, y: -4188 },
      },
      {
        id: 'meridian',
        name: 'MS MERIDIAN STAR',
        // Her anchorage in North Sound, clear of the Sunset Pier Bridge (x 3200)
        // to her east; sailLiner() moves her from here.
        x: 2150,
        y: -5000,
        a: 0,
        l: 1360,
        w: 186,
        deck: 44,
        berthed: false,
        // Boarding platform off the stern, at the waterline.
        board: null,
        voyage: true,
      },
    ];
    /**
     * THE VOYAGE
     * The Meridian Star's circuit, as legs sailed in turn and then again:
     *   call    riding at anchor off the cruise terminal for `seconds`; her
     *           stern platform takes passengers from the water
     *   astern  backing out of North Sound along `points`
     *   ahead   the cruise: out round the west end of Sunset Pier island, down
     *           the open sea west of Palm Keys, back north inshore past Ocean
     *           Drive's strand, along Northbank's sea wall and into North Sound
     * A leg's `points` are a control polygon; each corner is filleted with a
     * circular arc of its own radius (`[x, y, radius]`), a turning circle a
     * 265 m ship can hold. She never passes under a bridge: every deck is at
     * road level, far below her funnels, so the circuit stays in open water.
     * Speed is limited by where she is (LINER_SPEED_ZONES: slow in the sound,
     * moderate inshore, ~19 knots at sea) and by the curve (lateral acceleration
     * LINER_TURN_GRIP), and she brakes in good time for every stop.
     * linerVoyageCheck() sweeps her hull down the whole circuit against land,
     * bridge footings, docks and the other ships.
     */
    const LINER_VOYAGE = [
      { kind: 'call', seconds: 130 },
      {
        kind: 'astern',
        points: [
          [2150, -5000],
          [820, -5000],
        ],
        top: 12,
      },
      {
        kind: 'ahead',
        points: [
          [820, -5000],
          [1320, -5000, 520],
          [1320, -6900, 820],
          [-4550, -6900, 900],
          [-4550, 4800, 550],
          [-3450, 4800, 550],
          [-3450, -1150, 800],
          [-700, -1150, 800],
          [-700, -5000, 800],
          [2150, -5000],
        ],
        top: 50,
      },
    ];
    // Speed limits by area, units per second (5.12 = 1 m/s; 50 is about 19 knots).
    const LINER_SPEED_ZONES = [
      { x0: -300, x1: 3300, y0: -6000, y1: -4000, top: 20 },
      { x0: -1500, x1: 200, y0: -5200, y1: 600, top: 32 },
      { x0: -3950, x1: -2300, y0: -1600, y1: 5600, top: 34 },
    ];
    const LINER_TURN_GRIP = 1.3,
      LINER_ACCELERATION = 0.7,
      LINER_BRAKING = 0.45;
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
    const linerVoyage = { leg: 0, s: 0, speed: 0, timer: 100, drift: 0, heel: 0, horn: 0, hornQueue: [] };
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
      const where = spatial(ship, 1600);
      if (where.gain < 0.04) return;
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
    /**
     * Sweep the sailing liner's hull down every leg of the voyage and report
     * where it would touch land, a bridge footing or tower, a jetty, the moored
     * liner or the Ironworks freighter (the console's linerVoyageCheck()).
     */
    function linerVoyageCheck(step = 24) {
      const ship = sailingLiner(),
        problems = [],
        others = [
          ...LINERS.filter((l) => l !== ship).map((l) => ({ name: l.name, ...shipHull(l) })),
          { name: 'freighter', x: HARBOR.ship.x, y: HARBOR.ship.y, hx: HARBOR.ship.w / 2, hy: HARBOR.ship.l / 2, a: 0 },
          ...DOCKS.map((d) => ({ name: 'dock', x: d.x + d.w / 2, y: d.y + d.h / 2, hx: d.w / 2, hy: d.h / 2, a: 0 })),
          ...BRIDGES.flatMap((b) => [...bridgeFootings(b), ...bridgePylons(b)].map((f) => ({ name: b.name, ...f }))),
          ...BRIDGES.map((b) => ({ name: b.name + ' deck', ...bridgeBox(b, { along: 0, across: 0, hx: bridgeFrame(b).length / 2, hy: b.width / 2 }) })),
        ];
      for (const [index, leg] of LINER_VOYAGE.entries()) {
        if (leg.kind === 'call') continue;
        const path = linerLegPath(leg);
        for (let s = 0; s <= leg.length; s += step) {
          const at = linerPathAt(path, s),
            pose = { x: at.x, y: at.y, a: at.a, l: ship.l, w: ship.w };
          // Outline points of the hull plan, with a margin.
          for (let u = -ship.l / 2; u <= ship.l / 2; u += 40) {
            const half = hullHalfBeam(ship, u) + 10;
            for (const v of [-half, 0, half]) {
              const p = deckWorld(pose, u, v);
              if (landAt(p.x, p.y)) problems.push({ leg: index, s: Math.round(s), x: Math.round(p.x), y: Math.round(p.y), hit: 'land' });
            }
          }
          const hull = { x: at.x, y: at.y, hx: ship.l / 2 + 10, hy: ship.w / 2 + 10, a: at.a };
          for (const o of others) if (boxContact(hull, o)) problems.push({ leg: index, s: Math.round(s), x: Math.round(at.x), y: Math.round(at.y), hit: o.name });
        }
      }
      const seen = new Set();
      return {
        legs: LINER_VOYAGE.map((leg) => (leg.kind === 'call' ? { kind: 'call', seconds: leg.seconds } : { kind: leg.kind, length: Math.round(linerLegPath(leg) && leg.length) })),
        problems: problems.filter((p) => {
          const key = p.leg + p.hit + Math.round(p.s / 400);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      };
    }
    // A cruise ship's plan: broad transom stern, long parallel body, fine bow.
    const LINER_FORM = { transom: 0.8, maxAt: -0.06, entry: 2.3, bowShape: 0.8, sternCurve: 3.2 };
    const LINER_DECKHOUSES = [
      // [along, across, length, width, height] in ship-local units.
      [-430, 0, 300, 150, 86],
      [-140, 0, 360, 158, 104],
      [210, 0, 250, 146, 78],
      [398, 0, 110, 96, 52],
    ];
    /**
     * THE SUPERYACHT
     * M/Y AURELIA, 105 metres, moored stern-to the west quay. Five walkable
     * levels plus the helipad; `levels[i].z` is the deck surface height. Walkable
     * area is each level's outline (the main deck follows the hull plan inside
     * the bulwarks) minus deckhouses, furniture and stair wells. A stair is a
     * rectangle climbing forward from level `lo` at u0 to level `hi` at u1; level
     * -1 is the quay, which makes the passerelle a stair like any other.
     * Furniture drives the renderer, the collisions and where guests sit.
     */
    const SUPERYACHT = {
      id: 'aurelia',
      name: 'M/Y AURELIA',
      x: 970,
      y: -3950,
      a: 0,
      aft: -265,
      fwd: 265,
      beam: 100,
      form: { transom: 0.9, maxAt: -0.08, entry: 1.9, bowShape: 0.78, sternCurve: 2.6 },
      bulwark: 3,
      board: { x: 660, y: -3950 },
      levels: [
        { name: 'SWIM PLATFORM', z: 7, outline: [-282, -238, 42, 0, 2] },
        { name: 'MAIN DECK', z: 26, hull: [-238, 250] },
        { name: 'UPPER DECK', z: 52, outline: [-186, 118, 46, 70, 1.9] },
        { name: 'BRIDGE DECK', z: 78, outline: [-150, 88, 42, 52, 1.8] },
        { name: 'SUN DECK', z: 104, outline: [-110, 52, 38, 34, 1.8] },
        { name: 'HELIPAD', z: 35, circle: [172, 0, 31] },
      ],
      // Deckhouses: solid, except the main saloon whose walls alone are solid and
      // whose aft doors stand open. `rake` pulls the top of the front back.
      houses: [
        { level: 1, outline: [-150, 108, 32, 64, 1.6], open: true, rake: 6, doors: [[-156, -144, -13, 13]] },
        { level: 2, outline: [-112, 90, 34, 50, 1.8], rake: 10 },
        { level: 3, outline: [-72, 80, 30, 44, 1.6], rake: 12, bridge: true },
      ],
      stairs: [
        { lo: -1, hi: 0, u0: -306, u1: -282, v0: -6, v1: 6, gangway: true },
        { lo: 0, hi: 1, u0: -246, u1: -218, v0: 30, v1: 40 },
        { lo: 0, hi: 1, u0: -246, u1: -218, v0: -40, v1: -30 },
        { lo: 1, hi: 2, u0: -182, u1: -156, v0: 21, v1: 31 },
        { lo: 1, hi: 2, u0: -182, u1: -156, v0: -31, v1: -21 },
        { lo: 2, hi: 3, u0: -144, u1: -118, v0: -6, v1: 6 },
        { lo: 3, hi: 4, u0: -104, u1: -80, v0: -28, v1: -18 },
        { lo: 1, hi: 5, u0: 116, u1: 141, v0: -6, v1: 6 },
      ],
      // [level, type, u, v, length along u, width across]
      furniture: [
        [0, 'lounger', -272, -24, 18, 8],
        [0, 'lounger', -272, 24, 18, 8],
        [1, 'pool', -206, 0, 30, 30],
        [1, 'lounger', -206, 22, 20, 8],
        [1, 'lounger', -206, -22, 20, 8],
        [1, 'sofa', -176, 0, 9, 30],
        [1, 'table', -163, 0, 8, 18],
        [1, 'sofa', -128, -24, 26, 8],
        [1, 'sofa', -128, 24, 26, 8],
        [1, 'table', -128, 0, 14, 12],
        [1, 'dining', -70, 0, 40, 26],
        [1, 'bar', 4, -22, 30, 7],
        [1, 'piano', 40, 16, 16, 12],
        [1, 'windlass', 232, 0, 20, 16],
        [2, 'sofa', -178, 0, 8, 36],
        [2, 'table', -165, 0, 10, 20],
        [2, 'lounger', -128, 30, 18, 8],
        [2, 'lounger', -128, -30, 18, 8],
        [3, 'dining', -128, -18, 24, 18],
        [3, 'sofa', -140, 26, 16, 8],
        [3, 'lounger', -92, 26, 18, 8],
        [4, 'jacuzzi', -50, 0, 26, 26],
        [4, 'sunpad', -92, 20, 18, 18],
        [4, 'lounger', -50, 28, 18, 8],
        [4, 'lounger', -50, -28, 18, 8],
        [4, 'lounger', -18, 28, 18, 8],
        [4, 'lounger', -18, -28, 18, 8],
        [4, 'bar', 18, 0, 8, 30],
        [4, 'mast', 40, 0, 10, 12],
      ],
    };
    const SUPERYACHT_GANGWAY = SUPERYACHT.stairs[0];
    function deckLocal(ship, x, y) {
      const c = Math.cos(-ship.a),
        s = Math.sin(-ship.a),
        dx = x - ship.x,
        dy = y - ship.y;
      return { u: dx * c - dy * s, v: dx * s + dy * c };
    }
    function deckWorld(ship, u, v) {
      const c = Math.cos(ship.a),
        s = Math.sin(ship.a);
      return { x: ship.x + u * c - v * s, y: ship.y + u * s + v * c };
    }
    // The hull tapers at both ends, so the usable half-beam falls away fore and aft.
    function hullHalfBeam(ship, u) {
      return (ship.w / 2) * hullPlanFraction(LINER_FORM, clamp(u / ship.l, -0.5, 0.5));
    }
    function superyachtHalfBeam(u) {
      const s = SUPERYACHT,
        length = s.fwd - s.aft,
        t = (u - (s.aft + s.fwd) / 2) / length;
      if (t < -0.5 || t > 0.5) return 0;
      return (s.beam / 2) * hullPlanFraction(s.form, t);
    }
    function shipHull(ship) {
      return { x: ship.x, y: ship.y, hx: ship.l / 2, hy: ship.w / 2, a: ship.a };
    }
    // Sterns carry a boarding platform at the waterline; that is the way aboard.
    function shipPlatform(ship) {
      return deckWorld(ship, -ship.l / 2 - 22, 0);
    }
    function deckPointFree(ship, x, y, r = 7) {
      const { u, v } = deckLocal(ship, x, y);
      return linerDeckFree(ship, u, v, r);
    }
    function moveOnDeck(dx, dy, r) {
      const ship = player.deck;
      if (ship === SUPERYACHT) return moveOnYacht(dx, dy);
      let blocked = false;
      if (deckPointFree(ship, player.x + dx, player.y, r)) player.x += dx;
      else blocked = true;
      if (deckPointFree(ship, player.x, player.y + dy, r)) player.y += dy;
      else blocked = true;
      return blocked;
    }
    /* ---- Superyacht deck plan ------------------------------------------------ */
    let superyachtPlanCache = null;
    const inStairRect = (s, u, v) => u >= s.u0 && u <= s.u1 && v >= s.v0 && v <= s.v1;
    // Outlines and blockers for each level, derived once from SUPERYACHT.
    function superyachtPlan() {
      if (superyachtPlanCache) return superyachtPlanCache;
      const ship = SUPERYACHT;
      const levels = ship.levels.map((level, index) => {
        let outline;
        if (level.hull) {
          const [from, to] = level.hull,
            side = [];
          for (let u = from; u <= to; u += 6) side.push([u, Math.max(1, superyachtHalfBeam(u) - ship.bulwark)]);
          outline = [...side.map(([u, v]) => [u, -v]), ...side.reverse()];
        } else if (level.circle) outline = circleOutline(...level.circle);
        else outline = deckOutline(...level.outline);
        const blocks = [];
        for (const house of ship.houses)
          if (house.level === index) {
            const [aft, fwd, hw, nose, e] = house.outline;
            blocks.push({
              outer: deckOutline(aft, fwd, hw, nose, e),
              inner: house.open ? deckOutline(aft + 3, fwd - 3, hw - 3, Math.max(0, nose - 3), e) : null,
              doors: house.doors || [],
            });
          }
        // Stand-alone furniture blocks; the mast and bar stand under the hardtop.
        const furniture = ship.furniture
          .filter((f) => f[0] === index)
          .map(([, type, u, v, l, w]) => ({ type, u, v, l, w }));
        // The raised helipad stands over the foredeck on legs.
        if (index === 1) blocks.push({ outer: circleOutline(172, 0, 32), inner: null, doors: [] });
        return { ...level, index, outline, blocks, furniture, stairs: ship.stairs.filter((s) => s.lo === index || s.hi === index) };
      });
      superyachtPlanCache = { levels };
      return superyachtPlanCache;
    }
    function superyachtLevelContains(level, u, v) {
      return pointInPolygon(u, v, level.outline) || level.stairs.some((s) => inStairRect(s, u, v));
    }
    function superyachtBlockHit(block, u, v) {
      if (!pointInPolygon(u, v, block.outer)) return false;
      if (!block.inner) return true;
      if (pointInPolygon(u, v, block.inner)) return false;
      return !block.doors.some((d) => u >= d[0] && u <= d[1] && v >= d[2] && v <= d[3]);
    }
    /* A point is free on a level when it and four points around it are on that
       level's deck (or its stair landings), clear of houses and furniture, and
       the centre itself is not over a stair well. */
    function yachtPointFree(levelIndex, u, v, r = 4) {
      const level = superyachtPlan().levels[levelIndex];
      if (!level) return false;
      const probes = [
        [0, 0],
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ];
      for (const [du, dv] of probes) {
        if (!superyachtLevelContains(level, u + du, v + dv)) return false;
        for (const block of level.blocks) if (superyachtBlockHit(block, u + du, v + dv)) return false;
      }
      for (const f of level.furniture)
        if (Math.abs(u - f.u) < f.l / 2 + r * 0.6 && Math.abs(v - f.v) < f.w / 2 + r * 0.6) return false;
      return !level.stairs.some((s) => inStairRect(s, u, v));
    }
    function stairHeight(stair, u) {
      const levels = SUPERYACHT.levels,
        lo = stair.lo < 0 ? 0 : levels[stair.lo].z,
        hi = levels[stair.hi].z;
      return lo + (hi - lo) * clamp((u - stair.u0) / (stair.u1 - stair.u0), 0, 1);
    }
    function moveOnYacht(dx, dy) {
      let blocked = false;
      if (dx && !yachtStep(player.x + dx, player.y)) blocked = true;
      if (player.deck && dy && !yachtStep(player.x, player.y + dy)) blocked = true;
      return blocked;
    }
    // One axis of movement aboard: along a stair, onto a stair, or across a level.
    function yachtStep(x, y) {
      const ship = SUPERYACHT,
        from = deckLocal(ship, player.x, player.y),
        to = deckLocal(ship, x, y),
        stair = player.deckStair;
      const accept = (z) => {
        player.x = x;
        player.y = y;
        player.altitude = z;
        return true;
      };
      if (stair) {
        if (to.v < stair.v0 - 1 || to.v > stair.v1 + 1) return false;
        if (to.u >= stair.u0 && to.u <= stair.u1) return accept(stairHeight(stair, to.u));
        const target = to.u > stair.u1 ? stair.hi : stair.lo;
        if (target < 0) {
          // Off the end of the passerelle and onto the quay.
          leaveSuperyacht(x, y);
          return true;
        }
        if (!yachtPointFree(target, to.u, to.v, 3)) return false;
        player.deckLevel = target;
        player.deckStair = null;
        return accept(ship.levels[target].z);
      }
      const level = player.deckLevel;
      if (yachtPointFree(level, to.u, to.v)) return accept(ship.levels[level].z);
      const entry = ship.stairs.find(
        (s) =>
          inStairRect(s, to.u, to.v) &&
          ((s.lo === level && from.u <= s.u0 + 3) || (s.hi === level && from.u >= s.u1 - 3)),
      );
      if (!entry) return false;
      player.deckStair = entry;
      return accept(stairHeight(entry, to.u));
    }
    // Which deck the player stands on, for the HUD, tests and the renderer's cutaway.
    function superyachtDeckState() {
      if (player.deck !== SUPERYACHT) return null;
      const { u, v } = deckLocal(SUPERYACHT, player.x, player.y),
        level = player.deckStair ? null : SUPERYACHT.levels[player.deckLevel];
      return {
        ship: SUPERYACHT.name,
        deck: player.deckStair ? (player.deckStair.gangway ? 'PASSERELLE' : 'STAIRS') : level.name,
        level: player.deckStair ? -1 : player.deckLevel,
        elevation: Math.round(player.altitude),
        u: Math.round(u),
        v: Math.round(v),
      };
    }
    /* The renderer lifts away every deck above the player that would hide them:
       returns the lowest deck height above the player whose outline covers the
       player's position, or Infinity when nothing overhead is in the way. */
    function superyachtCoverHeight() {
      if (player.deck !== SUPERYACHT) return Infinity;
      const { u, v } = deckLocal(SUPERYACHT, player.x, player.y),
        z = player.altitude;
      let cover = Infinity;
      for (const level of superyachtPlan().levels)
        if (level.z > z + 12 && level.z < cover && !level.circle && pointInPolygon(u, v, level.outline))
          cover = level.z;
      return cover;
    }
    function boardSuperyachtFromGangway() {
      player.deck = SUPERYACHT;
      player.deckLevel = 0;
      player.deckStair = SUPERYACHT_GANGWAY;
      const { u } = deckLocal(SUPERYACHT, player.x, player.y);
      player.altitude = stairHeight(SUPERYACHT_GANGWAY, u);
      tell('WELCOME ABOARD ' + SUPERYACHT.name.replace('M/Y ', ''), 2.4);
    }
    function leaveSuperyacht(x, y) {
      player.deck = null;
      player.deckStair = null;
      player.x = x;
      player.y = y;
      player.altitude = terrainHeight(x, y);
    }
    function onSuperyachtGangway(x, y, r = 0) {
      const { u, v } = deckLocal(SUPERYACHT, x, y),
        g = SUPERYACHT_GANGWAY;
      return u >= g.u0 - r && u <= g.u1 + r && v >= g.v0 - r && v <= g.v1 + r;
    }
    /* Called every frame: walking onto the passerelle from the quay steps aboard. */
    function updateMarinaFooting() {
      if (player.deck || player.car || playerOnRoof() || player.parachute || player.swimming) return;
      if (transitRide || taxiRide || player.coaster) return;
      const { u, v } = deckLocal(SUPERYACHT, player.x, player.y),
        g = SUPERYACHT_GANGWAY;
      if (u > g.u0 + 1 && u < g.u1 && v > g.v0 && v < g.v1) {
        if (wantedStars > 0) {
          // Security will not let a wanted man aboard: back onto the quay.
          player.x = deckWorld(SUPERYACHT, g.u0 - 4, v).x;
          needToLosePolice();
          return;
        }
        boardSuperyachtFromGangway();
      }
    }
    function marinaSolids() {
      return [
        { ...MARINA.club, height: 44 },
        { ...MARINA.fuel, height: 20 },
        { ...MARINA.terminal, height: 56 },
      ];
    }
    /* Pontoons are walkable, the basin around them is not, and hulls are solid. */
    function marinaBlocked(x, y, r = 0) {
      const b = MARINA.basin;
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
        const onFinger = MARINA.fingers.some(
          (f) => x + r > f.x - 3 && x - r < f.x + f.w + 3 && y + r > f.y && y - r < f.y + f.h,
        );
        // The boat jetties off the east quay (DOCKS) are walkable too.
        if (!onFinger && !onSuperyachtGangway(x, y, 1) && !onDock(x, y, r)) return true;
        if (berthedHullAt(x, y, r)) return true;
      }
      return marinaSolids().some(
        (s) => x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h,
      );
    }
    let berthCache = null;
    function marinaBoats() {
      if (berthCache) return berthCache;
      berthCache = MARINA_BERTHS.map(([fi, side, along, design], i) => {
        const f = MARINA.fingers[fi];
        return {
          id: 'yacht' + i,
          x: f.x + f.w / 2 + side * (design.beam / 2 + 13),
          y: f.y + f.h - along,
          len: design.len,
          beam: design.beam,
          hull: design.hull,
          house: design.accent,
          design,
          side,
          a: -Math.PI / 2,
          bob: i * 0.7,
        };
      });
      return berthCache;
    }
    function berthedHullAt(x, y, r = 0) {
      return marinaBoats().some(
        (b) =>
          Math.abs(x - b.x) < b.beam / 2 + r - 2 && Math.abs(y - b.y) < b.len / 2 + r - 4,
      );
    }
    /* Everything a boat must steer round in and near the basin, as oriented boxes
       for boatFits(): the liners, the moored boats, the superyacht and her
       tender, and the pontoons themselves. */
    let marinaObstacleCache = null;
    function marinaObstacles() {
      if (marinaObstacleCache) return marinaObstacleCache;
      const s = SUPERYACHT,
        centre = deckWorld(s, (s.aft - 20 + s.fwd) / 2, 0),
        tender = deckWorld(s, -196, 68);
      marinaObstacleCache = [
        ...LINERS.filter((ship) => !ship.voyage).map(shipHull),
        ...marinaBoats().map((m) => ({ x: m.x, y: m.y, hx: m.beam / 2, hy: m.len / 2, a: 0 })),
        { x: centre.x, y: centre.y, hx: (s.fwd - s.aft + 20) / 2, hy: s.beam / 2 + 4, a: s.a },
        { x: tender.x, y: tender.y, hx: 26, hy: 10, a: s.a },
        ...MARINA.fingers.map((f) => ({ x: f.x + f.w / 2, y: f.y + f.h / 2, hx: f.w / 2 + 3, hy: f.h / 2, a: 0 })),
      ];
      return marinaObstacleCache;
    }
    // The hull of a liner under way, where she is now (boats test it every step).
    function movingLinerHulls() {
      return LINERS.filter((ship) => ship.voyage).map(shipHull);
    }
    function paintMarina(drawingContext) {
      const fill = (x, y, w, h, c) => {
        drawingContext.fillStyle = c;
        drawingContext.fillRect(x, y, w, h);
      };
      // The basin itself is left unpainted so the water shader shows through it;
      // only the quay coping, the pontoons and the hulls are drawn.
      const b = MARINA.basin;
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      fill(b.x - 16, b.y, 16, b.h + 16, '#a9a495');
      fill(b.x + b.w, b.y, 16, b.h + 16, '#a9a495');
      fill(b.x - 16, b.y + b.h, b.w + 32, 16, '#a9a495');
      fill(1700, -4190, 1380, 168, '#8f8e83');
      drawingContext.fillStyle = '#d8cfa8';
      for (let x = 1740; x < 3040; x += 64) drawingContext.fillRect(x, -4104, 34, 3);
      drawingContext.restore();
      for (const f of MARINA.fingers) {
        fill(f.x, f.y, f.w, f.h, '#b6ad99');
        drawingContext.fillStyle = '#8d846f';
        for (let y = f.y + 6; y < f.y + f.h; y += 15) drawingContext.fillRect(f.x, y, f.w, 2);
      }
      // Moored boats as pointed hulls, bows to the north.
      for (const boat of marinaBoats()) {
        drawingContext.fillStyle = boat.hull;
        drawingContext.beginPath();
        drawingContext.moveTo(boat.x - boat.beam / 2, boat.y + boat.len / 2);
        drawingContext.lineTo(boat.x - boat.beam / 2, boat.y - boat.len * 0.15);
        drawingContext.quadraticCurveTo(boat.x - boat.beam * 0.4, boat.y - boat.len * 0.42, boat.x, boat.y - boat.len / 2);
        drawingContext.quadraticCurveTo(boat.x + boat.beam * 0.4, boat.y - boat.len * 0.42, boat.x + boat.beam / 2, boat.y - boat.len * 0.15);
        drawingContext.lineTo(boat.x + boat.beam / 2, boat.y + boat.len / 2);
        drawingContext.fill();
        fill(boat.x - boat.beam / 4, boat.y - boat.len / 8, boat.beam / 2, boat.len / 3, boat.house);
      }
      // The superyacht's hull in plan, and her deckhouse.
      const s = SUPERYACHT;
      drawingContext.fillStyle = '#1d2a3a';
      drawingContext.beginPath();
      for (let u = s.aft; u <= s.fwd; u += 8) {
        const p = deckWorld(s, u, superyachtHalfBeam(u));
        drawingContext.lineTo(p.x, p.y);
      }
      for (let u = s.fwd; u >= s.aft; u -= 8) {
        const p = deckWorld(s, u, -superyachtHalfBeam(u));
        drawingContext.lineTo(p.x, p.y);
      }
      drawingContext.fill();
      drawingContext.fillStyle = '#eeeeea';
      drawingContext.beginPath();
      for (const [u, v] of deckOutline(-186, 118, 46, 70, 1.9)) {
        const p = deckWorld(s, u, v);
        drawingContext.lineTo(p.x, p.y);
      }
      drawingContext.fill();
      const gangwayEnd = deckWorld(s, SUPERYACHT_GANGWAY.u0, -6);
      fill(gangwayEnd.x, gangwayEnd.y, SUPERYACHT_GANGWAY.u1 - SUPERYACHT_GANGWAY.u0, 12, '#c9c2ae');
      fill(MARINA.terminal.x, MARINA.terminal.y, MARINA.terminal.w, MARINA.terminal.h, '#6f7a7c');
      fill(MARINA.club.x, MARINA.club.y, MARINA.club.w, MARINA.club.h, '#77756a');
      fill(MARINA.fuel.x, MARINA.fuel.y, MARINA.fuel.w, MARINA.fuel.h, '#6a6f68');
      drawingContext.save();
      drawingContext.textAlign = 'center';
      drawingContext.fillStyle = '#e3dcc2';
      drawingContext.font = 'bold 15px monospace';
      drawingContext.fillText('CRUISE TERMINAL', MARINA.terminalDoor.x, MARINA.terminalDoor.y - 4);
      drawingContext.fillStyle = '#dcd6bd';
      drawingContext.font = 'bold 11px monospace';
      drawingContext.fillText('HARBOR POINT YACHT CLUB', 1634, -3736);
      drawingContext.restore();
    }
    function marinaInteract() {
      if (player.deck) {
        if (!deckExitNear()) return false;
        leaveLiner();
        return true;
      }
      const ship = boardableLiner();
      if (!ship) return false;
      if (wantedStars > 0) {
        needToLosePolice();
        return true;
      }
      boardLiner(ship);
      return true;
    }
    function boardableLiner() {
      if (player.car || playerOnRoof() || player.parachute || transitRide || player.coaster) return null;
      if (taxiRide) return null;
      if (player.deck) return null;
      if (distanceBetween(player, SUPERYACHT.board) < 40) return SUPERYACHT;
      return (
        LINERS.find((ship) => {
          const gate = ship.berthed ? ship.board : shipPlatform(ship);
          // Nobody climbs onto the platform of a ship making way.
          if (ship.voyage && Math.abs(ship.speed || 0) > 6) return false;
          return distanceBetween(player, gate) < 46;
        }) || null
      );
    }
    function boardLiner(ship) {
      if (ship === SUPERYACHT) {
        // Straight onto the swim platform at the foot of the passerelle.
        const p = deckWorld(ship, -268, 0);
        player.deck = ship;
        player.deckLevel = 0;
        player.deckStair = null;
        player.x = p.x;
        player.y = p.y;
        player.altitude = ship.levels[0].z;
        tell('WELCOME ABOARD ' + ship.name.replace('M/Y ', ''), 2.4);
        return;
      }
      const aft = deckWorld(ship, -ship.l / 2 + 58, 0);
      player.deck = ship;
      player.deckHeading = ship.a;
      player.x = aft.x;
      player.y = aft.y;
      player.altitude = ship.deck;
      tell('ABOARD THE ' + ship.name.replace('MS ', ''), 2.4);
    }
    function leaveLiner() {
      const ship = player.deck;
      if (!ship) return;
      const gate = ship.berthed || ship === SUPERYACHT ? ship.board : shipPlatform(ship);
      player.deck = null;
      player.deckStair = null;
      player.x = gate.x;
      player.y = gate.y;
      player.altitude = terrainHeight(gate.x, gate.y);
    }
    function deckExitNear() {
      const ship = player.deck;
      if (!ship) return false;
      const { u } = deckLocal(ship, player.x, player.y);
      if (ship === SUPERYACHT)
        return !!player.deckStair?.gangway || (player.deckLevel === 0 && !player.deckStair && u < -265);
      return u < -ship.l / 2 + 96;
    }
    /* Tourists stroll the promenade decks and lean on the rail; on the lido deck
       atop the midships house they lie on the loungers or stand about with a
       drink. Everyone keeps a ship-frame position (du, dv, heading da) so a ship
       under way carries them (carryLinerDeck). */
    function populateLiners() {
      for (const ship of LINERS) {
        ship.passengers = [];
        const board = (u, v, extra) => {
          const p = deckWorld(ship, u, v),
            da = randomBetween(0, TAU),
            person = {
              ...p,
              du: u,
              dv: v,
              da,
              a: ship.a + da,
              color: randomChoice(DRIVER_COLORS),
              hp: 30,
              flee: 0,
              timer: randomBetween(0, 7),
              walk: 0,
              altitude: ship.deck,
              onDeck: ship,
              tourist: true,
              ...extra,
            };
          person.a = ship.a + person.da;
          pedestrians.push(person);
          ship.passengers.push(person);
        };
        const crowd = ship.berthed ? 34 : 30;
        for (let i = 0; i < crowd; i++) {
          for (let tries = 0; tries < 24; tries++) {
            const u = randomBetween(-ship.l / 2 + 60, ship.l / 2 - 60),
              v = randomBetween(-1, 1) * (hullHalfBeam(ship, u) - 26);
            if (!linerDeckFree(ship, u, v, 8)) continue;
            board(u, v, { carry: seededRandom() < 0.25 ? 'camera' : undefined });
            break;
          }
        }
        // The lido: loungers down both sides of the pool deck, people at the pools.
        const [lu, , , wide, high] = LINER_DECKHOUSES[1],
          lido = ship.deck + high + 4;
        for (const side of [-1, 1])
          for (let k = 0; k < 9; k++)
            if (seededRandom() < 0.6)
              board(lu - 148 + k * 16, side * (wide / 2 - 14), { altitude: lido, lido: true, sitting: true, pose: 'rest', da: Math.PI });
        for (const [du, dv] of [
          [-60, 30],
          [-52, -31],
          [-100, 12],
          [70, 24],
          [72, -24],
          [20, 20],
          [26, -18],
          [-20, 44],
          [-18, -46],
          [120, 38],
        ])
          board(lu + du, dv, { altitude: lido, lido: true, pose: 'chat', drinking: seededRandom() < 0.5 });
      }
      populateSuperyacht();
    }
    // A free spot on a liner's promenade deck, in her own frame.
    function linerDeckFree(ship, u, v, r = 7) {
      if (Math.abs(u) > ship.l / 2 - 26 - r) return false;
      if (Math.abs(v) > hullHalfBeam(ship, u) - 12 - r) return false;
      return !LINER_DECKHOUSES.some((h) => Math.abs(u - h[0]) < h[2] / 2 + r && Math.abs(v - h[1]) < h[3] / 2 + r);
    }
    /* Aboard the AURELIA: guests stretched out on loungers or standing about with
       a drink, and crew in whites walking their rounds. Nobody here leaves their
       deck; the stairs are for the player. */
    const YACHT_GUEST_COLORS = ['#f1ede4', '#20324a', '#c9a27a', '#7d9fb8', '#b44b5a', '#e8d9b5', '#3e6b5d', '#d98b6a'];
    function populateSuperyacht() {
      const ship = SUPERYACHT,
        plan = superyachtPlan(),
        guest = (level, u, v, extra) => {
          const p = deckWorld(ship, u, v);
          pedestrians.push({
            ...p,
            a: ship.a,
            color: randomChoice(YACHT_GUEST_COLORS),
            hp: 30,
            flee: 0,
            timer: randomBetween(1, 8),
            walk: 0,
            altitude: ship.levels[level].z,
            onDeck: ship,
            deckLevel: level,
            yachtGuest: true,
            guest: true,
            ...extra,
          });
        };
      // Loungers and sun pads: a guest on most of them, lying along the cushion.
      for (const level of plan.levels)
        for (const f of level.furniture) {
          if ((f.type === 'lounger' || f.type === 'sunpad') && seededRandom() < 0.55)
            guest(level.index, f.u + 2, f.v, { sitting: true, a: ship.a + Math.PI, pose: 'rest', drinking: seededRandom() < 0.3 });
          if (f.type === 'sofa' && seededRandom() < 0.6) {
            const across = f.w > f.l;
            guest(level.index, f.u + (across ? 0 : 3), f.v + (across ? 4 : 0), {
              sitting: true,
              a: ship.a + (across ? 0 : f.v > 0 ? -Math.PI / 2 : Math.PI / 2),
              pose: 'rest',
              drinking: true,
            });
          }
        }
      // Standing guests with drinks at the rails and on the aft decks.
      const standing = [
        [1, -230, 12],
        [1, -228, -10],
        [2, -150, 30],
        [3, -104, 8],
        [4, -86, -6],
        [4, 4, 22],
        [4, 4, -20],
        [5, 172, 10],
      ];
      for (const [level, u, v] of standing)
        guest(level, u, v, { pose: 'chat', drinking: true, a: ship.a + randomBetween(0, TAU) });
      // Crew walking the side decks, the foredeck and the saloon.
      const crew = [
        [1, -60, 40],
        [1, 124, 24],
        [1, -100, 0],
        [0, -270, 8],
        [3, -110, -36],
      ];
      for (const [level, u, v] of crew)
        guest(level, u, v, { pose: 'walk', color: '#f4f4f0', crew: true, guest: false, drinking: false });
    }
    /* Quay life: people walking the pontoons, crews working on the boats and a
       queue of passengers waiting to board at the terminal. */
    function populateMarina() {
      const spots = [];
      for (const f of MARINA.fingers)
        for (let d = 40; d < f.h - 30; d += 74)
          spots.push({ x: f.x + f.w / 2, y: f.y + d, a: seededRandom() > 0.5 ? -Math.PI / 2 : Math.PI / 2 });
      for (let x = 1760; x < 3020; x += 58)
        spots.push({ x, y: -4116 + randomBetween(-16, 16), a: seededRandom() > 0.5 ? 0 : Math.PI });
      for (const spot of spots) {
        if (seededRandom() > 0.62) continue;
        if (solid(spot.x, spot.y, 6)) continue;
        pedestrians.push({
          x: spot.x,
          y: spot.y,
          a: spot.a,
          color: randomChoice(DRIVER_COLORS),
          hp: 30,
          flee: 0,
          timer: randomBetween(0, 8),
          walk: 0,
        });
      }
      // Two deckhands in whites keep the foot of the passerelle.
      for (const dv of [-16, 16]) {
        const p = deckWorld(SUPERYACHT, SUPERYACHT_GANGWAY.u0 - 10, dv);
        pedestrians.push({ ...p, a: Math.PI, color: '#f4f4f0', hp: 30, flee: 0, timer: 99, walk: 0, sentry: true });
      }
    }
    if (typeof PED_LINES !== 'undefined')
      PED_LINES.yacht = [
        'Another glass? It is only noon.',
        'The owner flies in by helicopter tonight.',
        'Mind the teak, please, no shoes.',
        'Captain says we sail for Monaco on Friday.',
        'Is that the cruise ship? How quaint.',
        'Best view in the harbor, darling.',
        'Crew only beyond this point, sir.',
        'The pool is heated, you know.',
      ];
    function updateDeckWalker(p, deltaSeconds) {
      const ship = p.onDeck;
      if (ship === SUPERYACHT) return updateYachtGuest(p, deltaSeconds);
      p.timer -= deltaSeconds;
      // Lido guests stay put: lying on a lounger or chatting by the pool.
      if (p.lido) {
        p.walking = false;
        if (p.timer <= 0) {
          p.timer = randomBetween(4, 10);
          if (!p.sitting) p.da += randomBetween(-1, 1);
        }
        return true;
      }
      p.altitude = ship.deck;
      if (p.timer <= 0) {
        p.timer = randomBetween(3, 9);
        p.da = randomBetween(0, TAU);
        pedSay(p, 'deck', 0.16);
      }
      // Walk in the ship's frame, so a moving deck carries the stroll with it.
      const speed = 26,
        nu = p.du + Math.cos(p.da) * speed * deltaSeconds,
        nv = p.dv + Math.sin(p.da) * speed * deltaSeconds;
      if (linerDeckFree(ship, nu, nv, 7)) {
        p.du = nu;
        p.dv = nv;
        p.walk += deltaSeconds * 6;
        p.walking = true;
      } else {
        p.da += Math.PI * randomBetween(0.4, 1.6);
        p.timer = Math.min(p.timer, 1.2);
      }
      const w = deckWorld(ship, p.du, p.dv);
      p.x = w.x;
      p.y = w.y;
      p.a = ship.a + p.da;
      return true;
    }
    // The renderer lifts decks away over the player's head; the people on them go too.
    let yachtCoverFrame = { time: -1, height: Infinity };
    function yachtCoverNow() {
      if (yachtCoverFrame.time !== gameTime) yachtCoverFrame = { time: gameTime, height: superyachtCoverHeight() };
      return yachtCoverFrame.height;
    }
    function updateYachtGuest(p, deltaSeconds) {
      p.altitude = SUPERYACHT.levels[p.deckLevel].z;
      p.hidden = p.altitude >= yachtCoverNow() && p.deckLevel !== 5;
      p.timer -= deltaSeconds;
      const party = p.deckLevel === 4 && daylight() < 0.25;
      p.dancing = party && p.pose === 'chat';
      if (p.timer <= 0) {
        p.timer = randomBetween(4, 10);
        if (p.pose === 'chat') p.a += randomBetween(-1.2, 1.2);
        if (p.pose === 'walk') p.a = randomBetween(0, TAU);
        if (distanceBetween(p, player) < 120) pedSay(p, 'yacht', 0.3);
      }
      if (p.pose !== 'walk' && !(p.flee > 0)) {
        p.walking = false;
        return true;
      }
      p.walking = true;
      const speed = p.flee > 0 ? 60 : 22,
        nx = p.x + Math.cos(p.a) * speed * deltaSeconds,
        ny = p.y + Math.sin(p.a) * speed * deltaSeconds,
        { u, v } = deckLocal(SUPERYACHT, nx, ny);
      if (yachtPointFree(p.deckLevel, u, v, 6)) {
        p.x = nx;
        p.y = ny;
        p.walk += deltaSeconds * 6;
      } else {
        p.a += Math.PI * randomBetween(0.5, 1.5);
        p.timer = Math.min(p.timer, 1.5);
      }
      return true;
    }
    // END SUBSYSTEM: src/marina.js
