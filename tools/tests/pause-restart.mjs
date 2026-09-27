// The pause menu's RESTART CURRENT JOB: live with a story call waiting or a job running,
// shown disabled (NO JOB TO RESTART) when a demo build has nothing left it can restart.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    let p = await t.call('pauseMenu', true);
    t.assert(p.open && !p.restart.disabled && !p.restart.note, 'restart unavailable with a call waiting: ' + JSON.stringify(p));
    await t.call('pauseMenu', false);
    const demo = await t.call('demo');
    if (!demo.build) {
      t.note('not a demo build: the no-job case is not reachable quickly');
      return;
    }
    // A job past the demo (?dev reaches it), lost: the demo has no job to restart.
    await t.call('startMission', demo.missions);
    p = await t.call('pauseMenu', true);
    t.assert(!p.restart.disabled, 'restart unavailable with a job running: ' + JSON.stringify(p));
    await t.call('pauseMenu', false);
    const car = (await t.call('missionTargets')).car;
    await t.call('teleport', car.x - 500, car.y);
    let m = null;
    for (let i = 0; i < 8 && !m?.last; i++) {
      await t.call('blast', car.x, car.y, 4);
      await t.wait(0.5);
      m = await t.call('missionState');
    }
    t.assert(m.last?.result === 'failed', 'the job did not end: ' + JSON.stringify(m));
    p = await t.call('pauseMenu', true);
    t.assert(p.open && p.restart.disabled && p.restart.note === 'NO JOB TO RESTART', 'restart offered with no job: ' + JSON.stringify(p));
    m = await t.call('retryMission');
    t.assert(!m.index && m.last, 'a disabled restart started a job: ' + JSON.stringify(m));
    await t.call('pauseMenu', false);
  } finally {
    await t.call('holdSimulation', false);
  }
}
