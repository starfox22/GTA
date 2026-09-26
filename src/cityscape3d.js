      // BEGIN SUBSYSTEM: src/cityscape3d.js — Building archetypes, roofs, shopfronts and street furniture
      /**
       * Building archetypes, roofs, shopfronts and street furniture
       * Source: src/cityscape3d.js
       * Scope: createCityRenderer() closure.
       * Procedural roof and curtain-wall textures, district-driven facade archetypes,
       * windows that light up at night, ground-floor shops with awnings and signs,
       * instanced rooftop equipment and sidewalk furniture, and the per-frame
       * night-lighting update (updateCityscapeVisuals).
       *
       * DESIGN NOTES
       * The camera looks down at about 40 degrees from the south, so roofs and
       * south-facing facades carry almost all of the visual identity. Every
       * building therefore gets: a roof material chosen by archetype, a parapet,
       * a seeded set of roof props, and (where a street runs along its south
       * face) a shopfront. Repeated small props use InstancedMesh so the whole
       * city costs a handful of draw calls regardless of density.
       */
      // @include src/cityscape3d-kit.js
      // @include src/cityscape3d-roofs.js
      // END SUBSYSTEM: src/cityscape3d.js
