// The street lamps mirrored in a wet road (wet-glints3d.js, console wetGlints): null without WebGL; with it, at night
// in the rain on HIGH the list holds lit lamps (no more than the slots, lamp heads, nothing from the light map), both
// in the street view and the chase view (where a few lamps a frame are tested for a building in the way); by day and
// on LOW it is empty; the street view keeps its wet-street contract (rainView).
export const fresh = true;
export default async function (t) {
  const first = await t.call('wetGlints');
  if (first === null) return; // the no-render page: no renderer
  await t.call('holdSimulation', true);
  try {
    await t.call('god', true);
    await t.call('graphics', 'high');
    await t.call('sky', 'rain');
    await t.call('wetness', 1);
    await t.call('setClock', 23);
    await t.call('viewMode', 'street');
    // A city street (lamps line every road).
    await t.call('teleport', 2290, 2290);
    await t.call('hitchRun', 0.5, [], 1, false, true);
    const night = await t.call('wetGlints');
    t.finite(night, 'wetGlints at night');
    t.assert(night.count > 0 && night.count <= night.tierSlots, 'lamps glint in the wet road: ' + JSON.stringify(night));
    t.assert(night.gain > 0 && night.lampPower > 0 && !night.lightMapStreaks, 'lit, from the lamp heads: ' + JSON.stringify(night));
    for (const n of night.nearest) t.near(n.height, 60, 75, 'a glint source is a lamp head');
    const rain = await t.call('rainView');
    if (rain) t.assert(!rain.sheenRadial, 'the street view keeps a non-zero citySheenDir: ' + JSON.stringify(rain));
    // The chase view: lamps in front of the lens, a few tested each frame for a building in the way.
    await t.call('viewMode', 'chase');
    await t.call('hitchRun', 0.5, [], 1, false, true);
    const chase = await t.call('wetGlints');
    t.assert(chase.count > 0 && chase.count <= chase.tierSlots, 'glints in the chase view: ' + JSON.stringify(chase));
    t.assert(chase.chaseChecks > 0, 'lamps tested for a building in the way: ' + JSON.stringify(chase));
    await t.call('viewMode', 'street');
    // By day the lamps are off: nothing.
    await t.call('setClock', 13);
    await t.call('hitchRun', 0.5, [], 1, false, true);
    const day = await t.call('wetGlints');
    t.assert(day.count === 0, 'no glints by day: ' + JSON.stringify(day));
    // LOW draws no glints.
    await t.call('setClock', 23);
    await t.call('graphics', 'low');
    await t.call('hitchRun', 0.5, [], 1, false, true);
    const low = await t.call('wetGlints');
    t.assert(low.count === 0 && low.tierSlots === 0, 'none on LOW: ' + JSON.stringify(low));
  } finally {
    await t.call('viewMode', 'street');
    await t.call('graphics', 'high');
    await t.call('sky');
    await t.call('holdSimulation', false);
  }
}
