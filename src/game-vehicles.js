    // VEHICLE_DEFINITIONS (real sizes, masses, top speeds), vehicleSpec(), road and air resistance.
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
        brakeG: 0.75,
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
        brakeG: 1.21,
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
        brakeG: 1.25,
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
        brakeG: 0.95,
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
        brakeG: 0.95,
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
        brakeG: 1.31,
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
        brakeG: 1.12,
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
        brakeG: 1.06,
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
        brakeG: 0.97,
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
        brakeG: 0.75,
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
        brakeG: 0.9,
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
        brakeG: 1.15,
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
        brakeG: 1.14,
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
        brakeG: 1.05,
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
        brakeG: 0.99,
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
        brakeG: 1.33,
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
        brakeG: 1.12,
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
        brakeG: 1.35,
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
        brakeG: 1.38,
        cornerG: 1.85,
        tractionG: 1.15,
        turn: 2.4,
        hp: 145,
        grip: 10,
        // All-wheel drive (driving.js traction control, offroad.js).
        drive: '4x4',
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
        brakeG: 1.33,
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
        // A light single's footprint: 10.75 m long, 4.25 m across the skids and
        // stabiliser. helicopter3d.js builds every look at real size (the EC120
        // class police machine, the R44 / R66 class civilians; the UH-60 class
        // military one fitted to this footprint).
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
        brakeG: 1.18,
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
