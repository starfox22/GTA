// Chase camera input (chase-camera.js, gamepad.js, game-input.js, settings): V (a real key press) switches the
// street view and the chase view and back, the choice is saved in the settings, the pad's right stick turns the chase
// camera (and leaves the street view's aim alone), LT aims over the shoulder on foot (closer boom, narrower lens), R3
// switches the view, the zoom keys move the boom, and the look sensitivity scales a stick turn.
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('settings', { cameraView: 'street', lookSensitivity: 100, invertLook: false });
    await t.call('teleport', 1000, 1000);
    await t.call('arm', 0);
    await t.wait(0.2);

    // V toggles the view (a real key press through the bindings) and the setting follows.
    await t.keys('KeyV', 0.1, { real: true });
    let cam = await t.call('chaseCamera');
    t.assert(cam.mode === 'chase' && cam.live, `V did not switch to the chase view: ${JSON.stringify(cam)}`);
    let set = await t.call('settings');
    t.assert(set.cameraView === 'chase', `settings do not say chase: ${set.cameraView}`);
    await t.wait(0.3);
    cam = await t.call('chaseCamera');
    t.assert(cam.ready, `chase camera not placed after a step: ${JSON.stringify(cam)}`);
    t.finite(cam, 'chaseCamera');
    t.near(cam.boomMetres, 3, 4, 'on foot: boom (m)');
    t.near(cam.heightMetres, 1.6, 3, 'on foot: camera height over the street (m)');

    // The right stick turns the camera; letting go stops it.
    const yaw0 = cam.yawDeg;
    await t.call('gamepadFeed', { axes: [0, 0, 1, 0] });
    await t.wait(0.5);
    cam = await t.call('chaseCamera');
    const turned = ((cam.yawDeg - yaw0 + 540) % 360) - 180;
    t.near(turned, 25, 120, 'right stick right for 0.5 s: turn (deg)');
    await t.call('gamepadFeed', { axes: [0, 0, 0, 0] });
    await t.wait(0.2);
    const still = (await t.call('chaseCamera')).yawDeg;
    await t.wait(0.3);
    t.assert((await t.call('chaseCamera')).yawDeg === still, 'the camera kept turning after the stick was let go');

    // Half the sensitivity turns about half as far.
    await t.call('settings', { lookSensitivity: 50 });
    const yaw1 = (await t.call('chaseCamera')).yawDeg;
    await t.call('gamepadFeed', { axes: [0, 0, 1, 0] });
    await t.wait(0.5);
    await t.call('gamepadFeed', { axes: [0, 0, 0, 0] });
    const half = ((((await t.call('chaseCamera')).yawDeg - yaw1 + 540) % 360) - 180) / turned;
    t.near(half, 0.35, 0.65, 'half sensitivity: share of the turn');
    await t.call('settings', { lookSensitivity: 100 });

    // LT on foot with a gun: over the shoulder.
    await t.call('gamepadFeed', { axes: [0, 0, 0, 0], buttons: { LT: 1 } });
    await t.wait(0.5);
    cam = await t.call('chaseCamera');
    t.near(cam.aiming, 0.85, 1, 'LT held: aim blend');
    t.near(cam.boomMetres, 1.5, 2.4, 'LT held: boom (m)');
    t.near(cam.fov, 42, 47, 'LT held: lens (deg)');
    await t.call('gamepadFeed', { axes: [0, 0, 0, 0] });
    await t.wait(0.5);
    cam = await t.call('chaseCamera');
    t.near(cam.aiming, 0, 0.1, 'LT let go: aim blend');

    // The zoom keys move the boom in the chase view (not the street zoom).
    const street = (await t.call('cameraView')).target;
    await t.keys('Minus', 0.1, { real: true });
    await t.wait(1.5);
    cam = await t.call('chaseCamera');
    t.near(cam.zoom, 1.2, 1.3, 'zoom out key: boom factor');
    t.assert((await t.call('cameraView')).target === street, 'the zoom key moved the street zoom in the chase view');
    await t.keys('Digit0', 0.1, { real: true });
    t.near((await t.call('chaseCamera')).zoom, 1, 1, 'zoom reset: boom factor');

    // C held in a car looks behind it (a cut round) and lets go back.
    await t.call('drive', 'sedan', 0, 0);
    await t.wait(2);
    let car = await t.call('chaseCamera');
    t.near(Math.abs(((car.yawDeg - 0 + 540) % 360) - 180), 0, 8, 'in the car: the camera looks along the car (deg off)');
    await t.keys('KeyC', 0.3);
    car = await t.call('chaseCamera');
    t.assert(car.behind === true, 'C held in a car did not look behind: ' + JSON.stringify(car));
    t.near(Math.abs(((car.yawDeg - 180 + 540) % 360) - 180), 0, 8, 'looking behind: the camera looks back along the car (deg off)');
    await t.wait(0.1);
    car = await t.call('chaseCamera');
    t.assert(car.behind === false, 'still looking behind after C was let go: ' + JSON.stringify(car));
    t.near(Math.abs(((car.yawDeg + 540) % 360) - 180), 0, 8, 'C let go: the camera looks along the car again (deg off)');
    await t.call('interact');
    await t.wait(0.5);

    // R3 switches back to the street view; there the right stick aims again.
    await t.call('gamepadFeed', { buttons: { R3: 1 } });
    await t.call('gamepadFeed', { buttons: { R3: 0 } });
    cam = await t.call('chaseCamera');
    t.assert(cam.mode === 'street' && !cam.live, `R3 did not switch to the street view: ${JSON.stringify(cam)}`);
    const pad = await t.call('gamepadFeed', { axes: [0, 0, 1, 0] });
    t.assert(pad.aiming === true, `right stick does not aim in the street view: ${JSON.stringify(pad)}`);
  } finally {
    await t.call('gamepadFeed', null);
    await t.call('settings', { cameraView: 'street', lookSensitivity: 100, invertLook: false });
    await t.call('holdSimulation', false);
    // Hints back to naming keys for the tests that follow on this page.
    await t.keys('ShiftLeft', 0.1, { real: true });
  }
}
