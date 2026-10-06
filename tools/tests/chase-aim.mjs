// The aim in the chase view (game-player-actions.js aim(), chase-rules.js chaseAim): the reticle is the aim for
// every device, so aim() is chaseAimHeading() on foot and at the wheel, and turns with the camera; at the wheel the
// drive-by goes out of the window the camera looks through (driveby.js: the same arcs); back in the street view
// the chase aim is no longer asked.
export default async function (t) {
  const deg = (d) => ((d + 540) % 360) - 180;
  await t.call('god', true);
  try {
    await t.call('viewMode', 'chase');
    await t.call('teleport', 1500, 1500);
    await t.wait(0.2);
    for (const heading of [0, 120, -100]) {
      await t.call('chaseLook', 0, 0, heading, 9);
      const r = await t.call('viewRules');
      t.assert(r.aimDeg === r.chaseAimDeg, `aim() ${r.aimDeg} is not chaseAimHeading ${r.chaseAimDeg} (camera ${heading})`);
      // The reticle's ray meets the ground a dozen metres ahead: the aim is along the camera, give or take the shoulder.
      t.near(Math.abs(deg(r.aimDeg - heading)), 0, 12, `camera ${heading}: aim off the camera's heading (deg)`);
    }
    // At the wheel: the camera looking out to the left puts the drive-by out of the driver's window. (Getting
    // in hands the camera over and its heading spring swings it behind the car: let it settle first.)
    await t.call('chaseLook', 0, 0, 0, 9);
    await t.call('drive', 'sedan', 0, 0);
    await t.wait(3);
    const car = await t.call('status');
    t.assert(car.vehicle === 'sedan', 'not in the sedan: ' + JSON.stringify(car));
    await t.call('chaseLook', 0, 0, -90, 9);
    let r = await t.call('viewRules');
    t.assert(r.aimDeg === r.chaseAimDeg, `at the wheel aim() ${r.aimDeg} is not chaseAimHeading ${r.chaseAimDeg}`);
    t.near(Math.abs(deg(r.aimDeg + 90)), 0, 25, 'at the wheel looking left: aim off -90 (deg)');
    await t.call('holdSimulation', true);
    try {
      await t.keys('KeyF', 0.6);
      const d = await t.call('driveBy');
      t.note('drive-by: ' + JSON.stringify({ window: d.window, relDeg: d.relDeg, aim: d.aim, out: d.out }));
      t.assert(d.window === 'left' && d.aim === 'clear', 'the drive-by did not go out of the left window: ' + JSON.stringify(d));
      t.near(Math.abs(deg(d.relDeg + 90)), 0, 25, 'drive-by aim off the nose (deg from -90)');
    } finally {
      await t.call('holdSimulation', false);
    }
    // The street view asks the street aim again.
    await t.call('viewMode', 'street');
    await t.wait(0.2);
    r = await t.call('viewRules');
    t.assert(r.chaseAimDeg === null, 'the street view still reports the chase aim');
  } finally {
    await t.call('viewMode', 'street');
    await t.call('wanted', 0);
    await t.call('god', false);
  }
}
