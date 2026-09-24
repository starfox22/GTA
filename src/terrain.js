    // BEGIN SUBSYSTEM: src/terrain.js — Mountains and off-road contact
    /**
     * Mountains and off-road contact
     * Source: src/terrain.js
     * Scope: shared game closure.
     * The Ridgeline Range: a generated, eroded coastal mountain range on one shared
     * triangulated height surface (rendering, collision, elevation), its 4x4 trails,
     * slope handling, the scenery placement the renderer plants on it, and services.
     */
    /**
     * THE RIDGELINE RANGE
     * The mountains are one height field over the north of Ridgeline County
     * (TERRAIN_FIELDS[0], x 5880..10980, y 60..2620, a 10-unit grid), plus a small
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
      { name: 'RIDGELINE RANGE', kind: 'range', x0: 5880, y0: 60, x1: 10980, y1: 2620, seed: 1997 },
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
        // Legs bunch up towards the top, where the face is steepest.
        const t = 1 - (1 - k / legs) ** 1.3,
          side = k === legs ? 0 : (k % 2 ? 1 : -1) * amplitude * (1 - 0.4 * t);
        points.push([foot[0] + ax * t + px * side, foot[1] + ay * t + py * side]);
      }
      // Chaikin corner cutting, keeping the two ends where they are.
      for (let pass = 0; pass < 2; pass++) {
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
      return points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
    const MOUNTAIN_TRAILS = [
      {
        name: 'MOUNT ASCENT TRAIL',
        width: 42,
        points: switchbackTrail(COUNTY_PEAKS[0], [[7510, 1970], [7540, 1880]], 9, 540),
        peak: COUNTY_PEAKS[0],
        trail: true,
      },
      {
        name: 'NEEDLE RIDGE TRAIL',
        width: 42,
        points: switchbackTrail(COUNTY_PEAKS[1], [[9500, 2860], [9560, 2520], [9650, 2160]], 8, 450),
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
      for (const road of [...COUNTY_ROADS, ...SERVICE_ROADS]) rasterizePolyline(flat, field, road.points, road.width / 2 + 14);
      for (const line of RAIL_LINES) rasterizePolyline(flat, field, line.route, 40);
      for (const t of COUNTY_TOWNS) rasterizeRect(flat, field, t.x - 90, t.y - 90, BLOCK_SIZE * 2 + 180, BLOCK_SIZE * 2 + 180);
      rasterizePolyline(flat, field, [[FLIGHT.pickup.x, FLIGHT.pickup.y], [FLIGHT.pickup.x, FLIGHT.pickup.y]], 150);
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
        heights[i] += (terrace - heights[i]) * steep * 0.3;
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
      const trailMask = new Float32Array(count);
      for (const trail of MOUNTAIN_TRAILS) {
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
          end = Math.min(smoothed.at(-1) + 60, total * TRAIL_MAX_GRADE * 0.97);
        profile = smoothed.map((h, i) =>
          clamp(h, Math.max(0, end - (total - along[i]) * TRAIL_MAX_GRADE), along[i] * TRAIL_MAX_GRADE),
        );
        profile[0] = 0;
        profile[profile.length - 1] = end;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 1; i < profile.length - 1; i++) {
            const g = (along[i] - along[i - 1]) * TRAIL_MAX_GRADE;
            profile[i] = clamp(profile[i], profile[i - 1] - g, profile[i - 1] + g);
          }
          for (let i = profile.length - 2; i > 0; i--) {
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
            const near = Math.sqrt(nearest[i]),
              far = Math.sqrt(other[i]),
              platform = Math.hypot(x0 + c * TERRAIN_CELL - top[0], y0 + r * TERRAIN_CELL - top[1]);
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
      return MOUNTAIN_TRAILS.some((t) =>
        t.points.some((p, i) => i && segmentDistance(x, y, t.points[i - 1], p) < t.width / 2),
      );
    }
    function roadVehicleTerrain(vehicle) {
      const z = terrainHeight(vehicle.x, vehicle.y);
      if (z < 0.2 && !mountainAt(vehicle.x, vehicle.y)) return null;
      const slope = terrainSlope(vehicle.x, vehicle.y),
        along = slope.x * Math.cos(vehicle.a) + slope.y * Math.sin(vehicle.a),
        cross = -slope.x * Math.sin(vehicle.a) + slope.y * Math.cos(vehicle.a),
        trail = onMountainTrail(vehicle.x, vehicle.y),
        offroadCapable = !!vehicleSpec(vehicle).offroad;
      return {
        z,
        slope,
        along,
        cross,
        trail,
        four: offroadCapable,
        traction: offroadCapable ? (trail ? 0.92 : 0.68) : trail ? 0.26 : 0.12,
        limit: offroadCapable ? (trail ? 110 : 65) : trail ? 48 : 25,
      };
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
      vehicle.slopePitch = Math.atan(t?.along || 0);
      vehicle.slopeRoll = -Math.atan(t?.cross || 0);
      vehicle.offroadState = t;
      if (vehicle === player.car && t?.z > 10) {
        const peak = mountainAt(vehicle.x, vehicle.y);
        if (
          peak?.name &&
          distanceBetween(vehicle, peak) < 48 &&
          !vehicle.summits?.includes(peak.name)
        ) {
          vehicle.summits = vehicle.summits || [];
          vehicle.summits.push(peak.name);
          announce('SUMMIT REACHED', peak.name, 4);
        }
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
        vx: downhill.x * (40 + grade * 90),
        vy: downhill.y * (40 + grade * 90),
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
        t.vx -= slope.x * 900 * deltaSeconds;
        t.vy -= slope.y * 900 * deltaSeconds;
        const drag = Math.exp(-1.5 * deltaSeconds);
        t.vx *= drag;
        t.vy *= drag;
        const speed = Math.hypot(t.vx, t.vy);
        t.peak = Math.max(t.peak, speed);
        player.a = speed > 4 ? Math.atan2(t.vy, t.vx) : player.a;
        player.tumbleRoll = (player.tumbleRoll || 0) + speed * deltaSeconds * 0.05;
        const blocked = moveBody(player, t.vx * deltaSeconds, t.vy * deltaSeconds, 8);
        t.hurtClock -= deltaSeconds;
        if (t.hurtClock <= 0 && speed > 120) {
          t.hurtClock = 0.8;
          hurt(3 + speed * 0.022, 'impact');
          particle(player.x, player.y, '#a59a7e', 5, 60, 3);
        }
        if (blocked && speed > 220) hurt(speed * 0.03, 'impact');
        if ((grade < 0.3 && speed < 55) || t.time > 14 || (blocked && speed < 90)) endTumble();
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
            downhill.x * (grade - SLIP_GRADE) * 130 * deltaSeconds,
            downhill.y * (grade - SLIP_GRADE) * 130 * deltaSeconds,
            8,
          );
        return true;
      }
      const a = Math.atan2(iy, ix),
        climb = Math.cos(a) * slope.x + Math.sin(a) * slope.y;
      let speed = keys.ShiftLeft || keys.ShiftRight ? 158 : 100;
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
            downhill.x * (grade - SLIP_GRADE) * 150 * deltaSeconds,
            downhill.y * (grade - SLIP_GRADE) * 150 * deltaSeconds,
            8,
          );
        }
      }
      player.a = a;
      if (speed > 0) {
        player.walk += deltaSeconds * (keys.ShiftLeft ? 15 : 10) * clamp(speed / 100, 0.3, 1.6);
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
    /**
     * BAKED TERRAIN DATA
     * What the renderer and the 2D map read per vertex, made once per field:
     *   normal    central differences over the whole field (chunk seams match)
     *   ao        sky visibility: the highest horizon in 8 directions out to ~300
     *             units, so ravines, cirques and the foot of cliffs darken
     *   forest    tree cover 0..1: below a ragged treeline, off cliffs, trails,
     *             roads and shores, clumped into stands with meadow clearings,
     *             thicker along the damp valley floors
     */
    const TERRAIN_TREELINE = 430,
      TERRAIN_SNOWLINE = 560;
    function terrainBakes(field) {
      if (field.bakes) return field.bakes;
      terrainField(field);
      const { cols, rows, heights, land, flow, trailMask, x0, y0, seed, flatDistance, lakeDistance } = field,
        count = cols * rows,
        normals = new Float32Array(count * 3),
        ao = new Float32Array(count),
        forest = new Float32Array(count),
        at = (c, r) => heights[clamp(r, 0, rows - 1) * cols + clamp(c, 0, cols - 1)];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c,
            nx = at(c - 1, r) - at(c + 1, r),
            nz = at(c, r - 1) - at(c, r + 1),
            ny = 2 * TERRAIN_CELL,
            n = Math.hypot(nx, ny, nz);
          normals[i * 3] = nx / n;
          normals[i * 3 + 1] = ny / n;
          normals[i * 3 + 2] = nz / n;
        }
      // Horizon samples: 8 directions x 4 distances, as grid offsets and the
      // inverse of their length (so the rise is a slope).
      const probes = [];
      for (let k = 0; k < 8; k++)
        for (const step of [3, 9, 20, 32]) {
          const dc = Math.round(Math.cos((k * Math.PI) / 4) * step),
            dr = Math.round(Math.sin((k * Math.PI) / 4) * step);
          probes.push(dc, dr, 1 / (Math.hypot(dc, dr) * TERRAIN_CELL));
        }
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c,
            h = heights[i],
            inside = c >= 32 && r >= 32 && c < cols - 32 && r < rows - 32;
          let open = 0;
          for (let p = 0; p < probes.length; p += 12) {
            let horizon = 0;
            for (let q = p; q < p + 12; q += 3) {
              const n = inside ? i + probes[q + 1] * cols + probes[q] : clamp(r + probes[q + 1], 0, rows - 1) * cols + clamp(c + probes[q], 0, cols - 1),
                rise = (heights[n] - h) * probes[q + 2];
              if (rise > horizon) horizon = rise;
            }
            open += 1 - horizon / Math.sqrt(1 + horizon * horizon);
          }
          ao[i] = open / 8;
        }
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c,
            h = heights[i];
          if (!land[i] || trailMask[i] > 0.01 || flatDistance[i] < 50 || lakeDistance[i] < 30) continue;
          const x = x0 + c * TERRAIN_CELL,
            y = y0 + r * TERRAIN_CELL,
            steep = 1 - normals[i * 3 + 1],
            treeline = TERRAIN_TREELINE + terrainFbm(x / 260, y / 260, 3, seed + 60) * 110,
            stands = terrainFbm(x / 330, y / 330, 4, seed + 70),
            damp = flow[i];
          let f = smoothStep(-0.28, 0.12, stands + damp * 0.45) * (1 - smoothStep(treeline - 70, treeline, h));
          // Nothing grows on a cliff or in a stream bed; the foot of the slopes is thinner.
          f *= 1 - smoothStep(0.25, 0.4, steep);
          f *= 1 - smoothStep(0.74, 0.8, damp);
          // Thin out towards the roads and towns so the forest edge is open woodland.
          f *= smoothStep(2, 30, h) * (0.35 + 0.65 * smoothStep(60, 260, flatDistance[i]));
          forest[i] = f;
        }
      return (field.bakes = { normals, ao, forest });
    }
    /**
     * MOUNTAIN SCENERY
     * Instances the renderer plants (landscaping only: no collision, like the park
     * trees in landscape3d.js), placed on the field's own triangles:
     *   trees     jittered 17-unit grid, kept by the forest density; conifers
     *             dominate with height, broadleaf trees in the lower valleys, and
     *             trees shrink towards the treeline (krummholz)
     *   rocks     boulders on scree slopes, below cliffs and scattered in the
     *             alpine meadows
     * Each entry is [x, y, ground height, size, variant, heading]; flat Float32Arrays.
     */
    let mountainSceneryCache = null;
    function mountainScenery() {
      if (mountainSceneryCache) return mountainSceneryCache;
      const conifers = [],
        broadleaf = [],
        rocks = [];
      for (const field of TERRAIN_FIELDS) {
        const { cols, rows, heights, land, x0, y0, seed, trailMask, flatDistance } = terrainField(field),
          { normals, forest } = terrainBakes(field),
          spacing = 17;
        for (let y = y0 + spacing / 2; y < field.y1; y += spacing)
          for (let x = x0 + spacing / 2; x < field.x1; x += spacing) {
            const jx = x + (terrainHash(Math.round(x), Math.round(y), seed + 1) - 0.5) * spacing * 0.9,
              jy = y + (terrainHash(Math.round(x), Math.round(y), seed + 2) - 0.5) * spacing * 0.9,
              c = Math.round((jx - x0) / TERRAIN_CELL),
              r = Math.round((jy - y0) / TERRAIN_CELL);
            if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
            const i = r * cols + c,
              roll = terrainHash(Math.round(jx * 3), Math.round(jy * 3), seed + 3);
            if (roll < forest[i] * 0.92) {
              const ground = sampleTerrainField(field, jx, jy);
              if (ground < 2) continue;
              const alpine = smoothStep(TERRAIN_TREELINE - 180, TERRAIN_TREELINE, ground),
                size = (13 + terrainHash(c, r, seed + 4) * 11) * (1 - alpine * 0.45),
                conifer = terrainHash(c, r, seed + 5) < 0.5 + smoothStep(40, 260, ground) * 0.48;
              (conifer ? conifers : broadleaf).push(jx, jy, ground, size, terrainHash(c, r, seed + 6), roll * TAU * 7);
            } else if (roll > 0.962 && land[i] && trailMask[i] < 0.01 && flatDistance[i] > 40) {
              // Boulders: scree and cliff feet, and some out in the meadows.
              const steep = 1 - normals[i * 3 + 1],
                h = heights[i];
              if (h < 25 || steep > 0.45 || (steep < 0.12 && roll < 0.99 && h < TERRAIN_TREELINE)) continue;
              rocks.push(jx, jy, sampleTerrainField(field, jx, jy), 3 + terrainHash(c, r, seed + 8) * (steep > 0.15 ? 13 : 7), terrainHash(c, r, seed + 9), roll * TAU * 11);
            }
          }
      }
      return (mountainSceneryCache = {
        conifers: new Float32Array(conifers),
        broadleaf: new Float32Array(broadleaf),
        rocks: new Float32Array(rocks),
      });
    }
    /**
     * STREAMS AND WATERFALLS
     * The ravines' water, traced down the final surface: every vertex whose
     * catchment passes STREAM_AREA starts or continues a stream, which follows
     * steepest descent to the sea, the reservoir or a flat valley floor. Each is
     * a polyline of [x, y, height, width, steepness] the renderer turns into a
     * ribbon; where it drops faster than 1:1 it is drawn as a waterfall.
     */
    const STREAM_AREA = 900;
    let terrainStreamCache = null;
    function terrainStreams() {
      if (terrainStreamCache) return terrainStreamCache;
      const streams = [];
      for (const field of TERRAIN_FIELDS) {
        const { cols, rows, heights, land, x0, y0, trailMask } = terrainField(field),
          count = cols * rows,
          wet = new Uint8Array(count);
        for (let i = 0; i < count; i++) wet[i] = land[i] ? 0 : 1;
        const area = field.area,
          routed = field.routed,
          next = new Int32Array(count).fill(-1),
          taken = new Uint8Array(count);
        for (let i = 0; i < count; i++) {
          if (wet[i] || area[i] < STREAM_AREA) continue;
          const c = i % cols,
            r = (i - c) / cols;
          let best = -1,
            drop = 0;
          for (let j = 0; j < 8; j++) {
            const nc = c + D8[j][0],
              nr = r + D8[j][1];
            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
            const n = nr * cols + nc,
              s = (routed[i] - routed[n]) / (j < 4 ? 1 : Math.SQRT2);
            if (s > drop) {
              drop = s;
              best = n;
            }
          }
          next[i] = best;
        }
        // Heads: stream vertices nothing upstream flows into; trace each down until
        // it joins a traced stream, leaves the land or flattens out.
        const fed = new Uint8Array(count);
        for (let i = 0; i < count; i++) if (next[i] >= 0) fed[next[i]] = 1;
        for (let head = 0; head < count; head++) {
          if (next[head] < 0 || fed[head] || taken[head]) continue;
          const line = [];
          for (let i = head, guard = 0; i >= 0 && guard < 2000; i = next[i], guard++) {
            const c = i % cols,
              r = (i - c) / cols,
              h = heights[i],
              down = next[i] >= 0 ? h - heights[next[i]] : 0;
            // A stream running over a trail goes under it in a culvert.
            if (h < 1.5 || trailMask[i] > 0.5) break;
            line.push([x0 + c * TERRAIN_CELL, y0 + r * TERRAIN_CELL, h, 5 + Math.sqrt(area[i]) * 0.16, down / TERRAIN_CELL]);
            if (taken[i]) break;
            taken[i] = 1;
          }
          if (line.length > 4) streams.push(line);
        }
      }
      return (terrainStreamCache = streams);
    }
    // Snow cover the 2D map shows (the 3D shader draws its own, softer version).
    function terrainSnowAmount(x, y, height, steep, flow) {
      const line = TERRAIN_SNOWLINE + terrainFbm(x / 800, y / 800, 3, 5) * 90 - flow * 90;
      return clamp((height - line) / 70, 0, 1) * (1 - smoothStep(0.28, 0.45, steep));
    }
    /**
     * The fields painted into the county ground sheets (2D view and map): relief
     * colour by height, forest, rock, snow and streams, hill-shaded from the south
     * west, with a contour every 100 units. One pixel per vertex, scaled up with
     * smoothing; vertices at street level are left transparent so the painted
     * region shows through.
     */
    const mountainGroundCache = new Map();
    function paintMountainGround(drawingContext) {
      for (const field of TERRAIN_FIELDS) {
        let canvas = mountainGroundCache.get(field);
        if (!canvas) {
          const { cols, rows, heights, land, x0, y0, flow, trailMask } = terrainField(field),
            { normals, forest, ao } = terrainBakes(field);
          canvas = document.createElement('canvas');
          canvas.width = cols;
          canvas.height = rows;
          const context = canvas.getContext('2d'),
            image = context.createImageData(cols, rows),
            pixels = image.data;
          for (let i = 0; i < cols * rows; i++) {
            const h = heights[i];
            if (!land[i] || h < 0.5) continue;
            const c = i % cols,
              r = (i - c) / cols,
              nx = normals[i * 3],
              ny = normals[i * 3 + 1],
              nz = normals[i * 3 + 2],
              steep = 1 - ny,
              shade = clamp(0.62 + (nx * -0.55 + ny * 0.62 + nz * 0.58) * 0.5, 0.45, 1.25) * (0.75 + ao[i] * 0.3),
              rock = smoothStep(0.2, 0.4, steep),
              alpine = smoothStep(TERRAIN_TREELINE - 50, TERRAIN_TREELINE + 60, h),
              snow = terrainSnowAmount(x0 + c * TERRAIN_CELL, y0 + r * TERRAIN_CELL, h, steep, flow[i]),
              foot = 1 - smoothStep(0.5, 14, h);
            let rgb = [
              82 + alpine * 44 - forest[i] * 38,
              105 + alpine * 18 - forest[i] * 34,
              74 + alpine * 10 - forest[i] * 36,
            ];
            rgb = rgb.map((v, k) => v + ([128, 122, 112][k] - v) * rock);
            if (flow[i] > 0.8 && steep < 0.5) rgb = [70, 104, 118];
            rgb = rgb.map((v, k) => v + ([236, 241, 245][k] - v) * snow);
            rgb = rgb.map((v, k) => v + ([180, 158, 118][k] - v) * trailMask[i]);
            const contour =
              c < cols - 1 && r < rows - 1 && (Math.floor(h / 100) !== Math.floor(heights[i + 1] / 100) || Math.floor(h / 100) !== Math.floor(heights[i + cols] / 100));
            const o = i * 4;
            for (let k = 0; k < 3; k++) {
              const lit = rgb[k] * shade * (contour ? 0.84 : 1);
              pixels[o + k] = clamp(Math.round(lit + ([82, 105, 74][k] - lit) * foot), 0, 255);
            }
            pixels[o + 3] = Math.round(255 * (1 - foot * 0.9));
          }
          context.putImageData(image, 0, 0);
          mountainGroundCache.set(field, canvas);
        }
        drawingContext.save();
        drawingContext.imageSmoothingEnabled = true;
        drawingContext.drawImage(
          canvas,
          field.x0 - TERRAIN_CELL / 2,
          field.y0 - TERRAIN_CELL / 2,
          field.cols * TERRAIN_CELL,
          field.rows * TERRAIN_CELL,
        );
        drawingContext.restore();
      }
    }
    function terrainReport() {
      const scenery = mountainScenery();
      return {
        fields: TERRAIN_FIELDS.map((f) => {
          terrainField(f);
          return { name: f.name, grid: [f.cols, f.rows], maxHeight: Math.round(f.maxHeight), buildMs: f.timing };
        }),
        peaks: COUNTY_PEAKS.slice(0, 2).map((p) => ({ name: p.name, x: p.x, y: p.y, height: Math.round(terrainHeight(p.x, p.y)) })),
        trails: MOUNTAIN_TRAILS.map((t) => {
          let steepest = 0;
          for (let i = 1; i < t.path.length; i++) {
            const run = Math.hypot(t.path[i][0] - t.path[i - 1][0], t.path[i][1] - t.path[i - 1][1]);
            steepest = Math.max(steepest, Math.abs(terrainHeight(...t.path[i]) - terrainHeight(...t.path[i - 1])) / run);
          }
          return {
            name: t.name,
            length: Math.round(t.path.length * 12),
            summit: Math.round(t.summit),
            steepestGrade: +steepest.toFixed(3),
            start: t.points[0],
            startHeight: +terrainHeight(...t.points[0]).toFixed(2),
            points: t.points,
          };
        }),
        conifers: scenery.conifers.length / 6,
        broadleaf: scenery.broadleaf.length / 6,
        boulders: scenery.rocks.length / 6,
        streams: terrainStreams().length,
        outcrops: MOUNTAIN_OUTCROPS.map((r) => ({
          x: r.x,
          y: r.y,
          ground: Math.round(terrainHeight(r.x, r.y)),
          trailClearance: Math.round(Math.min(...MOUNTAIN_TRAILS.flatMap((t) => t.points.map((p, i) => (i ? segmentDistance(r.x, r.y, t.points[i - 1], p) : Infinity))))),
        })),
      };
    }
    // Rock outcrops: solid (they stop vehicles and people), sat on the surface.
    // Placed where the range is steep but open, well clear of the trails.
    const MOUNTAIN_OUTCROPS = [
      { x: 8400, y: 1180, w: 34, h: 30, rise: 25 },
      { x: 7330, y: 820, w: 38, h: 30, rise: 31 },
      { x: 7090, y: 1300, w: 30, h: 34, rise: 23 },
      { x: 10200, y: 1520, w: 34, h: 30, rise: 28 },
    ];
    let mountainOutcropsPlaced = false;
    function placeMountainOutcrops() {
      if (mountainOutcropsPlaced) return;
      mountainOutcropsPlaced = true;
      for (const rock of MOUNTAIN_OUTCROPS)
        countyStaticSolids.push({
          x: rock.x - rock.w / 2,
          y: rock.y - rock.h / 2,
          w: rock.w,
          h: rock.h,
          height: terrainHeight(rock.x, rock.y) + rock.rise,
          kind: 'rock',
        });
    }
    function paintServiceForecourts(drawingContext, cityOnly = false) {
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      for (const r of SERVICE_ROADS)
        if (!cityOnly || r.name.startsWith('SOUTHPORT '))
          strokeRoad(drawingContext, r.points, r.width, '#606664');
      for (const p of PLACES) {
        if (
          !/^(county-|southport-|sentinel-|keys-guns)/.test(p.id) ||
          (cityOnly && (p.x >= CITY_SIZE || p.y >= CITY_SIZE))
        )
          continue;
        const y = p.y + p.h;
        drawingContext.fillStyle = '#a6a597';
        drawingContext.fillRect(p.x - 9, y + 1, p.w + 18, 13);
        drawingContext.fillStyle = '#666d65';
        drawingContext.fillRect(p.x - 9, y + 14, p.w + 18, 36);
        drawingContext.strokeStyle = '#d6d2bb';
        drawingContext.lineWidth = 1.4;
        for (let x = p.x + 12; x < p.x + p.w - 15; x += 31) {
          if (Math.abs(x - p.door.x) < 24) continue;
          drawingContext.beginPath();
          drawingContext.moveTo(x, y + 22);
          drawingContext.lineTo(x, y + 45);
          drawingContext.stroke();
        }
        drawingContext.fillStyle = '#c7c0a7';
        drawingContext.fillRect(p.door.x - 11, y + 1, 22, 32);
        drawingContext.fillStyle = '#e8dfc3';
        drawingContext.font = 'bold 8px Arial';
        drawingContext.textAlign = 'center';
        drawingContext.fillText(
          p.kind === 'guns' ? 'OUTFITTERS' : 'GUEST PARKING',
          p.x + p.w / 2,
          y + 48,
        );
      }
      drawingContext.restore();
    }
    function installCountyServices() {
      const add = (id, kind, name, b, door) => {
        if (PLACES.some((p) => p.id === id)) return;
        let building = buildings.find((o) => o.x === b.x && o.y === b.y);
        if (!building) {
          makeBuilding(b.x, b.y, b.w, b.h, 0, true);
          building = buildings.at(-1);
        }
        Object.assign(building, {
          place: id,
          county: building.county || b.x > CITY_SIZE || b.y > CITY_SIZE,
          height: building.height || 35,
        });
        PLACES.push({
          ...b,
          id,
          kind,
          name,
          height: building.height,
          door,
          color: kind === 'guns' ? '#d6ba80' : '#95d2cb',
          symbol: kind === 'guns' ? 'GUN' : 'ZZ',
        });
      };
      for (const [i, t] of COUNTY_TOWNS.entries()) {
        add(
          'county-guns-' + i,
          'guns',
          t.name + ' OUTFITTERS',
          {
            x: t.x + 82,
            y: t.y + 82,
            w: 132,
            h: 125,
          },
          {
            x: t.x + 148,
            y: t.y + 229,
          },
        );
        add(
          'county-sleep-' + i,
          'sleep',
          t.name + ' LODGE',
          {
            x: t.x + 295,
            y: t.y + 82,
            w: 130,
            h: 122,
          },
          {
            x: t.x + 360,
            y: t.y + 226,
          },
        );
      }
      add(
        'keys-guns',
        'guns',
        'PALM KEYS ARMORY',
        {
          x: -2315,
          y: 1271,
          w: 262,
          h: 108,
        },
        {
          x: -2184,
          y: 1401,
        },
      );
      add(
        'sentinel-guns',
        'guns',
        'SENTINEL SURPLUS',
        {
          x: 9000,
          y: 7880,
          w: 160,
          h: 110,
        },
        {
          x: 9080,
          y: 8012,
        },
      );
      add(
        'sentinel-sleep',
        'sleep',
        'CAUSEWAY INN',
        {
          x: 8990,
          y: 8260,
          w: 175,
          h: 110,
        },
        {
          x: 9077.5,
          y: 8392,
        },
      );
      add(
        'southport-guns',
        'guns',
        'SOUTH BANK OUTFITTERS',
        {
          x: 1760,
          y: 4492,
          w: 155,
          h: 143,
        },
        {
          x: 1837.5,
          y: 4657,
        },
      );
      add(
        'southport-sleep',
        'sleep',
        'SOUTHPORT LODGE',
        {
          x: 780,
          y: 4330,
          w: 160,
          h: 100,
        },
        {
          x: 860,
          y: 4452,
        },
      );
    }
    function spawnTrailVehicles() {
      for (const t of MOUNTAIN_TRAILS) {
        const [x, y] = t.points[0],
          p = findStreetPoint(x + 65, y, 20);
        if (canSpawnCar('suv', p.x, p.y, headingBetween(p, t.peak), 8))
          makeCar('suv', p.x, p.y, headingBetween(p, t.peak), false, '#bc9762');
      }
    }
    const SERVICE_ROADS = [
      {
        name: 'SOUTHPORT SHOPS',
        width: 36,
        points: [
          [1837.5, 4666],
          [1837.5, 4736],
        ],
      },
      {
        name: 'SOUTHPORT LODGE ACCESS',
        width: 48,
        points: [
          [1000, 4560],
          [860, 4560],
          [860, 4452],
        ],
      },
      {
        name: 'CAUSEWAY INN ACCESS',
        width: 42,
        points: [
          [9200, 8150],
          [9200, 8392],
          [9077.5, 8392],
        ],
      },
    ];
    for (const town of COUNTY_TOWNS)
      SERVICE_ROADS.push({
        name: town.name + ' MARKET STREET',
        width: 36,
        points: [
          [town.x, town.y + 240],
          [town.x + BLOCK_SIZE, town.y + 240],
        ],
      });
    // END SUBSYSTEM: src/terrain.js
