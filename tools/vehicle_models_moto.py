"""Vehicle models, motorbikes: tools/vehicle_models.py's conversion for a downloaded motorbike (`kind='moto'`).

Splits a ready-made motorbike into the parts src/motorbike-assets3d.js builds on the motorbike contract
(motorbikes3d.js): the frame in the bike's paint (`paint`) and the rest (`trim`), what turns with the bars
(`steer.paint`, `steer.trim`, `head`: everything ahead of the steering axis, the bars above `bars`), the tail lamp
(`tail`) and the two wheels (tyre and rim about their own centres, front first). Measures the steering axis, the
saddle, the grips and the pegs for the rider's pose. Brand badges are left out by material (`roles` 'drop') or
painted over in their texture (`erase`: rectangles in UV space filled with the colour round them).
"""
import math

import numpy as np


def convert_moto(model, src_root, vm):
    import os
    g = vm.Gltf(os.path.join(src_root, model['src']))
    mats = g.js.get('materials', [])
    prims = vm.load_primitives(g)
    images, image_keys = {}, {}
    for mi, m in enumerate(mats):
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t is not None:
            key, img = g.image(t['index'])
            images[mi] = erase(img, key, model.get('erase', {}))
            image_keys[mi] = key
    if model.get('up') == '+z':
        for p in prims:
            for k in ('P', 'N'):
                v = p[k]
                p[k] = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)
    front = model['front']
    vm.to_game_frame(prims, front)
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    if model.get('length'):
        s = model['length'] / (hi[0] - lo[0])
        for p in prims:
            p['P'] = p['P'] * s
    T = vm.triangles(prims, mats, model)
    role = vm.cat(T, 'role')
    tri_prim = np.concatenate([np.full(len(t['idx']), t['prim']) for t in T])
    tri_idx = np.concatenate([t['idx'] for t in T])
    keep_tri = role != 'drop'
    allP = np.concatenate([p['P'] for p in prims])
    tyre_pts = np.concatenate([prims[tri_prim[k]]['P'][tri_idx[k]] for k in np.where(role == 'tyre')[0]])
    lo, hi = allP.min(0), allP.max(0)
    shift = np.array([-(lo[0] + hi[0]) / 2, -tyre_pts[:, 1].min(), -(tyre_pts[:, 2].min() + tyre_pts[:, 2].max()) / 2])
    for p in prims:
        p['P'] = p['P'] + shift
    V = lambda k: prims[tri_prim[k]]['P'][tri_idx[k]]  # noqa: E731
    n = len(role)
    cen = np.array([V(k).mean(0) for k in range(n)])
    fn = vm.cat(T, 'fn')
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    L = hi[0] - lo[0]

    # ---- Wheels: the tyres ahead of and behind the middle; whatever lies wholly inside a tyre's hub turns with it.
    tyre_t = np.where(role == 'tyre')[0]
    mid = (cen[tyre_t, 0].min() + cen[tyre_t, 0].max()) / 2
    wheels = []
    for sel in (tyre_t[cen[tyre_t, 0] > mid], tyre_t[cen[tyre_t, 0] <= mid]):
        # The tyre itself: round the group's middle (rubber elsewhere, grips and pegs, stays in the trim).
        c0 = np.median(cen[sel], 0)
        sel = sel[(np.hypot(cen[sel, 0] - c0[0], cen[sel, 1] - c0[1]) < 0.42) & (np.abs(cen[sel, 2] - c0[2]) < 0.12)]
        pts = np.concatenate([V(k) for k in sel])
        a, b = pts.min(0), pts.max(0)
        wheels.append(dict(x=(a[0] + b[0]) / 2, y=(a[1] + b[1]) / 2, z=(a[2] + b[2]) / 2, r=(b[1] - a[1]) / 2, width=b[2] - a[2], tyre=set(sel.tolist()), rim=set()))
    hub = model.get('hub', 0.92)
    for k in np.where(keep_tri & ~np.isin(role, ['tyre', 'paint', 'lamp']))[0]:
        p3 = V(k)
        for w in wheels:
            if np.all(np.hypot(p3[:, 0] - w['x'], p3[:, 1] - w['y']) <= w['r'] * hub) and np.all(np.abs(p3[:, 2] - w['z']) <= w['width'] / 2 + model.get('hubWidth', 0.03)):
                w['rim'].add(int(k))
                break
    in_wheel = set().union(*[w['tyre'] | w['rim'] for w in wheels])

    # ---- The steering: the axis from the front axle up through `axis` (x, y in metres, the game frame); everything
    # wholly ahead of the axis moved back `reach`, and the bars (wholly above `bars` y and ahead of `bars` x), turns.
    wf = wheels[0]
    ax, ay = wf['x'], wf['y']
    tx, ty = model['axis']
    d = np.array([tx - ax, ty - ay])
    d /= np.linalg.norm(d)
    normal = np.array([d[1], -d[0]])  # ahead of the axis
    if normal[0] < 0:
        normal = -normal
    reach = model.get('reach', 0.06)
    bx, by = model['bars']
    steer = set()
    for k in range(n):
        if not keep_tri[k] or k in in_wheel:
            continue
        p3 = V(k)
        ahead = ((p3[:, 0] - ax) * normal[0] + (p3[:, 1] - ay) * normal[1]).min() > -reach
        bar = p3[:, 1].min() > by and p3[:, 0].min() > bx
        if (ahead or bar) and p3[:, 1].max() < ty + 0.5:
            steer.add(k)
    rake = math.atan2(-(tx - ax), ty - ay)  # the axis leaning back from upright (radians, positive: top behind)

    # ---- Lamps: lamp faces ahead of the middle (the head, on the bars) and behind it (the tail).
    head, tail = [], []
    for k in np.where(role == 'lamp')[0]:
        if k in in_wheel:
            continue
        (head if cen[k, 0] > mid else tail).append(int(k))
    head_set, tail_set = set(head), set(tail)

    def pick(roles, want_steer):
        return [int(k) for k in range(n) if keep_tri[k] and role[k] in roles and k not in in_wheel and k not in head_set
                and k not in tail_set and ((k in steer) == want_steer)]

    trim_roles = ('trim', 'rim', 'interior', 'glass', 'lensglass', 'lamp', 'tyre')
    keep = dict(vm.KEEP, **model.get('keep', {}))
    parts = {
        'paint': dict(tris=pick(('paint',), False), keep=keep['paint'], borderCos=model.get('borderCos', 0.985)),
        'trim': dict(tris=pick(trim_roles, False), keep=keep['trim'], minPiece=model.get('minPiece', 0.04), borderCos=model.get('borderCos', 0.985)),
        'steer.paint': dict(tris=pick(('paint',), True), keep=keep['paint']),
        'steer.trim': dict(tris=pick(trim_roles, True), keep=keep['trim'], minPiece=model.get('minPiece', 0.04), borderCos=model.get('borderCos', 0.985)),
        'head': dict(tris=head, colors=True, keep=keep.get('lamp', 1.0), borderCos=model.get('borderCos', 0.985)),
        'tail': dict(tris=tail, colors=True, keep=keep.get('lamp', 1.0), borderCos=model.get('borderCos', 0.985)),
    }
    for wi, w in enumerate(wheels):
        parts['wheel%d.tyre' % wi] = dict(tris=sorted(w['tyre']), origin=(w['x'], w['y'], w['z']), keep=keep['wheel'], borderCos=model.get('borderCos', 0.985))
        parts['wheel%d.rim' % wi] = dict(tris=sorted(w['rim']), origin=(w['x'], w['y'], w['z']), keep=keep['wheel'], minPiece=model.get('minPiece', 0.04), borderCos=model.get('borderCos', 0.985))

    # ---- The rider: the saddle's top at `seat` x, the grips (the bars' outer ends), the pegs (`pegs` hint).
    sx = model['seat']
    near = [V(k) for k in range(n) if keep_tri[k] and k not in in_wheel and abs(cen[k, 0] - sx) < 0.06 and abs(cen[k, 2]) < 0.08]
    seat_y = float(np.concatenate(near)[:, 1].max()) if near else 0.8
    bar_pts = np.concatenate([V(k) for k in steer if V(k)[:, 1].min() > by] or [np.zeros((1, 3))])
    far = bar_pts[np.abs(bar_pts[:, 2]) > np.abs(bar_pts[:, 2]).max() - 0.05]
    grip = [float(far[:, 0].mean()), float(far[:, 1].mean()), float(np.abs(far[:, 2]).max() - 0.05)]
    meta = dict(
        type=model['type'], title=model['title'], front=front, kind='moto',
        dims=[round(float(L), 3), round(float(hi[1]), 3), round(float(hi[2] - lo[2]), 3)],
        wheels=[dict(x=round(float(w['x']), 4), y=round(float(w['y']), 4), z=round(float(w['z']), 4), r=round(float(w['r']), 4),
                     width=round(float(w['width']), 4), side=1, front=wi == 0) for wi, w in enumerate(wheels)],
        axis=[round(float(ax), 4), round(float(ay), 4), round(float(tx), 4), round(float(ty), 4)], rake=round(rake, 4),
        seat=[round(float(sx), 4), round(seat_y, 4)], grip=[round(v, 4) for v in grip], peg=model['pegs'],
        lean=model.get('lean', -0.3),
        x0=round(float(lo[0]), 4), x1=round(float(hi[0]), 4),
        paintTexture=bool(model.get('paintTexture')),
        paintColor=vm.paint_colour(mats, role, tri_prim, model),
    )
    area = vm.cat(T, 'area')
    return dict(meta=meta, prims=prims, mats=mats, images=images, image_keys=image_keys, parts=parts, tri_prim=tri_prim,
                tri_idx=tri_idx, role=role, area=area)


def erase(img, key, plan):
    """A texture with its badges painted over: each (u0, v0, u1, v1) filled with the median colour round it."""
    import os
    rects = plan.get(os.path.basename(key)) if isinstance(key, str) else None
    if not rects:
        return img
    from PIL import Image
    a = np.asarray(img.convert('RGBA')).copy()
    h, w = a.shape[:2]
    for u0, v0, u1, v1 in rects:
        x0, x1, y0, y1 = int(u0 * w), int(u1 * w), int(v0 * h), int(v1 * h)
        pad = max(2, (x1 - x0) // 10)
        ring = np.concatenate([a[max(0, y0 - pad):y0, x0:x1].reshape(-1, 4), a[y1:y1 + pad, x0:x1].reshape(-1, 4),
                               a[y0:y1, max(0, x0 - pad):x0].reshape(-1, 4), a[y0:y1, x1:x1 + pad].reshape(-1, 4)])
        a[y0:y1, x0:x1] = np.median(ring, 0).astype(np.uint8) if len(ring) else 0
    return Image.fromarray(a, 'RGBA')
