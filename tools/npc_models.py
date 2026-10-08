#!/usr/bin/env python3
"""The street's people: convert a cast of Microsoft Rocketbox avatars (MIT) into one model file and one atlas.

The batch form of tools/player_model.py (whose FBX reader and bone mapping it uses). For every avatar in CAST it
writes the mesh in the asset's own rest pose (metres; x forward, y up, z to their right), quantised, its UVs into
one shared colour atlas, each vertex's two strongest of the game's 15 bones (the crowd rig's) and its part, the
hands' finger segments and the asset's joint frames, plus what the game needs to cast and to match the rig to it
(sex, child, role tags, the colours of the clothes, skin and hair, the rig traits). Weapons modelled on the body
(holstered pistols, knives) are left out; extra materials (helmets, caps, kit, hair cards) keep their own atlas
cells, hair cards with their alpha.

    assets/npc-models.bin   'DECNPC01', a JSON header length, the header ({format, atlas, avatars: [...]}), the
                            arrays (per avatar: position i2 (x 1/16000 m), normal i1, uv u2 (atlas), skin u1
                            (bone a, bone b, b's share x 255, part), hand u1 (palm/finger sub-bones or 255),
                            material u1 (0 cloth, 1 head, 2 eye, 3 hand, 4 shoe, 5 alpha-tested card), index u2).
    assets/npc-skin.webp    the colour atlas (RGBA; alpha only on hair cards): one CELL_W x CELL_H cell per avatar:
                            body page BODY x BODY at the left, head page HEAD x HEAD top right, below it the extra
                            materials (one HEAD-sized cell, or up to four quarter cells).

The fitting to the rig's bind skeleton happens at load (src/npc-avatar3d-fit.js), like the player's.

    python3 tools/npc_models.py SRC_ROOT
        SRC_ROOT holds <Group>/<Avatar>/Export/<Avatar>.fbx and <Group>/<Avatar>/Textures/*_color*.tga as in
        github.com/microsoft/Microsoft-Rocketbox Assets/Avatars (the colour maps are all it reads).
"""
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import player_model as pm  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BODY, HEAD = 320, 160
CELL_W, CELL_H = BODY + HEAD, BODY
COLUMNS = 6
POS_SCALE = 16000.0
DROP = ('pistol', 'combat_knife', 'machinegun', 'shotgun', 'flashlight')

