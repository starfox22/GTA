    // BEGIN SUBSYSTEM: src/offroad.js — The 4x4 club, trail mud, off-road traction and the hill climb
    /**
     * The 4x4 club, trail mud, off-road traction and the hill climb
     * Source: src/offroad.js
     * Scope: shared game closure (included right after terrain.js).
     *
     * RIDGELINE 4X4 CLUB (OFFROAD_CLUB): a gravel lot cut into the foot of Mount
     * Ascent across Eagle Pass from the trailhead. Its pad is flattened in the
     * height field itself (offroadTerrainPads, read by generateTerrainField), so
     * the ground, the colliders and the picture agree. Seven club trucks stand in
     * a herringbone row (OFFROAD_TYPES: real dimensions, masses and performance,
     * added to VEHICLE_DEFINITIONS; offroad3d.js builds their models), with a
     * canopy, chairs, a cooler, a smoking grill, a flag, string lights and a
     * handful of members who talk shop (a crowd scene, `kind: 'club'`).
     *
     * TRAIL MUD: every vertex of a trail carries a mud and a rock amount
     * (offroadTrailBake, from the trail's own distance along and across): the
     * lower switchbacks run through damp forest and are muddy dirt, with a bog,
     * a muddy hairpin and rocky steps as set pieces (OFFROAD_SECTIONS). Ruts in
     * the middle hold the deepest mud; the crown and the edges are firmer, so the
     * line matters. Rain (weather.wet) makes all of it slicker.
     *
     * TRACTION (offroadDrive, called by physics.js for any road vehicle on the
     * range): the tyres can push at most mu x the load on the driven wheels.
     * mu comes from the surface (packed dirt 0.68, mud down to ~0.3, wet mud
     * lower, rock 0.8) and the tyre (mud-terrain, all-terrain, desert, road);
     * the driven share is 1 for 4x4, about half for two-wheel drive (the load
     * shifts to the rear on a climb). Asking the tyres for more spins them: the
     * wheel speed runs ahead of the ground speed (c.wheelSpin, c.spinSpeed, drawn
     * and heard) and the grip left is the lower sliding friction. Low range
     * (club trucks under 35 km/h) multiplies the pull. With no throttle the
     * brakes hold the truck up to the same friction; past it the truck slides
     * back down. Mud also costs rolling resistance, and rough ground above a
     * vehicle's suspension speed bounces it about. A road car spins its wheels
     * in the first mud; a 4x4 climbs, but the wet bog and the muddy hairpin need
     * momentum and a line out of the ruts.
     *
     * BODY MUD (c.mudCoat 0..1, c.mudWet): builds up from mud thrown by the
     * tyres, washes off in rain and in water (the sea, lakes, the streams).
     *
     * HILL CLIMB: crossing the start gate at a trailhead starts the clock; the
     * checkpoints are counted in order and the summit shows SUMMIT REACHED with
     * the time and the best clean run (localStorage `dead-end-city-hillclimb`).
     * E at the club sign in a vehicle arms the challenge: beat 2:30 on Mount
     * Ascent for $1,000.
     */
    // @include src/offroad-trails.js
    // @include src/offroad-club.js
    // END SUBSYSTEM: src/offroad.js
