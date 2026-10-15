// Matched native parking layouts and an isolated hotrod. No frame retouching.
// node tools/aircraft-parking-render-review.mjs FROZEN_HTML OUTPUT LABEL
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from './browser.mjs';
import {pathToFileURL} from 'node:url';
export async function runAircraftParkingReview({html:input,out:directory,label,page:existingPage}) {
const html=path.resolve(input),out=path.resolve(directory),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={label,htmlSha256:sha(fs.readFileSync(html)),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),
 fixture:{seed:1,time:13,weather:'clear',viewport:[1000,700],crop:[130,80,740,500],hotrod:[418,7300],tier:'high',held:true},captures:[],errors:[],warnings:[]};
const owned=!existingPage, launched=owned?await launchBrowser({label:'parking-review-'+label,args:['--autoplay-policy=no-user-gesture-required']}):null,
 browser=launched?.browser, page=existingPage||await browser.newPage({viewport:{width:1000,height:700}});
await page.setViewportSize({width:1000,height:700});
page.setDefaultTimeout(480000);
const onError=e=>report.errors.push(e.stack||e.message);page.on('pageerror',onError);
const onConsole=m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/i.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());};page.on('console',onConsole);
const allowed=new Set(['status','holdSimulation','god','graphics','sky','setClock','wanted','settings','look','drive','placeVehicle','viewMode','closeUp','inspectView','hitchRun','airfields','cameraView','gpuContext','frameFaults','hotrodAssets','carModels','vehicleAt','vehiclesNear']);
async function batch(rows){for(const[n]of rows)if(!allowed.has(n))throw Error('Undeclared action '+n);return page.evaluate(rows=>rows.map(([n,a])=>window.DeadEndCity[n](...a)),rows);}
const call=async(n,...a)=>(await batch([[n,a]]))[0], draw=['hitchRun',[1/60,[],1,false,true]], age=['hitchRun',[1.3,[],1,false,false]];
const save=()=>fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n');
async function shot(name,fixture){
 const state=await page.evaluate(()=>{const a=window.DeadEndCity;return{status:a.status(),camera:a.cameraView(),gpu:a.gpuContext(),faults:a.frameFaults(),quality:a.graphics(),airfields:a.airfields(),hotrodAssets:a.hotrodAssets?.()??null,models:a.carModels(true)};});
 if(state.status.renderer!=='3d'||state.gpu.lost||state.gpu.losses||state.faults.count)throw Error('Invalid GPU state '+name);
 const target=path.join(out,name+'.png');await page.screenshot({path:target,clip:{x:130,y:80,width:740,height:500},timeout:480000});
 report.captures.push({name,fixture,...state,pngSha256:sha(fs.readFileSync(target))});save();console.log('shot',name);
}
try{
 if(owned){
 console.log('boot',label);
 await page.goto('file://'+html+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:480000});
 await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');await page.click('#startBtn');
 await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));if((await call('status')).mode==='dialogue')await page.click('#callDecline');
 await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
 }
 await batch([['holdSimulation',[true]],['god',[true]],['graphics',['high']],['sky',['clear']],['setClock',[13]],['wanted',[0]],['settings',[{cameraView:'street',sound:false,gps:false,minimapFolded:true,keyHints:false,playerRing:false,motionBlur:false,lookAhead:0,radioVolume:0}]]]);
 await page.mouse.move(998,0);
 for(const[name,x,y,zoom,yaw,pitch]of[['southport-parking',700,4950,.65,20,50],['oceanview-parking',4780,9510,.4,0,60]]){
  await batch([['look',[x,y,zoom]],['viewMode',['street']],['inspectView',[yaw,pitch,0]],['setClock',[13]],draw,draw]);
  await shot(name,{x,y,zoom,yaw,pitch,lift:0});
 }
 await batch([['look',[418,7300,3]],['drive',['hotrod',0,0]],['placeVehicle',[418,7300,0]],['viewMode',['street']],['closeUp',[11]],['setClock',[13]],draw,age,draw]);
 report.hotrodIdentity=await call('vehicleAt',418,7300);save();
 for(const[name,yaw,pitch]of[['front',65,12],['side',0,9]]){
  await batch([['inspectView',[yaw,pitch,4]],draw,draw]);await shot('hotrod-isolated-'+name,{x:418,y:7300,a:0,zoom:11,yaw,pitch,lift:4});
 }
 report.pass=report.errors.length===0;save();console.log('complete',report.captures.length,'images; errors',report.errors.length);
}catch(e){report.pass=false;report.failure=e.stack||String(e);save();console.error(report.failure);if(owned)process.exitCode=1;}finally{page.off('pageerror',onError);page.off('console',onConsole);if(owned)await browser.close();}
return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [html,out,label]=process.argv.slice(2);await runAircraftParkingReview({html,out,label});
}
