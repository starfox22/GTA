// Drive-by arcs (driveby.js): a sedan fires out of the driver's window, across the cabin
// and, turned round, back through the rear screen (the first shot bursts it); nothing goes
// forward through the windscreen; a box truck cannot shoot straight back; an aim just past
// an arc's edge fires along the edge, further out the gun holds fire.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  await t.call('teleport', 1000, 1000);
  await t.call('drive', 'sedan', 0, 0);
  const check = (deg) => t.call('driveByCheck', deg);
  let c = await check(-90);
  t.assert(c.ok && !c.clamped && c.window === 'left', 'sedan left window: ' + JSON.stringify(c));
  c = await check(90);
  t.assert(c.ok && c.window === 'right', 'sedan across to the passenger window: ' + JSON.stringify(c));
  c = await check(180);
  t.assert(c.ok && c.window === 'rear', 'sedan straight back: ' + JSON.stringify(c));
  c = await check(0);
  t.assert(c.blocked && /windscreen/.test(c.why), 'sedan straight ahead not refused: ' + JSON.stringify(c));
  c = await check(-12);
  t.assert(c.ok && c.clamped && c.relDeg === -25, 'aim near the windscreen pillar not clamped: ' + JSON.stringify(c));
  c = await check(140);
  t.assert(c.ok && c.clamped, 'aim between the passenger window and the rear screen not clamped: ' + JSON.stringify(c));

  // Out of the driver's window: the window goes down, the arm comes out, then the shot.
  await t.call('driveByAim', -90, true);
  await t.wait(0.1);
  let r = await t.call('driveBy');
  t.assert(r.stats.shots === 0 && r.out > 0 && r.out < 1, 'fired before the arm was out: ' + JSON.stringify(r));
  await t.wait(0.8);
  r = await t.call('driveBy');
  t.assert(r.stats.shots >= 1 && r.window === 'left' && r.windowsDown?.left, 'no shot out of the left window: ' + JSON.stringify(r));
  t.assert(r.rearGlass === 0, 'rear screen broken by a side shot');

  // Straight back: the arm goes in, turns round, and the first shot bursts the rear screen.
  let shots = r.stats.shots;
  await t.call('driveByAim', 180, true);
  await t.wait(1.2);
  r = await t.call('driveBy');
  t.assert(r.window === 'rear' && r.stats.shots > shots, 'no shot back: ' + JSON.stringify(r));
  t.assert(r.rearGlass === 2 && r.stats.rearScreens === 1, 'rear screen not burst: ' + JSON.stringify(r));

  // Straight ahead: held, the reticle dims.
  shots = r.stats.shots;
  await t.call('driveByAim', 0, true);
  await t.wait(0.8);
  r = await t.call('driveBy');
  t.assert(r.stats.shots === shots && r.aim === 'blocked' && r.stats.refused > 0, 'fired through the windscreen: ' + JSON.stringify(r));

  // Just off the pillar: fires along the edge of the window's arc.
  await t.call('driveByAim', -12, true);
  await t.wait(1);
  r = await t.call('driveBy');
  t.assert(r.stats.shots > shots && r.stats.clamped > 0 && r.relDeg === -25, 'clamped shot: ' + JSON.stringify(r));
  await t.call('driveByAim', null);

  // A box truck: the cargo box is behind the cab.
  await t.call('teleport', 1000, 1000);
  await t.call('drive', 'truck', 0, 0);
  c = await check(180);
  t.assert(c.blocked && /straight back/.test(c.why), 'box truck straight back not refused: ' + JSON.stringify(c));
  r = await t.call('driveBy');
  shots = r.stats.shots;
  await t.call('driveByAim', 180, true);
  await t.wait(1);
  r = await t.call('driveBy');
  t.assert(r.stats.shots === shots && r.aim === 'blocked', 'box truck fired straight back: ' + JSON.stringify(r));
  await t.call('driveByAim', -90, true);
  await t.wait(1);
  r = await t.call('driveBy');
  t.assert(r.stats.shots > shots && r.window === 'left', 'box truck side window: ' + JSON.stringify(r));
  await t.call('driveByAim', null);

  // Rear screens by body.
  for (const type of ['van', 'bus', 'ambulance', 'flatbed', 'police', 'supercar']) {
    const a = await t.call('driveByArcs', type);
    t.assert(!a.arcs.some((x) => x.window === 'rear'), type + ' shoots straight back: ' + JSON.stringify(a));
  }
  for (const type of ['coupe', 'suv', 'pickup', 'taxi', 'rally', 'roadster']) {
    const a = await t.call('driveByArcs', type);
    t.assert(a.arcs.some((x) => x.window === 'rear'), type + ' cannot shoot back: ' + JSON.stringify(a));
  }
  // A rider shoots left-handed: ahead yes, straight back through themselves no.
  const bike = await t.call('driveByArcs', 'bike');
  t.assert(bike.arcs.length === 1 && bike.arcs[0].from <= -165 && bike.arcs[0].to >= 45 && bike.arcs[0].to < 90, 'bike arc: ' + JSON.stringify(bike));
  await t.call('holdSimulation', false);
}
