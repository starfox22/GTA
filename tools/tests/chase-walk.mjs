// The chase view: W walks along the camera's heading (chase-camera.js chaseMoveHeading, game-update.js), so after
// chaseLook turns the camera the player goes where it looks; the body faces the way it goes, not the aim, when idle.
export default async function (t) {
  await t.call('god', true);
  try {
    await t.call('viewMode', 'chase');
    await t.call('teleport', 1500, 1500); // open ground on every side (footwork.mjs)
    await t.wait(0.2);
    for (const heading of [135, -60, 10]) {
      await t.call('chaseLook', 0, 0, heading, 9);
      const a = await t.call('status');
      await t.keys('KeyW', 0.8);
      const b = await t.call('status'),
        went = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
        off = ((went - heading + 540) % 360) - 180;
      t.assert(Math.hypot(b.x - a.x, b.y - a.y) > 16, `W moved the player only ${Math.hypot(b.x - a.x, b.y - a.y).toFixed(1)} units`);
      t.near(Math.abs(off), 0, 8, `heading ${heading}: walked off the camera's heading by (deg)`);
    }
    // Standing still with no fight the body faces the way it went, not the aim (the camera can go round it).
    const r = await t.call('viewRules');
    t.assert(r.facingDeg === null, 'an idle player faces the aim in the chase view: ' + JSON.stringify(r));
  } finally {
    await t.call('viewMode', 'street');
    await t.call('god', false);
  }
}
