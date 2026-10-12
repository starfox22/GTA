// Browser-free checks of the actual map painter and GPS node selector. Run from any directory:
// node tools/map-navigation-check.mjs [--source-root /path/to/checkout]
// navigationAudit() separately checks the generated world and its real collision field in the browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootArg = process.argv.indexOf('--source-root');
const root = rootArg < 0 ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') : path.resolve(process.argv[rootArg + 1]);
function sourceFunction(file, name) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const start = text.indexOf('    function ' + name + '(');
  const end = text.indexOf('\n    }', start);
  assert(start >= 0 && end > start, 'find actual source function ' + name);
  return text.slice(start, end + '\n    }'.length);
}
const scope = vm.createContext({});
vm.runInContext(sourceFunction('src/navigation.js', 'closestNavNode'), scope);
scope.distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function reference(p, nodes, clear) {
  const candidates = nodes.map((q, i) => ({ i, d: scope.distanceBetween(p, q) }))
    .filter((q) => nodes[q.i].links.length).sort((a, b) => a.d - b.d);
  return (candidates.slice(0, 18).find((q) => q.d < 380 && clear(p, nodes[q.i])) || candidates[0])?.i;
}
let checked = 0, probeChecks = 0, seed = 91917;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
function compare(nodes, p, accepts) {
  const oldProbes = [], newProbes = [];
  const expected = reference(p, nodes, (_a, b) => { oldProbes.push(b.id); return accepts(b); });
  scope.navSegmentClear = (_a, b) => { newProbes.push(b.id); return accepts(b); };
  const actual = scope.closestNavNode(p, nodes);
  assert.equal(actual, expected, 'same node for ' + JSON.stringify(p));
  assert.deepEqual(newProbes, oldProbes, 'same visibility probes in the same order');
  checked++;
  probeChecks += newProbes.length;
}
for (const length of [0, 1, 17, 18, 19, 100, 1000, 4096]) {
  const nodes = Array.from({ length }, (_, id) => ({ id, x: Math.floor(random() * 101 - 50) * 20,
    y: Math.floor(random() * 101 - 50) * 20, links: id % 5 ? [0] : [] }));
  for (let i = 0; i < 100; i++) {
    const p = { x: random() * 2400 - 1200, y: random() * 2400 - 1200 };
    compare(nodes, p, (b) => b.id % 7 === i % 7);
    compare(nodes, p, () => false);
  }
}
// Equal-distance ties keep source order, and a visible nineteenth candidate is never tried.
const tied = Array.from({ length: 30 }, (_, id) => ({ id, x: id % 2 ? 100 : -100, y: 0, links: [0] }));
compare(tied, { x: 0, y: 0 }, (b) => b.id === 17);
compare(tied, { x: 0, y: 0 }, (b) => b.id === 18);
compare([{ id: 0, x: 380, y: 0, links: [0] }], { x: 0, y: 0 }, () => { throw new Error('380-unit limit is strict'); });
compare([{ id: 0, x: 0, y: 0, links: [] }], { x: 0, y: 0 }, () => { throw new Error('isolated nodes are excluded'); });

const mapScope = vm.createContext({ TAU: Math.PI * 2, BIKE_SHARE_TEAL: '#00aaaa', player: { x: 0, y: 0 },
  minimapZoom: () => 1, dockedBikes: () => 2 });
vm.runInContext(sourceFunction('src/game-minimap.js', 'mapWindowHas') + '\n' + sourceFunction('src/cycles.js', 'drawBikeShareMap'), mapScope);
const mapCases = [];
function paintCase(name, big, scale, window, stations, expected) {
  mapScope.mapWindow = window;
  mapScope.bikeStationCache = stations.map(([id, x, y]) => ({ id, x, y }));
  const painted = [];
  const g = new Proxy({}, { get(_target, key) {
    if (key === 'fillRect') return (x, y, w, h) => painted.push([Math.round(x + w / 2), Math.round(y + h / 2)]);
    return () => {};
  }, set: () => true });
  mapScope.drawBikeShareMap(g, scale, big);
  assert.deepEqual(painted, expected, name);
  mapCases.push({ name, stations: stations.length, painted: painted.length });
}
paintCase('station inside the default minimap edge', false, 0.137,
  { x0: -120 / 0.137, x1: 120 / 0.137, y0: -80 / 0.137, y1: 80 / 0.137 },
  [[0, 0, 0], [1, 800, 0], [2, 0, 800], [3, 4000, 0]], [[0, 0], [800, 0]]);
paintCase('speed pullback reveals further stations', false, 0.137 * 0.62,
  { x0: -120 / (0.137 * 0.62), x1: 120 / (0.137 * 0.62), y0: -80 / (0.137 * 0.62), y1: 80 / (0.137 * 0.62) },
  [[0, 1200, 0], [1, 1600, 0]], [[1200, 0]]);
paintCase('panned city map ignores stations outside its own window', true, 0.5,
  { x0: 3000, x1: 4600, y0: -660, y1: 660 },
  [[0, 0, 0], [1, 3800, 0], [2, 4620, 0], [3, 4630, 0]], [[3800, 0], [4620, 0]]);
paintCase('icon crossing the edge keeps its outline', false, 1,
  { x0: -120, x1: 120, y0: -80, y1: 80 }, [[0, 129, 0], [1, 130, 0]], [[129, 0]]);
console.log(JSON.stringify({ navigation: { queries: checked, visibilityProbes: probeChecks, mismatches: 0 }, mapCases }, null, 2));
