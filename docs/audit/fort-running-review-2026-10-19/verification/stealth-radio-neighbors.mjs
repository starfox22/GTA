import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {launchBrowser} from '../../tools/browser.mjs';
const [mode='after']=process.argv.slice(2),root='/workspace/GTA';
const html=fs.readFileSync(root+'/work/fort-running/candidate.html','utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
let css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const cssFiles=[...fs.readFileSync(root+'/src/shell.html','utf8').matchAll(/\/\* @include ([^ ]+\.css) \*\//g)].map(m=>m[1]);
if(mode==='after')css=cssFiles.map(f=>fs.readFileSync(root+'/'+f,'utf8')).join('\n');
const start=html.indexOf('    const CLEAR_MARGIN = '),end=html.indexOf('    /* The player on screen',start);
function fn(name){const s=html.indexOf('    function '+name+'(');return html.slice(s,html.indexOf('\n    }',s)+6)}
const measurement=html.slice(start,end)+'\n'+fn('clearBoxesMeet')+'\n'+fn('measureMissionCard');
const hudStart=html.indexOf('    <!-- HUD. Layout and motion'),hudEnd=html.indexOf('    <div class="overlay" id="menu">',hudStart),hud=html.slice(hudStart,hudEnd);
const report={pass:false,mode,category:'Native DOM fixture of actual production HUD markup/CSS and measureMissionCard. No world rendering or gameplay claim.',frozenHtmlSha256:sha(html),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),cssSha256:sha(css),cases:[],failures:[]};
const {browser}=await launchBrowser({label:'stealth-radio-layout-'+mode});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.setContent('<style>'+css+'\n*,*::before,*::after{animation:none!important;transition:none!important}</style><body>'+hud+'</body>');
 await page.addScriptTag({content:`(()=>{let viewportWidth=innerWidth,viewportHeight=innerHeight;const getElement=id=>document.getElementById(id),hudNow=()=>10;${measurement};window.measureStealth=(s)=>{viewportWidth=innerWidth;viewportHeight=innerHeight;document.body.className=s.touch?'touch-mode roof-stealth':'roof-stealth';document.body.classList.toggle('chase-view',s.view==='chase');document.body.style.setProperty('--hud-dock-top',s.dock+'px');document.body.style.removeProperty('--touch-dispatch-top');const el=getElement;el('stealthStatus').style.display='block';el('stealthLabel').textContent=s.state==='run'?'SUSPICION RISING · SLOW DOWN':'SUSPICION FADING · KEEP WALKING';el('stealthHint').textContent=s.state==='run'?'WALK WITHIN 4s · RELEASE SHIFT':'WALK TO BLEND IN · SHIFT TO RUN';el('stealthFill').style.width='31%';el('radioCaption').textContent=s.long?'DISPATCH · Suspicious individual reported near the headquarters entrance. All patrols stay alert.':'CONTROL · ALL UNITS STAND BY';el('radioCaption').classList.add('show');el('pager').classList.remove('hidden');el('pager').classList.toggle('compact',s.compact);el('missionTitle').textContent='Borrowed Stripes';el('missionObjective').textContent='RECORDS OFFICE · WALK LIKE YOU BELONG';el('missionText').textContent='Walk calmly to the records office. Running raises suspicion.';el('navTitle').textContent='RECORDS OFFICE · WALK LIKE YOU BELONG';el('navDistance').textContent='OBJECTIVE · 83 m';el('navigation').style.display='flex';el('district').textContent='FORT SENTINEL';el('streetName').textContent='SENTINEL AVENUE';el('storyLine').classList.add('show');el('storyLine').textContent='VINNY: Walk calmly to Records. You have a few seconds to slow down when soldiers spot you running.';el('touchControls').classList.toggle('hidden',!s.touch);for(const id of ['touchRadio','touchStation','touchPoison','touchDivert','touchSkip'])el(id).classList.add('hidden');for(const id of ['touchMap','touchWeapon','touchReload','touchRun'])el(id).classList.remove('hidden');for(let i=0;i<3;i++){cardClear.measuredAt=-1;measureMissionCard()}const rect=id=>{const r=el(id).getBoundingClientRect();return{l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}};const stealth=rect('stealthStatus'),radio=rect('radioCaption'),overlap={w:Math.max(0,Math.min(stealth.r,radio.r)-Math.max(stealth.l,radio.l)),h:Math.max(0,Math.min(stealth.b,radio.b)-Math.max(stealth.t,radio.t))};const neighbors=['navigation','pager','minimapBox','quickKeys','storyLine','weaponButton','touchMap','touchWeapon','touchReload','touchRun','moveStick','aimStick'].filter(id=>{const e=el(id),c=getComputedStyle(e),r=rect(id);return !e.closest('.hidden')&&c.display!=='none'&&c.visibility!=='hidden'&&r.w>0&&r.h>0&&Math.min(r.r,radio.r)-Math.max(r.l,radio.l)>.5&&Math.min(r.b,radio.b)-Math.max(r.t,radio.t)>.5}).map(id=>({id,rect:rect(id)}));return{stealth,radio,overlap,neighbors,dispatchTop:document.body.style.getPropertyValue('--touch-dispatch-top'),onscreen:[stealth,radio].every(r=>r.l>=0&&r.r<=innerWidth&&r.t>=0&&r.b<=innerHeight)}}})();`});
 for(const size of [[1280,800,false],[1000,700,false],[960,600,false],[390,844,true],[844,390,true]]){
  const[width,height,touch]=size;await page.setViewportSize({width,height});
  for(const view of ['street','chase'])for(const state of ['run','recovery'])for(const long of [false,true])for(const compact of [true,false])for(const dock of touch?[72]:[72,100]){
   const scenario={width,height,touch,view,state,long,compact,dock},result=await page.evaluate(s=>measureStealth(s),scenario),entry={...scenario,...result};report.cases.push(entry);
   if(result.overlap.w>.5&&result.overlap.h>.5||!result.onscreen||result.neighbors.length)report.failures.push(entry);
  }
 }
 report.pass=report.failures.length===0;
}finally{await browser.close();fs.writeFileSync(root+'/work/fort-running/stealth-radio-neighbors-'+mode+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,cases:report.cases.length,failed:report.failures.length,examples:report.failures.slice(0,4)}));}
if(!report.pass)process.exitCode=1;
