// Actual Monarch source kits through production builders: conservation, wheel/door rigs, LOD and lifecycle.
// The host uses the real production head geometry/fit; WebGL and attachment appearance are reviewed separately.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

function decodePack(path) {
  const bytes = fs.readFileSync(path), length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length)), arrays = {},
    types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array };
  for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(12 + length + offset, 12 + length + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  for (const model of Object.values(header.models)) { model.approved = true; model.assetPack = 'svj'; }
  return { header, arrays };
}

export function monarchFixture(packPath = process.env.GTA_MONARCH_PACK) {
  const sizes = {}, definitionSources = ['game-vehicles','hypercars'].map(name => fs.readFileSync(new URL('../../src/'+name+'.js', import.meta.url),'utf8')).join('\n');
  for (const type of ['valkyrie','dbs','zr1x','chevetteSE','wayron','tourbillon','jasko','sirocco','novera','w1','lafera','brutini','chevette']) {
    const block = definitionSources.match(new RegExp('\\b'+type+':\\s*\\{([\\s\\S]*?)\\n\\s*\\},'))?.[1];
    if (!block) throw Error('Missing production dimensions '+type);
    sizes[type] = vm.runInNewContext('({' + ['l','w'].map(key => key+':'+block.match(new RegExp('^\\s*'+key+':\\s*([^,]+),','m'))[1]).join(',')+'})', {UNITS_PER_METRE:8,HC_M:8});
  }
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    bytes = fs.readFileSync(packPath || new URL('../../assets/monarch-vehicle-models.bin', import.meta.url)),
    length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length)),
    base = 12 + length, types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array }, arrays = {};
  for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(base + offset, base + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  for (const model of Object.values(header.models)) { model.approved = true; model.assetPack = 'monarch'; }
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
  const fixtureSvj = decodePack(new URL('../../assets/svj-vehicle-models.bin', import.meta.url)),
    ASSETS = { monarchVehicleModels: 'data:application/octet-stream;base64,' + bytes.toString('base64') };
  const glass = new Three.MeshStandardMaterial(), trim = new Three.MeshStandardMaterial(),
    materials = { trim, rubber: trim, rim: trim, glass, glassFar: glass },
    lamps = Object.fromEntries(['headOff', 'tailOff', 'headOn', 'tailOn', 'brake'].map(name => [name, new Three.MeshStandardMaterial()])),
    player = { car: null, x:0, y:0 }, scope = vm.createContext({ Three, sizes, ASSETS, fixtureSvj, fixture: { header, arrays }, fixtureLegacy: { header: legacyHeader, arrays: legacyArrays }, fixtureSports: { header: sportsHeader, arrays: sportsArrays }, materials, lamps, civLampMaterials: lamps, queueCarOccupants() {}, player, keys: {}, carTransition: {}, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Float32Array, DataView, TextDecoder, atob: x => Buffer.from(x, 'base64').toString('binary'),
      UNITS_PER_METRE: 8, PERSON_HEIGHT: 14, renderer: { capabilities: { getMaxAnisotropy: () => 4 } }, activeTier: { lodBias: 1 }, CAR_M: 8, TAU: Math.PI * 2, performance, gameTime: 10, vehicleGlassBand: () => null, CAR_SWATCH: { paint: 0, black: 2 }, CITY_SIZE: 4096,
      sootTexture: new Three.Texture(), crackedGlassTexture: new Three.Texture(), fixtureTexture: new Three.Texture(), cityMaterialPatch() {}, approvedVehicleAtlasPatch() {}, carGlassMaterial: () => glass, bodyPools: new Map(), carModels: new Map(), BODY_POOL_CAPACITY: 160, bodyPaint: trim, impostorBeaconMaterial: trim, impostorColor: new Three.Color(), boxGeo: new Three.BoxGeometry(), scene: new Three.Scene(), sharedGeometries: new Set(), sharedMaterials: new Set(),
      clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)), lerpNumber: (a, b, t) => a + (b - a) * t,
      vehicleSpec: c => sizes[c.type] || {l:4.7*8,w:2.3*8}, drivenAxle: () => 'rear', spawnPanel() {},
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
  const api = vm.runInContext(lod + glassBands + materialHeader + finishPatch + dirtSource + legacyPaint + approvedPatch + approvedMaterials + approvedPaint + read('sports-vehicle-assets3d') + read('svj-vehicle-assets3d') + read('military-mark-rays3d') + read('monarch-vehicle-assets3d') + read('cars3d-geometry') + read('character-rig3d') + read('character-near3d') + read('character-near3d-head') + read('driveby-seats') + read('vehicle-assets3d') + read('approved-suv3d') + read('cars3d-models').slice(read('cars3d-models').indexOf('      function animateCivilianCar(')) +
    read('police3d-looks') + read('police3d-cabins') + read('cars3d-interior') + read('cars3d-headroom') + read('police3d-asset') + read('damage-crumple') + read('damage3d-crumple') + read('vehicle-doors3d') + read('vehicle-char3d') + read('damage3d-bodies') + read('carjack3d') + sourceMarkHook + poolSource + occupantDeclarations + actualSeatOccupant + `
      const BODY_CLOSE = { head: { mesh: { geometry: rigHeadGeometry() } } };
      for (const [name, geometry] of Object.entries({ ...rigHairGeometries(), ...rigHatGeometries() })) BODY_CLOSE[name] = { mesh: { geometry } };
      const BODY_NEAR = { head: { mesh: { geometry: nearHeadGeometry() } } };
      function approvedVehicleData() { return fixture; }
      function approvedVehicleModel(key) { return fixture.header.models[key] || null; }
      function vaData() { return fixtureLegacy; }
      function svjVehicleData() { return fixtureSvj; }
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
      ({ cabinHeadCloud, cabinHeadPose, CABIN_HEAD_TYPES, militaryMarkRayMesh, monarchVehicleData, monarchVehicleModel, monarchVehicleReport, monarchVehicleMaterials, monarchVehiclePaint, monarchVehicleLamps, makeAssetCar, makeAssetPoliceVehicle, approvedSuvKey, approvedSuvGlassBand, vaGeometry, policeApprovedPanels, animateApprovedSuvWheels, vehicleAssetModel, bodyPoolFor, vehicleDoor, vehicleDoorsReport, doorPanelGeometries, carBodyDamage, swingDriverDoor, markOntoDoor, crumpleSlices, crumplePending: () => crumpleQueue.size, assetCharSwap, assetCharRelease, paintVehicle, seatOccupant, fixtureOccupantPose: () => fixturePose, carSeatPlan, cabinClearance, cabinSeatClouds, DRIVEBY_SEATS, CAR_GLASS_BANDS, vehicleDoorPartition, vehicleDoorPose, vehicleDoorShown, vehicleDoorBodyState, animateCivilianCar, svjVehicleModel, svjVehicleReport, approvedVehicleLod, svjVehicleMaterials })`, scope);

  return { api, Three, scope, source: api.monarchVehicleData(), sizes };
}

