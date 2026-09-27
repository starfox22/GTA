    // North Point Key built: its land and bridge, the three towers, palms, fountain and ground tile, shore rules and map paint.
    /**
     * North Point Key, built
     * Source: src/skyline-islet.js
     * Scope: game closure. The plan and coast are geography-key.js (NORTH_POINT_KEY);
     * the towers are drawn by skyline3d.js, the islet's dressing by skyline3d-islet.js.
     *
     * - The land is appended to LAND_REGIONS last and the bridge to BRIDGES here,
     *   at include time, so every cache built later (land cells, coast segments,
     *   the street grid, the route graph) sees them and nothing before them moves.
     * - The -3456 cross street carries on over the bridge (a bridge deck counts as
     *   ground to cityStreets) and stops at the drop-off circle (northPointKeyStreetClip):
     *   GPS routes end there, traffic never turns in (no exit beyond), police route
     *   to the grid node on the bridge.
     * - buildNorthPointKey() runs last in buildWorld, on a random stream of its
     *   own: the towers (real heights already), palms, the solids and the ground tile.
     */
    LAND_REGIONS.push(NORTH_POINT_KEY);
    BRIDGES.push({
      id: 'north-point-key',
      style: 'key',
      name: 'NORTH POINT KEY BRIDGE',
      link: 'NORTHBANK - NORTH POINT KEY',
      width: NORTH_POINT_KEY.bridge.width,
      deck: 0,
      a: NORTH_POINT_KEY.bridge.a,
      b: NORTH_POINT_KEY.bridge.b,
    });
    // The grid on the islet: only the access row, and only up to the circle.
    function northPointKeyStreetClip(x, y, vertical) {
      if (!onNorthPointKey(x, y)) return false;
      return vertical || Math.abs(y - NORTH_POINT_KEY.row) > 1 || x > NORTH_POINT_KEY.streetEnd;
    }
    // The HUD's street name on the Key: the avenue off the bridge and the circle.
    function northPointKeyStreetName(x, y) {
      if (!onNorthPointKey(x, y)) return '';
      const K = NORTH_POINT_KEY,
        C = K.circle;
      if (Math.abs(Math.hypot(x - C.x, y - C.y) - C.r) < C.width / 2 + 14) return 'KEY CIRCLE';
      if (Math.abs(y - K.row) < 62 && x < C.x) return 'KEY AVENUE';
      return '';
    }
    // Sand down the south-east shore, a quay wall everywhere else.
    function northPointKeyShoreStyle(e) {
      if (e.region !== NORTH_POINT_KEY.id) return null;
      return e.x > NORTH_POINT_KEY.beach.x0 && e.y > NORTH_POINT_KEY.beach.y0 ? 'beach' : 'quay';
    }
    // No esplanade behind or beside the towers (nothing walkable north of them).
    function northPointKeyEsplanadeGivesWay(e) {
      return e.region === NORTH_POINT_KEY.id && e.y < NORTH_POINT_KEY.towerLine;
    }
    /* Solids on the islet (people: solid(); vehicles: buildColliders): the
       fountain's basin with its planted island and the gate pylons at the
       bridge landing. */
    const NORTH_POINT_KEY_SOLIDS = [];
    function northPointKeySolids() {
      return NORTH_POINT_KEY_SOLIDS;
    }
    function northPointKeyBlocked(x, y, r = 0) {
      if (x < 3700 || x > 4500 || y < -4020 || y > -3090) return false;
      return NORTH_POINT_KEY_SOLIDS.some((b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h);
    }
    // The gate at the bridge landing: two pylons either side of the carriageway.
    const NORTH_POINT_KEY_GATE = { x: 3806, half: 60, size: 16 };
    // Palms: the avenue off the bridge, the circle, the forecourt edge, the lawns and the beach top.
    function northPointKeyPalms() {
      const K = NORTH_POINT_KEY,
        C = K.circle,
        list = [];
      for (let x = 3830; x <= 3950; x += 40) for (const side of [-1, 1]) list.push([x, K.row + side * 62, 19, 'royal']);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6;
        list.push([C.x + Math.cos(a) * 47, C.y + Math.sin(a) * 47, 15, 'coconut']);
      }
      for (let x = 3812; x < 4440; x += 64) if (Math.abs(x - C.x) > 76) list.push([x, K.forecourt.y1 - 10, 18, 'royal']);
      for (const [x, y, r, s] of [
        [3850, -3300, 17, 'canary'],
        [3915, -3250, 16, 'coconut'],
        [3990, -3226, 18, 'coconut'],
        [4040, -3290, 15, 'fan'],
        [4175, -3300, 17, 'coconut'],
        [4238, -3372, 18, 'coconut'],
        [4292, -3450, 16, 'coconut'],
        [4322, -3530, 17, 'royal'],
        [3812, -3560, 17, 'canary'],
        [3806, -3350, 16, 'fan'],
      ])
        list.push([x, y, r, s]);
      return list;
    }
    /* Where the islet's street furniture stands (skyline3d-islet.js draws it and
       registers the knockable pieces, as the esplanade does): lamp standards down
       the avenue, round the circle and along the forecourt, benches on the
       forecourt facing the circle, loungers and parasols on the sand. */
    let northPointKeyFurnitureCache = null;
    function northPointKeyFurniture() {
      if (northPointKeyFurnitureCache) return northPointKeyFurnitureCache;
      const K = NORTH_POINT_KEY,
        C = K.circle,
        F = K.forecourt,
        lamps = [],
        benches = [],
        loungers = [];
      for (const x of [3850, 3930]) for (const side of [-1, 1]) lamps.push({ x, y: K.row + side * 58 });
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU + Math.PI / 10,
          x = C.x + Math.cos(a) * (C.r + C.width / 2 + 10),
          y = C.y + Math.sin(a) * (C.r + C.width / 2 + 10);
        // Not in the avenue's mouth nor on the apron up to the forecourt.
        if (Math.abs(y - K.row) < 56 && x < C.x) continue;
        if (Math.abs(x - C.x) < 70 && y < C.y) continue;
        lamps.push({ x, y });
      }
      for (let x = 3834; x < 4430; x += 96) if (Math.abs(x - C.x) > 80) lamps.push({ x, y: F.y1 - 36 });
      for (let x = 3882; x < 4430; x += 96) if (Math.abs(x - C.x) > 90) benches.push({ x, y: F.y1 - 34, a: Math.PI / 2 });
      // The sand: every other shore point down the south-east, a pair of loungers
      // under a parasol, set in from the waterline.
      const cx = 4100,
        cy = -3540;
      K.polygon.forEach(([px, py], i) => {
        if (i % 2 || px < K.beach.x0 + 30 || py < K.beach.y0 + 40) return;
        const d = Math.hypot(cx - px, cy - py),
          nx = (cx - px) / d,
          ny = (cy - py) / d,
          a = Math.atan2(-ny, -nx);
        loungers.push({ x: px + nx * 50, y: py + ny * 50, a, parasol: { x: px + nx * 62, y: py + ny * 62 } });
      });
      return (northPointKeyFurnitureCache = { lamps, benches, loungers });
    }
    function buildNorthPointKey() {
      const K = NORTH_POINT_KEY,
        C = K.circle,
        resume = randomSeed;
      randomSeed = 20260926;
      for (const t of activeSkylineTowers()) {
        if (!t.site) continue;
        const [x, y, w, h] = t.site;
        makeBuilding(x, y, w, h, 0, true);
        const b = buildings[buildings.length - 1];
        // Planned in real storeys here: this runs after buildWorld's real-height pass.
        b.height = realBuildingHeight(t.height);
        b.skyline = t;
        b.islet = true;
        // Outside the city sheet: the 2D view draws it with the county's buildings.
        b.county = true;
      }
      for (const [x, y, r, species] of northPointKeyPalms()) trees.push({ x, y, r, species, tropical: true, islet: true });
      NORTH_POINT_KEY_SOLIDS.length = 0;
      const f = K.fountain.r + 4;
      NORTH_POINT_KEY_SOLIDS.push({ x: C.x - f, y: C.y - f, w: f * 2, h: f * 2, height: 9, kind: 'fountain' });
      const G = NORTH_POINT_KEY_GATE;
      for (const side of [-1, 1])
        NORTH_POINT_KEY_SOLIDS.push({ x: G.x - G.size / 2, y: K.row + side * G.half - G.size / 2, w: G.size, h: G.size, height: 72, kind: 'gate pylon' });
      registerFootObstacle(C.x, C.y, K.fountain.r + 3);
      for (const l of northPointKeyFurniture().loungers) registerFootObstacle(l.x, l.y, 9, 4, l.a);
      // The roof decks and the lifts (skyline-lift.js), now the towers stand.
      prepareSkylineRoofs();
      const t = K.tile,
        canvas = document.createElement('canvas');
      canvas.width = Math.round(t.w * t.pixelsPerUnit);
      canvas.height = Math.round(t.h * t.pixelsPerUnit);
      const g = canvas.getContext('2d');
      g.scale(t.pixelsPerUnit, t.pixelsPerUnit);
      g.translate(-t.x, -t.y);
      paintNorthPointKeyGround(g);
      countyGroundTiles.push({ x: t.x, y: t.y, w: t.w, h: t.h, canvas, style: 'monarch' });
      K.canvas = canvas;
      randomSeed = resume;
    }
    const KEY_PAINT = {
      lawn: '#6c8e55',
      stone: '#d3cbb6',
      stoneJoint: '#bdb49c',
      coping: '#e6e0cf',
      road: '#3d4547',
      kerb: '#dcd6c4',
      lane: '#e2ddcb',
      sand: '#e3d3a6',
      sandWet: '#c9b78c',
      bed: '#4f6f3e',
      bloom: ['#c2447a', '#e6a13c', '#f0ece0', '#9b5fc0'],
    };
    /* The islet's ground: lawns, the limestone forecourt and sea-wall walk, the
       avenue off the bridge and the drop-off circle, sand down the south-east. */
    function paintNorthPointKeyGround(g) {
      const K = NORTH_POINT_KEY,
        C = K.circle,
        F = K.forecourt,
        P = KEY_PAINT,
        t = K.tile,
        rect = (x, y, w, h, c) => {
          g.fillStyle = c;
          g.fillRect(x, y, w, h);
        },
        disc = (x, y, r, c) => {
          g.fillStyle = c;
          g.beginPath();
          g.arc(x, y, r, 0, TAU);
          g.fill();
        };
      g.save();
      regionPath(g, K);
      g.clip();
      rect(t.x, t.y, t.w, t.h, P.lawn);
      // Mown stripes.
      g.globalAlpha = 0.07;
      for (let x = t.x; x < t.x + t.w; x += 28) rect(x, t.y, 14, t.h, '#eef5d8');
      g.globalAlpha = 1;
      // The walk along the sea wall (72 units in from the edge) and its coping.
      regionPath(g, K);
      g.strokeStyle = P.stone;
      g.lineWidth = 144;
      g.stroke();
      // Sand down the south-east shore, damp at the water.
      g.save();
      g.beginPath();
      g.rect(K.beach.x0, K.beach.y0, 600, 700);
      g.clip();
      regionPath(g, K);
      g.strokeStyle = P.sand;
      g.lineWidth = 184;
      g.stroke();
      g.strokeStyle = P.sandWet;
      g.lineWidth = 40;
      g.stroke();
      g.restore();
      // The tower row and the forecourt in front of it.
      rect(t.x, t.y, t.w, F.y1 - t.y, P.stone);
      g.strokeStyle = P.stoneJoint;
      g.lineWidth = 1;
      g.beginPath();
      for (let x = F.x0; x < F.x1; x += 16) {
        g.moveTo(x, F.y0);
        g.lineTo(x, F.y1);
      }
      for (let y = F.y0; y < F.y1; y += 16) {
        g.moveTo(F.x0, y);
        g.lineTo(F.x1, y);
      }
      g.stroke();
      // The sea wall's coping all round.
      regionPath(g, K);
      g.strokeStyle = P.coping;
      g.lineWidth = 8;
      g.stroke();
      // Planted beds along the forecourt's lawn edge, in flower.
      for (let x = 3790; x < 4440; x += 64) {
        if (Math.abs(x + 16 - C.x) < 90) continue;
        rect(x, F.y1 - 22, 44, 20, P.bed);
        for (let k = 0; k < 7; k++) disc(x + 5 + k * 6, F.y1 - 12 + (k % 2 ? 4 : -4), 2.6, P.bloom[(k + x) % 4]);
      }
      // The apron from the circle up to the forecourt, laid in darker setts.
      rect(C.x - 64, F.y1, 128, C.y - C.r - C.width / 2 - F.y1 + 6, '#b8ae98');
      // Pavements and the avenue off the bridge.
      rect(3700, K.row - 66, C.x - 3700, 132, P.stone);
      rect(3700, K.row - 44, C.x - 3700, 88, P.road);
      // The drop-off circle round its planted island.
      disc(C.x, C.y, C.r + C.width / 2 + 16, P.stone);
      disc(C.x, C.y, C.r + C.width / 2, P.road);
      disc(C.x, C.y, C.r - C.width / 2, P.kerb);
      disc(C.x, C.y, C.r - C.width / 2 - 3, P.lawn);
      disc(C.x, C.y, K.fountain.r + 7, P.bed);
      // Lane lines: the avenue's edge lines and the circle's give-way line.
      g.strokeStyle = P.lane;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(3700, K.row - 40);
      g.lineTo(C.x - C.r - C.width / 2 - 2, K.row - 40);
      g.moveTo(3700, K.row + 40);
      g.lineTo(C.x - C.r - C.width / 2 - 2, K.row + 40);
      g.stroke();
      g.setLineDash([10, 8]);
      g.beginPath();
      g.moveTo(3700, K.row);
      g.lineTo(C.x - C.r - C.width / 2 - 10, K.row);
      g.stroke();
      g.setLineDash([6, 6]);
      g.beginPath();
      g.arc(C.x, C.y, C.r + C.width / 2 - 3, Math.PI * 0.86, Math.PI * 1.14);
      g.stroke();
      g.setLineDash([]);
      // A zebra from the apron across the circle to the island's north edge is
      // not laid: people cross to the fountain on the island's south path.
      // Garden paths through the south lawn to the beach and round to the walk.
      g.strokeStyle = P.stone;
      g.lineWidth = 20;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(C.x, C.y + C.r + C.width / 2 + 10);
      g.quadraticCurveTo(C.x + 40, -3280, 4205, -3238);
      g.moveTo(C.x - 30, C.y + C.r + C.width / 2 + 8);
      g.quadraticCurveTo(3940, -3300, 3860, -3222);
      g.stroke();
      g.lineCap = 'butt';
      g.restore();
    }
    // The minimap and the big map: the islet's own sheet over its land.
    function paintNorthPointKeyMap(g) {
      const t = NORTH_POINT_KEY.tile;
      if (NORTH_POINT_KEY.canvas) g.drawImage(NORTH_POINT_KEY.canvas, t.x, t.y, t.w, t.h);
    }
