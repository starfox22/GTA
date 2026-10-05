// Open-sea countdown (world-edge.js worldEdgeCanReach): on land nothing counts and no card shows. The county's east
// coast ends only 42 units short of the line, so a car driving east on the Ridgeline (here along the
// Stonecreek Connector, 3,000 units from the line, inside the 3,200-unit approach distance) used to be told
// to turn back 400 m inland by the old edge warning.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    const line = (await t.call('worldEdge')).line;
    // On the Stonecreek Connector, heading down it toward (8297, 3159).
    const x = 8069,
      y = 3237,
      heading = Math.atan2(3159 - y, 8297 - x);
    await t.call('teleport', x, y);
    await t.call('drive', 'sedan', 0, heading);
    await t.call('placeVehicle', x, y, heading, 0);
    await t.call('launch', 12);
    let e = null,
      fastest = 0;
    for (let i = 0; i < 6; i++) {
      await t.keys('KeyW', 0.25);
      e = await t.call('worldEdge');
      fastest = Math.max(fastest, e.v[0]);
      t.assert(e.out === 0 && !e.canReach && e.cue === null, 'counted on land: ' + JSON.stringify([e.out, e.landMetres, e.v]));
    }
    t.note(`drove east on land from ${line.right - x} units off the line, fastest ${fastest} m/s east; no card`);
    // worldEdge().v is in m/s.
    t.assert(fastest > 8, 'the car never really moved east, so the check proved nothing: ' + fastest);
  } finally {
    await t.call('holdSimulation', false);
  }
}
