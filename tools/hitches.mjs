// Hiccup scenario: drives the running dev page through one fixed tour (district changes, a bridge, the county, traffic,
// a three-star chase, a crash and a blast, out of the car and back in, rain at night, the map and the pause menu) and
// records every frame with the console's hitchRun (src/frame-trace.js): frame times, long frames and their causes.
//
//   node tools/dev.mjs start [--render] [--size 480x300]     # the page to measure (no-render: simulation, HUD, DOM)
//   node tools/hitches.mjs [--tiers low,medium,high,ultra,auto] [--stages walk,drive,...] [--scale 1] [--tag base]
//                          [--live] [--seed 1] [--json]
//   node tools/hitches.mjs --ab A.html B.html [--order ABBA] [...]   # A/B on one server started with dist/ab.html
//   --counts: on a rendered page, the draw calls, shadow calls, triangles, programs and upload churn after every stage.
//   --hash: stateHash() after every stage; on a page started with `dev.mjs start --seed 1` (seeded Math.random, the
//   simulation held from the first frame) every boot holds the same world, so equal hashes in an A/B prove a change
//   left the simulation exactly as it was.
//
// Stepped (default): each stage is console-stepped frames at 1/60 s (input, update, HUD and, on a rendered page, the
// draw), so a seeded run replays the same world; the page CPU of each stage comes from its thread time (a busy machine
// inflates wall-clock ms, not that). --live records the page's own frames instead, for --scale x the stage's seconds of
// wall clock, and adds the browser's style recalculation and layout time (CDP Performance metrics), which stepped
// frames never pay. --scale shortens or lengthens every stage (rendered pages under software GL: 0.2).
// Writes dist/hitches/<tag>.json (every stage's report) and prints one table per tier.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request, readState } from './dev.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};
const flag = (name) => argv.includes('--' + name);
const TIERS = opt('tiers', '').split(',').filter(Boolean);
const SCALE = Number(opt('scale', 1));
const TAG = opt('tag', 'hitches');
const LIVE = flag('live');
const SEED = Number(opt('seed', 1));
if (!readState()) throw new Error('no dev server running (node tools/dev.mjs start)');

