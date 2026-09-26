    /* The civic layer: places, clock, services, police on foot, navigation and injury effects. */
    let worldMinutes = 17 * 60 + 20,
      servicePlace = null,
      searchActive = false,
      searchRemaining = 0,
      lastSeen = {
        ...spawn,
      },
      screamAt = -20,
      bloodOn = true;
    const officers = [],
      bloodPools = [];
    const PLACES = [
      {
        ...ROOFTOP,
        bx: -4,
        by: 4,
        kind: 'rooftop',
        color: '#9fdedb',
        symbol: 'LIFT',
      },
      {
        id: 'hospital',
        kind: 'hospital',
        name: 'SAINT MARLOW HOSPITAL',
        bx: 0,
        by: 1,
        x: 230,
        y: 744,
        w: 292,
        h: 184,
        height: 70,
        color: '#bcd4cf',
        symbol: '+',
        door: {
          x: 376,
          y: 948,
        },
      },
      {
        id: 'east-hospital',
        kind: 'hospital',
        name: 'RIVERSIDE MEDICAL',
        bx: -4,
        by: 3,
        x: -1814,
        y: 1770,
        w: 288,
        h: 182,
        height: 78,
        color: '#b5d4d3',
        symbol: '+',
        door: {
          x: -1670,
          y: 1972,
        },
      },
      {
        id: 'school',
        kind: 'school',
        name: 'SOUTH COAST COLLEGE',
        bx: 3,
        by: 4,
        x: 1770,
        y: 2280,
        w: 278,
        h: 156,
        height: 42,
        color: '#d6bb87',
        symbol: 'EDU',
        door: {
          x: 1909,
          y: 2456,
        },
      },
      {
        id: 'east-school',
        kind: 'school',
        name: 'RIVERSIDE HIGH SCHOOL',
        bx: -5,
        by: 1,
        x: -2328,
        y: 745,
        w: 285,
        h: 154,
        height: 42,
        color: '#dcc79c',
        symbol: 'EDU',
        door: {
          x: -2186,
          y: 919,
        },
      },
      {
        id: 'bar',
        kind: 'bar',
        name: 'THE RUSTY ANCHOR',
        bx: 0,
        by: 0,
        x: 245,
        y: 365,
        w: 230,
        h: 150,
        height: 38,
        color: '#dcaf70',
        symbol: 'BAR',
        door: {
          x: 360,
          y: 535,
        },
      },
      {
        id: 'east-bar',
        kind: 'bar',
        name: 'BAYVIEW TAVERN',
        bx: -5,
        by: 6,
        x: -2318,
        y: 3310,
        w: 267,
        h: 172,
        height: 42,
        color: '#dfbc82',
        symbol: 'BAR',
        door: {
          x: -2185,
          y: 3502,
        },
      },
      {
        id: 'club',
        kind: 'club',
        name: 'AFTERHOURS',
        bx: 2,
        by: 2,
        x: 1260,
        y: 1250,
        w: 275,
        h: 190,
        height: 45,
        color: '#ca8bdd',
        symbol: 'CLUB',
        door: {
          x: 1397,
          y: 1460,
        },
      },
      {
        id: 'east-club',
        kind: 'club',
        name: 'NEON PALACE',
        bx: -4,
        by: 7,
        x: -1814,
        y: 3820,
        w: 280,
        h: 185,
        height: 57,
        color: '#a08de8',
        symbol: 'CLUB',
        door: {
          x: -1674,
          y: 4025,
        },
      },
      {
        id: 'guns',
        kind: 'guns',
        name: 'SOUTH COAST ARMORY',
        bx: 1,
        by: 0,
        x: 746,
        y: 242,
        w: 260,
        h: 148,
        height: 36,
        color: '#cfb681',
        symbol: 'GUN',
        door: {
          x: 876,
          y: 410,
        },
      },
      {
        id: 'motel',
        kind: 'sleep',
        name: 'SUNSET MOTEL',
        bx: 1,
        by: 3,
        x: 745,
        y: 1770,
        w: 275,
        h: 174,
        height: 39,
        color: '#87c9c5',
        symbol: 'ZZ',
        door: {
          x: 882,
          y: 1964,
        },
      },
      {
        id: 'keys-motel',
        kind: 'sleep',
        name: 'CORAL PALMS MOTEL',
        bx: -5,
        by: 3,
        x: -2318,
        y: 1770,
        w: 270,
        h: 175,
        height: 32,
        color: '#dbb8ad',
        symbol: 'ZZ',
        door: {
          x: -2183,
          y: 1972,
        },
      },
      {
        id: 'diner',
        kind: 'diner',
        name: 'THE BLUE PLATE DINER',
        bx: 2,
        by: 1,
        x: 1256,
        y: 762,
        w: 284,
        h: 148,
        height: 32,
        color: '#e5c07a',
        symbol: 'EAT',
        door: {
          x: 1398,
          y: 930,
        },
      },
      {
        id: 'keys-diner',
        kind: 'diner',
        name: 'PALM GRILL · 24 HOURS',
        bx: -5,
        by: 4,
        x: -2328,
        y: 2286,
        w: 280,
        h: 140, // clear of Palm Keys Auto's lot (prepareGarages)
        height: 32,
        color: '#e8b384',
        symbol: 'EAT',
        door: {
          x: -2188,
          y: 2452,
        },
      },
      {
        id: 'outfitters',
        kind: 'clothes',
        name: 'SOUTH COAST OUTFITTERS',
        // Block (2, 6), across Commons St from Central Garden. It used to be
        // assigned block (3, 6), which is inside the park: the shop stood on the
        // rose garden with its front half out on Linden St.
        bx: 2,
        by: 6,
        x: 1258,
        y: 3306,
        w: 276,
        h: 150,
        height: 40,
        color: '#c3a6d3',
        symbol: 'FIT',
        door: {
          x: 1396,
          y: 3476,
        },
      },
      {
        id: 'keys-outfitters',
        kind: 'clothes',
        name: 'OCEAN DRIVE MENSWEAR',
        bx: -4,
        by: 6,
        x: -1814,
        y: 3272,
        w: 276,
        h: 150,
        height: 40,
        color: '#b7cfe0',
        symbol: 'FIT',
        door: {
          x: -1676,
          y: 3442,
        },
      },
      {
        id: 'home',
        kind: 'sleep',
        name: 'YOUR SAFEHOUSE',
        color: '#8ccba4',
        symbol: 'ZZ',
        door: safehouse,
      },
    ];
    const DOCKS = [
      {
        x: 3370,
        y: 1810,
        w: 94,
        h: 34,
        boatX: 3506,
        boatY: 1827,
        type: 'speedboat',
      },
      {
        x: 3370,
        y: 4200,
        w: 94,
        h: 34,
        boatX: 3510,
        boatY: 4217,
        type: 'workboat',
      },
      {
        x: -1192,
        y: 900,
        w: 92,
        h: 34,
        boatX: -1057,
        boatY: 917,
        type: 'speedboat',
      },
      {
        x: -1254,
        y: 2930,
        w: 94,
        h: 34,
        boatX: -1120,
        boatY: 2947,
        type: 'jetski',
      },
      // Airport inlet, off the esplanade on its east shore. It used to sit at the
      // narrow head of the inlet (1320, 5130), wholly on land once the airport
      // shore was reshaped, with its speedboat beached on the promenade.
      {
        x: 1500,
        y: 5230,
        w: 130,
        h: 34,
        boatX: 1462,
        boatY: 5247,
        type: 'speedboat',
      },
      // Harbor Point: the way out to the liner riding at anchor, off the basin's
      // east quay (x 1528). (This jetty was at y -3420, where it stood in the
      // street at y -3456, and then at x 1566, wholly on the quay.)
      {
        x: 1476,
        y: -3800,
        w: 96,
        h: 34,
        boatX: 1448,
        boatY: -3783,
        type: 'jetski',
      },
      {
        x: 1476,
        y: -3560,
        w: 96,
        h: 34,
        boatX: 1446,
        boatY: -3543,
        type: 'speedboat',
      },
    ];
    const PRICES = [180, 650, 900, 2600, 1400, 1900],
      AMMO_PRICES = [60, 120, 100, 450, 180, 160];
    function onDock(x, y, r = 0) {
      return DOCKS.some(
        (d) => x - r >= d.x && x + r <= d.x + d.w && y - r >= d.y && y + r <= d.y + d.h,
      );
    }
    function boatFits(c, x = c.x, y = c.y, a = c.a) {
      const shape = {
        ...vehicleShape(c, 1.5),
        x,
        y,
        a,
      };
      if (hullTouchesLand(shape)) return false;
      const reach = shape.hx + shape.hy;
      for (const b of boatObstacles())
        if (Math.abs(b.x - x) < reach + b.reach && Math.abs(b.y - y) < reach + b.reach && boxContact(shape, b)) return false;
      // The sailing liner moves, so her hull is asked for where she is now.
      for (const hull of movingLinerHulls()) if (boxContact(shape, hull)) return false;
      // So does the brigantine the Palm Sound drawbridge opens for (drawbridge.js).
      for (const hull of drawbridgeVesselHulls()) if (boxContact(shape, hull)) return false;
      return true;
    }
    /* Everything fixed that a boat steers round, as oriented boxes with a reach
       for a cheap distance test: the jetties, the Ironworks freighter, the
       footings of every bridge (boats pass under the decks between them; see
       bridgeStructure), and the marina (moored liner, yachts, pontoons). */
    let boatObstacleCache = null;
    function boatObstacles() {
      if (boatObstacleCache) return boatObstacleCache;
      const list = DOCKS.map((d) => ({ x: d.x + d.w / 2, y: d.y + d.h / 2, hx: d.w / 2, hy: d.h / 2, a: 0 }));
      for (const bridge of BRIDGES) list.push(...bridgeFootings(bridge));
      list.push({ x: HARBOR.ship.x, y: HARBOR.ship.y, hx: HARBOR.ship.w / 2, hy: HARBOR.ship.l / 2, a: 0 });
      list.push(...marinaObstacles());
      list.push(...monarchBoatObstacles());
      for (const b of list) b.reach = b.hx + b.hy;
      return (boatObstacleCache = list);
    }
    function isBoat(vehicle) {
      return !!vehicle && vehicleSpec(vehicle).boat;
    }
    /* The door in reach: within PLACE_REACH, and the one already in reach until
       PLACE_REACH_EXIT, so the prompt (e.g. at the hospital door after a respawn)
       and E hold steady while the player shuffles at the edge. */
    const PLACE_REACH = 52,
      PLACE_REACH_EXIT = 66;
    let placeInReach = null;
    function nearestPlace() {
      if (transitRide || playerOnRoof() || player.parachute) return (placeInReach = null);
      let best = null,
        bestDistance = Infinity;
      for (const place of PLACES) {
        const distance = distanceBetween(player, place.door);
        if (distance < (place === placeInReach ? PLACE_REACH_EXIT : PLACE_REACH) && distance < bestDistance) {
          best = place;
          bestDistance = distance;
        }
      }
      return (placeInReach = best);
    }
    function clockText() {
      const m = Math.floor(worldMinutes) % 1440;
      return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    }
    // Sun up 05:40, down 19:50; the curve is flattened so golden hour lingers.
    function daylight() {
      const hour = (worldMinutes % 1440) / 60,
        arc = Math.sin(((hour - 5.66) / 14.17) * Math.PI);
      return clamp(Math.pow(Math.max(0, arc), 0.75), 0, 1);
    }
    function clubOpen() {
      const hour = (worldMinutes % 1440) / 60;
      return hour >= 20 || hour < 5;
    }
    function selectWeapon(index) {
      if (player.car && player.car.type !== 'tank' && index !== 0 && index !== FISTS_INDEX) {
        tell('Only an owned 9mm pistol can be fired while driving or piloting.', 3);
        return false;
      }
      if (!weaponIsEquipped(index)) {
        tell('Discover this weapon at South Coast Armory. Look for GUN on the map.', 3);
        return false;
      }
      selectedWeaponIndex = index;
      reloadSecondsRemaining = 0;
      drawWeapon();
      save();
      return true;
    }
    function cycleWeapon() {
      // In a tank the switch is between the main gun and the coaxial MG (armor.js).
      if (toggleTankWeapon()) return;
      // In a vehicle: the pistol or nothing in hand.
      if (player.car && player.car.type !== 'tank') {
        if (selectedWeaponIndex !== FISTS_INDEX) selectWeapon(FISTS_INDEX);
        else if (weaponIsEquipped(0)) selectWeapon(0);
        else tell('Purchase a 9mm pistol to fire from a vehicle.');
        return;
      }
      const equipped = equippedWeaponIndices();
      selectWeapon(equipped[(equipped.indexOf(selectedWeaponIndex) + 1) % equipped.length]);
    }
    function openService(place) {
      if (!place) return;
      // An outfitter is the one door worth going through while the heat is on.
      if (wantedStars > 0 && place.kind !== 'clothes') {
        needToLosePolice();
        return;
      }
      if (player.car) {
        tell('Get out of your vehicle to enter.', 2);
        return;
      }
      servicePlace = place;
      gameMode = 'service';
      keys = {};
      mouse.down = false;
      renderService();
      getElement('serviceOverlay').classList.remove('hidden');
      getElement('closeService').focus();
    }
    function closeService() {
      servicePlace = null;
      getElement('serviceOverlay').classList.add('hidden');
      if (gameMode === 'service') gameMode = 'play';
      keys = {};
      canvas.focus();
    }
