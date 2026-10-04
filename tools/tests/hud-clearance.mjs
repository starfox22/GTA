// The mission card never covers the player (hud-clearance.js): on the dev page's 960x600 window, a vehicle heading
// up the screen at speed sits centre-low (camera-drive.js), and a city bus at 60 km/h reached 30 px into the open
// INCOMING CALL card. The card now yields to its one-line strip with its reading time held, opens again once the
// bus is clear, and O still opens it on purpose. No two HUD boxes overlap meanwhile.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('god', true);
    const north = async () => {
      await t.call('teleport', 420, 5600); // Southport airport, up the runway
      await t.call('drive', 'bus', 0, -Math.PI / 2);
      await t.call('launch', 20);
      await t.keys('KeyW', 3);
    };
    await t.call('setZoom', 2);
    await north();
    await t.call('hudClearance', 'read');
    await t.keys('KeyW', 0.6);
    let c = await t.call('hudClearance');
    t.note(`at speed: player ${JSON.stringify(c.player)}, open card ${JSON.stringify(c.open)}`);
    t.assert(c.viewport[0] === 960 && c.viewport[1] === 600, 'not the 960x600 window: ' + c.viewport);
    t.assert(c.player && c.open && c.player.b > c.open.t - 30, 'the car never came near the card, so this proves nothing: ' + JSON.stringify(c));
    t.assert(c.yielding && c.folded && !c.hidden, 'the open card covered the car: ' + JSON.stringify(c));
    t.assert(c.readLeft > 5.4, 'the reading time ran on while the card yielded: ' + c.readLeft);
    let o = await t.call('hudOverlaps');
    t.assert(!o.overPlayer.includes('pager'), 'the card is over the player: ' + JSON.stringify(o.overPlayer));
    t.assert(!o.overlaps.length, 'HUD boxes overlap at speed: ' + JSON.stringify(o.overlaps));

    // Brake: the car comes back to the middle and the card opens for the rest of its time.
    await t.keys('KeyS', 3);
    await t.wait(1.5);
    c = await t.call('hudClearance');
    t.assert(!c.yielding && !c.folded, 'the card stayed folded with the car clear: ' + JSON.stringify(c));
    t.assert(c.readLeft > 2 && c.readLeft < 6, 'no reading time left after the yield: ' + c.readLeft);

    // O opens it on purpose, even over the car.
    await north();
    await t.call('hudClearance', 'read');
    await t.keys('KeyW', 0.4);
    c = await t.call('hudClearance');
    t.assert(c.yielding && c.folded, 'not yielding before O: ' + JSON.stringify(c));
    await t.keys('KeyO', 0.15, { real: true });
    await t.keys('KeyW', 0.3);
    c = await t.call('hudClearance');
    t.assert(c.forced && !c.folded, 'O did not open the yielding card: ' + JSON.stringify(c));
    await t.keys('KeyO', 0.15, { real: true });
    c = await t.call('hudClearance');
    t.assert(c.folded, 'a second O did not fold it: ' + JSON.stringify(c));
  } finally {
    await t.call('holdSimulation', false);
  }
}
