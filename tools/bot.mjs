// Random-walk bot for free roam (the public demo's gate live): plays random plausible actions on the dev page
// for N game minutes and checks the game after every one of them.
//
//   node tools/bot.mjs [--seed N] [--minutes M] [--wall S] [--render] [--keep] [--only a,b] [--verbose]
//
// Starts (or reuses) the dev server with ?test&norender, then loops: pick an action by weight (teleport to a
// random island, walk, drive any vehicle class, shoot, run people over, raise the police, die or get busted,
// open menus and press random keys, change weather / time / graphics / settings, take rides, swim, fall, save and
// reload), run it through the console and the real keyboard, and check: console errors, DeadEndCity.integrity()
// (non-finite state, the player inside solid geometry, below the ground or off the map, vehicles listed twice...),
// a mode that never returns to play, a carrier (fall, parachute, carjack...) held too long, and a no-progress
// watchdog (nothing moves the player any way). The choices follow the seed (the game's own randomness is not
// seeded). Findings print as they happen and in a summary; exit status 1 when there are any.
// Output: dist/bot/seed-<n>.json (findings with the last actions before each one).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readState, request, start } from './dev.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};
const SEED = Number(arg('seed', 1));
const MINUTES = Number(arg('minutes', 30));
const WALL = Number(arg('wall', 0));
const VERBOSE = argv.includes('--verbose');
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const FLAGS = argv.includes('--render') ? 'test' : 'test&norender';

