import fs from 'node:fs';
import run from '../../tools/tests/aircraft-flight-model.mjs';
let assertions = 0;
const notes = [];
try {
  await run({
    assert: (ok, message) => { assertions++; if (!ok) throw Error(message); },
    near: (v, lo, hi, message) => {
      assertions++;
      if (!(v >= lo && v <= hi)) throw Error(`${message}: ${v} outside [${lo}, ${hi}]`);
    },
    note: message => notes.push(message),
  });
  const result = { status: 'PASS', assertions, notes };
  fs.writeFileSync(new URL('model-host.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, assertions }));
} catch (error) {
  const result = { status: 'FAIL', assertions, error: String(error), stack: error.stack, notes };
  fs.writeFileSync(new URL('model-host.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  process.exitCode = 1;
}
