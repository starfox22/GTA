    function paintMonarchMap(g, big) {
      g.save();
      isleRegionPath(g);
      g.clip();
      g.fillStyle = '#d9cba0';
      g.fillRect(5500, -5400, 4300, 420);
      g.fillStyle = '#9aa596';
      for (const s of ISLE_STREETS) {
        const half = isleReserveHalf(s.at, s.vertical);
        if (s.vertical) g.fillRect(s.at - half, s.from - half, half * 2, s.to - s.from + half * 2);
        else g.fillRect(s.from - half, s.at - half, s.to - s.from + half * 2, half * 2);
      }
      const G = MONARCH_GARDEN;
      g.fillStyle = '#5f8a52';
      g.fillRect(G.x, G.y, G.w, G.h);
      g.fillStyle = '#9fc0c8';
      g.beginPath();
      g.ellipse(G.pond.x, G.pond.y, G.pond.rx, G.pond.ry, 0, 0, TAU);
      g.fill();
      for (const v of monarchPlan.villas) {
        g.fillStyle = '#6f9860';
        g.fillRect(v.villa.lot.x, v.villa.lot.y, v.villa.lot.w, v.villa.lot.h);
        if (v.pool) {
          g.fillStyle = '#5cc1d4';
          g.fillRect(v.pool.x, v.pool.y, v.pool.w, v.pool.h);
        }
      }
      g.restore();
      g.fillStyle = '#c9c2ae';
      for (const f of MONARCH_MARINA.fingers) g.fillRect(f.x, f.y, f.w, f.h);
      for (const b of monarchBerths()) {
        g.fillStyle = b.design.hull;
        g.fillRect(b.x - b.beam / 2, b.y - b.len / 2, b.beam, b.len);
      }
      for (const s of MONARCH_SUPERYACHTS) {
        g.save();
        g.translate(s.x, s.y);
        g.rotate(s.a);
        g.fillStyle = s.hull;
        g.beginPath();
        g.moveTo(-s.len / 2, -s.beam / 2);
        g.lineTo(s.len * 0.25, -s.beam / 2);
        g.quadraticCurveTo(s.len * 0.45, -s.beam * 0.3, s.len / 2, 0);
        g.quadraticCurveTo(s.len * 0.45, s.beam * 0.3, s.len * 0.25, s.beam / 2);
        g.lineTo(-s.len / 2, s.beam / 2);
        g.fill();
        g.restore();
      }
      if (big) {
        g.fillStyle = '#e7d9a8';
        g.font = 'bold 60px monospace';
        g.textAlign = 'center';
        g.fillText('✿', G.x + G.w / 2, G.y + G.h / 2 + 20);
      }
    }
    // Big-map labels (drawMap).
    const MONARCH_MAP_LABELS = [
      // Spread out: at the whole-county zoom the island is ~120 px across.
      ['M O N A R C H  I S L E', 7800, -3200],
      ['CROWN AVENUE', 6600, -2500],
      ['ROYAL BOTANIC GARDEN', 8000, -4200],
      ['MONARCH HARBOUR', 8800, -880],
      ['MONARCH BEACH', 7700, -5130],
      // (Sovereign Sound is named in the HUD only: on the map it is narrower
      // than its name and would run into North Point's labels.)
      ['R E G E N C Y  C H A N N E L', 7600, -250],
    ];
    /* After the city's rooftop pads are chosen: the towers' roofs take a helicopter. */
    function addMonarchHelipads() {
      for (const t of MONARCH_TOWERS) {
        if (!t.helipad || !t.building) continue;
        const b = t.building;
        b.helipad = { x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.min(46, Math.min(b.w, b.h) / 2 - 12) };
        roofHelipads.push({ ...b.helipad, z: b.height, building: b });
      }
    }
    /* The plan as data for the layout audit and DeadEndCity.monarch(). */
    function monarchLayout() {
      return {
        polygon: MONARCH_ISLE.polygon,
        grid: { cols: ISLE_COLS, rows: ISLE_ROWS, block: ISLE_BLOCK, street: ISLE_STREET, walk: ISLE_WALK },
        streets: ISLE_STREETS.map((s) => ({ name: s.name, vertical: s.vertical, at: s.at, from: s.from, to: s.to, divided: !!s.divided })),
        circles: ISLE_CIRCLES,
        villas: monarchPlan.villas.map((p) => ({ name: p.villa.name, style: p.villa.style, lot: p.villa.lot, house: p.house, storeys: p.storeys, pool: p.pool, tennis: p.tennis || null, gate: p.gateAt })),
        towers: MONARCH_TOWERS.map((t) => ({ name: t.name, x: t.x, y: t.y, w: t.w, h: t.h, height: t.building ? t.building.height : 0, metres: Math.round(worldMeters(t.building ? t.building.height + t.crown : 0)) })),
        businesses: monarchPlan.shops.map((s) => ({ name: s.name, trade: s.trade, door: s.door })),
        marina: { basin: MONARCH_MARINA.basin, fingers: MONARCH_MARINA.fingers, berths: monarchBerths().length, superyachts: MONARCH_SUPERYACHTS.map((s) => s.name) },
        garden: { x: MONARCH_GARDEN.x, y: MONARCH_GARDEN.y, w: MONARCH_GARDEN.w, h: MONARCH_GARDEN.h, house: MONARCH_GARDEN.house },
        payphones: MONARCH_PAYPHONES,
        solids: monarchSolidList.length,
        trees: monarchTrees.length,
        lamps: monarchLamps.length,
      };
    }
