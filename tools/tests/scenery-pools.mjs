// The production rooftop partitioner with real Three.js geometry/frusta: identical instances, conservative
// camera/shadow coverage, wide-view fallback, bounded draw fan-out, and fail-open handling of later mutations.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
export default async function (t) {
  const scene = new Three.Scene(), frustum = new Three.Frustum(), renderer = { shadowMap: { enabled: false } };
  const scope = vm.createContext({ Three, scene, viewFrustum: frustum, flightViewActive: false,
    chaseViewActive: false, viewZoom: 2, renderer });
  const api = vm.runInContext(fs.readFileSync(new URL('../../src/scenery-pools3d.js', import.meta.url), 'utf8') +
    '\n({splitSceneryPool, updateSceneryPools, sceneryPoolsReport, sceneryPoolGroups, sceneryPoolWarmMeshes})', scope);
  const matrix = new Three.Matrix4(), originalMatrices = [];
  const source = new Three.InstancedMesh(new Three.BoxGeometry(4, 6, 4), new Three.MeshStandardMaterial(), 1024);
  source.castShadow = source.receiveShadow = true;
  source.frustumCulled = false;
  for (let z = 0, i = 0; z < 8; z++) for (let x = 0; x < 8; x++) for (let n = 0; n < 16; n++, i++) {
    matrix.makeTranslation(x * 2048 + 100 + n % 4 * 8, 20, z * 2048 + 100 + Math.floor(n / 4) * 8);
    source.setMatrixAt(i, matrix);
    originalMatrices.push(Array.from(source.instanceMatrix.array.subarray(i * 16, i * 16 + 16)).join(','));
  }
  scene.add(source);
  source.instanceMatrix.needsUpdate = true;
  const group = api.splitSceneryPool(source, 'fixture');
  api.sceneryPoolGroups.push(group);
  t.assert(group.chunks.length === 64, 'each populated spatial cell must have one chunk');
  const copies = group.chunks.flatMap(c => {
    t.assert(c.mesh.material === source.material && c.mesh.geometry === source.geometry, 'partition changed geometry or material');
    t.assert(c.mesh.castShadow && c.mesh.receiveShadow && c.mesh.frustumCulled, 'chunk lost independent shadow/frustum behavior');
    return Array.from({ length: c.count }, (_, i) => Array.from(c.mesh.instanceMatrix.array.subarray(i * 16, i * 16 + 16)).join(','));
  });
  t.assert(JSON.stringify(copies.sort()) === JSON.stringify(originalMatrices.sort()), 'a copied instance changed, disappeared or was duplicated');
  t.assert(api.sceneryPoolWarmMeshes.length === 65 && api.sceneryPoolWarmMeshes.includes(source),
    'chunk buffers and the retained whole-pool fallback must join the existing title upload prewarm');
  function overhead(x, z, half = 160) {
    const camera = new Three.OrthographicCamera(-half, half, half, -half, 1, 10000);
    camera.position.set(x, 4000, z);
    camera.up.set(0, 0, -1);
    camera.lookAt(x, 0, z);
    camera.updateMatrixWorld(true);
    return new Three.Frustum().setFromProjectionMatrix(new Three.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  }
  frustum.copy(overhead(112, 112));
  api.updateSceneryPools();
  let report = api.sceneryPoolsReport();
  t.assert(group.parts.visible && !source.visible && group.split, 'close view did not use the spatial chunks');
  t.assert(report.viewInstancesBound === 16 && report.viewDrawsBound === 1, 'close fixture should draw 16/1024 instances in one call: ' + JSON.stringify(report));
  // A shadow camera can see a different cell behind the main view. It must keep its caster despite the
  // main camera rejecting that chunk: hiding entire chunks with the main frustum would lose this shadow.
  scene.updateMatrixWorld(true);
  const shadowFrustum = overhead(4 * 2048 + 112, 5 * 2048 + 112);
  const shadowOnly = group.chunks.filter(c => !frustum.intersectsSphere(c.sphere) && shadowFrustum.intersectsObject(c.mesh));
  t.assert(shadowOnly.length === 1 && shadowOnly[0].mesh.visible && group.parts.visible, 'off-camera shadow caster was removed');
  // Preserve every potentially visible individual instance for arbitrary view and shadow-camera orientations.
  source.geometry.computeBoundingSphere();
  const sphere = new Three.Sphere();
  for (let pass = 0; pass < 24; pass++) {
    const cam = new Three.PerspectiveCamera(55, 16 / 9, 0.5, 6000);
    cam.position.set((pass % 8) * 1800 + 100, 40 + pass * 17, Math.floor(pass / 8) * 3000 + 100);
    cam.lookAt(cam.position.x + Math.cos(pass) * 1000, 30, cam.position.z + Math.sin(pass) * 1000);
    cam.updateMatrixWorld(true);
    frustum.setFromProjectionMatrix(new Three.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    api.updateSceneryPools();
    for (let i = 0; i < source.count; i++) {
      source.getMatrixAt(i, matrix);
      sphere.copy(source.geometry.boundingSphere).applyMatrix4(matrix);
      if (!frustum.intersectsSphere(sphere) || !group.split) continue;
      const e = matrix.elements;
      const chunk = group.chunks.find(c => c.mesh.boundingBox.containsPoint(new Three.Vector3(e[12], e[13], e[14])));
      t.assert(chunk && frustum.intersectsSphere(chunk.sphere), 'chunk cull rejected a visible instance at sweep ' + pass);
    }
    t.assert(!group.split || group.shownChunks <= 1, 'close view increased camera draw calls');
  }
  frustum.copy(overhead(7000, 7000, 10000));
  api.updateSceneryPools();
  t.assert(source.visible && !group.parts.visible, 'wide ground view must retain the original one-draw pool');
  frustum.copy(overhead(112, 112));
  scope.flightViewActive = true;
  api.updateSceneryPools();
  t.assert(source.visible && !group.parts.visible, 'flight view must retain the original draw budget');
  scope.flightViewActive = false;
  renderer.shadowMap.enabled = true;
  api.updateSceneryPools();
  t.assert(source.visible && !group.parts.visible, 'shadowed presets must retain the original per-pass draw budget');
  renderer.shadowMap.enabled = false;
  api.sceneryPoolsReport(false);
  t.assert(source.visible && !group.parts.visible, 'A/B off did not restore the original');
  api.sceneryPoolsReport(true);
  t.assert(!source.visible && group.parts.visible, 'A/B on did not restore the optimized view');
  const before = Array.from(source.instanceMatrix.array);
  for (let n = 0; n < 1000; n++) api.updateSceneryPools();
  t.assert(JSON.stringify(Array.from(source.instanceMatrix.array)) === JSON.stringify(before), 'view changes mutated the authoritative instance data');
  t.assert(group.chunks.length === 64 && scene.children.length === 1, 'frame updates grew the scene or chunk lists');
  source.setMatrixAt(0, matrix.makeTranslation(999, 20, 999));
  source.instanceMatrix.needsUpdate = true;
  api.updateSceneryPools();
  t.assert(group.invalid && source.visible && !group.parts.visible, 'changed immutable source must fail open to its current authoritative poses');
  t.note('1024 exact instances / 64 chunks; close fixture 1024 -> 16 instances, 1 -> 1 camera draw; 24 frustum sweeps and off-camera shadow candidate preserved; shadowed/wide/flight/A-B/mutation fallbacks pass');
  source.geometry.dispose(); source.material.dispose();
}
