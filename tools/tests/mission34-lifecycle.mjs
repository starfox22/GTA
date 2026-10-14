// Missions 3/4: a borrowed summit carrier survives job cleanup; a destroyed
// Kessler trunk fails while its uniform is still inside; his later death never
// sends an already recovered bag back to TAKE KEYS. The host runs the production
// mission functions, and the browser verifies cleanup/failure against real lists.
import fs from 'node:fs';
import vm from 'node:vm';

export const fresh = true;
export function checkMission34Lifecycle(t, overrides = {}) {
  const noop = () => {};
  const context = vm.createContext({
    player: { x: 1000, y: 1000, hp: 100, car: null, lastShotAt: -100 },
    mission: null, pedestrians: [], storyActors: [], vehicles: [], gameTime: 10,
    wantedStars: 0, UNITS_PER_METRE: 8, KMH: 8 / 3.6,
    OFFROAD_TYPES: { hilux: true }, VINNY_DEPOT: { door: {}, inside: {} },
    vehicleSpec: () => ({ l: 34, bike: false }), isAircraft: () => false,
    insideDepot: () => false, distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    headingBetween: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
    normalizeAngle: a => Math.atan2(Math.sin(a), Math.cos(a)),
    repairVehicle: c => { c.hp = c.maxhp; c.damageVersion++; },
    tone: noop, tell: noop, missionLine: noop, missionBrief: noop, updateUI: noop,
    keyName: () => 'E', trunkPoint: c => ({ x: c.x + 20, y: c.y }),
    trunkPicking: () => false,
    fortCover: { cleared: false, alarmed: false, papers: false, leftWithPapers: false },
    FORT_RECORDS: { door: {} }, FORT_COVER_GATE: { check: { x: 0, y: 0 } },
    inMilitary: () => true, actionHeld: () => false,
    skyMeeting: { stage: 'waiting' }, skyMeetingTarget: () => null,
    failure: null,
    failMission: reason => { context.failure = reason; context.mission = null; },
    setStage: (stage, target, instruction) => Object.assign(context.mission, { stage, target, instruction }),
  });
  const read = name => overrides[name] ?? fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  vm.runInContext(read('summitjob') + '\n' + read('fortjob'), context);
  const api = vm.runInContext('({ summitStow, summitCleanup, updateFortJob })', context);
  for (const prior of [false, true]) {
    const c = { type: 'hilux', mission: prior, hp: 100, x: 1, y: 2 };
    const m = context.mission = { index: 2, stage: 2, beats: {} };
    api.summitStow(m, c);
    t.assert(c.mission === true && m.carrier === 'car' && m.carryCar === c,
      'active package carrier lost mission damage/retirement protection');
    api.summitCleanup();
    t.assert(c.mission === prior, 'summit cleanup changed the carrier\'s previous mission flag: ' + prior);
    api.summitCleanup();
    t.assert(c.mission === prior, 'repeated summit cleanup changed the previous flag: ' + prior);
  }
  const fixture = (stage, bag, hp = 0, kessler = null) => {
    context.failure = null;
    context.pedestrians = kessler ? [kessler] : [];
    return context.mission = {
      index: 3, stage, bag, keys: false, beats: {}, changeProgress: 0, tailHeat: 0, departedAt: 0,
      instruction: stage === 6 ? 'WALK UP TO FORT SENTINEL’S GATE · SHOW YOUR ID' : 'NEXT STEP',
      target: { x: 0, y: 0 }, kcar: { hp, x: 0, y: 0, a: 0, occupied: false, trunkOpen: false },
    };
  };
  for (const stage of [1, 2, 3, 4]) {
    api.updateFortJob(fixture(stage, false), 0.1);
    t.assert(context.mission === null && /uniform and ID/.test(context.failure || ''),
      'destroyed Kessler trunk did not fail before bag recovery: stage ' + stage);
  }
  // Keep the established parade-ground protection against unrelated traffic:
  // pristine-road repair runs before checking the lost uniform, but player
  // damage never gets that exception.
  let pristine = fixture(1, false);
  Object.assign(pristine.kcar, { occupied: true, maxhp: 100, damageVersion: 1 });
  pristine.cleanVersion = 0;
  api.updateFortJob(pristine, 0.1);
  t.assert(context.mission === pristine && pristine.kcar.hp === 100 && context.failure === null,
    'the wreck check removed Kessler\'s established pristine protection from unrelated road damage');
  pristine = fixture(1, false);
  Object.assign(pristine.kcar, { occupied: true, maxhp: 100, damageVersion: 1, lastAttacker: context.player, lastDamagedAt: context.gameTime });
  pristine.cleanVersion = 0;
  api.updateFortJob(pristine, 0.1);
  t.assert(context.mission === null && pristine.kcar.hp === 0 && /uniform and ID/.test(context.failure || ''),
    'a player-caused wreck did not fail with the uniform lost');
  for (const stage of [5, 6, 7, 8, 9]) {
    const m = fixture(stage, true);
    api.updateFortJob(m, 0.1);
    t.assert(context.mission === m && m.stage === stage && context.failure === null,
      'Kessler wreck lost the bag already held by the player: stage ' + stage);
    const dead = { x: 0, y: 0, hp: 0, missionDriver: 'kessler' };
    const withCorpse = fixture(stage, true, 100, dead);
    api.updateFortJob(withCorpse, 0.1);
    t.assert(context.mission === withCorpse && withCorpse.stage === stage && withCorpse.killed,
      'later Kessler death regressed a recovered-bag stage: ' + stage);
  }
  const dead = { x: 0, y: 0, hp: 0, missionDriver: 'kessler' };
  const beforeBag = fixture(2, false, 100, dead);
  api.updateFortJob(beforeBag, 0.1);
  t.assert(beforeBag.stage === 3 && beforeBag.target === dead && /TAKE KESSLER’S KEYS/.test(beforeBag.instruction),
    'Kessler corpse no longer offers the intended keys before the bag is taken');
  for (const stage of [6, 7]) {
    context.fortCover.alarmed = true;
    context.fortCover.papers = false;
    api.updateFortJob(fixture(stage, true, 100), 0.1);
    t.assert(context.mission === null && /cover is blown/.test(context.failure || ''),
      'pre-papers cover alarm left a dead gate/records objective: stage ' + stage);
  }
  context.fortCover.papers = true;
  const escaping = fixture(8, true, 100);
  api.updateFortJob(escaping, 0.1);
  t.assert(context.mission === escaping && escaping.stage === 8 && /COVER BLOWN/.test(escaping.instruction),
    'cover alarm lost the intended escape after papers recovery');
  context.fortCover.alarmed = false;
  let refreshes = 0;
  context.updateUI = () => refreshes++;
  const location = { x: 100, y: 200, altitude: 0 };
  context.skyMeetingTarget = () => ({ ...location });
  const meeting = fixture(9, true, 100);
  for (let i = 0; i < 30; i++) api.updateFortJob(meeting, 1 / 30);
  t.assert(refreshes === 1 && meeting.stage === 9 && meeting.target.x === 100 && meeting.target.y === 200,
    'unchanged meeting snapshots refreshed the HUD every frame: ' + refreshes);
  let beforeRefresh = refreshes;
  location.x += 5;
  api.updateFortJob(meeting, 1 / 30);
  t.assert(refreshes === beforeRefresh + 1 && meeting.target.x === 105, 'a moving diplomat stopped updating his objective');
  beforeRefresh = refreshes;
  location.altitude = 1600;
  api.updateFortJob(meeting, 1 / 30);
  t.assert(refreshes === beforeRefresh + 1 && meeting.target.altitude === 1600, 'roof target height change was missed');
  beforeRefresh = refreshes;
  context.wantedStars = 2;
  api.updateFortJob(meeting, 1 / 30);
  t.assert(refreshes === beforeRefresh + 1 && /LOSE THE POLICE/.test(meeting.instruction), 'wanted-state instruction change was missed');
  t.note('production mission functions: carrier protection restored, pre-bag wreck failure, recovered bag survives wreck/death, corpse keys retained, pre-papers alarm fails and post-papers escape retained');
  t.note('meeting update loop: 30 identical target snapshots cause one HUD refresh; moving x, roof height and wanted text still refresh');
}

