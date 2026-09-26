    // buildWorld(): the city plan, buildings (makeBuilding), trees, the 2D ground canvas.
    // One texture covers the whole city including the northern reclamation, so it
    // is taller than it is wide. The pixels-per-unit ratio is held below the old
    // 4096-square texture's so the bitmap does not grow with the city.
    // This bitmap is only drawn by the 2D fallback renderer. When WebGL 2 and
    // three.js are there the 3D renderer paints its own sheet, so this one is
    // painted at a quarter of the resolution (a sixteenth of the pixels): it
    // still serves if the 3D renderer fails, and it no longer costs seconds of
    // canvas rasterisation at start-up.
    const GROUND_PIXELS_PER_UNIT =
      (typeof THREE !== 'undefined' && typeof WebGL2RenderingContext !== 'undefined' ? 768 : 3072) / CITY_SIZE;
    // With the 3D renderer there, the road markings (lane dashes, crossings, stop
    // lines) are drawn by its ground shader from data (streets.js ROAD MARKINGS,
    // ground-marks3d.js), crisp at any zoom; the baked 3D ground sheets leave them
    // out. The maps and the 2D view paint them as before.
    const VECTOR_GROUND_MARKINGS = typeof THREE !== 'undefined' && typeof WebGL2RenderingContext !== 'undefined';
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = Math.ceil(CITY_WIDTH * GROUND_PIXELS_PER_UNIT);
    groundCanvas.height = Math.ceil(CITY_HEIGHT * GROUND_PIXELS_PER_UNIT);
    const groundContext = groundCanvas.getContext('2d');
    groundContext.scale(GROUND_PIXELS_PER_UNIT, GROUND_PIXELS_PER_UNIT);
    groundContext.translate(-CITY_LEFT, -CITY_TOP);
    function rect(x, y, w, h, c) {
      groundContext.fillStyle = c;
      groundContext.fillRect(x, y, w, h);
    }
    function label(text, x, y, size = 11, color = '#bcbbae') {
      groundContext.save();
      groundContext.fillStyle = color;
      groundContext.font = 'bold ' + size + 'px monospace';
      groundContext.textAlign = 'center';
      groundContext.fillText(text, x, y);
      groundContext.restore();
    }
    /**
     * ZONING
     * Building height follows the district, the way a real skyline does: a
     * financial core of towers whose height falls off with distance from the
     * centre, mid-rise Midtown and South Bank, low brick Old Quarter, sheds on
     * the docks, and pastel two-to-four storey Art Deco on the Keys with taller
     * hotels along Ocean Drive. `index` gives deterministic variation.
     */
    function zoneHeight(x, y, w, style, index) {
      const cx = x + w / 2,
        vary = ((index * 7919) % 100) / 100;
      if (style === 2) return 34 + vary * 22;
      if (onPalmKeys(x)) {
        if (y < 1500) return 24 + vary * 26;
        // The tall hotels line Ocean Dr (x -2432) on the island's sea side.
        if (y < 3100) return cx < -2150 ? 54 + vary * 46 : 34 + vary * 30;
        if (y < 4400) return 22 + vary * 20;
        return 20 + vary * 18;
      }
      if (y < 0) {
        // Northern reclamation. The tower core stands on the north-east point and
        // falls away westward to the marina, which is kept deliberately low so the
        // masts and the liner are the tallest things on that shore.
        if (cx < 1750 && y < -2400) return 26 + vary * 30;
        const core = clamp(Math.hypot(cx - 2820, y + 2620) / 1320, 0, 1),
          tower = Math.pow(1 - core, 2);
        return 58 + tower * 540 + vary * (48 + tower * 70);
      }
      if (y < 1450) return cx > 2500 ? 30 + vary * 18 : 30 + vary * 26;
      if (y < 2650) return cx > 1700 && cx < 2300 ? 56 + vary * 30 : 62 + vary * 55;
      // The old exchange district kept its name and its density but not its towers:
      // the banks moved north to the point when the reclamation opened.
      if (y < 3700) return cx < 1800 ? 60 + vary * 46 : 82 + vary * 96;
      if (y < 4650) return 50 + vary * 45;
      return 30 + vary * 24;
    }
    function makeBuilding(x, y, w, h, style, force = false) {
      if (
        !force &&
        [
          [x, y],
          [x + w, y],
          [x, y + h],
          [x + w, y + h],
          [x + w / 2, y + h / 2],
        ].some((p) => onBoulevard(p[0], p[1], 28))
      )
        return null;
      const tropical = onPalmKeys(x);
      const b = {
        x,
        y,
        w,
        h,
        style,
        tropical,
        height: zoneHeight(x, y, w, style, buildings.length),
      };
      buildings.push(b);
      rect(x + 11, y + 16, w + 4, h + 4, '#11161789');
      rect(x - 3, y - 3, w + 6, h + 6, '#2b2d2c');
      const base =
        style === 2
          ? '#645849'
          : style === 1
            ? '#585b53'
            : randomChoice(['#8a7563', '#737780', '#696c64', '#91846c', '#687c7a', '#866e69']);
      rect(x, y, w, h, base);
      rect(x, y + h - 11, w, 11, '#383b37');
      rect(x + w - 9, y, 9, h, '#41433c');
      rect(
        x + 5,
        y + 5,
        w - 18,
        h - 25,
        randomChoice(['#5d5851', '#535c61', '#6c6559', '#4f6461', '#655859']),
      );
      groundContext.strokeStyle = '#858673';
      groundContext.lineWidth = 2;
      groundContext.strokeRect(x + 7, y + 7, w - 23, h - 28);
      for (let i = 0; i < (w * h) / 65; i++) {
        const px = x + 9 + seededRandom() * (w - 28),
          py = y + 9 + seededRandom() * (h - 32);
        rect(
          px,
          py,
          seededRandom() * 3 + 1,
          1,
          randomChoice(['#999b822a', '#151b1826', '#bcc39e17']),
        );
      }
      if (style === 2) {
        for (let a = x + 13; a < x + w - 24; a += 14) rect(a, y + 10, 2, h - 34, '#9f91744a');
      }
      const units = Math.max(1, Math.floor((w * h) / 9000));
      for (let j = 0; j < units; j++) {
        const ux = x + 18 + seededRandom() * (w - 59),
          uy = y + 19 + seededRandom() * (h - 63);
        rect(ux + 4, uy + 4, 24, 25, '#272f2999');
        rect(ux, uy, 23, 22, '#7b7c6d');
        rect(ux + 2, uy + 2, 19, 18, '#666e66');
        groundContext.strokeStyle = '#353e38';
        groundContext.lineWidth = 1;
        for (let q = 4; q < 17; q += 3) {
          groundContext.beginPath();
          groundContext.moveTo(ux + 4, uy + q);
          groundContext.lineTo(ux + 19, uy + q);
          groundContext.stroke();
        }
      }
      for (let px = x + 10; px < x + w - 12; px += 15) {
        rect(px, y + h - 9, 6, 4, seededRandom() > 0.45 ? '#b0b895' : '#222b28');
        rect(px, y - 1, 5, 3, '#a2a48b');
      }
      if (seededRandom() > 0.65) {
        rect(x + w / 2 - 17, y + h - 22, 34, 12, '#212d26');
        rect(x + w / 2 - 13, y + h - 20, 26, 5, '#99a88c');
      }
    }
    function drawTree(x, y, r = 17) {
      if (!landAt(x, y)) return;
      groundContext.fillStyle = '#111a1558';
      groundContext.beginPath();
      groundContext.ellipse(x + 7, y + 10, r * 0.85, r * 0.75, 0, 0, TAU);
      groundContext.fill();
      rect(x - 2, y - 2, 4, 13, '#4b4634');
      for (let j = 0; j < 6; j++) {
        groundContext.fillStyle = randomChoice([
          '#3d5f46',
          '#496b4c',
          '#537450',
          '#385842',
          '#607c51',
        ]);
        groundContext.beginPath();
        groundContext.arc(x + Math.cos(j) * r * 0.4, y + Math.sin(j) * r * 0.35, r * 0.68, 0, TAU);
        groundContext.fill();
      }
      for (let j = 0; j < 9; j++) {
        rect(
          x + randomBetween(-r * 0.6, r * 0.6),
          y + randomBetween(-r * 0.6, r * 0.6),
          3,
          2,
          '#92a46b46',
        );
      }
      trees.push({
        x,
        y,
        r,
      });
    }
    function buildWorld() {
      groundContext.save();
      coastPath(groundContext);
      groundContext.clip();
      rect(CITY_LEFT, CITY_TOP, CITY_WIDTH, CITY_HEIGHT, '#334a48');
      // The speckle keeps its old sweep over Northbank first so the seeded
      // sequence (and every building drawn after it) is unchanged, then covers
      // the western part of the frame with a local generator.
      for (let x = 0; x < CITY_SIZE; x += 32)
        for (let y = CITY_TOP; y < CITY_SIZE; y += 26) {
          if (seededRandom() > 0.6)
            rect(x + seededRandom() * 20, y, randomBetween(5, 16), 1, '#7795812b');
        }
      for (let x = CITY_LEFT, k = 0; x < 0; x += 32)
        for (let y = CITY_TOP; y < CITY_SIZE; y += 26, k++) {
          const h = Math.sin(k * 12.9898) * 43758.5453,
            u = h - Math.floor(h);
          if (u > 0.6) rect(x + (u - 0.6) * 50, y, 5 + (u - 0.6) * 27, 1, '#7795812b');
        }
      rect(CITY_LEFT + 48, CITY_TOP + 48, CITY_WIDTH - 112, CITY_HEIGHT - 112, '#696d60');
      paintCityStreets(groundContext, true);
      paintMarina(groundContext);
      for (const bx of BLOCK_COLUMNS)
        for (let by = BLOCK_Y_MIN; by <= BLOCK_Y_MAX; by++) {
          const x = blockX(bx) + 89,
            y = blockY(by) + 89,
            w = 334,
            h = 334;
          if (y > 0 && x + w > RIVER.left && x < RIVER.right) continue;
          if (stadiumOverlap(x, y, w, h)) continue;
          const civicPlace = PLACES.find((p) => p.bx === bx && p.by === by);
          if (
            !civicPlace &&
            (!validCityBlock(x, y, w, h) || harborOverlap(x, y, w, h) || depotOverlap(x, y, w, h))
          )
            continue;
          if (bx === 2 && by === 7) {
            makeBuilding(x + 10, y + 10, 300, 145, 1);
            buildings[buildings.length - 1].height = 64;
            // Its roof carries a helipad (rooftops.js).
            buildings[buildings.length - 1].policeHQ = true;
            rect(x + 10, y + 170, 300, 158, '#515f68');
            label('SOUTH COAST POLICE', x + 160, y + 170, 15, '#bddfea');
            continue;
          }
          const place = PLACES.find((p) => p.bx === bx && p.by === by);
          if (place) {
            makeBuilding(place.x, place.y, place.w, place.h, place.kind === 'hospital' ? 1 : 0);
            Object.assign(buildings[buildings.length - 1], {
              height: place.height,
              place: place.id,
              roofBar: place.kind === 'rooftop',
            });
            if (place.kind === 'rooftop') {
              rect(place.x - 12, place.y - 12, place.w + 24, 12, '#bcb6a7');
              rect(place.x - 12, place.y + place.h, place.w + 24, 29, '#bcb6a7');
            } else
              rect(
                x + 8,
                place.y + place.h + 4,
                318,
                Math.max(30, y + 324 - place.y - place.h),
                '#6e766d',
              );
            rect(place.door.x - 126, place.door.y - 15, 252, 23, '#15212a');
            rect(place.door.x - 126, place.door.y + 7, 252, 2, place.color);
            label(place.name, place.door.x, place.door.y + 1, 12, place.color);
            for (const side of [-1, 1])
              drawTree(
                place.door.x + side * (place.kind === 'rooftop' ? 125 : 80),
                place.door.y + (place.kind === 'rooftop' ? -11 : 14),
                place.kind === 'rooftop' ? 10 : 15,
              );
            // Street lamps round a landmark's block as round any other: the two
            // outer ones on the front kerb (clear of the entrance) and the avenue kerb.
            for (const s of [0, 2]) lamps.push({ x: x + 22 + s * 144, y: y + h + 18 });
            for (let s = 0; s < 3; s++) lamps.push({ x: x + w + 18, y: y + 20 + s * 150 });
            continue;
          }
          if (isPark(bx, by)) continue;
          // The Ironworks sheds are the three rows south of the old north shore.
          // Without the lower bound this also caught the whole reclamation, which
          // is why the new tower district came out as warehouses.
          const industrial = bx >= 4 && bx < 7 && by >= 0 && by <= 2;
          if (industrial) {
            makeBuilding(x + 8, y + 8, w - 16, 140, 2);
            makeBuilding(x + 8, y + 203, 190, 120, 2);
            rect(x + 213, y + 196, 111, 126, '#51574d');
            for (let j = 0; j < 5; j++) {
              rect(
                x + 220 + (j % 2) * 52,
                y + 210 + ((j / 2) | 0) * 33,
                43,
                23,
                randomChoice(['#9c6651', '#6e8990', '#a7a16e']),
              );
              for (let k = 3; k < 40; k += 6)
                rect(x + 220 + (j % 2) * 52 + k, y + 210 + ((j / 2) | 0) * 33, 1, 23, '#191f2433');
            }
          } else {
            if (bx >= 7 || bx < 0) {
              makeBuilding(x + 28, y + 30, 262, 108, 0);
              if (by % 2 === 0) makeBuilding(x + 65, y + 205, 205, 94, 1);
              for (let z = 165; z < 335; z += 65) drawTree(x + 18, y + z, 16);
              continue;
            }
            const zone = districtAt(x + w / 2, y + h / 2),
              blockSeed = (bx * 31 + by * 17) % 7,
              perimeterBlock = zone === 'THE RECLAMATION' || zone === 'HARBOR POINT MARINA';
            // The financial cluster is planned block by block (src/skyline.js).
            const skylineBlock = zone.includes('FINANCIAL') && skylineBlockTowers(bx, by).length > 0;
            if (skylineBlock) {
              buildSkylineBlock(bx, by, x, y, w, h);
            } else if (zone.includes('FINANCIAL') && blockSeed % 2 === 0) {
              // One tower on a plaza: towers need air around them to read as towers.
              makeBuilding(x + 52, y + 12, w - 104, 140, 0);
              rect(x + 8, y + 8, 40, 150, '#8d9385');
              rect(x + w - 48, y + 8, 40, 150, '#8d9385');
              for (let z = 30; z < 150; z += 40) {
                drawTree(x + 28, y + z, 11);
                drawTree(x + w - 28, y + z, 11);
              }
            } else if (perimeterBlock) {
              // Reclamation blocks are perimeter buildings around a planted court:
              // a north range, two wings and a south range closing the court. The
              // south range replaces the generic back-lot building, which used to
              // be added on top and overlapped both wings and the court.
              makeBuilding(x + 7, y + 7, w - 15, 74, 0);
              makeBuilding(x + 7, y + 96, 88, 130, 1);
              makeBuilding(x + w - 95, y + 96, 88, 130, 1);
              makeBuilding(x + 7, y + 241, w - 15, 86, 1);
              rect(x + 104, y + 100, w - 210, 124, '#6f8a5c');
              for (let k = 0; k < 3; k++) drawTree(x + 130 + k * 52, y + 162, 14);
            } else if (zone.includes('OLD QUARTER') || zone === 'BATTERY POINT') {
              // Dense low-rise: three narrow lots with alleys between them.
              const lots = [7, 118, 229];
              for (let k = 0; k < 3; k++) makeBuilding(x + lots[k], y + 7, 98, 146, k === 1 ? 1 : 0);
              for (const ax of [105, 216]) rect(x + ax, y + 7, 13, 146, '#3d423f');
            } else {
              const split = randomBetween(132, 171);
              makeBuilding(x + 7, y + 7, split - 12, 146, 0);
              makeBuilding(x + split + 11, y + 7, w - split - 20, 146, 0);
            }
            if (perimeterBlock || skylineBlock) {
              // Closed on all four sides above, or a planned plaza; nothing more to add.
            } else if (zone === 'SOUTH BANK' && blockSeed % 3 === 0) {
              // Residential slab with a courtyard instead of a parking court.
              makeBuilding(x + 7, y + 179, w - 15, 60, 1);
              rect(x + 40, y + 250, w - 80, 70, '#6f8a5c');
              for (let k = 0; k < 4; k++) drawTree(x + 60 + k * 70, y + 285, 13);
            } else makeBuilding(x + 7, y + 179, seededRandom() > 0.6 ? w - 15 : 155, 143, 1);
            if (!perimeterBlock && !skylineBlock && buildings[buildings.length - 1].w < 200) {
              rect(x + 181, y + 183, 145, 135, '#4b524b');
              for (let p = 0; p < 5; p++) {
                rect(x + 194 + p * 25, y + 187, 1, 49, '#d3d1a26b');
                rect(x + 194 + p * 25, y + 264, 1, 48, '#d3d1a26b');
              }
              label('P', x + 245, y + 260, 19, '#9aa08a');
            }
          }
          // Street planting on all four kerbs, not only the north side: a tree
          // line is most of what separates a city block from a car park.
          for (let s = 0; s < 3; s++) {
            drawTree(x + 55 + s * 110, y - 16, 12);
            drawTree(x + 55 + s * 110, y + h + 16, 12 + (s % 2) * 2);
            lamps.push({
              x: x + 22 + s * 144,
              y: y + h + 18,
            });
            rect(x + 19 + s * 144, y + h + 9, 3, 13, '#3f453a');
          }
          for (let s = 0; s < 2; s++) {
            drawTree(x - 16, y + 90 + s * 150, 11);
            drawTree(x + w + 16, y + 90 + s * 150, 11);
          }
          // Lamps down the avenue kerb too (east side, between the trees), so the
          // north-south streets are not dark canyons between lit cross streets.
          for (let s = 0; s < 3; s++) {
            lamps.push({ x: x + w + 18, y: y + 20 + s * 150 });
            rect(x + w + 16, y + 17 + s * 150, 3, 3, '#3f453a');
          }
        }
      // Waterfront promenades (the bridge decks come with paintDistrictGround).
      paintPromenades(groundContext);
      for (const pad of HELIPADS) {
        rect(pad.x - 49, pad.y - 49, 98, 98, '#52656a');
        groundContext.strokeStyle = '#e1d8ac';
        groundContext.lineWidth = 3;
        groundContext.beginPath();
        groundContext.arc(pad.x, pad.y, 35, 0, TAU);
        groundContext.stroke();
        label('H', pad.x, pad.y + 16, 44, '#e5dcbb');
      }
      const signs = [
        ['ROYAL CINEMA', 948, 1063, '#d2b571'],
        ['FREIGHT & CO.', 2880, 547, '#aab99f'],
        ['SOUTH PIER', 2869, 3108, '#d2c18b'],
        ['24 HOUR', 1470, 546, '#82b2a2'],
        ['LATE NIGHT', 465, 2085, '#c0a0aa'],
      ];
      for (const [s, x, y, c] of signs) {
        rect(x - 54, y - 10, 108, 18, '#1c2928');
        label(s, x, y + 3, 10, c);
      }
      for (let i = 0; i < 95; i++) {
        let x = randomChoice(ROAD_CENTERS) + randomChoice([-66, 66]),
          y = randomBetween(CITY_TOP + 200, 3300);
        if (!solid(x, y, 4)) {
          rect(x - 3, y - 4, 6, 8, '#3a5145');
          rect(x - 3, y - 5, 6, 2, '#899480');
        }
      }
      for (const d of DOCKS) {
        rect(d.x, d.y, d.w, d.h, '#938775');
        for (let x = d.x; x < d.x + d.w; x += 6) rect(x, d.y, 1, d.h, '#504d4344');
      }
      groundContext.restore();
      paintDistrictGround(groundContext);
      for (const d of DOCKS) {
        rect(d.x, d.y, d.w, d.h, '#938775');
        for (let x = d.x; x < d.x + d.w; x += 6) rect(x, d.y, 1, d.h, '#504d4344');
      }
      groundContext.save();
      coastPath(groundContext);
      groundContext.clip();
      makeBuilding(AIRPORT.x, AIRPORT.y, AIRPORT.w, AIRPORT.h, 1, true);
      buildings[buildings.length - 1].height = 42;
      makeBuilding(AIRPORT.hangar.x, AIRPORT.hangar.y, AIRPORT.hangar.w, AIRPORT.hangar.h, 2, true);
      groundContext.restore();
      // Street names are not painted along the carriageway (HARBOR AVENUE and
      // SUNSET BOULEVARD used to be); the HUD names the street underfoot.
      paintParks(groundContext);
      seedParkTrees();
      buildHarbor();
      buildVinnyDepot();
      buildSunsetPier();
      buildCounty();
      // Plan heights to real storeys (realBuildingHeight). Fort Sentinel's buildings
      // (base3d.js), Vinny's depot walls and the Blue Hour (ROOFTOP) are given in
      // real units already, and so are the mountain villages (mountain-village.js).
      for (const b of buildings) if (!b.military && !b.depotWall && !b.roofBar && !b.monarch && !b.mountain) b.height = realBuildingHeight(b.height);
      // Monarch Isle is planned in real storeys from the start (monarch.js).
      buildMonarchIsle();
      // A business's own record (civic3d.js dresses its roof from it) follows its building.
      for (const place of PLACES) {
        const b = place.kind !== 'rooftop' && buildings.find((o) => o.place === place.id);
        if (b) place.height = b.height;
      }
      for (const r of SERVICE_ROADS.filter((r) => r.name.startsWith('SOUTHPORT ')))
        strokeRoad(groundContext, r.points, r.width, '#606664');
      paintServiceForecourts(groundContext, true);
      prepareGarages();
      paintGarages(groundContext);
      paintCasinoGround(groundContext);
      prepareRailInfrastructure();
      prepareSportsGround();
      paintSportsGround(groundContext);
      for (let i = lamps.length - 1; i >= 0; i--)
        if (!landAt(lamps[i].x, lamps[i].y)) lamps.splice(i, 1);
      // Nothing grows in a carriageway or through a viaduct pier. Kerb-line
      // planting is laid out per block, and where a boulevard, a county market
      // street or the railway runs along a block edge it used to land on them.
      const onServiceRoad = (x, y) =>
        SERVICE_ROADS.some((r) =>
          r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + 2),
        );
      for (let i = trees.length - 1; i >= 0; i--) {
        const t = trees[i];
        // ... nor in the sea (the kerb pattern ran past the south-west sea wall).
        if (cityStreetAt(t.x, t.y, 2) || onServiceRoad(t.x, t.y) || railBlocked(t.x, t.y, 6) || !groundAt(t.x, t.y, 3)) trees.splice(i, 1);
      }
      // Lamp posts likewise (the head overhangs 6 units towards +x). Where a block's
      // kerb lamp lands on the next block's kerb tree the post stood inside the
      // trunk; the tree keeps the spot (both are knockable props, damage.js).
      for (let i = lamps.length - 1; i >= 0; i--) {
        const l = lamps[i];
        if (
          cityStreetAt(l.x, l.y, 2) ||
          onServiceRoad(l.x, l.y) ||
          railBlocked(l.x, l.y, 6) ||
          trees.some((t) => Math.abs(t.x - l.x) < 6 && Math.abs(t.y - l.y) < 6)
        )
          lamps.splice(i, 1);
      }
    }
