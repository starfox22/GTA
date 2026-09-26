      // BEGIN SUBSYSTEM: src/mountain-village3d.js — Mountain village meshes
      /**
       * Mountain village meshes
       * Source: src/mountain-village3d.js
       * Scope: createCityRenderer() closure (included after offroad3d.js).
       *
       * The Ridgeline island's own architecture (mountain-village.js has the
       * plan): a kit of painted materials (hewn logs with chinking, fieldstone,
       * board and batten, lime plaster, cedar shakes, slate, standing-seam metal,
       * planks, carved balcony boards, shutters, windows lit from inside at night)
       * and the pieces built from them: plinths, jettied upper storeys, gables,
       * steep roofs with deep overhangs, bargeboards and ridge caps, rafter tails,
       * dormers, cross gables, stone chimneys, carved balconies with flower boxes,
       * porches on posts over plank boardwalks, false fronts, log corner notches,
       * a steeple, a fire lookout, the gas station's timber canopy, the sawmill,
       * the fountain and the well, split-rail fences and firewood.
       *
       * PERFORMANCE. Nothing is a mesh per piece: every piece is written straight
       * into one vertex buffer per material per town (world-anchored UVs, the
       * tint in vertex colours), so a whole town is about twenty draw calls,
       * shadows included; the lantern lamps are instanced (and knockable, like the
       * city's); the signs share one atlas; the night light pools are one
       * additive mesh per town. mountainVillageInfo() reports the counts.
       *
       * THE CLUBHOUSE (offroad.js OFFROAD_CLUB): stone ground floor, log upper
       * storey, a big roof with a glazed front gable, the veranda and balcony,
       * the workshop bay, the yard with its fire pit and BBQ, the gravel lot, the
       * gate with the carved 4X4 CLUB sign. Inside: the bar with its taps and back
       * bar, two pool tables under wagon-wheel lamps, leather couches round the
       * stone fireplace, the big TV, trail maps, trophies and mounted parts; the
       * workshop's lift, bench, chests and tyres. While the player is inside, the
       * roof, the upper storey and the top of the front wall lift off (and the
       * cutaway hole opens round them, lighting3d.js).
       */
      // @include src/mountain-village3d-textures.js
      // @include src/mountain-village3d-kit.js
      // @include src/mountain-village3d-details.js
      // END SUBSYSTEM: src/mountain-village3d.js
