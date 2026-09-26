      // BEGIN SUBSYSTEM: src/ground-data3d.js — Ground shader data
      /**
       * Ground shader data
       * Source: src/ground-data3d.js
       * Scope: createCityRenderer() closure (included just before surfaces3d.js).
       *
       * The painted ground sheets say what lies where (asphalt, paving, lawn, sand)
       * at 1.6 to 2.8 world units a texel: fine from the air, soft at street level.
       * The ground shader (ground-shader3d.js) draws the surfaces themselves at the
       * resolution of the screen from three kinds of data built here:
       *
       *   DETAIL LAYERS    `groundDetail`, a small texture array of tiling surface
       *                    detail (photographed asphalt aggregate and grass from the
       *                    ground atlas, concrete grain, broom streaks, granite
       *                    speckle, gravel, sand, bark mulch), mipmapped, so the
       *                    detail averages out instead of shimmering far away.
       *   CARRIAGEWAY FIELD per sheet: the signed distance to the nearest kerb line
       *                    (negative on the carriageway) as a half-float texture a
       *                    few units a texel. Bilinear filtering of a distance is
       *                    exact along a straight kerb, so the kerb stone, the
       *                    gutter, the lanes' wheel paths and the pavement slab
       *                    joints (which follow the kerb) are crisp at any zoom.
       *                    Beside it a coarse info texture: the district's paving
       *                    style, the lane width and a park flag.
       *   MARKS            every road marking (lane dashes, zebra crossings, stop
       *                    lines, centre lines), manhole cover, gully grate, tree
       *                    base and oil stain as a record (an oriented rectangle or
       *                    disc with a pattern), filed in a 32-unit grid over the
       *                    whole world. The shader reads the few records in its
       *                    cell and draws each exactly (paint with worn edges, cast
       *                    iron, a grate), so the painted sheets leave them out.
       */
      const GROUND_STYLE = {
        city: 0, // Midtown, Broadway, South Bank...: concrete slabs, concrete kerbs
        oldQuarter: 1, // flagstones, granite kerbs and setts
        financial: 2, // polished granite slabs
        docks: 3, // big worn concrete panels
        palmKeys: 4, // light pavers laid herringbone
        monarch: 5, // pale limestone
        county: 6, // plain weathered concrete, grass in the joints
        beach: 7, // sand
      };
      function cityGroundStyle(x, y) {
        // A North Point tower block is granite to its road centrelines: the
        // district line (x 1880) runs through the western column of the
        // cluster, and west of it the plaza came out as rusty dock panels.
        const bx = Math.floor((x - 128) / BLOCK_SIZE),
          by = Math.floor((y - 128) / BLOCK_SIZE);
        if (skylineBlockTowers(bx, by).length && districtAt(blockX(bx) + BLOCK_SIZE / 2, blockY(by) + BLOCK_SIZE / 2).includes('FINANCIAL')) return GROUND_STYLE.financial;
        const d = districtAt(x, y);
        if (d === BEACH.name || (onPalmKeys(x) && !onRoad(x, y) && segmentPathDistance(x, y, KEYS_WEST_STRAND) < 80)) return GROUND_STYLE.beach;
        if (d.includes('OLD QUARTER') || d === 'BATTERY POINT') return GROUND_STYLE.oldQuarter;
        if (d.includes('FINANCIAL')) return GROUND_STYLE.financial;
        if (d === 'IRONWORKS DOCKS' || d === 'CRUISE TERMINAL' || d === 'THE RECLAMATION' || d === 'SOUTHPORT AIRPORT') return GROUND_STYLE.docks;
        if (onPalmKeys(x) || d === 'OCEAN DRIVE' || d === 'LITTLE HAVANA' || d === 'CORAL MARINA') return GROUND_STYLE.palmKeys;
        return GROUND_STYLE.city;
      }
      function segmentPathDistance(x, y, points) {
        let best = Infinity;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1],
            b = points[i];
          best = Math.min(best, segmentDistance(x, y, a, b));
        }
        return best;
      }
      // ---- Detail layers ------------------------------------------------------------------------
      const DETAIL_SIZE = 256,
        DETAIL_LAYERS = 4;
      // Tileable value noise on a lattice of `period` cells over the layer.
      function periodicNoise(seed) {
        const hash = (i, j) => {
          let h = (i * 374761393 + j * 668265263 + seed * 144269) | 0;
          h = Math.imul(h ^ (h >>> 13), 1274126177);
          return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
        };
        return (u, v, period) => {
          const x = u * period,
            y = v * period,
            i = Math.floor(x),
            j = Math.floor(y),
            fx = x - i,
            fy = y - j,
            sx = fx * fx * (3 - 2 * fx),
            sy = fy * fy * (3 - 2 * fy),
            w = (k) => ((k % period) + period) % period;
          const a = hash(w(i), w(j)),
            b = hash(w(i + 1), w(j)),
            c = hash(w(i), w(j + 1)),
            d = hash(w(i + 1), w(j + 1));
          return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
        };
      }
      function fbm(noise, u, v, period, octaves) {
        let sum = 0,
          amp = 0.5,
          norm = 0;
        for (let o = 0; o < octaves; o++) {
          sum += noise(u, v, period) * amp;
          norm += amp;
          period *= 2;
          amp *= 0.5;
        }
        return sum / norm;
      }
      // A quadrant of the ground atlas drawn into a layer-sized canvas (it tiles).
      function atlasLayer(q, crop = null) {
        const c = document.createElement('canvas');
        c.width = c.height = DETAIL_SIZE;
        const g = c.getContext('2d'),
          im = visualAssets.ground,
          qw = im.width / 2,
          qh = im.height / 2,
          sx = (q % 2) * qw,
          sy = Math.floor(q / 2) * qh;
        if (crop) {
          // A joint-free square from inside the quadrant, mirrored 2 x 2 so it tiles.
          const half = DETAIL_SIZE / 2;
          for (let k = 0; k < 4; k++) {
            g.save();
            g.translate((k % 2) * DETAIL_SIZE, Math.floor(k / 2) * DETAIL_SIZE);
            g.scale(k % 2 ? -1 : 1, k >= 2 ? -1 : 1);
            g.drawImage(im, sx + crop[0] * qw, sy + crop[1] * qh, crop[2] * qw, crop[2] * qh, 0, 0, half, half);
            g.restore();
          }
        } else g.drawImage(im, sx, sy, qw, qh, 0, 0, DETAIL_SIZE, DETAIL_SIZE);
        return g.getImageData(0, 0, DETAIL_SIZE, DETAIL_SIZE).data;
      }
      // Luminance of an RGBA array, then that luminance normalised to mean 0.5
      // with a given spread (the photographs' own exposure does not matter).
      function normalisedLuma(rgba, spread) {
        const n = DETAIL_SIZE * DETAIL_SIZE,
          l = new Float32Array(n);
        let mean = 0;
        for (let i = 0; i < n; i++) mean += l[i] = rgba[i * 4] * 0.2126 + rgba[i * 4 + 1] * 0.7152 + rgba[i * 4 + 2] * 0.0722;
        mean /= n;
        let variance = 0;
        for (let i = 0; i < n; i++) variance += (l[i] - mean) ** 2;
        const sd = Math.sqrt(variance / n) || 1;
        for (let i = 0; i < n; i++) l[i] = Math.min(1, Math.max(0, 0.5 + ((l[i] - mean) / sd) * spread));
        return l;
      }
      // A wrapping box blur of a layer-sized field (radius in texels).
      function wrapBlur(src, radius) {
        const S = DETAIL_SIZE,
          tmp = new Float32Array(S * S),
          out = new Float32Array(S * S),
          k = 1 / (radius * 2 + 1);
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            let s = 0;
            for (let d = -radius; d <= radius; d++) s += src[y * S + ((x + d + S) % S)];
            tmp[y * S + x] = s * k;
          }
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            let s = 0;
            for (let d = -radius; d <= radius; d++) s += tmp[((y + d + S) % S) * S + x];
            out[y * S + x] = s * k;
          }
        return out;
      }
      function buildDetailLayers() {
        const S = DETAIL_SIZE,
          n = S * S,
          data = new Uint8Array(n * 4 * DETAIL_LAYERS),
          put = (layer, i, r, g, b, a) => {
            const o = (layer * n + i) * 4;
            data[o] = Math.max(0, Math.min(255, Math.round(r * 255)));
            data[o + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
            data[o + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
            data[o + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
          };
        const noiseA = periodicNoise(11),
          noiseB = periodicNoise(29),
          noiseC = periodicNoise(47),
          noiseD = periodicNoise(83);
        // Layer 0, ASPHALT (tile 12 units = 1.5 m): R the photographed aggregate's
        // brightness, G its stones (high-passed: the chips that catch the light),
        // B fine binder mottling, A medium mottling.
        {
          const l = normalisedLuma(atlasLayer(0), 0.2),
            blur = wrapBlur(l, 4);
          for (let i = 0; i < n; i++) {
            const u = (i % S) / S,
              v = Math.floor(i / S) / S;
            put(0, i, l[i], 0.5 + (l[i] - blur[i]) * 2.2, fbm(noiseA, u, v, 16, 3), fbm(noiseB, u, v, 4, 3));
          }
        }
        // Layer 1, GRASS (tile 10 units): the photographed lawn's colour over its
        // mean (0.5 = the mean) in RGB, its blade relief (high-passed) in A.
        {
          const rgba = atlasLayer(2),
            l = normalisedLuma(rgba, 0.22),
            blur = wrapBlur(l, 3),
            mean = [0, 0, 0];
          for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) mean[c] += rgba[i * 4 + c] / n;
          for (let i = 0; i < n; i++)
            put(
              1,
              i,
              (rgba[i * 4] / mean[0]) * 0.5,
              (rgba[i * 4 + 1] / mean[1]) * 0.5,
              (rgba[i * 4 + 2] / mean[2]) * 0.5,
              0.5 + (l[i] - blur[i]) * 2.4,
            );
        }
        // Layer 2, STONE (tile 8 units): R concrete grain (a joint-free patch of
        // the photographed paving, mirrored so it tiles), G broom streaks (fine
        // grooves along the layer's v axis), B granite speckle, A stain blotches.
        {
          const grain = normalisedLuma(atlasLayer(1, [0.035, 0.035, 0.29]), 0.2);
          let seed = 7;
          const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
          const speckle = new Float32Array(n).fill(0.5);
          // Granite: feldspar, quartz and mica grains, a few texels across.
          for (let k = 0; k < 5200; k++) {
            const cx = rnd() * S,
              cy = rnd() * S,
              r = 0.6 + rnd() * rnd() * 2.4,
              tone = rnd() < 0.45 ? 0.08 + rnd() * 0.2 : 0.72 + rnd() * 0.28;
            for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
              for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
                const d = Math.hypot(x - cx, y - cy);
                if (d > r) continue;
                speckle[((y + S) % S) * S + ((x + S) % S)] = tone;
              }
          }
          for (let i = 0; i < n; i++) {
            const u = (i % S) / S,
              v = Math.floor(i / S) / S;
            // Streaks: noise stretched 32:1 along v, broken up along their length.
            const broom = noiseC(u * 1, v / 32, 128) * 0.7 + noiseC(u, v / 16 + 0.5, 64) * 0.3,
              stain = fbm(noiseD, u, v, 3, 4);
            put(2, i, grain[i], broom * (0.75 + 0.25 * noiseA(u, v, 8)), speckle[i], stain);
          }
        }
        // Layer 3, LOOSE (tile 6 units): R gravel relief and G pebble tone (a
        // jittered grid of pebbles, each an ellipse with its own tone), B sand
        // grain, A bark mulch (elongated chips).
        {
          const relief = new Float32Array(n),
            tone = new Float32Array(n).fill(0.5),
            mulch = new Float32Array(n).fill(0.35);
          let seed = 31;
          const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
          const stamp = (cx, cy, rx, ry, a, fn) => {
            const c = Math.cos(a),
              s = Math.sin(a),
              r = Math.max(rx, ry);
            for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
              for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
                const dx = x - cx,
                  dy = y - cy,
                  lx = (dx * c + dy * s) / rx,
                  ly = (-dx * s + dy * c) / ry,
                  d = lx * lx + ly * ly;
                if (d < 1) fn(((y + S) % S) * S + ((x + S) % S), 1 - d);
              }
          };
          const cells = 28;
          for (let j = 0; j < cells; j++)
            for (let i = 0; i < cells; i++)
              for (let k = 0; k < 2; k++) {
                const cx = ((i + 0.2 + rnd() * 0.6) * S) / cells,
                  cy = ((j + 0.2 + rnd() * 0.6) * S) / cells,
                  rx = (S / cells) * (0.28 + rnd() * 0.22),
                  ry = rx * (0.6 + rnd() * 0.4),
                  t = 0.25 + rnd() * 0.7;
                stamp(cx, cy, rx, ry, rnd() * Math.PI, (idx, h) => {
                  const lift = Math.sqrt(h);
                  if (lift > relief[idx]) {
                    relief[idx] = lift;
                    tone[idx] = t;
                  }
                });
              }
          for (let k = 0; k < 1500; k++) {
            const t = 0.15 + rnd() * 0.7;
            stamp(rnd() * S, rnd() * S, 3 + rnd() * 6, 0.9 + rnd() * 1.4, rnd() * Math.PI, (idx, h) => {
              mulch[idx] = t * (0.7 + 0.3 * h);
            });
          }
          for (let i = 0; i < n; i++) {
            const u = (i % S) / S,
              v = Math.floor(i / S) / S;
            put(3, i, relief[i], tone[i], noiseB(u, v, 128) * 0.6 + noiseD(u, v, 64) * 0.4, mulch[i]);
          }
        }
        const tex = new Three.DataArrayTexture(data, S, S, DETAIL_LAYERS);
        tex.format = Three.RGBAFormat;
        tex.type = Three.UnsignedByteType;
        tex.wrapS = tex.wrapT = Three.RepeatWrapping;
        tex.magFilter = Three.LinearFilter;
        tex.minFilter = Three.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        return tex;
      }
      // ---- Carriageway fields -------------------------------------------------------------------
      const FIELD_RANGE = 64,
        INFO_CELL = 16;
      /**
       * A sheet's carriageway field. `roads` are the carriageways as primitives:
       * { seg: [ax, ay, bx, by], half } (a stroke with round ends, as strokeRoad
       * paints them), { box: [x0, y0, x1, y1] } or { ring: [x, y, inner, outer] },
       * each with `lane`, the lane width in units (0: no lanes). `style(x, y)` and
       * `park(x, y)` fill the info texture. Returns the textures and the uniforms'
       * values.
       */
      function buildGroundField(tile, cell, roads, style, park) {
        const W = Math.ceil(tile.w / cell),
          H = Math.ceil(tile.h / cell),
          dist = new Float32Array(W * H).fill(FIELD_RANGE),
          IW = Math.ceil(tile.w / INFO_CELL),
          IH = Math.ceil(tile.h / INFO_CELL),
          laneAt = new Float32Array(IW * IH),
          laneDist = new Float32Array(IW * IH).fill(FIELD_RANGE),
          // Info cells inside two carriageways at once: a junction box, no lanes.
          insideCount = new Uint8Array(IW * IH);
        for (const r of roads) {
          let x0, y0, x1, y1, sd;
          if (r.seg) {
            const [ax, ay, bx, by] = r.seg,
              dx = bx - ax,
              dy = by - ay,
              len2 = dx * dx + dy * dy || 1;
            x0 = Math.min(ax, bx) - r.half;
            x1 = Math.max(ax, bx) + r.half;
            y0 = Math.min(ay, by) - r.half;
            y1 = Math.max(ay, by) + r.half;
            sd = (x, y) => {
              const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
              return Math.hypot(x - ax - dx * t, y - ay - dy * t) - r.half;
            };
          } else if (r.box) {
            [x0, y0, x1, y1] = r.box;
            const cx = (x0 + x1) / 2,
              cy = (y0 + y1) / 2,
              hx = (x1 - x0) / 2,
              hy = (y1 - y0) / 2;
            sd = (x, y) => {
              const qx = Math.abs(x - cx) - hx,
                qy = Math.abs(y - cy) - hy;
              return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
            };
          } else {
            const [cx, cy, inner, outer] = r.ring;
            x0 = cx - outer;
            x1 = cx + outer;
            y0 = cy - outer;
            y1 = cy + outer;
            sd = (x, y) => {
              const d = Math.hypot(x - cx, y - cy);
              return Math.max(d - outer, inner - d);
            };
          }
          const i0 = Math.max(0, Math.floor((x0 - FIELD_RANGE - tile.x) / cell)),
            i1 = Math.min(W - 1, Math.ceil((x1 + FIELD_RANGE - tile.x) / cell)),
            j0 = Math.max(0, Math.floor((y0 - FIELD_RANGE - tile.y) / cell)),
            j1 = Math.min(H - 1, Math.ceil((y1 + FIELD_RANGE - tile.y) / cell));
          for (let j = j0; j <= j1; j++) {
            const y = tile.y + (j + 0.5) * cell;
            for (let i = i0; i <= i1; i++) {
              const d = sd(tile.x + (i + 0.5) * cell, y),
                k = j * W + i;
              if (d < dist[k]) dist[k] = d;
            }
          }
          // The lane width of the nearest carriageway, on the info grid.
          if (r.lane) {
            const a0 = Math.max(0, Math.floor((x0 - FIELD_RANGE - tile.x) / INFO_CELL)),
              a1 = Math.min(IW - 1, Math.ceil((x1 + FIELD_RANGE - tile.x) / INFO_CELL)),
              b0 = Math.max(0, Math.floor((y0 - FIELD_RANGE - tile.y) / INFO_CELL)),
              b1 = Math.min(IH - 1, Math.ceil((y1 + FIELD_RANGE - tile.y) / INFO_CELL));
            for (let b = b0; b <= b1; b++)
              for (let a = a0; a <= a1; a++) {
                const d = sd(tile.x + (a + 0.5) * INFO_CELL, tile.y + (b + 0.5) * INFO_CELL),
                  k = b * IW + a;
                if (d < -2 && insideCount[k] < 255) insideCount[k]++;
                if (d < laneDist[k]) {
                  laneDist[k] = d;
                  laneAt[k] = r.lane;
                }
              }
          }
        }
        const half = new Uint16Array(W * H);
        for (let k = 0; k < W * H; k++) half[k] = Three.DataUtils.toHalfFloat(Math.max(-FIELD_RANGE, Math.min(FIELD_RANGE, dist[k])));
        const distTex = new Three.DataTexture(half, W, H, Three.RedFormat, Three.HalfFloatType);
        distTex.magFilter = distTex.minFilter = Three.LinearFilter;
        distTex.wrapS = distTex.wrapT = Three.ClampToEdgeWrapping;
        distTex.generateMipmaps = false;
        distTex.needsUpdate = true;
        // Info: R the paving style, G the lane width (units), B park lawn.
        const info = new Uint8Array(IW * IH * 4);
        for (let b = 0; b < IH; b++)
          for (let a = 0; a < IW; a++) {
            const x = tile.x + (a + 0.5) * INFO_CELL,
              y = tile.y + (b + 0.5) * INFO_CELL,
              k = b * IW + a;
            info[k * 4] = style(x, y);
            info[k * 4 + 1] = insideCount[k] > 1 ? 0 : Math.min(255, Math.round(laneAt[k]));
            info[k * 4 + 2] = park(x, y) ? 255 : 0;
            info[k * 4 + 3] = 255;
          }
        const infoTex = new Three.DataTexture(info, IW, IH, Three.RGBAFormat, Three.UnsignedByteType);
        infoTex.magFilter = infoTex.minFilter = Three.NearestFilter;
        infoTex.generateMipmaps = false;
        infoTex.needsUpdate = true;
        return {
          dist: distTex,
          info: infoTex,
          rect: new Three.Vector4(tile.x, tile.y, 1 / tile.w, 1 / tile.h),
          bytes: W * H * 2 + IW * IH * 4,
        };
      }
      // Style lookups sample districtAt on a coarse grid (it is not cheap).
      function coarseStyle(tile, fn, step = 64) {
        const cols = Math.ceil(tile.w / step),
          rows = Math.ceil(tile.h / step),
          grid = new Uint8Array(cols * rows);
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) grid[j * cols + i] = fn(tile.x + (i + 0.5) * step, tile.y + (j + 0.5) * step);
        return (x, y) => {
          const i = Math.max(0, Math.min(cols - 1, Math.floor((x - tile.x) / step))),
            j = Math.max(0, Math.min(rows - 1, Math.floor((y - tile.y) / step)));
          return grid[j * cols + i];
        };
      }
      // The city sheet's carriageways: the grid streets and the boulevards.
      function cityCarriageways() {
        const roads = [];
        for (const r of cityStreets()) {
          const [a, b] = r.points;
          roads.push({ seg: [a[0], a[1], b[0], b[1]], half: r.width / 2, lane: r.width >= 112 ? 28 : r.width / 2 });
        }
        for (const road of BOULEVARDS)
          for (let i = 1; i < road.points.length; i++) {
            const a = road.points[i - 1],
              b = road.points[i];
            roads.push({ seg: [a[0], a[1], b[0], b[1]], half: road.width / 2, lane: road.width / 2 });
          }
        return roads;
      }
      function countyCarriageways() {
        const roads = [];
        for (const road of COUNTY_ROADS)
          for (let i = 1; i < road.points.length; i++) {
            const a = road.points[i - 1],
              b = road.points[i];
            roads.push({ seg: [a[0], a[1], b[0], b[1]], half: road.width / 2, lane: road.width >= 96 ? 28 : road.width / 2 });
          }
        for (const road of SERVICE_ROADS)
          for (let i = 1; i < road.points.length; i++) {
            const a = road.points[i - 1],
              b = road.points[i];
            roads.push({ seg: [a[0], a[1], b[0], b[1]], half: road.width / 2, lane: 0 });
          }
        return roads;
      }
      // Monarch Isle: the streets kerb to kerb (a divided boulevard is two
      // carriageways either side of its median, joined across the junctions),
      // the two roundabouts and the bridge approaches.
      function monarchCarriageways() {
        const roads = [];
        for (const s of ISLE_STREETS) {
          const lines = s.divided ? [-ISLE_DIVIDED_LANE, ISLE_DIVIDED_LANE] : [0],
            half = s.divided ? ISLE_CARRIAGEWAY / 2 : ISLE_STREET / 2,
            k = isleKerbHalf(s.at, s.vertical);
          for (const off of lines) {
            const c = s.at + off;
            if (s.vertical) roads.push({ box: [c - half, s.from - k, c + half, s.to + k], lane: s.divided ? ISLE_CARRIAGEWAY : ISLE_STREET / 2 });
            else roads.push({ box: [s.from - k, c - half, s.to + k, c + half], lane: s.divided ? ISLE_CARRIAGEWAY : ISLE_STREET / 2 });
          }
        }
        for (const j of isleJunctions()) {
          const kx = isleKerbHalf(j.x, true),
            ky = isleKerbHalf(j.y, false);
          roads.push({ box: [j.x - kx, j.y - ky, j.x + kx, j.y + ky], lane: 0 });
        }
        for (const c of ISLE_CIRCLES) roads.push({ ring: [c.x, c.y, c.island + 3, c.outer], lane: c.outer - c.island - 3 });
        for (const b of MONARCH_BRIDGES) roads.push({ seg: [b.a[0], b.a[1], b.b[0], b.b[1]], half: (b.width - 22) / 2, lane: (b.width - 22) / 4 });
        return roads;
      }
      // ---- Marks --------------------------------------------------------------------------------
      /**
       * Record kinds (MARK_KIND) and their layout in the data texture, two RGBA
       * float texels each:
       *   A = (centre x, centre z, half length, half width or radius)
       *   B = (direction x, direction z, kind + 16 * paint + 64 * wear,
       *        pattern: dash length * 4 * 4096 + period * 4)
       * Paint: 0 white, 1 lane cream, 2 yellow. Wear 0..3.
       */
      const MARK_KIND = { solid: 1, dash: 2, manhole: 3, grate: 4, tree: 5, stain: 6, tactile: 7 },
        MARK_PAINT = { white: 0, lane: 1, yellow: 2 },
        MARK_CELL = 32,
        MARK_MAX_PER_CELL = 10;
      function markRecord(kind, cx, cz, hl, hw, dx, dz, paint = 0, wear = 0, len = 0, period = 0) {
        return { kind, cx, cz, hl, hw, dx, dz, code: kind + 16 * paint + 64 * wear, pattern: Math.round(len * 4) * 4096 + Math.round(period * 4) };
      }
      // A marking shape (streets.js ROAD MARKINGS) as a record.
      function shapeRecord(m, wear = 1) {
        const len = Math.hypot(m.bx - m.ax, m.by - m.ay) || 1,
          dx = (m.bx - m.ax) / len,
          dz = (m.by - m.ay) / len,
          paint = MARK_PAINT[m.paint] ?? (/^#d7c/.test(m.paint) ? MARK_PAINT.lane : MARK_PAINT.white);
        return markRecord(
          m.pattern === 'solid' ? MARK_KIND.solid : MARK_KIND.dash,
          (m.ax + m.bx) / 2,
          (m.ay + m.by) / 2,
          len / 2,
          m.hw,
          dx,
          dz,
          paint,
          m.wear ?? wear,
          m.len || 0,
          m.period || 0,
        );
      }
      // Stop lines, avenue centre lines, manholes, gully grates and the oil
      // dropped at the stop lines: the city's street furniture in the road
      // (these used to be painted into the 3D ground sheet by render3d.js).
      function cityStreetRecords() {
        const out = [],
          streets = cityStreets();
        // Avenues carry a double yellow centre line that stops short of every
        // junction (at its stop line) and of the street's end.
        for (const r of streets) {
          if (r.width < 112) continue;
          const crossings = streets
            .filter((o) => o.vertical !== r.vertical && r.r >= o.start - 6 && r.r <= o.end + 6 && o.r > r.start && o.r < r.end)
            .map((o) => [o.r - o.width / 2 - 24, o.r + o.width / 2 + 24]);
          const runs = [[r.start + 30, r.end - 30]];
          for (const [c0, c1] of crossings)
            for (let i = runs.length - 1; i >= 0; i--) {
              const [s0, s1] = runs[i];
              if (c1 <= s0 || c0 >= s1) continue;
              runs.splice(i, 1, ...[[s0, c0], [c1, s1]].filter(([p, q]) => q - p > 20));
            }
          for (const [v0, v1] of runs)
            for (const offset of [-2.4, 2.4]) {
              const mid = (v0 + v1) / 2,
                [cx, cz] = r.vertical ? [r.r + offset, mid] : [mid, r.r + offset],
                [dx, dz] = r.vertical ? [0, 1] : [1, 0];
              out.push(markRecord(MARK_KIND.solid, cx, cz, (v1 - v0) / 2, 0.8, dx, dz, MARK_PAINT.yellow, 1));
            }
        }
        // Stop lines across the approach lanes at every signalled junction, just
        // before the crossing (traffic keeps right), and oil under the idling
        // cars behind them.
        for (const x of ROAD_CENTERS)
          for (const z of ROAD_ROWS) {
            if (!cityIntersectionAt(x, z) || !groundAt(x, z, 92) || inHarbor(x, z, 100)) continue;
            const col = streets.find((r) => r.vertical && r.r === x && z > r.start && z < r.end),
              row = streets.find((r) => !r.vertical && r.r === z && x > r.start && x < r.end);
            if (!col || !row) continue;
            const hc = col.width / 2,
              hr = row.width / 2,
              laneC = col.width >= 112 ? 28 : hc,
              laneR = row.width >= 112 ? 28 : hr,
              seed = (x * 7 + z * 13) >>> 0;
            // [line centre x, z, half along the line, direction of the line, lane centre offset, approach direction]
            const approaches = [
              [x - hc / 2, z - hr - 21.5, hc / 2, [1, 0], [-1, 0], [0, -1], laneC],
              [x + hc / 2, z + hr + 21.5, hc / 2, [1, 0], [1, 0], [0, 1], laneC],
              [x + hc + 21.5, z - hr / 2, hr / 2, [0, 1], [0, -1], [1, 0], laneR],
              [x - hc - 21.5, z + hr / 2, hr / 2, [0, 1], [0, 1], [-1, 0], laneR],
            ];
            approaches.forEach(([cx, cz, half, dir, , back, lane], k) => {
              out.push(markRecord(MARK_KIND.solid, cx, cz, half, 1.5, dir[0], dir[1], MARK_PAINT.white, 1));
              // Each lane's idling spot: the oil drips down the middle of the lane.
              const lanes = Math.max(1, Math.round((half * 2) / lane));
              for (let l = 0; l < lanes; l++) {
                const across = -half + lane * (l + 0.5),
                  depth = 14 + ((seed >> (k * 3 + l)) % 7) * 2,
                  ox = cx + dir[0] * across + back[0] * depth,
                  oz = cz + dir[1] * across + back[1] * depth;
                out.push(markRecord(MARK_KIND.stain, ox, oz, 9 + (l % 2) * 3, 2.6, back[0], back[1], 0, 0));
              }
            });
          }
        // Dropped kerbs with tactile paving where each zebra meets the pavement.
        for (const c of cityCrosswalks()) {
          if (c.w > c.h)
            for (const x of [c.x - 2.2, c.x + c.w + 2.2]) out.push(markRecord(MARK_KIND.tactile, x, c.y + c.h / 2, c.h / 2 + 1, 3.2, 0, 1));
          else for (const z of [c.y - 2.2, c.y + c.h + 2.2]) out.push(markRecord(MARK_KIND.tactile, c.x + c.w / 2, z, c.w / 2 + 1, 3.2, 1, 0));
        }
        // Manhole covers and utility plates along the roadway.
        for (let i = 0; i < 260; i++) {
          const mx = CITY_LEFT + 100 + ((i * 7919) % (CITY_WIDTH - 200)),
            mz = 100 + ((i * 104729) % (CITY_SIZE - 200));
          if (!onRoad(mx, mz) || onBridge(mx, mz)) continue;
          out.push(markRecord(MARK_KIND.manhole, mx, mz, 3, 3, 1, 0, 0, i % 4));
        }
        // Gully grates in the east gutter where the street really runs.
        for (const road of streets.filter((s) => s.vertical))
          for (let z = CITY_TOP + 240; z < CITY_SIZE - 150; z += 230) {
            if (z < road.start + 20 || z > road.end - 30 || !onRoad(road.r + road.width / 2 - 4, z)) continue;
            if (streets.some((o) => !o.vertical && Math.abs(o.r - z) < o.width / 2 + 26 && road.r > o.start && road.r < o.end)) continue;
            out.push(markRecord(MARK_KIND.grate, road.r + road.width / 2 - 3.2, z + 5.5, 5.5, 3.2, 0, 1, 0, 0));
          }
        // Boulevard lane dashes (19 on, 14 off down the whole polyline).
        for (const road of BOULEVARDS) {
          let phase = 0;
          for (let i = 1; i < road.points.length; i++) {
            const a = road.points[i - 1],
              b = road.points[i],
              len = Math.hypot(b[0] - a[0], b[1] - a[1]),
              dx = (b[0] - a[0]) / len,
              dz = (b[1] - a[1]) / len;
            // The pattern restarts at each segment's first whole dash.
            const start = (33 - (phase % 33)) % 33;
            if (len - start > 19) {
              const count = Math.floor((len - start + 14) / 33),
                span = count * 33 - 14,
                mid = start + span / 2;
              out.push(markRecord(MARK_KIND.dash, a[0] + dx * mid, a[1] + dz * mid, span / 2, 1, dx, dz, MARK_PAINT.lane, 1, 19, 33));
            }
            phase += len;
          }
        }
        return out;
      }
      // The bay lines of each city block's car park (render3d.js paints the
      // tarmac): 1 unit wide, every 26, in two rows. Faded, and only where the
      // tarmac still shows (wear 3).
      function cityLotRecords() {
        const out = [];
        for (let bx = BLOCK_X_MIN; bx <= BLOCK_X_MAX; bx++)
          for (let by = BLOCK_Y_MIN; by <= BLOCK_Y_MAX; by++) {
            const x = blockX(bx) + 79,
              z = blockY(by) + 79;
            if (!validCityBlock(x + 10, z + 10) || harborOverlap(x, z, 354, 354) || stadiumOverlap(x, z, 354, 354)) continue;
            if ((bx === -4 && by === 4) || isPark(bx, by)) continue;
            let last = x + 20;
            while (last + 26 < x + 340) last += 26;
            for (const [z0, z1] of [
              [178, 218],
              [291, 330],
            ])
              out.push(markRecord(MARK_KIND.dash, (x + 19.5 + last + 0.5) / 2, z + (z0 + z1) / 2, (last + 0.5 - x - 19.5) / 2, (z1 - z0) / 2, 1, 0, MARK_PAINT.white, 3, 1, 26));
          }
        return out;
      }
      // Monarch Isle's paint: centre dashes on the plain streets, edge lines on
      // the boulevards, zebras and stop lines at every junction.
      function monarchRecords() {
        const out = [];
        for (const s of ISLE_STREETS)
          for (const piece of isleCarriageways(s)) {
            const [a, b] = piece.points,
              len = Math.hypot(b[0] - a[0], b[1] - a[1]),
              ux = (b[0] - a[0]) / len,
              uy = (b[1] - a[1]) / len;
            const runs = (step, from, pad, keep) => {
              const list = [];
              let run = null;
              for (let d = from; d < len - from; d += step) {
                const x = a[0] + ux * d,
                  y = a[1] + uy * d,
                  ok = keep(x, y) && !isleJunctionNear(x, y, pad) && !isleCircleAt(x, y, -20);
                if (ok && run) run[1] = d;
                else if (ok) run = [d, d];
                else if (run) list.push(run), (run = null);
              }
              if (run) list.push(run);
              return list;
            };
            if (!s.divided)
              for (const [d0, d1] of runs(36, 20, 26, () => true)) {
                const mid = (d0 + d1 + 18) / 2;
                out.push(markRecord(MARK_KIND.dash, a[0] + ux * mid, a[1] + uy * mid, (d1 + 18 - d0) / 2, 0.9, ux, uy, MARK_PAINT.white, 1, 18, 36));
              }
            else
              for (const side of [-1, 1]) {
                const off = side * (ISLE_CARRIAGEWAY / 2 - 4);
                for (const [d0, d1] of runs(6, 10, 30, () => true)) {
                  const mid = (d0 + d1 + 6.2) / 2;
                  out.push(markRecord(MARK_KIND.solid, a[0] + ux * mid - uy * off, a[1] + uy * mid + ux * off, (d1 + 6.2 - d0) / 2, 0.8, ux, uy, MARK_PAINT.white, 1));
                }
              }
          }
        for (const j of isleJunctions())
          for (const arm of j.arms) {
            const ux = Math.cos(arm.a),
              uy = Math.sin(arm.a),
              cx = j.x + ux * (arm.box + 14),
              cy = j.y + uy * (arm.box + 14);
            // Bars 18 long (along the arm), 4 wide, every 7 across it.
            const first = -arm.width / 2 + 3;
            let last = first;
            while (last + 7 < arm.width / 2 - 3) last += 7;
            const mid = (first + last + 4) / 2;
            out.push(markRecord(MARK_KIND.dash, cx - uy * mid, cy + ux * mid, (last + 4 - first) / 2, 9, -uy, ux, MARK_PAINT.white, 1, 4, 7));
            // The stop line on the approach (right-hand side, coming in).
            const sOff = 2 + (arm.width / 2 - 4) / 2;
            out.push(markRecord(MARK_KIND.solid, cx + ux * 13.2 - uy * sOff, cy + uy * 13.2 + ux * sOff, (arm.width / 2 - 4) / 2, 1.2, -uy, ux, MARK_PAINT.white, 1));
          }
        return out;
      }
      // Tree bases: a pit in the pavement, a ring of mulch on a lawn (the shader
      // decides which from the ground under it). Street and park trees in the
      // city and on Monarch Isle; the county's wild trees stand in the grass.
      function treeRecords() {
        const out = [];
        for (const t of trees) {
          if (t.county && !(t.x > MONARCH_TILE.x && t.y < MONARCH_TILE.y + MONARCH_TILE.h)) continue;
          const tropical = t.tropical ?? (onPalmKeys(t.x) && !t.county),
            r = tropical ? 5 : Math.max(5, Math.min(9, t.r * 0.42));
          out.push(markRecord(MARK_KIND.tree, t.x, t.y, r, r, 1, 0, 0, tropical ? 1 : 0));
        }
        return out;
      }
      // Files the records in a 32-unit grid over the world box: the index holds
      // (first record, count) per cell, the data each cell's records in a row.
      function buildGroundMarks(records) {
        const x0 = WORLD_LEFT,
          z0 = WORLD_TOP,
          cols = Math.ceil((WORLD_SIZE - WORLD_LEFT) / MARK_CELL),
          rows = Math.ceil((WORLD_SIZE - WORLD_TOP) / MARK_CELL),
          cells = new Map();
        let dropped = 0;
        for (const r of records) {
          // The rotated rectangle's bounds, plus a unit for the worn edges.
          const ex = Math.abs(r.dx) * r.hl + Math.abs(r.dz) * r.hw + 1.5,
            ez = Math.abs(r.dz) * r.hl + Math.abs(r.dx) * r.hw + 1.5,
            i0 = Math.max(0, Math.floor((r.cx - ex - x0) / MARK_CELL)),
            i1 = Math.min(cols - 1, Math.floor((r.cx + ex - x0) / MARK_CELL)),
            j0 = Math.max(0, Math.floor((r.cz - ez - z0) / MARK_CELL)),
            j1 = Math.min(rows - 1, Math.floor((r.cz + ez - z0) / MARK_CELL));
          for (let j = j0; j <= j1; j++)
            for (let i = i0; i <= i1; i++) {
              const key = j * cols + i;
              let list = cells.get(key);
              if (!list) cells.set(key, (list = []));
              if (list.length < MARK_MAX_PER_CELL) list.push(r);
              else dropped++;
            }
        }
        let total = 0;
        for (const list of cells.values()) total += list.length;
        const DATA_W = 2048,
          dataRows = Math.max(1, Math.ceil((total * 2) / DATA_W)),
          data = new Float32Array(DATA_W * dataRows * 4),
          index = new Float32Array(cols * rows * 2);
        let at = 0;
        for (const [key, list] of cells) {
          index[key * 2] = at;
          index[key * 2 + 1] = list.length;
          for (const r of list) {
            const o = at * 8;
            data.set([r.cx, r.cz, r.hl, r.hw, r.dx, r.dz, r.code, r.pattern], o);
            at++;
          }
        }
        const indexTex = new Three.DataTexture(index, cols, rows, Three.RGFormat, Three.FloatType),
          dataTex = new Three.DataTexture(data, DATA_W, dataRows, Three.RGBAFormat, Three.FloatType);
        for (const t of [indexTex, dataTex]) {
          t.magFilter = t.minFilter = Three.NearestFilter;
          t.generateMipmaps = false;
          t.needsUpdate = true;
        }
        return {
          index: indexTex,
          data: dataTex,
          grid: new Three.Vector4(x0, z0, 1 / MARK_CELL, cols),
          rows,
          records: records.length,
          filed: total,
          dropped,
          bytes: index.byteLength + data.byteLength,
        };
      }
      // ---- Build everything the ground materials need -----------------------------------------------
      const groundBuildStart = performance.now(),
        groundBuildLaps = {};
      const groundDetail = buildDetailLayers();
      groundBuildLaps.detail = Math.round(performance.now() - groundBuildStart);
      const cityFrame = { x: CITY_LEFT, y: CITY_TOP, w: CITY_WIDTH, h: CITY_HEIGHT };
      const cityParks = [...CITY_PARKS, SOUTH_PROMENADE];
      const cityField = buildGroundField(
        cityFrame,
        4,
        cityCarriageways(),
        coarseStyle(cityFrame, cityGroundStyle),
        (x, y) => cityParks.some((p) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h),
      );
      const monarchField = buildGroundField(
        MONARCH_TILE,
        4,
        monarchCarriageways(),
        (x, y) => (y < -4990 ? GROUND_STYLE.beach : GROUND_STYLE.monarch),
        () => false,
      );
      // The county sheets share one field over the county's box (6 units a texel).
      const countyFrame = { x: 0, y: 0, w: WORLD_SIZE, h: WORLD_SIZE },
        countyField = buildGroundField(
          countyFrame,
          6,
          countyCarriageways(),
          () => GROUND_STYLE.county,
          () => false,
        );
      groundBuildLaps.fields = Math.round(performance.now() - groundBuildStart) - groundBuildLaps.detail;
      const groundMarks = buildGroundMarks([
        ...cityMarkingShapes()
          .filter((m) => !m.avenue)
          .map((m) => shapeRecord(m)),
        ...countyMarkingShapes().map((m) => shapeRecord(m, 2)),
        ...cityStreetRecords(),
        ...cityLotRecords(),
        ...monarchRecords(),
        ...treeRecords(),
      ]);
      const groundDataReport = {
        ms: Math.round(performance.now() - groundBuildStart),
        laps: groundBuildLaps,
        detailBytes: Math.round(DETAIL_SIZE * DETAIL_SIZE * 4 * DETAIL_LAYERS * 1.333),
        fieldBytes: cityField.bytes + monarchField.bytes + countyField.bytes,
        marks: { records: groundMarks.records, filed: groundMarks.filed, dropped: groundMarks.dropped, bytes: groundMarks.bytes },
      };
      // END SUBSYSTEM: src/ground-data3d.js
