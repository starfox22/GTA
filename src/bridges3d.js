      // BEGIN SUBSYSTEM: src/bridges3d.js — Bridges: one architecture per crossing
      /**
       * Bridges
       * Source: src/bridges3d.js
       * Scope: createCityRenderer() closure, after boats3d.js (bridges are built
       * with the boat kit: tint(), kitMerge(), kitLight()).
       *
       * Every road bridge in BRIDGES is drawn from bridgeStructure() (geography.js),
       * the same piers, towers, cables and channels that aircraft and boats collide
       * with, in the bridge's own style:
       *   truss       Keys Bridge: a green steel camel-back through-truss
       *   bascule     Palm Sound Causeway: a low causeway, globe lamps and a working
       *               double-leaf trunnion bascule (drawbridge3d.js)
       *   cablestay   East Bay Crossing: a white A-pylon and two fans of stays
       *   suspension  South Bay Bridge: red towers, main cables and hangers
       *   arch        Sunset Pier Bridge: a leaning network arch in LED colours
       *   segmental   Oceanview Causeway: a low viaduct, fishing balconies and
       *               striped channel beacons
       *   extradosed  Coral Sound Bridge: coral sail pylons and harps of stays
       *   hpylon      Ridgeline Viaduct: concrete H-pylons, a weathering-steel girder
       *   swing       Sentinel Causeway: olive plate girders, a swing span, floodlights
       * Each bridge is built in its own frame (x along the deck from the middle,
       * z across to the right of a -> b, y up from the road) and merged into a few
       * vertex-coloured meshes; its night lights are one points cloud. Lamps,
       * cable LEDs, uplighting and the red aviation beacons come up at dusk
       * (updateBridgeVisuals, called from updateCountyVisuals). A plain far copy of
       * every bridge stands in when the whole city is in view (flight-view3d.js).
       */
      // @include src/bridges3d-kit.js
      // @include src/bridges3d-build.js
      // END SUBSYSTEM: src/bridges3d.js
