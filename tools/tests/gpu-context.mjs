// A lost WebGL context (gpu-context.js GPU CONTEXT): the game pauses and stops drawing instead of freezing, the
// frame loop keeps running, and when the context comes back a reload is booked (a dev page only reports it).
// Rendered pages only: `node tools/test.mjs gpu-context --render`.
export const fresh = true;
export default async function (t) {
  const g0 = await t.call('gpuContext');
  if (!g0.watched) t.skip('no 3D renderer on this page (run with --render)');
  t.assert(!g0.lost && g0.losses === 0, 'context lost before the drill: ' + JSON.stringify(g0));
  await t.call('holdSimulation', false);
  const lost = await t.call('gpuContext', 'lose');
  await t.realWait(2);
  let g = await t.call('gpuContext');
  const s = await t.call('status');
  t.note('lost: ' + JSON.stringify(g) + ' mode ' + s.mode);
  t.assert(g.lost && g.losses === 1, 'the loss was not noticed: ' + JSON.stringify(lost) + ' ' + JSON.stringify(g));
  t.assert(s.mode === 'pause', 'the game did not pause on the loss: ' + s.mode);
  await t.call('pauseMenu', false);
  t.assert((await t.call('status')).mode === 'pause', 'resume was allowed while the graphics context was lost');
  const n = await t.call('notices');
  t.assert(JSON.stringify(n).includes('DROPPED THE PICTURE'), 'the player was not told');
  // The loop keeps going while the context is away (no frame faults from drawing into a lost context).
  const f = await t.call('frameFaults');
  t.assert(f.count === 0, 'frame faults while the context was lost: ' + JSON.stringify(f.kinds));
  await t.call('gpuContext', 'restore');
  await t.realWait(4);
  g = await t.call('gpuContext');
  t.note('restored: ' + JSON.stringify(g));
  t.assert(!g.lost && g.restores === 1 && g.reloadPending, 'no recovery after the restore: ' + JSON.stringify(g));
  await t.call('pauseMenu', false);
  t.assert((await t.call('status')).mode === 'pause', 'resume was allowed before the recovery reload');
}
