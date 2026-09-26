      // BEGIN SUBSYSTEM: src/damage3d.js — Crumpling bodies, decals, debris and knocked furniture
      /**
       * Crumpling bodies, decals, debris and knocked furniture
       * Source: src/damage3d.js
       * Scope: createCityRenderer() closure.
       *
       * Draws what damage.js records, and never decides anything itself:
       *  - Car bodies are a finely sliced shell whose vertices are pushed along each
       *    dent's direction (crumple). Pristine cars share one geometry per body size;
       *    a car gets its own copy the first time it is dented.
       *  - Hoods buckle, spring open and fly off; bumpers hang by one bracket; doors
       *    swing open on a bent hinge; trunks pop; glass cracks per pane then bursts;
       *    lamps go dark; flat tyres sit the corner down; wrecks char and glow.
       *  - Decals come from one procedural atlas through two InstancedMeshes: one ring
       *    buffer for the world (wall chips, star-cracked shop glass, scorch, craters,
       *    ground scuffs, oil, puddles) and one rebuilt each frame for marks on vehicles,
       *    anchored where a ray along the bullet's path meets the (crumpled) body.
       *    Thousands of shots only ever overwrite the oldest decal.
       *  - Debris (rubble chunks, torn-off panels) are two small instanced pools with a
       *    little rigid-body motion; knocked street furniture is re-posed in place.
       */
      // @include src/damage3d-decals.js

      // @include src/damage3d-bodies.js

      // @include src/damage3d-world.js
      // END SUBSYSTEM: src/damage3d.js
