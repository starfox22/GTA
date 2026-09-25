// City layout overlap audit.
//
//   node tools/layout-audit.mjs [html] [layout.json]
//
// Boots the build headlessly, reads DeadEndCity.layout() (the plan as data) and
// reports structures that overlap where they should not: rail decks over
// buildings, helipads, ships, docks or marina berths; piers in roads or
// buildings; bridge footings on docks, ships or rail piers and bridge towers
// through rail decks or buildings; station platforms on buildings; buildings on buildings, roads,
// parks, water or the beach; roads over helipads; roads crossing other roads at
// an oblique angle (usually a junction, sometimes a road painted over a road);
// trees, lamps and benches standing in a carriageway; visible barriers (sea
// railing, street-end guardrails, gate piers and railings) without a collider;
// street props and fixtures in a carriageway, a building, the water, a doorway
// or on each other; street-end guardrails in a building or another carriageway;
// crosswalks leading into a building or a park. Passing a JSON path also
// saves the layout, which is handy for drawing the plan. See
// docs/audit/world-layout.md for what the last run found.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] || 'dead-end-city.html');
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--disable-accelerated-2d-canvas', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto('file://' + file + '?dev', { timeout: 1800000, waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.DeadEndCity, null, { timeout: 2400000 });
// The props and foot obstacles are registered by the 3D renderer, which is built
// once the game starts: start one so layout() carries them.
await page.waitForSelector('#startBtn', { state: 'visible', timeout: 2400000 });
await page.click('#startBtn', { timeout: 2400000 });
await page.waitForFunction(() => window.DeadEndCity.layout().props.length > 0, null, { timeout: 2400000, polling: 5000 }).catch(() => {});
const L = await page.evaluate(() => window.DeadEndCity.layout());
// Visible barriers against the collision code: every barrier line sampled every
// 3 units must be solid() for a thin probe, and every street-end guardrail,
// gate pier and railing solid through its footprint.
const barrierGaps = await page.evaluate(() => {
  const D = window.DeadEndCity, B = D.barriers(), gaps = [];
  for (const r of B.rails) {
    const n = Math.max(1, Math.floor(Math.hypot(r.x1 - r.x0, r.y1 - r.y0) / 3)), pts = [];
    for (let i = 0; i <= n; i++) pts.push([r.x0 + ((r.x1 - r.x0) * i) / n, r.y0 + ((r.y1 - r.y0) * i) / n]);
    D.solidAt(pts, 0.5).forEach((v, i) => v || gaps.push('sea railing (' + pts[i].map(Math.round) + ')'));
  }
  for (const b of B.streetEnds) {
    const pts = [];
    for (let x = b.x + 0.5; x < b.x + b.w; x += 2) for (let y = b.y + 0.5; y < b.y + b.h; y += 2) pts.push([x, y]);
    D.solidAt(pts, 0.3).forEach((v, i) => v || gaps.push(b.kind + ' (' + pts[i].map(Math.round) + ')'));
  }
  return { rails: B.rails.length, ends: B.streetEnds.length, gaps };
});
await browser.close();
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(L));

