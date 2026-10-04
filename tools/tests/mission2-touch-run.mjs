// Touch controls on the Blue Hour terrace (mission 2): the walk action runs there (footPace), so the
// touch button, the key name and the stealth hint call it RUN; elsewhere it stays WALK. The keyboard's
// own reminder is unchanged. With the touch controls on screen the hints name them even after a key
// press (input-hints.js hintDevice).
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
  // Touch controls forced on and a keyboard as the last input: the hints follow the HUD on
  // screen (the RUN button), not the keyboard ("SHIFT TO RUN" beside a RUN button read wrong).
  await t.call('inputHints', 'auto');
  await t.call('settings', { touch: 'on' });
  await t.keys('KeyC', 0.1, { real: true }); // (an unbound key: only the device changes)
  h = await t.call('inputHints');
  s = await t.call('roofStealth');
  t.assert(h.device === 'touch' && /HOLD RUN TO RUN/.test(s.hint), 'touch HUD after a key press: ' + JSON.stringify({ device: h.device, hint: s.hint }));
  await t.call('settings', { touch: 'off' });
  h = await t.call('inputHints');
  s = await t.call('roofStealth');
  t.assert(h.device === 'keyboard' && /SHIFT TO RUN/.test(s.hint), 'keyboard HUD: ' + JSON.stringify({ device: h.device, hint: s.hint }));
  await t.call('settings', { touch: 'auto' });
  // Off the terrace the touch button is the WALK button again.
  await t.call('retryMission');
  h = await t.call('inputHints', 'touch');
  t.assert(h.names.walk === 'WALK', 'walk after leaving the terrace: ' + JSON.stringify(h.names));
  await t.call('inputHints', 'auto');
}
