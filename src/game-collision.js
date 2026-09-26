    /**
     * BUILDING GRID
     * solid() and shotBlocked() run thousands of times per frame (every pedestrian
     * step, bullet and spawn test). Buildings are bucketed into 256-unit cells once
     * after buildWorld() so each query touches a handful of candidates instead of
     * every building in the city. Rebuilt by buildBuildingGrid() when buildings change.
     *
     * solid()'s fourth argument, `overWater`, is what lets the player swim: with it
     * set, open water stops counting as solid while everything else still does. Only
     * moveBody() passes it, and only for the player on foot -- traffic and
     * pedestrians must keep to the land.
     */
    const BUILDING_CELL = 256,
      buildingGrid = new Map(),
      noBuildings = [];
    function buildBuildingGrid() {
      buildingGrid.clear();
      for (const b of buildings) {
        const x0 = Math.floor((b.x - 8) / BUILDING_CELL),
          x1 = Math.floor((b.x + b.w + 8) / BUILDING_CELL),
          y0 = Math.floor((b.y - 8) / BUILDING_CELL),
          y1 = Math.floor((b.y + b.h + 8) / BUILDING_CELL);
        for (let i = x0; i <= x1; i++)
          for (let j = y0; j <= y1; j++) {
            const key = i * 4096 + j;
            let cell = buildingGrid.get(key);
            if (!cell) buildingGrid.set(key, (cell = []));
            cell.push(b);
          }
      }
    }
    /* The tallest roof within reach: an overhead camera gives no depth cue, so the
       flight readout says how much air there is between you and the rooftops. */
    function roofHeightNear(x, y, radius = 280) {
      let top = 0;
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (const b of buildingsNear(x + i * radius, y + j * radius)) {
            if (b.x - radius > x || b.x + b.w + radius < x) continue;
            if (b.y - radius > y || b.y + b.h + radius < y) continue;
            if (b.height > top) top = b.height;
          }
      return top;
    }
    function buildingsNear(x, y) {
      if (!buildingGrid.size) return buildings;
      return buildingGrid.get(Math.floor(x / BUILDING_CELL) * 4096 + Math.floor(y / BUILDING_CELL)) || noBuildings;
    }
    /**
     * RECTANGLE LISTS
     * Many of solid()'s tests are "is this point (grown by r) inside any of these
     * map rectangles": the harbor, marina, garages, airport scenery. The lists are
     * fixed, so each one's overall bounds are worked out once (keyed by the list)
     * and a point outside them answers at once, without walking the list.
     */
    const rectListBounds = new WeakMap();
    function rectListBlocked(list, x, y, r = 0) {
      let bounds = rectListBounds.get(list);
      if (!bounds || bounds.count !== list.length) {
        bounds = { count: list.length, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        for (const b of list) {
          bounds.x0 = Math.min(bounds.x0, b.x);
          bounds.y0 = Math.min(bounds.y0, b.y);
          bounds.x1 = Math.max(bounds.x1, b.x + b.w);
          bounds.y1 = Math.max(bounds.y1, b.y + b.h);
        }
        rectListBounds.set(list, bounds);
      }
      if (x + r <= bounds.x0 || x - r >= bounds.x1 || y + r <= bounds.y0 || y - r >= bounds.y1) return false;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      return false;
    }
    // Whether a point lies inside a rectangle list's overall bounds.
    function rectListNear(list, x, y) {
      let bounds = rectListBounds.get(list);
      if (!bounds || bounds.count !== list.length) {
        rectListBlocked(list, x, y, 0);
        bounds = rectListBounds.get(list);
      }
      return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
    }
    function solid(x, y, r = 8, overWater = false) {
      if (
        sportsBlocked(x, y, r) ||
        railBlocked(x, y, r) ||
        parkPondBlocked(x, y, r) ||
        underpassBlocked(x, y, r) ||
        airportSceneryBlocked(x, y, r) ||
        garageBlocked(x, y, r) ||
        parkBlocked(x, y, r) ||
        monarchBlocked(x, y, r) ||
        marinaBlocked(x, y, r) ||
        beachBlocked(x, y, r) ||
        promenadeRailBlocked(x, y, r) ||
        streetEndBlocked(x, y, r) ||
        beachClubBlocked(x, y, r) ||
        (!overWater && !groundAt(x, y, r)) ||
        (overWater && LINERS.some((ship) => linerHullAt(ship, x, y, r))) ||
        harborBlocked(x, y, r) ||
        depotBlocked(x, y, r) ||
        ((x > CITY_SIZE || y > CITY_SIZE) && (countyBlocked(x, y, r) || militaryBlocked(x, y, r)))
      )
        return true;
      if (r <= 8 || !buildingGrid.size) {
        const candidates = r > 8 ? buildings : buildingsNear(x, y);
        for (const b of candidates)
          if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
        return false;
      }
      // Larger radii can straddle a cell edge: test every grid cell the box
      // touches (pursuit whiskers and spawn checks call this many times a frame;
      // it used to scan the whole city).
      const x0 = Math.floor((x - r - 8) / BUILDING_CELL),
        x1 = Math.floor((x + r + 8) / BUILDING_CELL),
        y0 = Math.floor((y - r - 8) / BUILDING_CELL),
        y1 = Math.floor((y + r + 8) / BUILDING_CELL);
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++) {
          const cell = buildingGrid.get(i * 4096 + j);
          if (cell)
            for (const b of cell)
              if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
        }
      return false;
    }
    /**
     * VEHICLE GRID
     * Every walking person asks, for each short step, whether a vehicle is in
     * the way; that used to test every vehicle in the city (~200) per step. The
     * vehicles are bucketed into 128-unit cells once per simulation frame (and
     * again whenever vehicles are added or removed) and a step only asks the
     * cells around it, with a margin for a car that moves later in the frame.
     */
    const VEHICLE_CELL = 128,
      vehicleGrid = new Map(),
      vehicleGridState = { time: NaN, count: -1, stamp: 0 };
    function refreshVehicleGrid() {
      if (vehicleGridState.time === gameTime && vehicleGridState.count === vehicles.length) return;
      vehicleGridState.time = gameTime;
      vehicleGridState.count = vehicles.length;
      // Cells are reset lazily (stale stamp = empty), never swept.
      const stamp = ++vehicleGridState.stamp;
      if (vehicleGrid.size > 4000) vehicleGrid.clear();
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i],
          key = Math.floor(c.x / VEHICLE_CELL) * 4096 + Math.floor(c.y / VEHICLE_CELL);
        let cell = vehicleGrid.get(key);
        if (!cell) vehicleGrid.set(key, (cell = []));
        if (cell.stamp !== stamp) {
          cell.stamp = stamp;
          cell.length = 0;
        }
        cell.push(c);
      }
    }
    // Whether a vehicle blocks a foot step to (x, y); `reach` bounds the test.
    function footStepVehicleBlocked(x, y, collisionRadius, reach) {
      refreshVehicleGrid();
      const span = reach + 64,
        i0 = Math.floor((x - span) / VEHICLE_CELL),
        i1 = Math.floor((x + span) / VEHICLE_CELL),
        j0 = Math.floor((y - span) / VEHICLE_CELL),
        j1 = Math.floor((y + span) / VEHICLE_CELL);
      for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++) {
          const cell = vehicleGrid.get(i * 4096 + j);
          if (!cell || cell.stamp !== vehicleGridState.stamp) continue;
          for (let k = 0; k < cell.length; k++) {
            const c = cell[k];
            if (c.x - x > reach || x - c.x > reach || c.y - y > reach || y - c.y > reach) continue;
            if ((!isAircraft(c) || aircraftClearance(c) < 20) && pointInCar(x, y, c, collisionRadius)) return true;
          }
        }
      return false;
    }
    function footStepBlocked(body, x, y, collisionRadius, swimmer, onFoot, reach) {
      if (solid(x, y, collisionRadius, swimmer)) return true;
      // Where the player may cross the shoreline (beaches, ladders): water.js.
      if (swimmer && shoreStepBlocked(body.x, body.y, x, y, collisionRadius)) return true;
      if (body.police && harborPoliceProtected(x, y, collisionRadius)) return true;
      // Mission 1: nobody follows the truck into Vinny's sealed warehouse (chase.js).
      if (body.police && depotPoliceBlocked(body, x, y)) return true;
      // Street furniture, tree trunks, park fixtures and shelters stop the
      // player on foot (streets.js); the crowd keeps to its own paths round them.
      if (onFoot && footObstacleBlocked(x, y, 4.5)) return true;
      // Behind the drawbridge's sidewalk arms, and never onto a raised span.
      if (drawbridgeFootBlocked(body, x, y, collisionRadius)) return true;
      return footStepVehicleBlocked(x, y, collisionRadius, reach);
    }
    function moveBody(body, displacementX, displacementY, collisionRadius) {
      if (body === player && player.roof)
        return moveOnRoof(displacementX, displacementY, collisionRadius);
      if (body === player && player.deck)
        return moveOnDeck(displacementX, displacementY, collisionRadius);
      if (body === player && player.buildingRoof)
        return moveOnBuildingRoof(displacementX, displacementY, collisionRadius);
      // In the Marea pool: held inside the water (clubpool.js).
      if (body === player && player.pool) return movePoolSwimmer(displacementX, displacementY);
      let hit = false;
      // Vehicle test: a cheap bounding box rejects almost every vehicle before the
      // rotated point-in-car test (this runs for every pedestrian step each frame).
      // On foot the player may leave the shore: the water is somewhere to be, not
      // a wall. Everyone else is still stopped by it.
      const swimmer =
          body === player && !player.car && !player.roof && !player.deck && !player.parachute,
        reach = 90 + collisionRadius,
        // Out of a car or off a teleport onto a bench, step off it rather than stick.
        onFoot = swimmer && !player.swimming && !footObstacleBlocked(body.x, body.y, 4.5);
      // A long step (a sprint over a slow frame, a car's knock-back of 25 units)
      // is taken in short ones, so it cannot hop over a railing or a guardrail
      // thinner than the step.
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(displacementX), Math.abs(displacementY)) / 5)),
        stepX = displacementX / steps,
        stepY = displacementY / steps;
      for (let i = 0; i < steps; i++) {
        if (!footStepBlocked(body, body.x + stepX, body.y, collisionRadius, swimmer, onFoot, reach)) body.x += stepX;
        else hit = true;
        if (!footStepBlocked(body, body.x, body.y + stepY, collisionRadius, swimmer, onFoot, reach)) body.y += stepY;
        else hit = true;
      }
      return hit;
    }
    function roadNear(v) {
      return ROAD_CENTERS.reduce((a, b) => (Math.abs(a - v) < Math.abs(b - v) ? a : b));
    }
    function rowNear(v) {
      return ROAD_ROWS.reduce((a, b) => (Math.abs(a - v) < Math.abs(b - v) ? a : b));
    }
    function onRoad(x, y) {
      return cityStreetAt(x, y);
    }