// ---------------------------------------------------------------------------------------------
// Seeded choices.
let seedState = SEED >>> 0;
function rnd() {
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (a, b) => a + rnd() * (b - a);
const chance = (p) => rnd() < p;
const pickWeighted = (table) => {
  let r = rnd() * table.reduce((s, [, w]) => s + w, 0);
  for (const [item, w] of table) if ((r -= w) < 0) return item;
  return table[0][0];
};

// ---------------------------------------------------------------------------------------------
// The page.
async function op(o) {
  const reply = await request(o);
  if (reply.error) throw new Error(reply.error);
  return reply.result;
}
const call = (method, ...args) => op({ op: 'call', method, args });
let simT = 0; // game seconds the bot has stepped
let realT = 0; // real seconds waited
async function sim(codes, seconds) {
  simT += seconds;
  return op({ op: 'keys', codes: [].concat(codes || []), seconds });
}
async function press(code, seconds = 0.12) {
  realT += seconds;
  return op({ op: 'keys', codes: [code], seconds, real: true });
}
async function realWait(seconds) {
  realT += seconds;
  return op({ op: 'wait', seconds, real: true });
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------------------------------------
// Findings.
const trail = [];
const findings = new Map();
const hist = {};
let actionNo = 0;
function find(kind, msg, extra = {}) {
  const key = kind + ': ' + msg.replace(/-?\d+(\.\d+)?/g, '#').slice(0, 140);
  const f = findings.get(key);
  if (f) {
    f.count++;
    return;
  }
  const entry = { kind, msg, count: 1, at: { action: actionNo, simSeconds: Math.round(simT) }, trail: trail.slice(-8), ...extra };
  findings.set(key, entry);
  console.log(`FINDING [${kind}] ${msg}\n    after ${trail.slice(-4).join(' > ')}`);
}

// Carriers held too long (game seconds) are stuck states.
const CARRIER_LIMITS = { fall: 40, parachute: 260, carjack: 40, thrown: 40, tumble: 25, climbing: 30, coaster: 400, loot: 6, rideSkip: 40, hidden: 150, conversation: 240, swimming: 220, taxi: 400, transit: 500 };
let since = {};
function watchCarriers(rep) {
  for (const [name, on] of Object.entries(rep.carriers)) {
    if (!on) {
      delete since[name];
      continue;
    }
    since[name] ??= simT;
    const limit = CARRIER_LIMITS[name];
    if (limit && simT - since[name] > limit) find('stuck-carrier', `${name} held for ${Math.round(simT - since[name])} s`);
  }
}

let lastStatus = null;
async function check(label) {
  for (const e of await op({ op: 'errors' })) find('console-error', e.split('\n').slice(0, 2).join(' | ').slice(0, 260));
  const rep = await call('integrity');
  for (const p of rep.problems) find('integrity', p);
  for (const p of rep.stuckPeople) find('stuck-person', `${p.kind} reaction ${p.t} s into ${p.dur} s (${p.state}) near the player at ${p.at}`);
  watchCarriers(rep);
  // The parked-vehicle settle shortcut must change nothing the whole settle would have.
  if (actionNo % 8 === 0 && rep.mode === 'play') {
    const audit = await call('settleAudit', 24);
    if (audit.changed) find('settle-audit', `the settle shortcut skipped real work on ${audit.changed} vehicle(s): ${JSON.stringify(audit.diffs)}`);
  }
  lastStatus = await call('status');
  if (VERBOSE) console.log(`    ${label}: ${lastStatus.mode} ${lastStatus.x},${lastStatus.y} ${lastStatus.district} hp ${lastStatus.hp} ${lastStatus.vehicle || 'foot'} stars ${lastStatus.wanted}`);
  return rep;
}

// Back to free play: WASTED and BUSTED play out in real seconds; menus close with Escape.
async function ensurePlay(why) {
  let died = false;
  let st = await call('status');
  for (let i = 0; i < 14 && st.mode !== 'play'; i++) {
    if (st.mode === 'dead') {
      died = true;
      await realWait(1);
    } else if (st.mode === 'elevator') {
      // The Blue Hour lift runs on the frame clock (1.7 s of frames): a loaded machine needs a while; simulate steps it.
      await sim([], 1);
    } else {
      await press('Escape');
      await realWait(0.2);
    }
    st = await call('status');
  }
  if (st.mode !== 'play') {
    find('mode-stuck', `mode ${st.mode} will not return to play after ${why}`);
    // Recover so the run goes on: close what we can, else reload the page.
    try {
      await call('pauseMenu', false);
      st = await call('status');
    } catch {}
    if (st.mode !== 'play') await rebootPage();
  } else if (died) await checkRespawn(why);
  return died;
}
async function rebootPage() {
  await op({ op: 'reload', flags: FLAGS });
  for (;;) {
    const s = await request({ op: 'status' });
    if (s.state === 'ready') break;
    if (s.state === 'failed') throw new Error('page failed to boot: ' + s.error);
    await new Promise((r) => setTimeout(r, 500));
  }
  since = {};
}
let hospitals = [];
async function checkRespawn(why) {
  const st = await call('status');
  if (st.hp < 55) find('respawn', `respawned with ${st.hp} hp after ${why}`);
  if (st.vehicle) find('respawn', `respawned still in a ${st.vehicle} after ${why}`);
  if (st.wanted) find('respawn', `respawned with ${st.wanted} stars after ${why}`);
  const near = Math.min(Infinity, ...hospitals.map((h) => dist(st, h)), ...(policeHq ? [dist(st, policeHq)] : []));
  if (near > 600) find('respawn', `respawned ${Math.round(near)} units from any hospital or police station (${st.district})`);
  const rep = await call('integrity');
  for (const p of rep.problems) find('integrity', 'after respawn: ' + p);
}
let policeHq = null;

// ---------------------------------------------------------------------------------------------
// The world: where to go.
let anchors = [];
let doors = [];
async function loadWorld() {
  const places = await call('places');
  hospitals = places.filter((p) => p.kind === 'hospital' && p.door).map((p) => p.door);
  doors = places.filter((p) => p.door);
  const layout = await call('layout');
  for (const region of layout.land) {
    const pts = region.polygon;
    const c = pts.reduce((a, [x, y]) => ({ x: a.x + x / pts.length, y: a.y + y / pts.length }), { x: 0, y: 0 });
    for (let i = 0; i < Math.min(6, pts.length); i++) {
      const [vx, vy] = pts[Math.floor((i * pts.length) / Math.min(6, pts.length))];
      const t = i === 0 ? 0 : 0.3 + (i % 3) * 0.2;
      anchors.push({ x: Math.round(c.x + (vx - c.x) * t), y: Math.round(c.y + (vy - c.y) * t), region: region.id });
    }
  }
  // BUSTED releases at the police HQ helipad (game-state.js HELIPADS[0]; pursuit-officers.js policeRespawnPoint).
  const pad = (await call('rooftops')).helipads?.find((h) => /POLICE HQ/.test(h.name));
  policeHq = pad ? { x: pad.x, y: pad.y } : { x: 1420, y: 4070 };
  for (const p of places) anchors.push({ x: p.door ? p.door.x : p.x, y: p.door ? p.door.y + 24 : p.y, region: p.name });
}

// ---------------------------------------------------------------------------------------------
// Actions. Each returns a short description; thrown errors become findings only when the console should not throw.
const ROAD_VEHICLES = ['sedan', 'taxi', 'coupe', 'muscle', 'sport', 'roadster', 'rally', 'hotrod', 'supercar', 'luxury', 'limousine', 'suv', 'van', 'pickup', 'truck', 'bus', 'ambulance', 'police', 'flatbed', 'chevette', 'brutini', 'cavalino', 'dolcati', 'yamasaki', 'kr500', 'bike', 'cruiser', 'bicycle', 'tank'];
const WATER_VEHICLES = ['speedboat', 'workboat', 'jetski'];
const AIR_VEHICLES = ['helicopter', 'plane'];
const MOVE_SETS = [['KeyW'], ['KeyW'], ['KeyW', 'KeyD'], ['KeyW', 'KeyA'], ['KeyS'], ['KeyD'], ['KeyA'], ['KeyW', 'Space']];
const SKY = ['clear', 'fair', 'cloudy', 'overcast', 'rain', 'storm'];

async function onFoot() {
  const st = await call('status');
  return st.vehicle === null;
}

const actions = {
  async teleport() {
    const a = pick(anchors);
    const jitter = chance(0.5) ? 0 : between(-300, 300);
    const r = await call('godTeleport', a.x + jitter, a.y + jitter * 0.7);
    // (A boat on the sea or an aircraft in the air is over "solid" ground by that test: only people and road vehicles count.)
    if (r.solidHere && (r.kind === 'foot' || r.kind === 'road')) find('teleport', `godTeleport left the player inside solid geometry at ${r.to.x},${r.to.y} (${r.district}, asked ${r.asked.x},${r.asked.y})`);
    await sim([], between(0.3, 2));
    return `${a.region} -> ${r.kind} ${r.district}`;
  },
  async walk() {
    if (!(await onFoot())) return 'skip (in a vehicle)';
    const n = Math.floor(between(1, 4));
    for (let i = 0; i < n; i++) await sim(pick(MOVE_SETS), between(1, 5));
    return `${n} legs`;
  },
  async trapCheck() {
    // Nothing may hold the player in place: some direction moves them, or something else owns them.
    const rep = await call('integrity');
    if (!rep.player.onFoot || rep.mode !== 'play') return 'skip';
    const st0 = await call('status');
    for (const k of ['KeyD', 'KeyA', 'KeyS', 'KeyW']) {
      await sim([k], 0.8);
      const st = await call('status');
      if (st.mode !== 'play') return 'skip (' + st.mode + ')';
      if (dist(st, st0) > 6) return 'moves ' + k;
    }
    const prompt = await call('promptState');
    find('trapped', `no direction moves the player at ${st0.x},${st0.y} (${st0.district}); prompt ${prompt.text}`);
    return 'TRAPPED';
  },
  async drive() {
    const cur = await call('status');
    // An aircraft left in the sky flies on for ever (the console's drive() steps out first): bail out of it.
    if (['helicopter', 'plane'].includes(cur.vehicle)) {
      await press('KeyJ');
      await sim([], 1.5);
    }
    const kind = pickWeighted([['road', 8], ['water', 1.5], ['air', 1.5]]);
    const type = pick(kind === 'road' ? ROAD_VEHICLES : kind === 'water' ? WATER_VEHICLES : AIR_VEHICLES);
    try {
      if (kind === 'air') await call('drive', type, chance(0.5) ? 0 : between(60, 400));
      else await call('drive', type);
    } catch (e) {
      if (/No open water|Unknown|No clear vehicle spawn/.test(e.message)) return `skip ${type}: ${e.message.slice(0, 40)}`;
      throw e;
    }
    const st = await call('status');
    if (st.vehicle !== type) find('drive', `drive(${type}) left the player in ${st.vehicle || 'nothing'}`);
    const legs = Math.floor(between(1, 4));
    for (let i = 0; i < legs; i++) {
      if (kind === 'air') await sim(pick([['KeyW'], ['KeyW', 'KeyT'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS'], ['KeyW', 'KeyG']]), between(1, 6));
      else if (chance(0.5)) {
        const here = await call('status');
        const a = between(0, Math.PI * 2),
          d = between(150, 1200);
        await call('steerTo', here.x + Math.cos(a) * d, here.y + Math.sin(a) * d, between(2, 9));
        simT += 0;
      } else await sim(pick(MOVE_SETS), between(1, 6));
    }
    const rep = await call('integrity');
    // A road vehicle must be able to move one way or the other (a wedge in geometry is a stuck state).
    if (kind === 'road' && rep.player.vehicle === type && type !== 'tank') {
      const a = await call('status');
      let moved = 0;
      let alive = a.mode === 'play';
      for (const k of ['KeyW', 'KeyS']) {
        if (!alive) break;
        await sim([k], 1.6);
        const b = await call('status');
        alive = b.mode === 'play'; // (arrested or shot meanwhile: nothing moves in a WASTED / BUSTED sequence)
        moved = Math.max(moved, dist(a, b));
        if (moved > 8) break;
      }
      // A heavy truck reverses slowly (a flatbed backs off a wall only ~5 units in the first 1.6 s): give it longer.
      if (alive && moved <= 8) {
        await sim(['KeyS'], 2.5);
        const b = await call('status');
        alive = b.mode === 'play';
        moved = Math.max(moved, dist(a, b));
      }
      if (alive && moved <= 8) find('trapped', `${type} cannot move forward or back at ${a.x},${a.y} (${a.district})`);
    }
    return `${type} ${legs} legs -> ${rep.player.vehicle || 'foot'}`;
  },
  async exitVehicle() {
    const before = await call('status');
    if (!before.vehicle) return 'skip (on foot)';
    // The real key, held at rest: stop first.
    await sim(['KeyS'], 1.2);
    await press('KeyE');
    await sim([], 0.6);
    const st = await call('status');
    if (st.vehicle && !['helicopter', 'plane'].includes(st.vehicle)) {
      // A boat off a dock, a wreck in a wall: pressing again must not be a stuck state for long.
      await press('KeyE');
      await sim([], 0.5);
      const st2 = await call('status');
      if (st2.vehicle) return `still in ${st2.vehicle} (E twice)`;
    }
    return st.vehicle ? 'stayed in ' + st.vehicle : 'out';
  },
  async shoot() {
    await call('arm', Math.floor(between(0, 6)));
    const people = await call('nearbyPeople', 400, 'all');
    const target = people.length ? pick(people.slice(0, 6)) : null;
    const st = await call('status');
    const n = Math.floor(between(1, 6));
    for (let i = 0; i < n; i++) {
      if (target) await call('fireShot', target.x, target.y);
      else await call('fireShot', st.x + between(-200, 200), st.y + between(-200, 200));
      await sim([], 0.25);
    }
    if (chance(0.4)) await sim(['KeyF'], between(0.5, 2.5));
    await call('arm', 0);
    return `${n} shots at ${target ? target.kind : 'nothing'}`;
  },
  async runOver() {
    if (await onFoot()) {
      try {
        await call('drive', pick(['sedan', 'muscle', 'suv', 'truck', 'bus', 'bike', 'police', 'sport']));
      } catch (e) {
        return 'skip: ' + String(e.message).slice(0, 70);
      }
    }
    for (let i = 0; i < 3; i++) {
      const people = await call('nearbyPeople', 500, 'civilian');
      if (!people.length) break;
      const p = pick(people.slice(0, 5));
      await call('steerTo', p.x, p.y, between(2, 5), 0, true);
    }
    return 'ran people over';
  },
  async crime() {
    // Shoot civilians: stars from heat and witnesses, then run or stand still (arrest).
    await call('arm', 0);
    const people = await call('nearbyPeople', 300, 'civilian');
    for (const p of people.slice(0, Math.floor(between(1, 4)))) {
      await call('fireShot', p.x, p.y);
      await sim([], 0.4);
    }
    const stand = chance(0.4);
    const st = await call('status');
    if (stand) await sim([], between(8, 22));
    else for (let i = 0; i < 4; i++) await sim(pick(MOVE_SETS), between(2, 5));
    return `crime, ${stand ? 'stood still' : 'ran'}: stars ${(await call('status')).wanted} (was ${st.wanted})`;
  },
  async wanted() {
    const n = Math.floor(between(1, 6));
    await call('wanted', n);
    const rep = await call('policeReport');
    if (rep.stars !== n) find('police', `wanted(${n}) reports ${rep.stars} stars`);
    for (let i = 0; i < 3; i++) await sim(pick(MOVE_SETS), between(3, 9));
    if (chance(0.5)) {
      const r = await call('godLosePolice');
      if (r.after !== 0) find('police', `godLosePolice left ${r.after} stars`);
    }
    return `${n} stars`;
  },
  async die() {
    await call('god', false);
    await call('heal', 0);
    await sim([], 3.5); // spawn protection
    for (let i = 0; i < 4 && (await call('status')).mode === 'play'; i++) {
      const st = await call('status');
      await call('blast', st.x, st.y, 4);
      await sim([], 0.2);
    }
    return 'blasted';
  },
  async menus() {
    // Real keys: pause, settings, map, help, arsenal, mission card, with Escape and the key again to close.
    const way = pick(['pause', 'settings', 'map', 'help', 'arsenal', 'card', 'random']);
    if (way === 'pause') {
      await press('Escape');
      const st = await call('status');
      if (st.mode !== 'pause') find('menus', `Escape in play gave mode ${st.mode}`);
      await sim([], 0.5);
      await press('Escape');
    } else if (way === 'settings') {
      await call('pauseMenu', true);
      await call('openSettings', pick(['graphics', 'audio', 'gameplay', 'driving', 'controls']));
      await realWait(0.3);
      await press('Escape');
      await realWait(0.2);
      await press('Escape');
    } else if (way === 'map') {
      await press('Tab');
      await realWait(0.3);
      const st = await call('status');
      if (st.mode !== 'map' && st.mode !== 'play') find('menus', `Tab gave mode ${st.mode}`);
      await press('Tab');
    } else if (way === 'help') {
      await press('Slash');
      await realWait(0.3);
      await press('Escape');
    } else if (way === 'arsenal') {
      await press('KeyI');
      await realWait(0.3);
      await press('Escape');
    } else if (way === 'card') {
      await press('KeyO');
    } else {
      const codes = ['KeyE', 'KeyF', 'KeyR', 'KeyQ', 'KeyK', 'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'KeyH', 'KeyN', 'KeyB', 'Comma', 'Period', 'KeyY', 'KeyU', 'KeyX', 'KeyZ', 'KeyL', 'KeyJ', 'KeyV', 'KeyM', 'Equal', 'Minus', 'Digit0', 'KeyP', 'Tab', 'KeyI', 'KeyO', 'Slash'];
      const n = Math.floor(between(3, 9));
      for (let i = 0; i < n; i++) {
        await press(pick(codes), 0.1);
        if (chance(0.5)) await sim(pick(MOVE_SETS), between(0.3, 1.5));
      }
    }
    await ensurePlay('menus ' + way);
    // Input must be alive after any menu.
    return way;
  },
  async inputAlive() {
    if (!(await onFoot())) return 'skip';
    const rep = await call('integrity');
    if (rep.mode !== 'play' || Object.values(rep.carriers).some(Boolean)) return 'skip (carrier)';
    return actions.trapCheck();
  },
  async rebind() {
    // Rebinding the action key: prompts name the new key, the old one does nothing, the new one opens the door's panel.
    const key = pick(['KeyU', 'KeyG', 'KeyZ', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyJ', 'KeyK', 'Digit9']);
    const label = key.startsWith('Key') ? key.slice(3) : key.slice(5);
    const d = pick(doors);
    await call('godTeleport', d.door.x, d.door.y + 26);
    await sim([], 0.8);
    // An aircraft in the air comes along with the god teleport: its prompt names its own keys, not a door's.
    if ((await call('status')).vehicle) return 'skip (in a vehicle)';
    try {
      await call('bindings', { interact: key });
      await sim([], 0.4);
      const prompt = await call('promptState');
      if (prompt.visible && !prompt.text.startsWith(label + ' ')) find('rebind', `prompt "${prompt.text}" does not name the rebound key ${label}`);
      await press('KeyE');
      await realWait(0.2);
      const afterOld = (await call('status')).mode;
      if (key !== 'KeyE' && afterOld !== 'play') find('rebind', `the old action key still opened ${afterOld} after interact moved to ${label}`);
      await ensurePlay('old key');
      await press(key);
      await realWait(0.3);
      const after = await call('status'),
        afterNew = after.mode;
      // A wanted player is turned away at every door but an outfitter's (openService: "lose the police first").
      const refused = after.wanted > 0 && d.kind !== 'clothes';
      if (prompt.visible && afterNew === 'play' && !refused) find('rebind', `the rebound key ${label} did nothing at "${prompt.text}"`);
    } finally {
      await call('bindings', 'reset');
    }
    await ensurePlay('rebind');
    return `interact -> ${label} at ${d.name}`;
  },
  async garageJob() {
    // Drive up to a respray garage's door and let it service the car: the drive-in job must end, the car come out driveable.
    const g = pick((await call('garage')).garages);
    await call('setCash', 5000);
    await call('godTeleport', g.apron.x, g.apron.y + 40);
    try {
      await call('drive', pick(['sedan', 'suv', 'muscle', 'pickup', 'van', 'taxi']));
    } catch (e) {
      return 'skip: ' + String(e.message).slice(0, 60);
    }
    if (chance(0.6)) await call('blast', g.apron.x + 60, g.apron.y + 40, 0.4);
    await call('placeVehicle', g.apron.x, g.apron.y, -Math.PI / 2, 0);
    await sim([], 0.6);
    const veh = (await call('garage')).vehicle;
    if (!veh?.offer) return `${g.name}: no offer (${veh?.prompt || 'no prompt'})`;
    await press('KeyE');
    let phase = null;
    for (let i = 0; i < 12; i++) {
      await sim([], 5);
      phase = (await call('garage')).job;
      if (!phase) break;
    }
    if (phase) find('garage', `the drive-in job at ${g.name} never ended (phase ${phase.phase})`);
    const rep = await call('integrity');
    await sim(['KeyW'], 1.5);
    return `${g.name}: ${veh.offer?.label || JSON.stringify(veh.offer).slice(0, 40)} -> ${rep.player.vehicle || 'foot'}`;
  },
  async idle() {
    // Let the city run: standing, or in whatever vehicle we are in, for a long stretch (traffic, crowd, police, weather).
    const long = between(20, 55);
    await sim([], long);
    return `${Math.round(long)} s`;
  },
  async gamepad() {
    // A virtual pad, polled by the frame loop (real time): sticks and buttons at random, then let go.
    const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'L3', 'R3', 'D-PAD ↑', 'D-PAD ↓', 'D-PAD ←', 'D-PAD →'];
    const buttons = {};
    for (let i = 0, n = Math.floor(between(0, 3)); i < n; i++) buttons[pick(names)] = 1;
    const axes = [between(-1, 1), between(-1, 1), between(-1, 1), between(-1, 1)];
    await call('gamepadFeed', { buttons, axes });
    await realWait(between(0.6, 2));
    await call('gamepadFeed', null);
    await ensurePlay('gamepad ' + Object.keys(buttons).join('+'));
    return Object.keys(buttons).join('+') || 'sticks';
  },
  async chaseView() {
    // V (a real press) switches between the street view and the chase view (the choice stays for the actions that
    // follow). In the chase view: look round (chaseLook stands for the mouse), move along the camera, aim with the
    // pad's LT on foot; the camera must stay placed and finite.
    await press('KeyV');
    const cam = await call('chaseCamera');
    if (cam.mode !== 'chase') return cam.mode;
    await call('chaseLook', Math.round(between(-400, 400)), Math.round(between(-80, 80)));
    await sim(pick(MOVE_SETS), between(0.5, 2));
    if (await onFoot()) {
      await call('gamepadFeed', { axes: [0, 0, 0, 0], buttons: { LT: 1 } });
      await realWait(0.4);
      await call('gamepadFeed', null);
    }
    const after = await call('chaseCamera');
    if (after.live && after.ready && ![...after.position, ...after.pivot, after.yawDeg, after.pitchDeg, after.boomMetres].every(Number.isFinite))
      find('chase', 'the chase camera is not finite: ' + JSON.stringify(after).slice(0, 200));
    await ensurePlay('chaseView');
    return 'chase';
  },
  async mouseFire() {
    // The real pointer: aim somewhere on the screen and hold the button (fire), keys held for movement.
    await call('arm', Math.floor(between(0, 6)));
    await op({ op: 'mouse', x: Math.round(between(80, 880)), y: Math.round(between(60, 540)), seconds: between(0.6, 1.8), down: true, codes: chance(0.5) ? pick(MOVE_SETS).filter((k) => k !== 'Space') : [], taps: [] });
    await call('arm', 0);
    return 'mouse fire';
  },
  async touchMode() {
    const mode = pick(['on', 'off', 'auto']);
    await call('settings', { touch: mode });
    await sim(pick(MOVE_SETS), between(0.5, 2));
    await call('settings', { touch: 'auto' });
    return mode;
  },
  async skyAndClock() {
    const sky = pick(SKY);
    await call('sky', sky);
    const h = pick([0.5, 3, 5.5, 6.5, 9, 12, 17, 18.5, 20, 22, 23.5]);
    await call('setClock', h);
    await sim([], between(1, 4));
    if (chance(0.3)) await call('sky');
    return `${sky} at ${h}`;
  },
  async graphicsAndSettings() {
    const r = pickWeighted([['tier', 3], ['setting', 5], ['volume', 1]]);
    if (r === 'tier') {
      const tier = pick(['low', 'medium', 'high', 'ultra', 'auto']);
      await call('graphics', tier);
      await sim([], 1);
      return tier;
    }
    if (r === 'volume') {
      await call('settings', { masterVolume: Math.floor(between(0, 100)), radioVolume: Math.floor(between(0, 100)) });
      return 'volumes';
    }
    const key = pick(['fps', 'cutaway', 'playerOutline', 'playerRing', 'voices', 'chatter', 'keyHints', 'flightHud', 'gps', 'footSpeed', 'abs', 'esc', 'tcs', 'minimapFolded']);
    const cur = await call('settings');
    await call('settings', { [key]: !cur[key] });
    if (chance(0.3)) await call('settings', { minimapZoom: pick([0.5, 1, 1.5, 2, 3]) });
    if (chance(0.2)) await call('settings', { units: pick(['kmh', 'mph']) });
    if (chance(0.15)) await call('settings', { shadows: pick(['auto', 'off', 'low', 'high']) });
    await sim([], 0.5);
    const after = await call('settings');
    if (after[key] !== !cur[key] && !['sound'].includes(key)) find('settings', `setting ${key} did not change (was ${cur[key]}, now ${after[key]})`);
    return key;
  },
  async door() {
    // Walk up to a service door: its prompt, E opens the panel, Escape closes it.
    const d = pick(doors);
    await call('godTeleport', d.door.x, d.door.y + 26);
    await sim([], 0.8);
    const prompt = await call('promptState');
    await press('KeyE');
    await realWait(0.3);
    const st = await call('status');
    await ensurePlay('door ' + d.name);
    return `${d.name} prompt "${prompt.text}" -> ${st.mode}`;
  },
  async carjack() {
    if (!(await onFoot())) return 'skip';
    try {
      await call('carjackTarget', pick(['sedan', 'taxi', 'suv', 'van']), pick(['flee', 'angry', 'defiant', 'plead', 'witness']));
    } catch (e) {
      return 'skip: ' + String(e.message).slice(0, 70);
    }
    await press('KeyE');
    await sim([], between(2, 9));
    const rep = await call('integrity');
    return `carjack -> ${rep.player.vehicle || 'foot'}`;
  },
  async blastCars() {
    const st = await call('status');
    const veh = await call('vehicleAt', st.x + between(-250, 250), st.y + between(-250, 250));
    if (!veh) return 'skip';
    if (chance(0.5)) await call('blast', veh.x, veh.y, between(0.5, 2));
    else for (let i = 0; i < 4; i++) await call('shootAt', veh.x, veh.y, 0);
    await sim([], between(1, 6));
    return `blast ${veh.type}`;
  },
  async swimAndFall() {
    const how = pick(['swim', 'bailout', 'swim']);
    if (how === 'swim') {
      // Into the sea off a shore: godTeleport asks for open water, which gives a boat; step out and swim.
      const here = await call('status');
      await call('godTeleport', here.x, here.y);
      const w = await call('swim');
      await sim(pick(MOVE_SETS), between(2, 8));
      return 'swim ' + JSON.stringify(w).slice(0, 60);
    }
    const st = await call('status');
    const m = Math.floor(between(30, 600));
    await call('bailOut', m, st.x, st.y);
    for (let i = 0; i < 4; i++) {
      await sim([], between(2, 6));
      if (chance(0.6)) await press('KeyJ');
    }
    return `bail ${m} m`;
  },
  async rideService() {
    const what = pick(['cab', 'bike', 'train']);
    const st = await call('status');
    if (what === 'cab') {
      const a = pick(anchors);
      try {
        await call('cab', a.x, a.y);
      } catch (e) {
        return 'skip cab: ' + String(e.message).slice(0, 70);
      }
      for (let i = 0; i < 6; i++) {
        await sim([], 5);
        if (chance(0.3)) await press('KeyY', 0.1);
        if ((await call('status')).mode !== 'play') break;
      }
      await ensurePlay('cab');
      return 'cab to ' + a.region;
    }
    if (what === 'bike') {
      const list = (await call('bikeShare')).list || [];
      if (!list.length) return 'skip';
      await call('bikeStation', pick(list).id);
      await press('KeyE');
      await sim(['KeyW'], between(2, 8));
      await press('KeyE');
      return 'bike share';
    }
    try {
      await call('boardTrain', 0, Math.floor(between(1, 4)));
    } catch (e) {
      return 'skip train: ' + String(e.message).slice(0, 70);
    }
    for (let i = 0; i < 4; i++) {
      await sim([], 5);
      if (chance(0.4)) await press('KeyY', 0.1);
    }
    await ensurePlay('train');
    return 'train';
  },
  async leisure() {
    const what = pick(['volley', 'pier', 'club']);
    if (what === 'volley') {
      const v = await call('volley');
      await call('godTeleport', v.court.x, v.court.y + 60);
      await call('volleyJoin', pick([0, 1]));
      await sim([], 6);
      return 'volley';
    }
    if (what === 'pier') {
      await call('boardRide', pick(['coaster', 'wheel']));
      for (let i = 0; i < 4; i++) {
        await sim([], 6);
        if (chance(0.4)) await press('KeyE', 0.1);
      }
      await ensurePlay('pier ride');
      return 'pier ride';
    }
    await call('hillClimb', 'arm', 0);
    await sim([], 2);
    return 'hill climb';
  },
  async garageAndShops() {
    const d = pick(doors.filter((p) => ['guns', 'garage', 'hospital', 'diner', 'bar', 'sleep', 'club'].includes(p.kind)));
    if (!d) return 'skip';
    await call('setCash', 5000);
    await call('godTeleport', d.door.x, d.door.y + 26);
    await sim([], 0.5);
    await press('KeyE');
    await realWait(0.3);
    // Panels answer the digit keys and Enter.
    for (const k of ['ArrowDown', 'Enter', 'Escape']) {
      await press(k, 0.08);
      await realWait(0.15);
    }
    await ensurePlay('shop ' + d.name);
    return d.name;
  },
  async saveLoad() {
    // Pause saves; a reload that keeps the browser profile must bring back cash, weapons, ammo and clock.
    await call('pauseMenu', true);
    const before = { st: await call('status'), ammo: (await call('ammoSupply')).weapons, settings: await call('settings'), bindings: await call('bindings') };
    await call('pauseMenu', false);
    await op({ op: 'reload', keep: true, flags: FLAGS });
    for (;;) {
      const s = await request({ op: 'status' });
      if (s.state === 'ready') break;
      if (s.state === 'failed') throw new Error('reload failed: ' + s.error);
      await new Promise((r) => setTimeout(r, 500));
    }
    since = {};
    const after = { st: await call('status'), ammo: (await call('ammoSupply')).weapons, settings: await call('settings'), bindings: await call('bindings') };
    if (after.st.cash !== before.st.cash) find('save', `cash ${before.st.cash} became ${after.st.cash} across a reload`);
    if (JSON.stringify(after.ammo) !== JSON.stringify(before.ammo)) find('save', `weapons/ammo changed across a reload: ${JSON.stringify(before.ammo).slice(0, 120)} -> ${JSON.stringify(after.ammo).slice(0, 120)}`);
    for (const k of Object.keys(before.settings)) if (JSON.stringify(before.settings[k]) !== JSON.stringify(after.settings[k]) && k !== 'screen' && k !== 'gpsRoute') find('save', `setting ${k} ${JSON.stringify(before.settings[k])} became ${JSON.stringify(after.settings[k])} across a reload`);
    if (JSON.stringify(before.bindings) !== JSON.stringify(after.bindings)) find('save', 'key bindings changed across a reload');
    const dc = Math.abs(clockMinutes(after.st.clock) - clockMinutes(before.st.clock));
    if (Math.min(dc, 1440 - dc) > 20) find('save', `clock ${before.st.clock} became ${after.st.clock} across a reload`);
    return 'reloaded';
  },
};
const clockMinutes = (text) => {
  const [h, m] = text.split(':').map(Number);
  return h * 60 + m;
};

// name: [weight, fn]
const TABLE = [
  ['teleport', 7],
  ['walk', 5],
  ['trapCheck', 2],
  ['drive', 9],
  ['exitVehicle', 3],
  ['shoot', 3],
  ['runOver', 3],
  ['crime', 3],
  ['wanted', 3],
  ['die', 2],
  ['idle', 4],
  ['garageJob', 1],
  ['rebind', 1],
  ['gamepad', 1.5],
  ['mouseFire', 1.5],
  ['chaseView', 2.5],
  ['touchMode', 1],
  ['menus', 4],
  ['inputAlive', 2],
  ['skyAndClock', 2],
  ['graphicsAndSettings', 4],
  ['door', 3],
  ['carjack', 2],
  ['blastCars', 2],
  ['swimAndFall', 2],
  ['rideService', 2],
  ['leisure', 1],
  ['garageAndShops', 2],
  ['saveLoad', 0.35],
].filter(([name]) => !ONLY || ONLY.includes(name));

// ---------------------------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  const running = readState();
  if (!running) await start({ nodev: true, render: argv.includes('--render'), quiet: true });
  // A clean page with the public demo's gate live (or the rendered one with --render).
  else await rebootPage();
  await loadWorld();
  await op({ op: 'errors' });
  console.log(`bot seed ${SEED}: ${MINUTES} game minutes, ${anchors.length} anchors, ${doors.length} doors`);
  let crashed = null;
  while (simT < MINUTES * 60 && (!WALL || (Date.now() - t0) / 1000 < WALL)) {
    const name = pickWeighted(TABLE);
    actionNo++;
    hist[name] = (hist[name] || 0) + 1;
    let note = '';
    try {
      await ensurePlay('before ' + name);
      note = await actions[name]();
      trail.push(`${name}(${note})`);
      if (trail.length > 40) trail.shift();
    } catch (e) {
      trail.push(`${name}!`);
      const msg = String(e.message || e);
      if (/not ready|Target|closed|timed out|ECONN|no dev server/.test(msg)) {
        crashed = msg;
        find('crash', `${name}: ${msg}`);
        break;
      }
      find('action-threw', `${name}: ${msg.slice(0, 200)}`);
      note = 'threw';
    }
    try {
      await check(name);
      const mode = (await call('status')).mode;
      if (mode !== 'play') await ensurePlay('after ' + name);
    } catch (e) {
      crashed = String(e.message || e);
      find('crash', `check after ${name}: ${crashed}`);
      break;
    }
    const s = lastStatus;
    console.log(`#${actionNo} ${Math.round(simT)}s ${name} ${note} | ${s ? s.mode + ' ' + s.district + ' ' + (s.vehicle || 'foot') + ' hp ' + s.hp + ' *' + s.wanted : ''}`);
    // The no-progress watchdog: the bot's own clock must keep running (time advances only in play).
  }
  const out = { seed: SEED, minutes: MINUTES, simSeconds: Math.round(simT), realSeconds: Math.round((Date.now() - t0) / 1000), actions: actionNo, histogram: hist, crashed, findings: [...findings.values()] };
  fs.mkdirSync(path.join(ROOT, 'dist', 'bot'), { recursive: true });
  const file = path.join(ROOT, 'dist', 'bot', `seed-${SEED}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`\nseed ${SEED}: ${actionNo} actions, ${Math.round(simT / 60)} game minutes in ${out.realSeconds} s, ${findings.size} distinct finding(s) -> ${path.relative(ROOT, file)}`);
  for (const f of findings.values()) console.log(`  [${f.kind}] x${f.count} ${f.msg.slice(0, 200)}`);
  process.exit(findings.size ? 1 : 0);
}
main().catch((e) => {
  console.log('bot failed: ' + (e.stack || e));
  process.exit(2);
});
