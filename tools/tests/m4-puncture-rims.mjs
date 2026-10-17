// Actual M4 pressure path: rigid source rims, anchored rubber, private resource lifetime and warm update cost.
import vm from 'node:vm';
import {runMilitaryModelRig} from './military-model-rig.mjs';

export default async function(t) {
  return runMilitaryModelRig(t, ({Three,read,scope,api,header,make}) => {
    scope.isAircraft=scope.isBoat=()=>false;scope.performance=performance;
    const raw=read('damage3d-bodies.js'),resources=read('render3d-resources.js'),
      extra=vm.runInContext(raw.slice(raw.indexOf('      const squashEuler'),raw.indexOf('      function vehicleDoorSpan('))+
        raw.slice(raw.indexOf('      function specialDamage('),raw.indexOf('      function glassBurst('))+
        resources.slice(resources.indexOf('      function collectResources('),resources.indexOf('      collectResources(scene'))+
        'const retiredGeometries=new Set(),retiredMaterials=new Set(),pruneActive=new Set();'+
        resources.slice(resources.indexOf('      function pruneModels('),resources.indexOf('      /**\n       * BAKED CANVAS RELEASE'))+
        ';({specialDamage,militaryRubberProfile,militaryRubberUpdate,pruneModels,disposeRetiredModels})',scope),
      create=()=>{const group=new Three.Group(),body=new Three.Group();group.add(body);group.scale.setScalar(.65);
        const m={group,body,wheels:[],lamps:[],paint:new Three.MeshStandardMaterial()};
        api.militaryAssetBody(m,{scale:.65},'army_jeep',header.models.army_jeep.dims[0]*8/.65);return m;},
      model=create(),other=create(),car={type:'jeep',speed:0,spinSpeed:0,tyres:{steer:0,lock:[0,0]}},
      clear={tires:{},burnt:false},flat={tires:{frontLeft:true,frontRight:true,rearLeft:true,rearRight:true},burnt:false},
      originals=model.wheels.map(w=>w.wheel.children[0].geometry),
      sourceArrays=originals.map(g=>Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,a.array.slice()]))),
      sourceIndices=originals.map(g=>g.index.array.slice()),versions=originals.map(g=>g.attributes.position.version);
    let sourceDisposals=0,privateDisposals=0,clones=0;
    for(const g of originals)g.addEventListener('dispose',()=>sourceDisposals++);
    const originalClone=Three.BufferGeometry.prototype.clone;
    Three.BufferGeometry.prototype.clone=function(){clones++;return originalClone.call(this);};
    try {
      extra.specialDamage(car,model,{tires:{frontLeft:true},burnt:false});api.animateMilitaryWheels(car,model,0);
      t.assert(model.wheels.filter(w=>w.wheel.userData.m4Tyre.geometry).length===1&&clones===1,'one actual puncture creates exactly one private wheel geometry');
      const left=model.wheels.find(w=>w.front&&w.side<0),first=left.wheel.children[0].geometry;
      first.addEventListener('dispose',()=>privateDisposals++);
      t.assert(first!==originals[model.wheels.indexOf(left)]&&left.wheel.scale.y===1&&!Object.hasOwn(left.wheel,'updateMatrix'),'M4 puncture keeps the whole pivot/rim rigid');
      extra.specialDamage(car,model,flat);api.animateMilitaryWheels(car,model,0);
      const privateGeometries=model.wheels.map(w=>w.wheel.children[0].geometry);
      for(let wi=0;wi<4;wi++) {
        const wheel=model.wheels[wi].wheel,g=privateGeometries[wi],source=originals[wi],profile=wheel.userData.m4Tyre.kit;
        if(g!==first)g.addEventListener('dispose',()=>privateDisposals++);
        t.assert(g!==source&&!scope.sharedGeometries.has(g)&&profile===other.wheels[wi].wheel.userData.m4Tyre.kit,'flat geometry is private while the source radial profile stays shared');
        for(const [name,attribute]of Object.entries(g.attributes))
          t.assert(attribute.array.buffer!==source.attributes[name].array.buffer,name+': private disposal cannot release a source attribute buffer');
        t.assert(g.index.array.buffer!==source.index.array.buffer&&g.index.array.every((v,i)=>v===source.index.array[i]),'private source index is cloned without changing topology');
        const p=source.attributes.position,q=g.attributes.position,n=source.attributes.normal,nn=g.attributes.normal;
        let rigid=0,rubber=0;
        for(let i=0;i<p.count;i++) {
          const weight=profile.blend[i*2];
          if(weight===0) {
            rigid++;
            t.assert(q.getX(i)===p.getX(i)&&q.getY(i)===p.getY(i)&&q.getZ(i)===p.getZ(i)&&nn.getX(i)===n.getX(i)&&nn.getY(i)===n.getY(i)&&nn.getZ(i)===n.getZ(i),'actual metal rim/hub and bead retain exact source bytes while punctured');
          } else if(weight===1) {
            rubber++;
            t.assert(Math.abs(q.getY(i)-p.getY(i)*.82)<1e-6&&q.getX(i)===p.getX(i),'actual outer rubber collapses18% vertically while metal remains rigid');
          }
          const v=new Three.Vector3(q.getX(i),q.getY(i),q.getZ(i));
          t.assert(g.boundingBox.containsPoint(v)&&g.boundingSphere.containsPoint(v),'one-time conservative bounds contain the actual deformed source vertices');
        }
        t.assert(rigid>300&&rubber>100,'real source metal/bead and rubber were both exercised');
      }
      t.assert(clones===4,'all four punctures create only four independent private geometries');
      const ids=privateGeometries.map(g=>({g,attributes:Object.values(g.attributes).map(a=>a.array),index:g.index.array,version:g.attributes.position.version}));
      api.animateMilitaryWheels(car,model,.1);
      t.assert(privateGeometries.every((g,i)=>g.attributes.position.version===ids[i].version),'parked pressure/phase cache avoids redundant buffer writes and uploads');
      const cloneWarm=clones,times=[];
      car.speed=24;car.tyres.steer=.38;
      if(globalThis.gc)globalThis.gc();const heapBefore=process.memoryUsage().heapUsed;
      for(let frame=0;frame<1000;frame++) {
        const start=performance.now();api.animateMilitaryWheels(car,model,1/60);times.push(performance.now()-start);
      }
      if(globalThis.gc)globalThis.gc();const heapAfter=process.memoryUsage().heapUsed;
      const warmGeometryAllocations=clones-cloneWarm;
      t.assert(clones===cloneWarm&&model.wheels.every((w,i)=>w.wheel.children[0].geometry===ids[i].g&&Object.values(ids[i].g.attributes).every((a,j)=>a.array===ids[i].attributes[j])&&ids[i].g.index.array===ids[i].index),'1000 rolling flat frames retain the same private geometries and attribute/index buffers');
      t.assert(originals.every((g,wi)=>Object.entries(g.attributes).every(([name,a])=>a.array.every((v,j)=>v===sourceArrays[wi][name][j]))&&g.index.array.every((v,j)=>v===sourceIndices[wi][j])&&g.attributes.position.version===versions[wi]),'pressure/roll never mutate shared source positions, normals, finish, UVs or indices');
      t.assert(other.wheels.every((w,i)=>w.wheel.children[0].geometry===originals[i]&&w.wheel.userData.m4Tyre.geometry===null),'another healthy M4 retains its exact shared source wheels');
      // Smooth bead weighting must preserve coincident source seams at any phase.
      for(const w of model.wheels) {
        const g=w.wheel.children[0].geometry,p=w.wheel.userData.m4Tyre.kit.source.attributes.position,q=g.attributes.position,seams=new Map();
        for(let i=0;i<p.count;i++) {
          const key=[p.getX(i),p.getY(i),p.getZ(i)].join(','),prior=seams.get(key);
          if(prior!==undefined)t.assert(q.getX(i)===q.getX(prior)&&q.getY(i)===q.getY(prior)&&q.getZ(i)===q.getZ(prior),'source split-normal/UV seam stays welded geometrically through rubber collapse');
          else seams.set(key,i);
        }
      }
      api.assetCharSwap(car,model,true);api.assetCharRelease(model);
      t.assert(model.wheels.every((w,i)=>w.wheel.children[0].geometry===privateGeometries[i]),'wear/burn material roundtrip retains private flat geometry ownership');
      extra.specialDamage(car,model,clear);
      t.assert(privateDisposals===4&&sourceDisposals===0&&model.wheels.every((w,i)=>w.wheel.children[0].geometry===originals[i]&&w.wheel.userData.m4Tyre.geometry===null&&w.wheel.scale.y===1&&w.wheel.userData.drop===0),'repair immediately disposes every private flat and restores shared circular source/height');
      extra.specialDamage(car,model,flat);api.animateMilitaryWheels(car,model,0);
      const burnt=model.wheels.map(w=>w.wheel.children[0].geometry);let burntDisposals=0;
      burnt.forEach(g=>g.addEventListener('dispose',()=>burntDisposals++));
      extra.specialDamage(car,model,{tires:flat.tires,burnt:true});
      t.assert(burntDisposals===4&&model.wheels.every((w,i)=>w.wheel.children[0].geometry===originals[i]&&!w.wheel.children[0].visible&&w.wheel.userData.drop===1.6),'burn hides the original tyre and disposes pressure geometry without oval metal leftovers');
      extra.specialDamage(car,model,clear);
      t.assert(model.wheels.every(w=>w.wheel.children[0].visible),'burn repair restores visible clean tyres');
      // Real retirement collector must find attached private geometry, while the
      // immutable kit remains in the live shared set for another healthy M4.
      extra.specialDamage(car,model,flat);api.animateMilitaryWheels(car,model,0);
      let retired=0;model.wheels.forEach(w=>w.wheel.children[0].geometry.addEventListener('dispose',()=>retired++));
      scope.scene=new Three.Scene();scope.scene.add(model.group);const live=new Map([[car,model]]);
      extra.pruneModels(live,[]);extra.disposeRetiredModels();
      t.assert(retired===4&&sourceDisposals===0&&!live.size,'actual model retirement disposes private flats and retains shared source wheels');
      const truck=make('army_truck');extra.specialDamage({type:'truck'},truck,flat);
      t.assert(truck.wheels.every(w=>!w.wheel.userData.m4Tyre&&w.wheel.scale.y===.82&&Object.hasOwn(w.wheel,'updateMatrix')),'other military models retain their existing puncture matrix behavior');
      times.sort((a,b)=>a-b);
      t.note?.(JSON.stringify({m4PunctureWarm:{frames:1000,wheels:4,medianElapsedMs:times[500],p95ElapsedMs:times[950],newGeometries:warmGeometryAllocations,retainedPrivateBuffers:true,heapDeltaAfterGc:globalThis.gc?heapAfter-heapBefore:null}}));
    } finally {Three.BufferGeometry.prototype.clone=originalClone;}
    // Validate the analytic inverse-transpose against an independent finite-
    // difference normal in the smooth transition, not only the endpoint rings.
    const normal=new Three.Vector3(.4,.6,.3).normalize(),t1=new Three.Vector3().crossVectors(normal,new Three.Vector3(0,0,1)).normalize(),t2=new Three.Vector3().crossVectors(normal,t1),
      center=new Three.Vector3(.6,.45,.03),epsilon=.001,points=[center,center.clone().addScaledVector(t1,epsilon),center.clone().addScaledVector(t1,-epsilon),center.clone().addScaledVector(t2,epsilon),center.clone().addScaledVector(t2,-epsilon)],
      g=new Three.BufferGeometry();g.setAttribute('position',new Three.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));g.setAttribute('normal',new Three.Float32BufferAttribute(points.flatMap(()=>normal.toArray()),3));g.setIndex([0,1,3,0,4,2]);g.computeBoundingBox();g.computeBoundingSphere();
    const pivot=new Three.Group(),mesh=new Three.Mesh(g);pivot.add(mesh);pivot.rotation.z=.73;pivot.userData.m4Tyre={kit:extra.militaryRubberProfile(g,1),pressure:.82,appliedPressure:1,phase:NaN,geometry:null};extra.militaryRubberUpdate(pivot);
    const q=mesh.geometry.attributes.position,a=new Three.Vector3().fromBufferAttribute(q,1).sub(new Three.Vector3().fromBufferAttribute(q,2)),b=new Three.Vector3().fromBufferAttribute(q,3).sub(new Three.Vector3().fromBufferAttribute(q,4)),
      measured=new Three.Vector3().crossVectors(a,b).normalize(),actual=new Three.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,0);
    t.assert(actual.distanceTo(measured)<.0003,'analytic pressure normal agrees with finite-difference deformation through the smooth bead transition');
    pivot.userData.m4Tyre.pressure=1;extra.militaryRubberUpdate(pivot);
    t.note?.('M4 metal rims remain rigid under real puncture; bead/source sharing, private lifetime, burn/repair and other models passed');
  });
}
