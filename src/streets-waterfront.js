    // Waterfront: shore helpers, esplanade spots (promenadeSpots), sea railing, foot obstacles, strollers and paintPromenades.
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
        northPointKeyEsplanadeGivesWay(e) ||
        inReservedPlot(p.x, p.y, 10) ||
        HELIPADS.some((pad) => Math.abs(p.x - pad.x) < 64 && Math.abs(p.y - pad.y) < 64)
      );
    }
    // Palm Keys: sand on the public beach and down Ocean Drive's open-sea (west)
    // shore; the bay shore facing the city is a quay.
    function shoreStyle(e) {
      const isle = monarchShoreStyle(e) || northPointKeyShoreStyle(e);
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
    // North Point Key's region is pushed last (skyline-islet.js): the others keep their rhythm.
    const PROMENADE_REGIONS = ['northbank', 'palmkeys', 'monarch', 'northpointkey'];
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
        // Where North Point Key's bridge lands, the walk it replaced still counts
        // in the rhythm, so every spot after it keeps its kind (skyline-islet.js).
        const keyLanding = northPointKeyBridgeLanding(e);
        if ((e.opening && !keyLanding) || !PROMENADE_REGIONS.includes(e.region) || esplanadeGivesWay(e)) continue;
        const p = esplanadePoint(e);
        if (!groundAt(p.x, p.y, 10)) continue;
        step++;
        if (keyLanding) continue;
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
