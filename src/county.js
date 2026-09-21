    // BEGIN SUBSYSTEM: src/county.js — Outlying districts
    /**
     * Outlying districts
     * Source: src/county.js
     * Scope: shared game closure.
     * County roads, buildings, scenery, traffic, towns, regional police and bridges.
     */
    /* South Coast County: shared playable geography, roads and map data. Legacy missions retain their coordinates. */
    const COUNTY_REGIONS = [
      {
        id: 'ridgeline',
        name: 'RIDGELINE COUNTY',
        color: '#577761',
        beach: false,
        polygon: [
          [6350, 280],
          [7180, 130],
          [7800, 420],
          [8490, 190],
          [9200, 350],
          [10100, 220],
          [10760, 670],
          [10900, 1510],
          [10670, 2350],
          [10970, 3120],
          [10750, 3670],
          [11030, 4600],
          [10750, 5220],
          [10150, 5800],
          [9300, 6000],
          [8500, 6260],
          [7800, 5940],
          [7000, 6150],
          [6440, 5560],
          [6130, 4800],
          [6020, 3990],
          [6130, 3200],
          [5900, 2420],
          [6130, 1770],
          [5880, 1090],
        ],
      },
      {
        id: 'oceanview',
        name: 'OCEANVIEW COUNTY',
        color: '#829378',
        beach: true,
        polygon: [
          [2050, 6350],
          [2930, 6240],
          [3540, 6470],
          [4430, 6200],
          [5300, 6430],
          [5890, 6920],
          [6110, 7580],
          [5860, 8140],
          [6300, 8680],
          [6490, 9660],
          [6040, 10500],
          [5340, 10910],
          [4430, 10760],
          [3620, 10950],
          [2800, 10600],
          [2120, 10180],
          [1560, 9400],
          [1360, 8500],
          [1610, 7930],
          [1430, 7230],
          [1710, 6700],
        ],
      },
      {
        id: 'coralcoast',
        name: 'CORAL COAST',
        color: '#93a78e',
        beach: true,
        polygon: [
          [7180, 6740],
          [7720, 6930],
          [8060, 7410],
          [8250, 8020],
          [8050, 8610],
          [8160, 9170],
          [7750, 9710],
          [7060, 9600],
          [6520, 9160],
          [6290, 8580],
          [6460, 8000],
          [6590, 7450],
          [6840, 7100],
        ],
      },
      {
        id: 'sentinel',
        name: 'FORT SENTINEL · RESTRICTED',
        color: '#727d63',
        beach: false,
        polygon: [
          [9240, 7130],
          [9920, 7060],
          [10550, 7490],
          [10850, 8060],
          [10790, 8690],
          [11000, 9400],
          [10630, 10180],
          [9940, 10500],
          [9360, 10270],
          [8840, 9730],
          [8680, 9020],
          [8870, 8500],
          [8790, 8020],
          [8960, 7580],
        ],
      },
    ];
    // Smaller coves break up the shoreline without changing road or mission positions.
    for (const reg of COUNTY_REGIONS) {
      const source = reg.polygon;
      reg.polygon = source.flatMap((a, i) => {
        const b = source[(i + 1) % source.length],
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          len = Math.hypot(dx, dy),
          n = Math.max(2, Math.ceil(len / 135));
        return Array.from(
          {
            length: n,
          },
          (_, j) => {
            const t = j / n,
              bend = Math.sin(t * Math.PI) * (28 * Math.sin(i * 2.39) + 16 * Math.sin(j * 2.1));
            return [a[0] + dx * t - (dy / len) * bend, a[1] + dy * t + (dx / len) * bend];
          },
        );
      });
    }
    LAND_REGIONS.push(...COUNTY_REGIONS);
    const COUNTY_BRIDGES = [
      {
        name: 'EAST BAY CROSSING',
        width: 122,
        a: [5248, 3200],
        b: [6580, 3200],
      },
      {
        name: 'OCEANVIEW CAUSEWAY',
        width: 128,
        a: [2176, 4900],
        b: [2176, 7010],
      },
      {
        name: 'CORAL SOUND BRIDGE',
        width: 116,
        a: [5700, 8000],
        b: [6750, 8000],
      },
      {
        name: 'RIDGELINE VIADUCT',
        width: 116,
        a: [7800, 5620],
        b: [7433.016, 7262.254],
      },
      {
        name: 'SENTINEL CAUSEWAY',
        width: 126,
        a: [7800, 8150],
        b: [9440, 8150],
      },
      {
        // Palm Ave drops off the Stadium Way crossing and runs out to the pier.
        name: 'SUNSET PIER CAUSEWAY',
        width: 104,
        a: [3712, 4736],
        b: [3712, 4980],
      },
    ];
    const COUNTY_TOWNS = [
      {
        name: 'STONECREEK',
        x: 6720,
        y: 3200,
        style: 'brick',
        color: '#667f74',
      },
      {
        name: 'NORTHRIDGE',
        x: 8420,
        y: 2600,
        style: 'hill',
        color: '#719070',
      },
      {
        name: 'EASTGATE',
        x: 8900,
        y: 4700,
        style: 'industrial',
        color: '#858779',
      },
      {
        name: 'OCEANVIEW',
        x: 2176,
        y: 7010,
        style: 'coast',
        color: '#93a190',
      },
      {
        name: 'PALMSHORE',
        x: 6750,
        y: 7600,
        style: 'resort',
        color: '#99b2a0',
      },
    ];
    const COUNTY_ROADS = [
      {
        name: 'RIDGELINE HIGHWAY',
        width: 108,
        points: [
          [6400, 3200],
          [6600, 2900],
          [6630, 2510],
          [6920, 2220],
          [7200, 2320],
          [7530, 2570],
          [7940, 2710],
          [8420, 2600],
          [8932, 2600],
          [9500, 2860],
          [9970, 3390],
          [10150, 4100],
          [9924, 4700],
          [9924, 5212],
          [9400, 5880],
          [8500, 5790],
          [7800, 5620],
          [7360, 5260],
          [7250, 4700],
          [7232, 4224],
        ],
      },
      {
        name: 'STONECREEK CONNECTOR',
        width: 100,
        points: [
          [6400, 3200],
          [6720, 3200],
          [7232, 3200],
          [7800, 3350],
          [8420, 3112],
          [8932, 3112],
        ],
      },
      {
        name: 'EASTGATE APPROACH',
        width: 96,
        points: [
          [7744, 4224],
          [8130, 4410],
          [8550, 4630],
          [8900, 4700],
        ],
      },
      {
        name: 'EAGLE PASS',
        width: 82,
        points: [
          [6630, 2510],
          [6410, 2190],
          [6500, 1800],
          [6840, 1640],
          [7140, 1690],
          [7510, 1970],
          [7990, 1890],
          [8370, 2010],
          [8510, 2300],
          [8420, 2600],
        ],
      },
      {
        name: 'OCEANVIEW PARKWAY',
        width: 110,
        points: [
          [2176, 7010],
          [2176, 7522],
          [2176, 8034],
          [2440, 8420],
          [3050, 8500],
          [3510, 8300],
          [3800, 8450],
          [3800, 8700],
          [4590, 8770],
          [5100, 8500],
          [5580, 8270],
          [5700, 8000],
        ],
      },
      {
        name: 'BEACH ROAD',
        width: 88,
        points: [
          [3200, 7010],
          [3710, 6890],
          [4200, 7120],
          [4600, 7480],
          [4780, 7910],
          [5100, 8200],
          [5580, 8270],
        ],
      },
      {
        name: 'CORAL COAST DRIVE',
        width: 90,
        points: [
          [7433.016, 7262.254],
          [7500, 7490],
          [7262, 7600],
          [6750, 7600],
          [6750, 8112],
          [6750, 8624],
          [6970, 9040],
          [7390, 9290],
          [7750, 9100],
          [7810, 8630],
          [7800, 8150],
          [7774, 7600],
        ],
      },
      ...COUNTY_BRIDGES.map((b) => ({
        name: b.name,
        width: b.width,
        points: [b.a, b.b],
        bridge: true,
      })),
    ];
    for (const town of COUNTY_TOWNS)
      for (let i = 0; i < 3; i++) {
        COUNTY_ROADS.push(
          {
            name: town.name + ' STREET',
            width: 88,
            points: [
              [town.x + i * BLOCK_SIZE, town.y],
              [town.x + i * BLOCK_SIZE, town.y + BLOCK_SIZE * 2],
            ],
          },
          {
            name: town.name + ' AVENUE',
            width: 88,
            points: [
              [town.x, town.y + i * BLOCK_SIZE],
              [town.x + BLOCK_SIZE * 2, town.y + i * BLOCK_SIZE],
            ],
          },
        );
      }
    const COUNTY_PEAKS = [
      {
        x: 6390,
        y: 1000,
        r: 250,
        h: 240,
      },
      {
        x: 6820,
        y: 950,
        r: 360,
        h: 310,
      },
      {
        x: 7380,
        y: 1230,
        r: 310,
        h: 290,
      },
      {
        x: 7790,
        y: 720,
        r: 350,
        h: 370,
      },
      {
        x: 8100,
        y: 1340,
        r: 330,
        h: 280,
      },
      {
        x: 8840,
        y: 1120,
        r: 430,
        h: 380,
      },
      {
        x: 9630,
        y: 1230,
        r: 460,
        h: 350,
      },
      {
        x: 10070,
        y: 2270,
        r: 300,
        h: 270,
      },
      {
        x: 6800,
        y: 5300,
        r: 320,
        h: 225,
      },
      {
        x: 4330,
        y: 6740,
        r: 220,
        h: 200,
      },
    ];
    const COUNTY_AIRPORT = {
      name: 'OCEANVIEW INTERNATIONAL',
      x: 3440,
      y: 8540,
      w: 2800,
      h: 1670,
      door: {
        x: 4080,
        y: 8730,
      },
      runway: {
        x: 3600,
        y: 9800,
        w: 2480,
        h: 168,
      },
      terminal: {
        x: 3880,
        y: 8420,
        w: 670,
        h: 220,
      },
    };
    const countyGroundTiles = [],
      countyDecor = [];
    function onCountyRoad(x, y, margin = 0) {
      return COUNTY_ROADS.some((r) =>
        r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + margin),
      );
    }
    function onCountyBridge(x, y, r = 0) {
      return COUNTY_BRIDGES.some((b) => {
        const pad = b.width / 2 - r;
        return (
          x >= Math.min(b.a[0], b.b[0]) - pad &&
          x <= Math.max(b.a[0], b.b[0]) + pad &&
          y >= Math.min(b.a[1], b.b[1]) - pad &&
          y <= Math.max(b.a[1], b.b[1]) + pad &&
          segmentDistance(x, y, b.a, b.b) <= pad
        );
      });
    }
    function countyRegionAt(x, y) {
      return COUNTY_REGIONS.find((r) => regionContains(r, x, y));
    }
    const countyStaticSolids = COUNTY_PEAKS.map((p) => ({
      x: p.x - p.r * 0.55,
      y: p.y - p.r * 0.55,
      w: p.r * 1.1,
      h: p.r * 1.1,
      height: p.h,
      kind: 'mountain',
    }));
    function countySolids() {
      return [...countyStaticSolids, ...AIRPORT_SCENERY_SOLIDS];
    }
    function countyBlocked(x, y, r = 8) {
      return countySolids().some(
        (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h,
      );
    }
    function paintCountyGround(drawingContext, detail = true) {
      for (const reg of COUNTY_REGIONS) {
        drawingContext.save();
        regionPath(drawingContext, reg);
        drawingContext.clip();
        drawingContext.fillStyle =
          reg.id === 'ridgeline' ? '#52694a' : reg.id === 'sentinel' ? '#657057' : '#7e9068';
        drawingContext.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
        regionPath(drawingContext, reg);
        drawingContext.strokeStyle = reg.beach ? '#cfc29e' : '#73877b';
        drawingContext.lineWidth = reg.beach ? 100 : 32;
        drawingContext.stroke();
        drawingContext.restore();
      }
      paintMountainGround(drawingContext);
      for (const t of COUNTY_TOWNS) {
        drawingContext.fillStyle = t.color;
        drawingContext.fillRect(t.x - 64, t.y - 64, BLOCK_SIZE * 2 + 128, BLOCK_SIZE * 2 + 128);
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 2; j++) {
            drawingContext.fillStyle = (i + j) % 2 ? '#8e9981' : '#758d69';
            drawingContext.fillRect(t.x + i * BLOCK_SIZE + 60, t.y + j * BLOCK_SIZE + 60, 392, 392);
          }
      }
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      const ap = COUNTY_AIRPORT;
      drawingContext.fillStyle = '#748071';
      drawingContext.fillRect(ap.x, ap.y, ap.w, ap.h);
      drawingContext.fillStyle = '#a6a69a';
      drawingContext.fillRect(ap.x + 40, ap.y + 130, ap.w - 100, 730);
      drawingContext.fillStyle = '#454e50';
      drawingContext.fillRect(ap.runway.x, ap.runway.y, ap.runway.w, ap.runway.h);
      drawingContext.fillStyle = '#dfdcc6';
      for (let x = ap.runway.x + 170; x < ap.runway.x + ap.runway.w - 130; x += 95)
        drawingContext.fillRect(x, ap.runway.y + 82, 50, 4);
      for (const x of [ap.runway.x + 40, ap.runway.x + ap.runway.w - 100])
        for (let y = ap.runway.y + 16; y < ap.runway.y + 155; y += 20)
          drawingContext.fillRect(x, y, 60, 9);
      drawingContext.fillStyle = '#d9d4b6';
      drawingContext.font = 'bold 42px monospace';
      drawingContext.fillText('09', ap.runway.x + 125, ap.runway.y + 100);
      drawingContext.fillText('27', ap.runway.x + ap.runway.w - 175, ap.runway.y + 100);
      drawingContext.strokeStyle = '#d7b973';
      drawingContext.lineWidth = 3;
      for (const x of [3750, 4500, 5260, 5910]) {
        drawingContext.beginPath();
        drawingContext.moveTo(x, ap.runway.y);
        drawingContext.lineTo(x, ap.runway.y - 260);
        drawingContext.lineTo(x - 80, ap.y + 330);
        drawingContext.stroke();
      }
      drawingContext.restore();
      paintCountyRoads(drawingContext, detail);
      for (const r of SERVICE_ROADS) strokeRoad(drawingContext, r.points, r.width, '#606664');
      paintMountainTrails(drawingContext);
      paintServiceForecourts(drawingContext);
      if (detail) {
        let local = 1097;
        const random = () => {
          local = (local * 1664525 + 1013904223) >>> 0;
          return local / 4294967296;
        };
        for (let i = 0; i < 8000; i++) {
          const x = random() * WORLD_SIZE,
            y = random() * WORLD_SIZE;
          if (
            !countyRegionAt(x, y) ||
            onCountyRoad(x, y, 15) ||
            (y > 8400 && x > 3400 && x < 6250 && y < 10220)
          )
            continue;
          drawingContext.fillStyle = i % 3 ? '#a2b38b22' : '#233f292b';
          drawingContext.fillRect(x, y, 8 + random() * 18, 2 + random() * 5);
        }
      }
      paintMilitaryGround(drawingContext);
    }
    function buildCounty() {
      const oldSeed = randomSeed;
      randomSeed = 94197;
      for (const t of COUNTY_TOWNS)
        for (let bx = 0; bx < 2; bx++)
          for (let by = 0; by < 2; by++) {
            const x = t.x + bx * BLOCK_SIZE + 82,
              y = t.y + by * BLOCK_SIZE + 82;
            for (const [dx, dy, w, h] of [
              [0, 0, 132, 125],
              [213, 0, 130, 122],
              [0, 211, 138, 128],
              [218, 219, 121, 117],
            ]) {
              if (!landRect(x + dx, y + dy, w, h) || onCountyRoad(x + dx + w / 2, y + dy + h / 2, 85))
                continue;
              const before = buildings.length;
              makeBuilding(x + dx, y + dy, w, h, t.style === 'industrial' ? 2 : 0, true);
              if (buildings.length > before)
                Object.assign(buildings.at(-1), {
                  county: true,
                  tropical: ['coast', 'resort'].includes(t.style),
                  height:
                    t.style === 'industrial'
                      ? 38
                      : t.style === 'brick'
                        ? 65 + (bx + by) * 17
                        : 24 + (bx + by) * 11,
                });
            }
            for (const [dx, dy] of [
              [168, 26],
              [165, 300],
              [28, 168],
              [304, 168],
            ])
              if (landAt(x + dx, y + dy) && !onCountyRoad(x + dx, y + dy, 20)) {
                trees.push({
                  x: x + dx,
                  y: y + dy,
                  r: 18,
                  county: true,
                  tropical: ['coast', 'resort'].includes(t.style),
                });
              }
          }
      const ap = COUNTY_AIRPORT;
      for (const b of [
        ap.terminal,
        {
          x: 4790,
          y: 9000,
          w: 230,
          h: 200,
        },
        {
          x: 5310,
          y: 9000,
          w: 250,
          h: 200,
        },
      ]) {
        makeBuilding(b.x, b.y, b.w, b.h, 2, true);
        Object.assign(buildings.at(-1), {
          county: true,
          tropical: false,
          height: b === ap.terminal ? 48 : 59,
          airport: true,
        });
      }
      for (let i = 0; i < 530; i++) {
        const x = 5800 + seededRandom() * 5000,
          y = 500 + seededRandom() * 5700;
        if (
          !landAt(x, y) ||
          onCountyRoad(x, y, 95) ||
          terrainHeight(x, y) > 5 ||
          onMountainTrail(x, y) ||
          countyBlocked(x, y, 45) ||
          buildings.some(
            (b) => x > b.x - 35 && x < b.x + b.w + 35 && y > b.y - 35 && y < b.y + b.h + 35,
          )
        )
          continue;
        trees.push({
          x,
          y,
          r: 15 + seededRandom() * 13,
          county: true,
          pine: true,
          tropical: false,
        });
      }
      for (let i = 0; i < 100; i++) {
        const x = 1650 + seededRandom() * 6300,
          y = 6570 + seededRandom() * 3950;
        if (
          !countyRegionAt(x, y) ||
          onCountyRoad(x, y, 85) ||
          (x > 3400 && x < 6350 && y > 8320) ||
          buildings.some(
            (b) => x > b.x - 35 && x < b.x + b.w + 35 && y > b.y - 35 && y < b.y + b.h + 35,
          )
        )
          continue;
        trees.push({
          x,
          y,
          r: 15 + seededRandom() * 6,
          county: true,
          tropical: true,
        });
      }
      randomSeed = oldSeed;
      buildMilitary();
      installCountyServices();
      for (const [x, y] of [
        [5632, 0],
        [0, 5632],
        [5632, 5632],
      ]) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 2048;
        const drawingContext = canvas.getContext('2d');
        drawingContext.scale(2048 / CITY_SIZE, 2048 / CITY_SIZE);
        drawingContext.translate(-x, -y);
        paintCountyGround(drawingContext, true);
        for (const b of buildings.filter((b) => b.county)) {
          drawingContext.fillStyle = b.tropical ? '#c1ad91' : '#788080';
          drawingContext.fillRect(b.x, b.y, b.w, b.h);
          drawingContext.strokeStyle = '#424c48';
          drawingContext.lineWidth = 4;
          drawingContext.strokeRect(b.x, b.y, b.w, b.h);
        }
        countyGroundTiles.push({
          x,
          y,
          canvas,
        });
      }
    }
    function countyRouteControl(c) {
      const route = c.countyRoute;
      let i = c.countyIndex || 0;
      if (distanceBetween(c, route[i]) < 65) {
        i = (i + 1) % route.length;
        c.countyIndex = i;
      }
      const target = route[i],
        da = normalizeAngle(headingBetween(c, target) - c.a);
      let desired = c.panicUntil > gameTime ? 150 : 83;
      desired *= clamp(1 - Math.abs(da) * 0.55, 0.18, 1);
      for (const o of vehicles) {
        if (o === c || (o.altitude || 0) > 15) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y,
          along = dx * Math.cos(c.a) + dy * Math.sin(c.a),
          side = Math.abs(-dx * Math.sin(c.a) + dy * Math.cos(c.a));
        if (along > 0 && along < 160 && side < (vehicleSpec(c).w + vehicleSpec(o).w) / 2 + 7)
          desired = Math.min(
            desired,
            Math.max(0, along - (vehicleSpec(c).l + vehicleSpec(o).l) / 2 - 28) * 1.2,
          );
      }
      for (const p of [...pedestrians, ...(!player.car ? [player] : [])])
        if (p.hp > 0 && distanceBetween(c, p) < 100) {
          const a = normalizeAngle(headingBetween(c, p) - c.a);
          if (Math.abs(a) < 0.45) desired = Math.min(desired, Math.max(0, distanceBetween(c, p) - 60));
        }
      return {
        steer: clamp(da * 2.5, -1.6, 1.6),
        desired,
      };
    }
    function populateCounty() {
      for (const [j, t] of COUNTY_TOWNS.entries()) {
        const path = [
          {
            x: t.x + 130,
            y: t.y + 25,
          },
          {
            x: t.x + BLOCK_SIZE * 2 - 70,
            y: t.y + 25,
          },
          {
            x: t.x + BLOCK_SIZE * 2 - 25,
            y: t.y + 90,
          },
          {
            x: t.x + BLOCK_SIZE * 2 - 25,
            y: t.y + BLOCK_SIZE * 2 - 80,
          },
          {
            x: t.x + BLOCK_SIZE * 2 - 90,
            y: t.y + BLOCK_SIZE * 2 - 25,
          },
          {
            x: t.x + 80,
            y: t.y + BLOCK_SIZE * 2 - 25,
          },
          {
            x: t.x + 25,
            y: t.y + BLOCK_SIZE * 2 - 90,
          },
          {
            x: t.x + 25,
            y: t.y + 100,
          },
        ];
        for (const i of [0, 3, 5]) {
          const p = path[i],
            n = path[(i + 1) % path.length],
            type = ['sedan', 'pickup', 'luxury', 'rally', 'roadster'][j];
          if (canSpawnCar(type, p.x, p.y, headingBetween(p, n))) {
            const c = makeCar(type, p.x, p.y, headingBetween(p, n), true);
            c.countyRoute = path;
            c.countyIndex = (i + 1) % path.length;
          }
        }
        for (const [i, type] of ['suv', 'bike', 'sport'].entries()) {
          const x = t.x + 160 + i * 100,
            y = t.y - 66;
          if (canSpawnCar(type, x, y, 0)) makeCar(type, x, y, 0, false);
        }
        for (let i = 0; i < 12; i++) {
          const x = t.x + 100 + (i % 6) * 55,
            y = t.y + (i < 6 ? 66 : 216);
          if (!solid(x, y, 6))
            pedestrians.push({
              x,
              y,
              a: 0,
              color: i % 2 ? '#c3b092' : '#7095a0',
              hp: 30,
              flee: 0,
              timer: 5,
              walk: 0,
            });
        }
      }
      makeCar('helicopter', 3690, 8830, 0);
      makeCar('supercar', 4200, 8740, 0);
      makeCar('bus', 4400, 8760, 0);
      makeCar('helicopter', 8130, 2740, 0);
      makeCar('plane', FLIGHT.plane.x, FLIGHT.plane.y, 0);
      populateMilitary();
      spawnTrailVehicles();
      populateRecreation();
      populateSunsetPier();
      populateWildlife();
      resetTransit();
      populateAircraft();
    }
    function drawCounty2D() {
      for (const t of countyGroundTiles)
        if (
          Math.abs(t.x + CITY_SIZE / 2 - cameraTarget.x) <
            CITY_SIZE / 2 + viewportWidth / canvasScale &&
          Math.abs(t.y + CITY_SIZE / 2 - cameraTarget.y) < CITY_SIZE / 2 + viewportHeight / canvasScale
        )
          worldContext.drawImage(t.canvas, t.x, t.y, CITY_SIZE, CITY_SIZE);
      for (const b of buildings)
        if (
          b.county &&
          visible(
            {
              x: b.x + b.w / 2,
              y: b.y + b.h / 2,
            },
            Math.max(b.w, b.h),
          )
        ) {
          worldContext.fillStyle = '#161e2566';
          worldContext.fillRect(b.x + 10, b.y + 14, b.w, b.h);
          worldContext.fillStyle = b.tropical ? '#cab997' : '#87918d';
          worldContext.fillRect(b.x, b.y, b.w, b.h);
          worldContext.strokeStyle = '#3e514e';
          worldContext.lineWidth = 3;
          worldContext.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
        }
      for (const t of trees)
        if (t.county && visible(t, 45)) {
          worldContext.fillStyle = t.pine ? '#28563e' : '#44795a';
          worldContext.beginPath();
          worldContext.arc(t.x, t.y, t.r, 0, TAU);
          worldContext.fill();
        }
      drawMilitary2D();
    }
    function drawCountyMap(drawingContext, scale, big) {
      if (!big) return;
      drawingContext.save();
      for (const t of trees.filter((t) => t.county)) {
        drawingContext.fillStyle = t.pine ? '#2f583dcc' : '#446f4caa';
        drawingContext.beginPath();
        drawingContext.arc(t.x, t.y, t.r * 2, 0, TAU);
        drawingContext.fill();
      }
      for (const p of COUNTY_PEAKS) {
        drawingContext.strokeStyle = '#b7b89566';
        drawingContext.lineWidth = 1 / scale;
        for (let i = 1; i < 5; i++) {
          drawingContext.beginPath();
          drawingContext.ellipse(
            p.x,
            p.y,
            (p.rx || p.r) * (1 - i * 0.15),
            (p.ry || p.r) * (1 - i * 0.15),
            0,
            0,
            TAU,
          );
          drawingContext.stroke();
        }
      }
      drawingContext.font = 'bold ' + 10 / scale + 'px Arial';
      drawingContext.textAlign = 'center';
      drawingContext.lineWidth = 3 / scale;
      drawingContext.strokeStyle = '#15333de8';
      for (const [name, x, y] of [
        ...COUNTY_TOWNS.map((t) => [t.name, t.x + 512, t.y + 480]),
        ['RIDGELINE MOUNTAINS', 8020, 1050],
        ['EAGLE PASS', 7240, 1950],
        ['CLEARWATER', 9140, 1930],
        ['OCEANVIEW INTERNATIONAL ✈', 4770, 9630],
        ['FORT SENTINEL · RESTRICTED', 9810, 9570],
        ['CORAL SOUND', 5830, 5880],
      ]) {
        drawingContext.strokeText(name, x, y);
        drawingContext.fillStyle = name.includes('SENTINEL') ? '#f0b49b' : '#e5e3ce';
        drawingContext.fillText(name, x, y);
      }
      for (const [x, y] of [
        [3690, 8830],
        [8130, 2740],
      ]) {
        drawingContext.fillStyle = '#e3d19c';
        drawingContext.fillText('H', x, y);
      }
      drawingContext.restore();
    }
    function addCountyColliders() {
      for (const b of [...countySolids(), ...militaryWalls])
        addStatic(b.x, b.y, b.w, b.h, b.height, b.kind || 'military');
      for (const bridge of COUNTY_BRIDGES)
        for (const piece of countyBridgeRails(bridge)) {
          const b = {
            ...piece,
            id: 'county' + staticBodies.length,
            kind: 'rail',
            height: 8,
          };
          staticBodies.push(b);
          const cs = corners(b),
            minx = Math.min(...cs.map((p) => p.x)),
            maxx = Math.max(...cs.map((p) => p.x)),
            miny = Math.min(...cs.map((p) => p.y)),
            maxy = Math.max(...cs.map((p) => p.y));
          for (let x = Math.floor(minx / 256); x <= Math.floor(maxx / 256); x++)
            for (let y = Math.floor(miny / 256); y <= Math.floor(maxy / 256); y++) {
              const key = x + ',' + y;
              if (!staticGrid.has(key)) staticGrid.set(key, []);
              staticGrid.get(key).push(b);
            }
        }
    }
    function countyBridgeRails(bridge) {
      if (bridge.rails) return bridge.rails;
      const dx = bridge.b[0] - bridge.a[0],
        dy = bridge.b[1] - bridge.a[1],
        length = Math.hypot(dx, dy),
        a = Math.atan2(dy, dx),
        n = Math.ceil(length / 40),
        rails = [];
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n,
          cx = bridge.a[0] + dx * t,
          cy = bridge.a[1] + dy * t;
        if (landAt(cx, cy)) continue;
        for (const side of [-1, 1])
          rails.push({
            x: cx - Math.sin(a) * side * (bridge.width / 2 - 1),
            y: cy + Math.cos(a) * side * (bridge.width / 2 - 1),
            hx: length / n / 2,
            hy: 1.2,
            a,
            localX: (t - 0.5) * length,
            side,
          });
      }
      return (bridge.rails = rails);
    }
    function countyPatrolEdgeClear(a, b) {
      const steps = Math.ceil(distanceBetween(a, b) / 12),
        heading = headingBetween(a, b);
      for (let i = 0; i <= steps; i++) {
        const c = {
            type: 'police',
            a: heading,
            x: a.x + ((b.x - a.x) * i) / steps,
            y: a.y + ((b.y - a.y) * i) / steps,
          },
          shape = vehicleShape(c, 1);
        if (
          [...nearbyStatics(c)].some(
            (b) => (b.minHeight === undefined || 32 >= b.minHeight) && boxContact(shape, b),
          )
        )
          return false;
      }
      return true;
    }
    // County patrols use the same connected roads as the world; no spawning in water or inside the base.
    let countyPoliceGraph = null;
    function countyPoliceNodes() {
      if (countyPoliceGraph) return countyPoliceGraph;
      const nodes = [];
      const add = (x, y) => {
        if (!groundAt(x, y, 14) || solid(x, y, 12) || inMilitary(x, y, 170)) return;
        const old = nodes.find((p) => Math.hypot(p.x - x, p.y - y) < 20);
        if (!old)
          nodes.push({
            x,
            y,
            links: [],
          });
      };
      for (const r of COUNTY_ROADS)
        for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1],
            b = r.points[i],
            n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 130);
          for (let j = 0; j <= n; j++)
            add(a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n);
        }
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          if (distanceBetween(a, b) > 185 || !clearSight(a, b) || !countyPatrolEdgeClear(a, b))
            continue;
          let valid = true;
          for (let k = 1; k < 5; k++)
            if (!groundAt(a.x + ((b.x - a.x) * k) / 5, a.y + ((b.y - a.y) * k) / 5, 12)) {
              valid = false;
              break;
            }
          if (valid) {
            a.links.push(j);
            b.links.push(i);
          }
        }
      return (countyPoliceGraph = nodes);
    }
    function countyCopRoute(c, target) {
      const nodes = countyPoliceNodes();
      if (!nodes.length) return [];
      const nearest = (p) =>
        nodes.reduce((a, b) => (distanceBetween(a, p) < distanceBetween(b, p) ? a : b));
      const start = nodes.indexOf(nearest(c)),
        end = nodes.indexOf(nearest(target)),
        queue = [start],
        parent = new Map([[start, -1]]);
      for (let i = 0; i < queue.length; i++) {
        const n = queue[i];
        if (n === end) break;
        for (const next of nodes[n].links)
          if (!parent.has(next)) {
            parent.set(next, n);
            queue.push(next);
          }
      }
      if (!parent.has(end)) return [];
      const route = [];
      for (let n = end; n !== -1; n = parent.get(n))
        route.unshift({
          x: nodes[n].x,
          y: nodes[n].y,
        });
      return route;
    }
    function spawnCountyCop() {
      const points = countyPoliceNodes().filter((p) => {
        const d = distanceBetween(p, player);
        return d > 550 && d < 1000 && canSpawnCar('police', p.x, p.y, 0, 10);
      });
      if (!points.length) return;
      const p = randomChoice(points),
        c = makeCar('police', p.x, p.y, 0, true);
      c.a = copRoute(c).length > 1 ? headingBetween(c, copRoute(c)[1]) : headingBetween(c, player);
      c.route = copRoute(c);
      c.routeTime = 2;
    }
    // END SUBSYSTEM: src/county.js
