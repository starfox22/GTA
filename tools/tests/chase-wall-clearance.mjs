// The shoulder and the boom must both stay outside the wall, even while aiming parallel to it.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    await t.call('viewMode', 'chase');
    await t.call('arm', 0);
    const wall = (await t.call('layout')).buildings.find(b => Math.abs(b.y + b.h - 1052) < 3 && b.x <= 1844 && b.x + b.w >= 1844 && b.height > 20);
    t.assert(wall, 'the Northbank south-facing wall was not found');
    const x = wall.x + wall.w / 2, face = wall.y + wall.h;
    for (const heading of [90, 135, 180]) {
      await t.call('teleport', x, face + 6);
      await t.wait(0.2);
      await t.call('chaseLook', 0, 0, heading, 4);
      await t.call('gamepadFeed', { axes: [0, 0, 0, 0], buttons: { LT: 1 } });
      await t.wait(1);
      const c = await t.call('chaseCamera');
      t.finite(c, 'camera');
      t.assert(c.position[1] >= face + 3, `heading ${heading}: camera clips the south wall at y=${face}: ${JSON.stringify(c)}`);
      await t.call('gamepadFeed', null);
    }
  } finally {
    await t.call('gamepadFeed', null);
    await t.call('viewMode', 'street');
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
