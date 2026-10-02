// A/B of two builds on the running dev server (no second page, no second browser slot): for each run, the build's
// HTML is copied over the server's page file, the page reloaded, and the same scenarios profiled with
// DeadEndCity.simProfile (CPU ms per 60 fps frame from the page's thread time, which a busy machine inflates far less
// than wall-clock). Runs go in the order given (A B B A) and medians are printed per scenario.
//
//   node tools/dev.mjs start dist/ab.html                       # the server must show dist/ab.html (a copy of A or B)
//   node tools/ab.mjs dist/base.html dist/new.html [--order ABBA] [--seconds 8] [--scenarios street,drive,chase,fight]
//
// Scenarios: street (on foot at the start), drive (a sedan, W held), chase (five stars, a sedan), fight (pistol, four stars,
// three Harbor Kings gunmen). The page needs the console's simProfile (all builds since the second performance pass).
import fs from 'node:fs';
import path from 'node:path';
import { request, readState } from './dev.mjs';

const argv = process.argv.slice(2);
const files = argv.filter((a) => !a.startsWith('--') && /\.html$/.test(a));
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};
if (files.length < 2) throw new Error('usage: node tools/ab.mjs A.html B.html [--order ABBA] [--seconds 8] [--scenarios street,drive,chase,fight]');
const ORDER = opt('order', 'ABBA').split('');
const SECONDS = Number(opt('seconds', 8));
const SCENARIOS = opt('scenarios', 'street,drive,chase,fight').split(',');
const page = readState()?.html;
if (!page) throw new Error('no dev server running (node tools/dev.mjs start dist/ab.html)');

const call = async (method, ...args) => {
  const r = await request({ op: 'call', method, args });
  if (r.error) throw new Error(`${method}: ${r.error}`);
  return r.result;
};
async function reloadWith(file) {
  fs.copyFileSync(file, page);
  const st = readState();
  await request({ op: 'reload', keep: false });
  for (let i = 0; i < 600; i++) {
    const s = await request({ op: 'status' }, { port: st.port, timeoutMs: 5000 }).catch(() => null);
    if (s?.state === 'ready') return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('page did not come back');
}
async function profile(keys) {
  const r = await request({ op: 'call', method: 'simProfile', args: [SECONDS, keys, 10], cpu: true });
  if (r.error) throw new Error(r.error);
  const x = r.result;
  return { cpu: +(r.cpuMs / x.frames).toFixed(2), avg: x.avgMs, p99: x.p99Ms, max: x.maxMs, cars: x.parts.cars?.[0], people: x.parts.people?.[0], vehicles: x.vehicles };
}
const SCENE = {
  async street() {
    await call('teleport', 748, 584);
    await call('setClock', 17.4);
    await call('wanted', 0);
    await call('simulate', 3);
    return profile([]);
  },
  async drive() {
    await call('wanted', 0);
    await call('setClock', 12);
    await call('drive', 'sedan');
    await call('simulate', 2, ['KeyW']);
    return profile(['KeyW']);
  },
  async chase() {
    await call('wanted', 5);
    await call('simulate', 12, ['KeyW']);
    return profile(['KeyW']);
  },
  async fight() {
    await call('wanted', 0);
    await call('teleport', 748, 584);
    await call('arm', 0);
    await call('wanted', 4);
    for (let i = 0; i < 3; i++) await call('hostileGunman', 90 + i * 25, -60 + i * 40, 60);
    await call('simulate', 4);
    return profile(['KeyF']);
  },
};
const results = { A: {}, B: {} };
for (const [n, which] of ORDER.entries()) {
  const file = which === 'A' ? files[0] : files[1];
  process.stdout.write(`run ${n + 1} (${which} = ${path.basename(file)}): `);
  await reloadWith(file);
  await call('holdSimulation', true);
  await call('seedRandom', 11 + n);
  const line = [];
  for (const s of SCENARIOS) {
    const r = await SCENE[s]();
    (results[which][s] ||= []).push(r);
    line.push(`${s} ${r.cpu} ms (p99 ${r.p99}, ${r.vehicles} veh)`);
  }
  console.log(line.join(' | '));
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log('\nCPU ms per 60 fps frame of update(), median [min] over runs (A = ' + path.basename(files[0]) + ', B = ' + path.basename(files[1]) + '):');
for (const s of SCENARIOS) {
  const f = (w, k) => results[w][s].map((r) => r[k]);
  const row = (w) => `${median(f(w, 'cpu'))} [${Math.min(...f(w, 'cpu'))}]`;
  const a = median(f('A', 'cpu')),
    b = median(f('B', 'cpu'));
  console.log(`  ${s.padEnd(7)} A ${row('A').padEnd(14)} B ${row('B').padEnd(14)} ${(((b - a) / a) * 100).toFixed(1)}%   cars section ${median(f('A', 'cars'))} -> ${median(f('B', 'cars'))}   people ${median(f('A', 'people'))} -> ${median(f('B', 'people'))}   p99 ${median(f('A', 'p99'))} -> ${median(f('B', 'p99'))}`);
}
