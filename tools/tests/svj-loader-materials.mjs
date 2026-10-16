// Actual embedded-media loader, independent pack decoder, PBR hooks and asynchronous tier changes.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

export default async function(t) {
  const read = name => fs.readFileSync(new URL('../../src/'+name+'.js', import.meta.url),'utf8'),
    Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    manifest = JSON.parse(fs.readFileSync(new URL('../../assets/manifest.json',import.meta.url))),
    media = Object.fromEntries(manifest.map(entry => [entry.id, entry.id.startsWith('media-svj-')
      ? 'data:'+entry.mime+';base64,'+fs.readFileSync(new URL('../../'+entry.file,import.meta.url)).toString('base64') : 'data:application/octet-stream;base64,AA==']));
  let ASSETS;
  vm.runInNewContext(read('asset-loader'), {window:{DEAD_END_CITY_MEDIA:media},
    document:{getElementById:()=>({style:{},dataset:{mime:'image/png'},textContent:'AA=='}),documentElement:{style:{setProperty(){}}}},
    startDeadEndCity:assets=>{ASSETS=assets;}});
  for(const suffix of ['Models','Albedo','Orm','Emissive','AlbedoLow','OrmLow','EmissiveLow'])
    t.assert(ASSETS['svjVehicle'+suffix]?.length>64,'actual boot loader wires SVJ '+suffix);
  const requests=[], uploads=[], activeTier={lodBias:1};
  class ControlledImage {
    set src(value){this.url=value;requests.push(this);}
    complete(size){this.width=this.height=size;this.onload();}
  }
  const context=vm.createContext({Three,ASSETS,activeTier,CAR_M:8,Image:ControlledImage, Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Float32Array,DataView,TextDecoder,
    atob:x=>Buffer.from(x,'base64').toString('binary'), sharedMaterials:new Set(),sharedGeometries:new Set(),
    renderer:{capabilities:{getMaxAnisotropy:()=>16},initTexture:texture=>uploads.push(texture.image.width)},
    CIV_NO_DIRT:{value:new Three.Vector2(0,-1e6)},CIV_DIRT_GLSL:'float carSill = 0.0;',cityMaterialPatch(){},
    carGlassMaterial:(color,opacity)=>new Three.MeshStandardMaterial({color,opacity,transparent:true,depthWrite:false}),console:{error:e=>{throw e;}}});
  const api=vm.runInContext(read('cars3d-interior')+read('approved-vehicle-assets3d')+read('sports-vehicle-assets3d')+read('svj-vehicle-assets3d')+read('vehicle-assets3d')+`
    ({svjVehicleData,svjVehicleModel,svjVehicleReport,vehicleAssetModel,svjVehicleMaterials,svjVehiclePaint,svjVehicleTexture,svjVehicleTextureQuality,svjVehicleLamps})`,context),
    model=api.svjVehicleModel();
  t.assert(model.type==='svj_sdc'&&model.approved&&model.assetPack==='svj','real pack decodes after real production loader');
  t.assert(model===api.vehicleAssetModel('brutini')&&model===api.svjVehicleData().header.models.svj_sdc,'actual selection uses independent cached SVJ source');
  t.assert(model.license==='CC BY 4.0'&&model.author.includes('SDC')&&model.source.includes('784e4656aca649cca55d6b18740a19b2'),'embedded asset-specific artist/source/license retained');
  const materials=api.svjVehicleMaterials(),paint=api.svjVehiclePaint({color:'#7ac231'}),lamps=api.svjVehicleLamps();
  t.assert(materials===api.svjVehicleMaterials()&&materials.rim===materials.trim&&materials.trim.map===paint.map,'immutable PBR atlas/material sharing');
  t.assert(materials.opticalGlass.transparent&&!materials.opticalGlass.depthWrite&&materials.opticalGlass.forceSinglePass&&materials.opticalGlass.side===Three.DoubleSide,'source optical covers retain transparent two-sided single-pass state');
  t.assert(materials.glass.transparent&&!materials.glass.depthWrite&&materials.glass.opacity<=.3,'gameplay cabin glazing is see-through');
  t.assert(paint.side===Three.DoubleSide&&paint.clearcoat>=.7,'source two-sided body surfaces and clearcoat retained');
  t.assert([materials.trim,materials.rubber,lamps.headOn,lamps.brake].every(m=>m.side===Three.DoubleSide&&m.forceSinglePass),'every source surface keeps its authored double-sided state');
  for(const material of [materials.trim,paint,materials.opticalGlass,lamps.headOn,lamps.brake]) {
    const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <emissivemap_fragment>\n#include <alphamap_fragment>\n#include <lights_physical_fragment>'};
    material.onBeforeCompile(shader);
    t.assert(shader.vertexShader.includes('avSourceUv')&&shader.fragmentShader.includes('fract(vAvSourceUv)'),'source UV repetition survives the production shader');
    t.assert(shader.fragmentShader.includes('texture2D( roughnessMap, approvedUv )')&&shader.fragmentShader.includes('texture2D( metalnessMap, approvedUv )'),'independent authored roughness/metalness sampled in source atlas tile');
    t.assert(shader.fragmentShader.includes('texture2D( emissiveMap, approvedUv )'),'source lamp emission samples the same source UV tile');
    t.assert(!shader.fragmentShader.includes('min(0.18, vApprovedFinish.y)'),'SVJ authored metallic finish is not silently clamped');
  }
  const high=requests.slice();high.forEach(i=>i.complete(2048));
  t.assert(high.length===3&&api.svjVehicleReport().atlasSizes.every(size=>size[0]===2048),'native source carbon fits full2048 albedo/ORM/emission atlases');
  const identity=paint.map;activeTier.lodBias=2;api.svjVehicleTextureQuality();
  const low=requests.slice(high.length);low.forEach(i=>i.complete(1024));
  t.assert(low.length===3&&api.svjVehicleReport().reducedTextures&&paint.map===identity&&paint.map.image.width===1024,'Low/Medium changes resolution while keeping shared Texture identity');
  activeTier.lodBias=1;api.svjVehicleTextureQuality();const stale=requests.slice(high.length+low.length);
  activeTier.lodBias=2;api.svjVehicleTextureQuality();const newest=requests.slice(high.length+low.length+stale.length);
  newest.forEach(i=>i.complete(1024));stale.forEach(i=>i.complete(2048));
  t.assert(paint.map.image.width===1024&&uploads.at(-1)===1024,'late old high-quality image cannot override a newer Low tier');
  t.note?.('SVJ actual boot wiring, pack identity, PBR shader hooks and texture tiers passed without WebGL');
}
