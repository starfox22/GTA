// Chase view clouds (clouds3d-sky.js, clouds3d-sky-history.js): on the render page, the layer from below is the
// bounded march on every tier (with wind-aware history), hazed by the air's visibility (clearer
// fair than overcast, and only a few km in heavy rain), looking out 20 km. The no-render page has no view: skipped.
const CITY = [748, 584];
export default async function (t) {
  const first = await t.call('cloudLayer', ...CITY);
  if (!first.view) {
    t.skip('Requires WebGL: run with --render');
  }
  try {
    await t.call('teleport', ...CITY);
    await t.call('viewMode', 'chase');
    await t.call('graphics', 'high');
    await t.call('setClock', 13);
    await t.call('chaseLook', 0, 0, 0, -20);
    // The view is the last drawn frame's (a slow software-GL page draws a frame every few seconds): wait for one
    // that shows the wanted path.
    const sky = async (weather, path, tier = 'HIGH') => {
      await t.call('sky', weather);
      await t.wait(1);
      await t.call('chaseLook', 0, 0, 0, -20);
      let view = null;
      for (let i = 0; i < 20; i++) {
        await t.realWait(2);
        view = (await t.call('cloudLayer', ...CITY)).view.sky;
        if (view.clouds === path && (path !== 'march' || (view.budget?.tier === tier && view.history > 1))) break;
      }
      return view;
    };
    const fair = await sky('fair', 'march');
    t.assert(fair.clouds === 'march', `HIGH draws the march from below: ${JSON.stringify(fair)}`);
    t.near(fair.reachKm, 19, 21, 'the march looks out about 20 km');
    t.assert(fair.history > 0, `the march keeps a history: ${fair.history}`);
    t.near(fair.cloudAirKm, 20, 40, 'fair visibility for the layer (km)');
    const overcast = await sky('overcast', 'march');
    t.assert(overcast.cloudAirKm < fair.cloudAirKm, `overcast air (${overcast.cloudAirKm} km) not hazier than fair (${fair.cloudAirKm} km)`);
    await t.call('graphics', 'medium');
    const medium = await sky('fair', 'march', 'MEDIUM');
    t.assert(medium.clouds === 'march' && medium.budget.steps === 40, `MEDIUM volumetric budget: ${JSON.stringify(medium)}`);
    await t.call('graphics', 'low');
    const low = await sky('fair', 'march', 'LOW');
    t.assert(low.clouds === 'march' && low.budget.steps === 24 && low.budget.resolution === 0.25, `LOW volumetric budget: ${JSON.stringify(low)}`);
    t.assert(low.budget.width < medium.budget.width && low.budget.height < medium.budget.height, 'LOW did not reduce cloud pixels');
    await t.call('graphics', 'ultra');
    const ultra = await sky('fair', 'march', 'ULTRA');
    t.assert(ultra.budget.steps >= fair.budget.steps && fair.budget.steps === 64, 'HIGH/ULTRA step budgets not ordered');
    t.assert(ultra.budget.light === 3 && low.budget.light === 0, 'cloud lighting levels not applied');
    t.note(JSON.stringify({ low: low.budget, medium: medium.budget, high: fair.budget, ultra: ultra.budget }));
    await t.call('viewMode', 'street');
    await t.realWait(3);
    const bench = await t.call('skyCloudBench', 2);
    t.assert(bench && bench.error, 'the cloud bench requires a rendered chase sky');
    t.note(`fair ${fair.cloudAirKm} km, overcast ${overcast.cloudAirKm} km, history ${fair.history} frames`);
  } finally {
    await t.call('viewMode', 'street');
    await t.call('graphics', 'high');
    await t.call('sky');
    // A frame in the street view, so the next test's cloudLayer().view is not this one's (it is the last drawn).
    await t.realWait(3);
  }
}
