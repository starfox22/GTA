    // Monarch Isle outline and coast (MONARCH_ISLE, onMonarchIsle), marina berths and superyachts.
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
