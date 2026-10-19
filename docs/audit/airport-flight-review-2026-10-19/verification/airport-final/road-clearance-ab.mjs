import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import roadTest, { airportRoadFixture, airportRoadSweeps } from '../../tools/tests/airport-road-clearance.mjs';
import geometryTest from '../../tools/tests/airport-architecture.mjs';
const baselineCommit = execFileSync('git', ['rev-parse', 'df75780a'], { encoding: 'utf8' }).trim();
const files = ['geography-regions', 'county-map', 'game-vehicles', 'physics-shapes', 'air-cover'];
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const original = Object.fromEntries(files.map(file => [file, execFileSync('git', ['show', baselineCommit + ':src/' + file + '.js'], { encoding: 'utf8' })]));
const current = Object.fromEntries(files.map(file => [file, fs.readFileSync('src/' + file + '.js', 'utf8')]));
const inspect = fixture => ({ routes: airportRoadSweeps(fixture), parkedBusHits: fixture.hits({ type: 'bus', x: 4400, y: 8760, a: 0 }).map(b => b.kind),
  overheadVolumes: fixture.api.airportOverheadVolumes().length,
  roadwayPosts: fixture.api.AIRPORT_SCENERY_SOLIDS.filter(p => /column/.test(p.kind) && p.x > 3800).filter(post =>
    [[post.x, post.y], [post.x + post.w, post.y], [post.x, post.y + post.h], [post.x + post.w, post.y + post.h]].some(([x, y]) =>
      Math.abs((x - fixture.a[0]) * fixture.uy - (y - fixture.a[1]) * fixture.ux) <= fixture.road.width / 2)) });
const run = async test => {
  const result = { assertions: 0, failures: [], notes: [] };
  await test({ assert: (ok, message) => { result.assertions++; if (!ok) result.failures.push(message); }, note: note => result.notes.push(JSON.parse(note)) });
  result.pass = !result.failures.length;
  return result;
};
const result = { baselineCommit, scope: 'Production SAT, vehicle envelopes, overhead grid and shared airport support plans; staged flat-road host sweeps, not rendered ordinary driving.',
  road: { name: 'OCEANVIEW PARKWAY', from: [3800, 8700], to: [4590, 8770], width: 110 },
  baseline: inspect(airportRoadFixture(file => original[file])), current: inspect(airportRoadFixture(file => current[file])),
  tests: { road: await run(roadTest), geometry: await run(geometryTest) },
  hashes: { baseline: Object.fromEntries(files.map(file => ['src/' + file + '.js', sha(original[file])])),
    current: Object.fromEntries([...files.map(file => 'src/' + file + '.js'), 'src/airport-terminal3d.js', 'tools/tests/airport-road-clearance.mjs', 'tools/tests/airport-architecture.mjs']
      .map(file => [file, sha(fs.readFileSync(file))])) } };
fs.writeFileSync('work/airport-scene/road-clearance-ab.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ baselineBlockedRoutes: result.baseline.routes.filter(r => r.blockedSamples).length,
  baselineBlockedSamples: result.baseline.routes.reduce((s, r) => s + r.blockedSamples, 0), baselineParkedBusHits: result.baseline.parkedBusHits,
  baselineRoadwayPosts: result.baseline.roadwayPosts, currentBlockedRoutes: result.current.routes.filter(r => r.blockedSamples).length,
  currentRoadwayPosts: result.current.roadwayPosts, tests: Object.fromEntries(Object.entries(result.tests).map(([name, r]) => [name, { assertions: r.assertions, failures: r.failures, pass: r.pass }])) }, null, 2));
if (Object.values(result.tests).some(r => !r.pass)) process.exitCode = 1;
