// High Ground's stowed package can be recovered from a stopped, living carrier rather than trapping
// the player in a stranded truck. Preserve its prior ownership and the destroyed-cargo failure path.
import fs from 'node:fs';
import vm from 'node:vm';
export const fresh = true;
export function checkSummitRecovery(t, overrides = {}) {
  const noop = () => {};
  const context = vm.createContext({
    player: { x: 0, y: 0, hp: 100 }, mission: null, gameMode: 'play', gameTime: 10,
    transitRide: null, taxiRide: null, wantedStars: 0,
    UNITS_PER_METRE: 8, KMH: 8 / 3.6, LOOT_CROUCH: 0.8,
    OFFROAD_TYPES: { hilux: true }, VINNY_DEPOT: { door: {}, inside: { x: 100, y: 200 } },
    vehicles: [], pedestrians: [], storyActors: [], failure: null,
    vehicleSpec: () => ({ l: 42, bike: false }), isAircraft: () => false,
    entityElevation: p => p.altitude || 0,
    distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    headingBetween: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
    insideDepot: () => false, keyName: () => 'E',
    missionLine: noop, missionBrief: noop, tell: noop, tone: noop,
    setStage: (stage, target, instruction) => Object.assign(context.mission, { stage, target, instruction }),
    failMission: reason => { context.failure = reason; context.mission = null; },
  });
  const read = name => overrides[name] ?? fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  vm.runInContext(read('vehicle-trunk') + '\n' + read('summitjob'), context);
  const api = vm.runInContext('({ summitRetrieveReady, summitJobInteract, summitCleanup, updateSummitJob })', context);
  const fixture = (prior = false) => {
    Object.assign(context.player, { x: -31, y: 0, car: null, jump: null, thrown: null, swimming: false, altitude: 0 });
    const c = { x: 0, y: 0, a: 0, type: 'hilux', hp: 10, mission: true, vx: 0, vy: 0, speed: 0 };
    context.vehicles = [c]; context.failure = null;
    const m = context.mission = { index: 2, stage: 3, carrier: 'car', carryCar: c, carryCarWasMission: prior, beats: {} };
    return { c, m };
  };
  for (const prior of [false, true]) {
    const { c, m } = fixture(prior);
    t.assert(api.summitRetrieveReady(m) && api.summitJobInteract(), 'rear action did not retrieve live stranded cargo');
    t.assert(m.carrier === 'backpack' && m.carryCar === null && m.stage === 3,
      'recovered cargo did not become a freely carried package');
    t.assert(c.mission === prior && context.vehicles.includes(c), 'recovery changed borrowed vehicle ownership or removed it');
    t.assert(!/GET BACK IN/.test(m.instruction) && m.target === context.VINNY_DEPOT.inside,
      'recovery still sent the player back to the stranded carrier');
    c.hp = 0;
    api.updateSummitJob(m, 0.1);
    t.assert(context.mission === m && context.failure === null, 'old carrier burning after recovery destroyed the backpack package');
    api.summitCleanup();
    t.assert(c.mission === prior, 'later cleanup changed the recovered carrier ownership');
  }
  for (const state of [{ speed: 20 }, { vx: 20 }, { cliffAir: {} }, { hp: 0 }, { altitude: 20 }]) {
    const { c, m } = fixture(); Object.assign(c, state);
    t.assert(!api.summitRetrieveReady(m) && !api.summitJobInteract() && m.carrier === 'car',
      'unsafe carrier allowed recovery: ' + JSON.stringify(state));
  }
  for (const state of [{ jump: { phase: 'air' } }, { thrown: {} }, { swimming: true }, { x: -60 }, { x: 31 }]) {
    const { m } = fixture(); Object.assign(context.player, state);
    t.assert(!api.summitRetrieveReady(m) && !api.summitJobInteract(),
      'airborne, distant or wrong-end player recovered cargo: ' + JSON.stringify(state));
  }
  const { c, m } = fixture(); c.hp = 0;
  api.updateSummitJob(m, 0.1);
  t.assert(context.mission === null && /package burned/.test(context.failure || ''), 'unrecovered destroyed cargo no longer fails');
  t.note('production recovery: stopped low-health carrier → backpack, prior ownership preserved, old vehicle can burn safely afterwards, unsafe/wrong-end recovery denied, unrecovered destruction still fails');
}
export default async function(t) {
  checkSummitRecovery(t);
  await t.call('holdSimulation', true);
  try {
    // Summit position is a fixture; dig, stow, retrieve and board another ride use the actual mission/input paths.
    await t.call('startMission', 2);
    await t.call('teleport', 7738, 1092);
    await t.call('drive', 'hilux', 0, Math.PI);
    await t.call('placeVehicle', 7738, 1092, Math.PI);
    await t.wait(0.5);
    await t.keys('KeyE', 0.2, { real: true });
    await t.call('teleport', 7778, 1084);
    await t.keys('KeyE', 8);
    let m = await t.call('summitJob');
    t.assert(m.stage === 2, 'recovery fixture did not dig the cache');
    const rear = { ...m.target };
    await t.call('teleport', rear.x, rear.y);
    await t.keys('KeyE', 0.2, { real: true }); await t.wait(.2);
    const oldId = (await t.call('missionTargets')).missionVehicles.find(c => c.type === 'hilux')?.id;
    t.assert(oldId !== undefined && (await t.call('summitJob')).carrier === 'car', 'recovery fixture did not stow cargo');
    const prompt = await t.call('promptState');
    t.assert(/RETRIEVE THE PACKAGE/.test(prompt.offered || prompt.text || ''), 'rear recovery prompt absent: ' + JSON.stringify(prompt));
    await t.keys('KeyE', 0.2, { real: true }); await t.wait(.2);
    m = await t.call('summitJob');
    t.assert(m.carrier === 'backpack' && !m.carryCar && m.stage === 3, 'real action did not recover the package: ' + JSON.stringify(m));
    t.assert(!(await t.call('missionTargets')).missionVehicles.some(c => c.id === oldId), 'recovered borrowed truck stayed mission-protected');
    await t.call('burnVehicle', oldId); await t.wait(.2);
    t.assert((await t.call('missionState')).index === 2, 'destroying old carrier after recovery failed the active job');
    await t.call('drive', 'crawler', 0, Math.PI);
    await t.wait(.2);
    t.assert((await t.call('summitJob')).carrier === 'backpack' && (await t.call('status')).vehicle === 'crawler', 'recovered package could not continue in another vehicle');
  } finally { await t.call('holdSimulation', false); }
}
