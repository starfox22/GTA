// Starting a cab ride (taxi.js startTaxiRide) never throws and names the fare: taxi.js and livingcity-medics.js once both
// declared routeLength, the later one won for both, and every ride start threw 'route is not iterable' before its FARE toast.
export default async function (t) {
  await t.call('god', true);
  for (const [x, y] of [
    [1500, 800],
    [3200, 2600],
  ]) {
    await t.call('teleport', 748, 584);
    const r = await t.call('cab', x, y); // a throw fails the test
    t.assert(r.riding && r.fare > 0 && r.stops >= 2, `cab to ${x},${y} did not start: ` + JSON.stringify(r));
    const notes = await t.call('notices');
    const fare = notes.find((n) => /^FARE \$\d+ · \d+ m/.test(n.text));
    t.assert(fare, `no FARE toast for the ride to ${x},${y}: ` + JSON.stringify(notes.map((n) => n.text)));
    // Get out again (the action key, as the toast says) before the next ride.
    await t.call('interact');
    await t.wait(1);
    t.assert(!(await t.call('rideSkip')).offer, 'the ride never ended after getting out');
  }
  // The medics' route length is its own function now: an ambulance still finds its way to someone down.
  const m = await t.call('medicReport');
  t.assert(m, 'medicReport');
}
