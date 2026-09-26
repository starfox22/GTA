// Fast regression tests over the developer console, one file per test in tools/tests/.
//
//   node tools/test.mjs [filter ...] [--keep] [--html file] [--verbose]
//
// Builds dist/dev/game.html and boots it once in the dev server (tools/dev.mjs) in
// no-render mode (`?dev&norender`: no WebGL, no drawing), then runs every
// tools/tests/*.mjs whose name contains one of the filters (all by default). A running
// dev server is reused (rebuilt and reloaded so it runs the current code) and left
// running; one this script started is stopped at the end unless --keep.
//
// A test file:
//   // One line saying what it checks.
//   export const flags = 'test';   // optional: 'dev' (default) or 'test' (no ?dev: the
//                                  // demo gate and other dev bypasses are live)
//   export const fresh = true;     // optional: reload the page first (clean world)
//   export default async function (t) {
//     const r = await t.call('brakeTest', 'sedan', 100);   // a NAMED console method
//     t.near(r.distance, 30, 45, 'sedan 100-0 m');
//   }
// t.call(method, ...args), t.keys(codes, seconds) / t.wait(seconds) (console simulate),
// t.assert(cond, msg), t.near(value, lo, hi, label), t.finite(obj, label) (no NaN /
// Infinity anywhere inside), t.note(text) (shown with --verbose). A test fails on a
// thrown error, a failed assertion or any console error it caused.
// Prints one line per test and a summary; exits 1 when any test fails.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readState, request, start } from './dev.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = path.join(ROOT, 'tools', 'tests');

const argv = process.argv.slice(2);
const opt = (name) => argv.includes(name);
const htmlAt = argv.indexOf('--html');
const html = htmlAt >= 0 ? argv[htmlAt + 1] : null;
const filters = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--html');
const verbose = opt('--verbose');

class Failure extends Error {}

async function op(o) {
  const reply = await request(o);
  if (reply.error) throw new Error(reply.error);
  return reply.result;
}

function makeApi(notes) {
  return {
    call: (method, ...args) => op({ op: 'call', method, args }),
    keys: (codes, seconds) => op({ op: 'keys', codes: [].concat(codes), seconds }),
    wait: (seconds) => op({ op: 'wait', seconds }),
    assert(cond, msg) {
      if (!cond) throw new Failure(msg);
    },
    near(value, lo, hi, label) {
      if (!(typeof value === 'number' && value >= lo && value <= hi)) throw new Failure(`${label}: ${JSON.stringify(value)} not in [${lo}, ${hi}]`);
      notes.push(`${label} ${value}`);
    },
    finite(obj, label) {
      const bad = [];
      (function walk(v, at) {
        if (v === 'NaN' || v === 'Infinity' || v === '-Infinity' || (typeof v === 'number' && !Number.isFinite(v))) bad.push(at);
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, at + '.' + k);
      })(obj, label);
      if (bad.length) throw new Failure('non-finite: ' + bad.slice(0, 5).join(', '));
    },
    note: (text) => notes.push(text),
  };
}

async function waitReady() {
  for (;;) {
    const st = await request({ op: 'status' });
    if (st.state === 'ready') return st;
    if (st.state === 'failed') throw new Error('boot failed: ' + st.error);
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function reload(flags) {
  await op({ op: 'reload', flags });
  return waitReady();
}

const files = fs
  .readdirSync(TESTS)
  .filter((f) => f.endsWith('.mjs'))
  .filter((f) => !filters.length || filters.some((s) => f.includes(s)))
  .sort();
if (!files.length) {
  console.log('no tests match');
  process.exit(1);
}
const tests = [];
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(TESTS, f)).href);
  tests.push({ name: f.replace(/\.mjs$/, ''), run: mod.default, flags: (mod.flags || 'dev') + '&norender', fresh: !!mod.fresh });
}
// Tests needing the same page flags run together, the default ('dev') group first; in a
// group the `fresh` tests run last (each reloads first, so the ones before them share a page).
const rank = (t) => (t.flags.startsWith('dev') ? 0 : 2) + (t.fresh ? 1 : 0);
tests.sort((a, b) => rank(a) - rank(b));

const t0 = Date.now();
const existing = readState();
let startedHere = false;
let st;
try {
  st = existing ? await request({ op: 'status' }, { timeoutMs: 5000 }).catch(() => null) : null;
  if (st && st.state === 'ready') {
    st = await reload(tests[0].flags);
    console.log(`reused dev server (rebuilt, reloaded ?${st.flags}: boot ${st.bootSeconds}s)`);
  } else {
    st = await start({ html, nodev: tests[0].flags.startsWith('test'), quiet: true });
    startedHere = true;
    console.log(`started dev server (?${st.flags}: boot ${st.bootSeconds}s)`);
  }
} catch (e) {
  console.log('FAIL could not boot the game: ' + e.message);
  process.exit(1);
}

let flags = st.flags;
let freshPage = true;
const results = [];
for (const test of tests) {
  const notes = [];
  const began = Date.now();
  let error = null;
  try {
    if (test.flags !== flags || (test.fresh && !freshPage)) {
      st = await reload(test.flags);
      flags = st.flags;
    }
    freshPage = false;
    await op({ op: 'errors' }); // start clean
    await test.run(makeApi(notes));
    const errs = await op({ op: 'errors' });
    if (errs.length) error = `${errs.length} console error(s): ${errs[0].split('\n')[0]}`;
  } catch (e) {
    error = e instanceof Failure ? e.message : 'error: ' + (e.message || e);
  }
  const secs = ((Date.now() - began) / 1000).toFixed(1);
  results.push(!error);
  console.log(`${error ? 'FAIL' : 'PASS'} ${test.name} (${secs}s)${error ? ': ' + error : ''}`);
  if (verbose && notes.length) console.log('     ' + notes.join(' · '));
}

if (startedHere && !opt('--keep')) await request({ op: 'stop' }).catch(() => {});
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} passed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(failed ? 1 : 0);
