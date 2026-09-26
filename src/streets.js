    // BEGIN SUBSYSTEM: src/streets.js — Road presentation
    /**
     * Road presentation
     * Source: src/streets.js
     * Scope: shared game closure.
     * Intersections, sidewalks, road painting, waterfront promenades and traffic details.
     */
    /* Shared street footprints: connected grid, varied widths, deliberate ends short of the shore. */
    let cityStreetCache = null,
      coastCache = null;
    function cityStreets() {
      if (cityStreetCache) return cityStreetCache;
      const roads = [];
      for (const vertical of [false, true])
        for (const r of vertical ? ROAD_CENTERS : ROAD_ROWS) {
          const width = (vertical ? wideColumn(r) : wideRow(r)) ? 112 : 88;
          let start = null;
          const valid = (v) => {
            const x = vertical ? r : v,
              y = vertical ? v : r;
            if (inAirport(x, y) || parkStreetClosed(x, y) || inStadiumLot(x, y, 56)) return false;
            if (onSunsetIsle(x, y) || onBeach(x, y) || marinaQuayAt(x, y) || inReservedPlot(x, y, 20)) return false;
            // Battery Park's lawn and the esplanade below it: the avenues end at
            // Marina Rd instead of running on under the lawn to the sea wall.
            const park = SOUTH_PROMENADE;
            if (vertical && y > park.y - 10 && x > park.x && x < park.x + park.w) return false;
            // West Quay (x = 128) is not a street: the strip between the sea wall
            // and the first blocks is the esplanade and the Shore Line viaduct.
            if (vertical && r === RAIL_CORRIDOR_X) return false;
            if (onBridge(x, y, 0)) return true;
            const side = width / 2 + 28;
            return (
              landAt(x, y) &&
              [-side, side].every((d) => landAt(x + (vertical ? d : 0), y + (vertical ? 0 : d))) &&
              landAt(x + (vertical ? 0 : 25), y + (vertical ? 25 : 0)) &&
              landAt(x - (vertical ? 0 : 25), y - (vertical ? 25 : 0))
            );
          };
          const from = vertical ? CITY_TOP + 64 : CITY_LEFT + 64;
          for (let v = from; v <= CITY_SIZE - 32; v += 16) {
            if (v <= CITY_SIZE - 48 && valid(v)) {
              if (start === null) start = v;
            } else if (start !== null) {
              if (v - start > 144)
                roads.push({
                  vertical,
                  r,
                  width,
                  start,
                  end: v - 16,
                  points: vertical
                    ? [
                        [r, start],
                        [r, v - 16],
                      ]
                    : [
                        [start, r],
                        [v - 16, r],
                      ],
                });
              start = null;
            }
          }
        }
      return (cityStreetCache = roads);
    }
    /**
     * STREET NAMES
     * Every grid road has a name so the HUD, the map and mission copy can refer to
     * real addresses ("HARBOR AVE & FOUNDRY AVE"). Vertical roads are keyed by x,
     * horizontal roads by y; the four 112-wide roads are the avenues.
     */
    const STREET_NAMES = {
      vertical: {
        // Palm Keys: Ocean Dr on the sea side, Bayshore Dr on the bay side.
        '-2432': 'OCEAN DR',
        '-1920': 'FLAMINGO AVE',
        '-1408': 'COLLINS AVE',
        128: 'WEST QUAY',
        640: 'SUNSET BLVD',
        1152: 'ROYAL AVE',
        1664: 'COMMONS ST',
        2176: 'GARDEN ST',
        2688: 'GARDEN AVE',
        3200: 'RIVERBANK DR',
      },
      horizontal: {
        128: 'NORTH SHORE RD',
        640: 'ARMORY ST',
        1152: 'UNION ST',
        1664: 'LINDEN ST',
        2176: 'CENTRAL PKWY',
        2688: 'EXCHANGE ST',
        3200: 'HARBOR AVE',
        3712: 'SOUTH BANK RD',
        4224: 'BATTERY ST',
        4736: 'STADIUM WAY',
        5248: 'MARINA RD',
      },
    };
    function streetNameAt(x, y) {
      const isleStreet = monarchStreetName(x, y);
      if (isleStreet) return isleStreet;
      if (x > CITY_SIZE || y > CITY_SIZE || !landAt(x, y)) {
        const county = COUNTY_ROADS.find((r) =>
          r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + 30),
        );
        return county ? county.name : onBridge(x, y) ? 'CAUSEWAY' : '';
      }
      const nearestX = roadNear(x),
        nearestY = rowNear(y),
        onVertical = Math.abs(x - nearestX) < 62,
        onHorizontal = Math.abs(y - nearestY) < 62,
        v = STREET_NAMES.vertical[nearestX],
        h = STREET_NAMES.horizontal[nearestY];
      if (onVertical && onHorizontal && v && h) return v + ' & ' + h;
      if (onVertical && v) return v;
      if (onHorizontal && h) return h;
      const boulevard = BOULEVARDS.find((r) =>
        r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + 30),
      );
      if (boulevard) return boulevard.name;
      // Off the road: name the nearer of the two bounding streets.
      return (Math.abs(x - nearestX) < Math.abs(y - nearestY) ? v : h) || '';
    }
    /* Ocean Dr's palms, down both pavements (the 3D and 2D views share the list).
       The rows used to shift east south of y 3200, which stood one line of palms
       in the carriageway and the other inside the hotels, and both rows ran on
       across every side street. */
    let oceanPalmCache = null;
    function oceanDrivePalms() {
      if (oceanPalmCache) return oceanPalmCache;
      oceanPalmCache = [];
      for (let y = 730; y < 4550; y += 145)
        for (const [x, dy, size] of [[-2372, 0, 1.15], [-2501, 20, 1]]) {
          const py = y + dy;
          // Not in a street, nor on the corner of a junction where its signal stands.
          if (!landAt(x, py) || cityStreetAt(x, py, 8) || cityStreetAt(x, py - 26) || cityStreetAt(x, py + 26) || solid(x, py, 4)) continue;
          oceanPalmCache.push({ x, y: py, size });
        }
      return oceanPalmCache;
    }
    /* Bench positions are shared by the renderer (which draws them) and by pedestrians (who sit on them). */
    let benchCache = null;
    function benchSpots() {
      if (benchCache) return benchCache;
      benchCache = [];
      for (let bx = BLOCK_X_MIN; bx <= BLOCK_X_MAX; bx++)
        for (let by = BLOCK_Y_MIN; by <= BLOCK_Y_MAX; by++) {
          const x = blockX(bx) + 89,
            z = blockY(by) + 89,
            w = 334;
          if (!validCityBlock(x, z, w, w) || harborOverlap(x, z, w, w) || stadiumOverlap(x, z, w, w) || isPark(bx, by))
            continue;
          for (const px of [x + 110, x + 222]) {
            const y = z - 14;
            if (landAt(px, y) && !onRoad(px, y) && !solid(px, y, 5) && !onBoulevard(px, y, 12) && !inHarbor(px, y, 20) && !inStadiumLot(px, y, 10))
              benchCache.push({ x: px, y, a: Math.PI / 2, taken: null });
          }
        }
      return benchCache;
    }
    // A street that stops on a crossing street's carriageway is a T-junction, not a
    // dead end: no turning head, barrier or NO THROUGH ROAD plate.
    function streetEndInJunction(r, p) {
      return cityStreets().some(
        (o) => o.vertical !== r.vertical && segmentDistance(p.x, p.y, o.points[0], o.points[1]) <= o.width / 2 + 6,
      );
    }
    /**
     * STREET ENDS
     * The ends of grid streets that neither meet another street, a bridge, a
     * boulevard nor the shore: `closed` ends (a kerb and a guardrail across the
     * carriageway, the footways carrying on round it) and `gate` ends at a park
     * or the stadium (piers and railings either side of a forecourt). The
     * renderer (world3d.js) draws the pieces from this plan and `streetEndSolids`
     * gives each piece its collider, for people (solid) and vehicles (statics).
     * Local frame per end: +x out past the end point, z across the street.
     */
    const STREET_END_RAIL = { x: 4, depth: 4, plateX: -40, plateZ: 10 },
      STREET_END_GATE = { offset: 16, pierX: 52, pier: 13, railFrom: 6, railTo: 46 };
    let streetEndCache = null;
    function streetEndPlan() {
      if (streetEndCache) return streetEndCache;
      streetEndCache = [];
      for (const r of cityStreets())
        for (const end of [r.start, r.end]) {
          const p = r.vertical ? { x: r.r, y: end } : { x: end, y: r.r },
            outward = end === r.start ? -1 : 1,
            a = r.vertical ? (outward > 0 ? Math.PI / 2 : -Math.PI / 2) : outward > 0 ? 0 : Math.PI;
          if (onBridge(p.x, p.y, -20) || onBoulevard(p.x, p.y, 65) || streetEndInJunction(r, p)) continue;
          if (inAirport(p.x, p.y) || inStadiumLot(p.x, p.y, 40)) continue;
          // A street that runs out at the water is finished by the esplanade.
          if (streetEndAtShore(p.x, p.y, a)) continue;
          streetEndCache.push({ p, a, width: r.width, kind: streetEndAtGate(p.x, p.y, a) ? 'gate' : 'closed' });
        }
      return streetEndCache;
    }
    let streetEndSolidCache = null;
    function streetEndSolids() {
      if (streetEndSolidCache) return streetEndSolidCache;
      streetEndSolidCache = [];
      for (const { p, a, width, kind } of streetEndPlan()) {
        const ux = Math.round(Math.cos(a)),
          uy = Math.round(Math.sin(a)),
          half = width / 2;
        // A local rectangle (x0..x1 along, z0..z1 across) as a map rectangle.
        const rect = (x0, x1, z0, z1, height, what) => {
          const xs = [x0, x1].flatMap((u) => [z0, z1].map((v) => p.x + u * ux - v * uy)),
            ys = [x0, x1].flatMap((u) => [z0, z1].map((v) => p.y + u * uy + v * ux)),
            x = Math.min(...xs),
            y = Math.min(...ys);
          streetEndSolidCache.push({ x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, height, kind: what });
        };
        if (kind === 'gate') {
          const g = STREET_END_GATE;
          for (const side of [-1, 1]) {
            const z = side * (half + g.offset);
            rect(g.pierX - g.pier / 2, g.pierX + g.pier / 2, z - g.pier / 2, z + g.pier / 2, 30, 'gate pier');
            rect(g.railFrom, g.railTo, z - 1.2, z + 1.2, 12, 'gate railing');
          }
        } else {
          const g = STREET_END_RAIL;
          rect(g.x - g.depth / 2, g.x + g.depth / 2, -half - 2, half + 2, 14, 'street end rail');
          rect(g.plateX - 1, g.plateX + 1, -half - g.plateZ - 1, -half - g.plateZ + 1, 22, 'sign post');
        }
      }
      return streetEndSolidCache;
    }
    // Part of solid(): the guardrails, gate piers and railings at street ends.
    // The guardrails bucketed by 256-unit cell (a solid can sit in several).
    let streetEndGrid = null,
      streetEndGridList = null;
    function streetEndBlocked(x, y, r = 0) {
      const list = streetEndSolids();
      if (streetEndGridList !== list || streetEndGrid.count !== list.length) {
        streetEndGridList = list;
        streetEndGrid = new Map();
        streetEndGrid.count = list.length;
        for (const b of list)
          for (let i = Math.floor((b.x - 32) / 256); i <= Math.floor((b.x + b.w + 32) / 256); i++)
            for (let j = Math.floor((b.y - 32) / 256); j <= Math.floor((b.y + b.h + 32) / 256); j++) {
              const key = i * 4096 + j;
              if (!streetEndGrid.has(key)) streetEndGrid.set(key, []);
              streetEndGrid.get(key).push(b);
            }
      }
      // Radii up to 32 are covered by the margin each solid was bucketed with.
      if (r > 32) {
        for (const b of list) if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
        return false;
      }
      const cell = streetEndGrid.get(Math.floor(x / 256) * 4096 + Math.floor(y / 256));
      if (!cell) return false;
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i];
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      return false;
    }
    function cityIntersectionAt(x, y) {
      return (
        cityStreets().some((r) => !r.vertical && r.r === y && x > r.start + 100 && x < r.end - 100) &&
        cityStreets().some((r) => r.vertical && r.r === x && y > r.start + 100 && y < r.end - 100)
      );
    }
    function cityStreetAt(x, y, margin = 0) {
      return (
        cityStreets().some(
          (r) => segmentDistance(x, y, r.points[0], r.points[1]) <= r.width / 2 + margin,
        ) ||
        onBoulevard(x, y, margin) ||
        onCountyRoad(x, y, margin) ||
        onBridge(x, y, -margin)
      );
    }
    function paintCityStreets(drawingContext, detail = true) {
      const streets = cityStreets();
      drawingContext.save();
      for (const r of streets) strokeRoad(drawingContext, r.points, r.width + 28, '#9b9d90');
      for (const r of streets) strokeRoad(drawingContext, r.points, r.width, '#414c52');
      for (const r of streets) {
        const pos = (v) =>
          r.vertical
            ? {
                x: r.r,
                y: v,
              }
            : {
                x: v,
                y: r.r,
              };
        for (const v of [r.start, r.end]) {
          const p = pos(v),
            outward = v === r.start ? -1 : 1,
            a = r.vertical
              ? (outward > 0 ? Math.PI / 2 : -Math.PI / 2)
              : outward > 0
                ? 0
                : Math.PI;
          if (onBridge(p.x, p.y, -20) || onBoulevard(p.x, p.y, 65) || streetEndInJunction(r, p)) continue;
          if (streetEndAtGate(p.x, p.y, a)) {
            // Forecourt: the carriageway widens into a paved apron at the gates,
            // with a crossing where the footway passes in front of them.
            drawingContext.save();
            drawingContext.translate(p.x, p.y);
            drawingContext.rotate(a);
            drawingContext.fillStyle = '#8f8d81';
            drawingContext.fillRect(-14, -r.width / 2 - 34, 78, r.width + 68);
            drawingContext.fillStyle = '#4b5659';
            drawingContext.fillRect(-14, -r.width / 2, 42, r.width);
            if (detail) {
              drawingContext.fillStyle = '#d4d6c7';
              for (let i = -3; i <= 3; i++) drawingContext.fillRect(34, i * 13 - 3, 15, 6);
              drawingContext.fillStyle = '#a5a396';
              for (let i = -3; i <= 3; i++) drawingContext.fillRect(56, i * 13 - 4, 16, 8);
            }
            drawingContext.restore();
            continue;
          }
          if (streetEndAtShore(p.x, p.y, a)) {
            // Meets the esplanade: a short apron and a crossing, no turning head.
            drawingContext.save();
            drawingContext.translate(p.x, p.y);
            drawingContext.rotate(a);
            drawingContext.fillStyle = '#4b5659';
            drawingContext.fillRect(0, -r.width / 2, 22, r.width);
            if (detail) {
              drawingContext.fillStyle = '#d4d6c7';
              for (let i = -2; i <= 2; i++)
                drawingContext.fillRect(24, i * 12 - 3, 13, 6);
            }
            drawingContext.restore();
            continue;
          }
          // A closed end (at the airport fence, the marina quay): the carriageway
          // stops square at a kerb and the footway wraps round the end. It used to
          // swell into a painted turning circle that read like a helipad.
          drawingContext.save();
          drawingContext.translate(p.x, p.y);
          drawingContext.rotate(a);
          drawingContext.fillStyle = '#9b9d90';
          drawingContext.fillRect(0, -r.width / 2 - 14, r.width / 2 + 14, r.width + 28);
          drawingContext.fillStyle = '#c3c2b6';
          drawingContext.fillRect(0, -r.width / 2, 2.5, r.width);
          drawingContext.restore();
        }
        if (!detail) continue;
        drawingContext.fillStyle = '#d0c39a';
        for (let v = r.start + 55; v < r.end - 50; v += 32) {
          const p = pos(v);
          if (Math.abs(v - (r.vertical ? rowNear(v) : roadNear(v))) < 85 || onBoulevard(p.x, p.y, 35))
            continue;
          if (r.vertical) drawingContext.fillRect(p.x - 1, p.y, 2, 15);
          else drawingContext.fillRect(p.x, p.y - 1, 15, 2);
        }
      }
      if (detail) {
        drawingContext.fillStyle = '#d4d6c7';
        for (const c of cityCrosswalks()) {
          // Bars the full width of the carriageway crossed, across the walk.
          const along = c.w > c.h;
          for (let i = 5; i <= (along ? c.w : c.h) - 11; i += 12)
            if (along) drawingContext.fillRect(c.x + i, c.y, 6, c.h);
            else drawingContext.fillRect(c.x, c.y + i, c.w, 6);
        }
      }
      drawingContext.restore();
    }
    /* Zebra crossings on every leg of every junction, T-junctions included, as
       rectangles {x, y, w, h} the width of the carriageway they cross. A leg gets
       one only where its street really carries on and both ends of the crossing
       land on pavement (not a street that is not there, not the edge of a bridge
       deck over the water). layout() exports them for the audit. */
    let crosswalkCache = null;
    function cityCrosswalks() {
      if (crosswalkCache) return crosswalkCache;
      crosswalkCache = [];
      const streets = cityStreets(),
        kerbs = (x0, y0, x1, y1) => groundAt(x0, y0) && groundAt(x1, y1) && landAt(x0, y0) && landAt(x1, y1);
      for (const x of ROAD_CENTERS)
        for (const y of ROAD_ROWS) {
          const horizontal = streets.find((r) => !r.vertical && r.r === y && x >= r.start - 8 && x <= r.end + 8),
            vertical = streets.find((r) => r.vertical && r.r === x && y >= r.start - 8 && y <= r.end + 8);
          if (!horizontal || !vertical) continue;
          const hw = horizontal.width / 2,
            vw = vertical.width / 2,
            north = vertical.start < y - hw - 40,
            south = vertical.end > y + hw + 40,
            west = horizontal.start < x - vw - 40,
            east = horizontal.end > x + vw + 40;
          if ((north || south) + (west || east) < 2 && !(north && south) && !(west && east)) continue;
          if (north && kerbs(x - vw - 10, y - hw - 12, x + vw + 10, y - hw - 12)) crosswalkCache.push({ x: x - vw, y: y - hw - 19, w: vw * 2, h: 13 });
          if (south && kerbs(x - vw - 10, y + hw + 12, x + vw + 10, y + hw + 12)) crosswalkCache.push({ x: x - vw, y: y + hw + 6, w: vw * 2, h: 13 });
          if (west && kerbs(x - vw - 12, y - hw - 10, x - vw - 12, y + hw + 10)) crosswalkCache.push({ x: x - vw - 19, y: y - hw, w: 13, h: hw * 2 });
          if (east && kerbs(x + vw + 12, y - hw - 10, x + vw + 12, y + hw + 10)) crosswalkCache.push({ x: x + vw + 6, y: y - hw, w: 13, h: hw * 2 });
        }
      return crosswalkCache;
    }
    function coastSegments() {
      return coastCache || (coastCache = buildCoastSegments());
    }
    // Palm Keys Beach's sand runs down to the water, so the esplanade stops at
    // either end of it and the boardwalk along the top of the beach carries the
    // walk across.
    function beachShore(e) {
      return e.region === 'palmkeys' && regionContains(BEACH, e.x, e.y);
    }
    // The Riverside helipad stands on the quay itself, so the esplanade stops at
    // its fence instead of being painted across half of the landing square.
    function esplanadeGivesWay(e) {
      const p = esplanadePoint(e);
      return (
        beachShore(e) ||
        monarchEsplanadeGivesWay(e) ||
        inReservedPlot(p.x, p.y, 10) ||
        HELIPADS.some((pad) => Math.abs(p.x - pad.x) < 64 && Math.abs(p.y - pad.y) < 64)
      );
    }
    // Palm Keys: sand on the public beach and down Ocean Drive's open-sea (west)
    // shore; the bay shore facing the city is a quay.
    function shoreStyle(e) {
      const isle = monarchShoreStyle(e);
      if (isle) return isle;
      return beachShore(e) ||
        (e.region === 'palmkeys' && e.x < -1700) ||
        COUNTY_REGIONS.find((r) => r.id === e.region)?.beach
        ? 'beach'
        : ['northbank', 'airport', 'palmkeys', 'sunsetisle'].includes(e.region)
          ? 'quay'
          : 'rock';
    }
    function shoreNormal(e) {
      let nx = -Math.sin(e.a),
        headingCosine = Math.cos(e.a);
      if (landAt(e.x + nx * 12, e.y + headingCosine * 12)) {
        nx = -nx;
        headingCosine = -headingCosine;
      }
      return {
        nx,
        ny: headingCosine,
      };
    }
    /**
     * WATERFRONT
     * A street that runs out at the shore is finished by the esplanade, not by a
     * turning head: only the handful of ends that stop inland keep the barrier and
     * the NO THROUGH ROAD plate. `promenadeSpots()` is the shared esplanade
     * furniture list -- the renderer builds railings, lamps and benches from it and
     * pedestrians walk between the same points, so what you see is what they use.
     */
    function streetEndAtShore(x, y, a) {
      for (let d = 12; d < 170; d += 12) {
        const px = x + Math.cos(a) * d,
          py = y + Math.sin(a) * d;
        if (!landAt(px, py) || onBeach(px, py)) return true;
      }
      return false;
    }
    /* A street that stops at a park or the stadium ends at its gates, not in a
       painted circle in the middle of nowhere: it gets a forecourt instead. */
    function streetEndAtGate(x, y, a) {
      for (let d = 0; d < 150; d += 12) {
        const px = x + Math.cos(a) * d,
          py = y + Math.sin(a) * d;
        if (parkAt(px, py) || parkStreetClosed(px, py) || inStadiumLot(px, py, 70)) return true;
      }
      return false;
    }
    const PROMENADE_REGIONS = ['northbank', 'palmkeys', 'monarch'];
    // Wide enough for two people abreast and a bicycle past them: the walk runs
    // from the quay edge (40 seaward of the esplanade point) 72 units inland.
    const ESPLANADE_LANDWARD = 32,
      ESPLANADE_SEAWARD = 40,
      // The sea railing stands on the quay coping, 3 units in from the edge.
      ESPLANADE_RAIL_Z = 37;
    /* The yaw whose local +z points out to sea at a promenade spot (or coast
       segment with its normal). The coast heading alone does not say which side
       the sea is on: it depends on how the land polygon is wound, and on every
       Northbank and Palm Keys quay it pointed inland, so the sea railing stood on
       the landward edge of the walk, across every street mouth. */
    function promenadeYaw(spot) {
      return Math.atan2(-spot.nx, spot.ny);
    }
    function esplanadePoint(e) {
      const { nx, ny } = shoreNormal(e),
        inset = shoreStyle(e) === 'beach' ? 92 : 40;
      return { x: e.x - nx * inset, y: e.y - ny * inset, nx, ny, a: e.a };
    }
    let promenadeCache = null;
    function promenadeSpots() {
      if (promenadeCache) return promenadeCache;
      promenadeCache = [];
      let step = 0;
      for (const e of coastSegments()) {
        if (e.opening || !PROMENADE_REGIONS.includes(e.region) || esplanadeGivesWay(e)) continue;
        const p = esplanadePoint(e);
        if (!groundAt(p.x, p.y, 10)) continue;
        step++;
        // The walk runs on past a street mouth rather than stopping at it: the
        // paving and the sea railing carry straight across and only the furniture
        // steps aside, which is how a real seafront is built.
        const crossing = onRoad(p.x, p.y),
          // A station's lift tower stands at the sea edge of the walk on the west
          // shore; the spot beside it keeps its railing and nothing else.
          byLift = RAIL_STATIONS.some((s) => s.lift && Math.hypot(s.lift.x - p.x, s.lift.y - p.y) < 45);
        promenadeCache.push({
          x: p.x,
          y: p.y,
          a: p.a,
          length: e.length,
          nx: p.nx,
          ny: p.ny,
          crossing,
          beach: shoreStyle(e) === 'beach',
          // A repeating rhythm of rail, lamp, bench and planter down the walk.
          kind: crossing || byLift
            ? 'rail'
            : step % 6 === 2
              ? 'bench'
              : step % 6 === 4
                ? 'lamp'
                : step % 12 === 9
                  ? 'tree'
                  : 'rail',
        });
      }
      addPromenadeRailRuns(promenadeCache);
      return promenadeCache;
    }
    /**
     * SEA RAILING
     * Each quay spot carries a length of railing on the coping (`spot.rail`, runs
     * [u0, u1] along the spot's local x). It breaks where people really cross
     * the quay edge: the swimmers' ladders, the marina's finger pontoons, the
     * superyacht's passerelle. The same runs are the railing's collider
     * (`promenadeRailBlocked`), so what you see is what stops you.
     */
    let promenadeRailGrid = null;
    function addPromenadeRailRuns(spots) {
      const gaps = [];
      for (const f of MARINA.fingers) gaps.push({ x: f.x + f.w / 2, y: MARINA.quay.y - 10, half: f.w / 2 + 5 });
      gaps.push(...monarchRailGaps());
      const g = SUPERYACHT_GANGWAY,
        board = deckWorld(SUPERYACHT, g.u0, (g.v0 + g.v1) / 2);
      gaps.push({ x: board.x, y: board.y, half: (g.v1 - g.v0) / 2 + 5 });
      // The ladders are placed from the coast alone (water.js), never from the rail.
      for (const l of ladderList()) if (l.kind === 'quay') gaps.push({ x: l.edge.x, y: l.edge.y, half: 9 });
      promenadeRailGrid = new Map();
      for (const spot of spots) {
        spot.rail = [];
        if (spot.beach) continue;
        const yaw = promenadeYaw(spot),
          ux = Math.cos(yaw),
          uy = Math.sin(yaw),
          // The rail line's middle, on the coping.
          cx = spot.x + spot.nx * ESPLANADE_RAIL_Z,
          cy = spot.y + spot.ny * ESPLANADE_RAIL_Z,
          half = spot.length / 2 + 0.5;
        let runs = [[-half, half]];
        for (const gap of gaps) {
          const dx = gap.x - cx,
            dy = gap.y - cy,
            u = dx * ux + dy * uy,
            across = -dx * uy + dy * ux;
          if (Math.abs(across) > 24 || Math.abs(u) > half + gap.half) continue;
          runs = runs.flatMap(([a, b]) =>
            [
              [a, Math.min(b, u - gap.half)],
              [Math.max(a, u + gap.half), b],
            ].filter(([p, q]) => q - p > 1),
          );
        }
        spot.rail = runs;
        spot.railLine = { cx, cy, ux, uy };
        if (!runs.length) continue;
        const key = Math.floor(cx / 128) * 4096 + Math.floor(cy / 128);
        if (!promenadeRailGrid.has(key)) promenadeRailGrid.set(key, []);
        promenadeRailGrid.get(key).push(spot);
      }
    }
    // Part of solid(): the sea railing along the quays stops people on foot.
    function promenadeRailBlocked(x, y, r = 0) {
      // Built with the spots (first asked for by populate(), once the world is
      // built); until then, and while the ladders they make room for are being
      // placed (which tests solid()), there is no railing yet.
      const grid = promenadeRailGrid;
      if (!grid) return false;
      const i0 = Math.floor(x / 128),
        j0 = Math.floor(y / 128);
      for (let i = i0 - 1; i <= i0 + 1; i++)
        for (let j = j0 - 1; j <= j0 + 1; j++) {
          const list = grid.get(i * 4096 + j);
          if (!list) continue;
          for (const spot of list) {
            const { cx, cy, ux, uy } = spot.railLine,
              dx = x - cx,
              dy = y - cy,
              across = -dx * uy + dy * ux;
            if (Math.abs(across) > r + 1) continue;
            const u = dx * ux + dy * uy;
            // A run a vehicle has knocked down (damage.js) leaves the edge open.
            for (let k = 0; k < spot.rail.length; k++)
              if (u > spot.rail[k][0] - r && u < spot.rail[k][1] + r && !spot.railProps?.[k]?.down) return true;
          }
        }
      return false;
    }
    /**
     * FOOT OBSTACLES
     * Things on the pavement that a person walks round: tree trunks, lamp posts,
     * benches, planters, fountains, statues, kiosks, shelters. The renderer
     * registers each piece as it places it (`registerFootObstacle`, a circle when
     * `hy` is omitted, else an oriented box of half extents hx, hy turned by `a`)
     * and `footObstacleBlocked` stops the player on foot against them and against
     * the standing knockable furniture (damage.js). Tree trunks come from the
     * game's own `trees` list.
     */
    const FOOT_CELL = 128,
      footObstacleGrid = new Map();
    let footTreesAdded = false;
    function registerFootObstacle(x, y, hx, hy, a = 0) {
      const o = hy === undefined ? { x, y, r: hx } : { x, y, hx, hy, c: Math.cos(a), s: Math.sin(a) },
        // Filed in every cell within reach of a walker's radius too, so a lookup
        // of the one cell under the walker finds it.
        reach = (hy === undefined ? hx : Math.hypot(hx, hy)) + 6;
      for (let i = Math.floor((x - reach) / FOOT_CELL); i <= Math.floor((x + reach) / FOOT_CELL); i++)
        for (let j = Math.floor((y - reach) / FOOT_CELL); j <= Math.floor((y + reach) / FOOT_CELL); j++) {
          const key = i * 4096 + j;
          if (!footObstacleGrid.has(key)) footObstacleGrid.set(key, []);
          footObstacleGrid.get(key).push(o);
        }
      return o;
    }
    function footObstacleHit(o, x, y, r) {
      const dx = x - o.x,
        dy = y - o.y;
      if (o.r !== undefined) return dx * dx + dy * dy < (o.r + r) * (o.r + r);
      return Math.abs(dx * o.c + dy * o.s) < o.hx + r && Math.abs(-dx * o.s + dy * o.c) < o.hy + r;
    }
    function addFootTrees() {
      if (footTreesAdded || !trees.length) return;
      footTreesAdded = true;
      // A trunk is a couple of units across whatever the crown. A tree the 3D
      // renderer made a breakable prop (t.prop) is already solid to walkers while
      // it stands (below), and not once it has been knocked down.
      for (const t of trees) if (!t.prop) registerFootObstacle(t.x, t.y, 2.2);
    }
    function footObstacleBlocked(x, y, r) {
      addFootTrees();
      const list = footObstacleGrid.get(Math.floor(x / FOOT_CELL) * 4096 + Math.floor(y / FOOT_CELL));
      if (list) for (const o of list) if (footObstacleHit(o, x, y, r)) return true;
      let hit = false;
      propsNear(x, y, r + 10, (prop) => {
        if (hit || prop.down || prop.kind === 'cone') return;
        hit = footObstacleHit({ x: prop.x, y: prop.y, hx: prop.hx, hy: prop.hy, c: Math.cos(prop.a), s: Math.sin(prop.a) }, x, y, r);
      });
      return hit;
    }
    /* Strollers work along the esplanade spot list, so they keep to the walk and
       turn at its ends instead of wandering into the road or the water. */
    function populatePromenade() {
      const spots = promenadeSpots();
      for (let i = 3; i < spots.length; i += 6) {
        if (seededRandom() > 0.5) continue;
        const spot = spots[i];
        if (solid(spot.x, spot.y, 6)) continue;
        pedestrians.push({
          x: spot.x,
          y: spot.y,
          a: spot.a,
          color: randomChoice(DRIVER_COLORS),
          hp: 30,
          flee: 0,
          timer: randomBetween(0, 6),
          walk: 0,
          stroll: {
            index: i,
            dir: seededRandom() > 0.5 ? 1 : -1,
            pause: randomBetween(0, 14),
          },
        });
      }
    }
    function updateStroller(p, deltaSeconds) {
      if (!p.stroll || p.flee > 0 || p.knockedFor || p.ejected) return false;
      const spots = promenadeSpots(),
        stroll = p.stroll;
      stroll.pause -= deltaSeconds;
      if (stroll.pause < -4) stroll.pause = randomBetween(14, 40);
      if (stroll.pause <= 0) {
        // Stopped at the rail to look at the water.
        p.walking = false;
        p.a = Math.atan2(spots[stroll.index]?.ny || 0, spots[stroll.index]?.nx || 1);
        pedSay(p, 'shore', 0.004);
        return true;
      }
      let target = spots[stroll.index];
      if (!target || distanceBetween(p, target) > 150) {
        stroll.dir *= -1;
        stroll.index = clamp(stroll.index + stroll.dir, 0, spots.length - 1);
        target = spots[stroll.index];
        if (!target) return false;
      }
      if (distanceBetween(p, target) < 13) {
        const next = stroll.index + stroll.dir;
        if (next < 0 || next >= spots.length) stroll.dir *= -1;
        else stroll.index = next;
      }
      p.a = headingBetween(p, target);
      p.walking = true;
      const speed = cityTempo().speed * 0.82;
      p.walk += deltaSeconds * strideRate(speed);
      moveBody(p, Math.cos(p.a) * speed * deltaSeconds, Math.sin(p.a) * speed * deltaSeconds, 5);
      pedSay(p, 'shore', 0.0015);
      return true;
    }
    function paintPromenades(drawingContext) {
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      for (const e of coastSegments()) {
        if (e.opening || !PROMENADE_REGIONS.includes(e.region) || esplanadeGivesWay(e)) continue;
        const beach = shoreStyle(e) === 'beach',
          p = esplanadePoint(e),
          half = e.length / 2 + 1;
        if (!groundAt(p.x, p.y, 10)) continue;
        drawingContext.save();
        drawingContext.translate(p.x, p.y);
        // Local +y out to sea (see promenadeYaw).
        drawingContext.rotate(promenadeYaw(p));
        // A cycle strip on the landward side, the walk itself, a band of setts
        // against the buildings and a kerb line at the sea rail.
        drawingContext.fillStyle = beach ? '#bba889' : '#b0ada0';
        drawingContext.fillRect(-half, -ESPLANADE_LANDWARD, e.length + 2, ESPLANADE_LANDWARD + ESPLANADE_SEAWARD);
        drawingContext.fillStyle = beach ? '#a8937a' : '#98a08f';
        drawingContext.fillRect(-half, -ESPLANADE_LANDWARD + 6, e.length + 2, 17);
        drawingContext.fillStyle = beach ? '#c7b591' : '#bdbaad';
        drawingContext.fillRect(-half, -ESPLANADE_LANDWARD, e.length + 2, 6);
        drawingContext.strokeStyle = '#d4ceae';
        drawingContext.lineWidth = 1.2;
        drawingContext.beginPath();
        drawingContext.moveTo(-half, ESPLANADE_SEAWARD - 4);
        drawingContext.lineTo(half, ESPLANADE_SEAWARD - 4);
        drawingContext.stroke();
        drawingContext.strokeStyle = '#9a9a8d';
        drawingContext.lineWidth = 0.8;
        // One path for the segment's ticks: a stroke each was seconds of start-up
        // on the big ground sheet.
        drawingContext.beginPath();
        for (let d = -half; d < half; d += 11) {
          drawingContext.moveTo(d, ESPLANADE_SEAWARD - 14);
          drawingContext.lineTo(d, ESPLANADE_SEAWARD - 4);
        }
        drawingContext.stroke();
        drawingContext.restore();
      }
      drawingContext.restore();
    }
    function paintCountyRoads(g, detail) {
      for (const r of COUNTY_ROADS)
        strokeRoad(g, r.points, r.width + 12, r.bridge ? '#b1b4a9' : '#9eaa92');
      for (const r of COUNTY_ROADS) strokeRoad(g, r.points, r.width, '#414d51');
      if (!detail) return;
      for (const r of COUNTY_ROADS)
        for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1],
            b = r.points[i],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy);
          for (let d = 18; d < len - 12; d += 46) {
            const x = a[0] + (dx * d) / len,
              y = a[1] + (dy * d) / len;
            if (
              COUNTY_ROADS.some(
                (o) =>
                  o !== r &&
                  o.points.some(
                    (p, j) => j && segmentDistance(x, y, o.points[j - 1], p) < o.width / 2 + 22,
                  ),
              )
            )
              continue;
            strokeRoad(
              g,
              [
                [x, y],
                [x + (dx / len) * 22, y + (dy / len) * 22],
              ],
              2,
              '#d7c697',
            );
          }
        }
    }
    function drawPlayerMapMarker(drawingContext, width, height, scale, cx, cy, big) {
      const displayWidth = big ? getElement('bigmap').getBoundingClientRect().width : width,
        size = big ? clamp(width / (displayWidth || width), 1, 2.8) : 1;
      const rawX = width / 2 + (player.x - cx) * scale,
        rawY = height / 2 + (player.y - cy) * scale,
        x = clamp(rawX, 22 * size, width - 22 * size),
        y = clamp(rawY, 28 * size, height - 35 * size),
        off = rawX < 0 || rawX > width || rawY < 0 || rawY > height;
      drawingContext.save();
      drawingContext.translate(x, y);
      drawingContext.scale(size, size);
      drawingContext.fillStyle = '#081f30';
      drawingContext.strokeStyle = '#78f1fa';
      drawingContext.lineWidth = 2;
      drawingContext.beginPath();
      drawingContext.arc(0, 0, big ? 18 : 12, 0, TAU);
      drawingContext.fill();
      drawingContext.stroke();
      if (big) {
        drawingContext.globalAlpha = 0.25;
        drawingContext.lineWidth = 3;
        drawingContext.beginPath();
        drawingContext.arc(0, 0, 23 + Math.sin(gameTime * 3) * 3, 0, TAU);
        drawingContext.stroke();
        drawingContext.globalAlpha = 1;
      }
      drawingContext.rotate(off ? Math.atan2(rawY - y, rawX - x) : (player.car?.a ?? player.a));
      drawingContext.fillStyle = '#fff9da';
      drawingContext.strokeStyle = '#091f2b';
      drawingContext.lineWidth = 2;
      drawingContext.beginPath();
      drawingContext.moveTo(big ? 14 : 9, 0);
      drawingContext.lineTo(big ? -9 : -6, big ? -9 : -6);
      drawingContext.lineTo(big ? -5 : -3, 0);
      drawingContext.lineTo(big ? -9 : -6, big ? 9 : 6);
      drawingContext.closePath();
      drawingContext.fill();
      drawingContext.stroke();
      drawingContext.restore();
      if (big) {
        const label = off ? 'YOU · OFF MAP' : 'YOU ARE HERE',
          lx = clamp(x, 65 * size, width - 65 * size),
          ly = y < height - 70 * size ? y + 37 * size : y - 29 * size;
        drawingContext.save();
        drawingContext.translate(lx, ly);
        drawingContext.scale(size, size);
        drawingContext.fillStyle = '#091f30';
        drawingContext.fillRect(-59, -13, 118, 21);
        drawingContext.textAlign = 'center';
        drawingContext.font = 'bold 13px Arial';
        drawingContext.fillStyle = '#a5faff';
        drawingContext.fillText(label, 0, 2);
        drawingContext.restore();
      }
    }
    function centerMapOnPlayer() {
      mapCenter = {
        x: player.x,
        y: player.y,
      };
      mapZoom = Math.max(2.25, mapZoom);
      drawMap(cityMapContext, 800, 660, true);
    }
    getElement('findMe').onclick = centerMapOnPlayer;
    // END SUBSYSTEM: src/streets.js
