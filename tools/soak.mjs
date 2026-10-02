// Long-session soak: a seeded bot plays the running dev page through the console for N game minutes (walks,
// drives, shoots, runs people over, blows things up, gets chased and busted, dies and wakes at a hospital,
// shops, rides, flies, jumps, changes weather and time, opens menus, saves, starts the first two jobs) and
// records, every `--every` game seconds, the JS heap after a full collection, DOM nodes, event listeners, live
// Web Audio nodes, the size of every list / log / cache the game appends to (DeadEndCity.soakReport()),
// NaN/Infinity in positions and console errors. It then prints what grew, and what slowed down.
//
//   node tools/dev.mjs reload            # a fresh page first (the dev server must be running: dev.mjs start)
//   node tools/soak.mjs [--minutes 30] [--every 30] [--seed 1] [--tag base] [--probe 300] [--out dist/soak/<tag>.json]
//   node tools/soak.mjs --table dist/soak/base.json      # print the growth table of a saved run again
//
// The page runs no-render with the frame loop held (`holdSimulation`), stepped by `simulate()`: game time is
// not wall time, so a timer that cleans up on the wall clock looks slower here than in play. Every N game
// minutes the same scene is profiled (`simProfile`, CPU ms per frame) to show a session slowing down.
import fs from 'node:fs';
import path from 'node:path';
import { request } from './dev.mjs';

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};
const MINUTES = Number(opt('minutes', 30));
const EVERY = Number(opt('every', 30));
const SEED = Number(opt('seed', 1));
const TAG = opt('tag', 'run');
const PROBE_EVERY = Number(opt('probe', 300));
const OUT = opt('out', `dist/soak/${TAG}.json`);

// ---------------------------------------------------------------------------------------------------------
// Seeded randomness: the same seed plays the same episodes (the game's own randomness is its own).
let seedState = SEED >>> 0;
function rng() {
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(rng() * list.length)];
const between = (a, b) => a + rng() * (b - a);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------------------
// Talking to the page. A console method that throws is a finding (`issues`), not the end of the run.
const issues = [];
let episode = 'start';
let gameNow = 0;
async function C(method, ...args) {
  let r;
  try {
    r = await request({ op: 'call', method, args });
  } catch (e) {
    throw new Error(`dev server: ${e.message} (calling ${method})`);
  }
  if (r.error) {
    issues.push({ at: +gameNow.toFixed(0), episode, method, args: JSON.stringify(args).slice(0, 90), error: r.error, stack: (r.stack || []).slice(0, 3) });
    return null;
  }
  return r.result;
}
const keysReal = (codes, seconds = 0.15) => request({ op: 'keys', codes, seconds, real: true });
const realWait = (seconds) => request({ op: 'wait', seconds, real: true });
const status = () => C('status');

// Steps the game; stops early when the player is no longer in play (died, busted, a menu opened).
async function sim(seconds, held = []) {
  let left = seconds;
  while (left > 0) {
    const s = Math.min(left, 10);
    await C('simulate', s, held);
    left -= s;
    const st = await status();
    if (!st || st.mode !== 'play') return false;
  }
  return true;
}

// Back to free roam from wherever an episode left the game.
async function recover() {
  for (let i = 0; i < 10; i++) {
    const st = await status();
    if (!st) return false;
    if (st.mode === 'play') return true;
    if (st.mode === 'dead') await realWait(1.5);
    else {
      await keysReal([['Escape', 'KeyE', 'Enter'][i % 3]]);
      if (i > 2) await C('pauseMenu', false);
      await C('closeDealer');
    }
  }
  const st = await status();
  return st?.mode === 'play';
}

// ---------------------------------------------------------------------------------------------------------
// The world the bot knows: named doors and a few far places.
let PLACES = [];
const SPOTS = [
  ['midtown', 748, 584], ['harbor', 3000, 4000], ['beach', 900, 2900], ['stadium', 2400, 1500], ['palm keys', -1800, 1700],
  ['north point', 2176, -3289], ['monarch isle', 7400, -3000], ['county', 7000, 3282], ['airport', 418, 4400],
  ['oceanview', 5000, 9300], ['cruise terminal', 2480, -3968], ['downtown', 1400, 900], ['old quarter', 360, 535],
];
const CARS = ['sedan', 'taxi', 'coupe', 'muscle', 'sport', 'roadster', 'rally', 'hotrod', 'supercar', 'luxury', 'limousine', 'suv', 'van', 'pickup', 'truck', 'bus', 'ambulance', 'bike', 'cruiser', 'kr500', 'police'];
const GUNS = [0, 1, 2, 3, 4, 5];

