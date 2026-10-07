// The car radio in the chase view (hud-state.js hudPop): getting in or changing station flashes the station chip
// instead of opening the radio over the road ahead (as touch mode does); the street view still pops it open.
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('settings', { cameraView: 'chase' });
    await t.call('teleport', 1152, 1160);
    await t.wait(0.3);
    await t.call('drive', 'sedan', 0, 0);
    await t.wait(0.3);
    let r = await t.call('radio');
    t.assert(r.shown, 'chase view: no radio chip in the car: ' + JSON.stringify(r));
    t.assert(!r.open, 'chase view: getting in opened the radio over the road: ' + JSON.stringify(r));
    const station = r.station;
    await t.keys('KeyB', 0.1, { real: true });
    r = await t.call('radio');
    t.assert(r.station !== station, 'B did not change the station: ' + JSON.stringify(r));
    t.assert(!r.open, 'chase view: a new station opened the radio: ' + JSON.stringify(r));

    // The street view keeps its pop: a new station opens the radio for a moment.
    await t.call('settings', { cameraView: 'street' });
    await t.wait(0.2);
    await t.keys('KeyB', 0.1, { real: true });
    r = await t.call('radio');
    t.assert(r.open, 'street view: a new station did not open the radio: ' + JSON.stringify(r));
  } finally {
    await t.call('settings', { cameraView: 'street' });
    await t.call('holdSimulation', false);
  }
}
