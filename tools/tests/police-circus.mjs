// A cruiser answering a 911 call on Monarch Isle comes up Monarch Boulevard at speed and goes
// round Crown Circus to the reported spot on Crown Avenue: it used to aim straight across the
// circus (a 70-80° turn it could not make), hit the fountain, back off and aim again.
export const fresh = true;
const SPOT = { x: 6700, y: -2960 };
// Both carriageways, from the south and from the north, 56 km/h (125 units/s).
const RUNS = [
  { x: 7164, y: -2560, a: -Math.PI / 2 },
  { x: 7236, y: -2600, a: -Math.PI / 2 },
  { x: 7236, y: -3330, a: Math.PI / 2 },
  { x: 7164, y: -3330, a: Math.PI / 2 },
];

export default async function (t) {
  await t.call('god', true);
  await t.call('setClock', 13);
  await t.call('holdSimulation', true);
  const failed = [];
  for (const run of RUNS) {
    await t.call('wanted', 0);
    await t.call('teleport', SPOT.x, SPOT.y - 30);
    await t.wait(0.3);
    // Nobody about, no police and no traffic within 1,400 units (the corner, not
    // the traffic, is under test); the call's own first unit is held back (eta
    // 60 s) so the one placed here is the only responder.
    await t.call('witnessStage', 0, false, 1400, false, false, true);
    await t.call('reportCall', SPOT.x, SPOT.y, 'gunfire', 60);
    const unit = await t.call('respondingUnit', run.x, run.y, run.a, 125);
    t.assert(unit, `no room for a unit at ${run.x},${run.y}`);
    const start = Math.hypot(run.x - SPOT.x, run.y - SPOT.y);
    let u = null,
      best = Infinity;
    for (let s = 0; s < 8; s++) {
      await t.wait(1);
      u = (await t.call('policeReport')).units.find((v) => v.id === unit.id);
      t.assert(u, 'the unit is gone: ' + JSON.stringify(unit));
      best = Math.min(best, Math.hypot(u.x - SPOT.x, u.y - SPOT.y));
    }
    t.note(`from ${run.x},${run.y}: ${Math.round(start)} → ${Math.round(best)} units in 8 s, ${u.reversals} reversals`);
    if (best >= 260 || u.reversals > 0) failed.push(`from ${run.x},${run.y}: no nearer than ${Math.round(best)}, ${u.reversals} reversals ` + JSON.stringify(u));
  }
  t.assert(!failed.length, failed.join(' | '));
  await t.call('holdSimulation', false);
  await t.call('wanted', 0);
  await t.call('god', false);
}
