    // BEGIN SUBSYSTEM: src/transit.js — Public railway simulation
    /**
     * Public railway simulation
     * Source: src/transit.js
     * Scope: shared game closure.
     * Track graph, station access, boarding, travel, stops and safe disembarkation.
     */
    /* Public railway follows existing road corridors and established bridge crossings. */
    const RAIL_LINES = [
      {
        id: 'city',
        name: 'CITY LINE',
        color: '#e2b766',
        points: [
          [2176, 300],
          [2176, 2688],
          [2688, 2688],
          [2688, 3200],
          [4500, 3200],
          [7232, 3200],
          [7800, 3350],
          [8420, 3112],
          [8932, 3112],
          [8932, 2600],
        ],
      },
      {
        id: 'south',
        name: 'COAST LINE',
        color: '#67c6bd',
        points: [
          [2176, 2688],
          [2176, 4900],
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
          [6750, 8000],
          [6750, 8112],
          [7262, 8112],
          [7800, 8150],
          [9140, 8150],
        ],
      },
      {
        id: 'ridge',
        name: 'RIDGE LINE',
        color: '#b3a1d8',
        points: [
          [8932, 2600],
          [9500, 2860],
          [9970, 3390],
          [10150, 4100],
          [9924, 4700],
          [9924, 5212],
          [9400, 5880],
          [8500, 5790],
          [7800, 5620],
          [7433.016, 7262.254],
          [7500, 7490],
          [7262, 7600],
          [7262, 8000],
          [7262, 8112],
        ],
      },
      {
        id: 'southport',
        name: 'AIRPORT BRANCH',
        color: '#e2b766',
        points: [
          [2176, 4160],
          [1664, 4160],
          [1240, 4290],
          [1000, 4560],
          [1220, 4720],
          [1220, 5030],
        ],
      },
    ];
    const RAIL_STATIONS = [
      {
        name: 'OLD QUARTER',
        x: 2176,
        y: 400,
        entry: {
          x: 2104,
          y: 400,
        },
      },
      {
        name: 'CENTRAL GARDEN',
        x: 2176,
        y: 2000,
        entry: {
          x: 2248,
          y: 2000,
        },
      },
      {
        name: 'MIDTOWN COLLEGE',
        x: 2176,
        y: 2400,
        entry: {
          x: 2104,
          y: 2400,
        },
      },
      {
        name: 'EXCHANGE',
        x: 2688,
        y: 2940,
        entry: {
          x: 2592,
          y: 2970,
        },
      },
      {
        name: 'PALM KEYS',
        x: 4500,
        y: 3200,
        entry: {
          x: 4500,
          y: 3120,
        },
      },
      {
        name: 'STONECREEK',
        x: 7100,
        y: 3200,
        entry: {
          x: 7100,
          y: 3128,
        },
      },
      {
        name: 'NORTHRIDGE',
        x: 8932,
        y: 2920,
        entry: {
          x: 8858,
          y: 2920,
        },
      },
      {
        name: 'EASTGATE',
        x: 9924,
        y: 4950,
        entry: {
          x: 9996,
          y: 4950,
        },
      },
      {
        name: 'SOUTH BANK',
        x: 2176,
        y: 4520,
        entry: {
          x: 2104,
          y: 4520,
        },
      },
      {
        name: 'OCEANVIEW',
        x: 2176,
        y: 7450,
        entry: {
          x: 2104,
          y: 7450,
        },
      },
      {
        name: 'OCEANVIEW AIRPORT',
        x: 4100,
        y: 8726.5823,
        entry: {
          x: 4100,
          y: 8828,
        },
      },
      {
        name: 'PALMSHORE',
        x: 7262,
        y: 7900,
        entry: {
          x: 7188,
          y: 7900,
        },
      },
      {
        name: 'SENTINEL CAUSEWAY',
        x: 9140,
        y: 8150,
        entry: {
          x: 9140,
          y: 8072,
        },
      },
      {
        name: 'SOUTHPORT TERMINAL',
        x: 1220,
        y: 5000,
        entry: {
          x: 1280,
          y: 5000,
        },
      },
    ];
    const RAIL_DECK_TOP = 60,
      railTrains = [],
      railPiers = [];
    let railGraph = null,
      transitRide = null,
      transitStation = null;
    // Terminal sidings support the complete train body without changing routing endpoints.
    const RAIL_TERMINAL_TRACKS = [
      {
        points: [
          [2176, 300],
          [2176, 150],
        ],
      },
      {
        points: [
          [1220, 5030],
          [1220, 5180],
        ],
      },
      {
        points: [
          [9140, 8150],
          [9290, 8150],
        ],
      },
      {
        points: [
          [8932, 2600],
          [8795.609975752717, 2537.5679466473707],
        ],
      },
      {
        points: [
          [8932, 2600],
          [8932, 2570],
        ],
      },
      {
        points: [
          [7262, 8112],
          [7262, 8142],
        ],
      },
    ];
    function railDecks() {
      return [...RAIL_LINES, ...RAIL_TERMINAL_TRACKS].flatMap((line) =>
        line.points.slice(1).map((b, i) => {
          const a = line.points[i];
          return {
            x: (a[0] + b[0]) / 2,
            y: (a[1] + b[1]) / 2,
            hx: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2,
            hy: 23,
            a: Math.atan2(b[1] - a[1], b[0] - a[0]),
            minHeight: 52,
            height: RAIL_DECK_TOP,
            rail: true,
          };
        }),
      );
    }
    function prepareRailInfrastructure() {
      for (const s of RAIL_STATIONS) {
        const a = railStationAngle(s),
          candidates = [35, -35, 55, -55, 80, -80].map((d) => ({
            x: s.entry.x + Math.cos(a) * d,
            y: s.entry.y + Math.sin(a) * d,
          }));
        s.lift = candidates.find(
          (p) =>
            groundAt(p.x, p.y, 16) &&
            !onRoad(p.x, p.y) &&
            !buildings.some(
              (b) => p.x > b.x - 17 && p.x < b.x + b.w + 17 && p.y > b.y - 17 && p.y < b.y + b.h + 17,
            ) &&
            !garageBlocked(p.x, p.y, 15),
        ) || {
          x: s.entry.x,
          y: s.entry.y,
        };
      }
      railPiers.length = 0;
      for (const b of railDecks()) {
        for (let d = -b.hx + 100; d < b.hx - 55; d += 190) {
          const cx = b.x + Math.cos(b.a) * d,
            cy = b.y + Math.sin(b.a) * d;
          if (
            !landAt(cx, cy) ||
            inAirport(cx, cy) ||
            underpassContains(cx, cy, -30) ||
            (Math.abs(cx - roadNear(cx)) < 105 && Math.abs(cy - rowNear(cy)) < 105) ||
            terrainHeight(cx, cy) > 12
          )
            continue;
          for (const side of [-1, 1]) {
            const x = cx - Math.sin(b.a) * side * 70,
              y = cy + Math.cos(b.a) * side * 70;
            if (
              !groundAt(x, y, 8) ||
              cityStreetAt(x, y, 12) ||
              buildings.some(
                (o) => x > o.x - 12 && x < o.x + o.w + 12 && y > o.y - 12 && y < o.y + o.h + 12,
              ) ||
              garageBlocked(x, y, 12) ||
              RAIL_STATIONS.some(
                (s) =>
                  distanceBetween(s.entry, {
                    x,
                    y,
                  }) < 58,
              )
            )
              continue;
            railPiers.push({
              x: x - 3,
              y: y - 3,
              w: 6,
              h: 6,
              height: 52,
              cx,
              cy,
            });
          }
        }
      }
      airCoverCache = null;
      routeGraph = null;
    }
    function railStationAngle(s) {
      const b = railDecks().reduce(
        (best, b) => {
          const q = coverLocal(b, s.x, s.y),
            d = Math.hypot(Math.max(0, Math.abs(q.x) - b.hx), q.y);
          return d < best.d
            ? {
                b,
                d,
              }
            : best;
        },
        {
          b: null,
          d: Infinity,
        },
      ).b;
      return b.a;
    }
    function railLift(s) {
      if (s.lift) return s.lift;
      const a = railStationAngle(s);
      return {
        x: s.entry.x + Math.cos(a) * 35,
        y: s.entry.y + Math.sin(a) * 35,
      };
    }
    function railAccessEnd(s) {
      const a = railStationAngle(s),
        lift = railLift(s),
        side = Math.sign(-(lift.x - s.x) * Math.sin(a) + (lift.y - s.y) * Math.cos(a)) || 1;
      return {
        x: s.x - Math.sin(a) * side * 33,
        y: s.y + Math.cos(a) * side * 33,
      };
    }
    function railStationCovers() {
      const blocks = [];
      for (const s of RAIL_STATIONS) {
        const a = railStationAngle(s),
          lift = railLift(s),
          end = railAccessEnd(s);
        for (const side of [-1, 1]) {
          const x = s.x - Math.sin(a) * side * 33,
            y = s.y + Math.cos(a) * side * 33;
          blocks.push(
            {
              x,
              y,
              hx: 82.5,
              hy: 9.5,
              a,
              minHeight: 54,
              height: 60,
              rail: true,
            },
            {
              x,
              y,
              hx: 87,
              hy: 12,
              a,
              minHeight: 86.5,
              height: 89.5,
              rail: true,
            },
          );
        }
        blocks.push({
          x: (end.x + lift.x) / 2,
          y: (end.y + lift.y) / 2,
          hx: distanceBetween(end, lift) / 2,
          hy: 7,
          a: headingBetween(lift, end),
          minHeight: 56.8,
          height: 60.8,
          rail: true,
        });
      }
      return blocks;
    }
    function railBlocked(x, y, r = 0) {
      if (
        RAIL_STATIONS.some((s) => {
          const p = railLift(s);
          return Math.abs(x - p.x) < 8.5 + r && Math.abs(y - p.y) < 8.5 + r;
        })
      )
        return true;
      const cell = railPierCells().get(Math.floor(x / 512) * 4096 + Math.floor(y / 512));
      if (!cell) return false;
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i];
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      return false;
    }
    // Piers bucketed by 512-unit cell; solid() asks about them for every pedestrian step.
    let railPierGrid = null,
      railPierGridCount = -1;
    function railPierCells() {
      if (railPierGrid && railPierGridCount === railPiers.length) return railPierGrid;
      railPierGrid = new Map();
      railPierGridCount = railPiers.length;
      for (const b of railPiers)
        for (let i = Math.floor((b.x - 16) / 512); i <= Math.floor((b.x + b.w + 16) / 512); i++)
          for (let j = Math.floor((b.y - 16) / 512); j <= Math.floor((b.y + b.h + 16) / 512); j++) {
            const key = i * 4096 + j;
            if (!railPierGrid.has(key)) railPierGrid.set(key, []);
            railPierGrid.get(key).push(b);
          }
      return railPierGrid;
    }
    function railNetwork() {
      if (railGraph) return railGraph;
      const nodes = [],
        segments = [],
        lookup = new Map(),
        add = (x, y) => {
          const key = Math.round(x * 10) + ',' + Math.round(y * 10);
          if (lookup.has(key)) return lookup.get(key);
          const id = nodes.length;
          nodes.push({
            x,
            y,
            links: [],
          });
          lookup.set(key, id);
          return id;
        };
      for (const l of RAIL_LINES)
        for (let i = 1; i < l.points.length; i++)
          segments.push({
            a: l.points[i - 1],
            b: l.points[i],
            cuts: [0, 1],
          });
      for (const s of segments) {
        const dx = s.b[0] - s.a[0],
          dy = s.b[1] - s.a[1],
          len2 = dx * dx + dy * dy;
        for (const p of [
          ...RAIL_LINES.flatMap((l) => l.points).map((p) => ({
            x: p[0],
            y: p[1],
          })),
          ...RAIL_STATIONS,
        ]) {
          const t = ((p.x - s.a[0]) * dx + (p.y - s.a[1]) * dy) / len2;
          if (t > 0 && t < 1 && segmentDistance(p.x, p.y, s.a, s.b) < 1) s.cuts.push(t);
        }
        s.cuts.sort((a, b) => a - b);
        for (let i = 1; i < s.cuts.length; i++) {
          const a = s.cuts[i - 1],
            b = s.cuts[i],
            u = add(s.a[0] + dx * a, s.a[1] + dy * a),
            v = add(s.a[0] + dx * b, s.a[1] + dy * b),
            cost = Math.hypot(dx, dy) * (b - a);
          if (u !== v) {
            nodes[u].links.push({
              id: v,
              cost,
            });
            nodes[v].links.push({
              id: u,
              cost,
            });
          }
        }
      }
      return (railGraph = nodes);
    }
    function railRoute(a, b) {
      const nodes = railNetwork(),
        nearest = (p) =>
          nodes.reduce(
            (best, q, i) => (distanceBetween(p, q) < distanceBetween(p, nodes[best]) ? i : best),
            0,
          );
      return navShortestPath(nodes, nearest(a), nearest(b));
    }
    function nearestStation() {
      return !player.car && !player.roof && !player.parachute
        ? RAIL_STATIONS.find((s) => distanceBetween(player, s.entry) < 48)
        : null;
    }
    function openTransit(s) {
      transitStation = s;
      gameMode = 'transit';
      keys = {};
      mouse.down = false;
      getElement('transitOverlay').classList.remove('hidden');
      getElement('transitTitle').textContent = s.name;
      getElement('transitOptions').replaceChildren();
      for (const target of RAIL_STATIONS) {
        if (target === s) continue;
        const route = railRoute(s, target);
        if (route.length < 2) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = target.name;
        button.onclick = () => boardTransit(target);
        getElement('transitOptions').appendChild(button);
      }
      getElement('transitTitle').focus();
      getElement('transitPanel').scrollTop = 0;
    }
    function closeTransit() {
      transitStation = null;
      getElement('transitOverlay').classList.add('hidden');
      if (gameMode === 'transit') gameMode = 'play';
      keys = {};
      canvas.focus();
    }
    function boardTransit(target) {
      if (gameMode !== 'transit' || !transitStation || player.car) return false;
      const from = transitStation,
        path = railRoute(from, target);
      if (path.length < 2) return false;
      closeTransit();
      const train = {
        x: from.x,
        y: from.y,
        a: headingBetween(path[0], path[1]),
        speed: 0,
        path,
        index: 1,
        color: '#e2b766',
        passenger: true,
      };
      transitRide = {
        train,
        from,
        target,
        boarding: 2,
        exitRequested: false,
      };
      railTrains.push(train);
      player.x = train.x;
      player.y = train.y;
      player.altitude = 62;
      tell('CITY RAIL · ' + target.name + ' · E to get off at the next station', 5);
      return true;
    }
    function transitInteract() {
      if (transitRide) {
        transitRide.exitRequested = true;
        tell('Stop requested. Getting off at the next station.', 3);
        return true;
      }
      const s = nearestStation();
      if (s) {
        openTransit(s);
        return true;
      }
      return false;
    }
    function railExitPoint(s) {
      for (const r of [0, 24, 40, 60, 85, 110])
        for (let i = 0; i < (r ? 16 : 1); i++) {
          const x = s.entry.x + Math.cos((i * TAU) / 16) * r,
            y = s.entry.y + Math.sin((i * TAU) / 16) * r;
          if (
            !solid(x, y, 9) &&
            !vehicles.some(
              (c) => Math.abs(entityElevation(c) - terrainHeight(x, y)) < 20 && pointInCar(x, y, c, 12),
            )
          )
            return {
              x,
              y,
            };
        }
      return null;
    }
    function leaveTransit(s, force = false) {
      if (!transitRide) return true;
      const exit = railExitPoint(s);
      if (!exit && !force) {
        transitRide.blockedStop = s;
        transitRide.train.speed = 0;
        return false;
      }
      const train = transitRide.train;
      railTrains.splice(railTrains.indexOf(train), 1);
      transitRide = null;
      player.x = exit?.x ?? spawn.x;
      player.y = exit?.y ?? spawn.y;
      player.altitude = terrainHeight(player.x, player.y);
      player.inv = 1;
      keys = {};
      tell('ARRIVED · ' + s.name + ' · Your vehicle is where you left it.', 4);
      return true;
    }
    function resetTransit() {
      transitRide = null;
      railTrains.length = 0;
      RAIL_LINES.slice(0, 3).forEach((l, i) => {
        const points = l.points.map((p) => ({
            x: p[0],
            y: p[1],
          })),
          path = [...points, ...points.slice(0, -1).reverse()];
        const a = headingBetween(path[0], path[1]),
          d = Math.min(160, distanceBetween(path[0], path[1]) * 0.65);
        railTrains.push({
          x: path[0].x + Math.cos(a) * d,
          y: path[0].y + Math.sin(a) * d,
          a,
          speed: 0,
          path,
          index: 1,
          color: l.color,
          wait: i * 3,
        });
      });
    }
    function updateTransit(deltaSeconds) {
      if (transitRide?.blockedStop) {
        leaveTransit(transitRide.blockedStop);
        if (transitRide?.blockedStop) return;
      }
      for (const t of railTrains) {
        if (transitRide?.train === t && transitRide.boarding > 0) {
          transitRide.boarding -= deltaSeconds;
          continue;
        }
        if (t.wait > 0) {
          t.wait -= deltaSeconds;
          continue;
        }
        const q = t.path[t.index];
        if (!q) continue;
        const d = distanceBetween(t, q);
        t.speed = Math.min(420, Math.sqrt(Math.max(0, d) * 200), t.speed + 110 * deltaSeconds);
        const step = Math.min(d, t.speed * deltaSeconds);
        t.a = headingBetween(t, q);
        t.x += Math.cos(t.a) * step;
        t.y += Math.sin(t.a) * step;
        if (d < Math.max(2, step + 0.2)) {
          t.x = q.x;
          t.y = q.y;
          t.index++;
          if (t.index >= t.path.length) {
            if (t.passenger) {
              leaveTransit(transitRide.target);
              break;
            }
            t.index = 1;
            t.wait = 5;
            t.speed = 0;
          } else if (t.passenger) {
            const station = RAIL_STATIONS.find((s) => distanceBetween(s, t) < 6);
            if (station) {
              if (transitRide.exitRequested) {
                leaveTransit(station);
                break;
              }
              t.wait = 1.2;
            }
          }
        }
        if (t.passenger) {
          player.x = t.x;
          player.y = t.y;
          player.a = t.a;
          player.altitude = 62;
        }
      }
    }
    function railCarPosition(t, behind = 0) {
      if (behind <= 0)
        return {
          x: t.x,
          y: t.y,
          a: t.a,
        };
      let p = {
          x: t.x,
          y: t.y,
        },
        index = t.index - 1,
        left = behind,
        a = t.a;
      while (index >= 0) {
        const q = t.path[index],
          d = distanceBetween(p, q);
        if (d > left) {
          const heading = headingBetween(q, p);
          return {
            x: p.x - Math.cos(heading) * left,
            y: p.y - Math.sin(heading) * left,
            a: heading,
          };
        }
        left -= d;
        if (d > 0.01) a = headingBetween(q, p);
        p = q;
        index--;
      }
      return {
        x: p.x - Math.cos(a) * left,
        y: p.y - Math.sin(a) * left,
        a,
      };
    }
    function drawTransit2D() {
      worldContext.save();
      for (const b of railDecks()) {
        if (!visible(b, b.hx + 40)) continue;
        worldContext.save();
        worldContext.translate(b.x, b.y - 18);
        worldContext.rotate(b.a);
        worldContext.fillStyle = '#354c5666';
        worldContext.fillRect(-b.hx, -23, b.hx * 2, 46);
        worldContext.fillStyle = '#92a9ab';
        for (const z of [-10, 10]) worldContext.fillRect(-b.hx, z, b.hx * 2, 2);
        worldContext.restore();
      }
      for (const t of railTrains) {
        if (!visible(t, 190)) continue;
        for (let i = 0; i < 3; i++) {
          const p = railCarPosition(t, i * 54);
          worldContext.save();
          worldContext.translate(p.x, p.y - 18);
          worldContext.rotate(p.a);
          worldContext.fillStyle = t.color;
          worldContext.fillRect(-23, -12, 47, 24);
          worldContext.fillStyle = '#234655';
          worldContext.fillRect(-13, -8, 26, 16);
          worldContext.restore();
        }
      }
      for (const s of RAIL_STATIONS) {
        if (visible(s.entry, 65)) {
          worldContext.fillStyle = '#224653';
          worldContext.fillRect(s.entry.x - 10, s.entry.y - 10, 20, 20);
          worldContext.fillStyle = '#d4e7cf';
          worldContext.font = 'bold 14px Arial';
          worldContext.textAlign = 'center';
          worldContext.fillText('M', s.entry.x, s.entry.y + 5);
        }
      }
      worldContext.restore();
    }
    function drawTransitMap(drawingContext, scale, big) {
      for (const line of RAIL_LINES) {
        drawingContext.save();
        drawingContext.setLineDash([7 / scale, 3 / scale]);
        strokeRoad(drawingContext, line.points, 2 / scale, line.color);
        drawingContext.restore();
      }
      drawingContext.save();
      drawingContext.font = 'bold ' + 10 / scale + 'px Arial';
      drawingContext.textAlign = 'center';
      for (const s of RAIL_STATIONS) {
        drawingContext.fillStyle = '#173f4b';
        drawingContext.beginPath();
        drawingContext.arc(s.x, s.y, 7 / scale, 0, TAU);
        drawingContext.fill();
        drawingContext.strokeStyle = '#d3e9ca';
        drawingContext.lineWidth = 1.5 / scale;
        drawingContext.stroke();
        drawingContext.fillStyle = '#e5f1d1';
        drawingContext.fillText('M', s.x, s.y + 3.5 / scale);
        if (big && mapZoom > 2) {
          drawingContext.fillText(s.name, s.x, s.y - 12 / scale);
        }
      }
      drawingContext.restore();
    }
    getElement('closeTransit').onclick = closeTransit;
    // END SUBSYSTEM: src/transit.js
