      // BEGIN SUBSYSTEM: src/damage3d.js — Crumpling bodies, decals, debris and knocked furniture
      /**
       * Crumpling bodies, decals, debris and knocked furniture
       * Source: src/damage3d.js
       * Scope: createCityRenderer() closure.
       *
       * Draws what damage.js records, and never decides anything itself:
       *  - Every part of a car body (shell, glass, panels, trim, lamps, hood, bumpers)
       *    bends with the one crumple field (damage-crumple.js crumpleField; BODY
       *    CRUMPLE in damage3d-crumple.js); hinges, wheels and halos move with it.
       *    Pristine cars share their kit's geometry; a part gets its own copy when bent.
       *  - Hoods buckle, spring open and fly off; bumpers hang by one bracket; doors
       *    swing open on a bent hinge; trunks pop; glass cracks per pane then bursts;
       *    lamps go dark; flat tyres sit the corner down; wrecks char and glow.
       *  - Decals come from one procedural atlas through two InstancedMeshes: one ring
       *    buffer for the world (wall chips, star-cracked shop glass, scorch, craters,
       *    ground scuffs, oil, puddles) and one rebuilt each frame for marks on vehicles,
       *    pinned to the triangle of the part a ray along the bullet's path met
       *    (damage3d-marks.js VEHICLE MARKS), so they bend, swing and tear off with it.
       *    Thousands of shots only ever overwrite the oldest decal.
       *  - Debris (rubble chunks, torn-off panels) are two small instanced pools with a
       *    little rigid-body motion; knocked street furniture is re-posed in place.
       */
      // @include src/damage3d-decals.js

      // @include src/damage3d-bodies.js

      // @include src/damage3d-crumple.js

      // @include src/damage3d-marks.js

      // @include src/damage3d-world.js
      // END SUBSYSTEM: src/damage3d.js
