      // BEGIN SUBSYSTEM: src/beachclub3d.js — Marea Beach Club meshes and show lighting
      /**
       * Marea Beach Club meshes and show lighting
       * Source: src/beachclub3d.js
       * Scope: createCityRenderer() closure.
       *
       * Draws the plan in beachclub.js (MAREA, plot-local u east / v south): the
       * forecourt with its ropes, red carpet, portal and neon sign; the low street
       * wall; the staff and restroom blocks; the stage with the DJ desk, the LED
       * wall and the speaker stacks; the dance floor under a lighting truss; the
       * main bar and back bar under white sails; the VIP terrace; daybeds and
       * cabanas; the infinity pool with its swim-up bar; the sunken fire lounge;
       * the deck, the beach gate and the club's sand with sunbeds and parasols.
       *
       * DRAW CALLS: everything fixed goes into `batchGroups` (merged per material),
       * sharing a small set of materials. What moves or glows is instanced: 153
       * LED floor tiles, 8 moving-head beams and their floor spots, 12 lasers,
       * torch flames; string lights and uplights are one Points cloud (kitLight,
       * boats3d.js). The sails fade out while the player is inside, so they never
       * hide the people under them.
       *
       * SHOW: `updateBeachClubVisuals` (called from updateBeachVisuals) runs the
       * lights from `mareaGroove` (beachclub-audio.js): the floor patterns change
       * every bar, the moving heads chase on the beat, lasers fan out in the
       * groove and the drop, the strobe fires in the last bar of the build, the
       * LED wall draws an equaliser. By day the floor is marble, the wall shows
       * the sea, and only the pool glitters. Gunfire kills the show and brings the
       * house lights up.
       */
      // The club's many local names (materials, meshes, the show state) stay in
      // their own scope; the renderer only needs the per-frame update.
      const updateBeachClubVisuals = buildBeachClub3D();
      function buildBeachClub3D() {
        // @include src/beachclub3d-club.js

        // @include src/beachclub3d-terrace.js
      }
      // END SUBSYSTEM: src/beachclub3d.js
