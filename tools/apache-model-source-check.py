#!/usr/bin/env python3
"""Independent all-source-corner Apache receipt; downloaded source is required, no browser/GPU."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import vehicle_models as vm

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=root / 'work/military-combat-review/apache-asset/source')
parser.add_argument('--pack', type=Path, default=root / 'assets/apache-model.bin')
parser.add_argument('--out', type=Path)
args = parser.parse_args()
raw = args.pack.read_bytes()
assert raw[:8] == b'DECAP001'
length = struct.unpack('<I', raw[8:12])[0]
h = json.loads(raw[12:12 + length]); base = 12 + length
types = {'f4': '<f4', 'u1': 'u1', 'u4': '<u4'}
a = {k: np.frombuffer(raw, dtype=types[t], count=n, offset=base + off) for k, (t, off, n) in h['arrays'].items()}
g = vm.Gltf(str(args.source / 'scene.gltf')); ps = vm.load_primitives(g)
assert h['source'] == g.js['asset']['extras'] and h['materials'] == g.js['materials']
sourceP = np.concatenate([p['P'][p['index']] for p in ps])
sourceN = np.concatenate([p['N'][p['index']] for p in ps])
sourceUV = np.concatenate([(p['UV'] if p['UV'] is not None else np.zeros((len(p['P']), 2)))[p['index']] for p in ps])
sourceM = np.concatenate([np.full(len(p['index']), p['material']) for p in ps])
expected_ids = np.concatenate([np.arange(sum(len(q['index']) for q in ps[:i]), sum(len(q['index']) for q in ps[:i + 1])) for i, p in enumerate(ps) if not p['node'].startswith('Plane')])
R = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]])
expectedP = (sourceP - np.array(h['origin'])) @ R.T * h['scale']
expectedN = sourceN @ R.T
t = -np.pi / 18
C = np.array([[np.cos(t), -np.sin(t), 0], [np.sin(t), np.cos(t), 0], [0, 0, 1]])
seen, errors, counters = [], dict(position=0., normal=0., uv=0.), {}
for name in ['body', 'beacon', 'rotor', 'tail', 'gun', 'barrel', 'payload']:
    I = a[name + '.i'].reshape(-1, 3)
    ids = a[name + '.source']; slots = a[name + '.s'][I[:, 0]]
    selected = slots < 8 if name == 'payload' else np.ones(len(I), dtype=bool)
    ids = ids[selected]; idx = I[selected]; seen.extend(ids.tolist())
    P = a[name + '.p'].reshape(-1, 3)[idx].astype(float)
    N = a[name + '.n'].reshape(-1, 3)[idx].astype(float)
    if name == 'rotor': P = P @ C.T; N = N @ C.T
    P += h['origins'][name]
    errors['position'] = max(errors['position'], float(np.abs(P - expectedP[ids]).max()))
    errors['normal'] = max(errors['normal'], float(np.abs(N - expectedN[ids]).max()))
    errors['uv'] = max(errors['uv'], float(np.abs(a[name + '.uv'].reshape(-1, 2)[idx] - sourceUV[ids]).max()))
    assert np.all(a[name + '.m'][idx] == sourceM[ids, None]), name + ' altered source material assignment'
    counters[name] = len(ids)
assert np.array_equal(np.sort(seen), expected_ids), 'source faces lost or duplicated'
assert len(seen) == 220711 and max(errors.values()) < .000002, errors
far = sum(v['triangles'] for k, v in h['parts'].items() if k.endswith('Far'))
assert far <= 15000 and h['parts']['shadow']['triangles'] <= 5000
assert h['retainedSourceTriangles'] == len(seen) and h['addedAirTriangles'] == 1936
record = dict(passed=True, retainedSourceTriangles=len(seen), originalAircraftCorners=len(seen) * 3,
              errorsMetresAndUnitNormalsUV=errors, parts=counters, farTriangles=far,
              shadowTriangles=h['parts']['shadow']['triangles'], sourceHasTextures=bool(g.js.get('images')),
              packBytes=len(raw), packSHA256=hashlib.sha256(raw).hexdigest(),
              sourceGltfSHA256=hashlib.sha256((args.source / 'scene.gltf').read_bytes()).hexdigest(),
              sourceBufferSHA256=hashlib.sha256((args.source / 'scene.bin').read_bytes()).hexdigest())
if args.out:
    args.out.parent.mkdir(parents=True, exist_ok=True); args.out.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