async function here() {
  const st = await status();
  return st ? { x: st.x, y: st.y } : { x: 748, y: 584 };
}
async function ready() {
  await C('god', false);
  await C('heal', 0);
  const st = await status();
  if (st && st.cash < 2000) await C('setCash', 5000);
}

// ---------------------------------------------------------------------------------------------------------
// Episodes. Each is a short scripted stretch of play (5-60 game seconds).
const EPISODES = {
  async walk() {
    for (let i = 0; i < 4; i++) {
      await C('walk', rng() * TAU, between(60, 260));
      if (!(await sim(between(1, 4), [pick(['KeyW', 'KeyD', 'KeyA', 'KeyS'])]))) return;
    }
  },
  async idle() {
    await sim(between(20, 60));
  },
  async tour() {
    const [name, x, y] = pick(SPOTS);
    if (rng() < 0.5) await C('godTeleport', x + between(-300, 300), y + between(-300, 300));
    else await C('teleport', x, y);
    await sim(between(4, 14));
    await C('walk', rng() * TAU, between(40, 160));
    await sim(between(2, 6), ['KeyW']);
  },
  async drive() {
    await C('drive', pick(CARS));
    for (let i = 0; i < 4; i++) {
      const keys = ['KeyW'];
      if (rng() < 0.5) keys.push(rng() < 0.5 ? 'KeyA' : 'KeyD');
      if (rng() < 0.15) keys.push('Space');
      if (!(await sim(between(2, 6), keys))) return;
    }
    const p = await here();
    await C('steerTo', p.x + between(-800, 800), p.y + between(-800, 800), between(6, 14), 40, false);
    await C('interact');
  },
  async roadTrip() {
    await C('drive', pick(['sedan', 'sport', 'supercar', 'pickup']));
    const [, x, y] = pick(SPOTS);
    await C('steerTo', x, y, 25, 80, false);
    await sim(3, ['KeyW']);
  },
  async runOver() {
    await C('drive', pick(['sport', 'muscle', 'suv', 'truck']));
    for (let i = 0; i < 3; i++) {
      const near = (await C('nearbyPeople', 500, 'civilian')) || [];
      const v = near[Math.min(near.length - 1, Math.floor(rng() * 3))];
      if (!v) break;
      await C('steerTo', v.x, v.y, 5, 24, true);
    }
    await sim(3, ['KeyW']);
  },
  async shoot() {
    await C('arm', pick(GUNS));
    const p = await here();
    for (let i = 0; i < 6; i++) await C('shootAt', p.x + between(-150, 150), p.y + between(-150, 150), pick(GUNS));
    await sim(between(3, 8), ['KeyF']);
  },
  async firefight() {
    await C('arm', pick([0, 1, 2, 3]));
    for (let i = 0; i < 3; i++) await C('hostileGunman', between(-200, 200), between(-200, 200), 20);
    await C('heal', 50);
    await sim(between(10, 25), ['KeyF']);
  },
  async explosions() {
    const p = await here();
    for (let i = 0; i < 4; i++) await C('blast', p.x + between(-250, 250), p.y + between(-250, 250), between(0.5, 3));
    await sim(between(8, 20));
  },
  async carFire() {
    const p = await here();
    await C('park', pick(CARS), 80, 0, 0);
    await C('park', 'sedan', 80, 40, 0);
    for (let i = 0; i < 3; i++) await C('blast', p.x + 80, p.y + between(-20, 40), 1);
    await sim(between(20, 40));
  },
  async chase() {
    await C('wanted', 3 + Math.floor(rng() * 3));
    await C('drive', pick(['sedan', 'sport', 'muscle']));
    for (let i = 0; i < 5; i++) {
      const keys = ['KeyW'];
      if (rng() < 0.6) keys.push(rng() < 0.5 ? 'KeyA' : 'KeyD');
      if (!(await sim(between(3, 7), keys))) return;
    }
    await C('wanted', 0);
  },
  async onFootChase() {
    await C('wanted', 2 + Math.floor(rng() * 3));
    await C('arm', pick(GUNS));
    for (let i = 0; i < 4; i++) {
      await C('walk', rng() * TAU, 120);
      if (!(await sim(between(3, 6), ['KeyF', 'KeyW']))) return;
    }
    await C('wanted', 0);
  },
  async bust() {
    await C('arm', 7);
    await C('wanted', 2);
    await sim(60);
    if ((await status())?.mode === 'dead') await realWait(4.8);
    await C('wanted', 0);
  },
  async die() {
    await C('god', false);
    const p = await here();
    await C('blast', p.x, p.y, 3);
    await sim(1);
    await realWait(4.8);
    await sim(1);
  },
  async shop() {
    const place = pick(PLACES);
    if (!place?.door) return;
    await C('teleport', place.door.x, place.door.y);
    await sim(1);
    await C('interact');
    await realWait(0.2);
    await keysReal(['Digit1']);
    await keysReal(['KeyE']);
    await recover();
  },
  async hospital() {
    const places = PLACES.filter((p) => p.kind === 'hospital' || p.kind === 'diner' || p.kind === 'bar' || p.kind === 'sleep');
    const place = pick(places);
    if (!place?.door) return;
    await C('heal', 0);
    await C('teleport', place.door.x, place.door.y);
    await C('interact');
    await keysReal(['Digit1']);
    await keysReal(['KeyE']);
    await recover();
  },
  async transit() {
    await C('wanted', 0);
    await C('boardTrain', Math.floor(rng() * 6), Math.floor(rng() * 6));
    await C('advanceTrains', between(10, 60));
    await sim(between(4, 12));
    if (rng() < 0.6) {
      await C('skipRide');
      await sim(3);
    }
    await recover();
  },
  async cab() {
    await C('wanted', 0);
    const [, x, y] = pick(SPOTS);
    await C('teleport', x, y);
    await C('cab', x + between(-500, 500), y + between(-500, 500));
    await sim(between(8, 25));
    if (rng() < 0.5) await C('skipRide');
    await sim(4);
    await recover();
  },
  async fly() {
    await C('wanted', 0);
    await C('drive', pick(['helicopter', 'plane', 'helicopter']), 150);
    for (let i = 0; i < 4; i++) {
      const keys = ['KeyW'];
      if (rng() < 0.5) keys.push(rng() < 0.5 ? 'KeyA' : 'KeyD');
      if (!(await sim(between(3, 8), keys))) return;
    }
    await C('bailOut', between(150, 400));
    await sim(between(6, 20));
    await C('openParachute');
    await sim(between(8, 30));
  },
  async boat() {
    const [, x, y] = pick(SPOTS.slice(0, 5));
    await C('teleport', x, y);
    await C('drive', pick(['speedboat', 'workboat', 'jetski']));
    for (let i = 0; i < 3; i++) if (!(await sim(between(3, 7), ['KeyW', rng() < 0.5 ? 'KeyA' : 'KeyD']))) return;
    await C('interact');
  },
  async weather() {
    await C('weatherFront', 3);
    await C('setClock', between(0, 24));
    await C('wetness', rng());
    await sim(between(6, 18));
    await C('lightning', between(100, 600));
    await sim(between(4, 10));
  },
  async menus() {
    await C('pauseMenu', true);
    await C('openSettings', pick(['graphics', 'audio', 'gameplay', 'driving', 'controls']));
    await keysReal(['Escape']);
    await keysReal(['Escape']);
    await recover();
    await keysReal(['Tab'], 0.2);
    await C('mapView', { layer: 'police', on: rng() < 0.5 });
    await keysReal(['Tab'], 0.2);
    await keysReal(['Slash'], 0.2);
    await keysReal(['Escape'], 0.2);
    await keysReal(['KeyI'], 0.2);
    await keysReal(['Escape'], 0.2);
    await C('pauseMenu', true);
    await C('pauseMenu', false);
    await recover();
    await sim(2);
  },
  async mission() {
    await C('startMission', rng() < 0.5 ? 0 : 1);
    await sim(between(6, 20));
    await C('missionTargets');
    await C('boardMissionVehicle');
    await sim(between(6, 20), ['KeyW']);
    if (rng() < 0.6) {
      await C('pauseMenu', true);
      await C('retryMission');
      await recover();
      await sim(between(3, 10));
    }
    if (rng() < 0.4) await C('skipToDepotDelivery');
    await sim(between(3, 10));
  },
  async witnesses() {
    await C('wanted', 0);
    await C('witnessStage', 6, 1, 600, false, false, true);
    const p = await here();
    await C('shootAt', p.x + 40, p.y, 0);
    await sim(between(10, 25));
    await C('wanted', 0);
  },
  async carjack() {
    await C('carjackTarget', pick(['sedan', 'taxi', 'sport']), pick(['flee', 'angry', 'defiant', 'plead']));
    await C('interact');
    await sim(between(8, 16));
    await C('interact');
  },
  async bikes() {
    await C('bike', rng() * TAU);
    await C('drive', 'bicycle');
    await sim(between(3, 8), ['KeyW']);
    await C('interact');
  },
  async tank() {
    await C('drive', pick(['tank', 'flatbed']));
    await sim(between(4, 10), ['KeyW']);
    await C('interact');
  },
};
// How often each episode comes up (a long list of light ones, the heavy scenes now and then).
const WEIGHTS = {
  walk: 5, idle: 3, tour: 6, drive: 6, roadTrip: 3, runOver: 3, shoot: 3, firefight: 2, explosions: 3, carFire: 2,
  chase: 3, onFootChase: 2, bust: 1, die: 1, shop: 3, hospital: 2, transit: 2, cab: 2, fly: 2, boat: 2, weather: 3,
  menus: 3, mission: 2, witnesses: 1, carjack: 2, bikes: 1, tank: 1,
};
const BAG = Object.entries(WEIGHTS).flatMap(([name, w]) => Array(w).fill(name));

