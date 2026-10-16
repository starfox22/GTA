// Native rendered evidence: production controls, real wheelie metres and named rider-fall fixtures.
// Usage: node tools/wheelie-rider-render-review.mjs HTML OUT
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';
const [input,directory] = process.argv.slice(2);
if (!input || !directory) throw Error('HTML and OUT required');
const html=path.resolve(input),out=path.resolve(directory);
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={htmlSha256:hash(fs.readFileSync(html)),recorderSha256:hash(fs.readFileSync(new URL(import.meta.url))),
  viewport:[1000,700],seed:1,quality:'high',clock:13,weather:'clear',simulationHeld:true,captures:[],inputs:[],errors:[],warnings:[]};
const {browser}=await launchBrowser({label:'wheelie-rider-review',args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1000,height:700}});
page.setDefaultTimeout(480000);
page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
const named=new Set(['status','holdSimulation','graphics','sky','setClock','wanted','settings','look','viewMode','closeUp','inspectView',
  'rideInto','simulate','hitchRun','wheelieState','wheelieScore','riderReport','riderFallScene','riderFallAdvance','god',
  'openSettings','bindings','frameFaults','gpuContext','playerModel','carModels','approvedAssets']);
const call=async(method,...args)=>{
  if(!named.has(method))throw Error('Undeclared method '+method);
  report.inputs.push([method,args]);
  return page.evaluate(([m,a])=>window.DeadEndCity[m](...a),[method,args]);
};
const draw=keys=>call('hitchRun',.1,keys||[],1,false,true);
const save=()=>fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2));
async function shot(name,extra={}){
  // Refresh normal HUD state after slow software rendering lets popovers expire.
  await call('settings',{});
  const state=await page.evaluate(()=>{const a=window.DeadEndCity;return{status:a.status(),faults:a.frameFaults(),gpu:a.gpuContext(),player:a.playerModel(),wheelie:a.wheelieState(),score:a.wheelieScore(),fall:a.riderReport(),models:a.carModels(true)};});
  if(state.status.renderer!=='3d'||state.faults.count||state.gpu.lost||report.errors.length)throw Error('Invalid render state '+name);
  const file='wheelie-review-'+name+'.png';
  await page.screenshot({path:path.join(out,file),timeout:480000});
  report.captures.push({file,sha256:hash(fs.readFileSync(path.join(out,file))),...extra,...state});save();console.log('Captured',file);
}
try{
  console.log('Booting native wheelie/rider review');
  await page.goto('file://'+html+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:480000});
  await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');
  await page.click('#startBtn');await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));
  if((await call('status')).mode==='dialogue')await page.click('#callDecline');
  await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
  for(const[m,...args]of [['holdSimulation',true],['graphics','high'],['sky','clear'],['setClock',13],['wanted',0],
    ['settings',{sound:false,fps:false,gps:false,minimapFolded:true,keyHints:false,lookAhead:0,radioVolume:0}],
    ['look',418,6000,3],['rideInto','bike',50,'none',25,.05],['viewMode','street'],['closeUp',4.5],['inspectView']])await call(m,...args);
  await page.mouse.move(998,0);
  // Both achievements are crossed by actual forward simulation, never by setting score.
  for(const [metres,name] of [[101,'great-100m'],[201,'amazing-200m']]){
    let score=await call('wheelieScore'),ticks=0;
    while(score.distanceM<metres&&ticks++<100){await call('hitchRun',.2,['KeyW','WheelieUp'],1,false,false);score=await call('wheelieScore');if(!(await call('wheelieState')).onBike)throw Error('Wheelie crashed before milestone');}
    if(score.distanceM<metres||score.tier!==(metres===101?1:2))throw Error('Actual wheelie did not cross '+metres+': '+JSON.stringify(score));
    await draw(['KeyW','WheelieUp']);await draw(['KeyW','WheelieUp']);
    // Freeze the native UI animation at its own 350 ms keyframe for a legible
    // screenshot; no score, pose, pixels or game state are altered by this.
    await page.evaluate(()=>{for(const a of document.getAnimations())if(a.effect?.target?.closest?.('#wheelieScore')){a.currentTime=350;a.pause();}});
    await shot(name,{animationFrameMs:350});
  }
  await call('hitchRun',1.8,['KeyW','WheelieDown'],1,false,false);await draw();await draw();
  const landed=await call('wheelieScore');if(landed.phase!=='result'||landed.reason!=='landed')throw Error('No landed wheelie result: '+JSON.stringify(landed));
  await shot('landed-result');
  await call('hitchRun',4.1,[],1,false,false);
  await call('closeUp',10);
  await call('rideInto','bike',65,'none',25,.05);await call('hitchRun',.85,['KeyW','KeyD'],1,false,false);
  await call('inspectView',35,12,6);await draw(['KeyW','KeyD']);await draw(['KeyW','KeyD']);
  const corner=await call('wheelieState');if(!corner.onBike||Math.abs(corner.bankDeg)<12)throw Error('No physical corner bank');
  await shot('corner-lean');
  await call('riderFallScene','lowside','bike',45,1);await call('riderFallAdvance',.25);await call('inspectView',18,10,6);await call('closeUp',8);await draw();await draw();
  await shot('lowside-release');
  let fall=await call('riderFallAdvance',0),steps=0;
  while(fall.thrown?.phase!=='recover'&&steps++<80)fall=await call('riderFallAdvance',.05);
  if(fall.thrown?.phase!=='recover')throw Error('No recovery stage '+JSON.stringify(fall));
  await call('riderFallAdvance',.35);await draw();await draw();await shot('supported-recovery');
  await call('openSettings','controls');
  const movement=await page.locator('[data-row="forward"]').innerText();
  if(!movement.includes('W')||movement.includes('↑'))throw Error('Default acceleration binding is wrong: '+movement);
  await shot('movement-controls',{movement});
  const riderRow=page.locator('[data-row="wheelieUp"]');await riderRow.scrollIntoViewIfNeeded();
  const bindings=await call('bindings'),rows=await page.locator('[data-row="wheelieUp"], [data-row="wheelieDown"]').allTextContents();
  if(!rows[0].includes('↑')||!rows[1].includes('↓'))throw Error('Wheelie bindings missing from Settings');
  await shot('wheelie-bindings',{rows,bindings});
  report.pass=report.errors.length===0;save();
}catch(e){report.pass=false;report.failure=e.stack||String(e);save();console.error(report.failure);process.exitCode=1;}
finally{await browser.close();}