// Oriented boxes {x, y, hx, hy, a} and a separating-axis overlap test.
const rectBox = (r, pad = 0) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, hx: r.w / 2 + pad, hy: r.h / 2 + pad, a: 0 });
const square = (x, y, h) => ({ x, y, hx: h, hy: h, a: 0 });
function corners(b) {
  const c = Math.cos(b.a || 0), s = Math.sin(b.a || 0);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [b.x + u * b.hx * c - v * b.hy * s, b.y + u * b.hx * s + v * b.hy * c]);
}
function overlap(A, B) {
  const ca = corners(A), cb = corners(B);
  for (const b of [A, B])
    for (const ang of [b.a || 0, (b.a || 0) + Math.PI / 2]) {
      const ax = Math.cos(ang), ay = Math.sin(ang);
      const pa = ca.map((p) => p[0] * ax + p[1] * ay), pb = cb.map((p) => p[0] * ax + p[1] * ay);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  return true;
}
const shrink = (b, d) => ({ ...b, hx: b.hx - d, hy: b.hy - d });
function inside(x, y, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) hit = !hit;
  }
  return hit;
}
const land = (x, y) => !L.lakes.some((p) => inside(x, y, p)) && L.land.some((r) => inside(x, y, r.polygon));
const roadBoxes = [
  ...L.streets.map((r) => ({ ...r, name: 'street ' + JSON.stringify(r.points) })),
  ...L.boulevards,
  ...L.countyRoads,
].flatMap((r) =>
  r.points.slice(1).map((b, i) => {
    const a = r.points[i];
    return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, hx: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, hy: r.width / 2, a: Math.atan2(b[1] - a[1], b[0] - a[0]), name: r.name };
  }),
);
const buildings = L.buildings.map((b) => ({ ...rectBox(b), src: b }));
const pads = L.helipads.map((h) => ({ ...square(h.x, h.y, 49), name: h.name }));
const at = (b) => '(' + Math.round(b.x) + ', ' + Math.round(b.y) + ')';
const found = [];
const report = (kind, text) => found.push({ kind, text });

for (const d of L.railDecks) {
  for (const b of buildings) if (overlap(d, b)) report('rail deck over building', at(d) + ' ' + JSON.stringify(b.src));
  for (const p of pads) if (overlap(d, p)) report('rail deck over helipad', at(d) + ' ' + p.name);
  for (const s of L.ships) if (overlap(d, s)) report('rail deck over ship', at(d) + ' ' + s.name);
  for (const k of L.docks) if (overlap(d, rectBox(k, 10))) report('rail deck over dock', at(d));
  const m = L.marina.basin;
  if (overlap(d, rectBox({ x: m.x, y: m.y + 60, w: m.w, h: m.h - 60 }))) report('rail deck over marina berths', at(d));
}
for (const p of L.railPiers) {
  const P = rectBox(p);
  for (const r of roadBoxes) if (overlap(P, r)) report('rail pier in road', at(P) + ' ' + r.name);
  for (const b of buildings) if (overlap(P, b)) report('rail pier in building', at(P));
}
// Bridge footings in the water and towers over the deck (bridgeStructure).
for (const br of L.bridges || []) {
  for (const f of br.footings || []) {
    for (const k of L.docks) if (overlap(f, rectBox(k, 4))) report('bridge footing on dock', br.name + ' ' + at(f));
    for (const s of L.ships) if (overlap(f, s)) report('bridge footing on ship', br.name + ' ' + s.name);
    for (const p of L.railPiers) if (overlap(f, rectBox(p))) report('bridge footing on rail pier', br.name + ' ' + at(f));
  }
  for (const t of br.pylons || []) {
    for (const d of L.railDecks) if (overlap(t, d)) report('bridge tower through rail deck', br.name + ' ' + at(t));
    for (const b of buildings) if (overlap(t, b)) report('bridge tower in building', br.name + ' ' + at(t));
  }
}
for (const s of L.stations) {
  const d = L.railDecks.reduce((best, d) => (Math.hypot(d.x - s.x, d.y - s.y) < Math.hypot(best.x - s.x, best.y - s.y) ? d : best));
  const platforms = { x: s.x, y: s.y, hx: 88, hy: 47, a: d.a };
  for (const b of buildings) if (overlap(platforms, b)) report('station on building', s.name);
  for (const p of pads) if (overlap(platforms, p)) report('station over helipad', s.name);
  if (!land(s.entry.x, s.entry.y)) report('station entry in water', s.name);
}
for (let i = 0; i < buildings.length; i++) {
  const b = buildings[i], src = b.src;
  for (let j = i + 1; j < buildings.length; j++)
    if (overlap(shrink(b, 0.5), buildings[j])) report('building on building', JSON.stringify(src) + ' ' + JSON.stringify(buildings[j].src));
  for (const r of roadBoxes) if (overlap(shrink(b, 1), r)) report('building on road', JSON.stringify(src) + ' ' + r.name);
  for (const p of L.parks) if (overlap(shrink(b, 1), rectBox(p))) report('building in park', JSON.stringify(src) + ' ' + p.name);
  for (const p of pads) if (overlap(b, p)) report('building on helipad', p.name);
  const edge = [[src.x, src.y], [src.x + src.w, src.y], [src.x, src.y + src.h], [src.x + src.w, src.y + src.h], [src.x + src.w / 2, src.y], [src.x + src.w / 2, src.y + src.h], [src.x, src.y + src.h / 2], [src.x + src.w, src.y + src.h / 2]];
  if (edge.some(([x, y]) => !land(x, y))) report('building in water', JSON.stringify(src));
  if (L.beach && inside(src.x + src.w / 2, src.y + src.h / 2, L.beach.polygon) && land(src.x + src.w / 2, src.y + src.h / 2)) report('building on beach', JSON.stringify(src));
}
for (const p of pads) for (const r of roadBoxes) if (overlap(p, r)) report('road over helipad', p.name + ' ' + r.name);
for (let i = 0; i < roadBoxes.length; i++)
  for (let j = i + 1; j < roadBoxes.length; j++) {
    const a = roadBoxes[i], b = roadBoxes[j], skew = Math.abs(Math.sin(a.a - b.a));
    if (a.name !== b.name && skew > 0.05 && skew < 0.9 && overlap(shrink(a, 4), shrink(b, 4)))
      report('oblique road overlap (check it is a junction)', a.name + ' x ' + b.name + ' near ' + at(a));
  }
