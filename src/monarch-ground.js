    // Monarch Isle ground sheet: one painted canvas tile (paintMonarchGround) with junctions, villas, blocks, garden, marina.
    const MONARCH_TILE = { x: 5300, y: -5420, w: 5000, h: 5040, pixelsPerUnit: 0.56 };
    const ISLE_PAINT = {
      lawn: '#6c8e55',
      lawnDark: '#5f8049',
      walk: '#c4bda9',
      walkDark: '#aca591',
      kerb: '#dcd6c4',
      road: '#3d4547',
      lane: '#e2ddcb',
      zebra: '#ece8dc',
      gravel: '#c9bb99',
      stone: '#d6cfbc',
      sand: '#e3d3a6',
      sandWet: '#c9b78c',
      deck: '#9d7f5e',
      court: '#3d6f8e',
      courtClay: '#b8603e',
      pool: '#4bb5c9',
    };
    function paintMonarchTile() {
      const t = MONARCH_TILE,
        canvas = document.createElement('canvas');
      canvas.width = Math.round(t.w * t.pixelsPerUnit);
      canvas.height = Math.round(t.h * t.pixelsPerUnit);
      const g = canvas.getContext('2d');
      g.scale(t.pixelsPerUnit, t.pixelsPerUnit);
      g.translate(-t.x, -t.y);
      paintMonarchGround(g, true);
      countyGroundTiles.push({ x: t.x, y: t.y, w: t.w, h: t.h, canvas });
    }
    function isleRegionPath(g) {
      g.beginPath();
      MONARCH_ISLE.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    }
    function paintMonarchGround(g, detail) {
      const P = ISLE_PAINT,
        fill = (x, y, w, h, c) => {
          g.fillStyle = c;
          g.fillRect(x, y, w, h);
        };
      g.save();
      isleRegionPath(g);
      g.fillStyle = P.lawn;
      g.fill();
      g.clip();
      // Mown stripes across the lawns.
      if (detail) {
        g.globalAlpha = 0.07;
        g.fillStyle = '#eef5d8';
        for (let x = MONARCH_TILE.x; x < MONARCH_TILE.x + MONARCH_TILE.w; x += 28) g.fillRect(x, MONARCH_TILE.y, 14, MONARCH_TILE.h);
        g.globalAlpha = 1;
      }
      // Monarch Beach: dry sand from the villas' gardens down to a damp band at the water.
      g.save();
      g.beginPath();
      g.rect(5500, -5400, 4300, 420);
      g.clip();
      g.fillStyle = P.sand;
      g.fillRect(5500, -5400, 4300, 420);
      isleRegionPath(g);
      g.lineJoin = 'round';
      g.strokeStyle = P.sandWet;
      g.lineWidth = 46;
      g.stroke();
      if (detail) {
        let seed = 17;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 2200; i++) {
          g.fillStyle = i % 3 ? '#efe1b9' : '#c7b58b';
          g.fillRect(5620 + rnd() * 4040, -5260 + rnd() * 280, 2 + (i % 4), 1.2);
        }
      }
      g.restore();
      // The east rocks: dark granite shelves along the cliff foot.
      g.save();
      isleRegionPath(g);
      g.strokeStyle = '#7d7a70';
      g.lineWidth = 60;
      g.stroke();
      g.restore();
      // Pavements: every street's reserve, then the carriageways over them.
      for (const s of ISLE_STREETS) {
        const half = isleReserveHalf(s.at, s.vertical);
        if (s.vertical) fill(s.at - half, s.from - half, half * 2, s.to - s.from + half * 2, P.walk);
        else fill(s.from - half, s.at - half, s.to - s.from + half * 2, half * 2, P.walk);
      }
      // Kew Walk: the garden's pedestrian avenue (paved, lined with cherries).
      fill(8000 - 60, -4544, 120, 800, P.stone);
      for (const c of ISLE_CIRCLES) {
        g.fillStyle = P.walk;
        g.beginPath();
        g.arc(c.x, c.y, c.walk, 0, TAU);
        g.fill();
      }
      // The quay and promenade strip along the marina, and Regency Point.
      fill(7440, -1256, 2460, 60, P.stone);
      // Slab joints on the pavements (the 3D ground shader lays its own
      // limestone ashlar along the kerbs, ground-shader3d.js).
      if (detail && !VECTOR_GROUND_MARKINGS) {
        g.strokeStyle = P.walkDark;
        g.lineWidth = 0.8;
        g.globalAlpha = 0.5;
        for (const s of ISLE_STREETS) {
          const half = isleReserveHalf(s.at, s.vertical),
            kerb = isleKerbHalf(s.at, s.vertical);
          for (const side of [-1, 1])
            for (let v = s.from - half; v < s.to + half; v += 16) {
              g.beginPath();
              if (s.vertical) {
                g.moveTo(s.at + side * kerb, v);
                g.lineTo(s.at + side * half, v);
              } else {
                g.moveTo(v, s.at + side * kerb);
                g.lineTo(v, s.at + side * half);
              }
              g.stroke();
            }
        }
        g.globalAlpha = 1;
      }
      // Carriageways.
      const kerbLine = (x0, y0, x1, y1) => {
        g.strokeStyle = P.kerb;
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      };
      for (const s of ISLE_STREETS) {
        const k = isleKerbHalf(s.at, s.vertical);
        if (s.vertical) fill(s.at - k, s.from - k, k * 2, s.to - s.from + k * 2, P.road);
        else fill(s.from - k, s.at - k, s.to - s.from + k * 2, k * 2, P.road);
      }
      for (const c of ISLE_CIRCLES) {
        g.fillStyle = P.road;
        g.beginPath();
        g.arc(c.x, c.y, c.outer, 0, TAU);
        g.fill();
      }
      // The bridge approaches on land.
      for (const b of MONARCH_BRIDGES) strokeRoad(g, [b.a, b.b], b.width - 22, P.road);
      // Medians: planted strips down the boulevards, broken at every junction.
      for (const s of ISLE_STREETS.filter((s) => s.divided)) {
        const junctions = ISLE_STREETS.filter((o) => o.vertical !== s.vertical && s.at >= o.from - 1 && s.at <= o.to + 1).map((o) => o.at);
        const stops = [s.from, ...junctions, s.to].sort((a, b) => a - b);
        for (let i = 1; i < stops.length; i++) {
          const a = stops[i - 1] + 62,
            b = stops[i] - 62;
          if (b - a < 20) continue;
          for (const [color, pad] of [
            [P.kerb, 0],
            [P.lawnDark, 2.5],
          ]) {
            const w = ISLE_MEDIAN - pad * 2;
            if (s.vertical) fill(s.at - w / 2, a + pad, w, b - a - pad * 2, color);
            else fill(a + pad, s.at - w / 2, b - a - pad * 2, w, color);
          }
        }
      }
      // Kerb lines along every carriageway edge.
      for (const s of ISLE_STREETS) {
        const k = isleKerbHalf(s.at, s.vertical);
        for (const side of [-1, 1]) {
          if (s.vertical) kerbLine(s.at + side * k, s.from - k, s.at + side * k, s.to + k);
          else kerbLine(s.from - k, s.at + side * k, s.to + k, s.at + side * k);
        }
      }
      // Re-open the carriageways across each other's kerb lines at the junctions.
      for (const s of ISLE_STREETS)
        for (const o of ISLE_STREETS) {
          if (!s.vertical || o.vertical) continue;
          if (s.at < o.from - 1 || s.at > o.to + 1 || o.at < s.from - 1 || o.at > s.to + 1) continue;
          const kx = isleKerbHalf(s.at, true),
            ky = isleKerbHalf(o.at, false);
          fill(s.at - kx, o.at - ky, kx * 2, ky * 2, P.road);
        }
      // Roundabouts: the central island (a lawn ring round the fountain's basin), kerb rings.
      for (const c of ISLE_CIRCLES) {
        g.fillStyle = P.road;
        g.beginPath();
        g.arc(c.x, c.y, c.outer, 0, TAU);
        g.fill();
        g.fillStyle = P.kerb;
        g.beginPath();
        g.arc(c.x, c.y, c.island + 3, 0, TAU);
        g.fill();
        g.fillStyle = P.lawnDark;
        g.beginPath();
        g.arc(c.x, c.y, c.island, 0, TAU);
        g.fill();
        g.strokeStyle = P.kerb;
        g.lineWidth = 2.2;
        g.beginPath();
        g.arc(c.x, c.y, c.outer, 0, TAU);
        g.stroke();
        // Give-way lines at each entry and a dashed lane line round the ring.
        g.setLineDash([10, 8]);
        g.strokeStyle = P.lane;
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(c.x, c.y, c.outer - 6, 0, TAU);
        g.stroke();
        g.setLineDash([]);
      }
      // Lane markings: a dashed centre line on the plain streets, edge lines on
      // the boulevards; zebras and stop lines at the junctions. With the 3D
      // renderer the ground shader draws these from data (ground-data3d.js
      // monarchRecords), crisp at any zoom, and the tile leaves them out.
      g.fillStyle = P.lane;
      if (!VECTOR_GROUND_MARKINGS) for (const s of ISLE_STREETS)
        for (const piece of isleCarriageways(s)) {
          const [a, b] = piece.points,
            len = Math.hypot(b[0] - a[0], b[1] - a[1]),
            ux = (b[0] - a[0]) / len,
            uy = (b[1] - a[1]) / len;
          for (let d = 20; d < len - 20; d += 36) {
            const x = a[0] + ux * d,
              y = a[1] + uy * d;
            if (isleJunctionNear(x, y, 26) || isleCircleAt(x, y, -20)) continue;
            if (!s.divided) {
              if (s.vertical) g.fillRect(x - 0.9, y, 1.8, 18);
              else g.fillRect(x, y - 0.9, 18, 1.8);
            }
          }
          if (s.divided) {
            // A solid line along the outer edge of each carriageway.
            for (const side of [-1, 1]) {
              const off = side * (ISLE_CARRIAGEWAY / 2 - 4);
              for (let d = 10; d < len - 10; d += 6) {
                const x = a[0] + ux * d,
                  y = a[1] + uy * d;
                if (isleJunctionNear(x, y, 30) || isleCircleAt(x, y, -20)) continue;
                if (s.vertical) g.fillRect(x + off - 0.8, y, 1.6, 6.2);
                else g.fillRect(x, y + off - 0.8, 6.2, 1.6);
              }
            }
          }
        }
      // Zebra crossings on every arm of every junction, just outside the box.
      if (!VECTOR_GROUND_MARKINGS) for (const j of isleJunctions()) {
        for (const arm of j.arms) {
          const ux = Math.cos(arm.a),
            uy = Math.sin(arm.a),
            reach = arm.box + 14,
            width = arm.width,
            cx = j.x + ux * reach,
            cy = j.y + uy * reach;
          g.save();
          g.translate(cx, cy);
          g.rotate(arm.a);
          g.fillStyle = P.zebra;
          for (let k = -width / 2 + 3; k < width / 2 - 3; k += 7) g.fillRect(-9, k, 18, 4);
          // The stop line on the approach lane (right-hand side, coming in).
          g.fillRect(12, 2, 2.4, width / 2 - 4);
          g.restore();
        }
      }
      // Driveways, terraces, pool decks and courts of the villas.
      for (const v of monarchPlan.villas) paintIsleVillaGround(g, v, P, detail);
      // Blocks' forecourts, gardens and courts.
      for (const b of monarchPlan.blocks) paintIsleBlockGround(g, b, P, detail);
      paintIsleGardenGround(g, P, detail);
      paintIsleMarinaGround(g, P, detail);
      // Beach access paths at Monarch Boulevard and St James Street.
      for (const x of [7200, 8800]) fill(x - 18, -5010, 36, 378, P.deck);
      g.restore();
      // The esplanade along the sea walls and the beach boardwalk (streets.js).
      paintPromenades(g);
      drawBridgeGround(g);
    }
    /* Each grid junction: where two streets meet, with its arms (heading out, the
       box's half size along the arm and the arm's carriageway width). */
    let isleJunctionCache = null;
    function isleJunctions() {
      if (isleJunctionCache) return isleJunctionCache;
      const list = [];
      for (const v of ISLE_STREETS.filter((s) => s.vertical))
        for (const h of ISLE_STREETS.filter((s) => !s.vertical)) {
          if (v.at < h.from - 1 || v.at > h.to + 1 || h.at < v.from - 1 || h.at > v.to + 1) continue;
          if (ISLE_CIRCLES.some((c) => c.x === v.at && c.y === h.at)) continue;
          const arms = [];
          if (h.at > v.from + 1) arms.push({ a: -Math.PI / 2, box: isleKerbHalf(h.at, false), width: isleKerbHalf(v.at, true) * 2 });
          if (h.at < v.to - 1) arms.push({ a: Math.PI / 2, box: isleKerbHalf(h.at, false), width: isleKerbHalf(v.at, true) * 2 });
          if (v.at > h.from + 1) arms.push({ a: Math.PI, box: isleKerbHalf(v.at, true), width: isleKerbHalf(h.at, false) * 2 });
          if (v.at < h.to - 1) arms.push({ a: 0, box: isleKerbHalf(v.at, true), width: isleKerbHalf(h.at, false) * 2 });
          list.push({ x: v.at, y: h.at, v, h, arms });
        }
      return (isleJunctionCache = list);
    }
    function isleJunctionNear(x, y, pad = 0) {
      for (const j of isleJunctions())
        if (Math.abs(x - j.x) < isleKerbHalf(j.x, true) + pad && Math.abs(y - j.y) < isleKerbHalf(j.y, false) + pad) return j;
      return null;
    }
    function paintIsleVillaGround(g, plan, P, detail) {
      const v = plan.villa,
        L = v.lot,
        fill = (r, c) => {
          g.fillStyle = c;
          g.fillRect(r.x, r.y, r.w, r.h);
        };
      // A deeper, mown lawn inside the wall.
      fill({ x: L.x + 4, y: L.y + 4, w: L.w - 8, h: L.h - 8 }, '#648a4f');
      if (detail) {
        g.globalAlpha = 0.1;
        g.fillStyle = '#f2f8dc';
        for (let x = L.x + 8; x < L.x + L.w - 8; x += 20) g.fillRect(x, L.y + 4, 10, L.h - 8);
        g.globalAlpha = 1;
      }
      // The drive: from the gate to the forecourt before the house, gravel or stone.
      const surface = v.style === 'modern' || v.style === 'artdeco' ? '#bfbab0' : P.gravel,
        H = plan.house,
        gate = plan.gateAt;
      g.strokeStyle = surface;
      g.lineWidth = 30;
      g.lineCap = 'round';
      g.beginPath();
      if (plan.gateAxis === 'y') {
        const front = v.gate === 'south' ? H.y + H.h + 36 : H.y - 36;
        g.moveTo(gate.x, gate.y);
        g.lineTo(gate.x, front);
        g.lineTo(H.x + H.w / 2, front);
      } else {
        const front = H.x - 36;
        g.moveTo(gate.x, gate.y);
        g.lineTo(front, gate.y);
        g.lineTo(front, H.y + H.h / 2);
      }
      g.stroke();
      // A turning circle in front of the door.
      g.fillStyle = surface;
      g.beginPath();
      if (plan.gateAxis === 'y') g.arc(H.x + H.w / 2, v.gate === 'south' ? H.y + H.h + 40 : H.y - 40, 40, 0, TAU);
      else g.arc(H.x - 40, H.y + H.h / 2, 40, 0, TAU);
      g.fill();
      fill({ x: plan.garage.x - 6, y: plan.garage.y + plan.garage.h, w: plan.garage.w + 12, h: 40 }, surface);
      // The terrace and the pool deck.
      if (plan.terrace) fill(plan.terrace, P.stone);
      if (plan.pool) {
        const p = plan.pool;
        fill({ x: p.x - 18, y: p.y - 18, w: p.w + 36, h: p.h + 36 }, '#e4dece');
        fill(p, P.pool);
      }
      if (plan.tennis) {
        const t = plan.tennis;
        fill({ x: t.x - 10, y: t.y - 10, w: t.w + 20, h: t.h + 20 }, '#4f7a5f');
        fill(t, v.style === 'mediterranean' || v.style === 'spanish' ? P.courtClay : P.court);
        g.strokeStyle = '#f2f2ec';
        g.lineWidth = 1.2;
        g.strokeRect(t.x + 6, t.y + 6, t.w - 12, t.h - 12);
        g.beginPath();
        g.moveTo(t.x + 6, t.y + t.h / 2);
        g.lineTo(t.x + t.w - 6, t.y + t.h / 2);
        g.moveTo(t.x + t.w / 2, t.y + 40);
        g.lineTo(t.x + t.w / 2, t.y + t.h - 40);
        g.stroke();
      }
    }
    function paintIsleBlockGround(g, plan, P, detail) {
      const B = plan.block,
        fill = (r, c) => r && ((g.fillStyle = c), g.fillRect(r.x, r.y, r.w, r.h));
      // Most blocks: a paved forecourt along the shops, a garden court behind.
      fill({ x: B.x, y: B.y, w: B.w, h: B.h }, '#6a8b52');
      // MONARCH MOTORS' forecourt, lane and bays (dealership.js).
      if (plan.use === 'motors') paintDealershipGround(g, plan, P, detail);
      if (['arcade', 'provisions', 'harbourfront', 'chandlery', 'towerSovereign', 'towerMonarch'].includes(plan.use))
        fill({ x: B.x, y: B.y + B.h - 20, w: B.w, h: 20 }, P.walk);
      if (plan.use === 'towerSovereign' || plan.use === 'towerMonarch') {
        // The tower's plaza: stone paving in a radiating pattern.
        const t = plan.tower,
          cx = t.x + t.w / 2,
          cy = t.y + t.h / 2;
        fill({ x: B.x + 20, y: B.y + 20, w: B.w - 40, h: B.h - 180 }, P.stone);
        if (detail) {
          g.strokeStyle = '#bdb4a0';
          g.lineWidth = 1;
          for (let r = 30; r < 300; r += 22) {
            g.beginPath();
            g.arc(cx, cy, r, 0, TAU);
            g.stroke();
          }
        }
        fill({ x: t.x - 24, y: t.y + t.h, w: t.w + 48, h: 60 }, '#bfb49c');
        for (const l of plan.lawns || []) {
          fill({ x: l.x - 3, y: l.y - 3, w: l.w + 6, h: l.h + 6 }, '#8f8a78');
          fill(l, '#5f9148');
          if (detail) {
            // Mown stripes.
            g.fillStyle = 'rgba(255,255,255,0.05)';
            for (let x = l.x; x < l.x + l.w; x += 24) g.fillRect(x, l.y, 12, l.h);
          }
        }
        if (plan.reflect) {
          const R = plan.reflect;
          fill({ x: R.x - 8, y: R.y - 8, w: R.w + 16, h: R.h + 16 }, '#d8d0bc');
          fill(R, '#2f7a8e');
        }
        if (plan.sculpture) {
          g.fillStyle = '#b8ae98';
          g.beginPath();
          g.arc(plan.sculpture.x, plan.sculpture.y, 26, 0, TAU);
          g.fill();
        }
      }
      if (plan.courts)
        for (const t of plan.courts) {
          fill({ x: t.x - 10, y: t.y - 10, w: t.w + 20, h: t.h + 20 }, '#4f7a5f');
          fill(t, P.courtClay);
          g.strokeStyle = '#f2f2ec';
          g.lineWidth = 1.2;
          g.strokeRect(t.x + 6, t.y + 6, t.w - 12, t.h - 12);
          g.beginPath();
          g.moveTo(t.x + 6, t.y + t.h / 2);
          g.lineTo(t.x + t.w - 6, t.y + t.h / 2);
          g.stroke();
        }
      if (plan.pool) {
        fill({ x: plan.pool.x - 20, y: plan.pool.y - 20, w: plan.pool.w + 40, h: plan.pool.h + 40 }, '#e4dece');
        fill(plan.pool, P.pool);
      }
      if (plan.green) {
        // The putting green: fine, darker turf with a fringe, flags drawn in 3D.
        const G = plan.green;
        g.fillStyle = '#4f8a45';
        g.beginPath();
        g.ellipse(G.x + G.w / 2, G.y + G.h / 2, G.w / 2, G.h / 2, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#5e9a4f';
        g.beginPath();
        g.ellipse(G.x + G.w / 2, G.y + G.h / 2, G.w / 2 - 12, G.h / 2 - 12, 0, 0, TAU);
        g.fill();
        // Bunkers.
        g.fillStyle = '#e4d6ae';
        g.beginPath();
        g.ellipse(G.x + 26, G.y + G.h - 30, 30, 16, 0.3, 0, TAU);
        g.fill();
      }
      if (plan.field) {
        const F = plan.field;
        fill(F, '#5b8d47');
        g.strokeStyle = '#eef2e6';
        g.lineWidth = 1.4;
        g.strokeRect(F.x + 10, F.y + 10, F.w - 20, F.h - 20);
        g.beginPath();
        g.moveTo(F.x + F.w / 2, F.y + 10);
        g.lineTo(F.x + F.w / 2, F.y + F.h - 10);
        g.stroke();
        g.beginPath();
        g.arc(F.x + F.w / 2, F.y + F.h / 2, 26, 0, TAU);
        g.stroke();
      }
      if (plan.canopy) fill({ x: plan.canopy.x - 10, y: plan.canopy.y - 20, w: plan.canopy.w + 20, h: plan.canopy.h + 40 }, '#5b6264');
      if (plan.forecourt) fill({ x: plan.forecourt.x - 10, y: plan.forecourt.y, w: plan.forecourt.w + 20, h: plan.forecourt.h }, '#d8d2c4');
      if (plan.courtyard) {
        fill(plan.courtyard, '#d3c9b2');
        g.fillStyle = '#6c8e55';
        g.fillRect(plan.courtyard.x + 30, plan.courtyard.y + 30, plan.courtyard.w - 60, plan.courtyard.h - 60);
      }
      if (plan.chapel) fill({ x: plan.chapel.x - 40, y: plan.chapel.y + plan.chapel.h, w: plan.chapel.w + 80, h: B.y + B.h - 150 - plan.chapel.y - plan.chapel.h }, '#6f9258');
      if (plan.policeYard) fill(plan.policeYard, '#5b6264');
      // A path to every door from the pavement.
      for (const b of plan.parts) fill({ x: b.x + b.w / 2 - 10, y: b.y + b.h, w: 20, h: Math.max(0, B.y + B.h - b.y - b.h) }, P.walk);
    }
    function paintIsleGardenGround(g, P, detail) {
      const G = MONARCH_GARDEN,
        H = G.house,
        B = G.beds,
        rect = (r, c) => {
          g.fillStyle = c;
          g.fillRect(r.x, r.y, r.w, r.h);
        };
      // Lawns in two greens, mown in stripes.
      g.fillStyle = '#5f8a4a';
      g.fillRect(G.x, G.y, G.w, G.h);
      if (detail) {
        g.globalAlpha = 0.1;
        g.fillStyle = '#eef6d4';
        for (let y = G.y; y < G.y + G.h; y += 24) g.fillRect(G.x, y, G.w, 12);
        g.globalAlpha = 1;
      }
      // Gravel walks: the Broad Walk on the axis, the terrace walk, the north walk
      // and the side walks to the east and west gates.
      g.fillStyle = P.gravel;
      g.fillRect(8000 - 24, H.y + H.d / 2 + 30, 48, G.y + G.h - (H.y + H.d / 2 + 30));
      g.fillRect(8000 - 24, G.y, 48, H.y - H.d / 2 - 30 - G.y);
      g.fillRect(G.x, -4054, G.w, 28);
      g.fillRect(G.x, -4362, G.w, 24);
      g.fillRect(7360, -4362, 24, 300);
      g.fillRect(8616, -4362, 24, 300);
      // The Palm House terrace in York stone.
      g.fillStyle = P.stone;
      g.fillRect(H.x - H.w / 2 - 30, H.y - H.d / 2 - 30, H.w + 60, H.d + 60);
      if (detail) {
        g.strokeStyle = '#c1b8a2';
        g.lineWidth = 1;
        for (let x = H.x - H.w / 2 - 30; x < H.x + H.w / 2 + 30; x += 12) {
          g.beginPath();
          g.moveTo(x, H.y - H.d / 2 - 30);
          g.lineTo(x, H.y + H.d / 2 + 30);
          g.stroke();
        }
      }
      // The lily pond: a stone ring walk, a coping and dark water.
      const pond = G.pond;
      g.fillStyle = P.gravel;
      g.beginPath();
      g.ellipse(pond.x, pond.y, pond.rx + 40, pond.ry + 40, 0, 0, TAU);
      g.fill();
      g.fillStyle = P.stone;
      g.beginPath();
      g.ellipse(pond.x, pond.y, pond.rx + 8, pond.ry + 8, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#23504a';
      g.beginPath();
      g.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, TAU);
      g.fill();
      // Parterres: box-edged beds of bedding colour in a formal pattern.
      for (const bed of [B.parterreWest, B.parterreEast]) {
        rect(bed, '#3f6a3a');
        const cells = 3;
        for (let k = 0; k < cells; k++) {
          const w = (bed.w - 20) / cells,
            x = bed.x + 10 + k * w;
          g.fillStyle = k % 2 ? '#b0506a' : '#d8a23a';
          g.fillRect(x + 6, bed.y + 10, w - 12, bed.h - 20);
          g.fillStyle = '#3f6a3a';
          g.fillRect(x + w / 2 - 3, bed.y + 10, 6, bed.h - 20);
          g.fillRect(x + 6, bed.y + bed.h / 2 - 3, w - 12, 6);
        }
      }
      // The arid bed (sand and gravel), the fern gully (dark leaf litter), the
      // bamboo grove and the Socotra bed (red earth).
      rect(B.arid, '#cbb488');
      rect(B.ferns, '#34502e');
      rect(B.bamboo, '#4a6a38');
      rect(B.socotra, '#a8704a');
      if (detail) {
        let seed = 5;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 260; i++) {
          g.fillStyle = i % 2 ? '#b39a6c' : '#d9c8a0';
          g.fillRect(B.arid.x + rnd() * B.arid.w, B.arid.y + rnd() * B.arid.h, 3, 2);
          g.fillStyle = i % 2 ? '#8e5a3a' : '#bf8a60';
          g.fillRect(B.socotra.x + rnd() * B.socotra.w, B.socotra.y + rnd() * B.socotra.h, 3, 2);
        }
      }
    }
    function paintIsleMarinaGround(g, P, detail) {
      const m = MONARCH_MARINA;
      // The mole's walk: stone flags on top of the armour.
      g.fillStyle = P.stone;
      g.fillRect(m.mole.x0, m.mole.y - m.mole.half, m.mole.x1 - m.mole.x0, m.mole.half * 2);
      // Regency Point: the club's terrace and the harbour master's apron.
      g.fillStyle = P.deck;
      g.fillRect(m.club.x - 10, m.club.y + m.club.h, m.club.w + 20, 70);
      g.fillStyle = P.stone;
      g.beginPath();
      g.arc(m.harbourMaster.x, m.harbourMaster.y, m.harbourMaster.r + 26, 0, TAU);
      g.fill();
      // The east quay car park.
      g.fillStyle = '#50585a';
      g.fillRect(9700, -1190, 190, 330);
      if (detail) {
        g.fillStyle = '#d6d3c4';
        for (let y = -1180; y < -870; y += 24) {
          g.fillRect(9706, y, 60, 1.6);
          g.fillRect(9824, y, 60, 1.6);
        }
      }
    }