export function sourceHeadFit(api, Three, built) {
  const seat=built.seats, model=built.kit.asset;
  built.group.updateMatrixWorld(true);
  const queries=[built.shell,built.panels,built.cabin,built.assetTrim,built.hood].filter(m=>m?.geometry.index?.count).map(m=>{
    const q=new Three.Mesh(m.geometry,new Three.MeshBasicMaterial({side:Three.DoubleSide}));
    q.matrixWorld.copy(m.matrixWorld); q.matrixAutoUpdate=false; api.militaryMarkRayMesh(q); return q;
  });
  const ray=new Three.Raycaster(), direction=new Three.Vector3(0,-1,0);
  let clearance=Infinity,probes=0,missed=0;
  for(const seatSide of [-1,1]) for(const head of api.CABIN_HEAD_TYPES) {
    const cloud=api.cabinHeadCloud(['head',...head.parts],head.headScale,head.height,true), points=new Float32Array(cloud.pts.length);
    api.cabinHeadPose(cloud,seat.lean,seat.M,points);
    for(let i=0;i<points.length;i+=3) {
      const x=seat.x+points[i], y=seat.y+points[i+1], z=seatSide*Math.abs(seat.z)+points[i+2];
      ray.set(new Three.Vector3(x,model.dims[1]*built.kit.k+2*seat.M,z),direction); ray.far=4*seat.M;
      const hits=ray.intersectObjects(queries,false);
      if(!hits.length) { missed++; continue; }
      clearance=Math.min(clearance,(hits[0].point.y-y)/seat.M); probes++;
    }
  }
  for(const q of queries)q.material.dispose();
  return {clearance,probes,missed,seat:{x:seat.x/seat.M,y:seat.y/seat.M,z:seat.z/seat.M,lean:seat.lean}};
}

