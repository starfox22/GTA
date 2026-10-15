import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const { request, readState } = await import(pathToFileURL(path.resolve('tools/dev.mjs')));
const fixturePath = 'docs/audit/vehicle-fidelity-2026-10-15/verification/gameplay/world-reset-strengthened-fixture.txt';
const fixture = fs.readFileSync(fixturePath, 'utf8');
const state = readState(), expected = path.resolve('dist/review-2026-10-15-integrated.html');
if (path.resolve(state?.html || '') !== expected) throw Error('Owned server is not using the frozen integrated build');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const checks = [], notes = [], bookReports = [];
const report = { status: 'RUNNING', html: expected, htmlSha256: sha(expected), fixturePath,
  fixtureSha256: sha(fixturePath), startedUTC: new Date().toISOString(), originalAssertionsAndWaitsPreserved: true };
const op = async o => { const r = await request(o); if (r.error) throw Error(r.error); return r.result; };
const t = {
  async call(method, ...args) {
    const result = await op({ op: 'call', method, args });
    if (method === 'sportsbook') bookReports.push(result);
    return result;
  },
  keys: (codes, seconds, { real = false } = {}) => op({ op: 'keys', codes: [].concat(codes), seconds, real }),
  wait: seconds => op({ op: 'wait', seconds }),
  realWait: seconds => op({ op: 'wait', seconds, real: true }),
  assert(ok, message) { checks.push({ ok: !!ok, message }); if (!ok) throw Error(message); },
  note: text => notes.push(text),
};
try {
  const prior = await op({ op: 'errors' });
  if (prior?.length) throw Error('Uncleared errors before fixture: ' + JSON.stringify(prior));
  await op({ op: 'reload', keep: false });
  const deadline = Date.now() + 240000;
  while (true) {
    const status = await request({ op: 'status' });
    if (status.state === 'ready') break;
    if (status.state === 'failed' || Date.now() > deadline) throw Error('Fresh fixture boot: ' + JSON.stringify(status));
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const { default: run } = await import('data:text/javascript;base64,' + Buffer.from(fixture).toString('base64'));
  await run(t);
  report.errors = await op({ op: 'errors' });
  if (report.errors?.length) throw Error('Fixture console errors: ' + JSON.stringify(report.errors));
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = error.stack;
  try { report.errors = await op({ op: 'errors' }); } catch {}
}
Object.assign(report, { assertions: checks.length, checks, notes, bookReports, finishedUTC: new Date().toISOString() });
fs.writeFileSync('dist/review15-world-reset-browser-after.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, assertions: report.assertions, error: report.error, notes: report.notes }));
if (report.status !== 'PASS') process.exitCode = 1;
