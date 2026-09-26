    // BEGIN SUBSYSTEM: src/monarch.js — Monarch Isle: the plan, the land and the streets
    /**
     * Monarch Isle
     * Source: src/monarch.js
     * Scope: shared game closure (included after county.js).
     *
     * The rich island north of the Ridgeline Range, across the Regency Channel
     * (~160 m) from the mountains and Sovereign Sound (~260 m) from North Point.
     * Everything the rest of the game needs to know about it is planned here, as
     * data: the coast, the street grid, the roundabouts, every parcel and what
     * stands on it, the marina basin and its berths, the colliders, the painted
     * ground sheet, the map and the district names. monarch-life.js runs the
     * island (traffic, people, boats, sound); monarch3d.js, monarch-garden3d.js
     * and monarch-bridges3d.js draw it.
     *
     * THE GRID. Blocks are strictly 100 m: street centreline to street centreline
     * is ISLE_BLOCK = 800 units in both directions. Columns run x 5600..9600 and
     * rows y -4544..-1344 (5 x 4 blocks). A plain street is 96 wide (12 m) with a
     * 40-unit (5 m) pavement each side, so a block's lot is 624 x 624 (78 m); the
     * two boulevards (Crown Avenue, row y -2944, and Monarch Boulevard, column
     * x 7200) are divided: two 48-wide carriageways either side of a 24-wide
     * planted median, so their lots start 100 from the centreline.
     *
     * Coordinates are map units (UNITS_PER_METRE = 8). The island is x 5460..10150,
     * y -5092..-468 (about 590 m by 580 m, the breakwater included).
     */
    // @include src/monarch-grid.js
    /**
     * THE COAST
     * West: a straight limestone sea wall facing North Point across Sovereign
     * Sound, carrying the esplanade. North: Monarch Beach, a long sweep of sand
     * on the open sea behind the beachfront villas. North-east and east: low
     * granite cliffs and rocks. South-east: the marina basin, closed by a
     * breakwater mole with a lighthouse on its tip; its mouth opens south-west.
     * South: Regency Point (the yacht club's headland) and the Regency Gardens
     * sea wall, where the Regency Bridge comes ashore from the mountains.
     */
    // @include src/monarch-coast.js
    /**
     * THE STREETS
     * `vertical` streets run along a column (x = at), the others along a row
     * (y = at), from..to along their length. Orangery Lane stops at Belgrave
     * Street: north of it the column is the botanic garden's Kew Walk, a
     * pedestrian avenue.
     */
    // @include src/monarch-streets.js
    /**
     * THE TOWERS
     *   THE SOVEREIGN   a slender pencil tower (57 storeys, ~186 m): a square
     *                   shaft with feathered bronze fins that step back in four
     *                   setbacks to a lantern crown, a helipad on the roof.
     *   MONARCH ONE     a twisting glass tower (48 storeys, ~160 m): a softened
     *                   square that turns 90 degrees over its height, white
     *                   balcony bands wrapping every floor, LED crown.
     */
    // @include src/monarch-towers.js
    /**
     * A block's buildings, by use. Commercial blocks carry a frontage of shop
     * units along their south side (the camera's side) with residences over,
     * and whatever the block is for behind.
     */
    // @include src/monarch-blocks.js
    /**
     * THE GROUND SHEET
     * One canvas tile over the island (countyGroundTiles), painted once: lawns,
     * pavements and kerbs, the streets with their markings and zebra crossings,
     * the two roundabouts, forecourts, drives and terraces, the beach, the
     * quays and the esplanade (paintPromenades). The ground shader
     * (surfaces3d.js) adds the grain, slab joints and grass up close.
     */
    // @include src/monarch-ground.js
    /* The minimap and the big map: the island's static layer (paintMapBase). */
    // @include src/monarch-map.js
    // END SUBSYSTEM: src/monarch.js
