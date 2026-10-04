// Foliage cutaway (foliage-cutaway.js, vegetation3d-material.js FOLIAGE_HOLE): leaves on the street camera's line of
// sight to the player are dropped, on foot and in a truck on the hill-climb trail; leaves behind or beside the player and
// grass at their feet stay; Settings · Character see-through off closes it.
function checkHole(t, r, label) {
  t.finite(r, label);
  t.assert(r.on, `${label}: the hole is on: ${JSON.stringify(r)}`);
  t.assert(r.sight.length >= 10 && r.sight.every((v) => v >= 0.99), `${label}: every point on the line of sight up to 24 m is dropped: ${r.sight}`);
  t.assert(r.stays.behind === 0 && r.stays.beside === 0 && r.stays.grass === 0, `${label}: behind, beside and grass stay: ${JSON.stringify(r.stays)}`);
  t.near(r.floorM, 1.4, 1.6, `${label}: leaves below 1.5 m stay`);
}
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('settings', { cutaway: true });
    // On foot in Midtown.
    await t.call('teleport', 748, 584);
    const foot = await t.call('foliageCutaway');
    checkHole(t, foot, 'on foot');
    t.assert(foot.kind === 'foot', `on foot: subject ${foot.kind}`);
    t.near(foot.boxM[0], 0.5, 1.2, 'on foot: open box half width (m)');
    t.near(foot.boxM[1], 0.8, 1.6, 'on foot: open box half height (m)');
    // A pickup in the forest on the hill-climb trail (the creek crossing).
    await t.call('drive', 'hilux');
    await t.call('hillClimb', 'at0.075');
    await t.wait(0.2);
    const truck = await t.call('foliageCutaway');
    checkHole(t, truck, 'truck');
    t.assert(truck.kind === 'vehicle', `truck: subject ${truck.kind}`);
    t.assert(truck.boxM[0] > foot.boxM[0] + 1 && truck.boxM[1] > foot.boxM[1] + 1, `truck: a bigger box than on foot: ${truck.boxM}`);
    // (The tree material's live uniforms and the crowns they open are `renderer`: a drawn page only, dev.mjs.)
    t.assert(truck.renderer === null || typeof truck.renderer.uncovered === 'boolean', 'renderer report');
    // Switched off with the building cutaway.
    await t.call('settings', { cutaway: false });
    const off = await t.call('foliageCutaway');
    t.assert(!off.on && off.kind === 'none' && off.sight.every((v) => v === 0), `off: nothing is cut: ${JSON.stringify(off)}`);
  } finally {
    await t.call('settings', { cutaway: true });
    await t.call('holdSimulation', false);
  }
}
