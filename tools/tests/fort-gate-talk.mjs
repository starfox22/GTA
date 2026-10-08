// Fort Sentinel's gate in Kessler's uniform (fort-cover.js): driven up, the sergeant sends the car back to park outside
// (no challenge, no FORCE THE GATE prompt, no stars); on foot the ID is shown and the conversation runs with the feet held,
// then the gate clears him.
export const fresh = true;
export default async function (t) {
  await t.call('fortSkip', 'changed');
  await t.wait(1);
  await t.call('teleport', 9080, 8200);
  await t.call('drive', 'sedan', 0, 0);
  await t.call('holdSimulation', true);
  try {
    for (let i = 0; i < 5; i++) {
      await t.call('placeVehicle', 9120 + i * 18, 8200, 0);
      await t.wait(0.5);
    }
    const p = await t.call('promptState');
    t.assert(/PARK OUTSIDE/.test(p.text || ''), 'a car at the gate is sent to park: ' + JSON.stringify(p));
    const s = await t.call('status');
    t.assert(s.wanted === 0, 'no stars for driving up: ' + JSON.stringify(s));
    const c = await t.call('fortCover');
    t.assert(c.ownsGate && !c.alarmed, 'the cover still owns the gate: ' + JSON.stringify(c));
  } finally {
    await t.call('holdSimulation', false);
  }
  await t.keys('KeyE', 0.2, { real: true });
  await t.wait(1);
  await t.call('teleport', 9236, 8182);
  await t.wait(1);
  let p = await t.call('promptState');
  t.assert(/SHOW YOUR ID/.test(p.text || ''), 'the ID prompt on foot: ' + JSON.stringify(p));
  await t.keys('KeyE', 0.2, { real: true });
  await t.wait(1);
  // The feet stay put while the sergeant reads.
  await t.keys('KeyA', 2);
  let c = await t.call('fortCover');
  t.assert(c.inspecting > 2 && Math.abs(c.player.x - 9236) < 4, 'held at the window: ' + JSON.stringify(c));
  await t.wait(15);
  c = await t.call('fortCover');
  t.assert(c.cleared && !c.alarmed, 'cleared at the gate: ' + JSON.stringify(c));
}