export default async function(t) {
  const {api, Three, source, scope}=monarchFixture(),
    expected={valkyrie:'monarch_valkyrie',dbs:'monarch_db11',zr1x:'monarch_c8_hari',chevetteSE:'monarch_c8_hari',wayron:'monarch_wayron',tourbillon:'monarch_tourbillon',jasko:'monarch_ccx',sirocco:'monarch_huayra',novera:'monarch_roadster_ev',w1:'monarch_p1_gtr',lafera:'monarch_laferrari'},
    smoke=process.env.GTA_MONARCH_SMOKE==='1';
  t.assert(source&&Object.keys(source.header.models).length===(smoke?1:10),'production decoder loads every licensed source kit');
  if(!smoke) {
    t.assert(Object.keys(source.byGameType).length===11,'all eleven collection game types have exactly one source mapping');
    for(const [type,key]of Object.entries(expected))t.assert(api.monarchVehicleModel(type)?.type===key&&api.vehicleAssetModel(type)?.type===key,type+': production dispatch uses the intended source identity');
    t.assert(api.vehicleAssetModel('brutini')?.type==='svj_sdc'&&api.vehicleAssetModel('chevette')?.type==='c8_hari','existing Brutini/SVJ and ordinary Chevette/C8 assets stay independent');
  }
  const hash=()=>{const h=crypto.createHash('sha256');for(const key of Object.keys(source.arrays).sort()){h.update(key);const a=source.arrays[key];h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}return h.digest('hex');}, pristineHash=hash(), reports=[];
  const car=(type,id)=>({type,color:'#7ac231',id,hp:100,maxhp:100,speed:0,av:0,x:1000,y:1000,a:0,damageVersion:0,dents:[]});
  const count=m=>{let n=0;m.body.traverse(o=>{if(o.isMesh&&o.visible&&o!==m.approvedInterior)n+=Math.min(o.geometry.index?.count||0,o.geometry.drawRange.count)/3;});return n;};
  for(const [modelIndex,model]of Object.values(source.header.models).entries()) {
    t.assert(model.type==='monarch_ccx'?model.glass.open===true:!model.glass.open,model.type+': source open/closed cockpit identity');
    const type=model.gameTypes[0], c=car(type,1908+modelIndex), built=api.makeAssetCar(c), other=api.makeAssetCar(car(type,2908+modelIndex)), label=type+': ';
    built.damageVersion=0;
    t.assert(built.kit.asset===model&&built.approvedAsset===model.type,label+'actual full production builder selects licensed kit');
    t.assert(built.shell.geometry===other.shell.geometry&&built.paint!==other.paint&&built.paint.color.equals(other.paint.color),label+'shared immutable body geometry and private paint');
    t.assert(built.assetTrim.material===other.assetTrim.material&&built.paint.map===other.paint.map,label+'source texture and trim families shared');
    api.paintVehicle(c,built);
    t.assert(built.paint.roughness===1&&built.paint.metalness===1&&built.paint.clearcoat===.7&&built.paint.clearcoatRoughness===.16,label+'clean source paint keeps authored ORM and source coat');
    c.hp=60;api.paintVehicle(c,built);
    t.assert(built.paint.roughness===1&&Math.abs(built.paint.metalness-.76)<1e-9&&built.paint.clearcoat<.7,label+'wear dulls source paint without multiplying away authored roughness');
    c.hp=100;api.paintVehicle(c,built);
    t.assert(built.paint.roughness===1&&built.paint.metalness===1&&built.paint.clearcoat===.7,label+'repair restores original source paint finish');
    t.assert(count(built)===model.triangles&&model.triangles===model.sourceTriangles,label+'near draw conserves every original source face exactly once');
    const modelWheels=model.wheels;
    t.assert(built.wheels.length===4&&modelWheels.filter(w=>w.front).length===2&&new Set(modelWheels.map(w=>[w.front,w.side].join())).size===4,label+'four explicit, distinct source wheel assemblies');
    let hubError=0, radiusError=0;
    for(let i=0;i<4;i++){
      const w=built.wheels[i], own=modelWheels[i];
      hubError=Math.max(hubError,w.wheel.position.distanceTo(new Three.Vector3(own.x,own.y,own.z).multiplyScalar(built.kit.k)));
      radiusError=Math.max(radiusError,Math.abs(w.radius-own.r*built.kit.k));
      t.assert(w.wheel!==other.wheels[i].wheel&&w.wheel.children[0].geometry===other.wheels[i].wheel.children[0].geometry,label+'wheel '+i+' has private animation and shared source geometry');
    }
    t.assert(hubError<1e-8&&radiusError<1e-8&&modelWheels.every(w=>w.r>.2&&w.r<.65&&Math.abs(w.z)>.4),label+'actual measured hubs and tyre radii survive uniform game fit');
    const hubs=built.wheels.map(w=>w.wheel.position.clone());
    c.speed=24;c.av=.5;api.animateCivilianCar(c,built,.1,true,1,false);
    t.assert(built.wheels.every((w,i)=>Math.abs(w.wheel.rotation.z+2.4/w.radius)<1e-8&&w.wheel.position.distanceTo(hubs[i])<1e-10),label+'road-speed wheel roll uses real radius without hub drift');
    t.assert(built.wheels.every(w=>w.front?Math.abs(w.wheel.rotation.y)>0:w.wheel.rotation.y===0),label+'only front wheels steer');
    t.assert(built.wheels.every(w=>!w.caliper||Math.abs(w.caliper.rotation.z+w.wheel.rotation.z)<1e-9),label+'brake calipers stay stationary in the steered carrier');
    c.speed=-24;api.animateCivilianCar(c,built,.1,true,1,false);
    t.assert(built.wheels.every(w=>Math.abs(w.wheel.rotation.z)<1e-8),label+'reverse travel reverses the actual source wheel roll');
    api.approvedVehicleLod(c,built);
    t.assert(built.approvedLodFar&&count(built)===model.farTriangles&&model.farTriangles<model.triangles,label+'far draw replaces every source assembly without duplicates');
    for(const [role,mesh]of [['hood',built.hood],['panels',built.panels]])if(!model.roleParts[role]?.length)t.assert(mesh.geometry.index.count===0,label+'absent '+role+' stays absent at far LOD');
    c.hp=99;api.approvedVehicleLod(c,built);
    t.assert(!built.approvedLodFar&&count(built)===model.triangles,label+'damage restores all near source faces');
    for(const [role,mesh]of [['hood',built.hood],['panels',built.panels]])if(!model.roleParts[role]?.length)t.assert(mesh.geometry.index.count===0,label+'absent '+role+' stays absent at near LOD');
    c.hp=100;c.speed=0;
    const originals=[built.shell,built.panels,built.cabin,built.assetTrim].map(m=>[m,m.geometry]);
    for(const side of [-1,1])if(model.doors?.[side<0?'left':'right']) {
      const door=api.vehicleDoor(c,built,side);
      t.assert(door.native&&door.sourceExtracted&&door.layers.some(m=>m.geometry.index.count>0),label+'door '+side+' uses actual source triangles');
      built.group.updateMatrixWorld(true);
      const layer=door.layers.find(m=>m.geometry.index.count>0), box=new Three.Box3().setFromBufferAttribute(layer.geometry.attributes.position), centre=box.getCenter(new Three.Vector3()), closed=centre.clone().applyMatrix4(layer.matrixWorld);
      api.vehicleDoorPose(door,side,1.05);built.group.updateMatrixWorld(true);
      const opened=centre.clone().applyMatrix4(layer.matrixWorld);
      t.assert(opened.distanceTo(closed)>.04*built.seats.M,label+'native door moves about its source seam');
      api.vehicleDoorBodyState(c,built,side<0?1:2);api.vehicleDoorShown(door,true,true);
      t.assert(count(built)===model.triangles,label+'open source door owns every source face exactly once');
      t.assert(door.layers.every(m=>!m.geometry.index.count||m.geometry.attributes.avSourceUv&&m.geometry.attributes.avSurface?.itemSize===4),label+'moving door retains source UV, color/paint/side/alpha surface data');
      api.vehicleDoorShown(door,false,false);api.vehicleDoorBodyState(c,built,0);
    }
    t.assert(originals.every(([m,g])=>m.geometry===g),label+'closed doors restore immutable pristine source buffers');
    const clean=built.assetTrim.material, paint=built.paint;
    api.assetCharSwap(c,built,true);
    const charMaterials=[...built.assetChar.materials];
    t.assert(charMaterials.length>0&&built.assetTrim.material!==clean&&built.assetTrim.material.map===clean.map&&other.assetTrim.material===clean,label+'burnt source materials stay per vehicle and retain atlases');
    for(const material of charMaterials)if(material.userData.assetChar.kind==='monarch') {
      const own=material.userData.assetChar, shader={uniforms:{},vertexShader:Three.ShaderLib.standard.vertexShader,fragmentShader:Three.ShaderLib.standard.fragmentShader};
      material.onBeforeCompile(shader);
      t.assert(typeof own.sourceCompile==='function'&&shader.vertexShader.includes('avSurface')&&shader.fragmentShader.includes('vMonarch')&&shader.fragmentShader.includes('charBurnt'),label+'char keeps actual source shader and soot together');
    }
    api.assetCharRelease(built);
    t.assert(built.assetTrim.material===clean&&built.shell.material===paint&&charMaterials.every(m=>m.userData.assetChar.kind!=='monarch'||m.userData.assetChar.sourceCompile===null&&m.userData.assetChar.sourceProgramKey===null),label+'repair restores exact source materials and releases private shader closures');
    // Pose actual production occupants, then check their targets against the source wheel and floor.
    built.body.rotation.set(0,0,0); built.body.position.set(0,0,0); built.group.updateMatrixWorld(true);
    const plan=built.seats, record=api.DRIVEBY_SEATS[type], fitted=[plan.x/plan.M,plan.y/plan.M,-plan.z/plan.M,plan.lean,built.kit.glass.base/plan.M];
    t.assert(record&&fitted.every((v,i)=>Math.abs(v-record[i])<.000002),label+'gameplay drive-by seat matches exact rendered source fit');
    let maximumArmRatio=0;
    for(const steer of [-1,0,1]) {
      c.av=steer*2; api.seatOccupant(c,built,0,1/60,2);
      const pose=api.fixtureOccupantPose();
      t.assert(pose&&pose.feet.every(p=>Math.abs(p[0]-plan.pedalX)<1e-7&&Math.abs(p[1]-plan.pedalY)<1e-7),label+'seated feet use the measured pedal targets at steering '+steer);
      for(const height of [.914,1.086]) for(let side=0;side<2;side++) {
        const sign=side?1:-1, shoulder=new Three.Vector3(plan.x-Math.sin(plan.lean)*3.06*height,plan.y+(.95+Math.cos(plan.lean)*3.06)*height,plan.z+sign*1.5*height), hand=new Three.Vector3(...pose.hands[side]);
        maximumArmRatio=Math.max(maximumArmRatio,shoulder.distanceTo(hand)/((2.55+2.05)*height));
      }
    }
    t.assert(maximumArmRatio<=1,label+'full steering rim stays inside short/tall adult arm reach '+maximumArmRatio);
    const legReach=Math.hypot(plan.pedalX-plan.x,plan.pedalY-plan.y,.11*plan.M),shortLeg=(3.3+3.45)*.914;
    t.assert(legReach<shortLeg&&plan.pedalY>=.1*plan.M,label+'raised pedal pose stays inside adult leg reach and above the road');
    const cleanDamage={front:0,rear:0,left:0,right:0,burnt:false,parts:{hood:0,bumperFront:0,bumperRear:0,doorLeft:0,doorRight:0,trunk:0},glass:{front:0,rear:0,left:0,right:0,roof:0},tires:{},lights:{}};
    api.carBodyDamage(c,built,cleanDamage);
    api.carBodyDamage(c,built,{...cleanDamage,glass:{...cleanDamage.glass,front:2},tires:{frontLeft:1}});
    const damagedWheel=built.wheels.find(w=>w.front&&w.side===-1);
    t.assert(Array.isArray(built.cabin.material)&&built.cabin.material[1].visible===false&&damagedWheel.wheel.scale.y===.8,label+'actual source glazing breaks and source tyre deflates');
    api.carBodyDamage(c,built,cleanDamage);
    t.assert(built.cabin.material===built.glass&&damagedWheel.wheel.scale.y===1&&other.cabin.material===other.glass,label+'repair restores source glazing/tyre and preserves the other instance');
    c.damage={...cleanDamage,burnt:true,wreckedAt:8};api.paintVehicle(c,built);
    t.assert(built.charred&&built.assetChar&&other.assetTrim.material===clean,label+'actual burn path uses private source char materials');
    c.damage=cleanDamage;api.paintVehicle(c,built);
    t.assert(!built.charred&&!built.assetChar&&built.paint.map===other.paint.map&&built.paint.roughness===1&&built.paint.metalness===1,label+'actual repair path restores clean authored source PBR');
    // A near-vertical bulkhead or outer hood skin is not a floor. Test the downward-facing
    // lower floor where the original source supplies one, independently of the generated cabin.
    // Winding differs between sources; an upward ray may see either side of the floor sheet.
    built.group.updateMatrixWorld(true);
    const footRays=[built.shell,built.panels,built.cabin,built.assetTrim,built.hood].filter(m=>m?.geometry.index?.count).map(m=>{const q=new Three.Mesh(m.geometry,new Three.MeshBasicMaterial({side:Three.DoubleSide}));q.matrixWorld.copy(m.matrixWorld);q.matrixAutoUpdate=false;api.militaryMarkRayMesh(q);return q;});
    const footRay=new Three.Raycaster(),up=new Three.Vector3(0,1,0);let footClearance=Infinity,footProbes=0;
    for(const seatSide of [-1,1])for(const footSide of [-1,1]){
      footRay.set(new Three.Vector3(plan.pedalX,-plan.M,seatSide*Math.abs(plan.z)+footSide*.11*plan.M),up);footRay.far=4*plan.M;
      const first=footRay.intersectObjects(footRays,false)[0],hit=first&&Math.abs(first.face.normal.y)>=.8?first:null;if(hit){footClearance=Math.min(footClearance,(plan.pedalY-.1*plan.M-hit.point.y)/plan.M);footProbes++;}
    }
    for(const q of footRays)q.material.dispose();
    t.assert(footProbes>=2&&footClearance>=-.002,label+'shoe soles remain above actual source lower floor '+footClearance);
    const head=sourceHeadFit(api,Three,built);
    reports.push({type,model:model.type,triangles:model.triangles,farTriangles:model.farTriangles,maximumArmRatio,footClearance,footProbes,head});
    if(!built.kit.glass.open)t.assert(head.clearance>=.005&&head.missed===0,label+'all adult head/hair/cap vertices stay inside actual source canopy '+JSON.stringify(head));
    let textureDisposals=0;const sharedTextures=new Set([paint.map,paint.normalMap,paint.roughnessMap,paint.metalnessMap,paint.emissiveMap].filter(Boolean));
    for(const texture of sharedTextures)texture.addEventListener('dispose',()=>textureDisposals++);
    paint.dispose();
    t.assert(textureDisposals===0&&other.paint.map===clean.map,label+'disposing private paint leaves shared source textures alive');
  }
  t.assert(hash()===pristineHash,'animation, source doors, LOD, char and repair never mutate any packed source buffer');
  t.note?.(JSON.stringify({sourceKits:reports.length,gameTypes:Object.keys(source.byGameType).length,models:reports}));
}
