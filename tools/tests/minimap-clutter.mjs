// The minimap stays clean (minimap-rules.js MINIMAP MARKS): in busy spots (Midtown on foot and driving, the docks,
// Monarch Isle, Sunset Pier, a five-star chase) the marks it draws per refresh stay under a cap, and with a job (missions
// 1-4) or a map waypoint it draws the GPS road route (minimapReport).
export const fresh = true;
const CAP = { blips: 16, labels: 4 };
const CHASE_CAP = { blips: 30, labels: 4 };
async function peak(t, seconds = 3) {
  await t.call('minimapReport', true);
  await t.wait(seconds);
  return t.call('minimapReport');
}
function under(t, r, cap, label) {
  t.note(`${label}: ${r.peak.blips} blips, ${r.peak.labels} labels at most`);
  t.assert(r.refreshes > 0 && !r.folded, label + ': the minimap was not drawn: ' + JSON.stringify(r));
  t.assert(r.peak.blips <= cap.blips && r.peak.labels <= cap.labels, label + ': too many marks: ' + JSON.stringify(r));
}
export default async function (t) {
  await t.call('settings', { minimapZoom: 1, gps: true });
  // Busy spots, free roam, no job: on foot in Midtown (shops near), the docks, Monarch Isle, Sunset Pier.
  for (const [label, x, y] of [
    ['Midtown on foot', 1760, 2060],
    ['the docks', 2960, 520],
    ['Monarch Isle', 6600, -2500],
    ['Sunset Pier', 3200, -6000],
  ]) {
    await t.call('teleport', x, y);
    await t.wait(1.5);
    under(t, await peak(t), CAP, label);
  }
  // Driving through Midtown: no places at all.
  await t.call('teleport', 1760, 2060);
  await t.call('drive', 'sedan');
  await t.wait(1);
  under(t, await peak(t), CAP, 'Midtown driving');
  // Five stars: the police and the nearest respray join, still capped.
  await t.call('wanted', 5);
  await t.wait(4);
  const chase = await peak(t);
  under(t, chase, CHASE_CAP, 'five stars');
  t.assert(chase.respray, 'no respray while wanted: ' + JSON.stringify(chase));
  await t.call('wanted', 0);

  let r;
  // Missions 1-4: the objective's GPS route on the minimap.
  for (let i = 0; i < 4; i++) {
    await t.call('startMission', i);
    await t.call('teleport', 1300, 3000);
    await t.wait(2.6);
    r = await t.call('minimapReport');
    t.assert(r.objective && r.route && r.routePoints > 1, `mission ${i + 1}: no GPS route on the minimap: ` + JSON.stringify(r));
    t.assert(r.marks.blips <= CAP.blips, `mission ${i + 1}: too many marks: ` + JSON.stringify(r));
    if (i === 3) t.assert(r.highlight === 'KESSLER', 'mission 4: Kessler’s car is not highlighted: ' + JSON.stringify(r));
  }

  // A map waypoint: its cyan road route (beside the job's).
  await t.call('teleport', 1300, 3000);
  await t.call('route', 2400, 1200);
  await t.wait(1.5);
  r = await t.call('minimapReport');
  t.assert(r.waypointRoute, 'no waypoint route on the minimap: ' + JSON.stringify(r));
}
