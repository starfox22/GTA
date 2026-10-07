// Chase camera CLOSE QUARTERS (chase-camera.js CHASE_CRANE): backed against a wall, the boom comes in and the camera
// cranes up over the head (eased) so the head does not fill the frame; in the open, or while aiming over the
// shoulder, it does not crane.
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('settings', { cameraView: 'chase' });
    await t.call('arm', 0);
    // A stucco block's south face stands at y 1052 (Northbank): the player 1.5 m in front of it, the camera turned
    // to look south, so the boom runs back into the wall.
    await t.call('teleport', 1844, 1064);
    await t.wait(0.5);
    await t.call('chaseLook', 0, 0, 90, 4);
    await t.wait(1.5);
    let cam = await t.call('chaseCamera');
    t.finite(cam, 'chaseCamera');
    t.assert(cam.boomMetres < 1.6, 'the wall did not cut the boom short: ' + JSON.stringify(cam));
    t.near(cam.craneMetres, 0.25, 0.56, 'against the wall: crane (m)');

    // Aiming over the shoulder lets the crane down.
    await t.call('gamepadFeed', { axes: [0, 0, 0, 0], buttons: { LT: 1 } });
    await t.wait(1);
    cam = await t.call('chaseCamera');
    t.assert(cam.aiming > 0.8, 'LT did not aim: ' + JSON.stringify(cam));
    t.near(cam.craneMetres, 0, 0.1, 'aiming: crane (m)');
    await t.call('gamepadFeed', { axes: [0, 0, 0, 0] });

    // In the open: no crane.
    await t.call('teleport', 1152, 1160);
    await t.wait(0.5);
    await t.call('chaseLook', 0, 0, 90, 4);
    await t.wait(1.5);
    cam = await t.call('chaseCamera');
    t.near(cam.boomMetres, 3, 4, 'in the open: boom (m)');
    t.near(cam.craneMetres, 0, 0.02, 'in the open: crane (m)');
  } finally {
    await t.call('gamepadFeed', null);
    await t.call('settings', { cameraView: 'street' });
    await t.call('holdSimulation', false);
  }
}
