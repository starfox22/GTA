// Exact Three intersection/production decal parity on the actual licensed M4/M35.
// Performance assertions use deterministic triangle counts, never wall timing.
import { createHash } from 'node:crypto';
import { militaryMarkFixture } from '../m4-marks-bench.mjs';

const hash = geometry => createHash('sha256').update(Buffer.from(geometry.index.array.buffer)).update(Buffer.from(geometry.attributes.position.array.buffer))
  .update(Buffer.from(geometry.attributes.normal.array.buffer)).update(Buffer.from(geometry.attributes.uv.array.buffer)).digest('hex');
const hits = list => list.map(h => ({ distance: h.distance, faceIndex: h.faceIndex, face: { ...h.face, normal: h.face.normal.toArray() },
  point: h.point.toArray(), uv: h.uv?.toArray(), uv1: h.uv1?.toArray(), normal: h.normal?.toArray() }));

export default async function(t) {
  let rays = 0;
  for (const type of ['army_jeep', 'army_truck']) {
    const f = militaryMarkFixture({ type }), { Three, model, api, source } = f,
      mesh = model.lod?.near.children[0] || model.body.children.find(o => o.isMesh),
      original = mesh._computeIntersections, checksum = hash(source),
      ray = new Three.Raycaster(), centre = source.boundingBox.getCenter(new Three.Vector3()),
      span = source.boundingBox.getSize(new Three.Vector3()), point = new Three.Vector3(), direction = new Three.Vector3();
    t.assert(!!f.tree && original !== f.measured, type + ': immutable body did not register acceleration');
    t.assert(f.tree.subset.attributes === source.attributes && f.tree.subset.index !== source.index, type + ': scratch index aliases drawn indices');
    t.assert(!f.scope.sharedGeometries.has(f.tree.subset), type + ': CPU-only query geometry became a GPU resource');
    const compare = label => {
      f.resetCounters(); const accelerated = ray.intersectObject(mesh, false), fastTriangles = f.counters.triangles;
      mesh._computeIntersections = f.measured;
      let vanilla;
      try { vanilla = ray.intersectObject(mesh, false); } finally { mesh._computeIntersections = original; }
      t.assert(JSON.stringify(hits(accelerated)) === JSON.stringify(hits(vanilla)), type + ': changed intersections ' + label);
      t.assert(accelerated.every(h => h.object === mesh) && mesh.geometry === source, type + ': changed hit object or retained scratch geometry');
      rays++; return { accelerated, fastTriangles };
    };
    for (const scale of [[.65, .65, .65], [.4, 1.1, .8], [-.65, .9, .5]]) {
      model.group.scale.set(...scale); model.group.position.set(127, 31, -94); model.group.rotation.set(.17, .63, -.12);
      model.group.updateMatrixWorld(true);
      for (const side of [Three.FrontSide, Three.BackSide, Three.DoubleSide]) {
        mesh.material.side = side;
        for (let axis = 0; axis < 3; axis++) for (let sign = -1; sign <= 1; sign += 2) for (let i = 0; i < 5; i++) {
          point.copy(centre); point.setComponent((axis + 1) % 3, centre.getComponent((axis + 1) % 3) + (i / 4 - .5) * span.getComponent((axis + 1) % 3));
          point.setComponent(axis, centre.getComponent(axis) + sign * span.getComponent(axis) * 1.5);
          direction.copy(centre).sub(point).normalize();
          ray.set(point.applyMatrix4(mesh.matrixWorld), direction.transformDirection(mesh.matrixWorld));
          ray.near = 0; ray.far = Infinity;
          const result = compare('scale/side/axis/' + i);
          if (result.accelerated.length && i === 2) {
            const distance = result.accelerated[0].distance;
            for (const edge of [-1e-8, 0, 1e-8]) {
              ray.near = Math.max(0, distance + edge); ray.far = distance + 1;
              compare('near edge');
              ray.near = 0; ray.far = Math.max(0, distance + edge);
              compare('far edge');
            }
          }
        }
      }
    }
    t.assert(hash(source) === checksum, type + ': queries changed downloaded indices/positions/normals/UVs');
    // A grouped material, a partial draw, a morph or changed position version
    // must retain vanilla's complete path, rather than use stale/partial bounds.
    model.group.scale.setScalar(1); model.group.rotation.set(0, 0, 0); model.group.position.set(0, 0, 0); model.group.updateMatrixWorld(true);
    ray.set(centre.clone().add(new Three.Vector3(0, 0, -span.z * 2)), new Three.Vector3(0, 0, 1)); ray.near = 0; ray.far = Infinity;
    const material = mesh.material;
    let threw = false;
    mesh.material = { get side() { throw Error('expected triangle callback'); } };
    try { ray.intersectObject(mesh, false); } catch { threw = true; } finally { mesh.material = material; }
    t.assert(threw && mesh.geometry === source && !f.tree.busy, type + ': exception retained temporary query geometry');
    source.addGroup(0, source.index.count, 0); mesh.material = [material]; compare('array material');
    mesh.material = material; source.clearGroups(); source.setDrawRange(3, 60); compare('partial draw'); source.setDrawRange(0, Infinity);
    mesh.morphTargetInfluences = [0]; compare('morph fallback'); delete mesh.morphTargetInfluences;
    source.attributes.position.needsUpdate = true; compare('changed position fallback');
    // Trees are shared between model instances and retired with their source.
    const copy = new Three.Mesh(source, material); copy._computeIntersections = f.measured; api.register(copy);
    t.assert(api.tree(source) === f.tree, type + ': same geometry built another tree');
    let disposed = 0; f.tree.subset.addEventListener('dispose', () => disposed++);
    source.dispose();
    t.assert(!api.tree(source) && disposed === 1, type + ': source disposal retained query geometry/tree');
    compare('disposed tree fallback');
  }
  const baseline = militaryMarkFixture({ baseline: true }), fast = militaryMarkFixture(), evidence = [];
  for (const mode of ['production', 'side', 'low', 'miss']) for (const chase of [false, true]) {
    baseline.scope.chaseViewActive = fast.scope.chaseViewActive = chase;
    baseline.setMarks(mode); fast.setMarks(mode);
    for (let frame = 0; frame < 3; frame++) {
      if (frame) { baseline.model.shapeVersion++; fast.model.shapeVersion++; }
      baseline.resetCounters(); fast.resetCounters();
      baseline.api.drawVehicleMarks(); fast.api.drawVehicleMarks();
      t.assert(JSON.stringify(fast.snapshot()) === JSON.stringify(baseline.snapshot()), mode + '/' + chase + '/' + frame + ': changed face/barycentric/normal/pose/hidden ring result');
      t.assert(fast.scope.vehicleDecals.mesh.count === baseline.scope.vehicleDecals.mesh.count, mode + ': changed drawn holes');
      if (mode === 'production' || mode === 'side') {
        t.assert(fast.snapshot().every(a => a.anchored), mode + ': expected actual body anchors');
        t.assert(baseline.counters.triangles ? fast.counters.triangles < baseline.counters.triangles * .01 : fast.counters.triangles === 0,
          mode + ': triangle broadphase reduction below99%');
      }
      if (mode === 'low') t.assert(fast.snapshot().some(a => !a.anchored), 'missing-in-body mark retry not exercised');
      if (frame === 1 && chase) evidence.push({ mode, fullTriangles: baseline.counters.triangles, acceleratedTriangles: fast.counters.triangles, anchors: fast.snapshot().filter(a => a.anchored).length });
    }
    fast.resetCounters(); fast.api.drawVehicleMarks();
    t.assert(fast.counters.triangles === 0 && fast.counters.meshRays === 0, mode + ': cached marks recast');
  }
  t.note(JSON.stringify({ rawRaysCompared: rays, m4TypedBytes: fast.retainedTypedBytes, evidence }));
}