const onRoad = (x, y, h) => roadBoxes.find((r) => overlap(square(x, y, h), r));
for (const [x, y] of L.trees) if (onRoad(x, y, 3)) report('tree in carriageway', x + ', ' + y + ' ' + onRoad(x, y, 3).name);
for (const [x, y] of L.lamps) if (onRoad(x, y, 2)) report('lamp in carriageway', x + ', ' + y);
for (const [x, y] of L.benches) if (onRoad(x, y, 2)) report('bench in carriageway', x + ', ' + y);
for (const [x, y] of L.trees) {
  if (!land(x, y) && !(L.docks || []).some((d) => x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h)) report('tree in water', x + ', ' + y);
  if (L.buildings.some((b) => x > b.x + 2 && x < b.x + b.w - 2 && y > b.y + 2 && y < b.y + b.h - 2)) report('tree inside building', x + ', ' + y);
}

// Barriers drawn without a collider (see above).
for (const g of barrierGaps.gaps) report('visible barrier without collider', g);
// Street furniture: knockable props and registered foot obstacles must not
// stand in a carriageway (bus stop boxes and bollards at kerbs are on the
// pavement side), inside a building, off the land or in a doorway.
const insideBuilding = (x, y, pad = 0) => L.buildings.find((b) => x > b.x + pad && x < b.x + b.w - pad && y > b.y + pad && y < b.y + b.h - pad);
const onLandOrDeck = (x, y) => land(x, y) || L.docks.some((d) => x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h);
for (const p of L.props || []) {
  // Half the narrow side: a long railing run or bench is tested by its width.
  const h = Math.min(p.hx, p.hy);
  if (onRoad(p.x, p.y, h * 0.5)) report('prop in carriageway', p.kind + ' ' + p.x + ', ' + p.y + ' ' + onRoad(p.x, p.y, h * 0.5).name);
  if (insideBuilding(p.x, p.y, 1)) report('prop inside building', p.kind + ' ' + p.x + ', ' + p.y);
  if (!onLandOrDeck(p.x, p.y)) report('prop in water', p.kind + ' ' + p.x + ', ' + p.y);
  for (const d of L.doors || []) if (Math.hypot(p.x - d.x, p.y - d.y) < 10) report('prop in doorway', p.kind + ' ' + p.x + ', ' + p.y + ' at ' + d.name);
}
for (const o of L.footObstacles || []) {
  const h = o.r ?? Math.max(o.hx, o.hy);
  if (h < 12 && onRoad(o.x, o.y, 0.5)) report('fixture in carriageway', Math.round(o.x) + ', ' + Math.round(o.y) + ' ' + onRoad(o.x, o.y, 0.5).name);
  if (insideBuilding(o.x, o.y, 2)) report('fixture inside building', Math.round(o.x) + ', ' + Math.round(o.y));
  if (!onLandOrDeck(o.x, o.y)) report('fixture in water', Math.round(o.x) + ', ' + Math.round(o.y));
}
// Knockable props standing on top of each other.
const props = L.props || [];
for (let i = 0; i < props.length; i++)
  for (let j = i + 1; j < props.length; j++) {
    const a = props[i], b = props[j];
    if (Math.abs(a.x - b.x) > 20 || Math.abs(a.y - b.y) > 20 || (a.x === b.x && a.y === b.y && a.kind === b.kind)) continue;
    // Consecutive runs of the sea railing meet (and cross) at the quay's bends.
    if (a.kind === 'railing' && b.kind === 'railing') continue;
    if (overlap({ x: a.x, y: a.y, hx: a.hx, hy: a.hy, a: a.a }, { x: b.x, y: b.y, hx: b.hx, hy: b.hy, a: b.a })) report('prop on prop', a.kind + ' ' + a.x + ', ' + a.y + ' / ' + b.kind + ' ' + b.x + ', ' + b.y);
  }
