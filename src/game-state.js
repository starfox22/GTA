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
