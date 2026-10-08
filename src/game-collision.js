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
    /**
     * LOW THINGS A JUMP CLEARS (player-jump.js)
     * A solid with a `height` (map units; `jumpH` on foot furniture) lower than
     * `solidSkipBelow` and not lower than SOLID_LOW_MIN does not block. It is 0
     * (nothing skipped) except inside the jumping player's own foot step
     * (footSolid / footFurnitureBlocked), so everyone else, vehicles and every
     * other caller see solid() unchanged. Below SOLID_LOW_MIN a solid that stops
     * walkers marks water (a pool's edge, a lily pond), never something to hop.
     * `jumpLow` is the step's state: on while the player jumps or settles after a
     * landing, `clear` the soles' height now.
     */
    const SOLID_LOW_MIN = 3,
      jumpLow = { on: false, clear: 0 };
    let solidSkipBelow = 0;
    function jumpedOver(height) {
      return height < solidSkipBelow && height >= SOLID_LOW_MIN;
    }
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
     * fixed, so each one is indexed once (keyed by the list, rebuilt if its length
     * changes): its overall bounds answer "nowhere near" at once, and a grid of
     * 256-unit cells holds the rectangles each cell touches, so a point inside the
     * bounds asks only the cells under its box instead of walking the list. (The
     * garages' walls sit on every island: their bounds cover the whole world, and
     * the walk over all 72 rectangles cost 3 microseconds and a kilobyte of
     * garbage in every solid() call.) A rectangle that overlaps the box shares a
     * cell with it, so the answer is the same as the walk's.
     */
    const RECT_CELL = 256,
      rectListIndexes = new WeakMap();
    function rectListIndex(list) {
      let index = rectListIndexes.get(list);
      if (index && index.count === list.length) return index;
      index = { count: list.length, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, ci0: 0, cj0: 0, cw: 0, ch: 0, cells: null };
      for (const b of list) {
        index.x0 = Math.min(index.x0, b.x);
        index.y0 = Math.min(index.y0, b.y);
        index.x1 = Math.max(index.x1, b.x + b.w);
        index.y1 = Math.max(index.y1, b.y + b.h);
      }
      if (list.length && index.x0 <= index.x1 && index.y0 <= index.y1 && Number.isFinite(index.x0 + index.x1 + index.y0 + index.y1)) {
        index.ci0 = Math.floor(index.x0 / RECT_CELL);
        index.cj0 = Math.floor(index.y0 / RECT_CELL);
        index.cw = Math.floor(index.x1 / RECT_CELL) - index.ci0 + 1;
        index.ch = Math.floor(index.y1 / RECT_CELL) - index.cj0 + 1;
        if (index.cw * index.ch <= 40000) {
          index.cells = new Array(index.cw * index.ch).fill(null);
          for (const b of list)
            for (let i = Math.floor(b.x / RECT_CELL); i <= Math.floor((b.x + b.w) / RECT_CELL); i++)
              for (let j = Math.floor(b.y / RECT_CELL); j <= Math.floor((b.y + b.h) / RECT_CELL); j++) {
                const at = (i - index.ci0) * index.ch + (j - index.cj0);
                (index.cells[at] ||= []).push(b);
              }
        }
      }
      rectListIndexes.set(list, index);
      return index;
    }
    function rectListBlocked(list, x, y, r = 0) {
      const index = rectListIndex(list);
      if (x + r <= index.x0 || x - r >= index.x1 || y + r <= index.y0 || y - r >= index.y1) return false;
      const cells = index.cells,
        i0 = Math.floor((x - r) / RECT_CELL),
        i1 = Math.floor((x + r) / RECT_CELL),
        j0 = Math.floor((y - r) / RECT_CELL),
        j1 = Math.floor((y + r) / RECT_CELL);
      // A very large box (a spawn test) or a list too sprawling to index: walk the list.
      if (!cells || i1 - i0 > 12 || j1 - j0 > 12) {
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h && !(solidSkipBelow && jumpedOver(b.height))) return true;
        }
        return false;
      }
      for (let i = i0; i <= i1; i++) {
        const ci = i - index.ci0;
        if (ci < 0 || ci >= index.cw) continue;
        for (let j = j0; j <= j1; j++) {
          const cj = j - index.cj0;
          if (cj < 0 || cj >= index.ch) continue;
          const cell = cells[ci * index.ch + cj];
          if (cell === null) continue;
          for (let k = 0; k < cell.length; k++) {
            const b = cell[k];
            if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h && !(solidSkipBelow && jumpedOver(b.height))) return true;
          }
        }
      }
      return false;
    }
    /* CELL MASKS. A grid of lists kept in a Map by cell (`i * 4096 + j`) answers "nothing here" with
       a hash lookup, and a walker's step asked nine of them. cellMask() marks, once per grid, every
       cell within `reach` cells of a filled one in a plain byte array over the filled cells' bounds;
       a query outside the mask or on a clear byte finds nothing in the Map either (an exact filter:
       it only skips lookups). The mask belongs to the grid object it was made from. */
    const cellMasks = new WeakMap();
    function cellMask(grid, reach) {
      let mask = cellMasks.get(grid);
      if (mask && mask.size === grid.size && mask.reach === reach) return mask;
      let i0 = Infinity,
        j0 = Infinity,
        i1 = -Infinity,
        j1 = -Infinity;
      for (const key of grid.keys()) {
        // (|j| stays far under 2048 on this map: the key splits back into its column and row.)
        const i = Math.round(key / 4096),
          j = key - i * 4096;
        i0 = Math.min(i0, i);
        j0 = Math.min(j0, j);
        i1 = Math.max(i1, i);
        j1 = Math.max(j1, j);
      }
      mask = { size: grid.size, reach, i0: i0 - reach, j0: j0 - reach, w: 0, h: 0, bits: null };
      if (i0 <= i1) {
        mask.w = i1 - i0 + 1 + 2 * reach;
        mask.h = j1 - j0 + 1 + 2 * reach;
        mask.bits = new Uint8Array(mask.w * mask.h);
        for (const key of grid.keys()) {
          const i = Math.round(key / 4096),
            j = key - i * 4096;
          for (let a = -reach; a <= reach; a++)
            for (let b = -reach; b <= reach; b++) mask.bits[(i + a - mask.i0) * mask.h + (j + b - mask.j0)] = 1;
        }
      }
      cellMasks.set(grid, mask);
      return mask;
    }
    // Whether a Map cell near (i, j) may hold something (see cellMask).
    function cellMaskHas(mask, i, j) {
      const mi = i - mask.i0,
        mj = j - mask.j0;
      return mi >= 0 && mj >= 0 && mi < mask.w && mj < mask.h && mask.bits[mi * mask.h + mj] === 1;
    }
    // Whether a point lies inside a rectangle list's overall bounds.
    function rectListNear(list, x, y) {
      const index = rectListIndex(list);
      return x >= index.x0 && x <= index.x1 && y >= index.y0 && y <= index.y1;
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
        northPointKeyBlocked(x, y, r) ||
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
     * The cells over the playable map live in a plain array (a step asks nine to
     * sixteen of them: a hash lookup each was a quarter of the test); anything
     * outside it (an aircraft far out to sea) in the Map. Each cell holds `n`
     * vehicles, never emptied with `length = 0`.
     */
    const VEHICLE_CELL = 128,
      VEHICLE_DENSE_I0 = -64,
      VEHICLE_DENSE_J0 = -96,
      VEHICLE_DENSE_W = 160,
      VEHICLE_DENSE_H = 224,
      vehicleDense = new Array(VEHICLE_DENSE_W * VEHICLE_DENSE_H).fill(null),
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
          ci = Math.floor(c.x / VEHICLE_CELL),
          cj = Math.floor(c.y / VEHICLE_CELL);
        let cell;
        if (ci >= VEHICLE_DENSE_I0 && ci < VEHICLE_DENSE_I0 + VEHICLE_DENSE_W && cj >= VEHICLE_DENSE_J0 && cj < VEHICLE_DENSE_J0 + VEHICLE_DENSE_H) {
          const at = (ci - VEHICLE_DENSE_I0) * VEHICLE_DENSE_H + (cj - VEHICLE_DENSE_J0);
          cell = vehicleDense[at];
          if (cell === null) cell = vehicleDense[at] = Object.assign([], { stamp: 0, n: 0 });
        } else {
          const key = ci * 4096 + cj;
          cell = vehicleGrid.get(key);
          if (!cell) vehicleGrid.set(key, (cell = Object.assign([], { stamp: 0, n: 0 })));
        }
        if (cell.stamp !== stamp) {
          cell.stamp = stamp;
          cell.n = 0;
        }
        cell[cell.n++] = c;
      }
    }
    // Whether a vehicle blocks a foot step to (x, y); `reach` bounds the test.
    function footStepVehicleBlocked(x, y, collisionRadius, reach) {
      refreshVehicleGrid();
      const span = reach + 64,
        stamp = vehicleGridState.stamp,
        i0 = Math.floor((x - span) / VEHICLE_CELL),
        i1 = Math.floor((x + span) / VEHICLE_CELL),
        j0 = Math.floor((y - span) / VEHICLE_CELL),
        j1 = Math.floor((y + span) / VEHICLE_CELL);
      for (let i = i0; i <= i1; i++) {
        const inColumns = i >= VEHICLE_DENSE_I0 && i < VEHICLE_DENSE_I0 + VEHICLE_DENSE_W;
        for (let j = j0; j <= j1; j++) {
          const cell =
            inColumns && j >= VEHICLE_DENSE_J0 && j < VEHICLE_DENSE_J0 + VEHICLE_DENSE_H
              ? vehicleDense[(i - VEHICLE_DENSE_I0) * VEHICLE_DENSE_H + (j - VEHICLE_DENSE_J0)]
              : vehicleGrid.get(i * 4096 + j);
          if (!cell || cell.stamp !== stamp) continue;
          for (let k = 0; k < cell.n; k++) {
            const c = cell[k];
            if (c.x - x > reach || x - c.x > reach || c.y - y > reach || y - c.y > reach) continue;
            if ((!isAircraft(c) || aircraftClearance(c) < 20) && pointInCar(x, y, c, collisionRadius)) return true;
          }
        }
      }
      return false;
    }
    /* solid() for a foot step. The jumping (or just landed) player: everything a jump never clears at the body's
       width, then the low things at the legs' width while the feet are not above them; a step that starts inside
       a low thing at the legs' width may leave it (a landing on top slides off). */
    function footSolid(body, x, y, r, swimmer) {
      if (body !== player || !jumpLow.on) return solid(x, y, r, swimmer);
      solidSkipBelow = JUMP_LOW_MAX;
      let hit = solid(x, y, r, swimmer);
      if (!hit) {
        solidSkipBelow = jumpLow.clear;
        hit = solid(x, y, JUMP_BODY_R, swimmer) && !solid(body.x, body.y, JUMP_BODY_R, swimmer);
      }
      solidSkipBelow = 0;
      return hit;
    }
    function footFurnitureBlocked(body, x, y) {
      if (body !== player || !jumpLow.on) return footObstacleBlocked(x, y, 4.5);
      solidSkipBelow = JUMP_LOW_MAX;
      let hit = footObstacleBlocked(x, y, 4.5);
      if (!hit) {
        solidSkipBelow = jumpLow.clear;
        hit = footObstacleBlocked(x, y, JUMP_BODY_R) && !footObstacleBlocked(body.x, body.y, JUMP_BODY_R);
      }
      solidSkipBelow = 0;
      return hit;
    }
    function footStepBlocked(body, x, y, collisionRadius, swimmer, onFoot, reach) {
      if (footSolid(body, x, y, collisionRadius, swimmer)) return true;
      // Where the player may cross the shoreline (beaches, ladders): water.js.
      if (swimmer && shoreStepBlocked(body.x, body.y, x, y, collisionRadius)) return true;
      if (body.police && harborPoliceProtected(x, y, collisionRadius)) return true;
      // Mission 1: nobody follows the truck into Vinny's sealed warehouse (chase.js).
      if (body.police && depotPoliceBlocked(body, x, y)) return true;
      // Street furniture, tree trunks, park fixtures and shelters stop the
      // player on foot (streets.js); the crowd keeps to its own paths round them.
      if (onFoot && footFurnitureBlocked(body, x, y)) return true;
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
    // The entry of the ascending `lines` nearest `v` (a tie goes to the later one, NaN to the
    // last), as `lines.reduce((a, b) => (|a - v| < |b - v| ? a : b))` gave, without its closure:
    // the traffic AI asks this several times per car per physics step. Once an entry past `v`
    // is no nearer than the best, every later one is farther still.
    function nearestLine(lines, v) {
      let best = lines[0];
      for (let i = 1; i < lines.length; i++) {
        const b = lines[i];
        if (Math.abs(best - v) < Math.abs(b - v)) {
          if (b > v) break;
        } else best = b;
      }
      return best;
    }
    function roadNear(v) {
      return nearestLine(ROAD_CENTERS, v);
    }
    function rowNear(v) {
      return nearestLine(ROAD_ROWS, v);
    }
    function onRoad(x, y) {
      return cityStreetAt(x, y);
    }
