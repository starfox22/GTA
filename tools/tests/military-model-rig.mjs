// Production packed military kits: immutable sharing, original lenses, physics-driven
// wheels, LOD hysteresis and char/repair material round trips with real Three.js.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

export async function runMilitaryModelRig(t, exercise = null) {
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    read = name => fs.readFileSync(new URL('../../src/' + name, import.meta.url), 'utf8'),
    bytes = fs.readFileSync(new URL('../../assets/vehicle-models.bin', import.meta.url)),
    length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length)),
    base = 12 + length, types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array }, arrays = {};
  for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(base + offset, base + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  const player = { car: null }, scope = vm.createContext({ Three, fixture: { header, arrays }, player,
    sharedGeometries: new Set(), sharedMaterials: new Set(), boxGeo: new Three.BoxGeometry(),
    sootTexture: new Three.Texture(), glass: new Three.MeshStandardMaterial(),
    warmLamp: new Three.MeshStandardMaterial(), tailLamp: new Three.MeshStandardMaterial(),
    brakeLamp: new Three.MeshBasicMaterial(), deadLamp: new Three.MeshStandardMaterial(), lampAmount: 0,
    vehicleLampAmount: () => scope.lampAmount,
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), cityMaterialPatch: () => {},
    // Char prewarm now includes the approved atlas program. Exercise its real
    // factory; this host fixture has no GPU/image decoder to upload to.
    renderer: { capabilities: { getMaxAnisotropy: () => 8 }, initTexture() {} },
    vehicleSpec: c => ({ modelScale: c.scale || 1 }), chaseViewActive: true,
    activeTier: { lodBias: 1 }, zoom: 1, chaseZoomAt: () => scope.zoom,
    mesh(geometry, material, parent) { const o = new Three.Mesh(geometry, material); parent.add(o); return o; }
  });
  const finishSource = read('cars3d-materials.js'),
    finish = finishSource.slice(finishSource.indexOf('      function civFinishPatch('), finishSource.indexOf('      let civMaterials')),
    api = vm.runInContext(finish + read('vehicle-assets3d.js') + read('approved-vehicle-assets3d.js') + read('military-asset-wheels3d.js') + read('military-mark-rays3d.js') + read('military-assets3d.js') + read('vehicle-char3d.js') + `
      vaData = () => fixture; vaAtlas = () => sootTexture;
      ({ militaryAssetBody, militaryAssetKit, animateMilitaryWheels, animateMilitaryLamps, militaryLampSet, militaryLod,
         vaMaterials, assetCharModel, assetCharSwap, assetCharState, assetCharRelease, assetCharWarm })`, scope),
    make = (type, scale = 1) => {
      const group = new Three.Group(), body = new Three.Group(); group.add(body);
      const model = { group, body, wheels: [], lamps: [], paint: new Three.MeshStandardMaterial() };
      api.militaryAssetBody(model, { type, scale }, type, header.models[type].dims[0] * 8);
      return model;
    },
    mats = api.vaMaterials();
  if (exercise) return exercise({ Three, read, scope, api, make, header, arrays, mats });
  t.assert(mats.armyBody.roughness > .8 && mats.armyBody.metalness < .1, 'canvas/paint still uses chrome finish');
  const jeep = make('army_jeep'), kit = api.militaryAssetKit('army_jeep', header.models.army_jeep.dims[0] * 8),
    panes = kit.panes.index.count, lenses = Object.values(kit.lamps).reduce((sum, g) => sum + g.index.count, 0);
  t.assert(jeep.lamps.length === 4 && lenses === 156 * 3, 'source lamp lenses not separated into four damageable lights');
  t.assert(panes + lenses === header.models.army_jeep.parts.glass.triangles * 3, 'lens split lost/duplicated source triangles');
  for (const geo of Object.values(kit.lamps)) {
    const span = geo.boundingBox.getSize(new Three.Vector3());
    t.assert(Math.max(span.x, span.y, span.z) < kit.k * .6, 'tiny lamp retains whole-vehicle bounds and cannot cull by size');
  }
  const seen = new Set();
  for (const geo of [kit.panes, ...Object.values(kit.lamps)]) {
    for (let i = 0; i < geo.index.count; i += 3) {
      const key = [geo.index.getX(i), geo.index.getX(i + 1), geo.index.getX(i + 2)].join(',');
      t.assert(!seen.has(key), 'source lens/window triangle drawn twice'); seen.add(key);
    }
    t.assert(geo.attributes.position === kit.panes.attributes.position && geo.attributes.uv === kit.panes.attributes.uv,
      'lamp extraction changed downloaded positions or atlas UVs');
  }
  const size = scope.sharedGeometries.size;
  for (let n = 0; n < 20; n++) {
    const copy = make('army_jeep');
    t.assert(copy.wheels[0].wheel.children[0].geometry === jeep.wheels[0].wheel.children[0].geometry &&
      copy.lod.near.children[0].geometry === jeep.lod.near.children[0].geometry, 'military spawn duplicates full geometry');
    t.assert(copy.wheels[0].wheel !== jeep.wheels[0].wheel, 'shared wheel pivot makes separate vehicles move together');
  }
  t.assert(scope.sharedGeometries.size === size, 'repeat patrol spawn retains new geometry buffers');
  const lights = api.militaryLampSet(), parked = { hp: 380, ai: false, braking: false, damage: { lights: {}, burnt: false } },
    frontLamp = jeep.lamps.find(l => l.key === 'headLeft'), tail = jeep.lamps.find(l => l.key === 'tailLeft');
  api.animateMilitaryLamps(parked, jeep);
  t.assert(frontLamp.mesh.material === lights.headOff && tail.mesh.material === lights.tailOff, 'parked daylight lamps glow');
  scope.lampAmount = 1; api.animateMilitaryLamps(parked, jeep);
  t.assert(frontLamp.mesh.material === lights.headOff && tail.mesh.material === lights.tailOff, 'parked night lamps glow');
  player.car = parked; const unchanged = JSON.stringify(parked); api.animateMilitaryLamps(parked, jeep);
  t.assert(frontLamp.mesh.material === lights.headOn && tail.mesh.material === lights.tailOn, 'driven night lamps fail to light');
  t.assert(JSON.stringify(parked) === unchanged, 'lamp renderer mutates simulation');
  scope.lampAmount = 0; parked.braking = true; api.animateMilitaryLamps(parked, jeep);
  t.assert(frontLamp.mesh.material === lights.headOff && tail.mesh.material === lights.brake, 'daylight brake lamps fail');
  parked.damage.lights.headLeft = parked.damage.lights.tailLeft = true; api.animateMilitaryLamps(parked, jeep);
  t.assert(frontLamp.mesh.material === scope.deadLamp && tail.mesh.material === scope.deadLamp, 'broken lamps relight while braking');
  parked.damage.lights = {}; parked.damage.burnt = true; api.animateMilitaryLamps(parked, jeep);
  t.assert(jeep.lamps.every(l => l.mesh.material === scope.deadLamp), 'burnt vehicle lamps remain lit');
  parked.damage.burnt = false; parked.hp = 0; api.animateMilitaryLamps(parked, jeep);
  t.assert(jeep.lamps.every(l => l.mesh.material === scope.deadLamp), 'destroyed vehicle lamps remain lit');
  parked.hp = 380; parked.braking = false; player.car = null; scope.lampAmount = 0; api.animateMilitaryLamps(parked, jeep);
  t.assert(frontLamp.mesh.material === lights.headOff && tail.mesh.material === lights.tailOff, 'repaired parked lamps do not restore');
  parked.ai = true; scope.lampAmount = .2; api.animateMilitaryLamps(parked, jeep);
  t.assert(frontLamp.mesh.material === lights.headOn && tail.mesh.material === lights.tailOn, 'AI/rain lamps fail to light');
  const legacy = { lamps: [{ key: 'headLeft', mesh: { material: scope.warmLamp } }] };
  api.animateMilitaryLamps(parked, legacy);
  t.assert(legacy.lamps[0].mesh.material === scope.warmLamp, 'new lens updater changes legacy vehicles');
  for (const type of ['army_jeep', 'army_truck']) {
    const model = type === 'army_jeep' ? jeep : make(type, 1.4),
      c = { id: 17, speed: 24, spinSpeed: 0, tyres: { steer: .38, lock: [0, 0] } },
      state = JSON.stringify(c), rear = model.wheels.find(w => !w.front), front = model.wheels.find(w => w.front);
    t.assert(model.wheels.filter(w => w.front).length === 2, type + ': steering axle classification lost');
    t.assert(model.wheels.every(w => w.wheel.children[0].geometry.attributes.finish.count > 0), type + ': wheel finish absent');
    api.animateMilitaryWheels(c, model, .1);
    t.near(front.wheel.rotation.y, -.380001, -.379999, type + ': front follows physics steer');
    t.assert(rear.wheel.rotation.y === 0 && front.wheel.rotation.z < 0, type + ': wrong steering axle or forward roll');
    t.assert(JSON.stringify(c) === state, type + ': renderer changed simulation');
    c.speed = -24; api.animateMilitaryWheels(c, model, .1);
    t.assert(Math.abs(front.wheel.rotation.z) < 1e-9 && Math.abs(rear.wheel.rotation.z) < 1e-9, type + ': reverse roll');
    c.speed = 24; c.tyres.lock = [1, 1]; api.animateMilitaryWheels(c, model, .1);
    t.assert(front.wheel.rotation.z === 0 && rear.wheel.rotation.z === 0, type + ': locked tyres still rolling');
    c.tyres.lock = [0, 0]; c.spinSpeed = 12; api.animateMilitaryWheels(c, model, .1);
    t.assert(Math.abs(rear.wheel.rotation.z + 3.6 / rear.radius) < 1e-9, type + ': rear wheelspin discarded');
    t.assert(api.assetCharModel(model), type + ': custom finishes missed by wear/burn detection');
    const original = model.wheels[0].wheel.children[0].material;
    api.assetCharSwap(c, model, false); api.assetCharState(model, .1, .2, 0);
    const char = model.wheels[0].wheel.children[0].material;
    t.assert(char.userData.assetChar.kind === 'finish' && char.userData.assetChar.state.value.x === .1,
      type + ': wear shader loses per-vertex wheel finish');
    api.assetCharState(model, .1, .2, 1);
    t.assert(char.roughness === .97 && char.metalness === .12, type + ': burnt finish not matte');
    const shader = { uniforms: {}, vertexShader: Three.ShaderLib.standard.vertexShader, fragmentShader: Three.ShaderLib.standard.fragmentShader };
    char.onBeforeCompile(shader);
    t.assert(shader.fragmentShader.includes('roughnessFactor = charState.z') && shader.vertexShader.includes('vFinish = finish;'),
      type + ': char/finish shader composition missing');
    api.assetCharRelease(model);
    t.assert(model.wheels[0].wheel.children[0].material === original && !model.assetChar, type + ': repaired finish not restored');
  }
  const c = { x: 0, y: 0 };
  scope.zoom = .89; api.militaryLod(c, jeep); t.assert(jeep.lod.isFar, 'far LOD does not engage');
  scope.zoom = 1.05; api.militaryLod(c, jeep); t.assert(jeep.lod.isFar, 'LOD chatters at transition');
  scope.zoom = 1.11; api.militaryLod(c, jeep); t.assert(!jeep.lod.isFar, 'near LOD does not restore');
  player.car = c; scope.zoom = .01; api.militaryLod(c, jeep); t.assert(!jeep.lod.isFar, 'player M4 loses intact close body');
  const stand = make('army_jeep'); t.assert(api.assetCharWarm(stand), 'military char prewarm failed');
  t.note('Original 156 lamp triangles reassigned; no geometry/texture replacement; two military kits reused across 20 repeated spawns.');
}
export default runMilitaryModelRig;
