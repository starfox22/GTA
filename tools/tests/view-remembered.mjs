// The camera view: a new player starts in the overhead street view, and the last choice (V) is
// remembered when the game is opened again (chase-camera.js, localStorage 'dead-end-city-view').
export const fresh = true;
export default async function (t) {
  let v = await t.call('viewMode');
  t.assert(v.mode === 'street', `a fresh profile did not start in the street view: ${v.mode}`);
  await t.call('viewMode', 'chase');
  await t.reload({ keep: true });
  v = await t.call('viewMode');
  t.assert(v.mode === 'chase', `the chase view was not remembered: ${v.mode}`);
  await t.call('viewMode', 'street');
  await t.reload({ keep: true });
  v = await t.call('viewMode');
  t.assert(v.mode === 'street', `the street view was not remembered: ${v.mode}`);
}
