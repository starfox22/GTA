#!/usr/bin/env python3
"""Aurora, the unicorn statue: re-pose the three.js example horse and sculpt her.

Reads tools/models/Horse.glb (the three.js examples horse, MIT; originally from
"3 Dreams of Black", ro.me, Apache 2.0; see docs/THIRD_PARTY_CREDITS.txt),
welds its 796 vertices into the closed 494-vertex cage, skins it to a small
hand-placed skeleton (automatic weights: inverse distance to the bones, then
smoothed over the mesh), thickens the legs, draws the model's own tail in to a
stub, and poses her rearing (a levade: the body pitched up 40 degrees, the
hind legs gathered under her, the forelegs folded high, the neck arched and
the head turned to her right, towards the street camera). Then it lays out the
sculpted parts on the smooth (twice Loop-subdivided) surface: the mane (locks
off the crest, streaming back in the wind, most to her right), the forelock,
the tail (an S down to the plinth, where it rests, and fanning out behind)
and the horn's footing on the forehead.

Writes assets/unicorn-horse.json (millimetres, life size; x forward, y up,
mirrored so that -z is the side she turns to, the street camera's): the posed cage (`vertices`, `triangles`: src/unicorn3d.js
Loop-subdivides it twice at load), the locks (Catmull-Rom control rings
[x, y, z, r, w] and the direction their broad side faces) and the horn.

    python3 tools/unicorn_model.py            # writes the asset
    python3 tools/unicorn_model.py --obj f    # also the whole sculpt as OBJ
"""
import json
import math
import os
import struct
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'tools', 'models', 'Horse.glb')
OUT = os.path.join(ROOT, 'assets', 'unicorn-horse.json')

_CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}
_NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}


def load_horse(path=SOURCE):
    """The rest pose (the first gallop frame), welded into a closed mesh."""
    data = open(path, 'rb').read()
    n = struct.unpack('<I', data[12:16])[0]
    gltf = json.loads(data[20:20 + n])
    base = 20 + n + 8

    def accessor(i):
        a = gltf['accessors'][i]
        view = gltf['bufferViews'][a['bufferView']]
        off = base + view.get('byteOffset', 0) + a.get('byteOffset', 0)
        k = _NC[a['type']]
        arr = np.frombuffer(data, _CT[a['componentType']], a['count'] * k, off)
        return arr.reshape(a['count'], k) if k > 1 else arr

    prim = gltf['meshes'][0]['primitives'][0]
    pos = accessor(prim['attributes']['POSITION']).astype(np.float64)
    tris = accessor(prim['indices']).astype(np.int64).reshape(-1, 3)
    verts, inv = np.unique(np.round(pos, 2), axis=0, return_inverse=True)
    return verts, inv.ravel()[tris]


# ---- Skeleton (rest-pose units: about centimetres; z forward, y up, x to her left)
# Each bone: name, parent, head (joint), tail, side (+1 left legs, -1 right, 0 all).
def _p(z, y, x=0.0):
    return np.array([x, y, z], dtype=np.float64)


BONES = [
    ('pelvis', None, _p(-95, 120), _p(0, 115), 0),
    ('chest', 'pelvis', _p(0, 115), _p(58, 118), 0),
    ('neck1', 'chest', _p(60, 125), _p(85, 152), 0),
    ('neck2', 'neck1', _p(85, 152), _p(103, 172), 0),
    ('head', 'neck2', _p(103, 172), _p(118, 128), 0),
    ('tail1', 'pelvis', _p(-100, 140), _p(-130, 148), 0),
    ('tail2', 'tail1', _p(-130, 148), _p(-185, 130), 0),
]
_LEGS = {
    'RH': (-11, 'pelvis', [(-95, 118), (-105, 92), (-140, 82), (-165, 47), (-182, 40)]),
    'LH': (9, 'pelvis', [(-90, 118), (-80, 88), (-117, 68), (-122, 20), (-117, 6)]),
    'RF': (-9, 'chest', [(55, 112), (40, 85), (43, 48), (37, 18), (46, 4)]),
    'LF': (11, 'chest', [(58, 112), (62, 87), (95, 76), (118, 42), (129, 32)]),
}
_SEGMENTS = ['upper', 'lower', 'cannon', 'pastern']
for _leg, (_x, _parent, _joints) in _LEGS.items():
    for _i, _seg in enumerate(_SEGMENTS):
        BONES.append((f'{_leg}.{_seg}', _parent if _i == 0 else f'{_leg}.{_SEGMENTS[_i - 1]}',
                      _p(*_joints[_i], _x * 0.6 if _i == 0 else _x), _p(*_joints[_i + 1], _x), 1 if _x > 0 else -1))

