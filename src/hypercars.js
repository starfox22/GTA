    // BEGIN SUBSYSTEM: src/hypercars.js — The Prestige Collection: hypercar types, specs and sound
    /**
     * The Prestige Collection
     * Source: src/hypercars.js
     * Scope: shared game closure (after offroad.js: it extends VEHICLE_DEFINITIONS,
     * ENGINE_SETS, ENGINE_OF_TYPE and damage.js CAR_GLASS_BANDS the same way).
     *
     * The cars MONARCH MOTORS sells (dealership.js), each a parody of a real
     * hypercar or grand tourer, specified like every road vehicle (game.js ROAD
     * PERFORMANCE: real length, width, kerb mass, top speed, 0-100, brakes,
     * cornering and traction) and built at real size by hypercars3d.js
     * (`modelScale` 1, CAR_BODIES entries in the renderer).
     *
     *   WALTER MARTIN VALKYRIE     V12 hypercar: open venturi tunnels, teardrop
     *                              canopy, 11,100 rpm; light, low and twitchy.
     *   WALTER MARTIN DBS SUPERLEGGERA  twin-turbo V12 front-engined grand tourer.
     *   CHEVETTE ZR1X              twin-turbo flat-plane V8 plus a front e-axle:
     *                              all-wheel drive, the quickest off the line.
     *   CHEVETTE Z06 CARBON AERO   the Z06 in its carbon aero edition (Z07 pack).
     *   MUGATTI WAYRON SUPER SPORT W16 quad-turbo, horseshoe grille, C-line,
     *                              two-tone paint; all-wheel drive, 430 flat out.
     *   MUGATTI TOURBILLON         V16 hybrid: 1,800 PS, 445 km/h.
     *   KONIGSBERG JASKO ABSOLUT   twin-turbo V8 on E85, low-drag long tail with
     *                              twin fins: the fastest car in the room.
     *   PAGANO SIROCCO             twin-turbo V12, carbo-titanium, quad pipes.
     *   RIMAK NOVERA               four motors, 1,914 hp, the fastest 0-100.
     *   McLOWEN W1                 twin-turbo V8 hybrid, active aero.
     *   CAVALINO LA FERA           V12 hybrid, the prancing flagship.
     *   (and the BRUTINI SVJ from game.js, sold new.)
     *
     * PRESTIGE_CATALOG holds what the showroom's cards and the purchase menu say
     * about each: marque, blurb, power, torque, engine, drivetrain, weight, the
     * price and the paint choices. Performance numbers on the card are the
     * spec's; `DeadEndCity.accelTest(type)` measures them in the game.
     *
     * SOUND. Each car gets an engine set built from the recorded loops
     * (ENGINE_SETS: V12 hypercar, twin-turbo V12, W16, V16 hybrid, twin-turbo
     * V8, electric) and, on top, a synthesised voice (updateHypercarVoice): the
     * turbos' whistle and the wastegate's chuff on a lift, the hybrid motors'
     * whine rising with speed; the electric car is only that whine and the road.
     */
    const HC_M = UNITS_PER_METRE;
    const PRESTIGE_TYPES = {
      valkyrie: {
        // 4.51 m, 1.92 m body (camera mirrors), 1.07 m tall, 1.27 t: a road-legal
        // Le Mans prototype. The lightest here and the most nervous at the limit.
        name: 'WALTER MARTIN VALKYRIE',
        l: 4.51 * HC_M,
        w: 2.2 * HC_M,
        mass: 1.27,
        topKmh: 355,
        zeroTo: [100, 2.5],
        brakeG: 1.6,
        cornerG: 2.2,
        tractionG: 1.25,
        turn: 2.9,
        balance: 0.5,
        hp: 150,
        grip: 10.5,
        color: '#0b4d3b',
        palette: ['#0b4d3b', '#b6bcc2', '#121316', '#eeeeea', '#1e3f73'],
      },
      dbs: {
        // 4.71 m, 1.97 m body, 1.28 m tall, 1.85 t: a front-engined V12 grand tourer.
        name: 'WALTER MARTIN DBS SUPERLEGGERA',
        l: 4.71 * HC_M,
        w: 2.26 * HC_M,
        mass: 1.85,
        topKmh: 340,
        zeroTo: [100, 3.4],
        brakeG: 1.2,
        cornerG: 1.6,
        tractionG: 0.95,
        turn: 2.2,
        balance: 0.3,
        hp: 160,
        grip: 9,
        color: '#5a6066',
        palette: ['#0b4d3b', '#5a6066', '#c3c8cc', '#111826', '#9e1b1f', '#eeeeea'],
      },
      zr1x: {
        // 4.69 m, 2.02 m body, 1.23 m tall, 1.8 t: the twin-turbo V8 plus a front
        // electric axle, all-wheel drive: nothing leaves the line harder but the Novera.
        name: 'CHEVETTE ZR1X',
        l: 4.69 * HC_M,
        w: 2.32 * HC_M,
        mass: 1.8,
        topKmh: 375,
        zeroTo: [100, 2.0],
        brakeG: 1.35,
        cornerG: 1.9,
        tractionG: 1.55,
        turn: 2.5,
        balance: 0.15,
        hp: 150,
        grip: 10,
        drive: 'awd',
        color: '#f06a12',
        palette: ['#f06a12', '#5e6368', '#c8102e', '#f2c21b', '#eeeeea', '#16181b'],
      },
      chevetteSE: {
        // The Z06 in the carbon aero edition: carbon wing, splitter and wheels, the
        // stickier tyres and carbon-ceramic brakes of the track pack.
        name: 'CHEVETTE Z06 CARBON AERO',
        l: 4.69 * HC_M,
        w: 2.32 * HC_M,
        mass: 1.58,
        topKmh: 312,
        zeroTo: [100, 2.6],
        brakeG: 1.4,
        cornerG: 1.95,
        tractionG: 1.22,
        turn: 2.6,
        balance: 0.25,
        hp: 145,
        grip: 10,
        color: '#f2c21b',
        palette: ['#f2c21b', '#1f5fc2', '#f37021', '#c8102e', '#b9bec3', '#1b1c1f'],
      },
      wayron: {
        // 4.46 m, 2.0 m body, 1.19 m tall, 1.84 t, all-wheel drive: the W16's four
        // turbos push it on to 431 km/h. Heavy and planted: it pushes wide before
        // the tail ever moves.
        name: 'MUGATTI WAYRON SUPER SPORT',
        l: 4.46 * HC_M,
        w: 2.3 * HC_M,
        mass: 1.84,
        topKmh: 431,
        zeroTo: [100, 2.4],
        brakeG: 1.35,
        cornerG: 1.7,
        tractionG: 1.5,
        turn: 2.1,
        balance: -0.15,
        hp: 170,
        grip: 10,
        drive: 'awd',
        color: '#e8641b',
        palette: ['#e8641b', '#0d3b8c', '#eeeeea', '#8f1a1f', '#c3c7cc', '#1d1f22'],
      },
      tourbillon: {
        // 4.67 m, 2.05 m body, 1.19 m tall, 2.0 t: the V16 and three motors, 1,800 PS.
        name: 'MUGATTI TOURBILLON',
        l: 4.67 * HC_M,
        w: 2.36 * HC_M,
        mass: 2.0,
        topKmh: 445,
        zeroTo: [100, 2.0],
        brakeG: 1.45,
        cornerG: 1.85,
        tractionG: 1.6,
        turn: 2.2,
        balance: 0,
        hp: 175,
        grip: 10.5,
        drive: 'awd',
        color: '#1b2c55',
        palette: ['#1b2c55', '#c3c7cc', '#8f1a1f', '#e8e4da', '#15171a', '#2f6b5a'],
      },
      jasko: {
        // 4.61 m, 2.03 m body, 1.21 m tall, 1.39 t: the low-drag long tail. On E85
        // the V8 makes 1,600 hp and nothing here goes faster.
        name: 'KONIGSBERG JASKO ABSOLUT',
        l: 4.61 * HC_M,
        w: 2.33 * HC_M,
        mass: 1.39,
        topKmh: 480,
        zeroTo: [100, 2.5],
        brakeG: 1.4,
        cornerG: 1.85,
        tractionG: 1.3,
        turn: 2.4,
        balance: 0.3,
        hp: 150,
        grip: 10,
        color: '#f0f0ec',
        palette: ['#f0f0ec', '#ee6a1a', '#b9bec3', '#3a3d41', '#1f4f9a'],
      },
      sirocco: {
        // 4.6 m, 2.04 m body, 1.17 m tall, 1.28 t: carbo-titanium and a twin-turbo V12.
        name: 'PAGANO SIROCCO',
        l: 4.6 * HC_M,
        w: 2.34 * HC_M,
        mass: 1.28,
        topKmh: 350,
        zeroTo: [100, 2.8],
        brakeG: 1.35,
        cornerG: 1.85,
        tractionG: 1.15,
        turn: 2.5,
        balance: 0.35,
        hp: 150,
        grip: 10,
        color: '#0e3a73',
        palette: ['#0e3a73', '#b8964e', '#eeeeea', '#1e5a3a', '#6b1d22', '#202226'],
      },
      novera: {
        // 4.75 m, 1.99 m body, 1.21 m tall, 2.3 t: four motors, 1,914 hp and torque
        // vectoring: the quickest from rest in the game.
        name: 'RIMAK NOVERA',
        l: 4.75 * HC_M,
        w: 2.28 * HC_M,
        mass: 2.3,
        topKmh: 412,
        zeroTo: [100, 1.85],
        brakeG: 1.35,
        cornerG: 1.8,
        tractionG: 1.8,
        turn: 2.3,
        balance: 0,
        hp: 165,
        grip: 10,
        drive: 'awd',
        electric: true,
        color: '#2c4a6b',
        palette: ['#2c4a6b', '#8d9296', '#eeeeea', '#e2b21c', '#16181b'],
      },
      w1: {
        // 4.64 m, 2.04 m body, 1.18 m tall, 1.4 t: twin-turbo V8 hybrid, active aero.
        name: 'McLOWEN W1',
        l: 4.64 * HC_M,
        w: 2.34 * HC_M,
        mass: 1.4,
        topKmh: 350,
        zeroTo: [100, 2.7],
        brakeG: 1.45,
        cornerG: 2.0,
        tractionG: 1.2,
        turn: 2.6,
        balance: 0.3,
        hp: 150,
        grip: 10.5,
        color: '#ff7a1a',
        palette: ['#ff7a1a', '#b9bec3', '#121316', '#1c5bd6', '#eeeeea'],
      },
      lafera: {
        // 4.7 m, 1.99 m body, 1.12 m tall, 1.45 t: the V12 hybrid flagship.
        name: 'CAVALINO LA FERA',
        l: 4.7 * HC_M,
        w: 2.29 * HC_M,
        mass: 1.45,
        topKmh: 350,
        zeroTo: [100, 2.4],
        brakeG: 1.4,
        cornerG: 1.9,
        tractionG: 1.2,
        turn: 2.6,
        balance: 0.35,
        hp: 150,
        grip: 10,
        color: '#c8141c',
        palette: ['#c8141c', '#c8141c', '#f2c500', '#121214', '#eeeeea'],
      },
    };
    for (const [type, spec] of Object.entries(PRESTIGE_TYPES)) {
      // Built at real size (hypercars3d.js).
      spec.modelScale = 1;
      spec.flagship = true;
      spec.prestige = true;
      VEHICLE_DEFINITIONS[type] = spec;
      roadPerformance(spec);
    }
    // In the console's carLineup() with the other flagships.
    CIVILIAN_LINEUP.push(...Object.keys(PRESTIGE_TYPES));
    // Their glasshouses, in the numbers hypercars3d.js builds them with (damage.js).
    Object.assign(CAR_GLASS_BANDS, {
      valkyrie: [0.72, 1.06, -0.3, 0.2],
      dbs: [0.93, 1.26, -0.38, 0.1],
      zr1x: [0.88, 1.22, -0.42, 0.13],
      chevetteSE: [0.88, 1.22, -0.42, 0.13],
      wayron: [0.86, 1.18, -0.2, 0.18],
      tourbillon: [0.86, 1.18, -0.22, 0.18],
      jasko: [0.86, 1.2, -0.2, 0.2],
      sirocco: [0.84, 1.16, -0.2, 0.19],
      novera: [0.88, 1.2, -0.22, 0.18],
      w1: [0.84, 1.17, -0.22, 0.2],
      lafera: [0.82, 1.12, -0.18, 0.2],
    });
    /**
     * ENGINES. Sets from the recorded loops (engine-audio.js ENGINE_SETS) with
     * the revs each class really runs to, and flags for the synthesised voice:
     * `turbo` (whistle and wastegate chuff), `hybrid` (a motor whine under the
     * engine), `electric` (the whine alone; the loops are kept almost silent).
     */
    Object.assign(ENGINE_SETS, {
      // The Cosworth V12: the sport loops run up to 11,100 rpm through seven quick shifts.
      v12hyper: { layers: [['engine-sport-idle', 654], ['engine-sport-low', 2330], ['engine-sport-mid', 3012], ['engine-compact-high', 4900], ['engine-sport-high', 7800]], idle: 1100, shift: 10600, redline: 11100, gears: 7, level: 1.25, burble: 1.4, hybrid: 0.5 },
      // Twin-turbo V12s: the V8's weight low down, the six's rasp up to 7,000 rpm, turbo whistle.
      v12tt: { layers: [['engine-v8-idle', 657], ['engine-v8-low', 1722], ['engine-sport-mid', 3012], ['engine-compact-high', 4900], ['engine-sport-high', 7800]], idle: 850, shift: 6600, redline: 7100, gears: 8, level: 1.2, burble: 1.2, turbo: 1 },
      // The W16: the V8's loops dropped deep (a slow, heavy firing beat) with four turbos on top.
      w16: { layers: [['engine-v8-idle', 657], ['engine-v8-low', 1722], ['engine-v8-mid', 2316], ['engine-sport-mid', 3012], ['engine-compact-high', 4900]], idle: 800, shift: 6400, redline: 6800, gears: 7, level: 1.3, burble: 0.8, turbo: 1.4 },
      // The V16 hybrid: the V12's loops lower and smoother, the motors' whine under them.
      v16: { layers: [['engine-sport-idle', 654], ['engine-sport-low', 2330], ['engine-sport-mid', 3012], ['engine-compact-high', 4900], ['engine-sport-high', 7800]], idle: 950, shift: 8700, redline: 9000, gears: 8, level: 1.25, burble: 0.9, hybrid: 0.8 },
      // Twin-turbo V8s (the Konigsberg, the McLowen): flat-plane rasp, big whistle.
      v8tt: { layers: [['engine-v8-idle', 657], ['engine-v8-low', 1722], ['engine-sport-mid', 3012], ['engine-compact-high', 4900], ['engine-sport-high', 7800]], idle: 950, shift: 8000, redline: 8500, gears: 9, level: 1.2, burble: 1.6, turbo: 1.2 },
      // Four motors and a single speed: the loops are a faint mechanical bed under the whine.
      electric: { layers: [['engine-compact-idle', 880], ['engine-compact-low', 2640]], idle: 900, shift: 99999, redline: 2600, gears: 1, level: 0.05, electric: 1 },
    });
    Object.assign(ENGINE_OF_TYPE, {
      valkyrie: ['v12hyper', 1.08, 1.2],
      dbs: ['v12tt', 0.98, 1.05],
      zr1x: ['v8tt', 0.94, 1.15],
      chevetteSE: ['flatplane', 0.98, 1.12],
      wayron: ['w16', 0.86, 1.2],
      tourbillon: ['v16', 0.92, 1.15],
      jasko: ['v8tt', 1.02, 1.15],
      sirocco: ['v12tt', 1.04, 1.1],
      novera: ['electric', 1, 1],
      w1: ['v8tt', 1.06, 1.1],
      lafera: ['v12', 1.14, 1.15],
    });
    /**
     * THE CATALOGUE: what the cards and the purchase menu say. Prices in dollars
     * (new, on the road); `hp` and `torque` (Nm) are the makers' figures.
     * `paints` are [name, colour] swatches; the first is the car on display.
     */
    const PRESTIGE_CATALOG = [
      {
        type: 'valkyrie',
        marque: 'WALTER MARTIN',
        model: 'VALKYRIE',
        tier: 'hypercar',
        price: 3200000,
        hp: 1160,
        torque: 900,
        engine: '6.5 L V12 · hybrid · 11,100 rpm',
        drivetrain: 'Rear-wheel drive · 7-speed',
        blurb: 'A Le Mans prototype with number plates. Open venturi tunnels under a teardrop canopy make more downforce than the car weighs; the naturally aspirated V12 screams to 11,100 rpm.',
        paints: [['Walter Racing Green', '#0b4d3b'], ['Lunar Silver', '#b6bcc2'], ['Carbon Black', '#121316'], ['Stratus White', '#eeeeea'], ['Midnight Blue', '#1e3f73']],
      },
      {
        type: 'dbs',
        marque: 'WALTER MARTIN',
        model: 'DBS SUPERLEGGERA',
        tier: 'gt',
        price: 335000,
        hp: 715,
        torque: 900,
        engine: '5.2 L twin-turbo V12',
        drivetrain: 'Rear-wheel drive · 8-speed',
        blurb: 'The brute in a Savile Row suit. A carbon body over a twin-turbo V12 with 900 Nm from 1,800 rpm: London to Monaco on one tank, and 340 km/h when you arrive.',
        paints: [['Xenon Grey', '#5a6066'], ['Walter Racing Green', '#0b4d3b'], ['Magnetic Silver', '#c3c8cc'], ['Ultramarine Black', '#111826'], ['Hyper Red', '#9e1b1f'], ['Stratus White', '#eeeeea']],
      },
      {
        type: 'zr1x',
        marque: 'CHEVETTE',
        model: 'ZR1X',
        tier: 'hypercar',
        price: 225000,
        hp: 1250,
        torque: 1340,
        engine: '5.5 L twin-turbo flat-plane V8 + front e-axle',
        drivetrain: 'All-wheel drive · 8-speed DCT',
        blurb: 'America’s hypercar. The twin-turbo flat-plane V8 drives the rear wheels, an electric motor the front: 1,250 horsepower, under two seconds to 100 and 375 km/h, for a fraction of the Europeans’ money.',
        paints: [['Sebring Orange', '#f06a12'], ['Hypersonic Grey', '#5e6368'], ['Torch Red', '#c8102e'], ['Competition Yellow', '#f2c21b'], ['Arctic White', '#eeeeea'], ['Black', '#16181b']],
      },
      {
        type: 'chevetteSE',
        marque: 'CHEVETTE',
        model: 'Z06 CARBON AERO',
        tier: 'supercar',
        price: 165000,
        hp: 670,
        torque: 623,
        engine: '5.5 L flat-plane V8 · 8,600 rpm',
        drivetrain: 'Rear-wheel drive · 8-speed DCT',
        blurb: 'The Z06 with the track pack: carbon wing and splitter, carbon wheels, carbon-ceramic brakes and the stickiest tyres. The biggest naturally aspirated V8 ever put in a production car.',
        paints: [['Accelerate Yellow', '#f2c21b'], ['Rapid Blue', '#1f5fc2'], ['Amplify Orange', '#f37021'], ['Torch Red', '#c8102e'], ['Silver Flare', '#b9bec3'], ['Carbon Flash', '#1b1c1f']],
      },
      {
        type: 'wayron',
        marque: 'MUGATTI',
        model: 'WAYRON SUPER SPORT',
        tier: 'hypercar',
        price: 2700000,
        hp: 1184,
        torque: 1500,
        engine: '8.0 L W16 · four turbochargers',
        drivetrain: 'All-wheel drive · 7-speed DCT',
        blurb: 'Sixteen cylinders, four turbos, ten radiators. The car that made 430 km/h a production number: the horseshoe grille, the sweep of the C-line and the two-tone paint are how you know it at a glance.',
        paints: [['Black Carbon · Orange', '#e8641b'], ['Black Carbon · Mugatti Blue', '#0d3b8c'], ['Black Carbon · White', '#eeeeea'], ['Black Carbon · Rouge', '#8f1a1f'], ['Black Carbon · Silver', '#c3c7cc'], ['All Carbon', '#1d1f22']],
      },
      {
        type: 'tourbillon',
        marque: 'MUGATTI',
        model: 'TOURBILLON',
        tier: 'hypercar',
        price: 4100000,
        hp: 1775,
        torque: 1650,
        engine: '8.3 L V16 · three electric motors',
        drivetrain: 'All-wheel drive · 8-speed DCT',
        blurb: 'A naturally aspirated V16 and three motors: 1,800 PS, 445 km/h, and an instrument cluster made by watchmakers. The most expensive car in the room, and it knows it.',
        paints: [['Nocturne Blue', '#1b2c55'], ['Argent', '#c3c7cc'], ['Rouge Profond', '#8f1a1f'], ['Ivoire', '#e8e4da'], ['Noir', '#15171a'], ['Vert Racing', '#2f6b5a']],
      },
      {
        type: 'jasko',
        marque: 'KONIGSBERG',
        model: 'JASKO ABSOLUT',
        tier: 'hypercar',
        price: 3400000,
        hp: 1600,
        torque: 1500,
        engine: '5.0 L twin-turbo V8 · E85',
        drivetrain: 'Rear-wheel drive · 9-speed multi-clutch',
        blurb: 'Built for one thing: the top speed. The low-drag long tail trades the wing for twin fins, and on E85 the flat-plane V8 makes 1,600 hp. The fastest car in the showroom, by some distance.',
        paints: [['Absolut White', '#f0f0ec'], ['Tang Orange', '#ee6a1a'], ['Moonlight Silver', '#b9bec3'], ['Graphite', '#3a3d41'], ['Swedish Blue', '#1f4f9a']],
      },
      {
        type: 'sirocco',
        marque: 'PAGANO',
        model: 'SIROCCO',
        tier: 'hypercar',
        price: 3100000,
        hp: 864,
        torque: 1100,
        engine: '6.0 L twin-turbo V12',
        drivetrain: 'Rear-wheel drive · 7-speed manual or AMT',
        blurb: 'Art you can drive. Carbo-titanium weave everywhere, a machined gear lever you can actually use, and the four pipes in a circle that everyone photographs.',
        paints: [['Blu Tricolore', '#0e3a73'], ['Oro Antico', '#b8964e'], ['Bianco Perla', '#eeeeea'], ['Verde Smeraldo', '#1e5a3a'], ['Rosso Vino', '#6b1d22'], ['Carbonio', '#202226']],
      },
      {
        type: 'novera',
        marque: 'RIMAK',
        model: 'NOVERA',
        tier: 'hypercar',
        price: 2200000,
        hp: 1914,
        torque: 2360,
        engine: 'Four electric motors · 120 kWh',
        drivetrain: 'All-wheel drive · torque vectoring',
        blurb: 'Four motors, one for each wheel, and 1,914 horsepower. It does 0-100 in 1.85 seconds and 412 km/h in near silence. The quickest thing you will ever sit in.',
        paints: [['Novera Blue', '#2c4a6b'], ['Magnesium', '#8d9296'], ['Glacier White', '#eeeeea'], ['Zagreb Gold', '#e2b21c'], ['Exposed Carbon', '#16181b']],
      },
      {
        type: 'w1',
        marque: 'McLOWEN',
        model: 'W1',
        tier: 'hypercar',
        price: 2100000,
        hp: 1258,
        torque: 1340,
        engine: '4.0 L twin-turbo V8 · hybrid',
        drivetrain: 'Rear-wheel drive · 8-speed DCT',
        blurb: 'Formula One thinking for the road: ground effect, an active wing that moves on its own, and a twin-turbo V8 hybrid with 1,258 hp in a car that weighs 1.4 tonnes.',
        paints: [['Papaya Spark', '#ff7a1a'], ['Mercury Silver', '#b9bec3'], ['Onyx Black', '#121316'], ['Aurora Blue', '#1c5bd6'], ['Glacier White', '#eeeeea']],
      },
      {
        type: 'lafera',
        marque: 'CAVALINO',
        model: 'LA FERA',
        tier: 'hypercar',
        price: 3000000,
        hp: 950,
        torque: 900,
        engine: '6.3 L V12 · HY-KERS hybrid',
        drivetrain: 'Rear-wheel drive · 7-speed DCT',
        blurb: 'The prancing horse’s own hypercar: a V12 at 9,250 rpm with a Formula One energy recovery system, in a body that was drawn in the wind tunnel. Red, obviously.',
        paints: [['Rosso Corsa', '#c8141c'], ['Giallo Modena', '#f2c500'], ['Nero Daytona', '#121214'], ['Bianco Avus', '#eeeeea']],
      },
      {
        type: 'brutini',
        marque: 'BRUTINI',
        model: 'SVJ',
        tier: 'supercar',
        price: 520000,
        hp: 759,
        torque: 720,
        engine: '6.5 L V12 · 8,700 rpm',
        drivetrain: 'All-wheel drive · 7-speed ISR',
        blurb: 'The last of the pure V12 wedges: active aero that vectors downforce from side to side, a wing like a bookshelf and a sound you feel in your fillings.',
        paints: [['Verde Mantis', '#7ac231'], ['Arancio', '#f58a07'], ['Giallo', '#e9c21e'], ['Nero', '#15171a'], ['Bianco', '#eceeed'], ['Viola', '#6b2d8c']],
      },
    ];
    const PRESTIGE_BY_TYPE = new Map(PRESTIGE_CATALOG.map((item) => [item.type, item]));
    // A card's performance numbers, from the spec the physics uses.
    function prestigeFigures(item) {
      const spec = VEHICLE_DEFINITIONS[item.type];
      return {
        ...item,
        name: spec.name,
        topKmh: spec.topKmh,
        zeroTo100: spec.zeroTo[1],
        massKg: Math.round(spec.mass * 1000),
        lengthM: +(spec.l / UNITS_PER_METRE).toFixed(2),
      };
    }
    // Money as the showroom writes it: $3,200,000 or $3.2M for the placards.
    function prestigePrice(dollars, short = false) {
      if (short && dollars >= 1e6) return '$' + (dollars / 1e6).toFixed(dollars % 1e5 ? 2 : 1).replace(/\.?0+$/, '') + 'M';
      return '$' + Math.round(dollars).toLocaleString('en-US');
    }
    /**
     * THE SYNTHESISED VOICE on top of the recorded loops, for the player's
     * prestige car: turbo whistle (rising with revs and load, a wastegate chuff
     * when the throttle lifts at high boost), a hybrid motor whine that follows
     * the road speed, and for the electric car the whine alone (two partials and
     * a gear-mesh harmonic) with a soft inverter hiss.
     */
    const hypercarVoice = { nodes: null, boost: 0, lastThrottle: 0 };
    function buildHypercarVoice() {
      if (hypercarVoice.nodes || !audio || !engineBus) return hypercarVoice.nodes;
      try {
        const whistle = audio.createOscillator(),
          whistle2 = audio.createOscillator(),
          whistleGain = audio.createGain(),
          whine = audio.createOscillator(),
          whineHarmonic = audio.createOscillator(),
          whineFilter = audio.createBiquadFilter(),
          whineGain = audio.createGain(),
          hiss = audio.createBufferSource(),
          hissFilter = audio.createBiquadFilter(),
          hissGain = audio.createGain();
        whistle.type = 'sine';
        whistle2.type = 'sine';
        whine.type = 'sawtooth';
        whineHarmonic.type = 'triangle';
        whineFilter.type = 'bandpass';
        whineFilter.Q.value = 3;
        hissFilter.type = 'highpass';
        hissFilter.frequency.value = 5200;
        const n = audio.sampleRate,
          buffer = audio.createBuffer(1, n, audio.sampleRate),
          data = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
        hiss.buffer = buffer;
        hiss.loop = true;
        for (const g of [whistleGain, whineGain, hissGain]) g.gain.value = 0;
        whistle.connect(whistleGain);
        whistle2.connect(whistleGain);
        whistleGain.connect(engineBus);
        whine.connect(whineFilter);
        whineHarmonic.connect(whineFilter);
        whineFilter.connect(whineGain).connect(engineBus);
        hiss.connect(hissFilter).connect(hissGain).connect(engineBus);
        whistle.start();
        whistle2.start();
        whine.start();
        whineHarmonic.start();
        hiss.start();
        hypercarVoice.nodes = { whistle, whistle2, whistleGain, whine, whineHarmonic, whineFilter, whineGain, hissGain };
      } catch {
        hypercarVoice.nodes = null;
      }
      return hypercarVoice.nodes;
    }
    // A short breath of noise through a band-pass: the wastegate or blow-off valve.
    function hypercarChuff(level) {
      const now = audio.currentTime,
        n = Math.floor(audio.sampleRate * 0.32),
        buffer = audio.createBuffer(1, n, audio.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * (0.6 + 0.4 * Math.sin(t * 90));
      }
      const source = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        gain = audio.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = randomBetween(1900, 2600);
      filter.Q.value = 1.1;
      gain.gain.value = level;
      source.connect(filter).connect(gain).connect(engineBus);
      source.start(now);
    }
    function updateHypercarVoice(deltaSeconds) {
      const car = player.car,
        tuning = car ? ENGINE_OF_TYPE[car.type] : null,
        set = tuning ? ENGINE_SETS[tuning[0]] : null,
        voiced = !!set && (set.turbo || set.hybrid || set.electric),
        on = gameMode === 'play' && soundOn && voiced && car.hp > 0;
      if (!audio || (!on && !hypercarVoice.nodes)) return;
      const v = buildHypercarVoice();
      if (!v) return;
      const now = audio.currentTime,
        a = engineAudio,
        rpm = a && a.car === car ? a.rpm : 0,
        throttle = a ? a.throttle : 0,
        speed = car ? Math.hypot(car.vx || 0, car.vy || 0) : 0,
        top = car ? vehicleSpec(car).max || 400 : 400,
        rpmNorm = set ? clamp((rpm - set.idle) / Math.max(1, set.redline - set.idle), 0, 1) : 0;
      // Boost builds with revs under load and bleeds off when the throttle lifts.
      const target = on && set.turbo ? clamp(throttle * (rpmNorm * 1.3 - 0.1), 0, 1) : 0;
      hypercarVoice.boost += (target - hypercarVoice.boost) * Math.min(1, deltaSeconds * (target > hypercarVoice.boost ? 2.2 : 7));
      if (on && set.turbo && hypercarVoice.lastThrottle > 0.7 && throttle < 0.35 && hypercarVoice.boost > 0.35) hypercarChuff(0.05 * set.turbo * hypercarVoice.boost);
      hypercarVoice.lastThrottle = throttle;
      const boost = hypercarVoice.boost,
        turbo = on && set.turbo ? set.turbo : 0;
      glideParam(v.whistle.frequency, 2400 + 5200 * boost, now, 0.12);
      glideParam(v.whistle2.frequency, 3700 + 7300 * boost, now, 0.12);
      glideParam(v.whistleGain.gain, turbo * boost * boost * 0.012, now, 0.1);
      // Motors: pitch with the road speed (a fixed reduction), louder under load.
      const motor = on ? (set.electric ? 1 : set.hybrid || 0) : 0,
        ratio = clamp(speed / top, 0, 1.1),
        pitch = 140 + ratio * (set?.electric ? 2300 : 1500);
      glideParam(v.whine.frequency, pitch, now, 0.06);
      glideParam(v.whineHarmonic.frequency, pitch * 2.02, now, 0.06);
      glideParam(v.whineFilter.frequency, pitch * 1.5, now, 0.08);
      glideParam(v.whineGain.gain, motor * (0.006 + 0.03 * (0.35 + 0.65 * throttle) * Math.min(1, ratio * 4)) * (set?.electric ? 1.6 : 1), now, 0.08);
      glideParam(v.hissGain.gain, on && set.electric ? 0.004 + 0.008 * throttle * Math.min(1, ratio * 3) : 0, now, 0.1);
    }
    // END SUBSYSTEM: src/hypercars.js
