// Drive-bys with the real pointer and keys (driveby.js, game-input.js): driving with the
// forward key held and the pointer behind the car, the fire key fires back through the rear
// screen and bursts it; the pointer ahead with the button held while steering fires through
// the windscreen and bursts it. Every press of a driving key once handed the aim to the
// keyboard's auto-aim, so a shot meant for behind left through the driver's window.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  await t.call('teleport', 1000, 1000);
  await t.call('drive', 'sedan', 0, 0);
  await t.realWait(1.5);
  let r = await t.call('driveBy');
  t.assert(r.rearGlass === 0 && r.frontGlass === 0, 'glass not whole at the start: ' + JSON.stringify(r));

  // Behind: the pointer 12 m back, then the forward key and the fire key held.
  let p = await t.call('driveByScreenPoint', 180, 12);
  await t.mouse(p.x, p.y);
  r = await realUntil(t, wall => t.keys(['KeyW', 'KeyF'], wall, { real: true }), state => state.stats.shots > 0);
  t.assert(r.stats.shots > 0, 'no shot behind: ' + JSON.stringify(r));
  t.assert(r.window === 'rear' && Math.abs(r.relDeg) > 145, 'the shot behind left another way: ' + JSON.stringify(r));
  t.assert(r.rearGlass === 2 && r.stats.rearScreens === 1, 'rear screen not burst: ' + JSON.stringify(r));
  t.assert(r.frontGlass === 0, 'windscreen broken by a shot behind: ' + JSON.stringify(r));
  const back = r.stats.shots;

  // Ahead: the button held while steering (fresh key presses), through the windscreen,
  // which bursts on the first shot.
  p = await t.call('driveByScreenPoint', 0, 14);
  t.note('front pointer: ' + JSON.stringify({ point: p, boxes: (await t.call('hudOverlaps')).boxes }));
  r = await realUntil(t, wall => t.mouse(p.x, p.y, { seconds: wall, down: true, keys: ['KeyW'], taps: ['KeyA'] }), state => state.stats.shots > back);
  // The car keeps turning under a fixed pointer, so later shots may leave by the side
  // window: the windscreen burst proves the first one went ahead.
  t.assert(r.stats.shots > back && r.stats.windscreens === 1, 'no shot ahead: ' + JSON.stringify(r));
  t.assert(r.frontGlass === 2 && r.stats.windscreens === 1, 'windscreen not burst: ' + JSON.stringify(r));
  t.assert(r.stats.refused === 0 && !r.cross, 'a car refused an aim: ' + JSON.stringify(r));

  // A box truck: the pointer straight behind and the fire key give no shot, only the cross.
  await t.call('teleport', 1000, 1000);
  await t.call('drive', 'truck', 0, 0);
  // Let the camera settle on the truck, or the pixel drifts off straight back.
  await t.realWait(1.5);
  const before = (await t.call('driveBy')).stats;
  p = await t.call('driveByScreenPoint', 180, 14);
  await t.mouse(p.x, p.y);
  r = await realUntil(t, wall => t.keys('KeyF', wall, { real: true }), state => state.stats.refused > before.refused);
  t.assert(r.stats.shots === before.shots && r.stats.refused > before.refused, 'the truck fired straight back: ' + JSON.stringify(r));
  t.assert(Math.abs(r.crossDeg) > 140 && r.out === 0, 'no cross behind the truck (or an arm out): ' + JSON.stringify(r));
  // Out of the side: fires.
  p = await t.call('driveByScreenPoint', -90, 14);
  r = await realUntil(t, wall => t.mouse(p.x, p.y, { seconds: wall, down: true }), state => state.stats.shots > before.shots);
  t.assert(r.stats.shots > before.shots && r.window === 'left', 'the truck did not fire out of its window: ' + JSON.stringify(r));
}

// The capped live loop may advance only 0.2 game seconds per wall second under headless load.
// Keep each real mouse/key hold continuous (short releases can interrupt raising the gun), the fixed
// pointer and all aim/glass/refusal assertions. Calibrate the live clock and bound retries by game/wall time.
async function realUntil(t, action, done) {
  const start = (await t.call('frameFaults')).gameTime, wallStart = Date.now();
  let result;
  do {
    const from = (await t.call('frameFaults')).gameTime, sampledAt = Date.now();
    await t.realWait(0.4);
    const now = (await t.call('frameFaults')).gameTime,
      rate = (now - from) / Math.max(0.4, (Date.now() - sampledAt) / 1000),
      remainingWall = Math.max(0, 20 - (Date.now() - wallStart) / 1000),
      hold = Math.min(remainingWall, Math.max(2.5, 1 / Math.max(0.05, Math.min(1, rate))));
    if (hold <= 0) break;
    await action(hold);
    result = await t.call('driveBy');
    const elapsed = (await t.call('frameFaults')).gameTime - start;
    t.note(`continuous real hold ${hold.toFixed(1)} wall s, ${elapsed.toFixed(2)} game s at ${rate.toFixed(2)} game s/s`);
    if (done(result) || elapsed >= 2) break;
  } while (Date.now() - wallStart < 20000);
  return result || t.call('driveBy');
}
