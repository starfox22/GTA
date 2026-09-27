    // Monarch Isle's MONARCH ONE estate: the supertall's gated grounds, porte-cochère, pool deck, private cove, gate arm, staff and ground paint (MONARCH_ONE).
    /**
     * MONARCH ONE
     * The island's one skyscraper (MONARCH_TOWERS) stands on the north-east
     * point with open sea to the north and east: the camera looks north, so a
     * tower hides whatever stands north of it, and here that is only rocks and
     * water. Its grounds run from Ocean Crescent's north pavement to the sea,
     * walled on the west (the wall runs out along the groyne's crest, so the
     * public beach cannot be walked into the cove) and the south:
     *   gate        on Lighthouse Road's axis at the top-right junction: stone
     *               piers, a carriage gate with a barrier arm (vehicles only;
     *               it lifts for the player's car coming at a crawl, never for
     *               traffic, which has no lane in), a pedestrian gate and the
     *               security gatehouse; the guard greets drivers and politely
     *               turns strangers on foot away (he never stops them).
     *   drive       granite setts from the gate to a turning circle under the
     *               porte-cochère (a cantilevered canopy on the tower's south
     *               face, overhead cover) with a fountain in the middle, and the
     *               residents' bays along the south wall.
     *   pool deck   travertine west of the tower: a long infinity pool looking
     *               north over the cove, loungers, parasols and the pool bar.
     *   cove        stone steps down to a crescent of private sand between the
     *               groyne and the point: loungers, cabanas, a teak jetty
     *               (MONARCH_ONE_JETTY, walkable) with the residents' tender.
     *   lawns       a formal garden west of the drive, a tennis court east of
     *               the turning circle.
     * Colliders are isleSolid()s (walls, piers, gatehouse, columns, pool,
     * cabanas, fences) plus the arm, which only vehicles meet
     * (monarchSolids(); its body's minHeight lifts it out of reach while up).
     */
    const MONARCH_ONE = {
      name: 'MONARCH ONE',
      // Everything inside the boundary (the sea closes the north and east sides).
      grounds: { x: 9296, y: -5330, w: 820, h: 694 },
      wall: { x: 9296, y: -4640, thickness: 4, height: 14, groyneTip: -5316, east: 10104 },
      gate: { x: 9600, y: -4636, half: 30, pier: 10, foot: { x: 9550, half: 10 }, armY: -4652, open: 0, want: false, greetedAt: -100 },
      gatehouse: { x: 9646, y: -4688, w: 36, h: 40 },
      canopy: { x: 9682, y: -4900, w: 156, h: 80, height: 7 * UNITS_PER_METRE },
      loop: { x: 9760, y: -4786, r: 60, lane: 22, island: 24 },
      drive: [
        [9600, -4636],
        [9600, -4720],
        [9618, -4760],
        [9656, -4782],
        [9700, -4786],
      ],
      bays: { x: 9700, y: -4690, w: 200, h: 44, count: 5 },
      deck: { x: 9322, y: -5048, w: 330, h: 138 },
      pool: { x: 9376, y: -5020, w: 236, h: 38 },
      poolBar: { x: 9328, y: -5040, w: 36, h: 56 },
      steps: { x: 9480, w: 44 },
      lawn: { x: 9312, y: -4898, w: 216, h: 246 },
      walk: { x: 9538, w: 24 },
      cove: { x: 9352, y: -5210, w: 360, h: 162 },
      cabanas: [9376, 9420, 9612, 9656].map((x) => ({ x: x - 10, y: -5078, w: 20, h: 20 })),
      court: { x: 9934, y: -4872, w: 110, h: 200 },
      tender: { x: 9540, y: -5268, a: -Math.PI / 2 },
    };
    MONARCH_ONE.tower = MONARCH_TOWERS.find((t) => t.id === 'monarch-one');
    MONARCH_ONE.jetty = MONARCH_ONE_JETTY;
    // The barrier arm: a vehicle-only collider (monarchSolids), 1.2 m high.
    MONARCH_ONE.arm = { x: MONARCH_ONE.gate.x - MONARCH_ONE.gate.half + 2, y: MONARCH_ONE.gate.armY - 1.5, w: MONARCH_ONE.gate.half * 2 - 4, h: 3, height: 10, kind: 'barrier arm' };
    function inMonarchOne(x, y, margin = 0) {
      const G = MONARCH_ONE.grounds;
      return x > MONARCH_ONE.wall.x - margin && y < MONARCH_ONE.wall.y + margin && x < G.x + G.w + margin && y > G.y - margin;
    }
    /* The plan's colliders, trees and cover: called from buildMonarchIsle(). */
    function planMonarchOne(random) {
      const M = MONARCH_ONE,
        W = M.wall,
        g = M.gate,
        t = W.thickness;
      // The west wall, out along the groyne to the sea; the south wall either side
      // of the gates, to the rocks.
      M.walls = [isleSolid(W.x, W.groyneTip, t, W.y + t - W.groyneTip, W.height, 'estate wall')];
      const footX0 = g.foot.x - g.foot.half,
        footX1 = g.foot.x + g.foot.half,
        carX0 = g.x - g.half,
        carX1 = g.x + g.half;
      M.walls.push(isleSolid(W.x, W.y, footX0 - g.pier - W.x, t, W.height, 'estate wall'));
      M.walls.push(isleSolid(carX1 + g.pier, W.y, W.east - carX1 - g.pier, t, W.height, 'estate wall'));
      // Gate piers: either side of the pedestrian gate and the carriage gate.
      M.piers = [footX0 - g.pier, footX1, carX1].map((x) => isleSolid(x, W.y - 4, g.pier, 12, 36, 'gate pier'));
      const H = M.gatehouse;
      isleSolid(H.x, H.y, H.w, H.h, 3.6 * UNITS_PER_METRE, 'gatehouse');
      // The porte-cochère: two slim columns at its outer corners, and its roof is cover.
      const C = M.canopy;
      M.columns = [C.x + 8, C.x + C.w - 8].map((x) => ({ x, y: C.y + C.h - 6 }));
      for (const c of M.columns) isleSolid(c.x - 3, c.y - 3, 6, 6, C.height, 'canopy column');
      registerOverheadCover(C.x + C.w / 2, C.y + C.h / 2, C.w / 2, C.h / 2, 0, C.height - 2, C.height + 2, 'porte-cochere');
      // The turning circle's fountain.
      const L = M.loop;
      isleSolid(L.x - L.island + 4, L.y - L.island + 4, (L.island - 4) * 2, (L.island - 4) * 2, 10, 'fountain');
      // The pool, the bar, the deck's glass balustrade (broken at the cove steps), the cabanas.
      const P = M.pool,
        D = M.deck;
      isleSolid(P.x, P.y, P.w, P.h, 2, 'pool');
      isleSolid(M.poolBar.x, M.poolBar.y, M.poolBar.w, M.poolBar.h, 10, 'pool bar');
      isleSolid(D.x, D.y - 1, M.steps.x - D.x, 2, 8, 'balustrade');
      isleSolid(M.steps.x + M.steps.w, D.y - 1, D.x + D.w - M.steps.x - M.steps.w, 2, 8, 'balustrade');
      for (const c of M.cabanas) isleSolid(c.x, c.y, c.w, c.h, 22, 'cabana');
      // The tennis court's chain-link (a door in the west side, off the turning circle).
      const T = M.court;
      isleSolid(T.x - 6, T.y - 6, T.w + 12, 2, 14, 'fence');
      isleSolid(T.x - 6, T.y + T.h + 4, T.w + 12, 2, 14, 'fence');
      isleSolid(T.x + T.w + 4, T.y - 6, 2, T.h + 12, 14, 'fence');
      isleSolid(T.x - 6, T.y - 6, 2, T.h / 2 - 10, 14, 'fence');
      isleSolid(T.x - 6, T.y + T.h / 2 + 16, 2, T.h / 2 - 10, 14, 'fence');
      // Planting: royal palms at the drive's head, plane trees down the residents'
      // walk, palms round the deck and on the point, cypresses along the west
      // wall; cypresses and planes on the clifftop outside the south wall.
      const plant = (x, y, r, kind) => {
        if (!landAt(x, y) || monarchSolidList.some((b) => x > b.x - 8 && x < b.x + b.w + 8 && y > b.y - 8 && y < b.y + b.h + 8)) return;
        const tree = { x, y, r, isle: kind, tropical: kind === 'palm', county: true, pine: kind === 'cypress' };
        monarchTrees.push(tree);
        trees.push(tree);
      };
      for (let y = -4690; y >= -4730; y -= 40) for (const x of [9570, 9630]) plant(x, y, 16, 'palm');
      for (let y = -4676; y > -4890; y -= 44) plant(M.walk.x - 14, y, 12, 'plane');
      for (let y = -4700; y > -4890; y -= 40) plant(W.x + 16, y, 9, 'cypress');
      for (const x of [9336, 9636]) plant(x, -4926, 16, 'palm');
      for (const [x, y] of [
        [9760, -5140],
        [9860, -5150],
        [9940, -5080],
        [9990, -4990],
        [9900, -4960],
        [9880, -5090],
      ])
        plant(x, y, 17, 'palm');
      for (let x = 9730; x <= 10060; x += 70)
        for (let y = -4600; y <= -4460; y += 70)
          if (random() < 0.7) plant(x + (random() - 0.5) * 24, y + (random() - 0.5) * 24, random() < 0.5 ? 9 : 16, random() < 0.5 ? 'cypress' : 'plane');
    }
    /* Vehicles only: the arm while it is down (physics-shapes.js takes monarchSolids()). */
    let monarchOneArmBody = null,
      monarchOneArmVersion = -1;
    function monarchOneArmBodyNow() {
      if (monarchOneArmVersion !== staticGridVersion) {
        monarchOneArmVersion = staticGridVersion;
        monarchOneArmBody = staticBodies.find((b) => b.kind === 'isle barrier arm') || null;
      }
      return monarchOneArmBody;
    }
    /* The gate each frame: the arm lifts for the player's car rolling up at a
       crawl (either way through), stays up while anything is under it, and the
       guard says good evening. */
    function updateMonarchOneGate(deltaSeconds) {
      const g = MONARCH_ONE.gate,
        c = player.car;
      let want = false;
      if (c && !isBoat(c) && !isAircraft(c) && (c.altitude || 0) < 20) {
        const dx = Math.abs(c.x - g.x),
          dy = c.y - g.armY;
        // A crawl raises it; once up it stays up until the car has gone through.
        if (dx < 70 && dy > -140 && dy < 150 && (Math.abs(c.speed) < 30 * KMH || g.open > 0.5)) want = true;
      }
      if (!want && g.open > 0) for (const v of vehicles) if (v.hp > 0 && Math.abs(v.x - g.x) < g.half + 10 && Math.abs(v.y - g.armY) < 30) want = true;
      if (want && !g.want && gameTime - g.greetedAt > 20) {
        g.greetedAt = gameTime;
        const guard = pedestrians.find((p) => p.isle?.post?.id === 'monarch-one-gate' && p.hp > 0);
        if (guard) {
          guard.speech = randomChoice(ISLE_LINES.monarchOneDriver);
          guard.speechUntil = gameTime + 3;
        }
      }
      g.want = want;
      g.open = clamp(g.open + (want ? deltaSeconds / 1.4 : -deltaSeconds / 2.2), 0, 1);
      const body = monarchOneArmBodyNow();
      if (body) body.minHeight = g.open > 0.55 ? 1e9 : undefined;
    }
    /* Staff: the gate's security guard, two doormen and a valet under the
       canopy, the beach attendant by the jetty (monarch-life-crowd.js spawns them). */
    function monarchOneStaffPosts() {
      const M = MONARCH_ONE,
        C = M.canopy,
        cx = C.x + C.w / 2;
      return [
        { id: 'monarch-one-gate', x: M.gatehouse.x - 6, y: M.gate.y - 28, a: Math.PI / 2, role: 'guard', lines: 'monarchOneGate' },
        { x: cx - 16, y: C.y + 8, a: Math.PI / 2, role: 'doorman', lines: 'monarchOneDoor' },
        { x: cx + 16, y: C.y + 8, a: Math.PI / 2, role: 'doorman', lines: 'monarchOneDoor' },
        { x: C.x + 20, y: C.y + C.h - 4, a: Math.PI / 2, role: 'valet', lines: 'monarchOneDoor' },
        { x: M.jetty.x - 18, y: M.jetty.y + M.jetty.h + 10, a: -Math.PI / 2, role: 'valet', lines: 'monarchOneBeach', attire: 'white' },
      ];
    }
    /* Parked: the residents' cars in their bays and the tender at the jetty. */
    function populateMonarchOne(park) {
      const B = MONARCH_ONE.bays,
        cars = [
          ['supercar', '#101214'],
          ['limousine', '#1c2a44'],
          ['luxury', '#f2f2ee'],
          ['roadster', '#8a1c24'],
          ['suv', '#2a2d33'],
        ];
      for (let k = 0; k < B.count; k++) park(cars[k][0], B.x + (k + 0.5) * (B.w / B.count), B.y + B.h / 2, -Math.PI / 2, cars[k][1]);
      const T = MONARCH_ONE.tender;
      if (boatFits({ type: 'speedboat', x: T.x, y: T.y, a: T.a })) MONARCH_ONE.tenderBoat = makeCar('speedboat', T.x, T.y, T.a, false, '#f4f4f0');
    }
    /* THE GROUND: lawn, the drive in granite setts, the turning circle, the
       deck, the pool, the cove's sand, the court (paintMonarchGround). */
    function paintMonarchOneGround(g, P, detail) {
      const M = MONARCH_ONE,
        fill = (r, c) => {
          g.fillStyle = c;
          g.fillRect(r.x, r.y, r.w, r.h);
        },
        setts = '#b8b1a2';
      // A deeper, mown lawn inside the walls (over the beach sand north of the old villas).
      g.save();
      isleRegionPath(g);
      g.clip();
      g.fillStyle = '#5f8a4a';
      g.fillRect(M.wall.x, -5400, 900, M.wall.y + 4 + 5400);
      if (detail) {
        g.globalAlpha = 0.1;
        g.fillStyle = '#f2f8dc';
        for (let x = M.wall.x + 8; x < M.wall.x + 900; x += 20) g.fillRect(x, -5400, 10, M.wall.y + 5400);
        g.globalAlpha = 1;
      }
      // The cove: dry sand from the deck down to a damp band at the water.
      g.save();
      g.beginPath();
      g.rect(M.cove.x - 20, M.cove.y - 140, M.cove.w + 40, M.cove.h + 140);
      g.clip();
      g.fillStyle = P.sand;
      g.fillRect(M.cove.x - 20, M.cove.y - 140, M.cove.w + 40, M.deck.y - (M.cove.y - 140));
      isleRegionPath(g);
      g.lineJoin = 'round';
      g.strokeStyle = P.sandWet;
      g.lineWidth = 34;
      g.stroke();
      g.restore();
      // The point: granite shelves round the north and east shore.
      g.strokeStyle = '#7d7a70';
      g.lineWidth = 60;
      g.save();
      g.beginPath();
      g.rect(M.cove.x + M.cove.w - 10, -5400, 900, 900);
      g.rect(M.wall.x - 70, -5400, 140, 240);
      g.clip();
      isleRegionPath(g);
      g.stroke();
      g.restore();
      g.restore();
      // The drive and the turning circle, the bays, the canopy's apron.
      g.strokeStyle = setts;
      g.lineWidth = 46;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      M.drive.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y + 6)));
      g.stroke();
      g.lineCap = 'butt';
      const L = M.loop;
      g.fillStyle = setts;
      g.beginPath();
      g.arc(L.x, L.y, L.r + L.lane, 0, TAU);
      g.fill();
      fill({ x: M.canopy.x - 6, y: M.canopy.y, w: M.canopy.w + 12, h: 40 }, '#e2dccb');
      fill({ x: M.bays.x - 8, y: M.bays.y - 10, w: M.bays.w + 16, h: M.bays.h + 14 }, setts);
      if (detail) {
        g.strokeStyle = 'rgba(70,64,54,0.25)';
        g.lineWidth = 0.8;
        for (let r = L.island + 8; r < L.r + L.lane; r += 7) {
          g.beginPath();
          g.arc(L.x, L.y, r, 0, TAU);
          g.stroke();
        }
        g.strokeStyle = '#efeadc';
        g.lineWidth = 1.2;
        for (let k = 0; k <= M.bays.count; k++) {
          const x = M.bays.x + (k * M.bays.w) / M.bays.count;
          g.beginPath();
          g.moveTo(x, M.bays.y);
          g.lineTo(x, M.bays.y + M.bays.h);
          g.stroke();
        }
      }
      g.fillStyle = P.lawnDark;
      g.beginPath();
      g.arc(L.x, L.y, L.island, 0, TAU);
      g.fill();
      // The residents' walk from the pedestrian gate up to the deck.
      fill({ x: M.walk.x - M.walk.w / 2 + 12, y: M.deck.y + M.deck.h, w: M.walk.w, h: M.wall.y - M.deck.y - M.deck.h }, '#e2dccb');
      // The formal garden: box-edged parterres either side of a gravel cross.
      const G = M.lawn;
      fill(G, '#648a4f');
      if (detail) {
        g.strokeStyle = '#3f6536';
        g.lineWidth = 3;
        for (const [u, v] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ])
          g.strokeRect(G.x + 14 + u * (G.w / 2), G.y + 14 + v * (G.h / 2), G.w / 2 - 28, G.h / 2 - 28);
      }
      fill({ x: G.x + G.w / 2 - 8, y: G.y + 8, w: 16, h: G.h - 16 }, P.gravel);
      fill({ x: G.x + 8, y: G.y + G.h / 2 - 8, w: G.w - 16, h: 16 }, P.gravel);
      // The pool deck in travertine, the pool, the steps to the sand.
      const D = M.deck;
      fill(D, '#e8e0cc');
      if (detail) {
        g.strokeStyle = 'rgba(150,140,120,0.35)';
        g.lineWidth = 0.6;
        for (let x = D.x; x < D.x + D.w; x += 12) {
          g.beginPath();
          g.moveTo(x, D.y);
          g.lineTo(x, D.y + D.h);
          g.stroke();
        }
      }
      fill({ x: M.pool.x - 4, y: M.pool.y - 4, w: M.pool.w + 8, h: M.pool.h + 8 }, '#f4f1e8');
      fill(M.pool, '#3fb0c8');
      fill({ x: M.steps.x, y: D.y - 22, w: M.steps.w, h: 22 }, '#ddd4bd');
      // The tennis court.
      const T = M.court;
      fill({ x: T.x - 10, y: T.y - 10, w: T.w + 20, h: T.h + 20 }, '#4f7a5f');
      fill(T, P.court);
      g.strokeStyle = '#f2f2ec';
      g.lineWidth = 1.2;
      g.strokeRect(T.x + 6, T.y + 6, T.w - 12, T.h - 12);
      g.beginPath();
      g.moveTo(T.x + 6, T.y + T.h / 2);
      g.lineTo(T.x + T.w - 6, T.y + T.h / 2);
      g.moveTo(T.x + T.w / 2, T.y + 40);
      g.lineTo(T.x + T.w / 2, T.y + T.h - 40);
      g.stroke();
      // The gate's apron across the pavement: the same setts to the kerb.
      fill({ x: M.gate.x - M.gate.half - 6, y: M.wall.y, w: M.gate.half * 2 + 12, h: -4544 - 48 - M.wall.y }, setts);
      // Under the tower (drawn over by the podium).
      fill({ x: M.tower.x - 10, y: M.tower.y - 10, w: M.tower.w + 20, h: M.tower.h + 20 }, '#d6cfbc');
    }
    /* The minimap and big map: the grounds, the pool, the cove and a gold rim round the tower. */
    function paintMonarchOneMap(g) {
      const M = MONARCH_ONE;
      g.fillStyle = '#6f9860';
      g.fillRect(M.wall.x, M.cove.y + M.cove.h, 820, M.wall.y - M.cove.y - M.cove.h);
      g.fillRect(M.cove.x + M.cove.w, -5320, 420, M.cove.y + M.cove.h + 5320);
      g.fillStyle = '#d9cba0';
      g.fillRect(M.cove.x, M.cove.y, M.cove.w, M.cove.h);
      g.fillStyle = '#e4dece';
      g.fillRect(M.deck.x, M.deck.y, M.deck.w, M.deck.h);
      g.fillStyle = '#5cc1d4';
      g.fillRect(M.pool.x, M.pool.y, M.pool.w, M.pool.h);
      g.fillStyle = '#b8b1a2';
      g.beginPath();
      g.arc(M.loop.x, M.loop.y, M.loop.r + M.loop.lane, 0, TAU);
      g.fill();
      g.strokeStyle = '#d9b25a';
      g.lineWidth = 10;
      g.strokeRect(M.tower.x - 12, M.tower.y - 12, M.tower.w + 24, M.tower.h + 24);
    }
    function monarchOneReport() {
      const M = MONARCH_ONE,
        t = M.tower,
        b = t.building;
      return {
        name: M.name,
        tower: { x: t.x, y: t.y, w: t.w, h: t.h, storeys: t.storeys, roofM: b ? Math.round(worldMeters(b.height)) : 0, topM: b ? Math.round(worldMeters(b.height + t.crown + (t.spire || 0))) : 0, helipad: !!b?.helipad },
        gate: { x: M.gate.x, y: M.gate.y, arm: +M.gate.open.toFixed(2), armBody: !!monarchOneArmBodyNow(), up: (monarchOneArmBodyNow()?.minHeight || 0) > 1e6 },
        canopy: M.canopy,
        loop: M.loop,
        pool: M.pool,
        cove: M.cove,
        jetty: M.jetty,
        tender: M.tenderBoat ? { x: Math.round(M.tenderBoat.x), y: Math.round(M.tenderBoat.y), type: M.tenderBoat.type } : null,
        staff: pedestrians.filter((p) => p.isle?.post?.lines?.startsWith('monarchOne') && p.hp > 0).length,
        walls: (M.walls || []).length,
      };
    }
