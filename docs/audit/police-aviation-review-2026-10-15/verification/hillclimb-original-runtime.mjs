import fs from 'node:fs';
import { request } from '/workspace/GTA/tools/dev.mjs';
const out='/workspace/GTA/dist/review16/hillclimb-original-runtime.json',rows=[];
const call=async(method,...args)=>{const r=await request({op:'call',method,args},{timeoutMs:240000});if(r.error)throw Error(r.error);return r.result;};
const save=()=>fs.writeFileSync(out,JSON.stringify(rows,null,2));
await call('holdSimulation',true);
for(const mode of ['fresh60','fresh30','reused60']){
 if(mode.startsWith('fresh')){await call('teleport',7520,1950);await call('drive','crawler');}
 await call('hillClimb','gate',0);
 const before={driving:await call('drivingState'),ride:await call('ride3d')},frame=mode.endsWith('30')?1/30:1/60;
 const result=await call('trailDrive',240,45,0,frame);
 rows.push({mode,before,result,after:{driving:await call('drivingState'),ride:await call('ride3d')}});save();
 console.log(mode,JSON.stringify({reason:result.reason,last:result.last,ride:result.ride,hp:result.hp}));
}
