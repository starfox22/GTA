// The renderer's first-use log (render3d-hiccups.js, DeadEndCity.renderHiccups): null without WebGL; with it
// the report has the counters, the GPU totals and the prewarm progress (no error, no stand-in model failed),
// and `reset` starts a fresh log.
export default async function (t) {
  const report = await t.call('renderHiccups');
  if (report === null) {
    // The no-render page: no renderer, nothing to log.
    t.assert((await t.call('drawProfile')) === null, 'drawProfile without a renderer');
    return;
  }
  t.finite(report, 'renderHiccups');
  for (const key of ['frames', 'programsLinked', 'texturesCreated', 'geometriesCreated', 'worstCpuMs'])
    t.assert(typeof report[key] === 'number', `renderHiccups.${key} is a number`);
  t.assert(
    report.prewarm && report.prewarm.error === '' && report.prewarm.modelErrors === 0 && report.prewarm.strays === 0,
    `prewarm error: ${JSON.stringify(report.prewarm)}`,
  );
  t.assert(report.gpu.geometries > 0 && report.gpu.uploadedGeometries <= report.gpu.geometries, 'gpu geometry totals');
  await t.call('renderHiccups', true);
  const after = await t.call('renderHiccups');
  t.assert(after.frames <= 3 && after.events.length <= 3, `the log starts afresh after reset: ${after.frames} frames, ${after.events.length} events`);
  const profile = await t.call('drawProfile', 5);
  t.assert(profile.triangles > 0 && Array.isArray(profile.byTriangles), 'drawProfile counts triangles');
}
