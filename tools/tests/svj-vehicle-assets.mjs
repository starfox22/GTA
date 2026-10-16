// Actual licensed svj geometry/builders: isolated wheel pivots, immutable sharing, LOD and livery UVs.
// The host uses the real production head geometry/fit; WebGL and attachment appearance are reviewed separately.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

export default async function(t) {
  // Read the production svj dimensions: a narrower copied fixture changes native-scale seat fitting.
  const specSource = fs.readFileSync(new URL('../../src/game-vehicles.js', import.meta.url), 'utf8'),
    specBlock = specSource.match(/\bbrutini:\s*\{([\s\S]*?)\n\s*\},/)[1],
    svjSpec = vm.runInNewContext('({' + ['l', 'w'].map(key => key + ':' + specBlock.match(new RegExp('^\\s*' + key + ':\\s*([^,]+),', 'm'))[1]).join(',') + '})', { UNITS_PER_METRE: 8 });
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    bytes = fs.readFileSync(new URL('../../assets/svj-vehicle-models.bin', import.meta.url)),
    length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length)),
    base = 12 + length, types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array }, arrays = {};
  for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(base + offset, base + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  for (const model of Object.values(header.models)) { model.approved = true; model.assetPack = 'svj'; }
  const legacyBytes = fs.readFileSync(new URL('../../assets/vehicle-models.bin', import.meta.url)),
    legacyLength = legacyBytes.readUInt32LE(8), legacyHeader = JSON.parse(legacyBytes.subarray(12, 12 + legacyLength)), legacyArrays = {};
  for (const [name, [type, offset, count]] of Object.entries(legacyHeader.arrays)) {
    const raw = legacyBytes.subarray(12 + legacyLength + offset, 12 + legacyLength + offset + count * types[type].BYTES_PER_ELEMENT);
    legacyArrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  const sportsBytes = fs.readFileSync(process.env.GTA_SPORTS_PACK || new URL('../../assets/sports-vehicle-models.bin', import.meta.url)),
    sportsLength = sportsBytes.readUInt32LE(8), sportsHeader = JSON.parse(sportsBytes.subarray(12, 12 + sportsLength)), sportsArrays = {};
  for (const [name, [type, offset, count]] of Object.entries(sportsHeader.arrays)) {
    const raw = sportsBytes.subarray(12 + sportsLength + offset, 12 + sportsLength + offset + count * types[type].BYTES_PER_ELEMENT);
    sportsArrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  for (const model of Object.values(sportsHeader.models)) { model.approved = true; model.assetPack = 'sports'; }
  const glass = new Three.MeshStandardMaterial(), trim = new Three.MeshStandardMaterial(),
    materials = { trim, rubber: trim, rim: trim, glass, glassFar: glass },
    lamps = Object.fromEntries(['headOff', 'tailOff', 'headOn', 'tailOn', 'brake'].map(name => [name, new Three.MeshStandardMaterial()])),
    player = { car: null, x:0, y:0 }, scope = vm.createContext({ Three, fixture: { header, arrays }, fixtureLegacy: { header: legacyHeader, arrays: legacyArrays }, fixtureSports: { header: sportsHeader, arrays: sportsArrays }, materials, lamps, civLampMaterials: lamps, queueCarOccupants() {}, player, keys: {}, carTransition: {}, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Float32Array, DataView, TextDecoder, atob: x => Buffer.from(x, 'base64').toString('binary'),
      UNITS_PER_METRE: 8, PERSON_HEIGHT: 14, renderer: { capabilities: { getMaxAnisotropy: () => 4 } }, activeTier: { lodBias: 1 }, CAR_M: 8, TAU: Math.PI * 2, performance, gameTime: 10, vehicleGlassBand: () => null, CAR_SWATCH: { paint: 0, black: 2 }, CITY_SIZE: 4096,
      crackedGlassTexture: new Three.Texture(), fixtureTexture: new Three.Texture(), cityMaterialPatch() {}, approvedVehicleAtlasPatch() {}, carGlassMaterial: () => glass, bodyPools: new Map(), carModels: new Map(), BODY_POOL_CAPACITY: 160, bodyPaint: trim, impostorBeaconMaterial: trim, impostorColor: new Three.Color(), boxGeo: new Three.BoxGeometry(), scene: new Three.Scene(), sharedGeometries: new Set(), sharedMaterials: new Set(),
      clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)), lerpNumber: (a, b, t) => a + (b - a) * t,
      vehicleSpec: c => c.type === 'brutini' ? svjSpec : c.type === 'police' ? { l: 5.1 * 8, w: 2.18 * 8 } : c.policeLook ? { l: 4.95 * 8, w: 2.24 * 8 } : c.type === 'chevette' ? { l: 4.69 * 8, w: 2.32 * 8 } : c.type !== 'suv' ? { l: 4.7 * 8, w: 1.9 * 8 } : { l: header.models[['s1_jimny', 's2_suv', 's3_offroad'][(c.id >>> 0) % 3]].dims[0] * 8, w: header.models[['s1_jimny', 's2_suv', 's3_offroad'][(c.id >>> 0) % 3]].dims[2] * 8 }, drivenAxle: () => 'rear', spawnPanel() {},
      civDrawRange(geometry, count) { const far = geometry.clone(); far.setDrawRange(0, count); return far; },
      civSharedMaterials: () => materials, civLampSet: () => lamps, civFinish: () => ({ roughness: .3, metalness: .06 }),
      civImpostorPaint: () => trim, policeCabinGlass: () => glass, policeImpostorPaint: () => trim,
      policeLightMaterial: () => { const material = new Three.MeshBasicMaterial(); material.uniforms = { levels: { value: new Float32Array(8) } }; return material; },
      policeDecalGeometry: () => new Three.BoxGeometry(.01, .01, .01), policeGlyphs: () => ({ material: trim }),
      warmLamp: lamps.headOn, tailLamp: lamps.tailOff,
      box(parent, x, y, z, sx, sy, sz, material) { const object = new Three.Mesh(new Three.BoxGeometry(), material); object.position.set(x, y, z); object.scale.set(sx, sy, sz); parent.add(object); return object; },
      mesh(geometry, material, parent, x = 0, y = 0, z = 0) { const object = new Three.Mesh(geometry, material); object.position.set(x, y, z); parent.add(object); return object; },
      halo(parent, x, y, z) { const object = new Three.Group(); object.position.set(x, y, z); parent.add(object); return object; },
    });
  const materialSource = read('cars3d-materials'), materialHeader = materialSource.slice(0, materialSource.indexOf('      let civTrimAtlasTexture')),
    dirtSource = materialSource.slice(materialSource.indexOf('      const CIV_NO_DIRT'), materialSource.indexOf('      function civLiveryPatch')),
    finishPatch = materialSource.slice(materialSource.indexOf('      function trimCellRect('), materialSource.indexOf('      let civMaterials')),
    legacyPaint = materialSource.slice(materialSource.indexOf('      function civLiveryPatch('), materialSource.indexOf('      // The pooled impostor paint')),
    markSource = read('damage3d-marks'), sourceMarkHook = markSource.slice(markSource.indexOf('      function markOntoDoor('), markSource.indexOf('      // The normal at an anchor:'));
  const flightSource = read('flight-view3d'), poolSource = flightSource.slice(flightSource.indexOf('      function bodyPoolFor('), flightSource.indexOf('      function bodyImpostor('));
  const approvedSource = read('approved-vehicle-assets3d'), approvedPatch = approvedSource.slice(approvedSource.indexOf('      function approvedVehicleMaterialPatch('), approvedSource.indexOf('      let approvedVehicleMaterialSet;')),
    approvedMaterials = approvedSource.slice(approvedSource.indexOf('      let approvedVehicleMaterialSet;'), approvedSource.indexOf('      function approvedVehiclePaint(')),
    approvedPaint = approvedSource.slice(approvedSource.indexOf('      function approvedVehiclePaint('), approvedSource.indexOf('      const approvedVehicleImpostorPaints')),
    occupantSource = read('crowd3d-driveby'), occupantDeclarations = occupantSource.slice(occupantSource.indexOf('      const OCCUPANT_REACH'), occupantSource.indexOf('      let occupantCount')),
    actualSeatOccupant = occupantSource.slice(occupantSource.indexOf('      function seatOccupant('));
  const damageSource = read('damage-vehicles'), glassBands = damageSource.slice(damageSource.indexOf('    const CAR_GLASS_BANDS'), damageSource.indexOf('    // Where the glass is'));
  const lod = approvedSource.slice(approvedSource.indexOf('      function approvedVehicleLod('), approvedSource.indexOf('      function approvedVehicleReport('));
  const api = vm.runInContext(lod + glassBands + materialHeader + finishPatch + dirtSource + legacyPaint + approvedPatch + approvedMaterials + approvedPaint + read('sports-vehicle-assets3d') + read('svj-vehicle-assets3d') + read('cars3d-geometry') + read('character-rig3d') + read('character-near3d') + read('character-near3d-head') + read('driveby-seats') + read('vehicle-assets3d') + read('approved-suv3d') + read('cars3d-models').slice(read('cars3d-models').indexOf('      function animateCivilianCar(')) +
    read('police3d-looks') + read('police3d-cabins') + read('cars3d-interior') + read('cars3d-headroom') + read('police3d-asset') + read('damage-crumple') + read('damage3d-crumple') + read('vehicle-doors3d') + read('vehicle-char3d') + read('damage3d-bodies') + read('carjack3d') + sourceMarkHook + poolSource + occupantDeclarations + actualSeatOccupant + `
      const BODY_CLOSE = { head: { mesh: { geometry: rigHeadGeometry() } } };
      for (const [name, geometry] of Object.entries({ ...rigHairGeometries(), ...rigHatGeometries() })) BODY_CLOSE[name] = { mesh: { geometry } };
      const BODY_NEAR = { head: { mesh: { geometry: nearHeadGeometry() } } };
      function approvedVehicleData() { return fixture; }
      function approvedVehicleModel(key) { return fixture.header.models[key] || null; }
      function vaData() { return fixtureLegacy; }
      function svjVehicleData() { return fixture; }
      function svjVehicleTexture() { return fixtureTexture; }
      function sportsVehicleData() { return fixtureSports; }
      function sportsVehicleTexture() { return fixtureTexture; }
      vaAtlas = () => fixtureTexture;
      vaLivery = () => fixtureTexture;
      civSharedMaterials = () => materials;
      function approvedVehicleTexture() { return fixtureTexture; }
      function approvedVehicleImpostorPaint() { return materials.trim; }
      policeLiveryTexture = () => new Three.Texture();
      policeGlyphs = () => ({ material: materials.trim });
      policeDecalGeometry = () => new Three.BoxGeometry(.01, .01, .01);
      let fixturePose = null;
      const chaseViewActive = false, specScratch = {};
      function occupantLooksFor() { return { proxies: [{}, {}], looks: [{}, {}] }; }
      function resetSpec() { return {}; }
      function compiledLook() { return { height: 1 }; }
      function stateFor() { return {}; }
      function drawCrowdPerson(proxy, state, dt, detail, sp) {
        fixturePose = { hip: new Three.Vector3(0, RIG.hip * RIG_UNIT, 0).applyMatrix4(sp.rootOverride).toArray(),
          lean: sp.riderLean, hands: sp.handTargets.map(v => v.toArray()), feet: sp.legTargets.map(v => v.toArray()) };
      }
      ({ makeAssetCar, makeAssetPoliceVehicle, approvedSuvKey, approvedSuvGlassBand, vaGeometry, policeApprovedPanels, animateApprovedSuvWheels, vehicleAssetModel, bodyPoolFor, vehicleDoor, vehicleDoorsReport, doorPanelGeometries, carBodyDamage, swingDriverDoor, markOntoDoor, crumpleSlices, crumplePending: () => crumpleQueue.size, assetCharSwap, assetCharRelease, seatOccupant, fixtureOccupantPose: () => fixturePose, carSeatPlan, cabinClearance, cabinSeatClouds, DRIVEBY_SEATS, CAR_GLASS_BANDS, vehicleDoorPartition, vehicleDoorPose, vehicleDoorShown, vehicleDoorBodyState, animateCivilianCar, svjVehicleModel, svjVehicleReport, approvedVehicleLod, svjVehicleMaterials })`, scope);

  const model = api.svjVehicleModel();
  t.assert(model?.type === 'svj_sdc' && model.sourceTriangles === 508324 && model.triangles === 508324, 'all source triangles retained in the actual SVJ model');
  t.assert(api.vehicleAssetModel('brutini') === model && model.farTriangles === 20133, 'production selection and independent shared far budget');
  const c = { type:'brutini', color:'#7ac231', id:908, hp:100, maxhp:100, speed:0, av:0, x:1000, y:1000, damageVersion:0, dents:[] }, built = api.makeAssetCar(c), other = api.makeAssetCar({...c,id:909});
  built.damageVersion = 0;
  t.assert(built.approvedAsset === 'svj_sdc' && built.kit === other.kit && built.paint !== other.paint, 'actual BRUTINI builder selects shared source geometry and independent paint');
  t.assert(built.kit.asset.hasInterior === false && built.approvedInterior?.geometry.index.count > 0 && built.seats.two, 'source has no native cabin; actual fitted two-seat game cabin is added');
  t.assert(built.wheels.length === 4 && built.wheels.every(w => w.wheel.children[0].geometry === other.wheels[built.wheels.indexOf(w)].wheel.children[0].geometry), 'four independent animated wheels share immutable source meshes');
  const sourceCount = () => { let n=0; built.body.traverse(o => { if(o.isMesh && o.visible && o !== built.approvedInterior) n += Math.min(o.geometry.index?.count || 0, o.geometry.drawRange.count)/3; }); return n; };
  t.assert(sourceCount() === model.triangles, 'actual closed production draw owns every near source face once');
  const seat = built.seats, canopy = built.kit.glass, width = seat.glass.w,
    clearance = api.cabinClearance(canopy,built.kit.l,width,seat.M,api.cabinSeatClouds(),seat.x,seat.y,-seat.z,seat.lean);
  t.assert(clearance / seat.M >= .019, 'actual tallest rig heads clear source roof and canopy: '+clearance/seat.M);
  const fit = [seat.x/seat.M,seat.y/seat.M,-seat.z/seat.M,seat.lean,canopy.base/seat.M];
  t.note?.('SVJ fitted DRIVEBY_SEATS '+JSON.stringify(fit));
  const recorded = api.DRIVEBY_SEATS.brutini;
  t.assert(fit.every((v,i)=>Math.abs(v-recorded[i])<.002), 'gameplay drive-by seat matches the real fitted production cabin');
  const band=api.CAR_GLASS_BANDS.brutini;
  t.assert(Math.abs(band[0]-model.glass.base)<.002&&Math.abs(band[1]-(model.glass.roof+model.glass.crown))<.002, 'glass gun-hit bands match actual source canopy');
  for(const [name,part] of Object.entries(model.parts)) {
    const geo=api.vaGeometry(model,{header,arrays},name,8,null,true);
    t.assert(geo.index.count===part.triangles*3&&geo.attributes.position.count===part.vertices, name+': complete part decode');
    t.assert(geo.attributes.normal.array.every(Number.isFinite)&&geo.attributes.avSourceUv.count===part.vertices&&geo.attributes.finish.count===part.vertices, name+': full normals, source UV and finish');
    t.assert(arrays[model.type+'.'+name+'.n'].BYTES_PER_ELEMENT===2, name+': source split normals use signed16 precision');
  }
  c.speed=24;c.av=.5;api.animateCivilianCar(c,built,.1,true,1,false);built.body.updateMatrixWorld(true);
  for(const w of built.wheels) {
    t.assert(Math.abs(w.wheel.rotation.z)>0, 'source tyre/rim rolls at its real radius');
    t.assert(w.front?Math.abs(w.wheel.rotation.y)>0:w.wheel.rotation.y===0, 'only front source wheels steer');
    if(w.caliper) t.assert(Math.abs(w.caliper.rotation.z+w.wheel.rotation.z)<1e-10, 'source caliper cancels wheel roll');
  }
  api.approvedVehicleLod(c,built);
  t.assert(built.approvedLodFar&&sourceCount()===model.farTriangles, 'complete actual far draw replaces wheels, body, lamps and glazing');
  c.hp=99;api.approvedVehicleLod(c,built);
  t.assert(!built.approvedLodFar&&sourceCount()===model.triangles, 'damage restores near source ownership');
  c.hp=100;c.speed=0;
  const originals=[built.shell,built.panels,built.cabin,built.assetTrim].map(m=>[m,m.geometry]);
  for(const side of [-1,1]) {
    const door=api.vehicleDoor(c,built,side), center=new Three.Vector3();
    t.assert(door.native&&door.sourceExtracted&&door.layers.length===3, 'door'+side+': exact source paint/trim/window layers');
    const part=door.layers.find(m=>m.userData.vehicleDoorSource===built.panels), points=part.geometry.attributes.position;
    const vertices=[...new Set(part.geometry.index.array)];
    for(const i of vertices)center.add(new Three.Vector3().fromBufferAttribute(points,i));center.multiplyScalar(1/vertices.length);
    built.group.updateMatrixWorld(true);
    const closed=center.clone().applyMatrix4(part.matrixWorld);
    api.vehicleDoorPose(door,side,1.05);built.group.updateMatrixWorld(true);
    const raised=center.clone().applyMatrix4(part.matrixWorld);
    t.assert(raised.y>closed.y+3&&raised.z*side>closed.z*side, 'door'+side+': measured scissor hinge lifts up and slightly outwards');
    api.vehicleDoorBodyState(c,built,side<0?1:2);api.vehicleDoorShown(door,true,true);
    t.assert(sourceCount()===model.triangles, 'door'+side+': opening retains every source triangle once');
    api.vehicleDoorShown(door,false,false);api.vehicleDoorBodyState(c,built,0);
  }
  t.assert(originals.every(([m,g])=>m.geometry===g), 'closing both doors restores immutable pristine source geometry');
  const clean=built.assetTrim.material;api.assetCharSwap(c,built,true);
  t.assert(built.assetChar&&built.assetTrim.material!==clean&&built.assetTrim.material.map===clean.map, 'char retains actual source atlas');
  api.assetCharRelease(built);
  t.assert(built.assetTrim.material===clean, 'repair restores exact source PBR material');
  t.note?.('SVJ real source builder, headroom, wheel/door, far LOD and char/repair contracts passed');
}
