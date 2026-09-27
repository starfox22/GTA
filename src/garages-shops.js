    // Garage plan and shops: GARAGE_PLAN (real-scale workshop), GARAGES (one per island at least, GARAGE_ISLANDS) and each shop's worked-out plan.
    const GARAGE_PLAN = {
      bayWidth: 10 * UNITS_PER_METRE, // inside faces of the side walls
      bayDepth: 15 * UNITS_PER_METRE, // door line to the back wall's inside face
      wall: 0.4 * UNITS_PER_METRE,
      eaves: 6.4 * UNITS_PER_METRE, // underside of the roof deck
      roof: 0.5 * UNITS_PER_METRE, // deck and parapet coping above the eaves
      doorWidth: 6 * UNITS_PER_METRE,
      doorHeight: 5 * UNITS_PER_METRE,
      officeWidth: 6 * UNITS_PER_METRE,
      officeDepth: 8 * UNITS_PER_METRE,
      officeHeight: SHOP_FLOOR,
      // Lift posts either side of the service spot (3.6 m apart inside).
      liftHalfSpan: 2.25 * UNITS_PER_METRE,
      // The facade stands this far south of the lot's centre (the apron in
      // front of the door is the rest of the lot, about 7.5 m), and the bay's
      // centre this far west of it (the office takes the east side).
      facadeOffset: 38,
      bayOffset: -24,
    };
    /* Physical repair bays: the same walls drive walking, vehicle contacts and rendering.
       Every shop's billboard carries the word MECHANICS (`tagline`). */
    const GARAGES = [
      {
        id: 'eastside',
        name: 'EASTSIDE GARAGE',
        tagline: 'MECHANICS · RESPRAY · REPAIR',
        x: 1320,
        y: 2022,
        roadY: 2176,
        color: '#83c5bd',
      },
      {
        id: 'palm',
        name: 'PALM KEYS AUTO',
        tagline: 'MECHANICS · RESPRAYS WHILE YOU WAIT',
        x: -2268,
        y: 2530,
        roadY: 2688,
        color: '#e5ab9d',
      },
      {
        id: 'south',
        name: 'SOUTH BANK MOTOR WORKS',
        tagline: 'MECHANICS · BODYWORK · PAINT',
        x: 2470,
        y: 3555,
        roadY: 3712,
        color: '#d9bc78',
      },
      {
        id: 'county',
        name: 'STONECREEK GARAGE',
        tagline: 'MECHANICS · TOWING · TYRES',
        x: 6950,
        y: 3555,
        roadY: 3712,
        color: '#8ebac8',
        // A mountain village's garage (mountain-village.js): fieldstone and
        // board-and-batten under a steep red metal gable, drawn by garage3d.js.
        rustic: true,
      },
      /* One on every island (GARAGE_ISLANDS): the ones below stand off the city's
         ground canvas, so `slab` has the renderer lay their lot (and `forecourt`,
         a paved way to the street where the apron does not meet one) and
         Monarch Isle paints its own on the island's tile. `style` picks the
         look (garage3d-styles.js). */
      {
        id: 'monarch',
        name: 'MONARCH COACHWORKS',
        tagline: 'COACHWORKS · DETAILING · PAINT',
        // Regent Court, block (2, 2), at the east end of the Regent Row frontage.
        x: 7800,
        y: -2301,
        roadY: -2144,
        color: '#d9b25a',
        island: 'monarch',
        style: 'coachworks',
      },
      {
        id: 'oceanview',
        name: 'OCEANVIEW AUTO BODY',
        tagline: 'MECHANICS · RESPRAY · TYRES',
        // The north-east block of Oceanview, by the causeway, on Oceanview Avenue.
        x: 2876,
        y: 7365,
        roadY: 7522,
        color: '#7fc4d8',
        island: 'oceanview',
        slab: true,
        slabTo: 7480,
      },
      {
        id: 'coral',
        name: 'CORAL COAST GARAGE',
        tagline: 'MECHANICS · RESPRAYS · A/C',
        // Palmshore's north-east block, on Palmshore Avenue by the Sentinel Causeway.
        x: 7450,
        y: 7955,
        roadY: 8112,
        color: '#f2a48a',
        island: 'coralcoast',
        style: 'seaside',
        slab: true,
        slabTo: 8070,
      },
      {
        id: 'pier',
        name: 'PIER GARAGE',
        tagline: 'MECHANICS · RESPRAY · SINCE 1952',
        // West of the bridge landing, beside the gate plaza; the forecourt meets
        // Pier Island Drive (the island's only road) where it leaves the bridge.
        x: 2985,
        y: -5935,
        roadY: -5780,
        color: '#8fd3c8',
        island: 'sunsetisle',
        style: 'seaside',
        slab: true,
        forecourt: { x: 2900, y: -5897, w: 256, h: 110 },
      },
      {
        id: 'sentinel',
        name: 'CAUSEWAY GARAGE',
        tagline: 'MECHANICS · RESPRAY · TOWING',
        // Outside Fort Sentinel's fence, on the civilian strip where the causeway
        // lands (beside SENTINEL SURPLUS, whose building `clear` keeps standing).
        x: 8925,
        y: 8003,
        roadY: 8143,
        color: '#b7b86e',
        island: 'sentinel',
        slab: true,
        clear: 72,
      },
    ];
    // Every island a car can reach has a shop (tools/tests/garages-islands.mjs).
    const GARAGE_ISLANDS = { northbank: ['eastside', 'south'], palmkeys: ['palm'], ridgeline: ['county'], monarch: ['monarch'], oceanview: ['oceanview'], coralcoast: ['coral'], sunsetisle: ['pier'], sentinel: ['sentinel'] },
      GARAGE_ISLAND_OF = Object.fromEntries(Object.entries(GARAGE_ISLANDS).flatMap(([island, ids]) => ids.map((id) => [id, island])));
    /* Each shop's plan in map units, worked out once: the bay (inside faces),
       the facade line, the door, the office, the service spot on the lift and
       the apron exit. The door's `open` (0 shut .. 1 up) is live state. */
    for (const s of GARAGES) {
      const P = GARAGE_PLAN,
        bayX = s.x + P.bayOffset,
        front = s.y + P.facadeOffset,
        inner = front - P.wall;
      s.bayX = bayX;
      s.front = front;
      s.bay = { x0: bayX - P.bayWidth / 2, x1: bayX + P.bayWidth / 2, y0: inner - P.bayDepth, y1: inner };
      s.back = s.bay.y0 - P.wall;
      s.door = { x0: bayX - P.doorWidth / 2, x1: bayX + P.doorWidth / 2, y: front - P.wall / 2 };
      s.office = { x: s.bay.x1 + P.wall, y: front - P.officeDepth, w: P.officeWidth, h: P.officeDepth };
      s.service = { x: bayX, y: inner - P.bayDepth / 2 };
      s.open = 1;
      s.lotY1 = s.roadY - 56;
    }
