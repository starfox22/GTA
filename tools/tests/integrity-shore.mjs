// integrity() and the shore (bot seed 7): the player's own car is not stopped by the shore's edge (physics-step.js
// throughShore: a car may be driven into the bay, then it floods), but integrity() counted the thin coast collider
// under a bonnet hanging past the quay at Ocean Drive as "sunk 15.8 units into a static".
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('god', true);
    await t.call('teleport', -1500, 2299);
    await t.call('drive', 'supercar', 0, 0);
    await t.call('placeVehicle', -1300, 2299, 0, 0);
    await t.call('launch', 12);
    let crossed = false;
    for (let i = 0; i < 8; i++) {
      await t.keys('KeyW', 0.25);
      const s = await t.call('status'),
        rep = await t.call('integrity');
      if (s.x > -1175) crossed = true;
      t.assert(!rep.problems.some((p) => /sunk/.test(p)), `at ${s.x},${s.y}: ` + rep.problems.join(' | '));
    }
    t.assert(crossed, 'the car never reached the quay, so this proves nothing');
  } finally {
    await t.call('holdSimulation', false);
  }
}
