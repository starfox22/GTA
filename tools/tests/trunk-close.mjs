// Trunks shut again (vehicle-trunk.js): a trunk picked open shows CLOSE THE TRUNK at the bumper and the real action key
// brings the lid down; picked open again and driven off, the lid slams shut once the car passes walking pace. In mission
// 4 the key at Kessler's open trunk takes the bag first (no close offer while it is in there), then closes it.
export const fresh = true;
const E = (t, s = 0.2) => t.keys('KeyE', s, { real: true });
async function pickOpen(t) {
  let r;
  // Real key holds: on a loaded machine the game runs behind the clock, so keep at it.
  for (let i = 0; i < 30; i++) {
    await t.keys('KeyE', 1.5, { real: true });
    r = await t.call('trunkReport');
    if (r.car.open) break;
  }
  t.assert(r.car.open, 'trunk still shut after holding the action key: ' + JSON.stringify(r));
  return r;
}
export default async function (t) {
  await t.call('teleport', 1000, 1000);
  await t.call('lockpick', true, true);
  const target = await t.call('trunkTarget', 1100, 1000, 0, 'SPARE TYRE');
  await t.call('teleport', target.trunkPoint.x - 6, target.trunkPoint.y);
  await t.wait(0.2);
  let r = await pickOpen(t);
  // Let the crouch run out, then the prompt at the open lid.
  await t.wait(1.2);
  let p = await t.call('promptState');
  t.assert(p.offered === 'CLOSE THE TRUNK', 'no close offer at the open trunk: ' + JSON.stringify(p));
  r = await t.call('trunkReport');
  t.assert(r.car.open && r.car.closeInReach, 'open and in reach: ' + JSON.stringify(r.car));
  await E(t);
  await t.wait(0.3);
  r = await t.call('trunkReport');
  t.assert(!r.car.open, 'the action key left the trunk open: ' + JSON.stringify(r.car));
  let s = await t.call('status');
  t.assert(!s.vehicle, 'the action key got into the car: ' + JSON.stringify(s));

  // Open again, then driven off: the lid slams shut past walking pace.
  r = await pickOpen(t);
  await t.wait(1.2);
  await t.call('lockpick', true, false);
  await t.call('teleport', target.x + 2, target.y - 26);
  await t.wait(0.3);
  await E(t);
  await t.wait(1.5);
  s = await t.call('status');
  t.assert(s.vehicle, 'could not get into the sedan: ' + JSON.stringify(s));
  r = await t.call('trunkReport');
  t.assert(r.car.open, 'getting in shut the trunk already: ' + JSON.stringify(r.car));
  await t.keys('KeyW', 2.5);
  r = await t.call('trunkReport');
  t.assert(!r.car.open, 'driving off left the trunk open: ' + JSON.stringify(r.car));

  // Mission 4: the bag first, then the lid.
  r = await t.call('fortSkip', 'inside');
  await t.call('lockpick', true, true);
  await t.wait(0.3);
  for (let i = 0; i < 12; i++) {
    await t.keys('KeyE', 5.8, { real: true });
    await t.wait(0.5);
    r = await t.call('fortJob');
    if (r.car.trunkOpen) break;
  }
  t.assert(r.stage === 4 && r.car.trunkOpen, 'Kessler’s trunk picked open: ' + JSON.stringify(r));
  await t.wait(1.2);
  p = await t.call('promptState');
  t.assert(p.offered !== 'CLOSE THE TRUNK', 'a close offer with the bag still in it: ' + JSON.stringify(p));
  await E(t);
  await t.wait(0.5);
  r = await t.call('fortJob');
  t.assert(r.stage === 5 && r.car.trunkOpen, 'the key takes the bag first: ' + JSON.stringify(r));
  await t.wait(1.2);
  p = await t.call('promptState');
  t.assert(p.offered === 'CLOSE THE TRUNK', 'no close offer once the bag is out: ' + JSON.stringify(p));
  await E(t);
  await t.wait(0.5);
  r = await t.call('fortJob');
  t.assert(r.stage === 5 && !r.car.trunkOpen, 'Kessler’s trunk shut: ' + JSON.stringify(r));
}
