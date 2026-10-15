// Licensed Coupe 33 production decoder, exact near parts, wheel/LOD/PBR texture contracts.
// Runs entirely on the host; rendered source appearance and doorway visibility have separate GPU checks.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

export default async function (t) {
  // Read the production hotrod dimensions: a narrower copied fixture changes native-scale seat fitting.
  const specSource = fs.readFileSync(new URL('../../src/game-vehicles.js', import.meta.url), 'utf8'),
    specBlock = specSource.match(/\bhotrod:\s*\{([\s\S]*?)\n\s*\},/)[1],
    hotrodSpec = vm.runInNewContext('({' + ['l', 'w'].map(key => key + ':' + specBlock.match(new RegExp('^\\s*' + key + ':\\s*([^,]+),', 'm'))[1]).join(',') + '})', { UNITS_PER_METRE: 8 });
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    source = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    bytes = fs.readFileSync(process.env.GTA_HOTROD_PACK || new URL('../../assets/hotrod-vehicle-models.bin', import.meta.url)),
    requests = [], uploads = [], player = { x: 0, y: 0, car: null }, activeTier = { lodBias: 1 },
    ASSETS = { hotrodVehicleModels: 'data:application/octet-stream;base64,' + bytes.toString('base64'),
      hotrodVehicleAlbedo: 'albedo-full', hotrodVehicleAlbedoLow: 'albedo-low', hotrodVehicleOrm: 'orm-full',
      hotrodVehicleOrmLow: 'orm-low', hotrodVehicleEmissive: 'emissive-full', hotrodVehicleEmissiveLow: 'emissive-low' };
  class ControlledImage {
    set src(value) { this.url = value; requests.push(this); }
    complete() { this.width = this.height = this.url.endsWith('low') ? 2048 : 4096; this.onload(); }
  }
  const context = vm.createContext({ Three, ASSETS, Image: ControlledImage, TextDecoder, Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Float32Array, DataView, atob: text => Buffer.from(text, 'base64').toString('binary'),
    renderer: { capabilities: { getMaxAnisotropy: () => 16 }, initTexture: texture => uploads.push({ texture, width: texture.image.width }) },
    sharedGeometries: new Set(), sharedMaterials: new Set(), activeTier, player, CAR_M: 8,
    CAR_SWATCH: { paint: 0, black: 2 }, boxGeo: new Three.BoxGeometry(), sootTexture: new Three.Texture(), scene: new Three.Scene(),
    CIV_NO_DIRT: { value: new Three.Vector2(0, -1e6) }, CIV_DIRT_GLSL: 'float carSill = 0.0;',
    clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)), lerpNumber: (a, b, t) => a + (b - a) * t,
    cityMaterialPatch() {}, swatchUv: () => [.5, .99], civFinishPatch: material => material,
    carGlassMaterial: () => new Three.MeshStandardMaterial({ transparent: true }),
    civDrawRange(geometry, count) { const far = geometry.clone(); far.setDrawRange(0, count); return far; },
    carSeatPlan: (g, l, w, M, name, own = {}) => ({ glass: { g, l, w }, M, x: (own.x ?? own.hipX ?? 0) * l, y: (own.y || 0) * M, z: -(own.z || 0) * M, wheel: { r: own.radius * M, x: (own.wheel?.[0] || 0) * M + g.xf * l, y: own.wheel?.[1] * M, z: own.wheelZ * M, tilt: own.tilt } }),
    vehicleSpec: () => hotrodSpec, civFinish: () => ({ roughness: .3, metalness: .1 }),
    mesh(geometry, material, parent, x = 0, y = 0, z = 0) { const object = new Three.Mesh(geometry, material); object.position.set(x, y, z); parent.add(object); return object; },
    halo(parent, x, y, z) { const object = new Three.Group(); object.position.set(x, y, z); parent.add(object); return object; },
    approvedVehicleTexture: orm => new Three.Texture(), civLampMaterials: {}, keys: {}, drivenAxle: () => 'rear', queueCarOccupants() {},
    console: { error: error => { throw error; } },
  });
  const approved = source('approved-vehicle-assets3d'),
    patches = approved.slice(approved.indexOf('      function approvedVehicleAtlasPatch('), approved.indexOf('      let approvedVehicleMaterialSet;')),
    lod = approved.slice(approved.indexOf('      function approvedVehicleLod('), approved.indexOf('      function approvedVehicleReport(')),
    civilian = source('cars3d-models'), animation = civilian.slice(civilian.indexOf('      function animateCivilianCar('));
  const api = vm.runInContext(patches + source('sports-vehicle-assets3d') + source('hotrod-vehicle-assets3d') + source('vehicle-assets3d') +
    source('approved-suv3d') + animation + lod + `
    ({ hotrodVehicleData, hotrodVehicleModel, vehicleAssetModel, vaGeometry, makeAssetCar, hotrodVehicleMaterials,
      hotrodVehicleTexture, hotrodVehicleTextureQuality, hotrodVehiclePaint, hotrodVehicleLamps, animateCivilianCar, approvedVehicleLod })`, context);
  const data = api.hotrodVehicleData(), model = api.hotrodVehicleModel();
  t.assert(data === api.hotrodVehicleData() && model === api.vehicleAssetModel('hotrod'), 'hotrod uses its separate cached production pack');
  t.assert(model.type === 'coupe33_zhab' && model.assetPack === 'hotrod' && model.approved, 'licensed hotrod model identity');
  t.assert(model.triangles === 20856 && model.farTriangles <= 5300, 'source-exact near budget and reduced far budget');
  const roles = ['shell', 'panels', 'hood', 'trim', 'cabin', 'glass', 'opticalGlass'];
  for (const suffix of ['', 'Far']) {
    const owned = roles.flatMap(role => model.roleParts[role + suffix]).concat(['headLeft','headRight','tailLeft','tailRight'].map(n => n + suffix),
      Array.from({length:4}, (_, i) => ['tyre','rim'].map(n => `wheel${i}.${n}${suffix}`)).flat()), expected = Object.keys(model.parts).filter(n => n.endsWith('Far') === !!suffix);
    t.assert(new Set(owned).size === owned.length && owned.length === expected.length && expected.every(n => owned.includes(n)), suffix + ': every exported source part has exactly one render owner');
    for (const role of roles) {
      const geometry = api.vaGeometry(model, data, role + suffix, 8);
      t.assert(geometry.index.count === model.roleParts[role + suffix].reduce((n, p) => n + model.parts[p].triangles * 3, 0), suffix + role + ': source role composition');
      for (const attr of ['position','normal','uv','finish','avSourceUv','avAtlasRect','avOrmSourceUv'])
        t.assert(geometry.attributes[attr]?.count === geometry.attributes.position.count, suffix + role + ': complete ' + attr);
    }
  }
  const car = { type: 'hotrod', color: '#b31514', id: 99, hp: 100, maxhp: 100, speed: 30, av: .2, damageVersion: 0, x: 1000, y: 1000 }, built = api.makeAssetCar(car), kit = built.kit;
  built.damageVersion = 0;
  t.assert(built.asset === model.title && built.approvedAsset === model.type, 'actual civilian builder routes the hotrod through its pack');
  t.assert(kit.interiorFallback === null && model.hasInterior && !kit.nativeDoors, 'native cabin retained, no invented native doors or duplicate cabin');
  t.assert(kit.seats.y / kit.k >= .66 && Math.abs(kit.seats.wheel.r / kit.k - .17113967) < 1e-7, 'driver cushion and source steering radius are measured');
  t.assert(built.dims.door.length === 2 && built.dims.door[0] < kit.seats.x && built.dims.door[1] > kit.seats.x, 'existing aperture extraction receives actual source door span');
  t.assert(built.wheels.length === 4 && built.wheels.every(w => w.wheel.children.length === 2 && !w.caliper), 'four native tyre/rim wheels and no invented calipers');
  for (let i = 0; i < 4; i++) {
    const w = built.wheels[i], original = model.wheels[i];
    t.assert(Math.abs(w.wheel.position.x - original.x * kit.k) < 1e-8 && Math.abs(w.wheel.position.y - original.y * kit.k) < 1e-8, 'wheel' + i + ': exact authored hub');
  }
  api.animateCivilianCar(car, built, .1, true, 1, false);
  t.assert(built.wheels.every(w => Math.abs(w.wheel.rotation.z) > 0), 'actual civilian animation rolls every source wheel');
  t.assert(built.wheels.filter(w => w.front).every(w => Math.abs(w.wheel.rotation.y) > 0) && built.wheels.filter(w => !w.front).every(w => w.wheel.rotation.y === 0), 'front wheels steer independently from rear wheels');
  const triCount = () => { let n = 0; built.body.traverse(o => { if (o.isMesh && o.visible) n += Math.min(o.geometry.index?.count || 0, o.geometry.drawRange.count) / 3; }); return n; };
  t.assert(triCount() === model.triangles, 'complete actual near draw matches source face count');
  api.approvedVehicleLod(car, built);
  t.assert(built.approvedLodFar && triCount() === model.farTriangles, 'complete far draw swaps body, wheels, cabin, optics and lamps');
  car.hp = 99; api.approvedVehicleLod(car, built);
  t.assert(!built.approvedLodFar && triCount() === model.triangles, 'damage pins complete near geometry for aperture/deformation ownership');
  const materials = api.hotrodVehicleMaterials();
  t.assert(materials === api.hotrodVehicleMaterials() && materials.trim === materials.rim, 'shared immutable hotrod PBR materials');
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <aomap_fragment>\n#include <lights_physical_fragment>\n#include <emissivemap_fragment>' };
  materials.trim.onBeforeCompile(shader);
  t.assert(shader.vertexShader.includes('avOrmSourceUv') && shader.fragmentShader.includes('texture2D( roughnessMap, hotrodOrmUv )'), 'source roughness UV transform is independent from original albedo UV');
  t.assert(shader.fragmentShader.includes('texture2D( aoMap, approvedUv )') && shader.fragmentShader.includes('texture2D( specularIntensityMap, approvedUv )'), 'source occlusion/specular maps retain their untransformed source UV');
  const high = requests.slice(); high.forEach(i => i.complete());
  t.assert(high.length === 2 && uploads.every(u => u.width === 4096), 'only shared albedo and linear ORM/specular atlases are uploaded');
  activeTier.lodBias = 2; api.hotrodVehicleTextureQuality();
  const low = requests.slice(high.length); low.forEach(i => i.complete());
  t.assert(low.length === 2 && materials.trim.map.image.width === 2048 && materials.trim.roughnessMap.image.width === 2048, 'Low/Medium use 2048 shared textures without changing Texture identity');
  t.assert(materials.trim.map === api.hotrodVehicleTexture() && materials.trim.specularIntensityMap === api.hotrodVehicleTexture(1), 'PBR maps share texture identity across quality changes');
  t.note?.('hotrod source pack, actual builder/animation/LOD/PBR contracts passed without WebGL');
}
