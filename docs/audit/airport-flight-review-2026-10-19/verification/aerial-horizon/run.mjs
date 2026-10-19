import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import test from '../../tools/tests/aerial-city-horizon.mjs';
const source=fs.readFileSync('tools/test.mjs','utf8');
const notes=[];
const scope=vm.createContext({ notes, Failure:class Failure extends Error {}, Skipped:class Skipped extends Error {} });
const api=vm.runInContext(source.slice(source.indexOf('function makeApi(notes) {'),source.indexOf('\nasync function waitReady()'))+'\nmakeApi(notes)',scope);
let assertions=0;
for(const name of ['assert','near']) { const original=api[name]; api[name]=(...args)=>{assertions++;return original(...args)}; }
await test(api);
const files=['src/chase-view3d.js','src/chase-view3d-far.js','src/render3d-frame.js','src/render3d-statics.js','src/lighting3d-look.js','src/aerial-haze3d.js','tools/tests/aerial-city-horizon.mjs','tools/test.mjs'];
const hashes=Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
console.log(JSON.stringify({passed:true,assertions,harness:'actual makeApi from tools/test.mjs; inclusive near(value,lo,hi,label)',notes,hashes},null,2));
