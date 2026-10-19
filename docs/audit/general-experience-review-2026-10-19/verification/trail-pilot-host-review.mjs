// Run from the repository root: node docs/audit/general-experience-review-2026-10-19/verification/trail-pilot-host-review.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import { terrainTrailFixture } from '../../../../tools/fixtures/terrain-trail.mjs';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const here = new URL('.', import.meta.url);
const files = ['src/offroad-club.js', 'src/offroad-trails.js', 'src/terrain-suspension.js', 'src/physics-driving.js',
  'src/driving.js', 'src/falls-vehicles.js', 'src/falls-console.js', 'tools/fixtures/terrain-trail.mjs',
  'tools/fixtures/terrain-falls.mjs', 'tools/tests/hillclimb-physics.mjs', 'tools/tests/falls.mjs', 'tools/tests/trail-pilot-route.mjs'];
const sourceHashes = Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(file))]));
const candidate = terrainTrailFixture(), baselineSource = fs.readFileSync(new URL('trail-pilot-original-source.js', here), 'utf8');
const baseline = terrainTrailFixture({ clubSource: baselineSource });
const report = { kind: 'Production host terrain/controls/suspension/console pilot comparison; no scenery, other actors, static contacts or browser',
  liveAcceptance: 'Pending unchanged complete-game hillclimb-physics and falls browser checks', sourceHashes,
  originalPilotFileSha256: hash(baselineSource), variants: {} };
for (const [name, fixture] of [['baseline', baseline], ['candidate', candidate]]) {
  const runs = [];
  for (const [label, frame, fresh] of [['fresh30', 1 / 30, true], ['reused60', 1 / 60, false], ['fresh60', 1 / 60, true], ['reused30', 1 / 30, false], ['down35', 1 / 30, false]]) {
    const run = fixture.run(frame, { fresh, down: label === 'down35' });
    runs.push({ label, ...run });
    console.log(name, label, JSON.stringify({ reason: run.result.reason, time: run.result.last?.time,
      seconds: run.result.seconds, hp: run.result.hp, ride: run.result.ride, route: run.route }));
  }
  const controls = { cliff: fixture.falls.cliff(), sedan: fixture.falls.drive({ type: 'sedan', maxKmh: 20, seconds: 20, road: true }),
    bike: fixture.falls.drive({ type: 'bike', maxKmh: 20, seconds: 20, road: true }) };
  report.variants[name] = { runs, controls };
  fs.writeFileSync(new URL('trail-pilot-host-results.json', here), JSON.stringify(report, null, 2));
}
if (JSON.stringify(report.variants.baseline.controls) !== JSON.stringify(report.variants.candidate.controls)) throw Error('Unchanged falls controls differ');
for (const run of report.variants.candidate.runs.slice(0, 4)) {
  const r = run.result;
  if (r.reason !== 'summit' || !r.last?.clean || r.last.time >= 75 || r.hp !== 240 || r.overturned || r.nan || r.ride.nan ||
    r.cliffFlights || r.ride.flights || r.ride.airS >= .5 || r.ride.maxGapM >= .3 || r.ride.maxUpMs >= 6 ||
    r.ride.maxBlowMs >= 4.5 || run.route.outsideS || run.route.maxOutside) throw Error('Ascent bounds failed: ' + run.label);
}
const d = report.variants.candidate.runs[4].result;
if (d.reason !== 'trailhead' || d.cliffFlights || d.ride.flights || d.ride.airS >= .3 || d.ride.maxBlowMs >= 4.5 || d.overturned || d.hp < 200) throw Error('Descent-35 failed');
report.hostPass = true;
report.unchangedFallsControlsIdentical = true;
fs.writeFileSync(new URL('trail-pilot-host-results.json', here), JSON.stringify(report, null, 2));
console.log('PASS four fresh/reused ascents, unchanged descent-35 safety, byte-identical serialized cliff/sedan/bike controls');
