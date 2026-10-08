#!/usr/bin/env python3
"""The player's model: convert a Microsoft Rocketbox avatar (MIT) into the game's own data.

Reads a Rocketbox binary FBX (3ds Max Biped skeleton, one skinned mesh with a body
and a head material) and its body/head colour, normal and specular maps, and writes

    assets/player-model.bin     the mesh in the asset's own rest pose (metres; x forward,
                                y up, z to his right), its UVs into the atlas, each
                                vertex's two strongest of the game's 15 bones (the crowd
                                rig's: PB_BONE_NAMES) and its part, the hands' finger
                                segments, and the asset's joint frames for those bones.
    assets/player-skin.webp     colour atlas: body left half, head right half.
    assets/player-detail.webp   the same layout: tangent-space normal (x, y) in red and
                                green, the specular map in blue.

The fitting to the game's bind skeleton (the rig's joints at PB_WIDTH, arms in the A
pose) happens at load in src/player-body3d-asset.js, so the rig stays the one source of
the joints. No third-party Python packages: the FBX reader is below (binary FBX 7.x).

    python3 tools/player_model.py SRC_DIR [--size 1024]
        SRC_DIR holds Male_Adult_20.fbx and m027_{body,head}_{color,normal,specular}.tga
        (github.com/microsoft/Microsoft-Rocketbox, Assets/Avatars/Adults/Male_Adult_20).
"""
import json
import os
import struct
import sys
import zlib

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BONES = ['hips', 'torso', 'head', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'handL', 'handR',
         'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']


# ---------------------------------------------------------------------------------------------
# Binary FBX reader: (name, properties, children) tuples.
def read_fbx(path):
    data = open(path, 'rb').read()
    if data[:20] != b'Kaydara FBX Binary  ':
        raise ValueError('not a binary FBX: ' + path)
    version = struct.unpack_from('<I', data, 23)[0]
    wide = version >= 7500

    def prop(pos):
        t = chr(data[pos])
        pos += 1
        if t == 'Y':
            return struct.unpack_from('<h', data, pos)[0], pos + 2
        if t == 'C':
            return data[pos] != 0, pos + 1
        if t == 'I':
            return struct.unpack_from('<i', data, pos)[0], pos + 4
        if t == 'F':
            return struct.unpack_from('<f', data, pos)[0], pos + 4
        if t == 'D':
            return struct.unpack_from('<d', data, pos)[0], pos + 8
        if t == 'L':
            return struct.unpack_from('<q', data, pos)[0], pos + 8
        if t in 'fdlib':
            n, enc, clen = struct.unpack_from('<III', data, pos)
            pos += 12
            raw = data[pos:pos + clen]
            pos += clen
            if enc == 1:
                raw = zlib.decompress(raw)
            dt = {'f': '<f4', 'd': '<f8', 'l': '<i8', 'i': '<i4', 'b': 'u1'}[t]
            return np.frombuffer(raw, dtype=dt, count=n), pos
        if t in 'SR':
            n = struct.unpack_from('<I', data, pos)[0]
            pos += 4
            raw = data[pos:pos + n]
            return (raw.decode('utf-8', 'replace') if t == 'S' else raw), pos + n
        raise ValueError('bad FBX property type %r' % t)

    def node(pos):
        if wide:
            end, nprops, _ = struct.unpack_from('<QQQ', data, pos)
            pos += 24
        else:
            end, nprops, _ = struct.unpack_from('<III', data, pos)
            pos += 12
        if end == 0:
            return None, pos
        nl = data[pos]
        name = data[pos + 1:pos + 1 + nl].decode()
        pos += 1 + nl
        props = []
        for _ in range(nprops):
            v, pos = prop(pos)
            props.append(v)
        kids = []
        while pos < end:
            k, pos = node(pos)
            if k is None:
                break
            kids.append(k)
        return (name, props, kids), end

    top, pos = [], 27
    while pos < len(data):
        n, pos = node(pos)
        if n is None:
            break
        top.append(n)
    return top


def child(n, name):
    for k in n[2]:
        if k[0] == name:
            return k
    return None


def value(n, name):
    k = child(n, name)
    return k[1][0] if k and k[1] else None


