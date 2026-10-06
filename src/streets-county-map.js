    // County road centre dashes (countyMarkingShapes, paintCountyRoads) and the player's map marker (centerMapOnPlayer).
    /* County roads' centre dashes as marking shapes (ROAD MARKINGS): 22 long every
       46 down each leg, not where another road joins; one shape per run. The
       scenic mountain roads' curves are walked as one line, a shape per dash;
       in 3D they paint their own (county3d-roads.js). */
    let countyMarkingCache = null;
    function countyMarkingShapes() {
      if (countyMarkingCache) return countyMarkingCache;
      countyMarkingCache = [];
      const joinedAt = (r, x, y) =>
        COUNTY_ROADS.some((o) => o !== r && o.points.some((p, j) => j && segmentDistance(x, y, o.points[j - 1], p) < o.width / 2 + 22));
      for (const r of COUNTY_ROADS) {
        if (!r.scenic) continue;
        if (VECTOR_GROUND_MARKINGS) continue;
        let along = 0;
        const at = (d) => {
          let rest = d;
          for (let i = 1; i < r.points.length; i++) {
            const a = r.points[i - 1],
              b = r.points[i],
              len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (rest <= len) return [a[0] + ((b[0] - a[0]) * rest) / len, a[1] + ((b[1] - a[1]) * rest) / len];
            rest -= len;
          }
          return r.points[r.points.length - 1];
        };
        for (let i = 1; i < r.points.length; i++) along += Math.hypot(r.points[i][0] - r.points[i - 1][0], r.points[i][1] - r.points[i - 1][1]);
        for (let d = 18; d < along - 30; d += 46) {
          const [ax, ay] = at(d),
            [bx, by] = at(d + 22);
          if (!joinedAt(r, ax, ay)) countyMarkingCache.push({ ax, ay, bx, by, hw: 1, pattern: 'solid', paint: '#d7c697' });
        }
      }
      for (const r of COUNTY_ROADS)
        for (let i = 1; i < r.points.length && !r.scenic; i++) {
          const a = r.points[i - 1],
            b = r.points[i],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy);
          let run = null;
          const flush = () => {
            if (run)
              countyMarkingCache.push({
                ax: a[0] + (dx * run.from) / len,
                ay: a[1] + (dy * run.from) / len,
                bx: a[0] + (dx * (run.to + 22)) / len,
                by: a[1] + (dy * (run.to + 22)) / len,
                hw: 1,
                pattern: 'dash',
                len: 22,
                period: 46,
                paint: '#d7c697',
              });
            run = null;
          };
          for (let d = 18; d < len - 12; d += 46) {
            const x = a[0] + (dx * d) / len,
              y = a[1] + (dy * d) / len,
              joined = COUNTY_ROADS.some(
                (o) => o !== r && o.points.some((p, j) => j && segmentDistance(x, y, o.points[j - 1], p) < o.width / 2 + 22),
              );
            if (joined) flush();
            else if (run) run.to = d;
            else run = { from: d, to: d };
          }
          flush();
        }
      return countyMarkingCache;
    }
    // County roads on a ground layer; with `detail` their centre dashes, unless
    // the 3D ground draws those itself (VECTOR_GROUND_MARKINGS).
    function paintCountyRoads(g, detail) {
      // The verge: a dusty olive shoulder (it read as pale gravel), grey on the bridges.
      for (const r of COUNTY_ROADS)
        strokeRoad(g, r.points, r.width + 12, r.bridge ? '#b1b4a9' : '#7f876b');
      for (const r of COUNTY_ROADS) strokeRoad(g, r.points, r.width, '#414d51');
      if (!detail || VECTOR_GROUND_MARKINGS) return;
      paintMarkingShapes(g, countyMarkingShapes());
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
      // The chase camera's view on the minimap: a soft wedge the way it looks (chase-camera.js).
      if (!big && !off && chaseCameraLive() && chaseCam.ready) {
        const look = chaseCam.viewYaw,
          half = Math.atan(Math.tan((chaseCam.fov * Math.PI) / 360) * chaseCam.aspect),
          reach = 46;
        drawingContext.fillStyle = 'rgba(255, 249, 218, 0.13)';
        drawingContext.beginPath();
        drawingContext.moveTo(0, 0);
        drawingContext.arc(0, 0, reach, look - half, look + half);
        drawingContext.closePath();
        drawingContext.fill();
      }
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