# ---- The pose: each bone's direction in the side plane (degrees from forward,
# towards up), and a turn about the vertical at its joint (degrees, + to her left).
POSE = {
    'pelvis': (47, 0), 'chest': (55, 0),
    'neck1': (84, -6), 'neck2': (62, -12), 'head': (-34, -10),
    'tail1': (215, 0), 'tail2': (250, 0),
    'RH.upper': (-25, 0), 'RH.lower': (-145, 0), 'RH.cannon': (-62, 0), 'RH.pastern': (-28, 0),
    'LH.upper': (-15, 0), 'LH.lower': (-136, 0), 'LH.cannon': (-70, 0), 'LH.pastern': (-22, 0),
    'RF.upper': (-72, 0), 'RF.lower': (12, 0), 'RF.cannon': (-100, 0), 'RF.pastern': (-125, 0),
    'LF.upper': (-88, 0), 'LF.lower': (-18, 0), 'LF.cannon': (-118, 0), 'LF.pastern': (-145, 0),
}
# How much each leg segment is thickened before posing (Loop subdivision
# shrinks thin limbs; a bronze leg reads stronger than the lean model's).
INFLATE = {'upper': 0.08, 'lower': 0.26, 'cannon': 0.4, 'pastern': 0.5}
DOCK = _p(-101, 138)


def _side_angle(v):
    return math.degrees(math.atan2(v[1], v[2]))


def _rot_x(deg):
    """Turn in the side plane from forward (+z) towards up (+y)."""
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, s], [0, -s, c]])


