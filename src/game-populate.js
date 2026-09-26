    // Initial population: showcase parking (SHOWCASE_PARKING, parkShowcase) and populate().
    /* SHOWCASE PARKING: the flagships (cars3d.js, motorbikes3d.js) where the money
       parks, and the KR 500 where the dirt starts. Stealing one is like stealing
       any parked car. */
    const SHOWCASE_PARKING = [
      // North Point, the financial district: mid-block on the avenue under the towers.
      { place: 'NORTH POINT', x: 2688, y: -2780, a: -Math.PI / 2, dir: Math.PI / 2, gap: 52, kerb: Math.PI, types: ['brutini', 'chevette', 'cavalino'] },
      // The marina: down the street from the quay, by the yachts.
      { place: 'MARINA', x: 1150, y: -3180, a: Math.PI / 2, dir: Math.PI / 2, gap: 52, kerb: Math.PI, types: ['cavalino', 'yamasaki', 'chevette'] },
      // Marea Beach Club: the valet line past the taxi rank.
      { place: 'MAREA VALET', x: -2756, y: 5272, a: 0, dir: 0, gap: 52, kerb: Math.PI / 2, types: ['brutini', 'dolcati'] },
      // Sunset Pier: nose-in in the VIP bays at the east end of the car park.
      { place: 'SUNSET PIER VIP', x: 3676, y: -5806, a: -Math.PI / 2, dir: 0, gap: 27, types: ['chevette', 'brutini', 'cavalino'] },
      // Monarch Isle: outside the villa gates on Ocean Crescent, and on Marina Drive.
      { place: 'MONARCH ISLE VILLAS', x: 6800, y: -4544, a: 0, dir: 0, gap: 54, kerb: -Math.PI / 2, types: ['cavalino', 'brutini'] },
      { place: 'MONARCH ISLE MARINA', x: 8400, y: -1344, a: Math.PI, dir: 0, gap: 54, kerb: Math.PI / 2, types: ['chevette', 'dolcati'] },
      // The Ridgeline trailheads and a county lodge: dirt bikes.
      { place: 'MOUNT ASCENT TRAILHEAD', x: 7470, y: 2010, a: -Math.PI / 2, dir: 0, gap: 16, types: ['kr500', 'kr500'] },
      { place: 'NEEDLE RIDGE TRAILHEAD', x: 9460, y: 2900, a: -Math.PI / 2, dir: 0, gap: 16, types: ['kr500'] },
      { place: 'STONECREEK LODGE', x: 6990, y: 3236, a: 0, dir: 0, gap: 16, types: ['kr500'] },
    ];
    /* Each spot's vehicles line up from (x, y) along `dir`, `gap` apart, facing
       `a`; on a street (`kerb`: the direction of its edge) each slides over to
       the kerb, staying wholly on the tarmac. A vehicle that cannot fit near its
       place is left out. */
    function parkShowcase() {
      const parked = [];
      for (const spot of SHOWCASE_PARKING)
        spot.types.forEach((type, i) => {
          const half = VEHICLE_DEFINITIONS[type].w / 2 + 4;
          let x = spot.x + Math.cos(spot.dir) * i * spot.gap,
            y = spot.y + Math.sin(spot.dir) * i * spot.gap;
          if (spot.kerb !== undefined && cityStreetAt(x, y, -half))
            for (let d = 3; d < 160; d += 3) {
              const px = x + Math.cos(spot.kerb) * 3,
                py = y + Math.sin(spot.kerb) * 3;
              if (!cityStreetAt(px, py, -half)) break;
              x = px;
              y = py;
            }
          for (let r = 0; r < 60; r += 6)
            for (let k = 0; k < (r ? 12 : 1); k++) {
              const px = x + Math.cos((k * TAU) / 12) * r,
                py = y + Math.sin((k * TAU) / 12) * r;
              if (!canSpawnCar(type, px, py, spot.a, 4)) continue;
              parked.push(makeCar(type, px, py, spot.a, false, vehiclePaint(type)));
              return;
            }
        });
      return parked;
    }
    function populate() {
      vehicles.length = 0;
      pedestrians.length = 0;
      enemies.length = 0;
      pickups.length = 0;
      officers.length = 0;
      bloodPools.length = 0;
      fires.length = 0;
      debris.length = 0;
      particles.length = 0;
      skids.length = 0;
      makeCar('coupe', 782, 576, 0, false, '#88bcaa');
      makeCar('bike', 850, 704, 0, false);
      makeCar('supercar', 975, 704, 0, false);
      // Clear of Royal Ave (x 1096..1208): at x 1100 its nose stood in the
      // southbound lane and traffic queued behind it for ever.
      makeCar('roadster', 1040, 704, 0);
      makeCar('rally', 1300, 704, 0);
      makeCar('hotrod', 1510, 576, 0);
      makeCar('limousine', -1614, 1728, 0);
      parkShowcase();
      for (const d of DOCKS) makeCar(d.type, d.boatX, d.boatY, Math.PI / 2, false);
      for (const p of PLACES)
        if (p.kind === 'hospital') makeCar('ambulance', p.door.x + 94, p.door.y + 18, 0, false);
      makeCar('truck', 2850, 576, 0, false);
      makeCar('bus', 1410, 576, 0, false);
      for (const pad of HELIPADS) makeCar('helicopter', pad.x, pad.y, 0, false);
      for (let i = 0; i < 4; i++) makeCar('police', 1280 + i * 53, 3995, Math.PI / 2, false);
      for (const p of [
        {
          x: 2700,
          y: 1177,
        },
        {
          x: -1554,
          y: 3225,
        },
      ]) {
        const c = makeCar('police', p.x, p.y, 0, true);
        c.cop = false;
      }
      physicsAccumulator = 0;
      impactContacts.clear();
      for (let i = 0; i < 150; i++) {
        const vert = seededRandom() > 0.5,
          r = randomChoice(vert ? ROAD_CENTERS : ROAD_ROWS),
          v = vert
            ? randomBetween(CITY_TOP + 170, CITY_SIZE - 260)
            : randomBetween(CITY_LEFT + 170, CITY_SIZE - 260),
          dir = seededRandom() > 0.5 ? 1 : -1,
          x = vert ? r - dir * 25 : v,
          y = vert ? v : r + dir * 25,
          a = vert ? (dir * Math.PI) / 2 : dir === 1 ? 0 : Math.PI,
          // One car in forty is a flagship (cars3d.js, motorbikes3d.js).
          type = seededRandom() < 0.025 ? randomChoice(FLAGSHIP_TYPES) : randomChoice([
            'sedan',
            'sedan',
            'taxi',
            'coupe',
            'muscle',
            'van',
            'sport',
            'luxury',
            'suv',
            'pickup',
            'truck',
            'bus',
            'bike',
            'cruiser',
            'supercar',
            'roadster',
            'rally',
            'hotrod',
            'limousine',
          ]);
        if (
          Math.abs(v - (vert ? rowNear(v) : roadNear(v))) < 145 ||
          inHarbor(x, y, 70) ||
          !trafficSpawnValid(x, y, a) ||
          !canSpawnCar(type, x, y, a, 12)
        )
          continue;
        makeCar(
          type,
          x,
          y,
          a,
          true,
          vehiclePaint(type),
        );
      }
      for (let i = 0; i < 70; i++) {
        const r = randomChoice(ROAD_ROWS),
          v = randomBetween(CITY_LEFT + 240, CITY_SIZE - 260),
          side = randomChoice([-1, 1]),
          x = v,
          y = r + side * 64,
          a = side > 0 ? 0 : Math.PI,
          type = randomChoice([
            'sedan',
            'van',
            'muscle',
            'sport',
            'taxi',
            'bike',
            'cruiser',
            'supercar',
            'luxury',
            'suv',
            'pickup',
            'roadster',
            'rally',
            'hotrod',
            'limousine',
          ]);
        if (
          !cityStreetAt(x, y, 30) ||
          Math.abs(v - rowNear(v)) < 125 ||
          inHarbor(x, y, 40) ||
          !canSpawnCar(type, x, y, a, 8)
        )
          continue;
        makeCar(type, x, y, a, false, vehiclePaint(type));
      }
      const PED_COLORS = DRIVER_COLORS;
      for (let i = 0; i < 380; i++) {
        const vertical = seededRandom() > 0.5,
          r = randomChoice(vertical ? ROAD_CENTERS : ROAD_ROWS),
          v = vertical
            ? randomBetween(CITY_TOP + 180, CITY_SIZE - 260)
            : randomBetween(CITY_LEFT + 180, CITY_SIZE - 260),
          x = vertical ? r + randomChoice([-67, 67]) : v,
          y = vertical ? v : r + randomChoice([-67, 67]);
        if (!solid(x, y, 5) && !inHarbor(x, y, 8) && !vehicles.some((c) => pointInCar(x, y, c, 10))) {
          const walker = {
            x,
            y,
            a: vertical ? randomChoice([-Math.PI / 2, Math.PI / 2]) : randomChoice([0, Math.PI]),
            color: randomChoice(PED_COLORS),
            hp: 30,
            flee: 0,
            timer: randomBetween(0, 8),
            walk: seededRandom() * 5,
            state: 'walk',
          };
          pedestrians.push(walker);
          // Roughly one in five walkers has company.
          if (seededRandom() < 0.2) {
            const side = randomChoice([-1, 1]),
              px = x + Math.cos(walker.a + Math.PI / 2) * 9 * side,
              py = y + Math.sin(walker.a + Math.PI / 2) * 9 * side;
            if (!solid(px, py, 5))
              pedestrians.push({
                x: px,
                y: py,
                a: walker.a,
                color: randomChoice(PED_COLORS),
                hp: 30,
                flee: 0,
                timer: randomBetween(0, 8),
                walk: seededRandom() * 5,
                state: 'walk',
                leader: walker,
                pairSide: side,
              });
          }
        }
      }
      [
        [790, 745],
        [1290, 2176],
        [3200, 2780],
        [1650, 2820],
        [2655, 1140],
      ].forEach(([x, y]) =>
        pickups.push({
          x,
          y,
          type: 'health',
          ready: 0,
        }),
      );
      [
        [1040, 640],
        [2240, 2176],
        [2810, 1664],
        [2176, 2870],
        [640, 2688],
      ].forEach(([x, y]) =>
        pickups.push({
          x,
          y,
          type: 'ammo',
          ready: 0,
        }),
      );
      populateCasino();
      resetSports();
      [
        [128, 1800],
        [2700, 2176],
        [3200, 750],
      ].forEach(([x, y]) =>
        pickups.push({
          x,
          y,
          type: 'armor',
          ready: 0,
        }),
      );
    }
