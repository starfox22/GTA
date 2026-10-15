#!/usr/bin/env python3
"""Offline structural, source-partition and attribute checks for the C8 pack."""
import argparse
import hashlib
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    checks = []
    def check(condition, message):
        if not condition:
            raise AssertionError(message)
        checks.append(message)
    raw = (args.assets / 'sports-vehicle-models.bin').read_bytes()
    check(raw[:8] == b'DECVM001', 'DECVM001 magic')
    length = struct.unpack('<I', raw[8:12])[0]
    header = json.loads(raw[12:12 + length]); payload = memoryview(raw)[12 + length:]
    model = header['models']['c8_hari']; parts = model['parts']; arrays = {}
    for key, (kind, offset, count) in header['arrays'].items():
        dtype = np.dtype(kind)
        check(offset % 4 == 0 and offset + count * dtype.itemsize <= len(payload), key + ' bounded/aligned')
        arrays[key] = np.frombuffer(payload[offset:offset + count * dtype.itemsize], dtype=dtype)
    check(model['normalScale'] == 32767, '16-bit hero normal scale')
    check(abs(model['dims'][0] - 4.69) < 1e-8, 'uniform fit retains 4.69m gameplay length')
    check(model['hasInterior'] and model['hasEmissiveAtlas'], 'authored cabin and emission retained')
    check(len(model['paintUv']) == 2 and all(0 < value < 1 for value in model['paintUv']), 'neutral generated-panel paint UV retained')
    check(model['triangles'] <= 100000 and model['farTriangles'] <= 18000, 'close/far geometry bounded')
    check(model['farTriangles'] < model['triangles'] * .3, 'traffic LOD materially cheaper')
    q = np.asarray(model['quant']); lo, extent = q[:3], q[3:]
    normal_errors = []
    def field(name, suffix, width):
        return arrays['c8_hari.' + name + '.' + suffix].reshape(-1, width)
    for name, part in parts.items():
        p, n, uv, a, t, f = [field(name, key, width) for key, width in [('p', 3), ('n', 3), ('uv', 2), ('a', 2), ('t', 4), ('f', 2)]]
        ix = arrays['c8_hari.' + name + '.i']
        check(len(p) == part['vertices'] == len(n) == len(uv) == len(a) == len(t) == len(f), name + ' complete vertex attributes')
        check(len(ix) == part['triangles'] * 3 and ix.max() < len(p), name + ' valid triangle indices')
        check(n.dtype == np.int16 and (ix.dtype == np.uint32 if len(p) > 65535 else ix.dtype == np.uint16), name + ' correct integer precision')
        check(np.isfinite(a).all() and (t[:, 2:] > 0).all(), name + ' source UVs/atlas rectangles')
        normal_errors.extend(np.abs(np.linalg.norm(n.astype(float) / 32767, axis=1) - 1).tolist())
        check(np.max(np.abs(np.linalg.norm(n.astype(float) / 32767, axis=1) - 1)) < .00005, name + ' quantized unit normals')
        if 'panes' in part:
            check(len(part['panes']) == 5 and sum(part['panes']) == part['triangles'], name + ' exact five-pane coverage')
        if not name.endswith('Far'):
            check(model['lodParts'][name] == name + 'Far' and name + 'Far' in parts, name + ' explicit real far geometry')
        if name.startswith(('head', 'tail', 'indicator')) or '.indicator' in name:
            check(np.all(field(name, 'c', 3) == 255), name + ' lamp albedo is not multiplied twice')
    for role in ['shell', 'panels', 'hood', 'glass', 'trim', 'cabin', 'opticalGlass']:
        names = model['roleParts'][role]
        check(bool(names) and all(name in parts for name in names), role + ' actual near parts')
        check(model['roleParts'][role + 'Far'] == [name + 'Far' for name in names], role + ' explicit far role expansion')
        check(model['lodParts'][role] == role + 'Far', role + ' standard runtime LOD alias')
    for suffix in ['', 'Far']:
        rendered = [name for role in ['shell', 'panels', 'hood', 'glass', 'trim', 'cabin', 'opticalGlass'] for name in model['roleParts'][role + suffix]]
        rendered += [name + suffix for name in ['headLeft', 'headRight', 'tailLeft', 'tailRight']]
        rendered += ['wheel%d.%s%s' % (i, role, suffix) for i in range(4) for role in ['tyre', 'rim', 'caliper']]
        expected = {name for name in parts if name.endswith('Far') == bool(suffix)}
        check(len(rendered) == len(set(rendered)) and set(rendered) == expected, ('near' if not suffix else 'far') + ' complete active render ownership: every source part exactly once')
    for role in ['glass', 'glassFar']:
        expected = [sum(parts[name]['panes'][i] for name in model['roleParts'][role]) for i in range(5)]
        check(model['rolePanes'][role] == expected, role + ' joined pane order/count contract')
    for label, side in [('left', -1), ('right', 1)]:
        door = model['doors'][label]
        check(door['side'] == side and np.sign(door['hinge'][2]) == side, label + ' normalized native hinge side')
        check(abs(np.linalg.norm(door['axis']) - 1) < 1e-10 and .7 < door['hinge'][0] < .9, label + ' front-seam authored vertical hinge')
        check(all(names and all(name in parts for name in names) for names in door['parts'].values()), label + ' all authored door layers present')
        check(all(name in model['roleParts']['opticalGlass'] for name in door['parts']['opticalGlass']), label + ' mirror covers retain transparent native door role')
        check(all(name in model['roleParts']['trim'] for name in door['parts']['indicator']), label + ' native indicators have actual closed-role ranges')
    check(.65 < model['glass']['halfBase'] < .85, 'window width excludes outboard mirror optics')
    for i, wheel in enumerate(model['wheels']):
        origin = np.array([wheel[k] for k in ('x', 'y', 'z')]); axis = np.array(wheel['axle'])
        check(abs(np.linalg.norm(axis) - 1) < 1e-10 and axis[2] > .999999, 'wheel%d true authored axle' % i)
        for suffix in ['tyre', 'rim', 'caliper']:
            name = 'wheel%d.%s' % (i, suffix)
            check(np.array_equal(parts[name]['origin'], origin) and parts[name + 'Far']['origin'] == parts[name]['origin'], name + ' true shared close/far hub')
        check('wheel%d.caliper' % i not in model['roleParts']['trim'], 'wheel%d caliper is isolated from fixed bodywork' % i)
    partition = json.loads((args.work / 'source-partition.json').read_text())
    source_faces = [tuple(pair) for record in partition.values() for pair in record['sourceFaces']]
    check(len(source_faces) == len(set(source_faces)) == 263683, '263683 authored source faces owned exactly once before LOD reduction')
    check(set(partition) == {name for name in parts if not name.endswith('Far')}, 'no source role silently lost during packing')
    source = json.loads(args.source.read_text())
    check(not any('COLOR_0' in p['attributes'] for mesh in source['meshes'] for p in mesh['primitives']), 'source has no authored vertex pigment')
    receipt = json.loads((args.work / 'sports-conversion-receipt.json').read_text())
    texel_checks = []
    for channel in ['albedo', 'orm', 'emissive']:
        full = Image.open(args.assets / ('sports-vehicle-' + channel + '.webp')); low = Image.open(args.assets / ('sports-vehicle-' + channel + '-low.webp'))
        check(full.size == (4096, 4096) and low.size == (2048, 2048), channel + ' explicit full/low texture tiers')
        expected_low = np.asarray(full.resize((2048, 2048), Image.Resampling.LANCZOS)); actual_low = np.asarray(low)
        if channel == 'albedo':
            # Lossless WebP is permitted to clear invisible RGB under alpha0;
            # all alpha and every visible colour texel must remain exact.
            check(np.array_equal(expected_low[:, :, 3], actual_low[:, :, 3]) and np.array_equal(expected_low[:, :, :3][actual_low[:, :, 3] > 0], actual_low[:, :, :3][actual_low[:, :, 3] > 0]), channel + ' low tier exact visible colour/alpha from final full atlas')
        else:
            check(np.array_equal(expected_low, actual_low), channel + ' low tier derives from final full atlas')
        if channel == 'albedo':
            for tile in receipt['atlasTiles'].values():
                for material_id in tile['materials']:
                    material = source['materials'][material_id]
                    if material.get('alphaMode') == 'BLEND':
                        x, y, w, h = tile['rect']; alpha = np.asarray(full.crop((x, y, x + w, y + h)))[:, :, 3]
                        expected = round(material.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[3] * 255)
                        check(np.all(alpha == expected), 'material%d authored BLEND alpha retained' % material_id)
                        texel_checks.append({'material': material_id, 'alpha': expected})
    result = dict(packSHA256=hashlib.sha256(raw).hexdigest(), assertions=len(checks), triangles=model['triangles'], farTriangles=model['farTriangles'],
                  parts=len(parts), arrays=len(arrays), sourceFaces=len(source_faces), normalLengthErrorMax=max(normal_errors),
                  authoredTransparency=texel_checks, checks=checks)
    (args.work / 'sports-integrity-proof.json').write_text(json.dumps(result, indent=2))
    print(json.dumps({key: value for key, value in result.items() if key != 'checks'}, indent=2))


if __name__ == '__main__':
    main()
