// Actual recovery/pause handlers, live frame dispatch and deferred completions:
// a lost picture must never resume unseen gameplay. Explicit developer steps remain usable.
import fs from 'node:fs';
import vm from 'node:vm';
const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
function functionSource(file, name) {
  const s = read(file), start = s.indexOf('    function ' + name + '(');
  if (start < 0) throw Error('Missing production function ' + name);
  return s.slice(start, s.indexOf('\n    }', start) + 6);
}
function callbackSource(file, name) {
  const s = functionSource(file, name);
  // Fatal vehicle/rider flights now keep their body until it settles, using a
  // named, rescheduled respawn closure. Exercise that production closure and
  // its captured sequence/impact state rather than the removed inline timer.
  if (name === 'die') {
    const capture = s.indexOf('      const deathSequence = '),
      callback = s.indexOf('      const respawn = () => {', capture),
      end = s.indexOf('\n      };', callback);
    if (capture < 0 || callback < capture || end < callback) throw Error('Missing production respawn closure ' + name);
    return s.slice(capture, callback) + s.slice(callback + '      const respawn = () => {'.length, end);
  }
  const start = s.indexOf('setTimeout(() => {') + 'setTimeout(() => {'.length,
    end = s.indexOf('\n      }, 4200)', start);
  if (start < 18 || end < start) throw Error('Missing production respawn callback ' + name);
  return s.slice(start, end);
}
export default async function (t) {
  const loop = read('game-loop'), begin = loop.indexOf('      if (!(DEV_BOOT_SEED && simulationHeld && live)) {'),
    phase = loop.slice(begin, loop.indexOf('      // Everything the frame does before the simulation step', begin)),
    simStart = loop.indexOf('      try {', loop.indexOf('      // The city keeps living behind the title menu')),
    simulation = loop.slice(simStart, loop.indexOf('      syncPanelCover();', simStart)), noop = () => {};
  if (begin < 0 || simStart < 0 || !phase.includes('updateFortRecords')) throw Error('Production frame phases missing');
  function fixture(mode) {
    const counts = { update: 0, world: 0, casino: 0, saves: 0, audio: 0, captures: 0, resets: [] }, elements = new Map();
    function element(id) {
      if (!elements.has(id)) {
        const classes = new Set(['hidden']);
        elements.set(id, { style: {}, classList: { contains: v => classes.has(v), add: v => classes.add(v), remove: v => classes.delete(v) },
          focus: noop, replaceChildren: noop, appendChild: noop });
      }
      return elements.get(id);
    }
    const scope = vm.createContext({ Math, performance, DEV_BOOT_FLAGS: true, DEV_BOOT_SEED: 0,
      simulationHeld: false, gameMode: mode, settingsOrigin: 'pause', frameFaultState: { drill: false },
      document: { hidden: false, hasFocus: () => true, body: { classList: { remove: noop } }, createElement: () => ({}) },
      getElement: element, canvas: { focus: noop }, keys: { KeyW: true }, mouse: { down: true, alt: true },
      player: { hp: 10, armor: 20, godMode: false, car: null, x: 0, y: 0, roof: true, altitude: 80 },
      cash: 1000, fine: 400, mission: null, completed: 0, missions: [{}, {}, {}, {}],
      weapons: [{ owned: true, ammo: 12, reserve: 100, clip: 12 }], DEMO_BUILD: true, DEMO_MISSIONS: 4, mapOpen: false,
      liftTravel: null, skyLift: null, fortRecords: null,
      ROOFTOP: { height: 160, door: { x: 20, y: 30 } }, SKY_LIFT_SECONDS: 2,
      FORT_RECORDS: { seconds: 2, spot: { x: 40, y: 50 } }, FORT_RECORDS_BEATS: [[0, '', '']],
      fortCover: { papers: true, suspicion: 7 },
      clamp: (v, a, b) => Math.max(a, Math.min(b, v)), worldMeters: v => v / 8,
      tell: noop, tone: noop, closeSportsbook: noop, syncCarRadio: noop,
      save: () => counts.saves++, initAudio: () => counts.audio++, captureChasePointer: () => counts.captures++,
      updateWorldView: () => counts.world++, updateCasino: () => counts.casino++,
      update: () => counts.update++, soundUpdate: noop, updateAmbience: noop,
      frameFault: e => { throw e; }, restartableJob: () => null,
      teleportPlayer: noop, rooftopJob: () => null, keyName: () => 'E', missionUpdate: noop, updateUI: noop,
      skyMeetingRideEnd: () => false, skyMeetingRideMoved: noop, fortRecordsSound: noop, fortCoverBlow: noop,
      goreRestore: noop, fortCoverReset: noop, nearestHospital: () => ({ name: 'Clinic', door: { x: 10, y: 20 } }),
      policeRespawnPoint: () => ({ x: 30, y: 40 }), clearPolice: noop, resetOfficerCrews: noop,
      resetWorld: reason => counts.resets.push(reason),
    });
    const api = vm.runInContext(read('gpu-context') + '\n' + functionSource('game-menus', 'togglePause') + '\n' +
      functionSource('story', 'updateElevator') + '\n' + functionSource('skyline-lift', 'updateSkyLift') + '\n' +
      functionSource('fort-cover-records', 'updateFortRecords') + '\n' +
      'function frame(live) { const deltaSeconds = .033;\n' + phase + simulation + '\n}\n' +
      'function finishDie() {\n' + callbackSource('game-player-actions', 'die') + '\n}\n' +
      'function finishBust() {\n' + callbackSource('pursuit-officers', 'bust') + '\n}\n' +
      '({ frame, togglePause, gpuContextLost, gpuContextRestored, finishDie, finishBust, context: gpuContext })', scope);
    return { scope, api, counts };
  }
  {
    const f = fixture('play'); f.api.gpuContextLost();
    t.assert(f.scope.gameMode === 'pause' && f.counts.saves === 1, 'loss did not keep normal pause/save behavior');
    f.api.togglePause();
    t.assert(f.scope.gameMode === 'pause' && f.counts.audio === 0 && f.counts.captures === 0, 'resume was allowed while picture lost');
    f.api.frame(true);
    t.assert(f.counts.update === 0, 'lost live frame dispatched gameplay');
    f.api.gpuContextRestored(); f.api.togglePause();
    t.assert(!f.api.context.lost && f.api.context.reloadPending && f.scope.gameMode === 'pause', 'recovery unpaused before reload');
    f.api.frame(true);
    t.assert(f.counts.update === 0, 'pending reload dispatched live gameplay');
  }
  {
    const f = fixture('pause'); f.api.gpuContextLost(); f.api.gpuContextRestored();
    t.assert(f.scope.gameMode === 'pause' && f.counts.saves === 1, 'already paused recovery changed mode/save behavior');
    f.api.togglePause();
    t.assert(f.scope.gameMode === 'pause' && f.counts.audio === 0 && f.counts.captures === 0, 'pending reload allowed resume from an existing pause');
  }
  {
    const f = fixture('play'); f.api.frame(true);
    t.assert(f.counts.update === 1 && f.scope.gameMode === 'play', 'healthy live simulation no longer advances normally');
  }
  {
    const f = fixture('dead'); f.api.gpuContextLost(); f.api.finishDie(); f.api.gpuContextRestored();
    t.assert(f.scope.gameMode === 'pause' && f.api.context.reloadPending, 'restore left deferred play state unpaused');
    t.assert(f.scope.cash === 750 && f.counts.resets[0] === 'wasted', 'restore changed deferred respawn progress');
  }
  for (const kind of ['roof', 'sky', 'records']) for (const pending of [false, true]) {
    const f = fixture('elevator'), key = kind === 'roof' ? 'liftTravel' : kind === 'sky' ? 'skyLift' : 'fortRecords',
      state = kind === 'roof' ? { up: false, time: 1.69, duration: 1.7 }
        : kind === 'sky' ? { up: false, t: 1.99, moved: true, lift: { floors: 12, downText: 'Street' } }
        : { t: 1.99, step: 0, out: true, followed: false };
    f.scope[key] = state; const time = state.time ?? state.t, label = kind + (pending ? '/reload pending' : '/lost');
    f.api.gpuContextLost(); if (pending) f.api.gpuContextRestored();
    f.api.frame(true);
    t.assert(f.scope[key] === state && (state.time ?? state.t) === time && f.scope.gameMode === 'elevator', label + ': live travel completed into lost picture');
    t.assert(f.counts.update === 0 && f.counts.world === 1 && f.counts.casino === 1, label + ': live dispatch gate changed wrong phases');
    f.api.frame(false);
    t.assert(f.scope[key] === null && f.scope.gameMode === 'play' && f.counts.update === 1, label + ': explicit developer frame no longer advances travel/simulation');
    f.api.frame(true);
    t.assert(f.scope.gameMode === 'pause' && f.counts.update === 1, label + ': live frame failed to catch deliberate stepped play state');
  }
  for (const kind of ['Die', 'Bust']) for (const pending of [false, true]) {
    const f = fixture('dead'), label = kind + (pending ? '/reload pending' : '/lost');
    f.api.gpuContextLost(); if (pending) f.api.gpuContextRestored();
    f.api['finish' + kind](); f.api.frame(true);
    t.assert(f.scope.gameMode === 'pause' && f.counts.update === 0, label + ': deferred respawn resumed unseen gameplay');
    t.assert(f.scope.cash === (kind === 'Die' ? 750 : 600) && f.counts.resets[0] === (kind === 'Die' ? 'wasted' : 'busted'), label + ': respawn cost/reset changed');
  }
  t.note('actual loss/restore/pause + actual frame dispatch and roof/sky/records/respawn completion: lost/pending live progress blocked, prior pause kept, explicit stepping retained');
}
