    /**
     * MINIMAP BASE LAYER
     * The minimap used to repaint the whole county (coast, every street, parks,
     * promenades, county ground and every building footprint) on every HUD
     * refresh, eleven times a second: tens of milliseconds each time, mostly in
     * the shoreline tests of the promenade painter. None of it changes after
     * startup, so it is painted once into an offscreen canvas at the minimap's
     * fixed scale and each refresh copies the window around the player. The big
     * city map zooms, so it still paints the vector layers directly.
     */
    const MINIMAP_SCALE = 0.137;
    let minimapBase = null;
    function minimapBaseLayer() {
      if (minimapBase) return minimapBase;
      let minx = Infinity,
        miny = Infinity,
        maxx = -Infinity,
        maxy = -Infinity;
      for (const reg of LAND_REGIONS)
        for (const [x, y] of reg.polygon) {
          minx = Math.min(minx, x);
          miny = Math.min(miny, y);
          maxx = Math.max(maxx, x);
          maxy = Math.max(maxy, y);
        }
      // The coast is stroked 90 units wide, so leave room around the land.
      const x0 = minx - 120,
        y0 = miny - 120,
        canvas = document.createElement('canvas');
      canvas.width = Math.ceil((maxx - minx + 240) * MINIMAP_SCALE);
      canvas.height = Math.ceil((maxy - miny + 240) * MINIMAP_SCALE);
      const context = canvas.getContext('2d');
      context.scale(MINIMAP_SCALE, MINIMAP_SCALE);
      context.translate(-x0, -y0);
      paintMapBase(context, false);
      minimapBase = { canvas, x0, y0 };
      return minimapBase;
    }
    // Land, streets, parks, ground and building footprints: the static layers.
    function paintMapBase(drawingContext, big) {
      for (const reg of LAND_REGIONS) {
        regionPath(drawingContext, reg);
        drawingContext.strokeStyle = reg.id === 'palmkeys' ? '#33777e' : '#245369';
        drawingContext.lineWidth = 90;
        drawingContext.stroke();
        drawingContext.fillStyle = reg.color;
        drawingContext.fill();
      }
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      paintCityStreets(drawingContext, false);
      paintParks(drawingContext, false);
      drawingContext.restore();
      paintDistrictGround(drawingContext, false);
      paintCountyGround(drawingContext, false);
      paintMonarchMap(drawingContext, big);
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      for (const b of buildings) {
        drawingContext.fillStyle = b.tropical ? '#c4beb2' : b.height > realBuildingHeight(110) ? '#354953' : '#43585a';
        drawingContext.fillRect(b.x, b.y, b.w, b.h);
        if (big && b.height > realBuildingHeight(110)) {
          drawingContext.fillStyle = '#75888b';
          drawingContext.fillRect(b.x + 7, b.y + 7, b.w - 14, 8);
        }
      }
      drawingContext.restore();
    }
    function drawMap(drawingContext, width, height, big = false) {
      const scale = big
          ? Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT) * 0.92 * mapZoom
          : MINIMAP_SCALE * minimapZoom(),
        cx = big ? mapCenter.x : player.x,
        cy = big ? mapCenter.y : player.y;
      drawingContext.fillStyle = '#123244';
      drawingContext.fillRect(0, 0, width, height);
      if (!big) {
        // Whole pixels keep the cached layer sharp; overlays are drawn in world units.
        // Zoomed (hud.js), the cached layer is scaled with it.
        const base = minimapBaseLayer(),
          zoom = minimapZoom();
        drawingContext.imageSmoothingEnabled = true;
        drawingContext.drawImage(
          base.canvas,
          Math.round(width / 2 - (cx - base.x0) * scale),
          Math.round(height / 2 - (cy - base.y0) * scale),
          Math.round(base.canvas.width * zoom),
          Math.round(base.canvas.height * zoom),
        );
      }
      drawingContext.save();
      drawingContext.translate(width / 2, height / 2);
      drawingContext.scale(scale, scale);
      drawingContext.translate(-cx, -cy);
      if (big) paintMapBase(drawingContext, big);
      if (big)
        for (const gang of GANGS) {
          drawingContext.fillStyle = gang.id === 'harbor' ? '#bb73571f' : '#ad88ca29';
          drawingContext.beginPath();
          drawingContext.arc(gang.x, gang.y, 260, 0, TAU);
          drawingContext.fill();
          drawingContext.strokeStyle = gang.color + '99';
          drawingContext.lineWidth = 7;
          drawingContext.stroke();
        }
      for (const p of pickups) {
        drawingContext.fillStyle =
          p.type === 'health' ? '#84ccb0' : p.type === 'ammo' ? '#c7a2df' : '#94bfd5';
        drawingContext.fillRect(p.x - 13, p.y - 13, 26, 26);
      }
      paintSportsGround(drawingContext, false);
      drawCivicMap(drawingContext, big);
      for (const pad of HELIPADS) {
        drawingContext.fillStyle = '#e4d3a3';
        drawingContext.font = 'bold 90px monospace';
        drawingContext.textAlign = 'center';
        drawingContext.fillText('H', pad.x, pad.y + 27);
      }
      // Rooftop helipads (rooftops.js): a smaller H.
      drawingContext.font = 'bold 64px monospace';
      for (const pad of roofHelipads) drawingContext.fillText('H', pad.x, pad.y + 20);
      drawHarborMap(drawingContext, big);
      const target = objective();
      if (target) {
        // On the minimap the GPS draws the road route instead (navigation.js).
        if (big || !gpsRouteShown()) {
          drawingContext.strokeStyle = '#f3d791aa';
          drawingContext.lineWidth = big ? 9 : 8;
          drawingContext.setLineDash([22, 19]);
          drawingContext.beginPath();
          drawingContext.moveTo(player.x, player.y);
          drawingContext.lineTo(target.x, target.y);
          drawingContext.stroke();
          drawingContext.setLineDash([]);
        }
        drawingContext.fillStyle = '#f2d485';
        drawingContext.beginPath();
        drawingContext.arc(target.x, target.y, 36, 0, TAU);
        drawingContext.fill();
      }
      drawTransitMap(drawingContext, scale, big);
      drawSportsMap(drawingContext, scale, big);
      drawUserRoute(drawingContext, scale, big);
      if (!big) drawGpsRoutes(drawingContext, scale);
      drawCountyMap(drawingContext, scale, big);
      drawGarageMap(drawingContext, scale);
      drawBikeShareMap(drawingContext, scale, big);
      drawAirCoverMap(drawingContext, scale);
      drawDrawbridgeMap(drawingContext, scale, big);
      drawAviationMap(drawingContext, scale);
      drawPoliceMap(drawingContext, scale);
      drawingContext.restore();
      if (big) {
        drawingContext.save();
        drawingContext.strokeStyle = '#d3ddd5';
        drawingContext.fillStyle = '#d3ddd5';
        drawingContext.lineWidth = 2;
        const bar = BLOCK_SIZE * scale;
        drawingContext.beginPath();
        drawingContext.moveTo(28, 45);
        drawingContext.lineTo(28 + bar, 45);
        drawingContext.moveTo(28, 40);
        drawingContext.lineTo(28, 50);
        drawingContext.moveTo(28 + bar, 40);
        drawingContext.lineTo(28 + bar, 50);
        drawingContext.stroke();
        drawingContext.font = '11px Arial';
        drawingContext.textAlign = 'left';
        drawingContext.fillText(distanceLabel(BLOCK_SIZE) + ' · 1 block', 28, 65);
        drawingContext.restore();
        drawingContext.textAlign = 'center';
        const labels = [
          ['N O R T H  P O I N T', 2700, -2620],
          ['HARBOR POINT MARINA', 1060, -2960],
          ['CRUISE TERMINAL', 2360, -3990],
          ['THE RECLAMATION', 1420, -760],
          ['N O R T H B A N K', 1580, 540],
          ['CENTRAL GARDEN', 2176, 3224],
          ['SUNSET PIER', 3000, -6400],
          ['EXCHANGE DISTRICT', 2680, 2890],
          ['BROADWAY', 1330, 3390],
          ['BATTERY POINT', 2480, 5140],
          ['BATTERY PARK', 2440, 5420],
          ['SOUTHPORT', 640, 5450],
          ['P A L M  K E Y S', -1900, 535],
          ['OCEAN DRIVE', -2200, 2770],
          ['LITTLE HAVANA', -1900, 4150],
          ['CORAL MARINA', -1700, 4880],
          ['PALM KEYS BEACH', -1970, 5620],
          ['MAREA BEACH CLUB', -2870, 5500],
          ['P A L M  S O U N D', -560, 2300],
          ['M A R L O W  B A Y', 4650, 2560],
          ['N O R T H  S O U N D', 1500, -4900],
          ...MONARCH_MAP_LABELS,
        ];
        for (const [label, x, y] of labels) {
          drawingContext.font = 'bold 11px Arial';
          drawingContext.strokeStyle = '#102d3de0';
          drawingContext.lineWidth = 3;
          const px = width / 2 + (x - cx) * scale,
            py = height / 2 + (y - cy) * scale;
          drawingContext.strokeText(label, px, py);
          drawingContext.fillStyle = /B A Y|S O U N D|C H A N N E L/.test(label) ? '#a3d1d5' : '#ede6d2';
          drawingContext.fillText(label, px, py);
        }
        drawingContext.fillStyle = '#a6c4cb';
        drawingContext.font = '10px monospace';
        drawingContext.textAlign = 'left';
        drawingContext.fillText('N ↑', 28, 27);
        drawingContext.fillText('SOUTH COAST COUNTY / CITY GUIDE', 28, height - 17);
        drawingContext.textAlign = 'right';
        drawingContext.fillText(
          '+ / − ZOOM · ARROWS PAN · C FIND ME · 0 RESET',
          width - 28,
          height - 17,
        );
      }
      drawPlayerMapMarker(drawingContext, width, height, scale, cx, cy, big);
    }
