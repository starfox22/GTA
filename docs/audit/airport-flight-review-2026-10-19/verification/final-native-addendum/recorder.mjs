// Focused native final aviation addendum; named fixtures, unedited full viewport.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from '../../tools/browser.mjs';
const [input,directory]=process.argv.slice(2),file=path.resolve(input),out=path.resolve(directory);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const expectedHtml='ddc04a6eef69d8930ca558a9f02ab1fb7fc4014efed2bbcc75b8113867714f07';
if(sha(fs.readFileSync(file))!==expectedHtml)throw Error('Candidate 4 immutable split HTML pin mismatch');
fs.mkdirSync(out,{recursive:true});
const report={label:'final focused aviation addendum',sourceCommit:'3aecf8a998e269ce5e9f87579d52230afcb543c9',htmlSha256:expectedHtml,
 recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),fixture:{flags:'dev&seed=1&hold&shadercheck',viewport:[1000,700],quality:'high',
 kind:'Staged aircraft exterior and dense-city aerial camera inspection. Not ordinary gameplay, mission completion, or a hardware FPS benchmark.',
 models:'Actual chase camera, front/side three-quarter view at 145 degrees; street inspectView does not apply to aircraft.',
 aerial:'North approach: map heading -PI/2 and actual chase lens heading -90 degrees. Radio popup expires normally in wall time; no DOM hiding.'},
 captures:[],inputs:[],errors:[],warnings:[],pass:false};
const allowed=new Set(['status','holdSimulation','god','graphics','sky','setClock','wetness','wanted','settings','look','drive','placeVehicle','viewMode','hitchRun','cameraView','chaseCamera','chaseLook','flight','launch','airfields','aircraftAssets','jetAssets','frameFaults','gpuContext','drawProfile']);
const {browser}=await launchBrowser({label:'aviation-native-final-addendum',args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1000,height:700}});page.setDefaultTimeout(600000);
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM|VALIDATE_STATUS/i.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text())});
const save=()=>fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n');
async function batch(rows){for(const[n]of rows)if(!allowed.has(n))throw Error('Undeclared named method '+n);report.inputs.push(...rows);save();return page.evaluate(rows=>rows.map(([n,a])=>{const f=window.DeadEndCity[n];if(typeof f!=='function')throw Error('Missing named method '+n);return f.apply(window.DeadEndCity,a)}),rows)}
const call=async(n,...a)=>(await batch([[n,a]]))[0],draw=['hitchRun',[1/60,[],3,false,true]];
async function shot(name,scene){
 await call('settings',{});
 const state=await page.evaluate(()=>{const a=DeadEndCity;return{status:a.status(),quality:a.graphics(),camera:a.cameraView(),chase:a.chaseCamera(),flight:a.flight(),gpu:a.gpuContext(),faults:a.frameFaults(),models:a.aircraftAssets(),jets:a.jetAssets(),draws:a.drawProfile()}});
 if(state.status.renderer!=='3d'||state.quality.tier!=='HIGH'||state.faults.count||state.gpu.losses||state.gpu.lost||report.errors.length)throw Error('Native graphics fault '+name+': '+JSON.stringify({state,errors:report.errors}));
 if(!state.chase.live||!state.chase.view?.active)throw Error('Actual chase lens inactive '+name);
 const expected=scene.expectedHeading,actual=state.chase.yawDeg;
 if(Math.abs(((actual-expected+540)%360)-180)>3)throw Error('Incorrect actual lens heading '+name+': '+actual+' versus '+expected);
 const filename=name+'.png';await page.screenshot({path:path.join(out,filename),timeout:600000});
 report.captures.push({file:filename,sha256:sha(fs.readFileSync(path.join(out,filename))),scene,...state});save();
 console.log('CAPTURE',name,JSON.stringify({heading:state.chase.yawDeg,pitch:state.chase.pitchDeg,boom:state.chase.boomMetres,agl:state.flight?.aglM,drawMetres:state.chase.view.drawMetres,farCells:state.chase.view.farCells}));
}
try{
 console.log('BOOT',report.htmlSha256);
 await page.goto('file://'+file+'?'+report.fixture.flags,{waitUntil:'domcontentloaded',timeout:600000});
 await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');await page.click('#startBtn');await page.waitForFunction(()=>DeadEndCity.status().mode==='play');
 await batch([['holdSimulation',[true]],['god',[true]],['graphics',['high']],['sky',['clear']],['setClock',[13]],['wetness',[0]],['wanted',[0]],['settings',[{sound:false,fps:false,gps:false,minimapFolded:true,keyHints:false,playerRing:false,playerOutline:false,lookAhead:0,radioVolume:0}]]]);
 console.log('READY');
 for(const[name,airframe]of[['01-courier-three-quarter-high','courier'],['02-airliner-three-quarter-high','airliner']]){
  await batch([['viewMode',['street']],['look',[418,6500,1]],['drive',['plane',0,0,airframe]],['placeVehicle',[418,6500,0]],['hitchRun',[1,[],3,false,false]]]);
  report.inputs.push(['wall-clock radio popup expiry',[8500]]);save();await page.waitForTimeout(8500);
  await batch([['viewMode',['chase']],['chaseLook',[0,0,145,14]],draw,['chaseLook',[0,0,145,14]],draw]);
  await shot(name,{category:'Staged exterior enclosure inspection',airframe,origin:[418,6500],aircraftHeadingRadians:0,expectedHeading:145,pitchRequestedDegrees:14});
 }
 for(const[name,altitude,clock]of[['03-dense-city-north-300m-high',300,13],['04-dense-city-north-dusk-400m-high',400,19]]){
  await batch([['viewMode',['street']],['setClock',[clock]],['drive',['plane',0,-Math.PI/2,'courier']],['placeVehicle',[2000,6000,-Math.PI/2,altitude]],['launch',[65]],['viewMode',['chase']],['chaseLook',[0,0,-90,14]],draw,['chaseLook',[0,0,-90,14]],draw]);
  await shot(name,{category:'Staged dense-city aerial approach',airframe:'courier',origin:[2000,6000],altitudeMetres:altitude,clock,aircraftHeadingRadians:-Math.PI/2,expectedHeading:-90,pitchRequestedDegrees:14});
 }
 report.pass=report.errors.length===0&&report.captures.length===4;save();console.log('COMPLETE',JSON.stringify({pass:report.pass,captures:report.captures.length,errors:report.errors}));if(!report.pass)process.exitCode=1;
}catch(e){report.failure=e.stack||String(e);report.pass=false;save();console.error(report.failure);process.exitCode=1;}
finally{await browser.close();save();}
