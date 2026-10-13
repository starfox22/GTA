    // Sunset Pier's rides on both maps (drawMap): the Falcon's track as its real plan, traced from the ride's own
    // circuit (coasterCircuit), and a Ferris wheel sign at the Sunset Eye's hub (PIER.wheel). Read-only.
    /**
     * PARK RIDES ON THE MAP
     * The track is the coaster's simulated circuit seen from above (loops and the corkscrew fold onto themselves as
     * they do from the air), every few samples, as one Path2D in world units built once. It is drawn as a dark casing
     * under a violet line of a fixed width on the glass, so it reads the same at any zoom and never looks like the gold
     * GPS route. The Eye stands edge-on to the sky, so from above it is a thin line: the map shows a Ferris wheel sign
     * (rim, spokes, hub, legs) of a fixed size at the hub instead.
     */
    const PARK_MAP_TRACK = '#d9a3ff',
      PARK_MAP_CASING = '#1a1030';
    let parkMapTrackPath = null,
      parkMapTrackBox = null;
    function parkMapTrack() {
      if (parkMapTrackPath) return parkMapTrackPath;
      const T = coasterCircuit(),
        step = Math.max(1, Math.round(8 / T.ds)),
        path = new Path2D();
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (let i = 0; i <= T.count; i += step) {
        const k = i % T.count,
          x = T.X[k],
          y = T.Y[k];
        if (i) path.lineTo(x, y);
        else path.moveTo(x, y);
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      path.closePath();
      parkMapTrackBox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      return (parkMapTrackPath = path);
    }
    function drawParkRidesMap(g, scale, big) {
      const track = parkMapTrack(),
        box = parkMapTrackBox,
        wheel = PIER.wheel;
      if (mapWindowHasRect(box.x, box.y, box.w, box.h, 20 / scale)) {
        g.save();
        g.lineJoin = 'round';
        g.lineCap = 'round';
        g.strokeStyle = PARK_MAP_CASING;
        g.lineWidth = (big ? 4.4 : 3.6) / scale;
        g.stroke(track);
        g.strokeStyle = PARK_MAP_TRACK;
        g.lineWidth = (big ? 2 : 1.6) / scale;
        g.stroke(track);
        g.restore();
        mapMarkCount(1, 0);
      }
      if (!mapWindowHas(wheel.x, wheel.y, 16 / scale)) return;
      // The sign, in pixels of the glass round the hub.
      const r = big ? 10 : 6.5;
      g.save();
      g.translate(wheel.x, wheel.y);
      g.scale(1 / scale, 1 / scale);
      g.lineCap = 'round';
      // Legs (an A-frame to the ground), then the rim, spokes and hub over them.
      for (const pass of [0, 1]) {
        g.strokeStyle = pass ? '#f4ecff' : PARK_MAP_CASING;
        g.lineWidth = pass ? 1.4 : 3.4;
        g.beginPath();
        g.moveTo(-r * 0.7, r * 1.45);
        g.lineTo(0, 0);
        g.lineTo(r * 0.7, r * 1.45);
        g.moveTo(r, 0);
        g.arc(0, 0, r, 0, TAU);
        for (let k = 0; k < 4; k++) {
          const a = (k / 8) * TAU;
          g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          g.lineTo(-Math.cos(a) * r, -Math.sin(a) * r);
        }
        g.stroke();
      }
      g.fillStyle = PARK_MAP_TRACK;
      g.beginPath();
      g.arc(0, 0, 1.9, 0, TAU);
      g.fill();
      g.restore();
      mapMarkCount(1, 0);
    }
