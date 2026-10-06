// hudPlayerBox in the chase view (hud-clearance.js, chase-rules.js chasePlayerBox): the player's box on screen is
// the corners of their body (or their vehicle) through the chase camera, so it holds the projected centre of the
// player, sits round it, and is what hudClearance() reports; in the chase view the open card yields to it.
export default async function (t) {
  const check = async (what) => {
    const r = await t.call('viewRules'),
      box = r.playerBox,
      at = r.playerScreen;
    t.assert(box && at, `${what}: no player box or point: ` + JSON.stringify(r));
    const w = box.r - box.l,
      h = box.b - box.t;
    t.assert(w > 4 && h > 4, `${what}: an empty box: ` + JSON.stringify(box));
    t.assert(at.x > box.l && at.x < box.r && at.y > box.t && at.y < box.b, `${what}: the box misses the player: ` + JSON.stringify({ box, at }));
    t.near(Math.abs((box.l + box.r) / 2 - at.x) / w, 0, 0.2, `${what}: box centre off the player across (share of its width)`);
    t.near(Math.abs((box.t + box.b) / 2 - at.y) / h, 0, 0.2, `${what}: box centre off the player up and down (share of its height)`);
    const c = await t.call('hudClearance');
    t.assert(c.player && Math.abs(c.player.l - box.l) <= 1 && Math.abs(c.player.b - box.b) <= 1, `${what}: hudClearance has another box: ` + JSON.stringify({ c: c.player, box }));
    return { box, at };
  };
  await t.call('god', true);
  try {
    await t.call('viewMode', 'chase');
    await t.call('teleport', 748, 584);
    await t.wait(0.3);
    const foot = await check('on foot');
    t.note('on foot: ' + JSON.stringify(foot));
    await t.call('drive', 'sedan', 0, 0);
    // The camera's hand-over into the car and its boom running out settle in about a second and a half.
    await t.wait(2);
    const car = await check('in a sedan');
    t.note('in a sedan: ' + JSON.stringify(car));
    t.assert(car.box.r - car.box.l > foot.box.r - foot.box.l, 'the car is no wider on screen than the person');
    // The open card yields where it would cover the player (the rule does not care which camera).
    await t.call('hudClearance', 'read');
    await new Promise((r) => setTimeout(r, 900));
    await t.wait(0.2);
    const c = await t.call('hudClearance');
    if (c.open && c.player && c.open.r > c.player.l && c.open.l < c.player.r && c.open.b > c.player.t && c.open.t < c.player.b)
      t.assert(c.folded && c.yielding, 'the open card covers the player in the chase view: ' + JSON.stringify(c));
    else t.note('the card and the player do not meet: ' + JSON.stringify(c));
  } finally {
    await t.call('viewMode', 'street');
    await t.call('god', false);
  }
}