# The cast: (avatar, group, sex, child, role tags, rig traits). Tags (src/npc-avatar-cast.js): street (anyone on the
# pavement), summer (beach districts, tourists), elder, commuter, reveller, partyGuest, worker, jogger, beach, kid,
# gang, mobster, fed, bouncer, police, swat, army, mp, medic. Traits are what the rig needs to match the avatar at a
# distance: garment (crowd3d-looks.js garments), sleeves (long), shorts, skirt, footwear, hairStyle (crowd.js codes:
# 0 shaved, 1 short, 2 long, 3 bun, 4 curly).
CAST = [
    ('Male_Adult_01', 'Adults', 'm', False, 'street summer tourist', dict(garment='tee', sleeves=False, shorts=True, footwear='sneaker', hairStyle=1)),
    ('Male_Adult_04', 'Adults', 'm', False, 'street gang reveller bouncer', dict(garment='jacket', sleeves=True, footwear='sneaker', hairStyle=4)),
    ('Male_Adult_06', 'Adults', 'm', False, 'street reveller', dict(garment='tee', sleeves=True, footwear='sneaker', hairStyle=1)),
    ('Male_Adult_08', 'Adults', 'm', False, 'street commuter partyGuest', dict(garment='tee', sleeves=True, footwear='shoe', hairStyle=1)),
    ('Male_Adult_12', 'Adults', 'm', False, 'street gang texter', dict(garment='jacket', sleeves=True, footwear='sneaker', hairStyle=0)),
    ('Male_Adult_14', 'Adults', 'm', False, 'elder', dict(garment='tee', sleeves=True, footwear='shoe', hairStyle=0)),
    ('Male_Adult_17', 'Adults', 'm', False, 'street gang texter tourist', dict(garment='hoodie', sleeves=True, footwear='sneaker', hairStyle=1)),
    ('Female_Adult_01', 'Adults', 'f', False, 'street summer tourist', dict(garment='tee', sleeves=False, footwear='shoe', hairStyle=2)),
    ('Female_Adult_02', 'Adults', 'f', False, 'street commuter', dict(garment='tee', sleeves=True, skirt=True, footwear='shoe', hairStyle=3)),
    ('Female_Adult_03', 'Adults', 'f', False, 'street summer reveller', dict(garment='tank', sleeves=False, footwear='shoe', hairStyle=2)),
    ('Female_Adult_04', 'Adults', 'f', False, 'street reveller texter gang', dict(garment='jacket', sleeves=True, footwear='boot', hairStyle=2)),
    ('Female_Adult_11', 'Adults', 'f', False, 'street reveller partyGuest', dict(garment='dress', sleeves=True, skirt=True, footwear='boot', hairStyle=2)),
    ('Female_Adult_14', 'Adults', 'f', False, 'elder', dict(garment='jacket', sleeves=True, footwear='boot', hairStyle=1)),
    ('Female_Adult_15', 'Adults', 'f', False, 'street commuter', dict(garment='tee', sleeves=True, skirt=True, footwear='boot', hairStyle=2)),
    ('Female_Party_02', 'Adults', 'f', False, 'reveller partyGuest', dict(garment='dress', sleeves=False, skirt=True, footwear='shoe', hairStyle=4)),
    ('Business_Male_01', 'Professions', 'm', False, 'commuter mobster fed partyGuest', dict(garment='suit', sleeves=True, footwear='shoe', hairStyle=1)),
    ('Business_Female_01', 'Professions', 'f', False, 'commuter fed', dict(garment='suit', sleeves=True, footwear='shoe', hairStyle=1)),
    ('Business_Female_03', 'Professions', 'f', False, 'commuter', dict(garment='suit', sleeves=True, skirt=True, footwear='shoe', hairStyle=1)),
    ('Police_Male_03', 'Professions', 'm', False, 'police', dict(garment='uniform', sleeves=True, footwear='shoe', hairStyle=1, hat='patrolCap')),
    ('Security_Female_01', 'Professions', 'f', False, 'police', dict(garment='uniform', sleeves=True, footwear='shoe', hairStyle=3, hat='patrolCap')),
    ('Police_Male_02', 'Professions', 'm', False, 'swat', dict(garment='uniform', sleeves=True, footwear='boot', hairStyle=0, hat='helmet')),
    ('Military_Male_01', 'Professions', 'm', False, 'army', dict(garment='uniform', sleeves=True, footwear='boot', hairStyle=0, hat='helmet')),
    ('Military_Male_02', 'Professions', 'm', False, 'mp', dict(garment='uniform', sleeves=True, footwear='boot', hairStyle=0, hat='patrolCap')),
    ('Medical_Male_01', 'Professions', 'm', False, 'medic', dict(garment='uniform', sleeves=False, footwear='shoe', hairStyle=1)),
    ('Medical_Female_01', 'Professions', 'f', False, 'medic', dict(garment='uniform', sleeves=False, footwear='shoe', hairStyle=3)),
    ('Construction_Male_07', 'Professions', 'm', False, 'worker', dict(garment='uniform', sleeves=True, footwear='boot', hairStyle=1, hat='hardHat')),
    ('Sports_Male_04', 'Professions', 'm', False, 'jogger', dict(garment='tank', sleeves=False, shorts=True, footwear='sneaker', hairStyle=1)),
    ('Sports_Female_02', 'Professions', 'f', False, 'jogger', dict(garment='tank', sleeves=False, footwear='sneaker', hairStyle=3)),
    ('Sports_Female_01', 'Professions', 'f', False, 'beach', dict(garment='bikini', sleeves=False, shorts=True, footwear='bare', hairStyle=2)),
    ('Sports_Male_01', 'Professions', 'm', False, 'beach', dict(garment='shirtless', sleeves=False, shorts=True, footwear='bare', hairStyle=1)),
    ('Male_Child_01', 'Children', 'm', True, 'kid', dict(garment='tee', sleeves=True, footwear='sneaker', hairStyle=1)),
    ('Female_Child_01', 'Children', 'f', True, 'kid', dict(garment='tee', sleeves=True, footwear='sneaker', hairStyle=2)),
]


def mat_kind(name):
    """'body', 'head', 'opacity', 'drop' or 'extra' from a material name like 'f001_body' or 'm172_equpiment'."""
    suffix = name.split('_', 1)[1] if '_' in name else name
    if suffix == 'body':
        return 'body'
    if suffix == 'head':
        return 'head'
    if suffix.startswith('opacity'):
        return 'opacity'
    if any(suffix.startswith(d) for d in DROP):
        return 'drop'
    return 'extra'