async function call(method, ...args) {
  const r = await request({ op: 'call', method, args });
  if (r.error) throw new Error(`${method}: ${r.error}`);
  return r.result;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stageCpu = 0;
// One measured step of a stage: stepped frames (hitchRun, appending to the stage's trace) or live frames.
async function measure(seconds, held = [], first = false) {
  const s = Math.max(0.05, seconds * SCALE);
  if (LIVE) {
    await call('frameTrace', 'start', held);
    await sleep(s * 1000);
    return call('frameTrace', 'stop');
  }
  const r = await request({ op: 'call', method: 'hitchRun', args: [s, held, 10, !first], cpu: true });
  if (r.error) throw new Error('hitchRun: ' + r.error);
  stageCpu += r.cpuMs || 0;
  return r.result;
}
async function here() {
  const st = await call('status');
  return { x: st.x, y: st.y };
}

// The tour. Each stage sets itself up with console calls, then measures one or more steps (one report per stage).
const STAGES = {
  async walk() {
    await call('teleport', 748, 584);
    return measure(6, ['KeyW'], true);
  },
  async districts() {
    const spots = [[2176, -3289], [-1800, 1700], [3000, 4000], [7400, -3000], [418, 4400], [2400, 1500], [5000, 9300], [748, 584]];
    let r = null;
    for (let i = 0; i < spots.length; i++) {
      await call('teleport', spots[i][0], spots[i][1]);
      r = await measure(1.5, ['KeyD'], i === 0);
    }
    return r;
  },
  async drive() {
    await call('teleport', 1400, 900);
    await call('drive', 'sedan', 0, 0);
    await call('launch', 18);
    return measure(8, ['KeyW'], true);
  },
  async bridge() {
    await call('teleport', 330, 1160);
    await call('drive', 'coupe', 0, Math.PI);
    await call('launch', 25);
    return measure(6, ['KeyW'], true);
  },
  async county() {
    await call('teleport', 7000, 3282);
    await call('drive', 'suv', 0, 0);
    await call('launch', 20);
    return measure(6, ['KeyW'], true);
  },
  async chase() {
    await call('teleport', 1400, 900);
    await call('drive', 'sedan', 0, Math.PI / 2);
    await call('wanted', 3);
    await call('launch', 15);
    return measure(10, ['KeyW'], true);
  },
  async crash() {
    await call('stageCrash', 20);
    return measure(3, [], true);
  },
  async blast() {
    const p = await here();
    await call('blast', p.x + 60, p.y + 20, 1);
    return measure(3, [], true);
  },
  async carOutIn() {
    await call('wanted', 0);
    await call('interact');
    await measure(1.5, [], true);
    await call('interact');
    return measure(1.5, []);
  },
  async rainNight() {
    await call('setClock', 21.5);
    await call('weatherFront', 0.1);
    return measure(8, ['KeyW'], true);
  },
  async map() {
    await measure(0.5, [], true);
    await call('cityMap', true);
    await measure(2, []);
    await call('cityMap', false);
    return measure(1, []);
  },
  async pause() {
    await call('pauseMenu', true);
    await measure(2, [], true);
    await call('pauseMenu', false);
    return measure(1, []);
  },
};
const ORDER = opt('stages', Object.keys(STAGES).join(',')).split(',');

const r1 = (v) => (v == null ? '' : String(+(+v).toFixed(1)));
function row(cells, widths) {
  return cells.map((c, i) => String(c).padEnd(widths[i])).join(' ');
}
async function runTier(tier) {
  if (tier) await call('graphics', tier);
  await call('seedRandom', SEED);
  await call('god', true);
  await call('wanted', 0);
  await call('setClock', 12);
  const out = {};
  for (const name of ORDER) {
    if (!STAGES[name]) throw new Error('unknown stage ' + name + ' (' + Object.keys(STAGES).join(', ') + ')');
    stageCpu = 0;
    const r = await STAGES[name]();
    out[name] = { ...r, cpuMsPerFrame: !LIVE && r.frames ? +(stageCpu / r.frames).toFixed(2) : null };
    if (flag('hash')) out[name].hash = await call('stateHash');
    // --counts (rendered pages): the renderer's counters at the end of the stage (draw calls in the view and the shadow
    // pass, triangles, programs, the render scale) and the buffers and textures re-sent per frame (uploadChurn).
    if (flag('counts')) {
      const st = await call('stats'),
        churn = await call('uploadChurn', 6);
      out[name].counts = { viewCalls: st.viewCalls, shadowCalls: st.shadowCalls, triangles: st.triangles, programs: st.programs, renderScale: st.renderScale, churnKBPerFrame: churn ? churn.kbPerFrame : null };
    }
  }
  return out;
}

// --ab: each build's HTML is copied over the server's page file and the page reloaded (no second browser), runs in the
// --order given; the table is the median of each build's runs per stage, and the counters per frame over the tour.
const AB = argv.indexOf('--ab') >= 0 ? argv.slice(argv.indexOf('--ab') + 1, argv.indexOf('--ab') + 3) : null;
if (AB) {
  const page = readState().html,
    order = opt('order', 'ABBA').split(''),
    runs = { A: [], B: [] },
    median = (list) => {
      const v = list.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
      return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
    };
  for (const which of order) {
    fs.copyFileSync(AB[which === 'A' ? 0 : 1], page);
    await request({ op: 'reload', keep: false });
    for (let i = 0; i < 900; i++) {
      const st = await request({ op: 'status' }, { timeoutMs: 5000 }).catch(() => null);
      if (st?.state === 'ready') break;
      await sleep(1000);
    }
    const stages = await runTier(TIERS[0] || '');
    runs[which].push(stages);
    console.log(`${which} run ${runs[which].length} done`);
  }
  const keysOf = (stage) => ['cpuMsPerFrame', 'p95Ms', 'p99Ms', 'maxMs', 'long', 'over33'],
    perFrame = (stages, k) => {
      let sum = 0,
        frames = 0;
      for (const r of Object.values(stages)) {
        sum += (r.totals && r.totals[k]) || 0;
        frames += r.frames || 0;
      }
      return frames ? sum / frames : null;
    };
  console.log(`\nA = ${path.relative(ROOT, AB[0])}, B = ${path.relative(ROOT, AB[1])}; medians of ${runs.A.length} / ${runs.B.length} runs`);
  console.log(row(['stage', 'cpu/frame A>B', 'p95 A>B', 'p99 A>B', 'max A>B', 'long A>B', '>33 A>B'], [10, 14, 13, 13, 13, 10, 10]));
  for (const name of ORDER) {
    const cells = keysOf().map((k) => `${r1(median(runs.A.map((s) => s[name][k])))}>${r1(median(runs.B.map((s) => s[name][k])))}`);
    console.log(row([name, ...cells], [10, 14, 13, 13, 13, 10, 10]));
  }
  if (flag('hash'))
    for (const name of ORDER) {
      const hashes = [...runs.A, ...runs.B].map((s) => s[name].hash);
      console.log(`  ${name.padEnd(10)} stateHash ${new Set(hashes).size === 1 ? 'equal in every run' : 'DIFFERS: ' + order.map((w, i) => w + ':' + (i < runs.A.length + runs.B.length ? '' : '')).join('') + JSON.stringify({ A: runs.A.map((s) => s[name].hash), B: runs.B.map((s) => s[name].hash) })}`);
    }
  for (const k of ['allocKB', 'gcMB', 'dom', 'bufMB', 'texMB', 'models', 'geometries', 'textures', 'programs', 'audioNodes', 'canvasText'])
    console.log(`  ${k} per frame: ${r1(median(runs.A.map((s) => perFrame(s, k))) * (k.endsWith('MB') ? 1024 : 1))} > ${r1(median(runs.B.map((s) => perFrame(s, k))) * (k.endsWith('MB') ? 1024 : 1))}${k.endsWith('MB') ? ' (KB)' : ''}`);
  fs.mkdirSync(path.join(ROOT, 'dist', 'hitches'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist', 'hitches', TAG + '-ab.json'), JSON.stringify({ A: AB[0], B: AB[1], order, runs }, null, 1));
  process.exit(0);
}

const results = { tag: TAG, live: LIVE, scale: SCALE, seed: SEED, at: new Date().toISOString(), tiers: {} };
const widths = [10, 6, 7, 6, 6, 6, 7, 5, 5, 34, 30];
for (const tier of TIERS.length ? TIERS : ['']) {
  const m0 = LIVE ? (await request({ op: 'metrics' })).result : null;
  const stages = await runTier(tier);
  const m1 = LIVE ? (await request({ op: 'metrics' })).result : null;
  results.tiers[tier || 'current'] = { stages, browser: m0 && m1 ? Object.fromEntries(['RecalcStyleDuration', 'RecalcStyleCount', 'LayoutDuration', 'LayoutCount', 'ScriptDuration', 'TaskDuration', 'ThreadTime'].map((k) => [k, +(m1[k] - m0[k]).toFixed(1)])) : null };
  console.log(`\n${tier || 'current tier'} (${LIVE ? 'live frames' : 'stepped frames'}, scale ${SCALE})`);
  console.log(row(['stage', 'frames', 'cpu/fr', 'p50', 'p95', 'p99', 'max', 'long', '>33', 'long frames: section (count)', 'tags (count)'], widths));
  for (const [name, r] of Object.entries(stages)) {
    const causes = Object.entries(r.causes || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
    const tags = Object.entries(r.tags || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
    console.log(row([name, r.frames, r1(r.cpuMsPerFrame), r1(r.p50Ms), r1(r.p95Ms), r1(r.p99Ms), r1(r.maxMs), r.long, r.over33, causes, tags], widths) + (r.hash ? ' ' + r.hash : ''));
    if (r.counts) console.log('           counts ' + JSON.stringify(r.counts) + ' perFrame ' + JSON.stringify({ texKB: r1(((r.totals.texMB || 0) * 1024) / r.frames), bufKB: r1(((r.totals.bufMB || 0) * 1024) / r.frames), models: r1((r.totals.models || 0) / r.frames), geometries: r1((r.totals.geometries || 0) / r.frames), programs: r.totals.programs || 0 }));
  }
  if (results.tiers[tier || 'current'].browser) console.log('browser over the tour:', JSON.stringify(results.tiers[tier || 'current'].browser));
}
fs.mkdirSync(path.join(ROOT, 'dist', 'hitches'), { recursive: true });
const file = path.join(ROOT, 'dist', 'hitches', TAG + '.json');
fs.writeFileSync(file, JSON.stringify(results, null, 1));
console.log('\nwrote ' + path.relative(ROOT, file));
if (flag('json')) console.log(JSON.stringify(results));
