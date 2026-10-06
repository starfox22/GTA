// The chase view (chase-camera.js): viewMode('chase') and back to 'street', and the camera standing behind the
// player (the player ahead of it along its heading, a few metres off) right after the switch and after a teleport.
export default async function (t) {
  const M = 8;
  const behind = async (label) => {
    const s = await t.call('status'),
      c = await t.call('chaseCamera');
    t.assert(c.live && c.ready, `${label}: the chase camera is not live and placed: ` + JSON.stringify(c));
    const yaw = (c.yawDeg * Math.PI) / 180,
      dx = s.x - c.position[0],
      dy = s.y - c.position[1],
      ahead = dx * Math.cos(yaw) + dy * Math.sin(yaw);
    t.near(Math.hypot(dx, dy) / M, 0.5, 6, `${label}: camera to player (m)`);
    t.assert(ahead > 0.5 * M, `${label}: the player is not ahead of the camera: ` + JSON.stringify({ player: [s.x, s.y], camera: c.position, yaw: c.yawDeg }));
  };
  try {
    let v = await t.call('viewMode', 'street');
    t.assert(v.mode === 'street' && !v.live, 'not the street view: ' + JSON.stringify(v));
    // A round trip with the simulation held changes nothing the street rules read. (The street zoom eases in
    // the frame loop, held or not: what depends on it is compared only when it stood still between the reads.)
    await t.call('teleport', 748, 584);
    await t.wait(0.5);
    await t.call('holdSimulation', true);
    try {
      const read = async () => {
        const r = await t.call('viewRules', 900, 700, 70),
          zoom = r.point.zoom,
          sized = [r.playerBox, r.point.half, r.point.screenHalf, (await t.call('hudClearance')).player];
        delete r.playerBox;
        delete r.point.half;
        delete r.point.screenHalf;
        delete r.point.zoom;
        return { zoom, rules: JSON.stringify([r, (await t.call('trafficReport')).ring]), sized: JSON.stringify(sized) };
      };
      const before = await read();
      await t.call('viewMode', 'chase');
      await t.call('viewMode', 'street');
      const after = await read();
      t.assert(before.rules === after.rules, 'the street rules read differently after a round trip: ' + before.rules + ' / ' + after.rules);
      if (before.zoom === after.zoom) t.assert(before.sized === after.sized, 'the street boxes differ after a round trip: ' + before.sized + ' / ' + after.sized);
      else t.note(`the street zoom eased from ${before.zoom} to ${after.zoom} meanwhile: boxes not compared`);
    } finally {
      await t.call('holdSimulation', false);
    }
    v = await t.call('viewMode', 'chase');
    t.assert(v.mode === 'chase' && v.live, 'viewMode chase did not switch: ' + JSON.stringify(v));
    t.assert((await t.call('viewMode')).mode === 'chase', 'viewMode() does not report the chase view');
    await t.wait(0.2);
    await behind('after the switch');
    await t.call('teleport', 1500, 1500);
    await t.wait(0.1);
    await behind('after a teleport');
    v = await t.call('viewMode', 'street');
    t.assert(v.mode === 'street' && !v.live, 'not back in the street view: ' + JSON.stringify(v));
    t.assert((await t.call('viewRules')).view === 'street', 'the rules still ask the chase camera');
  } finally {
    await t.call('viewMode', 'street');
  }
}
