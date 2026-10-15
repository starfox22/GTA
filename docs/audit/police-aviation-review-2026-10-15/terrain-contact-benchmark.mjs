// node docs/audit/police-aviation-review-2026-10-15/terrain-contact-benchmark.mjs BASELINE_ROOT [CORRECT_UNOPTIMIZED_JS]
// Two/three production contexts share the generated baseline field. Main-thread CPU timing excludes scheduler waits.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { terrainFallsFixture } from '../../../tools/fixtures/terrain-falls.mjs';
if (!process.argv[2]) throw Error('Pass the immutable baseline checkout/archive root.');
const baseline = terrainFallsFixture({ sourceRoot: path.resolve(process.argv[2]) }), cache = baseline.terrainCache;
const fixtures = [{ name: 'baseline', fixture: baseline }];
if (process.argv[3]) fixtures.push({ name: 'correctUnoptimized', fixture: terrainFallsFixture({ terrainCache: cache,
  sourceOverrides: { 'terrain-suspension': fs.readFileSync(process.argv[3], 'utf8') } }) });
fixtures.push({ name: 'correctOptimized', fixture: terrainFallsFixture({ terrainCache: cache }) });
for (const { fixture } of fixtures) fixture.scope.threadMicros = () => {
  const time = process.threadCpuUsage(); return time.user + time.system;
};
let rock = { h: 0 };
for (let x = 7630; x <= 7650; x++) for (let y = 1170; y <= 1185; y++) {
  const h = baseline.context.rideRelief(x, y); if (h > rock.h) rock = { x, y, h };
}
const plain = { x: cache.trails[0].path[20][0], y: cache.trails[0].path[20][1] };
if (!(rock.h > 0) || baseline.context.rideRelief(plain.x, plain.y) !== 0) throw Error('Benchmark probes lost rock/plain coverage.');
const receipt = { method: 'Warmed interleaved rotating contexts, process.threadCpuUsage; host CPU contact-query cost, no frame-rate claim.', probes: { rock, plain }, cases: {} };
for (const [name, points] of [['rock', [rock]], ['plain', [plain]], ['mixed', cache.trails[0].path.map(p => ({ x: p[0], y: p[1] }))]]) {
  for (const { fixture } of fixtures) {
    fixture.scope.benchPoints = points;
    vm.runInContext(`var benchOut={h:0,gx:0,gy:0}; function benchLoop(n){var p;
      for(var i=0;i<n;i++){p=benchPoints[i%benchPoints.length];rideTyreGround(p.x,p.y,1,0,3,benchOut);}} benchLoop(12000);`, fixture.context);
  }
  const samples = fixtures.map(() => []);
  for (let pass = 0; pass < 9; pass++) for (let k = 0; k < fixtures.length; k++) {
    const i = (pass + k) % fixtures.length;
    samples[i].push(vm.runInContext('(()=>{const started=threadMicros();benchLoop(3000);return(threadMicros()-started)/3000;})()', fixtures[i].fixture.context));
  }
  receipt.cases[name] = Object.fromEntries(fixtures.map(({ name }, i) => {
    const sorted = [...samples[i]].sort((a, b) => a - b);
    return [name, { medianUs: sorted[4], minUs: sorted[0], maxUs: sorted.at(-1), samplesUs: samples[i] }];
  }));
}
console.log(JSON.stringify(receipt, null, 2));
