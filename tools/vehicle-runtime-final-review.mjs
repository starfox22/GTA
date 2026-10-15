// Actual WebGL follow-up for late-created doors, lamp LOD, exit feet and recovery.
// Named public developer actions/reports only. Run after the matched image review:
// node tools/vehicle-runtime-final-review.mjs FROZEN_HTML OUTPUT_DIRECTORY
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from './browser.mjs';
import gpuContextTest from './tests/gpu-context.mjs';
import playerBodyTest from './tests/player-body.mjs';
const html=path.resolve(process.argv[2]), out=path.resolve(process.argv[3]);
if(!fs.existsSync(html))throw Error('Frozen HTML required');
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={htmlSha256:sha(fs.readFileSync(html)),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),
  gpuTestSha256:sha(fs.readFileSync(new URL('./tests/gpu-context.mjs',import.meta.url))),checks:0,notes:[],errors:[],warnings:[],lod:[]};
report.playerBodyTestSha256=sha(fs.readFileSync(new URL('./tests/player-body.mjs',import.meta.url)));
const {browser}=await launchBrowser({label:'vehicle-runtime-final',args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:960,height:600}});
page.setDefaultTimeout(540000);
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/i.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
const allowed=new Set(['status','holdSimulation','god','graphics','settings','sky','setClock','wanted','look','carLineup','hitchRun',
  'approvedAssets','sportsAssets','vehicleDoors','assetChar','burnVehicle','doorSwing','damageReport','frameFaults','drawProfile',
  'viewMode','inspectView','closeUp','gpuContext','pauseMenu','notices','interact','vehicleAt',
  'playerModel','crowdBenchmark','crowdStats','simulate']);
