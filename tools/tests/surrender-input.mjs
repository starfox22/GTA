// Trying to move against a wall is resistance, even when the player cannot change position.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    await t.call('viewMode', 'street');
    await t.call('teleport', 1844, 1064);
    await t.call('wanted', 3);
    await t.keys('KeyW', 5);
    const s = await t.call('status');
    t.assert(s.y >= 1052 && s.y <= 1065, 'the test did not stop against the wall: ' + JSON.stringify(s));
    let r = (await t.call('policeReport')).surrender;
    t.assert(r.seconds === 0, 'blocked movement counted as surrender: ' + JSON.stringify(r));
    await t.wait(4);
    r = (await t.call('policeReport')).surrender;
    t.assert(r.seconds >= 3, 'letting go no longer allows voluntary surrender: ' + JSON.stringify(r));
    await t.keys('KeyW', 0.1);
    t.assert((await t.call('policeReport')).surrender.seconds === 0, 'resuming movement did not cancel surrender');
  } finally {
    await t.call('wanted', 0);
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
