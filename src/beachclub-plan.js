    // Marea beach club plan: plot, solids, gates, walk graph and opening hours (MAREA, mareaPath, mareaPhase).
    const MAREA = {
      name: 'MAREA',
      plot: BEACH_CLUB_PLOT,
      // Plot-local rectangles [u0, v0, u1, v1] of everything with a footprint.
      wallV: 44,
      wallDepth: 8,
      door: [292, 44, 312, 52],
      staff: [6, 52, 92, 100],
      restrooms: [336, 52, 394, 100],
      cashier: [262, 62, 284, 82],
      screen: [146, 52, 254, 57],
      booth: [166, 58, 234, 92],
      speakers: [
        [140, 60, 160, 80],
        [240, 60, 260, 80],
      ],
      floor: [120, 96, 292, 184],
      truss: [
        [118, 94],
        [294, 94],
        [118, 186],
        [294, 186],
      ],
      bar: [44, 104, 54, 190],
      backBar: [6, 104, 16, 190],
      barRoof: [0, 92, 112, 200],
      highTables: [
        [84, 118],
        [84, 146],
        [84, 172],
      ],
      vip: [322, 100, 394, 188],
      vipGate: [318, 140, 324, 156],
      vipSofas: [
        [376, 106, 392, 180],
        [330, 104, 372, 112],
      ],
      vipTables: [
        [352, 132],
        [352, 160],
      ],
      daybeds: [],
      pool: [58, 222, 318, 266],
      poolWater: [62, 226, 314, 262],
      poolBar: [346, 204, 388, 220],
      cabanas: [
        [6, 212, 44, 238],
        [6, 242, 44, 268],
        [6, 272, 44, 296],
      ],
      lounge: { u: 362, v: 262, r: 24 },
      southDaybeds: [],
      gate: [200, 296, 240, 300],
      sunbeds: [],
      palms: [],
    };
    for (let u = 96; u + 26 <= 312; u += 36) MAREA.daybeds.push([u, 198, u + 26, 210]);
    for (let u = 70; u + 24 <= 318; u += 38) if (u + 24 < 200 || u > 240) MAREA.southDaybeds.push([u, 277, u + 24, 288]);
    for (const [u, v] of [
      [150, 316], [180, 324], [262, 316], [292, 324], [322, 318], [120, 324],
    ])
      MAREA.sunbeds.push({ u, v });
    MAREA.palms.push(
      [22, 22], [70, 20], [118, 22],
      [20, 204], [340, 194], [392, 194], [50, 292], [330, 292], [392, 290],
      [100, 342], [246, 346], [340, 340], [60, 330], [160, 350],
    );
    function mareaPoint(u, v) {
      return { x: MAREA.plot.x + u, y: MAREA.plot.y + v };
    }
    function mareaLocal(x, y) {
      return { u: x - MAREA.plot.x, v: y - MAREA.plot.y };
    }
    /* Solid rectangles in map units, with a kind and a height (for vehicles and the renderer). */
    function mareaRect(r, kind, height) {
      return { x0: MAREA.plot.x + r[0], y0: MAREA.plot.y + r[1], x1: MAREA.plot.x + r[2], y1: MAREA.plot.y + r[3], kind, height };
    }
    const MAREA_SOLIDS = [];
    const MAREA_GATES = {};
    (function planMareaSolids() {
      const S = (r, kind, height) => MAREA_SOLIDS.push(mareaRect(r, kind, height));
      const d = MAREA.door;
      // A low wall on the street side: the camera looks north, so anything tall
      // here would hide the queue on the pavement behind it.
      S([0, 44, d[0], 52], 'wall', 10);
      S([d[2], 44, 400, 52], 'wall', 10);
      S([284, 43, 290, 53], 'portal', 30);
      S([314, 43, 320, 53], 'portal', 30);
      S([403, 26, 409, 34], 'pylon', 70);
      S([0, 52, 5, 262], 'wall', 16);
      S([0, 262, 4, 300], 'glass', 5);
      S([395, 52, 400, 200], 'wall', 16);
      S([396, 200, 400, 300], 'glass', 5);
      S([0, 296, MAREA.gate[0], 300], 'glass', 5);
      S([MAREA.gate[2], 296, 400, 300], 'glass', 5);
      S(MAREA.staff, 'staff', 16);
      S(MAREA.restrooms, 'restrooms', 14);
      S(MAREA.cashier, 'kiosk', 14);
      S(MAREA.screen, 'screen', 40);
      for (const [u, v] of MAREA.truss) S([u - 2, v - 2, u + 2, v + 2], 'truss', 50);
      S(MAREA.booth, 'booth', 9);
      for (const r of MAREA.speakers) S(r, 'speaker', 26);
      S(MAREA.bar, 'bar', 10);
      S(MAREA.backBar, 'backbar', 20);
      for (const [u, v] of MAREA.highTables) S([u - 4, v - 4, u + 4, v + 4], 'table', 8);
      S([MAREA.vip[0] - 2, MAREA.vip[1], MAREA.vip[0] + 2, MAREA.vipGate[1]], 'rope', 7);
      S([MAREA.vip[0] - 2, MAREA.vipGate[3], MAREA.vip[0] + 2, MAREA.vip[3]], 'rope', 7);
      S([MAREA.vip[0], MAREA.vip[3] - 2, MAREA.vip[2], MAREA.vip[3] + 2], 'rope', 7);
      for (const r of MAREA.vipSofas) S(r, 'sofa', 6);
      for (const [u, v] of MAREA.vipTables) S([u - 5, v - 5, u + 5, v + 5], 'table', 4);
      for (const r of MAREA.daybeds) S(r, 'daybed', 4);
      for (const r of MAREA.southDaybeds) S(r, 'daybed', 4);
      S(MAREA.pool, 'pool', 5);
      S(MAREA.poolBar, 'poolbar', 10);
      for (const r of MAREA.cabanas) S(r, 'cabana', 20);
      const l = MAREA.lounge;
      S([l.u - l.r, l.v - l.r, l.u + l.r, l.v + l.r], 'lounge', 3);
      // Gates that open and close: the door (night, no band), the VIP rope, the beach gate (night).
      MAREA_GATES.door = mareaRect(MAREA.door, 'door', 22);
      MAREA_GATES.vip = mareaRect(MAREA.vipGate, 'rope', 7);
      MAREA_GATES.beach = mareaRect(MAREA.gate, 'gate', 5);
    })();
    const MAREA_BOX = { x0: MAREA.plot.x - 20, y0: MAREA.plot.y - 10, x1: MAREA.plot.x + MAREA.plot.w + 20, y1: MAREA.plot.y + MAREA.plot.h + 60 };
    /**
     * WALKWAYS
     * A small graph over the open floor; people walk node to node in straight
     * lines (the plan keeps those lines clear), then along a slot's own `via`
     * points to the spot itself.
     */
    const MAREA_NODES = {
      street: [302, 14],
      out: [302, 36],
      in: [302, 62],
      lobby: [300, 96],
      floor: [205, 140],
      e192: [304, 191],
      w192: [64, 191],
      wn: [66, 106],
      staffDoor: [74, 102],
      w216: [51, 216],
      e216: [329, 216],
      w272: [51, 271],
      e272: [329, 271],
      m272: [220, 271],
      gate: [220, 292],
      beach: [220, 324],
      vipGate: [312, 148],
      vipIn: [334, 148],
    };
    const MAREA_EDGES = [
      ['street', 'out'], ['out', 'in'], ['in', 'lobby'], ['lobby', 'floor'], ['lobby', 'e192'], ['lobby', 'vipGate'],
      ['vipGate', 'e192'], ['vipGate', 'vipIn'], ['floor', 'e192'], ['floor', 'w192'], ['floor', 'wn'], ['e192', 'w192'],
      ['w192', 'wn'], ['wn', 'staffDoor'], ['w192', 'w216'], ['e192', 'e216'], ['w216', 'e216'], ['w216', 'w272'],
      ['e216', 'e272'], ['w272', 'm272'], ['m272', 'e272'], ['m272', 'gate'], ['gate', 'beach'],
    ];
    const mareaGraph = {};
    for (const [a, b] of MAREA_EDGES) {
      const pa = MAREA_NODES[a],
        pb = MAREA_NODES[b],
        d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
      (mareaGraph[a] ||= []).push([b, d]);
      (mareaGraph[b] ||= []).push([a, d]);
    }
    /* Shortest node path (Dijkstra over a dozen nodes). */
    function mareaPath(from, to) {
      if (from === to) return [from];
      const dist = { [from]: 0 },
        prev = {},
        open = new Set(Object.keys(MAREA_NODES));
      while (open.size) {
        let best = null;
        for (const n of open) if (dist[n] !== undefined && (best === null || dist[n] < dist[best])) best = n;
        if (best === null || best === to) break;
        open.delete(best);
        for (const [n, d] of mareaGraph[best] || []) {
          const nd = dist[best] + d;
          if (dist[n] === undefined || nd < dist[n]) {
            dist[n] = nd;
            prev[n] = best;
          }
        }
      }
      const path = [to];
      while (path[0] !== from) {
        const p = prev[path[0]];
        if (!p) return [from, to];
        path.unshift(p);
      }
      return path;
    }
    function mareaNodePoint(id) {
      const [u, v] = MAREA_NODES[id];
      return mareaPoint(u, v);
    }

    /**
     * THE SCHEDULE
     * Hours run past midnight as 24+ so the night is one continuous range.
     */
    function mareaHour(h = crowdHour()) {
      return h < 6 ? h + 24 : h;
    }
    function mareaPhase(h = crowdHour()) {
      const t = mareaHour(h);
      if (t >= 28.25 && t < 29.25) return 'closing';
      if (t >= 29.25 || t < 9.5) return 'closed';
      if (t < 18.5) return 'day';
      if (t < 21.75) return 'sunset';
      return 'night';
    }
    /* Piecewise-linear level through [hour, value] keys. */
    function mareaRamp(t, keys) {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++)
        if (t <= keys[i][0]) {
          const [a, va] = keys[i - 1],
            [b, vb] = keys[i];
          return va + ((vb - va) * (t - a)) / Math.max(1e-6, b - a);
        }
      return keys[keys.length - 1][1];
    }
    function mareaLevels(h = crowdHour()) {
      const t = mareaHour(h),
        rain = weather.rain || 0;
      const day = mareaRamp(t, [[9.5, 0], [10.5, 0.3], [12, 0.75], [13.5, 1], [16.5, 1], [18, 0.6], [19.5, 0.25], [20.5, 0.08], [21.5, 0]]),
        night = mareaRamp(t, [[21.5, 0], [22.5, 0.2], [23.5, 0.62], [24.5, 0.95], [26.5, 1], [27.5, 0.7], [28.25, 0.4], [28.8, 0.08], [29.25, 0]]),
        sunset = mareaRamp(t, [[18, 0], [19, 0.8], [20, 1], [21, 0.6], [21.8, 0]]),
        queue = mareaRamp(t, [[21.6, 0], [22.4, 0.7], [23.5, 1], [26, 1], [27, 0.4], [27.6, 0]]),
        staffDay = t >= 9.3 && t < 21.8 ? 1 : 0,
        staffNight = t >= 21 && t < 29.1 ? 1 : 0,
        door = t >= 21.4 && t < 29.25 ? 1 : 0,
        setup = mareaRamp(t, [[19.4, 0], [19.8, 1], [21.2, 1], [21.6, 0]]),
        dj = (t >= 10 && t < 21.7) || (t >= 22 && t < 28.3) ? 1 : 0;
      return {
        day: day * (1 - rain * 0.75),
        pool: day * (1 - rain * 0.95),
        night: night * (1 - rain * 0.3),
        sunset: sunset * (1 - rain * 0.9),
        queue: queue * (1 - rain * 0.5),
        staffDay,
        staffNight,
        door,
        setup,
        dj,
        cleaners: t >= 29.4 && t < 32.5 ? 1 : 0,
      };
    }

    /**
     * THE CAST
     * `mode` names which level fills the slot; `t` is its threshold.
     */
    const mareaSlots = [];
    const marea = {
      built: false,
      people: [],
      queue: [],
      talk: null,
      phase: 'closed',
      levels: null,
      spookedUntil: -100,
      enforceUntil: -100,
      alarmSource: null,
      alarmInc: null,
      pass: false,
      vip: false,
      passNight: -1,
      hintAt: -100,
      queueClock: 4,
      admitClock: 6,
      tick: 0,
      taxis: [],
      taxiClock: 0,
      admitted: 0,
      rejected: 0,
      evacuated: 0,
      shoves: 0,
      groupId: 1,
      inView: false,
      near: false,
    };
    let mareaRandomSeed = 7171;
    function mareaRandom() {
      mareaRandomSeed = (mareaRandomSeed * 16807) % 2147483647;
      return (mareaRandomSeed - 1) / 2147483646;
    }
    function mareaSlot(kind, mode, u, v, a, extra = {}) {
      const s = { id: mareaSlots.length, kind, mode, u, v, a, t: mareaRandom(), person: null, next: 0, ...extra };
      const p = mareaPoint(u, v);
      s.x = p.x;
      s.y = p.y;
      mareaSlots.push(s);
      return s;
    }
    const faceTo = (u, v, tu, tv) => Math.atan2(tv - v, tu - u);
    function buildMareaCast() {
      if (marea.built) return;
      marea.built = true;
      // Headings: +y is south (towards the sea), -y north (towards the street).
      const FACE_SOUTH = Math.PI / 2,
        FACE_NORTH = -Math.PI / 2;
      // Staff: bartenders behind the main bar, the pool bar, waiters, the DJ, the door.
      for (const [v, mode] of [[122, 'staffDay'], [150, 'staffDay'], [176, 'staffNight'], [134, 'staffNight'], [164, 'staffNight']])
        mareaSlot('bartender', mode, 30, v, 0, { dress: 'barStaff', pose: 'bartend', entry: 'bar', pace: 7 });
      mareaSlot('bartender', 'staffDay', 367, 198, FACE_SOUTH, { dress: 'barStaff', pose: 'bartend', node: 'e192', via: [[367, 196]], pace: 5 });
      mareaSlot('bartender', 'staffNight', 367, 198, FACE_SOUTH, { dress: 'barStaff', pose: 'bartend', node: 'e192', via: [[367, 196]], pace: 5 });
      for (let i = 0; i < 3; i++) mareaSlot('waiter', 'staffDay', 70, 120 + i * 20, 0, { dress: 'waiter', pose: 'tray', node: 'wn', entry: 'staff', t: i * 0.2 });
      for (let i = 0; i < 3; i++) mareaSlot('waiter', 'staffNight', 70, 128 + i * 20, 0, { dress: 'waiter', pose: 'tray', node: 'wn', entry: 'staff', t: i * 0.2 });
      mareaSlot('dj', 'dj', 200, 74, FACE_SOUTH, { dress: 'dj', pose: 'dj', z: 9, entry: 'booth', t: 0 });
      mareaSlot('mc', 'night', 224, 70, FACE_SOUTH, { dress: 'party', pose: 'dance', z: 9, entry: 'booth', t: 0.35, style: 2 });
      mareaSlot('dancerBooth', 'night', 176, 70, FACE_SOUTH, { dress: 'party', pose: 'dance', z: 9, entry: 'booth', t: 0.55, style: 5 });
      // The door: head bouncer, his partner, the host with the list; by day a greeter.
      mareaSlot('bouncer', 'door', 316, 38, 0, { dress: 'bouncer', pose: 'arms', node: 'out', via: [[316, 38]], t: 0, head: true, staff: true });
      mareaSlot('bouncer', 'door', 287, 38, FACE_NORTH, { dress: 'bouncer', pose: 'arms', node: 'out', via: [[287, 38]], t: 0, staff: true });
      mareaSlot('bouncer', 'door', 312, 150, Math.PI, { dress: 'bouncer', pose: 'arms', node: 'vipGate', via: [[312, 150]], t: 0.2, vipGuard: true, staff: true });
      mareaSlot('bouncer', 'staffNight', 290, 190, FACE_NORTH, { dress: 'bouncer', pose: 'arms', node: 'e192', t: 0.4, staff: true });
      mareaSlot('host', 'door', 314, 25, 0, { dress: 'host', pose: 'wait', node: 'out', via: [[314, 25]], t: 0, staff: true, clipboard: true });
      mareaSlot('host', 'staffDay', 316, 36, FACE_NORTH, { dress: 'host', pose: 'wait', node: 'out', via: [[316, 36]], t: 0, staff: true, greeter: true });
      mareaSlot('bouncer', 'staffDay', 290, 64, FACE_NORTH, { dress: 'bouncer', pose: 'arms', node: 'in', via: [[290, 64]], t: 0.3, staff: true });
      // Smokers outside the door at night.
      for (const [u, a] of [[262, 0], [270, Math.PI], [276, 2.2]]) mareaSlot('smoker', 'night', u, 30, a, { dress: 'party', pose: 'smoke', node: 'out', via: [[u, 30]], t: 0.3 + mareaRandom() * 0.5 });
      // The dance floor: denser near the booth, facing the DJ.
      const floor = MAREA.floor;
      for (let v = floor[1] + 8; v < floor[3] - 4; v += 9.5)
        for (let u = floor[0] + 8; u < floor[2] - 4; u += 10) {
          const ju = u + (mareaRandom() - 0.5) * 5,
            jv = v + (mareaRandom() - 0.5) * 4,
            near = Math.hypot(ju - 200, (jv - 92) * 1.3) / 150;
          mareaSlot('dancer', 'night', ju, jv, faceTo(ju, jv, 200, 70) + (mareaRandom() - 0.5) * 0.9, {
            dress: 'party',
            pose: 'dance',
            node: 'floor',
            t: clamp(near * 0.75 + mareaRandom() * 0.35, 0.02, 0.99),
            style: Math.floor(mareaRandom() * 7),
            fromQueue: true,
          });
        }
      // Sunset: a few dancing in front of the booth, and watchers along the deck rail.
      for (let i = 0; i < 10; i++) {
        const u = 170 + (mareaRandom() - 0.5) * 70,
          v = 108 + mareaRandom() * 40;
        mareaSlot('dancer', 'sunset', u, v, faceTo(u, v, 200, 70), { dress: 'resort', pose: 'dance', node: 'floor', t: mareaRandom(), style: [3, 5, 0][i % 3] });
      }
      for (let u = 64; u < 330; u += 17) {
        if (u > 192 && u < 248) continue;
        mareaSlot('watcher', 'sunset', u, 292, 2.35 + (mareaRandom() - 0.5) * 0.5, {
          dress: 'resort',
          pose: mareaRandom() < 0.5 ? 'drink' : 'watch',
          node: u < 220 ? 'w272' : 'e272',
          via: [[u, 292]],
          t: mareaRandom(),
          carry: 'cocktail',
        });
      }
      // The main bar: standing at the counter (both), high tables.
      for (let v = 110; v < 188; v += 11)
        mareaSlot('barGuest', v % 2 ? 'day' : 'both', 60, v, Math.PI, { dress: 'mixed', pose: 'drink', node: v < 150 ? 'wn' : 'w192', t: mareaRandom() * 0.9, carry: 'cocktail' });
      for (const [tu, tv] of MAREA.highTables)
        for (const [du, dv] of [[-8, 0], [8, 0], [0, -8]]) {
          const u = tu + du,
            v = tv + dv;
          mareaSlot('tableGuest', 'both', u, v, faceTo(u, v, tu, tv), { dress: 'mixed', pose: mareaRandom() < 0.5 ? 'chat' : 'drink', node: 'wn', via: [[70, v]], t: mareaRandom(), carry: 'cocktail' });
        }
      // Daybeds by the pool and on the south deck: two loungers each by day.
      const bedRow = (beds, laneV, node) =>
        beds.forEach((r, i) => {
          for (const k of [0, 1]) {
            const v = r[1] + 3 + k * 6;
            mareaSlot('lounger', 'day', r[2] - 10, v, 0, {
              dress: 'swim',
              pose: 'lounge',
              z: 4.2,
              node,
              via: [[(r[0] + r[2]) / 2, laneV], [r[2] + 5, v]],
              t: mareaRandom(),
              bed: i,
            });
          }
        });
      bedRow(MAREA.daybeds, 216, 'w216');
      bedRow(MAREA.southDaybeds, 271, 'm272');
      // Cabanas: a lounger and a friend sitting up.
      for (const r of MAREA.cabanas) {
        mareaSlot('lounger', 'day', r[2] - 14, r[1] + 8, 0, { dress: 'swim', pose: 'lounge', z: 4.2, node: 'w216', via: [[51, r[1] + 13]], t: mareaRandom() * 0.7 });
        mareaSlot('lounger', 'day', r[2] - 4, r[1] + 18, Math.PI, { dress: 'resort', pose: 'sit', z: 1.2, node: 'w216', via: [[51, r[1] + 13]], t: mareaRandom() });
      }
      // Swimmers in the pool (day), and one or two at night.
      const w = MAREA.poolWater;
      for (let i = 0; i < 14; i++) {
        const u = w[0] + 12 + mareaRandom() * (w[2] - w[0] - 24),
          v = w[1] + 7 + mareaRandom() * (w[3] - w[1] - 14);
        mareaSlot('swimmer', i < 12 ? 'pool' : 'night', u, v, mareaRandom() * TAU, {
          dress: 'swim',
          pose: 'swim',
          z: -12,
          node: v < 244 ? 'w216' : 'm272',
          via: [[u, v < 244 ? 216 : 271]],
          swim: true,
          t: i < 12 ? mareaRandom() : 0.6 + mareaRandom() * 0.4,
        });
      }
      // The pool bar: stools on the south side (sitting), both day and night.
      for (let u = 350; u <= 386; u += 9)
        mareaSlot('stool', 'both', u, 226, FACE_NORTH, { dress: 'mixed', pose: 'sit', z: 3.6, node: 'e216', via: [[u, 229]], t: mareaRandom(), carry: 'cocktail' });
      // The sunken fire lounge.
      const l = MAREA.lounge;
      for (let i = 0; i < 7; i++) {
        const ang = -2.6 + i * 0.75,
          u = l.u + Math.cos(ang) * (l.r - 6),
          v = l.v + Math.sin(ang) * (l.r - 6);
        mareaSlot('loungeGuest', 'both', u, v, ang + Math.PI, { dress: 'mixed', pose: 'sit', z: -1.4, node: 'e272', via: [[329, v]], t: mareaRandom(), carry: mareaRandom() < 0.6 ? 'cocktail' : null });
      }
      // VIP terrace: sofas along the wall, standing by the rail at night.
      for (let v = 112; v < 178; v += 11) mareaSlot('vip', 'both', 382, v, Math.PI, { dress: 'vip', pose: 'sit', z: 1.4, node: 'vipIn', t: mareaRandom(), carry: 'cocktail' });
      for (let u = 336; u < 368; u += 10) mareaSlot('vip', 'both', u, 108, FACE_SOUTH, { dress: 'vip', pose: 'sit', z: 1.4, node: 'vipIn', t: mareaRandom() });
      for (let i = 0; i < 8; i++) {
        const u = 332 + mareaRandom() * 30,
          v = 124 + mareaRandom() * 56;
        mareaSlot('vip', 'night', u, v, faceTo(u, v, 200, 90) + (mareaRandom() - 0.5), { dress: 'vip', pose: mareaRandom() < 0.6 ? 'dance' : 'drink', node: 'vipIn', t: mareaRandom(), style: Math.floor(mareaRandom() * 7), carry: 'cocktail' });
      }
      mareaSlot('bottleGirl', 'night', 352, 146, FACE_NORTH, { dress: 'host', pose: 'sparkler', node: 'vipIn', t: 0.5, carry: 'sparkler' });
      // Pool edge at night: standing and chatting along the walkways.
      for (let i = 0; i < 16; i++) {
        const top = i % 2 === 0,
          u = 70 + mareaRandom() * 240,
          v = top ? 216 : 271;
        mareaSlot('poolside', i < 5 ? 'both' : 'night', u, v + (mareaRandom() - 0.5) * 4, top ? FACE_SOUTH : FACE_NORTH, {
          dress: 'mixed',
          pose: ['chat', 'drink', 'dance', 'drink'][i % 4],
          node: top ? (u < 190 ? 'w216' : 'e216') : 'm272',
          via: [[u, v]],
          t: mareaRandom(),
          style: Math.floor(mareaRandom() * 7),
          carry: 'cocktail',
        });
      }
      // The club's own sunbeds out on the sand (day).
      for (const b of MAREA.sunbeds)
        mareaSlot('lounger', 'day', b.u + 11, b.v, 0, { dress: 'swim', pose: 'lounge', z: 2.6, node: 'beach', via: [[b.u + 16, b.v]], t: mareaRandom() });
      // Sunset setup crew carrying crates from the staff door to the booth and bars.
      for (let i = 0; i < 3; i++) mareaSlot('crew', 'setup', 150 + i * 30, 104, FACE_SOUTH, { dress: 'crew', pose: 'carry', node: 'floor', entry: 'staff', t: i * 0.25, carry: 'box', crew: true });
      // Morning cleaners.
      for (let i = 0; i < 2; i++) mareaSlot('cleaner', 'cleaners', 150 + i * 90, 150, 0, { dress: 'crew', pose: 'sweep', node: 'floor', entry: 'staff', t: 0, wanderFloor: true });
    }

    /**
     * DRESSING
     * dressPerson (crowd.js) gives everyone a look; the club adjusts it for swimwear,
     * resort linen, party outfits and staff uniforms.
     */
    const MAREA_SWIM = ['#d8413a', '#2a67b5', '#f2c230', '#1f9a8a', '#e46fa8', '#f08a2c', '#15253f', '#7a4fb5', '#ffffff', '#3cb56b'];
    const MAREA_PARTY = ['#f4f1ea', '#f4f1ea', '#111215', '#c23b6b', '#d4b24a', '#1f5f7a', '#e5e1d6', '#6d3f76', '#e8c9a0', '#ff5a7a', '#38c6d9', '#b8b8c0'];
    function mareaDress(p, style) {
      if (style === 'mixed') style = marea.phase === 'night' || marea.phase === 'closing' ? 'party' : mareaRandom() < 0.35 ? 'swim' : 'resort';
      const role = { bouncer: 'bouncer', crew: 'worker', party: 'reveller', vip: 'reveller' }[style] || 'casual';
      dressPerson(p, role);
      const look = p.look,
        female = mareaRandom() < 0.5;
      look.umbrella = null;
      look.backpack = false;
      p.carry = null;
      p.dog = null;
      p.texting = false;
      if (style === 'swim') {
        look.sleeves = false;
        look.shoes = look.skin;
        look.hat = mareaRandom() < 0.2 ? 1 : 0;
        look.hatColor = '#e9dcc0';
        if (female) {
          look.top = randomChoice(MAREA_SWIM);
          look.skirt = mareaRandom() < 0.55;
          look.pants = look.skirt ? randomChoice(MAREA_SWIM) : look.top;
          look.shorts = true;
          look.hairStyle = randomChoice([2, 2, 3, 4]);
        } else {
          look.top = look.skin;
          look.pants = randomChoice(MAREA_SWIM);
          look.skirt = false;
          look.shorts = true;
          look.hairStyle = randomChoice([0, 1, 1, 4]);
        }
      } else if (style === 'resort') {
        look.top = randomChoice(['#f4f1ea', '#e9dcc0', '#bcd6e0', '#f2c9b8', '#ffffff', '#9fc5b0', '#e8e05c']);
        look.pants = randomChoice(['#e9dcc0', '#f4f1ea', '#c8b48a', '#2f4d6e', '#d8d2c4']);
        look.shorts = mareaRandom() < 0.6;
        look.sleeves = mareaRandom() < 0.4;
        look.shoes = randomChoice(['#e9dcc0', '#8a6d4a', '#f0eee8']);
        look.hat = mareaRandom() < 0.3 ? 1 : 0;
        look.hatColor = randomChoice(['#e9dcc0', '#f4f1ea', '#2f4d6e']);
        look.skirt = female && mareaRandom() < 0.45;
      } else if (style === 'party' || style === 'vip') {
        look.top = randomChoice(MAREA_PARTY);
        look.pants = mareaRandom() < 0.4 ? look.top : randomChoice(['#111215', '#f4f1ea', '#1d2126', '#2a3444', '#e8c9a0']);
        look.skirt = female && mareaRandom() < 0.55;
        look.shorts = look.skirt;
        look.sleeves = mareaRandom() < 0.35;
        look.shoes = randomChoice(['#111215', '#f0eee8', '#d4b24a', '#8e1f2a']);
        look.hat = 0;
        if (style === 'vip') {
          look.top = randomChoice(['#111215', '#d4b24a', '#f4f1ea', '#8e1f2a', '#b8b8c0']);
          look.pants = randomChoice(['#111215', '#1d2126', '#f4f1ea']);
        }
      } else if (style === 'barStaff') {
        look.top = '#15161a';
        look.pants = '#15161a';
        look.sleeves = false;
        look.skirt = false;
        look.hat = 0;
      } else if (style === 'waiter') {
        look.top = '#f4f1ea';
        look.pants = '#15161a';
        look.sleeves = true;
        look.skirt = false;
        look.hat = 0;
        look.shoes = '#111111';
      } else if (style === 'dj') {
        look.top = '#15161a';
        look.pants = '#23272e';
        look.hat = 1;
        look.hatColor = '#111215';
        look.sleeves = false;
      } else if (style === 'host') {
        look.top = '#15161a';
        look.pants = '#15161a';
        look.skirt = true;
        look.shorts = true;
        look.sleeves = false;
        look.hairStyle = randomChoice([2, 3]);
        look.hat = 0;
      } else if (style === 'crew') {
        look.top = '#2b2f3a';
        look.pants = '#2b2f3a';
        look.hat = 1;
        look.hatColor = '#2b2f3a';
      }
      p.mareaStyle = style;
      return p;
    }
