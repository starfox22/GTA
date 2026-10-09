#!/usr/bin/env python3
"""Dog model: a downloaded rigged dog (glTF, CC-BY) baked into the poses the street dogs use.

Reads the Labrador ("Labrador Dog" by kenchoo, CC-BY 4.0: MODEL below) from SRC_DIR, reduces it, and writes
assets/dog-model.bin for src/dog3d.js:

    header   JSON: vertex count, frame names, rows per frame, quantisation, the collar point (where the leash ties)
    index    uint16 triangles
    colour   uint8 per vertex: the texture's colour over the coat's reference colour (x 128), so the game tints the
             coat with the dog's own colour and keeps the nose, eyes and pads dark
    frames   int16 positions and int8 normals per frame and vertex, in game units (x ahead, y up, z to the right, the
             paws on y 0)

Frames (posed here with the model's own skeleton, forward kinematics and linear blend skinning): eight phases of the
trot (diagonal pairs), standing, sitting and sniffing (head down). The paws are skinned to IK targets under the
root in the source: they are carried by the lower legs instead. The game blends neighbouring trot frames and the
other poses in the vertex shader (dog3d.js), one instanced draw for every dog in view.

    python3 tools/dog_model.py SRC_DIR [--out DIR (default assets/)] [--tris 2600] [--preview DIR]
"""
import json
import math
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vehicle_models as vm  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNITS = 8  # game units per metre
MODEL = dict(
    src='labrador/scene.gltf', title='Labrador Dog',
    url='https://sketchfab.com/3d-models/labrador-dog-1f56cfbab07e4fe49b5d9e521c82073a',
    # Head top (ears) 0.62 m: a medium dog; the game scales each dog by its own size (0.75-1.25 x 0.85).
    height=0.62,
    tris=2600,
)
TROT_FRAMES = 8
FRAMES = ['trot%d' % i for i in range(TROT_FRAMES)] + ['stand', 'sit', 'sniff']


