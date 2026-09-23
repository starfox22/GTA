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
          // South shore: the sweep of Southport Beach between Marina Rd and the
          // water (see BEACH below), wide enough for a proper public strand. The
          // strand is one smooth curve, not a string of corners: a beach is
          // shaped by the swell, and the surf, the wet sand and the swash all
          // follow this line.
          [3300, 5020],
          ...smoothShoreline(
            [
              [3150, 5420],
              [2890, 5672],
              [2420, 5806],
              [2010, 5758],
              [1836, 5572],
              [1800, 5430],
            ],
            9,
          ),
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
        id: 'palmkeys',
        name: 'PALM KEYS',
        color: '#93a897',
        polygon: [
          [4040, 180],
          [4700, 50],
          [5280, 150],
          [5540, 780],
          [5620, 1690],
          [5540, 2590],
          [5630, 3290],
          [5520, 4090],
          [5300, 5080],
          [4700, 5500],
          [4200, 5160],
          [3980, 4430],
          [3960, 3730],
          [4020, 2820],
          [3960, 2020],
          [3960, 540],
        ],
      },
      {
        // Reclaimed sand bar in the lower bay, bought and built as a pleasure pier.
        id: 'sunsetisle',
        name: 'SUNSET PIER',
        color: '#8e9b84',
        polygon: [
          [3560, 4850],
          [3930, 4820],
          [4130, 4980],
          [4170, 5270],
          [3990, 5490],
          [3690, 5530],
          [3490, 5340],
          [3470, 5040],
        ],
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
     * SOUTHPORT BEACH
     * The city's public strand on Northbank's south shore, between the airport
     * fence (x 1740) and the Battery Point sea wall (x 3125): sand from the
     * Marina Rd kerb down to the water, 250..460 units deep and 1400 long. It is
     * reserved ground: no street or block is laid on it (cityStreets,
     * validCityBlock), the esplanade gives way to the boardwalk along its top
     * edge, and its shore reads as 'beach' so the water meets the sand rather
     * than a quay wall, and only here can someone on foot walk into the sea.
     * Nothing crosses the sand: the Oceanview Causeway leaves from the end of
     * Riverbank Dr, east of the sea wall, and the Coast Line viaduct passes well
     * to the west. The polygon runs out past the waterline and `onBeach` clips
     * it to land. Beach life, the props and the pier are built on this data by
     * beach.js and beach3d.js.
     *
     * The fishing pier runs out from the lower sand into the swim zone: a
     * walkable deck (part of `groundAt`, like the docks) that is a wall to
     * anyone on foot and a roof to swimmers, who pass under it between the piles.
     */
    const BEACH = {
      name: 'SOUTHPORT BEACH',
      polygon: [
        [1740, 5306],
        [3125, 5306],
        [3125, 5960],
        [1650, 5960],
        [1650, 5440],
      ],
      // The promenade along the top of the sand: a 40-unit boardwalk just south
      // of the Marina Rd pavement, from the airport fence to the sea wall.
      boardwalk: { x0: 1760, x1: 3110, y: 5326, width: 40 },
      // Stem from the lower sand out past the breakers, and the T of the head.
      pier: [
        { x: 2683, y: 5688, w: 34, h: 300 },
        { x: 2636, y: 5950, w: 128, h: 40 },
      ],
    };
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
          [4985, 3060],
          [4985, 3200],
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
    const ROOFTOP = {
      id: 'skyline',
      name: 'THE BLUE HOUR',
      x: 4300,
      y: 2250,
      w: 360,
      h: 350,
      height: 135,
      door: {
        x: 4480,
        y: 2622,
      },
      lift: {
        x: 4336,
        y: 2556,
      },
      bar: {
        x: 4550,
        y: 2317,
      },
      contact: {
        x: 4618,
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
    // Each crossing starts on Riverbank Dr (x = 3200). Stadium Way's used to start
    // at x 3050, so its deck and guard rails ran through the stadium's east stand.
    function bridgeSpan(y) {
      return y === 4736 ? [3150, 4390] : y === 3200 ? [3160, 4260] : [3150, 4170];
    }
    function bridgeRailSpans(y) {
      let spans = [bridgeSpan(y)];
      for (const x of ROAD_CENTERS)
        spans = spans.flatMap(([a, b]) =>
          x + 85 <= a || x - 85 >= b
            ? [[a, b]]
            : [
                [a, Math.min(b, x - 85)],
                [Math.max(a, x + 85), b],
              ].filter(([lo, hi]) => hi > lo),
        );
      return spans;
    }
    function onBridge(x, y, r = 0) {
      return (
        onCountyBridge(x, y, r) ||
        BRIDGES.some((z) => {
          const [a, b] = bridgeSpan(z);
          return x - r >= a && x + r <= b && Math.abs(y - z) <= 56 - r;
        })
      );
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
    function drawBridgeGround(drawingContext) {
      for (const z of BRIDGES) {
        const [a, b] = bridgeSpan(z);
        drawingContext.fillStyle = '#444f57';
        drawingContext.fillRect(a, z - 56, b - a, 112);
        drawingContext.fillStyle = '#b6b8af';
        for (const [lo, hi] of bridgeRailSpans(z)) {
          drawingContext.fillRect(lo, z - 57, hi - lo, 5);
          drawingContext.fillRect(lo, z + 52, hi - lo, 5);
        }
        drawingContext.fillStyle = '#e3c98b';
        for (let x = a; x < b; x += 31) drawingContext.fillRect(x, z - 1, 15, 2);
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
        drawingContext.strokeStyle = r.id === 'palmkeys' ? '#d5c49f' : '#929897';
        drawingContext.lineWidth = r.id === 'palmkeys' ? 125 : 22;
        drawingContext.stroke();
      }
      // Broad sandy strands and turquoise shallows belong to the eastern island.
      drawingContext.save();
      regionPath(drawingContext, LAND_REGIONS[1]);
      drawingContext.clip();
      drawingContext.strokeStyle = '#d8c89e';
      drawingContext.lineWidth = 150;
      drawingContext.beginPath();
      LAND_REGIONS[1].polygon
        .slice(1, 11)
        .forEach(([x, y], i) => (i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y)));
      drawingContext.stroke();
      drawingContext.restore();
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
    /* Southport Beach: dry sand, a damp band and darker wet sand at the waterline,
       and the boardwalk along the top. The speckle uses a local hash so painting
       the map never disturbs the seeded world. */
    function paintBeach(drawingContext, detail) {
      const northbank = LAND_REGIONS[0];
      drawingContext.save();
      drawingContext.beginPath();
      BEACH.polygon.forEach(([x, y], i) => (i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y)));
      drawingContext.closePath();
      drawingContext.clip();
      drawingContext.fillStyle = '#dccb9f';
      drawingContext.fillRect(1600, 5290, 1750, 700);
      regionPath(drawingContext, northbank);
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
          drawingContext.fillRect(1650 + u * 1650, 5300 + v * 650, 2 + (i % 4), 1.2);
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
      if (x > RIVER.right && landAt(x, y))
        return y < 1500
          ? 'PALM KEYS · ART DECO'
          : y < 3100
            ? 'OCEAN DRIVE'
            : y < 4400
              ? 'LITTLE HAVANA'
              : 'CORAL MARINA';
      if (!landAt(x, y) && regionContains(BEACH, x, y) && !onBridge(x, y)) return BEACH.name;
      if (!landAt(x, y)) return onBridge(x, y) ? 'MARLOW BAY CAUSEWAY' : 'MARLOW BAY';
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
      return 'BATTERY POINT';
    }
    function validCityBlock(x, y, w = 334, h = 334) {
      return (
        landRect(x - 8, y - 8, w + 16, h + 16) &&
        !inAirport(x + w / 2, y + h / 2) &&
        !regionContains(BEACH, x + w / 2, y + h + 8)
      );
    }
    function drawWater2D() {
      worldContext.fillStyle = cameraTarget.x > 3700 ? '#267581' : '#1d4d67';
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
      if (cameraTarget.x > 4400) {
        for (let y = 740; y < 4550; y += 145) {
          const x = y < 1900 ? 5250 : y < 3200 ? 5260 : 5170;
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
