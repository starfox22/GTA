      // BEGIN SUBSYSTEM: src/plane3d.js — Airplane meshes
      /**
       * Airplane meshes
       * Source: src/plane3d.js
       * Scope: createCityRenderer() closure.
       * Three procedurally built airframes modelled on real types: the Serrano C200
       * courier (the mission 11 aircraft; a low-wing single turboprop with a T-tail,
       * after the Pilatus PC-12), the Aurelia J8 executive jet (T-tail, rear-mounted
       * turbofans) and the Meridian 220 narrow-body airliner (wing-mounted
       * turbofans).
       *
       * CONSTRUCTION (buildAircraft(kind, parent, options))
       *   Fuselage  lofted through the plan's stations [x, half width, top, bottom,
       *             widest height] with monotone cubic interpolation and a
       *             superellipse cross-section, then painted by a livery texture
       *             computed per pixel from the same surface (aircraftLivery): the
       *             windscreen and cockpit side glass with frames, rounded cabin
       *             windows, door seams, cheatline, belly, anti-glare panel and the
       *             registration. The texture's roughness / metalness map makes the
       *             glass glossy and the paint satin; it is cached per kind and
       *             accent colour.
       *   Surfaces  wings, stabiliser, fin, winglets and strakes are lofted NACA
       *             sections (liftingSurface); flaps, ailerons, elevators and rudder
       *             are separate parts in hinge pivots, so they deflect.
       *   Engines   a four-blade propeller with a spinner and a blur disc, cowl,
       *             exhausts and chin intake; or lathed turbofan nacelles with a lip,
       *             spinning fan, exhaust cone and pylons.
       *   Gear      struts, wheels and doors in retraction pivots (inward for the
       *             mains, aft or forward for the nose), wheels in spin pivots.
       *   Lights    red / green navigation, white tail, double-flash white strobes,
       *             red beacons, landing and taxi lights (halos).
       * Static parts are merged per material (a few draw calls per aircraft); moving
       * parts stay separate. Local +X is forward, +Z the right wing, the wheels rest
       * on y = 0 and the footprint matches AIRFRAME_SPECS (collision uses it).
       *
       * ANIMATION (animateAircraft(c, m, deltaSeconds), from render3d.js)
       *   control surfaces follow the stick and pedals (c.ctrlPitch, c.ctrlRoll,
       *   c.ctrlYaw) and the flaps c.flapPos; the gear follows c.gearPos; the
       *   propeller or fans spin with c.power; the lights run while the engine
       *   does; the airframe shakes with c.buffet. parkedJet() (world3d.js) uses the
       *   same builder for static apron aircraft.
       *
       * Everything here is a function declaration: world3d.js builds parked
       * aircraft before this fragment's constants would be initialised.
       */
      // @include src/plane3d-shapes.js
      // @include src/plane3d-build.js
      // END SUBSYSTEM: src/plane3d.js
