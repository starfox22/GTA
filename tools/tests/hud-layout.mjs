// No two HUD boxes overlap on the dev page's 960x600 window (hudOverlaps), with the keyboard HUD and in touch mode:
// the car radio opened on getting in used to reach over the speed box (it now opens upward from above it on short
// windows), a long notice ran under the waypoint pill, and in touch mode the radio chip sat on the weapon chip and its
// 4 s pop on getting in covered the GAS / BRAKE buttons (now it only flashes). In touch mode the mission card is at the
// top, and a bus heading down the screen makes it yield there.
export const fresh = true;
const LONG = 'You hand over everything you have. Next time, bring the fare, the driver says and pulls away';
// CSS pop-ins (the radio, the notices) run on the wall clock: let them finish before reading the boxes.
const settle = () => new Promise((r) => setTimeout(r, 900));
export default async function (t) {
  const clear = async (what) => {
    const o = await t.call('hudOverlaps');
    t.assert(o.viewport[0] === 960 && o.viewport[1] === 600, 'not the 960x600 window: ' + o.viewport);
    t.assert(!o.overlaps.length, `${what}: HUD boxes overlap: ` + JSON.stringify(o.overlaps));
    return o;
  };
  const boxOf = (o, id) => o.boxes.find((b) => b.id === id);
  await t.call('god', true);
  await clear('on foot');

  // Keyboard HUD: a car (the radio opens for a few seconds) and a long notice.
  await t.call('teleport', 420, 4400);
  await t.call('drive', 'sedan', 0, Math.PI / 2);
  await t.call('notices', LONG, 8);
  await t.wait(0.3);
  await settle();
  let o = await clear('in a car, radio open, long notice');
  const radio = boxOf(o, 'carRadio'),
    stats = boxOf(o, 'vehicleStats');
  t.assert(radio && stats && radio.b <= stats.t, 'the radio is not above the speed box: ' + JSON.stringify({ radio, stats }));
  const toast = boxOf(o, 'toast'),
    nav = boxOf(o, 'navigation');
  if (toast && nav) t.assert(toast.t >= nav.b || toast.r <= nav.l, 'the notice runs under the pill: ' + JSON.stringify({ toast, nav }));
  else t.note('notice or pill not drawn at the check: ' + JSON.stringify({ toast, nav }));

  // Touch mode: getting in only flashes the radio chip, which sits under the weapon chip.
  // Out of the car, and the desktop radio's few seconds open (wall clock) run out first.
  await t.call('teleport', 420, 4400);
  await new Promise((r) => setTimeout(r, 4600));
  await t.call('settings', { touch: 'on' });
  await t.wait(0.3);
  await t.call('drive', 'bus', 0, Math.PI / 2);
  await t.wait(0.3);
  await settle();
  o = await clear('touch, in a bus');
  const chip = boxOf(o, 'carRadio'),
    weapon = boxOf(o, 'weaponButton');
  t.assert(chip && chip.b - chip.t < 40, 'the radio opened by itself in touch mode: ' + JSON.stringify(chip));
  t.assert(weapon && chip.t >= weapon.b, 'the radio chip is on the weapon chip: ' + JSON.stringify({ chip, weapon }));

  // Touch mode: heading down the screen at speed, the bus reaches the card at the top: it yields.
  await t.call('holdSimulation', true);
  try {
    await t.call('launch', 20);
    await t.keys('KeyW', 3);
    await t.call('hudClearance', 'read');
    await t.keys('KeyW', 0.5);
    const c = await t.call('hudClearance');
    t.note(`touch, bus heading down: player ${JSON.stringify(c.player)}, open card ${JSON.stringify(c.open)}`);
    t.assert(c.player && c.open && c.player.t < c.open.b + 30, 'the bus never came near the top card: ' + JSON.stringify(c));
    t.assert(c.yielding && c.folded, 'the top card covered the bus: ' + JSON.stringify(c));
    await clear('touch, bus at speed');
  } finally {
    await t.call('holdSimulation', false);
    await t.call('settings', { touch: 'auto' });
  }
}
