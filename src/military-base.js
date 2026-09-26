    // Fort Sentinel rules: plans, walls, gates, lockdown, solids and alarms (MILITARY, SENTINEL, militaryBlocked, militaryAlarm).
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
        // A military utility truck, 2.2 m body.
        l: 4.6 * UNITS_PER_METRE,
        w: 2.3 * UNITS_PER_METRE,
        modelScale: 0.65,
        topKmh: 110,
        zeroTo: [80, 13],
        brakeG: 0.8,
        cornerG: 1.0,
        tractionG: 0.5,
        turn: 1.9,
        hp: 380,
        mass: 3,
        grip: 7,
        color: '#5c6547',
        militaryModel: 'jeep',
      },
      apc: {
        name: 'SENTINEL LAV-8 ARMORED CARRIER',
        offroad: true,
        // An eight-wheeled armoured carrier.
        l: 6.4 * UNITS_PER_METRE,
        w: 2.6 * UNITS_PER_METRE,
        modelScale: 0.75,
        topKmh: 100,
        zeroTo: [60, 12],
        brakeG: 0.7,
        cornerG: 0.85,
        tractionG: 0.4,
        turn: 1.25,
        hp: 950,
        mass: 11,
        grip: 8,
        color: '#5b6548',
        militaryModel: 'apc',
      },
      armytruck: {
        name: 'SENTINEL M35 CARGO TRUCK',
        offroad: true,
        truck: true,
        // A two-and-a-half-tonne cargo truck.
        l: 6.7 * UNITS_PER_METRE,
        w: 2.45 * UNITS_PER_METRE,
        modelScale: 0.9,
        topKmh: 90,
        zeroTo: [60, 20],
        brakeG: 0.65,
        cornerG: 0.8,
        tractionG: 0.3,
        turn: 1.05,
        hp: 480,
        mass: 7.5,
        grip: 6,
        color: '#58624a',
        militaryModel: 'truck',
      },
    });
    ['jeep', 'apc', 'armytruck'].forEach((type) => roadPerformance(VEHICLE_DEFINITIONS[type]));
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
          filter.connect(gain).connect(sirenBus);
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
