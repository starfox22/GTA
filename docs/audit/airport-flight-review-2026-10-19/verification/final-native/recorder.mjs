// Native aviation baseline/candidate recorder. Named game fixtures only; full unedited viewport.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from '../../tools/browser.mjs';
const [input,directory,label='review']=process.argv.slice(2),file=path.resolve(input),out=path.resolve(directory);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={label,htmlSha256:sha(fs.readFileSync(file)),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),fixture:{flags:'dev&seed=1&hold&shadercheck',viewport:[1000,700],quality:'high',clock:13,weather:'clear',renderWarmup:'Main and reserve use .8 simulated seconds of real Low rendering before returning to High; no pose injection. Cutaway captured .12 simulated seconds after edge.',kind:'Staged airport/aircraft/camera inspection; not ordinary flight or mission completion'},captures:[],inputs:[],errors:[],warnings:[],pass:false};
const allowed=new Set(['status','holdSimulation','god','graphics','sky','setClock','wetness','wanted','settings','look','drive','placeVehicle','viewMode','closeUp','inspectView','hitchRun','cameraView','chaseCamera','chaseLook','flight','launch','airfields','aircraftAssets','jetAssets','frameFaults','gpuContext','drawProfile','parachuteState','parachuteView','bailOut','openParachute']);
const {browser}=await launchBrowser({label:'aviation-native-'+label,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1000,height:700}});page.setDefaultTimeout(600000);
page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM|VALIDATE_STATUS/i.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text())});
const save=()=>fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n');
async function batch(rows){for(const[n]of rows)if(!allowed.has(n))throw Error('Undeclared named method '+n);report.inputs.push(...rows);save();return page.evaluate(rows=>rows.map(([n,a])=>{const f=window.DeadEndCity[n];if(typeof f!=='function')throw Error('Missing named method '+n);return f.apply(window.DeadEndCity,a)}),rows)}
const call=async(n,...a)=>(await batch([[n,a]]))[0],draw=['hitchRun',[1/60,[],3,false,true]],age=['hitchRun',[1.2,[],3,false,false]];
async function shot(name,scene){
 await call('settings',{}); // Refresh the real HUD after a staged move; no DOM hiding or image edits.
 const state=await page.evaluate(()=>{const a=DeadEndCity;return{status:a.status(),quality:a.graphics(),camera:a.cameraView(),chase:a.chaseCamera(),flight:a.flight(),gpu:a.gpuContext(),faults:a.frameFaults(),models:a.aircraftAssets(),jets:a.jetAssets?.()??null,draws:a.drawProfile(),parachute:a.parachuteState(),canopy:a.parachuteView()}});
 if(state.status.renderer!=='3d'||state.quality.tier!=='HIGH'||state.faults.count||state.gpu.losses||state.gpu.lost)throw Error('Invalid native state '+name);
 const filename=name+'.png';await page.screenshot({path:path.join(out,filename),timeout:600000});
 report.captures.push({file:filename,sha256:sha(fs.readFileSync(path.join(out,filename))),scene,...state});save();console.log('CAPTURE',name,JSON.stringify({far:state.chase?.view?.farMetres,flight:state.flight?.aglM,draws:state.draws?.calls}));
}
try{
 console.log('BOOT',label,report.htmlSha256);
 await page.goto('file://'+file+'?'+report.fixture.flags,{waitUntil:'domcontentloaded',timeout:600000});
 await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');await page.click('#startBtn');await page.waitForFunction(()=>DeadEndCity.status().mode==='play');
 await batch([['holdSimulation',[true]],['god',[true]],['graphics',['high']],['sky',['clear']],['setClock',[13]],['wetness',[0]],['wanted',[0]],['settings',[{sound:false,fps:false,gps:false,minimapFolded:true,keyHints:false,playerRing:false,playerOutline:false,lookAhead:0,radioVolume:0}]]]);
 console.log('READY');
 for(const[name,x,y,zoom,yaw,pitch,lift]of[['01-southport-terminal',1060,4860,1.05,25,23,24],['02-oceanview-terminal',4300,8900,.62,-20,25,32]]){
  await batch([['viewMode',['street']],['look',[x,y,zoom]],['inspectView',[yaw,pitch,lift]],draw,draw]);await shot(name,{x,y,zoom,yaw,pitch,lift,category:'airport architecture inspection'});
 }
 for(const[name,airframe,zoom,yaw,pitch]of[['03-courier-exterior','courier',5,55,17],['04-airliner-exterior','airliner',1.7,55,17]]){
  await batch([['viewMode',['street']],['look',[418,6500,1]],['drive',['plane',0,0,airframe]],['placeVehicle',[418,6500,0]],['closeUp',[zoom]],['inspectView',[yaw,pitch,12]],draw,age,draw]);await shot(name,{airframe,zoom,yaw,pitch});
 }
 for(const[name,altitude]of[['05-city-flight-180m',180],['06-city-flight-600m',600]]){
  await batch([['viewMode',['street']],['look',[3000,3400,1]],['inspectView',[]],['drive',['plane',altitude,0,'courier']],['viewMode',['chase']],['chaseLook',[0,0,0,14]],draw,draw]);await shot(name,{altitude,heading:0,pitch:14,origin:[3000,3400]});
 }
 // A dense-city approach supplements the matched county/horizon views above.
 for(const[name,x,y,heading,altitude,clock]of[
  ['07-downtown-flight',2000,6000,-Math.PI/2,300,13],
  ['08-city-flight-west',-1000,2200,0,450,13],
  ['09-downtown-dusk',2000,6000,-Math.PI/2,400,19]]) {
  await batch([['setClock',[clock]],['placeVehicle',[x,y,heading,altitude]],['launch',[65]],['chaseLook',[0,0,0,14]],draw,draw]);
  await shot(name,{origin:[x,y],heading,altitude,clock,category:'Staged dense-city aerial approach'});
 }
 await batch([['setClock',[13]],['bailOut',[1200,3000,3400,0]],['viewMode',['chase']],['chaseLook',[0,0,0,10]],['hitchRun',[.3,[],3,false,false]]]);
 const key=async(code,down)=>{report.inputs.push(['physical '+(down?'down':'up'),[code]]);save();await page.keyboard[down?'down':'up'](code)};
 await key('KeyJ',true);await call('hitchRun',6,[],3,false,false);
 let chute=await call('parachuteState');if(chute?.canopy!=='main'||chute.phase!=='open')throw Error('Held main pull did not finish flying safely: '+JSON.stringify(chute));
 await batch([['graphics',['low']],['hitchRun',[.8,[],3,false,true]],['graphics',['high']],draw,draw]);await shot('10-main-parachute',{input:'physical J held through main inflation',expected:'main open'});
 await key('KeyJ',false);await call('hitchRun',.1,[],3,false,false);await key('KeyJ',true);await call('hitchRun',.12,[],3,false,false);
 chute=await call('parachuteState');if(chute?.stage!=='freefall'||!chute.cutaway||!chute.reserveAvailable)throw Error('Fresh J cutaway/held freefall failed: '+JSON.stringify(chute));
 await batch([draw,draw]);let rig=await call('parachuteView');if(!rig?.cutawayVisible)throw Error('Released main canopy missing from native scene');await shot('11-main-cutaway',{input:'release J, fresh press, hold',expected:'freefall and detached main'});
 await key('KeyJ',false);await call('hitchRun',.1,[],3,false,false);await key('KeyJ',true);await call('hitchRun',3.2,[],3,false,false);
 chute=await call('parachuteState');if(chute?.canopy!=='reserve'||chute.phase!=='open'||!chute.reserveUsed)throw Error('Fresh J reserve failed: '+JSON.stringify(chute));
 await batch([['graphics',['low']],['hitchRun',[.8,[],3,false,true]],['graphics',['high']],draw,draw]);await shot('12-reserve-parachute',{input:'release J, fresh press, hold',expected:'white/teal reserve open'});await key('KeyJ',false);
 report.pass=report.errors.length===0;save();console.log('COMPLETE',JSON.stringify({pass:report.pass,captures:report.captures.length,errors:report.errors}));
 if(!report.pass)process.exitCode=1;
}catch(e){report.failure=e.stack||String(e);report.pass=false;save();console.error(report.failure);process.exitCode=1;}
finally{await browser.close();save();}
