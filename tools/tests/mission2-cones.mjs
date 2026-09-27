// Mission 2 (A Seat at the Table): bodyguards see only inside their vision cones. Right
// behind a guard is safe, in front in the open is seen, a hedge between hides the player;
// running in a cone raises suspicion far faster than walking, running unseen does nothing.
export const fresh = true;
export default async function (t) {
  // Stepped time only: nothing moves between console calls.
  await t.call('holdSimulation', true);
  try {
    let r = await t.call('roofPlace', 100, 290);
    t.assert(r && r.onRoof && r.stage === 2, 'setup: ' + JSON.stringify(r));
    // The other three stand facing the balustrade, out of the way.
    await t.call('roofGuard', 1, 330, 60, -Math.PI / 2);
    await t.call('roofGuard', 2, 330, 300, 0);
    await t.call('roofGuard', 3, 160, 60, -Math.PI / 2);
    await t.call('roofGuard', 0, 180, 250, 0); // facing east across the dance floor
    const nico = (s) => s.guards[0];

    // Right behind him (16 units: close, but not brushing past him).
    await t.call('roofPlace', 164, 250);
    await t.call('roofSuspicion', 0);
    await t.wait(2);
    r = await t.call('roofStealth');
    t.assert(!nico(r).sees && r.suspicion === 0, 'seen from behind: ' + JSON.stringify(nico(r)) + ' suspicion ' + r.suspicion);

    // Beside him, just outside the cone's angle (90 degrees off his heading).
    await t.call('roofPlace', 180, 215);
    await t.wait(1);
    r = await t.call('roofStealth');
    t.assert(!nico(r).sees && r.suspicion === 0, 'seen outside the cone angle: suspicion ' + r.suspicion);

    // In front of him in the open, 60 units: seen, and the meter climbs.
    await t.call('roofPlace', 240, 250);
    await t.wait(1);
    r = await t.call('roofStealth');
    t.assert(nico(r).sees, 'not seen inside the cone: ' + JSON.stringify(nico(r)));
    t.near(r.suspicion, 2, 30, 'suspicion after 1 s seen at 60 units');

    // A hedge between them (he looks south at it): hidden.
    await t.call('roofGuard', 0, 280, 170, Math.PI / 2);
    await t.call('roofPlace', 280, 240);
    await t.call('roofSuspicion', 0);
    await t.wait(1.5);
    r = await t.call('roofStealth');
    t.assert(!nico(r).sees && r.suspicion === 0, 'seen through the hedge: suspicion ' + r.suspicion);

    // The same line across his cone at 85 units: run it, then walk it.
    await t.call('roofGuard', 0, 180, 250, 0);
    await t.call('roofPlace', 260, 285);
    await t.call('roofSuspicion', 0);
    await t.keys(['KeyW', 'Walk'], 1); // the walk key runs on the terrace during the job
    r = await t.call('roofStealth');
    const run = r.suspicion;
    t.assert(r.running && r.pace > 20, 'the walk key did not run: ' + JSON.stringify({ pace: r.pace, running: r.running }));
    await t.call('roofPlace', 260, 285);
    await t.call('roofSuspicion', 0);
    await t.keys('KeyW', 1); // plain movement walks
    r = await t.call('roofStealth');
    const walk = r.suspicion;
    t.assert(!r.running && r.pace < 7, 'plain movement did not walk: pace ' + r.pace);
    t.near(walk, 0.5, 8, 'walking 1 s in the cone');
    t.assert(run > walk * 2 && run >= 8, `running seen should cost far more than walking: run ${run}, walk ${walk}`);

    // Standing at the far end of his cone (110 units): only slowly.
    await t.call('roofPlace', 290, 250);
    await t.call('roofSuspicion', 0);
    await t.wait(3);
    r = await t.call('roofStealth');
    t.assert(nico(r).sees, 'not seen at 110 units in the cone');
    t.near(r.suspicion, 1, 14, 'suspicion after 3 s at the far end of the cone');

    // Running behind his back: nobody sees, nothing happens.
    await t.call('roofPlace', 150, 250);
    await t.call('roofSuspicion', 0);
    await t.keys(['KeyA', 'Walk'], 1);
    r = await t.call('roofStealth');
    t.assert(r.running && r.suspicion === 0 && !r.alarm, 'running unseen raised suspicion: ' + r.suspicion);
  } finally {
    await t.call('roofGuard', -1);
    await t.call('holdSimulation', false);
  }
}
