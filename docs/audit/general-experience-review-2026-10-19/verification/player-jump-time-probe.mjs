// Measure the original physical-Space wall-clock phase, then finish the same braking attempt
// to 1.2 seconds of actual game time. No production code or test assertion is changed.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { request } from '../../tools/dev.mjs';
import original from '../../tools/tests/player-jump.mjs';
const path = '/workspace/GTA/work/general-review/player-jump-time-probe.json';
const html = '/workspace/GTA/work/general-review/release-candidate.html';
const report = { html, htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'), samples: [], notes: [] };
async function op(o) {
  const r = await request(o);
  if (r.error) throw Error(r.error);
  return r.result;
}
const call = (method, ...args) => op({ op: 'call', method, args });
const api = {
  call,
  keys: (codes, seconds, { real = false } = {}) => op({ op: 'keys', codes: [].concat(codes), seconds, real }),
  wait: seconds => op({ op: 'wait', seconds }),
  realWait: seconds => op({ op: 'wait', seconds, real: true }),
  assert(value, message) { if (!value) throw Error(message); },
  near(value, lo, hi, label) { if (!(value >= lo && value <= hi)) throw Error(`${label}: ${value} outside ${lo}..${hi}`); },
  note(message) { report.notes.push(message); console.log(message); },
  async mouse(x, y, { seconds = 0, keys = [], down = false, taps = [] } = {}) {
    const physical = { op: 'mouse', x, y, seconds, down, codes: keys, taps };
    if (!keys.includes('Space')) return op(physical);
    const started = Date.now(), before = await call('frameFaults'), fast = await call('ride');
    let result = await op(physical), after = await call('frameFaults'), slowed = await call('ride');
    report.original = { wallSeconds: (Date.now() - started) / 1000,
      gameTimeBefore: before.gameTime, gameTimeAfter: after.gameTime,
      simulatedSeconds: after.gameTime - before.gameTime, fast, slowed,
      speedRatio: Math.abs(slowed.speed) / fast.speed };
    console.log('ORIGINAL ' + JSON.stringify(report.original));
    while (after.gameTime - before.gameTime < 1.2 && Date.now() - started < 30000) {
      result = await op({ ...physical, seconds: 0.3 });
      after = await call('frameFaults');
      slowed = await call('ride');
      report.samples.push({ wallSeconds: (Date.now() - started) / 1000,
        simulatedSeconds: after.gameTime - before.gameTime, speed: slowed.speed });
    }
    report.measured = { wallSeconds: (Date.now() - started) / 1000,
      simulatedSeconds: after.gameTime - before.gameTime, speed: slowed.speed,
      speedRatio: Math.abs(slowed.speed) / fast.speed };
    console.log('MEASURED ' + JSON.stringify(report.measured));
    api.assert(report.measured.simulatedSeconds >= 1.2, 'Game did not advance 1.2 seconds within 30 wall seconds');
    return result;
  },
};
report.boot = await request({ op: 'status' });
report.viewport = (await call('missionCard')).viewport;
try { await original(api); report.pass = true; }
catch (error) { report.pass = false; report.error = error.stack; }
report.errors = await op({ op: 'errors' });
report.faults = await call('frameFaults');
fs.writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, error: report.error, original: report.original, measured: report.measured }));
if (!report.pass) process.exitCode = 1;
