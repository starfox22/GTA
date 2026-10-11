// Low cabin seats must not place the player's feet underneath the chassis, including during a drive-by.
export const fresh = true;
export default async function (t) {
  if ((await t.call('carModels')) === null) t.skip('Requires WebGL: run with --render');
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    await t.call('graphics', 'low');
    await t.call('teleport', 1152, 1160);
    await t.call('drive', 'sedan', 0, 0);
    await t.call('viewMode', 'chase');
    await t.wait(0.8);
    await t.call('chaseLook', 0, 0, 90, 5);
    for (const pose of ['seated', 'drive-by']) {
      if (pose === 'drive-by') {
        await t.call('driveByAim', -90, 'raise');
        await t.wait(0.8);
      }
      await t.call('hitchRun', 2 / 60, [], 3, false, true);
      const body = await t.call('playerModel');
      t.assert(body.shown && body.ankles?.length === 2, `${pose}: player feet were not posed`);
      t.note(`${pose}: ankle heights ${body.ankles.map(p => (p[1] / 8).toFixed(3)).join(', ')} m`);
      // This level-road sedan's floor is 0.226 m up: the ankles must leave room for the shoes above it.
      t.assert(body.ankles.every(p => p[1] / 8 >= 0.29), `${pose}: feet below the sedan's floor: ${JSON.stringify(body.ankles)}`);
    }
  } finally {
    await t.call('driveByAim', null);
    await t.call('viewMode', 'street');
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
