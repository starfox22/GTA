// Falls: the body's drop scale; walking off a Ridgeline cliff kills and walking the
// trail down does not hurt; a car driven off the biggest drop is wrecked while a 4x4
// brought down the trail (and a sedan down a mountain road, when one climbs) is intact.
export const fresh = true;

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // The scale on flat ground: a stumble, an injury, the end.
    let r = await t.call('fallTest', 'drop', 4);
    t.assert(r.mode === 'play' && r.hp === 100, `4 m drop is a stumble: ${r.mode} hp ${r.hp}`);
    r = await t.call('fallTest', 'drop', 11);
    t.assert(r.mode === 'play' && r.hp > 30 && r.hp < 95, `11 m drop hurts: ${r.mode} hp ${r.hp}`);
    r = await t.call('fallTest', 'drop', 22);
    t.assert(r.mode === 'dead', `22 m drop kills: ${r.mode} hp ${r.hp}`);

    // Run off a cliff edge in the Ridgeline Range.
    r = await t.call('fallTest', 'walk-cliff');
    t.assert(!r.error, 'a lethal cliff exists: ' + JSON.stringify(r).slice(0, 200));
    t.assert(r.fell, 'walked off the edge and fell');
    t.assert(r.mode === 'dead', `off the cliff: expected death, got ${r.mode} hp ${r.hp}`);
    const hit = r.impacts[r.impacts.length - 1];
    t.assert(hit && hit.injury === 'lethal', `lethal impact: ${JSON.stringify(hit)}`);
    t.note(`cliff at ${r.spot.x},${r.spot.y} (${r.spot.topM} m): down ${hit.drop} m at ${hit.speed} m/s`);

    // Walk down the Mount Ascent trail from the summit: never leaves the ground.
    r = await t.call('fallTest', 'walk-trail', 30);
    t.assert(r.mode === 'play' && r.hp === 100 && r.minHp === 100, `trail walk unhurt: ${r.mode} hp ${r.minHp}`);
    t.assert(r.fallFrames === 0 && r.tumbleFrames === 0, `no falls or tumbles on the trail: ${r.fallFrames} / ${r.tumbleFrames}`);
    t.assert(r.progress > 0.25, `walked a good way down: ${r.progress}`);

    // A sedan driven off the biggest drop: flies, and is wrecked.
    r = await t.call('fallTest', 'drive-cliff');
    t.assert(!r.error, 'a drop with a run-up exists');
    t.assert(r.flew, 'the car left the ground');
    t.assert(r.car.destroyed || (r.car.overturned && r.car.hp < 60), `car wrecked: ${JSON.stringify(r.car)}`);
    t.note(`car off ${r.spot.carDropM} m: ${JSON.stringify(r.car)}, player ${r.mode}`);

    // A 4x4 brought down the trail: no flights worth the name, no damage.
    r = await t.call('fallTest', 'drive-trail', 30);
    t.assert(r.car.hp === r.car.maxhp && !r.car.overturned, `4x4 intact down the trail: ${JSON.stringify(r.car)}`);
    t.assert(r.newLandings.every((l) => !(l.speed > 5)), `no hard landings: ${JSON.stringify(r.newLandings)}`);
    t.assert(r.progress > 0.08, `made progress down: ${r.progress} (${r.reason})`);

    // A sedan down the steepest mountain road, where the county roads climb.
    r = await t.call('fallTest', 'drive-road', 40);
    if (r.error) t.note('no mountain road with a climb to drive down yet');
    else {
      t.assert(r.car.hp >= r.car.maxhp * 0.97 && !r.car.overturned, `sedan intact down ${r.road}: ${JSON.stringify(r.car)}`);
      t.assert(r.newLandings.every((l) => !(l.speed > 5)), `no hard landings on ${r.road}: ${JSON.stringify(r.newLandings)}`);
    }
  } finally {
    await t.call('holdSimulation', false);
  }
}
