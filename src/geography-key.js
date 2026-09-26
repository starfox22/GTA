    // North Point Key: the islet off Northbank's north-east point that carries the three towers (coast and plan anchors).
    /**
     * NORTH POINT KEY
     * Source: src/geography-key.js
     * Scope: shared game closure (data and point tests only).
     *
     * A small reclaimed islet in Marlow Bay, east of the end of the -3456 cross
     * street, reached by the NORTH POINT KEY BRIDGE (a grid street carried over
     * the water, so traffic, GPS and police routing treat it as any other).
     * Its north side is a straight sea wall under the three towers: the camera
     * looks north, so nothing walkable stands behind them. The forecourt, the
     * drop-off circle, the lawns and the beach lie south of them, open to view.
     *
     * The whole islet is east of CITY_RIGHT (3712), so its ground is a tile of
     * its own (skyline-islet.js) and the city sheet never paints it. The region
     * is appended to LAND_REGIONS last (skyline-islet.js), after the county,
     * Monarch Isle and the runway piers, so no other coast walk, promenade
     * rhythm or land cell moves.
     */
    const NORTH_POINT_KEY = {
      id: 'northpointkey',
      name: 'NORTH POINT KEY',
      color: '#6b7a70',
      polygon: smoothShoreline(
        [
          [3742, -3620],
          [3752, -3832],
          [3782, -3940],
          [3872, -3976],
          [4110, -3982],
          [4330, -3974],
          [4420, -3952],
          [4456, -3880],
          [4460, -3730],
          [4436, -3540],
          [4372, -3352],
          [4262, -3204],
          [4095, -3126],
          [3930, -3142],
          [3815, -3226],
          [3754, -3368],
          [3740, -3500],
          [3742, -3620],
        ],
        3,
      ).slice(0, -1),
      // The access street is the -3456 grid row, carried over the bridge.
      row: -3456,
      bridge: { a: [3300, -3456], b: [3800, -3456], width: 88 },
      // The grid street stops short of the circle; the tile paints the join.
      streetEnd: 3960,
      // The drop-off circle: centreline radius, carriageway width, a planted
      // island with the fountain in the middle.
      circle: { x: 4100, y: -3456, r: 80, width: 44 },
      fountain: { x: 4100, y: -3456, r: 34 },
      // The paved forecourt along the tower fronts.
      forecourt: { x0: 3760, x1: 4450, y0: -3736, y1: -3596 },
      // South-east shore: sand down to the water.
      beach: { x0: 4170, y0: -3620 },
      // Nothing walkable north of this line (the towers stand on the sea wall).
      towerLine: -3700,
      // The islet's ground tile (east of the city frame).
      tile: { x: 3712, y: -4008, w: 784, h: 912, pixelsPerUnit: 1.25 },
    };
    // Bounding box first: most callers are nowhere near the islet.
    function onNorthPointKey(x, y) {
      if (x < 3700 || x > 4500 || y < -4020 || y > -3090) return false;
      return regionContains(NORTH_POINT_KEY, x, y);
    }
