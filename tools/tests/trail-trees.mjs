// The 4x4 trails' view corridor and the forest's trunks (trail-trees.js, forest-trunks.js): no forest or plan tree
// near either trail could hide a vehicle on it from the street camera (checked point by point at every path sample,
// pad and the summit), no trunk stands on a trail's verge, a hairpin's run-off or a carriageway, and a club crawler driven into a tree beside the
// Mount Ascent trailhead stops against the trunk with a crash (front damage) instead of passing through it.
export const fresh = true;

export default async function (t) {
  const audit = await t.call('trailTreeAudit');
  t.finite(audit, 'trailTreeAudit');
  for (const trail of audit.trails) {
    t.assert(trail.covering === 0, `${trail.name}: ${trail.covering} trees could hide a vehicle: ${JSON.stringify(trail.worst)}`);
    t.assert(trail.closest === null || trail.closest >= 0, `${trail.name}: closest tree gap ${trail.closest}`);
    t.assert(trail.verge === 0, `${trail.name}: ${trail.verge} trunks on the verge or a hairpin's run-off (closest ${trail.vergeClosest})`);
  }
  t.assert(audit.stats.forest.removed > 0, 'the corridor took no forest tree out: ' + JSON.stringify(audit.stats));
  t.note(`corridor: ${audit.stats.forest.removed} forest trees out, ${audit.stats.forest.thinned} thinned, ${audit.planRemoved} plan trees; closest ${audit.trails.map((r) => r.closest).join(' / ')}`);

  const forest = await t.call('forestTrunks');
  t.assert(forest.fields['RIDGELINE RANGE'] > 5000, 'the range has few trunks: ' + JSON.stringify(forest.fields));
  t.assert(forest.nearRoad.count === 0, 'trunks on or beside a carriageway: ' + JSON.stringify(forest.nearRoad));
  t.assert(forest.onTrail.count === 0, 'trunks on a 4x4 trail: ' + JSON.stringify(forest.onTrail));

  // A tree beside the trailhead with level ground and nothing else for 46 units west of it.
  const near = await t.call('forestTrunks', 7517, 1942, 200);
  let target = null;
  for (const [x, y, ground] of near.trunks) {
    const start = await t.call('probe', x - 46, y);
    if (!start.land || Math.abs(start.terrain - ground) > 3 || start.solid) continue;
    const blocked = near.trunks.some(([ox, oy]) => (ox !== x || oy !== y) && ox > x - 70 && ox < x + 4 && Math.abs(oy - y) < 14);
    if (!blocked) {
      target = { x, y, ground };
      break;
    }
  }
  t.assert(target, 'no tree with a clear, level approach near the trailhead: ' + JSON.stringify(near.trunks.slice(0, 8)));
  if (!target) return;
  await t.call('holdSimulation', true);
  try {
    // `drive` puts the truck 60 units east of the player, facing east (heading 0).
    await t.call('teleport', target.x - 106, target.y);
    await t.call('drive', 'crawler', 0, 0);
    const before = await t.call('damageReport');
    t.assert(Math.abs(before.y - target.y) < 3 && before.x < target.x - 30, `the crawler is not lined up on the tree: ${before.x}, ${before.y} for ${target.x}, ${target.y}`);
    // About 43 km/h at the trunk, foot down.
    await t.call('launch', 12);
    await t.keys('KeyW', 2.5);
    const after = await t.call('damageReport');
    t.finite(after, 'crawler after the tree');
    t.assert(after.x < target.x - 8, `the crawler passed through the trunk: centre at ${after.x}, trunk at ${target.x}`);
    t.assert(after.hp < before.hp && after.zones.front > 0, `no crash into the trunk: hp ${before.hp} -> ${after.hp}, front ${after.zones.front}`);
    t.note(`crawler into the tree at ${Math.round(target.x)}, ${Math.round(target.y)}: stopped at ${after.x}, hp ${before.hp} -> ${after.hp}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
