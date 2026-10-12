// Every island a car can reach (the garage islands) has at least two story payphones (payphones.js PAYPHONES),
// each on that island's land, off the road and clear of doors, bus stops, bike stations, the Blue Hour forecourt and
// the garage lots; the call's pointer guides to the nearest one with hysteresis; a Monarch Isle booth takes the call;
// a call taken at a payphone other than the original starts the job.
export const fresh = true;
export default async function (t) {
  const report = await t.call('payphones');
  const islands = Object.keys((await t.call('garage')).islands);
  const byId = Object.fromEntries(report.list.map((p) => [p.id, p]));
  t.assert(report.list[0].x === 790 && report.list[0].y === 553, 'the original payphone is not first: ' + JSON.stringify(report.list[0]));
  for (const island of islands) {
    const ids = report.islands[island] || [];
    t.assert(ids.length >= 2, `${island}: ${ids.length} payphone(s)`);
    for (const id of ids) {
      const p = byId[id],
        a = p.audit;
      t.assert(a.land && a.island === island, `${id}: not on ${island}: ${JSON.stringify(a)}`);
      t.assert(!a.road && !a.solid, `${id}: on a road or blocked: ${JSON.stringify(a)}`);
      t.assert(a.door === null || a.door >= 120, `${id}: ${a.door} units from a door`);
      t.assert(a.busStop === null || a.busStop >= 60, `${id}: ${a.busStop} units from a bus stop`);
      t.assert(p.style !== 'yellow' || a.bikeStation === null || a.bikeStation >= 88, `${id}: ${a.bikeStation} units from a bike station`);
      t.assert(a.prop === null || a.prop >= 10, `${id}: ${a.prop} units from a street prop`);
      t.assert(!a.forecourt && !a.garageLot, `${id}: on the Blue Hour forecourt or a garage lot`);
      t.assert(a.otherPayphone >= 400, `${id}: another payphone ${a.otherPayphone} units away`);
    }
    t.note(`${island}: ${ids.length} (${ids.join(', ')})`);
  }
  // A Monarch Isle booth answers the waiting call (its concierge lines are for when none waits).
  const isle = byId['monarch-1'];
  await t.call('teleport', isle.x, isle.y + 30);
  await t.wait(0.3);
  let r = await t.call('payphones');
  t.assert(r.callWaiting && r.inReach === 'monarch-1' && r.guided === 'monarch-1', 'Monarch booth: ' + JSON.stringify({ inReach: r.inReach, guided: r.guided, callWaiting: r.callWaiting }));
  await t.call('interact');
  t.assert((await t.call('status')).mode === 'dialogue', 'the Monarch booth did not ring through');
  await t.keys('Escape', 0.3, { real: true });
  t.assert((await t.call('status')).mode === 'play', 'HANG UP did not close the call');
  // The pointer: the nearest payphone, not switching until another is clearly nearer.
  const a = byId.palmshore,
    b = byId['palmshore-south'];
  await t.call('teleport', a.x, a.y + 40);
  await t.wait(0.3);
  r = await t.call('payphones');
  t.assert(r.guided === 'palmshore', 'near PALMSHORE the pointer guides to ' + r.guided);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    len = Math.hypot(b.x - a.x, b.y - a.y);
  await t.call('teleport', mid.x + ((b.x - a.x) / len) * 40, mid.y + ((b.y - a.y) / len) * 40);
  await t.wait(0.3);
  r = await t.call('payphones');
  const da = r.list.find((p) => p.id === 'palmshore').metres,
    db = r.list.find((p) => p.id === 'palmshore-south').metres;
  if (db * 8 > da * 8 * 0.8 - 40) t.assert(r.guided === 'palmshore', `half way (${da} m / ${db} m) the pointer flicked to ${r.guided}`);
  await t.call('teleport', b.x, b.y + 40);
  await t.wait(0.3);
  r = await t.call('payphones');
  t.assert(r.guided === 'palmshore-south' && r.inReach === 'palmshore-south', 'at PALMSHORE SOUTH: ' + JSON.stringify({ guided: r.guided, inReach: r.inReach }));
  const p = await t.call('pointers');
  t.assert(p.payphoneRinging && p.objective && p.objective.x === b.x && p.objective.y === b.y, 'the pointer is not at the nearest payphone: ' + JSON.stringify(p.objective));
  // Take the call there: job 1 starts.
  await t.call('interact');
  t.assert((await t.call('status')).mode === 'dialogue', 'PALMSHORE SOUTH did not ring through');
  await t.keys('Enter', 0.3, { real: true });
  const m = await t.call('missionState');
  t.assert(m.index === 0 && m.stage === 0, 'the call at PALMSHORE SOUTH did not start job 1: ' + JSON.stringify(m));
  const q = await t.call('pointers');
  t.assert(q.objective && !q.payphoneRinging && Math.hypot(q.objective.x - b.x, q.objective.y - b.y) > 500, 'job 1 does not point away from the payphone: ' + JSON.stringify(q.objective));
}