# ---------------------------------------------------------------------------------------------
# The Rocketbox mesh: world positions (cm, Y up, the character facing +Z, his left +X), per
# polygon-vertex normals, UVs and materials, and the clusters' weights.
def load_avatar(path):
    top = read_fbx(path)
    objs = child(('', [], top), 'Objects')[2]
    conns = child(('', [], top), 'Connections')[2]
    byid = {o[1][0]: o for o in objs}
    name = {o[1][0]: o[1][1].split('\x00')[0] for o in objs}
    geom = [o for o in objs if o[0] == 'Geometry'][0]
    mats = {}  # material id -> name
    owner = {}  # cluster id -> bone model id
    mesh_model = [o for o in objs if o[0] == 'Model' and o[1][2] == 'Mesh'][0][1][0]
    order = []  # material order on the mesh model (connections order)
    for c in conns:
        a, b = c[1][1], c[1][2]
        if a in byid and b in byid:
            if byid[a][0] == 'Model' and byid[b][0] == 'Deformer':
                owner[b] = a
            if byid[a][0] == 'Material' and b == mesh_model:
                order.append(name[a])
    cp = value(geom, 'Vertices').reshape(-1, 3).astype(np.float64)
    pvi = value(geom, 'PolygonVertexIndex')
    if not np.all((np.diff(np.where(pvi < 0)[0], prepend=-1)) == 3):
        raise ValueError('expected triangles only')
    tri_cp = np.where(pvi < 0, -pvi - 1, pvi).reshape(-1, 3)
    ln = child(geom, 'LayerElementNormal')
    if value(ln, 'MappingInformationType') != 'ByPolygonVertex' or value(ln, 'ReferenceInformationType') != 'Direct':
        raise ValueError('unexpected normal layout')
    normals = value(ln, 'Normals').reshape(-1, 3).astype(np.float64)
    lu = child(geom, 'LayerElementUV')
    uv = value(lu, 'UV').reshape(-1, 2)
    uv_index = value(lu, 'UVIndex')
    lm = child(geom, 'LayerElementMaterial')
    poly_mat = value(lm, 'Materials')
    clusters = {}
    to_world = None
    for o in objs:
        if o[0] == 'Deformer' and o[1][2] == 'Cluster':
            bone = name[owner[o[1][0]]]
            T = value(o, 'Transform').reshape(4, 4).T
            TL = value(o, 'TransformLink').reshape(4, 4).T
            M = TL @ T  # geometry space -> world, the same for every cluster
            if to_world is None:
                to_world = M
            elif np.abs(M - to_world).max() > 1e-3:
                raise ValueError('clusters disagree on the bind')
            idx = value(o, 'Indexes')
            w = value(o, 'Weights')
            clusters[bone] = {'link': TL, 'index': idx if idx is not None else np.zeros(0, int), 'weight': w if w is not None else np.zeros(0)}
    world = (to_world[:3, :3] @ cp.T).T + to_world[:3, 3]
    nworld = (to_world[:3, :3] @ normals.T).T
    nworld /= np.linalg.norm(nworld, axis=1, keepdims=True)
    return {'cp': world, 'tri_cp': tri_cp, 'normals': nworld, 'uv': uv, 'uv_index': uv_index,
            'poly_mat': poly_mat, 'materials': order, 'clusters': clusters}


# Asset world (cm, Y up, facing +Z, his left +X) to game bind space (metres, x forward, y up, z right).
def to_game(p):
    p = np.asarray(p, dtype=np.float64)
    return np.stack([p[..., 2], p[..., 1], -p[..., 0]], axis=-1) / 100.0


def pb_bone(bip):
    """The game bone (index into BONES) a Biped bone's weight goes to, or a hand sub-bone."""
    n = bip.replace('Bip01 ', '')
    side = 0 if n.startswith('L ') else 1 if n.startswith('R ') else None
    part = n[2:] if side is not None else n
    if part in ('Pelvis',) or n == 'Bip01':
        return 0
    if part.startswith('Spine') or part == 'Clavicle':
        return 1
    if side is None:
        return 2  # neck, head and the face's bones
    if part == 'UpperArm':
        return 3 + side
    if part.startswith('Forearm') or part.startswith('ForeTwist'):
        return 5 + side
    if part == 'Hand' or part.startswith('Finger'):
        return 7 + side
    if part == 'Thigh':
        return 9 + side
    if part == 'Calf':
        return 11 + side
    if part in ('Foot',) or part.startswith('Toe'):
        return 13 + side
    raise ValueError('unmapped bone ' + bip)


