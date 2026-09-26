    // ---- The log flume ---------------------------------------------------------------
    /**
     * A trough on stilts round the east end of the island: out from the station
     * by the midway, a lift up to 90, a winding run back down, and the big drop
     * into the splash pool. Boats are points on the closed channel.
     */
    const FLUME_PATH = [
      [3990, -6450, 6],
      [4040, -6420, 6],
      [4120, -6380, 20],
      [4170, -6330, 60],
      [4200, -6290, 90],
      [4220, -6360, 90],
      [4215, -6480, 84],
      [4180, -6620, 78],
      [4100, -6680, 72],
      [4020, -6650, 68],
      [4000, -6590, 66],
      [4040, -6540, 64],
      [4080, -6510, 20],
      [4090, -6490, 6],
      [4060, -6476, 6],
      [4010, -6470, 6],
    ];
    let flumeCache = null;
    function flumeCircuit() {
      if (flumeCache) return flumeCache;
      const pts = [],
        n = FLUME_PATH.length;
      // Catmull-Rom through the control points, sampled every ~4 units.
      for (let i = 0; i < n; i++) {
        const p0 = FLUME_PATH[(i - 1 + n) % n],
          p1 = FLUME_PATH[i],
          p2 = FLUME_PATH[(i + 1) % n],
          p3 = FLUME_PATH[(i + 2) % n],
          steps = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 4));
        for (let k = 0; k < steps; k++) {
          const t = k / steps,
            t2 = t * t,
            t3 = t2 * t,
            c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
          pts.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2], p1[2], p2[2], p3[2])]);
        }
      }
      const cum = [0];
      for (let i = 1; i <= pts.length; i++) {
        const a = pts[i - 1],
          b = pts[i % pts.length];
        cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
      }
      flumeCache = { pts, cum, length: cum[cum.length - 1] };
      return flumeCache;
    }
    function flumePoint(s, out = {}) {
      const F = flumeCircuit(),
        L = F.length;
      s = ((s % L) + L) % L;
      let lo = 0,
        hi = F.pts.length;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (F.cum[mid] <= s) lo = mid;
        else hi = mid;
      }
      const a = F.pts[lo],
        b = F.pts[(lo + 1) % F.pts.length],
        f = (s - F.cum[lo]) / (F.cum[lo + 1] - F.cum[lo] || 1);
      out.x = a[0] + (b[0] - a[0]) * f;
      out.y = a[1] + (b[1] - a[1]) * f;
      out.z = a[2] + (b[2] - a[2]) * f;
      out.a = Math.atan2(b[1] - a[1], b[0] - a[0]);
      out.slope = (b[2] - a[2]) / Math.max(0.1, F.cum[lo + 1] - F.cum[lo]);
      return out;
    }
    /* Boat k's arc length now: the lift and the flats at a steady pace, the drops fast. */
    const FLUME_BOATS = 6;
    function flumeBoat(k, out = {}) {
      const F = flumeCircuit(),
        cycle = 70,
        u = (((gameTime + (k * cycle) / FLUME_BOATS) % cycle) / cycle),
        // Time is spent mostly on the lift and the winding run; the drop is quick.
        s = F.length * (u < 0.9 ? u / 0.9 * 0.93 : 0.93 + ((u - 0.9) / 0.1) * 0.07);
      return flumePoint(s, out);
    }
    function flumeSolids() {
      return FLUME_PATH.filter((p) => p[2] > 12).map((p) => ({ x: p[0] - 6, y: p[1] - 6, w: 12, h: 12, height: p[2], kind: 'flume' }))
        .concat([{ x: 4040, y: -6530, w: 70, h: 44, height: 4, kind: 'flume pool' }]);
    }
    // ---- The island ground -----------------------------------------------------------
    const PARK_TILE = { x: 1792, y: -7168, w: 2560, h: 1536, pixelsPerUnit: 0.64 },
      PARK_CAR_PARK = { x: 3290, y: -5846, w: 520, h: 110 };
    function paintParkIsland(g) {
      g.save();
      g.beginPath();
      SUNSET_ISLE.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = '#7d9a64';
      g.fill();
      g.clip();
      // A sand fringe and a paved sea wall round the island.
      g.lineJoin = 'round';
      g.strokeStyle = '#d8c9a0';
      g.lineWidth = 90;
      g.stroke();
      g.strokeStyle = '#c9c2b0';
      g.lineWidth = 26;
      g.stroke();
      // Lawn texture: mown stripes.
      g.globalAlpha = 0.08;
      g.fillStyle = '#e8f0d0';
      for (let x = 1792; x < 4352; x += 36) g.fillRect(x, -7168, 18, 1536);
      g.globalAlpha = 1;
      // Beach club sand and pool deck on the north shore.
      const bc = PIER.beachClub;
      g.fillStyle = '#e2d3a8';
      g.fillRect(bc.x - 40, bc.y - 60, bc.w + 80, bc.h + 60);
      g.fillStyle = '#efe7d6';
      g.fillRect(bc.x, bc.y + 60, bc.w, 90);
      // Car park and bus bay by the bridge.
      const lot = PARK_CAR_PARK;
      g.fillStyle = '#4b5458';
      g.fillRect(lot.x, lot.y, lot.w, lot.h);
      g.fillStyle = '#d6d3c4';
      for (let x = lot.x + 8; x < lot.x + lot.w - 8; x += 26) {
        g.fillRect(x, lot.y + 4, 2, 38);
        g.fillRect(x, lot.y + lot.h - 42, 2, 38);
      }
      g.fillStyle = '#c7ba8e';
      g.fillRect(3246, -5856, 44, 30);
      g.fillStyle = '#e8d24a';
      g.font = 'bold 10px monospace';
      g.fillText('BUS', 3256, -5836);
      g.restore();
      paintCountyRoads(g, true);
      drawBridgeGround(g);
      paintSunsetPier(g);
    }
    /* Paving, the lagoon, ride pads, flower beds and labels. */
    function paintSunsetPier(g) {
      g.save();
      g.beginPath();
      SUNSET_ISLE.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.clip();
      const p = PIER;
      // Gate plaza: a star pattern in two stones.
      g.fillStyle = '#e4d8bd';
      g.fillRect(p.plaza.x, p.plaza.y, p.plaza.w, p.plaza.h);
      g.strokeStyle = '#c8b58c';
      g.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.beginPath();
        g.moveTo(p.gate.x, p.gate.y - 20);
        g.lineTo(p.gate.x + Math.cos(a) * 70, p.gate.y - 20 + Math.sin(a) * 60);
        g.stroke();
      }
      // UNICORN STATUE: a ring of pale limestone round the plinth on the
      // lawn (the plinth is a mesh), a dark granite kerb with a brass line
      // inlaid, the paving laid in courses; a short walk from the east gate
      // promenade.
      const U = p.unicorn;
      g.strokeStyle = '#b9a988';
      g.lineWidth = 20;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(3946, U.y + 6);
      g.lineTo(U.x - U.apron, U.y + 6);
      g.stroke();
      g.strokeStyle = '#e6dcc4';
      g.lineWidth = 15;
      g.stroke();
      g.fillStyle = '#34353a';
      g.beginPath();
      g.arc(U.x, U.y, U.apron + 2.5, 0, TAU);
      g.fill();
      g.fillStyle = '#b8964e';
      g.beginPath();
      g.arc(U.x, U.y, U.apron + 1.2, 0, TAU);
      g.fill();
      g.fillStyle = '#e9e2d0';
      g.beginPath();
      g.arc(U.x, U.y, U.apron, 0, TAU);
      g.fill();
      g.strokeStyle = '#d8ceb6';
      g.lineWidth = 0.8;
      for (let r = U.r + 6; r < U.apron; r += 5) {
        g.beginPath();
        g.arc(U.x, U.y, r, 0, TAU);
        g.stroke();
      }
      // Promenades: light stone with a darker border and a tile grid.
      for (const s of parkPathSegments()) {
        for (const [color, extra] of [
          ['#b9a988', 6],
          ['#e6dcc4', 0],
        ]) {
          g.strokeStyle = color;
          g.lineWidth = s.w + extra;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(...s.a);
          g.lineTo(...s.b);
          g.stroke();
        }
      }
      g.strokeStyle = '#d3c6a8';
      g.lineWidth = 1;
      for (const s of parkPathSegments()) {
        const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]),
          nx = (s.b[0] - s.a[0]) / len,
          ny = (s.b[1] - s.a[1]) / len;
        for (let d = 0; d < len; d += 12) {
          const x = s.a[0] + nx * d,
            y = s.a[1] + ny * d;
          g.beginPath();
          g.moveTo(x - ny * s.w * 0.45, y + nx * s.w * 0.45);
          g.lineTo(x + ny * s.w * 0.45, y - nx * s.w * 0.45);
          g.stroke();
        }
      }
      // The lagoon bed (the water itself is a mesh) with a stone coping.
      const L = p.lagoon;
      g.fillStyle = '#d9cfb7';
      g.beginPath();
      g.ellipse(L.x, L.y, L.rx + 10, L.ry + 10, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#2d5a66';
      g.beginPath();
      g.ellipse(L.x, L.y, L.rx, L.ry, 0, 0, TAU);
      g.fill();
      // Ride pads and building plots.
      g.fillStyle = '#cfc6b4';
      for (const r of [p.carousel, p.teacups]) {
        g.beginPath();
        g.arc(r.x, r.y, r.r + 10, 0, TAU);
        g.fill();
      }
      g.beginPath();
      g.arc(p.swing.x, p.swing.y, p.swing.reach + 8, 0, TAU);
      g.fill();
      g.fillStyle = '#bfb5a0';
      for (const b of [p.bumper, p.darkRide, p.foodCourt]) g.fillRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
      g.fillRect(p.terminal.x - 10, p.terminal.y - 10, p.terminal.w + 20, p.terminal.h + 20);
      g.fillRect(p.hotel.x - p.hotel.w / 2 - 20, p.hotel.y - p.hotel.d / 2 - 20, p.hotel.w + 40, p.hotel.d + 60);
      g.fillRect(p.station.x - 80, -6468, 170, 130);
      // Flower beds: red and gold ribbons in the lawns by the gate and the lagoon.
      const bed = (x, y, w, h, c) => {
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(x, y, w, h, 0, 0, TAU);
        g.fill();
      };
      for (const [x, y] of [
        [3000, -5990],
        [3400, -5990],
        [2950, -6230],
        [3390, -6230],
        [3050, -6580],
        [3290, -6580],
      ]) {
        bed(x, y, 36, 14, '#5f7f45');
        bed(x, y, 30, 10, '#8f5a4a');
        for (let k = 0; k < 14; k++) bed(x - 26 + k * 4, y + Math.sin(k) * 4, 2.2, 2.2, k % 2 ? '#d8a23a' : '#c05a48');
      }
      // Map labels (the 2D view and the city map).
      g.fillStyle = '#5a4a2c';
      g.font = 'bold 26px monospace';
      g.textAlign = 'center';
      g.fillText('SUNSET PIER', p.gate.x, -5965);
      g.font = 'bold 14px monospace';
      g.fillText('THE FALCON', p.station.x, -6480);
      g.fillText('SUNSET EYE', p.wheel.x, p.wheel.y + 4);
      g.fillText('FOUNTAIN LAGOON', L.x, L.y + 5);
      g.fillText('SUNSET PALACE', p.hotel.x, p.hotel.y + 5);
      g.fillText('BEACH CLUB', p.beachClub.x + p.beachClub.w / 2, p.beachClub.y + 40);
      g.fillText('LOG FLUME', 4100, -6560);
      g.restore();
    }
    function buildSunsetPier() {
      const t = PARK_TILE,
        canvas = document.createElement('canvas');
      canvas.width = Math.round(t.w * t.pixelsPerUnit);
      canvas.height = Math.round(t.h * t.pixelsPerUnit);
      const g = canvas.getContext('2d');
      g.scale(t.pixelsPerUnit, t.pixelsPerUnit);
      g.translate(-t.x, -t.y);
      paintParkIsland(g);
      countyGroundTiles.push({ x: t.x, y: t.y, w: t.w, h: t.h, canvas });
      // The palms are the park's own (themepark3d.js); no generic trees here.
      for (let i = trees.length - 1; i >= 0; i--) if (onSunsetIsle(trees[i].x, trees[i].y)) trees.splice(i, 1);
    }
    /* Palm positions along the promenades and round the lagoon (drawn as instances). */
    let parkPalmList = null;
    function parkPalms() {
      if (parkPalmList) return parkPalmList;
      const list = [],
        L = PIER.lagoon,
        ok = (x, y) =>
          onSunsetIsle(x, y) &&
          !parkBlocked(x, y, 14) &&
          !parkPathNear(x, y, 4) &&
          !inLagoon(x, y, 16) &&
          !parkBuildingAt(x, y, 16) &&
          !coasterNear(x, y, 22) &&
          // UNICORN STATUE: her lawn stays open round the paved ring.
          Math.hypot(x - PIER.unicorn.x, y - PIER.unicorn.y) > PIER.unicorn.apron + 34 &&
          list.every((p) => Math.hypot(p.x - x, p.y - y) > 26);
      const add = (x, y, s) => ok(x, y) && list.push({ x, y, s: s ?? 0.9 + ((x * 7 + y * 13) % 7) / 14 });
      // Twin rows along every promenade.
      for (const s of parkPathSegments()) {
        const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]),
          nx = (s.b[0] - s.a[0]) / len,
          ny = (s.b[1] - s.a[1]) / len;
        for (let d = 20; d < len; d += 46)
          for (const side of [-1, 1]) add(s.a[0] + nx * d - ny * side * (s.w / 2 + 12), s.a[1] + ny * d + nx * side * (s.w / 2 + 12));
      }
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        add(L.x + Math.cos(a) * (L.rx + 88), L.y + Math.sin(a) * (L.ry + 88), 1.15);
      }
      // Groves in the coaster garden and along the shore.
      for (let i = 0; i < 160; i++) {
        const x = 1900 + ((i * 97.3) % 2300),
          y = -7040 + ((i * 61.7) % 1300);
        add(x, y);
      }
      parkPalmList = list;
      return list;
    }
    function coasterNear(x, y, pad) {
      const T = coasterCircuit();
      for (let i = 0; i < T.count; i += 4) if (Math.abs(T.X[i] - x) < pad && Math.abs(T.Y[i] - y) < pad && T.Z[i] < 140) return true;
      return false;
    }
