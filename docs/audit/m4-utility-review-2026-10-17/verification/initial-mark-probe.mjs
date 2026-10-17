import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const root=process.env.M4_SOURCE_ROOT || '/workspace/GTA', Three=createRequire(import.meta.url)(root+'/vendor/three.r160.js');
const read=name=>fs.readFileSync(root+'/src/'+name,'utf8');
const bytes=fs.readFileSync(root+'/assets/vehicle-models.bin'), length=bytes.readUInt32LE(8);
const header=JSON.parse(bytes.subarray(12,12+length)), base=12+length;
const types={f4:Float32Array,i1:Int8Array,u1:Uint8Array,i2:Int16Array,u2:Uint16Array,u4:Uint32Array}, arrays={};
for(const[name,[type,offset,count]]of Object.entries(header.arrays)){
  const raw=bytes.subarray(base+offset,base+offset+count*types[type].BYTES_PER_ELEMENT);
  arrays[name]=new types[type](Uint8Array.from(raw).buffer);
}
const perf={rings:0, casts:0, testedTriangles:0}, vehicles=[], carModels=new Map();
const scope=vm.createContext({Three,fixture:{header,arrays},player:{car:null},vehicles,carModels,perf,
  sharedGeometries:new Set(),sharedMaterials:new Set(),boxGeo:new Three.BoxGeometry(),
  sootTexture:new Three.Texture(),glass:new Three.MeshStandardMaterial(),
  warmLamp:new Three.MeshStandardMaterial(),tailLamp:new Three.MeshStandardMaterial(),
  brakeLamp:new Three.MeshBasicMaterial(),deadLamp:new Three.MeshStandardMaterial(),
  vehicleLampAmount:()=>0,clamp:(v,l,h)=>Math.max(l,Math.min(h,v)),cityMaterialPatch:()=>{},
  renderer:{capabilities:{getMaxAnisotropy:()=>8},initTexture(){}},
  vehicleSpec:()=>({l:4.6*8,w:2.3*8,modelScale:.65}),
  chaseViewActive:true,activeTier:{lodBias:1},chaseZoomAt:()=>2,
  TAU:Math.PI*2,UNITS_PER_METRE:8,DECAL:{hole:0,star:1,scrape:2},PANE_ORDER:['left','front','right','rear','roof'],
  vehicleDecals:{capacity:4096,mesh:{count:0}},vehicleDoorMoveMark:()=>false,
  decalPose(matrix){matrix.identity();},writeDecal(){},
  mesh(geometry,material,parent){const o=new Three.Mesh(geometry,material);parent.add(o);return o;}
});
const finishSource=read('cars3d-materials.js');
const finish=finishSource.slice(finishSource.indexOf('      function civFinishPatch('),finishSource.indexOf('      let civMaterials'));
const cast=Three.Mesh.prototype.raycast, intersections=Three.Mesh.prototype._computeIntersections;
Three.Mesh.prototype.raycast=function(...args){perf.casts++;return cast.apply(this,args);};
Three.Mesh.prototype._computeIntersections=function(...args){
  perf.testedTriangles+=Math.min(this.geometry.drawRange.count,(this.geometry.index?.count||this.geometry.attributes.position.count))/3;
  return intersections.apply(this,args);
};
const api=vm.runInContext(finish+read('vehicle-assets3d.js')+read('approved-vehicle-assets3d.js')+
  read('military-asset-wheels3d.js')+(fs.existsSync(root+'/src/military-mark-rays3d.js')?read('military-mark-rays3d.js'):'')+read('military-assets3d.js')+read('damage3d-marks.js')+`
  vaData=()=>fixture; vaAtlas=()=>sootTexture;
  const profileRing=markRingHolds;
  markRingHolds=function(...args){perf.rings++;return profileRing(...args);};
  ({militaryAssetBody,drawVehicleMarks,markPrepare,anchorMark,poseMark,markTargets,markAnchors});`,scope);
const group=new Three.Group(),body=new Three.Group();group.add(body);group.scale.setScalar(.65);
const model={group,body,wheels:[],lamps:[],paint:new Three.MeshStandardMaterial(),modelScale:.65,shapeVersion:1};
const buildCPU=process.cpuUsage(), buildNow=performance.now();
api.militaryAssetBody(model,{type:'jeep'},'army_jeep',4.6*8/.65);
console.log(JSON.stringify({buildWallMs:performance.now()-buildNow,buildCPU:process.cpuUsage(buildCPU)}));
const car={id:1,type:'jeep',damage:{marks:[],glass:{}}};vehicles.push(car);carModels.set(car,model);
group.updateMatrixWorld(true);
const triangles={};body.traverse(o=>{if(o.geometry)triangles[o.geometry.uuid]=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
function makeMarks(mode){
  return Array.from({length:12},(_,i)=>({id:i+1,kind:'hole',size:1.4,
    x:(i/11-.5)*.7*4.6*8,y:-2.3*8/2,z:mode==='miss'?100:mode==='low'?5:10,dx:0,dy:1}));
}
const results=[];
function measure(label,fn,rounds=1){
  perf.rings=perf.casts=perf.testedTriangles=0;
  const cpu=process.cpuUsage(),now=performance.now();
  for(let i=0;i<rounds;i++)fn();
  const use=process.cpuUsage(cpu);
  const row={label,rounds,cpuMs:(use.user+use.system)/1000,wallMs:performance.now()-now,
    rings:perf.rings,meshRaycasts:perf.casts,testedTriangles:perf.testedTriangles,drawn:scope.vehicleDecals.mesh.count,
    anchored:car.damage.marks.filter(m=>api.markAnchors.get(m)?.object).length};
  row.cpuMsPerFrame=row.cpuMs/rounds;row.trianglesPerFrame=row.testedTriangles/rounds;
  results.push(row);console.log(JSON.stringify(row));
}
measure('pristine',()=>api.drawVehicleMarks(),60);
for(const mode of ['side','low','miss']){
  car.damage.marks=makeMarks(mode);model.shapeVersion++;
  measure(mode+'-first',()=>api.drawVehicleMarks());
  measure(mode+'-cached',()=>api.drawVehicleMarks(),60);
  measure(mode+'-damageVersion-each-frame',()=>{model.shapeVersion++;api.drawVehicleMarks();},8);
}
fs.writeFileSync('/workspace/work/impact/work/m4-marks-profile'+(process.env.M4_SOURCE_ROOT?'-after':'')+'.json',JSON.stringify({sourceRoot:root,
  sourceGeometryTriangles:Object.values(triangles).reduce((a,b)=>a+b,0),nearBodyTriangles:model.lod.near.children[0].geometry.index.count/3,results},null,2));
