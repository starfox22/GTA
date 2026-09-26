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
     * Map coordinates are (x, y), measured in world units: UNITS_PER_METRE (8) to the metre, 512 units = 64 m.
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

    // The build's version, shown on the title menu and by DeadEndCity.version.
    const GAME_VERSION = '30.0.0';
    /**
     * DEMO BUILD FLAG
     * true: the public demo. A normal player gets missions 1 and 2 only; every
     * later story mission and contract shows as FULL GAME in the picker and the
     * payphone stops ringing after mission 2, whose completion shows the DEMO
     * COMPLETE card (thanks, stats, free roam or main menu). Free roam and its
     * activities stay open. God mode (the godmode cheat) plays everything, with
     * no card. false: the full game, with no demo gates or badges at all.
     * See campaign.js PUBLIC DEMO.
     */
    const DEMO_BUILD = true;
    /**
     * HUD WRITE GUARD
     * The HUD is refreshed ~11 times a second and sets forty-odd texts whether or
     * not they changed. Writing textContent or innerHTML always replaces the
     * element's children, which dirties style and layout for the whole overlay
     * even when the text is the same. Elements fetched through getElement() get
     * instance setters that skip a write whose value is already on screen (read
     * back from the DOM, so a change made any other way is never masked).
     */
    const textContentProperty = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent'),
      innerHtmlProperty = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'),
      guardedElements = new WeakSet();
    function guardElementWrites(el) {
      guardedElements.add(el);
      if (!textContentProperty?.set || !innerHtmlProperty?.set) return el;
      let lastHtml = null,
        lastSerialized = null;
      Object.defineProperty(el, 'textContent', {
        configurable: true,
        get() {
          return textContentProperty.get.call(this);
        },
        set(value) {
          const text = value === null || value === undefined ? '' : String(value);
          // Same text held as one plain text node (or nothing at all): no change.
          const nodes = this.childNodes;
          if (
            text === '' ? nodes.length === 0 : nodes.length === 1 && nodes[0].nodeType === 3 && nodes[0].data === text
          )
            return;
          textContentProperty.set.call(this, text);
        },
      });
      Object.defineProperty(el, 'innerHTML', {
        configurable: true,
        get() {
          return innerHtmlProperty.get.call(this);
        },
        set(value) {
          const html = value === null || value === undefined ? '' : String(value);
          if (html === lastHtml && innerHtmlProperty.get.call(this) === lastSerialized) return;
          innerHtmlProperty.set.call(this, html);
          lastHtml = html;
          lastSerialized = innerHtmlProperty.get.call(this);
        },
      });
      return el;
    }
    const getElement = (id) => {
        const el = document.getElementById(id);
        return el && !guardedElements.has(el) ? guardElementWrites(el) : el;
      },
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
    /**
     * WORLD SCALE
     * The one constant that ties map units to metres: 8 units to the metre. It
     * came from the roads, boats and aircraft, which were drawn true (a traffic
     * lane with its gutter is 44 units, 5.5 m; the courier plane 112, 14 m; the
     * speedboat 58, 7.25 m), and everything else is now true to it as well:
     * vehicles are specified in metres (VEHICLE_DEFINITIONS), people stand
     * PERSON_HEIGHT (1.75 m), buildings rise in real storeys (STOREY 3.2 m over a
     * 4.5 m SHOP_FLOOR, realBuildingHeight), doors are DOOR_HEIGHT (2.3 m) and the
     * street furniture is its real size (a 9 m lamp post, a 7 m street tree). A
     * city block (512) is 64 m. Every speed, gravity and readout (speedometer,
     * flight instruments, knots, metres) derives from it; write real speeds as
     * `50 * KMH`, accelerations as `0.8 * GRAVITY`, sizes as `4.8 * UNITS_PER_METRE`.
     * DeadEndCity.scaleReport() measures the built models against it.
     */
    const UNITS_PER_METRE = 8,
      METERS_PER_UNIT = 1 / UNITS_PER_METRE,
      // Map units per second in one km/h, in one knot; one g in map units per second squared.
      KMH = UNITS_PER_METRE / 3.6,
      KNOTS = UNITS_PER_METRE * 0.514444,
      GRAVITY = 9.81 * UNITS_PER_METRE;
    /* PEOPLE. Everyone on foot is one character rig (character-rig3d.js),
       modelled at real height: PERSON_HEIGHT, an average adult's 1.75 m, to the
       crown at look.height 1 (adults 1.6-1.9 m, the player 1.80 m). The rig is
       never scaled again. PERSON_SCALE converts measurements taken on the old
       17.4-unit figures (a hand at 10, a head at 15) to real size, for code
       that still places things by them. A round hits a person within
       PERSON_HIT_RADIUS of their centre. */
    const PERSON_HEIGHT = 1.75 * UNITS_PER_METRE,
      PERSON_SCALE = PERSON_HEIGHT / 17.4,
      PERSON_HIT_RADIUS = 10 * PERSON_SCALE;
    /* BUILDINGS. A storey is STOREY high (3.2 m floor to floor) over a ground
       floor of SHOP_FLOOR (4.5 m, shopfronts and lobbies) with doors DOOR_HEIGHT
       (2.3 m) high. realBuildingHeight() turns the city plan's height numbers
       (drawn when a storey was 15 units) into those. */
    const STOREY = 3.2 * UNITS_PER_METRE,
      SHOP_FLOOR = 4.5 * UNITS_PER_METRE,
      DOOR_HEIGHT = 2.3 * UNITS_PER_METRE,
      // A height in the city plan's numbers, which were drawn when a storey was 15
      // units (a two-storey house 30, a forty-storey tower 600), as the ground
      // floor plus that many real storeys: 30 -> 62 (7.7 m), 600 -> 1034 (129 m).
      realBuildingHeight = (planHeight) => Math.max(planHeight, SHOP_FLOOR + (planHeight / 15 - 1) * STOREY);
    /* On foot, in map units a second: the player runs by default (FOOT_RUN, the
       full running gait) and walks while the walk action is held (Shift,
       controls.js). There is no separate sprint: the run outpaces every officer
       on foot (pursuit.js OFFICER_KINDS, 16-19 km/h). The Blue Hour terrace is
       always walked (a stealth party, roofmission.js). */
    const FOOT_WALK = 5.4 * KMH,
      FOOT_RUN = 25 * KMH; // a strong runner's pace, quick for a game but humanly possible
    /* The pace the player's legs are going on foot now; the movement, mountain
       footing (terrain.js), footsteps (audio.js) and the police's aim read it. */
    function footPace() {
      return player.roof || actionHeld('walk') ? FOOT_WALK : FOOT_RUN;
    }
    /* People's legs: one stride (two steps) covers 10 units plus 0.3 s of travel,
       so a walk steps about twice a second and a sprint four times. strideCycle
       is in map units (crowd3d.js advances its phase by distance over it);
       strideRate is the same in radians a second for the simple `walk` phases. */
    const strideCycle = (speed) => 10 + 0.3 * Math.abs(speed),
      strideRate = (speed) => (TAU * Math.abs(speed)) / strideCycle(speed);
    const worldMeters = (units) => units * METERS_PER_UNIT,
      // Map units a second -> km/h, the one conversion every speed readout uses.
      speedKmh = (unitsPerSecond) => (unitsPerSecond / KMH),
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
        [-4, 2],
        [-4, 5],
        [-5, 8],
        [-4, 9],
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
    // Set only by the console's holdSimulation (screenshot sequences).
    let simulationHeld = false;
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
      // In a plane the camera leads the aircraft along its velocity, smoothed so a
      // turn swings the view round gently instead of whipping it (updateGame).
      planeCameraLead = { x: 0, y: 0 },
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
    /* Paint palettes (VEHICLE_DEFINITIONS `palette`): what real cars of each class
       come in, most popular first-ish; vehiclePaint(type) picks one. cars3d.js
       gives bright solids a gloss finish and the rest a metallic flake. */
    const PAINT_EVERYDAY = ['#e8eae9', '#b9bdc1', '#7a7f85', '#3e4348', '#16181b', '#1f3455', '#7c1b20', '#c7b89b', '#34503f', '#8aa8c4', '#5b4839', '#a25666'],
      PAINT_SPORT = ['#b3121b', '#e9b82a', '#f06a12', '#1e56b8', '#16181b', '#eceeed', '#2f7d3a', '#9aa3ab', '#0f7fa0', '#5e2b7e'],
      PAINT_LUXURY = ['#16181b', '#1f2a38', '#e9eae6', '#3d4148', '#4a2a2e', '#b8b3a8', '#2b3d33'];
    // The rare exotica: seen now and then in traffic, parked at the upscale
    // addresses (populate, SHOWCASE PARKING).
    const FLAGSHIP_TYPES = ['chevette', 'brutini', 'cavalino', 'dolcati', 'yamasaki'];
    function vehiclePaint(type) {
      const spec = VEHICLE_DEFINITIONS[type];
      return randomChoice(spec?.palette || VEHICLE_PAINT_COLORS);
    }
    // Every civilian car and motorbike, for DeadEndCity.carLineup().
    const CIVILIAN_LINEUP = ['sedan', 'taxi', 'coupe', 'muscle', 'sport', 'roadster', 'rally', 'hotrod', 'supercar', 'luxury', 'limousine', 'suv', 'van', 'pickup', 'chevette', 'brutini', 'cavalino', 'bike', 'cruiser', 'dolcati', 'yamasaki', 'kr500'];
    /* Sizes are real (WORLD SCALE): `l` is the length and `w` the collider's width,
       the body plus its mirrors (car bodies are drawn 0.87 of it, trucks' 0.91), both
       written in metres. `modelScale` is the scale the model is drawn at: it is
       built at its design size, (l, w) / modelScale, so the parts its builder sizes
       in fixed units (roof and beltline heights, wheels, lamps, mirrors, lightbars,
       riders) come out real while its length and width match the collider
       (render3d.js designSize). An array scales x, y and z apart (the tank). */
    const VEHICLE_DEFINITIONS = {
      bicycle: {
        name: 'CITY CYCLE',
        // A city bike: 1.8 m, bars 0.6 m.
        l: 1.85 * UNITS_PER_METRE,
        w: 0.62 * UNITS_PER_METRE,
        modelScale: 0.47,
        // Pedal-limited: a fit rider's city cruise of about 27 km/h, a little
        // quicker than the run on foot; pedalDrive (cycles.js) tapers the legs'
        // push toward it, and standing on the pedals raises it to about 43 km/h.
        max: 27 * KMH,
        acc: 0.16 * GRAVITY,
        turn: 3.9,
        hp: 85,
        mass: 0.12,
        brake: 0.6 * GRAVITY,
        cornerG: 0.9,
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
        // Only the engine note reads these: the flight model is aviation.js.
        max: 500 * KMH,
        acc: 0.3 * GRAVITY,
        turn: 0.8,
        hp: 250,
        mass: 2.8,
        plane: true,
        color: '#ded4b8',
      },
      tank: {
        name: 'SENTINEL M120 MAIN BATTLE TANK',
        offroad: true,
        // A main battle tank's 7.9 m hull (the gun reaches 1.5 m past it). The model
        // is drawn at one scale (its turret turns); it is a little broad and tall.
        l: 7.9 * UNITS_PER_METRE,
        w: 4.4 * UNITS_PER_METRE,
        modelScale: 0.7,
        topKmh: 55,
        zeroTo: [30, 6.5],
        brakeG: 0.6,
        cornerG: 0.75,
        tractionG: 0.35,
        turn: 1.35,
        hp: 1600,
        // A main battle tank weighs 55-65 t: nothing on the road moves it.
        mass: 55,
        grip: 13,
        tank: true,
        color: '#657652',
      },
      flatbed: {
        balance: -0.7,
        name: 'ATLAS CARGO FLATBED',
        // A medium flatbed, 2.55 m body.
        l: 9.5 * UNITS_PER_METRE,
        w: 2.8 * UNITS_PER_METRE,
        modelScale: 0.9,
        topKmh: 120,
        zeroTo: [100, 22],
        brakeG: 0.7,
        cornerG: 0.85,
        tractionG: 0.35,
        turn: 1.1,
        hp: 370,
        mass: 5.8,
        grip: 6,
        truck: true,
        color: '#b69b68',
      },
      roadster: {
        balance: 0.5,
        name: 'SOLSTICE SPIDER',
        // A two-seat roadster.
        l: 4.2 * UNITS_PER_METRE,
        w: 2.05 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 250,
        zeroTo: [100, 4.8],
        brakeG: 1.1,
        cornerG: 1.55,
        tractionG: 0.8,
        turn: 2.7,
        hp: 120,
        mass: 1.12,
        grip: 8.4,
        color: '#b3121b',
        palette: PAINT_SPORT,
      },
      rally: {
        balance: 0.1,
        name: 'KODIAK RS',
        // A rally hatchback.
        l: 4.35 * UNITS_PER_METRE,
        w: 2.07 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 230,
        zeroTo: [100, 4.0],
        brakeG: 1.1,
        cornerG: 1.5,
        tractionG: 0.95,
        turn: 2.65,
        hp: 175,
        mass: 1.38,
        grip: 11,
        color: '#1f4fbf',
        palette: ['#1f4fbf', '#eceeed', '#16181b', '#b3121b', '#9aa3ab', '#2f7d3a'],
      },
      limousine: {
        balance: -0.5,
        name: 'SOVEREIGN STRETCH',
        // A stretch limousine.
        l: 8.8 * UNITS_PER_METRE,
        w: 2.3 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 190,
        zeroTo: [100, 9.5],
        brakeG: 0.9,
        cornerG: 1.05,
        tractionG: 0.5,
        turn: 1.18,
        hp: 290,
        mass: 3.4,
        grip: 5.8,
        color: '#222b37',
        palette: PAINT_LUXURY,
      },
      hotrod: {
        balance: 0.7,
        name: 'HELLFIRE CUSTOM',
        // A hot rod.
        l: 4.5 * UNITS_PER_METRE,
        w: 2.07 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 235,
        zeroTo: [100, 4.3],
        brakeG: 0.95,
        cornerG: 1.15,
        tractionG: 0.75,
        turn: 1.95,
        hp: 145,
        mass: 1.5,
        grip: 5.2,
        color: '#8f1b1b',
        palette: ['#8f1b1b', '#16181b', '#d8561a', '#2a4f8a', '#e3b23c', '#3b6b5c', '#5e2b7e'],
      },
      bike: {
        name: 'VORTEX 900',
        // A sport bike.
        l: 2.1 * UNITS_PER_METRE,
        w: 0.8 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 225,
        zeroTo: [100, 3.2],
        brakeG: 1.0,
        cornerG: 1.35,
        tractionG: 0.95,
        turn: 3.1,
        hp: 85,
        mass: 0.3,
        grip: 9,
        bike: true,
        color: '#c4483c',
        palette: ['#c4483c', '#1e56b8', '#16181b', '#eceeed', '#5bbd2b', '#e9b82a'],
      },
      cruiser: {
        name: 'NOMAD CRUISER',
        // A cruiser motorbike.
        l: 2.45 * UNITS_PER_METRE,
        w: 0.95 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 180,
        zeroTo: [100, 5.0],
        brakeG: 0.9,
        cornerG: 1.25,
        tractionG: 0.75,
        turn: 2.3,
        hp: 110,
        mass: 0.44,
        grip: 7,
        bike: true,
        color: '#313f4b',
        palette: ['#16181b', '#5a1a22', '#1f3455', '#8b8f94', '#3b3f44', '#e9eae6'],
      },
      supercar: {
        balance: 0.2,
        name: 'V12 TEMPEST',
        // A supercar, 2.0 m body.
        l: 4.7 * UNITS_PER_METRE,
        w: 2.3 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 330,
        zeroTo: [100, 2.9],
        brakeG: 1.2,
        cornerG: 1.75,
        tractionG: 1.05,
        turn: 2.5,
        hp: 130,
        mass: 1.35,
        grip: 9,
        color: '#2f5a3a',
        palette: ['#b3121b', '#1a1c20', '#9aa3ab', '#eceeed', '#1f3455', '#2f5a3a', '#e9b82a'],
      },
      luxury: {
        name: 'MONARCH V12',
        // A full-size luxury saloon.
        l: 5.3 * UNITS_PER_METRE,
        w: 2.24 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 250,
        zeroTo: [100, 5.0],
        brakeG: 1.1,
        cornerG: 1.4,
        tractionG: 0.75,
        turn: 1.7,
        hp: 205,
        mass: 2.05,
        grip: 6,
        color: '#283b4c',
        palette: PAINT_LUXURY,
      },
      suv: {
        balance: -0.4,
        name: 'RANGER 4X4',
        offroad: true,
        // A mid-size SUV.
        l: 4.95 * UNITS_PER_METRE,
        w: 2.24 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 175,
        zeroTo: [100, 9.0],
        brakeG: 0.95,
        cornerG: 1.2,
        tractionG: 0.6,
        turn: 1.8,
        hp: 250,
        mass: 2.3,
        grip: 6,
        color: '#34503f',
        palette: ['#16181b', '#eceeed', '#b9bdc1', '#3e4348', '#34503f', '#1f3455', '#5b4839', '#6e7a5a'],
      },
      pickup: {
        balance: -0.4,
        name: 'WORKHORSE',
        // A full-size pickup, 2.0 m body, 1.95 m tall.
        l: 5.6 * UNITS_PER_METRE,
        w: 2.23 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 165,
        zeroTo: [100, 10.0],
        brakeG: 0.9,
        cornerG: 1.15,
        tractionG: 0.55,
        turn: 1.6,
        hp: 280,
        mass: 2.7,
        truck: true,
        color: '#1f3455',
        palette: ['#eceeed', '#16181b', '#9aa3ab', '#8e1c1f', '#1f3455', '#3e4348', '#6e5a3f', '#34503f'],
      },
      truck: {
        balance: -0.7,
        name: 'ATLAS BOX TRUCK',
        // A box truck, 2.55 m body.
        l: 10 * UNITS_PER_METRE,
        w: 2.8 * UNITS_PER_METRE,
        modelScale: 0.9,
        topKmh: 115,
        zeroTo: [100, 21],
        brakeG: 0.7,
        cornerG: 0.85,
        tractionG: 0.35,
        turn: 1.05,
        hp: 420,
        mass: 6.8,
        grip: 5,
        truck: true,
        color: '#b4b9ad',
      },
      bus: {
        balance: -0.8,
        name: 'METRO CITY BUS',
        // A twelve-metre city bus, 2.55 m wide, 3.2 m tall.
        l: 12 * UNITS_PER_METRE,
        w: 2.8 * UNITS_PER_METRE,
        modelScale: 0.82,
        topKmh: 100,
        zeroTo: [50, 9],
        brakeG: 0.65,
        cornerG: 0.8,
        tractionG: 0.3,
        turn: 0.88,
        hp: 480,
        // A twelve-metre city bus, empty.
        mass: 11.5,
        grip: 5,
        truck: true,
        color: '#b78b45',
      },
      ambulance: {
        balance: -0.5,
        name: 'PARAMEDIC',
        // A box ambulance, 2.3 m body.
        l: 6.7 * UNITS_PER_METRE,
        w: 2.5 * UNITS_PER_METRE,
        modelScale: 0.78,
        topKmh: 155,
        zeroTo: [100, 12],
        brakeG: 0.85,
        cornerG: 1.1,
        tractionG: 0.5,
        turn: 1.7,
        hp: 265,
        mass: 2.9,
        truck: true,
        color: '#dfdfd3',
      },
      speedboat: {
        name: 'STINGRAY SPEEDBOAT',
        l: 58,
        w: 25,
        // A 7.5 m sport boat: about 55 knots flat out.
        max: 55 * KNOTS,
        acc: 0.36 * GRAVITY,
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
        // A 9 m displacement launch: about 14 knots.
        max: 14 * KNOTS,
        acc: 0.09 * GRAVITY,
        turn: 0.95,
        hp: 300,
        mass: 4.2,
        boat: true,
        color: '#729b9c',
      },
      coupe: {
        balance: 0.1,
        mass: 1.25,
        name: 'VOLT COUPE',
        // A compact coupe.
        l: 4.4 * UNITS_PER_METRE,
        w: 2.07 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 205,
        zeroTo: [100, 6.5],
        brakeG: 1.05,
        cornerG: 1.45,
        tractionG: 0.7,
        turn: 2.5,
        hp: 130,
        color: '#eceeed',
        palette: ['#eceeed', '#9aa3ab', '#16181b', '#1e56b8', '#b3121b', '#3e4348', '#7fa2bf', '#2d5b4c'],
      },
      muscle: {
        balance: 0.6,
        mass: 1.65,
        name: 'DUKE V8',
        // A muscle car.
        l: 5 * UNITS_PER_METRE,
        w: 2.2 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 245,
        zeroTo: [100, 5.0],
        brakeG: 1.0,
        cornerG: 1.3,
        tractionG: 0.8,
        turn: 2.05,
        hp: 160,
        color: '#b3121b',
        palette: ['#b3121b', '#16181b', '#eceeed', '#f06a12', '#1e56b8', '#8b8f94', '#2b6b3a', '#5e2b7e', '#e9b82a'],
      },
      taxi: {
        mass: 1.5,
        name: 'CITY CAB',
        // A sedan cab.
        l: 4.9 * UNITS_PER_METRE,
        w: 2.13 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 175,
        zeroTo: [100, 9.5],
        brakeG: 1.0,
        cornerG: 1.25,
        tractionG: 0.6,
        turn: 2.15,
        hp: 145,
        color: '#f2b705',
        palette: ['#f2b705'],
      },
      van: {
        balance: -0.5,
        mass: 2.35,
        name: 'MULE VAN',
        // A panel van.
        l: 5.25 * UNITS_PER_METRE,
        w: 2.3 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 150,
        zeroTo: [100, 13],
        brakeG: 0.85,
        cornerG: 1.1,
        tractionG: 0.5,
        turn: 1.6,
        hp: 240,
        color: '#eceeed',
        palette: ['#eceeed', '#eceeed', '#b9bdc1', '#7a7f85', '#16181b', '#1f3455', '#c7b89b', '#8e1c1f'],
      },
      sport: {
        balance: 0.2,
        mass: 1.1,
        name: 'COMET GT',
        // A sports coupe.
        l: 4.5 * UNITS_PER_METRE,
        w: 2.13 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 290,
        zeroTo: [100, 3.8],
        brakeG: 1.15,
        cornerG: 1.65,
        tractionG: 0.95,
        turn: 2.8,
        hp: 110,
        color: '#0f7fa0',
        palette: PAINT_SPORT,
      },
      sedan: {
        mass: 1.45,
        name: 'REGENT',
        // A mid-size sedan, 1.85 m body, 1.47 m tall.
        l: 4.85 * UNITS_PER_METRE,
        w: 2.13 * UNITS_PER_METRE,
        // Built at real size (cars3d.js / motorbikes3d.js).
        modelScale: 1,
        topKmh: 180,
        zeroTo: [100, 9.0],
        brakeG: 1.0,
        cornerG: 1.3,
        tractionG: 0.6,
        turn: 2.15,
        hp: 150,
        color: '#b9bdc1',
        palette: PAINT_EVERYDAY,
      },
      /* FLAGSHIPS (cars3d.js, motorbikes3d.js): rare in traffic, parked at the
         upscale addresses (populate, SHOWCASE PARKING). Performance measured with
         DeadEndCity.simulate (docs/CHANGELOG.md). */
      chevette: {
        // A mid-engined, flat-plane V8 supercar after the C8 Corvette Z06:
        // 4.69 m, 2.02 m body, 1.23 m tall, 1.56 t.
        balance: 0.25,
        mass: 1.56,
        name: 'CHEVETTE Z06',
        l: 4.69 * UNITS_PER_METRE,
        w: 2.32 * UNITS_PER_METRE,
        topKmh: 315,
        zeroTo: [100, 2.7],
        brakeG: 1.25,
        cornerG: 1.8,
        tractionG: 1.18,
        turn: 2.55,
        hp: 140,
        grip: 9.5,
        flagship: true,
        color: '#e9b82a',
        palette: ['#e9b82a', '#b3121b', '#eceeed', '#1a1c20', '#2b5fd9', '#f06a12', '#8f9aa3'],
      },
      brutini: {
        // A V12 wedge hypercar after the Aventador SVJ: 4.94 m, 2.1 m body,
        // 1.14 m tall, 1.53 t, all-wheel drive.
        balance: 0.1,
        mass: 1.53,
        name: 'BRUTINI SVJ',
        l: 4.94 * UNITS_PER_METRE,
        w: 2.41 * UNITS_PER_METRE,
        topKmh: 350,
        zeroTo: [100, 2.8],
        brakeG: 1.3,
        cornerG: 1.85,
        tractionG: 1.15,
        turn: 2.4,
        hp: 145,
        grip: 10,
        flagship: true,
        color: '#7ac231',
        palette: ['#7ac231', '#f58a07', '#e9c21e', '#15171a', '#eceeed', '#6b2d8c', '#8f9aa3'],
      },
      cavalino: {
        // A mid-engined V8 berlinetta after the 458 Italia: 4.53 m, 1.94 m body,
        // 1.21 m tall, 1.48 t; nearly always red.
        balance: 0.3,
        mass: 1.48,
        name: 'CAVALINO 458',
        l: 4.53 * UNITS_PER_METRE,
        w: 2.23 * UNITS_PER_METRE,
        topKmh: 325,
        zeroTo: [100, 3.0],
        brakeG: 1.25,
        cornerG: 1.8,
        tractionG: 1.08,
        turn: 2.6,
        hp: 135,
        grip: 9.5,
        flagship: true,
        color: '#c8141c',
        palette: ['#c8141c', '#c8141c', '#c8141c', '#c8141c', '#e9c21e', '#16181b', '#eceeed', '#1f3d8a'],
      },
      dolcati: {
        // A V4 superbike after the Panigale V4: 2.11 m, bars 0.81 m, 198 kg
        // wet plus its rider.
        name: 'DOLCATI V4',
        l: 2.11 * UNITS_PER_METRE,
        w: 0.82 * UNITS_PER_METRE,
        topKmh: 300,
        zeroTo: [100, 2.9],
        brakeG: 1.1,
        cornerG: 1.45,
        tractionG: 1.0,
        turn: 3.15,
        hp: 85,
        mass: 0.28,
        grip: 9.5,
        bike: true,
        flagship: true,
        color: '#c8102e',
        palette: ['#c8102e'],
      },
      yamasaki: {
        // A crossplane litre superbike after the R1 / ZX-10RR: 2.07 m, bars
        // 0.75 m; racing blue or lime green.
        name: 'YAMASAKI 1000RR',
        l: 2.07 * UNITS_PER_METRE,
        w: 0.78 * UNITS_PER_METRE,
        topKmh: 295,
        zeroTo: [100, 3.0],
        brakeG: 1.1,
        cornerG: 1.45,
        tractionG: 0.98,
        turn: 3.15,
        hp: 85,
        mass: 0.28,
        grip: 9.5,
        bike: true,
        flagship: true,
        color: '#1f4fbf',
        palette: ['#1f4fbf', '#5bbd2b', '#1f4fbf', '#5bbd2b', '#16181b'],
      },
      kr500: {
        // A 500 cc enduro after the KTM 500 EXC: 2.2 m, bars 0.82 m, 111 kg
        // plus its rider. Knobbly tyres (offroad.js OFFROAD_TYRES `knobby`):
        // sure-footed on dirt, mud, grass and the mountain trails, long travel
        // for rough ground at speed, little drag off the tarmac (`dirt`), vague
        // on tarmac at speed (physics.js tyreSurfaceGrip); light and quick to
        // turn; it lifts the front wheel under full throttle (motorbikes3d.js).
        balance: 0.35,
        name: 'KR 500',
        l: 2.2 * UNITS_PER_METRE,
        w: 0.82 * UNITS_PER_METRE,
        topKmh: 150,
        zeroTo: [100, 4.4],
        brakeG: 0.85,
        cornerG: 1.05,
        tractionG: 0.82,
        turn: 3.6,
        hp: 70,
        mass: 0.19,
        grip: 7.5,
        bike: true,
        offroad: true,
        dirt: true,
        tyre: 'knobby',
        travel: 1.7,
        color: '#ff6a00',
        palette: ['#ff6a00'],
      },
      jetski: {
        name: 'RIPTIDE JET SKI',
        // A sit-down jet ski.
        l: 3.3 * UNITS_PER_METRE,
        w: 1.25 * UNITS_PER_METRE,
        modelScale: 0.9,
        max: 50 * KNOTS,
        acc: 0.55 * GRAVITY,
        turn: 2.5,
        hp: 110,
        mass: 0.45,
        boat: true,
        jetski: true,
        color: '#e9ad4b',
      },
      helicopter: {
        name: 'MAVERICK HELICOPTER',
        // An H125 / Bell 407 class light single: 10.75 m over the rotor, 4.25 m
        // across the skids and stabiliser. helicopter3d.js builds every look at
        // real size (the UH-60 class military one fitted to this footprint).
        l: 86,
        w: 34,
        modelScale: 1,
        // Cruise flat out at about 240 km/h (helicopterControl).
        max: 250 * KMH,
        acc: 0.5 * GRAVITY,
        turn: 1.6,
        hp: 220,
        mass: 2.2,
        color: '#344b59',
      },
      police: {
        mass: 1.6,
        name: 'PATROL UNIT',
        // A pursuit sedan or utility.
        l: 5.1 * UNITS_PER_METRE,
        w: 2.18 * UNITS_PER_METRE,
        modelScale: 0.8,
        topKmh: 230,
        zeroTo: [100, 6.3],
        brakeG: 1.1,
        cornerG: 1.45,
        tractionG: 0.75,
        turn: 2.5,
        hp: 180,
        color: '#e0dfc7',
      },
    };
    /**
     * ROAD PERFORMANCE
     * Road vehicles are specified in real units: `mass` (tonnes), `topKmh`,
     * `zeroTo` ([km/h, seconds], usually 0-100), `brakeG`, `cornerG` (the
     * sideways grip the steering may use, in g), `tractionG` (what the driven
     * wheels can push off the line) and `balance` (-1..1, how the class behaves
     * at the limit: negative pushes wide, positive steps the tail out; physics.js
     * FRICTION CIRCLE AND BALANCE). roadPerformance() turns those into the map-unit fields the
     * physics reads: `max` (u/s), `acc` (u/s², off the line), `brake` (u/s²) and
     * `power`, found by bisection so the car really does the stated 0-100 time
     * through engineAcceleration(). The engine pulls at the tyres' limit until
     * its power takes over (power / speed), and air and rolling resistance
     * (growing with the square of the speed) meet it at the top speed.
     */
    // Air and rolling resistance at `v`: it would balance the engine at 15% past
    // the top speed, so the car still pulls when it reaches `max`, where the
    // physics caps it (a governed top speed rather than an endless crawl up to it).
    function airResistance(spec, v) {
      if (!spec.power) return 0;
      const balance = spec.max * 1.15;
      return Math.min(spec.acc, spec.power / balance) * (v / balance) * (v / balance);
    }
    function engineAcceleration(spec, along) {
      if (!spec.power) return spec.acc || 0;
      const v = Math.max(0, along);
      return Math.min(spec.acc, spec.power / Math.max(v, 1)) - airResistance(spec, v);
    }
    // Resistance a rolling vehicle feels with no throttle: air, tyres and the
    // engine holding it back in gear (about 1 m/s² at town speeds).
    function coastDeceleration(spec, speed) {
      const v = Math.abs(speed);
      return airResistance(spec, v) + (spec.bicycle ? 0.025 : 0.1) * GRAVITY * Math.min(1, v / (15 * KMH));
    }
    function roadPerformance(spec) {
      if (!spec.topKmh || spec.power) return spec;
      spec.max = spec.topKmh * KMH;
      spec.acc = (spec.tractionG || 0.6) * GRAVITY;
      spec.brake = (spec.brakeG || 1) * GRAVITY;
      const [targetKmh, seconds] = spec.zeroTo || [100, 10],
        target = targetKmh * KMH,
        timeTo = (power) => {
          spec.power = power;
          let v = 0,
            t = 0;
          while (v < target && t < 120) {
            v = Math.min(spec.max, v + engineAcceleration(spec, v) * 0.01);
            t += 0.01;
          }
          return t;
        };
      let low = 1,
        high = 4e6;
      for (let i = 0; i < 60; i++) {
        const mid = Math.sqrt(low * high);
        if (timeTo(mid) > seconds) low = mid;
        else high = mid;
      }
      spec.power = high;
      return spec;
    }
    Object.values(VEHICLE_DEFINITIONS).forEach(roadPerformance);
    // A plane's spec is the base plane with its airframe's numbers on top. The
    // merged record is made once per airframe: this is asked many times per car
    // per physics step, and a fresh copy each time was a steady stream of garbage.
    // A helicopter's airframe (Fort Sentinel's Apache, apache.js HELICOPTER_AIRFRAMES)
    // is merged over the helicopter the same way.
    const airframeSpecCache = new Map();
    function vehicleSpec(vehicle) {
      if (vehicle?.airframe && (vehicle.type === 'plane' || vehicle.type === 'helicopter')) {
        const key = vehicle.type + ':' + vehicle.airframe;
        let spec = airframeSpecCache.get(key);
        if (!spec) {
          spec = {
            ...VEHICLE_DEFINITIONS[vehicle.type],
            ...(vehicle.type === 'plane' ? AIRFRAME_SPECS : HELICOPTER_AIRFRAMES)[vehicle.airframe],
          };
          airframeSpecCache.set(key, spec);
        }
        return spec;
      }
      return VEHICLE_DEFINITIONS[vehicle?.type];
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
      freshToast();
      toastTime = duration;
    }
    function announce(small, big, t = 3) {
      getElement('announceSmall').textContent = small;
      getElement('announceBig').textContent = big;
      getElement('announcement').classList.add('show');
      freshAnnouncement();
      announceTime = t;
    }
    // @include src/heat.js
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
    /**
     * RECTANGLE LISTS
     * Many of solid()'s tests are "is this point (grown by r) inside any of these
     * map rectangles": the harbor, marina, garages, airport scenery. The lists are
     * fixed, so each one's overall bounds are worked out once (keyed by the list)
     * and a point outside them answers at once, without walking the list.
     */
    const rectListBounds = new WeakMap();
    function rectListBlocked(list, x, y, r = 0) {
      let bounds = rectListBounds.get(list);
      if (!bounds || bounds.count !== list.length) {
        bounds = { count: list.length, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        for (const b of list) {
          bounds.x0 = Math.min(bounds.x0, b.x);
          bounds.y0 = Math.min(bounds.y0, b.y);
          bounds.x1 = Math.max(bounds.x1, b.x + b.w);
          bounds.y1 = Math.max(bounds.y1, b.y + b.h);
        }
        rectListBounds.set(list, bounds);
      }
      if (x + r <= bounds.x0 || x - r >= bounds.x1 || y + r <= bounds.y0 || y - r >= bounds.y1) return false;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      return false;
    }
    // Whether a point lies inside a rectangle list's overall bounds.
    function rectListNear(list, x, y) {
      let bounds = rectListBounds.get(list);
      if (!bounds || bounds.count !== list.length) {
        rectListBlocked(list, x, y, 0);
        bounds = rectListBounds.get(list);
      }
      return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
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
        monarchBlocked(x, y, r) ||
        marinaBlocked(x, y, r) ||
        beachBlocked(x, y, r) ||
        promenadeRailBlocked(x, y, r) ||
        streetEndBlocked(x, y, r) ||
        beachClubBlocked(x, y, r) ||
        (!overWater && !groundAt(x, y, r)) ||
        (overWater && LINERS.some((ship) => linerHullAt(ship, x, y, r))) ||
        harborBlocked(x, y, r) ||
        depotBlocked(x, y, r) ||
        ((x > CITY_SIZE || y > CITY_SIZE) && (countyBlocked(x, y, r) || militaryBlocked(x, y, r)))
      )
        return true;
      if (r <= 8 || !buildingGrid.size) {
        const candidates = r > 8 ? buildings : buildingsNear(x, y);
        for (const b of candidates)
          if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
        return false;
      }
      // Larger radii can straddle a cell edge: test every grid cell the box
      // touches (pursuit whiskers and spawn checks call this many times a frame;
      // it used to scan the whole city).
      const x0 = Math.floor((x - r - 8) / BUILDING_CELL),
        x1 = Math.floor((x + r + 8) / BUILDING_CELL),
        y0 = Math.floor((y - r - 8) / BUILDING_CELL),
        y1 = Math.floor((y + r + 8) / BUILDING_CELL);
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++) {
          const cell = buildingGrid.get(i * 4096 + j);
          if (cell)
            for (const b of cell)
              if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
        }
      return false;
    }
    /**
     * VEHICLE GRID
     * Every walking person asks, for each short step, whether a vehicle is in
     * the way; that used to test every vehicle in the city (~200) per step. The
     * vehicles are bucketed into 128-unit cells once per simulation frame (and
     * again whenever vehicles are added or removed) and a step only asks the
     * cells around it, with a margin for a car that moves later in the frame.
     */
    const VEHICLE_CELL = 128,
      vehicleGrid = new Map(),
      vehicleGridState = { time: NaN, count: -1, stamp: 0 };
    function refreshVehicleGrid() {
      if (vehicleGridState.time === gameTime && vehicleGridState.count === vehicles.length) return;
      vehicleGridState.time = gameTime;
      vehicleGridState.count = vehicles.length;
      // Cells are reset lazily (stale stamp = empty), never swept.
      const stamp = ++vehicleGridState.stamp;
      if (vehicleGrid.size > 4000) vehicleGrid.clear();
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i],
          key = Math.floor(c.x / VEHICLE_CELL) * 4096 + Math.floor(c.y / VEHICLE_CELL);
        let cell = vehicleGrid.get(key);
        if (!cell) vehicleGrid.set(key, (cell = []));
        if (cell.stamp !== stamp) {
          cell.stamp = stamp;
          cell.length = 0;
        }
        cell.push(c);
      }
    }
    // Whether a vehicle blocks a foot step to (x, y); `reach` bounds the test.
    function footStepVehicleBlocked(x, y, collisionRadius, reach) {
      refreshVehicleGrid();
      const span = reach + 64,
        i0 = Math.floor((x - span) / VEHICLE_CELL),
        i1 = Math.floor((x + span) / VEHICLE_CELL),
        j0 = Math.floor((y - span) / VEHICLE_CELL),
        j1 = Math.floor((y + span) / VEHICLE_CELL);
      for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++) {
          const cell = vehicleGrid.get(i * 4096 + j);
          if (!cell || cell.stamp !== vehicleGridState.stamp) continue;
          for (let k = 0; k < cell.length; k++) {
            const c = cell[k];
            if (c.x - x > reach || x - c.x > reach || c.y - y > reach || y - c.y > reach) continue;
            if ((!isAircraft(c) || aircraftClearance(c) < 20) && pointInCar(x, y, c, collisionRadius)) return true;
          }
        }
      return false;
    }
    function footStepBlocked(body, x, y, collisionRadius, swimmer, onFoot, reach) {
      if (solid(x, y, collisionRadius, swimmer)) return true;
      // Where the player may cross the shoreline (beaches, ladders): water.js.
      if (swimmer && shoreStepBlocked(body.x, body.y, x, y, collisionRadius)) return true;
      if (body.police && harborPoliceProtected(x, y, collisionRadius)) return true;
      // Mission 1: nobody follows the truck into Vinny's sealed warehouse (chase.js).
      if (body.police && depotPoliceBlocked(body, x, y)) return true;
      // Street furniture, tree trunks, park fixtures and shelters stop the
      // player on foot (streets.js); the crowd keeps to its own paths round them.
      if (onFoot && footObstacleBlocked(x, y, 4.5)) return true;
      // Behind the drawbridge's sidewalk arms, and never onto a raised span.
      if (drawbridgeFootBlocked(body, x, y, collisionRadius)) return true;
      return footStepVehicleBlocked(x, y, collisionRadius, reach);
    }
    function moveBody(body, displacementX, displacementY, collisionRadius) {
      if (body === player && player.roof)
        return moveOnRoof(displacementX, displacementY, collisionRadius);
      if (body === player && player.deck)
        return moveOnDeck(displacementX, displacementY, collisionRadius);
      if (body === player && player.buildingRoof)
        return moveOnBuildingRoof(displacementX, displacementY, collisionRadius);
      // In the Marea pool: held inside the water (clubpool.js).
      if (body === player && player.pool) return movePoolSwimmer(displacementX, displacementY);
      let hit = false;
      // Vehicle test: a cheap bounding box rejects almost every vehicle before the
      // rotated point-in-car test (this runs for every pedestrian step each frame).
      // On foot the player may leave the shore: the water is somewhere to be, not
      // a wall. Everyone else is still stopped by it.
      const swimmer =
          body === player && !player.car && !player.roof && !player.deck && !player.parachute,
        reach = 90 + collisionRadius,
        // Out of a car or off a teleport onto a bench, step off it rather than stick.
        onFoot = swimmer && !player.swimming && !footObstacleBlocked(body.x, body.y, 4.5);
      // A long step (a sprint over a slow frame, a car's knock-back of 25 units)
      // is taken in short ones, so it cannot hop over a railing or a guardrail
      // thinner than the step.
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(displacementX), Math.abs(displacementY)) / 5)),
        stepX = displacementX / steps,
        stepY = displacementY / steps;
      for (let i = 0; i < steps; i++) {
        if (!footStepBlocked(body, body.x + stepX, body.y, collisionRadius, swimmer, onFoot, reach)) body.x += stepX;
        else hit = true;
        if (!footStepBlocked(body, body.x, body.y + stepY, collisionRadius, swimmer, onFoot, reach)) body.y += stepY;
        else hit = true;
      }
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
          // Fields the physics step writes on every vehicle, declared up front in
          // one order so every vehicle shares one object layout (V8 keeps property
          // access fast and doubles unboxed). Each starts at the value its readers
          // already treat as "not set yet": vx/vy are NaN until the first step
          // derives them from the heading and speed (physicsStep).
          vx: NaN,
          vy: NaN,
          stepStartX: x,
          stepStartY: y,
          stepStartA: headingRadians,
          moveA: headingRadians,
          restSteps: 0,
          farFromPlayer: false,
          resting: false,
          contactPass: 0,
          impactSpeed: 0,
          broadCellX: 0,
          broadCellY: 0,
          contactStatics: null,
          stepStatics: null,
          contactBox: null,
          aiControl: null,
          aiControlAt: 0,
          personSweepStart: null,
          bloodTrackPoint: null,
          pedestrianContacts: null,
          spareContacts: null,
          poseX: NaN,
          poseY: NaN,
          poseA: NaN,
          groundHeight: 0,
          slopePitch: 0,
          slopeRoll: 0,
          offroadState: null,
          // Off-road (offroad.js): the reused terrain record, how far the driven
          // wheels spin ahead of the ground (0..1 and in u/s), the mud and rock
          // under them, low range, the last rock ledge, the mud on the body (and
          // how wet it is), the 4x4 club slot it was parked in.
          terrainRecord: null,
          wheelSpin: 0,
          spinSpeed: 0,
          surfaceMud: 0,
          surfaceRock: 0,
          lowRange: false,
          ledge: -1,
          mudCoat: 0,
          mudWet: 0,
          clubSlot: -1,
          loadSpeed: null,
          loadPitch: 0,
          loadRoll: 0,
          junction: null,
          hazard: false,
          spinUntil: 0,
          // The player's front tyres held against the grip limit (seconds) and the
          // scrub that follows (0..1), and whether the driver is steering into a
          // slide (physics.js UNDERSTEER SKID, TYRE STIFFNESS).
          skidHold: 0,
          skid: 0,
          counterSteer: false,
          handbrakeTurn: false,
          // The velocity going into the last contact (resolveContact): a thrown
          // rider keeps it (riders.js). A two-wheeler down on its side (riders.js).
          impactVx: 0,
          impactVy: 0,
          fallen: null,
          // A driver's car more than 15 degrees off its way (physics.js driverStats).
          sliding: false,
          // Road or pavement under the middle last step (kerbStrike), and the
          // vehicle that last hit a braced roadblock cruiser (roadblocks.js).
          onTarmac: null,
          rammedBy: null,
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
    // This bitmap is only drawn by the 2D fallback renderer. When WebGL 2 and
    // three.js are there the 3D renderer paints its own sheet, so this one is
    // painted at a quarter of the resolution (a sixteenth of the pixels): it
    // still serves if the 3D renderer fails, and it no longer costs seconds of
    // canvas rasterisation at start-up.
    const GROUND_PIXELS_PER_UNIT =
      (typeof THREE !== 'undefined' && typeof WebGL2RenderingContext !== 'undefined' ? 768 : 3072) / CITY_SIZE;
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
            // The financial cluster is planned block by block (src/skyline.js).
            const skylineBlock = zone.includes('FINANCIAL') && skylineBlockTowers(bx, by).length > 0;
            if (skylineBlock) {
              buildSkylineBlock(bx, by, x, y, w, h);
            } else if (zone.includes('FINANCIAL') && blockSeed % 2 === 0) {
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
            if (perimeterBlock || skylineBlock) {
              // Closed on all four sides above, or a planned plaza; nothing more to add.
            } else if (zone === 'SOUTH BANK' && blockSeed % 3 === 0) {
              // Residential slab with a courtyard instead of a parking court.
              makeBuilding(x + 7, y + 179, w - 15, 60, 1);
              rect(x + 40, y + 250, w - 80, 70, '#6f8a5c');
              for (let k = 0; k < 4; k++) drawTree(x + 60 + k * 70, y + 285, 13);
            } else makeBuilding(x + 7, y + 179, seededRandom() > 0.6 ? w - 15 : 155, 143, 1);
            if (!perimeterBlock && !skylineBlock && buildings[buildings.length - 1].w < 200) {
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
      // Street names are not painted along the carriageway (HARBOR AVENUE and
      // SUNSET BOULEVARD used to be); the HUD names the street underfoot.
      paintParks(groundContext);
      seedParkTrees();
      buildHarbor();
      buildVinnyDepot();
      buildSunsetPier();
      buildCounty();
      // Plan heights to real storeys (realBuildingHeight). Fort Sentinel's buildings
      // (base3d.js), Vinny's depot walls and the Blue Hour (ROOFTOP) are given in
      // real units already.
      for (const b of buildings) if (!b.military && !b.depotWall && !b.roofBar && !b.monarch) b.height = realBuildingHeight(b.height);
      // Monarch Isle is planned in real storeys from the start (monarch.js).
      buildMonarchIsle();
      // A business's own record (civic3d.js dresses its roof from it) follows its building.
      for (const place of PLACES) {
        const b = place.kind !== 'rooftop' && buildings.find((o) => o.place === place.id);
        if (b) place.height = b.height;
      }
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
        // ... nor in the sea (the kerb pattern ran past the south-west sea wall).
        if (cityStreetAt(t.x, t.y, 2) || onServiceRoad(t.x, t.y) || railBlocked(t.x, t.y, 6) || !groundAt(t.x, t.y, 3)) trees.splice(i, 1);
      }
      // Lamp posts likewise (the head overhangs 6 units towards +x). Where a block's
      // kerb lamp lands on the next block's kerb tree the post stood inside the
      // trunk; the tree keeps the spot (both are knockable props, damage.js).
      for (let i = lamps.length - 1; i >= 0; i--) {
        const l = lamps[i];
        if (
          cityStreetAt(l.x, l.y, 2) ||
          onServiceRoad(l.x, l.y) ||
          railBlocked(l.x, l.y, 6) ||
          trees.some((t) => Math.abs(t.x - l.x) < 6 && Math.abs(t.y - l.y) < 6)
        )
          lamps.splice(i, 1);
      }
    }
    /* SHOWCASE PARKING: the flagships (cars3d.js, motorbikes3d.js) where the money
       parks, and the KR 500 where the dirt starts. Stealing one is like stealing
       any parked car. */
    const SHOWCASE_PARKING = [
      // North Point, the financial district: mid-block on the avenue under the towers.
      { place: 'NORTH POINT', x: 2688, y: -2780, a: -Math.PI / 2, dir: Math.PI / 2, gap: 52, kerb: Math.PI, types: ['brutini', 'chevette', 'cavalino'] },
      // The marina: down the street from the quay, by the yachts.
      { place: 'MARINA', x: 1150, y: -3180, a: Math.PI / 2, dir: Math.PI / 2, gap: 52, kerb: Math.PI, types: ['cavalino', 'yamasaki', 'chevette'] },
      // Marea Beach Club: the valet line past the taxi rank.
      { place: 'MAREA VALET', x: -2756, y: 5272, a: 0, dir: 0, gap: 52, kerb: Math.PI / 2, types: ['brutini', 'dolcati'] },
      // Sunset Pier: nose-in in the VIP bays at the east end of the car park.
      { place: 'SUNSET PIER VIP', x: 3676, y: -5806, a: -Math.PI / 2, dir: 0, gap: 27, types: ['chevette', 'brutini', 'cavalino'] },
      // Monarch Isle: outside the villa gates on Ocean Crescent, and on Marina Drive.
      { place: 'MONARCH ISLE VILLAS', x: 6800, y: -4544, a: 0, dir: 0, gap: 54, kerb: -Math.PI / 2, types: ['cavalino', 'brutini'] },
      { place: 'MONARCH ISLE MARINA', x: 8400, y: -1344, a: Math.PI, dir: 0, gap: 54, kerb: Math.PI / 2, types: ['chevette', 'dolcati'] },
      // The Ridgeline trailheads and a county lodge: dirt bikes.
      { place: 'MOUNT ASCENT TRAILHEAD', x: 7470, y: 2010, a: -Math.PI / 2, dir: 0, gap: 16, types: ['kr500', 'kr500'] },
      { place: 'NEEDLE RIDGE TRAILHEAD', x: 9460, y: 2900, a: -Math.PI / 2, dir: 0, gap: 16, types: ['kr500'] },
      { place: 'STONECREEK LODGE', x: 6990, y: 3236, a: 0, dir: 0, gap: 16, types: ['kr500'] },
    ];
    /* Each spot's vehicles line up from (x, y) along `dir`, `gap` apart, facing
       `a`; on a street (`kerb`: the direction of its edge) each slides over to
       the kerb, staying wholly on the tarmac. A vehicle that cannot fit near its
       place is left out. */
    function parkShowcase() {
      const parked = [];
      for (const spot of SHOWCASE_PARKING)
        spot.types.forEach((type, i) => {
          const half = VEHICLE_DEFINITIONS[type].w / 2 + 4;
          let x = spot.x + Math.cos(spot.dir) * i * spot.gap,
            y = spot.y + Math.sin(spot.dir) * i * spot.gap;
          if (spot.kerb !== undefined && cityStreetAt(x, y, -half))
            for (let d = 3; d < 160; d += 3) {
              const px = x + Math.cos(spot.kerb) * 3,
                py = y + Math.sin(spot.kerb) * 3;
              if (!cityStreetAt(px, py, -half)) break;
              x = px;
              y = py;
            }
          for (let r = 0; r < 60; r += 6)
            for (let k = 0; k < (r ? 12 : 1); k++) {
              const px = x + Math.cos((k * TAU) / 12) * r,
                py = y + Math.sin((k * TAU) / 12) * r;
              if (!canSpawnCar(type, px, py, spot.a, 4)) continue;
              parked.push(makeCar(type, px, py, spot.a, false, vehiclePaint(type)));
              return;
            }
        });
      return parked;
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
      parkShowcase();
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
          // One car in forty is a flagship (cars3d.js, motorbikes3d.js).
          type = seededRandom() < 0.025 ? randomChoice(FLAGSHIP_TYPES) : randomChoice([
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
          vehiclePaint(type),
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
        makeCar(type, x, y, a, false, vehiclePaint(type));
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
        ...sportsTargets(),
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
      player.thrown = null;
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
      announce('THE CITY ALWAYS COLLECTS', 'WASTED', 4.6);
      document.body?.classList.add('wasted');
      noise(0.3, 0.4);
      setTimeout(() => {
        document.body?.classList.remove('wasted');
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
      }, 4200);
    }
    /* The ringing payphone's reach, shared by its prompt and E (hysteresis). */
    function payphoneInReach() {
      return withinRange('payphone', distanceBetween(player, phone), 68, 84);
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
      tell('On foot · ' + keyName('fire') + ' to fire · hold ' + keyName('walk') + ' to walk', 1.8);
      tone(160, 0.06, 0.15, 'triangle');
    }
    function interact() {
      if (gameMode !== 'play' || player.parachute || player.thrown || rideSkipActive()) return;
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
      if (beachClubInteract()) return;
      // The Marea pool, club conversations and beach volleyball (leisure.js).
      if (leisureInteract()) return;
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
      // The hill climb at the 4x4 club's sign, from a vehicle (offroad.js).
      if (offroadClubInteract()) return;
      if (player.car) {
        if (garageInteract()) return;
        // Riding a share bike into a station docks it (cycles.js BIKE SHARE).
        if (bikeShareInteract()) return;
        exitCar();
        return;
      }
      // On the stadium pitch E kicks the ball at your feet (sports.js).
      if (sportsInteract()) return;
      // A Monarch Isle payphone (monarch-life.js).
      if (monarchInteract()) return;
      const place = nearestPlace();
      if (place) {
        openService(place);
        return;
      }
      if (payphoneInReach() && !mission && storyCallWaiting()) {
        offerMission();
        return;
      }
      // RENT BIKE at a South Coast Cycle station (cycles.js BIKE SHARE).
      if (bikeShareInteract()) return;
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
        tell('Drive up to the door and press E: respray from $200, repairs by the damage.');
    }
    /* Taking the wheel: shared by the action key, the cab hijack and the getaway
       cars missions hand you, so every entry sets the same state. */
    function enterVehicle(c) {
        player.buildingRoof = null;
        player.car = c;
        // A bike that went down is picked up and ridden on (riders.js).
        c.fallen = null;
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
          tell(
            'AIRPLANE · ' + keyName('forward') + '/' + keyName('back') + ' throttle · ' + keyName('left') + '/' + keyName('right') +
              ' bank · ' + keyName('ascend') + ' nose up · ' + keyName('descend') + ' nose down',
            8,
          );
        } else if (c.type === 'helicopter') {
          if (!c.authorized) crime(2);
          tell(
            'HELICOPTER · ' + keyName('ascend') + ' rise · ' + keyName('descend') + ' descend · ' + keyName('forward') + '/' +
              keyName('back') + ' fly · ' + keyName('left') + '/' + keyName('right') + ' turn',
            7,
          );
          radio('call-backup');
          // Fort Sentinel's attack helicopter: theft of military hardware (apache.js).
          if (isApache(c)) apacheBoarded(c);
        } else if (c.type === 'tank') {
          // Taking one of Fort Sentinel's tanks raises the base; a pursuit tank
          // taken off the army is a crime of its own.
          if (c.military) militaryAlarm();
          else if (c.lawUnit) crime(2);
          tell(
            'TRACKED ARMOR · ' + keyName('forward') + '/' + keyName('back') + ' drive · ' + keyName('left') + '/' + keyName('right') +
              ' pivot · the mouse lays the turret · ' + keyName('fire') + ' fire · ' + keyName('cycleWeapon') + ' main gun / MG · right click MG',
            7,
          );
        } else if (isBoat(c))
          tell(
            keyName('forward') + '/' + keyName('back') + ' throttle · ' + keyName('left') + '/' + keyName('right') + ' steer · ' +
              keyName('handbrake') + ' slow · ' + keyName('interact') + ' exit alongside a dock',
            5,
          );
        else if (c.type === 'bicycle')
          tell(
            'CITY CYCLE · HOLD ' + keyName('forward') + ' to pedal · ' + keyName('sprint') + ' stand on the pedals · ' +
              keyName('back') + ' brake',
            6,
          );
        else
          tell(
            vehicleSpec(c).name + ' · ' + keyName('forward') + ' accelerate · ' + keyName('left') + '/' + keyName('right') +
              ' steer · ' + keyName('handbrake') + ' handbrake',
            3,
          );
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
      if (gameMode === 'play' && isApache(player.car)) {
        // The Apache's chin gun, laid by the mouse (apache.js).
        if (player.car.hp > 0) apacheGun(player.car);
        return;
      }
      if (gameMode === 'play' && player.car?.type === 'tank') {
        // The gun fires where the turret is laid, not where the mouse is (armor.js).
        tankPlayerFire(player.car);
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
      // Empty-handed at the wheel: fire draws the pistol.
      if (player.car && player.car.type !== 'tank' && selectedWeaponIndex === FISTS_INDEX && weapons[0]?.owned) selectWeapon(0);
      if (player.car && player.car.type !== 'tank' && selectedWeaponIndex !== 0) {
        tell('Carry the 9mm pistol to fire from a vehicle.');
        shotCooldownSeconds = 0.5;
        return;
      }
      const w = currentWeapon();
      if (w.melee) {
        meleeAttack();
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
          headshotTarget: selectedWeaponIndex === 5 && shotTarget && !shotTarget.type ? shotTarget : null,
        });
      }
      particle(ox, oy, '#f4d990', 5, 70, 4);
      weaponSound(selectedWeaponIndex, ox, oy);
      if (city3D) city3D.fire(ox, oy, a, w.rocket, entityElevation(player));
      player.recoilUntil = gameTime + 0.12;
      player.lastShotAt = gameTime;
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
      player.thrown = null;
      cleanupMissionExtras();
      clearDepotFloor();
      cancelGarageJob();
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
    function copRoute(c, destination = null) {
      // An interceptor routes to where the runner will be, not to where they are:
      // half the patrol chases, the other half tries to be there first. A search
      // passes its own destination (pursuit.js).
      const quarry = c.pursuitTarget || player.car || player,
        chaseTarget =
          destination || (c.interceptor ? aheadOf(quarry, 3.4) : c.pursuitTarget || player);
      if (offCityStreets(c.x, c.y) || offCityStreets(chaseTarget.x, chaseTarget.y)) return policeNavRoute(c, chaseTarget);
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
      if (offCityStreets(player.x, player.y)) {
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
        if (updateIsleWalker(p, deltaSeconds)) continue;
        if (updateCarjackReactions(p, deltaSeconds)) continue;
        if (updateClubGoer(p, deltaSeconds)) continue;
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
    const shotSolidLists = [null, null, null, null, null, null, null];
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
      // Called for every 7-unit sub-step of every round in flight: the lists are
      // walked in place (they used to be spread into one new array per call).
      const lists = shotSolidLists;
      lists[0] = garageWalls();
      lists[1] = harborSolids();
      lists[2] = depotSolids();
      lists[3] = militarySolids();
      lists[4] = countyStaticSolids;
      lists[5] = AIRPORT_SCENERY_SOLIDS;
      lists[6] = garageDoorSolids();
      for (let i = 0; i < lists.length; i++) {
        const list = lists[i];
        // Most rounds are nowhere near a given list's rectangles (rectListBounds).
        if (!rectListNear(list, x, y)) continue;
        for (let k = 0; k < list.length; k++) {
          const b = list[k];
          if (altitude + 10 < b.height && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
        }
      }
      const near = buildingsNear(x, y);
      for (let i = 0; i < near.length; i++) {
        const b = near[i];
        if (altitude + 10 < b.height && x > b.x - 1 && x < b.x + b.w + 1 && y > b.y - 1 && y < b.y + b.h + 1)
          return true;
      }
      return false;
    }
    // Who a bullet can hit where it is now, in the order hits are tested. The
    // short lists go in whole; pedestrians come from the crowd's neighbour grid
    // around the bullet. Every sub-step of every bullet used to copy all ~650
    // pedestrians (plus everyone else) into a fresh array.
    const bulletTargetList = [],
      bulletVehicleList = [];
    function addBulletTargets(list, people) {
      for (let k = 0; k < people.length; k++) list.push(people[k]);
    }
    function pushBulletTarget(p) {
      bulletTargetList.push(p);
    }
    function bulletTargets(b, escorts, rooftop) {
      const list = bulletTargetList;
      list.length = 0;
      if (b.enemy) {
        if (b.faction === 'police') {
          addBulletTargets(list, enemies);
          addBulletTargets(list, gangMembers);
        } else if (b.faction) {
          addBulletTargets(list, enemies);
          addBulletTargets(list, gangMembers);
          addBulletTargets(list, officers);
          forEachPedestrianNear(b.x, b.y, 16, pushBulletTarget);
          addBulletTargets(list, sportsTargets());
        }
        addBulletTargets(list, escorts);
      } else {
        addBulletTargets(list, enemies);
        addBulletTargets(list, gangMembers);
        forEachPedestrianNear(b.x, b.y, 16, pushBulletTarget);
        addBulletTargets(list, officers);
        addBulletTargets(list, escorts);
        addBulletTargets(list, rooftop);
        // Athletes, officials and stewards at the sports venues (sports.js).
        addBulletTargets(list, sportsTargets());
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
        // Who is shooting at the player (combat-rules.js SHOT LOG).
        if (b.enemy && !b.logged) logHostileShot(b);
        let impact = false,
          hitKind = 'wall';
        const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy, b.vz || 0) * deltaSeconds) / 7));
        // Only vehicles near this frame's flight segment can be hit by it.
        const reach = 70,
          minX = Math.min(b.x, b.x + b.vx * deltaSeconds) - reach,
          maxX = Math.max(b.x, b.x + b.vx * deltaSeconds) + reach,
          minY = Math.min(b.y, b.y + b.vy * deltaSeconds) - reach,
          maxY = Math.max(b.y, b.y + b.vy * deltaSeconds) + reach,
          nearVehicles = bulletVehicleList;
        nearVehicles.length = 0;
        for (const c of vehicles) if (c.x > minX && c.x < maxX && c.y > minY && c.y < maxY) nearVehicles.push(c);
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
          for (const c of nearVehicles) {
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
                (lawVehicle(c) || c.airUnit || (c === player.car && b.target !== player))
              )
            )
              damageVehicle(
                c,
                // The vehicles missions hand you are built for the job (the cargo
                // truck's steel cage, Vinny's armored van): gang small-arms fire
                // does 40% damage to them, or a crew opening up on the loading
                // truck wrecks it before the third crate is aboard. An armoured
                // airframe (the Apache) shrugs off most small-arms fire
                // (combat-rules.js vehicleArmorShare).
                vehicleArmorShare(c, b) *
                  (b.enemy && c.mission && b.faction !== 'police' && !b.rocket
                    ? b.dmg * 0.4
                    : // Police rounds are meant for the driver: they chew a car up
                      // slowly rather than wrecking it in a dozen hits.
                      b.faction === 'police' && c === player.car && !b.rocket
                      ? b.dmg * 0.45
                      : b.dmg),
                b.x,
                b.y,
                b.owner || (!b.enemy ? player : null),
                {
                  kind: 'bullet',
                },
              );
            impact = true;
            // Rounds aimed at the driver come through the glass and the doors: a
            // car is cover, not armour. Heavy vehicles and aircraft keep it out.
            if (
              c === player.car &&
              b.enemy &&
              b.target === player &&
              !b.rocket &&
              !['tank', 'bus', 'truck', 'flatbed'].includes(c.type) &&
              !isAircraft(c) &&
              seededRandom() < 0.55
            ) {
              if (b.damageKind === 'sniper') sniperFireStats.carHits++;
              hurt((b.playerDmg ?? b.dmg) * 0.6, b.damageKind);
              shotLogHit(b);
            }
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
            if (Math.hypot(b.x - p.x, b.y - p.y) >= PERSON_HIT_RADIUS) continue;
            // A precision-rifle round on the target it was aimed at is a headshot:
            // one shot, whatever the vest.
            // A riot shield stops a round from the front: sparks, no wound (swat.js).
            if (shieldBlocks(p, b)) {
              impact = true;
              hitKind = 'metal';
              break;
            }
            const headshot = !b.enemy && b.headshotTarget === p;
            strikePerson(
              p,
              headshot ? 400 : b.dmg,
              Math.atan2(b.vy, b.vx),
              b.owner || (!b.enemy ? player : null),
              true,
              headshot ? 'headshot' : 'ballistic',
            );
            if (!b.enemy) {
              if (p.police) crime(0.3);
              if (p.hp <= 0) cash += enemies.includes(p) ? 100 : 10;
              playerHitConfirm(p, p.hp <= 0);
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
            Math.hypot(b.x - player.x, b.y - player.y) < PERSON_HIT_RADIUS
          ) {
            if (b.damageKind === 'sniper') sniperFireStats.hits++;
            hurt(b.playerDmg ?? b.dmg, b.damageKind);
            shotLogHit(b);
            playerHitFeedback(b);
            impact = true;
            hitKind = 'flesh';
          }
        }
        b.life -= deltaSeconds;
        if (b.rocket && seededRandom() < 0.8) particle(b.x, b.y, '#cbc4a0', 1, 15, 5);
        if (impact || b.life <= 0) {
          // A rocket or shell into a facade goes off against the wall, outside it.
          const face = b.rocket && impact && hitKind === 'wall' ? heavyRoundHitsBuilding(b) : null;
          if (face) {
            b.x = face.x;
            b.y = face.y;
          }
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
          // The Apache's 30 mm rounds burst where they strike (apache.js).
          if (b.heavyRound && impact) apacheRoundImpact(b);
          bullets.splice(i, 1);
        }
      }
    }
    // SIMULATION UPDATE: only active play advances gameplay clocks and state.
    function update(deltaSeconds) {
      const active = gameMode === 'play';
      gameTime += deltaSeconds;
      // A skipped ride's fade (ride-skip.js): runs on this step's time, so a
      // pause holds it; death or the title menu cancels it.
      updateRideSkip(deltaSeconds);
      if (toastTime > 0) {
        toastTime -= deltaSeconds;
        if (toastTime <= 0) getElement('toast').classList.remove('show');
      }
      if (active) timed('knockdowns', () => updateKnockdowns(deltaSeconds));
      if (active || gameMode === 'menu') timed('cars', () => updateCars(deltaSeconds, active));
      if (active) {
        // Play time, cash earned, wanted peak; the demo card's timer (campaign.js).
        trackCampaignStats(deltaSeconds);
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
        // The Meridian Star under way (marina.js), before the player walks her deck.
        timed('liner', () => sailLiner(deltaSeconds));
        // The Palm Sound drawbridge: timetable, gates, leaves and the ketch (drawbridge.js).
        timed('drawbridge', () => updateDrawbridge(deltaSeconds));
        timed('taxi', () => updateTaxiRide(deltaSeconds));
        updateCycling(deltaSeconds);
        // The on-foot figure in the speed box (hud.js SPEED BOX).
        trackPlayerPace(deltaSeconds);
        updateWeather(deltaSeconds);
        updateSwimming(deltaSeconds);
        updateMarinaFooting();
        updateSinking(deltaSeconds);
        timed('beach', () => updateBeach(deltaSeconds));
        timed('beachclub', () => updateBeachClub(deltaSeconds));
        timed('leisure', () => updateLeisure(deltaSeconds));
        timed('coaster', () => updateCoaster(deltaSeconds));
        timed('monarch', () => updateMonarchIsle(deltaSeconds));
        timed('wildlife', () => updateWildlife(deltaSeconds));
        timed('sports', () => updateSports(deltaSeconds));
        if (player.parachute) updateParachute(deltaSeconds);
        else if (
          !player.car &&
          !transitRide &&
          !taxiRide &&
          !player.coaster &&
          // Thrown off a bike: flying, sliding or lying there (riders.js).
          !updateThrownPlayer(deltaSeconds) &&
          !updateMountainFooting(deltaSeconds)
        ) {
          const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
            y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
          if (x || y) {
            player.a = Math.atan2(y, x);
            // On foot the player runs; holding the walk action (Shift) walks.
            let s = player.swimming ? swimSpeed() : footPace();
            if (player.wading) s *= wadeFactor();
            player.walk += deltaSeconds * strideRate(s);
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
          !player.pool &&
          !((player.jumpUntil || 0) > gameTime) &&
          !transitRide &&
          !taxiRide &&
          !player.coaster
        )
          player.altitude = terrainHeight(player.x, player.y);
        // On the volleyball court a click hits the ball instead (beachvolley.js);
        // nothing is fired while thrown off a bike (riders.js).
        if (!volleyTakesFire() && !player.thrown && (keys.KeyF || (!player.car && keys.Space) || mouse.down)) shoot();
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
        // The 4x4 club, body mud and the hill climb (offroad.js).
        timed('offroad', () => updateOffroad(deltaSeconds));
        updatePlayerArmor(deltaSeconds);
        updatePlayerApache(deltaSeconds);
        timed('combat', () => updateCombat(deltaSeconds));
        timed('mission', () => missionUpdate(deltaSeconds));
        timed('waypoint', () => {
          updateWaypoint(deltaSeconds);
          updateGpsRoute(deltaSeconds);
        });
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
      // Look ahead of a moving vehicle: about 0.45 s of travel, up to 300 units.
      const look = player.car ? clamp(player.car.speed * 0.45, -80, 300) : 0,
        // A coaster outruns the usual trailing camera; stay with the train.
        follow = Math.min(1, deltaSeconds * (player.coaster ? 10 : 4.5));
      if (player.car?.type === 'plane') {
        const lead = 1 - Math.exp(-deltaSeconds * 1.4);
        planeCameraLead.x += ((player.car.vx || 0) * 0.42 - planeCameraLead.x) * lead;
        planeCameraLead.y += ((player.car.vy || 0) * 0.42 - planeCameraLead.y) * lead;
        const hold = Math.min(1, deltaSeconds * 7);
        cameraTarget.x += (player.x + planeCameraLead.x - cameraTarget.x) * hold;
        cameraTarget.y += (player.y + planeCameraLead.y - cameraTarget.y) * hold;
      } else {
        planeCameraLead.x = Math.cos(player.a) * look;
        planeCameraLead.y = Math.sin(player.a) * look;
        // A garage's drive-in show frames the bay (garages.js garageCameraFrame).
        const frame = garageCameraFrame();
        cameraTarget.x += ((frame ? frame.x : player.x + Math.cos(player.a) * look) - cameraTarget.x) * follow;
        cameraTarget.y += ((frame ? frame.y : player.y + Math.sin(player.a) * look) - cameraTarget.y) * follow;
      }
      timed('sound', () => {
        soundUpdate(deltaSeconds);
        updateAmbience(deltaSeconds);
      });
      // The flight instruments move every frame (hud.js, FLIGHT HUD).
      timed('flighthud', updateFlightHud);
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
        ((isPlayer && selectedWeaponIndex !== FISTS_INDEX && !(player.disguised && rooftopJob() && !rooftopJob().weaponDrawn)) ||
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
      paintGarageNames(worldContext);
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
      paintMonarchMap(drawingContext, big);
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      for (const b of buildings) {
        drawingContext.fillStyle = b.tropical ? '#c4beb2' : b.height > realBuildingHeight(110) ? '#354953' : '#43585a';
        drawingContext.fillRect(b.x, b.y, b.w, b.h);
        if (big && b.height > realBuildingHeight(110)) {
          drawingContext.fillStyle = '#75888b';
          drawingContext.fillRect(b.x + 7, b.y + 7, b.w - 14, 8);
        }
      }
      drawingContext.restore();
    }
    function drawMap(drawingContext, width, height, big = false) {
      const scale = big
          ? Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT) * 0.92 * mapZoom
          : MINIMAP_SCALE * minimapZoom(),
        cx = big ? mapCenter.x : player.x,
        cy = big ? mapCenter.y : player.y;
      drawingContext.fillStyle = '#123244';
      drawingContext.fillRect(0, 0, width, height);
      if (!big) {
        // Whole pixels keep the cached layer sharp; overlays are drawn in world units.
        // Zoomed (hud.js), the cached layer is scaled with it.
        const base = minimapBaseLayer(),
          zoom = minimapZoom();
        drawingContext.imageSmoothingEnabled = true;
        drawingContext.drawImage(
          base.canvas,
          Math.round(width / 2 - (cx - base.x0) * scale),
          Math.round(height / 2 - (cy - base.y0) * scale),
          Math.round(base.canvas.width * zoom),
          Math.round(base.canvas.height * zoom),
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
        // On the minimap the GPS draws the road route instead (navigation.js).
        if (big || !gpsRouteShown()) {
          drawingContext.strokeStyle = '#f3d791aa';
          drawingContext.lineWidth = big ? 9 : 8;
          drawingContext.setLineDash([22, 19]);
          drawingContext.beginPath();
          drawingContext.moveTo(player.x, player.y);
          drawingContext.lineTo(target.x, target.y);
          drawingContext.stroke();
          drawingContext.setLineDash([]);
        }
        drawingContext.fillStyle = '#f2d485';
        drawingContext.beginPath();
        drawingContext.arc(target.x, target.y, 36, 0, TAU);
        drawingContext.fill();
      }
      drawTransitMap(drawingContext, scale, big);
      drawSportsMap(drawingContext, scale, big);
      drawUserRoute(drawingContext, scale, big);
      if (!big) drawGpsRoutes(drawingContext, scale);
      drawCountyMap(drawingContext, scale, big);
      drawGarageMap(drawingContext, scale);
      drawBikeShareMap(drawingContext, scale, big);
      drawAirCoverMap(drawingContext, scale);
      drawDrawbridgeMap(drawingContext, scale, big);
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
        drawingContext.fillText(distanceLabel(BLOCK_SIZE) + ' · 1 block', 28, 65);
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
          ['MAREA BEACH CLUB', -2870, 5500],
          ['P A L M  S O U N D', -560, 2300],
          ['M A R L O W  B A Y', 4650, 2560],
          ['N O R T H  S O U N D', 1500, -4900],
          ...MONARCH_MAP_LABELS,
        ];
        for (const [label, x, y] of labels) {
          drawingContext.font = 'bold 11px Arial';
          drawingContext.strokeStyle = '#102d3de0';
          drawingContext.lineWidth = 3;
          const px = width / 2 + (x - cx) * scale,
            py = height / 2 + (y - cy) * scale;
          drawingContext.strokeText(label, px, py);
          drawingContext.fillStyle = /B A Y|S O U N D|C H A N N E L/.test(label) ? '#a3d1d5' : '#ede6d2';
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
      // In a tank the chip shows the main gun or the MG (armor.js tankHud), in the
      // Apache its gun and rockets (apache.js apacheHud).
      if (player.car?.type === 'tank' || isApache(player.car)) {
        delete getElement('weaponArt').dataset.tankIcon;
        return;
      }
      drawWeaponIcon(getElement('weaponArt'), selectedWeaponIndex);
    }
    /* No weapon: a clenched fist seen from the side, knuckles forward (the way the
       gun icons point), drawn procedurally at any canvas size. */
    function drawFistIcon(targetCanvas) {
      const g = targetCanvas.getContext('2d');
      g.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      g.save();
      const scale = Math.min(targetCanvas.width / 130, targetCanvas.height / 74);
      g.translate(targetCanvas.width / 2, targetCanvas.height / 2);
      g.scale(scale, scale);
      g.lineJoin = 'round';
      const block = (x, y, w, h, r, fill, line = '#2b1f17', width = 2.6) => {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
        g.fillStyle = fill;
        g.fill();
        if (line) {
          g.strokeStyle = line;
          g.lineWidth = width;
          g.stroke();
        }
      };
      // Jacket cuff and wrist.
      block(-60, -16, 20, 34, 3, '#3d4a57');
      block(-44, -13, 14, 28, 5, '#c9a07a');
      // Back of the hand.
      block(-34, -24, 42, 46, 12, '#d8b08a');
      // Four curled fingers, the little finger a little shorter.
      for (let i = 0; i < 4; i++) block(2, -24 + i * 11.5, i === 3 ? 27 : 31, 11.5, 5.5, '#e6c29c');
      // Knuckle highlights.
      g.fillStyle = '#f6dcbd';
      for (let i = 0; i < 4; i++) g.fillRect(i === 3 ? 21 : 25, -21 + i * 11.5, 5, 3);
      // Thumb folded across the fingers.
      block(-22, 8, 36, 13, 6.5, '#cfa47d');
      g.fillStyle = '#f0d3b4';
      g.fillRect(6, 11, 5, 3);
      g.restore();
    }
    function drawWeaponIcon(targetCanvas, weaponIndex) {
      if (weaponIndex === FISTS_INDEX) {
        drawFistIcon(targetCanvas);
        return;
      }
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
      // Every system offers its prompt during the pass; hud.js commitPrompt() shows one.
      clearPromptOffer();
      const d = district(),
        w = currentWeapon(),
        c = player.car;
      getElement('district').textContent = d;
      getElement('mapDistrict').textContent = d;
      getElement('streetName').textContent = streetNameAt(player.x, player.y);
      getElement('cash').textContent = '$' + String(Math.floor(visibleCash())).padStart(6, '0');
      // Stars, the pending star, heat meter and body count (heat.js, hud.js).
      heatUI();
      getElement('healthValue').textContent = Math.max(0, Math.ceil(player.hp));
      getElement('healthFill').style.width = clamp(player.hp, 0, 100) + '%';
      getElement('armorFill').style.width = clamp(player.armor, 0, 100) + '%';
      getElement('healthbox').classList.toggle('low', player.hp < 30);
      getElement('healthbox').classList.toggle('armored', player.armor > 0);
      getElement('armorLabel').textContent =
        player.armor > 0
          ? 'ARMOR ' + Math.ceil(player.armor)
          : wantedStars > 0
            ? searchActive
              ? 'HIDE UNTIL THE TIMER ENDS'
              : 'POLICE PURSUIT'
            : 'NO ARMOR';
      getElement('weaponSlot').textContent = w.fists
        ? 'UNARMED · WEAPONS AWAY'
        : w.melee
        ? 'KNIFE · ALWAYS CARRIED'
        : 'EQUIPPED · ' + equippedWeaponIndices().length + ' WEAPONS';
      getElement('weaponName').textContent = w.name;
      getElement('ammo').textContent = w.fists
        ? '—'
        : w.melee
        ? '∞'
        : reloadSecondsRemaining > 0
          ? '··'
          : String(w.ammo).padStart(2, '0');
      getElement('reserve').textContent = w.fists ? 'PUNCH' : w.melee ? 'NO AMMO NEEDED' : '/ ' + w.reserve;
      getElement('reloadHint').textContent = w.melee
        ? keyName('fire')
        : reloadSecondsRemaining > 0
          ? 'LOADING'
          : keyName('reload');
      // The speed box: vehicles, on foot, swimming and falling (hud.js SPEED BOX).
      updateSpeedBox();
      const target = objective(),
        m = mission;
      getElement('pager').classList.toggle('hidden', !m && incomingCallRemaining <= 0 && !demoStoryOver());
      // Numbered the same way as the mission-start headline: story missions out
      // of the story, contracts out of the contracts.
      const shownIndex = Math.min(mission?.index ?? missionIndex, missions.length - 1);
      getElement('missionCounter').textContent = !m && demoStoryOver()
        ? 'DEMO COMPLETE'
        : shownIndex >= SIDE_JOB_FIRST
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
      } else if (demoStoryOver()) {
        // PUBLIC DEMO (campaign.js): the story stops here; the city does not.
        getElement('pagerLabel').textContent = 'DEAD END CITY · DEMO';
        getElement('missionTitle').textContent = 'Thanks for playing the demo!';
        getElement('missionText').textContent = 'If you liked it, please buy the full game. Until then the city is yours to explore.';
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
          'Find the ringing payphone and press ' + keyName('interact') + ' to take a job.';
      }
      getElement('missionDistance').textContent = target
        ? (m ? 'OBJECTIVE' : 'PAYPHONE') + ' · ' + distanceLabel(distanceBetween(player, target))
        : demoStoryOver()
          ? 'FREE ROAM · DEMO COMPLETE'
          : 'FREE ROAM · ' + completed + ' JOBS COMPLETE';
      updateMissionCard(
        m
          ? m.instruction || missions[m.index].brief
          : demoStoryOver()
            ? 'FREE ROAM · DEMO COMPLETE'
            : missionIndex >= missions.length
              ? 'FREE ROAM · ' + completed + ' JOBS COMPLETE'
              : 'ANSWER THE RINGING PAYPHONE',
      );
      let prompt = '',
        promptId,
        promptKey = 'interact';
      // A bike-share station in reach: RENT BIKE on foot, DOCK BIKE on a share bike.
      const bikeShare = gameMode === 'play' && !rideSkipActive() ? bikeShareOffer() : null;
      // A passenger ride that can be skipped offers that first (ride-skip.js).
      const skip = gameMode === 'play' && !c ? rideSkipPrompt() : null;
      // Thrown off a bike (riders.js): nothing to offer until back on their feet.
      if (gameMode === 'play' && (rideSkipActive() || player.thrown)) prompt = '';
      else if (skip) {
        prompt = skip.prompt;
        promptId = skip.id;
        promptKey = 'skipRide';
      } else if (gameMode === 'play' && player.coaster) {
        // Aboard a Sunset Pier ride (the Falcon, the Sunset Eye...): E cycles the view.
        prompt = 'CHANGE VIEW';
        promptId = 'ride-view';
      } else if (gameMode === 'play') {
        if (c) {
          // The flight HUD shows power, speed and the warnings; the prompt only
          // says what to do about a stall, or how to get off the ground.
          // One identity per vehicle kind: its hints change text, not pop in anew.
          promptId = c.type === 'plane' || c.type === 'helicopter' ? c.type : 'garage';
          if (c.type === 'plane')
            prompt = c.stalled
              ? 'STALL · ' + keyName('descend') + ' NOSE DOWN + ' + keyName('forward') + ' THROTTLE'
              : aircraftClearance(c) < 1 && Math.abs(c.speed) < 40
                ? keyName('forward') + ' THROTTLE · ' + keyName('ascend') + ' ROTATE · ' + keyName('flapsDown') + ' FLAPS · ' +
                  keyName('interact') + ' EXIT'
                : '';
          else if (c.type === 'helicopter')
            prompt =
              aircraftClearance(c) > 1
                ? keyName('ascend') + ' RISE · ' + keyName('descend') + ' DESCEND · ' + moveKeysName() + ' FLY'
                : keyName('ascend') + ' TAKE OFF · ' + keyName('interact') + ' EXIT';
          else if (bikeShare) {
            prompt = bikeShare.text;
            promptId = 'bikeshare';
            promptKey = bikeShare.key;
          } else if (garagePrompt(c) !== null)
            // The price at the door (garages.js PRICE LIST); E skips the show.
            prompt = garagePrompt(c);
        } else if (taxiRide) prompt = taxiRide.arrival > 0 ? '' : 'STOP HERE · $' + taxiRide.fare;
        else if (hailableTaxi()) prompt = 'HAIL THIS CAB';
        else if (player.deck)
          prompt = deckExitNear() ? 'GO ASHORE · ' + player.deck.name : '';
        else if (boardableLiner()) prompt = 'BOARD ' + boardableLiner().name;
        else if (transitRide) prompt = 'REQUEST NEXT RAIL STOP';
        else if (nearestStation()) prompt = 'CITY RAIL · CHOOSE DESTINATION';
        else if (payphoneInReach() && !m && storyCallWaiting()) prompt = 'ANSWER PAYPHONE';
        else if (monarchPrompt()) prompt = monarchPrompt();
        else if (bikeShare) {
          prompt = bikeShare.text;
          promptId = 'bikeshare';
          promptKey = bikeShare.key;
        } else if (sportsKickPrompt()) prompt = sportsKickPrompt();
        else if (leisurePrompt()) {
          const leisure = leisurePrompt();
          prompt = leisure.text;
          promptId = leisure.id;
        } else {
          const n = nearestCar();
          promptId = 'vehicle';
          if (n)
            prompt = vehicleIsLocked(n)
              ? 'LOCKED · BREAK THE WINDOW'
              : (n.occupied ? 'PULL OUT THE DRIVER · ' : 'ENTER ') + vehicleSpec(n).name;
        }
      }
      // Aircraft prompts name their own keys; passing cars share one identity so
      // walking along a row of them changes the name without a new pop-in.
      offerPrompt(prompt, {
        key: isAircraft(c) ? null : promptKey,
        id: promptId,
      });
      if (!hudState.minimapFolded) drawMap(minimapContext, getElement('minimap').width, getElement('minimap').height);
      if (mapOpen) drawMap(cityMapContext, 800, 660, true);
      drawWeapon();
      civicUI();
      challengeMissionUI();
      updateCarRadioUI();
      updateExplorationUI();
      updateTouchUI();
      updateHud();
      // In a tank the weapon chip shows the main gun and the MG (armor.js).
      if (c?.type === 'tank') tankHud(c);
      else if (isApache(c)) apacheHud(c);
      else if (getElement('weaponArt').dataset.tankIcon) {
        delete getElement('weaponArt').dataset.tankIcon;
        drawWeapon();
      }
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
      if (city3D) {
        city3D.resize();
        // LOW caps the scene's pixel count (quality.js LOW RESOLUTION CAP).
        applyTierResolution();
      }
    }
    function begin() {
      if (gameMode !== 'menu') return;
      initAudio();
      newCallNotice();
      gameMode = 'play';
      getElement('menu').classList.add('hidden');
      canvas.focus();
      keys = {};
      tell(
        demoStoryOver()
          ? 'Welcome back. The demo story is complete: the city is yours to explore.'
          : 'Welcome to South Coast. Answer the yellow payphone, or take a ride.',
        5,
      );
      announce('SOUTH COAST · 1997', 'DEAD END CITY', 1.8);
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
        // Close as the BACK button does, returning focus to whatever opened it.
        getElement('closeCredits').click();
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
      renderControlsHelp();
      getElement('help').classList.remove('hidden');
      // Focus the button without scrolling the manual to its end.
      getElement('closeHelp').focus({ preventScroll: true });
      getElement('help').querySelector('.dialog').scrollTop = 0;
      keys = {};
    }
    function closeHelp() {
      gameMode = previousMode;
      getElement('help').classList.add('hidden');
      if (gameMode === 'play') canvas.focus();
    }
    function toggleMap() {
      if ((gameMode !== 'play' || rideSkipActive()) && !mapOpen) return;
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
      godMapToggled(); // GOD PANEL: the teleport pick mode (god-panel.js)
    }
    function newGame() {
      initAudio();
      cancelRideSkip();
      worldZoom = worldZoomTarget = STREET_ZOOM;
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
      announce('A FRESH START', 'DEAD END CITY', 1.8);
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
          tell('GOD MODE ACTIVATED · every weapon · every mission unlocked · mission select, time, weather, ammo and teleport in Settings · God mode', 5);
        } else {
          announce('SOUTH COAST', 'GODMODE OFF', 1.8);
          tell('GODMODE OFF', 2.5);
        }
        drawWeapon();
        updateUI();
        tone(player.godMode ? 720 : 240, 0.22, 0.16, 'sine');
        // Straight to Settings · GOD MODE (god-panel.js), whose first row opens
        // the mission picker with every job unlocked. In play it opens over the
        // pause menu; on the title screen over the title, and BACK returns there.
        if (!player.godMode) return;
        if (gameMode === 'map') toggleMap();
        if (gameMode === 'play') togglePause();
        if (gameMode === 'pause' || gameMode === 'menu') openSettings('god');
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
      player.thrown = null;
      player.pool = null;
      player.jumpUntil = 0;
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
      // Only from the second letter on: a lone first letter (G) is also a game
      // key (the aircraft's descend) and must not be eaten on every press.
      const tail = cheatBuffer.slice(-15);
      for (const code of Object.keys(CHEAT_CODES))
        for (let i = 2; i <= Math.min(tail.length, code.length); i++)
          if (code.startsWith(tail.slice(-i))) return true;
      return false;
    }
    /**
     * KEYBOARD
     * Physical keys go through the bindings (controls.js): `actions` are the ids
     * of the actions the key drives, and holding one sets its entry in the
     * virtual `keys` table. Menu keys (Escape, Enter, and in the city map the
     * arrows, + / −, 0 and C) are fixed and read from the physical code.
     */
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      // The settings screen owns the keyboard while it is open (and while it
      // listens for a key to bind).
      if (gameMode === 'settings') {
        settingsKeyDown(e);
        return;
      }
      if (
        !e.repeat &&
        (gameMode === 'play' || gameMode === 'map' || gameMode === 'menu') &&
        feedCheatBuffer((e.key || '').toLowerCase())
      ) {
        e.preventDefault();
        return;
      }
      const actions = pressControlKey(code),
        is = (id) => actions.includes(id);
      if (gameMode === 'map' && code === 'KeyC') {
        e.preventDefault();
        centerMapOnPlayer();
        return;
      }
      if (
        gameMode === 'play' &&
        is('divert') &&
        !e.repeat &&
        mission?.index === 10 &&
        mission.compromised &&
        [1, 2, 3].includes(mission.stage)
      ) {
        chooseFlightLanding(!mission.divert);
        return;
      }
      if (gameMode === 'map' && mapKey(e, code, is)) return;
      if (gameMode === 'arsenal') {
        if (code === 'Tab') trapArsenalFocus(e);
        if (!e.repeat && (code === 'Escape' || is('arsenal'))) {
          e.preventDefault();
          closeArsenal();
        } else if (!e.repeat && is('cycleWeapon')) {
          e.preventDefault();
          cycleWeapon();
          updateUI();
          renderArsenal(selectedWeaponIndex);
        } else if (!e.repeat && (is('knife') || is('fists') || weaponSlotKey(actions) >= 0)) {
          e.preventDefault();
          selectArsenalWeapon(is('knife') ? KNIFE_INDEX : is('fists') ? FISTS_INDEX : weaponSlotKey(actions));
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
          if (code === 'Enter' || is('interact')) acceptDialogue();
          if (code === 'Escape') closeDialogue();
        }
        return;
      }
      // The DEMO COMPLETE card (campaign.js): a focused button takes Enter and
      // Space itself; Escape (or Enter elsewhere) carries on in free roam.
      if (gameMode === 'demo') {
        if (document.activeElement?.tagName === 'BUTTON' && ['Enter', 'NumpadEnter', 'Space'].includes(code)) return;
        e.preventDefault();
        if (!e.repeat && ['Escape', 'Enter', 'NumpadEnter'].includes(code)) closeDemoComplete(false);
        return;
      }
      if (gameMode === 'elevator') {
        e.preventDefault();
        return;
      }
      if (gameMode === 'transit' || gameMode === 'taxi') {
        if (code === 'Escape' || is('interact')) {
          e.preventDefault();
          if (gameMode === 'transit') closeTransit();
          else closeTaxiOffer();
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
        // The shop menus read E (leave) and the digits; E follows its binding.
        if (!e.repeat) serviceKey(is('interact') ? 'KeyE' : code);
        return;
      }
      // A focused menu button takes Enter and Space itself (a native click).
      const onButton =
        document.activeElement?.tagName === 'BUTTON' && ['menu', 'pause', 'help', 'dead'].includes(gameMode);
      if (onButton && ['Enter', 'NumpadEnter', 'Space'].includes(code)) return;
      if ((gameMode === 'menu' || gameMode === 'pause') && ['ArrowUp', 'ArrowDown'].includes(code) && menuArrowKey(e))
        return;
      // Keys the browser would otherwise use to scroll or move focus.
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code) ||
        is('map')
      )
        e.preventDefault();
      if (e.repeat) {
        if (gameMode === 'play') holdActions(actions);
        return;
      }
      if (code === 'Escape') {
        togglePause();
        return;
      }
      if (code === 'Enter' || code === 'NumpadEnter') {
        if (gameMode === 'menu') begin();
        else if (gameMode === 'pause') togglePause();
        else if (gameMode === 'help') closeHelp();
        return;
      }
      // Under a ride-skip fade only Escape (pause) and mute do anything.
      if (gameMode === 'play' && rideSkipActive() && !is('mute')) return;
      if (is('map')) {
        toggleMap();
        return;
      }
      if (is('mute')) {
        mute();
        return;
      }
      if (is('help')) {
        openHelp();
        return;
      }
      // The title menu's radio takes the same keys as in a vehicle (car-radio.js TITLE RADIO).
      if (gameMode === 'menu' && titleRadioShown) {
        if (is('radioPower')) toggleCarRadio();
        else if (is('radioNext')) tuneCarRadio(radioStationIndex() + 1);
        else if (is('radioLouder') || is('radioQuieter')) stepRadioVolume(is('radioLouder') ? 1 : -1);
        return;
      }
      if (gameMode !== 'play') return;
      if (is('zoomIn') || is('zoomOut') || is('zoomReset')) {
        e.preventDefault();
        setWorldZoom(is('zoomReset') ? 1 : worldZoomTarget * (is('zoomOut') ? 1 / 1.25 : 1.25));
        return;
      }
      if (is('bail')) {
        // Aircraft: parachute. Boats and flooding cars: over the side (water.js).
        if (!bailOut()) diveOverboard();
        return;
      }
      if (player.parachute && is('handbrake')) {
        deployParachute();
        return;
      }
      // Plane flaps and landing gear (aviation.js, FLIGHT CONTROLS).
      if (player.car?.type === 'plane' && player.car.hp > 0 && (is('flapsDown') || is('flapsUp') || is('gear'))) {
        if (is('gear')) togglePlaneGear(player.car);
        else setPlaneFlaps(player.car, is('flapsDown') ? 1 : -1);
        return;
      }
      // The radio plays in vehicles, in a hired cab and on the Sunset Pier rides
      // (car-radio.js).
      if ((player.car || player.coaster || taxiRide) && is('radioPower')) {
        toggleCarRadio();
        return;
      }
      if ((player.car || player.coaster || taxiRide) && is('radioNext')) {
        tuneCarRadio(radioStationIndex() + 1);
        return;
      }
      if (radioAboard() && (is('radioLouder') || is('radioQuieter'))) {
        stepRadioVolume(is('radioLouder') ? 1 : -1);
        return;
      }
      // Skip the ride, or pick the train's stop for it (ride-skip.js). Off a ride
      // the keys fall through and do nothing.
      if ((is('skipRide') && rideSkipKey('skip')) || (is('skipStop') && rideSkipKey('cycle'))) return;
      holdActions(actions);
      if (is('fire') || (is('handbrake') && !player.car)) shoot();
      if (is('interact')) interact();
      if (is('poison')) poisonDrink();
      if (is('reload')) startReload();
      if (is('arsenal')) openArsenal();
      if (is('knife')) selectWeapon(KNIFE_INDEX);
      if (is('fists')) selectWeapon(FISTS_INDEX);
      if (weaponSlotKey(actions) >= 0) selectWeapon(weaponSlotKey(actions));
      if (is('cycleWeapon')) cycleWeapon();
      if (is('missionCard')) toggleMissionCard();
      if (['forward', 'back', 'left', 'right'].some(is)) mouse.active = false;
    });
    /* weapon1..weapon6 -> 0..5, or -1. */
    function weaponSlotKey(actions) {
      const slot = actions.find((id) => /^weapon[1-6]$/.test(id));
      return slot ? Number(slot.slice(-1)) - 1 : -1;
    }
    /* City map keys: + / − zoom, arrows (and the movement keys) pan, 0 resets. */
    function mapKey(e, code, is) {
      const zoomIn = code === 'Equal' || code === 'NumpadAdd' || is('zoomIn'),
        zoomOut = code === 'Minus' || code === 'NumpadSubtract' || is('zoomOut'),
        reset = code === 'Digit0' || is('zoomReset'),
        panX =
          (code === 'ArrowRight' || is('right') ? 1 : 0) - (code === 'ArrowLeft' || is('left') ? 1 : 0),
        panY = (code === 'ArrowDown' || is('back') ? 1 : 0) - (code === 'ArrowUp' || is('forward') ? 1 : 0);
      if (!zoomIn && !zoomOut && !reset && !panX && !panY) return false;
      e.preventDefault();
      if (zoomIn) {
        if (mapZoom === 1)
          mapCenter = {
            x: player.x,
            y: player.y,
          };
        mapZoom = Math.min(9, mapZoom * 1.5);
      }
      if (zoomOut) mapZoom = Math.max(1, mapZoom / 1.5);
      if (mapZoom === 1 || reset) {
        mapZoom = 1;
        mapCenter = {
          x: (WORLD_LEFT + WORLD_SIZE) / 2,
          y: (WORLD_TOP + WORLD_SIZE) / 2,
        };
      } else {
        const step = 500 / mapZoom;
        mapCenter.x = clamp(mapCenter.x + panX * step, WORLD_LEFT, WORLD_SIZE);
        mapCenter.y = clamp(mapCenter.y + panY * step, WORLD_TOP, WORLD_SIZE);
      }
      drawMap(cityMapContext, 800, 660, true);
      return true;
    }
    window.addEventListener('keyup', (e) => {
      releaseControlKey(e.code);
    });
    window.addEventListener('blur', () => {
      keys = {};
      releaseAllControlKeys();
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
      // The right button fires a tank's machine gun (armor.js).
      if (e.button === 2 && gameMode === 'play') mouse.alt = true;
      if (e.button === 0 && gameMode === 'play') {
        mouse.down = true;
        mouse.active = true;
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        initAudio();
        shoot();
      }
    });
    window.addEventListener('mouseup', () => (mouse.down = mouse.alt = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    getElement('creditsBtn').onclick = () => openCredits(getElement('creditsBtn'));
    getElement('closeCredits').onclick = () => {
      getElement('credits').classList.add('hidden');
      (creditsOpener || getElement('creditsBtn')).focus();
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
    getElement('menuSound').onclick = mute;
    applySoundLabels();
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
    // @include src/controls.js
    // @include src/geography.js
    // @include src/drawbridge.js
    // @include src/harbor.js
    // @include src/police-feedback.js
    // @include src/arsenal.js
    // @include src/citylife.js
    // @include src/pursuit.js
    // @include src/swat.js
    // @include src/wounds.js
    // @include src/story.js
    // @include src/campaign.js
    // @include src/chase.js
    // @include src/roadblocks.js
    // @include src/carjack.js
    // @include src/riders.js
    // @include src/themepark.js
    // @include src/marina.js
    // @include src/taxi.js
    // @include src/cycles.js
    // @include src/weather.js
    // @include src/weather-audio.js
    // @include src/water.js
    // @include src/water-audio.js
    // @include src/beachvolley.js
    // @include src/beach.js
    // @include src/roofmission.js
    // @include src/rooftops.js
    // @include src/air-cover.js
    // @include src/combat-rules.js
    // @include src/damage.js
    // @include src/crash-audio.js
    // @include src/engine-audio.js
    // @include src/county.js
    // @include src/monarch.js
    // @include src/airfields.js
    // @include src/military.js
    // @include src/armor.js
    // @include src/apache.js
    // @include src/aviation.js
    // @include src/challenges.js
    // @include src/sidejobs.js
    // @include src/streets.js
    // @include src/terrain.js
    // @include src/offroad.js
    // @include src/casino.js
    // @include src/skyline.js
    // @include src/renewal.js
    // @include src/sports-fixtures.js
    // @include src/sports.js
    // @include src/sports-world.js
    // @include src/sports-audio.js
    // @include src/transit.js
    // @include src/ride-skip.js
    // @include src/ecology.js
    // @include src/navigation.js
    // @include src/parachute.js
    // @include src/mobile.js
    // @include src/world-view.js
    // @include src/car-radio.js
    // @include src/garages.js
    // @include src/crowd.js
    // @include src/monarch-life.js
    // @include src/beachclub.js
    // @include src/beachclub-audio.js
    // @include src/clubpool.js
    // @include src/clubtalk.js
    // @include src/leisure.js
    // @include src/ambience.js
    // @include src/quality.js
    // @include src/settings.js
    // @include src/god-panel.js
    // @include src/hud.js
    // @include src/render3d.js
    // STARTUP ORDER: geometry -> collision -> entities -> saved progression -> UI -> graphics.
    buildWorld();
    buildBuildingGrid();
    buildColliders();
    populate();
    populateStoryWorld();
    populateCounty();
    chooseRoofHelipads();
    addMonarchHelipads();
    load();
    resize();
    drawWeapon();
    updateUI();
    updateTitleMenu();
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
    // Split timing for long straight-line passes (the renderer's frame): adds the
    // time since `t0` to `name` and returns the new mark, so no closure is made.
    function profileLap(name, t0) {
      const now = performance.now();
      profile.parts[name] = (profile.parts[name] || 0) + now - t0;
      return now;
    }
    /**
     * FPS COUNTER
     * Optional readout switched from Settings · Graphics and remembered in
     * localStorage beside the touch-controls setting. It averages over half a
     * second so the number is readable, and shows the average frame time too.
     */
    const fpsMeter = { shown: false, frames: 0, since: 0 };
    try {
      fpsMeter.shown = localStorage.getItem('dead-end-city-fps') === 'on';
    } catch {}
    function applyFpsSetting() {
      getElement('fpsCounter').classList.toggle('hidden', !fpsMeter.shown);
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
    applyFpsSetting();
    /**
     * FRAME LIMITER
     * Settings · Graphics caps the frame rate at 30, 60 or 120 FPS, or leaves it
     * UNLIMITED (the display's refresh rate; the default). Remembered in
     * localStorage under 'dead-end-city-frame-limit'. requestAnimationFrame still
     * fires every display refresh; a frame is only simulated and drawn once the
     * cap's interval has come round. The next due time advances by exactly one
     * interval per drawn frame (so the average is the cap), a frame arriving a
     * little early (vsync jitter, up to a fifth of the interval) still counts,
     * so 60 on a 60 Hz display stays 60 rather than falling to 30, and after a
     * stall the schedule restarts from now instead of racing to catch up. Skipped
     * refreshes do nothing at all: the next drawn frame's time step covers them.
     */
    const FRAME_LIMITS = [30, 60, 120, 0],
      frameLimiter = { limit: 0, next: 0 };
    try {
      const saved = localStorage.getItem('dead-end-city-frame-limit');
      if (saved === 'unlimited') frameLimiter.limit = 0;
      else if (FRAME_LIMITS.includes(Number(saved))) frameLimiter.limit = Number(saved);
    } catch {}
    // 30, 60, 120, or 0 for unlimited.
    function frameLimit() {
      return frameLimiter.limit;
    }
    function setFrameLimit(value) {
      const limit = value === 'unlimited' ? 0 : Number(value);
      if (!FRAME_LIMITS.includes(limit)) return frameLimiter.limit;
      frameLimiter.limit = limit;
      frameLimiter.next = 0;
      try {
        localStorage.setItem('dead-end-city-frame-limit', limit ? String(limit) : 'unlimited');
      } catch {}
      return limit;
    }
    // Whether the frame at time t is to be drawn (and, if so, books the next one).
    function frameDue(t) {
      const limit = frameLimiter.limit;
      if (!limit) return true;
      const interval = 1000 / limit;
      if (!frameLimiter.next || t - frameLimiter.next > interval * 3) frameLimiter.next = t;
      if (t < frameLimiter.next - interval * 0.2) return false;
      frameLimiter.next += interval;
      if (frameLimiter.next < t) frameLimiter.next = t;
      return true;
    }
    function frame(t) {
      if (!frameDue(t)) {
        requestAnimationFrame(frame);
        return;
      }
      syncTouchInput();
      updateFpsCounter(t);
      // At a 30 FPS cap a frame is 33.3 ms: the step limit allows it, so the
      // simulation keeps real time rather than running 1% slow.
      const deltaSeconds = Math.min(frameLimiter.limit === 30 ? 0.04 : 0.033, Math.max(0, (t - lastTime) / 1000));
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
      // The city keeps living behind the title menu, and behind settings opened
      // from it. WASTED and BUSTED play out in slow motion.
      // A test holding the simulation (console `holdSimulation`) still draws.
      if (simulationHeld) soundUpdate(0);
      else if (
        gameMode === 'play' ||
        gameMode === 'menu' ||
        (gameMode === 'settings' && settingsOrigin === 'menu')
      )
        update(deltaSeconds);
      else if (gameMode === 'dead') update(deltaSeconds * 0.35);
      else {
        soundUpdate(deltaSeconds);
        updateAmbience(deltaSeconds);
      }
      const drawStart = performance.now();
      drawWorld();
      updateTankReticle();
      const frameEnd = performance.now();
      profile.update += drawStart - updateStart;
      profile.draw += frameEnd - drawStart;
      profile.frames++;
      // AUTO graphics: dynamic resolution and tier from the frame rate (quality.js).
      if (gameMode === 'play') adaptGraphics(t - (profile.previousFrame || t), frameEnd - updateStart, frameEnd);
      profile.previousFrame = t;
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
      version: GAME_VERSION,
      // The world scale (game.js WORLD SCALE): map units to the metre.
      unitsPerMetre: UNITS_PER_METRE,
      // World-scale audit, everything in metres: each road vehicle's spec
      // (length, width), the built models within `radius` of the player measured
      // from their meshes (length, width, height), the player's model, the crowd
      // rig's stature range and the city's building heights.
      scaleReport(radius = 400) {
        const m = (units) => Math.round(worldMeters(units) * 100) / 100,
          near = vehicles.filter((c) => distanceBetween(c, player) < radius),
          extents = city3D?.modelExtents?.([...near, player]) || [],
          size = (e) => (e ? { l: m(e.l), w: m(e.w), h: m(e.h) } : null),
          rig = city3D?.crowdRigHeight?.() || 0,
          statures = pedestrians
            .filter((p) => p.look && p.role !== 'kid')
            .map((p) => city3D?.personStature?.(p) || 0)
            .filter(Boolean),
          heights = buildings.map((b) => b.height).sort((a, b) => a - b),
          pick = (list, q) => (list.length ? m(list[Math.min(list.length - 1, Math.floor(q * list.length))]) : null);
        return {
          unitsPerMetre: UNITS_PER_METRE,
          specs: Object.fromEntries(Object.entries(VEHICLE_DEFINITIONS).map(([type, s]) => [type, { l: m(s.l), w: m(s.w) }])),
          models: near
            .map((c, i) => ({ id: c.id, type: c.type, look: c.policeLook?.body || c.lawUnit || null, ...size(extents[i]) }))
            .filter((row) => row.l),
          player: size(extents[near.length]),
          crowd: {
            rig: m(rig),
            player: m(city3D?.personStature?.(player) || 0),
            shortest: pick(statures.sort((a, b) => a - b), 0),
            average: statures.length ? m(statures.reduce((s, v) => s + v, 0) / statures.length) : null,
            tallest: pick(statures.sort((a, b) => a - b), 1),
          },
          buildings: { count: heights.length, lowest: pick(heights, 0), median: pick(heights, 0.5), p90: pick(heights, 0.9), tallest: pick(heights, 1) },
        };
      },
      // Mend the player's vehicle as a repair bay would (for repeatable physics tests).
      repair() {
        if (!player.car) return null;
        repairVehicle(player.car);
        return this.damageReport();
      },
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
        weapon: currentWeapon().name,
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
        // A public demo's gated jobs need god mode or ?dev in the URL (campaign.js).
        if (demoLocked(index) && !/[?&]dev\b/.test(location.search)) return { ...this.status(), demoLocked: true };
        if (index >= 0 && index < missions.length) {
          missionIndex = index;
          startMission();
        }
        return this.status();
      },
      // PUBLIC DEMO (campaign.js): the build flag, which jobs are open, the stats
      // recap, whether the demo was completed and whether the card is up.
      demo: () => ({
        build: DEMO_BUILD,
        missions: DEMO_MISSIONS,
        godMode: !!player.godMode,
        open: missions.map((m, i) => i).filter((i) => !demoLocked(i)),
        storyOver: demoStoryOver(),
        callWaiting: storyCallWaiting(),
        completed: demoCompleted,
        cardShown: gameMode === 'demo',
        cardIn: Math.round(demoCardIn * 10) / 10,
        stats: { ...campaignStats, playSeconds: Math.round(campaignStats.playSeconds) },
      }),
      // Mission 2 test shortcut: start A Seat at the Table if needed, put Vescari
      // down and the player on the street for the last stage (reach the motel).
      skipToRooftopEscape() {
        if (mission?.index !== 1) {
          missionIndex = 1;
          startMission();
        }
        const m = mission;
        m.boss.hp = 0;
        m.boss.deadTime = gameTime;
        m.killRegistered = true;
        player.roof = false;
        player.buildingRoof = null;
        player.altitude = 0;
        teleportPlayer(ROOF_HIT.escape.x, ROOF_HIT.escape.y - 120);
        setStage(4, ROOF_HIT.escape, 'LOSE THE POLICE · REACH CORAL PALMS MOTEL ON FOOT');
        return this.missionState();
      },
      // Mission 1 test helper: `n` patrol officers on foot just inside Vinny's
      // front doorway, as if they had run in after the truck.
      depotOfficers(n = 2) {
        const spawned = [];
        for (let i = 0; i < n; i++) {
          const o = makeOfficer(-1700 + (i % 4) * 24, 4372 + Math.floor(i / 4) * 22, Math.PI / 2, 'patrol', {
            car: null,
            timer: 1.2 + i * 0.3,
          });
          officers.push(o);
          spawned.push({ x: Math.round(o.x), y: Math.round(o.y) });
        }
        return spawned;
      },
      // Mission 1 test helper: every officer still fighting inside the sealed
      // warehouse takes a fatal shot from the player (the ordinary hit path).
      neutraliseDepotPolice() {
        const inside = depotPoliceInside();
        for (const o of inside) strikePerson(o, 999, headingBetween(player, o), player, true, 'headshot');
        return inside.length;
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
      // The interaction prompt as the player sees it (hud.js INTERACTION PROMPT):
      // visible, text, identity, docked, seconds since it popped in, this pass's offer.
      promptState: () => promptReport(),
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
              depotSealed,
              policeInside: mission.index === 0 ? depotPoliceInside().length : undefined,
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
      // The Ridgeline Range (terrain.js): each field's grid, top and build time,
      // each trail's length, summit and steepest graded pitch, scenery counts and
      // the outcrops' footing. Terrain tests read it alongside probe().
      terrain: () => terrainReport(),
      // The 4x4 club and the trails (offroad.js): the lot and its clearances, the
      // club trucks, the members, the player's traction state, the hill climb.
      offroad: () => offroadReport(),
      clubLineup: (x, y) => clubLineup(x, y),
      // 'state', 'arm', 'reset', 'clear' (records), 'gate' or 'cp0'..'cp2' (move the player's vehicle there).
      hillClimb: (action, trail) => hillClimbConsole(action, trail),
      // Drive the player's vehicle up a trail through the real physics (a line-following pilot).
      trailDrive: (seconds, maxKmh, trail) => trailPilot(seconds, maxKmh, trail),
      // A trail's path: [sample, x, y, height, grade, mud, rock] every `step` samples.
      trailProfile: (trail, step) => trailProfile(trail, step),
      // Set the mud on the player's vehicle (0..1) and how wet it is.
      mud: (amount = 1, wet = 1) => {
        const c = player.car;
        if (!c) return null;
        c.mudCoat = clamp(amount, 0, 1);
        c.mudWet = clamp(wet, 0, 1);
        return { mudCoat: c.mudCoat, mudWet: c.mudWet };
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
          c.altitude = altitudeMeters > 0 ? terrainHeight(x, y) + altitudeMeters * UNITS_PER_METRE : terrainHeight(x, y);
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
      // Restore the player's health (and optionally armour) without god mode, so a
      // long test under fire can go on while every hit still lands and is logged.
      heal(armor = 0) {
        player.hp = 100;
        player.armor = clamp(armor, 0, 100) || player.armor;
        return { hp: player.hp, armor: player.armor };
      },
      god(on = true) {
        player.godMode = !!on;
        return player.godMode;
      },
      // GOD PANEL: godPanel(), godTeleport(x, y), godRefill(), godLosePolice(), godFreeze(on), mapScreenPoint(x, y) (god-panel.js).
      ...godPanelConsole(),
      // Set the wanted level directly. Useful for looking at containment and air
      // support without having to earn them.
      wanted(stars = 5) {
        const n = clamp(Math.round(stars), 0, 5);
        // Clearing reports the escape exactly like losing them in play would.
        if (n <= 0) clearPolice(true);
        else {
          setWantedLevel(n);
          searchActive = false;
          searchRemaining = policeSearchSeconds(n);
          lastSeen = {
            x: player.x,
            y: player.y,
          };
        }
        return this.status();
      },
      // The police response as data: stars, heat and the next star's threshold,
      // the incident's body count, the search, arrest progress, the tier's
      // allowances and every unit (patrol, swat, fed, army, air) and officer.
      policeReport: () => policeReportData(),
      // Hostile rounds aimed at the player since the last reset, by source, with
      // the shooter's distance and whether it was on screen (combat-rules.js SHOT
      // LOG); `reset` clears the log after reading it.
      shotLog: (reset = false) => shotLogReport(reset),
      // Fort Sentinel's Apache (apache.js): position, pad, ammunition, turret, aim
      // and a clearance check of its parked footprint.
      apache: () => apacheReport(),
      // Overhead cover (air-cover.js OVERHEAD COVER) at a map point (default: the
      // player): the cover over it or null, whether the player is hidden from the
      // police helicopter, and how many covers of each kind are registered (with
      // one example point each, for tests).
      cover(x = player.x, y = player.y) {
        const elevation = x === player.x && y === player.y ? entityElevation(player.car || player) : terrainHeight(x, y),
          c = overheadCover(x, y, elevation),
          kinds = {};
        for (const k of overheadCovers) {
          const entry = (kinds[k.kind] ??= { count: 0, example: [Math.round(k.x), Math.round(k.y)] });
          entry.count++;
        }
        return {
          x: Math.round(x),
          y: Math.round(y),
          cover: c ? { kind: c.kind, bottom: Math.round(c.bottom), top: Math.round(c.top) } : null,
          // Where the helicopter's searchlight lands (air-cover.js overheadCoverHeight).
          roofHeight: overheadCoverHeight(x, y, elevation),
          playerHiddenFromAir: hiddenFromAir(player.car || player),
          air: airPursuitStatus(),
          registered: kinds,
        };
      },
      // The respray garages (garages.js): shops, doors, prices, the offer for the
      // player's vehicle, the drive-in job in progress and the last service.
      garage: () => garageReport(),
      // Fix the Apache's aim point on the ground (map x, y) as the mouse would;
      // no arguments hands the aim back to the mouse. Returns apache().
      // Put a fresh Apache back on its pad (the old one, wrecked or not, is removed
      // unless the player is aboard). Returns apache().
      apacheReset() {
        for (let i = vehicles.length - 1; i >= 0; i--)
          if (isApache(vehicles[i]) && vehicles[i] !== player.car) vehicles.splice(i, 1);
        if (!isApache(player.car)) parkApache();
        return apacheReport();
      },
      apacheAim(x, y) {
        apacheAimOverride = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
        return apacheReport();
      },
      // Combat tests: own weapon `index` (0 pistol ... 5 precision rifle) with a
      // full clip and reserve, and select it. Returns its name.
      arm(index = 4) {
        // 6 the knife, 7 no weapon (fists): selected as they are.
        if (index === KNIFE_INDEX || index === FISTS_INDEX) {
          selectedWeaponIndex = index;
          reloadSecondsRemaining = 0;
          drawWeapon();
          return currentWeapon().name;
        }
        const w = weapons[index];
        if (!w) return null;
        w.owned = true;
        w.ammo = w.clip;
        w.reserve = Math.max(w.reserve, w.clip * 8);
        selectedWeaponIndex = index;
        reloadSecondsRemaining = 0;
        drawWeapon();
        return w.name;
      },
      // Living people near the player, nearest first, for play-tests that pick a
      // victim: kind 'civilian', 'police', 'gang' or 'all' (default).
      nearbyPeople(radius = 500, kind = 'all') {
        const lists = {
          civilian: [pedestrians],
          police: [officers],
          gang: [gangMembers, enemies],
          all: [pedestrians, officers, gangMembers, enemies],
        }[kind] || [];
        const found = [];
        for (const list of lists)
          for (const p of list)
            if (p.hp > 0 && !p.hidden && distanceBetween(p, player) < radius)
              found.push({
                kind: p.police ? 'police:' + (p.unit || 'patrol') : p.faction ? 'gang:' + p.faction : 'civilian',
                x: Math.round(p.x),
                y: Math.round(p.y),
                hp: Math.round(p.hp),
                d: Math.round(distanceBetween(p, player)),
                sight: clearSight(player, p),
                // Police extras: a riot shield (swat.js), a rooftop post, their heading.
                ...(p.police ? { shield: !!p.shield, roof: !!p.roofSniper, aim: +(p.sniperAim || 0).toFixed(2), a: +(p.a || 0).toFixed(2), state: p.state } : {}),
              });
        return found.sort((a, b) => a.d - b.d).slice(0, 40);
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
      // The weather machine's state: sky, next step, rain, wetness, wind, the
      // build-up to a shower (approach), strikes so far and thunder on its way.
      weather: () => weatherReport(),
      // Bring a shower in: overcast now, rain after `seconds` (the machine runs on).
      weatherFront: (seconds) => weatherFront(seconds),
      // Set how wet the streets are (0 dry .. 1 soaked); after rain it dries on
      // from there (weather.js), so a test can look at a drying street at once.
      wetness: (value) => {
        weather.wet = clamp(Number(value) || 0, 0, 1);
        return weatherReport();
      },
      // A lightning strike `distance` map units from the player (thunder follows).
      lightning: (distance = 900) => {
        const s = lightningStrike(distance);
        return { x: Math.round(s.x), y: Math.round(s.y), distance: Math.round(s.distance), thunderIn: +(s.distance / THUNDER_SPEED).toFixed(2) };
      },
      // The player's aircraft instruments as the flight HUD shows them (aviation.js
      // flightData): airspeed km/h, altitude and AGL m, vertical speed m/s, heading,
      // pitch, bank, throttle and spooled power, flaps, gear, g, stall warnings.
      flight() {
        const data = flightData(player.car);
        if (!data) return null;
        const out = {};
        for (const [key, value] of Object.entries(data))
          out[key] = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
        out.hud = !!document.getElementById('flightHud')?.classList.contains('on');
        out.instruments = hudState.flightHud;
        return out;
      },
      // What the vehicle under the player is actually doing.
      ride: () => ({
        type: player.car ? player.car.type : null,
        speed: player.car ? Math.round((player.car.speed || 0) * 10) / 10 : 0,
        vx: player.car ? Math.round((player.car.vx || 0) * 10) / 10 : 0,
        vy: player.car ? Math.round((player.car.vy || 0) * 10) / 10 : 0,
        cadence: Math.round(pedalCadence() * 100) / 100,
        effort: Math.round(pedalEffort() * 100) / 100,
        // Aircraft: absolute altitude in map units (0 on the ground).
        altitude: player.car ? Math.round(player.car.altitude || 0) : 0,
        // Tanks: hull and turret headings (degrees), where the gunner is aiming,
        // the traverse rate (deg/s) and the ammunition (armor.js).
        ...(player.car?.type === 'tank'
          ? {
              hull: Math.round((player.car.a * 180) / Math.PI),
              turret: Math.round(((player.car.turretA ?? player.car.a) * 180) / Math.PI),
              aim: Math.round(((player.car.turretAim ?? player.car.a) * 180) / Math.PI),
              traverse: Math.round(((player.car.turretRate || 0) * 180) / Math.PI),
              arms: { ...tankArms(player.car), reload: Math.max(0, Math.round(((player.car.cannonReadyAt || 0) - gameTime) * 10) / 10) },
            }
          : {}),
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
          hudClockOffset += 1 / 30; // HUD timers (prompt docking) follow the stepped time
        }
        for (const code of held) keys[code] = false;
        return this.ride();
      },
      // South Coast Cycle (cycles.js BIKE SHARE): every station, its docks and
      // bikes, the prompt in reach, what renting and docking have cost.
      bikeShare: () => bikeShareReport(),
      // Stand at bike-share station `id` (from bikeShare().list), facing its bikes.
      bikeStation(id = 0) {
        return goToBikeStation(id);
      },
      // The speed box as shown: mode, label, figure and unit line (hud.js SPEED BOX).
      speedBox: () => (updateSpeedBox(), {
        active: getElement('vehicleStats').classList.contains('active'),
        mode: getElement('vehicleStats').dataset.mode,
        label: getElement('vehicleName').textContent,
        speed: getElement('speed').textContent,
        unit: getElement('speedUnit').textContent,
        units: hudState.units,
      }),
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
      // heading (radians, 0 = east) points it down a chosen road. A plane takes
      // an optional airframe ('courier' default, 'jet', 'airliner').
      drive(type = 'sedan', altitudeMeters = 0, headingRadians = player.a, airframe) {
        if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
        if (airframe && (type !== 'plane' || !AIRFRAME_SPECS[airframe])) throw Error('Unknown airframe ' + airframe);
        if (player.car) exitCar();
        let car = null;
        if (['speedboat', 'workboat', 'jetski'].includes(type)) {
          // Boats go on the nearest open water (spawnClearCar wants dry land).
          for (let r = 0; r < 600 && !car; r += 20)
            for (let i = 0; i < (r ? 24 : 1) && !car; i++) {
              const x = player.x + Math.cos((i * TAU) / 24) * r,
                y = player.y + Math.sin((i * TAU) / 24) * r;
              if (boatFits({ type, x, y, a: headingRadians })) car = makeCar(type, x, y, headingRadians, false);
            }
          if (!car) throw Error('No open water near the player for ' + type);
          player.swimming = false;
        } else car = spawnClearCar(type, player.x + 60, player.y, headingRadians, false);
        if (airframe) {
          car.airframe = airframe;
          car.hp = car.maxhp = vehicleSpec(car).hp;
        }
        car.authorized = true;
        enterVehicle(car);
        if (altitudeMeters > 0 && isAircraft(car)) {
          car.altitude = terrainHeight(car.x, car.y) + altitudeMeters * UNITS_PER_METRE;
          if (car.type === 'plane') {
            car.vx = Math.cos(car.a) * 295 * KMH;
            car.vy = Math.sin(car.a) * 295 * KMH;
            // Cruising: gear up, cruise power.
            car.gearDown = false;
            car.gearPos = 0;
            car.throttle = car.power = 0.75;
          }
        }
        return this.status();
      },
      // Runways, their thresholds, lights and PAPI indications, the piers and
      // where every plane is (airfields.js).
      airfields: () => airfieldReport(),
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
      // Palm Keys Beach: how busy it is and what everyone is doing (beach.js).
      beach: () => beachStatus(),
      // The Marea pool (clubpool.js): the water, the player's phase in it (dive,
      // swim, out), whether SWIM / GET OUT are offered, breath, club swimmers.
      clubPool: () => clubPoolReport(),
      // Stand on the deck at the pool's south edge (then interact() dives in).
      clubPoolEdge: () => clubPoolEdge(),
      // Club conversations (clubtalk.js): the script count by personality, the one
      // running (lines, pose), the candidate and stand timer, the bubbles on screen.
      clubTalk: () => clubTalkReport(),
      // Stand beside the nearest club-goer who can talk (standing still starts it).
      clubTalkApproach: () => clubTalkApproach(),
      // Beach volleyball (beachvolley.js): court, phase, score, ball, players, the
      // player in the match, rallies and the recent log.
      volley: () => volleyReport(),
      // Step onto the court on a side (0 west, 1 east) and join the match.
      volleyJoin: (team = 0) => volleyJoinConsole(team),
      // Lob the ball from across the net to the player in the match.
      volleyLob: () => volleyLobToPlayer(),
      // The court against the beach plan: anything laid on it or its clear zone.
      volleyCourtCheck: () => volleyCourtCheck(),
      // Marea Beach Club: phase, levels, who is where, the queue and the door,
      // the music (beachclub.js). `beachClub('trouble')` raises gunfire on its
      // dance floor as if someone fired there, for tests of the evacuation.
      beachClub(action) {
        if (action === 'trouble') {
          const p = mareaPoint(205, 140);
          notifyViolence(p, 'gunfire', null);
        }
        return beachClubReport();
      },
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
      // Fort Sentinel security: alert, lockdown, gate pieces, garrison and vehicles.
      military: () => militaryReport(),
      // The Palm Sound drawbridge (drawbridge.js): 'status', 'open' (start an opening
      // now), 'close' (bring it down, lift the arms), 'hold' with degrees (arms down,
      // leaves held there until 'close'), 'snap' with degrees (leaves there at once).
      drawbridge: (action, degrees) => drawbridgeCommand(action, degrees),
      // Put `count` traffic cars on each approach, heading onto the drawbridge.
      drawbridgeTraffic: (count) => drawbridgeSpawnTraffic(count),
      // Stand at a drawbridge viewpoint ('channel', 'west', 'east', 'north', 'south',
      // 'tower') at a zoom; returns the point and the bridge's state.
      drawbridgeLook(spot = 'channel', zoom) {
        const p = drawbridgeViewpoint(spot);
        this.look(p.x, p.y, zoom);
        return { x: Math.round(p.x), y: Math.round(p.y), ...drawbridgeReport() };
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
        bridges: BRIDGES.map((b) => ({ id: b.id, name: b.name, link: b.link, a: b.a, b: b.b, width: b.width, deck: b.deck, style: b.style, pylons: bridgePylons(b), footings: bridgeFootings(b), channels: bridgeStructure(b).channels.map(([from, to]) => [bridgePoint(b, from), bridgePoint(b, to)]) })),
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
        // Knockable street furniture as placed by the renderer (empty in 2D) and
        // the registered foot obstacles (circles r, or boxes hx/hy turned by a).
        props: streetProps.map((p) => ({ kind: p.kind, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, hx: p.hx, hy: p.hy, a: p.a })),
        footObstacles: addFootTrees() || [...new Set([...footObstacleGrid.values()].flat())].map((o) =>
          o.r !== undefined ? { x: o.x, y: o.y, r: o.r } : { x: o.x, y: o.y, hx: o.hx, hy: o.hy, a: Math.atan2(o.s, o.c) },
        ),
        streetEnds: streetEndPlan().map((e) => ({ x: e.p.x, y: e.p.y, a: e.a, width: e.width, kind: e.kind })),
        crosswalks: cityCrosswalks(),
        doors: PLACES.filter((p) => p.door).map((p) => ({ name: p.name, x: p.door.x, y: p.door.y })),
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
      // Sunset Pier: ride states, the coaster's numbers, shows, guests and an overlap check.
      themePark: () => parkReport(),
      // Monarch Isle: the plan (grid, streets, villas, towers, businesses, marina,
      // garden) and its life (monarch.js, monarch-life.js).
      monarch: () => monarchReport(),
      // Board the Falcon ('coaster') or the Sunset Eye ('wheel') from its platform.
      boardRide(kind = 'coaster') {
        rideAttraction(kind);
        return parkReport().riding;
      },
      // The Falcon riders' scream cues (track position, height, vertical speed, g) and lines; `reset` clears the log.
      coasterVoices: (reset = false) => falconVoicesReport(!!reset),
      // Speech bubbles and height: the view's height over someone on the ground at the view's centre, and their bubble's fade.
      speechView: () => speechViewReport(),
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
      // The sailing liner: where she is, her leg of the voyage, speed (units/s
      // and knots) and heading, and who is aboard.
      liners: () => {
        const ship = sailingLiner(),
          leg = LINER_VOYAGE[linerVoyage.leg];
        return {
          name: ship.name,
          x: Math.round(ship.x),
          y: Math.round(ship.y),
          heading: Math.round((((ship.a * 180) / Math.PI) % 360 + 360) % 360),
          leg: linerVoyage.leg,
          kind: leg.kind,
          along: Math.round(linerVoyage.s),
          legLength: leg.kind === 'call' ? leg.seconds : Math.round(leg.length || 0),
          speed: Math.round(ship.speed * 10) / 10,
          knots: Math.round((Math.abs(ship.speed) / KNOTS) * 10) / 10,
          playerAboard: player.deck === ship,
          passengers: (ship.passengers || []).length,
        };
      },
      // Run only the liner's voyage forward by `seconds` (1/30 s steps).
      advanceLiner(seconds = 10) {
        for (let t = 0; t < seconds; t += 1 / 30) sailLiner(1 / 30);
        return this.liners();
      },
      // Sweep the liner's hull down the whole voyage: land, bridges, jetties, ships.
      linerVoyageCheck: (step = 24) => linerVoyageCheck(step),
      // Named places the tests can visit: every PLACES entry plus the landmarks.
      places: () => PLACES.map((p) => ({ name: p.name, x: Math.round(p.x), y: Math.round(p.y) })),
      // GPS: set a map waypoint and report the route the navigation graph finds
      // from the player (status, road length, the islands it passes through).
      route(x, y) {
        setWaypoint(x, y);
        let length = 0;
        for (let i = 1; i < userRoute.length; i++) length += distanceBetween(userRoute[i - 1], userRoute[i]);
        return {
          status: routeStatus,
          points: userRoute.length,
          length: Math.round(length),
          bridges: [...new Set(userRoute.map((p) => BRIDGES.find((b) => segmentDistance(p.x, p.y, b.a, b.b) <= b.width / 2)?.id).filter(Boolean))],
          first: userRoute[0] || null,
          last: userRoute.at(-1) || null,
        };
      },
      // Board a City Rail train at station `from` bound for `to` (names, as
      // RAIL_STATIONS spells them, or indices), as the platform menu would.
      boardTrain(from = 'CRUISE TERMINAL', to = 'SOUTHPORT AIRPORT') {
        const find = (k) => (typeof k === 'number' ? RAIL_STATIONS[k] : RAIL_STATIONS.find((s) => s.name === String(k).toUpperCase()));
        const a = find(from),
          b = find(to);
        if (!a || !b || a === b) throw Error('Unknown or identical stations');
        teleportPlayer(a.entry.x, a.entry.y);
        openTransit(a);
        return { boarded: boardTransit(b), from: a.name, to: b.name, trains: this.trains() };
      },
      // Skip the current passenger ride (cab, train, the sailing liner) as the
      // skip key would: the fade starts, and the jump happens at full black
      // (simulate(2.5) runs it through). Returns rideSkip().
      skipRide() {
        rideSkipKey('skip');
        return rideSkipReport();
      },
      // On a train: move the skip to the next choice of stop (the skipStop key).
      skipStop() {
        rideSkipKey('cycle');
        return rideSkipReport();
      },
      // The skip on offer (prompt, allowed or why not, destination, fare, ride
      // seconds, the train's choices), the fade in progress, and the last skip:
      // ride seconds, game clock before / after, cash before / after, from / to.
      rideSkip: () => rideSkipReport(),
      // Set the cash in the player's pocket (fares, shops); returns it.
      setCash(dollars = 1000) {
        cash = clamp(Math.round(Number(dollars) || 0), 0, 99999999);
        return cash;
      },
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
      // Take down every police cut at once (repeatable ram tests).
      clearRoadblocks() {
        clearRoadblocks();
        return roadblocks.length;
      },
      // Set the current vehicle moving along its heading at `metersPerSecond`.
      launch(metersPerSecond = 20) {
        const c = player.car;
        if (!c) return null;
        const speed = metersPerSecond * UNITS_PER_METRE;
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
        worldZoom = worldZoomTarget = clamp(zoom, 0.14, 24);
        return worldZoom;
      },
      // Line up one pedestrian per pose in front of the player (for screenshots);
      // `role` dresses them all alike, e.g. 'commuter'.
      poseGallery: (role) => poseGallery(role),
      // One of each kind of character in a row in front of the player, facing the
      // camera (crowd.js CHARACTER LINEUP): stance 'stand', 'walk' or 'aim'.
      characterLineup: (stance, spacing) => characterLineup(stance, spacing),
      // Inspection only: look at the street from bearing `yaw` (0 = from the south,
      // as the game camera does; 90 = from the east) and `pitch` degrees above the
      // horizon, aimed `lift` units up; no arguments restores the game camera.
      inspectView: (yaw, pitch, lift) => city3D?.inspectView?.(yaw, pitch, lift),
      // What the people cost in the last frame (crowd3d.js): parts, draw calls, instances, triangles.
      crowdStats: (byPart) => city3D?.crowdStats?.(byPart) || null,
      vegetation: () => city3D?.vegetation?.() ?? null,
      treeLineup: (x = player.x, y = player.y, spacing, lod, perRow) => city3D?.treeLineup?.(x, y, spacing, lod, perRow) ?? null,
      // Pack the people `frames` times back to back: the rig's CPU cost per frame in ms.
      crowdBenchmark: (frames) => city3D?.crowdBenchmark?.(frames) ?? null,
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
      // Barrier audit (tools/layout-audit.mjs): every visible barrier line as data
      // -- the sea railing runs, the street-end guardrails, gate piers and
      // railings -- and how many foot obstacles are registered.
      barriers() {
        const rails = [];
        for (const spot of promenadeSpots())
          for (const [a, b] of spot.rail || []) {
            const { cx, cy, ux, uy } = spot.railLine;
            rails.push({ x0: cx + ux * a, y0: cy + uy * a, x1: cx + ux * b, y1: cy + uy * b, nx: spot.nx, ny: spot.ny });
          }
        addFootTrees();
        let obstacles = 0;
        for (const list of footObstacleGrid.values()) obstacles += list.length;
        return { rails, streetEnds: streetEndSolids(), streetEndPlan: streetEndPlan(), footObstacleCells: footObstacleGrid.size, footObstacleEntries: obstacles };
      },
      // solid() (and, with `foot`, the player's foot obstacles) at many points at once.
      solidAt(points, r = 1, foot = false) {
        return points.map(([x, y]) => solid(x, y, r) || (foot && footObstacleBlocked(x, y, r)));
      },
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
      // Handling: turnTest(), pose(), aiDriving(), riderReport(), rideInto(),
      // bridgeJump() (see physics.js handlingConsole).
      ...handlingConsole(),
      // Stop the frame loop's simulation (it still draws) so a screenshot sequence
      // can be stepped with simulate(); false lets it run again.
      holdSimulation(on = true) {
        simulationHeld = !!on;
        return simulationHeld;
      },
      // Sound: audioMix(), engineSound(), rainSound() (see audio.js audioConsole).
      ...audioConsole(),
      // Match day: match(), ballState(), matchDay(), fixtures(), ballToPlayer()
      // (see sports.js sportsConsole).
      ...sportsConsole(),
      // Graphics quality: 'auto', 'low', 'medium', 'high' or 'ultra' (saved like the
      // Settings choice); returns what the renderer is now using.
      graphics(tier) {
        if (tier !== undefined) cycleGraphicsSetting(String(tier).toLowerCase());
        return {
          setting: graphicsSetting,
          ...(city3D?.quality?.() || {}),
          // Sun shadows in force ('off', 'low', 'high') and the setting behind them.
          shadows: shadowQuality(),
          shadowSetting,
          // AUTO's frame-rate adaptation (quality.js ADAPTIVE QUALITY).
          adaptive: { averageFrameMs: +adaptive.average.toFixed(1), tierDrops: adaptive.tierDrops },
        };
      },
      // Police vehicle review (police3d.js): parks every police model and livery in
      // a column from (x, y), `spacing` apart, facing `heading`, with their lights
      // on (`lights`: true parked at a scene, 'pursuit' running hot, false off).
      // Parked, empty and unarmed; returns the ids and looks.
      policeLineup(x = player.x + 60, y = player.y - 160, heading = 0, lights = true, spacing = 40) {
        const LOOKS = [
          ['police', 'charger', 'bw'],
          ['police', 'utility', 'bw'],
          ['police', 'crownvic', 'bw'],
          ['police', 'charger', 'modern'],
          ['police', 'utility', 'modern'],
          ['police', 'crownvic', 'sheriff'],
          ['police', 'charger', 'unmarked'],
          ['suv', 'tahoe', 'unmarked'],
          ['van', 'bearcat', 'swat'],
        ];
        return LOOKS.map(([type, body, livery], i) => {
          const c = makeCar(type, x - Math.sin(heading) * i * spacing, y + Math.cos(heading) * i * spacing, heading, false, type === 'suv' ? '#121417' : undefined);
          Object.assign(c, { policeLook: { body, livery }, showLights: lights });
          return { id: c.id, type, body, livery };
        });
      },
      // The flagships and dirt bikes in the world (SHOWCASE PARKING and traffic):
      // id, type, where (x, y, district), the showcase place it stands at, driven or parked.
      showcase() {
        return vehicles
          .filter((c) => VEHICLE_DEFINITIONS[c.type]?.flagship || c.type === 'kr500')
          .map((c) => {
            const spot = SHOWCASE_PARKING.find((p) => Math.hypot(p.x - c.x, p.y - c.y) < 260);
            return { id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y), district: districtAt(c.x, c.y), place: spot ? spot.place : null, driven: !!c.ai };
          });
      },
      // Civilian vehicle review (cars3d.js, vehicles3d.js): parks one of each type
      // in `types` (default: every civilian car and motorbike) in a column from
      // (x, y), `spacing` apart, facing `heading`, each in its own colour (or
      // `color` for all). `lamps` true turns their lamps on as if driven
      // (`showLamps`), 'brake' holds the brake lights too. Returns ids and types.
      carLineup(types, x = player.x + 60, y = player.y - 160, heading = 0, spacing = 44, color, lamps = false) {
        const list = Array.isArray(types) && types.length ? types : CIVILIAN_LINEUP;
        let along = 0;
        return list.map((type) => {
          if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
          const spec = VEHICLE_DEFINITIONS[type],
            gap = Math.max(spacing, spec.w + 14),
            c = makeCar(type, x - Math.sin(heading) * along, y + Math.cos(heading) * along, heading, false, color || spec.color);
          along += gap;
          if (lamps) c.showLamps = lamps;
          return { id: c.id, type, name: spec.name };
        });
      },
      // Helicopter review (helicopter3d.js): parks one helicopter of each look
      // ('police', 'news', 'executive', 'military') in a row east from (x, y),
      // `spacing` apart, facing `heading`; `rotors` true spins them up (with the police lights
      // running). Returns the ids and looks.
      helicopterLineup(x = player.x + 120, y = player.y - 200, heading = 0, rotors = false, spacing = 110) {
        return ['police', 'news', 'executive', 'military'].map((heliLook, i) => {
          const c = makeCar('helicopter', x + i * spacing, y, heading, false);
          Object.assign(c, { heliLook, showRotor: !!rotors, showLights: rotors ? 'pursuit' : false });
          return { id: c.id, look: heliLook };
        });
      },
      // Every helicopter model built: look, rotor spool, draw calls, shadow casters,
      // triangles, crew shown (helicopter3d.js).
      helicopterModels: () => city3D?.helicopterModels?.() ?? null,
      // Every civilian car and motorbike model built: draw calls, shadow casters,
      // triangles and the heaviest parts (cars3d.js, motorbikes3d.js).
      carModels: () => city3D?.carModels?.() ?? null,
      // Dynamic resolution by hand (0.5..1 of the canvas; tests of the scaled scene
      // pass). On AUTO the adaptive controller may change it again.
      renderScale(scale) {
        return city3D?.setRenderScale?.(Number(scale) || 1) ?? null;
      },
      // Everything on the settings screen (settings.js), and the HUD's saved
      // state. Pass an object to change some of it, e.g. { chatter: false,
      // masterVolume: 40, minimapZoom: 2, minimapFolded: true, touch: 'on' }.
      settings(changes) {
        if (changes && typeof changes === 'object') {
          for (const { key } of AUDIO_VOLUMES)
            if (Number.isFinite(changes[key])) settings[key] = clamp(Math.round(changes[key]), 0, 100);
          if (changes.audioReset === true) resetAudioVolumes();
          if (typeof changes.chatter === 'boolean') settings.npcChatter = changes.chatter;
          if (typeof changes.cutaway === 'boolean') setCharacterCutaway(changes.cutaway);
          if (typeof changes.playerOutline === 'boolean') settings.playerOutline = changes.playerOutline;
          // 'auto', 'off', 'low' or 'high' (quality.js SHADOWS).
          if (typeof changes.shadows === 'string') setShadowSetting(changes.shadows.toLowerCase());
          if (typeof changes.sound === 'boolean' && changes.sound !== soundOn) mute();
          if (typeof changes.voices === 'boolean' && changes.voices !== voicesOn) toggleVoices();
          if (typeof changes.fps === 'boolean' && changes.fps !== fpsMeter.shown) toggleFpsCounter();
          // 30, 60, 120, or 'unlimited' (0 also means unlimited).
          if (changes.frameLimit !== undefined) setFrameLimit(changes.frameLimit === 0 ? 'unlimited' : changes.frameLimit);
          if (typeof changes.minimapFolded === 'boolean') setMinimapFolded(changes.minimapFolded);
          if (typeof changes.keyHints === 'boolean') setKeyHints(changes.keyHints);
          if (typeof changes.flightHud === 'boolean') setFlightHud(changes.flightHud);
          if (typeof changes.gps === 'boolean') setGps(changes.gps);
          // 'kmh' or 'mph' (hud.js SPEED BOX); the speed box on foot.
          if (typeof changes.units === 'string') setSpeedUnits(changes.units.toLowerCase());
          if (typeof changes.footSpeed === 'boolean') setFootSpeed(changes.footSpeed);
          if (Number.isFinite(changes.minimapZoom)) setMinimapZoom(changes.minimapZoom);
          if (typeof changes.touch === 'string') setTouchMode(changes.touch);
          applyVolumes();
          saveSettings();
          if (gameMode === 'settings') renderSettings();
          updateUI();
        }
        return {
          graphics: graphicsSetting,
          shadows: shadowSetting,
          frameLimit: frameLimit() || 'unlimited',
          fps: fpsMeter.shown,
          cutaway: settings.cutaway,
          playerOutline: settings.playerOutline,
          sound: soundOn,
          // The volume sliders (settings.js AUDIO_VOLUMES): masterVolume,
          // radioVolume, engineVolume, soundVolume (effects), voiceVolume,
          // ambienceVolume, sirenVolume.
          ...Object.fromEntries(AUDIO_VOLUMES.map((v) => [v.key, settings[v.key]])),
          voices: voicesOn,
          chatter: settings.npcChatter,
          minimapFolded: hudState.minimapFolded,
          minimapZoom: +hudState.minimapZoom.toFixed(2),
          keyHints: hudState.keyHints,
          flightHud: hudState.flightHud,
          gps: hudState.gps,
          units: hudState.units,
          footSpeed: hudState.footSpeed,
          gpsRoute: gpsRoute.points.length,
          touch: touchMode,
          screen: gameMode === 'settings' ? settingsTab : null,
        };
      },
      // The car radio and the radio box's volume row (car-radio.js RADIO VOLUME).
      radio: () => radioReport(),
      // Open the settings screen on a tab ('graphics', 'audio', 'gameplay',
      // 'controls'); during play it opens over the pause menu. Screenshot tours use it.
      openSettings(tab = 'graphics') {
        if (gameMode === 'play') togglePause();
        syncGodSettingsTab(); // GOD PANEL: 'god' is a tab while god mode is on
        openSettings(SETTINGS_TABS.some((t) => t[0] === tab) ? tab : 'graphics');
        return gameMode;
      },
      // Key bindings (controls.js) as { action: [primary, secondary] }. Pass
      // { action: 'KeyX' } to bind a primary key (a clash swaps, as the settings
      // screen offers), or 'reset' for the defaults.
      bindings(changes) {
        if (changes === 'reset') resetControlBindings();
        else if (changes && typeof changes === 'object')
          for (const [id, code] of Object.entries(changes))
            if (!bindControl(id, 0, code, true)) throw Error('cannot bind ' + id + ' to ' + code);
        return JSON.parse(JSON.stringify(controlBindings));
      },
      // Show the ambient-occlusion or bloom buffer instead of the image ('ao',
      // 'bloom'; nothing for the image) to tune the post-processing.
      postView: (mode) => city3D?.postView?.(mode) ?? null,
      // The helicopter searchlight's state, screen points and shaft / pool switches.
      searchlight: (options) => city3D?.searchlight?.(options) ?? null,
      // Scene draw calls in view by object name and by map cell (render3d.js).
      drawProfile: (top) => city3D?.drawProfile?.(top) ?? null,
      // Shadow casters near the view that the camera pass does not show.
      // What casts the sun's shadow onto the ground point (x, y).
      shadowProbe: (x, y) => city3D?.shadowProbe?.(Number(x), Number(y)) ?? null,
      // With `everywhere`, every see-through caster in the scene.
      shadowCasters: (limit, everywhere) => city3D?.shadowCasters?.(limit, !!everywhere) ?? null,
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
            renderScale: city3D?.quality?.().renderScale ?? null,
            sceneObjects: info?.objects ?? null,
            programs: info?.programs ?? null,
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
