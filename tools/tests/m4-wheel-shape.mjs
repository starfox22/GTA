// Real packed M4 tyre/rim bands through production build, animation, LOD and flat/repair matrices.
import vm from 'node:vm';
import {runMilitaryModelRig} from './military-model-rig.mjs';

export default async function(t) {
  return runMilitaryModelRig(t, ({Three,read,scope,api,header}) => {
    const raw=read('damage3d-bodies.js');
    scope.isAircraft=scope.isBoat=()=>false;
    const damageApi=vm.runInContext(raw.slice(raw.indexOf('      const squashEuler'),raw.indexOf('      function vehicleDoorSpan('))+
      raw.slice(raw.indexOf('      function specialDamage('),raw.indexOf('      function glassBurst('))+';({specialDamage})',scope),
      spec=read('military-base.js').match(/\bjeep:\s*\{([\s\S]*?)\n\s*\},/)[1],
      scale=Number(spec.match(/\bmodelScale:\s*([\d.]+)/)[1]),
      length=Number(spec.match(/\bl:\s*([\d.]+)\s*\*\s*UNITS_PER_METRE/)[1])*8,
      c={type:'jeep',scale,hp:380,maxhp:380,x:0,y:0,speed:24,tyres:{steer:0,lock:[0,0]}},
      group=new Three.Group(),body=new Three.Group(),model={group,body,wheels:[],lamps:[],paint:new Three.MeshStandardMaterial()};
    // This is the production design-size/group-scale contract: build l/modelScale,
    // then apply the uniform modelScale to the complete model, including its wheels.
    group.add(body);group.scale.setScalar(scale);group.rotation.y=.57;group.position.set(100,12,-80);
    body.rotation.set(.12,0,-.08);
    const k=api.militaryAssetBody(model,c,'army_jeep',length/scale),
      kit=api.militaryAssetKit('army_jeep',length/scale),immutable=model.wheels.map(w=>w.wheel.children[0].geometry.attributes.position.array.slice()),
      clear={tires:{},burnt:false},rows=[];
    t.assert(scale===.65&&Math.abs(k*scale-8)<1e-12,'actual production M4 scale is uniform and wheels retain metre proportions');
    let worstCleanSpread=0,worstFlatSpread=0,worstFlatRigidSpread=0;
    for(let wi=0;wi<model.wheels.length;wi++) {
      const wheel=model.wheels[wi],geo=wheel.wheel.children[0].geometry,p=geo.attributes.position,
        points=[...new Set(geo.index.array)],groups=new Map();
      for(const i of points) {
        const radius=Math.hypot(p.getX(i),p.getY(i))/k;
        if(radius<.075||radius>.45)continue;
        const band=Math.round(radius/.001),list=groups.get(band)||[];list.push(i);groups.set(band,list);
      }
      const bands=[];
      for(const [key,ids]of groups) {
        const angles=new Set(ids.map(i=>(Math.round(Math.atan2(p.getY(i),p.getX(i))/Math.PI*12)+24)%24)),
          radii=ids.map(i=>Math.hypot(p.getX(i),p.getY(i))/k);
        if(angles.size!==24)continue;
        t.assert(Math.max(...radii)-Math.min(...radii)<.00025,'wheel'+wi+' band'+key+': source tyre/rim cross-section is circular rather than oval');
        bands.push({radius:radii.reduce((a,b)=>a+b,0)/radii.length,ids});
      }
      t.assert(bands.length===6,'wheel'+wi+': all six complete tyre/rim/hub rings are present and circular');
      rows.push({wheel:wi,radius:wheel.radius/8,bands:bands.map(b=>b.radius),correction:kit.wheels[wi].roundness.transform});
      wheel.shapeTestBands=bands;
    }
    const axis=new Three.Vector3(),up=new Three.Vector3(),origin=new Three.Vector3(),point=new Three.Vector3(),
      frame=new Three.Matrix4(),turn=new Three.Quaternion(),one=new Three.Vector3(1,1,1),euler=new Three.Euler();
    for(const flat of [false,true])for(const far of [false,true])for(const steer of [-.6,0,.6])for(let phase=0;phase<48;phase++) {
      for(const w of model.wheels)w.wheel.rotation.z=0;
      c.tyres.steer=steer;c.speed=phase<24?24:-24;
      damageApi.specialDamage(c,model,{tires:flat?{frontLeft:true,frontRight:true,rearLeft:true,rearRight:true}:{},burnt:false});
      api.animateMilitaryWheels(c,model,phase*Math.PI*2/48*model.wheels[0].radius/Math.abs(c.speed));
      scope.zoom=far?.01:2;api.militaryLod(c,model);group.updateMatrixWorld(true);
      t.assert(model.lod.isFar===far,'actual body LOD selects requested level without changing wheel geometry');
      for(const w of model.wheels) {
        const object=w.wheel,geo=object.children[0].geometry,p=geo.attributes.position;
        turn.setFromEuler(euler.set(object.rotation.x,object.rotation.y,0));
        frame.compose(object.position,turn,one).premultiply(object.parent.matrixWorld);
        axis.setFromMatrixColumn(frame,0).normalize();up.setFromMatrixColumn(frame,1).normalize();origin.setFromMatrixPosition(frame);
        for(const band of w.shapeTestBands) {
          // Metal/bead rings receive no compensating divide: their actual
          // punctured world geometry must remain physically circular.
          const squash=flat&&band.radius/(w.radius/8)>.56?.82:1;
          let low=Infinity,high=0;
          for(const i of band.ids) {
            point.fromBufferAttribute(p,i).applyMatrix4(object.children[0].matrixWorld).sub(origin);
            // Only outer rubber receives the intended pressure collapse.
            const radius=Math.hypot(point.dot(axis),point.dot(up)/squash)/8;
            low=Math.min(low,radius);high=Math.max(high,radius);
          }
          if(flat)worstFlatSpread=Math.max(worstFlatSpread,high-low);else worstCleanSpread=Math.max(worstCleanSpread,high-low);
          if(flat&&squash===1)worstFlatRigidSpread=Math.max(worstFlatRigidSpread,high-low);
          t.assert(high-low<.00025&&Math.abs((high+low)/2-band.radius)<.0002,
            'world-space wheel ring stays circular through spin/steer/LOD, preserving intentional puncture squash');
        }
      }
    }
    damageApi.specialDamage(c,model,clear);group.updateMatrixWorld(true);
    t.assert(model.wheels.every(w=>w.wheel.scale.y===1&&!Object.hasOwn(w.wheel,'updateMatrix')&&w.wheel.userData.drop===0),'repair restores ordinary circular wheel matrix and ride height');
    t.assert(model.wheels.every((w,i)=>w.wheel.children[0].geometry.attributes.position.array.every((v,j)=>v===immutable[i][j])),'rolling, LOD, puncture and repair never modify cached source-fit vertices');
    c.tyres.lock=[1,1];const phases=model.wheels.map(w=>w.wheel.rotation.z);api.animateMilitaryWheels(c,model,.2);
    t.assert(model.wheels.every((w,i)=>w.wheel.rotation.z===phases[i]),'actual brake locks still stop all corrected wheels');
    t.note?.(JSON.stringify({m4WheelShape:{sourceAspectBefore:.98785,worstCleanRadialSpreadM:worstCleanSpread,worstFlatCorrectedRadialSpreadM:worstFlatSpread,worstFlatRigidRadialSpreadM:worstFlatRigidSpread,phases:48,steer:[-.6,0,.6],bodyLods:2,damageStates:2,rows}}));
  });
}
