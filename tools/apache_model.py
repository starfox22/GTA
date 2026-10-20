#!/usr/bin/env python3
"""Convert the downloaded Andrew Swihart CC-BY-4.0 AH-64 into its isolated source-preserving pack.

python3 tools/apache_model.py [--source work/.../source] [--out assets/apache-model.bin]
Without --source, download the pinned, SHA-256-verified original glTF archive.
Near keeps every aircraft triangle, authored normal, UV and PBR factor. Far and the
shadow proxy alone use deterministic vertex clustering. No existing asset pack changes.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
import urllib.request
import zipfile

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import vehicle_models as vm
from aircraft_models import pieces

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://raw.githubusercontent.com/projeto-arcanjo/modelos/d18428675ef6ca8d71c61e6ea7dc42ffc6691579/ah-64_helicopter.zip'
ARCHIVE_SHA256 = '0dfd7de823324fc2de7873338881b6d358c865718183447bf4ae04e284b78d45'
MAIN = np.array([-8.16394925, 299.57573984, 314.13302303])
TAIL = np.array([32.31186, 372.83512, -421.51306])
AXIS = np.array([0, np.cos(np.pi / 18), np.sin(np.pi / 18)])
GUN = np.array([-9, 50, 482])
MUZZLE = np.array([-9.088, -.437, 588.73858516])
MISSILE_PAIRS = [(1, 2), (35, 36), (3, 4), (37, 38), (19, 20), (53, 54), (27, 28), (61, 62)]


def source(path):
    if path is None:
        path = ROOT / 'work/military-combat-review/apache-asset/source'
        data = urllib.request.urlopen(URL, timeout=45).read()
        assert hashlib.sha256(data).hexdigest() == ARCHIVE_SHA256, 'source archive changed'
        path.mkdir(parents=True, exist_ok=True)
        zipfile.ZipFile(io.BytesIO(data)).extractall(path)
    return vm.Gltf(str(path / 'scene.gltf'))


def bvh(P, I):
    """Reorder whole source triangles only; a small exact tree, no near simplification."""
    corners = P[I]
    lo, hi = corners.min(1), corners.max(1)
    centres = (lo + hi) / 2
    bounds, nodes, ordered = [], [], []

    def visit(ids):
        n = len(nodes)
        bounds.append(np.r_[lo[ids].min(0), hi[ids].max(0)])
        nodes.append([0, 0, 0, 0])
        if len(ids) <= 32:
            nodes[n] = [len(ordered), len(ids), 0, 0]
            ordered.extend(ids.tolist())
        else:
            axis = int(np.ptp(centres[ids], axis=0).argmax())
            ids = ids[np.argsort(centres[ids, axis], kind='stable')]
            mid = len(ids) // 2
            left, right = visit(ids[:mid]), visit(ids[mid:])
            nodes[n] = [0, 0, left, right]
        return n
    visit(np.arange(len(I)))
    return I[ordered], np.array(bounds, dtype=np.float32), np.array(nodes, dtype=np.uint32), ordered


def cluster(a, cell):
    # Keep the first complete source corner in each position/material/slot cell.
    keys = np.column_stack([np.floor(a['p'] / cell).astype(np.int64), a['m'], a['s']])
    _, first, remap = np.unique(keys, axis=0, return_index=True, return_inverse=True)
    I = remap[a['i']]
    I = I[(I[:, 0] != I[:, 1]) & (I[:, 1] != I[:, 2]) & (I[:, 2] != I[:, 0])]
    if len(I):
        _, keep = np.unique(np.sort(I, axis=1), axis=0, return_index=True)
        I = I[np.sort(keep)]
    return {k: (I if k == 'i' else v[first]) for k, v in a.items() if k != 'source'}


def convert(g):
    ps = vm.load_primitives(g)
    source_offsets = np.cumsum([0] + [len(p['index']) for p in ps[:-1]])
    assert len(ps) == 129, 'unexpected source graph'
    extras = g.js['asset']['extras']
    assert extras['license'].startswith('CC-BY-4.0'), 'source licence must be verified'
    rp = np.concatenate([ps[i]['P'] for i in range(73, 81)]) - MAIN
    radial = rp - np.outer(rp @ AXIS, AXIS)
    scale = 7.315 / np.linalg.norm(radial, axis=1).max()
    ground = min(p['P'][:, 1].min() for p in ps if not p['node'].startswith('Plane'))
    # Centre the fuselage footprint; the rotor and antenna retain authored offsets.
    frame_origin = np.array([-8.16394925, ground, (683.300 + -503.160) / 2])
    R = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]])
    frame = lambda p: (np.asarray(p) - frame_origin) @ R.T * scale
    normal = lambda n: np.asarray(n) @ R.T
    tilt = -np.pi / 18
    C = np.array([[np.cos(tilt), -np.sin(tilt), 0], [np.sin(tilt), np.cos(tilt), 0], [0, 0, 1]])
    origins = dict(body=np.zeros(3), beacon=np.zeros(3), rotor=frame(MAIN), tail=frame(TAIL),
                   gun=frame(GUN), barrel=frame(GUN), payload=np.zeros(3))
    masks = {}
    for pi in [111, 113, 114, 115]:
        p = ps[pi]
        labels = pieces(p['P'], p['index'])
        mask = np.zeros(len(p['index']), dtype=np.uint8)
        for label in np.unique(labels):
            ids = np.where(labels == label)[0]
            q = p['P'][p['index'][ids]].reshape(-1, 3)
            if np.all(q.min(0) >= [-33, -10, 439]) and np.all(q.max(0) <= [15, 63, 590]):
                mask[ids] = 2 if (pi, int(label)) in [(113, 1653), (114, 296), (115, 212)] else 1
        masks[pi] = mask
    assert sum((v > 0).sum() for v in masks.values()) == 4393
    chunks = {k: [] for k in origins}
    slots = {i: n for n, pair in enumerate(MISSILE_PAIRS) for i in pair}
    missile_points = []

    def add(role, pi, ids, slot=255, override=None):
        p = ps[pi]
        idx = p['index'][ids]
        used, inv = np.unique(idx, return_inverse=True)
        P, N = frame(p['P'][used]), normal(p['N'][used])
        if override is not None:
            P, N = override(P, N)
        P = P - origins[role]
        if role == 'rotor':
            P, N = P @ C, N @ C
        chunks[role].append(dict(p=P.astype(np.float32), n=N.astype(np.float32),
            uv=(p['UV'][used] if p['UV'] is not None else np.zeros((len(used), 2))).astype(np.float32),
            m=np.full(len(used), p['material'], dtype=np.uint8),
            s=np.full(len(used), slot, dtype=np.uint8), i=inv.reshape(-1, 3).astype(np.uint32),
            source=(np.asarray(ids) + source_offsets[pi]).astype(np.uint32)))

    for pi, p in enumerate(ps):
        if p['node'].startswith('Plane'):
            continue  # Two transparent studio cards, never aircraft geometry.
        if pi in slots:
            add('payload', pi, np.arange(len(p['index'])), slots[pi]); continue
        role = 'rotor' if pi in list(range(73, 84)) + [86] else 'tail' if pi in [87, 88, 89] else 'beacon' if p['material'] == 11 else 'body'
        if pi in masks:
            for tag, name in [(0, role), (1, 'gun'), (2, 'barrel')]:
                ids = np.where(masks[pi] == tag)[0]
                if len(ids): add(name, pi, ids)
        else:
            add(role, pi, np.arange(len(p['index'])))

    for pair in MISSILE_PAIRS:
        P = np.concatenate([ps[i]['P'] for i in pair])
        nose = P[np.argmax(P[:, 2])].copy()
        nose[0:2] = (P[:, :2].min(0) + P[:, :2].max(0)) / 2
        missile_points.append(frame(nose))
    # Four wingtip air-defense rounds adapted from the downloaded missile itself.
    # Separate locations; no duplicate rocket-pod or eight-round rack occupants.
    template = np.concatenate([frame(ps[i]['P']) for i in MISSILE_PAIRS[0]])
    lo, hi = template.min(0), template.max(0)
    mid = (lo + hi) / 2
    air_points = []
    for slot, (side, row) in enumerate([(-1, 0), (1, 0), (-1, 1), (1, 1)]):
        centre = np.array([2.60, 1.61 - row * .24, side * 2.91])
        ratios = np.array([1.52 / (hi[0] - lo[0]), .45, .45])
        def adapt(P, N):
            q = (P - mid) * ratios + centre
            n = N / ratios; n /= np.linalg.norm(n, axis=1)[:, None]
            return q, n
        for pi in MISSILE_PAIRS[0]: add('payload', pi, np.arange(len(ps[pi]['index'])), 8 + slot, adapt)
        air_points.append(centre + [1.52 / 2, 0, 0])

    parts = {}
    for name, items in chunks.items():
        offsets = np.cumsum([0] + [len(a['p']) for a in items[:-1]])
        a = {k: np.concatenate([v[k] + off if k == 'i' else v[k] for v, off in zip(items, offsets)]) for k in items[0]}
        parts[name] = a
        far = cluster(a, .12 if name == 'body' else .09)
        parts[name + 'Far'] = far
    # A single bounded shadow draw: neutral source Far pieces, in body space.
    shadow_items = []
    for name in origins:
        if name == 'beacon': continue
        a = {k: v.copy() for k, v in parts[name + 'Far'].items()}
        if name == 'rotor': a['p'] = a['p'] @ C.T
        a['p'] += origins[name]
        shadow_items.append(a)
    offsets = np.cumsum([0] + [len(a['p']) for a in shadow_items[:-1]])
    shadow = {k: np.concatenate([a[k] + off if k == 'i' else a[k] for a, off in zip(shadow_items, offsets)]) for k in shadow_items[0]}
    parts['shadow'] = cluster(shadow, .22)
    hardpoint = lambda p: dict(zip(['x', 'y', 'z'], np.asarray(p)[[0, 2, 1]] * 8))
    pods = []
    for i in [71, 69]:
        P = ps[i]['P']; p = (P.min(0) + P.max(0)) / 2; p[2] = P[:, 2].max(); pods.append(hardpoint(frame(p)))
    metadata = dict(source=extras, sourceArchive=URL, archiveSha256=ARCHIVE_SHA256, scale=scale,
        origin=frame_origin.tolist(), sourceTriangles=220715, retainedSourceTriangles=220711,
        addedAirTriangles=1936, rotorRadius=7.315, rotorTilt=tilt,
        origins={k: v.tolist() for k, v in origins.items()},
        hardpoints=dict(gun=dict(pivot=hardpoint(frame(GUN)), muzzle=hardpoint(frame(MUZZLE))),
                        pods=pods, antiarmor=[hardpoint(p) for p in missile_points], air=[hardpoint(p) for p in air_points]),
        materials=g.js['materials'], parts={}, arrays={})
    return metadata, parts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / 'assets/apache-model.bin')
    args = parser.parse_args()
    g = source(args.source)
    header, parts = convert(g)
    blob = bytearray()
    for name, a in parts.items():
        I, bounds, nodes, order = bvh(a['p'], a['i'])
        a['i'] = I.astype(np.uint32)
        if 'source' in a: a['source'] = a['source'][order]
        header['parts'][name] = dict(triangles=len(I), vertices=len(a['p']), origin=header['origins'].get(name.removesuffix('Far'), [0, 0, 0]),
            bounds=[a['p'].min(0).tolist(), a['p'].max(0).tolist()], bvhNodes=len(nodes))
        a['bounds'], a['nodes'] = bounds, nodes
        for key, value in a.items():
            while len(blob) % 4: blob.append(0)
            value = np.ascontiguousarray(value.astype(np.float32) if value.dtype.kind == 'f' else value.astype(np.uint32) if value.dtype.kind == 'i' else value)
            kind = {'f': 'f4', 'u': 'u1' if value.dtype.itemsize == 1 else 'u4'}[value.dtype.kind]
            header['arrays'][name + '.' + key] = [kind, len(blob), value.size]
            blob.extend(value.tobytes())
    raw = json.dumps(header, separators=(',', ':'), ensure_ascii=False).encode()
    while (12 + len(raw)) % 4: raw += b' '
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(b'DECAP001' + struct.pack('<I', len(raw)) + raw + blob)
    record = ROOT / 'docs/sources/apache/source.json'
    record.parent.mkdir(parents=True, exist_ok=True)
    record.write_text(json.dumps({k: v for k, v in header.items() if k != 'arrays'}, indent=2) + '\n')
    print(json.dumps(dict(bytes=args.out.stat().st_size, parts={k: v['triangles'] for k, v in header['parts'].items()}, hardpoints=header['hardpoints']), indent=2))


if __name__ == '__main__':
    main()
