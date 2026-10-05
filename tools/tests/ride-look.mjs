// Ride head-look (ride-look.js): on the Sunset Eye and the Falcon the real pointer's place on screen turns the
// rider's head (left, right, up, down, eased past a dead zone, smoothed), the centre looks ahead again, a view
// change with E resets it, the camera views turn half as far, the gamepad's right stick turns it while held, a ride
// shows the look hint once, and moving the mouse never changes the ride.
export const fresh = true;

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    const board = await t.call('boardRide', 'wheel');
    t.assert(board?.kind === 'wheel' && board.view === 0, `not in the Eye's capsule: ${JSON.stringify(board)}`);
    await t.wait(0.5);
    let look = await t.call('rideLook');
    const [w, h] = look.viewport,
      cx = Math.round(w / 2),
      cy = Math.round(h / 2);
    t.assert(look.active && look.kind === 'wheel' && look.seat, `capsule view is not a seat view: ${JSON.stringify(look)}`);
    t.assert(look.yaw === 0 && look.pitch === 0 && look.source === 'none', `head turned before the mouse moved: ${JSON.stringify(look)}`);

    // Settle the head at a pointer spot and read it.
    const at = async (x, y, seconds = 1.2) => {
      await t.mouse(x, y, { seconds: 0.05 });
      await t.wait(seconds);
      return t.call('rideLook');
    };
    look = await at(4, cy, 2);
    const notes = await t.call('notices');
    t.assert(notes.some((n) => /look around/i.test(n.text)), `no look hint two seconds into the ride: ${JSON.stringify(notes.map((n) => n.text))}`);
    t.assert(look.source === 'mouse', `mouse not the look's source: ${JSON.stringify(look)}`);
    t.near(look.yaw, -121, -105, 'pointer at the left edge: yaw (deg)');
    t.near(look.pitch, -2, 2, 'pointer at the left edge: pitch (deg)');
    look = await at(w - 4, cy);
    t.near(look.yaw, 105, 121, 'pointer at the right edge: yaw (deg)');
    look = await at(cx, 4);
    t.near(look.pitch, 43, 51, 'pointer at the top: pitch (deg)');
    t.near(look.yaw, -2, 2, 'pointer at the top: yaw (deg)');
    look = await at(cx, h - 4);
    t.near(look.pitch, -61, -52, 'pointer at the bottom: pitch (deg)');
    look = await at(cx, cy);
    t.near(look.yaw, -0.5, 0.5, 'pointer back at the centre: yaw (deg)');
    t.near(look.pitch, -0.5, 0.5, 'pointer back at the centre: pitch (deg)');
    // The dead zone and the eased curve: a little off centre looks ahead, half way turns less than linear.
    look = await at(cx + Math.round(w * 0.02), cy);
    t.near(look.yaw, -0.01, 0.01, 'inside the dead zone: yaw (deg)');
    look = await at(cx + Math.round(w / 4), cy);
    t.near(look.yaw, 25, 50, 'half way to the right edge: yaw (deg, eased)');
    // Smoothed like a head: a tenth of a second after a big move it is on its way, not there.
    await at(cx, cy);
    await t.mouse(w - 4, cy, { seconds: 0.05 });
    await t.wait(0.1);
    look = await t.call('rideLook');
    t.near(look.yaw, 10, 90, 'a tenth of a second into a turn: yaw (deg)');
    t.assert(look.targetYaw > 105, `target not at the right edge: ${look.targetYaw}`);
    await t.wait(1);

    // E (outside view): the head resets to forward until the mouse moves; the camera turns half as far.
    await t.call('interact');
    await t.wait(0.5);
    look = await t.call('rideLook');
    t.assert(look.view === 1 && !look.seat, `not the outside view: ${JSON.stringify(look)}`);
    t.assert(look.yaw === 0 && look.pitch === 0 && look.source === 'none', `head not reset by the view change: ${JSON.stringify(look)}`);
    look = await at(4, cy);
    t.near(look.cameraYaw, -61, -52, 'outside view, pointer left: camera yaw (deg)');
    await t.call('interact');
    await t.wait(0.3);

    // The Falcon: the front seat turns the head; the mouse never changes the ride.
    await t.mouse(cx, cy, { seconds: 0.05 });
    let ride = await t.call('boardRide', 'coaster');
    t.assert(ride?.kind === 'train', `not on the Falcon: ${JSON.stringify(ride)}`);
    await t.wait(4);
    const quiet = await t.call('themePark'),
      quietPos = await t.call('status');
    look = await t.call('rideLook');
    t.assert(look.kind === 'train' && look.yaw === 0, `head turned on the Falcon with the mouse still: ${JSON.stringify(look)}`);
    ride = await t.call('boardRide', 'coaster');
    await t.wait(0.1);
    await t.mouse(4, 4, { seconds: 0.05 });
    await t.wait(3.9);
    const turned = await t.call('themePark'),
      turnedPos = await t.call('status');
    look = await t.call('rideLook');
    t.assert(look.source === 'mouse' && look.cameraYaw < -50 && look.cameraPitch > 20, `chase camera did not turn: ${JSON.stringify(look)}`);
    t.assert(
      JSON.stringify(turned.coaster.train) === JSON.stringify(quiet.coaster.train),
      `the train moved differently with the head turned: ${JSON.stringify(quiet.coaster.train)} vs ${JSON.stringify(turned.coaster.train)}`,
    );
    t.assert(JSON.stringify(turned.riding) === JSON.stringify(quiet.riding), `the ride changed with the head turned: ${JSON.stringify(quiet.riding)} vs ${JSON.stringify(turned.riding)}`);
    t.assert(
      Math.round(turnedPos.x) === Math.round(quietPos.x) && Math.round(turnedPos.y) === Math.round(quietPos.y),
      `the player moved differently with the head turned: ${quietPos.x},${quietPos.y} vs ${turnedPos.x},${turnedPos.y}`,
    );
    t.assert(turned.coaster.train.running && turned.coaster.train.speed > 0, `the train is not running: ${JSON.stringify(turned.coaster.train)}`);
    // Front seat (E): a head again, turned about the car's up.
    await t.call('interact');
    await t.wait(0.3);
    look = await at(4, cy, 1);
    t.assert(look.view === 1 && look.seat, `not the front seat: ${JSON.stringify(look)}`);
    t.near(look.yaw, -121, -105, 'front seat, pointer left: yaw (deg)');
    t.near(look.cameraYaw, -121, -105, 'front seat, pointer left: camera yaw (deg)');
    look = await at(cx, cy, 1);
    t.near(look.yaw, -0.5, 0.5, 'front seat, pointer at the centre: yaw (deg)');
    t.finite(look, 'rideLook');
    // The right stick holds the head turned while pushed and lets it ease back to forward.
    await t.call('gamepadFeed', { axes: [0, 0, 1, -1] });
    await t.wait(1);
    look = await t.call('rideLook');
    t.assert(look.source === 'pad', `pad not the look's source: ${JSON.stringify(look)}`);
    t.near(look.yaw, 70, 90, 'right stick up-right: yaw (deg)');
    t.near(look.pitch, 30, 40, 'right stick up-right: pitch (deg)');
    await t.call('gamepadFeed', { axes: [0, 0, 0, 0] });
    await t.wait(1);
    look = await t.call('rideLook');
    t.near(look.yaw, -0.5, 0.5, 'right stick let go: yaw (deg)');
    await t.call('gamepadFeed', null);
    // Off the ride: nothing turns.
    await t.call('teleport', 1000, 1000);
    await t.wait(0.2);
    look = await t.call('rideLook');
    t.assert(!look.active && look.yaw === 0 && look.cameraYaw === 0, `look still turned off the ride: ${JSON.stringify(look)}`);
  } finally {
    await t.call('gamepadFeed', null);
    await t.call('holdSimulation', false);
    // Hints back to naming keys for the tests that follow on this page.
    await t.keys('ShiftLeft', 0.1, { real: true });
  }
}
