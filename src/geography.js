    // BEGIN SUBSYSTEM: src/geography.js — Coastlines and land regions
    /**
     * Coastlines and land regions
     * Source: src/geography.js
     * Scope: shared game closure.
     * Shared land polygons, bridges, roads, shoreline tests and district lookup.
     */
    /* One coastline model drives terrain, water, the map and all vehicle footprints. */
    /* A Catmull-Rom curve through `points` (both ends kept), `steps` pieces per
       span, for coasts that should read as a sweep rather than a polygon. */
    function smoothShoreline(points, steps) {
      const out = [];
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)],
          p1 = points[i],
          p2 = points[i + 1],
          p3 = points[Math.min(points.length - 1, i + 2)];
        for (let k = 0; k < steps; k++) {
          const t = k / steps,
            t2 = t * t,
            t3 = t2 * t;
          out.push(
            [0, 1].map((c) =>
              Math.round(
                0.5 *
                  (2 * p1[c] +
                    (p2[c] - p0[c]) * t +
                    (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
                    (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3),
              ),
            ),
          );
        }
      }
      out.push(points.at(-1).slice());
      return out;
    }
    const LAND_REGIONS = [
      {
        id: 'northbank',
        name: 'NORTHBANK ISLAND',
        color: '#5b696b',
        // Reclaimed waterfront: the coast runs outside every block of the grid,
        // so the whole street plan is built city rather than stopping short at a
        // ragged shore. The northern lobe (negative y) is the reclamation: a
        // marina basin cut into the north-west shore, the cruise terminal quay
        // along the north coast, and the tower district on the north-east point.
        polygon: [
          [240, -3980],
          [470, -4102],
          [672, -4128],
          [672, -3320],
          [1528, -3300],
          [1528, -4126],
          [1730, -4166],
          [2140, -4192],
          [2760, -4188],
          [3062, -4128],
          [3268, -3960],
          [3372, -3600],
          [3352, -2980],
          [3396, -2300],
          [3360, -1620],
          [3402, -980],
          [3366, -380],
          [3398, 60],
          [3390, 680],
          [3420, 1040],
          [3420, 2300],
          [3350, 2730],
          [3420, 3300],
          [3420, 4400],
          // South shore: Battery Park, a lawn and the esplanade between Marina Rd
          // and a straight sea wall (see SOUTH_PROMENADE). Southport Beach used
          // to bulge out here; the city's public beach is on Palm Keys now.
          [3300, 5020],
          [3150, 5460],
          [2600, 5476],
          [2000, 5470],
          [1800, 5460],
          [1380, 5030],
          [980, 4630],
          [430, 4270],
          [120, 3760],
          // West shore: one straight reclaimed sea wall. The strip between it and
          // the first row of blocks (x 40..217) carries the esplanade on the sea
          // side and the Shore Line viaduct on the land side. The old ragged
          // shore bit into block (0, 3), leaving a building standing in the sea.
          [52, 3420],
          [40, 3000],
          [44, 2200],
          [40, 1200],
          [46, 0],
          [40, -1200],
          [44, -2400],
          [40, -3400],
          [70, -3700],
          [126, -3862],
        ],
      },
      {
        // The tropical island west of Northbank across Palm Sound (about 1200
        // units of water). It was the old eastern island, reflected east-west
        // when it moved: Ocean Drive and its palm strand face the open sea on
        // the west, the bay side with its jetties and the two bridge landings
        // faces the city. Its south shore is the public beach (BEACH) with the
        // reserved beach-club plot (BEACH_CLUB_PLOT) at its west end.
        id: 'palmkeys',
        name: 'PALM KEYS',
        color: '#93a897',
        polygon: [
          [-2464, 150],
          [-1884, 50],
          [-1224, 180],
          [-1144, 540],
          [-1144, 2020],
          [-1204, 2820],
          [-1144, 3730],
          [-1164, 4430],
          [-1150, 4900],
          [-1190, 5250],
          // The public beach: Southport Beach's strand, moved here whole. One
          // smooth curve shaped by the swell; the surf, the wet sand and the
          // swash all follow it (beach.js finds its end points by value).
          ...smoothShoreline(
            [
              [-1260, 5420],
              [-1520, 5672],
              [-1990, 5806],
              [-2400, 5758],
              [-2574, 5572],
              [-2610, 5430],
            ],
            9,
          ),
          // The beach-club plot's point, then Ocean Drive's west strand.
          [-2660, 5670],
          [-2860, 5710],
          [-3100, 5670],
          [-3135, 5420],
          [-3095, 5200],
          [-2900, 5000],
          [-2790, 4600],
          [-2704, 4090],
          [-2814, 3290],
          [-2724, 2590],
          [-2804, 1690],
          [-2724, 780],
        ],
      },
      {
        // The amusement island north of the reclamation across North Sound,
        // reached by the Sunset Pier Bridge from the north end of Riverbank Dr.
        // The Sunset Pier rides stand in its east half; THEME_PARK_RESERVE (the
        // west half) is kept clear for the big attractions.
        id: 'sunsetisle',
        name: 'SUNSET PIER',
        color: '#8e9b84',
        polygon: smoothShoreline(
          [
            [2300, -5700],
            [1920, -5820],
            [1830, -6400],
            [1930, -6960],
            [2500, -7090],
            [3300, -7090],
            [3990, -7050],
            [4260, -6730],
            [4260, -6080],
            [4010, -5760],
            [3450, -5680],
            [2900, -5680],
            [2300, -5700],
          ],
          4,
        ).slice(0, -1),
      },
      {
        id: 'airport',
        name: 'SOUTHPORT AIRPORT',
        color: '#77847e',
        polygon: [
          [170, 4100],
          [620, 4100],
          [1240, 4500],
          [1430, 4830],
          [1390, 5120],
          [1210, 5500],
          [570, 5570],
          [130, 5320],
          [80, 4750],
        ],
      },
    ];
    // Ocean Drive's strand: the open-sea (west) shore of Palm Keys, sand from the
    // north tip down to the beach-club point (painted by paintDistrictGround;
    // shoreStyle reads it as beach).
    const KEYS_WEST_STRAND = [
      [-2464, 150],
      [-2724, 780],
      [-2804, 1690],
      [-2724, 2590],
      [-2814, 3290],
      [-2704, 4090],
      [-2790, 4600],
      [-2900, 5000],
    ];
    // Palm Keys is everything west of the middle of Palm Sound.
    const PALM_SOUND_X = -500;
    function onPalmKeys(x) {
      return x < PALM_SOUND_X;
    }
    // Battery Park, the lawn on Northbank's south shore between the Marina Rd
    // pavement and the esplanade (where Southport Beach used to be).
    const SOUTH_PROMENADE = { x: 1770, y: 5306, w: 1350, h: 70 };
    const COUNTY_LAKES = [
      {
        id: 'lake',
        name: 'CLEARWATER RESERVOIR',
        lake: true,
        polygon: [
          [8840, 1780],
          [8930, 1600],
          [9160, 1580],
          [9330, 1750],
          [9470, 2030],
          [9310, 2290],
          [9020, 2210],
          [8870, 2030],
        ],
      },
    ];
    // The West Quay alignment (x = 128) is the railway's corridor down the west
    // shore (south of y -2944), not a street: the Shore Line viaduct runs above
    // the strip between the sea wall and the first blocks, inland of the esplanade.
    const RAIL_CORRIDOR_X = 128;
    /**
     * PALM KEYS BEACH
     * The city's public strand, on the south shore of Palm Keys between the
     * beach-club plot (x -2670) and the south-east sea wall (x -1285): sand from
     * the Marina Rd kerb (y 5306) down to the water, 250..500 units deep and
     * 1400 long, facing the open sea. It was Southport Beach on Northbank's
     * south shore and moved here whole (every coordinate x - 4410). It is
     * reserved ground: no street or block is laid on it (cityStreets,
     * validCityBlock), the esplanade gives way to the boardwalk along its top
     * edge, and its shore reads as 'beach' so the water meets the sand rather
     * than a quay wall. Ocean Drive's strand on the island's west shore is sand
     * too (shoreStyle); everywhere else someone on foot meets a quay. The
     * polygon runs out past the waterline and `onBeach` clips it to land. Beach
     * life, the props and the pier are built on this data by beach.js and
     * beach3d.js.
     *
     * The fishing pier runs out from the lower sand into the swim zone: a
     * walkable deck (part of `groundAt`, like the docks) that is a wall to
     * anyone on foot and a roof to swimmers, who pass under it between the piles.
     */
    const BEACH = {
      name: 'PALM KEYS BEACH',
      polygon: [
        [-2668, 5306],
        [-1285, 5306],
        [-1285, 5960],
        [-2668, 5960],
      ],
      // The promenade along the top of the sand: a 40-unit boardwalk just south
      // of the Marina Rd pavement, from the club plot to the sea wall.
      boardwalk: { x0: -2650, x1: -1300, y: 5326, width: 40 },
      // Stem from the lower sand out past the breakers, and the T of the head.
      pier: [
        { x: -1727, y: 5688, w: 34, h: 300 },
        { x: -1774, y: 5950, w: 128, h: 40 },
      ],
    };
    /**
     * RESERVED PLOTS (kept clear for later builds; nothing is generated on them)
     * - BEACH_CLUB_PLOT: 400 x 300 on the beachfront at the west end of Palm Keys
     *   Beach, with the sand on its east side and the sea on its south and west.
     *   Road access from Marina Rd (y 5248) along its north edge and from Ocean
     *   Dr (x -2432) at its north-east corner.
     * - THEME_PARK_RESERVE: 1400 x 900 in the west half of the Sunset Pier island
     *   for the big attractions (a large coaster, a giant wheel). The island road
     *   from the bridge runs along its east edge; the Sunset Pier rides stand
     *   east of it.
     */
    const BEACH_CLUB_PLOT = { x: -3070, y: 5306, w: 400, h: 300 },
      THEME_PARK_RESERVE = { x: 1980, y: -6960, w: 1400, h: 900 };
    function inReservedPlot(x, y, margin = 0) {
      return [BEACH_CLUB_PLOT, THEME_PARK_RESERVE].some(
        (p) => x > p.x - margin && x < p.x + p.w + margin && y > p.y - margin && y < p.y + p.h + margin,
      );
    }
    function onBeachPier(x, y, r = 0) {
      return BEACH.pier.some((d) => x - r >= d.x && x + r <= d.x + d.w && y - r >= d.y && y + r <= d.y + d.h);
    }
    function onBeach(x, y) {
      return regionContains(BEACH, x, y) && landAt(x, y);
    }
    // (An 'OCEAN DRIVE' slip curve from (5248, 4384) to (4980, 4736) used to cut
    // the corner of Ocean Dr and Stadium Way, painted diagonally across both
    // streets and the corner block. The grid junction serves that corner.)
    const BOULEVARDS = [
      {
        name: 'AIRPORT WAY',
        width: 66,
        // Carries straight on from the west end of Battery St (row 4224 stops at
        // the airport fence, x 1408), sharing a point with it so the route graph
        // joins them. It used to start at Commons St and run diagonally across
        // the last 260 units of Battery St: two carriageways painted over each
        // other.
        points: [
          [1440, 4224],
          [1240, 4290],
          [1000, 4560],
          [1220, 4720],
          [1220, 5200],
        ],
      },
    ];
    // (A 44-wide 'NORTHBANK QUAY' lane used to run at y = 190 from x 640 to 2176,
    // left over from when that was the north shore. Since the reclamation it ran
    // alongside North Shore Rd, eighteen units from its kerb, through the kerb
    // trees: two parallel roads where the street plan has one.)
    BOULEVARDS.push(
      {
        name: 'GOLDEN TIDE APPROACH',
        width: 44,
        points: [
          [-2183, 3060],
          [-2183, 3200],
        ],
      },
    );
    const AIRPORT = {
      x: 870,
      y: 4800,
      w: 280,
      h: 170,
      door: {
        x: 1180,
        y: 4890,
      },
      runway: {
        x: 300,
        y: 4280,
        w: 236,
        h: 1010,
      },
      hangar: {
        x: 760,
        y: 5200,
        w: 250,
        h: 150,
      },
      cargo: {
        x: 1040,
        y: 5180,
      },
    };
    // Ground footprints shared by airport scenery, foot collision, traffic spawning and ballistics.
    const AIRPORT_SCENERY_SOLIDS = [
      {
        x: 780.5,
        y: 5065.5,
        w: 19,
        h: 19,
        height: 126,
        kind: 'tower',
      },
      {
        x: 3519,
        y: 8969,
        w: 22,
        h: 22,
        height: 152,
        kind: 'tower',
      },
      ...[
        [680, 4800, true, 0.9],
        [680, 5110, true, 1],
        [1000, 5400, false, 0.65],
        [4100, 9160, true, 1.8],
        [4460, 9160, true, 1.6],
        [5710, 9300, false, 1.4],
      ].map(([x, y, vertical, size]) => {
        const w = (vertical ? 18 : 126) * size,
          h = (vertical ? 126 : 18) * size;
        return {
          x: x - w / 2,
          y: y - h / 2,
          w,
          h,
          height: 24 * size,
          kind: 'parked aircraft',
        };
      }),
    ];
    function airportSceneryBlocked(x, y, r = 0) {
      return AIRPORT_SCENERY_SOLIDS.some(
        (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h,
      );
    }
    // Block (-4, 4) of Palm Keys, on Flamingo Ave with the bay and the city
    // skyline to the east.
    const ROOFTOP = {
      id: 'skyline',
      name: 'THE BLUE HOUR',
      x: -1844,
      y: 2250,
      w: 360,
      h: 350,
      height: 135,
      door: {
        x: -1664,
        y: 2622,
      },
      lift: {
        x: -1808,
        y: 2556,
      },
      bar: {
        x: -1594,
        y: 2317,
      },
      contact: {
        x: -1526,
        y: 2543,
      },
    };
    function pointInPolygon(x, y, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, ay] = poly[i],
          [bx, by] = poly[j];
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      }
      return inside;
    }
    function regionContains(r, x, y) {
      const b =
        r.bounds ||
        (r.bounds = {
          minx: Math.min(...r.polygon.map((p) => p[0])),
          maxx: Math.max(...r.polygon.map((p) => p[0])),
          miny: Math.min(...r.polygon.map((p) => p[1])),
          maxy: Math.max(...r.polygon.map((p) => p[1])),
        });
      return (
        x >= b.minx && x <= b.maxx && y >= b.miny && y <= b.maxy && pointInPolygon(x, y, r.polygon)
      );
    }
    const SUNSET_ISLE = LAND_REGIONS.find((r) => r.id === 'sunsetisle');
    function onSunsetIsle(x, y) {
      return regionContains(SUNSET_ISLE, x, y);
    }
    function landAtExact(x, y) {
      return (
        !COUNTY_LAKES.some((r) => regionContains(r, x, y)) &&
        LAND_REGIONS.some((r) => regionContains(r, x, y))
      );
    }
    /**
     * LAND CELL CACHE
     * landAt() is asked hundreds of thousands of times a second (four hull corners
     * per moving car per 1/120 s physics step, every footstep through solid(), the
     * sinking check), and the polygon test was over half of all simulation time.
     * The map is cut into LAND_CELL squares. Cells no coastline or lake edge passes
     * through are uniformly land or water, so their answer is computed once (at the
     * centre, on first use) and remembered; only cells an edge crosses still run the
     * exact polygon test. The coast never changes at runtime, but county.js appends
     * its regions after this file, so the grid is rebuilt if the region count moves.
     */
    const LAND_CELL = 16;
    const landCells = { regions: -1, x0: 0, y0: 0, cols: 0, rows: 0, state: null };
    // state per cell: 0 not yet known, 1 land, 2 water, 3 an edge crosses it (exact test).
    function buildLandCells() {
      const polygons = [...LAND_REGIONS, ...COUNTY_LAKES].map((r) => r.polygon);
      let minx = Infinity,
        miny = Infinity,
        maxx = -Infinity,
        maxy = -Infinity;
      for (const poly of polygons)
        for (const [x, y] of poly) {
          minx = Math.min(minx, x);
          miny = Math.min(miny, y);
          maxx = Math.max(maxx, x);
          maxy = Math.max(maxy, y);
        }
      const c = landCells;
      c.regions = LAND_REGIONS.length + COUNTY_LAKES.length;
      c.x0 = Math.floor(minx / LAND_CELL) - 2;
      c.y0 = Math.floor(miny / LAND_CELL) - 2;
      c.cols = Math.ceil(maxx / LAND_CELL) - c.x0 + 3;
      c.rows = Math.ceil(maxy / LAND_CELL) - c.y0 + 3;
      c.state = new Uint8Array(c.cols * c.rows);
      // Flag every cell an edge touches: test each cell in the edge's bounding box
      // (grown by a unit for rounding) against the segment with a separating-axis check.
      for (const poly of polygons)
        for (let i = 0; i < poly.length; i++) {
          const [ax, ay] = poly[i],
            [bx, by] = poly[(i + 1) % poly.length],
            nx = ay - by,
            ny = bx - ax,
            c0 = Math.floor((Math.min(ax, bx) - 1) / LAND_CELL),
            c1 = Math.floor((Math.max(ax, bx) + 1) / LAND_CELL),
            r0 = Math.floor((Math.min(ay, by) - 1) / LAND_CELL),
            r1 = Math.floor((Math.max(ay, by) + 1) / LAND_CELL);
          for (let col = c0; col <= c1; col++)
            for (let row = r0; row <= r1; row++) {
              // The segment's line crosses the (slightly grown) box when the box
              // corners do not all lie on one side of it.
              const x = col * LAND_CELL - 1,
                y = row * LAND_CELL - 1,
                size = LAND_CELL + 2;
              let above = 0,
                below = 0;
              for (const [px, py] of [
                [x, y],
                [x + size, y],
                [x, y + size],
                [x + size, y + size],
              ]) {
                const side = (px - ax) * nx + (py - ay) * ny;
                if (side >= 0) above++;
                if (side <= 0) below++;
              }
              if (above && below) c.state[(row - c.y0) * c.cols + col - c.x0] = 3;
            }
        }
    }
    function landAt(x, y) {
      const c = landCells;
      if (c.regions !== LAND_REGIONS.length + COUNTY_LAKES.length) buildLandCells();
      const col = Math.floor(x / LAND_CELL) - c.x0,
        row = Math.floor(y / LAND_CELL) - c.y0;
      // Outside every polygon's bounds there is only sea.
      if (col < 0 || row < 0 || col >= c.cols || row >= c.rows) return false;
      const i = row * c.cols + col,
        s = c.state[i];
      if (s === 1) return true;
      if (s === 2) return false;
      if (s === 3) return landAtExact(x, y);
      const land = landAtExact((col + c.x0 + 0.5) * LAND_CELL, (row + c.y0 + 0.5) * LAND_CELL);
      c.state[i] = land ? 1 : 2;
      return land;
    }
    function inAirport(x, y) {
      return y > 4120 && y < 5632 && x < 1400;
    }
    function segmentDistance(x, y, a, b) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
    }
    function onBoulevard(x, y, margin = 0) {
      return BOULEVARDS.some((r) =>
        r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + margin),
      );
    }
    function landRect(x, y, w, h) {
      return [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x + w / 2, y + h / 2],
      ].every((p) => landAt(...p));
    }
    /**
     * BRIDGES
     * Every road bridge in the world, as a straight deck from `a` to `b`
     * (map points) `width` wide. Decks are at road level (`deck`: 0, the same
     * surface height as the quays they land on); boats pass under them and only
     * the pylons (bridgePylons) stand in the water. Guard rails line the deck
     * wherever it is over water (countyBridgeRails, county.js). A deck on a
     * city grid line carries that street across (cityStreets treats bridge
     * decks as ground), so Union St and Harbor Ave run on from Palm Keys to
     * Northbank; county roads join at the ends through the route graph.
     * `link` names the two shores; `id` is stable for other code and the docs.
     *
     * Palm Sound (Palm Keys - Northbank, ~1200 of water):
     *   keys-union   Union St at y 1152, x -1460..130
     *   keys-harbor  Harbor Ave at y 3200, x -1460..130
     * Marlow Bay (Northbank - Ridgeline, ~2400..2700 of water):
     *   east-bay     Harbor Ave at y 3200, x 3150..6580, onto the Ridgeline Hwy
     *   south-bay    Stadium Way at y 4736, x 3150..6420, onto Foothill Rd
     * North Sound (Northbank - Sunset Pier island, ~1700 of water):
     *   pier-bridge  Riverbank Dr at x 3200, y -3900..-5800
     * South channel and the county: oceanview (Northbank - Oceanview), coral
     * sound, ridgeline viaduct, sentinel causeway.
     */
    const BRIDGES = [
      {
        id: 'keys-union',
        name: 'KEYS BRIDGE',
        link: 'PALM KEYS - NORTHBANK',
        width: 112,
        deck: 0,
        a: [-1460, 1152],
        b: [130, 1152],
      },
      {
        id: 'keys-harbor',
        name: 'PALM SOUND CAUSEWAY',
        link: 'PALM KEYS - NORTHBANK',
        width: 112,
        deck: 0,
        a: [-1460, 3200],
        b: [130, 3200],
      },
      {
        id: 'east-bay',
        name: 'EAST BAY CROSSING',
        link: 'NORTHBANK - RIDGELINE',
        width: 122,
        deck: 0,
        a: [3150, 3200],
        b: [6580, 3200],
      },
      {
        id: 'south-bay',
        name: 'SOUTH BAY BRIDGE',
        link: 'NORTHBANK - RIDGELINE',
        width: 112,
        deck: 0,
        a: [3150, 4736],
        b: [6420, 4736],
      },
      {
        id: 'pier-bridge',
        name: 'SUNSET PIER BRIDGE',
        link: 'NORTHBANK - SUNSET PIER',
        width: 104,
        deck: 0,
        a: [3200, -3900],
        b: [3200, -5800],
      },
      {
        // Leaves Northbank from the south end of Riverbank Dr down the Battery
        // Point sea wall and lands on Oceanview's east avenue where Beach Road
        // starts.
        id: 'oceanview',
        name: 'OCEANVIEW CAUSEWAY',
        link: 'NORTHBANK - OCEANVIEW',
        width: 128,
        deck: 0,
        a: [3200, 5000],
        b: [3200, 7010],
      },
      {
        id: 'coral-sound',
        name: 'CORAL SOUND BRIDGE',
        link: 'OCEANVIEW - CORAL COAST',
        width: 116,
        deck: 0,
        a: [5700, 8000],
        b: [6750, 8000],
      },
      {
        id: 'ridgeline',
        name: 'RIDGELINE VIADUCT',
        link: 'RIDGELINE - CORAL COAST',
        width: 116,
        deck: 0,
        a: [7800, 5620],
        b: [7433.016, 7262.254],
      },
      {
        id: 'sentinel',
        name: 'SENTINEL CAUSEWAY',
        link: 'CORAL COAST - FORT SENTINEL',
        width: 126,
        deck: 0,
        a: [7800, 8150],
        b: [9440, 8150],
      },
    ];
    function bridgeFrame(bridge) {
      if (bridge.frame) return bridge.frame;
      const dx = bridge.b[0] - bridge.a[0],
        dy = bridge.b[1] - bridge.a[1],
        length = Math.hypot(dx, dy);
      return (bridge.frame = { length, a: Math.atan2(dy, dx), ux: dx / length, uy: dy / length });
    }
    /* The pairs of tall pylons that carry a bridge's main span: at 0.18 of the
       length either side of the middle, one each side of the deck, and only
       where that point is over water (a causeway has none). Shared by the
       renderer (county3d.js), aircraft collision and the boats. */
    function bridgePylons(bridge) {
      if (bridge.pylons) return bridge.pylons;
      const f = bridgeFrame(bridge),
        cx = (bridge.a[0] + bridge.b[0]) / 2,
        cy = (bridge.a[1] + bridge.b[1]) / 2,
        list = [];
      if (!bridge.name.includes('CAUSEWAY'))
        for (const along of [-f.length * 0.18, f.length * 0.18]) {
          const px = cx + f.ux * along,
            py = cy + f.uy * along;
          if (landAt(px, py)) continue;
          for (const side of [-1, 1])
            list.push({
              along,
              side,
              x: px - f.uy * side * (bridge.width / 2 + 9),
              y: py + f.ux * side * (bridge.width / 2 + 9),
            });
        }
      return (bridge.pylons = list);
    }
    function onBridgeDeck(x, y, r = 0) {
      return BRIDGES.some((b) => {
        const pad = b.width / 2 - r;
        return (
          x >= Math.min(b.a[0], b.b[0]) - pad &&
          x <= Math.max(b.a[0], b.b[0]) + pad &&
          y >= Math.min(b.a[1], b.b[1]) - pad &&
          y <= Math.max(b.a[1], b.b[1]) + pad &&
          segmentDistance(x, y, b.a, b.b) <= pad
        );
      });
    }
    function onBridge(x, y, r = 0) {
      return onBridgeDeck(x, y, r);
    }
    function groundAt(x, y, r = 0) {
      if (onBridge(x, y, r) || onDock(x, y, r) || onBeachPier(x, y, r)) return true;
      return (
        landAt(x, y) &&
        (!r ||
          (landAt(x - r, y - r) &&
            landAt(x + r, y - r) &&
            landAt(x - r, y + r) &&
            landAt(x + r, y + r)))
      );
    }
    function appendLakePaths(g) {
      for (const lake of COUNTY_LAKES) {
        [...lake.polygon].reverse().forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
      }
    }
    function coastPath(drawingContext) {
      drawingContext.beginPath();
      for (const reg of LAND_REGIONS) {
        reg.polygon.forEach(([x, y], i) =>
          i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y),
        );
        drawingContext.closePath();
      }
      appendLakePaths(drawingContext);
    }
    function regionPath(drawingContext, reg) {
      drawingContext.beginPath();
      reg.polygon.forEach(([x, y], i) =>
        i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y),
      );
      drawingContext.closePath();
      if (reg.id === 'ridgeline') appendLakePaths(drawingContext);
    }
    /* Bridge decks on the flat ground layers (2D view, minimap and map): the
       deck, its kerb lines and the centre dashes. */
    function drawBridgeGround(drawingContext) {
      for (const bridge of BRIDGES) {
        const f = bridgeFrame(bridge);
        drawingContext.save();
        drawingContext.translate(bridge.a[0], bridge.a[1]);
        drawingContext.rotate(f.a);
        drawingContext.fillStyle = '#444f57';
        drawingContext.fillRect(0, -bridge.width / 2, f.length, bridge.width);
        drawingContext.fillStyle = '#b6b8af';
        drawingContext.fillRect(0, -bridge.width / 2 - 1, f.length, 5);
        drawingContext.fillRect(0, bridge.width / 2 - 4, f.length, 5);
        drawingContext.fillStyle = '#e3c98b';
        for (let x = 0; x < f.length; x += 31) drawingContext.fillRect(x, -1, 15, 2);
        drawingContext.restore();
      }
    }
    function strokeRoad(drawingContext, points, width, color) {
      drawingContext.beginPath();
      points.forEach(([x, y], i) => (i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y)));
      drawingContext.strokeStyle = color;
      drawingContext.lineWidth = width;
      drawingContext.lineJoin = 'round';
      drawingContext.lineCap = 'round';
      drawingContext.stroke();
    }
    function paintDistrictGround(drawingContext, detail = true) {
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      for (const r of LAND_REGIONS) {
        regionPath(drawingContext, r);
        drawingContext.strokeStyle = '#929897';
        drawingContext.lineWidth = 22;
        drawingContext.stroke();
      }
      // Ocean Drive's broad sandy strand runs down the open-sea (west) shore of
      // Palm Keys; the bay shore facing the city is a quay like Northbank's.
      drawingContext.save();
      regionPath(drawingContext, LAND_REGIONS[1]);
      drawingContext.clip();
      drawingContext.strokeStyle = '#d8c89e';
      drawingContext.lineWidth = 150;
      drawingContext.lineJoin = 'round';
      drawingContext.beginPath();
      KEYS_WEST_STRAND.forEach(([x, y], i) => (i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y)));
      drawingContext.stroke();
      drawingContext.restore();
      // Battery Park: a lawn between Marina Rd and the south sea wall where
      // Southport Beach used to be; the esplanade runs along its water side.
      const park = SOUTH_PROMENADE;
      drawingContext.fillStyle = '#6f8a5c';
      drawingContext.fillRect(park.x, park.y, park.w, park.h);
      drawingContext.fillStyle = '#b8b3a2';
      for (let x = park.x + 140; x < park.x + park.w - 60; x += 280) drawingContext.fillRect(x, park.y, 16, park.h);
      // The beach-club plot on Palm Keys: levelled, paved and fenced off.
      const club = BEACH_CLUB_PLOT;
      drawingContext.fillStyle = '#b9ae94';
      drawingContext.fillRect(club.x, club.y, club.w, club.h);
      drawingContext.strokeStyle = '#8c826b';
      drawingContext.lineWidth = 3;
      drawingContext.setLineDash([14, 10]);
      drawingContext.strokeRect(club.x + 6, club.y + 6, club.w - 12, club.h - 12);
      drawingContext.setLineDash([]);
      regionPath(drawingContext, LAND_REGIONS[2]);
      drawingContext.fillStyle = '#8a9386';
      drawingContext.fill();
      for (const road of BOULEVARDS) {
        strokeRoad(drawingContext, road.points, road.width + 15, '#b3ada0');
        strokeRoad(drawingContext, road.points, road.width, '#485259');
        drawingContext.setLineDash([19, 14]);
        strokeRoad(drawingContext, road.points, 2, '#d4ba75');
        drawingContext.setLineDash([]);
      }
      const r = AIRPORT.runway;
      drawingContext.fillStyle = '#333e47';
      drawingContext.fillRect(r.x, r.y, r.w, r.h);
      drawingContext.strokeStyle = '#d5d6c4';
      drawingContext.lineWidth = 2;
      drawingContext.strokeRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
      drawingContext.fillStyle = '#ece8d7';
      for (let y = r.y + 75; y < r.y + r.h - 65; y += 54)
        drawingContext.fillRect(r.x + r.w / 2 - 2, y, 4, 24);
      for (const y of [r.y + 18, r.y + r.h - 48])
        for (let x = r.x + 16; x < r.x + r.w - 10; x += 13) drawingContext.fillRect(x, y, 6, 28);
      strokeRoad(
        drawingContext,
        [
          [r.x + r.w + 55, r.y + 100],
          [r.x + r.w + 55, 5330],
          [1060, 5330],
        ],
        45,
        '#58616a',
      );
      strokeRoad(
        drawingContext,
        [
          [530, 4890],
          [825, 4890],
          [825, 5110],
          [1150, 5110],
        ],
        110,
        '#717971',
      );
      if (detail) {
        drawingContext.fillStyle = '#e2ddc8';
        drawingContext.font = 'bold 32px monospace';
        drawingContext.textAlign = 'center';
        drawingContext.fillText('18', r.x + r.w / 2, r.y + 80);
        drawingContext.save();
        drawingContext.translate(r.x + r.w / 2, r.y + r.h - 76);
        drawingContext.rotate(Math.PI);
        drawingContext.fillText('36', 0, 0);
        drawingContext.restore();
      }
      paintBeach(drawingContext, detail);
      drawingContext.restore();
      paintPromenades(drawingContext);
      drawBridgeGround(drawingContext);
    }
    /* Palm Keys Beach: dry sand, a damp band and darker wet sand at the waterline,
       and the boardwalk along the top. The speckle uses a local hash so painting
       the map never disturbs the seeded world. */
    function paintBeach(drawingContext, detail) {
      const keys = LAND_REGIONS[1],
        box = BEACH.bounds || (regionContains(BEACH, 0, 0), BEACH.bounds);
      drawingContext.save();
      drawingContext.beginPath();
      BEACH.polygon.forEach(([x, y], i) => (i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y)));
      drawingContext.closePath();
      drawingContext.clip();
      drawingContext.fillStyle = '#dccb9f';
      drawingContext.fillRect(box.minx - 50, box.miny - 16, box.maxx - box.minx + 100, box.maxy - box.miny + 60);
      regionPath(drawingContext, keys);
      drawingContext.lineJoin = 'round';
      drawingContext.strokeStyle = '#c3b187';
      drawingContext.lineWidth = 150;
      drawingContext.stroke();
      drawingContext.strokeStyle = '#ae9c76';
      drawingContext.lineWidth = 56;
      drawingContext.stroke();
      if (detail) {
        for (let i = 0; i < 2600; i++) {
          const h = Math.sin(i * 12.9898) * 43758.5453,
            u = h - Math.floor(h),
            k = Math.sin(i * 78.233) * 12543.1234,
            v = k - Math.floor(k);
          drawingContext.fillStyle = i % 3 ? '#e8dab4' : '#bba981';
          drawingContext.fillRect(box.minx - 40 + u * 1480, 5300 + v * 650, 2 + (i % 4), 1.2);
        }
      }
      const walk = BEACH.boardwalk;
      drawingContext.fillStyle = '#8f7457';
      drawingContext.fillRect(walk.x0, walk.y - walk.width / 2, walk.x1 - walk.x0, walk.width);
      drawingContext.fillStyle = '#6f5a44';
      drawingContext.fillRect(walk.x0, walk.y + walk.width / 2 - 3, walk.x1 - walk.x0, 3);
      if (detail) {
        drawingContext.fillStyle = '#a58a69';
        for (let x = walk.x0; x < walk.x1; x += 7) drawingContext.fillRect(x, walk.y - walk.width / 2, 1, walk.width - 3);
      }
      drawingContext.restore();
    }
    function segmentCross(a, b, c, d) {
      const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      return (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0 &&
        Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
          Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) &&
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <=
          Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))
      );
    }
    function hullTouchesLand(shape) {
      const cs = corners(shape),
        hull = [cs[0], cs[2], cs[3], cs[1]];
      if (hull.some((p) => landAt(p.x, p.y))) return true;
      for (const reg of [...LAND_REGIONS, ...COUNTY_LAKES]) {
        regionContains(reg, shape.x, shape.y);
        const b = reg.bounds,
          radius = Math.hypot(shape.hx, shape.hy);
        if (
          shape.x + radius < b.minx ||
          shape.x - radius > b.maxx ||
          shape.y + radius < b.miny ||
          shape.y - radius > b.maxy
        )
          continue;
        for (let i = 0; i < reg.polygon.length; i++) {
          const a = {
              x: reg.polygon[i][0],
              y: reg.polygon[i][1],
            },
            j = (i + 1) % reg.polygon.length,
            b = {
              x: reg.polygon[j][0],
              y: reg.polygon[j][1],
            };
          if (
            boxContact(shape, {
              x: a.x,
              y: a.y,
              hx: 0.2,
              hy: 0.2,
              a: 0,
            })
          )
            return true;
          for (let k = 0; k < 4; k++) if (segmentCross(hull[k], hull[(k + 1) % 4], a, b)) return true;
        }
      }
      return false;
    }
    function districtAt(x, y) {
      if (COUNTY_LAKES.some((r) => regionContains(r, x, y))) return 'CLEARWATER RESERVOIR';
      const reg = countyRegionAt(x, y);
      if (reg) {
        if (inMilitary(x, y)) return MILITARY.name;
        const ap = COUNTY_AIRPORT;
        if (x > ap.x && x < ap.x + ap.w && y > ap.y - 200 && y < ap.y + ap.h) return ap.name;
        const town = COUNTY_TOWNS.find(
          (t) => x > t.x - 180 && x < t.x + 1200 && y > t.y - 180 && y < t.y + 1200,
        );
        return town ? town.name : reg.name;
      }
      if (inAirport(x, y) && landAt(x, y)) return 'SOUTHPORT AIRPORT';
      if (onSunsetIsle(x, y)) return 'SUNSET PIER';
      if (onBeach(x, y)) return BEACH.name;
      if (onPalmKeys(x) && landAt(x, y))
        return y < 1500
          ? 'PALM KEYS · ART DECO'
          : y < 3100
            ? 'OCEAN DRIVE'
            : y < 4400
              ? 'LITTLE HAVANA'
              : 'CORAL MARINA';
      if (!landAt(x, y) && regionContains(BEACH, x, y) && !onBridge(x, y)) return BEACH.name;
      if (!landAt(x, y)) {
        const deck = BRIDGES.find((b) => segmentDistance(x, y, b.a, b.b) <= b.width / 2);
        if (deck) return deck.name;
        // Every stretch of water used to read MARLOW BAY, the marina basin and the
        // open sea off the west wall included.
        const basin = MARINA.basin;
        if (x > basin.x && x < basin.x + basin.w && y > basin.y && y < basin.y + basin.h) return 'HARBOR POINT MARINA';
        if (x > RIVER.left - 120 && x < RIVER.right && y > -600 && y < 5600) return 'MARLOW BAY';
        if (x > -1250 && x < 60 && y > 0 && y < 5000) return 'PALM SOUND';
        if (y < -4150 && y > -5750 && x > 400 && x < 4200) return 'NORTH SOUND';
        return 'OPEN SEA';
      }
      if (x > 1718 && x < 2638 && y > 2794 && y < 3664) return 'CENTRAL GARDEN';
      if (y < 0) {
        if (y < -3860 && x > 1600 && x < 3120) return 'CRUISE TERMINAL';
        if (x < 1750 && y < -2400) return 'HARBOR POINT MARINA';
        if (x > 1880 && y < -1300) return 'NORTH POINT · FINANCIAL';
        return 'THE RECLAMATION';
      }
      if (y < 1450) return x > 2500 ? 'IRONWORKS DOCKS' : 'NORTHBANK · OLD QUARTER';
      if (y < 2650) return 'MIDTOWN';
      if (y < 3700) return x < 1800 ? 'BROADWAY' : 'EXCHANGE DISTRICT';
      if (y < 4650) return 'SOUTH BANK';
      if (y > SOUTH_PROMENADE.y - 20 && x > SOUTH_PROMENADE.x && x < SOUTH_PROMENADE.x + SOUTH_PROMENADE.w)
        return 'BATTERY PARK';
      return 'BATTERY POINT';
    }
    function validCityBlock(x, y, w = 334, h = 334) {
      return (
        landRect(x - 8, y - 8, w + 16, h + 16) &&
        !inAirport(x + w / 2, y + h / 2) &&
        ![
          [x, y],
          [x + w, y],
          [x, y + h],
          [x + w, y + h],
          [x + w / 2, y + h + 8],
        ].some(([px, py]) => regionContains(BEACH, px, py) || inReservedPlot(px, py, 8))
      );
    }
    function drawWater2D() {
      worldContext.fillStyle = cameraTarget.x < -600 ? '#267581' : '#1d4d67';
      worldContext.fillRect(0, 0, viewportWidth, viewportHeight);
      worldContext.save();
      worldContext.translate(viewportWidth / 2, viewportHeight / 2);
      worldContext.scale(canvasScale, canvasScale);
      worldContext.translate(-cameraTarget.x, -cameraTarget.y);
      const minx = cameraTarget.x - viewportWidth / canvasScale / 2 - 70,
        maxx = cameraTarget.x + viewportWidth / canvasScale / 2 + 70,
        miny = cameraTarget.y - viewportHeight / canvasScale / 2 - 70,
        maxy = cameraTarget.y + viewportHeight / canvasScale / 2 + 70;
      worldContext.lineWidth = 1.3;
      for (let y = Math.floor(miny / 32) * 32; y < maxy; y += 32)
        for (let x = Math.floor(minx / 95) * 95; x < maxx; x += 95) {
          if (landAt(x, y)) continue;
          const phase = gameTime * 1.2 + x * 0.013 + y * 0.019,
            xx = x + Math.sin(phase) * 9,
            yy = y + Math.sin(phase * 0.7) * 4;
          worldContext.strokeStyle =
            'rgba(169,221,218,' + (0.08 + 0.07 * (0.5 + 0.5 * Math.sin(phase))) + ')';
          worldContext.beginPath();
          worldContext.moveTo(xx, yy);
          worldContext.quadraticCurveTo(xx + 22, yy - 5, xx + 48, yy);
          worldContext.stroke();
        }
      for (const e of coastSegments()) {
        if (e.opening || !visible(e, 120)) continue;
        const { nx, ny } = shoreNormal(e);
        for (let k = 0; k < 2; k++) {
          const t = (gameTime * 0.18 + e.x * 0.003 + e.y * 0.002 + k * 0.5) % 1,
            offset = 3 + (1 - t) * (shoreStyle(e) === 'beach' ? 36 : 12),
            dx = (Math.cos(e.a) * e.length) / 2,
            dy = (Math.sin(e.a) * e.length) / 2;
          worldContext.strokeStyle = 'rgba(201,238,222,' + Math.sin(t * Math.PI) * 0.28 + ')';
          worldContext.lineWidth = 1.5;
          worldContext.beginPath();
          worldContext.moveTo(e.x + nx * offset - dx, e.y + ny * offset - dy);
          worldContext.quadraticCurveTo(
            e.x + nx * (offset + 3),
            e.y + ny * (offset + 3),
            e.x + nx * offset + dx,
            e.y + ny * offset + dy,
          );
          worldContext.stroke();
        }
      }
      worldContext.restore();
    }
    function buildCoastSegments() {
      const result = [];
      for (const reg of [...LAND_REGIONS, ...COUNTY_LAKES]) {
        const poly = reg.polygon;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i],
            b = poly[(i + 1) % poly.length],
            len = Math.hypot(b[0] - a[0], b[1] - a[1]),
            steps = Math.ceil(len / 45);
          for (let k = 0; k < steps; k++) {
            const t = (k + 0.5) / steps,
              x = a[0] + (b[0] - a[0]) * t,
              y = a[1] + (b[1] - a[1]) * t;
            if (!reg.lake && LAND_REGIONS.some((o) => o !== reg && regionContains(o, x, y))) continue;
            result.push({
              x,
              y,
              a: Math.atan2(b[1] - a[1], b[0] - a[0]),
              length: len / steps + 1,
              region: reg.id,
              opening:
                onBridge(x, y, -8) ||
                DOCKS.some((d) => x > d.x - 8 && x < d.x + d.w + 8 && y > d.y - 8 && y < d.y + d.h + 8),
            });
          }
        }
      }
      return result;
    }
    function drawDistrictScenery2D() {
      if (cameraTarget.x < -1500) {
        // Ocean Drive's palms, down both kerbs of the avenue on the sea side.
        for (let y = 740; y < 4550; y += 145) {
          const x = y < 1900 ? -2434 : y < 3200 ? -2444 : -2354;
          if (
            !visible(
              {
                x,
                y,
              },
              100,
            )
          )
            continue;
          for (const side of [-1, 1]) {
            const px = x + side * 64;
            worldContext.strokeStyle = '#99876c';
            worldContext.lineWidth = 4;
            worldContext.beginPath();
            worldContext.moveTo(px, y);
            worldContext.lineTo(px + 4, y - 20);
            worldContext.stroke();
            worldContext.strokeStyle = '#417d64';
            worldContext.lineWidth = 5;
            for (let i = 0; i < 7; i++) {
              const a = (i * TAU) / 7;
              worldContext.beginPath();
              worldContext.moveTo(px + 4, y - 20);
              worldContext.quadraticCurveTo(
                px + 4 + Math.cos(a) * 15,
                y - 20 + Math.sin(a) * 15 - 5,
                px + 4 + Math.cos(a) * 23,
                y - 20 + Math.sin(a) * 23,
              );
              worldContext.stroke();
            }
          }
        }
      }
      if (cameraTarget.x < 1800 && cameraTarget.y > 4000) {
        for (const [x, y, a, s] of [
          [680, 4800, -Math.PI / 2, 0.9],
          [680, 5110, -Math.PI / 2, 1],
          [1000, 5400, 0, 0.65],
        ]) {
          if (
            !visible(
              {
                x,
                y,
              },
              100,
            )
          )
            continue;
          worldContext.save();
          worldContext.translate(x + 6, y + 9);
          worldContext.rotate(a);
          worldContext.scale(s, s);
          worldContext.fillStyle = '#1a2b3244';
          worldContext.fillRect(-65, -10, 130, 20);
          worldContext.fillRect(-10, -65, 24, 130);
          worldContext.translate(-6, -9);
          worldContext.fillStyle = '#dbe3df';
          worldContext.beginPath();
          worldContext.ellipse(0, 0, 66, 9, 0, 0, TAU);
          worldContext.fill();
          worldContext.beginPath();
          worldContext.moveTo(-18, -64);
          worldContext.lineTo(8, -64);
          worldContext.lineTo(28, 0);
          worldContext.lineTo(8, 64);
          worldContext.lineTo(-18, 64);
          worldContext.lineTo(-7, 0);
          worldContext.closePath();
          worldContext.fill();
          worldContext.fillStyle = '#577f8e';
          worldContext.fillRect(-52, -22, 14, 44);
          worldContext.fillRect(43, -6, 9, 12);
          for (const side of [-1, 1]) {
            worldContext.fillRect(-2, side * 30 - 4, 18, 8);
            for (let q = -35; q < 38; q += 8) worldContext.fillRect(q, side * 7 - 1, 3, 2);
          }
          worldContext.restore();
        }
        worldContext.fillStyle = '#a0b1b1';
        worldContext.fillRect(771, 5056, 38, 38);
        worldContext.fillStyle = '#476470';
        worldContext.fillRect(775, 5060, 30, 30);
      }
    }
    // END SUBSYSTEM: src/geography.js
