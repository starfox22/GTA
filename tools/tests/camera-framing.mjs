// The street camera's framing (world-view.js CAMERA CONTEXT): close on foot, one zoom step
// wider than the old 1.75 in a car at rest (1.4; motorbikes, long vehicles and boats moved out
// by the same step), further back at speed, and back in again on foot; the wheel zoom stays a
// factor on all of it. The framing eases with the simulation, so `framed` (the zoom it holds)
// follows `aim` (the zoom it eases to) under console simulate() too.
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
  // One zoom step wider than the old 1.75 at the default: 1.4.
  t.near(parked.context, 0.7, 0.7, 'car context');
  t.near(parked.aim, 1.39, 1.41, 'car at rest aim');
  // Boarding eases out over about two seconds, without overshooting.
  await t.wait(1);
  const easing = await t.call('cameraView');
  t.assert(easing.framed < 2 && easing.framed > 1.4, `framing a second after boarding: ${easing.framed}`);
  await t.wait(2.5);
  const settled = await t.call('cameraView');
  t.near(settled.framed, 1.39, 1.43, 'car at rest framed after 3.5 s');

  await t.keys('KeyW', 9);
  const fast = await t.call('cameraView');
  t.finite(fast, 'at speed');
  // The pull-back (world-view.js SPEED PULL-BACK) on the eased speed: 1 / (1 + 0.0045 g).
  const over = Math.max(0, fast.kmh - 20),
    pull = 1 / (1 + 0.0045 * (over < 30 ? (over * over) / 60 : over - 15));
  t.assert(fast.kmh > 50 && fast.speed < 0.9, `no pull-back at speed: ${JSON.stringify(fast)}`);
  t.near(fast.speed, pull - 0.01, pull + 0.01, `pull-back at ${fast.kmh} km/h`);
  t.assert(fast.aim < parked.aim - 0.15 && fast.aim >= 0.7, `aim at speed ${fast.aim} (at rest ${parked.aim})`);
  t.assert(fast.framed < parked.aim - 0.1, `the framing did not follow the speed: ${fast.framed}`);
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

  // The other road vehicles moved out by the same step: motorbike 0.76, bus 0.6, a boat 0.6.
  for (const [type, share] of [
    ['bike', 0.76],
    ['bus', 0.6],
  ]) {
    await t.call('teleport', 420, 4600);
    await t.call('drive', type, 0, Math.PI / 2);
    const v = await t.call('cameraView');
    t.near(v.context, share, share, `${type} context`);
    await t.call('interact');
    await t.wait(0.5);
  }
}
