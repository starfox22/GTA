// Native, matched SVJ captures against immutable game HTML; named game actions only.
// node tools/svj-bike-render-review.mjs HTML OUT before|after [--bike]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from './browser.mjs';
const [input, directory, label] = process.argv.slice(2);
if (!input || !directory || !['before','after'].includes(label)) throw Error('HTML, OUT, before|after required');
const html=path.resolve(input),out=path.resolve(directory),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={label,htmlSha256:hash(fs.readFileSync(html)),recorderSha256:hash(fs.readFileSync(new URL(import.meta.url))),
  fixture:{viewport:[1000,700],seed:1,origin:[418,6000],heading:0,quality:'high',clock:13,weather:'clear',held:true},
  inputs:[],captures:[],errors:[],warnings:[]};
const {browser}=await launchBrowser({label:'svj-bike-review-'+label,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1000,height:700}});
page.setDefaultTimeout(480000);
page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
const named=new Set(['status','holdSimulation','god','graphics','sky','setClock','wanted','settings','look','drive','placeVehicle',
  'viewMode','closeUp','inspectView','hitchRun','vehicleAt','vehicleById','carModels','frameFaults','gpuContext','cameraView',
  'assetCars','approvedAssets','sportsAssets','svjAssets','rideInto','wheelieState','wheelieScore','riderReport','bindings','vehicleDoors']);
async function call(method,...args){
  if(!named.has(method))throw Error('Undeclared method '+method);
  report.inputs.push([method,args]);
  return page.evaluate(([m,a])=>typeof window.DeadEndCity[m]==='function'?window.DeadEndCity[m](...a):null,[method,args]);
}
const draw=keys=>call('hitchRun',1/60,keys||[],1,false,true);
const save=()=>fs.writeFileSync(path.join(out,'capture-'+label+'.json'),JSON.stringify(report,null,2)+'\n');
async function shot(name,facts={}){
  // A newly boarded car briefly opens its normal radio panel. Let that HUD
  // timer expire before refreshing it, without hiding or editing the UI.
  await call('settings',{});
  await page.waitForTimeout(4500);
  await call('settings',{});
  await page.waitForFunction(()=>{const el=document.getElementById('carRadio');return el.classList.contains('hidden')||(!el.classList.contains('open')&&!el.matches(':hover,:focus-within'));});
  await page.waitForTimeout(500);
  const state={};
  for(const m of ['status','cameraView','frameFaults','gpuContext','carModels','assetCars','approvedAssets','sportsAssets','svjAssets','wheelieState','wheelieScore'])state[m]=await call(m);
  if(facts.id)state.doors=await call('vehicleDoors',facts.id);
  if(state.status.renderer!=='3d'||state.frameFaults.count||state.gpuContext.lost||report.errors.length)throw Error('Invalid rendered state '+name);
  const file='svj-handling-'+label+'-'+name+'.png';
  await page.screenshot({path:path.join(out,file),timeout:480000});
  report.captures.push({file,sha256:hash(fs.readFileSync(path.join(out,file))),...facts,...state});save();console.log('Captured',file);
}
try{
  console.log('Booting',label);
  await page.goto('file://'+html+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:480000});
  await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');
  await page.click('#startBtn');await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));
  if((await call('status')).mode==='dialogue')await page.click('#callDecline');
  await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
  for(const[m,...args]of [['holdSimulation',true],['god',true],['graphics','high'],['sky','clear'],['setClock',13],['wanted',0],
    ['settings',{sound:false,fps:false,gps:false,minimapFolded:true,keyHints:false,lookAhead:0,radioVolume:0}],
    ['look',418,6000,3],['drive','brutini',0,0],['placeVehicle',418,6000,0],['viewMode','street'],['closeUp',11],
    ['inspectView',65,12,5]])await call(m,...args);
  await page.mouse.move(998,0);
  // The renderer detects boarding on its first draw. Age that observed entry
  // before capturing, so neither comparison catches the player at the door.
  await draw();await call('hitchRun',1.3,[],1,false,false);await draw();await draw();
  const car=await call('vehicleAt',418,6000);
  if(car?.type!=='brutini')throw Error('Wrong SVJ fixture '+JSON.stringify(car));
  report.vehicle=car;save();
  await shot('front',{inspection:[65,12,5],closeUp:11,id:car.id});
  await call('inspectView',245,12,5);await draw();await draw();
  await shot('rear',{inspection:[245,12,5],closeUp:11,id:car.id});
  if(process.argv.includes('--bike')){
    await call('look',418,6000,3);await call('rideInto','bike',50,'none',25,.05);
    await call('closeUp',11);await call('inspectView',18,10,6);
    await call('hitchRun',1.1,['KeyW','WheelieUp'],1,false,false);await draw(['KeyW','WheelieUp']);await draw(['KeyW','WheelieUp']);
    const wheelie=await call('wheelieState');if(!wheelie.onBike||wheelie.deg<8)throw Error('No restored wheelie '+JSON.stringify(wheelie));
    await shot('wheelie',{wheelie});
    await call('rideInto','bike',65,'none',25,.05);await call('hitchRun',.6,['KeyW','KeyD'],1,false,false);
    await call('inspectView',35,12,6);await draw(['KeyW','KeyD']);await draw(['KeyW','KeyD']);
    const turn=await call('wheelieState');if(!turn.onBike||Math.abs(turn.bankDeg)<2)throw Error('No restored corner bank '+JSON.stringify(turn));
    await shot('corner',{turn});
    report.bindings=await call('bindings');
  }
  report.pass=report.errors.length===0;save();
}catch(e){report.pass=false;report.failure=e.stack||String(e);save();console.error(report.failure);process.exitCode=1;}
finally{await browser.close();}
