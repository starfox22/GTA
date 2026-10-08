// Mission briefs (mission-brief.js): mission 3 opens with its sentence after the title card, it reads for a few
// seconds and folds into the pager strip; the mission card key folds one early; a new step brings the next.
export const fresh = true;
export default async function (t) {
  await t.call('startMission', 2);
  let b = await t.call('missionBrief');
  t.assert(/Vinny asked you to collect a buried package/.test(b.queued || ''), 'queued behind the title card: ' + JSON.stringify(b));
  await t.wait(3.5);
  b = await t.call('missionBrief');
  t.assert(b.phase === 'show' && b.kicker === 'THE JOB' && b.left > 3, 'on screen: ' + JSON.stringify(b));
  await t.wait(b.left + 1.2);
  b = await t.call('missionBrief');
  t.assert(b.phase === 'idle', 'folded away after its reading time: ' + JSON.stringify(b));
  const card = await t.call('missionCard');
  t.assert(/SUMMIT/i.test(card.objective || card.text || JSON.stringify(card)), 'the strip keeps the objective: ' + JSON.stringify(card));
  // The next step, folded early with the mission card key.
  await t.call('summitSkip', 'summit');
  await t.wait(0.5);
  b = await t.call('missionBrief');
  t.assert(b.phase === 'show' && /summit/.test(b.text), 'the summit brief: ' + JSON.stringify(b));
  await t.keys('KeyO', 0.2, { real: true });
  await t.wait(1.2);
  b = await t.call('missionBrief');
  t.assert(b.phase === 'idle', 'O folded it: ' + JSON.stringify(b));
}
