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
       * The street camera looks down at about 40 degrees from the south, so roofs
       * and south-facing facades carry its view; the chase view stands in the
       * street and sees every side. Every building therefore gets: a roof material
       * chosen by archetype, a parapet, a seeded set of roof props, (where a street
       * runs along its south face) the classic shopfront, and on every other side
       * a street frontage by archetype (shops, lobbies, stoops, loading bays) or a
       * plain back with service doors and fire escapes (STREET FRONTAGE). Repeated
       * small props use InstancedMesh and every part a shared material, so the
       * whole city costs a handful of draw calls per cell regardless of density.
       */
      // @include src/cityscape3d-kit.js
      // @include src/cityscape3d-shopwindows.js
      // @include src/cityscape3d-frontage.js
      // @include src/cityscape3d-roofs.js
      // END SUBSYSTEM: src/cityscape3d.js
