// The street camera's framing (world-view.js CAMERA CONTEXT): close on foot, wider in a
// car at rest, further back at speed, and back in again on foot; the wheel zoom stays
// a factor on all of it.
export default async function (t) {
  await t.call('teleport', 1600, 2700);
  await t.call('setZoom', 2.5);
  await t.wait(6);
  const foot = await t.call('cameraView');
  t.finite(foot, 'on foot');
  t.near(foot.context, 1, 1, 'on-foot context');
  t.near(foot.zoom, 2.4, 2.6, 'on-foot zoom');
  t.assert(foot.personPx >= 22, `a person stands ${foot.personPx} px tall on foot`);
  t.note(`on foot: zoom ${foot.zoom}, ${foot.viewMetres} m of street, person ${foot.personPx} px`);

  await t.call('drive', 'sedan');
  await t.wait(6);
  const parked = await t.call('cameraView');
  t.near(parked.context, 0.7, 0.7, 'car context');
  t.near(parked.zoom, 1.65, 1.85, 'car at rest zoom');

  await t.keys('KeyW', 9);
  const fast = await t.call('cameraView');
  t.finite(fast, 'at speed');
  t.assert(fast.speed < 0.95, `no pull-back at speed: ${JSON.stringify(fast)}`);
  t.assert(fast.zoom < parked.zoom - 0.1, `zoom ${fast.zoom} not wider than at rest ${parked.zoom}`);
  t.note(`at speed: zoom ${fast.zoom}, speed share ${fast.speed}`);

  // Stop, step out: the view comes back in.
  await t.keys('KeyS', 3.5);
  await t.wait(1);
  await t.call('interact');
  await t.wait(7);
  const out = await t.call('cameraView');
  t.near(out.context, 1, 1, 'context after stepping out');
  t.near(out.zoom, 2.35, 2.6, 'zoom after stepping out');

  // The wheel zoom is a factor on the framing: half the zoom on foot, half in the car.
  await t.call('setZoom', 1.25);
  await t.wait(4);
  const wide = await t.call('cameraView');
  t.near(wide.zoom, 1.15, 1.35, 'zoomed-out on foot');
  await t.call('setZoom', 2.5);
}
