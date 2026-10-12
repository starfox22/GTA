// Mission briefs (mission-brief.js): mission 3 opens with its sentence after the title card, it reads for a few
// seconds and folds into the pager strip; the mission card key folds one early; a new step brings the next; Escape
// clears the middle of the screen (a brief, or the title card with the brief behind it) without pausing, and pauses
// as before when there is nothing to clear.
export const fresh = true;
export default async function (t) {
  await t.call('startMission', 2);
  let b = await t.call('missionBrief');
  t.assert(b.queued === 'Vinny asked you to collect a package hidden at the top of the mountain.', 'queued behind the title card: ' + JSON.stringify(b));
  await t.wait(3.5);
  b = await t.call('missionBrief');
  t.assert(b.phase === 'show' && b.kicker === 'THE JOB' && b.left > 0 && b.left <= 6.5, 'on screen, not for long: ' + JSON.stringify(b));
  await t.wait(b.left + 1.2);
  b = await t.call('missionBrief');
  t.assert(b.phase === 'idle', 'folded away after its reading time: ' + JSON.stringify(b));
  const card = await t.call('missionCard');
  t.assert(/top of the mountain/i.test(card.objective || card.text || JSON.stringify(card)), 'the strip keeps the objective: ' + JSON.stringify(card));
  // The next step, folded early with the mission card key.
  await t.call('summitSkip', 'summit');
  await t.wait(0.5);
  b = await t.call('missionBrief');
  t.assert(b.phase === 'show' && /summit/.test(b.text), 'the summit brief: ' + JSON.stringify(b));
  await t.keys('KeyO', 0.2, { real: true });
  await t.wait(1.2);
  b = await t.call('missionBrief');
  t.assert(b.phase === 'idle', 'O folded it: ' + JSON.stringify(b));
  // Escape folds a brief at once and does not pause (the opening brief again, after its title card).
  await t.call('startMission', 2);
  b = await t.call('missionBrief');
  for (let i = 0; i < 12 && b.phase !== 'show'; i++) {
    await t.wait(0.5);
    b = await t.call('missionBrief');
  }
  t.assert(b.phase === 'show', 'a brief to fold: ' + JSON.stringify(b));
  await t.keys('Escape', 0.1, { real: true });
  await t.realWait(0.3);
  b = await t.call('missionBrief');
  let mode = (await t.call('status')).mode;
  t.assert(b.phase !== 'show' && mode === 'play', 'Escape folded the brief, no pause: ' + JSON.stringify({ b, mode }));
  // The title card with the opening brief behind it: one Escape clears both.
  await t.call('startMission', 2);
  await t.wait(0.5);
  b = await t.call('missionBrief');
  t.assert(b.queued && b.phase !== 'show', 'the brief waits behind the title card: ' + JSON.stringify(b));
  await t.keys('Escape', 0.1, { real: true });
  await t.realWait(0.3);
  await t.wait(0.5);
  b = await t.call('missionBrief');
  mode = (await t.call('status')).mode;
  t.assert(!b.queued && b.phase !== 'show' && mode === 'play', 'Escape cleared the title card and the brief: ' + JSON.stringify({ b, mode }));
  // Nothing in the middle: Escape pauses, and again resumes.
  await t.keys('Escape', 0.1, { real: true });
  await t.realWait(0.3);
  mode = (await t.call('status')).mode;
  t.assert(mode === 'pause', 'Escape with nothing to clear pauses: ' + mode);
  await t.keys('Escape', 0.1, { real: true });
  await t.realWait(0.3);
  mode = (await t.call('status')).mode;
  t.assert(mode === 'play', 'and resumes: ' + mode);
}
