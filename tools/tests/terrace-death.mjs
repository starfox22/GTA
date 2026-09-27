// Killed on the Blue Hour terrace: the body stays up on the terrace for WASTED (it used to
// drop to street level inside the hotel, out of sight), and the respawn is at the hospital
// at street level with the job failed.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('roofPlace', 150, 250);
    await t.keys('KeyF', 0.2); // a drawn pistol: the bodyguards open fire
    let s = await t.call('status');
    for (let i = 0; i < 30 && s.mode !== 'dead'; i++) {
      await t.wait(1);
      s = await t.call('status');
    }
    t.assert(s.mode === 'dead', 'not killed on the terrace: ' + JSON.stringify(s));
    const m = await t.call('missionTargets');
    const fall = await t.call('fallState');
    t.assert(m?.player.roof && fall.altitudeM > 25, 'the body left the terrace: ' + JSON.stringify({ player: m?.player, altitudeM: fall.altitudeM }));
    await new Promise((r) => setTimeout(r, 4800)); // WASTED runs on the wall clock
    s = await t.call('status');
    const after = await t.call('fallState');
    const job = await t.call('missionState');
    t.assert(s.mode === 'play' && after.altitudeM < 1 && !job.mission && job.last?.result === 'failed', 'bad respawn: ' + JSON.stringify({ s, altitudeM: after.altitudeM, job }));
  } finally {
    await t.call('holdSimulation', false);
  }
}
