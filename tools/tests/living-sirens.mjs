// Traffic makes way for a siren (livingcity-sirens.js): a sedan with an ambulance on a run coming
// up behind it slows, crawls over to the kerb and lets it by; the ambulance keeps its pace down
// the centre line; the sedan then pulls back into its lane and drives on.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  await t.call('setClock', 14);
  await t.call('teleport', 1219, 1300);
  await t.wait(1);
  await t.call('holdSimulation', true);
  // Nobody else on the street: no traffic, no police, no crowd within 1,600 units.
  await t.call('witnessStage', 0, false, 1600, false, false, true);
  const start = await t.call('sirenPass', 260, 150);
  t.assert(start && start.car && start.ambulance, 'no room to stage the pass');
  let widest = start.car.lane,
    slowest = start.car.kmh,
    ambulanceSlowest = Infinity,
    passedAt = null,
    afterFastest = 0,
    afterLane = Infinity,
    after = null;
  for (let i = 0; i < 16; i++) {
    await t.wait(0.5);
    const s = await t.call('sirenPassState');
    if (!s.passed) {
      widest = Math.max(widest, s.car.lane);
      slowest = Math.min(slowest, s.car.kmh);
      ambulanceSlowest = Math.min(ambulanceSlowest, s.ambulance.kmh);
    } else {
      if (passedAt === null) passedAt = i * 0.5;
      afterFastest = Math.max(afterFastest, s.car.kmh);
      afterLane = Math.min(afterLane, Math.abs(s.car.lane - 25));
    }
    after = s;
  }
  t.note(`car: lane 25 → ${widest}, down to ${slowest} km/h; ambulance never under ${ambulanceSlowest} km/h, by after ${passedAt} s; then back within ${afterLane} of its lane line, up to ${afterFastest} km/h`);
  t.assert(after.car.yieldedAgo !== null, 'the car never gave way');
  t.assert(widest >= 30, `the car did not pull over (lane offset ${widest}, lane line 25)`);
  t.assert(slowest <= 12, `the car did not slow for the siren (${slowest} km/h)`);
  t.assert(passedAt !== null && passedAt <= 4, 'the ambulance did not get by: ' + JSON.stringify(after));
  t.assert(ambulanceSlowest >= 35, `the ambulance was held up (${ambulanceSlowest} km/h)`);
  // (It may then stop at the next red light.)
  t.assert(afterLane <= 3 && afterFastest >= 25, 'the car did not go back to its lane and drive on: ' + JSON.stringify(after.car));
  await t.call('holdSimulation', false);
  await t.call('god', false);
}
