// A respray loses the police (garages.js THE POLICE RULE): driven in with the units watching, the
// stars stay and the player is told at once; driven in out of their sight, the stars go to 0, every
// unit drops the chase, the paint changes and nobody picks the car up again on the way out.
export const fresh = true;
export default async function (t) {
  const g = await t.call('garage');
  const byId = Object.fromEntries(g.garages.map((s) => [s.id, s]));
  const near = byId.eastside;
  await t.call('holdSimulation', true);
  await t.call('god', true);
  await t.call('setCash', 5000);
  await t.call('teleport', near.apron.x - 40, near.apron.y + 30);
  await t.call('drive', 'sedan', 0, -Math.PI / 2);
  await t.call('wanted', 2);
  // The chase: units arrive and get eyes on the car.
  let p = null;
  for (let k = 0; k < 10; k++) {
    await t.wait(2);
    p = await t.call('policeReport');
    if (p.seen && p.counts.patrol > 0) break;
  }
  t.note(`chase: ${p.stars} stars, ${p.counts.patrol} patrols, ${p.counts.officers} officers, seen ${p.seen}`);
  t.assert(p.stars >= 2 && p.seen, 'no chase under way: ' + JSON.stringify({ stars: p.stars, seen: p.seen, counts: p.counts }));

  // Seen going in: the stars stay, and the player hears it while the car rolls in.
  await t.call('placeVehicle', near.door.x0 + 24, near.apron.y + 10, -Math.PI / 2);
  let r = await t.call('garage');
  const watching = (await t.call('policeReport')).seen;
  t.note('prompt: ' + r.vehicle?.prompt);
  if (watching) t.assert(/COPS WATCHING/.test(r.vehicle?.prompt || ''), 'the prompt does not warn that the cops are watching: ' + r.vehicle?.prompt);
  await t.call('interact');
  await t.wait(1.5);
  r = await t.call('garage');
  t.assert(r.job, 'no garage job started');
  if (r.job.seen) {
    const n = await t.call('notices');
    t.assert(JSON.stringify(n).includes('COPS SAW YOU GO IN'), 'seen going in but not told: ' + JSON.stringify(n).slice(0, 300));
  }
  await t.wait(15);
  r = await t.call('garage');
  t.note('seen job: ' + JSON.stringify(r.last));
  t.assert(!r.job && r.last, 'the watched job did not finish');
  if (r.last.seenEntering) t.assert(r.last.starsAfter > 0 && !r.last.cleared, 'seen going in, yet the stars cleared');

  // Out of their sight: across town, far beyond any unit's sight. Units dispatched round a wanted player can
  // still drive by and watch it go in (then the stars rightly stay): try the next shop.
  let colour = null;
  for (const id of ['south', 'palm', 'oceanview', 'monarch']) {
    const shop = byId[id];
    await t.call('wanted', 2);
    await t.call('placeVehicle', shop.door.x0 + 24, shop.apron.y + 10, -Math.PI / 2);
    await t.wait(1);
    p = await t.call('policeReport');
    t.assert(p.stars >= 2, 'the chase ended before the shop: ' + p.stars);
    if (p.seen) {
      t.note(id + ': watched before the order');
      continue;
    }
    r = await t.call('garage');
    colour = r.vehicle.color;
    await t.call('interact');
    await t.wait(16);
    r = await t.call('garage');
    t.note(id + ' job: ' + JSON.stringify(r.last));
    t.assert(!r.job && r.last && r.last.shop === id, 'no service at ' + id + ': ' + JSON.stringify(r.last));
    // Nobody saw the car for the whole job and the search ran out before the paint went on: nothing left to clear.
    if (!r.last.seenEntering && !r.last.cleared && r.last.starsAfter === 0) {
      t.note(id + ': the chase lapsed before the paint');
      continue;
    }
    if (r.last.seenEntering) {
      t.assert(r.last.starsAfter > 0 && !r.last.cleared, 'seen going in, yet the stars cleared');
      continue;
    }
    break;
  }
  t.assert(r.last && !r.last.seenEntering && r.last.cleared, 'no unseen respray cleared the stars: ' + JSON.stringify(r.last));
  t.assert(r.vehicle.color !== colour, 'same colour after the respray');
  p = await t.call('policeReport');
  t.assert(p.stars === 0, 'stars after an unseen respray: ' + p.stars);
  t.assert(p.units.length === 0, 'units still chasing: ' + JSON.stringify(p.units.map((u) => [u.kind, u.mode])));
  // Out of the shop at a crawl and stopped at the kerb (rolling on blind across the pavement and into the street can
  // hit someone, or roll over someone traffic knocked down: a fresh crime and a fair new chase, which is not what
  // this checks): nobody picks the car up again for 20 s.
  await t.keys('KeyW', 0.6);
  await t.keys('KeyS', 0.6);
  for (let k = 0; k < 4; k++) {
    await t.wait(5);
    p = await t.call('policeReport');
    if (p.stars) t.note('re-detected: crimes ' + JSON.stringify(p.crimes) + ' witnesses ' + JSON.stringify(await t.call('witnesses')).slice(0, 600));
    t.assert(p.stars === 0 && p.search.clock === 'off', `re-detected ${5 * (k + 1) + 2} s after the respray: ${p.stars} stars, ${JSON.stringify(p.search)}, crimes ${JSON.stringify(p.crimes)}`);
  }
  await t.call('god', false);
  await t.call('holdSimulation', false);
}
