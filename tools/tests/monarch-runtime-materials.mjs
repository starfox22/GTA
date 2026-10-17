// Production Monarch pack/PBR state, per-face ray sidedness, source sharing and asynchronous texture tiers.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

export default async function(t) {
  const Three=createRequire(import.meta.url)('../../vendor/three.r160.js'),
    read=name=>fs.readFileSync(new URL('../../src/'+name+'.js',import.meta.url),'utf8'),
    path=process.env.GTA_MONARCH_PACK||new URL('../../assets/monarch-vehicle-models.bin',import.meta.url);
  if(!fs.existsSync(path)){t.skip?.('Monarch source pack not built');return;}
  const bytes=fs.readFileSync(path),length=bytes.readUInt32LE(8),header=JSON.parse(bytes.subarray(12,12+length)),binary=bytes.subarray(12+length),
    first=Object.values(header.models)[0],preview={...first,type:'monarch_unbound_preview',gameTypes:[]},
    withModels=models=>{const json=Buffer.from(JSON.stringify({...header,models})),pad=Buffer.alloc((4-(12+json.length)%4)%4,32),head=Buffer.alloc(12);head.write('DECVM001');head.writeUInt32LE(json.length+pad.length,8);return Buffer.concat([head,json,pad,binary]);},
    source=withModels({...header.models,[preview.type]:preview}),requests=[],uploads=[],errors=[],activeTier={lodBias:1},ASSETS={monarchVehicleModels:'data:application/octet-stream;base64,'+source.toString('base64')};
  for(const m of Object.values(header.models))for(const keys of Object.values(m.textureKeys))
    for(const key of [keys.high,keys.low])ASSETS[key]='data:image/webp;base64,'+key;
  class ControlledImage {
    set src(value){this.url=value;requests.push(this);}
    complete(size){this.width=this.height=size;this.onload();}
  }
  const scope=vm.createContext({Three,ASSETS,activeTier,Image:ControlledImage,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Float32Array,DataView,TextDecoder,
    atob:x=>Buffer.from(x,'base64').toString('binary'),sharedMaterials:new Set(),sharedGeometries:new Set(),
    renderer:{capabilities:{getMaxAnisotropy:()=>16},initTexture:texture=>uploads.push(texture.image.width)},
    CIV_NO_DIRT:{value:new Three.Vector2(0,-1e6)},CIV_DIRT_GLSL:'float carSill = 0.0;',cityMaterialPatch(){},
    CAR_M:8,carViewSetBack:{value:0},console:{error:e=>errors.push(String(e.message||e))},performance,vaEnabled:true});
  // Use the production decoder, Three shaders, glass patch and exact M4 query
  // broadphase. Only environment/image delivery is controlled by this host.
  const geomSource=process.env.GTA_VEHICLE_ASSETS_JS?fs.readFileSync(process.env.GTA_VEHICLE_ASSETS_JS,'utf8'):read('vehicle-assets3d'),
    geometry=geomSource.slice(geomSource.indexOf('      function vaGeometry('),geomSource.indexOf('      // Parts drawn as one geometry')),
    sports=read('sports-vehicle-assets3d'),roles=sports.slice(sports.indexOf('      function sportsRoleTriangles('),sports.indexOf('      const sportsVehicleTextures')),
    api=vm.runInContext(read('cars3d-interior')+read('approved-vehicle-assets3d')+read('military-mark-rays3d')+roles+geometry+read('monarch-vehicle-assets3d')+`
      ({monarchVehicleData,monarchVehicleModel,monarchVehicleReport,monarchVehicleMaterials,monarchVehiclePaint,
        monarchVehicleLamps,monarchVehicleTexture,monarchVehicleTextureQuality,monarchVehicleMesh,monarchVehicleKitFit,vaGeometry})`,scope);
  t.assert(api.monarchVehicleModel('sedan')===null&&api.monarchVehicleModel('brutini')===null,'ordinary traffic and existing SVJ never intercept the collection loader');
  t.assert(vm.runInContext('monarchVehicleCache === undefined',scope),'ordinary traffic leaves the entire collection pack undecoded');
  const data=api.monarchVehicleData(),model=api.monarchVehicleModel(process.env.GTA_MONARCH_MODEL||first.type);
  t.assert(!errors.length&&data&&api.monarchVehicleModel('monarch_unbound_preview').gameTypes.length===0,'real decoder permits explicitly unbound source candidates');
  for(const m of Object.values(data.header.models))for(const type of m.gameTypes)
    t.assert(api.monarchVehicleModel(type)===m,'gameplay mapping selects actual source identity '+type);
  const materials=api.monarchVehicleMaterials(model),paint=api.monarchVehiclePaint({color:'#d42871'},model),paint2=api.monarchVehiclePaint({color:'#3274ca'},model),lamps=api.monarchVehicleLamps(model);
  t.assert(materials.rubber.color.getHexString()===(model.type==='monarch_roadster_ev'?'25272a':'ffffff'),'only the downloaded Roadster source receives the explicit black-rubber correction');
  t.assert(materials.trim.color.getHexString()==='ffffff'&&materials.rim===materials.trim&&Object.values(lamps).every(m=>m.color.getHexString()==='ffffff'),'source-specific rubber tint cannot darken rims, body trim or lamps');
  t.assert(!!materials.trim.normalMap===!!model.hasNormalMaps&&(!model.hasNormalMaps||materials.trim.normalMap.colorSpace===Three.NoColorSpace),'source normal-enabled variant binds a linear normal map only where supplied');
  t.assert(materials.trim.emissiveIntensity===(model.emissiveIntensity??1)&&lamps.headOn.emissiveIntensity===2,'source emission strength is restored without scaling gameplay lamp states');
  t.assert(materials===api.monarchVehicleMaterials(model)&&lamps===api.monarchVehicleLamps(model),'source materials/lamps are cached by source rather than car count');
  t.assert(paint!==paint2&&paint.map===paint2.map&&paint.map===materials.trim.map,'private respray materials share immutable source atlas identity');
  t.assert(!scope.sharedMaterials.has(paint)&&scope.sharedMaterials.has(materials.trim)&&Object.values(lamps).every(m=>scope.sharedMaterials.has(m)),'private paint is disposable while shared source families persist');
  let textureDisposed=0,paintDisposed=0;paint.map.addEventListener('dispose',()=>textureDisposed++);paint.addEventListener('dispose',()=>paintDisposed++);paint.dispose();
  t.assert(paintDisposed===1&&textureDisposed===0&&paint2.map===materials.trim.map,'disposing a private paint cannot dispose another car source texture');
  const shaderFor=material=>{const s={uniforms:{},vertexShader:Three.ShaderLib.standard.vertexShader,fragmentShader:Three.ShaderLib.standard.fragmentShader};material.onBeforeCompile(s);return s;};
  for(const m of [materials.trim,materials.rubber,materials.opticalGlass,paint2,lamps.headOn]) {
    const s=shaderFor(m);
    t.assert(s.vertexShader.includes('attribute vec4 avSurface;')&&!/attribute float av(?:PaintMask|DoubleSide|NormalScale)/.test(s.vertexShader),'surface controls share one shader attribute');
    t.assert(s.fragmentShader.includes('monarchAtlasSample( roughnessMap, vMonarchOrmUv, vAvAtlasRect, monarchOrmSize )')&&s.fragmentShader.includes('monarchAtlasSample( metalnessMap, vMonarchOrmUv, vAvAtlasRect, monarchOrmSize )'),'source ORM samples independently transformed continuous ORM UV');
    t.assert(s.fragmentShader.includes('monarchAtlasSample( emissiveMap, '+(m===lamps.headOn?'vAvSourceUv':'vMonarchEmissiveUv')+', vAvAtlasRect, monarchEmissionSize )'),'source emission and gameplay lamps use the correct independently repeating UV path');
    t.assert(s.fragmentShader.includes('monarchAtlasSample( map, vAvSourceUv, vAvAtlasRect, monarchAlbedoSize )')&&s.fragmentShader.includes('monarchAtlasSample( normalMap, vMonarchNormalUv, vAvAtlasRect, monarchNormalSize )'),'albedo and source normals use continuous-gradient atlas sampling too');
    t.assert(m.extensions.derivatives===true&&m.extensions.shaderTextureLOD===true&&s.fragmentShader.includes('texture2DGradEXT( atlasMap, atlasUv, sourceDx, sourceDy )')&&s.fragmentShader.includes('texture2D( atlasMap, atlasUv, bias )'),'source shader requests vendor WebGL1 gradients and retains an extension-free mip-bias fallback');
    t.assert(s.fragmentShader.includes('vMonarchSurface.w>=0.0 && diffuseColor.a<vMonarchSurface.w')&&s.fragmentShader.includes('vMonarchSurface.w > -1.5 && vMonarchSurface.w < -0.5'),'source MASK cutoff and OPAQUE/BLEND alpha semantics replace the generic0.5cutout');
    t.assert(s.fragmentShader.includes('mapN.xy *= normalScale * vMonarchSurface.z;'),'source material normal strength is applied before tangent-frame reconstruction');
    t.assert(s.fragmentShader.includes('vMonarchSurface.y<0.5')&&!s.fragmentShader.includes('min(0.18, vApprovedFinish.y)')&&!s.fragmentShader.includes('max(0.78, roughnessFactor * vApprovedFinish.x)'),'authored sides/metallic/roughness survive the live production shader');
  }
  for(const m of [materials.glass,materials.glassFar]) {
    const s=shaderFor(m);
    t.assert(m.userData.monarchSource&&m.transparent&&!m.depthWrite&&s.fragmentShader.includes('vMonarchGlassSide<0.5'),'see-through gameplay glass retains source draw and query side contract');
  }
  const pshader=shaderFor(paint2);
  const sample=pshader.fragmentShader.slice(pshader.fragmentShader.indexOf('vec4 monarchAtlasSample('),pshader.fragmentShader.indexOf('varying vec2 vAvSourceUv;'));
  t.assert(sample.includes('dFdx( sourceUv ) * rect.zw')&&sample.includes('dFdy( sourceUv ) * rect.zw')&&!sample.includes('dFdx( fract('),'production atlas gradient inputs remain authored coordinates across positive and negative repeat seams');
  // Independent footprint oracle: an affine screen-space source UV has the
  // same differential on either side of every integer, including negative UV.
  // The old implicit fract differential jumps; the explicit source differential
  // and extension-free mip-bias correction must agree with the repeat sampler.
  for(const tile of [-27,-2,-1,0,1,24])for(const slope of [.004,.04,.18])for(const sign of [-1,1]){
    const raw=[tile-sign*slope/2,tile+sign*slope/2],wrapped=raw.map(v=>v-Math.floor(v)),rectSize=128/2048,
      sourceFootprint=Math.abs(raw[1]-raw[0])*rectSize*2048,
      oldFootprint=Math.abs(wrapped[1]-wrapped[0])*rectSize*2048,
      expectedFootprint=slope*128,bias=Math.log2(sourceFootprint/oldFootprint),
      correctedFallback=Math.log2(oldFootprint)+bias;
    t.assert(Math.abs(sourceFootprint-expectedFootprint)<1e-10,'source128px tile differential matches original repeated-image footprint at '+tile);
    t.assert(oldFootprint>sourceFootprint*4&&Math.abs(correctedFallback-Math.log2(expectedFootprint))<1e-10,'integer-repeat mip spike is removed by both source gradients and fallback bias at '+tile);
  }
  t.assert(pshader.fragmentShader.includes('mix(vec3(1.0),diffuse,vMonarchSurface.x)')&&pshader.vertexShader.includes('mix(vec3(1.0),instanceColor.xyz,avSurface.x)'),'source trim is protected from both private uniform and instanced traffic respray tint');
  // Count source shader inputs, not every CPU geometry attribute. The latter also
  // retains avDoubleSide for ray queries, which must not consume a GPU location.
  const sourceInputs=[...pshader.vertexShader.matchAll(/attribute\s+(?:vec[234]|float)\s+(av\w+|finish)\s*;/g)].map(m=>m[1]);
  const activeSlots=new Set(sourceInputs).size+4+4+1;
  t.assert(activeSlots<=16,'instanced RGBA-source material fits guaranteed16attribute slots including matrix and instance colour');
  const part=Object.entries(model.parts).filter(([name,p])=>!name.endsWith('Far')&&p.triangles>=256).sort((a,b)=>b[1].triangles-a[1].triangles)[0][0],
    geo=api.vaGeometry(model,data,part,1,null,true),indexed=geo.index,flags=geo.attributes.avDoubleSide,surface=geo.attributes.avSurface,
    instanced=new Three.InstancedMesh(geo,paint2,2);
  instanced.setColorAt(0,new Three.Color('#e12670'));instanced.setColorAt(1,new Three.Color('#2e6fda'));
  t.assert(instanced.instanceColor&&surface?.itemSize===4&&geo.attributes.color.itemSize===4,'actual packed near geometry supports instanced source RGBA and combined surface controls');
  for(let i=0;i<surface.count;i++) {
    t.assert(surface.getY(i)===flags.getX(i),'actual packed draw side equals CPU query side');
    t.assert(surface.getX(i)===geo.attributes.avPaintMask.getX(i),'actual packed respray mask remains independent of source RGBA');
    const packed=data.arrays[model.type+'.'+part+'.l'];
    if(packed)t.assert(surface.getZ(i)===packed[i],'actual packed per-material normal scale survives the runtime');
    const cutoff=data.arrays[model.type+'.'+part+'.v'];
    if(cutoff)t.assert(surface.getW(i)===cutoff[i],'actual packed native alpha mode/cutoff survives the runtime');
  }
  const checksum=Buffer.concat(Object.values(geo.attributes).map(a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))).toString('base64'),
    referenceGeo=new Three.BufferGeometry();referenceGeo.attributes=geo.attributes;referenceGeo.index=geo.index;referenceGeo.boundingBox=geo.boundingBox;referenceGeo.boundingSphere=geo.boundingSphere;
  // Independent reference: vanilla Three material groups use actual FrontSide
  // or DoubleSide per source triangle, rather than repeating the filter formula.
  let start=0,side=flags.getX(indexed.getX(0))>=.5?1:0;
  for(let at=3;at<=indexed.count;at+=3) {
    const next=at<indexed.count?(flags.getX(indexed.getX(at))>=.5?1:0):-1;
    if(next!==side){referenceGeo.addGroup(start,at-start,side);start=at;side=next;}
  }
  const reference=new Three.Mesh(referenceGeo,[new Three.MeshStandardMaterial({side:Three.FrontSide}),new Three.MeshStandardMaterial({side:Three.DoubleSide})]),
    mesh=api.monarchVehicleMesh(new Three.Mesh(geo,materials.trim)),ray=new Three.Raycaster(),a=new Three.Vector3(),b=new Three.Vector3(),c=new Three.Vector3(),point=new Three.Vector3(),normal=new Three.Vector3();
  t.assert(mesh._computeIntersections!==Three.Mesh.prototype._computeIntersections,'actual heavy immutable source registered existing exact mark broadphase');
  const serial=hits=>hits.map(h=>[h.faceIndex,h.distance,h.uv?.toArray(),h.point.toArray()]);let comparisons=0;
  const compare=label=>{const fast=ray.intersectObject(mesh,false),expected=ray.intersectObject(reference,false);t.assert(JSON.stringify(serial(fast))===JSON.stringify(serial(expected)),label+': actual packed source query equals vanilla authored-sided groups');comparisons++;};
  for(const scale of [[1,1,1],[-.65,.9,.8]]) {
    mesh.scale.set(...scale);mesh.rotation.set(.13,.49,-.07);mesh.position.set(11,7,-13);mesh.updateMatrixWorld(true);reference.matrix.copy(mesh.matrix);reference.matrixWorld.copy(mesh.matrixWorld);reference.matrixAutoUpdate=false;
    for(let at=0;at<indexed.count;at+=Math.max(3,Math.floor(indexed.count/40/3)*3)) {
      a.fromBufferAttribute(geo.attributes.position,indexed.getX(at));b.fromBufferAttribute(geo.attributes.position,indexed.getX(at+1));c.fromBufferAttribute(geo.attributes.position,indexed.getX(at+2));normal.crossVectors(b.clone().sub(a),c.clone().sub(a));if(normal.lengthSq()<1e-12)continue;normal.normalize();point.copy(a).add(b).add(c).multiplyScalar(1/3);
      for(const sign of [-1,1]){ray.set(point.clone().addScaledVector(normal,.01*sign).applyMatrix4(mesh.matrixWorld),normal.clone().multiplyScalar(-sign).transformDirection(mesh.matrixWorld));ray.near=0;ray.far=.04;compare('spin-independent source side/'+sign);}
    }
  }
  const old=geo.attributes.position.version;geo.attributes.position.needsUpdate=true;compare('changed source position version falls back safely');
  t.assert(geo.attributes.position.version===old+1,'fallback proof exercised a real geometry version change');
  t.assert(Buffer.concat(Object.values(geo.attributes).map(a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))).toString('base64')===checksum,'all source position/normal/UV/colour/surface buffers remain exact through actual ray queries');
  // Exercise actual KitFit replacement after an earlier far-kit builder has
  // already retained its generic boxes. Headroom fitting is a separate rig test.
  scope.carSeatPlan=(...args)=>{scope.seatOptions=args[5];return{glass:{w:18}};};
  const missing={...model,glass:{...model.glass,open:true},seats:{...model.seats,floor:.06,minHipY:.08,pedal:[.7,.16],fixed:true},parts:{},roleParts:{hood:[],panels:[]},doors:{},hasInterior:true,paintRect:[.1,.2,.02,.03]},
    panel=()=>{const g=new Three.BoxGeometry();g.setAttribute('avSourceUv',g.attributes.uv.clone());return g;},
    kit={type:first.gameTypes[0],asset:missing,l:40,k:8,glass:{},seats:{glass:{w:18}},hood:new Three.BoxGeometry(),paint:new Three.BoxGeometry(),far:{hood:new Three.BoxGeometry(),paint:new Three.BoxGeometry()},lamps:{},door:panel(),trunk:panel()};
  api.monarchVehicleKitFit(kit,missing,data,8);
  t.assert(scope.seatOptions.floor===.06,'source-specific physical floor passes through the actual unit conversion without changing other cars');
  t.assert(kit.glass.open===true,'explicit source open-top classification reaches the actual seat plan');
  t.assert(scope.seatOptions.minY===.08&&scope.seatOptions.pedal[0]===.7&&scope.seatOptions.pedal[1]===.16&&scope.seatOptions.fixed===true,'source-specific fixed adult seat, hip lower bound and pedal target pass independently of physical floor');
  t.assert([kit.hood,kit.paint,kit.far.hood,kit.far.paint].every(g=>g.index.count===0&&g.attributes.position.count===0),'missing source hood/panels stay absent in both near and already-created far LOD');
  t.assert(['finish','avSourceUv','avOrmSourceUv','avNormalSourceUv','avEmissiveSourceUv','avAtlasRect','avSurface'].every(name=>kit.hood.attributes[name]?.count===0),'empty source roles retain full layout for safe immutable joins');
  t.assert(kit.door.attributes.avSurface.getX(0)===1&&kit.door.attributes.avSurface.getY(0)===0&&kit.door.attributes.avSurface.getZ(0)===1&&kit.door.attributes.avSurface.getW(0)===-1&&Math.abs(kit.door.attributes.avAtlasRect.getZ(0)-.02)<1e-7,'generated moved panels use neutral paint tile and combined default surface controls');
  const low=requests.slice(),lowSize=model.lowAtlas[0],highSize=model.atlas[0],texture=paint2.map;
  t.assert(low.every(image=>image.url.includes('Low')),'a whole newly encountered source family first requests its compact Low fallback');
  low.forEach(image=>image.complete(lowSize));
  t.assert(pshader.uniforms.monarchAlbedoSize.value.x===lowSize&&pshader.uniforms.monarchOrmSize.value.x===lowSize,'actual shared texture upload dimensions feed source-footprint guards');
  scope.player={x:0,y:0,car:{type:model.gameTypes[0],x:0,y:0}};scope.vehicles=[];
  api.monarchVehicleTextureQuality();let at=requests.length;const high=requests.slice(low.length);high.forEach(image=>image.complete(highSize));
  let report=api.monarchVehicleReport();
  t.assert(high.length===low.length&&texture.image.width===highSize&&report.heroSource===model.type&&report.models[model.type].texturesReady&&report.models[model.type].targetTextures==='high','driven hero alone promotes to actual source High and publishes complete dimension/pending proof');
  t.assert(pshader.uniforms.monarchAlbedoSize.value.x===highSize&&pshader.uniforms.monarchEmissionSize.value.y===highSize,'existing compiled size-uniform identities update when source maps promote');
  const other=Object.values(data.header.models).find(m=>m.type!==model.type&&m.gameTypes.length);
  if(other){
    const otherMaterials=api.monarchVehicleMaterials(other),background=requests.slice(at);at=requests.length;background.forEach(image=>image.complete(other.lowAtlas[0]));
    t.assert(background.every(image=>image.url.includes('Low'))&&otherMaterials.trim.map.image.width===other.lowAtlas[0],'another showroom source remains compact while the hero is detailed');
    scope.player.car={type:other.gameTypes[0],x:0,y:0};api.monarchVehicleTextureQuality();
    const promoteOther=requests.slice(at);at=requests.length;
    t.assert(texture.image.width===lowSize&&report.models[model.type].atlasSizes.albedo[0]===highSize,'previous source demotes synchronously before any next-family High callback');
    promoteOther.forEach(image=>image.complete(other.atlas[0]));report=api.monarchVehicleReport();
    t.assert(report.heroSource===other.type&&Object.values(report.models).filter(m=>m.targetTextures==='high').length===1&&texture===paint2.map,'High source residency is bounded to one immutable shared family through hero changes');
    scope.player.car=null;const near={type:model.gameTypes[0],x:80,y:0},far={type:other.gameTypes[0],x:88,y:0};scope.vehicles=[near,far];api.monarchVehicleTextureQuality();
    t.assert(api.monarchVehicleReport().heroSource===model.type,'walking up to a display chooses the nearest source within18metres');
    near.x=90;far.x=85;api.monarchVehicleTextureQuality();t.assert(api.monarchVehicleReport().heroSource===model.type,'nearby-display hysteresis avoids repeated High family churn');
    far.x=40;api.monarchVehicleTextureQuality();t.assert(api.monarchVehicleReport().heroSource===other.type,'a clearly nearer display takes over High detail');
    near.x=far.x=18*8+1;api.monarchVehicleTextureQuality();t.assert(api.monarchVehicleReport().heroSource===null&&Object.values(api.monarchVehicleReport().models).every(m=>m.targetTextures==='low'),'leaving the displays releases all High families immediately');
  }
  scope.player.car={type:model.gameTypes[0],x:0,y:0};at=requests.length;api.monarchVehicleTextureQuality();const oldHigh=requests.slice(at);
  activeTier.lodBias=2;api.monarchVehicleTextureQuality();oldHigh.forEach(image=>image.complete(highSize));report=api.monarchVehicleReport();
  t.assert(texture.image.width===lowSize&&report.reducedTextures&&report.heroSource===null&&report.models[model.type].texturesReady,'late source High callback cannot overwrite a newer synchronous Low demotion');
  t.assert(pshader.uniforms.monarchAlbedoSize.value.x===lowSize,'synchronous hero demotion updates existing shader footprint dimensions too');
  t.assert(report.highSourceLimit===1&&Object.values(report.models).every(m=>m.targetTextures==='low'),'Low tier never retains an active High family');
  t.assert(!errors.length,'production Monarch decoder/material/image path reports no errors');
  t.note?.(JSON.stringify({monarchRuntime:{model:model.type,nearTriangles:model.triangles,testedPart:part,sourceVertexCount:surface.count,instancedActiveAttributeSlots:activeSlots,rayComparisons:comparisons,textureRequests:requests.length,gpuCompilation:'Separate native shadercheck required'}}));
}
