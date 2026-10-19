// Production Fort Sentinel cover, movement, bindings, sight cones and HUD writes.
// The site is an empty, dry, level lane; explicit walls still use real sight/collision tests.
import fs from 'node:fs';
import vm from 'node:vm';

function fortHost(overrides) {
  const read = name => overrides[name] ?? fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  const fn = (file, name) => {
    const source = read(file), start = source.indexOf('    function ' + name + '(');
    if (start < 0) throw Error('Missing production function ' + name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
  };
  const noop = () => {}, empty = () => false, list = () => [], elements = new Map();
  const element = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: '', style: {}, classList: {
        contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name),
        toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
      } });
    }
    return elements.get(id);
  };
  const c = vm.createContext({
    Math, Set, Map, KMH: 8 / 3.6, UNITS_PER_METRE: 8, CITY_SIZE: 10000,
    gameTime: 10, gameMode: 'play', player: { x: 9450, y: 8470, a: 0, hp: 100 },
    keys: {}, mouse: { active: false, down: false }, touchAim: null, reloadSecondsRemaining: 0,
    selectedWeaponIndex: 8, FISTS_INDEX: 8, wantedStars: 0,
    gangMembers: [], vehicles: [], buildings: [], LINERS: [], transitRide: null, taxiRide: null,
    militaryAlertUntil: 0, militaryLockdownUntil: 0, militaryAlarmStartedAt: -100,
    militaryChallenge: { level: 0 }, searchActive: false, searchRemaining: 0, lastSeen: null,
    countyStaticSolids: [], AIRPORT_SCENERY_SOLIDS: [],
    jumpLow: { on: false },
    localStorage: { getItem: () => null, setItem: noop },
    // Empty-site fixtures only. Movement, gait, binding translation, cones and wall
    // rays execute production functions; none of these stubs chooses suspicion.
    groundAt: () => true, terrainHeight: () => 0, entityElevation: () => 0,
    footObstacleBlocked: empty, shoreStepBlocked: empty, drawbridgeFootBlocked: empty,
    sportsBlocked: empty, railBlocked: empty, parkPondBlocked: empty, airportSceneryBlocked: empty,
    garageBlocked: empty, parkBlocked: empty, monarchBlocked: empty, northPointKeyBlocked: empty,
    marinaBlocked: empty, beachBlocked: empty, promenadeRailBlocked: empty, streetEndBlocked: empty,
    beachClubBlocked: empty, harborBlocked: empty, depotBlocked: empty, countyBlocked: empty, militaryBlocked: empty,
    garageWalls: list, garageDoorSolids: list, militarySolids: list, depotSolids: list, harborSolids: list,
    airCoverRay: empty, playerOnRoof: empty, isAircraft: empty, roofPartyPace: empty,
    chaseCameraLive: empty, deviceKeyName: () => null, hintDevice: () => 'keyboard',
    personIncapacitated: p => !!p.knockedFor,
    // Bounded post-alarm/audio/prompt effects; production militaryAlarm and
    // fortCoverBlow still decide/record the real alarm, lockdown and cause.
    announce: noop, tell: noop, crime: noop, militarySpeak: noop, offerPrompt: noop,
    drawWeapon: noop, noise: noop, tone: noop, foldMissionBrief: noop,
    mission: null, getElement: element, policeSearchSeconds: () => 30,
    setWantedLevel: value => { c.wantedStars = value; },
  });
  const state = read('game-state'), collision = read('game-collision'), base = read('military-base');
  vm.runInContext(state.slice(state.indexOf('    const clamp ='), state.indexOf('    let viewportWidth')), c);
  vm.runInContext(fn('game-state', 'hypot2') + '\n' + fn('roofmission-stealth', 'turnToward'), c);
  vm.runInContext('const promptRanges = new Map();\n' + fn('hud-state', 'withinRange'), c);
  vm.runInContext(read('controls') + '\n' + read('footwork'), c);
  vm.runInContext(state.slice(state.indexOf('    const FOOT_WALK ='), state.indexOf('    /* Math.hypot(x, y)')), c);
  vm.runInContext(base.slice(base.indexOf('    const MILITARY ='), base.indexOf('    /* ---- The plan')) +
    '\nconst SENTINEL = {gate: {armX:9272}};\n' + fn('military-base', 'inMilitary') + '\n' + fn('military-base', 'militaryAlarm'), c);
  vm.runInContext('const BUILDING_CELL = 256, buildingGrid = new Map(), noBuildings = [];\n' +
    ['buildBuildingGrid', 'buildingsNear', 'solid'].map(name => fn('game-collision', name)).join('\n') + '\n' +
    collision.slice(collision.indexOf('    const VEHICLE_CELL'), collision.indexOf('    /* solid() for a foot step.')) + '\n' +
    ['footSolid', 'footFurnitureBlocked', 'footStepBlocked', 'moveBody'].map(name => fn('game-collision', name)).join('\n'), c);
  vm.runInContext('let sightStamp = 0;\n' + fn('citylife-police', 'sightBlockedBy') + '\n' + fn('citylife-police', 'clearSight') + '\n' +
    fn('vehicle-trunk', 'lockpickFooting') + '\n' + fn('fortjob', 'fortOnFoot') + '\n' +
    read('fort-cover') + '\n' + read('fort-cover-watch') + '\n' + read('fort-cover-records'), c);
  const api = vm.runInContext(`({
    cover: fortCover, begin: fortCoverBegin, end: fortCoverEnd, reset: fortCoverReset,
    running: () => typeof fortCoverRunning === 'function' ? fortCoverRunning() : null,
    ui: fortCoverUI, watch: updateFortWatch, update: updateFortCover,
    board: fortCoverBoarded, sees: fortSoldierSees, shielded: fortCoverShielded, ownsGate: fortCoverOwnsGate,
    bind: bindControl, keyName, buildBuildingGrid,
    physical(codes) {
      keys = {}; releaseAllControlKeys();
      for (const code of codes) holdActions(pressControlKey(code));
    },
    move(dt) {
      const a = playerMoveHeading();
      if (a !== null) moveBody(player, Math.cos(a) * footPace() * dt, Math.sin(a) * footPace() * dt, 5);
    },
    pace: footPace,
    start(watchers = 1, role = 'post') {
      gameTime = 10; gameMode = 'play'; militaryAlertUntil = militaryLockdownUntil = 0;
      wantedStars = 0; selectedWeaponIndex = FISTS_INDEX;
      Object.keys(player).forEach(k => delete player[k]);
      Object.assign(player, {x:9450,y:8470,a:0,hp:100});
      vehicles.splice(0); buildings.splice(0); buildBuildingGrid(); gangMembers.splice(0);
      keys = {}; releaseAllControlKeys(); resetControlBindings();
      for (let i = 0; i < watchers; i++) gangMembers.push({
        x:9750,y:8470 + (i - (watchers - 1) / 2) * 2,a:Math.PI,hp:100,military:true,role,
      });
      wearUniform(true); fortCoverBegin(); fortCover.cleared = true;
      updateFortCover(0);
    }
  })`, c);
  const step = (seconds, codes, hz = 60) => {
    api.physical(codes);
    const count = Math.round(seconds * hz), dt = seconds / count;
    for (let i = 0; i < count; i++) {
      api.move(dt); c.gameTime += dt; api.update(dt);
    }
    return api.cover;
  };
  return { c, api, step, element };
}

