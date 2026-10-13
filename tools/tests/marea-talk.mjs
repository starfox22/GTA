// A chat at the Marea (clubtalk.js): started next to a club-goer, every line is a talk line in a bubble over its
// speaker (crowd-speech.js TALK LINES), the player's own lines also in the subtitle, and the real action key moves
// it on (NEXT LINE).
export const fresh = true;
export default async function (t) {
  await t.call('teleport', -2870, 5420);
  await t.wait(6);
  // Hands empty, or the club-goers put theirs up.
  await t.keys('Digit8', 0.2, { real: true });
  await t.wait(1);
  let near = null;
  for (let i = 0; i < 4 && !near; i++) {
    near = await t.call('clubTalkApproach');
    if (!near) await t.wait(3);
  }
  t.assert(near, 'someone to talk to at the Marea');
  let c = await t.call('clubTalk');
  for (let i = 0; i < 4 && !c.active; i++) {
    await t.wait(2);
    await t.keys('KeyE', 0.2, { real: true });
    await t.realWait(0.5);
    c = await t.call('clubTalk');
  }
  t.assert(c.active, 'a conversation started: ' + JSON.stringify(c));
  let sawPlayer = false,
    sawNpc = false;
  for (let i = 0; i < 14 && c.active; i++) {
    const line = c.active.line;
    if (line >= 0) {
      const said = c.active.lines[line],
        text = said.replace(/^(PLAYER|NPC): /, ''),
        mine = said.startsWith('PLAYER'),
        bubble = c.bubbles.find((b) => b.text === text);
      t.assert(bubble && bubble.who === (mine ? 'player' : 'club-goer'), 'line ' + line + ' in a bubble over its speaker: ' + JSON.stringify({ said, bubbles: c.bubbles }));
      if (mine) {
        sawPlayer = true;
        t.assert(c.subtitle === 'YOU: ' + text, "the player's line in the subtitle: " + JSON.stringify({ text, subtitle: c.subtitle }));
      } else sawNpc = true;
    }
    await t.keys('KeyE', 0.1, { real: true });
    await t.realWait(0.3);
    c = await t.call('clubTalk');
  }
  t.assert(sawNpc && sawPlayer, 'both sides seen: ' + JSON.stringify({ sawNpc, sawPlayer }));
}
