    // BEGIN SUBSYSTEM: src/game-console-world.js — DeadEndCity console, world: probe, places, layout, barriers, terrain, weather, airfields, rooftops, drawbridge, route, monarch
    // World and places: map probes and the plan as data (layout, barriers, solidAt), terrain
    // and towns, weather and sky, airfields, rooftops, the drawbridge, GPS routes, Monarch Isle.
    addConsoleMethods('world', {
      // What occupies a map point: land or water, anything solid, road, rail, beach,
      // and whether a car could be parked there. Mission tests use it to check that
      // objectives, spawns and waypoints are not inside buildings or the sea.
      probe(x, y, r = 8) {
        let car = false;
        try {
          car = canSpawnCar('sedan', x, y, 0);
        } catch {}
        return {
          x: Math.round(x),
          y: Math.round(y),
          land: !!landAt(x, y),
          ground: !!groundAt(x, y, r),
          solid: solid(x, y, r),
          rail: railBlocked(x, y, r),
          road: !!onRoad(x, y),
          beach: onBeach(x, y),
          terrain: Math.round(terrainHeight(x, y)),
          carFits: car,
          boatFits: boatFits({ type: 'jetski', x, y, a: 0 }),
          district: districtAt(x, y),
        };
      },
      // The Ridgeline Range (terrain.js): each field's grid, top and build time,
      // each trail's length, summit and steepest graded pitch, scenery counts and
      // the outcrops' footing. Terrain tests read it alongside probe().
      terrain: () => terrainReport(),
      // The mountain villages (mountain-village.js): each town's buildings by kind,
      // its businesses (footprint, eaves and ridge in metres, door), the street
      // dressing, the rescue helipad, the club block and, with WebGL, the
      // renderer's meshes, draw calls and triangles per town.
      mountainTowns: () => mountainVillageReport(),
      // Force the sky: clear, fair, cloudy, overcast, rain, storm. Passing nothing
      // hands the sky back to the weather machine.
      sky(id) {
        if (id === undefined) {
          weather.locked = false;
          return weatherLabel();
        }
        weather.locked = true;
        return setWeather(id);
      },
      // The weather machine's state: sky, next step, rain, wetness, wind, the
      // build-up to a shower (approach), strikes so far and thunder on its way.
      weather: () => weatherReport(),
      // Bring a shower in: overcast now, rain after `seconds` (the machine runs on).
      weatherFront: (seconds) => weatherFront(seconds),
      // Set how wet the streets are (0 dry .. 1 soaked); after rain it dries on
      // from there (weather.js), so a test can look at a drying street at once.
      wetness: (value) => {
        weather.wet = clamp(Number(value) || 0, 0, 1);
        return weatherReport();
      },
      // A lightning strike `distance` map units from the player (thunder follows).
      lightning: (distance = 900) => {
        const s = lightningStrike(distance);
        return { x: Math.round(s.x), y: Math.round(s.y), distance: Math.round(s.distance), thunderIn: +(s.distance / THUNDER_SPEED).toFixed(2) };
      },
      // Runways, their thresholds, lights and PAPI indications, the piers and
      // where every plane is (airfields.js).
      airfields: () => airfieldReport(),
      // Rooftop helipads, the roof the player stands on and the roof under the
      // player's helicopter (rooftops.js); with a map point, that roof and its plant.
      rooftops: (x, y) => ({
        ...(x !== undefined
          ? (() => {
              const b = buildingRoofAt(x, y);
              return {
                roofAt: b
                  ? {
                      x: b.x, y: b.y, w: b.w, h: b.h, height: Math.round(b.height), landable: roofLandable(b), archetype: b.archetype || null,
                      keepOuts: (b.roofKeepOuts || []).map((k) => [Math.round(k.x), Math.round(k.y), Math.round(k.hx * 2), Math.round(k.hy * 2)]),
                    }
                  : null,
              };
            })()
          : {}),
        helipads: roofHelipads.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(p.r), z: Math.round(p.z) })),
        onRoof: player.buildingRoof
          ? { x: player.buildingRoof.x, y: player.buildingRoof.y, height: Math.round(player.buildingRoof.height) }
          : null,
        helicopter:
          player.car?.type === 'helicopter'
            ? {
                altitude: Math.round(player.car.altitude),
                roof: player.car.roofSite ? Math.round(player.car.roofSite.height) : null,
                clearance: Math.round(aircraftClearance(player.car)),
              }
            : null,
      }),
      // The Palm Sound drawbridge (drawbridge.js): 'status', 'open' (start an opening
      // now), 'close' (bring it down, lift the arms), 'hold' with degrees (arms down,
      // leaves held there until 'close'), 'snap' with degrees (leaves there at once).
      drawbridge: (action, degrees) => drawbridgeCommand(action, degrees),
      // Put `count` traffic cars on each approach, heading onto the drawbridge.
      drawbridgeTraffic: (count) => drawbridgeSpawnTraffic(count),
      // Stand at a drawbridge viewpoint ('channel', 'west', 'east', 'north', 'south',
      // 'tower', 'overview', 'pit') at a zoom; returns the point and the bridge's state.
      drawbridgeLook(spot = 'channel', zoom) {
        const p = drawbridgeViewpoint(spot);
        this.look(p.x, p.y, zoom);
        return { x: Math.round(p.x), y: Math.round(p.y), ...drawbridgeReport() };
      },
      // The plan as data, for layout audits: coast, streets, rail, footprints and
      // every static collider in map units. A test renders it as a debug map and
      // checks for overlaps (a road through a helipad, a viaduct over a berth).
      layout: () => ({
        land: LAND_REGIONS.map((r) => ({ id: r.id, polygon: r.polygon })),
        lakes: COUNTY_LAKES.map((r) => r.polygon),
        beach: BEACH,
        peaks: COUNTY_PEAKS.map((p) => ({ x: p.x, y: p.y, r: p.r })),
        streets: cityStreets().map((r) => ({ points: r.points, width: r.width })),
        boulevards: [...BOULEVARDS, ...SERVICE_ROADS].map((r) => ({ name: r.name, points: r.points, width: r.width })),
        countyRoads: COUNTY_ROADS.map((r) => ({ name: r.name, points: r.points, width: r.width, bridge: !!r.bridge })),
        bridges: BRIDGES.map((b) => ({ id: b.id, name: b.name, link: b.link, a: b.a, b: b.b, width: b.width, deck: b.deck, style: b.style, pylons: bridgePylons(b), footings: bridgeFootings(b), channels: bridgeStructure(b).channels.map(([from, to]) => [bridgePoint(b, from), bridgePoint(b, to)]) })),
        reserved: { beachClub: BEACH_CLUB_PLOT, themePark: THEME_PARK_RESERVE },
        rail: RAIL_LINES.map((l) => ({ id: l.id, name: l.name, color: l.color, points: l.points })),
        railDecks: railDecks(),
        railPiers: railPiers.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
        stations: RAIL_STATIONS.map((s) => ({ name: s.name, x: s.x, y: s.y, entry: s.entry, lift: s.lift })),
        buildings: buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, height: Math.round(b.height) })),
        helipads: HELIPADS,
        trees: trees.map((t) => [Math.round(t.x), Math.round(t.y), t.r]),
        lamps: lamps.map((l) => [Math.round(l.x), Math.round(l.y)]),
        benches: benchSpots().map((b) => [Math.round(b.x), Math.round(b.y)]),
        // Knockable street furniture as placed by the renderer (empty in 2D) and
        // the registered foot obstacles (circles r, or boxes hx/hy turned by a).
        props: streetProps.map((p) => ({ kind: p.kind, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, hx: p.hx, hy: p.hy, a: p.a })),
        footObstacles: addFootTrees() || [...new Set([...footObstacleGrid.values()].flat())].map((o) =>
          o.r !== undefined ? { x: o.x, y: o.y, r: o.r } : { x: o.x, y: o.y, hx: o.hx, hy: o.hy, a: Math.atan2(o.s, o.c) },
        ),
        streetEnds: streetEndPlan().map((e) => ({ x: e.p.x, y: e.p.y, a: e.a, width: e.width, kind: e.kind })),
        crosswalks: cityCrosswalks(),
        doors: PLACES.filter((p) => p.door).map((p) => ({ name: p.name, x: p.door.x, y: p.door.y })),
        docks: DOCKS.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, boatX: d.boatX, boatY: d.boatY })),
        parks: CITY_PARKS.map((p) => ({ name: p.name, x: p.x, y: p.y, w: p.w, h: p.h })),
        places: PLACES.filter((p) => p.w).map((p) => ({ name: p.name, x: p.x, y: p.y, w: p.w, h: p.h })),
        ships: [
          { name: 'harbor ship', x: HARBOR.ship.x, y: HARBOR.ship.y, hx: HARBOR.ship.w / 2, hy: HARBOR.ship.l / 2, a: 0 },
          ...LINERS.map((s) => ({ name: s.name, ...shipHull(s) })),
        ],
        marina: MARINA,
        statics: staticBodies
          .filter((b) => b.kind !== 'coast' && b.kind !== 'building')
          .map((b) => ({ x: b.x, y: b.y, hx: b.hx, hy: b.hy, a: b.a, kind: b.kind })),
      }),
      // Monarch Isle: the plan (grid, streets, villas, towers, businesses, marina,
      // garden) and its life (monarch.js, monarch-life.js).
      monarch: () => monarchReport(),
      // Named places the tests can visit: every PLACES entry plus the landmarks.
      places: () => PLACES.map((p) => ({ name: p.name, x: Math.round(p.x), y: Math.round(p.y) })),
      // GPS: set a map waypoint and report the route the navigation graph finds
      // from the player (status, road length, the islands it passes through).
      route(x, y) {
        setWaypoint(x, y);
        let length = 0;
        for (let i = 1; i < userRoute.length; i++) length += distanceBetween(userRoute[i - 1], userRoute[i]);
        return {
          status: routeStatus,
          points: userRoute.length,
          length: Math.round(length),
          bridges: [...new Set(userRoute.map((p) => BRIDGES.find((b) => segmentDistance(p.x, p.y, b.a, b.b) <= b.width / 2)?.id).filter(Boolean))],
          first: userRoute[0] || null,
          last: userRoute.at(-1) || null,
        };
      },
      // Barrier audit (tools/layout-audit.mjs): every visible barrier line as data
      // -- the sea railing runs, the street-end guardrails, gate piers and
      // railings -- and how many foot obstacles are registered.
      barriers() {
        const rails = [];
        for (const spot of promenadeSpots())
          for (const [a, b] of spot.rail || []) {
            const { cx, cy, ux, uy } = spot.railLine;
            rails.push({ x0: cx + ux * a, y0: cy + uy * a, x1: cx + ux * b, y1: cy + uy * b, nx: spot.nx, ny: spot.ny });
          }
        addFootTrees();
        let obstacles = 0;
        for (const list of footObstacleGrid.values()) obstacles += list.length;
        return { rails, streetEnds: streetEndSolids(), streetEndPlan: streetEndPlan(), footObstacleCells: footObstacleGrid.size, footObstacleEntries: obstacles };
      },
      // solid() (and, with `foot`, the player's foot obstacles) at many points at once.
      solidAt(points, r = 1, foot = false) {
        return points.map(([x, y]) => solid(x, y, r) || (foot && footObstacleBlocked(x, y, r)));
      },
    });
    // END SUBSYSTEM: src/game-console-world.js
