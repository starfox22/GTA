// CHOOSE MISSION while a job runs asks first (campaign.js ABANDON CONFIRM): ABANDON <JOB>? over the
// picker, ABANDON JOB focused. Escape keeps playing (the job untouched, back in play); Enter abandons
// it for the pick, whose call comes up as ever, and RESTART CURRENT JOB can bring the abandoned job back.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('startMission', 0);
    await t.call('boardMissionVehicle');
    await t.wait(0.3);
    let m = await t.call('missionState');
    t.assert(m.index === 0 && m.stage === 1, 'job 1 not under way: ' + JSON.stringify(m));
    // From the pause menu's CHOOSE MISSION: the confirm, not a silent reset.
    await t.call('pauseMenu', true);
    let c = await t.call('chooseMission', 0);
    t.assert(!c.chosen && c.mode === 'missions' && c.index === 0 && c.stage === 1, 'the pick did not wait for an answer: ' + JSON.stringify(c));
    const a = c.abandonConfirm;
    t.assert(a && a.title === 'ABANDON DOCKSIDE FAVOR?' && /^ABANDON JOB/.test(a.yes) && /^KEEP PLAYING/.test(a.no) && a.focused === 'abandonYes', 'confirm: ' + JSON.stringify(a));
    // Escape: keep playing.
    await t.keys('Escape', 0.2, { real: true });
    let s = await t.call('status');
    m = await t.call('missionState');
    t.assert(s.mode === 'play' && m.index === 0 && m.stage === 1, 'Escape did not go back to the job: ' + JSON.stringify({ mode: s.mode, m }));
    // Enter: abandon for the pick; its call comes up.
    c = await t.call('chooseMission', 0);
    t.assert(c.abandonConfirm && c.mode === 'missions', 'no confirm the second time: ' + JSON.stringify(c));
    await t.keys('Enter', 0.2, { real: true });
    s = await t.call('status');
    m = await t.call('missionState');
    t.assert(s.mode === 'dialogue' && !m.index && m.index !== 0 && m.last?.result === 'abandoned', 'Enter did not abandon for the pick: ' + JSON.stringify({ mode: s.mode, m }));
    await t.keys('Escape', 0.2, { real: true }); // hang up
    const p = await t.call('pauseMenu', true);
    t.assert(!p.restart.disabled, 'the abandoned job cannot be restarted: ' + JSON.stringify(p));
    await t.call('pauseMenu', false);
    m = await t.call('retryMission');
    t.assert(m.index === 0 && m.stage === 0, 'RESTART did not bring the abandoned job back: ' + JSON.stringify(m));
    // The console's answer path (touch and gamepad press the same buttons).
    c = await t.call('chooseMission', 0);
    c = await t.call('abandonJob', false);
    t.assert(!c.chosen && c.mode === 'play' && c.index === 0 && !c.abandonConfirm, 'KEEP PLAYING: ' + JSON.stringify(c));
  } finally {
    await t.call('holdSimulation', false);
  }
}