def _rot_y(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def _unit(v):
    return v / np.linalg.norm(v)


def skin_weights(verts, tris):
    d = np.zeros((len(verts), len(BONES)))
    for j, (_, _, a, b, side) in enumerate(BONES):
        ab = b - a
        t = np.clip(((verts - a) @ ab) / (ab @ ab), 0, 1)
        d[:, j] = np.linalg.norm(verts - (a + t[:, None] * ab), axis=1)
        if side:
            d[verts[:, 0] * side < -3, j] = 1e6
    w = 1.0 / (d + 1.0) ** 5
    w /= w.sum(1, keepdims=True)
    # Smoothed over the mesh, so the joints bend softly.
    nbr = [set() for _ in verts]
    for a, b, c in tris:
        nbr[a] |= {b, c}
        nbr[b] |= {a, c}
        nbr[c] |= {a, b}
    for _ in range(2):
        w = 0.5 * w + 0.5 * np.array([w[list(n)].mean(0) for n in nbr])
    w[w < 0.02] = 0
    return w / w.sum(1, keepdims=True)


def sculpt_rest(verts, w):
    """Fuller legs; the model's tail drawn in to a stub under the sculpted one."""
    v = verts.copy()
    for j, (name, _, a, b, _) in enumerate(BONES):
        k = INFLATE.get(name.split('.')[-1]) if '.' in name else None
        if k:
            ab = b - a
            t = np.clip(((verts - a) @ ab) / (ab @ ab), 0, 1)
            v += w[:, j:j + 1] * k * (verts - (a + t[:, None] * ab))
    tail = w[:, [j for j, b in enumerate(BONES) if b[0].startswith('tail')]].sum(1)
    pull = np.clip((tail - 0.25) / 0.5, 0, 1)[:, None] * 0.85
    return v + (DOCK - v) * pull


def pose_matrices(pose=POSE):
    """World 4x4 per bone, rest to posed. Directions are absolute; each joint
    follows its parent."""
    mats = {}
    for name, parent, head, tail, _ in BONES:
        target, turn = pose[name]
        R = _rot_y(turn) @ _rot_x(target - _side_angle(tail - head))
        P = mats[parent] if parent else np.eye(4)
        M = np.eye(4)
        M[:3, :3] = R
        M[:3, 3] = (P @ np.append(head, 1))[:3] - R @ head
        mats[name] = M
    return mats


def pose_horse(verts, tris, pose=POSE):
    w = skin_weights(verts, tris)
    rest = sculpt_rest(verts, w)
    mats = pose_matrices(pose)
    hom = np.hstack([rest, np.ones((len(rest), 1))])
    out = np.zeros_like(rest)
    for j, b in enumerate(BONES):
        out += w[:, j:j + 1] * (hom @ mats[b[0]].T)[:, :3]
    return out, mats


def loop_subdivide(V, F):
    """One Loop step of a closed mesh (src/unicorn3d.js does the same at load).
    Old vertices keep their indices; the edge points follow."""
    nv = len(V)
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    opp = np.concatenate([F[:, 2], F[:, 0], F[:, 1]])
    Es = np.sort(E, axis=1)
    uk, inv = np.unique(Es[:, 0] * nv + Es[:, 1], return_inverse=True)
    inv = inv.ravel()
    ea, eb = uk // nv, uk % nv
    oppsum = np.zeros((len(uk), 3))
    np.add.at(oppsum, inv, V[opp])
    EP = 0.375 * (V[ea] + V[eb]) + 0.125 * oppsum
    nsum = np.zeros((nv, 3))
    np.add.at(nsum, ea, V[eb])
    np.add.at(nsum, eb, V[ea])
    val = np.bincount(ea, minlength=nv) + np.bincount(eb, minlength=nv)
    beta = np.where(val == 3, 3 / 16, 3 / (8 * np.maximum(val, 1)))
    VP = V * (1 - val * beta)[:, None] + nsum * beta[:, None]
    e = inv.reshape(3, -1).T + nv
    a, b, c = F.T
    NF = np.vstack([np.stack([a, e[:, 0], e[:, 2]], 1), np.stack([b, e[:, 1], e[:, 0]], 1),
                    np.stack([c, e[:, 2], e[:, 1]], 1), e])
    return np.vstack([VP, EP]), NF


def surface_along(V, F, origin, direction):
    """Where a ray from inside leaves the mesh (the outermost hit)."""
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    e1, e2 = b - a, c - a
    pv = np.cross(direction, e2)
    det = (e1 * pv).sum(1)
    ok = np.abs(det) > 1e-9
    inv = np.where(ok, 1 / np.where(ok, det, 1), 0)
    tv = origin - a
    u = (tv * pv).sum(1) * inv
    qv = np.cross(tv, e1)
    v = (qv @ direction) * inv
    t = (e2 * qv).sum(1) * inv
    hit = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0)
    return origin + direction * (t[hit].max() if hit.any() else 0)


def _bone(name):
    return next(b for b in BONES if b[0] == name)


def bone_frame(mats, name, s):
    """A posed point s along a bone, its posed direction, its dorsal (or, on the
    head, frontal) normal in the side plane, and her right."""
    _, _, head, tail, _ = _bone(name)
    M = mats[name]
    R = M[:3, :3]
    t = _unit(tail - head)
    return ((M @ np.append(head + (tail - head) * s, 1))[:3], R @ t,
            R @ _unit(np.array([0, t[2], -t[1]])), R @ np.array([-1.0, 0, 0]))


def catmull(pts, n):
    """Resample a polyline with a centripetal-free (uniform) Catmull-Rom spline."""
    pts = np.asarray(pts, dtype=np.float64)
    out = []
    m = len(pts)
    for k in range(n):
        f = k / (n - 1) * (m - 1)
        i = min(int(f), m - 2)
        t = f - i
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, m - 1)]
        out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    return np.array(out)


