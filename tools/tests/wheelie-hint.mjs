// The wheelie hint (wheelie.js WHEELIE HINT): getting on a motorbike that can lift its front says how, in the
// device's names (keys, gamepad, touch), at most three rides a session and only until a wheelie is pulled; never in a
// car, never on the cruiser (its wheelie is a hop).
export const fresh = true;

const hintLine = (feed) => feed.find((n) => !n.leaving && /^WHEELIE · HOLD/.test(n.text));

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('inputHints', 'keyboard');
    await t.call('drive', 'kr500');
    let w = await t.call('wheelieState');
    let line = hintLine(await t.call('notices'));
    t.assert(w.hint.shown === 1 && line, 'no hint on the first motorbike: ' + JSON.stringify(w.hint));
    t.assert(line.text === 'WHEELIE · HOLD W + ↑ to lift the front', 'keyboard hint: ' + line.text);
    // Let it run out, then a car: nothing.
    await t.wait(8);
    t.assert(!hintLine(await t.call('notices')), 'the hint never ran out');
    await t.call('drive', 'sedan');
    w = await t.call('wheelieState');
    t.assert(!hintLine(await t.call('notices')) && w.hint.shown === 1, 'a hint in a car: ' + JSON.stringify(w.hint));
    // The cruiser barely lifts: no hint.
    await t.call('drive', 'cruiser');
    w = await t.call('wheelieState');
    t.assert(!hintLine(await t.call('notices')) && w.hint.shown === 1 && !w.hint.due, 'a hint on the cruiser: ' + JSON.stringify(w.hint));
    // A gamepad names its stick and trigger, touch its GAS button and the steering stick.
    await t.call('inputHints', 'gamepad');
    await t.call('drive', 'yamasaki');
    line = hintLine(await t.call('notices'));
    t.assert(line && line.text === 'WHEELIE · HOLD RT + L-STICK ↑ to lift the front', 'gamepad hint: ' + JSON.stringify(line));
    await t.wait(8);
    await t.call('inputHints', 'touch');
    await t.call('drive', 'dolcati');
    line = hintLine(await t.call('notices'));
    t.assert(line && line.text === 'WHEELIE · HOLD GAS + STEER ↑ to lift the front', 'touch hint: ' + JSON.stringify(line));
    await t.wait(8);
    // Three a session.
    await t.call('inputHints', 'keyboard');
    await t.call('drive', 'bike');
    w = await t.call('wheelieState');
    t.assert(!hintLine(await t.call('notices')) && w.hint.shown === 3, 'a fourth hint: ' + JSON.stringify(w.hint));
  } finally {
    await t.call('inputHints', 'keyboard');
    await t.call('holdSimulation', false);
  }
}
