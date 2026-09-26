    // BEGIN SUBSYSTEM: src/monarch.js — Monarch Isle: the plan, the land and the streets
    /**
     * Monarch Isle
     * Source: src/monarch.js
     * Scope: shared game closure (included after county.js).
     *
     * The rich island north of the Ridgeline Range, across the Regency Channel
     * (~160 m) from the mountains and Sovereign Sound (~260 m) from North Point.
     * Everything the rest of the game needs to know about it is planned here, as
     * data: the coast, the street grid, the roundabouts, every parcel and what
     * stands on it, the marina basin and its berths, the colliders, the painted
     * ground sheet, the map and the district names. monarch-life.js runs the
     * island (traffic, people, boats, sound); monarch3d.js, monarch-garden3d.js
     * and monarch-bridges3d.js draw it.
     *
     * THE GRID. Blocks are strictly 100 m: street centreline to street centreline
     * is ISLE_BLOCK = 800 units in both directions. Columns run x 5600..9600 and
     * rows y -4544..-1344 (5 x 4 blocks). A plain street is 96 wide (12 m) with a
     * 40-unit (5 m) pavement each side, so a block's lot is 624 x 624 (78 m); the
     * two boulevards (Crown Avenue, row y -2944, and Monarch Boulevard, column
     * x 7200) are divided: two 48-wide carriageways either side of a 24-wide
     * planted median, so their lots start 100 from the centreline.
     *
     * Coordinates are map units (UNITS_PER_METRE = 8). The island is x 5460..10150,
     * y -5092..-468 (about 590 m by 580 m, the breakwater included).
     */
    const ISLE_COLS = [5600, 6400, 7200, 8000, 8800, 9600],
      ISLE_ROWS = [-4544, -3744, -2944, -2144, -1344],
      ISLE_BLOCK = 800,
      ISLE_STREET = 96,
      ISLE_WALK = 40,
      ISLE_CARRIAGEWAY = 48,
      ISLE_MEDIAN = 24,
      // The divided boulevards: column 2 and row 2.
      ISLE_DIVIDED_COL = 7200,
      ISLE_DIVIDED_ROW = -2944,
      // Lane offsets from a street's centre line (right-hand traffic).
      ISLE_LANE = 24,
      ISLE_DIVIDED_LANE = ISLE_MEDIAN / 2 + ISLE_CARRIAGEWAY / 2;
    // A private random so the island's dressing never shifts the seeded city.
    function isleRandomSource(seed) {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    /* A building of `n` floors at real scale: a SHOP_FLOOR ground floor, STOREY
       floors above and a parapet. */
    function isleFloors(n) {
      return Math.round(SHOP_FLOOR + (n - 1) * STOREY + 0.8 * UNITS_PER_METRE);
    }
    // Half the road reserve either side of a street centre line (carriageway + pavement).
    function isleReserveHalf(value, vertical) {
      return (vertical ? value === ISLE_DIVIDED_COL : value === ISLE_DIVIDED_ROW) ? 100 : ISLE_STREET / 2 + ISLE_WALK;
    }
    // Half the carriageway (kerb to kerb) of a grid street.
    function isleKerbHalf(value, vertical) {
      return (vertical ? value === ISLE_DIVIDED_COL : value === ISLE_DIVIDED_ROW) ? ISLE_MEDIAN / 2 + ISLE_CARRIAGEWAY : ISLE_STREET / 2;
    }
    /* The lot of block (i, j): inside its pavements. i is the column (0 west),
       j the row (0 north). */
    function isleBlock(i, j) {
      const x0 = ISLE_COLS[i] + isleReserveHalf(ISLE_COLS[i], true),
        x1 = ISLE_COLS[i + 1] - isleReserveHalf(ISLE_COLS[i + 1], true),
        y0 = ISLE_ROWS[j] + isleReserveHalf(ISLE_ROWS[j], false),
        y1 = ISLE_ROWS[j + 1] - isleReserveHalf(ISLE_ROWS[j + 1], false);
      return { i, j, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    /**
     * THE COAST
     * West: a straight limestone sea wall facing North Point across Sovereign
     * Sound, carrying the esplanade. North: Monarch Beach, a long sweep of sand
     * on the open sea behind the beachfront villas. North-east and east: low
     * granite cliffs and rocks. South-east: the marina basin, closed by a
     * breakwater mole with a lighthouse on its tip; its mouth opens south-west.
     * South: Regency Point (the yacht club's headland) and the Regency Gardens
     * sea wall, where the Regency Bridge comes ashore from the mountains.
     */
    const MONARCH_ISLE = {
      id: 'monarch',
      name: 'MONARCH ISLE',
      color: '#8d9d80',
      polygon: [
        [5460, -1090],
        [5460, -1800],
        [5460, -2600],
        [5460, -3400],
        [5460, -4100],
        ...smoothShoreline(
          [
            [5460, -4420],
            [5480, -4700],
            [5560, -4960],
            [5720, -5130],
            [5980, -5210],
          ],
          5,
        ),
        // Monarch Beach: one gentle sweep of sand facing the open sea.
        ...smoothShoreline(
          [
            [6300, -5232],
            [7000, -5258],
            [7700, -5272],
            [8400, -5266],
            [9050, -5238],
            [9520, -5170],
          ],
          6,
        ),
        // The north-east rocks: a knuckled granite point.
        [9700, -5120],
        [9800, -5062],
        [9880, -4990],
        [9950, -4900],
        [10010, -4800],
        [10050, -4700],
        [10080, -4600],
        [10094, -4500],
        [10090, -4380],
        [10106, -4240],
        // The east shore: low cliffs with coves.
        [10088, -3960],
        [10110, -3620],
        [10084, -3300],
        [10104, -2960],
        [10080, -2620],
        [10102, -2260],
        [10086, -1900],
        [10100, -1540],
        [10114, -1180],
        [10132, -820],
        [10150, -580],
        // The breakwater mole: its outer (south) face, the tip and its harbour side.
        [10126, -496],
        [10000, -470],
        [9400, -468],
        [8700, -468],
        [8140, -470],
        [8040, -474],
        [7996, -490],
        [7974, -514],
        [7990, -538],
        [8040, -554],
        [8200, -558],
        [9000, -558],
        [9790, -558],
        // The basin's east quay, the north quay and Regency Point.
        [9870, -580],
        [9900, -640],
        [9900, -1160],
        [9880, -1200],
        [9200, -1200],
        [8400, -1200],
        [7730, -1200],
        [7700, -1180],
        [7696, -1060],
        [7680, -990],
        [7640, -940],
        [7580, -910],
        [7500, -900],
        [7420, -922],
        // The Regency Gardens sea wall.
        [7300, -958],
        [7000, -978],
        [6700, -990],
        [6400, -996],
        [6100, -994],
        [5800, -996],
        [5600, -1012],
        [5510, -1040],
      ],
    };
    LAND_REGIONS.push(MONARCH_ISLE);
    function onMonarchIsle(x, y) {
      return regionContains(MONARCH_ISLE, x, y);
    }
    /* Off the city's street grid: the county (past CITY_SIZE) and Monarch Isle,
       whose roads the police, the GPS and the county patrols take from the
       route graph (COUNTY_ROADS) instead of the grid. */
    function offCityStreets(x, y) {
      return x > CITY_SIZE || y > CITY_SIZE || (x > 5300 && y < -380 && y > -5420);
    }
    // The island and the water round it, for systems that switch on near it.
    const MONARCH_BOUNDS = { x0: 5300, y0: -5420, x1: 10300, y1: -380 };
    function nearMonarchIsle(x, y, margin = 0) {
      const b = MONARCH_BOUNDS;
      return x > b.x0 - margin && x < b.x1 + margin && y > b.y0 - margin && y < b.y1 + margin;
    }
    /**
     * THE MARINA
     * The basin (water) x 7696..9900, y -1200..-558, with seven finger pontoons
     * off the north quay, the superyacht berths along the mole and the east quay,
     * the fuel pontoon in the north-east corner, the yacht club and the harbour
     * master's tower on Regency Point, and the lighthouse at the mole's tip.
     */
    const MONARCH_MARINA = {
      basin: { x: 7696, y: -1200, w: 2204, h: 642 },
      fingers: [7880, 8130, 8380, 8630, 8880, 9130, 9380].map((x) => ({ x: x - 9, y: -1200, w: 18, h: 410 })),
      fuel: { x: 9760, y: -1200, w: 20, h: 118 },
      club: { x: 7470, y: -1196, w: 188, h: 150 },
      harbourMaster: { x: 7560, y: -968, r: 20 },
      lighthouse: { x: 8008, y: -512, r: 15 },
      // The mole's walk (its top), for walkers and the renderer.
      mole: { x0: 8040, x1: 10080, y: -513, half: 36 },
    };
    // Berths: finger index, side (-1 west / 1 east), distance from the quay, design.
    // Designs use the Harbor Point builders (marina3d.js MARINA_BUILDERS).
    const MONARCH_BERTHS = [
      [0, -1, 70, { type: 'sportYacht', name: 'CARPE DIEM', len: 122, beam: 34, hull: '#f4f4f0', accent: '#1b2c4a' }],
      [0, -1, 214, { type: 'sloop', name: 'ZEPHYR', len: 104, beam: 30, hull: '#1f3d5c', accent: '#e8e2d2' }],
      [0, -1, 340, { type: 'dayCruiser', name: 'PETIT PRINCE', len: 80, beam: 26, hull: '#f2f2ee', accent: '#b83a2f' }],
      [0, 1, 78, { type: 'flybridge', name: 'BELLA VISTA', len: 140, beam: 38, hull: '#f5f5f1', accent: '#2b4a66' }],
      [0, 1, 240, { type: 'commuter', name: 'MONTAUK', len: 116, beam: 28, hull: '#1d3a30', accent: '#c28d52' }],
      [0, 1, 362, { type: 'runabout', name: 'LIMONCELLO', len: 68, beam: 24, hull: '#f3d24a', accent: '#1d2a36' }],
      [1, -1, 84, { type: 'megayacht', name: 'SERENITY', len: 176, beam: 44, hull: '#f1f1ee', accent: '#8a969e' }],
      [1, -1, 280, { type: 'catamaran', name: 'DOUBLE HAPPINESS', len: 100, beam: 50, hull: '#f4f4f0', accent: '#2c7a9a' }],
      [1, 1, 88, { type: 'explorer', name: 'ARCTIC TERN', len: 152, beam: 40, hull: '#2d3339', accent: '#d6612a' }],
      [1, 1, 268, { type: 'sportfisher', name: 'BLUE MARLIN', len: 114, beam: 34, hull: '#f3f4f2', accent: '#1f4f86' }],
      [2, -1, 96, { type: 'gulet', name: 'KISMET', len: 140, beam: 36, hull: '#86502c', accent: '#f0e6cc' }],
      [2, -1, 290, { type: 'racer', name: 'MISTRAL', len: 112, beam: 30, hull: '#e8e8e4', accent: '#c21f2e' }],
      [2, 1, 70, { type: 'sportYacht', name: 'NERO', len: 118, beam: 32, hull: '#141619', accent: '#d8d8d4' }],
      [2, 1, 222, { type: 'trawler', name: 'OLD SALT', len: 100, beam: 32, hull: '#2d5646', accent: '#ebe1c6' }],
      [2, 1, 350, { type: 'centerConsole', name: 'REEL TIME', len: 76, beam: 26, hull: '#e0ebf1', accent: '#1f2b33' }],
      [3, -1, 100, { type: 'megayacht', name: 'AURORA BOREALIS', len: 188, beam: 46, hull: '#5c6770', accent: '#ecece8' }],
      [3, -1, 300, { type: 'launch', name: 'LADY GRACE', len: 74, beam: 22, hull: '#6e3620', accent: '#efe6d0' }],
      [3, 1, 82, { type: 'ketch', name: 'SEA SPIRIT', len: 128, beam: 34, hull: '#f2efe6', accent: '#27466b' }],
      [3, 1, 262, { type: 'flybridge', name: 'SOLSTICE', len: 132, beam: 36, hull: '#f5f5f1', accent: '#6b3a2e' }],
      [4, -1, 76, { type: 'commuter', name: 'GATSBY II', len: 120, beam: 28, hull: '#152b44', accent: '#b8864f' }],
      [4, -1, 244, { type: 'sportYacht', name: 'VELOCITÀ', len: 126, beam: 34, hull: '#b01e24', accent: '#f0f0ec' }],
      [4, 1, 96, { type: 'explorer', name: 'POLARIS', len: 160, beam: 42, hull: '#e9e9e4', accent: '#1f3d5c' }],
      [4, 1, 290, { type: 'dayCruiser', name: 'SUNDOWNER', len: 84, beam: 26, hull: '#f2f2ee', accent: '#1f7a6b' }],
      [5, -1, 90, { type: 'catamaran', name: 'LA VIE EN ROSE', len: 96, beam: 48, hull: '#f4efe8', accent: '#c47a8a' }],
      [5, -1, 262, { type: 'sloop', name: 'WINDWARD', len: 110, beam: 30, hull: '#f4f2ea', accent: '#1d3f6e' }],
      [5, 1, 92, { type: 'megayacht', name: 'ELYSIUM', len: 180, beam: 44, hull: '#1b1d21', accent: '#dcdcd6' }],
      [5, 1, 300, { type: 'runabout', name: 'CIAO BELLA', len: 70, beam: 24, hull: '#e4f1f6', accent: '#b8322a' }],
      [6, -1, 72, { type: 'gulet', name: 'SULTANA', len: 134, beam: 34, hull: '#f1ebe0', accent: '#7a4526' }],
      [6, -1, 250, { type: 'sportfisher', name: 'HOOKED', len: 110, beam: 32, hull: '#f3f4f2', accent: '#2a2a2a' }],
      [6, 1, 110, { type: 'megayacht', name: 'AMBROSIA', len: 184, beam: 46, hull: '#f1f1ee', accent: '#b89a5a' }],
      [6, 1, 318, { type: 'launch', name: 'MISS MONARCH', len: 72, beam: 22, hull: '#7b3a20', accent: '#efe6d0' }],
    ];
    /**
     * Superyachts: moored side-to along the mole and the east quay. Each is a
     * full build of its own (monarch3d.js buildIsleSuperyacht): `decks` above
     * the main deck, a `style` for the superstructure, a helipad or a pool.
     * x, y is the hull's middle; a is the bow's heading.
     */
    const MONARCH_SUPERYACHTS = [
      { name: 'SOVEREIGN LADY', x: 8420, y: -622, a: Math.PI, len: 472, beam: 84, hull: '#f3f3ef', accent: '#20324a', decks: 4, style: 'classic', helipad: true },
      { name: 'OBSIDIAN', x: 9150, y: -618, a: Math.PI, len: 420, beam: 76, hull: '#16181b', accent: '#c9ccd0', decks: 3, style: 'sharp', pool: true },
      { name: 'ETERNITY', x: 9844, y: -842, a: Math.PI / 2, len: 400, beam: 74, hull: '#e9ebe8', accent: '#3a5a74', decks: 3, style: 'explorer' },
    ];
    // Moored hulls as oriented boxes (boats steer round them, walkers cannot step on them).
    let isleBerthCache = null;
    function monarchBerths() {
      if (isleBerthCache) return isleBerthCache;
      isleBerthCache = MONARCH_BERTHS.map(([fi, side, along, design], i) => {
        const f = MONARCH_MARINA.fingers[fi];
        return {
          id: 'isle-yacht' + i,
          x: f.x + f.w / 2 + side * (design.beam / 2 + 12),
          y: f.y + along + design.len / 2 - 20,
          len: design.len,
          beam: design.beam,
          design,
          side,
          // Bows out toward the mole (south), sterns to the quay.
          a: Math.PI / 2,
        };
      });
      return isleBerthCache;
    }
    function isleMooredHulls() {
      return [
        ...monarchBerths().map((b) => ({ x: b.x, y: b.y, hx: b.len / 2, hy: b.beam / 2, a: b.a })),
        ...MONARCH_SUPERYACHTS.map((s) => ({ x: s.x, y: s.y, hx: s.len / 2, hy: s.beam / 2, a: s.a })),
      ];
    }
    /* Pontoons are walkable decks over the basin (groundAt). */
    function onIslePontoon(x, y, r = 0) {
      if (!nearMonarchIsle(x, y)) return false;
      const m = MONARCH_MARINA;
      for (const f of m.fingers) if (x - r >= f.x && x + r <= f.x + f.w && y - r >= f.y && y + r <= f.y + f.h) return true;
      const f = m.fuel;
      return x - r >= f.x && x + r <= f.x + f.w && y - r >= f.y && y + r <= f.y + f.h;
    }
    /* Everything fixed a boat steers round in the basin: pontoons and moored hulls. */
    function monarchBoatObstacles() {
      const m = MONARCH_MARINA;
      return [
        ...m.fingers.map((f) => ({ x: f.x + f.w / 2, y: f.y + f.h / 2, hx: f.w / 2 + 3, hy: f.h / 2, a: 0 })),
        { x: m.fuel.x + m.fuel.w / 2, y: m.fuel.y + m.fuel.h / 2, hx: m.fuel.w / 2 + 3, hy: m.fuel.h / 2, a: 0 },
        ...isleMooredHulls(),
      ];
    }
    /**
     * THE STREETS
     * `vertical` streets run along a column (x = at), the others along a row
     * (y = at), from..to along their length. Orangery Lane stops at Belgrave
     * Street: north of it the column is the botanic garden's Kew Walk, a
     * pedestrian avenue.
     */
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
    /**
     * THE TOWERS
     *   THE SOVEREIGN   a slender pencil tower (57 storeys, ~186 m): a square
     *                   shaft with feathered bronze fins that step back in four
     *                   setbacks to a lantern crown, a helipad on the roof.
     *   MONARCH ONE     a twisting glass tower (48 storeys, ~160 m): a softened
     *                   square that turns 90 degrees over its height, white
     *                   balcony bands wrapping every floor, LED crown.
     */
    const MONARCH_TOWERS = [
      { id: 'sovereign', name: 'THE SOVEREIGN', block: [2, 1], x: 7596, y: -3420, w: 116, h: 116, storeys: 57, floor: 3.3 * UNITS_PER_METRE, crown: 64, helipad: false },
      { id: 'monarch-one', name: 'MONARCH ONE', block: [2, 2], x: 7606, y: -2580, w: 150, h: 150, storeys: 48, floor: 3.35 * UNITS_PER_METRE, crown: 40, helipad: true },
    ];
    /**
     * BUSINESSES: every trade the island needs, each with its own sign
     * (SIGN_DESIGNS entries in monarch3d.js). `block` and `slot` place the unit
     * in a block's street frontage (south face, west to east); `door` is filled in.
     */
    const MONARCH_BUSINESSES = [
      // Crown Arcade, block (1, 1), on Crown Avenue.
      { name: 'MAISON VERAUD', trade: 'fashion', block: [1, 1], slot: 0, width: 116, color: '#1c1c1e' },
      { name: 'HALDEN & FROST', trade: 'jewellery', block: [1, 1], slot: 1, width: 104, color: '#0f3b36' },
      { name: 'VALMONT', trade: 'watches', block: [1, 1], slot: 2, width: 96, color: '#16233b' },
      { name: 'SAVILLE & CROWN', trade: 'tailor', block: [1, 1], slot: 3, width: 110, color: '#2a1f1a' },
      { name: 'FLEUR DE LYS', trade: 'florist', block: [1, 1], slot: 4, width: 84, color: '#355a3a' },
      // The Sovereign's podium, block (2, 1).
      { name: 'CROWN PRIVATE BANK', trade: 'bank', block: [2, 2], slot: 0, width: 150, color: '#10202e' },
      { name: 'AURELIE PARIS', trade: 'fashion', block: [2, 1], slot: 0, width: 120, color: '#e8e2d6' },
      { name: 'ORO & PERLA', trade: 'jewellery', block: [2, 1], slot: 1, width: 110, color: '#3a1f28' },
      // Block (3, 1): food and wine.
      { name: 'THE PROVISIONER', trade: 'grocer', block: [3, 1], slot: 0, width: 190, color: '#1f3d2c' },
      { name: 'CAFÉ ROYALE', trade: 'cafe', block: [3, 1], slot: 1, width: 96, color: '#3b2419' },
      { name: 'VINTAGE & VINE', trade: 'wine', block: [3, 1], slot: 2, width: 104, color: '#4a1420' },
      { name: 'GALERIE MONARCH', trade: 'gallery', block: [3, 1], slot: 3, width: 116, color: '#f2f0ea' },
      // Block (4, 1): health.
      { name: 'THE HALCYON CLINIC', trade: 'clinic', block: [4, 1], slot: 0, width: 300, color: '#0f4f4a' },
      { name: 'AQUA SERENA SPA', trade: 'spa', block: [4, 1], slot: 1, width: 240, color: '#1f5f63' },
      // Block (3, 2), on Regent Row: dining.
      { name: 'L’ÉTOILE', trade: 'restaurant', block: [3, 2], slot: 0, width: 220, color: '#0c0c10' },
      { name: 'THE REGENT HOTEL', trade: 'hotel', block: [3, 2], slot: 1, width: 280, color: '#1b2638' },
      // Block (0, 2) is MONARCH MOTORS, the Prestige Collection's flagship (dealership.js).
      // The marina front, blocks (2, 3) and (3, 3), on Marina Drive.
      { name: 'THE OYSTER ROOM', trade: 'seafood', block: [2, 3], slot: 0, width: 150, color: '#12324a' },
      { name: 'GELATERIA DOLCE', trade: 'gelato', block: [2, 3], slot: 1, width: 92, color: '#f4d9e0' },
      { name: 'OCEANIS YACHTS', trade: 'brokerage', block: [2, 3], slot: 2, width: 130, color: '#0e2c57' },
      { name: 'MARINE CHANDLERY', trade: 'chandlery', block: [3, 3], slot: 0, width: 130, color: '#1d3f6e' },
      { name: 'CHAMPAGNE BAR', trade: 'bar', block: [3, 3], slot: 1, width: 110, color: '#1a1a1a' },
      { name: 'BOUTIQUE RIVA', trade: 'fashion', block: [3, 3], slot: 2, width: 110, color: '#f3efe6' },
      // Civic.
      { name: 'MONARCH ACADEMY', trade: 'school', block: [1, 2], slot: 0, width: 300, color: '#1d3a2a' },
      { name: 'POLICE · MONARCH ISLE', trade: 'police', block: [4, 3], slot: 0, width: 150, color: '#0e2244' },
      { name: 'MONARCH COUNTRY CLUB', trade: 'club', block: [0, 1], slot: 0, width: 300, color: '#1f3d2c' },
    ];
    const MONARCH_PAYPHONES = [
      { x: 7064, y: -3066, a: 0, name: 'CROWN AVENUE' },
      { x: 8540, y: -1250, a: 0, name: 'MARINA PROMENADE' },
    ];
    /**
     * BUILD: the parcels' buildings and solids, the street trees and the
     * painted ground sheet. Called from buildWorld() after the county.
     */
    const monarchSolidList = [],
      // Foot-only obstacles (planters, fountains' rims people stop at): circles.
      monarchFootList = [],
      monarchTrees = [],
      monarchLamps = [],
      monarchPlan = { villas: [], blocks: [], shops: [], built: false };
    /* A tower's plaza: the paving round the tower is kept to a forecourt and
       walks; the rest is lawn in the corners (planted with plane trees round
       its edge, planIsleStreetscape), a long reflecting pool with a line of jets
       in the widest lawn and a bronze sculpture on the next. */
    function planIslePlaza(plan) {
      const B = plan.block,
        t = plan.tower,
        P = { x: B.x + 20, y: B.y + 20, w: B.w - 40, h: B.h - 180 },
        gap = 44,
        sections = [
          { x: P.x, y: P.y, w: t.x - gap - P.x, h: P.h },
          { x: t.x + t.w + gap, y: P.y, w: P.x + P.w - (t.x + t.w + gap), h: P.h },
          { x: t.x - gap, y: P.y, w: t.w + gap * 2, h: t.y - gap - P.y },
        ]
          .filter((r) => r.w > 110 && r.h > 110)
          // A walk 24 wide round each lawn.
          .map((r) => ({ x: r.x + 24, y: r.y + 24, w: r.w - 48, h: r.h - 48 }))
          .sort((a, b) => b.w * b.h - a.w * a.h);
      plan.lawns = sections;
      const L = sections[0];
      if (L) {
        const pw = Math.min(90, L.w * 0.42),
          ph = Math.min(L.h * 0.62, 320);
        plan.reflect = { x: L.x + (L.w - pw) / 2, y: L.y + (L.h - ph) / 2, w: pw, h: ph };
        isleSolid(plan.reflect.x, plan.reflect.y, plan.reflect.w, plan.reflect.h, 2, 'pool');
      }
      const S = sections[1];
      if (S) {
        plan.sculpture = { x: S.x + S.w / 2, y: S.y + S.h / 2, kind: t.id === 'sovereign' ? 'rings' : 'arc' };
        isleSolid(plan.sculpture.x - 14, plan.sculpture.y - 14, 28, 28, 40, 'sculpture');
      }
    }
    function isleSolid(x, y, w, h, height, kind) {
      const s = { x, y, w, h, height, kind };
      monarchSolidList.push(s);
      return s;
    }
    function isleBuilding(x, y, w, h, height, extra = {}) {
      const b = { x, y, w, h, style: 0, tropical: false, height, monarch: true, archetype: 'stucco', ...extra };
      buildings.push(b);
      return b;
    }
    /* A wall round a lot with a gap for the gate: four thin solids (two on the gate side). */
    function isleLotWall(lot, gateAt, gateAxis, gateWidth, height = 8, thickness = 4, kind = 'garden wall') {
      const L = lot,
        pieces = [];
      const add = (x, y, w, h) => w > 1 && h > 1 && pieces.push(isleSolid(x, y, w, h, height, kind));
      // North and south sides (along x), east and west (along y).
      for (const [side, y] of [
        ['north', L.y],
        ['south', L.y + L.h - thickness],
      ]) {
        if (gateAxis === 'y' && Math.abs(gateAt.y - (side === 'north' ? L.y : L.y + L.h)) < 2) {
          add(L.x, y, gateAt.x - gateWidth / 2 - L.x, thickness);
          add(gateAt.x + gateWidth / 2, y, L.x + L.w - gateAt.x - gateWidth / 2, thickness);
        } else add(L.x, y, L.w, thickness);
      }
      for (const [side, x] of [
        ['west', L.x],
        ['east', L.x + L.w - thickness],
      ]) {
        if (gateAxis === 'x' && Math.abs(gateAt.x - (side === 'west' ? L.x : L.x + L.w)) < 2) {
          add(x, L.y, thickness, gateAt.y - gateWidth / 2 - L.y);
          add(x, gateAt.y + gateWidth / 2, thickness, L.y + L.h - gateAt.y - gateWidth / 2);
        } else add(x, L.y, thickness, L.h);
      }
      return pieces;
    }
    function buildMonarchIsle() {
      if (monarchPlan.built) return;
      monarchPlan.built = true;
      const random = isleRandomSource(20260925);
      // ---- Villas ----
      for (const v of MONARCH_VILLAS) {
        const plan = planVilla(v, random);
        monarchPlan.villas.push(plan);
        plan.buildings = [
          isleBuilding(plan.house.x, plan.house.y, plan.house.w, plan.house.h, plan.height, { style: v.style === 'modern' ? 0 : 2, villa: v.id, archetype: 'stucco' }),
          ...plan.wings.map((w) => isleBuilding(w.x, w.y, w.w, w.h, w.height, { style: 2, villa: v.id })),
          isleBuilding(plan.garage.x, plan.garage.y, plan.garage.w, plan.garage.h, plan.garage.height, { style: 2, villa: v.id }),
        ];
        plan.walls = isleLotWall(v.lot, plan.gateAt, plan.gateAxis, plan.gateWidth, v.style === 'modern' ? 7 : 9);
        if (plan.pool) isleSolid(plan.pool.x, plan.pool.y, plan.pool.w, plan.pool.h, 2, 'pool');
        if (plan.tennis) {
          const t = plan.tennis;
          // The court's fence (chain-link on four sides, a door in the south side).
          isleSolid(t.x - 6, t.y - 6, t.w + 12, 2, 14, 'fence');
          isleSolid(t.x - 6, t.y + t.h + 4, t.w / 2 - 10, 2, 14, 'fence');
          isleSolid(t.x + t.w / 2 + 16, t.y + t.h + 4, t.w / 2 - 10, 2, 14, 'fence');
          isleSolid(t.x - 6, t.y - 6, 2, t.h + 12, 14, 'fence');
          isleSolid(t.x + t.w + 4, t.y - 6, 2, t.h + 12, 14, 'fence');
        }
      }
      // ---- The towers ----
      for (const t of MONARCH_TOWERS)
        t.building = isleBuilding(t.x, t.y, t.w, t.h, Math.round(t.storeys * t.floor), { style: 0, tower: t.id, archetype: 'tower', monarchTower: t });
      // ---- Blocks ----
      for (const [key, use] of Object.entries(ISLE_BLOCK_USES)) {
        const [i, j] = key.split(',').map(Number),
          block = isleBlock(i, j),
          plan = { key, use, block, parts: [] };
        monarchPlan.blocks.push(plan);
        planIsleBlock(plan, random);
      }
      // ---- Marina buildings ----
      const m = MONARCH_MARINA;
      m.clubBuilding = isleBuilding(m.club.x, m.club.y, m.club.w, m.club.h, isleFloors(2), { style: 2, marina: 'club', facade: 'clubhouse', front: 'south' });
      isleSolid(m.harbourMaster.x - m.harbourMaster.r, m.harbourMaster.y - m.harbourMaster.r, m.harbourMaster.r * 2, m.harbourMaster.r * 2, 150, 'harbour master');
      isleSolid(m.lighthouse.x - m.lighthouse.r, m.lighthouse.y - m.lighthouse.r, m.lighthouse.r * 2, m.lighthouse.r * 2, 150, 'lighthouse');
      // The mole's low parapets: both edges of its walk.
      isleSolid(m.mole.x0, m.mole.y - m.mole.half - 2, m.mole.x1 - m.mole.x0, 4, 8, 'mole parapet');
      isleSolid(m.mole.x0 + 70, m.mole.y + m.mole.half - 2, m.mole.x1 - m.mole.x0 - 70, 4, 8, 'mole parapet');
      // ---- The garden's Palm House (walk round it) ----
      const H = MONARCH_GARDEN.house;
      MONARCH_GARDEN.building = isleBuilding(H.x - H.w / 2, H.y - H.d / 2, H.w, H.d, 19 * UNITS_PER_METRE, { style: 2, garden: true, archetype: 'glasshouse' });
      planIsleGardenFence();
      isleSolid(MONARCH_GARDEN.pond.x - MONARCH_GARDEN.pond.rx, MONARCH_GARDEN.pond.y - MONARCH_GARDEN.pond.ry, MONARCH_GARDEN.pond.rx * 2, MONARCH_GARDEN.pond.ry * 2, 2, 'lily pond');
      // ---- Roundabout fountains ----
      for (const c of ISLE_CIRCLES) {
        const r = c.island - 6;
        isleSolid(c.x - r, c.y - r, r * 2, r * 2, 12, 'fountain');
      }
      for (const p of MONARCH_PAYPHONES) isleSolid(p.x - 4, p.y - 3, 8, 6, 2.4 * UNITS_PER_METRE, 'payphone');
      planIsleStreetscape(random);
      registerMonarchPlaces();
      paintMonarchTile();
    }
    /**
     * A handful of the island's businesses open their doors to the player
     * (PLACES, citylife.js openService): a fashion house (a change of clothes
     * while the heat is on), a café, a champagne bar, a hotel room and the
     * private clinic. They carry `monarch` so civic3d.js leaves their fronts to
     * monarch3d.js. Bike-share stations (cycles.js) at the payphones, the
     * marina, the garden gate and the bridge heads.
     */
    const MONARCH_PLACE_KINDS = {
      'MAISON VERAUD': ['clothes', 'monarch-couture', '#e7d7b0', 'TEE'],
      'CAFÉ ROYALE': ['diner', 'monarch-cafe', '#e8c9a0', 'EAT'],
      'CHAMPAGNE BAR': ['bar', 'monarch-bar', '#f2d98a', 'BAR'],
      'THE REGENT HOTEL': ['sleep', 'monarch-hotel', '#d9c7a0', 'BED'],
      'THE HALCYON CLINIC': ['hospital', 'monarch-clinic', '#bfe0da', '+'],
    };
    function registerMonarchPlaces() {
      for (const shop of monarchPlan.shops) {
        const kind = MONARCH_PLACE_KINDS[shop.name];
        if (!kind || !shop.building || !shop.door) continue;
        const b = shop.building;
        // The first hospital in PLACES is where the player wakes up: keep Saint Marlow first.
        PLACES.push({ id: kind[1], kind: kind[0], name: shop.name, bx: null, by: null, x: b.x, y: b.y, w: b.w, h: b.h, height: b.height, color: kind[2], symbol: kind[3], door: { x: shop.door.x, y: shop.door.y }, monarch: true });
        b.place = kind[1];
      }
      for (const p of MONARCH_PAYPHONES) addBikeShareAnchor({ x: p.x + 60, y: p.y + 30, label: p.name });
      addBikeShareAnchor({ x: 8420, y: -1290, label: 'MONARCH HARBOUR' });
      addBikeShareAnchor({ x: 8110, y: -3700, label: 'BOTANIC GARDEN' });
      addBikeShareAnchor({ x: 5760, y: -2874, label: 'SOVEREIGN BRIDGE' });
    }
    /* The garden's iron railing round all four sides, broken at the gates, where
       bollards 12 units apart let people through and keep cars out. */
    function planIsleGardenFence() {
      const G = MONARCH_GARDEN,
        sides = [
          { axis: 'y', at: G.y, from: G.x, to: G.x + G.w },
          { axis: 'y', at: G.y + G.h, from: G.x, to: G.x + G.w },
          { axis: 'x', at: G.x, from: G.y, to: G.y + G.h },
          { axis: 'x', at: G.x + G.w, from: G.y, to: G.y + G.h },
        ];
      G.fence = [];
      for (const side of sides) {
        let pieces = [[side.from, side.to]];
        for (const gate of G.gates) {
          if (gate.axis !== side.axis || Math.abs((side.axis === 'y' ? gate.y : gate.x) - side.at) > 2) continue;
          const c = side.axis === 'y' ? gate.x : gate.y;
          pieces = pieces.flatMap(([a, b]) => [[a, Math.min(b, c - gate.width / 2)], [Math.max(a, c + gate.width / 2), b]].filter(([p, q]) => q - p > 1));
        }
        for (const [a, b] of pieces) {
          const piece = side.axis === 'y' ? isleSolid(a, side.at - 1.5, b - a, 3, 12, 'garden railing') : isleSolid(side.at - 1.5, a, 3, b - a, 12, 'garden railing');
          G.fence.push(piece);
        }
      }
      G.bollards = [];
      for (const gate of G.gates)
        for (let d = -gate.width / 2 + 8; d <= gate.width / 2 - 8; d += 13) {
          const x = gate.axis === 'y' ? gate.x + d : gate.x,
            y = gate.axis === 'y' ? gate.y : gate.y + d;
          G.bollards.push({ x, y });
          isleSolid(x - 1.5, y - 1.5, 3, 3, 8, 'bollard');
        }
    }
    /**
     * A block's buildings, by use. Commercial blocks carry a frontage of shop
     * units along their south side (the camera's side) with residences over,
     * and whatever the block is for behind.
     */
    function planIsleBlock(plan, random) {
      const B = plan.block,
        push = (x, y, w, h, height, extra = {}) => {
          const b = isleBuilding(Math.round(x), Math.round(y), Math.round(w), Math.round(h), Math.round(height), { block: plan.key, ...extra });
          plan.parts.push(b);
          return b;
        },
        frontDepth = 150;
      // Blocks at a roundabout lose the corner the ring's pavement needs.
      const circleCorner = ISLE_CIRCLES.map((c) => ({
        c,
        corner: [
          [B.x, B.y],
          [B.x + B.w, B.y],
          [B.x, B.y + B.h],
          [B.x + B.w, B.y + B.h],
        ].find(([x, y]) => Math.hypot(x - c.x, y - c.y) < c.walk + 60),
      })).find((o) => o.corner);
      plan.circleCorner = circleCorner ? { x: circleCorner.corner[0], y: circleCorner.corner[1], circle: circleCorner.c } : null;
      const keepCorner = (x, y, w, h) => {
        // Trim a rectangle away from a roundabout corner (keeps 70 clear of the ring's pavement).
        if (!plan.circleCorner) return { x, y, w, h };
        const k = plan.circleCorner,
          clearance = k.circle.walk + 24;
        const cx = Math.max(x, Math.min(k.circle.x, x + w)),
          cy = Math.max(y, Math.min(k.circle.y, y + h));
        if (Math.hypot(cx - k.circle.x, cy - k.circle.y) >= clearance) return { x, y, w, h };
        // Shrink along the side facing the ring.
        const dx = k.x === B.x ? 1 : -1,
          dy = k.y === B.y ? 1 : -1,
          cut = clearance - Math.hypot(cx - k.circle.x, cy - k.circle.y) + 12;
        return dx > 0 ? { x: x + cut, y, w: w - cut, h } : { x, y, w: w - cut, h };
      };
      const frontage = (units, height, options = {}) => {
        // Shop units along the south face, west to east, each its own building.
        const y = B.y + B.h - frontDepth;
        let x = B.x + (options.inset || 0);
        const out = [];
        for (const u of units) {
          let r = keepCorner(x, y, u.width, frontDepth);
          const b = push(r.x, r.y, r.w, r.h, height + (u.extraHeight || 0), { shop: u.name, trade: u.trade, archetype: 'stucco', front: 'south', facade: options.facade || 'limestone' });
          u.building = b;
          u.door = { x: r.x + r.w / 2, y: r.y + r.h + 10 };
          monarchPlan.shops.push(u);
          out.push(b);
          x += u.width + (options.gap || 0);
        }
        return out;
      };
      const shopsIn = (key) => MONARCH_BUSINESSES.filter((s) => s.block[0] + ',' + s.block[1] === key).sort((a, b) => a.slot - b.slot);
      const mansionRow = (x0, x1, y, depth, count, height, extra = {}) => {
        // A terrace of town houses (one building each), south fronts.
        const w = (x1 - x0) / count;
        for (let k = 0; k < count; k++) push(x0 + k * w + 2, y, w - 4, depth, height + (k % 3) * 6, { archetype: 'stucco', facade: extra.facade || 'townhouse', front: 'south', ...extra });
      };
      switch (plan.use) {
        case 'countryclub': {
          // The clubhouse on Crown Avenue; courts, a pool and the putting green behind.
          const club = shopsIn(plan.key)[0];
          club.building = push(B.x + 120, B.y + B.h - 190, 380, 150, 44, { shop: club.name, trade: club.trade, facade: 'clubhouse', front: 'south' });
          club.door = { x: B.x + 310, y: B.y + B.h - 30 };
          monarchPlan.shops.push(club);
          plan.courts = [
            { x: B.x + 30, y: B.y + 40, w: 110, h: 200 },
            { x: B.x + 160, y: B.y + 40, w: 110, h: 200 },
          ];
          for (const t of plan.courts) {
            isleSolid(t.x - 6, t.y - 6, t.w + 12, 2, 14, 'fence');
            isleSolid(t.x - 6, t.y + t.h + 4, t.w + 12, 2, 14, 'fence');
            isleSolid(t.x - 6, t.y - 6, 2, t.h + 12, 14, 'fence');
            isleSolid(t.x + t.w + 4, t.y - 6, 2, t.h + 12, 14, 'fence');
          }
          plan.pool = { x: B.x + 320, y: B.y + 60, w: 180, h: 70 };
          isleSolid(plan.pool.x, plan.pool.y, plan.pool.w, plan.pool.h, 2, 'pool');
          plan.green = { x: B.x + 300, y: B.y + 190, w: 300, h: 210 };
          break;
        }
        case 'arcade': {
          frontage(shopsIn(plan.key), isleFloors(3), { facade: 'arcade' });
          // St Aldric's Chapel behind, on its own green; its door faces south down the green.
          plan.chapel = { x: B.x + 190, y: B.y + 60, w: 120, h: 210 };
          push(plan.chapel.x, plan.chapel.y, plan.chapel.w, plan.chapel.h, 58, { chapel: true, style: 2, facade: 'chapel', front: 'south' });
          plan.residence = push(B.x + 400, B.y + 40, 190, 230, isleFloors(4), { facade: 'mansion', front: 'south' });
          break;
        }
        case 'towerSovereign': {
          frontage(shopsIn(plan.key), isleFloors(2), { facade: 'podium', inset: 150 });
          plan.tower = MONARCH_TOWERS[0];
          planIslePlaza(plan);
          break;
        }
        case 'towerMonarch': {
          const bank = shopsIn(plan.key)[0];
          frontage([bank], isleFloors(2), { facade: 'bank', inset: 170 });
          plan.tower = MONARCH_TOWERS[1];
          planIslePlaza(plan);
          break;
        }
        case 'provisions': {
          frontage(shopsIn(plan.key), isleFloors(3), { facade: 'arcade', inset: 8 });
          // A courtyard of apartments behind.
          push(B.x + 40, B.y + 50, 250, 150, isleFloors(5), { facade: 'mansion', front: 'south' });
          push(B.x + 340, B.y + 50, 250, 150, isleFloors(5), { facade: 'mansion', front: 'south' });
          break;
        }
        case 'clinic': {
          const [clinic, spa] = shopsIn(plan.key);
          clinic.building = push(B.x + 20, B.y + B.h - 210, clinic.width, 190, isleFloors(4), { shop: clinic.name, trade: clinic.trade, facade: 'clinic', front: 'south' });
          clinic.door = { x: B.x + 20 + clinic.width / 2, y: B.y + B.h - 10 };
          spa.building = push(B.x + 364, B.y + B.h - 170, spa.width, 150, isleFloors(2), { shop: spa.name, trade: spa.trade, facade: 'spa', front: 'south' });
          spa.door = { x: B.x + 364 + spa.width / 2, y: B.y + B.h - 10 };
          monarchPlan.shops.push(clinic, spa);
          plan.garden = { x: B.x + 364, y: B.y + 60, w: 240, h: 300 };
          push(B.x + 20, B.y + 40, 300, 150, isleFloors(3), { facade: 'mansion', front: 'south' });
          break;
        }
        case 'motors': {
          // MONARCH MOTORS, the flagship dealership, takes the whole block (dealership.js).
          planDealership(plan, B);
          break;
        }
        case 'academy': {
          const school = shopsIn(plan.key)[0];
          school.building = push(B.x + 40, B.y + B.h - 190, 360, 170, isleFloors(3), { shop: school.name, trade: school.trade, facade: 'academy', front: 'south', style: 2 });
          school.door = { x: B.x + 220, y: B.y + B.h - 10 };
          monarchPlan.shops.push(school);
          plan.field = { x: B.x + 40, y: B.y + 36, w: 360, h: 220 };
          plan.hall = push(B.x + 440, B.y + 40, 150, 380, isleFloors(2), { facade: 'academy', front: 'south', style: 2 });
          break;
        }
        case 'etoile': {
          const [etoile, hotel] = shopsIn(plan.key);
          etoile.building = push(B.x + 20, B.y + B.h - 150, etoile.width, 130, isleFloors(2), { shop: etoile.name, trade: etoile.trade, facade: 'restaurant', front: 'south' });
          etoile.door = { x: B.x + 20 + etoile.width / 2, y: B.y + B.h - 10 };
          hotel.building = push(B.x + 300, B.y + B.h - 250, hotel.width, 230, isleFloors(7), { shop: hotel.name, trade: hotel.trade, facade: 'hotel', front: 'south' });
          hotel.door = { x: B.x + 300 + hotel.width / 2, y: B.y + B.h - 10 };
          monarchPlan.shops.push(etoile, hotel);
          plan.courtyard = { x: B.x + 20, y: B.y + 40, w: 250, h: 260 };
          push(B.x + 300, B.y + 40, 300, 150, isleFloors(4), { facade: 'mansion', front: 'south' });
          break;
        }
        case 'townhouses':
          mansionRow(B.x + 10, B.x + B.w - 10, B.y + B.h - 160, 140, 6, isleFloors(3));
          mansionRow(B.x + 10, B.x + B.w - 10, B.y + 60, 140, 5, isleFloors(3), { facade: 'townhouseBrick' });
          plan.gardens = { x: B.x + 10, y: B.y + 220, w: B.w - 20, h: B.h - 400 };
          break;
        case 'residences':
          push(B.x + 30, B.y + B.h - 190, 250, 170, isleFloors(6), { facade: 'mansion', front: 'south' });
          push(B.x + 340, B.y + B.h - 190, 250, 170, isleFloors(5), { facade: 'mansionLight', front: 'south' });
          push(B.x + 30, B.y + 40, 560, 140, isleFloors(4), { facade: 'mansion', front: 'south' });
          plan.garden = { x: B.x + 30, y: B.y + 210, w: 560, h: 190 };
          break;
        case 'residencesCircle': {
          const r1 = keepCorner(B.x, B.y + B.h - 200, 280, 180);
          push(r1.x, r1.y, r1.w, r1.h, isleFloors(5), { facade: 'mansionLight', front: 'south' });
          push(B.x + 320, B.y + B.h - 200, 270, 180, isleFloors(6), { facade: 'mansion', front: 'south' });
          push(B.x + 30, B.y + 40, 560, 150, isleFloors(4), { facade: 'mansionLight', front: 'south' });
          plan.garden = { x: B.x + 30, y: B.y + 220, w: 560, h: 170 };
          break;
        }
        case 'harbourfront':
          frontage(shopsIn(plan.key), isleFloors(5), { facade: 'harbour' });
          push(B.x + 20, B.y + 40, 280, 240, isleFloors(6), { facade: 'mansionLight', front: 'south' });
          push(B.x + 330, B.y + 40, 270, 240, isleFloors(7), { facade: 'mansion', front: 'south' });
          break;
        case 'chandlery':
          frontage(shopsIn(plan.key), isleFloors(4), { facade: 'harbour', inset: 12, gap: 8 });
          push(B.x + 20, B.y + 40, 580, 200, isleFloors(5), { facade: 'mansionLight', front: 'south' });
          break;
        case 'harbourEast': {
          const police = shopsIn(plan.key)[0];
          police.building = push(B.x + B.w - 170, B.y + B.h - 150, 150, 130, isleFloors(2), { shop: police.name, trade: police.trade, facade: 'police', front: 'south' });
          police.door = { x: B.x + B.w - 95, y: B.y + B.h - 10 };
          monarchPlan.shops.push(police);
          plan.policeYard = { x: B.x + B.w - 170, y: B.y + B.h - 290, w: 150, h: 120 };
          push(B.x + 20, B.y + B.h - 200, 400, 180, isleFloors(6), { facade: 'harbour', front: 'south' });
          push(B.x + 20, B.y + 40, 580, 170, isleFloors(5), { facade: 'mansionLight', front: 'south' });
          break;
        }
      }
    }
    /**
     * STREETSCAPE: street trees down every pavement (London planes on the
     * streets, palms along the waterfront, clipped limes on the boulevards'
     * medians), lamp standards, and the Regency Gardens and marina quay planting.
     */
    function planIsleStreetscape(random) {
      const onAnyRoad = (x, y, pad) =>
        MONARCH_ROADS.some((r) => r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + pad));
      const blocked = (x, y, pad) =>
        !landAt(x, y) ||
        onAnyRoad(x, y, pad) ||
        isleCircleAt(x, y, 4) ||
        buildings.some((b) => b.monarch && x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) ||
        monarchSolidList.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) ||
        monarchPlan.shops.some((s) => s.door && Math.hypot(s.door.x - x, s.door.y - y) < 26) ||
        monarchPlan.villas.some((v) => Math.hypot(v.gateAt.x - x, v.gateAt.y - y) < 44) ||
        dealershipKeepOut(x, y);
      const tree = (x, y, r, kind) => {
        if (blocked(x, y, 6)) return false;
        if (monarchTrees.some((t) => Math.abs(t.x - x) < 16 && Math.abs(t.y - y) < 16)) return false;
        const t = { x, y, r, isle: kind, tropical: kind === 'palm', county: true, blossom: kind === 'cherry', pine: kind === 'cypress' };
        monarchTrees.push(t);
        trees.push(t);
        return true;
      };
      const lamp = (x, y, kind = 'lantern') => {
        if (!landAt(x, y) || onAnyRoad(x, y, 3) || isleCircleAt(x, y, -4) === null ? false : false) return;
        if (onAnyRoad(x, y, 3) || dealershipKeepOut(x, y)) return;
        // Nor on a bridge's deck at its landing.
        if (MONARCH_BRIDGES.some((B) => segmentDistance(x, y, B.a, B.b) < B.width / 2 + 4)) return;
        monarchLamps.push({ x, y, kind });
      };
      // Street trees and lamps down both pavements of every street, every 80.
      for (const s of ISLE_STREETS) {
        const kerb = isleKerbHalf(s.at, s.vertical),
          off = kerb + 14;
        for (let v = s.from + 60; v <= s.to - 60; v += 80) {
          for (const side of [-1, 1]) {
            const x = s.vertical ? s.at + side * off : v,
              y = s.vertical ? v : s.at + side * off;
            // Not in a junction's corner, where the crossing is.
            if (ISLE_STREETS.some((o) => o.vertical !== s.vertical && Math.abs((s.vertical ? y : x) - o.at) < isleKerbHalf(o.at, o.vertical) + 46 && (s.vertical ? x : y) > o.from - 60 && (s.vertical ? x : y) < o.to + 60))
              continue;
            const waterfront = s.name === 'MARINA DRIVE' || s.name === 'WESTGATE' || s.name === 'OCEAN CRESCENT',
              phase = Math.round((v - s.from) / 80) % 2;
            if (phase === 0) tree(x, y, waterfront ? 17 : 19 + random() * 3, waterfront ? 'palm' : 'plane');
            else lamp(x, y, 'lantern');
          }
        }
        // Clipped limes down the boulevards' medians.
        if (s.divided)
          for (let v = s.from + 110; v <= s.to - 110; v += 56) {
            const x = s.vertical ? s.at : v,
              y = s.vertical ? v : s.at;
            if (ISLE_STREETS.some((o) => o.vertical !== s.vertical && Math.abs((s.vertical ? y : x) - o.at) < isleKerbHalf(o.at, o.vertical) + 40)) continue;
            if (isleCircleAt(x, y, 30)) continue;
            monarchTrees.push({ x, y, r: 11, isle: 'lime', median: true });
          }
      }
      // Regency Gardens (between Marina Drive and the south sea wall, west of the headland).
      for (let x = 5700; x < 7380; x += 110)
        for (const y of [-1180, -1090]) {
          const px = x + (y === -1090 ? 55 : 0);
          if (Math.abs(px - 6400) < 170) continue;
          tree(px, y + (random() - 0.5) * 16, 18, y === -1090 ? 'palm' : 'plane');
        }
      // Tower plazas: plane trees round each lawn, inside its edge.
      for (const plan of monarchPlan.blocks)
        for (const l of plan.lawns || []) {
          for (let x = l.x + 18; x <= l.x + l.w - 18; x += 52) for (const y of [l.y + 18, l.y + l.h - 18]) tree(x, y, 16 + random() * 3, 'plane');
          for (let y = l.y + 70; y <= l.y + l.h - 70; y += 52) for (const x of [l.x + 18, l.x + l.w - 18]) tree(x, y, 16 + random() * 3, 'plane');
        }
      // Lighthouse Park: a grove of pines and planes on the clifftop south of
      // the east villas, above the marina.
      for (let x = 9700; x <= 10040; x += 64)
        for (let y = -2180; y <= -1270; y += 64) if (random() < 0.62) {
            const pine = random() < 0.5;
            tree(x + (random() - 0.5) * 30, y + (random() - 0.5) * 30, pine ? 9 : 17 + random() * 4, pine ? 'cypress' : 'plane');
          }
      // The garden's flowering cherries along the south lawn.
      for (const c of MONARCH_GARDEN.cherries) tree(c.x, c.y, 17, 'cherry');
      // Villa gardens: specimen trees 18 inside the boundary, cypresses for the
      // Mediterranean houses, limes and copper beeches elsewhere, clear of the
      // house, the pool, the court and the drive.
      for (const plan of monarchPlan.villas) {
        const L = plan.villa.lot,
          kind = plan.villa.style === 'mediterranean' || plan.villa.style === 'spanish' ? 'cypress' : 'plane',
          keepOff = [plan.house, plan.garage, ...plan.wings, plan.pool, plan.tennis, plan.terrace].filter(Boolean),
          clear = (x, y) =>
            keepOff.every((k) => x < k.x - 22 || x > k.x + k.w + 22 || y < k.y - 22 || y > k.y + k.h + 22) &&
            Math.hypot(x - plan.gateAt.x, y - plan.gateAt.y) > 60 &&
            (plan.gateAxis === 'y' ? Math.abs(x - plan.gateAt.x) > 26 : Math.abs(y - plan.gateAt.y) > 26);
        const step = kind === 'cypress' ? 34 : 56;
        for (let x = L.x + 20; x < L.x + L.w - 18; x += step)
          for (const y of [L.y + 20, L.y + L.h - 20]) if (clear(x, y)) tree(x, y, kind === 'cypress' ? 9 : 17 + random() * 4, kind);
        for (let y = L.y + 20 + step; y < L.y + L.h - 18 - step; y += step)
          for (const x of [L.x + 20, L.x + L.w - 20]) if (clear(x, y)) tree(x, y, kind === 'cypress' ? 9 : 17 + random() * 4, kind);
      }
      // The east cliff walk and the mole.
      for (let y = -2140; y < -1300; y += 90) tree(9760, y, 16, 'palm');
      for (let x = 8200; x < 10000; x += 160) monarchLamps.push({ x, y: MONARCH_MARINA.mole.y, kind: 'mole' });
      void lamp;
    }
    /* Everything low the island adds to solid(): walls, fences, pools, fountains, parapets. */
    function monarchBlocked(x, y, r = 0) {
      if (!nearMonarchIsle(x, y, r + 20)) return false;
      if (rectListBlocked(monarchSolidList, x, y, r)) return true;
      // Moored hulls (people cannot walk onto them from a pontoon).
      if (y > MONARCH_MARINA.basin.y - 10 && y < -440 && x > 7600)
        for (const h of isleMooredHulls()) {
          const dx = x - h.x,
            dy = y - h.y,
            c = Math.cos(h.a),
            s = Math.sin(h.a),
            u = dx * c + dy * s,
            v = -dx * s + dy * c;
          if (Math.abs(u) < h.hx + r - 2 && Math.abs(v) < h.hy + r - 2) return true;
        }
      return false;
    }
    function monarchSolids() {
      return monarchSolidList;
    }
    /**
     * DISTRICTS (districtAt): the HUD's name for where the player is.
     */
    function monarchDistrictAt(x, y) {
      if (!nearMonarchIsle(x, y, 700)) return null;
      if (!landAt(x, y)) {
        const deck = MONARCH_BRIDGES.find((b) => segmentDistance(x, y, b.a, b.b) <= b.width / 2);
        if (deck) return deck.name;
        const basin = MONARCH_MARINA.basin;
        if (x > basin.x && x < basin.x + basin.w && y > basin.y && y < basin.y + basin.h + 20) return 'MONARCH HARBOUR';
        if (onIslePontoon(x, y)) return 'MONARCH HARBOUR';
        if (x < 5460 && y > -5000) return 'SOVEREIGN SOUND';
        if (y > -990) return 'REGENCY CHANNEL';
        return y < -5060 ? 'MONARCH BEACH' : null;
      }
      if (!onMonarchIsle(x, y)) return null;
      const g = MONARCH_GARDEN;
      if (x > g.x - 10 && x < g.x + g.w + 10 && y > g.y - 10 && y < g.y + g.h + 10) return 'ROYAL BOTANIC GARDEN';
      if (y < -4990) return 'MONARCH BEACH';
      if (y < -3700 || x > 9660) return 'THE CRESCENT';
      if (y > -1256 && x > 7400) return 'MONARCH HARBOUR';
      if (y > -1256) return 'REGENCY GARDENS';
      if (y > -2100) return 'MONARCH HARBOUR';
      if (x < 5700 && y > -3100 && y < -2800) return 'WESTGATE';
      return 'CROWN AVENUE';
    }
    /* The island's shores: sand on Monarch Beach, rocks on the north-east point
       and the east cliffs, a quay everywhere else. */
    function monarchShoreStyle(e) {
      if (e.region !== 'monarch') return null;
      if (e.y < -5080 && e.x > 5700 && e.x < 9640) return 'beach';
      if (e.x > 9620 && e.y < -1150) return 'rock';
      if (e.y > -600 || (e.x > 9890 && e.y > -1170)) return 'rock';
      return 'quay';
    }
    /* Shores that carry no esplanade: the rocks, the mole, the basin's east side. */
    function monarchEsplanadeGivesWay(e) {
      if (e.region !== 'monarch') return false;
      const style = monarchShoreStyle(e);
      if (style === 'rock') return true;
      // The headland's basin side and the yacht club's own terrace.
      if (e.x > 7440 && e.x < 7720 && e.y > -1200 && e.y < -900) return true;
      return false;
    }
    // Gaps in the sea railing where the pontoons meet the quay.
    function monarchRailGaps() {
      const gaps = MONARCH_MARINA.fingers.map((f) => ({ x: f.x + f.w / 2, y: -1210, half: f.w / 2 + 6 }));
      const f = MONARCH_MARINA.fuel;
      gaps.push({ x: f.x + f.w / 2, y: -1210, half: f.w / 2 + 6 });
      return gaps;
    }
    /**
     * THE GROUND SHEET
     * One canvas tile over the island (countyGroundTiles), painted once: lawns,
     * pavements and kerbs, the streets with their markings and zebra crossings,
     * the two roundabouts, forecourts, drives and terraces, the beach, the
     * quays and the esplanade (paintPromenades). The ground shader
     * (surfaces3d.js) adds the grain, slab joints and grass up close.
     */
    const MONARCH_TILE = { x: 5300, y: -5420, w: 5000, h: 5040, pixelsPerUnit: 0.56 };
    const ISLE_PAINT = {
      lawn: '#6c8e55',
      lawnDark: '#5f8049',
      walk: '#c4bda9',
      walkDark: '#aca591',
      kerb: '#dcd6c4',
      road: '#3d4547',
      lane: '#e2ddcb',
      zebra: '#ece8dc',
      gravel: '#c9bb99',
      stone: '#d6cfbc',
      sand: '#e3d3a6',
      sandWet: '#c9b78c',
      deck: '#9d7f5e',
      court: '#3d6f8e',
      courtClay: '#b8603e',
      pool: '#4bb5c9',
    };
    function paintMonarchTile() {
      const t = MONARCH_TILE,
        canvas = document.createElement('canvas');
      canvas.width = Math.round(t.w * t.pixelsPerUnit);
      canvas.height = Math.round(t.h * t.pixelsPerUnit);
      const g = canvas.getContext('2d');
      g.scale(t.pixelsPerUnit, t.pixelsPerUnit);
      g.translate(-t.x, -t.y);
      paintMonarchGround(g, true);
      countyGroundTiles.push({ x: t.x, y: t.y, w: t.w, h: t.h, canvas });
    }
    function isleRegionPath(g) {
      g.beginPath();
      MONARCH_ISLE.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    }
    function paintMonarchGround(g, detail) {
      const P = ISLE_PAINT,
        fill = (x, y, w, h, c) => {
          g.fillStyle = c;
          g.fillRect(x, y, w, h);
        };
      g.save();
      isleRegionPath(g);
      g.fillStyle = P.lawn;
      g.fill();
      g.clip();
      // Mown stripes across the lawns.
      if (detail) {
        g.globalAlpha = 0.07;
        g.fillStyle = '#eef5d8';
        for (let x = MONARCH_TILE.x; x < MONARCH_TILE.x + MONARCH_TILE.w; x += 28) g.fillRect(x, MONARCH_TILE.y, 14, MONARCH_TILE.h);
        g.globalAlpha = 1;
      }
      // Monarch Beach: dry sand from the villas' gardens down to a damp band at the water.
      g.save();
      g.beginPath();
      g.rect(5500, -5400, 4300, 420);
      g.clip();
      g.fillStyle = P.sand;
      g.fillRect(5500, -5400, 4300, 420);
      isleRegionPath(g);
      g.lineJoin = 'round';
      g.strokeStyle = P.sandWet;
      g.lineWidth = 46;
      g.stroke();
      if (detail) {
        let seed = 17;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 2200; i++) {
          g.fillStyle = i % 3 ? '#efe1b9' : '#c7b58b';
          g.fillRect(5620 + rnd() * 4040, -5260 + rnd() * 280, 2 + (i % 4), 1.2);
        }
      }
      g.restore();
      // The east rocks: dark granite shelves along the cliff foot.
      g.save();
      isleRegionPath(g);
      g.strokeStyle = '#7d7a70';
      g.lineWidth = 60;
      g.stroke();
      g.restore();
      // Pavements: every street's reserve, then the carriageways over them.
      for (const s of ISLE_STREETS) {
        const half = isleReserveHalf(s.at, s.vertical);
        if (s.vertical) fill(s.at - half, s.from - half, half * 2, s.to - s.from + half * 2, P.walk);
        else fill(s.from - half, s.at - half, s.to - s.from + half * 2, half * 2, P.walk);
      }
      // Kew Walk: the garden's pedestrian avenue (paved, lined with cherries).
      fill(8000 - 60, -4544, 120, 800, P.stone);
      for (const c of ISLE_CIRCLES) {
        g.fillStyle = P.walk;
        g.beginPath();
        g.arc(c.x, c.y, c.walk, 0, TAU);
        g.fill();
      }
      // The quay and promenade strip along the marina, and Regency Point.
      fill(7440, -1256, 2460, 60, P.stone);
      // Slab joints on the pavements (the 3D ground shader lays its own
      // limestone ashlar along the kerbs, ground-shader3d.js).
      if (detail && !VECTOR_GROUND_MARKINGS) {
        g.strokeStyle = P.walkDark;
        g.lineWidth = 0.8;
        g.globalAlpha = 0.5;
        for (const s of ISLE_STREETS) {
          const half = isleReserveHalf(s.at, s.vertical),
            kerb = isleKerbHalf(s.at, s.vertical);
          for (const side of [-1, 1])
            for (let v = s.from - half; v < s.to + half; v += 16) {
              g.beginPath();
              if (s.vertical) {
                g.moveTo(s.at + side * kerb, v);
                g.lineTo(s.at + side * half, v);
              } else {
                g.moveTo(v, s.at + side * kerb);
                g.lineTo(v, s.at + side * half);
              }
              g.stroke();
            }
        }
        g.globalAlpha = 1;
      }
      // Carriageways.
      const kerbLine = (x0, y0, x1, y1) => {
        g.strokeStyle = P.kerb;
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      };
      for (const s of ISLE_STREETS) {
        const k = isleKerbHalf(s.at, s.vertical);
        if (s.vertical) fill(s.at - k, s.from - k, k * 2, s.to - s.from + k * 2, P.road);
        else fill(s.from - k, s.at - k, s.to - s.from + k * 2, k * 2, P.road);
      }
      for (const c of ISLE_CIRCLES) {
        g.fillStyle = P.road;
        g.beginPath();
        g.arc(c.x, c.y, c.outer, 0, TAU);
        g.fill();
      }
      // The bridge approaches on land.
      for (const b of MONARCH_BRIDGES) strokeRoad(g, [b.a, b.b], b.width - 22, P.road);
      // Medians: planted strips down the boulevards, broken at every junction.
      for (const s of ISLE_STREETS.filter((s) => s.divided)) {
        const junctions = ISLE_STREETS.filter((o) => o.vertical !== s.vertical && s.at >= o.from - 1 && s.at <= o.to + 1).map((o) => o.at);
        const stops = [s.from, ...junctions, s.to].sort((a, b) => a - b);
        for (let i = 1; i < stops.length; i++) {
          const a = stops[i - 1] + 62,
            b = stops[i] - 62;
          if (b - a < 20) continue;
          for (const [color, pad] of [
            [P.kerb, 0],
            [P.lawnDark, 2.5],
          ]) {
            const w = ISLE_MEDIAN - pad * 2;
            if (s.vertical) fill(s.at - w / 2, a + pad, w, b - a - pad * 2, color);
            else fill(a + pad, s.at - w / 2, b - a - pad * 2, w, color);
          }
        }
      }
      // Kerb lines along every carriageway edge.
      for (const s of ISLE_STREETS) {
        const k = isleKerbHalf(s.at, s.vertical);
        for (const side of [-1, 1]) {
          if (s.vertical) kerbLine(s.at + side * k, s.from - k, s.at + side * k, s.to + k);
          else kerbLine(s.from - k, s.at + side * k, s.to + k, s.at + side * k);
        }
      }
      // Re-open the carriageways across each other's kerb lines at the junctions.
      for (const s of ISLE_STREETS)
        for (const o of ISLE_STREETS) {
          if (!s.vertical || o.vertical) continue;
          if (s.at < o.from - 1 || s.at > o.to + 1 || o.at < s.from - 1 || o.at > s.to + 1) continue;
          const kx = isleKerbHalf(s.at, true),
            ky = isleKerbHalf(o.at, false);
          fill(s.at - kx, o.at - ky, kx * 2, ky * 2, P.road);
        }
      // Roundabouts: the central island (a lawn ring round the fountain's basin), kerb rings.
      for (const c of ISLE_CIRCLES) {
        g.fillStyle = P.road;
        g.beginPath();
        g.arc(c.x, c.y, c.outer, 0, TAU);
        g.fill();
        g.fillStyle = P.kerb;
        g.beginPath();
        g.arc(c.x, c.y, c.island + 3, 0, TAU);
        g.fill();
        g.fillStyle = P.lawnDark;
        g.beginPath();
        g.arc(c.x, c.y, c.island, 0, TAU);
        g.fill();
        g.strokeStyle = P.kerb;
        g.lineWidth = 2.2;
        g.beginPath();
        g.arc(c.x, c.y, c.outer, 0, TAU);
        g.stroke();
        // Give-way lines at each entry and a dashed lane line round the ring.
        g.setLineDash([10, 8]);
        g.strokeStyle = P.lane;
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(c.x, c.y, c.outer - 6, 0, TAU);
        g.stroke();
        g.setLineDash([]);
      }
      // Lane markings: a dashed centre line on the plain streets, edge lines on
      // the boulevards; zebras and stop lines at the junctions. With the 3D
      // renderer the ground shader draws these from data (ground-data3d.js
      // monarchRecords), crisp at any zoom, and the tile leaves them out.
      g.fillStyle = P.lane;
      if (!VECTOR_GROUND_MARKINGS) for (const s of ISLE_STREETS)
        for (const piece of isleCarriageways(s)) {
          const [a, b] = piece.points,
            len = Math.hypot(b[0] - a[0], b[1] - a[1]),
            ux = (b[0] - a[0]) / len,
            uy = (b[1] - a[1]) / len;
          for (let d = 20; d < len - 20; d += 36) {
            const x = a[0] + ux * d,
              y = a[1] + uy * d;
            if (isleJunctionNear(x, y, 26) || isleCircleAt(x, y, -20)) continue;
            if (!s.divided) {
              if (s.vertical) g.fillRect(x - 0.9, y, 1.8, 18);
              else g.fillRect(x, y - 0.9, 18, 1.8);
            }
          }
          if (s.divided) {
            // A solid line along the outer edge of each carriageway.
            for (const side of [-1, 1]) {
              const off = side * (ISLE_CARRIAGEWAY / 2 - 4);
              for (let d = 10; d < len - 10; d += 6) {
                const x = a[0] + ux * d,
                  y = a[1] + uy * d;
                if (isleJunctionNear(x, y, 30) || isleCircleAt(x, y, -20)) continue;
                if (s.vertical) g.fillRect(x + off - 0.8, y, 1.6, 6.2);
                else g.fillRect(x, y + off - 0.8, 6.2, 1.6);
              }
            }
          }
        }
      // Zebra crossings on every arm of every junction, just outside the box.
      if (!VECTOR_GROUND_MARKINGS) for (const j of isleJunctions()) {
        for (const arm of j.arms) {
          const ux = Math.cos(arm.a),
            uy = Math.sin(arm.a),
            reach = arm.box + 14,
            width = arm.width,
            cx = j.x + ux * reach,
            cy = j.y + uy * reach;
          g.save();
          g.translate(cx, cy);
          g.rotate(arm.a);
          g.fillStyle = P.zebra;
          for (let k = -width / 2 + 3; k < width / 2 - 3; k += 7) g.fillRect(-9, k, 18, 4);
          // The stop line on the approach lane (right-hand side, coming in).
          g.fillRect(12, 2, 2.4, width / 2 - 4);
          g.restore();
        }
      }
      // Driveways, terraces, pool decks and courts of the villas.
      for (const v of monarchPlan.villas) paintIsleVillaGround(g, v, P, detail);
      // Blocks' forecourts, gardens and courts.
      for (const b of monarchPlan.blocks) paintIsleBlockGround(g, b, P, detail);
      paintIsleGardenGround(g, P, detail);
      paintIsleMarinaGround(g, P, detail);
      // Beach access paths at Monarch Boulevard and St James Street.
      for (const x of [7200, 8800]) fill(x - 18, -5010, 36, 378, P.deck);
      g.restore();
      // The esplanade along the sea walls and the beach boardwalk (streets.js).
      paintPromenades(g);
      drawBridgeGround(g);
    }
    /* Each grid junction: where two streets meet, with its arms (heading out, the
       box's half size along the arm and the arm's carriageway width). */
    let isleJunctionCache = null;
    function isleJunctions() {
      if (isleJunctionCache) return isleJunctionCache;
      const list = [];
      for (const v of ISLE_STREETS.filter((s) => s.vertical))
        for (const h of ISLE_STREETS.filter((s) => !s.vertical)) {
          if (v.at < h.from - 1 || v.at > h.to + 1 || h.at < v.from - 1 || h.at > v.to + 1) continue;
          if (ISLE_CIRCLES.some((c) => c.x === v.at && c.y === h.at)) continue;
          const arms = [];
          if (h.at > v.from + 1) arms.push({ a: -Math.PI / 2, box: isleKerbHalf(h.at, false), width: isleKerbHalf(v.at, true) * 2 });
          if (h.at < v.to - 1) arms.push({ a: Math.PI / 2, box: isleKerbHalf(h.at, false), width: isleKerbHalf(v.at, true) * 2 });
          if (v.at > h.from + 1) arms.push({ a: Math.PI, box: isleKerbHalf(v.at, true), width: isleKerbHalf(h.at, false) * 2 });
          if (v.at < h.to - 1) arms.push({ a: 0, box: isleKerbHalf(v.at, true), width: isleKerbHalf(h.at, false) * 2 });
          list.push({ x: v.at, y: h.at, v, h, arms });
        }
      return (isleJunctionCache = list);
    }
    function isleJunctionNear(x, y, pad = 0) {
      for (const j of isleJunctions())
        if (Math.abs(x - j.x) < isleKerbHalf(j.x, true) + pad && Math.abs(y - j.y) < isleKerbHalf(j.y, false) + pad) return j;
      return null;
    }
    function paintIsleVillaGround(g, plan, P, detail) {
      const v = plan.villa,
        L = v.lot,
        fill = (r, c) => {
          g.fillStyle = c;
          g.fillRect(r.x, r.y, r.w, r.h);
        };
      // A deeper, mown lawn inside the wall.
      fill({ x: L.x + 4, y: L.y + 4, w: L.w - 8, h: L.h - 8 }, '#648a4f');
      if (detail) {
        g.globalAlpha = 0.1;
        g.fillStyle = '#f2f8dc';
        for (let x = L.x + 8; x < L.x + L.w - 8; x += 20) g.fillRect(x, L.y + 4, 10, L.h - 8);
        g.globalAlpha = 1;
      }
      // The drive: from the gate to the forecourt before the house, gravel or stone.
      const surface = v.style === 'modern' || v.style === 'artdeco' ? '#bfbab0' : P.gravel,
        H = plan.house,
        gate = plan.gateAt;
      g.strokeStyle = surface;
      g.lineWidth = 30;
      g.lineCap = 'round';
      g.beginPath();
      if (plan.gateAxis === 'y') {
        const front = v.gate === 'south' ? H.y + H.h + 36 : H.y - 36;
        g.moveTo(gate.x, gate.y);
        g.lineTo(gate.x, front);
        g.lineTo(H.x + H.w / 2, front);
      } else {
        const front = H.x - 36;
        g.moveTo(gate.x, gate.y);
        g.lineTo(front, gate.y);
        g.lineTo(front, H.y + H.h / 2);
      }
      g.stroke();
      // A turning circle in front of the door.
      g.fillStyle = surface;
      g.beginPath();
      if (plan.gateAxis === 'y') g.arc(H.x + H.w / 2, v.gate === 'south' ? H.y + H.h + 40 : H.y - 40, 40, 0, TAU);
      else g.arc(H.x - 40, H.y + H.h / 2, 40, 0, TAU);
      g.fill();
      fill({ x: plan.garage.x - 6, y: plan.garage.y + plan.garage.h, w: plan.garage.w + 12, h: 40 }, surface);
      // The terrace and the pool deck.
      if (plan.terrace) fill(plan.terrace, P.stone);
      if (plan.pool) {
        const p = plan.pool;
        fill({ x: p.x - 18, y: p.y - 18, w: p.w + 36, h: p.h + 36 }, '#e4dece');
        fill(p, P.pool);
      }
      if (plan.tennis) {
        const t = plan.tennis;
        fill({ x: t.x - 10, y: t.y - 10, w: t.w + 20, h: t.h + 20 }, '#4f7a5f');
        fill(t, v.style === 'mediterranean' || v.style === 'spanish' ? P.courtClay : P.court);
        g.strokeStyle = '#f2f2ec';
        g.lineWidth = 1.2;
        g.strokeRect(t.x + 6, t.y + 6, t.w - 12, t.h - 12);
        g.beginPath();
        g.moveTo(t.x + 6, t.y + t.h / 2);
        g.lineTo(t.x + t.w - 6, t.y + t.h / 2);
        g.moveTo(t.x + t.w / 2, t.y + 40);
        g.lineTo(t.x + t.w / 2, t.y + t.h - 40);
        g.stroke();
      }
    }
    function paintIsleBlockGround(g, plan, P, detail) {
      const B = plan.block,
        fill = (r, c) => r && ((g.fillStyle = c), g.fillRect(r.x, r.y, r.w, r.h));
      // Most blocks: a paved forecourt along the shops, a garden court behind.
      fill({ x: B.x, y: B.y, w: B.w, h: B.h }, '#6a8b52');
      // MONARCH MOTORS' forecourt, lane and bays (dealership.js).
      if (plan.use === 'motors') paintDealershipGround(g, plan, P, detail);
      if (['arcade', 'provisions', 'harbourfront', 'chandlery', 'towerSovereign', 'towerMonarch'].includes(plan.use))
        fill({ x: B.x, y: B.y + B.h - 20, w: B.w, h: 20 }, P.walk);
      if (plan.use === 'towerSovereign' || plan.use === 'towerMonarch') {
        // The tower's plaza: stone paving in a radiating pattern.
        const t = plan.tower,
          cx = t.x + t.w / 2,
          cy = t.y + t.h / 2;
        fill({ x: B.x + 20, y: B.y + 20, w: B.w - 40, h: B.h - 180 }, P.stone);
        if (detail) {
          g.strokeStyle = '#bdb4a0';
          g.lineWidth = 1;
          for (let r = 30; r < 300; r += 22) {
            g.beginPath();
            g.arc(cx, cy, r, 0, TAU);
            g.stroke();
          }
        }
        fill({ x: t.x - 24, y: t.y + t.h, w: t.w + 48, h: 60 }, '#bfb49c');
        for (const l of plan.lawns || []) {
          fill({ x: l.x - 3, y: l.y - 3, w: l.w + 6, h: l.h + 6 }, '#8f8a78');
          fill(l, '#5f9148');
          if (detail) {
            // Mown stripes.
            g.fillStyle = 'rgba(255,255,255,0.05)';
            for (let x = l.x; x < l.x + l.w; x += 24) g.fillRect(x, l.y, 12, l.h);
          }
        }
        if (plan.reflect) {
          const R = plan.reflect;
          fill({ x: R.x - 8, y: R.y - 8, w: R.w + 16, h: R.h + 16 }, '#d8d0bc');
          fill(R, '#2f7a8e');
        }
        if (plan.sculpture) {
          g.fillStyle = '#b8ae98';
          g.beginPath();
          g.arc(plan.sculpture.x, plan.sculpture.y, 26, 0, TAU);
          g.fill();
        }
      }
      if (plan.courts)
        for (const t of plan.courts) {
          fill({ x: t.x - 10, y: t.y - 10, w: t.w + 20, h: t.h + 20 }, '#4f7a5f');
          fill(t, P.courtClay);
          g.strokeStyle = '#f2f2ec';
          g.lineWidth = 1.2;
          g.strokeRect(t.x + 6, t.y + 6, t.w - 12, t.h - 12);
          g.beginPath();
          g.moveTo(t.x + 6, t.y + t.h / 2);
          g.lineTo(t.x + t.w - 6, t.y + t.h / 2);
          g.stroke();
        }
      if (plan.pool) {
        fill({ x: plan.pool.x - 20, y: plan.pool.y - 20, w: plan.pool.w + 40, h: plan.pool.h + 40 }, '#e4dece');
        fill(plan.pool, P.pool);
      }
      if (plan.green) {
        // The putting green: fine, darker turf with a fringe, flags drawn in 3D.
        const G = plan.green;
        g.fillStyle = '#4f8a45';
        g.beginPath();
        g.ellipse(G.x + G.w / 2, G.y + G.h / 2, G.w / 2, G.h / 2, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#5e9a4f';
        g.beginPath();
        g.ellipse(G.x + G.w / 2, G.y + G.h / 2, G.w / 2 - 12, G.h / 2 - 12, 0, 0, TAU);
        g.fill();
        // Bunkers.
        g.fillStyle = '#e4d6ae';
        g.beginPath();
        g.ellipse(G.x + 26, G.y + G.h - 30, 30, 16, 0.3, 0, TAU);
        g.fill();
      }
      if (plan.field) {
        const F = plan.field;
        fill(F, '#5b8d47');
        g.strokeStyle = '#eef2e6';
        g.lineWidth = 1.4;
        g.strokeRect(F.x + 10, F.y + 10, F.w - 20, F.h - 20);
        g.beginPath();
        g.moveTo(F.x + F.w / 2, F.y + 10);
        g.lineTo(F.x + F.w / 2, F.y + F.h - 10);
        g.stroke();
        g.beginPath();
        g.arc(F.x + F.w / 2, F.y + F.h / 2, 26, 0, TAU);
        g.stroke();
      }
      if (plan.canopy) fill({ x: plan.canopy.x - 10, y: plan.canopy.y - 20, w: plan.canopy.w + 20, h: plan.canopy.h + 40 }, '#5b6264');
      if (plan.forecourt) fill({ x: plan.forecourt.x - 10, y: plan.forecourt.y, w: plan.forecourt.w + 20, h: plan.forecourt.h }, '#d8d2c4');
      if (plan.courtyard) {
        fill(plan.courtyard, '#d3c9b2');
        g.fillStyle = '#6c8e55';
        g.fillRect(plan.courtyard.x + 30, plan.courtyard.y + 30, plan.courtyard.w - 60, plan.courtyard.h - 60);
      }
      if (plan.chapel) fill({ x: plan.chapel.x - 40, y: plan.chapel.y + plan.chapel.h, w: plan.chapel.w + 80, h: B.y + B.h - 150 - plan.chapel.y - plan.chapel.h }, '#6f9258');
      if (plan.policeYard) fill(plan.policeYard, '#5b6264');
      // A path to every door from the pavement.
      for (const b of plan.parts) fill({ x: b.x + b.w / 2 - 10, y: b.y + b.h, w: 20, h: Math.max(0, B.y + B.h - b.y - b.h) }, P.walk);
    }
    function paintIsleGardenGround(g, P, detail) {
      const G = MONARCH_GARDEN,
        H = G.house,
        B = G.beds,
        rect = (r, c) => {
          g.fillStyle = c;
          g.fillRect(r.x, r.y, r.w, r.h);
        };
      // Lawns in two greens, mown in stripes.
      g.fillStyle = '#5f8a4a';
      g.fillRect(G.x, G.y, G.w, G.h);
      if (detail) {
        g.globalAlpha = 0.1;
        g.fillStyle = '#eef6d4';
        for (let y = G.y; y < G.y + G.h; y += 24) g.fillRect(G.x, y, G.w, 12);
        g.globalAlpha = 1;
      }
      // Gravel walks: the Broad Walk on the axis, the terrace walk, the north walk
      // and the side walks to the east and west gates.
      g.fillStyle = P.gravel;
      g.fillRect(8000 - 24, H.y + H.d / 2 + 30, 48, G.y + G.h - (H.y + H.d / 2 + 30));
      g.fillRect(8000 - 24, G.y, 48, H.y - H.d / 2 - 30 - G.y);
      g.fillRect(G.x, -4054, G.w, 28);
      g.fillRect(G.x, -4362, G.w, 24);
      g.fillRect(7360, -4362, 24, 300);
      g.fillRect(8616, -4362, 24, 300);
      // The Palm House terrace in York stone.
      g.fillStyle = P.stone;
      g.fillRect(H.x - H.w / 2 - 30, H.y - H.d / 2 - 30, H.w + 60, H.d + 60);
      if (detail) {
        g.strokeStyle = '#c1b8a2';
        g.lineWidth = 1;
        for (let x = H.x - H.w / 2 - 30; x < H.x + H.w / 2 + 30; x += 12) {
          g.beginPath();
          g.moveTo(x, H.y - H.d / 2 - 30);
          g.lineTo(x, H.y + H.d / 2 + 30);
          g.stroke();
        }
      }
      // The lily pond: a stone ring walk, a coping and dark water.
      const pond = G.pond;
      g.fillStyle = P.gravel;
      g.beginPath();
      g.ellipse(pond.x, pond.y, pond.rx + 40, pond.ry + 40, 0, 0, TAU);
      g.fill();
      g.fillStyle = P.stone;
      g.beginPath();
      g.ellipse(pond.x, pond.y, pond.rx + 8, pond.ry + 8, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#23504a';
      g.beginPath();
      g.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, TAU);
      g.fill();
      // Parterres: box-edged beds of bedding colour in a formal pattern.
      for (const bed of [B.parterreWest, B.parterreEast]) {
        rect(bed, '#3f6a3a');
        const cells = 3;
        for (let k = 0; k < cells; k++) {
          const w = (bed.w - 20) / cells,
            x = bed.x + 10 + k * w;
          g.fillStyle = k % 2 ? '#b0506a' : '#d8a23a';
          g.fillRect(x + 6, bed.y + 10, w - 12, bed.h - 20);
          g.fillStyle = '#3f6a3a';
          g.fillRect(x + w / 2 - 3, bed.y + 10, 6, bed.h - 20);
          g.fillRect(x + 6, bed.y + bed.h / 2 - 3, w - 12, 6);
        }
      }
      // The arid bed (sand and gravel), the fern gully (dark leaf litter), the
      // bamboo grove and the Socotra bed (red earth).
      rect(B.arid, '#cbb488');
      rect(B.ferns, '#34502e');
      rect(B.bamboo, '#4a6a38');
      rect(B.socotra, '#a8704a');
      if (detail) {
        let seed = 5;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 260; i++) {
          g.fillStyle = i % 2 ? '#b39a6c' : '#d9c8a0';
          g.fillRect(B.arid.x + rnd() * B.arid.w, B.arid.y + rnd() * B.arid.h, 3, 2);
          g.fillStyle = i % 2 ? '#8e5a3a' : '#bf8a60';
          g.fillRect(B.socotra.x + rnd() * B.socotra.w, B.socotra.y + rnd() * B.socotra.h, 3, 2);
        }
      }
    }
    function paintIsleMarinaGround(g, P, detail) {
      const m = MONARCH_MARINA;
      // The mole's walk: stone flags on top of the armour.
      g.fillStyle = P.stone;
      g.fillRect(m.mole.x0, m.mole.y - m.mole.half, m.mole.x1 - m.mole.x0, m.mole.half * 2);
      // Regency Point: the club's terrace and the harbour master's apron.
      g.fillStyle = P.deck;
      g.fillRect(m.club.x - 10, m.club.y + m.club.h, m.club.w + 20, 70);
      g.fillStyle = P.stone;
      g.beginPath();
      g.arc(m.harbourMaster.x, m.harbourMaster.y, m.harbourMaster.r + 26, 0, TAU);
      g.fill();
      // The east quay car park.
      g.fillStyle = '#50585a';
      g.fillRect(9700, -1190, 190, 330);
      if (detail) {
        g.fillStyle = '#d6d3c4';
        for (let y = -1180; y < -870; y += 24) {
          g.fillRect(9706, y, 60, 1.6);
          g.fillRect(9824, y, 60, 1.6);
        }
      }
    }
    /* The minimap and the big map: the island's static layer (paintMapBase). */
    function paintMonarchMap(g, big) {
      g.save();
      isleRegionPath(g);
      g.clip();
      g.fillStyle = '#d9cba0';
      g.fillRect(5500, -5400, 4300, 420);
      g.fillStyle = '#9aa596';
      for (const s of ISLE_STREETS) {
        const half = isleReserveHalf(s.at, s.vertical);
        if (s.vertical) g.fillRect(s.at - half, s.from - half, half * 2, s.to - s.from + half * 2);
        else g.fillRect(s.from - half, s.at - half, s.to - s.from + half * 2, half * 2);
      }
      const G = MONARCH_GARDEN;
      g.fillStyle = '#5f8a52';
      g.fillRect(G.x, G.y, G.w, G.h);
      g.fillStyle = '#9fc0c8';
      g.beginPath();
      g.ellipse(G.pond.x, G.pond.y, G.pond.rx, G.pond.ry, 0, 0, TAU);
      g.fill();
      for (const v of monarchPlan.villas) {
        g.fillStyle = '#6f9860';
        g.fillRect(v.villa.lot.x, v.villa.lot.y, v.villa.lot.w, v.villa.lot.h);
        if (v.pool) {
          g.fillStyle = '#5cc1d4';
          g.fillRect(v.pool.x, v.pool.y, v.pool.w, v.pool.h);
        }
      }
      g.restore();
      g.fillStyle = '#c9c2ae';
      for (const f of MONARCH_MARINA.fingers) g.fillRect(f.x, f.y, f.w, f.h);
      for (const b of monarchBerths()) {
        g.fillStyle = b.design.hull;
        g.fillRect(b.x - b.beam / 2, b.y - b.len / 2, b.beam, b.len);
      }
      for (const s of MONARCH_SUPERYACHTS) {
        g.save();
        g.translate(s.x, s.y);
        g.rotate(s.a);
        g.fillStyle = s.hull;
        g.beginPath();
        g.moveTo(-s.len / 2, -s.beam / 2);
        g.lineTo(s.len * 0.25, -s.beam / 2);
        g.quadraticCurveTo(s.len * 0.45, -s.beam * 0.3, s.len / 2, 0);
        g.quadraticCurveTo(s.len * 0.45, s.beam * 0.3, s.len * 0.25, s.beam / 2);
        g.lineTo(-s.len / 2, s.beam / 2);
        g.fill();
        g.restore();
      }
      if (big) {
        g.fillStyle = '#e7d9a8';
        g.font = 'bold 60px monospace';
        g.textAlign = 'center';
        g.fillText('✿', G.x + G.w / 2, G.y + G.h / 2 + 20);
      }
    }
    // Big-map labels (drawMap).
    const MONARCH_MAP_LABELS = [
      // Spread out: at the whole-county zoom the island is ~120 px across.
      ['M O N A R C H  I S L E', 7800, -3200],
      ['CROWN AVENUE', 6600, -2500],
      ['ROYAL BOTANIC GARDEN', 8000, -4200],
      ['MONARCH HARBOUR', 8800, -880],
      ['MONARCH BEACH', 7700, -5130],
      // (Sovereign Sound is named in the HUD only: on the map it is narrower
      // than its name and would run into North Point's labels.)
      ['R E G E N C Y  C H A N N E L', 7600, -250],
    ];
    /* After the city's rooftop pads are chosen: the towers' roofs take a helicopter. */
    function addMonarchHelipads() {
      for (const t of MONARCH_TOWERS) {
        if (!t.helipad || !t.building) continue;
        const b = t.building;
        b.helipad = { x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.min(46, Math.min(b.w, b.h) / 2 - 12) };
        roofHelipads.push({ ...b.helipad, z: b.height, building: b });
      }
    }
    /* The plan as data for the layout audit and DeadEndCity.monarch(). */
    function monarchLayout() {
      return {
        polygon: MONARCH_ISLE.polygon,
        grid: { cols: ISLE_COLS, rows: ISLE_ROWS, block: ISLE_BLOCK, street: ISLE_STREET, walk: ISLE_WALK },
        streets: ISLE_STREETS.map((s) => ({ name: s.name, vertical: s.vertical, at: s.at, from: s.from, to: s.to, divided: !!s.divided })),
        circles: ISLE_CIRCLES,
        villas: monarchPlan.villas.map((p) => ({ name: p.villa.name, style: p.villa.style, lot: p.villa.lot, house: p.house, storeys: p.storeys, pool: p.pool, tennis: p.tennis || null, gate: p.gateAt })),
        towers: MONARCH_TOWERS.map((t) => ({ name: t.name, x: t.x, y: t.y, w: t.w, h: t.h, height: t.building ? t.building.height : 0, metres: Math.round(worldMeters(t.building ? t.building.height + t.crown : 0)) })),
        businesses: monarchPlan.shops.map((s) => ({ name: s.name, trade: s.trade, door: s.door })),
        marina: { basin: MONARCH_MARINA.basin, fingers: MONARCH_MARINA.fingers, berths: monarchBerths().length, superyachts: MONARCH_SUPERYACHTS.map((s) => s.name) },
        garden: { x: MONARCH_GARDEN.x, y: MONARCH_GARDEN.y, w: MONARCH_GARDEN.w, h: MONARCH_GARDEN.h, house: MONARCH_GARDEN.house },
        payphones: MONARCH_PAYPHONES,
        solids: monarchSolidList.length,
        trees: monarchTrees.length,
        lamps: monarchLamps.length,
      };
    }
    // END SUBSYSTEM: src/monarch.js
