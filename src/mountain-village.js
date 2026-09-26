    // BEGIN SUBSYSTEM: src/mountain-village.js — The mountain villages of Ridgeline County
    /**
     * The mountain villages of Ridgeline County
     * Source: src/mountain-village.js
     * Scope: shared game closure (included after offroad.js).
     *
     * The Ridgeline island is mountain country, and its three towns (STONECREEK
     * in the valley, NORTHRIDGE at the foot of the range where Eagle Pass comes
     * down from the Mount Ascent trailhead, EASTGATE the timber town) are built
     * as mountain villages, not with the city's boxes: chalets and lodges with
     * steep roofs and deep eaves, log and fieldstone, main-street shops with
     * false fronts and porches over plank boardwalks, a chapel, a ranger
     * station, a motel, a tavern, a gas station under a timber canopy, a sawmill.
     *
     * This file is the plan: each town keeps its 2 x 2 blocks and streets (the
     * flat pads terrain.js cuts), and each block has a hand-laid list of
     * buildings (MOUNTAIN_TOWN_PLANS) with a kind (MOUNTAIN_KINDS: storey
     * heights, roof pitch, how it is dressed) and a deterministic seed that picks
     * its walls, roof, trim and flowers. buildMountainVillages() turns the plan
     * into `buildings` (real heights, `mountain` and `pitched` set: cityscape3d
     * leaves them to mountain-village3d.js, no helicopter lands on a pitched
     * roof) and into the street dressing the renderer draws and the colliders
     * use: boardwalks, lantern lamps, benches, planters, firewood, split-rail
     * fences, the squares with their fountain and well, trees.
     *
     * Special blocks: Northridge's north-west block is the RIDGELINE 4X4 CLUB
     * (offroad.js OFFROAD_CLUB: clubhouse, workshop, yard and lot; its walls are
     * thin buildings so the rooms can be walked into); its south-west block is
     * the RANGER STATION with the Mountain Rescue helipad, where the Last Witness
     * lands (aviation.js FLIGHT.pickup); Stonecreek has the gas station and
     * STONECREEK GARAGE (garages.js, drawn rustic by garage3d.js); Eastgate
     * the sawmill yard.
     *
     * The outfitters (guns) and lodge (save) businesses stay where their towns'
     * PLACES put them, restyled; Northridge's moved to its north-east block when
     * the club took the old one (installCountyServices asks mountainServiceSpot).
     */
    const MV_M = UNITS_PER_METRE;
    const MOUNTAIN_TOWN_NAMES = ['STONECREEK', 'NORTHRIDGE', 'EASTGATE'];
    function isMountainTown(t) {
      return MOUNTAIN_TOWN_NAMES.includes(t.name);
    }
    // A small deterministic generator per building (the world's randomSeed stays untouched).
    function mountainRandom(seed) {
      let s = seed >>> 0 || 1;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    /*
     * KINDS. Storey heights in metres (a mountain house's ground floor is lower
     * than a city shop's), roof pitch in degrees, which way the ridge runs ('y':
     * the gable faces the street, the alpine chalet; 'x': the long roof slope
     * faces it), the overhang, the wall and roof finishes the seed picks from,
     * and what the renderer adds (false front, porch over a boardwalk, balcony,
     * dormers, steeple...). `street` kinds get a plank boardwalk in front.
     */
    const MOUNTAIN_KINDS = {
      chalet: { ground: 3.2, upper: 2.9, floors: 2, pitch: 40, ridge: 'y', overhang: 1.3, base: ['stone', 'stone', 'log'], walls: ['plaster', 'boards', 'log'], roofs: ['shake', 'slate', 'shake', 'metal'], balcony: true, shutters: true, flowers: true },
      house: { ground: 3.0, upper: 2.8, floors: 2, pitch: 42, ridge: 'x', overhang: 1.0, base: ['stone', 'boards'], walls: ['boards', 'log', 'plaster'], roofs: ['shake', 'metal', 'slate'], dormers: true, shutters: true, flowers: true, porch: true },
      cabin: { ground: 3.0, upper: 0, floors: 1, pitch: 36, ridge: 'x', overhang: 0.9, base: ['log'], walls: ['log'], roofs: ['shake', 'metal', 'shake'], porch: true, flowers: true },
      lodge: { ground: 3.4, upper: 3.0, floors: 3, pitch: 42, ridge: 'x', overhang: 1.4, base: ['stone'], walls: ['log', 'log', 'boards'], roofs: ['shake', 'slate'], dormers: true, crossGable: true, balcony: true, porch: true, street: true, flowers: true },
      shop: { ground: 4.2, upper: 3.0, floors: 2, pitch: 34, ridge: 'y', overhang: 0.6, base: ['boards', 'stone', 'boards'], walls: ['boards', 'boards', 'log'], roofs: ['metal', 'shake', 'metal'], falseFront: true, porch: true, street: true, flowers: true, shopWindow: true },
      store: { ground: 4.4, upper: 3.0, floors: 2, pitch: 32, ridge: 'y', overhang: 0.6, base: ['boards'], walls: ['boards'], roofs: ['metal'], falseFront: true, porch: true, street: true, shopWindow: true },
      bakery: { ground: 3.8, upper: 2.9, floors: 2, pitch: 42, ridge: 'y', overhang: 1.1, base: ['stone'], walls: ['plaster'], roofs: ['slate', 'shake'], balcony: true, shutters: true, flowers: true, street: true, shopWindow: true, awning: true },
      cafe: { ground: 3.8, upper: 2.9, floors: 1, pitch: 38, ridge: 'y', overhang: 1.1, base: ['stone', 'log'], walls: ['log', 'boards'], roofs: ['shake', 'metal'], flowers: true, street: true, shopWindow: true, awning: true },
      diner: { ground: 4.0, upper: 0, floors: 1, pitch: 30, ridge: 'y', overhang: 0.8, base: ['log'], walls: ['log'], roofs: ['metal'], falseFront: true, porch: true, street: true, shopWindow: true },
      tavern: { ground: 4.2, upper: 3.0, floors: 2, pitch: 40, ridge: 'x', overhang: 1.3, base: ['stone'], walls: ['log'], roofs: ['shake'], dormers: true, crossGable: true, street: true, shopWindow: true, flowers: true },
      chapel: { ground: 5.8, upper: 0, floors: 1, pitch: 55, ridge: 'y', overhang: 0.7, base: ['stone'], walls: ['boards'], roofs: ['shake'], steeple: true },
      station: { ground: 3.4, upper: 3.0, floors: 2, pitch: 36, ridge: 'x', overhang: 1.3, base: ['stone'], walls: ['log'], roofs: ['metal'], porch: true, dormers: true },
      rescue: { ground: 5.4, upper: 0, floors: 1, pitch: 30, ridge: 'x', overhang: 0.8, base: ['stone'], walls: ['boards'], roofs: ['metal'], bayDoors: 2 },
      motel: { ground: 3.1, upper: 0, floors: 1, pitch: 28, ridge: 'x', overhang: 0.9, base: ['log'], walls: ['log'], roofs: ['shake'], porch: true, motel: true },
      gas: { ground: 3.8, upper: 0, floors: 1, pitch: 30, ridge: 'x', overhang: 1.0, base: ['stone'], walls: ['log'], roofs: ['metal'], porch: true, shopWindow: true, street: true },
      barn: { ground: 6.2, upper: 0, floors: 1, pitch: 40, ridge: 'y', overhang: 0.8, base: ['boards'], walls: ['boards'], roofs: ['metal'], barnDoor: true, street: true },
      mill: { ground: 7.4, upper: 0, floors: 1, pitch: 22, ridge: 'x', overhang: 1.2, base: ['boards'], walls: ['boards'], roofs: ['metal'], openSides: true },
      woodshed: { ground: 2.6, upper: 0, floors: 1, pitch: 26, ridge: 'x', overhang: 0.6, base: ['boards'], walls: ['boards'], roofs: ['shake'], openSides: true },
      lookout: { ground: 11.5, upper: 0, floors: 1, pitch: 30, ridge: 'x', overhang: 0.6, base: ['boards'], walls: ['boards'], roofs: ['metal'], tower: true },
    };
    /*
     * THE PLANS. Per town, per block 'i,j' (the block's north-west corner at
     * town + (i, j) x BLOCK_SIZE): [kind, x, y, w, d, options] in map units
     * from that corner, x east, y south, the building's street face its south
     * side (the camera looks north). A block's kerbs are 44 in from its corner
     * (54 or 50 where a highway or the Stonecreek Connector runs along it); the
     * lists keep clear of the county roads that cut corners off some blocks.
     * `place: 'guns' | 'sleep'` is the town's OUTFITTERS / LODGE business.
     * `special` blocks are laid out by their own code.
     */
    const MOUNTAIN_TOWN_PLANS = {
      NORTHRIDGE: {
        '0,0': { special: 'club' },
        '1,0': [
          ['shop', 62, 300, 134, 130, { place: 'guns', name: 'NORTHRIDGE OUTFITTERS' }],
          ['lodge', 214, 270, 150, 160, { place: 'sleep', name: 'NORTHRIDGE LODGE' }],
          ['cafe', 382, 340, 76, 90, { name: 'ALPENGLOW CAFÉ' }],
          ['cabin', 70, 160, 60, 50, {}],
          ['cabin', 150, 196, 56, 48, {}],
        ],
        '0,1': {
          special: 'ranger',
          list: [
            ['station', 70, 80, 190, 140, { name: 'RANGER STATION' }],
            ['rescue', 300, 76, 150, 124, { name: 'MOUNTAIN RESCUE' }],
            ['lookout', 404, 250, 36, 36, {}],
          ],
        },
        '1,1': {
          special: 'square',
          square: { x: 172, y: 237, w: 180, h: 170, feature: 'fountain' },
          list: [
            ['store', 62, 66, 150, 130, { name: 'GENERAL STORE' }],
            ['chalet', 226, 96, 80, 100, {}],
            ['chapel', 322, 60, 110, 170, { name: 'MOUNTAIN CHAPEL' }],
            ['bakery', 62, 300, 92, 130, { name: 'PINE CONE BAKERY' }],
            ['chalet', 366, 300, 90, 130, {}],
          ],
        },
      },
      STONECREEK: {
        '0,0': [
          ['shop', 82, 82, 132, 125, { place: 'guns', name: 'STONECREEK OUTFITTERS' }],
          ['lodge', 295, 82, 130, 122, { place: 'sleep', name: 'STONECREEK LODGE', floors: 2 }],
          ['woodshed', 226, 120, 58, 60, {}],
          ['cabin', 58, 300, 56, 90, { ridge: 'y' }],
          ['diner', 350, 280, 106, 150, { name: 'SUMMIT DINER' }],
        ],
        '1,0': [
          ['tavern', 70, 200, 180, 170, { name: 'THE ANTLER TAVERN', deck: { x: 60, y: 370, w: 240, h: 70 } }],
          ['shop', 320, 250, 136, 150, { name: 'RIDGELINE RENTALS' }],
        ],
        '0,1': {
          special: 'motel',
          court: { x: 150, y: 170, w: 162, h: 160 },
          list: [
            ['motel', 62, 70, 250, 90, { name: 'PINE CREST MOTEL' }],
            ['motel', 62, 160, 80, 170, { ridge: 'y', wing: true }],
            ['chalet', 340, 70, 110, 120, {}],
            ['chalet', 200, 340, 90, 100, {}],
            ['chalet', 330, 320, 120, 120, {}],
          ],
        },
        '1,1': {
          special: 'square',
          square: { x: 250, y: 70, w: 190, h: 190, feature: 'well' },
          gas: { x: 70, y: 320, w: 170, h: 100 },
          list: [
            ['gas', 62, 190, 138, 90, { name: 'GAS · GROCERIES' }],
            ['chalet', 62, 66, 110, 100, {}],
            ['house', 260, 300, 90, 130, {}],
            ['chalet', 372, 300, 84, 130, {}],
          ],
        },
      },
      EASTGATE: {
        '0,0': [
          ['shop', 82, 82, 132, 125, { place: 'guns', name: 'EASTGATE OUTFITTERS' }],
          ['lodge', 295, 82, 130, 122, { place: 'sleep', name: 'EASTGATE LODGE', floors: 2 }],
          ['barn', 70, 280, 180, 160, { name: 'FEED & SEED' }],
          ['chalet', 290, 300, 80, 130, {}],
          ['cabin', 386, 320, 70, 100, { ridge: 'y' }],
        ],
        '1,0': {
          special: 'mill',
          logs: { x: 330, y: 74, w: 118, h: 166 },
          lumber: { x: 210, y: 300, w: 238, h: 140 },
          list: [
            ['mill', 70, 110, 240, 170, { name: 'RIDGELINE TIMBER CO.' }],
            ['cabin', 70, 330, 110, 100, { name: 'MILL OFFICE' }],
          ],
        },
        '0,1': [
          ['cafe', 62, 300, 120, 130, { name: 'TIMBERLINE CAFÉ', floors: 2 }],
          ['chalet', 62, 66, 110, 120, {}],
          ['house', 200, 66, 100, 120, {}],
          ['chalet', 330, 70, 110, 120, {}],
          ['chalet', 210, 310, 90, 120, {}],
          ['cabin', 340, 330, 100, 100, {}],
        ],
        '1,1': [
          ['cabin', 62, 66, 90, 70, {}],
          ['chalet', 190, 66, 90, 110, {}],
          ['cabin', 62, 200, 80, 70, {}],
          ['cabin', 62, 320, 70, 60, {}],
        ],
      },
    };
    // Finishes and colours the seed picks from.
    const MOUNTAIN_PALETTE = {
      trim: ['#2f4a34', '#6e2a22', '#27384f', '#8a6a2a', '#e8dfc8', '#3b2a1e', '#4d5e3a', '#7a3b2a'],
      shutter: ['#2f5a3a', '#8e2f26', '#2a4766', '#c9a24a', '#3e5f5a', '#5a3a28'],
      flower: ['#d43a3a', '#e25a9a', '#f0c030', '#b64fd0', '#ff6a3a', '#f4f0e6'],
      stain: ['#8a6440', '#6e4f33', '#9c7a52', '#5b4330', '#7d5a3a'],
      boards: ['#7a5a3c', '#8e6a44', '#5e4a36', '#a88a62', '#6b3a2a', '#44584a', '#b8a888'],
      plaster: ['#efe6d2', '#f3ecdc', '#e8dcc4', '#f0e2c8'],
      stone: ['#9a948a', '#8b8478', '#a39a8c', '#8f8a80'],
      metalRoof: ['#8e3a2e', '#4f6e58', '#6a7680', '#9aa0a4', '#7a5e46'],
      shake: ['#6e5540', '#5f4a38', '#7a6048', '#584536'],
      slate: ['#4b5058', '#555a60', '#43474e'],
    };
    const MOUNTAIN_VILLAGE = {
      buildings: [],
      boardwalks: [],
      lamps: [],
      benches: [],
      planters: [],
      firewood: [],
      fences: [],
      squares: [],
      yards: [],
      special: [],
      helipad: null,
      gas: null,
      mill: null,
      built: false,
    };
    const mountainPick = (random, list) => list[Math.floor(random() * list.length) % list.length];
    // Clear of every county and service road by `margin` (a rectangle's corners, edges and middle).
    function mountainRectClear(x, y, w, h, margin) {
      for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2], [x + w / 2, y + h / 2]]) {
        if (onCountyRoad(px, py, margin)) return false;
        for (const r of SERVICE_ROADS) for (let i = 1; i < r.points.length; i++) if (segmentDistance(px, py, r.points[i - 1], r.points[i]) < r.width / 2 + margin) return false;
      }
      return true;
    }
    // Metres to the county road or service road edge from a point (Infinity if none within 400).
    function mountainRoadEdge(px, py) {
      let best = Infinity;
      for (const r of [...COUNTY_ROADS, ...SERVICE_ROADS])
        for (let i = 1; i < r.points.length; i++) best = Math.min(best, segmentDistance(px, py, r.points[i - 1], r.points[i]) - r.width / 2);
      return best;
    }
    /* One building from a plan entry: its footprint, real heights and dressing. */
    function mountainBuilding(town, bx, by, entry, index) {
      const [kind, lx, ly, w, d, options] = entry,
        K = MOUNTAIN_KINDS[kind],
        seed = (town.x * 31 + town.y * 17 + index * 7919 + lx * 13 + ly * 7) >>> 0,
        random = mountainRandom(seed),
        floors = options.floors ?? K.floors,
        ridge = options.ridge ?? K.ridge,
        span = ridge === 'y' ? w : d,
        eaves = (K.ground + Math.max(0, floors - 1) * (K.upper || 0)) * MV_M,
        pitch = (K.pitch * Math.PI) / 180,
        rise = Math.min((span / 2) * Math.tan(pitch), 11 * MV_M),
        base = mountainPick(random, K.base),
        walls = mountainPick(random, K.walls),
        roof = mountainPick(random, K.roofs);
      const b = {
        x: bx + lx,
        y: by + ly,
        w,
        h: d,
        style: 0,
        county: true,
        mountain: true,
        pitched: true,
        tropical: false,
        kind,
        name: options.name || null,
        town: town.name,
        floors,
        ridge,
        eaves,
        rise,
        height: eaves + rise,
        seed,
        finish: {
          base,
          walls,
          roof,
          stain: mountainPick(random, MOUNTAIN_PALETTE.stain),
          boards: mountainPick(random, MOUNTAIN_PALETTE.boards),
          plaster: mountainPick(random, MOUNTAIN_PALETTE.plaster),
          stone: mountainPick(random, MOUNTAIN_PALETTE.stone),
          trim: mountainPick(random, MOUNTAIN_PALETTE.trim),
          shutter: mountainPick(random, MOUNTAIN_PALETTE.shutter),
          flower: mountainPick(random, MOUNTAIN_PALETTE.flower),
          roofColor: roof === 'metal' ? mountainPick(random, MOUNTAIN_PALETTE.metalRoof) : roof === 'slate' ? mountainPick(random, MOUNTAIN_PALETTE.slate) : mountainPick(random, MOUNTAIN_PALETTE.shake),
        },
        options,
      };
      // Tower: the lookout's cab is the height; chapel: the steeple rises past the ridge.
      if (K.tower) b.height = eaves + 4 * MV_M;
      if (K.steeple) b.steepleTop = b.height + 11 * MV_M;
      // Snow lies on a roof only well up the mountain (none in the valley towns).
      b.snow = clamp((terrainHeight(b.x + w / 2, b.y + d / 2) - 260) / 200, 0, 1);
      b.door = { x: b.x + (options.doorX ?? w / 2), y: b.y + d + 22 };
      b.mapColor = b.finish.roof === 'metal' ? b.finish.roofColor : b.finish.roof === 'slate' ? '#50555c' : '#6a5440';
      return b;
    }
    function buildMountainVillages() {
      if (MOUNTAIN_VILLAGE.built) return;
      MOUNTAIN_VILLAGE.built = true;
      let index = 0;
      for (const town of COUNTY_TOWNS) {
        if (!isMountainTown(town)) continue;
        const plan = MOUNTAIN_TOWN_PLANS[town.name];
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 2; j++) {
            const bx = town.x + i * BLOCK_SIZE,
              by = town.y + j * BLOCK_SIZE,
              blockPlan = plan[i + ',' + j] || [],
              list = Array.isArray(blockPlan) ? blockPlan : blockPlan.list || [],
              block = { town, i, j, x: bx, y: by, buildings: [] };
            for (const entry of list) {
              const b = mountainBuilding(town, bx, by, entry, index++);
              if (!mountainRectClear(b.x, b.y, b.w, b.h, 4)) {
                MOUNTAIN_VILLAGE.special.push({ skipped: b.kind, town: town.name, at: [b.x, b.y] });
                continue;
              }
              buildings.push(b);
              MOUNTAIN_VILLAGE.buildings.push(b);
              block.buildings.push(b);
            }
            if (!Array.isArray(blockPlan) && blockPlan.special) planSpecialBlock(block, blockPlan);
            dressMountainBlock(block, blockPlan);
          }
      }
      // The club's walls: thin buildings, so the rooms can be walked into.
      for (const w of clubWalls())
        buildings.push({ ...w, style: 0, county: true, mountain: true, pitched: true, clubWall: true, tropical: false, kind: 'clubWall', mapColor: '#6b5a48' });
      addMountainFootObstacles();
    }
    /* The special blocks' own layouts (the lists' buildings are already placed). */
    function planSpecialBlock(block, plan) {
      const { x, y } = block;
      if (plan.special === 'ranger') {
        // The Mountain Rescue pad: the Last Witness lands here (aviation.js FLIGHT.pickup).
        MOUNTAIN_VILLAGE.helipad = { x: x + 150, y: y + 350, size: 112 };
        MOUNTAIN_VILLAGE.yards.push({ kind: 'gravel', x: x + 240, y: y + 230, w: 220, h: 226 });
      }
      if (plan.special === 'square') {
        const s = plan.square;
        MOUNTAIN_VILLAGE.squares.push({ x: x + s.x, y: y + s.y, w: s.w, h: s.h, cx: x + s.x + s.w / 2, cy: y + s.y + s.h / 2, feature: s.feature, town: block.town.name });
        if (plan.gas) MOUNTAIN_VILLAGE.gas = { x: x + plan.gas.x, y: y + plan.gas.y, w: plan.gas.w, h: plan.gas.h };
      }
      if (plan.special === 'motel') MOUNTAIN_VILLAGE.yards.push({ kind: 'gravel', x: x + plan.court.x, y: y + plan.court.y, w: plan.court.w, h: plan.court.h });
      if (plan.special === 'mill') {
        MOUNTAIN_VILLAGE.mill = {
          logs: { x: x + plan.logs.x, y: y + plan.logs.y, w: plan.logs.w, h: plan.logs.h },
          lumber: { x: x + plan.lumber.x, y: y + plan.lumber.y, w: plan.lumber.w, h: plan.lumber.h },
        };
        MOUNTAIN_VILLAGE.yards.push({ kind: 'dirt', x: x + 60, y: y + 60, w: 396, h: 396 });
      }
    }
    // Is (x, y) clear for a piece of street dressing: land, off every road, out of every building (by `pad`)?
    function mountainSpotClear(x, y, pad = 4) {
      if (!landAt(x, y) || onCountyRoad(x, y, pad + 2)) return false;
      for (const r of SERVICE_ROADS) for (let i = 1; i < r.points.length; i++) if (segmentDistance(x, y, r.points[i - 1], r.points[i]) < r.width / 2 + pad) return false;
      for (const b of buildings) if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return false;
      if (inGarageLot(x, y, pad)) return false;
      const club = OFFROAD_CLUB.lot;
      if (x > club.x - pad && x < club.x + club.w + pad && y > club.y - pad && y < club.y + club.h + pad) return false;
      for (const s of MOUNTAIN_VILLAGE.squares) if (x > s.x - pad && x < s.x + s.w + pad && y > s.y - pad && y < s.y + s.h + pad) return false;
      for (const b of MOUNTAIN_VILLAGE.boardwalks) if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return false;
      const g = MOUNTAIN_VILLAGE.gas;
      if (g && x > g.x - pad && x < g.x + g.w + pad && y > g.y - pad && y < g.y + g.h + pad) return false;
      const h = MOUNTAIN_VILLAGE.helipad;
      if (h && Math.abs(x - h.x) < h.size / 2 + 40 && Math.abs(y - h.y) < h.size / 2 + 40) return false;
      return true;
    }
    /* A block's street dressing: boardwalks and porches for the street kinds,
       planters at their doors, firewood against the houses, split-rail fences
       round the gardens, lantern lamps along the kerbs, benches, trees. */
    function dressMountainBlock(block, plan) {
      const { x: bx, y: by } = block,
        random = mountainRandom(bx * 7 + by * 13);
      for (const b of block.buildings) {
        const K = MOUNTAIN_KINDS[b.kind],
          face = b.y + b.h;
        // (The tavern's own deck takes the place of its boardwalk.)
        if (K.street && !b.options.deck) {
          // Plank boardwalk from the face towards the kerb (short of any road).
          const depth = Math.max(0, Math.min(34, Math.floor(mountainRoadEdge(b.x + b.w / 2, face + 1) - 6)));
          if (depth >= 16) {
            const walk = { x: b.x - 6, y: face, w: b.w + 12, h: depth, porch: !!K.porch, building: b };
            MOUNTAIN_VILLAGE.boardwalks.push(walk);
            b.boardwalk = walk;
            // Half-barrel planters either side of the door, at the walk's outer edge.
            if (K.flowers || K.shopWindow)
              for (const side of [-1, 1]) MOUNTAIN_VILLAGE.planters.push({ x: b.door.x + side * Math.min(b.w * 0.36, 34), y: face + depth - 5, color: b.finish.flower });
          }
        }
        // Firewood stacked against the east wall of the houses, under the eaves.
        if (['chalet', 'house', 'cabin', 'lodge', 'station', 'tavern'].includes(b.kind)) {
          const length = Math.min(b.h * 0.5, 24);
          MOUNTAIN_VILLAGE.firewood.push({ x: b.x + b.w + 3.5, y: b.y + b.h * 0.3, w: 4.5, h: length, height: 1.4 * MV_M });
        }
        // Split-rail fence round a house's garden (inside the block, off the roads).
        if (['chalet', 'house', 'cabin'].includes(b.kind) && !b.options.name) {
          const g = 18,
            x0 = Math.max(bx + 56, b.x - g),
            x1 = Math.min(bx + 456, b.x + b.w + g),
            y0 = Math.max(by + 58, b.y - g),
            y1 = Math.min(by + 454, b.y + b.h + g + 10),
            gateHalf = 10;
          const sides = [
            [x0, y0, x1, y0],
            [x1, y0, x1, y1],
            [x0, y1, b.door.x - gateHalf, y1],
            [b.door.x + gateHalf, y1, x1, y1],
            [x0, y0, x0, y1],
          ];
          for (const [ax, ay, cx, cy] of sides) {
            if (Math.hypot(cx - ax, cy - ay) < 12) continue;
            // Every sample of the run must be clear of other buildings and the roads.
            let ok = true;
            for (let t = 0; t <= 1.0001 && ok; t += 0.1) {
              const px = ax + (cx - ax) * t,
                py = ay + (cy - ay) * t;
              if (onCountyRoad(px, py, 6) || buildings.some((o) => o !== b && px > o.x - 6 && px < o.x + o.w + 6 && py > o.y - 6 && py < o.y + o.h + 6)) ok = false;
              if (ok && mountainRoadEdge(px, py) < 6) ok = false;
            }
            if (ok) MOUNTAIN_VILLAGE.fences.push({ x0: ax, y0: ay, x1: cx, y1: cy, building: b });
          }
        }
      }
      // Lantern lamps along the kerbs, about every 20 m, clear of doors and gates.
      const kerbs = [
        [bx + 50, by + 60, bx + 50, by + 452],
        [bx + 462, by + 60, bx + 462, by + 452],
        [bx + 60, by + 50, bx + 452, by + 50],
        [bx + 60, by + 462, bx + 452, by + 462],
      ];
      for (const [ax, ay, cx, cy] of kerbs) {
        const length = Math.hypot(cx - ax, cy - ay),
          n = Math.round(length / 160);
        for (let k = 0; k <= n; k++) {
          // Push the lamp back off a wider road's kerb.
          let px = ax + ((cx - ax) * k) / n,
            py = ay + ((cy - ay) * k) / n;
          const inward = ax === cx ? [ax < bx + 256 ? 1 : -1, 0] : [0, ay < by + 256 ? 1 : -1];
          for (let step = 0; step < 4 && mountainRoadEdge(px, py) < 5; step++) {
            px += inward[0] * 6;
            py += inward[1] * 6;
          }
          if (mountainRoadEdge(px, py) < 5 || !landAt(px, py)) continue;
          if (buildings.some((o) => px > o.x - 5 && px < o.x + o.w + 5 && py > o.y - 5 && py < o.y + o.h + 5)) continue;
          if (MOUNTAIN_VILLAGE.buildings.some((o) => Math.hypot(px - o.door.x, py - o.door.y) < 24)) continue;
          if (MOUNTAIN_VILLAGE.boardwalks.some((w) => px > w.x - 3 && px < w.x + w.w + 3 && py > w.y - 3 && py < w.y + w.h + 3)) continue;
          if (inGarageLot(px, py, 6)) continue;
          const g = MOUNTAIN_VILLAGE.gas;
          if (g && px > g.x - 16 && px < g.x + g.w + 16 && py > g.y - 16 && py < g.y + g.h + 40) continue;
          // The club block lights itself (mountain-club3d.js).
          const lot = OFFROAD_CLUB.lot;
          if (px > lot.x - 8 && px < lot.x + lot.w + 8 && py > lot.y - 8 && py < lot.y + lot.h + 8) continue;
          if (MOUNTAIN_VILLAGE.lamps.some((l) => Math.hypot(l.x - px, l.y - py) < 60)) continue;
          MOUNTAIN_VILLAGE.lamps.push({ x: Math.round(px), y: Math.round(py) });
        }
      }
      // Squares: paving, the fountain or the well, benches round it, lamps at the corners, trees.
      for (const s of MOUNTAIN_VILLAGE.squares) {
        if (s.dressed || s.x < bx || s.x > bx + BLOCK_SIZE || s.y < by || s.y > by + BLOCK_SIZE) continue;
        s.dressed = true;
        for (const [dx, dy, a] of [[-1, 0, 0], [1, 0, Math.PI], [0, 1, -Math.PI / 2]]) MOUNTAIN_VILLAGE.benches.push({ x: s.cx + dx * (s.w / 2 - 22), y: s.cy + dy * (s.h / 2 - 22), a });
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) MOUNTAIN_VILLAGE.lamps.push({ x: Math.round(s.cx + dx * (s.w / 2 - 10)), y: Math.round(s.cy + dy * (s.h / 2 - 10)) });
        for (const [dx, dy] of [[-1, -1], [1, -1]]) trees.push({ x: s.cx + dx * (s.w / 2 - 32), y: s.cy + dy * (s.h / 2 - 34), r: 17, county: true, tropical: false, mountain: true });
      }
      // Trees in the back gardens and the corners: mostly conifers, a few broadleaves.
      for (let k = 0; k < 26; k++) {
        const px = bx + 70 + random() * 372,
          py = by + 70 + random() * 372,
          r = 14 + random() * 8;
        if (!mountainSpotClear(px, py, r + 8)) continue;
        if (trees.some((t) => Math.hypot(t.x - px, t.y - py) < 34)) continue;
        if (MOUNTAIN_VILLAGE.fences.some((f) => segmentDistance(px, py, [f.x0, f.y0], [f.x1, f.y1]) < 8)) continue;
        if (MOUNTAIN_VILLAGE.yards.some((y) => px > y.x - 8 && px < y.x + y.w + 8 && py > y.y - 8 && py < y.y + y.h + 8)) continue;
        if (MOUNTAIN_VILLAGE.mill && plan.special === 'mill') continue;
        if (MOUNTAIN_VILLAGE.buildings.some((o) => Math.hypot(px - o.door.x, py - o.door.y) < 40)) continue;
        if (MOUNTAIN_VILLAGE.lamps.some((l) => Math.hypot(l.x - px, l.y - py) < 16)) continue;
        trees.push({ x: px, y: py, r, county: true, pine: random() < 0.72, tropical: false, mountain: true });
      }
    }
    /* Where installCountyServices puts a town's OUTFITTERS ('guns') or LODGE
       ('sleep'): the building the plan gave that business and its door. */
    function mountainServiceSpot(town, kind) {
      if (!isMountainTown(town)) return null;
      const b = MOUNTAIN_VILLAGE.buildings.find((o) => o.town === town.name && o.options.place === kind);
      return b ? { b: { x: b.x, y: b.y, w: b.w, h: b.h }, door: { ...b.door } } : null;
    }
    // The mountain towns' rectangles (plus a margin): the random county pines keep out.
    function mountainTownBlocked(x, y, margin = 0) {
      return COUNTY_TOWNS.some((t) => isMountainTown(t) && x > t.x - margin && x < t.x + BLOCK_SIZE * 2 + margin && y > t.y - margin && y < t.y + BLOCK_SIZE * 2 + margin);
    }
    /* Colliders (addCountyColliders): vehicles hit the fountain, the well, the
       woodpiles, the fences, the gas pumps and canopy posts, the helipad's
       windsock, the log decks and lumber; people are kept off them too. */
    function mountainColliderBoxes() {
      const out = [],
        V = MOUNTAIN_VILLAGE;
      for (const s of V.squares) {
        const r = s.feature === 'fountain' ? 30 : 13;
        out.push({ x: s.cx - r, y: s.cy - r, w: r * 2, h: r * 2, height: s.feature === 'fountain' ? 16 : 24, kind: s.feature });
      }
      for (const f of V.firewood) out.push({ x: f.x - f.w / 2, y: f.y, w: f.w, h: f.h, height: f.height, kind: 'woodpile' });
      for (const f of V.fences) {
        const x = Math.min(f.x0, f.x1) - 1,
          y = Math.min(f.y0, f.y1) - 1;
        out.push({ x, y, w: Math.abs(f.x1 - f.x0) + 2, h: Math.abs(f.y1 - f.y0) + 2, height: 9, kind: 'rail' });
      }
      const g = V.gas;
      if (g) {
        for (const p of gasCanopyPosts()) out.push({ x: p.x - 2, y: p.y - 2, w: 4, h: 4, height: 44, kind: 'post' });
        for (const p of gasPumps()) out.push({ x: p.x - 7, y: p.y - 3, w: 14, h: 6, height: 14, kind: 'pump' });
      }
      const h = V.helipad;
      if (h) out.push({ x: h.x - h.size / 2 - 22, y: h.y - h.size / 2 - 2, w: 3, h: 3, height: 50, kind: 'windsock' });
      const m = V.mill;
      if (m) {
        for (const pile of millLogPiles()) out.push({ x: pile.x, y: pile.y, w: pile.w, h: pile.h, height: pile.height, kind: 'logs' });
        for (const s of millLumberStacks()) out.push({ x: s.x, y: s.y, w: s.w, h: s.h, height: s.height, kind: 'lumber' });
      }
      return out;
    }
    // The gas station's canopy: four log posts, the pumps on two islands under it.
    function gasCanopyPosts() {
      const g = MOUNTAIN_VILLAGE.gas;
      return [[g.x + 10, g.y + 12], [g.x + g.w - 10, g.y + 12], [g.x + 10, g.y + g.h - 12], [g.x + g.w - 10, g.y + g.h - 12]].map(([x, y]) => ({ x, y }));
    }
    function gasPumps() {
      const g = MOUNTAIN_VILLAGE.gas;
      return [0.3, 0.7].flatMap((u) => [{ x: g.x + g.w * u, y: g.y + g.h * 0.5 }]);
    }
    // The sawmill's log decks (rows of logs) and lumber stacks.
    function millLogPiles() {
      const L = MOUNTAIN_VILLAGE.mill.logs,
        out = [];
      for (let k = 0; k < 3; k++) out.push({ x: L.x, y: L.y + 8 + k * 54, w: L.w, h: 34, height: 3 * MV_M, rows: 5 });
      return out;
    }
    function millLumberStacks() {
      const L = MOUNTAIN_VILLAGE.mill.lumber,
        out = [];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) out.push({ x: L.x + 6 + i * 58, y: L.y + 12 + j * 66, w: 40, h: 36, height: (1.6 + ((i + j) % 3) * 0.5) * MV_M });
      return out;
    }
    function addMountainColliders() {
      for (const b of mountainColliderBoxes()) addStatic(b.x, b.y, b.w, b.h, b.height, 'village ' + b.kind);
    }
    // People keep off the same pieces (and the planters): streets.js foot obstacles.
    function addMountainFootObstacles() {
      for (const b of mountainColliderBoxes()) registerFootObstacle(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2);
      for (const p of MOUNTAIN_VILLAGE.planters) registerFootObstacle(p.x, p.y, 3.4);
      // The club: its furniture, the veranda rail and posts, the yard's fire pit, BBQ and smoker.
      for (const f of OFFROAD_CLUB.furniture) registerFootObstacle(f.x + f.w / 2, f.y + f.h / 2, f.w / 2, f.h / 2);
      const d = OFFROAD_CLUB.deck;
      for (const [x0, x1] of OFFROAD_CLUB.deckRail) registerFootObstacle((x0 + x1) / 2, d.y + d.h - 2.5, (x1 - x0) / 2, 1.2);
      for (const x of clubDeckPosts()) registerFootObstacle(x, d.y + d.h - 2.4, 1.8);
      const fire = OFFROAD_CLUB.fire;
      registerFootObstacle(fire.x, fire.y, 7);
      registerFootObstacle(OFFROAD_CLUB.grill.x, OFFROAD_CLUB.grill.y, 14, 5);
      registerFootObstacle(OFFROAD_CLUB.smoker.x, OFFROAD_CLUB.smoker.y, 5, 4);
      const pole = OFFROAD_CLUB.flag;
      registerFootObstacle(pole.x, pole.y, 1.8);
      for (const u of [OFFROAD_CLUB.gate.u0, OFFROAD_CLUB.gate.u1]) {
        const p = clubPoint(u, OFFROAD_CLUB.gate.v);
        registerFootObstacle(p.x, p.y, 3.2);
      }
    }
    /* The county sheet under a mountain town (2D view, map, the 3D ground):
       meadow blocks, gravel yards and lanes, the squares' paving; the club
       block paints itself (offroad.js). Buildings are painted afterwards by
       buildCounty in their roof colours. */
    function paintMountainTownGround(g, town) {
      g.fillStyle = '#6d7658';
      g.fillRect(town.x - 64, town.y - 64, BLOCK_SIZE * 2 + 128, BLOCK_SIZE * 2 + 128);
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const x = town.x + i * BLOCK_SIZE,
            y = town.y + j * BLOCK_SIZE;
          g.fillStyle = (i + j) % 2 ? '#667a4c' : '#6a7f4f';
          g.fillRect(x + 48, y + 48, 416, 416);
          // Worn verges along the kerbs.
          g.strokeStyle = '#8a8266';
          g.lineWidth = 8;
          g.strokeRect(x + 50, y + 50, 412, 412);
        }
      for (const y of MOUNTAIN_VILLAGE.yards) {
        if (y.x < town.x - 64 || y.x > town.x + BLOCK_SIZE * 2 + 64 || y.y < town.y - 64 || y.y > town.y + BLOCK_SIZE * 2 + 64) continue;
        g.fillStyle = y.kind === 'dirt' ? '#8a7658' : '#9d8f74';
        g.fillRect(y.x, y.y, y.w, y.h);
      }
      for (const s of MOUNTAIN_VILLAGE.squares) {
        if (s.town !== town.name) continue;
        g.fillStyle = '#a49a88';
        g.fillRect(s.x, s.y, s.w, s.h);
      }
      for (const w of MOUNTAIN_VILLAGE.boardwalks) {
        if (w.building.town !== town.name) continue;
        g.fillStyle = '#7a5f42';
        g.fillRect(w.x, w.y, w.w, w.h);
      }
      const h = MOUNTAIN_VILLAGE.helipad;
      if (h && town.name === 'NORTHRIDGE') {
        g.fillStyle = '#8c8d86';
        g.fillRect(h.x - h.size / 2, h.y - h.size / 2, h.size, h.size);
      }
      const gs = MOUNTAIN_VILLAGE.gas;
      if (gs && town.name === 'STONECREEK') {
        g.fillStyle = '#7d7d78';
        g.fillRect(gs.x - 20, gs.y - 30, gs.w + 40, gs.h + 80);
      }
    }
    /* A few vehicles that belong: the rangers' green pickup by the rescue barn,
       guests' cars in the motel court, a pickup at the pumps, the mill's truck. */
    function populateMountainVillages() {
      const park = (type, x, y, a, color) => {
        if (canSpawnCar(type, x, y, a, 4)) makeCar(type, x, y, a, false, color);
      };
      const h = MOUNTAIN_VILLAGE.helipad;
      if (h) park('pickup', h.x + 230, h.y - 110, Math.PI / 2, '#3d5a3a');
      const court = MOUNTAIN_VILLAGE.yards.find((y) => y.kind === 'gravel' && y.w === 162);
      if (court) {
        park('sedan', court.x + 40, court.y + 40, -Math.PI / 2, '#7a2a24');
        park('suv', court.x + 110, court.y + 40, -Math.PI / 2, '#d8d2c0');
      }
      const g = MOUNTAIN_VILLAGE.gas;
      if (g) park('pickup', g.x + g.w * 0.3, g.y + g.h * 0.5 + 22, 0, '#5a4632');
      const m = MOUNTAIN_VILLAGE.mill;
      if (m) park('truck', m.lumber.x + 120, m.lumber.y - 30, 0, '#6b2a24');
    }
    // Console: the villages as built (per town: buildings by kind, businesses, dressing counts).
    function mountainVillageReport() {
      const V = MOUNTAIN_VILLAGE;
      return {
        towns: MOUNTAIN_TOWN_NAMES.map((name) => {
          const list = V.buildings.filter((b) => b.town === name),
            kinds = {};
          for (const b of list) kinds[b.kind] = (kinds[b.kind] || 0) + 1;
          return {
            name,
            buildings: list.length,
            kinds,
            businesses: list.filter((b) => b.name).map((b) => ({ name: b.name, kind: b.kind, x: Math.round(b.x), y: Math.round(b.y), w: b.w, h: b.h, eavesM: +(b.eaves / MV_M).toFixed(1), ridgeM: +(b.height / MV_M).toFixed(1), door: b.door, place: b.options.place || null })),
          };
        }),
        heights: { lowestRidgeM: +(Math.min(...V.buildings.map((b) => b.height)) / MV_M).toFixed(1), highestRidgeM: +(Math.max(...V.buildings.map((b) => b.height)) / MV_M).toFixed(1) },
        snowRoofs: V.buildings.filter((b) => b.snow > 0).length,
        dressing: { boardwalks: V.boardwalks.length, lamps: V.lamps.length, benches: V.benches.length, planters: V.planters.length, firewood: V.firewood.length, fences: V.fences.length, squares: V.squares.map((s) => s.town + ' ' + s.feature), trees: trees.filter((t) => t.mountain).length },
        helipad: V.helipad,
        club: { lot: OFFROAD_CLUB.lot, house: OFFROAD_CLUB.house, workshop: OFFROAD_CLUB.workshop, walls: clubWalls().length },
        skipped: V.special.filter((s) => s.skipped),
        render: city3D && city3D.mountainInfo ? city3D.mountainInfo() : null,
      };
    }
    // END SUBSYSTEM: src/mountain-village.js