def hand_sub(bip):
    """Hand sub-bone: 0 the palm, 1 + 3 * chain + segment (chains: 0 index .. 3 little finger, 4 thumb)."""
    n = bip.replace('Bip01 ', '')[2:]
    if n == 'Hand':
        return 0
    if not n.startswith('Finger'):
        return None
    digits = n[6:]
    finger = int(digits[0])
    seg = int(digits[1]) if len(digits) > 1 else 0
    chain = 4 if finger == 0 else finger - 1
    return 1 + chain * 3 + seg


def frame(origin, toward_parent, forward):
    """A bone's axes (columns x forward, y up the limb, z = x × y) as a row-major-by-column list of 9."""
    y = toward_parent / np.linalg.norm(toward_parent)
    x = forward - y * np.dot(forward, y)
    x /= np.linalg.norm(x)
    z = np.cross(x, y)
    return [float(v) for v in np.concatenate([x, y, z])]


def convert(src, size):
    fbx = [f for f in os.listdir(src) if f.lower().endswith('.fbx') and 'facial' not in f.lower()][0]
    av = load_avatar(os.path.join(src, fbx))
    cl = av['clusters']
    joint = {k: to_game(v['link'][:3, 3]) for k, v in cl.items()}
    J = lambda n: joint['Bip01 ' + n]
    cpg = to_game(av['cp'])
    ncp = len(cpg)
    # Per control point: weights over the 15 bones, and over the hand's sub-bones.
    dense = np.zeros((ncp, 15))
    sub = np.zeros((ncp, 16))
    for bone, c in cl.items():
        b = pb_bone(bone)
        np.add.at(dense[:, b], c['index'], c['weight'])
        s = hand_sub(bone) if b in (7, 8) else None
        if s is not None:
            np.add.at(sub[:, s], c['index'], c['weight'])
    if np.any(dense.sum(1) < 0.5):
        raise ValueError('control points without weights')
    # The two strongest bones; the part is the strongest.
    order = np.argsort(-dense, axis=1)
    a, b = order[:, 0], order[:, 1]
    wa = dense[np.arange(ncp), a]
    wb = dense[np.arange(ncp), b]
    wb_share = wb / (wa + wb)
    sorder = np.argsort(-sub, axis=1)
    sa, sb = sorder[:, 0], sorder[:, 1]
    swa = sub[np.arange(ncp), sa]
    swb = sub[np.arange(ncp), sb]
    s_share = np.where(swa + swb > 0, swb / np.maximum(swa + swb, 1e-9), 0)
    in_hand = (a == 7) | (a == 8) | (b == 7) | (b == 8)
    # Eyes: the eyeballs follow the eye bones.
    eye_w = np.zeros(ncp)
    for side in 'LR':
        c = cl.get('Bip01 %sEye' % side)
        if c is not None:
            np.add.at(eye_w, c['index'], c['weight'])
    # Polygon-vertex corners to unique vertices.
    tri = av['tri_cp']
    ntri = len(tri)
    mats = av['materials']
    head_mat = [i for i, m in enumerate(mats) if m.endswith('_head')][0]
    corner_cp = tri.reshape(-1)
    corner_uv = av['uv_index'].astype(np.int64)
    corner_n = to_game(av['normals'] * 100.0)
    corner_mat = np.repeat(av['poly_mat'], 3)
    keys = {}
    vert_cp, vert_uv, vert_n, vert_head = [], [], [], []
    index = np.zeros(len(corner_cp), dtype=np.int64)
    for i in range(len(corner_cp)):
        n = corner_n[i]
        k = (int(corner_cp[i]), int(corner_uv[i]), int(corner_mat[i] == head_mat), tuple(np.round(n * 64).astype(int)))
        v = keys.get(k)
        if v is None:
            v = keys[k] = len(vert_cp)
            vert_cp.append(corner_cp[i])
            vert_uv.append(corner_uv[i])
            vert_n.append(n)
            vert_head.append(corner_mat[i] == head_mat)
        index[i] = v
    vert_cp = np.array(vert_cp)
    nv = len(vert_cp)
    head = np.array(vert_head)
    uvs = av['uv'][np.array(vert_uv)].astype(np.float64)
    if uvs.min() < -0.01 or uvs.max() > 1.01:
        raise ValueError('UVs outside the unit square')
    uvs = np.clip(uvs, 0, 1)
    atlas_u = uvs[:, 0] * 0.5 + np.where(head, 0.5, 0.0)
    normal = np.array(vert_n)
    normal /= np.linalg.norm(normal, axis=1, keepdims=True)
    # Material code (the field body's: 0 clothed body, 1 head, 2 eye, 3 hand, 4 shoe).
    pa = a[vert_cp]
    mat = np.where(head, np.where(eye_w[vert_cp] > 0.5, 2, 1), np.where((pa == 7) | (pa == 8), 3, np.where((pa == 13) | (pa == 14), 4, 0)))
    # The asset's joint frames for the 15 bones (game metres): origin, and axes with y up the limb.
    fwd = np.array([1.0, 0, 0])
    frames = [None] * 15
    frames[0] = {'o': J('Pelvis'), 'R': [1, 0, 0, 0, 1, 0, 0, 0, 1]}
    frames[1] = {'o': J('Spine1'), 'R': [1, 0, 0, 0, 1, 0, 0, 0, 1]}
    frames[2] = {'o': J('Neck'), 'R': [1, 0, 0, 0, 1, 0, 0, 0, 1]}
    hands = []
    for side, s in ((0, 'L'), (1, 'R')):
        knuckles = J(s + ' Finger1') - J(s + ' Finger4')  # little finger to index: the thumb's side
        frames[3 + side] = {'o': J(s + ' UpperArm'), 'R': frame(J(s + ' UpperArm'), J(s + ' UpperArm') - J(s + ' Forearm'), knuckles)}
        frames[5 + side] = {'o': J(s + ' Forearm'), 'R': frame(J(s + ' Forearm'), J(s + ' Forearm') - J(s + ' Hand'), knuckles)}
        mid = (J(s + ' Finger2') + J(s + ' Finger3')) / 2
        frames[7 + side] = {'o': J(s + ' Hand'), 'R': frame(J(s + ' Hand'), J(s + ' Hand') - mid, knuckles)}
        frames[9 + side] = {'o': J(s + ' Thigh'), 'R': frame(J(s + ' Thigh'), J(s + ' Thigh') - J(s + ' Calf'), fwd)}
        frames[11 + side] = {'o': J(s + ' Calf'), 'R': frame(J(s + ' Calf'), J(s + ' Calf') - J(s + ' Foot'), fwd)}
        frames[13 + side] = {'o': J(s + ' Foot'), 'R': frames[11 + side]['R']}
        # Finger chains: joints of the three segments (base, middle, end) for index, middle, ring, little, thumb.
        chains = []
        for f in (1, 2, 3, 4, 0):
            names = ['%s Finger%d' % (s, f), '%s Finger%d1' % (s, f), '%s Finger%d2' % (s, f)]
            chains.append([[round(float(v), 5) for v in J(n)] for n in names])
        hands.append(chains)
    for f in frames:
        f['o'] = [round(float(v), 5) for v in f['o']]
        f['R'] = [round(float(v), 6) for v in f['R']]
    # Arrays.
    arrays = {
        'position': cpg[vert_cp].astype('<f4'),
        'normal': np.round(normal * 127).astype('<i1'),
        'uv': np.round(np.stack([atlas_u, uvs[:, 1]], 1) * 65535).astype('<u2'),
        'skin': np.stack([a[vert_cp], b[vert_cp], np.round(wb_share[vert_cp] * 255), a[vert_cp]], 1).astype('u1'),
        'hand': np.where(in_hand[vert_cp, None], np.stack([sa[vert_cp], sb[vert_cp], np.round(s_share[vert_cp] * 255), np.zeros(nv)], 1), 255).astype('u1'),
        'material': mat.astype('u1'),
        'index': index.astype('<u2'),
    }
    header = {'format': 1, 'source': 'Microsoft Rocketbox ' + fbx[:-4] + ' (MIT)', 'vertices': nv, 'triangles': ntri,
              'bones': frames, 'hands': hands, 'arrays': {}}
    blob = b''
    for k, arr in arrays.items():
        while len(blob) % 4:
            blob += b'\0'
        header['arrays'][k] = [str(arr.dtype.str.lstrip('<|')), len(blob), int(arr.size)]
        blob += arr.tobytes()
    head_json = json.dumps(header, separators=(',', ':')).encode()
    while len(head_json) % 4:
        head_json += b' '
    out = b'DECPM001' + struct.pack('<I', len(head_json)) + head_json + blob
    with open(os.path.join(ROOT, 'assets/player-model.bin'), 'wb') as fh:
        fh.write(out)
    mesh = {'P': cpg[vert_cp], 'N': normal, 'uv': uvs, 'head': head, 'part': a[vert_cp], 'index': index.reshape(-1, 3),
            'island': islands(index.reshape(-1, 3), corner_uv.reshape(-1, 3)), 'joint': J}
    textures(src, size, mesh)
    print('player model: %d vertices, %d triangles, %d bytes' % (nv, ntri, len(out)))
    return header


