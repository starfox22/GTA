import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.cwd(),dir=path.join(root,'tools/tests'),outfile=path.join(root,'work/general-review/host-suite.json');
const report={kind:'Production host regressions; no browser or graphics performance measurement',started:new Date().toISOString(),tests:[],pass:true};
for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.mjs')).sort()){
 const file=path.join(dir,name),source=fs.readFileSync(file,'utf8');
 if(/t\.(call|keys|reload)\(/.test(source))continue;
 const row={name,assertions:0,notes:[],pass:false},start=performance.now();
 const t={assert(c,m){row.assertions++;if(!c)throw Error(m);},near(v,lo,hi,m){t.assert(typeof v==='number'&&v>=lo&&v<=hi,`${m}: ${v} outside [${lo},${hi}]`);},finite(v,m){const check=(x,p)=>{if(x==='NaN'||x==='Infinity'||x==='-Infinity'||typeof x==='number'&&!Number.isFinite(x))throw Error('Nonfinite '+p);if(x&&typeof x==='object')for(const[k,y]of Object.entries(x))check(y,p+'.'+k);};check(v,m);row.assertions++;},note(s){row.notes.push(s);},skip(s){throw Error('Unexpected host skip: '+s);}};
 try{await(await import(pathToFileURL(file))).default(t);row.pass=true;}catch(e){row.error=e.stack;report.pass=false;}
 row.ms=Math.round(performance.now()-start);report.tests.push(row);fs.writeFileSync(outfile,JSON.stringify(report,null,2)+'\n');console.log(`${row.pass?'PASS':'FAIL'} ${name} ${row.assertions} assertions ${row.ms}ms${row.error?' '+row.error.split('\n')[0]:''}`);
}
report.completed=new Date().toISOString();report.assertions=report.tests.reduce((s,t)=>s+t.assertions,0);fs.writeFileSync(outfile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,tests:report.tests.length,assertions:report.assertions}));process.exitCode=report.pass?0:1;
