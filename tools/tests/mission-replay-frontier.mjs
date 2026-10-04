// A replay picked with job 1 done (campaign.js chooseMission) that is hung up on or failed gives the
// payphone back to the story's frontier, job 2 (it used to offer the replayed job again);
// RESTART CURRENT JOB still retries the failed replay, and a save made mid-replay reloads at the
// frontier with nothing to restart. The demo gate is live (no ?dev).
export const flags = 'test';
export const fresh = true;
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
async function frontier(t, label) {
  const p = await t.call('pointers');
  t.assert(p.payphoneRinging && p.missionIndex === 1 && p.completed === 1 && p.objective, `${label}: the payphone is not job 2's: ` + JSON.stringify(p));
  const card = await t.call('missionCard');
  t.assert(card.counter === 'MISSION 2' && /^PAYPHONE · /.test(card.distance), `${label}: card ` + JSON.stringify(card));
}
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // Job 1 won (god mode only against the harbor police; the gate is back afterwards).
    await t.call('god', true);
    await t.call('skipToDepotDelivery');
    await t.keys('KeyW', 3);
    await t.wait(4);
    let m = await t.call('missionState');
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
    await frontier(t, 'after the win');

    // A replay of job 1 picked and hung up on: job 2's call again.
    const c = await t.call('chooseMission', 0);
    t.assert(c.chosen && c.mode === 'dialogue' && c.missionIndex === 0, 'replay call not up: ' + JSON.stringify(c));
    await t.keys('Escape', 0.3, { real: true });
    m = await t.call('missionState');
    t.assert(!m.mission, 'HANG UP started the job: ' + JSON.stringify(m));
    await frontier(t, 'after HANG UP');

    // The replay accepted, then failed: job 2's call again, and the line does not send the
    // player to the payphone for a retry; RESTART CURRENT JOB retries the replay.
    await t.call('chooseMission', 0);
    await t.keys('Enter', 0.3, { real: true });
    m = await t.call('missionState');
    t.assert(m.index === 0 && m.stage === 0, 'the replay did not start: ' + JSON.stringify(m));
    await failJob(t);
    await frontier(t, 'after a failed replay');
    const lines = (await t.call('notices')).map((n) => n.text);
    t.assert(lines.some((l) => /Retry it from the pause menu\.$/.test(l)) && !lines.some((l) => /Return to the payphone/.test(l)), 'failed replay line: ' + JSON.stringify(lines));
    const p = await t.call('pauseMenu', true);
    t.assert(!p.restart.disabled, 'no restart for the failed replay: ' + JSON.stringify(p));
    await t.call('pauseMenu', false);
    m = await t.call('retryMission');
    t.assert(m.index === 0 && m.stage === 0, 'RESTART did not retry the replay: ' + JSON.stringify(m));

    // A reload mid-replay (the save holds the replay's index): the frontier, nothing to restart,
    // and the payphone offers job 2.
    await t.reload({ keep: true });
    await frontier(t, 'after a reload mid-replay');
    const after = await t.call('pauseMenu', true);
    t.assert(after.restart.disabled && after.restart.note === 'NO JOB TO RESTART', 'restart after the reload: ' + JSON.stringify(after));
    await t.call('pauseMenu', false);
    await t.call('teleport', 748, 584);
    await t.call('interact');
    const s = await t.call('status');
    t.assert(s.mode === 'dialogue', 'the payphone did not ring through: ' + JSON.stringify(s));
    await t.keys('Enter', 0.3, { real: true });
    m = await t.call('missionState');
    t.assert(m.index === 1 && m.stage === 0, 'the payphone did not start job 2: ' + JSON.stringify(m));
  } finally {
    await t.call('holdSimulation', false);
  }
}
