// Ambulances in free roam (livingcity-medics.js): a body on a city pavement brings an ambulance
// under lights; it arrives, two paramedics work on the victim (one kneeling, one on the radio),
// the victim comes round (or is lost), the crew climbs back in and the ambulance rejoins traffic.
export const fresh = true;
async function runJob(t, x, y, revive) {
  await t.call('teleport', x, y);
  await t.wait(1.5);
  const start = await t.call('medicTest', null, null, revive);
  t.assert(start.job, 'no ambulance sent: ' + JSON.stringify(start));
  t.assert(start.job.ambulance.siren, 'the ambulance is not running with its siren');
  const seen = { phases: new Set(), help: false, phone: false, arrivedAt: null };
  let r = start;
  for (let i = 0; i < 40 && r.job; i++) {
    await t.wait(2);
    r = await t.call('medicReport');
    if (!r.job) break;
    seen.phases.add(r.job.phase);
    if (r.job.phase !== 'driving' && seen.arrivedAt === null) seen.arrivedAt = r.job.seconds;
    for (const m of r.job.medics) {
      if (m.pose === 'help' && m.d < 20) seen.help = true;
      if (m.pose === 'phone') seen.phone = true;
    }
  }
  return { r, seen };
}
export default async function (t) {
  await t.call('god', true);
  await t.call('setClock', 14);
  const a = await runJob(t, 1219, 896, true);
  t.note(`revive run: arrived after ${a.seen.arrivedAt} s, phases ${[...a.seen.phases].join(' ')}, last ${JSON.stringify(a.r.last)}`);
  t.assert(!a.r.job, 'the job never finished: ' + JSON.stringify(a.r.job));
  t.assert(a.seen.arrivedAt !== null && a.seen.arrivedAt < 70, 'the ambulance took too long: ' + a.seen.arrivedAt);
  t.assert(a.seen.help && a.seen.phone, 'the medics never worked on the victim (kneeling and on the radio)');
  t.assert(a.r.last.why === 'done' && a.r.last.outcome === 'revived', 'not revived: ' + JSON.stringify(a.r.last));
  const b = await runJob(t, 707, 1408, false);
  t.note(`lost run: arrived after ${b.seen.arrivedAt} s, last ${JSON.stringify(b.r.last)}`);
  t.assert(b.r.last.why === 'done' && b.r.last.outcome === 'lost', 'the lost run did not finish as lost: ' + JSON.stringify(b.r.last));
  t.assert(b.r.revived === 1 && b.r.lost === 1, 'counts: ' + JSON.stringify(b.r));
  await t.call('god', false);
}
