// Mission 2: walking out mid-job before any alarm leaves the job waiting upstairs; with the
// cover blown, reaching the street while Vescari stands fails it (Vescari got away), and
// the retry starts on a calm terrace with no stars.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true); // the bodyguards open fire once the cover is blown
  try {
    // Down the lift before doing anything: the job waits upstairs.
    await t.call('roofPlace', 60, 290);
    await t.call('interact');
    await t.wait(3);
    let m = await t.call('missionState');
    t.assert(m.index === 1 && m.stage === 2 && !m.last, 'a quiet walk-out ended the job: ' + JSON.stringify(m));

    // Back up, blow the cover with a drawn pistol, and leave once the lift is back.
    await t.call('roofPlace', 60, 290);
    await t.keys('KeyF', 0.2);
    let s = await t.call('roofStealth');
    t.assert(s.alarm, 'the cover held: ' + JSON.stringify(s));
    m = await t.call('missionState');
    t.assert(m.stage === 2 && /TAKE DOWN VESCARI/.test(m.instruction) && !/GET OUT/.test(m.instruction), 'alarm objective: ' + m.instruction);
    await t.wait(10); // security holds the car at the lobby for 9 s
    await t.call('roofPlace', 60, 290);
    await t.call('interact');
    await t.wait(3);
    m = await t.call('missionState');
    t.assert(m.last?.result === 'failed' && m.last.index === 1 && /Vescari got away/.test(m.last.reason), 'no getaway failure: ' + JSON.stringify(m));

    // The retry: a fresh job, no stars, the party calm again.
    m = await t.call('retryMission');
    t.assert(m.index === 1 && m.stage === 0 && m.wanted === 0, 'retry did not restart clean: ' + JSON.stringify(m));
    s = await t.call('roofPlace', 150, 250);
    t.assert(!s.alarm && !s.partyPanic && s.suspicion < 5, 'the terrace is still on alarm: ' + JSON.stringify(s));
    t.assert(s.guards.length === 4 && s.guards.every((g) => g.hp > 0), 'bodyguards not back: ' + JSON.stringify(s.guards));
  } finally {
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
