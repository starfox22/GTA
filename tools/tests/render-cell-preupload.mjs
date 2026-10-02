// The cell pre-upload (render3d-resources.js CELL PRE-UPLOAD) sends the geometry of the cells ahead of the view to the
// GPU in slices and goes on as the view moves. Runs only where the shader prewarm runs (a real GPU, or a rendered page with `--prewarm`); elsewhere it checks the
// report only.
export default async function (t) {
  const first = await t.call('renderHiccups');
  if (first === null) return; // the no-render page
  t.assert(first.cells && first.cells.preUpload && typeof first.cells.preUpload.meshes === 'number', 'cells.preUpload is reported');
  if (!first.litStage.staging) return; // no prewarm: the pre-upload does not run
  await t.call('graphics', 'low');
  await t.call('look', 748, 584, 2);
  for (let i = 0; i < 120 && !(await t.call('renderHiccups')).prewarm.done; i++) await t.realWait(5);
  await t.realWait(30);
  const after = (await t.call('renderHiccups')).cells.preUpload;
  t.note('pre-upload after 30 s: ' + JSON.stringify(after));
  t.assert(after.meshes > 0 && after.MB > 0, 'the pre-upload sent something: ' + JSON.stringify(after));
  t.assert(after.slowestMs < 250, `the slowest slice took ${after.slowestMs} ms`);
  // Moving into the next cell keeps it going (the nearest cell not on the GPU is always the next to go).
  await t.call('look', 748 + 1536, 584, 2);
  await t.realWait(20);
  const moved = (await t.call('renderHiccups')).cells.preUpload;
  t.assert(moved.meshes > after.meshes, `the pre-upload went on after the move: ${after.meshes} -> ${moved.meshes} meshes`);
}
