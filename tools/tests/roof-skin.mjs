// The roof skin (roofskin3d.js) and the roof extras (cityscape3d-roofplant.js). The sampled roofs stand where they
// stood (same footprints). With WebGL: every roof finish in use has caps, the city's buildings are tinted, and the roof
// plant the game reads (b.roofKeepOuts, which cityRandom's stream places: helicopter landings, roof walking) is exactly
// what the build before the skin placed, since the extras draw from a stream of their own. Without WebGL (the suite's
// page) there is no renderer, so no roof report and no recorded plant.
const FINISHES = ['gravel', 'membrane', 'tar', 'terracotta', 'pavers', 'green', 'metal'];
// A point on each roof, its footprint [x, y, w, h] (rounded) and its recorded plant ([x, y, w, d] per box) as the
// build before the roof skin had them: offices, brick and stucco roofs in Northbank, Midtown and the Exchange District.
const ROOFS = [
  [1990, 1900, [1925, 1760, 153, 146], [[1949, 1872, 19, 16], [1970, 1878, 19, 16], [2002, 1902, 96, 5], [2058, 1782, 8, 8]]],
  [1408, 780, [1256, 762, 284, 148], [[1279, 781, 21, 17], [1508, 880, 24, 24], [1341, 843, 19, 16]]],
  [1920, 1292, [1871, 1248, 98, 146], [[1891, 1274, 21, 17], [1900, 1328, 19, 16]]],
  [896, 2316, [892, 2272, 162, 146], [[917, 2288, 21, 17], [916, 2384, 19, 16], [937, 2390, 19, 16], [973, 2414, 101, 5]]],
  [2944, 3340, [2940, 3296, 162, 146], [[2960, 3313, 21, 17], [2964, 3408, 19, 16], [2985, 3414, 19, 16], [3021, 3438, 101, 5], [3082, 3318, 8, 8]]],
];
export default async function (t) {
  const ground = await t.call('groundDetail');
  for (const [x, y, footprint, plant] of ROOFS) {
    const at = (await t.call('rooftops', x, y)).roofAt;
    const box = at && [at.x, at.y, at.w, at.h].map(Math.round);
    t.assert(box && JSON.stringify(box) === JSON.stringify(footprint), `roof at ${x}, ${y}: ${JSON.stringify(box)} (was ${JSON.stringify(footprint)})`);
    if (ground === null) t.assert(at.keepOuts.length === 0, `roof plant recorded without a renderer at ${x}, ${y}`);
    else t.assert(JSON.stringify(at.keepOuts) === JSON.stringify(plant), `roof plant at ${x}, ${y}: ${JSON.stringify(at.keepOuts)} (was ${JSON.stringify(plant)})`);
  }
  if (ground === null) return;
  const roofs = ground.roofs;
  t.assert(roofs && Array.isArray(roofs.finishes) && roofs.finishes.length >= 4, `roof finishes: ${JSON.stringify(roofs)}`);
  for (const finish of roofs.finishes) {
    t.assert(FINISHES.includes(finish), `unknown roof finish ${finish}`);
    t.assert(roofs.caps[finish] > 0, `${finish}: no roof caps`);
  }
  const caps = Object.values(roofs.caps).reduce((a, b) => a + b, 0);
  t.assert(roofs.tinted >= 200 && caps >= roofs.tinted, `${roofs.tinted} buildings tinted, ${caps} caps`);
}
