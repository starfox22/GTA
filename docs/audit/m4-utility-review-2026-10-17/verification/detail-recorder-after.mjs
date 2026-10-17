// Native HIGH M4 detail views on clear airport pavement, separate from the matched LOW performance tour.
// node tools/m4-utility-detail-review.mjs FROZEN_HTML OUTPUT [before|after]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from './browser.mjs';
const [input,directory,label='after']=process.argv.slice(2);
if(!input||!directory||!['before','after'].includes(label))throw Error('Frozen HTML, output directory and optional before|after required');
const html=path.resolve(input),out=path.resolve(directory),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={label,htmlSha256:hash(fs.readFileSync(html)),recorderSha256:hash(fs.readFileSync(new URL(import.meta.url))),
  fixture:{viewport:[1000,700],seed:1,position:[418,6000],heading:0,quality:'high',weather:'clear',clock:13},
  inputs:[],captures:[],errors:[],warnings:[]};
const named=new Set(['status','holdSimulation','god','graphics','sky','setClock','settings','look','drive','placeVehicle',
  'viewMode','closeUp','inspectView','hitchRun','vehicleAt','vehicleById','cameraView','frameFaults','gpuContext','military',
  'dentVehicle','damageReport','burnVehicle','launch']);
const save=()=>fs.writeFileSync(path.join(out,'capture-detail-'+label+'.json'),JSON.stringify(report,null,2)+'\n');
const{browser}=await launchBrowser({label:'m4-utility-detail',args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1000,height:700}});
page.setDefaultTimeout(480000);
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
async function calls(rows){
  for(const[m,a]of rows){if(!named.has(m))throw Error('Undeclared method '+m);report.inputs.push([m,a]);}
  return page.evaluate(rows=>rows.map(([m,a])=>window.DeadEndCity[m](...a)),rows);
}
async function shot(name,inspection){
  await calls([['inspectView',inspection],['hitchRun',[1/60,[],1,false,true]],['settings',[{}]]]);
  await page.mouse.move(998,0);await page.waitForTimeout(4500);
  const values=await calls([['settings',[{}]],['status',[]],['cameraView',[]],['frameFaults',[]],['gpuContext',[]],['damageReport',[]]]);
  const[,status,camera,faults,gpu,damage]=values;
  const vehicle=damage;
  if(status.renderer!=='3d'||status.vehicle!=='jeep'||vehicle?.type!=='jeep'||faults.count||gpu.lost||report.errors.length)throw Error('Invalid M4 detail state '+name);
  await page.waitForFunction(()=>{const e=document.getElementById('carRadio');return e.classList.contains('hidden')||(!e.classList.contains('open')&&!e.matches(':hover,:focus-within')&&e.getBoundingClientRect().width<200&&e.getBoundingClientRect().height<60);});
  const file='m4-utility-'+label+'-'+name+'.png';
  await page.screenshot({path:path.join(out,file),timeout:480000});
  report.captures.push({file,sha256:hash(fs.readFileSync(path.join(out,file))),inspection,status,camera,faults,gpu,vehicle,damage});save();console.log('Captured',file);
}
try{
  console.log('Opening M4 HIGH detail',label);
  await page.goto('file://'+html+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:480000});
  await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');
  await page.mouse.move(998,0);await page.click('#startBtn');
  await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));
  if((await calls([['status',[]]]))[0].mode==='dialogue')await page.click('#callDecline');
  await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
  await calls([['holdSimulation',[true]],['god',[true]],['graphics',['high']],['sky',['clear']],['setClock',[13]],
    ['settings',[{sound:false,fps:false,gps:false,minimapFolded:true,keyHints:false,lookAhead:0,radioVolume:0}]],
    ['look',[418,6000,3]],['drive',['jeep',0,0]],['placeVehicle',[418,6000,0]],['viewMode',['street']],
    ['closeUp',[11]],['inspectView',[65,12,4]],['hitchRun',[.25,[],1,false,false]],['hitchRun',[1/60,[],1,false,true]],
    ['hitchRun',[1.3,[],1,false,false]]]);
  await shot('detail',[65,12,4]);await shot('round-wheels',[0,8,3]);
  const id=report.captures[0].vehicle.id,
    [puncture]=await calls([['dentVehicle',[id,'right',130,1.38]]]);
  if(!puncture.flatTires.includes('frontRight'))throw Error('Collision did not puncture the visible front tyre');
  await calls([['launch',[6]],['hitchRun',[.1,[],1,false,false]]]);
  await shot('punctured-rim',[0,8,3]);
  const flat=report.captures.at(-1).damage;
  if(!flat.flatTires.includes('frontRight'))throw Error('Punctured tyre disappeared before capture');
  const repaired=await calls([['burnVehicle',[id,0,true]],['placeVehicle',[418,6000,0]],
    ['hitchRun',[.1,[],1,false,false]],['hitchRun',[1/60,[],1,false,true]],
    ['damageReport',[]],['frameFaults',[]],['gpuContext',[]]]);
  report.repair={damage:repaired[4],faults:repaired[5],gpu:repaired[6]};
  if(report.repair.damage.flatTires.length||report.repair.faults.count||report.repair.gpu.lost||report.errors.length)throw Error('M4 puncture repair failed');
  report.pass=true;save();
}catch(e){report.pass=false;report.failure=e.stack||String(e);save();console.error(report.failure);process.exitCode=1;}
finally{await browser.close();}
