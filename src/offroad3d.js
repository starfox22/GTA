      // BEGIN SUBSYSTEM: src/offroad3d.js — 4x4 club trucks, the club lot, trail props and mud
      /**
       * 4x4 club trucks, the club lot, trail props and mud
       * Source: src/offroad3d.js
       * Scope: createCityRenderer() closure (included after police3d.js, whose
       * lofting, merging and livery kit it reuses).
       *
       * TRUCKS (makeOffroadVehicle): the seven club types of offroad.js, each a
       * lofted shell and glasshouse on the damage contract (the police bodies'
       * format: section, profile, glass), a canvas livery with panel swatches, and
       * static kit merged per material: steel bumpers and a winch, fender flares,
       * rock sliders, snorkels, roof racks, a roof tent, jerry cans, sand ladders,
       * light bars and pods, roll cages, a trophy truck's coilovers and spares.
       * Tyres are modelled (a lathed carcass with a bulging sidewall and a ring of
       * staggered tread lugs: mud-terrain, all-terrain or desert) on beadlock,
       * steel or cast rims. Each wheel hangs from a knuckle that steers (front)
       * and follows the ground under it (articulation within the travel), and it
       * turns at the wheel speed: spinning in the mud it runs ahead of the truck.
       *
       * MUD ON BODIES (vehicleMudPatch): a shader layer on the paint, trim and
       * tyres, driven by c.mudCoat / c.mudWet: the TRAIL MUD photo (trailMud,
       * assets/trail-mud.webp) thrown up from the wheels, a ragged line with
       * streaks and flecks above it and its own relief (a derivative bump), dark
       * and glossy when fresh, pale and matt when dry. Ordinary cars get it on
       * their paint the first time they get muddy.
       *
       * MUD EFFECTS (updateOffroadVisuals, offroad3d-mud.js TRAIL MUD): textured,
       * lit clods (instanced) stretched along their flight, sprite clusters of
       * spray lit through their own normals, fine drops and mist or dust in the
       * effect pool, all thrown rearward and up from spinning or fast tyres and
       * capped per tier (MUD_TIER); clods leave splats where they land; ruts with
       * lugs, lips and a wet gloss laid behind every wheel on dirt fade over
       * minutes. Splats and ruts are lit decals (a 2x modulate of the ground) in
       * one program, laid on the ground's own slope. Nothing allocates per frame.
       *
       * THE LOT (built once): the gravel pad, log rails, the carved 4X4 CLUB sign
       * on log posts with a rusted steel emblem, a pop-up canopy with a table,
       * camp chairs, a cooler, a kettle grill that smokes, a fire ring, a flag
       * that flies, string lights and lanterns for the evening; on the trail the
       * start gate, checkpoint flags, the rock-step ledges and the finish banner.
       */
      // @include src/offroad3d-models.js
      // @include src/offroad3d-kits.js
      // @include src/offroad3d-mud.js
      // @include src/offroad3d-course.js
      // @include src/offroad3d-trail.js
      // END SUBSYSTEM: src/offroad3d.js
