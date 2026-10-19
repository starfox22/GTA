#!/usr/bin/env python3
"""Aircraft models: convert downloaded ready-made aircraft (glTF / GLB, CC-BY) into the game's own data.

Writes assets/aircraft-models.bin (tools/vehicle_models.py's DECVM001 container: a JSON header, then int16 positions,
int8 normals, uint16 UVs, uint8 colours and uint16 triangles per part) for src/aircraft-assets3d.js. Every part is in
the game's model frame in metres (x ahead, y up, z to starboard, the skids or wheels on y 0, the footprint centred)
and coloured per vertex from the model's own texture or material colours, so no atlas is needed.

Helicopters (`kind: 'heli'`): parts `paint` (the scheme's base colour: the texture's white), `accent` (its stripe
colour: the texture's orange), `trim` (everything else, vertex colours), `glass`, `rotor` (blades and hub about the
mast, origin on the axis) and `tail` (the tail rotor about its hub). The header carries what animateHelicopter and
the lights need: the rotor's centre, height and radius, the tail rotor's hub and radius, the stabiliser tips, the
tail's end, the roof and the belly.

Static aircraft (`kind: 'static'`): parts `body` (vertex colours), `glass`; with the footprint measured (length,
span, height). Used for parked aircraft that never fly.

    python3 tools/aircraft_models.py SRC_DIR [--only NAME,...] [--out DIR (default assets/)] [--credits]

SRC_DIR is the folder the downloads were unpacked into; MODELS names each file under it. Needs numpy and Pillow and
tools/vehicle_models.py (the glTF reader, the decimation and the part writer).
"""
import json
import os
import re
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vehicle_models as vm  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODELS = [
    dict(
        name='bell429', kind='heli', title='Bell 429 Helicopter', author='agreene (https://sketchfab.com/davidre)',
        url='https://sketchfab.com/3d-models/bell-429-helicopter-8dda855f3ab343b7b69ca7adcbf24f03',
        src='bell429/bell_429_helicopter.glb', front='+z',
        # The real main rotor: 10.98 m across (the source is about twice life size).
        rotorRadius=5.49,
        # Source-frame boxes (before scaling): main rotor pieces lie wholly above `rotorAbove` (y); the tail rotor's
        # pieces wholly inside `tailBox` ([x0, x1], [y0, y1], [z0, z1]).
        rotorAbove=4.6, tailBox=[[0.15, 0.9], [-0.2, 3.5], [-16.8, -13.1]],
        glassMaterials=[1],
        keep=dict(paint=0.13, accent=0.1, trim=0.1, glass=0.3, rotor=0.18, tail=0.12), minPiece=0.04,
        borderCos=dict(trim=0.75, paint=0.85),
    ),
    dict(
        name='skyhawk', kind='plane', title='Cessna172', author='KOG_THORNS (https://sketchfab.com/ioai25312)',
        url='https://sketchfab.com/3d-models/cessna172-d1b15841c29c43d0862667300bad55a4',
        src='cessna172/C172P_1.glb', front='+z', length=8.28,
        exterior=r'Cessna_Exterior', cabin=r'Cessna_Interior_(Seat|Inte)',
        # Node names to parts (the source's own: control surfaces, the propeller and its spinner).
        parts=[(r'Aileron_Left', 'aileronL'), (r'Aileron_Right', 'aileronR'), (r'Flaps_Left', 'flapL'), (r'Flaps_Right', 'flapR'),
               (r'Elevator_Left', 'elevatorL'), (r'Elevator_Right', 'elevatorR'), (r'_Rudder', 'rudder'),
               (r'Body_MAT_0\.001/', 'prop'), (r'Body_MAT_0\.024/', 'spinner')],
        glassMaterials=[1], skinMaterial=0,
        keep=dict(body=0.55, glass=0.35, cabin=0.008), minPiece=0.08, borderCos=dict(cabin=0.7),
    ),
]


