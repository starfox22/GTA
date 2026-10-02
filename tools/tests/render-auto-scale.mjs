// AUTO's dynamic resolution (quality.js ADAPTIVE QUALITY) does not hunt: after creeping up and being slow again
// at once it holds below that scale for a while, so the post targets are not reallocated back and forth.
// Needs the 3D renderer (adaptiveSim returns null on the no-render page: nothing to check there).
export default async function (t) {
  if ((await t.call('renderHiccups')) === null) return;
  await t.call('graphics', 'auto');
  const plan = [
    [4, 66, 20], // 15 fps and GPU-bound: steps down
    [40, 8, 4], // quick again: creeps up after the pause
    [3, 66, 20], // slow at once: down again
  ];
  // A machine on the edge: fast for 40 s, slow for 3 s, twelve times over (the controller before the hold made 77
  // scale changes in this run, each a reallocation of every post target; with it, about 18).
  const hunting = [];
  for (let i = 0; i < 12; i++) hunting.push(...plan.slice(1));
  const run = await t.call('adaptiveSim', [plan[0], ...hunting]);
  t.assert(run && Array.isArray(run.changes), 'adaptiveSim returns the scale changes');
  t.note(JSON.stringify(run));
  t.assert(run.changes.length <= 30, `${run.changes.length} scale changes in the hunting run`);
  t.assert(run.ceiling < 1, 'a ceiling was set after the quick slow-down');
  await t.call('graphics', 'low');
}
