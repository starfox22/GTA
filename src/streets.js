    // BEGIN SUBSYSTEM: src/streets.js — Road presentation
    /**
     * Road presentation
     * Source: src/streets.js
     * Scope: shared game closure.
     * Intersections, sidewalks, road painting, waterfront promenades and traffic details.
     */
    /* Shared street footprints: connected grid, varied widths, deliberate ends short of the shore. */
    let cityStreetCache = null,
      coastCache = null;
    function cityStreets() {
      if (cityStreetCache) return cityStreetCache;
      const roads = [];
      for (const vertical of [false, true])
        for (const r of ROAD_CENTERS) {
          const width = [1152, 2688, 3200, 4736].includes(r) ? 112 : 88;
          let start = null;
          const valid = (v) => {
            const x = vertical ? r : v,
              y = vertical ? v : r;
            if (inAirport(x, y) || parkStreetClosed(x, y) || inStadiumLot(x, y, 56)) return false;
            if (onBridge(x, y, 0)) return true;
            const side = width / 2 + 28;
            return (
              landAt(x, y) &&
              [-side, side].every((d) => landAt(x + (vertical ? d : 0), y + (vertical ? 0 : d))) &&
              landAt(x + (vertical ? 0 : 25), y + (vertical ? 25 : 0)) &&
              landAt(x - (vertical ? 0 : 25), y - (vertical ? 25 : 0))
            );
          };
          for (let v = 64; v <= CITY_SIZE - 32; v += 16) {
            if (v <= CITY_SIZE - 48 && valid(v)) {
              if (start === null) start = v;
            } else if (start !== null) {
              if (v - start > 144)
                roads.push({
                  vertical,
                  r,
                  width,
                  start,
                  end: v - 16,
                  points: vertical
                    ? [
                        [r, start],
                        [r, v - 16],
                      ]
                    : [
                        [start, r],
                        [v - 16, r],
                      ],
                });
              start = null;
            }
          }
        }
      return (cityStreetCache = roads);
    }
    /**
     * STREET NAMES
     * Every grid road has a name so the HUD, the map and mission copy can refer to
     * real addresses ("HARBOR AVE & FOUNDRY AVE"). Vertical roads are keyed by x,
     * horizontal roads by y; the four 112-wide roads are the avenues.
     */
    const STREET_NAMES = {
      vertical: {
        128: 'WEST QUAY',
        640: 'SUNSET BLVD',
        1152: 'ROYAL AVE',
        1664: 'COMMONS ST',
        2176: 'CANNERY ST',
        2688: 'FOUNDRY AVE',
        3200: 'RIVERBANK DR',
        3712: 'PALM AVE',
        4224: 'COLLINS AVE',
        4736: 'FLAMINGO AVE',
        5248: 'OCEAN DR',
      },
      horizontal: {
        128: 'NORTH SHORE RD',
        640: 'ARMORY ST',
        1152: 'UNION ST',
        1664: 'GARDEN ST',
        2176: 'CENTRAL PKWY',
        2688: 'EXCHANGE ST',
        3200: 'HARBOR AVE',
        3712: 'SOUTH BANK RD',
        4224: 'BATTERY ST',
        4736: 'STADIUM WAY',
        5248: 'MARINA RD',
      },
    };
    function streetNameAt(x, y) {
      if (x > CITY_SIZE || y > CITY_SIZE || !landAt(x, y)) {
        const county = COUNTY_ROADS.find((r) =>
          r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + 30),
        );
        return county ? county.name : onBridge(x, y) ? 'CAUSEWAY' : '';
      }
      const nearestX = roadNear(x),
        nearestY = roadNear(y),
        onVertical = Math.abs(x - nearestX) < 62,
        onHorizontal = Math.abs(y - nearestY) < 62,
        v = STREET_NAMES.vertical[nearestX],
        h = STREET_NAMES.horizontal[nearestY];
      if (onVertical && onHorizontal && v && h) return v + ' & ' + h;
      if (onVertical && v) return v;
      if (onHorizontal && h) return h;
      const boulevard = BOULEVARDS.find((r) =>
        r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + 30),
      );
      if (boulevard) return boulevard.name;
      // Off the road: name the nearer of the two bounding streets.
      return (Math.abs(x - nearestX) < Math.abs(y - nearestY) ? v : h) || '';
    }
    /* Bench positions are shared by the renderer (which draws them) and by pedestrians (who sit on them). */
    let benchCache = null;
    function benchSpots() {
      if (benchCache) return benchCache;
      benchCache = [];
      for (let bx = 0; bx < ROAD_CENTERS.length - 1; bx++)
        for (let by = 0; by < ROAD_CENTERS.length - 1; by++) {
          const x = ROAD_CENTERS[bx] + 89,
            z = ROAD_CENTERS[by] + 89,
            w = 334;
          if (!validCityBlock(x, z, w, w) || harborOverlap(x, z, w, w) || stadiumOverlap(x, z, w, w) || isPark(bx, by))
            continue;
          for (const px of [x + 110, x + 222]) {
            const y = z - 14;
            if (landAt(px, y) && !onRoad(px, y) && !solid(px, y, 5) && !onBoulevard(px, y, 12) && !inHarbor(px, y, 20) && !inStadiumLot(px, y, 10))
              benchCache.push({ x: px, y, a: Math.PI / 2, taken: null });
          }
        }
      return benchCache;
    }
    function cityIntersectionAt(x, y) {
      return (
        cityStreets().some((r) => !r.vertical && r.r === y && x > r.start + 100 && x < r.end - 100) &&
        cityStreets().some((r) => r.vertical && r.r === x && y > r.start + 100 && y < r.end - 100)
      );
    }
    function cityStreetAt(x, y, margin = 0) {
      return (
        cityStreets().some(
          (r) => segmentDistance(x, y, r.points[0], r.points[1]) <= r.width / 2 + margin,
        ) ||
        onBoulevard(x, y, margin) ||
        onCountyRoad(x, y, margin) ||
        onBridge(x, y, -margin)
      );
    }
    function paintCityStreets(drawingContext, detail = true) {
      const streets = cityStreets();
      drawingContext.save();
      for (const r of streets) strokeRoad(drawingContext, r.points, r.width + 28, '#9b9d90');
      for (const r of streets) strokeRoad(drawingContext, r.points, r.width, '#414c52');
      for (const r of streets) {
        const pos = (v) =>
          r.vertical
            ? {
                x: r.r,
                y: v,
              }
            : {
                x: v,
                y: r.r,
              };
        for (const v of [r.start, r.end]) {
          const p = pos(v);
          if (onBridge(p.x, p.y, -20) || onBoulevard(p.x, p.y, 65)) continue;
          drawingContext.fillStyle = '#4b5659';
          drawingContext.beginPath();
          drawingContext.arc(p.x, p.y, r.width * 0.5, 0, TAU);
          drawingContext.fill();
          if (detail) {
            drawingContext.strokeStyle = '#d3cfb3';
            drawingContext.lineWidth = 2;
            drawingContext.beginPath();
            drawingContext.arc(p.x, p.y, r.width * 0.38, 0, TAU);
            drawingContext.stroke();
          }
        }
        if (!detail) continue;
        drawingContext.fillStyle = '#d0c39a';
        for (let v = r.start + 55; v < r.end - 50; v += 32) {
          const p = pos(v);
          if (Math.abs(v - roadNear(v)) < 85 || onBoulevard(p.x, p.y, 35)) continue;
          if (r.vertical) drawingContext.fillRect(p.x - 1, p.y, 2, 15);
          else drawingContext.fillRect(p.x, p.y - 1, 15, 2);
        }
      }
      if (detail)
        for (const x of ROAD_CENTERS)
          for (const y of ROAD_CENTERS) {
            const horizontal = streets.find(
                (r) => !r.vertical && r.r === y && x > r.start + 100 && x < r.end - 100,
              ),
              vertical = streets.find(
                (r) => r.vertical && r.r === x && y > r.start + 100 && y < r.end - 100,
              );
            if (!horizontal || !vertical) continue;
            drawingContext.fillStyle = '#d4d6c7';
            for (let i = -30; i <= 30; i += 12) {
              drawingContext.fillRect(x + i, y - horizontal.width / 2 - 19, 6, 13);
              drawingContext.fillRect(x + i, y + horizontal.width / 2 + 6, 6, 13);
              drawingContext.fillRect(x - vertical.width / 2 - 19, y + i, 13, 6);
              drawingContext.fillRect(x + vertical.width / 2 + 6, y + i, 13, 6);
            }
          }
      drawingContext.restore();
    }
    function coastSegments() {
      return coastCache || (coastCache = buildCoastSegments());
    }
    function shoreStyle(e) {
      return e.region === 'palmkeys' || COUNTY_REGIONS.find((r) => r.id === e.region)?.beach
        ? 'beach'
        : ['northbank', 'airport'].includes(e.region)
          ? 'quay'
          : 'rock';
    }
    function shoreNormal(e) {
      let nx = -Math.sin(e.a),
        headingCosine = Math.cos(e.a);
      if (landAt(e.x + nx * 12, e.y + headingCosine * 12)) {
        nx = -nx;
        headingCosine = -headingCosine;
      }
      return {
        nx,
        ny: headingCosine,
      };
    }
    function paintPromenades(drawingContext) {
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      for (const e of coastSegments()) {
        if (e.opening || !['northbank', 'palmkeys'].includes(e.region)) continue;
        const { nx, ny } = shoreNormal(e),
          inset = shoreStyle(e) === 'beach' ? 78 : 27,
          x = e.x - nx * inset,
          y = e.y - ny * inset;
        if (onRoad(x, y)) continue;
        drawingContext.save();
        drawingContext.translate(x, y);
        drawingContext.rotate(e.a);
        drawingContext.fillStyle = shoreStyle(e) === 'beach' ? '#bba889' : '#b5b2a2';
        drawingContext.fillRect(-e.length / 2 - 1, -8, e.length + 2, 16);
        drawingContext.strokeStyle = '#d4ceae';
        drawingContext.lineWidth = 1;
        drawingContext.beginPath();
        drawingContext.moveTo(-e.length / 2, -6);
        drawingContext.lineTo(e.length / 2, -6);
        drawingContext.stroke();
        drawingContext.restore();
      }
      drawingContext.restore();
    }
    function paintCountyRoads(g, detail) {
      for (const r of COUNTY_ROADS)
        strokeRoad(g, r.points, r.width + 12, r.bridge ? '#b1b4a9' : '#9eaa92');
      for (const r of COUNTY_ROADS) strokeRoad(g, r.points, r.width, '#414d51');
      if (!detail) return;
      for (const r of COUNTY_ROADS)
        for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1],
            b = r.points[i],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy);
          for (let d = 18; d < len - 12; d += 46) {
            const x = a[0] + (dx * d) / len,
              y = a[1] + (dy * d) / len;
            if (
              COUNTY_ROADS.some(
                (o) =>
                  o !== r &&
                  o.points.some(
                    (p, j) => j && segmentDistance(x, y, o.points[j - 1], p) < o.width / 2 + 22,
                  ),
              )
            )
              continue;
            strokeRoad(
              g,
              [
                [x, y],
                [x + (dx / len) * 22, y + (dy / len) * 22],
              ],
              2,
              '#d7c697',
            );
          }
        }
    }
    function drawPlayerMapMarker(drawingContext, width, height, scale, cx, cy, big) {
      const displayWidth = big ? getElement('bigmap').getBoundingClientRect().width : width,
        size = big ? clamp(width / (displayWidth || width), 1, 2.8) : 1;
      const rawX = width / 2 + (player.x - cx) * scale,
        rawY = height / 2 + (player.y - cy) * scale,
        x = clamp(rawX, 22 * size, width - 22 * size),
        y = clamp(rawY, 28 * size, height - 35 * size),
        off = rawX < 0 || rawX > width || rawY < 0 || rawY > height;
      drawingContext.save();
      drawingContext.translate(x, y);
      drawingContext.scale(size, size);
      drawingContext.fillStyle = '#081f30';
      drawingContext.strokeStyle = '#78f1fa';
      drawingContext.lineWidth = 2;
      drawingContext.beginPath();
      drawingContext.arc(0, 0, big ? 18 : 12, 0, TAU);
      drawingContext.fill();
      drawingContext.stroke();
      if (big) {
        drawingContext.globalAlpha = 0.25;
        drawingContext.lineWidth = 3;
        drawingContext.beginPath();
        drawingContext.arc(0, 0, 23 + Math.sin(gameTime * 3) * 3, 0, TAU);
        drawingContext.stroke();
        drawingContext.globalAlpha = 1;
      }
      drawingContext.rotate(off ? Math.atan2(rawY - y, rawX - x) : (player.car?.a ?? player.a));
      drawingContext.fillStyle = '#fff9da';
      drawingContext.strokeStyle = '#091f2b';
      drawingContext.lineWidth = 2;
      drawingContext.beginPath();
      drawingContext.moveTo(big ? 14 : 9, 0);
      drawingContext.lineTo(big ? -9 : -6, big ? -9 : -6);
      drawingContext.lineTo(big ? -5 : -3, 0);
      drawingContext.lineTo(big ? -9 : -6, big ? 9 : 6);
      drawingContext.closePath();
      drawingContext.fill();
      drawingContext.stroke();
      drawingContext.restore();
      if (big) {
        const label = off ? 'YOU · OFF MAP' : 'YOU ARE HERE',
          lx = clamp(x, 65 * size, width - 65 * size),
          ly = y < height - 70 * size ? y + 37 * size : y - 29 * size;
        drawingContext.save();
        drawingContext.translate(lx, ly);
        drawingContext.scale(size, size);
        drawingContext.fillStyle = '#091f30';
        drawingContext.fillRect(-59, -13, 118, 21);
        drawingContext.textAlign = 'center';
        drawingContext.font = 'bold 13px Arial';
        drawingContext.fillStyle = '#a5faff';
        drawingContext.fillText(label, 0, 2);
        drawingContext.restore();
      }
    }
    function centerMapOnPlayer() {
      mapCenter = {
        x: player.x,
        y: player.y,
      };
      mapZoom = Math.max(2.25, mapZoom);
      drawMap(cityMapContext, 800, 660, true);
    }
    getElement('findMe').onclick = centerMapOnPlayer;
    // END SUBSYSTEM: src/streets.js
