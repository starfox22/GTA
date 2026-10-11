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
    await t.call('driveByAim', null);
    // The entry animation begins on the first drawn frame, not when simulate() enters the car.
    await t.call('hitchRun', 1 / 60, [], 3, false, true);
    await t.wait(0.8);
    await t.call('chaseLook', 0, 0, 90, 5);
    for (const pose of ['seated', 'drive-by']) {
      if (pose === 'drive-by') {
        await t.call('driveByAim', -90, 'raise');
        await t.wait(0.8);
      }
      await t.call('hitchRun', 2 / 60, [], 3, false, true);
      const body = await t.call('playerModel');
      const id = (await t.call('damageReport')).id;
      const cabin = (await t.call('carModels')).find(c => c.id === id)?.cabin;
      t.assert(body.shown && body.ankles?.length === 2, `${pose}: player feet were not posed`);
      t.assert(Number.isFinite(cabin?.floorWorldY), `${pose}: no world-space cabin floor`);
      if (pose === 'seated') t.assert(cabin.seated > 0, 'still drawing the car-entry animation');
      const clearance = body.ankles.map(p => p[1] / 8 - cabin.floorWorldY);
      t.note(`${pose}: ankle clearance above cabin floor ${clearance.map(v => v.toFixed(3)).join(', ')} m`);
      // Compare actual drawn bones with the cabin floor, including terrain height and suspension pose.
      t.assert(clearance.every(v => v >= 0.07), `${pose}: shoes below the sedan's floor: ${JSON.stringify({ clearance, cabin })}`);
    }
  } finally {
    await t.call('driveByAim', null);
    await t.call('viewMode', 'street');
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
