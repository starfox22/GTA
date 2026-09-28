// Drive-by arcs (driveby.js): a sedan fires all round (the windscreen ahead, the side
// windows, the rear screen behind; the first shot through a screen bursts it); a box truck
// has 270 deg and a pull toward the 90 deg straight back fires nothing and shows the cross;
// every vehicle class has sensible arcs.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  await t.call('teleport', 1000, 1000);
  await t.call('drive', 'sedan', 0, 0);
  const check = (deg) => t.call('driveByCheck', deg);
  // 360 deg for a sedan: every 5 deg fires, through the right opening.
  const expect = (deg) => (Math.abs(deg) < 35 ? 'front' : Math.abs(deg) > 145 ? 'rear' : deg < 0 ? 'left' : 'right');
  for (let deg = -180; deg < 180; deg += 5) {
    const c = await check(deg);
    t.assert(c.ok && c.relDeg === deg, `sedan cannot fire at ${deg} deg: ` + JSON.stringify(c));
    if (Math.abs(Math.abs(deg) - 35) > 1 && Math.abs(Math.abs(deg) - 145) > 1)
      t.assert(c.window === expect(deg), `sedan at ${deg} deg through ${c.window}, not ${expect(deg)}`);
  }

  // Out of the driver's window: the window goes down, the arm comes out, then the shot.
  await t.call('driveByAim', -90, true);
  await t.wait(0.1);
  let r = await t.call('driveBy');
  t.assert(r.stats.shots === 0 && r.out > 0 && r.out < 1, 'fired before the arm was out: ' + JSON.stringify(r));
  await t.wait(0.8);
  r = await t.call('driveBy');
  t.assert(r.stats.shots >= 1 && r.window === 'left' && r.windowsDown?.left, 'no shot out of the left window: ' + JSON.stringify(r));
  t.assert(r.rearGlass === 0 && r.frontGlass === 0, 'a screen broken by a side shot');

  // Straight back: the arm goes in, turns round, and the first shot bursts the rear screen.
  let shots = r.stats.shots;
  await t.call('driveByAim', 180, true);
  await t.wait(1.2);
  r = await t.call('driveBy');
  t.assert(r.window === 'rear' && r.stats.shots > shots, 'no shot back: ' + JSON.stringify(r));
  t.assert(r.rearGlass === 2 && r.stats.rearScreens === 1, 'rear screen not burst: ' + JSON.stringify(r));

  // Straight ahead: through the windscreen, which bursts.
  shots = r.stats.shots;
  await t.call('driveByAim', 0, true);
  await t.wait(1.2);
  r = await t.call('driveBy');
  t.assert(r.window === 'front' && r.stats.shots > shots, 'no shot ahead: ' + JSON.stringify(r));
  t.assert(r.frontGlass === 2 && r.stats.windscreens === 1, 'windscreen not burst: ' + JSON.stringify(r));
  t.assert(r.stats.refused === 0, 'a sedan refused an aim: ' + JSON.stringify(r));
  await t.call('driveByAim', null);

  // A repair puts the glass back and winds the windows up.
  await t.call('repair');
  r = await t.call('driveBy');
  t.assert(r.rearGlass === 0 && r.frontGlass === 0 && !r.windowsDown, 'repair left the glass broken: ' + JSON.stringify(r));

  // A box truck: the cargo box is behind the cab, 90 deg straight back are blocked.
  await t.call('teleport', 1000, 1000);
  await t.call('drive', 'truck', 0, 0);
  for (const deg of [180, 140, -140, 170, -170]) {
    const c = await check(deg);
    t.assert(c.blocked && /straight back/.test(c.why), `box truck at ${deg} deg not refused: ` + JSON.stringify(c));
  }
  for (const deg of [0, 30, -30, 90, -90, 130, -130]) {
    const c = await check(deg);
    t.assert(c.ok && c.relDeg === deg, `box truck cannot fire at ${deg} deg: ` + JSON.stringify(c));
  }
  r = await t.call('driveBy');
  shots = r.stats.shots;
  const refused = r.stats.refused;
  await t.call('driveByAim', 180, true);
  await t.wait(0.6);
  r = await t.call('driveBy');
  t.assert(r.stats.shots === shots && r.aim === 'blocked' && r.stats.refused > refused, 'box truck fired straight back: ' + JSON.stringify(r));
  t.assert(r.cross && Math.abs(r.crossDeg) === 180 && r.out === 0, 'no cross (or an arm out) for the blocked shot: ' + JSON.stringify(r));
  await t.call('driveByAim', null);
  await t.wait(0.6);
  r = await t.call('driveBy');
  t.assert(!r.cross, 'the cross stayed: ' + JSON.stringify(r));
  await t.call('driveByAim', -90, true);
  await t.wait(1);
  r = await t.call('driveBy');
  t.assert(r.stats.shots > shots && r.window === 'left', 'box truck side window: ' + JSON.stringify(r));
  await t.call('driveByAim', null);

  // Every class: cars all round; bodies with nothing to see through behind the seats 270
  // deg (blocked 135..225); riders all but the right rear quarter; boats all round;
  // aircraft the side windows; tanks their own gun.
  const span = (a) => a.arcs.reduce((s, x) => s + (x.to - x.from), 0);
  for (const type of ['sedan', 'coupe', 'suv', 'pickup', 'taxi', 'rally', 'roadster', 'limousine', 'muscle', 'dbs', 'hilux', 'bronco']) {
    const a = await t.call('driveByArcs', type);
    t.assert(span(a) === 360 && a.arcs.some((x) => x.window === 'rear') && a.arcs.some((x) => x.window === 'front'), type + ' not all round: ' + JSON.stringify(a));
  }
  for (const type of ['truck', 'van', 'bus', 'ambulance', 'flatbed', 'police', 'supercar', 'brutini', 'lafera', 'sixbysix']) {
    const a = await t.call('driveByArcs', type);
    t.assert(span(a) === 270 && !a.arcs.some((x) => x.window === 'rear') && a.arcs.some((x) => x.window === 'front'), type + ' not 270 deg: ' + JSON.stringify(a));
  }
  for (const type of ['bike', 'bicycle', 'cruiser', 'dolcati', 'yamasaki', 'jetski']) {
    const a = await t.call('driveByArcs', type);
    t.assert(a.arcs.length === 1 && a.arcs[0].from === -180 && a.arcs[0].to === 90, type + ' rider arc: ' + JSON.stringify(a));
  }
  for (const type of ['speedboat', 'workboat']) {
    const a = await t.call('driveByArcs', type);
    t.assert(span(a) === 360, type + ' not all round: ' + JSON.stringify(a));
  }
  for (const type of ['plane', 'helicopter']) {
    const a = await t.call('driveByArcs', type);
    t.assert(span(a) === 240 && !a.arcs.some((x) => x.window === 'front' || x.window === 'rear'), type + ' cockpit arcs: ' + JSON.stringify(a));
  }
  const tank = await t.call('driveByArcs', 'tank');
  t.assert(tank.profile === null && !tank.arcs.length, 'tank has a drive-by: ' + JSON.stringify(tank));
  await t.call('holdSimulation', false);
}
