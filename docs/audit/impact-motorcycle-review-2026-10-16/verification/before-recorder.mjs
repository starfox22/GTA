// Native game captures for the impact/motorcycle review; named developer methods only.
// Usage: node tools/impact-motorcycle-render-review.mjs HTML OUT before|after [--model-only]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';
const [input, directory, label] = process.argv.slice(2);
if (!input || !directory || !['before','after'].includes(label)) throw Error('HTML, OUT and before|after required');
const html = path.resolve(input), out = path.resolve(directory);
fs.mkdirSync(out, {recursive:true});
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const report = {label, htmlSha256:hash(fs.readFileSync(html)), recorderSha256:hash(fs.readFileSync(new URL(import.meta.url))),
  fixture:{viewport:[1000,700],origin:[418,6000],seed:1,tier:'high',clock:13,weather:'clear',simulationHeld:true},captures:[],errors:[],warnings:[]};
const {browser} = await launchBrowser({label:'impact-motorcycle-'+label,args:['--autoplay-policy=no-user-gesture-required']});
const page = await browser.newPage({viewport:{width:1000,height:700}});
page.setDefaultTimeout(480000);
page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
const named = new Set(['status','holdSimulation','god','graphics','sky','setClock','wanted','settings','look','drive','placeVehicle','hitchRun',
  'viewMode','closeUp','inspectView','frameFaults','gpuContext','carModels','vehicleAt','openSettings','chaseCamera','playerModel']);
const call=async(method,...args)=>{if(!named.has(method))throw Error('Undeclared method '+method);return page.evaluate(([m,a])=>window.DeadEndCity[m](...a),[method,args]);};
async function batch(rows){for(const[m]of rows)if(!named.has(m))throw Error('Undeclared method '+m);return page.evaluate(rows=>rows.map(([m,a])=>window.DeadEndCity[m](...a)),rows);}
const draw=()=>call('hitchRun',1/60,[],1,false,true);
const save=()=>fs.writeFileSync(path.join(out,'capture-'+label+'.json'),JSON.stringify(report,null,2));
async function shot(name,extra={},clip={x:130,y:80,width:740,height:500}){
  const state=await page.evaluate(()=>{const a=window.DeadEndCity;return{status:a.status(),faults:a.frameFaults(),gpu:a.gpuContext(),models:a.carModels(true),player:a.playerModel()};});
  if(state.status.renderer!=='3d'||state.faults.count||state.gpu.lost||report.errors.length)throw Error('Invalid render state '+name);
  const file=label+'-'+name+'.png';
  await page.screenshot({path:path.join(out,file),...(clip?{clip}:{}),timeout:480000});
  report.captures.push({file,sha256:hash(fs.readFileSync(path.join(out,file))),...extra,...state});save();console.log('Captured',file);
}
try{
  await page.goto('file://'+html+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:480000});
  await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');
  await page.click('#startBtn');await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));
  if((await call('status')).mode==='dialogue')await page.click('#callDecline');
  await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
  await batch([['holdSimulation',[true]],['god',[true]],['graphics',['high']],['sky',['clear']],['setClock',[13]],['wanted',[0]],
    ['settings',[{sound:false,gps:false,minimapFolded:true,keyHints:false,playerRing:false,motionBlur:false,lookAhead:0,radioVolume:0}]],
    ['look',[418,6000,3]],['drive',['dolcati',0,0]],['placeVehicle',[418,6000,0]],['viewMode',['street']],['closeUp',[12]],['inspectView',[18,10,6]],
    ['hitchRun',[8,[],1,false,false]]]);
  await page.mouse.move(998,0);await draw();await draw();
  const vehicle=await call('vehicleAt',418,6000);
  if(vehicle?.type!=='dolcati')throw Error('Wrong motorcycle fixture');
  await shot('dolcati-side',{id:vehicle.id,inspection:[18,10,6],closeUp:12});
  await call('inspectView',65,14,6);await draw();await draw();
  await shot('dolcati-front',{id:vehicle.id,inspection:[65,14,6],closeUp:12});
  if(!process.argv.includes('--model-only')){
    await call('openSettings','graphics');
    const rows=await page.locator('#settingsBody').innerText();
    if(label==='after'&&/Motion blur/i.test(rows))throw Error('Withdrawn motion blur remains in Settings');
    report.settingsRows=rows;await shot('graphics-settings',{},null);
  }
  report.pass=report.errors.length===0;save();
}catch(e){report.pass=false;report.failure=e.stack||String(e);save();console.error(report.failure);process.exitCode=1;}
finally{await browser.close();}
