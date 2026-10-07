// Camera motion blur (postfx3d-motion.js, chase-camera.js chaseMotionBlurAllowed): only in the chase view, only with
// Settings · Graphics · Motion blur on, never with Motion comfort, never in the street view. The game's half of the
// rule is checked here on the no-render page; where a renderer runs (a rendered dev page) the pass itself must smear
// while driving fast at HIGH and stop when the setting or comfort turns it off.
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('settings', { cameraView: 'street', motionBlur: true, motionComfort: false });
    await t.call('teleport', 1000, 1000);
    await t.wait(0.3);
    t.assert((await t.call('settings')).motionBlur === true, 'Motion blur is not on by default');
    t.assert((await t.call('chaseCamera')).motionBlur === false, 'motion blur allowed in the street view');

    await t.call('viewMode', 'chase');
    await t.wait(0.3);
    t.assert((await t.call('chaseCamera')).motionBlur === true, 'motion blur not allowed in the chase view');
    await t.call('settings', { motionComfort: true });
    t.assert((await t.call('chaseCamera')).motionBlur === false, 'motion blur allowed with Motion comfort on');
    await t.call('settings', { motionComfort: false, motionBlur: false });
    t.assert((await t.call('chaseCamera')).motionBlur === false, 'motion blur allowed with the setting off');
    await t.call('settings', { motionBlur: true });

    const view = (await t.call('chaseCamera')).view;
    if (!view) return; // no renderer on the no-render page
    await t.call('graphics', 'high');
    await t.call('drive', 'sedan', 0, 0);
    await t.keys('KeyW', 3);
    let blur = (await t.call('chaseCamera')).view.motionBlur;
    t.assert(blur && blur.active === true && blur.strength > 0, 'no motion blur driving fast at HIGH: ' + JSON.stringify(blur));
    await t.call('settings', { motionBlur: false });
    await t.keys('KeyW', 0.5);
    blur = (await t.call('chaseCamera')).view.motionBlur;
    t.assert(blur.active === false, 'motion blur still drawn with the setting off: ' + JSON.stringify(blur));
  } finally {
    await t.call('settings', { cameraView: 'street', motionBlur: true, motionComfort: false });
    await t.call('holdSimulation', false);
  }
}
