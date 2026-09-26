    // Monarch Isle grid: columns, blocks, kerbs and floors (ISLE_COLS, isleBlock).
    const ISLE_COLS = [5600, 6400, 7200, 8000, 8800, 9600],
      ISLE_ROWS = [-4544, -3744, -2944, -2144, -1344],
      ISLE_BLOCK = 800,
      ISLE_STREET = 96,
      ISLE_WALK = 40,
      ISLE_CARRIAGEWAY = 48,
      ISLE_MEDIAN = 24,
      // The divided boulevards: column 2 and row 2.
      ISLE_DIVIDED_COL = 7200,
      ISLE_DIVIDED_ROW = -2944,
      // Lane offsets from a street's centre line (right-hand traffic).
      ISLE_LANE = 24,
      ISLE_DIVIDED_LANE = ISLE_MEDIAN / 2 + ISLE_CARRIAGEWAY / 2;
    // A private random so the island's dressing never shifts the seeded city.
    function isleRandomSource(seed) {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    /* A building of `n` floors at real scale: a SHOP_FLOOR ground floor, STOREY
       floors above and a parapet. */
    function isleFloors(n) {
      return Math.round(SHOP_FLOOR + (n - 1) * STOREY + 0.8 * UNITS_PER_METRE);
    }
    // Half the road reserve either side of a street centre line (carriageway + pavement).
    function isleReserveHalf(value, vertical) {
      return (vertical ? value === ISLE_DIVIDED_COL : value === ISLE_DIVIDED_ROW) ? 100 : ISLE_STREET / 2 + ISLE_WALK;
    }
    // Half the carriageway (kerb to kerb) of a grid street.
    function isleKerbHalf(value, vertical) {
      return (vertical ? value === ISLE_DIVIDED_COL : value === ISLE_DIVIDED_ROW) ? ISLE_MEDIAN / 2 + ISLE_CARRIAGEWAY : ISLE_STREET / 2;
    }
    /* The lot of block (i, j): inside its pavements. i is the column (0 west),
       j the row (0 north). */
    function isleBlock(i, j) {
      const x0 = ISLE_COLS[i] + isleReserveHalf(ISLE_COLS[i], true),
        x1 = ISLE_COLS[i + 1] - isleReserveHalf(ISLE_COLS[i + 1], true),
        y0 = ISLE_ROWS[j] + isleReserveHalf(ISLE_ROWS[j], false),
        y1 = ISLE_ROWS[j + 1] - isleReserveHalf(ISLE_ROWS[j + 1], false);
      return { i, j, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
