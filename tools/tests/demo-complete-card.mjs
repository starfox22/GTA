// PUBLIC DEMO (campaign.js): winning mission 4 with the story at its end brings up the DEMO COMPLETE card (thanks,
// the buy note); Escape dismisses it into free roam; it shows once per save, and a save that finished the demo
// before the card was saved with it (or never showed it) brings it up after loading.
export const fresh = true;
export default async function (t) {
  let d = await t.call('demo');
  if (!d.build) {
    t.note('not a demo build: nothing to check');
    return;
  }
  await t.call('storyProgress', 3, false);
  await t.call('fortSkip', 'meet');
  await t.wait(0.5);
  await t.call('skyMeetingSkip', 'done');
  await t.wait(1);
  let s = await t.call('status');
  t.assert(!s.mission && s.completed === 4, 'mission 4 won: ' + JSON.stringify(s));
  for (let i = 0; i < 8 && !(d = await t.call('demo')).cardShown; i++) await t.wait(0.5);
  t.assert(d.cardShown && d.cardSeen && d.storyOver, 'the DEMO COMPLETE card is up: ' + JSON.stringify(d));
  await t.keys('Escape', 0.1, { real: true });
  await t.realWait(0.4);
  d = await t.call('demo');
  s = await t.call('status');
  t.assert(!d.cardShown && s.mode === 'play', 'dismissed into free roam: ' + JSON.stringify({ d, mode: s.mode }));
  // Seated at the table still: a movement key stands him up and he walks off.
  await t.keys('KeyW', 1.2);
  const r = await t.call('skyMeeting', 'report');
  t.assert(!r.playerSeated && r.playerFree !== false, 'free to walk after the card: ' + JSON.stringify(r));
  // Once per save: nothing more comes.
  await t.wait(4);
  d = await t.call('demo');
  t.assert(!d.cardShown && d.cardIn === 0, 'once per save: ' + JSON.stringify(d));
  // A save that finished the demo without the card (an older save) brings it up shortly after it loads.
  d = await t.call('storyProgress', 4, false, true);
  t.assert(d.cardIn > 0, 'owed to an older save: ' + JSON.stringify(d));
  for (let i = 0; i < 8 && !(d = await t.call('demo')).cardShown; i++) await t.wait(0.5);
  t.assert(d.cardShown, 'shown for the older save: ' + JSON.stringify(d));
  await t.keys('Escape', 0.1, { real: true });
  await t.realWait(0.4);
  d = await t.call('demo');
  t.assert(!d.cardShown, 'dismissed again: ' + JSON.stringify(d));
}
