"""Vehicle models, special vehicles: tools/vehicle_models.py's conversion for Fort Sentinel's vehicles (`kind='special'`).

The vehicle in the game's frame (x ahead, y up, z to the right; the ground at y 0, centred in x and z), scaled to
`length`: the body in one atlas-textured part (`body`: its own paint is its texture, camouflage and markings and all),
the glass (`glass` roles), four lamps (`lamp` roles, head ahead and tail behind, by side, with their colours), the road
wheels about their own centres (`tyre` roles grouped by axle and side, with whatever sits inside them), and a tank's
turning parts: the turret (`turret` roles, about its ring: `turretAt`) and the gun (`barrel` roles, about its
trunnion: `barrelAt`, in the turret's frame). src/military-assets3d.js builds it.
"""
import numpy as np


def convert_special(model, src_root, vm):
    import os
    g = vm.Gltf(os.path.join(src_root, model['src']))
    mats = g.js.get('materials', [])
    prims = vm.load_primitives(g)
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
    vm.to_game_frame(prims, model['front'])
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    s = model['length'] / (hi[0] - lo[0]) if model.get('length') else 1.0
    for p in prims:
        p['P'] = p['P'] * s
    lo, hi = lo * s, hi * s
    # Centred on the hull when the type's length is only the hull's (a tank: the gun reaches past it).
    mid_x = lo[0] + model['hull'] / 2 if model.get('hull') else (lo[0] + hi[0]) / 2
    shift = np.array([-mid_x, -lo[1], -(lo[2] + hi[2]) / 2])
    for p in prims:
        p['P'] = p['P'] + shift
    T = vm.triangles(prims, mats, model)
    role = vm.cat(T, 'role')
    cen = vm.cat(T, 'cen')
    tri_prim = np.concatenate([np.full(len(t['idx']), t['prim']) for t in T])
    tri_idx = np.concatenate([t['idx'] for t in T])
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    L = hi[0] - lo[0]
    V = lambda k: prims[tri_prim[k]]['P'][tri_idx[k]]  # noqa: E731
    n = len(role)
    # ---- A tank's turning parts by where they are (`split`, metres): everything over `turretAbove` within `turretX` of
    # the middle is the turret, of it whatever lies ahead of `gunFrom` (the mantlet's face) the gun; thin masts above
    # `clipAbove` are left out (whip antennas).
    sp = model.get('split')
    if sp:
        for k in range(n):
            if role[k] == 'drop':
                continue
            c = cen[k]
            if sp.get('clipAbove') and c[1] > sp['clipAbove']:
                role[k] = 'drop'
            elif c[1] > sp['turretAbove'] and c[0] > sp['gunFrom'] and abs(c[2]) < sp.get('gunHalf', 0.4):
                role[k] = 'barrel'
            elif c[1] > sp['turretAbove'] and sp['turretX'][0] < c[0] < sp['turretX'][1]:
                role[k] = 'turret'
    # ---- Wheels: tyre triangles grouped by axle (gaps along x) and side; whatever sits inside a tyre turns with it.
    # A material that holds the wheels with the running gear (`tyreBox`): only what lies wholly below `below` metres
    # and further out than `out` of the half width is wheel; the rest of it is the body's.
    tb = model.get('tyreBox')
    if tb:
        half = (hi[2] - lo[2]) / 2
        for k in np.where(role == 'tyre')[0]:
            p3 = V(k)
            if p3[:, 1].max() > tb['below'] or np.abs(p3[:, 2]).min() < tb.get('out', 0.6) * half:
                role[k] = 'trim'
    tyre_t = np.where(role == 'tyre')[0]
    wheels = []
    if len(tyre_t):
        xs = np.sort(np.unique(np.round(cen[tyre_t, 0], 2)))
        cuts = [xs[0] - 1]
        for a, b in zip(xs[:-1], xs[1:]):
            if b - a > model.get('axleGap', 0.35):
                cuts.append((a + b) / 2)
        cuts.append(xs[-1] + 1)
        for i in range(len(cuts) - 1):
            for side in (-1, 1):
                sel = tyre_t[(cen[tyre_t, 0] > cuts[i]) & (cen[tyre_t, 0] < cuts[i + 1]) & (np.sign(cen[tyre_t, 2]) == side)]
                if len(sel) < model.get('minWheelTris', 60):
                    continue
                pts = np.concatenate([V(k) for k in sel])
                a, b = pts.min(0), pts.max(0)
                wheels.append(dict(x=(a[0] + b[0]) / 2, y=(a[1] + b[1]) / 2, z=(a[2] + b[2]) / 2, r=(b[1] - a[1]) / 2,
                                   width=b[2] - a[2], side=side, tris=set(sel.tolist())))
    wheels.sort(key=lambda w: (-w['x'], w['side']))
    front_x = max(w['x'] for w in wheels) if wheels else 0
    for w in wheels:
        w['front'] = abs(w['x'] - front_x) < 0.2
    cand = np.where(np.isin(role, ['trim', 'rim', 'interior', 'paint']))[0]
    for w in wheels:
        for k in cand:
            p3 = V(k)
            if np.all(np.hypot(p3[:, 0] - w['x'], p3[:, 1] - w['y']) <= w['r'] * 1.02) and np.all(np.abs(p3[:, 2] - w['z']) <= w['width'] / 2 + 0.05):
                w['tris'].add(int(k))
    wheel_of = {}
    for wi, w in enumerate(wheels):
        for k in w['tris']:
            wheel_of[k] = wi
    # ---- Lamps: lamp triangles at the ends, head ahead and tail behind, by side.
    lamp_key = np.full(n, '', dtype=object)
    lamps = {}
    for k in np.where(role == 'lamp')[0]:
        if k in wheel_of:
            continue
        x = cen[k, 0]
        if abs(x) < 0.25 * L:
            role[k] = 'trim'
            continue
        lamp_key[k] = ('head' if x > 0 else 'tail') + ('Left' if cen[k, 2] < 0 else 'Right')
    for key in ('headLeft', 'headRight', 'tailLeft', 'tailRight'):
        sel = np.where(lamp_key == key)[0]
        if len(sel):
            pts = np.concatenate([V(k) for k in sel])
            a, b = pts.min(0), pts.max(0)
            lamps[key] = dict(x=float((a[0] + b[0]) / 2), y=float((a[1] + b[1]) / 2), z=float((a[2] + b[2]) / 2), size=float(max(b[1] - a[1], b[2] - a[2])))
    keep = dict(vm.KEEP, **model.get('keep', {}))
    bc = model.get('borderCos', 0.985)
    mp = model.get('minPiece', 0)
    turret = [k for k in range(n) if role[k] == 'turret' and k not in wheel_of]
    barrel = [k for k in range(n) if role[k] == 'barrel' and k not in wheel_of]
    glass = [k for k in range(n) if role[k] in ('glass', 'lensglass') and lamp_key[k] == '' and k not in wheel_of]
    taken = set(turret) | set(barrel) | set(glass) | set(wheel_of)
    body = [k for k in range(n) if role[k] not in ('drop',) and k not in taken and lamp_key[k] == '']
    # Everything drawn from the atlas counts as trim for the atlas's texel shares (vehicle_models.py build_atlas).
    for k in body + turret + barrel:
        role[k] = 'trim'
    parts = {'glass': dict(tris=glass)}
    # A part too big for 16-bit indices goes out in slices along the vehicle ('body', 'body1', ...; the runtime joins them).
    def sliced(name, tris, **kw):
        tris = sorted(tris, key=lambda k: cen[k, 0])
        n_slices = max(1, (len(tris) + 29999) // 30000)
        step = (len(tris) + n_slices - 1) // n_slices
        for i in range(n_slices):
            parts[name + (str(i) if i else '')] = dict(tris=tris[i * step:(i + 1) * step], **kw)
        return n_slices
    cl = model.get('cluster')
    meta_extra_slices = {'body': sliced('body', body, keep=keep['trim'], borderCos=bc, minPiece=mp, cluster=cl)}
    meta_extra = {}
    if turret:
        tp = np.concatenate([V(k) for k in turret])
        # The ring: the middle of the turret's footprint at its lowest point (or the hint).
        at = model.get('turretAt') or [float((tp[:, 0].min() + tp[:, 0].max()) / 2), float(tp[:, 1].min()), 0.0]
        meta_extra_slices['turret'] = sliced('turret', turret, keep=keep['trim'], borderCos=bc, minPiece=mp, cluster=cl, origin=tuple(at))
        meta_extra['turretAt'] = [round(float(v), 4) for v in at]
    if barrel:
        bp = np.concatenate([V(k) for k in barrel])
        # The trunnion: the gun's rearmost point at its bore's height (or the hint).
        at = model.get('barrelAt') or [float(bp[:, 0].min()), float(np.median(bp[:, 1])), float(np.median(bp[:, 2]))]
        parts['barrel'] = dict(tris=barrel, keep=keep['trim'], borderCos=bc, minPiece=mp, origin=tuple(at))
        meta_extra['barrelAt'] = [round(float(v), 4) for v in at]
        meta_extra['muzzle'] = [round(float(bp[:, 0].max()), 4), round(float(np.median(bp[:, 1])), 4), round(float(np.median(bp[:, 2])), 4)]
    for key in ('headLeft', 'headRight', 'tailLeft', 'tailRight'):
        parts[key] = dict(tris=np.where(lamp_key == key)[0].tolist(), colors=True)
    for wi, w in enumerate(wheels):
        tris = sorted(w['tris'])
        parts['wheel%d.tyre' % wi] = dict(tris=tris, origin=(w['x'], w['y'], w['z']), keep=keep['wheel'], borderCos=bc)
    meta = dict(
        type=model['type'], title=model['title'], front=model['front'], kind='special',
        dims=[round(float(L), 3), round(float(hi[1]), 3), round(float(hi[2] - lo[2]), 3)],
        wheels=[dict(x=round(float(w['x']), 4), y=round(float(w['y']), 4), z=round(float(w['z']), 4), r=round(float(w['r']), 4),
                     width=round(float(w['width']), 4), side=int(w['side']), front=bool(w['front'])) for w in wheels],
        lamps={k: {kk: round(vv, 4) for kk, vv in v.items()} for k, v in lamps.items()},
        x0=round(float(lo[0]), 4), x1=round(float(hi[0]), 4), paintTexture=False, paintColor=None, **meta_extra,
        # The length the type's collider stands for (a tank's hull, the gun reaching past it), when not the whole.
        hull=model.get('hull'), slices=meta_extra_slices,
    )
    area = vm.cat(T, 'area')
    print('  special: body %d, glass %d, turret %d, barrel %d, wheels %d, lamps %s' % (len(body), len(glass), len(turret), len(barrel), len(wheels), sorted(lamps)))
    return dict(meta=meta, prims=prims, mats=mats, images=images, image_keys=image_keys, parts=parts, tri_prim=tri_prim,
                tri_idx=tri_idx, role=role, area=area)
