  // BEGIN SUBSYSTEM: src/game.js — Game orchestration and shared state
  /**
   * Game orchestration and shared state
   * Source: src/game.js
   * Scope: shared game closure.
   * DOM references, units, entity registries, world population, combat, fallback drawing, UI, input and frame loop.
   */
  (() => {
    'use strict';

    /**
     * SHARED DATA CONTRACTS
     * Map coordinates are (x, y), measured in world units: 512 units = 100 meters.
     * Heading `a` is radians. vx/vy are world units per second; av is radians/second.
     * In Three.js, a map point becomes (x, elevation, y); model yaw is -a.
     * Entity fields retain their established compact data keys for interoperability:
     * hp = health, maxhp = maximum health, a = heading, w/l = width/length,
     * vz = vertical speed, hx/hy = collider half-extents, inv = invulnerability time.
     * Aircraft altitude is absolute; aircraftClearance() subtracts the local terrain,
     * or the flat roof a helicopter is over (c.roofSite, rooftops.js).
     * Always use entityElevation() to compare actors on different floors/surfaces.
     * Frame deltas and timers are seconds, except animation timestamps in milliseconds.
     * Physics uses fixed 1/120-second steps. worldMinutes advances one minute/second.
     * Standard x/y/z coordinates and i/j loop indices are intentionally conventional.
     * Include fragments share this closure; renderer fragments share its inner closure.
     */

    const getElement = (id) => document.getElementById(id),
      canvas = getElement('game'),
      worldContext = canvas.getContext('2d', {
        alpha: true,
      }),
      minimapContext = getElement('minimap').getContext('2d'),
      cityMapContext = getElement('bigmap').getContext('2d');
    const TAU = Math.PI * 2,
      WORLD_SIZE = 11264,
      CITY_SIZE = 5632,
      BLOCK_SIZE = 512,
      // Avenues run north-south at these x. The column plan never changed.
      // Palm Keys (west of Northbank since the islands were rearranged) carries
      // the negative columns: Ocean Dr -2432, Collins Ave... see STREET_NAMES.
      ROAD_CENTERS = Array.from(
        {
          length: 16,
        },
        (_, i) => 128 + (i - 5) * BLOCK_SIZE,
      ),
      /**
       * NORTH RECLAMATION
       * The original grid started at y = 128 and ran south. The northern
       * reclamation added eight more cross streets above it, so street rows now
       * run from -3968 to 5248 and map coordinates north of the old shoreline are
       * negative. Block indices keep their old meaning — by 0 is still y 128 —
       * and the new blocks simply carry negative indices, so every place, park
       * and landmark recorded before the reclamation still points at its block.
       */
      NORTH_ROWS = 8,
      ROAD_ROWS = Array.from(
        {
          length: 11 + NORTH_ROWS,
        },
        (_, i) => 128 + (i - NORTH_ROWS) * BLOCK_SIZE,
      ),
      // Boulevard-width streets: 112 wide with a double yellow centre line.
      // Columns (x) and rows (y) are listed apart since Palm Keys moved west of
      // Northbank and its avenues took negative x.
      WIDE_COLUMNS = [-1920, 1152, 2688, 3200],
      WIDE_ROWS = [1152, 2688, 3200, 4736, -1408, -2944],
      /**
       * FRAMES
       * The city frame (CITY_LEFT..CITY_RIGHT, CITY_TOP..CITY_SIZE) is what the
       * baked ground textures, the night light map and the street grid cover:
       * Palm Keys in the west (negative x), Northbank and the northern
       * reclamation. Beyond it, the county south and east (x or y past
       * CITY_SIZE, county.js) and the theme-park island north of the reclamation
       * (themepark.js) carry their own ground tiles. The world box
       * (WORLD_LEFT..WORLD_SIZE, WORLD_TOP..WORLD_SIZE) bounds the sea, the map
       * and the water shader's shore field.
       */
      CITY_TOP = -4224,
      CITY_LEFT = -3584,
      CITY_RIGHT = 3712,
      CITY_WIDTH = CITY_RIGHT - CITY_LEFT,
      CITY_HEIGHT = CITY_SIZE - CITY_TOP,
      WORLD_TOP = -8192,
      WORLD_LEFT = -5120,
      WORLD_WIDTH = WORLD_SIZE - WORLD_LEFT,
      WORLD_HEIGHT = WORLD_SIZE - WORLD_TOP;
    const wideColumn = (x) => WIDE_COLUMNS.includes(x),
      wideRow = (y) => WIDE_ROWS.includes(y);
    const blockX = (bx) => 128 + bx * BLOCK_SIZE,
      blockY = (by) => 128 + by * BLOCK_SIZE,
      BLOCK_X_MIN = -6,
      BLOCK_X_MAX = 9,
      // Block columns in world-building order: Northbank first, as it always
      // was, so the seeded buildings there are unchanged, then Palm Keys.
      BLOCK_COLUMNS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -6, -5, -4, -3, -2, -1],
      BLOCK_Y_MIN = -NORTH_ROWS,
      BLOCK_Y_MAX = 9;
    const METERS_PER_UNIT = 100 / BLOCK_SIZE;
    const worldMeters = (units) => units * METERS_PER_UNIT,
      distanceLabel = (units) => Math.round(worldMeters(units)) + ' m';
    const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)),
      distanceBetween = (firstPoint, secondPoint) =>
        Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y),
      headingBetween = (fromPoint, toPoint) =>
        Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x),
      normalizeAngle = (angleRadians) => Math.atan2(Math.sin(angleRadians), Math.cos(angleRadians));
    let randomSeed = 1997;
    const seededRandom = () => {
        randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
        return randomSeed / 4294967296;
      },
      randomChoice = (a) => a[Math.floor(seededRandom() * a.length)],
      randomBetween = (minimum, maximum) => minimum + seededRandom() * (maximum - minimum);
    let viewportWidth = innerWidth,
      viewportHeight = innerHeight,
      devicePixelRatioLimit = Math.min(devicePixelRatio || 1, 2),
      canvasScale = 1,
      gameMode = 'menu',
      previousMode = 'menu',
      gameTime = 0,
      lastTime = 0,
      uiTime = 0,
      keys = {},
      mouse = {
        active: false,
        x: 0,
        y: 0,
        down: false,
      },
      mapOpen = false,
      toastTime = 0,
      announceTime = 0,
      shake = 0,
      flash = 0,
      nextVehicleId = 1;
    let mapZoom = 1,
      mapCenter = {
        x: (WORLD_LEFT + WORLD_SIZE) / 2,
        y: (WORLD_TOP + WORLD_SIZE) / 2,
      };
    let cash = 0,
      wantedStars = 0,
      copSpawn = 0,
      selectedWeaponIndex = 0,
      reloadSecondsRemaining = 0,
      shotCooldownSeconds = 0,
      missionIndex = 0,
      mission = null,
      completed = 0;
    // Marlow Bay: the water between Northbank's east shore and Ridgeline's
    // west shore (it was the narrow river before Palm Keys moved west).
    const RIVER = {
        left: 3420,
        right: 5880,
      },

      HELIPADS = [
        {
          x: 1420,
          y: 4070,
          name: 'POLICE HQ',
        },
        {
          x: 3345,
          y: 1920,
          name: 'RIVERSIDE',
        },
      ],
      PARKS = [
        [3, 5],
        [3, 6],
        [4, 5],
        [4, 6],
        [1, 1],
        [0, 4],
        [2, 5],
        [4, 7],
        [1, 8],
        [8, 2],
        [8, 5],
        [9, 8],
        [8, 9],
        [0, 7],
        [0, -2],
        [4, -4],
        [2, -7],
        // West Quay: the Shore Line swings off the sea wall onto Harbor Ave across
        // this block, so it is a green under the viaduct rather than buildings.
        [0, 5],
      ];
    const isPark = (x, y) => PARKS.some((p) => p[0] === x && p[1] === y);
    const spawn = {
        x: 748,
        y: 584,
      },
      phone = {
        x: 790,
        y: 553,
      },
      safehouse = {
        x: 3200,
        y: 2880,
      };
    const player = {
      ...spawn,
      a: 0,
      hp: 100,
      armor: 0,
      car: null,
      walk: 0,
      inv: 0,
    };
    const cameraTarget = {
        x: spawn.x,
        y: spawn.y,
      },
      vehicles = [],
      pedestrians = [],
      bullets = [],
      particles = [],
      skids = [],
      pickups = [],
      enemies = [],
      buildings = [],
      trees = [],
      lamps = [],
      debris = [],
      fires = [];
    const VEHICLE_PAINT_COLORS = [
      '#ae4d46',
      '#dbbb74',
      '#699d9e',
      '#697d8d',
      '#c2b3a1',
      '#77758e',
      '#426462',
      '#d5d2bd',
      '#736244',
      '#a25666',
    ];
    const VEHICLE_DEFINITIONS = {
      bicycle: {
        name: 'CITY CYCLE',
        l: 28,
        w: 9,
        max: 112,
        acc: 40,
        turn: 3.9,
        hp: 85,
        mass: 0.12,
        brake: 170,
        grip: 11,
        bike: true,
        bicycle: true,
        offroad: true,
        color: '#68b6aa',
      },
      plane: {
        name: 'SERRANO C200 COURIER',
        l: 112,
        w: 100,
        max: 520,
        acc: 115,
        turn: 0.8,
        hp: 250,
        mass: 2.8,
        plane: true,
        color: '#ded4b8',
      },
      tank: {
        name: 'SENTINEL M120 MAIN BATTLE TANK',
        offroad: true,
        l: 84,
        w: 53,
        max: 195,
        acc: 110,
        turn: 1.35,
        hp: 1600,
        mass: 18,
        brake: 280,
        grip: 13,
        tank: true,
        color: '#657652',
      },
      flatbed: {
        name: 'ATLAS CARGO FLATBED',
        l: 94,
        w: 30,
        max: 220,
        acc: 98,
        turn: 1.1,
        hp: 370,
        mass: 5.8,
        brake: 190,
        grip: 6,
        truck: true,
        color: '#b69b68',
      },
      roadster: {
        name: 'SOLSTICE SPIDER',
        l: 42,
        w: 22,
        max: 435,
        acc: 218,
        turn: 2.7,
        hp: 120,
        mass: 1.12,
        brake: 325,
        grip: 8.4,
        color: '#b85b48',
      },
      rally: {
        name: 'KODIAK RS',
        l: 39,
        w: 23,
        max: 385,
        acc: 242,
        turn: 2.65,
        hp: 175,
        mass: 1.38,
        brake: 330,
        grip: 11,
        color: '#557bb3',
      },
      limousine: {
        name: 'SOVEREIGN STRETCH',
        l: 76,
        w: 25,
        max: 280,
        acc: 113,
        turn: 1.18,
        hp: 290,
        mass: 3.4,
        brake: 198,
        grip: 5.8,
        color: '#222b37',
      },
      hotrod: {
        name: 'HELLFIRE CUSTOM',
        l: 46,
        w: 24,
        max: 405,
        acc: 270,
        turn: 1.95,
        hp: 145,
        mass: 1.5,
        brake: 250,
        grip: 5.2,
        color: '#943d42',
      },
      bike: {
        name: 'VORTEX 900',
        l: 30,
        w: 10,
        max: 455,
        acc: 260,
        turn: 3.1,
        hp: 85,
        mass: 0.3,
        brake: 360,
        grip: 9,
        bike: true,
        color: '#c4483c',
      },
      cruiser: {
        name: 'NOMAD CRUISER',
        l: 34,
        w: 12,
        max: 330,
        acc: 180,
        turn: 2.3,
        hp: 110,
        mass: 0.44,
        brake: 275,
        grip: 7,
        bike: true,
        color: '#313f4b',
      },
      supercar: {
        name: 'V12 TEMPEST',
        l: 45,
        w: 23,
        max: 510,
        acc: 275,
        turn: 2.5,
        hp: 130,
        mass: 1.35,
        brake: 350,
        grip: 9,
        color: '#d9b753',
      },
      luxury: {
        name: 'MONARCH V12',
        l: 52,
        w: 25,
        max: 335,
        acc: 165,
        turn: 1.7,
        hp: 205,
        mass: 2.05,
        brake: 250,
        grip: 6,
        color: '#283b4c',
      },
      suv: {
        name: 'RANGER 4X4',
        offroad: true,
        l: 49,
        w: 26,
        max: 285,
        acc: 150,
        turn: 1.8,
        hp: 250,
        mass: 2.3,
        brake: 230,
        grip: 6,
        color: '#54684f',
      },
      pickup: {
        name: 'WORKHORSE',
        l: 59,
        w: 26,
        max: 270,
        acc: 126,
        turn: 1.6,
        hp: 280,
        mass: 2.7,
        brake: 205,
        truck: true,
        color: '#70899a',
      },
      truck: {
        name: 'ATLAS BOX TRUCK',
        l: 86,
        w: 31,
        max: 225,
        acc: 82,
        turn: 1.05,
        hp: 420,
        mass: 6.8,
        brake: 145,
        grip: 5,
        truck: true,
        color: '#b4b9ad',
      },
      bus: {
        name: 'METRO CITY BUS',
        l: 96,
        w: 31,
        max: 195,
        acc: 68,
        turn: 0.88,
        hp: 480,
        mass: 9,
        brake: 130,
        grip: 5,
        truck: true,
        color: '#b78b45',
      },
      ambulance: {
        name: 'PARAMEDIC',
        l: 59,
        w: 27,
        max: 300,
        acc: 143,
        turn: 1.7,
        hp: 265,
        mass: 2.9,
        brake: 230,
        truck: true,
        color: '#dfdfd3',
      },
      speedboat: {
        name: 'STINGRAY SPEEDBOAT',
        l: 58,
        w: 25,
        max: 310,
        acc: 140,
        turn: 1.45,
        hp: 180,
        mass: 1.4,
        boat: true,
        color: '#e0ddce',
      },
      workboat: {
        name: 'HARBOR LAUNCH',
        l: 72,
        w: 30,
        max: 170,
        acc: 70,
        turn: 0.95,
        hp: 300,
        mass: 4.2,
        boat: true,
        color: '#729b9c',
      },
      coupe: {
        mass: 1.25,
        name: 'VOLT COUPE',
        l: 40,
        w: 20,
        max: 355,
        acc: 177,
        turn: 2.5,
        hp: 130,
        color: '#8dbdb7',
      },
      muscle: {
        mass: 1.65,
        name: 'DUKE V8',
        l: 47,
        w: 23,
        max: 390,
        acc: 196,
        turn: 2.05,
        hp: 160,
        color: '#b55142',
      },
      taxi: {
        mass: 1.5,
        name: 'CITY CAB',
        l: 43,
        w: 23,
        max: 300,
        acc: 151,
        turn: 2.15,
        hp: 145,
        color: '#d9ac3e',
      },
      van: {
        mass: 2.35,
        name: 'MULE VAN',
        l: 48,
        w: 26,
        max: 235,
        acc: 121,
        turn: 1.6,
        hp: 240,
        color: '#b8b8a0',
      },
      sport: {
        mass: 1.1,
        name: 'COMET GT',
        l: 42,
        w: 21,
        max: 460,
        acc: 230,
        turn: 2.8,
        hp: 110,
        color: '#cf806d',
      },
      sedan: {
        mass: 1.45,
        name: 'REGENT',
        l: 43,
        w: 22,
        max: 290,
        acc: 146,
        turn: 2.15,
        hp: 150,
        color: '#bdbdb3',
      },
      jetski: {
        name: 'RIPTIDE JET SKI',
        l: 29,
        w: 13,
        max: 380,
        acc: 220,
        turn: 2.5,
        hp: 110,
        mass: 0.45,
        boat: true,
        jetski: true,
        color: '#e9ad4b',
      },
      helicopter: {
        name: 'MAVERICK HELICOPTER',
        l: 86,
        w: 34,
        max: 340,
        acc: 130,
        turn: 1.6,
        hp: 220,
        mass: 2.2,
        color: '#344b59',
      },
      police: {
        mass: 1.6,
        name: 'PATROL UNIT',
        l: 45,
        w: 23,
        max: 370,
        acc: 205,
        turn: 2.5,
        hp: 180,
        color: '#e0dfc7',
      },
    };
    function vehicleSpec(vehicle) {
      return vehicle?.type === 'plane' && vehicle.airframe
        ? {
            ...VEHICLE_DEFINITIONS.plane,
            ...AIRFRAME_SPECS[vehicle.airframe],
          }
        : VEHICLE_DEFINITIONS[vehicle?.type];
    }
    // Conservative vertical envelope, including an aircraft's tail fin.
    function vehicleCollisionHeight(vehicle) {
      return vehicleSpec(vehicle)?.height ?? 32;
    }
    const weapons = [
      {
        owned: true,
        name: '9MM PISTOL',
        clip: 12,
        ammo: 12,
        reserve: 96,
        rate: 0.28,
        dmg: 28,
        speed: 780,
        spread: 0.018,
        load: 0.9,
      },
      {
        owned: false,
        name: 'MACHINE PISTOL',
        clip: 30,
        ammo: 30,
        reserve: 150,
        rate: 0.085,
        dmg: 17,
        speed: 850,
        spread: 0.085,
        load: 1.25,
      },
      {
        owned: false,
        name: 'PUMP SHOTGUN',
        clip: 6,
        ammo: 6,
        reserve: 36,
        rate: 0.7,
        dmg: 19,
        speed: 740,
        spread: 0.16,
        pellets: 6,
        load: 1.6,
      },
      {
        owned: false,
        name: 'BAZOOKA',
        clip: 1,
        ammo: 1,
        reserve: 8,
        rate: 0.8,
        dmg: 180,
        speed: 410,
        spread: 0,
        load: 1.8,
        rocket: true,
      },
      {
        owned: false,
        name: 'ASSAULT RIFLE',
        clip: 30,
        ammo: 30,
        reserve: 150,
        rate: 0.12,
        dmg: 33,
        speed: 1100,
        spread: 0.03,
        load: 1.5,
      },
      {
        owned: false,
        name: 'PRECISION RIFLE',
        clip: 5,
        ammo: 5,
        reserve: 30,
        rate: 1.1,
        dmg: 105,
        speed: 1500,
        spread: 0.003,
        load: 1.9,
      },
    ];
    const missions = [];
    // @include src/audio.js
    function tell(text, duration = 3) {
      getElement('toast').textContent = text;
      getElement('toast').classList.add('show');
      toastTime = duration;
    }
    function announce(small, big, t = 3) {
      getElement('announceSmall').textContent = small;
      getElement('announceBig').textContent = big;
      getElement('announcement').classList.add('show');
      announceTime = t;
    }
    let wantedPressure = 0,
      wantedLevel = 0,
      starElapsed = 0;
    function updateStarProgress(deltaSeconds) {
      const visible = Math.ceil(wantedStars);
      if (visible !== wantedLevel) {
        wantedLevel = visible;
        wantedPressure = Math.max(wantedPressure, visible);
        starElapsed = 0;
      }
      if (!visible) return;
      starElapsed += deltaSeconds;
      const delay = [0, 16, 20, 24, 28][visible] || 28;
      if (visible < 5 && wantedPressure >= visible + 0.75 && starElapsed >= delay) {
        wantedStars = visible + 1;
        wantedLevel = visible + 1;
        starElapsed = 0;
        tell('DISPATCH ESCALATING · ' + wantedLevel + ' STARS', 3);
      }
    }
    function crime(amount = 1) {
      if (harborPoliceProtected(player.x, player.y, 40)) return;
      if (wantedStars <= 0) {
        wantedStars = 1;
        wantedLevel = 1;
        wantedPressure = 1;
        starElapsed = 0;
      }
      wantedPressure = clamp(
        Math.max(wantedPressure, Math.ceil(wantedStars)) + Math.max(0, amount) * 0.35,
        0,
        5.75,
      );
      searchActive = false;
      searchRemaining = policeSearchSeconds();
      lastSeen = {
        x: player.x,
        y: player.y,
      };
    }
    /**
     * BUILDING GRID
     * solid() and shotBlocked() run thousands of times per frame (every pedestrian
     * step, bullet and spawn test). Buildings are bucketed into 256-unit cells once
     * after buildWorld() so each query touches a handful of candidates instead of
     * every building in the city. Rebuilt by buildBuildingGrid() when buildings change.
     *
     * solid()'s fourth argument, `overWater`, is what lets the player swim: with it
     * set, open water stops counting as solid while everything else still does. Only
     * moveBody() passes it, and only for the player on foot -- traffic and
     * pedestrians must keep to the land.
     */
    const BUILDING_CELL = 256,
      buildingGrid = new Map(),
      noBuildings = [];
    function buildBuildingGrid() {
      buildingGrid.clear();
      for (const b of buildings) {
        const x0 = Math.floor((b.x - 8) / BUILDING_CELL),
          x1 = Math.floor((b.x + b.w + 8) / BUILDING_CELL),
          y0 = Math.floor((b.y - 8) / BUILDING_CELL),
          y1 = Math.floor((b.y + b.h + 8) / BUILDING_CELL);
        for (let i = x0; i <= x1; i++)
          for (let j = y0; j <= y1; j++) {
            const key = i * 4096 + j;
            let cell = buildingGrid.get(key);
            if (!cell) buildingGrid.set(key, (cell = []));
            cell.push(b);
          }
      }
    }
    /* The tallest roof within reach: an overhead camera gives no depth cue, so the
       flight readout says how much air there is between you and the rooftops. */
    function roofHeightNear(x, y, radius = 280) {
      let top = 0;
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (const b of buildingsNear(x + i * radius, y + j * radius)) {
            if (b.x - radius > x || b.x + b.w + radius < x) continue;
            if (b.y - radius > y || b.y + b.h + radius < y) continue;
            if (b.height > top) top = b.height;
          }
      return top;
    }
    function buildingsNear(x, y) {
      if (!buildingGrid.size) return buildings;
      return buildingGrid.get(Math.floor(x / BUILDING_CELL) * 4096 + Math.floor(y / BUILDING_CELL)) || noBuildings;
    }
    function solid(x, y, r = 8, overWater = false) {
      if (
        sportsBlocked(x, y, r) ||
        railBlocked(x, y, r) ||
        parkPondBlocked(x, y, r) ||
        underpassBlocked(x, y, r) ||
        airportSceneryBlocked(x, y, r) ||
        garageBlocked(x, y, r) ||
        parkBlocked(x, y, r) ||
        marinaBlocked(x, y, r) ||
        beachBlocked(x, y, r) ||
        (!overWater && !groundAt(x, y, r)) ||
        harborBlocked(x, y, r) ||
        depotBlocked(x, y, r) ||
        ((x > CITY_SIZE || y > CITY_SIZE) && (countyBlocked(x, y, r) || militaryBlocked(x, y, r)))
      )
        return true;
      // Radii above 8 can straddle a cell edge; fall back to the full list for those rare calls.
      const candidates = r > 8 ? buildings : buildingsNear(x, y);
      for (const b of candidates) {
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      return false;
    }
    function moveBody(body, displacementX, displacementY, collisionRadius) {
      if (body === player && player.roof)
        return moveOnRoof(displacementX, displacementY, collisionRadius);
      if (body === player && player.deck)
        return moveOnDeck(displacementX, displacementY, collisionRadius);
      if (body === player && player.buildingRoof)
        return moveOnBuildingRoof(displacementX, displacementY, collisionRadius);
      let hit = false;
      // Vehicle test: a cheap bounding box rejects almost every vehicle before the
      // rotated point-in-car test (this runs for every pedestrian step each frame).
      // On foot the player may leave the shore: the water is somewhere to be, not
      // a wall. Everyone else is still stopped by it.
      const swimmer =
          body === player && !player.car && !player.roof && !player.deck && !player.parachute,
        reach = 90 + collisionRadius,
        blocked = (x, y) => {
          if (solid(x, y, collisionRadius, swimmer)) return true;
          // Where the player may cross the shoreline (beaches, ladders): water.js.
          if (swimmer && shoreStepBlocked(body.x, body.y, x, y, collisionRadius)) return true;
          if (body.police && harborPoliceProtected(x, y, collisionRadius)) return true;
          for (let i = 0; i < vehicles.length; i++) {
            const c = vehicles[i];
            if (c.x - x > reach || x - c.x > reach || c.y - y > reach || y - c.y > reach) continue;
            if ((!isAircraft(c) || aircraftClearance(c) < 20) && pointInCar(x, y, c, collisionRadius))
              return true;
          }
          return false;
        };
      if (!blocked(body.x + displacementX, body.y)) body.x += displacementX;
      else hit = true;
      if (!blocked(body.x, body.y + displacementY)) body.y += displacementY;
      else hit = true;
      return hit;
    }
    function roadNear(v) {
      return ROAD_CENTERS.reduce((a, b) => (Math.abs(a - v) < Math.abs(b - v) ? a : b));
    }
    function rowNear(v) {
      return ROAD_ROWS.reduce((a, b) => (Math.abs(a - v) < Math.abs(b - v) ? a : b));
    }
    function onRoad(x, y) {
      return cityStreetAt(x, y);
    }
    function makeCar(type, x, y, headingRadians = 0, autonomous = false, color) {
      const vehicleDefinition = VEHICLE_DEFINITIONS[type],
        vehicle = {
          id: nextVehicleId++,
          type,
          x,
          y,
          a: headingRadians,
          speed: 0,
          hp: vehicleDefinition.hp,
          maxhp: vehicleDefinition.hp,
          color: color || vehicleDefinition.color,
          ai: autonomous,
          cop: type === 'police' && autonomous,
          turnWait: 2,
          stuck: 0,
          hitWait: 0,
          deadTime: 0,
          mission: false,
          sprite: null,
          altitude: 0,
          vz: 0,
          av: 0,
          damage: freshDamage(),
          dents: [],
          damageVersion: 0,
        };
      vehicles.push(vehicle);
      if (autonomous) assignDriver(vehicle);
      return vehicle;
    }
    function canSpawnCar(type, x, y, a = 0, margin = 7, airframe) {
      if (inStadiumLot(x, y, 12)) return false;
      const vehicle = {
          type,
          x,
          y,
          a,
          airframe,
        },
        shape = vehicleShape(vehicle, margin);
      if (
        [...nearbyStatics(vehicle)].some(
          (b) =>
            (b.minHeight === undefined ||
              terrainHeight(x, y) + vehicleCollisionHeight(vehicle) >= b.minHeight) &&
            boxContact(shape, b),
        )
      )
        return false;
      if (
        corners(shape).some((p) => railBlocked(p.x, p.y, 3) || garageBlocked(p.x, p.y)) ||
        inGarageLot(x, y, 10) ||
        corners(shape).some((p) => !groundAt(p.x, p.y)) ||
        buildings.some((b) =>
          boxContact(shape, {
            x: b.x + b.w / 2,
            y: b.y + b.h / 2,
            hx: b.w / 2,
            hy: b.h / 2,
            a: 0,
          }),
        ) ||
        AIRPORT_SCENERY_SOLIDS.some((b) =>
          boxContact(shape, {
            x: b.x + b.w / 2,
            y: b.y + b.h / 2,
            hx: b.w / 2,
            hy: b.h / 2,
            a: 0,
          }),
        ) ||
        harborVehicleBlocked(vehicle) ||
        militaryVehicleBlocked(vehicle) ||
        corners(shape).some((p) => countyBlocked(p.x, p.y))
      )
        return false;
      return !vehicles.some(
        (o) => (o.altitude || 0) < 20 && boxContact(shape, vehicleShape(o, margin)),
      );
    }
    function spawnClearCar(type, x, y, a = 0, ai = false, color) {
      for (let r = 0; r < 330; r += 24)
        for (let i = 0; i < (r ? 24 : 1); i++) {
          const px = x + Math.cos((i * TAU) / 24) * r,
            py = y + Math.sin((i * TAU) / 24) * r;
          if (canSpawnCar(type, px, py, a)) return makeCar(type, px, py, a, ai, color);
        }
      throw Error('No clear vehicle spawn for ' + type);
    }
    // One texture covers the whole city including the northern reclamation, so it
    // is taller than it is wide. The pixels-per-unit ratio is held below the old
    // 4096-square texture's so the bitmap does not grow with the city.
    const GROUND_PIXELS_PER_UNIT = 3072 / CITY_SIZE;
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = Math.ceil(CITY_WIDTH * GROUND_PIXELS_PER_UNIT);
    groundCanvas.height = Math.ceil(CITY_HEIGHT * GROUND_PIXELS_PER_UNIT);
    const groundContext = groundCanvas.getContext('2d');
    groundContext.scale(GROUND_PIXELS_PER_UNIT, GROUND_PIXELS_PER_UNIT);
    groundContext.translate(-CITY_LEFT, -CITY_TOP);
    function rect(x, y, w, h, c) {
      groundContext.fillStyle = c;
      groundContext.fillRect(x, y, w, h);
    }
    function label(text, x, y, size = 11, color = '#bcbbae') {
      groundContext.save();
      groundContext.fillStyle = color;
      groundContext.font = 'bold ' + size + 'px monospace';
      groundContext.textAlign = 'center';
      groundContext.fillText(text, x, y);
      groundContext.restore();
    }
    /**
     * ZONING
     * Building height follows the district, the way a real skyline does: a
     * financial core of towers whose height falls off with distance from the
     * centre, mid-rise Midtown and South Bank, low brick Old Quarter, sheds on
     * the docks, and pastel two-to-four storey Art Deco on the Keys with taller
     * hotels along Ocean Drive. `index` gives deterministic variation.
     */
    function zoneHeight(x, y, w, style, index) {
      const cx = x + w / 2,
        vary = ((index * 7919) % 100) / 100;
      if (style === 2) return 34 + vary * 22;
      if (onPalmKeys(x)) {
        if (y < 1500) return 24 + vary * 26;
        // The tall hotels line Ocean Dr (x -2432) on the island's sea side.
        if (y < 3100) return cx < -2150 ? 54 + vary * 46 : 34 + vary * 30;
        if (y < 4400) return 22 + vary * 20;
        return 20 + vary * 18;
      }
      if (y < 0) {
        // Northern reclamation. The tower core stands on the north-east point and
        // falls away westward to the marina, which is kept deliberately low so the
        // masts and the liner are the tallest things on that shore.
        if (cx < 1750 && y < -2400) return 26 + vary * 30;
        const core = clamp(Math.hypot(cx - 2820, y + 2620) / 1320, 0, 1),
          tower = Math.pow(1 - core, 2);
        return 58 + tower * 540 + vary * (48 + tower * 70);
      }
      if (y < 1450) return cx > 2500 ? 30 + vary * 18 : 30 + vary * 26;
      if (y < 2650) return cx > 1700 && cx < 2300 ? 56 + vary * 30 : 62 + vary * 55;
      // The old exchange district kept its name and its density but not its towers:
      // the banks moved north to the point when the reclamation opened.
      if (y < 3700) return cx < 1800 ? 60 + vary * 46 : 82 + vary * 96;
      if (y < 4650) return 50 + vary * 45;
      return 30 + vary * 24;
    }
    function makeBuilding(x, y, w, h, style, force = false) {
      if (
        !force &&
        [
          [x, y],
          [x + w, y],
          [x, y + h],
          [x + w, y + h],
          [x + w / 2, y + h / 2],
        ].some((p) => onBoulevard(p[0], p[1], 28))
      )
        return null;
      const tropical = onPalmKeys(x);
      const b = {
        x,
        y,
        w,
        h,
        style,
        tropical,
        height: zoneHeight(x, y, w, style, buildings.length),
      };
      buildings.push(b);
      rect(x + 11, y + 16, w + 4, h + 4, '#11161789');
      rect(x - 3, y - 3, w + 6, h + 6, '#2b2d2c');
      const base =
        style === 2
          ? '#645849'
          : style === 1
            ? '#585b53'
            : randomChoice(['#8a7563', '#737780', '#696c64', '#91846c', '#687c7a', '#866e69']);
      rect(x, y, w, h, base);
      rect(x, y + h - 11, w, 11, '#383b37');
      rect(x + w - 9, y, 9, h, '#41433c');
      rect(
        x + 5,
        y + 5,
        w - 18,
        h - 25,
        randomChoice(['#5d5851', '#535c61', '#6c6559', '#4f6461', '#655859']),
      );
      groundContext.strokeStyle = '#858673';
      groundContext.lineWidth = 2;
      groundContext.strokeRect(x + 7, y + 7, w - 23, h - 28);
      for (let i = 0; i < (w * h) / 65; i++) {
        const px = x + 9 + seededRandom() * (w - 28),
          py = y + 9 + seededRandom() * (h - 32);
        rect(
          px,
          py,
          seededRandom() * 3 + 1,
          1,
          randomChoice(['#999b822a', '#151b1826', '#bcc39e17']),
        );
      }
      if (style === 2) {
        for (let a = x + 13; a < x + w - 24; a += 14) rect(a, y + 10, 2, h - 34, '#9f91744a');
      }
      const units = Math.max(1, Math.floor((w * h) / 9000));
      for (let j = 0; j < units; j++) {
        const ux = x + 18 + seededRandom() * (w - 59),
          uy = y + 19 + seededRandom() * (h - 63);
        rect(ux + 4, uy + 4, 24, 25, '#272f2999');
        rect(ux, uy, 23, 22, '#7b7c6d');
        rect(ux + 2, uy + 2, 19, 18, '#666e66');
        groundContext.strokeStyle = '#353e38';
        groundContext.lineWidth = 1;
        for (let q = 4; q < 17; q += 3) {
          groundContext.beginPath();
          groundContext.moveTo(ux + 4, uy + q);
          groundContext.lineTo(ux + 19, uy + q);
          groundContext.stroke();
        }
      }
      for (let px = x + 10; px < x + w - 12; px += 15) {
        rect(px, y + h - 9, 6, 4, seededRandom() > 0.45 ? '#b0b895' : '#222b28');
        rect(px, y - 1, 5, 3, '#a2a48b');
      }
      if (seededRandom() > 0.65) {
        rect(x + w / 2 - 17, y + h - 22, 34, 12, '#212d26');
        rect(x + w / 2 - 13, y + h - 20, 26, 5, '#99a88c');
      }
    }
    function drawTree(x, y, r = 17) {
      if (!landAt(x, y)) return;
      groundContext.fillStyle = '#111a1558';
      groundContext.beginPath();
      groundContext.ellipse(x + 7, y + 10, r * 0.85, r * 0.75, 0, 0, TAU);
      groundContext.fill();
      rect(x - 2, y - 2, 4, 13, '#4b4634');
      for (let j = 0; j < 6; j++) {
        groundContext.fillStyle = randomChoice([
          '#3d5f46',
          '#496b4c',
          '#537450',
          '#385842',
          '#607c51',
        ]);
        groundContext.beginPath();
        groundContext.arc(x + Math.cos(j) * r * 0.4, y + Math.sin(j) * r * 0.35, r * 0.68, 0, TAU);
        groundContext.fill();
      }
      for (let j = 0; j < 9; j++) {
        rect(
          x + randomBetween(-r * 0.6, r * 0.6),
          y + randomBetween(-r * 0.6, r * 0.6),
          3,
          2,
          '#92a46b46',
        );
      }
      trees.push({
        x,
        y,
        r,
      });
    }
    function buildWorld() {
      groundContext.save();
      coastPath(groundContext);
      groundContext.clip();
      rect(CITY_LEFT, CITY_TOP, CITY_WIDTH, CITY_HEIGHT, '#334a48');
      // The speckle keeps its old sweep over Northbank first so the seeded
      // sequence (and every building drawn after it) is unchanged, then covers
      // the western part of the frame with a local generator.
      for (let x = 0; x < CITY_SIZE; x += 32)
        for (let y = CITY_TOP; y < CITY_SIZE; y += 26) {
          if (seededRandom() > 0.6)
            rect(x + seededRandom() * 20, y, randomBetween(5, 16), 1, '#7795812b');
        }
      for (let x = CITY_LEFT, k = 0; x < 0; x += 32)
        for (let y = CITY_TOP; y < CITY_SIZE; y += 26, k++) {
          const h = Math.sin(k * 12.9898) * 43758.5453,
            u = h - Math.floor(h);
          if (u > 0.6) rect(x + (u - 0.6) * 50, y, 5 + (u - 0.6) * 27, 1, '#7795812b');
        }
      rect(CITY_LEFT + 48, CITY_TOP + 48, CITY_WIDTH - 112, CITY_HEIGHT - 112, '#696d60');
      paintCityStreets(groundContext, true);
      paintMarina(groundContext);
      for (const bx of BLOCK_COLUMNS)
        for (let by = BLOCK_Y_MIN; by <= BLOCK_Y_MAX; by++) {
          const x = blockX(bx) + 89,
            y = blockY(by) + 89,
            w = 334,
            h = 334;
          if (y > 0 && x + w > RIVER.left && x < RIVER.right) continue;
          if (stadiumOverlap(x, y, w, h)) continue;
          const civicPlace = PLACES.find((p) => p.bx === bx && p.by === by);
          if (
            !civicPlace &&
            (!validCityBlock(x, y, w, h) || harborOverlap(x, y, w, h) || depotOverlap(x, y, w, h))
          )
            continue;
          if (bx === 2 && by === 7) {
            makeBuilding(x + 10, y + 10, 300, 145, 1);
            buildings[buildings.length - 1].height = 64;
            // Its roof carries a helipad (rooftops.js).
            buildings[buildings.length - 1].policeHQ = true;
            rect(x + 10, y + 170, 300, 158, '#515f68');
            label('SOUTH COAST POLICE', x + 160, y + 170, 15, '#bddfea');
            continue;
          }
          const place = PLACES.find((p) => p.bx === bx && p.by === by);
          if (place) {
            makeBuilding(place.x, place.y, place.w, place.h, place.kind === 'hospital' ? 1 : 0);
            Object.assign(buildings[buildings.length - 1], {
              height: place.height,
              place: place.id,
              roofBar: place.kind === 'rooftop',
            });
            if (place.kind === 'rooftop') {
              rect(place.x - 12, place.y - 12, place.w + 24, 12, '#bcb6a7');
              rect(place.x - 12, place.y + place.h, place.w + 24, 29, '#bcb6a7');
            } else
              rect(
                x + 8,
                place.y + place.h + 4,
                318,
                Math.max(30, y + 324 - place.y - place.h),
                '#6e766d',
              );
            rect(place.door.x - 126, place.door.y - 15, 252, 23, '#15212a');
            rect(place.door.x - 126, place.door.y + 7, 252, 2, place.color);
            label(place.name, place.door.x, place.door.y + 1, 12, place.color);
            for (const side of [-1, 1])
              drawTree(
                place.door.x + side * (place.kind === 'rooftop' ? 125 : 80),
                place.door.y + (place.kind === 'rooftop' ? -11 : 14),
                place.kind === 'rooftop' ? 10 : 15,
              );
            // Street lamps round a landmark's block as round any other: the two
            // outer ones on the front kerb (clear of the entrance) and the avenue kerb.
            for (const s of [0, 2]) lamps.push({ x: x + 22 + s * 144, y: y + h + 18 });
            for (let s = 0; s < 3; s++) lamps.push({ x: x + w + 18, y: y + 20 + s * 150 });
            continue;
          }
          if (isPark(bx, by)) continue;
          // The Ironworks sheds are the three rows south of the old north shore.
          // Without the lower bound this also caught the whole reclamation, which
          // is why the new tower district came out as warehouses.
          const industrial = bx >= 4 && bx < 7 && by >= 0 && by <= 2;
          if (industrial) {
            makeBuilding(x + 8, y + 8, w - 16, 140, 2);
            makeBuilding(x + 8, y + 203, 190, 120, 2);
            rect(x + 213, y + 196, 111, 126, '#51574d');
            for (let j = 0; j < 5; j++) {
              rect(
                x + 220 + (j % 2) * 52,
                y + 210 + ((j / 2) | 0) * 33,
                43,
                23,
                randomChoice(['#9c6651', '#6e8990', '#a7a16e']),
              );
              for (let k = 3; k < 40; k += 6)
                rect(x + 220 + (j % 2) * 52 + k, y + 210 + ((j / 2) | 0) * 33, 1, 23, '#191f2433');
            }
          } else {
            if (bx >= 7 || bx < 0) {
              makeBuilding(x + 28, y + 30, 262, 108, 0);
              if (by % 2 === 0) makeBuilding(x + 65, y + 205, 205, 94, 1);
              for (let z = 165; z < 335; z += 65) drawTree(x + 18, y + z, 16);
              continue;
            }
            const zone = districtAt(x + w / 2, y + h / 2),
              blockSeed = (bx * 31 + by * 17) % 7,
              perimeterBlock = zone === 'THE RECLAMATION' || zone === 'HARBOR POINT MARINA';
            if (zone.includes('FINANCIAL') && blockSeed % 2 === 0) {
              // One tower on a plaza: towers need air around them to read as towers.
              makeBuilding(x + 52, y + 12, w - 104, 140, 0);
              rect(x + 8, y + 8, 40, 150, '#8d9385');
              rect(x + w - 48, y + 8, 40, 150, '#8d9385');
              for (let z = 30; z < 150; z += 40) {
                drawTree(x + 28, y + z, 11);
                drawTree(x + w - 28, y + z, 11);
              }
            } else if (perimeterBlock) {
              // Reclamation blocks are perimeter buildings around a planted court:
              // a north range, two wings and a south range closing the court. The
              // south range replaces the generic back-lot building, which used to
              // be added on top and overlapped both wings and the court.
              makeBuilding(x + 7, y + 7, w - 15, 74, 0);
              makeBuilding(x + 7, y + 96, 88, 130, 1);
              makeBuilding(x + w - 95, y + 96, 88, 130, 1);
              makeBuilding(x + 7, y + 241, w - 15, 86, 1);
              rect(x + 104, y + 100, w - 210, 124, '#6f8a5c');
              for (let k = 0; k < 3; k++) drawTree(x + 130 + k * 52, y + 162, 14);
            } else if (zone.includes('OLD QUARTER') || zone === 'BATTERY POINT') {
              // Dense low-rise: three narrow lots with alleys between them.
              const lots = [7, 118, 229];
              for (let k = 0; k < 3; k++) makeBuilding(x + lots[k], y + 7, 98, 146, k === 1 ? 1 : 0);
              for (const ax of [105, 216]) rect(x + ax, y + 7, 13, 146, '#3d423f');
            } else {
              const split = randomBetween(132, 171);
              makeBuilding(x + 7, y + 7, split - 12, 146, 0);
              makeBuilding(x + split + 11, y + 7, w - split - 20, 146, 0);
            }
            if (perimeterBlock) {
              // Closed on all four sides above; nothing more to add.
            } else if (zone === 'SOUTH BANK' && blockSeed % 3 === 0) {
              // Residential slab with a courtyard instead of a parking court.
              makeBuilding(x + 7, y + 179, w - 15, 60, 1);
              rect(x + 40, y + 250, w - 80, 70, '#6f8a5c');
              for (let k = 0; k < 4; k++) drawTree(x + 60 + k * 70, y + 285, 13);
            } else makeBuilding(x + 7, y + 179, seededRandom() > 0.6 ? w - 15 : 155, 143, 1);
            if (!perimeterBlock && buildings[buildings.length - 1].w < 200) {
              rect(x + 181, y + 183, 145, 135, '#4b524b');
              for (let p = 0; p < 5; p++) {
                rect(x + 194 + p * 25, y + 187, 1, 49, '#d3d1a26b');
                rect(x + 194 + p * 25, y + 264, 1, 48, '#d3d1a26b');
              }
              label('P', x + 245, y + 260, 19, '#9aa08a');
            }
          }
          // Street planting on all four kerbs, not only the north side: a tree
          // line is most of what separates a city block from a car park.
          for (let s = 0; s < 3; s++) {
            drawTree(x + 55 + s * 110, y - 16, 12);
            drawTree(x + 55 + s * 110, y + h + 16, 12 + (s % 2) * 2);
            lamps.push({
              x: x + 22 + s * 144,
              y: y + h + 18,
            });
            rect(x + 19 + s * 144, y + h + 9, 3, 13, '#3f453a');
          }
          for (let s = 0; s < 2; s++) {
            drawTree(x - 16, y + 90 + s * 150, 11);
            drawTree(x + w + 16, y + 90 + s * 150, 11);
          }
          // Lamps down the avenue kerb too (east side, between the trees), so the
          // north-south streets are not dark canyons between lit cross streets.
          for (let s = 0; s < 3; s++) {
            lamps.push({ x: x + w + 18, y: y + 20 + s * 150 });
            rect(x + w + 16, y + 17 + s * 150, 3, 3, '#3f453a');
          }
        }
      // Waterfront promenades (the bridge decks come with paintDistrictGround).
      paintPromenades(groundContext);
      for (const pad of HELIPADS) {
        rect(pad.x - 49, pad.y - 49, 98, 98, '#52656a');
        groundContext.strokeStyle = '#e1d8ac';
        groundContext.lineWidth = 3;
        groundContext.beginPath();
        groundContext.arc(pad.x, pad.y, 35, 0, TAU);
        groundContext.stroke();
        label('H', pad.x, pad.y + 16, 44, '#e5dcbb');
      }
      const signs = [
        ['ROYAL CINEMA', 948, 1063, '#d2b571'],
        ['FREIGHT & CO.', 2880, 547, '#aab99f'],
        ['SOUTH PIER', 2869, 3108, '#d2c18b'],
        ['24 HOUR', 1470, 546, '#82b2a2'],
        ['LATE NIGHT', 465, 2085, '#c0a0aa'],
      ];
      for (const [s, x, y, c] of signs) {
        rect(x - 54, y - 10, 108, 18, '#1c2928');
        label(s, x, y + 3, 10, c);
      }
      for (let i = 0; i < 95; i++) {
        let x = randomChoice(ROAD_CENTERS) + randomChoice([-66, 66]),
          y = randomBetween(CITY_TOP + 200, 3300);
        if (!solid(x, y, 4)) {
          rect(x - 3, y - 4, 6, 8, '#3a5145');
          rect(x - 3, y - 5, 6, 2, '#899480');
        }
      }
      for (const d of DOCKS) {
        rect(d.x, d.y, d.w, d.h, '#938775');
        for (let x = d.x; x < d.x + d.w; x += 6) rect(x, d.y, 1, d.h, '#504d4344');
      }
      groundContext.restore();
      paintDistrictGround(groundContext);
      for (const d of DOCKS) {
        rect(d.x, d.y, d.w, d.h, '#938775');
        for (let x = d.x; x < d.x + d.w; x += 6) rect(x, d.y, 1, d.h, '#504d4344');
      }
      groundContext.save();
      coastPath(groundContext);
      groundContext.clip();
      makeBuilding(AIRPORT.x, AIRPORT.y, AIRPORT.w, AIRPORT.h, 1, true);
      buildings[buildings.length - 1].height = 42;
      makeBuilding(AIRPORT.hangar.x, AIRPORT.hangar.y, AIRPORT.hangar.w, AIRPORT.hangar.h, 2, true);
      groundContext.restore();
      label('H A R B O R   A V E N U E', 2175, 3194, 13, '#a6af9770');
      groundContext.save();
      groundContext.translate(640, 2230);
      groundContext.rotate(-Math.PI / 2);
      label('S U N S E T   B O U L E V A R D', 0, 0, 13, '#a6af9770');
      groundContext.restore();
      paintParks(groundContext);
      seedParkTrees();
      buildHarbor();
      buildVinnyDepot();
      buildSunsetPier();
      buildCounty();
      for (const r of SERVICE_ROADS.filter((r) => r.name.startsWith('SOUTHPORT ')))
        strokeRoad(groundContext, r.points, r.width, '#606664');
      paintServiceForecourts(groundContext, true);
      prepareGarages();
      paintGarages(groundContext);
      paintCasinoGround(groundContext);
      prepareRailInfrastructure();
      prepareSportsGround();
      paintSportsGround(groundContext);
      for (let i = lamps.length - 1; i >= 0; i--)
        if (!landAt(lamps[i].x, lamps[i].y)) lamps.splice(i, 1);
      // Nothing grows in a carriageway or through a viaduct pier. Kerb-line
      // planting is laid out per block, and where a boulevard, a county market
      // street or the railway runs along a block edge it used to land on them.
      const onServiceRoad = (x, y) =>
        SERVICE_ROADS.some((r) =>
          r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + 2),
        );
      for (let i = trees.length - 1; i >= 0; i--) {
        const t = trees[i];
        if (cityStreetAt(t.x, t.y, 2) || onServiceRoad(t.x, t.y) || railBlocked(t.x, t.y, 6)) trees.splice(i, 1);
      }
      // Lamp posts likewise (the head overhangs 6 units towards +x).
      for (let i = lamps.length - 1; i >= 0; i--) {
        const l = lamps[i];
        if (cityStreetAt(l.x, l.y, 2) || onServiceRoad(l.x, l.y) || railBlocked(l.x, l.y, 6)) lamps.splice(i, 1);
      }
    }
    function populate() {
      vehicles.length = 0;
      pedestrians.length = 0;
      enemies.length = 0;
      pickups.length = 0;
      officers.length = 0;
      bloodPools.length = 0;
      fires.length = 0;
      debris.length = 0;
      particles.length = 0;
      skids.length = 0;
      makeCar('coupe', 782, 576, 0, false, '#88bcaa');
      makeCar('bike', 850, 704, 0, false);
      makeCar('supercar', 975, 704, 0, false);
      // Clear of Royal Ave (x 1096..1208): at x 1100 its nose stood in the
      // southbound lane and traffic queued behind it for ever.
      makeCar('roadster', 1040, 704, 0);
      makeCar('rally', 1300, 704, 0);
      makeCar('hotrod', 1510, 576, 0);
      makeCar('limousine', -1614, 1728, 0);
      for (const d of DOCKS) makeCar(d.type, d.boatX, d.boatY, Math.PI / 2, false);
      for (const p of PLACES)
        if (p.kind === 'hospital') makeCar('ambulance', p.door.x + 94, p.door.y + 18, 0, false);
      makeCar('truck', 2850, 576, 0, false);
      makeCar('bus', 1410, 576, 0, false);
      for (const pad of HELIPADS) makeCar('helicopter', pad.x, pad.y, 0, false);
      for (let i = 0; i < 4; i++) makeCar('police', 1280 + i * 53, 3995, Math.PI / 2, false);
      for (const p of [
        {
          x: 2700,
          y: 1177,
        },
        {
          x: -1554,
          y: 3225,
        },
      ]) {
        const c = makeCar('police', p.x, p.y, 0, true);
        c.cop = false;
      }
      physicsAccumulator = 0;
      impactContacts.clear();
      for (let i = 0; i < 150; i++) {
        const vert = seededRandom() > 0.5,
          r = randomChoice(vert ? ROAD_CENTERS : ROAD_ROWS),
          v = vert
            ? randomBetween(CITY_TOP + 170, CITY_SIZE - 260)
            : randomBetween(CITY_LEFT + 170, CITY_SIZE - 260),
          dir = seededRandom() > 0.5 ? 1 : -1,
          x = vert ? r - dir * 25 : v,
          y = vert ? v : r + dir * 25,
          a = vert ? (dir * Math.PI) / 2 : dir === 1 ? 0 : Math.PI,
          type = randomChoice([
            'sedan',
            'sedan',
            'taxi',
            'coupe',
            'muscle',
            'van',
            'sport',
            'luxury',
            'suv',
            'pickup',
            'truck',
            'bus',
            'bike',
            'cruiser',
            'supercar',
            'roadster',
            'rally',
            'hotrod',
            'limousine',
          ]);
        if (
          Math.abs(v - (vert ? rowNear(v) : roadNear(v))) < 145 ||
          inHarbor(x, y, 70) ||
          !trafficSpawnValid(x, y, a) ||
          !canSpawnCar(type, x, y, a, 12)
        )
          continue;
        makeCar(
          type,
          x,
          y,
          a,
          true,
          type === 'taxi' ? VEHICLE_DEFINITIONS.taxi.color : randomChoice(VEHICLE_PAINT_COLORS),
        );
      }
      for (let i = 0; i < 70; i++) {
        const r = randomChoice(ROAD_ROWS),
          v = randomBetween(CITY_LEFT + 240, CITY_SIZE - 260),
          side = randomChoice([-1, 1]),
          x = v,
          y = r + side * 64,
          a = side > 0 ? 0 : Math.PI,
          type = randomChoice([
            'sedan',
            'van',
            'muscle',
            'sport',
            'taxi',
            'bike',
            'cruiser',
            'supercar',
            'luxury',
            'suv',
            'pickup',
            'roadster',
            'rally',
            'hotrod',
            'limousine',
          ]);
        if (
          !cityStreetAt(x, y, 30) ||
          Math.abs(v - rowNear(v)) < 125 ||
          inHarbor(x, y, 40) ||
          !canSpawnCar(type, x, y, a, 8)
        )
          continue;
        makeCar(type, x, y, a, false, randomChoice(VEHICLE_PAINT_COLORS));
      }
      const PED_COLORS = DRIVER_COLORS;
      for (let i = 0; i < 380; i++) {
        const vertical = seededRandom() > 0.5,
          r = randomChoice(vertical ? ROAD_CENTERS : ROAD_ROWS),
          v = vertical
            ? randomBetween(CITY_TOP + 180, CITY_SIZE - 260)
            : randomBetween(CITY_LEFT + 180, CITY_SIZE - 260),
          x = vertical ? r + randomChoice([-67, 67]) : v,
          y = vertical ? v : r + randomChoice([-67, 67]);
        if (!solid(x, y, 5) && !inHarbor(x, y, 8) && !vehicles.some((c) => pointInCar(x, y, c, 10))) {
          const walker = {
            x,
            y,
            a: vertical ? randomChoice([-Math.PI / 2, Math.PI / 2]) : randomChoice([0, Math.PI]),
            color: randomChoice(PED_COLORS),
            hp: 30,
            flee: 0,
            timer: randomBetween(0, 8),
            walk: seededRandom() * 5,
            state: 'walk',
          };
          pedestrians.push(walker);
          // Roughly one in five walkers has company.
          if (seededRandom() < 0.2) {
            const side = randomChoice([-1, 1]),
              px = x + Math.cos(walker.a + Math.PI / 2) * 9 * side,
              py = y + Math.sin(walker.a + Math.PI / 2) * 9 * side;
            if (!solid(px, py, 5))
              pedestrians.push({
                x: px,
                y: py,
                a: walker.a,
                color: randomChoice(PED_COLORS),
                hp: 30,
                flee: 0,
                timer: randomBetween(0, 8),
                walk: seededRandom() * 5,
                state: 'walk',
                leader: walker,
                pairSide: side,
              });
          }
        }
      }
      [
        [790, 745],
        [1290, 2176],
        [3200, 2780],
        [1650, 2820],
        [2655, 1140],
      ].forEach(([x, y]) =>
        pickups.push({
          x,
          y,
          type: 'health',
          ready: 0,
        }),
      );
      [
        [1040, 640],
        [2240, 2176],
        [2810, 1664],
        [2176, 2870],
        [640, 2688],
      ].forEach(([x, y]) =>
        pickups.push({
          x,
          y,
          type: 'ammo',
          ready: 0,
        }),
      );
      populateCasino();
      resetSports();
      [
        [128, 1800],
        [2700, 2176],
        [3200, 750],
      ].forEach(([x, y]) =>
        pickups.push({
          x,
          y,
          type: 'armor',
          ready: 0,
        }),
      );
    }
    function district() {
      return districtAt(player.x, player.y);
    }
    function particle(x, y, color, n = 8, speed = 100, size = 3) {
      for (let i = 0; i < n; i++) {
        let a = randomBetween(0, TAU),
          v = randomBetween(speed * 0.2, speed);
        particles.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: randomBetween(0.25, 0.8),
          max: 0.8,
          color,
          size: randomBetween(1, size),
        });
      }
    }
    function explode(x, y, power = 1, source = 'player', altitude = terrainHeight(x, y)) {
      const blast = {
          x,
          y,
          altitude,
        },
        distance = (e) => Math.hypot(e.x - x, e.y - y, entityElevation(e) - altitude),
        attacker = source === 'player' ? player : typeof source === 'object' ? source : null,
        proximity = clamp(1 - distance(player) / 800, 0, 1);
      notifyViolence(blast, 'explosion', attacker);
      playSample('explosion', 0.9, 0.9 + Math.random() * 0.12, blast);
      if (city3D) city3D.explosion(x, y, power, altitude);
      shake = Math.max(shake, 11 * power * proximity);
      flash = Math.max(flash, 0.15 * proximity);
      fires.push({
        x,
        y,
        altitude,
        power,
        life: 13 + power * 5,
        max: 13 + power * 5,
        emit: 0,
      });
      if (fires.length > 24) fires.shift();
      particle(x, y, '#e0b769', 40, 180, 9);
      particle(x, y, '#6c7165', 22, 110, 16);
      debris.push({
        x,
        y,
        altitude,
        life: 45,
      });
      for (const c of vehicles)
        if (c.hp > 0 && distance(c) < 95 * power && clearSight(blast, c))
          damageVehicle(c, Math.max(0, 200 * power - distance(c) * 1.6), x, y, attacker, {
            kind: 'blast',
            x,
            y,
            power,
            falloff: 1 - distance(c) / (95 * power),
          });
      // The shock wave shoves and spins cars, blows out glass, flattens street
      // furniture and scorches the nearest facades (damage.js).
      blastEffects(x, y, altitude, power);
      for (const e of [
        ...pedestrians,
        ...enemies,
        ...gangMembers,
        ...officers,
        ...storyActors.filter(
          (p) => p.missionTag === 'flight-witness' && !p.hidden && mission?.stage >= 4,
        ),
      ])
        if (e.hp > 0 && distance(e) < 85 * power && clearSight(blast, e)) {
          strikePerson(e, 200, headingBetween(blast, e), attacker, true, 'blast');
        }
      for (const animal of wildlife)
        if (animal.hp > 0 && distance(animal) < 85 * power && clearSight(blast, animal))
          strikeWildlife(animal, Math.max(0, 200 * power - distance(animal) * 1.6));
      const pd = distance(player);
      if (pd < 95 * power && clearSight(blast, player))
        hurt(Math.max(0, (95 * power - pd) * 0.75), 'blast');
      if (attacker === player) crime(0.5);
    }
    function hurt(d, kind = 'ballistic') {
      if (player.inv > 0 || gameMode !== 'play' || player.godMode) return;
      d = ballisticDamage(player, d, kind);
      player.hp -= d;
      if (d > 1 && !player.car) bleed(player, d / 35, player.a + Math.PI);
      flash = 0.12;
      if (player.hp <= 0) die();
    }
    function die() {
      if (transitRide) leaveTransit(transitRide.from, true);
      if (taxiRide) endTaxiRide(false);
      player.deck = null;
      if (player.coaster) {
        player.coaster = null;
        coasterTrain.running = false;
        coasterTrain.t = 0;
      }
      player.tumble = null;
      player.tumbleRoll = 0;
      if (player.roof || player.buildingRoof) {
        player.roof = false;
        player.buildingRoof = null;
        player.altitude = 0;
      }
      player.parachute = null;
      if (gameMode !== 'play') return;
      gameMode = 'dead';
      player.hp = 0;
      if (player.car) {
        player.car.ai = false;
        player.car.speed = 0;
        if (player.car.vx !== undefined) player.car.vx = player.car.vy = 0;
        player.car.av = 0;
        // A pilot who dies at the controls leaves the aircraft to fall, not hover.
        if (isAircraft(player.car)) player.car.abandonedFlight = true;
        player.car = null;
      }
      announce('THE CITY ALWAYS COLLECTS', 'WASTED', 4);
      noise(0.3, 0.4);
      setTimeout(() => {
        if (gameMode !== 'dead') return;
        cash = Math.max(0, cash - 250);
        player.hp = 100;
        player.armor = 0;
        player.inv = 3;
        player.x = PLACES.find((p) => p.kind === 'hospital').door.x;
        player.y = PLACES.find((p) => p.kind === 'hospital').door.y;
        clearPolice();
        resetOfficerCrews();
        gameMode = 'play';
        if (mission) failMission('Hospital bill: $250. Your job is ready to retry.');
        else tell('Back on your feet. Hospital bill: $250.', 4);
        save();
      }, 2600);
    }
    function nearestCar() {
      if (player.parachute) return null;
      let best = null,
        bd = 64;
      for (const vehicle of vehicles) {
        if (player.roof) return null;
        const d = distanceBetween(vehicle, player);
        // A helicopter parked on a roof is reached from that roof, not the street.
        if (isAircraft(vehicle) && Math.abs(entityElevation(vehicle) - entityElevation(player)) > 30) continue;
        if (vehicle.hp > 0 && aircraftClearance(vehicle) < 2 && d < bd) {
          best = vehicle;
          bd = d;
        }
      }
      return best;
    }
    function exitCar() {
      const vehicle = player.car;
      if (!vehicle) return;
      if (
        isAircraft(vehicle) &&
        (aircraftClearance(vehicle) > 1 || Math.hypot(vehicle.vx || 0, vehicle.vy || 0) > 12)
      ) {
        tell('Land and stop to exit, or press J to bail out with a parachute.');
        return;
      }
      // Parked on a roof: out onto the roof beside it (rooftops.js).
      if (vehicle.roofSite && isAircraft(vehicle)) {
        if (!exitOntoRoof(vehicle, vehicle.roofSite)) {
          tell('No room to get out on this roof.');
          return;
        }
        vehicle.vx = vehicle.vy = vehicle.speed = 0;
        player.car = null;
        player.inv = 0.5;
        tell('ROOFTOP · E at the helicopter to fly on', 2.5);
        tone(160, 0.06, 0.15, 'triangle');
        return;
      }
      let found = false;
      const vehicleDefinition = vehicleSpec(vehicle),
        candidates = isBoat(vehicle)
          ? [36, 48, 60, 72].flatMap((r) =>
              [Math.PI / 2, -Math.PI / 2, Math.PI, 0].map((a) => ({
                a: vehicle.a + a,
                r,
              })),
            )
          : [0, 14, 28].flatMap((extra) =>
              [Math.PI / 2, -Math.PI / 2, Math.PI, 0].map((a) => ({
                a: vehicle.a + a,
                r:
                  (Math.abs(Math.sin(a)) > 0.5 ? vehicleDefinition.w : vehicleDefinition.l) / 2 +
                  18 +
                  extra,
              })),
            );
      for (const { a, r } of candidates) {
        const x = vehicle.x + Math.cos(a) * r,
          y = vehicle.y + Math.sin(a) * r,
          floor = terrainHeight(x, y);
        if (
          !solid(x, y, 8) &&
          !vehicles.some((o) => Math.abs(entityElevation(o) - floor) < 20 && pointInCar(x, y, o, 9))
        ) {
          player.x = x;
          player.y = y;
          player.altitude = floor;
          found = true;
          break;
        }
      }
      if (!found && vehicle.hp <= 0) {
        // A wreck must never trap its driver: climb out onto the nearest clear ground.
        for (let r = 24; r < 1200 && !found; r += 32)
          for (let i = 0; i < 16 && !found; i++) {
            const x = vehicle.x + Math.cos((i * TAU) / 16) * r,
              y = vehicle.y + Math.sin((i * TAU) / 16) * r;
            if (!solid(x, y, 8) && !vehicles.some((o) => pointInCar(x, y, o, 9))) {
              player.x = x;
              player.y = y;
              player.altitude = terrainHeight(x, y);
              found = true;
            }
          }
      }
      // Out of a flooding car there is only the water (water.js).
      if (!found && vehicle.sinkFor > 0) found = exitIntoWater(vehicle);
      if (!found) {
        tell(
          isBoat(vehicle)
            ? 'Pull alongside a wooden dock to step off, or press J to dive in.'
            : 'No room to get out. Move away from the wall.',
        );
        return;
      }
      vehicle.ai = false;
      // Physics derives `speed` from vx/vy each step, so the rolling velocity must be cut too.
      vehicle.speed *= 0.45;
      if (vehicle.vx !== undefined) {
        vehicle.vx *= 0.45;
        vehicle.vy *= 0.45;
      }
      player.car = null;
      player.inv = 0.5;
      tell('On foot · F to fire · Shift to sprint', 1.8);
      tone(160, 0.06, 0.15, 'triangle');
    }
    function interact() {
      if (gameMode !== 'play' || player.parachute) return;
      // On a building roof the only thing to do is fly off again.
      if (player.buildingRoof && !player.car) {
        const c = nearestCar();
        if (c) enterVehicle(c);
        else tell('ROOFTOP · The helicopter is the only way down.', 2.5);
        return;
      }
      if (policeBlocksMissionDelivery()) return;
      if (transitInteract()) return;
      if (parkInteract()) return;
      if (marinaInteract()) return;
      if (taxiInteract()) return;
      if (
        rooftopMissionInteract() ||
        challengeMissionInteract() ||
        militaryInteract() ||
        harborInteract() ||
        interactRooftop()
      )
        return;
      if (player.car) {
        if (garageInteract()) return;
        exitCar();
        return;
      }
      const place = nearestPlace();
      if (place) {
        openService(place);
        return;
      }
      if (distanceBetween(player, phone) < 68 && !mission) {
        offerMission();
        return;
      }
      const c = nearestCar();
      if (c) {
        if (vehicleIsLocked(c)) {
          tell('LOCKED', 1.8);
          tone(140, 0.07, 0.2, 'square');
          return;
        }
        if (c.occupied) {
          ejectDriver(c, 'hijack');
          crime(0.8);
        }
        enterVehicle(c);
        return;
      }
      if (GARAGES.some((s) => distanceBetween(player, s) < 140))
        tell('Drive fully inside the open bay, stop, and press E. Respray and repair: $250.');
    }
    /* Taking the wheel: shared by the action key, the cab hijack and the getaway
       cars missions hand you, so every entry sets the same state. */
    function enterVehicle(c) {
        player.buildingRoof = null;
        player.car = c;
        c.ramUntil = 0;
        enforceVehicleHandgun();
        c.abandonedFlight = false;
        if (c.type === 'police' || c.military) c.stolen = true;
        c.gangTarget = null;
        player.x = c.x;
        player.y = c.y;
        player.a = c.a;
        if (c.ai || c.type === 'police') crime(c.type === 'police' ? 1.25 : 0.65);
        c.ai = false;
        c.cop = false;
        c.junction = null;
        c.navAngle = undefined;
        if (c.type === 'plane') {
          tell('AIRPLANE · W/S throttle · A/D bank · Space nose up · Shift nose down', 8);
        } else if (c.type === 'helicopter') {
          if (!c.authorized) crime(2);
          tell('HELICOPTER · Space rise · Shift descend · W/S fly · A/D turn', 7);
          radio('call-backup');
        } else if (c.type === 'tank') {
          militaryAlarm();
          tell('TRACKED ARMOR · W/S drive · A/D pivot · F cannon · Mouse aim optional', 6);
        } else if (isBoat(c))
          tell('W/S throttle · A/D steer · Space slow · E exit alongside a dock', 5);
        else if (c.type === 'bicycle')
          tell('CITY CYCLE · HOLD W to pedal · SHIFT stand on the pedals · S brake', 6);
        else tell(vehicleSpec(c).name + ' · W accelerate · A/D steer · Space handbrake', 3);
        tone(200, 0.12, 0.25, 'triangle');
    }
    function roofClearanceText(c) {
      const roof = roofHeightNear(c.x, c.y),
        clearance = c.altitude - roof;
      if (roof < 12) return Math.round(worldMeters(c.altitude - terrainHeight(c.x, c.y))) + ' m AGL';
      if (clearance < 0) return 'BELOW ROOFTOPS';
      return Math.round(worldMeters(clearance)) + ' m OVER ROOFS';
    }
    function startReload() {
      const w = currentWeapon();
      if (
        w.melee ||
        !weaponIsEquipped(selectedWeaponIndex) ||
        reloadSecondsRemaining ||
        w.ammo === w.clip ||
        w.reserve <= 0
      )
        return;
      reloadSecondsRemaining = w.load;
      reloadSound();
    }
    function aim() {
      if (touchAim !== null) return touchAim;
      if (mouse.active && city3D) return city3D.aim(mouse.x, mouse.y);
      let a = player.car ? player.car.a : player.a;
      if (mouse.active) {
        a = Math.atan2(
          mouse.y - ((player.y - cameraTarget.y) * canvasScale + viewportHeight / 2),
          mouse.x - ((player.x - cameraTarget.x) * canvasScale + viewportWidth / 2),
        );
      } else {
        let best = 0.8;
        for (const target of [
          ...enemies,
          ...gangMembers,
          ...officers,
          ...vehicles.filter((c) => c.cop),
        ]) {
          if (target.hp <= 0 || combatDistance(target, player) > 370 || !clearSight(player, target))
            continue;
          const ta = headingBetween(player, target),
            diff = Math.abs(normalizeAngle(ta - a));
          if (diff < best) {
            best = diff;
            a = ta;
          }
        }
      }
      return a;
    }
    function shoot() {
      if (player.parachute || transitRide) return;
      enforceVehicleHandgun();
      if (gameMode === 'play' && player.car?.type === 'tank') {
        player.car.turretA = aim();
        tankFire(player.car);
        return;
      }
      if (
        shotCooldownSeconds > 0 ||
        reloadSecondsRemaining > 0 ||
        gameMode !== 'play' ||
        player.swimming ||
        (player.roof && !rooftopJob()) ||
        !weaponIsEquipped(selectedWeaponIndex)
      )
        return;
      if (player.car && player.car.type !== 'tank' && selectedWeaponIndex !== 0) {
        tell('Carry the 9mm pistol to fire from a vehicle.');
        shotCooldownSeconds = 0.5;
        return;
      }
      const w = currentWeapon();
      if (w.melee) {
        attackWithKnife();
        return;
      }
      if (w.ammo <= 0) {
        if (w.reserve > 0) startReload();
        else {
          tell('Empty. Find a purple ammo crate or switch weapon.');
          shotCooldownSeconds = 0.5;
          tone(100, 0.03, 0.06);
        }
        return;
      }
      if (player.roof) rooftopShot();
      let a = aim();
      const shotTarget = playerShotTarget(a);
      if (shotTarget) a = headingBetween(player, shotTarget);
      let muzzle = player.car ? 30 : 14;
      w.ammo--;
      shotCooldownSeconds = w.rate;
      const ox = player.x + Math.cos(a) * muzzle,
        oy = player.y + Math.sin(a) * muzzle;
      for (let j = 0; j < (w.pellets || 1); j++) {
        let ba = a + randomBetween(-w.spread, w.spread);
        bullets.push({
          x: ox,
          y: oy,
          altitude: entityElevation(player),
          ...shotVelocity(
            {
              x: ox,
              y: oy,
              altitude: entityElevation(player),
            },
            shotTarget,
            w.speed,
            ba,
          ),
          life: w.rocket ? 1.8 : selectedWeaponIndex === 5 ? 1 : 0.6,
          dmg: w.dmg,
          rocket: w.rocket,
          enemy: false,
        });
      }
      particle(ox, oy, '#f4d990', 5, 70, 4);
      weaponSound(selectedWeaponIndex, ox, oy);
      if (city3D) city3D.fire(ox, oy, a, w.rocket, entityElevation(player));
      player.recoilUntil = gameTime + 0.12;
      notifyViolence(player, 'gunfire', player);
      crime(w.rocket ? 0.4 : 0.075);
      shake = Math.max(shake, w.rocket ? 5 : 1.4);
      if (!w.ammo && w.reserve) startReload();
    }
    function resetMissionState() {
      if (transitRide) leaveTransit(transitRide.from, true);
      if (taxiRide) endTaxiRide(false);
      player.deck = null;
      if (player.coaster) {
        player.coaster = null;
        coasterTrain.running = false;
        coasterTrain.t = 0;
      }
      player.tumble = null;
      player.tumbleRoll = 0;
      cleanupMissionExtras();
      clearDepotFloor();
      repairJob = null;
      player.parachute = null;
      for (let i = storyActors.length - 1; i >= 0; i--)
        if (storyActors[i].name === 'ELENA CRUZ') storyActors.splice(i, 1);
      if (player.roof) {
        player.roof = false;
        player.altitude = 0;
        player.x = ROOFTOP.door.x;
        player.y = ROOFTOP.door.y;
      }
      leaveBuildingRoof();
      enemies.length = 0;
      bullets.length = 0;
      clearPolice();
      // A chip left over from before the job (a "POLICE CLEARED!" from a chase
      // that ended as the payphone was answered) must not sit over its headline.
      hidePoliceNotice();
      resetOfficerCrews();
      player.hp = 100;
      player.armor = Math.max(player.armor, 50);
      player.inv = 2;
      reloadSecondsRemaining = 0;
      for (const w of weapons) {
        if (!w.owned) continue;
        w.ammo = w.clip;
        w.reserve = Math.max(w.reserve, w.clip * 5);
      }
      vehicles
        .filter((c) => c.mission || c.failedMission)
        .forEach((c) => {
          const i = vehicles.indexOf(c);
          if (player.car === c) player.car = null;
          if (i >= 0) vehicles.splice(i, 1);
        });
      vehicles
        .filter((c) => c.cop)
        .forEach((c) => {
          c.cop = false;
          c.ai = true;
        });
    }
    function aheadOf(t, seconds) {
      return {
        x: clamp(t.x + (t.vx || 0) * seconds, WORLD_LEFT + 40, WORLD_SIZE - 40),
        y: clamp(t.y + (t.vy || 0) * seconds, WORLD_TOP + 40, WORLD_SIZE - 40),
      };
    }
    function copRoute(c) {
      // An interceptor routes to where the runner will be, not to where they are:
      // half the patrol chases, the other half tries to be there first.
      const quarry = c.pursuitTarget || player.car || player,
        chaseTarget = c.interceptor ? aheadOf(quarry, 3.4) : c.pursuitTarget || player;
      if (
        c.x > CITY_SIZE ||
        c.y > CITY_SIZE ||
        chaseTarget.x > CITY_SIZE ||
        chaseTarget.y > CITY_SIZE
      )
        return countyCopRoute(c, chaseTarget);
      const start = {
          x: ROAD_CENTERS.indexOf(roadNear(c.x)),
          y: ROAD_ROWS.indexOf(rowNear(c.y)),
        },
        target = {
          x: ROAD_CENTERS.indexOf(roadNear(chaseTarget.x)),
          y: ROAD_ROWS.indexOf(rowNear(chaseTarget.y)),
        },
        key = (p) => p.x + ',' + p.y,
        queue = [start],
        visited = new Set([key(start)]),
        parents = new Map();
      let end = start;
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        if (
          Math.hypot(p.x - target.x, p.y - target.y) < Math.hypot(end.x - target.x, end.y - target.y)
        )
          end = p;
        if (key(p) === key(target)) {
          end = p;
          break;
        }
        for (const [d, e] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n = {
            x: p.x + d,
            y: p.y + e,
          };
          if (
            n.x < 0 ||
            n.x >= ROAD_CENTERS.length ||
            n.y < 0 ||
            n.y >= ROAD_ROWS.length ||
            visited.has(key(n))
          )
            continue;
          const nx = ROAD_CENTERS[n.x],
            ny = ROAD_ROWS[n.y],
            mx = (ROAD_CENTERS[p.x] + nx) / 2,
            my = (ROAD_ROWS[p.y] + ny) / 2;
          if (
            harborPoliceProtected(nx, ny, 45) ||
            harborPoliceProtected(mx, my, 45) ||
            !groundAt(nx, ny, 10) ||
            !groundAt(mx, my, 10) ||
            !cityStreetAt(mx, my)
          )
            continue;
          visited.add(key(n));
          parents.set(key(n), p);
          queue.push(n);
        }
      }
      const route = [];
      for (let p = end; p; p = parents.get(key(p)))
        route.unshift({
          x: ROAD_CENTERS[p.x],
          y: ROAD_ROWS[p.y],
        });
      if (route.length && distanceBetween(c, route[0]) < 55) route.shift();
      return route;
    }
    function spawnCop() {
      if (harborPoliceProtected(player.x, player.y, 120)) return;
      const occupied = vehicles.filter((c) => c.cop && c.hp > 0);
      if (occupied.length >= Math.ceil(wantedStars) * 2 + 1) return;
      if (player.x > CITY_SIZE || player.y > CITY_SIZE) {
        spawnCountyCop();
        return;
      }
      let points = [];
      for (const x of ROAD_CENTERS)
        for (const y of ROAD_ROWS) {
          const d = Math.hypot(x - player.x, y - player.y);
          if (
            d > 550 &&
            d < 1050 &&
            !inHarbor(x, y, 100) &&
            !solid(x, y, 30) &&
            !vehicles.some((c) => Math.hypot(c.x - x, c.y - y) < 70)
          )
            points.push({
              x,
              y,
            });
        }
      if (!points.length) return;
      const p = randomChoice(points),
        c = makeCar('police', p.x, p.y, headingBetween(p, player), true);
      c.speed = 140;
      c.interceptor = occupied.length % 2 === 1;
      c.route = copRoute(c);
      c.routeTime = 2;
    }
    // @include src/physics.js
    /**
     * PEDESTRIAN LIFE
     * Everyday chatter lives here; how people walk, what they do and how they
     * react to danger is in src/crowd.js, which also has the reaction lines.
     * All timers are seconds.
     */
    const PED_LINES = {
      panic: ['Get down!', 'Run!', 'He’s got a gun!', 'Call the cops!', 'Oh my god!', 'Somebody help!'],
      nearMiss: ['Hey! Watch it!', 'Slow down!', 'Are you crazy?!', 'I’ve got your plate!', 'Sidewalk, pal!'],
      bump: ['Watch it.', 'Excuse me!', 'Hey!', 'Do you mind?', 'Careful, buddy.'],
      idle: [
        'Nice night.',
        'Bus is late again.',
        'Did you see the game?',
        'I need a coffee.',
        'This city...',
        'Rent’s due Friday.',
        'Neon 88.7 all night.',
        'Kola tastes like pennies.',
        'Ferry’s cancelled. Again.',
        'Heard shots by the docks.',
      ],
      wanted: ['It’s him!', 'That’s the guy from the news!', 'Don’t look at him.', 'Cops are everywhere tonight.'],
      gym: [
        'Three more. Three.',
        'Control the negative, don’t drop.',
        'Elbows in on the dip.',
        'That set was clean.',
        'Thirty seconds rest, then again.',
        'You’re kipping. Strict or it doesn’t count.',
        'Grip goes before the back does.',
        'Chalk’s in my bag if you want it.',
        'Muscle-up by summer. I mean it this time.',
        'Legs tomorrow. Always tomorrow.',
        'Full range or it’s half a rep.',
        'Breathe out on the way up.',
        'Rings are wet, go easy.',
        'Twelve. New best.',
      ],
      vendor: [
        'Two tacos, no onion, coming up.',
        'Coffee’s fresh, five minutes old.',
        'Cash only, friend.',
        'Noodles are ready in a minute.',
        'Best lunch in the Garden.',
      ],
      shore: [
        'Best view in the city, right here.',
        'Ferry horn. Must be six already.',
        'Look at that liner.',
        'Smell that? Rain coming.',
        'Same walk every evening. Never gets old.',
        'Careful, the rail is wet.',
        'One more lap, then coffee.',
      ],
      deck: [
        'The whole skyline from up here!',
        'Sailing sets at six, they said.',
        'Is that the tower district?',
        'I am never getting off this boat.',
        'Photo by the rail, come on.',
        'The buffet reopens at four.',
        'Look how small the taxis are.',
        'Sea air. Finally.',
      ],
    };
    function pedSay(p, kind, chance = 1) {
      if ((p.speechUntil || 0) > gameTime || seededRandom() > chance) return;
      p.speech = randomChoice(PED_LINES[kind]);
      p.speechUntil = gameTime + 2.6;
    }
    function shopfrontNear(p) {
      // Standing on a south sidewalk directly in front of a building's street face.
      return buildingsNear(p.x, p.y - 14).some(
        (b) => !b.depotWall && p.x > b.x + 8 && p.x < b.x + b.w - 8 && Math.abs(p.y - (b.y + b.h + 14)) < 9,
      );
    }
    function nearestFreeBench(p, range) {
      let best = null,
        bestDistance = range;
      for (const spot of benchSpots()) {
        if (spot.taken && spot.taken.hp > 0 && spot.taken !== p) continue;
        const d = distanceBetween(p, spot);
        if (d < bestDistance) {
          best = spot;
          bestDistance = d;
        }
      }
      return best;
    }
    let peopleFrame = 0;
    /**
     * The per-frame pass over pedestrians. Special populations (ship decks,
     * promenade strollers, theme-park guests, carjacked drivers, gym regulars,
     * park walkers) run their own routines first; everyone else is handed to the
     * crowd (src/crowd.js): perception and reactions, street scenes, and the
     * ordinary walk along the sidewalk grid.
     */
    function updatePeople(frameDelta) {
      peopleFrame++;
      updateCrowd(frameDelta);
      const playerMoving = !player.car && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);
      for (let index = 0; index < pedestrians.length; index++) {
        const p = pedestrians[index];
        if (
          p.hp <= 0 ||
          personIncapacitated(p) ||
          Math.abs(p.x - player.x) > 1500 ||
          Math.abs(p.y - player.y) > 1500
        )
          continue;
        // Out of sight, people think and move every fourth frame (every sixth
        // beyond ~900 units); nobody can see the coarser steps.
        let deltaSeconds = frameDelta;
        if (!crowdInView(p.x, p.y, 140)) {
          const every = Math.abs(p.x - player.x) > 900 || Math.abs(p.y - player.y) > 900 ? 6 : 4;
          if ((peopleFrame + index) % every) continue;
          deltaSeconds = frameDelta * every;
        }
        if (p.onDeck) {
          updateDeckWalker(p, deltaSeconds);
          continue;
        }
        if (!p.look) ensureLook(p);
        if (updateStroller(p, deltaSeconds)) continue;
        if (updateParkGuest(p, deltaSeconds)) continue;
        if (updateCarjackReactions(p, deltaSeconds)) continue;
        if (updateCrowdPerson(p, deltaSeconds)) continue;
        if (updateGymGoer(p, deltaSeconds)) continue;
        if (updateParkWalker(p, deltaSeconds)) continue;
        // Everyday remarks to the player: bumped into, or recognised while wanted.
        const playerDistance = distanceBetween(p, player);
        if (playerDistance < 140) {
          if (playerMoving && playerDistance < 9) pedSay(p, 'bump', 0.5);
          else if (wantedStars >= 2 && seededRandom() < deltaSeconds * 0.25) {
            pedSay(p, 'wanted');
            p.sawPlayerAt = gameTime;
          }
        }
        updateStreetWalker(p, deltaSeconds);
      }
      updateGangFights(frameDelta);
    }
    function updateCombat(deltaSeconds) {
      for (let i = fires.length - 1; i >= 0; i--) {
        const fire = fires[i];
        fire.life -= deltaSeconds;
        if (fire.life <= 0) {
          fires.splice(i, 1);
          continue;
        }
        fire.emit -= deltaSeconds;
        if (fire.emit <= 0 && distanceBetween(fire, player) < 950) {
          fire.emit = 0.13;
          const life = randomBetween(0.5, 1.2);
          particles.push({
            x: fire.x + randomBetween(-15, 15) * fire.power,
            y: fire.y + randomBetween(-12, 12) * fire.power,
            vx: randomBetween(-8, 8),
            vy: randomBetween(-8, 8),
            z: (fire.altitude ?? terrainHeight(fire.x, fire.y)) + 4,
            vz: randomBetween(18, 40),
            life,
            max: life,
            color: randomChoice(['#ffae3d', '#ec6124', '#d13c1b']),
            size: randomBetween(5, 11) * fire.power,
            flame: true,
          });
        }
      }
    }
    function drawFire2D() {
      for (const fire of fires)
        if (visible(fire, 120)) {
          const fade = Math.min(1, fire.life / 3),
            r = (24 + Math.sin(gameTime * 19 + fire.x) * 3) * fire.power;
          worldContext.save();
          worldContext.globalAlpha = fade;
          const glow = worldContext.createRadialGradient(fire.x, fire.y, 1, fire.x, fire.y, r * 2);
          glow.addColorStop(0, '#ffbf5f7f');
          glow.addColorStop(1, '#ff692000');
          worldContext.fillStyle = glow;
          worldContext.fillRect(fire.x - r * 2, fire.y - r * 2, r * 4, r * 4);
          for (let i = 0; i < 6; i++) {
            const a = i * 2.4 + gameTime * 2,
              x = fire.x + Math.cos(a) * r * 0.45,
              y = fire.y + Math.sin(a) * r * 0.35;
            worldContext.fillStyle = i % 2 ? '#ffc569bb' : '#e97032bb';
            worldContext.beginPath();
            worldContext.ellipse(
              x,
              y - r * 0.45,
              r * 0.25,
              r * (0.65 + 0.2 * Math.sin(gameTime * 12 + i)),
              Math.sin(a) * 0.2,
              0,
              TAU,
            );
            worldContext.fill();
          }
          worldContext.restore();
        }
    }
    function shotBlocked(x, y, altitude = 0) {
      if (airCoverStopsShot(x, y, altitude) || (landAt(x, y) && altitude + 10 < terrainHeight(x, y)))
        return true;
      if (
        altitude > 100 &&
        roofCover.some(
          (b) =>
            altitude + 10 < ROOFTOP.height + b.height &&
            x > b.x &&
            x < b.x + b.w &&
            y > b.y &&
            y < b.y + b.h,
        )
      )
        return true;
      if (
        inStadiumLot(x, y, 4) &&
        STADIUM_STANDS.some(
          (b) => altitude + 10 < b.height && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h,
        )
      )
        return true;
      return (
        [
          ...garageWalls(),
          ...harborSolids(),
          ...depotSolids(),
          ...militarySolids(),
          ...countySolids(),
        ].some(
          (b) => altitude + 10 < b.height && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h,
        ) ||
        buildingsNear(x, y).some(
          (b) =>
            altitude + 10 < b.height &&
            x > b.x - 1 &&
            x < b.x + b.w + 1 &&
            y > b.y - 1 &&
            y < b.y + b.h + 1,
        )
      );
    }
    // Who a bullet can hit where it is now, in the order hits are tested. The
    // short lists go in whole; pedestrians come from the crowd's neighbour grid
    // around the bullet. Every sub-step of every bullet used to copy all ~650
    // pedestrians (plus everyone else) into a fresh array.
    const bulletTargetList = [];
    function bulletTargets(b, escorts, rooftop) {
      const list = bulletTargetList,
        add = (people) => {
          for (let k = 0; k < people.length; k++) list.push(people[k]);
        },
        addNearbyPedestrians = () => forEachPedestrianNear(b.x, b.y, 16, (p) => list.push(p));
      list.length = 0;
      if (b.enemy) {
        if (b.faction === 'police') {
          add(enemies);
          add(gangMembers);
        } else if (b.faction) {
          add(enemies);
          add(gangMembers);
          add(officers);
          addNearbyPedestrians();
        }
        add(escorts);
      } else {
        add(enemies);
        add(gangMembers);
        addNearbyPedestrians();
        add(officers);
        add(escorts);
        add(rooftop);
      }
      return list;
    }
    function updateBullets(deltaSeconds) {
      if (!bullets.length) return;
      const escorts = storyActors.filter(
          (p) => p.missionTag === 'flight-witness' && !p.hidden && mission?.stage >= 4,
        ),
        rooftopTargets = storyActors.filter((p) => p.missionTag === 'rooftop-hit' && !p.hidden);
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        let impact = false,
          hitKind = 'wall';
        const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy, b.vz || 0) * deltaSeconds) / 7));
        for (let j = 0; j < steps && !impact; j++) {
          // Where this sub-step started: damage.js traces the entry face from it.
          b.px = b.x;
          b.py = b.y;
          b.x += (b.vx * deltaSeconds) / steps;
          b.y += (b.vy * deltaSeconds) / steps;
          b.altitude = (b.altitude ?? 0) + ((b.vz || 0) * deltaSeconds) / steps;
          if (shotBlocked(b.x, b.y, b.altitude || 0)) {
            impact = true;
            break;
          }
          for (const c of vehicles) {
            if (
              c === b.owner ||
              (b.faction === 'military' && c.military && !c.stolen) ||
              !sameFloor(c, b) ||
              (c === b.owner?.car && !c.stolen && c !== player.car) ||
              (!b.enemy && c === player.car)
            )
              continue;
            if (!pointInCar(b.x, b.y, c, 1)) continue;
            if (
              bulletDamagesVehicle(b, c) &&
              !(
                b.faction === 'police' &&
                (lawVehicle(c) || (c === player.car && b.target !== player))
              )
            )
              damageVehicle(
                c,
                // The vehicles missions hand you are built for the job (the cargo
                // truck's steel cage, Vinny's armored van): gang small-arms fire
                // does 40% damage to them, or a crew opening up on the loading
                // truck wrecks it before the third crate is aboard.
                b.enemy && c.mission && b.faction !== 'police' && !b.rocket ? b.dmg * 0.4 : b.dmg,
                b.x,
                b.y,
                b.owner || (!b.enemy ? player : null),
                {
                  kind: 'bullet',
                },
              );
            impact = true;
            // A hole in the skin, a star in the glass, a dead lamp or a flat tyre.
            hitKind = bulletHitVehicle(c, b);
            break;
          }
          if (impact) break;
          if (!b.enemy) {
            for (const a of wildlife) {
              if (
                a.hp > 0 &&
                sameFloor(a, b) &&
                distanceBetween(a, b) < WILDLIFE_SPECIES[a.species].collisionRadius
              ) {
                strikeWildlife(a, b.dmg);
                impact = true;
                hitKind = 'flesh';
                break;
              }
            }
          }
          if (impact) break;
          const targets = bulletTargets(b, escorts, rooftopTargets);
          for (const p of targets) {
            if (
              !sameFloor(p, b) ||
              p === b.owner ||
              p.hp <= 0 ||
              (b.enemy && b.faction === p.faction)
            )
              continue;
            if (Math.hypot(b.x - p.x, b.y - p.y) >= 10) continue;
            strikePerson(p, b.dmg, Math.atan2(b.vy, b.vx), b.owner || (!b.enemy ? player : null));
            if (!b.enemy) {
              if (p.police) crime(0.3);
              if (p.hp <= 0) cash += enemies.includes(p) ? 100 : 10;
            }
            impact = true;
            hitKind = 'flesh';
            break;
          }
          if (
            !impact &&
            b.enemy &&
            sameFloor(b, player) &&
            !player.car &&
            (b.faction !== 'police' || b.target === player) &&
            Math.hypot(b.x - player.x, b.y - player.y) < 10
          ) {
            hurt(b.dmg);
            impact = true;
            hitKind = 'flesh';
          }
        }
        b.life -= deltaSeconds;
        if (b.rocket && seededRandom() < 0.8) particle(b.x, b.y, '#cbc4a0', 1, 15, 5);
        if (impact || b.life <= 0) {
          if (b.rocket)
            explode(
              b.x,
              b.y,
              b.blastPower || 1,
              b.owner || (!b.enemy ? player : 'world'),
              b.altitude ?? 0,
            );
          else if (impact && hitKind !== 'flesh') {
            // Walls keep a chip or a hole, shop windows crack and then give way.
            if (hitKind === 'wall') hitKind = bulletHitSurface(b);
            particle(b.x, b.y, hitKind === 'metal' ? '#dbd8a7' : '#aaa89e', 3, 40);
            if (city3D) city3D.impact(b.x, b.y, hitKind, b.altitude || 0);
          } else if (!impact) bulletSpent(b);
          bullets.splice(i, 1);
        }
      }
    }
    // SIMULATION UPDATE: only active play advances gameplay clocks and state.
    function update(deltaSeconds) {
      const active = gameMode === 'play';
      gameTime += deltaSeconds;
      if (toastTime > 0) {
        toastTime -= deltaSeconds;
        if (toastTime <= 0) getElement('toast').classList.remove('show');
      }
      if (active) timed('knockdowns', () => updateKnockdowns(deltaSeconds));
      if (active || gameMode === 'menu') timed('cars', () => updateCars(deltaSeconds, active));
      if (active) {
        player.inv = Math.max(0, player.inv - deltaSeconds);
        shotCooldownSeconds = Math.max(0, shotCooldownSeconds - deltaSeconds);
        if (reloadSecondsRemaining > 0) {
          reloadSecondsRemaining -= deltaSeconds;
          if (reloadSecondsRemaining <= 0) {
            let w = currentWeapon(),
              n = Math.min(w.clip - w.ammo, w.reserve);
            w.ammo += n;
            w.reserve -= n;
            reloadSecondsRemaining = 0;
            tone(230, 0.035, 0.06);
          }
        }
        timed('transit', () => updateTransit(deltaSeconds));
        timed('taxi', () => updateTaxiRide(deltaSeconds));
        updateCycling(deltaSeconds);
        updateWeather(deltaSeconds);
        updateSwimming(deltaSeconds);
        updateMarinaFooting();
        updateSinking(deltaSeconds);
        timed('beach', () => updateBeach(deltaSeconds));
        timed('coaster', () => updateCoaster(deltaSeconds));
        timed('wildlife', () => updateWildlife(deltaSeconds));
        timed('sports', () => updateSports(deltaSeconds));
        if (player.parachute) updateParachute(deltaSeconds);
        else if (
          !player.car &&
          !transitRide &&
          !taxiRide &&
          !player.coaster &&
          !updateMountainFooting(deltaSeconds)
        ) {
          const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
            y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
          if (x || y) {
            player.a = Math.atan2(y, x);
            player.walk += deltaSeconds * (keys.ShiftLeft ? 15 : 10);
            let s = player.swimming
              ? swimSpeed()
              : player.roof
                ? keys.ShiftLeft || keys.ShiftRight
                  ? 68
                  : 42
                : keys.ShiftLeft || keys.ShiftRight
                  ? 158
                  : 100;
            if (player.wading) s *= wadeFactor();
            moveBody(
              player,
              (x / Math.hypot(x, y)) * s * deltaSeconds,
              (y / Math.hypot(x, y)) * s * deltaSeconds,
              8,
            );
          }
        }
        if (
          !player.car &&
          !player.roof &&
          !player.buildingRoof &&
          !player.deck &&
          !player.parachute &&
          !player.swimming &&
          !player.wading &&
          !player.climbing &&
          !transitRide &&
          !taxiRide &&
          !player.coaster
        )
          player.altitude = terrainHeight(player.x, player.y);
        if (keys.KeyF || (!player.car && keys.Space) || mouse.down) shoot();
        if (keys.KeyH && player.car && Math.floor(gameTime * 6) % 3 === 0)
          tone(220, 0.08, 0.04, 'sawtooth');
        if (keys.KeyE && canSilentHit(rooftopJob())) {
          rooftopMissionInteract();
          keys.KeyE = false;
        }
        timed('people', () => updatePeople(deltaSeconds));
        timed('bullets', () => updateBullets(deltaSeconds));
        timed('damage', () => updateDamage(deltaSeconds));
        if (gameMode !== 'play') return;
        for (const p of pickups)
          if (
            !transitRide &&
            !player.parachute &&
            !playerOnRoof() &&
            (player.car?.altitude || 0) < 2 &&
            gameTime > p.ready &&
            distanceBetween(player, p) < 27
          ) {
            if (p.type === 'health') {
              if (player.hp >= 100) continue;
              player.hp = 100;
              tell('Health restored');
            }
            if (p.type === 'ammo') {
              for (const w of weapons) {
                if (!w.owned) continue;
                w.ammo = w.clip;
                w.reserve = Math.max(w.reserve, w.clip * 8);
              }
              tell('Ammo restocked · all weapons');
            }
            if (p.type === 'armor') {
              player.armor = 100;
              tell('Body armor acquired');
            }
            p.ready = gameTime + 70;
            tone(840, 0.15, 0.15, 'triangle');
            particle(p.x, p.y, '#d5efa8', 9, 70);
          }
        timed('garage', () => updateGarage(deltaSeconds));
        timed('civic', () => updateCivic(deltaSeconds));
        timed('roofencounter', () => updateRoofEncounter(deltaSeconds));
        timed('military', () => updateMilitary(deltaSeconds));
        timed('combat', () => updateCombat(deltaSeconds));
        timed('mission', () => missionUpdate(deltaSeconds));
        timed('waypoint', () => updateWaypoint(deltaSeconds));
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= deltaSeconds;
        p.x += p.vx * deltaSeconds;
        p.y += p.vy * deltaSeconds;
        const drag = Math.exp(-2.5 * deltaSeconds);
        p.vx *= drag;
        p.vy *= drag;
        if (p.flame) {
          p.z += p.vz * deltaSeconds;
        }
        if (p.blood) {
          p.vz -= 160 * deltaSeconds;
          p.z += p.vz * deltaSeconds;
          if (p.z <= (p.surface ?? bloodSurface(p.x, p.y)) + 0.3) {
            addBloodPool(p.x, p.y, p.size * 0.8, Math.atan2(p.vy, p.vx), {
              opacity: 0.83,
              surface: p.surface ?? bloodSurface(p.x, p.y),
            });
            p.life = 0;
          }
        }
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = skids.length - 1; i >= 0; i--) {
        skids[i].life -= deltaSeconds;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
      if (skids.length > 1100) skids.splice(0, skids.length - 1100);
      for (let i = debris.length - 1; i >= 0; i--) {
        debris[i].life -= deltaSeconds;
        if (debris[i].life <= 0) debris.splice(i, 1);
      }
      shake *= Math.pow(0.008, deltaSeconds);
      flash = Math.max(0, flash - deltaSeconds);
      const look = player.car ? player.car.speed * 0.35 : 0,
        // A coaster outruns the usual trailing camera; stay with the train.
        follow = Math.min(1, deltaSeconds * (player.coaster ? 10 : 4.5));
      cameraTarget.x += (player.x + Math.cos(player.a) * look - cameraTarget.x) * follow;
      cameraTarget.y += (player.y + Math.sin(player.a) * look - cameraTarget.y) * follow;
      timed('sound', () => {
        soundUpdate(deltaSeconds);
        updateAmbience(deltaSeconds);
      });
      uiTime += deltaSeconds;
      if (uiTime > 0.09) {
        uiTime = 0;
        timed('ui', updateUI);
      }
    }
    function carSprite(c) {
      const vehicleDefinition = vehicleSpec(c),
        s = document.createElement('canvas');
      s.width = Math.max(72, vehicleDefinition.l + 12);
      s.height = Math.max(52, vehicleDefinition.w + 16);
      const drawingContext = s.getContext('2d');
      drawingContext.translate(s.width / 2, s.height / 2);
      const l = vehicleDefinition.l,
        w = vehicleDefinition.w,
        body = c.hp > 0 ? c.color : '#393f36';
      const r = (x, y, ww, hh, color) => {
        drawingContext.fillStyle = color;
        drawingContext.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
      };
      r(-l / 2 + 7, -w / 2 - 2, 8, 4, '#101916');
      r(l / 2 - 14, -w / 2 - 2, 8, 4, '#101916');
      r(-l / 2 + 7, w / 2 - 2, 8, 4, '#101916');
      r(l / 2 - 14, w / 2 - 2, 8, 4, '#101916');
      r(-l / 2, -w / 2 + 3, l, w - 6, '#1a231f');
      r(-l / 2 + 2, -w / 2, l - 4, w, body);
      r(-l / 2 + 4, -w / 2 + 2, l - 7, 2, '#ffffff38');
      r(-l / 2 + 3, w / 2 - 3, l - 6, 2, '#00000044');
      r(-l / 2 + 1, -w / 2 + 3, 2, w - 6, '#c5c6af');
      r(l / 2 - 3, -w / 2 + 3, 3, w - 6, '#bdc7b8');
      r(-7, -w / 2 + 3, 19, w - 6, '#1d3030');
      r(-3, -w / 2 + 3, 9, w - 6, body);
      r(-8, -w / 2 + 5, 3, w - 10, '#618381');
      r(7, -w / 2 + 4, 5, w - 8, '#7fa3a0');
      r(8, -w / 2 + 5, 2, 4, '#b3c6b450');
      r(-3, -w / 2 + 4, 8, 1, '#ffffff40');
      r(l / 2 - 2, -w / 2 + 3, 2, 5, '#e9e4bb');
      r(l / 2 - 2, w / 2 - 8, 2, 5, '#e9e4bb');
      r(-l / 2, -w / 2 + 3, 2, 4, '#c25543');
      r(-l / 2, w / 2 - 7, 2, 4, '#c25543');
      r(12, -4, 5, 8, c.hp > 0 ? body : '#242e27');
      r(13, -4, 1, 8, '#ffffff18');
      r(3, -w / 2 - 1, 4, 2, body);
      r(3, w / 2 - 1, 4, 2, body);
      if (c.type === 'muscle' || c.type === 'sport') {
        r(13, -3, 7, 2, '#192925');
        r(-19, -3, 8, 2, '#192925');
      }
      if (c.type === 'roadster') {
        r(-10, -w * 0.34, 17, w * 0.68, '#26282b');
        for (const side of [-1, 1]) {
          r(-8, side * 5 - 2, 6, 4, '#b99c79');
          r(-11, side * 5 - 3, 2, 6, '#c7cbca');
        }
        r(8, -w * 0.37, 2, w * 0.74, '#9bbdc8');
      }
      if (c.type === 'rally') {
        r(-13, -w * 0.37, 22, w * 0.74, body);
        r(6, -w * 0.36, 5, w * 0.72, '#52737f');
        r(-18, -w * 0.51, 3, w * 1.02, '#1c2a32');
        r(12, -3, 7, 6, '#d8d6be');
        r(-8, -2, 10, 4, '#d8d6be');
        for (const y of [-5, 0, 5]) r(l * 0.47, y - 1, 3, 2, '#e1d8b5');
      }
      if (c.type === 'limousine') {
        r(-l * 0.36, -w * 0.39, l * 0.59, w * 0.78, '#1c303d');
        r(-l * 0.33, -w * 0.3, l * 0.52, w * 0.6, body);
        for (const x of [-l * 0.22, -l * 0.02, l * 0.17]) r(x, -w * 0.4, 1, w * 0.8, '#a7aca8');
      }
      if (c.type === 'hotrod') {
        r(-12, -w * 0.34, 12, w * 0.68, '#253741');
        r(-9, -w * 0.3, 7, w * 0.6, body);
        r(7, -5, 11, 10, '#b2b5b4');
        for (let x = 8; x < 18; x += 3) r(x, -4, 1, 8, '#485052');
        r(9, -w * 0.52, 11, 2, '#d2d2c9');
        r(9, w * 0.43, 11, 2, '#d2d2c9');
        r(-l * 0.32, -w * 0.57, 9, 5, '#171b20');
        r(-l * 0.32, w * 0.37, 9, 5, '#171b20');
      }
      if (vehicleDefinition.tank) {
        for (const side of [-1, 1]) {
          r(-l / 2, side * w * 0.4 - 5, l, 10, '#273429');
          for (let x = -l / 2; x < l / 2; x += 7) r(x, side * w * 0.4 - 5, 2, 10, '#80917b');
        }
        r(-24, -17, 48, 34, body);
        drawingContext.save();
        drawingContext.rotate(normalizeAngle((c.turretA ?? c.a) - c.a));
        r(-17, -14, 34, 28, body);
        r(12, -3, 49, 6, '#8c997d');
        r(57, -4, 6, 8, '#39483a');
        r(-8, -6, 10, 12, '#455642');
        drawingContext.restore();
      }
      if (c.type === 'taxi') {
        r(-1, -4, 5, 8, '#e9db91');
        r(0, -3, 3, 6, '#554e2a');
      }
      if (c.type === 'van') {
        r(-l / 2 + 5, -w / 2 + 3, 26, w - 6, body);
        r(-l / 2 + 7, -w / 2 + 5, 22, 1, '#ffffff35');
        r(-l / 2 + 7, w / 2 - 6, 22, 1, '#00000022');
      }
      if (c.type === 'police') {
        r(-19, -w / 2 + 2, 10, w - 4, '#253a34');
        r(12, -w / 2 + 2, 8, w - 4, '#253a34');
        r(-2, -7, 4, 14, '#18231f');
        r(-1, -6, 3, 5, '#91b6dd');
        r(-1, 1, 3, 5, '#ce6f5e');
      }
      if (vehicleDefinition.truck) {
        r(-l * 0.46, -w * 0.43, l * 0.59, w * 0.86, c.type === 'ambulance' ? '#e0ddd1' : body);
        r(-l * 0.45, -w * 0.4, l * 0.56, 2, '#ffffff55');
        if (c.type === 'bus')
          for (let x = -l * 0.4; x < l * 0.4; x += 13) {
            r(x, -w * 0.48, 10, 4, '#263d48');
            r(x, w * 0.33, 10, 4, '#263d48');
          }
        if (c.type === 'pickup' || c.type === 'flatbed')
          r(-l * 0.46, -w * 0.35, l * 0.61, w * 0.7, '#6a5943');
        if (c.type === 'flatbed')
          for (let i = 0; i < (c.cargoCount || 0); i++) {
            r(-42 + i * 19, -9, 17, 18, '#c5a05a');
            r(-39 + i * 19, -9, 2, 18, '#e8cb7f');
          }
        if (c.type === 'ambulance') {
          r(-l * 0.25, -7, 3, 14, '#b33c45');
          r(-l * 0.25 - 5, -2, 13, 4, '#b33c45');
        }
      }
      if (vehicleDefinition.bike) {
        drawingContext.clearRect(-s.width / 2, -s.height / 2, s.width, s.height);
        r(-l / 2, -2, 8, 4, '#151b21');
        r(l / 2 - 8, -2, 8, 4, '#151b21');
        r(-l * 0.3, -w * 0.4, l * 0.56, w * 0.8, body);
        r(-8, -3, 9, 6, '#222e36');
        r(6, -w * 0.6, 2, w * 1.2, '#b6bfc1');
        r(l * 0.3, -2, 2, 4, '#e1d8ab');
      }
      if (vehicleDefinition.boat) {
        drawingContext.clearRect(-s.width / 2, -s.height / 2, s.width, s.height);
        drawingContext.fillStyle = body;
        drawingContext.beginPath();
        drawingContext.moveTo(-l * 0.5, -w * 0.4);
        drawingContext.lineTo(l * 0.1, -w * 0.5);
        drawingContext.quadraticCurveTo(l * 0.4, -w * 0.35, l * 0.5, 0);
        drawingContext.quadraticCurveTo(l * 0.4, w * 0.35, l * 0.1, w * 0.5);
        drawingContext.lineTo(-l * 0.5, w * 0.4);
        drawingContext.closePath();
        drawingContext.fill();
        r(-l * 0.32, -w * 0.3, l * 0.52, w * 0.6, '#d9d7c8');
        r(1, -w * 0.3, 4, w * 0.6, '#476a78');
        r(-l * 0.26, -w * 0.22, 10, w * 0.44, c.type === 'workboat' ? body : '#273c45');
        r(-l * 0.5, -3, 4, 6, '#26333b');
      }
      if (vehicleDefinition.jetski) {
        r(-11, -3, 17, 6, '#242f35');
        r(7, -5, 2, 10, '#c2cbd0');
        r(9, -3, 3, 6, '#92adad');
      }
      if (c.hp <= 0) {
        r(-14, -6, 25, 12, '#222d23');
        for (let i = 0; i < 10; i++)
          r(randomBetween(-20, 20), randomBetween(-10, 10), randomBetween(2, 5), 2, '#616853');
      }
      return s;
    }
    function visible(o, pad = 80) {
      return (
        Math.abs(o.x - cameraTarget.x) < viewportWidth / canvasScale / 2 + pad &&
        Math.abs(o.y - cameraTarget.y) < viewportHeight / canvasScale / 2 + pad
      );
    }
    function drawCar(vehicle) {
      if (vehicle.type === 'plane') {
        drawPlane2D(vehicle);
        return;
      }
      if (vehicle.type === 'helicopter') {
        if (!visible(vehicle, 180)) return;
        worldContext.save();
        worldContext.translate(vehicle.x + 8, vehicle.y + 9);
        worldContext.rotate(vehicle.a);
        worldContext.fillStyle = '#07121b60';
        worldContext.beginPath();
        worldContext.ellipse(0, 0, 40, 18, 0, 0, TAU);
        worldContext.fill();
        worldContext.restore();
        worldContext.save();
        worldContext.translate(vehicle.x, vehicle.y - (vehicle.altitude || 0) * 0.3);
        worldContext.rotate(vehicle.a);
        worldContext.fillStyle = vehicle.hp > 0 ? vehicle.color : '#303136';
        worldContext.fillRect(-43, -3, 32, 6);
        worldContext.fillRect(-39, -12, 6, 24);
        worldContext.beginPath();
        worldContext.ellipse(0, 0, 24, 13, 0, 0, TAU);
        worldContext.fill();
        worldContext.fillStyle = '#94aeb8';
        worldContext.beginPath();
        worldContext.ellipse(11, 0, 10, 10, 0, 0, TAU);
        worldContext.fill();
        worldContext.strokeStyle = '#a4adb0';
        worldContext.lineWidth = 2;
        for (const side of [-1, 1]) {
          worldContext.beginPath();
          worldContext.moveTo(-18, side * 16);
          worldContext.lineTo(23, side * 16);
          worldContext.stroke();
        }
        worldContext.rotate(gameTime * (vehicle === player.car || vehicle.airUnit ? 36 : 1));
        worldContext.strokeStyle = '#202b34';
        worldContext.lineWidth = 3;
        worldContext.beginPath();
        worldContext.moveTo(-41, 0);
        worldContext.lineTo(41, 0);
        worldContext.moveTo(0, -41);
        worldContext.lineTo(0, 41);
        worldContext.stroke();
        worldContext.restore();
        return;
      }
      if (!visible(vehicle)) return;
      const vehicleDefinition = vehicleSpec(vehicle);
      worldContext.save();
      worldContext.translate(vehicle.x + 4, vehicle.y + 5);
      worldContext.rotate(vehicle.a);
      worldContext.fillStyle = '#06120db0';
      worldContext.fillRect(
        -vehicleDefinition.l / 2 - 1,
        -vehicleDefinition.w / 2 - 1,
        vehicleDefinition.l + 3,
        vehicleDefinition.w + 3,
      );
      worldContext.restore();
      worldContext.save();
      worldContext.translate(vehicle.x, vehicle.y);
      worldContext.rotate(vehicle.a);
      if (vehicleDefinition.boat && Math.abs(vehicle.speed) > 15) {
        worldContext.fillStyle = '#bddcdd55';
        worldContext.beginPath();
        worldContext.moveTo(-vehicleDefinition.l * 0.4, -vehicleDefinition.w * 0.3);
        worldContext.lineTo(-vehicleDefinition.l * 0.4 - 30, -vehicleDefinition.w);
        worldContext.lineTo(-vehicleDefinition.l * 0.4 - 30, vehicleDefinition.w);
        worldContext.lineTo(-vehicleDefinition.l * 0.4, vehicleDefinition.w * 0.3);
        worldContext.fill();
      }
      if (!vehicle.sprite) vehicle.sprite = carSprite(vehicle);
      worldContext.drawImage(vehicle.sprite, -vehicle.sprite.width / 2, -vehicle.sprite.height / 2);
      if (vehicleDefinition.jetski && vehicle === player.car) {
        worldContext.fillStyle = '#9f7545';
        worldContext.fillRect(-6, -4, 7, 8);
        worldContext.fillStyle = '#c6a18a';
        worldContext.beginPath();
        worldContext.arc(1, 0, 3, 0, TAU);
        worldContext.fill();
      }
      if (vehicle.hp < vehicle.maxhp * 0.8) {
        worldContext.strokeStyle = '#b3b7ac';
        worldContext.lineWidth = 1;
        for (const d of vehicle.dents) {
          worldContext.beginPath();
          worldContext.moveTo(d.x - 3, d.y - 3);
          worldContext.lineTo(d.x + 2, d.y + 2);
          worldContext.lineTo(d.x + 5, d.y - 1);
          worldContext.stroke();
        }
        worldContext.fillStyle = '#303532a0';
        const crush = vehicle.damage.front * 5;
        worldContext.fillRect(
          vehicleDefinition.l / 2 - crush,
          -vehicleDefinition.w / 2 + 3,
          crush,
          vehicleDefinition.w - 6,
        );
      }
      if (vehicleDefinition.bike && (vehicle === player.car || vehicle.ai) && vehicle.hp > 0) {
        worldContext.fillStyle = '#253340';
        worldContext.fillRect(-6, -5, 8, 10);
        worldContext.fillStyle = '#8597a2';
        worldContext.beginPath();
        worldContext.arc(1, 0, 3.5, 0, TAU);
        worldContext.fill();
      }
      if (vehicle.hp > 0) {
        const gradient = worldContext.createLinearGradient(
          vehicleDefinition.l / 2,
          0,
          vehicleDefinition.l / 2 + 73,
          0,
        );
        gradient.addColorStop(0, '#f8f3bf16');
        gradient.addColorStop(1, '#f8f3bf00');
        worldContext.fillStyle = gradient;
        worldContext.beginPath();
        worldContext.moveTo(vehicleDefinition.l / 2, -8);
        worldContext.lineTo(vehicleDefinition.l / 2 + 73, -28);
        worldContext.lineTo(vehicleDefinition.l / 2 + 73, 28);
        worldContext.lineTo(vehicleDefinition.l / 2, 8);
        worldContext.fill();
        if ((vehicle.cop && wantedStars > 0) || vehicle.gangTarget) {
          worldContext.globalAlpha = 0.5 + 0.4 * Math.sin(gameTime * 18);
          worldContext.fillStyle = Math.sin(gameTime * 18) > 0 ? '#8ed0fd' : '#f1716d';
          worldContext.shadowBlur = 14;
          worldContext.shadowColor = worldContext.fillStyle;
          worldContext.fillRect(-2, -7, 4, 14);
          worldContext.shadowBlur = 0;
          worldContext.globalAlpha = 1;
        }
        if (vehicle === player.car && (keys.Space || keys.KeyS)) {
          worldContext.fillStyle = '#ff6c45';
          worldContext.shadowColor = '#f95535';
          worldContext.shadowBlur = 9;
          worldContext.fillRect(-vehicleDefinition.l / 2, -vehicleDefinition.w / 2 + 2, 2, 5);
          worldContext.fillRect(-vehicleDefinition.l / 2, vehicleDefinition.w / 2 - 7, 2, 5);
          worldContext.shadowBlur = 0;
        }
      }
      worldContext.restore();
      if (vehicle.bloodyUntil > gameTime) {
        worldContext.fillStyle = '#871428';
        worldContext.fillRect(vehicle.x - 2, vehicle.y - 3, 7, 6);
      }
      if (
        !vehicleDefinition.bicycle &&
        vehicle.hp > 0 &&
        vehicle.hp < vehicle.maxhp * 0.3 &&
        Math.random() < 0.15
      )
        particle(
          vehicle.x + Math.cos(vehicle.a) * 12,
          vehicle.y + Math.sin(vehicle.a) * 12,
          '#363d35',
          1,
          14,
          8,
        );
      if (
        !vehicleDefinition.bicycle &&
        vehicle.hp <= 0 &&
        gameTime - vehicle.deadTime < 12 &&
        Math.random() < 0.25
      )
        particle(vehicle.x, vehicle.y, randomChoice(['#dfb05f', '#a5683b', '#424b3f']), 2, 23, 10);
    }
    function drawPerson(person, isPlayer = false, isEnemy = false) {
      if (!visible(person, 30)) return;
      worldContext.save();
      worldContext.translate(person.x, person.y);
      worldContext.rotate(
        person.a + (person.hp > 0 && person.dazedFor > 0 ? Math.sin(gameTime * 8) * 0.1 : 0),
      );
      if (person.hp <= 0 || person.knockedFor > 0 || person.poisonCollapse > 0.45) {
        worldContext.fillStyle = '#263a2b70';
        worldContext.fillRect(-9, -4, 18, 8);
        worldContext.fillStyle = person.color || '#abb39b';
        worldContext.fillRect(-5, -3, 8, 6);
        worldContext.fillStyle = '#c8ac85';
        worldContext.fillRect(4, -2, 4, 4);
        worldContext.restore();
        if (person.hp > 0) drawDizzy(person.x, person.y - 13);
        return;
      }
      if (isPlayer) {
        worldContext.strokeStyle = '#d9f59890';
        worldContext.lineWidth = 1;
        worldContext.beginPath();
        worldContext.arc(0, 0, 13, 0, TAU);
        worldContext.stroke();
        if (player.inv > 0) worldContext.globalAlpha = 0.45 + 0.4 * Math.sin(gameTime * 25);
      }
      worldContext.fillStyle = '#102b2380';
      worldContext.beginPath();
      worldContext.ellipse(3, 4, 9, 5, 0, 0, TAU);
      worldContext.fill();
      const step = Math.sin(person.walk || 0) * 2.5;
      worldContext.fillStyle = '#27382f';
      worldContext.fillRect(-6 + step, -4, 6, 3);
      worldContext.fillRect(-6 - step, 1, 6, 3);
      worldContext.fillStyle = isPlayer ? (player.disguised ? '#e5d7b2' : '#dde5cb') : person.color;
      worldContext.fillRect(-4, -6, 8, 12);
      worldContext.fillStyle = isPlayer ? (player.disguised ? '#233341' : '#71856c') : '#756c53';
      worldContext.fillRect(-4, -3, 6, 6);
      worldContext.fillStyle = '#c8ac85';
      worldContext.fillRect(-1, -3, 5, 6);
      worldContext.fillStyle = isPlayer ? '#393e33' : '#514939';
      worldContext.fillRect(-1, -3, 3, 6);
      if (
        !personIncapacitated(person) &&
        ((isPlayer && !(player.disguised && rooftopJob() && !rooftopJob().weaponDrawn)) ||
          (isEnemy && (!person.missionTag || person.aiming)))
      ) {
        worldContext.fillStyle = '#c2b48f';
        worldContext.fillRect(2, 3, 7, 3);
        worldContext.fillStyle =
          isPlayer && selectedWeaponIndex === KNIFE_INDEX ? '#e0e8ed' : '#1a2722';
        worldContext.fillRect(
          7,
          3,
          isPlayer && selectedWeaponIndex === 3 ? 12 : 7,
          isPlayer && selectedWeaponIndex === KNIFE_INDEX ? 1.5 : 3,
        );
      }
      worldContext.restore();
      if (person.dazedFor > 0) drawDizzy(person.x, person.y - 18);
    }
    function drawDizzy(x, y) {
      worldContext.save();
      worldContext.fillStyle = '#f3d583';
      for (let j = 0; j < 3; j++) {
        const a = gameTime * 3 + (j * TAU) / 3;
        worldContext.beginPath();
        worldContext.arc(x + Math.cos(a) * 8, y + Math.sin(a) * 3, 1.8, 0, TAU);
        worldContext.fill();
      }
      worldContext.restore();
    }
    function marker(p, color = '#d7f970', symbol = '↓', size = 22) {
      if (!p || !visible(p, 80)) return;
      const y = p.y - 33 - Math.sin(gameTime * 3) * 4;
      worldContext.save();
      worldContext.strokeStyle = color;
      worldContext.lineWidth = 2;
      worldContext.globalAlpha = 0.35 + 0.15 * Math.sin(gameTime * 4);
      worldContext.beginPath();
      worldContext.ellipse(p.x, p.y, 28, 16, 0, 0, TAU);
      worldContext.stroke();
      worldContext.globalAlpha = 1;
      worldContext.translate(p.x, y);
      worldContext.fillStyle = '#13241dde';
      worldContext.beginPath();
      worldContext.moveTo(0, -size);
      worldContext.lineTo(size, 0);
      worldContext.lineTo(0, size);
      worldContext.lineTo(-size, 0);
      worldContext.closePath();
      worldContext.fill();
      worldContext.stroke();
      worldContext.fillStyle = color;
      worldContext.font = 'bold 21px Arial';
      worldContext.textAlign = 'center';
      worldContext.textBaseline = 'middle';
      worldContext.fillText(symbol, 0, -1);
      worldContext.restore();
    }
    // FRAME PRESENTATION: WebGL when available, otherwise the complete 2D fallback.
    function drawWorld() {
      if (city3D) {
        city3D.render();
        return;
      }
      drawWater2D();
      worldContext.save();
      worldContext.translate(
        viewportWidth / 2 + (Math.random() - 0.5) * shake,
        viewportHeight / 2 + (Math.random() - 0.5) * shake,
      );
      worldContext.scale(canvasScale, canvasScale);
      worldContext.translate(-cameraTarget.x, -cameraTarget.y);
      const sx = clamp(cameraTarget.x - viewportWidth / canvasScale / 2 - 20, CITY_LEFT, CITY_RIGHT),
        sy = clamp(cameraTarget.y - viewportHeight / canvasScale / 2 - 20, CITY_TOP, CITY_SIZE),
        sw = Math.min(viewportWidth / canvasScale + 40, CITY_RIGHT - sx),
        sh = Math.min(viewportHeight / canvasScale + 40, CITY_SIZE - sy);
      if (sw > 0 && sh > 0)
        worldContext.drawImage(
          groundCanvas,
          (sx - CITY_LEFT) * GROUND_PIXELS_PER_UNIT,
          (sy - CITY_TOP) * GROUND_PIXELS_PER_UNIT,
          sw * GROUND_PIXELS_PER_UNIT,
          sh * GROUND_PIXELS_PER_UNIT,
          sx,
          sy,
          sw,
          sh,
        );
      drawCounty2D();
      drawDistrictScenery2D();
      paintGarages(worldContext);
      drawAviationGround(worldContext);
      drawHarbor2D();
      drawDepot2D();
      drawRoadblocks2D();
      drawUnderpass2D();
      drawAirSearch2D();
      drawTrafficLights2D();
      drawBlood2D();
      for (const s of skids)
        if (visible(s)) {
          worldContext.save();
          worldContext.globalAlpha = Math.min(0.6, s.life / 10);
          worldContext.translate(s.x, s.y);
          worldContext.rotate(s.a);
          worldContext.fillStyle = '#111d16';
          worldContext.fillRect(-s.len / 2, -1, s.len, 2);
          worldContext.restore();
        }
      for (const d of debris)
        if (visible(d)) {
          worldContext.fillStyle = '#15291d65';
          worldContext.beginPath();
          worldContext.ellipse(d.x, d.y, 38, 31, 0, 0, TAU);
          worldContext.fill();
        }
      // A payphone you can spot from the street.
      worldContext.fillStyle = '#132c26';
      worldContext.fillRect(phone.x - 8, phone.y - 6, 16, 18);
      worldContext.fillStyle = '#79a995';
      worldContext.fillRect(phone.x - 7, phone.y - 6, 14, 13);
      worldContext.fillStyle = '#243e34';
      worldContext.fillRect(phone.x - 4, phone.y - 3, 8, 9);
      worldContext.fillStyle = '#d1e3b3';
      worldContext.fillRect(phone.x - 2, phone.y - 1, 4, 5);
      worldContext.fillStyle = '#698c76';
      worldContext.fillRect(phone.x - 2, phone.y + 10, 4, 7);
      for (const p of pickups)
        if (p.ready < gameTime && visible(p)) {
          worldContext.save();
          worldContext.translate(p.x, p.y + Math.sin(gameTime * 3) * 2);
          worldContext.fillStyle = '#172e24e0';
          worldContext.fillRect(-9, -9, 18, 18);
          worldContext.strokeStyle =
            p.type === 'health' ? '#90dcb0' : p.type === 'ammo' ? '#cc9fda' : '#83b7d6';
          worldContext.strokeRect(-10, -10, 20, 20);
          worldContext.fillStyle = worldContext.strokeStyle;
          if (p.type === 'health') {
            worldContext.fillRect(-2, -6, 4, 12);
            worldContext.fillRect(-6, -2, 12, 4);
          } else if (p.type === 'ammo') {
            for (let j = -4; j <= 4; j += 4) worldContext.fillRect(j - 1, -5, 2, 10);
          } else {
            worldContext.beginPath();
            worldContext.moveTo(-5, -6);
            worldContext.lineTo(5, -6);
            worldContext.lineTo(5, 2);
            worldContext.lineTo(0, 7);
            worldContext.lineTo(-5, 2);
            worldContext.fill();
          }
          worldContext.restore();
        }
      drawWildlife2D();
      drawSports(worldContext);
      drawTransit2D();
      for (const p of pedestrians) drawPerson(p);
      for (const c of vehicles) drawCar(c);
      for (const e of [...enemies, ...gangMembers, ...officers])
        if (!rooftopFloor(e)) drawPerson(e, false, true);
      if (player.roof) {
        drawRooftop2D();
        drawRoofStealth2D();
        drawBlood2D(true);
        for (const e of enemies) if (rooftopFloor(e)) drawPerson(e, false, true);
      }
      for (const p of storyActors) if (!p.hidden && rooftopFloor(p) === !!player.roof) drawPerson(p);
      if (!player.car && !transitRide) {
        let drawP = {
          ...player,
          a: mouse.active ? aim() : player.a,
        };
        drawPerson(drawP, true);
      }
      for (const b of bullets) {
        if (rooftopFloor(b) !== !!player.roof) continue;
        worldContext.strokeStyle = b.enemy ? '#f1ac7b' : b.rocket ? '#f5d297' : '#f0edb4';
        worldContext.lineWidth = b.rocket ? 4 : 1.7;
        worldContext.beginPath();
        worldContext.moveTo(b.x, b.y);
        worldContext.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
        worldContext.stroke();
      }
      drawFire2D();
      for (const p of particles)
        if (visible(p)) {
          worldContext.globalAlpha = clamp(p.life / p.max, 0, 1);
          worldContext.fillStyle = p.color;
          worldContext.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
      worldContext.globalAlpha = 1;
      // Streetlights give the city a subtle warm dusk.
      for (const l of lamps)
        if (visible(l, 50)) {
          const g = worldContext.createRadialGradient(l.x, l.y, 1, l.x, l.y, 42);
          g.addColorStop(0, '#f2d4921a');
          g.addColorStop(1, '#eadc9400');
          worldContext.fillStyle = g;
          worldContext.fillRect(l.x - 42, l.y - 42, 84, 84);
          worldContext.fillStyle = '#d4d2a2';
          worldContext.fillRect(l.x - 1, l.y - 1, 3, 3);
        }
      const target = objective();
      if (target) marker(target, '#d7f970', mission ? '↓' : '☎');
      for (const s of GARAGES) if (distanceBetween(player, s) < 400) marker(s, s.color, 'R', 16);
      drawStoryMarkers2D();
      drawRoofDialogue2D();
      drawParachute2D();
      worldContext.restore();
      // Film tint and edge direction, kept away from the central play area.
      worldContext.fillStyle = 'rgba(7,13,35,' + (1 - daylight()) * 0.25 + ')';
      worldContext.fillRect(0, 0, viewportWidth, viewportHeight);
      if (flash > 0) {
        worldContext.fillStyle = 'rgba(205,111,72,' + flash * 0.6 + ')';
        worldContext.fillRect(0, 0, viewportWidth, viewportHeight);
      }
      if (target && gameMode === 'play') {
        const tx = (target.x - cameraTarget.x) * canvasScale + viewportWidth / 2,
          ty = (target.y - cameraTarget.y) * canvasScale + viewportHeight / 2;
        if (tx < 55 || tx > viewportWidth - 55 || ty < 120 || ty > viewportHeight - 225) {
          let a = Math.atan2(ty - viewportHeight / 2, tx - viewportWidth / 2),
            radius = Math.min(
              (viewportWidth / 2 - 75) / Math.max(0.01, Math.abs(Math.cos(a))),
              (viewportHeight / 2 - 115) / Math.max(0.01, Math.abs(Math.sin(a))),
            );
          const px = viewportWidth / 2 + Math.cos(a) * radius,
            py = viewportHeight / 2 + Math.sin(a) * radius;
          worldContext.save();
          worldContext.translate(px, py);
          worldContext.rotate(a);
          worldContext.fillStyle = '#d8ef97';
          worldContext.strokeStyle = '#273727';
          worldContext.lineWidth = 3;
          worldContext.beginPath();
          worldContext.moveTo(13, 0);
          worldContext.lineTo(-6, -8);
          worldContext.lineTo(-2, 0);
          worldContext.lineTo(-6, 8);
          worldContext.closePath();
          worldContext.stroke();
          worldContext.fill();
          worldContext.restore();
          worldContext.fillStyle = '#e2ebcb';
          worldContext.font = 'bold 10px monospace';
          worldContext.textAlign = 'center';
          worldContext.fillText(distanceLabel(distanceBetween(player, target)), px, py + 25);
        }
      }
    }
    /**
     * MINIMAP BASE LAYER
     * The minimap used to repaint the whole county (coast, every street, parks,
     * promenades, county ground and every building footprint) on every HUD
     * refresh, eleven times a second: tens of milliseconds each time, mostly in
     * the shoreline tests of the promenade painter. None of it changes after
     * startup, so it is painted once into an offscreen canvas at the minimap's
     * fixed scale and each refresh copies the window around the player. The big
     * city map zooms, so it still paints the vector layers directly.
     */
    const MINIMAP_SCALE = 0.137;
    let minimapBase = null;
    function minimapBaseLayer() {
      if (minimapBase) return minimapBase;
      let minx = Infinity,
        miny = Infinity,
        maxx = -Infinity,
        maxy = -Infinity;
      for (const reg of LAND_REGIONS)
        for (const [x, y] of reg.polygon) {
          minx = Math.min(minx, x);
          miny = Math.min(miny, y);
          maxx = Math.max(maxx, x);
          maxy = Math.max(maxy, y);
        }
      // The coast is stroked 90 units wide, so leave room around the land.
      const x0 = minx - 120,
        y0 = miny - 120,
        canvas = document.createElement('canvas');
      canvas.width = Math.ceil((maxx - minx + 240) * MINIMAP_SCALE);
      canvas.height = Math.ceil((maxy - miny + 240) * MINIMAP_SCALE);
      const context = canvas.getContext('2d');
      context.scale(MINIMAP_SCALE, MINIMAP_SCALE);
      context.translate(-x0, -y0);
      paintMapBase(context, false);
      minimapBase = { canvas, x0, y0 };
      return minimapBase;
    }
    // Land, streets, parks, ground and building footprints: the static layers.
    function paintMapBase(drawingContext, big) {
      for (const reg of LAND_REGIONS) {
        regionPath(drawingContext, reg);
        drawingContext.strokeStyle = reg.id === 'palmkeys' ? '#33777e' : '#245369';
        drawingContext.lineWidth = 90;
        drawingContext.stroke();
        drawingContext.fillStyle = reg.color;
        drawingContext.fill();
      }
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      paintCityStreets(drawingContext, false);
      paintParks(drawingContext, false);
      drawingContext.restore();
      paintDistrictGround(drawingContext, false);
      paintCountyGround(drawingContext, false);
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      for (const b of buildings) {
        drawingContext.fillStyle = b.tropical ? '#c4beb2' : b.height > 110 ? '#354953' : '#43585a';
        drawingContext.fillRect(b.x, b.y, b.w, b.h);
        if (big && b.height > 110) {
          drawingContext.fillStyle = '#75888b';
          drawingContext.fillRect(b.x + 7, b.y + 7, b.w - 14, 8);
        }
      }
      drawingContext.restore();
    }
    function drawMap(drawingContext, width, height, big = false) {
      const scale = big
          ? Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT) * 0.92 * mapZoom
          : MINIMAP_SCALE,
        cx = big ? mapCenter.x : player.x,
        cy = big ? mapCenter.y : player.y;
      drawingContext.fillStyle = '#123244';
      drawingContext.fillRect(0, 0, width, height);
      if (!big) {
        // Whole pixels keep the cached layer sharp; overlays are drawn in world units.
        const base = minimapBaseLayer();
        drawingContext.drawImage(
          base.canvas,
          Math.round(width / 2 - (cx - base.x0) * scale),
          Math.round(height / 2 - (cy - base.y0) * scale),
        );
      }
      drawingContext.save();
      drawingContext.translate(width / 2, height / 2);
      drawingContext.scale(scale, scale);
      drawingContext.translate(-cx, -cy);
      if (big) paintMapBase(drawingContext, big);
      if (big)
        for (const gang of GANGS) {
          drawingContext.fillStyle = gang.id === 'harbor' ? '#bb73571f' : '#ad88ca29';
          drawingContext.beginPath();
          drawingContext.arc(gang.x, gang.y, 260, 0, TAU);
          drawingContext.fill();
          drawingContext.strokeStyle = gang.color + '99';
          drawingContext.lineWidth = 7;
          drawingContext.stroke();
        }
      for (const p of pickups) {
        drawingContext.fillStyle =
          p.type === 'health' ? '#84ccb0' : p.type === 'ammo' ? '#c7a2df' : '#94bfd5';
        drawingContext.fillRect(p.x - 13, p.y - 13, 26, 26);
      }
      paintSportsGround(drawingContext, false);
      drawCivicMap(drawingContext, big);
      for (const pad of HELIPADS) {
        drawingContext.fillStyle = '#e4d3a3';
        drawingContext.font = 'bold 90px monospace';
        drawingContext.textAlign = 'center';
        drawingContext.fillText('H', pad.x, pad.y + 27);
      }
      // Rooftop helipads (rooftops.js): a smaller H.
      drawingContext.font = 'bold 64px monospace';
      for (const pad of roofHelipads) drawingContext.fillText('H', pad.x, pad.y + 20);
      drawHarborMap(drawingContext, big);
      const target = objective();
      if (target) {
        drawingContext.strokeStyle = '#f3d791aa';
        drawingContext.lineWidth = big ? 9 : 8;
        drawingContext.setLineDash([22, 19]);
        drawingContext.beginPath();
        drawingContext.moveTo(player.x, player.y);
        drawingContext.lineTo(target.x, target.y);
        drawingContext.stroke();
        drawingContext.setLineDash([]);
        drawingContext.fillStyle = '#f2d485';
        drawingContext.beginPath();
        drawingContext.arc(target.x, target.y, 36, 0, TAU);
        drawingContext.fill();
      }
      drawTransitMap(drawingContext, scale, big);
      drawSportsMap(drawingContext, scale, big);
      drawUserRoute(drawingContext, scale);
      drawCountyMap(drawingContext, scale, big);
      drawGarageMap(drawingContext, scale);
      drawAirCoverMap(drawingContext, scale);
      drawAviationMap(drawingContext, scale);
      drawPoliceMap(drawingContext, scale);
      drawingContext.restore();
      if (big) {
        drawingContext.save();
        drawingContext.strokeStyle = '#d3ddd5';
        drawingContext.fillStyle = '#d3ddd5';
        drawingContext.lineWidth = 2;
        const bar = BLOCK_SIZE * scale;
        drawingContext.beginPath();
        drawingContext.moveTo(28, 45);
        drawingContext.lineTo(28 + bar, 45);
        drawingContext.moveTo(28, 40);
        drawingContext.lineTo(28, 50);
        drawingContext.moveTo(28 + bar, 40);
        drawingContext.lineTo(28 + bar, 50);
        drawingContext.stroke();
        drawingContext.font = '11px Arial';
        drawingContext.textAlign = 'left';
        drawingContext.fillText('100 m · 1 block', 28, 65);
        drawingContext.restore();
        drawingContext.textAlign = 'center';
        const labels = [
          ['N O R T H  P O I N T', 2700, -2620],
          ['HARBOR POINT MARINA', 1060, -2960],
          ['CRUISE TERMINAL', 2360, -3990],
          ['THE RECLAMATION', 1420, -760],
          ['N O R T H B A N K', 1580, 540],
          ['CENTRAL GARDEN', 2176, 3224],
          ['SUNSET PIER', 3000, -6400],
          ['EXCHANGE DISTRICT', 2680, 2890],
          ['BROADWAY', 1330, 3390],
          ['BATTERY POINT', 2480, 5140],
          ['BATTERY PARK', 2440, 5420],
          ['SOUTHPORT', 640, 5450],
          ['P A L M  K E Y S', -1900, 535],
          ['OCEAN DRIVE', -2200, 2770],
          ['LITTLE HAVANA', -1900, 4150],
          ['CORAL MARINA', -1700, 4880],
          ['PALM KEYS BEACH', -1970, 5620],
          ['P A L M  S O U N D', -560, 2300],
          ['M A R L O W  B A Y', 4650, 2560],
          ['N O R T H  S O U N D', 1500, -4900],
        ];
        for (const [label, x, y] of labels) {
          drawingContext.font = 'bold 11px Arial';
          drawingContext.strokeStyle = '#102d3de0';
          drawingContext.lineWidth = 3;
          const px = width / 2 + (x - cx) * scale,
            py = height / 2 + (y - cy) * scale;
          drawingContext.strokeText(label, px, py);
          drawingContext.fillStyle = /B A Y|S O U N D/.test(label) ? '#a3d1d5' : '#ede6d2';
          drawingContext.fillText(label, px, py);
        }
        drawingContext.fillStyle = '#a6c4cb';
        drawingContext.font = '10px monospace';
        drawingContext.textAlign = 'left';
        drawingContext.fillText('N ↑', 28, 27);
        drawingContext.fillText('SOUTH COAST COUNTY / CITY GUIDE', 28, height - 17);
        drawingContext.textAlign = 'right';
        drawingContext.fillText(
          '+ / − ZOOM · ARROWS PAN · C FIND ME · 0 RESET',
          width - 28,
          height - 17,
        );
      }
      drawPlayerMapMarker(drawingContext, width, height, scale, cx, cy, big);
    }
    function drawWeapon() {
      drawWeaponIcon(getElement('weaponArt'), selectedWeaponIndex);
    }
    function drawWeaponIcon(targetCanvas, weaponIndex) {
      const atlas = visualAssets.arsenal;
      if (atlas && atlas.width > 0 && atlas.height > 0) {
        const context = targetCanvas.getContext('2d');
        // Explicit sprite bounds avoid neighboring icons and trim transparent atlas margins.
        // Coordinates refer to the original 1254 x 1254 artwork; the source PNG is unchanged.
        const spriteBounds = [
          [163, 81, 304, 212],
          [755, 45, 395, 279],
          [23, 425, 593, 153],
          [645, 394, 588, 213],
          [18, 702, 600, 205],
          [642, 693, 595, 184],
          [75, 1030, 506, 123],
        ];
        const [sourceX, sourceY, sourceWidth, sourceHeight] = spriteBounds[weaponIndex];
        const scale = Math.min(
          (targetCanvas.width * 0.88) / sourceWidth,
          (targetCanvas.height * 0.84) / sourceHeight,
        );
        const width = sourceWidth * scale,
          height = sourceHeight * scale;
        context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        context.imageSmoothingEnabled = true;
        context.drawImage(
          atlas,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          (targetCanvas.width - width) / 2,
          (targetCanvas.height - height) / 2,
          width,
          height,
        );
        return;
      }
      // Existing readable geometry remains available while artwork loads or in reduced mode.
      const drawingContext = targetCanvas.getContext('2d');
      drawingContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      drawingContext.save();
      const iconScale = Math.min(targetCanvas.width / 328, targetCanvas.height / 116);
      drawingContext.translate(targetCanvas.width / 2, targetCanvas.height / 2);
      drawingContext.scale(iconScale, iconScale);
      drawingContext.scale(4, 4);
      const r = (x, y, w, h, c) => {
        drawingContext.fillStyle = c;
        drawingContext.fillRect(x, y, w, h);
      };
      const c = '#becbb1',
        dark = '#6f806b';
      if (weaponIndex === KNIFE_INDEX) {
        r(-26, -3, 16, 6, '#665c4c');
        r(-11, -7, 3, 14, '#adb8bf');
        drawingContext.fillStyle = '#e3ebed';
        drawingContext.beginPath();
        drawingContext.moveTo(-8, -4);
        drawingContext.lineTo(30, -4);
        drawingContext.lineTo(20, 4);
        drawingContext.lineTo(-8, 4);
        drawingContext.closePath();
        drawingContext.fill();
      }
      if (weaponIndex === 0) {
        r(-14, -7, 31, 5, c);
        r(-14, -2, 19, 4, dark);
        r(-10, 2, 7, 10, c);
        r(-8, 3, 3, 8, dark);
        r(-2, 2, 8, 1, c);
        r(5, 1, 1, 5, c);
        r(-2, 5, 7, 1, c);
        r(16, -6, 3, 3, dark);
        r(-11, -9, 2, 2, c);
      }
      if (weaponIndex === 1) {
        r(-22, -6, 37, 8, c);
        r(14, -4, 15, 3, dark);
        r(-15, 2, 7, 11, dark);
        r(1, 2, 6, 11, c);
        r(-27, -5, 5, 14, dark);
        r(-12, -9, 19, 2, c);
        r(6, -9, 2, 3, c);
      }
      if (weaponIndex === 2) {
        r(-29, -2, 49, 4, c);
        r(18, -3, 16, 2, c);
        r(-12, -5, 15, 3, dark);
        r(-8, 2, 19, 3, dark);
        r(-28, 2, 13, 7, '#ae9e77');
        r(-15, 1, 8, 4, '#ae9e77');
        r(13, -5, 2, 3, c);
      }
      if (weaponIndex === 4 || weaponIndex === 5) {
        r(-23, -4, 33, 7, c);
        r(9, -2, weaponIndex === 5 ? 27 : 18, 2, dark);
        r(-32, -2, 11, 7, weaponIndex === 5 ? '#af936a' : dark);
        r(-17, 3, 4, 10, dark);
        r(-4, 3, 4, 9, c);
        r(2, -6, 7, 2, dark);
        if (weaponIndex === 5) {
          r(-11, -9, 22, 4, c);
          r(-13, -10, 3, 6, dark);
          r(10, -10, 3, 6, dark);
          r(-5, -5, 2, 2, dark);
        } else for (let x = 2; x < 13; x += 3) r(x, -3, 1, 4, dark);
      }
      if (weaponIndex === 3) {
        r(-30, -6, 61, 11, dark);
        r(-26, -5, 44, 7, c);
        r(29, -8, 3, 15, c);
        r(-31, -8, 3, 15, c);
        r(-4, 5, 6, 9, c);
        r(12, -10, 4, 4, c);
        r(14, -12, 10, 2, dark);
      }
      drawingContext.restore();
    }
    /**
     * MISSION CARD
     * The pager card is read once, not stared at: it opens for
     * MISSION_CARD_SECONDS whenever the job or its objective changes, then folds
     * into a one-line objective strip. O (or a click/tap on the strip) opens it
     * again. Game time drives it, so a pause or phone call does not eat the read.
     */
    const MISSION_CARD_SECONDS = 6;
    let missionCardKey = '',
      missionCardUntil = 0;
    function updateMissionCard(objectiveLine) {
      const key =
        getElement('pagerLabel').textContent +
        '|' +
        getElement('missionTitle').textContent +
        '|' +
        objectiveLine;
      if (key !== missionCardKey) {
        missionCardKey = key;
        missionCardUntil = gameTime + MISSION_CARD_SECONDS;
      }
      getElement('missionObjective').textContent = objectiveLine;
      getElement('pager').classList.toggle('compact', gameTime >= missionCardUntil);
    }
    function toggleMissionCard() {
      missionCardUntil = gameTime < missionCardUntil ? 0 : gameTime + MISSION_CARD_SECONDS;
      updateUI();
    }
    // HUD AND CONTEXT PROMPTS: presentation derived from shared simulation state.
    function updateUI() {
      enforceVehicleHandgun();
      const d = district(),
        w = currentWeapon(),
        c = player.car;
      getElement('district').textContent = d;
      getElement('mapDistrict').textContent = d;
      getElement('streetName').textContent = streetNameAt(player.x, player.y);
      getElement('cash').textContent = '$' + String(Math.floor(visibleCash())).padStart(6, '0');
      getElement('stars').textContent =
        '★'.repeat(Math.ceil(wantedStars)) + '☆'.repeat(5 - Math.ceil(wantedStars));
      getElement('healthValue').textContent = Math.max(0, Math.ceil(player.hp));
      getElement('healthFill').style.width = clamp(player.hp, 0, 100) + '%';
      getElement('healthFill').style.background = player.hp < 30 ? '#eb9d83' : '#d7f970';
      getElement('armorLabel').textContent =
        player.armor > 0
          ? 'ARMOR ' + Math.ceil(player.armor)
          : wantedStars > 0
            ? searchActive
              ? 'HIDE UNTIL THE TIMER ENDS'
              : 'POLICE PURSUIT'
            : 'NO ARMOR';
      getElement('weaponSlot').textContent = w.melee
        ? 'KNIFE · ALWAYS CARRIED'
        : 'EQUIPPED · ' + equippedWeaponIndices().length + ' WEAPONS';
      getElement('weaponName').textContent = w.name;
      getElement('ammo').textContent = w.melee
        ? '∞'
        : reloadSecondsRemaining > 0
          ? '··'
          : String(w.ammo).padStart(2, '0');
      getElement('reserve').textContent = w.melee ? 'NO AMMO NEEDED' : '/ ' + w.reserve;
      getElement('reloadHint').textContent = w.melee
        ? 'F'
        : reloadSecondsRemaining > 0
          ? 'LOADING'
          : 'R';
      getElement('vehicleName').textContent = transitRide
        ? 'CITY RAIL'
        : c
          ? vehicleSpec(c).name
          : player.swimming
            ? 'SWIMMING'
            : player.wading
              ? 'WADING'
              : 'ON FOOT';
      // The speed readout doubles as the breath gauge while you are in the water.
      const swimming = !c && player.swimming;
      getElement('speed').textContent = swimming
        ? Math.round(breathFraction() * 100)
        : c
          ? Math.round(
              worldMeters(c.type === 'plane' ? c.airspeed || Math.abs(c.speed) : Math.abs(c.speed)) *
                3.6,
            )
          : '';
      getElement('speedUnit').textContent = swimming
        ? '% BREATH'
        : c
          ? isAircraft(c)
            ? 'KM/H · ' + Math.round(worldMeters(c.altitude)) + ' m ALT · ' + roofClearanceText(c)
            : ridingBicycle()
              ? 'KM/H · ' +
                Math.round(pedalCadence() * 60) +
                ' RPM · LEGS ' +
                Math.round((cycleStamina / CYCLE_STAMINA_MAX) * 100) +
                '%'
              : 'KM/H'
          : '';
      getElement('carFill').style.width = c ? clamp((c.hp / c.maxhp) * 100, 0, 100) + '%' : '0%';
      getElement('carFill').style.background = c && c.hp < c.maxhp * 0.3 ? '#e79177' : '#d7f970';
      const target = objective(),
        m = mission;
      getElement('pager').classList.toggle('hidden', !m && incomingCallRemaining <= 0);
      // Numbered the same way as the mission-start headline: story missions out
      // of the story, contracts out of the contracts.
      const shownIndex = Math.min(mission?.index ?? missionIndex, missions.length - 1);
      getElement('missionCounter').textContent =
        shownIndex >= SIDE_JOB_FIRST
          ? 'CONTRACT ' + (shownIndex + 1 - SIDE_JOB_FIRST) + ' / ' + (missions.length - SIDE_JOB_FIRST)
          : 'MISSION ' +
            String(shownIndex + 1).padStart(2, '0') +
            ' / ' +
            String(SIDE_JOB_FIRST).padStart(2, '0');
      getElement('missionTimer').textContent = m?.timeLimit
        ? Math.floor(Math.ceil(m.timer) / 60) + ':' + String(Math.ceil(m.timer) % 60).padStart(2, '0')
        : '';
      if (m) {
        getElement('pagerLabel').textContent =
          CHARACTERS[missions[m.index].contact].name.toUpperCase();
        getElement('missionTitle').textContent = missions[m.index].title;
        getElement('missionText').textContent = missionSummary(m);
      } else if (missionIndex >= missions.length) {
        getElement('pagerLabel').textContent = 'THE SOUTH COAST LEDGER';
        getElement('missionTitle').textContent = 'One clean exit.';
        getElement('missionText').textContent =
          'Elena made it out. The Keys, rooftops and gang districts are yours to explore.';
      } else {
        getElement('pagerLabel').textContent = 'INCOMING CALL';
        getElement('missionTitle').textContent =
          missionIndex === 0 ? 'Every city has an opening.' : 'Another call. Another score.';
        getElement('missionText').textContent =
          'Find the ringing payphone and press E to take a job.';
      }
      getElement('missionDistance').textContent = target
        ? (m ? 'OBJECTIVE' : 'PAYPHONE') + ' · ' + distanceLabel(distanceBetween(player, target))
        : 'FREE ROAM · ' + completed + ' JOBS COMPLETE';
      updateMissionCard(
        m
          ? m.instruction || missions[m.index].brief
          : missionIndex >= missions.length
            ? 'FREE ROAM · ' + completed + ' JOBS COMPLETE'
            : 'ANSWER THE RINGING PAYPHONE',
      );
      let prompt = '';
      if (gameMode === 'play') {
        if (c) {
          if (c.type === 'plane')
            prompt = c.stalled
              ? 'STALL · SHIFT NOSE DOWN + W THROTTLE'
              : 'W/S THROTTLE ' +
                Math.round((c.throttle || 0) * 100) +
                '% · A/D BANK · SPACE/SHIFT PITCH · J PARACHUTE';
          else if (c.type === 'helicopter')
            prompt =
              aircraftClearance(c) > 1
                ? 'SPACE RISE · SHIFT DESCEND · WASD FLY'
                : 'SPACE TAKE OFF · E EXIT';
          else if (garageForCar(c))
            prompt = repairJob
              ? 'RESPRAYING…'
              : garageServiceCost(c) === 0
                ? 'RESPRAY & REPAIR · VINNY PAYS'
                : 'RESPRAY & REPAIR · $250';
          else if (GARAGES.some((s) => distanceBetween(c, s) < 200))
            prompt = 'DRIVE FULLY INTO THE OPEN REPAIR BAY';
        } else if (taxiRide) prompt = 'STOP HERE · $' + taxiRide.fare;
        else if (hailableTaxi()) prompt = 'HAIL THIS CAB';
        else if (player.deck)
          prompt = deckExitNear() ? 'GO ASHORE · ' + player.deck.name : '';
        else if (boardableLiner()) prompt = 'BOARD ' + boardableLiner().name;
        else if (transitRide) prompt = 'REQUEST NEXT RAIL STOP';
        else if (nearestStation()) prompt = 'CITY RAIL · CHOOSE DESTINATION';
        else if (distanceBetween(player, phone) < 68 && !m && missionIndex < missions.length)
          prompt = 'ANSWER PAYPHONE';
        else {
          const n = nearestCar();
          if (n)
            prompt = vehicleIsLocked(n)
              ? 'LOCKED · BREAK THE WINDOW'
              : (n.occupied ? 'PULL OUT THE DRIVER · ' : 'ENTER ') + vehicleSpec(n).name;
        }
      }
      getElement('interaction').style.display = prompt ? 'block' : 'none';
      getElement('interaction').innerHTML = prompt
        ? (isAircraft(c) ? '' : '<kbd>E</kbd> ') + prompt
        : '';
      drawMap(minimapContext, 224, 156);
      if (mapOpen) drawMap(cityMapContext, 800, 660, true);
      drawWeapon();
      civicUI();
      challengeMissionUI();
      updateCarRadioUI();
      updateExplorationUI();
      updateTouchUI();
    }
    function resize() {
      viewportWidth = innerWidth;
      viewportHeight = innerHeight;
      devicePixelRatioLimit = Math.min(devicePixelRatio || 1, 2);
      canvas.width = viewportWidth * devicePixelRatioLimit;
      canvas.height = viewportHeight * devicePixelRatioLimit;
      worldContext.setTransform(devicePixelRatioLimit, 0, 0, devicePixelRatioLimit, 0, 0);
      worldContext.imageSmoothingEnabled = false;
      canvasScale =
        clamp(Math.min(viewportWidth / 1250, viewportHeight / 850), 0.72, 1.35) * worldZoom;
      if (city3D) city3D.resize();
    }
    function begin() {
      if (gameMode !== 'menu') return;
      initAudio();
      newCallNotice();
      gameMode = 'play';
      getElement('menu').classList.add('hidden');
      canvas.focus();
      keys = {};
      tell('Welcome to South Coast. Answer the yellow payphone, or take a ride.', 5);
      announce('SOUTH COAST · 1997', 'OLD QUARTER', 1.8);
    }
    function togglePause() {
      if (gameMode === 'arsenal') {
        closeArsenal();
        return;
      }
      if (gameMode === 'transit') {
        closeTransit();
        return;
      }
      if (gameMode === 'service') {
        closeService();
        return;
      }
      if (gameMode === 'taxi') {
        closeTaxiOffer();
        return;
      }
      if (!getElement('credits').classList.contains('hidden')) {
        getElement('credits').classList.add('hidden');
        return;
      }
      if (gameMode === 'menu' || gameMode === 'dead') return;
      if (gameMode === 'help') {
        closeHelp();
        return;
      }
      if (mapOpen) {
        toggleMap();
        return;
      }
      if (gameMode === 'play') {
        gameMode = 'pause';
        getElement('pauseMenu').classList.remove('hidden');
        getElement('pauseInfo').textContent =
          completed +
          ' of ' +
          missions.length +
          ' jobs complete · $' +
          cash.toLocaleString() +
          ' earned and in your pocket.';
        getElement('resumeBtn').focus();
      } else if (gameMode === 'pause') {
        initAudio();
        gameMode = 'play';
        getElement('pauseMenu').classList.add('hidden');
        canvas.focus();
      }
      keys = {};
      mouse.down = false;
      syncCarRadio();
    }
    function openHelp() {
      if (gameMode === 'help') {
        closeHelp();
        return;
      }
      if (gameMode === 'dead') return;
      previousMode = gameMode;
      gameMode = 'help';
      getElement('help').classList.remove('hidden');
      getElement('closeHelp').focus();
      keys = {};
    }
    function closeHelp() {
      gameMode = previousMode;
      getElement('help').classList.add('hidden');
      if (gameMode === 'play') canvas.focus();
    }
    function toggleMap() {
      if (gameMode !== 'play' && !mapOpen) return;
      clearMapGesture();
      clearTouchInput();
      mapOpen = !mapOpen;
      if (!mapOpen) cancelTaxiPick();
      gameMode = mapOpen ? 'map' : 'play';
      getElement('mapOverlay').classList.toggle('hidden', !mapOpen);
      keys = {};
      mouse.down = false;
      if (mapOpen) {
        if (taxiPicking)
          getElement('mapRouteStatus').textContent = 'CAB WAITING · Tap where you want to be dropped off';
        drawMap(cityMapContext, 800, 660, true);
        getElement('closeMap').focus();
      } else canvas.focus();
    }
    function newGame() {
      initAudio();
      worldZoom = worldZoomTarget = 1;
      airDispatchTimer = 0;
      casinoRound = null;
      casinoAngle = 0;
      casinoResult = 'Choose your bet, then spin.';
      clearWaypoint();
      resetMissionState();
      resetCampaign();
      worldMinutes = 17 * 60 + 20;
      harborGate = harborGateUntil = 0;
      weapons.forEach((w, i) => (w.owned = i === 0));
      selectedWeaponIndex = 0;
      missionIndex = 0;
      completed = 0;
      cash = 0;
      mission = null;
      player.car = null;
      player.x = spawn.x;
      player.y = spawn.y;
      player.hp = 100;
      player.armor = 0;
      cameraTarget.x = player.x;
      cameraTarget.y = player.y;
      populate();
      populateStoryWorld();
      populateCounty();
      save();
      gameMode = 'play';
      getElement('pauseMenu').classList.add('hidden');
      announce('A FRESH START', 'OLD QUARTER', 1.8);
      tell('Your story starts at the yellow payphone.');
      newCallNotice();
      canvas.focus();
      updateUI();
    }
    /**
     * CHEAT CODE
     * Letters typed during play accumulate in a short ring; when the tail spells a
     * known code it fires. The keys still do their normal jobs while you type, so
     * the character will walk about as you spell it -- which is part of the fun.
     */
    let cheatBuffer = '';
    const CHEAT_CODES = {
      godmode: () => {
        player.godMode = !player.godMode;
        if (player.godMode) {
          for (const w of weapons) {
            w.owned = true;
            w.ammo = w.clip;
            w.reserve = w.clip * (w.rocket ? 5 : 9);
          }
          player.hp = 100;
          player.armor = 100;
          announce('SOUTH COAST', 'GOD MODE ACTIVATED', 2.2);
          tell('GOD MODE ACTIVATED · every weapon · click the map to teleport', 4);
        } else {
          announce('SOUTH COAST', 'GODMODE OFF', 1.8);
          tell('GODMODE OFF', 2.5);
        }
        drawWeapon();
        updateUI();
        tone(player.godMode ? 720 : 240, 0.22, 0.16, 'sine');
      },
    };
    /* Put the player somewhere else, letting go of anything that was carrying
       them: a hired cab or a liner deck would otherwise drag them straight back. */
    function teleportPlayer(x, y) {
      if (player.car) exitCar();
      if (taxiRide) endTaxiRide(false);
      cancelTaxiPick();
      player.deck = null;
      player.coaster = null;
      player.parachute = null;
      player.climbing = null;
      // Off any roof: the Blue Hour terrace or a building roof.
      if (player.roof || player.buildingRoof) {
        player.roof = false;
        player.buildingRoof = null;
        player.altitude = 0;
      }
      // Out of the water too: otherwise the first frame at the new spot still draws
      // the swimmer's pose and wake over dry land, and the SWIMMING toast lingers.
      if (player.swimming || player.wading) {
        player.swimming = false;
        player.wading = 0;
        if (!player.car) player.altitude = 0;
        toastTime = 0;
        getElement('toast').classList.remove('show');
      }
      // An airborne aircraft cannot be left (exitCar refuses), so it comes along
      // rather than being abandoned in the sky while the player jumps away.
      if (player.car && isAircraft(player.car)) {
        player.car.x = x;
        player.car.y = y;
      }
      player.x = x;
      player.y = y;
      cameraTarget.x = x;
      cameraTarget.y = y;
    }
    // Returns true once the tail of the buffer is going somewhere, so the caller
    // can swallow the keypress: spelling a code should not also drive the car.
    function feedCheatBuffer(key) {
      if (!/^[a-z]$/.test(key)) {
        cheatBuffer = '';
        return false;
      }
      cheatBuffer = (cheatBuffer + key).slice(-16);
      for (const [code, run] of Object.entries(CHEAT_CODES))
        if (cheatBuffer.endsWith(code)) {
          cheatBuffer = '';
          run();
          return true;
        }
      const tail = cheatBuffer.slice(-15);
      for (const code of Object.keys(CHEAT_CODES))
        for (let i = 1; i <= Math.min(tail.length, code.length); i++)
          if (code.startsWith(tail.slice(-i))) return true;
      return false;
    }
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (
        !e.repeat &&
        (gameMode === 'play' || gameMode === 'map') &&
        feedCheatBuffer((e.key || '').toLowerCase())
      ) {
        e.preventDefault();
        return;
      }
      if (gameMode === 'map' && code === 'KeyC') {
        e.preventDefault();
        centerMapOnPlayer();
        return;
      }
      if (
        gameMode === 'play' &&
        code === 'KeyV' &&
        !e.repeat &&
        mission?.index === 10 &&
        mission.compromised &&
        [1, 2, 3].includes(mission.stage)
      ) {
        chooseFlightLanding(!mission.divert);
        return;
      }
      if (
        gameMode === 'map' &&
        [
          'Equal',
          'NumpadAdd',
          'Minus',
          'NumpadSubtract',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Digit0',
        ].includes(code)
      ) {
        e.preventDefault();
        if (code === 'Equal' || code === 'NumpadAdd') {
          if (mapZoom === 1)
            mapCenter = {
              x: player.x,
              y: player.y,
            };
          mapZoom = Math.min(9, mapZoom * 1.5);
        }
        if (code === 'Minus' || code === 'NumpadSubtract') mapZoom = Math.max(1, mapZoom / 1.5);
        if (mapZoom === 1 || code === 'Digit0') {
          mapZoom = 1;
          mapCenter = {
            x: (WORLD_LEFT + WORLD_SIZE) / 2,
            y: (WORLD_TOP + WORLD_SIZE) / 2,
          };
        } else {
          const step = 500 / mapZoom;
          mapCenter.x = clamp(
            mapCenter.x + (code === 'ArrowRight' ? step : code === 'ArrowLeft' ? -step : 0),
            WORLD_LEFT,
            WORLD_SIZE,
          );
          mapCenter.y = clamp(
            mapCenter.y + (code === 'ArrowDown' ? step : code === 'ArrowUp' ? -step : 0),
            WORLD_TOP,
            WORLD_SIZE,
          );
        }
        drawMap(cityMapContext, 800, 660, true);
        return;
      }
      if (gameMode === 'arsenal') {
        if (code === 'Tab') trapArsenalFocus(e);
        if (!e.repeat && ['Escape', 'KeyI'].includes(code)) {
          e.preventDefault();
          closeArsenal();
        } else if (!e.repeat && code === 'KeyQ') {
          e.preventDefault();
          cycleWeapon();
          updateUI();
          renderArsenal(selectedWeaponIndex);
        } else if (!e.repeat && (code === 'KeyK' || /^Digit[1-7]$/.test(code))) {
          e.preventDefault();
          selectArsenalWeapon(code === 'KeyK' ? KNIFE_INDEX : Number(code.slice(-1)) - 1);
        }
        return;
      }
      if (gameMode === 'missions') {
        if (code === 'Escape') {
          e.preventDefault();
          closeMissionSelect();
        } else if (/^Digit[0-9]$/.test(code)) {
          // 1-9 pick the first nine jobs; 0 picks the tenth. Later jobs use the buttons.
          e.preventDefault();
          chooseMission(code === 'Digit0' ? 9 : Number(code.slice(-1)) - 1);
        }
        return;
      }
      if (gameMode === 'dialogue') {
        e.preventDefault();
        if (!e.repeat) {
          if (code === 'Enter' || code === 'KeyE') acceptDialogue();
          if (code === 'Escape') closeDialogue();
        }
        return;
      }
      if (gameMode === 'elevator') {
        e.preventDefault();
        return;
      }
      if (gameMode === 'transit') {
        if (code === 'Escape' || code === 'KeyE') {
          e.preventDefault();
          closeTransit();
        }
        return;
      }
      if (gameMode === 'taxi') {
        if (code === 'Escape' || code === 'KeyE') {
          e.preventDefault();
          closeTaxiOffer();
        }
        return;
      }
      if (gameMode === 'service') {
        const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
        if (
          code === 'Tab' ||
          (editing && !['Enter', 'Escape'].includes(code)) ||
          (e.target?.tagName === 'BUTTON' && ['Enter', 'Space'].includes(code))
        )
          return;
        e.preventDefault();
        if (!e.repeat) serviceKey(code);
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code))
        e.preventDefault();
      if (e.repeat) {
        if (gameMode === 'play') keys[code] = true;
        return;
      }
      if (code === 'Escape') {
        togglePause();
        return;
      }
      if (code === 'Tab') {
        toggleMap();
        return;
      }
      if (code === 'KeyM') {
        mute();
        return;
      }
      if (code === 'Slash') {
        openHelp();
        return;
      }
      if (code === 'Enter') {
        if (gameMode === 'menu') begin();
        else if (gameMode === 'pause') togglePause();
        else if (gameMode === 'help') closeHelp();
        return;
      }
      if (gameMode !== 'play') return;
      if (['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract', 'Digit0'].includes(code)) {
        e.preventDefault();
        setWorldZoom(
          code === 'Digit0'
            ? 1
            : worldZoomTarget * (code === 'Minus' || code === 'NumpadSubtract' ? 1 / 1.25 : 1.25),
        );
        return;
      }
      if (code === 'KeyJ') {
        // Aircraft: parachute. Boats and flooding cars: over the side (water.js).
        if (!bailOut()) diveOverboard();
        return;
      }
      if (player.parachute && code === 'Space') {
        deployParachute();
        return;
      }
      if (player.car && code === 'KeyN') {
        toggleCarRadio();
        return;
      }
      if (player.car && code === 'KeyB') {
        tuneCarRadio(carRadioStation + 1);
        return;
      }
      keys[code] = true;
      if (code === 'KeyF' || (code === 'Space' && !player.car)) shoot();
      if (code === 'KeyE') interact();
      if (code === 'KeyP') poisonDrink();
      if (code === 'KeyR') startReload();
      if (code === 'KeyI') openArsenal();
      if (code === 'KeyK' || code === 'Digit7') selectWeapon(KNIFE_INDEX);
      if (/^Digit[1-6]$/.test(code)) selectWeapon(Number(code.slice(-1)) - 1);
      if (code === 'KeyQ') cycleWeapon();
      if (code === 'KeyO') toggleMissionCard();
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          code,
        )
      )
        mouse.active = false;
    });
    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      keys = {};
      mouse.down = false;
      if (gameMode === 'play') togglePause();
      syncCarRadio();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && gameMode === 'play') togglePause();
      syncCarRadio();
    });
    canvas.addEventListener('mousemove', (e) => {
      // Compatibility mouse events synthesized from touches must not hijack the aim.
      if (performance.now() < worldTouchUntil || e.sourceCapabilities?.firesTouchEvents) return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (performance.now() < worldTouchUntil || e.sourceCapabilities?.firesTouchEvents) return;
      if (e.button === 0 && gameMode === 'play') {
        mouse.down = true;
        mouse.active = true;
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        initAudio();
        shoot();
      }
    });
    window.addEventListener('mouseup', () => (mouse.down = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    getElement('voicesBtn').onclick = toggleVoices;
    getElement('creditsBtn').onclick = () => {
      getElement('credits').classList.remove('hidden');
      getElement('closeCredits').focus();
    };
    getElement('closeCredits').onclick = () => {
      getElement('credits').classList.add('hidden');
      getElement('creditsBtn').focus();
    };
    getElement('startBtn').onclick = begin;
    getElement('helpBtn').onclick = openHelp;
    getElement('pauseHelp').onclick = openHelp;
    getElement('closeHelp').onclick = closeHelp;
    getElement('pauseBtn').onclick = togglePause;
    getElement('resumeBtn').onclick = togglePause;
    getElement('mapBtn').onclick = toggleMap;
    getElement('pager').onclick = () => {
      if (gameMode === 'play') toggleMissionCard();
    };
    getElement('closeMap').onclick = toggleMap;
    getElement('soundBtn').onclick = mute;
    getElement('menuSound').onclick = mute;
    getElement('closeTaxi').onclick = closeTaxiOffer;
    // Sandboxed embeds and bare file:// copies cannot deliver this file, so hide
    // the offer instead of showing a link that silently does nothing.
    const offlineCopy = getElement('offlineCopy');
    let sandboxed = location.protocol === 'file:' || !!window.claude;
    try {
      if (window.top !== window.self) sandboxed = true;
    } catch (err) {
      sandboxed = true;
    }
    if (offlineCopy && sandboxed) offlineCopy.hidden = true;
    getElement('restartMission').onclick = retryMission;
    getElement('newGame').onclick = newGame;
    window.addEventListener('resize', resize);
    // @include src/geography.js
    // @include src/harbor.js
    // @include src/police-feedback.js
    // @include src/arsenal.js
    // @include src/citylife.js
    // @include src/story.js
    // @include src/campaign.js
    // @include src/chase.js
    // @include src/roadblocks.js
    // @include src/carjack.js
    // @include src/themepark.js
    // @include src/marina.js
    // @include src/taxi.js
    // @include src/cycles.js
    // @include src/weather.js
    // @include src/water.js
    // @include src/water-audio.js
    // @include src/beach.js
    // @include src/roofmission.js
    // @include src/rooftops.js
    // @include src/air-cover.js
    // @include src/combat-rules.js
    // @include src/damage.js
    // @include src/county.js
    // @include src/military.js
    // @include src/aviation.js
    // @include src/challenges.js
    // @include src/sidejobs.js
    // @include src/streets.js
    // @include src/terrain.js
    // @include src/casino.js
    // @include src/renewal.js
    // @include src/sports.js
    // @include src/sports-world.js
    // @include src/transit.js
    // @include src/ecology.js
    // @include src/navigation.js
    // @include src/parachute.js
    // @include src/mobile.js
    // @include src/world-view.js
    // @include src/car-radio.js
    // @include src/garages.js
    // @include src/crowd.js
    // @include src/ambience.js
    // @include src/quality.js
    // @include src/render3d.js
    // STARTUP ORDER: geometry -> collision -> entities -> saved progression -> UI -> graphics.
    buildWorld();
    buildBuildingGrid();
    buildColliders();
    populate();
    populateStoryWorld();
    populateCounty();
    chooseRoofHelipads();
    load();
    resize();
    drawWeapon();
    updateUI();
    loadVisuals();
    /**
     * PROFILER
     * Rolling averages of simulation and render CPU time per frame, plus the
     * renderer's draw-call and triangle counts. Read through DeadEndCity.stats().
     */
    const profile = { frames: 0, update: 0, draw: 0, frameGap: 0, last: 0, parts: {} };
    function timed(name, fn) {
      const t0 = performance.now();
      fn();
      profile.parts[name] = (profile.parts[name] || 0) + performance.now() - t0;
    }
    /**
     * FPS COUNTER
     * Optional readout switched from the pause menu and remembered in
     * localStorage beside the touch-controls setting. It averages over half a
     * second so the number is readable, and shows the average frame time too.
     */
    const fpsMeter = { shown: false, frames: 0, since: 0 };
    try {
      fpsMeter.shown = localStorage.getItem('dead-end-city-fps') === 'on';
    } catch {}
    function applyFpsSetting() {
      getElement('fpsCounter').classList.toggle('hidden', !fpsMeter.shown);
      getElement('fpsBtn').textContent = 'FPS COUNTER: ' + (fpsMeter.shown ? 'ON' : 'OFF');
      getElement('fpsBtn').setAttribute('aria-pressed', String(fpsMeter.shown));
    }
    function toggleFpsCounter() {
      fpsMeter.shown = !fpsMeter.shown;
      fpsMeter.frames = 0;
      fpsMeter.since = performance.now();
      getElement('fpsCounter').textContent = '-- FPS';
      try {
        localStorage.setItem('dead-end-city-fps', fpsMeter.shown ? 'on' : 'off');
      } catch {}
      applyFpsSetting();
    }
    function updateFpsCounter(t) {
      if (!fpsMeter.shown) return;
      fpsMeter.frames++;
      const elapsed = t - fpsMeter.since;
      if (elapsed < 500) return;
      const fps = (fpsMeter.frames * 1000) / elapsed,
        el = getElement('fpsCounter');
      el.textContent = Math.round(fps) + ' FPS · ' + (elapsed / fpsMeter.frames).toFixed(1) + ' ms';
      el.classList.toggle('slow', fps < 30);
      fpsMeter.frames = 0;
      fpsMeter.since = t;
    }
    getElement('fpsBtn').onclick = toggleFpsCounter;
    applyFpsSetting();
    function frame(t) {
      syncTouchInput();
      updateFpsCounter(t);
      const deltaSeconds = Math.min(0.033, Math.max(0, (t - lastTime) / 1000));
      // Headline cards run on the wall clock: a phone call or pause that opens
      // right after one must not leave it frozen across the middle of the screen.
      if (announceTime > 0) {
        announceTime -= Math.min(0.25, Math.max(0, (t - lastTime) / 1000));
        if (announceTime <= 0) getElement('announcement').classList.remove('show');
      }
      if (profile.last) profile.frameGap += t - profile.last;
      profile.last = t;
      // The police banner is a notice, like the headline cards: it times out on
      // the wall clock (capped per frame) rather than the simulation's 33 ms step,
      // so a slow frame rate cannot leave "POLICE CLEARED!" up for minutes.
      updatePoliceNotice(Math.min(0.25, Math.max(0, (t - lastTime) / 1000)));
      lastTime = t;
      updateWorldView(deltaSeconds);
      updateCasino(deltaSeconds);
      updateElevator(deltaSeconds);
      const updateStart = performance.now();
      if (gameMode === 'play' || gameMode === 'menu' || gameMode === 'dead') update(deltaSeconds);
      else {
        soundUpdate(deltaSeconds);
        updateAmbience(deltaSeconds);
      }
      const drawStart = performance.now();
      drawWorld();
      profile.update += drawStart - updateStart;
      profile.draw += performance.now() - drawStart;
      profile.frames++;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    /**
     * DEVELOPER CONSOLE
     * `DeadEndCity` on window is a small, documented debugging surface used by
     * tools/smoke.mjs and by anyone maintaining the game from the browser
     * console. It reads and writes the same state the game itself uses; it is
     * not a cheat menu wired into the UI. Example: DeadEndCity.teleport(-1844, 2600).
     */
    window.DeadEndCity = Object.freeze({
      version: "29.0.0",
      status: () => ({
        mode: gameMode,
        x: Math.round(player.x),
        y: Math.round(player.y),
        district: districtAt(player.x, player.y),
        hp: Math.ceil(player.hp),
        cash,
        wanted: Math.ceil(wantedStars),
        mission: mission ? missions[mission.index].title : null,
        completed,
        vehicle: player.car ? player.car.type : null,
        clock: clockText(),
        renderer: city3D ? '3d' : '2d',
        vehicles: vehicles.length,
        pedestrians: pedestrians.length,
      }),
      teleport(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('teleport needs two finite numbers');
        teleportPlayer(x, y);
        return this.status();
      },
      setClock(hours) {
        worldMinutes = Math.floor(worldMinutes / 1440) * 1440 + clamp(hours, 0, 24) * 60;
        return clockText();
      },
      setZoom: (value) => setWorldZoom(value),
      startMission(index) {
        if (index >= 0 && index < missions.length) {
          missionIndex = index;
          startMission();
        }
        return this.status();
      },
      missions: () => missions.map((m, i) => ({ index: i, title: m.title, contact: m.contact })),
      // Mission 1 test shortcut: start Dockside Favor if needed, load all three
      // crates, and put the player in the truck on the road outside Vinny's
      // warehouse, facing its shutter, with the harbor alarm already raised.
      skipToDepotDelivery() {
        if (mission?.index !== 0) {
          missionIndex = 0;
          startMission();
        }
        const m = mission;
        for (const p of m.packages) p.got = true;
        m.collected = 3;
        m.loading = null;
        teleportPlayer(-1664, 4180);
        Object.assign(m.car, { x: -1664, y: 4232, a: Math.PI / 2, vx: 0, vy: 0, av: 0, speed: 0 });
        m.car.cargoCount = 3;
        enterVehicle(m.car);
        setStage(3, HARBOR.delivery, 'LEAVE THE HARBOR WITH ALL THREE CRATES');
        notifyCargoPolice(m);
        return { stage: m.stage, instruction: m.instruction, ...this.status() };
      },
      // Where the current mission stands, including Vinny's depot doors.
      missionState: () =>
        mission
          ? {
              index: mission.index,
              stage: mission.stage,
              instruction: mission.instruction,
              target: mission.target
                ? { x: Math.round(mission.target.x), y: Math.round(mission.target.y) }
                : null,
              depotShutter: +depotFrontShutter.toFixed(2),
              depotBackDoor: +depotBackDoor.toFixed(2),
              wanted: Math.ceil(wantedStars),
            }
          : { mission: null, last: lastMissionOutcome, completed, depotShutter: +depotFrontShutter.toFixed(2), depotBackDoor: +depotBackDoor.toFixed(2) },
      // What occupies a map point: land or water, anything solid, road, rail, beach,
      // and whether a car could be parked there. Mission tests use it to check that
      // objectives, spawns and waypoints are not inside buildings or the sea.
      probe(x, y, r = 8) {
        let car = false;
        try {
          car = canSpawnCar('sedan', x, y, 0);
        } catch {}
        return {
          x: Math.round(x),
          y: Math.round(y),
          land: !!landAt(x, y),
          ground: !!groundAt(x, y, r),
          solid: solid(x, y, r),
          rail: railBlocked(x, y, r),
          road: !!onRoad(x, y),
          beach: onBeach(x, y),
          terrain: Math.round(terrainHeight(x, y)),
          carFits: car,
          boatFits: boatFits({ type: 'jetski', x, y, a: 0 }),
          district: districtAt(x, y),
        };
      },
      // The current mission in full: target (with altitude), timer, the mission
      // vehicles, its guards and actors, and each job's own list of points.
      missionTargets() {
        const m = mission;
        if (!m) return null;
        const pt = (p) =>
          p ? { x: Math.round(p.x), y: Math.round(p.y), ...(p.altitude !== undefined ? { altitude: Math.round(p.altitude) } : {}) } : null;
        const car = (c) =>
          c
            ? {
                id: c.id,
                type: c.type,
                x: Math.round(c.x),
                y: Math.round(c.y),
                altitude: Math.round(c.altitude || 0),
                hp: Math.round(c.hp),
                maxhp: c.maxhp,
                speed: Math.round(c.speed || 0),
                burning: !!c.damage?.burning,
                fireSpent: !!c.damage?.fireSpent,
                driver: c === player.car,
                inWorld: vehicles.includes(c),
              }
            : null;
        return {
          index: m.index,
          title: missions[m.index].title,
          stage: m.stage,
          instruction: m.instruction,
          target: pt(m.target),
          timer: m.timeLimit ? Math.round(m.timer) : null,
          wanted: Math.ceil(wantedStars),
          player: { x: Math.round(player.x), y: Math.round(player.y), vehicle: player.car?.type || null, roof: !!player.roof, swimming: !!player.swimming, hp: Math.ceil(player.hp) },
          car: car(m.car),
          missionVehicles: vehicles.filter((c) => c.mission).map(car),
          guards: enemies
            .filter((e) => e.missionTag)
            .map((e) => ({ tag: e.missionTag, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp), solidSpot: solid(e.x, e.y, 6) })),
          // Anyone armed within 600 units who is aiming at something right now.
          hostiles: [...gangMembers, ...enemies]
            .filter((e) => e.hp > 0 && e.aiming && distanceBetween(e, player) < 600)
            .map((e) => ({ faction: e.faction, tag: e.missionTag || null, x: Math.round(e.x), y: Math.round(e.y) })),
          actors: storyActors
            .filter((p) => p.missionTag || p.name === 'ELENA CRUZ')
            .map((p) => ({ name: p.name, x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), hidden: !!p.hidden })),
          points: {
            receipts: m.receipts?.map(pt),
            waterRoute: m.waterRoute?.map(pt),
            gates: m.gates?.map(pt),
            checkpoints: m.checkpoints?.map(pt),
            bombs: m.bombs?.map(pt),
            substations: m.substations?.map(pt),
            rings: m.rings?.map(pt),
            repos: m.repos?.map((r) => ({ label: r.label, delivered: r.delivered, car: car(r.car) })),
            approach: pt(m.approach),
          },
        };
      },
      // Drive the player's road vehicle or boat toward (x, y) through the real
      // physics for up to `seconds`, holding W and steering with A/D, easing off
      // near the point. A straight-line pilot for checking that a route is
      // passable (it does not path-find); returns where it stopped and why. With
      // `passThrough` it does not stop: it counts the point reached at speed.
      steerTo(x, y, seconds = 30, radius = 50, passThrough = false) {
        const c = player.car;
        if (!c || isAircraft(c)) return null;
        let t = 0,
          reason = 'time',
          stuckFor = 0,
          backUp = 0;
        for (; t < seconds; t += 1 / 30) {
          if (gameMode !== 'play' || player.car !== c) {
            reason = 'left vehicle';
            break;
          }
          const d = Math.hypot(x - c.x, y - c.y);
          if (d < radius && (passThrough || Math.abs(c.speed) < 8)) {
            reason = 'arrived';
            break;
          }
          const err = normalizeAngle(Math.atan2(y - c.y, x - c.x) - c.a);
          const fast = !passThrough && c.speed > Math.max(40, d * 0.9);
          // Wedged against a wall or a shore: back off for a moment, wheel turned.
          stuckFor = d > radius && Math.abs(c.speed) < 5 ? stuckFor + 1 / 30 : 0;
          if (stuckFor > 1) backUp = 1;
          if (backUp > 0) {
            backUp -= 1 / 30;
            keys.KeyW = false;
            keys.KeyS = true;
            keys.KeyD = err < 0;
            keys.KeyA = err > 0;
          } else if (Math.abs(err) > 1.9 && c.speed < 25 && !isBoat(c)) {
            // Facing away: back up on opposite lock, a three-point turn.
            keys.KeyW = false;
            keys.KeyS = true;
            keys.KeyD = err < 0;
            keys.KeyA = err > 0;
          } else if (d < radius) {
            // On the spot: just brake to a stop, whichever way it is rolling.
            keys.KeyW = c.speed < -10;
            keys.KeyS = c.speed > 10;
            keys.KeyA = keys.KeyD = false;
          } else {
            keys.KeyW = !fast && (Math.abs(err) < 1.4 || c.speed < 20);
            keys.KeyS = fast || (Math.abs(err) >= 1.4 && c.speed > 20);
            keys.KeyD = err > 0.06;
            keys.KeyA = err < -0.06;
          }
          update(1 / 30);
        }
        keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false;
        return {
          reason,
          seconds: Math.round(t),
          x: Math.round(c.x),
          y: Math.round(c.y),
          speed: Math.round(c.speed || 0),
          hp: Math.round(c.hp),
          left: Math.round(Math.hypot(x - c.x, y - c.y)),
          wanted: Math.ceil(wantedStars),
        };
      },
      // Press the action key once, exactly as E would.
      interact() {
        interact();
        return this.missionState();
      },
      // Put the player at the controls of the current mission's vehicle.
      boardMissionVehicle() {
        const c = mission?.car;
        if (!c) return null;
        if (player.car && player.car !== c) exitCar();
        teleportPlayer(c.x, c.y);
        enterVehicle(c);
        return this.missionState();
      },
      // Move the player's vehicle (with the player aboard) to a point, stopped,
      // facing `heading`; aircraft can be lifted to an altitude in metres.
      placeVehicle(x, y, heading = player.car?.a ?? 0, altitudeMeters = 0) {
        const c = player.car;
        if (!c) return null;
        Object.assign(c, { x, y, a: heading, vx: 0, vy: 0, vz: 0, av: 0, speed: 0 });
        if (isAircraft(c))
          c.altitude = altitudeMeters > 0 ? terrainHeight(x, y) + (altitudeMeters * BLOCK_SIZE) / 100 : terrainHeight(x, y);
        player.x = x;
        player.y = y;
        cameraTarget.x = x;
        cameraTarget.y = y;
        return this.status();
      },
      // Test shortcut for fights already verified: every live guard of the current
      // mission (or only those with `tag`) is put down.
      defeatMissionGuards(tag) {
        let n = 0;
        for (const e of enemies)
          if (e.missionTag && (!tag || e.missionTag === tag) && e.hp > 0) {
            e.hp = 0;
            n++;
          }
        return n;
      },
      god(on = true) {
        player.godMode = !!on;
        return player.godMode;
      },
      // Set the wanted level directly. Useful for looking at containment and air
      // support without having to earn them.
      wanted(stars = 5) {
        const n = clamp(Math.round(stars), 0, 5);
        // Clearing reports the escape exactly like losing them in play would.
        if (n <= 0) clearPolice(true);
        else {
          wantedStars = n;
          wantedLevel = n;
          wantedPressure = n;
          starElapsed = 0;
          searchActive = false;
          searchRemaining = policeSearchSeconds(n);
          lastSeen = {
            x: player.x,
            y: player.y,
          };
        }
        return this.status();
      },
      // Force the sky: clear, fair, cloudy, overcast, rain, storm. Passing nothing
      // hands the sky back to the weather machine.
      sky(id) {
        if (id === undefined) {
          weather.locked = false;
          return weatherLabel();
        }
        weather.locked = true;
        return setWeather(id);
      },
      // What the vehicle under the player is actually doing.
      ride: () => ({
        type: player.car ? player.car.type : null,
        speed: player.car ? Math.round((player.car.speed || 0) * 10) / 10 : 0,
        vx: player.car ? Math.round((player.car.vx || 0) * 10) / 10 : 0,
        vy: player.car ? Math.round((player.car.vy || 0) * 10) / 10 : 0,
        cadence: Math.round(pedalCadence() * 100) / 100,
        effort: Math.round(pedalEffort() * 100) / 100,
      }),
      // Run the simulation forward without drawing, holding the given keys (for
      // example ['KeyW']), so physics tests do not depend on the headless frame
      // rate. Returns the vehicle telemetry at the end.
      simulate(seconds = 1, held = []) {
        for (const code of held) keys[code] = true;
        const steps = Math.round(clamp(seconds, 0, 120) * 30);
        for (let i = 0; i < steps; i++) {
          // A Blue Hour elevator ride runs on its own clock (frame()); step it too.
          if (gameMode === 'elevator') updateElevator(1 / 30);
          else if (gameMode === 'play') update(1 / 30);
          else break;
        }
        for (const code of held) keys[code] = false;
        return this.ride();
      },
      // Rack a bicycle beside the player.
      bike(headingRadians = player.a) {
        spawnClearCar(
          'bicycle',
          player.x + Math.cos(headingRadians) * 30,
          player.y + Math.sin(headingRadians) * 30,
          headingRadians,
          false,
        );
        return this.status();
      },
      // Spawn a vehicle of any VEHICLE_DEFINITIONS type beside the player and put
      // them at the controls. Aircraft can be lifted straight to an altitude in
      // metres above the ground so tests can look at the flight view. An optional
      // heading (radians, 0 = east) points it down a chosen road.
      drive(type = 'sedan', altitudeMeters = 0, headingRadians = player.a) {
        if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
        if (player.car) exitCar();
        const car = spawnClearCar(type, player.x + 60, player.y, headingRadians, false);
        car.authorized = true;
        enterVehicle(car);
        if (altitudeMeters > 0 && isAircraft(car)) {
          car.altitude = terrainHeight(car.x, car.y) + (altitudeMeters * BLOCK_SIZE) / 100;
          if (car.type === 'plane') {
            car.vx = Math.cos(car.a) * 420;
            car.vy = Math.sin(car.a) * 420;
          }
        }
        return this.status();
      },
      // The player and the water: swimming, wading, stamina, shore type and the
      // nearest way out (see water.js).
      swim: () => swimStatus(),
      // Every ladder out of the sea: foot in the water, top on the quay.
      ladders: () =>
        ladderList().map((l) => ({
          kind: l.kind,
          x: Math.round(l.x),
          y: Math.round(l.y),
          top: { x: Math.round(l.top.x), y: Math.round(l.top.y) },
        })),
      // Southport Beach: how busy it is and what everyone is doing (beach.js).
      beach: () => beachStatus(),
      // Rooftop helipads, the roof the player stands on and the roof under the
      // player's helicopter (rooftops.js); with a map point, that roof and its plant.
      rooftops: (x, y) => ({
        ...(x !== undefined
          ? (() => {
              const b = buildingRoofAt(x, y);
              return {
                roofAt: b
                  ? {
                      x: b.x, y: b.y, w: b.w, h: b.h, height: Math.round(b.height), landable: roofLandable(b), archetype: b.archetype || null,
                      keepOuts: (b.roofKeepOuts || []).map((k) => [Math.round(k.x), Math.round(k.y), Math.round(k.hx * 2), Math.round(k.hy * 2)]),
                    }
                  : null,
              };
            })()
          : {}),
        helipads: roofHelipads.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(p.r), z: Math.round(p.z) })),
        onRoof: player.buildingRoof
          ? { x: player.buildingRoof.x, y: player.buildingRoof.y, height: Math.round(player.buildingRoof.height) }
          : null,
        helicopter:
          player.car?.type === 'helicopter'
            ? {
                altitude: Math.round(player.car.altitude),
                roof: player.car.roofSite ? Math.round(player.car.roofSite.height) : null,
                clearance: Math.round(aircraftClearance(player.car)),
              }
            : null,
      }),
      // Place the camera/player at a map point without touching anything else.
      look(x, y, zoom) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('look needs two finite numbers');
        teleportPlayer(x, y);
        // The zoom is applied at once (headless frames are too slow to ease into it).
        if (zoom !== undefined) {
          setWorldZoom(zoom);
          worldZoom = worldZoomTarget;
        }
        return this.status();
      },
      // The plan as data, for layout audits: coast, streets, rail, footprints and
      // every static collider in map units. A test renders it as a debug map and
      // checks for overlaps (a road through a helipad, a viaduct over a berth).
      layout: () => ({
        land: LAND_REGIONS.map((r) => ({ id: r.id, polygon: r.polygon })),
        lakes: COUNTY_LAKES.map((r) => r.polygon),
        beach: BEACH,
        peaks: COUNTY_PEAKS.map((p) => ({ x: p.x, y: p.y, r: p.r })),
        streets: cityStreets().map((r) => ({ points: r.points, width: r.width })),
        boulevards: [...BOULEVARDS, ...SERVICE_ROADS].map((r) => ({ name: r.name, points: r.points, width: r.width })),
        countyRoads: COUNTY_ROADS.map((r) => ({ name: r.name, points: r.points, width: r.width, bridge: !!r.bridge })),
        bridges: BRIDGES.map((b) => ({ id: b.id, name: b.name, link: b.link, a: b.a, b: b.b, width: b.width, deck: b.deck, pylons: bridgePylons(b) })),
        reserved: { beachClub: BEACH_CLUB_PLOT, themePark: THEME_PARK_RESERVE },
        rail: RAIL_LINES.map((l) => ({ id: l.id, name: l.name, color: l.color, points: l.points })),
        railDecks: railDecks(),
        railPiers: railPiers.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
        stations: RAIL_STATIONS.map((s) => ({ name: s.name, x: s.x, y: s.y, entry: s.entry, lift: s.lift })),
        buildings: buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, height: Math.round(b.height) })),
        helipads: HELIPADS,
        trees: trees.map((t) => [Math.round(t.x), Math.round(t.y), t.r]),
        lamps: lamps.map((l) => [Math.round(l.x), Math.round(l.y)]),
        benches: benchSpots().map((b) => [Math.round(b.x), Math.round(b.y)]),
        docks: DOCKS.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, boatX: d.boatX, boatY: d.boatY })),
        parks: CITY_PARKS.map((p) => ({ name: p.name, x: p.x, y: p.y, w: p.w, h: p.h })),
        places: PLACES.filter((p) => p.w).map((p) => ({ name: p.name, x: p.x, y: p.y, w: p.w, h: p.h })),
        ships: [
          { name: 'harbor ship', x: HARBOR.ship.x, y: HARBOR.ship.y, hx: HARBOR.ship.w / 2, hy: HARBOR.ship.l / 2, a: 0 },
          ...LINERS.map((s) => ({ name: s.name, ...shipHull(s) })),
        ],
        marina: MARINA,
        statics: staticBodies
          .filter((b) => b.kind !== 'coast' && b.kind !== 'building')
          .map((b) => ({ x: b.x, y: b.y, hx: b.hx, hy: b.hy, a: b.a, kind: b.kind })),
      }),
      // Every train on the network: where it is, how fast, and whether it carries the player.
      trains: () =>
        railTrains.map((t) => ({
          x: Math.round(t.x),
          y: Math.round(t.y),
          speed: Math.round(t.speed),
          passenger: !!t.passenger,
          target: t.passenger ? transitRide?.target.name : null,
        })),
      // Run the railway forward by `seconds` in 1/30 s steps: a ride takes minutes
      // of game time, which headless test browsers render at a few frames a second.
      advanceTrains(seconds = 10) {
        for (let t = 0; t < seconds; t += 1 / 30) updateTransit(1 / 30);
        return this.trains();
      },
      // Named places the tests can visit: every PLACES entry plus the landmarks.
      places: () => PLACES.map((p) => ({ name: p.name, x: Math.round(p.x), y: Math.round(p.y) })),
      // Put a cab at the kerb and ride it somewhere, without hunting for one.
      cab(x, y) {
        const car = spawnClearCar('taxi', player.x + 44, player.y, 0, true);
        assignDriver(car);
        if (x === undefined) return this.status();
        startTaxiRide(car, { x, y });
        return { riding: !!taxiRide, fare: taxiRide?.fare ?? null, stops: taxiRide?.route.length ?? 0 };
      },
      // The chokepoint catalogue and the state of the cordon.
      containment: () => ({
        sites: roadblockSites().length,
        budget: containmentBudget(),
        active: roadblocks.length,
        nextPlanIn: Math.round(Math.max(0, containmentTimer) * 10) / 10,
      }),
      // Where the police have cut the map right now.
      roadblocks: () =>
        roadblocks.map((b) => ({
          name: b.site.name,
          x: Math.round(b.x),
          y: Math.round(b.y),
          cars: b.cars.filter((c) => c.hp > 0).length,
          officers: b.crew.filter((o) => o.hp > 0).length,
          // Cruisers still anchored; a heavy rammer knocks them loose.
          braced: b.cars.filter((c) => c.hp > 0 && c.braced).length,
          conesKnocked: b.cones.filter((c) => c.tipped).length,
          breached: !!b.breached,
        })),
      // Build a police cut at chokepoint `siteIndex` (see containment().sites),
      // or at the one nearest the player, and describe it. Dispatch's next re-plan
      // is held off for a minute so the cut survives a clean wanted level.
      roadblock(siteIndex) {
        containmentTimer = 60;
        const sites = roadblockSites(),
          site =
            sites[siteIndex] ||
            sites.reduce((best, s) => (distanceBetween(s, player) < distanceBetween(best, player) ? s : best));
        const block = roadblockAt(site) || buildRoadblock(site);
        return block
          ? { name: site.name, x: site.x, y: site.y, axis: site.axis, cars: block.cars.length }
          : null;
      },
      // Set the current vehicle moving along its heading at `metersPerSecond`.
      launch(metersPerSecond = 20) {
        const c = player.car;
        if (!c) return null;
        const speed = (metersPerSecond * BLOCK_SIZE) / 100;
        c.vx = Math.cos(c.a) * speed;
        c.vy = Math.sin(c.a) * speed;
        c.speed = speed;
        return this.ride();
      },
      // The crowd around the player: counts by reaction, pose, role and state,
      // street scenes, recent incidents and witness reports (src/crowd.js).
      pedestrianReport: () => pedestrianReport(),
      // Fire the equipped weapon toward a map point, exactly as the player would.
      fireShot(x, y) {
        if (player.car) exitCar();
        player.a = Math.atan2(y - player.y, x - player.x);
        shotCooldownSeconds = 0;
        reloadSecondsRemaining = 0;
        const w = currentWeapon();
        if (!w.melee && w.ammo <= 0) w.ammo = w.clip;
        const aimWasActive = mouse.active;
        mouse.active = false;
        shoot();
        mouse.active = aimWasActive;
        return { x: Math.round(player.x), y: Math.round(player.y), heading: +player.a.toFixed(2) };
      },
      // Stage a street scene next to the player: vendor, busker, cafe, smokers,
      // delivery, hail, nightlife (nearest bar or club) or busStop (nearest shelter).
      lifeScene(kind) {
        crowd.settleStamp = gameTime;
        const near = (list) => list.reduce((a, b) => (distanceBetween(a, player) < distanceBetween(b, player) ? a : b));
        const place = near(PLACES.filter((p) => (p.kind === 'bar' || p.kind === 'club') && p.door)),
          stop = BUS_STOPS.length ? near(BUS_STOPS) : null,
          existing = crowd.scenes.find((s) => (kind === 'nightlife' && s.place === place) || (kind === 'busStop' && s.stop === stop));
        const s = existing
          ? existing
          : kind === 'nightlife'
            ? stageNightlife(place)
            : kind === 'busStop'
              ? stop
                ? stageBusStop(stop)
                : null
              : kind === 'hail'
                ? stageHail()
                : { vendor: stageVendor, busker: stageBusker, cafe: stageCafe, smokers: stageSmokers, delivery: stageDelivery }[kind]?.(true);
        return s ? { kind: s.kind, x: Math.round(s.x), y: Math.round(s.y), members: s.members.length } : null;
      },
      // Put an occupied car across the road ahead and drive the player's car into
      // it at `metersPerSecond`, for looking at crash reactions.
      stageCrash(metersPerSecond = 18) {
        if (!player.car) this.drive('sedan', 0, 0);
        const c = player.car,
          target = spawnClearCar('sedan', c.x + Math.cos(c.a) * 120, c.y + Math.sin(c.a) * 120, c.a + Math.PI / 2, true, '#b57374');
        target.occupied = true;
        target.driverMood = 'angry';
        target.vx = target.vy = target.speed = 0;
        this.launch(metersPerSecond);
        return { target: { x: Math.round(target.x), y: Math.round(target.y) } };
      },
      // Inspection only: zoom the camera in past the player's limit to look at
      // people up close. Anything above 1.5 is not reachable in play.
      closeUp(zoom = 4) {
        worldZoom = worldZoomTarget = clamp(zoom, 0.14, 8);
        return worldZoom;
      },
      // Line up one pedestrian per pose in front of the player (for screenshots);
      // `role` dresses them all alike, e.g. 'commuter'.
      poseGallery: (role) => poseGallery(role),
      // Raise an incident at a map point without firing: gunfire, explosion, crash.
      alarm(kind = 'gunfire', x = player.x, y = player.y) {
        const inc = crowdAlarm(kind, { x, y }, kind === 'crash' ? null : player, 1.4);
        return inc ? { kind: inc.kind, x: Math.round(inc.x), y: Math.round(inc.y) } : null;
      },
      // Where the player stands aboard the superyacht (null when not aboard), and a
      // shortcut onto her swim platform so tests can go straight to the decks.
      yacht: () => superyachtDeckState(),
      boardYacht() {
        teleportPlayer(SUPERYACHT.board.x, SUPERYACHT.board.y);
        boardLiner(SUPERYACHT);
        return superyachtDeckState();
      },
      // Walk the player on foot `distance` units toward `heading` (radians, 0 is
      // east) in small steps through the normal collision code. Headless frames
      // are far too slow to walk anywhere by holding a key.
      walk(heading, distance = 50) {
        for (let i = 0; i < Math.ceil(distance / 2); i++) {
          moveBody(player, Math.cos(heading) * 2, Math.sin(heading) * 2, 8);
          updateMarinaFooting();
        }
        player.a = heading;
        return { x: Math.round(player.x), y: Math.round(player.y), yacht: superyachtDeckState() };
      },
      // Damage testing: park(), shootAt(), blast(), crashTest(), damageReport(),
      // streetProps(), damageStats() (see damage.js damageConsole).
      ...damageConsole(),
      // Graphics quality: 'auto', 'low', 'medium', 'high' or 'ultra' (saved like the
      // pause-menu setting); returns what the renderer is now using.
      graphics(tier) {
        if (tier !== undefined) cycleGraphicsSetting(String(tier).toLowerCase());
        return { setting: graphicsSetting, ...(city3D?.quality?.() || {}) };
      },
      // Show the ambient-occlusion or bloom buffer instead of the image ('ao',
      // 'bloom'; nothing for the image) to tune the post-processing.
      postView: (mode) => city3D?.postView?.(mode) ?? null,
      // Scene draw calls in view by object name and by map cell (render3d.js).
      drawProfile: (top) => city3D?.drawProfile?.(top) ?? null,
      // Average CPU milliseconds per frame since the last call, plus renderer counters.
      stats() {
        const n = Math.max(1, profile.frames),
          info = city3D?.info?.() || null,
          out = {
            frames: profile.frames,
            updateMs: +(profile.update / n).toFixed(2),
            drawMs: +(profile.draw / n).toFixed(2),
            frameMs: +(profile.frameGap / n).toFixed(1),
            drawCalls: info?.calls ?? null,
            triangles: info?.triangles ?? null,
            // Whether the shadow map was redrawn (its calls included) in that frame,
            // and calls including the post-processing passes.
            shadowFrame: info?.shadowFrame ?? null,
            // Camera-only calls, and the shadow map's calls on its last refresh.
            viewCalls: info?.viewCalls ?? null,
            shadowCalls: info?.shadowCalls ?? null,
            frameCalls: info?.frameCalls ?? null,
            sceneObjects: info?.objects ?? null,
            byType: info?.byType ?? null,
            vehicles: vehicles.length,
            pedestrians: pedestrians.length,
            parts: Object.fromEntries(
              Object.entries(profile.parts)
                .map(([k, v]) => [k, +(v / n).toFixed(2)])
                .sort((a, b) => b[1] - a[1]),
            ),
          };
        profile.frames = profile.update = profile.draw = profile.frameGap = 0;
        profile.parts = {};
        return out;
      },
    });
    // Optional browser agent access uses exactly the same actions as the controls.
    if (document.modelContext?.registerTool) {
      const noArgs = {
        type: 'object',
        properties: {},
        additionalProperties: false,
      };
      const validate = (x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x) || Object.keys(x).length)
          throw Error('This action takes an empty object.');
      };
      for (const tool of [
        {
          name: 'read_game_status',
          title: 'Read game status',
          description: 'Read the current mission, health, cash, wanted level and vehicle.',
          inputSchema: noArgs,
          annotations: {
            readOnlyHint: true,
          },
          execute(input) {
            validate(input);
            return {
              mode: gameMode,
              mission: mission ? missions[mission.index].title : null,
              jobsCompleted: completed,
              health: Math.ceil(player.hp),
              cash,
              wanted: Math.ceil(wantedStars),
              vehicle: player.car ? VEHICLE_DEFINITIONS[player.car.type].name : null,
            };
          },
        },
        {
          name: 'start_game',
          title: 'Start game',
          description: 'Enter the city from the start screen.',
          inputSchema: noArgs,
          annotations: {
            readOnlyHint: false,
          },
          execute(input) {
            validate(input);
            if (gameMode !== 'menu') throw Error('The game has already started.');
            begin();
            return {
              mode: gameMode,
            };
          },
        },
        {
          name: 'pause_game',
          title: 'Pause game',
          description: 'Pause an active game and show its pause menu.',
          inputSchema: noArgs,
          annotations: {
            readOnlyHint: false,
          },
          execute(input) {
            validate(input);
            if (gameMode !== 'play') throw Error('The game is not running.');
            togglePause();
            return {
              mode: gameMode,
            };
          },
        },
      ])
        try {
          Promise.resolve(document.modelContext.registerTool(tool)).catch(() => {});
        } catch {}
    }
  })();
  // END SUBSYSTEM: src/game.js
