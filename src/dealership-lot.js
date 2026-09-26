    // Car dealership lot: plan, keep-out, saved garage and the display stock (DEALER, planDealership, spawnDisplayCar).
    const DEALER = {
      name: 'MONARCH MOTORS',
      sub: 'PRESTIGE COLLECTION',
      planned: false,
      lot: null,
      hall: null,
      height: 11 * UNITS_PER_METRE,
      forecourt: null,
      doorPeople: null,
      doorCars: null,
      panes: [],
      slots: [],
      stage: null,
      curtain: null,
      viewing: null,
      handover: null,
      bays: [],
      posts: null,
      furniture: null,
      solids: [],
    };
    // Where the flagship's things are, relative to the hall's north-west corner.
    function planDealership(plan, B) {
      const U = UNITS_PER_METRE,
        H = { x: B.x + 16, y: B.y + 16, w: B.w - 32, h: 376 };
      H.x1 = H.x + H.w;
      H.y1 = H.y + H.h;
      DEALER.lot = { x: B.x, y: B.y, w: B.w, h: B.h };
      DEALER.hall = H;
      DEALER.forecourt = { x: B.x, y: H.y1, w: B.w, h: B.y + B.h - H.y1 };
      DEALER.doorPeople = { x0: H.x + 280, x1: H.x + 316, y: H.y1 };
      DEALER.doorCars = { x0: H.x + 36, x1: H.x + 92, y: H.y1 };
      DEALER.lane = { x0: DEALER.doorCars.x0 + 4, x1: DEALER.doorCars.x1 - 4, y0: H.y1, y1: B.y + B.h };
      DEALER.stage = { x: H.x + 66, y: H.y + 92, r: 5.5 * U };
      DEALER.curtain = { x0: H.x + 6, x1: H.x + 126, y: H.y + 150 };
      DEALER.viewing = { x: H.x + 66, y: H.y + 232, a: -Math.PI / 2 };
      DEALER.handover = { x: (DEALER.doorCars.x0 + DEALER.doorCars.x1) / 2, y: H.y1 + 46, a: Math.PI / 2 };
      // Owners' bays: west of the lane, cars nose-in facing east.
      DEALER.bays = [];
      for (let i = 0; i < 8; i++) DEALER.bays.push({ x: B.x + 30, y: H.y1 + 20 + i * 25, a: 0, index: i });
      // The display: north row before the brand walls, the hero, the middle pair,
      // the south row by the glass; three podiums on the forecourt.
      const slot = (type, x, y, a, extra = {}) => ({ type, x, y, a, spin: 0, r: 3.4 * U, where: 'hall', color: null, car: null, stolenAt: -1e9, ...extra });
      DEALER.slots = [
        slot('valkyrie', H.x + 172, H.y + 74, Math.PI / 2 + 0.5, { spin: 0.18, brand: 'WALTER MARTIN' }),
        slot('dbs', H.x + 240, H.y + 74, Math.PI / 2 - 0.45, { brand: 'WALTER MARTIN' }),
        slot('zr1x', H.x + 312, H.y + 74, Math.PI / 2 + 0.45, { brand: 'CHEVETTE' }),
        slot('chevetteSE', H.x + 376, H.y + 74, Math.PI / 2 - 0.45, { brand: 'CHEVETTE' }),
        slot('wayron', H.x + 438, H.y + 74, Math.PI / 2 + 0.6, { spin: -0.16, brand: 'MUGATTI' }),
        slot('tourbillon', H.x + 306, H.y + 180, Math.PI / 2 + 0.3, { spin: 0.12, r: 5 * U, hero: true, brand: 'MUGATTI' }),
        slot('jasko', H.x + 192, H.y + 180, Math.PI / 2 - 0.7),
        slot('sirocco', H.x + 420, H.y + 180, Math.PI / 2 + 0.7),
        slot('novera', H.x + 176, H.y + 282, -Math.PI / 2 + 0.55),
        slot('w1', H.x + 240, H.y + 282, -Math.PI / 2 - 0.5, { spin: 0.2 }),
        slot('lafera', H.x + 366, H.y + 282, -Math.PI / 2 + 0.5),
        slot('brutini', H.x + 430, H.y + 282, -Math.PI / 2 - 0.55),
        slot('zr1x', H.x + 166, H.y1 + 106, Math.PI / 2 + 0.65, { where: 'forecourt', color: '#f06a12' }),
        slot('dbs', H.x + 426, H.y1 + 106, Math.PI / 2 - 0.65, { where: 'forecourt', color: '#0b4d3b' }),
        slot('chevetteSE', H.x + 536, H.y1 + 106, Math.PI / 2 - 0.4, { where: 'forecourt', color: '#1f5fc2', r: 3.2 * U }),
      ];
      DEALER.slots.forEach((s, i) => (s.id = i));
      const posts = {
        receptionist: { x: H.x + 388, y: H.y + 331, a: Math.PI / 2 },
        barista: { x: H.x + 531, y: H.y + 27, a: Math.PI / 2 },
        salesmen: [
          { x: H.x + 206, y: H.y + 128, a: Math.PI / 2 },
          { x: H.x + 356, y: H.y + 232, a: Math.PI / 2 },
          { x: H.x + 482, y: H.y + 262, a: Math.PI },
        ],
        guards: [
          { x: DEALER.doorPeople.x0 - 14, y: H.y1 + 14, a: Math.PI / 2, kind: 'door' },
          { x: DEALER.doorPeople.x1 + 14, y: H.y1 + 14, a: Math.PI / 2, kind: 'door' },
          { x: DEALER.doorCars.x1 + 14, y: H.y1 + 16, a: Math.PI / 2, kind: 'door' },
          { x: H.x + 140, y: H.y + 310, a: 0, kind: 'floor', patrol: [{ x: H.x + 140, y: H.y + 310 }, { x: H.x + 140, y: H.y + 190 }] },
          { x: H.x + 560, y: H.y + 330, a: Math.PI, kind: 'floor', patrol: [{ x: H.x + 560, y: H.y + 330 }, { x: H.x + 578, y: H.y + 250 }] },
        ],
      };
      DEALER.posts = posts;
      // Furniture the renderer draws and people walk round (also colliders).
      DEALER.furniture = {
        reception: { x: H.x + 356, y: H.y + 338, w: 64, h: 16 },
        bar: { x: H.x + 486, y: H.y + 34, w: 90, h: 14 },
        sofaA: { x: H.x + 482, y: H.y + 72, w: 60, h: 12 },
        sofaB: { x: H.x + 482, y: H.y + 84, w: 12, h: 50 },
        sofaC: { x: H.x + 528, y: H.y + 134, w: 30, h: 12 },
        table: { x: H.x + 506, y: H.y + 100, w: 22, h: 16 },
        lounge: { x: H.x + 468, y: H.y + 8, w: H.w - 476, h: 162 },
        loungeRail: { x: H.x + 468, y: H.y + 166, w: 82, h: 4 },
        config: { x: H.x + 478, y: H.y + 212, w: 88, h: 4 },
        kiosk: { x: H.x + 514, y: H.y + 236, w: 16, h: 10 },
        service: { x: H.x + 104, y: H.y + 250, w: 20, h: 44 },
        partition: { x: H.x + 130, y: H.y, w: 4, h: 122 },
        stageWall: { x: H.x + 8, y: H.y + 4, w: 118, h: 3 },
        // The gallery over the bar, reached by the stair on the east wall.
        mezzanine: { x: H.x + 470, y: H.y, w: H.w - 470, h: 30, height: 5.4 * U },
        brandWalls: [
          { brand: 'WALTER MARTIN', x0: H.x + 140, x1: H.x + 250, color: '#0b4d3b', accent: '#b6f02c' },
          { brand: 'CHEVETTE', x0: H.x + 254, x1: H.x + 364, color: '#141518', accent: '#f2c21b' },
          { brand: 'MUGATTI', x0: H.x + 368, x1: H.x + 478, color: '#0d2a66', accent: '#e8e4da' },
        ],
        podiums: DEALER.slots.filter((s) => s.where === 'forecourt').map((s) => ({ x: s.x, y: s.y, r: s.r + 10 })),
        planters: [
          { x: DEALER.doorPeople.x0 - 44, y: H.y1 + 60, w: 22, h: 60 },
          { x: DEALER.doorPeople.x1 + 22, y: H.y1 + 60, w: 22, h: 60 },
          { x: DEALER.doorPeople.x0 - 44, y: H.y1 + 150, w: 22, h: 50 },
          { x: DEALER.doorPeople.x1 + 22, y: H.y1 + 150, w: 22, h: 50 },
        ],
        flags: [0, 1, 2, 3, 4, 5].map((i) => ({ x: (i < 3 ? DEALER.doorPeople.x0 - 60 : DEALER.doorPeople.x1 + 60) + (i % 3) * (i < 3 ? -56 : 56), y: B.y + B.h - 14 })),
        pylon: { x: B.x + B.w - 34, y: B.y + B.h - 26, w: 14, h: 8, height: 9 * U },
      };
      // ---- Colliders ----
      const solid = (x, y, w, h, height, kind) => {
        const s = isleSolid(x, y, w, h, height, kind);
        DEALER.solids.push(s);
        return s;
      };
      const F = DEALER.furniture,
        wall = DEALER.height;
      solid(H.x - 4, H.y - 4, H.w + 8, 4, wall, 'dealer wall');
      solid(H.x - 4, H.y, 4, H.h + 2, wall, 'dealer wall');
      solid(H.x1, H.y, 4, H.h + 2, wall, 'dealer wall');
      // The frontage: 3 m panes between the doors, each its own collider (a
      // shattered pane opens, dealershipShatter).
      DEALER.panes = [];
      const runs = [
        [H.x, DEALER.doorCars.x0],
        [DEALER.doorCars.x1, DEALER.doorPeople.x0],
        [DEALER.doorPeople.x1, H.x1],
      ];
      for (const [a, b] of runs) {
        const n = Math.max(1, Math.round((b - a) / 24));
        for (let i = 0; i < n; i++) {
          const x0 = a + ((b - a) * i) / n,
            x1 = a + ((b - a) * (i + 1)) / n,
            pane = { id: DEALER.panes.length, x0, x1, y: H.y1, broken: false, brokenAt: -1, solid: null };
          pane.solid = solid(x0, H.y1 - 1.5, x1 - x0, 3, wall - 8, 'dealer glass');
          DEALER.panes.push(pane);
        }
      }
      for (const key of ['reception', 'bar', 'sofaA', 'sofaB', 'sofaC', 'table', 'loungeRail', 'kiosk', 'service', 'partition', 'stageWall', 'config']) {
        const r = F[key];
        solid(r.x, r.y, r.w, r.h, key === 'partition' || key === 'stageWall' || key === 'config' ? 3.2 * U : 1.1 * U, 'dealer ' + key);
      }
      for (const p of F.planters) solid(p.x, p.y, p.w, p.h, 0.9 * U, 'dealer planter');
      for (const f of F.flags) solid(f.x - 1.5, f.y - 1.5, 3, 3, 9 * U, 'dealer flag');
      solid(F.pylon.x, F.pylon.y, F.pylon.w, F.pylon.h, F.pylon.height, 'dealer pylon');
      // The business, for the island's lists (district names, walkers' doors).
      const shop = { name: DEALER.name, trade: 'cars', block: [0, 2], slot: 0, width: H.w, color: '#101114', door: { x: (DEALER.doorPeople.x0 + DEALER.doorPeople.x1) / 2, y: H.y1 + 12 } };
      monarchPlan.shops.push(shop);
      plan.dealership = true;
      DEALER.planned = true;
    }
    // No street tree or lantern in the forecourt's lane mouth (monarch.js planIsleStreetscape).
    function dealershipKeepOut(x, y) {
      if (!DEALER.planned) return false;
      const L = DEALER.lane;
      return x > L.x0 - 22 && x < L.x1 + 22 && y > L.y1 - 10 && y < L.y1 + 60;
    }
    // Inside the hall's walls (a margin in from them).
    function inDealerHall(x, y, margin = 0) {
      const H = DEALER.hall;
      return !!H && x > H.x + margin && x < H.x1 - margin && y > H.y + margin && y < H.y1 - margin;
    }
    // On the lot: the hall, the forecourt and a little of the pavement round it.
    function onDealerLot(x, y, margin = 0) {
      const L = DEALER.lot;
      return !!L && x > L.x - margin && x < L.x + L.w + margin && y > L.y - margin && y < L.y + L.h + margin;
    }
    /* The ground sheet under the lot (monarch.js paintIsleBlockGround): the
       forecourt's granite and the lane's setts, the bays' lines, the hall's
       footprint (the floor itself is a mesh), the entrance walk. */
    function paintDealershipGround(g, plan, P, detail) {
      if (!DEALER.planned) return;
      const L = DEALER.lot,
        H = DEALER.hall,
        fill = (x, y, w, h, c) => {
          g.fillStyle = c;
          g.fillRect(x, y, w, h);
        };
      // Pale granite forecourt with a band of dark stone round it.
      fill(L.x, L.y, L.w, L.h, '#b9b4a8');
      fill(L.x + 4, H.y1, L.w - 8, L.y + L.h - H.y1 - 4, '#d6d1c5');
      if (detail) {
        g.strokeStyle = 'rgba(120,114,100,0.35)';
        g.lineWidth = 0.7;
        for (let x = L.x + 4; x < L.x + L.w; x += 16) {
          g.beginPath();
          g.moveTo(x, H.y1);
          g.lineTo(x, L.y + L.h - 4);
          g.stroke();
        }
        for (let y = H.y1; y < L.y + L.h; y += 32) {
          g.beginPath();
          g.moveTo(L.x + 4, y);
          g.lineTo(L.x + L.w - 4, y);
          g.stroke();
        }
      }
      // The lane: charcoal setts out to Regent Row, and the owners' bays beside it.
      const lane = DEALER.lane;
      fill(lane.x0 - 4, lane.y0, lane.x1 - lane.x0 + 8, lane.y1 - lane.y0 + 40, '#4a4d50');
      if (detail) {
        g.fillStyle = 'rgba(255,255,255,0.05)';
        for (let y = lane.y0; y < lane.y1 + 40; y += 6) for (let x = lane.x0 - 4 + ((y / 6) % 2) * 3; x < lane.x1 + 4; x += 6) g.fillRect(x, y, 2.5, 2.5);
      }
      fill(L.x + 4, H.y1 + 6, lane.x0 - L.x - 10, 202, '#5a5d60');
      g.strokeStyle = '#e9e6dd';
      g.lineWidth = 1.2;
      for (let i = 0; i <= 8; i++) {
        const y = H.y1 + 7.5 + i * 25;
        g.beginPath();
        g.moveTo(L.x + 8, y);
        g.lineTo(lane.x0 - 8, y);
        g.stroke();
      }
      g.fillStyle = '#c9a24e';
      for (const b of DEALER.bays) g.fillRect(L.x + 10, b.y - 1, 6, 2);
      // The handover bay: a gold rectangle on the lane.
      const h = DEALER.handover;
      g.strokeStyle = '#c9a24e';
      g.lineWidth = 1.6;
      g.strokeRect(h.x - 13, h.y - 24, 26, 48);
      // The entrance walk: long dark granite slabs from the street to the door.
      const d = DEALER.doorPeople;
      fill(d.x0 - 10, H.y1, d.x1 - d.x0 + 20, L.y + L.h - H.y1, '#8d8a82');
      if (detail) {
        g.strokeStyle = 'rgba(40,38,34,0.4)';
        g.lineWidth = 0.8;
        for (let y = H.y1; y < L.y + L.h; y += 20) {
          g.beginPath();
          g.moveTo(d.x0 - 10, y);
          g.lineTo(d.x1 + 10, y);
          g.stroke();
        }
      }
      // Under the hall (the floor mesh covers it; the minimap shows the footprint).
      fill(H.x - 4, H.y - 4, H.w + 8, H.h + 6, '#2a2c30');
      fill(H.x + 2, H.y + 2, H.w - 4, H.h - 4, '#e9e5dc');
    }
    /* ---- State and the saved garage ------------------------------------------------ */
    const DEALER_SAVE_KEY = 'dead-end-city-garage';
    const dealer = {
      loaded: false,
      owned: [],
      nextId: 1,
      alarmUntil: 0,
      alarmStartedAt: -1e9,
      alarmReason: '',
      shutter: 0,
      menu: null,
      reveal: null,
      test: null,
      clock: 0,
      restockClock: 0,
      lastGreeting: -1e9,
      lastCarSpeed: 0,
      sold: 0,
      stolen: 0,
      log: [],
    };
    function dealerLog(text) {
      dealer.log.push({ at: Math.round(gameTime * 10) / 10, text });
      if (dealer.log.length > 20) dealer.log.shift();
    }
    function loadDealerGarage() {
      dealer.loaded = true;
      try {
        const s = JSON.parse(localStorage.getItem(DEALER_SAVE_KEY) || 'null');
        if (!s || !Array.isArray(s.cars)) return;
        dealer.owned = s.cars
          .filter((c) => c && VEHICLE_DEFINITIONS[c.type] && typeof c.color === 'string')
          .slice(0, 24)
          .map((c) => ({ id: Math.max(1, c.id | 0), type: c.type, color: c.color, paint: String(c.paint || ''), price: Math.max(0, +c.price || 0), boughtAt: +c.boughtAt || 0, car: null, lostAt: -1 }));
        dealer.nextId = dealer.owned.reduce((m, c) => Math.max(m, c.id + 1), 1);
      } catch {}
    }
    function saveDealerGarage() {
      try {
        localStorage.setItem(DEALER_SAVE_KEY, JSON.stringify({ version: 1, cars: dealer.owned.map(({ id, type, color, paint, price, boughtAt }) => ({ id, type, color, paint, price, boughtAt })) }));
      } catch {}
    }
    /* ---- The cars on display -------------------------------------------------------- */
    // A display car on its slot: parked, unlocked for no one, the slot's paint.
    function spawnDisplayCar(s) {
      const item = PRESTIGE_BY_TYPE.get(s.type),
        color = s.color || item?.paints[0][1] || VEHICLE_DEFINITIONS[s.type].color,
        c = makeCar(s.type, s.x, s.y, s.a, false, color);
      c.dealerDisplay = s;
      c.authorized = false;
      c.locked = false;
      s.car = c;
      s.baseColor = color;
      return c;
    }
    function displayCarIntact(c) {
      return c && vehicles.includes(c) && c.hp > 0 && c.dealerDisplay;
    }
    // Keeps the display stocked; a taken or wrecked car is replaced once the
    // player is well away and the alarm is over.
    function stockDealership() {
      const far = !onDealerLot(player.x, player.y, 700);
      for (const s of DEALER.slots) {
        if (s.car && vehicles.includes(s.car) && s.car.dealerDisplay === s) continue;
        if (s.car && s.car.dealerDisplay === s && !vehicles.includes(s.car)) s.car = null;
        if (s.car) continue;
        if (!far && gameTime - s.stolenAt < 600) continue;
        if (dealer.alarmUntil > gameTime) continue;
        if (!far && crowdInView(s.x, s.y, 60)) continue;
        spawnDisplayCar(s);
      }
    }
    // The turntables turn their cars; nothing else moves a display car.
    function turnDisplayCars(deltaSeconds) {
      for (const s of DEALER.slots) {
        const c = s.car;
        if (!displayCarIntact(c) || c === player.car) continue;
        if (s.spin && dealer.alarmUntil <= gameTime) {
          c.a = normalizeAngle(c.a + s.spin * deltaSeconds);
          c.moveA = c.a;
          c.stepStartA = c.a;
        }
        // A nudge off the turntable is set right (a person leaning on it, a bump).
        if (Math.hypot(c.x - s.x, c.y - s.y) > 1.5 && Math.hypot(c.x - s.x, c.y - s.y) < 40 && Math.hypot(c.vx || 0, c.vy || 0) < 5) {
          c.x += (s.x - c.x) * Math.min(1, deltaSeconds * 2);
          c.y += (s.y - c.y) * Math.min(1, deltaSeconds * 2);
        }
      }
    }
    // The display car the action key would reach (nearestCar's 64 units, game.js).
    function displayCarNear(x, y, reach = 64) {
      let best = null,
        bestD = reach;
      for (const s of DEALER.slots) {
        if (!displayCarIntact(s.car)) continue;
        const d = Math.hypot(s.car.x - x, s.car.y - y);
        if (d < bestD) {
          best = s;
          bestD = d;
        }
      }
      return best;
    }
    /* ---- Owned cars ----------------------------------------------------------------- */
    function ownedCarLive(rec) {
      return rec.car && vehicles.includes(rec.car) && rec.car.hp > 0;
    }
    function markOwned(c, rec) {
      c.owned = true;
      c.ownedId = rec.id;
      c.authorized = true;
      c.locked = false;
      c.dealerDisplay = null;
      rec.car = c;
    }
    // The first free owner's bay (none: the handover bay).
    function freeOwnerBay() {
      for (const b of DEALER.bays) if (!vehicles.some((c) => c.hp > 0 && Math.hypot(c.x - b.x, c.y - b.y) < 14)) return b;
      return null;
    }
    // Every two seconds: owned cars that are gone (wrecked, or left beyond reach)
    // come back to their bay while the player is not looking at it.
    function keepOwnedCars() {
      if (!DEALER.planned) return;
      for (const rec of dealer.owned) {
        if (ownedCarLive(rec)) continue;
        if (rec.car && player.car === rec.car) continue;
        if (rec.lostAt < 0) rec.lostAt = gameTime;
        const lost = gameTime - rec.lostAt,
          far = !onDealerLot(player.x, player.y, 500);
        if (lost < (rec.car ? 45 : 0)) continue;
        const bay = freeOwnerBay();
        if (!bay) return;
        if (!far && (rec.car || crowdInView(bay.x, bay.y, 40))) continue;
        const replaced = !!rec.car;
        const c = makeCar(rec.type, bay.x, bay.y, bay.a, false, rec.color);
        markOwned(c, rec);
        rec.lostAt = -1;
        if (replaced) {
          tell(DEALER.name + ' · PRESTIGE CARE · Your ' + VEHICLE_DEFINITIONS[rec.type].name + ' is waiting in the owners’ bays on Monarch Isle.', 5);
          dealerLog('replaced ' + rec.type);
        }
      }
    }
    /* ---- Security ------------------------------------------------------------------- */
    /**
     * The alarm: four stars at once (never lower than the level already
     * reached), the shutters, the guards turned on the player. Called for any
     * attack on the lot; the reason goes to the log and the headline.
     */
    function dealershipAlarm(reason) {
      if (!DEALER.planned || gameMode === 'menu') return;
      const fresh = dealer.alarmUntil <= gameTime;
      dealer.alarmUntil = gameTime + 90;
      dealer.alarmReason = reason;
      if (fresh) {
        dealer.alarmStartedAt = gameTime;
        dealerLog('alarm: ' + reason);
        announce(DEALER.name + ' · SECURITY ALARM', 'ARMED RESPONSE', 2.8);
        tell('The showroom’s silent alarm has gone to the police. Private security is drawing on you.', 5);
        if (dealer.menu) closeDealerMenu();
        if (dealer.test) endTestDrive('The salesman bails out of the test drive: the alarm is going.');
      }
      if (Math.ceil(wantedStars) < 4) setWantedLevel(4);
      // A little heat on top of the star's floor, so five comes by the usual rules.
      addHeat(4);
      dealershipGuardsProvoked();
    }
    // notifyViolence (harbor.js) reports every shot and blast here.
    function dealershipHearsViolence(source, kind, attacker) {
      if (!DEALER.planned || attacker !== player || !source) return;
      const reach = kind === 'explosion' ? 160 : 24;
      if (!onDealerLot(source.x, source.y, reach) && !onDealerLot(player.x, player.y, 8)) return;
      if (kind === 'explosion') for (const pane of DEALER.panes) if (!pane.broken && Math.hypot((pane.x0 + pane.x1) / 2 - source.x, pane.y - source.y) < 140) dealershipShatter(pane, 'blast');
      dealershipAlarm(kind === 'explosion' ? 'explosion on the lot' : 'gunfire');
    }
    /* A pane gives way: its collider goes (people and cars can pass), the
       renderer shows the broken frame and its shards, the glass rings out. */
    function dealershipShatter(pane, why) {
      if (pane.broken) return;
      pane.broken = true;
      pane.brokenAt = gameTime;
      const s = pane.solid,
        i = monarchSolidList.indexOf(s);
      if (i >= 0) monarchSolidList.splice(i, 1);
      // Out of the vehicle colliders too (physics.js staticGrid).
      for (const [key, list] of staticGrid) {
        const k = list.findIndex((b) => b.kind === 'isle dealer glass' && Math.abs(b.x - (s.x + s.w / 2)) < 0.5 && Math.abs(b.y - (s.y + s.h / 2)) < 0.5);
        if (k >= 0) list.splice(k, 1);
        if (!list.length) staticGrid.delete(key);
      }
      staticGridVersion++;
      const cx = (pane.x0 + pane.x1) / 2;
      for (let k = 0; k < 18; k++) particle(cx + randomBetween(-10, 10), pane.y + randomBetween(-2, 8), k % 2 ? '#d8eef6' : '#9fc4d2', 1, 60);
      if (audioBuffers['crash-glass-1']) playSample(Math.random() < 0.5 ? 'crash-glass-1' : 'crash-glass-2', 0.55, randomBetween(0.9, 1.08), { x: cx, y: pane.y });
      crowdAlarm('crash', { x: cx, y: pane.y }, player, 1);
      dealerLog('pane ' + pane.id + ' shattered (' + why + ')');
    }
    // Player rounds through the glass, cars into it, display cars hurt, staff hurt.
    function watchDealershipHarm(deltaSeconds) {
      const H = DEALER.hall,
        line = H.y1;
      for (const b of bullets) {
        if (b.enemy || (b.owner && b.owner !== player)) continue;
        // The round's path over the last frame crosses the glass line?
        const y0 = b.y - (b.vy || 0) * deltaSeconds * 1.2;
        if ((y0 - line) * (b.y - line) > 0 && Math.abs(b.y - line) > 3) continue;
        const t = Math.abs(b.y - y0) > 0.01 ? (line - y0) / (b.y - y0) : 1,
          x = b.x - (b.vx || 0) * deltaSeconds * 1.2 * (1 - clamp(t, 0, 1));
        if (x < H.x || x > H.x1) continue;
        const pane = DEALER.panes.find((p) => !p.broken && x >= p.x0 && x <= p.x1);
        if (pane) {
          dealershipShatter(pane, 'shot');
          dealershipAlarm('shots through the glass');
        }
      }
      // A car into the frontage: a corner of it at the glass, going over 18 km/h
      // a moment ago (the collider stops it, so its speed falls at the contact).
      const car = player.car;
      if (car && !isAircraft(car)) {
        const spec = vehicleSpec(car),
          speed = Math.hypot(car.vx || 0, car.vy || 0),
          was = Math.max(speed, dealer.lastCarSpeed || 0),
          cos = Math.cos(car.a),
          sin = Math.sin(car.a);
        let minX = Infinity,
          maxX = -Infinity,
          near = false;
        for (const [u, v] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const x = car.x + (cos * u * spec.l) / 2 - (sin * v * spec.w) / 2,
            y = car.y + (sin * u * spec.l) / 2 + (cos * v * spec.w) / 2;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          if (Math.abs(y - line) < 4) near = true;
        }
        if (near && was > 18 * KMH && maxX > H.x && minX < H.x1)
          for (const pane of DEALER.panes)
            if (!pane.broken && maxX > pane.x0 + 1 && minX < pane.x1 - 1) {
              dealershipShatter(pane, 'rammed');
              dealershipAlarm('a car through the glass');
            }
        dealer.lastCarSpeed = speed;
      } else dealer.lastCarSpeed = 0;
      for (const s of DEALER.slots) {
        const c = s.car;
        if (!c || c.dealerDisplay !== s || !vehicles.includes(c)) continue;
        const hurt = c.hp < c.maxhp - 4 || c.hp <= 0;
        if (hurt && !s.hurtReported && Math.hypot(player.x - c.x, player.y - c.y) < 700) {
          s.hurtReported = true;
          dealershipAlarm('a display car damaged');
        }
        // Taken: the player drove off in it.
        if (player.car === c) {
          c.dealerDisplay = null;
          c.stolenFromDealer = true;
          s.car = null;
          s.stolenAt = gameTime;
          dealer.stolen++;
          dealershipAlarm('a display car stolen');
          tell('You are driving a ' + VEHICLE_DEFINITIONS[c.type].name + ' off the showroom floor. Every unit on the island is on you.', 5);
        }
      }
    }
    /* ---- Buying --------------------------------------------------------------------- */
    function dealerCatalogItem(type) {
      const item = PRESTIGE_BY_TYPE.get(type);
      return item ? prestigeFigures(item) : null;
    }
    function dealershipCanTrade() {
      return dealer.alarmUntil <= gameTime && wantedStars <= 0 && !mission;
    }
    function buyPrestigeCar(type, paintIndex = 0) {
      const item = dealerCatalogItem(type);
      if (!item) return { ok: false, reason: 'unknown car' };
      if (dealer.alarmUntil > gameTime) return { ok: false, reason: 'alarm' };
      if (wantedStars > 0) return { ok: false, reason: 'wanted' };
      if (cash < item.price) return { ok: false, reason: 'funds', short: item.price - cash };
      const paint = item.paints[clamp(paintIndex | 0, 0, item.paints.length - 1)];
      cash -= item.price;
      const rec = { id: dealer.nextId++, type, color: paint[1], paint: paint[0], price: item.price, boughtAt: Math.round(worldMinutes), car: null, lostAt: -1 };
      dealer.owned.push(rec);
      dealer.sold++;
      saveDealerGarage();
      save();
      dealerLog('sold ' + type + ' in ' + paint[0] + ' for ' + item.price);
      return { ok: true, rec, item };
    }
    /* ---- The purchase card (gameMode 'dealer') ------------------------------------ */
    let dealerOverlay = null;
    function dealerStyles() {
      if (document.getElementById('dealerStyle')) return;
      const style = document.createElement('style');
      style.id = 'dealerStyle';
      style.textContent = `
#dealerOverlay{position:fixed;inset:0;z-index:38;pointer-events:none;font-family:var(--ui-font,'Helvetica Neue',Arial,sans-serif);color:#f3efe6}
#dealerOverlay.hidden{display:none}
#dealerOverlay .dl-shade{position:absolute;inset:0;background:linear-gradient(90deg,#07090cf2 0%,#07090ce6 34%,#07090c80 52%,#07090c00 70%);pointer-events:auto}
#dealerOverlay .dl-panel{position:absolute;left:clamp(16px,4vw,56px);top:50%;transform:translateY(-50%);width:min(520px,calc(100vw - 32px));max-height:94vh;overflow:auto;pointer-events:auto;animation:dlIn .45s cubic-bezier(.2,.8,.2,1)}
@keyframes dlIn{from{transform:translate(-18px,-50%)}to{transform:translate(0,-50%)}}
#dealerOverlay .dl-house{display:flex;align-items:center;gap:10px;font:800 10px/1 var(--ui-font);letter-spacing:.34em;color:#c9a24e}
#dealerOverlay .dl-house i{flex:1;height:1px;background:linear-gradient(90deg,#c9a24e88,#c9a24e00)}
#dealerOverlay .dl-marque{margin-top:18px;font:800 13px/1 var(--ui-font);letter-spacing:.42em;color:#d8d2c2}
#dealerOverlay .dl-model{margin:6px 0 0;font:200 44px/1 var(--ui-font);letter-spacing:.02em;text-transform:uppercase}
#dealerOverlay .dl-tier{display:inline-block;margin-top:10px;padding:4px 9px;border:1px solid #c9a24e66;border-radius:99px;font:800 9px/1 var(--ui-font);letter-spacing:.24em;color:#e2c897}
#dealerOverlay .dl-blurb{margin:14px 0 0;font:400 13px/1.55 var(--ui-font);color:#bdb8ac;max-width:470px}
#dealerOverlay .dl-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:18px;background:#ffffff14;border:1px solid #ffffff14;border-radius:10px;overflow:hidden}
#dealerOverlay .dl-grid div{padding:11px 10px 10px;background:#0b0e12e8}
#dealerOverlay .dl-grid b{display:block;font:300 22px/1 var(--ui-font);color:#fff;white-space:nowrap}
#dealerOverlay .dl-grid b small{font:600 10px/1 var(--ui-font);color:#9c978b;margin-left:3px}
#dealerOverlay .dl-grid span{display:block;margin-top:6px;font:800 8px/1 var(--ui-font);letter-spacing:.2em;color:#8f8a7e}
#dealerOverlay .dl-grid .wide{grid-column:span 2}
#dealerOverlay .dl-grid .wide b{font:500 12px/1.3 var(--ui-font);white-space:normal}
#dealerOverlay .dl-bars{margin-top:12px;display:grid;gap:6px}
#dealerOverlay .dl-bar{display:grid;grid-template-columns:110px 1fr;align-items:center;gap:10px;font:800 8px/1 var(--ui-font);letter-spacing:.2em;color:#8f8a7e}
#dealerOverlay .dl-bar i{display:block;height:4px;border-radius:2px;background:#ffffff14;overflow:hidden}
#dealerOverlay .dl-bar i em{display:block;height:100%;background:linear-gradient(90deg,#8a6d2e,#e2c897)}
#dealerOverlay .dl-paints{margin-top:16px}
#dealerOverlay .dl-paints .row{display:flex;gap:9px;flex-wrap:wrap;margin-top:8px}
#dealerOverlay .dl-label{font:800 9px/1 var(--ui-font);letter-spacing:.24em;color:#8f8a7e}
#dealerOverlay .dl-swatch{width:30px;height:30px;border-radius:50%;border:2px solid #ffffff2a;padding:0;cursor:pointer;box-shadow:inset 0 -6px 10px #0006,inset 0 5px 8px #fff4;transition:transform .2s,border-color .2s}
#dealerOverlay .dl-swatch[aria-pressed=true]{border-color:#e2c897;transform:scale(1.16)}
#dealerOverlay .dl-paintname{margin-top:8px;font:500 12px/1 var(--ui-font);color:#e8e2d4}
#dealerOverlay .dl-price{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid #ffffff1c}
#dealerOverlay .dl-price b{display:block;font:200 38px/1 var(--ui-font);letter-spacing:.01em;color:#fff}
#dealerOverlay .dl-price small{display:block;margin-top:6px;font:700 10px/1.3 var(--ui-font);letter-spacing:.14em;color:#9c978b}
#dealerOverlay .dl-price small.short{color:#f08672}
#dealerOverlay .dl-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
#dealerOverlay .dl-actions button{padding:13px 18px;border-radius:99px;border:1px solid #ffffff30;background:#ffffff0c;color:#f3efe6;font:900 11px/1 var(--ui-font);letter-spacing:.2em}
#dealerOverlay .dl-actions button.buy{flex:1;border-color:#e2c897;background:linear-gradient(180deg,#e9d3a2,#b99450);color:#16130c}
#dealerOverlay .dl-actions button.buy:disabled{border-color:#f0867255;background:#f086721a;color:#f08672;cursor:not-allowed;filter:none}
#dealerOverlay .dl-keys{margin-top:12px;font:700 9px/1.6 var(--ui-font);letter-spacing:.14em;color:#77736a}
#dealerOverlay .dl-keys kbd{margin-right:4px}
#dealerOverlay .dl-browse{position:absolute;right:clamp(16px,3vw,40px);top:clamp(96px,14vh,130px);max-width:calc(100vw - 640px);display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;pointer-events:auto}
body.dealer-open #interaction,body.dealer-open .quickkeys,body.dealer-open #pager{visibility:hidden}
body.dealer-reveal #pager,body.dealer-reveal #toast{visibility:hidden}
#dealerOverlay .dl-browse button{padding:9px 12px;border-radius:8px;border:1px solid #ffffff26;background:#0b0e12c0;color:#e8e2d4;font:800 9px/1 var(--ui-font);letter-spacing:.18em}
#dealerOverlay .dl-browse button[aria-current=true]{border-color:#e2c897;color:#e2c897}
#dealerOverlay .dl-garage{margin-top:16px;display:grid;gap:8px}
#dealerOverlay .dl-garage .car{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:10px;padding:10px 12px;border:1px solid #ffffff18;border-radius:10px;background:#0b0e12d8}
#dealerOverlay .dl-garage .dot{width:14px;height:14px;border-radius:50%;box-shadow:inset 0 -3px 5px #0007}
#dealerOverlay .dl-garage b{font:600 13px/1.2 var(--ui-font)}
#dealerOverlay .dl-garage small{display:block;font:600 10px/1.3 var(--ui-font);color:#9c978b;letter-spacing:.06em}
#dealerOverlay .dl-garage button{padding:8px 11px;border-radius:99px;border:1px solid #e2c89777;background:#e2c8971a;color:#e2c897;font:900 9px/1 var(--ui-font);letter-spacing:.16em}
#dealerReveal{position:fixed;inset:0;z-index:37;pointer-events:none;font-family:var(--ui-font,'Helvetica Neue',Arial,sans-serif)}
#dealerReveal.hidden{display:none}
#dealerReveal .fade{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .6s}
#dealerReveal .card{position:absolute;left:50%;bottom:11vh;transform:translateX(-50%);text-align:center;color:#fff;opacity:0;transition:opacity .8s, transform .8s}
#dealerReveal .card.show{opacity:1}
#dealerReveal .card small{display:block;font:800 10px/1 var(--ui-font);letter-spacing:.42em;color:#e2c897}
#dealerReveal .card b{display:block;margin-top:10px;font:200 clamp(22px,3.4vw,38px)/1.1 var(--ui-font);letter-spacing:.04em;white-space:nowrap;text-shadow:0 4px 30px #000c}
#dealerReveal .card span{display:block;margin-top:10px;font:600 12px/1 var(--ui-font);letter-spacing:.24em;color:#d8d2c2}
#dealerReveal canvas{position:absolute;inset:0;width:100%;height:100%}
@media (max-width:1000px){#dealerOverlay .dl-browse{display:none}}
@media (max-width:700px){#dealerOverlay .dl-model{font-size:32px}#dealerOverlay .dl-grid{grid-template-columns:repeat(2,1fr)}#dealerOverlay .dl-shade{background:#07090ce8}}
`;
      document.head.appendChild(style);
    }
    function dealerElement(tag, className, text) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    function ensureDealerOverlay() {
      if (dealerOverlay) return dealerOverlay;
      dealerStyles();
      dealerOverlay = dealerElement('div', 'hidden');
      dealerOverlay.id = 'dealerOverlay';
      dealerOverlay.setAttribute('role', 'dialog');
      dealerOverlay.setAttribute('aria-label', DEALER.name);
      document.body.appendChild(dealerOverlay);
      return dealerOverlay;
    }
    // The cars the card can browse: every catalogue car that is on show now.
    function dealerBrowseList() {
      const seen = new Set(),
        list = [];
      for (const s of DEALER.slots)
        if (s.where === 'hall' && !seen.has(s.type) && PRESTIGE_BY_TYPE.has(s.type)) {
          seen.add(s.type);
          list.push(s);
        }
      return list;
    }
    function openDealerMenu(slot, kind = 'car') {
      if (gameMode !== 'play') return false;
      const s = slot || dealerBrowseList()[0];
      dealer.menu = { kind, slot: s, type: s?.type, paint: 0, view: { x: cameraTarget.x, y: cameraTarget.y, zoom: worldZoom } };
      if (s) {
        const item = PRESTIGE_BY_TYPE.get(s.type),
          color = s.car?.color || s.baseColor;
        dealer.menu.paint = Math.max(0, item.paints.findIndex((p) => p[1] === color));
      }
      gameMode = 'dealer';
      keys = {};
      mouse.down = false;
      ensureDealerOverlay().classList.remove('hidden');
      document.body.classList.add('dealer-open');
      syncPanelCover();
      frameDealerMenu();
      renderDealerMenu();
      dealershipSalesPitch(s, 'open');
      return true;
    }
    function closeDealerMenu() {
      const m = dealer.menu;
      if (!m) return;
      // The plinth car goes back to its own colour.
      if (m.slot?.car && displayCarIntact(m.slot.car)) m.slot.car.color = m.slot.baseColor;
      dealer.menu = null;
      if (dealerOverlay) dealerOverlay.classList.add('hidden');
      document.body.classList.remove('dealer-open');
      if (gameMode === 'dealer') gameMode = 'play';
      syncPanelCover();
      worldZoom = m.view.zoom;
      canvasScale = clamp(Math.min(viewportWidth / 1250, viewportHeight / 850), 0.72, 1.35) * worldZoom;
      keys = {};
      canvas.focus();
    }
