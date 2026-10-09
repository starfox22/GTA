#!/usr/bin/env python3
"""Vehicle models: convert downloaded ready-made car models (glTF, CC-BY) into the game's own data.

Reads the glTF / GLB files listed in MODELS (paths relative to SRC_DIR, the folder the
downloads were unpacked into) and writes

    assets/vehicle-models.bin    every model's parts in the game's model frame (metres; x ahead,
                                 y up, z to the right; the ground at y 0, the body centred in x
                                 and z), int16 positions, int8 normals, uint16 atlas UVs,
                                 uint8 lamp colours, uint16 triangles, and what the runtime needs
                                 to build the damage contract: the glasshouse measured as a
                                 CAR_BODIES `glass` record, the wheels' centres, the lamps'
                                 centres, the hood's hinge, the deck line, the sill.
    assets/vehicle-atlas.webp    one 2048 x 1024 colour atlas for all of them (each source
                                 texture once, sized by how much surface it covers).

Parts per model (src/vehicle-assets3d.js builds them): shell (paint below the belt), panels
(paint above it: pillars and roof), hood, glass (five panes in PANE_ORDER: left, front, right,
rear, roof), trim (everything else; the cabin's inside last, `trimOuter` triangles first),
lamps (headLeft, headRight, tailLeft, tailRight) and the wheels (tyre and rim, about their own
centres). No third-party Python packages beyond numpy and Pillow.

    python3 tools/vehicle_models.py SRC_DIR [--only TYPE,...] [--preview DIR]
"""
import hashlib
import io
import json
import math
import os
import re
import struct
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS_W, ATLAS_H = 2048, 1024
# Share of each part's triangles kept by the decimation (the street camera sees a car a few dozen pixels long).
KEEP = dict(paint=0.45, trim=0.4, cabin=0.25, wheel=0.3)

# ---------------------------------------------------------------------------------------------
# The models: game type, source file (under SRC_DIR), credit, and per-model hints.
#   front: the source axis the car faces ('+x', '-x', '+z', '-z'); None: found from the red lamps.
#   length: the real length in metres when the source is not in metres.
#   roles: material-name regex -> role, tried before the defaults.
#   paintTexture: the paint carries its own texture (a taxi's livery): drawn from the atlas.
Z = 'Daniel Zhabotinsky'
MODELS = [
    dict(type='sedan', front='+x', title="Fairheaven LT '80", author=Z,
         src='zhab/raisimTech_raisim2Lib/rsc/city/cars/fairheaven_lt80/model.gltf', up='+z',
         url='https://sketchfab.com/3d-models/fairheaven-lt-80-low-poly-model'),
    dict(type='taxi', front='+x', title="Canyon '75 Taxi", author=Z, paintTexture=True,
         src='zhab/raisimTech_raisim2Lib/rsc/city/cars/canyon75_taxi/model.gltf', up='+z',
         url='https://sketchfab.com/3d-models/canyon-75-taxi-low-poly-model'),
    dict(type='coupe', front='+x', title="Kiri '86", author=Z,
         src='zhab/raisimTech_raisim2Lib/rsc/city/cars/kiri86/model.gltf', up='+z',
         url='https://sketchfab.com/3d-models/kiri-86-low-poly-model'),
    dict(type='sport', front='-x', title="JDM Experimental Sportcar '90", author=Z,
         src='zhab/CloudDCrow_space-drive/public/models/white_fast/scene.gltf',
         url='https://sketchfab.com/3d-models/jdm-experimental-sportcar-90-low-poly-model'),
    dict(type='supercar', front='-z', keep=dict(trim=0.28, paint=0.4), title="Italian Supercar '84", author=Z,
         src='zhab/CloudDCrow_space-drive/public/models/blue_slow/scene.gltf',
         url='https://sketchfab.com/3d-models/italian-supercar-84-low-poly-model'),
    dict(type='luxury', front='+x', title='80 American Sedan', author=Z, length=5.2,
         src='zhab/samhovie_levitator/scene.gltf',
         url='https://sketchfab.com/3d-models/80-american-sedan-low-poly-model'),
    dict(type='muscle', front='-x', title="American Fullsize '73", author=Z,
         src='zhab/ayilinkou_NuaEngine/ModelViewer/Models/american_fullsize_73/scene.gltf',
         url='https://sketchfab.com/3d-models/american-fullsize-73-low-poly-model'),
    dict(type='rally', front='-x', title='German Modern Classic', author=Z, length=4.7,
         src='zhab/QuiSensei_Application-4/Static/Models/Car_2/scene.gltf',
         url='https://sketchfab.com/3d-models/german-modern-classic-low-poly-model',
         roles=[(r'corr_doorshut|Material_574', 'trim')]),
]

DEFAULT_ROLES = [
    (r'(?i)lights_and_glass_transperent', 'lensglass'),
    (r'(?i)glass_clean|corr_glass|^glass$', 'glass'),
    (r'(?i)bodymat|bodycolou?r|^corr_body$|_body$|^body$', 'paint'),
    (r'(?i)tire|tyre', 'tyre'),
    (r'(?i)^rim', 'rim'),
    (r'(?i)light', 'lamp'),
    (r'(?i)interior|doorcard|seat', 'interior'),
]


