// Exercise the actual render helpers without WebGL: paint changes must not alias and retired char materials
// must either enter the bounded reuse pool or release their GPU program references.
import fs from 'node:fs';
import { createRequire } from 'node:module';

export default async function (t) {
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
  const charSource = fs.readFileSync(new URL('../../src/vehicle-char3d.js', import.meta.url), 'utf8');
  const { assetCharRelease, assetCharFree, assetCharModel } = new Function('Three', 'vaMaterialSet', charSource + '\nreturn { assetCharRelease, assetCharFree, assetCharModel };')(Three, null);
  const firstMaterial = new Three.MeshStandardMaterial();
  firstMaterial.userData.assetAtlas = 'approved';
  const firstGroup = new Three.Group(); firstGroup.add(new Three.Mesh(new Three.BoxGeometry(), firstMaterial));
  t.assert(assetCharModel({ group: firstGroup }) === true, 'first approved vehicle cannot burn before legacy atlas materials initialize');
  firstGroup.children[0].geometry.dispose(); firstMaterial.dispose();
  let disposed = 0;
  const kinds = Object.keys(assetCharFree), originals = [];
  t.assert(['cut', 'atlas', 'plain', 'finish', 'approved'].every(kind => kinds.includes(kind)), 'a required char material kind is missing');
  for (let n = 0; n < 20; n++) {
    const materials = kinds.map(kind => {
      const material = new Three.MeshStandardMaterial();
      material.userData.assetChar = { kind };
      material.addEventListener('dispose', () => disposed++);
      return material;
    });
    const original = new Three.MeshStandardMaterial();
    originals.push(original);
    const mesh = { material: materials[0] };
    const model = { assetChar: { swaps: [mesh, original], materials } };
    assetCharRelease(model);
    t.assert(mesh.material === original && model.assetChar === undefined, 'repair did not restore the original material');
  }
  t.assert(Object.values(assetCharFree).every(pool => pool.length === 12), 'char reuse pools are not bounded to 12');
  const expectedDisposed = (20 - 12) * kinds.length;
  t.assert(disposed === expectedDisposed, `overflow char materials were not disposed: ${disposed}/${expectedDisposed}`);
  for (const material of [...originals, ...Object.values(assetCharFree).flat()]) material.dispose();

  const atlas = new Three.Texture(), rig = new Function('Three', 'vaMaterialSet', 'vaMaterials', 'approvedVehicleTexture',
    charSource + '\nreturn {assetCharSwap, assetCharRelease};')(Three, null, () => ({}), () => atlas);
  const optics = new Three.MeshStandardMaterial({ map: atlas, roughnessMap: atlas, metalnessMap: atlas,
    transparent: true, opacity: 1, alphaTest: 0, depthWrite: false, side: Three.DoubleSide, forceSinglePass: true });
  optics.userData.assetAtlas = 'approved';
  const opaque = new Three.MeshStandardMaterial({ map: atlas, alphaTest: .5 });
  opaque.userData.assetAtlas = 'approved';
  let reused;
  for (const source of [optics, opaque, optics]) {
    const group = new Three.Group(), mesh = new Three.Mesh(new Three.BoxGeometry(), source), model = { group };
    group.add(mesh); rig.assetCharSwap({ id: 7 }, model, true);
    const charred = mesh.material;
    t.assert(['transparent', 'opacity', 'alphaTest', 'depthWrite', 'side', 'forceSinglePass'].every(key => charred[key] === source[key]),
      'char reuse loses authored optical transparency or leaks it into opaque bodywork');
    t.assert(charred.map === source.map && charred.roughnessMap === source.roughnessMap && charred.metalnessMap === source.metalnessMap,
      'char reuse loses the source optical texture channels');
    if (reused) t.assert(charred === reused, 'optical/opaque char lifecycle bypasses the bounded reuse pool');
    reused = charred; rig.assetCharRelease(model);
    t.assert(mesh.material === source, 'optical repair does not restore its source material');
    mesh.geometry.dispose();
  }
  reused.dispose(); optics.dispose(); opaque.dispose(); atlas.dispose();

  const bodySource = fs.readFileSync(new URL('../../src/damage3d-bodies.js', import.meta.url), 'utf8');
  const paintSource = bodySource.slice(bodySource.indexOf('      function paintVehicle('), bodySource.indexOf('      // Suspension pose'));
  const paintVehicle = new Function('Three', `const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const grime = new Three.Color('#585451'), sootColor = new Three.Color('#1d1a17');
    ${paintSource}\nreturn paintVehicle;`)(Three);
  const car = { hp: 50, maxhp: 100, color: '#aabbcc', damage: { burning: 0 } };
  const model = { paint: new Three.MeshPhysicalMaterial() };
  paintVehicle(car, model);
  const worn = model.paint.roughness;
  car.hp = 100;
  car.damage.burning = 0.4; // wear + heat * 10 is again 0.5: the old cache mistook this for no change.
  paintVehicle(car, model);
  t.assert(model.paint.roughness !== worn && model.paint.roughness === 0.42, 'repair and heat collided in the paint cache');
  const before = model.paint.color.getHex();
  car.color = '#112233';
  paintVehicle(car, model);
  t.assert(model.paint.color.getHex() !== before, 'respray with unchanged wear did not update paint');
  model.paint.dispose();
}
