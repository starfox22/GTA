#!/usr/bin/env python3
"""Convert Polyte's CC-BY-4.0 Low Poly RPG-7 without changing its near faces/normals/materials.

Download https://codeload.github.com/Jeh3no/Godot-simple-FPS-weapon-system/zip/a7bd56c978c1abe1894e6b3822f8826f0a119cfb
then run python3 tools/rocket_launcher_model.py downloaded.zip.
The original Sketchfab glTF export and original licence are included in that mirror.
Only the far copy is simplified. No textures are authored in this source.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile

import numpy as np

import vehicle_models as vm

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://sketchfab.com/3d-models/low-poly-rpg-7-de967b52c9794d2995d4606749fcdff7'
MIRROR = 'https://codeload.github.com/Jeh3no/Godot-simple-FPS-weapon-system/zip/a7bd56c978c1abe1894e6b3822f8826f0a119cfb'
# Native z is forward, y up, x left. Metres come from the 0.95 m unloaded tube.
SCALE = 0.95 * 8 / (8.67 - -16.4)
# Measured middle of the source front pistol grip, beside its trigger/guard.
FIRE = np.array([0., -3.05, 2.20])
SUPPORT = np.array([0., -2.70, -1.475])


def convert(path, output):
    archive = zipfile.ZipFile(path)
    gltf_name = next(n for n in archive.namelist() if n.endswith('/low_poly_rpg-7/scene.gltf'))
    base = str(Path(gltf_name).parent)
    source_gltf = archive.read(gltf_name)
    binary = archive.read(base + '/scene.bin')
    licence = archive.read(base + '/license.txt').decode()
    expected = {'scene.gltf': '04804ab6c4e1d457895557da6a013a12cc8754611543070a6b1547d8e1e369f8',
                'scene.bin': 'b7e0453f4b966b3e8e89dd60f71dd7f45e04376e60623155e0db90a47fd1893c'}
    assert hashlib.sha256(source_gltf).hexdigest() == expected['scene.gltf'], 'unexpected source glTF'
    assert hashlib.sha256(binary).hexdigest() == expected['scene.bin'], 'unexpected source geometry'
    assert 'Polyte' in licence and 'CC-BY-4.0' in licence
    data = json.loads(source_gltf)
    assert not data.get('images') and not data.get('textures')

    def accessor(i):
        a = data['accessors'][i]
        v = data['bufferViews'][a['bufferView']]
        size = {'SCALAR': 1, 'VEC3': 3}[a['type']]
        assert v.get('byteStride', size * (4 if a['componentType'] != 5123 else 2)) == size * (4 if a['componentType'] != 5123 else 2)
        return np.frombuffer(binary, dtype={5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']],
                             offset=v.get('byteOffset', 0) + a.get('byteOffset', 0), count=a['count'] * size).reshape(-1, size)

    def point(p):
        v = (p - FIRE)[..., [2, 1, 0]] * SCALE
        v[..., 2] *= -1
        return v

    def normal(n):
        v = n[..., [2, 1, 0]].copy()
        v[..., 2] *= -1
        return v

    # The two source coordinate conversion nodes cancel exactly: all source meshes
    # are identity in glTF world space. Assert that contract rather than ignore transforms.
    def visit(i, parent):
        node = data['nodes'][i]
        m = np.array(node.get('matrix', np.eye(4).flatten(order='F'))).reshape(4, 4, order='F')
        world = parent @ m
        if 'mesh' in node:
            assert np.allclose(world, np.eye(4), atol=1e-12)
        for child in node.get('children', []):
            visit(child, world)
    for node in data['scenes'][data.get('scene', 0)]['nodes']:
        visit(node, np.eye(4))

    arrays = {}
    lods = {}
    for lod in ['near', 'far']:
        positions, normals, colors, finishes, indices = [], [], [], [], []
        offset = 0
        for mesh in data['meshes']:
            for primitive in mesh['primitives']:
                assert primitive.get('mode', 4) == 4
                p = point(accessor(primitive['attributes']['POSITION']))
                n = normal(accessor(primitive['attributes']['NORMAL']))
                index = accessor(primitive['indices']).reshape(-1, 3).astype(int)
                if lod == 'far':
                    # Weld only this far copy's coincident vertices for the QEM topology;
                    # near retains every original split normal and exact face.
                    _, used, weld = np.unique(np.round(p, 6), axis=0, return_index=True, return_inverse=True)
                    p, n, index = p[used], n[used], weld[index]
                    used, index = vm.decimate(p, index, 0.16, 0.8)
                    p, n = p[used], n[used]
                material = data['materials'][primitive['material']]['pbrMetallicRoughness']
                positions.append(p)
                normals.append(n)
                colors.append(np.tile(material.get('baseColorFactor', [1, 1, 1, 1])[:3], (len(p), 1)))
                finishes.append(np.tile([material.get('roughnessFactor', 1), material.get('metallicFactor', 1)], (len(p), 1)))
                indices.append(np.asarray(index) + offset)
                offset += len(p)
        attrs = {'position': np.concatenate(positions).astype('<f4'), 'normal': np.concatenate(normals).astype('<f4'),
                 'color': np.concatenate(colors).astype('<f4'), 'rocketFinish': np.concatenate(finishes).astype('<f4'),
                 'index': np.concatenate(indices).astype('<u2')}
        for name, values in attrs.items():
            arrays[lod + '_' + name] = values
        lods[lod] = {'vertices': offset, 'triangles': len(attrs['index']),
                     'bounds': [attrs['position'].min(0).tolist(), attrs['position'].max(0).tolist()]}
    assert lods['near']['triangles'] == 3500
    assert lods['far']['triangles'] <= 1100, lods['far']
    header = {'format': 1, 'title': 'Low Poly RPG-7', 'author': 'Polyte', 'licence': 'CC-BY-4.0',
              'source': SOURCE, 'mirror': MIRROR, 'metresToUnits': 8, 'lods': lods,
              'materials': data['materials'], 'sourceMeshes': len(data['meshes']),
              'anchors': {'fire': [0, 0, 0], 'support': point(SUPPORT).tolist(),
                          'tubeExit': point(np.array([0., 0., 8.67])).tolist(),
                          'roundTip': point(np.array([0., 0., 17.37])).tolist(),
                          'backblast': point(np.array([0., 0., -16.4])).tolist()},
              'conversion': {'scale': SCALE, 'sourceGrip': FIRE.tolist(), 'nearGeometry': 'All authored faces, positions and split normals; rigid axis change and uniform scale only',
                             'materials': 'Linear source baseColorFactor, metallicFactor and roughnessFactor per vertex; double sided as source',
                             'farGeometry': 'Per source mesh, welded QEM edge collapse; source vertices/normals retained'},
              'sourceHashes': {'scene.gltf': hashlib.sha256(source_gltf).hexdigest(), 'scene.bin': hashlib.sha256(binary).hexdigest()}, 'arrays': {}}
    payload = bytearray()
    for name, values in arrays.items():
        while len(payload) % 4:
            payload.append(0)
        header['arrays'][name] = ['u2' if name.endswith('_index') else 'f4', len(payload), values.size]
        payload.extend(values.tobytes())
    text = json.dumps(header, separators=(',', ':')).encode()
    text += b' ' * (-(12 + len(text)) % 4)
    result = b'DECRPG01' + struct.pack('<I', len(text)) + text + payload
    output.write_bytes(result)
    proof = {k: v for k, v in header.items() if k != 'arrays'}
    proof['assetSHA256'] = hashlib.sha256(result).hexdigest()
    proof['sourceLicence'] = licence
    proof['archiveSHA256'] = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    proof_path = ROOT / 'docs/audit/military-combat-review-2026-10-20/bazooka-source.json'
    proof_path.parent.mkdir(parents=True, exist_ok=True)
    proof_path.write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps({'output': str(output), 'bytes': len(result), 'lods': lods, 'anchors': header['anchors']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('zip', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / 'assets/rocket-launcher-model.bin')
    args = parser.parse_args()
    convert(args.zip, args.out)
