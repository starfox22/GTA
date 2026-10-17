import fs from 'node:fs';
import {request} from '../../tools/dev.mjs';
const out={};
const call=async(method,...args)=>(await request({op:'call',method,args})).result;
async function profile(label,seconds=3){
  const before={status:await call('status'),military:await call('military')};
  const sample=await request({op:'call',method:'simProfile',args:[seconds,[],20],cpu:true,profile:30});
  out[label]={before,...sample,after:{status:await call('status'),military:await call('military')}};
  fs.writeFileSync('work/m4-utility/profile-before.json',JSON.stringify(out,null,2)+'\n');
  console.log(label,JSON.stringify({cpuMs:sample.cpuMs,frames:sample.result.frames,avg:sample.result.avg,sections:sample.result.parts,profile:sample.profile?.slice(0,12)}));
}
await call('holdSimulation',true); await call('god',true); await call('settings',{sound:false});
await call('fortCoverTest','end'); await call('teleport',-1844,2600);
await profile('city-foot');
await call('drive','jeep',0,0); await profile('city-jeep');
await call('fortCoverTest','jeep'); await profile('base-calm-foot');
await call('interact'); await call('simulate',0.3); await profile('base-stolen-jeep');
await profile('base-stolen-jeep-later',6);
await call('interact'); await call('simulate',0.5); await profile('base-alert-foot');
console.log('saved work/m4-utility/profile-before.json');
