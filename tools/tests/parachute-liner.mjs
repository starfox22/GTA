// Parachute landings on ships (deck-landing.js): a canopy onto the Meridian Star under way at sea
// (she carries the jumper 20 s), her stairs aft and the way off; freefall onto the moored liner is an
// impact on her deck, not a splash; a canopy onto the superyacht's decks; a canopy onto a boat puts
// the jumper in the water beside her, and E climbs aboard.
export const fresh = true;

/* Fly the canopy as a player would onto her lido: aim where it will be when the canopy is
   down to it (her speed times the time left at the sink rate), turn toward it, pull the
   risers when it is running away, flare when it is close. Returns deckLanding() once down. */
async function steerOnto(t, seconds) {
  for (let flown = 0; flown < seconds; ) {
    const d = await t.call('deckLanding');
    if (!d.parachute) return d;
    const ship = await t.call('liners'),
      left = Math.max(0.5, (d.altitude - 152) / 28),
      a = (ship.heading * Math.PI) / 180,
      ahead = -140 + ship.speed * left,
      tx = ship.x + Math.cos(a) * ahead,
      ty = ship.y + Math.sin(a) * ahead,
      want = Math.atan2(ty - d.y, tx - d.x),
      err = Math.atan2(Math.sin(want - d.heading), Math.cos(want - d.heading)),
      need = Math.hypot(tx - d.x, ty - d.y) / left;
    let s = 0.4;
    if (Math.abs(err) > 0.08) {
      s = Math.min(0.4, Math.abs(err) / 1.15);
      await t.keys(err > 0 ? 'KeyD' : 'KeyA', s);
    } else if (need > 9.5 * 8) await t.keys('KeyW', s);
    else if (need < 5 * 8) await t.keys('KeyS', s);
    else await t.wait(s);
    flown += s;
  }
  return t.call('deckLanding');
}

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

    // 1b. Flown into her the wrong way (against her heading): the deck comes at the jumper at
    // canopy plus ship speed, more than a run-out takes, and the landing hurts.
    ship = await t.call('liners');
    await t.call('deckJump', 'meridian', 4, -60, 30, true, ((ship.heading + 180) * Math.PI) / 180);
    await t.wait(3);
    d = await t.call('deckLanding');
    const expected = 8.6 + ship.knots * 0.5144;
    t.assert(d.aboard && d.last && Math.abs(d.last.acrossMs - expected) < 1.5, `across the deck at canopy plus ship speed (${expected.toFixed(1)} m/s): ${JSON.stringify(d.last)}`);
    if (d.last.acrossMs > 12.5) t.assert(d.last.outcome === 'hurt', `a hard landing head-on at ${d.last.acrossMs} m/s: ${JSON.stringify(d.last)}`);
    t.note(`head-on: ${d.last.acrossMs} m/s across her deck at ${d.last.shipKnots} kn, ${d.last.outcome}`);

    // 2. Her stairs lead aft to the stern platform, the way off.
    if (d.aboard.level > 0 || d.aboard.u > -584) {
      await t.call('interact');
      d = await t.call('deckLanding');
      t.assert(d.aboard && d.aboard.level === 0 && d.aboard.u < -584, `the stairs aft: ${JSON.stringify(d.aboard)}`);
    }
    await t.call('interact');
    d = await t.call('deckLanding');
    t.assert(!d.aboard, `went ashore by the stern platform: ${JSON.stringify(d)}`);

    // 2b. Steered onto her from 70 m up, well ahead and off to one side, while she makes way.
    ship = await t.call('liners');
    for (let i = 0; i < 24 && !(ship.kind === 'ahead' && ship.knots >= 15); i++) ship = await t.call('advanceLiner', 15);
    const a = (ship.heading * Math.PI) / 180,
      sx = ship.x + Math.cos(a) * 1500 - Math.sin(a) * 400,
      sy = ship.y + Math.sin(a) * 1500 + Math.cos(a) * 400;
    await t.call('canopyOver', sx, sy, 70, Math.atan2(ship.y - sy, ship.x - sx));
    d = await steerOnto(t, 40);
    t.assert(d.aboard && d.aboard.ship === 'MS MERIDIAN STAR' && d.last.outcome !== 'dead', `steered onto her deck: ${JSON.stringify(d)}`);
    t.note(`steered down onto her ${d.last.deck} at ${d.last.shipKnots} kn, ${d.last.acrossMs} m/s across the deck`);

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