# ---------------------------------------------------------------------------------------------
# Textures: the asset's maps restyled towards the owner's reference (a black tee with a white
# skull on the chest, dark indigo jeans, brown leather shoes, dark hair combed back, a trimmed
# dark beard, lightly tanned skin). Every texel's place on the body is baked from the mesh
# (bake), so the paint is decided in 3D (the chest, the jaw) and lands wherever the UVs put it.
def islands(tris, uvtris):
    """Each triangle's UV island (triangles sharing UV corners)."""
    parent = list(range(int(uvtris.max()) + 1))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for t in uvtris:
        for k in (1, 2):
            ra, rb = find(int(t[0])), find(int(t[k]))
            if ra != rb:
                parent[ra] = rb
    roots = {}
    return np.array([roots.setdefault(find(int(t[0])), len(roots)) for t in uvtris])


def bake(size, mesh, head_page):
    """Per texel of one page: bind position (metres), normal, part and island (-1: no surface), with the
    covered area grown a few texels into the gutters so filtering never reads an unpainted texel."""
    pos = np.zeros((size, size, 3), np.float32)
    nrm = np.zeros((size, size, 3), np.float32)
    part = np.full((size, size), -1, np.int16)
    isl = np.full((size, size), -1, np.int32)
    P, N, uv = mesh['P'], mesh['N'], mesh['uv']
    X = uv[:, 0] * size - 0.5
    Y = (1 - uv[:, 1]) * size - 0.5
    for t, (a, b, c) in enumerate(mesh['index']):
        if mesh['head'][a] != head_page:
            continue
        xs, ys = X[[a, b, c]], Y[[a, b, c]]
        x0, x1 = max(0, int(np.floor(xs.min()))), min(size - 1, int(np.ceil(xs.max())))
        y0, y1 = max(0, int(np.floor(ys.min()))), min(size - 1, int(np.ceil(ys.max())))
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-12:
            continue
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        l2 = 1 - l0 - l1
        m = (l0 > -0.02) & (l1 > -0.02) & (l2 > -0.02)
        if not m.any():
            continue
        L = np.stack([l0, l1, l2], -1)[m]
        pos[gy[m], gx[m]] = L @ P[[a, b, c]]
        nrm[gy[m], gx[m]] = L @ N[[a, b, c]]
        part[gy[m], gx[m]] = mesh['part'][[a, b, c]][np.argmax(L, 1)]
        isl[gy[m], gx[m]] = mesh['island'][t]
    for _ in range(24):
        empty = part < 0
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            src = np.roll(np.roll(part, dy, 0), dx, 1) >= 0
            take = empty & src
            if take.any():
                for arr in (pos, nrm, part, isl):
                    arr[take] = np.roll(np.roll(arr, dy, 0), dx, 1)[take]
            empty = part < 0
    return {'pos': pos, 'nrm': nrm, 'part': part, 'island': isl}


