#!/usr/bin/env python3
"""Replay a read-only diagnostic without modifying the canonical test or source."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
manifest = json.loads((HERE / 'hashes.json').read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
canonical = ROOT / manifest['canonicalFixture']['path']
assert sha(canonical.read_bytes()) == manifest['canonicalFixture']['sha256'], 'Canonical fixture changed'
for name, expected in manifest['productionSources'].items():
    assert sha((ROOT / 'src' / (name + '.js')).read_bytes()) == expected, name + ' changed'
for name, expected in manifest['localEvidence'].items():
    assert sha((HERE / name).read_bytes()) == expected, name + ' changed'
(ROOT / 'dist').mkdir(exist_ok=True)
with tempfile.NamedTemporaryFile(dir=ROOT / 'dist', suffix='.mjs', delete=False) as file:
    fixture = Path(file.name)
try:
    subprocess.run(['patch', '--silent', '--output', str(fixture), str(canonical)],
                   input=(HERE / 'diagnostic.patch').read_text(), text=True, check=True)
    fixture.write_text(fixture.read_text().replace('../../', '../'))
    assert sha(fixture.read_bytes()) == manifest['generatedDistFixtureSha256'], 'Fixture reconstruction differs'
    if '--verify-only' in sys.argv:
        print('PASS hashes and exact executed diagnostic fixture reconstruction')
    else:
        runner = r'''
import fs from 'node:fs';
const fixture = process.argv[1], out = process.argv[2];
const test = (await import(fixture)).default;
const receipt = {purpose:'Read-only native hood repair versus detached debris diagnosis',checks:0,notes:[]};
try {
  await test({assert:(ok,message)=>{receipt.checks++;if(!ok)throw Error(message);},
    note:value=>{if(value.includes('hoodRepairDiagnosis'))receipt.notes.push(JSON.parse(value));}});
  receipt.pass=true;
} catch(error) { receipt.pass=false;receipt.failure=error.stack; }
fs.writeFileSync(out, JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
if(!receipt.pass)process.exitCode=1;
'''
        output = ROOT / 'dist' / 'hood-diagnosis-replay.json'
        subprocess.run(['node', '--input-type=module', '-e', runner,
                        fixture.as_uri(), str(output)], cwd=ROOT, check=True)
finally:
    fixture.unlink(missing_ok=True)
