    // BEGIN SUBSYSTEM: src/navigation.js — City map and route planning
    /**
     * City map and route planning
     * Source: src/navigation.js
     * Scope: shared game closure.
     * Road graph, shortest paths, waypoints, map gestures and route guidance.
     */
    /* Player destinations remain independent from mission targets. Routes follow the shared roads and trails. */
    let userWaypoint = null,
      userRoute = [],
      routeApproach = null,
      routeGraph = null,
      routeTimer = 0,
      routeStatus = '',
      routeOrigin = null,
      routeGraphGates = '';
    function navigationGateState() {
      return (harborGate < 0.82 ? 'closed' : 'open') + ':' + (militaryGate > 0.85 ? 'open' : 'closed');
    }
    // Test whole segments against narrow walls/barriers; point samples can step over them.
    function navSegmentHitsRect(a, b, rect, padding = 3) {
      let enter = 0,
        leave = 1;
      for (const [axis, size] of [
        ['x', 'w'],
        ['y', 'h'],
      ]) {
        const delta = b[axis] - a[axis],
          lo = rect[axis] - padding,
          hi = rect[axis] + rect[size] + padding;
        if (Math.abs(delta) < 1e-9) {
          if (a[axis] < lo || a[axis] > hi) return false;
          continue;
        }
        const first = (lo - a[axis]) / delta,
          last = (hi - a[axis]) / delta;
        enter = Math.max(enter, Math.min(first, last));
        leave = Math.min(leave, Math.max(first, last));
        if (enter > leave) return false;
      }
      return true;
    }
    function navSegmentClear(a, b) {
      if (
        [...harborSolids(), ...militarySolids(), ...STADIUM_STANDS].some((rect) =>
          navSegmentHitsRect(a, b, rect),
        )
      )
        return false;
      const n = Math.max(1, Math.ceil(distanceBetween(a, b) / 18));
      for (let i = 0; i <= n; i++) {
        const x = a.x + ((b.x - a.x) * i) / n,
          y = a.y + ((b.y - a.y) * i) / n;
        if (!groundAt(x, y, 3) || solid(x, y, 3)) return false;
      }
      return true;
    }
    function navigationGraph() {
      const gateState = navigationGateState();
      if (routeGraph && routeGraphGates === gateState) return routeGraph;
      // Built as if the drawbridge were down; its links are priced when searched.
      drawbridge.routing = true;
      try {
        return buildNavigationGraph(gateState);
      } finally {
        drawbridge.routing = false;
      }
    }
    function buildNavigationGraph(gateState) {
      const roads = [
          ...cityStreets(),
          ...BOULEVARDS,
          ...COUNTY_ROADS,
          ...SERVICE_ROADS,
          ...MOUNTAIN_TRAILS,
        ],
        segments = [];
      for (const r of roads)
        for (let i = 1; i < r.points.length; i++) {
          const a = {
              x: r.points[i - 1][0],
              y: r.points[i - 1][1],
            },
            b = {
              x: r.points[i][0],
              y: r.points[i][1],
            };
          segments.push({
            a,
            b,
            trail: !!r.trail,
            cuts: [0, 1],
          });
        }
      for (let i = 0; i < segments.length; i++)
        for (let j = i + 1; j < segments.length; j++) {
          const s = segments[i],
            t = segments[j],
            dx = s.b.x - s.a.x,
            dy = s.b.y - s.a.y,
            ex = t.b.x - t.a.x,
            ey = t.b.y - t.a.y,
            den = dx * ey - dy * ex;
          if (Math.abs(den) < 0.001) {
            // Collinear roads that overlap (a street carried across a bridge and
            // the bridge deck itself) share nodes at each other's ends, or the
            // two would run side by side without ever joining.
            const along = (seg, p) => {
              const len2 = (seg.b.x - seg.a.x) ** 2 + (seg.b.y - seg.a.y) ** 2,
                u = ((p.x - seg.a.x) * (seg.b.x - seg.a.x) + (p.y - seg.a.y) * (seg.b.y - seg.a.y)) / len2;
              return u > 0 && u < 1 && segmentDistance(p.x, p.y, [seg.a.x, seg.a.y], [seg.b.x, seg.b.y]) < 0.5 ? u : null;
            };
            for (const [seg, other] of [
              [s, t],
              [t, s],
            ])
              for (const p of [other.a, other.b]) {
                const u = along(seg, p);
                if (u !== null) seg.cuts.push(u);
              }
            continue;
          }
          const qx = t.a.x - s.a.x,
            qy = t.a.y - s.a.y,
            u = (qx * ey - qy * ex) / den,
            v = (qx * dy - qy * dx) / den;
          if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
            s.cuts.push(u);
            t.cuts.push(v);
          }
        }
      const nodes = [],
        lookup = new Map(),
        add = (p) => {
          const key = Math.round(p.x * 10) + ',' + Math.round(p.y * 10);
          if (lookup.has(key)) return lookup.get(key);
          const i = nodes.length;
          nodes.push({
            ...p,
            links: [],
          });
          lookup.set(key, i);
          return i;
        };
      for (const s of segments) {
        s.cuts.sort((a, b) => a - b);
        for (let i = 1; i < s.cuts.length; i++) {
          const lo = s.cuts[i - 1],
            hi = s.cuts[i],
            n = Math.max(1, Math.ceil((distanceBetween(s.a, s.b) * (hi - lo)) / 90));
          let previous = null;
          for (let j = 0; j <= n; j++) {
            const f = lo + ((hi - lo) * j) / n,
              p = {
                x: s.a.x + (s.b.x - s.a.x) * f,
                y: s.a.y + (s.b.y - s.a.y) * f,
              };
            if (!groundAt(p.x, p.y, 3) || solid(p.x, p.y, 3)) {
              previous = null;
              continue;
            }
            const id = add(p);
            if (previous !== null && id !== previous && navSegmentClear(nodes[previous], p)) {
              const cost = distanceBetween(nodes[previous], p) * (s.trail ? 1.25 : 1),
                // Across the drawbridge's span: priced by its opening (navShortestPath).
                overBridge = drawbridgeLinkCrosses(nodes[previous], p);
              nodes[previous].links.push({
                id,
                cost,
                drawbridge: overBridge,
              });
              nodes[id].links.push({
                id: previous,
                cost,
                drawbridge: overBridge,
              });
            }
            previous = id;
          }
        }
      }
      routeGraphGates = gateState;
      return (routeGraph = nodes);
    }
    function closestNavNode(p, nodes) {
      const candidates = nodes
        .map((q, i) => ({
          i,
          d: distanceBetween(p, q),
        }))
        .filter((q) => nodes[q.i].links.length)
        .sort((a, b) => a.d - b.d);
      return (
        candidates.slice(0, 18).find((q) => q.d < 380 && navSegmentClear(p, nodes[q.i])) ||
        candidates[0]
      )?.i;
    }
    function navShortestPath(nodes, start, end) {
      const heap = [],
        push = (id, cost) => {
          let i = heap.length;
          heap.push({
            id,
            cost,
          });
          while (i) {
            const p = (i - 1) >> 1;
            if (heap[p].cost <= cost) break;
            heap[i] = heap[p];
            i = p;
          }
          heap[i] = {
            id,
            cost,
          };
        },
        pop = () => {
          const top = heap[0],
            last = heap.pop();
          if (heap.length) {
            let i = 0;
            while (i * 2 + 1 < heap.length) {
              let c = i * 2 + 1;
              if (c + 1 < heap.length && heap[c + 1].cost < heap[c].cost) c++;
              if (heap[c].cost >= last.cost) break;
              heap[i] = heap[c];
              i = c;
            }
            heap[i] = last;
          }
          return top;
        },
        cost = new Map([[start, 0]]),
        prev = new Map(),
        closed = new Set();
      // While the drawbridge is up, crossing it costs the wait (drawbridge.js):
      // a short trip waits for it, a long one goes round by the Keys Bridge.
      const bridgeDelay = drawbridgeRouteDelay();
      push(start, distanceBetween(nodes[start], nodes[end]));
      while (heap.length) {
        const { id } = pop();
        if (closed.has(id)) continue;
        if (id === end) {
          const path = [];
          for (let n = end; n !== undefined; n = prev.get(n))
            path.unshift({
              x: nodes[n].x,
              y: nodes[n].y,
            });
          return path;
        }
        closed.add(id);
        for (const link of nodes[id].links) {
          const next = cost.get(id) + link.cost + (link.drawbridge ? bridgeDelay : 0);
          if (next < (cost.get(link.id) ?? Infinity)) {
            cost.set(link.id, next);
            prev.set(link.id, id);
            push(link.id, next + distanceBetween(nodes[link.id], nodes[end]));
          }
        }
      }
      return [];
    }
    function calculateUserRoute() {
      if (!userWaypoint) return;
      const nodes = navigationGraph();
      if (!nodes.length) {
        userRoute = [];
        routeStatus = 'DIRECTION ONLY';
        return;
      }
      const start = closestNavNode(player, nodes),
        end = closestNavNode(userWaypoint, nodes);
      userRoute = navShortestPath(nodes, start, end);
      routeOrigin = {
        x: player.x,
        y: player.y,
      };
      routeTimer = 2;
      routeApproach = userRoute.at(-1) || nodes[end];
      const exact = navSegmentClear(routeApproach, userWaypoint);
      if (userRoute.length && exact) {
        userRoute.push({
          ...userWaypoint,
        });
        routeApproach = userWaypoint;
      }
      routeStatus = !userRoute.length
        ? 'NO ROAD CONNECTION'
        : !groundAt(userWaypoint.x, userWaypoint.y)
          ? 'ROUTE TO SHORE'
          : !exact
            ? 'NEAREST ROAD APPROACH'
            : terrainHeight(userWaypoint.x, userWaypoint.y) > 40
              ? 'MOUNTAIN TRAIL · 4×4 RECOMMENDED'
              : 'YOUR DESTINATION';
      getElement('mapRouteStatus').textContent =
        routeStatus + ' · ' + (userRoute.length ? 'Follow the cyan route' : 'Use the direction marker');
    }
    function setWaypoint(x, y) {
      userWaypoint = {
        x: clamp(x, WORLD_LEFT, WORLD_SIZE),
        y: clamp(y, WORLD_TOP, WORLD_SIZE),
      };
      calculateUserRoute();
      drawMap(cityMapContext, 800, 660, true);
      updateUI();
      tell('Destination set. Follow the cyan route. Your mission remains active.', 3);
    }
    function clearWaypoint() {
      userWaypoint = null;
      userRoute = [];
      routeApproach = null;
      routeStatus = '';
      getElement('mapRouteStatus').textContent =
        'Tap a destination · Drag to pan · Pinch or use + / − to zoom';
      if (mapOpen) drawMap(cityMapContext, 800, 660, true);
      updateUI();
    }
    function updateWaypoint(deltaSeconds) {
      if (!userWaypoint) return;
      if (routeGraphGates !== navigationGateState()) calculateUserRoute();
      if (
        routeApproach &&
        distanceBetween(player, routeApproach) < 32 &&
        !player.parachute &&
        (!player.car || aircraftClearance(player.car) < 5)
      ) {
        const near = distanceBetween(player, userWaypoint) < 45;
        clearWaypoint();
        announce(
          near ? 'DESTINATION REACHED' : 'ROAD APPROACH REACHED',
          near ? 'YOU HAVE ARRIVED' : 'CONTINUE ON FOOT OR BY WATER',
          2.5,
        );
        return;
      }
      routeTimer -= deltaSeconds;
      if (routeTimer <= 0 && (!routeOrigin || distanceBetween(player, routeOrigin) > 100))
        calculateUserRoute();
      while (userRoute.length > 1 && distanceBetween(player, userRoute[0]) < 65) userRoute.shift();
    }
    function waypointNavigation() {
      if (!userWaypoint) return null;
      const flying = player.parachute || (isAircraft(player.car) && aircraftClearance(player.car) > 35),
        next = flying
          ? userWaypoint
          : userRoute.find((p) => distanceBetween(player, p) > 65) || routeApproach || userWaypoint;
      let length = distanceBetween(player, next);
      if (!flying && userRoute.length)
        for (let i = Math.max(1, userRoute.indexOf(next) + 1); i < userRoute.length; i++)
          length += distanceBetween(userRoute[i - 1], userRoute[i]);
      return {
        visible: true,
        distance: Math.round(worldMeters(length)),
        a: headingBetween(player, next),
        name: routeStatus || 'YOUR DESTINATION',
      };
    }
    // `line` false draws only the waypoint's marker (the minimap draws its own
    // route line when GPS is on, and none when it is off).
    function drawUserRoute(drawingContext, scale, line = true) {
      if (!userWaypoint) return;
      drawingContext.save();
      if (line) {
        drawingContext.strokeStyle = '#73edf0';
        drawingContext.lineWidth = 3 / scale;
        drawingContext.lineJoin = 'round';
        drawingContext.beginPath();
        userRoute.forEach((p, i) =>
          i ? drawingContext.lineTo(p.x, p.y) : drawingContext.moveTo(p.x, p.y),
        );
        drawingContext.stroke();
      }
      drawingContext.fillStyle = '#103843';
      drawingContext.strokeStyle = '#8effed';
      drawingContext.lineWidth = 2 / scale;
      drawingContext.beginPath();
      drawingContext.arc(userWaypoint.x, userWaypoint.y, 8 / scale, 0, TAU);
      drawingContext.fill();
      drawingContext.stroke();
      drawingContext.fillStyle = '#aaffdf';
      drawingContext.beginPath();
      drawingContext.arc(userWaypoint.x, userWaypoint.y, 3 / scale, 0, TAU);
      drawingContext.fill();
      drawingContext.restore();
    }
    /**
     * GPS ON THE MINIMAP
     * With the GPS setting on (Settings · Gameplay, on by default, hudState.gps in
     * hud.js) the minimap draws the road route to the map waypoint (cyan) and to
     * the mission objective or the ringing payphone (gold), each a bright line
     * with chevrons pointing the way, instead of the straight dashed line. The
     * objective route is the same A* over the road graph as the waypoint's; it is
     * worked out again every couple of seconds once the player or the target has
     * moved, and trimmed as its points are passed. In an aircraft, on a boat or on
     * a ride there is no road to follow and the straight line stays. The big map
     * is unaffected.
     */
    const gpsRoute = { points: [], target: null, origin: null, timer: 0 };
    function gpsRoadless() {
      return (
        !!player.parachute ||
        !!player.coaster ||
        !!transitRide ||
        isAircraft(player.car) ||
        isBoat(player.car) ||
        !!player.swimming
      );
    }
    function updateGpsRoute(deltaSeconds) {
      const target = objective();
      if (!hudState.gps || !target || gpsRoadless() || !groundAt(target.x, target.y)) {
        gpsRoute.points = [];
        gpsRoute.target = null;
        return;
      }
      gpsRoute.timer -= deltaSeconds;
      const moved =
        !gpsRoute.target ||
        distanceBetween(gpsRoute.target, target) > 60 ||
        distanceBetween(gpsRoute.origin, player) > 100;
      if ((moved && gpsRoute.timer <= 0) || !gpsRoute.points.length && gpsRoute.timer <= 0) {
        gpsRoute.timer = 2;
        gpsRoute.target = { x: target.x, y: target.y };
        gpsRoute.origin = { x: player.x, y: player.y };
        const nodes = navigationGraph();
        gpsRoute.points = [];
        if (nodes.length && distanceBetween(player, target) > 90) {
          const path = navShortestPath(nodes, closestNavNode(player, nodes), closestNavNode(target, nodes));
          if (path.length) {
            if (navSegmentClear(path.at(-1), target)) path.push({ x: target.x, y: target.y });
            gpsRoute.points = path;
          }
        }
      }
      while (gpsRoute.points.length > 1 && distanceBetween(player, gpsRoute.points[0]) < 65) gpsRoute.points.shift();
    }
    /* True when the minimap shows a road route to the objective (it then skips
       the straight dashed line). */
    function gpsRouteShown() {
      return hudState.gps && gpsRoute.points.length > 1;
    }
    // One route: a dark casing, the coloured line from the player along the road
    // points, and chevrons every ~26 screen pixels pointing along it.
    function drawGpsLine(drawingContext, scale, points, color) {
      if (points.length < 1) return;
      const line = [{ x: player.x, y: player.y }, ...points];
      drawingContext.save();
      drawingContext.lineJoin = 'round';
      drawingContext.lineCap = 'round';
      const trace = () => {
        drawingContext.beginPath();
        line.forEach((p, i) => (i ? drawingContext.lineTo(p.x, p.y) : drawingContext.moveTo(p.x, p.y)));
        drawingContext.stroke();
      };
      drawingContext.strokeStyle = 'rgba(6, 18, 26, 0.85)';
      drawingContext.lineWidth = 7.5 / scale;
      trace();
      drawingContext.strokeStyle = color;
      drawingContext.lineWidth = 4.5 / scale;
      trace();
      // Chevrons, only as far as the minimap can show.
      const spacing = 26 / scale,
        size = 3 / scale,
        reach = 190 / scale;
      drawingContext.strokeStyle = '#0b1c24';
      drawingContext.lineWidth = 1.6 / scale;
      let carry = spacing * 0.5;
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1],
          b = line[i],
          length = distanceBetween(a, b);
        if (length < 1e-3) continue;
        const ux = (b.x - a.x) / length,
          uy = (b.y - a.y) / length;
        for (let d = carry; d < length; d += spacing) {
          const x = a.x + ux * d,
            y = a.y + uy * d;
          if (Math.abs(x - player.x) < reach && Math.abs(y - player.y) < reach) {
            drawingContext.beginPath();
            drawingContext.moveTo(x - ux * size - uy * size, y - uy * size + ux * size);
            drawingContext.lineTo(x + ux * size * 0.6, y + uy * size * 0.6);
            drawingContext.lineTo(x - ux * size + uy * size, y - uy * size - ux * size);
            drawingContext.stroke();
          }
        }
        carry = (carry - length) % spacing;
        if (carry < 0) carry += spacing;
      }
      drawingContext.restore();
    }
    /* Minimap only (drawMap): the objective's road route and the waypoint's. */
    function drawGpsRoutes(drawingContext, scale) {
      if (!hudState.gps) return;
      if (gpsRoute.points.length > 1) drawGpsLine(drawingContext, scale, gpsRoute.points, '#f5c64a');
      if (userWaypoint && userRoute.length && !gpsRoadless()) drawGpsLine(drawingContext, scale, userRoute, '#5ef0f2');
    }
    function mapLocalPoint(e) {
      const r = getElement('bigmap').getBoundingClientRect(),
        s = Math.min(r.width / 800, r.height / 660),
        left = r.left + (r.width - 800 * s) / 2,
        top = r.top + (r.height - 660 * s) / 2;
      return {
        x: (e.clientX - left) / s,
        y: (e.clientY - top) / s,
        valid:
          e.clientX >= left &&
          e.clientX <= left + 800 * s &&
          e.clientY >= top &&
          e.clientY <= top + 660 * s,
      };
    }
    function mapWorldPoint(p) {
      const s = Math.min(800 / WORLD_WIDTH, 660 / WORLD_HEIGHT) * 0.92 * mapZoom;
      return {
        x: mapCenter.x + (p.x - 400) / s,
        y: mapCenter.y + (p.y - 330) / s,
      };
    }
    function zoomMap(factor) {
      mapZoom = clamp(mapZoom * factor, 1, 9);
      drawMap(cityMapContext, 800, 660, true);
    }
    const mapPointers = new Map();
    let mapGesture = null,
      mapPinch = null;
    getElement('bigmap').addEventListener('pointerdown', (e) => {
      if (!mapOpen) return;
      e.preventDefault();
      const p = mapLocalPoint(e);
      if (!p.valid) return;
      getElement('bigmap').setPointerCapture?.(e.pointerId);
      mapPointers.set(e.pointerId, p);
      if (mapPointers.size === 1)
        mapGesture = {
          id: e.pointerId,
          start: p,
          center: {
            ...mapCenter,
          },
          drag: false,
        };
      else if (mapPointers.size === 2) {
        const [a, b] = [...mapPointers.values()];
        mapPinch = {
          distance: distanceBetween(a, b),
          zoom: mapZoom,
        };
        if (mapGesture) mapGesture.drag = true;
      }
    });
    getElement('bigmap').addEventListener('pointermove', (e) => {
      if (!mapPointers.has(e.pointerId)) return;
      e.preventDefault();
      const p = mapLocalPoint(e);
      mapPointers.set(e.pointerId, p);
      if (mapPointers.size === 2 && mapPinch) {
        const [a, b] = [...mapPointers.values()];
        mapZoom = clamp((mapPinch.zoom * distanceBetween(a, b)) / Math.max(1, mapPinch.distance), 1, 9);
      } else if (mapGesture && mapGesture.id === e.pointerId) {
        const dx = p.x - mapGesture.start.x,
          dy = p.y - mapGesture.start.y;
        if (Math.hypot(dx, dy) > 5) mapGesture.drag = true;
        if (mapGesture.drag) {
          const s = Math.min(800 / WORLD_WIDTH, 660 / WORLD_HEIGHT) * 0.92 * mapZoom;
          mapCenter = {
            x: clamp(mapGesture.center.x - dx / s, WORLD_LEFT, WORLD_SIZE),
            y: clamp(mapGesture.center.y - dy / s, WORLD_TOP, WORLD_SIZE),
          };
        }
      }
      drawMap(cityMapContext, 800, 660, true);
    });
    function clearMapGesture() {
      mapPointers.clear();
      mapGesture = null;
      mapPinch = null;
    }
    function endMapPointer(e, cancel = false) {
      const p = mapLocalPoint(e);
      if (!cancel && mapGesture?.id === e.pointerId && !mapGesture.drag && !mapPinch && p.valid) {
        const w = mapWorldPoint(p);
        // GOD PANEL: god mode turns the map into a teleport: tap anywhere to be
        // there (godMapClick, god-panel.js: safe ground, the car to a road).
        if (godMapClick(w.x, w.y)) {
          // teleported
        } else if (taxiMapPick(w.x, w.y)) {
          // handled by the waiting cab
        } else setWaypoint(w.x, w.y);
      }
      mapPointers.delete(e.pointerId);
      if (!mapPointers.size) {
        mapGesture = null;
        mapPinch = null;
      } else if (mapPointers.size === 1) {
        const [id, point] = [...mapPointers.entries()][0];
        mapGesture = {
          id,
          start: point,
          center: {
            ...mapCenter,
          },
          drag: true,
        };
        mapPinch = null;
      }
    }
    getElement('bigmap').addEventListener('pointerup', (e) => endMapPointer(e));
    getElement('bigmap').addEventListener('pointercancel', (e) => endMapPointer(e, true));
    getElement('bigmap').addEventListener('lostpointercapture', (e) => endMapPointer(e, true));
    window.addEventListener('blur', clearMapGesture);
    window.addEventListener('resize', clearMapGesture);
    getElement('bigmap').addEventListener(
      'wheel',
      (e) => {
        if (mapOpen) {
          e.preventDefault();
          zoomMap(e.deltaY < 0 ? 1.2 : 1 / 1.2);
        }
      },
      {
        passive: false,
      },
    );
    getElement('mapZoomIn').onclick = () => zoomMap(1.4);
    getElement('mapZoomOut').onclick = () => zoomMap(1 / 1.4);
    getElement('clearRoute').onclick = clearWaypoint;
    function updateExplorationUI() {
      const t = player.car?.offroadState,
        p = player.parachute;
      const trekking =
        !player.car && !p && !transitRide && !playerOnRoof() && !player.coaster && terrainHeight(player.x, player.y) > 8;
      getElement('terrainStatus').style.display =
        gameMode === 'play' && (transitRide || t?.z > 8 || p || trekking || player.coaster)
          ? 'block'
          : 'none';
      if (player.coaster) {
        getElement('terrainStatus').textContent = coasterStatusText();
        return;
      }
      if (transitRide) {
        getElement('terrainStatus').textContent =
          'CITY RAIL → ' + transitRide.target.name + ' · E: NEXT STOP';
        return;
      }
      if (p)
        getElement('terrainStatus').textContent =
          (p.stage === 'freefall'
            ? 'FREEFALL · ' + keyName('handbrake') + ' TO OPEN'
            : 'PARACHUTE · A/D STEER · W GLIDE · S FLARE') +
          ' · ' +
          Math.round(worldMeters(player.altitude - terrainHeight(player.x, player.y))) +
          ' m ABOVE GROUND';
      else if (trekking) {
        const grade = player.mountainGrade || 0,
          degrees = Math.round((Math.atan(grade) * 180) / Math.PI);
        getElement('terrainStatus').textContent = player.tumble
          ? 'FALLING · ' + degrees + '° SLOPE'
          : (player.onMountainTrail
              ? 'ON THE TRAIL'
              : grade > 0.66
                ? 'TOO STEEP TO CLIMB'
                : grade > 0.52
                  ? 'LOOSE SCREE · DO NOT DESCEND HERE'
                  : grade > 0.34
                    ? 'SLIPPING · FIND THE TRAIL'
                    : 'OPEN GROUND') +
            ' · ' +
            degrees +
            '° · ' +
            Math.round(worldMeters(terrainHeight(player.x, player.y))) +
            ' m';
      } else if (t?.z > 8)
        getElement('terrainStatus').textContent =
          (t.four ? '4×4 TRACTION' : 'ROAD TIRES · LOW GRIP') +
          ' · ' +
          Math.round((Math.abs(Math.atan(t.along)) * 180) / Math.PI) +
          '° SLOPE · ' +
          Math.round(worldMeters(t.z)) +
          ' m';
    }
    // END SUBSYSTEM: src/navigation.js
