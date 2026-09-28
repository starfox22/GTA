// Carjacks by the real action key (carjack-struggle.js): at a traffic car waiting at a
// light, at staged cars with parked cars close ahead and behind, a car in the next lane,
// boxed in on every side, and one still rolling. Every one runs the whole animation
// (approach > door > reach > tug > pull > enter), never the instant pop, and ends with
// the player at the wheel and the driver on foot outside it.
export const fresh = true;
const FULL = 'approach > door > reach > tug > pull > enter';
async function pressAndFinish(t, label, limit = 6.5) {
  await t.keys('KeyE', 0.1, { real: true });
  let s = await t.call('carjack');
  t.assert(s.running && s.phase === 'approach', label + ': the action key did not start the struggle: ' + JSON.stringify(s));
  let waited = 0;
  while (s.running && waited < limit) {
    await t.wait(0.1);
    waited += 0.1;
    s = await t.call('carjack');
  }
  t.assert(!s.running && s.inCar, label + ': not at the wheel after ' + waited.toFixed(1) + ' s: ' + JSON.stringify(s));
  t.assert(!s.instant && s.phases === FULL, label + ': not the whole animation: ' + JSON.stringify(s));
  t.assert(s.victim && s.victim.d > 4, label + ': the driver is not out on foot: ' + JSON.stringify(s.victim));
  const st = await t.call('status');
  t.assert(st.vehicle === s.inCar, label + ': status vehicle ' + st.vehicle);
  t.note(label + ': ' + waited.toFixed(1) + ' s to the seat' + (s.quick ? ' (short: ' + s.quick + ')' : ''));
  return s;
}
// Each staged car on the same open ground, clear of the last one taken.
async function stage(t, ...args) {
  await t.call('teleport', 1000, 1000);
  return t.call('carjackStage', ...args);
}
export default async function (t) {
  await t.call('god', true);
  // Real traffic: let it run, then take a car stopped at a red (or amber) light from the kerb.
  await t.call('teleport', 900, 600);
  let pick = null;
  for (let i = 0; i < 8 && !pick; i++) {
    await t.call('holdSimulation', false);
    await t.wait(4);
    await t.call('holdSimulation', true);
    const near = await t.call('carjackScan', 2600, 120, 'kerb');
    pick = near.find((c) => c.kmh === 0 && c.ai && !c.locked && !c.why && !c.quick && c.light && c.light !== 'green' && c.type !== 'bus');
  }
  t.assert(pick, 'no traffic car waiting at a light');
  await t.call('teleport', pick.passengerSide.x, pick.passengerSide.y);
  let s = await pressAndFinish(t, 'traffic at a light (' + pick.type + ', ' + pick.light + ')');
  t.assert(!s.quick, 'a car at a light got the short version: ' + s.quick);

  // Parked close ahead and behind at the kerb: squeezed round the end, the full struggle.
  let st = await stage(t, 'kerb', 'angry', 'passenger');
  t.assert(st.plan && !st.plan.why && !st.plan.quick && st.plan.waypoints >= 3, 'kerb: ' + JSON.stringify(st.plan));
  s = await pressAndFinish(t, 'between parked cars');
  t.assert(!s.quick && s.victim.down, 'kerb: an angry driver is thrown down: ' + JSON.stringify(s));

  // A car in the next lane beside the driver's door: squeezed in closer, still the full struggle.
  st = await stage(t, 'lane', 'flee', 'passenger');
  t.assert(st.plan && !st.plan.quick && st.plan.tight, 'lane: ' + JSON.stringify(st.plan));
  s = await pressAndFinish(t, 'next lane');
  t.assert(!s.quick, 'lane: short version');

  // Boxed in bumper to bumper and beside: no way round, so the short version, still animated.
  st = await stage(t, 'boxed', 'defiant', 'passenger');
  t.assert(st.plan && st.plan.quick === 'no room', 'boxed: ' + JSON.stringify(st.plan));
  s = await pressAndFinish(t, 'boxed in', 3);

  // Still rolling: grabbed as the driver brakes, the short version.
  st = await stage(t, 'open', 'flee', 'driver', 40);
  t.assert(st.plan && st.plan.quick === 'rolling', 'rolling: ' + JSON.stringify(st.plan));
  s = await pressAndFinish(t, 'rolling at 40 km/h', 3);
  const car = await t.call('drivingState');
  t.note('rolling: car ' + JSON.stringify(car).slice(0, 120));
  await t.call('holdSimulation', false);
}
