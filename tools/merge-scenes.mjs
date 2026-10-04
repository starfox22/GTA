// Draw counts of the pristine merge (src/vehicle-merge3d.js) in fixed scenes, on and off in the same page and frame:
// downtown at noon on foot, a sports car at speed off the Keys Bridge into downtown (the driving camera pulled back)
// and downtown at night with every car's lamps lit. Each scene is staged without drawing, then drawn a few frames with the merge on (counts),
// then with lookSwitches({ vehicleMerge: false }) (counts again). Run it on a rendered dev page, best seeded:
//
//   node tools/dev.mjs start --render --prewarm --seed 1
//   node tools/merge-scenes.mjs [--tiers low,medium,high,ultra] [--scenes lineup,street,highway,night] [--shots]
//   (--shots: a small JPEG of each scene, on and off)
import { request } from './dev.mjs';

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};
const tiers = opt('tiers', 'high').split(',');
const shots = argv.includes('--shots');
async function call(method, ...args) {
  const r = await request({ op: 'call', method, args });
  if (r.error) throw new Error(`${method}: ${r.error}`);
  return r.result;
}
async function counts() {
  const dp = await call('drawProfile', 40),
    st = await call('stats');
  return {
    calls: dp.total,
    vehicles: (dp.byName.find(([k]) => k.startsWith('vehicle in vehicle')) || [0, 0])[1],
    triangles: dp.triangles,
    shadow: st.shadowCalls,
    programs: st.programs,
  };
}
async function measure(tier, name, held) {
  await call('lookSwitches', { vehicleMerge: true });
  // Drawn frames until no new model is built (at most six a frame), so both counts see the same cars.
  for (let i = 0; i < 12; i++) {
    const r = await call('hitchRun', 0.1, held);
    if (!r.totals.models) break;
  }
  const on = await counts(),
    merges = await call('vehicleMerges'),
    audit = await call('vehicleMergeAudit');
  if (shots) await request({ op: 'shot', name: `merge-${tier}-${name}-on`, width: 480 });
  await call('lookSwitches', { vehicleMerge: false });
  await call('hitchRun', 0.05, held);
  const off = await counts();
  if (shots) await request({ op: 'shot', name: `merge-${tier}-${name}-off`, width: 480 });
  await call('lookSwitches', { vehicleMerge: true });
  return { name, on, off, merged: merges.live, auditMaxError: audit.maxError };
}
const SCENES = {
  // Every civilian car and motorbike type and every police model parked in two columns on the airport apron, seen at
  // the pulled-back zoom of the driving camera at speed (a controlled count: twenty-odd cars in view), at noon.
  async lineup(tier) {
    await call('setClock', 12);
    await call('teleport', 300, 4380);
    if (!lineupBuilt) {
      lineupBuilt = true;
      await call('carLineup', [], 420, 4100, 0, 44, null, true);
      await call('policeLineup', 560, 4100, 0, 'pursuit', 44);
    }
    await call('look', 490, 4420, 1.1);
    await call('hitchRun', 0.5, [], 1, false, false);
    return measure(tier, 'lineup', []);
  },
  // Downtown at noon, on foot.
  async street(tier) {
    await call('setClock', 12);
    await call('teleport', 1400, 900);
    await call('hitchRun', 1.5, [], 1, false, false);
    return measure(tier, 'street', []);
  },
  // A sports car at speed east along the Keys Bridge into downtown: the driving camera pulled back.
  async highway(tier) {
    await call('teleport', 600, 1176);
    await call('drive', 'sport', 0, 0);
    await call('launch', 45);
    await call('hitchRun', 4, ['KeyW'], 1, false, false);
    return measure(tier, 'highway', ['KeyW']);
  },
  // Downtown at night: every car's lamps lit.
  async night(tier) {
    await call('interact');
    await call('setClock', 22.5);
    await call('teleport', 1400, 900);
    await call('hitchRun', 1.5, [], 1, false, false);
    return measure(tier, 'night', []);
  },
};
let lineupBuilt = false;
const only = opt('scenes', '');
if (only) for (const k of Object.keys(SCENES)) if (!only.split(',').includes(k)) delete SCENES[k];
await call('seedRandom', 1);
await call('god', true);
console.log('tier    scene     calls off>on   vehicle calls off>on   triangles off>on      shadow off>on  programs  merged  audit');
for (const tier of tiers) {
  await call('graphics', tier);
  for (const [name, run] of Object.entries(SCENES)) {
    const r = await run(tier);
    console.log(
      [tier.padEnd(7), name.padEnd(9), `${r.off.calls}>${r.on.calls}`.padEnd(14), `${r.off.vehicles}>${r.on.vehicles}`.padEnd(22), `${r.off.triangles}>${r.on.triangles}`.padEnd(21), `${r.off.shadow}>${r.on.shadow}`.padEnd(14), `${r.off.programs}>${r.on.programs}`.padEnd(9), String(r.merged).padEnd(7), r.auditMaxError].join(' '),
    );
  }
}
