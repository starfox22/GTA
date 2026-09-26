      // BEGIN SUBSYSTEM: src/themepark3d.js — Sunset Pier resort meshes
      /**
       * Sunset Pier resort meshes
       * Source: src/themepark3d.js
       * Scope: createCityRenderer() closure.
       * The Falcon (swept rails and spine, supports, station, the train and its
       * riders), the Sunset Eye (legs, hub, cable spokes, rim, 48 level capsules,
       * LED shows), the Fountain Lagoon and its jets, the Sunset Palace hotel,
       * the beach club, the family rides, the log flume, the dark ride, bumper
       * cars, the gate, kiosks, palms and lamps; night light (bulbs, a light-pool
       * overlay on the ground), fireworks, and the ride cameras.
       *
       * Static scenery is merged here into one mesh per material (parkParts),
       * so the whole island is a few dozen draw calls; what moves (the train, the
       * wheel, the rides, jets, sparks) is instanced or grouped per ride. Motion
       * is read from themepark.js so what is drawn is what the game simulates.
       */
      // @include src/themepark3d-materials.js
      // @include src/themepark3d-rides.js
      // @include src/themepark3d-carousel.js
      // @include src/themepark3d-shows.js
      // END SUBSYSTEM: src/themepark3d.js
