// The frame trace (src/frame-trace.js): hitchRun steps whole frames and reports frame times, sections, long frames
// and counters; frameTrace records live frames; both remove every wrapper they put on the browser's prototypes when
// they stop, and the game plays on afterwards.
export default async function (t) {
  await t.call('god', true);
  await t.call('wanted', 0);
  await t.call('teleport', 748, 584);
  const r = await t.call('hitchRun', 1, ['KeyW'], 5);
  t.assert(r.mode === 'stepped' && r.frames === 60, `hitchRun steps 60 frames: ${r.mode} ${r.frames}`);
  for (const key of ['avgMs', 'p50Ms', 'p95Ms', 'p99Ms', 'maxMs', 'long', 'over33']) t.assert(Number.isFinite(r[key]), `hitchRun.${key} is a number`);
  t.assert(r.sections.cars && r.sections.people, `sections include cars and people: ${Object.keys(r.sections).join(', ')}`);
  t.assert(Number.isFinite(r.totals.allocKB), 'the heap is read every frame (allocKB)');
  t.assert(r.wrappersLeft === 0, `no prototype wrapper left behind: ${r.wrappersLeft}`);
  // `keep` appends to the last run's frames.
  const more = await t.call('hitchRun', 0.5, [], 5, true);
  t.assert(more.frames === 90, `keep appends: ${more.frames}`);
  // Live frames: start, a few real frames, stop.
  await t.call('frameTrace', 'start');
  await t.realWait(0.3);
  const live = await t.call('frameTrace', 'stop');
  t.assert(live.mode === 'live' && live.frames > 0 && live.wrappersLeft === 0, `live trace: ${live.mode} ${live.frames} frames, ${live.wrappersLeft} wrappers left`);
  const st = await t.call('simulate', 0.5);
  t.finite(st, 'simulate after a trace');
  t.assert((await t.call('status')).mode === 'play', 'still in play');
}
