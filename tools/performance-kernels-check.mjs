// Production hot-path audit: exact ordered crowd visitors and current gate contact bodies against the previous code.
// Optional --bench compares operation counts and host kernel timings; this is not presented browser/GPU FPS.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const fn = (source, name) => {
  const match = source.match(new RegExp('^    function ' + name + '\\([^]*?^    \\}', 'm'));
  if (!match) throw new Error('missing production function: ' + name);
  return match[0];
};
const plain = value => JSON.parse(JSON.stringify(value));
function random(seed = 42) {
  return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
}
function crowdApi(people, reference = false) {
  const source = read('src/crowd-space.js') + (reference ? '\n' + read('tools/fixtures/crowd-grid-map-reference.js') : '');
  return vm.runInNewContext('(function(){' + source + '\nreturn {buildCrowdGrid,forEachPedestrianNear,forPeopleNear,crowd,player,pedestrians};})()',
    { Math, player: { x: 2000, y: 2000 }, pedestrians: structuredClone(people), hypot2: Math.hypot });
}
function crowdAudit(bench) {
  const rand = random(),
    people = Array.from({ length: 850 }, (_, id) => ({ id, x: 2000 + (rand() - .5) * 5500, y: 2000 + (rand() - .5) * 5500, hp: rand() > .06 ? 100 : 0 })),
    queries = Array.from({ length: 60 }, (_, i) => [2000 + (rand() - .5) * 2300, 2000 + (rand() - .5) * 2300, i % 8 === 0 ? 400 : 110]),
    before = crowdApi(people, true), after = crowdApi(people),
    visit = (api, q, name) => { const out = []; api[name](...q, (p, d) => out.push([p.id, d])); return out; };
  let checked = 0;
  const compare = q => {
    for (const name of ['forPeopleNear', 'forEachPedestrianNear']) {
      assert.deepEqual(visit(after, q, name), visit(before, q, name), name + ' changed ordered visitors at ' + q);
      checked++;
    }
  };
  compare([2000, 2000, 110]); // Before the first build.
  for (let frame = 0; frame < 240; frame++) {
    const location = [[2000, 2000], [-4000, -.001], [9000, -9000], [-.001, 1300.001]][Math.floor(frame / 60)];
    for (const api of [before, after]) {
      [api.player.x, api.player.y] = location;
      for (let i = 0; i < api.pedestrians.length; i++) {
        api.pedestrians[i].x = people[i].x + frame * .8;
        api.pedestrians[i].y = people[i].y + frame * .4;
        api.pedestrians[i].hp = (i + frame) % 23 === 0 ? 0 : people[i].hp;
      }
      api.buildCrowdGrid();
    }
    assert.deepEqual(plain([...after.crowd.grid.values()].map(c => c.slice(0, c.n).map(p => p.id))),
      plain([...before.crowd.grid.values()].map(c => c.slice(0, c.n).map(p => p.id))), 'encounter iteration changed');
    for (const q of queries) compare(q);
    for (const radius of [0, 110, 400, 1301]) compare([location[0] + 1300 - radius - 20, location[1], radius]);
    compare([location[0], location[1] + 65536 * 64, 110]); // Preserve the original outside-range Map fallback.
    // A pedestrian can move after the grid is built: both readers retain the same authoritative cell pointer.
    before.pedestrians[7].x += 80; after.pedestrians[7].x += 80;
    compare([before.pedestrians[7].x, before.pedestrians[7].y, 110]);
  }
  // The people list changing invalidates the far grid in the same frame.
  for (const api of [before, after]) api.pedestrians.push({ id: 851, x: 11000, y: 9000, hp: 100 });
  compare([11000, 9000, 110]);
  let timing = null, operations = null;
  if (bench) {
    const a = crowdApi(people, true), b = crowdApi(people);
    for (const api of [a, b]) api.buildCrowdGrid();
    const counted = api => {
      let gets = 0;
      const original = api.crowd.grid.get;
      api.crowd.grid.get = function (key) { gets++; return original.call(this, key); };
      for (const q of queries) { api.forPeopleNear(...q, () => {}); api.forEachPedestrianNear(...q, () => {}); }
      delete api.crowd.grid.get;
      return gets;
    };
    operations = { queries: queries.length * 2, beforeNearMapGets: counted(a), afterNearMapGets: counted(b) };
    let sink = 0;
    const collect = p => { sink += p.id; };
    const run = api => {
      const start = performance.now();
      for (let frame = 0; frame < 300; frame++) {
        api.buildCrowdGrid();
        for (const q of queries) { api.forPeopleNear(...q, collect); api.forEachPedestrianNear(...q, collect); }
      }
      return performance.now() - start;
    };
    run(a); run(b);
    const samples = [];
    for (let i = 0; i < 6; i++) samples.push(i % 2 ? { afterMs: run(b), beforeMs: run(a) } : { beforeMs: run(a), afterMs: run(b) });
    const median = key => { const values = samples.map(s => s[key]).sort((x,y)=>x-y); return (values[2]+values[3])/2; };
    timing = { framesPerSample: 300, queriesPerFrame: queries.length * 2, samples, beforeMedianMs: median('beforeMs'), afterMedianMs: median('afterMs'), sink };
  }
  return { checked, encounterFrames: 240, denseSlots: 43 * 43, operations, timing };
}
function broadphaseApi(reference = false) {
  const military = read('src/military-base.js'),
    setup = military.slice(0, military.indexOf('    function inMilitary(')),
    // This prefix also installs the actual fixed fort collider plan and gate-state defaults.
    source = setup + '\n' + ['inMilitary', 'militaryGateSolids', 'militarySolids'].map(name => fn(military, name)).join('\n') + '\n' +
      'let gateSolidsAt=-1, gateSolidsCache=[];\n' + read('src/physics-step.js') +
      (reference ? '\n' + read('tools/fixtures/vehicle-broadphase-reference.js') : '') +
      '\nreturn {vehicleBroadphase,vehicles,militaryGateState,SENTINEL,militarySightSolids,barrierCars:broadphaseBarrierCars,barrierBodies:broadphaseBarrierBodies,scope};';
  const scope = {
    Math, VEHICLE_DEFINITIONS: {}, roadPerformance: () => {}, KMH: 8/3.6, UNITS_PER_METRE: 8, GRAVITY: 78.48,
    vehicles: [], player: { x: 2000, y: 2000 }, noStatics: [], staticGridVersion: 1, broadphaseStamp: 0,
    broadphasePairCount: 0, broadphaseCells: Array.from({ length: 4096 }, () => Object.assign([], { stamp: 0, n: 0 })),
    broadphasePairA: [], broadphasePairB: [], broadphaseBarrierCars: [], broadphaseBarrierBodies: [],
    gameTime: 0, vehicleRadius: () => 15, isBoat: c => c.type === 'boat', isAircraft: c => c.type === 'plane',
    nearbyStatics: () => [], depotBarriers: () => [], inHarbor: (x,y) => x > 3000 && x < 3600 && y > 1100 && y < 1800,
    harborSolids: () => [{ x: 3100, y: 1320, w: 4, h: 140, height: 13, barrier: true }], drawbridgeBarrierBodies: () => {},
  };
  scope.scope = scope;
  return vm.runInNewContext('(function(){' + source + '})()', scope);
}
function broadphaseAudit() {
  const before = broadphaseApi(true), after = broadphaseApi(),
    vehicles = [
      ...Array.from({ length: 12 }, (_, id) => ({ id, type: 'car', x: 9450 + id * 35, y: 8150 + id * 50 })),
      { id: 20, type: 'boat', x: 9430, y: 8150 }, { id: 21, type: 'plane', x: 9430, y: 8150, altitude: 30 },
      { id: 30, type: 'car', x: 3130, y: 1350 }, { id: 31, type: 'car', x: 3200, y: 1420 },
      { id: 40, type: 'car', x: -1664, y: 4338 }, { id: 41, type: 'car', x: -1664, y: 4572 },
    ].map(c => ({ vx: 0, vy: 0, av: 0, restSteps: 500, ...c })),
    shapes = api => api.barrierBodies.map((b,i) => [api.barrierCars[i].id, b.x, b.y, b.hx, b.hy, b.a, b.height, b.kind, b.id]);
  for (const api of [before, after]) api.vehicles.push(...structuredClone(vehicles));
  let checked = 0, reused = 0;
  for (let frame = 0; frame < 120; frame++) {
    for (const api of [before, after]) {
      api.scope.gameTime = frame / 60;
      for (let lane = 0; lane < api.militaryGateState.length; lane++) {
        const s = api.militaryGateState[lane];
        s.arm = frame % 4 < 2 ? .54 : .55;
        s.bollards = frame % 6 < 3 ? .5 : .51;
        s.slide = frame % 10 < 5 ? .85 : .86;
        s.armBroken = frame % 11 === 0; s.bollardsBroken = frame % 13 === 0; s.slideBroken = frame % 17 === 0;
      }
      api.scope.depotBarriers = () => frame % 3 ? [{ x:-1722,y:4338,w:116,h:7,height:58 },{ x:-1722,y:4572,w:116,h:8,height:46 }] : [];
      api.scope.harborSolids = () => frame % 5 ? [{ x:3100,y:1320,w:4,h:140,height:13,barrier:true }] : [];
      api.vehicleBroadphase(null);
    }
    assert.deepEqual(plain(shapes(after)), plain(shapes(before)), 'ordered contact geometry changed at ' + frame);
    checked += before.barrierBodies.length;
    const previous = after.barrierBodies.slice();
    after.vehicleBroadphase(null);
    assert.deepEqual(plain(shapes(after)), plain(shapes(before)), 'same-frame refresh changed bodies');
    reused += previous.filter((body,i) => body === after.barrierBodies[i]).length;
  }
  assert(reused > 1000, 'gate shapes are not reused');
  assert(before.militarySightSolids.length > 10 && before.militarySightSolids.every(r => !r.barrier), 'fixed fort sight solids unexpectedly include moving barriers');
  return { checked, reusedContacts: reused, frames: 120, fixedFortSightSolids: before.militarySightSolids.length };
}
export function performanceKernelAudit({ bench = false } = {}) {
  return { crowd: crowdAudit(bench), gates: broadphaseAudit() };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  console.log(JSON.stringify(performanceKernelAudit({ bench: process.argv.includes('--bench') }), null, 2));
