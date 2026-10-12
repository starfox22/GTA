// The street camera's framing (world-view.js CAMERA CONTEXT): close on foot and in a car below 30 km/h (SLOW
// FRAMING; tools/tests/camera-slow-framing.mjs), two zoom steps wider than the old 1.75 in a car from 31 km/h
// (1.12 before the pull-back; motorbikes, long vehicles and boats keep their proportions), further back at speed, and back in again on foot; the wheel zoom and Settings ·
// Driving · Vehicle camera distance stay factors on all of it; Motion comfort holds the framing still
// whatever the speed. The framing eases with the simulation, so `framed` (the zoom it holds)
// follows `aim` (the zoom it eases to) under console simulate() too.
export default async function (t) {
  // Settings · Driving defaults: the street camera stands 120 % back in a vehicle, 100 % on foot, and leads 200 %;
  // the framing below is measured at 100 % and the defaults restored at the end.
  const defaults = await t.call('settings');
  t.assert(defaults.cameraDistance === 120 && defaults.lookAhead === 200 && defaults.walkDistance === 100, 'driving camera defaults: ' + JSON.stringify(defaults));
  await t.call('settings', { cameraDistance: 100 });
  // On the airport runway, heading south down it: clear of traffic and of the spot other
  // tests drive from.
  await t.call('teleport', 420, 4600);
  // The on-foot default (world-view.js STREET_ZOOM 2: one zoom step out from 2.5).
  const start = await t.call('cameraView');
  t.near(start.defaultZoom, 2, 2, 'on-foot default zoom');
  await t.call('setZoom', 2);
  const foot = await t.call('cameraView');
  t.finite(foot, 'on foot');
  t.near(foot.context, 1, 1, 'on-foot context');
  t.near(foot.aim, 2, 2, 'on-foot aim');
  t.note(`on foot: zoom ${foot.zoom}, ${foot.viewMetres} m of street, person ${foot.personPx} px`);

  await t.call('drive', 'sedan', 0, Math.PI / 2);
  const parked = await t.call('cameraView');
  // At rest the walking framing; its own share (from 31 km/h) two zoom steps wider than the old 1.75: 1.12.
  t.near(parked.context, 1, 1, 'car context at rest (walking)');
  t.near(parked.vehicleContext, 0.56, 0.56, 'car context');
  t.near(parked.aim, 2, 2, 'car at rest aim');
  // Past 31 km/h it eases out over a couple of seconds, without overshooting.
  await t.keys('KeyW', 2);
  const easing = await t.call('cameraView');
  t.assert(!easing.slowFraming && easing.context === 0.56, `the car framing at ${easing.kmh} km/h: ${JSON.stringify(easing)}`);
  t.assert(easing.framed < 2 && easing.framed > easing.aim, `framing easing out: ${easing.framed} (aim ${easing.aim})`);

  await t.keys('KeyW', 7);
  const fast = await t.call('cameraView');
  t.finite(fast, 'at speed');
  // The pull-back (world-view.js SPEED PULL-BACK) on the eased speed: 1 / (1 + 0.0025 g).
  const over = Math.max(0, fast.kmh - 20),
    pull = 1 / (1 + 0.0025 * (over < 30 ? (over * over) / 60 : over - 15));
  t.assert(fast.kmh > 50 && fast.speed < 0.95, `no pull-back at speed: ${JSON.stringify(fast)}`);
  t.near(fast.speed, pull - 0.01, pull + 0.01, `pull-back at ${fast.kmh} km/h`);
  // The car's framing before the pull-back: 2 × 0.56 = 1.12.
  const carRest = 2 * parked.vehicleContext;
  t.assert(fast.aim < carRest - 0.08 && fast.aim >= 0.7, `aim at speed ${fast.aim} (the car's framing before the pull-back ${carRest})`);
  t.assert(fast.framed < carRest - 0.05, `the framing did not follow the speed: ${fast.framed}`);
  t.note(`at speed (${fast.kmh} km/h eased): aim ${fast.aim}, framed ${fast.framed}, speed share ${fast.speed}`);

  // Stop, step out: the view aims back in.
  await t.keys('KeyS', 3.5);
  await t.wait(1);
  await t.call('interact');
  await t.wait(2);
  const out = await t.call('cameraView');
  t.near(out.context, 1, 1, 'context after stepping out');
  t.near(out.aim, 2, 2, 'aim after stepping out');

  // The wheel zoom is a factor on the framing.
  await t.call('setZoom', 1.25);
  const wide = await t.call('cameraView');
  t.near(wide.aim, 1.25, 1.25, 'zoomed-out on foot');
  await t.call('setZoom', 2);

  // The other road vehicles keep their proportions to the car: motorbike 0.61, bus 0.48, a boat 0.48.
  for (const [type, share] of [
    ['bike', 0.61],
    ['bus', 0.48],
  ]) {
    await t.call('teleport', 420, 4600);
    await t.call('drive', type, 0, Math.PI / 2);
    const v = await t.call('cameraView');
    t.near(v.vehicleContext, share, share, `${type} context`);
    await t.call('interact');
    await t.wait(0.5);
  }

  // Settings · Driving · Vehicle camera distance: 125 % is one zoom step further out in every vehicle.
  try {
    await t.call('settings', { cameraDistance: 125 });
    await t.call('teleport', 420, 4600);
    await t.call('drive', 'sedan', 0, Math.PI / 2);
    const far = await t.call('cameraView');
    t.near(far.vehicleContext, 0.448 - 0.002, 0.448 + 0.002, 'car context at 125 % distance');
    t.assert(far.vehicleDistance === 125, 'distance reported: ' + far.vehicleDistance);
    await t.call('settings', { cameraDistance: 100 });
    // Motion comfort: the framing holds one zoom whatever the speed.
    await t.call('settings', { motionComfort: true });
    await t.wait(3);
    const still = await t.call('cameraView');
    await t.keys('KeyW', 9);
    const quick = await t.call('cameraView');
    t.assert(quick.kmh > 60 && still.motionComfort, 'comfort run too slow: ' + quick.kmh);
    t.near(quick.speed, 0.86, 0.86, 'motion comfort framing at speed');
    t.near(quick.aim, still.aim - 0.001, still.aim + 0.001, `motion comfort holds the zoom (${still.aim} at rest, ${quick.aim} at ${quick.kmh} km/h)`);
    await t.keys('KeyS', 3.5);
    await t.call('interact');
  } finally {
    await t.call('settings', { motionComfort: false, drivingReset: true });
  }
}