def rot(axis, angle):
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c, s = math.cos(angle), math.sin(angle)
    C = 1 - c
    R = np.eye(4)
    R[:3, :3] = [[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                 [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                 [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]
    return R


class Rig:
    def __init__(self, g):
        js = g.js
        self.nodes = js['nodes']
        self.parent = {}
        for i, n in enumerate(self.nodes):
            for c in n.get('children', []):
                self.parent[c] = i
        self.byname = {}
        for i, n in enumerate(self.nodes):
            name = n.get('name', '')
            self.byname[name.rsplit('_', 1)[0] if '_' in name and name.rsplit('_', 1)[1].isdigit() else name] = i
        self.local = [vm.node_matrix(n) for n in self.nodes]
        # The paws hang from IK targets under the root: carry them on the lower legs.
        for ik, leg in (('IKFrontLeg.L', 'FrontLowerLeg.L'), ('IKFrontLeg.R', 'FrontLowerLeg.R'), ('IKBackLeg.L', 'BackLowerLeg.L'), ('IKBackLeg.R', 'BackLowerLeg.R')):
            i, l = self.byname[ik], self.byname[leg]
            rest_i, rest_l = self.rest(i), self.rest(l)
            self.parent[i] = l
            self.local[i] = np.linalg.inv(rest_l) @ rest_i
        self.rest_world = [self.rest(i) for i in range(len(self.nodes))]

    def rest(self, i):
        M = self.local[i]
        while i in self.parent:
            i = self.parent[i]
            M = self.local[i] @ M
        return M

    def pose(self, deltas):
        """World matrices with `deltas` {joint: 4x4 rotation in the dog's frame about the joint} applied down the tree."""
        out = {}

        def world(i):
            if i in out:
                return out[i]
            M = self.local[i]
            if i in self.parent:
                M = world(self.parent[i]) @ M
            name = self.nodes[i].get('name', '')
            key = name.rsplit('_', 1)[0] if '_' in name and name.rsplit('_', 1)[1].isdigit() else name
            if key in deltas:
                p = M[:3, 3].copy()
                T = np.eye(4)
                T[:3, 3] = p
                Ti = np.eye(4)
                Ti[:3, 3] = -p
                M = T @ deltas[key] @ Ti @ M
            out[i] = M
            return M
        return [world(i) for i in range(len(self.nodes))]


LAT = (1, 0, 0)  # the dog's lateral axis (source frame: facing +z, y up)
UP = (0, 1, 0)


def frame_deltas(name):
    d = {}

    def add(joint, axis, angle):
        if abs(angle) > 1e-6:
            d[joint] = rot(axis, angle) @ d.get(joint, np.eye(4))
    if name.startswith('trot'):
        phase = int(name[4:]) / TROT_FRAMES * 2 * math.pi
        for side, front_off, back_off in (('L', 0.0, math.pi), ('R', math.pi, 0.0)):
            f = phase + front_off
            b = phase + back_off
            # Positive about +x swings a paw back (towards -z). Front: the upper leg swings, the lower flexes in the
            # recovery (moving forward, sin falling); back: the hip swings, the hock folds in the recovery.
            add('FrontUpperLeg.' + side, LAT, 0.42 * math.sin(f))
            add('FrontLowerLeg.' + side, LAT, 0.95 * max(0.0, -math.cos(f)) ** 1.5)
            add('BackLeg.' + side, LAT, 0.38 * math.sin(b))
            add('BackLowerLeg.' + side, LAT, -0.7 * max(0.0, -math.cos(b)) ** 1.5)
        add('Tail1', UP, 0.32 * math.sin(phase * 2))
        add('Tail2', UP, 0.2 * math.sin(phase * 2 - 0.6))
        add('Neck1', LAT, 0.04 * math.sin(phase * 2))
    elif name == 'sit':
        # The torso tips up about the hips; the front legs stay upright, the hind legs fold under.
        add('Back', LAT, -0.62)
        add('FrontShoulder.L', LAT, 0.62)
        add('FrontShoulder.R', LAT, 0.62)
        add('Neck1', LAT, 0.35)
        add('BackLeg.L', LAT, -1.05)
        add('BackLeg.R', LAT, -1.05)
        add('BackUpperLeg.L', LAT, 0.2)
        add('BackUpperLeg.R', LAT, 0.2)
        add('BackLowerLeg.L', LAT, 1.6)
        add('BackLowerLeg.R', LAT, 1.6)
        add('Tail1', LAT, 0.9)
    elif name == 'sniff':
        add('Neck1', LAT, 0.55)
        add('Neck2', LAT, 0.25)
        add('Head', LAT, 0.25)
        add('FrontUpperLeg.L', LAT, -0.12)
        add('FrontUpperLeg.R', LAT, -0.12)
        add('Tail1', UP, 0.25)
    return d


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    src = argv[1]
    tris = int(argv[argv.index('--tris') + 1]) if '--tris' in argv else MODEL['tris']
    g = vm.Gltf(os.path.join(src, MODEL['src']))
    js = g.js
    rig = Rig(g)
    skin = js['skins'][0]
    joints = skin['joints']
    IBM = g.accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    img = g.image(js['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index'])[1].convert('RGB')
    tex = np.asarray(img).astype(np.float64)
    th, tw = tex.shape[:2]
    # Every vertex: bind position, normal, uv, (joints, weights) or a rigid node.
    P, N, UV, JW, I = [], [], [], [], []
    neutral = joints.index(rig.byname['neutral_bone'])
    for ni, n in enumerate(js['nodes']):
        if 'mesh' not in n:
            continue
        for pr in js['meshes'][n['mesh']]['primitives']:
            a = pr['attributes']
            pos = g.accessor(a['POSITION']).astype(np.float64)
            nor = g.accessor(a['NORMAL']).astype(np.float64)
            uv = g.accessor(a['TEXCOORD_0']).astype(np.float64)
            idx = g.accessor(pr['indices']).reshape(-1, 3).astype(np.int64)
            base = len(P)
            if 'JOINTS_0' in a:
                Jv = g.accessor(a['JOINTS_0']).astype(int)
                Wv = g.accessor(a['WEIGHTS_0']).astype(np.float64)
                drop = (Jv[:, 0] == neutral) & (Wv[:, 0] > 0.5)
                for k in range(len(pos)):
                    JW.append(('skin', Jv[k], Wv[k] / max(Wv[k].sum(), 1e-9)))
            else:
                # Rigid on its node (the mouth and teeth on the head).
                W0 = rig.rest(ni)
                pos = pos @ W0[:3, :3].T + W0[:3, 3]
                nor = nor @ np.linalg.inv(W0[:3, :3])
                drop = np.zeros(len(pos), bool)
                for k in range(len(pos)):
                    JW.append(('node', rig.parent.get(ni, ni), None))
            P += list(pos)
            N += list(nor / np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-9))
            UV += list(uv)
            for t in idx:
                if not drop[t].all():
                    I.append([int(t[0]) + base, int(t[1]) + base, int(t[2]) + base])
    P = np.array(P)
    N = np.array(N)
    print('source: %d vertices, %d triangles' % (len(P), len(I)))
    # Colours: the texture over the coat's reference (the median of the body's colour).
    UVa = np.array(UV)
    col = tex[np.clip((UVa[:, 1] % 1) * (th - 1), 0, th - 1).astype(int), np.clip((UVa[:, 0] % 1) * (tw - 1), 0, tw - 1).astype(int)]
    ref = np.median(col, axis=0)
    rel = np.clip(col / np.maximum(ref, 1), 0, 1.99)
    C = [tuple(int(round(v * 128)) for v in c) for c in rel]
    # Weld (UV seams), then reduce in the bind pose; the kept vertices keep their weights.
    groups = {}
    for i, p in enumerate(P):
        groups.setdefault(tuple(np.round(p, 4)), []).append(i)
    remap = np.arange(len(P))
    for ids in groups.values():
        reps = []
        for i in ids:
            for j in reps:
                if np.dot(N[i], N[j]) > 0.7:
                    remap[i] = j
                    break
            else:
                reps.append(i)
    I = [[int(remap[v]) for v in t] for t in I]
    I = [t for t in I if len(set(t)) == 3]
    used0 = sorted(set(v for t in I for v in t))
    nid = {o: k for k, o in enumerate(used0)}
    I = [[nid[v] for v in t] for t in I]
    P, N = P[used0], N[used0]
    C = [C[i] for i in used0]
    JW = [JW[i] for i in used0]
    used, I = vm.decimate(P, I, min(1.0, tris / len(I)), 0.9)
    P, N = P[used], N[used]
    C = [C[i] for i in used]
    JW = [JW[i] for i in used]
    print('reduced: %d vertices, %d triangles' % (len(P), len(I)))
    # Bake the frames.
    rest_skin = None
    frames_p, frames_n = [], []
    for name in FRAMES:
        W = rig.pose(frame_deltas(name))
        Mj = np.stack([W[j] @ IBM[k] for k, j in enumerate(joints)])
        outp = np.zeros_like(P)
        outn = np.zeros_like(N)
        for v in range(len(P)):
            kind, J, w = JW[v]
            if kind == 'skin':
                M = (Mj[J] * w[:, None, None]).sum(0)
            else:
                M = W[J] @ np.linalg.inv(rig.rest_world[J])
            outp[v] = M[:3, :3] @ P[v] + M[:3, 3]
            nn = M[:3, :3] @ N[v]
            outn[v] = nn / max(np.linalg.norm(nn), 1e-9)
        frames_p.append(outp)
        frames_n.append(outn)
        if name == 'stand':
            rest_skin = outp
    # Game frame: facing +x (source +z), z to the right (source -x), the paws on 0, scaled to the height.
    lo = rest_skin.min(0)
    hi = rest_skin.max(0)
    s = MODEL['height'] * UNITS / (hi[1] - lo[1])

    def game(v, normal=False):
        x, y, z = v[:, 0], v[:, 1], v[:, 2]
        out = np.stack([z, y, -x], 1)
        if not normal:
            out = out * s
            out[:, 1] -= lo[1] * s
            out[:, 0] -= (lo[2] + hi[2]) / 2 * s
        return out
    gp = [game(p) for p in frames_p]
    gn = [game(n, True) for n in frames_n]
    # Each pose rests on its lowest point (the sitting dog on its haunches and paws).
    for k in range(len(gp)):
        gp[k][:, 1] -= gp[k][:, 1].min()
    allp = np.concatenate(gp)
    qlo = allp.min(0) - 0.01
    qext = allp.max(0) + 0.01 - qlo
    neck = rig.rest_world[rig.byname['Neck1']][:3, 3]
    collar = game(neck[None, :])[0]
    header = dict(version=1, title=MODEL['title'], url=MODEL['url'], vertices=len(P), triangles=len(I), frames=FRAMES,
                  trotFrames=TROT_FRAMES, quant=[round(float(v), 5) for v in qlo] + [round(float(v), 5) for v in qext],
                  collar=[round(float(v), 3) for v in collar], length=round(float(np.ptp(gp[FRAMES.index('stand')][:, 0])), 3),
                  height=round(float(gp[FRAMES.index('stand')][:, 1].max()), 3))
    blob = vm.Blob()
    blob.add('index', np.array(I, dtype=np.uint16), 'u2')
    blob.add('colour', np.array(C, dtype=np.uint8), 'u1')
    blob.add('position', np.concatenate([np.round((p - qlo) / qext * 65534 - 32767) for p in gp]).astype(np.int16), 'i2')
    blob.add('normal', np.concatenate([np.round(n * 127) for n in gn]).astype(np.int8), 'i1')
    header['arrays'] = blob.arrays
    head = json.dumps(header, separators=(',', ':')).encode()
    head += b' ' * (-(12 + len(head)) % 4)
    out = b'DECDG001' + struct.pack('<I', len(head)) + head + bytes(blob.data)
    out_dir = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(ROOT, 'assets')
    with open(os.path.join(out_dir, 'dog-model.bin'), 'wb') as fh:
        fh.write(out)
    print('dog model: %d vertices, %d triangles, %d frames, %d bytes; length %.1f height %.1f units' % (
        len(P), len(I), len(FRAMES), len(out), header['length'], header['height']))
    if '--preview' in argv:
        # Side views of every frame (orthographic point splats) for a quick look.
        from PIL import Image, ImageDraw
        d = argv[argv.index('--preview') + 1]
        sheet = Image.new('RGB', (200 * len(FRAMES), 160), (90, 90, 90))
        dr = ImageDraw.Draw(sheet)
        cols = np.array(C, float) / 128 * ref
        for k, p in enumerate(gp):
            order = np.argsort(p[:, 2])
            for v in order:
                x = 100 + k * 200 + p[v, 0] * 14
                y = 150 - p[v, 1] * 14
                c = tuple(int(min(255, cc)) for cc in cols[v])
                dr.rectangle([x - 1, y - 1, x + 1, y + 1], fill=c)
            dr.text((k * 200 + 6, 4), FRAMES[k], fill=(255, 255, 255))
        sheet.save(os.path.join(d, 'dog-frames.png'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
