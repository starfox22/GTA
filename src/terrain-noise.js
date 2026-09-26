    // Ridgeline Range: terrain cells, switchback trails and noise functions (terrainNoise, terrainFbm, terrainRidged).
    /**
     * THE RIDGELINE RANGE
     * The mountains are one height field over the north of Ridgeline County
     * (TERRAIN_FIELDS[0], x 5880..10980, y 60..3420, a 10-unit grid), plus a small
     * field for each of the two lone hills further south. A field is generated once,
     * on first use, and never changes:
     *
     *   1. Macro form. A main crest runs west to east parallel to the north coast,
     *      through MOUNT ASCENT (a broad, rugged summit) and NEEDLE RIDGE (a row of
     *      rock needles), with a low saddle between them above Clearwater Reservoir.
     *      Spurs branch off it: short and steep to the sea on the north side, long
     *      down to the valleys on the south. Each ridge is a crest line with a
     *      cross-section, so faces meet in valleys and gullies between the spurs.
     *   2. Relief. Domain-warped ridged multifractal noise (sharp crests, rounded
     *      valleys) and a derivative-damped fBm (IQ's "erosion" noise: detail fades
     *      on steep ground, so slopes read as worn, not bumpy).
     *   3. Erosion on the grid. A few passes of stream-power incision (D8 flow
     *      accumulation: each cell cuts in proportion to sqrt(catchment) x slope,
     *      which grows a dendritic network of ravines), terraced rock strata on
     *      steep faces, then thermal erosion (material slides off anything steeper
     *      than the angle of repose, leaving scree fans and softer crests).
     *   4. The plan wins. Heights are capped by distance fields: to a road, a rail
     *      line, a town or a helipad the ground rises no faster than a graded
     *      embankment (and is exactly flat on and beside it); to the reservoir
     *      a gentle shore; to the sea a sea cliff; and to the field's edge nothing.
     *      Caps meet the relief through a smooth minimum, so valleys open out
     *      naturally where the roads run.
     *   5. Trails. Each 4x4 trail is sampled over the relief, smoothed and held to a
     *      drivable grade (TRAIL_MAX_GRADE), then cut and filled into the surface
     *      with graded shoulders, ending in a level summit platform.
     *
     * Rendering and contact heights use the field's exact Float32 vertices and the
     * same triangle diagonal (sampleTerrainField); the generator is only ever a
     * construction source, never a second collision surface. Per-vertex data the
     * renderer needs (ambient occlusion, water flow, trail mask, forest density) is
     * baked here too, and so is the placement of the forest, the boulders and the
     * alpine meadows (mountainScenery), so the 2D map and the 3D view agree.
     */
    COUNTY_PEAKS.splice(
      0,
      8,
      {
        name: 'MOUNT ASCENT',
        x: 7760,
        y: 1090,
        r: 900,
        h: 1000,
      },
      {
        name: 'NEEDLE RIDGE',
        x: 9760,
        y: 1230,
        r: 700,
        h: 820,
      },
    );
    countyStaticSolids.length = 0;
    const TERRAIN_CELL = 10,
      // Steepest grade a 4x4 trail is graded to (height per unit of ground, ~16 deg).
      TRAIL_MAX_GRADE = 0.28,
      // Main crest of the range, west coast to east coast: [x, y, crest height, half-width].
      RANGE_CREST = [
        [5930, 1180, 100, 260],
        [6260, 1050, 300, 430],
        [6700, 960, 440, 520],
        [7200, 1030, 650, 620],
        [7760, 1090, 1150, 820],
        [8180, 1010, 720, 640],
        [8560, 1060, 520, 560],
        [8900, 1080, 390, 520],
        [9280, 1140, 600, 560],
        [9760, 1230, 900, 660],
        [10180, 1290, 720, 560],
        [10560, 1470, 420, 480],
        [10920, 1640, 100, 300],
      ],
      // Where Needle Ridge's rock needles stand: along the crest east and west of the overlook.
      NEEDLE_SPAN = [
        [9380, 1150],
        [10300, 1330],
      ];
    const TERRAIN_FIELDS = [
      { name: 'RIDGELINE RANGE', kind: 'range', x0: 5880, y0: 60, x1: 10980, y1: 3420, seed: 1997 },
      ...COUNTY_PEAKS.slice(2).map((p, i) => ({
        name: 'COUNTY HILL ' + i,
        kind: 'hill',
        peak: p,
        x0: Math.floor((p.x - p.r * 1.45) / TERRAIN_CELL) * TERRAIN_CELL,
        y0: Math.floor((p.y - p.r * 1.45) / TERRAIN_CELL) * TERRAIN_CELL,
        x1: Math.ceil((p.x + p.r * 1.45) / TERRAIN_CELL) * TERRAIN_CELL,
        y1: Math.ceil((p.y + p.r * 1.45) / TERRAIN_CELL) * TERRAIN_CELL,
        seed: 311 + i * 17,
      })),
    ];
    // A switchback trail: from the trailhead along `approach`, then zigzag legs up the
    // mountain's south face to the summit, `legs` of them swinging `amplitude` either
    // side of the line (narrowing towards the top), with the hairpins rounded off.
    function switchbackTrail(peak, approach, legs, amplitude) {
      const foot = approach.at(-1),
        ax = peak.x - foot[0],
        ay = peak.y - foot[1],
        length = Math.hypot(ax, ay),
        px = -ay / length,
        py = ax / length;
      let points = [...approach];
      for (let k = 1; k <= legs; k++) {
        // Legs evenly spaced up the face: bunched towards the top (as they once
        // were) the last two legs ran 6 m apart, too close for a truck to swing
        // round the hairpin between them without dropping onto the leg below.
        const t = k / legs,
          side = k === legs ? 0 : (k % 2 ? 1 : -1) * amplitude * (1 - 0.4 * t);
        points.push([foot[0] + ax * t + px * side, foot[1] + ay * t + py * side]);
      }
      const corners = points.slice(approach.length, -1);
      // Chaikin corner cutting, keeping the two ends where they are. Four passes
      // round each hairpin into a curve a truck can follow (two left a right
      // angle at the apex).
      for (let pass = 0; pass < 4; pass++) {
        const cut = [points[0]];
        for (let i = 0; i < points.length - 1; i++) {
          const [x0, y0] = points[i],
            [x1, y1] = points[i + 1];
          if (i) cut.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
          if (i < points.length - 2) cut.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
        }
        cut.push(points.at(-1));
        points = cut;
      }
      points = points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
      // A level turning pad at each hairpin (room for a three-point turn): centred
      // on the rounded curve where it passes closest to the leg's raw corner.
      // Searched in order along the curve: well rounded, a corner can lie nearer
      // to the leg below it than to its own bend.
      let cursor = 0;
      const hairpins = corners.map(([cx, cy]) => {
        let best = cursor;
        for (let i = cursor; i < points.length; i++)
          if (Math.hypot(points[i][0] - cx, points[i][1] - cy) < Math.hypot(points[best][0] - cx, points[best][1] - cy)) best = i;
        cursor = best + 1;
        return points[best];
      });
      return { points, hairpins };
    }
    // Turning pads are this far across (from the pad's centre).
    const HAIRPIN_PAD = 46;
    const MOUNTAIN_TRAILS = [
      {
        name: 'MOUNT ASCENT TRAIL',
        width: 42,
        ...switchbackTrail(COUNTY_PEAKS[0], [[7510, 1970], [7540, 1880]], 9, 540),
        peak: COUNTY_PEAKS[0],
        trail: true,
      },
      {
        name: 'NEEDLE RIDGE TRAIL',
        width: 42,
        ...switchbackTrail(COUNTY_PEAKS[1], [[9500, 2860], [9560, 2520], [9650, 2160]], 8, 450),
        peak: COUNTY_PEAKS[1],
        trail: true,
      },
    ];
    /* ---- Deterministic noise ------------------------------------------------------------ */
    function terrainHash(ix, iy, seed) {
      let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1103515245);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    }
    // A 256 x 256 lattice of random values in -1..1 (a table lookup is several
    // times faster than hashing each corner; seeds offset into it).
    const NOISE_LATTICE = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) NOISE_LATTICE[i] = terrainHash(i & 255, i >> 8, 77) * 2 - 1;
    // Quintic value noise in -1..1 with its analytic derivatives, written into `out`.
    const noiseOut = new Float64Array(3);
    function terrainNoise(x, y, seed) {
      const ix = Math.floor(x),
        iy = Math.floor(y),
        fx = x - ix,
        fy = y - iy,
        ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10),
        uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10),
        dux = 30 * fx * fx * (fx * (fx - 2) + 1),
        duy = 30 * fy * fy * (fy * (fy - 2) + 1),
        sx = ix + seed * 131,
        sy = iy + seed * 71,
        a = NOISE_LATTICE[(sx & 255) | ((sy & 255) << 8)],
        b = NOISE_LATTICE[((sx + 1) & 255) | ((sy & 255) << 8)],
        c = NOISE_LATTICE[(sx & 255) | (((sy + 1) & 255) << 8)],
        d = NOISE_LATTICE[((sx + 1) & 255) | (((sy + 1) & 255) << 8)],
        k1 = b - a,
        k2 = c - a,
        k4 = a - b - c + d;
      noiseOut[0] = a + k1 * ux + k2 * uy + k4 * ux * uy;
      noiseOut[1] = dux * (k1 + k4 * uy);
      noiseOut[2] = duy * (k2 + k4 * ux);
      return noiseOut[0];
    }
    // Each octave is rotated (~37 deg) and doubled so the lattice never lines up.
    function terrainFbm(x, y, octaves, seed) {
      let sum = 0,
        amp = 0.5,
        px = x,
        py = y;
      for (let i = 0; i < octaves; i++) {
        sum += terrainNoise(px, py, seed + i) * amp;
        const rx = 1.6 * px - 1.2 * py,
          ry = 1.2 * px + 1.6 * py;
        px = rx;
        py = ry;
        amp *= 0.5;
      }
      return sum;
    }
    // Ridged multifractal: sharp crests, each octave weighted by the one above it.
    function terrainRidged(x, y, octaves, seed) {
      let sum = 0,
        amp = 0.55,
        weight = 1,
        px = x,
        py = y;
      for (let i = 0; i < octaves; i++) {
        let n = 1 - Math.abs(terrainNoise(px, py, seed + i));
        n *= n;
        sum += n * amp * weight;
        weight = clamp(n * 1.6, 0, 1);
        const rx = 1.6 * px - 1.2 * py,
          ry = 1.2 * px + 1.6 * py;
        px = rx;
        py = ry;
        amp *= 0.5;
      }
      return sum;
    }
    // Derivative-damped fBm: steep ground (a large accumulated gradient) gets less detail.
    function terrainErodedFbm(x, y, octaves, seed) {
      let sum = 0,
        amp = 0.5,
        dx = 0,
        dy = 0,
        px = x,
        py = y;
      for (let i = 0; i < octaves; i++) {
        const n = terrainNoise(px, py, seed + i);
        dx += noiseOut[1];
        dy += noiseOut[2];
        sum += (amp * n) / (1 + dx * dx + dy * dy);
        const rx = 1.6 * px - 1.2 * py,
          ry = 1.2 * px + 1.6 * py;
        px = rx;
        py = ry;
        amp *= 0.5;
      }
      return sum;
    }
    function smoothMin(a, b, k) {
      const h = Math.max(k - Math.abs(a - b), 0) / k;
      return Math.min(a, b) - h * h * k * 0.25;
    }
    function smoothStep(a, b, x) {
      const t = clamp((x - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    }
    /* ---- Macro form ------------------------------------------------------------------- */
    // The ridge network: the main crest's segments plus spurs, each a segment with a
    // crest height and half-width at either end. Spurs are seeded from the crest.
    function rangeRidges(seed) {
      const ridges = [];
      for (let i = 1; i < RANGE_CREST.length; i++) {
        const [ax, ay, ah, aw] = RANGE_CREST[i - 1],
          [bx, by, bh, bw] = RANGE_CREST[i];
        ridges.push({ ax, ay, ah, aw, bx, by, bh, bw });
      }
      let s = seed;
      const random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
      for (let i = 1; i < RANGE_CREST.length - 1; i++) {
        const [cx, cy, ch, cw] = RANGE_CREST[i];
        // Two spurs south (to the valleys), one or two north (down to the sea cliffs).
        for (const [side, count, reach] of [
          [1, 2, 820],
          [-1, 1 + (i % 2), 480],
        ])
          for (let k = 0; k < count; k++) {
            const along = (random() - 0.5) * 360,
              angle = (side > 0 ? Math.PI / 2 : -Math.PI / 2) + (random() - 0.5) * 1.1,
              ox = cx + along,
              oy = cy + (along / 500) * 40,
              length = reach * (0.65 + random() * 0.55) * (0.6 + (ch / 1300) * 0.5),
              ex = ox + Math.cos(angle) * length,
              ey = oy + Math.sin(angle) * length;
            ridges.push({
              ax: ox,
              ay: oy,
              ah: ch * (0.78 + random() * 0.1),
              aw: cw * 0.7,
              bx: ex,
              by: ey,
              bh: ch * (0.12 + random() * 0.14),
              bw: cw * 0.45,
            });
          }
      }
      // Eagle Pass and Clearwater foothills: low rounded ridges south of the crest.
      for (const [ax, ay, bx, by, h] of [
        [6900, 2050, 8200, 2240, 170],
        [9550, 1850, 10500, 2200, 260],
        [10350, 2200, 10600, 2550, 150],
        [6150, 1600, 6300, 2300, 130],
      ])
        ridges.push({ ax, ay, ah: h, aw: 320, bx, by, bh: h * 0.7, bw: 280 });
      for (const r of ridges) {
        const w = Math.max(r.aw, r.bw);
        Object.assign(r, { minx: Math.min(r.ax, r.bx) - w, maxx: Math.max(r.ax, r.bx) + w, miny: Math.min(r.ay, r.by) - w, maxy: Math.max(r.ay, r.by) + w });
      }
      return ridges;
    }
    function ridgeHeight(ridges, x, y) {
      let best = 0,
        second = 0;
      for (const r of ridges) {
        if (x < r.minx || x > r.maxx || y < r.miny || y > r.maxy) continue;
        const dx = r.bx - r.ax,
          dy = r.by - r.ay,
          t = clamp(((x - r.ax) * dx + (y - r.ay) * dy) / (dx * dx + dy * dy), 0, 1),
          d = Math.hypot(x - r.ax - dx * t, y - r.ay - dy * t),
          w = r.aw + (r.bw - r.aw) * t;
        if (d >= w) continue;
        // Concave-up flanks (steep near the crest, easing into the valley floor).
        const u = 1 - d / w,
          h = (r.ah + (r.bh - r.ah) * t) * u * u * (1.6 - 0.6 * u);
        if (h > best) {
          second = best;
          best = h;
        } else if (h > second) second = h;
      }
      // Where two ridges overlap they join in a smooth saddle, not a crease.
      const k = 90,
        h = Math.max(k - (best - second), 0) / k;
      return best + h * h * k * 0.18;
    }
    /* ---- Field generation --------------------------------------------------------------- */
    // Exact 1D squared-distance transform (Felzenszwalb and Huttenlocher), in place.
    function distanceTransform1D(f, n, v, z, d) {
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
      }
    }
    // Distance in world units from every vertex to the nearest vertex where mask is set.
    function gridDistance(mask, cols, rows, cell) {
      const big = 1e12,
        grid = new Float64Array(cols * rows),
        n = Math.max(cols, rows),
        f = new Float64Array(n),
        d = new Float64Array(n),
        v = new Int32Array(n),
        z = new Float64Array(n + 1);
      for (let i = 0; i < grid.length; i++) grid[i] = mask[i] ? 0 : big;
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) f[y] = grid[y * cols + x];
        distanceTransform1D(f, rows, v, z, d);
        for (let y = 0; y < rows; y++) grid[y * cols + x] = d[y];
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) f[x] = grid[y * cols + x];
        distanceTransform1D(f, cols, v, z, d);
        for (let x = 0; x < cols; x++) grid[y * cols + x] = d[x];
      }
      const out = new Float32Array(cols * rows);
      for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(grid[i]) * cell;
      return out;
    }
    // Mark every vertex within `radius` of a polyline.
    function rasterizePolyline(mask, field, points, radius) {
      const { x0, y0, cols, rows } = field;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i],
          c0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - radius - x0) / TERRAIN_CELL)),
          c1 = Math.min(cols - 1, Math.ceil((Math.max(a[0], b[0]) + radius - x0) / TERRAIN_CELL)),
          r0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - radius - y0) / TERRAIN_CELL)),
          r1 = Math.min(rows - 1, Math.ceil((Math.max(a[1], b[1]) + radius - y0) / TERRAIN_CELL));
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++)
            if (segmentDistance(x0 + c * TERRAIN_CELL, y0 + r * TERRAIN_CELL, a, b) <= radius) mask[r * cols + c] = 1;
      }
    }
    function rasterizeRect(mask, field, x, y, w, h) {
      const { x0, y0, cols, rows } = field;
      for (let r = Math.max(0, Math.floor((y - y0) / TERRAIN_CELL)); r <= Math.min(rows - 1, Math.ceil((y + h - y0) / TERRAIN_CELL)); r++)
        for (let c = Math.max(0, Math.floor((x - x0) / TERRAIN_CELL)); c <= Math.min(cols - 1, Math.ceil((x + w - x0) / TERRAIN_CELL)); c++)
          mask[r * cols + c] = 1;
    }
    const D8 = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ];
    /**
     * Depression filling (priority flood, Barnes et al.): water in a hollow rises
     * until it spills, so routing over the filled surface carries every catchment
     * on to the sea or the reservoir instead of stopping in the first pit. Flats
     * get a tiny gradient towards their outlet. The filled copy is only used to
     * route flow; the surface itself keeps its hollows.
     */
    function fillDepressions(heights, wet, cols, rows) {
      const count = cols * rows,
        filled = new Float32Array(heights),
        done = new Uint8Array(count),
        heap = new Int32Array(count),
        key = new Float32Array(count),
        // Cells in the order they leave the queue: lowest filled height first,
        // which is also a valid drainage order (nothing drains uphill of it).
        order = new Uint32Array(count);
      let size = 0,
        popped = 0;
      const push = (i, h) => {
          let k = size++;
          while (k > 0) {
            const parent = (k - 1) >> 1;
            if (key[parent] <= h) break;
            heap[k] = heap[parent];
            key[k] = key[parent];
            k = parent;
          }
          heap[k] = i;
          key[k] = h;
        },
        pop = () => {
          const top = heap[0],
            lastIndex = heap[--size],
            lastKey = key[size];
          let k = 0;
          for (;;) {
            let child = 2 * k + 1;
            if (child >= size) break;
            if (child + 1 < size && key[child + 1] < key[child]) child++;
            if (key[child] >= lastKey) break;
            heap[k] = heap[child];
            key[k] = key[child];
            k = child;
          }
          heap[k] = lastIndex;
          key[k] = lastKey;
          return top;
        };
      // Seeds: the water and the field's rim.
      for (let i = 0; i < count; i++) {
        const c = i % cols,
          r = (i - c) / cols;
        if (wet[i] || !c || !r || c === cols - 1 || r === rows - 1) {
          done[i] = 1;
          push(i, filled[i]);
        }
      }
      while (size) {
        const i = pop(),
          c = i % cols,
          r = (i - c) / cols,
          h = filled[i];
        order[popped++] = i;
        for (let j = 0; j < 8; j++) {
          const nc = c + D8[j][0],
            nr = r + D8[j][1];
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const n = nr * cols + nc;
          if (done[n]) continue;
          done[n] = 1;
          if (filled[n] <= h) filled[n] = h + 0.002;
          push(n, filled[n]);
        }
      }
      return { filled, order };
    }
    // Catchment area (in cells) draining through each vertex, steepest-descent (D8),
    // visiting cells highest first (`order`).
    function accumulateFlow(heights, order, wet, cols, rows) {
      const count = cols * rows,
        area = new Float32Array(count);
      for (let i = 0; i < count; i++) area[i] = wet[i] ? 0 : 1;
      for (let k = 0; k < count; k++) {
        const i = order[k];
        if (wet[i]) continue;
        const x = i % cols,
          y = (i - x) / cols,
          h = heights[i];
        let best = -1,
          drop = 0;
        for (let j = 0; j < 8; j++) {
          const nx = x + D8[j][0],
            ny = y + D8[j][1];
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const n = ny * cols + nx,
            s = (h - heights[n]) / (j < 4 ? 1 : Math.SQRT2);
          if (s > drop) {
            drop = s;
            best = n;
          }
        }
        if (best >= 0) area[best] += area[i];
      }
      return area;
    }
    // Over the raw surface (the erosion passes: pits simply collect).
    function flowAccumulation(heights, wet, cols, rows) {
      const count = cols * rows,
        packed = new Float64Array(count),
        order = new Uint32Array(count);
      // Height (in 1/64 units) and index packed into one float so a native numeric
      // sort orders them: a comparator sort took ~100 ms per pass.
      for (let i = 0; i < count; i++) packed[i] = Math.round((heights[i] + 4096) * 64) * 262144 + i;
      packed.sort();
      for (let i = 0; i < count; i++) order[i] = packed[count - 1 - i] % 262144;
      return accumulateFlow(heights, order, wet, cols, rows);
    }
