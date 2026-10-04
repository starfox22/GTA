// Parachute landings on ships (deck-landing.js): a canopy onto the Meridian Star under way at sea
// (she carries the jumper 20 s), her stairs aft and the way off; freefall onto the moored liner is an
// impact on her deck, not a splash; a canopy onto the superyacht's decks; a canopy onto a boat puts
// the jumper in the water beside her, and E climbs aboard.
export const fresh = true;

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // 1. The Meridian Star at sea, at speed.
    let ship = await t.call('liners');
    for (let i = 0; i < 24 && !(ship.kind === 'ahead' && ship.knots >= 15); i++) ship = await t.call('advanceLiner', 30);
    t.assert(ship.kind === 'ahead' && ship.knots >= 15, `liner under way at sea: ${JSON.stringify(ship)}`);
    // Over her lido, flying her way: she outruns a trimmed canopy a little, so her deck slides on under the jumper.
    let d = await t.call('deckJump', 'meridian', 12, -100, 30);
    t.assert(d.under && d.under.ship === 'MS MERIDIAN STAR', `over the liner: ${JSON.stringify(d.under)}`);
    let s = await t.call('parachuteState');
    t.assert(s && s.aglM < 13 && s.aglM > 11, `the jump counts its height above her deck, not the sea: ${JSON.stringify(s)}`);
    await t.wait(5);
    d = await t.call('deckLanding');
    t.assert(d.aboard && d.aboard.ship === 'MS MERIDIAN STAR', `landed aboard the liner: ${JSON.stringify(d)}`);
    t.assert(d.last && d.last.outcome === 'safe' && d.last.shipKnots >= 15, `a safe landing on her moving deck: ${JSON.stringify(d.last)}`);
    t.assert(!d.swimming && !d.parachute, `standing on deck, not in the sea: ${JSON.stringify(d)}`);
    let f = await t.call('fallState');
    t.assert(f.mode === 'play' && f.hp === 100, `unhurt: ${f.mode} hp ${f.hp}`);
    t.note(`landed on her ${d.last.deck} at ${d.last.shipKnots} kn, ${d.last.acrossMs} m/s across the deck`);
    // Carried for 20 s: the same spot on her deck, a long way across the map.
    const from = await t.call('status'),
      spot = d.aboard;
    await t.wait(20);
    d = await t.call('deckLanding');
    const to = await t.call('status'),
      moved = Math.hypot(to.x - from.x, to.y - from.y);
    t.assert(d.aboard && Math.abs(d.aboard.u - spot.u) <= 2 && Math.abs(d.aboard.v - spot.v) <= 2, `kept her place on deck: ${JSON.stringify(spot)} -> ${JSON.stringify(d.aboard)}`);
    t.assert(moved > 150, `carried with her: moved ${Math.round(moved)} units in 20 s`);
    t.assert(Math.abs(d.aboard.heightM - spot.heightM) < 0.2, `still at deck height: ${JSON.stringify(d.aboard)}`);

    // 2. Her stairs lead aft to the stern platform, the way off.
    if (d.aboard.level > 0 || d.aboard.u > -584) {
      await t.call('interact');
      d = await t.call('deckLanding');
      t.assert(d.aboard && d.aboard.level === 0 && d.aboard.u < -584, `the stairs aft: ${JSON.stringify(d.aboard)}`);
    }
    await t.call('interact');
    d = await t.call('deckLanding');
    t.assert(!d.aboard, `went ashore by the stern platform: ${JSON.stringify(d)}`);

    // 3. Freefall onto the moored Coral Dawn: as hard as the ground, on her deck.
    d = await t.call('deckJump', 'coraldawn', 60, -622, 0, false);
    await t.wait(4);
    f = await t.call('fallState');
    const hit = f.impacts[f.impacts.length - 1];
    t.assert(f.mode === 'dead' && hit && hit.cause === 'freefall' && hit.roof && !hit.water, `freefall onto her deck: ${f.mode} ${JSON.stringify(hit)}`);
    t.assert(f.splat && !f.splat.water && Math.abs(f.splat.z - 44) < 1, `the body lies on her deck: ${JSON.stringify(f.splat)}`);

    // 4. The superyacht: a canopy over her sun deck lands on one of her decks.
    d = await t.call('deckJump', 'aurelia', 6, -90, 0);
    t.assert(d.under && d.under.ship === 'M/Y AURELIA', `over the yacht: ${JSON.stringify(d.under)}`);
    await t.wait(4);
    d = await t.call('deckLanding');
    t.assert(d.aboard && d.aboard.ship === 'M/Y AURELIA' && d.last.outcome === 'safe', `landed aboard the yacht: ${JSON.stringify(d)}`);
    const yacht = await t.call('yacht');
    t.assert(yacht && yacht.deck && Math.abs(yacht.elevation - d.aboard.heightM * 8) < 2, `on a deck of hers: ${JSON.stringify(yacht)}`);
    t.note(`yacht: down on the ${yacht.deck}`);

    // 5. A boat has no deck to walk: down in the water beside her, then aboard with E.
    await t.call('teleport', 60, -2000);
    await t.call('drive', 'speedboat', 0, 0);
    const boat = await t.call('status');
    t.assert(boat.vehicle === 'speedboat', `a speedboat to land on: ${JSON.stringify(boat)}`);
    d = await t.call('canopyOver', boat.x - 22, boat.y, 2, 0);
    await t.wait(3);
    d = await t.call('deckLanding');
    t.assert(d.last && d.last.boat === 'speedboat' && d.swimming && !d.parachute, `in the water beside the boat: ${JSON.stringify(d)}`);
    await t.call('interact');
    const aboard = await t.call('status');
    t.assert(aboard.vehicle === 'speedboat', `climbed aboard with E: ${JSON.stringify(aboard)}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