export default async function (t) {
  checkMission34Lifecycle(t);
  await t.call('holdSimulation', true);
  try {
    await t.call('god', false);
    // Load the normal public-story frontier for these later jobs. The developer
    // console can start a future job, but a normal retry correctly remains
    // locked on an otherwise fresh save with zero completed jobs.
    await t.call('storyProgress', 3, true);
    // Named summit fixture bypasses the climb, then uses the real held dig key
    // and actual carrier/retry lifecycle. No win or mission stage is injected.
    await t.call('startMission', 2);
    await t.call('teleport', 7738, 1092);
    await t.call('drive', 'hilux', 0, Math.PI);
    await t.call('placeVehicle', 7738, 1092, Math.PI);
    await t.wait(0.5);
    await t.keys('KeyE', 0.2, { real: true });
    await t.wait(0.5);
    await t.call('teleport', 7778, 1084);
    await t.keys('KeyE', 8);
    let m = await t.call('summitJob');
    t.assert(m.stage === 2 && m.carrier === 'hand', 'summit carrier fixture did not reach load stage: ' + JSON.stringify(m));
    await t.call('teleport', m.target.x, m.target.y);
    await t.keys('KeyE', 0.2, { real: true });
    await t.wait(0.5);
    m = await t.call('summitJob');
    t.assert(m.carrier === 'car', 'summit package was not stowed: ' + JSON.stringify(m));
    const carriers = (await t.call('missionTargets')).missionVehicles;
    const id = carriers.find(c => c.type === 'hilux')?.id;
    t.assert(id !== undefined, 'active carrier is not protected as a mission vehicle');
    await t.call('retryMission');
    t.assert((await t.call('damageReport', id))?.type === 'hilux', 'retry removed the pre-existing summit carrier');
    t.assert(!(await t.call('missionTargets')).missionVehicles.some(c => c.id === id), 'retry left the borrowed car mission-protected');

    // A controlled wreck fixture exercises the real failure/save/retry path.
    // It is explicitly not a natural combat playthrough.
    m = await t.call('fortSkip', 'inside');
    await t.call('burnVehicle', m.car.id);
    await t.wait(0.2);
    const failed = await t.call('missionState');
    t.assert(failed.mission === null && failed.last?.result === 'failed' && failed.last.index === 3 && /uniform and ID/.test(failed.last.reason),
      'Kessler wreck did not offer a clear failed-job outcome: ' + JSON.stringify(failed));
    const retry = await t.call('retryMission');
    t.assert(retry.index === 3 && retry.stage === 1, 'destroyed-uniform retry did not restart the job: ' + JSON.stringify(retry));
    // Skip only to the change; stealing a real motor-pool jeep before presenting
    // the ID must fail instead of leaving the permanently invalid cover at gate.
    await t.call('fortSkip', 'changed');
    await t.call('teleport', 9470, 8915);
    await t.keys('KeyE', 0.2, { real: true });
    await t.wait(0.3);
    const alarm = await t.call('missionState');
    t.assert(alarm.mission === null && alarm.last?.result === 'failed' && /cover is blown/.test(alarm.last.reason),
      'alarm before gate clearance left a dead objective: ' + JSON.stringify(alarm));
    t.note('god off; public frontier set to three prior jobs; summit climb bypassed with teleport, real dig/load key and actual retry; named Kessler wreck fixture fails/restarts; real jeep boarding before ID fails the blown-cover job');
  } finally {
    await t.call('holdSimulation', false);
  }
}
