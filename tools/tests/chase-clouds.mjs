// Chase view clouds (clouds3d-sky.js, clouds3d-sky-history.js): on the render page, the layer from below is the
// march on HIGH (with a running history) and the dome's layer on MEDIUM, hazed by the air's visibility (clearer
// fair than overcast, and only a few km in heavy rain), looking out 20 km. The no-render page has no view: skipped.
const CITY = [748, 584];
export default async function (t) {
  const first = await t.call('cloudLayer', ...CITY);
  if (!first.view) {
    t.note('no renderer: nothing to check');
    return;
  }
  try {
    await t.call('teleport', ...CITY);
    await t.call('viewMode', 'chase');
    await t.call('graphics', 'high');
    await t.call('setClock', 13);
    await t.call('chaseLook', 0, 0, 0, -20);
    const sky = async (weather) => {
      await t.call('sky', weather);
      await t.wait(1);
      await t.call('chaseLook', 0, 0, 0, -20);
      await t.realWait(2);
      return (await t.call('cloudLayer', ...CITY)).view.sky;
    };
    const fair = await sky('fair');
    t.assert(fair.clouds === 'march', `HIGH draws the march from below: ${JSON.stringify(fair)}`);
    t.near(fair.reachKm, 19, 21, 'the march looks out about 20 km');
    t.assert(fair.history > 0, `the march keeps a history: ${fair.history}`);
    t.near(fair.cloudAirKm, 20, 40, 'fair visibility for the layer (km)');
    const overcast = await sky('overcast');
    t.assert(overcast.cloudAirKm < fair.cloudAirKm, `overcast air (${overcast.cloudAirKm} km) not hazier than fair (${fair.cloudAirKm} km)`);
    await t.call('graphics', 'medium');
    const medium = await sky('fair');
    t.assert(medium.clouds === 'layer', `MEDIUM draws the dome's layer: ${medium.clouds}`);
    const bench = await t.call('skyCloudBench', 2);
    t.assert(bench && bench.error, 'the bench needs HIGH or ULTRA');
    t.note(`fair ${fair.cloudAirKm} km, overcast ${overcast.cloudAirKm} km, history ${fair.history} frames`);
  } finally {
    await t.call('graphics', 'high');
    await t.call('viewMode', 'street');
    await t.call('sky');
  }
}
