// The crowd and the traffic in the chase view (chase-rules.js IN VIEW, SPAWN SPOTS, LEAN): on Broadway at five
// in the afternoon the street ahead of the camera has people and cars on it, the streams count round a centre
// leaned the camera's way, and nobody and no car appears in view or vanishes from it (viewPopAudit) while the
// camera turns, while the player walks down the street, or while they drive.
export default async function (t) {
  const M = 8;
  const audit = async (what, seconds, keys, turn) => {
    const a = await t.call('viewPopAudit', seconds, keys, turn);
    t.note(`${what}: ` + JSON.stringify(a));
    t.assert(!a.people.popIn && !a.people.popOut, `${what}: people popped in or out of view: ` + JSON.stringify(a));
    t.assert(!a.vehicles.popIn && !a.vehicles.popOut, `${what}: vehicles popped in or out of view: ` + JSON.stringify(a));
    return a;
  };
  await t.call('god', true);
  try {
    await t.call('setClock', 17);
    await t.call('viewMode', 'chase');
    await t.call('teleport', 1152, 3500); // a Broadway avenue, looking north up it
    await t.wait(6);
    await t.call('chaseLook', 0, 0, -90, 9);
    const r = await t.call('viewRules'),
      s = await t.call('status');
    t.note('seen after the settle: ' + JSON.stringify(r.seen));
    t.near((s.y - r.crowdCentre[1]) / M, 55, 70, 'crowd centre leaned up the street (m)');
    t.near((s.y - r.trafficCentre[1]) / M, 85, 100, 'traffic centre leaned up the street (m)');
    const turning = await audit('turning 60 deg/s', 12, [], 60);
    t.near(turning.people.seen, 8, 400, 'people seen while turning (average)');
    t.near(turning.vehicles.seen, 1.5, 100, 'vehicles seen while turning (average)');
    await t.call('chaseLook', 0, 0, -90, 9);
    const walking = await audit('walking up the avenue', 8, ['KeyW'], 0);
    t.near(walking.people.seen, 8, 400, 'people seen while walking (average)');
    await t.call('teleport', 1650, 3600);
    await t.call('drive', 'sedan', 0, -Math.PI / 2);
    await t.wait(3);
    const driving = await audit('driving north', 10, ['KeyW'], 0);
    t.near(driving.vehicles.seen, 1.5, 100, 'vehicles seen while driving (average)');
  } finally {
    await t.call('viewMode', 'street');
    await t.call('god', false);
  }
}
