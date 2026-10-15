#!/usr/bin/env python3
"""Verify both original jet sources against independently decoded DECVM001 data.

python3 tools/jet_models_verify.py SOURCE_DIR PACK OUTPUT.json [--receipt RECEIPT.json]

No renderer is needed. Close parts must partition every original triangle exactly
once and reconstruct its positions, authored split normals and UVs in neutral
pose. Far parts may only use surviving close vertices. Source attribution/hashes,
the native Citation image and the conversion ownership receipt are also checked.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import struct

import numpy as np

import jet_models as converter
import vehicle_models as vm


DTYPES = {'i1': 'i1', 'u1': 'u1', 'i2': '<i2', 'u2': '<u2',
          'u4': '<u4', 'f4': '<f4'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def read_pack(path):
    raw = path.read_bytes()
    require(raw[:8] == b'DECVM001', 'Invalid jet pack signature')
    length = struct.unpack_from('<I', raw, 8)[0]
    base = 12 + length
    require(base <= len(raw) and base % 4 == 0, 'Invalid header size/alignment')
    header = json.loads(raw[12:base])
    arrays, occupied = {}, []
    for name, (kind, offset, count) in header['arrays'].items():
        require(kind in DTYPES and offset >= 0 and count >= 0,
                'Invalid array descriptor: ' + name)
        dtype = np.dtype(DTYPES[kind])
        end = base + offset + count * dtype.itemsize
        require((base + offset) % dtype.itemsize == 0 and end <= len(raw),
                'Invalid array bounds/alignment: ' + name)
        arrays[name] = np.frombuffer(raw, dtype=dtype, count=count, offset=base + offset)
        if count:
            occupied.append((offset, end - base, name))
    occupied.sort()
    for previous, current in zip(occupied, occupied[1:]):
        require(previous[1] <= current[0], 'Overlapping pack arrays: ' + current[2])
    return raw, header, arrays


def original_geometry(source, model):
    """Frame math intentionally does not use converter.normalise/to_game_frame."""
    citation = model == 'jet'
    path = source / ('citation2.glb' if citation else 'southwest737/scene.gltf')
    gltf = vm.Gltf(str(path))
    require(all('NORMAL' in p['attributes'] for mesh in gltf.js['meshes']
                for p in mesh['primitives'] if p.get('mode', 4) == 4),
            model + ': source authored normals absent; generated normals are not a substitute')
    primitives = vm.load_primitives(gltf)
    matrix = np.diag([-1., 1., -1.]) if citation else np.array(
        [[0., 0., 1.], [0., 1., 0.], [-1., 0., 0.]])
    raw_positions = np.concatenate([p['P'] for p in primitives])
    scale = 14.75 / np.ptp(raw_positions[:, 2]) if citation else .01
    transformed = raw_positions @ matrix.T * scale
    low, high = transformed.min(0), transformed.max(0)
    shift = np.array([-(low[0] + high[0]) / 2, -low[1], -(low[2] + high[2]) / 2])
    for primitive in primitives:
        primitive['P'] = primitive['P'] @ matrix.T * scale + shift
        primitive['N'] = primitive['N'] @ matrix.T
        require(np.isfinite(primitive['P']).all() and np.isfinite(primitive['N']).all(),
                model + ': non-finite source attributes')
        require(np.all(np.linalg.norm(primitive['N'], axis=1) > 1e-12),
                model + ': zero source normal')
    return gltf, primitives, scale, shift


def vertex_records(arrays, prefix):
    columns = [arrays[prefix + '.p'].reshape(-1, 3),
               arrays[prefix + '.n'].reshape(-1, 3),
               arrays[prefix + '.uv'].reshape(-1, 2)]
    if prefix + '.c' in arrays:
        columns.append(arrays[prefix + '.c'].reshape(-1, 3))
    return {tuple(row) for row in np.concatenate(columns, axis=1)}


def verify_model(source, pack, result, model, arrays, receipt):
    name = model['type']
    gltf, original, scale, shift = original_geometry(source, name)
    original_count = sum(len(p['index']) for p in original)
    expected_count = 20131 if name == 'jet' else 162629
    require(original_count == expected_count, name + ': unexpected pinned source triangle count')
    require(abs(model['uniformScale'] - scale) < 1e-12 and
            np.max(np.abs(np.array(model['sourceToGameShift']) - shift)) < 1e-10,
            name + ': changed uniform source frame')
    require(len(original) == len(result['prims']), name + ': source primitive count changed')
    for expected, actual in zip(original, result['prims']):
        require(np.max(np.abs(expected['P'] - actual['P'])) < 1e-10 and
                np.max(np.abs(expected['N'] - actual['N'])) < 1e-10 and
                np.array_equal(expected['index'], actual['index']),
                name + ': converter changed original source transform/normals/indices')
    ownership = Counter(pair for pairs in result['parts'].values() for pair in pairs)
    require(len(ownership) == original_count and all(n == 1 for n in ownership.values()),
            name + ': parts duplicate or omit source triangles')
    for pi, primitive in enumerate(original):
        require(all((pi, ti) in ownership for ti in range(len(primitive['index']))),
                name + ': missing source primitive triangle ownership')
    low, extent = np.array(model['quant'][:3]), np.array(model['quant'][3:])
    position_tolerance = extent / 65534 / 2 + 1e-10
    parts, total, vertices = {}, 0, 0
    max_position, min_normal, max_uv = 0., 1., 0.
    for part_name, pairs in result['parts'].items():
        if not pairs:
            continue
        prefix = name + '.' + part_name
        require(part_name in model['parts'], prefix + ': missing close part')
        info = model['parts'][part_name]
        qp = arrays[prefix + '.p'].reshape(-1, 3)
        qn = arrays[prefix + '.n'].reshape(-1, 3)
        packed_uv = arrays[prefix + '.uv'].reshape(-1, 2)
        float_uv = np.issubdtype(packed_uv.dtype, np.floating)
        uv = packed_uv.astype(float) if float_uv else packed_uv.astype(float) / 65535
        index = arrays[prefix + '.i'].reshape(-1, 3)
        require(len(qp) == len(qn) == len(uv) and len(index) == len(pairs) == info['triangles'],
                prefix + ': malformed attribute or triangle count')
        require(np.all(index < len(qp)), prefix + ': index outside vertex array')
        require(np.all(np.linalg.norm(qn.astype(float), axis=1) > 0), prefix + ': zero packed source normal')
        position = (qp.astype(float) + 32767) / 65534 * extent + low
        normal = qn.astype(float) / 32767
        normal /= np.linalg.norm(normal, axis=1, keepdims=True)
        expected_p, expected_n, expected_uv = [], [], []
        for pi, ti in pairs:
            primitive = original[pi]
            vi = primitive['index'][ti]
            expected_p.append(primitive['P'][vi])
            expected_n.append(primitive['N'][vi])
            expected_uv.append(primitive['UV'][vi] if primitive['UV'] is not None else np.zeros((3, 2)))
        expected_p, expected_n, expected_uv = map(np.array, (expected_p, expected_n, expected_uv))
        errors = np.abs(position[index] - expected_p)
        dot = np.sum(normal[index] * expected_n, axis=2)
        uv_error = np.abs(uv[index] - expected_uv)
        require(np.all(errors <= position_tolerance), prefix + ': source position/corner order changed')
        require(np.min(dot) > .99999999, prefix + ': authored source split normal changed')
        uv_tolerance = 1e-8 if float_uv else .5 / 65535 + 1e-12
        require(np.max(uv_error) <= uv_tolerance, prefix + ': original source UV changed/clipped')
        # An independent binary reader is compared with the converter's deduplication
        # reference as well as the source triangle/corner reconstruction above.
        gp, gn, guv, colors, gi, source_ids = converter.gather(result, pairs)
        require(np.array_equal(index, gi) and len(qp) == len(gp), prefix + ': gathered vertex ownership changed')
        require(np.array_equal(qp, np.round((gp - low) / extent * 65534 - 32767).astype('<i2')) and
                np.array_equal(qn, np.round(gn * 32767).astype('<i2')),
                prefix + ': packed positions/normals differ from conversion reference')
        expected_packed_uv = guv.astype('<f4') if float_uv else np.round(guv * 65535).astype('<u2')
        require(np.array_equal(packed_uv, expected_packed_uv),
                prefix + ': packed UV differs from source reference')
        if len(colors):
            require(np.array_equal(arrays[prefix + '.c'].reshape(-1, 3), colors),
                    prefix + ': original/neutralized source color mismatch')
        record = receipt['parts'][part_name]
        require(record['sourceVertexIdsSha256'] == sha256(source_ids.astype('<i4').tobytes()) and
                record['sourceTriangleOwnershipSha256'] == sha256(np.array(pairs, dtype='<i4').tobytes()),
                prefix + ': source ownership receipt mismatch')
        expected_origin = result['meta'].get('hinges', {}).get(part_name, {}).get('a')
        expected_origin = result['meta'].get('gears', {}).get(part_name, {}).get('origin', expected_origin)
        if expected_origin is not None:
            require(np.array_equal(info.get('origin'), expected_origin), prefix + ': neutral rig pivot differs')
        far_name = part_name + 'Far'
        if far_name in model['parts']:
            far_prefix = name + '.' + far_name
            far_p = arrays[far_prefix + '.p'].reshape(-1, 3)
            far_n = arrays[far_prefix + '.n'].reshape(-1, 3)
            far_i = arrays[far_prefix + '.i'].reshape(-1, 3)
            require(np.all(far_i < len(far_p)) and len(far_i) <= len(index), far_prefix + ': invalid far topology')
            require(np.all(np.linalg.norm(far_n.astype(float), axis=1) > 0), far_prefix + ': zero far source normal')
            require(vertex_records(arrays, far_prefix) <= vertex_records(arrays, prefix),
                    far_prefix + ': far vertex attributes fabricated instead of retained from source')
            if expected_origin is not None:
                require(np.array_equal(model['parts'][far_name].get('origin'), expected_origin),
                        far_prefix + ': far neutral rig pivot differs')
        total += len(index)
        vertices += len(qp)
        part_position = float(np.max(errors))
        part_normal = float(np.min(dot))
        part_uv = float(np.max(uv_error))
        max_position, min_normal, max_uv = max(max_position, part_position), min(min_normal, part_normal), max(max_uv, part_uv)
        parts[part_name] = dict(sourceTriangles=len(pairs), packedVertices=len(qp),
                               maxPositionErrorMetres=part_position,
                               minimumAuthoredNormalDot=part_normal, maxOriginalUvError=part_uv)
    require(total == original_count == model['triangles'] == model['originalTriangles'],
            name + ': total close triangle count differs from source')
    require(set(model['parts']) == set(parts) | {p + 'Far' for p in parts if p != 'cabin'},
            name + ': unexpected or missing packed part')
    if name == 'jet':
        texture = gltf.js['textures'][0]
        image_index = texture.get('source', texture.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
        image = gltf.js['images'][image_index]
        view = gltf.js['bufferViews'][image['bufferView']]
        offset = view.get('byteOffset', 0)
        image_raw = gltf.buffer(view['buffer'])[offset:offset + view['byteLength']]
        require((pack.parent / 'jet-skin.webp').read_bytes() == image_raw,
                'Citation native image bytes changed')
    return dict(sourceTriangles=original_count, reconstructedCloseTriangles=total,
                closeVerticesChecked=vertices, maxPositionErrorMetres=max_position,
                minimumAuthoredNormalDot=min_normal, maxOriginalUvError=max_uv,
                zeroSourceNormals=0, zeroPackedNormals=0,
                sourceDoubleSided=all(m.get('doubleSided', False) for m in gltf.js['materials']),
                parts=parts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('pack', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--receipt', type=Path, help='Conversion receipt; defaults to the pack directory for clean rebuilds')
    args = parser.parse_args()
    source_pack = args.pack / 'jet-models.bin' if args.pack.is_dir() else args.pack
    manifest = json.loads(Path(__file__).with_name('jet_models_source.json').read_text())
    for entry in manifest['files']:
        require(sha256((args.source / entry['path']).read_bytes()) == entry['sha256'],
                'Pinned source hash mismatch: ' + entry['path'])
    raw, header, arrays = read_pack(source_pack)
    receipt_path = args.receipt or source_pack.parent / 'jet-conversion-receipt.json'
    receipt = json.loads(receipt_path.read_text())
    for name, output in receipt['outputs'].items():
        require(sha256((source_pack.parent / name).read_bytes()) == output['sha256'],
                'Conversion receipt output mismatch: ' + name)
    results = [converter.citation(args.source), converter.boeing(args.source)]
    proof = dict(packSha256=sha256(raw), models={},
                 method='Independent DECVM001 decode and original-source triangle/corner reconstruction; converter gather used only as an additional ownership check')
    for result in results:
        name = result['meta']['type']
        proof['models'][name] = verify_model(args.source, source_pack, result, header['models'][name], arrays, receipt[name])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps({name: {k: v for k, v in model.items() if k != 'parts'}
                      for name, model in proof['models'].items()}, indent=2))


if __name__ == '__main__':
    main()
