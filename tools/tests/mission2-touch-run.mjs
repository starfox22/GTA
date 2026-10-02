// Touch controls on the Blue Hour terrace (mission 2): the walk action runs there (footPace), so the
// touch button, the key name and the stealth hint call it RUN; elsewhere it stays WALK. The keyboard's
// own reminder is unchanged.
export const fresh = true;
export default async function (t) {
  let h = await t.call('inputHints', 'touch');
  t.assert(h.names.walk === 'WALK', 'walk on the street: ' + JSON.stringify(h.names));
  await t.call('startMission', 1);
  await t.call('roofPlace', 150, 250);
  h = await t.call('inputHints', 'touch');
  t.assert(h.names.walk === 'RUN', 'touch name of the walk action on the terrace: ' + JSON.stringify(h.names));
  let s = await t.call('roofStealth');
  t.assert(/HOLD RUN TO RUN/.test(s.hint) && !/WALK TO RUN/.test(s.hint), 'touch hint: ' + s.hint);
  await t.call('inputHints', 'keyboard');
  s = await t.call('roofStealth');
  t.assert(/WALK TO BLEND IN · SHIFT TO RUN/.test(s.hint), 'keyboard hint: ' + s.hint);
  // Off the terrace the touch button is the WALK button again.
  await t.call('retryMission');
  h = await t.call('inputHints', 'touch');
  t.assert(h.names.walk === 'WALK', 'walk after leaving the terrace: ' + JSON.stringify(h.names));
  await t.call('inputHints', 'auto');
}
