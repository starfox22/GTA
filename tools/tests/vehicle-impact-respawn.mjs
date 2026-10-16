// Actual launch/body solver plus the production death callback on a virtual
// wall clock: WASTED's 35% slow motion must finish the corpse before hospital.
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
function productionFunction(file, name) {
  const source = read(file), start = source.indexOf('    function ' + name + '(');
  if (start < 0) throw Error('Missing production function ' + name);
  return source.slice(start, source.indexOf('\n    }', start) + 6);
}

export default async function (t) {
  function fixture(kph, hidden = false) {
    let wall = 0, settledAt = null, respawnAt = null;
    const scheduled = [], resets = [], saved = [], classes = new Set(), noop = () => {};
    const scope = vm.createContext({
      UNITS_PER_METRE: 8, GRAVITY: 9.81 * 8, KMH: 8 / 3.6,
      player: { x: 0, y: 0, a: 0, altitude: 0, hp: 10, armor: 50, car: null },
      vehicles: [], gameMode: 'play', gameTime: 0, cash: 1000, mission: null,
      transitRide: null, taxiRide: null, announceTime: 4.6, shake: 0,
      performance: { now: () => wall },
      setTimeout: (callback, milliseconds) => scheduled.push({ callback, at: wall + milliseconds }),
      document: { hidden, hasFocus: () => !hidden, body: { classList: {
        add: c => classes.add(c), remove: c => classes.delete(c),
      } } },
      clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
      randomBetween: (lo, hi) => (lo + hi) / 2,
      wetGrip: () => 0.72, terrainHeight: () => 0, entityElevation: p => p.altitude || 0,
      solid: () => false, footObstacleBlocked: () => false,
      vehicleSpec: () => ({ w: 14.8, l: 38.8, mass: 1.25 }),
      playSample: noop, noise: noop, announce: noop, tell: noop,
      cancelPlayerJump: noop, cancelCarjack: noop, goreRestore: noop, fortCoverReset: noop,
      clearPolice: noop, resetOfficerCrews: noop,
      nearestHospital: () => ({ name: 'Clinic', door: { x: 100, y: 200 } }),
    });
    scope.bodyPool = p => {
      t.assert(p.thrown?.phase === 'down', 'pool formed before the corpse rested');
      p.bloodPool = true;
      settledAt ??= wall;
    };
    scope.teleportPlayer = (x, y) => {
      scope.player.x = x; scope.player.y = y; scope.player.thrown = null;
    };
    scope.resetWorld = reason => { resets.push(reason); respawnAt = wall; };
    scope.save = () => saved.push(scope.cash);
    scope.togglePause = () => { scope.gameMode = 'pause'; };
    const api = vm.runInContext(read('falls-body') + read('riders') +
      productionFunction('physics-knockdowns', 'vehicleImpactState') +
      productionFunction('game-player-actions', 'die') +
      '\n({ launch: vehicleImpactState, die, step: updateThrownPlayer });', scope);
    const begin = speed => {
      if (speed != null) scope.player.thrown = api.launch(scope.player, { x: -20, y: 0, a: 0, type: 'sedan', vx: speed * 8 / 3.6, vy: 0 }, speed * 8 / 3.6);
      api.die();
    };
    begin(kph);
    function advance(target, simulate = true) {
      while (wall < target) {
        const due = scheduled.reduce((at, timer) => Math.min(at, timer.at), Infinity),
          next = Math.min(target, wall + 1000 / 120, due),
          realSeconds = (next - wall) / 1000;
        wall = next;
        scope.announceTime = Math.max(0, scope.announceTime - realSeconds);
        if (simulate && scope.gameMode === 'dead' && scope.player.thrown) {
          scope.gameTime += realSeconds * 0.35;
          api.step(realSeconds * 0.35);
        }
        for (let i = scheduled.length - 1; i >= 0; i--) if (scheduled[i].at <= wall) {
          const [{ callback }] = scheduled.splice(i, 1);
          callback();
        }
      }
    }
    return { scope, resets, saved, scheduled, classes, begin, advance,
      get settledAt() { return settledAt; }, get respawnAt() { return respawnAt; } };
  }

  const trajectories = [];
  for (const kph of [70, 110, 150]) {
    const f = fixture(kph);
    f.advance(4200);
    t.assert(f.scope.gameMode === 'dead' && f.resets.length === 0, kph + ': respawn cut off the slowed impact at 4.2 s');
    f.advance(4600);
    t.assert(f.scope.gameMode === 'dead' && f.classes.has('wasted') && f.scope.announceTime > 0,
      kph + ': WASTED disappeared before the body finished');
    f.advance(16000);
    t.assert(f.settledAt > 4600 && f.respawnAt >= f.settledAt && f.respawnAt - f.settledAt <= 101,
      kph + ': did not return promptly after settling: ' + JSON.stringify({ settledAt: f.settledAt, respawnAt: f.respawnAt }));
    t.assert(f.scope.gameMode === 'play' && f.scope.cash === 750 && f.scope.player.hp === 100 &&
      f.resets.length === 1 && f.resets[0] === 'wasted' && f.saved.length === 1 && !f.classes.has('wasted'),
      kph + ': hospital charged/reset more than once or left the death overlay');
    t.assert(f.scope.player.x === 100 && f.scope.player.y === 200 && f.scope.player.thrown === null,
      kph + ': hospital retained the old flight');
    trajectories.push({ kph, settledSeconds: +(f.settledAt / 1000).toFixed(2), respawnSeconds: +(f.respawnAt / 1000).toFixed(2) });
  }
  // A hidden/stalled page cannot hold a hospital return indefinitely.
  const stuck = fixture(150, true);
  stuck.advance(15900, false);
  t.assert(stuck.scope.gameMode === 'dead' && stuck.resets.length === 0, 'stuck-body cap fired early');
  stuck.advance(16000, false);
  t.assert(stuck.respawnAt === 16000 && stuck.scope.gameMode === 'pause' && stuck.resets.length === 1 &&
    stuck.scope.cash === 750 && !stuck.classes.has('wasted'), '16 s fallback/focus pause failed');

  // A teleport then a new death replaces the specific body the old callback owns.
  const replaced = fixture(110);
  replaced.advance(4600);
  replaced.scope.teleportPlayer(50, 60);
  replaced.scope.gameMode = 'play';
  replaced.begin(70);
  const laterBody = replaced.scope.player.thrown;
  replaced.advance(4800, false);
  t.assert(replaced.scope.gameMode === 'dead' && replaced.scope.player.thrown === laterBody &&
    replaced.classes.has('wasted') && replaced.resets.length === 0 && replaced.scope.cash === 1000,
    'old impact callback changed the later death');
  laterBody.phase = 'down';
  replaced.advance(8800, false);
  t.assert(replaced.respawnAt === 8800 && replaced.resets.length === 1 && replaced.scope.cash === 750,
    'later death did not keep its own timer');

  const canceled = fixture(110);
  canceled.advance(4600);
  canceled.scope.teleportPlayer(50, 60);
  canceled.scope.gameMode = 'play';
  canceled.advance(4800, false);
  t.assert(!canceled.classes.has('wasted') && canceled.resets.length === 0 && canceled.scope.cash === 1000,
    'canceled flight left the death overlay on a restarted game');

  // Ordinary deaths keep their original 4.2 s timer and hospital behavior.
  const ordinary = fixture(null);
  ordinary.advance(4200, false);
  t.assert(ordinary.respawnAt === 4200 && ordinary.scope.gameMode === 'play' && ordinary.scope.cash === 750,
    'non-vehicle death acquired an extended wait');

  const oldOrdinary = fixture(null);
  oldOrdinary.advance(1000, false);
  oldOrdinary.scope.gameMode = 'play';
  oldOrdinary.begin(110);
  const newImpact = oldOrdinary.scope.player.thrown;
  oldOrdinary.advance(4200, false);
  t.assert(oldOrdinary.scope.gameMode === 'dead' && oldOrdinary.scope.player.thrown === newImpact &&
    oldOrdinary.classes.has('wasted') && oldOrdinary.resets.length === 0 && oldOrdinary.scope.cash === 1000,
    'ordinary-death callback changed a later vehicle death');
  newImpact.phase = 'down';
  oldOrdinary.advance(5200, false);
  t.assert(oldOrdinary.respawnAt === 5200 && oldOrdinary.resets.length === 1 && oldOrdinary.scope.cash === 750,
    'vehicle death after an ordinary death lost its timer');
  t.note(JSON.stringify({ slowMotion: 0.35, wetGrip: 0.72, trajectories, hardCapSeconds: 16 }));
}
