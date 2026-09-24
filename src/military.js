    // BEGIN SUBSYSTEM: src/military.js — Fort Sentinel
    /**
     * Fort Sentinel
     * Source: src/military.js
     * Scope: shared game closure.
     * The base plan (SENTINEL), perimeter and gate security, military vehicles,
     * garrison life (posts, patrols, drill, range practice, supply runs), the
     * alarm and lockdown, and base combat. base3d.js draws everything here.
     *
     * Plan (x east, y south; the island is x 8680..11000, y 7060..10500):
     *   - A double chain-link fence with razor wire round x 9300..10560,
     *     y 7750..9950, a clear zone inside it, eight watch towers and a
     *     perimeter road the patrol jeeps drive.
     *   - The main gate on the west side where the Sentinel Causeway lands
     *     (y 8150): a jersey-barrier funnel, a guard booth on a centre island
     *     under a canopy, a drop arm and anti-ram bollards per lane and a
     *     sliding palisade gate in the fence line that closes on lockdown.
     *   - North: HQ and its car park, the comms compound (lattice mast, radome,
     *     rotating radar, water tower). Middle: obstacle course, parade ground,
     *     three barracks, mess hall, clinic. South-middle: motor pool, container
     *     yard, fuel depot, ammunition bunkers, rifle range. South: two hangars,
     *     the control tower, helipads, apron and a short runway.
     * Gate pieces the renderer animates are exposed as `militaryGateState`.
     */
    const MILITARY = {
      name: 'FORT SENTINEL',
      x: 9300,
      y: 7750,
      w: 1260,
      h: 2200,
      gate: {
        x: 9300,
        y: 8150,
        half: 94,
      },
      helipad: {
        x: 10340,
        y: 9365,
      },
    };
    /* ---- The plan ------------------------------------------------------------------ */
    const SENTINEL = {
      // Double fence: the outer and inner chain-link runs are `fence` apart.
      fence: 20,
      perimeterRoad: { x0: 9400, y0: 7850, x1: 10460, y1: 9850, width: 50 },
      gate: {
        opening: [8062, 8238],
        lanes: [
          { y0: 8062, y1: 8134, out: true },
          { y0: 8166, y1: 8238, out: false },
        ],
        island: { x: 9190, y: 8134, w: 130, h: 32 },
        booth: { x: 9232, y: 8135, w: 36, h: 30 },
        canopy: { x0: 9205, x1: 9298, y0: 8050, y1: 8250, height: 36 },
        armX: 9272,
        bollardX: 9290,
        slideX: 9310,
        checkpoint: 9215,
        funnel: { x0: 9100, x1: 9300 },
      },
      towers: [
        { x: 9340, y: 7790, a: -2.36 },
        { x: 9930, y: 7790, a: -Math.PI / 2 },
        { x: 10520, y: 7790, a: -0.79 },
        { x: 10520, y: 8850, a: 0 },
        { x: 10520, y: 9910, a: 0.79 },
        { x: 9930, y: 9910, a: Math.PI / 2 },
        { x: 9340, y: 9910, a: 2.36 },
        { x: 9340, y: 8850, a: Math.PI },
      ],
      // Tower cabin floor: sentries stand up here.
      towerFloor: 52,
      buildings: [
        { id: 'hq', name: 'HEADQUARTERS', x: 9570, y: 7905, w: 340, h: 130, height: 44, style: 0 },
        { id: 'barracks-a', name: 'BARRACKS A', x: 10040, y: 8235, w: 360, h: 90, height: 30, style: 2 },
        { id: 'barracks-b', name: 'BARRACKS B', x: 10040, y: 8385, w: 360, h: 90, height: 30, style: 2 },
        { id: 'barracks-c', name: 'BARRACKS C', x: 10040, y: 8535, w: 360, h: 90, height: 30, style: 2 },
        { id: 'mess', name: 'MESS HALL', x: 9580, y: 8605, w: 280, h: 115, height: 26, style: 2 },
        { id: 'clinic', name: 'MEDICAL', x: 10060, y: 8650, w: 150, h: 72, height: 20, style: 0 },
        { id: 'motorpool', name: 'MOTOR POOL', x: 9440, y: 8800, w: 320, h: 80, height: 34, style: 2 },
        { id: 'hangar-1', name: 'HANGAR 1', x: 9440, y: 9275, w: 220, h: 155, height: 60, style: 2 },
        { id: 'hangar-2', name: 'HANGAR 2', x: 9700, y: 9275, w: 220, h: 155, height: 60, style: 2 },
        { id: 'atc', name: 'CONTROL', x: 10040, y: 9285, w: 50, h: 50, height: 72, style: 0 },
      ],
      // Painted ground: roads (centre lines), paved areas and markings.
      roads: [
        { name: 'SENTINEL AVENUE', points: [[9320, 8150], [10460, 8150]], width: 100 },
        { name: 'DEPOT ROAD', points: [[9990, 8200], [9990, 9460]], width: 50 },
        { name: 'MOTOR POOL ROAD', points: [[9400, 8760], [10460, 8760]], width: 40 },
      ],
      hqLot: { x: 9440, y: 7890, w: 105, h: 155 },
      motorPool: { x: 9440, y: 8890, w: 515, h: 335 },
      parade: { x: 9570, y: 8250, w: 380, h: 310 },
      stand: { x: 9700, y: 8210, w: 120, h: 28 },
      apron: { x: 9440, y: 9445, w: 995, h: 155 },
      taxiway: { x: 9960, y: 9600, w: 60, h: 65 },
      runway: { x: 9450, y: 9665, w: 960, h: 90 },
      helipads: [
        { x: 10200, y: 9365, r: 46 },
        { x: 10340, y: 9365, r: 46 },
      ],
      obstacleCourse: { x: 9440, y: 8260, w: 100, h: 460 },
      range: { x: 10040, y: 9150, w: 390, h: 80, targetsX: 10362 },
      fuel: {
        bund: { x: 10040, y: 8800, w: 240, h: 180 },
        vertical: [
          { x: 10090, y: 8855, r: 30, h: 46 },
          { x: 10165, y: 8855, r: 30, h: 46 },
          { x: 10240, y: 8855, r: 30, h: 46 },
        ],
        horizontal: [
          { x0: 10060, x1: 10150, y: 8938, r: 14 },
          { x0: 10165, x1: 10262, y: 8938, r: 14 },
        ],
        pump: { x: 10130, y: 9002, w: 60, h: 16 },
      },
      bunkers: [
        { x: 10320, y: 8800, w: 100, h: 80, label: 'M-1' },
        { x: 10320, y: 8920, w: 100, h: 80, label: 'M-2' },
        { x: 10320, y: 9040, w: 100, h: 80, label: 'M-3' },
      ],
      containers: [
        { x: 9785, y: 8805, w: 80, h: 70, layers: 2 },
        { x: 9875, y: 8805, w: 80, h: 70, layers: 1 },
      ],
      generators: [
        { x: 9920, y: 7985, w: 32, h: 16 },
        { x: 10284, y: 8040, w: 34, h: 16 },
        { x: 10330, y: 8040, w: 34, h: 16 },
      ],
      comms: { x: 10040, y: 7960, base: 26, height: 240 },
      shelter: { x: 10070, y: 7995, w: 50, h: 40 },
      radome: { x: 10205, y: 7965, base: 84, r: 40 },
      radar: { x: 10312, y: 7955 },
      waterTower: { x: 10405, y: 7955, spread: 22, height: 82, r: 24 },
      nests: [
        { x: 9352, y: 8030, a: Math.PI, net: true },
        { x: 9352, y: 8270, a: Math.PI },
        { x: 9238, y: 8024, a: Math.PI, net: true },
        { x: 9238, y: 8276, a: Math.PI },
      ],
      floods: [
        [9436, 7888],
        [9448, 8900],
        [9946, 8900],
        [9946, 9232],
        [9562, 8244],
        [9958, 8244],
        [9562, 8572],
        [9958, 8572],
        [9436, 9440],
        [10030, 9440],
        [10432, 9440],
        [10296, 8786],
        [10290, 9246],
      ],
      cctv: [
        [9336, 8400],
        [9336, 8700],
        [9336, 9200],
        [9336, 9500],
        [9336, 9760],
        [9620, 7786],
        [10240, 7786],
        [9620, 9914],
        [10240, 9914],
        [10524, 8300],
        [10524, 9400],
        [9296, 8030],
        [9296, 8270],
      ],
      flagpoles: [
        { x: 9700, y: 8074, height: 62, flag: 'unit' },
        { x: 9740, y: 8068, height: 72, flag: 'coast' },
        { x: 9780, y: 8074, height: 62, flag: 'base' },
        { x: 9688, y: 8222, height: 50, flag: 'coast' },
        { x: 9832, y: 8222, height: 50, flag: 'unit' },
      ],
      windsock: { x: 10420, y: 9790 },
    };
    SENTINEL.laneCenter = (lane) => (lane.y0 + lane.y1) / 2;
    /* ---- Military vehicle types -----------------------------------------------------
       Added to the shared table so every system (physics, damage, the 2D view, the
       garage) treats them as ordinary vehicles; base3d.js builds their models
       (`militaryModel`). */
    Object.assign(VEHICLE_DEFINITIONS, {
      jeep: {
        name: 'SENTINEL M4 UTILITY',
        offroad: true,
        l: 52,
        w: 29,
        max: 295,
        acc: 160,
        turn: 1.9,
        hp: 380,
        mass: 3,
        brake: 240,
        grip: 7,
        color: '#5c6547',
        militaryModel: 'jeep',
      },
      apc: {
        name: 'SENTINEL LAV-8 ARMORED CARRIER',
        offroad: true,
        l: 76,
        w: 34,
        max: 240,
        acc: 115,
        turn: 1.25,
        hp: 950,
        mass: 11,
        brake: 220,
        grip: 8,
        color: '#5b6548',
        militaryModel: 'apc',
      },
      armytruck: {
        name: 'SENTINEL M35 CARGO TRUCK',
        offroad: true,
        truck: true,
        l: 88,
        w: 32,
        max: 225,
        acc: 95,
        turn: 1.05,
        hp: 480,
        mass: 7.5,
        brake: 170,
        grip: 6,
        color: '#58624a',
        militaryModel: 'truck',
      },
    });
    /* ---- Colliders ------------------------------------------------------------------
       `militaryWalls` holds every fixed solid of the base: people and vehicles both
       collide with them (vehicles through addStatic in county.js) unless the entry
       is `vehicleOnly` (kerbs). Entries flagged `open` (thin lattices, the tower
       legs, the glazed booth) do not block sight or shots. */
    const militaryWalls = [],
      militarySightSolids = [];
    function baseSolid(x, y, w, h, height, kind = 'military', flags = {}) {
      const s = { x, y, w, h, height, kind, ...flags };
      militaryWalls.push(s);
      if (!s.open && !s.vehicleOnly && height >= 12) militarySightSolids.push(s);
      return s;
    }
    (function planColliders() {
      const f = SENTINEL.fence,
        x0 = MILITARY.x,
        y0 = MILITARY.y,
        x1 = MILITARY.x + MILITARY.w,
        y1 = MILITARY.y + MILITARY.h,
        g = SENTINEL.gate;
      // Fences (the pair is one solid; the privacy screen makes it opaque).
      baseSolid(x0, y0, x1 - x0, f, 26, 'military', { fence: true });
      baseSolid(x0, y1 - f, x1 - x0, f, 26, 'military', { fence: true });
      baseSolid(x1 - f, y0, f, y1 - y0, 26, 'military', { fence: true });
      baseSolid(x0, y0, f, g.opening[0] - y0, 26, 'military', { fence: true });
      baseSolid(x0, g.lanes[0].y1, f, g.lanes[1].y0 - g.lanes[0].y1, 26, 'military', { fence: true });
      baseSolid(x0, g.opening[1], f, y1 - g.opening[1], 26, 'military', { fence: true });
      for (const t of SENTINEL.towers) baseSolid(t.x - 15, t.y - 15, 30, 30, 80, 'tower', { open: true });
      // Gate: the booth, the island kerb and the jersey-barrier funnel.
      baseSolid(g.booth.x, g.booth.y, g.booth.w, g.booth.h, 22, 'military', { open: true });
      baseSolid(g.island.x, g.island.y, g.island.w, g.island.h, 3, 'military', { vehicleOnly: true });
      baseSolid(g.funnel.x0, g.opening[0] - 10, g.funnel.x1 - g.funnel.x0, 8, 8, 'barrier');
      baseSolid(g.funnel.x0, g.opening[1] + 2, g.funnel.x1 - g.funnel.x0, 8, 8, 'barrier');
      baseSolid(g.funnel.x0 + 10, 8146, g.island.x - g.funnel.x0 - 10, 8, 8, 'barrier');
      for (const n of SENTINEL.nests) baseSolid(n.x - 18, n.y - 11, 36, 22, 9, 'military');
      const fuel = SENTINEL.fuel;
      baseSolid(fuel.bund.x, fuel.bund.y, fuel.bund.w, fuel.bund.h, 46, 'military');
      baseSolid(fuel.pump.x, fuel.pump.y, fuel.pump.w, fuel.pump.h, 6, 'military', { vehicleOnly: true });
      for (const b of SENTINEL.bunkers) baseSolid(b.x, b.y, b.w, b.h, 28, 'military');
      for (const c of SENTINEL.containers) baseSolid(c.x, c.y, c.w, c.h, 22 * c.layers, 'military');
      for (const g2 of SENTINEL.generators) baseSolid(g2.x, g2.y, g2.w, g2.h, 13, 'military');
      const r = SENTINEL.radome;
      baseSolid(r.x - r.base / 2, r.y - r.base / 2, r.base, r.base, 90, 'military');
      const c = SENTINEL.comms;
      baseSolid(c.x - c.base / 2, c.y - c.base / 2, c.base, c.base, c.height, 'tower', { open: true });
      baseSolid(SENTINEL.shelter.x, SENTINEL.shelter.y, SENTINEL.shelter.w, SENTINEL.shelter.h, 16, 'military');
      baseSolid(SENTINEL.radar.x - 7, SENTINEL.radar.y - 7, 14, 14, 60, 'tower', { open: true });
      const w = SENTINEL.waterTower;
      baseSolid(w.x - w.spread - 2, w.y - w.spread - 2, w.spread * 2 + 4, w.spread * 2 + 4, 12, 'tower', { open: true });
      const s = SENTINEL.stand;
      baseSolid(s.x, s.y, s.w, s.h, 16, 'military');
      for (const [x, y] of SENTINEL.floods) baseSolid(x - 4, y - 4, 8, 8, 52, 'tower', { open: true });
      for (const p of SENTINEL.flagpoles) baseSolid(p.x - 2, p.y - 2, 4, 4, p.height, 'tower', { open: true });
      const o = SENTINEL.obstacleCourse;
      baseSolid(o.x + 15, o.y + 96, o.w - 30, 8, 12, 'military');
      // The rifle range backstop berm.
      baseSolid(SENTINEL.range.x + SENTINEL.range.w - 45, SENTINEL.range.y - 10, 45, SENTINEL.range.h + 20, 22, 'military');
    })();
    /* ---- Gate state -----------------------------------------------------------------
       Per lane: the drop arm (0 down .. 1 up), the bollards (0 down .. 1 raised) and
       the sliding gate (0 open .. 1 closed). Arms and bollards stop vehicles only; the
       sliding gate stops everyone. Rammed pieces break (`broken`) until repaired. */
    const militaryGateState = SENTINEL.gate.lanes.map((lane) => ({
      lane,
      arm: 0,
      bollards: 0,
      slide: 0,
      armBroken: false,
      bollardsBroken: false,
      slideBroken: false,
    }));
    let militaryGate = 0,
      militaryGateUntil = 0,
      militaryAlertUntil = 0,
      militaryWarningAt = -100,
      militaryLockdownUntil = 0,
      militaryAlarmStartedAt = -100,
      militaryRepairAt = 0,
      militaryChallenge = { level: 0, since: 0, spokeAt: -100, leftAt: -100 },
      militarySupplyAt = 90,
      militaryRespawnAt = 0,
      militaryAnnounceAt = -100,
      militaryWantedAt = -100;
    function inMilitary(x, y, margin = 0) {
      return (
        x > MILITARY.x - margin &&
        x < MILITARY.x + MILITARY.w + margin &&
        y > MILITARY.y - margin &&
        y < MILITARY.y + MILITARY.h + margin
      );
    }
    function militaryLockdown() {
      return militaryLockdownUntil > gameTime;
    }
    // The gate's moving pieces that currently stand in the way, as barrier solids.
    // Cached per game tick: people inside the base ask many times a frame.
    let gateSolidsAt = -1,
      gateSolidsCache = [];
    function militaryGateSolids() {
      if (gateSolidsAt === gameTime) return gateSolidsCache;
      gateSolidsAt = gameTime;
      const g = SENTINEL.gate,
        out = (gateSolidsCache = []);
      for (const s of militaryGateState) {
        const { y0, y1 } = s.lane;
        if (!s.armBroken && s.arm < 0.55) out.push({ x: g.armX - 3, y: y0, w: 6, h: y1 - y0, height: 9, barrier: true, vehicleOnly: true, part: 'arm', state: s });
        if (!s.bollardsBroken && s.bollards > 0.5)
          out.push({ x: g.bollardX - 3, y: y0, w: 6, h: y1 - y0, height: 9, barrier: true, vehicleOnly: true, part: 'bollards', state: s });
        if (!s.slideBroken && s.slide > 0.85) out.push({ x: g.slideX - 4, y: y0, w: 8, h: y1 - y0, height: 24, barrier: true, part: 'slide', state: s });
      }
      return out;
    }
    // Sight, shots, routes and spawning: the tall fixed solids plus the gate pieces.
    function militarySolids() {
      const gate = militaryGateSolids();
      return gate.length ? [...militarySightSolids, ...gate] : militarySightSolids;
    }
    // People: every fixed solid except kerbs, plus a closed sliding gate.
    function militaryBlocked(x, y, r = 8) {
      if (!inMilitary(x, y, 240)) return false;
      for (const b of militaryWalls)
        if (!b.vehicleOnly && x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      for (const b of militaryGateSolids())
        if (!b.vehicleOnly && x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      return false;
    }
    function militaryVehicleBlocked(vehicle) {
      if (!inMilitary(vehicle.x, vehicle.y, 260)) return false;
      const shape = vehicleShape(vehicle);
      return [...militaryWalls, ...militaryGateSolids()].some((b) =>
        boxContact(shape, {
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          hx: b.w / 2,
          hy: b.h / 2,
          a: 0,
        }),
      );
    }
    /* ---- Alarm, lockdown and the base siren ------------------------------------------ */
    function militaryAlarm() {
      if (militaryAlertUntil < gameTime) {
        militaryAlarmStartedAt = gameTime;
        announce('FORT SENTINEL · INTRUDER ALERT', 'BASE LOCKDOWN', 2.8);
        tell('Sirens across the base: the gates are closing and the garrison is responding. Get out or dig in.', 5);
        crime(3);
        militaryChallenge.level = 3;
      }
      militaryAlertUntil = gameTime + 22;
      militaryLockdownUntil = Math.max(militaryLockdownUntil, gameTime + 34);
    }
    // A wailing air-raid siren built from two oscillators; its level follows the
    // alarm and the listener's distance from the base.
    let militarySiren = null;
    function updateMilitarySiren(deltaSeconds) {
      if (!audio || !master) return;
      const alert = militaryAlertUntil > gameTime && gameMode === 'play' && soundOn;
      if (!militarySiren) {
        if (!alert) return;
        try {
          const o = audio.createOscillator(),
            o2 = audio.createOscillator(),
            filter = audio.createBiquadFilter(),
            gain = audio.createGain();
          o.type = 'sawtooth';
          o2.type = 'square';
          filter.type = 'lowpass';
          filter.frequency.value = 1500;
          gain.gain.value = 0;
          o.connect(filter);
          o2.connect(filter);
          filter.connect(gain).connect(master);
          o.start();
          o2.start();
          militarySiren = { o, o2, filter, gain, phase: 0 };
        } catch {
          return;
        }
      }
      const s = militarySiren;
      s.phase += deltaSeconds;
      // Rise over ~2.5 s, hold, fall: the classic wind-up wail.
      const cycle = (s.phase % 6) / 6,
        wail = cycle < 0.45 ? cycle / 0.45 : cycle < 0.6 ? 1 : 1 - (cycle - 0.6) / 0.4,
        f = 260 + wail * 470,
        d = Math.max(0, Math.hypot(player.x - clamp(player.x, MILITARY.x, MILITARY.x + MILITARY.w), player.y - clamp(player.y, MILITARY.y, MILITARY.y + MILITARY.h))),
        level = alert ? clamp(1 - d / 1600, 0, 1) * 0.07 : 0;
      s.o.frequency.setTargetAtTime(f, audio.currentTime, 0.05);
      s.o2.frequency.setTargetAtTime(f * 1.005, audio.currentTime, 0.05);
      s.gain.gain.setTargetAtTime(level, audio.currentTime, 0.4);
    }
    /* ---- Gate interaction ---------------------------------------------------------- */
    function militaryGateClosedToPlayer() {
      return militaryGateState.some((s) => s.slide > 0.85 && !s.slideBroken) || (!!player.car && militaryGate < 0.85);
    }
    function militaryInteract() {
      if (
        playerOnRoof() ||
        (player.car?.altitude || 0) > 4 ||
        distanceBetween(player, MILITARY.gate) > 125
      )
        return false;
      if (!militaryGateClosedToPlayer()) return false;
      militaryGateUntil = gameTime + 16;
      militaryAlarm();
      tell('Gate controls forced: the barriers are up for a few seconds.', 4);
      return true;
    }
    function militarySpeak(e, text, seconds = 2.8) {
      e.speech = text;
      e.speechUntil = gameTime + seconds;
    }
    function militaryGuards(role) {
      return gangMembers.filter((e) => e.military && e.role === role && e.hp > 0 && !personIncapacitated(e));
    }
    // Challenge at the gate: a warning, a final warning, then fire.
    function updateGateChallenge(deltaSeconds) {
      const g = SENTINEL.gate,
        c = militaryChallenge,
        alert = militaryAlertUntil > gameTime,
        x = player.x,
        y = player.y,
        onGround = !isAircraft(player.car) && !playerOnRoof(),
        inZone = onGround && x > g.funnel.x0 - 60 && x < MILITARY.x + 150 && y > g.opening[0] - 30 && y < g.opening[1] + 30;
      if (alert) return;
      if (c.level === 3) c.level = 0;
      const guards = militaryGuards('gate');
      if (!inZone) {
        if (c.level > 0 && gameTime - c.leftAt > 8) c.level = 0;
        return;
      }
      if (!guards.length) return;
      const speaker = guards.reduce((a, b) => (distanceBetween(a, player) < distanceBetween(b, player) ? a : b)),
        speed = player.car ? Math.abs(player.car.speed) : 0;
      if (c.level === 0) {
        c.level = 1;
        c.since = gameTime;
        militarySpeak(speaker, 'HALT! RESTRICTED AREA!');
        tell('FORT SENTINEL GATE · HALT. Authorized personnel only: turn back now.', 4);
        tone(880, 0.25, 0.25, 'square', 870);
      } else if (c.level === 1 && (gameTime - c.since > 5 || x > g.checkpoint + 20 || speed > 150)) {
        c.level = 2;
        c.since = gameTime;
        militarySpeak(speaker, 'FINAL WARNING! TURN BACK OR WE FIRE!', 3.2);
        tell('FINAL WARNING · USE OF DEADLY FORCE AUTHORIZED. Leave the gate area.', 4);
        tone(660, 0.4, 0.3, 'square', 640);
      } else if (c.level === 2 && (gameTime - c.since > 4 || x > g.armX + 8)) {
        militarySpeak(speaker, 'OPEN FIRE!', 2);
        militaryAlarm();
      }
      c.leftAt = gameTime;
    }
    /* Arms lift for military traffic and when forced; bollards and the sliding gate
       close on lockdown (but never onto something standing in the lane). */
    function updateGatePieces(deltaSeconds) {
      const g = SENTINEL.gate,
        lockdown = militaryLockdown(),
        forced = gameTime < militaryGateUntil;
      for (const s of militaryGateState) {
        const cy = SENTINEL.laneCenter(s.lane),
          half = (s.lane.y1 - s.lane.y0) / 2;
        let friendly = false,
          inLane = false;
        for (const c of vehicles) {
          if ((c.altitude || 0) > 15 || c.hp <= 0) continue;
          const dy = Math.abs(c.y - cy);
          if (dy > half + 20) continue;
          const dx = c.x - g.armX;
          if (Math.abs(dx) < vehicleSpec(c).l / 2 + 22) inLane = true;
          if (c.military && c.ai && Math.abs(dx) < 150) friendly = true;
        }
        if (Math.abs(player.y - cy) < half + 10 && Math.abs(player.x - g.slideX) < 40) inLane = true;
        const armUp = forced || friendly || (inLane && s.arm > 0.6);
        s.arm = clamp(s.arm + (armUp ? 1 : -1) * deltaSeconds * 0.8, 0, 1);
        const raise = lockdown && !forced && !friendly && !inLane;
        s.bollards = clamp(s.bollards + (raise ? 1 : -1) * deltaSeconds * 0.9, 0, 1);
        const shut = lockdown && !forced && !(friendly && !alertOnPlayerNearGate()) && !(inLane && s.slide < 0.85);
        s.slide = clamp(s.slide + (shut ? 1 : -1) * deltaSeconds * 0.28, 0, 1);
      }
      militaryGate = Math.min(...militaryGateState.map((s) => (s.armBroken ? 1 : s.arm)));
      // Broken pieces are replaced once the alarm is over and nobody is watching.
      if (!lockdown && militaryAlertUntil < gameTime && gameTime > militaryRepairAt && distanceBetween(player, MILITARY.gate) > 900)
        for (const s of militaryGateState) s.armBroken = s.bollardsBroken = s.slideBroken = false;
    }
    function alertOnPlayerNearGate() {
      return militaryAlertUntil > gameTime && distanceBetween(player, MILITARY.gate) < 400;
    }
    // A vehicle arriving fast enough breaks a gate piece instead of stopping at it.
    function updateGateRamming() {
      if (distanceBetween(player, MILITARY.gate) > 900) return;
      for (const c of vehicles) {
        if (c.hp <= 0 || (c.altitude || 0) > 15 || isBoat(c) || (c.military && c.ai) || distanceBetween(c, MILITARY.gate) > 200) continue;
        const spec = vehicleSpec(c),
          speed = Math.abs(c.speed || Math.hypot(c.vx || 0, c.vy || 0)),
          shape = vehicleShape(c, 6 + speed * 0.05);
        for (const piece of militaryGateSolids()) {
          if (!boxContact(shape, { x: piece.x + piece.w / 2, y: piece.y + piece.h / 2, hx: piece.w / 2, hy: piece.h / 2, a: 0 })) continue;
          const mass = spec.mass || 1,
            breaks =
              piece.part === 'arm'
                ? speed > 80
                : piece.part === 'bollards'
                  ? (mass >= 15 && speed > 45) || (mass >= 10 && speed > 150)
                  : (mass >= 15 && speed > 40) || (mass >= 5 && speed > 115);
          if (!breaks) continue;
          const s = piece.state;
          if (piece.part === 'arm') s.armBroken = true;
          if (piece.part === 'bollards') s.bollardsBroken = true;
          if (piece.part === 'slide') s.slideBroken = true;
          militaryRepairAt = gameTime + 90;
          const keep = piece.part === 'arm' ? 0.88 : 0.62;
          c.vx *= keep;
          c.vy *= keep;
          c.speed *= keep;
          damageVehicle(c, piece.part === 'arm' ? 6 : 35, piece.x + 3, c.y, null, { kind: 'crash', nx: c.x < piece.x ? -1 : 1, ny: 0, closing: speed, otherMass: 20 });
          particle(piece.x + 3, c.y, piece.part === 'arm' ? '#e8e0cf' : '#8a8f86', 16, 150, 4);
          playSample('explosion', piece.part === 'arm' ? 0.15 : 0.35, 2.2, c);
          shake = Math.max(shake, piece.part === 'arm' ? 3 : 8);
          if (c === player.car) {
            tell(piece.part === 'arm' ? 'Barrier arm snapped.' : piece.part === 'bollards' ? 'Anti-ram bollards crushed.' : 'Sliding gate burst open.', 3);
            militaryAlarm();
          }
        }
      }
    }
    /* ---- Ground (county tile and minimap) -------------------------------------------- */
    function paintMilitaryGround(drawingContext) {
      const d = drawingContext;
      d.fillStyle = '#6f7a60';
      d.fillRect(MILITARY.x, MILITARY.y, MILITARY.w, MILITARY.h);
      d.fillStyle = '#a19d8c';
      d.fillRect(MILITARY.x, MILITARY.y, MILITARY.w, 75);
      d.fillRect(MILITARY.x, MILITARY.y + MILITARY.h - 75, MILITARY.w, 75);
      d.fillRect(MILITARY.x, MILITARY.y, 75, MILITARY.h);
      d.fillRect(MILITARY.x + MILITARY.w - 75, MILITARY.y, 75, MILITARY.h);
      const pr = SENTINEL.perimeterRoad;
      d.strokeStyle = '#4b5251';
      d.lineWidth = pr.width;
      d.strokeRect(pr.x0, pr.y0, pr.x1 - pr.x0, pr.y1 - pr.y0);
      d.fillStyle = '#4b5251';
      d.fillRect(SENTINEL.gate.funnel.x0 - 80, SENTINEL.gate.opening[0], MILITARY.x - SENTINEL.gate.funnel.x0 + 80, SENTINEL.gate.opening[1] - SENTINEL.gate.opening[0]);
      for (const r of SENTINEL.roads) {
        d.lineWidth = r.width;
        d.beginPath();
        d.moveTo(r.points[0][0], r.points[0][1]);
        for (const p of r.points.slice(1)) d.lineTo(p[0], p[1]);
        d.stroke();
      }
      d.fillStyle = '#8c8c82';
      for (const a of [SENTINEL.hqLot, SENTINEL.motorPool, SENTINEL.apron, SENTINEL.taxiway, SENTINEL.parade])
        d.fillRect(a.x, a.y, a.w, a.h);
      d.fillStyle = '#434a4b';
      const rw = SENTINEL.runway;
      d.fillRect(rw.x, rw.y, rw.w, rw.h);
      d.fillStyle = '#dcd8c4';
      for (let x = rw.x + 90; x < rw.x + rw.w - 90; x += 70) d.fillRect(x, rw.y + rw.h / 2 - 2, 36, 4);
      d.strokeStyle = '#dcd8c4';
      d.lineWidth = 5;
      for (const p of SENTINEL.helipads) {
        d.beginPath();
        d.arc(p.x, p.y, p.r - 6, 0, TAU);
        d.stroke();
      }
      d.fillStyle = '#9b8f6e';
      const f = SENTINEL.fuel.bund;
      d.fillRect(f.x, f.y, f.w, f.h);
      d.fillStyle = '#5f7148';
      for (const b of SENTINEL.bunkers) d.fillRect(b.x, b.y, b.w, b.h);
      d.fillStyle = '#7d6d52';
      d.fillRect(SENTINEL.range.x, SENTINEL.range.y, SENTINEL.range.w, SENTINEL.range.h);
      d.fillStyle = '#e7d6b2';
      d.font = 'bold 34px monospace';
      d.fillText('RESTRICTED', 9660, 8430);
    }
    /* ---- Buildings ------------------------------------------------------------------- */
    function buildMilitary() {
      const old = randomSeed;
      randomSeed = 77077;
      for (const plan of SENTINEL.buildings) {
        makeBuilding(plan.x, plan.y, plan.w, plan.h, plan.style, true);
        Object.assign(buildings.at(-1), {
          county: true,
          tropical: false,
          height: plan.height,
          military: true,
          // Drawn by base3d.js, not the city facade builder.
          baseBuilding: plan.id,
          baseName: plan.name,
        });
      }
      randomSeed = old;
    }
    /* ---- Garrison -------------------------------------------------------------------- */
    function soldier(x, y, a, role, extra = {}) {
      const s = {
        x,
        y,
        home: { x, y, a },
        a,
        hp: 115,
        maxhp: 115,
        // Base security wear plate carriers: small arms need several rounds to matter.
        vest: 110,
        color: '#5f6b4b',
        faction: 'military',
        military: true,
        role,
        name: role === 'gate' ? 'MILITARY POLICE' : 'FORT SENTINEL',
        timer: 1.2 + seededRandom() * 0.6,
        walk: 0,
        walking: false,
        ...extra,
      };
      gangMembers.push(s);
      return s;
    }
    // Drill: 3 ranks of 4 march a loop of the parade ground by day.
    const DRILL_LOOP = [
      { x: 9650, y: 8330 },
      { x: 9870, y: 8330 },
      { x: 9870, y: 8480 },
      { x: 9650, y: 8480 },
    ];
    const militaryDrill = { index: 1, x: 9650, y: 8330, a: 0, pauseUntil: 0, callAt: 0, step: 0 };
    function populateMilitary() {
      militaryGate = 0;
      militaryGateUntil = militaryAlertUntil = militaryLockdownUntil = 0;
      militaryWarningAt = -100;
      militaryChallenge = { level: 0, since: 0, spokeAt: -100, leftAt: -100 };
      militarySupplyAt = gameTime + 60;
      militarySupply = null;
      for (const s of militaryGateState) {
        s.arm = s.bollards = s.slide = 0;
        s.armBroken = s.bollardsBroken = s.slideBroken = false;
      }
      const park = (type, x, y, a, extra = {}) => {
        const c = makeCar(type, x, y, a, false, extra.color);
        c.military = true;
        c.turretA = c.a;
        return Object.assign(c, extra);
      };
      const north = -Math.PI / 2;
      // Motor pool: two ranks facing the shed, tanks under camouflage netting.
      for (const x of [9470, 9515, 9560, 9605]) park('jeep', x, 8950, north);
      for (const x of [9665, 9715]) park('armytruck', x, 8950, north);
      for (const x of [9780, 9830]) park('apc', x, 8950, north);
      park('tank', 9490, 9080, north, { crewed: true });
      // The second tank is an older variant without the coaxial MG (armor.js).
      park('tank', 9565, 9080, north, { crewed: true, noCoax: true });
      park('apc', 9645, 9080, north, { crewed: true, gunner: true });
      for (const x of [9715, 9765]) park('armytruck', x, 9080, north);
      for (const x of [9835, 9880, 9925]) park('jeep', x, 9080, north);
      // The fuel bowser at the pump island.
      park('armytruck', 10160, 9042, 0, { fuelBowser: true });
      // Quick-reaction jeeps with gunners at HQ.
      for (const x of [9470, 9512]) park('jeep', x, 7962, Math.PI / 2, { gunner: true, qrf: true, qrfHome: { x, y: 7962, a: Math.PI / 2 } });
      // Perimeter patrol jeeps drive the ring road clockwise.
      const pr = SENTINEL.perimeterRoad,
        ring = [
          { x: pr.x0, y: pr.y0 + 55 },
          { x: pr.x0 + 55, y: pr.y0 },
          { x: pr.x1 - 55, y: pr.y0 },
          { x: pr.x1, y: pr.y0 + 55 },
          { x: pr.x1, y: pr.y1 - 55 },
          { x: pr.x1 - 55, y: pr.y1 },
          { x: pr.x0 + 55, y: pr.y1 },
          { x: pr.x0, y: pr.y1 - 55 },
        ];
      for (const [x, y, a, index] of [
        [9800, pr.y0, 0, 2],
        [10100, pr.y1, Math.PI, 6],
      ]) {
        const c = makeCar('jeep', x, y, a, true);
        c.military = true;
        c.gunner = true;
        c.patrol = true;
        c.turretA = a;
        c.countyRoute = ring;
        c.countyIndex = index;
      }
      // Helicopters on the apron and a pad.
      for (const [x, y, a] of [
        [9550, 9522, 0],
        [9810, 9522, 0],
        [10340, 9365, Math.PI],
      ])
        park('helicopter', x, y, a, { color: '#4d5641' });
      // Posts.
      const g = SENTINEL.gate;
      soldier(g.island.x + 8, 8150, Math.PI, 'gate');
      soldier(g.booth.x + g.booth.w / 2, 8150, Math.PI, 'gate', { hold: true });
      soldier(g.island.x + g.island.w - 16, 8150, Math.PI, 'gate');
      for (const n of SENTINEL.nests) soldier(n.x + 6, n.y, n.a, 'post', { hold: true });
      for (const t of SENTINEL.towers) soldier(t.x, t.y, t.a, 'tower', { altitude: SENTINEL.towerFloor, hold: true, elevated: true });
      soldier(9725, 8050, Math.PI / 2, 'post', { hold: true });
      soldier(9755, 8050, Math.PI / 2, 'post', { hold: true });
      soldier(9505, 8895, north, 'post');
      soldier(9640, 8898, north, 'post');
      soldier(9760, 9460, Math.PI / 2, 'post');
      soldier(10200, 9440, Math.PI / 2, 'post');
      soldier(10300, 9010, Math.PI, 'post');
      // Rifle range: four firers on the firing line.
      const r = SENTINEL.range;
      for (let i = 0; i < 4; i++) soldier(r.x + 24, r.y + 10 + i * 20, 0, 'range', { lane: i, hold: true });
      // Foot patrols.
      const patrol = (route, offset = 0) =>
        soldier(route[0].x, route[0].y + offset, 0, 'patrol', { route, routeIndex: 1, pauseUntil: 0, offset });
      patrol([{ x: 9366, y: 8300 }, { x: 9366, y: 9860 }]);
      patrol([{ x: 9420, y: 7815 }, { x: 10480, y: 7815 }]);
      patrol([{ x: 10494, y: 9820 }, { x: 10494, y: 7880 }]);
      patrol([{ x: 10480, y: 9886 }, { x: 9420, y: 9886 }]);
      const barracksLoop = [
        { x: 10028, y: 8212 },
        { x: 10425, y: 8212 },
        { x: 10425, y: 8640 },
        { x: 10028, y: 8640 },
      ];
      patrol(barracksLoop);
      patrol(barracksLoop, 16);
      patrol([{ x: 9440, y: 9612 }, { x: 10430, y: 9612 }]);
      patrol([
        { x: 10308, y: 8790 },
        { x: 10430, y: 8790 },
        { x: 10430, y: 9135 },
        { x: 10308, y: 9135 },
      ]);
      patrol([{ x: 9560, y: 8090 }, { x: 9920, y: 8090 }]);
      // Drill platoon and its sergeant.
      Object.assign(militaryDrill, { index: 1, x: DRILL_LOOP[0].x, y: DRILL_LOOP[0].y, a: 0, pauseUntil: 0 });
      for (let i = 0; i < 12; i++) {
        const home = { x: 10070 + (i % 6) * 55, y: 8355 + Math.floor(i / 6) * 150 };
        soldier(home.x, home.y, Math.PI / 2, 'drill', { slot: i, barracksHome: home });
      }
      soldier(DRILL_LOOP[0].x, DRILL_LOOP[0].y - 50, 0, 'sergeant', { barracksHome: { x: 10390, y: 8355 } });
    }
    function drillSlot(i) {
      const rank = Math.floor(i / 4),
        file = i % 4,
        back = -rank * 24,
        side = (file - 1.5) * 20,
        c = Math.cos(militaryDrill.a),
        s = Math.sin(militaryDrill.a);
      return { x: militaryDrill.x + back * c - side * s, y: militaryDrill.y + back * s + side * c };
    }
    function drillHours() {
      const hour = (worldMinutes % 1440) / 60;
      return hour > 6.5 && hour < 18;
    }
    function updateDrill(deltaSeconds) {
      const d = militaryDrill;
      if (gameTime < d.pauseUntil) return false;
      const target = DRILL_LOOP[d.index],
        dist = distanceBetween(d, target);
      if (dist < 3) {
        d.index = (d.index + 1) % DRILL_LOOP.length;
        d.pauseUntil = gameTime + 2.5;
        d.a = headingBetween(d, DRILL_LOOP[d.index]);
        return false;
      }
      d.a = headingBetween(d, target);
      const step = Math.min(dist, 24 * deltaSeconds);
      d.x += Math.cos(d.a) * step;
      d.y += Math.sin(d.a) * step;
      return true;
    }
    // Tanks, APCs and gunner jeeps: aim, acquire, fire.
    function militaryGunnerFire(c, target) {
      const a = (c.turretA ?? c.a) + randomBetween(-0.05, 0.05),
        origin = { x: c.x + Math.cos(a) * 20, y: c.y + Math.sin(a) * 20, altitude: entityElevation(c) + 16 },
        v = shotVelocity(origin, target, 720, a);
      bullets.push({
        x: origin.x,
        y: origin.y,
        altitude: origin.altitude,
        vx: v.vx,
        vy: v.vy,
        vz: v.vz,
        life: 0.85,
        dmg: 12,
        enemy: true,
        faction: 'military',
        owner: c,
        target,
      });
      playSample('automatic', 0.3, 0.82, c);
      if (city3D) city3D.fire(origin.x, origin.y, a, false, origin.altitude);
    }
    function tankFire(c, enemy = false) {
      if (c.hp <= 0 || gameTime < (c.cannonReadyAt || 0)) return false;
      c.cannonReadyAt = gameTime + 2.3;
      const a = c.turretA ?? c.a,
        x = c.x + Math.cos(a) * 65,
        y = c.y + Math.sin(a) * 65;
      c.cannonRecoilUntil = gameTime + 0.25;
      bullets.push({
        x,
        y,
        altitude: entityElevation(c),
        vx: Math.cos(a) * 610,
        vy: Math.sin(a) * 610,
        life: 1.7,
        dmg: 155,
        rocket: true,
        // A main-gun round: it breaches facades it hits (damage3d.js shellImpact).
        shell: true,
        blastPower: 1.35,
        enemy,
        faction: enemy ? 'military' : undefined,
        owner: enemy ? c : player,
        target: player,
      });
      playSample('explosion', 0.6, 1.5, c);
      if (city3D) city3D.fire(x, y, a, true, entityElevation(c));
      particle(x, y, '#f9d18a', 12, 110, 7);
      if (!enemy) {
        shake = Math.max(shake, 6);
        notifyViolence(player, 'gunfire', player);
        crime(0.45);
      }
      return true;
    }
    /* ---- Supply runs: an authorized truck in through the checkpoint and out again. ---- */
    let militarySupply = null;
    function updateSupplyRun() {
      const g = SENTINEL.gate,
        inbound = SENTINEL.laneCenter(g.lanes[1]),
        outbound = SENTINEL.laneCenter(g.lanes[0]);
      if (!militarySupply) {
        if (gameTime < militarySupplyAt || militaryAlertUntil > gameTime) return;
        militarySupplyAt = gameTime + 150 + seededRandom() * 90;
        const start = { x: 8200, y: 8185 };
        if (distanceBetween(player, start) < 650 || !canSpawnCar('armytruck', start.x, start.y, 0)) return;
        const c = makeCar('armytruck', start.x, start.y, 0, true);
        c.military = true;
        c.supply = true;
        c.countyRoute = [
          { x: 9100, y: 8192 },
          { x: g.checkpoint - 30, y: inbound },
          { x: 9360, y: inbound },
          { x: 9960, y: 8178 },
          { x: 9990, y: 8700 },
          { x: 9990, y: 9175 },
          { x: 9720, y: 9175 },
        ];
        c.countyIndex = 0;
        militarySupply = { car: c, stage: 'in', checked: false, parkedAt: 0 };
        return;
      }
      const s = militarySupply,
        c = s.car;
      if (c.hp <= 0 || c === player.car || !vehicles.includes(c)) {
        militarySupply = null;
        return;
      }
      if (s.stage === 'in') {
        // Stop at the booth for the paperwork.
        if (!s.checked && distanceBetween(c, { x: g.checkpoint - 30, y: inbound }) < 70) {
          c.ai = false;
          if (!s.checkUntil) {
            s.checkUntil = gameTime + 4;
            const guard = militaryGuards('gate')[0];
            if (guard) militarySpeak(guard, 'PAPERS. ...YOU’RE CLEARED.', 3.4);
          }
          if (gameTime > s.checkUntil) {
            s.checked = true;
            c.ai = true;
            c.countyIndex = 2;
          }
        }
        if (c.countyIndex === 0 && c.ai && distanceBetween(c, c.countyRoute[6]) < 70) {
          // Arrived: park until the load is off.
          c.ai = false;
          s.stage = 'parked';
          s.parkedAt = gameTime;
        }
      } else if (s.stage === 'parked') {
        if (gameTime - s.parkedAt > 70 && militaryAlertUntil < gameTime) {
          c.countyRoute = [
            { x: 9990, y: 9175 },
            { x: 9990, y: 8200 },
            { x: 9900, y: outbound },
            { x: 9330, y: outbound },
            { x: 9100, y: 8112 },
            { x: 8150, y: 8112 },
          ];
          c.countyIndex = 0;
          c.ai = true;
          s.stage = 'out';
        }
      } else if (s.stage === 'out') {
        if (c.countyIndex === 0 && c.x < 8300) {
          c.ai = false;
          if (distanceBetween(c, player) > 600) {
            vehicles.splice(vehicles.indexOf(c), 1);
            militarySupply = null;
          }
        }
      }
    }
    /* ---- The update ------------------------------------------------------------------- */
    function militaryThreatened() {
      return (
        (inMilitary(player.x, player.y) && !isAircraft(player.car)) ||
        (isAircraft(player.car) && inMilitary(player.x, player.y) && entityElevation(player.car) - terrainHeight(player.x, player.y) < 90) ||
        gangMembers.some((g) => g.military && (g.playerThreatUntil || 0) > gameTime) ||
        vehicles.some(
          (c) =>
            c.military &&
            c.hp > 0 &&
            c.lastAttacker === player &&
            gameTime - (c.lastDamagedAt ?? -100) < 22 &&
            distanceBetween(c, player) < 700,
        )
      );
    }
    function updateMilitary(deltaSeconds) {
      const near = distanceBetween(player, MILITARY.gate) < 480,
        inside = inMilitary(player.x, player.y);
      if (near && !inside && militaryAlertUntil < gameTime && gameTime - militaryWarningAt > 25) {
        militaryWarningAt = gameTime;
        tell('FORT SENTINEL · Restricted military installation. Use of deadly force authorized beyond the gate.', 6);
      }
      if (militaryThreatened()) militaryAlarm();
      updateGateChallenge(deltaSeconds);
      updateGatePieces(deltaSeconds);
      updateGateRamming();
      updateMilitarySiren(deltaSeconds);
      updateSupplyRun();
      const alert = militaryAlertUntil > gameTime;
      // A base at war with an intruder still inside it keeps the police on them:
      // the search is refreshed, but no heat is added (heat only comes from new
      // crimes, heat.js). Once over the fence and away, the search runs down.
      if (alert && wantedStars > 0 && inMilitary(player.x, player.y) && gameTime - militaryWantedAt > 4) {
        militaryWantedAt = gameTime;
        lastSeen = { x: player.x, y: player.y };
        searchActive = false;
        searchRemaining = Math.max(searchRemaining, policeSearchSeconds());
      }
      if (alert && gameTime - militaryAnnounceAt > 14 && inMilitary(player.x, player.y, 600)) {
        militaryAnnounceAt = gameTime;
        tell(
          randomChoice([
            'BASE PA · Lockdown, lockdown. Intruder on base. All units respond.',
            'BASE PA · All personnel to shelter. Security forces, weapons free.',
            'BASE PA · Gates are sealed. Quick reaction force, move out.',
          ]),
          3.5,
        );
      }
      const threat = player.car || player;
      // Vehicles: crewed armour and gunner jeeps engage; the QRF drives at the intruder.
      for (const c of vehicles) {
        if (!c.military || c.hp <= 0) continue;
        // The player's turret traverses in armor.js.
        if (c === player.car) continue;
        if (c.stolen || isAircraft(c)) continue;
        const d = distanceBetween(c, player),
          canEngage = alert && !playerOnRoof() && sameFloor(c, threat),
          gun = c.type === 'tank' || c.gunner;
        if (c.qrf) {
          if (alert && inMilitary(player.x, player.y, 300)) {
            const goal = { x: player.x, y: player.y };
            if (d > 170) {
              c.ai = true;
              c.panicUntil = gameTime + 2;
              c.countyRoute = [goal];
              c.countyIndex = 0;
            } else c.ai = false;
          } else if (!alert && c.ai && !c.patrol) {
            // Stand down: back to the HQ lot.
            c.countyRoute = [c.qrfHome];
            c.countyIndex = 0;
            if (distanceBetween(c, c.qrfHome) < 60) c.ai = false;
          }
        }
        if (!gun || (!c.crewed && !c.gunner)) continue;
        if (canEngage && d < (c.type === 'tank' ? 700 : 480) && clearSight(c, threat)) {
          c.turretA = headingBetween(c, player);
          if (!c.targetAcquired) c.targetAcquired = gameTime + (c.type === 'tank' ? 2.8 : 1.4);
          if (gameTime > c.targetAcquired) {
            if (c.type === 'tank') {
              if (d > 150) tankFire(c, true);
            } else if (gameTime > (c.gunReadyAt || 0)) {
              // Bursts of five.
              c.burst = (c.burst || 0) + 1;
              c.gunReadyAt = gameTime + (c.burst % 5 ? 0.11 : 1.1);
              militaryGunnerFire(c, threat);
            }
          }
        } else {
          c.targetAcquired = 0;
          if (!alert || d > 800) c.turretA = c.a + (c.patrol ? Math.sin(gameTime * 0.4 + c.id) * 0.9 : 0);
        }
      }
      // People.
      const drilling = !alert && drillHours();
      if (drilling) updateDrill(deltaSeconds);
      const hour = (worldMinutes % 1440) / 60,
        rangeOpen = !alert && hour > 8 && hour < 17;
      for (const e of gangMembers) {
        if (!e.military || e.hp <= 0 || personIncapacitated(e)) continue;
        const d = distanceBetween(e, player);
        if (d > 1500) continue;
        e.timer -= deltaSeconds;
        e.walking = false;
        const elevated = !!e.elevated;
        e.aiming =
          alert && d < (elevated ? 650 : 590) && (sameFloor(e, player) || elevated) && !playerOnRoof() && !(isAircraft(player.car) && entityElevation(player.car) > 120);
        if (e.aiming) {
          e.a = headingBetween(e, player);
          if (!e.hold && d > 245 && inMilitary(player.x, player.y, 220)) {
            footStepTowards(e, player, deltaSeconds, 49);
            e.walking = true;
          }
          if (e.timer <= 0 && clearSight(e, threat)) {
            e.timer = 0.55 + seededRandom() * 0.35;
            const a = e.a + randomBetween(-0.055, 0.055),
              v = shotVelocity(e, threat, 680, a);
            bullets.push({
              x: e.x + Math.cos(a) * 15,
              y: e.y + Math.sin(a) * 15,
              altitude: entityElevation(e),
              vx: v.vx,
              vy: v.vy,
              vz: v.vz,
              life: 0.95,
              dmg: 13,
              enemy: true,
              faction: 'military',
              owner: e,
              target: player,
            });
            playSample('automatic', 0.28, 1, e);
            if (city3D) city3D.fire(e.x, e.y, a, false, entityElevation(e));
          }
          continue;
        }
        // Gate guards raise their rifles while challenging someone.
        if (e.role === 'gate' && militaryChallenge.level > 0 && d < 400) {
          e.a = headingBetween(e, player);
          e.aimingOnly = true;
          continue;
        }
        e.aimingOnly = false;
        if (e.role === 'range' && rangeOpen) {
          e.a = 0;
          if (e.timer <= 0 && d < 1100) {
            // Aimed shots at the lane's target; the berm stops them.
            e.timer = 1.1 + seededRandom() * 1.6;
            const r = SENTINEL.range,
              target = { x: r.targetsX, y: r.y + 10 + e.lane * 20 },
              a = headingBetween(e, target) + randomBetween(-0.01, 0.01);
            bullets.push({ x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14, altitude: 0, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.6, dmg: 13, enemy: true, faction: 'military', owner: e, target: null });
            playSample('rifle', 0.16, 1, e);
            if (city3D) city3D.fire(e.x, e.y, a, false, 0);
          }
          continue;
        }
        let goal = null,
          speed = 22;
        if (e.role === 'drill' || e.role === 'sergeant') {
          if (drilling) {
            if (e.role === 'drill') goal = drillSlot(e.slot);
            else {
              const c = Math.cos(militaryDrill.a),
                s = Math.sin(militaryDrill.a);
              goal = { x: militaryDrill.x - 20 * c + 62 * s, y: militaryDrill.y - 20 * s - 62 * c };
              if (gameTime > militaryDrill.callAt && d < 700) {
                militaryDrill.callAt = gameTime + 2.6;
                militaryDrill.step = (militaryDrill.step + 1) % 4;
                militarySpeak(e, gameTime < militaryDrill.pauseUntil ? 'PLATOON... HALT!' : ['LEFT!', 'LEFT! RIGHT!', 'LEFT, RIGHT, LEFT!', 'SOUND OFF!'][militaryDrill.step], 1.6);
              }
            }
            speed = 34;
          } else goal = e.barracksHome;
          if (goal && distanceBetween(e, goal) < 2.5) {
            if (drilling) e.a = militaryDrill.a;
            goal = null;
          }
        } else if (e.route) {
          if (gameTime < (e.pauseUntil || 0)) goal = null;
          else {
            const target = e.route[e.routeIndex],
              t = { x: target.x, y: target.y + (e.offset || 0) };
            if (distanceBetween(e, t) < 6) {
              e.routeIndex = (e.routeIndex + 1) % e.route.length;
              e.pauseUntil = gameTime + 2 + seededRandom() * 4;
            } else goal = t;
          }
        } else if (distanceBetween(e, e.home) > 10) goal = e.home;
        else e.a = e.home.a ?? e.a;
        if (goal) {
          footStepTowards(e, goal, deltaSeconds, Math.min(speed, distanceBetween(e, goal) / Math.max(deltaSeconds, 1e-3)));
          e.walking = true;
        }
      }
      // Casualties are replaced once things are quiet and nobody is looking.
      if (!alert && gameTime > militaryRespawnAt && gameTime - militaryAlarmStartedAt > 120) {
        militaryRespawnAt = gameTime + 20;
        for (const e of gangMembers)
          if (e.military && e.hp <= 0 && distanceBetween(e.home, player) > 900) {
            Object.assign(e, e.home, {
              hp: e.maxhp,
              vest: 110,
              knockedFor: 0,
              dazedFor: 0,
              impactCooldown: 0,
              playerThreatUntil: 0,
              policeThreatUntil: 0,
              aiming: false,
              timer: 1.5,
            });
            if (e.route) e.routeIndex = 1;
          }
      }
    }
    function militaryUI() {
      if (gameMode !== 'play') return;
      if (distanceBetween(player, MILITARY.gate) < 125 && militaryGateClosedToPlayer() && !isAircraft(player.car)) {
        offerPrompt('FORCE THE GATE CONTROLS · ARMED RESPONSE', { id: 'fort-gate' });
      }
      if (player.car?.type === 'tank') {
        getElement('weaponName').textContent = '120 MM TANK CANNON';
        getElement('ammo').textContent = gameTime < (player.car.cannonReadyAt || 0) ? '··' : '01';
        getElement('reserve').textContent = ' / AUTOLOAD';
        getElement('reloadHint').textContent = 'F';
      }
    }
    function drawMilitary2D() {
      for (const b of militaryWalls) {
        if (!visible({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, Math.max(b.w, b.h))) continue;
        worldContext.fillStyle = b.fence ? '#4d5a4b' : b.kind === 'barrier' ? '#b9b6a8' : '#667058';
        worldContext.fillRect(b.x, b.y, b.w, b.h);
      }
      for (const b of militaryGateSolids()) {
        worldContext.fillStyle = b.part === 'slide' ? '#3b4245' : '#d3af5c';
        worldContext.fillRect(b.x, b.y, b.w, b.h);
      }
      if (visible(MILITARY.gate, 300)) {
        worldContext.fillStyle = '#e3c598';
        worldContext.font = 'bold 12px Arial';
        worldContext.fillText('FORT SENTINEL · RESTRICTED', 9120, 8030);
      }
    }
    // Console snapshot of the base's security state (tests and tuning).
    function militaryReport() {
      const people = gangMembers.filter((e) => e.military),
        roles = {};
      for (const e of people) roles[e.role] = (roles[e.role] || 0) + (e.hp > 0 ? 1 : 0);
      return {
        alert: militaryAlertUntil > gameTime,
        lockdown: militaryLockdown(),
        challenge: militaryChallenge.level,
        gate: militaryGateState.map((s) => ({
          arm: +s.arm.toFixed(2),
          bollards: +s.bollards.toFixed(2),
          slide: +s.slide.toFixed(2),
          broken: [s.armBroken && 'arm', s.bollardsBroken && 'bollards', s.slideBroken && 'slide'].filter(Boolean),
        })),
        soldiers: roles,
        aiming: people.filter((e) => e.hp > 0 && e.aiming).length,
        vehicles: vehicles
          .filter((c) => c.military)
          .map((c) => ({ type: c.type, x: Math.round(c.x), y: Math.round(c.y), hp: Math.round(c.hp), ai: !!c.ai, role: c.qrf ? 'qrf' : c.patrol ? 'patrol' : c.supply ? 'supply' : c.crewed ? 'crewed' : 'parked' })),
        supply: militarySupply ? militarySupply.stage : null,
        drill: { x: Math.round(militaryDrill.x), y: Math.round(militaryDrill.y), active: drillHours() && militaryAlertUntil < gameTime },
      };
    }
    // END SUBSYSTEM: src/military.js
