// Production jet decoder/builders/animation on real Three.js, without a GPU.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');

export default function (t) {
  const close = (actual, expected, tolerance, label) => t.assert(Math.abs(actual - expected) <= tolerance,
    label + ': ' + actual + ' versus ' + expected);
  const pack = fs.readFileSync(new URL('../../assets/jet-models.bin', import.meta.url)),
    source = read('jet-assets3d'), player = { x: 0, y: 0, car: null }, scene = new Three.Scene(),
    scope = vm.createContext({ Three, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Float32Array,
      DataView, TextDecoder, console, atob: value => Buffer.from(value, 'base64').toString('binary'),
      UNITS_PER_METRE: 8, scene, player, renderer: { capabilities: { getMaxAnisotropy: () => 8 } },
      ASSETS: { jetModels: 'data:application/octet-stream;base64,' + pack.toString('base64') },
      halo(parent, x, y, z, size, color) {
        const sprite = new Three.Sprite(new Three.SpriteMaterial({ color }));
        sprite.position.set(x, y, z); parent.add(sprite); return sprite;
      }, terrainHeight: () => 0, clamp: (x, a, b) => Math.max(a, Math.min(b, x)), gameTime: 3, nightAmount: .3 });
  // Static airport construction really precedes the shared Sets and tier in
  // createCityRenderer. Catch accidental temporal-dead-zone dependencies.
  const api = vm.runInContext(source + '\nconst earlyParent = new Three.Group();\n' +
    'const early = makeParkedAssetJet("airliner", earlyParent);\n' +
    'const sharedGeometries = new Set(), sharedMaterials = new Set(), activeTier = {lodBias:1};\n' +
    read('aircraft-audio') + read('plane3d-build') + '\n({ early, earlyParent, jetAssetKit, jetAssetModel, jetAssetReport, makeAssetJetPlane, animateAircraft, sharedGeometries })', scope);
  const report = api.jetAssetReport(), jet = report.models.find(m => m.name === 'jet'), transport = report.models.find(m => m.name === 'airliner');
  t.assert(report.loaded && jet && transport, 'both licensed source models decode');
  t.assert(jet.nearTriangles === 20131 && transport.nearTriangles === 162629, 'all source near triangles retained');
  t.assert(jet.farTriangles < 8000 && transport.farTriangles < 20000, 'shared distant triangle budgets');
  t.assert(jet.nativeTexture.join(',') === '256,256' && !jet.cabin && transport.cabin, 'source capabilities reported honestly');
  const staticModel = api.early.group;
  t.assert(staticModel.isLOD && staticModel.userData.dynamic && staticModel.levels.length === 2, 'live shared static LOD survives batching');
  const count = group => { let tris = 0; group.traverse(o => { if (o.isMesh) tris += o.geometry.index.count / 3; }); return tris; };
  t.assert(count(staticModel.levels[0].object) === transport.nearTriangles, 'actual near scene draw count');
  t.assert(count(staticModel.levels[1].object) === transport.farTriangles, 'actual far scene draw count');
  const vehicle = { type: 'plane', airframe: 'jet', hp: 100, x: 0, y: 0, altitude: 100, power: .7, gearPos: 1, ctrlPitch: 0, ctrlRoll: 0, ctrlYaw: 0, flapPos: 0, id: 1 },
    a = api.makeAssetJetPlane(vehicle), b = api.makeAssetJetPlane({ ...vehicle }), kit = api.jetAssetKit('jet');
  player.car = vehicle;
  t.assert(a.asset === 'jet' && a.gears.length === 3, 'existing jet identity and three retracting source gear regions');
  t.assert(a.surfaces.aileron.length === 2 && a.surfaces.flap.length === 2 && a.surfaces.elevator.length === 2 && a.surfaces.rudder.length === 1, 'all seven adapted source controls present');
  t.assert(a.rayTargets[0].geometry === b.rayTargets[0].geometry && a.paint !== b.paint, 'instances share geometry and keep their own wear material');
  api.animateAircraft(vehicle, a, 1 / 60); a.group.updateMatrixWorld(true);
  const bounds = new Three.Box3();
  for (const object of a.rayTargets) bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  const size = bounds.getSize(new Three.Vector3());
  for (let axis = 0; axis < 3; axis++) close(size.getComponent(axis), jet.dims[axis] * 8, .012, 'neutral runtime reconstructs source dimension ' + axis);
  close(bounds.min.y, 0, .008, 'source tyre contacts rest on ground');
  vehicle.ctrlRoll = .8; vehicle.ctrlPitch = -.6; vehicle.ctrlYaw = .5; vehicle.flapPos = .7;
  api.animateAircraft(vehicle, a, 1 / 60);
  t.assert(a.surfaces.aileron[0].angle * a.surfaces.aileron[1].angle < 0, 'aileron deflections oppose');
  for (const name of ['elevator', 'rudder', 'flap']) for (const surface of a.surfaces[name]) t.assert(Math.abs(surface.angle) > .1 && surface.pivot.quaternion.angleTo(new Three.Quaternion()) > .1, name + ' actual source pivot follows input');
  vehicle.gearPos = 0; api.animateAircraft(vehicle, a, 1 / 60);
  for (const leg of a.gears) t.assert(!leg.pivot.visible && Math.max(Math.abs(leg.pivot.rotation.x), Math.abs(leg.pivot.rotation.z)) > 1.5, 'source gear folds and hides when stowed');
  const nativeMap = a.livery; a.paint.map = null; a.charred = false;
  api.animateAircraft(vehicle, a, 1 / 60);
  t.assert(a.paint.map === nativeMap, 'repair restores original native albedo');
  player.car = null; vehicle.x = 1000; api.animateAircraft(vehicle, a, 1 / 60);
  t.assert(a.jetLodFar && a.rayTargets[0].geometry !== kit.parts.body, 'non-player distant plane uses reduced shared geometry');
  player.car = vehicle; api.animateAircraft(vehicle, a, 1 / 60);
  t.assert(!a.jetLodFar && a.rayTargets[0].geometry === kit.parts.body, 'player aircraft pins original near source geometry');
  t.note(JSON.stringify({ jet: { near: jet.nearTriangles, far: jet.farTriangles, actualDims: jet.dims },
    transport: { near: transport.nearTriangles, far: transport.farTriangles }, sharedGeometries: api.sharedGeometries.size }));
}
