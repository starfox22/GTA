// God mode's two cheat codes (game-input.js CHEAT CODE), typed with real key presses: GODMODE and
// AAAAXBBBBYXXXXAYYYYB both toggle it, in either case (Shift for capitals is ignored, not a break),
// each toggle plays its splash card, and the A key still steers while the long code is only begun (it eats keys from its X on).
export const fresh = true;
const LONG = 'AAAAXBBBBYXXXXAYYYYB';
async function type(t, text, shift = false) {
  for (const ch of text) await t.keys(shift ? ['ShiftLeft', 'Key' + ch] : ['Key' + ch], 0.04, { real: true });
}
export default async function (t) {
  const god = async () => (await t.call('godPanel')).godMode;
  await t.call('god', false);
  await t.call('teleport', 1152, 1300);
  t.assert(!(await god()), 'god mode should start off');
  // Two taps of A on foot both move the player: the second is not eaten by the code's prefix.
  let s = await t.call('status');
  const x0 = s.x;
  await t.keys('KeyA', 0.5, { real: true });
  s = await t.call('status');
  const x1 = s.x;
  await t.keys('KeyA', 0.5, { real: true });
  s = await t.call('status');
  t.note(`A taps: x ${x0} → ${x1} → ${s.x}`);
  t.assert(x1 < x0 - 2 && s.x < x1 - 2, 'both A taps should walk the player left: ' + [x0, x1, s.x].join(' → '));
  // The long code in lower case (after those stray A's): god mode on, Settings · GOD MODE opens.
  await type(t, LONG);
  await t.realWait(0.3);
  t.assert(await god(), 'AAAAXBBBBYXXXXAYYYYB did not turn god mode on');
  s = await t.call('status');
  t.note('after the code: mode ' + s.mode);
  t.assert(s.mode === 'settings', 'god mode should open its settings tab: ' + s.mode);
  // The splash (god-splash.js) plays over Settings.
  let splash = await t.call('godSplash');
  t.assert(splash.shown && splash.kind === 'on' && splash.title === 'GOD MODE ACTIVATED!', 'no ON splash: ' + JSON.stringify(splash));
  // Back to play.
  for (let i = 0; i < 3 && (await t.call('status')).mode !== 'play'; i++) {
    await t.keys('Escape', 0.05, { real: true });
    await t.realWait(0.3);
  }
  t.assert((await t.call('status')).mode === 'play', 'Escape did not return to play');
  // Capitals (Shift held) toggle it off again.
  await type(t, LONG, true);
  await t.realWait(0.3);
  t.assert(!(await god()), 'the code in capitals did not turn god mode off');
  splash = await t.call('godSplash');
  t.assert(splash.shown && splash.kind === 'off' && splash.title === 'GOD MODE DEACTIVATED', 'no OFF splash: ' + JSON.stringify(splash));
  // It plays out by itself (2.6 s of CSS animation) and leaves the screen.
  await t.realWait(3.2);
  splash = await t.call('godSplash');
  t.assert(!splash.shown && splash.kind === null, 'the OFF splash did not go away: ' + JSON.stringify(splash));
  // GODMODE still works.
  await type(t, 'GODMODE');
  await t.realWait(0.3);
  t.assert(await god(), 'GODMODE no longer turns god mode on');
  for (let i = 0; i < 3 && (await t.call('status')).mode !== 'play'; i++) {
    await t.keys('Escape', 0.05, { real: true });
    await t.realWait(0.3);
  }
  await t.call('god', false);
}
