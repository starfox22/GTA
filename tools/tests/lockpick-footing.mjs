// Run the real lock selection and pin-progress controller through physical interruptions.
import fs from 'node:fs';
import vm from 'node:vm';

export function checkLockpickFooting(t, source = fs.readFileSync(new URL('../../src/vehicle-trunk.js', import.meta.url), 'utf8')) {
  const interruptions = { jump: { phase: 'air' }, tumble: {}, wading: true, pool: {}, sceneSeat: {},
    thrown: { vehicleHit: true }, fall: {}, swimming: true, climbing: {}, parachute: {}, carjack: {}, coaster: {}, roof: true, buildingRoof: {} };
  for (const kind of ['trunk', 'door']) for (const [state, value] of Object.entries(interruptions)) {
    const noop = () => {}, car = { type: 'sedan', x: 100, y: 100, a: 0, hp: 100, vx: 0, vy: 0, speed: 0,
      locked: true, trunkLoot: kind === 'trunk' ? { label: 'TEST CARGO' } : null },
      player = { x: kind === 'trunk' ? 78.5 : 100, y: kind === 'trunk' ? 100 : 86.6, hp: 100 },
      context = vm.createContext({ KMH: 8 / 3.6, UNITS_PER_METRE: 8, player, vehicles: [car], gameMode: 'play', gameTime: 10,
        transitRide: null, taxiRide: null, officers: [], pedestrians: [], LOOT_CROUCH: 0.8,
        vehicleSpec: () => ({ l: 34, w: 14.8 }), isAircraft: () => false, isBoat: () => false,
        entityElevation: () => 0, hypot2: Math.hypot, withinRange: (_id, d, reach) => d <= reach,
        nearestCar: () => car, vehicleIsLocked: c => c.locked, lockpickEquipped: () => true,
        actionHeld: () => true, normalizeAngle: a => Math.atan2(Math.sin(a), Math.cos(a)),
        lootCrouching: () => (player.lootUntil || 0) > context.gameTime,
        sfxRandom: (a, b) => (a + b) / 2, lockpickRakeSound: noop, lockpickPinSound: noop,
        lockpickLatchSound: noop, trunkSlamSound: noop, tell: noop, crime: noop, witnessReport: noop,
      }),
      api = vm.runInContext(source + '\n({ updateLockpick, lockpickWorking, lockpickInteract, trunkCloseTarget, work: lockpickWork })', context),
      progress = () => car[kind === 'trunk' ? 'trunkPick' : 'lockPick'], label = kind + '/' + state;
    api.updateLockpick(0.4);
    t.near(progress(), 0.399, 0.401, label + ': normal pin work starts');
    t.assert(api.lockpickWorking() === kind && api.work.active, label + ': normal working pose absent');
    const crouchUntil = player.lootUntil;
    player[state] = value;
    context.gameTime += 0.1;
    api.updateLockpick(0.7);
    t.near(progress(), 0.399, 0.401, label + ': interrupted work must preserve progress');
    t.assert(!api.work.active && api.lockpickWorking() === null && !api.lockpickInteract(), label + ': interrupted lock remained active');
    t.assert(player.lootUntil === crouchUntil, label + ': interruption renewed the crouch');
    car.trunkOpen = true;
    t.assert(!api.trunkCloseTarget(), label + ': an ungrounded player can close a trunk');
    car.trunkOpen = false;
    delete player[state];
    api.updateLockpick(0.6);
    t.near(progress(), 0.999, 1.001, label + ': work resumes without losing pins');
    context.gameTime += 11;
    api.updateLockpick(0.2);
    t.near(progress(), 0.199, 0.201, label + ': existing abandoned-work expiry stays intact');
    t.assert(!car.trunkOpen && car.locked, label + ': work opened a lock early');
  }
  t.note('Production trunk/door targeting, pin progression, crouch/hand poses, resume and expiry through 14 physical interruptions.');
}

export default checkLockpickFooting;
