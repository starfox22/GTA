    /* Everything of a bridge that rises above the deck, on the map (tower legs,
       portals, cable fans, arches, trusses): aircraft collide with these. */
    function bridgePylons(bridge) {
      return (bridge.pylons ||= bridgeStructure(bridge).solids.map((b) => bridgeBox(bridge, b)));
    }
    // Everything of a bridge standing in the water, on the map: boats steer round these.
    function bridgeFootings(bridge) {
      return (bridge.footingBoxes ||= bridgeStructure(bridge).footings.map((b) => bridgeBox(bridge, b)));
    }
    function onBridgeDeck(x, y, r = 0) {
      return BRIDGES.some((b) => {
        const pad = b.width / 2 - r;
        return (
          x >= Math.min(b.a[0], b.b[0]) - pad &&
          x <= Math.max(b.a[0], b.b[0]) + pad &&
          y >= Math.min(b.a[1], b.b[1]) - pad &&
          y <= Math.max(b.a[1], b.b[1]) + pad &&
          segmentDistance(x, y, b.a, b.b) <= pad &&
          // A raised drawbridge leaves open water between its leaf tips.
          !(b.movable && drawbridgeOpenGap(x, y, r))
        );
      });
    }
    function onBridge(x, y, r = 0) {
      return onBridgeDeck(x, y, r);
    }
    function groundAt(x, y, r = 0) {
      // Solid land (the usual answer, from the land cell cache) is tested first;
      // the bridge, dock and pier lists only matter where it fails.
      if (
        landAt(x, y) &&
        (!r ||
          (landAt(x - r, y - r) &&
            landAt(x + r, y - r) &&
            landAt(x - r, y + r) &&
            landAt(x + r, y + r)))
      )
        return true;
      return onBridge(x, y, r) || onDock(x, y, r) || onBeachPier(x, y, r) || onIslePontoon(x, y, r);
    }
    function appendLakePaths(g) {
      for (const lake of COUNTY_LAKES) {
        [...lake.polygon].reverse().forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
      }
    }
    function coastPath(drawingContext) {
      drawingContext.beginPath();
      for (const reg of LAND_REGIONS) {
        reg.polygon.forEach(([x, y], i) =>
          i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y),
        );
        drawingContext.closePath();
      }
      appendLakePaths(drawingContext);
    }
    function regionPath(drawingContext, reg) {
      drawingContext.beginPath();
      reg.polygon.forEach(([x, y], i) =>
        i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y),
      );
      drawingContext.closePath();
      if (reg.id === 'ridgeline') appendLakePaths(drawingContext);
    }
    /* Bridge decks on the flat ground layers (2D view, minimap and map): the
       deck, its kerb lines and the centre dashes. The drawbridge's moving span is
       left out of the baked layers (the 3D ground would show it across the open
       gap; the maps draw it live, drawDrawbridgeMap); `live` (the 2D view, drawn
       every frame) paints it while the leaves are down. */
    function drawBridgeGround(drawingContext, live = false) {
      for (const bridge of BRIDGES) {
        const f = bridgeFrame(bridge),
          pieces = [[0, f.length]];
        if (bridge.movable && !(live && drawbridge.angle < 0.004)) {
          const s = bridgeStructure(bridge),
            h0 = f.length / 2 + s.bascule.trunnions[0],
            h1 = f.length / 2 + s.bascule.trunnions[1];
          pieces.splice(0, 1, [0, h0], [h1, f.length]);
        }
        drawingContext.save();
        drawingContext.translate(bridge.a[0], bridge.a[1]);
        drawingContext.rotate(f.a);
        for (const [x0, x1] of pieces) {
          drawingContext.fillStyle = '#444f57';
          drawingContext.fillRect(x0, -bridge.width / 2, x1 - x0, bridge.width);
          drawingContext.fillStyle = '#b6b8af';
          drawingContext.fillRect(x0, -bridge.width / 2 - 1, x1 - x0, 5);
          drawingContext.fillRect(x0, bridge.width / 2 - 4, x1 - x0, 5);
          drawingContext.fillStyle = '#e3c98b';
          for (let x = x0; x < x1 - 15; x += 31) drawingContext.fillRect(x, -1, 15, 2);
        }
        drawingContext.restore();
      }
    }
    function strokeRoad(drawingContext, points, width, color) {
      drawingContext.beginPath();
      points.forEach(([x, y], i) => (i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y)));
      drawingContext.strokeStyle = color;
      drawingContext.lineWidth = width;
      drawingContext.lineJoin = 'round';
      drawingContext.lineCap = 'round';
      drawingContext.stroke();
    }
    // `vectorMarks`: the 3D ground draws the boulevards' lane dashes itself
    // (ground-data3d.js MARKS), so its sheet leaves them out.
    function paintDistrictGround(drawingContext, detail = true, vectorMarks = false) {
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      for (const r of LAND_REGIONS) {
        regionPath(drawingContext, r);
        drawingContext.strokeStyle = '#929897';
        drawingContext.lineWidth = 22;
        drawingContext.stroke();
      }
      // Ocean Drive's broad sandy strand runs down the open-sea (west) shore of
      // Palm Keys; the bay shore facing the city is a quay like Northbank's.
      drawingContext.save();
      regionPath(drawingContext, LAND_REGIONS[1]);
      drawingContext.clip();
      drawingContext.strokeStyle = '#d8c89e';
      drawingContext.lineWidth = 150;
      drawingContext.lineJoin = 'round';
      drawingContext.beginPath();
      KEYS_WEST_STRAND.forEach(([x, y], i) => (i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y)));
      drawingContext.stroke();
      drawingContext.restore();
      // Battery Park: a lawn between Marina Rd and the south sea wall where
      // Southport Beach used to be; the esplanade runs along its water side.
      const park = SOUTH_PROMENADE;
      drawingContext.fillStyle = '#6f8a5c';
      drawingContext.fillRect(park.x, park.y, park.w, park.h);
      drawingContext.fillStyle = '#b8b3a2';
      for (let x = park.x + 140; x < park.x + park.w - 60; x += 280) drawingContext.fillRect(x, park.y, 16, park.h);
      // The beach-club plot on Palm Keys: levelled, paved and fenced off.
      const club = BEACH_CLUB_PLOT;
      drawingContext.fillStyle = '#b9ae94';
      drawingContext.fillRect(club.x, club.y, club.w, club.h);
      drawingContext.strokeStyle = '#8c826b';
      drawingContext.lineWidth = 3;
      drawingContext.setLineDash([14, 10]);
      drawingContext.strokeRect(club.x + 6, club.y + 6, club.w - 12, club.h - 12);
      drawingContext.setLineDash([]);
      regionPath(drawingContext, LAND_REGIONS[2]);
      drawingContext.fillStyle = '#8a9386';
      drawingContext.fill();
      for (const road of BOULEVARDS) {
        strokeRoad(drawingContext, road.points, road.width + 15, '#b3ada0');
        strokeRoad(drawingContext, road.points, road.width, '#485259');
        if (vectorMarks) continue;
        drawingContext.setLineDash([19, 14]);
        strokeRoad(drawingContext, road.points, 2, '#d4ba75');
        drawingContext.setLineDash([]);
      }
      // The apron from the terminal to the taxiway, then the runway, its pier,
      // taxiways and markings (airfields.js).
      strokeRoad(
        drawingContext,
        [
          [700, 4890],
          [825, 4890],
          [825, 5110],
          [1150, 5110],
        ],
        110,
        '#9a9c96',
      );
      paintAirfieldGround(drawingContext, detail);
      paintBeach(drawingContext, detail);
      drawingContext.restore();
      paintPromenades(drawingContext);
      drawBridgeGround(drawingContext);
    }
    /* Palm Keys Beach: dry sand, a damp band and darker wet sand at the waterline,
       and the boardwalk along the top. The speckle uses a local hash so painting
       the map never disturbs the seeded world. */
    function paintBeach(drawingContext, detail) {
      const keys = LAND_REGIONS[1],
        box = BEACH.bounds || (regionContains(BEACH, 0, 0), BEACH.bounds);
      drawingContext.save();
      drawingContext.beginPath();
      BEACH.polygon.forEach(([x, y], i) => (i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y)));
      drawingContext.closePath();
      drawingContext.clip();
      drawingContext.fillStyle = '#dccb9f';
      drawingContext.fillRect(box.minx - 50, box.miny - 16, box.maxx - box.minx + 100, box.maxy - box.miny + 60);
      regionPath(drawingContext, keys);
      drawingContext.lineJoin = 'round';
      drawingContext.strokeStyle = '#c3b187';
      drawingContext.lineWidth = 150;
      drawingContext.stroke();
      drawingContext.strokeStyle = '#ae9c76';
      drawingContext.lineWidth = 56;
      drawingContext.stroke();
      if (detail) {
        for (let i = 0; i < 2600; i++) {
          const h = Math.sin(i * 12.9898) * 43758.5453,
            u = h - Math.floor(h),
            k = Math.sin(i * 78.233) * 12543.1234,
            v = k - Math.floor(k);
          drawingContext.fillStyle = i % 3 ? '#e8dab4' : '#bba981';
          drawingContext.fillRect(box.minx - 40 + u * 1480, 5300 + v * 650, 2 + (i % 4), 1.2);
        }
      }
      const walk = BEACH.boardwalk;
      drawingContext.fillStyle = '#8f7457';
      drawingContext.fillRect(walk.x0, walk.y - walk.width / 2, walk.x1 - walk.x0, walk.width);
      drawingContext.fillStyle = '#6f5a44';
      drawingContext.fillRect(walk.x0, walk.y + walk.width / 2 - 3, walk.x1 - walk.x0, 3);
      if (detail) {
        drawingContext.fillStyle = '#a58a69';
        for (let x = walk.x0; x < walk.x1; x += 7) drawingContext.fillRect(x, walk.y - walk.width / 2, 1, walk.width - 3);
      }
      drawingContext.restore();
    }
    function segmentCross(a, b, c, d) {
      const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      return (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0 &&
        Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
          Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) &&
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <=
          Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))
      );
    }
    function hullTouchesLand(shape) {
      const cs = corners(shape),
        hull = [cs[0], cs[2], cs[3], cs[1]];
      if (hull.some((p) => landAt(p.x, p.y))) return true;
      for (const reg of [...LAND_REGIONS, ...COUNTY_LAKES]) {
        regionContains(reg, shape.x, shape.y);
        const b = reg.bounds,
          radius = Math.hypot(shape.hx, shape.hy);
        if (
          shape.x + radius < b.minx ||
          shape.x - radius > b.maxx ||
          shape.y + radius < b.miny ||
          shape.y - radius > b.maxy
        )
          continue;
        for (let i = 0; i < reg.polygon.length; i++) {
          const a = {
              x: reg.polygon[i][0],
              y: reg.polygon[i][1],
            },
            j = (i + 1) % reg.polygon.length,
            b = {
              x: reg.polygon[j][0],
              y: reg.polygon[j][1],
            };
          if (
            boxContact(shape, {
              x: a.x,
              y: a.y,
              hx: 0.2,
              hy: 0.2,
              a: 0,
            })
          )
            return true;
          for (let k = 0; k < 4; k++) if (segmentCross(hull[k], hull[(k + 1) % 4], a, b)) return true;
        }
      }
      return false;
    }
    function districtAt(x, y) {
      // Monarch Isle, its bridges and the water round it (monarch.js).
      const isle = monarchDistrictAt(x, y);
      if (isle) return isle;
      if (COUNTY_LAKES.some((r) => regionContains(r, x, y))) return 'CLEARWATER RESERVOIR';
      // The runway piers (airfields.js) belong to their airports.
      const pier = runwayPierAt(x, y);
      if (pier) return pier.airport;
      const reg = countyRegionAt(x, y);
      if (reg) {
        if (inMilitary(x, y)) return MILITARY.name;
        const ap = COUNTY_AIRPORT;
        if (x > ap.x && x < ap.x + ap.w && y > ap.y - 200 && y < ap.y + ap.h) return ap.name;
        const town = COUNTY_TOWNS.find(
          (t) => x > t.x - 180 && x < t.x + 1200 && y > t.y - 180 && y < t.y + 1200,
        );
        return town ? town.name : reg.name;
      }
      if (inAirport(x, y) && landAt(x, y)) return 'SOUTHPORT AIRPORT';
      if (onSunsetIsle(x, y)) return 'SUNSET PIER';
      if (onBeach(x, y)) return BEACH.name;
      if (onPalmKeys(x) && landAt(x, y))
        return y < 1500
          ? 'PALM KEYS · ART DECO'
          : y < 3100
            ? 'OCEAN DRIVE'
            : y < 4400
              ? 'LITTLE HAVANA'
              : 'CORAL MARINA';
      if (!landAt(x, y) && regionContains(BEACH, x, y) && !onBridge(x, y)) return BEACH.name;
      if (!landAt(x, y)) {
        const deck = BRIDGES.find((b) => segmentDistance(x, y, b.a, b.b) <= b.width / 2);
        if (deck) return deck.name;
        // Every stretch of water used to read MARLOW BAY, the marina basin and the
        // open sea off the west wall included.
        const basin = MARINA.basin;
        if (x > basin.x && x < basin.x + basin.w && y > basin.y && y < basin.y + basin.h) return 'HARBOR POINT MARINA';
        if (x > RIVER.left - 120 && x < RIVER.right && y > -600 && y < 5600) return 'MARLOW BAY';
        if (x > -1250 && x < 60 && y > 0 && y < 5000) return 'PALM SOUND';
        if (y < -4150 && y > -5750 && x > 400 && x < 4200) return 'NORTH SOUND';
        return 'OPEN SEA';
      }
      if (x > 1718 && x < 2638 && y > 2794 && y < 3664) return 'CENTRAL GARDEN';
      if (y < 0) {
        if (y < -3860 && x > 1600 && x < 3120) return 'CRUISE TERMINAL';
        if (x < 1750 && y < -2400) return 'HARBOR POINT MARINA';
        if (x > 1880 && y < -1300) return 'NORTH POINT · FINANCIAL';
        return 'THE RECLAMATION';
      }
      if (y < 1450) return x > 2500 ? 'IRONWORKS DOCKS' : 'NORTHBANK · OLD QUARTER';
      if (y < 2650) return 'MIDTOWN';
      if (y < 3700) return x < 1800 ? 'BROADWAY' : 'EXCHANGE DISTRICT';
      if (y < 4650) return 'SOUTH BANK';
      if (y > SOUTH_PROMENADE.y - 20 && x > SOUTH_PROMENADE.x && x < SOUTH_PROMENADE.x + SOUTH_PROMENADE.w)
        return 'BATTERY PARK';
      return 'BATTERY POINT';
    }
    function validCityBlock(x, y, w = 334, h = 334) {
      return (
        landRect(x - 8, y - 8, w + 16, h + 16) &&
        !inAirport(x + w / 2, y + h / 2) &&
        ![
          [x, y],
          [x + w, y],
          [x, y + h],
          [x + w, y + h],
          [x + w / 2, y + h + 8],
        ].some(([px, py]) => regionContains(BEACH, px, py) || inReservedPlot(px, py, 8))
      );
    }
    function drawWater2D() {
      worldContext.fillStyle = cameraTarget.x < -600 ? '#267581' : '#1d4d67';
      worldContext.fillRect(0, 0, viewportWidth, viewportHeight);
      worldContext.save();
      worldContext.translate(viewportWidth / 2, viewportHeight / 2);
      worldContext.scale(canvasScale, canvasScale);
      worldContext.translate(-cameraTarget.x, -cameraTarget.y);
      const minx = cameraTarget.x - viewportWidth / canvasScale / 2 - 70,
        maxx = cameraTarget.x + viewportWidth / canvasScale / 2 + 70,
        miny = cameraTarget.y - viewportHeight / canvasScale / 2 - 70,
        maxy = cameraTarget.y + viewportHeight / canvasScale / 2 + 70;
      worldContext.lineWidth = 1.3;
      for (let y = Math.floor(miny / 32) * 32; y < maxy; y += 32)
        for (let x = Math.floor(minx / 95) * 95; x < maxx; x += 95) {
          if (landAt(x, y)) continue;
          const phase = gameTime * 1.2 + x * 0.013 + y * 0.019,
            xx = x + Math.sin(phase) * 9,
            yy = y + Math.sin(phase * 0.7) * 4;
          worldContext.strokeStyle =
            'rgba(169,221,218,' + (0.08 + 0.07 * (0.5 + 0.5 * Math.sin(phase))) + ')';
          worldContext.beginPath();
          worldContext.moveTo(xx, yy);
          worldContext.quadraticCurveTo(xx + 22, yy - 5, xx + 48, yy);
          worldContext.stroke();
        }
      for (const e of coastSegments()) {
        if (e.opening || !visible(e, 120)) continue;
        const { nx, ny } = shoreNormal(e);
        for (let k = 0; k < 2; k++) {
          const t = (gameTime * 0.18 + e.x * 0.003 + e.y * 0.002 + k * 0.5) % 1,
            offset = 3 + (1 - t) * (shoreStyle(e) === 'beach' ? 36 : 12),
            dx = (Math.cos(e.a) * e.length) / 2,
            dy = (Math.sin(e.a) * e.length) / 2;
          worldContext.strokeStyle = 'rgba(201,238,222,' + Math.sin(t * Math.PI) * 0.28 + ')';
          worldContext.lineWidth = 1.5;
          worldContext.beginPath();
          worldContext.moveTo(e.x + nx * offset - dx, e.y + ny * offset - dy);
          worldContext.quadraticCurveTo(
            e.x + nx * (offset + 3),
            e.y + ny * (offset + 3),
            e.x + nx * offset + dx,
            e.y + ny * offset + dy,
          );
          worldContext.stroke();
        }
      }
      worldContext.restore();
    }
    function buildCoastSegments() {
      const result = [];
      for (const reg of [...LAND_REGIONS, ...COUNTY_LAKES]) {
        const poly = reg.polygon;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i],
            b = poly[(i + 1) % poly.length],
            len = Math.hypot(b[0] - a[0], b[1] - a[1]),
            steps = Math.ceil(len / 45);
          for (let k = 0; k < steps; k++) {
            const t = (k + 0.5) / steps,
              x = a[0] + (b[0] - a[0]) * t,
              y = a[1] + (b[1] - a[1]) * t;
            if (!reg.lake && LAND_REGIONS.some((o) => o !== reg && regionContains(o, x, y))) continue;
            result.push({
              x,
              y,
              a: Math.atan2(b[1] - a[1], b[0] - a[0]),
              length: len / steps + 1,
              region: reg.id,
              opening:
                onBridge(x, y, -8) ||
                DOCKS.some((d) => x > d.x - 8 && x < d.x + d.w + 8 && y > d.y - 8 && y < d.y + d.h + 8),
            });
          }
        }
      }
      return result;
    }
    function drawDistrictScenery2D() {
      if (cameraTarget.x < -1500) {
        // Ocean Drive's palms, down both pavements (oceanDrivePalms, streets.js).
        for (const { x: px, y } of oceanDrivePalms()) {
          if (!visible({ x: px, y }, 100)) continue;
          worldContext.strokeStyle = '#99876c';
          worldContext.lineWidth = 4;
          worldContext.beginPath();
          worldContext.moveTo(px, y);
          worldContext.lineTo(px + 4, y - 20);
          worldContext.stroke();
          worldContext.strokeStyle = '#417d64';
          worldContext.lineWidth = 5;
          for (let i = 0; i < 7; i++) {
            const a = (i * TAU) / 7;
            worldContext.beginPath();
            worldContext.moveTo(px + 4, y - 20);
            worldContext.quadraticCurveTo(
              px + 4 + Math.cos(a) * 15,
              y - 20 + Math.sin(a) * 15 - 5,
              px + 4 + Math.cos(a) * 23,
              y - 20 + Math.sin(a) * 23,
            );
            worldContext.stroke();
          }
        }
      }
      if (cameraTarget.x > -400 && cameraTarget.x < 1800 && cameraTarget.y > 4000) {
        for (const [x, y, a, s] of [
          [680, 4800, -Math.PI / 2, 0.9],
          [680, 5110, -Math.PI / 2, 1],
          [1000, 5400, 0, 0.65],
        ]) {
          if (
            !visible(
              {
                x,
                y,
              },
              100,
            )
          )
            continue;
          worldContext.save();
          worldContext.translate(x + 6, y + 9);
          worldContext.rotate(a);
          worldContext.scale(s, s);
          worldContext.fillStyle = '#1a2b3244';
          worldContext.fillRect(-65, -10, 130, 20);
          worldContext.fillRect(-10, -65, 24, 130);
          worldContext.translate(-6, -9);
          worldContext.fillStyle = '#dbe3df';
          worldContext.beginPath();
          worldContext.ellipse(0, 0, 66, 9, 0, 0, TAU);
          worldContext.fill();
          worldContext.beginPath();
          worldContext.moveTo(-18, -64);
          worldContext.lineTo(8, -64);
          worldContext.lineTo(28, 0);
          worldContext.lineTo(8, 64);
          worldContext.lineTo(-18, 64);
          worldContext.lineTo(-7, 0);
          worldContext.closePath();
          worldContext.fill();
          worldContext.fillStyle = '#577f8e';
          worldContext.fillRect(-52, -22, 14, 44);
          worldContext.fillRect(43, -6, 9, 12);
          for (const side of [-1, 1]) {
            worldContext.fillRect(-2, side * 30 - 4, 18, 8);
            for (let q = -35; q < 38; q += 8) worldContext.fillRect(q, side * 7 - 1, 3, 2);
          }
          worldContext.restore();
        }
        worldContext.fillStyle = '#a0b1b1';
        worldContext.fillRect(771, 5056, 38, 38);
        worldContext.fillStyle = '#476470';
        worldContext.fillRect(775, 5060, 30, 30);
      }
    }