// ---------------------------------------------------------------------------------------------------------
// Records.
const records = [];
const probes = [];
const errorLog = [];
const episodeLog = [];
let lastRecordWall = Date.now();
let lastRecordGame = 0;

async function record(label) {
  const rep = await C('soakReport');
  if (!rep) return null;
  const heapReply = await request({ op: 'heap' });
  const heap = heapReply.result || {};
  const errs = (await request({ op: 'errors' })).result || [];
  for (const e of errs) errorLog.push({ at: +rep.gameTime.toFixed(0), episode, text: e.slice(0, 400) });
  const wall = Date.now();
  const rec = {
    label,
    gameTime: rep.gameTime,
    clock: rep.clock,
    wallSecondsPerGameMinute: lastRecordGame < rep.gameTime ? +(((wall - lastRecordWall) / 1000) / ((rep.gameTime - lastRecordGame) / 60)).toFixed(2) : null,
    heapMB: heap.usedMB,
    domNodes: heap.domNodes,
    listeners: heap.listeners,
    audioNodes: heap.audioNodes,
    audioCreated: heap.audioCreated,
    lists: rep.lists,
    counts: rep.counts,
    domTotal: rep.dom.total,
    domTop: rep.dom.top,
    bad: rep.bad,
    newErrors: errs.length,
    hash: await C('stateHash'),
  };
  lastRecordWall = Date.now();
  lastRecordGame = rep.gameTime;
  records.push(rec);
  return rec;
}

