    // BEGIN SUBSYSTEM: src/offroad.js — The 4x4 club, trail mud, off-road traction and the hill climb
    /**
     * The 4x4 club, trail mud, off-road traction and the hill climb
     * Source: src/offroad.js
     * Scope: shared game closure (included right after terrain.js).
     *
     * RIDGELINE 4X4 CLUB (OFFROAD_CLUB): a gravel lot cut into the foot of Mount
     * Ascent across Eagle Pass from the trailhead. Its pad is flattened in the
     * height field itself (offroadTerrainPads, read by generateTerrainField), so
     * the ground, the colliders and the picture agree. Seven club trucks stand in
     * a herringbone row (OFFROAD_TYPES: real dimensions, masses and performance,
     * added to VEHICLE_DEFINITIONS; offroad3d.js builds their models), with a
     * canopy, chairs, a cooler, a smoking grill, a flag, string lights and a
     * handful of members who talk shop (a crowd scene, `kind: 'club'`).
     *
     * TRAIL MUD: every vertex of a trail carries a mud and a rock amount
     * (offroadTrailBake, from the trail's own distance along and across): the
     * lower switchbacks run through damp forest and are muddy dirt, with a bog,
     * a muddy hairpin and rocky steps as set pieces (OFFROAD_SECTIONS). Ruts in
     * the middle hold the deepest mud; the crown and the edges are firmer, so the
     * line matters. Rain (weather.wet) makes all of it slicker.
     *
     * TRACTION (offroadDrive, called by physics.js for any road vehicle on the
     * range): the tyres can push at most mu x the load on the driven wheels.
     * mu comes from the surface (packed dirt 0.68, mud down to ~0.3, wet mud
     * lower, rock 0.8) and the tyre (mud-terrain, all-terrain, desert, road);
     * the driven share is 1 for 4x4, about half for two-wheel drive (the load
     * shifts to the rear on a climb). Asking the tyres for more spins them: the
     * wheel speed runs ahead of the ground speed (c.wheelSpin, c.spinSpeed, drawn
     * and heard) and the grip left is the lower sliding friction. Low range
     * (club trucks under 35 km/h) multiplies the pull. With no throttle the
     * brakes hold the truck up to the same friction; past it the truck slides
     * back down. Mud also costs rolling resistance, and rough ground above a
     * vehicle's suspension speed bounces it about. A road car spins its wheels
     * in the first mud; a 4x4 climbs, but the wet bog and the muddy hairpin need
     * momentum and a line out of the ruts.
     *
     * BODY MUD (c.mudCoat 0..1, c.mudWet): builds up from mud thrown by the
     * tyres, washes off in rain and in water (the sea, lakes, the streams).
     *
     * HILL CLIMB: crossing the start gate at a trailhead starts the clock; the
     * checkpoints are counted in order and the summit shows SUMMIT REACHED with
     * the time and the best clean run (localStorage `dead-end-city-hillclimb`).
     * E at the club sign in a vehicle arms the challenge: beat 2:30 on Mount
     * Ascent for $1,000.
     */
    const OFFROAD_CLUB = {
      name: 'RIDGELINE 4X4 CLUB',
      // The gravel pad (map units), across Eagle Pass from the Mount Ascent trailhead.
      lot: { x: 7410, y: 2034, w: 290, h: 160 },
      trail: 0,
    };
    // Lot-local (u east, v south from the pad's north-west corner) to map.
    function clubPoint(u, v) {
      return { x: OFFROAD_CLUB.lot.x + u, y: OFFROAD_CLUB.lot.y + v };
    }
    Object.assign(OFFROAD_CLUB, {
      // The sign stands at the north-west corner facing the lot and the road.
      sign: clubPoint(40, 14),
      canopy: { ...clubPoint(118, 122), size: 26 },
      grill: clubPoint(170, 128),
      cooler: clubPoint(98, 138),
      flag: clubPoint(18, 146),
      fire: clubPoint(222, 136),
      // Seven slots in a herringbone row along the north edge, noses south-east
      // (the camera sees the fronts): [u, v, type, colour].
      slots: [
        [30, 44, 'series', '#c9b27a'],
        [70, 46, 'crawler', '#e8672a'],
        [110, 48, 'bronco', '#2e8b91'],
        [152, 50, 'expedition', '#d7c9a6'],
        [196, 52, 'hilux', '#eeeeea'],
        [240, 54, 'sixbysix', '#7d7556'],
        [270, 104, 'trophy', '#f1c232'],
      ],
      heading: Math.PI / 2 - 0.42,
      // Where the log rail runs (open along the road side, a gap to the east).
      rails: [
        [0, 0, 0, 160],
        [0, 160, 290, 160],
        [290, 160, 290, 72],
        [0, 0, 14, 0],
      ],
      // The members and what they do there: [u, v, facing, role, dress].
      members: [
        [164, 116, 1.9, 'clubGrill', 'worker'],
        [186, 132, 3.3, 'clubChat', 'casual'],
        [206, 126, 0.55, 'clubSit', 'casual'],
        [236, 148, -2.3, 'clubSit', 'tourist'],
        [96, 76, -1.2, 'clubChat', 'casual'],
        [110, 74, 2.6, 'clubArms', 'worker'],
        [234, 118, 2.2, 'clubChat', 'tourist'],
      ],
    });
    function offroadTerrainPads() {
      const l = OFFROAD_CLUB.lot;
      return [{ x: l.x - 10, y: l.y - 10, w: l.w + 20, h: l.h + 20 }];
    }
    // Inside the lot (plus a margin): county trees and scenery keep out.
    function offroadClubBlocked(x, y, margin = 0) {
      const l = OFFROAD_CLUB.lot;
      return x > l.x - margin && x < l.x + l.w + margin && y > l.y - margin && y < l.y + l.h + margin;
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
    };
    function offroadTyre(spec) {
      return OFFROAD_TYRES[spec.tyre || (spec.tank ? 'track' : spec.offroad ? 'at' : 'road')];
    }
    // Share of the vehicle's weight on driven wheels on a grade (positive: climbing).
    // Which wheels the city's own cars drive (the rest are rear-driven, or 4x4 if `offroad`).
    for (const [type, drive] of Object.entries({ sedan: 'fwd', coupe: 'fwd', taxi: 'fwd', van: 'fwd', rally: '4x4', supercar: '4x4' }))
      if (VEHICLE_DEFINITIONS[type] && !VEHICLE_DEFINITIONS[type].drive) VEHICLE_DEFINITIONS[type].drive = drive;
    function drivenShare(spec, grade) {
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
    /* ---- The lot: vehicles, colliders, ground ---------------------------------------- */
    const clubState = {
      slots: [],
      scene: null,
      talkClock: 4,
      theftTold: 0,
      armed: -1,
      climb: null,
      last: null,
      records: null,
      respawnClock: 5,
    };
    function parkClubVehicle(i) {
      const [u, v, type, color] = OFFROAD_CLUB.slots[i],
        p = clubPoint(u, v),
        c = makeCar(type, p.x, p.y, OFFROAD_CLUB.heading, false, color);
      c.clubSlot = i;
      c.vx = c.vy = 0;
      clubState.slots[i] = c;
      return c;
    }
    function populateOffroadClub() {
      for (let i = 0; i < OFFROAD_CLUB.slots.length; i++) parkClubVehicle(i);
    }
    function addOffroadClubColliders() {
      const l = OFFROAD_CLUB.lot;
      // Log rails stop vehicles only (people step over them).
      for (const [u0, v0, u1, v1] of OFFROAD_CLUB.rails) {
        const x = l.x + Math.min(u0, u1) - 2,
          y = l.y + Math.min(v0, v1) - 2;
        addStatic(x, y, Math.abs(u1 - u0) + 4, Math.abs(v1 - v0) + 4, 4, 'rail');
      }
      const cn = OFFROAD_CLUB.canopy;
      addStatic(cn.x - cn.size / 2, cn.y - cn.size / 2, cn.size, cn.size, 24, 'canopy');
      const g = OFFROAD_CLUB.grill;
      addStatic(g.x - 4, g.y - 4, 8, 8, 9, 'grill');
      const s = OFFROAD_CLUB.sign;
      addStatic(s.x - 34, s.y - 3, 68, 6, 30, 'sign');
      const f = OFFROAD_CLUB.flag;
      addStatic(f.x - 1.5, f.y - 1.5, 3, 3, 60, 'pole');
    }
    // The pad on the county sheet (2D view, the map, and under the 3D ground decal).
    function paintOffroadClubGround(drawingContext) {
      const l = OFFROAD_CLUB.lot;
      drawingContext.save();
      drawingContext.fillStyle = '#8d7b62';
      drawingContext.fillRect(l.x - 6, l.y - 6, l.w + 12, l.h + 12);
      drawingContext.fillStyle = '#a3906f';
      drawingContext.fillRect(l.x, l.y, l.w, l.h);
      // A track worn in from the road and round the lot.
      drawingContext.strokeStyle = 'rgba(92,74,52,0.55)';
      drawingContext.lineWidth = 14;
      drawingContext.beginPath();
      drawingContext.moveTo(l.x + 150, l.y - 40);
      drawingContext.quadraticCurveTo(l.x + 150, l.y + 80, l.x + 250, l.y + 90);
      drawingContext.stroke();
      drawingContext.restore();
    }
    /* ---- The members ----------------------------------------------------------------- */
    const TRAIL_CLUB_TALK = [
        'Aired down to 15 psi!',
        'Lockers engaged?',
        'Last one to the summit buys the beers.',
        'Momentum, not speed. Momentum.',
        'Stay on the crown, out of the ruts.',
        'The bog ate a Hilux last spring.',
        'She walked up the rock steps in low range.',
        'Who brought the recovery straps?',
        'Snorkel’s not for show.',
        'Thirty-sevens on stock axles? Brave.',
        'Burgers in five!',
        'That winch saved my weekend.',
        'Two-thirty to the top. Beat that.',
      ],
      TRAIL_CLUB_NIGHT = ['Stars are unreal up here.', 'Pass the lantern.', 'Night run to the summit?', 'Who’s got the marshmallows?'],
      TRAIL_CLUB_RAIN = ['Here comes the good mud!', 'The hairpin’s going to be soup.', 'Lock the hubs, boys.'],
      TRAIL_CLUB_THEFT = ['HEY! That’s my rig!', 'Somebody stop him!', 'Not the Series, she’s older than you!', 'Bring it back in one piece!'],
      TRAIL_CLUB_ROAD_CAR = ['You’re not taking THAT up the trail?', 'Road tyres? Good luck.', 'Nice car. Wrong hobby.'],
      TRAIL_CLUB_MUDDY = ['Now THAT’s a proper paint job.', 'Somebody found the bog!', 'Looks like you had fun.'];
    function clubSay(p, lines) {
      if (!p || p.hp <= 0 || (p.speechUntil || 0) > gameTime || p.react) return false;
      p.speech = randomChoice(lines);
      p.speechUntil = gameTime + 3.4;
      p.speechKind = 'club';
      p.speechKindText = p.speech;
      return true;
    }
    function stageClubScene() {
      const l = OFFROAD_CLUB.lot,
        s = makeScene('club', l.x + l.w / 2, l.y + l.h / 2);
      for (const [u, v, a, role, dress] of OFFROAD_CLUB.members) {
        const p = spawnSceneMember(s, role, { x: l.x + u, y: l.y + v, a }, dress);
        if (!p) continue;
        // Club colours: flannel, work jackets, caps.
        p.look.top = randomChoice(['#7a2e26', '#3c4f36', '#5a4632', '#2f3f52', '#8a6a35', '#a13d2d']);
        p.look.pants = randomChoice(['#3b3a35', '#4a4033', '#27303b']);
        p.look.hat = seededRandom() < 0.6 ? 1 : 0;
        p.look.hatColor = randomChoice(['#3c5b47', '#8e1f2a', '#d8d2c4', '#23272e', '#c7862e']);
        p.color = p.look.top;
        p.clubMember = true;
      }
      return s;
    }
    function updateClubScene(deltaSeconds) {
      const l = OFFROAD_CLUB.lot,
        d = Math.hypot(player.x - (l.x + l.w / 2), player.y - (l.y + l.h / 2));
      if (clubState.scene && !crowd.scenes.includes(clubState.scene)) clubState.scene = null;
      if (!clubState.scene && d < 1400) clubState.scene = stageClubScene();
      const s = clubState.scene;
      if (!s || d > 700) return;
      clubState.talkClock -= deltaSeconds;
      const members = s.members.filter((p) => p.hp > 0 && !p.react);
      if (!members.length) return;
      // Somebody drives off in a club truck.
      const car = player.car;
      if (car && car.clubSlot >= 0 && gameTime - clubState.theftTold > 20 && distanceBetween(car, clubPoint(150, 60)) < 260 && Math.abs(car.speed) > 12) {
        clubState.theftTold = gameTime;
        const shout = members.reduce((a, b) => (distanceBetween(a, car) < distanceBetween(b, car) ? a : b));
        clubSay(shout, TRAIL_CLUB_THEFT);
        shout.speechKind = 'shout';
        crime(0.6);
        clubState.talkClock = 3;
        return;
      }
      if (clubState.talkClock > 0) return;
      clubState.talkClock = randomBetween(4.5, 8);
      const hour = (worldMinutes % 1440) / 60,
        someone = randomChoice(members);
      if (car && d < 260 && car.mudCoat > 0.45) clubSay(someone, TRAIL_CLUB_MUDDY);
      else if (car && d < 260 && !vehicleSpec(car).offroad && !isAircraft(car) && !isBoat(car)) clubSay(someone, TRAIL_CLUB_ROAD_CAR);
      else if ((weather.rain || 0) > 0.2) clubSay(someone, TRAIL_CLUB_RAIN);
      else if (hour > 20.5 || hour < 5) clubSay(someone, seededRandom() < 0.5 ? TRAIL_CLUB_NIGHT : TRAIL_CLUB_TALK);
      else clubSay(someone, TRAIL_CLUB_TALK);
    }
    // A club truck taken or wrecked is replaced while nobody is looking.
    function refillClubSlots(deltaSeconds) {
      clubState.respawnClock -= deltaSeconds;
      if (clubState.respawnClock > 0) return;
      clubState.respawnClock = 6;
      const l = OFFROAD_CLUB.lot;
      if (Math.hypot(player.x - l.x - l.w / 2, player.y - l.y - l.h / 2) < 1500) return;
      OFFROAD_CLUB.slots.forEach(([u, v, type], i) => {
        const c = clubState.slots[i],
          p = clubPoint(u, v);
        if (c && vehicles.includes(c) && c.hp > 0 && distanceBetween(c, p) < 60) return;
        if (c === player.car) return;
        if (c && vehicles.includes(c) && distanceBetween(c, p) < 60) vehicles.splice(vehicles.indexOf(c), 1);
        if (canSpawnCar(type, p.x, p.y, OFFROAD_CLUB.heading, 2)) parkClubVehicle(i);
      });
    }
    /* ---- Hill climb ------------------------------------------------------------------- */
    const HILL_CLIMB_KEY = 'dead-end-city-hillclimb';
    function hillClimbRecords() {
      if (clubState.records) return clubState.records;
      try {
        clubState.records = JSON.parse(localStorage.getItem(HILL_CLIMB_KEY) || '{}') || {};
      } catch {
        clubState.records = {};
      }
      return clubState.records;
    }
    function saveHillClimbRecords() {
      try {
        localStorage.setItem(HILL_CLIMB_KEY, JSON.stringify(clubState.records));
      } catch {
        /* private window: the record lasts the session */
      }
    }
    function climbClock(seconds) {
      const m = Math.floor(seconds / 60),
        s = seconds - m * 60;
      return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
    }
    // The start gate (a few metres up the trail) and the checkpoints of a trail.
    function trailCourse(t) {
      const trail = MOUNTAIN_TRAILS[t];
      terrainField(TERRAIN_FIELDS[0]);
      if (trail.course) return trail.course;
      const sections = OFFROAD_SECTIONS[t],
        start = Math.min(8, trail.path.length - 1),
        at = (i) => ({ x: trail.path[i][0], y: trail.path[i][1], i });
      trail.course = {
        start: at(start),
        from: at(start - 3),
        checkpoints: sections.checkpoints.map((mark) => at(trailMarkIndex(trail, mark))),
        peak: trail.peak,
        target: sections.target,
      };
      return trail.course;
    }
    function startClimb(t, c, challenge) {
      clubState.climb = { trail: t, vehicle: c, start: gameTime, next: 0, splits: [], challenge, failed: null };
      if (clubState.armed === t) clubState.armed = -1;
      const course = trailCourse(t);
      tell(challenge ? 'HILL CLIMB · GO! Beat ' + climbClock(course.target) + ' to the summit' : 'CLIMB TIMER · ' + course.peak.name + ' · clock running', 3);
      tone(880, 0.12, 0.18, 'square');
    }
    function updateHillClimb() {
      const c = player.car;
      let climb = clubState.climb;
      if (climb && (c !== climb.vehicle || !c || c.hp <= 0)) {
        if (climb.challenge) tell('HILL CLIMB ABANDONED', 2.5);
        climb = clubState.climb = null;
      }
      if (!c || isAircraft(c) || isBoat(c) || vehicleSpec(c).bicycle) return;
      for (let t = 0; t < MOUNTAIN_TRAILS.length && !climb; t++) {
        const course = trailCourse(t),
          gate = course.start;
        if (Math.hypot(c.x - gate.x, c.y - gate.y) > 34) continue;
        const dx = gate.x - course.from.x,
          dy = gate.y - course.from.y,
          up = ((c.vx || 0) * dx + (c.vy || 0) * dy) / Math.hypot(dx, dy);
        if (up > 3 * KMH) {
          startClimb(t, c, clubState.armed === t);
          climb = clubState.climb;
        }
      }
      if (!climb) return;
      const course = trailCourse(climb.trail),
        cp = course.checkpoints[climb.next];
      if (cp && Math.hypot(c.x - cp.x, c.y - cp.y) < 44) {
        climb.splits.push(gameTime - climb.start);
        climb.next++;
        tell('CHECKPOINT ' + climb.next + ' / ' + course.checkpoints.length + ' · ' + climbClock(gameTime - climb.start), 1.8);
        tone(660 + climb.next * 110, 0.08, 0.14, 'triangle');
      }
      // Back down at the start: the run is off.
      if (climb.next === 0 && Math.hypot(c.x - course.from.x, c.y - course.from.y) < 20 && gameTime - climb.start > 3) {
        if (climb.challenge) clubState.armed = climb.trail;
        clubState.climb = null;
      }
    }
    // terrain.js calls this when the player's vehicle reaches a summit.
    function offroadSummit(c, peak) {
      const climb = clubState.climb,
        t = MOUNTAIN_TRAILS.findIndex((trail) => trail.peak === peak);
      if (!climb || climb.trail !== t) {
        // No clock running (driven up some other way): the view is the reward.
        if (!c.summits?.includes(peak.name)) {
          c.summits = c.summits || [];
          c.summits.push(peak.name);
          announce('SUMMIT REACHED', peak.name, 4);
        }
        return;
      }
      const course = trailCourse(t),
        time = gameTime - climb.start,
        clean = climb.next >= course.checkpoints.length,
        records = hillClimbRecords(),
        best = records[peak.name];
      clubState.climb = null;
      c.summits = c.summits || [];
      if (!c.summits.includes(peak.name)) c.summits.push(peak.name);
      let note;
      if (!clean) note = 'MISSED ' + (course.checkpoints.length - climb.next) + ' CHECKPOINT' + (course.checkpoints.length - climb.next > 1 ? 'S' : '') + ' · NO RECORD';
      else if (best === undefined || time < best) {
        records[peak.name] = +time.toFixed(2);
        saveHillClimbRecords();
        note = best === undefined ? 'FIRST CLEAN RUN · RECORD SET' : 'NEW RECORD · ' + climbClock(best - time) + ' FASTER';
      } else note = 'BEST ' + climbClock(best);
      announce('SUMMIT REACHED', peak.name + ' · ' + climbClock(time), 6);
      if (climb.challenge) {
        if (clean && time <= course.target) {
          cash += 1000;
          tell('HILL CLIMB WON · ' + climbClock(time) + ' · $1,000 · ' + note, 7);
        } else tell('HILL CLIMB · ' + (clean ? climbClock(time) + ' is over ' + climbClock(course.target) : note) + ' · try again at the club', 6);
      } else tell(note, 5);
      clubState.last = { peak: peak.name, time: +time.toFixed(2), clean, challenge: climb.challenge, splits: climb.splits.map((s) => +s.toFixed(2)) };
      tone(523, 0.14, 0.2, 'triangle');
      tone(784, 0.3, 0.2, 'triangle');
    }
    // The running clock on screen (made on first use; hidden off the trail).
    let climbHud = null;
    function updateClimbHud() {
      const climb = clubState.climb,
        show = gameMode === 'play' && (!!climb || clubState.armed >= 0);
      if (!climbHud) {
        if (!show) return;
        climbHud = document.createElement('div');
        climbHud.id = 'hillClimbHud';
        climbHud.style.cssText =
          'position:fixed;left:50%;top:78px;transform:translateX(-50%);z-index:30;pointer-events:none;' +
          'padding:7px 16px;border-radius:7px;background:rgba(14,16,19,0.74);border:1px solid rgba(233,190,120,0.45);' +
          'color:#f6ead0;font:700 14px/1.25 system-ui,"Segoe UI",Arial,sans-serif;letter-spacing:0.08em;text-align:center;' +
          'text-shadow:0 1px 2px #000;white-space:nowrap';
        document.body.appendChild(climbHud);
      }
      climbHud.style.display = show ? 'block' : 'none';
      if (!show) return;
      if (!climb) {
        climbHud.textContent = 'HILL CLIMB ARMED · CROSS THE START GATE AT THE TRAILHEAD';
        return;
      }
      const course = trailCourse(climb.trail),
        time = gameTime - climb.start,
        best = hillClimbRecords()[course.peak.name],
        over = climb.challenge && time > course.target;
      climbHud.style.color = over ? '#ff9a7a' : '#f6ead0';
      climbHud.textContent =
        (climb.challenge ? 'HILL CLIMB ' : 'CLIMB ') +
        climbClock(time) +
        (climb.challenge ? ' / ' + climbClock(course.target) : '') +
        ' · CP ' + climb.next + '/' + course.checkpoints.length +
        (best !== undefined ? ' · BEST ' + climbClock(best) : '') +
        (player.car?.lowRange ? ' · 4LO' : '');
    }
    /* ---- Interaction ------------------------------------------------------------------ */
    function nearClubSign() {
      const s = OFFROAD_CLUB.sign;
      return withinRange('club-sign', Math.hypot(player.x - s.x, player.y - (s.y + 40)), 120, 150);
    }
    function offroadClubUI() {
      if (gameMode !== 'play' || !nearClubSign()) return;
      const c = player.car,
        best = hillClimbRecords()['MOUNT ASCENT'];
      if (!c) offerPrompt('4X4 CLUB · HILL CLIMB · TAKE A TRUCK', { key: null, id: 'club-hillclimb-foot' });
      else if (isAircraft(c) || isBoat(c) || vehicleSpec(c).bicycle) return;
      else if (clubState.armed === 0) offerPrompt('HILL CLIMB ARMED · GO TO THE START GATE', { key: null, id: 'club-hillclimb-armed' });
      else offerPrompt('HILL CLIMB · BEAT 2:30' + (best !== undefined ? ' · BEST ' + climbClock(best) : ''), { id: 'club-hillclimb' });
    }
    function offroadClubInteract() {
      const c = player.car;
      if (!c || isAircraft(c) || isBoat(c) || vehicleSpec(c).bicycle || !nearClubSign() || clubState.armed === 0) return false;
      clubState.armed = 0;
      clubState.climb = null;
      tell('HILL CLIMB · Mount Ascent · the clock starts at the trailhead gate across the road. Beat 2:30 for $1,000.', 6);
      tone(520, 0.1, 0.16, 'triangle');
      return true;
    }
    /* ---- Per frame -------------------------------------------------------------------- */
    function updateOffroad(deltaSeconds) {
      if (deltaSeconds <= 0) return;
      for (const c of vehicles) {
        if (c.mudCoat > 0 || c.surfaceMud > 0.05 || (c === player.car && c.offroadState))
          if (c === player.car || (Math.abs(c.x - player.x) < 1200 && Math.abs(c.y - player.y) < 1200)) updateBodyMud(c, deltaSeconds);
      }
      updateHillClimb();
      updateClimbHud();
      updateClubScene(deltaSeconds);
      refillClubSlots(deltaSeconds);
    }
    /* ---- Console ---------------------------------------------------------------------- */
    function offroadReport() {
      const l = OFFROAD_CLUB.lot,
        roadClear = Math.round(
          Math.min(
            ...COUNTY_ROADS.flatMap((r) =>
              r.points.map((p, i) => {
                if (!i) return Infinity;
                let d = Infinity;
                for (const [x, y] of [[l.x, l.y], [l.x + l.w, l.y], [l.x, l.y + l.h], [l.x + l.w, l.y + l.h], [l.x + l.w / 2, l.y]])
                  d = Math.min(d, segmentDistance(x, y, r.points[i - 1], p));
                return d - r.width / 2;
              }),
            ),
          ),
        ),
        trailClear = Math.round(
          Math.min(...MOUNTAIN_TRAILS.flatMap((t) => t.points.map((p, i) => (i ? segmentDistance(l.x + l.w / 2, l.y, t.points[i - 1], p) - t.width / 2 : Infinity)))),
        ),
        c = player.car,
        s = c ? offroadSurfaceAt(c.x, c.y, { ...offroadSurface }) : null;
      let padLevel = 0;
      for (let u = 0; u <= l.w; u += 29) for (let v = 0; v <= l.h; v += 32) padLevel = Math.max(padLevel, terrainHeight(l.x + u, l.y + v));
      return {
        club: { lot: l, padMaxHeight: +padLevel.toFixed(2), roadClearance: roadClear, trailClearance: trailClear },
        vehicles: OFFROAD_CLUB.slots.map(([, , type], i) => {
          const spec = VEHICLE_DEFINITIONS[type],
            v = clubState.slots[i];
          return {
            type,
            name: spec.name,
            lengthM: +(spec.l / OFFROAD_M).toFixed(2),
            widthM: +(spec.w / OFFROAD_M).toFixed(2),
            massT: spec.mass,
            topKmh: spec.topKmh,
            zeroTo: spec.zeroTo,
            tyre: spec.tyre,
            drive: spec.drive,
            lowRange: !!spec.lowRange,
            parked: !!v && vehicles.includes(v),
            id: v?.id,
          };
        }),
        members: clubState.scene ? clubState.scene.members.map((p) => ({ role: p.sceneRole, pose: p.pose, speech: p.speechUntil > gameTime ? p.speech : null })) : [],
        player: c
          ? {
              type: c.type,
              kmh: +(Math.abs(c.speed) / KMH).toFixed(1),
              wheelKmh: +((Math.abs(c.speed) + c.spinSpeed) / KMH).toFixed(1),
              wheelSpin: +c.wheelSpin.toFixed(2),
              lowRange: c.lowRange,
              mud: +s.mud.toFixed(2),
              rock: +s.rock.toFixed(2),
              across: +s.across.toFixed(2),
              trailSample: s.seg,
              grade: c.offroadState ? +c.offroadState.along.toFixed(3) : 0,
              height: +terrainHeight(c.x, c.y).toFixed(1),
              mudCoat: +c.mudCoat.toFixed(3),
              mudWet: +c.mudWet.toFixed(2),
            }
          : null,
        climb: clubState.climb
          ? { trail: MOUNTAIN_TRAILS[clubState.climb.trail].name, seconds: +(gameTime - clubState.climb.start).toFixed(2), next: clubState.climb.next, challenge: clubState.climb.challenge }
          : null,
        armed: clubState.armed,
        last: clubState.last,
        records: { ...hillClimbRecords() },
        courses: MOUNTAIN_TRAILS.map((t, i) => {
          const course = trailCourse(i);
          return { trail: t.name, start: [Math.round(course.start.x), Math.round(course.start.y)], checkpoints: course.checkpoints.map((p) => [Math.round(p.x), Math.round(p.y), p.i]), hairpins: t.hairpins.map(([x, y]) => [Math.round(x), Math.round(y)]), target: course.target };
        }),
        wet: +(weather.wet || 0).toFixed(2),
        effects: city3D ? city3D.offroadInfo() : null,
      };
    }
    // Every club truck side by side facing south (the camera), for a close look.
    function clubLineup(x = player.x, y = player.y + 60) {
      const types = Object.keys(OFFROAD_TYPES),
        ids = [];
      types.forEach((type, i) => {
        const c = makeCar(type, x + (i - (types.length - 1) / 2) * 30, y, Math.PI / 2 - 0.5, false);
        c.vx = c.vy = 0;
        ids.push(c.id);
      });
      return ids;
    }
    /*
     * TRAIL PILOT (console): drives the player's vehicle up a trail through the
     * real physics and controls (keys, 30 steps a second, no drawing), following
     * the graded path with a look-ahead, easing off before the hairpins and
     * holding at most `maxKmh`. Reports how far it got, the time, the wheelspin,
     * and why it stopped (the summit, stuck, time). `keysHeld` go in as extra
     * keys (e.g. Space).
     */
    function trailPilot(seconds = 240, maxKmh = 40, t = 0) {
      const c = player.car,
        trail = MOUNTAIN_TRAILS[t],
        path = trail.path,
        n = path.length - 1;
      if (!c) return null;
      let idx = 0,
        best = 0,
        bestAt = 0,
        time = 0,
        spinSum = 0,
        slid = 0,
        maxSpeed = 0,
        reason = 'time',
        lastProgress = 0,
        stall = 0,
        backing = 0;
      // Start from the nearest sample.
      let nearest = Infinity;
      for (let i = 0; i <= n; i++) {
        const d = Math.hypot(path[i][0] - c.x, path[i][1] - c.y);
        if (d < nearest) {
          nearest = d;
          idx = i;
        }
      }
      best = idx;
      const dt = 1 / 30;
      for (; time < seconds; time += dt) {
        if (player.car !== c || c.hp <= 0) {
          reason = 'lost vehicle';
          break;
        }
        // Advance along the path while the next samples are closer.
        for (let k = 0; k < 6 && idx < n; k++) {
          const here = Math.hypot(path[idx][0] - c.x, path[idx][1] - c.y),
            next = Math.hypot(path[idx + 1][0] - c.x, path[idx + 1][1] - c.y);
          if (next <= here + 2) idx++;
          else break;
        }
        if (idx > best) {
          best = idx;
          bestAt = time;
        }
        if (idx >= n - 2 || distanceBetween(c, trail.peak) < 40) {
          reason = 'summit';
          break;
        }
        if (time - bestAt > 12) {
          reason = 'stuck';
          break;
        }
        const speed = c.speed || 0,
          kmh = speed / KMH,
          heading = (i) => Math.atan2(path[Math.min(n, i + 1)][1] - path[Math.min(n, i)][1], path[Math.min(n, i + 1)][0] - path[Math.min(n, i)][0]),
          // In a hairpin, follow the line closely (a long look cuts across the bank inside it).
          tight = Math.abs(normalizeAngle(heading(idx + 6) - heading(idx))) > 1.1,
          look = Math.min(n, idx + (tight ? 2 : 4 + Math.floor(Math.max(0, kmh) / 8))),
          [tx, ty] = path[look],
          err = normalizeAngle(Math.atan2(ty - c.y, tx - c.x) - c.a);
        // Ease off in time for the bends ahead: the sharpest heading change within
        // braking reach (farther ahead at speed).
        let bend = 0;
        const h0 = heading(idx),
          reach = 6 + Math.floor(Math.max(0, kmh) / 2.5);
        for (let j = idx + 1; j <= Math.min(n - 1, idx + reach); j++) bend = Math.max(bend, Math.abs(normalizeAngle(heading(j) - h0)));
        const desired = Math.min(maxKmh, bend > 2.2 ? 9 : bend > 1.3 ? 14 : bend > 0.6 ? 24 : maxKmh);
        // Wedged (nose in a bank past a hairpin): back off a moment on opposite lock.
        stall = keys.KeyW && Math.abs(kmh) < 1 && c.wheelSpin < 0.3 ? stall + dt : 0;
        if (stall > 1.5) backing = 1.4;
        // Facing away from the line (overshot a hairpin): a three-point turn.
        if (backing <= 0 && Math.abs(err) >= 1.5 && Math.abs(kmh) < 6) backing = 1.2;
        if (backing > 0) {
          backing -= dt;
          keys.KeyW = false;
          keys.KeyS = true;
          keys.KeyD = err < 0;
          keys.KeyA = err > 0;
        } else {
          keys.KeyW = kmh < desired && Math.abs(err) < 1.6;
          keys.KeyS = kmh > desired + 8 || (Math.abs(err) >= 1.6 && kmh > 4);
          keys.KeyD = err > 0.05;
          keys.KeyA = err < -0.05;
        }
        if (speed < -2 * KMH && keys.KeyW) slid += -speed * dt;
        spinSum += c.wheelSpin * dt;
        maxSpeed = Math.max(maxSpeed, kmh);
        update(dt);
        if (idx !== lastProgress) lastProgress = idx;
      }
      keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false;
      return {
        reason,
        seconds: +time.toFixed(1),
        sample: best,
        of: n,
        progress: +(best / n).toFixed(3),
        height: Math.round(terrainHeight(c.x, c.y)),
        meanSpin: +(spinSum / Math.max(time, 1)).toFixed(2),
        slidBackM: +worldMeters(slid).toFixed(1),
        maxKmh: Math.round(maxSpeed),
        hp: Math.round(c.hp),
        mudCoat: +c.mudCoat.toFixed(2),
        last: clubState.last,
      };
    }
    // The graded path of a trail with its mud and rock, every `step` samples (console).
    function trailProfile(t = 0, step = 4) {
      const trail = MOUNTAIN_TRAILS[t],
        out = [],
        s = { ...offroadSurface };
      for (let i = 0; i < trail.path.length; i += step) {
        const [x, y] = trail.path[i],
          j = Math.min(trail.path.length - 1, i + step),
          run = Math.hypot(trail.path[j][0] - x, trail.path[j][1] - y) || 1;
        offroadSurfaceAt(x, y, s);
        out.push([i, Math.round(x), Math.round(y), +terrainHeight(x, y).toFixed(1), +((terrainHeight(...trail.path[j]) - terrainHeight(x, y)) / run).toFixed(3), +s.mud.toFixed(2), +s.rock.toFixed(2)]);
      }
      return out;
    }
    // Place the player's vehicle at a trail's start gate (or a checkpoint), facing up the trail.
    function hillClimbConsole(action = 'state', t = 0) {
      const course = trailCourse(t);
      if (action === 'arm') {
        clubState.armed = t;
        clubState.climb = null;
      } else if (action === 'reset') {
        clubState.armed = -1;
        clubState.climb = null;
      } else if (action === 'clear') {
        clubState.records = {};
        saveHillClimbRecords();
      } else if (action === 'gate' || action.startsWith?.('cp')) {
        const c = player.car,
          point = action === 'gate' ? course.from : course.checkpoints[+action.slice(2)] || course.from,
          path = MOUNTAIN_TRAILS[t].path,
          next = path[Math.min(path.length - 1, point.i + 2)];
        if (c) {
          c.x = point.x;
          c.y = point.y;
          c.a = Math.atan2(next[1] - point.y, next[0] - point.x);
          c.vx = c.vy = c.av = 0;
          c.speed = 0;
          player.x = c.x;
          player.y = c.y;
        }
      }
      return offroadReport();
    }
    // END SUBSYSTEM: src/offroad.js
