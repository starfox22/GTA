// God mode's TELEPORT map (god-panel.js TELEPORT PICK, god-panel.css): the map takes the whole panel
// (most of the window's height; the hint banner used to push it into the 250-pixel side column), and
// a real click anywhere on it teleports the player there and closes the map.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  await t.call('teleport', 1152, 1300);
  const pick = await t.call('godTeleportPick');
  t.assert(pick.picking, 'the TELEPORT map did not open in pick mode: ' + JSON.stringify(pick));
  await t.realWait(0.3);
  const view = (await t.call('mapView')).bigmap,
    [vw, vh] = view.shown.viewport;
  t.note(`map on screen ${view.shown.width} x ${view.shown.height} of ${vw} x ${vh}; pixels ${view.width} x ${view.height}`);
  t.assert(view.shown.height >= vh * 0.75, 'the TELEPORT map should fill most of the window height: ' + JSON.stringify(view));
  t.assert(view.width >= view.shown.width * 0.95, 'the map canvas pixels were not refitted to the big box: ' + JSON.stringify(view));
  // Click Monarch Harbour on the map.
  const target = { x: 6400, y: -2000 },
    at = await t.call('mapScreenPoint', target.x, target.y);
  t.assert(at, 'the target is not on the map');
  await t.mouse(at.x, at.y, { seconds: 0.15, down: true });
  await t.realWait(0.3);
  const s = await t.call('status'),
    panel = await t.call('godPanel'),
    off = Math.hypot(s.x - target.x, s.y - target.y);
  t.note(`clicked (${at.x}, ${at.y}) → player at (${s.x}, ${s.y}), ${Math.round(off)} units from the target; ${panel.lastTeleport?.message}`);
  t.assert(s.mode === 'play' && !panel.picking, 'the map should close after the teleport: ' + s.mode);
  t.assert(off < 120, 'the click did not teleport the player to the clicked place: ' + JSON.stringify(s));
  await t.call('god', false);
}
