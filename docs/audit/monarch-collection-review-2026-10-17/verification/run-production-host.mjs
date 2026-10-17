import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
process.env.GTA_MONARCH_PACK ??= '/workspace/GTA/assets/monarch-vehicle-models.bin';
const {default:run}=await import(pathToFileURL(process.argv[2]||'/workspace/GTA/tools/tests/monarch-vehicle-assets.mjs'));
let assertions=0;
await run({assert(value,message){assertions++;assert.ok(value,message);},note:console.log});
console.log('PASS '+assertions);
