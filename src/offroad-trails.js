    // Off-road club block and trails: layout, terrain pads, vehicle types, trail sections and surfaces (offroadSurfaceAt).
    /*
     * THE CLUB BLOCK. The club took over a whole block of Northridge (its
     * north-west block, where Eagle Pass comes down from the trailhead into the
     * town): the block's own kerbs bound the lot. Lot-local u runs east and v
     * south from the lot's north-west corner (map 8464, 2654):
     *
     *   north   the CLUBHOUSE (a two-storey stone-and-log lodge, 27.5 x 16.8 m)
     *           and, sharing its east wall, the WORKSHOP bay (10.8 x 18.5 m,
     *           a 7 m barn door, a two-post lift); a covered veranda across the
     *           clubhouse front with the balcony over it;
     *   west    the members' yard: a stone fire pit ringed with log benches and
     *           Adirondack chairs, the stone BBQ and smoker, string lights;
     *   south   the gravel lot: five trucks nose-out in a row, the 6x6 and the
     *           members' own rigs in the second row, the trophy truck parked on
     *           show by the gate; a log rail round it, the timber gate with the
     *           carved 4X4 CLUB sign facing the avenue (the hill climb is armed
     *           there), the flag.
     *
     * Walking in and out: the clubhouse and the workshop are real rooms, their
     * walls thin buildings (clubWalls), their doors gaps in them. Inside, the
     * renderer lifts the roof and the upper storey off (the cutaway).
     */
    const OFFROAD_CLUB = {
      name: 'RIDGELINE 4X4 CLUB',
      town: 'NORTHRIDGE',
      // The whole block inside its kerbs (map units): Northridge block (0, 0).
      lot: { x: 8464, y: 2654, w: 424, h: 408 },
      trail: 0,
    };
    // Lot-local (u east, v south from the lot's north-west corner) to map.
    function clubPoint(u, v) {
      return { x: OFFROAD_CLUB.lot.x + u, y: OFFROAD_CLUB.lot.y + v };
    }
    // A lot-local rectangle as a map rectangle.
    function clubRect(u0, v0, u1, v1) {
      const a = clubPoint(u0, v0);
      return { x: a.x, y: a.y, w: u1 - u0, h: v1 - v0 };
    }
    Object.assign(OFFROAD_CLUB, {
      // Buildings (map rectangles, outer faces).
      house: clubRect(106, 12, 326, 146),
      workshop: clubRect(326, 12, 412, 160),
      // The covered veranda across the clubhouse front (a low plank deck).
      deck: clubRect(96, 146, 326, 190),
      wall: 3,
      // Door gaps [x0, x1] or [y0, y1] along each wall, map units.
      doors: {
        front: [8670, 8690], // the clubhouse's double doors onto the veranda
        yard: [2775, 2791], // west wall, to the fire pit
        inner: [2750, 2766], // clubhouse / workshop
        barn: [8805, 8861], // the workshop's barn door (7 m)
      },
      // The timber gate in the south rail, the carved sign on its beam facing
      // the avenue: E there arms the hill climb.
      gate: { u0: 74, u1: 178, v: 401 },
      sign: clubPoint(126, 401),
      grill: clubPoint(38, 40),
      smoker: clubPoint(62, 34),
      cooler: clubPoint(22, 58),
      flag: clubPoint(20, 206),
      fire: clubPoint(50, 124),
      // Seven slots: [u, v, type, colour]. Five nose-out in the front row (the
      // camera sees the fronts), the 6x6 in the second, the trophy truck on show.
      slots: [
        [211, 251, 'series', '#c9b27a'],
        [256, 251, 'crawler', '#e8672a'],
        [301, 251, 'bronco', '#2e8b91'],
        [346, 251, 'expedition', '#d7c9a6'],
        [391, 251, 'hilux', '#eeeeea'],
        [256, 346, 'sixbysix', '#7d7556'],
        [41, 276, 'trophy', '#f1c232'],
      ],
      heading: Math.PI / 2 - 0.42,
      // The members' own rigs in the second row: [u, v, type, colour, heading].
      memberCars: [
        [316, 346, 'pickup', '#6d2a22', Math.PI / 2 - 0.42],
        [376, 346, 'suv', '#2f3e36', Math.PI / 2 - 0.42],
      ],
      // Where the log rail runs (vehicles only): lot-local segments; the gate
      // is the gap in the south run.
      rails: [
        [0, 6, 0, 404],
        [0, 404, 74, 404],
        [178, 404, 424, 404],
        [424, 160, 424, 404],
        [0, 6, 100, 6],
      ],
      // The members and what they do there: [u, v, facing, role, dress].
      members: [
        // Inside: the bartender, two at the bar, a game of pool, two on the couches.
        [252, 36, Math.PI / 2, 'clubGrill', 'worker'],
        [226, 58, -Math.PI / 2, 'clubChat', 'casual'],
        [246, 58, -Math.PI / 2 - 0.3, 'clubChat', 'tourist'],
        [178, 96, 0.4, 'clubArms', 'casual'],
        [154, 110, -2.6, 'clubChat', 'worker'],
        [141, 70, Math.PI, 'clubSit', 'casual'],
        [140, 110, -Math.PI / 2, 'clubSit', 'tourist'],
        // On the veranda.
        [150, 172, Math.PI / 2 + 0.3, 'clubSit', 'casual'],
        [196, 170, Math.PI / 2 - 0.4, 'clubSit', 'tourist'],
        [174, 178, -2.4, 'clubChat', 'worker'],
        // Round the fire pit, at the BBQ, in the workshop.
        [34, 118, 0.2, 'clubSit', 'casual'],
        [64, 140, -2.2, 'clubSit', 'worker'],
        [44, 54, -Math.PI / 2, 'clubGrill', 'worker'],
        [360, 118, Math.PI, 'clubArms', 'worker'],
      ],
    });
    /* Inside and on the veranda (map rectangles, kept clear by walkers; the
       renderer furnishes them): the stone fireplace on the west wall, the two
       leather couches facing it, the bar along the north wall with the back bar
       behind it, two pool tables, and in the workshop the lift's posts, the
       bench and the tool chests. The veranda rail runs along the deck's front
       with steps to the lot in front of the doors and to the yard at the west end. */
    Object.assign(OFFROAD_CLUB, {
      furniture: [
        { kind: 'fireplace', ...clubRect(109, 56, 121, 96) },
        // Its stone chimney stack stands outside the west wall, up the gable.
        { kind: 'chimney', ...clubRect(96, 50, 106, 100) },
        { kind: 'couch', ...clubRect(139, 61, 147, 91), facing: Math.PI },
        { kind: 'couch', ...clubRect(126, 106, 156, 114), facing: -Math.PI / 2 },
        { kind: 'bar', ...clubRect(206, 42, 296, 50) },
        { kind: 'backbar', ...clubRect(216, 15, 306, 21) },
        { kind: 'pool', ...clubRect(181, 100, 201, 112) },
        { kind: 'pool', ...clubRect(256, 100, 276, 112) },
        { kind: 'lift', ...clubRect(345, 88, 349, 92) },
        { kind: 'lift', ...clubRect(373, 88, 377, 92) },
        { kind: 'bench', ...clubRect(400, 40, 409, 104) },
        { kind: 'chest', ...clubRect(330, 20, 342, 34) },
      ],
      // Veranda rail runs along the deck's front edge (map x ranges), steps between them.
      deckRail: [
        [8574, 8664],
        [8696, 8786],
      ],
    });
    /* The clubhouse's and the workshop's walls as thin buildings (solid to people
       and vehicles, door gaps left open): [x, y, w, h, height]. */
    function clubWalls() {
      const H = OFFROAD_CLUB.house,
        S = OFFROAD_CLUB.workshop,
        D = OFFROAD_CLUB.doors,
        t = OFFROAD_CLUB.wall,
        houseTop = 7.2 * OFFROAD_M,
        shopTop = 6.8 * OFFROAD_M,
        walls = [];
      const run = (x0, y0, x1, y1, height, gap) => {
        // A wall from (x0, y0) to (x1, y1), horizontal or vertical, minus the gap.
        const along = y0 === y1,
          a = along ? x0 : y0,
          b = along ? x1 : y1,
          pieces = gap ? [[a, gap[0]], [gap[1], b]] : [[a, b]];
        for (const [p, q] of pieces) {
          if (q - p < 1) continue;
          walls.push(along ? { x: p, y: y0, w: q - p, h: t, height } : { x: x0, y: p, w: t, h: q - p, height });
        }
      };
      // Clubhouse: north, west (yard door), south (front doors); its east wall is shared.
      run(H.x, H.y, H.x + H.w + t, H.y, houseTop);
      run(H.x, H.y + t, H.x, H.y + H.h - t, houseTop, D.yard);
      run(H.x, H.y + H.h - t, H.x + H.w, H.y + H.h - t, houseTop, D.front);
      run(S.x, H.y + t, S.x, S.y + S.h, houseTop, D.inner);
      // Workshop: north, east, south (the barn door).
      run(S.x + t, S.y, S.x + S.w, S.y, shopTop);
      run(S.x + S.w - t, S.y + t, S.x + S.w - t, S.y + S.h - t, shopTop);
      run(S.x + t, S.y + S.h - t, S.x + S.w, S.y + S.h - t, shopTop, D.barn);
      return walls;
    }
    // The old lot across Eagle Pass from the Mount Ascent trailhead is a small
    // trailhead car park now (three bays, a log rail, the trail board).
    const TRAILHEAD_PARKING = { x: 7470, y: 2046, w: 170, h: 84 };
    function offroadTerrainPads() {
      const p = TRAILHEAD_PARKING;
      return [{ x: p.x - 10, y: p.y - 10, w: p.w + 20, h: p.h + 20 }];
    }
    // Inside the club block or the trailhead car park (plus a margin): county
    // trees and scenery keep out.
    function offroadClubBlocked(x, y, margin = 0) {
      for (const l of [OFFROAD_CLUB.lot, TRAILHEAD_PARKING])
        if (x > l.x - margin && x < l.x + l.w + margin && y > l.y - margin && y < l.y + l.h + margin) return true;
      return false;
    }
    /* ---- The club's trucks ------------------------------------------------------------
       Real dimensions (metres x UNITS_PER_METRE), kerb masses, performance.
       `tyre`: mud-terrain 'mt', all-terrain 'at', 'desert' racing tyres;
       `drive`: '4x4' or 'rwd'; `lowRange`: a transfer case; `travel`: suspension
       travel against an ordinary SUV (rough ground speed); `clubModel`: the body
       offroad3d.js builds. */
    const OFFROAD_M = UNITS_PER_METRE;
    const OFFROAD_TYPES = {
      series: {
        name: 'ROVER SERIES III SAFARI',
        l: 4.45 * OFFROAD_M,
        w: 1.68 * OFFROAD_M,
        topKmh: 110,
        zeroTo: [80, 19],
        brakeG: 0.65,
        cornerG: 0.75,
        tractionG: 0.5,
        turn: 1.75,
        hp: 220,
        mass: 1.75,
        grip: 5.5,
        balance: -0.5,
        tyre: 'mt',
        drive: '4x4',
        lowRange: 0.75,
        travel: 1.05,
        color: '#c9b27a',
      },
      crawler: {
        name: 'BADGER RUBICON CRAWLER',
        l: 4.33 * OFFROAD_M,
        w: 2.0 * OFFROAD_M,
        topKmh: 150,
        zeroTo: [100, 10.8],
        brakeG: 0.85,
        cornerG: 0.85,
        tractionG: 0.62,
        turn: 2.1,
        hp: 240,
        mass: 2.1,
        grip: 6,
        balance: -0.3,
        tyre: 'mt',
        drive: '4x4',
        lowRange: 0.95,
        lockers: true,
        travel: 1.3,
        color: '#e8672a',
      },
      bronco: {
        name: 'MUSTANG RIDGE BRONCO',
        l: 4.2 * OFFROAD_M,
        w: 1.86 * OFFROAD_M,
        topKmh: 155,
        zeroTo: [100, 9.8],
        brakeG: 0.85,
        cornerG: 0.9,
        tractionG: 0.62,
        turn: 2.0,
        hp: 230,
        mass: 2.05,
        grip: 6,
        balance: -0.3,
        tyre: 'at',
        drive: '4x4',
        lowRange: 0.8,
        travel: 1.1,
        color: '#2e8b91',
      },
      expedition: {
        name: 'HIGHLANDER 70 EXPEDITION',
        l: 5.22 * OFFROAD_M,
        w: 1.94 * OFFROAD_M,
        topKmh: 150,
        zeroTo: [100, 15.5],
        brakeG: 0.8,
        cornerG: 0.82,
        tractionG: 0.5,
        turn: 1.65,
        hp: 300,
        mass: 2.75,
        grip: 6,
        balance: -0.5,
        tyre: 'mt',
        drive: '4x4',
        lowRange: 0.85,
        lockers: true,
        travel: 1.1,
        color: '#d7c9a6',
      },
      hilux: {
        name: 'TAURO HX35 ARCTIC',
        l: 5.33 * OFFROAD_M,
        w: 1.94 * OFFROAD_M,
        topKmh: 175,
        zeroTo: [100, 10.5],
        brakeG: 0.9,
        cornerG: 0.95,
        tractionG: 0.6,
        turn: 1.75,
        hp: 260,
        mass: 2.2,
        grip: 6,
        balance: -0.4,
        tyre: 'at',
        drive: '4x4',
        lowRange: 0.8,
        travel: 1.15,
        color: '#eeeeea',
      },
      sixbysix: {
        name: 'OKTAV 6×6 EXPEDITION',
        l: 5.87 * OFFROAD_M,
        w: 2.11 * OFFROAD_M,
        topKmh: 160,
        zeroTo: [100, 7.8],
        brakeG: 0.85,
        cornerG: 0.8,
        tractionG: 0.6,
        turn: 1.45,
        hp: 420,
        mass: 3.85,
        grip: 7,
        balance: -0.6,
        tyre: 'mt',
        drive: '4x4',
        lowRange: 0.9,
        lockers: true,
        travel: 1.2,
        axles: 3,
        color: '#7d7556',
      },
      trophy: {
        name: 'SIDEWINDER TROPHY TRUCK',
        l: 5.8 * OFFROAD_M,
        w: 2.24 * OFFROAD_M,
        topKmh: 210,
        zeroTo: [100, 5.4],
        brakeG: 0.95,
        cornerG: 1.05,
        tractionG: 0.8,
        turn: 1.9,
        hp: 280,
        mass: 2.75,
        grip: 7,
        balance: 0.3,
        tyre: 'desert',
        // A modern four-wheel-drive trophy truck (no low range: it is built for speed).
        drive: '4x4',
        travel: 1.9,
        color: '#f1c232',
      },
    };
    for (const [type, spec] of Object.entries(OFFROAD_TYPES)) {
      spec.offroad = true;
      spec.clubModel = type;
      // Built at real size (offroad3d.js): drawn at scale 1.
      spec.modelScale = 1;
      VEHICLE_DEFINITIONS[type] = spec;
      roadPerformance(spec);
    }
    // Their engines (engine-audio.js): diesels in the working trucks, V8s in the toys.
    Object.assign(ENGINE_OF_TYPE, {
      series: ['compact', 0.74, 1.05],
      crawler: ['v8', 1.06, 0.95],
      bronco: ['v8', 0.96, 1.05],
      expedition: ['diesel', 1.3, 0.85],
      hilux: ['diesel', 1.38, 0.8],
      sixbysix: ['v8', 1.12, 1.1],
      trophy: ['v8', 0.9, 1.25],
    });
    /* ---- Trail sections -------------------------------------------------------------
       Along each trail (fractions of its length): the mud, the set pieces and the
       hill climb's checkpoints. */
    const OFFROAD_SECTIONS = [
      {
        // MOUNT ASCENT
        mudTo: 0.58,
        patches: [
          { name: 'THE BOG', from: 0.13, to: 0.21, depth: 1 },
          { name: 'MUDDY HAIRPIN', hairpin: 2, reach: 70, depth: 0.8 },
        ],
        rocks: [{ name: 'ROCK STEPS', from: 0.66, to: 0.74 }],
        checkpoints: [0.24, 'hairpin:2', 0.77],
        target: 150,
      },
      {
        // NEEDLE RIDGE
        mudTo: 0.5,
        patches: [{ name: 'SPRING CROSSING', from: 0.2, to: 0.27, depth: 0.9 }],
        rocks: [{ name: 'NEEDLE STEPS', from: 0.78, to: 0.85 }],
        checkpoints: [0.3, 0.6, 0.88],
        target: 150,
      },
    ];
    // Distance along a trail's graded path (in path samples) of a section mark.
    function trailMarkIndex(trail, mark) {
      const n = trail.path.length - 1;
      if (typeof mark === 'number') return Math.round(mark * n);
      const k = +String(mark).split(':')[1],
        [hx, hy] = trail.hairpins[k];
      let best = 0;
      for (let i = 1; i <= n; i++)
        if (Math.hypot(trail.path[i][0] - hx, trail.path[i][1] - hy) < Math.hypot(trail.path[best][0] - hx, trail.path[best][1] - hy)) best = i;
      // Just past the turn.
      return Math.min(n, best + 6);
    }
    /* ---- Baked mud and rock -----------------------------------------------------------
       Called by generateTerrainField once the trails are carved, with, per vertex,
       the distance to the nearest trail carriageway (`near`, hairpin pads counted),
       the nearest path sample and which trail. */
    function offroadTrailBake(field, heights, near, segment, owner) {
      const count = field.cols * field.rows,
        mud = new Float32Array(count),
        rock = new Float32Array(count),
        across = new Float32Array(count).fill(9),
        seg = new Int16Array(count).fill(-1),
        which = new Int8Array(count).fill(-1),
        { cols, x0, y0, seed } = field;
      for (let i = 0; i < count; i++) {
        const t = owner[i] - 1;
        if (t < 0) continue;
        const trail = MOUNTAIN_TRAILS[t],
          sections = OFFROAD_SECTIONS[t],
          half = trail.width / 2,
          a = near[i] / half,
          s = segment[i],
          n = trail.path.length - 1,
          frac = s / n,
          c = i % cols,
          r = (i - c) / cols,
          x = x0 + c * TERRAIN_CELL,
          y = y0 + r * TERRAIN_CELL;
        across[i] = Math.min(9, a);
        seg[i] = s;
        which[i] = t;
        if (!sections || a > 2.6) continue;
        // Damp forest on the lower switchbacks: mud in patches, drying out with height.
        const patchy = terrainFbm(x / 70, y / 70, 3, seed + 900) * 0.5 + 0.5;
        let m = (1 - smoothStep(sections.mudTo - 0.08, sections.mudTo + 0.04, frac)) * smoothStep(0.02, 0.06, frac) * (0.25 + 0.55 * patchy);
        for (const p of sections.patches) {
          let w;
          if (p.hairpin !== undefined) {
            const [hx, hy] = trail.hairpins[p.hairpin];
            w = 1 - smoothStep(p.reach * 0.6, p.reach, Math.hypot(x - hx, y - hy));
          } else w = smoothStep(p.from - 0.02, p.from + 0.01, frac) * (1 - smoothStep(p.to - 0.01, p.to + 0.02, frac));
          m = Math.max(m, w * p.depth * (0.85 + 0.15 * patchy));
        }
        // The ruts hold the deepest mud; the crown between them and the edges are firmer.
        const rut = Math.exp(-(((a - 0.34) / 0.16) ** 2)),
          edge = smoothStep(0.62, 1.0, a);
        m *= (0.72 + 0.28 * rut) * (1 - 0.45 * edge);
        // Past the carriageway the mud thins out over the shoulders.
        m *= 1 - smoothStep(1.05, 2.4, a);
        // None on the level approach beside the road (the county sheet, no terrain drawn).
        m *= smoothStep(0.5, 5, heights[i]);
        let k = 0;
        for (const b of sections.rocks) k = Math.max(k, smoothStep(b.from - 0.01, b.from + 0.005, frac) * (1 - smoothStep(b.to - 0.005, b.to + 0.01, frac)));
        k *= 1 - smoothStep(1.0, 1.4, a);
        rock[i] = k;
        mud[i] = clamp(m * (1 - k), 0, 1);
      }
      Object.assign(field, { mudField: mud, rockField: rock, trailAcross: across, trailSeg: seg, trailOwner: which });
    }
    /* The surface under a point (bilinear mud, nearest-vertex trail data),
       written into `out` (no allocation). */
    function offroadSurfaceAt(x, y, out) {
      const f = terrainFieldAt(x, y);
      out.mud = 0;
      out.rock = 0;
      out.across = 9;
      out.seg = -1;
      out.trail = -1;
      if (!f || !f.ready || !f.mudField) return out;
      const lx = (x - f.x0) / TERRAIN_CELL,
        ly = (y - f.y0) / TERRAIN_CELL;
      if (lx < 0 || ly < 0 || lx >= f.nx || ly >= f.ny) return out;
      const c = Math.floor(lx),
        r = Math.floor(ly),
        u = lx - c,
        v = ly - r,
        i = r * f.cols + c,
        m = f.mudField;
      out.mud = (m[i] * (1 - u) + m[i + 1] * u) * (1 - v) + (m[i + f.cols] * (1 - u) + m[i + f.cols + 1] * u) * v;
      const k = Math.round(ly) * f.cols + Math.round(lx);
      out.rock = f.rockField[k];
      out.across = f.trailAcross[k];
      out.seg = f.trailSeg[k];
      out.trail = f.trailOwner[k];
      return out;
    }
    /* ---- Traction -------------------------------------------------------------------- */
    // Tyre against surface: [packed dirt, mud, rock].
    const OFFROAD_TYRES = {
      mt: [1, 1, 1],
      at: [0.97, 0.82, 0.95],
      desert: [1.02, 0.78, 0.9],
      track: [1.15, 1.1, 1.1],
      road: [0.82, 0.46, 0.86],
      // The KR 500's knobblies (cars' `tyre: 'knobby'`): the best of all on dirt and mud.
      knobby: [1.12, 1.08, 0.98],
    };
    function offroadTyre(spec) {
      return OFFROAD_TYRES[spec.tyre || (spec.tank ? 'track' : spec.offroad ? 'at' : 'road')];
    }
    // Share of the vehicle's weight on driven wheels on a grade (positive: climbing).
    // Which wheels the city's own cars drive (the rest are rear-driven, or 4x4 if `offroad`).
    for (const [type, drive] of Object.entries({ sedan: 'fwd', coupe: 'fwd', taxi: 'fwd', van: 'fwd', rally: '4x4', supercar: '4x4' }))
      if (VEHICLE_DEFINITIONS[type] && !VEHICLE_DEFINITIONS[type].drive) VEHICLE_DEFINITIONS[type].drive = drive;
    function drivenShare(spec, grade) {
      // A motorbike puts most of itself on the driven rear wheel under power.
      if (spec.bike && !spec.bicycle) return clamp(0.78 + grade * 0.4, 0.55, 0.95);
      const drive = spec.drive || (spec.offroad || spec.tank ? '4x4' : 'rwd');
      if (drive === '4x4') return 1;
      if (drive === 'fwd') return clamp(0.6 - grade * 0.6, 0.3, 0.7);
      return clamp(0.45 + grade * 0.6, 0.3, 0.72);
    }
    const offroadSurface = { mud: 0, rock: 0, across: 9, seg: -1, trail: -1 },
      offroadStep = { acceleration: 0, grip: 1, lateral: 1 };
    /*
     * One physics step of a road vehicle on the range: `acceleration` is what the
     * controls ask for along the heading (engine, brakes, coasting); returns the
     * tyre force the ground can give (offroadStep, reused), and applies gravity.
     */
    function offroadDrive(c, spec, t, acceleration, along, stepSeconds) {
      const s = offroadSurfaceAt(c.x, c.y, offroadSurface),
        wet = clamp(weather.wet || 0, 0, 1),
        tyre = offroadTyre(spec),
        slope2 = t.slope.x * t.slope.x + t.slope.y * t.slope.y,
        cn = 1 / Math.sqrt(1 + slope2),
        onTrail = s.across < 1.15;
      // Surface friction: packed dirt (grass and scree off the trail), mud, rock.
      const dirt = onTrail ? 0.68 : 0.58,
        muMud = 0.68 - 0.36 * s.mud - 0.13 * wet * s.mud - 0.05 * wet,
        surfaceMu = Math.max(0.12, s.rock > 0.5 ? 0.8 : s.mud > 0.02 ? Math.min(dirt, muMud) : dirt - 0.05 * wet),
        tyreMu = surfaceMu * (s.rock > 0.5 ? tyre[2] : tyre[0] + (tyre[1] - tyre[0]) * clamp(s.mud * 1.6, 0, 1)) * (spec.lockers && (s.rock > 0.5 || s.mud > 0.4) ? 1.08 : 1),
        grade = t.along,
        share = drivenShare(spec, grade),
        tractionLimit = tyreMu * share * GRAVITY * cn,
        speed = Math.abs(along),
        kmh = speed / KMH;
      // Low range: the transfer case's reduction multiplies the pull at crawling speed.
      c.lowRange = !!spec.lowRange && kmh < 35 && (acceleration > 0 || kmh < 20);
      let demand = acceleration;
      if (c.lowRange && acceleration > 0) demand = Math.max(acceleration, spec.lowRange * GRAVITY * (1 - kmh / 45));
      let force = demand,
        spin = 0;
      // Driving (forward, or reverse from a crawl) is limited by the driven wheels;
      // braking by all four.
      const driving = demand > 0 || (demand < 0 && along < 10);
      if (driving && Math.abs(demand) > tractionLimit) {
        // More than the tyres can take: they spin, and sliding rubber grips less.
        spin = 1 - tractionLimit / Math.abs(demand);
        force = Math.sign(demand) * tractionLimit * (1 - 0.22 * spin);
      } else if (demand < 0 && !driving) {
        // Brakes (and engine braking) act on all four wheels.
        const brakeLimit = tyreMu * GRAVITY * cn;
        force = Math.max(demand, -brakeLimit);
      }
      // Rolling resistance: the tyres sink into mud (heavier trucks further).
      const sink = (spec.tyre ? 1 : 1.3) * (0.05 + 0.012 * (spec.mass || 1.5)),
        rolling = (0.012 + s.mud * sink + (onTrail ? 0 : 0.025)) * GRAVITY;
      force -= Math.sign(along) * Math.min(speed / stepSeconds, rolling);
      // Rough ground above what the suspension soaks up: bounces, a scrub, a jolt.
      const travel = spec.travel || (spec.offroad ? 1 : 0.6),
        roughness = s.rock > 0.5 ? 1 : onTrail ? 0.3 + 0.25 * s.mud : 0.85,
        roughKmh = (18 + 24 * travel) / (0.4 + roughness),
        excess = kmh / roughKmh - 1;
      if (excess > 0) {
        force -= Math.sign(along) * Math.min(speed / stepSeconds, excess * 0.25 * GRAVITY);
        if (!c.hop && Math.random() < stepSeconds * (1 + excess * 6)) {
          c.hop = { z: 0, vz: clamp(10 + excess * 30 + kmh * 0.2, 10, 60), pitch: 0, vp: (Math.random() - 0.4) * 2.2, roll: 0, vr: (Math.random() - 0.5) * 2.2 };
          if (c === player.car) shake = Math.max(shake, clamp(excess * 2.5, 0.4, 2.5));
          if (excess > 0.8 && !spec.offroad) damageVehicle(c, excess * 2.2, c.x, c.y);
        }
      }
      // Rock steps: a ledge every three metres.
      if (s.rock > 0.5 && s.seg >= 0) {
        const ledge = s.seg >> 1;
        if (c.ledge !== ledge) {
          c.ledge = ledge;
          if (kmh > 6) {
            c.hop = { z: 0, vz: clamp(8 + kmh * 0.9, 8, 55), pitch: 0, vp: (along > 0 ? -1 : 1) * clamp(kmh / 12, 0.4, 2.4), roll: 0, vr: (Math.random() - 0.5) * 1.4 };
            const scrub = clamp((kmh - 8) / 70, 0, 0.3) / (spec.travel || 1);
            c.vx *= 1 - scrub;
            c.vy *= 1 - scrub;
            if (kmh > 30) damageVehicle(c, (kmh - 30) * (spec.offroad ? 0.25 : 0.6), c.x, c.y);
            if (c === player.car) shake = Math.max(shake, clamp(kmh / 15, 0.5, 3));
          }
        }
      }
      // Standing still with no throttle: the brakes hold up to the tyres' grip;
      // on anything steeper the truck slides back down.
      const gravityAlong = -GRAVITY * grade * cn;
      if (Math.abs(acceleration) < 0.05 * GRAVITY && speed < 2 * KMH && !c.ai) {
        const hold = tyreMu * GRAVITY * cn;
        force = clamp(-gravityAlong - along / stepSeconds, -hold, hold);
      }
      // Gravity along the ground (the tyres cancel the part across the car).
      c.vx -= t.slope.x * GRAVITY * cn * stepSeconds;
      c.vy -= t.slope.y * GRAVITY * cn * stepSeconds;
      // What the wheels do: spinning ahead of the ground, or rolling with it.
      c.wheelSpin += (spin - c.wheelSpin) * Math.min(1, stepSeconds * (spin > c.wheelSpin ? 10 : 4));
      c.spinSpeed = c.wheelSpin * (55 + speed * 0.7) * (c.lowRange ? 0.8 : 1.2);
      c.surfaceMud = s.mud;
      c.surfaceRock = s.rock;
      offroadStep.acceleration = force;
      // Sideways grip follows the same friction.
      offroadStep.grip = clamp(tyreMu / 0.85, 0.25, 1);
      offroadStep.lateral = clamp(tyreMu / 0.8, 0.3, 1) * (spin > 0.4 ? 0.7 : 1);
      t.limit = roughKmh * 1.6 * KMH;
      return offroadStep;
    }
    // Off the range: wheels roll with the ground again.
    function offroadRoll(c, stepSeconds) {
      if (c.wheelSpin) c.wheelSpin = Math.max(0, c.wheelSpin - stepSeconds * 4);
      c.spinSpeed = c.wheelSpin * 50;
      c.surfaceMud = 0;
      c.surfaceRock = 0;
      c.lowRange = false;
    }
    /* ---- Body mud ------------------------------------------------------------------- */
    // Stream points on a coarse grid, for washing a truck driven through one.
    let streamGrid = null;
    function streamWaterAt(x, y) {
      if (!streamGrid) {
        streamGrid = new Map();
        for (const line of terrainStreams())
          for (const [px, py, , width] of line) {
            const key = Math.floor(px / 64) * 4096 + Math.floor(py / 64);
            if (!streamGrid.has(key)) streamGrid.set(key, []);
            streamGrid.get(key).push(px, py, width);
          }
      }
      const list = streamGrid.get(Math.floor(x / 64) * 4096 + Math.floor(y / 64));
      if (!list) return false;
      for (let i = 0; i < list.length; i += 3) if (Math.hypot(x - list[i], y - list[i + 1]) < list[i + 2] * 0.8 + 6) return true;
      return false;
    }
    function updateBodyMud(c, deltaSeconds) {
      const speed = Math.abs(c.speed || 0),
        wet = weather.wet || 0;
      let gain = 0;
      if (c.surfaceMud > 0.05) gain = c.surfaceMud * (0.01 + 0.00035 * speed + 0.07 * c.wheelSpin);
      else if (c.offroadState && speed > 20) gain = 0.0015 * (1 - wet) * (c.mudCoat < 0.3 ? 1 : 0);
      if (gain > 0) {
        c.mudCoat = Math.min(1, c.mudCoat + gain * deltaSeconds);
        if (c.surfaceMud > 0.05) c.mudWet = Math.min(1, c.mudWet + deltaSeconds * 0.8);
      }
      if (c.mudCoat <= 0) return;
      // Rain rinses it slowly; driving through water fast.
      let wash = (weather.rain || 0) * 0.01;
      if (speed > 10 && (!landAt(c.x, c.y) || (c.offroadState && streamWaterAt(c.x, c.y)))) wash += 0.3;
      c.mudCoat = Math.max(0, c.mudCoat - wash * deltaSeconds);
      // Fresh mud is dark and glossy; it dries pale in a minute or two unless it rains.
      c.mudWet = clamp(c.mudWet + deltaSeconds * (wet > 0.3 ? 0.1 : -1 / 90), 0, 1);
    }
