// Witness 911 calls that bring the chase: a killing watched by Monarch Isle's own walkers gets phoned
// in within seconds (phone out, a 911 line in the bubble), the star comes when the call ends and the
// first unit is on its way straight after, sent to the player the caller can see; nobody around, no star.
export const fresh = true;
// Crown Avenue by the shops on Monarch Isle, and Foothill Road in the county (nobody about).
const MONARCH = [6700, -2990];
const COUNTY = [6720, 4350];

async function shoot(t, target, shots = 3) {
  for (let i = 0; i < shots; i++) {
    await t.call('fireShot', target.x, target.y);
    await t.wait(0.3);
  }
}
const playerCall = (w) => w.calls.find((c) => c.about === 'player' && !c.waiting);
const nearestUnit = (report) => (report.units.length ? Math.min(...report.units.map((u) => u.d)) : Infinity);

export default async function (t) {
  await t.call('god', true);
  await t.call('arm', 0);
  await t.call('setClock', 13);
  await t.call('holdSimulation', true);

  // 1. Nobody saw or heard it: the kill is banked, no star.
  await t.call('wanted', 0);
  await t.call('teleport', ...COUNTY);
  await t.wait(0.5);
  let s = await t.call('witnessStage', 0, false);
  await shoot(t, s.victim);
  await t.wait(12);
  let w = await t.call('witnesses');
  t.assert(w.stars === 0 && !w.response, 'stars with nobody around: ' + JSON.stringify(w));

  // 2. Monarch Isle: three island walkers watch a killing (their own routine used to swallow what they saw).
  await t.call('wanted', 0);
  await t.call('teleport', ...MONARCH);
  await t.wait(0.5);
  s = await t.call('witnessStage', 3, false, 1100, false, true);
  await shoot(t, s.victim);
  const shotAt = 0;
  let clock = 0,
    call = null,
    line = null,
    phone = false,
    starAt = null;
  while (clock < 15) {
    await t.wait(0.5);
    clock += 0.5;
    w = await t.call('witnesses');
    const c = playerCall(w);
    if (c) {
      call ??= { ...c, at: clock };
      line ??= c.line;
      phone ||= c.phone;
      t.assert(w.stars === 0 || c.reported, 'star before the call ended: ' + JSON.stringify(w));
    }
    if (w.stars >= 1) {
      starAt = clock;
      break;
    }
  }
  t.assert(call, 'nobody phoned 911: ' + JSON.stringify(w.incidents));
  t.note(`call began ${call.at - shotAt} s after the shots, ${call.d} units off, ${call.callSeconds} s long; star at ${starAt} s`);
  t.assert(call.at <= 6, `the call began ${call.at} s after the shots`);
  t.near(call.callSeconds, 5, 8, 'call length');
  t.assert(phone, 'the caller never held a phone');
  t.assert(line && /911|[Pp]olice|shoot|shot|fire/.test(line), 'no 911 line in the bubble: ' + line);
  t.assert(starAt !== null, 'no star within 15 s of the shooting: ' + JSON.stringify(w));

  // 3. The response: sent to the player (the caller can see them), first unit out at once.
  t.assert(w.response, 'no response after the call: ' + JSON.stringify(w));
  const p = await t.call('status');
  t.assert(Math.hypot(w.response.x - p.x, w.response.y - p.y) < 200, 'units not sent to the player: ' + JSON.stringify(w.response));
  t.assert(w.response.eta <= 2.5, `first unit waits ${w.response.eta} s`);
  await t.wait(3);
  let police = await t.call('policeReport');
  t.assert(police.units.length >= 1, 'no unit dispatched 3 s after the call: ' + JSON.stringify(police.counts));
  const first = nearestUnit(police);
  await t.wait(6);
  police = await t.call('policeReport');
  const later = nearestUnit(police);
  t.note(`nearest unit ${first} → ${later} units`);
  t.assert(later < first - 100 || later < 250, `the units are not closing in: ${first} → ${later}`);

  await t.call('holdSimulation', false);
  await t.call('wanted', 0);
  await t.call('god', false);
}
