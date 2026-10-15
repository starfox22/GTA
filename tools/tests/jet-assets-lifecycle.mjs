// Actual renderer resource retirement and static LOD on CPU Three.js.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');

export default function (t) {
  const pack = fs.readFileSync(new URL('../../assets/jet-models.bin', import.meta.url)), scene = new Three.Scene(), clock = { now: 10000 },
    scope = vm.createContext({ Three, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Float32Array,
      DataView, TextDecoder, console, atob: value => Buffer.from(value, 'base64').toString('binary'),
      UNITS_PER_METRE: 8, scene, worldContext: {}, player: { x: 0, y: 0, car: null },
      performance: { now: () => clock.now }, renderer: { capabilities: { getMaxAnisotropy: () => 8 } },
      boxGeo: new Three.BoxGeometry(), sphereGeo: new Three.SphereGeometry(), wheelGeo: new Three.CylinderGeometry(), cylinderGeo: new Three.CylinderGeometry(),
      ASSETS: { jetModels: 'data:application/octet-stream;base64,' + pack.toString('base64') },
      halo(parent, x, y, z, size, color) {
        const sprite = new Three.Sprite(new Three.SpriteMaterial({ color }));
        sprite.position.set(x, y, z); parent.add(sprite); return sprite;
      } });
  // Ordinary scenery already owns the global Sprite quad before dynamic models
  // are built. It is collected exactly as the real renderer collects the world.
  scene.add(new Three.Sprite(new Three.SpriteMaterial()));
  const retirement = read('render3d-resources').split('      /**\n       * BAKED CANVAS RELEASE')[0],
    api = vm.runInContext(read('jet-assets3d') + '\nconst airport = new Three.Group(); scene.add(airport);\n' +
      'const parked = makeParkedAssetJet("airliner", airport);\n' + retirement +
      '\nconst activeTier = {lodBias:1};\n({ parked, activeTier, jetAssetKit, makeAssetJetPlane, pruneModels, disposeRetiredModels, sharedGeometries, sharedMaterials })', scope),
    vehicleA = { id: 1 }, vehicleB = { id: 2 },
    a = api.makeAssetJetPlane(vehicleA), b = api.makeAssetJetPlane(vehicleB),
    kit = api.jetAssetKit('jet'), transport = api.jetAssetKit('airliner'), models = new Map([[vehicleA, a], [vehicleB, b]]);
  let sharedDisposals = 0, aDisposals = 0, bDisposals = 0;
  for (const geometry of [...Object.values(kit.parts), ...Object.values(transport.parts)]) {
    geometry.addEventListener('dispose', () => sharedDisposals++);
    t.assert(api.sharedGeometries.has(geometry), 'both live and hidden LOD resources registered shared');
  }
  for (const material of Object.values(transport.materials)) {
    material.addEventListener('dispose', () => sharedDisposals++);
    t.assert(api.sharedMaterials.has(material), 'static shared material protected');
  }
  a.paint.addEventListener('dispose', () => aDisposals++); a.wingPaint.addEventListener('dispose', () => aDisposals++);
  b.paint.addEventListener('dispose', () => bDisposals++); b.wingPaint.addEventListener('dispose', () => bDisposals++);
  api.pruneModels(models, [vehicleB]); api.disposeRetiredModels();
  t.assert(!models.has(vehicleA) && models.has(vehicleB) && !a.group.parent, 'retired model removed from scene/map');
  t.assert(aDisposals === 2 && bDisposals === 0, 'only retiring instance paint materials disposed');
  t.assert(sharedDisposals === 0, 'retirement preserves source kit and static LOD resources');
  clock.now += 4000; api.pruneModels(models, []); api.disposeRetiredModels();
  t.assert(models.size === 0 && bDisposals === 2 && sharedDisposals === 0, 'last instance retirement still preserves cached source geometry');
  const replacement = api.makeAssetJetPlane({ id: 3 });
  t.assert(replacement.rayTargets[0].geometry === kit.parts.body, 'respawn reuses intact shared source kit');
  const camera = new Three.PerspectiveCamera(), lod = api.parked.group;
  camera.position.set(0, 60, 0); camera.updateMatrixWorld(true); lod.update(camera);
  t.assert(lod.levels[0].object.visible && !lod.levels[1].object.visible, 'close static instance selects near');
  camera.position.set(1500, 60, 0); camera.updateMatrixWorld(true); lod.update(camera);
  t.assert(!lod.levels[0].object.visible && lod.levels[1].object.visible, 'distant static instance selects far');
  camera.position.set(600, 60, 0); camera.updateMatrixWorld(true); lod.update(camera);
  t.assert(lod.levels[0].object.visible, 'normal tier keeps intermediate distance near');
  api.activeTier.lodBias = 2; lod.update(camera);
  t.assert(lod.levels[1].object.visible && lod.levels[1].distance === 380, 'quality tier scales static LOD threshold');
  t.assert(sharedDisposals === 0, 'LOD selection disposes no shared resources');
  t.note(JSON.stringify({ sourceGeometries: Object.keys(kit.parts).length + Object.keys(transport.parts).length,
    privatePaintDisposals: aDisposals + bDisposals, sharedDisposals, staticLodDistanceLow: lod.levels[1].distance }));
}
