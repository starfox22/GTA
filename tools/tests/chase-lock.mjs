// Lock-on in the chase view (chase-camera.js LOCK-ON, Settings · Gameplay · Aim assist): aiming (LT here) with a
// gunman a few degrees off the reticle turns the camera onto his chest and holds it, so the reticle's aim hits him;
// a push of the right stick breaks it to free aim; with Aim assist off nothing locks; a passer-by never locks.
export const fresh = true;
export default async function (t) {
  const yawTo = (from, to) => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
    off = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  await t.call('god', true);
  await t.call('holdSimulation', true);
  try {
    await t.call('settings', { cameraView: 'chase', aimAssist: true });
    await t.call('teleport', 1450, 1152);
    await t.call('arm', 0);
    await t.wait(0.3);
    await t.call('chaseLook', 0, 0, 0, 6); // east along the avenue
    const me = await t.call('status'),
      g = await t.call('gunmanAt', me.x + 200, me.y + 40); // 25 m ahead, about 11 degrees right
    await t.wait(0.1);
    let cam = await t.call('chaseCamera');
    const before = off(cam.yawDeg, yawTo(me, g));
    t.assert(before > 5, 'the gunman is already on the reticle: ' + before);

    // LT: the camera turns onto him and the reticle's aim is his.
    await t.call('gamepadFeed', { buttons: { LT: 1 } });
    await t.wait(0.6);
    cam = await t.call('chaseCamera');
    t.assert(cam.lockOn && cam.lockOn.kind === 'harbor', 'no lock-on while aiming at a gunman near the reticle: ' + JSON.stringify(cam));
    t.assert(cam.aim && cam.aim.hit, 'the reticle does not sit on the locked gunman: ' + JSON.stringify(cam.aim));
    t.near(off(cam.yawDeg, yawTo({ x: cam.position[0], y: cam.position[1] }, g)), 0, 3, 'locked: camera heading off the gunman (deg)');

    // The right stick breaks it.
    await t.call('gamepadFeed', { buttons: { LT: 1 }, axes: [0, 0, 1, 0] });
    await t.wait(0.3);
    await t.call('gamepadFeed', { buttons: { LT: 1 }, axes: [0, 0, 0, 0] });
    await t.wait(0.2);
    cam = await t.call('chaseCamera');
    t.assert(!cam.lockOn, 'the lock held through a push of the right stick: ' + JSON.stringify(cam.lockOn));

    // Aim assist off: nothing locks.
    await t.call('gamepadFeed', null);
    await t.wait(0.2);
    await t.call('settings', { aimAssist: false });
    await t.call('chaseLook', 0, 0, 0, 6);
    await t.call('gamepadFeed', { buttons: { LT: 1 } });
    await t.wait(0.5);
    cam = await t.call('chaseCamera');
    t.assert(!cam.lockOn, 'locked with aim assist off: ' + JSON.stringify(cam.lockOn));
    t.near(off(cam.yawDeg, 0), 0, 1, 'aim assist off: the camera kept its heading (deg)');
  } finally {
    await t.call('gamepadFeed', null);
    await t.call('settings', { cameraView: 'street', aimAssist: true });
    await t.call('holdSimulation', false);
    await t.call('god', false);
  }
}
