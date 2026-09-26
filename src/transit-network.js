    // Where a station's lift stands. It depends only on the track, so it is worked
    // out once per built track (solid() asks for every station on every call).
    const railLiftCache = new Map();
    function railLift(s) {
      if (s.lift) return s.lift;
      const decks = railDecks(),
        cached = railLiftCache.get(s);
      if (cached && cached.decks === decks) return cached.point;
      const a = railStationAngle(s),
        point = {
          x: s.entry.x + Math.cos(a) * 35,
          y: s.entry.y + Math.sin(a) * 35,
        };
      railLiftCache.set(s, { decks, point });
      return point;
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
      return !player.car && !playerOnRoof() && !player.parachute
        ? RAIL_STATIONS.find((s, i) => withinRange('station' + i, distanceBetween(player, s.entry), 48, 60))
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
        // Mark the stations on the way so the train brakes and calls at each.
        path = railRoute(from, target).map((p) => ({
          ...p,
          stop: RAIL_STATIONS.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 6),
        }));
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
      // One scenic train shuttles up and down each line.
      RAIL_LINES.forEach((l, i) => {
        const points = l.points.map((p) => ({
            x: p[0],
            y: p[1],
            stop: RAIL_STATIONS.some((s) => Math.hypot(s.x - p[0], s.y - p[1]) < 6),
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
    // Scenic trains dwell at every station; a passenger's train pauses briefly.
    const RAIL_DWELL = 4,
      RAIL_PASSENGER_CALL = 1.2;
    function updateTransit(deltaSeconds) {
      if (transitRide?.blockedStop) {
        leaveTransit(transitRide.blockedStop);
        if (transitRide?.blockedStop) return;
      }
      // A skipped ride (ride-skip.js) stands at the chosen platform while the
      // picture comes back, then lets the passenger off there.
      const alight = transitRide?.alight;
      if (alight) {
        alight.timer -= deltaSeconds;
        if (alight.timer <= 0) {
          transitRide.alight = null;
          leaveTransit(alight.station);
        }
      }
      for (const t of railTrains) {
        if (transitRide?.train === t && transitRide.alight) continue;
        if (transitRide?.train === t && transitRide.boarding > 0) {
          transitRide.boarding -= deltaSeconds;
          continue;
        }
        if (t.wait > 0) {
          t.wait -= deltaSeconds;
          continue;
        }
        if (!t.path[t.index]) continue;
        // Brake for the next stop, not for the next point on the line: a curve is
        // a run of points 30-60 units apart and the train takes it at speed.
        t.speed = Math.min(
          RAIL_TOP_SPEED,
          Math.sqrt(Math.max(0, railStopDistance(t)) * 2 * RAIL_ACCELERATION),
          t.speed + RAIL_ACCELERATION * deltaSeconds,
        );
        // Run on through as many track points as this frame's travel covers, so a
        // slow frame never holds the train back to one point per frame.
        let travel = Math.max(0.5, t.speed * deltaSeconds),
          ended = false;
        while (travel > 0) {
          const q = t.path[t.index],
            d = distanceBetween(t, q);
          if (d > travel) {
            t.a = headingBetween(t, q);
            t.x += Math.cos(t.a) * travel;
            t.y += Math.sin(t.a) * travel;
            break;
          }
          t.x = q.x;
          t.y = q.y;
          travel -= d;
          t.index++;
          if (t.index >= t.path.length) {
            if (t.passenger) {
              leaveTransit(transitRide.target);
              ended = true;
              break;
            }
            t.index = 1;
            t.wait = RAIL_DWELL + 1;
            t.speed = 0;
            break;
          }
          if (d > 0.01) t.a = headingBetween(q, t.path[t.index]);
          if (!q.stop) continue;
          if (t.passenger) {
            const station = RAIL_STATIONS.find((s) => distanceBetween(s, t) < 6);
            if (station && station !== transitRide.from) {
              if (transitRide.exitRequested) {
                leaveTransit(station);
                ended = true;
                break;
              }
              t.wait = RAIL_PASSENGER_CALL;
              t.speed = 0;
              break;
            }
          } else {
            t.wait = RAIL_DWELL;
            t.speed = 0;
            break;
          }
        }
        if (ended) break;
        if (t.passenger) {
          player.x = t.x;
          player.y = t.y;
          player.a = t.a;
          player.altitude = 62;
        }
      }
    }
    // Where a car `behind` units back from the head of train `t` sits, and which
    // way it faces. The heading comes from the track 14 units either side of the
    // car's centre, so bodies swing smoothly through a curve's chords.
    function railPathPoint(t, behind) {
      let p = {
          x: t.x,
          y: t.y,
        },
        index = t.index - 1,
        left = behind,
        a = t.a;
      if (left < 0) {
        // Ahead of the head: along the path towards its next points.
        let ahead = -left,
          i = t.index;
        while (i < t.path.length) {
          const q = t.path[i],
            d = distanceBetween(p, q);
          if (d >= ahead) {
            const h = headingBetween(p, q);
            return { x: p.x + Math.cos(h) * ahead, y: p.y + Math.sin(h) * ahead };
          }
          ahead -= d;
          if (d > 0.01) a = headingBetween(p, q);
          p = q;
          i++;
        }
        return { x: p.x + Math.cos(a) * ahead, y: p.y + Math.sin(a) * ahead };
      }
      while (index >= 0) {
        const q = t.path[index],
          d = distanceBetween(p, q);
        if (d > left) {
          const heading = headingBetween(q, p);
          return {
            x: p.x - Math.cos(heading) * left,
            y: p.y - Math.sin(heading) * left,
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
      };
    }
    function railCarPosition(t, behind = 0) {
      const p = railPathPoint(t, behind),
        front = railPathPoint(t, behind - 14),
        back = railPathPoint(t, behind + 14);
      return {
        x: p.x,
        y: p.y,
        a: Math.hypot(front.x - back.x, front.y - back.y) > 1 ? headingBetween(back, front) : t.a,
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