def pieces(P, I):
    """A label per triangle: the connected piece it belongs to (through shared positions)."""
    key = {}
    vid = np.array([key.setdefault(tuple(np.round(p, 4)), len(key)) for p in P])
    parent = list(range(len(key)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for t in I:
        a = find(vid[t[0]])
        parent[find(vid[t[1]])] = a
        parent[find(vid[t[2]])] = a
    return np.array([find(vid[t[0]]) for t in I])


def colour_class(rgb):
    """'paint' for the white panels, 'accent' for the orange stripes, else 'trim'."""
    r, g, b = rgb
    if r > 200 and g > 200 and b > 200:
        return 'paint'
    if r > 170 and 70 < g < 150 and b < 60:
        return 'accent'
    return 'trim'


def load(model, src_root):
    g = vm.Gltf(os.path.join(src_root, model['src']))
    mats = g.js.get('materials', [])
    prims = vm.load_primitives(g)
    images = {}
    for mi, m in enumerate(mats):
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t is not None:
            images[mi] = g.image(t['index'])[1]
    return g, mats, prims, images


def soup(prims):
    """Every triangle as (prim, corner ids) with world positions, centroids and the triangles' piece labels."""
    tri_prim, tri_idx = [], []
    for pi, p in enumerate(prims):
        tri_prim += [pi] * len(p['index'])
        tri_idx += list(p['index'])
    tri_prim = np.array(tri_prim)
    tri_idx = np.array(tri_idx)
    corners = np.stack([np.stack([prims[pi]['P'][v] for v in t]) for pi, t in zip(tri_prim, tri_idx)])
    return tri_prim, tri_idx, corners


def convert_heli(model, src_root):
    g, mats, prims, images = load(model, src_root)
    tri_prim, tri_idx, corners = soup(prims)
    flat = corners.reshape(-1, 3)
    label = pieces(flat, np.arange(len(flat)).reshape(-1, 3))
    lo = {}
    hi = {}
    for k, l in enumerate(label):
        c = corners[k]
        lo[l] = np.minimum(lo.get(l, c.min(0)), c.min(0))
        hi[l] = np.maximum(hi.get(l, c.max(0)), c.max(0))
    tb = np.array(model['tailBox'])
    role = []
    r = dict(prims=prims, mats=mats, images=images, tex_of={})
    for k in range(len(tri_prim)):
        l = label[k]
        p = prims[tri_prim[k]]
        if lo[l][1] > model['rotorAbove']:
            role.append('rotor')
        elif (lo[l] >= tb[:, 0]).all() and (hi[l] <= tb[:, 1]).all():
            role.append('tail')
        elif p['material'] in model['glassMaterials']:
            role.append('glass')
        else:
            uv = p['UV'][tri_idx[k]].mean(0) if p['UV'] is not None else None
            role.append(colour_class(vm.sample_colour(r, p['material'], uv)))
    role = np.array(role)
    # The game frame, scaled to the real rotor.
    rot = [i for i in range(len(role)) if role[i] == 'rotor']
    rp = corners[rot].reshape(-1, 3)
    centre = (rp.min(0) + rp.max(0)) / 2
    radius_src = max(np.hypot(rp[:, 0] - centre[0], rp[:, 2] - centre[2]).max(), 1e-6)
    s = model['rotorRadius'] / radius_src
    vm.to_game_frame(prims, model['front'])
    allP = np.concatenate([p['P'] for p in prims]) * s
    blo, bhi = allP.min(0), allP.max(0)
    shift = np.array([-(blo[0] + bhi[0]) / 2, -blo[1], -(blo[2] + bhi[2]) / 2])
    for p in prims:
        p['P'] = p['P'] * s + shift
    corners = np.stack([np.stack([prims[pi]['P'][v] for v in t]) for pi, t in zip(tri_prim, tri_idx)])

    def pts(name):
        return corners[role == name].reshape(-1, 3)
    rp = pts('rotor')
    rc = (rp.min(0) + rp.max(0)) / 2
    tp = pts('tail')
    tc = (tp.min(0) + tp.max(0)) / 2
    body = np.concatenate([pts('paint'), pts('accent'), pts('trim'), pts('glass')])
    blo, bhi = body.min(0), body.max(0)
    # Stabiliser tips: the widest paint or accent point in the tail third; the tail's end; roof and belly at the cabin.
    tail_third = body[body[:, 0] < blo[0] + (bhi[0] - blo[0]) * 0.3]
    tip_i = np.argmax(np.abs(tail_third[:, 2]))
    stab = tail_third[tip_i]
    end = body[np.argmin(body[:, 0])]
    cabin = body[np.abs(body[:, 0] - rc[0]) < 0.6]
    fus = body[np.abs(body[:, 2]) < 0.4]
    near = fus[np.abs(fus[:, 0] - rc[0]) < 1.2]
    meta = dict(
        type=model['name'], kind='heli', title=model['title'],
        dims=[round(float(v), 3) for v in (bhi - blo)],
        length=round(float(bhi[0] - blo[0]), 3), width=round(float(bhi[2] - blo[2]), 3), height=round(float(allP[:, 1].max() - allP[:, 1].min()), 3),
        rotor=dict(x=round(float(rc[0]), 3), y=round(float(rp[:, 1].mean()), 3), top=round(float(rp[:, 1].max()), 3), radius=round(float(np.hypot(rp[:, 0] - rc[0], rp[:, 2] - rc[2]).max()), 3)),
        tail=dict(x=round(float(tc[0]), 3), y=round(float(tc[1]), 3), z=round(float(tc[2]), 3), radius=round(float(max(tp[:, 0].max() - tp[:, 0].min(), tp[:, 1].max() - tp[:, 1].min()) / 2), 3)),
        stab=[round(float(v), 3) for v in (stab[0], stab[1], abs(stab[2]))],
        end=[round(float(end[0]), 3), round(float(end[1]), 3)],
        roof=[round(float(rc[0]), 3), round(float(near[:, 1].max() if len(near) else cabin[:, 1].max()), 3)],
        belly=[round(float(rc[0]), 3), round(float(near[:, 1].min() if len(near) else 0.5), 3)],
        nose=[round(float(bhi[0]), 3), round(float(body[np.argmax(body[:, 0])][1]), 3)],
        skids=round(float(np.abs(body[body[:, 1] < 0.15][:, 2]).max()) if (body[:, 1] < 0.15).any() else 1.2, 3),
    )
    parts = {}
    keep = model['keep']
    for name in ('paint', 'accent', 'trim', 'glass', 'rotor', 'tail'):
        tris = [int(k) for k in np.nonzero(role == name)[0]]
        part = dict(tris=tris, keep=keep.get(name, 1.0), colors=True, minPiece=model.get('minPiece') if name in ('trim',) else None,
                    borderCos=model.get('borderCos', {}).get(name, 0.9))
        if name == 'rotor':
            part['origin'] = (float(rc[0]), 0.0, 0.0)
        if name == 'tail':
            part['origin'] = (float(tc[0]), float(tc[1]), float(tc[2]))
        parts[name] = part
    r.update(meta=meta, tri_prim=tri_prim, tri_idx=tri_idx, parts=parts)
    return r


def convert_plane(model, src_root):
    """A flyable light aircraft: the airframe (textured), its glass and cabin, the moving parts by node name (control
    surfaces about their hinge lines, the propeller about the spinner's axis), measured lamp points."""
    g, mats, prims, images = load(model, src_root)
    keep_prims = [p for p in prims if re.search(model['exterior'], p['path']) or re.search(model.get('cabin', '^$'), p['path'])]
    prims = keep_prims
    tri_prim, tri_idx, corners = soup(prims)
    role = []
    for k in range(len(tri_prim)):
        p = prims[tri_prim[k]]
        name = 'body'
        for rx, rname in model['parts']:
            if re.search(rx, p['path']):
                name = rname
                break
        else:
            if model.get('cabin') and re.search(model['cabin'], p['path']):
                name = 'cabin'
            elif p['material'] in model['glassMaterials']:
                name = 'glass'
        role.append(name)
    role = np.array(role)
    vm.to_game_frame(prims, model['front'])
    allP = np.concatenate([p['P'] for p in prims if True])
    s = model['length'] / (allP[:, 0].max() - allP[:, 0].min())
    allP = allP * s
    blo, bhi = allP.min(0), allP.max(0)
    shift = np.array([-(blo[0] + bhi[0]) / 2, -blo[1], -(blo[2] + bhi[2]) / 2])
    for p in prims:
        p['P'] = p['P'] * s + shift
    corners = np.stack([np.stack([prims[pi]['P'][v] for v in t]) for pi, t in zip(tri_prim, tri_idx)])

    def pts(name):
        return corners[role == name].reshape(-1, 3)
    r = dict(prims=prims, mats=mats, images=images, tex_of={})
    hinges = {}
    for name in ('aileronL', 'aileronR', 'flapL', 'flapR', 'elevatorL', 'elevatorR', 'rudder'):
        P = pts(name)
        if not len(P):
            continue
        span = 1 if name == 'rudder' else 2
        # A swept/dihedral edge does not share one global foremost x. Measure
        # the leading edge independently at both span ends, or the hinge can
        # collapse to a tiny vertical line at one wingtip.
        lo, hi = P[:, span].min(), P[:, span].max()
        band = min(0.06, (hi - lo) * 0.04)

        def leading_at(end):
            edge = P[np.abs(P[:, span] - end) <= band]
            return edge[edge[:, 0] >= edge[:, 0].max() - 0.02].mean(0)

        a, b = leading_at(lo), leading_at(hi)
        hinges[name] = dict(a=[round(float(v), 4) for v in a], b=[round(float(v), 4) for v in b])
    pp = pts('prop')
    sp = pts('spinner') if (role == 'spinner').any() else pp
    axis = (sp.min(0) + sp.max(0)) / 2
    axis[0] = sp[:, 0].min()
    tips = [corners[(role == 'body')].reshape(-1, 3)]
    body = np.concatenate([pts(n) for n in set(role) if n not in ('prop', 'spinner')])
    wing = body[np.argmax(body[:, 2])]
    fin = body[body[:, 0] < body[:, 0].min() + 1.2]
    meta = dict(
        type=model['name'], kind='plane', title=model['title'],
        dims=[round(float(v), 3) for v in (bhi - blo) * 1],
        length=round(float(allP[:, 0].max() - allP[:, 0].min()), 3), span=round(float(allP[:, 2].max() - allP[:, 2].min()), 3),
        height=round(float(allP[:, 1].max() - allP[:, 1].min()), 3),
        hinges=hinges, prop=[round(float(v), 4) for v in axis],
        propRadius=round(float(np.hypot(pp[:, 1] - axis[1], pp[:, 2] - axis[2]).max()), 3),
        wingtip=[round(float(wing[0]), 3), round(float(wing[1]), 3), round(float(wing[2]), 3)],
        finTop=[round(float(fin[np.argmax(fin[:, 1])][0]), 3), round(float(fin[:, 1].max()), 3)],
        tail=[round(float(body[:, 0].min()), 3), round(float(fin[np.argmin(fin[:, 0])][1]), 3)],
        belly=round(float(body[np.abs(body[:, 2]) < 0.3][:, 1].min()), 3) if (np.abs(body[:, 2]) < 0.3).any() else 0.5,
    )
    del tips
    parts = {}
    keep = model['keep']
    for name in sorted(set(str(x) for x in role)):
        tris = [int(k) for k in np.nonzero(role == name)[0]]
        part = dict(tris=tris, keep=keep.get(name, 1.0), uv=name not in ('glass', 'cabin'),
                    borderCos=model.get('borderCos', {}).get(name, 0.9), minPiece=model.get('minPiece') if name == 'cabin' else None)
        if name in hinges:
            part['origin'] = tuple(hinges[name]['a'])
        if name in ('prop', 'spinner'):
            part['origin'] = tuple(axis)
        parts[name] = part
    r.update(meta=meta, tri_prim=tri_prim, tri_idx=tri_idx, parts=parts)
    # The skin: the exterior texture alone (the cabin and glass are vertex coloured).
    tex = images[model['skinMaterial']].convert('RGB').resize((model.get('skinSize', 1024),) * 2, 3)
    r['skin'] = tex
    return r


def weld(P, N, C, I, cos=0.8):
    """Corners at one position whose normals agree within `cos` (and whose colours match) become one vertex, so the
    decimation sees the surface as one piece instead of a seam at every UV island or flat-shaded facet."""
    groups = {}
    for i, p in enumerate(P):
        groups.setdefault(tuple(np.round(p, 4)), []).append(i)
    remap = np.arange(len(P))
    for ids in groups.values():
        reps = []
        for i in ids:
            for j in reps:
                if np.dot(N[i], N[j]) > cos and (not C or C[i] == C[j]):
                    remap[i] = j
                    break
            else:
                reps.append(i)
    used = sorted(set(int(remap[v]) for t in I for v in t))
    newid = {o: n for n, o in enumerate(used)}
    out = []
    for t in I:
        a, b, c = (newid[int(remap[v])] for v in t)
        if a != b and b != c and a != c:
            out.append([a, b, c])
    Nw = np.array([N[i] for i in used])
    return P[used], Nw, [C[i] for i in used] if C else [], out


def write_part(blob, r, name, part, qlo, qext):
    """tools/vehicle_models.py write_part for per-vertex colours only (no atlas), welding before the decimation."""
    tris = part['tris']
    if not tris:
        return None
    vmap = {}
    P, N, C, I, UV = [], [], [], [], []
    origin = np.array(part.get('origin', (0, 0, 0)))
    for k in tris:
        pi = r['tri_prim'][k]
        p = r['prims'][pi]
        tri = []
        for vi in r['tri_idx'][k]:
            key = (pi, int(vi))
            if key not in vmap:
                vmap[key] = len(P)
                P.append(p['P'][vi] - origin)
                N.append(p['N'][vi])
                uv = p['UV'][vi] if p['UV'] is not None else None
                C.append(vm.sample_colour(r, p['material'], uv))
                UV.append((float(uv[0]), float(uv[1])) if uv is not None else (0.5, 0.5))
            tri.append(vmap[key])
        I.append(tri)
    P = np.array(P)
    if part.get('uv'):
        # A textured part keeps its UVs: no welding across UV seams (colours carry the UV's texel already).
        C = [tuple(c) + tuple(np.round(np.array(UV[i]) * 4096).astype(int)) for i, c in enumerate(C)]
    P, N, C, I = weld(P, N, C, I, part.get('weldCos', 0.8))
    if part.get('uv'):
        UV = [(c[3] / 4096, c[4] / 4096) for c in C]
        C = [c[:3] for c in C]
    if part.get('minPiece'):
        I = vm.drop_small_pieces(P, I, part['minPiece'])
    keep = part.get('keep', 1.0)
    target = int(len(tris) * keep)
    if len(I) > max(200, target):
        used, I = vm.decimate(P, I, target / len(I), part.get('borderCos', 0.9))
        P = P[used]
        N = N[used]
        C = [C[i] for i in used]
        if part.get('uv'):
            UV = [UV[i] for i in used]
    if len(P) > 65535:
        raise SystemExit('%s %s: too many vertices' % (r['meta']['type'], name))
    q = np.round((P + origin - qlo) / qext * 65534 - 32767).astype(np.int16)
    base = r['meta']['type'] + '.' + name
    blob.add(base + '.p', q, 'i2')
    blob.add(base + '.n', np.round(np.array(N) * 127).astype(np.int8), 'i1')
    if part.get('uv'):
        blob.add(base + '.uv', np.round(np.clip(np.array(UV), 0, 1) * 65535).astype(np.uint16), 'u2')
    else:
        blob.add(base + '.uv', np.zeros((len(P), 2), np.uint16) + 32768, 'u2')
    blob.add(base + '.c', np.array(C, dtype=np.uint8), 'u1')
    blob.add(base + '.i', np.array(I, dtype=np.uint16), 'u2')
    return len(I)


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    src = argv[1]
    only = set(argv[argv.index('--only') + 1].split(',')) if '--only' in argv else None
    results = []
    for model in MODELS:
        if only and model['name'] not in only:
            continue
        r = dict(heli=convert_heli, plane=convert_plane)[model['kind']](model, src)
        results.append(r)
        m = r['meta']
        print('%-9s %-28s dims %s parts %s' % (m['type'], m['title'], m['dims'], {k: len(v['tris']) for k, v in r['parts'].items()}))
    blob = vm.Blob()
    header = dict(version=1, models={})
    for r in results:
        m = r['meta']
        allP = np.concatenate([p['P'] for p in r['prims']])
        qlo, qhi = allP.min(0) - 0.01, allP.max(0) + 0.01
        qext = qhi - qlo
        m['quant'] = [round(float(v), 5) for v in qlo] + [round(float(v), 5) for v in qext]
        m['parts'] = {}
        tris = 0
        for name, part in r['parts'].items():
            n = write_part(blob, r, name, part, qlo, qext)
            if n:
                info = {'triangles': n}
                if 'origin' in part:
                    info['origin'] = [round(float(v), 4) for v in part['origin']]
                m['parts'][name] = info
                tris += n
        m['triangles'] = tris
        print('  %s: %d triangles %s' % (m['type'], tris, {k: v['triangles'] for k, v in m['parts'].items()}))
        header['models'][m['type']] = m
    header['arrays'] = blob.arrays
    head_json = json.dumps(header, separators=(',', ':')).encode()
    head_json += b' ' * (-(12 + len(head_json)) % 4)
    out = b'DECVM001' + struct.pack('<I', len(head_json)) + head_json + bytes(blob.data)
    out_dir = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(ROOT, 'assets')
    with open(os.path.join(out_dir, 'aircraft-models.bin'), 'wb') as fh:
        fh.write(out)
    print('aircraft models: %d models, %d bytes' % (len(results), len(out)))
    skins = [r['skin'] for r in results if 'skin' in r]
    if skins:
        # One skin texture (the flyable plane's exterior): assets/aircraft-skin.webp.
        skins[0].save(os.path.join(out_dir, 'aircraft-skin.webp'), 'WEBP', quality=86, method=6)
        print('aircraft skin: %d bytes' % os.path.getsize(os.path.join(out_dir, 'aircraft-skin.webp')))
    if '--credits' in argv:
        for model in MODELS:
            print('  %s by %s, %s, CC-BY 4.0' % (model['title'], model['author'], model['url']))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