// A fixed scene, profiled the same way every time: CPU ms per simulated frame (a busy machine does not inflate it).
async function probe() {
  await C('teleport', 748, 584);
  await C('setClock', 12);
  await C('wanted', 0);
  await C('heal', 0);
  await sim(2);
  const r = await request({ op: 'call', method: 'simProfile', args: [4, [], 6], cpu: true });
  if (r.error || !r.result) return null;
  const out = {
    gameTime: gameNow,
    cpuMsPerFrame: r.cpuMs != null ? +(r.cpuMs / r.result.frames).toFixed(2) : null,
    avgMs: r.result.avgMs,
    p99Ms: r.result.p99Ms,
    vehicles: r.result.vehicles,
    pedestrians: r.result.pedestrians,
    parts: r.result.parts,
  };
  probes.push(out);
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// The growth table: for each series, first (after a warm-up of two records), last, max and slope per game minute.
function seriesOf(recs) {
  const series = {};
  const put = (name, i, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    (series[name] ||= [])[i] = v;
  };
  recs.forEach((r, i) => {
    put('heapMB', i, r.heapMB);
    put('domNodes (CDP)', i, r.domNodes);
    put('listeners (CDP)', i, r.listeners);
    put('audioNodes live', i, r.audioNodes);
    put('domTotal', i, r.domTotal);
    put('seconds wall / game minute', i, r.wallSecondsPerGameMinute);
    for (const [k, v] of Object.entries(r.lists)) put('list ' + k, i, v);
    for (const [k, v] of Object.entries(r.counts)) put('count ' + k, i, v);
    for (const [k, v] of Object.entries(r.domTop || {})) put('dom ' + k, i, v);
  });
  return series;
}
function slope(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n,
    my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den ? num / den : 0;
}
function growthTable(recs) {
  const warm = Math.min(2, Math.max(0, recs.length - 3));
  const use = recs.slice(warm);
  const rows = [];
  for (const [name, all] of Object.entries(seriesOf(recs))) {
    const ys = [],
      xs = [];
    all.forEach((v, i) => {
      if (i >= warm && v !== undefined) {
        ys.push(v);
        xs.push(recs[i].gameTime / 60);
      }
    });
    if (ys.length < 3) continue;
    const first = ys[0],
      last = ys[ys.length - 1],
      max = Math.max(...ys),
      min = Math.min(...ys),
      s = slope(xs, ys);
    // Share of the steps that did not go down: a leak climbs, a cache that fills or a busy scene wobbles.
    let ups = 0;
    for (let i = 1; i < ys.length; i++) if (ys[i] >= ys[i - 1]) ups++;
    rows.push({ name, first, last, min, max, slopePerMin: s, monotonic: +(ups / (ys.length - 1)).toFixed(2), growth: last - first });
  }
  return rows;
}
function printTable(recs) {
  const rows = growthTable(recs).filter((r) => r.max > 0);
  const flagged = rows
    .filter((r) => r.growth > Math.max(3, 0.1 * Math.max(1, r.first)) && r.slopePerMin > 0 && r.monotonic >= 0.6)
    .sort((a, b) => b.growth / Math.max(1, b.first) - a.growth / Math.max(1, a.first));
  const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)).padStart(8);
  console.log('\nGROWTH (flagged: grew > 10% and 3, rising slope, at least 60% of the steps not falling):');
  console.log('  ' + 'series'.padEnd(34) + 'first'.padStart(8) + 'last'.padStart(8) + 'min'.padStart(8) + 'max'.padStart(8) + '  per min  up-steps');
  for (const r of flagged) console.log('  ' + r.name.padEnd(34) + fmt(r.first) + fmt(r.last) + fmt(r.min) + fmt(r.max) + fmt(r.slopePerMin) + '    ' + r.monotonic);
  if (!flagged.length) console.log('  (nothing flagged)');
  console.log('\nALL SERIES (first -> last, max):');
  console.log(
    rows
      .filter((r) => !flagged.includes(r) && (r.max > 0 || r.first > 0))
      .map((r) => `${r.name} ${r.first.toFixed(r.max < 20 ? 1 : 0)}->${r.last.toFixed(r.max < 20 ? 1 : 0)} (max ${r.max.toFixed(r.max < 20 ? 1 : 0)})`)
      .join('\n')
      .slice(0, 6000),
  );
}

