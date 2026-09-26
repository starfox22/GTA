      // BEGIN SUBSYSTEM: src/vegetation3d.js — Tree library: species, foliage atlas, wind, LOD
      /**
       * Tree library
       * Source: src/vegetation3d.js
       * Scope: createCityRenderer() closure (included where the street trees are
       * planted, after the breakable scenery helpers and before world3d.js, whose
       * makePalm() comes here).
       *
       * Every tree in the world is one of the species in TREE_SPECIES, modelled
       * once per level of detail as a single geometry and drawn as instances:
       *
       *   broadleaf   London plane, linden, honey locust, Bradford pear, maple,
       *               oak, weeping willow, jacaranda, flame tree, cherry, beech,
       *               birch; a trunk that forks into limbs reaching under the
       *               crown's edge, and a crown of overlapping lobes, each a lumpy
       *               core wrapped in leaf-cluster cards, so the edge seen from
       *               above breaks up into foliage rather than a ball
       *   conifers    spruce (drooping bough whorls), fir (dense, level boughs),
       *               pine (a bare trunk under tufted crown clumps), Italian
       *               cypress (a dark column) and stone pine (a flat umbrella)
       *   palms       Canary date palm (thick trunk, a dense ball of fronds),
       *               Mexican fan palm (tall and thin, fan leaves over a skirt
       *               of dead ones), coconut (a bowed trunk, long drooping
       *               fronds, nuts), royal palm (a smooth grey trunk, green
       *               crownshaft); fronds are curved, keeled blades
       *
       * All of it shares one material (treeMaterial) over one procedural texture
       * atlas (foliageAtlas: leaf clusters, needle boughs, willow strands,
       * blossom, pinnate and fan fronds, eight barks) with a normal map baked
       * from the painted height. The atlas is near neutral; the colour is in the
       * vertex colours (the species) and the instance colour (a per-tree jitter,
       * autumn and blossom accents), which tints only the leaves. So each species
       * is one draw per breakable cell and level of detail, like the plain lobes
       * it replaced. Each geometry carries:
       *   foliage  (leaf mask, sway weight): what the wind moves and the tint reaches
       *   morph    a per-vertex offset, scaled per instance from -1 to 1: a crown
       *            that spreads or stays upright, boughs that droop or lift, fronds
       *            that hang: continuous variants of the same species at no cost
       * and each instance an `instanceFoliage` (morph, density: sparser crowns
       * drop more of their leaf pixels). Wind sways crowns and fronds in the
       * vertex shader (and in the shadow pass, whose depth material shares the
       * patch). Per tree: scale +-18%, a height/width aspect, a lean, a turn, the
       * tint, the morph and the density, all from a hash of its position, so the
       * city is the same every visit.
       *
       * Levels of detail: `near` (the modelled tree), `mid` (a few lumpy blobs and
       * a trunk, ~60 triangles) from street zoom ~0.5 out and in the flight view
       * beyond ~1.4 km, and the far city's merged copy (flight-view3d.js FAR
       * SCENERY), which gets one plain crown blob per tree (`noteFarTree`).
       * Breakable trees keep working: the near and mid meshes are both instances
       * linked to the tree's prop (render3d.js BREAKABLE SCENERY), so a felled
       * tree falls, leaves its stump and is replanted whole.
       */
      // @include src/vegetation3d-atlas.js
      // @include src/vegetation3d-material.js
      // @include src/vegetation3d-species.js
      // END SUBSYSTEM: src/vegetation3d.js
