// The pause menu's RESTART CURRENT JOB (story.js restartableJob) restarts the job running or the
// last one failed. With neither (a fresh game with the first call waiting, right after a win, a job
// past the demo) it is shown disabled, NO JOB TO RESTART, and does nothing: a waiting call is taken
// at the payphone (right after winning job 1 it used to start job 2 without its call). The menu's
// line counts the demo's own jobs ("1 of 2 demo jobs complete", not "1 of 16").
export const fresh = true;
async function restartButton(t, done) {
  const p = await t.call('pauseMenu', true);
  t.assert(p.open, 'the pause menu did not open: ' + JSON.stringify(p));
  // A demo counts its own jobs (not "of 16").
  if (done !== undefined) t.assert(p.info.startsWith(done + ' of 2 demo jobs complete'), 'pause info: ' + p.info);
  await t.call('pauseMenu', false);
  return p.restart;
}
// Blasts at the mission vehicle from a safe distance until the job fails.
async function failJob(t) {
  const car = (await t.call('missionTargets')).car;
  await t.call('teleport', car.x - 500, car.y - 30);
  let m = null;
  for (let i = 0; i < 8 && !m?.last; i++) {
    await t.call('blast', car.x, car.y, 4);
    await t.wait(0.5);
    m = await t.call('missionState');
  }
  t.assert(m.last?.result === 'failed', 'the job did not fail: ' + JSON.stringify(m));
  return m;
}
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // A fresh game: the first call waits at the payphone; there is no job to restart.
    const demo = await t.call('demo');
    let r = await restartButton(t, demo.build ? 0 : undefined);
    t.assert(r.disabled && r.note === 'NO JOB TO RESTART', 'fresh game: ' + JSON.stringify(r));
    let m = await t.call('retryMission');
    t.assert(m.mission === null && m.mode === 'play', 'a disabled restart started a job: ' + JSON.stringify(m));

    // Job 1 taken at the payphone: running, it restarts; failed, it still restarts.
    await t.call('teleport', 748, 584);
    await t.call('interact');
    await t.keys('Enter', 0.3, { real: true });
    m = await t.call('missionState');
    t.assert(m.index === 0 && m.stage === 0, 'the call did not start job 1: ' + JSON.stringify(m));
    r = await restartButton(t);
    t.assert(!r.disabled && !r.note, 'job running: ' + JSON.stringify(r));
    await failJob(t);
    r = await restartButton(t);
    t.assert(!r.disabled && !r.note, 'job failed: ' + JSON.stringify(r));
    m = await t.call('retryMission');
    t.assert(m.index === 0 && m.stage === 0, 'the failed job did not restart: ' + JSON.stringify(m));

    // Won (god mode only against the harbor police): no current job. The restart is disabled and
    // job 2's call waits at the payphone.
    await t.call('god', true);
    await t.call('skipToDepotDelivery');
    await t.keys('KeyW', 3);
    await t.wait(4);
    m = await t.call('missionState');
    for (let i = 0; i < 12 && !(m.depotSealed && m.stage >= 5); i++) {
      if (m.stage === 3) {
        await t.call('neutraliseDepotPolice');
        await t.call('placeVehicle', -1664, 4470, Math.PI / 2);
      }
      await t.wait(2);
      m = await t.call('missionState');
    }
    await t.call('neutraliseDepotPolice');
    await t.wait(2);
    await t.call('interact'); // out of the cab
    await t.wait(2);
    await t.call('teleport', -1666, 4540);
    await t.wait(1);
    await t.call('teleport', -1666, 4615);
    await t.wait(7);
    m = await t.call('missionState');
    t.assert(m.last?.result === 'won' && m.completed === 1, 'job 1 not won: ' + JSON.stringify(m));
    await t.call('god', false);
    r = await restartButton(t, demo.build ? 1 : undefined);
    t.assert(r.disabled && r.note === 'NO JOB TO RESTART', 'after a win: ' + JSON.stringify(r));
    m = await t.call('retryMission');
    t.assert(m.mission === null && m.last?.result === 'won', 'a restart after the win started a job: ' + JSON.stringify(m));
    const p = await t.call('pointers');
    t.assert(p.payphoneRinging && p.missionIndex === 1, "job 2's call is not waiting: " + JSON.stringify(p));

    // A job past the demo (?dev reaches it), lost: the picker does not offer it, so neither does
    // the restart.
    if (!demo.build) {
      t.note('not a demo build: no gated job to check');
      return;
    }
    await t.call('startMission', demo.missions);
    r = await restartButton(t);
    t.assert(!r.disabled, 'a running job cannot be restarted: ' + JSON.stringify(r));
    await failJob(t);
    r = await restartButton(t);
    t.assert(r.disabled && r.note === 'NO JOB TO RESTART', 'restart offered for a gated job: ' + JSON.stringify(r));
    m = await t.call('retryMission');
    t.assert(m.mission === null && m.last, 'a disabled restart started a job: ' + JSON.stringify(m));
  } finally {
    await t.call('holdSimulation', false);
  }
}
