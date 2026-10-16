// Production CSS layout fixture: milestone/dispatch coexistence and reduced motion.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {launchBrowser} from './browser.mjs';
const [file,out]=process.argv.slice(2),html=fs.readFileSync(file,'utf8'),style=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n'),
  widget=fs.readFileSync('src/ui/hud.html','utf8').match(/<aside id="wheelieScore"[\s\S]*?<\/aside>/)[0].replace('aria-hidden="true"','class="on" aria-hidden="false"');
const {browser}=await launchBrowser({label:'wheelie-score-layout'}),p=await browser.newPage(),results=[];
try{
 for(const [name,width,height,touch]of [['desktop',1000,700,false],['phone',390,844,true],['landscape',740,390,true]]){
  await p.setViewportSize({width,height});await p.setContent('<style>'+style+'</style><body class="'+(touch?'touch-mode':'')+'"><div id="hud">'+widget+'</div><div id="radioCaption" class="show">DISPATCH · Officers responding to a vehicle incident.</div>');
  await p.evaluate(()=>{document.getElementById('wheelieScoreDistance').textContent='201';document.getElementById('wheelieScoreGrade').textContent='Amazing!';});
  const boxes=await p.evaluate(()=>{const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};return{meter:box('wheelieScore'),caption:box('radioCaption')};});
  if(boxes.meter.bottom>boxes.caption.y-2||boxes.meter.x<0||boxes.meter.x+boxes.meter.width>width)throw Error(name+' overlapping/outside viewport '+JSON.stringify(boxes));
  await p.emulateMedia({reducedMotion:'reduce'});const motion=await p.evaluate(()=>{const e=document.getElementById('wheelieScore');e.dataset.celebrate='b';return[getComputedStyle(e).animationName,getComputedStyle(document.getElementById('wheelieScoreGrade')).animationName,getComputedStyle(e,'::after').animationName];});
  if(motion.some(m=>m!=='none'))throw Error('Reduced motion still animates');
  results.push({name,width,height,...boxes,reducedMotion:motion});
 }
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({pass:true,htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),fixture:'Production stylesheet and wheelie HUD with a synthetic dispatch caption; layout only, no simulated gameplay.',results},null,2)+'\n');console.log('PASS wheelie/dispatch layout and reduced motion in3 viewports');
}finally{await browser.close();}
