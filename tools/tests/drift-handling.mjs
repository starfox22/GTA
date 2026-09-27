// Drift and handbrake feel (driving.js yawStability, physics-driving.js): a power slide
// settles at an angle instead of spinning, a counter-steer catches it, a handbrake flick
// swings the car round a junction and a held handbrake makes a 180, while grip driving
// with the assists on stays as it was.
export default async function (t) {
  await t.call('holdSimulation', true);
  const drift = (type, kmh, phases) => t.call('driftTest', type, kmh, phases);
  try {
    // The hot rod (no TCS or ESC) floored through a bend holds a drift, not a spin.
    const power = await drift('hotrod', 60, [['KeyW,KeyD', 3]]);
    t.finite(power, 'hot rod power corner');
    t.assert(!power.spun, 'hot rod spun under power: ' + JSON.stringify(power));
    t.near(power.peakSlip, 15, 65, 'hot rod power-slide peak slip deg');
    // Counter-steer catches it; so does lifting off with a dab of opposite lock.
    const caught = await drift('hotrod', 60, [['KeyW,KeyD', 0.9], ['KeyW,KeyA', 0.8], ['KeyW', 1.5]]);
    t.assert(!caught.spun, 'counter-steer did not catch the slide: ' + JSON.stringify(caught));
    t.near(Math.abs(caught.ends[2].slip), 0, 8, 'slip after the catch deg');
    const lifted = await drift('hotrod', 60, [['KeyW,KeyD', 0.9], ['KeyA', 0.5], ['', 1.5]]);
    t.assert(!lifted.spun, 'lift and counter-steer did not catch it: ' + JSON.stringify(lifted));
    // Assists off, a muscle car behaves the same way.
    await t.call('settings', { tcs: false, esc: false });
    const muscle = await drift('muscle', 60, [['KeyW,KeyD', 0.9], ['KeyW,KeyA', 0.8], ['KeyW', 1.5]]);
    t.assert(!muscle.spun, 'muscle car (assists off) was not caught: ' + JSON.stringify(muscle));
    await t.call('settings', { drivingReset: true });
    // A handbrake flick at 55 km/h swings a sedan well round in half a second...
    const flick = await drift('sedan', 55, [['Space,KeyD', 0.5], ['KeyW,KeyD', 0.4], ['KeyW', 1.2]]);
    t.near(flick.ends[0].turned, 30, 70, 'sedan handbrake 0.5 s turned deg');
    t.near(flick.ends[2].turned, 75, 140, 'sedan handbrake turn and power out deg');
    // ...and held at 60 km/h it brings a muscle car round past 120 degrees.
    const held = await drift('muscle', 60, [['Space,KeyD', 1.4]]);
    t.assert(held.ends[0].turned > 120, 'handbrake 1.4 s turned only ' + held.ends[0].turned);
    // Grip driving with the assists on: a lane change at 100 km/h stays tidy and the
    // muscle car's TCS keeps a floored bend a grip corner.
    const lane = await drift('sedan', 100, [['KeyW,KeyD', 0.4], ['KeyW,KeyA', 0.5], ['KeyW', 1]]);
    t.near(lane.peakSlip, 0, 6, 'sedan lane change peak slip deg');
    const grip = await drift('muscle', 60, [['KeyW,KeyD', 3]]);
    t.near(grip.peakSlip, 0, 14, 'muscle (TCS) floored bend peak slip deg');
  } finally {
    await t.call('settings', { drivingReset: true });
    await t.call('holdSimulation', false);
  }
}
