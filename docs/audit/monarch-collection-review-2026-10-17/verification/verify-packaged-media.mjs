import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root=process.cwd(),dir=path.resolve(process.argv[2]),out=process.argv[3];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),context=vm.createContext({window:{}});
const scripts=[...html.matchAll(/<script src="(media\/[^"]+\.js\?sha=[^"]+)"/g)].map(m=>m[1]);
if(!scripts.length)throw Error('No packaged media scripts');
const packs=[];
for(const src of scripts){
 const [file,query]=src.split('?'),bytes=fs.readFileSync(path.join(dir,file));
 if(bytes.length>12000000||new URLSearchParams(query).get('sha')!==hash(bytes))throw Error('Pack bound/hash '+file);
 vm.runInContext(bytes.toString(),context,{filename:file});
 packs.push({file,bytes:bytes.length,sha256:hash(bytes)});
}
const entries=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'))),media=context.window.DEAD_END_CITY_MEDIA,assets=[];
for(const entry of entries){
 const original=fs.readFileSync(path.join(root,entry.file));
 if(entry.stream){
  const copy=fs.readFileSync(path.join(dir,'media',path.basename(entry.file)));
  if(!original.equals(copy))throw Error('Stream bytes '+entry.id);
 }else{
  const url=media[entry.id],prefix='data:'+entry.mime+';base64,';
  if(typeof url!=='string'||!url.startsWith(prefix)||!original.equals(Buffer.from(url.slice(prefix.length),'base64')))throw Error('Reassembly '+entry.id);
 }
 assets.push({id:entry.id,file:entry.file,bytes:original.length,sha256:hash(original),stream:!!entry.stream});
}
const report={pass:true,entrySha256:hash(Buffer.from(html)),recorderSha256:hash(fs.readFileSync(new URL(import.meta.url))),packs,assets};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log('PASS',packs.length,'ordered packs,',assets.length,'exact reconstructed/streamed assets; max pack',Math.max(...packs.map(x=>x.bytes)));
