    // Crowd shared state (crowd), bus stops, view culling, sidewalk snapping, sight and building doors.
    const crowd = {
      grid: new Map(),
      gridStamp: -1,
      incidents: [],
      bodies: [],
      indoors: [],
      scenes: [],
      props: [],
      tempo: null,
      hour: 12,
      timers: { stream: 0, bodies: 0, aim: 0, tips: 0, scenes: 0, traffic: 0, near: 0, chat: 0 },
      playerShotAt: -100,
      lastTipAt: -100,
      lastNodAt: -100,
      lastReportAt: -100,
      settledAt: null,
      settleStamp: -100,
      reports: 0,
      honks: 0,
      incidentId: 1,
    };
    // Bus shelters register themselves here when the renderer builds them.
    const BUS_STOPS = [];
    function registerBusStop(x, y) {
      if (BUS_STOPS.some((s) => Math.abs(s.x - x) < 20 && Math.abs(s.y - y) < 20)) return;
      BUS_STOPS.push({ x, y, nextBus: 0 });
    }

    /* Rough camera footprint in map units, used to keep spawning off screen. */
    // Asked for every pedestrian every frame: the footprint is recomputed only
    // when the viewport or the zoom changes, and the same record is returned.
    const crowdView = { w: 0, h: 0, width: -1, height: -1, zoom: -1 };
    function crowdViewHalf() {
      if (crowdView.width !== viewportWidth || crowdView.height !== viewportHeight || crowdView.zoom !== worldZoom) {
        const viewH = clamp(viewportHeight * 0.68, 430, 630) / Math.max(0.2, worldZoom);
        crowdView.w = (viewH * viewportWidth) / viewportHeight / 2 + 40;
        crowdView.h = viewH * 0.75 + 40;
        crowdView.width = viewportWidth;
        crowdView.height = viewportHeight;
        crowdView.zoom = worldZoom;
      }
      return crowdView;
    }
    function crowdInView(x, y, margin = 0) {
      const v = crowdViewHalf();
      return Math.abs(x - cameraTarget.x) < v.w + margin && Math.abs(y - cameraTarget.y) < v.h + margin;
    }
    /* Inside the street grid of the city proper, where sidewalks follow the roads. */
    function inCityGrid(x, y) {
      // Monarch Isle's west shore falls inside the city frame; it has its own people (monarch-life.js).
      return x > CITY_LEFT + 60 && x < CITY_SIZE - 60 && y > CITY_TOP + 60 && y < CITY_SIZE - 60 && !(x > 5300 && y < -380);
    }
    /* Cheap carriageway test: within a road's asphalt on the grid. */
    function crowdOnRoad(x, y) {
      if (!inCityGrid(x, y)) return false;
      const rx = Math.abs(x - roadNear(x)),
        ry = Math.abs(y - rowNear(y)),
        wideX = wideColumn(roadNear(x)),
        wideY = wideRow(rowNear(y));
      return rx < (wideX ? 56 : 44) || ry < (wideY ? 56 : 44);
    }
    /* Sidewalk centre offset from a road's centre line. */
    function sidewalkOffset(road, column) {
      return (column ? wideColumn(road) : wideRow(road)) ? 72 : 67;
    }
    /* Pull a point off the carriageway onto the nearer sidewalk, keeping it on land. */
    function snapToSidewalk(x, y) {
      if (!crowdOnRoad(x, y)) return { x, y };
      const R = roadNear(x),
        C = rowNear(y),
        dx = Math.abs(x - R),
        dy = Math.abs(y - C);
      if (dx < dy) return { x: R + Math.sign(x - R || 1) * sidewalkOffset(R, true), y };
      return { x, y: C + Math.sign(y - C || 1) * sidewalkOffset(C, false) };
    }
    /**
     * LINE OF SIGHT
     * clearSight() walks every building in the city; perception runs it for
     * dozens of people per shot, so this version marches the ray through the
     * building grid instead and only asks the few buildings in each cell.
     */
    function crowdSight(a, b) {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy),
        steps = Math.ceil(d / 16);
      for (let i = 1; i < steps; i++) {
        const t = i / steps,
          x = a.x + dx * t,
          y = a.y + dy * t;
        for (const bld of buildingsNear(x, y))
          if (x > bld.x && x < bld.x + bld.w && y > bld.y && y < bld.y + bld.h && (bld.height || 30) > 12) return false;
      }
      return true;
    }
    /**
     * DOORS
     * A building that fronts a street to the south has a shop door in the middle
     * bay of its shopfront, where the renderer draws it; those are the doors the
     * street scenes use. People ducking inside can also use a door on any other
     * street-facing side: north faces are hidden from the camera and the side
     * faces are seen edge on, so someone walking into one reads as going in.
     * Named businesses use their own door.
     */
    function buildingDoor(b) {
      if (b.crowdDoor !== undefined) return b.crowdDoor;
      b.crowdDoor = null;
      if (b.place || b.depotWall || b.w < 40 || !inCityGrid(b.x, b.y)) return null;
      if (!cityStreetAt(b.x + b.w / 2, b.y + b.h + 44, 10)) return null;
      const bays = Math.max(1, Math.floor((b.w - 16) / 46)),
        bayWidth = (b.w - 16) / bays,
        x = b.x + 8 + bayWidth * (Math.floor(bays / 2) + 0.5),
        y = b.y + b.h + 3;
      if (solid(x, y + 6, 4)) return null;
      b.crowdDoor = { x, y, out: { x, y: y + 16 }, building: b, shop: true };
      return b.crowdDoor;
    }
    function buildingEntrances(b) {
      if (b.crowdEntrances) return b.crowdEntrances;
      const list = [];
      const shop = buildingDoor(b);
      if (shop) list.push(shop);
      if (!b.place && !b.depotWall && b.w >= 30 && b.h >= 30 && inCityGrid(b.x, b.y)) {
        const cx = b.x + b.w / 2,
          cy = b.y + b.h / 2;
        for (const [x, y, ox, oy] of [
          [cx, b.y - 3, 0, -1],
          [b.x - 3, cy, -1, 0],
          [b.x + b.w + 3, cy, 1, 0],
          [cx, b.y + b.h + 3, 0, 1],
        ]) {
          if (oy === 1 && shop) continue;
          const out = { x: x + ox * 16, y: y + oy * 16 };
          if (!cityStreetAt(x + ox * 60, y + oy * 60, 12) || solid(out.x, out.y, 4)) continue;
          list.push({ x, y, out, building: b, shop: false });
        }
      }
      b.crowdEntrances = list;
      return list;
    }
    function doorNear(p, range, shopOnly = false) {
      let best = null,
        bestD = range;
      for (const place of PLACES)
        if (place.door && place.kind !== 'rooftop') {
          const d = distanceBetween(p, place.door);
          if (d < bestD) {
            best = { x: place.door.x, y: place.door.y, out: { x: place.door.x, y: place.door.y + 14 }, place };
            bestD = d;
          }
        }
      const seen = new Set();
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (const b of buildingsNear(p.x + i * range, p.y + j * range)) {
            if (seen.has(b)) continue;
            seen.add(b);
            for (const door of shopOnly ? [buildingDoor(b)] : buildingEntrances(b)) {
              if (!door) continue;
              const d = distanceBetween(p, door);
              if (d < bestD) {
                best = door;
                bestD = d;
              }
            }
          }
      return best;
    }

    /**
     * NEIGHBOUR GRID
     * Rebuilt once a frame for the people near the player. Perception, panic
     * spreading, chats and near misses all ask it "who is around this point".
     */
    const CROWD_CELL = 64;
    function crowdKey(x, y) {
      return Math.floor(x / CROWD_CELL) * 65536 + Math.floor(y / CROWD_CELL);
    }
    const CROWD_GRID_REACH = 1300;
    function buildCrowdGrid() {
      // Cell arrays are reused frame to frame; empty ones are swept now and then.
      const sweep = ++crowd.gridStamp % 120 === 0;
      if (sweep) {
        for (const [k, cell] of crowd.grid) if (!cell.length) crowd.grid.delete(k);
      }
      for (const cell of crowd.grid.values()) cell.length = 0;
      crowd.gridX = player.x;
      crowd.gridY = player.y;
      for (const p of pedestrians) {
        if (p.hp <= 0 || Math.abs(p.x - player.x) > CROWD_GRID_REACH || Math.abs(p.y - player.y) > CROWD_GRID_REACH) continue;
        const k = crowdKey(p.x, p.y);
        let cell = crowd.grid.get(k);
        if (!cell) crowd.grid.set(k, (cell = []));
        cell.push(p);
      }
    }
    /**
     * Visit living pedestrians near a point. Inside the grid's reach this asks
     * only the nearby cells; elsewhere it falls back to the whole list. Traffic
     * uses it to yield to people without scanning every pedestrian per car.
     */
    function forEachPedestrianNear(x, y, r, fn) {
      const reach = CROWD_GRID_REACH - r - 20;
      if (crowd.gridStamp >= 0 && Math.abs(x - crowd.gridX) < reach && Math.abs(y - crowd.gridY) < reach) {
        const x0 = Math.floor((x - r) / CROWD_CELL),
          x1 = Math.floor((x + r) / CROWD_CELL),
          y0 = Math.floor((y - r) / CROWD_CELL),
          y1 = Math.floor((y + r) / CROWD_CELL);
        for (let i = x0; i <= x1; i++)
          for (let j = y0; j <= y1; j++) {
            const cell = crowd.grid.get(i * 65536 + j);
            if (cell) for (let k = 0; k < cell.length; k++) fn(cell[k]);
          }
        return;
      }
      // Far from the player (distant traffic yielding to walkers): a second grid of
      // everyone, dead included as the old full scan was, built at most once a frame.
      const far = crowdFarGrid;
      if (far.stamp !== crowd.gridStamp || far.count !== pedestrians.length) {
        far.stamp = crowd.gridStamp;
        far.count = pedestrians.length;
        const build = ++far.build;
        if (far.cells.size > 4000) far.cells.clear();
        for (let i = 0; i < pedestrians.length; i++) {
          const p = pedestrians[i],
            k = crowdKey(p.x, p.y);
          let cell = far.cells.get(k);
          if (!cell) far.cells.set(k, (cell = []));
          // Reset lazily: a cell with an old build number is empty.
          if (cell.build !== build) {
            cell.build = build;
            cell.length = 0;
          }
          cell.push(p);
        }
      }
      // People move a little between the grid being built and this query: widen it.
      const reachFar = r + 24,
        x0 = Math.floor((x - reachFar) / CROWD_CELL),
        x1 = Math.floor((x + reachFar) / CROWD_CELL),
        y0 = Math.floor((y - reachFar) / CROWD_CELL),
        y1 = Math.floor((y + reachFar) / CROWD_CELL);
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++) {
          const cell = far.cells.get(i * 65536 + j);
          if (cell && cell.build === far.build) for (let k = 0; k < cell.length; k++) fn(cell[k]);
        }
    }
    const crowdFarGrid = { stamp: -1, count: -1, build: 0, cells: new Map() };
    function forPeopleNear(x, y, r, fn) {
      const x0 = Math.floor((x - r) / CROWD_CELL),
        x1 = Math.floor((x + r) / CROWD_CELL),
        y0 = Math.floor((y - r) / CROWD_CELL),
        y1 = Math.floor((y + r) / CROWD_CELL);
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++) {
          const cell = crowd.grid.get(i * 65536 + j);
          if (!cell) continue;
          for (const p of cell) {
            const d = Math.hypot(p.x - x, p.y - y);
            if (d <= r) fn(p, d);
          }
        }
    }
