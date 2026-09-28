// Venue witnesses: North Point Key's guests and doormen keep their own routines (they cower
// where they are), yet one of them now phones 911 about shots fired on CIRRUS's terrace (an
// off-stage call with bubbles) and the star comes when that call ends.
export const fresh = true;

export default async function (t) {
  await t.call('god', true);
  await t.call('arm', 0);
  await t.call('setClock', 21);
  await t.call('wanted', 0);
  await t.call('skylineVisit', 'bar');
  await t.wait(3);
  await t.call('holdSimulation', true);
  const before = (await t.call('witnesses')).stats;
  // Two shots out over the rail, away from the tables (a body is reported just the same).
  const me = (await t.call('skyline')).player;
  for (let i = 0; i < 2; i++) {
    await t.call('fireShot', me.x, me.y - 600);
    await t.wait(0.3);
  }
  let venueCall = null,
    starAt = null,
    w = null;
  for (let clock = 0; clock < 24 && starAt === null; clock += 0.5) {
    await t.wait(0.5);
    w = await t.call('witnesses');
    const c = w.calls.find((c) => c.about === 'player' && c.offstage && !c.hidden && !c.waiting && c.line);
    if (c) venueCall ??= c;
    if (w.stars >= 1) starAt = clock;
  }
  t.note('venue call ' + JSON.stringify(venueCall) + ' star at ' + starAt + ' stats ' + JSON.stringify(w.stats));
  t.assert(w.stats.venueCalls > before.venueCalls, 'no Key person took the phone: ' + JSON.stringify(w.stats));
  t.assert(venueCall, 'no venue call with a bubble: ' + JSON.stringify(w.calls));
  t.assert(!/,\./.test(venueCall.line), 'call line lost its street badly: ' + venueCall.line);
  t.assert(starAt !== null, 'the venue call never brought a star: ' + JSON.stringify(w));
  t.assert(w.stats.heardByPolice === before.heardByPolice && w.stats.seenByPolice === before.seenByPolice, 'the police heard it themselves (test proves nothing): ' + JSON.stringify(w.stats));
  await t.call('holdSimulation', false);
}
