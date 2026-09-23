// City layout overlap audit.
//
//   node tools/layout-audit.mjs [html] [layout.json]
//
// Boots the build headlessly, reads DeadEndCity.layout() (the plan as data) and
// reports structures that overlap where they should not: rail decks over
// buildings, helipads, ships, docks or marina berths; piers in roads or
// buildings; station platforms on buildings; buildings on buildings, roads,
// parks, water or the beach; roads over helipads; roads crossing other roads at
// an oblique angle (usually a junction, sometimes a road painted over a road);
// trees, lamps and benches standing in a carriageway. Passing a JSON path also
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
await page.goto('file://' + file + '?dev', { timeout: 300000, waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.DeadEndCity, null, { timeout: 180000 });
const L = await page.evaluate(() => window.DeadEndCity.layout());
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

const counts = {};
for (const f of found) counts[f.kind] = (counts[f.kind] || 0) + 1;
console.log('rail:', L.rail.map((l) => l.name + ' ' + l.points.length + ' points').join(', '), '| decks', L.railDecks.length, '| piers', L.railPiers.length, '| stations', L.stations.length);
console.log(Object.keys(counts).length ? counts : 'no overlaps found');
for (const f of found) console.log(f.kind + ': ' + f.text);
