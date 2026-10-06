// shooterInView in the chase view (combat-rules.js ON-SCREEN RULE, chase-rules.js FIRE): someone standing on the
// street in front of the camera may fire at the player, and so may someone close behind (CLOSE QUARTERS); further
// behind the camera, off to the side, beyond the fire reach or behind a building (the Old Quarter block east of the
// start) they may not. The street view's rule is the
// camera footprint round cameraTarget as before.
export default async function (t) {
  const at = async (x, y) => (await t.call('viewRules', x, y)).point;
  await t.call('god', true);
  try {
    await t.call('viewMode', 'chase');
    await t.call('teleport', 748, 584);
    await t.wait(0.2);
    await t.call('chaseLook', 0, 0, 0, 9); // east along the street
    let p = await at(1148, 584); // 50 m ahead on the street
    t.assert(p.sees && !p.hiddenFromCamera && p.shooter && p.shooterInset, 'a gunman 50 m ahead on the street may not fire: ' + JSON.stringify(p));
    p = await at(348, 584); // 50 m behind
    t.assert(p.screen.behind && !p.shooter, 'a gunman behind the camera may fire: ' + JSON.stringify(p));
    // CLOSE QUARTERS: 15 m behind the player on foot may fire from off screen (the street view's frame allows it).
    p = await at(748 - 120, 584);
    t.assert(p.screen.behind && p.shooter, 'a gunman 15 m behind the player may not fire (close quarters): ' + JSON.stringify(p));
    p = await at(748, 984); // 50 m to the south of the player, far off the frustum's side
    t.assert(!p.sees && !p.shooter, 'a gunman off to the side may fire: ' + JSON.stringify(p));
    p = await at(748 + 1500, 584); // ~190 m ahead: on screen, beyond the 150 m fire reach
    t.assert(p.sees && !p.shooter, 'a gunman beyond the fire reach may fire: ' + JSON.stringify(p));
    p = await at(1500, 470); // behind the block (1248-1403, 396-539) from the camera
    t.assert(p.sees, 'the point behind the block is not in the frustum (layout changed?): ' + JSON.stringify(p));
    t.assert(p.hiddenFromCamera && !p.shooter, 'a gunman behind a building may fire: ' + JSON.stringify(p));

    // The street view: the camera footprint (screenViewHalf) round cameraTarget, less the inset.
    await t.call('viewMode', 'street');
    await t.wait(0.5);
    // (Held, so the camera's target stays where it was read.)
    await t.call('holdSimulation', true);
    const s = await at(748, 584),
      [cx, cy] = s.cameraTarget,
      [w, h] = s.screenHalf;
    const inside = await at(cx + w - 40, cy - h + 40),
      outside = await at(cx + w + 40, cy),
      inset = await at(cx + w - 10, cy);
    t.assert(inside.shooter && inside.shooterInset, 'street view: a gunman inside the footprint may not fire: ' + JSON.stringify({ inside, s }));
    t.assert(!outside.shooter && !outside.shooterInset, 'street view: a gunman outside the footprint may fire: ' + JSON.stringify(outside));
    t.assert(inset.shooter && !inset.shooterInset, 'street view: the 20 px inset is not applied: ' + JSON.stringify(inset));
  } finally {
    await t.call('holdSimulation', false);
    await t.call('viewMode', 'street');
    await t.call('god', false);
  }
}
