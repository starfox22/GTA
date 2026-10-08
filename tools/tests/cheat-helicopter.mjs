// Cheat codes typed with real key presses (game-input.js CHEAT CODE): HELICOPTER parks an authorized
// helicopter on clear ground beside the player (never on top of him), and its H then E (horn, then the
// action key) are not eaten; AAAAXBBBBYXXXXAYYYYB is switched off; GODMODE adds GOD_MODE_CASH.
export const fresh = true;
async function type(t, text) {
  for (const ch of text) await t.keys(['Key' + ch], 0.04, { real: true });
}
export default async function (t) {
  const god = async () => (await t.call('godPanel')).godMode;
  await t.call('god', false);
  await t.call('teleport', 1152, 1300);
  const before = (await t.call('vehiclesNear', 70)).filter((v) => v.type === 'helicopter').length;
  await type(t, 'HELICOPTER');
  await t.realWait(0.3);
  const near = (await t.call('vehiclesNear', 70)).filter((v) => v.type === 'helicopter');
  t.note('helicopters near: ' + JSON.stringify(near));
  t.assert(near.length === before + 1, 'HELICOPTER did not park one helicopter nearby');
  const heli = near[0];
  t.assert(heli.metres >= 8 && heli.authorized && !heli.driven, 'helicopter too close, stolen or driven: ' + JSON.stringify(heli));
  t.assert((await t.call('status')).mode === 'play', 'the code left play');
  // The long pad-style code no longer toggles god mode.
  await type(t, 'AAAAXBBBBYXXXXAYYYYB');
  await t.realWait(0.3);
  t.assert(!(await god()), 'AAAAXBBBBYXXXXAYYYYB still turns god mode on');
  // GODMODE adds a million dollars.
  await t.call('setCash', 500);
  await type(t, 'GODMODE');
  await t.realWait(0.3);
  t.assert(await god(), 'GODMODE did not turn god mode on');
  const s = await t.call('status');
  t.assert(s.cash === 1000500, 'god mode did not add $1,000,000: ' + s.cash);
  for (let i = 0; i < 3 && (await t.call('status')).mode !== 'play'; i++) {
    await t.keys('Escape', 0.05, { real: true });
    await t.realWait(0.3);
  }
  await t.call('god', false);
}
