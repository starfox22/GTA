    const ISLE_STREETS = [
      { name: 'OCEAN CRESCENT', vertical: false, at: -4544, from: 5600, to: 9600 },
      { name: 'BELGRAVE STREET', vertical: false, at: -3744, from: 5600, to: 9600 },
      { name: 'CROWN AVENUE', vertical: false, at: -2944, from: 5600, to: 9600, divided: true },
      { name: 'REGENT ROW', vertical: false, at: -2144, from: 5600, to: 9600 },
      { name: 'MARINA DRIVE', vertical: false, at: -1344, from: 5600, to: 9600 },
      { name: 'WESTGATE', vertical: true, at: 5600, from: -4544, to: -1344 },
      { name: 'REGENCY ROAD', vertical: true, at: 6400, from: -4544, to: -1344 },
      { name: 'MONARCH BOULEVARD', vertical: true, at: 7200, from: -4544, to: -1344, divided: true },
      { name: 'ORANGERY LANE', vertical: true, at: 8000, from: -3744, to: -1344 },
      { name: 'ST JAMES STREET', vertical: true, at: 8800, from: -4544, to: -1344 },
      { name: 'LIGHTHOUSE ROAD', vertical: true, at: 9600, from: -4544, to: -1344 },
    ];
    /**
     * ROUNDABOUTS. `island` is the planted central island (a fountain in it),
     * the carriageway runs round it to `outer` and traffic circulates
     * anticlockwise (seen from above) on the ring `lane`; the pavement runs to
     * `walk`.
     */
    const ISLE_CIRCLES = [
      { id: 'crown', name: 'CROWN CIRCUS', x: 7200, y: -2944, island: 64, lane: 88, outer: 112, walk: 152 },
      { id: 'harbour', name: 'HARBOUR CIRCLE', x: 6400, y: -1344, island: 48, lane: 72, outer: 96, walk: 136 },
    ];
    function isleCircleAt(x, y, margin = 0) {
      for (const c of ISLE_CIRCLES) if (Math.hypot(x - c.x, y - c.y) < c.walk + margin) return c;
      return null;
    }
    /* A street's carriageways as centre lines [a, b] with their widths (one for a
       plain street, two for a divided one), cut short where they meet a
       roundabout: each ends 4 units inside the ring's lane so the route graph
       joins them to it. */
    function isleCarriageways(street) {
      const lines = street.divided ? [-ISLE_DIVIDED_LANE, ISLE_DIVIDED_LANE] : [0],
        width = street.divided ? ISLE_CARRIAGEWAY : ISLE_STREET,
        out = [];
      for (const off of lines) {
        let pieces = [[street.from, street.to]];
        for (const c of ISLE_CIRCLES) {
          const centre = street.vertical ? c.y : c.x,
            across = street.vertical ? c.x : c.y;
          if (Math.abs(across - street.at) > 1) continue;
          const half = Math.sqrt(c.lane * c.lane - off * off) - 4;
          pieces = pieces.flatMap(([a, b]) =>
            [
              [a, Math.min(b, centre - half)],
              [Math.max(a, centre + half), b],
            ].filter(([p, q]) => q - p > 1),
          );
        }
        for (const [a, b] of pieces)
          out.push({
            width,
            points: street.vertical
              ? [
                  [street.at + off, a],
                  [street.at + off, b],
                ]
              : [
                  [a, street.at + off],
                  [b, street.at + off],
                ],
          });
      }
      return out;
    }
    // The ring's lane as a closed polyline (24 sides).
    function isleCirclePolyline(c, radius = c.lane, sides = 24) {
      const pts = [];
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * TAU;
        pts.push([Math.round((c.x + Math.cos(a) * radius) * 100) / 100, Math.round((c.y + Math.sin(a) * radius) * 100) / 100]);
      }
      return pts;
    }
    /**
     * THE BRIDGES (BRIDGES, geography.js; their designs are BRIDGE_DESIGNS.harp
     * and .bowstring below, drawn by monarch-bridges3d.js):
     *   sovereign  SOVEREIGN BRIDGE: Northbank (Crown Avenue's line, y -2944, off
     *              Riverbank Dr) to the island's Westgate. A white cable-stayed
     *              bridge with one leaning pylon and a single harp of parallel
     *              stays down the central reservation.
     *   regency    REGENCY BRIDGE: the Ridgeline shore (Regency Road) to Harbour
     *              Circle. Three Belle Epoque bowstring arches in bronze-green
     *              cast iron with lattice spandrels, on granite piers, gilded
     *              figures on the four entrance pylons.
     */
    const MONARCH_BRIDGES = [
      {
        id: 'sovereign',
        style: 'harp',
        name: 'SOVEREIGN BRIDGE',
        link: 'NORTHBANK - MONARCH ISLE',
        width: 128,
        deck: 0,
        a: [3150, -2944],
        b: [5600, -2944],
      },
      {
        id: 'regency',
        style: 'bowstring',
        name: 'REGENCY BRIDGE',
        link: 'RIDGELINE - MONARCH ISLE',
        width: 116,
        deck: 0,
        a: [6400, 600],
        b: [6400, -1276],
      },
    ];
    BRIDGES.push(...MONARCH_BRIDGES);
    /* SOVEREIGN BRIDGE: one pylon standing in the sound near the island, leaning
       back toward it at 60 degrees, with a single plane of parallel stays down the
       median to the deck on the long side (the pylon's own weight balances them:
       no back stays). Heights are above the deck. */
    BRIDGE_DESIGNS.harp = (bridge, [w0, w1], m, s) => {
      const W = bridge.width,
        lean = (60 * Math.PI) / 180,
        length = 420,
        base = w1 - 300,
        tilt = { x: Math.cos(lean), y: Math.sin(lean) },
        stayAngle = (27 * Math.PI) / 180,
        stays = [];
      // Parallel stays: from a point on the pylon's axis down at stayAngle to the deck.
      for (let k = 0; k < 13; k++) {
        const t = 0.3 + (k / 12) * 0.66,
          px = base + tilt.x * length * t,
          py = tilt.y * length * t;
        stays.push({ from: { x: px, y: py }, to: { x: px - py / Math.tan(stayAngle), y: 5 } });
      }
      s.harp = { base, length, lean, tilt, stays, top: { x: base + tilt.x * length, y: tilt.y * length }, median: 7 };
      const reach = stays.at(-1).to.x;
      s.channels = [
        [w0 + 40, reach - 30],
        [base + 60, w1 - 40],
      ];
      s.footings.push({ along: base, across: 0, hx: 40, hy: W / 2 + 30, kind: 'pylon caisson' });
      s.approach = [...approachPiers(reach - 30, w0, 150), ...approachPiers(base + 60, w1, 110)].filter((x) => x < reach - 40 || x > base + 50);
      // The pylon: a leaning box of boxes, to aircraft.
      for (let k = 0; k < 6; k++) {
        const t0 = k / 6,
          t1 = (k + 1) / 6,
          x = base + tilt.x * length * ((t0 + t1) / 2);
        s.solids.push({ along: x, across: 0, hx: (tilt.x * length) / 12 + 12, hy: 13, minHeight: tilt.y * length * t0, height: tilt.y * length * t1 + 8, kind: 'pylon' });
      }
      // The harp of stays: a fan box stepping down along the deck.
      spanSolids(s.solids, reach, base, (x) => 6 + Math.max(0, (x - reach) * Math.tan(stayAngle)), 6, 'stays', 50);
    };
    /* REGENCY BRIDGE: three bowstring arches end to end over the channel, each
       tied by the deck, on two granite river piers; granite entrance pylons at
       both ends carry gilded figures. */
    BRIDGE_DESIGNS.bowstring = (bridge, [w0, w1], m, s) => {
      const W = bridge.width,
        spans = [300, 360, 300],
        total = spans.reduce((a, b) => a + b, 0),
        start = m - total / 2,
        arches = [];
      let x = start;
      for (const [i, span] of spans.entries()) {
        arches.push({ from: x, to: x + span, rise: i === 1 ? 118 : 96 });
        x += span;
      }
      s.bowstring = { arches, plane: W / 2 + 6, pylons: [w0 - 12, w1 + 12] };
      s.archHeightAt = (along) => {
        for (const a of arches)
          if (along >= a.from && along <= a.to) {
            const t = (along - a.from) / (a.to - a.from);
            return a.rise * 4 * t * (1 - t);
          }
        return 0;
      };
      s.channels = arches.map((a) => [a.from + 28, a.to - 28]);
      for (const p of [arches[0].to, arches[1].to]) s.footings.push({ along: p, across: 0, hx: 26, hy: W / 2 + 26, kind: 'river pier' });
      for (const p of [arches[0].from, arches[2].to]) s.footings.push({ along: p, across: 0, hx: 22, hy: W / 2 + 20, kind: 'abutment pier' });
      s.approach = [...approachPiers(arches[0].from, w0, 120), ...approachPiers(arches[2].to, w1, 120)];
      for (const side of [-1, 1]) {
        spanSolids(s.solids, arches[0].from, arches[2].to, (along) => s.archHeightAt(along) + 8, 5, 'arch', 40);
        for (const a of arches) s.solids.push({ along: a.from, across: side * s.bowstring.plane, hx: 10, hy: 8, minHeight: 0, height: 52, kind: 'arch post' });
      }
      // Remove the duplicate arch boxes spanSolids made for the second side.
      s.solids = s.solids.filter((b, i, list) => b.kind !== 'arch' || list.findIndex((o) => o.kind === 'arch' && o.along === b.along) === i);
      for (const p of s.bowstring.pylons)
        for (const side of [-1, 1]) s.solids.push({ along: p, across: side * (W / 2 + 14), hx: 12, hy: 12, minHeight: 0, height: 118, kind: 'pylon' });
    };
    /**
     * ROADS FOR EVERYONE ELSE
     * The island's streets, rings and the bridge approaches join COUNTY_ROADS,
     * so the GPS route graph, the county police graph, the street names and the
     * map all know them. The Regency Road runs on over Ridgeline from the
     * bridge's south landing along the range's west coast to Eagle Pass.
     */
    const MONARCH_ROADS = [];
    for (const street of ISLE_STREETS)
      for (const piece of isleCarriageways(street)) MONARCH_ROADS.push({ name: street.name, width: piece.width, points: piece.points, isle: true });
    for (const c of ISLE_CIRCLES) MONARCH_ROADS.push({ name: c.name, width: c.outer - c.island, points: isleCirclePolyline(c), isle: true, ring: true });
    const MONARCH_RIDGE_ROAD = {
      name: 'REGENCY ROAD',
      width: 92,
      points: [
        [6400, 600],
        [6400, 700],
        [6256, 860],
        [6206, 1100],
        [6236, 1400],
        [6330, 1660],
        [6500, 1800],
      ],
    };
    MONARCH_ROADS.push(MONARCH_RIDGE_ROAD);
    COUNTY_ROADS.push(
      ...MONARCH_ROADS,
      ...MONARCH_BRIDGES.map((b) => ({ name: b.name, width: b.width, points: [b.a, b.b], bridge: true })),
    );
    /* Whether a point is on one of the island's carriageways (grown by `pad`):
       the kerb-to-kerb asphalt of the grid streets and the roundabouts' rings. */
    function monarchRoadAt(x, y, pad = 0) {
      if (!nearMonarchIsle(x, y)) return false;
      for (const s of ISLE_STREETS) {
        const across = Math.abs((s.vertical ? x : y) - s.at),
          along = s.vertical ? y : x,
          k = isleKerbHalf(s.at, s.vertical);
        if (across < k + pad && along > s.from - k - pad && along < s.to + k + pad) {
          // A divided boulevard's planted median is not road.
          if (s.divided && across < ISLE_MEDIAN / 2 - pad && !isleJunctionNear(x, y) && !isleCircleAt(x, y, -30)) return false;
          return true;
        }
      }
      for (const c of ISLE_CIRCLES) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (d < c.outer + pad && d > c.island - pad) return true;
      }
      return false;
    }
    /* The street under a point, and at a junction both of them. */
    function monarchStreetName(x, y) {
      if (!nearMonarchIsle(x, y)) return null;
      const circle = ISLE_CIRCLES.find((c) => Math.hypot(x - c.x, y - c.y) < c.outer + 20);
      if (circle) return circle.name;
      const near = ISLE_STREETS.filter((s) => {
        const across = s.vertical ? x - s.at : y - s.at,
          along = s.vertical ? y : x;
        return Math.abs(across) < isleKerbHalf(s.at, s.vertical) + 28 && along > s.from - 60 && along < s.to + 60;
      });
      if (near.length >= 2) {
        const v = near.find((s) => s.vertical),
          h = near.find((s) => !s.vertical);
        if (v && h) return v.name + ' & ' + h.name;
      }
      if (near.length) return near[0].name;
      return null;
    }
    /**
     * PARCELS
     * Every lot on the island and what is built on it. `kind` picks the builder
     * in monarch3d.js; each parcel's `buildings` (map rectangles with a height)
     * go into the city's `buildings` list, flagged `monarch`, so collision,
     * bullets, police sight, the minimap and the layout audit all see them;
     * `solids` are low things only the island draws (walls, hedges, pools,
     * fountains) that still stop people and cars.
     *
     * Villas face south, onto the street in front of their gates: the camera
     * looks north, so a south front is the one the player sees.
     */
    const MONARCH_PARCELS = [];
    const MONARCH_VILLAS = [
      // Beachfront, north of Ocean Crescent: the gardens run down to the sand.
      { id: 'villa-1', name: 'VILLA AZZURRA', style: 'mediterranean', lot: { x: 5660, y: -4960, w: 600, h: 328 }, gate: 'south', tennis: false },
      { id: 'villa-2', name: 'THE GLASS HOUSE', style: 'modern', lot: { x: 6330, y: -4980, w: 740, h: 348 }, gate: 'south' },
      { id: 'villa-3', name: 'HALCYON HOUSE', style: 'hamptons', lot: { x: 7330, y: -4990, w: 720, h: 358 }, gate: 'south' },
      { id: 'villa-4', name: 'BELVEDERE', style: 'neoclassical', lot: { x: 8120, y: -4985, w: 640, h: 353 }, gate: 'south' },
      { id: 'villa-5', name: 'CASA DEL SOL', style: 'spanish', lot: { x: 8850, y: -4960, w: 640, h: 328 }, gate: 'south' },
      // East cliffs, east of Lighthouse Road: the gates face west onto it.
      { id: 'villa-6', name: 'CLIFFTOP', style: 'modern', lot: { x: 9688, y: -4420, w: 320, h: 560 }, gate: 'west', cantilever: true },
      { id: 'villa-7', name: 'ROSEMOOR', style: 'tudor', lot: { x: 9688, y: -3640, w: 330, h: 600 }, gate: 'west' },
      { id: 'villa-8', name: 'SEACLIFF MANOR', style: 'chateau', lot: { x: 9688, y: -2860, w: 330, h: 620 }, gate: 'west' },
      // Inside the grid: two lots a block, on Belgrave Street.
      { id: 'villa-9', name: 'VILLA TOSCANA', style: 'mediterranean', lot: { x: 5688, y: -4456, w: 308, h: 624 }, gate: 'south', tennis: true },
      { id: 'villa-10', name: 'WHITEHALL', style: 'neoclassical', lot: { x: 6004, y: -4456, w: 308, h: 624 }, gate: 'south' },
      { id: 'villa-11', name: 'SHINGLE HOUSE', style: 'hamptons', lot: { x: 6488, y: -4456, w: 302, h: 624 }, gate: 'south', tennis: true },
      { id: 'villa-12', name: 'KORA PAVILION', style: 'modern', lot: { x: 6798, y: -4456, w: 302, h: 624 }, gate: 'south' },
      { id: 'villa-13', name: 'VILLA MIRAMAR', style: 'artdeco', lot: { x: 8888, y: -4456, w: 308, h: 624 }, gate: 'south' },
      { id: 'villa-14', name: 'LAUREL COURT', style: 'georgian', lot: { x: 9204, y: -4456, w: 308, h: 624 }, gate: 'south', tennis: true },
    ];
    /**
     * A villa's plan inside its lot, in map units: the house (1..3 boxes), the
     * garage, pool, terrace, tennis court, drive and the gate in the boundary
     * wall. Worked out once per villa from its lot and style.
     */
    function planVilla(v, random) {
      const L = v.lot,
        east = v.gate === 'west',
        // Local frame: u across the frontage, depth from the gate inward.
        across = east ? L.h : L.w,
        depth = east ? L.w : L.h,
        toMap = (u, d, w, h) =>
          east ? { x: L.x + d, y: L.y + u, w: h, h: w } : { x: L.x + u, y: v.gate === 'south' ? L.y + L.h - d - h : L.y + d, w, h },
        wide = across > 500,
        houseW = Math.min(across - 96, wide ? 300 + random() * 90 : 190 + random() * 40),
        houseD = Math.min(depth * 0.42, wide ? 118 + random() * 30 : 128 + random() * 34),
        setback = wide ? 60 + random() * 16 : 118 + random() * 30,
        hx = (across - houseW) / 2 + (random() - 0.5) * (across - houseW - 60) * 0.3,
        storeys = v.style === 'modern' || v.style === 'artdeco' ? 2 : v.style === 'chateau' || v.style === 'neoclassical' ? 3 : 2 + (random() < 0.5 ? 1 : 0),
        // Villas are built with generous 3.6 m floors.
        storey = 3.6 * UNITS_PER_METRE,
        house = toMap(hx, setback, houseW, houseD),
        plan = { villa: v, house, storeys, storey, height: storeys * storey + 4, wings: [], extras: [] };
      // The garage on the side with more room: beside the house if it fits,
      // otherwise forward of it near the gate. A wing steps back on the other side.
      const rightRoom = across - 24 - (hx + houseW),
        leftRoom = hx - 24,
        garageRight = rightRoom >= leftRoom,
        room = garageRight ? rightRoom : leftRoom,
        garageBeside = room >= 84,
        garageU = garageRight ? across - 24 - 64 : 24,
        garageD = garageBeside ? setback + 20 : 22;
      plan.garage = { ...toMap(garageU, garageD, 64, 70), height: 3.4 * UNITS_PER_METRE };
      if (wide || random() < 0.6) {
        const wingRoom = (garageRight ? leftRoom : rightRoom) - 8,
          wingW = Math.min(90, wingRoom),
          wingD = houseD * 0.7;
        if (wingW > 40) {
          const u = garageRight ? hx - wingW : hx + houseW;
          plan.wings.push({ ...toMap(u, setback + houseD * 0.18, wingW, wingD), height: storey + 8 });
        }
      }
      // Behind the house: the terrace and the pool.
      const back = setback + houseD + 14;
      plan.terrace = toMap(hx + 10, back, houseW - 20, 40);
      const poolW = Math.min(houseW * 0.8, 160),
        poolD = 44;
      plan.pool = toMap(hx + (houseW - poolW) / 2, back + 44, poolW, poolD);
      if (back + 44 + poolD + 16 > depth - 8) plan.pool = null;
      // A tennis court where the lot is long enough (behind the pool).
      if (v.tennis && depth > 560) {
        const cw = 110,
          cd = 200;
        plan.tennis = toMap((across - cw) / 2, depth - cd - 22, cw, cd);
      }
      // The gate: in the middle of the frontage (or off to the garage side).
      plan.gateAt = east ? { x: L.x, y: L.y + garageU + 32 } : { x: L.x + garageU + 32, y: v.gate === 'south' ? L.y + L.h : L.y };
      plan.gateAxis = east ? 'x' : 'y';
      plan.gateWidth = 44;
      return plan;
    }
    /* The rest of the parcels, one per block (or a pair of blocks for the garden). */
    const ISLE_BLOCK_USES = {
      '0,1': 'countryclub',
      '1,1': 'arcade',
      '2,1': 'towerSovereign',
      '3,1': 'provisions',
      '4,1': 'clinic',
      '0,2': 'motors',
      '1,2': 'academy',
      '2,2': 'towerMonarch',
      '3,2': 'etoile',
      '4,2': 'townhouses',
      '0,3': 'residences',
      '1,3': 'residencesCircle',
      '2,3': 'harbourfront',
      '3,3': 'chandlery',
      '4,3': 'harbourEast',
    };
    /* The botanic garden spans blocks (2, 0) and (3, 0) and the Kew Walk between. */
    const MONARCH_GARDEN = (() => {
      const a = isleBlock(2, 0),
        b = isleBlock(3, 0);
      return {
        x: a.x,
        y: a.y,
        w: b.x + b.w - a.x,
        h: a.h,
        // The Palm House on the garden's axis (Kew Walk, x 8000).
        house: { x: 8000, y: -4190, w: 560, d: 196, dome: 168, wing: 104 },
        pond: { x: 8000, y: -3962, rx: 150, ry: 40 },
        gate: { x: 8000, y: -3832 },
        // Planting beds, each a place the renderer fills with its own plants
        // (monarch-garden3d.js) and walkers stop at to look and take photos.
        beds: {
          arid: { x: 7330, y: -4436, w: 260, h: 140 },
          ferns: { x: 8422, y: -4436, w: 260, h: 140 },
          bamboo: { x: 7360, y: -4262, w: 300, h: 150 },
          socotra: { x: 8350, y: -4262, w: 300, h: 150 },
          parterreWest: { x: 7440, y: -3990, w: 330, h: 110 },
          parterreEast: { x: 8230, y: -3990, w: 330, h: 110 },
        },
        // Bougainvillea arches along the terrace walk and cherries along the south lawn.
        arches: [7420, 7470, 7520, 7570, 7620, 8380, 8430, 8480, 8530, 8580].map((x) => ({ x, y: -4040 })),
        cherries: [7380, 7470, 7560, 7650, 8350, 8440, 8530, 8620].map((x) => ({ x, y: -3868 })),
        // The fence's gates (gaps with bollards that keep cars out).
        gates: [
          { x: 8000, y: -3832, axis: 'y', width: 70 },
          { x: 8000, y: -4456, axis: 'y', width: 70 },
          { x: 7300, y: -4040, axis: 'x', width: 50 },
          { x: 8712, y: -4040, axis: 'x', width: 50 },
        ],
      };
    })();
