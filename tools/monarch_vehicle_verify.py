#!/usr/bin/env python3
"""Verify every packed near corner against its pinned downloaded source.

python3 tools/monarch_vehicle_verify.py recipes.json monarch-vehicle-models.bin --out work/monarch-proof.json

This reads original glTF scene attributes again; it does not trust the Blender
intermediate or infer success from triangle counts. Roles reorder whole faces,
then wheel neutralization and one uniform game fit are the only allowed edits.
"""
import argparse
import json
import struct
from pathlib import Path

import numpy as np

import monarch_vehicle_models as converter


def verify(recipes, pack):
    raw = pack.read_bytes()
    assert raw[:8] == b'DECVM001', 'pack magic'
    header_size = struct.unpack_from('<I', raw, 8)[0]
    header = json.loads(raw[12:12 + header_size]); base = 12 + header_size
    dtypes = dict(f4='<f4', i1='i1', u1='u1', i2='<i2', u2='<u2', u4='<u4')
    def array(key, name, field, size):
        dtype, offset, count = header['arrays'][key + '.' + name + '.' + field]
        return np.frombuffer(raw, dtype=dtypes[dtype], count=count, offset=base + offset).reshape(-1, size)
    results = {}
    for recipe in recipes:
        key = recipe['key']; source = converter.source_model(recipe); model = header['models'][key]
        assert model['sourceSHA256'] == converter.sha(Path(recipe['source'])), key + ': pinned identity'
        lo, extent = np.asarray(model['quant'][:3]), np.asarray(model['quant'][3:])
        position_epsilon = float(extent.max()) / 65534 * .505 + 2e-6
        maxima = dict(position=0., normal=0., uv=0., color=0.)
        corners, faces = 0, 0
        for part, source_faces in source['parts'].items():
            order = sorted(enumerate(source_faces), key=lambda row: source['pane_ids'].get(tuple(row[1]), -1))
            ordered = np.asarray([face for _, face in order], dtype=int)
            expected = {name: np.empty((len(ordered), 3, width)) for name, width in [('p', 3), ('n', 3), ('a', 2), ('o', 2), ('q', 2), ('e', 2), ('c', 4), ('s', 1), ('d', 1), ('l', 1), ('v', 1)]}
            for pi in np.unique(ordered[:, 0]):
                rows = np.flatnonzero(ordered[:, 0] == pi); primitive = source['prims'][pi]
                indices = primitive['index'][ordered[rows, 1]]
                positions, normals = primitive['P'][indices], primitive['N'][indices]
                if part.startswith('wheel'):
                    wheel = source['meta']['wheels'][int(part[5:part.index('.')])]
                    rotation, center = np.asarray(wheel['sourceRotation']), np.asarray(wheel['sourceCenter'])
                    positions = (positions - center) @ rotation.T + center; normals = normals @ rotation.T
                expected['p'][rows] = (positions + source['shift']) * source['scale']
                expected['n'][rows] = normals / np.maximum(np.linalg.norm(normals, axis=2, keepdims=True), 1e-12)
                uv0 = primitive['UV'][indices] if primitive['UV'] is not None else np.full((*indices.shape, 2), .5)
                uv1 = primitive['UV1'][indices] if primitive['UV1'] is not None else uv0
                material = source['g'].js['materials'][primitive['material']]
                for channel, field in [('albedo', 'a'), ('orm', 'o'), ('normal', 'q'), ('emissive', 'e')]:
                    info, _ = converter.texture_info(source['g'], material, channel)
                    coord = info.get('extensions', {}).get('KHR_texture_transform', {}).get('texCoord', info.get('texCoord', 0)) if info else 0
                    expected[field][rows] = converter.transform_uv(uv1 if coord == 1 else uv0, info)
                color = primitive['COLOR'][indices] if primitive['COLOR'] is not None else np.ones((*indices.shape, 4))
                if color.shape[-1] == 3: color = np.concatenate([color, np.ones((*indices.shape, 1))], axis=2)
                expected['c'][rows] = np.clip(color, 0, 1)
                expected['s'][rows] = bool(material.get('doubleSided', False))
                fallback_paint = [source['prims'][primitive_id]['material'] for role in ('shell', 'panels', 'hood') for name in source['meta']['roleParts'][role] for primitive_id, _ in source['parts'][name]]
                paint_ids = set(recipe.get('paintMaterials', fallback_paint))
                paint = primitive['material'] in paint_ids and (part in ('shell', 'panels', 'hood') or part.endswith('.paint'))
                expected['d'][rows] = paint
                expected['l'][rows] = material.get('normalTexture', {}).get('scale', 1.)
                expected['v'][rows] = material.get('alphaCutoff', .5) if material.get('alphaMode') == 'MASK' else -2 if material.get('alphaMode') == 'BLEND' else -1
            packed_index = array(key, part, 'i', 3)
            assert len(packed_index) == len(ordered), key + '.' + part + ': face count'
            for field, width in [('p', 3), ('n', 3), ('a', 2), ('o', 2), ('q', 2), ('e', 2), ('c', 4), ('s', 1), ('d', 1), ('l', 1), ('v', 1)]:
                actual = array(key, part, field, width).astype(float)
                if field == 'p': actual = (actual + 32767) / 65534 * extent + lo
                if field == 'n': actual /= 32767
                if field in ('c', 's', 'd'): actual /= 255
                actual = actual[packed_index]
                error = float(np.max(np.abs(actual - expected[field])))
                epsilon = position_epsilon if field == 'p' else 1 / 32767 * .505 + 1e-6 if field == 'n' else 1 / 255 * .505 + 1e-7 if field == 'c' else 3e-6
                assert np.isfinite(actual).all() and error <= epsilon, f'{key}.{part}.{field}: maxerror{error} >{epsilon}'
                category = 'position' if field == 'p' else 'normal' if field == 'n' else 'color' if field == 'c' else 'uv' if field in ('a', 'o', 'q', 'e') else None
                if category: maxima[category] = max(maxima[category], error)
            far = part + 'Far'; far_index = array(key, far, 'i', 3)
            assert len(far_index) <= len(ordered), key + '.' + part + ': Far budget'
            for field, width in [('p', 3), ('n', 3), ('a', 2), ('o', 2), ('q', 2), ('e', 2)]:
                values = array(key, far, field, width)
                assert np.isfinite(values).all() and (not len(far_index) or far_index.max() < len(values)), key + '.' + far + ': valid arrays'
            faces += len(ordered); corners += len(ordered) * 3
        assert faces == model['sourceTriangles'] == model['triangles'], key + ': source conservation'
        results[key] = dict(sourceSHA256=model['sourceSHA256'], nearFaces=faces, nearCorners=corners, farFaces=model['farTriangles'],
                            maxError=maxima, excludedSceneFaces=model.get('excludedSceneTriangles', 0), textureBudget=model['textureBudget'])
        print(key, faces, 'original faces /', corners, 'corners PASS', flush=True)
    return dict(packSHA256=converter.sha(pack), sourceRecipes=recipes, models=results)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recipes', type=Path); parser.add_argument('pack', type=Path); parser.add_argument('--out', type=Path)
    parser.add_argument('--only', help='comma-separated source keys')
    args = parser.parse_args(); config = json.loads(args.recipes.read_text())
    recipes = config['models'] if isinstance(config, dict) else config
    if args.only: recipes = [recipe for recipe in recipes if recipe['key'] in args.only.split(',')]
    result = verify(recipes, args.pack)
    if args.out: args.out.write_text(json.dumps(result, indent=2))


if __name__ == '__main__': main()
