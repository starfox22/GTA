// The HUD in the chase view (chase-view.css, chase-hud.js): the mission card and its key strip move to the left,
// standing on the minimap, off the player who stands low in the middle of the frame, so a fresh card stays open on
// foot and in a car (radio open, three stars and their dispatch caption); no two HUD boxes overlap on the 960x600
// window (hudOverlaps), and nothing but the reticle sits over the player; the street view puts the card back.
export const fresh = true;
// CSS pop-ins (the card, the radio, the notices) run on the wall clock: let them finish before reading the boxes.
const settle = () => new Promise((r) => setTimeout(r, 900));
export default async function (t) {
  const boxOf = (o, id) => o.boxes.find((b) => b.id === id);
  const check = async (what) => {
    await t.call('hudClearance', 'read');
    await settle();
    await t.wait(0.2);
    // The card pops in on the wall clock (and a fresh page's first card a moment later): wait for it to show.
    let o = await t.call('hudOverlaps');
    for (let i = 0; i < 6 && !boxOf(o, 'pager'); i++) {
      await settle();
      o = await t.call('hudOverlaps');
    }
    const c = await t.call('hudClearance');
    t.assert(o.viewport[0] === 960 && o.viewport[1] === 600, 'not the 960x600 window: ' + o.viewport);
    t.assert(!o.overlaps.length, `${what}: HUD boxes overlap: ` + JSON.stringify(o.overlaps));
    const pager = boxOf(o, 'pager'),
      nav = boxOf(o, 'navigation');
    const map = boxOf(o, 'minimapBox');
    t.assert(pager && pager.l < 40 && pager.r < 330 && map && pager.b <= map.t, `${what}: the card does not stand on the minimap: ` + JSON.stringify({ pager, map }));
    t.assert(!c.folded && !c.yielding, `${what}: the card folded for the player: ` + JSON.stringify(c));
    const over = (o.overPlayer || []).filter((id) => id !== 'chaseReticle' && id !== 'interaction');
    t.assert(!over.length, `${what}: HUD boxes over the player: ` + JSON.stringify({ over, player: c.player }));
    return o;
  };
  await t.call('god', true);
  try {
    await t.call('viewMode', 'chase');
    await t.call('teleport', 748, 584);
    await t.wait(0.4);
    await check('chase view on foot');
    await t.call('wanted', 3);
    await t.wait(0.3);
    await check('chase view on foot, three stars');
    await t.call('wanted', 0);
    await t.call('drive', 'sedan', 0, 0);
    await t.wait(1);
    await check('chase view in a car');
    await t.call('viewMode', 'street');
    await t.wait(0.3);
    await settle();
    const o = await t.call('hudOverlaps'),
      pager = boxOf(o, 'pager');
    t.assert(pager && pager.t > 300, 'street view: the card did not go back to the bottom: ' + JSON.stringify(pager));
  } finally {
    await t.call('wanted', 0);
    await t.call('viewMode', 'street');
    await t.call('god', false);
  }
}
