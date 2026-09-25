    // BEGIN SUBSYSTEM: src/citylife.js — Civic services and police
    /**
     * Civic services and police
     * Source: src/citylife.js
     * Scope: shared game closure.
     * Clock, businesses, officers, police routing, wanted search and injury effects.
     */
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
        h: 140, // clear of Palm Auto Paint's lot (prepareGarages)
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
      // So does the ketch that works the Palm Sound drawbridge (drawbridge.js).
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
    function renderService() {
      const p = servicePlace;
      if (!p) return;
      getElement('serviceName').textContent = p.name;
      getElement('serviceClock').textContent =
        'DAY ' +
        (Math.floor(worldMinutes / 1440) + 1) +
        ' · ' +
        clockText() +
        ' · $' +
        Math.floor(visibleCash()).toLocaleString();
      let text = '',
        options = [];
      getElement('casinoTable').classList.add('hidden');
      if (p.kind === 'casino') {
        text =
          'Single-zero roulette · Red or black returns 2× your bet; a winning number returns 36×. Zero wins only a number bet.';
        renderCasino();
      }
      if (p.kind === 'guns') {
        text =
          'Every weapon you buy is equipped immediately. Click the weapon box to open your arsenal.';
        options = weapons.map((w, i) => ({
          text:
            i +
            1 +
            '. ' +
            w.name +
            ' · ' +
            (w.owned ? 'REFILL $' + AMMO_PRICES[i] : 'BUY $' + PRICES[i]),
          action: 'weapon',
          slot: i,
        }));
        options.push({
          text: '7. BODY ARMOR · $350',
          action: 'armor',
        });
      }
      if (p.kind === 'hospital') {
        text = 'Emergency care · open 24 hours. Treatment restores your health.';
        options = [
          {
            text: '1. GET TREATMENT · $150',
            action: 'heal',
          },
        ];
      }
      if (p.kind === 'sleep') {
        text =
          'A room, a locked door, and a few hours off the streets. Sleep restores all health. Timed jobs must be finished first.';
        options = [
          {
            text: '1. SLEEP 6 HOURS · FREE',
            action: 'sleep',
          },
          {
            text: '2. SLEEP UNTIL 08:00 · FREE',
            action: 'morning',
          },
        ];
      }
      if (p.kind === 'bar') {
        text = 'Hot food and a quiet corner. A meal restores 30 health.';
        options = [
          {
            text: '1. ORDER A MEAL · $35',
            action: 'meal',
          },
        ];
      }
      if (p.kind === 'club') {
        text = clubOpen()
          ? 'Music downstairs. Open 20:00–05:00. Take a 30-minute break and restore 20 health.'
          : 'Doors open at 20:00. Come back tonight.';
        if (clubOpen())
          options = [
            {
              text: '1. ENTER THE CLUB · $80',
              action: 'club',
            },
          ];
      }
      if (p.kind === 'diner') {
        text =
          'Counter service, booths at the back, open around the clock. A plate of food and a coffee put you back together.';
        options = [
          {
            text: '1. BLUE PLATE SPECIAL · $28',
            action: 'plate',
          },
          {
            text: '2. COFFEE AND A BOOTH · $9',
            action: 'coffee',
          },
        ];
      }
      if (p.kind === 'clothes') {
        // A change of clothes is only worth anything while the search is running
        // on a description rather than on eyes actually on you.
        const useful = wantedStars > 0 && searchActive;
        text = useful
          ? 'Racks of workwear and a changing room with a back door. While the police are working from a description, new clothes end the search.'
          : 'Racks of workwear, a changing room and a back door. Worth remembering when a patrol has lost sight of you.';
        options = [
          {
            text: '1. CHANGE OF CLOTHES · $200',
            action: 'change',
          },
        ];
      }
      if (p.kind === 'school')
        text =
          'Classes 08:00–18:00. The campus includes teaching buildings, a courtyard and sports courts.';
      getElement('serviceDescription').textContent = text;
      const list = getElement('serviceActions');
      list.replaceChildren();
      options.forEach((o) => {
        const b = document.createElement('button');
        b.className = 'secondary service-option';
        b.textContent = o.text;
        b.onclick = () => serviceAction(o.action, o.slot);
        list.appendChild(b);
      });
    }
    function serviceAction(action, slot = 0) {
      if (gameMode !== 'service' || !servicePlace) return false;
      if (wantedStars > 0 && action !== 'change') return needToLosePolice();
      let cost = 0,
        advance = 0,
        health = 0;
      if (action === 'weapon') {
        if (servicePlace.kind !== 'guns' || !weapons[slot]) return false;
        const w = weapons[slot],
          reserveTarget = w.clip * (w.rocket ? 5 : 7);
        if (w.owned && w.ammo >= w.clip && w.reserve >= reserveTarget) {
          tell('Ammunition is already full.', 3);
          return false;
        }
        cost = w.owned ? AMMO_PRICES[slot] : PRICES[slot];
        if (cash < cost) {
          tell('Not enough cash. Complete a payphone job.', 3);
          return false;
        }
        cash -= cost;
        w.owned = true;
        w.ammo = Math.max(w.ammo, w.clip);
        w.reserve = Math.max(w.reserve, reserveTarget);
        selectWeapon(slot);
        tell(w.name + ' equipped and ready.', 4);
        save();
        renderService();
        drawWeapon();
        return true;
      }
      if (action === 'armor') {
        if (servicePlace.kind !== 'guns') return false;
        cost = 350;
      } else if (action === 'heal') {
        if (servicePlace.kind !== 'hospital') return false;
        cost = 150;
        health = 100;
      } else if (action === 'meal') {
        if (servicePlace.kind !== 'bar') return false;
        cost = 35;
        health = 30;
      } else if (action === 'plate') {
        if (servicePlace.kind !== 'diner') return false;
        cost = 28;
        health = 45;
        advance = 25;
      } else if (action === 'coffee') {
        if (servicePlace.kind !== 'diner') return false;
        cost = 9;
        health = 12;
        advance = 10;
      } else if (action === 'change') {
        if (servicePlace.kind !== 'clothes') return false;
        cost = 200;
        if (cash < cost) {
          tell('Not enough cash.', 2);
          return false;
        }
        cash -= cost;
        advance = 12;
        worldMinutes += advance;
        if (wantedStars > 0 && searchActive) {
          clearPolice(true);
          announce('NEW CLOTHES', 'DESCRIPTION USELESS', 3);
        } else {
          announce('BACK ON THE STREETS', 'CHANGED', 2.2);
          if (wantedStars > 0) tell('They can still see you. Clothes will not help while they can.', 4);
        }
        save();
        closeService();
        return true;
      } else if (action === 'club') {
        if (servicePlace.kind !== 'club' || !clubOpen()) return false;
        cost = 80;
        health = 20;
        advance = 30;
      } else if (action === 'sleep' || action === 'morning') {
        if (servicePlace.kind !== 'sleep') return false;
        advance = action === 'sleep' ? 360 : (480 - (worldMinutes % 1440) + 1440) % 1440 || 1440;
        health = 100;
      } else return false;
      if (advance && mission?.timeLimit) {
        tell('Finish the timed job before taking a break.', 3);
        return false;
      }
      if (cash < cost) {
        tell('Not enough cash.', 2);
        return false;
      }
      cash -= cost;
      worldMinutes += advance;
      player.hp = Math.min(100, player.hp + health);
      if (action === 'armor') player.armor = 100;
      save();
      closeService();
      announce(
        advance
          ? 'DAY ' + (Math.floor(worldMinutes / 1440) + 1) + ' · ' + clockText()
          : 'BACK ON THE STREETS',
        advance ? 'RESTED & READY' : action === 'armor' ? 'ARMORED UP' : 'FEELING BETTER',
        2.5,
      );
      return true;
    }
    function serviceKey(code) {
      if (code === 'Escape' || code === 'KeyE') {
        closeService();
        return;
      }
      if (servicePlace?.kind === 'casino') {
        if (code === 'Enter') spinCasino();
        return;
      }
      const n = Number(code.replace('Digit', '')) - 1,
        p = servicePlace;
      if (n < 0 || n > 6) return;
      if (p.kind === 'guns') serviceAction(n === 6 ? 'armor' : 'weapon', n);
      else {
        const action =
          p.kind === 'sleep'
            ? n === 0
              ? 'sleep'
              : n === 1
                ? 'morning'
                : null
            : p.kind === 'diner'
              ? n === 0
                ? 'plate'
                : n === 1
                  ? 'coffee'
                  : null
              : n === 0
                ? {
                    hospital: 'heal',
                    bar: 'meal',
                    club: 'club',
                    clothes: 'change',
                  }[p.kind]
                : null;
        if (action) serviceAction(action);
      }
    }
    /**
     * DAILY RHYTHM
     * The pavement at eight in the morning is not the pavement at two. The tempo
     * shifts the mix between walking, loitering, window shopping and sitting, how
     * quickly people move, and how many of them are out at all (`out` scales the
     * crowd streamer's target in src/crowd.js). Thinning the crowd removes
     * pedestrians rather than hiding them, so nothing invisible is left in the
     * world for bullets, traffic or the police to find.
     */
    function cityTempo() {
      const hour = (worldMinutes / 60) % 24;
      // Walking pace, 4-6 km/h: brisk in the rush hours, an amble at lunch.
      if (hour < 2) return { name: 'AFTER MIDNIGHT', speed: 4.7 * KMH, idle: 0.1, shop: 0.05, bench: 0.1, out: 0.36 };
      if (hour < 5.5) return { name: 'NIGHT', speed: 4.9 * KMH, idle: 0.06, shop: 0.03, bench: 0.08, out: 0.17 };
      if (hour < 9.5) return { name: 'MORNING RUSH', speed: 5.6 * KMH, idle: 0.04, shop: 0.07, bench: 0.1, out: 1 };
      if (hour < 11.5) return { name: 'MORNING', speed: 4.4 * KMH, idle: 0.12, shop: 0.26, bench: 0.34, out: 0.86 };
      if (hour < 14.5) return { name: 'LUNCH', speed: 4.2 * KMH, idle: 0.15, shop: 0.34, bench: 0.5, out: 1 };
      if (hour < 17.5) return { name: 'AFTERNOON', speed: 4.4 * KMH, idle: 0.11, shop: 0.27, bench: 0.38, out: 0.88 };
      if (hour < 19.5) return { name: 'EVENING RUSH', speed: 5.4 * KMH, idle: 0.05, shop: 0.1, bench: 0.14, out: 1 };
      if (hour < 23) return { name: 'EVENING', speed: 4.5 * KMH, idle: 0.17, shop: 0.24, bench: 0.4, out: 0.82 };
      return { name: 'LATE', speed: 5.1 * KMH, idle: 0.08, shop: 0.07, bench: 0.12, out: 0.42 };
    }
    function ordinaryWalker(p) {
      return (
        !p.gymStation &&
        !p.vendor &&
        !p.queueing &&
        !p.parkGuest &&
        !p.club &&
        !p.parkRoute &&
        !p.leader &&
        !p.ejected &&
        !p.angryUntil &&
        !p.witnessUntil &&
        p.hp > 0
      );
    }
    /* Crowd size and placement are handled by the streamer in src/crowd.js. */
    function updateCrowdDensity(deltaSeconds) {
      streamCrowd(deltaSeconds);
    }
    /**
     * ESCAPE WINDOW
     * How long you have to stay out of sight before the search is called off:
     * six seconds at one star up to twenty-four at five (pursuit.js). Any unit
     * that sees you, on the ground or in the air, starts it again.
     */
    function policeSearchSeconds(stars = wantedStars) {
      return pursuitSearchSeconds(stars);
    }
    function clearPolice(notifyEscape = false) {
      clearRoadblocks();
      const wasWanted = wantedStars > 0;
      if (notifyEscape && wasWanted) policeClearedNotice();
      // Losing the police means losing all of them. A respray used to leave the
      // helicopter overhead, which is the one unit a change of paint fools best.
      let announced = false;
      for (const air of vehicles)
        if (air.airUnit && air.hp > 0 && !air.airRetreat && air !== player.car) {
          retireAirSupport(air, notifyEscape && wasWanted && !announced);
          announced = true;
        }
      wantedStars = 0;
      resetHeat();
      searchRemaining = 0;
      searchActive = false;
      copSpawn = 5;
      dispatchTimer = 3;
      arrestProgress = 0;
      for (const o of officers) if (o.hp > 0 && !o.gangTarget) o.state = 'return';
      for (const c of vehicles)
        if (c.cop) {
          c.cop = false;
          // Patrol cars go back to patrolling; SWAT vans, agents and the tank wait
          // where they are until they are out of sight and sent home (pursuit.js).
          c.ai = !c.crewDeployed && !c.crewLost && !c.lawUnit;
          c.route = null;
          c.junction = null;
          c.navAngle = undefined;
        }
    }
    function resetOfficerCrews() {
      for (const c of vehicles) {
        if (c.crewDeployed) {
          c.crewDeployed = false;
          c.ai = c.hp > 0 && !c.stolen && !c.crewLost;
        }
        c.crew = [];
        c.gangTarget = null;
      }
      officers.length = 0;
    }
    function lawVehicle(vehicle) {
      return (
        (vehicle.type === 'police' || !!vehicle.lawUnit) &&
        vehicle.hp > 0 &&
        !vehicle.crewLost &&
        !vehicle.stolen &&
        vehicle !== player.car
      );
    }
    function recentGangThreat(e) {
      return (
        e.hp > 0 && (gameTime - (e.lastShotAt ?? -100) < 8 || (e.policeThreatUntil || 0) > gameTime)
      );
    }
    function policeGangTarget(o) {
      let target = null,
        best = 420;
      for (const e of [...gangMembers, ...enemies]) {
        if (e.military || !recentGangThreat(e) || harborPoliceProtected(e.x, e.y, 30)) continue;
        const d = distanceBetween(o, e);
        if (d < best && clearSight(o, e)) {
          target = e;
          best = d;
        }
      }
      if (target) {
        target.policeThreatUntil = gameTime + 12;
        o.gangLastSeen = {
          x: target.x,
          y: target.y,
        };
        o.gangSeenAt = gameTime;
        return target;
      }
      const old = o.gangTarget;
      return old?.hp > 0 &&
        !old.military &&
        !harborPoliceProtected(old.x, old.y, 30) &&
        gameTime - (o.gangSeenAt ?? -100) < 12 &&
        distanceBetween(o, old) < 650
        ? old
        : null;
    }
    /* Does the segment a->b (heights start->start+dz) pass through a block? A slab
       test in x, y and height, with a 2-unit skin so rays do not graze corners. */
    function sightBlockedBy(block, ax, ay, start, dx, dy, dz) {
      let lo = 0,
        hi = 1;
      for (let axis = 0; axis < 3; axis++) {
        const pos = axis === 0 ? ax : axis === 1 ? ay : start,
          delta = axis === 0 ? dx : axis === 1 ? dy : dz,
          min = axis === 0 ? block.x - 2 : axis === 1 ? block.y - 2 : -10,
          max = axis === 0 ? block.x + block.w + 2 : axis === 1 ? block.y + block.h + 2 : block.height + 2;
        if (Math.abs(delta) < 1e-8) {
          if (pos < min || pos > max) return false;
        } else {
          let t1 = (min - pos) / delta,
            t2 = (max - pos) / delta;
          if (t1 > t2) [t1, t2] = [t2, t1];
          if (t1 > lo) lo = t1;
          if (t2 < hi) hi = t2;
          if (lo > hi) return false;
        }
      }
      return hi > 0.0001 && lo < 0.9999;
    }
    let sightStamp = 0;
    /* Line of sight between two entities. Every officer, cruiser and helicopter
       asks this every frame at five stars, so buildings come from the building
       grid cells the segment's bounding box covers (each tested once) rather
       than from the whole city. */
    function clearSight(a, b) {
      if (airCoverRay(a, b)) return false;
      const start = entityElevation(a) + 14,
        end = entityElevation(b) + 14,
        dx = b.x - a.x,
        dy = b.y - a.y,
        dz = end - start;
      if (a.x > CITY_SIZE || b.x > CITY_SIZE || a.y > CITY_SIZE || b.y > CITY_SIZE) {
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 24));
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          if (terrainHeight(a.x + dx * t, a.y + dy * t) > start + dz * t) return false;
        }
      }
      if (buildingGrid.size) {
        const stamp = ++sightStamp,
          x0 = Math.floor((Math.min(a.x, b.x) - 8) / BUILDING_CELL),
          x1 = Math.floor((Math.max(a.x, b.x) + 8) / BUILDING_CELL),
          y0 = Math.floor((Math.min(a.y, b.y) - 8) / BUILDING_CELL),
          y1 = Math.floor((Math.max(a.y, b.y) + 8) / BUILDING_CELL);
        for (let i = x0; i <= x1; i++)
          for (let j = y0; j <= y1; j++) {
            const cell = buildingGrid.get(i * 4096 + j);
            if (!cell) continue;
            for (const block of cell) {
              if (block.sightStamp === stamp) continue;
              block.sightStamp = stamp;
              if (sightBlockedBy(block, a.x, a.y, start, dx, dy, dz)) return false;
            }
          }
      } else
        for (const block of buildings)
          if (sightBlockedBy(block, a.x, a.y, start, dx, dy, dz)) return false;
      // The other solids: a bounding-box reject first (the county lists are long).
      const minX = Math.min(a.x, b.x) - 4,
        maxX = Math.max(a.x, b.x) + 4,
        minY = Math.min(a.y, b.y) - 4,
        maxY = Math.max(a.y, b.y) + 4;
      const lists = [
        garageWalls(),
        militarySolids(),
        countyStaticSolids,
        AIRPORT_SCENERY_SOLIDS,
        depotSolids(),
        harborSolids(),
      ];
      for (let i = 0; i < lists.length; i++)
        for (const block of lists[i])
          if (
            block.x <= maxX &&
            block.x + block.w >= minX &&
            block.y <= maxY &&
            block.y + block.h >= minY &&
            // Low harbor clutter (bollards, crates) does not block a line of sight.
            (i < 5 || block.height > 14) &&
            sightBlockedBy(block, a.x, a.y, start, dx, dy, dz)
          )
            return false;
      return true;
    }
    function policeSees(o) {
      if (o.airUnit) return !harborPoliceProtected(player.x, player.y, 30) && airCanSee(o, player);
      return (
        !harborPoliceProtected(player.x, player.y, 30) &&
        !playerOnRoof() &&
        o.hp > 0 &&
        !personIncapacitated(o) &&
        !o.crewLost &&
        Math.hypot(o.x - player.x, o.y - player.y, entityElevation(o) - entityElevation(player)) <
          440 &&
        clearSight(o, player)
      );
    }
    function deployOfficers(c) {
      // The tank and the army jeeps keep their crews aboard (pursuit.js).
      if (c.crewDeployed || c.crewLost || c.hp <= 0 || c.lawUnit === 'army' || c.lawUnit === 'armyJeep') return;
      c.crewDeployed = true;
      c.ai = false;
      c.vx = c.vy = c.speed = c.av = 0;
      c.crew = [];
      // A patrol car carries two, an agents' SUV three (they climb out on both
      // sides), a SWAT van four or five who file out of the rear doors behind a
      // shield (swat.js), an army APC four soldiers and a truck five (pursuit.js).
      const swat = c.lawUnit === 'swat',
        army = c.lawUnit === 'armyApc' || c.lawUnit === 'armyTruck',
        unit = swat ? 'swat' : c.lawUnit === 'fed' ? 'fed' : army ? 'soldier' : 'patrol',
        size = c.crewSize || 2,
        doors = [
          [-1, 0],
          [1, 0],
          [-1, -0.3],
          [1, -0.3],
          [-1, -0.55],
          [1, -0.55],
        ].slice(0, size),
        rear = swat || army ? swatDeploySpots(c, size) : null,
        team = {};
      if (swat) c.doorsOpenAt = gameTime;
      for (const [index, [side, back]] of doors.entries()) {
        let spawnPoint = rear ? rear[index] || null : null;
        // Patrol and agents' crews: the nearest free spot beside their door.
        for (const radius of rear ? [] : [25, 35, 47]) {
          const a = c.a + (side * Math.PI) / 2,
            p = {
              x: c.x + Math.cos(a) * radius + Math.cos(c.a) * back * 60,
              y: c.y + Math.sin(a) * radius + Math.sin(c.a) * back * 60,
            };
          if (
            !harborPoliceProtected(p.x, p.y, 12) &&
            !solid(p.x, p.y, 8) &&
            !vehicles.some(
              (o) =>
                o !== c &&
                Math.abs(entityElevation(o) - terrainHeight(p.x, p.y)) < 20 &&
                pointInCar(p.x, p.y, o, 8),
            )
          ) {
            spawnPoint = p;
            break;
          }
        }
        if (!spawnPoint) continue;
        const o = makeOfficer(spawnPoint.x, spawnPoint.y, c.a, unit, {
          car: c,
          timer: 0.8 + c.crew.length * 0.2,
          gangTarget: c.gangTarget || null,
          gangSeenAt: gameTime,
          gangLastSeen: c.gangLastSeen,
        });
        // Patrol officers wear a light vest; at four stars and up a heavier one.
        if (unit === 'patrol' && wantedStars >= 4) o.vest = 60;
        if (swat) equipSwatOperator(o, c.crew.length, team);
        officers.push(o);
        c.crew.push(o);
      }
      if (!c.crew.length) {
        c.crewDeployed = false;
        return;
      }
      radio(policeChallengeLine(), c);
    }
    function footStepTowards(o, target, deltaSeconds, speed) {
      if (personIncapacitated(o)) return;
      if (o.limping) speed *= 0.6;
      let a = headingBetween(o, target),
        dx = Math.cos(a) * speed * deltaSeconds,
        dy = Math.sin(a) * speed * deltaSeconds;
      if (moveBody(o, dx, dy, 8)) {
        for (const turn of [1, -1]) {
          const aa = a + (turn * Math.PI) / 2;
          if (!solid(o.x + Math.cos(aa) * 22, o.y + Math.sin(aa) * 22, 8)) {
            moveBody(o, Math.cos(aa) * speed * deltaSeconds, Math.sin(aa) * speed * deltaSeconds, 8);
            break;
          }
        }
      }
      o.a = a;
      o.walk += deltaSeconds * strideRate(speed);
    }
    function updateOfficers(deltaSeconds) {
      assignFireTokens(deltaSeconds);
      for (const c of vehicles) {
        // Sight and gang checks are staggered: each unit looks about seven times
        // a second, which reads the same and costs a fraction at five stars.
        const look = gameTime >= (c.lookAt || 0);
        if (look) c.lookAt = gameTime + 0.12 + seededRandom() * 0.06;
        if (c.cop && (look || c.crewDeployed)) c.seesPlayer = !c.crewDeployed && policeSees(c);
        if (!lawVehicle(c)) continue;
        if (look) c.gangTarget = c.pursuitTarget ? null : policeGangTarget(c);
        // The crew gets out for a runner on foot, and for a driver who has
        // stopped: a car sitting still is surrounded (pursuit.js).
        const onFoot = !player.car || isAircraft(player.car),
          gangClose = c.gangTarget && distanceBetween(c, c.gangTarget) < 300,
          playerClose =
            c.cop &&
            wantedStars > 0 &&
            !harborPoliceProtected(player.x, player.y, 30) &&
            !playerOnRoof() &&
            (onFoot || (player.carStoppedFor || 0) > 1.2) &&
            combatDistance(c, player) < (onFoot ? 350 : 240);
        if (!c.crewDeployed && (gangClose || playerClose) && Math.abs(c.speed) < 24) deployOfficers(c);
      }
      for (const o of officers) {
        if (o.hp <= 0) {
          o.state = 'dead';
          continue;
        }
        if (personIncapacitated(o)) {
          o.aiming = false;
          o.state = 'stunned';
          continue;
        }
        // Down but alive: no more shooting, a slow crawl for the car (or out of
        // the way once the police are gone), unless a partner is dragging them.
        if (o.downed) {
          o.state = 'downed';
          o.fireToken = false;
          o.seesPlayer = false;
          if (wantedStars <= 0 && !crowdInView(o.x, o.y, 60)) o.returned = true;
          else if (!o.draggedBy && !o.inCover) {
            const cover = officerCoverSpot(o);
            if (cover && distanceBetween(o, cover) > 10) footStepTowards(o, cover, deltaSeconds, 4 * KMH);
            else o.inCover = true;
          }
          continue;
        }
        if (o.dragging && updateOfficerDrag(o, deltaSeconds)) continue;
        const look = gameTime >= (o.lookAt || 0);
        if (look) {
          o.lookAt = gameTime + 0.12 + seededRandom() * 0.06;
          o.gangTarget = policeGangTarget(o);
        }
        if (
          ((wantedStars <= 0 || harborPoliceProtected(player.x, player.y, 30)) && !o.gangTarget) ||
          (o.state === 'return' && !o.gangTarget)
        ) {
          o.state = 'return';
          o.target = null;
          if (o.car?.hp > 0 && o.car !== player.car && !o.car.stolen && distanceBetween(o, o.car) > 28)
            footStepTowards(o, o.car, deltaSeconds, 11 * KMH);
          else {
            o.returned = true;
          }
          continue;
        }
        // Rooftop marksmen hold their roof and shoot on their own clock (swat.js).
        if (o.roofSniper) continue;
        if (look || o.seesPlayer === undefined) o.seesPlayer = wantedStars > 0 && policeSees(o);
        const seesPlayer = wantedStars > 0 && o.seesPlayer,
          gang = o.gangTarget,
          kind = officerKind(o);
        if (seesPlayer) {
          o.sightTime = (o.sightTime || 0) + deltaSeconds;
          o.lastSawPlayerAt = gameTime;
        } else o.sightTime = 0;
        const target =
          gang && (!seesPlayer || distanceBetween(o, gang) < distanceBetween(o, player) * 1.2)
            ? gang
            : wantedStars > 0
              ? player
              : gang;
        if (!target) {
          o.state = 'return';
          continue;
        }
        if (
          o.post &&
          target === player &&
          !seesPlayer &&
          distanceBetween(o, player) > 340 &&
          distanceBetween(o, o.post) > 16
        ) {
          o.state = 'post';
          o.target = null;
          footStepTowards(o, o.post, deltaSeconds, 13 * KMH);
          continue;
        }
        // The runner drove off: back to the car and after them.
        if (
          target === player &&
          !o.blockade &&
          player.car &&
          !isAircraft(player.car) &&
          Math.abs(player.car.speed || 0) > 70 &&
          distanceBetween(o, player) > 190 &&
          o.car?.hp > 0 &&
          !o.car.stolen &&
          o.car !== player.car
        ) {
          o.state = 'remount';
          footStepTowards(o, o.car, deltaSeconds, kind.run * 1.15);
          if (distanceBetween(o, o.car) < 32) o.returned = true;
          continue;
        }
        const seen = target === player ? seesPlayer : clearSight(o, target),
          d = distanceBetween(o, target),
          changed = o.target !== target;
        o.target = target;
        const chase = seen ? target : target === player ? lastSeen : o.gangLastSeen || target;
        o.a = headingBetween(o, chase);
        const range =
          target === player ? (isAircraft(player.car) ? 330 : kind.range) : 210;
        if (seen && combatDistance(o, target) < range) {
          if (!['aim', 'approach', 'arrest'].includes(o.state) || changed) {
            o.state = 'aim';
            o.timer = Math.max(0.65, o.timer);
            o.engagedSaid = false;
          }
          // One star, or a runner who has stopped fighting with officers close
          // by: walk up and make the arrest (pursuit.js).
          if (target === player && (!officerMayShoot(o, player) || (policeMayArrest && d < 120))) {
            if (o.state !== 'arrest') o.state = 'approach';
            if (d > 22) footStepTowards(o, player, deltaSeconds, 9 * KMH);
            o.a = headingBetween(o, player);
            if (!o.challengeSaid && d < 200) o.challengeSaid = radio(policeMayArrest ? 'police-under-arrest' : 'police-challenge', o);
            continue;
          }
          o.state = 'aim';
          if (target === player && !o.engagedSaid && radio('target-engaged', o)) o.engagedSaid = true;
          if (gameTime < (o.staggerUntil || 0)) continue;
          if (d < 42)
            moveBody(o, -Math.cos(o.a) * 5 * KMH * deltaSeconds, -Math.sin(o.a) * 5 * KMH * deltaSeconds, 8);
          else {
            const spot = officerPosition(o, target, d, !o.fireToken && target === player);
            if (spot) {
              footStepTowards(o, spot, deltaSeconds, kind.run * (o.fireToken ? 0.65 : 0.9));
              o.a = headingBetween(o, target);
            }
          }
          // Only the officers holding a firing token shoot at the player; the
          // rest hold aim and move up (pursuit.js assignFireTokens).
          if (target !== player || o.fireToken) officerShoot(o, target, deltaSeconds);
        } else {
          if (target === player && !seen && officerSuppress(o, deltaSeconds)) {
            o.state = 'suppress';
            if (distanceBetween(o, lastSeen) > 90) footStepTowards(o, lastSeen, deltaSeconds, 8 * KMH);
            o.a = headingBetween(o, lastSeen);
            continue;
          }
          o.state = 'pursue';
          // A SWAT stack moves up in file behind its shield (swat.js).
          const goal = (target === player && swatStackSpot(o)) || chase;
          if (distanceBetween(o, goal) > (goal === chase ? 20 : 4))
            footStepTowards(o, goal, deltaSeconds, target === player && player.car ? 18 * KMH : kind.run);
        }
      }
      for (let i = officers.length - 1; i >= 0; i--) if (officers[i].returned) officers.splice(i, 1);
      for (const c of vehicles)
        if (!c.blockade && c.crewDeployed && c.crew?.every((o) => o.returned || o.hp <= 0)) {
          c.crewLost = c.crew.every((o) => o.hp <= 0);
          if (c.crewLost) {
            c.cop = false;
            c.seesPlayer = false;
            c.gangTarget = null;
          }
          c.crewDeployed = false;
          c.ai = !c.crewLost && wantedStars <= 0 && c.hp > 0 && !c.stolen && !c.lawUnit;
          c.crew = [];
        }
    }
    function updateWanted(deltaSeconds) {
      updateStarProgress(deltaSeconds);
      updatePursuit(deltaSeconds);
      if (mission?.index === 2 && [1, 2].includes(mission.stage)) {
        wantedStars = Math.max(1, wantedStars);
        searchActive = false;
        lastSeen = {
          x: mission.car.x,
          y: mission.car.y,
        };
        copSpawn -= deltaSeconds;
        if (copSpawn <= 0) {
          copSpawn = 6;
          spawnCop();
        }
        return;
      }
      if (mission?.index === 10 && mission.stage === 5) {
        wantedStars = Math.max(mission.escapeHeat, wantedStars);
        searchActive = false;
        lastSeen = {
          x: player.x,
          y: player.y,
        };
        return;
      }
      if (cargoChase()) {
        updateCargoPursuit(deltaSeconds);
        return;
      }
      if (wantedStars <= 0) {
        searchActive = false;
        searchRemaining = 0;
        return;
      }
      const seen =
        // Sight was worked out this frame by updateOfficers (and the air units).
        officers.some((o) => o.state !== 'return' && o.hp > 0 && o.seesPlayer) ||
        vehicles.some((c) => c.cop && !c.crewDeployed && c.hp > 0 && c.seesPlayer);
      if (seen) {
        lastSeen = {
          x: player.x,
          y: player.y,
        };
        searchActive = false;
        searchRemaining = policeSearchSeconds();
      } else {
        if (!searchActive) {
          searchActive = true;
          searchRemaining = policeSearchSeconds();
          if (wantedStars >= 2) policeRadioEvent('lost');
        }
        // Inside the search area (the circle on the radar) the clock barely
        // moves: the police are combing those streets. Get out of it.
        const inZone = distanceBetween(player, lastSeen) < policeSearchRadius();
        searchRemaining = Math.max(0, searchRemaining - deltaSeconds * (inZone ? 0.2 : 1));
        if (searchRemaining === 0) {
          clearPolice(true);
          return;
        }
      }
      dispatchPolice(deltaSeconds);
    }
    const BLOOD_LIMIT = 240,
      BLOOD_TRACK_DISTANCE = BLOCK_SIZE * 0.07,
      bloodArt = [];
    function bloodSurface(x, y) {
      return DOCKS.some((d) => x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h)
        ? 2.2
        : terrainHeight(x, y);
    }
    function bloodStamp(variant = 0) {
      if (bloodArt[variant]) return bloodArt[variant];
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const drawingContext = cv.getContext('2d');
      let state = 731 + variant * 977;
      const random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const gr = drawingContext.createRadialGradient(64, 64, 8, 64, 64, 49);
      gr.addColorStop(0, '#43030c');
      gr.addColorStop(0.55, '#720819');
      gr.addColorStop(1, '#a21b2bcc');
      drawingContext.fillStyle = gr;
      drawingContext.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = (i * TAU) / 40,
          r = 34 + random() * 15,
          x = 64 + Math.cos(a) * r,
          y = 64 + Math.sin(a) * r * 0.75;
        i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y);
      }
      drawingContext.closePath();
      drawingContext.fill();
      for (let i = 0; i < 30; i++) {
        const a = random() * TAU,
          r = 35 + random() * 25;
        drawingContext.fillStyle = i % 3 ? '#821025d9' : '#b92c36bd';
        drawingContext.beginPath();
        drawingContext.ellipse(
          64 + Math.cos(a) * r,
          64 + Math.sin(a) * r,
          1 + random() * 3,
          0.7 + random() * 2,
          a,
          0,
          TAU,
        );
        drawingContext.fill();
      }
      drawingContext.fillStyle = '#ca4c493a';
      drawingContext.beginPath();
      drawingContext.ellipse(58, 56, 14, 4, -0.25, 0, TAU);
      drawingContext.fill();
      bloodArt[variant] = cv;
      return cv;
    }
    function addBloodPool(x, y, r, a, extra = {}) {
      if (!groundAt(x, y)) return;
      bloodPools.push({
        x,
        y,
        r,
        a,
        created: gameTime,
        variant: Math.floor(seededRandom() * 4),
        surface: bloodSurface(x, y),
        ...extra,
      });
      while (bloodPools.length > BLOOD_LIMIT) bloodPools.shift();
    }
    function bleed(p, severity = 1, a = 0) {
      if (!bloodOn) return;
      severity = clamp(severity, 0.25, 2.5);
      const n = Math.ceil(10 + severity * 12),
        z = entityElevation(p),
        roof = rooftopFloor(p);
      for (let i = 0; i < n; i++) {
        const spread = a + randomBetween(-1.05, 1.05),
          v = randomBetween(24, 110) * Math.min(1.6, severity),
          life = randomBetween(0.45, 0.9);
        particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(spread) * v,
          vy: Math.sin(spread) * v,
          z: z + 9,
          vz: randomBetween(16, 44),
          life,
          max: life,
          color: randomChoice(['#a90c20', '#c42a35', '#760718']),
          size: randomBetween(1.1, 3.1),
          blood: true,
          surface: roof ? z : undefined,
        });
      }
      addBloodPool(p.x, p.y, clamp(7 + severity * 5, 8, 22), a, {
        grow: p.hp <= 0,
        opacity: 0.96,
        surface: roof ? z : bloodSurface(p.x, p.y),
      });
      for (let i = 0; i < 3 + Math.ceil(severity * 3); i++) {
        const aa = a + randomBetween(-0.8, 0.8),
          d = randomBetween(9, 22) * severity,
          x = p.x + Math.cos(aa) * d,
          y = p.y + Math.sin(aa) * d;
        addBloodPool(x, y, randomBetween(1.8, 4.4), aa, {
          opacity: 0.86,
          surface: roof ? z : bloodSurface(x, y),
        });
      }
    }
    function scream(p) {
      if (!voicesOn || gameTime < screamAt || distanceBetween(p, player) > 470) return;
      screamAt = gameTime + 1.7;
      playSample(
        randomChoice([
          'civilian-scream-male-1',
          'civilian-scream-male-2',
          'civilian-scream-female-1',
          'civilian-scream-female-2',
        ]),
        0.65,
        randomBetween(0.95, 1.05),
        p,
      );
    }
    function strikePerson(person, damage, a = 0, source = null, showBlood = true, kind = 'ballistic') {
      if (person.hp <= 0) return;
      const dealt = ballisticDamage(person, damage, kind);
      if (person.faction && source === player) alertGang(person.faction);
      if (source) {
        person.threat = {
          x: source.x,
          y: source.y,
        };
      }
      if (person.police && source?.faction) {
        person.gangTarget = source;
        person.gangSeenAt = gameTime;
        person.gangLastSeen = {
          x: source.x,
          y: source.y,
        };
        source.policeThreatUntil = gameTime + 15;
        source.policeAggroUntil = gameTime + 15;
      }
      if (person.faction && source?.police) person.policeAggroUntil = gameTime + 15;
      person.hp -= dealt;
      person.flee = 8;
      // A hit officer staggers: a half-second with no aimed fire, shoved back.
      if (person.police && person.hp > 0 && dealt > 4) {
        person.staggerUntil = gameTime + (kind === 'blast' ? 1.2 : 0.45);
        moveBody(person, Math.cos(a) * 6, Math.sin(a) * 6, 8);
      }
      // A round the vest ate sparks off the plate instead of opening a wound.
      const stopped = dealt < damage * 0.4 && wearingVest(person);
      if (stopped) particle(person.x, person.y, '#e8dfb6', 4, 55, 2);
      else if (showBlood) bleed(person, Math.min(2, dealt / 38), a);
      scream(person);
      // Where it landed, the flinch, a limp, a blood trail, the fall (wounds.js).
      if (dealt > 0) woundPerson(person, dealt, a, kind, source);
      if (person.hp <= 0) {
        person.deadTime = gameTime;
        // Witnesses who find the body later report whoever did it.
        person.killedBy = source;
        if (showBlood) bleed(person, 2, a);
        if (source === player) recordKill(person, kind);
      }
    }
    function updateCivic(deltaSeconds) {
      if (!godTimeFrozen()) worldMinutes += deltaSeconds; // GOD PANEL: freeze time (god-panel.js)
      updateHarbor(deltaSeconds);
      updateStoryWorld(deltaSeconds);
      // Police parts are timed on their own so stats() shows the cost of a chase.
      timed('police:officers', () => updateOfficers(deltaSeconds));
      timed('police:wanted', () => updateWanted(deltaSeconds));
      timed('police:roadblocks', () => updateRoadblocks(deltaSeconds));
      updateDepotDoors(deltaSeconds);
      updateCrowdDensity(deltaSeconds);
      timed('police:air', () => updateAirPolice(deltaSeconds));
      updateWounds();
      for (let i = bloodPools.length - 1; i >= 0; i--)
        if (gameTime - bloodPools[i].created > 240) bloodPools.splice(i, 1);
    }
    function navigationState() {
      const waypoint = waypointNavigation();
      if (waypoint) return waypoint;
      const target = objective();
      return target
        ? {
            visible: true,
            distance: Math.round(worldMeters(distanceBetween(player, target))),
            a: headingBetween(player, target),
            name: mission
              ? mission.instruction || missions[mission.index].title
              : 'NEXT JOB · PAYPHONE',
          }
        : {
            visible: false,
          };
    }
    function civicUI() {
      storyUI();
      const hm = harborCargoJob();
      // The cargo bar matters until the crates are in Vinny's warehouse.
      getElement('cargoStatus').style.display = hm && hm.stage < 4 ? 'block' : 'none';
      if (hm) {
        getElement('cargoLabel').textContent = hm.loading
          ? 'LOADING ' + (hm.collected + 1) + ' / 3'
          : 'CARGO ' + hm.collected + ' / 3';
        getElement('cargoFill').style.width =
          ((hm.collected + (hm.loading ? hm.loading.time / 2.1 : 0)) / 3) * 100 + '%';
      }
      if (gameMode === 'play' && harborGate < 0.82 && withinRange('harbor-gate', distanceBetween(player, HARBOR.gate), 110, 130))
        offerPrompt('OPEN HARBOR BARRIER', { id: 'harbor-gate' });
      else if (gameMode === 'play') harborBayPrompt(hm);
      getElement('worldClock').textContent =
        'DAY ' + (Math.floor(worldMinutes / 1440) + 1) + ' · ' + clockText();
      const nav = navigationState();
      getElement('navigation').style.display = nav.visible ? 'flex' : 'none';
      if (nav.visible) {
        getElement('navArrow').style.transform = 'rotate(' + ((nav.a * 180) / Math.PI + 90) + 'deg)';
        getElement('navTitle').textContent = nav.name;
        getElement('navDistance').textContent = nav.distance + ' m';
      }
      const cargo = cargoChase(),
        dispatching = !!cargo && !cargo.policeArrived;
      getElement('chaseStatus').classList.toggle('dispatching', dispatching);
      getElement('chaseStatus').textContent = dispatching
        ? 'Cops alerted · ' + Math.ceil(cargo.policeArrivalIn - 1e-7) + 's'
        : mission?.index === 10 && mission.stage === 5
          ? 'MANIFEST EXPOSED · GET DANIEL INSIDE VINNY’S WAREHOUSE'
          : cargo
            ? 'COPS TRACKING TRUCK · RESPRAY AT R'
            : wantedStars > 0
              ? searchActive
                ? distanceBetween(player, lastSeen) < policeSearchRadius()
                  ? 'LEAVE THE SEARCH AREA'
                  : 'OUT OF SIGHT · STAY HIDDEN'
                : 'POLICE HAVE EYES ON YOU'
              : '';
      const airText = airPursuitStatus();
      if (airText) getElement('chaseStatus').textContent += '\n' + airText;
      getElement('chaseStatus').classList.toggle('searching', searchActive);
      const timer = getElement('policeEscapeTimer');
      timer.classList.toggle('hidden', !(wantedStars > 0 && searchActive));
      document.body?.classList.toggle('police-search-active', wantedStars > 0 && searchActive);
      getElement('policeEscapeSeconds').textContent = Math.ceil(searchRemaining) + 's';
      if (gameMode === 'play' && !player.car && !playerOnRoof()) {
        const place = nearestPlace();
        if (place) offerPrompt(place.name, { id: 'place|' + place.name });
      }
      roofMissionUI();
      militaryUI();
    }
    function drawCivicMap(drawingContext, big) {
      for (const p of PLACES) {
        const font = big ? 90 : 65,
          w = p.symbol.length * (big ? 59 : 43) + 35,
          h = big ? 115 : 87;
        drawingContext.fillStyle = '#101d25';
        drawingContext.fillRect(p.door.x - w / 2, p.door.y - h / 2, w, h);
        drawingContext.strokeStyle = p.color;
        drawingContext.lineWidth = big ? 8 : 5;
        drawingContext.strokeRect(p.door.x - w / 2, p.door.y - h / 2, w, h);
        drawingContext.fillStyle = p.color;
        drawingContext.font = 'bold ' + font + 'px monospace';
        drawingContext.textAlign = 'center';
        drawingContext.fillText(p.symbol, p.door.x, p.door.y + font * 0.34);
      }
      for (const d of DOCKS) {
        drawingContext.fillStyle = '#8fbad5';
        drawingContext.fillRect(d.x, d.y, d.w, d.h);
        if (big) {
          drawingContext.fillStyle = '#101d25';
          drawingContext.fillRect(d.boatX - 145, d.boatY + 20, 290, 100);
          drawingContext.fillStyle = '#a8d7e5';
          drawingContext.font = 'bold 78px monospace';
          drawingContext.textAlign = 'center';
          drawingContext.fillText(d.type === 'jetski' ? 'JET' : 'BOAT', d.boatX, d.boatY + 99);
        }
      }
    }
    function policeMapUnits() {
      const units = [];
      for (const c of vehicles)
        if (c.hp > 0 && c !== player.car && (c.airUnit || lawVehicle(c)))
          units.push({
            unit: c,
            kind: c.airUnit ? 'air' : 'car',
            alerted:
              !c.airRetreat && !!(c.missionPursuit || c.gangTarget || (c.cop && wantedStars > 0)),
          });
      for (const o of officers)
        if (o.hp > 0 && !o.returned && o.state !== 'dead')
          units.push({
            unit: o,
            kind: 'foot',
            alerted: !!(o.gangTarget || (wantedStars > 0 && o.state !== 'return')),
          });
      return units;
    }
    function drawPoliceMap(drawingContext, scale) {
      drawPoliceSearch(drawingContext, scale);
      // Markers retain a readable screen size on both the local radar and city map.
      for (const { unit: u, kind, alerted } of policeMapUnits()) {
        drawingContext.save();
        drawingContext.translate(u.x, u.y);
        drawingContext.scale(1 / scale, 1 / scale);
        const color = alerted && Math.sin(gameTime * 8) > 0 ? '#ff736d' : '#6ccfff';
        drawingContext.strokeStyle = '#081822';
        drawingContext.lineWidth = 2.5;
        drawingContext.fillStyle = color;
        if (kind === 'air') {
          drawingContext.beginPath();
          drawingContext.arc(0, 0, 7.5, 0, TAU);
          drawingContext.stroke();
          drawingContext.fill();
          drawingContext.strokeStyle = '#eef9ff';
          drawingContext.lineWidth = 1.8;
          drawingContext.beginPath();
          drawingContext.moveTo(-5, 0);
          drawingContext.lineTo(5, 0);
          drawingContext.moveTo(0, -5);
          drawingContext.lineTo(0, 5);
          drawingContext.stroke();
          drawingContext.fillStyle = '#173248';
          drawingContext.fillRect(-1.5, -2.5, 3, 5);
        } else if (kind === 'foot') {
          drawingContext.beginPath();
          drawingContext.arc(0, 0, 4, 0, TAU);
          drawingContext.stroke();
          drawingContext.fill();
          drawingContext.fillStyle = '#f4fcff';
          drawingContext.beginPath();
          drawingContext.arc(0, 0, 1.3, 0, TAU);
          drawingContext.fill();
        } else {
          drawingContext.rotate(u.a);
          drawingContext.beginPath();
          drawingContext.moveTo(7, 0);
          drawingContext.lineTo(4, -4);
          drawingContext.lineTo(-6, -4);
          drawingContext.lineTo(-6, 4);
          drawingContext.lineTo(4, 4);
          drawingContext.closePath();
          drawingContext.stroke();
          drawingContext.fill();
          drawingContext.fillStyle = '#effaff';
          drawingContext.fillRect(1, -2.5, 1.8, 5);
          drawingContext.fillStyle = alerted ? '#ff736d' : '#205a85';
          drawingContext.fillRect(-2, -3, 2, 6);
        }
        drawingContext.restore();
      }
    }
    function drawBlood2D(roof = false) {
      for (const b of bloodPools)
        if (rooftopFloor(b) === roof && visible(b, 45)) {
          const age = gameTime - b.created,
            growth = b.grow ? 1 + Math.min(0.28, age * 0.045) : 1;
          worldContext.save();
          worldContext.globalAlpha = (b.opacity ?? 0.95) * clamp((240 - age) / 35, 0, 1);
          worldContext.translate(b.x, b.y);
          worldContext.rotate(b.a);
          if (b.track) {
            worldContext.fillStyle = '#86101e';
            worldContext.fillRect(-b.r * 1.3, -b.r * 0.23, b.r * 2.6, b.r * 0.46);
            worldContext.fillStyle = '#3b171833';
            for (let x = -b.r; x < b.r; x += 1.4)
              worldContext.fillRect(x, -b.r * 0.23, 0.5, b.r * 0.46);
          } else {
            const size = b.r * 2.5 * growth;
            worldContext.drawImage(bloodStamp(b.variant || 0), -size / 2, -size / 2, size, size);
          }
          worldContext.restore();
        }
    }
    getElement('closeService').onclick = closeService;
    // END SUBSYSTEM: src/citylife.js
