// Actual licensed C8 decoder, native role ranges/panes, pivots/LOD and shared PBR/char texture lifetime.
// Runs entirely on the host; rendered source appearance and doorway visibility have separate GPU checks.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

export default async function (t) {
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    source = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    bytes = fs.readFileSync(process.env.GTA_SPORTS_PACK || new URL('../../assets/sports-vehicle-models.bin', import.meta.url)),
    requests = [], uploads = [], player = { x: 0, y: 0, car: null }, activeTier = { lodBias: 1 },
    ASSETS = { sportsVehicleModels: 'data:application/octet-stream;base64,' + bytes.toString('base64'),
      sportsVehicleAlbedo: 'albedo-full', sportsVehicleAlbedoLow: 'albedo-low', sportsVehicleOrm: 'orm-full',
      sportsVehicleOrmLow: 'orm-low', sportsVehicleEmissive: 'emissive-full', sportsVehicleEmissiveLow: 'emissive-low' };
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
    carSeatPlan: (g, l, w, M) => ({ glass: { g, l, w }, M }),
    vehicleSpec: () => ({ l: 4.69 * 8, w: 2.32 * 8 }), civFinish: () => ({ roughness: .3, metalness: .1 }),
    mesh(geometry, material, parent, x = 0, y = 0, z = 0) { const object = new Three.Mesh(geometry, material); object.position.set(x, y, z); parent.add(object); return object; },
    halo(parent, x, y, z) { const object = new Three.Group(); object.position.set(x, y, z); parent.add(object); return object; },
    approvedVehicleTexture: orm => new Three.Texture(), civLampMaterials: {}, keys: {}, drivenAxle: () => 'rear', queueCarOccupants() {},
    console: { error: error => { throw error; } },
  });
  const approved = source('approved-vehicle-assets3d'),
    patches = approved.slice(approved.indexOf('      function approvedVehicleAtlasPatch('), approved.indexOf('      let approvedVehicleMaterialSet;')),
    lod = approved.slice(approved.indexOf('      function approvedVehicleLod('), approved.indexOf('      function approvedVehicleReport('));
  const civilian = source('cars3d-models'), animation = civilian.slice(civilian.indexOf('      function animateCivilianCar('));
  const api = vm.runInContext(patches + source('sports-vehicle-assets3d') + source('vehicle-assets3d') + source('approved-suv3d') +
    source('vehicle-char3d') + animation + lod + `
    ({ sportsVehicleData, sportsVehicleModel, vehicleAssetModel, vaGeometry, vaKit, makeAssetCar, sportsRoleGeometry, sportsRoleTriangles,
       sportsVehicleTexture, sportsVehicleTextureQuality, sportsVehicleMaterials, sportsVehiclePaint, sportsVehicleLamps,
       approvedVehicleLod, animateCivilianCar, assetCharModel, assetCharSwap, assetCharState, assetCharRelease, assetCharFree })`, context),
    data = api.sportsVehicleData(), model = api.sportsVehicleModel(), k = 8;
  t.assert(data && model.type === 'c8_hari' && model.approved && model.assetPack === 'sports', 'production decoder identifies the separate C8 pack');
  t.assert(api.sportsVehicleData() === data && api.vehicleAssetModel('chevette') === model, 'decoder cache and Chevette selection use the same licensed model');
  t.assert(model.triangles <= 100000 && model.farTriangles <= 12000 && model.farTriangles < model.triangles * .2, 'hero/traffic triangle budgets');
  t.assert(model.lamps && Object.keys(model.lamps).length === 4 && model.paintUv.length === 2, 'measured lamp mounts and generated-panel paint UV available');
  const snapshot = new Map();
  for (const [name, array] of Object.entries(data.arrays)) snapshot.set(name, Buffer.from(array.buffer, array.byteOffset, array.byteLength).slice());
  const roles = ['shell', 'panels', 'hood', 'glass', 'trim', 'cabin', 'opticalGlass'];
  for (const suffix of ['', 'Far']) {
    const active = roles.flatMap(role => model.roleParts[role + suffix]).concat(['headLeft', 'headRight', 'tailLeft', 'tailRight'].map(name => name + suffix),
      Array.from({ length: 4 }, (_, i) => ['tyre', 'rim', 'caliper'].map(role => `wheel${i}.${role}${suffix}`)).flat()),
      expected = Object.keys(model.parts).filter(name => name.endsWith('Far') === !!suffix);
    t.assert(new Set(active).size === active.length && active.length === expected.length && expected.every(name => active.includes(name)), suffix + ': every source part has exactly one active closed render owner');
  }
  for (const suffix of ['', 'Far']) for (const role of roles) {
    const name = role + suffix, geometry = api.vaGeometry(model, data, name, k), names = model.roleParts[name];
    t.assert(geometry.index.count === names.reduce((sum, part) => sum + model.parts[part].triangles * 3, 0), name + ': every authored role face retained once');
    for (const attr of ['normal', 'color', 'uv', 'finish', 'avSourceUv', 'avAtlasRect'])
      t.assert(geometry.attributes[attr]?.count === geometry.attributes.position.count, name + ': complete ' + attr + ' in actual draw');
    let base = 0;
    for (const part of names) {
      const raw = api.vaGeometry(model, data, part, k, null, true), spans = geometry.userData.vehiclePartRanges[part],
        actual = spans.flatMap(([start, count]) => Array.from(geometry.index.array.subarray(start, start + count), i => i - base));
      t.assert(actual.length === raw.index.count && actual.every((value, i) => value === raw.index.array[i]), name + ': exact source index ranges for ' + part);
      for (const attr of ['position', 'normal', 'avSourceUv']) {
        const left = raw.attributes[attr].array, right = geometry.attributes[attr].array, start = base * raw.attributes[attr].itemSize;
        t.assert(left.every((value, i) => value === right[start + i]), name + ': unmodified ' + attr + ' for ' + part);
      }
      base += raw.attributes.position.count;
    }
    if (role === 'glass') {
      t.assert(geometry.groups.length === 5 && geometry.groups.every((group, i) => group.materialIndex === i && group.count === model.rolePanes[name][i] * 3), name + ': correctly ordered combined five panes');
      t.assert(geometry.groups.reduce((sum, group) => sum + group.count, 0) === geometry.index.count, name + ': no hidden/repeated window triangles');
    }
  }
  const kit = api.vaKit('chevette', model.dims[0] * k, 2.32 * .87 * k, 'c8_hari');
  t.assert(api.vaKit('chevette', model.dims[0] * k, 2.32 * .87 * k, 'c8_hari') === kit, 'shared immutable sports kit cache');
  t.assert(kit.interiorFallback === null && model.hasInterior, 'native source cabin avoids duplicate generic seats');
  t.assert(kit.far.trimOuter.drawRange.count === api.sportsRoleTriangles(model, 'trimFar') * 3, 'far trim outer bound includes all native door/caliper/hood layers');
  for (const side of [-1, 1]) {
    const door = kit.nativeDoors[side], authored = model.doors[side < 0 ? 'left' : 'right'];
    t.assert(door.hinge.every((value, i) => Math.abs(value - authored.hinge[i] * k) < 1e-9), 'side' + side + ': exact authored door hinge');
    t.assert(door.partNames.length === Object.values(authored.parts).flat().length && door.partNames.some(name => name.endsWith('.cabin')) && door.partNames.some(name => name.endsWith('.opticalGlass')), 'side' + side + ': native cards/mirror covers/indicator parts available');
  }
  for (let i = 0; i < 4; i++) {
    const wheel = kit.assetWheels[i], packed = model.wheels[i];
    t.assert(Math.hypot(wheel.x - packed.x * k, wheel.y - packed.y * k, wheel.z - packed.z * k) < 1e-9, 'wheel' + i + ': true source hub unchanged');
    for (const part of ['tyre', 'rim']) {
      const original = wheel[part].attributes.position.array.slice(), point = new Three.Vector3(), q = new Three.Quaternion(), axis = new Three.Vector3(...packed.axle);
      let worst = 0;
      for (let phase = 0; phase < 24; phase++) {
        q.setFromAxisAngle(axis, phase * Math.PI / 12);
        for (let j = 0; j < original.length; j += 3) {
          point.fromArray(original, j); const before = point.dot(axis); point.applyQuaternion(q);
          worst = Math.max(worst, Math.abs(point.dot(axis) - before));
        }
      }
      t.assert(worst < 1e-10, 'wheel' + i + '.' + part + ': no axial wobble across 24 rolling phases');
      t.assert(wheel[part].attributes.position.array.every((value, j) => value === original[j]), 'wheel' + i + '.' + part + ': rolling proof does not mutate cached vertices');
    }
    t.assert(wheel.caliper && kit.far.wheels[i].caliper && !model.roleParts.trim.includes(packed.caliper), 'wheel' + i + ': separate hub-relative close/far caliper without fixed-body duplicate');
  }
  const driven = { type: 'chevette', color: '#9cb8cf', id: 701, speed: 24, av: .4, hp: 100, maxhp: 100, spinSpeed: 0 },
    beforeBuild = JSON.stringify(driven), moving = api.makeAssetCar(driven);
  t.assert(JSON.stringify(driven) === beforeBuild && moving.kit === kit && moving.approvedAsset === model.type, 'actual C8 builder preserves simulation state and selects the cached source kit');
  for (let i = 0; i < 4; i++) {
    const record = moving.wheels[i]; record.wheel.rotation.x = .06 * record.side;
    t.assert(record.caliper === record.wheel.children[2] && record.caliper.geometry === kit.assetWheels[i].caliper, 'wheel' + i + ': production builder attaches source caliper as hub child2');
  }
  for (let phase = 0; phase < 24; phase++) {
    driven.speed = phase < 12 ? 24 : -16; driven.av = Math.sin(phase) * .7; driven.spinSpeed = phase > 16 ? 12 : 0;
    api.animateCivilianCar(driven, moving, .1, true, 0, false); moving.group.updateMatrixWorld(true);
    for (let i = 0; i < 4; i++) {
      const record = moving.wheels[i], expected = new Three.Matrix4().compose(record.wheel.position,
        new Three.Quaternion().setFromEuler(new Three.Euler(record.wheel.rotation.x, record.wheel.rotation.y, 0)), new Three.Vector3(1, 1, 1));
      t.assert(record.caliper.matrixWorld.elements.every((value, j) => Math.abs(value - expected.elements[j]) < 1e-9), 'phase' + phase + ' wheel' + i + ': production caliper inherits hub/steer/camber while cancelling forward/reverse/spin roll');
      t.assert(record.wheel.children[0].geometry === kit.assetWheels[i].tyre && record.wheel.children[1].geometry === kit.assetWheels[i].rim, 'phase' + phase + ' wheel' + i + ': tyre-first/rim-second contract preserved');
    }
  }
  const activeTriangles = () => {
    let total = 0;
    moving.group.traverse(object => { if (object.isMesh) total += object.geometry.index.count / 3; });
    return total;
  };
  t.assert(activeTriangles() === model.triangles, 'actual pristine C8 builder draws all85031 close source triangles exactly once');
  t.assert(moving.lamps.length === 4 && moving.lamps.every(lamp => moving.approvedLodParts.some(pair => pair.mesh === lamp.mesh && pair.far === kit.far.lamps[lamp.key])), 'all four actual head/tail lamp meshes have cached authored Far pairs');
  Object.assign(driven, { x: 1000, y: 0, damageVersion: 0, damage: {}, dents: [] }); moving.damageVersion = 0;
  api.approvedVehicleLod(driven, moving);
  t.assert(moving.approvedLodFar && activeTriangles() === model.farTriangles && activeTriangles() === 9407, 'actual distant C8 draws9407 triangles including its Far lamp geometry');
  for (const lamp of moving.lamps) {
    t.assert(lamp.mesh.geometry === kit.far.lamps[lamp.key] && lamp.mesh.geometry.index.count / 3 === model.parts[lamp.key + 'Far'].triangles, lamp.key + ': actual far draw selects the emitted source lamp part');
    t.assert(['normal', 'color', 'finish', 'avSourceUv', 'avAtlasRect'].every(name => lamp.mesh.geometry.attributes[name]?.count === lamp.mesh.geometry.attributes.position.count), lamp.key + ': far lamp preserves all source material attributes');
  }
  api.animateCivilianCar(driven, moving, .01, true, 1, true);
  t.assert(moving.lamps.every(lamp => lamp.mesh.material === lamp.materials[lamp.kind === 'head' ? 'headOn' : 'brake']), 'actual Far lamps retain headlight/brake state materials');
  driven.damage = { lights: { headLeft: true } }; driven.damageVersion = 1; api.approvedVehicleLod(driven, moving);
  t.assert(!moving.approvedLodFar && activeTriangles() === model.triangles && moving.lamps.every(lamp => lamp.mesh.geometry === kit.lamps[lamp.key]), 'lamp damage restores all close source geometry before the damage pass');
  driven.damage = {}; driven.damageVersion = moving.damageVersion = 2; api.approvedVehicleLod(driven, moving);
  t.assert(moving.approvedLodFar && activeTriangles() === 9407, 'repaired distant C8 returns to cached Far lamps without changing mesh identities');
  player.car = driven; api.approvedVehicleLod(driven, moving); player.car = null;
  t.assert(!moving.approvedLodFar && activeTriangles() === 85031, 'player C8 restores complete close lamps and body');
  const pairs = ['shell', 'hood', 'paint', 'cabin', 'trim', 'opticalGlass'].map(field => ({ mesh: new Three.Mesh(kit[field]), near: kit[field], far: kit.far[field] })),
    car = { x: 1000, y: 0, hp: 100, maxhp: 100, damageVersion: 0, damage: {}, dents: [] },
    render = { approvedLodParts: pairs, damageVersion: 0, shapeVersion: 0 };
  api.approvedVehicleLod(car, render);
  t.assert(render.approvedLodFar && pairs.every(pair => pair.mesh.geometry === pair.far), 'distant intact C8 swaps every real role to far geometry');
  render.doorBodyMask = 1; api.approvedVehicleLod(car, render);
  t.assert(!render.approvedLodFar && pairs.every(pair => pair.mesh.geometry === pair.near), 'open native doorway pins matching close source ranges');
  render.doorBodyMask = 0; player.car = car; api.approvedVehicleLod(car, render);
  t.assert(!render.approvedLodFar, 'player vehicle remains close detail'); player.car = null;
  const materials = api.sportsVehicleMaterials(), paint = api.sportsVehiclePaint({ color: '#9cb8cf' }), lamps = api.sportsVehicleLamps(),
    textures = [api.sportsVehicleTexture(), api.sportsVehicleTexture(1), api.sportsVehicleTexture(2)];
  t.assert(textures.every(texture => texture.flipY === false && texture.anisotropy === 8), 'all sports atlases use source UV orientation and bounded filtering');
  t.assert(textures[0].colorSpace === Three.SRGBColorSpace && textures[1].colorSpace === Three.NoColorSpace && textures[2].colorSpace === Three.SRGBColorSpace, 'albedo/emission colour and linear ORM formats');
  t.assert(requests.length === 3, 'shared source materials request each atlas once');
  requests.slice().forEach(image => image.complete());
  const disposed = textures.map(() => 0); textures.forEach((texture, i) => texture.addEventListener('dispose', () => disposed[i]++));
  activeTier.lodBias = 1.4; api.sportsVehicleTextureQuality(); const stale = requests.slice(-3);
  activeTier.lodBias = 1; api.sportsVehicleTextureQuality(); const current = requests.slice(-3);
  stale.forEach(image => image.complete());
  t.assert(textures.every(texture => texture.image.width === 4096) && disposed.every(count => count === 0), 'late low-tier loads cannot replace newer high-tier request');
  current.forEach(image => image.complete());
  activeTier.lodBias = 1.4; api.sportsVehicleTextureQuality(); requests.slice(-3).forEach(image => image.complete());
  t.assert(textures.every((texture, i) => texture === api.sportsVehicleTexture(i) && texture.image.width === 2048) && disposed.every(count => count === 1), 'LOW reallocates storage once while keeping all material map references');
  activeTier.lodBias = 1; api.sportsVehicleTextureQuality(); requests.slice(-3).forEach(image => image.complete());
  t.assert(disposed.every(count => count === 2) && textures.every(texture => texture.image.width === 4096), 'restoring HQ reallocates dimensions before upload');
  t.assert(materials.trim.map === textures[0] && materials.trim.emissiveMap === textures[2] && paint.roughnessMap === textures[1] && lamps.headOn.emissiveMap === textures[2], 'authored body/cabin/lamp maps survive quality transitions');
  t.assert(materials.opticalGlass.transparent && !materials.opticalGlass.depthWrite && materials.opticalGlass.forceSinglePass && materials.opticalGlass.side === Three.DoubleSide, 'native optical covers keep authored alpha in one transparent pass');
  const shaderFor = material => {
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <project_vertex>',
      fragmentShader: '#include <common>\n#include <map_fragment>\n#include <alphamap_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <emissivemap_fragment>\n#include <lights_physical_fragment>' };
    material.onBeforeCompile(shader); return shader;
  };
  for (const [name, material] of Object.entries({ paint, trim: materials.trim, optics: materials.opticalGlass, lamps: lamps.headOn })) {
    const shader = shaderFor(material);
    t.assert(shader.vertexShader.includes('attribute vec2 avSourceUv') && shader.fragmentShader.includes('fract(vAvSourceUv)'), name + ': repeated source UV atlas shader compiled');
    t.assert(shader.fragmentShader.includes('texture2D( emissiveMap, approvedUv )'), name + ': actual emission samples matching source atlas rectangle');
  }
  const group = new Three.Group(), sources = [paint, materials.trim, materials.opticalGlass, lamps.headOn], meshes = sources.map(material => new Three.Mesh(kit.shell, material));
  meshes.forEach(mesh => group.add(mesh)); const wreck = { group, paint, shapeVersion: 0 };
  t.assert(api.assetCharModel(wreck), 'sports PBR meshes participate in actual burnt-asset lifecycle');
  api.assetCharSwap({ id: 701 }, wreck, true);
  t.assert(wreck.assetChar.materials.length === 4 && meshes.every((mesh, i) => mesh.material !== sources[i]), 'wreck swaps all source sports material variants');
  for (let i = 0; i < sources.length; i++) {
    const char = meshes[i].material, original = sources[i];
    t.assert(char.map === original.map && char.roughnessMap === original.roughnessMap && char.metalnessMap === original.metalnessMap && char.emissiveMap === original.emissiveMap, 'char' + i + ': source albedo/ORM/emission references retained');
    t.assert(char.transparent === original.transparent && char.depthWrite === original.depthWrite && char.side === original.side && char.forceSinglePass === original.forceSinglePass, 'char' + i + ': source opaque/transparent render flags retained');
    t.assert(shaderFor(char).fragmentShader.includes('texture2D( emissiveMap, approvedUv )'), 'char' + i + ': burnt emission still uses source UV rectangle');
  }
  api.assetCharRelease(wreck);
  t.assert(meshes.every((mesh, i) => mesh.material === sources[i]) && !wreck.assetChar, 'repair restores exact sports source materials');
  group.clear(); meshes.forEach(mesh => group.add(mesh)); api.assetCharSwap({ id: 702 }, wreck, true);
  t.assert(meshes.every(mesh => mesh.material.userData.assetChar.kind === 'approved'), 'pooled char materials reuse approved shader kind across source order');
  meshes.forEach((mesh, i) => {
    const char = mesh.material, original = sources[i];
    t.assert(char.transparent === original.transparent && char.depthWrite === original.depthWrite && char.side === original.side && char.forceSinglePass === original.forceSinglePass && char.emissiveIntensity === original.emissiveIntensity, 'reused char' + i + ': a different pooled variant resets optical and emissive flags');
    t.assert(char.map === original.map && char.emissiveMap === original.emissiveMap && char.userData.assetChar.roughnessFloor.value === (original.userData.approvedPaint ? .22 : original.userData.approvedRubber ? .78 : 0), 'reused char' + i + ': source maps and finish floor reset across paint/glass/lamp variants');
  });
  api.assetCharRelease(wreck);
  for (const [name, original] of snapshot) {
    const array = data.arrays[name];
    t.assert(original.equals(Buffer.from(array.buffer, array.byteOffset, array.byteLength)), name + ': decoded source array remains immutable');
  }
  const sourceInputs = Object.fromEntries(['sports-vehicle-assets3d', 'approved-suv3d', 'approved-vehicle-assets3d', 'vehicle-assets3d', 'vehicle-char3d', 'cars3d-models'].map(name =>
    ['src/' + name + '.js', createHash('sha256').update(source(name)).digest('hex')]));
  t.note(JSON.stringify({ packSHA256: createHash('sha256').update(bytes).digest('hex'), sourceInputs, model: model.type, triangles: model.triangles, farTriangles: model.farTriangles, actualNearTriangles: 85031, actualFarTriangles: 9407, parts: Object.keys(model.parts).length,
    arrays: snapshot.size, textureUploads: uploads.length, disposeByAtlas: disposed, nativeDoorHinges: Object.values(kit.nativeDoors).map(door => door.hinge) }));
}
