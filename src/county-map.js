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
    // The bridges (county ones included) are listed in BRIDGES, geography.js.
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
      {
        // Off the South Bay Bridge's east landing, up through the western
        // foothills to Stonecreek's south-west corner.
        name: 'FOOTHILL ROAD',
        width: 96,
        points: [
          [6420, 4736],
          [6720, 4480],
          [6720, 4224],
        ],
      },
      {
        // Sunset Pier island: from the bridge landing along the south shore to
        // the park gate, past the car park.
        name: 'PIER ISLAND DRIVE',
        width: 88,
        points: [
          [3200, -5800],
          [3200, -5900],
          [3898, -5900],
          [3898, -6080],
        ],
      },
      ...BRIDGES.map((b) => ({
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
      // Runway 09/27 (airfields.js RUNWAYS has the whole plan): 1,280 m, the
      // west part on a reclaimed pier out into the sea.
      runway: {
        x: -4040,
        y: 9764,
        w: 10240,
        h: 240,
      },
      terminal: {
        x: 3880,
        y: 8420,
        w: 670,
        h: 220,
      },
    };
    const countyGroundTiles = [];
    function onCountyRoad(x, y, margin = 0) {
      return COUNTY_ROADS.some((r) =>
        r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + margin),
      );
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
      // solid() asks this for every point outside the city: no array spread.
      const hit = (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h;
      return countyStaticSolids.some(hit) || AIRPORT_SCENERY_SOLIDS.some(hit);
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
        if (isMountainTown(t)) {
          paintMountainTownGround(drawingContext, t);
          continue;
        }
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
      // The runway, its piers and taxiway stubs (airfields.js); the stubs'
      // links up to the apron.
      paintAirfieldGround(drawingContext, detail);
      drawingContext.strokeStyle = '#d7b973';
      drawingContext.lineWidth = 3;
      for (const x of [3750, 4500, 5260, 5910]) {
        drawingContext.beginPath();
        drawingContext.moveTo(x, 9400);
        drawingContext.lineTo(x - 80, ap.y + 330);
        drawingContext.stroke();
      }
      drawingContext.restore();
      paintCountyRoads(drawingContext, detail);
      for (const r of SERVICE_ROADS) strokeRoad(drawingContext, r.points, r.width, '#606664');
      paintMountainTrails(drawingContext);
      paintServiceForecourts(drawingContext);
      paintOffroadClubGround(drawingContext);
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
            (y > 8400 && x > 3400 && x < 6250 && y < 10220) ||
            runwayPierAt(x, y) ||
            (y > 9600 && y < 10100 && x < 6500)
          )
            continue;
          drawingContext.fillStyle = i % 3 ? '#a2b38b22' : '#233f292b';
          drawingContext.fillRect(x, y, 8 + random() * 18, 2 + random() * 5);
        }
      }
      paintMilitaryGround(drawingContext);
    }
