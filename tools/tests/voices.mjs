// Screams match faces (voices.js): a man screams with a man's take and a woman with a
// woman's, the player is a man, and a woman officer never voices the male police lines.
export const fresh = true;
export default async function (t) {
  await t.call('characterLineup', 'stand');
  const r = await t.call('voiceReport', 160);
  t.assert(r.people >= 10, 'lineup not found: ' + r.people + ' people');
  t.assert(r.wrongTake === 0, r.wrongTake + ' people would scream in the other sex\'s voice');
  t.assert(r.mismatches === 0, r.mismatches + ' voices disagree with the rig');
  t.assert(r.womenOnRadio === 0, 'a woman officer voices the male police recordings');
  const me = r.sample.find((q) => q.who === 'player');
  t.assert(me && !me.female && me.sample.includes('-male-'), 'player voice: ' + JSON.stringify(me));
  // The lineup's street man and woman (crowd-reactions.js characterLineup): 5 and 4 spacings left.
  const st = await t.call('status');
  const px = Math.round(st.x ?? st.player?.x ?? 0);
  const at = (dx) => r.sample.find((q) => q.who === 'casual' && Math.abs(q.x - (px + dx)) < 3);
  const man = at(-96),
    woman = at(-77);
  t.assert(man && !man.female && man.sample.includes('-male-'), 'lineup man: ' + JSON.stringify(man));
  t.assert(woman && woman.female && woman.sample.includes('-female-'), 'lineup woman: ' + JSON.stringify(woman));
  // Everyone near screams once through the real path; each take matches the voice's sex.
  const played = await t.call('screamTest', 12);
  t.assert(played.length >= 8, 'too few screamed: ' + played.length);
  for (const p of played) t.assert(p.sample.includes(p.female ? '-female-' : '-male-') || p.who === 'kid', 'wrong take: ' + JSON.stringify(p));
  const log = (await t.call('voiceReport', 160)).screams;
  t.assert(log.length >= 8 && log.every((s) => s.kid || s.sample.includes(s.female ? '-female-' : '-male-')), 'scream log: ' + JSON.stringify(log.slice(-3)));
  t.note(`${r.people} people, ${r.women} women`);
}
