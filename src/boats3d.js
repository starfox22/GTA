      // BEGIN SUBSYSTEM: src/boats3d.js — Boat kit: lofted hulls and shared yacht parts
      /**
       * Boat kit
       * Source: src/boats3d.js
       * Scope: createCityRenderer() closure.
       * Everything that floats is built from these parts: a hull lofted from
       * stations (sheer line, keel line, plan shape, bilge and flare) with
       * painted bands baked into vertex colours, deckhouses with raked fronts and
       * glazing bands, teak decks, railings, loungers and the other deck fittings,
       * plus a merger that collapses a finished boat into a handful of meshes.
       *
       * Coordinates inside a boat group: x runs forward (u), z to starboard (v),
       * y up from the waterline. Place the group at (x, 0, y) with rotation.y = -a.
       *
       * Materials. Painted surfaces use `tint(color, finish)`. Tinted meshes all
       * merge into one vertex-coloured material per finish (gloss, satin, matte,
       * metal), so a whole marina of different boats costs a few draw calls.
       */
      // @include src/boats3d-kit.js
      // @include src/boats3d-fittings.js
      // END SUBSYSTEM: src/boats3d.js