# ---- The sculpted parts ------------------------------------------------------
BACK = np.array([0, 0, -1.0])
DOWN = np.array([0, -1.0, 0])
UP = -DOWN
RIGHT = np.array([-1.0, 0, 0])


def _lock(points, width, thick, hint):
    """A lock: control points (Catmull-Rom), its width and thickness profile
    along it (functions of 0..1), and the direction its broad side faces."""
    n = len(points)
    rings = []
    for i, p in enumerate(points):
        u = i / (n - 1)
        rings.append([*p, thick(u), width(u)])
    return {'rings': rings, 'hint': list(_unit(np.asarray(hint, dtype=np.float64)))}


def sculpt_mane(V, F, mats):
    """The crest from withers to poll, found on the smooth surface, and the
    locks off it: long wind-swept locks streaming back, most falling to her
    right (the street camera's side), a few to her left, the lower ones lying
    on the neck; a forelock swept to her right beside the horn."""
    axis = [('chest', 0.62), ('chest', 0.85), ('neck1', 0.1), ('neck1', 0.4), ('neck1', 0.7), ('neck1', 1.0),
            ('neck2', 0.35), ('neck2', 0.7), ('neck2', 0.98)]
    crest, normals, rights = [], [], []
    for name, s in axis:
        p, t, n, r = bone_frame(mats, name, s)
        crest.append(surface_along(V, F, p, n))
        normals.append(n)
        rights.append(r)
    N_ROOTS = 17
    crest = catmull(crest, N_ROOTS)
    normals = catmull(normals, N_ROOTS)
    rights = catmull(rights, N_ROOTS)
    locks = []
    rng = np.random.default_rng(7)
    for i in range(N_ROOTS):
        u = i / (N_ROOTS - 1)                  # 0 at the withers, 1 at the poll
        c, n, r = crest[i], _unit(normals[i]), _unit(rights[i])
        along = _unit(crest[min(i + 1, N_ROOTS - 1)] - crest[max(i - 1, 0)])
        for layer in (0, 1, 2):
            # Layer 2 falls to her left, every third root.
            side = -1 if layer == 2 else 1
            if layer == 2 and i % 3 != 1:
                continue
            length = (46 + 16 * math.sin(math.pi * min(1, u * 1.25))) * (1.0, 0.82, 0.7)[layer] * rng.uniform(0.9, 1.1)
            lift = (0.55, 0.3, 0.2)[layer]
            fan = (0.28, 0.62, 0.45)[layer] * side
            droop = (0.45, 0.8, 0.9)[layer] * (1.15 - 0.5 * u)
            phase = rng.uniform(0, math.tau)
            pts = []
            for k in range(7):
                s = k / 6
                wave = 0.09 * length * math.sin(phase + s * 5.2) * s
                p = (c - n * 1.5 + n * length * lift * math.sin(min(1, s * 1.6) * math.pi / 2) * (1 - 0.35 * s)
                     + BACK * length * 0.75 * s + DOWN * length * droop * s * s
                     + r * length * fan * s ** 0.8 + along * length * 0.12 * s
                     + UP * wave + r * wave * 0.5)
                pts.append(p)
            # A curl at the tip.
            tip = pts[-1] + _unit(pts[-1] - pts[-2]) * 5 + UP * 3 + r * side * 2
            pts.append(tip)
            width = 9.5 * rng.uniform(0.85, 1.15) * (1.0, 0.9, 0.75)[layer]
            locks.append(_lock(pts, lambda s, W=width: W * (0.55 + 1.4 * s) * (1 - s) ** 0.9 + 0.3,
                               lambda s, W=width: W * 0.3 * (1 - s) ** 0.8 + 0.25,
                               n * 0.4 + r * side * 0.9 + UP * 0.3))
    # The forelock: from between the ears, forward over the brow and swept to her right.
    for k, (dz, fan, length) in enumerate(((0.0, 0.5, 26), (-0.1, 0.9, 22), (0.1, 0.25, 20))):
        p, h, f, r = bone_frame(mats, 'head', 0.04 + dz * 0.2)
        root = surface_along(V, F, p, _unit(f * 0.6 - h * 0.8))
        pts = []
        for j in range(6):
            s = j / 5
            pts.append(root + h * length * 0.55 * s + f * length * 0.25 * math.sin(s * math.pi) + r * length * fan * s * s + BACK * length * 0.2 * s * s)
        locks.append(_lock(pts, lambda s: 6.5 * (0.7 + s) * (1 - s) ** 0.8 + 0.3, lambda s: 2.0 * (1 - s) + 0.3, f + r * 0.4))
    return locks