def smooth(x, r):
    """Gaussian blur (sigma r texels) of a float image (H, W) or (H, W, C): separable, edges clamped."""
    x = np.asarray(x, dtype=np.float32)
    k = int(np.ceil(r * 3))
    w = np.exp(-0.5 * (np.arange(-k, k + 1) / max(r, 1e-6)) ** 2).astype(np.float32)
    w /= w.sum()
    for axis in (0, 1):
        pad = [(0, 0)] * x.ndim
        pad[axis] = (k, k)
        xp = np.pad(x, pad, mode='edge')
        acc = np.zeros_like(x)
        for i, wi in enumerate(w):
            acc += wi * np.take(xp, range(i, i + x.shape[axis]), axis=axis)
        x = acc
    return x


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def lum(c):
    return c[..., 0] * 0.2126 + c[..., 1] * 0.7152 + c[..., 2] * 0.0722


def skull_design(n=1024):
    """The tee's print: a menacing skull, white on black (alpha 0..1), n x n, centred, top at the brow."""
    from PIL import ImageDraw
    big = n * 2
    im = Image.new('L', (big, big), 0)
    d = ImageDraw.Draw(im)
    s = big / 100.0
    P = lambda pts: [(x * s, y * s) for x, y in pts]
    # Cranium and cheekbones, narrowing to the jaw.
    d.ellipse(P([(14, 4), (86, 66)]), fill=255)
    d.polygon(P([(16, 40), (84, 40), (80, 62), (71, 74), (64, 92), (36, 92), (29, 74), (20, 62)]), fill=255)
    # Spikes off the brow ridge (the print's horns), and a crack.
    for side in (-1, 1):
        cx = 50 + side * 24
        d.polygon(P([(cx - side * 6, 16), (cx + side * 14, -2), (cx + side * 4, 20)]), fill=255)
        d.polygon(P([(cx + side * 10, 30), (cx + side * 22, 22), (cx + side * 14, 36)]), fill=255)
    d.line(P([(50, 6), (47, 14), (52, 20), (49, 27)]), fill=0, width=int(1.6 * s))
    # Eye sockets: angled down towards the nose (a scowl).
    for side in (-1, 1):
        d.polygon(P([(50 + side * 6, 44), (50 + side * 30, 33), (50 + side * 33, 42), (50 + side * 26, 53), (50 + side * 12, 54)]), fill=0)
    # The nose: an inverted heart.
    d.polygon(P([(50, 54), (44, 66), (47, 68), (50, 65), (53, 68), (56, 66)]), fill=0)
    # The mouth: a band of teeth, gaps between them, the jaw line under them.
    d.rectangle(P([(33, 72), (67, 84)]), fill=0)
    for k in range(8):
        x0 = 34 + k * 4.2
        d.rounded_rectangle(P([(x0 + 0.5, 72.5), (x0 + 3.6, 78.2)]), radius=0.8 * s, fill=255)
        d.rounded_rectangle(P([(x0 + 0.5, 78.8), (x0 + 3.6, 83.5)]), radius=0.8 * s, fill=255)
    # Cheek hollows.
    for side in (-1, 1):
        d.polygon(P([(50 + side * 19, 60), (50 + side * 30, 58), (50 + side * 22, 70)]), fill=0)
    im = im.resize((n, n), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255


def sample(design, u, v):
    n = design.shape[0]
    inside = (u >= 0) & (u < 1) & (v >= 0) & (v < 1)
    x = np.clip((u * n).astype(int), 0, n - 1)
    y = np.clip((v * n).astype(int), 0, n - 1)
    return np.where(inside, design[y, x], 0)


def restyle_body(C, S, B, mesh):
    """Body page: the tee black with the skull print, the jeans dark indigo, the shoes brown leather."""
    pos, nrm, part, isl = B['pos'], B['nrm'], B['part'], B['island']
    valid = part >= 0
    L = lum(C)
    r, g, b = C[..., 0], C[..., 1], C[..., 2]
    # Island classes by their parts: shoes, legs (jeans), the rest (tee, arms, hands).
    nisl = int(isl.max()) + 1
    shoe_isl = np.zeros(nisl, bool)
    leg_isl = np.zeros(nisl, bool)
    for k in range(nisl):
        m = isl == k
        if not m.any():
            continue
        parts = part[m]
        ys = pos[..., 1][m]
        shoe_isl[k] = np.mean((parts == 13) | (parts == 14)) > 0.5
        leg_isl[k] = not shoe_isl[k] and (np.mean((parts >= 9) & (parts <= 12)) > 0.4 or (np.mean(parts == 0) > 0.5 and ys.mean() < 1.0))
    ok = np.maximum(isl, 0)
    shoes = valid & shoe_isl[ok]
    legs = valid & leg_isl[ok]
    upper = valid & ~shoes & ~legs
    bluish = sstep(-0.02, 0.06, b - r)
    hands = (part == 7) | (part == 8)
    tee = upper & ~hands & (bluish > 0.5)
    skin = upper & ~tee & (r > b + 0.05)
    out = C.copy()
    # The tee: black jersey keeping the folds (the old print evened out first).
    Lm = np.median(L[tee])
    print_px = tee & (np.abs(L / Lm - 1) > 0.18)
    w = (tee & ~print_px).astype(np.float32)
    fill = smooth(L * w, 10) / np.maximum(smooth(w, 10), 1e-4)
    Lt = np.where(print_px, fill, L)
    fold = np.clip(Lt / Lm, 0.45, 1.9) ** 1.1
    black = np.array([0.105, 0.105, 0.115])
    tee_col = black * fold[..., None]
    # The skull, front of the chest: projected straight on (screen right = his left, -z).
    design = skull_design()
    u = (-pos[..., 2]) / 0.27 + 0.5
    v = (1.46 - pos[..., 1]) / 0.3
    front = sstep(0.15, 0.4, nrm[..., 0]) * (pos[..., 0] > 0.0)
    ink = sample(design, u, v) * front * tee
    ink = smooth(ink, 0.8)
    grain = np.random.default_rng(7).random(L.shape).astype(np.float32)
    ink_col = np.array([0.86, 0.85, 0.82]) * (0.82 + 0.18 * np.clip(fold, 0.6, 1.3) / 1.3)[..., None] * (0.93 + 0.07 * grain)[..., None]
    tee_col = tee_col * (1 - ink[..., None]) + ink_col * ink[..., None]
    out[tee] = tee_col[tee]
    S[tee] = np.clip(S[tee] * 0.35 + 0.05 * ink[tee], 0, 1)
    # The jeans: dark indigo, the wash's fades and whiskers kept faintly; tan stitching stays tan.
    stitch = legs & (r > b + 0.04) & (L > 0.25)
    jl = np.median(L[legs])
    jd = np.clip(L / jl, 0.5, 1.8) ** 0.75
    indigo = np.array([0.10, 0.12, 0.20]) * jd[..., None]
    thread = np.array([0.55, 0.42, 0.25]) * np.clip(L / 0.5, 0.6, 1.3)[..., None]
    jeans = legs & ~stitch
    out[jeans] = indigo[jeans]
    out[stitch] = thread[stitch]
    S[legs] = S[legs] * 0.6
    # The shoes: brown leather uppers, dark rubber soles (the white parts).
    sl = np.median(L[shoes]) if shoes.any() else 0.3
    pale = sstep(0.45, 0.65, L)
    leather = np.array([0.33, 0.21, 0.12]) * np.clip(0.55 + 0.9 * (L / max(sl, 0.05)) * 0.5, 0.4, 1.5)[..., None]
    sole = np.array([0.16, 0.12, 0.09]) * np.clip(L / 0.8, 0.7, 1.2)[..., None]
    shoe_col = leather * (1 - pale[..., None]) + sole * pale[..., None]
    out[shoes] = shoe_col[shoes]
    # Skin: a light tan.
    out[skin] = C[skin] * np.array([0.96, 0.88, 0.79])
    return out


def restyle_head(C, S, B, mesh):
    """Head page: the hair dark brown, a trimmed dark beard and moustache, the skin a light tan."""
    pos, part, isl = B['pos'], B['part'], B['island']
    valid = part >= 0
    counts = np.bincount(isl[valid].ravel())
    face = valid & (isl == np.argmax(counts))
    J = mesh['joint']
    up_lip, low_lip, nose = J('MUpperLip'), J('MBottomLip'), J('MNose')
    eye = (J('LEye') + J('REye')) / 2
    mouth = (up_lip + low_lip) / 2
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    az = np.abs(z)
    L = lum(C)
    # Hair: a colour model from sure hair (the crown) against sure skin (the cheeks), applied above the ears.
    crown = face & (y > y[face].max() - 0.025)
    cheek = face & (np.abs(y - (nose[1] - 0.005)) < 0.012) & (az > 0.03) & (az < 0.05) & (x > nose[0] - 0.06)
    feats = lambda m: np.stack([C[..., 0][m], C[..., 1][m], C[..., 2][m]], 1)
    hs, ss = feats(crown), feats(cheek)
    cov = np.cov(np.concatenate([hs - hs.mean(0), ss - ss.mean(0)]).T) + np.eye(3) * 1e-4
    wv = np.linalg.solve(cov, hs.mean(0) - ss.mean(0))
    score = C.reshape(-1, 3) @ wv
    mid = (hs.mean(0) @ wv + ss.mean(0) @ wv) / 2
    spread = abs(hs.mean(0) @ wv - ss.mean(0) @ wv) / 6
    hairness = sstep(-1, 1, (score.reshape(L.shape) - mid) / max(spread, 1e-6))
    # Round the head: the angle from straight ahead about a vertical axis through the skull (0 front, 1 at
    # the ears, 2 behind), so the hair and the beard follow the face's lines.
    band = face & (np.abs(y - eye[1]) < 0.02)
    xc = float(np.median(x[band])) - 0.01
    t = np.abs(np.arctan2(z, x - xc)) / (np.pi / 2)
    region = face & (y > eye[1] - 0.035) & ~((t < 0.55) & (y < eye[1] + 0.03))
    region |= face & (t > 1.15) & (y > mouth[1] - 0.005)
    hair = smooth(hairness * region, 1.0) * region
    # Beard: the moustache under the nose, the cheeks below a line from the mouth's corners up to the
    # sideburns (which meet the hair in front of the ears), the chin and the jaw, ending a little under it.
    top = np.interp(t, [0, 0.13, 0.3, 0.6, 0.85, 2], [nose[1] - 0.017, nose[1] - 0.017, mouth[1] + 0.022, eye[1] - 0.03, eye[1] + 0.02, eye[1] + 0.02])
    jaw = mouth[1] - 0.05 + (0.045 * np.clip(t, 0, 1) ** 1.6)
    below_top = sstep(0.007, -0.005, y - top)
    under = sstep(jaw - 0.024, jaw - 0.006, y)
    sideways = sstep(1.0, 0.84, t)
    lips = np.exp(-((z / 0.025) ** 2) - (((y - mouth[1] + 0.001) / 0.0085) ** 2)) * (x > mouth[0] - 0.02)
    beard_a = below_top * under * sideways * (1 - np.clip(lips * 1.8, 0, 1))
    beard_a = np.where(face, beard_a, 0)
    # Its edge breaks up into stubble, and its body is coarse hair.
    rng = np.random.default_rng(11)
    fine = rng.random(L.shape).astype(np.float32)
    coarse = smooth(rng.random(L.shape).astype(np.float32), 3)
    dens = np.clip(beard_a * 1.25 + (coarse - 0.5) * 0.5, 0, 1)
    dens = np.where(dens < 0.85, dens * (0.55 + 0.45 * (fine > 0.45)), dens)
    dens = smooth(dens.astype(np.float32), 0.7) * 0.92
    out = C.copy()
    # Hair recoloured dark brown keeping its strands.
    hl = np.median(L[crown])
    strands = np.clip(L / max(hl, 0.05), 0.4, 1.8) ** 1.3
    hair_col = np.array([0.15, 0.10, 0.07]) * strands[..., None]
    skin_col = C * np.array([0.96, 0.88, 0.79])
    out = np.where(face[..., None], skin_col, C)
    out = out * (1 - hair[..., None]) + hair_col * hair[..., None]
    # Brows: the hairs (darker than the skin round them) darkened to match.
    brow_band = face & (t < 0.6) & (y > eye[1] + 0.006) & (y < eye[1] + 0.03)
    brow = smooth((brow_band * sstep(0.0, 0.08, smooth(L, 6) - L)).astype(np.float32), 0.8)
    out = out * (1 - 0.8 * brow[..., None]) + np.array([0.12, 0.08, 0.06]) * 0.8 * brow[..., None]
    beard_col = np.array([0.12, 0.08, 0.06]) * (0.6 + 0.5 * fine + 0.5 * np.clip(L / 0.6, 0.5, 1.2) - 0.25)[..., None]
    out = out * (1 - dens[..., None]) + beard_col * dens[..., None]
    S[:] = S * (1 - 0.6 * np.maximum(dens, hair))
    return out


def textures(src, size, mesh):
    def tga(name):
        f = [x for x in os.listdir(src) if x.lower().endswith(name + '.tga')][0]
        return Image.open(os.path.join(src, f)).convert('RGB')

    colour = Image.new('RGB', (size * 2, size))
    detail = Image.new('RGB', (size * 2, size))
    for i, page in enumerate(('body', 'head')):
        C = np.asarray(tga(page + '_color'), dtype=np.float32) / 255
        S = np.asarray(tga(page + '_specular').convert('L'), dtype=np.float32) / 255
        n = np.asarray(tga(page + '_normal'), dtype=np.uint8)
        B = bake(C.shape[0], mesh, page == 'head')
        C = restyle_head(C, S, B, mesh) if page == 'head' else restyle_body(C, S, B, mesh)
        to8 = lambda a: np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
        colour.paste(Image.fromarray(to8(C)).resize((size, size), Image.LANCZOS), (i * size, 0))
        det = np.dstack([n[..., 0], n[..., 1], to8(S)])
        detail.paste(Image.fromarray(det).resize((size, size), Image.LANCZOS), (i * size, 0))
    colour.save(os.path.join(ROOT, 'assets/player-skin.webp'), quality=88, method=6)
    detail.save(os.path.join(ROOT, 'assets/player-detail.webp'), quality=90, method=6)


if __name__ == '__main__':
    args = sys.argv[1:]
    size = 1024
    if '--size' in args:
        size = int(args[args.index('--size') + 1])
    convert(args[0], size)