export function checkFortRunningSuspicion(t, overrides = {}) {
  const { c, api, step, element } = fortHost(overrides), results = [];
  const near = (actual, expected, label, tolerance = 1e-7) => t.assert(Math.abs(actual - expected) < tolerance,
    label + ': ' + actual + ' versus ' + expected);
  for (const hz of [30, 60]) for (const witnesses of [1, 24]) {
    api.start(witnesses);
    api.physical(['KeyD']);
    near(api.pace() / c.KMH, 5.4, 'unmodified movement walks under cover');
    api.physical(['KeyD', 'ShiftLeft']);
    near(api.pace() / c.KMH, 25, 'physical Shift maps to the running action');
    step(2, ['KeyD', 'ShiftLeft'], hz);
    const suspicion = api.cover.suspicion;
    t.assert(suspicion > 35 && suspicion < 40 && !api.cover.alarmed, 'brief observed run lost cover: ' + JSON.stringify(api.cover));
    near(api.cover.rate, 20, 'running pressure independent of crowd/step rate');
    t.assert(api.cover.seen === witnesses && api.shielded(), 'watchers or disguise shield missing');
    api.ui();
    t.assert(element('stealthLabel').textContent.includes('SUSPICION RISING'), 'running label missing');
    t.assert(/WALK WITHIN [1-5]s/.test(element('stealthHint').textContent) && element('stealthHint').textContent.includes('SHIFT'), 'running deadline/key missing');
    near(parseFloat(element('stealthFill').style.width), Math.round(suspicion), 'HUD fill follows actual suspicion');
    step(1, ['KeyA'], hz);
    near(api.cover.suspicion, suspicion - 12, 'visible walking must lower suspicion');
    t.assert(api.cover.seen === witnesses && !api.cover.alarmed, 'safe walk lost sight or cover');
    api.ui();
    t.assert(element('stealthLabel').textContent.includes('FADING'), 'walking recovery label missing');
    step(3, [], hz);
    near(api.cover.suspicion, 0, 'ordinary standing finishes recovery');
    results.push({ hz, witnesses, suspicion });
  }
  near(results[0].suspicion, results[1].suspicion, 'one and many witnesses same grace');
  near(results[2].suspicion, results[3].suspicion, '60 Hz one and many witnesses same grace');
  t.assert(Math.abs(results[0].suspicion - results[2].suspicion) < 1, '30/60 Hz grace differs by over one frame');

  for (const hz of [30, 60]) {
    api.start();
    step(4.9, ['KeyD', 'ShiftLeft'], hz);
    t.assert(api.cover.suspicion < 100 && !api.cover.alarmed, 'fresh run exposed before five seconds');
    step(.2, ['KeyD', 'ShiftLeft'], hz);
    t.assert(api.cover.alarmed && api.cover.blownBy === 'running' && c.militaryAlertUntil > c.gameTime, 'sustained observed run never exposed');
  }
  api.start(24);
  for (let i = 0; i < 6; i++) {
    step(.5, ['KeyD', 'ShiftLeft']);
    t.assert(api.cover.suspicion > 0 && !api.cover.alarmed, 'short run skipped warning');
    step(1, ['KeyA']);
    near(api.cover.suspicion, 0, 'separate brief runs recover rather than accumulate forever');
  }

  for (const release of [['KeyD'], [], ['ShiftLeft']]) {
    api.start(); step(1, ['KeyD', 'ShiftLeft']); api.cover.suspicion = 99;
    api.physical(release);
    t.assert(api.cover.speed > 9 * c.KMH && !api.running(), 'released intent must override stale smoothed speed');
    step(1 / 60, release);
    t.assert(api.cover.suspicion < 99 && !api.cover.alarmed, 'releasing just before full still blew cover');
  }
  api.start(); step(1, ['ShiftLeft']);
  t.assert(!api.running() && api.cover.suspicion === 0, 'stationary RUN key created suspicion');
  api.start();
  c.buildings.push({ x: c.player.x + 20, y: c.player.y - 10, w: 10, h: 20, height: 8 });
  api.buildBuildingGrid(); step(2, ['KeyD', 'ShiftLeft']);
  t.assert(c.player.x <= 9465 && !api.running() && api.cover.suspicion === 0,
    'holding RUN against a real collision counted as continued running');
  api.start(); api.bind('walk', 0, 'KeyC'); step(1, ['KeyD', 'KeyC']);
  t.assert(api.running() && api.cover.suspicion > 10, 'remapped running action ignored');
  api.ui(); t.assert(element('stealthHint').textContent.includes('RELEASE C'), 'HUD ignored remapped RUN key');
  step(1, ['KeyA']); t.assert(!api.running(), 'remapped RUN release was ignored');

  for (const hidden of ['behind-cone', 'outside-range', 'wall', 'incapacitated']) {
    api.start();
    if (hidden === 'behind-cone') c.gangMembers[0].a = 0;
    if (hidden === 'outside-range') c.gangMembers[0].x = 10300;
    if (hidden === 'wall') {
      c.buildings.push({ x: 9660, y: 8420, w: 10, h: 100, height: 50 }); api.buildBuildingGrid();
    }
    if (hidden === 'incapacitated') c.gangMembers[0].knockedFor = 5;
    step(1.5, ['KeyD', 'ShiftLeft']);
    t.assert(api.cover.suspicion === 0 && !api.cover.alarmed && api.cover.seen === 0, hidden + ': unseen run counted');
  }
  api.start(24, 'drill'); step(2, ['KeyD', 'ShiftLeft']);
  near(api.cover.rate, 10, 'drill platoon half notices once');
  t.assert(api.cover.suspicion > 17 && api.cover.suspicion < 20, 'drill grace not longer');
  c.gangMembers.push({ x: 9750, y: 8470, a: Math.PI, hp: 100, military: true, role: 'post' });
  step(.1, ['KeyD', 'ShiftLeft']); near(api.cover.rate, 20, 'ordinary watcher restores ordinary pressure');

  for (const offence of ['climbing', 'restricted', 'loitering']) {
    for (const witnesses of [1, 4]) {
      api.start(witnesses);
      if (offence === 'climbing') c.player.climbing = {};
      if (offence === 'restricted') { c.player.x = 10050; c.player.y = 8820; }
      if (offence === 'loitering') c.gangMembers.forEach((g, i) => { g.x = c.player.x + 20; g.y = c.player.y + i; g.coverFace = 3.1; });
      if (offence === 'restricted') c.gangMembers.forEach(g => { g.x = c.player.x + 100; g.y = c.player.y; });
      step(.1, []);
      const base = offence === 'climbing' ? 25 : offence === 'loitering' ? 14 : 6 + 6 * (1 - 100 / 420);
      near(api.cover.rate, base * (1 + .3 * (witnesses - 1)), offence + ': original witness aggregation');
      t.assert(api.cover.suspicion > 0 && api.cover.reason === offence, offence + ': suspicious action now decays');
    }
  }
  api.start(); c.player.climbing = {}; step(1, ['KeyD', 'ShiftLeft']);
  near(api.cover.rate, 45, 'running does not erase climbing pressure');

  for (const offence of ['weapon', 'attack', 'gunfire', 'vehicle']) {
    api.start();
    if (offence === 'weapon') c.selectedWeaponIndex = 0;
    if (offence === 'attack') c.player.lastStrikeAt = c.gameTime;
    if (offence === 'gunfire') { c.player.lastShotAt = c.gameTime; c.gangMembers[0].a = 0; }
    if (offence === 'vehicle') api.board({ military: true, x: c.player.x, y: c.player.y });
    else step(1 / 60, []);
    t.assert(api.cover.alarmed && api.cover.blownBy === offence && api.cover.suspicion === 100,
      offence + ': serious offence lost immediate alarm');
    t.assert(c.militaryAlertUntil > c.gameTime, offence + ': no base alarm');
  }

  api.start(); step(1, ['KeyD', 'ShiftLeft']);
  const before = api.cover.suspicion;
  api.update(0); near(api.cover.suspicion, before, 'zero elapsed time cannot age suspicion');
  api.end(); step(1, ['KeyD', 'ShiftLeft']);
  near(api.cover.suspicion, before, 'ended cover does not keep watching');
  api.begin();
  t.assert(api.cover.suspicion === 0 && api.cover.speed === 0 && api.cover.lastSpot === null && !api.cover.alarmed,
    'begin did not clear previous pressure/history');
  t.assert(c.gangMembers.every(g => !g.coverSees && g.coverFace === 0), 'begin left stale watching/face timers');
  api.reset(); t.assert(!api.cover.active && c.player.uniform === null, 'reset left cover/uniform active');
  t.note('Real cover/gait/bindings/moveBody/sight cones and wall rays: bounded observed run, visible recovery, late release, repeated bursts, drill attention, original other offences and immediate serious alarms. HUD writes tested without claiming native layout.');
}

export default function (t) { checkFortRunningSuspicion(t); }
