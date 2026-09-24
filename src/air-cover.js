    // BEGIN SUBSYSTEM: src/air-cover.js — Overhead cover geometry
    /**
     * Overhead cover geometry
     * Source: src/air-cover.js
     * Scope: shared game closure.
     * Shared railway and bridge volumes for sight, bullets, vehicles and aircraft.
     */
    /* Covered routes use actual overhead volumes, separate from ground-level walls. */
    const UNDERPASS = {
      name: 'NORTHBANK UNDERPASS',
      x: 2612,
      y: 2780,
      w: 152,
      h: 320,
      minHeight: 52,
      height: 59,
    };
    const UNDERPASS_PORTALS = [
      {
        x: 2612,
        y: 2775,
        w: 152,
        h: 10,
        minHeight: 40,
        height: 52,
      },
      {
        x: 2612,
        y: 3095,
        w: 152,
        h: 10,
        minHeight: 40,
        height: 52,
      },
    ];
    const UNDERPASS_WALLS = [
      {
        x: 2612,
        y: 2780,
        w: 12,
        h: 320,
        height: 59,
      },
      {
        x: 2752,
        y: 2780,
        w: 12,
        h: 320,
        height: 59,
      },
    ];
    let airCoverCache = null;
    function airCoverVolumes() {
      if (airCoverCache) return airCoverCache;
      const blocks = [...UNDERPASS_WALLS, ...UNDERPASS_PORTALS, UNDERPASS].map((b) => ({
        x: b.x + b.w / 2,
        y: b.y + b.h / 2,
        hx: b.w / 2,
        hy: b.h / 2,
        a: 0,
        minHeight: b.minHeight ?? 0,
        height: b.height,
      }));
      for (const b of BRIDGES)
        blocks.push({
          x: (b.a[0] + b.b[0]) / 2,
          y: (b.a[1] + b.b[1]) / 2,
          hx:
            distanceBetween(
              {
                x: b.a[0],
                y: b.a[1],
              },
              {
                x: b.b[0],
                y: b.b[1],
              },
            ) / 2,
          hy: b.width / 2,
          a: Math.atan2(b.b[1] - b.a[1], b.b[0] - b.a[0]),
          minHeight: -7,
          height: 0.8,
          bridge: true,
        });
      blocks.push(
        ...railPiers.map((p) => ({
          x: p.x + p.w / 2,
          y: p.y + p.h / 2,
          hx: p.w / 2,
          hy: p.h / 2,
          a: 0,
          minHeight: 0,
          height: 52,
        })),
        ...railDecks(),
        ...railStationCovers(),
        ...RAIL_STATIONS.map((s) => {
          const p = railLift(s);
          return {
            ...p,
            hx: 8.5,
            hy: 8.5,
            a: 0,
            minHeight: 0,
            height: 60,
          };
        }),
      );
      // Each block keeps its turn and its map-aligned bounds: sight lines, rounds
      // in flight and boats ask these hundreds of volumes many times a frame, and
      // the bounds reject nearly all of them before any rotation is done.
      for (const b of blocks) {
        b.cos = Math.cos(b.a);
        b.sin = Math.sin(b.a);
        const ex = Math.abs(b.cos) * b.hx + Math.abs(b.sin) * b.hy,
          ey = Math.abs(b.sin) * b.hx + Math.abs(b.cos) * b.hy;
        b.x0 = b.x - ex;
        b.x1 = b.x + ex;
        b.y0 = b.y - ey;
        b.y1 = b.y + ey;
      }
      return (airCoverCache = blocks);
    }
    function coverLocal(b, x, y) {
      // Blocks from airCoverVolumes() carry their turn; others (rail decks) do not.
      const headingCosine = b.cos ?? Math.cos(b.a),
        headingSine = b.sin ?? Math.sin(b.a),
        dx = x - b.x,
        dy = y - b.y;
      return {
        x: dx * headingCosine + dy * headingSine,
        y: -dx * headingSine + dy * headingCosine,
      };
    }
    // Whether a map point lies inside a block's footprint (no allocation).
    function inCoverFootprint(b, x, y) {
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return false;
      const dx = x - b.x,
        dy = y - b.y;
      return Math.abs(dx * b.cos + dy * b.sin) < b.hx && Math.abs(-dx * b.sin + dy * b.cos) < b.hy;
    }
    function underBridgeWater(x, y) {
      if (landAt(x, y)) return false;
      const blocks = airCoverVolumes();
      for (let i = 0; i < blocks.length; i++) if (blocks[i].bridge && inCoverFootprint(blocks[i], x, y)) return true;
      return false;
    }
    function boatSurfaceElevation(c) {
      return underBridgeWater(c.x, c.y) ? -30 : 0;
    }
    function underpassContains(x, y, margin = 0) {
      return x > 2624 + margin && x < 2752 - margin && y > 2780 + margin && y < 3100 - margin;
    }
    function underpassBlocked(x, y, r = 0) {
      return UNDERPASS_WALLS.some(
        (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h,
      );
    }
    // Slab test of the segment a-b (at eye height) against each block, in the
    // block's own frame. Blocks whose bounds miss the segment's are skipped.
    function airCoverRay(a, b) {
      const start = entityElevation(a) + 14,
        end = entityElevation(b) + 14,
        minX = Math.min(a.x, b.x),
        maxX = Math.max(a.x, b.x),
        minY = Math.min(a.y, b.y),
        maxY = Math.max(a.y, b.y),
        lowZ = Math.min(start, end),
        highZ = Math.max(start, end),
        blocks = airCoverVolumes();
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (maxX < block.x0 || minX > block.x1 || maxY < block.y0 || minY > block.y1) continue;
        if (highZ < block.minHeight || lowZ > block.height) continue;
        const ax = a.x - block.x,
          ay = a.y - block.y,
          bx = b.x - block.x,
          by = b.y - block.y,
          px = ax * block.cos + ay * block.sin,
          py = -ax * block.sin + ay * block.cos,
          qx = bx * block.cos + by * block.sin,
          qy = -bx * block.sin + by * block.cos;
        let lo = 0,
          hi = 1,
          hit = true;
        for (let axis = 0; axis < 3; axis++) {
          const pos = axis === 0 ? px : axis === 1 ? py : start,
            delta = axis === 0 ? qx - px : axis === 1 ? qy - py : end - start,
            min = axis === 0 ? -block.hx : axis === 1 ? -block.hy : block.minHeight,
            max = axis === 0 ? block.hx : axis === 1 ? block.hy : block.height;
          if (Math.abs(delta) < 1e-8) {
            if (pos < min || pos > max) {
              hit = false;
              break;
            }
          } else {
            let t1 = (min - pos) / delta,
              t2 = (max - pos) / delta;
            if (t1 > t2) {
              const t = t1;
              t1 = t2;
              t2 = t;
            }
            if (t1 > lo) lo = t1;
            if (t2 < hi) hi = t2;
            if (lo > hi) {
              hit = false;
              break;
            }
          }
        }
        if (hit && hi > 0.0001 && lo < 0.9999) return true;
      }
      return false;
    }
    function airCoverStopsShot(x, y, altitude) {
      const blocks = airCoverVolumes();
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (altitude + 10 < b.minHeight || altitude + 10 > b.height) continue;
        if (inCoverFootprint(b, x, y)) return true;
      }
      return false;
    }
    function addUnderpassColliders() {
      for (const s of RAIL_STATIONS) {
        const p = railLift(s);
        addStatic(p.x - 8.5, p.y - 8.5, 17, 17, 60, 'station lift');
      }
      for (const p of railPiers) addStatic(p.x, p.y, p.w, p.h, p.height, 'rail pier');
      for (const b of [...railDecks(), ...railStationCovers()]) {
        const body = {
          ...b,
          id: 'rail-deck-' + staticBodies.length,
          kind: 'cover',
        };
        staticBodies.push(body);
        const cs = corners(body);
        for (
          let x = Math.floor(Math.min(...cs.map((p) => p.x)) / 256);
          x <= Math.floor(Math.max(...cs.map((p) => p.x)) / 256);
          x++
        )
          for (
            let y = Math.floor(Math.min(...cs.map((p) => p.y)) / 256);
            y <= Math.floor(Math.max(...cs.map((p) => p.y)) / 256);
            y++
          ) {
            // Numeric cell keys, as physics.js uses: with a string key the decks
            // were stored in cells nothing ever looked up, and aircraft flew
            // straight through the viaduct.
            const key = x * 4096 + y;
            if (!staticGrid.has(key)) staticGrid.set(key, []);
            staticGrid.get(key).push(body);
          }
      }
      for (const b of UNDERPASS_WALLS) addStatic(b.x, b.y, b.w, b.h, b.height, 'underpass');
      for (const b of [UNDERPASS, ...UNDERPASS_PORTALS]) {
        addStatic(b.x, b.y, b.w, b.h, b.height, 'cover');
        staticBodies.at(-1).minHeight = b.minHeight;
      }
    }
    function drawUnderpass2D() {
      const p = UNDERPASS;
      if (
        !visible(
          {
            x: 2688,
            y: 2940,
          },
          300,
        )
      )
        return;
      worldContext.save();
      worldContext.fillStyle = '#111d2db8';
      worldContext.fillRect(p.x, p.y, p.w, p.h);
      for (const w of UNDERPASS_WALLS) {
        worldContext.fillStyle = '#9ca49e';
        worldContext.fillRect(w.x, w.y, w.w, w.h);
      }
      for (const y of [p.y, p.y + p.h - 8]) {
        worldContext.fillStyle = '#ceb877';
        worldContext.fillRect(p.x, y, p.w, 8);
      }
      for (let y = p.y + 35; y < p.y + p.h; y += 52) {
        worldContext.fillStyle = '#edcb76';
        worldContext.fillRect(2625, y, 3, 13);
        worldContext.fillRect(2749, y, 3, 13);
      }
      worldContext.textAlign = 'center';
      worldContext.font = 'bold 12px Arial';
      worldContext.fillStyle = '#d9e8cb';
      worldContext.fillText('NORTHBANK UNDERPASS', 2688, 2762);
      worldContext.fillText('AIR COVER', 2688, 3121);
      worldContext.restore();
    }
    function drawAirCoverMap(drawingContext, scale) {
      drawingContext.save();
      drawingContext.strokeStyle = '#7ad9bc';
      drawingContext.lineWidth = 3 / scale;
      drawingContext.setLineDash([5 / scale, 3 / scale]);
      drawingContext.strokeRect(UNDERPASS.x, UNDERPASS.y, UNDERPASS.w, UNDERPASS.h);
      drawingContext.setLineDash([]);
      drawingContext.fillStyle = '#102b2b';
      drawingContext.fillRect(2688 - 9 / scale, 2940 - 9 / scale, 18 / scale, 18 / scale);
      drawingContext.fillStyle = '#a0f6cc';
      drawingContext.font = 'bold ' + 12 / scale + 'px Arial';
      drawingContext.textAlign = 'center';
      drawingContext.fillText('U', 2688, 2940 + 4 / scale);
      drawingContext.restore();
    }
    // END SUBSYSTEM: src/air-cover.js
