    // BEGIN SUBSYSTEM: src/falls.js — Falls: bodies and vehicles off cliffs, fatal impacts
    /**
     * Falls
     * Source: src/falls.js
     * Scope: shared game closure (after parachute.js; hooks in game-update.js,
     * physics-driving.js and physics-step.js).
     *
     * Gravity for everything that leaves the ground by accident. A body on foot
     * that runs off a drop steeper than FALL_START_GRADE flies a ballistic arc and
     * lands on whatever is under it; a road vehicle whose ground falls away faster
     * than its suspension can follow flies too, pitching over the edge and rolling
     * if it went off at an angle. What a landing does follows the speed into the
     * surface, one scale for everyone: a parachutist, a hiker off a cliff, a car.
     *
     *   falls-body.js      impact scale, the player's fall on foot, the splat
     *   falls-vehicles.js  vehicles airborne off the terrain, landings, rollovers
     *   falls-console.js   cliff finder and scripted fall / descent tests
     */
    // @include src/falls-body.js
    // @include src/falls-vehicles.js
    // @include src/falls-console.js
    // END SUBSYSTEM: src/falls.js
