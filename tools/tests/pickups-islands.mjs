// Health pickups beyond Northbank (game-populate.js): wounded, the player is patched up
// by the one at RIVERSIDE MEDICAL (Palm Keys), THE HALCYON CLINIC (Monarch Isle) and in
// Oceanview; a pickup taken is gone for a while.
export const fresh = true;
const HEALTH = [
  [-1730, 1996, 'RIVERSIDE MEDICAL'],
  [9000, -3030, 'THE HALCYON CLINIC'],
  [2476, 7260, 'OCEANVIEW'],
];
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('god', false);
    for (const [x, y, name] of HEALTH) {
      // A blast 4 m off wounds without killing.
      await t.call('teleport', x + 90, y);
      await t.wait(3.2); // past any respawn invulnerability
      await t.call('blast', x + 120, y, 1);
      await t.wait(0.3);
      let s = await t.call('status');
      t.assert(s.mode === 'play' && s.hp < 100, `${name}: the blast did not wound: ${JSON.stringify(s)}`);
      await t.call('teleport', x, y);
      await t.wait(0.3);
      s = await t.call('status');
      t.assert(s.hp === 100, `${name}: no health pickup at ${x},${y}: hp ${s.hp}`);
      // Taken: stepping off and back on while hurt again does not heal.
      await t.call('teleport', x + 90, y);
      await t.call('blast', x + 120, y, 1);
      await t.wait(0.3);
      await t.call('teleport', x, y);
      await t.wait(0.3);
      s = await t.call('status');
      t.assert(s.hp < 100, `${name}: the pickup healed twice in a row`);
      await t.call('heal');
    }
  } finally {
    await t.call('holdSimulation', false);
  }
}
