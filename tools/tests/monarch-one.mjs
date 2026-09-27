// Monarch Isle has one tower, MONARCH ONE, on its north-east point with only water north of
// it (the camera looks north); its gate arm lifts for the player's car at a crawl and the
// car drives through to the turning circle; the cove's jetty is walkable ground.
export const fresh = true;
export default async function (t) {
  const m = await t.call('monarch');
  t.assert(m.towers.length === 1 && m.towers[0].name === 'MONARCH ONE', 'towers: ' + JSON.stringify(m.towers.map((x) => x.name)));
  t.assert(m.reserveTowers.includes('THE SOVEREIGN'), 'the Sovereign is not kept as a reserve design');
  const T = m.towers[0],
    one = m.monarchOne;
  t.near(one.tower.topM, 290, 330, 'Monarch One to the top of its mast (m)');
  t.assert(one.tower.helipad, 'no helipad on the roof');
  // Nothing but water north of the tower's footprint (what it could hide on screen).
  for (const x of [T.x + 10, T.x + T.w / 2, T.x + T.w - 10]) {
    const p = await t.call('probe', x, T.y - 240, 4);
    t.assert(!p.land, `land north of the tower at ${x}`);
  }
  t.assert(m.walkOnRoad.length === 0, 'walk links along a carriageway: ' + JSON.stringify(m.walkOnRoad.slice(0, 3)));
  // The gate: down with nobody near, up for the player's car rolling up Lighthouse Road.
  const gate = one.gate;
  t.assert(gate.armBody && !gate.up, 'the arm should start down: ' + JSON.stringify(gate));
  await t.call('god', true);
  await t.call('teleport', gate.x - 50, gate.y + 160);
  await t.call('drive', 'sedan', 0, -Math.PI / 2);
  await t.call('placeVehicle', gate.x - 10, gate.y + 110, -Math.PI / 2);
  await t.wait(2.5);
  let g = (await t.call('monarch')).monarchOne.gate;
  t.assert(g.arm > 0.9 && g.up, 'the arm did not lift for a car at a crawl: ' + JSON.stringify(g));
  await t.keys('KeyW', 2.2);
  await t.wait(2);
  const s = await t.call('status');
  t.assert(s.y < gate.y - 40, `the car did not get through the gate: at ${Math.round(s.x)}, ${Math.round(s.y)}`);
  t.assert(s.district === 'MONARCH ONE', 'district inside the grounds: ' + s.district);
  // The jetty is walkable over the water.
  const j = one.jetty,
    p = await t.call('probe', j.x + j.w / 2, j.y + 20, 2);
  t.assert(p.ground && !p.land, 'the jetty is not walkable ground: ' + JSON.stringify(p));
  await t.call('god', false);
}