def find_texture(tex_dir, mat):
    files = sorted(os.listdir(tex_dir))
    mat = mat.replace('equpiment', 'equipment')  # (a typo in Police_Male_03's material)
    exact = [f for f in files if f.lower() == (mat + '_color.tga').lower()]
    if exact:
        return os.path.join(tex_dir, exact[0])
    loose = [f for f in files if f.lower().startswith((mat + '_color').lower()) and f.lower().endswith('.tga')]
    if not loose:
        raise ValueError('no colour map for ' + mat)
    return os.path.join(tex_dir, loose[0])


def hexcol(c):
    c = np.clip(np.round(np.asarray(c) * 255), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


def convert_one(src, name):
    folder = os.path.join(src, name)
    fbx = os.path.join(folder, 'Export', name + '.fbx')
    av = pm.load_avatar(fbx)
    # (The children's Biped is named Bip02.)
    cl = {('Bip01' + k[5:] if k.startswith('Bip0') else k): v for k, v in av['clusters'].items()}
    joint = {k: pm.to_game(v['link'][:3, 3]) for k, v in cl.items()}
    J = lambda n: joint['Bip01 ' + n]
    cpg = pm.to_game(av['cp'])
    # (Female_Adult_14's mesh is bound 1.19 m below its skeleton: the soles go back to the ground the bones stand on.)
    if cpg[:, 1].min() < -0.05:
        cpg[:, 1] -= cpg[:, 1].min()
    ncp = len(cpg)
    dense = np.zeros((ncp, 15))
    sub = np.zeros((ncp, 16))
    for bone, c in cl.items():
        b = pm.pb_bone(bone)
        np.add.at(dense[:, b], c['index'], c['weight'])
        s = pm.hand_sub(bone) if b in (7, 8) else None
        if s is not None:
            np.add.at(sub[:, s], c['index'], c['weight'])
    order = np.argsort(-dense, axis=1)
    a, b = order[:, 0], order[:, 1]
    wa = dense[np.arange(ncp), a]
    wb = dense[np.arange(ncp), b]
    wb_share = wb / np.maximum(wa + wb, 1e-9)
    sorder = np.argsort(-sub, axis=1)
    sa, sb = sorder[:, 0], sorder[:, 1]
    swa = sub[np.arange(ncp), sa]
    swb = sub[np.arange(ncp), sb]
    s_share = np.where(swa + swb > 0, swb / np.maximum(swa + swb, 1e-9), 0)
    in_hand = (a == 7) | (a == 8) | (b == 7) | (b == 8)
    eye_w = np.zeros(ncp)
    for side in 'LR':
        c = cl.get('Bip01 %sEye' % side)
        if c is not None:
            np.add.at(eye_w, c['index'], c['weight'])
    mats = av['materials']
    kinds = [mat_kind(m) for m in mats]
    tri = av['tri_cp']
    keep = np.array([kinds[m] != 'drop' for m in av['poly_mat']])
    if dense.sum(1)[np.unique(tri[keep])].min() < 0.5:
        raise ValueError(name + ': control points without weights')
    corner_cp = tri.reshape(-1)
    corner_uv = av['uv_index'].astype(np.int64)
    corner_n = pm.to_game(av['normals'] * 100.0)
    corner_mat = np.repeat(av['poly_mat'], 3)
    corner_keep = np.repeat(keep, 3)
    keys = {}
    vert_cp, vert_uv, vert_n, vert_mat = [], [], [], []
    index = []
    for i in range(len(corner_cp)):
        if not corner_keep[i]:
            continue
        n = corner_n[i]
        k = (int(corner_cp[i]), int(corner_uv[i]), int(corner_mat[i]), tuple(np.round(n * 64).astype(int)))
        v = keys.get(k)
        if v is None:
            v = keys[k] = len(vert_cp)
            vert_cp.append(corner_cp[i])
            vert_uv.append(corner_uv[i])
            vert_n.append(n)
            vert_mat.append(corner_mat[i])
        index.append(v)
    vert_cp = np.array(vert_cp)
    vert_mat = np.array(vert_mat)
    nv = len(vert_cp)
    if nv >= 65536:
        raise ValueError(name + ': too many vertices for a 16-bit index')
    uvs = np.clip(av['uv'][np.array(vert_uv)].astype(np.float64), 0, 1)
    normal = np.array(vert_n)
    normal /= np.linalg.norm(normal, axis=1, keepdims=True)
    pa = a[vert_cp]
    vkind = np.array([kinds[m] for m in vert_mat])
    mat = np.where(vkind == 'head', np.where(eye_w[vert_cp] > 0.5, 2, 1),
                   np.where(vkind == 'opacity', 5,
                            np.where(vkind == 'extra', 0, np.where((pa == 7) | (pa == 8), 3, np.where((pa == 13) | (pa == 14), 4, 0)))))
    # The avatar's joint frames (player_model.py convert).
    fwd = np.array([1.0, 0, 0])
    I = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    frames = [None] * 15
    frames[0] = {'o': J('Pelvis'), 'R': I}
    frames[1] = {'o': J('Spine1'), 'R': I}
    frames[2] = {'o': J('Neck'), 'R': I}
    hands = []
    for side, s in ((0, 'L'), (1, 'R')):
        knuckles = J(s + ' Finger1') - J(s + ' Finger4')
        frames[3 + side] = {'o': J(s + ' UpperArm'), 'R': pm.frame(J(s + ' UpperArm'), J(s + ' UpperArm') - J(s + ' Forearm'), knuckles)}
        frames[5 + side] = {'o': J(s + ' Forearm'), 'R': pm.frame(J(s + ' Forearm'), J(s + ' Forearm') - J(s + ' Hand'), knuckles)}
        mid = (J(s + ' Finger2') + J(s + ' Finger3')) / 2
        frames[7 + side] = {'o': J(s + ' Hand'), 'R': pm.frame(J(s + ' Hand'), J(s + ' Hand') - mid, knuckles)}
        frames[9 + side] = {'o': J(s + ' Thigh'), 'R': pm.frame(J(s + ' Thigh'), J(s + ' Thigh') - J(s + ' Calf'), fwd)}
        frames[11 + side] = {'o': J(s + ' Calf'), 'R': pm.frame(J(s + ' Calf'), J(s + ' Calf') - J(s + ' Foot'), fwd)}
        frames[13 + side] = {'o': J(s + ' Foot'), 'R': frames[11 + side]['R']}
        chains = []
        for f in (1, 2, 3, 4, 0):
            names = ['%s Finger%d' % (s, f), '%s Finger%d1' % (s, f), '%s Finger%d2' % (s, f)]
            chains.append([[round(float(v), 5) for v in J(n)] for n in names])
        hands.append(chains)
    for f in frames:
        f['o'] = [round(float(v), 5) for v in f['o']]
        f['R'] = [round(float(v), 6) for v in f['R']]
    # Textures and the colour each vertex shows (for the rig's palette).
    tex_dir = os.path.join(folder, 'Textures')
    pages = {}
    for mi, m in enumerate(mats):
        if kinds[mi] == 'drop':
            continue
        im = Image.open(find_texture(tex_dir, m))
        if kinds[mi] == 'opacity':
            im = im.convert('RGBA')
        else:
            im = im.convert('RGB').convert('RGBA')
        pages[mi] = im
    cols = np.zeros((nv, 3))
    for mi, im in pages.items():
        sel = vert_mat == mi
        if not sel.any():
            continue
        small = np.asarray(im.convert('RGB').resize((256, 256), Image.BILINEAR), dtype=np.float64) / 255
        x = np.clip((uvs[sel, 0] * 255).astype(int), 0, 255)
        y = np.clip(((1 - uvs[sel, 1]) * 255).astype(int), 0, 255)
        cols[sel] = small[y, x]
    P = cpg[vert_cp]
    part = pa

    def median(sel, fallback):
        return hexcol(np.median(cols[sel], axis=0)) if sel.sum() > 8 else fallback

    body = vkind == 'body'
    crown = P[:, 1].max()
    palette = {
        'top': median(body & (part == 1) & (P[:, 1] < P[:, 1][part == 1].max() - 0.12), '#44505c'),
        'pants': median(body & ((part == 9) | (part == 10)), '#2a3444'),
        'shin': median(body & ((part == 11) | (part == 12)), '#2a3444'),
        'shoes': median((mat == 4), '#141414'),
        'skin': median(body & ((part == 7) | (part == 8)), '#c99169'),
        'hair': median((vkind == 'head') & (P[:, 1] > crown - 0.035) & (P[:, 0] < J('Neck')[0] + 0.02), '#231a15'),
        'arm': median(body & ((part == 5) | (part == 6)), '#44505c'),
    }
    return {
        'name': name,
        'P': P, 'N': normal, 'uv': uvs, 'vmat': vert_mat, 'kinds': kinds, 'mats': mats, 'pages': pages,
        'skin': np.stack([a[vert_cp], b[vert_cp], np.round(wb_share[vert_cp] * 255), a[vert_cp]], 1).astype('u1'),
        'hand': np.where(in_hand[vert_cp, None], np.stack([sa[vert_cp], sb[vert_cp], np.round(s_share[vert_cp] * 255), np.zeros(nv)], 1), 255).astype('u1'),
        'material': mat.astype('u1'),
        'index': np.array(index, dtype='<u2'),
        'frames': frames, 'hands': hands, 'palette': palette,
        'height': float(P[:, 1].max()),
        'triangles': len(index) // 3,
    }


def place(entry, cx, cy, atlas):
    """Paste the avatar's pages into its cell; return each material's rect (x, y, w, h) in atlas pixels."""
    rects = {}
    extras = [mi for mi, k in enumerate(entry['kinds']) if k in ('extra', 'opacity') and mi in entry['pages']]
    for mi, im in entry['pages'].items():
        k = entry['kinds'][mi]
        if k == 'body':
            r = (cx, cy, BODY, BODY)
        elif k == 'head':
            r = (cx + BODY, cy, HEAD, HEAD)
        else:
            j = extras.index(mi)
            if len(extras) == 1:
                r = (cx + BODY, cy + HEAD, HEAD, HEAD)
            else:
                if j > 3:
                    raise ValueError(entry['name'] + ': more than four extra materials')
                q = HEAD // 2
                r = (cx + BODY + (j % 2) * q, cy + HEAD + (j // 2) * q, q, q)
        atlas.paste(im.resize((r[2], r[3]), Image.LANCZOS), (r[0], r[1]))
        rects[mi] = r
    return rects


def main(src):
    cast = []
    for name, group, sex, kid, tags, traits in CAST:
        e = convert_one(os.path.join(src, group), name)
        e.update({'sex': sex, 'kid': kid, 'tags': tags.split(), 'traits': traits, 'group': group})
        cast.append(e)
        print('%-22s %5d vertices %6d triangles  %s' % (name, len(e['P']), e['triangles'], e['palette']))
    rows = (len(cast) + COLUMNS - 1) // COLUMNS
    W, H = COLUMNS * CELL_W, rows * CELL_H
    atlas = Image.new('RGBA', (W, H), (128, 128, 128, 255))
    header = {'format': 1, 'atlas': [W, H], 'scale': POS_SCALE, 'avatars': []}
    blob = bytearray()

    def put(arr):
        while len(blob) % 4:
            blob.append(0)
        off = len(blob)
        blob.extend(arr.tobytes())
        return [str(arr.dtype.str.lstrip('<|')), off, int(arr.size)]

    for i, e in enumerate(cast):
        cx, cy = (i % COLUMNS) * CELL_W, (i // COLUMNS) * CELL_H
        rects = place(e, cx, cy, atlas)
        u = np.zeros(len(e['P']))
        v = np.zeros(len(e['P']))
        for mi, (x, y, w, h) in rects.items():
            sel = e['vmat'] == mi
            # Inset half a texel so filtering stays inside the page.
            u[sel] = (x + 0.5 + e['uv'][sel, 0] * (w - 1)) / W
            v[sel] = (H - (y + h) + 0.5 + e['uv'][sel, 1] * (h - 1)) / H
        pos = np.round(e['P'] * POS_SCALE)
        if np.abs(pos).max() > 32767:
            raise ValueError(e['name'] + ': outside the position range')
        arrays = {
            'position': put(pos.astype('<i2')),
            'normal': put(np.round(e['N'] * 127).astype('<i1')),
            'uv': put(np.round(np.stack([u, v], 1) * 65535).astype('<u2')),
            'skin': put(e['skin']),
            'hand': put(e['hand']),
            'material': put(e['material']),
            'index': put(e['index']),
        }
        header['avatars'].append({
            'name': e['name'], 'group': e['group'], 'sex': e['sex'], 'kid': e['kid'], 'tags': e['tags'], 'traits': e['traits'],
            'palette': e['palette'], 'height': round(e['height'], 4), 'vertices': len(e['P']), 'triangles': e['triangles'],
            'bones': e['frames'], 'hands': e['hands'], 'arrays': arrays,
        })
    head_json = json.dumps(header, separators=(',', ':')).encode()
    while len(head_json) % 4:
        head_json += b' '
    out = b'DECNPC01' + struct.pack('<I', len(head_json)) + head_json + bytes(blob)
    with open(os.path.join(ROOT, 'assets/npc-models.bin'), 'wb') as fh:
        fh.write(out)
    atlas.save(os.path.join(ROOT, 'assets/npc-skin.webp'), quality=86, method=6)
    print('npc models: %d avatars, %d bytes; atlas %dx%d, %d bytes' % (len(cast), len(out), W, H, os.path.getsize(os.path.join(ROOT, 'assets/npc-skin.webp'))))


if __name__ == '__main__':
    main(sys.argv[1])
