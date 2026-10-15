#!/usr/bin/env python3
"""Convert the pinned CC-BY Citation and 737 into a separate DECVM001 pack.

python3 tools/jet_models_source.py /tmp/jet-source
OPENBLAS_NUM_THREADS=1 python3 tools/jet_models.py /tmp/jet-source --out assets

Near geometry retains every source triangle, split normal and UV. Citation
articulation partitions the existing, merged source triangles by measured surface
regions; it is an adaptation, not an authored source rig. Far geometry collapses
to surviving source vertices, retaining their own normals/UVs. Bell/Cessna and all
vehicle packs are neither read for conversion nor written.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import numpy as np

import vehicle_models as vm

ROOT = Path(__file__).resolve().parent.parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def srgb(linear):
    c = np.asarray(linear, dtype=float)
    return np.round(np.clip(np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055), 0, 1) * 255).astype('u1')


def normalise(prims, front, scale):
    vm.to_game_frame(prims, front)
    P = np.concatenate([p['P'] for p in prims]) * scale
    lo, hi = P.min(0), P.max(0)
    shift = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    for p in prims:
        p['P'] = p['P'] * scale + shift
    return [float(v) for v in hi - lo], shift


def plane_meta(name, title, prims):
    P = np.concatenate([p['P'] for p in prims])
    lo, hi = P.min(0), P.max(0)
    tip = P[np.argmax(P[:, 2])]
    tail = P[P[:, 0] < lo[0] + (hi[0] - lo[0]) * .2]
    fin = tail[np.argmax(tail[:, 1])]
    end = P[np.argmin(P[:, 0])]
    return dict(type=name, title=title, length=float(hi[0] - lo[0]), span=float(hi[2] - lo[2]),
                height=float(hi[1] - lo[1]), dims=[float(v) for v in hi - lo],
                wingtip=tip.tolist(), finTop=fin[[0, 1]].tolist(), tail=end[[0, 1]].tolist())


def citation(source):
    g = vm.Gltf(str(source / 'citation2.glb'))
    prims = vm.load_primitives(g)
    # The mirror's native 256px image is kept byte-for-byte, without invented detail.
    texture = g.js['textures'][0]
    image_index = texture.get('source', texture.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
    image = g.js['images'][image_index]
    bv = g.js['bufferViews'][image['bufferView']]
    skin = g.buffers[bv['buffer']][bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    # Fit the source uniformly to the existing 14.75m span. Its 15.62m length
    # remains inside the existing 18.75m collision envelope.
    original = np.concatenate([p['P'] for p in prims])
    scale = 14.75 / np.ptp(original[:, 2])
    dims, shift = normalise(prims, '-x', scale)
    m = plane_meta('jet', '1990 Cessna Citation (exterior)', prims)
    m.update(kind='plane', source=g.js['asset']['extras'], originalTriangles=sum(len(p['index']) for p in prims),
             uniformScale=float(scale), originalDims=np.ptp(original, axis=0).tolist(), sourceToGameShift=shift.tolist(),
             rigMethod='Original merged triangles partitioned at measured surface regions. Hinge cuts are adaptation estimates; source has no separate control/gear nodes.',
             nativeTexture=[256, 256], cabin=False, hinges={}, gears={}, fans={})
    # All thresholds below are in the SOURCE'S metre frame, after turning the
    # nose +X and resting its native wheel contacts on y=0, before scale fit.
    P = prims[0]['P'] / scale
    P[:, 0] -= shift[0] / scale
    P[:, 2] -= shift[2] / scale
    I = prims[0]['index']
    corners = P[I]
    C = corners.mean(1)
    x, y, z = C.T
    az = abs(z)
    role = np.full(len(I), 'body', dtype=object)
    # The nose and main legs stop at their actual attachment regions. No hull
    # or wing triangle is deleted: a neutral pose reconstructs the source.
    nose = ((corners[:, :, 0] > 4.72) & (corners[:, :, 0] < 5.43) & (abs(corners[:, :, 2]) < .36) & (corners[:, :, 1] < 1.18)).all(1)
    nose |= ((corners[:, :, 0] > 4.50) & (corners[:, :, 0] < 5.48) & (abs(corners[:, :, 2]) < .36) & (corners[:, :, 1] < .80)).all(1)
    mains = ((corners[:, :, 0] > -1.98) & (corners[:, :, 0] < -1.00) & (abs(corners[:, :, 2]) > 1.02) & (abs(corners[:, :, 2]) < 1.96) & (corners[:, :, 1] < 1.22)).all(1)
    role[nose] = 'gearN'
    for side, suffix in [(-1, 'L'), (1, 'R')]:
        role[mains & (z * side > 0)] = 'gear' + suffix
        flap = (z * side > 1.96) & (z * side < 4.18) & (y > 1.05) & (y < 1.9) & (x < -1.55 - az * .22) & (x > -4.2)
        aileron = (z * side > 4.25) & (z * side < 6.65) & (y > 1.2) & (y < 2.0) & (x < -1.65 - az * .22) & (x > -4.5)
        elevator = (z * side > .42) & (z * side < 3.15) & (y > 4.85) & (y < 5.25) & (x < -6.65 - az * .22)
        role[flap] = 'flap' + suffix
        role[aileron] = 'aileron' + suffix
        role[elevator] = 'elevator' + suffix
    rudder = (az < .20) & (y > 3.36) & (y < 5.5) & ((y < 4.87) | (y > 5.23)) & (x < -5.65 - (y - 3.36) * .43)
    role[rudder] = 'rudder'
    parts = {}
    for name in sorted(set(role)):
        ids = np.nonzero(role == name)[0]
        parts[name] = [(0, int(i)) for i in ids]
        Q = prims[0]['P'][I[ids]].reshape(-1, 3)
        if name.startswith(('flap', 'aileron', 'elevator')) or name == 'rudder':
            span_axis = 1 if name == 'rudder' else 2
            # Measure the selected leading boundary at each end, averaging the
            # upper/lower skin envelope so a vertex on just one skin cannot
            # tilt a mirror's hinge by the wing thickness. These are adapted
            # hinge estimates measured from source geometry, not authored pivots.
            low, high = Q[:, span_axis].min(), Q[:, span_axis].max()
            band = max((high - low) * .08, .01)
            A = Q[Q[:, span_axis] < low + band]
            B = Q[Q[:, span_axis] > high - band]
            A = A[A[:, 0] > A[:, 0].max() - .12 * scale]
            B = B[B[:, 0] > B[:, 0].max() - .12 * scale]
            a, b = (A.min(0) + A.max(0)) / 2, (B.min(0) + B.max(0)) / 2
            m['hinges'][name] = dict(a=a.tolist(), b=b.tolist())
        elif name.startswith('gear'):
            top = Q[Q[:, 1] > Q[:, 1].max() - .04 * scale]
            origin = (top.min(0) + top.max(0)) / 2
            m['gears'][name] = dict(origin=origin.tolist(), side=0 if name == 'gearN' else -1 if name == 'gearL' else 1,
                                    retract='forward' if name == 'gearN' else 'in')
    # The optimized source does not keep identical vertex rows on both skins.
    # Measure paired cross-section envelopes to put both mirrors' adapted
    # hinges through the skin midline, rather than whichever skin happened to
    # contribute the forwardmost retained corner.
    all_points = np.concatenate([p['P'] for p in prims])
    for family in ('aileron', 'flap', 'elevator'):
        left, right = m['hinges'][family + 'L'], m['hinges'][family + 'R']
        for le, re in [('b', 'a'), ('a', 'b')]:  # roots, then tips
            x0 = (left[le][0] + right[re][0]) / 2
            z0 = (abs(left[le][2]) + abs(right[re][2])) / 2
            y0 = (left[le][1] + right[re][1]) / 2
            band = all_points[(abs(all_points[:, 0] - x0) < .18 * scale) &
                              (abs(abs(all_points[:, 2]) - z0) < .16 * scale) &
                              (abs(all_points[:, 1] - y0) < .4 * scale)]
            mid_y = float((band[:, 1].min() + band[:, 1].max()) / 2) if len(band) else y0
            left[le] = [float(x0), mid_y, -float(z0)]
            right[re] = [float(x0), mid_y, float(z0)]
    for endpoint in ('a', 'b'):
        m['hinges']['rudder'][endpoint][2] = 0.0
    # This source has painted dark intake disks rather than separate turbine
    # blades. Keep them as authored; do not claim a source fan rig that is absent.
    m['fanGeometry'] = 'Intake texture/disk retained in body; no independent authored fan blades in merged source.'
    return dict(meta=m, prims=prims, parts=parts, colors=None, skin=skin)


def boeing(source):
    g = vm.Gltf(str(source / 'southwest737/scene.gltf'))
    prims = vm.load_primitives(g)
    dims, shift = normalise(prims, '+z', .01)
    m = plane_meta('airliner', 'Boeing 737 (fictional Oceanview livery)', prims)
    recolor = json.loads(Path(__file__).with_name('jet_models_branding.json').read_text())
    branding = {int(k): set(v) for k, v in recolor['triangleIds'].items()}
    m.update(kind='static', source=g.js['asset']['extras'], originalTriangles=sum(len(p['index']) for p in prims),
             uniformScale=.01, sourceToGameShift=shift.tolist(), cabin=True,
             brandingRecoloredTriangles=sum(len(v) for v in branding.values()),
             brandingMethod='Exact source inlay faces recolored; no triangles removed. Shared-edge audit proves text forms the shell.',
             sourceMaterials=len(g.js['materials']), nativeTextures=0)
    # Palette changes are an explicit fictional livery adaptation. The source
    # has material colours only; no authored PBR texture maps are fabricated.
    palette = {9: [225, 234, 232], 18: [32, 78, 91], 19: [38, 108, 113], 20: [94, 156, 145]}
    grey = {1, 4, 7, 8, 10, 11, 16, 17, 21, 25, 27, 29, 31, 34, 35}
    parts = {name: [] for name in ('body', 'trim', 'glass', 'cabin')}
    colors = {}
    for pi, p in enumerate(prims):
        mat = p['material']
        native = srgb(g.js['materials'][mat].get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[:3])
        color = np.array(palette.get(mat, native), dtype='u1')
        for ti in range(len(p['index'])):
            name = 'cabin' if pi >= 181 else 'glass' if mat in (14, 26, 28, 33) else 'trim' if mat in grey or mat in (3, 6, 12, 30) else 'body'
            # Branding is an inlay welded into the shell. Omitting it would
            # produce letter-shaped holes. All 4,140 verified faces stay.
            if ti in branding.get(pi, ()):
                name = 'body'
                colors[(pi, ti)] = np.array(palette[9], dtype='u1')
            else:
                colors[(pi, ti)] = color
            parts[name].append((pi, ti))
    return dict(meta=m, prims=prims, parts=parts, colors=colors)


def gather(result, triangles):
    P, N, UV, C, I, source_ids = [], [], [], [], [], []
    vertices = {}
    for pi, ti in triangles:
        p = result['prims'][pi]
        color = result['colors'].get((pi, ti)) if result['colors'] is not None else None
        triangle = []
        for vi in p['index'][ti]:
            key = (pi, int(vi), tuple(color) if color is not None else None)
            if key not in vertices:
                vertices[key] = len(P)
                P.append(p['P'][vi]); N.append(p['N'][vi])
                UV.append(p['UV'][vi] if p['UV'] is not None else [0, 0])
                if color is not None:
                    C.append(color)
                source_ids.append([pi, int(vi)])
            triangle.append(vertices[key])
        I.append(triangle)
    return np.array(P), np.array(N), np.array(UV), np.array(C), np.array(I), np.array(source_ids)


def write_part(blob, result, name, geometry, far, qlo, qext, receipt):
    P, N, UV, C, I, ids = geometry
    if far:
        target = .34 if result['meta']['type'] == 'jet' else .13
        used, index = vm.decimate(P, I, target, .96)
        P, N, UV, ids = P[used], N[used], UV[used], ids[used]
        if len(C):
            C = C[used]
        I = np.array(index)
    # Quantization only. In particular, ratio-one does not pass through a weld,
    # smoothing operator or Blender normal rebuild.
    qp = np.round((P - qlo) / qext * 65534 - 32767).astype('<i2')
    qn = np.round(N * 32767).astype('<i2')
    uv_float = bool((UV < 0).any() or (UV > 1).any())
    # A few untextured 737 fan parts carry repeated UVs far outside 0..1.
    # Preserve those authored values despite their not driving a texture.
    quv = UV.astype('<f4') if uv_float else np.round(UV * 65535).astype('<u2')
    key = result['meta']['type'] + '.' + name
    for suffix, array, kind in [('p', qp, 'i2'), ('n', qn, 'i2'), ('uv', quv, 'f4' if uv_float else 'u2')]:
        blob.add(key + '.' + suffix, array, kind)
    if len(C):
        blob.add(key + '.c', C.astype('u1'), 'u1')
    wide = len(P) > 65535
    blob.add(key + '.i', I.astype('<u4' if wide else '<u2'), 'u4' if wide else 'u2')
    decoded = (qp.astype(float) + 32767) / 65534 * qext + qlo
    decoded_n = qn / 32767
    decoded_n /= np.maximum(np.linalg.norm(decoded_n, axis=1, keepdims=True), 1e-12)
    error = dict(triangles=int(len(I)), vertices=len(P), indexBytes=4 if wide else 2,
                 maxPositionErrorMetres=float(np.abs(decoded - P).max()),
                 minimumNormalDot=float(np.sum(decoded_n * N, axis=1).min()),
                 maxUvError=float(np.abs((quv if uv_float else quv / 65535) - UV).max()),
                 sourceVertexIdsSha256=hashlib.sha256(ids.astype('<i4').tobytes()).hexdigest(),
                 sourceTriangleOwnershipSha256=hashlib.sha256(np.array(result['parts'][name.removesuffix('Far')], dtype='<i4').tobytes()).hexdigest())
    receipt[name] = error
    info = dict(triangles=int(len(I)))
    base = name.removesuffix('Far')
    model = result['meta']
    if base in model.get('hinges', {}):
        info['origin'] = model['hinges'][base]['a']
    if base in model.get('gears', {}):
        info['origin'] = model['gears'][base]['origin']
    return info


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / 'assets')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(Path(__file__).with_name('jet_models_source.json').read_text())
    for f in manifest['files']:
        if digest(args.source / f['path']) != f['sha256']:
            raise ValueError('Unverified source file: ' + f['path'])
    results = [citation(args.source), boeing(args.source)]
    blob, header, audit = vm.Blob(), dict(version=1, models={}), {}
    for result in results:
        m = result['meta']
        P = np.concatenate([p['P'] for p in result['prims']])
        qlo, qhi = P.min(0) - .001, P.max(0) + .001
        qext = qhi - qlo
        m['quant'] = qlo.tolist() + qext.tolist()
        m['parts'], record = {}, {}
        for name, triangles in result['parts'].items():
            if not triangles:
                continue
            geometry = gather(result, triangles)
            m['parts'][name] = write_part(blob, result, name, geometry, False, qlo, qext, record)
            # Cabin detail is a near-only 737 resource.
            if name != 'cabin':
                m['parts'][name + 'Far'] = write_part(blob, result, name + 'Far', geometry, True, qlo, qext, record)
        m['triangles'] = sum(v['triangles'] for k, v in m['parts'].items() if not k.endswith('Far'))
        m['farTriangles'] = sum(v['triangles'] for k, v in m['parts'].items() if k.endswith('Far'))
        if m['triangles'] != m['originalTriangles']:
            raise ValueError('Near geometry lost source triangles: ' + m['type'])
        audit[m['type']] = dict(parts=record, source=m['source'], sourceTriangles=m['originalTriangles'],
                                nearTriangles=m['triangles'], farTriangles=m['farTriangles'], dims=m['dims'])
        header['models'][m['type']] = m
        if 'skin' in result:
            (args.out / 'jet-skin.webp').write_bytes(result['skin'])
        print(m['type'], 'near', m['triangles'], 'far', m['farTriangles'], 'dimensions', m['dims'], flush=True)
    header['arrays'] = blob.arrays
    raw = json.dumps(header, separators=(',', ':')).encode()
    raw += b' ' * (-(12 + len(raw)) % 4)
    pack = b'DECVM001' + struct.pack('<I', len(raw)) + raw + bytes(blob.data)
    (args.out / 'jet-models.bin').write_bytes(pack)
    audit['outputs'] = {name: dict(bytes=(args.out / name).stat().st_size, sha256=digest(args.out / name))
                        for name in ('jet-models.bin', 'jet-skin.webp')}
    audit['unchangedExistingAircraft'] = {name: digest(ROOT / 'assets' / name) for name in ('aircraft-models.bin', 'aircraft-skin.webp')}
    (args.out / 'jet-conversion-receipt.json').write_text(json.dumps(audit, indent=2) + '\n')
    print('jet pack', len(pack), 'bytes', flush=True)


if __name__ == '__main__':
    main()
