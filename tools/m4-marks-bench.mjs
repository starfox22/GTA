// CPU-only, real packed M4 + production mark anchoring/ring checks. Reproduce:
// node tools/m4-marks-bench.mjs --baseline --out work/m4-before.json
// node tools/m4-marks-bench.mjs --out work/m4-after.json
// Optional --source <checkout> measures that checkout without changing it.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export const M4_MARK_INPUTS = ['src/military-mark-rays3d.js', 'src/military-assets3d.js', 'src/military-asset-wheels3d.js',
  'src/vehicle-assets3d.js', 'src/damage3d-marks.js', 'src/damage3d-decals.js', 'src/damage-vehicles.js', 'assets/vehicle-models.bin'];
const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function militaryMarkFixture({ root = ownRoot, baseline = false, type = 'army_jeep' } = {}) {
  const Three = createRequire(import.meta.url)(path.join(root, 'vendor/three.r160.js')),
    read = name => fs.readFileSync(path.join(root, 'src', name), 'utf8'),
    bytes = fs.readFileSync(path.join(root, 'assets/vehicle-models.bin')),
    length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length)),
    base = 12 + length, arrays = {},
    types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array };
  for (const [name, [kind, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(base + offset, base + offset + count * types[kind].BYTES_PER_ELEMENT);
    arrays[name] = new types[kind](Uint8Array.from(raw).buffer);
  }
  const counters = { meshRays: 0, triangles: 0, rings: 0 }, vehicles = [], carModels = new Map(),
    spec = type === 'army_truck' ? { l: 6.7 * 8, w: 2.45 * 8, modelScale: .9, truck: true } : { l: 4.6 * 8, w: 2.3 * 8, modelScale: .65 },
    scope = vm.createContext({ Three, Math, fixture: { header, arrays }, counters, vehicles, carModels, player: { car: null },
      sharedGeometries: new Set(), sharedMaterials: new Set(), sootTexture: new Three.Texture(),
      glass: new Three.MeshStandardMaterial(), warmLamp: new Three.MeshStandardMaterial(),
      tailLamp: new Three.MeshStandardMaterial(), brakeLamp: new Three.MeshBasicMaterial(), deadLamp: new Three.MeshStandardMaterial(),
      renderer: { capabilities: { getMaxAnisotropy: () => 8 }, initTexture() {} }, cityMaterialPatch() {}, vehicleLampAmount: () => 0,
      vehicleSpec: () => spec, clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
      TAU: Math.PI * 2, UNITS_PER_METRE: 8, DECAL: { hole: 0, star: 2, scrape: 10 }, PANE_ORDER: ['left', 'front', 'right', 'rear', 'roof'],
      approvedSuvGlassBand: () => null, isAircraft: () => false, isBoat: () => false, entityElevation: () => 0,
      randomBetween: (lo, hi) => lo + (hi - lo) * .3, noteVehicleRoundZone() {},
      chaseViewActive: true, activeTier: { lodBias: 1 }, chaseZoomAt: () => 2, vehicleDoorMoveMark: () => false,
      vehicleDecals: { capacity: 4096, mesh: { count: 0 } }, writeDecal() {},
      mesh(geometry, material, parent) { const o = new Three.Mesh(geometry, material); parent.add(o); return o; }
    }),
    full = Three.Mesh.prototype._computeIntersections,
    measured = function(...args) {
      const geometry = this.geometry;
      counters.triangles += Math.min(geometry.drawRange.count, geometry.index?.count || geometry.attributes.position.count) / 3;
      return full.apply(this, args);
    }, finishSource = read('cars3d-materials.js'),
    finish = finishSource.slice(finishSource.indexOf('      function civFinishPatch('), finishSource.indexOf('      let civMaterials')),
    decals = read('damage3d-decals.js'), decalPose = decals.slice(decals.indexOf('      const decalX ='), decals.indexOf('      function writeDecal(')),
    helper = fs.existsSync(path.join(root, 'src/military-mark-rays3d.js')) ? read('military-mark-rays3d.js') : '',
    group = new Three.Group(), body = new Three.Group();
  group.add(body); group.scale.setScalar(spec.modelScale);
  const model = { group, body, wheels: [], lamps: [], paint: new Three.MeshStandardMaterial(), modelScale: spec.modelScale, shapeVersion: 1 },
    car = { id: 1, x: 0, y: 0, a: 0, type: type === 'army_truck' ? 'armytruck' : 'jeep', damageVersion: 0, damage: { marks: [], glass: {} } };
  let api, build;
  // The adapter captures Three's function once. Instrument that actual function,
  // then restore the global prototype: independent fixtures cannot affect one another.
  Three.Mesh.prototype._computeIntersections = measured;
  try {
    api = vm.runInContext(finish + read('vehicle-assets3d.js') + read('approved-vehicle-assets3d.js') +
      read('military-asset-wheels3d.js') + helper + read('military-assets3d.js') + read('damage-vehicles.js') + decalPose + read('damage3d-marks.js') + `
      vaData = () => fixture; vaAtlas = () => sootTexture;
      ${baseline && helper ? 'militaryMarkRayMesh = mesh => mesh;' : ''}
      const realRing = markRingHolds;
      markRingHolds = function(...args) { counters.rings++; return realRing(...args); };
      ({ militaryAssetBody, drawVehicleMarks, markPrepare, anchorMark, poseMark, markTargets, markAnchors, markGapAt,
         bulletHitVehicle, freshDamage, vehicleWorldPoint,
         tree: geometry => typeof militaryMarkTrees === 'undefined' ? null : militaryMarkTrees.get(geometry),
         register: mesh => typeof militaryMarkRayMesh === 'undefined' ? mesh : militaryMarkRayMesh(mesh) });`, scope);
    const cpu = process.cpuUsage(), now = performance.now();
    api.militaryAssetBody(model, car, type, spec.l / spec.modelScale);
    const used = process.cpuUsage(cpu);
    build = { cpuMs: (used.user + used.system) / 1000, wallMs: performance.now() - now };
  } finally { Three.Mesh.prototype._computeIntersections = full; }
  body.traverse(o => {
    if (!o.isMesh) return;
    if (baseline || !Object.hasOwn(o, '_computeIntersections')) o._computeIntersections = measured;
    const original = o.raycast;
    o.raycast = function(...args) { counters.meshRays++; return original.apply(this, args); };
  });
  vehicles.push(car); carModels.set(car, model); group.updateMatrixWorld(true);
  const source = model.lod?.near.children[0].geometry || body.children.find(o => o.isMesh).geometry,
    tree = api.tree(source), retainedTypedBytes = tree ? tree.faces.byteLength + tree.bounds.byteLength + tree.selected.byteLength +
      tree.order.byteLength + tree.sort.byteLength + tree.bins.byteLength + tree.stack.byteLength + tree.nodes.reduce((sum, node) => sum + node.box.byteLength, 0) : 0;
  return { Three, scope, api, model, car, spec, source, tree, counters, build, full, measured, retainedTypedBytes,
    resetCounters() { counters.meshRays = counters.triangles = counters.rings = 0; },
    setMarks(mode = 'side') {
      car.damage = api.freshDamage();
      if (mode === 'production') {
        for (let i = 0; i < 12; i++) {
          const x = (i / 11 - .5) * .7 * spec.l;
          api.bulletHitVehicle(car, { x, y: -spec.w / 2 + 1.5, px: x, py: -spec.w / 2 - 6, vx: 0, vy: 750, dmg: 28, altitude: 0 });
        }
      } else car.damage.marks = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, kind: 'hole', size: 1.4,
        x: (i / 11 - .5) * .7 * spec.l, y: -spec.w / 2, z: mode === 'miss' ? 100 : mode === 'low' ? 5 : 10, dx: 0, dy: 1 }));
      model.shapeVersion++;
    },
    snapshot() {
      return car.damage.marks.map(mark => {
        const a = api.markAnchors.get(mark);
        return a ? { anchored: !!a.object, face: [a.a, a.b, a.c], barycentric: [a.u, a.v, a.w], sign: a.sign,
          view: a.view, hidden: a.hidden, shrink: a.shrink, matrix: a.matrix.elements.slice() } : null;
      });
    }
  };
}

