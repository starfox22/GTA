// Full vehicle-body SAT sweeps on both airport road lanes against production
// overhead/ground airport colliders. Complements ordinary in-game driving.
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../../src/' + file + '.js', import.meta.url), 'utf8');
export function airportRoadFixture(source = read) {
  const county = source('county-map'), scope = vm.createContext({
    Math, Map, Set, UNITS_PER_METRE: 8, BLOCK_SIZE: 512, KMH: 8 / 3.6, KNOTS: 8 / 3.6 * 1.852, GRAVITY: 9.81 * 8,
    PAINT_EVERYDAY: [], PAINT_LUXURY: [], PAINT_SPORT: [], BRIDGES: [], RAIL_STATIONS: [], railPiers: [],
    railDecks: () => [], railStationCovers: () => [], railLift: () => ({}), terrainHeight: () => 0,
    entityElevation: c => c.altitude || 0,
  });
  const api = vm.runInContext(source('geography-regions') + '\n' + county.slice(0, county.indexOf('    const countyGroundTiles')) + '\n' +
    source('game-vehicles') + '\n' + source('physics-shapes') + '\n' + source('air-cover') + '\n' +
    '({AIRPORT_JETBRIDGES,AIRPORT_SCENERY_SOLIDS,COUNTY_ROADS,airportOverheadVolumes,vehicleSpec,vehicleCollisionHeight,' +
    'vehicleShape,nearbyStatics,boxContact,addStatic,addRailCoverColliders,staticBodies,' +
    'floor: typeof airportBridgeFloor === "function" ? airportBridgeFloor : null})', scope);
  api.addRailCoverColliders();
  for (const b of api.AIRPORT_SCENERY_SOLIDS) api.addStatic(b.x, b.y, b.w, b.h, b.height, b.kind);
  const road = api.COUNTY_ROADS.find(r => r.name === 'OCEANVIEW PARKWAY'),
    a = road.points[7], b = road.points[8], dx = b[0] - a[0], dy = b[1] - a[1],
    length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
  const hits = c => [...api.nearbyStatics(c)].filter(body =>
    (body.minHeight === undefined || (c.altitude || 0) + api.vehicleCollisionHeight(c) >= body.minHeight) &&
    api.boxContact(api.vehicleShape(c), body));
  return { api, road, a, b, dx, dy, length, ux, uy, hits };
}
export function airportRoadSweeps(fixture) {
  const f = fixture, results = [];
  for (const direction of [-1, 1]) for (const type of ['sedan', 'bus', 'truck', 'ambulance']) {
    const route = { type, direction, samples: 0, blockedSamples: 0, firstCollision: null };
    for (let s = 50; s < f.length - 50; s += 2) {
      const c = { type, x: f.a[0] + f.ux * s - f.uy * 25 * direction,
        y: f.a[1] + f.uy * s + f.ux * 25 * direction, a: Math.atan2(f.dy, f.dx) + (direction < 0 ? Math.PI : 0) };
      const contacts = f.hits(c);
      route.samples++;
      if (contacts.length) {
        route.blockedSamples++;
        route.firstCollision ||= { x: c.x, y: c.y, kinds: [...new Set(contacts.map(b => b.kind))] };
      }
    }
    results.push(route);
  }
  return results;
}
export default async function airportRoadClearance(t) {
  const f = airportRoadFixture(), routes = airportRoadSweeps(f);
  for (const route of routes)
    t.assert(!route.blockedSamples, `${route.type}/${route.direction}: public airport lane hits structure at ${JSON.stringify(route.firstCollision)}`);
  for (const bridge of f.api.AIRPORT_JETBRIDGES) {
    const y = f.a[1] + (bridge.x - f.a[0]) / f.dx * f.dy,
      overhead = f.api.airportOverheadVolumes().filter(v => Math.abs(v.x - bridge.x) < 1 && y > v.y - v.hy && y < v.y + v.hy);
    t.assert(overhead.length && Math.min(...overhead.map(v => v.minHeight)) >= 40, bridge.gate + ': road headroom must be at least 5 m');
    t.assert(f.api.floor?.(bridge, bridge.to) === 22 && f.api.floor?.(bridge, bridge.to - 220) === 40,
      bridge.gate + ': preserve docking level and upper road crossing');
    t.assert((40 - 22) / 220 <= 1 / 12, bridge.gate + ': boarding-ramp slope must not exceed 1:12');
    const tall = { type: 'truck', x: bridge.x, y, a: Math.atan2(f.dy, f.dx), altitude: 10 };
    t.assert(f.hits(tall).some(b => b.kind === 'airport jetbridge'), bridge.gate + ': high-body negative fixture must still collide');
  }
  for (const post of f.api.AIRPORT_SCENERY_SOLIDS.filter(p => /column/.test(p.kind))) {
    const clearance = Math.min(...[[post.x, post.y], [post.x + post.w, post.y], [post.x, post.y + post.h], [post.x + post.w, post.y + post.h]]
      .map(([x, y]) => Math.abs((x - f.a[0]) * f.uy - (y - f.a[1]) * f.ux)));
    // Southport uses a different local road; only these Oceanview posts cross this segment.
    if (post.x < 3800) continue;
    t.assert(clearance > f.road.width / 2, post.kind + ': support foot must be wholly outside the paved airport road');
    const c = { type: 'sedan', x: post.x + post.w / 2, y: post.y + post.h / 2, a: 0 };
    t.assert(f.hits(c).some(b => b.kind === post.kind), post.kind + ': a car driven into the actual support must still collide');
  }
  const bus = { type: 'bus', x: 4400, y: 8760, a: 0 };
  t.assert(!f.hits(bus).length, 'original parked airport bus must not spawn intersecting a structure');
  t.note(JSON.stringify({ routes, samples: routes.reduce((n, r) => n + r.samples, 0),
    collisionHeights: Object.fromEntries(['sedan', 'bus', 'truck', 'ambulance'].map(type => [type, f.api.vehicleCollisionHeight({ type })])) }));
}
