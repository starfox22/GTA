    // BEGIN SUBSYSTEM: src/damage.js — Vehicle damage, bullet impacts and breakable street furniture
    /**
     * Vehicle damage, bullet impacts and breakable street furniture
     * Source: src/damage.js
     * Scope: shared game closure.
     *
     * DAMAGE MODEL
     * Everything the renderer shows about a hurt vehicle is data on the vehicle, so
     * physics, handling and visuals always agree, and a repaired or newly spawned
     * vehicle starts clean (freshDamage):
     *   damage.front/rear/left/right  0..1 crumple of each zone (the original contract)
     *   vehicle.dents[]   {x, y, z, nx, ny, depth, r}: crumple centres in vehicle space. The
     *                     renderer pushes body vertices along (nx, ny) by up to `depth`
     *                     with a smooth falloff over radius `r` (damage3d.js).
     *   damage.parts      hood, bumpers, doors, trunk: 0 on, 1 sprung or hanging, 2 torn off
     *   damage.glass      per pane: 0 intact, 1 cracked, 2 shattered. Windscreens are
     *                     laminated and crack first; side and rear glass is tempered and
     *                     bursts at once.
     *   damage.lights     broken head and tail lamps (they stay dark at night)
     *   damage.tires      flat tyres: that corner sits down and the car pulls
     *   damage.marks[]    bullet holes, glass stars and scrapes, in vehicle space
     *   damage.pull       steering pull from bent suspension, -1 (left) .. 1 (right)
     *   damage.burning    seconds the engine has been on fire; it burns down to the explosion
     * Vehicle space: x forward along the heading, y to the right (map +y when facing east),
     * z up from the vehicle's floor. It matches the model's local x, z and y axes.
     *
     * Street furniture (lamp posts, signals, hydrants, bins, benches...) is registered
     * here by the renderer as it places each piece. A standing prop is a small solid box
     * for vehicles; enough momentum knocks it flat and it stops being solid.
     */
    // @include src/damage-vehicles.js

    // @include src/damage-upkeep.js
    // END SUBSYSTEM: src/damage.js