export function runM4MarksBench(options = {}) {
  const fixture = militaryMarkFixture(options), { model, car, api, counters } = fixture, results = [];
  const measure = (label, fn, rounds = 1) => {
    fixture.resetCounters(); const cpu = process.cpuUsage(), now = performance.now();
    for (let i = 0; i < rounds; i++) fn();
    const used = process.cpuUsage(cpu), cpuMs = (used.user + used.system) / 1000;
    results.push({ label, rounds, cpuMs, cpuMsPerFrame: cpuMs / rounds, wallMs: performance.now() - now, ...counters,
      trianglesPerFrame: counters.triangles / rounds, drawn: fixture.scope.vehicleDecals.mesh.count,
      anchored: car.damage.marks.filter(m => api.markAnchors.get(m)?.object).length });
  };
  measure('pristine', () => api.drawVehicleMarks(), 60);
  for (const mode of ['production', 'side', 'low', 'miss']) {
    fixture.setMarks(mode);
    measure(mode + '-first', () => api.drawVehicleMarks());
    measure(mode + '-cached', () => api.drawVehicleMarks(), 60);
    measure(mode + '-damageVersion-each-frame', () => { model.shapeVersion++; api.drawVehicleMarks(); }, 8);
  }
  const root = options.root || ownRoot;
  return { sourceRoot: root, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    baseline: !!options.baseline, sourceSHA256: Object.fromEntries(M4_MARK_INPUTS.filter(p => fs.existsSync(path.join(root, p)))
      .map(p => [p, createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')])),
    nearBodyTriangles: fixture.source.index.count / 3, treeNodes: fixture.tree?.nodes.length || 0,
    retainedTypedBytes: fixture.retainedTypedBytes, build: fixture.build, results };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const option = name => { const at = process.argv.indexOf('--' + name); return at >= 0 ? process.argv[at + 1] : undefined; },
    report = runM4MarksBench({ root: option('source') || ownRoot, baseline: process.argv.includes('--baseline') }), out = option('out');
  if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
  console.log(JSON.stringify(report, null, 2));
}
