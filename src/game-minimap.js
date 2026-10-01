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
    /* The fonts the map overlays draw with, set once on a scratch canvas when the base layer is
       built: the first fillText in a font costs a font lookup and glyph build (tens of
       milliseconds on some platforms), which would otherwise land mid-drive the first time a
       station, garage or helipad came into the minimap's window. */
    function warmMapFonts() {
      const g = document.createElement('canvas').getContext('2d');
      if (!g) return;
      for (const font of ['bold 6px Arial', 'bold 7px Arial', 'bold 8px Arial', 'bold 9px Arial', 'bold 10px Arial', 'bold 11px Arial', 'bold 12px Arial', 'bold 64px monospace', 'bold 65px monospace', 'bold 90px monospace']) {
        g.font = font;
        g.fillText('MRHU$ PLANE', 0, 8);
      }
    }
    function minimapBaseLayer() {
      if (minimapBase) return minimapBase;
      warmMapFonts();
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
      // North Point Key's own sheet over its land (skyline-islet.js).
      paintNorthPointKeyMap(drawingContext);
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
    /* MAP WINDOW. The world rectangle the map being drawn shows (set by drawMap, open
       again after its overlays): the overlay painters skip any marker and name outside
       it, margin in world units. Text is the dear part of a map pass, and on the
       minimap its device size changes every refresh while the view eases with speed, so
       every glyph is rasterised afresh: with some forty markers in the county that
       was a quarter of a driving frame's CPU, nearly all for markers off the card. */
    const mapWindow = { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
    function mapWindowHas(x, y, margin) {
      return x + margin > mapWindow.x0 && x - margin < mapWindow.x1 && y + margin > mapWindow.y0 && y - margin < mapWindow.y1;
    }
    // The same for a rectangle (x, y, w, h).
    function mapWindowHasRect(x, y, w, h, margin) {
      return x + w + margin > mapWindow.x0 && x - margin < mapWindow.x1 && y + h + margin > mapWindow.y0 && y - margin < mapWindow.y1;
    }
    /* Text of a fixed size on the glass at a map point (the map is drawn under
       scale(scale)). It used to be set as `10 / scale` px: the minimap's scale eases
       with speed, so every refresh brought a font string never seen, and each new
       size is a font lookup of its own (tens of milliseconds on a platform with slow
       font matching). Counter-scaling keeps the font string fixed and the glyphs the
       same size. Set `font` and `textAlign` as before, in px of the glass. */
    function mapLabel(g, text, x, y, scale) {
      g.save();
      g.translate(x, y);
      g.scale(1 / scale, 1 / scale);
      g.fillText(text, 0, 0);
      g.restore();
    }
    function drawMap(drawingContext, width, height, big = false) {
      // The minimap pulls back with speed (minimapSpeedZoom, map-view.js).
      const view = big ? 1 : minimapZoom() * minimapSpeedZoom(),
        scale = big
          ? Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT) * 0.92 * mapZoom
          : MINIMAP_SCALE * view,
        cx = big ? mapCenter.x : player.x,
        cy = big ? mapCenter.y : player.y;
      mapWindow.x0 = cx - width / 2 / scale;
      mapWindow.x1 = cx + width / 2 / scale;
      mapWindow.y0 = cy - height / 2 / scale;
      mapWindow.y1 = cy + height / 2 / scale;
      drawingContext.fillStyle = '#123244';
      drawingContext.fillRect(0, 0, width, height);
      if (!big) {
        // Whole pixels keep the cached layer sharp; overlays are drawn in world units.
        // Zoomed (hud.js), the cached layer is scaled with it.
        const base = minimapBaseLayer(),
          zoom = view;
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
      // Map filters (map-view.js MAP LAYERS) hide whole kinds of marker.
      if (big && mapLayerOn('gangs'))
        for (const gang of GANGS) {
          drawingContext.fillStyle = gang.id === 'harbor' ? '#bb73571f' : '#ad88ca29';
          drawingContext.beginPath();
          drawingContext.arc(gang.x, gang.y, 260, 0, TAU);
          drawingContext.fill();
          drawingContext.strokeStyle = gang.color + '99';
          drawingContext.lineWidth = 7;
          drawingContext.stroke();
        }
      paintSportsGround(drawingContext, false);
      if (mapLayerOn('services')) drawCivicMap(drawingContext, big);
      if (mapLayerOn('air')) {
        for (const pad of HELIPADS) {
          drawingContext.fillStyle = '#e4d3a3';
          drawingContext.font = 'bold 90px monospace';
          drawingContext.textAlign = 'center';
          if (mapWindowHas(pad.x, pad.y, 70)) drawingContext.fillText('H', pad.x, pad.y + 27);
        }
        // Rooftop helipads (rooftops.js): a smaller H.
        drawingContext.font = 'bold 64px monospace';
        for (const pad of roofHelipads) if (mapWindowHas(pad.x, pad.y, 50)) drawingContext.fillText('H', pad.x, pad.y + 20);
      }
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
      if (mapLayerOn('transit')) drawTransitMap(drawingContext, scale, big);
      if (mapLayerOn('sports')) drawSportsMap(drawingContext, scale, big);
      drawUserRoute(drawingContext, scale, big);
      if (!big) drawGpsRoutes(drawingContext, scale);
      drawCountyMap(drawingContext, scale, big);
      if (mapLayerOn('garages')) drawGarageMap(drawingContext, scale);
      if (mapLayerOn('bikes')) drawBikeShareMap(drawingContext, scale, big);
      drawAirCoverMap(drawingContext, scale);
      drawDrawbridgeMap(drawingContext, scale, big);
      if (mapLayerOn('air')) drawAviationMap(drawingContext, scale);
      if (mapLayerOn('police')) drawPoliceMap(drawingContext, scale);
      // A street event's runner (livingcity-events.js).
      drawLivingCityMap(drawingContext, scale);
      mapWindow.x0 = mapWindow.y0 = -Infinity;
      mapWindow.x1 = mapWindow.y1 = Infinity;
      drawingContext.restore();
      // Off the minimap's edge: an arrow on the rim toward the job and the waypoint.
      if (!big) drawMinimapEdgeBlips(drawingContext, width, height, scale, cx, cy, target);
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
        const text = mapTextScale();
        drawingContext.font = Math.round(11 * text) + 'px Arial';
        drawingContext.textAlign = 'left';
        drawingContext.fillText(distanceLabel(BLOCK_SIZE) + ' · 1 block', 28, 50 + 15 * text);
        drawingContext.restore();
        drawingContext.textAlign = 'center';
        const labels = [
          ['N O R T H  P O I N T', 2700, -2620],
          ['NORTH POINT KEY', 4100, -3040],
          ['HARBOR POINT MARINA', 1060, -2960],
          ['CRUISE TERMINAL', 2360, -3990],
          ['THE RECLAMATION', 1420, -760],
          ['N O R T H B A N K', 1580, 540],
          // Northbank's districts (district(), geography-ground.js) and Palm Keys' north end.
          ['OLD QUARTER', 1290, 1010],
          ['IRONWORKS DOCKS', 2960, 520],
          ['MIDTOWN', 1760, 2060],
          ['SOUTH BANK', 1560, 4190],
          ['ART DECO', -1830, 1010],
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
        // Names that never print over each other (map-view.js).
        drawMapLabels(drawingContext, labels, width, height, scale, cx, cy, text);
        // A dark band under the footer keeps it readable over the land when zoomed.
        drawingContext.fillStyle = '#0b1d28c8';
        drawingContext.fillRect(0, height - 17 - 13 * text, width, 17 + 13 * text);
        drawingContext.fillStyle = '#a6c4cb';
        drawingContext.font = Math.round(10 * text) + 'px monospace';
        drawingContext.textAlign = 'left';
        drawingContext.fillText('N ↑', 28, 27);
        // The guide's title only where the controls line leaves room for it.
        const controls = mapControlsLine(),
          guide = 'SOUTH COAST COUNTY / CITY GUIDE';
        if (drawingContext.measureText(guide + controls).width + 20 * text < width - 56)
          drawingContext.fillText(guide, 28, height - 17);
        drawingContext.textAlign = 'right';
        drawingContext.fillText(controls, width - 28, height - 17);
        // A gamepad drops the waypoint under the centre cross (gamepad.js).
        if (hintDevice() === 'gamepad') drawMapCross(drawingContext, width, height);
      }
      drawPlayerMapMarker(drawingContext, width, height, scale, cx, cy, big);
    }
