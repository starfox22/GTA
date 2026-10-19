// Native aviation baseline/candidate recorder. Named game fixtures only; full unedited viewport.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from '../../tools/browser.mjs';
const [input,directory,label='review']=process.argv.slice(2),file=path.resolve(input),out=path.resolve(directory);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={label,htmlSha256:sha(fs.readFileSync(file)),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),fixture:{flags:'dev&seed=1&hold&shadercheck',viewport:[1000,700],quality:'high',clock:13,weather:'clear',kind:'Staged airport/aircraft/camera inspection; not ordinary flight or mission completion'},captures:[],inputs:[],errors:[],warnings:[],pass:false};
const allowed=new Set(['status','holdSimulation','god','graphics','sky','setClock','wetness','wanted','settings','look','drive','placeVehicle','viewMode','closeUp','inspectView','hitchRun','cameraView','chaseCamera','chaseLook','flight','airfields','aircraftAssets','jetAssets','frameFaults','gpuContext','drawProfile','parachuteState','parachuteView','bailOut','openParachute']);
const {browser}=await launchBrowser({label:'aviation-native-'+label,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1000,height:700}});page.setDefaultTimeout(600000);
page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM|VALIDATE_STATUS/i.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text())});
const save=()=>fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n');
async function batch(rows){for(const[n]of rows)if(!allowed.has(n))throw Error('Undeclared named method '+n);report.inputs.push(...rows);save();return page.evaluate(rows=>rows.map(([n,a])=>{const f=window.DeadEndCity[n];if(typeof f!=='function')throw Error('Missing named method '+n);return f(...a)}),rows)}
const call=async(n,...a)=>(await batch([[n,a]]))[0],draw=['hitchRun',[1/60,[],3,false,true]],age=['hitchRun',[1.2,[],3,false,false]];
async function shot(name,scene){
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
 for(const[name,x,y,zoom,yaw,pitch]of[['01-southport-airport',700,4950,.65,20,50],['02-oceanview-airport',4780,9510,.4,0,60]]){
  await batch([['viewMode',['street']],['look',[x,y,zoom]],['inspectView',[yaw,pitch,0]],draw,draw]);await shot(name,{x,y,zoom,yaw,pitch});
 }
 for(const[name,airframe,zoom,yaw,pitch]of[['03-courier-exterior','courier',5,55,17],['04-airliner-exterior','airliner',1.7,55,17]]){
  await batch([['viewMode',['street']],['look',[418,6500,1]],['drive',['plane',0,0,airframe]],['placeVehicle',[418,6500,0]],['closeUp',[zoom]],['inspectView',[yaw,pitch,12]],draw,age,draw]);await shot(name,{airframe,zoom,yaw,pitch});
 }
 for(const[name,altitude]of[['05-city-flight-180m',180],['06-city-flight-600m',600]]){
  await batch([['viewMode',['street']],['look',[3000,3400,1]],['inspectView',[]],['drive',['plane',altitude,0,'courier']],['viewMode',['chase']],['chaseLook',[0,0,0,14]],draw,draw]);await shot(name,{altitude,heading:0,pitch:14,origin:[3000,3400]});
 }
 report.pass=report.errors.length===0;save();console.log('COMPLETE',JSON.stringify({pass:report.pass,captures:report.captures.length,errors:report.errors}));
 if(!report.pass)process.exitCode=1;
}catch(e){report.failure=e.stack||String(e);report.pass=false;save();console.error(report.failure);process.exitCode=1;}
finally{await browser.close();save();}
