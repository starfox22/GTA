// Driving camera comfort (camera-drive.js follow, world-view.js framing, camera-comfort.js metric): boarding
// frames one step wider (1.4), the pull-back keeps widening with speed and eases without pumping, and the
// view's acceleration, jerk and zoom rate stay low through a slalom, hard braking, a turn and a rough county
// drive; a blast jolts the view less in a car than on foot. All numbers are noted first, then checked.
export const fresh = true;
const SPOT = { x: 420, y: 4400 }; // the airport's open ground, heading south down the runway
const pull = (kmh) => {
  const over = Math.max(0, kmh - 20),
    g = over < 30 ? (over * over) / 60 : over - 15;
  return Math.max(0.5, 1 / (1 + 0.0045 * g));
};
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  await t.call('wanted', 0);
  const m = {};
  const comfort = async (label, seconds = 4) => {
    const v = await t.call('cameraView'),
      c = await t.call('cameraComfort', seconds),
      pose = await t.call('pose');
    m[label] = { ...c, kmh: pose.kmh, framed: v.framed, speed: v.speed, eased: v.kmh, context: v.context };
    t.note(`${label} (${pose.kmh} km/h, framed ${v.framed}): ${JSON.stringify(c)}`);
    return v;
  };
  try {
    // Boarding a sports car at rest: the view eases out to 0.7 of the on-foot zoom.
    await t.call('teleport', SPOT.x, SPOT.y);
    await t.call('setZoom', 2);
    await t.wait(1.5);
    await t.call('drive', 'sport', 0, Math.PI / 2);
    await t.wait(3);
    const parked = await comfort('board');
    // Full throttle for five seconds, then a steady cruise.
    await t.keys('KeyW', 5);
    await comfort('accelerate');
    await t.keys('KeyW', 1.5);
    const cruise = await t.call('cameraView');
    // Slalom: the wheel left and right every half second.
    for (let i = 0; i < 8; i++) await t.keys(['KeyW', i % 2 ? 'KeyD' : 'KeyA'], 0.5);
    const slalom = await comfort('slalom');
    // Two lane changes, out and back (about 0.4 Hz, the band that makes people ill).
    for (const [a, b] of [
      ['KeyD', 'KeyA'],
      ['KeyA', 'KeyD'],
    ]) {
      await t.keys(['KeyW', a], 0.4);
      await t.keys(['KeyW', b], 0.4);
      await t.keys('KeyW', 0.7);
    }
    await comfort('weave', 3);
    // Hard braking to a crawl.
    await t.keys('KeyS', 3.5);
    await comfort('brake');
    // A 90-degree turn at city speed.
    await t.call('teleport', SPOT.x, SPOT.y);
    await t.call('drive', 'sedan', 0, Math.PI / 2);
    await t.keys('KeyW', 4);
    await t.keys(['KeyW', 'KeyD'], 1.4);
    await t.keys('KeyW', 1.6);
    await comfort('turn', 3);
    // A 4x4 across the rough foothills of the Ridgeline Range at ~50 km/h.
    await t.call('teleport', 7300, 2900);
    await t.call('drive', 'expedition', 0, Math.PI / 2);
    await t.wait(1);
    await t.keys('KeyW', 5);
    await comfort('rough');
    // A blast 50 m away: on foot, then in a car (the tremor and the kick are gentler at the wheel).
    await t.call('teleport', SPOT.x, SPOT.y);
    await t.wait(4.5);
    await t.call('blast', SPOT.x + 400, SPOT.y, 1);
    await t.wait(1);
    const onFoot = (await t.call('cameraView')).comfort;
    await t.call('drive', 'sedan', 0, Math.PI / 2);
    await t.wait(4.5);
    await t.call('blast', SPOT.x + 460, SPOT.y, 1);
    await t.wait(1);
    const inCar = (await t.call('cameraView')).comfort;
    t.note(`blast jolt: on foot ${onFoot.jolt}, in a car ${inCar.jolt}`);

    // Framing: one zoom step wider than the old 1.75 at rest; the pull-back follows its curve and is
    // well wider than the old camera's at highway speed.
    t.near(parked.context, 0.7, 0.7, 'car context');
    t.near(parked.framed, 1.36, 1.44, 'car at rest framed (zoom)');
    t.assert(cruise.kmh >= 95, `cruise too slow for the highway check: ${cruise.kmh} km/h`);
    t.near(cruise.speed, pull(cruise.kmh) - 0.01, pull(cruise.kmh) + 0.01, `pull-back at ${cruise.kmh} km/h`);
    // The old camera held 1.37 at 110 km/h (0.78 of its 1.75 at rest).
    t.assert(cruise.framed <= 1.15, `the view at ${cruise.kmh} km/h is not wider than before: framed ${cruise.framed}`);
    t.assert(slalom.framed < 1.15, `the view at ~100 km/h is not wide: framed ${slalom.framed}`);
    // Comfort (screen heights per s^2 and s^3, zoom % per s). The old follow measured: slalom accel rms 0.27,
    // jerk rms 1.5, peak 2.4; braking accel rms 0.31, jerk rms 0.8; rough ground jerk peak 3-22.
    const below = (label, path, limit) => {
      const value = path.split('.').reduce((o, k) => o?.[k], m[label]);
      t.assert(Number.isFinite(value) && value <= limit, `${label} ${path} ${value} > ${limit}`);
    };
    below('board', 'zoomRate.peak', 32);
    below('accelerate', 'zoomRate.peak', 12);
    below('accelerate', 'jerk.peak', 1.2);
    below('slalom', 'accel.rms', 0.12);
    below('slalom', 'jerk.rms', 0.4);
    below('slalom', 'jerk.peak', 0.9);
    below('weave', 'accel.rms', 0.15);
    below('weave', 'jerk.rms', 0.4);
    below('brake', 'accel.rms', 0.26);
    below('brake', 'jerk.rms', 0.5);
    below('brake', 'zoomRate.peak', 10);
    below('turn', 'jerk.peak', 1.5);
    below('rough', 'accel.rms', 0.25);
    below('rough', 'jerk.peak', 2.5);
    // In the slalom the car weaves on screen rather than the whole view swaying with it.
    t.assert(m.slalom.drift.swing > 0.03, `the car did not weave on screen: ${JSON.stringify(m.slalom.drift)}`);
    t.assert(inCar.jolt <= onFoot.jolt * 0.65 + 1e-4, `a blast jolts the car's view as much as on foot: ${inCar.jolt} vs ${onFoot.jolt}`);
  } finally {
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
