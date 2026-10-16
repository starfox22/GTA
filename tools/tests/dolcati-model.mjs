// Production Dolcati source pack/decoder/steering, shared LOD, puncture and rider contact regression.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { runMotorcycleRiderFit } from './motorcycle-rider-fit.mjs';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const source = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');

export default async function (t) {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../assets/manifest.json', import.meta.url), 'utf8'));
  const media = Object.fromEntries(manifest.map(entry => [entry.id, 'data:' + entry.mime + ';base64,' + Buffer.from(entry.id).toString('base64')]));
  let loadedAssets;
  vm.runInNewContext(source('asset-loader'), { window: { DEAD_END_CITY_MEDIA: media },
    document: { getElementById: () => ({ style: {}, dataset: { mime: 'image/png' }, textContent: 'AA==' }),
      documentElement: { style: { setProperty() {} } } },
    startDeadEndCity: assets => { loadedAssets = assets; } });
  for (const [key, id] of [['Models', 'models'], ['Albedo', 'albedo'], ['Orm', 'orm'], ['Emissive', 'emissive'],
    ['AlbedoLow', 'albedo-low'], ['OrmLow', 'orm-low'], ['EmissiveLow', 'emissive-low']])
    t.assert(loadedAssets['dolcatiVehicle' + key] === media['media-dolcati-vehicle-' + id],
      'actual production loader omitted Dolcati ' + key);
  const data = fs.readFileSync(new URL('../../assets/dolcati-vehicle-models.bin', import.meta.url)),
    player = { car: null, x: 0, y: 0 }, materials = Object.fromEntries(['trim', 'rubber', 'rim', 'glass', 'headOff', 'headOn', 'tailOff', 'tailOn', 'brake']
      .map(name => [name, new Three.MeshStandardMaterial()]));
  const scope = vm.createContext({ Three, ASSETS: { dolcatiVehicleModels: 'data:application/octet-stream;base64,' + data.toString('base64') },
    atob: text => Buffer.from(text, 'base64').toString('binary'), TextDecoder, Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Float32Array, DataView,
    player, materials, CAR_M: 8, KMH: 8 / 3.6, TAU: Math.PI * 2, activeTier: { lodBias: 1 }, viewZoom: 2, chaseViewActive: false,
    sharedGeometries: new Set(), sharedMaterials: new Set(),
    renderer: { capabilities: { getMaxAnisotropy: () => 1 } },
    clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)),
    actionHeld: () => false, vehicleLampAmount: () => 1, chaseZoomAt: () => 2,
    isAircraft: () => false, isBoat: () => false,
    vehicleSpec: () => ({ l: 2.11 * 8 }), civSharedMaterials: () => materials, civLampSet: () => materials,
    mesh(geometry, material, parent) { const mesh = new Three.Mesh(geometry, material); parent.add(mesh); return mesh; },
    halo(parent, x, y, z) { const group = new Three.Group(); group.position.set(x, y, z); parent.add(group); return group; },
    specialVehicle() { const group = new Three.Group(), body = new Three.Group(); group.add(body); return { group, body, wheels: [], lamps: [], special: true }; },
  });
  const api = vm.runInContext(source('vehicle-assets3d') + source('approved-vehicle-assets3d') + source('dolcati-vehicle-assets3d') +
    source('motorbikes3d') + source('motorbike-assets3d') + `
      vaData = () => ({header:{models:{}}}); vaMaterials = () => materials;
      dolcatiVehicleMaterials = () => materials; dolcatiVehicleLamps = () => materials;
      dolcatiVehiclePaint = c => new Three.MeshPhysicalMaterial({color:c.color});
      motoRiderGeometry = () => new Three.BoxGeometry(.1,.1,.1);
      ({dolcatiVehicleData, dolcatiVehicleModel, vehicleAssetModel, makeAssetMotorbike, motoAssetKit, motoAssetLod, animateMotorbike,
        disableAssets: () => {vaEnabled=false}, low: () => {activeTier={lodBias:1.5}}, far: () => {viewZoom=.1}})`, scope);
  const packed = api.dolcatiVehicleModel(), fixture = api.dolcatiVehicleData();
  t.assert(packed?.author === 'ROY' && packed.license === 'CC BY 4.0', 'model-specific downloaded source credit missing');
  t.assert(packed.triangles === 372664 && packed.sourceTriangles === packed.triangles, 'close model lost original source geometry');
  t.assert(packed.farTriangles < 40000 && packed.farTriangles > 12000, 'separate distant motorcycle budget missing');
  t.assert(packed.seatProof.primitive === 6 && packed.seatProof.barycentric.length === 3, 'driver saddle source-ray evidence missing');
  t.assert(api.vehicleAssetModel('dolcati') === packed, 'production selector did not replace Dolcati');
  t.assert(fixture.arrays['dolcati_roy.trim.n'].BYTES_PER_ELEMENT === 2, 'authored close normals lost signed16 precision');
  const c = { type: 'dolcati', color: '#c8102e', hp: 100, maxhp: 100, speed: 0, av: 0, wheelie: 0, x: 0, y: 0, damage: { marks: [] }, dents: [] },
    model = api.makeAssetMotorbike(c), clone = api.makeAssetMotorbike({ ...c, id: 2 }), kit = api.motoAssetKit('dolcati', 16.88);
  const modelBudget = () => {
    let calls = 0, triangles = 0;
    model.group.traverse(object => { if (object.isMesh && object.visible) { calls++; triangles += object.geometry.index.count / 3; } });
    return { calls, triangles };
  }, closeBudget = modelBudget();
  t.assert(model.approvedAsset === 'dolcati_roy' && model.bike && model.realSize, 'production motorcycle contract missing');
  t.assert(model.wheels.length === 2 && model.motoLod.pairs.length >= 8, 'source wheel rig or shared LOD missing');
  t.assert(model.steer !== clone.steer && model.paint !== clone.paint && model.wheels[0].wheel !== clone.wheels[0].wheel,
    'dynamic fork/wheel/paint shared by separate bikes');
  t.assert(model.wheels[0].wheel.children[0].geometry === clone.wheels[0].wheel.children[0].geometry, 'repeated motorcycles duplicated source geometry');
  t.assert(model.lamps.every(lamp => lamp.materials === materials), 'source lamp textures lost on lighting-state changes');
  const head = model.lamps.find(lamp => lamp.kind === 'head').mesh;
  t.assert(head.parent === model.body, 'fairing headlamps incorrectly turn with the handlebars');
  for (const pair of model.motoLod.pairs) for (const level of ['near', 'far'])
    t.assert(['finish', 'avSourceUv', 'avAtlasRect'].every(name => pair[level].attributes[name]?.count === pair[level].attributes.position.count),
      'source PBR/UV attribute missing from ' + level + ' LOD');
  let maxWobble = 0;
  for (let i = 0; i < 2; i++) {
    const wheel = model.wheels[i].wheel, rim = wheel.children[1], samples = [];
    for (let phase = 0; phase < 24; phase++) {
      wheel.rotation.z = phase / 24 * Math.PI * 2; model.group.updateMatrixWorld(true);
      const axis = new Three.Vector3(0, 0, 1).applyQuaternion(wheel.parent.getWorldQuaternion(new Three.Quaternion())),
        center = wheel.getWorldPosition(new Three.Vector3()), point = new Three.Vector3().fromBufferAttribute(rim.geometry.attributes.position, 0).applyMatrix4(rim.matrixWorld).sub(center);
      samples.push(point.dot(axis));
    }
    maxWobble = Math.max(maxWobble, Math.max(...samples) - Math.min(...samples)); wheel.rotation.z = 0;
    t.assert(wheel.userData.bikeContact.front === (i === 0) && wheel.userData.bikeContact.r > 2, 'source tyre contact/radius lost');
  }
  t.assert(maxWobble < 1e-8, 'wheel rolling axis precesses');
  c.x = 160; api.motoAssetLod(c, model);
  t.assert(model.motoLod.isFar, 'distant traffic retained the372K hero mesh on High');
  c.x = 0; api.motoAssetLod(c, model);
  t.assert(!model.motoLod.isFar, 'close source inspection lost hero geometry on High');
  api.low(); api.motoAssetLod(c, model);
  t.assert(model.motoLod.isFar, 'unoccupied Low-tier traffic retained hero geometry');
  const trafficBudget = modelBudget();
  t.assert(trafficBudget.calls === closeBudget.calls && trafficBudget.triangles < 26000, 'traffic LOD added draws or failed its triangle budget');
  api.far(); api.motoAssetLod(c, model);
  t.assert(model.motoLod.isFar && model.motoLod.pairs.every(pair => pair.mesh.geometry === pair.far), 'distant source LOD was not selected');
  player.car = c; api.motoAssetLod(c, model);
  t.assert(!model.motoLod.isFar && model.motoLod.pairs.every(pair => pair.mesh.geometry === pair.near), 'player motorcycle lost source near geometry');
  api.disableAssets(); t.assert(api.vehicleAssetModel('dolcati') === null, 'procedural fallback switch lost');
  t.note(JSON.stringify({ sourceTriangles: packed.triangles, farTriangles: packed.farTriangles, sharedLodPairs: model.motoLod.pairs.length, maxWobble,
    tyreRadii: [kit.front.r / 8, kit.rear.r / 8], closeBudget, trafficBudget }));
  for (const height of [1.65, 1.8, 1.9]) await runMotorcycleRiderFit(t, 'dolcati', height);
}
