// The action key pressed through the frame loop (not the console's interact()):
// on foot beside a parked car it gets in, and again gets out, with no page error.
// Guards against a stale per-frame KeyE hook (a removed takedown once threw here).
export default async function (t) {
  await t.call('god', true);
  await t.call('teleport', 1000, 1000);
  const id = await t.call('park', 'sedan', 26, 0, 0);
  t.assert(id != null, 'no parked sedan');
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(2);
  let s = await t.call('status');
  t.assert(s.vehicle === 'sedan', `not in the car after the action key: ${JSON.stringify(s)}`);
  await t.keys('KeyW', 1);
  s = await t.call('status');
  t.assert(s.mode === 'play', `the game stopped after driving off: ${s.mode}`);
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(2);
  s = await t.call('status');
  t.assert(!s.vehicle, `still in the car after the action key: ${JSON.stringify(s)}`);
}
