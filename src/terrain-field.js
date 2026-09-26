    // Over the depression-filled surface, whose flood order is the drainage order:
    // every catchment reaches the sea or the reservoir. Returns the routing surface too.
    function routedFlow(heights, wet, cols, rows) {
      const { filled, order } = fillDepressions(heights, wet, cols, rows);
      return { routed: filled, area: accumulateFlow(filled, order.reverse(), wet, cols, rows) };
    }
    function generateTerrainField(field) {
      const cols = Math.round((field.x1 - field.x0) / TERRAIN_CELL) + 1,
        rows = Math.round((field.y1 - field.y0) / TERRAIN_CELL) + 1,
        count = cols * rows,
        { x0, y0, seed } = field;
      Object.assign(field, { cols, rows, nx: cols - 1, ny: rows - 1 });
      const started = performance.now(),
        lap = (name) => (field.timing[name] = Math.round(performance.now() - started));
      field.timing = {};
      const land = new Uint8Array(count),
        lake = new Uint8Array(count),
        sea = new Uint8Array(count),
        flat = new Uint8Array(count);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c,
            x = x0 + c * TERRAIN_CELL,
            y = y0 + r * TERRAIN_CELL;
          land[i] = landAt(x, y) ? 1 : 0;
          if (!land[i]) {
            if (COUNTY_LAKES.some((l) => regionContains(l, x, y))) lake[i] = 1;
            else sea[i] = 1;
          }
        }
      // Everything the plan lays on the ground stays at street level.
      for (const road of [...COUNTY_ROADS, ...SERVICE_ROADS]) rasterizePolyline(flat, field, road.points, road.width / 2 + 26);
      for (const line of RAIL_LINES) rasterizePolyline(flat, field, line.route, 40);
      for (const t of COUNTY_TOWNS) rasterizeRect(flat, field, t.x - 90, t.y - 90, BLOCK_SIZE * 2 + 180, BLOCK_SIZE * 2 + 180);
      rasterizePolyline(flat, field, [[FLIGHT.pickup.x, FLIGHT.pickup.y], [FLIGHT.pickup.x, FLIGHT.pickup.y]], 150);
      // Level pads the plan cuts into the hillside (the 4x4 club's lot, offroad.js).
      for (const pad of offroadTerrainPads()) rasterizeRect(flat, field, pad.x, pad.y, pad.w, pad.h);
      lap('masks');
      const flatDistance = gridDistance(flat, cols, rows, TERRAIN_CELL),
        seaDistance = gridDistance(sea, cols, rows, TERRAIN_CELL),
        lakeDistance = gridDistance(lake, cols, rows, TERRAIN_CELL),
        edgeDistance = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const c = i % cols,
          r = (i - c) / cols;
        edgeDistance[i] = Math.min(c, r, cols - 1 - c, rows - 1 - r) * TERRAIN_CELL;
      }
      lap('distances');
      // 1-2. Macro form and relief.
      let heights = new Float32Array(count);
      const ridges = field.kind === 'range' ? rangeRidges(seed) : null,
        peak = field.peak;
      const step = 4,
        coarseCols = Math.ceil((cols - 1) / step) + 1,
        coarseRows = Math.ceil((rows - 1) / step) + 1,
        warpX = new Float32Array(coarseCols * coarseRows),
        warpY = new Float32Array(coarseCols * coarseRows),
        rollingGrid = new Float32Array(coarseCols * coarseRows);
      for (let r = 0; r < coarseRows; r++)
        for (let c = 0; c < coarseCols; c++) {
          const x = x0 + c * step * TERRAIN_CELL,
            y = y0 + r * step * TERRAIN_CELL;
          warpX[r * coarseCols + c] = terrainFbm(x / 900, y / 900, 3, seed + 40) * 190;
          warpY[r * coarseCols + c] = terrainFbm(x / 900 + 7.3, y / 900 - 3.1, 3, seed + 50) * 190;
          rollingGrid[r * coarseCols + c] = terrainFbm(x / 480, y / 480, 2, seed + 300);
        }
      const coarse = (grid, c, r) => {
        const fc = c / step,
          fr = r / step,
          c0 = Math.min(coarseCols - 2, Math.floor(fc)),
          r0 = Math.min(coarseRows - 2, Math.floor(fr)),
          u = fc - c0,
          v = fr - r0,
          i = r0 * coarseCols + c0;
        return (grid[i] * (1 - u) + grid[i + 1] * u) * (1 - v) + (grid[i + coarseCols] * (1 - u) + grid[i + coarseCols + 1] * u) * v;
      };
      const [[needleX0, needleY0], [needleX1, needleY1]] = NEEDLE_SPAN,
        needleDX = needleX1 - needleX0,
        needleDY = needleY1 - needleY0,
        needleLength2 = needleDX * needleDX + needleDY * needleDY;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c,
            x = x0 + c * TERRAIN_CELL,
            y = y0 + r * TERRAIN_CELL,
            // Domain warp: bends the ridges and valleys off straight lines (smooth,
            // so it is read from a coarse grid).
            wx = x + coarse(warpX, c, r),
            wy = y + coarse(warpY, c, r);
          let macro;
          if (ridges) macro = ridgeHeight(ridges, wx, wy);
          else {
            const d = Math.hypot(wx - peak.x, wy - peak.y) / (peak.r * 1.25);
            macro = d < 1 ? peak.h * (1 - d * d) ** 1.6 : 0;
          }
          const scale = macro / 1000,
            ridged = terrainRidged(wx / 620, wy / 620, 5, seed + 100),
            eroded = terrainErodedFbm(wx / 300, wy / 300, 4, seed + 200),
            rolling = coarse(rollingGrid, c, r);
          let h = macro * (0.62 + 0.5 * ridged) + eroded * (60 + 260 * scale) + rolling * 70 + 40;
          if (ridges) {
            // The summit horns stand exactly over the named peaks (the warp moves the
            // crest about; a summit must stay where its trail ends).
            for (let k = 0; k < 2; k++) {
              const p = COUNTY_PEAKS[k],
                d = Math.hypot(x - p.x, y - p.y) / (k ? 320 : 420);
              if (d < 1) h += (k ? 140 : 330) * (1 - d) ** 1.7;
            }
            // Needle Ridge: a row of rock needles along the crest.
            const t = clamp(((x - needleX0) * needleDX + (y - needleY0) * needleDY) / needleLength2, 0, 1),
              k = Math.round(t * 11),
              cx = needleX0 + needleDX * (k / 11) + (terrainHash(k, 1, seed) - 0.5) * 60,
              cy = needleY0 + needleDY * (k / 11) + (terrainHash(k, 2, seed) - 0.5) * 70,
              radius = 55 + terrainHash(k, 3, seed) * 45,
              d = Math.hypot(x - cx, y - cy) / radius;
            if (d < 1 && Math.hypot(cx - COUNTY_PEAKS[1].x, cy - COUNTY_PEAKS[1].y) > 90)
              h += (150 + terrainHash(k, 4, seed) * 230) * (1 - d) ** 1.35 * (0.85 + 0.3 * terrainNoise(x / 25, y / 25, seed + 5));
          }
          heights[i] = h;
        }
      lap('relief');
      // 3. Erosion: stream-power incision, strata, thermal settling.
      const wet = new Uint8Array(count);
      for (let i = 0; i < count; i++) wet[i] = land[i] ? 0 : 1;
      for (let pass = 0; pass < 2; pass++) {
        const area = flowAccumulation(heights, wet, cols, rows),
          next = new Float32Array(heights);
        for (let r = 1; r < rows - 1; r++)
          for (let c = 1; c < cols - 1; c++) {
            const i = r * cols + c;
            if (wet[i]) continue;
            const gx = (heights[i + 1] - heights[i - 1]) / (2 * TERRAIN_CELL),
              gy = (heights[i + cols] - heights[i - cols]) / (2 * TERRAIN_CELL),
              slope = Math.min(Math.hypot(gx, gy), 1.5);
            next[i] -= Math.min(1.25 * Math.sqrt(area[i]) * slope, 36);
          }
        heights = next;
      }
      for (let i = 0; i < count; i++) {
        // Strata: steep ground steps into ledges 34 units apart.
        const c = i % cols,
          r = (i - c) / cols;
        if (!c || !r || c === cols - 1 || r === rows - 1) continue;
        const gx = (heights[i + 1] - heights[i - 1]) / (2 * TERRAIN_CELL),
          gy = (heights[i + cols] - heights[i - cols]) / (2 * TERRAIN_CELL),
          steep = smoothStep(0.8, 1.4, Math.hypot(gx, gy)),
          band = heights[i] / 34,
          f = band - Math.floor(band),
          terrace = (Math.floor(band) + smoothStep(0.55, 1, f)) * 34;
        heights[i] += (terrace - heights[i]) * steep * 0.22;
      }
      const talus = 1.25 * TERRAIN_CELL;
      for (let pass = 0; pass < 6; pass++)
        for (let r = 1; r < rows - 1; r++)
          for (let c = 1; c < cols - 1; c++) {
            const i = r * cols + c;
            for (let j = 0; j < 4; j++) {
              const n = i + D8[j][0] + D8[j][1] * cols,
                diff = heights[i] - heights[n];
              if (diff > talus) {
                const move = (diff - talus) * 0.25;
                heights[i] -= move;
                heights[n] += move;
              }
            }
          }
      lap('erosion');
      // 4. The plan's caps: embankments, shores, sea cliffs, the field's edge.
      for (let i = 0; i < count; i++) {
        const c = i % cols,
          r = (i - c) / cols,
          // The distances are bent by noise away from the feature itself, and the
          // steepness wanders, so valley sides and shores are never planes or rings.
          bend = terrainFbm(c / 21, r / 21, 3, seed + 11) * 110,
          wander = 0.72 + 0.56 * (terrainNoise(c / 27, r / 27, seed + 9) * 0.5 + 0.5),
          fd = Math.max(0, flatDistance[i] - 6),
          sd = Math.max(0, seaDistance[i] - 16),
          ld = Math.max(0, lakeDistance[i] - 14),
          ed = Math.max(0, edgeDistance[i] - 20),
          fb = Math.max(0, fd + bend * smoothStep(0, 160, fd)),
          sb = Math.max(0, sd + bend * smoothStep(60, 200, sd)),
          lb = Math.max(0, ld + bend * smoothStep(0, 160, ld)),
          cap = Math.min(
            (fb * 0.4 + fb * fb * 0.0009) * wander,
            sd < 70 ? sd * 2.6 : 182 + (sb - 70) * 1.7 * wander,
            (lb * 0.36 + lb * lb * 0.0006) * wander,
            ed * 0.5 + ed * ed * 0.001,
          );
        heights[i] = land[i] ? Math.max(0, smoothMin(heights[i], cap, 60)) : 0;
      }
      // 5. Trails: graded, cut and filled, with a level platform at the top.
      const trailMask = new Float32Array(count),
        // Per vertex: distance to the nearest carriageway, its path sample and trail (+1), for the mud (offroad.js).
        trailNear = new Float32Array(count).fill(1e9),
        trailSegment = new Int16Array(count).fill(-1),
        trailOwner = new Uint8Array(count);
      for (const [trailIndex, trail] of MOUNTAIN_TRAILS.entries()) {
        const { points } = trail;
        if (points.every(([x, y]) => x < x0 || x > field.x1 || y < y0 || y > field.y1)) continue;
        // Resample every ~12 units, read the relief under it, smooth, then grade.
        const path = [];
        for (let i = 1; i < points.length; i++) {
          const [ax, ay] = points[i - 1],
            [bx, by] = points[i],
            n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 12));
          for (let k = i === 1 ? 0 : 1; k <= n; k++) path.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
        }
        const along = [0];
        for (let i = 1; i < path.length; i++) along.push(along[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
        const read = (x, y) => {
          const c = clamp(Math.round((x - x0) / TERRAIN_CELL), 0, cols - 1),
            r = clamp(Math.round((y - y0) / TERRAIN_CELL), 0, rows - 1);
          return heights[r * cols + c];
        };
        let profile = path.map(([x, y]) => read(x, y));
        // Moving average over ~250 units of trail.
        const smoothed = profile.map((_, i) => {
          let sum = 0,
            n = 0;
          for (let j = Math.max(0, i - 10); j <= Math.min(profile.length - 1, i + 10); j++) {
            sum += profile[j];
            n++;
          }
          return sum / n;
        });
        trail.natural = smoothed.slice();
        // Two ends are fixed: street level at the trailhead and the summit (as high as
        // the grade allows). Between them the trail follows the relief, held inside
        // the band it can climb from the one and still reach the other.
        const total = along.at(-1),
          end = Math.min(smoothed.at(-1) + 60, (total - 50) * TRAIL_MAX_GRADE * 0.97);
        profile = smoothed.map((h, i) =>
          clamp(h, Math.max(0, end - (total - along[i]) * TRAIL_MAX_GRADE), along[i] * TRAIL_MAX_GRADE),
        );
        profile[0] = 0;
        // The last stretch is level: it runs onto the summit platform.
        const levelFrom = profile.findIndex((_, i) => along[i] >= total - 50);
        for (let i = levelFrom; i < profile.length; i++) profile[i] = end;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 1; i < levelFrom; i++) {
            const g = (along[i] - along[i - 1]) * TRAIL_MAX_GRADE;
            profile[i] = clamp(profile[i], profile[i - 1] - g, profile[i - 1] + g);
          }
          for (let i = levelFrom - 1; i > 0; i--) {
            const g = (along[i + 1] - along[i]) * TRAIL_MAX_GRADE;
            profile[i] = clamp(profile[i], profile[i + 1] - g, profile[i + 1] + g);
          }
        }
        trail.path = path;
        trail.profile = profile;
        trail.summit = profile.at(-1);
        // Carve: flat across the carriageway, easing into the slope over the shoulders.
        // The shoulders widen with the depth of the cut or the height of the fill,
        // so a cutting's walls and an embankment's sides stand at about 42 degrees.
        // Between two legs of the zigzag the ground is a ramp from the edge of one
        // carriageway to the edge of the other (so the nearest-leg choice never
        // leaves a wall along the line where it switches); elsewhere the shoulders
        // widen with the depth of the cut or the height of the fill, so a cutting's
        // walls and an embankment's sides stand at about 42 degrees.
        const half = trail.width / 2,
          reach = half + 150,
          target = new Float32Array(count),
          nearest = new Float32Array(count).fill(1e9),
          nearestSegment = new Int32Array(count),
          other = new Float32Array(count).fill(1e9),
          otherTarget = new Float32Array(count),
          top = path.at(-1);
        let cMin = cols,
          cMax = 0,
          rMin = rows,
          rMax = 0;
        for (let s = 1; s < path.length; s++) {
          const a = path[s - 1],
            b = path[s],
            c0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - reach - x0) / TERRAIN_CELL)),
            c1 = Math.min(cols - 1, Math.ceil((Math.max(a[0], b[0]) + reach - x0) / TERRAIN_CELL)),
            r0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - reach - y0) / TERRAIN_CELL)),
            r1 = Math.min(rows - 1, Math.ceil((Math.max(a[1], b[1]) + reach - y0) / TERRAIN_CELL)),
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            len2 = dx * dx + dy * dy || 1;
          cMin = Math.min(cMin, c0);
          cMax = Math.max(cMax, c1);
          rMin = Math.min(rMin, r0);
          rMax = Math.max(rMax, r1);
          for (let r = r0; r <= r1; r++)
            for (let c = c0; c <= c1; c++) {
              const ex = x0 + c * TERRAIN_CELL - a[0],
                ey = y0 + r * TERRAIN_CELL - a[1],
                u = clamp((ex * dx + ey * dy) / len2, 0, 1),
                qx = ex - dx * u,
                qy = ey - dy * u,
                d2 = qx * qx + qy * qy,
                i = r * cols + c,
                h = profile[s - 1] + (profile[s] - profile[s - 1]) * u;
              if (d2 < nearest[i]) {
                // The old nearest becomes the other leg if it was far along the trail.
                if (Math.abs(nearestSegment[i] - s) > 16 && nearest[i] < other[i]) {
                  other[i] = nearest[i];
                  otherTarget[i] = target[i];
                }
                nearest[i] = d2;
                nearestSegment[i] = s;
                target[i] = h;
              } else if (d2 < other[i] && Math.abs(nearestSegment[i] - s) > 16) {
                other[i] = d2;
                otherTarget[i] = h;
              }
            }
        }
        for (let r = rMin; r <= rMax; r++)
          for (let c = cMin; c <= cMax; c++) {
            const i = r * cols + c;
            if (!land[i]) continue;
            // A turning pad counts as carriageway out to HAIRPIN_PAD.
            const px = x0 + c * TERRAIN_CELL,
              py = y0 + r * TERRAIN_CELL;
            let padReach = Infinity;
            for (const [hx, hy] of trail.hairpins) padReach = Math.min(padReach, Math.hypot(px - hx, py - hy) - (HAIRPIN_PAD - half));
            const near = Math.min(Math.sqrt(nearest[i]), Math.max(0, padReach)),
              far = Math.sqrt(other[i]),
              platform = Math.hypot(x0 + c * TERRAIN_CELL - top[0], y0 + r * TERRAIN_CELL - top[1]);
            if (near < reach && near < trailNear[i]) {
              trailNear[i] = near;
              trailSegment[i] = nearestSegment[i];
              trailOwner[i] = trailIndex + 1;
            }
            let goal = target[i],
              w = 0;
            if (near > half && near < reach && far < reach) {
              // Ramp across the gap between the two carriageways.
              const u = clamp((near - half) / Math.max(1, near + far - 2 * half), 0, 0.5);
              goal = target[i] + (otherTarget[i] - target[i]) * u;
              w = 1 - smoothStep(reach * 0.7, reach, far);
            }
            // The summit platform, but only for ground the trail's last stretch
            // reaches (a lower leg passing close by keeps its own grade).
            if (platform < 60 && (near > half + 4 || nearestSegment[i] > path.length - 14)) {
              const p = 1 - smoothStep(40, 60, platform);
              goal = goal + (trail.summit - goal) * p;
              w = Math.max(w, p);
            }
            if (near >= reach && w === 0) continue;
            const shoulder = Math.min(reach, half + 24 + Math.abs(heights[i] - goal) * 1.1);
            w = Math.max(w, 1 - smoothStep(half + 4, shoulder, near));
            if (w > 0) {
              heights[i] += (goal - heights[i]) * w;
              trailMask[i] = Math.max(trailMask[i], 1 - smoothStep(half - 6, half + 6, near), platform < 44 && w > 0.9 ? 1 : 0);
            }
          }
      }
      // Mud, rock and the trail's own frame per vertex (offroad.js).
      offroadTrailBake(field, heights, trailNear, trailSegment, trailOwner);
      lap('trails');
      // The surface: exact Float32 vertices; a triangle exists where all three
      // corners are land and one is above street level.
      field.heights = heights;
      field.land = land;
      field.trailMask = trailMask;
      field.lakeDistance = lakeDistance;
      field.flatDistance = flatDistance;
      const triangles = new Uint8Array(field.nx * field.ny * 2);
      for (let r = 0; r < field.ny; r++)
        for (let c = 0; c < field.nx; c++) {
          const a = r * cols + c,
            b = a + cols,
            cc = b + 1,
            d = a + 1;
          if (land[a] && land[b] && land[d] && (heights[a] > 0.001 || heights[b] > 0.001 || heights[d] > 0.001))
            triangles[(r * field.nx + c) * 2] = 1;
          if (land[b] && land[cc] && land[d] && (heights[b] > 0.001 || heights[cc] > 0.001 || heights[d] > 0.001))
            triangles[(r * field.nx + c) * 2 + 1] = 1;
        }
      field.triangles = triangles;
      field.maxHeight = heights.reduce((m, h) => Math.max(m, h), 0);
      // Water that gathers in the ravines (final surface), for streams, gullies and snow.
      const { routed, area: flow } = routedFlow(heights, wet, cols, rows);
      field.area = flow;
      field.routed = routed;
      field.flow = new Float32Array(count);
      for (let i = 0; i < count; i++) field.flow[i] = clamp(Math.log2(1 + flow[i]) / 11, 0, 1);
      lap('total');
      field.ready = true;
      return field;
    }
    function terrainField(field) {
      return field.ready ? field : generateTerrainField(field);
    }
    // Height on a field's triangles: the same corners and diagonal the mesh draws.
    function sampleTerrainField(field, x, y) {
      const { x0, y0, nx, ny, cols, heights, triangles } = terrainField(field),
        lx = (x - x0) / TERRAIN_CELL,
        lz = (y - y0) / TERRAIN_CELL;
      if (lx < 0 || lz < 0 || lx > nx || lz > ny) return 0;
      const ix = Math.min(nx - 1, Math.floor(lx)),
        iz = Math.min(ny - 1, Math.floor(lz)),
        u = lx - ix,
        v = lz - iz,
        side = u + v <= 1 ? 0 : 1;
      if (!triangles[(iz * nx + ix) * 2 + side]) return 0;
      const a = iz * cols + ix,
        h00 = heights[a],
        h10 = heights[a + 1],
        h01 = heights[a + cols],
        h11 = heights[a + cols + 1];
      return side === 0 ? h00 * (1 - u - v) + h10 * u + h01 * v : h11 * (u + v - 1) + h01 * (1 - u) + h10 * (1 - v);
    }
    // The field a point is in (fields never overlap), or null for the city and the sea.
    function terrainFieldAt(x, y) {
      for (const f of TERRAIN_FIELDS) if (x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1) return f;
      return null;
    }
    function terrainHeight(x, y) {
      const f = terrainFieldAt(x, y);
      return f ? sampleTerrainField(f, x, y) : 0;
    }
    // The named summit a point on the range belongs to (for the SUMMIT REACHED call).
    function mountainAt(x, y) {
      if (!terrainFieldAt(x, y)) return undefined;
      let best;
      for (const p of COUNTY_PEAKS)
        if (Math.hypot(x - p.x, y - p.y) < p.r && (!best || Math.hypot(x - p.x, y - p.y) < Math.hypot(x - best.x, y - best.y))) best = p;
      return best;
    }
    function terrainSlope(x, y) {
      return {
        x: (terrainHeight(x + 3, y) - terrainHeight(x - 3, y)) / 6,
        y: (terrainHeight(x, y + 3) - terrainHeight(x, y - 3)) / 6,
      };
    }
    function onMountainTrail(x, y) {
      return MOUNTAIN_TRAILS.some(
        (t) =>
          t.points.some((p, i) => i && segmentDistance(x, y, t.points[i - 1], p) < t.width / 2) ||
          t.hairpins.some(([hx, hy]) => Math.hypot(x - hx, y - hy) < HAIRPIN_PAD),
      );
    }
    /* The ground under a road vehicle on the range (null off it): height, the
       gradient, its components along and across the heading, whether it is on a
       trail. One record per vehicle, rewritten each call (this runs every physics
       step); the traction itself is offroadDrive (offroad.js). */
    function roadVehicleTerrain(vehicle) {
      const z = terrainHeight(vehicle.x, vehicle.y);
      if (z < 0.2 && !mountainAt(vehicle.x, vehicle.y)) return null;
      const t = vehicle.terrainRecord || (vehicle.terrainRecord = { z: 0, slope: { x: 0, y: 0 }, along: 0, cross: 0, trail: false, four: false, limit: 0 }),
        slope = t.slope,
        cos = Math.cos(vehicle.a),
        sin = Math.sin(vehicle.a);
      slope.x = (terrainHeight(vehicle.x + 3, vehicle.y) - terrainHeight(vehicle.x - 3, vehicle.y)) / 6;
      slope.y = (terrainHeight(vehicle.x, vehicle.y + 3) - terrainHeight(vehicle.x, vehicle.y - 3)) / 6;
      t.z = z;
      t.along = slope.x * cos + slope.y * sin;
      t.cross = -slope.x * sin + slope.y * cos;
      t.trail = offroadSurfaceAt(vehicle.x, vehicle.y, offroadSurface).across < 1.15;
      t.four = !!vehicleSpec(vehicle).offroad;
      t.limit = 200 * KMH;
      return t;
    }
    function terrainVehiclePose(vehicle, h) {
      if (isAircraft(vehicle) || isBoat(vehicle)) return;
      // The pose depends only on where the car stands; hundreds of parked cars
      // stand still, so skip the terrain sampling until one moves or is moved.
      if (vehicle.poseX === vehicle.x && vehicle.poseY === vehicle.y && vehicle.poseA === vehicle.a) return;
      vehicle.poseX = vehicle.x;
      vehicle.poseY = vehicle.y;
      vehicle.poseA = vehicle.a;
      const t = roadVehicleTerrain(vehicle);
      vehicle.groundHeight = t?.z || 0;
      vehicle.offroadState = t;
      if (t) {
        // The body sits on its four wheels, not on the slope at its middle: pitch
        // from the axles' heights, roll from the two sides' (a truck straddling a
        // rut or a ledge leans as it would).
        const spec = vehicleSpec(vehicle),
          cos = Math.cos(vehicle.a),
          sin = Math.sin(vehicle.a),
          ax = spec.l * 0.3,
          az = spec.w * 0.42,
          h = (f, s) => terrainHeight(vehicle.x + cos * f * ax - sin * s * az, vehicle.y + sin * f * ax + cos * s * az),
          fl = h(1, -1),
          fr = h(1, 1),
          rl = h(-1, -1),
          rr = h(-1, 1);
        vehicle.slopePitch = Math.atan((fl + fr - rl - rr) / (4 * ax));
        vehicle.slopeRoll = -Math.atan((fr + rr - fl - rl) / (4 * az));
      } else {
        vehicle.slopePitch = 0;
        vehicle.slopeRoll = 0;
      }
      if (vehicle === player.car && t?.z > 10) {
        const peak = mountainAt(vehicle.x, vehicle.y);
        // SUMMIT REACHED, with the hill climb's time (offroad.js).
        if (peak?.name && distanceBetween(vehicle, peak) < 48) offroadSummit(vehicle, peak);
      }
    }
    /**
     * FOOT TRAVEL ON THE MOUNTAIN
     * The trail is graded: you walk it up or down at close to normal pace. Off the
     * trail the slope decides. A moderate face can be traversed slowly and slips
     * you sideways; a steep face cannot be climbed at all; and stepping off the
     * lip of a steep face means going down it on your back, which hurts and which
     * you do not steer. Gradients are height change per unit of ground, so 0.5 is
     * about twenty-seven degrees.
     */
    const TRAIL_GRADE = 0.32,
      SLIP_GRADE = 0.34,
      TUMBLE_GRADE = 0.52,
      UNCLIMBABLE_GRADE = 0.66;
    function endTumble(landed = true) {
      if (!player.tumble) return;
      const fast = player.tumble.peak > 190;
      player.tumble = null;
      player.tumbleRoll = 0;
      if (landed)
        tell(fast ? 'You slide to a stop. Use the trail next time.' : 'Back on your feet.', 2.5);
    }
    function startTumble(downhill, grade) {
      if (player.tumble) return;
      player.tumble = {
        vx: downhill.x * (12 + grade * 25),
        vy: downhill.y * (12 + grade * 25),
        time: 0,
        peak: 0,
        hurtClock: 0.35,
      };
      player.tumbleRoll = 0;
      tell('You lose your footing on the scree.', 2.2);
      noise(0.22, 0.14, 700);
    }
    function updateMountainFooting(deltaSeconds) {
      if (player.car || playerOnRoof() || player.parachute || transitRide || gameMode !== 'play') {
        endTumble(false);
        return false;
      }
      const z = terrainHeight(player.x, player.y);
      if (z < 4) {
        endTumble(!!player.tumble);
        player.mountainGrade = 0;
        return false;
      }
      const slope = terrainSlope(player.x, player.y),
        grade = Math.hypot(slope.x, slope.y),
        trail = onMountainTrail(player.x, player.y),
        downhill = grade > 1e-4 ? { x: -slope.x / grade, y: -slope.y / grade } : { x: 0, y: 0 };
      player.mountainGrade = grade;
      player.onMountainTrail = trail;
      if (player.tumble) {
        const t = player.tumble;
        t.time += deltaSeconds;
        // Gravity down the face, a body's bouncing drag against it: at most
        // about 10 m/s down a 45-degree slope.
        t.vx -= slope.x * 1.2 * GRAVITY * deltaSeconds;
        t.vy -= slope.y * 1.2 * GRAVITY * deltaSeconds;
        const drag = Math.exp(-1.2 * deltaSeconds);
        t.vx *= drag;
        t.vy *= drag;
        const speed = Math.hypot(t.vx, t.vy);
        t.peak = Math.max(t.peak, speed);
        player.a = speed > 4 ? Math.atan2(t.vy, t.vx) : player.a;
        player.tumbleRoll = (player.tumbleRoll || 0) + speed * deltaSeconds * 0.15;
        const blocked = moveBody(player, t.vx * deltaSeconds, t.vy * deltaSeconds, 8);
        t.hurtClock -= deltaSeconds;
        if (t.hurtClock <= 0 && speed > 40) {
          t.hurtClock = 0.8;
          hurt(3 + speed * 0.06, 'impact');
          particle(player.x, player.y, '#a59a7e', 5, 60, 3);
        }
        if (blocked && speed > 70) hurt(speed * 0.1, 'impact');
        if ((grade < 0.3 && speed < 15) || t.time > 14 || (blocked && speed < 30)) endTumble();
        return true;
      }
      const right = keys.KeyD || keys.ArrowRight,
        left = keys.KeyA || keys.ArrowLeft,
        back = keys.KeyS || keys.ArrowDown,
        forward = keys.KeyW || keys.ArrowUp,
        ix = (right ? 1 : 0) - (left ? 1 : 0),
        iy = (back ? 1 : 0) - (forward ? 1 : 0);
      if (!trail && grade > TUMBLE_GRADE) {
        const heading = ix || iy ? Math.atan2(iy, ix) : null,
          intoDescent =
            heading !== null && Math.cos(heading) * downhill.x + Math.sin(heading) * downhill.y > 0.3;
        if (intoDescent || grade > UNCLIMBABLE_GRADE + 0.12) {
          startTumble(downhill, grade);
          return true;
        }
      }
      if (!ix && !iy) {
        // Standing on a loose face still costs ground.
        if (!trail && grade > SLIP_GRADE)
          moveBody(
            player,
            downhill.x * (grade - SLIP_GRADE) * 36 * deltaSeconds,
            downhill.y * (grade - SLIP_GRADE) * 36 * deltaSeconds,
            8,
          );
        return true;
      }
      const a = Math.atan2(iy, ix),
        climb = Math.cos(a) * slope.x + Math.sin(a) * slope.y;
      let speed = footPace();
      if (trail) {
        // A graded path: steady going, uphill a little slower than down.
        speed *= clamp(1 - Math.max(0, climb) * TRAIL_GRADE * 2.2, 0.46, 1);
      } else {
        if (climb > 0.02) {
          if (grade > UNCLIMBABLE_GRADE) {
            if (gameTime - (player.climbTold || -10) > 4) {
              player.climbTold = gameTime;
              tell('Too steep to climb here. Find the trail.', 2.6);
            }
            speed = 0;
          } else speed *= clamp(1 - Math.max(0, grade - SLIP_GRADE) * 3.1, 0, 1);
        } else speed *= clamp(1 - grade * 0.45, 0.4, 1);
        if (grade > SLIP_GRADE) {
          moveBody(
            player,
            downhill.x * (grade - SLIP_GRADE) * 40 * deltaSeconds,
            downhill.y * (grade - SLIP_GRADE) * 40 * deltaSeconds,
            8,
          );
        }
      }
      player.a = a;
      if (speed > 0) {
        player.walk += deltaSeconds * strideRate(speed);
        moveBody(
          player,
          (ix / Math.hypot(ix, iy)) * speed * deltaSeconds,
          (iy / Math.hypot(ix, iy)) * speed * deltaSeconds,
          8,
        );
      }
      return true;
    }
    function paintMountainTrails(g) {
      for (const t of MOUNTAIN_TRAILS) {
        strokeRoad(g, t.points, t.width + 8, '#71674c');
        strokeRoad(g, t.points, t.width, '#b29a73');
        g.setLineDash([9, 13]);
        strokeRoad(g, t.points, 1.5, '#786b50');
        g.setLineDash([]);
      }
    }
