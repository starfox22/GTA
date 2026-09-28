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
  let r = await t.call('driveBy');
  t.assert(r.rearGlass === 0 && r.frontGlass === 0, 'glass not whole at the start: ' + JSON.stringify(r));

  // Behind: the pointer 12 m back, then the forward key and the fire key held.
  let p = await t.call('driveByScreenPoint', 180, 12);
  await t.mouse(p.x, p.y);
  await t.keys(['KeyW', 'KeyF'], 2.5, { real: true });
  r = await t.call('driveBy');
  t.assert(r.stats.shots > 0, 'no shot behind: ' + JSON.stringify(r));
  t.assert(r.window === 'rear' && Math.abs(r.relDeg) > 145, 'the shot behind left another way: ' + JSON.stringify(r));
  t.assert(r.rearGlass === 2 && r.stats.rearScreens === 1, 'rear screen not burst: ' + JSON.stringify(r));
  t.assert(r.frontGlass === 0, 'windscreen broken by a shot behind: ' + JSON.stringify(r));
  const back = r.stats.shots;

  // Ahead: the button held while steering (fresh key presses), through the windscreen,
  // which bursts on the first shot.
  p = await t.call('driveByScreenPoint', 0, 14);
  await t.mouse(p.x, p.y, { seconds: 2.5, down: true, keys: ['KeyW'], taps: ['KeyA'] });
  r = await t.call('driveBy');
  t.assert(r.stats.shots > back && r.window === 'front', 'no shot ahead: ' + JSON.stringify(r));
  t.assert(r.frontGlass === 2 && r.stats.windscreens === 1, 'windscreen not burst: ' + JSON.stringify(r));
  t.assert(r.stats.refused === 0 && !r.cross, 'a car refused an aim: ' + JSON.stringify(r));

  // A box truck: the pointer straight behind and the fire key give no shot, only the cross.
  await t.call('teleport', 1000, 1000);
  await t.call('drive', 'truck', 0, 0);
  const before = (await t.call('driveBy')).stats;
  p = await t.call('driveByScreenPoint', 180, 14);
  await t.mouse(p.x, p.y);
  await t.keys('KeyF', 1, { real: true });
  r = await t.call('driveBy');
  t.assert(r.stats.shots === before.shots && r.stats.refused > before.refused, 'the truck fired straight back: ' + JSON.stringify(r));
  t.assert(Math.abs(r.crossDeg) > 160 && r.out === 0, 'no cross behind the truck (or an arm out): ' + JSON.stringify(r));
  // Out of the side: fires.
  p = await t.call('driveByScreenPoint', -90, 14);
  await t.mouse(p.x, p.y, { seconds: 2.5, down: true });
  r = await t.call('driveBy');
  t.assert(r.stats.shots > before.shots && r.window === 'left', 'the truck did not fire out of its window: ' + JSON.stringify(r));
}
