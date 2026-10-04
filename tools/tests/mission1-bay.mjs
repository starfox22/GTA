// Mission 1's harbour bay fight, no god mode (combat-rules.js MISSION CAGE): a prompt run (drive in,
// load, turn out) leaves the truck about half wrecked as it always has; a hesitant first try (E while
// still rolling, a look round, a load cancelled by a throttle nudge, a wrong turn) gets out with the
// truck damaged, not blown up; a critical job truck says so with a headline and repeated warnings.
// Measured over several runs: prompt 38-52 %, hesitant 28-30 % (it used to blow up at ~30 s).
export const fresh = true;
async function stop(t) {
  for (let i = 0; i < 20; i++) {
    const v = await t.call('missionTargets');
    if (!v?.car || Math.abs(v.car.speed) < 3) return;
    await t.keys(v.car.speed > 0 ? 'KeyS' : 'KeyW', 0.15);
  }
}
// From the job's start to a stop in the loading bay.
async function toBay(t) {
  await t.call('boardMissionVehicle');
  await t.call('placeVehicle', 2300, 1664, 0);
  const gate = await t.call('steerTo', 2760, 1664, 25, 40);
  t.assert(gate.reason === 'arrived', 'the truck did not reach the barrier: ' + JSON.stringify(gate));
  const bay = await t.call('steerTo', 3210, 1520, 25, 30);
  t.assert(bay.reason === 'arrived', 'the truck did not reach the bay: ' + JSON.stringify(bay));
}
async function loaded(t, seconds) {
  let m = null;
  for (let i = 0; i < seconds; i++) {
    await t.wait(1);
    m = await t.call('missionTargets');
    if (!m || m.stage === 3) break;
  }
  t.assert(m?.stage === 3, 'the crates were not loaded: ' + JSON.stringify(m && { stage: m.stage, car: m.car }));
  return m;
}
// Out through the barrier: the turn out of the bay and the gate (the truck's health is read there),
// then the street beyond (police units rolling up to the gate can hold the console pilot there).
async function leave(t, via = []) {
  for (const [x, y] of [...via, [3000, 1600], [2780, 1664]]) {
    const r = await t.call('steerTo', x, y, 15, 40, true);
    t.assert(r, `out of the truck on the way to ${x},${y}`);
  }
  const m = await t.call('missionTargets');
  t.assert(m && m.stage === 3 && m.car.driver && m.player.x < 2830, 'not through the harbour barrier with the truck: ' + JSON.stringify(m && { stage: m.stage, player: m.player, car: m.car }));
  await t.call('steerTo', 2400, 1664, 10, 60, true);
  return Math.round((100 * m.car.hp) / m.car.maxhp);
}
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('god', false);
    // The prompt run.
    await t.call('startMission', 0);
    await toBay(t);
    await stop(t);
    await t.call('interact');
    await loaded(t, 10);
    const prompt = await leave(t);
    t.near(prompt, 33, 62, 'prompt run: truck health % at the barrier');

    // The hesitant first try.
    let m = await t.call('retryMission');
    t.assert(m.index === 0 && m.stage === 0, 'the retry did not restart the job: ' + JSON.stringify(m));
    await toBay(t);
    await t.call('interact'); // still rolling: "Stop the truck inside the marked loading bay."
    await stop(t);
    await t.wait(2); // a look round
    await t.call('interact');
    await t.wait(3.5);
    await t.keys('KeyW', 0.4); // a nudge on the throttle cancels the load
    await stop(t);
    await t.call('interact');
    await loaded(t, 12);
    const hesitant = await leave(t, [[3260, 1460]]); // a wrong turn north into the yard first
    t.near(hesitant, 12, 60, 'hesitant run: truck health % at the barrier');

    // Critical: a headline and the bail-out warning (every 3 s for a job's vehicle).
    m = await t.call('vehicleHealth', 25.5);
    t.assert(m.mission && m.percent <= 26, 'not critical: ' + JSON.stringify(m));
    await t.wait(0.4);
    const card = await t.call('missionCard');
    const lines = (await t.call('notices')).map((n) => n.text);
    t.assert(card.announce === 'CRITICAL DAMAGE', 'no critical headline: ' + JSON.stringify(card));
    t.assert(lines.some((l) => /BAIL OUT \(E\) BEFORE IT GOES UP$/.test(l)), 'no bail-out warning: ' + JSON.stringify(lines));
  } finally {
    await t.call('holdSimulation', false);
  }
}
