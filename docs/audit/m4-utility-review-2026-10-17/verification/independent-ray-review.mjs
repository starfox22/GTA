import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {militaryMarkFixture} from '../../../../tools/m4-marks-bench.mjs';
let seed=4242;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const evidence=[];
for (const type of ['army_jeep','army_truck']) {
 const f=militaryMarkFixture({type}),{Three,model,source}=f,mesh=model.lod?.near.children[0]||model.body.children.find(o=>o.isMesh),
 fast=mesh._computeIntersections,ray=new Three.Raycaster(),normal=new Three.Vector3(),p=new Three.Vector3(),a=new Three.Vector3(),b=new Three.Vector3(),c=new Three.Vector3(),mat=new Three.Matrix3();mesh.material.side=Three.DoubleSide;
 let compared=0,hitRays=0;
 for (const scale of [[.4,1.1,-.8],[.65,.65,.65],[.0001,3,.02]]) {
  model.group.scale.set(...scale);model.group.rotation.set(.17,.63,-.12);model.group.position.set(127,31,-94);model.body.rotation.set(-.2,.31,.09);model.group.updateMatrixWorld(true);mat.getNormalMatrix(mesh.matrixWorld);
  for(let i=0;i<400;i++) {
   const face=Math.floor(random()*source.index.count/3),pos=source.attributes.position;
   a.fromBufferAttribute(pos,source.index.getX(face*3));b.fromBufferAttribute(pos,source.index.getX(face*3+1));c.fromBufferAttribute(pos,source.index.getX(face*3+2));
   normal.copy(b).sub(a).cross(c.clone().sub(a)).applyMatrix3(mat).normalize();
   p.copy(a).add(b).add(c).multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld).addScaledVector(normal,1);
   ray.set(p,normal.clone().negate());ray.near=.68;ray.far=1.32;
   const compact=h=>h.map(x=>({faceIndex:x.faceIndex,distance:x.distance,face:{...x.face,normal:x.face.normal.toArray()},point:x.point.toArray(),uv:x.uv?.toArray(),normal:x.normal?.toArray()}));
   const got=ray.intersectObject(mesh,false);mesh._computeIntersections=f.measured;let expected;try{expected=ray.intersectObject(mesh,false);}finally{mesh._computeIntersections=fast;}
   assert.deepEqual(compact(got),compact(expected),type+' scale'+scale+' face'+face);if(got.length)hitRays++;compared++;
  }
 }
 evidence.push({type,compared,hitRays});
}
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 sourceSHA256=createHash('sha256').update(fs.readFileSync(new URL('../../../../src/military-mark-rays3d.js',import.meta.url))).digest('hex');
fs.writeFileSync(new URL('./independent-ray-review.json',import.meta.url),JSON.stringify({pass:true,head,sourceSHA256,seed:4242,conditions:'Oblique triangle-centroid near=.68/far=1.32 rays, parent rotation and nonuniform/negative/extreme scales plus rotated body causing shear',evidence},null,2)+'\n');console.log(JSON.stringify(evidence));
