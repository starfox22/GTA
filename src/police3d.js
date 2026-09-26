      // BEGIN SUBSYSTEM: src/police3d.js — Police vehicle models
      /**
       * Police vehicle models
       * Source: src/police3d.js
       * Scope: createCityRenderer() closure (included after vehicles3d.js, before makeVehicle).
       *
       * Every police vehicle is built here: patrol cars (`type === 'police'`, the
       * roadblock cruisers included), the SWAT truck (`lawUnit === 'swat'`, a 'van'
       * underneath) and the agents' SUVs (`lawUnit === 'fed'`, a 'suv'). The
       * collision sizes are the vehicle types' own (vehicleSpec); nothing here
       * changes the physics.
       *
       * Bodies (POLICE_BODIES), modern US police vehicles:
       *  - charger: a pursuit sedan after the Dodge Charger Pursuit (long hood,
       *    fastback glass, full-width LED tail lamps, spoiler lip);
       *  - utility: the Police Interceptor Utility (Ford Explorer): tall glass,
       *    upright tailgate, roof rails;
       *  - crownvic: a Crown Victoria style notchback: upright glass, long trunk,
       *    chrome trim, dog-dish hubcaps;
       *  - tahoe: the agents' full-size SUV;
       *  - bearcat: the SWAT unit's armoured truck after a Lenco BearCat: slab
       *    armour, small thick windows, roof hatch with a turret ring and shield
       *    plates, a ram bumper, gun ports and hinged rear doors.
       * Each body has its own lofted shell (POLICE SHELL: bevelled sections along a
       * profile, flared over the wheels, the same deformable contract as the
       * generic car shell: damage3d.js crumples it) and a curved glasshouse
       * (panes in PANE_ORDER, so each pane still cracks and bursts on its own).
       *
       * Liveries (policeLiveryTexture) are one canvas per livery and body, painted
       * in the shell's UV space (u along the car, v round the section; the bottom
       * eighth holds solid swatches that the hood, roof, pillars, door and trunk
       * panels sample): 'bw' (black and white, SOUTH COAST POLICE, gold star),
       * 'modern' (white with a navy and sky-blue swoosh and a reflective line),
       * 'sheriff' (the county's green and white, SHERIFF) and 'swat' (navy). The
       * unit number is painted big on the roof, as real aerial ID numbers are, and
       * small on the trunk and rear fenders, from one glyph atlas (POLICE DECALS).
       * One in nine city patrol units is an unmarked car in a dark colour with
       * dash, grille and rear-deck lights only; agents' SUVs are unmarked too.
       *
       * Draw calls: each model is merged per material (livery paint, trim, bright
       * metal, lights, number decals) on top of the parts the damage model moves
       * (shell, glasshouse, hood, bumpers, four lamps, four wheels): about 22
       * draws, against 26 for the old box-built cruiser. Zoomed out, all police
       * vehicles of one body and livery share instanced body impostors, lightbar
       * beacons included (flight-view3d.js BODY IMPOSTORS).
       *
       * Lights (POLICE LIGHTS): every emitter of a model (lightbar segments,
       * takedowns and alley lights, push-bar and grille LEDs, the rear window bar,
       * dash lights, running lights) is one mesh with a light channel per vertex;
       * a small shader looks its level up in the model's eight channel levels.
       * policeLightLevels() writes those levels from the flash pattern: side to side
       * quad flashes, criss-cross double flashes and a sweep, cycling every few
       * seconds in a pursuit; a slow alternation with steady white takedowns when
       * parked at a scene (a roadblock). Responding cars wig-wag their headlamps.
       * At night the lit segments add halos (VEHICLE HALOS) and red and blue pools
       * on the road (lighting3d.js DRIVE LIGHT MAP). Nothing allocates per frame.
       */
      // @include src/police3d-looks.js
      // @include src/police3d-cabins.js
      // @include src/police3d-kits.js
      // END SUBSYSTEM: src/police3d.js
