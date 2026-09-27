    // Grading the scenic roads over the range (terrain generation): profiles, the caps and fills they set, the viewpoints' lay-bys and the carriageway carve.
    // Where the viewpoints are (filled by gradeScenicRoads): road, sample, side, lay-by centre and level.
    const SCENIC_VIEWPOINTS = [];
    // Exact 1D squared-distance transform that also returns, per cell, the source cell it measured from.
    function distanceTransformArg(f, n, v, z, d, arg) {
      let k = 0;
      v[0] = 0;
      z[0] = -Infinity;
      z[1] = Infinity;
      for (let q = 1; q < n; q++) {
        let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
          k--;
          s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = Infinity;
      }
      k = 0;
      for (let q = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
        arg[q] = v[k];
      }
    }
    // gridDistance with the index of the nearest masked vertex.
    function gridNearest(mask, cols, rows, cell) {
      const big = 1e12,
        count = cols * rows,
        grid = new Float64Array(count),
        rowOf = new Int32Array(count),
        nearest = new Int32Array(count),
        n = Math.max(cols, rows),
        f = new Float64Array(n),
        d = new Float64Array(n),
        v = new Int32Array(n),
        z = new Float64Array(n + 1),
        arg = new Int32Array(n);
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) f[y] = mask[y * cols + x] ? 0 : big;
        distanceTransformArg(f, rows, v, z, d, arg);
        for (let y = 0; y < rows; y++) {
          grid[y * cols + x] = d[y];
          rowOf[y * cols + x] = arg[y];
        }
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) f[x] = grid[y * cols + x];
        distanceTransformArg(f, cols, v, z, d, arg);
        for (let x = 0; x < cols; x++) {
          grid[y * cols + x] = d[x];
          nearest[y * cols + x] = rowOf[y * cols + arg[x]] * cols + arg[x];
        }
      }
      const distance = new Float32Array(count);
      for (let i = 0; i < count; i++) distance[i] = Math.sqrt(grid[i]) * cell;
      return { distance, nearest };
    }
    // Box blur (radius r cells) along both axes, in place: twice is close to a Gaussian.
    function gridBlur(values, cols, rows, r) {
      const line = new Float64Array(Math.max(cols, rows) + 1);
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) line[x + 1] = line[x] + values[y * cols + x];
          for (let x = 0; x < cols; x++) {
            const a = Math.max(0, x - r),
              b = Math.min(cols - 1, x + r);
            values[y * cols + x] = (line[b + 1] - line[a]) / (b - a + 1);
          }
        }
        for (let x = 0; x < cols; x++) {
          for (let y = 0; y < rows; y++) line[y + 1] = line[y] + values[y * cols + x];
          for (let y = 0; y < rows; y++) {
            const a = Math.max(0, y - r),
              b = Math.min(rows - 1, y + r);
            values[y * cols + x] = (line[b + 1] - line[a]) / (b - a + 1);
          }
        }
      }
    }
    // How smooth a graded road's profile is (the second-difference weight of
    // scenicSmoothingSpline): a length scale of ~(this)^(1/4) samples, ~170 units.
    const SCENIC_PROFILE_SMOOTHING = 3e6;
    /* The smoothest line near `target` (weight 1 per sample) through the pinned
       samples (`pins`, NaN where free): minimises sum (P - target)^2 + lambda *
       sum (P[k-1] - 2 P[k] + P[k+1])^2, a symmetric pentadiagonal system solved
       by banded LDL^T. Pins leave the line as smoothly as the energy allows, so a
       road runs into a town level instead of kinking. */
    function scenicSmoothingSpline(target, pins, lambda) {
      const n = target.length,
        d0 = new Float64Array(n),
        d1 = new Float64Array(n),
        d2 = new Float64Array(n),
        b = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        d0[k] = 1;
        b[k] = target[k];
      }
      for (let j = 1; j < n - 1; j++) {
        d0[j - 1] += lambda;
        d0[j] += 4 * lambda;
        d0[j + 1] += lambda;
        d1[j - 1] -= 2 * lambda;
        d1[j] -= 2 * lambda;
        d2[j - 1] += lambda;
      }
      for (let k = 0; k < n; k++) {
        if (isNaN(pins[k])) continue;
        const v = pins[k];
        if (k >= 2) (b[k - 2] -= d2[k - 2] * v), (d2[k - 2] = 0);
        if (k >= 1) (b[k - 1] -= d1[k - 1] * v), (d1[k - 1] = 0);
        if (k + 1 < n) (b[k + 1] -= d1[k] * v), (d1[k] = 0);
        if (k + 2 < n) (b[k + 2] -= d2[k] * v), (d2[k] = 0);
        d0[k] = 1;
        b[k] = v;
      }
      const D = new Float64Array(n),
        l1 = new Float64Array(n),
        l2 = new Float64Array(n),
        x = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        let dk = d0[k];
        if (k >= 1) dk -= l1[k - 1] * l1[k - 1] * D[k - 1];
        if (k >= 2) dk -= l2[k - 2] * l2[k - 2] * D[k - 2];
        D[k] = dk;
        if (k + 1 < n) l1[k] = (d1[k] - (k >= 1 ? l2[k - 1] * l1[k - 1] * D[k - 1] : 0)) / dk;
        if (k + 2 < n) l2[k] = d2[k] / dk;
      }
      const y = new Float64Array(n);
      for (let k = 0; k < n; k++) y[k] = b[k] - (k >= 1 ? l1[k - 1] * y[k - 1] : 0) - (k >= 2 ? l2[k - 2] * y[k - 2] : 0);
      for (let k = n - 1; k >= 0; k--) x[k] = y[k] / D[k] - (k + 1 < n ? l1[k] * x[k + 1] : 0) - (k + 2 < n ? l2[k] * x[k + 2] : 0);
      return x;
    }
    // Moving average over +-w samples.
    function scenicSmooth(values, w) {
      const n = values.length,
        prefix = new Float64Array(n + 1),
        out = new Float32Array(n);
      for (let k = 0; k < n; k++) prefix[k + 1] = prefix[k] + values[k];
      for (let k = 0; k < n; k++) {
        const a = Math.max(0, k - w),
          b = Math.min(n - 1, k + w);
        out[k] = (prefix[b + 1] - prefix[a]) / (b - a + 1);
      }
      return out;
    }
    /**
     * The graded roads' profiles over this field's relief (after erosion, before
     * the caps), their cross-fall and lay-bys; then the band each lays on the
     * ground and, from it, per vertex: `distance` from the band and `level`, the
     * road's height there, blurred so that two legs at different heights never
     * leave a step where their bands meet. terrain-field.js caps the relief at
     * level + an embankment's rise and fills it up to level - a fill's fall.
     */
    function gradeScenicRoads(field, heights, flatDistance, seaDistance, lakeDistance, land) {
      const roads = SCENIC_ROADS.filter((r) => scenicRoadGraded(r, field));
      if (!roads.length) return null;
      const t0 = performance.now();
      scenicJunctions();
      field.timing.roadJunctions = Math.round(performance.now() - t0);
      const { x0, y0, x1, y1, cols, rows } = field,
        count = cols * rows,
        vertex = (x, y) => clamp(Math.round((y - y0) / TERRAIN_CELL), 0, rows - 1) * cols + clamp(Math.round((x - x0) / TERRAIN_CELL), 0, cols - 1),
        done = [],
        probe = {};
      for (const road of roads) {
        const n = road.n,
          d = road.dense,
          along = road.along,
          anchor = new Float32Array(n).fill(NaN),
          relief = new Float32Array(n),
          roof = new Float32Array(n);
        for (let k = 0; k < n; k++) {
          const x = d[k * 2],
            y = d[k * 2 + 1];
          if (!(x > x0 + 60 && x < x1 - 60 && y > y0 + 60 && y < y1 - 60)) {
            anchor[k] = 0;
            continue;
          }
          const i = vertex(x, y);
          relief[k] = land[i] ? heights[i] : 0;
          // Under the shore's cap near the sea and the reservoir.
          roof[k] = Math.min(2.2 * Math.max(0, seaDistance[i] - road.half - 24), 1.8 * Math.max(0, lakeDistance[i] - road.half - 24));
          // Street level where it meets anything the plan lays flat (towns, bridges, other
          // roads), and only gently above it nearby.
          if (!land[i] || flatDistance[i] < road.half + 10) anchor[k] = 0;
          else roof[k] = Math.min(roof[k], (flatDistance[i] - road.half - 10) * 0.3);
          // An earlier road it joins: that road's surface wherever it crosses its
          // carriageway (the carve blends the two across the rest of the mouth).
          for (const q of done) {
            const hit = scenicRoadNear(x, y, probe, q);
            if (hit && hit.d < q.half - 2) {
              anchor[k] = scenicSurface(q, hit.k, hit.t);
              break;
            }
          }
        }
        // The roof (the shore's and the plan's caps) is read off the grid, so it is
        // ragged: take the least within 12 samples, then its average over the same
        // span (never above the roof it came from), so a road held down by it
        // still runs smooth.
        {
          const least = new Float32Array(n);
          for (let k = 0; k < n; k++) {
            let m = Infinity;
            for (let j = Math.max(0, k - 12); j <= Math.min(n - 1, k + 12); j++) m = Math.min(m, roof[j]);
            least[k] = m;
          }
          const eased = scenicSmooth(least, 12);
          for (let k = 0; k < n; k++) if (isNaN(anchor[k])) roof[k] = Math.min(roof[k], eased[k]);
        }
        if (isNaN(anchor[0])) anchor[0] = 0;
        if (isNaN(anchor[n - 1])) anchor[n - 1] = 0;
        // The target: the relief along the road over ~300 units, a little below it.
        const target = scenicSmooth(relief, 40),
          upper = new Float32Array(n),
          lower = new Float32Array(n),
          P = new Float32Array(n);
        for (let k = 0; k < n; k++) {
          const pinned = !isNaN(anchor[k]);
          upper[k] = pinned ? anchor[k] : roof[k];
          lower[k] = pinned ? anchor[k] : 0;
        }
        // Everything reachable from the anchors at the ruling grade.
        for (let k = 1; k < n; k++) {
          const g = (along[k] - along[k - 1]) * SCENIC_MAX_GRADE;
          upper[k] = Math.min(upper[k], upper[k - 1] + g);
          lower[k] = Math.max(lower[k], lower[k - 1] - g);
        }
        for (let k = n - 2; k >= 0; k--) {
          const g = (along[k + 1] - along[k]) * SCENIC_MAX_GRADE;
          upper[k] = Math.min(upper[k], upper[k + 1] + g);
          lower[k] = Math.max(lower[k], lower[k + 1] - g);
        }
        for (let k = 0; k < n; k++)
          P[k] = lower[k] > upper[k] ? (lower[k] + upper[k]) / 2 : clamp(target[k] - 4, lower[k], upper[k]);
        for (let pass = 0; pass < 2; pass++) {
          for (let k = 1; k < n; k++) {
            const g = (along[k] - along[k - 1]) * SCENIC_MAX_GRADE;
            P[k] = clamp(P[k], P[k - 1] - g, P[k - 1] + g);
          }
          for (let k = n - 2; k >= 0; k--) {
            const g = (along[k + 1] - along[k]) * SCENIC_MAX_GRADE;
            P[k] = clamp(P[k], P[k + 1] - g, P[k + 1] + g);
          }
        }
        // Vertical curves: the smoothest profile near that line through the anchors,
        // kept inside the reachable band (a sample that strays out is pinned to it and
        // the spline solved again).
        const pins = anchor.slice();
        let solved = P;
        for (let round = 0; round < 10; round++) {
          solved = scenicSmoothingSpline(P, pins, SCENIC_PROFILE_SMOOTHING);
          let changed = false;
          for (let k = 0; k < n; k++) {
            if (!isNaN(pins[k])) continue;
            const top = Math.max(lower[k], upper[k]);
            if (solved[k] > top + 0.25) (pins[k] = top), (changed = true);
            else if (solved[k] < lower[k] - 0.25) (pins[k] = lower[k]), (changed = true);
          }
          if (!changed) break;
        }
        for (let k = 0; k < n; k++) P[k] = Math.max(0, solved[k]);
        road.profile.set(P);
        road.anchor = anchor;
        road.relief = target;
        // Cross-fall: superelevation by the curve's radius, run in and out; a crown on the
        // straights; level in junction mouths and where the road is at street level.
        // (Signed, so it passes through level between the two halves of an S-bend.)
        const bend = scenicSmooth(road.curvature, 6),
          bankRaw = new Float32Array(n);
        for (let k = 0; k < n; k++) bankRaw[k] = Math.sign(bend[k]) * SCENIC_MAX_BANK * clamp((Math.abs(bend[k]) - 1 / 3000) / (1 / 700 - 1 / 3000), 0, 1);
        // (Twice: one box leaves a kink at each end of the run-out, a bump under the outer lane.)
        // Run out over ~250 units: the outer edge climbs no faster than about 1%
        // against the centre line (a 2.5% ramp under the outer lane read as a bump).
        const bank = scenicSmooth(scenicSmooth(bankRaw, 32), 32);
        for (let k = 0; k < n; k++) {
          const e = Math.abs(bank[k]),
            inside = -Math.hypot(SCENIC_CROWN, e),
            outside = -SCENIC_CROWN + (e + SCENIC_CROWN) * smoothStep(0, 0.035, e),
            level = (1 - road.junction[k]) * smoothStep(1, 6, P[k]),
            left = bank[k] >= 0;
          road.fall[k * 2] = (left ? inside : outside) * level;
          road.fall[k * 2 + 1] = (left ? outside : inside) * level;
        }
        done.push(road);
      }
      field.timing.roadProfiles = Math.round(performance.now() - t0);
      // Viewpoints: where the view opens widest (the ground beside the road lowest
      // against it) along a raised, gently curving stretch, clear of junctions,
      // towns, trailheads and each other.
      SCENIC_VIEWPOINTS.length = 0;
      const candidates = [];
      for (const road of roads) {
        const n = road.n,
          p = {};
        for (let k = 40; k < n - 40; k += 5) {
          if (road.profile[k] < 16 || road.junction.slice(k - 30, k + 30).some((j) => j > 0) || road.anchor.slice(k - 30, k + 30).some((a) => !isNaN(a))) continue;
          let straight = true;
          for (let j = k - 20; j <= k + 20 && straight; j++) straight = Math.abs(road.curvature[j]) < 1 / 350;
          if (!straight) continue;
          for (const side of [1, -1]) {
            let open = 0;
            for (let j = k - 12; j <= k + 12; j += 4)
              for (const off of [60, 100, 150, 220]) {
                scenicPointAt(road, j, side * (road.half + off), p);
                const i = vertex(p.x, p.y);
                open += clamp(road.profile[j] - (land[i] ? heights[i] : 0), -60, 60);
              }
            candidates.push({ road, k, side, score: open / 28 });
          }
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      for (const c of candidates) {
        if (SCENIC_VIEWPOINTS.length >= 3 || c.score < -15) break;
        const p = scenicPointAt(c.road, c.k, c.side * (c.road.half + SCENIC_BAY.width / 2));
        if (SCENIC_VIEWPOINTS.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < 1200)) continue;
        if (MOUNTAIN_TRAILS.some((t) => Math.hypot(t.points[0][0] - p.x, t.points[0][1] - p.y) < 300)) continue;
        const bay = { k: c.k, side: c.side, width: SCENIC_BAY.width, length: SCENIC_BAY.length, taper: SCENIC_BAY.taper };
        c.road.bays.push(bay);
        SCENIC_VIEWPOINTS.push({ road: c.road, k: c.k, side: c.side, x: p.x, y: p.y, a: p.a, level: c.road.profile[c.k], drop: Math.round(c.score) });
      }
      field.timing.roadViews = Math.round(performance.now() - t0);
      // The band each road lays down (carriageway, shoulders, lay-bys and a margin),
      // with the road's height, and the car park it carries.
      const mask = new Uint8Array(count),
        level = new Float32Array(count),
        gap = new Float32Array(count).fill(Infinity);
      for (const road of roads) {
        const d = road.dense,
          bayAt = scenicBayMask(road);
        for (let k = 0; k < road.n - 1; k++) {
          // (Only a lay-by's stretch reaches further than the carriageway's band.)
          const bay = bayAt[k] || bayAt[k + 1],
            reach = road.half + 26 + (bay ? SCENIC_BAY.width : 0),
            ax = d[k * 2],
            ay = d[k * 2 + 1],
            dx = d[k * 2 + 2] - ax,
            dy = d[k * 2 + 3] - ay,
            len2 = dx * dx + dy * dy || 1,
            c0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - reach - x0) / TERRAIN_CELL)),
            c1 = Math.min(cols - 1, Math.ceil((Math.max(ax, ax + dx) + reach - x0) / TERRAIN_CELL)),
            r0 = Math.max(0, Math.floor((Math.min(ay, ay + dy) - reach - y0) / TERRAIN_CELL)),
            r1 = Math.min(rows - 1, Math.ceil((Math.max(ay, ay + dy) + reach - y0) / TERRAIN_CELL));
          for (let r = r0; r <= r1; r++)
            for (let c = c0; c <= c1; c++) {
              const ex = x0 + c * TERRAIN_CELL - ax,
                ey = y0 + r * TERRAIN_CELL - ay,
                u = clamp((ex * dx + ey * dy) / len2, 0, 1),
                qx = ex - dx * u,
                qy = ey - dy * u,
                d2 = qx * qx + qy * qy;
              if (d2 > reach * reach) continue;
              const dist = Math.sqrt(d2),
                band = road.half + 26 + (bay ? scenicBayWidth(road, k + u, dx * qy - dy * qx >= 0 ? 1 : -1) : 0),
                i = r * cols + c;
              if (dist > band || dist - band >= gap[i]) continue;
              gap[i] = dist - band;
              mask[i] = 1;
              level[i] = road.profile[k] * (1 - u) + road.profile[k + 1] * u;
            }
        }
      }
      const pads = [];
      for (const pad of offroadTerrainPads()) {
        const road = scenicPadRoad(pad, field);
        if (!road) continue;
        const hit = scenicRoadNear(pad.x + pad.w / 2, pad.y + pad.h / 2, {}, road) || { k: 0 },
          lvl = scenicSurface(road, hit.k, 0);
        pads.push({ ...pad, level: lvl });
        for (let r = Math.max(0, Math.floor((pad.y - y0) / TERRAIN_CELL)); r <= Math.min(rows - 1, Math.ceil((pad.y + pad.h - y0) / TERRAIN_CELL)); r++)
          for (let c = Math.max(0, Math.floor((pad.x - x0) / TERRAIN_CELL)); c <= Math.min(cols - 1, Math.ceil((pad.x + pad.w - x0) / TERRAIN_CELL)); c++) {
            mask[r * cols + c] = 1;
            level[r * cols + c] = lvl;
          }
      }
      field.timing.roadBand = Math.round(performance.now() - t0);
      const { distance, nearest } = gridNearest(mask, cols, rows, TERRAIN_CELL),
        base = new Float32Array(count);
      for (let i = 0; i < count; i++) base[i] = level[nearest[i]];
      gridBlur(base, cols, rows, 7);
      // Inside the band the road's own height is exact; the blur only eases it outwards.
      for (let i = 0; i < count; i++) if (mask[i]) base[i] = level[i];
      field.roadDistance = distance;
      field.timing.roadField = Math.round(performance.now() - t0);
      return { roads, distance, level: base, pads };
    }
    // Per sample: whether a lay-by widens the road there (either side).
    function scenicBayMask(road) {
      const mask = new Uint8Array(road.n);
      for (const bay of road.bays) {
        const span = Math.ceil((bay.length / 2 + bay.taper) / SCENIC_SAMPLE) + 1;
        for (let k = Math.max(0, bay.k - span); k <= Math.min(road.n - 1, bay.k + span); k++) mask[k] = 1;
      }
      return mask;
    }
    // How far a fill falls away from the road's level at `distance` from its band: a 42-degree embankment steepening out.
    // Embankment below the shoulder: steepening from 1.1 to a 1.2 face from 25 units
    // out, under the 1.35 a person falls off (falls-body.js FALL_START_GRADE).
    function scenicFillDrop(distance) {
      const face = (d) => Math.max(0, d - 2) * 1.1 + d * d * 0.002;
      return distance <= 25 ? face(distance) : face(25) + (distance - 25) * 1.2;
    }
    /**
     * The carriageway, last of all (after the trails): per vertex, the nearest
     * graded road decides; on the carriageway and shoulders the height is the
     * finished surface exactly, and beyond them a batter eases the ground into
     * it over a width that grows with the height of the cut or fill (about 42
     * degrees). Where two roads' carriageways meet (a junction) the two surfaces
     * are blended by how far inside each the vertex lies, so a car crossing from
     * one to the other finds no crease. The car park pads are held level.
     * `field.roadMask` is 1 on the paved band and fades over the verge.
     */
    function carveScenicRoads(field, heights, grade, land) {
      const { x0, y0, cols, rows } = field,
        count = cols * rows,
        // Nearest and second-nearest road (by distance from its carriageway's edge).
        best = new Float32Array(count).fill(Infinity),
        owner = new Int16Array(count).fill(-1),
        at = new Float32Array(count),
        across = new Float32Array(count),
        best2 = new Float32Array(count).fill(Infinity),
        owner2 = new Int16Array(count).fill(-1),
        at2 = new Float32Array(count),
        across2 = new Float32Array(count),
        mask = new Float32Array(count),
        mouth = new Uint8Array(count),
        roads = grade.roads;
      roads.forEach((road, index) => {
        const d = road.dense,
          bayAt = scenicBayMask(road);
        for (let k = 0; k < road.n - 1; k++) {
          const reach = road.half + (bayAt[k] || bayAt[k + 1] ? SCENIC_BAY.width : 0) + SCENIC_SHOULDER + 80,
            ax = d[k * 2],
            ay = d[k * 2 + 1],
            dx = d[k * 2 + 2] - ax,
            dy = d[k * 2 + 3] - ay,
            len2 = dx * dx + dy * dy || 1,
            c0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - reach - x0) / TERRAIN_CELL)),
            c1 = Math.min(cols - 1, Math.ceil((Math.max(ax, ax + dx) + reach - x0) / TERRAIN_CELL)),
            r0 = Math.max(0, Math.floor((Math.min(ay, ay + dy) - reach - y0) / TERRAIN_CELL)),
            r1 = Math.min(rows - 1, Math.ceil((Math.max(ay, ay + dy) + reach - y0) / TERRAIN_CELL));
          for (let r = r0; r <= r1; r++)
            for (let c = c0; c <= c1; c++) {
              const ex = x0 + c * TERRAIN_CELL - ax,
                ey = y0 + r * TERRAIN_CELL - ay,
                u = clamp((ex * dx + ey * dy) / len2, 0, 1),
                qx = ex - dx * u,
                qy = ey - dy * u,
                d2 = qx * qx + qy * qy;
              if (d2 > reach * reach) continue;
              const dist = Math.sqrt(d2),
                e = dist - road.half,
                i = r * cols + c;
              if (e >= best2[i] && owner[i] !== index) continue;
              const signed = (dx * qy - dy * qx >= 0 ? 1 : -1) * dist;
              if (owner[i] === index) {
                if (e < best[i]) {
                  best[i] = e;
                  at[i] = k + u;
                  across[i] = signed;
                }
              } else if (e < best[i]) {
                best2[i] = best[i];
                owner2[i] = owner[i];
                at2[i] = at[i];
                across2[i] = across[i];
                best[i] = e;
                owner[i] = index;
                at[i] = k + u;
                across[i] = signed;
              } else if (e < best2[i]) {
                best2[i] = e;
                owner2[i] = index;
                at2[i] = k + u;
                across2[i] = signed;
              }
            }
        }
      });
      // A road's surface at an offset, held at its shoulder's edge height beyond it.
      const surface = (road, kf, t) => {
        const side = t >= 0 ? 1 : -1,
          shoulder = road.half + scenicBayWidth(road, kf, side) + SCENIC_SHOULDER;
        return scenicSurface(road, kf, side * Math.min(Math.abs(t), shoulder));
      };
      for (let i = 0; i < count; i++) {
        if (owner[i] < 0 || !land[i]) continue;
        const road = roads[owner[i]],
          kf = at[i],
          t = across[i],
          side = t >= 0 ? 1 : -1,
          out = Math.abs(t),
          shoulder = road.half + scenicBayWidth(road, kf, side) + SCENIC_SHOULDER;
        if (out <= shoulder) {
          let h = scenicSurface(road, kf, t);
          if (owner2[i] >= 0 && best2[i] < SCENIC_SHOULDER + 30) {
            const w = 0.5 * (1 - smoothStep(0, 36, best2[i] - best[i]));
            h += (surface(roads[owner2[i]], at2[i], across2[i]) - h) * w;
            mouth[i] = 1;
          }
          heights[i] = Math.max(0, h);
          mask[i] = 1;
          continue;
        }
        const edge = scenicSurface(road, kf, side * shoulder),
          width = Math.min(80, 3 + Math.abs(heights[i] - edge) * 1.1),
          w = 1 - smoothStep(shoulder, shoulder + width, out);
        if (w > 0) heights[i] += (edge - heights[i]) * w;
        mask[i] = Math.max(mask[i], 1 - smoothStep(shoulder, shoulder + 14, out));
      }
      // Junction mouths: two blended surfaces sampled on the grid leave a ripple;
      // a few passes of smoothing over the mouth (and a cell round it) even it out.
      for (let pass = 0; pass < 4; pass++) {
        const before = heights.slice();
        for (let i = 0; i < count; i++) {
          if (!mouth[i]) continue;
          const c = i % cols,
            r = (i - c) / cols;
          if (!c || !r || c === cols - 1 || r === rows - 1) continue;
          let sum = before[i] * 4,
            weight = 4;
          for (const [dc, dr, w] of [[1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [1, 1, 1], [-1, 1, 1], [1, -1, 1], [-1, -1, 1]]) {
            sum += before[i + dr * cols + dc] * w;
            weight += w;
          }
          heights[i] = sum / weight;
        }
      }
      for (const pad of grade.pads)
        for (let r = Math.max(0, Math.floor((pad.y - y0) / TERRAIN_CELL)); r <= Math.min(rows - 1, Math.ceil((pad.y + pad.h - y0) / TERRAIN_CELL)); r++)
          for (let c = Math.max(0, Math.floor((pad.x - x0) / TERRAIN_CELL)); c <= Math.min(cols - 1, Math.ceil((pad.x + pad.w - x0) / TERRAIN_CELL)); c++) heights[r * cols + c] = pad.level;
      field.roadMask = mask;
    }
