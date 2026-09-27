// Traffic streaming (livingcity-traffic.js): the city's traffic is kept round the player, busy at
// the rush hour and quiet at night, with the pool bounded and the district's own cars (taxis on
// Broadway, trucks in the Ironworks); a teleport resettles it.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  const start = await t.call('trafficReport');
  t.assert(start.enabled, 'the streamer is off');
  // Morning rush on Broadway.
  await t.call('setClock', 8.2);
  await t.call('teleport', 1330, 3390);
  await t.wait(3);
  const rush = await t.call('trafficReport');
  t.note(`Broadway 08:12: target ${rush.target}, near ${rush.near}, moving ${rush.moving}, pool ${rush.pool}, vehicles ${rush.vehicles}, ${JSON.stringify(rush.types)}`);
  t.assert(rush.district === 'BROADWAY', 'not on Broadway: ' + rush.district);
  t.assert(rush.target >= 35, 'rush-hour target too low: ' + rush.target);
  t.assert(rush.near >= rush.target * 0.75, `too little traffic round the player: ${rush.near} of ${rush.target}`);
  t.assert(rush.pool <= 150, 'pool over its cap: ' + rush.pool);
  // Drive time on: the cars keep moving, nothing piles up for good.
  await t.wait(20);
  const later = await t.call('trafficReport');
  t.note(`20 s on: near ${later.near}, moving ${later.moving}, stopped ${later.stopped} ${JSON.stringify(later.held)}, idle30 ${later.idle30}, stream ${later.streamMs} ms`);
  t.assert(later.moving >= later.near * 0.25, `most of the traffic stands: ${later.moving} of ${later.near} moving`);
  t.assert(later.streamMs < 20, 'a streaming tick took ' + later.streamMs + ' ms');
  // The Ironworks docks: trucks, pickups and vans.
  await t.call('teleport', 1180, -380);
  await t.wait(3);
  const docks = await t.call('trafficReport');
  t.note(`${docks.district}: target ${docks.target}, near ${docks.near}, ${JSON.stringify(docks.types)}`);
  // Three in the morning: a quiet street after a teleport (the settle).
  await t.call('setClock', 3);
  await t.call('teleport', 2680, 2890);
  await t.wait(3);
  const night = await t.call('trafficReport');
  t.note(`${night.district} 03:00: target ${night.target}, near ${night.near}, pool ${night.pool}, ${JSON.stringify(night.types)}`);
  t.assert(night.target < rush.target * 0.5, `night target ${night.target} not well under the rush's ${rush.target}`);
  t.assert(night.near <= night.target + 12, `night streets as busy as the day: ${night.near} (target ${night.target})`);
  await t.wait(6);
  const settled = await t.call('trafficReport');
  t.assert(settled.pool <= settled.target + 14 + 8, `the pool did not shrink back: ${settled.pool} for a target of ${settled.target}`);
  const bench = await t.call('trafficBenchmark', 120);
  t.note(`physics ${bench.msPerFrame60} ms per 60 fps frame with ${bench.vehicles} vehicles`);
  await t.call('setClock', 13);
  await t.call('god', false);
}
