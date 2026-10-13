// The CIRRUS meeting's talk (skyline-meeting.js): each line in a bubble over its speaker and in the subtitle, the
// action key (real presses) moving it on a line at a time with NEXT LINE offered, and the player able to walk away
// from the table once it is over, also when the scene is ended under him (skyMeetingEnd). Then the whole scene on
// real presses of the action key alone, in under 20 s of game time: every beat with nobody speaking (the walk to the
// lift and the ride, the walk in to his table, the waiter's walks, the folder) moves on too, and nothing is lost.
export const fresh = true;
const report = (t) => t.call('skyMeeting', 'report');
export default async function (t) {
  await t.call('skyMeeting', 'begin');
  await t.call('skyMeetingSkip', 'waiting');
  await t.wait(0.4);
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(0.3);
  let r = await report(t);
  // The scene's first line comes after a short beat (game time).
  for (let i = 0; i < 6 && !r.diplomat.speech; i++) {
    await t.wait(0.2);
    r = await report(t);
  }
  t.assert(r.stage === 'greeted' && r.line && r.diplomat.speech === r.line, 'the door talk began: ' + JSON.stringify(r));
  // His line is a bubble over him.
  let view = await t.call('speechView');
  t.assert(view.bubbles.some((b) => b.text === r.line), 'his line in a bubble: ' + JSON.stringify({ line: r.line, him: r.diplomat, bubbles: view.bubbles }));
  const prompt = await t.call('promptState');
  t.assert(/NEXT LINE/.test(prompt.offered || prompt.text || ''), 'NEXT LINE offered while he talks: ' + JSON.stringify(prompt));
  // E moves it on at once: three lines at the door, three presses.
  await t.call('holdSimulation', true);
  try {
    const first = r.line;
    await t.keys('KeyE', 0.1, { real: true });
    await t.wait(0.1);
    r = await report(t);
    t.assert(r.line && r.line !== first, 'E brought the next line: ' + JSON.stringify({ first, now: r.line }));
    view = await t.call('speechView');
    t.assert(view.bubbles.some((b) => b.text === r.line), 'the player\'s line in a bubble: ' + JSON.stringify({ line: r.line, bubbles: view.bubbles }));
  } finally {
    await t.call('holdSimulation', false);
  }
  // Over the drinks: the talk runs seven lines; E presses take it through quickly.
  await t.call('skyMeetingSkip', 'drinks');
  await t.wait(2);
  r = await report(t);
  t.assert(r.playerSeated && r.stage === 'drinks' && r.talkLine >= 1, 'the talk began: ' + JSON.stringify(r));
  const from = r.talkLine;
  for (let i = 0; i < 4; i++) {
    await t.keys('KeyE', 0.1, { real: true });
    await t.realWait(0.25);
  }
  r = await report(t);
  t.assert(r.talkLine >= from + 3, 'four presses moved the talk on: ' + JSON.stringify({ from, now: r.talkLine }));
  // Done at the table: a movement key stands him up onto clear deck, and he can walk off.
  await t.call('skyMeetingSkip', 'done');
  r = await report(t);
  t.assert(r.playerSeated, 'seated at the end: ' + JSON.stringify(r));
  const chair = r.player;
  // (A movement key stands him up once he has sat for 0.6 s.)
  await t.keys('KeyW', 1.2);
  r = await report(t);
  t.assert(!r.playerSeated && r.playerFree, 'stood up on clear deck: ' + JSON.stringify(r));
  await t.keys('KeyW', 1.5);
  r = await report(t);
  t.assert(Math.hypot(r.player.x - chair.x, r.player.y - chair.y) > 24, 'walked away from the table: ' + JSON.stringify({ chair, now: r.player }));
  // Ended under him (a job abandoned or failed mid-drink): out of the chair onto clear deck.
  await t.call('skyMeetingSkip', 'drinks');
  r = await t.call('skyMeeting', 'end');
  t.assert(!r.playerSeated && r.playerFree, 'the end stood him up free: ' + JSON.stringify(r));
  const there = r.player;
  await t.keys('KeyW', 1);
  r = await report(t);
  t.assert(Math.hypot(r.player.x - there.x, r.player.y - there.y) > 6, 'and he walks: ' + JSON.stringify({ there, now: r.player }));

  // The whole meeting on the action key alone, from the pavement to the envelope: talked to from his far side, out of
  // the lobby door's reach, so the walk to the lift is GO UP WITH (at the door the lift's own prompt does the same).
  await t.call('skyMeeting', 'begin');
  await t.call('skyMeetingSkip', 'waiting');
  const him = (await report(t)).diplomat;
  await t.call('teleport', him.x - 20, him.y + 10);
  await t.call('holdSimulation', true);
  try {
    const STEP = 0.3,
      seen = ['waiting'],
      offered = new Set();
    let game = 0,
      presses = 0;
    r = await report(t);
    while (r.stage !== 'done' && game < 40) {
      const prompt = await t.call('promptState');
      offered.add(prompt.offered || prompt.text || '');
      await t.keys('KeyE', 0.05, { real: true });
      presses++;
      await t.wait(STEP);
      game += STEP;
      r = await report(t);
      if (seen.at(-1) !== r.stage) seen.push(r.stage);
    }
    t.note(`the whole meeting: ${presses} presses, ${game.toFixed(1)} s of game time; stages ${seen.join(' > ')}`);
    t.assert(r.stage === 'done' && game <= 20, 'E alone did not get through the meeting in 20 s: ' + JSON.stringify({ game, presses, seen, r }));
    t.assert(seen.join(' > ') === 'waiting > greeted > lift > terrace > seated > drinks > handover > done', 'the stages out of order: ' + seen.join(' > '));
    t.assert(r.drinks === 2 && r.talkDone && r.handedOver && r.props.includes('envelope') && !r.props.includes('card'), 'the scene lost a beat: ' + JSON.stringify(r));
    t.assert([...offered].some((o) => /SKIP AHEAD/.test(o)) && [...offered].some((o) => /GO UP WITH/.test(o)), 'SKIP AHEAD and GO UP offered: ' + JSON.stringify([...offered]));
  } finally {
    await t.call('holdSimulation', false);
  }
}
