// Street events (livingcity-events.js): a bag snatch staged round the player on Broadway; the
// thief walks up to the victim, grabs, runs (red on the radar); catching him on foot returns
// the bag with a reward and no stars. A second one left alone gets away.
export const fresh = true;
async function stage(t) {
  for (let i = 0; i < 6; i++) {
    const r = await t.call('snatchTest');
    if (r.active) return r;
    await t.wait(2);
  }
  return null;
}
async function untilRun(t) {
  for (let i = 0; i < 30; i++) {
    await t.wait(1);
    const r = await t.call('streetEvents');
    if (!r.active || r.active.phase === 'run') return r;
  }
  return t.call('streetEvents');
}
// A snatch that reaches the grab: the street can call one off (someone takes
// fright at something else first), so up to four tries.
async function stageToRun(t) {
  let run = null;
  for (let k = 0; k < 4; k++) {
    const staged = await stage(t);
    if (!staged) continue;
    run = await untilRun(t);
    if (run.active && run.active.phase === 'run') return run;
    t.note('try ' + k + ': ' + JSON.stringify(run.last));
  }
  return run;
}
export default async function (t) {
  await t.call('god', true);
  await t.call('setClock', 14);
  await t.call('teleport', 1330, 3390);
  await t.wait(3);
  const cashBefore = (await t.call('status')).cash;
  const run = await stageToRun(t);
  t.assert(run.active && run.active.phase === 'run', 'the thief never grabbed: ' + JSON.stringify(run));
  t.assert(run.active.thief.react === 'flee', 'the thief is not running: ' + JSON.stringify(run.active));
  // Catch him: the player right beside the runner.
  const th = run.active.thief;
  await t.call('teleport', th.x - 6, th.y);
  await t.wait(0.5);
  const caught = await t.call('streetEvents');
  const after = await t.call('status');
  t.note(`caught: ${JSON.stringify(caught.last)}, cash ${cashBefore} → ${after.cash}, wanted ${after.wanted}`);
  t.assert(caught.last && caught.last.why === 'caught', 'not caught: ' + JSON.stringify(caught));
  t.assert(after.cash >= cashBefore + 120, 'no reward');
  t.assert(after.wanted === 0, 'catching a thief raised the wanted level');
  // A second one, left alone, gets away.
  await t.call('teleport', 1330, 3390);
  await t.wait(2);
  const run2 = await stageToRun(t);
  t.assert(run2.active && run2.active.phase === 'run', 'the second thief never grabbed');
  for (let i = 0; i < 12; i++) {
    await t.wait(5);
    const r = await t.call('streetEvents');
    if (!r.active) break;
  }
  const end = await t.call('streetEvents');
  t.note(`left alone: ${JSON.stringify(end.last)}`);
  t.assert(end.last && end.last.why === 'escaped', 'the thief did not get away: ' + JSON.stringify(end));
  await t.call('god', false);
}
