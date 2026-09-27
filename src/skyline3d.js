      // BEGIN SUBSYSTEM: src/skyline3d.js — North Point towers, FEDERATION EAST's helideck and the CIRRUS sky bar
      /**
       * North Point towers
       * Source: src/skyline3d.js
       * Scope: createCityRenderer() closure (included by src/cityscape3d.js, which calls
       * buildSkylineTower() for every building that skyline-towers.js planned: the
       * three on North Point Key; the rest of the old cluster is in reserve).
       *
       * Each tower is lofted from a floor plan (a closed outline with hard corners
       * where it has them) through a list of sections (height, scale, twist,
       * offset), so a twisting tower, a tapering needle, a curved facade or a stack
       * of rotated blocks are all the same few lines of data. Walls are UV-mapped in
       * world units (one curtain-wall tile is four 8-unit panels by four storeys,
       * game.js STOREY), so one glazing texture per design serves any size without
       * per-mesh texture repeats, and each design has its own glass colour, mullion
       * rhythm and spandrel pattern. Night lighting comes from a lit-window
       * emissive map (the city's litWindowMaterials drive it), LED crown and
       * outline materials that bloom, and red aircraft warning lights in the glow
       * field (signage3d.js).
       *
       * Everything is ordinary static meshes in the building's group, so the static
       * batcher merges each tower per material and the far-scenery copy picks the
       * large pieces up on its own (thin fins and masts stay out of it).
       *
       * Collision is the lot rectangle (skyline-towers.js): the podium fills the lot
       * and every shaft stays inside it. A roof with a use (skyline-lift.js) is
       * drawn from the deck the game walks: the helideck (skyline3d-crowns.js) and
       * the sky bar's terrace (skyline3d-bar.js).
       */
      // @include src/skyline3d-kit.js
      // @include src/skyline3d-towers.js
      // @include src/skyline3d-crowns.js
      // @include src/skyline3d-bar.js
      // END SUBSYSTEM: src/skyline3d.js
