// crowdInView in the chase view (crowd-space.js, chase-rules.js IN VIEW) is the chase camera's frustum: it gives
// the same answer as chaseSees (chase-camera.js) on the same sphere for points all round the camera and margins
// from -30 to 300 units, sees what lies ahead within the 200 m sight reach, and not what is behind the camera,
// off to the side or beyond the reach. The street view's crowdInView is the footprint round cameraTarget.
export default async function (t) {
  const M = 8;
  await t.call('god', true);
  await t.call('holdSimulation', true);
  try {
    await t.call('viewMode', 'chase');
    await t.call('teleport', 748, 584);
    await t.wait(0.2);
    await t.call('chaseLook', 0, 0, 0, 9);
    const cam = await t.call('chaseCamera'),
      yaw0 = (cam.yawDeg * Math.PI) / 180,
      [x0, y0] = cam.position,
      point = async (deg, metres, margin = 0) => {
        const a = yaw0 + (deg * Math.PI) / 180;
        return (await t.call('viewRules', x0 + Math.cos(a) * metres * M, y0 + Math.sin(a) * metres * M, margin)).point;
      };
    let checked = 0;
    for (const deg of [0, 30, 38, 45, 90, 180, -25, -60])
      for (const metres of [2, 10, 60, 190, 215])
        for (const margin of [-30, 0, 150]) {
          const p = await point(deg, metres, margin);
          t.assert(p.inView === p.sees, `crowdInView ${p.inView} but chaseSees ${p.sees} at ${deg} deg, ${metres} m, margin ${margin}`);
          checked++;
        }
    t.note(`${checked} points agree`);
    // What it should see.
    const expect = async (deg, metres, margin, want, what) => {
      const p = await point(deg, metres, margin);
      t.assert(p.inView === want, `${what}: crowdInView is ${p.inView} (${deg} deg, ${metres} m, margin ${margin}): ` + JSON.stringify(p));
      return p;
    };
    const ahead = await expect(0, 60, 0, true, 'ahead on the street');
    t.assert(Math.abs(ahead.screen.x - 480) < 20 && ahead.screen.y > 0 && ahead.screen.y < 600, 'ahead is not on screen: ' + JSON.stringify(ahead.screen));
    await expect(180, 30, 0, false, 'behind the camera');
    await expect(70, 30, 0, false, 'off to the side');
    await expect(70, 30, 300, true, 'off to the side, inside a 37 m margin');
    await expect(0, 215, 0, false, 'beyond the sight reach');
    await expect(0, 190, 0, true, 'within the sight reach');

    // The street view: the footprint (crowdViewHalf) round cameraTarget, grown by the margin.
    await t.call('viewMode', 'street');
    await t.call('holdSimulation', false);
    await t.wait(0.5);
    await t.call('holdSimulation', true);
    const s = (await t.call('viewRules', 748, 584)).point,
      [cx, cy] = s.cameraTarget,
      [w, h] = s.half;
    const at = async (x, y, margin) => (await t.call('viewRules', x, y, margin)).point.inView;
    t.assert(await at(cx + w - 5, cy + h - 5, 0), 'street view: a corner inside the footprint is not in view');
    t.assert(!(await at(cx + w + 5, cy, 0)), 'street view: just outside the footprint is in view');
    t.assert(await at(cx + w + 5, cy, 70), 'street view: the margin does not grow the footprint');
    t.assert(!(await at(cx - w - 75, cy, 70)), 'street view: beyond the margin is in view');
  } finally {
    await t.call('holdSimulation', false);
    await t.call('viewMode', 'street');
    await t.call('god', false);
  }
}
