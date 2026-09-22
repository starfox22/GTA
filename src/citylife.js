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
        bx: 8,
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
        bx: 8,
        by: 3,
        x: 4330,
        y: 1770,
        w: 288,
        h: 182,
        height: 78,
        color: '#b5d4d3',
        symbol: '+',
        door: {
          x: 4474,
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
        bx: 9,
        by: 1,
        x: 4840,
        y: 745,
        w: 285,
        h: 154,
        height: 42,
        color: '#dcc79c',
        symbol: 'EDU',
        door: {
          x: 4982,
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
        bx: 9,
        by: 6,
        x: 4850,
        y: 3310,
        w: 267,
        h: 172,
        height: 42,
        color: '#dfbc82',
        symbol: 'BAR',
        door: {
          x: 4983,
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
        bx: 8,
        by: 7,
        x: 4330,
        y: 3820,
        w: 280,
        h: 185,
        height: 57,
        color: '#a08de8',
        symbol: 'CLUB',
        door: {
          x: 4470,
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
        bx: 9,
        by: 3,
        x: 4850,
        y: 1770,
        w: 270,
        h: 175,
        height: 32,
        color: '#dbb8ad',
        symbol: 'ZZ',
        door: {
          x: 4985,
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
        bx: 9,
        by: 4,
        x: 4840,
        y: 2286,
        w: 280,
        h: 146,
        height: 32,
        color: '#e8b384',
        symbol: 'EAT',
        door: {
          x: 4980,
          y: 2452,
        },
      },
      {
        id: 'outfitters',
        kind: 'clothes',
        name: 'SOUTH COAST OUTFITTERS',
        bx: 3,
        by: 6,
        x: 1770,
        y: 3272,
        w: 276,
        h: 150,
        height: 40,
        color: '#c3a6d3',
        symbol: 'FIT',
        door: {
          x: 1908,
          y: 3442,
        },
      },
      {
        id: 'keys-outfitters',
        kind: 'clothes',
        name: 'OCEAN DRIVE MENSWEAR',
        bx: 8,
        by: 6,
        x: 4330,
        y: 3272,
        w: 276,
        h: 150,
        height: 40,
        color: '#b7cfe0',
        symbol: 'FIT',
        door: {
          x: 4468,
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
        x: 3916,
        y: 900,
        w: 92,
        h: 34,
        boatX: 3873,
        boatY: 917,
        type: 'speedboat',
      },
      {
        x: 3976,
        y: 2930,
        w: 94,
        h: 34,
        boatX: 3936,
        boatY: 2947,
        type: 'jetski',
      },
      {
        x: 1320,
        y: 5130,
        w: 130,
        h: 34,
        boatX: 1490,
        boatY: 5147,
        type: 'speedboat',
      },
      // Harbor Point: the way out to the liner riding at anchor.
      {
        x: 1566,
        y: -3420,
        w: 96,
        h: 34,
        boatX: 1500,
        boatY: -3403,
        type: 'jetski',
      },
      {
        x: 1566,
        y: -3560,
        w: 96,
        h: 34,
        boatX: 1496,
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
      const obstacles = DOCKS.map((d) => ({
        x: d.x + d.w / 2,
        y: d.y + d.h / 2,
        hx: d.w / 2,
        hy: d.h / 2,
        a: 0,
      }));
      for (const bridge of BRIDGES)
        for (const tx of [RIVER.left + 115, RIVER.right - 115])
          for (const side of [-1, 1])
            obstacles.push({
              x: tx,
              y: bridge + side * 69,
              hx: 12,
              hy: 12,
              a: 0,
            });
      obstacles.push({
        x: HARBOR.ship.x,
        y: HARBOR.ship.y,
        hx: HARBOR.ship.w / 2,
        hy: HARBOR.ship.l / 2,
        a: 0,
      });
      for (const ship of LINERS) obstacles.push(shipHull(ship));
      for (const moored of marinaBoats())
        obstacles.push({ x: moored.x, y: moored.y, hx: moored.beam / 2, hy: moored.len / 2, a: 0 });
      return !obstacles.some((b) => boxContact(shape, b));
    }
    function isBoat(vehicle) {
      return !!vehicle && vehicleSpec(vehicle).boat;
    }
    function nearestPlace() {
      if (transitRide || player.roof || player.parachute) return null;
      return (
        PLACES.filter((p) => distanceBetween(player, p.door) < 52).sort(
          (a, b) => distanceBetween(player, a.door) - distanceBetween(player, b.door),
        )[0] || null
      );
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
      if (player.car && player.car.type !== 'tank' && index !== 0) {
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
      if (player.car && player.car.type !== 'tank') {
        if (weaponIsEquipped(0)) selectWeapon(0);
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
     * quickly people move, and how many of them are out at all. Thinning the crowd
     * removes pedestrians rather than hiding them, so nothing invisible is left in
     * the world for bullets, traffic or the police to find.
     */
    const CROWD_BASE = 340;
    let crowdTimer = 0;
    function cityTempo() {
      const hour = (worldMinutes / 60) % 24;
      if (hour < 5.5) return { name: 'NIGHT', speed: 27, idle: 0.06, shop: 0.06, bench: 0.1, out: 0.26 };
      if (hour < 9.5) return { name: 'MORNING RUSH', speed: 31, idle: 0.04, shop: 0.07, bench: 0.1, out: 1 };
      if (hour < 11.5) return { name: 'MORNING', speed: 22, idle: 0.12, shop: 0.26, bench: 0.34, out: 0.86 };
      if (hour < 14.5) return { name: 'LUNCH', speed: 21, idle: 0.15, shop: 0.34, bench: 0.5, out: 1 };
      if (hour < 17.5) return { name: 'AFTERNOON', speed: 22, idle: 0.11, shop: 0.27, bench: 0.38, out: 0.88 };
      if (hour < 19.5) return { name: 'EVENING RUSH', speed: 30, idle: 0.05, shop: 0.1, bench: 0.14, out: 1 };
      if (hour < 23) return { name: 'EVENING', speed: 23, idle: 0.17, shop: 0.24, bench: 0.4, out: 0.82 };
      return { name: 'LATE', speed: 28, idle: 0.08, shop: 0.07, bench: 0.12, out: 0.42 };
    }
    function ordinaryWalker(p) {
      return (
        !p.gymStation &&
        !p.vendor &&
        !p.queueing &&
        !p.parkGuest &&
        !p.parkRoute &&
        !p.leader &&
        !p.ejected &&
        !p.angryUntil &&
        !p.witnessUntil &&
        p.hp > 0
      );
    }
    function spawnWalker() {
      for (let attempt = 0; attempt < 24; attempt++) {
        const vertical = seededRandom() > 0.5,
          r = randomChoice(vertical ? ROAD_CENTERS : ROAD_ROWS),
          v = vertical
            ? randomBetween(CITY_TOP + 180, CITY_SIZE - 260)
            : randomBetween(180, CITY_SIZE - 260),
          x = vertical ? r + randomChoice([-67, 67]) : v,
          y = vertical ? v : r + randomChoice([-67, 67]);
        if (Math.abs(x - player.x) < 620 && Math.abs(y - player.y) < 620) continue;
        if (solid(x, y, 5) || inHarbor(x, y, 8)) continue;
        if (vehicles.some((c) => pointInCar(x, y, c, 10))) continue;
        pedestrians.push({
          x,
          y,
          a: vertical ? randomChoice([-Math.PI / 2, Math.PI / 2]) : randomChoice([0, Math.PI]),
          color: randomChoice(DRIVER_COLORS),
          hp: 30,
          flee: 0,
          timer: randomBetween(0, 8),
          walk: seededRandom() * 5,
          state: 'walk',
        });
        return true;
      }
      return false;
    }
    function updateCrowdDensity(deltaSeconds) {
      crowdTimer -= deltaSeconds;
      if (crowdTimer > 0) return;
      crowdTimer = 6;
      const target = Math.round(CROWD_BASE * cityTempo().out),
        walkers = pedestrians.filter(ordinaryWalker);
      if (walkers.length > target + 12) {
        // Thin from the far side of the city so nobody vanishes in front of you.
        const going = walkers
          .filter((p) => Math.abs(p.x - player.x) > 1300 || Math.abs(p.y - player.y) > 1300)
          .slice(0, Math.min(14, walkers.length - target));
        for (const p of going) {
          const i = pedestrians.indexOf(p);
          if (i < 0) continue;
          pedestrians.splice(i, 1);
          for (const q of pedestrians) if (q.leader === p) q.leader = null;
        }
        return;
      }
      for (let i = 0; i < Math.min(10, target - walkers.length); i++) if (!spawnWalker()) break;
    }
    /**
     * ESCAPE WINDOW
     * How long you have to stay out of sight before the search is called off.
     * It scales with the heat you are carrying but is capped: ten seconds out of
     * sight is the longest any level of wanted will ever hold you.
     */
    const POLICE_SEARCH_MAX = 10;
    function policeSearchSeconds(stars = wantedStars) {
      return Math.min(POLICE_SEARCH_MAX, 5 + Math.ceil(clamp(stars, 0, 5)));
    }
    function clearPolice(notifyEscape = false) {
      clearRoadblocks();
      const wasWanted = wantedStars > 0;
      if (notifyEscape && wasWanted) policeClearedNotice();
      // Losing the police means losing all of them. A respray used to leave the
      // helicopter overhead, which is the one unit a change of paint fools best.
      const air = airSupportUnit();
      if (air) retireAirSupport(air, notifyEscape && wasWanted);
      wantedStars = 0;
      wantedPressure = 0;
      wantedLevel = 0;
      starElapsed = 0;
      cooldown = 0;
      searchRemaining = 0;
      searchActive = false;
      copSpawn = 5;
      for (const o of officers) if (o.hp > 0 && !o.gangTarget) o.state = 'return';
      for (const c of vehicles)
        if (c.cop) {
          c.cop = false;
          c.ai = !c.crewDeployed && !c.crewLost;
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
        vehicle.type === 'police' &&
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
      for (const block of [
        ...buildings,
        ...garageWalls(),
        ...militarySolids(),
        ...countySolids(),
        ...harborSolids().filter((s) => s.height > 14),
        ...depotSolids(),
      ]) {
        let lo = 0,
          hi = 1,
          hit = true;
        for (const [pos, delta, min, max] of [
          [a.x, dx, block.x - 2, block.x + block.w + 2],
          [a.y, dy, block.y - 2, block.y + block.h + 2],
          [start, dz, -10, block.height + 2],
        ]) {
          if (Math.abs(delta) < 1e-8) {
            if (pos < min || pos > max) {
              hit = false;
              break;
            }
          } else {
            let t1 = (min - pos) / delta,
              t2 = (max - pos) / delta;
            if (t1 > t2) [t1, t2] = [t2, t1];
            lo = Math.max(lo, t1);
            hi = Math.min(hi, t2);
            if (lo > hi) {
              hit = false;
              break;
            }
          }
        }
        if (hit && hi > 0.0001 && lo < 0.9999) return false;
      }
      return true;
    }
    function policeSees(o) {
      if (o.airUnit) return !harborPoliceProtected(player.x, player.y, 30) && airCanSee(o, player);
      return (
        !harborPoliceProtected(player.x, player.y, 30) &&
        !player.roof &&
        o.hp > 0 &&
        !personIncapacitated(o) &&
        !o.crewLost &&
        Math.hypot(o.x - player.x, o.y - player.y, entityElevation(o) - entityElevation(player)) <
          440 &&
        clearSight(o, player)
      );
    }
    function deployOfficers(c) {
      if (c.crewDeployed || c.crewLost || c.hp <= 0) return;
      c.crewDeployed = true;
      c.ai = false;
      c.vx = c.vy = c.speed = c.av = 0;
      c.crew = [];
      for (const side of [-1, 1]) {
        let spawnPoint = null;
        for (const radius of [25, 35, 47]) {
          const a = c.a + (side * Math.PI) / 2,
            p = {
              x: c.x + Math.cos(a) * radius,
              y: c.y + Math.sin(a) * radius,
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
        const o = {
          ...spawnPoint,
          a: c.a,
          hp: 85,
          // Patrol officers wear a vest; the tactical units at high alert wear a heavier one.
          vest: wantedStars >= 4 ? 90 : 55,
          color: '#2d455e',
          police: true,
          car: c,
          state: 'pursue',
          walk: 0,
          timer: 0.8,
          engagedSaid: false,
          gangTarget: c.gangTarget || null,
          gangSeenAt: gameTime,
          gangLastSeen: c.gangLastSeen,
        };
        officers.push(o);
        c.crew.push(o);
      }
      if (!c.crew.length) {
        c.crewDeployed = false;
        return;
      }
      radio(
        randomChoice([
          'police-hands-on-head',
          'police-drop-weapon',
          'police-get-down',
          'police-challenge',
          'police-under-arrest',
        ]),
        c,
      );
    }
    function footStepTowards(o, target, deltaSeconds, speed) {
      if (personIncapacitated(o)) return;
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
      o.walk += deltaSeconds * 12;
    }
    function updateOfficers(deltaSeconds) {
      for (const c of vehicles) {
        if (c.cop) c.seesPlayer = !c.crewDeployed && policeSees(c);
        if (!lawVehicle(c)) continue;
        c.gangTarget = c.pursuitTarget ? null : policeGangTarget(c);
        const gangClose = c.gangTarget && distanceBetween(c, c.gangTarget) < 300,
          playerClose =
            c.cop &&
            wantedStars > 0 &&
            !harborPoliceProtected(player.x, player.y, 30) &&
            (!player.car || isAircraft(player.car)) &&
            !player.roof &&
            combatDistance(c, player) < 350;
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
        o.gangTarget = policeGangTarget(o);
        if (
          ((wantedStars <= 0 || harborPoliceProtected(player.x, player.y, 30)) && !o.gangTarget) ||
          (o.state === 'return' && !o.gangTarget)
        ) {
          o.state = 'return';
          o.target = null;
          if (o.car?.hp > 0 && o.car !== player.car && !o.car.stolen && distanceBetween(o, o.car) > 28)
            footStepTowards(o, o.car, deltaSeconds, 60);
          else {
            o.returned = true;
          }
          continue;
        }
        const seesPlayer = wantedStars > 0 && policeSees(o),
          gang = o.gangTarget;
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
          footStepTowards(o, o.post, deltaSeconds, 72);
          continue;
        }
        const seen = target === player ? seesPlayer : clearSight(o, target),
          d = distanceBetween(o, target),
          changed = o.target !== target;
        o.target = target;
        const chase = seen ? target : target === player ? lastSeen : o.gangLastSeen || target;
        o.a = headingBetween(o, chase);
        o.timer -= deltaSeconds;
        if (
          seen &&
          combatDistance(o, target) <
            (isAircraft(player.car) && target === player ? 330 : target === player ? 180 : 210)
        ) {
          if (o.state !== 'aim' || changed) {
            o.state = 'aim';
            o.timer = Math.max(0.65, o.timer);
            o.engagedSaid = false;
          }
          if (target === player && !o.engagedSaid && radio('target-engaged', o)) o.engagedSaid = true;
          if (d < 42)
            moveBody(o, -Math.cos(o.a) * 35 * deltaSeconds, -Math.sin(o.a) * 35 * deltaSeconds, 8);
          if (o.timer <= 0) {
            o.timer = 0.95 + seededRandom() * 0.55;
            const a = o.a + randomBetween(-0.045, 0.045);
            bullets.push({
              x: o.x + Math.cos(a) * 14,
              y: o.y + Math.sin(a) * 14,
              altitude: entityElevation(o),
              ...shotVelocity(
                {
                  x: o.x + Math.cos(a) * 14,
                  y: o.y + Math.sin(a) * 14,
                  altitude: entityElevation(o),
                },
                target,
                500,
                a,
              ),
              life: 0.7,
              dmg: 17,
              enemy: true,
              faction: 'police',
              owner: o,
              target,
            });
            if (target !== player) {
              target.policeAggroUntil = gameTime + 15;
              target.policeThreatUntil = gameTime + 15;
            }
            playSample('pistol', 0.3, 1, o);
            if (city3D) city3D.fire(o.x, o.y, a, false, entityElevation(o));
          }
        } else {
          o.state = 'pursue';
          if (distanceBetween(o, chase) > 20)
            footStepTowards(o, chase, deltaSeconds, target === player && player.car ? 96 : 112);
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
          c.ai = !c.crewLost && wantedStars <= 0 && c.hp > 0 && !c.stolen;
          c.crew = [];
        }
    }
    function updateWanted(deltaSeconds) {
      updateStarProgress(deltaSeconds);
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
        officers.some((o) => o.state !== 'return' && policeSees(o)) ||
        vehicles.some((c) => c.cop && !c.crewDeployed && policeSees(c));
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
        }
        searchRemaining = Math.max(0, searchRemaining - deltaSeconds);
        if (searchRemaining === 0) {
          clearPolice(true);
          return;
        }
      }
      copSpawn -= deltaSeconds;
      if (copSpawn <= 0 && (!searchActive || (!vehicles.some((c) => c.cop) && !officers.length))) {
        copSpawn = 5;
        spawnCop();
      }
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
      // A round the vest ate sparks off the plate instead of opening a wound.
      const stopped = dealt < damage * 0.4 && wearingVest(person);
      if (stopped) particle(person.x, person.y, '#e8dfb6', 4, 55, 2);
      else if (showBlood) bleed(person, Math.min(2, dealt / 38), a);
      scream(person);
      if (person.hp <= 0) {
        person.deadTime = gameTime;
        if (showBlood) bleed(person, 2, a);
      }
    }
    function updateCivic(deltaSeconds) {
      worldMinutes += deltaSeconds;
      updateHarbor(deltaSeconds);
      updateStoryWorld(deltaSeconds);
      updateOfficers(deltaSeconds);
      updateWanted(deltaSeconds);
      updateRoadblocks(deltaSeconds);
      updateDepotDoors(deltaSeconds);
      updateCrowdDensity(deltaSeconds);
      updateAirPolice(deltaSeconds);
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
      if (gameMode === 'play' && harborGate < 0.82 && distanceBetween(player, HARBOR.gate) < 110) {
        getElement('interaction').style.display = 'block';
        getElement('interaction').innerHTML = '<kbd>E</kbd> OPEN HARBOR BARRIER';
      } else if (
        gameMode === 'play' &&
        hm?.stage === 2 &&
        player.car === hm.car &&
        distanceBetween(player, HARBOR.bay) < 85
      ) {
        getElement('interaction').style.display = 'block';
        getElement('interaction').innerHTML = hm.loading
          ? 'LOADING · ACCELERATE TO CANCEL'
          : '<kbd>E</kbd> LOAD CARGO · STOP IN THE BAY';
      }
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
                ? 'OUT OF SIGHT · STAY HIDDEN'
                : 'POLICE HAVE EYES ON YOU'
              : '';
      const airText = airPursuitStatus();
      if (airText) getElement('chaseStatus').textContent += '\n' + airText;
      getElement('chaseStatus').classList.toggle('searching', searchActive);
      getElement('stars').classList.toggle('searching', searchActive);
      const timer = getElement('policeEscapeTimer');
      timer.classList.toggle('hidden', !(wantedStars > 0 && searchActive));
      document.body?.classList.toggle('police-search-active', wantedStars > 0 && searchActive);
      getElement('policeEscapeSeconds').textContent = Math.ceil(searchRemaining) + 's';
      if (gameMode === 'play' && !player.car && !player.roof) {
        const place = nearestPlace();
        if (place) {
          getElement('interaction').style.display = 'block';
          getElement('interaction').innerHTML = '<kbd>E</kbd> ' + place.name;
        }
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
