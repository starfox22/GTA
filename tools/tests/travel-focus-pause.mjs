// The production frame phase must not finish lifts/records into live gameplay
// behind a hidden or unfocused tab. Explicit console-stepped frames remain usable.
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
function functionSource(file, name) {
  const source = read(file), start = source.indexOf('    function ' + name + '(');
  return source.slice(start, source.indexOf('\n    }', start) + 6);
}

export default async function (t) {
  const loop = read('game-loop'), begin = loop.indexOf('      if (!(DEV_BOOT_SEED && simulationHeld && live)) {');
  const phase = loop.slice(begin, loop.indexOf('      // Everything the frame does before the simulation step', begin));
  if (begin < 0 || !phase.includes('updateFortRecords')) throw Error('Production frame travel phase missing');
  const noop = () => {};
  function fixture(kind, hidden, focused, seed = 0, held = false) {
    const focus = { value: focused }, counts = { world: 0, casino: 0 };
    const scope = vm.createContext({ Math, DEV_BOOT_SEED: seed, simulationHeld: held,
      gpuContext: { lost: false, reloadPending: false },
      document: { hidden, hasFocus: () => focus.value }, gameMode: 'elevator',
      liftTravel: null, skyLift: null, fortRecords: null, mission: null,
      player: { x: 0, y: 0, roof: true, altitude: 80 },
      clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), worldMeters: v => v / 8,
      ROOFTOP: { height: 160, door: { x: 20, y: 30 } }, SKY_LIFT_SECONDS: 2,
      FORT_RECORDS: { seconds: 2, spot: { x: 40, y: 50 } }, FORT_RECORDS_BEATS: [[0, '', '']],
      fortCover: { papers: true, suspicion: 7 },
      getElement: () => ({ style: {}, classList: { add: noop } }), canvas: { focus: noop },
      updateWorldView: () => counts.world++, updateCasino: () => counts.casino++,
      teleportPlayer: noop, rooftopJob: () => null, keyName: () => 'E',
      tell: noop, missionUpdate: noop, updateUI: noop, tone: noop,
      skyMeetingRideEnd: () => false, skyMeetingRideMoved: noop, fortRecordsSound: noop, fortCoverBlow: noop,
    });
    const stateKey = kind === 'roof' ? 'liftTravel' : kind === 'sky' ? 'skyLift' : 'fortRecords';
    scope[stateKey] = kind === 'roof' ? { up: false, time: 1.69, duration: 1.7 }
      : kind === 'sky' ? { up: false, t: 1.99, moved: true, lift: { floors: 12, downText: 'Street' } }
      : { t: 1.99, step: 0, out: true, followed: false };
    const api = vm.runInContext(functionSource('story', 'updateElevator') + '\n' +
      functionSource('skyline-lift', 'updateSkyLift') + '\n' + functionSource('fort-cover-records', 'updateFortRecords') +
      '\nfunction phase(deltaSeconds, live) {\n' + phase + '\n}\n({ phase })', scope);
    return { scope, focus, counts, stateKey, api };
  }
  for (const kind of ['roof', 'sky', 'records']) for (const [hidden, focused] of [[true, true], [false, false]]) {
    const f = fixture(kind, hidden, focused), state = f.scope[f.stateKey], beforeTime = state.time ?? state.t,
      label = kind + (hidden ? ': hidden' : ': blurred');
    f.api.phase(.033, true);
    t.assert(f.scope.gameMode === 'elevator' && f.scope[f.stateKey] === state, label + ' completed into live gameplay');
    t.assert((state.time ?? state.t) === beforeTime, label + ' travel timer advanced');
    t.assert(f.counts.world === 1 && f.counts.casino === 1, label + ' unrelated frame phase changed');
    f.scope.document.hidden = false; f.focus.value = true;
    f.api.phase(.033, true);
    t.assert(f.scope.gameMode === 'play' && f.scope[f.stateKey] === null, label + ' travel did not resume on return');
  }
  for (const kind of ['roof', 'sky', 'records']) {
    const f = fixture(kind, true, false, 1, true), state = f.scope[f.stateKey];
    f.api.phase(.033, true);
    t.assert(f.scope[f.stateKey] === state && f.counts.world === 0, kind + ': seeded held live frame advanced');
    f.api.phase(.033, false);
    t.assert(f.scope.gameMode === 'play' && f.scope[f.stateKey] === null, kind + ': explicit stepped frame was blocked');
  }
  t.note('actual roof/sky/records completion functions: hidden and blurred live frames freeze; focused return and explicit stepping finish');
}
