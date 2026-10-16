// Native settings DOM captures and a real UI remap/reload check; world drawing disabled.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {launchBrowser} from './browser.mjs';
const [input,directory]=process.argv.slice(2),file=path.resolve(input),out=path.resolve(directory),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');fs.mkdirSync(out,{recursive:true});
const report={htmlSha256:sha(file),recorderSha256:sha(new URL(import.meta.url)),fixture:'Native settings DOM with world drawing disabled (?norender),1000x700, default bindings; UI entrance animation allowed to finish.',captures:[],errors:[]};
const {browser}=await launchBrowser({label:'wheelie-bindings-ui'}),p=await browser.newPage({viewport:{width:1000,height:700}});p.setDefaultTimeout(180000);p.on('pageerror',e=>report.errors.push(String(e)));
const url='file://'+file+'?dev&norender&seed=1&hold';
async function open(){await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');await p.evaluate(()=>{window.DeadEndCity.settings({fps:false});window.DeadEndCity.openSettings('controls');});await p.waitForFunction(()=>getComputedStyle(document.querySelector('.settings-panel')).opacity>.99);await p.waitForTimeout(500);}
async function shot(name){const dest=path.join(out,name);await p.screenshot({path:dest});report.captures.push({file:name,sha256:sha(dest),bindings:await p.evaluate(()=>window.DeadEndCity.bindings()),renderer:'DOM settings, world draw disabled'});}
try{
 await open();await shot('wheelie-review-movement-controls.png');
 await p.locator('[data-row="wheelieDown"]').scrollIntoViewIfNeeded();await p.waitForTimeout(250);
 for(const id of ['wheelieUp','wheelieDown'])if(!await p.locator('[data-row="'+id+'"]').isVisible())throw Error('Rider binding hidden');
 await shot('wheelie-review-wheelie-bindings.png');
 await p.locator('[data-row="wheelieUp"] .binding-key').first().click();await p.keyboard.press('Numpad8');
 if((await p.evaluate(()=>window.DeadEndCity.bindings())).wheelieUp[0]!=='Numpad8')throw Error('Real settings key capture failed');
 await open();if((await p.evaluate(()=>window.DeadEndCity.bindings())).wheelieUp[0]!=='Numpad8')throw Error('UI remap did not survive reload');
 report.remapReloadPassed=true;report.pass=report.errors.length===0;
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e);}
finally{fs.writeFileSync(path.join(out,'capture-ui.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({pass:report.pass,captures:report.captures.length,remapReloadPassed:report.remapReloadPassed}));}
