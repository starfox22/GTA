    // Map views: the city map's filters (MAP LAYERS) and GO TO list, sharp canvases on HiDPI screens,
    // the minimap's speed pull-back and its edge arrows toward the job and the waypoint.
    /**
     * MAP LAYERS
     * The legend under the city map is also its filter: each chip hides or
     * shows one kind of marker on both maps (drawMap asks mapLayerOn). Saved
     * in localStorage under 'dead-end-city-map'. The job, the waypoint, the
     * route and the player are always drawn.
     */
    const MAP_LAYERS = [
      { id: 'services', label: 'SHOPS & SERVICES', key: '+ GUN ZZ EAT' },
      { id: 'garages', label: 'RESPRAY', key: 'R' },
      { id: 'pickups', label: 'PICKUPS', key: '■' },
      { id: 'transit', label: 'CITY RAIL', key: 'M' },
      { id: 'bikes', label: 'BIKE SHARE', key: '◆' },
      { id: 'sports', label: 'SPORTS', key: '●' },
      { id: 'air', label: 'HELIPADS & PLANES', key: 'H' },
      { id: 'police', label: 'POLICE', key: '▶' },
      { id: 'gangs', label: 'GANG TURF', key: '◯' },
    ];
    const MAP_STORAGE = 'dead-end-city-map';
    const mapLayers = Object.fromEntries(MAP_LAYERS.map((l) => [l.id, true]));
    try {
      const saved = JSON.parse(localStorage.getItem(MAP_STORAGE));
      if (saved && typeof saved.layers === 'object')
        for (const l of MAP_LAYERS) if (saved.layers[l.id] === false) mapLayers[l.id] = false;
    } catch {}
    function mapLayerOn(id) {
      return mapLayers[id] !== false;
    }
    function setMapLayer(id, on) {
      if (!(id in mapLayers)) return;
      mapLayers[id] = !!on;
      try {
        localStorage.setItem(MAP_STORAGE, JSON.stringify({ layers: mapLayers }));
      } catch {}
      renderMapFilters();
      if (mapOpen) drawMap(cityMapContext, 800, 660, true);
      drawMinimap();
    }
    function renderMapFilters() {
      const box = getElement('mapFilters');
      if (!box) return;
      if (!box.childElementCount)
        for (const layer of MAP_LAYERS) {
          const button = document.createElement('button'),
            key = document.createElement('b');
          button.type = 'button';
          button.dataset.layer = layer.id;
          key.textContent = layer.key;
          key.setAttribute('aria-hidden', 'true');
          button.append(key, ' ' + layer.label);
          button.onclick = () => setMapLayer(layer.id, !mapLayerOn(layer.id));
          box.append(button);
        }
      for (const button of box.children) button.setAttribute('aria-pressed', String(mapLayerOn(button.dataset.layer)));
    }
    /**
     * GO TO
     * The nearest of every kind of place worth a trip, listed beside the map
     * with its distance: a tap centres the map there and sets the waypoint (the
     * cyan route), so the city's services and pastimes can be found without
     * knowing its symbols. Worked out when the map opens.
     */
    function nearestOf(points) {
      let best = null,
        bestD = Infinity;
      for (const p of points) {
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        const d = Math.hypot(p.x - player.x, p.y - player.y);
        if (d < bestD) {
          best = p;
          bestD = d;
        }
      }
      return best;
    }
    function placeDoors(kind) {
      return PLACES.filter((p) => p.kind === kind && p.door && (!p.monarch || nearMonarchIsle(player.x, player.y))).map((p) => ({
        x: p.door.x,
        y: p.door.y,
        name: p.name,
      }));
    }
    /* [heading, finder] pairs; a finder that throws (a system not built) is skipped. */
    const MAP_DESTINATIONS = [
      ['HOSPITAL', () => nearestOf(placeDoors('hospital'))],
      ['RESPRAY & REPAIRS', () => nearestOf(GARAGES.map((g) => ({ x: g.x, y: g.y, name: g.name })))],
      ['ARMORY', () => nearestOf(placeDoors('guns'))],
      ['CLOTHES · CHANGE YOUR LOOK', () => nearestOf(placeDoors('clothes'))],
      ['SAFEHOUSE · SLEEP', () => nearestOf(placeDoors('sleep'))],
      ['FOOD', () => nearestOf(placeDoors('diner'))],
      ['BAR', () => nearestOf(placeDoors('bar'))],
      ['NIGHTCLUB', () => nearestOf(placeDoors('club'))],
      ['CITY RAIL', () => nearestOf(RAIL_STATIONS.map((s) => ({ x: (s.entry || s).x, y: (s.entry || s).y, name: s.name + ' STATION' })))],
      ['BIKE SHARE', () => nearestOf((bikeStationCache || []).map((s) => ({ x: s.x, y: s.y, name: s.label || 'SOUTH COAST CYCLE' })))],
      ['CASINO', () => ({ x: CASINO.x + CASINO.w / 2, y: CASINO.y + CASINO.h, name: CASINO.name })],
      ['BEACH CLUB', () => ({ x: BEACH_CLUB_PLOT.x + 302, y: BEACH_CLUB_PLOT.y + 60, name: 'MAREA BEACH CLUB' })],
      ['BASKETBALL', () => ({ ...SPORTS_ENTRANCES.basketball, name: 'CITY COURTS' })],
      ['SOCCER STADIUM', () => ({ ...SPORTS_ENTRANCES.soccer, name: 'SOUTH COAST STADIUM' })],
      ['OFF-ROAD', () => ({ x: OFFROAD_CLUB.lot.x + OFFROAD_CLUB.lot.w / 2, y: OFFROAD_CLUB.lot.y + OFFROAD_CLUB.lot.h / 2, name: OFFROAD_CLUB.name })],
    ];
    function mapDestinations() {
      const out = [];
      for (const [heading, find] of MAP_DESTINATIONS) {
        let p = null;
        try {
          p = find();
        } catch {}
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y))
          out.push({ heading, name: p.name || heading, x: p.x, y: p.y, distance: Math.hypot(p.x - player.x, p.y - player.y) });
      }
      return out;
    }
    function renderMapPlaces() {
      const box = getElement('mapPlaces');
      if (!box) return;
      box.replaceChildren();
      for (const d of mapDestinations()) {
        const button = document.createElement('button'),
          head = document.createElement('small'),
          name = document.createElement('span'),
          far = document.createElement('b');
        button.type = 'button';
        head.textContent = d.heading;
        name.textContent = d.name;
        far.textContent = distanceLabel(d.distance);
        button.append(head, name, far);
        button.title = 'Route to ' + d.name;
        button.onclick = () => {
          mapCenter = { x: d.x, y: d.y };
          mapZoom = Math.max(mapZoom, 3);
          if (!godMapClick(d.x, d.y) && !taxiMapPick(d.x, d.y)) setWaypoint(d.x, d.y);
          drawMap(cityMapContext, 800, 660, true);
        };
        box.append(button);
      }
    }
    /* On opening the city map (toggleMap): sharp canvas, filters and the GO TO list. */
    function prepareCityMap() {
      renderMapFilters();
      renderMapPlaces();
      fitBigMapCanvas();
    }
    /**
     * SHARP CANVASES
     * Both maps draw in a fixed logical frame (the city map 800 x 660, the
     * minimap 240 wide) that pointer maths and zoom rely on; only the backing
     * store follows the box on screen times the pixel ratio (up to 2), so text
     * and markers stay crisp on HiDPI screens and phones.
     */
    const mapCanvasFit = { big: '', mini: '' };
    const minimapView = { w: 240, h: 160 };
    function fitBigMapCanvas() {
      const canvas = getElement('bigmap'),
        r = canvas.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const shown = Math.min(r.width / 800, r.height / 660),
        ratio = clamp(shown * Math.min(devicePixelRatio || 1, 2), 0.5, 4),
        key = ratio.toFixed(3);
      if (key === mapCanvasFit.big) return;
      mapCanvasFit.big = key;
      canvas.width = Math.round(800 * ratio);
      canvas.height = Math.round(660 * ratio);
      cityMapContext.setTransform(canvas.width / 800, 0, 0, canvas.height / 660, 0, 0);
    }
    // The minimap box's size, kept by a ResizeObserver (no layout read per HUD pass).
    const minimapBox = { w: 0, h: 0, observed: false };
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver((entries) => {
        const r = entries[entries.length - 1].contentRect;
        minimapBox.w = Math.round(r.width);
        minimapBox.h = Math.round(r.height);
      }).observe(getElement('minimap'));
      minimapBox.observed = true;
    }
    window.addEventListener('resize', () => {
      if (!mapOpen) return;
      fitBigMapCanvas();
      drawMap(cityMapContext, 800, 660, true);
    });
    function fitMinimapCanvas() {
      const canvas = getElement('minimap'),
        w = minimapBox.observed ? minimapBox.w : canvas.clientWidth,
        h = minimapBox.observed ? minimapBox.h : canvas.clientHeight;
      if (w < 8 || h < 8) return false;
      const dpr = Math.min(devicePixelRatio || 1, 2),
        key = w + 'x' + h + '@' + dpr;
      if (key !== mapCanvasFit.mini) {
        mapCanvasFit.mini = key;
        minimapView.w = 240;
        minimapView.h = Math.round((240 * h) / w);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        minimapContext.setTransform(canvas.width / minimapView.w, 0, 0, canvas.height / minimapView.h, 0, 0);
      }
      return true;
    }
    function drawMinimap() {
      if (hudState.minimapFolded || !fitMinimapCanvas()) return;
      drawMap(minimapContext, minimapView.w, minimapView.h);
    }
    /* City-map text grows when the map is shown smaller than its 800-pixel frame (a phone). */
    function mapTextScale() {
      const shown = getElement('bigmap').clientWidth;
      return shown > 0 ? clamp(800 / shown, 1, 2.2) : 1;
    }
    function mapControlsLine() {
      const device = hintDevice();
      if (device === 'touch') return 'PINCH ZOOM · DRAG PAN · TAP TO SET A ROUTE';
      if (device === 'gamepad') return 'L-STICK PAN · LT / RT ZOOM · A ROUTE · X CLEAR · Y FIND ME';
      return '+ / − ZOOM · ARROWS PAN · CLICK A ROUTE · C FIND ME · 0 RESET';
    }
    function drawMapCross(g, width, height) {
      g.save();
      g.translate(width / 2, height / 2);
      g.strokeStyle = '#091f2b';
      g.lineWidth = 4;
      for (const pass of [0, 1]) {
        g.beginPath();
        for (const [a, b] of [
          [-16, -6],
          [6, 16],
        ]) {
          g.moveTo(a, 0);
          g.lineTo(b, 0);
          g.moveTo(0, a);
          g.lineTo(0, b);
        }
        g.stroke();
        g.strokeStyle = '#8effed';
        g.lineWidth = 2;
        if (pass) break;
      }
      g.restore();
    }
    /**
     * MINIMAP SPEED PULL-BACK
     * Driving fast the minimap shows more road ahead: from 45 km/h the view
     * widens smoothly to 0.62x at 150 km/h (0.55x flying), eased over a second
     * or so so it never pumps with the throttle. On top of the player's own zoom.
     */
    const minimapPull = { value: 1, at: 0 };
    function minimapSpeedZoom() {
      const now = performance.now() / 1000,
        dt = clamp(now - (minimapPull.at || now), 0, 0.5),
        c = player.car,
        kmh = c ? Math.abs(c.speed || 0) / KMH : 0,
        want = !c ? 1 : isAircraft(c) && aircraftClearance(c) > 20 ? 0.55 : 1 - 0.38 * clamp((kmh - 45) / 105, 0, 1);
      minimapPull.at = now;
      minimapPull.value += (want - minimapPull.value) * (1 - Math.exp(-dt * 1.4));
      return minimapPull.value;
    }
    /**
     * EDGE ARROWS
     * The job (gold) and the waypoint (cyan) are drawn where they are; once off
     * the minimap a small arrow on its rim points the way, with the distance.
     */
    function drawMinimapEdgeBlips(g, width, height, scale, cx, cy, target) {
      const blips = [];
      if (target) blips.push({ x: target.x, y: target.y, color: '#f2d485' });
      if (userWaypoint) blips.push({ x: userWaypoint.x, y: userWaypoint.y, color: '#8effed' });
      for (const b of blips) {
        // The rim inset; deeper at the bottom, where the district name and the
        // MAP chip sit over the minimap.
        const dx = (b.x - cx) * scale,
          dy = (b.y - cy) * scale,
          m = 11,
          hx = width / 2 - m,
          hy = dy > 0 ? height / 2 - 30 : height / 2 - m;
        if (Math.abs(dx) <= hx && Math.abs(dy) <= hy) continue;
        const k = Math.min(hx / Math.max(1e-6, Math.abs(dx)), hy / Math.max(1e-6, Math.abs(dy))),
          x = width / 2 + dx * k,
          y = height / 2 + dy * k,
          a = Math.atan2(dy, dx);
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.fillStyle = b.color;
        g.strokeStyle = '#081822';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(8, 0);
        g.lineTo(-5, -6);
        g.lineTo(-2, 0);
        g.lineTo(-5, 6);
        g.closePath();
        g.stroke();
        g.fill();
        g.restore();
        const label = distanceLabel(Math.hypot(b.x - player.x, b.y - player.y));
        g.save();
        g.font = 'bold 8px Arial';
        g.textAlign = 'center';
        g.lineWidth = 2.5;
        g.strokeStyle = '#081822e0';
        g.fillStyle = b.color;
        const lx = clamp(x - Math.cos(a) * 17, 16, width - 16),
          ly = clamp(y - Math.sin(a) * 13 + 3, 9, height - 24);
        g.strokeText(label, lx, ly);
        g.fillText(label, lx, ly);
        g.restore();
      }
    }
    /* DeadEndCity.mapView(): the filters, the GO TO list and the canvases' sizes. */
    function mapViewReport() {
      return {
        layers: { ...mapLayers },
        destinations: mapDestinations().map((d) => ({ heading: d.heading, name: d.name, metres: Math.round(worldMeters(d.distance)) })),
        bigmap: { width: getElement('bigmap').width, height: getElement('bigmap').height },
        minimap: { width: getElement('minimap').width, height: getElement('minimap').height, logical: { ...minimapView } },
        speedZoom: +minimapPull.value.toFixed(3),
      };
    }
