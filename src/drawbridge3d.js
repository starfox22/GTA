      // BEGIN SUBSYSTEM: src/drawbridge3d.js — The Palm Sound drawbridge in 3D
      /**
       * The Palm Sound drawbridge in 3D
       * Source: src/drawbridge3d.js
       * Scope: createCityRenderer() closure, included just before bridges3d.js;
       * buildDrawbridge() is the Palm Sound Causeway's builder there (called while
       * the bridges are built, so it may use every bridges3d helper), and
       * updateDrawbridgeVisuals() runs each frame from updateBridgeVisuals().
       * Nothing here runs at include time.
       *
       * A double-leaf trunnion bascule in the Chicago manner, drawn from the same
       * layout the game uses (bridgeStructure 's.bascule', drawbridge.js):
       *   leaves     each a group hinged `drop` below the road at its trunnion, 44 m
       *              long: carriageway and footways in the deck's own materials
       *              (the markings and lamp light run on), open steel grid decking
       *              over the joint and a finger lock at the tips, ornamental
       *              railings and globe lamps, two deep outboard main girders
       *              (5.5 m at the trunnion, 1.8 m at the tip, floodlit at night),
       *              the floor system seen from below as the leaf stands up (cross
       *              girders, stringers, lateral bracing), red / green tip
       *              lanterns, the centre lock bars (withdrawn and driven home,
       *              `drawbridge.locks`); behind the trunnion each girder's tail
       *              carries a curved rack and a counterweight
       *   piers      granite, with the nose running under the leaf's heel and two
       *              open counterweight pits flanking the fixed deck, 17 m deep:
       *              the counterweights swing down into them as the leaves rise,
       *              the racks rolling through pinions on shafts across each pit.
       *              The pits reach below the sea, so a depth mask over their
       *              openings (drawn after the pit and the leaves, before the
       *              water) keeps the water plane out of them. Platforms beyond the
       *              pits carry the four limestone tender's houses (copper hip
       *              roofs, lookouts lit at night), the south-east one the
       *              two-storey control house with its vessel signal mast and horn;
       *              floodlights on the pier noses throw beams onto the raised
       *              leaves after dark
       *   fenders    timber pile walls up and down the channel, red lights on
       *              their dolphins
       *   gates      per approach two kerb cabinets with red / white striped
       *              arms (lamps along them), short sidewalk arms, wig-wag
       *              lamps, a mast-arm traffic signal (red / amber / green) and
       *              a stop line; an advance DRAWBRIDGE AHEAD sign with amber
       *              flashers. A snapped arm leaves a stub and its boom on the road
       *   water      drips and spray off the rising leaves (one points cloud)
       *   ship       ALBATROSS, the brigantine the bridge opens for (square sails
       *              on the foremast, gaff main, three headsails, set as she gets
       *              under way; deck lights dressed overall), built with the boat
       *              kit the first frame she is needed
       * Signal lenses are shared MeshBasicMaterials switched each frame; the lit
       * ones get soft halos (Points), hidden while dark.
       */
      // @include src/drawbridge3d-kit.js
      // @include src/drawbridge3d-build.js
      // END SUBSYSTEM: src/drawbridge3d.js
