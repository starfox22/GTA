    // BEGIN SUBSYSTEM: src/map-objective.js — The objective on the maps: road routes that always reach the road network
    // the player is on (navRouteEnds), the GPS route's last leg, the mission vehicle's highlight (Kessler's car: a
    // pulsing ring and its name on the minimap and the city map) and the console report gpsReport().
    /**
     * ROUTE ENDS
     * The road graph (navigation.js) has a few scraps that join nothing: a service road that starts inside Fort
     * Sentinel's gate island, a lane cut by a wall. The node nearest an objective can be one of them, and A* from the
     * player then finds nothing: the GPS showed no route at all (the fort's gate, the records office). The graph's
     * connected pieces are labelled once per graph; when the player's nearest node and the target's are in different
     * pieces, both ends move to the nearest nodes of the largest piece (the road network), so a route always comes as
     * close to the target as the roads go, and the map draws the rest as a short dashed leg.
     */
    function navComponents(nodes) {
      if (nodes.components) return nodes.components;
      const label = new Int32Array(nodes.length).fill(-1),
        sizes = [],
        todo = [];
      for (let i = 0; i < nodes.length; i++) {
        if (label[i] >= 0) continue;
        const id = sizes.length;
        let size = 0;
        label[i] = id;
        todo.push(i);
        while (todo.length) {
          const n = nodes[todo.pop()];
          size++;
          for (let k = 0; k < n.links.length; k++) {
            const j = n.links[k].id;
            if (label[j] < 0) {
              label[j] = id;
              todo.push(j);
            }
          }
        }
        sizes.push(size);
      }
      let main = 0;
      for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;
      return (nodes.components = { label, sizes, main });
    }
    /* The node of piece `piece` nearest p: as closestNavNode does it (the nearest 18, the first within 380 with a clear
       line, else the nearest), restricted to that piece. */
    function closestNavNodeIn(p, nodes, piece) {
      const label = navComponents(nodes).label,
        indices = [],
        distances = [];
      for (let i = 0; i < nodes.length; i++) {
        if (label[i] !== piece || !nodes[i].links.length) continue;
        const d = distanceBetween(p, nodes[i]),
          n = indices.length;
        if (n === 18 && d >= distances[n - 1]) continue;
        let at = Math.min(n, 17);
        while (at > 0 && distances[at - 1] > d) {
          indices[at] = indices[at - 1];
          distances[at] = distances[at - 1];
          at--;
        }
        indices[at] = i;
        distances[at] = d;
      }
      for (let i = 0; i < indices.length; i++) if (distances[i] < 380 && navSegmentClear(p, nodes[indices[i]])) return indices[i];
      return indices.length ? indices[0] : -1;
    }
    const navEnds = { start: 0, end: 0, moved: false };
    /* The start and end nodes for a road route from `from` to `to` (the GPS and the map waypoint): the nearest nodes,
       or, when those are in pieces that do not join, the nearest nodes of the road network itself. */
    function navRouteEnds(from, to, nodes) {
      const start = closestNavNode(from, nodes),
        end = closestNavNode(to, nodes),
        c = navComponents(nodes);
      navEnds.start = start;
      navEnds.end = end;
      navEnds.moved = false;
      if (c.label[start] === c.label[end]) return navEnds;
      const s = c.label[start] === c.main ? start : closestNavNodeIn(from, nodes, c.main),
        e = c.label[end] === c.main ? end : closestNavNodeIn(to, nodes, c.main);
      if (s >= 0 && e >= 0) {
        navEnds.start = s;
        navEnds.end = e;
        navEnds.moved = true;
      }
      return navEnds;
    }
    /**
     * MAP HIGHLIGHT
     * A mission vehicle the player is after is marked on both maps by its own sign, distinct from the gold objective
     * dot: a red ring (pulsing on the minimap; on the city map a CSS ring, #mapHighlight, pulses over the canvas, which
     * is drawn only when something changes) and its name. Mission 4: Kessler's car from his departure until the
     * uniform is out of its trunk.
     */
    const mapHighlight = { car: null, label: '' };
    function mapHighlightVehicle() {
      const m = fortJob(),
        c = m?.kcar;
      if (!c || m.stage > FORT_STAGE.take || c.hp <= 0 || !vehicles.includes(c)) return null;
      mapHighlight.car = c;
      mapHighlight.label = 'KESSLER';
      return mapHighlight;
    }
    function drawMapHighlight(g, scale, big) {
      const h = mapHighlightVehicle();
      if (!h || !mapWindowHas(h.car.x, h.car.y, 40 / scale)) return;
      const x = h.car.x,
        y = h.car.y,
        pulse = big ? 0 : (Math.sin(gameTime * 5) + 1) / 2;
      g.save();
      // A dark casing, the red ring (breathing on the minimap) and a dot on the car itself.
      g.lineWidth = 5 / scale;
      g.strokeStyle = 'rgba(20, 6, 6, 0.75)';
      g.beginPath();
      g.arc(x, y, (13 + pulse * 5) / scale, 0, TAU);
      g.stroke();
      g.lineWidth = 2.6 / scale;
      g.strokeStyle = '#ff4d3f';
      g.stroke();
      if (!big) {
        g.globalAlpha = 0.55 * (1 - pulse);
        g.lineWidth = 1.6 / scale;
        g.beginPath();
        g.arc(x, y, (19 + pulse * 9) / scale, 0, TAU);
        g.stroke();
        g.globalAlpha = 1;
      }
      g.fillStyle = '#ff4d3f';
      g.beginPath();
      g.arc(x, y, 3.2 / scale, 0, TAU);
      g.fill();
      // The name above the ring, on a dark plate.
      g.font = 'bold ' + (big ? 12 : 9) + 'px Arial';
      g.textAlign = 'center';
      const lift = (big ? 22 : 20) / scale;
      g.fillStyle = 'rgba(16, 6, 6, 0.8)';
      const w = (g.measureText(h.label).width + 8) / scale,
        tall = (big ? 15 : 12) / scale;
      g.fillRect(x - w / 2, y - lift - tall * 0.8, w, tall);
      mapMarkCount(1, 1);
      g.fillStyle = '#ffd7d2';
      mapLabel(g, h.label, x, y - lift, scale);
      g.restore();
    }
    /* The city map's pulse: a CSS ring over the canvas at the highlighted car (placed whenever the map is drawn). */
    function placeMapHighlightPulse(width, height, scale, cx, cy) {
      const el = getElement('mapHighlight');
      if (!el) return;
      const h = mapHighlightVehicle(),
        canvas = getElement('bigmap'),
        x = h ? width / 2 + (h.car.x - cx) * scale : -1,
        y = h ? height / 2 + (h.car.y - cy) * scale : -1;
      if (!h || x < 0 || y < 0 || x > width || y > height) {
        if (!el.classList.contains('hidden')) el.classList.add('hidden');
        return;
      }
      // The canvas shows its 800 x 660 frame contained in its box (object-fit: contain).
      const cw = canvas.clientWidth,
        ch = canvas.clientHeight,
        s = Math.min(cw / width, ch / height);
      el.style.left = Math.round(canvas.offsetLeft + canvas.clientLeft + (cw - width * s) / 2 + x * s) + 'px';
      el.style.top = Math.round(canvas.offsetTop + canvas.clientTop + (ch - height * s) / 2 + y * s) + 'px';
      if (el.classList.contains('hidden')) el.classList.remove('hidden');
    }
    /* The GPS route's last leg (both maps): where the roads stop short of the objective (inside the fort, across a
       lawn), a dashed gold line from the route's end to it. */
    function drawGpsLastLeg(g, scale, target) {
      const end = gpsRoute.points[gpsRoute.points.length - 1];
      if (!end || distanceBetween(end, target) < 20) return;
      g.save();
      g.strokeStyle = 'rgba(6, 18, 26, 0.85)';
      g.lineWidth = 5 / scale;
      g.setLineDash([7 / scale, 6 / scale]);
      g.beginPath();
      g.moveTo(end.x, end.y);
      g.lineTo(target.x, target.y);
      g.stroke();
      g.strokeStyle = '#f5c64a';
      g.lineWidth = 2.6 / scale;
      g.stroke();
      g.setLineDash([]);
      g.restore();
    }
    /* Console gpsReport(): the current objective and whether a road route to it exists, as the minimap and the big
       map draw it, with why not when there is none (no target, roadless travel, the GPS off, no road connection). */
    function gpsReport() {
      const target = objective(),
        nodes = navigationGraph(),
        out = {
          objective: target ? { x: Math.round(target.x), y: Math.round(target.y) } : null,
          instruction: mission?.instruction || null,
          gps: !!hudState.gps,
          roadless: gpsRoadless(),
          routePoints: gpsRoute.points.length,
          // Both maps draw the road route when there is one (else the straight dashed line).
          minimap: gpsRouteShown(),
          bigMap: gpsRouteShown(),
          highlight: mapHighlightVehicle() ? { label: mapHighlight.label, x: Math.round(mapHighlight.car.x), y: Math.round(mapHighlight.car.y) } : null,
        };
      if (!target || !nodes.length) return out;
      const ends = navRouteEnds(player, target, nodes),
        path = navShortestPath(nodes, ends.start, ends.end),
        c = navComponents(nodes);
      let length = 0;
      for (let i = 1; i < path.length; i++) length += distanceBetween(path[i - 1], path[i]);
      out.ground = !!groundAt(target.x, target.y);
      out.endNode = { x: Math.round(nodes[ends.end].x), y: Math.round(nodes[ends.end].y), off: Math.round(distanceBetween(nodes[ends.end], target)) };
      out.endsMoved = ends.moved;
      out.pieces = c.sizes.length;
      out.connected = path.length > 0;
      out.roadLength = Math.round(length);
      out.lastLeg = gpsRoute.points.length ? Math.round(distanceBetween(gpsRoute.points[gpsRoute.points.length - 1], target)) : null;
      out.distance = Math.round(distanceBetween(player, target));
      return out;
    }
