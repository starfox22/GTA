// The free-roam interface (hud-notify.js, input-hints.js, gamepad.js, map-view.js): the
// notification feed stacks without overlaps or repeats, hints name the device in use
// (keys, touch buttons, gamepad buttons), a virtual pad drives the bound actions, map filters.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // --- Notification feed: newest first, at most three, a repeat refreshes its line.
    let feed = await t.call('notices', 'Not enough cash: you need $200 for a respray.', 3);
    t.assert(feed[0].tone === 'warn', 'refusal tone: ' + JSON.stringify(feed[0]));
    await t.call('notices', 'POLICE · A witness is calling 911', 3);
    await t.call('notices', 'Heading to the pier.', 3);
    feed = await t.call('notices', 'Picked up 12 rounds.', 3);
    const live = feed.filter((n) => !n.leaving);
    t.assert(live.length <= 3, 'more than three lines up: ' + live.length);
    t.assert(live[0].text === 'Picked up 12 rounds.', 'newest not first: ' + JSON.stringify(live.map((n) => n.text)));
    t.assert(feed.some((n) => n.tone === 'police'), 'no police tone: ' + JSON.stringify(feed.map((n) => n.tone)));
    const before = (await t.call('notices')).filter((n) => !n.leaving).length;
    feed = await t.call('notices', 'Picked up 24 rounds.', 3);
    t.assert(feed.filter((n) => !n.leaving).length === before, 'a counter line piled up instead of refreshing');
    t.assert(feed[0].text === 'Picked up 24 rounds.', 'the refreshed line lost its new text');
    // Readable: a long line stays longer than the 3 s asked for.
    feed = await t.call('notices', 'Land and stop to exit, or press J to bail out with a parachute before the fuel runs out over the water.', 3);
    t.assert(feed[0].life > 3.5, 'long line too short: ' + feed[0].life);
    // A line runs out on the HUD clock.
    await t.wait(8);
    t.assert((await t.call('notices')).filter((n) => !n.leaving).length === 0, 'lines never timed out');

    // --- Hints per device, on foot.
    let h = await t.call('inputHints', 'keyboard');
    t.assert(h.names.interact === 'E' && h.press === 'PRESS E', 'keyboard names: ' + JSON.stringify(h));
    h = await t.call('inputHints', 'touch');
    t.assert(h.names.interact === 'ACTION' && h.press === 'TAP ACTION', 'touch names on foot: ' + JSON.stringify(h.names));
    t.assert(h.move === 'STICK' && h.names.map === 'MAP', 'touch move/map: ' + h.move + ' ' + h.names.map);
    h = await t.call('inputHints', 'gamepad');
    t.assert(h.names.interact === 'A' && h.press === 'PRESS A' && h.names.fire === 'RT', 'gamepad names on foot: ' + JSON.stringify(h.names));

    // --- A virtual pad: the left stick holds the forward key, RT fires; letting go releases.
    let pad = await t.call('gamepadFeed', { axes: [0, -1, 0, 0] });
    t.assert(pad.mode === 'play:foot' && pad.held.includes('KeyW'), 'stick up does not hold forward: ' + JSON.stringify(pad));
    pad = await t.call('gamepadFeed', null);
    t.assert(pad.held.length === 0, 'pad left keys held: ' + JSON.stringify(pad.held));

    // --- In a car the names follow the controls there.
    await t.call('drive', 'sedan');
    h = await t.call('inputHints', 'touch');
    t.assert(h.names.interact === 'EXIT' && h.names.forward === 'GAS', 'touch names in a car: ' + JSON.stringify(h.names));
    t.assert(!/\b[NB] ·/.test(h.radioChip), 'touch radio chip names a key: ' + h.radioChip);
    h = await t.call('inputHints', 'gamepad');
    t.assert(h.names.forward === 'RT' && h.names.back === 'LT', 'gamepad pedals: ' + JSON.stringify(h.names));
    pad = await t.call('gamepadFeed', { buttons: { RT: 1 } });
    t.assert(pad.mode === 'play:drive' && pad.held.includes('KeyW'), 'RT does not hold the throttle: ' + JSON.stringify(pad));
    await t.call('gamepadFeed', null);
    h = await t.call('inputHints', 'keyboard');
    t.assert(h.names.radioPower === 'N' && /^N · /.test(h.radioChip), 'keyboard radio chip: ' + h.radioChip);
    await t.call('inputHints', 'auto');

    // --- Map filters: a layer switches off and back on; the GO TO list finds places.
    let v = await t.call('mapView', { layer: 'police', on: false });
    t.assert(v.layers.police === false, 'police layer did not switch off');
    v = await t.call('mapView', { layer: 'police', on: true });
    t.assert(v.layers.police === true, 'police layer did not switch back on');
    const heads = v.destinations.map((d) => d.heading);
    for (const want of ['HOSPITAL', 'RESPRAY & REPAIRS', 'ARMORY']) t.assert(heads.includes(want), 'GO TO lacks ' + want + ': ' + heads.join(', '));
    t.assert(v.destinations.every((d) => Number.isFinite(d.metres)), 'GO TO distance not finite');
    t.note(`GO TO: ${heads.length} places; minimap ${v.minimap.width}x${v.minimap.height}`);
  } finally {
    await t.call('gamepadFeed', null);
    await t.call('inputHints', 'auto');
    await t.call('holdSimulation', false);
  }
}
