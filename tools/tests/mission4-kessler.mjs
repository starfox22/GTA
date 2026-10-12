// Mission 4 (Borrowed Stripes): Kessler's car stands only in proper places (flush with the kerb at his house and
// opposite the Marea, out of the lanes and off the junctions, kerbFit), the wait at the club brings him on from at least
// a couple of blocks away, his car carries the KESSLER highlight on the maps, and every step that sends the player
// somewhere has a GPS road route on the minimap and the city map (gpsReport): his car, his trunk, the fort's gate, the
// records office, the consul at EVOLUTION. Mission 3's summit and Vinny's warehouse too.
export const fresh = true;
const MAREA = { x: -2822, y: 5214 };
const CITY = [1300, 3000];
function kerbed(t, k, label) {
  t.assert(k, label + ': not on a city street');
  t.assert(k.kerbGap >= 0 && k.kerbGap < 4, label + ': not flush with the kerb: ' + JSON.stringify(k));
  t.assert(k.innerSide >= 24.5, label + ': into the lane (the lane line is 25 off the centre): ' + JSON.stringify(k));
  t.assert(k.across < 0.1 && !k.junction, label + ': across the street or in a junction: ' + JSON.stringify(k));
}
async function routed(t, label, maxLeg = 400, from = CITY) {
  await t.call('teleport', from[0], from[1]);
  await t.wait(2.6);
  const g = await t.call('gpsReport');
  t.assert(g.objective, label + ': no objective: ' + JSON.stringify(g));
  t.assert(g.routePoints > 1 && g.minimap && g.bigMap, label + ': no GPS route on the maps: ' + JSON.stringify(g));
  t.assert(g.lastLeg !== null && g.lastLeg < maxLeg, label + ': the route stops far short: ' + JSON.stringify(g));
  return g;
}
export default async function (t) {
  await t.call('startMission', 3);
  kerbed(t, await t.call('kerbFit'), 'at his house');
  let g = await routed(t, 'his car');
  t.assert(g.highlight?.label === 'KESSLER', 'his car is not highlighted: ' + JSON.stringify(g));

  // Waiting at the club: he comes on from at least a couple of blocks out.
  await t.call('teleport', -2700, 5150);
  let r;
  for (let i = 0; i < 8; i++) {
    await t.wait(2);
    r = await t.call('fortJob');
    if (r.jumped) break;
  }
  t.assert(r.jumped, 'never brought on: ' + JSON.stringify(r));
  const away = Math.hypot(r.car.x - MAREA.x, r.car.y - MAREA.y);
  t.note('brought on ' + Math.round(away) + ' units from his kerb');
  t.assert(away >= 1024, 'brought on too close to the Marea: ' + Math.round(away));
  // He parks at the kerb, at rest, opposite the club.
  for (let i = 0; i < 90 && r.stage === 1; i++) {
    await t.wait(2);
    r = await t.call('fortJob');
  }
  t.assert(r.stage === 2 && r.car.kmh === 0, 'never parked: ' + JSON.stringify(r));
  t.assert(Math.hypot(r.car.x - MAREA.x, r.car.y - MAREA.y) < 30, 'parked away from his spot: ' + JSON.stringify(r.car));
  kerbed(t, await t.call('kerbFit'), 'at the Marea');
  g = await t.call('gpsReport');
  t.assert(g.highlight?.label === 'KESSLER', 'his parked car is not highlighted: ' + JSON.stringify(g));

  // His trunk (Kessler inside), the gate, the records office, then the consul.
  await t.call('fortSkip', 'inside');
  await routed(t, 'his trunk');
  await t.call('fortSkip', 'changed');
  r = await t.call('fortJob');
  t.assert(r.stage === 6, 'at the gate stage: ' + JSON.stringify(r));
  g = await routed(t, 'the fort gate');
  t.assert(Math.hypot(g.objective.x - 9236, g.objective.y - 8182) < 5, 'the gate is the objective: ' + JSON.stringify(g));
  t.assert(g.highlight === null, 'the highlight outlived the trunk: ' + JSON.stringify(g));
  await t.call('fortCoverTest', 'inside');
  await t.wait(0.5);
  r = await t.call('fortJob');
  t.assert(r.stage === 7, 'at the records stage: ' + JSON.stringify(r));
  // No roads inside the wire in the graph: the route ends at the causeway and a dashed leg goes in by the gate
  // (the records door is at the HQ's far east end, about 870 units on from the causeway's last node).
  await routed(t, 'the records office', 950);
  await t.call('fortSkip', 'meet');
  r = await t.call('fortJob');
  t.assert(r.stage === 9, 'at the meeting stage: ' + JSON.stringify(r));
  await routed(t, 'the consul at EVOLUTION');

  // Mission 3: the summit, then Vinny's warehouse.
  await t.call('startMission', 2);
  await routed(t, 'the summit');
  await t.call('summitSkip', 'deliver');
  await routed(t, 'Vinny’s warehouse');
}
