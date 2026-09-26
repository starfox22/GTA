      // BEGIN SUBSYSTEM: src/dealership3d.js — MONARCH MOTORS in 3D
      /**
       * MONARCH MOTORS in 3D
       * Source: src/dealership3d.js
       * Scope: createCityRenderer() closure, after monarch-streets3d.js (it uses
       * the island's kit: tint, kitMerge, the glow field, the island's light map).
       *
       * Built from dealership.js's DEALER plan, in world coordinates:
       *   HALL      a polished travertine floor (large slabs, grey veins, a low
       *             roughness so the sky and the lights slide over it), stone side
       *             and back walls, the glass frontage (one instanced draw of 3 m
       *             panes with bronze mullions) with sliding doors and a rising
       *             vehicle door, the brand walls (backlit panels: WALTER MARTIN's
       *             green, CHEVETTE's black and gold, MUGATTI's blue) under the
       *             mezzanine gallery and its glass balustrade, the stair along the
       *             east wall, the VIP lounge (cream sofas, a rug, a black marble bar
       *             with a lit bottle wall, pendant lamps), the freestanding
       *             configurator wall (a live LED screen) and its kiosk, the curved
       *             reception desk, the DELIVERY SUITE (stage turntable, LED
       *             backdrop, velvet curtain on a track, service desk), the hero
       *             dais under the oculus, and a placard on a stand by every car.
       *   ROOF      a thin white canopy frame whose front edge waves out over the
       *             forecourt, round a glass roof on a white grid (the cars read
       *             through it from above, and it glows at night) with a ring over
       *             the hero; all of it is hidden while the player is inside (or
       *             the purchase card or the delivery is on).
       *   FORECOURT podiums with LED rings, planters with clipped box, six flags,
       *             the lit pylon, bay posts; the lane and bays are painted in the
       *             ground sheet (dealership.js).
       *   MOVING    turntable discs and their LED rims follow their cars (two
       *             instanced draws), light pools under the cars, the curtain's
       *             folds, the doors, the security shutters and the broken panes'
       *             shards, the screens.
       *   NIGHT     the glass box glows warm, pools of light in the island's light
       *             map under every car and along the frontage, rim LEDs, the signs.
       *
       * Draw calls: the static hall merges into about ten (kitMerge per finish,
       * plus the floor, the brand walls, the placards and the signs), the roof
       * three, the moving parts about fourteen.
       */
      // @include src/dealership3d-canvases.js
      // @include src/dealership3d-build.js
      // END SUBSYSTEM: src/dealership3d.js
