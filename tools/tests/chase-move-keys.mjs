// The movement keys after switching to the chase view (chase-camera.js KEYS ON A FRESH CAMERA, the on-foot follow's
// CHASE_FOLLOW_ARC, CURSOR LOOK): W, A, S and D go along, left of, against and right of the camera's heading after
// V switches (real key presses) several times, with W held across the switch (it keeps the way the player ran and
// the camera stands behind it), after a look round and after getting out of a car; a sideways run never swings the
// camera round (no circles), and a cursor left near the screen's edge does not turn the camera before it is captured.
// Other camera tests spawn and leave parked cars; use a clean world for the
// unobstructed foot paths below, rather than running into their sedan at 1560,1500.
export const fresh = true;
const OFFSETS = { KeyW: 0, KeyD: 90, KeyS: 180, KeyA: -90 };
const diff = (a, b) => ((a - b + 540) % 360) - 180;

export default async function (t) {
  await t.call('god', true);
  // Turn one way, then the other: the camera's heading is checked between the two (a following camera turns it).
  const travel = async (code, seconds = 0.3) => {
    const cam = await t.call('chaseCamera'),
      a = await t.call('status');
    await t.keys(code, seconds);
    const b = await t.call('status'),
      after = await t.call('chaseCamera'),
      metres = Math.hypot(b.x - a.x, b.y - a.y) / 8;
    t.assert(metres > 1, `${code} moved the player only ${metres.toFixed(2)} m`);
    return { went: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, yaw: cam.yawDeg, yawAfter: after.yawDeg };
  };
  const fourKeys = async (label) => {
    for (const code of Object.keys(OFFSETS)) {
      const r = await travel(code);
      t.near(Math.abs(diff(r.went, r.yaw + OFFSETS[code])), 0, 12, `${label}: ${code} off the camera's ${OFFSETS[code]} deg (deg)`);
      t.near(Math.abs(diff(r.yawAfter, r.yaw)), 0, 4, `${label}: the camera turned during ${code} (deg)`);
    }
  };
  try {
    await t.call('settings', { cameraView: 'street' });
    await t.call('teleport', 1500, 1500); // open ground on every side (chase-walk.mjs)
    await t.wait(0.2);

    // A last chase view that looked east, then the street view: running north (up the screen) with W.
    await t.call('viewMode', 'chase');
    await t.call('chaseLook', 0, 0, 0, 9);
    await t.wait(0.1);
    await t.call('viewMode', 'street');
    await t.keys('KeyW', 0.15);
    // V pressed (a real key) with the run going on: the keys took the stale east heading for the first step and the
    // camera started behind that; now the run keeps going north and the camera stands behind it. The simulation is
    // held so that the first step after the switch is the one with W held (the live loop does not step between).
    await t.call('holdSimulation', true);
    const a = await t.call('status');
    await t.keys('KeyV', 0.1, { real: true });
    await t.keys('KeyW', 0.3);
    const b = await t.call('status');
    await t.call('holdSimulation', false);
    let cam = await t.call('chaseCamera');
    t.assert(cam.mode === 'chase' && cam.ready, `V did not switch to a placed chase view: ${JSON.stringify(cam)}`);
    t.near(Math.abs(diff((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, -90)), 0, 15, 'W held across the switch: off north (deg)');
    t.near(Math.abs(diff(cam.yawDeg, -90)), 0, 15, 'W held across the switch: the camera off behind the run (deg)');
    const w = await travel('KeyW');
    t.near(Math.abs(diff(w.went, w.yaw)), 0, 12, "after the switch: W off the camera's heading (deg)");

    // Several switches back and forth (real V), ending in the chase view: every key against the camera, and no
    // key swings the camera round (the follow only takes a run near its own heading).
    for (let i = 0; i < 5; i++) {
      await t.keys('KeyV', 0.1, { real: true });
      await t.keys('KeyD', 0.15);
    }
    cam = await t.call('chaseCamera');
    t.assert(cam.mode === 'street', `five V presses from the chase view should end in the street view, not ${cam.mode}`);
    await t.keys('KeyV', 0.1, { real: true });
    cam = await t.call('chaseCamera');
    t.assert(cam.mode === 'chase', `not back in the chase view: ${cam.mode}`);
    await t.wait(0.1);
    await fourKeys('after six switches');

    // A long sideways run with no look: no circle (the way it went may bend on a wall; the camera must not turn).
    const side = await travel('KeyD', 3);
    t.near(Math.abs(diff(side.yawAfter, side.yaw)), 0, 6, 'three seconds of D: the camera turned (deg)');
    const diag = await travel(['KeyW', 'KeyD'], 3);
    t.near(Math.abs(diff(diag.yawAfter, diag.yaw)), 0, 6, 'three seconds of W+D: the camera turned (deg)');
    await t.call('teleport', 1500, 1500);
    await t.wait(0.1);
    const diag2 = await travel(['KeyW', 'KeyD']);
    t.near(Math.abs(diff(diag2.went, diag2.yaw + 45)), 0, 12, "W+D off the camera's 45 deg (deg)");

    // After a look round.
    await t.call('chaseLook', 0, 0, 150, 9);
    await fourKeys('after a look round');
    await t.call('chaseLook', 600, 0);
    await fourKeys('after a mouse turn');

    // After getting out of a car (the camera hands over from the car's heading).
    await t.call('teleport', 1500, 1500);
    await t.call('drive', 'sedan', 0, 0);
    await t.keys('KeyW', 1.2);
    await t.call('interact');
    await t.wait(0.8);
    t.assert(!(await t.call('status')).vehicle, 'still in the car');
    await fourKeys('after getting out of a car');

    // After a teleport with keys held: the fresh camera is placed where the keys took its heading.
    await t.call('teleport', 1500, 1500);
    const tp = await travel(['KeyW', 'KeyD']);
    t.near(Math.abs(diff(tp.went, tp.yawAfter + 45)), 0, 12, "after a teleport: W+D off the fresh camera's 45 deg (deg)");

    // CURSOR LOOK waits for a refused capture: a cursor left by the screen's edge does not turn the camera.
    const y0 = (await t.call('chaseCamera')).yawDeg;
    await t.mouse(15, 300, { seconds: 0.8 }); // the dev page is 960x600
    await t.mouse(480, 300);
    t.near(Math.abs(diff((await t.call('chaseCamera')).yawDeg, y0)), 0, 2, 'cursor at the edge before any capture: camera turn (deg)');
  } finally {
    await t.call('holdSimulation', false);
    await t.call('viewMode', 'street');
    await t.call('god', false);
  }
}
