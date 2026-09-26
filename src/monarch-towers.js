    const MONARCH_TOWERS = [
      { id: 'sovereign', name: 'THE SOVEREIGN', block: [2, 1], x: 7596, y: -3420, w: 116, h: 116, storeys: 57, floor: 3.3 * UNITS_PER_METRE, crown: 64, helipad: false },
      { id: 'monarch-one', name: 'MONARCH ONE', block: [2, 2], x: 7606, y: -2580, w: 150, h: 150, storeys: 48, floor: 3.35 * UNITS_PER_METRE, crown: 40, helipad: true },
    ];
    /**
     * BUSINESSES: every trade the island needs, each with its own sign
     * (SIGN_DESIGNS entries in monarch3d.js). `block` and `slot` place the unit
     * in a block's street frontage (south face, west to east); `door` is filled in.
     */
    const MONARCH_BUSINESSES = [
      // Crown Arcade, block (1, 1), on Crown Avenue.
      { name: 'MAISON VERAUD', trade: 'fashion', block: [1, 1], slot: 0, width: 116, color: '#1c1c1e' },
      { name: 'HALDEN & FROST', trade: 'jewellery', block: [1, 1], slot: 1, width: 104, color: '#0f3b36' },
      { name: 'VALMONT', trade: 'watches', block: [1, 1], slot: 2, width: 96, color: '#16233b' },
      { name: 'SAVILLE & CROWN', trade: 'tailor', block: [1, 1], slot: 3, width: 110, color: '#2a1f1a' },
      { name: 'FLEUR DE LYS', trade: 'florist', block: [1, 1], slot: 4, width: 84, color: '#355a3a' },
      // The Sovereign's podium, block (2, 1).
      { name: 'CROWN PRIVATE BANK', trade: 'bank', block: [2, 2], slot: 0, width: 150, color: '#10202e' },
      { name: 'AURELIE PARIS', trade: 'fashion', block: [2, 1], slot: 0, width: 120, color: '#e8e2d6' },
      { name: 'ORO & PERLA', trade: 'jewellery', block: [2, 1], slot: 1, width: 110, color: '#3a1f28' },
      // Block (3, 1): food and wine.
      { name: 'THE PROVISIONER', trade: 'grocer', block: [3, 1], slot: 0, width: 190, color: '#1f3d2c' },
      { name: 'CAFÉ ROYALE', trade: 'cafe', block: [3, 1], slot: 1, width: 96, color: '#3b2419' },
      { name: 'VINTAGE & VINE', trade: 'wine', block: [3, 1], slot: 2, width: 104, color: '#4a1420' },
      { name: 'GALERIE MONARCH', trade: 'gallery', block: [3, 1], slot: 3, width: 116, color: '#f2f0ea' },
      // Block (4, 1): health.
      { name: 'THE HALCYON CLINIC', trade: 'clinic', block: [4, 1], slot: 0, width: 300, color: '#0f4f4a' },
      { name: 'AQUA SERENA SPA', trade: 'spa', block: [4, 1], slot: 1, width: 240, color: '#1f5f63' },
      // Block (3, 2), on Regent Row: dining.
      { name: 'L’ÉTOILE', trade: 'restaurant', block: [3, 2], slot: 0, width: 220, color: '#0c0c10' },
      { name: 'THE REGENT HOTEL', trade: 'hotel', block: [3, 2], slot: 1, width: 280, color: '#1b2638' },
      // Block (0, 2) is MONARCH MOTORS, the Prestige Collection's flagship (dealership.js).
      // The marina front, blocks (2, 3) and (3, 3), on Marina Drive.
      { name: 'THE OYSTER ROOM', trade: 'seafood', block: [2, 3], slot: 0, width: 150, color: '#12324a' },
      { name: 'GELATERIA DOLCE', trade: 'gelato', block: [2, 3], slot: 1, width: 92, color: '#f4d9e0' },
      { name: 'OCEANIS YACHTS', trade: 'brokerage', block: [2, 3], slot: 2, width: 130, color: '#0e2c57' },
      { name: 'MARINE CHANDLERY', trade: 'chandlery', block: [3, 3], slot: 0, width: 130, color: '#1d3f6e' },
      { name: 'CHAMPAGNE BAR', trade: 'bar', block: [3, 3], slot: 1, width: 110, color: '#1a1a1a' },
      { name: 'BOUTIQUE RIVA', trade: 'fashion', block: [3, 3], slot: 2, width: 110, color: '#f3efe6' },
      // Civic.
      { name: 'MONARCH ACADEMY', trade: 'school', block: [1, 2], slot: 0, width: 300, color: '#1d3a2a' },
      { name: 'POLICE · MONARCH ISLE', trade: 'police', block: [4, 3], slot: 0, width: 150, color: '#0e2244' },
      { name: 'MONARCH COUNTRY CLUB', trade: 'club', block: [0, 1], slot: 0, width: 300, color: '#1f3d2c' },
    ];
    const MONARCH_PAYPHONES = [
      { x: 7064, y: -3066, a: 0, name: 'CROWN AVENUE' },
      { x: 8540, y: -1250, a: 0, name: 'MARINA PROMENADE' },
    ];
    /**
     * BUILD: the parcels' buildings and solids, the street trees and the
     * painted ground sheet. Called from buildWorld() after the county.
     */
    const monarchSolidList = [],
      // Foot-only obstacles (planters, fountains' rims people stop at): circles.
      monarchFootList = [],
      monarchTrees = [],
      monarchLamps = [],
      monarchPlan = { villas: [], blocks: [], shops: [], built: false };
    /* A tower's plaza: the paving round the tower is kept to a forecourt and
       walks; the rest is lawn in the corners (planted with plane trees round
       its edge, planIsleStreetscape), a long reflecting pool with a line of jets
       in the widest lawn and a bronze sculpture on the next. */
    function planIslePlaza(plan) {
      const B = plan.block,
        t = plan.tower,
        P = { x: B.x + 20, y: B.y + 20, w: B.w - 40, h: B.h - 180 },
        gap = 44,
        sections = [
          { x: P.x, y: P.y, w: t.x - gap - P.x, h: P.h },
          { x: t.x + t.w + gap, y: P.y, w: P.x + P.w - (t.x + t.w + gap), h: P.h },
          { x: t.x - gap, y: P.y, w: t.w + gap * 2, h: t.y - gap - P.y },
        ]
          .filter((r) => r.w > 110 && r.h > 110)
          // A walk 24 wide round each lawn.
          .map((r) => ({ x: r.x + 24, y: r.y + 24, w: r.w - 48, h: r.h - 48 }))
          .sort((a, b) => b.w * b.h - a.w * a.h);
      plan.lawns = sections;
      const L = sections[0];
      if (L) {
        const pw = Math.min(90, L.w * 0.42),
          ph = Math.min(L.h * 0.62, 320);
        plan.reflect = { x: L.x + (L.w - pw) / 2, y: L.y + (L.h - ph) / 2, w: pw, h: ph };
        isleSolid(plan.reflect.x, plan.reflect.y, plan.reflect.w, plan.reflect.h, 2, 'pool');
      }
      const S = sections[1];
      if (S) {
        plan.sculpture = { x: S.x + S.w / 2, y: S.y + S.h / 2, kind: t.id === 'sovereign' ? 'rings' : 'arc' };
        isleSolid(plan.sculpture.x - 14, plan.sculpture.y - 14, 28, 28, 40, 'sculpture');
      }
    }
    function isleSolid(x, y, w, h, height, kind) {
      const s = { x, y, w, h, height, kind };
      monarchSolidList.push(s);
      return s;
    }
    function isleBuilding(x, y, w, h, height, extra = {}) {
      const b = { x, y, w, h, style: 0, tropical: false, height, monarch: true, archetype: 'stucco', ...extra };
      buildings.push(b);
      return b;
    }
    /* A wall round a lot with a gap for the gate: four thin solids (two on the gate side). */
    function isleLotWall(lot, gateAt, gateAxis, gateWidth, height = 8, thickness = 4, kind = 'garden wall') {
      const L = lot,
        pieces = [];
      const add = (x, y, w, h) => w > 1 && h > 1 && pieces.push(isleSolid(x, y, w, h, height, kind));
      // North and south sides (along x), east and west (along y).
      for (const [side, y] of [
        ['north', L.y],
        ['south', L.y + L.h - thickness],
      ]) {
        if (gateAxis === 'y' && Math.abs(gateAt.y - (side === 'north' ? L.y : L.y + L.h)) < 2) {
          add(L.x, y, gateAt.x - gateWidth / 2 - L.x, thickness);
          add(gateAt.x + gateWidth / 2, y, L.x + L.w - gateAt.x - gateWidth / 2, thickness);
        } else add(L.x, y, L.w, thickness);
      }
      for (const [side, x] of [
        ['west', L.x],
        ['east', L.x + L.w - thickness],
      ]) {
        if (gateAxis === 'x' && Math.abs(gateAt.x - (side === 'west' ? L.x : L.x + L.w)) < 2) {
          add(x, L.y, thickness, gateAt.y - gateWidth / 2 - L.y);
          add(x, gateAt.y + gateWidth / 2, thickness, L.y + L.h - gateAt.y - gateWidth / 2);
        } else add(x, L.y, thickness, L.h);
      }
      return pieces;
    }
    function buildMonarchIsle() {
      if (monarchPlan.built) return;
      monarchPlan.built = true;
      const random = isleRandomSource(20260925);
      // ---- Villas ----
      for (const v of MONARCH_VILLAS) {
        const plan = planVilla(v, random);
        monarchPlan.villas.push(plan);
        plan.buildings = [
          isleBuilding(plan.house.x, plan.house.y, plan.house.w, plan.house.h, plan.height, { style: v.style === 'modern' ? 0 : 2, villa: v.id, archetype: 'stucco' }),
          ...plan.wings.map((w) => isleBuilding(w.x, w.y, w.w, w.h, w.height, { style: 2, villa: v.id })),
          isleBuilding(plan.garage.x, plan.garage.y, plan.garage.w, plan.garage.h, plan.garage.height, { style: 2, villa: v.id }),
        ];
        plan.walls = isleLotWall(v.lot, plan.gateAt, plan.gateAxis, plan.gateWidth, v.style === 'modern' ? 7 : 9);
        if (plan.pool) isleSolid(plan.pool.x, plan.pool.y, plan.pool.w, plan.pool.h, 2, 'pool');
        if (plan.tennis) {
          const t = plan.tennis;
          // The court's fence (chain-link on four sides, a door in the south side).
          isleSolid(t.x - 6, t.y - 6, t.w + 12, 2, 14, 'fence');
          isleSolid(t.x - 6, t.y + t.h + 4, t.w / 2 - 10, 2, 14, 'fence');
          isleSolid(t.x + t.w / 2 + 16, t.y + t.h + 4, t.w / 2 - 10, 2, 14, 'fence');
          isleSolid(t.x - 6, t.y - 6, 2, t.h + 12, 14, 'fence');
          isleSolid(t.x + t.w + 4, t.y - 6, 2, t.h + 12, 14, 'fence');
        }
      }
      // ---- The towers ----
      for (const t of MONARCH_TOWERS)
        t.building = isleBuilding(t.x, t.y, t.w, t.h, Math.round(t.storeys * t.floor), { style: 0, tower: t.id, archetype: 'tower', monarchTower: t });
      // ---- Blocks ----
      for (const [key, use] of Object.entries(ISLE_BLOCK_USES)) {
        const [i, j] = key.split(',').map(Number),
          block = isleBlock(i, j),
          plan = { key, use, block, parts: [] };
        monarchPlan.blocks.push(plan);
        planIsleBlock(plan, random);
      }
      // ---- Marina buildings ----
      const m = MONARCH_MARINA;
      m.clubBuilding = isleBuilding(m.club.x, m.club.y, m.club.w, m.club.h, isleFloors(2), { style: 2, marina: 'club', facade: 'clubhouse', front: 'south' });
      isleSolid(m.harbourMaster.x - m.harbourMaster.r, m.harbourMaster.y - m.harbourMaster.r, m.harbourMaster.r * 2, m.harbourMaster.r * 2, 150, 'harbour master');
      isleSolid(m.lighthouse.x - m.lighthouse.r, m.lighthouse.y - m.lighthouse.r, m.lighthouse.r * 2, m.lighthouse.r * 2, 150, 'lighthouse');
      // The mole's low parapets: both edges of its walk.
      isleSolid(m.mole.x0, m.mole.y - m.mole.half - 2, m.mole.x1 - m.mole.x0, 4, 8, 'mole parapet');
      isleSolid(m.mole.x0 + 70, m.mole.y + m.mole.half - 2, m.mole.x1 - m.mole.x0 - 70, 4, 8, 'mole parapet');
      // ---- The garden's Palm House (walk round it) ----
      const H = MONARCH_GARDEN.house;
      MONARCH_GARDEN.building = isleBuilding(H.x - H.w / 2, H.y - H.d / 2, H.w, H.d, 19 * UNITS_PER_METRE, { style: 2, garden: true, archetype: 'glasshouse' });
      planIsleGardenFence();
      isleSolid(MONARCH_GARDEN.pond.x - MONARCH_GARDEN.pond.rx, MONARCH_GARDEN.pond.y - MONARCH_GARDEN.pond.ry, MONARCH_GARDEN.pond.rx * 2, MONARCH_GARDEN.pond.ry * 2, 2, 'lily pond');
      // ---- Roundabout fountains ----
      for (const c of ISLE_CIRCLES) {
        const r = c.island - 6;
        isleSolid(c.x - r, c.y - r, r * 2, r * 2, 12, 'fountain');
      }
      for (const p of MONARCH_PAYPHONES) isleSolid(p.x - 4, p.y - 3, 8, 6, 2.4 * UNITS_PER_METRE, 'payphone');
      planIsleStreetscape(random);
      registerMonarchPlaces();
      paintMonarchTile();
    }
    /**
     * A handful of the island's businesses open their doors to the player
     * (PLACES, citylife.js openService): a fashion house (a change of clothes
     * while the heat is on), a café, a champagne bar, a hotel room and the
     * private clinic. They carry `monarch` so civic3d.js leaves their fronts to
     * monarch3d.js. Bike-share stations (cycles.js) at the payphones, the
     * marina, the garden gate and the bridge heads.
     */
    const MONARCH_PLACE_KINDS = {
      'MAISON VERAUD': ['clothes', 'monarch-couture', '#e7d7b0', 'TEE'],
      'CAFÉ ROYALE': ['diner', 'monarch-cafe', '#e8c9a0', 'EAT'],
      'CHAMPAGNE BAR': ['bar', 'monarch-bar', '#f2d98a', 'BAR'],
      'THE REGENT HOTEL': ['sleep', 'monarch-hotel', '#d9c7a0', 'BED'],
      'THE HALCYON CLINIC': ['hospital', 'monarch-clinic', '#bfe0da', '+'],
    };
    function registerMonarchPlaces() {
      for (const shop of monarchPlan.shops) {
        const kind = MONARCH_PLACE_KINDS[shop.name];
        if (!kind || !shop.building || !shop.door) continue;
        const b = shop.building;
        // The first hospital in PLACES is where the player wakes up: keep Saint Marlow first.
        PLACES.push({ id: kind[1], kind: kind[0], name: shop.name, bx: null, by: null, x: b.x, y: b.y, w: b.w, h: b.h, height: b.height, color: kind[2], symbol: kind[3], door: { x: shop.door.x, y: shop.door.y }, monarch: true });
        b.place = kind[1];
      }
      for (const p of MONARCH_PAYPHONES) addBikeShareAnchor({ x: p.x + 60, y: p.y + 30, label: p.name });
      addBikeShareAnchor({ x: 8420, y: -1290, label: 'MONARCH HARBOUR' });
      addBikeShareAnchor({ x: 8110, y: -3700, label: 'BOTANIC GARDEN' });
      addBikeShareAnchor({ x: 5760, y: -2874, label: 'SOVEREIGN BRIDGE' });
    }
    /* The garden's iron railing round all four sides, broken at the gates, where
       bollards 12 units apart let people through and keep cars out. */
    function planIsleGardenFence() {
      const G = MONARCH_GARDEN,
        sides = [
          { axis: 'y', at: G.y, from: G.x, to: G.x + G.w },
          { axis: 'y', at: G.y + G.h, from: G.x, to: G.x + G.w },
          { axis: 'x', at: G.x, from: G.y, to: G.y + G.h },
          { axis: 'x', at: G.x + G.w, from: G.y, to: G.y + G.h },
        ];
      G.fence = [];
      for (const side of sides) {
        let pieces = [[side.from, side.to]];
        for (const gate of G.gates) {
          if (gate.axis !== side.axis || Math.abs((side.axis === 'y' ? gate.y : gate.x) - side.at) > 2) continue;
          const c = side.axis === 'y' ? gate.x : gate.y;
          pieces = pieces.flatMap(([a, b]) => [[a, Math.min(b, c - gate.width / 2)], [Math.max(a, c + gate.width / 2), b]].filter(([p, q]) => q - p > 1));
        }
        for (const [a, b] of pieces) {
          const piece = side.axis === 'y' ? isleSolid(a, side.at - 1.5, b - a, 3, 12, 'garden railing') : isleSolid(side.at - 1.5, a, 3, b - a, 12, 'garden railing');
          G.fence.push(piece);
        }
      }
      G.bollards = [];
      for (const gate of G.gates)
        for (let d = -gate.width / 2 + 8; d <= gate.width / 2 - 8; d += 13) {
          const x = gate.axis === 'y' ? gate.x + d : gate.x,
            y = gate.axis === 'y' ? gate.y : gate.y + d;
          G.bollards.push({ x, y });
          isleSolid(x - 1.5, y - 1.5, 3, 3, 8, 'bollard');
        }
    }
