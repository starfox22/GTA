    // BEGIN SUBSYSTEM: src/beach.js — Palm Keys Beach life
    /**
     * Palm Keys Beach life
     * Source: src/beach.js
     * Scope: shared game closure.
     * The strand's furniture plan and the people on it: sunbathers, swimmers,
     * waders, kids, a volleyball game, joggers, lifeguards and vendors.
     */
    /**
     * THE PLAN
     * Everything on the beach is placed relative to the waterline (`beachShore`):
     * a point is "s units along the shore from the west end, d units inland"
     * (negative d is out in the water). Umbrellas and towels follow the curve of
     * the strand in loose rows the way a real beach fills up; the kiosks, the
     * beach bar and the lifeguard station stand on the upper sand under the
     * boardwalk; a line of buoys marks the swim zone offshore. The layout uses
     * its own random stream so building it never disturbs the seeded world.
     * beach3d.js draws exactly this plan.
     *
     * THE PEOPLE
     * `beachgoers` is a fixed cast of slots. Each has a kind, an anchor (its
     * towel, its patch of sea, its tower) and a threshold: when the beach's
     * crowd level for the hour (`beachDensity`: empty at night, a few joggers at
     * dawn, packed from late morning to mid afternoon, strollers at sunset, the
     * bar busy into the night) rises above it, the slot is taken. People arrive
     * from the boardwalk and leave the same way when the camera can see them,
     * and simply appear or go when it cannot. The renderer poses them from
     * `pose` and `phase`; nothing here knows about meshes.
     *
     * Panic: gunfire, explosions (notifyViolence calls beachHearsViolence) and
     * cars tearing across the sand scatter the beach. Anyone on the sand near
     * the danger becomes an ordinary pedestrian with the same flee state every
     * other pedestrian uses, so they can be chased, shot or run over like
     * anyone else; people further off grab their things and run for the
     * boardwalk; swimmers duck under and swim clear. The beach stays spooked
     * for a few minutes afterwards.
     */
    let beachSeed = 1;
    function beachRandom() {
      beachSeed = (beachSeed * 16807) % 2147483647;
      return (beachSeed - 1) / 2147483646;
    }
    const beachBetween = (a, b) => a + beachRandom() * (b - a),
      beachPick = (list) => list[Math.floor(beachRandom() * list.length)];
    const BEACH_SKIN = ['#f1c9a5', '#e0b08a', '#c68e62', '#a8714b', '#7d5236', '#5c3a26', '#edc3a0', '#d7a27c'],
      BEACH_HAIR = ['#2b2019', '#4a3526', '#76553a', '#b88a52', '#d9bd7c', '#1b1714', '#8c3f22', '#c9c4bd'],
      BEACH_SWIM = ['#d8413a', '#2a67b5', '#f2c230', '#1f9a8a', '#e46fa8', '#f08a2c', '#15253f', '#7a4fb5', '#ffffff', '#3cb56b', '#ea5a5a', '#2fb3d6'],
      BEACH_CLOTH = ['#e8e1d0', '#6f8fb0', '#c96d5a', '#e7c56a', '#9fbf8e', '#f2f2ee', '#8a7bb8'],
      BEACH_TOWEL = ['#e2574c', '#2f7fc1', '#f4c542', '#39a88f', '#f08bb4', '#ff8c3a', '#8d5bc2', '#ffffff', '#4cc2e0', '#e8e05c'],
      BEACH_UMBRELLA = ['#e04a3f', '#2d6fbe', '#f3b637', '#1c9a86', '#ee7fae', '#f07f2a', '#5b4bb0', '#3fae63'];
    /* The waterline from the airport fence (s = 0) to the sea wall, with landward normals. */
    let beachWaterlineCache = null;
    function beachWaterline() {
      if (beachWaterlineCache) return beachWaterlineCache;
      const poly = LAND_REGIONS[1].polygon,
        from = poly.findIndex((p) => p[0] === -1260 && p[1] === 5420),
        to = poly.findIndex((p) => p[0] === -2610 && p[1] === 5430),
        points = poly
          .slice(from, to + 1)
          .reverse()
          .map(([x, y]) => ({ x, y }));
      let s = 0;
      points.forEach((p, i) => {
        if (i) s += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
        p.s = s;
        const a = points[Math.max(0, i - 1)],
          b = points[Math.min(points.length - 1, i + 1)],
          l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        p.nx = (b.y - a.y) / l;
        p.ny = -(b.x - a.x) / l;
      });
      for (const p of points)
        if (!landAt(p.x + p.nx * 20, p.y + p.ny * 20)) {
          p.nx = -p.nx;
          p.ny = -p.ny;
        }
      return (beachWaterlineCache = { points, length: s });
    }
    /* A point `d` units inland (negative: out to sea) at arc length `s`. */
    function shoreAt(s, d = 0) {
      const { points, length } = beachWaterline(),
        t = clamp(s, 0, length);
      let i = 1;
      while (i < points.length - 1 && points[i].s < t) i++;
      const a = points[i - 1],
        b = points[i],
        k = (t - a.s) / Math.max(1e-6, b.s - a.s),
        nx = a.nx + (b.nx - a.nx) * k,
        ny = a.ny + (b.ny - a.ny) * k,
        nl = Math.hypot(nx, ny) || 1,
        x = a.x + (b.x - a.x) * k,
        y = a.y + (b.y - a.y) * k;
      return {
        x: x + (nx / nl) * d,
        y: y + (ny / nl) * d,
        nx: nx / nl,
        ny: ny / nl,
        // Facing the sea.
        a: Math.atan2(-ny, -nx),
      };
    }
    /* How much sand there is inland of the waterline at `s`, up to the boardwalk. */
    function sandDepthAt(s) {
      let d = 0;
      while (d < 600) {
        const p = shoreAt(s, d + 10);
        if (!onBeach(p.x, p.y) || p.y < BEACH.boardwalk.y + BEACH.boardwalk.width / 2 + 16) break;
        d += 10;
      }
      return d;
    }
    const BEACH_LAYOUT = {
      umbrellas: [],
      towels: [],
      loungers: [],
      towers: [],
      kiosks: [],
      showers: [],
      bins: [],
      racks: [],
      boards: [],
      castles: [],
      buoys: [],
      pedalos: [],
      jetskis: [],
      lamps: [],
      tables: [],
      court: null,
      reserved: [],
    };
    function beachReserve(x0, y0, x1, y1) {
      BEACH_LAYOUT.reserved.push({ x0, y0, x1, y1 });
    }
    function beachSpotFree(x, y, r) {
      if (!onBeach(x, y) || !onBeach(x - r, y) || !onBeach(x + r, y) || !onBeach(x, y + r)) return false;
      if (y - r < BEACH.boardwalk.y + BEACH.boardwalk.width / 2 + 4) return false;
      return !BEACH_LAYOUT.reserved.some((b) => x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1);
    }
    function buildBeachLayout() {
      const L = BEACH_LAYOUT;
      if (L.built) return L;
      L.built = true;
      beachSeed = 90210;
      const { length } = beachWaterline(),
        walkBottom = BEACH.boardwalk.y + BEACH.boardwalk.width / 2;
      // The pier runs out through the middle of the strand; keep a lane either side of it.
      for (const d of BEACH.pier) beachReserve(d.x - 26, d.y - 30, d.x + d.w + 26, d.y + d.h);
      // Kiosks along the top of the sand, just below the boardwalk.
      const kiosk = (kind, name, x, w, h, color) => {
        const k = { kind, name, x: x - w / 2, y: walkBottom + 6, w, h, color };
        L.kiosks.push(k);
        beachReserve(k.x - 14, k.y - 4, k.x + k.w + 14, k.y + k.h + (kind === 'bar' ? 86 : 26));
        return k;
      };
      kiosk('snack', 'SNACKS · COLD DRINKS', -2475, 58, 34, '#3f8fb0');
      const bar = kiosk('bar', 'THE SANDBAR', -2020, 112, 42, '#d9603f');
      kiosk('station', 'LIFEGUARD', -1835, 70, 38, '#d53a33');
      kiosk('icecream', 'ICE CREAM', -1545, 44, 30, '#f19ab9');
      kiosk('surf', 'SURF RENTALS', -1385, 54, 34, '#2c9e8c');
      // The bar's deck: tables with small umbrellas and stools.
      for (let i = 0; i < 4; i++) {
        const t = { x: bar.x + 12 + i * 29, y: bar.y + bar.h + 34, color: BEACH_UMBRELLA[(i * 3) % BEACH_UMBRELLA.length] };
        L.tables.push(t);
      }
      // Surfboards racked beside the surf hut, stood up in the sand.
      const surf = L.kiosks.find((k) => k.kind === 'surf');
      for (let i = 0; i < 7; i++)
        L.boards.push({ x: surf.x - 8 - i * 7, y: surf.y + surf.h + 12, a: Math.PI / 2, upright: true, color: beachPick(BEACH_SWIM) });
      // Outdoor showers, bins and bike racks along the foot of the boardwalk.
      for (const x of [-2270, -1755, -1445]) {
        L.showers.push({ x, y: walkBottom + 14 });
        beachReserve(x - 12, walkBottom, x + 12, walkBottom + 30);
      }
      for (const x of [-2155, -1640]) {
        L.racks.push({ x, y: walkBottom + 12, w: 44 });
        beachReserve(x - 26, walkBottom, x + 26, walkBottom + 22);
      }
      for (let x = -2570; x < -1310; x += 150) {
        if (L.reserved.some((b) => x > b.x0 - 6 && x < b.x1 + 6 && walkBottom + 10 > b.y0 && walkBottom + 10 < b.y1)) continue;
        L.bins.push({ x, y: walkBottom + 9 });
      }
      // Lamp standards along the sea edge of the boardwalk: the promenade is lit at night.
      for (let x = BEACH.boardwalk.x0 + 40; x < BEACH.boardwalk.x1; x += 96) L.lamps.push({ x, y: walkBottom - 2 });
      // Beach volleyball on the upper sand at the west end.
      L.court = { x: -2320, y: 5452, w: 84, h: 42 };
      beachReserve(L.court.x - L.court.w / 2 - 22, L.court.y - L.court.h / 2 - 16, L.court.x + L.court.w / 2 + 22, L.court.y + L.court.h / 2 + 16);
      // Lifeguard towers, facing the swim zone.
      for (const f of [0.2, 0.47, 0.78]) {
        let s = length * f,
          p = shoreAt(s, 92);
        if (Math.abs(p.x + 1710) < 70) p = shoreAt((s += 90), 92);
        L.towers.push({ x: p.x, y: p.y, a: p.a, s });
        beachReserve(p.x - 18, p.y - 18, p.x + 18, p.y + 18);
      }
      // Umbrella rows following the curve of the strand, one or two towels in each shade.
      for (let s = 150; s < length - 90; s += 44) {
        const depth = sandDepthAt(s);
        for (const row of [112, 168, 226, 290]) {
          if (row > depth - 50 || beachRandom() > 0.78) continue;
          const d = row + beachBetween(-9, 9),
            p = shoreAt(s + beachBetween(-8, 8), d);
          if (!beachSpotFree(p.x, p.y, 22)) continue;
          const u = { x: p.x, y: p.y, color: beachPick(BEACH_UMBRELLA), tilt: beachBetween(-0.12, 0.12) };
          L.umbrellas.push(u);
          beachReserve(p.x - 8, p.y - 8, p.x + 8, p.y + 8);
          // Near the bar the rows are loungers for hire; elsewhere people bring towels.
          const premium = Math.abs(p.x + 1970) < 190 && row <= 168;
          const pairs = beachRandom() < 0.55 ? 2 : 1;
          for (let k = 0; k < pairs; k++) {
            const side = pairs === 2 ? (k ? 1 : -1) : beachRandom() < 0.5 ? -1 : 1,
              ox = -p.ny * side * 13,
              oy = p.nx * side * 13;
            // Towels lie head to the land, feet to the sea, in the umbrella's shade.
            const item = { x: p.x + ox - p.nx * 6, y: p.y + oy - p.ny * 6, a: p.a, color: beachPick(BEACH_TOWEL), umbrella: u };
            if (premium) L.loungers.push(item);
            else L.towels.push(item);
          }
        }
      }
      // Towels out in the sun on the lower sand, no shade.
      for (let i = 0; i < 70 && L.towels.length < 150; i++) {
        const s = beachBetween(120, length - 80),
          p = shoreAt(s, beachBetween(58, 100));
        if (!beachSpotFree(p.x, p.y, 12)) continue;
        if (L.towels.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 26)) continue;
        L.towels.push({ x: p.x, y: p.y, a: p.a + beachBetween(-0.3, 0.3), color: beachPick(BEACH_TOWEL), umbrella: null });
      }
      // Sandcastles on the damp sand where it holds a shape.
      for (let i = 0; i < 20 && L.castles.length < 8; i++) {
        const p = shoreAt(beachBetween(160, length - 120), beachBetween(24, 40));
        if (!beachSpotFree(p.x, p.y, 10) || L.castles.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 90)) continue;
        L.castles.push({ x: p.x, y: p.y, a: p.a, size: beachBetween(0.8, 1.3) });
      }
      // Pedal boats pulled up on the sand by the pier.
      for (let i = 0; i < 4; i++) {
        const p = shoreAt(shoreS(-1810) - i * 22, 12);
        L.pedalos.push({ x: p.x, y: p.y, a: p.a + Math.PI / 2, color: ['#f4f1e8', '#e8c14f', '#e2574c', '#2f7fc1'][i], beached: true });
      }
      // The swim zone: a buoy line out past the breakers, bigger yellow markers at the corners.
      for (let s = 170; s < length - 150; s += 34) {
        const p = shoreAt(s, -178);
        if (landAt(p.x, p.y) || (Math.abs(p.x + 1710) < 30 && p.y < 6000)) continue;
        L.buoys.push({ x: p.x, y: p.y, big: false });
      }
      if (L.buoys.length) {
        L.buoys[0].big = true;
        L.buoys.at(-1).big = true;
      }
      // Two pedal boats and two jet skis out on the water, beyond the buoys.
      L.pedalos.push({ cx: -2080, cy: 6040, r: 60, speed: 0.05, color: '#f4f1e8', beached: false, phase: 0 });
      L.pedalos.push({ cx: -1890, cy: 6080, r: 45, speed: -0.06, color: '#e8c14f', beached: false, phase: 2 });
      L.jetskis.push({ cx: -2260, cy: 6090, r: 120, speed: 0.55, color: '#e2574c', phase: 0 });
      L.jetskis.push({ cx: -1450, cy: 6060, r: 95, speed: -0.7, color: '#2f7fc1', phase: 1.7 });
      return L;
    }
    /* Arc length of the waterline point nearest an x (the strand runs roughly east-west). */
    function shoreS(x) {
      const { points } = beachWaterline();
      let best = 0,
        bd = Infinity;
      for (const p of points)
        if (Math.abs(p.x - x) < bd) {
          bd = Math.abs(p.x - x);
          best = p.s;
        }
      return best;
    }
    /* Kiosks, the bar, the station and the tower legs are solid on foot. */
    function beachBlocked(x, y, r = 0) {
      if (x < -2710 || x > -1250 || y < 5300 || y > 5900) return false;
      const L = BEACH_LAYOUT;
      for (const k of L.kiosks) if (x + r > k.x && x - r < k.x + k.w && y + r > k.y && y - r < k.y + k.h) return true;
      for (const t of L.towers) if (Math.abs(x - t.x) < 9 + r && Math.abs(y - t.y) < 9 + r) return true;
      return false;
    }
    /* Vehicles meet the same kiosks, and boats meet the pier's piles. */
    function addBeachColliders() {
      buildBeachLayout();
      for (const k of BEACH_LAYOUT.kiosks) addStatic(k.x, k.y, k.w, k.h, 26, 'beach kiosk');
      for (const t of BEACH_LAYOUT.towers) addStatic(t.x - 9, t.y - 9, 18, 18, 30, 'lifeguard tower');
      for (const d of BEACH.pier) addStatic(d.x, d.y, d.w, d.h, 2, 'dock');
    }
    /**
     * THE CAST
     * A slot per person. `hours` is when that kind of person is on the beach at
     * all; `threshold` is how busy it has to be before this one turns up.
     */
    const beachgoers = [];
    const beachBall = { active: false, x: 0, y: 0, z: 0, from: null, to: null, t: 0, dur: 1, kind: 'volley' },
      beachDiscs = [];
    let beachSpooked = 0,
      beachCrowdCache = { at: -1, x: 0, y: 0, level: 0 },
      beachWhistleClock = 40,
      beachClock = 0;
    const BEACH_HOURS = {
      sunbather: [8.5, 18.8],
      sitter: [8, 20.2],
      lounger: [9, 18.5],
      kid: [9, 18],
      swimmer: [8, 19],
      wader: [8.5, 20],
      volley: [10, 19.2],
      thrower: [9, 19.5],
      jogger: [6, 21],
      stroller: [6.5, 23],
      lifeguard: [9, 19],
      vendor: [8, 24],
      patron: [11, 24],
      rider: [10, 18],
    };
    function beachPerson(kind, anchor, extra = {}) {
      const female = beachRandom() < 0.5,
        child = kind === 'kid',
        p = {
          kind,
          anchor,
          x: anchor.x,
          y: anchor.y,
          z: 0,
          a: anchor.a ?? 0,
          pose: 'stand',
          phase: beachRandom() * 10,
          timer: beachBetween(2, 20),
          state: 'off',
          threshold: beachRandom(),
          female,
          scale: child ? beachBetween(0.55, 0.7) : beachBetween(0.92, 1.06),
          skin: beachPick(BEACH_SKIN),
          hair: beachPick(BEACH_HAIR),
          suit: beachPick(BEACH_SWIM),
          // Most women on the beach wear a top; the shirt is for strollers and staff.
          top: female && kind !== 'jogger',
          shirt: null,
          visible: false,
          ...extra,
        };
      if (kind === 'stroller' || kind === 'patron') p.shirt = beachPick(BEACH_CLOTH);
      if (kind === 'jogger') p.shirt = beachPick(['#e8e4da', '#3a70b8', '#d9534a', '#222a33']);
      if (kind === 'lifeguard') {
        p.suit = '#d9302c';
        p.shirt = p.female ? null : '#e8e24c';
      }
      if (kind === 'vendor') p.shirt = '#f3efe4';
      beachgoers.push(p);
      return p;
    }
    function populateBeach() {
      buildBeachLayout();
      beachgoers.length = 0;
      beachDiscs.length = 0;
      beachSpooked = 0;
      beachSeed = 7331;
      const L = BEACH_LAYOUT,
        { length } = beachWaterline();
      for (const t of L.towels) {
        const kind = beachRandom() < 0.72 ? 'sunbather' : 'sitter';
        beachPerson(kind, t);
        // Some towels are shared by a couple lying side by side.
        if (t.umbrella && beachRandom() < 0.25)
          beachPerson('sitter', { x: t.x - Math.cos(t.a + Math.PI / 2) * 9, y: t.y - Math.sin(t.a + Math.PI / 2) * 9, a: t.a });
      }
      for (const t of L.loungers) beachPerson('lounger', t);
      for (const c of L.castles) {
        beachPerson('kid', { x: c.x + 9, y: c.y - 4, a: Math.PI });
        if (beachRandom() < 0.6) beachPerson('kid', { x: c.x - 9, y: c.y + 3, a: 0 });
      }
      for (let i = 0; i < 26; i++) {
        const s = beachBetween(200, length - 170),
          p = shoreAt(s, -beachBetween(66, 160));
        if (landAt(p.x, p.y) || onBeachPier(p.x, p.y, -10)) continue;
        beachPerson('swimmer', { x: p.x, y: p.y, a: p.a, s }, { home: { x: p.x, y: p.y } });
      }
      for (let i = 0; i < 18; i++) {
        const s = beachBetween(180, length - 150),
          d = beachBetween(8, 40),
          p = shoreAt(s, -d);
        if (Math.abs(p.x + 1710) < 40) continue;
        beachPerson('wader', { x: p.x, y: p.y, a: p.a + Math.PI, s, d }, { home: { x: p.x, y: p.y } });
      }
      // Volleyball: four players, two a side, all on court or none.
      const court = L.court,
        volleyThreshold = beachBetween(0.1, 0.45);
      for (const [dx, dy] of [
        [-30, -10],
        [-24, 12],
        [30, 10],
        [24, -12],
      ])
        beachPerson('volley', { x: court.x + dx, y: court.y + dy, a: dx < 0 ? 0 : Math.PI }, { threshold: volleyThreshold, side: Math.sign(dx) });
      // Frisbee and ball throwers in pairs on the lower sand.
      for (let i = 0; i < 4; i++) {
        const s = beachBetween(260, length - 260),
          a = shoreAt(s, beachBetween(40, 64)),
          b = shoreAt(s + beachBetween(60, 85), beachBetween(40, 70));
        if (!beachSpotFree(a.x, a.y, 6) || !beachSpotFree(b.x, b.y, 6)) continue;
        const threshold = beachBetween(0.2, 0.7),
          first = beachPerson('thrower', { x: a.x, y: a.y, a: 0 }, { threshold }),
          second = beachPerson('thrower', { x: b.x, y: b.y, a: 0 }, { threshold });
        first.partner = second;
        second.partner = first;
        beachDiscs.push({ a: first, b: second, ball: i % 2 === 1, t: 0, dur: 1.3, holder: first, wait: 1, x: a.x, y: a.y, z: 0 });
      }
      // Joggers along the firm sand at the waterline, strollers a little higher up.
      for (let i = 0; i < 6; i++)
        beachPerson('jogger', shoreAt(beachBetween(100, length - 100), 26), {
          s: beachBetween(100, length - 100),
          dir: beachRandom() < 0.5 ? 1 : -1,
          speed: beachBetween(9, 12) * KMH,
          lane: beachBetween(18, 34),
          threshold: beachBetween(0, 0.5),
        });
      for (let i = 0; i < 14; i++)
        beachPerson('stroller', shoreAt(beachBetween(100, length - 100), 40), {
          s: beachBetween(100, length - 100),
          dir: beachRandom() < 0.5 ? 1 : -1,
          speed: beachBetween(3.5, 5) * KMH,
          lane: beachBetween(30, 60),
          // The boardwalk walkers are the last to go home: a few are out at night.
          threshold: i >= 8 ? beachBetween(0, 0.12) : beachBetween(0, 0.8),
          boardwalk: i >= 8,
        });
      for (const t of L.towers) beachPerson('lifeguard', { x: t.x, y: t.y, a: t.a }, { threshold: 0, tower: t });
      for (const k of L.kiosks) {
        const staff = k.kind === 'bar' ? 2 : k.kind === 'station' ? 0 : 1;
        for (let i = 0; i < staff; i++)
          beachPerson('vendor', { x: k.x + k.w * (0.35 + i * 0.3), y: k.y + k.h - 8, a: Math.PI / 2 }, { threshold: 0, kiosk: k });
      }
      for (const t of L.tables)
        for (const side of [-1, 1])
          beachPerson('patron', { x: t.x + side * 8, y: t.y, a: side < 0 ? 0 : Math.PI }, { threshold: beachBetween(0, 0.9), stool: true });
      for (const boat of [...L.pedalos.filter((b) => !b.beached), ...L.jetskis])
        beachPerson('rider', { x: boat.cx, y: boat.cy, a: 0 }, { boat, threshold: beachBetween(0.1, 0.6) });
      // A lifeguard pickup parked by the station, and a jet ski for hire off the pier head.
      const station = L.kiosks.find((k) => k.kind === 'station');
      if (canSpawnCar('pickup', station.x - 50, station.y + 24, 0)) {
        const truck = makeCar('pickup', station.x - 50, station.y + 24, 0, false, '#e9c23a');
        truck.beachPatrol = true;
      }
      const head = BEACH.pier[1];
      if (canSpawnCar('jetski', head.x + head.w / 2, head.y + head.h + 26, 0)) makeCar('jetski', head.x + head.w / 2, head.y + head.h + 26, 0, false, '#e2574c');
    }
    /**
     * TIME OF DAY
     * 0 = empty, 1 = a packed summer afternoon. Rain and heavy cloud thin it out,
     * and so does a recent shooting.
     */
    function beachDensity(hour = (worldMinutes % 1440) / 60) {
      const ramp = (a, b) => clamp((hour - a) / (b - a), 0, 1);
      let d;
      if (hour < 6) d = 0.04;
      else if (hour < 9) d = 0.08 + 0.2 * ramp(6, 9);
      else if (hour < 11.5) d = 0.28 + 0.72 * ramp(9, 11.5);
      else if (hour < 16) d = 1;
      else if (hour < 18.5) d = 1 - 0.55 * ramp(16, 18.5);
      else if (hour < 20.5) d = 0.45 - 0.3 * ramp(18.5, 20.5);
      else d = 0.15 - 0.1 * ramp(20.5, 23);
      d *= 1 - 0.85 * weather.rain;
      d *= 1 - 0.5 * clamp((weather.cloud - 0.6) / 0.4, 0, 1);
      if (beachSpooked > 0) d *= 0.2 + 0.8 * clamp(1 - beachSpooked / 150, 0, 1);
      return clamp(d, 0, 1);
    }
    function beachHourOk(kind, hour) {
      const [from, to] = BEACH_HOURS[kind];
      return hour >= from && hour <= to;
    }
    /* Roughly what the camera can see, so people only pop in and out off screen. */
    function beachInView(x, y, margin = 90) {
      const vh = clamp(viewportHeight * 0.68, 430, 630) / Math.max(0.14, worldZoom),
        halfW = (vh * viewportWidth) / Math.max(1, viewportHeight) / 2 + margin,
        halfH = vh * 0.66 + margin;
      return Math.abs(x - cameraTarget.x) < halfW && Math.abs(y - cameraTarget.y) < halfH;
    }
    /* The boardwalk point straight up the sand from a spot: where people come and go. */
    function boardwalkEntry(p) {
      const w = BEACH.boardwalk;
      return { x: clamp(p.x, w.x0 + 20, w.x1 - 20), y: w.y + 4 };
    }
    function beachWalkTo(p, target, speed, deltaSeconds) {
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      if (d < 3) return true;
      p.a = Math.atan2(target.y - p.y, target.x - p.x);
      const step = Math.min(d, speed * deltaSeconds);
      p.x += Math.cos(p.a) * step;
      p.y += Math.sin(p.a) * step;
      p.phase += deltaSeconds * (speed > 60 ? 14 : 8);
      p.pose = speed > 60 ? 'run' : 'walk';
      return false;
    }
    const BEACH_WATER_KINDS = ['swimmer', 'wader', 'rider'];
    function updateBeach(deltaSeconds) {
      if (!beachgoers.length) return;
      beachSpooked = Math.max(0, beachSpooked - deltaSeconds);
      // Nobody needs thinking about while the player is far from the strand.
      if (Math.abs(player.x + 1970) > 2600 || Math.abs(player.y - 5600) > 2400) {
        for (const p of beachgoers) p.visible = false;
        beachBall.active = false;
        return;
      }
      beachClock += deltaSeconds;
      const hour = (worldMinutes % 1440) / 60,
        density = beachDensity(hour),
        barCrowd = hour > 18 ? 0.75 * (1 - 0.8 * weather.rain) * (beachSpooked > 0 ? 0.3 : 1) : 0;
      beachCarThreats(deltaSeconds);
      for (const p of beachgoers) {
        // Staff keep their hours whatever the crowd; the bar fills up after dark.
        const level = p.kind === 'lifeguard' || p.kind === 'vendor' ? 1 : p.kind === 'patron' ? Math.max(density, barCrowd) : density,
          want = level >= p.threshold && beachHourOk(p.kind, hour) && !(p.fledFor > 0),
          seen = beachInView(p.x, p.y) || beachInView(p.anchor.x, p.anchor.y),
          water = BEACH_WATER_KINDS.includes(p.kind);
        if (p.fledFor > 0) p.fledFor -= deltaSeconds;
        if (p.state === 'off') {
          p.visible = false;
          if (!want) continue;
          if (!seen) beachArrive(p, false);
          else if (!water && p.kind !== 'lifeguard' && p.kind !== 'vendor') beachArrive(p, true);
          else continue;
        } else if (!want && p.state !== 'leave' && p.state !== 'flee') {
          if (!seen || water) {
            if (!seen) {
              p.state = 'off';
              p.visible = false;
              continue;
            }
          } else {
            p.state = 'leave';
            p.target = boardwalkEntry(p);
          }
        }
        p.visible = true;
        if (p.state === 'arrive') {
          p.z = 0;
          if (beachWalkTo(p, beachHome(p), 30, deltaSeconds)) p.state = 'on';
          continue;
        }
        if (p.state === 'leave' || p.state === 'flee') {
          p.z = 0;
          if (beachWalkTo(p, p.target, p.state === 'flee' ? 120 : 30, deltaSeconds)) {
            p.state = 'off';
            p.visible = false;
          }
          continue;
        }
        beachBehave(p, deltaSeconds, hour);
      }
      updateBeachGames(deltaSeconds);
      // The lifeguards' whistle carries over a busy beach now and then.
      beachWhistleClock -= deltaSeconds;
      if (beachWhistleClock <= 0) {
        beachWhistleClock = 45 + Math.random() * 70;
        const tower = BEACH_LAYOUT.towers[Math.floor(Math.random() * BEACH_LAYOUT.towers.length)];
        if (density > 0.4 && beachHourOk('lifeguard', hour) && distanceBetween(tower, player) < 900) lifeguardWhistle(tower);
      }
    }
    /* Where a slot belongs: its towel, its patch of sea, its stool. */
    function beachHome(p) {
      if (p.boardwalk) return { x: shoreAt(p.s).x, y: BEACH.boardwalk.y };
      if (p.kind === 'jogger' || p.kind === 'stroller') return shoreAt(p.s, p.lane);
      return p.anchor;
    }
    function beachArrive(p, walking) {
      const home = beachHome(p);
      p.fledFor = 0;
      if (walking) {
        const entry = boardwalkEntry(home);
        p.x = entry.x + beachBetween(-20, 20);
        p.y = entry.y;
        p.state = 'arrive';
      } else {
        p.x = home.x;
        p.y = home.y;
        p.state = 'on';
      }
      p.timer = beachBetween(2, 25);
      p.visible = true;
    }
    function beachBehave(p, deltaSeconds, hour) {
      p.phase += deltaSeconds;
      p.timer -= deltaSeconds;
      const home = p.anchor;
      switch (p.kind) {
        case 'sunbather': {
          // Lie on the back, turn over, sit up for a while, lie down again.
          p.x = home.x;
          p.y = home.y;
          p.a = home.a;
          p.z = 0.6;
          if (p.timer <= 0) {
            p.pose = p.pose === 'lie' ? beachPick(['lieFront', 'sit', 'lie']) : 'lie';
            p.timer = p.pose === 'sit' ? beachBetween(6, 16) : beachBetween(18, 60);
          }
          if (!['lie', 'lieFront', 'sit'].includes(p.pose)) p.pose = 'lie';
          break;
        }
        case 'sitter':
        case 'lounger': {
          p.x = home.x;
          p.y = home.y;
          p.a = home.a;
          p.z = p.kind === 'lounger' ? 3.2 : 0.6;
          if (p.timer <= 0) {
            p.pose = p.kind === 'lounger' ? (p.pose === 'recline' ? 'sit' : 'recline') : p.pose === 'sit' ? beachPick(['sit', 'lie']) : 'sit';
            p.timer = beachBetween(10, 40);
          }
          if (!['sit', 'lie', 'recline'].includes(p.pose)) p.pose = p.kind === 'lounger' ? 'recline' : 'sit';
          break;
        }
        case 'kid': {
          p.x = home.x;
          p.y = home.y;
          p.a = home.a;
          p.z = 0;
          if (p.timer <= 0) {
            p.pose = p.pose === 'kneel' ? beachPick(['kneel', 'stand']) : 'kneel';
            p.timer = p.pose === 'kneel' ? beachBetween(6, 18) : beachBetween(2, 5);
          }
          if (p.pose !== 'kneel' && p.pose !== 'stand') p.pose = 'kneel';
          break;
        }
        case 'swimmer': {
          // Drift about the swim zone: a few lengths of crawl, a float on the back,
          // treading water to chat. Never onto the sand, never past the buoys.
          if (!p.goal || p.timer <= 0) {
            const s = clamp((p.anchor.s || 800) + beachBetween(-90, 90), 170, beachWaterline().length - 170);
            p.goal = shoreAt(s, -beachBetween(64, 165));
            p.mode = beachPick(['swim', 'swim', 'float', 'tread']);
            p.timer = beachBetween(8, 22);
          }
          const speed = p.mode === 'swim' ? 2.5 * KMH : p.mode === 'float' ? 0.5 * KMH : 0;
          if (speed && !landAt(p.goal.x, p.goal.y)) {
            const d = Math.hypot(p.goal.x - p.x, p.goal.y - p.y);
            if (d > 4) {
              const a = Math.atan2(p.goal.y - p.y, p.goal.x - p.x);
              p.a += normalizeAngle(a - p.a) * Math.min(1, deltaSeconds * 1.5);
              const nx = p.x + Math.cos(p.a) * speed * deltaSeconds,
                ny = p.y + Math.sin(p.a) * speed * deltaSeconds;
              if (!landAt(nx, ny) && beachShelfDistance(nx, ny) > 50) {
                p.x = nx;
                p.y = ny;
              } else p.timer = 0;
            } else p.mode = 'tread';
          }
          p.pose = p.dive > 0 ? 'dive' : p.mode;
          if (p.dive > 0) p.dive -= deltaSeconds;
          p.z = -4.4 + Math.sin(beachClock * 1.6 + p.threshold * 9) * 0.5;
          break;
        }
        case 'wader': {
          // Stand about in the shallows, turn, take a few steps along the shore.
          if (p.timer <= 0) {
            p.timer = beachBetween(4, 12);
            const s = clamp((p.anchor.s || 800) + beachBetween(-40, 40), 170, beachWaterline().length - 150);
            p.goal = beachRandom() < 0.5 ? shoreAt(s, -beachBetween(6, 42)) : null;
            if (!p.goal) p.a += beachBetween(-1.2, 1.2);
          }
          if (p.goal && !beachWalkTo(p, p.goal, 12, deltaSeconds)) p.pose = 'wadeWalk';
          else {
            p.goal = null;
            p.pose = 'wade';
          }
          const depth = clamp(beachShelfDistance(p.x, p.y) / WADE_DEPTH, 0, 1);
          p.z = Number.isFinite(depth) ? -1.5 - depth * 6.5 : -4;
          // Children kick up spray.
          if (p.scale < 0.8 && Math.random() < deltaSeconds * 0.8) particle(p.x, p.y, '#e6f4f7', 3, 25, 2);
          break;
        }
        case 'jogger':
        case 'stroller': {
          const { length } = beachWaterline();
          if (p.boardwalk) {
            // Evening walkers keep to the lit boardwalk.
            const w = BEACH.boardwalk;
            p.pose = 'walk';
            p.x += p.dir * p.speed * deltaSeconds;
            if (p.x < w.x0 + 20 || p.x > w.x1 - 20) p.dir *= -1;
            p.y = w.y + (p.dir > 0 ? 8 : -8);
            p.a = p.dir > 0 ? 0 : Math.PI;
            p.phase += deltaSeconds * strideRate(p.speed);
            p.z = 0;
            break;
          }
          if (p.kind === 'stroller' && p.pause > 0) {
            p.pause -= deltaSeconds;
            p.pose = 'stand';
            p.a = shoreAt(p.s).a;
            break;
          }
          p.s += p.dir * p.speed * deltaSeconds;
          if (p.s < 90 || p.s > length - 90) {
            p.dir *= -1;
            p.s = clamp(p.s, 90, length - 90);
          }
          const q = shoreAt(p.s, p.lane + Math.sin(p.s * 0.02) * 4);
          // The pier stands across the path: go round the landward end of it.
          if (Math.abs(q.x + 1710) < 34) {
            q.y = Math.min(q.y, BEACH.pier[0].y - 18);
          }
          p.a = Math.atan2(q.y - p.y, q.x - p.x);
          p.x = q.x;
          p.y = q.y;
          p.z = 0;
          p.pose = p.kind === 'jogger' ? 'run' : 'walk';
          p.phase += deltaSeconds * strideRate(p.speed);
          if (p.kind === 'stroller' && p.timer <= 0) {
            p.timer = beachBetween(15, 40);
            p.pause = beachBetween(3, 9);
          }
          break;
        }
        case 'lifeguard': {
          // On the front of the tower deck, in front of the cabin.
          const t = p.tower;
          p.x = t.x + Math.cos(t.a) * 5;
          p.y = t.y + Math.sin(t.a) * 5;
          if (p.timer <= 0) {
            p.pose = p.pose === 'sit' ? 'stand' : 'sit';
            p.timer = p.pose === 'sit' ? beachBetween(20, 50) : beachBetween(4, 9);
          }
          if (p.pose !== 'sit' && p.pose !== 'stand') p.pose = 'sit';
          // Scanning the water.
          p.a = t.a + Math.sin(beachClock * 0.3 + t.s) * 0.6;
          p.z = p.pose === 'sit' ? 20 : 19.2;
          break;
        }
        case 'vendor': {
          p.x = home.x;
          p.y = home.y;
          p.a = home.a + Math.sin(beachClock * 0.4 + p.threshold * 6) * 0.3;
          p.z = 0;
          p.pose = 'stand';
          break;
        }
        case 'patron': {
          p.x = home.x;
          p.y = home.y;
          p.a = home.a;
          p.z = 3.4;
          p.pose = 'sit';
          break;
        }
        case 'rider': {
          const boat = p.boat;
          p.x = boat.x;
          p.y = boat.y;
          p.a = boat.a;
          p.z = 0;
          p.pose = 'ride';
          break;
        }
        case 'volley':
        case 'thrower': {
          // Positioned by updateBeachGames; here they just face the play.
          p.z = 0;
          break;
        }
      }
    }
    /**
     * GAMES
     * The volleyball rally and the frisbee pairs share one idea: a projectile
     * flies from one player to another on a parabola, the receiver reaches for
     * it as it arrives, and plays it on.
     */
    function updateBeachGames(deltaSeconds) {
      // Pedal boats and jet skis loop out beyond the buoys while someone is aboard.
      for (const boat of [...BEACH_LAYOUT.pedalos, ...BEACH_LAYOUT.jetskis]) {
        if (boat.beached) continue;
        const dir = Math.sign(boat.speed);
        boat.phase = (boat.phase || 0) + deltaSeconds * boat.speed;
        boat.x = boat.cx + Math.cos(boat.phase) * boat.r;
        boat.y = boat.cy + Math.sin(boat.phase) * boat.r * 0.55;
        boat.a = Math.atan2(Math.cos(boat.phase) * 0.55 * dir, -Math.sin(boat.phase) * dir);
        boat.active = beachgoers.some((p) => p.boat === boat && p.visible && p.state === 'on');
      }
      const players = beachgoers.filter((p) => p.kind === 'volley' && p.state === 'on');
      if (players.length === 4) {
        for (const p of players) {
          // A little shuffling on the spot, facing the net.
          p.x = p.anchor.x + Math.sin(beachClock * 1.3 + p.threshold * 20 + p.anchor.y) * 4;
          p.y = p.anchor.y + Math.cos(beachClock * 0.9 + p.anchor.x) * 3;
          p.a = p.side < 0 ? 0 : Math.PI;
          if (p.pose !== 'hit' || beachClock > (p.hitUntil || 0)) p.pose = 'ready';
        }
        if (!beachBall.active) {
          beachBall.active = true;
          beachBall.from = players[0];
          beachBall.to = players[2];
          beachBall.t = 0;
          beachBall.dur = 1.3;
        }
        beachBall.t += deltaSeconds / beachBall.dur;
        const f = beachBall.from,
          to = beachBall.to,
          k = Math.min(1, beachBall.t);
        beachBall.x = f.x + (to.x - f.x) * k;
        beachBall.y = f.y + (to.y - f.y) * k;
        beachBall.z = 16 + Math.sin(k * Math.PI) * (beachBall.dur > 1.1 ? 42 : 22);
        if (k >= 1) {
          to.pose = 'hit';
          to.hitUntil = beachClock + 0.35;
          // Two touches a side at most: set to the partner, then over the net.
          const partner = players.find((q) => q !== to && q.side === to.side),
            over = players.filter((q) => q.side !== to.side),
            setFirst = beachBall.from.side !== to.side && Math.random() < 0.6;
          beachBall.from = to;
          beachBall.to = setFirst ? partner : over[Math.floor(Math.random() * over.length)];
          beachBall.dur = setFirst ? 0.8 : 1.2 + Math.random() * 0.3;
          beachBall.t = 0;
        }
      } else beachBall.active = false;
      for (const g of beachDiscs) {
        const on = g.a.state === 'on' && g.b.state === 'on';
        g.active = on;
        if (!on) continue;
        for (const p of [g.a, g.b]) {
          p.x = p.anchor.x;
          p.y = p.anchor.y;
          p.a = Math.atan2(p.partner.y - p.y, p.partner.x - p.x);
          if (p.pose !== 'throw' || beachClock > (p.poseUntil || 0)) p.pose = 'stand';
        }
        if (g.wait > 0) {
          g.wait -= deltaSeconds;
          g.x = g.holder.x;
          g.y = g.holder.y;
          g.z = 10;
          if (g.wait <= 0) {
            g.holder.pose = 'throw';
            g.holder.poseUntil = beachClock + 0.4;
            g.t = 0;
          }
          continue;
        }
        g.t += deltaSeconds / g.dur;
        const from = g.holder,
          to = g.holder.partner,
          k = Math.min(1, g.t),
          bend = Math.sin(k * Math.PI) * (g.ball ? 0 : 10);
        g.x = from.x + (to.x - from.x) * k - Math.sin(from.a) * bend;
        g.y = from.y + (to.y - from.y) * k + Math.cos(from.a) * bend;
        g.z = 10 + Math.sin(k * Math.PI) * (g.ball ? 26 : 9);
        if (k >= 1) {
          to.pose = 'throw';
          to.poseUntil = beachClock + 0.3;
          g.holder = to;
          g.wait = 0.8 + Math.random() * 1.4;
        }
      }
    }
    /**
     * PANIC
     * Called by notifyViolence for every shot and blast. Near the danger, people
     * on the sand join the city's pedestrians, already fleeing; further off they
     * run for the boardwalk and leave; swimmers duck under and strike out away.
     */
    function beachHearsViolence(source, kind = 'gunfire') {
      if (!beachgoers.length || Math.abs(source.x + 1970) > 1500 || Math.abs(source.y - 5600) > 900) return;
      // Only the nearest dozen become full pedestrians: each costs a whole person
      // model to draw, and the rest are just as convincing running off the sand.
      const heard = kind === 'explosion' ? 900 : 620,
        near = kind === 'explosion' ? 300 : 200;
      const hearing = [];
      for (const p of beachgoers) {
        if (!p.visible || p.state === 'off' || p.state === 'flee') continue;
        const d = Math.hypot(p.x - source.x, p.y - source.y);
        if (d <= heard) hearing.push({ p, d });
      }
      hearing.sort((a, b) => a.d - b.d);
      hearing.forEach(({ p, d }, i) => beachFlee(p, source, d < near && i < 12));
      if (hearing.length) beachSpooked = 180;
    }
    function beachFlee(p, threat, becomePedestrian) {
      p.fledFor = 90 + Math.random() * 90;
      if (p.kind === 'swimmer') {
        p.dive = 1.5 + Math.random() * 1.5;
        const away = Math.atan2(p.y - threat.y, p.x - threat.x);
        p.goal = { x: p.x + Math.cos(away) * 120, y: p.y + Math.sin(away) * 60 };
        p.mode = 'swim';
        p.timer = 10;
        return;
      }
      if (p.kind === 'rider') return;
      if (becomePedestrian && !p.tower && groundAt(p.x, p.y, 5) && !solid(p.x, p.y, 5)) {
        pedestrians.push({
          x: p.x,
          y: p.y,
          a: Math.atan2(p.y - threat.y, p.x - threat.x),
          color: p.shirt || p.suit,
          hp: 30,
          flee: 8 + Math.random() * 4,
          threat: { x: threat.x, y: threat.y },
          panicSaid: false,
          timer: 4,
          walk: 0,
          state: 'walk',
          fromBeach: true,
        });
        p.state = 'off';
        p.visible = false;
        return;
      }
      // Grab the towel and go: up the sand, away from the trouble, off the beach.
      const entry = boardwalkEntry(p),
        away = Math.sign(p.x - threat.x) || 1;
      p.state = 'flee';
      p.target = { x: clamp(entry.x + away * 160, BEACH.boardwalk.x0 + 10, BEACH.boardwalk.x1 - 10), y: entry.y - 4 };
      if (p.tower) p.z = 0;
    }
    /* A car on the sand scatters whoever is in its path, and runs down anyone it reaches. */
    function beachCarThreats(deltaSeconds) {
      for (const c of vehicles) {
        if (c.hp <= 0 || isBoat(c) || isAircraft(c) || Math.abs(c.speed || 0) < 45) continue;
        if (c.x < -2710 || c.x > -1250 || c.y < 5330 || c.y > 5860) continue;
        const ahead = { x: c.x + Math.cos(c.a) * 40, y: c.y + Math.sin(c.a) * 40 };
        for (const p of beachgoers) {
          if (!p.visible || p.state === 'flee' || p.state === 'off' || BEACH_WATER_KINDS.includes(p.kind) || p.tower) continue;
          const d = Math.hypot(p.x - ahead.x, p.y - ahead.y);
          if (d < 90) beachFlee(p, c, d < 45);
          if (d < 90 && !beachSpooked) beachSpooked = 60;
        }
      }
    }
    /* 0..1: how much crowd noise there is around a point (cached twice a second). */
    function beachCrowdLevel(x, y) {
      if (!beachgoers.length) return 0;
      if (gameTime - beachCrowdCache.at < 0.5 && Math.hypot(x - beachCrowdCache.x, y - beachCrowdCache.y) < 80) return beachCrowdCache.level;
      let n = 0;
      if (Math.abs(x + 1970) < 1400 && Math.abs(y - 5600) < 900)
        for (const p of beachgoers) if (p.visible && p.state !== 'off' && Math.hypot(p.x - x, p.y - y) < 480) n++;
      beachCrowdCache = { at: gameTime, x, y, level: clamp(n / 45, 0, 1) };
      return beachCrowdCache.level;
    }
    /* Developer console: how busy the beach is and who is doing what. */
    function beachStatus() {
      const byKind = {},
        byPose = {};
      for (const p of beachgoers)
        if (p.visible && p.state !== 'off') {
          byKind[p.kind] = (byKind[p.kind] || 0) + 1;
          byPose[p.pose] = (byPose[p.pose] || 0) + 1;
        }
      const L = BEACH_LAYOUT;
      return {
        clock: clockText(),
        density: +beachDensity().toFixed(2),
        spooked: Math.round(beachSpooked),
        slots: beachgoers.length,
        present: Object.values(byKind).reduce((a, b) => a + b, 0),
        byKind,
        byPose,
        props: {
          umbrellas: L.umbrellas.length,
          towels: L.towels.length,
          loungers: L.loungers.length,
          towers: L.towers.length,
          kiosks: L.kiosks.length,
          buoys: L.buoys.length,
          castles: L.castles.length,
        },
      };
    }
    // END SUBSYSTEM: src/beach.js
