// Motion blur is temporarily withdrawn: legacy/tool requests must not enable the pass.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    const initial = await t.call('settings');
    t.assert(initial.motionBlur === false, 'motion blur must be disabled on a fresh profile');
    t.assert(initial.playerOutline === false, 'player outline must default to off');
    t.assert(initial.playerRing === false, 'player ring must default to off');
    await t.call('settings', { cameraView: 'chase', motionBlur: true, motionComfort: false });
    t.assert((await t.call('settings')).motionBlur === false, 'legacy console request enabled withdrawn blur');
    t.assert((await t.call('chaseCamera')).motionBlur === false, 'withdrawn blur enabled in chase view');
    const view = (await t.call('chaseCamera')).view;
    if (view) {
      await t.call('graphics', 'high');
      await t.call('teleport', 420, 4400);
      await t.call('drive', 'sedan', 0, 0);
      await t.keys('KeyW', 3);
      const blur = (await t.call('chaseCamera')).view.motionBlur;
      t.assert(blur.active === false && blur.strength === 0, 'withdrawn blur still rendered: ' + JSON.stringify(blur));
    }
    await t.call('settings', { playerOutline: true, playerRing: true });
    await t.reload({ keep: true });
    const saved = await t.call('settings');
    t.assert(saved.playerOutline && saved.playerRing, 'explicit character-aid choices did not survive reload');
    t.assert(saved.motionBlur === false, 'blur returned after reload');
  } finally {
    await t.call('settings', { cameraView: 'street', playerOutline: false, playerRing: false });
    await t.call('holdSimulation', false);
  }
}
