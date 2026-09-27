// The street camera's framing (world-view.js CAMERA CONTEXT): close on foot, wider in a
// car at rest, further back at speed, and back in again on foot; the wheel zoom stays
// a factor on all of it. The easing itself advances with drawn frames, which console
// simulate() does not run, so this checks `aim` (the zoom the camera eases to).
export default async function (t) {
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
  // The car frames as it always did: 1.75 at the default.
  t.near(parked.context, 0.875, 0.875, 'car context');
  t.near(parked.aim, 1.74, 1.76, 'car at rest aim');

  await t.keys('KeyW', 9);
  const fast = await t.call('cameraView');
  t.finite(fast, 'at speed');
  t.assert(fast.speed < 0.95, `no pull-back at speed: ${JSON.stringify(fast)}`);
  t.assert(fast.aim < parked.aim - 0.1 && fast.aim >= 0.8, `aim at speed ${fast.aim} (at rest ${parked.aim})`);
  t.note(`at speed: aim ${fast.aim}, speed share ${fast.speed}`);

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
}
