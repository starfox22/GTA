      // BEGIN SUBSYSTEM: src/lighting3d.js — Sun, sky, reflections and night light
      /**
       * Sun, sky, reflections and night light
       * Source: src/lighting3d.js
       * Scope: createCityRenderer() closure (included after postfx3d.js, before the city is built).
       *
       *  - SUN PATH: the sun rises in the east, crosses the northern sky (so shadows
       *    fall towards the camera and read on the street, the look the city was
       *    designed with) and sets in the west; at night the same light is the moon.
       *  - SKY AND REFLECTIONS: a procedural sky (gradient, sun glow, stars, moon)
       *    drawn as a dome behind the flight view and filtered with PMREM into the
       *    scene's environment map, so glass, car paint, chrome and wet tarmac all
       *    reflect the sky that is actually overhead at that hour.
       *  - NIGHT LIGHT: street lamps, shop windows and neon throw pools of light on
       *    the ground without hundreds of real lights. The pools are painted once
       *    into a light map over the whole city; every lit material samples it by
       *    world position (see cityMaterialPatch) and adds it as light falling on
       *    surfaces near the ground, fading with height, so kerbs, cars, people and
       *    the foot of each facade all pick it up. Headlights are projected cones.
       *  - THE LOOK: per-hour exposure, bloom and colour grade for postfx3d.js.
       */
      // @include src/lighting3d-sky.js
      // @include src/lighting3d-cutaway.js
      // END SUBSYSTEM: src/lighting3d.js
