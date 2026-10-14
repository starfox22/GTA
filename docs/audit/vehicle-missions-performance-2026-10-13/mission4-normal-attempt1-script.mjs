import fs from 'node:fs';
import { request } from './tools/dev.mjs';
const logFile = '/tmp/GTA-mission4-play13.jsonl';
const log = (event, data) => {
  const record = { at: new Date().toISOString(), event, data };
  fs.appendFileSync(logFile, JSON.stringify(record) + '\n');
  console.log(event, JSON.stringify(data));
};
async function op(o) {
  const r = await request(o);
  if (r.error) throw Error(r.error);
  return r.result;
}
const call = (method, ...args) => op({ op: 'call', method, args });
const wait = seconds => op({ op: 'wait', seconds });
const keys = (codes, seconds, real = false) => op({ op: 'keys', codes: [].concat(codes), seconds, real });
const E = () => keys('KeyE', 0.1, true);
async function moveTo(x, y, { inside = false, tolerance = 7, limit = 100 } = {}) {
  let stagnant = 0;
  for (let n = 0; n < limit; n++) {
    const p = await call('status');
    if (p.mode !== 'play' || p.hp <= 0 || p.vehicle) throw Error('foot route interrupted: ' + JSON.stringify(p));
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d <= tolerance) return p;
    const codes = [];
    if (!inside) codes.push('ShiftLeft');
    if (Math.abs(dx) > tolerance / 2) codes.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > tolerance / 2) codes.push(dy > 0 ? 'KeyS' : 'KeyW');
    await keys(codes, d > 30 ? 1.5 : d > 10 ? 0.5 : 0.2);
    const q = await call('status');
    stagnant = Math.hypot(q.x - p.x, q.y - p.y) < 1 ? stagnant + 1 : 0;
    if (stagnant > 4) throw Error('foot route blocked at ' + JSON.stringify({ q, target: { x, y } }));
  }
  throw Error('foot route time limit');
}
async function until(label, predicate, seconds, step = 2) {
  let m = await call('fortJob');
  for (let s = 0; s < seconds && m && !predicate(m); s += step) {
    await wait(step);
    m = await call('fortJob');
  }
  log(label, m);
  if (!m || !predicate(m)) throw Error(label + ' not reached: ' + JSON.stringify(await call('missionState')));
  return m;
}
try {
  await call('holdSimulation', true);
  await call('god', false);
  await call('storyProgress', 3, true);
  await call('viewMode', 'street');
  await call('startMission', 3);
  await call('teleport', -2700, 5150);
  // Prepare the travel car only in the initial fixture, then board it normally after the bag.
  const travelCar = await call('drive', 'sedan', 0, 0);
  await E();
  await call('teleport', -2700, 5150);
  log('setup', { source: 'dist/review-2026-10-13-shipping.html', sha256: '2399af32b917bf9f05be600257742cdea4c64e6454ab45cea57c1efd08b89c11', god: false, initialPlacement: 'Marea wait alternative', priorJobsFixture: 3, parkedTravelCar: { x: travelCar.x, y: travelCar.y, spawned: 'sedan' }, stageSkips: false, pilot: 'named driving console steers through normal update/physics' });
  let m = await until('Kessler entered club', m => m.stage === 3 && m.inside, 240);
  await moveTo(m.target.x, m.target.y);
  if (!(await call('trunkReport')).lockpick.owned) throw Error('Vinny did not provide the lockpick');
  await call('lockpick', true, true); // Equip the tool already supplied by the mission.
  await E(); // Real DOM admission at the lock, then ordinary held-action update steps.
  await keys('KeyE', 5.8);
  await wait(0.3);
  m = await call('fortJob');
  log('trunk worked', m);
  if (!m || m.stage !== 4) throw Error('trunk did not open');
  await E();
  await wait(0.3);
  m = await call('fortJob');
  log('bag taken', m);
  if (!m || m.stage !== 5) throw Error('bag not taken');
  await moveTo(travelCar.x, travelCar.y - 18);
  await E();
  await wait(1.2);
  if (!(await call('status')).vehicle) throw Error('could not board the initial travel car');
  log('boarded initial travel car', await call('status'));
  await wait(4);
  m = await call('fortJob');
  log('changed normally in car', m);
  if (!m || m.stage !== 6) throw Error('change did not finish');
  for (let leg = 0; leg < 5; leg++) {
    const drive = await call('followRoute', 9020, 8182, 120, 70);
    log('road trip to fort ' + leg, drive);
    const p = await call('status');
    if (p.mode !== 'play' || !p.vehicle || !p.mission) throw Error('road trip interrupted: ' + JSON.stringify(p));
    if (Math.hypot(p.x - 9020, p.y - 8182) < 80) break;
    if (leg === 4) throw Error('road trip pilot did not arrive');
  }
  await keys('Space', 2);
  await E();
  await wait(1);
  await moveTo(9236, 8182, { inside: true });
  log('gate approach', { mission: await call('fortJob'), cover: await call('fortCover'), status: await call('status') });
  await E();
  await wait(17);
  m = await call('fortJob');
  log('ID presentation', { mission: m, cover: await call('fortCover') });
  if (!m || m.stage !== 7) throw Error('ID inspection did not clear');
  await moveTo(9340, 8160, { inside: true });
  await moveTo(9884, 8160, { inside: true });
  await moveTo(9884, 8050, { inside: true });
  log('walked records route', { mission: await call('fortJob'), cover: await call('fortCover'), status: await call('status') });
  await E();
  await wait(8);
  m = await call('fortJob');
  log('records searched', { mission: m, cover: await call('fortCover') });
  if (!m || m.stage !== 8) throw Error('records search did not yield papers');
  await moveTo(9884, 8160, { inside: true });
  await moveTo(9340, 8160, { inside: true });
  await moveTo(9150, 8182, { inside: true });
  m = await call('fortJob');
  log('walked out of fort', { mission: m, cover: await call('fortCover'), status: await call('status') });
  if (!m || m.stage !== 9) throw Error('base exit did not begin meeting');
  await moveTo(9020, 8182);
  await E();
  await wait(1);
  if (!(await call('status')).vehicle) throw Error('could not re-enter travel car');
  const target = (await call('skyMeeting', 'report')).target;
  for (let leg = 0; leg < 6; leg++) {
    const drive = await call('followRoute', target.x, target.y + 100, 120, 70);
    log('road trip to Varga ' + leg, drive);
    const p = await call('status');
    if (p.mode !== 'play' || !p.vehicle || !p.mission) throw Error('Varga road trip interrupted: ' + JSON.stringify(p));
    if (Math.hypot(p.x - target.x, p.y - (target.y + 100)) < 90) break;
    if (leg === 5) throw Error('Varga road-trip pilot did not arrive');
  }
  await keys('Space', 2);
  await E();
  await wait(1);
  await moveTo(target.x - 20, target.y + 10);
  const stages = ['waiting'];
  let r;
  for (let i = 0; i < 160; i++) {
    r = await call('skyMeeting', 'report');
    if (stages.at(-1) !== r.stage) stages.push(r.stage);
    if (r.stage === 'done') break;
    await E();
    await wait(0.35);
    if (!(await call('status')).mission && r.stage !== 'done') throw Error('meeting job ended unexpectedly');
  }
  await wait(0.5);
  log('meeting outcome', { stages, meeting: r, mission: await call('missionState'), status: await call('status') });
  if (r.stage !== 'done') throw Error('meeting did not finish through real E key');
  log('errors', await op({ op: 'errors' }));
  log('complete', { god: false, stageSkips: false });
} catch (e) {
  log('stopped', { error: e.message, mission: await call('missionState').catch(() => null), status: await call('status').catch(() => null) });
  process.exitCode = 1;
} finally {
  await call('holdSimulation', true).catch(() => {});
}
