// Exercise the production decoder, source UV buffers, cached body envelopes and
// texture tier races without a GPU. Rendered shader/appearance checks are separate.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const source = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
const bytes = name => fs.readFileSync(new URL('../../assets/' + name, import.meta.url));

export default async function (t) {
  const pack = bytes('approved-vehicle-models.bin'), pending = [], uploads = [],
    scope = vm.createContext({ Three, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array,
      Float32Array, DataView, TextDecoder, console, atob: value => Buffer.from(value, 'base64').toString('binary'),
      ASSETS: { approvedVehicleModels: 'data:application/octet-stream;base64,' + pack.toString('base64'),
        approvedVehicleAlbedo: 'albedoFull', approvedVehicleOrm: 'ormFull',
        approvedVehicleAlbedoLow: 'albedoLow', approvedVehicleOrmLow: 'ormLow' },
      activeTier: { lodBias: 1 }, player: { x: 0, y: 0, car: null },
      carModels: new Map(), bodyPools: new Map(), policeImpostorKey: () => null, approvedSuvKey: () => 's1_jimny',
      sharedGeometries: new Set(), renderer: { capabilities: { getMaxAnisotropy: () => 8 },
        initTexture: texture => uploads.push(texture.image.src) },
      Image: class { set src(value) { this._src = value; this.width = this.height = value.endsWith('Low') ? 2048 : 4096; pending.push(this); }
        get src() { return this._src; } },
    });
  const api = vm.runInContext(source('vehicle-assets3d') + source('approved-vehicle-assets3d') + `
    ({ approvedVehicleData, approvedVehicleModel, approvedVehicleTexture, approvedVehicleTextureQuality,
      approvedVehicleLod, approvedVehicleGeometry, approvedVehicleReport })`, scope);
  const data = api.approvedVehicleData(), keys = ['m1_enduro', 'm2_sport', 's1_jimny', 's2_suv', 's3_offroad'];
  t.assert(data && keys.every(key => api.approvedVehicleModel(key)), 'production decoder cannot load all five approved models');
  t.assert(api.approvedVehicleData() === data, 'packed vehicle data is decoded repeatedly');
  let tiled = 0, totalParts = 0;
  for (const key of keys) {
    const model = api.approvedVehicleModel(key);
    t.assert(model.approved && model.triangles > model.farTriangles, key + ': close/far geometry missing');
    for (const part of Object.keys(model.parts)) {
      const geometry = api.approvedVehicleGeometry(model, part, 8), count = geometry.attributes.position.count;
      for (const name of ['normal', 'uv', 'finish', 'color', 'avSourceUv', 'avAtlasRect'])
        t.assert(geometry.attributes[name]?.count === count, key + '/' + part + ': source material buffer lost (' + name + ')');
      t.assert(geometry.index.count % 3 === 0 && geometry.index.array.every(index => index < count), key + '/' + part + ': invalid triangles');
      t.assert(geometry.attributes.position.array.every(Number.isFinite) && geometry.attributes.avSourceUv.array.every(Number.isFinite), key + '/' + part + ': nonfinite source data');
      if (geometry.attributes.avSourceUv.array.some(value => value < 0 || value > 1)) tiled++;
      const rect = geometry.attributes.avAtlasRect;
      t.assert(rect.getZ(0) > 0 && rect.getW(0) > 0 && rect.getX(0) >= 0 && rect.getY(0) >= 0 &&
        rect.getX(0) + rect.getZ(0) <= 1.00002 && rect.getY(0) + rect.getW(0) <= 1.00002,
        key + '/' + part + ': invalid texture rectangle');
      totalParts++;
    }
  }
  t.assert(tiled > 0, 'authored repeated source UVs were clamped away');

  const albedo = api.approvedVehicleTexture(), orm = api.approvedVehicleTexture(true), initial = pending.splice(0);
  let disposals = 0;
  for (const texture of [albedo, orm]) texture.addEventListener('dispose', () => disposals++);
  scope.activeTier.lodBias = 1.35; api.approvedVehicleTextureQuality();
  const low = pending.splice(0); low.forEach(image => image.onload()); initial.forEach(image => image.onload());
  t.assert(albedo.image.width === 2048 && orm.image.width === 2048 && uploads.length === 2, 'stale high-quality image overrides the selected low tier');
  t.assert(disposals === 0, 'stale image completion disposes the current texture storage');
  scope.activeTier.lodBias = 1.1; api.approvedVehicleTextureQuality();
  t.assert(!pending.length, 'Low to Medium reloads identical textures');
  scope.activeTier.lodBias = .85; api.approvedVehicleTextureQuality(); pending.splice(0).forEach(image => image.onload());
  t.assert(api.approvedVehicleTexture() === albedo && api.approvedVehicleTexture(true) === orm && albedo.image.width === 4096 && orm.image.width === 4096,
    'quality changes allocate duplicate texture objects or retain low images');
  t.assert(disposals === 2, 'changing atlas dimensions reuses immutable old GPU storage');
  scope.activeTier.lodBias = 1.35; api.approvedVehicleTextureQuality(); pending.splice(0).forEach(image => image.onload());
  t.assert(disposals === 4 && albedo.image.width === 2048 && orm.image.width === 2048, 'high-to-low leaves high-resolution GPU allocation alive');

  const near = {}, far = {}, mesh = { geometry: near }, car = { x: 1000, y: 0, hp: 100, maxhp: 100, damageVersion: 0 },
    model = { damageVersion: 0, approvedLodParts: [{ mesh, near, far }], approvedInterior: { visible: true } };
  api.approvedVehicleLod(car, model);
  t.assert(mesh.geometry === far && !model.approvedInterior.visible, 'distant pristine SUV retains expensive close parts/interior');
  car.damageVersion++; api.approvedVehicleLod(car, model);
  t.assert(mesh.geometry === near && model.approvedInterior.visible, 'new damage is applied to reduced geometry');
  model.damageVersion = car.damageVersion; api.approvedVehicleLod(car, model);
  t.assert(mesh.geometry === far, 'repaired SUV permanently loses its distant LOD because its version is nonzero');
  scope.player.car = car; api.approvedVehicleLod(car, model);
  t.assert(mesh.geometry === near, 'player vehicle loses close geometry');

  // The frame commits instance counts to meshes, then resets the staging counter.
  // The read-only report must describe those rendered instances after the commit.
  const pooledMesh = { count: 3, geometry: { index: { count: 6 } } }, pool = { count: 0, parts: [{ mesh: pooledMesh }] };
  scope.carModels.set(car, { ...model, approvedAsset: 's1_jimny', group: { visible: false } });
  scope.bodyPools.set('s1_jimny', pool);
  const renderedPool = api.approvedVehicleReport().models[0].pool;
  t.assert(renderedPool.ready && renderedPool.instances === 3 && renderedPool.triangles === 2,
    'approved asset report reads reset staging counts instead of rendered pool instances');
  t.assert(pool.count === 0 && pooledMesh.count === 3, 'read-only asset report changes the pool state');

  const specs = vm.runInNewContext(source('game-vehicles') + '\n({vehicleSpec, VEHICLE_DEFINITIONS})',
    { UNITS_PER_METRE: 8, KMH: 8 / 3.6, KNOTS: 8 * .514444, GRAVITY: 9.81 * 8,
      PAINT_SPORT: [], PAINT_EVERYDAY: [], PAINT_LUXURY: [], Math });
  for (let id = 0; id < 3; id++) {
    const vehicle = { type: 'suv', id }, actual = specs.vehicleSpec(vehicle), dimensions = api.approvedVehicleModel(keys[id + 2]).dims;
    t.assert(Math.abs(actual.l / 8 - dimensions[0]) < .001 && Math.abs(actual.height / 8 - dimensions[1]) < .001 && Math.abs(actual.w / 8 - dimensions[2]) < .001,
      keys[id + 2] + ': invisible collision envelope does not follow source body');
    t.assert(specs.vehicleSpec({ type: 'suv', id: id + 3 }) === actual, 'SUV spec allocated per spawn or lookup');
    t.assert(actual.power === specs.VEHICLE_DEFINITIONS.suv.power && actual.mass === specs.VEHICLE_DEFINITIONS.suv.mass, 'asset conversion silently changes drivetrain');
  }
  t.assert(specs.vehicleSpec({ type: 'suv', id: 0, lawUnit: 'fed' }) === specs.VEHICLE_DEFINITIONS.suv, 'civilian envelope changes law gameplay');
  t.assert(specs.vehicleSpec({ type: 'suv' }) === specs.VEHICLE_DEFINITIONS.suv && specs.vehicleSpec({ type: 'suv', id: NaN }) === specs.VEHICLE_DEFINITIONS.suv,
    'type-only spawn planning underestimates the largest available SUV');
  for (const [name, expected] of Object.entries({ 'vehicle-models.bin': '63908560d08068f6b6df9859b9bb6040ad38028c2a0d9a0268f7d9cd4c2649ae',
    'vehicle-atlas.webp': '1dbbb7ea292956c3280e52c0d8121dc47d009bfe043717d1d2c55d90c87865f2' }))
    t.assert(crypto.createHash('sha256').update(bytes(name)).digest('hex') === expected, 'unapproved legacy assets rewritten: ' + name);
  t.note(JSON.stringify({ models: keys, parts: totalParts, repeatUVParts: tiled, textureUploads: uploads.length,
    legacyAssets: 'byte-identical', sourceBodyEnvelopes: 'matched', gpuCompile: 'requires rendered checks' }));
}
