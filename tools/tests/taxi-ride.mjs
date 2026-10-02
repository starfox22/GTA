// A hired cab: the ride starts without an exception and shows its FARE notice. (taxi.js measured the route
// with `routeLength`, which livingcity-medics.js also declared; the later declaration won and threw
// "route is not iterable" from startTaxiRide.) Then the cab's drop-off ends the ride.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('teleport', 748, 584);
    await t.call('wanted', 0);
    const r = await t.call('cab', 1200, 900);
    t.assert(r.riding === true && r.fare > 0 && r.stops >= 2, 'the cab ride did not start: ' + JSON.stringify(r));
    const notices = await t.call('notices');
    t.assert(
      notices.some((n) => /^FARE \$\d+ · \d+ m/.test(n.text)),
      'no FARE notice: ' + JSON.stringify(notices.map((n) => n.text)),
    );
    // The ride skip is offered while the cab is under way (ride-skip.js), and the ride ends at the drop-off
    // (the cab is driven along its route: a few simulated minutes at most).
    const offer = (await t.call('rideSkip')).offer;
    t.assert(offer && offer.kind === 'taxi', 'no taxi ride offer: ' + JSON.stringify(offer));
    let left = 12;
    while (left-- > 0 && (await t.call('rideSkip')).offer) await t.wait(20);
    const s = await t.call('status');
    t.assert(s.mode === 'play', 'not in play after the ride: ' + JSON.stringify(s));
    t.assert(!(await t.call('rideSkip')).offer, 'the cab ride never ended');
  } finally {
    await t.call('holdSimulation', false);
  }
}
