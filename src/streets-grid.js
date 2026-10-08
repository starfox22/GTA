    // City street footprints (cityStreets), street names, Ocean Drive palms, benches, street ends (closed and gate ends) and cityStreetAt.
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
            // North Point Key: only the avenue off the bridge, up to the circle (skyline-islet.js).
            if (northPointKeyStreetClip(x, y, vertical)) return false;
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
      const isleStreet = monarchStreetName(x, y) || northPointKeyStreetName(x, y);
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
          // The avenue on North Point Key runs on into the drop-off circle.
          if (onNorthPointKey(p.x, p.y)) continue;
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
        for (const b of list) if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h && !(solidSkipBelow && jumpedOver(b.height))) return true;
        return false;
      }
      const cell = streetEndGrid.get(Math.floor(x / 256) * 4096 + Math.floor(y / 256));
      if (!cell) return false;
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i];
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h && !(solidSkipBelow && jumpedOver(b.height))) return true;
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
