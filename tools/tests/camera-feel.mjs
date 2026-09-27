// Camera feel (camera-feel.js): the lead follows the car's path, not its nose, and swings
// smoothly through a handbrake spin; on foot it leans toward the aim in a fight; gunfire
// kicks the view back against the aim; Camera look-ahead 0 turns the leads off.
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // Down the airport runway's south half (camera-framing drives its north half).
    await t.call('teleport', 420, 6400);
    await t.call('drive', 'sport', 0, Math.PI / 2);
    await t.keys('KeyW', 3.5);
    const run = await t.call('cameraFeel');
    const pose = await t.call('pose');
    t.finite(run, 'cameraFeel at speed');
    t.near(run.leadHeading, 85, 95, 'lead heading on a straight (deg, south = 90)');
    // 0.45 s of travel, eased: most of it after a few seconds of steady speed.
    const expect = (pose.kmh / 3.6) * 0.45;
    t.near(+(run.leadMetres / expect).toFixed(2), 0.75, 1.05, 'lead / 0.45 s of travel');
    // A handbrake spin: the lead moves smoothly (the old nose lead swept ~60+ units a tenth).
    let last = run.lead,
      swing = 0;
    for (let i = 0; i < 12; i++) {
      await t.keys(['Space', 'KeyD'], 0.1);
      const f = await t.call('cameraFeel');
      swing = Math.max(swing, Math.hypot(f.lead[0] - last[0], f.lead[1] - last[1]));
      last = f.lead;
    }
    t.near(swing, 0, 14, 'largest lead swing in a tenth of a second during the spin (units)');
    // On foot, aiming east with the stick: the view leans that way.
    await t.call('teleport', 420, 6400);
    await t.call('footwork', 0);
    await t.wait(1.5);
    const aimed = await t.call('cameraFeel');
    t.near(aimed.lead[0], 22, 40, 'on-foot aim lead east (units)');
    t.near(Math.abs(aimed.lead[1]), 0, 3, 'on-foot aim lead across');
    // A shot kicks the view back against it (the round may snap to someone near the
    // cursor when a mouse was used on the page, so only the size is checked here).
    await t.keys('KeyF', 0.04);
    await t.wait(0.04);
    const kicked = await t.call('cameraFeel');
    t.near(Math.hypot(kicked.kick[0], kicked.kick[1]), 0.5, 2.5, 'pistol recoil kick (units)');
    await t.wait(1);
    const settled = await t.call('cameraFeel');
    t.near(Math.abs(settled.kick[0]), 0, 0.2, 'kick settled after a second');
    // Look-ahead 0: no lead at all.
    await t.call('settings', { lookAhead: 0 });
    await t.wait(2.5);
    const off = await t.call('cameraFeel');
    t.near(off.leadMetres, 0, 0.3, 'lead with look-ahead 0 (m)');
  } finally {
    await t.call('footwork', null);
    await t.call('settings', { lookAhead: 100 });
    await t.call('holdSimulation', false);
  }
}
