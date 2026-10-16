// Actual lethal rider injury, death hand-off, dead-frame update, NPC knockdowns
// and blood pool gate: fatal falls keep momentum and settle before hospital.
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
function fn(file, name) {
  const source = read(file), start = source.indexOf('    function ' + name + '(');
  if (start < 0) throw Error('Missing production function ' + name);
  return source.slice(start, source.indexOf('\n    }', start) + 6);
}

export default async function (t) {
  function fixture(cause = 'crash', npc = false, hp = 1) {
    let wall = 0, deathAt = null, restAt = null, returnAt = null, strikes = 0;
    const timers = [], pools = [], classes = new Set(), noop = () => {},
      player = { x: 0, y: 0, a: 0, altitude: 0, hp, armor: 0, inv: 0, godMode: false, car: null },
      c = { type: 'bike', x: 0, y: 0, a: 0, hp: 130, maxhp: 130, vx: 85 * 8 / 3.6, vy: 0,
        impactVx: 85 * 8 / 3.6, impactVy: 0, av: 1, bikeRoll: 0.28, wheelie: cause === 'loopout' ? 1.25 : 0,
        ai: npc, occupied: true, damage: {} },
      scope = vm.createContext({ player, UNITS_PER_METRE: 8, GRAVITY: 9.81 * 8, KMH: 8 / 3.6, TAU: 2 * Math.PI,
        gameMode: 'play', gameTime: 0, cash: 1000, mission: null, transitRide: null, taxiRide: null, shake: 0, flash: 0,
        announceTime: 4.6, uiTime: 0, particles: [], skids: [], debris: [], vehicles: [], pedestrians: [],
        bloodOn: true, bloodPools: pools, DRIVER_COLORS: ['#777777'],
        performance: { now: () => wall }, setTimeout: (callback, delay) => timers.push({ callback, at: wall + delay }),
        document: { hidden: false, hasFocus: () => true, body: { classList: { add: key => classes.add(key), remove: key => classes.delete(key) } } },
        clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), normalizeAngle: a => Math.atan2(Math.sin(a), Math.cos(a)),
        randomBetween: (lo, hi) => (lo + hi) / 2, randomChoice: list => list[0], goreBetween: () => 0,
        entityElevation: p => p.altitude || 0, terrainHeight: () => 0, wetGrip: () => 0.72,
        vehicleSpec: () => ({ bike: true, l: 16.8, w: 5.6, mass: 0.23, hp: 130 }),
        solid: () => false, footObstacleBlocked: () => false, sportsbookShelters: () => false,
        ballisticDamage: (p, amount) => amount, bloodSurface: () => 0, rooftopFloor: () => false,
        playSample: noop, tell: noop, noise: noop, announce: noop, scream: noop,
        cancelPlayerJump: noop, cancelCarjack: noop, goreRestore: noop, fortCoverReset: noop,
        clearPolice: noop, resetOfficerCrews: noop, save: noop, togglePause: noop,
        nearestHospital: () => ({ name: 'Clinic', door: { x: 100, y: 200 } }),
        updateRideSkip: noop, updateWheelieScore: noop, updateSeaLife: noop, updateCameraFollow: noop,
        updateFlightHud: noop, updateUI: noop, timed: noop, stepDying: noop,
        stepEjection: () => { throw Error('ordinary rider was stepped twice through legacy ejection'); },
        goreHit: () => ({ zone: 'torso', fatal: false }), pickHitZone: () => 'torso', vestStoppedShare: 0, VEST_STOPPED: 0.8,
        woundPerson: p => { if (p.hp <= 0) p.deathStyle = { sign: 1, turn: 0 }; },
        recordKill: () => { throw Error('self-caused rider fall awarded a player kill'); },
        impactContacts: new Map(), physicsClock: 0, crowdCrash: noop, noteDriverCrash: noop,
        crashSeverity: () => 0, damageVehicle: noop, crumpleWreck: noop, structureImpact: noop,
        distanceBetween: () => 1000, crashSound: noop, kickCamera: noop, radio: noop, crime: noop,
        aircraftImpact: noop, wantedStars: 0, RECKLESS_CRASH_SPEED: 1000, pursuitStats: { contacts: 0, pits: 0 },
      });
    scope.addBloodPool = (x, y, r, a, properties) => {
      const p = npc ? scope.pedestrians.at(-1) : player, state = npc ? p.ejected : p.thrown;
      t.assert(!state || state.phase === 'down', 'a fatal rider pooled before settling');
      const pool = { x, y, r, ...properties }; pools.push(pool); restAt ??= wall; return pool;
    };
    scope.teleportPlayer = (x, y) => { player.x = x; player.y = y; player.thrown = null; };
    scope.resetWorld = () => { returnAt = wall; };
    scope.bleed = (p, amount, a, kind) => { if (p.hp <= 0) api.bodyPool(p, kind, a); };
    const blood = read('blood'), constants = blood.slice(blood.indexOf('    const BLOOD_POOL_ROUND ='), blood.indexOf('    function bodyPoolPlan(')),
      api = vm.runInContext(read('falls-body') + read('riders') + constants + fn('blood', 'bodyPoolPlan') + fn('blood', 'bodyPool') +
        fn('game-player-actions', 'hurt') + fn('game-player-actions', 'die') + fn('game-update', 'update') +
        fn('physics-knockdowns', 'updateKnockdown') + fn('citylife-civic', 'strikePerson') +
        fn('physics-collisions', 'crashInjury') + fn('physics-collisions', 'crashDeltaV') + fn('physics-collisions', 'collisionImpact') + `
        ({ launch: throwRider, step: updateThrownPlayer, update, knockdown: updateKnockdown,
           bodyPool, hurt, die, collisionImpact, strikePerson });`, scope);
    scope.strikePerson = (...args) => { strikes++; return api.strikePerson(...args); };
    if (cause) {
      player.car = npc ? null : c;
      api.launch(c, c.vx, c.vy, cause);
      if (npc) scope.pedestrians.at(-1).hp = hp;
    }
    const person = npc ? scope.pedestrians.at(-1) : player;
    function advance(target, simulate = true) {
      while (wall < target) {
        const due = timers.reduce((at, timer) => Math.min(at, timer.at), Infinity),
          next = Math.min(target, wall + 1000 / 120, due), realSeconds = (next - wall) / 1000;
        wall = next;
        scope.announceTime = Math.max(0, scope.announceTime - realSeconds);
        if (simulate && npc) { scope.gameTime += realSeconds; api.knockdown(person, realSeconds); }
        else if (simulate && scope.gameMode === 'dead') api.update(realSeconds * 0.35);
        else if (simulate && scope.gameMode === 'play' && player.thrown) { scope.gameTime += realSeconds; api.step(realSeconds); }
        if (person.hp <= 0 && deathAt === null) deathAt = wall;
        for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= wall) {
          const [{ callback }] = timers.splice(i, 1); callback();
        }
      }
    }
    return { scope, api, player, person, c, pools, timers, classes, advance,
      get deathAt() { return deathAt; }, get restAt() { return restAt; }, get returnAt() { return returnAt; }, get strikes() { return strikes; } };
  }
  const measurements = [];
  for (const npc of [false, true]) for (const cause of ['lowside', 'loopout', 'crash', 'landing']) {
    const f = fixture(cause, npc), state = npc ? f.person.ejected : f.person.thrown;
    for (let i = 1; i <= 300 && f.person.hp > 0; i++) f.advance(i * 10);
    t.assert(f.person.hp <= 0 && (npc ? f.person.ejected : f.player.thrown) === state,
      cause + ': death discarded the live flight state');
    t.assert(f.pools.length === 0 && state.phase !== 'down' && state.phase !== 'recover', cause + ': fatal contact skipped the flight/slide');
    const atDeath = { x: f.person.x, y: f.person.y }, deathWall = f.deathAt;
    f.advance(deathWall + 300);
    t.assert(Math.hypot(f.person.x - atDeath.x, f.person.y - atDeath.y) > 1,
      cause + ': fatal rider froze after death');
    f.advance(16000);
    t.assert(f.pools.length === 1 && f.restAt > deathWall, cause + ': corpse did not form one pool at rest');
    if (npc) {
      t.assert(f.person.ejected === state && state.phase === 'down' && state.recovery === 0 && f.strikes === 1 && f.person.killedBy === null,
        cause + ': NPC corpse recovered, lost its pose or repeated its lethal hit');
      const rest = { x: f.person.x, y: f.person.y };
      f.advance(18000);
      t.assert(f.person.x === rest.x && f.person.y === rest.y && f.pools.length === 1, cause + ': rested corpse/pool moved');
    } else {
      t.assert(f.returnAt >= Math.max(f.restAt, deathWall + 4200) - 10 && f.returnAt <= Math.max(f.restAt, deathWall + 4200) + 101,
        cause + ': hospital ignored the original deadline or settling');
      t.assert(f.scope.gameMode === 'play' && !f.player.thrown && f.scope.cash === 750 && f.player.hp === 100 && !f.classes.has('wasted'),
        cause + ': rider hospital cleanup/cost changed');
    }
    measurements.push({ who: npc ? 'npc' : 'player', cause, deadAt: +(deathWall / 1000).toFixed(2), restedAt: +(f.restAt / 1000).toFixed(2) });
  }
  // An initial lethal 200 km/h crash must release before die() removes the
  // rider's seat. Exercise the actual collision function and original injury.
  const initial = fixture(null, false, 100);
  initial.player.car = initial.c;
  initial.c.impactVx = initial.c.vx = 200 * 8 / 3.6;
  initial.api.collisionImpact(initial.c, null, { x: 0, y: 0, n: { x: 1, y: 0 } }, 200 * 8 / 3.6, 'fatal-wall');
  t.assert(initial.scope.gameMode === 'dead' && initial.player.thrown?.riderFall && initial.player.car === null && initial.pools.length === 0,
    'lethal initial crash removed the saddle before releasing the rider');

  // Fatal damage during recovery releases support and falls again; it cannot
  // stand the corpse or leave a permanent recover-phase hospital wait.
  const recovering = fixture('lowside', false, 1000);
  for (let i = 1; i <= 1200 && recovering.player.thrown?.phase !== 'recover'; i++) recovering.advance(i * 10);
  const collapse = recovering.player.thrown;
  t.assert(collapse?.phase === 'recover', 'recovery fixture unavailable');
  recovering.api.hurt(2000, 'fall');
  recovering.advance(recovering.scope.performance.now() + 1000);
  t.assert(collapse.phase === 'down' && collapse.recovery === 0 && recovering.pools.length === 1,
    'fatal recovery finished standing instead of collapsing');

  const stuck = fixture('loopout');
  stuck.api.hurt(1000, 'fall');
  stuck.advance(15900, false);
  t.assert(stuck.scope.gameMode === 'dead' && stuck.returnAt === null, 'rider fallback fired before 16 s');
  stuck.advance(16000, false);
  t.assert(stuck.returnAt === 16000 && !stuck.player.thrown && stuck.scope.cash === 750, 'rider fallback did not share the 16 s bound');

  const replaced = fixture('loopout');
  replaced.api.hurt(1000, 'fall');
  replaced.advance(1000, false);
  replaced.scope.teleportPlayer(0, 0);
  replaced.scope.gameMode = 'play';
  replaced.player.hp = 100;
  replaced.player.car = replaced.c;
  replaced.api.launch(replaced.c, replaced.c.vx, replaced.c.vy, 'lowside');
  const later = replaced.player.thrown;
  replaced.api.hurt(1000, 'fall');
  later.phase = 'down';
  replaced.advance(4200, false);
  t.assert(replaced.scope.gameMode === 'dead' && replaced.player.thrown === later && replaced.classes.has('wasted') && replaced.scope.cash === 1000,
    'stale rider timer changed a later death or removed its screen');
  replaced.advance(5200, false);
  t.assert(replaced.returnAt === 5200 && replaced.scope.cash === 750, 'replacement rider death lost its own hospital timer');

  const ordinary = fixture(null);
  ordinary.api.hurt(1000, 'fall');
  ordinary.advance(4200, false);
  t.assert(ordinary.returnAt === 4200 && ordinary.scope.cash === 750, 'ordinary non-rider death acquired a delayed hospital return');
  t.note(JSON.stringify({ measurements, originalHospitalMs: 4200, hardCapMs: 16000 }));
}
