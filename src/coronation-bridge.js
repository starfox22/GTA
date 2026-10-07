    // The Coronation Bridge: Sunset Pier to Monarch Isle across Sovereign Sound, an Art Deco causeway with a working double-leaf bascule (BRIDGES 'coronation', CORONATION_BRIDGE).
    /**
     * THE CORONATION BRIDGE (1937)
     * Scope: shared game closure, included after skyline.js so it is the last
     * bridge in BRIDGES (nothing before it moves: coast walks, promenade rhythms
     * and the city grid are untouched; it adds no land).
     *
     * From the east bend of Pier Island Drive on Sunset Pier (3898, -5900) south-east
     * over Sovereign Sound to the corner of Westgate and Ocean Crescent on Monarch
     * Isle (5600, -4544): 272 m long, about 230 m of it over the water. A low
     * concrete causeway on paired column bents with an Art Deco double-leaf
     * trunnion bascule (36 m leaves) over the channel: stepped cream tender towers
     * with fluted fins and porthole windows, aquamarine leaves, chrome-banded
     * entrance pylons at both landings and Deco lamp standards (coronation3d.js
     * draws it; drawbridge3d.js the moving span).
     *
     * - A movable bridge like the Palm Sound Causeway (drawbridge.js): its own
     *   timetable, ship (the schooner LADY GRACE), gates, signals and jumps.
     * - Its deck joins COUNTY_ROADS, so the GPS, the county police graph, the map
     *   and the ground tiles (Sunset Pier's, Monarch's) all know it; Monarch Isle's
     *   traffic graph runs over it to a turn-round on Pier Island Drive by the car
     *   park (isleRoadGraph, monarch-life-traffic.js).
     * - Both landings are inside the road junctions they meet (the bend of the drive,
     *   the Westgate corner), so the deck's end is road on both shores.
     */
    const CORONATION_BRIDGE = {
      id: 'coronation',
      style: 'deco',
      movable: true,
      drawbridge: {
        openings: [40, 620], // 00:40, 10:20
        leafM: 36,
        title: 'Coronation Bridge',
        water: 'SOVEREIGN SOUND',
        ends: ['pier', 'isle'],
        look: 'deco',
        tender: 'CORONATION BRIDGE · 1937',
        vessel: { name: 'LADY GRACE', hull: '#f3efe6', accent: '#1d6f6a', start: 1 },
      },
      name: 'CORONATION BRIDGE',
      link: 'SUNSET PIER - MONARCH ISLE',
      width: 112,
      deck: 0,
      a: [3898, -5900],
      b: [5600, -4544],
      // Where Monarch Isle's traffic turns round on Sunset Pier (isleRoadGraph).
      pierTurn: [3420, -5900],
    };
    BRIDGES.push(CORONATION_BRIDGE);
    COUNTY_ROADS.push({ name: CORONATION_BRIDGE.name, width: CORONATION_BRIDGE.width, points: [CORONATION_BRIDGE.a, CORONATION_BRIDGE.b], bridge: true });
    /* The design: the bascule over the channel's middle, a column bent every 120
       along the causeway, and the four entrance pylons standing on the shore at
       each end of the deck (aircraft hit them). */
    BRIDGE_DESIGNS.deco = (bridge, [w0, w1], m, s) => {
      const W = bridge.width;
      basculeSpan(bridge, m, s);
      const b = s.bascule;
      s.approach = [...approachPiers(m - b.leaf - b.tail, w0, 120), ...approachPiers(m + b.leaf + b.tail, w1, 120)];
      s.deco = { pylons: [w0 - 30, w1 + 30], pylonHeight: 132, across: W / 2 + 12 };
      for (const along of s.deco.pylons)
        for (const side of [-1, 1]) s.solids.push({ along, across: side * s.deco.across, hx: 9, hy: 9, minHeight: 0, height: s.deco.pylonHeight, kind: 'pylon' });
    };
