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
      // Runway 18/36 (airfields.js RUNWAYS has the whole plan): 460 m, most of
      // it on the reclaimed pier south of the airport.
      runway: {
        x: 300,
        y: 4280,
        w: 236,
        h: 3680,
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
      // Southport is a GA strip now: three parked couriers (their fuselages).
      ...[
        [800, 4650, false, 0.89],
        [800, 4930, false, 0.89],
        [1000, 5420, true, 0.89],
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
      return rectListBlocked(AIRPORT_SCENERY_SOLIDS, x, y, r);
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
      // 30 m: a lobby and eight storeys (game.js WORLD SCALE), in real units already.
      height: 240,
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
        const a = poly[i],
          b = poly[j],
          ax = a[0],
          ay = a[1],
          bx = b[0],
          by = b[1];
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
      for (let i = 0; i < COUNTY_LAKES.length; i++) if (regionContains(COUNTY_LAKES[i], x, y)) return false;
      for (let i = 0; i < LAND_REGIONS.length; i++) if (regionContains(LAND_REGIONS[i], x, y)) return true;
      return false;
    }
