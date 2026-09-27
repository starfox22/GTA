    // Road markings as data (cityMarkingShapes), painting the city grid's streets, and crosswalks.
    /**
     * ROAD MARKINGS
     * The city grid's paint as data: `cityMarkingShapes()` lists every lane dash
     * run, zebra crossing and forecourt crossing as a strip from a to b, `hw`
     * either side of that line, with a pattern along it (`solid`; `dash`: `len`
     * on, every `period`, from a; `bars`: the same, each bar across the whole
     * strip, a zebra). The 2D view and the maps paint them (`paintMarkingShapes`);
     * the 3D ground draws them in its shader from the same list, crisp at any
     * zoom (ground-marks3d.js), so its painted sheet leaves them out.
     * `paint` is the colour: 'white' (crossings, stop lines), 'lane' (the cream
     * lane dashes) or 'yellow' (centre lines).
     */
    const MARKING_COLOURS = { white: '#d4d6c7', lane: '#d0c39a', yellow: '#c9a94a' };
    let cityMarkingCache = null;
    function cityMarkingShapes() {
      if (cityMarkingCache) return cityMarkingCache;
      const shapes = (cityMarkingCache = []),
        streets = cityStreets();
      // A strip in a frame at p turned by a: from (u0, v) to (u1, v).
      const turned = (p, a, u0, u1, v, hw, extra) => {
        const c = Math.cos(a),
          s = Math.sin(a);
        return { ax: p.x + c * u0 - s * v, ay: p.y + s * u0 + c * v, bx: p.x + c * u1 - s * v, by: p.y + s * u1 + c * v, hw, ...extra };
      };
      for (const r of streets) {
        const pos = (v) => (r.vertical ? { x: r.r, y: v } : { x: v, y: r.r });
        for (const v of [r.start, r.end]) {
          const p = pos(v),
            outward = v === r.start ? -1 : 1,
            a = r.vertical ? (outward > 0 ? Math.PI / 2 : -Math.PI / 2) : outward > 0 ? 0 : Math.PI;
          if (onBridge(p.x, p.y, -20) || onBoulevard(p.x, p.y, 65) || streetEndInJunction(r, p)) continue;
          // The forecourt's crossing in front of park and stadium gates: seven
          // bars 15 long (along the street) and 6 wide, every 13 across it.
          if (streetEndAtGate(p.x, p.y, a))
            shapes.push(turned(p, a + Math.PI / 2, -42, 42, -41.5, 7.5, { pattern: 'bars', len: 6, period: 13, paint: 'white' }));
          // Meeting the esplanade: five bars 13 long, every 12.
          else if (streetEndAtShore(p.x, p.y, a))
            shapes.push(turned(p, a + Math.PI / 2, -27, 27, -30.5, 6.5, { pattern: 'bars', len: 6, period: 12, paint: 'white' }));
        }
        // Lane dashes down the middle, 2 wide and 15 long every 32, stopping
        // short of each junction and of the boulevards: one shape per stretch.
        let run = null;
        const flush = () => {
          if (!run) return;
          const a = pos(run.from),
            b = pos(run.to + 15);
          // On an avenue the 3D ground draws a double yellow line there instead
          // (ground-data3d.js); the maps keep the dashes.
          shapes.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, hw: 1, pattern: 'dash', len: 15, period: 32, paint: 'lane', avenue: r.width >= 112 });
          run = null;
        };
        for (let v = r.start + 55; v < r.end - 50; v += 32) {
          const p = pos(v);
          if (Math.abs(v - (r.vertical ? rowNear(v) : roadNear(v))) < 85 || onBoulevard(p.x, p.y, 35)) flush();
          else if (run) run.to = v;
          else run = { from: v, to: v };
        }
        flush();
      }
      // Zebra crossings: bars 6 wide every 12, the full width of the carriageway.
      for (const c of cityCrosswalks()) {
        const along = c.w > c.h,
          length = along ? c.w : c.h;
        let last = 5;
        while (last + 12 <= length - 11) last += 12;
        const zebra = { pattern: 'bars', len: 6, period: 12, paint: 'white' };
        if (along) shapes.push({ ax: c.x + 5, ay: c.y + c.h / 2, bx: c.x + last + 6, by: c.y + c.h / 2, hw: c.h / 2, ...zebra });
        else shapes.push({ ax: c.x + c.w / 2, ay: c.y + 5, bx: c.x + c.w / 2, by: c.y + last + 6, hw: c.w / 2, ...zebra });
      }
      return shapes;
    }
    // Paints marking shapes (ROAD MARKINGS) the way the flat ground layers draw them.
    function paintMarkingShapes(drawingContext, shapes) {
      for (const m of shapes) {
        const length = Math.hypot(m.bx - m.ax, m.by - m.ay);
        drawingContext.save();
        drawingContext.translate(m.ax, m.ay);
        drawingContext.rotate(Math.atan2(m.by - m.ay, m.bx - m.ax));
        drawingContext.fillStyle = MARKING_COLOURS[m.paint] || m.paint;
        if (m.pattern === 'solid') drawingContext.fillRect(0, -m.hw, length, m.hw * 2);
        else for (let u = 0; u < length - 0.01; u += m.period) drawingContext.fillRect(u, -m.hw, Math.min(m.len, length - u), m.hw * 2);
        drawingContext.restore();
      }
    }
    // The grid's carriageways, pavements and street ends; with `detail` their
    // markings too (the 3D ground draws the markings itself and passes false).
    function paintCityStreets(drawingContext, detail = true) {
      const streets = cityStreets();
      drawingContext.save();
      for (const r of streets) strokeRoad(drawingContext, r.points, r.width + 28, '#9b9d90');
      for (const r of streets) strokeRoad(drawingContext, r.points, r.width, '#414c52');
      for (const r of streets) {
        const pos = (v) => (r.vertical ? { x: r.r, y: v } : { x: v, y: r.r });
        for (const v of [r.start, r.end]) {
          const p = pos(v),
            outward = v === r.start ? -1 : 1,
            a = r.vertical ? (outward > 0 ? Math.PI / 2 : -Math.PI / 2) : outward > 0 ? 0 : Math.PI;
          if (onBridge(p.x, p.y, -20) || onBoulevard(p.x, p.y, 65) || streetEndInJunction(r, p)) continue;
          if (streetEndAtGate(p.x, p.y, a)) {
            // Forecourt: the carriageway widens into a paved apron at the gates,
            // with a crossing where the footway passes in front of them (the
            // crossing is a marking shape) and a row of paving pads beyond it.
            drawingContext.save();
            drawingContext.translate(p.x, p.y);
            drawingContext.rotate(a);
            drawingContext.fillStyle = '#8f8d81';
            drawingContext.fillRect(-14, -r.width / 2 - 34, 78, r.width + 68);
            drawingContext.fillStyle = '#4b5659';
            drawingContext.fillRect(-14, -r.width / 2, 42, r.width);
            if (detail) {
              drawingContext.fillStyle = '#a5a396';
              for (let i = -3; i <= 3; i++) drawingContext.fillRect(56, i * 13 - 4, 16, 8);
            }
            drawingContext.restore();
            continue;
          }
          if (streetEndAtShore(p.x, p.y, a)) {
            // Meets the esplanade: a short apron and a crossing, no turning head.
            drawingContext.save();
            drawingContext.translate(p.x, p.y);
            drawingContext.rotate(a);
            drawingContext.fillStyle = '#4b5659';
            drawingContext.fillRect(0, -r.width / 2, 22, r.width);
            drawingContext.restore();
            continue;
          }
          // A closed end (at the airport fence, the marina quay): the carriageway
          // stops square at a kerb and the footway wraps round the end. It used to
          // swell into a painted turning circle that read like a helipad.
          drawingContext.save();
          drawingContext.translate(p.x, p.y);
          drawingContext.rotate(a);
          drawingContext.fillStyle = '#9b9d90';
          drawingContext.fillRect(0, -r.width / 2 - 14, r.width / 2 + 14, r.width + 28);
          drawingContext.fillStyle = '#c3c2b6';
          drawingContext.fillRect(0, -r.width / 2, 2.5, r.width);
          drawingContext.restore();
        }
      }
      if (detail) paintMarkingShapes(drawingContext, cityMarkingShapes());
      drawingContext.restore();
    }
    /* Zebra crossings on every leg of every junction, T-junctions included, as
       rectangles {x, y, w, h} the width of the carriageway they cross. A leg gets
       one only where its street really carries on and both ends of the crossing
       land on pavement (not a street that is not there, not the edge of a bridge
       deck over the water). layout() exports them for the audit. */
    let crosswalkCache = null;
    function cityCrosswalks() {
      if (crosswalkCache) return crosswalkCache;
      crosswalkCache = [];
      const streets = cityStreets(),
        kerbs = (x0, y0, x1, y1) => groundAt(x0, y0) && groundAt(x1, y1) && landAt(x0, y0) && landAt(x1, y1);
      for (const x of ROAD_CENTERS)
        for (const y of ROAD_ROWS) {
          const horizontal = streets.find((r) => !r.vertical && r.r === y && x >= r.start - 8 && x <= r.end + 8),
            vertical = streets.find((r) => r.vertical && r.r === x && y >= r.start - 8 && y <= r.end + 8);
          if (!horizontal || !vertical) continue;
          const hw = horizontal.width / 2,
            vw = vertical.width / 2,
            north = vertical.start < y - hw - 40,
            south = vertical.end > y + hw + 40,
            west = horizontal.start < x - vw - 40,
            east = horizontal.end > x + vw + 40;
          if ((north || south) + (west || east) < 2 && !(north && south) && !(west && east)) continue;
          if (north && kerbs(x - vw - 10, y - hw - 12, x + vw + 10, y - hw - 12)) crosswalkCache.push({ x: x - vw, y: y - hw - 19, w: vw * 2, h: 13 });
          if (south && kerbs(x - vw - 10, y + hw + 12, x + vw + 10, y + hw + 12)) crosswalkCache.push({ x: x - vw, y: y + hw + 6, w: vw * 2, h: 13 });
          if (west && kerbs(x - vw - 12, y - hw - 10, x - vw - 12, y + hw + 10)) crosswalkCache.push({ x: x - vw - 19, y: y - hw, w: 13, h: hw * 2 });
          if (east && kerbs(x + vw + 12, y - hw - 10, x + vw + 12, y + hw + 10)) crosswalkCache.push({ x: x + vw + 6, y: y - hw, w: 13, h: hw * 2 });
        }
      return crosswalkCache;
    }