# ---------------------------------------------------------------------------------------------
# glTF reading
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Gltf:
    def __init__(self, path):
        self.dir = os.path.dirname(path)
        if path.lower().endswith('.glb'):
            data = open(path, 'rb').read()
            clen, = struct.unpack('<I', data[12:16])
            self.js = json.loads(data[20:20 + clen])
            off = 20 + clen
            blen, = struct.unpack('<I', data[off:off + 4])
            self.glb = data[off + 8:off + 8 + blen]
        else:
            self.js = json.load(open(path))
            self.glb = None
        if 'KHR_draco_mesh_compression' in self.js.get('extensionsRequired', []):
            raise SystemExit(path + ': Draco-compressed meshes are not supported')
        self.buffers = {}

    def buffer(self, i):
        if i not in self.buffers:
            uri = self.js['buffers'][i].get('uri')
            self.buffers[i] = self.glb if uri is None else open(os.path.join(self.dir, uri), 'rb').read()
        return self.buffers[i]

    def accessor(self, i):
        a = self.js['accessors'][i]
        bv = self.js['bufferViews'][a['bufferView']]
        dt = np.dtype(CT[a['componentType']])
        n = NC[a['type']]
        stride = bv.get('byteStride', 0) or dt.itemsize * n
        raw = self.buffer(bv['buffer'])
        start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        arr = np.array(np.ndarray((a['count'], n), dtype=dt, buffer=raw, offset=start, strides=(stride, dt.itemsize)))
        if a.get('normalized'):
            arr = arr.astype(np.float64) / float(np.iinfo(dt).max)
        return arr

    def image(self, tex_index):
        src = self.js['textures'][tex_index]['source']
        img = self.js['images'][src]
        if 'uri' in img:
            path = os.path.join(self.dir, img['uri'])
            if not os.path.exists(path):
                # A mirror that left out a shared series texture: the same file from another model of the series.
                path = series_texture(os.path.basename(img['uri']))
            return path, Image.open(path)
        bv = self.js['bufferViews'][img['bufferView']]
        raw = self.buffer(bv['buffer'])[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        return 'buf:%d' % src, Image.open(io.BytesIO(raw))


SERIES_ROOT = None
SERIES_INDEX = {}


def series_texture(name):
    if not SERIES_INDEX:
        for root, dirs, files in os.walk(SERIES_ROOT):
            dirs[:] = [d for d in dirs if d != '.git']
            for f in files:
                if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                    SERIES_INDEX.setdefault(os.path.splitext(f)[0], os.path.join(root, f))
    path = SERIES_INDEX.get(os.path.splitext(name)[0])
    if not path:
        raise SystemExit('missing texture ' + name)
    print('  (texture %s taken from %s)' % (name, os.path.relpath(path, SERIES_ROOT)))
    return path


def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    t = n.get('translation', [0, 0, 0])
    q = n.get('rotation', [0, 0, 0, 1])
    s = n.get('scale', [1, 1, 1])
    x, y, z, w = q
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * np.array(s)[None, :]
    M[:3, 3] = t
    return M


def load_primitives(g):
    """Every triangle primitive in world space: dicts of P, N, UV, index (Mx3), material, node name."""
    out = []
    js = g.js

    def walk(ni, parent):
        n = js['nodes'][ni]
        M = parent @ node_matrix(n)
        if 'mesh' in n:
            for pr in js['meshes'][n['mesh']]['primitives']:
                if pr.get('mode', 4) != 4:
                    continue
                at = pr['attributes']
                P = g.accessor(at['POSITION']).astype(np.float64)
                P = P @ M[:3, :3].T + M[:3, 3]
                if 'NORMAL' in at:
                    N = g.accessor(at['NORMAL']).astype(np.float64) @ np.linalg.inv(M[:3, :3])
                    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
                else:
                    N = None
                UV = g.accessor(at['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in at else None
                idx = g.accessor(pr['indices']).reshape(-1).astype(np.int64) if 'indices' in pr else np.arange(len(P))
                idx = idx[:len(idx) // 3 * 3].reshape(-1, 3)
                if np.linalg.det(M[:3, :3]) < 0:
                    idx = idx[:, ::-1]
                if N is None:
                    N = vertex_normals(P, idx)
                out.append(dict(P=P, N=N, UV=UV, index=idx, material=pr.get('material'), node=n.get('name', '')))
        for c in n.get('children', []):
            walk(c, M)

    for r in js['scenes'][js.get('scene', 0)]['nodes']:
        walk(r, np.eye(4))
    return out


def vertex_normals(P, idx):
    fn = np.cross(P[idx[:, 1]] - P[idx[:, 0]], P[idx[:, 2]] - P[idx[:, 0]])
    N = np.zeros_like(P)
    for k in range(3):
        np.add.at(N, idx[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


# ---------------------------------------------------------------------------------------------
# Frame: the car facing +x, y up, z to its right; the ground (lowest tyre) at 0.
def to_game_frame(prims, front):
    def rot(v):
        x, y, z = v[:, 0], v[:, 1], v[:, 2]
        if front == '+x':
            return np.stack([x, y, z], 1)
        if front == '-x':
            return np.stack([-x, y, -z], 1)
        if front == '+z':
            return np.stack([z, y, -x], 1)
        return np.stack([-z, y, x], 1)

    for p in prims:
        p['P'] = rot(p['P'])
        p['N'] = rot(p['N'])


# ---------------------------------------------------------------------------------------------
NODE_ROLES = [(r'(?i)(?<!steering_)(?<!steering )wheel|tire|tyre', 'tyre')]


def role_of(name, model, node=''):
    for rx, role in NODE_ROLES:
        if re.search(rx, node or ''):
            return role
    for rx, role in list(model.get('roles', [])) + DEFAULT_ROLES:
        if re.search(rx, name or ''):
            return role
    return 'trim'


def triangles(prims, mats, model):
    """Flatten to per-triangle records: prim id, corner vertex ids, centroid, face normal, area, role."""
    T = []
    for pi, p in enumerate(prims):
        name = mats[p['material']]['name'] if p['material'] is not None else ''
        role = role_of(name, model, p['node'])
        P, idx = p['P'], p['index']
        a, b, c = P[idx[:, 0]], P[idx[:, 1]], P[idx[:, 2]]
        fn = np.cross(b - a, c - a)
        area = np.linalg.norm(fn, axis=1) / 2
        fn = fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
        # A face's normal follows its vertices' (sources wind some parts either way).
        vn = p['N'][idx].mean(1)
        flip = (fn * vn).sum(1) < 0
        fn[flip] *= -1
        T.append(dict(prim=pi, idx=idx, cen=(a + b + c) / 3, fn=fn, area=area, role=np.array([role] * len(idx), dtype=object)))
    return T


def cat(T, key):
    return np.concatenate([t[key] for t in T])


def auto_front(prims, mats, model, images):
    """The axis the car faces: the end whose lamps are less red (the tail lights are red, the head lamps clear)."""
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    ext = hi - lo
    axis = 0 if ext[0] > ext[2] else 2
    mid = (lo[axis] + hi[axis]) / 2
    count = {1: [0, 0], -1: [0, 0]}
    for p in prims:
        m = mats[p['material']] if p['material'] is not None else {}
        if role_of(m.get('name', ''), model, p['node']) not in ('lamp', 'lensglass') or p['UV'] is None:
            continue
        img = images.get(p['material'])
        if img is None:
            continue
        arr = np.asarray(img.convert('RGB'))
        h, w = arr.shape[:2]
        idx = p['index']
        cen = p['P'][idx].mean(1)
        uv = p['UV'][idx].mean(1)
        col = arr[np.clip((uv[:, 1] % 1) * (h - 1), 0, h - 1).astype(int), np.clip((uv[:, 0] % 1) * (w - 1), 0, w - 1).astype(int)].astype(float)
        red = (col[:, 0] > 90) & (col[:, 0] > col[:, 1] * 1.7) & (col[:, 0] > col[:, 2] * 1.7)
        far = np.abs(cen[:, axis] - mid) > 0.3 * ext[axis]
        for end in (1, -1):
            sel = far & (np.sign(cen[:, axis] - mid) == end)
            count[end][0] += int((red & sel).sum())
            count[end][1] += int(sel.sum())
    share = {e: c[0] / max(1, c[1]) for e, c in count.items()}
    front = 1 if share[1] < share[-1] else -1
    return ('+' if front > 0 else '-') + 'xyz'[axis]


# ---------------------------------------------------------------------------------------------
def convert(model, src_root):
    path = os.path.join(src_root, model['src'])
    g = Gltf(path)
    mats = r_mats = g.js.get('materials', [])
    prims = load_primitives(g)
    # Base colour images per material (for the atlas and the lamps' colours).
    images, image_keys = {}, {}
    for mi, m in enumerate(mats):
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t is not None:
            key, img = g.image(t['index'])
            images[mi] = img
            image_keys[mi] = key
    if model.get('up') == '+z':
        for p in prims:
            for k in ('P', 'N'):
                v = p[k]
                p[k] = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)
    front = model.get('front') or auto_front(prims, mats, model, images)
    to_game_frame(prims, front)
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    if model.get('length'):
        s = model['length'] / (hi[0] - lo[0])
        for p in prims:
            p['P'] = p['P'] * s
        allP = allP * s
        lo, hi = lo * s, hi * s
    T = triangles(prims, mats, model)
    role = cat(T, 'role')
    cen = cat(T, 'cen')
    fn = cat(T, 'fn')
    area = cat(T, 'area')
    tri_prim = np.concatenate([np.full(len(t['idx']), t['prim']) for t in T])
    tri_idx = np.concatenate([t['idx'] for t in T])
    # Ground: the lowest tyre point; centre the body in x and z.
    tyreP = np.concatenate([prims[pi]['P'][tri_idx[k]] for k, pi in enumerate(tri_prim) if role[k] == 'tyre'] or [allP])
    shift = np.array([-(lo[0] + hi[0]) / 2, -tyreP[:, 1].min(), -(lo[2] + hi[2]) / 2])
    for p in prims:
        p['P'] = p['P'] + shift
    cen = cen + shift
    tyreP = tyreP + shift
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    L, W = hi[0] - lo[0], hi[2] - lo[2]
    V = lambda k: prims[tri_prim[k]]['P'][tri_idx[k]]  # noqa: E731

    # ---- Wheels: tyre triangles grouped by axle (gaps along x) and side.
    tyre_t = np.where(role == 'tyre')[0]
    wheels = []
    if len(tyre_t):
        xs = np.sort(np.unique(np.round(cen[tyre_t, 0], 2)))
        cuts = [xs[0] - 1]
        for a, b in zip(xs[:-1], xs[1:]):
            if b - a > 0.35:
                cuts.append((a + b) / 2)
        cuts.append(xs[-1] + 1)
        for i in range(len(cuts) - 1):
            for side in (-1, 1):
                sel = tyre_t[(cen[tyre_t, 0] > cuts[i]) & (cen[tyre_t, 0] < cuts[i + 1]) & (np.sign(cen[tyre_t, 2]) == side)]
                if len(sel) < 8:
                    continue
                pts = np.concatenate([V(k) for k in sel])
                a, b = pts.min(0), pts.max(0)
                wheels.append(dict(x=(a[0] + b[0]) / 2, y=(a[1] + b[1]) / 2, z=(a[2] + b[2]) / 2, r=(b[1] - a[1]) / 2,
                                   width=b[2] - a[2], side=side, tris=set(sel.tolist())))
    wheels.sort(key=lambda w: (-w['x'], w['side']))
    front_x = max(w['x'] for w in wheels) if wheels else 0
    for w in wheels:
        w['front'] = abs(w['x'] - front_x) < 0.2
    # Whatever else sits wholly inside a tyre (rims, discs, nuts) turns with it.
    cand = np.where(np.isin(role, ['trim', 'rim', 'interior', 'lamp']))[0]
    for w in wheels:
        for k in cand:
            p3 = V(k)
            if np.all(np.hypot(p3[:, 0] - w['x'], p3[:, 1] - w['y']) <= w['r'] * 1.03) and np.all(np.abs(p3[:, 2] - w['z']) <= w['width'] / 2 + 0.07):
                w['tris'].add(int(k))
    wheel_of = {}
    for wi, w in enumerate(wheels):
        for k in w['tris']:
            wheel_of[k] = wi

    # ---- Glass and the belt.
    is_glass = (role == 'glass') | (role == 'lensglass')
    side_glass = is_glass & (np.abs(fn[:, 2]) > 0.75) & (np.abs(cen[:, 0]) < 0.3 * L)
    if side_glass.sum() < 4:
        side_glass = is_glass
    sg_pts = np.concatenate([V(k) for k in np.where(side_glass)[0]])
    belt = float(np.percentile(sg_pts[:, 1], 3))
    lamp_zone = (np.abs(cen[:, 0]) > 0.25 * L) & (cen[:, 1] < belt - 0.03)
    role = role.copy()
    role[(role == 'lensglass') & lamp_zone] = 'lamp'
    role[role == 'lensglass'] = 'glass'
    role[(role == 'glass') & lamp_zone] = 'lamp'
    is_glass = role == 'glass'
    gl = np.where(is_glass)[0]
    gpts = np.concatenate([V(k) for k in gl])
    roof = float(np.percentile(gpts[:, 1], 99))
    gmid = (gpts[:, 0].min() + gpts[:, 0].max()) / 2
    # Panes: roof (flat up), sides (by the side the face is on), front and rear (by where it is).
    pane = np.full(len(role), -1)
    for k in gl:
        n = fn[k]
        if abs(n[1]) > 0.93:
            pane[k] = 4
        elif abs(n[2]) > abs(n[0]):
            pane[k] = 0 if cen[k, 2] < 0 else 2
        else:
            pane[k] = 1 if cen[k, 0] > gmid else 3

    def pane_pts(i):
        sel = gl[pane[gl] == i]
        return np.concatenate([V(k) for k in sel]) if len(sel) else None

    def foot_top(pts, fallback_foot, fallback_top):
        if pts is None:
            return fallback_foot, fallback_top
        y0, y1 = pts[:, 1].min(), pts[:, 1].max()
        lowp = pts[pts[:, 1] < y0 + 0.12 * (y1 - y0)]
        highp = pts[pts[:, 1] > y1 - 0.12 * (y1 - y0)]
        return float(np.median(lowp[:, 0])), float(np.median(highp[:, 0]))

    if os.environ.get('VM_DEBUG'):
        for i in range(5):
            pp = pane_pts(i)
            if pp is not None:
                print('   pane', i, len(pp), 'x', pp[:, 0].min().round(2), pp[:, 0].max().round(2), 'y', pp[:, 1].min().round(2), pp[:, 1].max().round(2))
    side_pts = np.concatenate([p for p in (pane_pts(0), pane_pts(2)) if p is not None])
    xf, rf = foot_top(pane_pts(1), side_pts[:, 0].max(), side_pts[:, 0].max() - 0.5)
    xb, rb = foot_top(pane_pts(3), side_pts[:, 0].min(), side_pts[:, 0].min() + 0.3)
    lowside = side_pts[side_pts[:, 1] < belt + 0.1 * (roof - belt)]
    highside = side_pts[side_pts[:, 1] > roof - 0.15 * (roof - belt)]
    half_base = float(np.percentile(np.abs(lowside[:, 2]), 90)) if len(lowside) else W * 0.42
    half_top = float(np.percentile(np.abs(highside[:, 2]), 90)) if len(highside) else W * 0.35
    glass = dict(base=belt, roof=roof, xf=xf, xb=xb, rf=rf, rb=rb, halfBase=half_base, halfTop=half_top)

    # ---- Lamps: lamp faces at the ends, head ahead, tail behind, by side.
    lamps = {}
    lamp_key = np.full(len(role), '', dtype=object)
    for k in np.where(role == 'lamp')[0]:
        if k in wheel_of:
            continue
        x = cen[k, 0]
        if abs(x) < 0.3 * L:
            role[k] = 'trim'
            continue
        lamp_key[k] = ('head' if x > 0 else 'tail') + ('Left' if cen[k, 2] < 0 else 'Right')
    for key in ('headLeft', 'headRight', 'tailLeft', 'tailRight'):
        sel = np.where(lamp_key == key)[0]
        if len(sel):
            pts = np.concatenate([V(k) for k in sel])
            a, b = pts.min(0), pts.max(0)
            lamps[key] = dict(x=float((a[0] + b[0]) / 2), y=float((a[1] + b[1]) / 2), z=float((a[2] + b[2]) / 2),
                              size=float(max(b[1] - a[1], b[2] - a[2])))

    # ---- Paint: hood (ahead of the screen's foot, facing up, between the fenders), panels (above the belt), shell.
    paint = np.where(role == 'paint')[0]
    hood = [k for k in paint if cen[k, 0] > xf + 0.02 and fn[k, 1] > 0.45 and abs(cen[k, 2]) < 0.4 * W and cen[k, 1] > belt - 0.45]
    hood_set = set(hood)
    panels = [k for k in paint if k not in hood_set and cen[k, 1] > belt + 0.03]
    panel_set = set(panels)
    shell = [k for k in paint if k not in hood_set and k not in panel_set]
    if hood:
        hp = np.concatenate([V(k) for k in hood])
        hinge_x = float(hp[:, 0].min())
        hinge_y = float(hp[hp[:, 0] < hinge_x + 0.08][:, 1].max())
    else:
        hinge_x, hinge_y = xf, belt
    paint_pts = np.concatenate([V(k) for k in paint])
    sidep = paint_pts[(np.abs(paint_pts[:, 2]) > 0.35 * W) & (np.abs(paint_pts[:, 0]) < 0.2 * L)]
    sill = float(np.percentile(sidep[:, 1], 4)) if len(sidep) else 0.3
    centre = paint_pts[np.abs(paint_pts[:, 2]) < 0.25]
    profile = []
    for i in range(41):
        x = lo[0] + (hi[0] - lo[0]) * i / 40
        near = centre[np.abs(centre[:, 0] - x) < 0.09]
        profile.append(round(float(near[:, 1].max()), 3) if len(near) else None)
    last = None
    for i in range(41):
        if profile[i] is None:
            profile[i] = last
        last = profile[i]
    profile = [p if p is not None else sill for p in profile]
    # The roof over the heads: the top line's highest point between the glass tops, less the skin (4 cm;
    # the liner's 3 cm are cabinProfile's), as a crown over the side glass's top (cars3d-headroom.js reads it as glassCrown).
    xs = [lo[0] + (hi[0] - lo[0]) * i / 40 for i in range(41)]
    over = [p for x, p in zip(xs, profile) if rb <= x <= rf]
    glass['crown'] = max(0.0, (max(over) if over else roof) - 0.04 - roof)

    # ---- Trim: the rest, the cabin's inside last; nothing that faces the road from under the axles.
    rest = [k for k in range(len(role)) if role[k] in ('trim', 'rim', 'interior', 'tyre', 'lamp') and k not in wheel_of and lamp_key[k] == '']
    wheel_r = min((w['r'] for w in wheels), default=0.3)
    inner = []
    outer = []
    for k in rest:
        if fn[k, 1] < -0.6 and cen[k, 1] < wheel_r * 1.1:
            continue
        inside = role[k] == 'interior' or (xb - 0.1 < cen[k, 0] < xf + 0.15 and sill + 0.05 < cen[k, 1] < roof and abs(cen[k, 2]) < half_base - 0.04)
        (inner if inside else outer).append(k)

    keep = dict(KEEP, **model.get('keep', {}))
    parts = {
        'shell': dict(tris=shell, keep=keep['paint']),
        'panels': dict(tris=panels, keep=keep['paint']),
        'hood': dict(tris=hood, keep=keep['paint']),
        'glass': dict(tris=sorted(gl.tolist(), key=lambda k: pane[k]), panes=[int((pane[gl] == i).sum()) for i in range(5)]),
        'trim': dict(tris=outer, keep=keep['trim']),
        'cabin': dict(tris=inner, keep=keep['cabin']),
    }
    for key in ('headLeft', 'headRight', 'tailLeft', 'tailRight'):
        parts[key] = dict(tris=np.where(lamp_key == key)[0].tolist(), colors=True)
    for wi, w in enumerate(wheels):
        # The wheel's inner face (toward the car's middle, under the arch) never shows: left out.
        tris = sorted(k for k in w['tris'] if not (fn[k, 2] * w['side'] < -0.3 and (cen[k, 2] - w['z']) * w['side'] < 0))
        rubber = [k for k in tris if re.search(r'(?i)tire|tyre', material_name(r_mats, prims, tri_prim[k]))]
        if not rubber:
            rubber = tris
        rubber_set = set(rubber)
        parts['wheel%d.tyre' % wi] = dict(tris=rubber, origin=(w['x'], w['y'], w['z']), keep=keep['wheel'])
        parts['wheel%d.rim' % wi] = dict(tris=[k for k in tris if k not in rubber_set], origin=(w['x'], w['y'], w['z']), keep=keep['wheel'])
    meta = dict(
        type=model['type'], title=model['title'], front=front,
        dims=[round(float(L), 3), round(float(hi[1]), 3), round(float(W), 3)],
        glass={k: round(float(v), 4) for k, v in glass.items()},
        wheels=[dict(x=round(float(w['x']), 4), y=round(float(w['y']), 4), z=round(float(w['z']), 4), r=round(float(w['r']), 4),
                     width=round(float(w['width']), 4), side=int(w['side']), front=bool(w['front'])) for w in wheels],
        lamps={k: {kk: round(vv, 4) for kk, vv in v.items()} for k, v in lamps.items()},
        hinge=[round(hinge_x, 4), round(hinge_y, 4)], sill=round(sill, 4), profile=profile,
        x0=round(float(lo[0]), 4), x1=round(float(hi[0]), 4),
        paintTexture=bool(model.get('paintTexture')),
        paintColor=paint_colour(mats, role, tri_prim, model),
    )
    return dict(meta=meta, prims=prims, mats=mats, images=images, image_keys=image_keys, parts=parts, tri_prim=tri_prim,
                tri_idx=tri_idx, role=role, area=area)


def material_name(mats, prims, pi):
    m = prims[pi]['material']
    return mats[m].get('name', '') if m is not None else ''


def paint_colour(mats, role, tri_prim, model):
    for m in mats:
        if role_of(m.get('name', ''), model) == 'paint':
            f = m.get('pbrMetallicRoughness', {}).get('baseColorFactor')
            if f:
                return '#%02x%02x%02x' % tuple(int(round(255 * min(1, max(0, c)) ** (1 / 2.2))) for c in f[:3])
    return None


# ---------------------------------------------------------------------------------------------
# Atlas: each source texture once (by content), sized by the surface it covers, shelf-packed.
def build_atlas(results):
    entries = {}  # hash -> dict(img, area, users=[(result, material)])
    solids = {}
    for r in results:
        used = {}
        textured = ('trim', 'rim', 'interior', 'tyre') + (('paint',) if r['meta']['paintTexture'] else ())
        for k in range(len(r['role'])):
            if r['role'][k] not in textured:
                continue
            m = r['prims'][r['tri_prim'][k]]['material']
            # The cabin's inside is seen through tinted glass: a third of the texels.
            used[m] = used.get(m, 0) + r['area'][k] * (0.35 if r['role'][k] == 'interior' else 1.0)
        r['tex_of'] = {}
        for m, a in used.items():
            mat = r['mats'][m] if m is not None else {}
            factor = tuple(mat.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1]))
            blend = mat.get('alphaMode') in ('BLEND', 'MASK')
            if m in r['images']:
                img = r['images'][m]
                h = hashlib.sha1(img.tobytes()[:200000] + repr((img.size, factor[:3], blend)).encode()).hexdigest()
                e = entries.setdefault(h, dict(img=img, area=0.0, factor=factor, blend=blend))
                e['area'] += a
                r['tex_of'][m] = h
            else:
                key = 'solid:%s' % (factor[:3],)
                solids[key] = factor
                r['tex_of'][m] = key
    # Sizes: pixels in proportion to the area covered, capped at the source's, until it packs.
    order = sorted(entries.items(), key=lambda kv: -kv[1]['area'])
    solid_rows = (len(solids) + 63) // 64
    lo_k, hi_k = 1.0, 1e7
    best = None
    for _ in range(40):
        k = math.sqrt(lo_k * hi_k)
        sizes = {}
        for h, e in order:
            w0, h0 = e['img'].size
            side = math.sqrt(e['area'] * k)
            sc = min(1.0, side / max(w0, h0), 512.0 / max(w0, h0))
            sizes[h] = (max(16, int(w0 * sc) // 4 * 4), max(16, int(h0 * sc) // 4 * 4))
        placed = shelf_pack(sizes, ATLAS_W, ATLAS_H - 8 * solid_rows - 4)
        if placed is None:
            hi_k = k
        else:
            lo_k = k
            best = (sizes, placed)
    sizes, placed = best
    atlas = Image.new('RGBA', (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
    rects = {}
    for h, (x, y) in placed.items():
        e = entries[h]
        w, hh = sizes[h]
        img = e['img'].convert('RGBA').resize((w, hh), Image.LANCZOS)
        a = np.asarray(img).astype(np.float64)
        f = e['factor']
        a[..., :3] *= np.array(f[:3])[None, None, :]
        if e['blend']:
            a[..., 3] *= f[3] if len(f) > 3 else 1
        else:
            a[..., 3] = 255
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
        # A 2-pixel border of the edge texels against bleeding at the smaller mips.
        pad = Image.new('RGBA', (w + 4, hh + 4))
        pad.paste(img.resize((w + 4, hh + 4), Image.NEAREST), (0, 0))
        pad.paste(img, (2, 2))
        atlas.paste(pad, (x - 2, y - 2))
        rects[h] = (x, y, w, hh)
    # Solid colours: 8x8 swatches along the bottom.
    for i, (key, f) in enumerate(sorted(solids.items())):
        x, y = (i % 64) * 32 + 12, ATLAS_H - 8 * (i // 64 + 1) - 2
        c = tuple(int(round(255 * min(1, max(0, v)) ** (1 / 2.2))) for v in f[:3]) + (255,)
        atlas.paste(Image.new('RGBA', (8, 8), c), (x - 2, y - 2))
        rects[key] = (x, y, 4, 4)
    print('atlas: %d textures, %d solids, density k=%.0f' % (len(entries), len(solids), lo_k))
    return atlas, rects


def shelf_pack(sizes, W, H):
    """Skyline bottom-left packing, largest first: each rectangle (2-pixel border round it) where its top lands lowest."""
    items = sorted(sizes.items(), key=lambda kv: -(kv[1][0] * kv[1][1]))
    sky = [[0, W, 0]]  # segments [x, width, y]
    out = {}
    for h, (w0, h0) in items:
        w, hh = w0 + 4, h0 + 4
        best = None
        for i in range(len(sky)):
            x = sky[i][0]
            if x + w > W:
                break
            y, need, k = 0, w, i
            while need > 0:
                y = max(y, sky[k][2])
                need -= sky[k][1]
                k += 1
            if y + hh <= H and (best is None or (y + hh, x) < (best[0] + best[1], best[2])):
                best = (y, hh, x, i)
        if best is None:
            return None
        y, _, x, i = best
        out[h] = (x + 2, y + 2)
        # Raise the skyline under the new rectangle.
        new = [x, w, y + hh]
        rest = []
        for seg in sky:
            a, b = seg[0], seg[0] + seg[1]
            if b <= x or a >= x + w:
                rest.append(seg)
                continue
            if a < x:
                rest.append([a, x - a, seg[2]])
            if b > x + w:
                rest.append([x + w, b - x - w, seg[2]])
        rest.append(new)
        rest.sort()
        merged = []
        for seg in rest:
            if merged and merged[-1][2] == seg[2] and merged[-1][0] + merged[-1][1] == seg[0]:
                merged[-1][1] += seg[1]
            else:
                merged.append(seg)
        sky = merged
    return out


# ---------------------------------------------------------------------------------------------
# Decimation: quadric half-edge collapse. A vertex goes only where every edge round it is shared
# by two triangles of the part (UV seams, creases, material and part borders are boundaries in
# the source's own indexing, so they stay put and nothing cracks); the surviving vertex keeps its
# own normal, UV and colour (nothing is interpolated); a collapse that would flip a face is skipped.
def decimate(P, I, keep):
    import heapq
    nv = len(P)
    F = [list(t) for t in I]
    alive = [True] * len(F)
    target = int(len(F) * keep)
    vf = [set() for _ in range(nv)]
    for fi, t in enumerate(F):
        for v in t:
            vf[v].add(fi)
    edge_count = {}
    for t in F:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            e = (a, b) if a < b else (b, a)
            edge_count[e] = edge_count.get(e, 0) + 1
    border = np.zeros(nv, bool)
    for (a, b), c in edge_count.items():
        if c != 2:
            border[a] = border[b] = True
    Q = np.zeros((nv, 4, 4))
    for t in F:
        a, b, c = P[t[0]], P[t[1]], P[t[2]]
        n = np.cross(b - a, c - a)
        area = np.linalg.norm(n)
        if area < 1e-12:
            continue
        n = n / area
        pl = np.append(n, -n.dot(a))
        K = np.outer(pl, pl) * area
        for v in t:
            Q[v] += K
    H = np.c_[P, np.ones(nv)]

    def cost(u, v):
        h = H[v]
        return float(h @ (Q[u] + Q[v]) @ h)

    def border_pair(u):
        # A border vertex on a straight run of border (two border edges within ~10 degrees): its two neighbours there.
        seen = {}
        for fi in vf[u]:
            for x in F[fi]:
                if x != u:
                    seen[x] = seen.get(x, 0) + 1
        ends = [x for x, c in seen.items() if c == 1]
        if len(ends) != 2 or any(c > 2 for c in seen.values()):
            return None
        a, b = ends
        d1, d2 = P[u] - P[a], P[b] - P[u]
        n1, n2 = np.linalg.norm(d1), np.linalg.norm(d2)
        if n1 < 1e-9 or n2 < 1e-9 or d1.dot(d2) < 0.985 * n1 * n2:
            return None
        return ends

    def push(u, v):
        if border[u]:
            ends = border_pair(u)
            if not ends or v not in ends:
                return
        heapq.heappush(heap, (cost(u, v), u, v))

    heap = []
    for (a, b) in edge_count:
        push(a, b)
        push(b, a)
    live = len(F)
    gone = [False] * nv
    stamp = [0] * nv
    while live > target and heap:
        c, u, v = heapq.heappop(heap)
        if gone[u] or gone[v]:
            continue
        if abs(c - cost(u, v)) > 1e-9 * (1 + abs(c)):
            continue
        edge = 2
        if border[u]:
            ends = border_pair(u)
            if not ends or v not in ends:
                continue
            edge = 1
        shared = [fi for fi in vf[u] if v in F[fi]]
        if len(shared) != edge:
            continue
        nu = set(x for fi in vf[u] for x in F[fi]) - {u}
        nvv = set(x for fi in vf[v] for x in F[fi]) - {v}
        if len(nu & nvv) != edge:
            continue
        ok = True
        for fi in vf[u]:
            if fi in shared:
                continue
            t = F[fi]
            old = np.cross(P[t[1]] - P[t[0]], P[t[2]] - P[t[0]])
            nt = [v if x == u else x for x in t]
            new = np.cross(P[nt[1]] - P[nt[0]], P[nt[2]] - P[nt[0]])
            if old.dot(new) <= 0.3 * np.linalg.norm(old) * np.linalg.norm(new):
                ok = False
                break
        if not ok:
            continue
        for fi in shared:
            alive[fi] = False
            live -= 1
            for x in F[fi]:
                vf[x].discard(fi)
        for fi in list(vf[u]):
            F[fi] = [v if x == u else x for x in F[fi]]
            vf[v].add(fi)
        vf[u] = set()
        gone[u] = True
        Q[v] += Q[u]
        for x in set(y for fi in vf[v] for y in F[fi]) - {v}:
            push(v, x)
            if not gone[x]:
                push(x, v)
    tris = [F[fi] for fi in range(len(F)) if alive[fi]]
    used = sorted(set(x for t in tris for x in t))
    remap = {o: n for n, o in enumerate(used)}
    return used, [[remap[x] for x in t] for t in tris]

# ---------------------------------------------------------------------------------------------
# Output
class Blob:
    def __init__(self):
        self.data = bytearray()
        self.arrays = {}

    def add(self, name, arr, kind):
        while len(self.data) % 4:
            self.data.append(0)
        self.arrays[name] = [kind, len(self.data), int(arr.size)]
        self.data += arr.tobytes()


def write_part(blob, r, name, part, rects, qlo, qext):
    tris = part['tris']
    if not tris:
        return None
    vmap = {}
    P, N, UV, C, I = [], [], [], [], []
    origin = np.array(part.get('origin', (0, 0, 0)))
    for k in tris:
        pi = r['tri_prim'][k]
        p = r['prims'][pi]
        tri = []
        shift = (0.0, 0.0)
        if p['UV'] is not None:
            tuv = p['UV'][r['tri_idx'][k]]
            if tuv.min() < -0.01 or tuv.max() > 1.01:
                shift = (math.floor(float(tuv[:, 0].min()) + 0.005), math.floor(float(tuv[:, 1].min()) + 0.005))
        for vi in r['tri_idx'][k]:
            key = (pi, int(vi), shift)
            if key not in vmap:
                vmap[key] = len(P)
                P.append(p['P'][vi] - origin)
                N.append(p['N'][vi])
                uv = p['UV'][vi] if p['UV'] is not None else np.array([0.5, 0.5])
                rect = rects.get(r['tex_of'].get(p['material']), (0, 0, 1, 1))
                u = min(1.0, max(0.0, float(uv[0]) - shift[0])) if not math.isnan(uv[0]) else 0.5
                v = min(1.0, max(0.0, float(uv[1]) - shift[1])) if not math.isnan(uv[1]) else 0.5
                UV.append(((rect[0] + u * rect[2]) / ATLAS_W, (rect[1] + v * rect[3]) / ATLAS_H))
                if part.get('colors'):
                    C.append(sample_colour(r, p['material'], uv))
            tri.append(vmap[key])
        I.append(tri)
    P = np.array(P)
    keep = part.get('keep', 1.0)
    if keep < 1.0 and len(I) > 200:
        used, I = decimate(P, I, keep)
        P = P[used]
        N = [N[i] for i in used]
        UV = [UV[i] for i in used]
        if C:
            C = [C[i] for i in used]
    if len(P) > 65535:
        raise SystemExit('%s %s: too many vertices' % (r['meta']['type'], name))
    q = np.round((P + origin - qlo) / qext * 65534 - 32767).astype(np.int16)
    base = r['meta']['type'] + '.' + name
    blob.add(base + '.p', q, 'i2')
    blob.add(base + '.n', np.round(np.array(N) * 127).astype(np.int8), 'i1')
    blob.add(base + '.uv', np.round(np.array(UV) * 65535).astype(np.uint16), 'u2')
    if C:
        blob.add(base + '.c', np.array(C, dtype=np.uint8), 'u1')
    blob.add(base + '.i', np.array(I, dtype=np.uint16), 'u2')
    return len(I)


def sample_colour(r, m, uv):
    mat = r['mats'][m] if m is not None else {}
    f = mat.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])
    c = np.array(f[:3], dtype=np.float64)
    img = r['images'].get(m)
    if img is not None and uv is not None:
        if 'rgb' not in r:
            r['rgb'] = {}
        if m not in r['rgb']:
            r['rgb'][m] = np.asarray(img.convert('RGB'))
        a = r['rgb'][m]
        h, w = a.shape[:2]
        x = int(min(w - 1, max(0, (uv[0] % 1) * w)))
        y = int(min(h - 1, max(0, (uv[1] % 1) * h)))
        c = c * a[y, x] / 255.0
    else:
        c = c ** (1 / 2.2)
    return [int(min(255, max(0, round(v * 255)))) for v in c]


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    src = argv[1]
    global SERIES_ROOT
    SERIES_ROOT = src
    only = None
    if '--only' in argv:
        only = set(argv[argv.index('--only') + 1].split(','))
    results = []
    for model in MODELS:
        if only and model['type'] not in only:
            continue
        r = convert(model, src)
        results.append(r)
        m = r['meta']
        counts = {k: len(v['tris']) for k, v in r['parts'].items() if not k.startswith('wheel')}
        print('%-9s %-30s front %s dims %s belt %.2f roof %.2f wheels %d parts %s' % (
            m['type'], m['title'], m['front'], m['dims'], m['glass']['base'], m['glass']['roof'], len(m['wheels']), counts))
    atlas, rects = build_atlas(results)
    blob = Blob()
    header = dict(version=1, atlas=[ATLAS_W, ATLAS_H], models={})
    for r in results:
        m = r['meta']
        allP = np.concatenate([p['P'] for p in r['prims']])
        qlo, qhi = allP.min(0) - 0.01, allP.max(0) + 0.01
        qext = qhi - qlo
        m['quant'] = [round(float(v), 5) for v in qlo] + [round(float(v), 5) for v in qext]
        m['parts'] = {}
        tris = 0
        for name, part in r['parts'].items():
            n = write_part(blob, r, name, part, rects, qlo, qext)
            if n:
                info = {'triangles': n}
                if 'panes' in part:
                    info['panes'] = part['panes']
                if 'origin' in part:
                    info['origin'] = [round(float(v), 4) for v in part['origin']]
                m['parts'][name] = info
                tris += n
        m['triangles'] = tris
        header['models'][m['type']] = m
    header['arrays'] = blob.arrays
    head_json = json.dumps(header, separators=(',', ':')).encode()
    head_json += b' ' * (-(12 + len(head_json)) % 4)  # the arrays start 4-aligned
    out = b'DECVM001' + struct.pack('<I', len(head_json)) + head_json + bytes(blob.data)
    with open(os.path.join(ROOT, 'assets/vehicle-models.bin'), 'wb') as fh:
        fh.write(out)
    atlas.save(os.path.join(ROOT, 'assets/vehicle-atlas.webp'), 'WEBP', quality=88, method=6)
    print('vehicle models: %d models, %d bytes; atlas %d bytes' % (
        len(results), len(out), os.path.getsize(os.path.join(ROOT, 'assets/vehicle-atlas.webp'))))
    if '--credits' in argv:
        # The credit each mirror's license.txt asks for (paste into docs/THIRD_PARTY_CREDITS.txt).
        for model in MODELS:
            if only and model['type'] not in only:
                continue
            lic = os.path.join(src, os.path.dirname(model['src']), 'license.txt')
            text = open(lic, encoding='utf-8', errors='replace').read() if os.path.exists(lic) else ''
            line = re.search(r'This work is based on (.*)', text)
            print('  %s (%s): %s' % (model['title'], model['type'], line.group(1).strip() if line else model.get('url')))
    if '--preview' in argv:
        atlas.convert('RGB').resize((1024, 512)).save(os.path.join(argv[argv.index('--preview') + 1], 'atlas.jpg'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
