import fs from 'node:fs';
import { request } from './tools/dev.mjs';
const logFile = '/tmp/GTA-mission3-play13-attempt2.jsonl';
function log(event, data) { fs.appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), event, data }) + '\n'); console.log(event, JSON.stringify(data)); }
async function op(o) { const r = await request(o); if (r.error) throw Error(r.error); return r.result; }
const call = (method, ...args) => op({ op: 'call', method, args });
const wait = seconds => op({ op: 'wait', seconds });
const keys = (codes, seconds, real = false) => op({ op: 'keys', codes: [].concat(codes), seconds, real });
const E = () => keys('KeyE', 0.1, true);
async function stopCar() {
  for (let n = 0; n < 20; n++) {
    const r = await call('ride');
    if (Math.abs(r.speed) < 2 && Math.hypot(r.vx, r.vy) < 3) return;
    if (r.speed > 2) await keys('KeyS', 0.15);
    else await wait(0.15);
  }
  throw Error('could not stop on the summit platform');
}
async function moveTo(x, y, tolerance = 7) {
  let stagnant = 0;
  for (let n = 0; n < 100; n++) {
    const p = await call('status'), dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (p.mode !== 'play' || p.vehicle || p.hp <= 0) throw Error('foot route interrupted: ' + JSON.stringify(p));
    if (d <= tolerance) return p;
    const codes = ['ShiftLeft'];
    if (Math.abs(dx) > tolerance / 2) codes.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > tolerance / 2) codes.push(dy > 0 ? 'KeyS' : 'KeyW');
    await keys(codes, d > 30 ? 1 : d > 10 ? 0.4 : 0.2);
    const q = await call('status');
    stagnant = Math.hypot(q.x - p.x, q.y - p.y) < 1 ? stagnant + 1 : 0;
    if (stagnant > 4) throw Error('foot route blocked: ' + JSON.stringify({ p: q, target: { x, y } }));
  }
  throw Error('foot route time limit');
}
try {
  await call('holdSimulation', true);
  await call('god', false);
  await call('storyProgress', 2, true);
  await call('viewMode', 'street');
  await call('startMission', 2);
  await call('teleport', 7520, 1950);
  await call('drive', 'crawler');
  await call('hillClimb', 'gate', 0);
  log('setup', { god: false, source: 'dist/review-2026-10-13-shipping.html', sha256: '2399af32b917bf9f05be600257742cdea4c64e6454ab45cea57c1efd08b89c11', initialPlacement: 'trailhead', priorJobsFixture: 2, spawned: 'crawler', stageSkips: false, pilot: 'named trailDrive/followRoute steer through normal update/physics' });
  const climb = await call('trailDrive', 240, 20, 0, 1 / 30);
  log('climbed mountain', { climb, mission: await call('summitJob'), status: await call('status') });
  if (climb.reason !== 'summit') throw Error('trail pilot did not climb to summit');
  // A gentle approach and normal service braking avoid the first attempt's
  // handbrake overshoot. Place the car through actual steering/physics only.
  const parked = await call('steerTo', 7763, 1090, 20, 7, false);
  log('careful platform approach', parked);
  if (parked.reason !== 'arrived') throw Error('could not park on the platform with real steering');
  await stopCar();
  await wait(0.5);
  let m = await call('summitJob');
  if (!m || m.stage !== 1) throw Error('summit arrival not recognized');
  await E();
  await wait(1);
  await moveTo(m.cache.x, m.cache.y);
  await keys('KeyE', 8);
  m = await call('summitJob');
  log('package dug with held key', { mission: m, status: await call('status') });
  if (!m || m.dig !== 1 || m.stage < 2) throw Error('held dig did not recover package');
  if (m.stage === 2) {
    // Getting into the vehicle is the job's normal alternative to loading at
    // its rear bumper. The real key also avoids stepping off the small rock.
    await E();
    await wait(1.2);
    m = await call('summitJob');
    if (m.carrier !== 'car') throw Error('package not loaded');
  }
  if (!(await call('status')).vehicle) {
    // Loading at the bumper consumes E; a second ordinary press boards the car.
    await E();
    await wait(1.2);
  }
  if (!(await call('status')).vehicle) throw Error('could not re-enter summit vehicle');
  log('loaded and boarded', { mission: await call('summitJob'), status: await call('status') });
  const descent = await call('trailDrive', 240, 35, 0, 1 / 30, 'down');
  log('descended mountain', { descent, mission: await call('summitJob'), status: await call('status') });
  if (descent.reason !== 'trailhead') throw Error('descent pilot did not reach trailhead');
  for (let n = 0; n < 6; n++) {
    const trip = await call('followRoute', -1664, 4290, 120, 65);
    log('road trip to Vinny ' + n, trip);
    const p = await call('status');
    if (p.mode !== 'play' || !p.vehicle || !p.mission) throw Error('delivery road trip interrupted: ' + JSON.stringify(p));
    if (Math.hypot(p.x + 1664, p.y - 4290) < 70) break;
    if (n === 5) throw Error('delivery road-trip pilot did not arrive');
  }
  await call('steerTo', -1664, 4460, 30, 15, false);
  await keys('Space', 1);
  await E();
  await wait(1);
  m = await call('summitJob');
  log('warehouse arrival', { mission: m, status: await call('status') });
  if (!m?.vinny || !m.insideDepot) throw Error('warehouse not entered with package');
  await moveTo(m.vinny.x - 15, m.vinny.y - 10);
  await E();
  await wait(7);
  const done = await call('missionState');
  log('outcome', { mission: done, status: await call('status'), errors: await op({ op: 'errors' }) });
  if (done.last?.result !== 'won' || done.last.index !== 2) throw Error('High Ground was not won');
  log('complete', { god: false, stageSkips: false });
} catch (e) {
  log('stopped', { error: e.message, mission: await call('missionState').catch(() => null), status: await call('status').catch(() => null) });
  process.exitCode = 1;
} finally {
  await call('holdSimulation', true).catch(() => {});
}