// Street ends: a closed end is a kerb and guardrail, never a painted circle;
// check none sits on a building or a park, and that its guardrail is not in
// another carriageway.
for (const e of L.streetEnds || []) {
  const ux = Math.round(Math.cos(e.a)), uy = Math.round(Math.sin(e.a));
  const railBox = { x: e.x + ux * 4, y: e.y + uy * 4, hx: ux ? 2 : e.width / 2 + 2, hy: ux ? e.width / 2 + 2 : 2, a: 0 };
  for (const b of buildings) if (overlap(railBox, b)) report('street end in building', e.x + ', ' + e.y);
  const crossing = roadBoxes.find((r) => overlap(shrink(railBox, 1), r));
  if (crossing) report('street end rail in carriageway', e.x + ', ' + e.y + ' ' + crossing.name);
}
// Crosswalks (cityCrosswalks, streets.js) must not lead into a building or a
// park, and both ends must be on land.
for (const c of L.crosswalks || []) {
  const box = rectBox(c), along = c.w > c.h;
  if (buildings.some((b) => overlap(box, b)) || L.parks.some((p) => overlap(box, rectBox(p)))) report('crosswalk into building or park', at(box));
  const ends = along ? [[c.x - 10, box.y], [c.x + c.w + 10, box.y]] : [[box.x, c.y - 10], [box.x, c.y + c.h + 10]];
  if (ends.some(([ex, ey]) => !land(ex, ey))) report('crosswalk into water', at(box));
}

const counts = {};
for (const f of found) counts[f.kind] = (counts[f.kind] || 0) + 1;
console.log('rail:', L.rail.map((l) => l.name + ' ' + l.points.length + ' points').join(', '), '| decks', L.railDecks.length, '| piers', L.railPiers.length, '| stations', L.stations.length);
console.log('barriers:', barrierGaps.rails, 'sea railing runs,', barrierGaps.ends, 'street-end pieces |', (L.props || []).length, 'props,', (L.footObstacles || []).length, 'foot obstacles');
console.log(Object.keys(counts).length ? counts : 'no overlaps found');
for (const f of found) console.log(f.kind + ': ' + f.text);
