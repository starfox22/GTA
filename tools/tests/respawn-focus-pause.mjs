// Execute actual death/arrest entry, deferred respawn and pause functions. Losing
// focus during the death screen must not resume an unattended game afterwards.
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../../src/' + file + '.js', import.meta.url), 'utf8');
function functionSource(file, name) {
  const source = read(file), start = source.indexOf('    function ' + name + '(');
  if (start < 0) throw Error('Missing production function ' + name);
  return source.slice(start, source.indexOf('\n    }', start) + 6);
}

export default async function (t) {
  const noop = () => {};
  function fixture(kind, hidden, focused, job) {
    const scheduled = [], resets = [], saves = [], failed = [], elements = new Map();
    function element(id) {
      if (!elements.has(id)) {
        const classes = new Set(['hidden']);
        elements.set(id, { classList: { contains: key => classes.has(key), add: key => classes.add(key),
          remove: key => classes.delete(key) }, focus: noop, replaceChildren: noop, appendChild: noop });
      }
      return elements.get(id);
    }
    const scope = vm.createContext({ Math, gameMode: 'play', cash: 1000, wantedStars: 2,
      gpuContext: { lost: false, reloadPending: false },
      player: { hp: 10, armor: 50, godMode: false, car: null, x: 1, y: 2 },
      weapons: [{ owned: true, reserve: 100, ammo: 12, clip: 12 },
        { owned: true, reserve: 100, ammo: 30, clip: 30 }, { owned: true, melee: true, reserve: 0 }],
      mission: job ? { index: 1, stage: 3 } : null, transitRide: null, taxiRide: null,
      pursuitStats: { arrests: 0 }, arrestProgress: 1, keys: { KeyW: true },
      mouse: { down: true, alt: true }, mapOpen: false, DEMO_BUILD: true, DEMO_MISSIONS: 4,
      completed: 1, missions: [{}, {}, {}, {}],
      document: { hidden, hasFocus: () => focused, body: { classList: { add: noop, remove: noop } },
        createElement: () => ({}) }, canvas: { focus: noop }, getElement: element,
      setTimeout: (callback, milliseconds) => scheduled.push({ callback, milliseconds }),
      announce: noop, noise: noop, tell: noop, goreRestore: noop, fortCoverReset: noop,
      cancelPlayerJump: noop, cancelCarjack: noop, clearPolice: noop, resetOfficerCrews: noop,
      nearestHospital: () => ({ name: 'Clinic', door: { x: 100, y: 200 } }),
      policeRespawnPoint: () => ({ x: 300, y: 400 }),
      isAircraft: () => false, closeSportsbook: noop, syncCarRadio: noop,
      restartableJob: () => null, initAudio: noop, captureChasePointer: noop,
    });
    scope.teleportPlayer = (x, y) => { scope.player.x = x; scope.player.y = y; };
    scope.resetWorld = reason => resets.push(reason);
    scope.save = () => saves.push({ mode: scope.gameMode, cash: scope.cash });
    scope.failMission = reason => { failed.push({ reason, index: scope.mission.index, stage: scope.mission.stage }); scope.mission = null; };
    const api = vm.runInContext(functionSource('game-menus', 'togglePause') + '\n' +
      functionSource('game-player-actions', 'die') + '\n' + functionSource('pursuit-officers', 'bust') +
      '\n({ die, bust })', scope);
    api[kind]();
    return { scope, scheduled, resets, saves, failed };
  }
  for (const kind of ['die', 'bust']) for (const [hidden, focused] of [[false, true], [true, true], [false, false]])
    for (const job of [false, true]) {
      const f = fixture(kind, hidden, focused, job), label = kind + '/' + (hidden ? 'hidden' : focused ? 'focused' : 'blurred') + (job ? '/job' : '');
      t.assert(f.scope.gameMode === 'dead' && f.scheduled.length === 1 && f.scheduled[0].milliseconds === 4200,
        label + ': death/arrest schedule changed');
      f.scheduled[0].callback();
      const paused = hidden || !focused;
      t.assert(f.scope.gameMode === (paused ? 'pause' : 'play'), label + ': unattended respawn resumed live gameplay');
      t.assert(f.scope.cash === (kind === 'die' ? 750 : 600), label + ': hospital bill or fine changed');
      t.assert(f.scope.player.hp === (kind === 'die' ? 100 : 60) && f.scope.player.armor === 0 && f.scope.player.inv === 3,
        label + ': respawn health/armour/invulnerability changed');
      t.assert(f.scope.player.x === (kind === 'die' ? 100 : 300) && f.scope.player.y === (kind === 'die' ? 200 : 400),
        label + ': respawn destination changed');
      t.assert(f.resets.length === 1 && f.resets[0] === (kind === 'die' ? 'wasted' : 'busted'), label + ': world reset changed');
      t.assert(f.failed.length === (job ? 1 : 0) && (!job || (f.failed[0].index === 1 && f.failed[0].stage === 3)),
        label + ': mission failure identity changed');
      if (kind === 'bust') t.assert(f.scope.weapons[0].reserve === 24 && f.scope.weapons[1].reserve === 0 && f.scope.weapons[1].ammo === 10,
        label + ': ammunition confiscation changed');
      if (paused) t.assert(!f.scope.keys.KeyW && !f.scope.mouse.down && !f.scope.mouse.alt, label + ': pause retained held input');
      t.assert(f.saves.length >= 1 && f.saves.every(save => save.cash === f.scope.cash), label + ': final progress was not saved');
    }
  for (const kind of ['die', 'bust']) {
    const f = fixture(kind, true, false, false);
    f.scope.gameMode = 'menu'; // a replaced session must not be revived by its old timeout
    f.scheduled[0].callback();
    t.assert(f.scope.gameMode === 'menu' && f.scope.cash === 1000 && f.resets.length === 0 && f.saves.length === 0,
      kind + ': stale respawn callback changed a replaced session');
  }
  t.note('actual death/arrest callbacks and pause: focused return stays live; hidden/blurred return pauses; timing, costs, ammo, mission identity and world reset preserved');
}
