    // BEGIN SUBSYSTEM: src/beachclub.js — Marea Beach Club (plan, people, door, schedule)
    /**
     * Marea Beach Club
     * Source: src/beachclub.js
     * Scope: shared game closure.
     *
     * The club on the reserved plot at the west end of Palm Keys Beach
     * (BEACH_CLUB_PLOT, geography.js): a social beach club by day and a
     * nightclub by night.
     *
     * THE PLAN
     * Everything is laid out in plot-local units: `u` east from the plot's west
     * edge (0..400), `v` south from the Marina Rd kerb (0..300); `mareaPoint(u, v)`
     * turns that into a map point. The street side (v < 44) is a public forecourt
     * with the queue lane, the velvet ropes and the door; a white wall with one
     * door in it closes the club off. Inside: the staff block and the lobby at the
     * back, a raised DJ booth against an LED wall facing an open-air dance floor
     * under a lighting truss, the main bar along the west side under a sail roof,
     * the VIP terrace behind ropes on the east side, a row of daybeds, the long
     * infinity pool with cabanas to the west, the swim-up pool bar and the sunken
     * fire lounge to the east, and a deck with a gate down to the sand. beachclub3d.js
     * draws exactly this plan; `beachClubBlocked` (called from solid()) makes
     * the same rectangles solid on foot and `addBeachClubColliders` for vehicles.
     *
     * THE DAY
     *   closed   05:15-09:30  cleaners, nobody else
     *   day      09:30-18:30  social club: daybeds, pool, bars, waiters, a chill set
     *   sunset   18:30-21:45  the day crowd thins, staff set up, people watch the sun go
     *   night    21:45-04:15  the nightclub: queue and bouncers outside, a packed floor
     *   closing  04:15-05:15  lights up, people spill out, taxis at the kerb
     *
     * THE PEOPLE
     * Everyone here is an ordinary pedestrian (so they can be shot, run over,
     * frightened and seen by the crowd's perception) with a `club` record. The
     * cast is a fixed list of slots (a daybed, a place on the dance floor, a stool,
     * a post by the door), each with a threshold: when the club's level for that
     * kind of slot rises above it the slot is filled, and when it falls the person
     * gets up and leaves. Out of sight people simply appear in place; in sight they
     * walk in from the door (or up from the beach, or out of the staff door) along
     * a small graph of walkways, and walk out the same way. At night the dance
     * floor fills from the queue: the head bouncer talks to whoever is at the front
     * (routed through `crowdSay`, so it follows the crowd's speech rules), lets
     * them in or turns them away, and the line shuffles up.
     *
     * TROUBLE
     * Gunfire or an explosion near the club (`beachClubHearsViolence`, called
     * from notifyViolence) empties it: the music cuts, the house lights come up,
     * guests run for the door or the beach gate and are handed to the crowd as
     * ordinary fleeing pedestrians once out; people right next to it react as the
     * crowd decides. The bouncers hold the door, one calls it in, and for a while
     * they go for the player on foot and shove them away.
     *
     * THE PLAYER AT THE DOOR
     * By day the door is open. At night it is closed to anyone without a band:
     * E by the door pays the $40 cover (refused while wanted); E at the VIP rope
     * buys the $250 VIP band. Bands last until the club closes.
     */
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

    /**
     * WHAT PEOPLE SAY
     * Every line goes through crowdSay (crowd.js), registered as its own
     * one-line kind, so the club's chatter follows the crowd's speech rules.
     */
    const MAREA_DOOR_TALK = {
      reject: [
        [['b', 'Name?'], ['p', 'Uh… Dave. Plus four.'], ['b', 'Not on the list.'], ['p', 'Check again, man!'], ['b', 'Not tonight.']],
        [['b', 'How many?'], ['p', 'Just us guys.'], ['b', 'Not tonight, fellas.'], ['p', 'Seriously?!']],
        [['b', 'Those shoes?'], ['p', 'They’re vintage!'], ['b', 'They’re flip-flops. Walk.']],
        [['b', 'You been drinking?'], ['p', 'Me? Nooo… hic.'], ['b', 'Go home, champ.']],
        [['b', 'ID.'], ['p', 'Left it in the car.'], ['b', 'Then go get it.']],
        [['p', 'I know the DJ!'], ['b', 'Everybody knows the DJ.'], ['p', 'Unbelievable.']],
        [['p', 'Do you know who I am?'], ['b', 'Nope. Step aside.']],
        [['b', 'Private event tonight.'], ['p', 'Since when?!'], ['b', 'Since you showed up.']],
        [['h', 'Name?'], ['p', 'Try under “Rick”.'], ['h', 'No Rick.'], ['b', 'Next!']],
        [['p', 'Five minutes, you said!'], ['b', 'And now I’m saying no.']],
      ],
      admit: [
        [['b', 'Nice shoes. You’re in.'], ['p', 'Thank you!']],
        [['h', 'Name?'], ['p', 'Marisol. Plus one.'], ['h', 'Enjoy your night.']],
        [['b', 'ID.'], ['p', 'Here.'], ['b', 'Go ahead.']],
        [['h', 'VIP? Right this way.']],
        [['b', 'Forty cover.'], ['p', 'Keep the change.'], ['b', 'Have a good one.']],
        [['b', 'Just the two of you?'], ['p', 'Just us.'], ['b', 'In you go.']],
        [['h', 'You’re on the list.'], ['p', 'Told you!']],
        [['b', 'Behave in there.'], ['p', 'Always.']],
      ],
      queue: [
        'Is the line always this long?', 'I heard Kaito’s spinning tonight.', 'My feet are killing me.', 'Act sober. ACT SOBER.',
        'Did you put us on the list?', 'Two hours for this?', 'They let HIM in?', 'Is that a celebrity?', 'If we don’t get in, Neon Palace.',
        'I love this song!', 'Can you hear that bass?', 'Text Marco, he’s inside.',
      ],
      bouncerToLine: ['Five-minute wait, step back.', 'Single file, people.', 'Behind the rope.', 'Keep it moving.', 'Nobody gets in if you push.', 'Have your IDs ready.'],
      walkOff: ['This place sucks anyway.', 'Whatever. Neon Palace it is.', 'I’m leaving a review!', 'Your loss, big guy!', 'Worst night ever.', 'We didn’t want in anyway.'],
      cutLine: ['Hey! He cut the line!', 'Are you kidding me?', 'Line’s back here, pal!', 'Must be nice…'],
      floor: ['Wooo!', 'This DJ!', 'I love this song!', 'One more!', 'Hands up!', 'Best night ever!', 'Here comes the drop!'],
      dj: ['Make some noise!', 'Marea, are you with me?!', 'Hands in the air!', 'One more time!'],
      day: ['Another spritz?', 'Pass the sunscreen?', 'This is the life.', 'Is the pool heated?', 'Two mojitos, please.', 'I’m never leaving.', 'Wake me at sunset.'],
      waiter: ['Your drinks.', 'Anything else?', 'Mind your step.', 'Two mojitos?'],
      sunset: ['Look at that sky.', 'Here it goes…', 'Best seat in town.', 'Cheers to that.'],
      evac: ['Everybody out!', 'Move! Move!', 'Out the back!', 'Get to the beach!'],
      bouncerAlarm: ['Everybody back!', 'Doors are shut!', 'Nobody in, nobody out!'],
      bouncerCall: ['Shots fired at Marea, send units!', 'Yeah, Marina Road. Hurry.'],
      shove: ['You’re done here!', 'Out! Now!', 'Walk away, pal.', 'Not in my club!'],
      player: {
        line: 'Back of the line, pal.',
        cover: 'Forty cover. Cash.',
        paid: 'Money talks. Go ahead.',
        broke: 'No cash, no entry.',
        wanted: 'Not with that heat on you.',
        banned: 'You? Not a chance.',
        vipAsk: 'VIP band’s two-fifty.',
        vipPaid: 'Enjoy the view.',
        welcome: 'Welcome to Marea!',
      },
    };
    (function registerMareaLines() {
      const add = (text) => (CROWD_LINES['marea ' + text] = [text]);
      for (const kind of ['reject', 'admit']) for (const script of MAREA_DOOR_TALK[kind]) for (const [, text] of script) add(text);
      for (const kind of Object.keys(MAREA_DOOR_TALK))
        if (Array.isArray(MAREA_DOOR_TALK[kind]) && typeof MAREA_DOOR_TALK[kind][0] === 'string') for (const text of MAREA_DOOR_TALK[kind]) add(text);
      for (const text of Object.values(MAREA_DOOR_TALK.player)) add(text);
    })();
    /* Say a line now (a scripted line interrupts idle chatter) through the crowd's speech. */
    // Settings · Gameplay · NPC chatter off (settings.js) silences the door too;
    // the conversations still run, so people are let in and turned away as before.
    function mareaSay(p, text) {
      if (!p || p.hp <= 0 || !text || !npcChatterOn()) return false;
      p.speechUntil = 0;
      return crowdSay(p, 'marea ' + text, 1);
    }
    function mareaSayOne(p, kind, chance = 1) {
      if (!p || !npcChatterOn() || (p.speechUntil || 0) > gameTime || mareaRandom() > chance) return false;
      return crowdSay(p, 'marea ' + randomChoice(MAREA_DOOR_TALK[kind]), 1);
    }

    /**
     * PEOPLE
     */
    function mareaSpawn(slot, x, y, style) {
      // The club brings its own crowd on top of the street crowd's cap (only people on
      // screen are drawn, and the club never holds more than its slots).
      if (pedestrians.length >= CROWD_HARD_CAP + 260 || marea.people.length >= 260) return null;
      const p = { x, y, a: slot?.a ?? 0, hp: 30, flee: 0, timer: 5, walk: 0, state: 'club' };
      mareaDress(p, style || slot?.dress || 'mixed');
      p.club = { slot: null, route: [], mode: 'walk', since: gameTime, speed: 24 + mareaRandom() * 6 };
      p.phase = mareaRandom() * 10;
      pedestrians.push(p);
      marea.people.push(p);
      return p;
    }
    /* Put someone in their slot: seat, pose, altitude, heading, carried things. */
    function mareaSettle(p, slot) {
      const c = p.club;
      c.slot = slot;
      c.mode = 'slot';
      c.route = [];
      p.x = slot.x;
      p.y = slot.y;
      p.a = slot.a;
      p.altitude = slot.z;
      p.danceStyle = slot.style ?? Math.floor(mareaRandom() * 7);
      p.carry = slot.carry ?? p.carry ?? null;
      p.sitting = slot.pose === 'sit';
      p.pose = slot.pose;
      c.swimTarget = null;
      c.wander = 0;
    }
    function mareaAssign(p, slot) {
      slot.person = p;
      p.club.slot = slot;
    }
    /* The walkway route from wherever someone is (a node) to a slot, or out. */
    function mareaRouteTo(p, fromNode, slot) {
      const pts = [];
      for (const id of mareaPath(fromNode, slot.node || 'floor')) pts.push(mareaNodePoint(id));
      for (const [u, v] of slot.via || []) pts.push(mareaPoint(u, v));
      pts.push({ x: slot.x, y: slot.y });
      p.club.route = pts;
      p.club.mode = 'arrive';
    }
    function mareaNearestNode(x, y) {
      let best = 'floor',
        bd = Infinity;
      for (const [id, [u, v]] of Object.entries(MAREA_NODES)) {
        const q = mareaPoint(u, v),
          d = Math.hypot(q.x - x, q.y - y);
        if (d < bd) {
          bd = d;
          best = id;
        }
      }
      return best;
    }
    /* Leave by the door (or the beach gate by day) and hand them to the street. */
    function mareaLeave(p, exit) {
      const c = p.club,
        slot = c.slot;
      if (slot && slot.person === p) slot.person = null;
      c.slot = null;
      p.pose = null;
      p.sitting = false;
      const from = slot ? slot.node || mareaNearestNode(p.x, p.y) : mareaNearestNode(p.x, p.y);
      const pts = [];
      if (slot) for (const [u, v] of [...(slot.via || [])].reverse()) pts.push(mareaPoint(u, v));
      if (slot?.swim) {
        const edge = pts[0] || mareaPoint(p.x - MAREA.plot.x, 216);
        p.x = edge.x;
        p.y = edge.y;
      }
      p.altitude = undefined;
      const target = exit || (marea.phase === 'day' && mareaRandom() < 0.3 ? 'beach' : 'street');
      for (const id of mareaPath(from, target)) pts.push(mareaNodePoint(id));
      if (target === 'street') {
        // Along the forecourt to its west or east end, then off down the pavement.
        const west = mareaRandom() < 0.5;
        pts.push(mareaPoint(west ? -30 : 430, 8));
      }
      c.route = pts;
      c.mode = 'leave';
    }
    /* Hand a person back to the ordinary crowd (walking on, or reacting). */
    function mareaRelease(p) {
      const c = p.club;
      if (c?.slot && c.slot.person === p) c.slot.person = null;
      if (c?.group) c.group.members = c.group.members.filter((q) => q !== p);
      p.club = null;
      p.altitude = undefined;
      p.sitting = false;
      p.pose = null;
      p.state = 'walk';
      p.dir = snapAxis(p.a);
      p.timer = randomBetween(3, 8);
      const i = marea.people.indexOf(p);
      if (i >= 0) marea.people.splice(i, 1);
      const q = marea.queue.findIndex((g) => g.members.includes(p));
      if (q >= 0) marea.queue[q].members = marea.queue[q].members.filter((m) => m !== p);
    }
    function mareaRemove(p) {
      mareaRelease(p);
      const k = pedestrians.indexOf(p);
      if (k >= 0) pedestrians.splice(k, 1);
    }
    function mareaDistance(x, y) {
      const dx = Math.max(MAREA.plot.x - x, 0, x - (MAREA.plot.x + MAREA.plot.w)),
        dy = Math.max(MAREA.plot.y - y, 0, y - (MAREA.plot.y + MAREA.plot.h));
      return Math.hypot(dx, dy);
    }
    function mareaInside(x, y) {
      const { u, v } = mareaLocal(x, y);
      return u > 0 && u < 400 && v > MAREA.wallV + MAREA.wallDepth && v < 300;
    }
    function mareaWalk(p, deltaSeconds, speed) {
      const c = p.club,
        target = c.route[0];
      if (!target) return true;
      const dx = target.x - p.x,
        dy = target.y - p.y,
        d = Math.hypot(dx, dy),
        step = speed * deltaSeconds;
      if (d <= Math.max(1.5, step)) {
        p.x = target.x;
        p.y = target.y;
        c.route.shift();
        return !c.route.length;
      }
      p.a = Math.atan2(dy, dx);
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      p.walk = (p.walk || 0) + deltaSeconds * 6;
      return false;
    }

    /* Per-person update from updatePeople (game.js); true when the club handled them. */
    function updateClubGoer(p, deltaSeconds) {
      const c = p.club;
      if (!c) return false;
      if (p.hp <= 0 || personIncapacitated(p)) {
        mareaRelease(p);
        return false;
      }
      // Danger: right next to it, the crowd decides; otherwise run for an exit.
      if (p.react || p.flee > 0) {
        mareaRelease(p);
        return false;
      }
      if (p.pending) {
        // Right next to it, the crowd decides; a shot the club heard empties it;
        // anything else is lost under the music.
        const inc = p.pending.inc;
        if (c.staff && c.slot?.kind === 'bouncer') p.pending = null;
        else if (!inc || Math.hypot(inc.x - p.x, inc.y - p.y) < 90) {
          mareaRelease(p);
          return false;
        } else {
          p.pending = null;
          if (inc.loud && gameTime < marea.spookedUntil && c.mode !== 'evac') mareaEvacuate(p);
          // People on the pavement are handed straight to the crowd to flee.
          if (!p.club) return false;
        }
      }
      p.walking = false;
      if (c.mode === 'evac') {
        if (mareaWalk(p, deltaSeconds, 72)) {
          marea.evacuated++;
          const from = marea.alarmSource;
          mareaRelease(p);
          startReaction(p, 'flee', randomBetween(5, 9), from, mareaAlarmIncident());
        }
        return true;
      }
      if (c.mode === 'arrive' || c.mode === 'leave' || c.mode === 'queueWalk') {
        const speed = c.mode === 'leave' && marea.phase === 'closing' ? c.speed * 0.8 : c.speed;
        p.pose = c.carryPose || null;
        p.sitting = false;
        p.walking = true;
        if (mareaWalk(p, deltaSeconds, speed)) {
          if (c.mode === 'arrive' && c.slot) mareaSettle(p, c.slot);
          else if (c.mode === 'queueWalk') {
            c.mode = 'queue';
            p.pose = 'sway';
          } else if (c.mode === 'leave') {
            if (c.taxi) mareaBoardTaxi(p, c.taxi);
            else if (!crowdInView(p.x, p.y, 40)) mareaRemove(p);
            else mareaRelease(p);
          }
        }
        return true;
      }
      if (c.mode === 'queue') {
        const spot = c.spot;
        if (spot && Math.hypot(spot.x - p.x, spot.y - p.y) > 1.5) {
          p.walking = true;
          p.pose = null;
          c.route = [spot];
          mareaWalk(p, deltaSeconds, 16);
        } else {
          if (spot) p.a += normalizeAngle(spot.a - p.a) * Math.min(1, deltaSeconds * 4);
          p.pose = c.talking ? 'chat' : 'sway';
          if (mareaRandom() < deltaSeconds * 0.02) mareaSayOne(p, 'queue');
        }
        return true;
      }
      if (c.mode === 'slot') updateMareaSlotPerson(p, c.slot, deltaSeconds);
      return true;
    }
    function updateMareaSlotPerson(p, slot, deltaSeconds) {
      const c = p.club;
      if (!slot) return;
      p.pose = slot.pose;
      // Bouncers in trouble mode hold the door or go for the player.
      if (slot.kind === 'bouncer' && updateMareaBouncer(p, slot, deltaSeconds)) return;
      if (slot.swim) {
        // Drift about the pool, turning now and then.
        const w = MAREA.poolWater;
        if (!c.swimTarget || Math.hypot(c.swimTarget.x - p.x, c.swimTarget.y - p.y) < 3 || mareaRandom() < deltaSeconds * 0.05)
          c.swimTarget = mareaPoint(w[0] + 8 + mareaRandom() * (w[2] - w[0] - 16), w[1] + 6 + mareaRandom() * (w[3] - w[1] - 12));
        const a = Math.atan2(c.swimTarget.y - p.y, c.swimTarget.x - p.x);
        p.a += normalizeAngle(a - p.a) * Math.min(1, deltaSeconds * 1.5);
        p.x += Math.cos(p.a) * 5 * deltaSeconds;
        p.y += Math.sin(p.a) * 5 * deltaSeconds;
        p.altitude = slot.z + Math.sin(gameTime * 1.7 + p.phase) * 0.35;
        return;
      }
      if (slot.kind === 'bartender') {
        // Working along the counter: a few steps, shake, serve.
        c.wander -= deltaSeconds;
        if (c.wander <= 0) {
          c.wander = randomBetween(3, 8);
          c.dv = slot.pace ? (mareaRandom() - 0.5) * slot.pace * 2 : 0;
        }
        const target = slot.y + (c.dv || 0);
        if (Math.abs(target - p.y) > 0.5) {
          p.y += Math.sign(target - p.y) * Math.min(Math.abs(target - p.y), 14 * deltaSeconds);
          p.pose = null;
          p.a = Math.sign(target - p.y) > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else p.a += normalizeAngle(slot.a - p.a) * Math.min(1, deltaSeconds * 5);
        return;
      }
      if (slot.kind === 'waiter') return updateMareaWaiter(p, slot, deltaSeconds);
      if (slot.crew) return updateMareaCrew(p, slot, deltaSeconds);
      if (slot.wanderFloor) {
        c.wander -= deltaSeconds;
        if (c.wander <= 0) {
          c.wander = randomBetween(4, 9);
          const f = MAREA.floor;
          c.goal = mareaPoint(f[0] + mareaRandom() * (f[2] - f[0]), f[1] + mareaRandom() * (f[3] - f[1]));
        }
        if (c.goal && Math.hypot(c.goal.x - p.x, c.goal.y - p.y) > 2) {
          c.route = [c.goal];
          mareaWalk(p, deltaSeconds, 9);
        }
        return;
      }
      // Idle chatter by kind and hour.
      const say = deltaSeconds * 0.012;
      if (slot.kind === 'dj' && marea.phase === 'night' && mareaRandom() < say * 2) mareaSayOne(p, 'dj');
      else if (slot.pose === 'dance' && marea.phase === 'night' && mareaRandom() < say) mareaSayOne(p, 'floor');
      else if (slot.kind === 'watcher' && mareaRandom() < say) mareaSayOne(p, 'sunset');
      else if (marea.phase === 'day' && ['lounger', 'barGuest', 'tableGuest', 'stool', 'loungeGuest'].includes(slot.kind) && mareaRandom() < say * 0.6)
        mareaSayOne(p, 'day');
      if (slot.greeter && mareaDistance(player.x, player.y) < 40 && distanceBetween(p, player) < 50 && (p.greetedAt || -100) < gameTime - 40) {
        p.greetedAt = gameTime;
        mareaSay(p, MAREA_DOOR_TALK.player.welcome);
      }
      // Dancers who lose their groove for a moment, and sippers.
      if (slot.pose === 'drink') p.sipping = (gameTime + p.phase) % 6 < 1.2;
    }
    /* Waiters: pick up at the bar, carry a tray to a daybed or table, come back. */
    function updateMareaWaiter(p, slot, deltaSeconds) {
      const c = p.club;
      if (c.route.length) {
        p.walking = true;
        p.pose = 'tray';
        p.carry = 'tray';
        mareaWalk(p, deltaSeconds, 26);
        if (!c.route.length && c.leg === 'out') {
          c.leg = 'serve';
          c.wander = randomBetween(2, 4);
          mareaSayOne(p, 'waiter', 0.7);
        }
        return;
      }
      c.wander -= deltaSeconds;
      p.pose = c.leg === 'serve' ? 'serve' : 'wait';
      if (c.wander > 0) return;
      if (c.leg === 'serve') {
        // Back to the bar by the same walkway.
        c.leg = 'back';
        c.route = [...(c.back || [])];
        c.route.push({ x: slot.x, y: slot.y });
        return;
      }
      // At the bar: choose someone to serve.
      const guests = marea.people.filter(
        (q) => q.club?.mode === 'slot' && q.club.slot && !q.club.slot.staff && ['lounger', 'vip', 'loungeGuest', 'poolside', 'tableGuest', 'watcher'].includes(q.club.slot.kind),
      );
      if (!guests.length) {
        c.wander = randomBetween(4, 8);
        return;
      }
      const guest = randomChoice(guests),
        gs = guest.club.slot,
        pts = mareaPath(slot.node, gs.node || 'floor').map(mareaNodePoint);
      // Along the walkways to the guest's last approach point, or beside them.
      for (const [u, v] of gs.via || []) pts.push(mareaPoint(u, v));
      if (!gs.via?.length) pts.push({ x: guest.x + 7, y: guest.y + 3 });
      c.back = [...pts].reverse();
      c.route = pts;
      c.leg = 'out';
    }
    /* Setup crew at sunset: crates from the staff door to the booth and the bars. */
    function updateMareaCrew(p, slot, deltaSeconds) {
      const c = p.club;
      if (c.route.length) {
        p.pose = c.loaded ? 'carry' : null;
        p.carry = c.loaded ? 'box' : null;
        mareaWalk(p, deltaSeconds, 22);
        return;
      }
      c.loaded = !c.loaded;
      const staff = mareaNodePoint('staffDoor');
      const drop = randomChoice([mareaPoint(200, 96), mareaPoint(66, 150), mareaPoint(300, 190), mareaPoint(250, 100)]);
      c.route = c.loaded ? [mareaNodePoint('wn'), drop] : [mareaNodePoint('wn'), staff];
    }

    /**
     * THE BOUNCERS
     */
    function updateMareaBouncer(p, slot, deltaSeconds) {
      const c = p.club,
        trouble = gameTime < marea.enforceUntil || gameTime < marea.spookedUntil - 90;
      if (!trouble) {
        if (Math.hypot(slot.x - p.x, slot.y - p.y) > 2) {
          c.route = [{ x: slot.x, y: slot.y }];
          p.pose = null;
          mareaWalk(p, deltaSeconds, 40);
          return true;
        }
        p.a += normalizeAngle(slot.a - p.a) * Math.min(1, deltaSeconds * 5);
        if (slot.head && !marea.talk && marea.queue.length && mareaRandom() < deltaSeconds * 0.02) mareaSayOne(p, 'bouncerToLine');
        return false;
      }
      // Trouble: go for the player if they are on foot and close, else hold the door.
      const d = distanceBetween(p, player),
        chase = gameTime < marea.enforceUntil && !player.car && d < 170 && !slot.vipGuard && mareaDistance(player.x, player.y) < 140 && player.hp > 0;
      if (chase) {
        p.a = headingBetween(p, player);
        p.pose = null;
        if (d > 10) {
          const step = Math.min(d - 9, 104 * deltaSeconds);
          moveBody(p, Math.cos(p.a) * step, Math.sin(p.a) * step, 5);
        } else if ((c.shoveAt || -10) < gameTime - 1.6) {
          c.shoveAt = gameTime;
          marea.shoves++;
          const a = headingBetween(p, player);
          moveBody(player, Math.cos(a) * 26, Math.sin(a) * 26, 8);
          hurt(6, 'melee');
          mareaSay(p, randomChoice(MAREA_DOOR_TALK.shove));
          p.pose = 'shove';
          tone(90, 0.08, 0.2, 'square');
        }
        return true;
      }
      const door = slot.head ? mareaPoint(298, 40) : slot.vipGuard ? { x: slot.x, y: slot.y } : mareaPoint(306, 40);
      if (Math.hypot(door.x - p.x, door.y - p.y) > 2) {
        c.route = [door];
        p.pose = null;
        mareaWalk(p, deltaSeconds, 60);
      } else {
        p.a = -Math.PI / 2;
        p.pose = slot.head && gameTime - (c.calledAt ?? -100) < 8 ? 'phone' : 'stop';
        if (mareaRandom() < deltaSeconds * 0.15) mareaSayOne(p, 'bouncerAlarm');
      }
      if (slot.head && (c.calledAt ?? -100) < marea.spookStart && mareaAlarmIncident()) {
        c.calledAt = gameTime;
        mareaSay(p, randomChoice(MAREA_DOOR_TALK.bouncerCall));
        crowdReport(p, marea.alarmInc);
      }
      return true;
    }

    /**
     * THE QUEUE
     * Groups of one to three stand along the rope, the head of the line at the
     * door end. The head bouncer (with the host) talks to the front group, then
     * lets them in or sends them off.
     */
    /* The line snakes along the ropes east of the door: row A (v 33) runs from
       the door east, row B (v 22) comes back west; people face the way it moves. */
    function mareaQueueSpot(i) {
      const rowA = i < 8,
        u = rowA ? 324 + i * 9.4 : 390 - (i - 8) * 9.4,
        p = mareaPoint(u, rowA ? 33 : 22.5);
      p.a = rowA ? Math.PI : 0;
      p.row = rowA ? 'A' : 'B';
      return p;
    }
    function mareaQueueCount() {
      return marea.queue.reduce((n, g) => n + g.members.length, 0);
    }
    function mareaLayoutQueue() {
      let i = 0;
      for (const g of marea.queue)
        for (const m of g.members) {
          if (m.club) m.club.spot = mareaQueueSpot(i);
          i++;
        }
    }
    function mareaQueueArrival(instant) {
      const size = mareaRandom() < 0.45 ? 1 : mareaRandom() < 0.7 ? 2 : 3,
        group = { id: marea.groupId++, members: [], lads: false };
      const index = mareaQueueCount();
      if (index + size > 16) return;
      const west = mareaRandom() < 0.6;
      for (let k = 0; k < size; k++) {
        const spot = mareaQueueSpot(index + k),
          start = instant ? spot : mareaPoint(west ? -220 - k * 10 : 620 + k * 10, 8 + k * 3),
          p = mareaSpawn(null, start.x, start.y, 'party');
        if (!p) break;
        p.club.group = group;
        p.club.spot = spot;
        p.club.mode = instant ? 'queue' : 'queueWalk';
        // Along the kerb to the rope, round its east end for row A.
        const along = spot.row === 'A' ? [mareaPoint(398, 10), mareaPoint(398, 28)] : [mareaPoint(spot.x - MAREA.plot.x, 10)];
        p.club.route = instant ? [] : [mareaPoint(west ? 20 : 400, 10), ...along, spot];
        group.members.push(p);
      }
      group.lads = group.members.length >= 2 && group.members.every((m) => !m.look.skirt && m.look.hairStyle !== 2);
      if (group.members.length) marea.queue.push(group);
    }
    function mareaHeadBouncer() {
      return mareaSlots.find((s) => s.head)?.person || null;
    }
    function mareaHost() {
      return mareaSlots.find((s) => s.clipboard)?.person || null;
    }
    /* A free place for someone just let in: an empty night slot, the emptiest first. */
    function mareaFreeNightSlot() {
      let best = null;
      for (const s of mareaSlots)
        if (s.mode === 'night' && s.fromQueue && !s.person && (!best || s.t < best.t)) best = s;
      return best;
    }
    function updateMareaQueue(step) {
      const L = marea.levels,
        head = mareaHeadBouncer(),
        count = mareaQueueCount();
      // Arrivals.
      marea.queueClock -= step;
      const target = Math.round(3 + 13 * L.queue);
      if (L.queue > 0.02 && marea.queueClock <= 0 && gameTime > marea.spookedUntil) {
        marea.queueClock = randomBetween(4, 10) / Math.max(0.35, L.queue);
        if (count < target) mareaQueueArrival(!marea.inView || marea.instant);
      }
      // Top up the line at once when nobody is looking (a teleport, a long drive).
      if ((!marea.inView || marea.instant) && L.queue > 0.05 && count < target * 0.6 && gameTime > marea.spookedUntil) mareaQueueArrival(true);
      // The conversation at the front.
      const talk = marea.talk;
      if (talk) {
        talk.clock -= step;
        if (talk.clock > 0) return;
        const group = talk.group;
        if (!group.members.length || !head || head.hp <= 0) {
          marea.talk = null;
          return;
        }
        const line = talk.script[talk.i++];
        if (line) {
          const who = line[0] === 'b' ? head : line[0] === 'h' ? mareaHost() || head : group.members[talk.i > 2 && group.members[1] ? 1 : 0];
          mareaSay(who, line[1]);
          talk.clock = 2.7;
          for (const m of group.members) m.club.talking = true;
          return;
        }
        // Verdict.
        marea.talk = null;
        const k = marea.queue.indexOf(group);
        if (k >= 0) marea.queue.splice(k, 1);
        for (const m of group.members) m.club.talking = false;
        if (talk.admit) {
          marea.admitted += group.members.length;
          for (const m of group.members) {
            const slot = mareaFreeNightSlot();
            m.club.group = null;
            if (!slot) {
              mareaLeave(m, 'street');
              continue;
            }
            mareaAssign(m, slot);
            mareaRouteTo(m, 'out', slot);
            m.club.route.unshift(mareaPoint(310, 35));
          }
        } else {
          marea.rejected += group.members.length;
          const speaker = group.members[0];
          for (const m of group.members) {
            m.club.group = null;
            m.club.mode = 'leave';
            const west = mareaRandom() < 0.5;
            m.club.route = [mareaPoint(318, 30), mareaPoint(314, 12), mareaPoint(west ? -40 : 440, 6 + mareaRandom() * 6)];
          }
          // Their parting shot comes once the bouncer's last word has faded.
          speaker.club.pendingLine = 'walkOff';
        }
        mareaLayoutQueue();
        return;
      }
      // Start the next conversation when the front group is in place.
      marea.admitClock -= step;
      const front = marea.queue[0];
      if (!front || !head || marea.admitClock > 0 || gameTime < marea.spookedUntil) return;
      const lead = front.members[0];
      if (!lead || lead.club?.mode !== 'queue' || distanceBetween(lead, mareaQueueSpot(0)) > 6) return;
      const full = !mareaFreeNightSlot();
      const rejectChance = full ? 0.8 : front.lads ? 0.55 : 0.18;
      const admit = mareaRandom() > rejectChance;
      marea.talk = { group: front, admit, script: randomChoice(MAREA_DOOR_TALK[admit ? 'admit' : 'reject']), i: 0, clock: 0.5 };
      marea.admitClock = randomBetween(2, 6) / Math.max(0.4, L.night);
    }

    /**
     * TAXIS AT CLOSING
     */
    function mareaTaxiSpot(i) {
      return { x: MAREA.plot.x + 140 + i * 58, y: MAREA.plot.y - 34 };
    }
    function updateMareaTaxis(step) {
      const want = marea.phase === 'closing' || (marea.phase === 'night' && mareaHour() > 27.6);
      marea.taxis = marea.taxis.filter((c) => vehicles.includes(c) && c.hp > 0 && c.mareaTaxi);
      if (!want) return;
      marea.taxiClock -= step;
      if (marea.taxiClock > 0) return;
      marea.taxiClock = 3;
      for (let i = 0; i < 3; i++) {
        if (marea.taxis.some((c) => c.mareaSpot === i)) continue;
        const spot = mareaTaxiSpot(i);
        if (crowdInView(spot.x, spot.y, 80) || !cityStreetAt(spot.x, spot.y) || !canSpawnCar('taxi', spot.x, spot.y, 0, 6)) continue;
        const c = makeCar('taxi', spot.x, spot.y, 0, false);
        c.mareaTaxi = true;
        c.mareaSpot = i;
        c.riders = 0;
        c.occupied = true;
        c.locked = false;
        marea.taxis.push(c);
      }
    }
    function mareaBoardTaxi(p, c) {
      mareaRemove(p);
      if (!vehicles.includes(c) || c.hp <= 0 || c === player.car) return;
      c.riders = (c.riders || 0) + 1;
      if (c.riders >= 1 + Math.floor(mareaRandom() * 2)) {
        // Away it goes into the traffic.
        assignDriver(c);
        c.locked = false;
        c.ai = true;
        c.mareaTaxi = false;
      }
    }

    /**
     * TROUBLE
     */
    function beachClubHearsViolence(source, kind = 'gunfire', attacker = null) {
      if (!source || !marea.built) return;
      const d = mareaDistance(source.x, source.y);
      if (d > (kind === 'explosion' ? 700 : 480)) return;
      const first = gameTime > marea.spookedUntil;
      if (first) marea.spookStart = gameTime;
      marea.spookedUntil = gameTime + 150;
      marea.alarmSource = { x: source.x, y: source.y };
      // The crowd records the incident just after this call (notifyViolence);
      // mareaAlarmIncident() picks it up.
      marea.alarmInc = null;
      if (attacker === player) {
        marea.enforceUntil = gameTime + 45;
        marea.pass = false;
        marea.vip = false;
        marea.banned = gameTime + 600;
      }
      marea.talk = null;
      if (first) for (const p of marea.people) if (p.club && !p.club.staff && p.club.slot?.kind !== 'bouncer') p.club.alarmed = true;
    }
    /* The crowd incident behind the current alarm (for witness calls and flight). */
    function mareaAlarmIncident() {
      const src = marea.alarmSource;
      if (!marea.alarmInc && src)
        for (let i = crowd.incidents.length - 1; i >= 0; i--)
          if (Math.hypot(crowd.incidents[i].x - src.x, crowd.incidents[i].y - src.y) < 120) {
            marea.alarmInc = crowd.incidents[i];
            break;
          }
      return marea.alarmInc;
    }
    /* Run for the nearest way out: the door, or the beach gate (thrown open). */
    function mareaEvacuate(p) {
      const c = p.club;
      if (!c) return;
      const slot = c.slot;
      if (slot && slot.person === p) slot.person = null;
      c.slot = null;
      const pts = [];
      if (slot) for (const [u, v] of [...(slot.via || [])].reverse()) pts.push(mareaPoint(u, v));
      if (slot?.swim && pts[0]) {
        p.x = pts[0].x;
        p.y = pts[0].y;
      }
      p.altitude = undefined;
      p.sitting = false;
      p.pose = null;
      const here = slot?.node || mareaNearestNode(p.x, p.y);
      if (c.mode === 'queue' || c.mode === 'queueWalk' || !mareaInside(p.x, p.y)) {
        mareaRelease(p);
        startReaction(p, 'flee', randomBetween(5, 9), marea.alarmSource, mareaAlarmIncident());
        return;
      }
      const toDoor = mareaPath(here, 'street'),
        toBeach = mareaPath(here, 'beach'),
        len = (path) => path.reduce((s, id, i) => (i ? s + Math.hypot(MAREA_NODES[id][0] - MAREA_NODES[path[i - 1]][0], MAREA_NODES[id][1] - MAREA_NODES[path[i - 1]][1]) : 0), 0),
        src = marea.alarmSource ? mareaLocal(marea.alarmSource.x, marea.alarmSource.y) : { u: 200, v: -100 },
        // Away from the danger: a shot on the street side sends everyone to the beach.
        doorBias = src.v < 60 ? 400 : src.v > 250 ? -300 : 0;
      const path = len(toDoor) + doorBias < len(toBeach) ? toDoor : toBeach;
      for (const id of path) pts.push(mareaNodePoint(id));
      c.route = pts;
      c.mode = 'evac';
      if (mareaRandom() < 0.3) mareaSayOne(p, 'evac');
      else crowdSay(p, 'flee', 0.25);
    }

    /**
     * THE PLAYER
     */
    function mareaDoorClosed() {
      if (gameTime < marea.spookedUntil) return false;
      return marea.phase === 'night' && !marea.pass && marea.levels?.door > 0;
    }
    function beachClubBlocked(x, y, r = 0) {
      if (x < MAREA_BOX.x0 || x > MAREA_BOX.x1 || y < MAREA_BOX.y0 || y > MAREA_BOX.y1) return false;
      for (const b of MAREA_SOLIDS) if (x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1) return true;
      const hit = (g) => x + r > g.x0 && x - r < g.x1 && y + r > g.y0 && y - r < g.y1;
      if (hit(MAREA_GATES.door) && mareaDoorClosed()) return true;
      if (hit(MAREA_GATES.vip) && !marea.vip) return true;
      if (hit(MAREA_GATES.beach) && (marea.phase === 'night' || marea.phase === 'closed') && gameTime > marea.spookedUntil) return true;
      return false;
    }
    function addBeachClubColliders() {
      for (const b of MAREA_SOLIDS)
        if (['wall', 'glass', 'staff', 'restrooms', 'kiosk', 'screen', 'booth', 'speaker', 'bar', 'pool', 'poolbar', 'cabana'].includes(b.kind))
          addStatic(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, b.height, 'beach club');
      // Vehicles never fit through the door or the beach gate.
      for (const g of [MAREA_GATES.door, MAREA_GATES.beach]) addStatic(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, g.height, 'beach club');
      // Bollards along the forecourt keep cars off the queue.
      for (let u = 12; u < 400; u += 26) {
        const p = mareaPoint(u, 12);
        addStatic(p.x - 2, p.y - 2, 4, 4, 8, 'bollard');
      }
    }
    /* Hints and the doorman's word as the player walks up to the door or the VIP rope. */
    function updateMareaPlayer() {
      if (player.car || marea.phase !== 'night') return;
      const door = mareaPoint(302, 40),
        dDoor = distanceBetween(player, door),
        head = mareaHeadBouncer();
      if (!marea.pass && dDoor < 42 && gameTime - marea.hintAt > 4 && gameTime > marea.spookedUntil) {
        marea.hintAt = gameTime;
        if (marea.banned > gameTime) {
          mareaSay(head, MAREA_DOOR_TALK.player.banned);
          tell('MAREA · The bouncers remember you.', 2.5);
        } else {
          if (dDoor < 24) mareaSay(head, marea.queue.length ? MAREA_DOOR_TALK.player.line : MAREA_DOOR_TALK.player.cover);
          tell('MAREA BEACH CLUB · Cover $40 · E to pay the door', 2.5);
        }
      }
      const vip = mareaPoint(314, 148);
      if (marea.pass && !marea.vip && distanceBetween(player, vip) < 26 && gameTime - marea.hintAt > 4) {
        marea.hintAt = gameTime;
        mareaSay(mareaSlots.find((s) => s.vipGuard)?.person, MAREA_DOOR_TALK.player.vipAsk);
        tell('MAREA VIP · $250 band · E to buy', 2.5);
      }
    }
    /* E by the door or the VIP rope. True when handled. */
    function beachClubInteract() {
      if (player.car || !marea.built || marea.phase !== 'night') return false;
      const door = mareaPoint(302, 40),
        vip = mareaPoint(314, 148),
        head = mareaHeadBouncer(),
        T = MAREA_DOOR_TALK.player;
      if (!marea.pass && distanceBetween(player, door) < 46) {
        if (gameTime < marea.spookedUntil) tell('MAREA · Closed. Something happened.', 2.5);
        else if (marea.banned > gameTime) {
          mareaSay(head, T.banned);
          tell('MAREA · Banned for the night.', 2.5);
        } else if (wantedStars > 0) {
          mareaSay(head, T.wanted);
          tell('MAREA · Not while the police want you.', 2.5);
        } else if (cash < 40) {
          mareaSay(head, T.broke);
          tell('MAREA · You need $40.', 2.5);
        } else {
          cash -= 40;
          marea.pass = true;
          marea.passNight = Math.floor((worldMinutes - 300) / 1440);
          mareaSay(head, T.paid);
          tell('MAREA BEACH CLUB · Cover paid ($40). Enjoy your night.', 3);
          tone(520, 0.08, 0.12, 'triangle');
          const grumbler = marea.queue[0]?.members[0];
          if (grumbler) mareaSayOne(grumbler, 'cutLine');
        }
        return true;
      }
      if (marea.pass && !marea.vip && distanceBetween(player, vip) < 30) {
        const guard = mareaSlots.find((s) => s.vipGuard)?.person;
        if (cash < 250) {
          mareaSay(guard, T.broke);
          tell('MAREA VIP · You need $250.', 2.5);
        } else {
          cash -= 250;
          marea.vip = true;
          mareaSay(guard, T.vipPaid);
          tell('MAREA VIP · Band on. The terrace is yours.', 3);
          tone(660, 0.1, 0.14, 'triangle');
        }
        return true;
      }
      return false;
    }

    /**
     * THE DIRECTOR
     * Twice a second: which slots should be filled, who leaves, the queue, the
     * taxis. Everyone is removed when the player is far away.
     */
    function slotWanted(slot, L) {
      if (gameTime < marea.spookedUntil) return !!slot.staff && slot.kind === 'bouncer' && L.door > 0;
      const level = slot.mode === 'both' ? Math.max(L.day, L.night * 0.9, L.sunset * 0.6) : L[slot.mode] ?? 0;
      return level > slot.t;
    }
    function mareaFill(slot) {
      const inView = !marea.instant && crowdInView(slot.x, slot.y, 50);
      if (inView && slot.fromQueue && marea.levels.queue > 0.05) return; // they come in from the line
      let entry = null;
      if (inView) {
        if (slot.entry === 'staff' || slot.entry === 'booth') entry = 'staffDoor';
        else if (slot.entry === 'bar') entry = 'bar';
        else if (slot.node === 'beach' || (marea.phase === 'day' && mareaRandom() < 0.3)) entry = 'beach';
        else entry = 'street';
      }
      const start = !entry ? slot : entry === 'bar' ? mareaPoint(30, 100) : mareaNodePoint(entry);
      const p = mareaSpawn(slot, start.x, start.y);
      if (!p) return;
      mareaAssign(p, slot);
      if (slot.staff || slot.kind === 'bouncer' || slot.kind === 'host') p.club.staff = true;
      if (!entry) mareaSettle(p, slot);
      else if (entry === 'bar') {
        p.club.route = [{ x: slot.x, y: slot.y }];
        p.club.mode = 'arrive';
      } else if (slot.entry === 'booth') {
        p.club.route = [mareaNodePoint('wn'), mareaPoint(160, 94), mareaPoint(170, 88), { x: slot.x, y: slot.y }];
        p.club.mode = 'arrive';
      } else mareaRouteTo(p, entry, slot);
    }
    function updateBeachClub(deltaSeconds) {
      if (!marea.built) buildMareaCast();
      const far = mareaDistance(player.x, player.y);
      marea.near = far < 1400;
      marea.phase = mareaPhase();
      marea.levels = mareaLevels();
      marea.inView = crowdInView(MAREA.plot.x + 200, MAREA.plot.y + 150, 180);
      updateMareaMusic(deltaSeconds, far);
      if (marea.passNight >= 0 && (marea.phase === 'closed' || marea.phase === 'day')) {
        marea.pass = false;
        marea.vip = false;
        marea.passNight = -1;
      }
      if (!marea.near) {
        marea.wasNear = false;
        if (marea.people.length && far > 1700) for (const p of [...marea.people]) mareaRemove(p);
        marea.queue = [];
        marea.talk = null;
        return;
      }
      // Just arrived (a teleport, a fast drive) or the clock jumped: the club is
      // as it should be at once instead of filling up in front of the camera.
      const hour = crowdHour(),
        jumped = marea.lastHour != null && Math.abs(normalizeAngle(((hour - marea.lastHour) / 24) * TAU)) > 0.08;
      if (!marea.wasNear || jumped) marea.instantUntil = gameTime + 1.2;
      marea.wasNear = true;
      marea.lastHour = hour;
      marea.instant = gameTime < marea.instantUntil;
      updateMareaPlayer();
      marea.tick -= deltaSeconds;
      if (marea.tick > 0 && !marea.instant) return;
      const step = 0.5;
      marea.tick = step;
      const L = marea.levels,
        spooked = gameTime < marea.spookedUntil;
      // Anyone the rest of the game took away (a mission reset, a respawn).
      if (marea.people.length) {
        const alive = new Set(pedestrians);
        for (const p of [...marea.people]) if (!alive.has(p)) mareaRelease(p);
      }
      // Alarmed people run (once, from here, so the crowd's own perception has had its say).
      for (const p of [...marea.people]) if (p.club?.alarmed && p.club.mode !== 'evac') {
        p.club.alarmed = false;
        mareaEvacuate(p);
      }
      if (spooked)
        for (const g of marea.queue)
          for (const m of [...g.members]) {
            mareaRelease(m);
            startReaction(m, 'flee', randomBetween(4, 8), marea.alarmSource, mareaAlarmIncident());
          }
      if (spooked) marea.queue = [];
      for (const p of marea.people) if (p.club?.pendingLine && p.club.mode === 'leave' && (p.speechUntil || 0) < gameTime) {
        mareaSayOne(p, p.club.pendingLine);
        p.club.pendingLine = null;
      }
      // Slots.
      let budget = marea.inView && !marea.instant ? 3 : 60;
      for (const slot of mareaSlots) {
        const p = slot.person;
        if (p && (!p.club || p.hp <= 0 || p.club.slot !== slot)) {
          slot.person = null;
          slot.next = gameTime + (p && p.hp <= 0 ? 90 : 8);
          continue;
        }
        const want = slotWanted(slot, L);
        if (want && !p && gameTime > slot.next && budget > 0) {
          budget--;
          mareaFill(slot);
        } else if (!want && p && p.club.mode === 'slot') {
          if (marea.instant || !crowdInView(p.x, p.y, 40)) mareaRemove(p);
          else if (mareaRandom() < (marea.phase === 'closing' ? 0.25 : 0.12)) {
            const exit = marea.phase === 'closing' && marea.taxis.length && mareaRandom() < 0.5 ? 'street' : undefined;
            mareaLeave(p, exit);
            if (exit && p.club) {
              const taxi = randomChoice(marea.taxis);
              p.club.taxi = taxi;
              const door = driverDoor(taxi);
              p.club.route.pop();
              p.club.route.push({ x: door.x, y: door.y + 10 });
            }
          }
        }
      }
      if (!spooked) updateMareaQueue(step);
      updateMareaTaxis(step);
      // Queue members nobody wants any more (the doors are closing) drift off.
      if (L.queue <= 0.01 && marea.queue.length && !marea.talk)
        for (const g of marea.queue.splice(0))
          for (const m of g.members) {
            m.club.group = null;
            mareaLeave(m, 'street');
          }
    }
    /* Developer console: what the club is doing. */
    function beachClubReport() {
      const tally = (fn) => {
        const out = {};
        for (const p of marea.people) {
          const k = fn(p);
          if (k != null) out[k] = (out[k] || 0) + 1;
        }
        return out;
      };
      const round = (v) => Math.round(v * 100) / 100;
      return {
        name: 'MAREA BEACH CLUB',
        plot: MAREA.plot,
        door: mareaPoint(302, 40),
        phase: marea.phase,
        hour: round(crowdHour()),
        levels: marea.levels && Object.fromEntries(Object.entries(marea.levels).map(([k, v]) => [k, round(v)])),
        people: marea.people.length,
        slots: mareaSlots.length,
        filled: mareaSlots.filter((s) => s.person).length,
        byKind: tally((p) => p.club?.slot?.kind || p.club?.mode),
        byMode: tally((p) => p.club?.mode),
        poses: tally((p) => (p.club?.mode === 'slot' ? p.pose || 'stand' : null)),
        queue: { groups: marea.queue.length, people: mareaQueueCount(), talking: marea.talk ? marea.talk.script.map((l) => l[1]).join(' / ') : null },
        admitted: marea.admitted,
        rejected: marea.rejected,
        evacuated: marea.evacuated,
        shoves: marea.shoves,
        spooked: gameTime < marea.spookedUntil,
        enforcing: gameTime < marea.enforceUntil,
        doorClosed: mareaDoorClosed(),
        pass: marea.pass,
        vip: marea.vip,
        taxis: marea.taxis.length,
        music: mareaMusicReport(),
        inView: marea.inView,
      };
    }
    // END SUBSYSTEM: src/beachclub.js
