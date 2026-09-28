// The Blue Hour's street entrance (roofmission-entrance.js): two limousines parked at the kerb
// west of the door (clear of mission 2's ambulance stop at x -1618), two doormen and a valet
// on post, and the walk along the pavement past the door left open.
export const fresh = true;
export default async function (t) {
  const e = await t.call('blueHourEntrance');
  t.assert(e.limos.length === 2, 'limousines: ' + JSON.stringify(e.limos));
  for (const c of e.limos) {
    t.assert(c.y > 2636 && c.y < 2654 && Math.abs(Math.abs(c.heading) - Math.PI) < 0.05, 'a limousine off its kerb bay: ' + JSON.stringify(c));
    t.assert(c.x + 36 < -1645, 'a limousine in the ambulance stop: ' + JSON.stringify(c));
  }
  t.assert(e.staff.filter((s) => s.role === 'doorman').length === 2 && e.staff.some((s) => s.role === 'valet'), 'staff: ' + JSON.stringify(e.staff));
  t.assert(!e.walkBlocked, 'the pavement past the door is blocked');
  t.assert(e.props.length === 0 && e.busStops === 0, 'street furniture on the forecourt: ' + JSON.stringify({ props: e.props, busStops: e.busStops }));
}
