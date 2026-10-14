import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {launchBrowser} from '../tools/browser.mjs';
const html=path.resolve(process.argv[2]), out=path.resolve(process.argv[3]);
const original=fs.readFileSync('tools/tests/monarch-garages.mjs','utf8');
let candidate=original.replace("      await t.realWait(2);", "      await t.realWait(2);\n      await t.call('holdSimulation', true);");
candidate=candidate.replace("    let r = await t.call('steerTo', side.x, side.y - 34, 15, 14);", "    let r;\n    // Miramar's north-facing forecourt SUV needs a short open-space alignment\n    // before the straight-line pilot turns near its 48-unit frontage opening.\n    if (g.villa === 'VILLA MIRAMAR') {\n      r = await t.call('steerTo', side.x, car.y - 12, 15, 7);\n      t.assert(r && r.reason === 'arrived', g.villa + ': could not align with the side gate: ' + JSON.stringify(r));\n    }\n    r = await t.call('steerTo', side.x, side.y - 34, 15, 14);");
if(candidate===original||!candidate.includes('could not align'))throw Error('Candidate edits not applied');
const proposedFullSource=candidate;
if(process.argv.includes('--focus')){candidate=candidate.replace('  let first = true;\n  for (const g of garages) {', "  let first = true;\n  await t.call('holdSimulation', true);\n  for (const g of []) {");candidate=candidate.replace('garages.filter((o) => o.sideGate)', "garages.filter((o) => o.sideGate && ['VILLA TOSCANA','VILLA MIRAMAR'].includes(o.villa))");}
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const report={htmlSha256:sha(fs.readFileSync(html)),originalTestSha256:sha(original),proposedTestSha256:sha(candidate),proposedFullTestSha256:sha(proposedFullSource),focused:process.argv.includes('--focus'),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),assertions:0,pilots:[],errors:[],notes:[]};
fs.writeFileSync(out+'.proposed-test.mjs',proposedFullSource);
const named=new Set(['status','holdSimulation','god','villaGarages','vehicleEntrances','teleport','interact','steerTo','pose','integrity','frameFaults','simulate']);
const {browser}=await launchBrowser({label:'villa-waypoint-probe'});
const page=await browser.newPage({viewport:{width:960,height:600}});page.setDefaultTimeout(120000);
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('pageerror',e=>report.errors.push(e.stack||e.message));
const namedCall=(name,...args)=>{if(!named.has(name))throw Error('Undeclared '+name);return page.evaluate(([name,args])=>window.DeadEndCity[name](...args),[name,args])};
const api={
 async call(name,...args){let before;if(name==='steerTo')before=await namedCall('pose');const result=await namedCall(name,...args);
 if(name==='steerTo'){const row={args,before,result,after:await namedCall('pose')};report.pilots.push(row);console.log('pilot',JSON.stringify(row));if(result.reason!=='arrived'){await namedCall('holdSimulation',true);row.garages=await namedCall('villaGarages');row.integrity=await namedCall('integrity')}}return result;},
 wait:s=>namedCall('simulate',s,[]),realWait:s=>page.waitForTimeout(s*1000),
 async keys(codes,s,{real=false}={}){codes=[].concat(codes);if(!real)return namedCall('simulate',s,codes);for(const key of codes)await page.keyboard.down(key);await page.waitForTimeout(s*1000);for(const key of codes)await page.keyboard.up(key);return namedCall('status')},
 assert(ok,message){report.assertions++;if(!ok)throw Error(message)},near(v,lo,hi,message){this.assert(v>=lo&&v<=hi,message)},finite(v,message){this.assert(Number.isFinite(v),message)},note:m=>report.notes.push(m)
};
try{await page.goto('file://'+html+'?dev&norender',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');await page.click('#startBtn');await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));if((await namedCall('status')).mode==='dialogue')await page.click('#callDecline');await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');await page.waitForTimeout(1000);
console.log('booted');const run=(await import('data:text/javascript;base64,'+Buffer.from(candidate).toString('base64'))).default;await run(api);report.frameFaults=await namedCall('frameFaults');if(report.errors.length||report.frameFaults.count)throw Error('Page errors/framefaults');report.status='PASS';console.log('PASS full monarch-garages proposed valid route',report.assertions,'assertions');}
catch(e){report.status='FAIL';report.failure=e.stack||e.message;console.error(report.failure);process.exitCode=1}
finally{await browser.close();report.browserClosed=true;fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n')}
