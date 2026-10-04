// The search clock (citylife-civic.js SEARCH CLOCK): the countdown to losing the police waits while
// units are still on their way to a 911 call, creeps inside the search area and runs at full speed
// outside it; the HUD shows it only while it runs at full speed, and at zero the stars clear.
export const fresh = true;
export default async function (t) {
  const search = async () => (await t.call('policeReport')).search;
  await t.call('god', true);
  await t.call('setClock', 13);
  await t.call('teleport', 1152, 1300);
  await t.call('holdSimulation', true);
  // Nobody else round: no police, no traffic (a stray unit seeing the player would restart the clock).
  await t.call('witnessStage', 0, false, 1400, false, false, true);
  // A call about shots 300 units down the street; the first unit is a long way off (eta 300 s).
  await t.call('reportCall', 1152, 1600, 'gunfire', 300);
  await t.wait(2);
  let s = await search();
  t.note('holding: ' + JSON.stringify(s));
  t.assert(s.clock === 'holding' && !s.shown, 'units on their way: the clock should wait, hidden: ' + JSON.stringify(s));
  t.assert(s.remaining === 5, 'one star should give 5 s and not count while holding: ' + JSON.stringify(s));
  // A unit reaches the scene (350 units past it, facing away): the search starts, the player is inside its area.
  const unit = await t.call('respondingUnit', 1152, 1950, Math.PI / 2, 0);
  t.assert(unit, 'no room for the cruiser');
  await t.wait(1);
  s = await search();
  const zoneStart = s.remaining;
  await t.wait(2);
  s = await search();
  t.note('zone: ' + zoneStart + ' → ' + JSON.stringify(s));
  t.assert(s.clock === 'zone' && !s.shown, 'inside the search area the clock should be hidden: ' + JSON.stringify(s));
  t.assert(zoneStart - s.remaining > 0.3 && zoneStart - s.remaining < 0.8, 'inside the search area the clock should creep (about 0.5 s in 2 s): ' + zoneStart + ' → ' + s.remaining);
  // Out of the area, far from the unit: the countdown runs at full speed and is on screen.
  await t.call('teleport', 1152, 600);
  await t.wait(1);
  s = await search();
  const runStart = s.remaining;
  t.assert(s.clock === 'running' && s.shown, 'out of the area the clock should run, shown: ' + JSON.stringify(s));
  await t.wait(1.5);
  s = await search();
  t.note('running: ' + runStart + ' → ' + JSON.stringify(s));
  t.assert(Math.abs(runStart - s.remaining - 1.5) < 0.25, 'the countdown should run at one second a second: ' + runStart + ' → ' + s.remaining);
  await t.wait(s.remaining + 0.5);
  const r = await t.call('policeReport');
  t.note('after: stars ' + r.stars + ' ' + JSON.stringify(r.search));
  t.assert(r.stars === 0 && !r.search.shown && r.search.clock === 'off', 'at zero the police should be lost and the clock gone: ' + JSON.stringify(r.search));
  await t.call('holdSimulation', false);
  await t.call('god', false);
}