def sculpt_tail(mats):
    """The tail: raised off the croup, falling in an S to the plinth (where the
    main lock rests, the third point of support) and fanning out behind."""
    dock = (mats['pelvis'] @ np.append(DOCK, 1))[:3]
    g = 1.5 - dock[1]                                  # the plinth, from the dock
    # The centre line (forward, up offsets from the dock): out of the croup in
    # a raised arch, down in a long curve to the plinth, then along it.
    core = np.array([(4, -3), (-8, 3), (-17, 0), (-24, -11), (-29, -29), (-32, -50), (-32, g * 0.72),
                     (-29, g * 0.9), (-31, g + 1.5), (-42, g + 0.5), (-52, g + 4)], dtype=np.float64)
    fine = catmull(core, 120)
    X = np.array([1.0, 0, 0])
    FWD = np.array([0, 0, 1.0])
    locks = []
    rng = np.random.default_rng(11)
    N = 15
    for i in range(N):
        a = (i / (N - 1)) * 2 - 1                                 # -1 .. 1 across the fan
        b = rng.uniform(-1, 1)
        main = abs(a) < 0.3
        end = 1.0 if main else rng.uniform(0.6, 0.93) if abs(a) > 0.6 else rng.uniform(0.8, 1.0)
        pts = []
        for k in range(10):
            s = k / 9 * end
            z, y = fine[min(119, int(s * 119))]
            spread = s ** 1.5
            lat = a * (2 + 34 * spread) + math.sin(s * 7 + i) * 2.5 * s
            dep = b * (2 + 10 * spread)
            pts.append(dock + FWD * (z + dep) + UP * y + X * lat)
        # The ends curl outwards (and up, where they lie on the plinth).
        last = pts[-1]
        pts.append(last + _unit(last - pts[-2]) * 6 + X * 4 * (1 if a >= 0 else -1) + UP * (3 if end > 0.95 else 1))
        width = (12.5 if main else 9.5) * rng.uniform(0.85, 1.12)
        # Slim at the dock, the hair filling out as it falls, tapering to the ends.
        locks.append(_lock(pts, lambda s, W=width: W * (0.45 + 0.75 * min(s / 0.45, 1) ** 0.7) * (1 - s) ** 0.6 + 0.4,
                           lambda s, W=width: W * (0.22 + 0.16 * min(s / 0.45, 1)) * (1 - s) ** 0.6 + 0.4,
                           X * (1 if a >= 0 else -1) + BACK * 0.35))
    return locks


def sculpt_hooves(mats):
    """Hooves: a short cone on each pastern, the wall flaring to a flat sole
    (the model's own feet are soft wedges)."""
    out = []
    for leg, (_, _, joints) in _LEGS.items():
        name = f'{leg}.pastern'
        _, _, head, tail, _ = _bone(name)
        M = mats[name]
        a = (M @ np.append(head, 1))[:3]
        b = (M @ np.append(tail, 1))[:3]
        d = _unit(b - a)
        hind = leg.endswith('H')
        # Standing hooves put their soles on the plinth; folded ones follow the pastern.
        axis = _unit(d * 0.35 + DOWN * 0.65) if hind else _unit(d)
        top = a + (b - a) * 0.72
        rings = [top - axis * 3, top + axis * 1.5, top + axis * 6, top + axis * 6.7]
        radii = [(5.2, 5.6), (6.0, 6.4), (7.0, 7.4), (6.7, 7.1)]
        out.append({'rings': [[*p, r, w] for p, (r, w) in zip(rings, radii)], 'hint': list(_unit(np.cross(axis, np.array([1.0, 0, 0])) + 1e-6))})
    return out


