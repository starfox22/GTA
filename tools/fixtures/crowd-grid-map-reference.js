// Previous Map-only crowd grid: independent ordered-query reference for the dense lookup audit.
    function buildCrowdGrid() {
      // Cell arrays are reused frame to frame (each holds `n` people; entries past it are
      // stale: `length = 0` would free the backing store and every frame regrow every cell);
      // empty ones are swept now and then.
      const sweep = ++crowd.gridStamp % 120 === 0;
      if (sweep) {
        for (const [k, cell] of crowd.grid) if (!cell.n) crowd.grid.delete(k);
      }
      for (const cell of crowd.grid.values()) cell.n = 0;
      crowd.gridX = player.x;
      crowd.gridY = player.y;
      for (const p of pedestrians) {
        if (p.hp <= 0 || Math.abs(p.x - player.x) > CROWD_GRID_REACH || Math.abs(p.y - player.y) > CROWD_GRID_REACH) continue;
        const k = crowdKey(p.x, p.y);
        let cell = crowd.grid.get(k);
        if (!cell) crowd.grid.set(k, (cell = Object.assign([], { n: 0 })));
        cell[cell.n++] = p;
      }
    }
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
            if (cell) for (let k = 0; k < cell.n; k++) fn(cell[k]);
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
          if (!cell) far.cells.set(k, (cell = Object.assign([], { n: 0, build: 0 })));
          // Reset lazily: a cell with an old build number is empty.
          if (cell.build !== build) {
            cell.build = build;
            cell.n = 0;
          }
          cell[cell.n++] = p;
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
          if (cell && cell.build === far.build) for (let k = 0; k < cell.n; k++) fn(cell[k]);
        }
    }
    function forPeopleNear(x, y, r, fn) {
      const x0 = Math.floor((x - r) / CROWD_CELL),
        x1 = Math.floor((x + r) / CROWD_CELL),
        y0 = Math.floor((y - r) / CROWD_CELL),
        y1 = Math.floor((y + r) / CROWD_CELL);
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++) {
          const cell = crowd.grid.get(i * 65536 + j);
          if (!cell) continue;
          for (let k = 0; k < cell.n; k++) {
            const p = cell[k],
              d = hypot2(p.x - x, p.y - y);
            if (d <= r) fn(p, d);
          }
        }
    }
