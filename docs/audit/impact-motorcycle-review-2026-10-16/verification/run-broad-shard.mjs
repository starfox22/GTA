// Run disjoint, balanced regression shards from an immutable checkout.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const which=Number(process.argv[2]);
if(![0,1].includes(which))throw Error('shard0or1 required');
const files=fs.readdirSync('tools/tests').filter(f=>f.endsWith('.mjs')).sort();
const bins=[[],[]],cost=[0,0];
for(const file of files){
  const source=fs.readFileSync(path.join('tools/tests',file),'utf8');
  const weight=/export const fresh\s*=\s*true/.test(source)?20:5;
  const target=cost[0]<=cost[1]?0:1;bins[target].push(file);cost[target]+=weight;
}
fs.mkdirSync('work',{recursive:true});
fs.writeFileSync('work/suite-shards.json',JSON.stringify({all:files.length,shards:bins,cost},null,2));
console.log('Suite shard',which+1,'/',2,':',bins[which].length,'modules; total',files.length);
const child=spawn(process.execPath,['tools/test.mjs','--exact',...bins[which],'--verbose'],{stdio:'inherit',env:process.env});
child.on('exit',code=>process.exit(code??1));
