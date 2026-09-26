      // BEGIN SUBSYSTEM: src/cars3d.js — Civilian car models
      /**
       * Civilian car models
       * Source: src/cars3d.js
       * Scope: createCityRenderer() closure (included after police3d.js, whose
       * lofting, glasshouse and livery-frame helpers it shares, and before
       * makeVehicle, which hands every civilian car type in CAR_BODIES here).
       *
       * Every car is built at its real size (VEHICLE_DEFINITIONS `l`, `w`, no
       * modelScale): 8 map units to the metre, the numbers below in metres.
       *
       * BODIES (CAR_BODIES, one per vehicle type) are real archetypes:
       *  - sedan REGENT: a mid-size saloon (Camry / Accord): swept CV_LED lamps, a
       *    wide black grille, a fastback-ish roof, a light bar across the tail;
       *  - taxi CITY CAB: a boxy full-size cab (Crown Victoria), taxi yellow with
       *    a checker band, TAXI doors, a medallion number and the lit roof sign;
       *  - coupe VOLT COUPE: a compact electric fastback (Model 3 / Polestar 2):
       *    no grille, a glass roof, flush handles, aero wheels;
       *  - muscle DUKE V8: a Challenger-style muscle car: long hood with a power
       *    bulge and twin stripes, quad round lamps with halo rings, racetrack tails;
       *  - sport COMET GT: a rear-engined 911-style coupe: round lamps, wide hips,
       *    engine-lid slats, a ducktail and a full-width light bar;
       *  - roadster SOLSTICE SPIDER: an MX-5 / Solstice two-seater, top down:
       *    cockpit, bucket seats, roll hoops, a low screen;
       *  - rally KODIAK RS: a WRX / Focus RS rally hatch: scoop, wing, flares,
       *    a rally light pod and gold wheels;
       *  - hotrod HELLFIRE CUSTOM: a chopped '32 three-window coupe: exposed
       *    blown V8 and zoomies, cycle-free front wheels, whitewalls, flames;
       *  - supercar V12 TEMPEST: a front-mid V12 grand tourer (812 / DBS);
       *  - luxury MONARCH V12: a Phantom-style limousine saloon: the temple
       *    grille, chrome everywhere, coach doors;
       *  - limousine SOVEREIGN STRETCH: a stretched Town Car;
       *  - suv RANGER 4X4: a Range Rover style SUV with the floating black roof;
       *  - pickup WORKHORSE: a crew-cab F-150: open bed, chrome bar grille;
       *  - van MULE VAN: a high-roof Transit / Sprinter panel van;
       *  - chevette CHEVETTE Z06: a C8 Z06-style mid-engined supercar;
       *  - brutini BRUTINI SVJ: an Aventador SVJ-style V12 wedge: Y lamps,
       *    hexagons, a huge wing;
       *  - cavalino CAVALINO 458: a 458 Italia-style berlinetta: the smile,
       *    boomerang lamps, round tails, triple exhaust.
       *
       * A body is lofted like the police cars' (police3d.js POLICE SHELL) but its
       * cross-section may change along the car (`sections`) and its underside
       * rises at the overhangs (profile's fourth number); the glasshouse is the
       * same five-pane contract (PANE_ORDER) with a shorter side glass
       * (`sideFrom`, where a buttress or intake takes over) or an open top.
       * Everything else is built into four merged sets per body and size:
       *  - paint: panels in the car's paint (roof, pillars, mirror caps, lips,
       *    spoilers, bed walls), sampling the livery;
       *  - trim: every other part in one draw, vertex-coloured, each vertex
       *    carrying its own roughness and metalness (`finish`) and a cell of the
       *    shared TRIM ATLAS (honeycomb, slats, mesh, carbon, louvres, plates),
       *    so gloss black, satin plastic, chrome, carbon and rubber are one mesh;
       *  - drl: the daytime running lights and other CV_LED graphics, lit while the
       *    car is driven (two shared materials swapped, no per-car material);
       *  - the four lamps (headLeft, headRight, tailLeft, tailRight), each its
       *    own mesh with the lamp contract (damage3d.js: broken lamps go dark,
       *    tail lamps swap to brakeLamp while braking, nightLights in head, tail
       *    pairs per side).
       * Tyres are a shared lathe with rounded shoulders (knobbly for the dirt
       * bike, whitewalls for the rod); rims are merged per style with the brake
       * disc; calipers sit in the trim so they do not spin with the wheel.
       *
       * LIVERY: one canvas per body (civLiveryTexture), painted in the shell's
       * UV space with the police livery frame. It is a decal layer over the
       * paint: transparent where the car shows its paint, opaque for shut
       * lines, stripes, cladding, checkers and lettering (premultiplied alpha,
       * composited in the paint shader: civPaintMaterial). Top surfaces (hood,
       * roof panel) sample it by a top projection so stripes run over them.
       * The paint is clear-coated; bright solid colours get a solid gloss,
       * darker and neutral ones a metallic flake (civFinish).
       *
       * Draw calls: shell, glass, hood, paint panels, trim, drl, four lamps, two
       * bumpers and four wheels (tyre + rim): about 21, against ~40 for the old
       * box-built cars. Zoomed out the cars pool per type (flight-view3d.js
       * BODY IMPOSTORS: shell, glass, hood, panels and trim, tinted per car).
       */
      // @include src/cars3d-materials.js
      // @include src/cars3d-geometry.js
      // @include src/cars3d-wheels.js
      // @include src/cars3d-kit.js
      // @include src/cars3d-models.js
      // @include src/cars3d-body-parts.js
      const CAR_BODIES = {
        // @include src/cars3d-bodies-a.js
        // @include src/cars3d-bodies-b.js
      };