def horn_footing(V, F, mats):
    """The horn: its base on the forehead, thrust forward and up (a little off
    the brow's normal towards the muzzle)."""
    p, h, f, r = bone_frame(mats, 'head', 0.28)
    base = surface_along(V, F, p, f) - f * 1.0
    direction = _unit(f * math.cos(math.radians(12)) + h * math.sin(math.radians(12)))
    return {'base': base, 'dir': direction, 'side': r, 'length': 64.0, 'radius': 5.0}


# ---- Tube sweep (mirrors unicornTube in src/unicorn3d.js), for --obj ------
def tube(rings, hint, per_span=3, sides=6):
    rings = np.asarray(rings, dtype=np.float64)
    n = len(rings)
    samp = []
    for i in range(n - 1):
        for k in range(per_span + 1 if i == n - 2 else per_span):
            t = k / per_span
            a, b, c, d = rings[max(i - 1, 0)], rings[i], rings[i + 1], rings[min(i + 2, n - 1)]
            samp.append(0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t ** 3))
    samp = np.array(samp)
    hint = np.asarray(hint)
    pos, idx, prev = [], [], None
    for i, s in enumerate(samp):
        t = _unit(samp[min(i + 1, len(samp) - 1), :3] - samp[max(i - 1, 0), :3])
        nrm = hint - t * (hint @ t)
        if np.linalg.norm(nrm) < 0.2 and prev is not None:
            nrm = prev - t * (prev @ t)
        nrm = _unit(nrm)
        prev = nrm
        side = np.cross(t, nrm)
        for k in range(sides):
            ang = k / sides * math.tau
            pos.append(s[:3] + nrm * math.cos(ang) * max(s[3], 0.1) + side * math.sin(ang) * max(s[4], 0.1))
    m = len(samp)
    for i in range(m - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            a, b, c, d = i * sides + k, i * sides + k2, (i + 1) * sides + k, (i + 1) * sides + k2
            idx += [(a, b, c), (b, d, c)]
    return np.array(pos), np.array(idx)


def build():
    verts, tris = load_horse()
    posed, mats = pose_horse(verts, tris)
    smooth, sf = posed, tris
    for _ in range(2):
        smooth, sf = loop_subdivide(smooth, sf)
    # The hooves stand on the plinth: the smooth surface's lowest point at 0.
    drop = smooth[:, 1].min()
    posed[:, 1] -= drop
    smooth[:, 1] -= drop
    for M in mats.values():
        M[1, 3] -= drop
    mane = sculpt_mane(smooth, sf, mats)
    tail = sculpt_tail(mats)
    horn = horn_footing(smooth, sf, mats)
    hooves = sculpt_hooves(mats)
    # The hind hooves' soles stand on the plinth: everything moves to put the
    # lowest of them at 0.
    low = min(tube(h['rings'], h['hint'], 1, 12)[0][:, 1].min() for h in hooves)
    posed[:, 1] -= low
    smooth[:, 1] -= low
    for lk in mane + tail + hooves:
        for r in lk['rings']:
            r[1] -= low
    horn['base'] = horn['base'] - np.array([0, low, 0])
    return posed, tris, smooth, sf, {'mane': mane, 'tail': tail, 'hooves': hooves, 'horn': horn}


def to_js(p):
    """Rest frame (x to her left, y up, z forward; cm) to the statue's (x
    forward, y up, z across; mm), mirrored: the side she turns to and her
    mane fall on -z, the side the statue shows the street camera."""
    p = np.asarray(p, dtype=np.float64)
    return [round(p[2] * 10), round(p[1] * 10), round(p[0] * 10)]


def to_js_dir(d, digits=3):
    return [round(float(d[2]), digits), round(float(d[1]), digits), round(float(d[0]), digits)]


def support_centre(smooth, tail):
    """Midway between the hind hooves and where the tail rests: the point
    that stands at the middle of the plinth."""
    hooves = smooth[smooth[:, 1] < 4].mean(0)
    rest = np.array([r[:3] for lk in tail for r in lk['rings'] if r[1] < 4]).mean(0)
    return (hooves + rest) / 2


def write_asset(posed, tris, sculpt, centre):
    mane, tail, horn = sculpt['mane'], sculpt['tail'], sculpt['horn']
    def locks(ls):
        out = []
        for lk in ls:
            rings = []
            for r in lk['rings']:
                rings += to_js(r[:3]) + [round(r[3] * 10), round(r[4] * 10)]
            out.append({'rings': rings, 'hint': to_js_dir(lk['hint'])})
        return out
    tip = horn['base'] + horn['dir'] * horn['length']
    data = {
        'about': 'Aurora, the unicorn statue: the three.js examples horse (MIT; from 3 Dreams of Black, ro.me, Apache 2.0) '
                 're-posed and sculpted by tools/unicorn_model.py. Millimetres, life size; x forward, y up, -z her camera side.',
        'vertices': [c for p in posed for c in to_js(p)],
        # to_js mirrors, so each triangle's winding turns round.
        'triangles': [int(i) for t in tris for i in (t[0], t[2], t[1])],
        'mane': locks(mane),
        'tail': locks(tail),
        'hooves': locks(sculpt['hooves']),
        'horn': {
            'base': to_js(horn['base']),
            'dir': to_js_dir(horn['dir'], 4),
            'side': to_js_dir(horn['side'], 4),
            'length': round(horn['length'] * 10),
            'radius': round(horn['radius'] * 10),
            'tip': to_js(tip),
        },
        'centre': to_js(centre),
    }
    text = json.dumps(data, separators=(',', ':'))
    with open(OUT, 'w') as f:
        f.write(text + '\n')
    return len(text)


def write_obj(path, smooth, sf, sculpt):
    mane, tail, horn = sculpt['mane'], sculpt['tail'], sculpt['horn']
    parts = [(smooth, sf)]
    for lk in mane + tail + sculpt['hooves']:
        parts.append(tube(lk['rings'], lk['hint']))
    # The horn as a plain cone for the preview.
    b, d = horn['base'], horn['dir']
    hv = [b + d * horn['length'] * s for s in np.linspace(0, 1, 8)]
    parts.append(tube([[*p, horn['radius'] * (1 - s) + 0.2, horn['radius'] * (1 - s) + 0.2] for p, s in zip(hv, np.linspace(0, 1, 8))], horn['side'], 2, 10))
    with open(path, 'w') as f:
        off = 1
        for V, F in parts:
            for v in V:
                f.write('v %.3f %.3f %.3f\n' % tuple(v))
            for t in F:
                f.write('f %d %d %d\n' % tuple(t + off))
            off += len(V)


def main():
    posed, tris, smooth, sf, sculpt = build()
    mane, tail, horn = sculpt['mane'], sculpt['tail'], sculpt['horn']
    centre = support_centre(smooth, tail)
    size = write_asset(posed, tris, sculpt, centre)
    tip = horn['base'] + horn['dir'] * horn['length']
    print(f'{OUT}: {size} bytes; cage {len(posed)} vertices, {len(tris)} triangles; '
          f'{len(mane)} mane locks, {len(tail)} tail locks; horn tip {tip[1]:.1f} cm up; '
          f'support centre z {centre[2]:.1f} cm, footprint z {smooth[:, 2].min() - centre[2]:.0f}..{smooth[:, 2].max() - centre[2]:.0f} cm')
    if '--obj' in sys.argv:
        write_obj(sys.argv[sys.argv.index('--obj') + 1], smooth, sf, sculpt)


if __name__ == '__main__':
    main()
