    // BEGIN SUBSYSTEM: src/drawbridge.js — The Palm Sound drawbridge: schedule, gates, leaves, jumps
    /**
     * The Palm Sound drawbridge
     * Source: src/drawbridge.js
     * Scope: shared game closure (after geography.js and water.js; drawn by
     * drawbridge3d.js).
     *
     * The Palm Sound Causeway (BRIDGES 'keys-harbor', Harbor Ave at y 3200) is a
     * working double-leaf trunnion bascule. Its layout comes from bridgeStructure()
     * (`s.bascule`: trunnions, leaf length, piers, gate and stop lines), so the
     * renderer, the physics and the boats agree on it.
     *
     * The leaves are 44 m each (88 m trunnion to trunnion), as long as the
     * longest double-leaf bascules built; their counterweights hang off the
     * outboard main girders and swing down into open pits beside the fixed deck
     * on each pier, driven by racks on the girders' tails and pinions on the
     * pier (drawbridge3d.js draws all of it moving).
     *
     * SCHEDULE. The bridge opens at DRAWBRIDGE_OPENINGS (minutes of the day) for
     * the brigantine ALBATROSS, whose masts stand 30 m over the water; each
     * opening takes her across from one anchorage in Palm Sound to the other. An
     * opening runs like a real one, one phase after another:
     *   warning    one long blast of the tender's horn, bells, the traffic
     *              signals go amber then red, lamps flash
     *   gates      the entry arms come down on both approaches, then the exit
     *              arms (an arm waits while a vehicle is under it)
     *   clearing   the tender waits until nobody is left on the moving span
     *   unlock     the centre lock bars draw back out of the far leaf (clanks)
     *   raising    both leaves swing up together, slowly and eased (a minute,
     *              at most 1.6 degrees a second), to 78 degrees
     *   open       the channel lights turn green; the brigantine passes under
     *              sail and salutes, the tender answers
     *   lowering   the leaves come down, eased, as slowly
     *   seating    the lock bars drive home
     *   lifting    the arms rise, the signals go green
     * The phase clock is game seconds (one second is an in-game minute), so an
     * opening lasts about three minutes of play. A small crowd gathers on the
     * approaches to watch (drawbridgeSpectators) and the camera eases back a
     * little for a player close by (drawbridgeCameraZoom, the Event camera
     * setting).
     *
     * TRAFFIC AND PEOPLE. Traffic stops at the stop lines (drawbridgeTrafficLimit,
     * called from trafficControl), queues, and moves off when the arms rise. No
     * vehicle other than the player's may roll onto the span unless it is seated
     * (drawbridgeKeepsOff, from settleVehicle): cops and runaways stop at the
     * trunnion. The arms are solid for vehicles and snap for anything faster
     * than DRAWBRIDGE_ARM_SNAP (updateDrawbridgeRamming). People are kept behind
     * the sidewalk arms and off a moving span (drawbridgeFootBlocked). The GPS
     * weighs the crossing by how long the bridge will stay closed
     * (drawbridgeRouteDelay, navShortestPath), so a short trip waits and a long
     * one goes round by the Keys Bridge.
     *
     * LEAVES AND JUMPS. The leaves are ramps: a road vehicle on a leaf follows its
     * surface (deckLift, slopePitch; entityElevation adds deckLift), feels its
     * slope (drawbridgeSlopeDrive: gravity along the slope; only the driven
     * wheels push, so a front-wheel-drive saloon cannot hold its speed up much
     * past 20 degrees and a 4x4 climbs to about 40) and leaves the tip
     * ballistically into the gap
     * (deckAir, drawbridgeFlight: height, vertical speed, gravity, no grip).
     * It lands on the far leaf or the deck beyond (impact damage by the speed
     * into the surface), strikes the far leaf's end if it comes in low, or falls
     * into the Sound, where water.js floods it. A leaf steeper than
     * DRAWBRIDGE_WALL_ANGLE is a wall. The open gap is not deck (onBridgeDeck).
     */
    // @include src/drawbridge-span.js
    // @include src/drawbridge-motion.js
    // @include src/drawbridge-opening.js
    // END SUBSYSTEM: src/drawbridge.js
