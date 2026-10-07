// God mode's DRAWBRIDGES row (god-drawbridges.js): real clicks on the GOD MODE tab pick one
// drawbridge and raise it through its own opening (warning, gates, clearing, then the leaves:
// never a jump), LOWER brings it down, and ALL raises every one.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  // The clock frozen: no timetable opening starts while the panel is tested.
  await t.call('godFreeze', true);
  await t.call('drawbridge', 'close', 0, 'all');
  await t.wait(30);
  await t.call('teleport', 3600, -5900);
  let panel = await t.call('godDrawbridgePanel');
  t.assert(panel.row, 'the GOD MODE tab shows the drawbridge row: ' + JSON.stringify(panel));
  t.assert(panel.chips.length === 5 && panel.chips[0].id === 'all', 'chips ALL + four drawbridges: ' + panel.chips.map((c) => c.label));
  const chip = panel.chips.find((c) => c.id === 'oceanview');
  await t.mouse(chip.x, chip.y, { seconds: 0.1, down: true });
  await t.realWait(0.3);
  panel = await t.call('godDrawbridgePanel');
  t.assert(panel.chips.find((c) => c.id === 'oceanview').checked, 'OCEANVIEW picked');
  const raise = panel.buttons.find((b) => b.action === 'raise');
  await t.mouse(raise.x, raise.y, { seconds: 0.1, down: true });
  await t.realWait(0.3);
  let s = await t.call('godDrawbridges');
  const ocean = s.bridges.find((b) => b.id === 'oceanview');
  t.assert(ocean.phase === 'warning' && ocean.angle === 0, `raised through its own sequence (warning first, leaves down): ${JSON.stringify(ocean)}`);
  t.assert(s.bridges.filter((b) => b.id !== 'oceanview').every((b) => b.phase === 'idle'), 'only the picked one: ' + JSON.stringify(s.bridges));
  await t.call('godDrawbridgePanel', true);
  await t.call('holdSimulation', true);
  try {
    for (let k = 0; k < 30; k++) {
      await t.wait(4);
      s = await t.call('godDrawbridges');
      if (s.bridges.find((b) => b.id === 'oceanview').phase === 'open') break;
    }
    t.assert(s.bridges.find((b) => b.id === 'oceanview').angle > 70, 'the Oceanview span is up: ' + JSON.stringify(s.bridges));
    // LOWER from the panel.
    await t.call('holdSimulation', false);
    panel = await t.call('godDrawbridgePanel');
    const lower = panel.buttons.find((b) => b.action === 'lower');
    await t.mouse(lower.x, lower.y, { seconds: 0.1, down: true });
    await t.realWait(0.3);
    s = await t.call('godDrawbridges');
    t.assert(s.bridges.find((b) => b.id === 'oceanview').phase === 'lowering', 'lowering: ' + JSON.stringify(s.bridges));
    await t.call('godDrawbridgePanel', true);
    await t.call('holdSimulation', true);
    for (let k = 0; k < 30 && s.bridges.find((b) => b.id === 'oceanview').phase !== 'idle'; k++) {
      await t.wait(4);
      s = await t.call('godDrawbridges');
    }
    t.assert(s.bridges.every((b) => b.phase === 'idle' && b.angle === 0), 'all down again: ' + JSON.stringify(s.bridges));
    // ALL.
    s = await t.call('godDrawbridges', 'raise', 'all');
    t.assert(s.bridges.every((b) => b.phase === 'warning'), 'ALL raises every drawbridge: ' + JSON.stringify(s.bridges));
    await t.wait(40);
    s = await t.call('godDrawbridges');
    t.assert(s.bridges.every((b) => b.angle > 5), 'every span rising: ' + JSON.stringify(s.bridges));
    s = await t.call('godDrawbridges', 'lower', 'all');
    t.assert(s.bridges.every((b) => b.phase === 'lowering'), 'ALL lowers every drawbridge: ' + JSON.stringify(s.bridges));
  } finally {
    await t.call('holdSimulation', false);
    await t.call('drawbridge', 'close', 0, 'all');
    await t.call('godFreeze', false);
    await t.call('god', false);
  }
}