async function batch(rows){
 for(const[name]of rows)if(!allowed.has(name))throw Error('Undeclared action '+name);
 return page.evaluate(rows=>rows.map(([name,args])=>window.DeadEndCity[name](...args)),rows);
}
const call=async(name,...args)=>(await batch([[name,args]]))[0];
const draw=['hitchRun',[1/60,[],1,false,true]], age=['hitchRun',[1.3,[],1,false,false]];
function assert(ok,message){report.checks++;if(!ok)throw Error(message);}
function save(){fs.writeFileSync(path.join(out,'runtime-review.json'),JSON.stringify(report,null,2)+'\n');}
async function snapshot(id){return page.evaluate(id=>{
 const a=window.DeadEndCity;return {status:a.status(),model:a.approvedAssets().models.find(m=>m.id===id),doors:a.vehicleDoors(id).cars[0],
  char:a.assetChar().models.find(m=>m.id===id)||null,damage:a.damageReport(id)};
},id);}
async function tier(name){
 await batch([['graphics',[name]],draw]);
 await page.waitForFunction(()=>[window.DeadEndCity.sportsAssets(),window.DeadEndCity.approvedAssets()].every(a=>
  a.atlasSizes.length&&(a.atlasSizes.every(([w,h])=>w===h&&w===(a.reducedTextures?2048:4096)))),null,{timeout:240000});
}
try{
 await page.goto('file://'+html+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:540000});
 await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');await page.click('#startBtn');
 await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));
 if((await call('status')).mode==='dialogue')await page.click('#callDecline');
 await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
 assert((await call('status')).renderer==='3d','Actual 3D renderer required');
 await batch([['holdSimulation',[true]],['god',[true]],['sky',['clear']],['setClock',[13]],['wanted',[0]],
  ['settings',[{sound:false,radioVolume:0,cameraView:'street'}]],['viewMode',['street']],['inspectView',[]],['look',[418,6080,1.6]]]);
 // Creating a sports model initializes its lazy atlas textures. Set the tier
 // first, build/render the car, then require its real loaded dimensions.
 await call('graphics','high');
 const [lineup]=await batch([['carLineup',[['chevette'],418,6000,0,44,'#b72228',true]],draw,draw]);
 await tier('high');
 const id=lineup[0].id;report.id=id;
 const clean=report.clean=await snapshot(id);
 assert(!clean.status.vehicle&&!clean.doors.mask&&!Object.keys(clean.doors.doors).length,'Fixture must be unboarded with no prebuilt doors');
 assert(clean.model.visible&&!clean.model.far&&clean.model.triangles===85031,'Actual C8 near draw must contain85031 triangles');
 for(const quality of ['low','ultra']){
  await batch([['look',[418,6300,.9]]]);await tier(quality);await batch([draw]);
  const row={quality,...await snapshot(id)};report.lod.push(row);
  assert(row.model.visible&&row.model.far&&row.model.triangles===9407,quality+': actual C8 far draw must contain9407 triangles');
  console.log('PASS actual lamp LOD',quality,row.model.triangles);save();
 }
 await batch([['look',[418,6080,1.6]]]);await tier('high');await batch([draw]);
 report.returnedNear=await snapshot(id);
 assert(report.returnedNear.model.visible&&!report.returnedNear.model.far&&report.returnedNear.model.triangles===85031,'Near return did not restore all source lamp geometry');
 await batch([['look',[378,6000,4.5]],['burnVehicle',[id,20]],draw]);
 report.burnBeforeDoor=await snapshot(id);
 // wreckVehicle may spring a door in that same first burnt draw. That also
 // creates its layers after paintVehicle charred the body. No door existed in clean.
 assert(report.burnBeforeDoor.char&&report.burnBeforeDoor.damage.burnt,'First wreck draw did not apply source char materials');
 await batch([['doorSwing',[id,true,-1]],draw,draw]);
 report.burntOpen=await snapshot(id);
 assert((report.burntOpen.doors.mask&1)&&report.burntOpen.doors.doors['-1'].native,'First burnt native door did not open');
 await page.screenshot({path:path.join(out,'late-door-burnt.png'),timeout:540000});
 await batch([['burnVehicle',[id,0,true]],['doorSwing',[id,false]],age,draw,draw]);
 report.repaired=await snapshot(id);
 assert(!report.repaired.char&&!report.repaired.damage.burnt&&report.repaired.damage.hp===report.repaired.damage.maxhp,'Repair did not release char state');
 assert(!report.repaired.doors.mask&&Object.values(report.repaired.doors.sourceGeometryRestored).every(Boolean),'Repair did not restore source geometry');
 assert(JSON.stringify(report.repaired.doors.materials)===JSON.stringify(clean.doors.materials),'Repair changed original source materials/maps');
 await batch([['doorSwing',[id,true,-1]],draw,draw]);
 report.reopened=await snapshot(id);
 const cleanUuids=new Set(Object.values(clean.doors.materials).filter(Boolean).map(m=>m.uuid)), layers=report.reopened.doors.doors['-1'].layers.filter(l=>!l.window);
 assert(layers.length>=3&&layers.every(l=>cleanUuids.has(l.material.uuid)),'Reopened late-created layers retained char materials');
 await page.screenshot({path:path.join(out,'late-door-repaired-reopened.png'),timeout:540000});
 report.interiorCamera={player:[418,5970],car:[418,6000],yaw:165,pitch:10,lift:4,zoom:11};
 await batch([['look',[418,5970,11]],['inspectView',[165,10,4]],draw,draw]);
 report.interior=await snapshot(id);
 assert(report.interior.doors.mask&1,'Native aperture closed before the cabin detail capture');
 await page.screenshot({path:path.join(out,'c8-open-cabin-detail.png'),timeout:540000});
 console.log('PASS actual first-door-after-burn repair/reopen');save();
 await batch([['doorSwing',[id,false]],age,draw,['look',[418,5987,11]],['inspectView',[115,7,5]],['interact',[]],draw,age,draw]);
 report.boardedForExit={status:await call('status'),vehicle:await call('vehicleAt',418,6000)};
 assert(report.boardedForExit.status.vehicle==='chevette'&&report.boardedForExit.vehicle.id===id,'Exit fixture did not board the exact repaired C8');
 await batch([['interact',[]],draw,['hitchRun',[.22,[],1,false,true]]]);
 report.exitMidpoint=await snapshot(id);
 assert(!report.exitMidpoint.status.vehicle&&(report.exitMidpoint.doors.mask&1),'Real exit midpoint was not exercised');
 await page.screenshot({path:path.join(out,'exit-feet-midpoint.png'),timeout:540000});
 await batch([age,draw]);report.exitSettled=await snapshot(id);
 await page.screenshot({path:path.join(out,'exit-feet-settled.png'),timeout:540000});
 console.log('PASS actual exit midpoint and settled capture');save();
 const beforeBody=report.checks;
 await playerBodyTest({call,assert,wait:seconds=>call('simulate',seconds),note:s=>report.notes.push(s),
  near:(value,lo,hi,label)=>assert(typeof value==='number'&&value>=lo&&value<=hi,label+': '+value+' outside '+lo+'..'+hi),
  finite:(value,label)=>{let bad=false;const visit=v=>{if(typeof v==='number')bad||=!Number.isFinite(v);else if(v&&typeof v==='object')for(const x of Object.values(v))visit(x);};visit(value);assert(!bad,label+' contains nonfinite values');}});
 report.playerBodyAssertions=report.checks-beforeBody;
 console.log('PASS unchanged full player-body hybrid',report.playerBodyAssertions);save();
 report.beforeContext={profile:await call('drawProfile',3),faults:await call('frameFaults')};
 assert(!report.beforeContext.faults.count&&report.beforeContext.profile.triangles>0,'Render fault before deliberate recovery drill');
 await gpuContextTest({call,realWait:seconds=>page.waitForTimeout(seconds*1000),assert,
  note:s=>report.notes.push(s),skip:s=>{throw Error('Unexpected actual GPU test skip: '+s);}});
 report.recovery={gpu:await call('gpuContext'),status:await call('status'),faults:await call('frameFaults')};
 assert(!report.recovery.faults.count&&report.recovery.gpu.losses===1&&report.recovery.gpu.restores===1,'Deliberate context drill did not recover exactly once');
 assert(!report.errors.length,'Console/WebGL errors: '+JSON.stringify(report.errors));
 console.log('PASS actual recovery resume guard',report.checks);
}catch(e){report.failure=e.stack||e.message;console.error(report.failure);process.exitCode=1;}
finally{save();await browser.close();}
