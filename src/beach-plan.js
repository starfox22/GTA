    // The beach plan: waterline coordinates (shoreAt, sandDepthAt), BEACH_LAYOUT furniture, colliders.
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
      // Beach volleyball on the upper sand at the west end: a regulation court in
      // its sand pit, with the clear zone round it and the scoreboard to the north
      // kept free of towels and umbrellas (beachvolley.js).
      L.court = volleyCourtPlan();
      {
        const c = L.court,
          hx = c.w / 2 + c.pit + c.free,
          hy = c.h / 2 + c.pit + c.free;
        beachReserve(c.x - hx, Math.min(c.y - hy, c.board.y - 6), c.x + hx, c.y + hy);
      }
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
      // The volleyball poles and net (beachvolley.js).
      if (L.court && volleyBlocked(x, y, r)) return true;
      return false;
    }
    /* Vehicles meet the same kiosks, and boats meet the pier's piles. */
    function addBeachColliders() {
      buildBeachLayout();
      for (const k of BEACH_LAYOUT.kiosks) addStatic(k.x, k.y, k.w, k.h, 26, 'beach kiosk');
      for (const t of BEACH_LAYOUT.towers) addStatic(t.x - 9, t.y - 9, 18, 18, 30, 'lifeguard tower');
      for (const d of BEACH.pier) addStatic(d.x, d.y, d.w, d.h, 2, 'dock');
    }
