// The Meridian Star's grand tour (marina-voyage.js): the route check is clean (no land, bridge,
// jetty or ship, the world edge kept at a distance), a lap takes 15-21 minutes and a full lap
// with advanceLiner passes every named stretch of water in order and comes back to her anchorage;
// speeds stay within her limits; the ride skip carries a passenger on to her next anchorage.
export const fresh = true;

const WATERS = ['HARBOR POINT', 'SUNSET PIER', 'MONARCH ISLE', 'OCEAN DRIVE', 'PALM KEYS BEACH', 'OPEN SEA'];

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    const check = await t.call('linerVoyageCheck');
    t.assert(check.problems.length === 0, `route check: ${JSON.stringify(check.problems.slice(0, 6))}`);
    t.assert(check.edgeMargin >= 200, `hull keeps 200 units inside the world-edge line: ${check.edgeMargin}`);
    t.assert(check.lapMinutes >= 15 && check.lapMinutes <= 21, `a lap of 15-21 minutes: ${check.lapMinutes}`);
    for (const name of [...WATERS, 'NORTH SOUND ANCHORAGE', 'PALM KEYS ANCHORAGE'])
      t.assert(check.passages.includes(name), `the tour passes ${name}: ${check.passages.join(' > ')}`);
    t.note(`lap ${check.lapMinutes} min, ${check.legs.map((l) => l.kind + (l.topKnots ? ' ' + l.topKnots + 'kn' : '')).join(', ')}`);

    // A full lap, half a minute at a time: every stretch of water, back to the anchorage.
    let ship = await t.call('liners');
    const start = ship.leg,
      seen = [],
      lap = check.lapSeconds;
    let top = 0,
      soundTop = 0,
      calls = new Set();
    for (let done = 0; done < lap + 120; done += 15) {
      ship = await t.call('advanceLiner', 15);
      if (ship.area && seen.at(-1) !== ship.area) seen.push(ship.area);
      if (ship.call) calls.add(ship.call);
      top = Math.max(top, ship.knots);
      if (ship.area === 'HARBOR POINT') soundTop = Math.max(soundTop, ship.knots);
      t.assert(Number.isFinite(ship.x) && Number.isFinite(ship.y), `a finite position: ${JSON.stringify(ship)}`);
    }
    for (const name of WATERS) t.assert(seen.includes(name), `the lap passed ${name}: ${seen.join(' > ')}`);
    t.assert(calls.has('NORTH SOUND ANCHORAGE') && calls.has('PALM KEYS ANCHORAGE'), `called at both anchorages: ${[...calls]}`);
    t.assert(top <= 21.5 && top >= 18, `top speed at sea 18-21 kn: ${top}`);
    t.assert(soundTop <= 12.5, `slow in North Sound and its approach: ${soundTop} kn`);
    t.note(`lap order: ${seen.join(' > ')}; top ${top} kn, ${soundTop} kn in the sound; started on leg ${start}`);

    // The ride skip: aboard her under way, the skip takes her on to her next anchorage with the passenger in place.
    for (let i = 0; i < 40 && !(ship.kind === 'ahead' && ship.knots > 10); i++) ship = await t.call('advanceLiner', 15);
    await t.call('deckJump', 'meridian', 4, -620, 0);
    await t.wait(2);
    let d = await t.call('deckLanding');
    t.assert(d.aboard && d.aboard.ship === 'MS MERIDIAN STAR', `aboard for the skip: ${JSON.stringify(d)}`);
    const spot = d.aboard,
      offer = (await t.call('rideSkip')).offer;
    t.assert(offer && offer.kind === 'liner' && offer.allowed, `the skip is offered: ${JSON.stringify(offer)}`);
    await t.call('skipRide');
    await t.wait(3);
    ship = await t.call('liners');
    d = await t.call('deckLanding');
    t.assert(ship.kind === 'call' && ship.call === offer.destination, `at her next anchorage: ${JSON.stringify(ship)} (offered ${offer.destination})`);
    t.assert(d.aboard && Math.abs(d.aboard.u - spot.u) <= 2 && Math.abs(d.aboard.v - spot.v) <= 2, `still in place on deck: ${JSON.stringify(d.aboard)}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
