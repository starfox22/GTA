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
          // and fades out raggedly towards the field's edge (no straight forest line).
          const edge = Math.min(c, r, cols - 1 - c, rows - 1 - r) * TERRAIN_CELL;
          f *= smoothStep(40, 420, edge + stands * 500);
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
          p.mountain ||
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
      const add = (id, kind, name, b, door, mountain = false) => {
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
          // Dressed by mountain-village3d.js (civic3d.js draws only its door ring).
          mountain,
        });
      };
      for (const [i, t] of COUNTY_TOWNS.entries()) {
        // A mountain village's OUTFITTERS and LODGE stand where its plan put
        // them (mountain-village.js); the other towns keep the old spots.
        const guns = mountainServiceSpot(t, 'guns'),
          sleep = mountainServiceSpot(t, 'sleep');
        if (guns && sleep) {
          add('county-guns-' + i, 'guns', t.name + ' OUTFITTERS', guns.b, guns.door, true);
          add('county-sleep-' + i, 'sleep', t.name + ' LODGE', sleep.b, sleep.door, true);
          continue;
        }
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
    // Northridge's north-west block is the 4x4 club's (offroad.js): no market lane through it.
    for (const town of COUNTY_TOWNS.filter((t) => t.name !== 'NORTHRIDGE'))
      SERVICE_ROADS.push({
        name: town.name + ' MARKET STREET',
        width: 36,
        points: [
          [town.x, town.y + 240],
          [town.x + BLOCK_SIZE, town.y + 240],
        ],
      });