// ---------------------------------------------------------------------------------------------------------
async function main() {
  if (opt('table')) {
    const saved = JSON.parse(fs.readFileSync(opt('table'), 'utf8'));
    printTable(saved.records);
    for (const p of saved.probes || []) console.log(`probe at ${Math.round(p.gameTime / 60)} min: ${p.cpuMsPerFrame} ms CPU / frame (avg ${p.avgMs}, p99 ${p.p99Ms}; ${p.vehicles} vehicles, ${p.pedestrians} people)`);
    return;
  }
  const t0 = Date.now();
  console.log(`soak ${TAG}: ${MINUTES} game minutes, a record every ${EVERY} s, seed ${SEED}`);
  await C('holdSimulation', true);
  // The game's own randomness seeded too: the same bot seed then plays the same world on every run and build,
  // and the state hashes of two runs can be compared (a difference is a change of behaviour).
  if (argv.indexOf('--no-seed') < 0) await C('seedRandom', SEED);
  await request({ op: 'errors' });
  PLACES = (await C('places')) || [];
  const first = await C('soakReport');
  if (!first) throw new Error('soakReport is missing: is the dev page running this build?');
  const startGame = first.gameTime;
  gameNow = startGame;
  await C('setCash', 5000);
  await record('start');
  let nextRecord = startGame + EVERY,
    nextProbe = startGame + PROBE_EVERY,
    n = 0;
  const endGame = startGame + MINUTES * 60;
  const p0 = await probe();
  if (p0) console.log(`probe 0: ${p0.cpuMsPerFrame} ms CPU / frame`);
  while (gameNow < endGame) {
    episode = pick(BAG);
    const before = gameNow;
    const wall0 = Date.now();
    try {
      await ready();
      await EPISODES[episode]();
      await recover();
    } catch (e) {
      issues.push({ at: +gameNow.toFixed(0), episode, method: '(bot)', args: '', error: String(e.message || e).slice(0, 200) });
      if (/dev server/.test(String(e.message))) break;
    }
    const rep = await C('soakReport');
    gameNow = rep ? rep.gameTime : gameNow;
    episodeLog.push({ n: n++, episode, game: +(gameNow - before).toFixed(1), wallSeconds: +((Date.now() - wall0) / 1000).toFixed(1) });
    if (gameNow >= nextRecord) {
      const rec = await record(episode);
      if (rec) {
        console.log(
          `[${String(Math.round((gameNow - startGame) / 60)).padStart(2)} min] ${rec.clock} heap ${rec.heapMB} MB, dom ${rec.domNodes}, listeners ${rec.listeners}, audio ${rec.audioNodes}, ` +
            `vehicles ${rec.lists.vehicles}, people ${rec.lists.pedestrians}, blood ${rec.lists.bloodPools}, skids ${rec.lists.skids}, debris ${rec.lists.debris}` +
            `${rec.bad.count ? ', BAD ' + rec.bad.first : ''}${rec.newErrors ? ', ' + rec.newErrors + ' errors' : ''} (${rec.wallSecondsPerGameMinute} s wall / game min)`,
        );
      }
      nextRecord = gameNow + EVERY;
    }
    if (gameNow >= nextProbe) {
      const p = await probe();
      if (p) console.log(`  probe at ${Math.round((gameNow - startGame) / 60)} min: ${p.cpuMsPerFrame} ms CPU / frame (avg ${p.avgMs}, p99 ${p.p99Ms}; ${p.vehicles} vehicles)`);
      nextProbe = gameNow + PROBE_EVERY;
    }
  }
  await C('holdSimulation', false);
  await record('end');
  const out = { tag: TAG, seed: SEED, minutes: MINUTES, wallSeconds: Math.round((Date.now() - t0) / 1000), records, probes, issues, errorLog, episodeLog };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  printTable(records);
  console.log(`\nEPISODES: ${Object.entries(episodeLog.reduce((m, e) => ((m[e.episode] = (m[e.episode] || 0) + 1), m), {})).map(([k, v]) => k + ' ' + v).join(', ')}`);
  const bad = records.filter((r) => r.bad.count);
  console.log(`\nNON-FINITE POSITIONS: ${bad.length ? bad.map((r) => `${Math.round(r.gameTime)}s ${r.bad.first}`).join('; ') : 'none'}`);
  console.log(`CONSOLE ERRORS: ${errorLog.length}`);
  for (const e of errorLog.slice(0, 12)) console.log(`  ${e.at}s ${e.episode}: ${e.text.split('\n')[0]}`);
  console.log(`BOT ISSUES (console methods that threw): ${issues.length}`);
  const seen = new Set();
  for (const i of issues) {
    const key = i.method + i.error;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${i.at}s ${i.episode}: ${i.method}(${i.args}) -> ${i.error}${i.stack?.length ? '\n      ' + i.stack.join('\n      ') : ''}`);
    if (seen.size > 20) break;
  }
  console.log(`\nstate hashes: ${records.filter((_, i) => i % Math.max(1, Math.floor(records.length / 8)) === 0).map((r) => Math.round(r.gameTime) + 's ' + r.hash).join(', ')}`);
  console.log(`\nsaved ${OUT} (${Math.round((Date.now() - t0) / 1000)} s wall)`);
}

main().catch((e) => {
  console.error('soak failed: ' + (e.stack || e.message || e));
  process.exit(1);
});
