    // Trees out of the street camera's line to the 4x4 trails: trailTreeClear() (the one rule every tree placer
    // near a trail asks), the forest trees' size bounds, the thinning beyond the corridor and trailTreeAudit().
    /**
     * TRAIL VIEW CORRIDOR
     * The street camera is orthographic and looks north, down at STREET_PITCH
     * (atan2(680, 560), flight-view3d.js): whatever stands z units up is drawn over
     * the ground STREET_VIEW_SLANT x z north of it. So a tree hides what lies north
     * of its trunk out to the slant of its top, plus its crown's radius either side,
     * and on a slope the ground under each counts too. Everything is compared in the
     * camera's ground plane, (x, y - slant x height):
     *   a tree    (trunk at x, y on ground g, crown radius R, height h) covers the
     *             vertical segment X = x, Y from y - s(g + h) to y - s g, widened by R
     *   a vehicle anywhere on a trail's carriageway, its body TRAIL_VIEW_MARGIN past
     *             the edge and TRAIL_VIEW_VEHICLE tall, covers the trail's centre line
     *             (at the ground under it: terrainHeight) widened by half + margin and
     *             stretched slant x its height north; the turning pads and the summit
     *             platform are discs
     * Of two things drawn at one spot of that plane the higher is nearer the camera,
     * so only the part of a crown above the vehicle's ground can hide it: a tree
     * down the slope north of the trail (the summit's north face) is behind it.
     * And on the map no trunk stands within TRAIL_TREE_SHOULDER of the carriageway or
     * the summit platform, or within TRAIL_TREE_RUNOFF of a hairpin's outer edge,
     * whatever the view (a truck run wide in the mud finds open ground, not a tree).
     * trailTreeClear() is the gap between the two (units; negative: the tree could
     * hide a vehicle). A tree may stand only where the gap is positive, and within
     * TRAIL_TREE_FADE of the corridor the forest thins (trailTreeKeep), so the trail
     * runs through open woodland, not between two walls. Low plants (the meadow grass
     * on the trail edges, vegetation3d-landscape.js) cannot hide a vehicle and stay.
     * Placers that ask it: the Ridgeline forest (terrainFieldScenery) and the plan's
     * trees (planTreeProblem 'trail view': county lowland woods, mountain villages).
     * Drawing and collision read the same lists, so a trunk that stops a vehicle is
     * always a drawn tree (forest-trunks.js).
     */
    const STREET_VIEW_SLANT = 560 / 680,
      // Size 1 of mountainScenery() is 1/21 of a species' modelled size (county3d-forest.js draws them so).
      FOREST_TREE_SCALE = 1 / 21,
      // A truck's body past the carriageway edge (half its width and a little), and its height (2.75 m).
      TRAIL_VIEW_MARGIN = 10,
      TRAIL_VIEW_VEHICLE = 22,
      TRAIL_TREE_FADE = 48,
      // No trunk within this of the carriageway or the summit on the map (2 m of verge), whatever the view;
      // round a hairpin, this beyond its outer edge (12 m of run-off: a truck running wide out of a keyhole).
      TRAIL_TREE_SHOULDER = 16,
      TRAIL_TREE_RUNOFF = 96,
      // The summit platform's level ground round a trail's last sample (terrain-field.js: 44).
      TRAIL_VIEW_SUMMIT = 44,
      TRAIL_VIEW_CELL = 64;
    const forestTreeBoundsOut = { canopy: 0, height: 0 },
      trailTreeStats = { forest: { removed: 0, thinned: 0 } };
    /* The largest crown and height a forest tree of mountainScenery `size` can be drawn
       with (county3d-forest.js forestSpecies and treeVariation: scale up to 1.18, aspect up to
       1.12): conifers pine-sized (a stone pine's 38 on the coast), broadleaf oak-wide and
       birch-tall. Written into `out`. */
    function forestTreeBounds(size, conifer, x, y, out) {
      const s = size * FOREST_TREE_SCALE * 1.18,
        coast = x < 5800 || terrainSeaDistance(x, y) < 260;
      out.canopy = s * 1.12 * (conifer ? (coast ? 38 : 25) : 33);
      out.height = s * 1.054 * (conifer ? 92 : 80);
      return out;
    }
    // A plan tree (crown radius r, vegetation3d-species.js plantTree: scale r / 13) at its largest.
    function planTreeBounds(t, out) {
      const s = ((t.r || 12) / 13) * 1.18;
      out.canopy = s * 1.12 * 38;
      out.height = s * 1.054 * 92;
      return out;
    }
    // A hairpin's outer edge from its centre: a keyhole's loop radius plus the half-width, or its turning pad.
    function trailHairpinReach(trail, hx, hy) {
      const turn = trail.turns && trail.turns.find((u) => u.x === hx && u.y === hy);
      return Math.max(HAIRPIN_PAD, turn ? turn.r + trail.width / 2 : 0);
    }
    let trailViewCache = null;
    // The trails as the camera sees them: segments and discs in the ground plane, cell-indexed.
    function trailViewIndex() {
      if (trailViewCache) return trailViewCache;
      const s = STREET_VIEW_SLANT,
        parts = [],
        // The same on the map: centre line (half-width), pads and summit (radius), for the shoulder.
        flat = [],
        world = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const trail of MOUNTAIN_TRAILS) {
        if (!trail.path) terrainField(terrainFieldAt(trail.points[0][0], trail.points[0][1]));
        const path = trail.path,
          w = trail.width / 2 + TRAIL_VIEW_MARGIN;
        // Each part: its ends in the ground plane, its half-width and the lowest ground under it.
        let pg = terrainHeight(path[0][0], path[0][1]),
          px = path[0][0],
          py = path[0][1] - s * pg;
        for (let i = 1; i < path.length; i++) {
          const g = terrainHeight(path[i][0], path[i][1]),
            x = path[i][0],
            y = path[i][1] - s * g;
          parts.push(px, py, x, y, w, Math.min(g, pg));
          flat.push(path[i - 1][0], path[i - 1][1], x, path[i][1], trail.width / 2 + TRAIL_TREE_SHOULDER);
          px = x;
          py = y;
          pg = g;
        }
        for (const [hx, hy] of trail.hairpins) {
          const g = terrainHeight(hx, hy),
            y = hy - s * g;
          parts.push(hx, y, hx, y, HAIRPIN_PAD + TRAIL_VIEW_MARGIN, g - 4);
          flat.push(hx, hy, hx, hy, trailHairpinReach(trail, hx, hy) + TRAIL_TREE_RUNOFF);
        }
        const [tx, ty] = path[path.length - 1];
        parts.push(tx, ty - s * trail.summit, tx, ty - s * trail.summit, TRAIL_VIEW_SUMMIT + TRAIL_VIEW_MARGIN, trail.summit - 4);
        flat.push(tx, ty, tx, ty, TRAIL_VIEW_SUMMIT + TRAIL_TREE_SHOULDER);
        for (const [x, y] of path) {
          world.x0 = Math.min(world.x0, x);
          world.y0 = Math.min(world.y0, y);
          world.x1 = Math.max(world.x1, x);
          world.y1 = Math.max(world.y1, y);
        }
      }
      const data = new Float64Array(parts),
        n = data.length / 6,
        cells = new Map();
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity,
        maxW = 0;
      for (let e = 0; e < n; e++) {
        const ax = data[e * 6],
          ay = data[e * 6 + 1],
          bx = data[e * 6 + 2],
          by = data[e * 6 + 3];
        maxW = Math.max(maxW, data[e * 6 + 4]);
        x0 = Math.min(x0, ax, bx);
        y0 = Math.min(y0, ay, by);
        x1 = Math.max(x1, ax, bx);
        y1 = Math.max(y1, ay, by);
        for (let i = Math.floor(Math.min(ax, bx) / TRAIL_VIEW_CELL); i <= Math.floor(Math.max(ax, bx) / TRAIL_VIEW_CELL); i++)
          for (let j = Math.floor(Math.min(ay, by) / TRAIL_VIEW_CELL); j <= Math.floor(Math.max(ay, by) / TRAIL_VIEW_CELL); j++) {
            const key = i * 4096 + j;
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key).push(e);
          }
      }
      const shoulder = new Float64Array(flat),
        shoulderCells = new Map();
      for (let e = 0; e < shoulder.length / 5; e++) {
        const o = e * 5,
          r = shoulder[o + 4];
        for (let i = Math.floor((Math.min(shoulder[o], shoulder[o + 2]) - r) / TRAIL_VIEW_CELL); i <= Math.floor((Math.max(shoulder[o], shoulder[o + 2]) + r) / TRAIL_VIEW_CELL); i++)
          for (let j = Math.floor((Math.min(shoulder[o + 1], shoulder[o + 3]) - r) / TRAIL_VIEW_CELL); j <= Math.floor((Math.max(shoulder[o + 1], shoulder[o + 3]) + r) / TRAIL_VIEW_CELL); j++) {
            const key = i * 4096 + j;
            if (!shoulderCells.has(key)) shoulderCells.set(key, []);
            shoulderCells.get(key).push(e);
          }
      }
      // Trees farther than this from every trail sample cannot reach the corridor (a 700-unit
      // margin is over 500 units of tree top above the trail's ground at the camera's slant).
      const margin = 700;
      return (trailViewCache = {
        data,
        n,
        cells,
        seen: new Int32Array(n),
        stamp: 0,
        shoulder,
        shoulderCells,
        maxW,
        x0,
        y0,
        x1,
        y1,
        near: { x0: world.x0 - margin, y0: world.y0 - margin, x1: world.x1 + margin, y1: world.y1 + margin },
      });
    }
    // Whether a point is close enough to a trail for trailTreeClear to matter (a cheap box).
    function trailTreeNear(x, y) {
      const b = trailViewIndex().near;
      return x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
    }
    function trailViewPointSegment(px, py, ax, ay, bx, by) {
      const dx = bx - ax,
        dy = by - ay,
        len2 = dx * dx + dy * dy,
        u = len2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0,
        ex = ax + dx * u - px,
        ey = ay + dy * u - py;
      return Math.sqrt(ex * ex + ey * ey);
    }
    // Closest distance between segments AB and CD (0 where they cross).
    function trailViewSegments(ax, ay, bx, by, cx, cy, dx, dy) {
      const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax),
        d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax),
        d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx),
        d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
      return Math.min(
        trailViewPointSegment(ax, ay, cx, cy, dx, dy),
        trailViewPointSegment(bx, by, cx, cy, dx, dy),
        trailViewPointSegment(cx, cy, ax, ay, bx, by),
        trailViewPointSegment(dx, dy, ax, ay, bx, by),
      );
    }
    /* TRAIL VIEW CORRIDOR (above): how far a tree with its trunk at (x, y) on `ground`,
       a crown `canopy` units in radius and `height` tall, stays clear of covering a
       vehicle anywhere on a 4x4 trail from the street camera. Negative: it could hide
       one; Infinity: nowhere near a trail. */
    function trailTreeClear(x, y, canopy, height, ground = terrainHeight(x, y)) {
      const v = trailViewIndex(),
        s = STREET_VIEW_SLANT,
        crown = ground + height,
        top = y - s * crown,
        // The vehicle's own height stretches it north: the same as the tree's foot reaching south.
        foot = y - s * (ground - TRAIL_VIEW_VEHICLE),
        reach = canopy + v.maxW;
      // The verge first: no trunk this close to where the wheels go, on the map.
      let best = Infinity;
      const near = v.shoulderCells.get(Math.floor(x / TRAIL_VIEW_CELL) * 4096 + Math.floor(y / TRAIL_VIEW_CELL));
      if (near)
        for (let k = 0; k < near.length; k++) {
          const o = near[k] * 5,
            gap = trailViewPointSegment(x, y, v.shoulder[o], v.shoulder[o + 1], v.shoulder[o + 2], v.shoulder[o + 3]) - v.shoulder[o + 4];
          if (gap < best) best = gap;
        }
      if (x + reach < v.x0 || x - reach > v.x1 || foot + reach < v.y0 || top - reach > v.y1) return best;
      const stamp = ++v.stamp,
        data = v.data;
      for (let i = Math.floor((x - reach) / TRAIL_VIEW_CELL); i <= Math.floor((x + reach) / TRAIL_VIEW_CELL); i++)
        for (let j = Math.floor((top - reach) / TRAIL_VIEW_CELL); j <= Math.floor((foot + reach) / TRAIL_VIEW_CELL); j++) {
          const list = v.cells.get(i * 4096 + j);
          if (!list) continue;
          for (let k = 0; k < list.length; k++) {
            const e = list[k];
            if (v.seen[e] === stamp) continue;
            v.seen[e] = stamp;
            const o = e * 6,
              low = data[o + 5];
            // All of the tree below this stretch's ground: behind the vehicle, never over it.
            if (crown <= low) continue;
            const from = ground > low ? foot : y - s * (low - TRAIL_VIEW_VEHICLE),
              gap = trailViewSegments(x, top, x, from, data[o], data[o + 1], data[o + 2], data[o + 3]) - data[o + 4] - canopy;
            if (gap < best) best = gap;
          }
        }
      return best;
    }
    // Keep a tree with this gap? Never inside the corridor; thinning over TRAIL_TREE_FADE beyond it
    // (`roll` 0..1, the placer's own hash). Counted per placer in trailTreeStats.
    function trailTreeKeep(gap, roll, placer) {
      if (gap >= TRAIL_TREE_FADE) return true;
      const stats = trailTreeStats[placer];
      if (gap < 0) {
        stats.removed++;
        return false;
      }
      if (roll < smoothStep(0, TRAIL_TREE_FADE, gap)) return true;
      stats.thinned = (stats.thinned || 0) + 1;
      return false;
    }
    /* DeadEndCity.trailTreeAudit(): an independent check of the corridor. At every sample
       of each trail's path (and each pad and the summit), every forest and plan tree within
       reach is tested point by point: is any part of its crown, top to foot, within the
       vehicle's reach of that sample in the camera's ground plane? `covering` must be 0.
       Also how many trees each placer took out or thinned, and the closest any tree comes. */
    function trailTreeAudit() {
      const s = STREET_VIEW_SLANT,
        bounds = { canopy: 0, height: 0 },
        candidates = [];
      const near = trailViewIndex().near;
      for (const field of TERRAIN_FIELDS) {
        if (field.x1 < near.x0 || field.x0 > near.x1 || field.y1 < near.y0 || field.y0 > near.y1) continue;
        const { conifers, broadleaf } = terrainFieldScenery(field);
        for (const [list, conifer] of [
          [conifers, true],
          [broadleaf, false],
        ])
          for (let k = 0; k < list.length; k += 6) {
            if (!trailTreeNear(list[k], list[k + 1])) continue;
            forestTreeBounds(list[k + 3], conifer, list[k], list[k + 1], bounds);
            candidates.push({ x: list[k], y: list[k + 1], g: list[k + 2], canopy: bounds.canopy, height: bounds.height, kind: 'forest' });
          }
      }
      for (const t of trees)
        if (trailTreeNear(t.x, t.y)) {
          planTreeBounds(t, bounds);
          candidates.push({ x: t.x, y: t.y, g: terrainHeight(t.x, t.y), canopy: bounds.canopy, height: bounds.height, kind: 'plan' });
        }
      const out = { trails: [], candidates: candidates.length, stats: trailTreeStats, planRemoved: prunedPlanTrees['trail view'] || 0, slant: +s.toFixed(3), margin: TRAIL_VIEW_MARGIN, vehicleHeight: TRAIL_VIEW_VEHICLE };
      for (const trail of MOUNTAIN_TRAILS) {
        const half = trail.width / 2 + TRAIL_VIEW_MARGIN,
          spots = trail.path.map(([x, y]) => [x, y, half]);
        for (const [hx, hy] of trail.hairpins) spots.push([hx, hy, HAIRPIN_PAD + TRAIL_VIEW_MARGIN]);
        spots.push([...trail.path[trail.path.length - 1], TRAIL_VIEW_SUMMIT + TRAIL_VIEW_MARGIN]);
        let covering = 0,
          closest = Infinity,
          verge = 0,
          vergeClosest = Infinity;
        const worst = [],
          path = trail.path;
        for (const t of candidates) {
          // On the map: how far the trunk stands past the verge (the carriageway's edge and the
          // shoulder, a hairpin's outer edge and its run-off, the summit platform and the shoulder).
          let edge = Infinity;
          for (let i = 1; i < path.length; i++)
            edge = Math.min(edge, trailViewPointSegment(t.x, t.y, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]) - trail.width / 2 - TRAIL_TREE_SHOULDER);
          for (const [hx, hy] of trail.hairpins) edge = Math.min(edge, Math.hypot(t.x - hx, t.y - hy) - trailHairpinReach(trail, hx, hy) - TRAIL_TREE_RUNOFF);
          const [sx, sy] = path[path.length - 1];
          edge = Math.min(edge, Math.hypot(t.x - sx, t.y - sy) - TRAIL_VIEW_SUMMIT - TRAIL_TREE_SHOULDER);
          if (edge < vergeClosest) vergeClosest = edge;
          if (edge < 0) verge++;
          let gap = Infinity;
          for (const [x, y, w] of spots) {
            if (Math.abs(t.x - x) > t.canopy + w + 1) continue;
            const g = terrainHeight(x, y);
            // A tree wholly below the vehicle's ground is behind it.
            if (t.g + t.height <= g) continue;
            // The vehicle at this spot spans ground to roof; the tree, from whichever is higher of
            // its ground and the vehicle's (the part that is nearer the camera), to its top.
            const vy0 = y - s * g,
              vy1 = y - s * (g + TRAIL_VIEW_VEHICLE),
              ty0 = t.y - s * Math.max(t.g, g),
              ty1 = t.y - s * (t.g + t.height),
              // Vertical overlap of the two spans in the ground plane (0 if they overlap).
              dy = Math.max(0, Math.max(ty1, vy1) - Math.min(ty0, vy0)),
              d = Math.hypot(t.x - x, dy) - w - t.canopy;
            if (d < gap) gap = d;
          }
          if (gap < closest) closest = gap;
          if (gap < 0) {
            covering++;
            if (worst.length < 8) worst.push({ kind: t.kind, x: Math.round(t.x), y: Math.round(t.y), gap: +gap.toFixed(1) });
          }
        }
        out.trails.push({
          name: trail.name,
          samples: spots.length,
          covering,
          closest: Number.isFinite(closest) ? +closest.toFixed(1) : null,
          worst,
          verge,
          vergeClosest: Number.isFinite(vergeClosest) ? +vergeClosest.toFixed(1) : null,
        });
      }
      return out;
    }
