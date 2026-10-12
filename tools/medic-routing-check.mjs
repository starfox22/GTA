// Browser-free regression fixtures for the actual ambulance route planner and emergency controls.
// node tools/medic-routing-check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function sourceFunction(file, name) {
  const text = fs.readFileSync(path.join(root, file), 'utf8'), start = text.indexOf('    function ' + name + '('), end = text.indexOf('\n    }', start);
  assert(start >= 0 && end > start, 'actual source function ' + name);
  return text.slice(start, end + '\n    }'.length);
}
const grid = [-1024, -512, 0, 512, 1024], specs = { ambulance: { l: 53.6, w: 20 }, bus: { l: 96, w: 22.4 } };
const s = vm.createContext({
  gameTime: 10, KMH: 8 / 3.6, GRAVITY: 9.81 * 8, BLOCK_SIZE: 512, ROAD_CENTERS: grid, ROAD_ROWS: grid,
  MEDIC_ROUTE_TRIES: 3, MEDIC_ROUTE_RETRY: 8, vehicles: [], player: { x: 9999, y: 9999, car: {} },
  vehicleSpec: (c) => specs[c.type], vehicleCollisionHeight: () => 25, terrainHeight: () => 0,
  roadNear: (x) => Math.round(x / 512) * 512, rowNear: (y) => Math.round(y / 512) * 512,
  offCityStreets: () => false, harborPoliceProtected: () => false, groundAt: () => true, landAt: () => true,
  cityStreetAt: (x, y) => Math.abs(x / 512 - Math.round(x / 512)) < 0.09 || Math.abs(y / 512 - Math.round(y / 512)) < 0.09,
  railBlocked: () => false, nearbyStatics: () => [], forEachPedestrianNear: () => {}, isBoat: () => false,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), normalizeAngle: (a) => Math.atan2(Math.sin(a), Math.cos(a)),
  distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y), headingBetween: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
  segmentDistance(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
  }, contactCornersA: new Float64Array(8), contactCornersB: new Float64Array(8),
});
for (const [file, names] of [
  ['src/physics-shapes.js', ['vehicleShape', 'axes', 'corners', 'boxCorners', 'boxContact']],
  ['src/game-cops.js', ['copRoute']],
  ['src/livingcity-medics.js', ['medicStopFor', 'medicRouteLength', 'driveMedicJob']],
  ['src/livingcity-medic-routing.js', ['medicJunctionReachable', 'medicRouteAvoids', 'tryMedicDetour']],
  ['src/livingcity-sirens.js', ['emergencyRunControl']],
]) for (const name of names) vm.runInContext(sourceFunction(file, name), s);
function fixture() {
  s.gameTime = 10;
  const c = { type: 'ambulance', x: 0, y: 0, a: 0, vx: 0, vy: 0, speed: 0 },
    blocker = { type: 'bus', x: 100, y: 0, a: Math.PI / 2, vx: 0, vy: 0 },
    body = { x: 350, y: 60 }, plan = s.medicStopFor(body, 1),
    job = { ambulance: c, body, stop: plan.stop, heading: plan.heading, phase: 'driving', stuckFor: 6 };
  c.emergency = { running: true, blocker, job };
  s.vehicles = [c, blocker];
  return { c, blocker, job };
}
let checks = 0;
{
  const { c, blocker, job } = fixture(), before = [c.x, c.y, c.a, c.vx, c.vy, blocker.x, blocker.y],
    avoid = [{ x: 100, y: 0, r: 64 }], old = s.copRoute(c, { x: 512, y: 0 });
  assert.equal(s.medicRouteAvoids(c, old, avoid), false, 'direct route hits road obstruction');
  assert.equal(s.tryMedicDetour(job), true, 'detour found');
  assert.equal(job.detours, 1);
  assert.equal(s.medicRouteAvoids(c, c.countyRoute.slice(0, -1), avoid), true, 'complete route to the stop avoids blocked link');
  assert.deepEqual([c.x, c.y, c.a, c.vx, c.vy, blocker.x, blocker.y], before, 'no teleport or motion changes');
  assert.equal(c.countyIndex, 0);
  assert.equal(c.aiControl, null);
  assert.deepEqual(JSON.parse(JSON.stringify(c.countyRoute.at(-2))), JSON.parse(JSON.stringify(job.stop)));
  checks += 8;
}
{
  const { c, job } = fixture();
  c.countyRoute = [{ x: 512, y: 0 }, job.stop, { x: 900, y: 22 }];
  job.startedAt = 10;
  s.driveMedicJob(job, 1 / 60);
  assert.equal(job.detours, 1, 'live medic update triggers recovery for the blocked job');
  assert.equal(job.stuckFor, 0, 'successful route gets a fresh progress check');
  checks += 2;
}
{
  const { c, job } = fixture();
  c.x = 180; // Mid-block; the nearest junction is now behind it.
  const route = c.countyRoute = [{ x: 512, y: 0 }];
  assert.equal(s.tryMedicDetour(job), false, 'unsafe reverse to junction refused');
  assert.equal(job.routeTries, 1);
  for (let i = 0; i < 100; i++) assert.equal(s.tryMedicDetour(job), false);
  assert.equal(job.routeTries, 1, 'failed attempt does not retry per frame');
  for (let i = 0; i < 10; i++) { s.gameTime += 9; s.tryMedicDetour(job); }
  assert.equal(job.routeTries, 3, 'hard cap includes failed plans');
  assert.equal(c.countyRoute, route, 'failed plan preserves route');
  checks += 5;
}
for (const role of ['mission', 'missionDriver', 'missionAmbulance']) {
  const { c, job } = fixture(); c[role] = true;
  assert.equal(s.tryMedicDetour(job), false, 'mission role excluded: ' + role);
  assert.equal(job.routeTries, undefined); checks += 2;
}
{
  const { blocker, job } = fixture(); blocker.vx = 10 * s.KMH;
  assert.equal(s.tryMedicDetour(job), false, 'a moving car is not a road closure'); checks++;
}
{
  const { c, job } = fixture();
  s.vehicles.push({ type: 'bus', x: c.x, y: c.y + 24, a: 0 });
  assert.equal(s.tryMedicDetour(job), false, 'occupied approach refused by real box contacts'); checks++;
}
{
  const { c, job } = fixture();
  const original = s.nearbyStatics;
  s.nearbyStatics = () => [{ x: 0, y: 18, hx: 80, hy: 8, a: 0 }];
  assert.equal(s.tryMedicDetour(job), false, 'static collision blocks approach');
  s.nearbyStatics = original; checks++;
}
{
  const { c } = fixture();
  c.countyRoute = [{ x: 512, y: 0 }, { x: 800, y: 22 }, { x: 1200, y: 22 }];
  s.vehicles = [c];
  let bridgeCalls = 0;
  s.drawbridgeTrafficLimit = (_c, desired) => { bridgeCalls++; assert(desired > 0); return 0; };
  assert.equal(s.emergencyRunControl(c).desired, 0, 'an ambulance stops for a raised bridge');
  assert.equal(bridgeCalls, 1);
  s.drawbridgeTrafficLimit = (_c, desired) => desired;
  assert(s.emergencyRunControl(c).desired > 0, 'lowered bridge permits driving'); checks += 3;
}
console.log(JSON.stringify({ passed: checks, directRoadBlocked: true, detourAvoidsRoad: true, noPositionChanges: true, maximumAttempts: 3, retrySeconds: 8, emergencyBridgeStop: true }, null, 2));
