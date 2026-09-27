// Police response needs someone to know: an unwitnessed kill brings no stars, a patrol that sees it
// does at once, a civilian witness phones 911 and the star comes only when the call ends; killing the
// caller mid-call or the god panel's Lose police stops it; a carjacked driver calls it in.
export const fresh = true;
// Foothill Road in the county: no street crowd, no traffic police near.
const SPOT = [6720, 4350];

async function stage(t, witnesses, police) {
  await t.call('wanted', 0);
  await t.call('teleport', ...SPOT);
  await t.wait(0.5);
  return t.call('witnessStage', witnesses, police);
}
async function shootVictim(t, s, shots = 3) {
  for (let i = 0; i < shots; i++) {
    await t.call('fireShot', s.victim.x, s.victim.y);
    await t.wait(0.4);
  }
}
const stars = async (t) => (await t.call('witnesses')).stars;
// Advance the game a second at a time until `test` returns something truthy (or give up).
async function waitFor(t, seconds, test) {
  for (let i = 0; i < seconds; i++) {
    const got = await test();
    if (got) return got;
    await t.wait(1);
  }
  return test();
}
const playerCall = async (t) => (await t.call('witnesses')).calls.find((c) => c.about === 'player' && !c.reported);

export default async function (t) {
  await t.call('god', true);
  await t.call('arm', 0);

  // 1. Nobody saw or heard it: no star, the kill waits as an unreported crime.
  let s = await stage(t, 0, false);
  await shootVictim(t, s);
  let w = await t.call('witnesses');
  t.assert(w.unreported.some((r) => r.victims >= 1), 'kill not banked: ' + JSON.stringify(w.unreported));
  await t.wait(20);
  t.assert((await stars(t)) === 0, 'stars with nobody around: ' + JSON.stringify(await t.call('witnesses')));

  // 2. A crewed patrol car sees it: the star is immediate.
  s = await stage(t, 0, true);
  t.assert(s.police, 'no patrol car staged');
  await t.call('fireShot', s.victim.x, s.victim.y);
  await t.wait(0.3);
  t.assert((await stars(t)) >= 1, 'patrol saw the shooting but no star');

  // 3. One civilian witness: nothing until their 911 call ends.
  s = await stage(t, 1, false);
  await shootVictim(t, s);
  await t.wait(1.5);
  t.assert((await stars(t)) === 0, 'star before any call');
  let call = await waitFor(t, 35, () => playerCall(t));
  t.assert(call, 'the witness never phoned: ' + JSON.stringify(await t.call('witnesses')));
  t.note(`call started, ${call.callSeconds} s long, ${call.d} units off`);
  t.assert((await stars(t)) === 0, 'star while the call was going');
  const reported = await waitFor(t, 20, async () => (await stars(t)) >= 1);
  t.assert(reported, 'no star after the call ended');
  w = await t.call('witnesses');
  t.assert(w.response && Math.abs(w.response.x - s.player.x) < 400 && Math.abs(w.response.y - s.player.y) < 400, 'response not sent to the scene: ' + JSON.stringify(w.response));

  // 4. The caller is shot mid-call: the call never ends, no star.
  s = await stage(t, 1, false);
  await shootVictim(t, s);
  call = await waitFor(t, 35, () => playerCall(t));
  t.assert(call, 'no call to interrupt');
  await t.call('teleport', call.x, call.y - 150);
  for (let i = 0; i < 4; i++) {
    await t.call('fireShot', call.x, call.y);
    await t.wait(0.3);
  }
  await t.wait(20);
  w = await t.call('witnesses');
  t.assert(w.stars === 0, 'caller shot mid-call but a star came up: ' + JSON.stringify(w));

  // 5. God panel Lose police while a witness is on the phone: the call comes to nothing.
  s = await stage(t, 1, false);
  await shootVictim(t, s);
  call = await waitFor(t, 35, () => playerCall(t));
  t.assert(call, 'no call for the god panel test');
  await t.call('godLosePolice');
  await t.wait(18);
  t.assert((await stars(t)) === 0, 'godLosePolice left a call in progress');

  // 6. A carjacked driver gets up, gets clear and phones 911.
  await stage(t, 0, false);
  const car = await t.call('carjackTarget', 'sedan', 'flee');
  t.assert(car, 'no car to take');
  await t.call('interact');
  await t.wait(2.6); // the struggle at the door, then the seat (carjack-struggle.js)
  w = await t.call('witnesses');
  t.assert(w.stars === 0 && w.incidents.some((i) => i.kind === 'carjack'), 'carjack not left to a witness: ' + JSON.stringify(w));
  await t.keys('KeyW', 3);
  const called = await waitFor(t, 40, async () => (await stars(t)) >= 1);
  t.assert(called, 'the carjacked driver never called it in: ' + JSON.stringify(await t.call('witnesses')));
  await t.call('wanted', 0);
  await t.call('god', false);
}
