import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { checkDynamics } from '../../tools/tests/aircraft-flight-dynamics.mjs';
import { flightFixture } from '../../tools/tests/aircraft-flight-model.mjs';

const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '../..');
const scratch = path.join(root, 'work/airport-flight');
const originalFixture = path.join(root, 'tools/tests/aircraft-flight-model.mjs');
const sourceURL = pathToFileURL(originalFixture).href;
const before = path.join(scratch, 'aviation-flight-before.js');
const baselineFixturePath = path.join(scratch, 'baseline-fixture.mjs');
const transformed = fs.readFileSync(originalFixture, 'utf8')
  .replace("'./aircraft-taxi-takeoff.mjs'", JSON.stringify(pathToFileURL(path.join(root, 'tools/tests/aircraft-taxi-takeoff.mjs')).href))
  .replace("new URL('../../src/' + file + '.js', import.meta.url)", "new URL('../../src/' + file + '.js', " + JSON.stringify(sourceURL) + ')')
  .replace('createRequire(import.meta.url)', 'createRequire(' + JSON.stringify(sourceURL) + ')')
  .replace("read('aviation-flight')", 'fs.readFileSync(' + JSON.stringify(before) + ", 'utf8')");
fs.writeFileSync(baselineFixturePath, transformed);
const baseline = (await import(pathToFileURL(baselineFixturePath))).flightFixture;
const run = async (label, fixture) => {
  const failures = [];
  let assertions = 0;
  const results = await checkDynamics({
    assert: (ok, message) => { assertions++; if (!ok) failures.push(message); },
    near: (v, lo, hi, message) => {
      assertions++;
      if (!(v >= lo && v <= hi)) failures.push(`${message}: ${v} outside [${lo}, ${hi}]`);
    },
    note: () => {},
  }, fixture);
  return { label, status: failures.length ? 'FAIL' : 'PASS', assertions,
    failedAssertions: failures.length, failures, results };
};
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const files = ['src/aviation-flight.js', 'tools/tests/aircraft-flight-model.mjs',
  'tools/tests/aircraft-flight-dynamics.mjs', 'tools/tests/aircraft-taxi-takeoff.mjs',
  'work/airport-flight/aviation-flight-before.js', 'work/airport-flight/run-dynamics-host.mjs'];
const receipt = {
  scope: 'Production host. Only aviation-flight.js is replaced for baseline; the same fixture, assertions and other current source files are used for both. No renderer or browser FPS claim.',
  source: Object.fromEntries(files.map(f => [f, sha(f)])),
  baseline: await run('before flight changes', baseline),
  current: await run('current flight changes', flightFixture),
};
fs.writeFileSync(path.join(scratch, 'dynamics-host-ab.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ baseline: { status: receipt.baseline.status,
  assertions: receipt.baseline.assertions, failedAssertions: receipt.baseline.failedAssertions },
current: { status: receipt.current.status, assertions: receipt.current.assertions,
  failedAssertions: receipt.current.failedAssertions } }));
if (receipt.current.failedAssertions) process.exitCode = 1;
