// The CIRRUS meeting scene (skyline-meeting.js): the diplomat at EVOLUTION's door, talked to with the real
// action key, the lift up together (he arrives beside the player), his reserved table, sitting down, the
// waiter's two cocktails and the sips, the handover, 'done', standing up, and skyMeetingEnd leaving nothing.
export const fresh = true;
const report = (t) => t.call('skyMeeting', 'report');
async function until(t, label, test, seconds, step = 1) {
  let r = await report(t);
  for (let s = 0; s < seconds && !test(r); s += step) {
    await t.wait(step);
    r = await report(t);
  }
  t.assert(test(r), label + ': ' + JSON.stringify(r));
  return r;
}
export default async function (t) {
  let r = await t.call('skyMeeting', 'begin');
  t.assert(r.active && r.stage === 'waiting' && r.actors === 1 && r.diplomat.altitude < 5, 'begun: ' + JSON.stringify(r));
  t.assert(r.target && Math.hypot(r.target.x - r.diplomat.x, r.target.y - r.diplomat.y) < 1, 'target is the diplomat: ' + JSON.stringify(r.target));
  // At the door: TALK TO VARGA, with the real action key.
  await t.call('skyMeetingSkip', 'waiting');
  await t.wait(0.4);
  let prompt = await t.call('promptState');
  t.assert(/TALK TO VARGA/.test(prompt.offered || ''), 'door prompt: ' + JSON.stringify(prompt));
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(1);
  r = await report(t);
  t.assert(r.stage === 'greeted' && /Vinny/.test(r.line || ''), 'greeted: ' + JSON.stringify(r));
  // He talks for a few seconds, then waits at the lobby door.
  r = await until(t, 'waits at the lobby', (q) => q.diplomat.pose === 'wait' && !q.line, 14);
  t.assert(Math.hypot(r.diplomat.x - r.target.x, r.diplomat.y - r.target.y) < 20, 'by the lobby door: ' + JSON.stringify(r));
  // The lift, with the real key at the lobby door: one ride, he steps out beside the player.
  await t.call('skylineVisit', 'lobby-bar');
  await t.wait(0.3);
  prompt = await t.call('promptState');
  t.assert(/ELEVATOR TO CIRRUS/.test(prompt.offered || ''), 'lobby prompt: ' + JSON.stringify(prompt));
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(0.5);
  r = await report(t);
  // In the car with the player (hidden), or already stepped out beside him at the dark moment.
  t.assert(r.stage === 'lift' && (r.diplomat.hidden || r.diplomat.altitude > 1000), 'riding together: ' + JSON.stringify(r));
  await t.wait(3.2);
  r = await report(t);
  t.assert(r.stage === 'terrace' && r.player.roof === 'evolution' && !r.diplomat.hidden, 'on the terrace: ' + JSON.stringify(r));
  t.assert(Math.abs(r.diplomat.altitude - r.player.altitude) < 1 && Math.hypot(r.diplomat.x - r.player.x, r.diplomat.y - r.player.y) < 40, 'he arrived with the player: ' + JSON.stringify(r));
  t.note('arrival: ' + JSON.stringify({ him: r.diplomat, you: r.player }));
  // He walks to his table and sits; the other tables have guests, his has none.
  r = await until(t, 'seated at his table', (q) => q.diplomat.sitting, 15);
  const bar = (await t.call('skyline')).bar;
  t.assert(bar.live && bar.people >= 10, 'the terrace lives on: ' + JSON.stringify(bar));
  // Walk up to the chair facing him and sit.
  const seat = r.target;
  await t.call('walk', Math.atan2(seat.y - 10 - r.player.y, seat.x - r.player.x), Math.hypot(seat.x - r.player.x, seat.y - 10 - r.player.y));
  await t.wait(0.3);
  prompt = await t.call('promptState');
  t.assert(/SIT WITH VARGA/.test(prompt.offered || ''), 'table prompt: ' + JSON.stringify(prompt));
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(0.5);
  r = await report(t);
  t.assert(r.stage === 'seated' && r.playerSeated && Math.hypot(r.player.x - seat.x, r.player.y - seat.y) < 0.5, 'sat in the chair: ' + JSON.stringify(r));
  t.assert(Math.abs(Math.cos(r.seat.a) - Math.sign(r.diplomat.x - r.player.x)) < 0.01, 'facing him: ' + JSON.stringify(r.seat));
  // The waiter takes the order, fetches the cocktails from the bar and serves them.
  r = await until(t, 'drinks served', (q) => q.stage === 'drinks', 60, 2);
  t.assert(r.drinks === 2 && r.seat.hand === 'cocktail' && r.diplomat.hand === 'cocktail', 'a glass each: ' + JSON.stringify(r));
  let lifted = 0;
  for (let i = 0; i < 20; i++) {
    await t.wait(0.5);
    lifted = Math.max(lifted, (await report(t)).seat.lift);
  }
  t.assert(lifted > 0.9, 'the player raised his glass: ' + lifted);
  // The talk, then the handover with the real key.
  r = await until(t, 'ready to hand over', (q) => q.stage === 'handover', 60, 2);
  prompt = await t.call('promptState');
  t.assert(/HAND OVER THE PAPERS/.test(prompt.offered || ''), 'handover prompt: ' + JSON.stringify(prompt));
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(0.3);
  await t.wait(0.4);
  r = await report(t);
  t.assert(r.seat.hand === 'folder' && r.seat.reach > 0.3, 'the folder across the table: ' + JSON.stringify(r.seat));
  r = await until(t, 'done', (q) => q.stage === 'done', 25);
  t.assert(r.handedOver && r.diplomat.hand === 'folder' && r.props.includes('envelope'), 'he has the folder, the envelope is on the table: ' + JSON.stringify(r));
  // Up with a movement key; he is on his way to the lift.
  await t.keys('KeyW', 0.5);
  r = await report(t);
  t.assert(!r.playerSeated && r.player.roof === 'evolution' && !r.props.includes('envelope'), 'stood up, envelope taken: ' + JSON.stringify(r));
  await until(t, 'he left', (q) => q.diplomat.hidden, 15);
  // Gone without a trace; free roam as before.
  r = await t.call('skyMeeting', 'end');
  t.assert(!r.active && r.actors === 0 && !r.playerSeated && r.props.length === 0, 'nothing left: ' + JSON.stringify(r));
  await t.call('setCash', 100);
  await t.call('skylineVisit', 'bar-counter');
  await t.wait(0.3);
  prompt = await t.call('promptState');
  t.assert(/ORDER A DRINK/.test(prompt.offered || ''), 'the bar as before: ' + JSON.stringify(prompt));
  // A job reset (cleanupMissionExtras) ends a running meeting too.
  await t.call('skyMeetingSkip', 'drinks');
  r = await report(t);
  t.assert(r.playerSeated && r.stage === 'drinks', 'skip to drinks: ' + JSON.stringify(r));
  await t.call('startMission', 0);
  r = await report(t);
  t.assert(!r.active && r.actors === 0 && !r.playerSeated, 'a job start leaves nothing: ' + JSON.stringify(r));
}
